#!/usr/bin/env node
/**
 * scripts/summarize.js
 * -----------------------------------------------------------------------
 * Documentation Generator — produces Markdown documentation (README
 * sections, function/module docs, or a plain summary) for one or more
 * source files. Supports streaming output for long documents so the
 * caller sees progress instead of waiting for the full response.
 *
 * Usage:
 *   node scripts/summarize.js <file1> [file2 ...] [--mode=readme|docstring|summary] [--stream]
 * -----------------------------------------------------------------------
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { generateContent, generateStream, reportError } = require('./gemini.js');

const MODE_INSTRUCTIONS = {
  readme: 'Write a README-style Markdown section: purpose, installation/usage, and examples.',
  docstring: 'Write inline documentation comments (in the source language\'s native doc-comment style) for every exported function, class, or module.',
  summary: 'Write a concise plain-language summary of what this code does and why it likely exists.',
};

function parseArgs(argv) {
  const files = argv.filter((a) => !a.startsWith('--'));
  const modeFlag = argv.find((a) => a.startsWith('--mode='));
  const mode = modeFlag ? modeFlag.split('=')[1] : 'summary';
  const stream = argv.includes('--stream');
  return { files, mode, stream };
}

function loadFiles(filePaths) {
  return filePaths.map((p) => {
    const resolved = path.resolve(p);
    const content = fs.readFileSync(resolved, 'utf8');
    return { path: p, content };
  });
}

async function main() {
  const { files, mode, stream } = parseArgs(process.argv.slice(2));

  if (files.length === 0) {
    console.error('Usage: node scripts/summarize.js <file1> [file2 ...] [--mode=readme|docstring|summary] [--stream]');
    process.exitCode = 1;
    return;
  }

  const instruction = MODE_INSTRUCTIONS[mode];
  if (!instruction) {
    console.error(`[summarize] Unknown --mode "${mode}". Valid values: ${Object.keys(MODE_INSTRUCTIONS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  let loaded;
  try {
    loaded = loadFiles(files);
  } catch (err) {
    console.error(`[summarize] Could not read one or more files: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  const sourceBlock = loaded
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const prompt = `${instruction}\n\nSource files:\n\n${sourceBlock}`;

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

if (require.main === module) {
  main();
}

module.exports = { parseArgs, loadFiles, MODE_INSTRUCTIONS };
