---
name: documentation-generator
description: >
  Generates Markdown documentation for source files — README sections, inline
  docstrings, or plain-language summaries — via Gemini. Invoke when the user asks
  to "document this", "write a README for this", "add docstrings", or "summarize
  what this code does" for output meant to be read by humans (not for structured
  review findings — use code-review for that).
---

# Documentation Generator skill

Generates documentation via `scripts/summarize.js`, which supports three modes and
optional streaming for long output.

## Usage

```sh
# README-style section
node scripts/summarize.js src/api/client.js --mode=readme

# Inline doc-comments for every exported symbol
node scripts/summarize.js src/utils.js --mode=docstring

# Plain-language summary (default mode)
node scripts/summarize.js src/legacy-module.js --mode=summary

# Stream output for a long document instead of waiting for the full response
node scripts/summarize.js src/*.js --mode=readme --stream
```

## Workflow

1. Confirm which files to document and which mode fits what the user asked for:
   - "write docs for this module" → usually `readme`
   - "add doc comments" / "document these functions" → `docstring`
   - "explain what this does" / "summarize this" → `summary`
2. Run `scripts/summarize.js` with the chosen files and mode.
3. For `docstring` mode, the output is meant to be inserted back into the source
   file near the symbols it documents — offer to apply it as an edit rather than
   just printing it, since docstrings in isolation aren't very useful.
4. For `readme` mode, offer to append or merge the output into an existing
   `README.md` rather than overwriting one, if the project already has one.
5. Review the generated text before presenting it — Gemini can be verbose or
   over-hedge; trim anything that doesn't add information.

## Notes

- Use `--stream` for large files or multi-file runs so the user isn't staring at
  a blank terminal; for a single small file, streaming adds no benefit.
- This skill sends full file contents to the Gemini API — same data-handling
  caution as the other Gemini-powered skills.
