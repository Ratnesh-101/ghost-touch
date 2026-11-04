# Lane T16: Submission package, round 2 (docs only)

## Allowed files
`docs/KIRO_WRITEUP.md`, `docs/BLOG.md` (new), `docs/SOCIAL.md` (new), `docs/DEMO_SCRIPT.md`, `docs/STEMERGENT_SUBMISSION.md`, `docs/reports/agy-docs2-report.md`

## Forbidden
Everything else (code, `.kiro/**`, BUILD_LOG, handoff files). No contact details of any person or organisation. Do not invent results, quotes, user-test outcomes, URLs or numbers.

## Read first
`docs/BUILD_LOG.md`, `docs/handoffs/for-kiro.md`, `docs/kiro-evidence/*.md` (Kiro's own per-step evidence notes: step1-p1-fix, step2-haptic-engine, step4-validator, step5-req13, step6-hooks, pbt-p1-flake, hooks-check), `.kiro/hooks/*.json` (there are now FIVE hooks, two added by Kiro), `.kiro/specs/ghost-touch/design.md` (properties P1 to P17), `docs/reviews/agy-*.md`.

## Do
1. **KIRO_WRITEUP.md, correct and extend, honestly.** (a) The P1 generator fix was made by **Kiro** on 2026-11-03: say so, quoting its evidence note (the four fixes and its seed-replay verification), and remove the sentence saying attribution is only in the git history. (b) Update the hooks section to all five hooks, using each file's real name, trigger, matcher and command; for the two Kiro added (`prop-tests-on-save`, `review-on-stop`) read the files and Kiro's step6 evidence. (c) Properties: P1 to P13 as before; add P14 and P15 (saved diagrams, Kiro's spec) and P16 and P17 (Teacher Correct mode). State plainly that P16 and P17, `core/correct.ts` and the validate endpoint were written by Antigravity at the owner's request after Kiro's credits ran out, NOT by Kiro; and that Task 13's spec and first draft are Kiro's while its completion is agent work (check the T13 reviews in `docs/reviews/` if present, otherwise say it is in progress). (d) Add a short "What Kiro did vs what agents did" table built only from BUILD_LOG and the evidence files. (e) Update test counts from the latest BUILD_LOG entry or leave them as a `[FILL: run counts on submission day]` marker.
2. **BLOG.md** (about 600 words, first person plural, plain and honest): the problem (diagrams lock blind students out of STEM), the Frankenstein stitch (cheap buzzer plus vision AI plus theremin), what is built, how Kiro was used (specs, steering, hooks, property tests, the P1 story), what is not yet tested (a phone and real students), and the line "Built for Kiroween 2026" with the `#KiroweenHackathon26` tag. No fabricated user feedback.
3. **SOCIAL.md**: three post drafts (short, medium, thread of 4) that start with `#KiroweenHackathon26`, each with `[FILL: video URL]` and `[FILL: repo or live URL]` markers.
4. **DEMO_SCRIPT.md / STEMERGENT_SUBMISSION.md**: add only facts that are now true (Teacher Correct mode exists, accessibility pass and mascot, Hindi and Gujarati voices, voice commands, deploy checklist). Leave every owner-only `[FILL]`.

## Done
Files consistent with each other; no unsupported claim; the report lists every remaining `[FILL]` and every claim you verified against a file. The report ends with a section **"Commit groups"**: an ordered list of logical commits (conventional message plus exact files each), for example one per document, so the reviewer can commit them separately.

## Shared rules
Read AGENTS.md first. No git state changes (you cannot run git add, commit or push), no `.env` access. Run any allowed command for real and record true results.
