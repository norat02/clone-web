---
name: project-analyzer
description: >
  Produces a structured architecture overview of an entire project or directory —
  languages, frameworks, structure, risks, and next steps. Invoke when the user
  asks "what does this project do", "give me an overview of this codebase", "help
  me understand this repo", or is onboarding into unfamiliar code. Not for
  reviewing a specific file (use code-review) or diagnosing a specific error (use
  debug-assistant).
---

# Project Analyzer skill

Walks a directory, builds a bounded file inventory, and asks Gemini for a
structured architecture summary via `scripts/analyze.js`.

## Usage

```sh
node scripts/analyze.js .
node scripts/analyze.js ./packages/api --max-files=300 --max-bytes=6000
```

- `--max-files` (default 200): caps how many files are inventoried. Raise this
  for large monorepos, but be aware it increases prompt size and latency.
- `--max-bytes` (default 4000): caps the preview length read from each file.

The script automatically skips `node_modules/`, `.git/`, build output
(`dist/`, `build/`, `.next/`, `out/`), caches, and other directories that would
just add noise.

## Workflow

1. Determine the target path — default to the project root unless the user names
   a subdirectory.
2. Run `scripts/analyze.js` against it.
3. The output is JSON: `summary`, `primaryLanguages`, `frameworks`,
   `architectureNotes`, `risksOrGaps`, `suggestedNextSteps`, plus `filesScanned`
   and the resolved `path` for context.
4. Present this as a readable overview, not a raw JSON dump — lead with the
   summary, then structure, then risks/next-steps if the user seems interested in
   next actions rather than just understanding the code.
5. If `filesScanned` hit the `--max-files` cap, mention that the analysis is based
   on a partial sample and offer to re-run with a higher cap or a narrower path
   for a more complete picture.

## Notes

- This is an architectural overview, not a security or correctness audit — for
  that, point the user at `code-review` on the specific files that matter.
- File contents (truncated previews) are sent to the Gemini API. For projects
  with sensitive data, consider running against a narrower subdirectory rather
  than the whole repo.
