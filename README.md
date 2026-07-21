# configec-crm-gitsite

The **ConfigEC Consultant CRM** single-page app, packaged to deploy as a
**BlueStep GitSite** (`myassn.application.GitSite`, classId `120062`) and served
from the pod filesystem under `/spa/`.

Originally a BlueStep **merge report**; lifted to this repo so GitSite serves the
front end while the platform still serves the backend (`/b/maestro`,
`/getNavTree`, PDF Lab) the app calls.

## Architecture

- **Global-script SPA** — the app is a set of global-scope scripts (no ES
  modules) that share one scope and wire interactivity through **inline event
  handlers** (`onclick="foo()"`), so handler functions must stay global. This
  is preserved deliberately.
- **Type-checked** — `tsc --noEmit` runs over the whole `src/` as one program
  (script mode) and must pass before a build. This is real safety the merge
  report never had.
- **Bundled** — `esbuild` transpiles each `src/*.ts`, concatenates them in
  dependency order into **one content-hashed, minified** script
  (`assets/app.<hash>.js`); the four stylesheets become one hashed
  `assets/app.<hash>.css`. Identifiers are **not** renamed (inline handlers
  resolve top-level names). Hashing gives instant cache-busting under GitSite's
  `Cache-Control: max-age=300`.
- **Hash-routed** — `#/clients` (default), `#/programs`, `#/dashboard`,
  `#/settings`, `#/builder`, `#/email`, `#/pdflab`, … client-side only.
- **Same-origin backend** — `api.ts` → `/b/maestro`, `chrome.ts` →
  `/getNavTree`. Root-absolute; they ride the BlueStep session cookie of the
  serving domain, so they keep working on a BlueStep tenant domain unchanged.

## Layout

```
/
├── src/                     ← SOURCE
│   ├── *.ts                 ← global-scope SPA modules (api, views, chrome, main, …)
│   ├── *.css                ← tokens, styles, chatbot, appbuilder
│   └── index.html           ← template (__CSS__ / __JS__ placeholders)
├── index.html               ← BUILT (committed) — hashed asset refs, <base href="/spa/">
├── assets/app.<hash>.js     ← BUILT (committed) — the concatenated, minified bundle
├── assets/app.<hash>.css    ← BUILT (committed)
├── tsconfig.json            ← whole-program type-check config (noEmit)
├── scripts/build.mjs        ← typecheck-gated bundle builder
└── .github/workflows/build.yml  ← CI: typecheck + build + assert artifact fresh
```

## Build

```bash
npm install          # first time (TypeScript + esbuild)
npm run typecheck    # tsc --noEmit over src/
npm run build        # typecheck, then bundle → index.html + assets/
git add -A && git commit -m "build: rebuild SPA" && git push
```

Always commit the regenerated `index.html` + `assets/` — that is what GitSite
serves. **CI enforces this**: `.github/workflows/build.yml` fails a push if the
committed artifact isn't exactly what `npm run build` produces from `src/`
(catches type errors and stale/forgotten rebuilds).

## Deploy as a GitSite

Admin → Sites → **New Git Site** → Repository URL of this repo, Git Ref `main`,
Index Path `index.html`. Save; first deploy runs automatically. Browse
`https://<site-domain>/spa/`. Pushes to `main` auto-deploy via the push webhook.

> Local `npm run` preview shows the shell but not live data — `/b/maestro` and
> the session cookie only exist on the BlueStep serving domain. Verify data on
> the deployed GitSite while logged in.

## Future / optional

- **Pure ES modules** — a larger refactor (all 26 files + re-expose the 304
  inline-handler functions on `window`, or move to event delegation). Deferred
  until the app is click-testable against the backend; the current bundle
  already delivers type-checking, one hashed asset, and no load-order fragility.
- **Self-host the font** — currently `Cormorant Garamond` loads from Google
  Fonts (external dependency).
- **Env-config seam** — `api.ts` hardcodes `/b/maestro`; a build-time base would
  ease pointing at other environments.
