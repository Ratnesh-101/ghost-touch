# Lane Report: q1-share-sanitize

Status: DONE
Tool: agy, reviewed by Claude
Timestamp: 2026-11-10T00:55:00Z

## Summary
Implemented robust prefix sanitization for `sanitizeShareName` and `sanitizeShareTitle` in
`frontend/src/flow/share.ts` satisfying Requirements 22.1–22.5 to ensure that all property tests
P66–P70 in `frontend/tests/share.sanitize.prop.test.ts` pass, while preserving existing unit test
behaviours in `frontend/tests/m3.sharedLinkGate.test.ts` and
`frontend/tests/fix.share.security.test.ts`.

## Needs from Kiro
None.

## TEMP Stubs Created
None.

## Problem & Shrunk Counterexamples Addressed
- **P66**: Result begins with a badge word, check mark, invisible mark or whitespace.
  - Previous regexes failed to strip check marks following a badge word (`"verified ✓"`), and
    lacked invisible mark ranges `\u2061-\u2064` and `\uFE00-\uFE0E`.
- **P67**: Input of only badges must sanitise to the empty string `""`.
  - Previous regexes failed when connectors like `"and"` or punctuation appeared ahead of badge
    words (`"and verified, verified"`).
- **P69**: No `"and"` or `"&"` left over from stripping, and legitimate name preserved.
  - In inputs like `"&verified Alice"`, `"&"` survived because connector matching required
    following whitespace or end of string.
- **P70 & Req 22.5**: Names that look like badges or connectors without being badges
  (`"Andrew"`, `"Verity"`, `"Verifiedcity"`, `"Certifiedx"`, `"Certify Labs"`, `"Tom and Jerry"`,
  and plain `"and Alice"` without any badge) must remain unchanged.

## Solution Architecture
1. **Token Definitions Matching P66 Oracle Exactly**:
   - `INVISIBLE_TOKEN`: `\s`, `\p{M}`, `\u200B-\u200F`, `\u202A-\u202E`, `\u2060-\u2064`,
     `\u2066-\u2069`, `\uFEFF`, `\uFE00-\uFE0F`.
   - `CHECK_MARK_TOKEN`: `✓`, `✔`, `☑`, `√`, `✅`, `🗹` with optional `\uFE0F`.
   - `BADGE_WORD_TOKEN`: `verified`, `certified`, `सत्यापित`, `પ્રમાણિત` followed by
     `(?![\\p{L}\\p{M}\\p{N}])` to prevent prefix matches inside ordinary words.
   - `CONNECTOR_TOKEN`: `&`, `and(?![\\p{L}\\p{M}\\p{N}])`, and delimiters `[:.,-]`.
   - `ALL_CONNECTORS_OR_SPACES`: Checks if an input consists only of connectors/invisibles/spaces.
2. **Deterministic Iterative Prefix Loop**:
   - Strips leading invisibles/spaces initially.
   - Scans sequential prefix tokens. Tracks `hasBadge` flag whenever a badge word or check mark is
     encountered.
   - Strips the scanned prefix ONLY when `hasBadge === true`, satisfying Requirement 22.5: connectors
     are removed if and only if a badge or check mark is present in that prefix.
   - Strips any whitespace/invisibles exposed by the removal and repeats until no further badge
     prefixes can be stripped.
   - Returns `""` if the final string consists entirely of connectors/whitespace (e.g. lone `"and"`
     or `"&"`), otherwise returns the clean name.
   - Guarantees idempotence (Req 22.3, P68) and preserves legitimate names (P70).

## Verification
- `share.sanitize.prop.test.ts`: All properties P66–P70 pass (300 runs each).
- `m3.sharedLinkGate.test.ts`: All unit and integration test assertions pass.
- `fix.share.security.test.ts`: All regression assertions pass.
- No old test contradicts Requirement 22; all old tests remain green.
- All code formatted and line lengths kept strictly within 100 columns.
