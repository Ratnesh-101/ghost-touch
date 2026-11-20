# Ghost Touch judged by Amara, 16, blind since birth (2026-11-17)

Persona review by Claude Code (read-only agent). Written in the first person as Amara: totally
blind, TalkBack all day on a mid-range Android phone, one finger, 20 minutes before class.

Method: I read CLAUDE.md, the steering docs, Requirement 13 and its neighbours, the earlier
`fable-blind-user-plan.md`, and the code on `main` at a82f7bf (Start, Capture, Explore, `flow/*`,
drivers, LabSettings, i18n). I did not repeat the earlier plan's findings; most of its fixes are now
merged, and this report is about what it is like to live with all of them switched on at once.

Not done: no phone, no TalkBack session, no motor, no real blind person. Every "I hear" below is
what the code will do, read line by line, not something anyone heard. Where a claim needs a phone
to settle it, I say so. Nothing in the repo was changed except this file.

---

## 1. Verdict

**I would keep it for a week, not yet for a year.** The core idea works for me: a buzz on the
line, a different buzz and a letter at the corner, a tone that follows the curve. Since yesterday it
also tells me where the edges go, clicks when I drift, and keeps buzzing when I stop to think. That
is the first diagram app that treats my finger as the reader.

What would make me delete it is not a missing feature. It is that **seven new voices arrived in
one day and nobody is conducting them**:

- I cannot make it stop talking. Lifting my finger stops the buzz and the tone but not the speech.
- It never taught me its gestures. The one sentence it does say is wrong when TalkBack is off.
- In Raw Mode, the helpers that were built for clean diagrams read machine ids aloud.
- Two different events play the same sound.
- Settings has eight controls in builder's order, with the words I do not know and no way to try one.
- One of the new sounds can go silent in my one earbud.
- It never tells me how sure it is that the picture is right.

**Trust**: predictable silence, one meaning per sound, a voice that stops when I say stop, honesty
about the AI. **Delete**: a surprise in class, a flood of words, one wrong homework answer.

---

## 2. Top 10 problems

Ranked by how fast each one would make me give up. P = problem.

### P1. I cannot shut it up
- Lift emits only `vibrate(0)` and `tone(null)` (`frontend/src/core/hapticEngine.ts:125-132`). The
  all-fingers-up branch runs just those effects (`frontend/src/screens/Explore.tsx:2051-2065`).
  Nothing cancels speech.
- Scenario: I land on corner A from empty space. It starts "A. Down to C. Down-right to B." I lift
  because the teacher spoke. The phone finishes the sentence out loud in a quiet room.
- The entry speech is worse: overview, gesture hint, back hint, and sometimes a caveat, as one
  utterance of about 30 words (`frontend/src/flow/navigation.ts:88-108`). The only thing that stops
  it is touching something that speaks.
- A `stopSpeaking` method exists on the speech driver and is used only before Ask listening
  (`Explore.tsx:667`). Lift is the natural "quiet" gesture for every blind user I know.

### P2. Nobody taught me the gestures, and the one hint is wrong half the time
- All I am told is "Double-tap and hold, then drag to feel the diagram. Press Back to leave."
  (`frontend/src/i18n/index.ts:95-97`). With TalkBack off (how a sighted helper will hand it to
  me, and how every demo runs) that instruction is false: I just touch.
- Things that exist and are never announced: hold still on a line to hear its name (800 ms), hold
  still in empty space to hear where I am (1200 ms), two-finger long-press to ask (600 ms),
  two-finger swipe down to leave, the Where am I button, the clicks that mean "nearly there".
- The Ask button is secretly also the voice-command button (`Explore.tsx:712-774`). The only list
  of commands is spoken if I already know to say "help" (`i18n/index.ts:185`). The list leaves out
  "guide me to B" and "stop".
- There is no practice screen. My first diagram is also my first lesson in five cues.

### P3. Raw Mode reads machine ids at me
- Raw Mode points are named `raw_p0`, `raw_p1`... and segments `raw_s0`...
  (`backend/app/raw_mode.py:283`, `:312`), with no labels, up to 300 segments.
- The corner speaks "Point raw_p17" (`i18n/index.ts:106`). The compass then adds "Down-right to
  raw_p18." because it falls back to the id (`frontend/src/flow/explore.ts:823`). Resting on an
  outline says "Side raw_s4. Up to raw_p3, down to raw_p4." (`explore.ts:867-882`).
- `checkVertexCompass` has no Raw Mode check (`Explore.tsx:1482-1501`). The overview code already
  knows to hide ids that start with `point_` or `pt_` (`frontend/src/flow/overview.ts:36-41`), but
  not `raw_`, and the compass does not use that filter at all.
- Raw Mode is the "never leaves you with nothing" promise. Right now it leaves me with noise. This
  is read from the code, not heard; it needs one messy photo on a phone to confirm.

### P4. Two events, one sound
- Leaving the page plays the `back` earcon (`Explore.tsx:1335-1343`). Leaving the Explore screen
  also plays the `back` earcon (`Explore.tsx:609`, `:1197`).
- Scenario: I drift off the top of the canvas and hear the exit sound. I believe I have lost my
  diagram until "Edge, top" arrives a moment later, if nothing cancels it.
- Same family: the 25 ms centre tick is a vibration (`Explore.tsx:1346-1348`), so a short buzz
  mid-page means "centre", not "line", and "Centre." is spoken on landing there. I never asked.

### P5. Settings: eight controls in the order they were built
- Order I swipe through: Language, Speech speed, Speech detail, Directions, Finding sound, Stay on
  line, Graph scan, Corner heartbeat, then a five-paragraph vibration help card for four phone
  brands, then (if the build has them) Guide my finger and Teacher tools
  (`frontend/src/components/LabSettings.tsx:308-690`).
- Each switch is three TalkBack stops: a heading, a hint paragraph, a button with the same name as
  the heading. The hint is not tied to the button with `aria-describedby`, so if I jump by
  controls I get "Stay on line, switch, off" and no explanation.
- The switches do not name themselves the same way. Directions, Finding sound, Stay on line and
  Corner heartbeat are named by the feature (`LabSettings.tsx:417`, `:453`, `:489`, `:563`). Graph
  scan and Guide are named by a status sentence that changes when pressed: "Graph scan enabled."
  with `aria-checked` on top (`LabSettings.tsx:525-527`, `:628`). TalkBack would read "Graph scan
  enabled, switch, on", and after I press it the control has a different name.
- Words I would not understand on day one: "Finding sound", "Graph scan", "Corner heartbeat",
  "Lab settings", "Speech detail".
- No "try it" button, no reset to defaults, no volume, no way to turn tones off but keep speech.
- The dialog speaks "Lab settings opened" through the app's own voice (`LabSettings.tsx:206`) at
  the same moment TalkBack announces the dialog and the Close button it just focused. Each toggle
  does the same: the app says "Directions disabled." while TalkBack says "off".

### P6. Two settings fight, silently
- Speech detail = Short removes the corner compass (`Explore.tsx:1411-1415`) even though the
  Directions switch still says on. I chose Short because it talks too much, and lost the one piece
  of speech that helps me turn. Nothing tells me.
- Directions off also removes the automatic "where am I" on rest (`explore.ts:993-998`). The switch
  hint mentions only corners and line names (`i18n/index.ts:445`).
- So "why did it stop telling me X" has three possible answers in two different controls.

### P7. One earbud can miss the "getting warmer" clicks
- The click is panned toward the line, up to full left or right (`frontend/src/core/proximity.ts:112`,
  applied in `frontend/src/drivers/audio.ts:384-409`).
- In class I wear one earbud. If it is the right one and the line is to my left, a hard-left click
  is quiet or gone on a stereo output. The cue that is supposed to rescue me disappears exactly on
  one side of every line.
- Android has a system "mono audio" switch, but the app never mentions it and I should not need to
  know. The earlier plan already said "never make pan the only carrier of a cue"; here pan can
  remove the cue. Needs a phone and one earbud to measure how bad it is.

### P8. With TalkBack on, there are two readers and no agreed turns
- The feature overlay puts focusable buttons over the canvas (`Explore.tsx:2136-2168`). When
  TalkBack focuses one it reads its own label ("Corner A, top left, joined to B and C") and the app
  also speaks "A" through its own voice from the focus handler (`Explore.tsx:2082-2103`). Two
  voices, two speeds, overlapping.
- The Raw Mode notice is a `role="status"` live region (`Explore.tsx:2194-2199`) while the app also
  speaks the Raw Mode sentence. Requirement 13.7 says the screen reader must not read spoken text a
  second time.
- A side's overlay button is its bounding box. The hypotenuse AB's box covers most of the triangle,
  so touch-exploring inside the shape says "Side AB" where there is no line.
- The app voice is not my TalkBack voice or my TalkBack speed. I get three speeds; I listen to
  TalkBack far faster than "Fast".
- All of this is from reading the code. How TalkBack really orders these on a phone is unknown.

### P9. I cannot tell when the AI drew it wrong
- The only warning is when the facts and the drawing disagree, and then only the first finding is
  spoken (`navigation.ts:44-55`). A diagram with no facts, or a wrong one that is self-consistent,
  sounds exactly as confident as a perfect one.
- The entry speech never says "read by AI, may be wrong". A shared diagram gets an honest "not
  checked" line; my own photo, the riskier case, does not.
- The overview says "3 corners, 3 sides". If the AI dropped a fourth point D, I cannot notice.
- The "Correct" button needs sight. For me the fix is to retake the photo, and nothing suggests it.

### P10. Accidents, heat and the classroom
- A second finger or the edge of my palm that slides down 80 px within 600 ms leaves the diagram
  (`explore.ts:460-480`, `Explore.tsx:1822-1830`). No "are you sure", and I am back at Capture.
- Asking by voice in class means speaking aloud after a beep, with a 6 s window
  (`frontend/src/drivers/speech.ts:138`). The text box appears only after voice fails or when the
  phone cannot listen (`Explore.tsx:404`). A whisper-proof way to ask should not need a failure.
- While my finger rests, a 60 ms timer runs the whole pipeline and asks for a redraw every tick
  (`explore.ts:704`, `Explore.tsx:1555-1590`); with the heartbeat on, the motor fires every 900 ms.
  Battery and heat over a 20 minute session on a budget phone are unmeasured, not known bad.
- No tone volume and no "tones off". A theremin on a phone speaker gets the app banned in class.

---

## 3. Things that would make me trust it (already there)

- Hold keep-alive: stopping to think no longer makes the line vanish.
- The overview gives me a map before I touch, in the words a good teacher uses.
- The compass skips the edge I came from and stays quiet on a second visit within 10 s.
- The automatic "where am I" waits 1.5 s after other speech and fires once per rest.
- Samples work offline, and error messages say what to do next.
- Stay on line and Corner heartbeat ship off. Good: both change how the tuned buzz feels.

---

## 4. Defaults I would ship for a first-time blind user

| Setting | Today | I want | Why |
|---|---|---|---|
| Speech detail | Full | Full for the first 3 diagrams, then offer Short | I need the words once, not forever |
| Directions | On | On | The turn is where I get lost |
| Finding sound | On | On, mono | See P7 |
| Stay on line | Off | Off until phone-tested, then probably On | Biggest help for a shaky finger, but untuned |
| Graph scan | On | On | A plain sweep plays the shape |
| Corner heartbeat | Off | Off | A repeating buzz I did not ask for is a surprise |
| Entry speech | Always long | Long once per diagram, title only on return | P1 |
| Centre word and tick | On, no switch | Off | P4 |
| Tones | No control | Quiet mode switch | P10 |

---

## 5. Top 10 improvements, ranked (impact against effort)

Impact is for a real classroom. Effort: S is under half a day for one lane, M is about a day, L is
more. Owner follows the repo's split: Kiro for the spec and `core/`, an agy lane for the shell.
None of these changes a tuned haptic value.

| # | Improvement | Fixes | Impact | Effort |
|---|---|---|---|---|
| 1 | Lift means quiet | P1 | Very high | S |
| 2 | Raw Mode speaks no ids | P3 | Very high | S |
| 3 | Own sound for the page edge | P4 | High | S |
| 4 | Mono-safe click | P7 | High | S |
| 5 | 60-second practice diagram and a Help button | P2 | Very high | M |
| 6 | Settings: three questions, the rest under "More" | P5, P6 | High | M |
| 7 | Quiet mode for class | P10, P1 | High | M |
| 8 | Honest AI line and a "check with me" count | P9 | High | M |
| 9 | One reader at a time under TalkBack | P8 | High | M to L |
| 10 | Guard the two-finger exit and offer undo | P10 | Medium | S |

### 1. Lift means quiet
- On the all-fingers-up branch, call `drivers.speech.stopSpeaking?.()` after a short grace
  (about 300 ms, so a re-touch during a wobble does not chop a label).
- Exception: an Ask answer keeps playing; I asked for it.
- Add a "repeat" button that needs no voice; `lastSpokenRef` already holds the last sentence.
- Kiro requirement: "WHEN all fingers lift THEN exploration speech SHALL stop within 400 ms".

### 2. Raw Mode speaks no ids
- Smallest safe fix: when the scene is Raw, skip compass and line names; keep buzz, corner
  pattern, clicks and edge cue. Say "Corner" instead of "Point raw_p17".
- Better: one shared "is this id speakable" helper for overview, compass, line name and where am
  I. Unnamed things are described ("3 edges", "Line, up-right and down-left"), never named by id.

### 3. Own sound for the page edge
- Add an `edge` earcon (one short low tick) and use it at `Explore.tsx:1339`. Keep `back` for
  leaving only.
- Drop the spoken "Centre." and the centre tick by default; keep them behind the debug page.

### 4. Mono-safe click
- Limit click pan to about plus or minus 0.4 so both ears always get it; the where-am-I sentence
  already says "to your left". Or a "One earbud" switch that sets all pan to zero, Guide included.
- Phone check: one earbud in each ear in turn, line on each side.

### 5. Practice diagram and Help
- A fourth sample, "Practice", that walks me through with speech between steps: find the line,
  follow it, feel a corner, hear the compass, drift and hear the clicks, hold still, lift for quiet,
  ask one question. About 60 seconds. Offer it once, on first launch, and from Help after that.
- A Help button in the Explore footer that speaks the gesture list for the current mode. With
  TalkBack off it must say "touch and drag", not "double-tap and hold".
- Fix the entry hint the same way: say "Drag one finger" and let the TalkBack-only label carry
  the double-tap wording.
- Name the Ask button "Ask or command" and make "help" list guide and stop.

### 6. Settings: three questions first
- Top of the sheet, in plain words:
  1. "How much should I talk?" Full / Short / Only names.
  2. "Sounds" On / Quiet (see 7).
  3. "Help me stay on the line" Off / On (this is Stay on line; label it by what it does for me).
- Everything else under one "More settings" button: Directions, Finding sound, Graph scan, Corner
  heartbeat, language, speed. Vibration help moves to the bottom, collapsed.
- Every switch: one stop, named by the feature, hint attached with `aria-describedby`, status
  never part of the name. Fix Graph scan and Guide to match the others.
- A "Try it" button next to each cue plays it once. A "Reset" button at the bottom.
- Keep directions in Short; drop only the overview tail and line names. If not, say the trade once.
- Do not speak "Lab settings opened" from the app; the dialog title does it. Call it "Settings".

### 7. Quiet mode for class
- One switch: tones at a third of the gain, no start or success earcons, Short speech, clicks kept
  (they are tiny), heartbeat off.
- Make the question box always reachable from the footer, not only after voice fails, so I can
  type a question with my braille keyboard instead of talking in class.
- Add a speed above Fast for people who listen at screen-reader speeds.

### 8. Honest AI line and a count to check
- For my own photo, end the entry speech with one short clause the first time: "Read by AI. Check
  the count against your book." Then never again for that diagram.
- When there is more than one disagreement, say how many: "2 things in this drawing disagree with
  its facts."
- Add a "describe" button (not voice-only) that reads the overview and the facts for comparison.
- In Raw Mode suggest the fix I can do blind: "Try again with the page flat and the whole figure
  in the photo."
- Needs Kiro: a requirement and a property that the honesty clause appears exactly once per scene.

### 9. One reader at a time under TalkBack
- When an overlay button gets screen-reader focus, do not also speak its label from the app. Run
  the vibration and the tone only. The label is already the button's name.
- Give a side's button a thin box along the line (or several small ones), not its bounding box.
- Remove `role="status"` from the Raw notice while the app speaks the same sentence.
- This one needs a real TalkBack session before and after. Do not guess.

### 10. Guard the two-finger exit
- Require both fingers to start within the same 150 ms and to start on the canvas; ignore it when
  the first finger has been tracing for more than a second (that second touch is my palm).
- After any exit, Capture offers "Back to your diagram" as the first control for 30 s.

---

## 6. My first 5 minutes (what the code will do, step by step)

**0:00 Start.** "Ghost Touch. Tap anywhere to begin." Chrome may block the speech until I touch,
but TalkBack reads the same words as the button name. One button, whole screen. Good. I double-tap.

**0:05 Capture.** A sound, a 50 ms buzz, then "Take a photo, choose an image, or pick a sample
diagram." Clear. I pick "Sample: triangle" because I do not trust the camera yet. No practice run
is offered, because none exists.

**0:15 Explore opens.** Success sound, then one long sentence: "Right Triangle ABC. 3 corners, 3
sides. A top left, B bottom right, C bottom left. Double-tap and hold, then drag to feel the
diagram. Press Back to leave." I like the first half very much. The second half is ten words I will
hear every single time.

**0:25 First touch.** I double-tap, hold and drag. I land in empty space near the middle. If I
happen to be within 24 px of the centre I get a tiny buzz and "Centre." which cuts off the overview
if it was still talking. I did not ask for that. Otherwise: silence. I stop to listen. After 1.2 s
it says where I am and what is nearest and on which side. That is the moment I start to trust it.

**0:40 Finding the line.** I move the way it said. Soft clicks begin, faster and higher, then the
buzz. Good, but nobody told me the clicks mean "nearly there"; I worked it out.

**1:00 Following.** I drift. The buzz stops, the clicks come back, unless the line is on the side
of my missing earbud. I stop on the line to think. The buzz continues (thank you). After 0.8 s:
"Side CA. Up to A, down to C." Useful once.

**1:30 Corner.** Bzzzz-tap. "C. Right to B." It skipped the side I came from. Then about half a
second with no line buzz. I already know which way to go, so the gap does not hurt as it used to.

**2:00 The teacher starts talking.** I lift my finger. The buzz stops. The voice does not. It
finishes "A. Down to C. Down-right to B." into the room. This is the moment I would turn the
volume to zero, and with it lose the app.

**2:30 I try to fix it in Settings.** "Lab settings opened" from the app, on top of TalkBack
reading the dialog. Language, Speech speed, Speech detail: I pick Short. Then five switches, each
heading, hint, switch, then four paragraphs about phone brands. About thirty swipes. I do not know
what "Corner heartbeat" feels like and I cannot try it here. I close.

**3:30 Back to the triangle.** Corners now say only "A". The directions are gone. The Directions
switch still said on. I think the app is broken.

**4:00 I ask.** I press Ask. A beep. I have six seconds. I whisper "How long is AC?" in a
classroom. If it hears me: "Thinking..." then the answer, 4 centimetres. If it does not: "I didn't
hear anything. You can type your question instead." and only now a text box exists.

**4:30 I slip.** My palm touches while my finger moves down side CA. The exit sound. I am at
Capture. It is the same sound as sliding off the page, so I am not sure which of the two happened.

**5:00 The bell.** One triangle traced, three surprises, one question answered. I would open it
tomorrow for the sine graph, because hearing the wave under my finger is something nothing else on
my phone does. I would not yet use it for homework that counts.

---

## 7. What only a phone and a person can settle

- P8: do the overlay buttons take TalkBack focus during a hold-drag, and do the two voices overlap?
- P7: how loud is a hard-panned click in the opposite earbud?
- P3: Raw Mode with a real messy photo; how many ids are spoken in a 30 s trace?
- P10: battery and case temperature after 20 minutes, heartbeat on and off; does a palm exit?
- One blind TalkBack user, ten minutes, no coaching. Count the surprises. That number is the score.

---

## 8. Notes for the owner

- Improvements 1 to 4 are small and touch no tuned value. Do them before recording the demo:
  P1, P3 and P4 can all happen on camera. 5 and 6 turn a demo into something a student keeps.
- 1, 2, 3, 8 and 10 each need a short requirement from Kiro before a lane builds them.
- This report still needs a `docs/BUILD_LOG.md` entry (tool: Claude Code, kind: review). I was
  limited to writing this one file.
