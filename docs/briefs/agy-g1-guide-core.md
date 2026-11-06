# Lane g1-guide-core (agy)
Read `docs/briefs/guide-share-contract.md` (Global rules + Guide contract) and AGENTS.md first.
Goal: implement the pure guide module exactly as the contract's interface.
Allowed files: `frontend/src/guide/**` (new: `index.ts`, `config.ts`, `geometry.ts`, `machine.ts`), `frontend/tests/guide.*.test.ts`, `frontend/tests/guide.*.prop.test.ts` (new files only), `docs/reports/agy-g1-guide-core-report.md`, `docs/BUILD_LOG.md`.
Forbidden: `frontend/src/core/**`, `.kiro/**`, `.env*`, drivers, screens, i18n (G2 owns strings; use i18n KEYS only, list the keys you emit in the report).
Keys to emit: `guide.hint.left|right|up|down|up-left|up-right|down-left|down-right|here`, `guide.arrived`, `guide.stopped`, `guide.start`.
Acceptance tests (vitest + fast-check, >=200 runs on properties):
- pulseIntervalMs monotone non-decreasing in dist, always within [nearMs, farMs].
- pitchFor: target above gives pitch >= target below; always within [pitchLoHz, pitchHiHz].
- panFor within [-1,1], sign matches dx.
- directionHint: dead-zone => 'here'; the 8 compass cases; y=0 is top.
- resolveTarget: unknown id => null; ids for point, segment (midpoint), polyline (nearest-to-centroid point), bar (centre) resolve; out-of-range {x,y} => null.
- guideStep: hint spoken on direction change and not more often than hintEveryMs otherwise; `arrive` emitted exactly once; `tick` after timeoutMs => stopped; cancel for each reason => toneOff + stopped; lift => toneOff, phase stays guiding; no effects after stopped/arrived. Scripted trace test: finger walks toward a target, pulse interval shrinks, arrives.
- Must not import React, window, navigator, document, or anything from drivers.
Done when: `npm --prefix frontend test`, `npm --prefix frontend exec -- tsc -p frontend --noEmit` pass; real results in the report.
