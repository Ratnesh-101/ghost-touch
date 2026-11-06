# Lane t1-share-codec & t1-fix Report

- **Lane:** t1-share-codec (with follow-up t1-fix)
- **Tool:** Antigravity (agy, reviewed by Claude Code)
- **Status:** Complete (all tests passing, clean build, clean tsc)
- **Date:** 2026-11-06

## 1. Executive Summary

Implemented the share codec, offline client-side diagram validator, and QR code helper per `docs/briefs/guide-share-contract.md` (§ Share contract), `docs/briefs/agy-t1-share-codec.md`, and follow-up `docs/briefs/agy-t1-fix.md`.

All modules in `frontend/src/share/` are pure (no DOM/React dependencies) except `qr.ts`, which uses solely the `qrcode` library's `toDataURL` API. Added `frontend/src/share/qrcode.d.ts` providing typed signatures with zero `any` types, avoiding transitive `@types/node` pollution. Replaced `node:fs` and `node:path` usages in tests with the repo standard `@ts-expect-error` pattern and `new URL(..., import.meta.url)` / JSON module imports.

Expanded test coverage across four dedicated test suites (`share.contract.test.ts`, `share.hostile.test.ts`, `share.decode.prop.test.ts`, and `share.roundtrip.prop.test.ts`), covering every acceptance test individually and property-based verification (200 round-trip runs and 300 decode totality runs).

## 2. Deliverables Built

### Production Modules (`frontend/src/share/`)
- `limits.ts`: `SHARE_VERSION` (1) and `LIMITS` (`maxHashChars`: 12000, `maxDecompressedChars`: 200000, `maxName`: 60, `maxNote`: 280, `maxLabel`: 60, `qrMaxUrlChars`: 2000, `maxPoints`: 300, `maxSegments`: 300, `maxPolylinePoints`: 2000, `maxBars`: 60).
- `validate.ts`: `validateShareScene` and `sanitizeString`.
  - Offline client-side implementation of `backend/app/validate.py` repair rules (+/-0.02 coordinate tolerance clamping, dangling segment removal, ID de-duplication) and `frontend/src/core/correct.ts` `validateSceneInvariants`.
  - Rejection of out-of-tolerance coordinates (e.g. 5.0) and empty drawable scenes.
  - Truncation / capping of labels to `maxLabel` (60) while keeping HTML tags as inert text (e.g. `<script>alert(1)</script>`).
  - Unknown extra object keys dropped on output `DiagramScene`.
- `codec.ts`:
  - `ShareError` and `ShareErrorCode` ('too-large' | 'bad-format' | 'bad-version' | 'bad-scene' | 'empty').
  - `encodeShare`: compresses valid scenes with metadata via `LZString.compressToEncodedURIComponent`.
  - `shareUrl`: constructs canonical origin URL with `#s=` anchor.
  - `decodeShare`: total function rejecting oversized hashes before decompression, zip bombs after decompression, prototype pollution (`__proto__`, `constructor`, `prototype`), unsupported versions, missing scenes, and hostile payloads.
- `qr.ts`: `qrDataUrl` generating base64 PNG data URLs for strings <= 2000 chars, returning `null` when exceeding limit or on invalid input.
- `qrcode.d.ts`: minimal module declaration for `'qrcode'` covering `toDataURL` with typed options (`margin`, `errorCorrectionLevel`, `width`, `scale`), containing zero `any` types.
- `index.ts`: entry point cleanly exporting all contracts.

### Test Suites (`frontend/tests/`)
- `share.contract.test.ts`: Unit tests covering `shareUrl` formatting, `encodeShare` size checks, `qrDataUrl` limits, and pure architecture constraint (no React, window, or document in pure share modules).
- `share.hostile.test.ts`: Dedicated test suite containing one test each for the mandatory 16 acceptance items:
  1. Empty string -> `ShareError('empty')`
  2. `#s=` -> `ShareError('empty')`
  3. Garbage string -> `ShareError('bad-format')`
  4. Truncated payload -> `ShareError('bad-format')`
  5. Wrong version (v:2) -> `ShareError('bad-version')`
  6. Missing scene -> `ShareError('bad-scene')`
  7. Oversized hash (> maxHashChars) -> rejected BEFORE decompress (verified by spying on `LZString.decompressFromEncodedURIComponent`)
  8. Zip bomb (> maxDecompressedChars) -> `ShareError('too-large')`
  9. `<script>alert(1)</script>` label -> preserved as inert plain text, length-capped
  10. 10,000-char label -> capped to `maxLabel` (60)
  11. Control characters -> stripped from labels, name, note
  12. Coordinates 5.0 -> rejected with `ShareError('bad-scene')`
  13. Dangling segment -> dropped while valid segments remain
  14. Valid-but-huge scene (>300 points) -> rejected with `ShareError('bad-scene')`
  15. Prototype pollution key `__proto__` in JSON -> does not pollute `Object.prototype`
  16. `qrDataUrl` -> data URL for short and null for long (> qrMaxUrlChars)
- `share.decode.prop.test.ts`: Property-based test suite (300 runs via `fast-check`):
  - Property: `decodeShare` throws only `ShareError` with recognized `ShareErrorCode` for arbitrary hostile strings (unicode, base64, URL prefixes, malformed JSON, truncated tokens).
- `share.roundtrip.prop.test.ts`: Property-based test suite using `fast-check`:
  - Sample fixtures round-trip cleanly (`triangle.json`, `sine.json`, `barchart.json` imported directly via Vite JSON modules).
  - Round trip property (200 runs on random valid scenes): encode then decode yields equal scenes.

## 3. Acceptance Tests Checklist

| Acceptance Requirement | Status | Verification Detail |
|---|---|---|
| Round trip property (>=200 runs) | PASS | 200 runs of random scenes + 3 sample fixtures in `share.roundtrip.prop.test.ts` |
| Hostile 1: empty string | PASS | Throws `ShareError('empty')` in `share.hostile.test.ts` |
| Hostile 2: `#s=` | PASS | Throws `ShareError('empty')` in `share.hostile.test.ts` |
| Hostile 3: garbage | PASS | Throws `ShareError('bad-format')` in `share.hostile.test.ts` |
| Hostile 4: truncated payload | PASS | Throws `ShareError('bad-format')` in `share.hostile.test.ts` |
| Hostile 5: wrong version (v:2) | PASS | Throws `ShareError('bad-version')` in `share.hostile.test.ts` |
| Hostile 6: missing scene | PASS | Throws `ShareError('bad-scene')` in `share.hostile.test.ts` |
| Hostile 7: oversized hash (> maxHashChars) | PASS | Rejected BEFORE `LZString` decompress call (verified via spy) |
| Hostile 8: zip bomb (> maxDecompressedChars) | PASS | Throws `ShareError('too-large')` in `share.hostile.test.ts` |
| Hostile 9: `<script>alert(1)</script>` | PASS | Kept as inert text, length-capped in `share.hostile.test.ts` |
| Hostile 10: 10,000-char label | PASS | Truncated to `maxLabel` (60) in `share.hostile.test.ts` |
| Hostile 11: control characters | PASS | Stripped from strings in `share.hostile.test.ts` |
| Hostile 12: coordinates 5.0 | PASS | Rejected with `ShareError('bad-scene')` in `share.hostile.test.ts` |
| Hostile 13: dangling segment | PASS | Dropped, valid segments preserved in `share.hostile.test.ts` |
| Hostile 14: valid-but-huge scene (>300 points) | PASS | Rejected with `ShareError('bad-scene')` in `share.hostile.test.ts` |
| Hostile 15: prototype pollution `__proto__` | PASS | `Object.prototype` remains unpolluted in `share.hostile.test.ts` |
| Totality property: arbitrary strings | PASS | 300 runs in `share.decode.prop.test.ts`, throws only `ShareError` |
| `qrDataUrl` data:image/ for short URL | PASS | Returns `data:image/png;base64,...` |
| `qrDataUrl` null for > qrMaxUrlChars | PASS | Returns `null` |
| Pure architecture in `share/` | PASS | Zero React / window / document references (verified in `share.contract.test.ts`) |

## 4. Real Command Proof

### `npm --prefix frontend test`
```text
> ghost-touch-frontend@0.1.0 test
> vitest run

 RUN  v5.1.0 C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-t1-share-codec/frontend

 Test Files  86 passed (86)
      Tests  1242 passed (1242)
   Start at  15:12:27
   Duration  1.32s (transform 54%, import 24%, tests 18%, worker 5%)
```

### `npm --prefix frontend exec -- tsc -p frontend --noEmit`
```text
(exited with code 0, zero errors across entire codebase)
```

### `npm --prefix frontend run build`
```text
> ghost-touch-frontend@0.1.0 build
> tsc --noEmit && vite build

vite v8.3.5 building client environment for production...
transforming...
✓ 77 modules transformed.
rendering chunks...
computing gzip size...
dist/registerSW.js                                                     0.13 kB
dist/manifest.webmanifest                                              0.49 kB
dist/index.html                                                        1.72 kB │ gzip:   0.63 kB
dist/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2     17.20 kB
dist/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2     17.52 kB
dist/assets/pdf.worker.min-CjEcRF4W.mjs                            1,264.34 kB
dist/assets/index-BTsYWoe7.css                                        63.84 kB │ gzip:  10.00 kB
dist/assets/index-D82y0G5D.js                                        372.67 kB │ gzip: 109.67 kB
dist/assets/pdf-ULJPBbF3.js                                          430.16 kB │ gzip: 129.27 kB

✓ built in 160ms

PWA v2.0.0
mode      generateSW
precache  22 entries (531.54 KiB)
files generated
  dist/sw.js
  dist/workbox-835c8c05.js
```

### `git status --short`
```text
 M docs/BUILD_LOG.md
?? docs/briefs/agy-t1-fix.md
?? docs/reports/agy-t1-share-codec-report.md
?? frontend/src/share/
?? frontend/tests/share.contract.test.ts
?? frontend/tests/share.decode.prop.test.ts
?? frontend/tests/share.hostile.test.ts
?? frontend/tests/share.roundtrip.prop.test.ts
```

## 5. Files Touched
- `frontend/src/share/limits.ts` (new)
- `frontend/src/share/validate.ts` (new)
- `frontend/src/share/codec.ts` (new)
- `frontend/src/share/qr.ts` (new)
- `frontend/src/share/qrcode.d.ts` (new)
- `frontend/src/share/index.ts` (new)
- `frontend/tests/share.contract.test.ts` (new)
- `frontend/tests/share.hostile.test.ts` (new)
- `frontend/tests/share.decode.prop.test.ts` (new)
- `frontend/tests/share.roundtrip.prop.test.ts` (new)
- `docs/reports/agy-t1-share-codec-report.md` (updated)
- `docs/BUILD_LOG.md` (updated)
