#!/usr/bin/env node
/**
 * scripts/debug.js
 * -----------------------------------------------------------------------
 * Debug Assistant — takes an error message or stack trace (and optionally
 * one or more source files for context) and asks Gemini for a structured
 * root-cause diagnosis and fix suggestion.
 *
 * Usage:
 *   node scripts/debug.js "<error message or stack trace>" [file1] [file2 ...]
 *   cat error.log | node scripts/debug.js --stdin [file1 ...]
 * -----------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { generateJson, reportError } = require('./gemini.js');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    likelyRootCause: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    explanation: { type: 'string' },
    suggestedFix: { type: 'string' },
    filesToChange: { type: 'array', items: { type: 'string' } },
    additionalChecks: { type: 'array', items: { type: 'string' } },
  },
  required: ['likelyRootCause', 'confidence', 'explanation', 'suggestedFix'],
};

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function loadContextFiles(filePaths) {
  return filePaths
    .map((p) => {
      const resolved = path.resolve(p);
      try {
        const content = fs.readFileSync(resolved, 'utf8');
        return `### ${p}\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``;
      } catch (err) {
        return `### ${p}\n(could not read file: ${err.message})`;
      }
    })
    .join('\n\n');
}

async function main() {
  const args = process.argv.slice(2);
  const useStdin = args.includes('--stdin');
  const rest = args.filter((a) => a !== '--stdin');

  let errorText;
  let contextFiles;

  if (useStdin) {
    errorText = (await readStdin()).trim();
    contextFiles = rest;
  } else {
    errorText = rest[0];
    contextFiles = rest.slice(1);
  }

  if (!errorText) {
    console.error(
      'Usage: node scripts/debug.js "<error message or stack trace>" [file1] [file2 ...]\n' +
        '   or: cat error.log | node scripts/debug.js --stdin [file1 ...]'
    );
    process.exitCode = 1;
    return;
  }

  const context = contextFiles.length ? loadContextFiles(contextFiles) : '(no source files provided)';

  const prompt =
    `You are a debugging assistant. Diagnose the root cause of the following error ` +
    `and propose a concrete fix. Be specific — reference line numbers or symbols from ` +
    `the provided context when possible. Do not invent file contents you were not given.\n\n` +
    `## Error\n\`\`\`\n${errorText}\n\`\`\`\n\n## Context files\n${context}`;

  try {
    const result = await generateJson(prompt, RESPONSE_SCHEMA);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    reportError(err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { loadContextFiles };
