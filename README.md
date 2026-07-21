# configec-crm-gitsite

The **ConfigEC Consultant CRM** single-page app, packaged to deploy as a
**BlueStep GitSite** (`myassn.application.GitSite`, classId `120062`) and served
from the pod filesystem under `/spa/`.

This app was previously hosted as a BlueStep **merge report** (its front end
lived in the report's `static/`). It has been lifted out to this GitHub repo so
GitSite serves the front end instead — the platform still serves the backend
(`/b/maestro`, `/getNavTree`, PDF Lab) that the app calls.

## Architecture

- **Global-script SPA** — plain TypeScript files at the repo root, each a
  global-scope script (no ES modules). They share one global scope and are
  loaded in dependency order by `index.html` (`main.js` last).
- **Compiled by `tsc`** to `.build/*.js` — no bundler.
- **Hash-routed** — `#/clients` (default), `#/programs`, `#/dashboard`,
  `#/settings`, `#/builder`, `#/email`, `#/pdflab`, … Client-side only.
- **Same-origin backend** — `api.ts` talks to `/b/maestro`; `chrome.ts` calls
  `/getNavTree`. These are root-absolute and ride the BlueStep session cookie of
  the serving domain, so they keep working when served from a BlueStep tenant
  domain (the GitSite host) — no URL changes needed.

## Layout

```
/                       ← repo root == the served web root (and deploy artifact)
├── index.html          ← full document; <base href="/spa/"> + ordered <script> tags
├── tokens.css styles.css chatbot.css appbuilder.css   ← styles (served)
├── *.ts                ← SPA source (global scripts) — api, views, chrome, main, …
├── .build/*.js         ← compiled output (BUILT, committed — this is what runs)
├── tsconfig.json
└── scripts/clean-artifact.mjs
```

## Why it serves correctly under `/spa/`

| GitSite requirement | How this repo satisfies it |
|---|---|
| Pre-built static output committed | `.build/*.js` + `index.html` + `*.css` committed at the root. |
| Entry point = `INDEX_PATH` (default `index.html`) | full-document `index.html` at the root. |
| Served under `/spa/` | `<base href="/spa/">` resolves every relative asset under `/spa/`. |
| Client-side routing | Hash routing — no server route fallback needed. |
| Public/private | Set per the site config; backend calls need the user's BlueStep session on the serving domain. |

## Build

```bash
npm install          # first time (installs TypeScript)
npm run build        # cleans .build, compiles *.ts → .build/*.js
git add -A && git commit -m "build: recompile SPA" && git push
```

Always commit the regenerated `.build/*.js` — that is what the platform serves.

## Deploy as a GitSite

Admin → Sites → **New Git Site** → Repository URL of this repo, Git Ref `main`,
Index Path `index.html`. Save; the first deploy runs automatically. Then browse
`https://<site-domain>/spa/`. Pushes to `main` auto-deploy via the configured
push webhook.

> Local `npm run` preview shows the shell but not live data — `/b/maestro` and
> the session cookie only exist on the BlueStep serving domain. Verify data on
> the deployed GitSite while logged in.
