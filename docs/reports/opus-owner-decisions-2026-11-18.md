# Owner decisions, ruled on the owner's behalf (2026-11-18)

Author: Claude Code (Opus 5.5), read-only except this file. Source: `docs/reports/fable-project-improvement-report.md` section (e) (12 decisions) and `docs/reviews/kiro-owner-decisions.md` (OD-1 to OD-3). Every ruling was checked against the repo at `4b62f1c` (main, 2026-11-18). Not redone here: task 63.4 share decoder (already NO-GO) and the P1/P2 backlog decision.

How to read: `RULING` is the choice. `OWNER-CONFIRM` appears only where the ruling is outward-facing, costs money, or changes what real students get in production; the owner can veto those in one line. Everything else goes ahead unless the owner objects. Rule of thumb used throughout: honest, reversible, cheapest in owner time, and no new untested cue before Dec 5 (report ruling 1).

What changed since the report was written (checked in code): decision 3 is already applied (ux4); the page-edge cue already speaks only, with no earcon (ux2); the Explorer preset ships, and its hint says "experimental"; Correct is still passed to every user (`App.tsx:779`); the near-line click still pans fully (`core/proximity.ts:110-114`) and is not muted under speech; "Finding sound" and "Directions" are still on by default (`core/presets.ts`, `standard`).

---

## D1 · Was STEMergent submitted, and with which numbers?

`RULING:` Only the owner knows. Until they say otherwise, treat it as **submitted** and freeze the text: do no more rewrites of `docs/STEMERGENT_SUBMISSION.md` or `docs/STEMERGENT_APPENDIX.md`, apart from one honesty banner.
Reasoning: lane ux6 (`0541b81`) edited both files on 2026-11-17, after the Nov 16 09:00 deadline. So the repo copy may no longer match what a judge has. If we assume it was not submitted and keep editing, the repo drifts further from the real entry, and a judge comparing the two sees numbers that disagree. If we assume it was submitted and it was not, nothing is lost: a late entry is not possible anyway.
REVERSIBLE: yes.
Action (Claude Code docs edit, after the owner answers or by Nov 20): replace line 1 of `docs/STEMERGENT_SUBMISSION.md` and add the same sentence under the title of `docs/STEMERGENT_APPENDIX.md`.
- If submitted: `# STEMergent submission (as submitted on 2026-11-[DD]; the repository copy was edited on 2026-11-17 and its numbers are newer than the entry's)`
- If not submitted, or unknown: `# STEMergent submission (not submitted; kept as a working draft, last edited 2026-11-17, after the Nov 16 deadline)`
Kiroween text then lives only in README, `KIRO_WRITEUP.md` and Devpost, never in the STEMergent files.
`OWNER-CONFIRM` (the banner describes something already sent, if it was).

## D2 · Which new cues appear in the video

`RULING:` Show the tuned cues (line buzz, corner double pulse with the spoken label, theremin), plus corner directions, because they are on by default. Show graph scan once, captioned "Graph scan (experimental, values not tuned)". Do not show finding sound, stay on line, corner heartbeat, Guide, Share or the Explorer preset.
Reasoning: anything that is on by default will be in the video whether we plan it or not, so it needs a caption. The rest are untested values, and the video is the only evidence a judge feels. If graph scan sounds wrong on the phone, cut that shot; it is less than 10 seconds.
REVERSIBLE: yes, until the upload.
Action (owner films; Claude Code updates `docs/DEMO_SCRIPT.md` shot list to match). Caption text for the graph shot: `Graph scan: an experimental tone; its values are proposals, not tuned on a phone.`

## D3 · Start-screen wording replacing "TalkBack & touch ready"

`RULING:` Keep "Touch, sound and speech". It is already live (`i18n/index.ts:272`, lane ux4).
Reasoning: it claims only what the code does. Nothing to do.
REVERSIBLE: yes. Action: none.

## D4 · Near-line click: limit pan to about 0.4, mute clicks under speech

`RULING:` **Yes to both.** Maximum pan 0.4 (either side), and no click while speech is playing.
Reasoning: at full pan the click can disappear in a single earbud, and clicks over the overview bury the speech. Both changes reduce an already-PROPOSED cue; neither touches a tuned value. If 0.4 turns out too narrow to steer by, it is a one-constant change.
REVERSIBLE: yes.
Action (Kiro, in core plus one Explore check): in `core/proximity.ts` add `maxPan: 0.4` to `DEFAULT_PROXIMITY`, have `clickPan` return a value inside ±`maxPan`, and drop click effects while `speech.speaking` is true. Add a property: |pan| ≤ maxPan for every input. Append to the near-line row in `tech.md`: `Pan limited to ±0.4 and no click while speech plays (owner ruling 2026-11-18); still proposed, not phone-tested.`

## D5 · Centre word and 25 ms tick

`RULING:` **Keep both on for everyone, with no switch**, and make the docs say what the code does.
Reasoning: the tick fires only within 24 px of the canvas centre, and "Centre." is spoken at most once per session (Req 13.3). The cost in unasked speech is one word, and taking it out would need a serialized Explore lane. The real problem is the docs. `DEMO_SCRIPT.md:59` promises a tick on every re-anchor, which is false, and the `tech.md` row says "on hold start at centre", which describes the old relative cursor.
REVERSIBLE: yes.
Action:
- Kiro rewrites `tech.md` row 28 as: `| Centre reference tick (approved by owner 2026-11-18 as a landmark; not phone-tested) | vibrate(25) | one 25 ms pulse, distinct from line and corner patterns; fires when the finger is within 24 CSS px of the canvas centre, re-arms after 36 px; "Centre." spoken once per Explore visit (Req 13.3) |`
- Claude Code replaces the recovery cell at `DEMO_SCRIPT.md:59` with: `**Recovery:** Lift the finger completely, then double-tap, hold on the second tap and drag again. If you touch near the middle of the diagram, a short 25 ms tick marks the centre.`

## D6 · Correct button behind Teacher tools; Teacher tools without `VITE_FEATURE_SHARE`?

`RULING:` **Gate Correct behind Teacher tools (yes). Leave Teacher tools tied to `VITE_FEATURE_SHARE` (no decoupling for now).**
Reasoning: a blind student who lands in an editor they cannot see, and overwrites the teacher's corrections, is a real harm. Hiding the button is a one-line change: pass `onCorrect` only when `isTeacherActive()`. The production bundle is already built with `VITE_FEATURE_SHARE=1` (fable-win-plan row 5), so decoupling the flag would change nothing for the live site and would cost a lane. Risk if wrong: a teacher cannot find Correct. `DEPLOY.md:248` and the teacher guide already say to turn on Teacher tools.
REVERSIBLE: yes.
Action (Kiro): in `App.tsx`, change `onCorrect={handleCorrect}` to `onCorrect={isTeacherActive() ? handleCorrect : undefined}`, and add a test that Correct is absent with Teacher tools off. Also confirm the 10-teacher-editor screenshot caption still says "switched on in Settings". Owner checks that Vercel still has `VITE_FEATURE_SHARE=1`.
`OWNER-CONFIRM` (it removes a visible button for real students in production).

## D7 · Classroom limits for Render, and provider order

`RULING:` Set scenes to **60 per minute per address** and per-client in-flight to **8** for both scene and Ask. Keep global `SCENE_MAX_CONCURRENCY` at 2, which suits the free instance's memory. Keep the **provider order `openai,gemini,nebius`**, and record it as the decision. The owner sets a hard monthly spend cap on OpenAI.
Reasoning: one school router means one address, so at 20 per minute and 2 in flight about two of thirty students get a diagram. Since the global cap of 2 still applies, raising the per-client cap only stops one address from being starved below that cap. Switching to Gemini first nine days before the freeze would change answer quality without a test; free-tier Gemini rate limits during a live demo are a known risk (CLAUDE.md section 9). The spend cap at the provider console is the real ceiling, not `PAID_CALLS_PER_DAY`.
REVERSIBLE: yes. Env values and order can be changed in the Render dashboard in a minute.
Action: Claude Code edits `render.yaml`: `RATE_LIMIT_SCENE_PER_MIN: "60"`, `SCENE_CLIENT_MAX_CONCURRENCY: "8"`, `ASK_CLIENT_MAX_CONCURRENCY: "8"`. Nothing else changes. Owner, in the OpenAI dashboard: project budget hard limit **USD 10 per month** with an email alert at USD 5. Gemini stays on the free tier (no billing). Then check that the Render deploy picked up the change.
`OWNER-CONFIRM` (spend cap, plus a production config change that triggers a deploy).

## D8 · Dedicated page-edge earcon later, or speech only

`RULING:` **Speech only, through Kiroween.** Revisit a PROPOSED earcon only after Dec 5, and only if phone testers say the edge sentence is too slow.
Reasoning: the speech-only edge already shipped (ux2), so this costs nothing. A new sound is a new untested value, which report ruling 1 forbids before Dec 5.
REVERSIBLE: yes. Action: none now; Kiro notes "speech only, owner ruling 2026-11-18" in the page-edge task.

## D9 · "Show me" highlight on by default

`RULING:` **Yes, on by default, no switch, if it lands.** It is not built yet (I29). Kiro builds it only after D4, D6 and OD-2 are done, and drops it if it is not merged by **Nov 28**.
Reasoning: it is visual only, harmless to blind users, and makes the video readable. It is still optional work. Whatever happens, no doc may say "low vision" until one low-vision person has tried it (report ruling 10).
REVERSIBLE: yes. Action (Kiro): requirement plus a property; no tuned values touched.

## D10 · Local photo keeping for teachers (opt-in) and the PRIVACY.md change

`RULING:` **Not before Kiroween.** PRIVACY.md stays as it is ("photo not stored").
Reasoning: these are photos of minors' textbooks on shared phones. The change needs a saved-model change, a consent screen and a privacy rewrite, about a day of work that the owner cannot review well during exams. The pinned saved diagrams already cover next-morning use.
REVERSIBLE: yes (deferred, not refused). Action: none; Kiro marks I36 "after Dec 5".

## D11 · Commit `docs/media/devpost/` or upload only; credit for outside PR 36

`RULING (media):` Upload to Devpost only. **Do not commit the ten PNGs** (9.8 MB, captured Nov 12, before presets and the ux lanes, so they are stale). Commit `docs/media/devpost/README.md` and `scripts/devpost-shots.mjs`, so the shots can be reproduced. Re-run the script after the D4 and D6 merges and upload fresh images.
`RULING (PR 36):` **Credit the contributor by GitHub handle** in README, with this text: `The TalkBack guide started from an outside contribution (PR #36 by <handle>); we adopted and corrected it in lane bu10.`
Reasoning: binary files in git history are permanent, and stale screenshots contradict the app. Naming the contributor is honest, and the BUILD_LOG already says the guide was "adopted from outside PR 36".
REVERSIBLE: media yes. The credit line is public once pushed.
Action: Claude Code commits the two text files when the owner says commit. Claude Code adds the credit line under a README "Acknowledgements" heading after the owner confirms the handle.
`OWNER-CONFIRM` (names a third party publicly).

## D12 · Explorer preset: hidden, or shown as experimental

`RULING:` **Keep it shown as it is now.** The hint already reads "Everything, including experimental stay-on-line and corner heartbeat", and TalkBack reads it through `aria-describedby`. Do not pick it on first run (the default stays Standard), and keep it out of the video.
Reasoning: hiding it would take a lane, and testers need to reach it (TEAM_PHONE_TEST_PROMPT Part C times Simple, Standard and Explorer).
REVERSIBLE: yes. Action: none.

---

## Older open decisions (docs/reviews/kiro-owner-decisions.md)

### OD-1 · Cursor start on a new hold (Req 13.3)

`RULING:` **(a) Keep absolute touch.** Req 13.3 as reworded is final.
Reasoning: this is what the code, the tests and the TalkBack guide already do. A relative cursor would be a gesture-model rewrite and would need a TalkBack retest that there is no time for.
REVERSIBLE: yes. Action (Kiro): in 13.3 replace the parenthetical with `(decided by the owner 2026-11-18, OD-1: absolute touch)`; fix the stale "relative cursor" header comment in `Explore.tsx`; mark OD-1 "Decided 2026-11-18: (a)" in `kiro-owner-decisions.md`.

### OD-2 · "Finding sound" on by default?

`RULING:` **(c) Ship it OFF in Standard now. Turn it on in Standard only after the teammate phone test reports that the click (with D4 applied) can be told apart from the theremin, on the speaker and on one earbud.**
Reasoning: the gain is 2 to 4 times the theremin's, nobody has heard it on a phone, and it runs for every real student. A loud, unexplained click on first use costs more trust than a missing rescue cue. Explorer keeps it on for testers. If the test passes before Nov 28, flipping it back is one value.
REVERSIBLE: yes.
Action (Kiro): `PRESETS.standard.findingSound = false`, the stored-switch default to false, update Req 44.3's note and the oracle tests; README line 48 already lists it as experimental. Claude Code adds to README "Try it": nothing (the steps never mention it).
`OWNER-CONFIRM` (it changes a production default for real students).

### OD-3 · Directions default and the demo audio

`RULING:` **(a) Keep Directions on**, and update the docs to say so.
Reasoning: report ruling 3 says the turn at a corner is where a blind tracer gets lost, and both Simple and Standard already keep it on. Turning it off for the video would make the demo differ from the live app.
REVERSIBLE: yes.
Action (Claude Code docs edit): replace README step 3 with: `3. On an **Android phone in Chrome**, drag a finger along a line to feel continuous vibration. At a corner the phone gives a double pulse, says the corner's label and which way its edges go (at C: up to A, right to B). Directions can be switched off in Settings.` In `DEMO_SCRIPT.md` row 0:00, change `speaks "C"` to `speaks "C" and the directions of its two edges`. The owner confirms the exact words on the phone before filming.

---

## Summary

| # | Decision | Ruling | Reversible | Owner-confirm |
|---|---|---|---|---|
| D1 | STEMergent submitted? | Assume submitted; freeze; add a dated banner | yes | **yes** |
| D2 | Cues in the video | Tuned cues + directions + graph scan captioned experimental | yes | no |
| D3 | Start wording | "Touch, sound and speech" (already live) | yes | no |
| D4 | Click pan / mute | Pan ±0.4, no click under speech (Kiro) | yes | no |
| D5 | Centre word and tick | Keep on; fix tech.md row and DEMO_SCRIPT:59 | yes | no |
| D6 | Correct gating | Behind Teacher tools; flag coupling unchanged | yes | **yes** |
| D7 | Limits and providers | Scenes 60/min, client in-flight 8; keep openai first; USD 10 cap | yes | **yes** |
| D8 | Page-edge earcon | Speech only through Kiroween | yes | no |
| D9 | Show-me highlight | On by default if merged by Nov 28; else drop | yes | no |
| D10 | Local photo keeping | Not before Dec 5; PRIVACY unchanged | yes | no |
| D11 | Devpost media / PR 36 | Upload only, commit README + script; credit by handle | media yes, credit public | **yes** |
| D12 | Explorer preset | Shown, as now (hint says experimental) | yes | no |
| OD-1 | Cursor start | Absolute touch, final | yes | no |
| OD-2 | Finding sound default | Off in Standard until the phone test passes | yes | **yes** |
| OD-3 | Directions default | On; update README step 3 and the demo row | yes | no |

## The owner's five jobs, in priority order (Nov 18 to Dec 5)

1. **By Nov 19 (15 min):** answer D1 in one line (submitted: yes/no, and the date). Veto any `OWNER-CONFIRM` ruling you disagree with. Set the OpenAI USD 10 hard cap. Check that Vercel still has `VITE_FEATURE_SHARE=1` and that Render is deploying from main.
2. **By Nov 24:** send `docs/TEAM_PHONE_TEST_PROMPT.md` to the teammate, and do your own 20-minute eyes-closed pass on the Nord CE6. Record it in `docs/OWNER_TEST_SHEET.md`; its PASS/FAIL decides OD-2 and the D2 graph shot. If a blind or low-vision person can try it, with consent, write three plain sentences about what happened.
3. **By Nov 26:** in the Kiro IDE, save a file in `frontend/src/core/` so a hook fires. Put the screenshot in `docs/kiro-evidence/`, with the dated `vitest` and `pytest` summary lines (task 21.4). Otherwise cut the hooks claim.
4. **By Dec 1 (feature freeze Nov 30):** record the video, under 3 minutes, on the real phone, with captions saying what the motor does (D2 shot list). Re-run `scripts/devpost-shots.mjs` and upload the images.
5. **By Dec 3 (deadline Dec 5, 03:30 IST):** fill every `[FILL]`, `[OWNER]` and `[HW]` slot, the team line and the vibe-coding paragraph, and remove the draft banners. Then submit on Devpost. Keep Dec 4 as a buffer only.
