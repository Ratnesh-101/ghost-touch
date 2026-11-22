# Round 3, D (Ghost Walk): answers, changes, last attack

What I checked in the code:
- The hold keep-alive is 60 ms (`flow/explore.ts:713`, timer at `:745`).
- Requirement 39 is "One sound, one meaning" (`requirements.md:573`). Requirement 38 keeps the keep-alive running unless Guide or Ask is active (`:567`).
- `Explore.tsx` already checks `isGuiding()` in about ten places (`:444`, `:672`, `:800`, `:1314`, `:1417`, `:1448`, `:1476`, `:1688`, `:1700`).
- Guide has a "peak" target (`guide/semantic.ts:93`).
- Amara's persona asks us to delete "a surprise in class" (`fable-persona-amara-blind-student.md:36`).
- C's citations are correct.

## 1. Answers to C's three attacks

**A. "The hand cannot both drift right and stop": C is right.** At a constant x speed, the hand keeps sliding right on the flat part. Only its *vertical* motion stops. I withdraw "her hand performed the graph" and "felt in the shoulder". What is still true:
- The finger's vertical speed is the slope, because the clock sets the pace and the student does not.
- In Explore the student picks her own speed, so slope and speed are mixed together. That difference is the whole feature.

I also concede the Thornton and Sokoloff citation is from memory and is not in the repo. I drop it.

**B. "Two machines on one motor and tone": C is right about my pitch as written.** The 50 ms `chase.ts` ticker and the "tone at the ghost's height while lost" gave the existing sounds a second meaning. Changed design:
- **No new ticker and no effects from Chase.** Chase becomes a *target filter*, the same precedent as `core/sticky.ts`. The tech.md sticky row says it "changes which target is reported, adds no effect".
- On each move and each existing 60 ms keep-alive tick, `ghostTarget(scene, progress, finger, viewport)` passes the curve's line target to `step()` when the finger is within the catch radius of the ghost, and `none` otherwise.
- So the **engine stays the only thing that vibrates or plays the tone**. The buzz is the tuned line buzz. The tone is the engine's `pitchForY` of the finger, which matches the ghost because the finger is on it.
- Lost means the engine's own silence. There is no "lost" tone, and graph scan is off while Chase is on.
- The filter never reports a vertex, so a chase is never broken by corner pulses.
- The ghost's progress is a pure function of elapsed time, read in those same ticks. The only new timer work is redrawing the ghost dot on screen, which is visual only.
- The one direction word after 1.5 s comes from `directionOf`, through the speak path that already exists.

What stays true: Chase is one more mode that Explore's guards must know about, next to Guide. That is a real cost. It gets its own oracle tests: no axis, where-am-I or scan speech while chasing, and keep-alive still running (Requirement 38).

**C. Narrow, hard, an unvalidated score.**
- **Narrow, and I concede it.** Chase needs a `function_graph` (`core/curve.ts:27`), so only 1 of the 3 shipped samples (sine) has it. A distance-time graph read as segments is not walkable in v1. A chain of segments that is x-monotonic is a follow-up, not a claim.
- **Overlap with Guide: partly.** Guide steers to a fixed point. Chase's target moves on a clock, and Chase uses only Guide's direction word, not its pitch or pan.
- **The score: dropped.** There is no percentage and no grade. The end of a run speaks only the shape story ("climbed slowly, stayed flat, then climbed fast"), computed from the curve and not from the student. This avoids "a surprise in class".
- **Hard eyes-closed: unknown until it is felt.** The catch radius and pace stay PROPOSED and get a phone-test row.

## 2. My sharpest remaining attack on the improved Ghost Hand
**C never answered my A1, and rise-and-run makes the problem bigger.**
- Pins are Points. For every new vertex, `step()` stops the tone, pulses and speaks the label (`hapticEngine.ts:139-163`). Tracing the joined graph still hears "(0, 1)… (1, 3)…" with the tone cut at every pin, so the "steady glide" self-check remains unproven.
- The new readout, "every step goes up 2 for 1 across", answers the homework question "Is it a straight line?" for her.
- C's fix is a teacher worksheet switch. Its own pitch puts the worksheet in Phase 2, and that phase needs a `share/validate.ts` rule change (`pitch-C.md:27`). So the MVP ships a tool that answers the homework, with the off switch deferred.

## 3. Closing statement
1. Ghost Walk adds the one thing Ghost Touch cannot express today: change over time. The ghost's clock sets the pace, so the vertical speed of the student's finger is the slope.
2. C's attacks were fair. I took them: the engine stays the only voice, the score is gone, and the overclaim and the citation are withdrawn.
3. Chase now changes which target the engine reports, the same way sticky line already does, and adds no effect. No new haptic or audio value, no backend change, no schema change.
4. Kiro owns one pure module with properties: the ghost is always on the curve, progress never decreases, and Chase never emits a vibrate.
5. It is narrow (graphs only, not yet felt on a phone), and I am telling you that plainly.
