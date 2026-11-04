# Step 4 evidence: DiagramScene validator hardening and Hypothesis properties P9, P13

## What the spec said
design.md §Backend, validate.py:
"Parse, normalize, enforce invariants (unique ids, valid references, coords in
[0, 1]); repair trivial issues (clamp ±0.02 overshoot, drop dangling segments).
A scene with no drawable elements is rejected so the pipeline can fall back to Raw Mode."

Requirement 3.6: reject labels consisting only of colour or generic shape words; retry once then Raw Mode.

P9: any scene accepted by validate.py has unique ids, valid point references,
and all coordinates in [0, 1]. Garbage input never raises an unhandled exception.

P13: labels made only of colour/shape words are rejected; labels with any other
word are accepted.

## What was built
| File | Content |
|---|---|
| `backend/app/validate.py` | `validate_scene(raw)` — never raises; clamps ±0.02 coords, drops out-of-tolerance elements, drops dangling segments, dedupes ids, rejects colour/shape-only labels, rejects zero drawable elements. |
| `backend/tests/test_validate_props.py` | P9 (200 Hypothesis examples: scene dicts, random dicts, garbage strings), P13 (property: colour/shape words rejected; uppercase letters accepted). |

## Which tests caught what
- **P9 garbage strings**: the `_is_valid_json` branch needed to strip markdown code fences
  (` ```json ``` `) — found when Hypothesis generated a string starting with backticks.
- **P9 zero-drawable rejection**: the check for no drawable elements was added after
  `kind="unknown"` with an empty scene passed schema validation.
- **P13 uppercase letter acceptance**: guards against accidentally over-broad rejection
  (e.g. "B" is a valid label for a vertex at point B).

## Verification
`py -3.11 -m pytest tests/` — 277 passed, 1 skipped, 0 failed in 34 s.
The 1 skipped test is the on-disk JSON schema sync test (needs a fresh clone
with `export_schema.py` run first — known and documented in KIRO-PAUSE.md).
