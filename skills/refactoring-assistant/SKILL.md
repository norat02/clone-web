---
name: refactoring-assistant
description: >
  Proposes concrete refactors for existing code — reducing duplication, improving
  structure, extracting functions/modules — without changing behavior. Invoke when
  the user asks to "refactor this", "clean this up", "reduce duplication", or
  "make this more maintainable". Not for reviewing correctness/security issues in
  isolation (use code-review) or for fixing a specific bug (use debug-assistant).
---

# Refactoring Assistant skill

This skill deliberately has no dedicated script — it composes the two building
blocks that already exist rather than duplicating logic:

1. **`scripts/review.js --focus=maintainability`** to get structured findings
   about duplication, complexity, and structural issues.
2. **`scripts/gemini.js`** directly (or `require()`d as a module) to generate the
   actual refactored code once you know what needs to change.

## Workflow

1. Identify the target file(s). If the user hasn't named them, ask or infer from
   recent conversation/diff context.
2. Run a maintainability-focused review first:
   ```sh
   node scripts/review.js path/to/file.js --focus=maintainability,style
   ```
3. Read the `findings` array. Group related findings (e.g. three instances of the
   same duplicated block) into a small number of concrete refactor proposals
   rather than one fix per finding.
4. For each proposal, write the actual refactored code yourself using your normal
   coding tools — the review step is for identifying *what* to change, not for
   generating the final diff. Only fall back to a Gemini-generated rewrite (via
   `scripts/gemini.js "<prompt>"`) for large mechanical transformations where a
   second draft is genuinely useful to compare against your own.
5. Preserve behavior. Before presenting a refactor, check that:
   - Public function signatures are unchanged unless the user asked for an API
     change
   - Existing tests (if any) still describe the same behavior
   - No functionality was silently dropped in the process of "simplifying"
6. Present the refactor as a diff or clearly-marked before/after, with a short
   explanation of *why* each change improves the code — not just *what* changed.

## Notes

- Refactoring is inherently riskier than a read-only review or a documentation
  pass — it changes shipped code. Be more conservative here than in
  `code-review`: prefer several small, verifiable refactors over one large
  rewrite.
- If the codebase has tests, recommend running them after the refactor. This
  skill does not run tests itself — it only proposes and writes the code changes.
