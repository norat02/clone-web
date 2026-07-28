#!/usr/bin/env node
/**
 * scripts/analyze.js
 * -----------------------------------------------------------------------
 * Project Analyzer — walks a directory, builds a lightweight file/text
 * inventory, and asks Gemini for a structured summary of the project's
 * architecture, stack, and notable risks.
 *
 * Usage:
 *   node scripts/analyze.js [path] [--max-files=200] [--max-bytes=4000]
 *
 * If [path] is omitted, the current working directory is analyzed.
 * Output is printed as JSON to stdout so it can be piped to other tools.
 * -----------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { generateJson, reportError } = require('./gemini.js');

// Directories we never want to walk into — keeps the scan fast and avoids
// accidentally reading gigabytes of installed dependencies or build output.
const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', '.cache',
  'vendor', '.venv', '__pycache__', '.turbo', 'coverage',
]);

function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = Object.fromEntries(
    argv
      .filter((a) => a.startsWith('--') && a.includes('='))
      .map((a) => a.slice(2).split('='))
  );
  return {
    targetPath: positional[0] || '.',
    maxFiles: Number(flags['max-files']) || 200,
    maxBytesPerFile: Number(flags['max-bytes']) || 4000,
  };
}

/**
 * Recursively collect a bounded list of files with a short text preview.
 * Bounded by maxFiles so this stays cheap even on very large repos.
 */
function walk(rootDir, maxFiles, maxBytesPerFile) {
  const results = [];
  const stack = [rootDir];

  while (stack.length && results.length < maxFiles) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      continue; // unreadable directory (permissions, broken symlink, etc.)
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      let preview = '';
      try {
        const buf = fs.readFileSync(fullPath);
        preview = buf.slice(0, maxBytesPerFile).toString('utf8');
      } catch {
        preview = '(binary or unreadable file)';
      }

      results.push({
        path: path.relative(rootDir, fullPath),
        bytes: fs.statSync(fullPath).size,
        preview,
      });
    }
  }

  return results;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'One-paragraph overview of the project' },
    primaryLanguages: { type: 'array', items: { type: 'string' } },
    frameworks: { type: 'array', items: { type: 'string' } },
    architectureNotes: { type: 'string' },
    risksOrGaps: { type: 'array', items: { type: 'string' } },
    suggestedNextSteps: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'primaryLanguages', 'architectureNotes'],
};

async function main() {
  const { targetPath, maxFiles, maxBytesPerFile } = parseArgs(process.argv.slice(2));
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    console.error(`[analyze] Path does not exist: ${resolved}`);
    process.exitCode = 1;
    return;
  }

  const files = walk(resolved, maxFiles, maxBytesPerFile);
  if (files.length === 0) {
    console.error(`[analyze] No readable files found under ${resolved}`);
    process.exitCode = 1;
    return;
  }

  const inventory = files
    .map((f) => `### ${f.path} (${f.bytes} bytes)\n${f.preview}`)
    .join('\n\n');

  const prompt =
    `You are analyzing a software project. Below is a bounded inventory of ` +
    `${files.length} files (previews truncated at ${maxBytesPerFile} bytes each). ` +
    `Identify the primary languages, frameworks, overall architecture, and any ` +
    `notable risks or gaps.\n\n${inventory}`;

  try {
    const result = await generateJson(prompt, RESPONSE_SCHEMA);
    console.log(JSON.stringify({ path: resolved, filesScanned: files.length, ...result }, null, 2));
  } catch (err) {
    reportError(err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { walk, parseArgs };
