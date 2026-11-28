# WA-A6: Kiro visibility audit

Read-only audit. Read: CLAUDE.md, `.kiro/steering/*.md`, `submission/devpost_description.md`, `submission/demo_script.md`, `submission/built_with.txt`, `submission/checklist.md`, `submission/stemergent_extras.md`, `README.md`, `docs/DEMO_SCRIPT.md`, `.gitignore`. Nothing was edited, built or committed. No secrets were opened.

Note: the `submission/` folder has no file named `README` or description other than `devpost_description.md`. I treated that as "the description". `docs/DEMO_SCRIPT.md` (2:55, Kiro shot at the very end) and `submission/demo_script.md` (2:50, Kiro from 1:20) disagree. The checklist (`submission/checklist.md:40`) points to `docs/DEMO_SCRIPT.md`, so the weaker one is the one the owner is told to follow.

## Presence checks

| Check | Result | Evidence |
|---|---|---|
| Kiro named in description | Pass | `devpost_description.md:36-51` has a full "How we used Kiro" section; `:79` repeats it under Team |
| Kiro in Built With | Pass | `built_with.txt:1` lists "Kiro (specs, hooks, steering, custom agents)" first |
| Kiro in demo | Pass, but weak in `docs/DEMO_SCRIPT.md` | `submission/demo_script.md:24-27` gives about 85 s of Kiro (1:20 to 2:40). `docs/DEMO_SCRIPT.md:46` gives 15 s at 2:30 and says "film only if recorded evidence exists" |
| `/.kiro` not gitignored | Pass | `.gitignore` has no `.kiro` rule, only the comment "MUST stay committed". `git check-ignore` returned nothing. `git ls-files .kiro` lists 22 tracked files |
| `.kiro` contents match the claims | Pass | 9 hooks, 4 agents, 5 steering files, `specs/ghost-touch/` all exist on disk, as listed in `devpost_description.md:44-49` |

## Scores (0 to 5)

| Criterion | Score | Why |
|---|---|---|
| 1. Would not exist before Kiro, Kiro drove the build | 3 | Strong artefacts (spec with 53 requirements, hooks, agents, steering, Requirement 53 spec-first story). Weakened by the README and Devpost saying the app was built by three tools, by 1,021 commits of which 126 carry the `kiro:` prefix (about 12%), and by `docs/DEMO_SCRIPT.md` showing Kiro for 15 s. A judge can read "Kiro wrote the core, other tools wrote the screens" as Kiro being a side tool |
| 2. Mischief that still tells the user what to tap next | 2 | The idea exists (Ghost Host, Requirement 53: clumsy creature, one-line next step, 25-word limit). It appears in `devpost_description.md:42` and the `submission/demo_script.md` Requirement 53 shot, but is missing from the README feature list and from `docs/DEMO_SCRIPT.md`. No file shows the creature's voice and the "next step" line on screen or in audio. The Devpost demo slot is a placeholder |
| 3. Outlives the hackathon | 3 | MIT licence, `CONTRIBUTING.md`, `docs/TEACHER_GUIDE.md`, CI, setup script, a spec others can learn from. Missing: a pointer to the spec as a learning resource, "good first issue" entry points, and any statement of who maintains it after Dec 5 |

## Findings

| ID | Severity | File:line | Gap | Fix |
|---|---|---|---|---|
| A6-01 | High | `docs/DEMO_SCRIPT.md:46` | Kiro gets 15 s (2:30 to 2:45) and is gated by "film only if recorded evidence exists". A judge may see almost no Kiro in the video. Only `docs/DEMO_SCRIPT.md` is linked from `checklist.md:40` | Make `submission/demo_script.md` the single script. Delete or mark `docs/DEMO_SCRIPT.md` as superseded, and change `checklist.md:40` to point to the submission script |
| A6-02 | High | `submission/demo_script.md:19,25` | Mischief is not in the demo. The cold open has no creature voice line. Requirement 53 is shown as text on a spec, never heard from the app. Nothing shows the Ghost Host greeting plus its "next step" line | Add one 8 to 10 s clip in the 0:15 to 0:45 slot (or cut the 0:15 "need" shot shorter): Start screen, the host speaks its greeting with one clumsy-creature joke, then names the next tap ("Tap Pick a sample"). Show Requirement 53 criterion for that line on screen straight after, so the spec and the behaviour connect |
| A6-03 | High | `submission/devpost_description.md:19` | Demo section is `[PLACEHOLDER]`. No video URL. Judges score the demo and "Kiro in demo" cannot be confirmed | Record per A6-01 and A6-02, upload, and replace the placeholder before submit (checklist item). Do not submit with it |
| A6-04 | Medium | `README.md:125,129` | The Kiro row and commit stat undercut criterion 1: "126 of 1,021 commits carry kiro:", with Kiro limited to "specification, steering rules, pure core". Reads as Kiro being minor. The numbers also go stale with each commit | Keep the honest split, but add what Kiro gating did: hooks run on every save, 4 custom agents did audits and fixes, Requirement 53 and the optional features (near-line click, sticky line, corner heartbeat) were spec-first. Put in a short "Why this needed Kiro" sentence: the property-tested haptic engine and spec-first workflow were the reason the tuned values survived three builders. Mark the commit count "at date" or drop the percentage |
| A6-05 | Medium | `submission/devpost_description.md:36,38` | Opening claim "Kiro was the planner and the keeper of the rules, not only a code generator" pre-empts a doubt rather than showing a Kiro-only outcome. There is no "before/after Kiro" statement for criterion 1 | Add two sentences near line 38: what would not exist without Kiro (spec-first Requirement 53, 9 save-hooks keeping tuned haptics from drifting, agents with narrow write permissions) and one concrete example of a bug or drift a Kiro hook or property test caught, with a link into `docs/kiro-evidence/` |
| A6-06 | Medium | `README.md:11-52` | Feature list has no Ghost Host entry. The creature's voice and "next step" behaviour (Requirement 53) is only in the Devpost file. Mischief is stated as a tone in prose but not as a feature, so criterion 2 has no README evidence | Add a bullet "Ghost Host: the creature greets you and tells you the next tap on every screen, jokes only about itself, never after an error twice in a row (Requirement 53; not yet phone- or TalkBack-tested)". Keep the not-tested caveat the README uses elsewhere |
| A6-07 | Medium | `docs/DEMO_SCRIPT.md:38-47` | None of the shots show a spoken next step. The only host-style lines are the Raw Mode notice (`:45`) and the laptop fallback. No creature personality in narration | Same fix as A6-02. If this file is kept, mirror the new clip here |
| A6-08 | Medium | `README.md:204-206` and `:123-131` | Criterion 3 (outlives the hackathon): README ends with "MIT" only. No "Learn from this" pointer to the spec as a worked example, no CONTRIBUTING link in the README (CONTRIBUTING exists), no maintenance statement. README refers to `docs/TEACHER_GUIDE.md` at `:198` only under Deployment | Add a short "Contribute and learn" section before License: link `CONTRIBUTING.md`, `.kiro/specs/ghost-touch/` as "how to write a spec for an accessibility feature", `docs/TEACHER_GUIDE.md`, and list 3 to 5 starter tasks (for example native-speaker review of Hindi and Gujarati strings, which the README already lists as pending) |
| A6-09 | Medium | `submission/devpost_description.md:81-88` | "What is next" lists testing and translation but not how the project lives on: who reviews pull requests, how a teacher adds a diagram, any plan for NGOs or schools. No learner resource named | Add one bullet each: teacher guide link and "anyone can add a sample diagram" route, a call for native-speaker reviewers, and a stated owner for issues after Dec 5 |
| A6-10 | Low | `submission/built_with.txt:1` | Kiro is listed once, as one line with a parenthesis. Antigravity and Claude Code are not listed even though README and Devpost describe them as builders, so Built With and the prose disagree. Devpost tags may also split on the parentheses | Either keep Kiro only (consistent with the "Kiro-built" framing) and say so in the description, or list all three. Put Kiro on its own tag "Kiro" and put the detail into the description, not the tag |
| A6-11 | Low | `submission/devpost_description.md:79` | Tools line says "alongside other AI coding tools" without naming them, while README names them. Mixed signals on honesty, not a Kiro gap | Name Antigravity and Claude Code once, same as README `:123` |
| A6-12 | Low | `submission/devpost_description.md:63-67,71,77` | Placeholders for user testing, timeline and team are still open. Not a Kiro issue, but "tell the user what to tap next" and the "outlives" story need real user evidence | Fill or delete before submit. Keep the TalkBack caveat as written |
| A6-13 | Low | `submission/checklist.md:15,26` | Checks that `.kiro` is tracked, but the command only counts files. It would not catch a nested `.gitignore` | Add `git check-ignore -v .kiro/specs/ghost-touch/tasks.md` (expect no output) beside the count. Current state is fine (22 tracked, none ignored) |
| A6-14 | Info | `README.md:5` and `README.md:116,125` | The title line has an encoding glitch (mojibake in place of an emoji), and "48A-48 px" appears for "48x48 px" in the accessibility lines. This may be my console rendering, not the file | Open the file in a UTF-8 viewer. If it is real, replace with plain text. Not a blocker |

## Priority order

1. A6-03, A6-01, A6-02: one video that shows Kiro for at least a minute and the host speaking its next-step line.
2. A6-04, A6-05, A6-06: make "Kiro drove it" and "mischief with a next step" visible in README and description.
3. A6-08, A6-09: add the "Contribute and learn" section and a post-hackathon plan.
4. The rest are low-cost edits.

## What is already good (keep)

- `.kiro` is tracked and the `.gitignore` comment guards it.
- Role claims are honest (`submission/demo_script.md:39`: do not credit Kiro for screens or drivers). Keep this. The fix for criterion 1 is more evidence, not larger claims.
- Requirement 53 shot (`submission/demo_script.md:25`) is a strong "spec before code" proof.
- Not-tested caveats are consistent across README, Devpost and demo scripts.
