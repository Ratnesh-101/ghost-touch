# Lane t1-share-codec (agy)
Read `docs/briefs/guide-share-contract.md` (Global rules + Share contract) and AGENTS.md first.
Goal: the share codec, client-side validator and QR helper.
Allowed files: `frontend/src/share/**` (new: `index.ts`, `codec.ts`, `validate.ts`, `qr.ts`, `limits.ts`), `frontend/tests/share.*.test.ts`, `frontend/tests/share.*.prop.test.ts` (new files), `docs/reports/agy-t1-share-codec-report.md`, `docs/BUILD_LOG.md`.
Forbidden: `frontend/src/core/**` (import only), `.kiro/**`, `.env*`, `package.json` (deps are already installed; if `lz-string` or `qrcode` is not resolvable, STOP and say so in the report).
Requirements: exactly the contract interface. `decodeShare` must be total: it throws only `ShareError`, never another exception, for ANY string input.
Acceptance tests:
- Round trip property (>=200 runs): valid scenes (use the fixtures in `frontend/public/samples/` plus generated ones) encode then decode to an equal scene.
- Hostile inputs, one test each: empty string; `#s=`; garbage; truncated payload; wrong version (v:2); missing scene; oversized hash (> maxHashChars, must be rejected BEFORE any decompress call: spy on lz-string); zip bomb (small payload expanding beyond maxDecompressedChars => 'too-large'); label containing `<script>alert(1)</script>` (kept as inert text, length-capped); 10,000-char label (capped); control characters stripped; scene with coordinates 5.0 (rejected 'bad-scene'); dangling segment (dropped); valid-but-huge scene (>300 points => rejected); prototype pollution key `__proto__` in JSON (no pollution).
- Property: for arbitrary strings decodeShare never throws a non-ShareError.
- `qrDataUrl` returns a `data:image/` URL for a short URL and null for > qrMaxUrlChars.
- No React / window / document in `share/` except `qr.ts` which may only use the qrcode library's data-URL API.
Done when frontend tests + tsc pass; real results in the report.
