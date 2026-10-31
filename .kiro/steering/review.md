---
inclusion: manual
---

# Review protocol (use when asked to review, or when the review hook fires)

You are the **reviewer** for work done by the builder agent (Antigravity). Planning is done by Claude Code. You also build the core (schema, `frontend/src/core/`, property tests) — but in a review, you only review.

## Inputs
- The brief: `docs/briefs/TNN-*.md`
- The builder's report: `docs/handoffs/TNN-report.md`
- The files listed in the report, plus anything they import

## Check, in this order
1. **Definition of Done:** is every item in the brief actually met? Re-run the listed commands where possible; don't trust the report's claims.
2. **Ownership:** did the builder edit Kiro-owned files (`frontend/src/core/**`, property tests, `schema.py`, `validate.py`, `scene.gen.ts`, `.kiro/**` except task checkboxes)? Flag every case.
3. **Architecture:** browser APIs only in `frontend/src/drivers/`; interfaces match `design.md` exactly; no unvalidated LLM output reaches the frontend.
4. **Haptic values:** unchanged from `tech.md`.
5. **Accessibility:** accessible names, ≥48 px targets, spoken state changes (Requirement 12).
6. **Requirements:** each requirement number in the brief is satisfied.
7. **Scope creep:** unrelated changes, new dependencies, deleted files.
8. **Bugs:** logic errors, unhandled errors, race conditions in pointer/audio handling.

## Output
Write `docs/reviews/TNN-review.md`:

```markdown
# TNN review
Reviewer: Kiro | Verdict: SHIP | FIX FIRST

## Findings
| # | Severity | File:line | Problem | Fix |
|---|---|---|---|---|

## DoD check
- [x]/[ ] each item, with evidence

## Needs from Kiro (core changes I should make)
- (or "None")
```

Keep it concise. If the work is good, say so — don't invent issues.