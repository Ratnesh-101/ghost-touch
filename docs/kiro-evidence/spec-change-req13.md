# Spec change request: Requirement 13 "Works with TalkBack" (draft for Kiro)

Prepared by Claude Code, 2026-11-01, from `docs/WIN_PLAN.md` §2 and the Gate A result (`docs/research/talkback-spike.md`: **method A1 passes**). Kiro owns `.kiro/`, so this is a paste-in request, not an edit. Paste the block under "Paste into Kiro chat" when credits return.

## Evidence for this change
- Gate A, A1 (2026-11-01, Nord CE6, Chrome, TalkBack on): double-tap, hold on the second tap, then drag delivers events and the phone vibrates when the cursor crosses a line. TalkBack starts the virtual finger at the centre of the focused element; movement is relative. A2 and A3 untested. A4 (suspend TalkBack) is not needed.
- Decision: stay on web. The Capacitor runtime is **not** needed for the MVP (item 5 of the original plan is dropped); it stays an optional Phase 2 experiment.
- Not yet done: Gate B (vision accuracy on real photos), so item 4 (teacher correction into the MVP) is left open below.

## Paste into Kiro chat
```
Update the ghost-touch spec with these changes, keeping EARS format and existing numbering:

1. New Requirement 13 "Works with TalkBack"
   User story: As a blind student who keeps TalkBack on, I want to explore a diagram by touch without turning TalkBack off, so that I can use my phone the way I always do.
   Acceptance criteria:
   13.1 WHEN the Explore screen opens THE system SHALL speak the explore gesture: "Double-tap and hold, then drag to feel the diagram. You start at the centre.", and SHALL move focus to the explore canvas.
   13.2 WHEN TalkBack is active AND the user double-taps and holds on the canvas and then drags THE system SHALL treat the pointer position as a cursor and SHALL apply the line, corner, bar and tone rules of Requirements 4, 5 and 6 to that cursor.
   13.3 WHEN a new hold starts THE system SHALL start the cursor at the centre of the diagram and SHALL play a single centre reference tick (a short pulse distinct from the line and corner patterns).
   13.4 THE system SHALL give the same behaviour when TalkBack is off, where a direct touch or the same gesture moves the cursor.
   13.5 WHEN the user presses the Android Back button or performs the system or TalkBack Back gesture, OR activates the labelled Back button THE system SHALL leave Explore and speak the Capture prompt. WHEN TalkBack is off, a two-finger swipe down SHALL also leave Explore.
   13.6 THE system SHALL NOT rely on a two-finger gesture as the only way to leave Explore.
   13.7 WHEN the spoken text of a screen is also shown on screen THE system SHALL NOT make the screen reader read it a second time.

2. Requirement 2: add "upload a screenshot or a PDF page (first page only)" as an input. PDF pages are rendered to an image in the browser before upload. Files over the size limit are refused with a spoken reason, and the limit for camera photos is applied after they are shrunk or at 50 MB raw.

3. Requirement 3: add "labels SHALL use subject vocabulary; the validator SHALL reject a scene whose point, segment or polyline labels consist only of colour or generic shape words (for example 'blue polygon') and the backend SHALL retry once, then fall back to Raw Mode."

4. [LEFT OPEN until Gate B is decided] If Gate B shows fewer than 6 of 10 real photos usable, move Requirement 9 (teacher correction) into the MVP scope.

5. Design properties: add P12 "explore gesture events reach the engine" (an integration test with synthetic pointer events through hitTest, step and runEffects, including a lift) and P13 "validator rejects colour- or shape-only labels" (labels made only of words from the colour/shape list are rejected; labels with any other word are accepted).

6. Add the centre reference tick to the haptic vocabulary table in tech.md as "proposed, pending approval": one 25 ms pulse. Do not change the existing tuned values.

Then update tasks.md with new tasks for each change, marked with their requirement numbers: Explore screen with the relative cursor (7.x, requirement 13), PDF first page upload (6.x, requirement 2), validator vocabulary rule and retry (8.3, requirement 3), P12 and P13.
```

## Notes for the owner
- Wording of 13.1 is the exact string already planned for `docs/briefs/T07-explore.md`.
- 13.7 comes from the double-reading concern; the T06 fix hides text from the screen reader when the app speaks it.
- Item 6 keeps the tuned values safe: the tick is a new, separately named pattern.
- If you prefer to keep `tech.md` untouched until you test the tick on the phone, drop item 6.
