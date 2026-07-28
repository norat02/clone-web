#!/usr/bin/env node
/**
 * scripts/gemini.js
 * -----------------------------------------------------------------------
 * Reusable Google AI Studio / Gemini API client for the clone-web plugin.
 *
 * This module is the single place that talks to the Gemini API. Every
 * other script (analyze.js, debug.js, review.js, summarize.js) and every
 * Gemini-powered skill imports it instead of re-implementing HTTP calls.
 *
 * Design goals:
 *   - Zero external dependencies (Node.js 18+ only — uses global fetch)
 *   - Never hardcode secrets — API key always comes from the environment
 *   - Configurable model, timeout, and retry behavior via env vars
 *   - Works unmodified on Claude Code, Replit, and plain Node.js
 *   - Usable both as a CLI ("node scripts/gemini.js ...") and as a
 *     `require()`-able module for the other scripts in this plugin
 *
 * Environment variables (see references/gemini-setup.md for full docs):
 *   GEMINI_API_KEY      Required. API key from https://aistudio.google.com/apikey
 *   GOOGLE_API_KEY       Fallback name some hosts (Vertex/Firebase-style) use.
 *   GEMINI_MODEL         Optional. Default: "gemini-2.5-flash"
 *   GEMINI_TIMEOUT_MS    Optional. Default: 30000
 *   GEMINI_MAX_RETRIES   Optional. Default: 3
 *   GEMINI_BASE_URL      Optional. Default: Google's public endpoint.
 *                         Override to point at a proxy or regional endpoint.
 * -----------------------------------------------------------------------
 */

'use strict';

const DEFAULTS = {
  model: 'gemini-2.5-flash',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  timeoutMs: 30000,
  maxRetries: 3,
  // Base delay for exponential backoff between retries, in milliseconds.
  retryBaseDelayMs: 1000,
};

/**
 * Detect the host runtime so error messages and setup hints can be
 * environment-aware. Every check relies only on environment variables
 * that the respective platform sets automatically — nothing here is
 * Claude-Code-specific, so scripts behave the same in Claude Code,
 * Replit, or a bare terminal.
 */
function detectRuntime() {
  if (process.env.REPL_ID || process.env.REPLIT_DB_URL) return 'replit';
  if (process.env.CLAUDE_PLUGIN_ROOT) return 'claude-code';
  if (process.env.CI) return 'ci';
  return 'local';
}

/**
 * Resolve configuration from the environment. Centralizing this means
 * every script picks up the same defaults and the same env var names.
 */
function loadConfig(overrides = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    const runtime = detectRuntime();
    const hint =
      runtime === 'replit'
        ? 'On Replit: open the "Secrets" tab (padlock icon) and add GEMINI_API_KEY there — never commit it to a file.'
        : 'Set it as a shell environment variable, or add it under the "env" key in .claude/settings.json.';
    throw new GeminiConfigError(
      `No Gemini API key found. Get a key at https://aistudio.google.com/apikey, ` +
        `then set GEMINI_API_KEY (or GOOGLE_API_KEY) as an environment variable. ${hint}`
    );
  }

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || DEFAULTS.timeoutMs;
  const maxRetries = Number.isFinite(Number(process.env.GEMINI_MAX_RETRIES))
    ? Number(process.env.GEMINI_MAX_RETRIES)
    : DEFAULTS.maxRetries;

  return {
    apiKey,
    model: overrides.model || process.env.GEMINI_MODEL || DEFAULTS.model,
    baseUrl: process.env.GEMINI_BASE_URL || DEFAULTS.baseUrl,
    timeoutMs,
    maxRetries,
    retryBaseDelayMs: DEFAULTS.retryBaseDelayMs,
  };
}

/** Thrown when required configuration (e.g. the API key) is missing. */
class GeminiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

/** Thrown when the Gemini API itself returns an error response. */
class GeminiApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
    this.body = body;
  }
}

/** Thrown when a request exceeds GEMINI_TIMEOUT_MS. */
class GeminiTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Gemini request timed out after ${timeoutMs}ms`);
    this.name = 'GeminiTimeoutError';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine whether a failed attempt should be retried.
 * Retries on network errors, timeouts, 429 (rate limit), and 5xx.
 * Does not retry on 400/401/403/404 — those need a code or config fix.
 */
function isRetryable(err) {
  if (err instanceof GeminiTimeoutError) return true;
  if (err instanceof GeminiApiError) {
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }
  // Plain network failures (ECONNRESET, fetch failed, DNS, etc.)
  return err instanceof TypeError || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';
}

/**
 * Perform a fetch() with a hard timeout, translating an abort into a
 * GeminiTimeoutError so callers get a consistent error type.
 */
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new GeminiTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retry wrapper with exponential backoff + jitter.
 */
async function withRetries(fn, { maxRetries, retryBaseDelayMs }) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries || !isRetryable(err)) {
        throw err;
      }
      const backoff = retryBaseDelayMs * 2 ** attempt;
      const jitter = Math.random() * 250;
      await sleep(backoff + jitter);
    }
  }
  // Unreachable, but keeps linters happy.
  throw lastErr;
}

/**
 * Build the request body for generateContent / streamGenerateContent.
 *
 * @param {string|Array} contents - A plain string prompt, or a fully-formed
 *   `contents` array in Gemini's `{role, parts}` shape for multi-turn input.
 * @param {object} opts
 * @param {string} [opts.systemInstruction] - Optional system prompt.
 * @param {object} [opts.responseSchema] - JSON Schema for structured output.
 *   When set, responseMimeType is automatically set to application/json.
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxOutputTokens]
 */
function buildRequestBody(contents, opts = {}) {
  const body = {
    contents: typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents,
  };

  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  const generationConfig = {};
  if (typeof opts.temperature === 'number') generationConfig.temperature = opts.temperature;
  if (typeof opts.maxOutputTokens === 'number') generationConfig.maxOutputTokens = opts.maxOutputTokens;
  if (opts.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = opts.responseSchema;
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig;
  }

  return body;
}

/**
 * Extract the plain text from a non-streaming generateContent response.
 */
function extractText(apiResponse) {
  const candidate = apiResponse?.candidates?.[0];
  if (!candidate) {
    const blockReason = apiResponse?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new GeminiApiError(`Prompt was blocked by Gemini: ${blockReason}`, { body: apiResponse });
    }
    throw new GeminiApiError('Gemini response contained no candidates', { body: apiResponse });
  }
  return (candidate.content?.parts || []).map((p) => p.text || '').join('');
}

/**
 * Call generateContent once (with retries + timeout) and return plain text
 * or, when a responseSchema was supplied, the parsed JSON object.
 */
async function generateContent(contents, opts = {}) {
  const config = loadConfig(opts);
  const body = buildRequestBody(contents, opts);
  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:generateContent`;

  const apiResponse = await withRetries(async () => {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify(body),
      },
      config.timeoutMs
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new GeminiApiError(
        `Gemini API request failed with status ${res.status}`,
        { status: res.status, body: errBody }
      );
    }

    return res.json();
  }, config);

  const text = extractText(apiResponse);
  if (opts.responseSchema) {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new GeminiApiError(
        'Gemini returned a responseSchema request but the output was not valid JSON',
        { body: text }
      );
    }
  }
  return text;
}

/**
 * Stream a response, invoking onChunk(textDelta) as tokens arrive.
 * Returns the full concatenated text once the stream completes.
 *
 * Streaming requests are not retried automatically: a partial stream that
 * fails midway would otherwise duplicate output. Callers that need retry
 * behavior on stream failure should catch and re-invoke generateStream.
 */
async function generateStream(contents, opts = {}, onChunk = () => {}) {
  const config = loadConfig(opts);
  const body = buildRequestBody(contents, opts);
  const url = `${config.baseUrl}/models/${encodeURIComponent(config.model)}:streamGenerateContent?alt=sse`;

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    },
    config.timeoutMs
  );

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new GeminiApiError(
      `Gemini streaming request failed with status ${res.status}`,
      { status: res.status, body: errBody }
    );
  }

  if (!res.body) {
    throw new GeminiApiError('Gemini streaming response had no readable body');
  }

  let full = '';
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep the last, possibly-incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        continue; // skip malformed SSE frames rather than aborting the stream
      }
      const delta = (parsed.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '')
        .join('');
      if (delta) {
        full += delta;
        onChunk(delta);
      }
    }
  }

  return full;
}

/**
 * Convenience helper for structured JSON output. Equivalent to
 * generateContent(contents, { ...opts, responseSchema }).
 */
async function generateJson(contents, responseSchema, opts = {}) {
  return generateContent(contents, { ...opts, responseSchema });
}

// ---------------------------------------------------------------------
// CLI entry point: `node scripts/gemini.js "your prompt" [--stream] [--json]`
// ---------------------------------------------------------------------
async function runCli() {
  const args = process.argv.slice(2);
  const stream = args.includes('--stream');
  const prompt = args.filter((a) => !a.startsWith('--')).join(' ');

  if (!prompt) {
    console.error('Usage: node scripts/gemini.js "<prompt>" [--stream]');
    process.exitCode = 1;
    return;
  }

  try {
    if (stream) {
      await generateStream(prompt, {}, (delta) => process.stdout.write(delta));
      process.stdout.write('\n');
    } else {
      const text = await generateContent(prompt);
      console.log(text);
    }
  } catch (err) {
    reportError(err);
    process.exitCode = 1;
  }
}

/**
 * Print a clear, actionable error message. Shared by every script that
 * imports this module so failures look consistent across the plugin.
 */
function reportError(err) {
  if (err instanceof GeminiConfigError) {
    console.error(`[gemini] Configuration error: ${err.message}`);
  } else if (err instanceof GeminiTimeoutError) {
    console.error(`[gemini] ${err.message}. Increase GEMINI_TIMEOUT_MS if your prompts are large.`);
  } else if (err instanceof GeminiApiError) {
    console.error(`[gemini] API error (status ${err.status ?? 'n/a'}): ${err.message}`);
    if (err.body) console.error(`[gemini] Response body: ${JSON.stringify(err.body).slice(0, 500)}`);
  } else {
    console.error(`[gemini] Unexpected error: ${err.message}`);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  generateContent,
  generateStream,
  generateJson,
  loadConfig,
  detectRuntime,
  reportError,
  GeminiConfigError,
  GeminiApiError,
  GeminiTimeoutError,
};
