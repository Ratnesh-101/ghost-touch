# Round-3 re-audit: CSP and security headers (Claude Sonnet subagent, read-only, 2026-11-08)
Scope: `frontend/vercel.json`, `frontend/vite.config.ts` preview headers, `backend/app/middleware.py`. The agent ran `npm run build` and read `dist/index.html`. **Verdict: the CSP will not break the app and has no wildcard hole.** Not re-verified by the supervisor except F1 (confirmed: README says the live API is `ghost-touch-api.onrender.com`, `render.yaml:5` names the service `ghost-touch-backend`).

Built page: one external module script, `/registerSW.js`, a manifest link; no inline script, no inline `<style>`, no modulepreload. Fonts self-hosted woff2; images are `blob:` (photo) and `data:` (QR, JPEG thumbnail); the PDF worker is a same-origin hashed asset; only fetch target is `VITE_API_URL`; speech goes through browser services (not governed by CSP).

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | MED CONFIRMED (fragile, not currently broken) | `vercel.json:24` `connect-src` allows only `https://ghost-touch-api.onrender.com`; `render.yaml:5` and `docs/DEPLOY.md:67,87` say `ghost-touch-backend`. A redeploy per DEPLOY.md or any rename makes every `/scene`, `/ask`, `/validate` call fail as a generic network error (samples still work offline). | Rename the service to `ghost-touch-api` in `render.yaml` and DEPLOY.md; add a test that fails when `VITE_API_URL`'s origin is not in `connect-src`. |
| F2 | REFUTED | No `https:` wildcard in `connect-src`; it is `'self'` plus one host. | none |
| F3 | LOW SUSPECTED | pdfjs-dist ^6 may need `'wasm-unsafe-eval'` for JPX/colour decoding in the worker; plain text PDFs fine. | Test an image-heavy PDF against `vite preview`; add the keyword only if it fails. |
| F4 | LOW CONFIRMED | `worker-src`/`media-src` allow `blob:`/`data:` more than needed; `style-src 'unsafe-inline'` is required by React `style={{}}` (LabSettings.tsx, Explore.tsx:1227). | optional tighten |
| F5 | LOW | No `upgrade-insecure-requests`; HSTS `max-age=63072000; includeSubDomains`, no preload: safe on `*.vercel.app`. | none |
| F6 | LOW | COOP/COEP absent: fine (COEP would break the cross-origin API fetch). | optional `Cross-Origin-Opener-Policy: same-origin` |
| F7 | LOW | `npm run dev` sends no CSP; only `vite preview` mirrors the headers, so regressions show up only when previewed. | note in DEPLOY.md |

Sound: `script-src 'self'` matches the built HTML (real XSS barrier); `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY` consistent; `manifest-src 'self'`; `sw.js` served `no-cache, no-store, must-revalidate` and excluded from the SPA rewrite, `workbox-*.js` hashed; Permissions-Policy `camera=(self), microphone=(self)` fits `capture="environment"` and `webkitSpeechRecognition`; API CSP `default-src 'none'; frame-ancestors 'none'` with `/docs` `/redoc` `/openapi.json` exempt (disabled in production, `main.py:412`).
