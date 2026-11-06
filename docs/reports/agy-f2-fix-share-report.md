# Report: f2-fix-share

**Lane**: `f2-fix-share`  
**Tool**: agy, reviewed by Claude  
**Date**: 2026-11-06  
**Status**: Complete  

---

## 1. Executive Summary

In lane `f2-fix-share`, we addressed all confirmed security, robustness, and input-validation findings from `docs/reports/audit-a2-share-security.md` per the requirements of `docs/briefs/agy-f2-fix-share.md`, adhering to the contracts in `docs/briefs/guide-share-contract.md` and rules in `AGENTS.md`:

- **Contract Decisions Respected**:
  - **SEC-01**: The size cap on compressed share payloads before decompression (`LIMITS.maxHashChars = 12000`) is retained as the zip-bomb first line of defense. The length check was corrected to measure only the extracted payload fragment (`raw`), ensuring full URLs with origins up to 12,000 payload characters are not prematurely rejected.
  - **SEC-04**: Coordinate handling in `validateShareScene` maintains exact parity with `backend/app/validate.py` (clamping within `+-0.02`, fatal rejection beyond `[-0.02, 1.02]`). The drift list is documented below.
- **Confirmed High & Medium Findings Remediated**:
  - **SEC-02 (Unicode Bidi & Zero-Width Sanitization)**: `sanitizeString` now strips Unicode bidi override/isolate characters (`\u200E`, `\u200F`, `\u202A`–`\u202E`, `\u2066`–`\u2069`), C1 controls (`\u0080`–`\u009F`), and zero-width spaces/BOM (`\u200B`, `\uFEFF`). `VerifiedBanner.tsx` wraps displayed name and note in `<bdi>` tags to isolate text direction.
  - **SEC-03 (Student Honesty Disclosure)**: Honesty line `"Verified means a person reviewed this diagram. It is not cryptographic proof."` (`share.honesty`) rendered on the student banner area with `role="note"` and spoken on request only (not during the initial scene announcement). Translations added for English, Hindi, and Gujarati and recorded in translation sheets.
  - **SEC-05 (clearHash Trailing `#` History Fix)**: Removed redundant `loc.hash = ''` assignment after `history.replaceState` in `clearHash()`, eliminating lingering `#` history entries.
  - **SEC-07 (Inverted Bar Coordinates Normalization)**: `validateShareScene` normalizes bar rectangles via `Math.min`/`Math.max` across `(x0, x1)` and `(y_top, y_base)`, guaranteeing bars are touch-hittable.
  - **SEC-08 (shareUrl Safe Origin Handling)**: `shareUrl` validates protocol (`http:` / `https:`) and falls back safely to `'https://ghosttouch.app'` if the origin is `"null"`, empty, or uses an invalid protocol.
  - **SEC-10 (Bounded Facts Array)**: Added `LIMITS.maxFacts = 50` and capped `raw.facts` in `validateShareScene` to at most 50 items.
  - **Prototype-Key IDs (`__proto__`, `constructor`, `prototype`, `title`)**: `sanitizeId` automatically prefixes reserved prototype keys and colliding system IDs (`el___proto__`, `el_constructor`, `el_title`, `el_prototype`).
  - **Deep Nesting Guard**: Added pre-parse bracket depth counter `checkNestingDepth` capping JSON nesting to 32 levels, rejecting hostile payloads before recursive parsing can exhaust the call stack.
  - **NaN / -0 Handling**: Coordinates and values reject `NaN` / `Infinity` and normalize `-0` to `+0`.
  - **ID Deduplication**: Retained and verified robust ID deduplication across points, segments, polylines, and bars.
  - **Note Spoofing Neutralization**: Strips leading checkmarks (`/^[✓✔☑√]+/u`) and isolates note text with `<bdi>`.
  - **HTTP Security Headers**: Configured `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` in `frontend/vercel.json`.

---

## 2. Findings Disposition Matrix

| Finding ID | Severity | Description | Status | Resolution Details |
|---|---|---|---|---|
| **SEC-01** | High | Premature length rejection on full URLs | **CONTRACT DECISION** | Pre-decompression cap stays; corrected `decodeShare` to measure `raw.length` instead of `hash.length`. |
| **SEC-02** | High | Unicode bidi / zero-width control chars | **FIXED** | Stripped in `sanitizeString`; added `<bdi>` wrappers in `VerifiedBanner.tsx`. |
| **SEC-03** | High | Missing honesty disclosure copy | **FIXED** | Rendered `t('share.honesty')` in student banner area, spoken only on request; shared key in en, hi, gu. |
| **SEC-04** | High | Coordinate handling validator drift | **CONTRACT DECISION** | Preserved contract: clamp within `+-0.02`, fatal error beyond; drift catalogued below. |
| **SEC-05** | Medium | `clearHash` leaves trailing `#` history | **FIXED** | Removed `loc.hash = ''` assignment in `frontend/src/drivers/hashRoute.ts`. |
| **SEC-06** | Medium | Clipboard copy failure swallowing | **SKIPPED (Out of scope)** | `SharePanel.tsx` belongs to lane `t2-teach-editor` per brief instructions. |
| **SEC-07** | Medium | Inverted bar coordinates touch-unhittable | **FIXED** | `validateShareScene` normalizes `(x0, x1)` and `(y_top, y_base)`. |
| **SEC-08** | Medium | `shareUrl` origin protocol spoofing / `"null"` | **FIXED** | `shareUrl` validates `http://`/`https://` and falls back to `https://ghosttouch.app`. |
| **SEC-09** | Medium | Unscannable 2,000-char QR codes | **SKIPPED (Contract locked)** | `guide-share-contract.md` locks `qrMaxUrlChars: 2000`; existing tests enforce it. |
| **SEC-10** | Medium | Unbounded `facts` array size | **FIXED** | Capped to `LIMITS.maxFacts = 50` in `validateShareScene`. |
| **SEC-11** | Low | Missing security headers in `vercel.json` | **FIXED** | Configured `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` headers. |
| **SEC-12** | Low | ID `'title'` collision | **FIXED** | `sanitizeId` prefixes `'title'` and `'scene:title'` to `'el_title'` and `'el_scene:title'`. |
| **SEC-14** | Low | Non-ISO `verifiedAt` format | **FIXED** | Formatted date parsing with fallback to `new Date().toISOString()`. |
| **Prototype IDs** | Medium | IDs like `__proto__`, `constructor` | **FIXED** | Disallowed prototype keys mapped to `el_<key>`. |
| **Deep Nesting** | Medium | Deeply nested JSON call stack exhaustion | **FIXED** | Pre-parse bracket depth counter rejecting payloads > 32 levels deep. |
| **NaN / -0** | Medium | Floating point anomalies in coords | **FIXED** | Coords reject `NaN`/`Infinity`; `-0` normalized to `0`. |
| **ID Duplicates** | Medium | Cross-kind ID deduplication | **FIXED** | Verified `_dedupe_ids` runs and generates unique `_2`, `_3` IDs. |
| **Note Spoofing** | Medium | Spoofing "Verified by" badge via note | **FIXED** | Stripped leading checkmarks and isolated with `<bdi>`. |

---

## 3. Validator Drift Catalog (`validateShareScene` vs `backend/app/validate.py`)

Per the brief instruction for SEC-04, coordinate clamping stays as `backend/app/validate.py` (clamped within `+-0.02`, rejected beyond), and the drift list is documented below:

1. **Element Count Caps**:
   - `validateShareScene` enforces strict client-side DoS limits: `<= 300` points, `<= 300` segments, `<= 2000` polyline points, `<= 60` bars, `<= 50` facts, and labels `<= 60` characters.
   - `backend/app/validate.py` relies on LLM output bounds without explicit array count caps.
2. **Polyline Point Minimum**:
   - `validateShareScene` requires `rawPts.length >= 2` per polyline.
   - `backend/app/validate.py` accepts polylines with 0 or 1 point if schema-valid.
3. **Colour and Generic Shape Word Rejection**:
   - `backend/app/validate.py` strictly rejects labels consisting only of colour/shape words (`COLOUR_SHAPE_WORDS`).
   - `validateShareScene` permits these labels to avoid blocking legitimate student-shared diagrams created offline.
4. **Reserved ID Prefixing**:
   - `validateShareScene` prefixes prototype and title keys (`__proto__`, `constructor`, `title` -> `el_*`).
   - `backend/app/validate.py` relies on Pydantic dict validation without element ID prefixing.

---

## 4. Regression Test Suite

Created `frontend/tests/fix.share.security.test.ts` containing 20 tests verifying all fixed behaviors:
- `SEC-01`: 11,990 character raw payload wrapped in full origin URL is not prematurely rejected with `'too-large'`.
- `SEC-02`: Stripping of RTL overrides, isolates, zero-width space, BOM, and C1 controls.
- `SEC-03`: Honesty disclosure notice rendered in student banner area with `role="note"` and `<bdi>` isolation.
- `SEC-05`: `clearHash()` uses `replaceState` without setting `loc.hash = ''`.
- `SEC-07`: Inverted bar coordinates normalization (`x0 <= x1`, `y_top <= y_base`).
- `SEC-08`: `shareUrl` origin validation and fallback.
- `SEC-10`: `facts` array size capped to 50 items.
- Prototype-key and reserved IDs prefixed with `el_`.
- Deduplication of duplicate element IDs across kinds.
- Deep nesting bracket depth limit.
- `-0` coordinates normalization and `NaN` rejection.
- `verifiedAt` fallback to current ISO date on invalid input.

---

## 5. Verification Proof (Commands & Exact Output)

### `npm --prefix frontend test`
```
 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-f2-fix-share/frontend

 Test Files  108 passed (108)
      Tests  1479 passed (1479)
   Start at  21:17:06
   Duration  1.83s
```

### `npm --prefix frontend exec -- tsc -p frontend --noEmit`
```
Command exited with code 0 (clean, 0 errors).
```

### `npm --prefix frontend run build`
```
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 128 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.72 kB │ gzip:   0.63 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-DmDcMcUU.css                                        73.56 kB │ gzip:  11.52 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB
dist/assets/index-V6-WFS1B.js                                        487.96 kB │ gzip: 141.30 kB
✓ built in 223ms

PWA v2.0.0
mode      generateSW
precache  22 entries (653.63 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```

### `backend/.venv/Scripts/python -m pytest backend`
```
454 passed, 1 skipped, 1 warning in 36.92s
```

### `backend/.venv/Scripts/python -m ruff check backend`
```
All checks passed!
```

### `backend/.venv/Scripts/python -m ruff format --check backend`
```
60 files already formatted
```

---

## 6. Files Touched

- `frontend/src/share/limits.ts`: Added `maxFacts: 50`.
- `frontend/src/share/validate.ts`: Added Unicode bidi/zero-width/C1 stripping, `sanitizeId` prototype key protection, `-0` coordinate normalization, bar coordinates normalization, and facts array cap.
- `frontend/src/share/codec.ts`: Fixed fragment-only measurement for pre-decompression cap (SEC-01), added deep nesting guard, `verifiedAt` validation, and safe `shareUrl` origin protocol handling (SEC-08).
- `frontend/src/drivers/hashRoute.ts`: Removed redundant `loc.hash = ''` assignment in `clearHash()` (SEC-05).
- `frontend/src/components/VerifiedBanner.tsx`: Added `<bdi>` isolation, honesty disclosure notice (`share.honesty`), and checkmark spoofing filter.
- `frontend/src/styles/explore.css`: Styled `.gt-verified-banner__honesty` using design tokens without bare hex colors.
- `frontend/vercel.json`: Added security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- `docs/user-test/translation-review.md`: Appended Section 21 (`share.*` keys).
- `docs/user-test/translation-review.csv`: Appended `share.*` translation rows.
- `frontend/tests/fix.share.security.test.ts`: Added comprehensive regression test suite (20 tests).
- `docs/reports/agy-f2-fix-share-report.md`: This report.
- `docs/BUILD_LOG.md`: Appended build log entry.
