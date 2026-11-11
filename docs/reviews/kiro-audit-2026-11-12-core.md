# Audit: frontend/src/core (+ canvasSize, a11yFeatures, haptics/audio drivers, Saved titles)

Method: read hapticEngine, hitTest, geometry, pitch, scene, verify, correct, savedDiagrams, flow/canvasSize, flow/a11yFeatures, drivers/haptics, drivers/audio, Saved screen/flow. One finding was reproduced with node (CORE-A1). I did not run the existing test suites, so the claims below come from reading the code.

Checked and found OK:
- Tuned values in DEFAULT_HAPTICS match tech.md (80 / 70 / [50,90,50] / 450 / 22 / 14).
- Vertex > line > bar priority and first-wins ties in hitTest.
- The state machine's quiet window and lift reset.
- pitchForY and pitchForValue clamping and NaN handling.
- reconcileCanvasBox (a hidden or unmeasurable container keeps the previous box; the bitmap is never read back).
- Fallback driver timer clearing (the 450 ms quiet window stops line buzzes from cancelling a corner's pending pulses).
- Audio earcon ducking.

## CORE-A1
- Severity: Medium
- File: frontend/src/core/verify.ts:146 (the right-angle regex; the 3-letter vertex path is in computeDrawnAngle)
- Problem: The right-angle pattern is not anchored and has no word boundary, so "ABC is a right angled triangle" is parsed as an angle fact with vertex "ABC" and value 90.
- Scenario: A right triangle has the fact "Triangle ABC is a right angled triangle" (or "ABC is a right angle triangle") plus "AB = 3 cm" and "BC = 4 cm". `computeDrawnAngle("ABC")` measures the angle at the middle letter B. If the right angle is at C, the drawn angle at B is about 37° and Spec Ghost says "Facts and drawing disagree on angle ABC". That is a false accusation on a correct diagram. I confirmed with node that the regex captures ABC, ABCD and so on.
- Suggested test: `verify.right-angled-triangle-phrase` — a scene whose facts are ["ABC is a right angled triangle", "AB = 3 cm", "BC = 4 cm"] and whose geometry is consistent (right angle at C) must give status 'consistent' or 'silent'. `parseFacts(["Triangle ABC is a right angled triangle"]).angles` must be empty.
- Fixer: Kiro
- Confidence: high (regex reproduced); medium on how often the phrasing occurs in AI output.

## CORE-A2
- Severity: Medium
- File: frontend/src/flow/a11yFeatures.ts:62-76 (loop order and cap)
- Problem: Points are emitted first and the 60-feature cap is applied across everything, so a scene with 60 or more points never exposes any sides, bars, curves or axes to TalkBack.
- Scenario: Raw Mode, or a Ghostwriter scene (cap 300 points), has many points, e.g. an approxPolyDP outline. A TalkBack user gets 60 "corner" buttons and nothing else. The user cannot reach a single side, curve or axis through the overlay, and the cap is not announced.
- Suggested test: `buildA11yFeatures keeps a share for every element kind` — a scene with 80 points, 1 segment, 1 polyline and an axis must include at least one 'segment', 'polyline' and 'axis' feature.
- Fixer: agy (the file is in flow/, not core/). A reserved share per kind, or the cap applied per kind, would fix it.
- Confidence: high (it follows from the loop order); medium on how often it happens.

## CORE-A3
- Severity: Medium
- File: frontend/src/flow/a11yFeatures.ts:88-95 (bar target), with frontend/src/core/hapticEngine.ts:179
- Problem: hitTest drops bars with non-finite values (R3-07), but the TalkBack overlay builds a bar target and label from any bar. A NaN or Infinity value reaches the engine and the label.
- Scenario: A bar has a NaN value. The overlay label is "label, NaN" and the engine speaks "label, NaN" and calls pitchForValue(NaN, max), which gives 200 Hz. The touch path never does this. (This is separate from the known deferred item "NaN bar value turning into 0", which is about the validator.)
- Suggested test: `buildA11yFeatures skips or rewords non-finite bar values` — for a bar with value NaN, no feature label or target contains "NaN".
- Fixer: agy
- Confidence: high on the code path; medium on whether such a scene can get past validation.

## CORE-A4
- Severity: Low
- File: frontend/src/core/hapticEngine.ts:179
- Problem: The bar announcement concatenates the raw number (`label + ', ' + value`) with no rounding and no localisation. The a11y path uses `String(bar.value)` the same way.
- Scenario: A model-read value of 3.3333333333333335 is spoken digit by digit, or "0.30000000000000004" is spoken. The engine does not use the `speakKey` mechanism for this, so Hindi and Gujarati users get no localised number format.
- Suggested test: `step bar speech rounds value` — a bar with value 3.3333333333333335 speaks "L, 3.33" (or similar), with no more than 2 decimals.
- Fixer: Kiro
- Confidence: medium

## CORE-A5
- Severity: Low
- File: frontend/src/core/correct.ts:12-15 and :31-50
- Problem: `clamp01` maps NaN and ±Infinity to 0, so `movePoint(scene, id, NaN, y)` or `movePoint(scene, id, Infinity, y)` silently moves the point to the left or top edge. `addPoint` rejects non-finite input and returns the same scene, so the two behave differently.
- Scenario: `toNorm` or a pointer event yields NaN (for example when the scale is 0 or an event is missing coordinates) while the teacher drags. The point jumps to x=0 and is saved into the diagram. Infinity should clamp to 1, not 0.
- Suggested test: `movePoint ignores non-finite coordinates` — `movePoint(scene, 'A', NaN, 0.5)` returns the same scene, and `clamp01(Infinity) === 1`.
- Fixer: Kiro
- Confidence: medium (the code is clear; the trigger needs bad input)

## CORE-A6
- Severity: Low
- File: frontend/src/core/geometry.ts:103-105 (with hitTest.ts findBar)
- Problem: With a zero-size canvas, `toNorm` returns {0,0} for every finger position. `findBar` then treats the finger as being at the top-left of the diagram, and findVertex and findLine see every point at the same screen spot.
- Scenario: A pointer event arrives while the Explore container is hidden or 0x0 (scale 0). Any bar whose rectangle contains (0,0) is reported and spoken, and the vertex at the origin may be hit. A correct answer is `none`.
- Suggested test: `hitTest returns none for a zero-scale viewport` — `makeViewport(0, 0)` with a scene containing a bar at x0=0, y_top=0 gives `{kind:'none'}`.
- Fixer: Kiro (hitTest or geometry)
- Confidence: medium. reconcileCanvasBox keeps the previous box, so the real trigger is narrow.

## CORE-A7
- Severity: Low
- File: frontend/src/core/correct.ts:135-146 (`deletePoint`, `deleteSegment`)
- Problem: Deleting an id that does not exist returns a new scene object (and adds an empty `segments: []` if there was none). `deletePolyline` and `deleteBar` return the same scene for an unknown id, so `applyEdit` skips them.
- Scenario: Deleting a point or segment that is already gone (a double tap, or a delete after an undo) pushes a no-op entry onto the history. The next undo then appears to do nothing, while the app still speaks that it undid something.
- Suggested test: `deletePoint unknown id returns same scene` — `deletePoint(scene, 'nope') === scene`, and the same for `deleteSegment`.
- Fixer: Kiro
- Confidence: medium. This depends on whether the UI can issue a delete for a missing id.

## CORE-A8
- Severity: Low
- File: frontend/src/core/verify.ts:574
- Problem: `totalMatchedLengths` takes the segment count if it is above 0 and ignores bars. A scene with one matched segment and two or more matched bars gets silent status, and the bars are never checked.
- Scenario: A mixed scene has one parseable "AB = 3 cm" fact and two consistent or inconsistent bar facts. The bar mismatch is never reported. The failure is silent rather than false, so this is a missed check, not a false positive.
- Suggested test: `verify checks bars when only one segment matched` — one matched segment plus two clearly inconsistent bar facts gives status 'disagree'.
- Fixer: Kiro
- Confidence: medium

## CORE-A9
- Severity: Low
- File: frontend/src/components/teach/LoadModal.tsx:233 and frontend/src/flow/saved.ts:44 (outside core, related to the Saved titles change)
- Problem: The Saved screen derives each title with `savedTitle(scene, lang)`. LoadModal shows `d.title`, which was fixed in the language active when the diagram was saved, and `loadSavedList` builds its announcement from `e.title`.
- Scenario: A user saves a diagram in English, switches to Hindi and opens Teach, then Load. The modal shows the English kind slug ("geometry: A, B, C") while the Saved screen shows "ज्यामिति: A, B, C". The screen overrides the `loadSavedList` announcement, so the visible effect is only the mismatch in LoadModal.
- Suggested test: `LoadModal shows localised saved titles` — an entry saved with lang 'en' and no scene.title, rendered in 'hi', shows the Hindi kind name.
- Fixer: agy
- Confidence: medium

SUMMARY: 0 high, 3 medium, 6 low
AUDIT-DONE
