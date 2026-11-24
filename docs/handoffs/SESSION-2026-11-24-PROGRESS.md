# Progress save, 2026-11-24 (Claude Code). Usage limit reached mid-work; resume here.

Gate on local main at this save: tsc errors=0 |  Test Files  260 passed (260)       Tests  3313 passed | 1 expected fail | 1 todo (3315)  | Playwright:   186 passed (59.9s) 
Pushed? see `git status -sb` (push only if the gate line above is green).

## Done since the last handoff
- Playwright check of docs/PHONE_TEST.md: specs e2e/phone-test-emulated.spec.ts, -2, -3 and e2e/support/phoneSpies.ts (steps 1-4, 6-14, 16-18 checked in emulated Chrome; camera, motor, TalkBack, real voices stay for the phone).
- Findings fixed: F1 settings sheet never spoke opened/closed (lane hi18, merged); Ghost Hand Build status line stayed on "Empty graph" after pins (owner-found, lane hi17, merged, spec e2e/build-status.spec.ts); nightly soak timeout raised to 150 min.
- Finding F3 (still finger never counted as a try during Planchette Your turn): Kiro core fix done (T89, held touch, P183-P186). Agy lane hi19 (worktree ../gt-lane-hi19, branch agy/hi19) wires it into Explore.tsx but is NOT merged: one own test fails (tests/explore.walkHeld.test.tsx "a still finger on the right anchor speaks the step once not repeatedly": got 2 utterances, expected 1: real double-speak or a test race: investigate), and in that lane the two expected-failure finding tests now pass.

## Next steps (in order)
1. Fix lane hi19's double-speak (agy fix pass: a held touch on the right anchor must not re-speak the step), re-gate, cherry-pick onto main (resolve BUILD_LOG by keeping both sides).
2. Flip the F3 test in e2e/phone-test-emulated-3.spec.ts: remove `test.fail(true, ...)` from "PT 17.4b" (and make sure the F1 describe is gone from the lane copy: main already has it fixed).
3. Write the results table into docs/PHONE_TEST.md (new section near the top, "Browser check results (Playwright)": rows checked PASS, rows that need the phone; step 0 live check: backend health 200 in 28 s cold; sine sample DOES offer a walk, row 17.11 is a discrepancy to report; rate is 1.1 x 0.8/1.0/1.25, not 0.8/1.0/1.25).
4. Full gate on main (always read the "N failed" line), push, check CI, update BUILD_LOG and README numbers.
5. Housekeeping: a stale preview server on port 4173 can make Playwright runs fail wholesale when two lane gates overlap: run lane gates one at a time; I stopped two leftover node processes (PIDs 7536, 11324) this session.

## UPDATE 2026-11-25: everything above is DONE and pushed (lane hi19 merged, F3 test flipped, PHONE_TEST.md results table written, README and BUILD_LOG updated). CI on d78a941 was fully green, including the full Playwright run. Nothing is running. Only owner-only items remain (phone tests, video, [FILL] slots, OpenAI cap, Gemini terms, Render env, Share flag on Vercel, hi/gu native review, pin spacing decision OD-A).
