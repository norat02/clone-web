# clone-web

> AI skill for cloning live websites into modern codebases — with full analysis, design system extraction, and multi-phase parallel build.

## Install

```sh
npx skills@latest add norat02/clone-web
```

Or run the installer script:

```sh
bash install.sh
```

---

## Requirements

- Node.js >= 18
- Git
- `npx` (bundled with Node.js)
- Optional: `puppeteer` or `playwright` for full recon (auto-installed by scripts)

### Supported agents

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

---

## Usage

```
/clone-web <url> [<url2> ...]
```

### Examples

```sh
# Clone a single site
/clone-web https://linear.app

# Clone multiple sites in one session
/clone-web https://linear.app https://vercel.com
```

---

## How it works

The skill runs a structured pipeline with a mandatory analysis phase before any code is written.

```
Analysis A–E   →   Stack choice   →   Output mode   →   Build (if Option 1)
```

### Phase 0 — Analysis (always runs first)

Before implementation begins, the skill:

1. **Crawls the entire site** — follows every internal link, maps the full sitemap
2. **Analyzes every accessible page** — layout, typography, color system, components, interactions, responsive behavior, forms, auth flows, loading states, error states
3. **Verifies cross-page consistency** — detects inconsistencies and design system patterns
4. **Documents what it couldn't access** — auth-gated pages, missing states, ambiguities
5. **Synthesizes a full analysis** — design philosophy, component inventory, token system, interaction model

### Stack choice

After analysis, the skill asks which language and framework to use. It does **not** pick one automatically.

### Output mode

Choose one of two modes:

**Option 1 — Complete source code**
Full implementation: all pages, components, styles, routing, config. Production-ready, not scaffolding.

**Option 2 — Implementation prompt**
A comprehensive Markdown document (`docs/implementation-prompt.md`) describing the entire site — design system, components, layouts, flows, project structure, coding standards, deployment notes. Detailed enough that another AI or developer can build it from scratch without visiting the original site.

### Build phases (Option 1 only)

| Phase | What happens |
|-------|-------------|
| 1 — Recon | `scripts/recon.js` screenshots + extracts tokens, assets, structure |
| 2 — Foundation | Scaffold project, write `globals.css`, `reset.css`, download assets |
| 3 — Specs | Write `docs/components/[name].md` per component with exact computed values |
| 4 — Build | Dispatch one builder agent per component via git worktrees (parallel) |
| 5 — QA | `scripts/visual-diff.js` pixel-diff against originals, fix until ≥ 90% |

---

## Project output structure

### Option 1

```
[project-name]/
├── src/
│   ├── styles/
│   │   ├── globals.css
│   │   └── reset.css
│   ├── components/
│   └── index.[ext]
├── public/assets/
├── docs/components/
├── recon/
│   ├── screenshots/
│   ├── tokens.json
│   ├── assets.json
│   └── structure.json
└── qa/diff-report.html
```

### Option 2

```
docs/
└── implementation-prompt.md
    ├── Design philosophy
    ├── Design system (tokens, type, color, spacing, motion)
    ├── Component library (all states + interactions)
    ├── Page specifications
    ├── Navigation & routing
    ├── Responsive implementation
    ├── Forms & user flows
    ├── Project structure
    ├── Tech stack setup
    ├── Coding standards
    ├── Implementation order
    ├── Deployment notes
    └── Open questions
```

---

## Platform-specific notes

**Replit AI** — Puppeteer requires `--no-sandbox`. Set `CLONE_WEB_NO_SANDBOX=1` in your Replit environment, or it's detected automatically via `REPL_ID`.

**Google AI Studio** — Sessions are stateless. Keep a local `clone-web-state.json` with the current phase and pending components; paste the relevant section at the start of each new session. Use Gemini 1.5 Pro or 2.0 Flash for context length.

**Gemini CLI** — Invoke phases via `gemini -p "$(cat phase-prompt.txt)"`. All scripts run locally.

---

## Ethics

This skill is intended for:
- **Platform migration** — rebuilding a site you own in a modern stack
- **Source recovery** — repo is gone, developer left, stack is legacy
- **Learning** — deconstructing production techniques

**Not intended for:** phishing, impersonation, passing off others' designs as your own, or violating a site's ToS. Always check `robots.txt` and the site's terms before proceeding.

---

## Skill structure

```
clone-web/
├── README.md
├── install.sh                      ← one-command installer
├── agents/
│   └── builder.md                  ← builder agent prompt template
├── references/
│   ├── phases.md                   ← phase commands & output schemas
│   ├── scaffolds.md                ← project scaffold templates
│   └── gemini-setup.md             ← Gemini/AI Studio/Replit setup & troubleshooting
├── scripts/
│   ├── recon.js                    ← Phase 1: screenshot + token extraction
│   ├── download-assets.js          ← Phase 2: batch asset downloader
│   ├── interaction-sweep.js        ← Phase 1: hover/scroll/click sweep
│   ├── visual-diff.js              ← Phase 5: pixel-level QA diff
│   ├── gemini.js                   ← shared Gemini API client (retry/timeout/streaming/JSON)
│   ├── analyze.js                  ← Project Analyzer — architecture overview
│   ├── debug.js                    ← Debug Assistant — root-cause diagnosis
│   ├── review.js                   ← Code Review / Refactoring Assistant — structured findings
│   └── summarize.js                ← Documentation Generator — README/docstring/summary
└── skills/
    ├── clone-web/SKILL.md          ← website cloning pipeline (this skill's entry point)
    ├── gemini-assistant/SKILL.md   ← general Gemini access, second opinions
    ├── code-review/SKILL.md        ← structured code review
    ├── debug-assistant/SKILL.md    ← error/stack-trace diagnosis
    ├── documentation-generator/SKILL.md  ← README/docstring/summary generation
    ├── refactoring-assistant/SKILL.md    ← refactor proposals (reuses review.js + gemini.js)
    └── project-analyzer/SKILL.md   ← whole-project architecture overview
```

---

## Gemini-powered skills

Alongside the website-cloning pipeline, this plugin bundles six general-purpose
skills backed by Google's Gemini API via Google AI Studio: **Gemini Assistant**,
**Code Review**, **Debug Assistant**, **Documentation Generator**,
**Refactoring Assistant**, and **Project Analyzer**. They share one client
(`scripts/gemini.js`) with configurable model selection, retry logic, request
timeouts, streaming output, and structured JSON output.

**Quick start:**

```sh
# 1. Get a key at https://aistudio.google.com, then set it:
export GEMINI_API_KEY="your-key-here"

# 2. Try it:
node scripts/gemini.js "Explain the CAP theorem in two sentences."

# 3. Use a task-specific script:
node scripts/analyze.js .                          # project overview
node scripts/review.js src/app.js --focus=security  # code review
node scripts/debug.js "TypeError: ..." src/app.js   # debug assistant
node scripts/summarize.js src/app.js --mode=readme  # documentation
```

No API key is ever hardcoded — every script reads `GEMINI_API_KEY` (or
`GOOGLE_API_KEY`) from the environment, works unmodified on Replit (via Replit
Secrets) and Claude Code (via `settings.json`'s `env` field), and requires no
`package.json` or npm install — just Node.js 18+.

Full setup instructions, all configuration variables, and a troubleshooting guide
are in **[`references/gemini-setup.md`](references/gemini-setup.md)**.

---

## License

MIT
