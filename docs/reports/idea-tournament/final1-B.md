# Final, round 1: B (Planchette) vs C (Ghost Hand)
Checked in the repo on 2026-11-22. Nothing was run on a phone.

## 1. Three attacks on Ghost Hand (as amended by round 3 and the semifinal-2 conditions)

**C1. After its repairs, the creature is a form.**
- Condition 1 makes placing pins a pair of `role="slider"` controls plus a Pin button, and makes "feel it" the **unchanged** Explore.
- So the only new experience is typing a table of values into number fields. The moment that feels like a creature, tracing the result, is today's Explore on a different scene.
- The original magic (split tap to place a corner, "a wrong point sounds like a jump") was withdrawn in round 3. That was the right call: `hapticEngine.ts:139-163` cuts the tone at every vertex.
- Ghost Hand uses no vision AI and no new synthesis. Of the three organs, only the existing nerves are involved.
- Planchette, by contrast, puts the eyes (model or template), the voice (one step at a time) and the nerves (the step is released only by a `hitTest` hit) into **one** act.

**C2. Its self-check is caught in a dilemma it cannot escape.**
- Condition 2 turns the "up 2, right 1" readout **off by default**, because with it on the app answers "Is it a straight line?" for the student.
- With it off, what is left at each pin is the engine's tuned corner pattern plus label, and the 450 ms quiet window (`hapticEngine.ts:139-163`).
- Directions at a corner speak coarse compass words. Those cannot tell a slope of 2 from a slope of 3, so a wrong point (2, 6) among (0, 1), (1, 3), (3, 7) feels much like a right one.
- **On: it does the homework. Off: it cannot check the homework.** Planchette's "Your turn" is the other way round: the student must find the element herself, and the app only confirms or corrects her touch.

**C3. The hand-in, which is the student and teacher value, rests on a flag and an untested path.**
- With the image share demoted to stretch (condition 3), the MVP hand-in is a share link plus a list of points.
- Opening a share link is gated by the build flag: `resolveShareRoute(hash, isShareEnvOn(), ...)` (`App.tsx:277`, `:405`; `config/features.ts:41-42`, `VITE_FEATURE_SHARE === '1'`). The README (line 171) says Share "stays off" and has not been tested on a phone. I could not find in the repo whether the live build sets the flag.
- A text list of points is what the homework question already gave the student, so it proves nothing about her drawing.
- The scope is also a new route, a new screen, slider wording, spoken grid ranges ("x from minus 3 to 3"), a pin list, the readout and its labels, all in en, hi and gu. That is a full new UI surface before the Nov 30 freeze (`opus-owner-decisions-2026-11-18.md:152`). Planchette has no new screen: one button, phrases, a reducer, and one Explore lane.

## 2. Repairing my own flaw: the sine anchors (judge-1, claim 10)
The judge is right. `origin`, `peak` and `trough` are Guide names (`guide/semantic.ts:15-23`), not ids, and `hitTest` returns only `vertex | line | bar | none` (`core/hitTest.ts:43-47`).

**Repair: a semantic anchor becomes "a real element plus a point on it".**
- Kiro writes the pure `core/walkAnchor.ts`. It has no i18n and does not import `guide/`, because `guide/semantic.ts:12` imports `t`.
- `anchorPoint(scene, 'peak' | 'trough' | 'origin')` returns:
  - for the peak or trough: `{ elementId: <polyline id>, x, y }`, the polyline sample with the smallest or largest y (y = 0 is the top);
  - for the origin: `{ elementId: 'x-axis', x: axes.y_axis_x, y: axes.x_axis_y }`. `'x-axis'` and `'y-axis'` are the ids `hitTest` gives the axes (`hitTest.ts:238`, `:243`). A polyline beats an axis inside the line radius (`:185`), and the sine starts near the origin, so origin arrival accepts any line target, not only `'x-axis'`.
- The step is reached when two things are both true. First, `hitTest` reports `{kind:'line', id: elementId}`, an existing target. Second, the finger is within **22 px** of `(x, y)`. 22 px is the existing vertex radius, copied, so no new value is invented.
- `validateWalk` accepts a semantic anchor only when `anchorPoint` returns non-null.

**Properties:**
- the anchor point lies on its element;
- some finger position inside the 22 px disc makes `hitTest` return that element (reachability, on random sine, parabola and line scenes);
- translation and scale invariance;
- null when the scene has no polyline or no axes.

**Fallback:** if Kiro cannot make reachability hold, the sine walk is dropped. Bars (`bars[].value`) and Pythagoras still give two offline walks, and the demo is the bar chart either way.

## 3. Could both be built? Honestly: yes as code, no as a Dec 5 priority
- **Technically they fit together.** Ghost Hand's draft is an ordinary `DiagramScene` shown in the unchanged Explore. Planchette lives in Explore and works on any scene. There are no shared files except `i18n/index.ts` and `App.tsx`.
- **One real conflict:** on a Ghost Hand draft, "Walk me through" (or a slope template) would answer the plotting homework, exactly what condition 2 forbids. So the two would need a rule: no walk on a scene from `#/build`, which means one prop through the mounted Explore.
- **The capacity limit:** the freeze is Nov 30, and the owner's own plan reserves Nov 24 to Dec 1 for the phone pass, the hook proof and the video (`opus-owner-decisions:150-152`). One new feature fits. Two means two Kiro specs and two agy lanes merging during the filming week.
- **If only one is built:** Planchette's template core plus reducer is one Kiro task and one EX lane, needs no flag, and works on the three shipped samples offline. Ghost Hand's value reaches the teacher only if Share is switched on and its unproven path holds.
- **Build Planchette now. Ghost Hand is the right next feature after Dec 5, when Share has been tested on a phone.**
