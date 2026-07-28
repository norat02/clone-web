#!/usr/bin/env node
/**
 * scripts/review.js
 * -----------------------------------------------------------------------
 * Code Review / Refactoring Assistant — sends one or more files to Gemini
 * and returns structured review findings (correctness, style, security,
 * performance) with per-file, per-line-range comments where possible.
 *
 * Usage:
 *   node scripts/review.js <file1> [file2 ...] [--focus=security]
 *
 * --focus accepts a comma-separated list: correctness,style,security,
 *   performance,maintainability (default: all of them)
 * -----------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { generateJson, reportError } = require('./gemini.js');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    overallAssessment: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'string', description: 'Line number or range, if identifiable' },
          severity: { type: 'string', enum: ['info', 'minor', 'major', 'critical'] },
          category: {
            type: 'string',
            enum: ['correctness', 'style', 'security', 'performance', 'maintainability'],
          },
          issue: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['file', 'severity', 'category', 'issue', 'suggestion'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
  },
  required: ['overallAssessment', 'findings'],
};

function parseArgs(argv) {
  const files = argv.filter((a) => !a.startsWith('--'));
  const focusFlag = argv.find((a) => a.startsWith('--focus='));
  const focus = focusFlag
    ? focusFlag.split('=')[1].split(',').map((s) => s.trim())
    : ['correctness', 'style', 'security', 'performance', 'maintainability'];
  return { files, focus };
}

function loadFiles(filePaths) {
  return filePaths.map((p) => {
    const resolved = path.resolve(p);
    const content = fs.readFileSync(resolved, 'utf8');
    return { path: p, content };
  });
}

async function main() {
  const { files, focus } = parseArgs(process.argv.slice(2));

  if (files.length === 0) {
    console.error('Usage: node scripts/review.js <file1> [file2 ...] [--focus=security,performance]');
    process.exitCode = 1;
    return;
  }

  let loaded;
  try {
    loaded = loadFiles(files);
  } catch (err) {
    console.error(`[review] Could not read one or more files: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const sourceBlock = loaded
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const prompt =
    `You are performing a code review focused on: ${focus.join(', ')}.\n` +
    `Review the following file(s). For every issue, cite the file and, where ` +
    `possible, a line number or range. Be concrete and actionable — every ` +
    `suggestion should be something a developer can apply directly.\n\n${sourceBlock}`;

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

module.exports = { parseArgs, loadFiles };
