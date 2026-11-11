# Requirements Document

## Introduction
Ghost Touch turns a photo of a STEM diagram into something a blind or low-vision student can explore by touch on an Android phone. A vision LLM converts the photo into a structured `DiagramScene`. The student drags a finger across the screen and receives vibration, speech, and pitch feedback. The student can also ask spoken questions about the diagram.

**MVP (STEMergent, Nov 15):** Requirements 1–8.
**Polish (Kiroween, Dec 4):** Requirements 9–12.

## Glossary
- **DiagramScene:** normalized JSON description of a diagram (points, segments, polylines, bars, labels, axes).
- **Target:** whatever is under the finger: a vertex, a line, or nothing.
- **Raw Mode:** fallback exploration that vibrates on edges detected directly from the image, with no AI understanding.
- **Quiet window:** the period after a corner pulse during which line vibration is suppressed.

---

### Requirement 1: Start and audio/haptic unlock
**User Story:** As a blind student, I want the app to wake up its vibration and sound with one tap anywhere, so that I don't need to find a small button.

#### Acceptance Criteria
1. WHEN the app opens THEN the system SHALL show a full-screen start surface and SHALL speak "Ghost Touch. Tap anywhere to begin."
2. WHEN the user taps anywhere on the start surface THEN the system SHALL unlock vibration, audio, and speech, play a short confirmation vibration, and move to the Capture screen.
3. IF the Vibration API is unavailable THEN the system SHALL announce that vibration is not supported and recommend Chrome on Android, and SHALL continue with audio-only feedback.
4. (Kiro, task 41, testable form of 1.3; code merged by Antigravity in `5bf9b1e`, lane W3) WHEN the haptic driver reports `supported = false` THEN the system SHALL play a short audible buzz for every `vibrate` effect, SHALL show a visual pulse at the touch point, and SHALL speak "No vibration on this device. You will hear a buzz instead. Use Chrome on Android to feel it." (`explore.noVibration`) once on entering Explore. A number n > 0 SHALL give one buzz of n ms at offset 0. A pattern [on, off, on, …] SHALL give one buzz per ON entry (even index) whose duration is positive and finite, at an offset equal to the running sum of every earlier positive, finite entry, with that entry's duration. Zero, negative and non-finite entries SHALL give no buzz and SHALL NOT move the offset.
5. WHEN the haptic driver reports `supported = true` THEN the buzz, the pulse and the notice SHALL NOT occur, and vibration SHALL work exactly as before.

### Requirement 2: Capture a diagram
**User Story:** As a student or teacher, I want to photograph a textbook diagram, so that it can be explored by touch.

#### Acceptance Criteria
1. WHEN the user activates "Take photo" THEN the system SHALL open the rear camera.
2. WHEN the user selects "Choose image" THEN the system SHALL accept JPEG, PNG, WebP, or PDF (first page only, rendered to an image in the browser before upload).
3. WHEN an image is submitted THEN the system SHALL announce "Reading your diagram" and play a soft repeating progress tone until a result arrives.
4. THE system SHALL offer at least three bundled sample diagrams (triangle, sine graph, bar chart) usable without a camera or network.
5. WHEN a file exceeds 50 MB raw THEN the system SHALL refuse it and SHALL speak the reason. Camera photos SHALL be shrunk to 1600 px longest side before the size limit is applied.

### Requirement 3: Convert image to DiagramScene
**User Story:** As a student, I want the app to understand what the diagram contains, so that I feel shapes and hear meaningful labels instead of noise.

#### Acceptance Criteria
1. WHEN the backend receives an image THEN it SHALL return a `DiagramScene` classified as one of: `geometry`, `function_graph`, `bar_chart`, or `unknown`.
2. THE system SHALL express every coordinate in the `DiagramScene` normalized to the range [0, 1].
3. WHEN the vision LLM returns output that fails schema validation THEN the backend SHALL retry once, and IF the retry also fails THEN it SHALL return a Raw Mode scene.
4. THE backend SHALL respond within 15 seconds, or return a Raw Mode scene with a `timeout` reason.
5. THE system SHALL give every element in a `DiagramScene` a unique id, and every segment endpoint SHALL refer to an existing point.
6. THE system SHALL reject a scene whose point, segment, or polyline labels consist only of colour or generic shape words (for example "blue polygon"). The backend SHALL retry once, and IF the retry also fails THEN it SHALL fall back to Raw Mode.

### Requirement 4: Explore by touch
**User Story:** As a blind student, I want to drag my finger over the diagram and feel its lines and corners, so that I can build a mental picture of its shape.

#### Acceptance Criteria
1. WHILE the finger is within the line hit radius of any segment or polyline THEN the system SHALL produce continuous line vibration.
2. WHEN the finger leaves all lines THEN the system SHALL stop line vibration, unless a corner pulse is still playing.
3. WHEN the finger enters the vertex hit radius of a point THEN the system SHALL play the corner pattern once and SHALL speak the point's label (for example "Point B").
4. WHILE the finger stays on the same vertex THEN the system SHALL NOT repeat the corner pattern or the speech.
5. WHEN a corner pattern starts THEN the system SHALL suppress line vibration for the quiet window, so a corner is never merged with a line buzz.
6. IF a point lies within both the vertex radius and the line radius THEN the system SHALL treat it as a vertex.
7. WHEN the finger lifts THEN the system SHALL stop all vibration and tones.
8. WHEN multiple fingers touch the Explore canvas and the primary finger lifts while another finger remains in contact, the system SHALL immediately promote the oldest remaining active pointer to primary, update cursor tracking, and continue delivering haptic and tone effects without entering a dead-zone. (agy, awaiting Kiro review)

### Requirement 5: Hear graph height (theremin)
**User Story:** As a blind student studying functions, I want to hear the curve rise and fall, so that I understand its shape and turning points.

#### Acceptance Criteria
1. WHILE the finger is on a function curve THEN the system SHALL play a continuous tone whose pitch rises as the curve point is higher on the graph.
2. THE system SHALL map pitch to the range 200–1000 Hz.
3. WHEN the finger leaves the curve THEN the system SHALL fade the tone out within 100 ms.
4. WHEN the finger crosses an axis THEN the system SHALL speak "x-axis" or "y-axis" once per crossing.

### Requirement 6: Explore bar charts
**User Story:** As a blind student, I want to compare bars in a chart by touch, so that I can tell which values are larger.

#### Acceptance Criteria
1. WHEN the finger enters a bar THEN the system SHALL speak the bar's label and value.
2. WHILE the finger is inside a bar THEN the system SHALL play a tone whose pitch is proportional to the bar's value.
3. THE system SHALL vibrate at bar edges using the line pattern.

### Requirement 7: Ask questions by voice
**User Story:** As a blind student, I want to ask questions about the diagram out loud, so that I can learn without needing someone to describe it.

#### Acceptance Criteria
1. WHEN the user long-presses with two fingers or activates "Ask" THEN the system SHALL start listening and play a listening tone.
2. WHEN a question is recognized THEN the backend SHALL answer using only the `DiagramScene` and the question, and the system SHALL speak the answer.
3. IF the answer requires information not present in the scene THEN the system SHALL say it does not know rather than guess.
4. WHERE speech recognition is unavailable THE system SHALL offer a text input field.

### Requirement 8: Raw Mode fallback
**User Story:** As a student, I want to still feel the picture when the AI cannot understand it, so that the app never leaves me with nothing.

#### Acceptance Criteria
1. WHEN a Raw Mode scene is shown THEN the system SHALL announce "I couldn't fully read this diagram. You can still feel its outlines."
2. THE backend SHALL convert detected image edges into simplified segments with at most 300 segments.
3. WHILE in Raw Mode THEN the system SHALL apply the same line vibration rules as Requirement 4.

### Requirement 9: Teacher correction (Kiroween)
**User Story:** As a teacher, I want to fix labels and points the AI misread, so that my student explores an accurate diagram.

#### Acceptance Criteria
1. WHEN a sighted user opens Correct mode THEN the system SHALL overlay the detected scene on the photo.
2. THE system SHALL allow dragging points, editing labels, and deleting elements.
3. WHEN corrections are saved THEN the system SHALL validate the scene against the schema before using it.
4. WHEN a point is moved THEN the system SHALL clamp coordinates to [0, 1].
5. WHEN a point is deleted THEN the system SHALL remove every segment and polyline reference to that point, ensuring no dangling references remain.
6. WHEN a label is edited THEN the system SHALL trim whitespace and reject empty labels.
7. THE system SHALL provide undo and redo operations that cleanly restore or re-apply scene states.
8. WHEN saving corrections THEN the system SHALL send the scene to the validation endpoint; IF validation fails THEN the system SHALL speak and display the validation errors and remain in Correct mode; IF validation succeeds THEN the system SHALL apply the scene and return to Explore.
9. THE system SHALL provide accessible controls with minimum 48×48 CSS px touch targets, accessible names, and spoken feedback for all state changes.

### Requirement 10: Multilingual voice (Kiroween)
**User Story:** As a Hindi- or Gujarati-speaking student, I want labels and answers in my language.

#### Acceptance Criteria
1. THE system SHALL support English, Hindi, and Gujarati for all spoken output and UI strings.
2. WHEN the language changes THEN the system SHALL apply it to speech output and question answering.

### Requirement 11: Saved diagrams (Kiroween)
**User Story:** As a student, I want my diagrams saved on my phone, so that I can revisit them offline.

#### Acceptance Criteria
1. WHEN a scene is loaded successfully THEN the system SHALL save it locally with its thumbnail and a spoken title derived from the scene (the scene's title if present, otherwise the scene kind followed by the first labelled point names in the active language).
2. WHILE offline THEN the system SHALL allow exploring saved diagrams without making any network call.
3. WHEN the user opens the Saved Diagrams list THEN the system SHALL read out each entry's title in the list order, and SHALL let the user open or delete any entry by touch or by voice.
4. WHEN a saved diagram is opened THEN the system SHALL go to the Explore screen without contacting the backend.
5. THE system SHALL keep at most 20 saved diagrams; WHEN a new diagram would exceed that cap THEN the system SHALL evict the oldest unpinned entry before saving. IF all existing entries are pinned THEN the new diagram SHALL NOT be saved and the system SHALL say so.
6. WHEN the user pins a saved diagram THEN the system SHALL mark it as protected from automatic eviction.
7. WHEN local storage is unavailable or full THEN the system SHALL continue to work, SHALL NOT crash, and SHALL speak a brief explanation.

### Requirement 12: Accessibility and theme
**User Story:** As a blind or low-vision user, I want the whole app to work with TalkBack and high contrast, so that I can use it independently.

#### Acceptance Criteria
1. THE system SHALL give every control an accessible name and a touch target of at least 48×48 CSS px.
2. THE system SHALL use a dark theme with glowing green lines and a contrast ratio of at least 7:1 for text.
3. WHILE the Explore canvas is active THEN the system SHALL capture touches directly, and SHALL provide a clearly announced exit gesture (for example, a two-finger swipe down).

### Requirement 13: Works with TalkBack
**User Story:** As a blind student who keeps TalkBack on, I want to explore a diagram by touch without turning TalkBack off, so that I can use my phone the way I always do.

#### Acceptance Criteria
1. WHEN the Explore screen opens THEN the system SHALL speak the explore gesture: "Double-tap and hold, then drag to feel the diagram. You start at the centre.", and SHALL move focus to the explore canvas.
2. WHEN TalkBack is active AND the user double-taps and holds on the canvas and then drags THEN the system SHALL treat the pointer position as a cursor and SHALL apply the line, corner, bar and tone rules of Requirements 4, 5 and 6 to that cursor.
3. WHEN a new hold starts THEN the system SHALL start the cursor at the centre of the diagram and SHALL play a single centre reference tick (a short pulse distinct from the line and corner patterns).
4. THE system SHALL give the same behaviour when TalkBack is off, where a direct touch or the same gesture moves the cursor.
5. WHEN the user presses the Android Back button or performs the system or TalkBack Back gesture, OR activates the labelled Back button THEN the system SHALL leave Explore and speak the Capture prompt. WHEN TalkBack is off, a two-finger swipe down SHALL also leave Explore.
6. THE system SHALL NOT rely on a two-finger gesture as the only way to leave Explore.
7. WHEN the spoken text of a screen is also shown on screen THEN the system SHALL NOT make the screen reader read it a second time.

8. WHEN entering the Explore screen and the prompt is spoken via speech synthesis, the explore canvas SHALL NOT expose an identical verbose accessible label that triggers concurrent screen reader speech. StatusText SHALL serve as the polite screen reader fallback only when speech synthesis is unsupported. (agy, awaiting Kiro review)


### Requirement 14: Frankenstein's Laboratory theme and sensory aesthetics
*(Note: Written by Antigravity (agy) on the owner's instruction, awaiting Kiro review; retroactively formalizes the Frankenstein Laboratory visual and sensory theme implemented by Antigravity).*

**User Story:** As a blind or low-vision STEM student, I want the Frankenstein's Laboratory visual and sensory theme to provide extreme contrast, legible typography, tactile clarity, and photosensitive safety without compromising non-visual exploration.

#### Acceptance Criteria
1. **Contrast:** All body and title text SHALL meet WCAG AAA contrast of at least 7:1 against dark surfaces (`--gt-text` #eafff5 > 18:1, `--gt-text-primary` #f5fff8 > 18:1, `--gt-bone` #ded6c4 > 13:1, `--gt-text-muted` #a8c5b5 > 10:1), and UI boundaries/borders SHALL meet at least 4.5:1.
2. **Touch targets:** Every interactive control SHALL provide an accessible name and a minimum touch target of 48×48 CSS px (`--gt-target`: 48px).
3. **Typography:** Atkinson Hyperlegible (400 and 700 weights) SHALL be self-hosted as woff2 files in `frontend/src/assets/fonts/` with `font-display: swap` and precached by the service worker; Indian language fallbacks (`'Nirmala UI'`, `'Noto Sans Devanagari'`, `'Noto Sans Gujarati'`) SHALL be maintained.
4. **Reduced motion:** WHEN `prefers-reduced-motion: reduce` is active THEN the system SHALL disable all glowing animations, pulse transitions, and electric arcs, providing static non-animated visuals.
5. **Photosensitive safety & animation limits:** WHEN a diagram scene finishes loading THEN the system SHALL show the "IT'S ALIVE" spark sequence for at most 1.2 s, flashing at most 3 times per second (WCAG 2.3.1 compliance, ~2.1 Hz), accompanied by the existing success earcon.
6. **Tactile canvas purity:** WHILE exploring a diagram on the Explore canvas THEN the drawing area SHALL remain pure high-contrast glowing green lines on near-black background (`#0b0e0c`) with NO decorative textures, blueprint grids, stitches, or rivets inside the canvas that could interfere with touch exploration.
7. **Full internationalization:** Every user-facing string SHALL flow through `t()` with complete parity across `en`, `hi`, and `gu` in `frontend/src/i18n/index.ts`.
8. **Accessible brand assets:** Brand assets (`logo-mark.svg`, `logo-full.svg`, `Mascot.tsx`) SHALL respect the neck-bolt exclusion zone rule, enforce file size limits (<6 KB for brand icons, <10 KB for og-image), and mark all purely decorative graphics with `aria-hidden="true"`.

### Requirement 15: Backend Security and Resource Robustness (agy, awaiting Kiro review)
**User Story:** As a visually impaired student using Ghost Touch over mobile networks, I want the backend to remain stable, prevent out-of-memory crashes, respect mobile photo orientations, and securely bound requests.

#### Acceptance Criteria
1. THE backend SHALL bound simultaneous heavy vision and OpenCV scene extractions using a concurrency semaphore (concurrency <= 2), returning HTTP 429/503 with Retry-After when saturated to prevent container OOM crashes (SEC-01). (agy, awaiting Kiro review)
2. THE backend SHALL cap image dimensions to at most 12 megapixels before decompression in OpenCV (SEC-02). (agy, awaiting Kiro review)
3. WHEN a client disconnects during in-flight processing THEN the backend SHALL abort model calls and worker thread tasks promptly (SEC-03). (agy, awaiting Kiro review)
4. THE backend SHALL account for EXIF orientation metadata when computing diagram coordinates in Raw Mode so orientation matches camera photos (SEC-04). (agy, awaiting Kiro review)
5. THE backend SHALL enforce element count bounds on `POST /api/v1/validate` (max 500 points, 1000 segments) to prevent resource exhaustion (SEC-06). (agy, awaiting Kiro review)
6. THE backend SHALL omit interactive OpenAPI documentation (`/docs`, `/redoc`) in production and emit `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` headers (SEC-07, SEC-08). (agy, awaiting Kiro review)

### Requirement 16: Security and robustness, round 2 (Kiro)
**User Story:** As the owner of a free-tier service that pays per model call, I want abusive or malformed traffic to be bounded and visible, so that students keep getting answers and the bill stays predictable.

#### Acceptance Criteria
1. THE backend SHALL identify a client for rate limiting by the network peer address, EXCEPT that WHERE the request arrives through a trusted proxy (the number of trusted hops is configured, and defaults to one hop on Render and zero elsewhere) THEN it SHALL use the address that the trusted proxy appended to `X-Forwarded-For`, counted from the right. Entries the client wrote itself SHALL NOT change the client key. (A6-01)
2. THE backend SHALL NOT keep rate-limit state for a client whose request window has expired; memory used by the limiter SHALL be bounded by the number of clients active in the last window. (A6-02)
3. THE backend SHALL bound simultaneous `POST /api/v1/ask` model calls with a concurrency cap (default 4, configurable) and SHALL answer HTTP 503 with `Retry-After` when the wait for a slot exceeds a short limit, in the same way as `POST /api/v1/scene`. (A6-03)
4. THE frontend host and the backend SHALL send a `Content-Security-Policy` that allows only what the PWA needs (own scripts, styles, fonts, images, worker, and the API origin) and SHALL forbid framing and plugins. A production build served by `vite preview` SHALL produce no CSP violation in normal use. (A6-04)
5. THE backend SHALL apply body-size and rate-limit guards to a guarded route regardless of trailing or repeated slashes in the request path. (A6-05)
6. THE frontend host SHALL send `Strict-Transport-Security` and a `Permissions-Policy` that grants camera and microphone to the app only. (A6-06)
7. THE backend SHALL read the dimensions of a WebP image whose first chunk is not the image bitstream, and SHALL bound the candidate work Raw Mode does before it keeps its 300 segments. (A6-07, A6-08)
8. THE CI workflow SHALL declare read-only token permissions and SHALL use action versions that exist. THE backend SHALL bound background improve passes with their own concurrency cap. WHEN a streamed body exceeds its limit THEN the backend SHALL answer HTTP 413, not 500. (A6-09, A6-10, A6-15)
9. WHEN a client disconnects while `POST /api/v1/ask` is waiting for a model THEN the backend SHALL stop the work and SHALL answer HTTP 499.
10. A spoken answer built from scene facts SHALL pass through the same length and sentence limit as a model answer. A model answer that is not a string SHALL be rejected. A lone unit word in a question SHALL NOT select a fact. A "don't know" answer SHALL be recognised whether it ends in `.`, `।` or `॥`, and SHALL carry no target. The point named "A" SHALL be answerable. (CORE-04, CORE-05, CORE-11, CORE-12)
11. THE `Ask` and `Validate` endpoints SHALL accept any scene the Teacher Share contract allows (polylines up to 2000 points); `Validate` SHALL keep its own structural limits. (CORE-06, A2 contract)
12. THE hit test SHALL treat a non-finite distance as a miss. (NEEDS-KIRO-01)

### Requirement 17: Navigation and announcement integrity (Kiro)
**User Story:** As a blind user, I want every screen change and every landmark to be spoken, and nothing I did to be lost silently, so that I never wonder where I am.

#### Acceptance Criteria
1. WHEN the user leaves a screen with the browser or Android Back control, including `#/teach`, `#/share` and the share error screen, THEN the system SHALL speak the destination prompt. IF the Teacher editor has unsaved changes THEN the system SHALL ask for confirmation before discarding them and SHALL stay on the editor until the user confirms. (CORE-01)
2. WHEN a single pointer move produces more than one announcement (axis crossings and a vertex) THEN the system SHALL speak them as one utterance, in the order axis crossings first, then the vertex or bar, with nothing dropped. (CORE-02)
3. WHEN the user leaves a screen before its asynchronous work finishes THEN the system SHALL NOT speak or change state on behalf of that screen. (CORE-03)
4. WHEN the last saved diagram is deleted THEN the system SHALL speak the deletion and the empty list as one utterance and SHALL return focus to the screen heading. (CORE-07)
5. IF the browser refuses pointer capture THEN Explore SHALL carry on working; WHEN the browser revokes pointer capture THEN the Teacher canvas SHALL end the drag. (CORE-08, CORE-09)
6. THE notice that no voice is installed for the chosen language SHALL come from the language tables. (CORE-10)

### Requirement 18: Spec Ghost, an honest check of printed facts against the drawing (spec after code)
> **Provenance, stated plainly:** this requirement was written by Kiro on 2026-11-09 AFTER the feature was built. The feature was chosen by an agent tournament (`docs/reports/feature-tournament.md`) and built by Antigravity: the module `frontend/src/verify/verify.ts`, its first tests (`frontend/tests/verify.test.ts`, P47-P50) and the wiring (lane k1). Criteria 6 and 7 below are Kiro's additions from the review; the module was changed to meet them (task 29).

**User Story:** As a blind student, I want to be told when the numbers printed on a diagram do not match the shape that was drawn, so that I do not build a wrong picture in my head, and I want silence when the app cannot be sure.

#### Acceptance Criteria
1. WHEN a scene is loaded (photo in AI or Raw Mode, sample, saved diagram, or shared link) THEN the system SHALL compare the scene's parsed facts with its drawn geometry once, and IF they disagree THEN it SHALL add exactly one sentence to the scene's entry announcement, spoken as one utterance with it.
2. THE sentence SHALL be "Facts and drawing disagree on {name}. I can't tell which is right." (with `{name}` the side, angle or bar named by the fact), translated in Hindi and Gujarati. For an angle, `{name}` is "angle B" in English and the language's own word for angle followed by the vertex in Hindi and Gujarati; the spoken caveat SHALL NOT contain the English word "angle" in Hindi or Gujarati. (M4-10, Kiro) THE check SHALL NEVER say "verified", "correct" or anything that claims the diagram is right; a consistent result SHALL add nothing.
3. THE system SHALL compare lengths only as ratios between sides (or between bars), never as absolute sizes. A side SHALL disagree when its ratio to the others differs by more than 15 %, or 25 % when the scene came from the AI.
4. THE system SHALL compare a stated angle with the drawn angle at that vertex and SHALL report a disagreement only when they differ by more than 8 degrees. IF the drawn angle cannot be determined (the vertex does not have exactly two incident sides and no three-letter name is given) THEN that angle SHALL be skipped.
5. THE system SHALL stay silent WHEN fewer than two lengths (or bar values) are matched to drawn elements, WHEN any fact says the figure is "not to scale" or "not drawn to scale", or WHEN no fact can be parsed. Facts that cannot be parsed SHALL be ignored, never guessed.
6. THE system SHALL measure drawn lengths and angles in the diagram's own proportions: horizontal distances are multiplied by the scene's `aspect` (width / height, default 1), the same rule the backend Ask uses (`semantic.py`). A scene whose drawing matches its facts SHALL never be flagged, whatever its aspect. (Kiro, review)
7. WHEN matched lengths are given in different units THEN the system SHALL convert known length units (mm, cm, m, km, in, ft) to one unit before comparing, and IF any unit is not known THEN it SHALL stay silent. (Kiro, review)
8. WHEN the student asks a question that names a disputed side, angle or bar (in either letter order, for example AC or CA) THEN the system SHALL put the same sentence in front of the spoken answer; questions about other elements SHALL be answered unchanged.
9. THE check SHALL be a pure function of the scene: the same scene SHALL give the same result whatever the order of its facts or elements, and whatever uniform scale or translation is applied to its coordinates.
11. (Kiro, K4 CORE-A1) A sentence that calls the whole figure a right-angled triangle ("ABC is a right angled triangle", "Triangle ABC is a right angle triangle", "triangle ABC is right-angled") is not an angle fact. Only "X is a right angle" with "angle" ending the phrase SHALL be read as a 90 degree angle at X. A scene with such a fact and a consistent drawing SHALL NOT be flagged.
10. Non-goal (Kiro, task 39.3): facts are parsed in English only. The vision prompt (`backend/app/vision/prompts.py`) asks the model for facts in fixed English shapes ("AB = 3 cm", "angle B = 90°") whatever the UI language, and no screen lets a person type a fact. A fact in Hindi or Gujarati SHALL be ignored like any other unparsed fact (18.5), so it SHALL never produce a disagreement; it SHALL NOT be guessed at.

### Requirement 19: Ghostwriter, add what the AI missed (Teach mode only)
> Written by Kiro on 2026-11-09 BEFORE the code (spec first). This requirement covers the two pure edits in `frontend/src/core/correct.ts` only. The Teach screen hook-up is a later Antigravity lane; it adds no new screen and no new gesture.

**User Story:** As a teacher correcting a scene the vision model read, I want to add a corner or an edge it missed, so that the student feels the whole diagram and not only what the model saw.

#### Acceptance Criteria
1. WHEN the teacher adds a point at (x, y) THEN the system SHALL return a new scene with exactly one more point, whose coordinates are x and y clamped to [0, 1] and whose id is not used by any point, segment, polyline or bar of the scene. The label SHALL be optional. Every existing element SHALL stay exactly as it was, and the input scene SHALL NOT be mutated.
2. WHEN the teacher adds a segment from point a to point b THEN the system SHALL return a new scene with exactly one more segment from a to b, IF both points exist, a and b are different, and no segment already joins a and b in either direction. OTHERWISE the system SHALL return the same scene object, unchanged.
3. WHEN the input scene passes `validateSceneInvariants` THEN the result of adding a point or a segment SHALL also pass it.
4. IF x or y is NaN or infinite THEN the system SHALL NOT add a point and SHALL return the same scene object, unchanged.
5. THE two edits SHALL be undoable and redoable through the existing `applyEdit` / `historyReducer` history, with no new action type: undo SHALL restore the previous scene exactly.
6. AFTER any edit, Spec Ghost SHALL NOT say the scene is "verified" or "correct". An added element is the teacher's work, not a check result; the Spec Ghost wording (Requirement 18.2) is not changed.

### Requirement 20: Ghostwriter in Teach mode (UI for Requirement 19)
> Written by Kiro on 2026-11-09 before the code, for the Antigravity lane g1 (`docs/briefs/agy-g1-ghostwriter-ui.md`). Where the brief and this requirement differ, this requirement wins (AGENTS.md). "Teach screen" means `screens/Teach.tsx` (`#/teach`). The pure edits are `addPoint` and `addSegment` in `core/correct.ts` (Requirement 19).

**User Story:** As a teacher preparing a diagram to share, I want to add a corner or an edge the vision model missed, and hear what I did, so that the shared diagram is complete and I can undo a mistake.

#### Acceptance Criteria
1. THE add-point and add-edge controls SHALL appear only on the Teach screen. The student Explore screen, its gestures, haptics and announcements SHALL NOT change.
2. Add point:
   1. THE Teach screen SHALL have an "Add point" control with an accessible name, a touch target of at least 48 × 48 CSS px, and a spoken label when focused or activated.
   2. WHEN the control is activated THEN the system SHALL arm add-point mode and speak how to place the point. WHILE add-point mode is armed, the next tap on the canvas SHALL call `addPoint` at the tapped position converted to normalized coordinates with the existing canvas conversion, and SHALL disarm the mode.
   3. WHILE add-point mode is armed, activating the control again SHALL place the point at the centre (0.5, 0.5), so the add works without a canvas tap (keyboard, switch access, TalkBack). The existing nudge controls then move it.
   4. THE teacher MAY give a label; it SHALL be trimmed and limited to 60 characters (`LIMITS.maxLabel`). A blank label SHALL leave the point unlabelled.
   5. WHEN a point is added THEN the system SHALL speak a confirmation that names the new id and, if there is one, the label. An unlabelled point SHALL be named with the existing `vertex.unlabelled` wording ("Point D").
   6. THE existing "Add vertex" control SHALL become this "Add point" control. There SHALL be one way to add a point on the Teach screen, and it SHALL use `addPoint`, so new ids follow Requirement 19.1 (`A` … `Z`, then `P1`, `P2`, …).
3. Add edge:
   1. THE Teach screen SHALL have an "Add edge" control with the same accessibility rules as 20.2.1.
   2. WHEN it is activated THEN the system SHALL speak "choose the first point". WHEN a point is chosen (canvas tap within the existing point hit radius, or the existing point selection) THEN the system SHALL speak its name and ask for the second point. WHEN the second point is chosen THEN the system SHALL call `addSegment(scene, first, second)`.
   3. IF `addSegment` returns the same scene object THEN the system SHALL speak the reason and SHALL NOT be silent: "same point" when first and second are equal, "already joined" when a segment joins them in either direction, "point not found" when an endpoint no longer exists.
   4. WHEN an edge is added THEN the system SHALL speak a confirmation naming both endpoints.
   5. Activating either add control again while add-edge mode waits, or pressing Escape, SHALL cancel the pending pick, speak that it was cancelled, and change nothing.
4. Every add SHALL be applied through the existing history (`applyEdit`, the `apply` action of `historyReducer`); a no-op SHALL NOT create a history entry. Undo and redo SHALL revert and re-apply each add. WHEN an add is undone THEN the system SHALL speak what was undone (the point's id, or both endpoints of the edge); other undos keep the existing wording.
5. THE Teach screen SHALL refuse an add that would make the scene too big to share or to send to the backend, and SHALL speak why. The point cap is the smaller of `LIMITS.maxPoints` (`frontend/src/share/limits.ts`, 300) and the backend `MAX_SCENE_POINTS` (500), so 300 today; the segment cap is the smaller of `LIMITS.maxSegments` (300) and `MAX_SCENE_SEGMENTS` (1000). A refused add SHALL leave the scene and history unchanged.
6. Spec Ghost (Requirement 18) SHALL treat an edited scene exactly as any other: the add path SHALL add no Spec Ghost call of its own, remove none, and SHALL NOT change, soften or suppress its sentence. A scene that was silent may report a disagreement once an added element makes a fact match the drawing; that is intended. No new string, in any language, SHALL contain "verified", "correct", "checked" or "approved" (or a translation of them).
7. Every new user-facing string SHALL go through `t()` / `tf()`, SHALL exist in `en`, `hi` and `gu` in `frontend/src/i18n/index.ts` with the same placeholders, and SHALL be listed in `docs/user-test/translation-review.csv` and `.md` for native review. Hindi and Gujarati values SHALL NOT be the English text.
8. THE decision logic (arming and picking state, label handling, the caps, the no-op reasons, the undo description) SHALL live in a pure module in `frontend/src/flow/` with no React and no browser API, and SHALL have property tests of at least 200 runs (P58-P61). `screens/Teach.tsx` SHALL only call it, apply the result to history and speak the returned text.

### Requirement 21: Correct mode can delete curves and bars (core half of Requirement 9.2)
> Written by Kiro on 2026-11-09 before the code (task 37.1, from review follow-up 20.5). This covers the pure edits in `frontend/src/core/correct.ts`. Selecting and deleting curves and bars on the Correct screen is a later Antigravity lane; design.md lists what it must add.

**User Story:** As a teacher correcting a scene, I want to remove a curve or a bar the vision model invented, as I can already remove a point or a line, so that the student does not feel something that is not in the diagram.

#### Acceptance Criteria
1. WHEN `deletePolyline(scene, id)` is called with the id of a polyline in the scene THEN the system SHALL return a new scene without that polyline. Every point, segment and bar, every other polyline (in order) and every other field of the scene SHALL stay exactly as it was.
2. WHEN `deleteBar(scene, id)` is called with the id of a bar in the scene THEN the system SHALL return a new scene without that bar. Every point, segment and polyline, every other bar (in order) and every other field SHALL stay exactly as it was.
3. IF no polyline (for `deletePolyline`) or no bar (for `deleteBar`) has the given id THEN the function SHALL return the same scene object. An id that belongs to an element of another kind SHALL count as unknown.
4. Neither function SHALL mutate its input scene or any array or element in it.
5. WHEN the input scene passes `validateSceneInvariants` THEN the result SHALL also pass it.
6. Both deletions SHALL be undoable and redoable through the existing `applyEdit` / `historyReducer` history with no new action type. Undo SHALL restore the previous scene object exactly; an unknown id SHALL create no history entry.
7. THE core SHALL allow deleting the last drawable element of a scene. Whether a scene with nothing left to feel may be shared or explored is decided by the validators (`share/validate.ts`, `backend/app/validate.py`), not by these edits.

### Requirement 22: Round-5 audit invariants, pinned as property tests before the fixes merge
> Written by Kiro on 2026-11-09 before the tests (task 38). The brief asked for "Requirement 21"; that number is taken by the delete-curves-and-bars spec (commit aed5e3d), so this is Requirement 22 and the properties are P66-P78. Source: `docs/reports/audit-r5-share-a11y.md` (R5-01, R5-02, R5-06), `docs/reports/audit-r5-saved-api.md` (R5-06 and the cap and pinning rules around it), and the fix briefs `docs/briefs/agy-p2-r5-saved-fixes.md` and `docs/briefs/agy-p3-r5-share-fixes.md`. These are tests only: no source file is edited by this requirement. They were written while lanes p2 (saved diagrams) and p3 (share and accessibility) were believed unmerged; both had in fact merged into `main` (2d108ca) before the tests first ran, so a failure is a gap the fixes left, not a fix still to come. The failing list with shrunk counterexamples is `docs/reviews/kiro-round5.md`.

**User Story:** As the maintainer, I want the invariants behind the round-5 HIGH findings written as property tests before any fix merges, so that each fix lane proves its change against one fixed oracle, and a later edit cannot quietly reopen the hole.

#### Definitions
- A **badge word** is "verified" or "certified" in any letter case, "सत्यापित" or "પ્રમાણિત", when the character after it is not a letter, a combining mark or a number (so "Verifiedcity" is a name, and "Verified✅" is a badge).
- A **check mark** is one of ✓ ✔ ☑ √ ✅ 🗹, optionally followed by U+FE0F.
- An **invisible mark** is a directional character (U+200E, U+200F, U+202A-U+202E, U+2066-U+2069), a zero-width character (U+200B-U+200D, U+2060, U+FEFF), a variation selector, or a combining mark.
- A **connector** is "and" (any case), "&", or one of `: , . -`.

#### Acceptance Criteria
1. FOR ANY string built from badge words, check marks, invisible marks, whitespace, connectors and ordinary text in any order, THE result of `sanitizeShareName` and of `sanitizeShareTitle` SHALL NOT begin with a badge word, a check mark, an invisible mark or whitespace.
2. WHEN the input contains at least one badge word or check mark and nothing else except invisible marks, whitespace and connectors, THEN both functions SHALL return the empty string.
3. FOR ANY input, `f(f(x))` SHALL equal `f(x)` for both functions.
4. WHEN a prefix that contains at least one badge is followed by ordinary text that contains neither the word "and" nor "&", THEN the result SHALL end with that ordinary text and SHALL contain neither the word "and" nor "&" (no connector is left over from stripping).
5. WHEN the input is ordinary text with no badge, check mark, invisible mark or connector at its start, THEN both functions SHALL return it unchanged. A name such as "Andrew", "Verity" or "Verifiedcity" is ordinary text.
6. WHEN an author name or a title contains `$`, `$&`, `$'`, `` $` ``, `$1` or `$$`, THEN, in `en`, `hi` and `gu`, `honestSharedByLabel`, `formatShareTitleAnnouncement`, `exploreAnnouncement` (shared mode, `honestTitle`) and `buildHonestShareAnnouncement` SHALL each contain that name or title exactly once and SHALL NOT contain a literal `{name}` or `{title}`.
7. FOR ANY sequence of saves, pins, unpins and one-shot failures of `put` and `delete`, against a `DiagramStore` with and without `putWithEviction`, and for any cap in {2, 3, 5, `SAVED_DIAGRAMS_CAP`}, THE store SHALL hold at most `cap` entries after every step of `saveDiagramWithEviction`, whether the save succeeded or not.
8. THE same sequences SHALL never remove an entry that was pinned before the save.
9. WHEN `delete` fails after a successful `put`, including when every later `delete` also fails, THEN `saveDiagramWithEviction` SHALL NOT return `ok: true` while the store holds more than `cap` entries.
10. WHEN the saved entry has the id of an entry already in the store, THEN a successful save SHALL leave the number of entries unchanged, remove no other entry, evict nothing, and store the new title, thumbnail and scene under that id; a failed save SHALL leave the store exactly as it was.
11. WHEN the saved entry has the id of an entry already in the store, THEN the stored entry SHALL keep the existing `pinned` and `createdAt`, even if the entry passed in carries other values (brief p2: "preserve pinned/createdAt when updating in place").
12. FOR EVERY key that starts with `share.` in `en`, `hi` and `gu`, THE string SHALL NOT contain "verified" (any case), "सत्यापित" or "પ્રમાણિત", not even in a negation; and `share.sharedBy` and `share.sharedUnnamed` SHALL remain in every language and still say "not checked" in that language ("not checked", "जाँचा नहीं गया", "ચકાસાયેલ નથી").
13. THE properties SHALL live in new files under `frontend/tests/` named `*.prop.test.ts`, run at least 200 times each, and SHALL NOT be skipped, weakened or `.fails`-marked. `tsc --noEmit` SHALL stay at 0 errors. No file under `frontend/src/`, `core/` or the tuned haptic values SHALL change in this task.

14. (Kiro, task 40.2) WHEN `saveDiagramWithEviction` returns `ok: false`, THEN every entry that was in the store before the call SHALL still be in it, with its stored content, for any store with or without `putWithEviction` and any single failing `put` or `delete`. A failed save SHALL never lose an entry that was in the store before it.

### Requirement 23: Round-5 audit fixes in the pure core (task 39)
> Written by Kiro on 2026-11-10 before the code, from `docs/reports/audit-r5-kiro-glue.md`, `docs/reports/audit-u1-g1.md` and `docs/reviews/kiro-round5.md`. Each audit claim was checked against the code first; where the code disagrees with the audit, this requirement follows the code and task 39 records the evidence.

**User Story:** As a teacher adding what the AI missed, I want every point I add to be a normal, selectable point, so that renaming it, sharing it and tapping it behave as they do for any other point.

#### Acceptance Criteria
1. THE core SHALL export one list of reserved element ids, `RESERVED_ELEMENT_IDS`: `title`, `scene:title`, `__proto__`, `constructor`, `prototype`, `tostring`, `valueof`, `hasownproperty`, `isprototypeof`, `propertyisenumerable`, `tolocalestring`. A comparison with it SHALL ignore case and surrounding spaces. `share/validate.ts` SHALL use this list rather than its own copy.
2. WHEN `addPoint` or `addSegment` is given a requested id that is reserved THEN it SHALL ignore it and use the next free generated id, as for a taken id. A generated id SHALL never be reserved (for example a segment between points `ti` and `tle` SHALL NOT get the id `title`).
3. `validateSceneInvariants` SHALL report an element whose id is reserved as an error. (`renameLabel` treats `title` and `scene:title` as the scene title, so such an element cannot be renamed safely. The share validator renames reserved ids to `el_…` before it checks invariants, so shared scenes are unaffected.)
4. THE core SHALL NOT cap the number of points. The cap is a property of where the scene goes: 300 for a share link, 500 for the backend. It SHALL be enforced by the caller, which today is `flow/ghostwriter.ts` (`GHOSTWRITER_POINT_CAP`, Requirement 20.5). A test SHALL fail when `GHOSTWRITER_POINT_CAP` or `GHOSTWRITER_SEGMENT_CAP` stops being the smaller of the share limit and the backend limit (`MAX_SCENE_POINTS`, `MAX_SCENE_SEGMENTS` in `backend/app/validate.py`).
5. `localizedFindingTarget` SHALL word a disputed angle with the caller's `angleName` whether or not the finding carries `angleVertex`; a finding whose target is "angle X" SHALL be treated as an angle finding with vertex X.
6. WHEN `addPoint` would place the new point at the position of an existing point (both coordinates within `COINCIDENT_EPSILON` = 1e-6 after clamping) THEN it SHALL place it at the first free position from a fixed nudge order instead: steps of `NUDGE_STEP` = 0.04 to the right, below, left, above, then the four diagonals, ring by ring out to 25 steps, skipping positions outside [0, 1] or within `COINCIDENT_EPSILON` of a point. IF no position is free THEN it SHALL return the same scene. Existing points SHALL NOT move. (Rejecting the add instead would make `planAddPoint` report the previous point as added, because it reads the last point; nudging keeps every caller correct.)
7. No string added for these criteria, in any language, SHALL contain "verified", "correct", "checked" or "approved".

### Requirement 24: Round-6 spec decisions (task 40)
> Written by Kiro on 2026-11-10 before the tests, from `docs/reports/audit-r6-merged-share-saved.md` and the briefs for lanes a1 and p2. The code for 24.1 and 24.2 is in `flow/` and the validators, which Antigravity lanes own; Kiro writes the spec and the failing tests first.

**User Story:** As a teacher, I want Back to protect my unsaved corrections on every editing screen in the same way, and I want a point I name `title` to stay connected when I share or save the diagram.

#### Acceptance Criteria
1. Back (decision (a) in task 40.1). THE pure navigation policy `leaveByBack` SHALL ask for confirmation exactly WHEN the screen being left is Teach with unsaved Teacher edits, OR Correct with unsaved corrections; on every other screen and in every other state it SHALL NOT. The Correct flag SHALL be separate from the Teacher flag, because both editors can hold edits at the same time. The confirmation in `screens/Correct.tsx` (lane p2) and the policy SHALL agree, so a test of the policy describes the app.
2. Reserved ids in the validators (lane a1). WHEN a scene contains an element whose id is reserved (Requirement 23.1, any case) THEN both `share/validate.ts` and `backend/app/validate.py` SHALL accept the scene. The result SHALL contain no reserved id, every element id SHALL be unique, and every segment SHALL still join the same two points it joined before, with its endpoints rewritten to the renamed ids. A renamed id SHALL NOT take the id of another element that is already in the scene (for example a point that is already called `el_title`).
3. THE segment count after the share validator SHALL equal the count before, for scenes whose segments all join existing, distinct points.

### Requirement 25: The Explore canvas has a stable size during interaction (P0, task 42)
> Written by Kiro on 2026-11-11 BEFORE the code, from the owner's video on a Samsung Galaxy S24+ (Android Chrome, sample "Right Triangle ABC", English): on the first double-tap-hold-drag the status line changed from "waiting for touch" to "First hold: dx=-74.4px, dy=-47.2px from centre" and the canvas then grew taller for about 7 s, pushed Ask, Correct and Back off screen, and cut the triangle off. Commit 5616cd5 (PR #34) made the canvas `position: absolute` inside its container; this requirement states the whole rule so that fix is not the only line of defence.

**User Story:** As a blind or low-vision student (and the sighted teacher or judge watching), I want the drawing area to stay exactly the same size from the moment Explore opens until I leave, so that what I feel does not move under my finger and the Ask, Correct and Back buttons stay where I found them.

#### Acceptance Criteria
1. WHILE the Explore screen is open, THE canvas bounding box (position and size in CSS px) SHALL change only when the viewport changes: a window `resize`, an `orientationchange`, or the browser toolbar showing or hiding. Pointer down, move, up, cancel and lost capture, a change of the status text, the debug offset line, the vibration note, the pulse ring and the "IT'S ALIVE" spark SHALL NOT change it.
2. THE canvas CSS size SHALL be derived from its container (or the viewport) only, never from the canvas's own measured size or its bitmap size. Setting `canvas.width` or `canvas.height` (devicePixelRatio up to 3 multiplies the bitmap) SHALL NOT change any CSS size.
3. THE bitmap SHALL be resized only when the container's CSS size changed by at least 1 px since the last resize. A pointer down SHALL NOT resize or clear the bitmap when the container size is unchanged. A resize observer SHALL observe the container, not the canvas, and a re-measure that gives the same size SHALL do nothing (no loop).
4. THE status card and the debug line SHALL occupy a fixed height whatever their text: a fixed number of lines with overflow contained inside them. A longer or shorter message SHALL NOT move the canvas.
5. THE Explore screen SHALL be exactly one dynamic viewport high (`100vh` fallback, then `100dvh`). Its canvas container SHALL take the remaining space (with a lower bound of 220 CSS px), not a percentage of an auto-height parent. Anything that does not fit SHALL scroll inside the Explore screen, never the page.
6. THE Explore surface (screen, container and canvas) SHALL set `touch-action: none` on the canvas and container and `overscroll-behavior: contain` on the screen, so a drag cannot scroll or pull-to-refresh the page.
7. THE pulse ring, spark, frame and rivets SHALL stay out of flow (`position: absolute`, `pointer-events: none`) inside the container, which clips them.
8. Non-goal: this requirement does not change what the engine feels or says (Requirements 4 to 6, 13) or any tuned haptic value.
