# Gemini / Google AI Studio setup

This reference covers everything needed to use the Gemini-powered skills in this
plugin: `gemini-assistant`, `code-review`, `debug-assistant`,
`documentation-generator`, `refactoring-assistant`, and `project-analyzer`. All of
them share one client, `scripts/gemini.js`, so this setup only needs to be done
once.

---

## 1. Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com).
2. Sign in with a Google account.
3. Open **Get API key** and create a new key (or reuse an existing project's key).
4. Copy the key — you won't be able to view it again after leaving the page, only
   regenerate a new one.

Treat this key like a password. It grants API usage billed to whatever project
it's attached to.

## 2. Set the key as an environment variable

**Never paste the key into a script, a skill file, or a commit.** Every script in
this plugin reads it exclusively from the environment.

### Local shell (macOS/Linux)

```sh
export GEMINI_API_KEY="your-key-here"
```

Add that line to `~/.bashrc`, `~/.zshrc`, or your shell's profile file to persist
it across terminal sessions.

### Local shell (Windows PowerShell)

```powershell
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "your-key-here", "User")
```

Open a new terminal after running this for it to take effect.

### Claude Code (`settings.json`)

Add it under the `env` key in `~/.claude/settings.json` (user-wide) or
`.claude/settings.json` (project-wide, if you want it shared via version control
— only do this for non-sensitive projects, since project settings files are
typically committed):

```json
{
  "env": {
    "GEMINI_API_KEY": "your-key-here"
  }
}
```

Claude Code injects this into the environment at startup. Prefer
`.claude/settings.local.json` (gitignored by default) over a shared
`.claude/settings.json` if the key shouldn't be checked into the repo.

### Replit

1. Open your Repl.
2. Click the **Secrets** tab (padlock icon) in the left sidebar.
3. Add a new secret named `GEMINI_API_KEY` with your key as the value.
4. Replit automatically exposes secrets as environment variables to any process
   running in the Repl — no code changes needed. `scripts/gemini.js` reads
   `process.env.GEMINI_API_KEY` the same way it would locally.

Do **not** put the key in a `.env` file that gets committed, or in `replit.nix` /
`.replit` — those are typically visible to anyone who forks the Repl.

## 3. Verify the key works

```sh
node scripts/gemini.js "Say hello in one sentence."
```

If this prints a response, setup is complete. If it fails, see
[Troubleshooting](#troubleshooting) below.

---

## Configuration reference

All configuration is via environment variables — nothing is hardcoded, and
nothing needs to be passed on the command line for normal use.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes (or `GOOGLE_API_KEY`) | — | Authenticates every request |
| `GOOGLE_API_KEY` | No | — | Fallback name, checked if `GEMINI_API_KEY` is unset |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Model used for all requests. As of mid-2026, `gemini-3.6-flash` and `gemini-3.5-flash-lite` are newer GA options — check [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) for the current lineup and set this if you want a different model |
| `GEMINI_TIMEOUT_MS` | No | `30000` | Per-request timeout before aborting |
| `GEMINI_MAX_RETRIES` | No | `3` | Retries on timeout, HTTP 429, or 5xx. Does **not** retry on 4xx errors other than 429, since those indicate a request problem that a retry won't fix |
| `GEMINI_BASE_URL` | No | `https://generativelanguage.googleapis.com/v1beta` | Override to point at a proxy or an alternate regional endpoint |

## Runtime detection

`scripts/gemini.js` detects which platform it's running on (Replit, Claude Code,
CI, or a plain local shell) purely from environment variables those platforms set
automatically, and tailors its error messages accordingly — for example, pointing
you at the Secrets tab specifically when running on Replit. This is informational
only; it does not change request behavior.

## Portable paths

Every script in this plugin resolves paths with Node's `path` module
(`path.resolve`, `path.join`, `path.relative`) rather than hardcoded separators, so
they behave the same on Linux, macOS, Windows, and Replit's containerized Linux
environment.

## Deployment compatibility

These scripts have no build step and no `package.json` dependency tree — they run
directly with `node scripts/<name>.js` anywhere Node.js 18+ is available,
including:

- A local machine with Node.js installed
- Claude Code's sandboxed execution environment
- A Replit Repl (Node.js template, or any template with Node available)
- A CI runner (GitHub Actions, etc.) with `actions/setup-node`

Node.js 18+ is required specifically because these scripts use the global
`fetch()` and `AbortController` APIs, which are built in from Node 18 onward and
need no external HTTP client library.

---

## Troubleshooting

**`[gemini] Configuration error: No Gemini API key found`**
The environment variable isn't set in the process running the script. Confirm
with `echo $GEMINI_API_KEY` (or check the Replit Secrets tab, or
`.claude/settings.json`). Remember that setting it in one terminal doesn't carry
over to a different terminal or a restarted Repl unless it's persisted per the
instructions above.

**`[gemini] API error (status 400)`**
The request was malformed — often an unsupported `GEMINI_MODEL` value. Check the
model name against Google's current list; model names occasionally change or get
deprecated.

**`[gemini] API error (status 401)` or `403`**
The API key is invalid, revoked, or lacks permission for the requested model.
Regenerate the key in Google AI Studio.

**`[gemini] API error (status 429)`**
Rate limit hit. `scripts/gemini.js` retries this automatically with exponential
backoff up to `GEMINI_MAX_RETRIES` times; if it still fails, you're sustained
above your quota — check your plan's rate limits in Google AI Studio.

**`[gemini] Gemini request timed out after 30000ms`**
The request took longer than `GEMINI_TIMEOUT_MS`. Large prompts (e.g.
`project-analyzer` on a huge directory) may need a higher timeout:
`GEMINI_TIMEOUT_MS=60000 node scripts/analyze.js .`

**Streaming output looks garbled or cuts off mid-word**
This usually means a proxy or terminal is buffering output. Try without
`--stream` first to confirm the underlying request works, then investigate the
proxy/terminal separately.

**Works locally but not on Replit**
Almost always a missing Secret — Replit does not share your local shell's
environment variables. Re-check step 2 above under "Replit".
