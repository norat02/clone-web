---
name: clone-web
description: >
  Multi-phase pipeline for cloning a live website into a modern codebase. Invoke this skill
  whenever the user types `/clone-web`, mentions cloning or reverse-engineering a website,
  wants to migrate a site (WordPress to Next.js, Webflow to React, Squarespace to custom),
  needs to recover source code from a live site with no repo, wants to deconstruct a
  production site's layout or animation techniques, or asks for a faithful HTML/React/Vue
  reproduction of a URL. Also trigger when the user says things like "the site is live but
  the repo is gone", "rebuild this site from scratch", or "I want the code behind this URL".
  Do not trigger for general web design questions, mockup generation, or screenshot-to-code
  tasks that don't involve a live URL.
---

# /clone-web skill

You are orchestrating a multi-phase website cloning pipeline. The goal is a high-fidelity,
production-quality codebase that faithfully reproduces a live site — not a rough approximation.
Work methodically through each phase. Read the relevant reference file before starting each phase.

## Entry point

If the user invoked `/clone-web` with no URL, ask for the target URL before doing anything else.

Once a URL is provided:
1. Remind the user of the ethical constraints (see **Ethics** section) and confirm they own the site or have permission to reproduce it.
2. **Do not ask about stack or output format yet.** Run the full Analysis Protocol below first.
3. Only after the analysis is complete do you surface the stack question and output mode choice.

---

## Analysis protocol

**Complete this entire protocol before writing any code or asking about implementation.**
The goal is to understand the site as a unified product — not just its landing page.

### Step A — Broad exploration

Use `web_fetch` and `scripts/recon.js` to crawl the site systematically:

- Fetch the root URL and parse all `<a href>` links to build a full sitemap
- Follow every internal link: nav items, footer links, sidebar links, CTAs, breadcrumbs
- Identify distinct page templates (landing, dashboard, docs, blog, auth, settings, pricing, etc.)
- Note which routes require authentication — list them explicitly as "not verified"
- Record the URL and purpose of every unique page found

Err on the side of exploring more pages, not fewer. Do not stop at the landing page.

### Step B — Deep per-page analysis

For each accessible page, record:

**Information architecture**
- Page title, URL, role in the overall site hierarchy
- Primary content sections and their visual order
- Navigation elements present (global nav, sidebar, breadcrumbs, tabs, pagination)

**Layout & grid**
- Container widths, max-widths, column structure
- Spacing rhythm: padding/margin/gap values that repeat across sections
- Sticky or fixed elements (headers, sidebars, CTAs, back-to-top)

**Typography system**
- Every distinct text style: role (h1–h6, body, caption, label, code), font-family, size, weight, line-height, letter-spacing, color
- Verify whether the same type scale appears across multiple pages

**Color system**
- Primary, secondary, accent colors; neutrals; semantic colors (success, error, warning, info)
- Background layers, surface elevations, border colors, shadow values
- Dark mode support — if present, document both palettes

**Reusable components**
Identify every recurring UI element across pages:
- Navigation bars, mega menus, mobile drawers
- Cards (content, product, profile, stat)
- Buttons (primary, secondary, ghost, icon-only, destructive) and all their states
- Forms, inputs, selects, checkboxes, radios, toggles, sliders
- Tables, lists, accordions, tabs, tooltips, popovers, modals, drawers, toasts
- Loading skeletons, empty states, error states, success states
- Badges, tags, chips, avatars, progress indicators, breadcrumbs

For each component: document all observable states (default, hover, focus, active, disabled, error, loading).

**Interactions & motion**
- Hover transitions: which properties change, duration, easing
- Scroll-triggered animations: threshold, animation type, duration
- Page transitions and route change behavior
- Micro-interactions: button press feedback, input focus rings, toggle animations
- Parallax, sticky behaviors, scroll-linked effects

**Responsive behavior**
Test at 1440px, 768px, and 375px:
- Where does the layout break or reflow?
- What collapses (nav → hamburger, sidebar → bottom sheet, grid → stack)?
- Which elements change size, hide, or reorder at each breakpoint?

**Forms & flows**
- All form fields, validation rules (required, format, length), error messages
- Multi-step flows: how many steps, progress indicator, back/forward navigation
- Submission feedback: success state, error handling, redirect behavior

**Authentication (if accessible)**
- Sign up / sign in / password reset flows
- OAuth providers shown
- Onboarding steps after registration
- Permission or role-based UI differences (if observable)

**Special patterns**
- Search: instant vs submitted, filters, sorting, empty/no-results states
- Dashboard or data views: chart types, table behaviors, filter panels, date pickers
- Documentation pages: sidebar nav structure, code blocks, versioning
- Any custom or distinctive patterns not covered above

### Step C — Cross-page verification

After exploring all pages, verify consistency:
- Do the same components look and behave identically across pages?
- Are there exceptions, variations, or inconsistencies? Document them.
- Does the color and type system hold across all templates?
- Are there pages that use a noticeably different design language?

### Step D — What could not be verified

Explicitly list:
- Pages or flows blocked by authentication
- Features that require user data or account state
- Interactive states that could not be triggered (e.g., error states, empty states with no data)
- Any ambiguity about observed behavior

If critical features are unverifiable and essential to understand before implementation, pause and ask the user for clarification or credentials before continuing.

### Step E — Analysis synthesis

Write a structured summary covering:
1. Overall design philosophy and visual identity
2. Complete design system (tokens, typography, color, spacing, radius, shadow, motion)
3. Full component inventory with states
4. Page templates and their relationships
5. Navigation architecture and user flows
6. Responsive strategy and breakpoints
7. Interaction and animation model
8. Accessibility observations (semantic HTML, focus management, contrast, keyboard nav)
9. Anything unique or distinctive about this site's design language
10. What could not be verified (from Step D)

---

## Stack & output decision (after analysis only)

Once the analysis synthesis is complete, ask the user two questions in sequence.

**Question 1 — Technology stack**

Ask which programming language, framework, and tech stack to use. Do not suggest a default.
Wait for an explicit answer before proceeding. Common options include but are not limited to:
plain HTML/CSS/JS, React (Vite or Next.js), Vue 3, Svelte/SvelteKit, Astro, Angular,
or any other stack the user names.

**Question 2 — Output mode**

Once the stack is confirmed, present these two options:

> **Option 1 — Complete source code**
> Generate the full implementation: all pages, components, styles, assets, config files,
> and routing. Every feature observed during analysis is implemented to the extent possible
> with the chosen stack. Code is production-ready, not scaffolding.

> **Option 2 — Comprehensive implementation prompt**
> Generate a detailed Markdown prompt (not code) that another AI or developer can use
> to build the site from scratch. The prompt must include:
> - Design system specification (exact token values, type scale, color palette)
> - Component library documentation (every component, all states, interaction model)
> - Page-by-page layout and content specification
> - Routing and navigation architecture
> - Responsive implementation details
> - Animation and motion spec
> - Forms and flow documentation
> - Project structure and file organization
> - Tech stack setup and configuration instructions
> - Coding standards and conventions
> - Implementation order and phasing recommendations
> - Deployment and environment notes
> - Any open questions or decisions left for the implementer
>
> Emphasize `.md` documentation files — they should be complete enough that no
> additional research is needed to begin implementation.

Wait for the user's selection before generating any output.

---

## Execution (after stack + output mode confirmed)

Only after the analysis is complete and both questions are answered, proceed:

- **Option 1 selected:** Run Phases 1–5 (see below), generating real code using the chosen stack.
- **Option 2 selected:** Produce the implementation prompt document. No code is generated.
  Save the prompt to `docs/implementation-prompt.md` and present it to the user.

---

## Phase overview

```
[Analysis protocol]          Explore, document, synthesize — no code yet
[Stack & output decision]    Ask language/framework, ask Option 1 or 2
Phase 1 — Reconnaissance     Extract structure, tokens, assets, interactions
Phase 2 — Foundation         Set up project, globals, fonts, colors, asset downloads
Phase 3 — Component Specs    Write detailed spec files per section/component
Phase 4 — Parallel Build     Dispatch builder agents per section (git worktrees)
Phase 5 — Assembly & QA      Merge, wire up, visual diff, fix regressions
```

Phases 1–5 apply only when Option 1 (source code) is selected.
Read `references/phases.md` for exact scripts, commands, and output schemas.

---

## Phases 1–5 (Option 1 only)

Full command references, schemas, scripts, and step-by-step instructions for all five
build phases are in `references/phases.md`. Read that file before starting Phase 1.

Summary:
- **Phase 1 — Recon:** `scripts/recon.js [URL]` → screenshots, tokens, assets, structure into `recon/`
- **Phase 2 — Foundation:** scaffold project, write globals.css + reset.css, download assets
- **Phase 3 — Specs:** one `docs/components/[name].md` per component — exact computed values, no guessing
- **Phase 4 — Build:** git worktrees + builder agents (see `agents/builder.md`) — one agent per component
- **Phase 5 — QA:** `scripts/visual-diff.js` → pixel diff report, fix until ≥ 90% similarity

---

## Output structure

### Option 1 — Source code output

```
[project-name]/
├── src/
│   ├── styles/
│   │   ├── globals.css      — all design tokens as CSS custom properties
│   │   └── reset.css        — baseline box-model reset
│   ├── components/          — one file per cloned section
│   └── [index or App file]  — assembled page
├── public/
│   └── assets/              — downloaded images, fonts, SVGs
├── docs/
│   └── components/          — spec .md files (one per component)
├── recon/                   — reconnaissance outputs (read-only after Phase 1)
│   ├── screenshots/
│   ├── tokens.json
│   ├── assets.json
│   └── structure.json
└── qa/
    └── diff-report.html     — visual diff results
```

### Option 2 — Implementation prompt output

```
docs/
└── implementation-prompt.md   — the complete prompt document
    ├── ## Design philosophy
    ├── ## Design system
    │   ├── ### Color tokens
    │   ├── ### Typography scale
    │   ├── ### Spacing & radius
    │   └── ### Motion & animation
    ├── ## Component library
    │   └── ### [ComponentName] (one section per component)
    │       ├── States
    │       ├── Variants
    │       └── Interaction spec
    ├── ## Page specifications
    │   └── ### [PageName] (one section per page)
    ├── ## Navigation & routing
    ├── ## Responsive implementation
    ├── ## Forms & user flows
    ├── ## Project structure
    ├── ## Tech stack setup
    ├── ## Coding standards
    ├── ## Implementation order
    ├── ## Deployment notes
    └── ## Open questions
```

The implementation prompt must be self-contained. A developer reading it should not need
to visit the original site or ask any follow-up questions to begin building.

---

## Supported platforms

This skill runs on any AI coding agent that can execute bash, read files, and spawn
subprocesses. The pipeline is orchestrator-agnostic — the phases, scripts, and output
schemas are identical regardless of which agent runs them.

| Agent | Status |
|-------|--------|
| Claude Code | **Recommended** — Opus 4.6 |
| Codex CLI | Supported |
| OpenCode | Supported |
| GitHub Copilot | Supported |
| Cursor | Supported |
| Windsurf | Supported |
| Gemini CLI | Supported |
| Google AI Studio (Gemini) | Supported |
| Replit AI | Supported |
| Cline | Supported |
| Roo Code | Supported |
| Continue | Supported |
| Amazon Q | Supported |
| Augment Code | Supported |
| Aider | Supported |

### Platform-specific notes

**Claude Code (Recommended)**
Full native support. All five phases run without modification. Subagent dispatch in
Phase 4 uses Claude Code's built-in parallel task execution. Vision input for screenshot
comparison in builder agents works out of the box.

**Google AI Studio (Gemini)**
Supported via the Gemini API or the AI Studio chat interface. When running Phase 4
builder agents, pass component specs as inline text — AI Studio does not support
reading files from disk directly. Use the `--out` flag on all scripts to write outputs
to a path your local environment can read back. Vision inputs (reference screenshots)
can be attached as image uploads in the AI Studio interface. Gemini 1.5 Pro or 2.0
Flash recommended for context length — component specs can be long.

Adapter note: AI Studio sessions are stateless between turns. Keep the full phase
context (current phase number, output paths, pending components) in a local
`clone-web-state.json` file and paste the relevant section at the start of each
new session.

**Replit AI**
Supported natively within a Replit environment. The scripts run in the Replit shell
without modification. `puppeteer` may require `--no-sandbox` due to Replit's container
constraints — pass this flag in `recon.js` when launching the browser:
```js
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
```
Asset downloads and git worktree operations work normally. Phase 4 parallel dispatch
runs as sequential shell tasks if the Replit plan does not support concurrent processes;
quality is identical, only speed differs. The Replit AI agent can read and write all
output files in the project directory without extra configuration.

**Gemini CLI**
Invoke phases from the terminal using `gemini -p "$(cat phase-prompt.txt)"` with the
relevant phase instructions. All scripts run locally; Gemini CLI acts as the
orchestrating intelligence. Pipe recon outputs into subsequent prompts using heredocs
or temp files.

**Codex CLI / Aider / Continue / Cline / Roo Code / Augment Code / Amazon Q / Cursor / Windsurf / OpenCode / GitHub Copilot**
All supported without modification. These agents can read and execute the scripts
directly. Phase 4 builder dispatch runs as sequential or parallel tasks depending on
the agent's capability — the output is identical either way. Follow each agent's
standard workflow for running shell commands and reading file outputs.

---

## Ethics

This tool is intended for:
- **Platform migration** — rebuilding a site you own into a modern stack
- **Source recovery** — repo is gone, developer left, or stack is legacy
- **Learning** — deconstructing production techniques for educational purposes

This tool must not be used for:
- Phishing, impersonation, or any deceptive purpose
- Passing off someone else's design, copy, or brand assets as your own
- Violating a site's terms of service (check `robots.txt` and ToS before proceeding)

If the user's stated purpose seems to fall outside legitimate use, ask clarifying questions
before proceeding. Logos, original copy, and brand assets belong to their owners — the
clone should use placeholder content for anything the user doesn't own.

---

## Quick reference

| Step | Action | Output |
|------|--------|--------|
| Analysis A–C | `web_fetch` + `scripts/recon.js`, crawl all pages | Full site understanding |
| Analysis D | List unverifiable features | Gaps documented |
| Analysis E | Synthesize findings | Structured summary |
| Stack question | Ask user: language + framework | Stack confirmed |
| Output question | Ask user: Option 1 or Option 2 | Mode confirmed |
| **Option 1 only** | | |
| Phase 1 — Recon | `scripts/recon.js` | `recon/` directory |
| Phase 2 — Foundation | scaffold + globals | `src/styles/`, `public/assets/` |
| Phase 3 — Specs | per-component docs | `docs/components/*.md` |
| Phase 4 — Build | `agents/builder.md` | `src/components/*` |
| Phase 5 — QA | `scripts/visual-diff.js` | `qa/diff-report.html` |
| **Option 2 only** | | |
| Prompt generation | Write implementation prompt | `docs/implementation-prompt.md` |

For phase-specific commands and schemas → `references/phases.md`
For project scaffolds by output format → `references/scaffolds.md`
For builder agent prompt template → `agents/builder.md`
