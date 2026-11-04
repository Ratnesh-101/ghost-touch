# Step 6 evidence: Kiro hooks for property tests and review

## What was added

### `.kiro/hooks/prop-tests-on-save.json`
Trigger: `PostFileSave`
Matcher regex: `hapticEngine|pitch|hapticEngine\.prop\.test|pitch\.prop\.test|hitTest\.prop\.test|validate\.py|test_validate_props`

When any of these files is saved, the hook runs:
- If a backend file (`validate.py`, `test_validate_props.py`): `pytest tests/test_validate_props.py` (P9, P13)
- If a frontend file (`hapticEngine*`, `pitch*`, `hitTest*`): `vitest run` on the three prop test files (P1, P2, P3–P7, P11)

Exit 2 on test failure → blocks the save and reports errors in the IDE.

### `.kiro/hooks/review-on-stop.json`
Trigger: `Stop` (fires when a Kiro session ends)
Action: `agent` — appends the review protocol prompt from `.kiro/steering/review.md`

Checks: architecture rules, haptic vocabulary values, property test completeness,
no TEMP stubs, tasks.md checkboxes. Writes verdict to
`docs/reviews/session-review-latest.md`.

## Verification
Both hook files created and committed. Hook json format: v1, verified
against the schema in `.kiro/hooks/`.

The prop-tests-on-save hook was tested conceptually against the matcher:
- `hapticEngine.ts` → matches `hapticEngine` → runs frontend prop tests ✓
- `validate.py` → matches `validate\.py` → runs backend P9/P13 ✓
- `scene.ts` → no match → hook does not run (correct) ✓
