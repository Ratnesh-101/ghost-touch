# Round 3, C (Ghost Hand): concessions, changes, final attack

## 1. Answers to D's three attacks

**A1, the tone self-check: D is right, so I drop it.** I checked `core/hapticEngine.ts:139-163`. Entering a new vertex emits `tone(null)`, the corner pattern and the label, and opens the 450 ms quiet window that also mutes the line buzz (rule 3, `:176`). Pins are vertices, so the glide is cut at every pin and the label is spoken over it. D is also right that a continuous polyline never "jumps". **Change:** the self-check is now **exact speech, not pitch.**
- At stitch time, each segment gets the label "up 2, right 1", computed from the integer pins.
- The *existing* line-name-on-rest code (`flow/explore.ts:864-908`, Requirement 29) already speaks it as "Side up 2, right 1. Down-left to (0, 1), up-right to (1, 3)."
- "Join in order" ends with one sentence: "Every step: up 2 for 1 across", or "Steps differ between (1, 3) and (2, 6)."
- Kiro property: each label equals the integer differences of its two pins. No engine change, and no claim about hearing slope.

**A2, TalkBack: D is right, so I demote the second-finger tap.** `docs/research/talkback-spike.md:11` says pass-through gives one virtual finger. It starts at the centre and moves relative to it, so there is no second pointer, and landing on an exact grid crossing is unproven. **Change:** the main input is now the most standard TalkBack pattern there is:
- two adjustable controls, x and y (`role="slider"`: swipe up or down to change, the value is spoken),
- plus a 48 px "Pin" button.
That mirrors how the homework is set: a table of values that the student plots. The canvas becomes the place to **feel and check**, not to place. The second-finger tap survives only as an optional TalkBack-off shortcut, and voice "pin" stays optional. Nobody has to speak in class. Honest note: I have not seen sliders under TalkBack in this app; they are a platform pattern, not tested evidence.

**A3, rebuilding the fragile hold layer: D is right about copying, so I copy nothing.** **Change:** there is no `Build.tsx` canvas. Plotting is a small form screen: sliders, Pin, a list of pins, Undo and Join. "Feel it" mounts the **unchanged** `Explore` component with the draft as its `scene` prop (`ExploreProps`, `screens/Explore.tsx:255-271`). Its `onBack` returns to the form. So the keep-alive, lift-means-quiet, axis speech, page edge and where-am-I are the real, already-tested ones, and Explore gets **zero edits**. That also takes Ghost Hand out of the serialized EX queue completely.
- On overlap with Teach: Ghostwriter is the teacher's visual editor, hidden from students by Requirement 48. Reusing its pure functions is the point, not a duplication.
- On export: D is right that `drivers/clipboard.ts:73-95` has no `files`. The image share is new and unproven, and it is now marked *stretch*. The MVP hand-in is the existing share link plus a text list of the points, which a teacher can read in WhatsApp.
- Scope is now: one Kiro task (`pegboard.ts`, properties), one agy form screen with its route and i18n, and one optional export lane.

## 2. Sharpest remaining attack on the improved Ghost Walk
**Patience and rate cancel each other out.** D's answer to "a blind student cannot keep pace" is that time only moves while the finger is on the ghost, or for 1 s after losing it. But the whole claim is that the student feels the *graph's* rate: "your hand **shoots up**" on the steep part. The steep part is exactly where a tracer loses a 22 px target. The ghost then stops and waits, and restarts when caught. So the felt rate is the student's catch-up rhythm, not the slope. The flat part, which D now admits still slides right at constant x speed, feels like an easy stretch, not "at rest". What is left to tell "fastest" from "at rest" is `motionStory`, a spoken sentence computed from slopes. Ghost Race adds a second spoken sentence (`raceStory`). **The exam answer comes from the code's summary, not from the hand.** That summary could be a 20-line addition to the existing overview, with no moving target, no 50 ms ticker and no new guard set. D has also now agreed that axis speech and keep-alive must be *paused* inside Explore for the mode (round2-D table). That is new glue in the 2,686-line file, the same failure pattern as I01 to I08. A smaller point: D's x-monotonic guarantee (`graphs/sample.py:20-23`, verified) covers graphs built from typed equations, not photographed curves.

## 3. Closing statement
1. Ghost Hand is the only idea that makes the blind student an **author**: she plots her own graph, and her teacher can read it.
2. Where D was right, I changed the design: no pitch self-check, no gesture TalkBack cannot do, no copied hold layer.
3. What is left uses only shipped, tested parts: `addPoint`, `addSegment`, history, the unchanged `Explore`, the line-name dwell and the share link.
4. It needs zero tuned-value changes, zero backend work, zero schema change and zero Explore edits, and its check is exact arithmetic, not a guess.
5. It turns "I draw it on her palm" into "she drew it herself, and sent it."
