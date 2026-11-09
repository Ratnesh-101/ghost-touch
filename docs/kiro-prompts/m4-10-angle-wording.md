# Kiro prompt: reconcile M4-10 (disputed-angle wording) with Requirement 18.2

Paste this into Kiro chat.

---

Task: decide and implement how Spec Ghost words a disputed ANGLE fact, so it works in English, Hindi and Gujarati without breaking Requirement 18.2.

Context:
- `frontend/src/core/verify.ts` builds the disagreement target for an angle fact as `angle B` (English word "angle" + vertex) and passes it to `VERIFY_WORDING.disagree(target)` / `disagreeTemplate`. In Hindi or Gujarati the caveat then contains the English word "angle" (a localisation leak). Round-4 audit item M4-10.
- Your property in `frontend/tests/verify.review.test.ts` ("Requirement 18.2 — the sentence never claims the diagram is right", 250 runs) pins the exact English sentence `Facts and drawing disagree on (AB|BC|CA|angle B). I can't tell which is right.`
- agy lane n2 wrote tests for the fix in `frontend/tests/n2.round4.test.ts` (`describe.skip('M4-10 ...')`, 3 tests: English strip, no "angle" leak in Hindi, no leak in Gujarati). They expect the target to be just the vertex (`B`) in the localised sentence. They are skipped on main until you decide.

What to do:
1. Pick the behaviour: either (a) localise the word per language via the i18n tables (English keeps `angle B`, so 18.2 is unchanged; hi/gu use their own word for angle), or (b) drop the word and use the vertex only (then update the 18.2 property regex and the spec in requirements.md / design.md Requirement 18 to say so). Option (a) keeps your property as is and is the smaller change.
2. Implement it in `core/verify.ts` (pure core: no React or browser APIs; do not touch the tuned haptic values).
3. Un-skip `describe.skip('M4-10 ...')` in `frontend/tests/n2.round4.test.ts` and adjust its expectations to the behaviour you chose (it is agy's file; keep the intent: no English "angle" in the hi/gu caveat).
4. Keep P47-P50 and the 18.2 property at their run counts; both must pass.
5. Update tasks.md and add one line to docs/BUILD_LOG.md (tool = Kiro).

Done when: `npm test` (vitest) is fully green with zero skipped M4-10 tests, and `tsc --noEmit` has 0 errors.
