---
name: code-review
description: >
  Structured code review of one or more files, covering correctness, style,
  security, performance, and maintainability. Invoke when the user asks to
  "review this code", "check this file for issues", "is this PR/diff okay",
  or wants feedback before committing or merging. Not for full-project audits
  (use project-analyzer) or for fixing bugs from an error message (use
  debug-assistant).
---

# Code Review skill

Runs a structured, criteria-driven review of specific files using Gemini via
`scripts/review.js`, then presents the findings in a readable, prioritized form.

## Usage

```sh
node scripts/review.js path/to/file1.js path/to/file2.js
```

Narrow the review to specific concerns with `--focus`:

```sh
node scripts/review.js src/auth.js --focus=security,correctness
```

Valid focus values: `correctness`, `style`, `security`, `performance`,
`maintainability`. Default is all five.

## Workflow

1. Identify which files the user wants reviewed. If they say "review my changes"
   without naming files, ask which files or use `git diff --name-only` to find
   modified files first — don't guess.
2. Run `scripts/review.js` against those files.
3. The script returns JSON with `overallAssessment`, a `findings` array (each with
   `file`, `line`, `severity`, `category`, `issue`, `suggestion`), and `strengths`.
4. Present this to the user as prose or a table, ordered by severity
   (`critical` → `major` → `minor` → `info`). Lead with anything `critical` or
   `major` — don't bury real problems under a long list of style nits.
5. Only apply a suggested fix if the user asks you to; a review is feedback, not
   an automatic edit.

## Notes

- The script sends full file contents to the Gemini API. Warn the user before
  reviewing files that may contain secrets or sensitive data — the same caution
  you'd apply to any external API call.
- For very large files, consider reviewing in sections; the underlying model has
  a finite context window and `scripts/gemini.js` does not automatically chunk
  input.
