---
inclusion: fileMatch
fileMatchPattern: "frontend/{src/core/verify.ts,src/verify/**,tests/verify*.test.ts,tests/k1.verifyWiring.test.ts}"
---

# Spec Ghost (fact check) rules

Spec Ghost compares a diagram's printed facts ("AB = 5 cm", "angle C = 90°") with what was drawn. Requirement 18 in `.kiro/specs/ghost-touch/requirements.md` is the contract; this file is the short version for anyone editing the code.

## What it is, and is not
- It is a **consistency check**. It can say the numbers and the drawing do not agree. It cannot say which one is wrong, and it cannot say the diagram is right.
- It is **not** forgery protection, not proof of correctness, and not a teacher's approval. A careful forger who changes the drawing and the facts together is not caught, and that is fine.

## Never
- Never say "verified", "correct", "checked", "trust", or anything that claims the diagram is right. A consistent result says **nothing**.
- Never guess. An unparsed fact is ignored, not interpreted.
- Never speak more than one extra sentence on scene load, and never as a second utterance (it is joined into the entry announcement, see Requirement 17.2).
- Never put browser APIs, React or i18n into the module. It stays pure and lives in `frontend/src/core/verify.ts`; wording is translated by the callers (`flow/navigation.ts`, `flow/ask.ts`) with the `verify.disagree` key.

## Silent when unsure
Stay silent with fewer than two matched lengths, with any "not to scale" fact, with unknown units that differ, and when an angle's arms cannot be found. Silence is always the safe answer.

## The numbers (do not change without the owner)
- Lengths: ratios only, 15 % tolerance, 25 % for AI scenes.
- Angles: 8 degrees.
- Measure in the diagram's own proportions: x distances times `aspect` (the backend `semantic.py` does the same).

## The sentence
"Facts and drawing disagree on {name}. I can't tell which is right." Hindi and Gujarati translations are in `i18n` under `verify.disagree` and still need a native speaker's review.

## Tests to keep green
`tests/verify.test.ts` (P47-P50 and the regression over every sample and research scene: zero false flags), `tests/k1.verifyWiring.test.ts`, and the Kiro review tests in `tests/verify.review.test.ts`. The hook `verify-tests-on-save` runs them when these files are saved.
