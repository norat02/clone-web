# Project scaffolds — /clone-web

Choose the scaffold matching the user's chosen output format. Run the init command,
then copy globals.css and reset.css into the correct path.

> **Platform note:** All scaffolds work on every supported agent (Claude Code, Google AI
> Studio, Replit AI, Gemini CLI, Cursor, Windsurf, Cline, etc.). On Replit AI, the project
> root is already a directory — skip `mkdir` and run the init command directly. On Google
> AI Studio, run scaffold commands in your local terminal, not in the AI Studio interface.

---

## Plain HTML

```bash
mkdir -p [project]/src/styles [project]/src/components [project]/public/assets [project]/docs/components [project]/recon [project]/qa
cd [project]
git init
```

File layout:
```
index.html              ← assembled page (Phase 5 output)
src/styles/globals.css
src/styles/reset.css
src/components/         ← .html partials or inline <section> blocks
public/assets/
```

Component format: self-contained `<section>` blocks with scoped `<style>` tags.
Assembly: copy section HTML into `index.html` in order.

---

## Next.js (App Router)

```bash
npx create-next-app@latest [project] --typescript --tailwind=false --eslint=false --app --src-dir --import-alias "@/*"
cd [project]
```

File layout:
```
src/app/page.tsx        ← assembled page
src/app/globals.css     ← maps to globals.css from Phase 2
src/components/         ← .tsx files, one per section
public/assets/
```

globals.css goes in `src/app/globals.css`. Import it in `src/app/layout.tsx`.
Each component exports a default React functional component.

---

## React + Vite

```bash
npm create vite@latest [project] -- --template react-ts
cd [project] && npm install
```

File layout:
```
src/App.tsx             ← assembled page
src/styles/globals.css
src/styles/reset.css
src/components/         ← .tsx files
public/assets/
```

Import both CSS files at the top of `src/main.tsx`.

---

## Vue 3

```bash
npm create vue@latest [project]
# Select: TypeScript yes, Vue Router no (unless multi-page), Pinia no
cd [project] && npm install
```

File layout:
```
src/App.vue             ← assembled page
src/styles/globals.css
src/styles/reset.css
src/components/         ← .vue SFCs
public/assets/
```

Import globals in `src/main.ts`: `import './styles/globals.css'`

---

## Astro

```bash
npm create astro@latest [project] -- --template minimal --typescript strict --no-install
cd [project] && npm install
```

File layout:
```
src/pages/index.astro   ← assembled page
src/styles/globals.css
src/styles/reset.css
src/components/         ← .astro files
public/assets/
```

Import globals in `src/layouts/Layout.astro` via `<link rel="stylesheet">`.

---

## Dependency policy

Phase 2 installs all dependencies. Builder agents in Phase 4 must not `npm install`
anything new. Allowed dependencies by format:

| Format | Allowed |
|--------|---------|
| Plain HTML | none — vanilla only |
| Next.js | next, react, react-dom only (no UI libs) |
| React + Vite | react, react-dom only |
| Vue 3 | vue only |
| Astro | astro only |

If an animation library (GSAP, Framer Motion, etc.) is detected during recon and is
essential to the site's experience, ask the user before adding it. Note it in
`recon/manual-notes.md` either way.
