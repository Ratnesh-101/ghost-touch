# Kiro round 5: the audit invariants as property tests (task 38)

**Status: properties written, awaiting agy fixes.** 13 properties (P66-P78, Requirement 22) in four new test files. **6 fail, 7 pass.** The same six fail on three consecutive runs. Nothing was fixed; no file under `frontend/src/` was changed.

**Read this first: the fixes had already merged.** The brief said the three agy lanes had not merged. By the time the tests ran, `main` was at `2d108ca`, and lanes p1-p5, q1, q2, r1 and r2 were all ancestors of it (`git merge-base --is-ancestor`). So these properties ran against the **fixed** code. A failure below is a gap the round-5 fixes left, not a fix still to come.

## How to reproduce

```
cd frontend
npx tsc --noEmit                      # 0 errors
npx vitest run tests/share.sanitize.prop.test.ts tests/share.template.prop.test.ts \
  tests/saved.eviction.prop.test.ts tests/share.honesty.prop.test.ts
```

Every failure below gives its fast-check `seed` and `path`. To replay one exactly, pass them to `fc.assert(..., { seed, path, endOnFailure: true })`. Characters you cannot see are written as `\u{..}`.

## Results

| Property | Pins | Result |
|---|---|---|
| P66 sanitised text never begins with a badge | share audit R5-01 | **FAIL** |
| P67 only badges give "" | R5-01 | **FAIL** |
| P68 sanitising is idempotent | R5-01 | pass |
| P69 no leftover "and" or "&", name kept | R5-01 | **FAIL** |
| P70 ordinary names unchanged | R5-01 (no over-stripping) | pass |
| P71 `$` patterns: the name once, no `{name}` or `{title}` | share audit R5-06 | pass |
| P72 the store never ends above its cap | saved audit R5-06 | pass |
| P73 pinned entries are never evicted | saved audit | pass |
| P74 no `ok: true` over the cap after a failed delete | saved audit R5-06 | **FAIL** |
| P75 an existing id is updated in place | brief p2 | pass |
| P76 an in-place update keeps `pinned` and `createdAt` | brief p2 | **FAIL** |
| P77 no share string says verified / सत्यापित / પ્રમાણિત | share audit R5-02 | **FAIL** |
| P78 the "not checked" strings stay | R5-02 | pass |

## The failures

### 1. P66 and P67: a check mark right after a badge word survives (share R5-01, HIGH class)

- **P66:** seed `-831805181`, path `"11:2:0:1:2:4:4:4:4"`. Shrunk counterexample `[verified][✓]` rendered as `"verified\u{2713}"`. `sanitizeShareName` and `sanitizeShareTitle` both return `"verified\u{2713}"`, which begins with a badge word.
- **P67:** seed `-1958317831`, path `"1:1:1:1:1"`. The same input, `"verified\u{2713}"`, is badges only and should give `""`, but gives `"verified\u{2713}"`.
- **The realistic form, measured:** `"\u{2705}Verified\u{2705} Mrs Sharma"` gives `"Verified\u{2705} Mrs Sharma"`. That is the audit's own spoof (emoji, then "Verified"), and the name that is shown and spoken still starts with "Verified".
- **Why (from reading `flow/share.ts`):** `LEADING_BADGE_WORDS` strips a badge word only when it is followed by a connector, whitespace, an invisible mark or the end. A check mark directly after the word matches none of those, so the word stays. The leading check mark was stripped, but nothing strips the word that follows it.

### 2. P69: an "and" is left over after stripping (share R5-01; the brief's "never contains and or &")

- **P69:** seed `1764458590`, path `"0:1:0:1:1:1:1:1"`. Shrunk input `"and\u{2713}Alice"`, with the name `"Alice"`. Reading the code, it is returned unchanged; I did not run this one.
- **Measured, on readable inputs from earlier runs of the same property (seed `-1871874011` and seed `370149271`):**
  - `"verified, and:Alice"` gives `"and:Alice"`.
  - `"verified: and: Alice"` gives `"and: Alice"`.
- **Why:** after the badge word is removed, `LEADING_CONNECTORS` accepts "and" only when an invisible mark or the end follows it. When ":" follows, the "and" stays at the front.

### 3. P77: share strings still say "verified" (share R5-02)

- **P77:** seed `-325525499`, path `"11"`. The first hit is `[en] share.honesty`. Every hit, listed exhaustively:
  - `[en] share.honesty` = "This diagram was shared as a link. Ghost Touch has not verified it." This is the p3 fix. It is a negation, but the rule in the brief allows only the existing "not checked" wording. The `hi` and `gu` versions pass.
  - `[en] share.verified` = "Verified"; `[en] share.verifiedBy` = "Verified by {name}".
  - `[hi] share.verified` = "सत्यापित"; `[hi] share.verifiedBy` = "{name} द्वारा सत्यापित".
  - `[gu] share.verified` = "પ્રમાણિત"; `[gu] share.verifiedBy` = "{name} દ્વારા પ્રમાણિત".
- **Where the legacy keys are still used:** `share.verified` and `share.verifiedBy` are used only by the legacy branch of `resolveShareRoute` in `App.tsx`. That branch runs only when a caller omits `{ honest: true }`. All three callers pass it today, but the default is still `false` (R5-12, deferred by lane p3 to the supervisor).
- **One more legacy-branch issue:** `App.tsx:148` builds the legacy line with `.replace('{name}', legacyVerifiedName)`. That is the R5-06 `$` bug, still present there. P71 does not cover it, because `App.tsx` has no pure seam.

### 4. P74: the non-atomic save can report `ok: true` over the cap (saved R5-06, latent)

- **P74:** seed `937312435`, path `"34:3:1:3:3:3:11:15:1:10:11:11:14:14:13:14:14:15:5:12"`. It reproduces exactly. The counterexample is pinned as an explicit example in the test, so it now runs every time.
- **The counterexample**, at cap 2, on a store **without** `putWithEviction`:
  1. Save `d2`.
  2. Deletes break.
  3. Save `d0`.
  4. Save `d1`. At the cap, the fix puts `d1` (3 entries). Deleting the victim fails, and so does the rollback delete, so the store stays at 3. This save returns not-ok.
  5. Save `d0` again, in place. This returns `{"ok":true}` with `[d2, d0, d1]`: 3 entries, cap 2.
- **Why:** the p2 fix is "put, delete the victim, roll back on failure". A rollback that needs a working `delete` cannot help when `delete` itself is broken. Deleting the victim before the put avoids this; the IndexedDB path already does that in one transaction.
- **Severity: low and latent.** Both shipped stores, `IDBDiagramStore` and `MemoryDiagramStore`, implement `putWithEviction`, so no shipped code takes this branch. It is still the branch the audit named.

### 5. P76: the in-place update takes `pinned` and `createdAt` from the caller (brief p2)

- **P76:** seed `-2112622909`, path `"5:2:0:1:2:2:4:4:4:5"`. The counterexample: save `d0` unpinned, then save `d0` again carrying `pinned: true`. The stored `d0` becomes pinned. An earlier run (seed `1471220698`) showed the same for `createdAt`: the stored 0 became 1.
- **Not user-visible today.** `App.tsx` builds the update from `...matchingEntry`, so the stored values are what get passed in. The preservation lives in the caller, and `saveDiagramWithEviction` itself replaces the entry wholesale.
- **A contract decision for the lead:** either move the preservation into `saveDiagramWithEviction`, or amend Requirement 22.11 to say the caller owns it. If the requirement is amended, P76 should be changed to match in a Kiro commit, not weakened by a lane.

## What passed, and what that means

- **P71:** the `$&`, `$'`, `` $` ``, `$1`, `$$` corruption (R5-06) is fixed in all four builders in en, hi and gu.
- **P72 and P73:** the cap holds and pinned entries survive under one-shot failures on both store branches.
- **P75:** in-place updates neither evict nor duplicate.
- **P68, P70 and P78:** sanitising is idempotent, real names such as "Andrew", "Verity" and "Verifiedcity" are left alone, and the "not checked" strings are intact.

## Not covered by these properties

- **Behind React or `App.tsx`, no pure seam:** saved audit R5-01, R5-03, R5-04, R5-05, R5-07, R5-08; share audit R5-04, R5-05, R5-08, R5-09, R5-10, R5-11, R5-12.
- **Needs a different fake:** saved audit R5-02 (`IDBDiagramStore` puts before it deletes) needs a quota-aware fake `IDBFactory`. Its fix is in `24c629f`, but no property checks it.
- **Pure, but outside the brief's list:** share audit R5-07 (`sceneName` falls back to the raw `scene.kind`).
- **Backend audit:** its three findings are about tests and an allowed MIME list. They have no invariant that fits a fast-check property; lane p1 fixed them with example tests.
