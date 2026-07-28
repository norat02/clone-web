---
name: gemini-assistant
description: >
  General-purpose access to Google's Gemini models via Google AI Studio, for ad hoc
  prompts, second opinions, or cross-model comparison against Claude's own answer.
  Invoke this skill when the user explicitly asks to "ask Gemini", "check with
  Gemini", "use Google AI Studio", "compare with Gemini", or wants a Gemini-specific
  capability (e.g. its very large context window) applied to a task. Do not invoke
  this automatically just because a task is general-purpose — only when Gemini is
  requested by name or the user asks for a second AI opinion.
---

# Gemini Assistant skill

This skill gives you direct, on-demand access to Google's Gemini API through the
shared client in `scripts/gemini.js`. Use it when the user wants a Gemini response
specifically — not as a silent substitute for your own reasoning.

## Prerequisites

Before running any command below, confirm `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) is
set. If a call fails with a configuration error, direct the user to
`references/gemini-setup.md` rather than guessing at a fix.

## Usage

**Simple prompt (non-streaming):**

```sh
node scripts/gemini.js "Explain the CAP theorem in two sentences."
```

**Streaming output** (prints tokens as they arrive — use for long-form answers so
the user sees progress instead of a long silent wait):

```sh
node scripts/gemini.js "Write a detailed migration plan for X." --stream
```

**Structured JSON output or multi-turn conversations** — these need the
programmatic API rather than the CLI. Write a small throwaway script that
`require()`s `scripts/gemini.js` and calls `generateJson(prompt, schema)` or passes
a full `contents` array to `generateContent`. See the module's own doc comments in
`scripts/gemini.js` for the exact function signatures.

## When the user wants a second opinion

If the user asks you to compare your own answer against Gemini's:

1. Answer the question yourself first, in your own voice.
2. Run the same prompt through `scripts/gemini.js`.
3. Present both answers side by side and note any material disagreement — don't
   silently pick one. Let the user weigh them.

## Configuration knobs

All of these are environment variables, never hardcoded values:

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | API key (required) | — |
| `GEMINI_MODEL` | Model name | `gemini-2.5-flash` |
| `GEMINI_TIMEOUT_MS` | Per-request timeout | `30000` |
| `GEMINI_MAX_RETRIES` | Retries on 429/5xx/timeout | `3` |

Full setup instructions (Google AI Studio, Replit Secrets, troubleshooting) live in
`references/gemini-setup.md`.

## Error handling

`scripts/gemini.js` distinguishes configuration errors (missing key), API errors
(bad request, rate limit, server error), and timeouts, and prints an actionable
message for each rather than a raw stack trace. If a command fails, read the
printed `[gemini] ...` line back to the user instead of re-running blindly.
