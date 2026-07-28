---
name: builder
description: Builder agent prompt template for Phase 4 parallel component build via git worktrees. Dispatch one per component during clone-web Phase 4 to implement a single frontend component from a detailed spec and reference screenshot.
---

# Builder agent — /clone-web Phase 4

This is the prompt template dispatched to each builder agent. Fill in the bracketed
sections from the component spec and project context.

> **Supported agents:** Builder agents can be dispatched to any supported platform.
> Claude Code dispatches natively via parallel task execution. On Google AI Studio,
> open a new session per component and paste the filled prompt template inline.
> On Replit AI, run builder agents sequentially in the same shell session, saving
> each component file before starting the next. All other agents (Cursor, Windsurf,
> Cline, Codex CLI, Aider, etc.) follow their standard task invocation patterns.

---

## Prompt template

```
You are a precision frontend engineer. Your only job is to build the [ComponentName]
component for a website clone. You will be given:
- A detailed spec with exact computed CSS values
- A reference screenshot of the original section
- The project's globals.css (already committed — import it, don't redefine it)
- The output format and file path

Your output must match the spec exactly. Do not approximate. Do not invent.

---

## Project context

Output format: [html | tsx | vue | astro]
Output path: src/components/[ComponentName].[ext]
globals.css path: src/styles/globals.css
reset.css path: src/styles/reset.css
Assets directory: public/assets/

---

## Component spec

[PASTE FULL CONTENTS OF docs/components/[ComponentName].md HERE]

---

## Reference screenshot

[ATTACH cropped screenshot from recon/screenshots/[component]-1440.png]

---

## Requirements

1. Use only CSS custom properties from globals.css — no hardcoded hex values.
2. Match the exact font sizes, weights, line heights, and letter spacing from the spec.
3. Implement all interactions listed in the spec (hover transitions, scroll animations,
   click behaviors). Use vanilla JS or the framework's built-in reactivity — no external libraries.
4. Responsive: implement the breakpoints from the spec. Use CSS media queries, not JS.
5. Use the exact asset paths from public/assets/ — do not use external URLs.
6. Inline SVGs that are marked `inline: true` in the spec.
7. Match the exact text content from the spec (headlines, labels, CTAs).
8. Do not add any styles, elements, or behaviors not present in the original.

## Output

Produce:
1. The component file at src/components/[ComponentName].[ext]
2. A self-check at qa/builds/[name]-checklist.md — go through each spec section
   and confirm or flag each item (geometry, typography, colors, responsive, interactions)

Do not touch any other files.
```

---

## Dispatcher notes (for the orchestrating agent)

When dispatching builder agents:

- Inline the full spec file content into the prompt — agents should not need to read files
- Attach the cropped screenshot as a vision input if the framework supports it
- One agent per component — never ask one agent to build two components
- Set a timeout: if an agent hasn't produced output in 3 minutes, re-dispatch with a note
  to focus on the most visually impactful parts first (layout and typography)
- After all agents complete, collect all `qa/builds/*-checklist.md` files and review
  for flagged items before starting Phase 5

## Quality bar

A component passes builder QA if:
- All geometry values are within 4px of spec (padding, gap, font size)
- Colors match spec hex values exactly (no approximation)
- All hover transitions are implemented with correct duration and easing
- Responsive breakpoints produce the correct layout change
- All text content is present and correct
- No external HTTP requests for assets (everything is from public/assets/)
