# Ghost Touch as a judge sees it: submission and evidence layer

Persona pass by Claude Code, 2026-11-17. Read-only: nothing in the repo was changed except this file.
Checked at `main` = `origin/main` = `a82f7bf` (897 commits, all hx lanes and the stacked Explore lanes merged).
Counts below are static counts from the files. I did not run the test suites, open the live site, or read any `.env` file.
I could not confirm that CI is green on GitHub or that the STEMergent form was submitted; both need the owner.

---

## 1. Scorecard

| Criterion | Score | One-line reason |
|---|---|---|
| Problem and impact | 7 / 10 | Real, well-stated gap and a zero-hardware answer, but no blind or low-vision person has used it and the docs say so. |
| Innovation | 8 / 10 | Vibration plus pitch plus speech on a commodity phone, with a deterministic Raw Mode floor, is a fresh combination; the "creature" framing fits Frankenstein without touching blindness. |
| Technical depth | 8 / 10 | Pure state-machine core, 36 EARS requirements, properties up to P136, mutation checks, Playwright regressions, provider chain with validation and fallback. |
| Use of Kiro | 7 / 10 | Specs, steering and property oracles are deep and current; no recorded hook firing, no MCP, no vibe-coding account, and the write-up's numbers are five days stale. |
| Accessibility and honesty | 8 / 10 | Honesty is the best I have seen today (about 9); accessibility is designed and unit-tested but unproven on a phone with TalkBack in the full app (about 6). |
| Polish and demo reliability | 5 / 10 | No video, `[FILL]` markers still in the submission text, the owner test sheet is blank, and the demo script does not show the features that landed on Nov 15 and 16. |

Overall: about 7.2. A finalist on engineering and honesty; not a winner until there is a video, one phone pass and one user.

## 2. The three-minute verdict

I open the README. The first paragraph tells me what it is and who it is for. The "Try it in 60 seconds" block works for me on a laptop because it tells me I will hear a buzz instead of feeling one. That is a judge-aware touch most teams miss.

Then I look for proof. There is no demo video link. The STEMergent text still has five `[FILL]` markers and a banner that says "draft for the owner to edit". The gallery images exist on disk but are not in the repository. So in my first minute I have a good idea and no moving picture of it.

In the second minute I open `.kiro/`. This is the strongest part. The spec is large and alive: 36 requirements, a design file with numbered properties, 66 parent tasks, and commits prefixed `kiro:` up to last night. The Kiro write-up opens with "Kiro did not build most of the app". That sentence is brave and I believe everything after it more because of it. But the same write-up says 25 requirements, P1 to P87, 42 tasks, 841 commits and 69 `kiro:` commits. The repo says 36, P136, 66, 897 and 89. Stale numbers in an honesty document cost trust, even when the truth is better than the claim.

In the third minute I check what a blind student would get. The docs say plainly: no student has used it, the full app has not had a recorded phone pass, TalkBack was tried only on the prototype, Hindi and Gujarati are machine-translated. I respect that. I also cannot give a top impact score to a tool no target user has touched.

My note for the panel: "Excellent spec-driven core and unusually honest. Kiro is used as specifier and judge of other agents, which is a real and interesting pattern, but the builder was mostly not Kiro and hooks have never been shown firing. Demo evidence is missing. Shortlist if the video shows a real phone and a real trace."

---

## 3. What I verified against the repo

| Claim in the docs | What the repo shows today | Status |
|---|---|---|
| "2,231 frontend tests across 181 files" (README, appendix, write-up, blog, social) | 213 test files under `frontend/tests` and `frontend/src`; 2,298 `it(` or `test(` call sites; BUILD_LOG entry T66 (2026-11-16) records "vitest 213 files, 2700 passed, 1 expected fail, 1 todo" | Stale and too low |
| "834 backend tests" | 53 `test_*.py` files, 600 `def test_` functions, 52 `@given`, 59 `parametrize` uses. 834 collected is plausible with parametrize but I did not run pytest; hx lanes added tests since Nov 12 | Unverified, likely stale |
| "property-based tests" | 41 `*.prop.test.ts` files, 234 `fc.assert` calls, run counts mostly 200 to 300; 52 Hypothesis `@given` | True |
| "P1 to P87" (write-up); "P1 to P57 passing" (appendix) | design.md goes to P136; tests name P1 to P108 and P114 to P136; P109 to P113 are specified but have no tests (task 56.2 open) | Stale; one gap to state |
| "25 requirements, 42 tasks" (write-up) | 36 requirement headings, 66 parent tasks; 313 ticked boxes, 34 open | Stale |
| "841 commits, 814 owner, 4 Kiro, 69 `kiro:`" (write-up) | 897 commits: 870 owner, 4 "Kiro", 21 dependabot, 2 from an outside contributor; 89 `kiro:` | Stale |
| "over 300 commits authored under the owner's identity" (README) | 870 | True but oddly low |
| "9 hooks, 5 run checks on save, 4 ask the agent" | 9 JSON files; 5 `command` actions, 4 `agent` actions | True |
| "live firing is not yet recorded" | `docs/kiro-evidence/hooks-check.md` still says so; task 21.4 open | True, still a gap |
| "five steering files" | `product`, `tech`, `structure`, `review`, `verify` | True |
| "No MCP server exists" | No `.kiro/settings/` | True |
| MIT licence | `LICENSE`, 2026, owner's name | True |
| `.kiro` committed and guarded | Not in `.gitignore`; `submission-guard.yml` fails the build if it is ignored or empty | True, and a nice touch |
| Demo line "AC is 4 cm long." | `frontend/public/samples/triangle.json` facts: `AC = 4 cm`, right angle at C | Matches |
| Gallery images | `docs/media/devpost/` has 10 PNGs and a contact sheet, **untracked**; made by Playwright in Pixel 7 emulation, not on a phone | Not in the repo |
| "Guide and Share off by default" | Flags and Settings switches present | True |
| Sticky line and corner heartbeat "not wired into the app" (`.kiro/steering/tech.md`) | `frontend/src/flow/explore.ts` imports and calls `followTarget` and `heartbeatStep` behind Settings switches; tasks 58b and 59b are still unticked and say "do not start before the owner has felt the beat on a phone" | Steering and tasks contradict the code |

Four Kiro CLI agent configs exist in `.kiro/agents/` (`gt-fixer`, `gt-writer`, `gt-reviewer`, `gt-auditor`) with allow-lists. The write-up does not mention them. That is free credit left on the table.

---

## 4. Claims a judge can challenge, and how to defend or soften each

### 4.1 Numbers

1. **"2,231 frontend tests in 181 files."** Challenge: I count 213 files. Defence: the number is dated ("counted on 2026-11-12"). Better: re-run once and replace everywhere, or stop quoting an exact figure. Proposed wording: "More than 2,500 frontend tests in over 200 files and more than 800 backend tests passed on [date]; the exact counts are in the last BUILD_LOG gate entry." The number appears in README (three places), appendix (two), write-up (two), BLOG and SOCIAL (three).
2. **"834 backend tests."** Challenge: 600 test functions on disk. Defence: parametrized and Hypothesis tests expand at collection. Have the `pytest` summary line saved to `docs/kiro-evidence/` so the answer is one file, not an argument.
3. **"Properties P1 to P136."** Challenge: are there 136 properties? Defence: no, and say it first. Proposed wording: "Properties are numbered up to P136. Some numbers cover a group, and P109 to P113 are specified but not yet tested (task 56)."
4. **"All correctness properties passing" (appendix section 7).** Challenge: there is one `it.fails` (a known speech bug during Ask listening, Requirement 28.7) and one `it.todo` (shared-link decode bound, task 63). Soften to: "All property tests pass. Two known gaps are pinned in the suite as an expected failure and a todo, so they cannot be forgotten."
5. **"Tactile tablet costs about £6,500" and "tactile graphics take weeks."** The demo script marks this row "Verified". Challenge: source? Defence: cite the line in `docs/research/competitors.md` on screen or in the description. If the source is a list price in dollars, quote it in the source's currency. If there is no source for "weeks", say "days to weeks" or attribute it.
6. **"Most students already own a budget Android smartphone."** Challenge: which students, where, what data? Soften to: "Many students have access to an Android phone" unless a source is cited.
7. **"WCAG AAA contrast (7:1 or more)."** Challenge: for which pairs? Defence: `frontend/tests/a11y.contrast.test.ts` checks the token pairs. Say "colour tokens are tested at 7:1 or more", not "the app meets WCAG AAA", which is a whole-standard claim.
8. **"Spec Ghost parses facts on about 35% of scenes (21 of 60)."** This is honest and I like it. Be ready for "so it is silent 65% of the time?" Answer: yes, silent by design when unsure; it never says "verified".
9. **"On 10 Nov the live backend read a clean test triangle in AI mode in about five seconds."** True per `docs/reports/fable-win-plan.md` (5.4 s), but it was a synthetic image, one request. Keep the word "clean test triangle"; never round it into "reads textbook diagrams in five seconds".
10. **Model names.** The appendix names `gemini-3.8-flash`; `render.yaml` sets `gemini-3.5-flash-lite` and `gpt-4.1-mini`. Name only what `render.yaml` sets.

### 4.2 "Tested on a phone"

11. **README: "the owner confirmed on the phone that it is fixed" (S24+ canvas).** The write-up admits "the repo does not record it". A judge who distrusts claims will ask for the video. Defence: put the owner's clip, or a dated one-line note, in `docs/kiro-evidence/`. Until then say "the owner reports".
12. **STEMergent text says "the full app has not been tested on a phone"; the README says the owner ran the installed app on an S24+.** Both are close to true but they read as a contradiction. Proposed single sentence for every document: "The installed app has been run on one phone (Samsung Galaxy S24+), which found and confirmed the fix for one layout bug. No full test pass has been recorded. Haptic timings were tuned on a OnePlus Nord CE6 in the prototype."
13. **Screenshot 01 shows the app's own text "TalkBack & touch ready".** The docs say TalkBack is untested in the full app. The app itself is making the claim the docs refuse to make. Either pass PHONE_TEST step 5 first or have the copy changed (a Kiro or agy task; an owner decision).
14. **`docs/OWNER_TEST_SHEET.md` is blank and says "before Nov 14".** A blank dated sheet in a public repo is evidence against you. Fill it or change its heading to say it is pending.
15. **Sticky line, corner heartbeat, near-line click: values are "PROPOSED, not phone-tested" in `tech.md`.** Fine while they are off by default. Not fine if the video shows them as tuned features. Say "experimental, off by default" on screen.

### 4.3 Kiro use

16. **"Built with Kiro."** The write-up's own table shows Antigravity built the screens, drivers, backend pipeline and redesign. Stage-one reviewers screen for "insufficient use of Kiro". Defence, in this order: (a) every file in `frontend/src/core/` and every property test is Kiro's, and `AGENTS.md` rule 1 forbids other agents from editing them; (b) Kiro wrote the spec before the code for Requirements 19 to 36 (18 says it was after); (c) 89 `kiro:` commits spread from the first week to last night; (d) Kiro reviewed other agents' lanes (`docs/reviews/kiro-*.md`). Lead with a count of Kiro-authored lines or files in `core/` if it can be measured honestly.
17. **"Agent hook running tests on save" in the demo script (2:30 shot), marked "Recorded from Kiro IDE".** No recording exists. Do not narrate it until it has been filmed. If a hook cannot be made to fire, cut the shot and show the spec and a failing-then-passing property instead.
18. **Demo script section 4, item 5: "Kiro authored specs, steering, hooks, pure core..."** The write-up says hook authorship is mixed (agy added three). Soften to "Kiro and Antigravity wrote the hooks".
19. **Four commits authored "Kiro <kiro@ghost-touch.dev>".** A judge may ask whether that identity is real. Answer: it is a label the owner set for early Kiro sessions; the `kiro:` prefix is the reliable signal. The write-up already says this; keep it.
20. **The P1 "flake", P108 and P117.** Three of the Kiro "bugs found" were bugs in Kiro's own test generators. The write-up already demotes P1. Keep P83 (lost saved diagram) as the lead story: it is a real product bug found by a property with a recorded counterexample.

### 4.4 Authorship and process

21. **Commit pattern.** 238 commits on Nov 6, and 314 of 897 are `docs:` commits. A cynical judge reads that as padding the contribution graph. Defence: one commit per report, fix and lane keeps each agent's work traceable. Do not volunteer the count; lead with the `kiro:` prefix and BUILD_LOG.
22. **An outside contributor (2 commits, PR 36).** The team line is still `[FILL]`. Kiroween limits team size and asks who built what. Either list the contributor as a team member with consent, or state "one external pull request was adopted and reworked by Kiro (task 57)".
23. **17 commits carry a "Co-Authored-By: Claude" trailer; the rest of Claude Code's work does not.** Inconsistent, not dishonest. If asked: Claude Code's role is logged in BUILD_LOG, not in trailers.
24. **Three Kiro CLI runs used `--trust-all-tools`** (BUILD_LOG 2026-11-12 disclosure) and agy has an `AGY_DANGEROUS=1` opt-in. Already disclosed. Keep it; a judge who finds it disclosed is reassured.

### 4.5 Product claims

25. **"Never leaves the student with nothing."** Raw Mode on a photo with printed labels traces the text too (`docs/media/devpost/README.md`, shot 06). Soften to "always gives the student outlines to follow, even if rough".
26. **"Answers come from the diagram's own facts, without hallucination."** Non-semantic questions go to an LLM. Say "geometry questions are answered by code; other questions go to the model with the facts, and it is told to say 'I don't know from this diagram'".
27. **"Works offline."** True for the three samples and saved diagrams; a new photo needs the server. Say exactly that.
28. **"Stateless, never stored on disk" privacy claim.** Images are sent to OpenAI or Google. `docs/PRIVACY.md` covers it; the one-line versions should add "images are sent to the AI provider".
29. **"Hindi and Gujarati."** Machine-translated and said so. Good. Do not show the Hindi screenshot first.

---

## 5. Q&A a judge will ask, with prepared answers

**Q1. Has a blind student used this?**
"No. Nobody in the target group has used it yet. We have a consent script, a task sheet and a facilitator checklist in `docs/user-test/`, and a planned session with the Blind People's Association in Ahmedabad. We chose not to write a quote before one exists."

**Q2. Then how do you know it works for them?**
"We do not know yet. What we know: the vibration timings were tuned by hand on a real phone, the TalkBack pass-through gesture worked on our prototype, and the touch logic is covered by property tests. The next step is a real session, and the design will change after it."

**Q3. You say 'built with Kiro' but another agent wrote the screens. Why should this count?**
"Kiro's credits ran out on day four. We kept Kiro in the role only it had: it owns the spec, every pure-core module and every property test, and other agents are forbidden from editing those files. They had to make Kiro's tests pass. The write-up says which tool built each part, and the build log names the tool on every entry."

**Q4. Show me a hook firing.**
Today the honest answer is "we have nine hooks defined and their patterns are tested, but we have not captured one firing". That answer loses points. Fix it before Dec 5 (section 7, item 3).

**Q5. Did property-based testing find a real bug, or only test bugs?**
"Both, and we list both. Real: a failed save could delete an older saved diagram (P83, counterexample in the build log). Real: four defects in Kiro's own saved-diagram draft, found by another agent's properties. Test-side: three flaky generators, which we fixed and then removed luck from the suite (task 62)."

**Q6. Why not just describe the image aloud?**
"A paragraph cannot tell you where a line turns or how steep a curve is. Tracing gives the shape; the voice gives the labels and numbers."

**Q7. A phone has one motor. How can a finger find a thin line?**
"A 14 px line radius, a 22 px corner radius that wins over lines, a spoken overview on entry, a near-line click that speeds up as you approach, and an optional 'stay on line' mode. The last two are new and not yet tuned on a phone; they are off or marked proposed."

**Q8. What happens when the AI is wrong?**
"Every response is validated against a schema and retried once. If it still fails, classical edge detection gives outlines. A consistency check compares printed facts with the drawing and says when they disagree. A sighted teacher can correct points and labels."

**Q9. How accurate is it on real textbook photos?**
"Not measured. We have a synthetic benchmark only. We will not quote a percentage until we have real photos."

**Q10. Why Android only?**
"iOS Safari has no vibration API. On iPhone and laptop the app plays an audible buzz so it can be judged, but the product is Android."

**Q11. Your tests say 2,231 here and 2,700 there.**
"The lower number was counted on Nov 12. The suite grew. The last gate entry in the build log has the current count." (Better: fix the docs so this is never asked.)

**Q12. Your steering file says the heartbeat is 'not wired' but the code wires it.**
There is no good answer today. Fix the steering row and tick or reword tasks 58b and 59b (a Kiro task, since `.kiro/` is Kiro-owned).

**Q13. Is the Halloween theme appropriate for a disability tool?**
"The spooky part is the stitched machine. The rules in `product.md` and the demo script ban darkness jokes and any trope about blindness."

**Q14. What does it cost to run?**
"Free tiers: Vercel, Render, and a small per-image model cost. The Render free tier sleeps, so the first photo can take 30 to 60 seconds; samples need no server."

**Q15. Who is on the team and who wrote which commits?**
Have the team line filled and the external pull request explained (item 22).

---

## 6. Does the demo script match the product today?

| Script shot | Product today | Action |
|---|---|---|
| 0:00 hook: line hum, double pulse, "C" | Matches the sample triangle (right angle at C). Corner speech and line-name dwell were re-specified on Nov 16 (tasks 55 to 57); check what is actually spoken at a corner now | Re-watch on the phone before filming |
| 0:45 real textbook photo | Never done on a phone; `research/samples/real/` holds no measured set | Rehearse; keep the sample as the fallback take |
| 1:20 Ask "How long is AC?" gives "AC is 4 cm long." | Matches fixture; live check on Nov 10 gave this answer | Fine; typed Ask as backup |
| 1:40 sine and bars | Graph scan, curve-beats-axis and height-at-x landed Nov 15; the script does not use them | Optional 5 s: one graph-scan sweep is a strong audio moment |
| 2:00 TalkBack | Still prototype-only | Do not film as "works" until PHONE_TEST step 5 passes |
| 2:15 Raw Mode | Works by code; output on labelled photos is noisy | Pick a photo without printed text |
| 2:30 Kiro screen | No hook recording exists | Film it or cut it |
| not in script | Corner compass, where-am-I, near-line click, page-edge cue, speech pacing, Stay-on-line switch, corner heartbeat | Mention at most one, labelled experimental; none are phone-tested |

Other mismatches:
- No submission document mentions heartbeat, compass, graph scan, pacing, sticky lines, the page-edge cue or where-am-I. That is acceptable for honesty (they are unverified) but the README "How it feels" list is now incomplete. One line, "Experimental, off by default: ...", is enough.
- `CLAUDE.md` section 8 still says "corner B" and section 6 says AB = 3 cm; the fixture has the right angle at C and AB = 5 cm. Internal only, but a judge browsing the repo may see it.
- `README.md` "Project structure" does not list `.kiro/agents/`.

---

## 7. Cheapest changes that raise the score most (ranked)

Effort is the owner's time unless noted. "Kiro task" means the change touches Kiro-owned files and should be done by Kiro to keep the builder story clean.

| # | Change | Effort | Raises | Why it ranks here |
|---|---|---|---|---|
| 1 | Record the under-3-minute video on a real Android phone using the three samples, with captions | 3 h | Polish +2, Impact +1 | Required by Kiroween; nothing else moves as many criteria |
| 2 | One recorded phone pass of PHONE_TEST steps 0 to 8, results written into `docs/OWNER_TEST_SHEET.md` (PASS, FAIL or NOT DONE) | 1.5 h | Honesty +0.5, Polish +1 | Turns "pending" into evidence; FAIL rows are also good evidence |
| 3 | Open the repo in the Kiro IDE, save a file in `frontend/src/core/`, screenshot the hooks panel and one hook run, save to `docs/kiro-evidence/` | 20 min | Kiro +1 | Closes the oldest open evidence gap (task 21.4) |
| 4 | Refresh every stale number in one pass: README, appendix, write-up, BLOG, SOCIAL (tests, commits, `kiro:` count, requirements, properties, tasks) | 30 min, docs lane | Honesty +0.5, Kiro +0.5 | The true numbers are larger than the claimed ones |
| 5 | Fix the steering and task contradiction: `tech.md` rows that say "not wired", tasks 58b and 59b | 15 min, Kiro task | Kiro +0.5 | A judge who reads `.kiro/` closely will find it |
| 6 | Fill or remove every `[FILL]`, `[OWNER]` and `[HW]` marker; delete the "draft for the owner" banners from submitted text | 30 min | Polish +1 | Markers in a submission read as unfinished |
| 7 | One session with one blind or low-vision person, with consent, and three plain sentences about what happened (including what failed) | half a day | Impact +2 | The only way past 7 on impact |
| 8 | Add the four Kiro CLI agents and the Nov 15 to 16 Kiro work (compass, near-line click, curve height, sticky, heartbeat, ingress guard, chaos property P132 to P136, flake census) to the write-up | 20 min, docs lane | Kiro +0.5 | Real Kiro work the write-up does not claim yet |
| 9 | Write the vibe-coding paragraph (the `[OWNER]` slot in write-up section 1) in the owner's own words | 15 min | Kiro +0.5 | The write-up template asks for it |
| 10 | Commit `docs/media/devpost/` or upload the images to Devpost with the captions as alt text; state "captured in phone emulation" | 15 min, owner decision to commit | Polish +0.5 | Ten good images are sitting untracked |
| 11 | Build the small MCP server already planned (W15: `validate_scene`, `raw_outline`), use it once, record it | 2 to 3 h, Kiro task | Kiro +0.5 to 1 | Only if items 1 to 7 are done; otherwise keep the honest "none" |
| 12 | Resolve the "TalkBack & touch ready" start-screen copy against the test result | 10 min decision | Honesty +0.25 | Removes the one place the app overclaims |
| 13 | Shorten the README "Built with" table: one sentence per tool, link to the write-up | 15 min, docs lane | Polish +0.25, accessibility of the submission | Three cells of several hundred words each are unreadable by eye and by screen reader |
| 14 | Save one `pytest` and one `vitest` summary line, dated, to `docs/kiro-evidence/` | 5 min | Honesty +0.25 | Ends every argument about counts |
| 15 | Fill the team line and explain the external pull request | 5 min | Removes a disqualification question | Rules compliance |

If only one day is available: items 1, 2, 3, 4, 6. That moves the overall score from about 7.2 to about 8.

---

## 8. Proposed wording (the owner's text is not edited; copy what helps)

**Test counts, one sentence for every document:**
> "On [date], [N] frontend tests in [N] files and [N] backend tests passed, including property-based tests with fast-check and Hypothesis. The exact run is recorded in `docs/BUILD_LOG.md`."

**Phone status, one sentence for every document:**
> "The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype."

**Kiro write-up, replacement for the stale counts paragraph:**
> "Counted in `.kiro/specs/ghost-touch/` on [date]: 36 requirements with EARS acceptance criteria, properties numbered up to P136 (some numbers cover a group; P109 to P113 are specified and not yet tested), and 66 tasks. Of 897 commits, 89 carry the `kiro:` prefix. Git authorship does not separate the tools; the build log does."

**Kiro write-up, one added paragraph on agents:**
> "Kiro CLI runs use four agent configurations in `.kiro/agents/`: a fixer, a docs writer, a read-only reviewer and a read-only auditor. Each has an allow-list of commands and paths. Three early runs used `--trust-all-tools`; that is disclosed in the build log, and every run since has used an allow-listed agent."

**README, one line for the new Explore features:**
> "Experimental, off by default or awaiting a phone test: a corner compass, a where-am-I cue, a near-line click that speeds up as the finger approaches a line, a graph scan, a 'stay on line' mode and a corner heartbeat. Their values are proposals, not tuned."

**Why this counts as a Kiro project (for the Devpost "how we used Kiro" box):**
> "Kiro wrote the specification, the pure touch and haptic core, and the property tests. When Kiro's credits ran out, other agents built screens and backend plumbing from written briefs, but they were not allowed to edit Kiro's core or its tests. Kiro then reviewed their work and wrote failing tests for the bugs it found. We call this 'Kiro as specifier and judge'. The write-up lists what Kiro did not build."

**Demo narration for the 2:30 shot, if no hook recording exists:**
> "Thirty-six requirements, written before the code. A property test fails, the fix lands, it passes."

**Raw Mode line:**
> "If the AI cannot read the picture, the student still gets outlines to follow."

**Cost line, if the source supports it:**
> "A refreshable tactile tablet costs thousands; the Dot Pad lists at about [price, currency, source]."

---

## 9. Accessibility of the submission itself

A project for blind students will be read by at least one judge using a screen reader, and should expect it.

- **README heading has an emoji.** A screen reader reads "Ghost Touch ghost". Harmless, slightly noisy.
- **README "Built with" table** has three cells of several hundred words with `<br>` line breaks. A screen reader reads each as one unbroken cell. Use a short list (item 13).
- **Screenshot table**: alt text exists ("Start screen", "Capture screen"). Make each alt say what is on the screen, for example "Start screen: one large button, Wake the creature".
- **Appendix status table**: two columns of long paragraphs. Fine as an appendix; do not paste it into Devpost.
- **Video**: add captions, and speak what the phone is doing ("the phone is vibrating now") because a blind judge cannot see the pulse ring and no viewer can feel the motor. The script's five silent seconds at the start need a caption such as "[phone vibrates along the line]".
- **Devpost gallery**: paste the captions from `docs/media/devpost/README.md` as image descriptions.
- **Plain words**: the short STEMergent text is clear. The appendix and README still use lane ids (k1, q1, m3) that mean nothing to an outsider.

## 10. Ethics and AI-tool disclosure

Good:
- Every AI tool is named with its role: Gemini and OpenAI at run time, Kiro, Antigravity and Claude Code at build time.
- The write-up says what Kiro did not build. The build log names a tool per entry.
- A consent script exists before any user session; the demo script forbids faces without consent and forbids fake student footage.
- Machine translation is disclosed everywhere it is mentioned.

To tighten:
- The short STEMergent text says images are read by Gemini and OpenAI but not that a student's photo leaves the phone. Add "photos are sent to the AI provider and are not stored by us".
- State once, in the Kiroween description, that planning and review were done by Claude Code and building by Antigravity. It is in the README; it must also be in the Devpost form, because judges may not open the repo.
- The contribution-graph commit style is a choice the owner should be ready to explain (item 21).

## 11. Disqualification risk for "insufficient use of Kiro"

My estimate as a stage-one screener: **low to moderate, and lower than a week ago.**

In favour:
- `.kiro/` is committed, large and current (specs 1,917 lines, 5 steering files, 9 hooks, 4 agents), and CI guards it.
- `kiro:` commits run from the start to the last day, including new pure-core modules and properties on Nov 15 and 16.
- The ownership rule in `AGENTS.md` is a real, checkable mechanism, not a claim.
- Kiro reviews of other agents' lanes exist as files.

Against:
- The write-up's first bold sentence is "Kiro did not build most of the app". A screener skimming 60 entries may stop there. Keep the honesty, change the order: lead with what Kiro did build (the whole core and its tests), then say what it did not.
- 89 of 897 commits (10%) carry the Kiro prefix.
- No hook has been shown firing; no MCP; no vibe-coding account. Three of the five write-up headings are thin.
- Kiro's credits ran out on day four; the build log says so. This is a fair reason and should be stated once, plainly, with the date credits returned.

The two cheapest mitigations are items 3 and 8 in section 7.

## 12. What I could not check

- Whether CI, CodeQL and Gitleaks badges are green on GitHub.
- Whether the live site serves `a82f7bf`, and how it behaves on any device.
- Whether the STEMergent form was submitted before Nov 16, 09:00 IST, and with which text.
- The real pytest collection count.
- The official 2026 rubrics for either event (the win plan could not confirm them either).
- The content of the screenshots beyond their README.

## 13. Decisions that need the owner

1. Was STEMergent submitted, and with which numbers? If yes, keep the repo consistent with what was sent.
2. Commit `docs/media/devpost/` or keep it local and upload only to Devpost.
3. List the external contributor on the team, or describe the adopted pull request.
4. Change or keep the "TalkBack & touch ready" start-screen text.
5. Build the MCP server or keep the honest "none".
6. Which of the Nov 15 and 16 features, if any, appear in the video.
