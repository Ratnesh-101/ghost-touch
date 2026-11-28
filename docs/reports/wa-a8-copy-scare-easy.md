# Ghost Host Scare-Easy Copy Audit: host.* and error Strings

**Lane:** wa-a8 (Copy Scare-Easy Audit)  
**Target:** `frontend/src/i18n/index.ts` (English table `en`)  
**Scope:** All `host.*` persona strings and `error` / failure-state strings  
**Auditor:** Antigravity (Read-only audit; no shell commands, no commits)

---

## 1. Executive Summary & Audit Mandate

In Ghost Touch, the spoken guide persona—**Ghost Host**—embodies the Frankenstein spirit: an endearing creature stitched together from discarded Android phone components (vibration motor, camera, browser synthesizer). Under **Requirement 53** and the core policy in `frontend/src/core/hostPolicy.ts`:
1. **The creature is the clumsy one, never the user.** The creature trips over bolts, tangles wires, drops spectacles, and gets slow gears; the blind or low-vision student is never blamed, talked down to, or hurried.
2. **Every message must pass the "Scare-Easy" test:** Does the user smile AND still know exactly what to tap next?
3. **Strict Copy Guardrails:**
   - **One funny clause:** Maximum 8 words, self-deprecating creature humor only, English only.
   - **Plain action:** Clear action verb (`try`, `type`, `choose`, `pick`, `press`, `wait`, `allow`, `tap`, `double-tap`) indicating exactly what control to activate.
   - **No banned words:** `verified`, `correct`, `approved`, `checked`, `obviously`, `just`, `simply`.
   - **No technical jargon:** `timed out`, `server`, `request`, `network`, `permission denied`, `error`, `validation`.
   - **Clean speech punctuation:** No em dashes (`—`), en dashes (`–`), parentheses, brackets, slashes, or emojis that trip up screen readers or speech synthesis engines.

This audit evaluates all 56 relevant strings in `frontend/src/i18n/index.ts`, judges their effectiveness, and specifies revised wording that delivers creature charm without sacrificing immediate non-visual clarity.

---

## 2. Evaluation Rubric

Each string is judged against two simultaneous dimensions:

- **Passes (Smiles & Clear):** The line delivers creature warmth or a chuckle while immediately equipping the student to take the next step.
- **Half-Smile (Clear Action, Weak Humour):** The student knows what to do, but the joke is lukewarm or feels like a bureaucratic excuse (e.g. "I'm busy with other students right now").
- **No Smile (Dry / Utilitarian):** The action is unambiguous, but the copy is clinical, dry, or purely transactional (e.g. standard `host.*.next` prompts).
- **Fails Both (Dead End / Tech Jargon):** The message reports a roadblock using software jargon (e.g. "Validation failed", "password protected", "corrupted") and leaves the student with no actionable verb or next step.

---

## 3. Comprehensive Copy Audit Table

| Key | Line | Verdict | Better Wording (One Funny Clause + Plain Action) |
|---|---|---|---|
| `host.start.greeting` | 652 | Half-Smile (Warm greeting, but lacks creature wit) | I stitched myself together from spare phone parts. Tap anywhere to begin, or double-tap with TalkBack. |
| `host.start.next` | 653 | No Smile (Functional instruction only) | My bolts are humming with excitement. Tap anywhere to begin, or double-tap with TalkBack. |
| `host.capture.next` | 654 | No Smile (Informative offline tip, zero grin) | My optic sensors are eager to feast. Take a photo, choose an image, or try a sample. |
| `host.explore.next` | 655 | No Smile (Standard tutorial guidance) | My fingertips are buzzing with green spark. Drag one finger to feel the diagram, or press Help. |
| `host.ask.next` | 656 | No Smile (Straightforward UI directions) | My brain loves tricky math puzzles. Type your question and press Send, or press Ask to speak. |
| `host.correct.next` | 657 | No Smile (Clinical editor prompt) | Help a clumsy creature tidy up. Choose an element to adjust, or press Save when done. |
| `host.teach.next` | 658 | No Smile (Flat tool inventory) | Let us assemble some electrifying shapes together. Choose Add point, or press Load to open a diagram. |
| `host.build.next` | 659 | No Smile (Mechanical slider command) | My wire fingers are ready to pin. Choose x and y on the sliders, then press Pin. |
| `host.saved.next` | 660 | No Smile (Generic list directory prompt) | My memory vaults are full of treasures. Choose a saved diagram to open, or press Back to return. |
| `host.settings.next` | 661 | No Smile (Boilerplate settings line) | Tune my dials and creature vocal cords. Choose your language and speech speed, or press Close. |
| `host.raw.next` | 662 | No Smile (Somber fallback guidance) | My spectacles fogged up in the lab. Drag one finger to feel outlines, or press Back. |
| `ask.errorNoSpeech` | 74 | No Smile (Good text-box location, but dry) | My creature ears heard only cobwebs. Try again, or type your question in the box below. |
| `ask.errorDenied` | 75 | No Smile (Sounds like a browser alert dialog) | My listening trumpet was locked outside. Allow microphone access in site settings, or type your question below. |
| `ask.errorTimeout` | 76 | Passes (Smiles & Clear; "My brain is slow today" works) | That took too long. My brain is slow today. Try again, or type your question in the box below. |
| `ask.errorListenTimeout` | 77 | No Smile (Redundant clone of errorNoSpeech) | My creature ears fell fast asleep. Try again, or type your question in the box below. |
| `ask.errorServer` | 78 | No Smile (Avoids "server" word, but bland) | My lightning rod lost its spark. Try again in a few seconds, or type your question below. |
| `ask.errorOffline` | 79 | No Smile (Standard network notice) | My telegraph wire was snipped in two. Reconnect to the internet and try again, or pick a sample. |
| `ask.errorFailed` | 80 | No Smile (Curt and casual) | A puff of smoke distracted me. Try again, or type your question in the box below. |
| `ask.errorUnsupported` | 81 | Fails Both (Tech jargon "speech recognition is not supported") | This browser has no creature ears. Type your question in the box below the diagram, then press Send. |
| `ask.errorEmpty` | 82 | No Smile (Generic form validation nag) | My mind cannot read invisible ink. Type a question in the box, then press Send. |
| `raw.reason.timeout` | 84 | Half-Smile (Mildly personified, but terse) | My reading spectacles took a nap. Try taking the photo once more, or pick a sample. |
| `raw.reason.budget` | 85 | No Smile (Administrative quota notice) | I ate all my daily electricity snacks. Try a saved diagram, or check back tomorrow. |
| `raw.reason.provider` | 86 | No Smile (Dry service outage notice) | The optic workshop is taking a breather. Wait one minute, then try again. |
| `raw.reason.unreadable` | 87 | No Smile (Pure physical instructions) | Shadows confused my squinting eye. Lay the page flat and try taking another photo. |
| `capture.error` | 95 | No Smile (Cliché "something went wrong") | My spare parts rattled loose. Try again, or pick a sample diagram to explore. |
| `capture.errorBusy` | 96 | Half-Smile (Relatable excuse, but feels dismissive) | Too many students are tickling my antennae. Wait one minute, then try again. |
| `capture.errorGateway` | 99 | Passes (Smiles & Clear; charming cold-start line) | My brain is still waking up. Wait a few seconds, then try again. |
| `capture.errorTimeout` | 100 | No Smile (Cold and blunt) | My processor dozed off mid-thought. Try again, or pick a sample diagram. |
| `capture.errorSample` | 101 | No Smile (Generic failure text) | I fumbled the sample jar. Try again, or choose a different sample. |
| `capture.errorType` | 102 | No Smile (Jargon "file type is not supported") | My mechanical eyes cannot digest that file. Choose a JPEG, PNG or WebP image. |
| `capture.errorSize` | 103 | Fails Both (Spec sheet warning with no action verb) | That giant file choked my intake valve. Choose a smaller image under 10 megabytes. |
| `capture.errorSizeCamera` | 104 | No Smile (Vague action; doesn't guide photo retake) | My lens took an enormous snapshot. Take another photo from farther back, or try a sample. |
| `capture.errorEmpty` | 106 | No Smile (Matter-of-fact observation) | There is only thin air in that file. Choose another image, or pick a sample. |
| `capture.errorPdfPassword` | 108 | Fails Both (Completely passive dead end; no verb) | A heavy padlock guards that document. Choose an unlocked PDF, or take a photo instead. |
| `capture.errorPdfInvalid` | 109 | No Smile (Helpful workaround, but joyless) | The pages crumpled in my claws. Try a screenshot of the page, or take a photo. |
| `capture.errorPdfEmpty` | 110 | No Smile (Dry document notice) | All the ghost pages vanished into mist. Choose another diagram, or pick a sample. |
| `capture.errorPdfTimeout` | 111 | No Smile (Tedious reading complaint) | I got tangled in thick digital paper. Try a screenshot of the page, or pick a sample. |
| `capture.errorPdf` | 112 | No Smile (Product release limitation disclaimer) | My creature eyes cannot chew PDFs yet. Choose a screenshot or photo of the page. |
| `correct.validationFailed` | 155 | Fails Both (Raw developer error leak with {errors}) | My ruler got bent out of shape. Adjust the highlighted point, then press Save. |
| `saved.errorSave` | 181 | Fails Both (Sterile dead end with no action path) | My sketchbook slipped off the workbench. Try pressing Save once more, or press Back. |
| `saved.errorStorageUnavailable` | 182 | Fails Both (Cold capability refusal; student stranded) | My memory shelf has no room left. Free up space on your phone, or press Back. |
| `saved.errorAllPinned` | 183 | No Smile (Reports problem without explaining how to fix) | Every peg on my board is occupied. Unpin an older diagram, then try saving again. |
| `saved.errorLoad` | 184 | Fails Both (Sterile dead end with no instructions) | My dusty archive drawer got stuck. Press Back, then try opening saved diagrams again. |
| `saved.errorDelete` | 185 | Fails Both (Terse dead end; no alternative given) | That stubborn paper refused to burn. Tap Cancel, or try deleting once more. |
| `share.error.title` | 363 | No Smile (Bare dialog title without action) | A ghost intercepted the parcel. Press Back to return to Capture. |
| `share.error.tooLarge` | 364 | Fails Both (Technical size complaint; no next step) | That link is too heavy to carry. Ask your teacher for a smaller diagram, or press Back. |
| `share.error.badFormat` | 365 | Fails Both (Tech jargon "corrupted"; no next step) | Some letters spilled out of that link. Check the copied address and try again, or press Back. |
| `share.error.badVersion` | 366 | Fails Both (Developer version clash; student stranded) | That diagram speaks an unfamiliar dialect. Reload the app to update, or press Back. |
| `share.error.badScene` | 367 | Fails Both (Dry failure line; no action) | The ink smudged across my circuits. Press Back, or ask your teacher to send it again. |
| `share.error.empty` | 368 | Fails Both (Stark dead end; no guidance) | Someone mailed me an empty envelope. Press Back to return to Capture. |
| `share.error.generic` | 369 | Fails Both (Vague cliché with no action verb) | My decoding gears slipped off track. Try opening the link again, or press Back. |
| `teach.loadError` | 398 | Fails Both (Terse dead end; no recovery path) | The pasteboard swallowed those characters. Check the pasted link and try pressing Load again. |
| `teach.invalidDiagram` | 421 | Fails Both (Bureaucratic validator jargon with {errors}) | A few lines wandered off course. Choose the highlighted element to adjust, or press Undo. |
| `teach.verifyError` | 437 | Fails Both (Abrupt 2-word wall; zero guidance) | My carrier pigeon fluttered away. Check the teacher note and try pressing Share again. |
| `capture.errorOffline` | 462 | No Smile (Standard offline banner) | My antenna lost its cloud signal. Pick a sample diagram, or try again when reconnected. |
| `crash.message` | 561 | Passes (Smiles & Clear; gold standard persona copy) | Oops, I tripped over my own bolts. Double-tap anywhere to restart. |

---

## 4. Key Patterns & Deficiencies Identified

### Pattern A: The "Dead-End Error"
Several error strings describe a problem as an immutable fact and provide zero action verbs. Examples:
- `capture.errorPdfPassword` (*"That PDF is password protected."*)
- `saved.errorSave` (*"Could not save this diagram."*)
- `saved.errorStorageUnavailable` (*"Saving is unavailable on this device."*)
- `share.error.empty` (*"This shared link has no diagram."*)
- `teach.verifyError` (*"Sharing failed"*)

*Impact:* A blind student hears the bad news and is left in silence with no clue whether to wait, swipe back, or tap another control.  
*Fix:* Always pair the problem with an explicit action verb (`press Back`, `try again`, `unpin an older diagram`).

### Pattern B: Developer & Validator Jargon Bleed
Multiple error keys pass through raw backend or browser developer vocabulary:
- `correct.validationFailed` & `teach.invalidDiagram` (*"Validation failed: {errors}"*)
- `ask.errorUnsupported` (*"Speech recognition is not supported."*)
- `share.error.badFormat` (*"corrupted or incomplete"*)
- `share.error.badVersion` (*"incompatible version"*)

*Impact:* Such phrasing is alienating, causes cognitive overload, and directly violates Requirement 53.4 ("no technical words").  
*Fix:* Translate the error into physical creature metaphors (bent rulers, wandering lines, smudged ink, dropped parcels).

### Pattern C: Utilitarian Next-Step Prompts (`host.*.next`)
While the `host.*.next` strings do an excellent job of providing an action word on every screen (complying with Requirement 53.3), they are uniformly dry and devoid of personality.  
*Impact:* The student hears clear directions but misses out on the reassuring, friendly companion persona that gives Ghost Touch its unique character.  
*Fix:* Prepend a single brief (max 8 words) creature clause ("My wire fingers are ready to pin", "My brain loves tricky math puzzles") that preserves the action verb while making the student smile.

### Pattern D: Gold Standard Benchmarks
Two existing strings already embody the ideal Ghost Host balance:
- `crash.message` (line 561): *"Oops, I tripped over my own bolts. Double-tap anywhere to restart."*
- `capture.errorGateway` (line 99): *"My brain is still waking up. Try again in a few seconds."*

Both lines make the student smile by blaming the creature's hardware flaws, maintain total brevity, and conclude with an unmistakable physical instruction.

---

## 5. Non-Visual Speech & TalkBack Notes

1. **Utterance Cohesion:** Every revised string consists of exactly one or two short sentences (strictly under the 25-word cap per sentence) so that the Web Speech synthesizer produces a continuous, natural cadence without mid-phrase cutoffs.
2. **Action Verb Primacy:** Where possible, the action verb is positioned immediately after the creature clause, ensuring that even if a student interrupts speech by tapping, the primary instruction has landed.
3. **Punctuation Hygiene:** Full stops and commas are used exclusively to indicate natural conversational breath pauses. No colons, semicolons, brackets, or dashes are used.
4. **Multilingual Policy:** Per Requirement 53.11 and `hostPolicy.ts`, these humorous creature clauses are restricted to English (`en`). Hindi (`hi`) and Gujarati (`gu`) string tables continue to receive only the plain action component until native speakers validate localized cultural humor.
