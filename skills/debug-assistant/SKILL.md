---
name: debug-assistant
description: >
  Diagnoses a specific error message, stack trace, or failing test by combining it
  with relevant source files and asking Gemini for a structured root-cause analysis
  and fix. Invoke when the user pastes an error/stack trace and asks what's wrong,
  says something is crashing or failing, or asks "why doesn't this work". Not for
  general code review with no specific failure (use code-review) or full-project
  analysis (use project-analyzer).
---

# Debug Assistant skill

Pairs an error message with source context and gets a structured diagnosis from
Gemini via `scripts/debug.js`. This is a second opinion, not a replacement for your
own debugging — use both.

## Usage

```sh
node scripts/debug.js "TypeError: Cannot read properties of undefined (reading 'map')" src/list.js
```

Or pipe a log file in directly:

```sh
cat error.log | node scripts/debug.js --stdin src/server.js src/db.js
```

## Workflow

1. Get the exact error text or stack trace from the user — don't paraphrase it,
   paraphrasing can hide the exact line/symbol that matters.
2. Identify which source files are relevant. If the stack trace names files,
   pass those. If not, ask or use your own judgment from the codebase.
3. Run `scripts/debug.js` with the error text and context files.
4. The script returns JSON: `likelyRootCause`, `confidence` (low/medium/high),
   `explanation`, `suggestedFix`, `filesToChange`, `additionalChecks`.
5. Cross-check the suggested root cause against what you already know about the
   codebase before presenting it — Gemini's diagnosis is a hypothesis, especially
   at `low` or `medium` confidence. Say so explicitly if you're not fully certain.
6. Only apply the suggested fix if the user asks you to.

## Notes

- If confidence comes back `low`, say so plainly and suggest what additional
  context (more files, reproduction steps, logs) would sharpen the diagnosis
  rather than presenting a low-confidence guess as settled.
- This skill sends error text and file contents to an external API — the same
  data-handling caution as `code-review` applies.
