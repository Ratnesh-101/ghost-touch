# Lane w1-docs-refresh Report

- **Lane:** w1-docs-refresh
- **Builder:** Antigravity (agy, reviewed by Claude)
- **Status:** DONE
- **Date:** 2026-11-10

## Overview
Refreshed all outward-facing documentation files (`README.md`, `docs/STEMERGENT_SUBMISSION.md`, `docs/KIRO_WRITEUP.md`, `docs/BLOG.md`, `docs/SOCIAL.md`, `docs/DEMO_SCRIPT.md`, `docs/BUILD_LOG.md`) to bring them into alignment with features and audit fixes landed on `main` over the last two days.

## Summary of Changes

1. **Ghostwriter in Teach Mode:**
   - Documented pure core addition (`addPoint` and `addSegment` in `frontend/src/core/correct.ts`, Kiro Requirement 19, Task 34, P54–P57).
   - Documented pure flow state machine (`frontend/src/flow/ghostwriter.ts`, Kiro Requirement 20, Task 36 spec; built by Antigravity lane g1, P58–P61).
   - Documented Teach screen toolbar controls ("Add point", "Add edge", 48×48 px touch targets, spoken confirmations, and spoken undo).
   - Documented audit fixes (lane v1: eliminated button focus speech to prevent cancelling deletion/undo announcements).

2. **Disputed-Angle Wording per Language:**
   - Documented localized disputed angle names (Kiro Task 35 / Requirement 18.2 / M4-10, `verify.angleName`: "angle C" in English, "कोण C" in Hindi, "ખૂણા C" in Gujarati).
   - Verified pure helper `localizedFindingTarget` keeps `core/verify.ts` language-free while wiring localized terms into entry and Ask caveats.

3. **Round-5 Audits and Hardening Fixes:**
   - Backend permits, aspect, and MIME: `image/jpg` MIME acceptance, safe in-flight permit release on client disconnect (HTTP 499) and timeout via `try...finally`, aspect bounds `[0.05, 20.0]` in schema/validator, and P1..P99 point IDs in `/ask` (lanes p1, n1, p5).
   - Saved diagrams: IndexedDB atomic eviction rollback via `putWithEviction`, in-place updates preserving `id`, `pinned`, and `createdAt`, sequential save queue, and GT-06 storage error status text silence (lanes p2, n2).
   - Share and a11y: honest share attribution ("Shared by <name>, not checked"), tap-to-open `ShareGate` user activation, iterative prefix loop sanitization stripping badges/checkmarks/invisibles/connectors (`flow/share.ts`, lane q1), single announcement in `ShareError` without alert collisions, and accessible control labels (lanes p3, m3).

4. **Kiro's Test-First Property Oracles for Requirements 21 & 22 (P66–P78):**
   - Correct mode delete curves and bars (`deletePolyline`/`deleteBar` in `core/correct.ts`, Requirement 21, Task 37.1, P62–P65 passing).
   - Round-5 audit invariant properties (Requirement 22, Task 38, P66–P78):
     - Passing in repo: P71 (template replacer safety), P72 (saved diagram cap invariant), P73 (pinned diagram immunity), P75 (in-place save preservation), and P66–P70 (share-name prefix loop sanitization resolved by agy lane q1).
     - Gaps / pending oracles from Kiro T38: P74 (non-atomic save path over-cap on delete failure; latent as shipped stores are atomic), P76 (in-place update taking pinned/createdAt from caller contract question), and P77/P78 (share honesty copy and legacy key cleanup).

5. **Spec Ghost Fact Checking:**
   - Documented client-side geometric consistency check (`frontend/src/core/verify.ts`) wired into Explore and Ask announcements.
   - Documented per-language wording, silent behavior on consistent or uncertain scenes, and fact parsing rate (~35% on sample and research scenes, 21 of 60 scenes).

6. **Multi-Agent Attribution Matrices:**
   - Synchronized Kiro, Antigravity, and Claude Code roles across all documents strictly following `docs/BUILD_LOG.md`.
   - Prevented misattribution (never crediting Kiro for agy or Claude work, or the reverse).

7. **Demo Script Beat:**
   - Added optional Beat C to `docs/DEMO_SCRIPT.md`: Ghostwriter in Teach mode (Teach, Add point, tap, hear confirmation, undo).

8. **Invariant Preservation:**
   - Preserved every `[RECOUNT]` and `[FILL]` marker untouched with zero test counts written.
   - Preserved the owner's hardware sentence: *"Haptic values were tuned by hand on the owner's OnePlus Nord CE6 in the prototype; full-app phone testing is pending."*
   - Preserved Guide and Share as flagged OFF by default and unverified on hardware; link content is *"Shared by <name>, not checked"*.
   - Never claimed "verified", "secure", or "bug-free".
   - Preserved concise, factual phrasing without marketing adjectives.

## Unverified Items / Blockers
- Hardware verification on physical mobile devices remains pending (OnePlus Nord CE6 full-app phone testing).
- Shell commands were not run per headless run rules; test counts preserved for supervisor recount.

## Files Touched
- `README.md`
- `docs/STEMERGENT_SUBMISSION.md`
- `docs/KIRO_WRITEUP.md`
- `docs/BLOG.md`
- `docs/SOCIAL.md`
- `docs/DEMO_SCRIPT.md`
- `docs/BUILD_LOG.md`
- `docs/reports/agy-w1-docs-refresh-report.md`
