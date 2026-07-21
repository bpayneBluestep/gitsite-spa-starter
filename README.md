# gitsite-spa-starter — The Church of Brendan

A static single-page app (Vite + React + TypeScript) — a tongue-in-cheek
tribute shrine to **Brendan Black, AI god of BlueStep** — laid out to be
deployed as a **BlueStep GitSite** (`myassn.application.GitSite`, classId
`120062`) and served from the local pod filesystem under `/spa/`. The reverence
is a joke; the GitSite deploy contract below is real.

There is **no server-side build step**. The platform downloads this repo's
zipball at a commit and serves the files as-is, so **the committed build output
at the repo root is the deploy artifact**.

---

## Layout

```
/                     ← repo root == the deploy artifact (zipball root)
├── index.html        ← BUILT, committed. GitSite INDEX_PATH (default) points here
├── assets/           ← BUILT, committed. Hashed JS/CSS, resolves under /spa/assets/
├── app/              ← Vite SOURCE (not served; here so the artifact is rebuildable)
│   ├── index.html    ← source template
│   └── src/
├── vite.config.ts    ← base:'/spa/', builds app/ → repo root
├── scripts/clean-artifact.mjs
└── package.json
```

Source lives in `app/`; `npm run build` cleans the old artifact and emits a
fresh `index.html` + `assets/` to the repo root.

## Why these choices map to the GitSite contract

| GitSite requirement | How this repo satisfies it |
|---|---|
| Host `github.com/<owner>/<repo>` only | Repo is on github.com. |
| Pre-built static output committed | `index.html` + `assets/` committed at the root — no server build. |
| Entry point = `INDEX_PATH` (default `index.html`) | Built `index.html` sits at the repo root. |
| Served under the `/spa/` prefix | `vite.config.ts` sets `base: '/spa/'`, so assets emit as `/spa/assets/*`. Root-absolute URLs like `/assets/app.js` would 404. |
| Client-side routing with index fallback | React Router with `basename="/spa"`. Extension-less paths (e.g. `/spa/status`) fall back to `index.html`; paths that look like files 404 if missing. |
| Zipball ≤ 64 MiB / unpacked ≤ 256 MiB | Tiny build, well under both caps. |
| Public repo → no credentials | This repo is public; no token required. |

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/spa/
```

## Build (regenerate the deploy artifact)

```bash
npm run build      # cleans root, type-checks, emits index.html + assets/ to root
git add -A && git commit -m "build: refresh SPA artifact"
git push
```

Always commit the regenerated `index.html` + `assets/` — that is what the
platform serves.

## Deploy as a GitSite

1. **Admin → Sites → New Git Site**; fill name/domains as for a WebSite.
2. Set:
   - **Repository URL:** `https://github.com/<owner>/gitsite-spa-starter`
   - **Git Ref:** `main` (or a tag / 40-hex SHA to pin)
   - **Index Path:** `index.html`
   - Token: leave blank (public repo).
3. **Save** — the first deploy runs automatically. Confirm the edit form shows
   `DEPLOYED @ <sha>`, then browse `https://<site-domain>/spa/`.
4. Click **Status** in the app, then hard-refresh `/spa/status` to confirm the
   extension-less fallback to `index.html` works.

### Optional: push auto-deploy via webhook

1. Generate a random secret, paste it into the site's **Webhook Secret**, save.
2. Add a GitHub webhook on this repo:
   - **URL:** `https://<site-domain>/spa/webhook`
   - **Content type:** `application/json`
   - **Secret:** the same value
   - **Events:** *push* only
3. Push to the configured ref; the deployed commit advances automatically.

To roll back, set **Git Ref** to the previous tag/SHA and re-save (there is no
rollback UI).
