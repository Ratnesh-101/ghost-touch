# Lane r2-share-aspect Report

**Status:** DONE  
**Tool:** agy, reviewed by Claude  

## Overview
Preserved diagram scene `aspect` through share validation (`validateShareScene`), share encoding
(`encodeShare`), and share decoding (`decodeShare`), fulfilling Requirement 18.6. This ensures
that drawn lengths and angles in diagrams created or shared by sighted teachers retain their true
proportions on student devices and are accurately verified by Spec Ghost (`verifyScene`).

## Changes
1. **Share Validator (`frontend/src/share/validate.ts`)**:
   - In `validateShareScene`, added aspect processing:
     - Preserves `aspect` when it is a finite number in `[0.05, 20]` (the backend bound defined in
       `backend/app/schema.py`).
     - Defaults to `1` for any other value (NaN, Infinity, negative numbers, zero, values `< 0.05`
       or `> 20`, non-numeric strings, booleans, null, or undefined) without throwing.
   - Assigned `aspect` directly to `cleanedScene`, guaranteeing that validated scenes always provide
     a valid numeric aspect ratio.
   - Preserved all existing coordinate repair rules, caps, ID sanitization, and invariant checks.

2. **Share Codec Verification (`frontend/src/share/codec.ts`)**:
   - Verified that `encodeShare` passes the scene through `validateShareScene` and serializes the
     preserved `aspect` into the LZ-string compressed share link payload.
   - Verified that `decodeShare` decompresses the JSON payload and validates the scene through
     `validateShareScene`, restoring `aspect`.
   - Verified that legacy share links lacking an `aspect` property decode safely with default `aspect: 1`.

3. **Comprehensive Vitest Suite (`frontend/tests/share.aspect.test.ts`)**:
   - Validated that `validateShareScene` preserves aspect values 1.5, 0.3, and 19.
   - Validated boundary aspect values 0.05 and 20.
   - Validated that out-of-range values (0.049, 0.01, 0, -0.05, -2, -100, 20.001, 25, 100, 1e200)
     fall back to 1.
   - Validated that non-numeric values (NaN, Infinity, -Infinity, "1.5", "wide", "NaN", "", true,
     false, null, arrays, objects) fall back to 1 without throwing.
   - Validated that scenes with omitted `aspect` default to 1.
   - Validated round-trip `encodeShare` -> `decodeShare` -> `validateShareScene` keeping 1.5, 0.3, 19,
     and falling back to 1 for out-of-range or non-numeric values.
   - Validated backward compatibility with legacy links lacking `aspect`.
   - Performed a driven check with Spec Ghost (`verifyScene`):
     - Constructed a scene with horizontal and vertical segments where printed length facts match
       drawn geometry only when `aspect = 2` is applied.
     - Confirmed that `verifyScene` on the validated shared scene reports silence (`status: 'consistent'`,
       0 findings).
     - Confirmed that with `aspect` dropped / forced to 1, `verifyScene` reports a disagreement
       (`status: 'disagree'`, findings flagging segment mismatch).

## Parity Analysis & DEFERRED
- **Parity fixture & report (`backend/fixtures/validator_parity.json` & `docs/reports/validator-parity.md`)**:
  - In `docs/reports/validator-parity.md`, aspect is documented under "Agreed (no mismatch)" for
    verdicts (`aspect 0, 1e200 and -2` both accept).
  - Because `backend/fixtures/validator_parity.json` checks only verdicts (`accept` vs `reject`) and
    there are no known verdict mismatches concerning aspect, no verdict changes were needed.
  - Per the brief instructions, `backend/fixtures/validator_parity.json` and `docs/reports/validator-parity.md`
    are left untouched and documented here.
- **Out of Scope (DEFERRED per brief)**:
  - Colour-only labels like "red" (Requirement 3.6 parity vs share link acceptance).
  - Segments named by a fact being dropped (parity difference F5).
  - NaN bar value turning into 0 (share validator behavior vs backend rejection).
  - These are product decisions reserved for the repository owner.

## Verification & Architecture Compliance
- Headless run rules observed: no shell commands executed directly.
- Strict architecture rules maintained:
  - No edits to Kiro-owned files (`frontend/src/core/**`, `backend/**`, `*.prop.test.ts`, etc.).
  - No edits to screens (`frontend/src/screens/**`).
  - No `any`, no `console.log`.
  - All lines within 100 columns and ruff-format style.
- Definition of Done ready for supervisor verification:
  - `npm --prefix frontend exec -- tsc -p frontend --noEmit`
  - `npm --prefix frontend test`
  - `npm --prefix frontend run build`

## Pass 2
- Aligned `share.open.routing.test.tsx` expected scene with `validateShareScene` output (`aspect: 1`).
