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
4. WHILE the finger stays on the same vertex THEN the system SHALL NOT repeat the corner pattern or the speech. (Amended by Kiro, task 59: this holds exactly as written when the corner heartbeat of Requirement 34 is off, which is the default. When it is on, the speech and the tone still never repeat, and the pattern repeats only as Requirement 34 says. The engine itself, `step()`, is unchanged and still emits nothing on a same-vertex step.)
5. WHEN a corner pattern starts THEN the system SHALL suppress line vibration for the quiet window, so a corner is never merged with a line buzz.
6. IF a point lies within both the vertex radius and the line radius THEN the system SHALL treat it as a vertex.
7. WHEN the finger lifts THEN the system SHALL stop all vibration and tones.
8. WHEN multiple fingers touch the Explore canvas and the primary finger lifts while another finger remains in contact, the system SHALL immediately promote the oldest remaining active pointer to primary, update cursor tracking, and continue delivering haptic and tone effects without entering a dead-zone. (agy, awaiting Kiro review)

10. (Kiro, task 76, reconciling 4.3 with Requirement 43) WHEN the corner has no label AND its id is machine-made (`isMachineId` in `core/speakable.ts`, for example Raw Mode's `raw_p17`) THEN the system SHALL speak the unnamed-corner words (`vertex.unnamed`, "Corner" in English) in the active language, in every speech path, and SHALL NOT speak the id. For any other unlabelled corner the "Point {id}" wording of 4.3 is unchanged. The engine's effects, the corner pattern and the quiet window are unchanged. (Requirement 43 itself is on the ux3 lane and is not yet in this spec file; this criterion is the part of it that touches 4.3.)
9. (Kiro, task 50, from `docs/reports/fable-blind-user-plan.md` section 2.3) WHEN the finger re-enters the vertex that fired the most recent corner pattern, AND the quiet window of that pulse has not ended (`t < quietUntil`), THEN the system SHALL NOT play the corner pattern, SHALL NOT speak the label again, and SHALL NOT change the quiet window (`quietUntil` stays as the first pulse set it). The one effect it MAY emit is `tone(null)` (silence), because a corner stops the tone and a theremin tone started on a curve between the two visits would otherwise keep sounding on the vertex (review finding 4, 2026-11-15). The finger staying on that vertex after the window ends SHALL NOT fire the corner pattern or the label either: one visit that is only interrupted by jitter is one corner. The only time constant is `quietMs`; no new tuned value is added. WHEN the re-entry happens at or after the end of that window, OR the vertex is a different one from the last corner, THEN the corner pattern and label SHALL play as in 4.3. A lift resets this memory.

### Requirement 5: Hear graph height (theremin)
**User Story:** As a blind student studying functions, I want to hear the curve rise and fall, so that I understand its shape and turning points.

#### Acceptance Criteria
1. WHILE the finger is on a function curve THEN the system SHALL play a continuous tone whose pitch rises as the curve point is higher on the graph.
2. THE system SHALL map pitch to the range 200–1000 Hz.
3. WHEN the finger leaves the curve THEN the system SHALL fade the tone out within 100 ms.
4. WHEN the finger crosses an axis THEN the system SHALL speak "x-axis" or "y-axis" once per crossing.
5. (Kiro, task 52, from `docs/reports/fable-blind-user-plan.md` section 2.7) WHEN a polyline and an axis are both within the line radius of the finger THEN the polyline SHALL be the target, so the curve's tone plays where the curve crosses or lies on an axis. Only the choice between a polyline and an axis changes: a vertex still beats every line, and among all other line candidates (segments, bar edges, and polylines against each other) the nearest still wins, with the first in scene order winning a tie. Hit radii are unchanged. A scene with no polyline, or with no polyline within the radius, gets exactly the answer it got before.
6. (Kiro, task 52) IN a `function_graph`, WHEN the finger is not on the curve THEN the core SHALL be able to give the curve's height at the finger's x: the curve's normalized y at that x, found by linear interpolation between the neighbouring points of the polyline, with the id of that polyline. There SHALL be no answer when x is outside the curve's x range, when there is no polyline with two usable points, or when x is not a finite number. IF a curve has several y values at that x, or several curves cover it, THEN the answer SHALL be the one nearest an optional y hint, otherwise the first in scene order. The helper SHALL never throw and SHALL leave pitch to `pitchForY` (200–1000 Hz). Playing the height quietly is a later shell lane (A6); this criterion adds no sound and no tuned value.

### Requirement 6: Explore bar charts
**User Story:** As a blind student, I want to compare bars in a chart by touch, so that I can tell which values are larger.

#### Acceptance Criteria
1. WHEN the finger enters a bar THEN the system SHALL speak the bar's label and value.
2. WHILE the finger is inside a bar THEN the system SHALL play a tone whose pitch is proportional to the bar's value.
3. THE system SHALL vibrate at bar edges using the line pattern.
4. (Kiro, K4 CORE-A4) THE spoken bar value SHALL be rounded to at most 2 decimals with no trailing zeros (3.3333333333333335 is spoken as 3.33). Only the text changes; the effect structure, tone and haptics do not.

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
10. (Kiro, K4 CORE-A5) WHEN a point is moved to a position where x or y is NaN or infinite THEN the system SHALL NOT move it and SHALL return the same scene object (as Requirement 19.4 does for adding a point). The exported clamp01 SHALL map +Infinity to 1 and -Infinity to 0; NaN stays 0.
12. (Kiro, K4 CORE-A7) WHEN a point or segment is deleted by an id that no point (or segment) has THEN the system SHALL return the same scene object, so that pplyEdit adds no history entry (as Requirement 21.3 does for curves and bars).
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
1. (amended by Kiro 2026-11-15, from lane bu2 / A2, commit 6f11ab7) WHEN the Explore screen opens THEN the system SHALL speak, as ONE utterance, the diagram overview (`buildOverview(scene)` in `flow/overview.ts`: kind, counts and coarse positions of labelled elements, never raw coordinates) followed by the explore gesture "Double-tap and hold, then drag to feel the diagram." and the Back hint (`explore.backHint`), and SHALL move focus to the explore canvas. A Spec Ghost sentence (Requirement 18.1), when there is one, is joined to the same utterance after them. For a Raw Mode scene, or a scene of kind `unknown`, there is no overview: the Raw Mode announcement of Requirement 8.1 comes first, then the scene name, then the gesture and Back hints. The entry speech SHALL NOT say "You start at the centre."; the code does not start the cursor at the centre (see 13.3).
2. WHEN TalkBack is active AND the user double-taps and holds on the canvas and then drags THEN the system SHALL treat the pointer position as a cursor and SHALL apply the line, corner, bar and tone rules of Requirements 4, 5 and 6 to that cursor.
3. (reworded by Kiro 2026-11-15 to match the code; the question this raises is an OWNER DECISION, not decided here, see `docs/reviews/kiro-owner-decisions.md` item OD-1) WHEN a new hold starts THEN the cursor SHALL be the finger's own position on the canvas (absolute touch: `Explore.tsx` `handlePointerDown` takes the position from `clientX`/`clientY`; the engine state, axis tracking and centre-tick arming are reset). The system SHALL play a single centre reference tick (`vibrate(CENTRE_TICK_MS)`, a short pulse distinct from the line and corner patterns) only WHEN the finger is within the centre radius (24 CSS px) of the canvas centre, on that touch or on a later move, SHALL NOT play it again until the finger has left the re-arm radius (1.5 times the centre radius), and SHALL speak "Centre." at most once, on the first hold that starts inside that radius. A hold that starts elsewhere gets no tick and no "Centre." until the finger moves into the centre radius. The first touch's offset from the centre is shown on the debug line only (`explore.debugOffset`).
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

### Requirement 26: Know where the line goes (compass helpers, core half)
> Written by Kiro on 2026-11-15 BEFORE the code (task 43), from `docs/reports/fable-blind-user-plan.md` (sections 2.3, 2.5, 7 K1; improvements I1, I5, I7). This requirement covers the pure helpers in `frontend/src/core/compass.ts` only. Speaking them (wording, i18n, the Settings toggle, remembering the edge the finger arrived on) is a later Antigravity lane (A3, A5). Nothing in `hitTest.ts`, `hapticEngine.ts` or the tuned haptic values changes.

**User Story:** As a blind student who reaches a corner, I want to hear which way each edge leaves it, and to be able to ask which way a line runs and what is nearest my finger, so that I do not have to guess a direction in silence.

#### Acceptance Criteria
1. THE core SHALL name the direction from one point to another with one of eight words: `up`, `down`, `left`, `right`, `up-left`, `up-right`, `down-left`, `down-right`. `y = 0` is the top, so `up` is the smaller `y`. Each word covers a 45 degree sector centred on its compass direction. IF the two points coincide, or any coordinate involved is NaN or infinite, THEN there SHALL be no direction.
2. THE direction from A to B SHALL be the opposite word of the direction from B to A, and SHALL NOT change when every point is scaled by one positive factor and translated by one vector, exactly when the coordinates, the factor and the vector are exactly representable (for example integer grids, power-of-two factors, integer translations). For other values floating-point rounding can move a vector that lies within a rounding error of a sector boundary into the neighbouring word; away from a boundary the word is unchanged.
3. WHEN the finger enters a vertex THEN the system SHALL be able to list one exit for each segment that joins that vertex to a different, existing point at a different position: the segment id, the id and (if it has a non-blank label) the trimmed label of the point at the other end, and the direction to it. The list SHALL be in scene order, SHALL have no entry for the vertex itself (a segment from the vertex to itself) or for a dangling segment, and SHALL be empty for an unknown id. The core lists every exit; the corner speech SHALL omit the exit whose segment id is the edge the finger arrived on.
4. WHEN the finger rests on a segment THEN the system SHALL be able to name both of its ends and the direction of travel along the line towards each one. For a segment id these SHALL be the segment's own endpoint ids and two opposite words. For any other id (a point, a curve, an axis, a bar, unknown), for a dangling segment, or for coincident endpoints there SHALL be no result.
5. FOR ANY finger position on screen THE core SHALL be able to name the nearest drawn element and the vector to it: its id, its kind (`vertex`, `segment`, `polyline`, `axis` or `bar-edge`), the distance in CSS px, and the horizontal and vertical offsets from the finger to the closest point on that element (screen `y` grows downward, so a positive vertical offset means the element is below the finger). The length of the offset vector SHALL equal the distance. No element SHALL be nearer than the one returned. Bar interiors are not elements; a bar is represented by its four edges, as in `hitTest`.
6. WHEN a maximum distance is given THEN there SHALL be no result exactly when no element lies within it (a distance equal to the maximum counts as within). Without a maximum there SHALL be no result only when the scene has nothing drawable, the viewport has no drawable area, or the finger position is not a finite number.
7. THE nearest-element helper SHALL agree with `hitTest`: WHEN `hitTest` reports a vertex or a line for a finger position, THEN the nearest element SHALL be at most the vertex radius (vertex) or the line radius (line) away.
8. THE helpers SHALL never throw, whatever the scene (NaN, infinite or out-of-range coordinates, dangling or duplicate ids, missing arrays) and whatever the finger, viewport and maximum distance. Directions are measured in the unit square as Explore draws it (the scene's `aspect` is not applied), so the word matches what the finger feels.
9. THE helpers SHALL be pure: no DOM, React, `window`, `navigator`, audio or speech, and no import from `frontend/src/guide/`. They SHALL add no tuned number and SHALL NOT change what the engine feels or says (Requirements 4 to 6, 13).

### Requirement 27: Find the line again (near-line click cue, core half)
> Written by Kiro on 2026-11-15 BEFORE the code (task 51), from `docs/reports/fable-blind-user-plan.md` (sections 2.2, 2.3, 3; improvement I4; Kiro task K3). This requirement covers the pure machine in `frontend/src/core/proximity.ts` only. The audio driver method, the call to `nearestElement`, the Settings toggle and the per-phone tuning are later Antigravity lanes (A4). Nothing in `hitTest.ts`, `hapticEngine.ts` or the tuned haptic values changes. **Every number below is proposed, pending owner approval, and untested on a phone.**

**User Story:** As a blind student who has drifted off a line, I want a soft click that speeds up and rises in pitch as my finger gets closer to the line, so that I can find it again without guessing which way to go.

#### Definitions
- **Distance** is `distPx`, the screen distance in CSS px from the finger to the nearest drawn element (the value `nearestElement` in `core/compass.ts` gives). The caller passes `distPx = null` when there is nothing to find: no element, or the finger is on a vertex or inside a bar.
- **Closeness** `f` runs from 0 (at the near-line radius) to 1 (at or inside the line radius): `f = 1 − clamp((distPx − lineRadiusPx) / (radiusPx − lineRadiusPx), 0, 1)`.
- **Quiet window** is the corner quiet window of Requirement 4.5, reported by the caller as `inQuietWindow`.

#### Acceptance Criteria
1. WHEN the finger is not on a line AND `distPx` is a finite number from 0 up to and including the near-line radius THEN the system SHALL play a click. The interval between clicks SHALL be the far interval at the radius and SHALL shrink linearly with closeness to the near interval; the pitch SHALL rise linearly with closeness from the low to the high pitch; the loudness SHALL rise linearly with closeness from the far to the near gain. At a distance equal to or smaller than the line radius, all three SHALL be at their closest setting.
2. THE click SHALL pan toward the line: the pan SHALL be in [−1, 1], SHALL have the sign of `dxPx` (the horizontal offset from the finger to the line; negative means the line is to the left) and SHALL be 0 when `dxPx` is 0. Its size SHALL be `|dxPx| / radiusPx`, cut at 1. Pan SHALL NOT be the only carrier of the cue (a phone speaker is mono), so rate and pitch carry the distance.
3. WHEN the finger is on a line AND inside the quiet window THEN the system SHALL play clicks at the closest setting of criterion 1, with the pan of criterion 2. This confirms the turn during the 450 ms in which the line buzz is suppressed.
4. WHEN the finger is on a line AND outside the quiet window THEN the system SHALL play no click (the line buzz of Requirement 4.1 is the cue).
5. THE system SHALL play no click WHEN `distPx` is `null`, WHEN `distPx` is larger than the near-line radius, WHEN the input is a lift, OR WHEN any number of the input (`t`, `distPx`, `dxPx`) is NaN, infinite or (for `distPx`) negative. Such an input SHALL NOT throw and SHALL NOT change the state. A lift emits nothing; the machine holds no timer, so nothing sounds after it until the next move.
6. THE gap between two clicks SHALL NOT be shorter than the near interval, whatever the timestamps. A click is due when the time since the previous click is at least the interval for the current distance. A timestamp earlier than the previous click gives no click. The previous-click time SHALL survive a lift, so a quick lift and touch cannot speed the cue up.
7. THE cue SHALL be audio only. THE machine SHALL emit only effects of kind `click` and SHALL NEVER emit a vibration effect: a second vibration pattern would blur into the line buzz and the corner pattern (product principle 3) and the single motor cannot vary its strength.
8. THE machine SHALL be pure: no DOM, React, `window`, `navigator`, audio or speech; no import from `frontend/src/guide/`. It SHALL keep its own constants (`DEFAULT_PROXIMITY`) and SHALL NOT change what the engine feels or says (Requirements 4 to 6, 13).
9. Proposed values, all pending owner approval and a phone test (`tech.md`, separate row): near-line radius 48 CSS px; line radius 14 CSS px (the tuned value of Requirement 4, copied, not changed); far interval 400 ms; near interval 90 ms; pitch 500 to 1200 Hz; gain 0.3 (far) to 0.6 (near). Whether the click is distinguishable from the theremin and the Guide tone, on a speaker and on one earbud, is for the phone test.

### Requirement 28: A corner says where its edges go (speech half of Requirement 26)
> Written by Kiro on 2026-11-16 BEFORE any code change (task 55), from `docs/reviews/kiro-review-bu3-bu5.md` finding M1 and `docs/reports/fable-blind-user-plan.md` (sections 2.3, 4 I1; lane A3). It specifies the speech that lane bu3 wired from the helpers of Requirement 26. Nothing here changes the engine, `hitTest`, a haptic effect or a tuned value. "Directions" is the Settings switch that already exists; this requirement does not change its default (owner decision OD-3).

**User Story:** As a blind student who reaches a corner, I want to hear which way each edge leaves it, however I got there, so that I can choose a direction instead of guessing in silence.

#### Acceptance Criteria
1. WHEN the engine announces a vertex (the corner pattern and the label of Requirement 4.3) THEN, IF Directions is on, the system SHALL speak the label followed by the exits of Requirement 26.3, one short clause per exit ("Down-right to B."), as ONE utterance with any axis crossing of the same step (Requirement 17.2).
2. THE announcement SHALL be made WHATEVER caused the entry: a pointer move, a keep-alive tick, or a new touch that lands inside the vertex radius. A touch-down on a corner SHALL speak the label and the exits exactly as a move onto it does. (Review M1: touch-down on a corner spoke only the label, and a later move could not add the exits because the corner was no longer a new entry.)
3. WHEN the finger arrived from a segment THEN the exit along that segment SHALL be left out. WHEN there is no arrival segment (a new touch, or an arrival from empty space) THEN every exit SHALL be listed.
4. WHEN a vertex has more than 4 exits THEN the system SHALL say the number of edges instead of listing them. A compass clause SHALL be at most 12 words.
5. WHEN the same vertex was announced less than 10 s ago THEN the system SHALL speak the label only.
6. WHEN the engine does not announce the vertex (a re-entry suppressed by Requirement 4.9) THEN the system SHALL NOT speak the exits either.
7. WHILE Ask is listening or Guide is guiding, THE system SHALL NOT speak the exits.
8. WHEN Directions is off THEN the system SHALL speak the label only, as before Requirement 26 existed.
9. THE vibrate and tone effects for any trace SHALL be identical with Directions on and off. A test SHALL show this through the real Explore screen, not through a helper that ignores the setting (review M3).
10. Every string SHALL exist in `en`, `hi` and `gu` and go through `t()` / `tf()`. No string SHALL contain "verified", "correct", "checked" or "approved" (or a translation).

### Requirement 29: A line is named only when the finger rests on it
> Written by Kiro on 2026-11-16 BEFORE any code change (task 55), from review finding M2 and plan improvement I7 (lane A3). The numbers below are proposed, pending owner approval and a phone test; none is a haptic value and none changes `tech.md` in this task.

**User Story:** As a blind student who stops on a line to think, I want to hear which line it is and where it leads, and I do not want that sentence on every side I trace past.

#### Definitions
- **Rest:** the finger stays within the rest radius (proposed 6 CSS px, the same value the where-am-I dwell uses) of the point where the current rest began. Moving farther restarts the rest at the new point.
- **Speech quiet window:** the time after the last speech the app started (proposed 1500 ms, the same value the where-am-I dwell uses). It is not the 450 ms corner quiet window, which it contains.

#### Acceptance Criteria
1. WHEN the finger has been on the same line (segment, axis, polyline or bar edge) continuously for 800 ms AND has rested for those 800 ms AND no speech started within the speech quiet window THEN, IF Directions is on, the system SHALL speak the name of the line once.
2. WHEN the finger keeps moving along a line, however slowly, so that it never rests for 800 ms THEN the system SHALL NOT speak the line name. An ordinary trace along a side SHALL NOT trigger it.
3. WHEN speech started less than the speech quiet window ago (a corner label and its exits, an axis word, a bar label) THEN the line name SHALL NOT be spoken and SHALL NOT cancel that speech. It MAY be spoken later in the same visit, once the finger rests again outside the window.
4. THE line name SHALL be spoken at most once per visit to that line. Leaving the line re-arms it.
5. THE name of a segment SHALL be its name and the way to travel to each end: "Side AB. Up-left to A, down-right to B." (Requirement 26.4). An axis SHALL be named with its direction ("x-axis, left to right"). A polyline or a bar edge SHALL be named by its label only.
6. WHILE Ask is listening or Guide is guiding, THE system SHALL NOT speak the line name. WHEN Directions is off THE system SHALL NOT speak it.
7. THE decision (rest, 800 ms, speech quiet window, once per visit) SHALL be a pure function in `flow/`, so it can be property-tested. Explore SHALL only call it and speak what it returns.
8. THE vibrate and tone effects SHALL be identical with the dwell on and off (as 28.9).

### Requirement 30: Where am I without voice, behind Directions
> Written by Kiro on 2026-11-16 BEFORE any code change (task 55), from review findings M4 and L2 and plan improvement I5 (lane A5). Lane bu5 built the dwell without a switch.

**User Story:** As a blind student who has lost the diagram, I want to hear where I am when I hold still or press a button, and I want to be able to turn the automatic version off.

#### Acceptance Criteria
1. WHEN the finger rests (Requirement 29 definition) for 1200 ms on a position where `hitTest` returns no target THEN, IF Directions is on, the system SHALL speak where the finger is: the coarse position, then the nearest element, a distance word (touching, close, far) and the side it is on. It SHALL speak this once per rest. The rest re-arms after the finger moves 20 CSS px or lifts.
2. THE automatic dwell SHALL NOT run WHEN Directions is off. (Kiro, task 75) "Not run" means it never asks for speech and starts no sentence; it does not mean the rest clock is frozen. A step whose target is a vertex, line or bar SHALL restart the rest at that position and time whether Directions is on or off, so that switching Directions on during a touch never counts a rest that began before the finger last left a target. A step on a `none` target with Directions off SHALL change nothing. The switch SHALL cover corners, line names and this dwell, and its visible and spoken label SHALL say so. Its label SHALL be fixed and the state SHALL be carried by `aria-checked` only, so a screen reader does not read the state twice (review L7).
3. THE "Where am I" button and the voice command are explicit requests. THEY SHALL work whether Directions is on or off.
4. THE dwell SHALL NOT fire within the speech quiet window of Requirement 29, WHILE Ask is listening, or WHILE Guide is guiding. "Speech started" SHALL include every utterance the app starts (move speech, line names, Ask answers, Guide arrival, overview, earcon speech), not only some of them (review L3).
5. WHEN the finger is inside a bar THE answer SHALL name that bar, from the `hitTest` result, before `nearestElement` is used (review L2). `nearestElement` SHALL be used only when `hitTest` reports no target (design.md, Requirement 26 "Not built here").
6. THE decision SHALL be a pure function in `flow/` with a property test, and a test through the real Explore screen SHALL show that the switch, Ask and Guide guards are the ones Explore passes (review M3).
7. All strings in `en`, `hi` and `gu`. Strings left unused by this change (`commands.whereNearVertex`, `commands.whereNearLine`, `commands.whereEmpty`) SHALL be removed or listed with a reason (review L8).

### Requirement 31: Speech pacing and detail (lane A7; requirement only)
> Recorded by Kiro on 2026-11-16 from `docs/reports/fable-blind-user-plan.md` (sections 2.7, 2.8, improvement I11, lane A7). No design section and no task yet: they follow when the lane is scheduled. Not built. The numbers are the plan's proposals, pending owner approval and a phone test.

**User Story:** As a blind student who moves quickly, I want a label I started to hear to finish, so that a bar or a corner name is not cut off by the next word.

#### Acceptance Criteria
1. THE system SHALL offer a "Speech detail" setting with two values, full and short. THE default SHALL be full, and in full mode nothing SHALL be dropped or reordered except as 2 requires.
2. WHEN an axis word ("x-axis", "y-axis") arrives within 600 ms after a corner or bar announcement THEN it SHALL be dropped, not allowed to cut that announcement. THE same axis word SHALL NOT be repeated within 2000 ms. This extends Requirement 17.2 (no announcement is lost within one step); it applies across steps.
3. IN short mode, a corner SHALL be spoken by its label only. A bar that follows another bar by less than 700 ms SHALL be spoken by its label only, and the value SHALL be spoken after the finger has rested on that bar for 500 ms. Requirement 6.1 (label and value) is unchanged in full mode and after the rest in short mode. Requirement 6.4 (rounding) is unchanged. (Amended by Kiro, task 67; criteria 6 and 7 below say exactly what "label" and "rested" mean.)
6. (Kiro, task 67, amends 3) "Label only" SHALL mean the label exactly as the scene gives it. The pacing function SHALL NOT cut a corner or bar label at `.`, `,`, `!`, `?`, `।` or `॥`, and SHALL NOT trim it or change it in any other way. The label of a bar SHALL reach the pacing function as its own field, separate from the spoken value, so that a comma inside a label is not taken for the separator. For a corner, the text the pacing function receives is the label alone: the exits come from the corner compass of Requirement 28 and are not part of it.
7. (Kiro, task 67, amends 3) In short mode the corner compass of Requirement 28 SHALL be spoken on the first visit to a corner (that is, whenever Requirement 28.5 does not call the visit recent), as in full mode. The 10 s rule of 28.5 and the guards of 28.7 and 28.8 are unchanged. A finger has "rested" on a bar when it has stayed within 20 CSS px of the point where the rest began for 500 ms; a move that stays inside that radius SHALL NOT restart the 500 ms, and a move farther away SHALL restart it from the new position. Pointer events that arrive during the rest (jitter, keep-alive ticks) SHALL NOT by themselves prevent the value being spoken. The value SHALL be spoken once per visit to the bar.
4. THE pacing decision SHALL be a pure function in `flow/` with property tests (no label cut by an axis word; axis word at most twice in 3.3 s of wobble on an axis).
5. THE setting's strings SHALL exist in `en`, `hi` and `gu`.

### Requirement 32: Page edge cue and richer TalkBack labels (lane A8; requirement only)
> Recorded by Kiro on 2026-11-16 from `docs/reports/fable-blind-user-plan.md` (sections 2.1, 2.6, improvements I10 and I12, lane A8). No design section and no task yet. Not built. The TalkBack labels need Requirement 26 (done).

**User Story:** As a blind student, I want to know when my finger leaves the page, and as a TalkBack user I want the feature buttons to say where each corner and side is.

#### Acceptance Criteria
1. WHEN the finger moves outside the unit square, that is, when a normalized x or y is below 0 or above 1 (this includes the letterbox bands) THEN the system SHALL play one short earcon and speak "Edge" with the side (top, bottom, left or right), once per exit, joined with any other announcement of the step as one utterance. WHEN a touch lands outside THEN it SHALL say it once. It SHALL re-arm only after the finger is back inside by at least 20 CSS px. THE cue SHALL use no vibration.
2. THE edge cue SHALL have an off switch (every audio cue needs one, plan section 3). Whether it is on by default is not decided here.
3. THE TalkBack feature buttons SHALL read a corner as "Corner A, top left, joined to B and C" and a side as "Side AB, from top left to bottom right". Bars, curves and axes keep their present labels. The cap on the number of feature buttons (60) is unchanged.
4. THE edge tracker SHALL be a pure function in `flow/` with a property test (once per exit on each of the four sides, not again until re-armed). A position on the boundary (0 or 1) counts as inside and SHALL NOT trigger it.
5. All strings in `en`, `hi` and `gu`; none contains "verified", "correct", "checked" or "approved".


### Requirement 33: Sticky line following (optional, off by default, phone-untested; core half)
> Written by Kiro on 2026-11-16 BEFORE the code (task 58), from `docs/reports/fable-blind-user-plan.md` (improvement I14, Kiro task K5). **Owner approval (recorded in `docs/BUILD_LOG.md`):** on 2026-11-16 the owner delegated the K5 decision to the orchestrator ("for K5 do what you think is best"). The decision is to build it as a pure OPT-IN helper that is OFF by default, with every existing value untouched. This requirement covers the pure helper in `frontend/src/core/sticky.ts` only. The Settings switch and the Explore wiring are a later Antigravity lane (T58b). `hitTest.ts`, `DEFAULT_RADII` (vertex 22 px, line 14 px), `hapticEngine.ts` and every tuned haptic value are NOT changed. **Both numbers below are proposed, pending owner approval, and untested on a phone.**

**User Story:** As a blind student who is following a line, I want the line to keep buzzing when my finger drifts a little to the side, so that I do not lose it at the first small wobble.

#### Definitions
- **Held line:** the `line` target the caller reports as the previous target (`prevTarget`), together with `heldMs`, the time in ms that this same line has been the target without a break.
- **Sticky radius** `stickyRadiusPx`: proposed 24 CSS px. **Hold time:** proposed 200 ms (`STICKY_HOLD_MS`).

#### Acceptance Criteria
1. THE helper `followTarget` SHALL return exactly the target `hitTest` returns for the same scene, finger, viewport and radii, EXCEPT in the single case of criterion 3.
2. ACQUISITION SHALL NOT change. A line becomes the target only when `hitTest` reports it, that is within the normal line radius. WHEN `prevTarget` is not a line (`none`, `vertex`, `bar`, which includes the state after a lift), OR `heldMs` is below the hold time, NaN or infinite, THEN the result SHALL equal `hitTest`.
3. WHEN `prevTarget` is a line, `heldMs` is finite and at least the hold time, `stickyRadiusPx` is finite and larger than `radii.line`, `hitTest` reports `none` or a `bar`, AND the finger is within `stickyRadiusPx` of the held line (the closest point of any piece of that element, measured as `hitTest` measures), THEN the result SHALL be the held line: `{ kind: 'line', id, elementKind }` of `prevTarget`.
4. A vertex SHALL always win: WHEN `hitTest` reports a vertex the result SHALL be that vertex, whatever the previous target (Requirement 4.6 holds). WHEN `hitTest` reports a line, even a different one, the result SHALL be that line. A different line therefore takes over by the normal rules of Requirement 5.5 and nearest-wins, and always inside the normal line radius, so stickiness never extends the reach of a line that was not already held.
5. WHEN `stickyRadiusPx` is not larger than `radii.line`, or is NaN or infinite, THEN the result SHALL equal `hitTest` exactly (the feature is off). The default of the caller SHALL be off (no previous target is passed, or the radius is left at the line radius).
6. THE helper SHALL be pure and total: no DOM, React, browser API, audio, speech or timer; no import except `hitTest`, `geometry` and `scene`; it SHALL NEVER throw, whatever the scene (NaN, infinite or out-of-range coordinates, dangling or duplicate ids, missing arrays), the previous target (an unknown id or element kind), the finger, the viewport or the numbers. It SHALL only ever answer with what `hitTest` answers or with the held line.
7. THE helper SHALL keep no state. The caller measures `heldMs` and feeds the target it followed back in as `prevTarget`; a lift is `{ kind: 'none' }`.
8. THE helper SHALL NOT change `hitTest`, `DEFAULT_RADII`, `hapticEngine.ts` or any tuned value, and SHALL NOT be called by the app until lane T58b adds the switch (default off) and the wiring.

### Requirement 34: Resting on a corner has a heartbeat (optional, off by default, phone-untested; core half)
> Written by Kiro on 2026-11-16 BEFORE the code (task 59), from `docs/reports/fable-heartbeat-plan.md` (sections b, c, e; Kiro task KH1). Owner request: "for the corners I want a heartbeat vibration, so that we get to know that we are at a vertex." The plan keeps the tuned entry pattern and adds a repetition while the finger rests. This requirement covers the pure helper in `frontend/src/core/heartbeat.ts` only. The Settings switch and the Explore wiring are a later Antigravity lane (59b, plan lane hb2). `hapticEngine.ts`, `hitTest.ts`, `DEFAULT_HAPTICS`, `DEFAULT_RADII` and every existing row of `tech.md` are NOT changed. **Every number below is proposed, pending owner approval, and untested on a phone.**

**User Story:** As a blind student who rests a finger on a corner to listen, I want a slow double pulse that keeps repeating while I stay there, so that I know I am still on the corner without moving and without more speech.

#### Definitions
- **Beat:** one `vibrate(pattern)` effect added by the heartbeat. Proposed pattern `[50, 90, 50]` (the tuned corner pattern, reused, so one meaning has one feel). Its length is the sum of its entries (190 ms).
- **Period** `periodMs`: proposed 900 ms, start to start.
- **Entry:** a step whose target is a vertex and whose engine effects contain a `vibrate` (the corner pattern of Requirement 4.3).
- **Resting:** a step whose target is the same vertex as the previous step and whose engine effects contain no `vibrate`.
- **Quiet window:** the 450 ms after a corner pattern (Requirement 4.5); the helper's own `quietMs` is a copy of that tuned value, not a new one.

#### Acceptance Criteria
1. WHERE the heartbeat is on, WHILE the finger rests on the same vertex after its entry, THE system SHALL add one beat per period. The first beat SHALL come no earlier than one period after the entry (or after a suppressed re-entry, criterion 5). Later beats SHALL follow the schedule entry + 2 periods, entry + 3 periods, and so on. A step that arrives late SHALL give one beat, not a burst: IF the schedule has fallen a whole period behind, THEN the next beat is due one period after that late step.
2. A beat SHALL NOT add speech and SHALL NOT add a tone. The label is spoken once, at the entry, as in Requirement 4.3. A beat SHALL be added only as a `vibrate` effect after the engine's own effects, and a step SHALL carry at most one added effect.
3. A beat SHALL NOT fall inside the quiet window and SHALL NOT change it. The helper SHALL refuse a configuration whose period is shorter than the quiet window plus the beat length, so a beat can never start before the entry's quiet window has ended. The helper reads and writes no engine state, so it cannot see the engine's window: the guarantee holds only while the configured `quietMs` is at least the engine's `quietMs` (450). A smaller copy is accepted as valid but gives no such guarantee (found by P122's first run).
4. WHEN the finger leaves the vertex (any target that is not a vertex) while a beat may still be playing (the step's time is before the last beat's time plus the beat length) THEN the beat SHALL stop in that same step: IF the engine's effects of that step contain a `vibrate` (the line buzz) THEN that call replaces the beat and nothing is added; OTHERWISE the helper SHALL put `vibrate(0)` first. A line buzz SHALL NEVER be preceded or followed by a beat in the same step. WHEN the finger lifts THEN the engine's `vibrate(0)` already stops everything; the helper returns exactly the engine's effects and forgets the vertex.
5. WHEN the finger re-enters the vertex of the last corner inside its quiet window (Requirement 4.9, the engine emits no `vibrate`), THEN the helper SHALL start its schedule from that step (first beat one period later) and add nothing. A finger that jitters on the 22 px boundary therefore hears no beats until it settles.
6. WHERE the configuration is `null`, `undefined` or invalid, THE helper SHALL return exactly the engine's effects and an initial state: the heartbeat is off. A configuration is invalid when its pattern is not a non-empty array of finite numbers greater than zero, or its period or quiet window is not a finite number (the quiet window must also be at least zero), or its period is shorter than the quiet window plus the sum of the pattern.
7. THE default of the feature SHALL be off: the app calls the helper only when a stored Settings switch is on, and with the switch off the effects of every trace SHALL be identical to those without the helper (Requirement 4.4 as written).
8. THE helper SHALL be pure and total: no DOM, React, `window`, `navigator`, timer, audio or speech; it SHALL NEVER throw, whatever the time (NaN, infinite or going backwards), target, effects, state or configuration, SHALL NEVER mutate its inputs, and SHALL return the configured pattern as a copy. It SHALL add no beat for a time that is not finite. It SHALL keep no timer: the caller's existing steps (pointer moves and the 60 ms keep-alive) drive the beats, so a beat can be up to one step late.
9. THE helper SHALL NOT change `hapticEngine.ts`, `hitTest.ts`, `DEFAULT_HAPTICS`, `DEFAULT_RADII` or any tuned value, and SHALL NOT be called by the app until lane 59b adds the switch (default off) and the wiring.
10. Proposed values, all pending owner approval and a phone test (`tech.md`, separate row): beat pattern `[50, 90, 50]`, period 900 ms, quiet window 450 ms (copied). Whether the two pulses are felt as two, whether the beat is told from the line buzz with eyes closed, and whether the 60 ms step jitter is felt are for the phone test. Known limit (Kiro): a step that is late by most of a period (only possible when the keep-alive is stalled, not at its 60 ms rhythm) can be followed by the next beat sooner than one period after it.


### Requirement 35: One structural guard at every scene ingress (core half; task 61)
> Written by Kiro on 2026-11-16 BEFORE the code. This requirement covers the pure guard `frontend/src/core/sceneGuard.ts` and its use in `core/savedDiagrams.ts` `deserialise`. Wiring the guard into the other two ingress points (the network client and the bundled-sample loader, both outside `core/`) is a later lane; until then only saved storage is guarded, and this requirement says so rather than claiming all three. `hitTest.ts`, `hapticEngine.ts` and every tuned value are NOT changed.

**User Story:** As a blind student, I want a diagram that reaches Explore to be one the app can always feel, so that a damaged saved entry, a bad response or a bad file can never freeze or silence the screen I am touching.

#### Acceptance Criteria
1. EVERY scene that reaches Explore, whether from the network, a bundled sample or saved storage, SHALL have passed one structural guard, `isRenderableScene(value: unknown): value is DiagramScene`. (Now enforced for saved storage; the other two are the later lane.)
2. THE guard SHALL accept a value only when ALL of these hold:
   1. it is a non-null, non-array object whose `kind` is one of `geometry`, `function_graph`, `bar_chart`, `unknown`;
   2. `points`, `segments`, `polylines` and `bars` are present and are arrays (a missing array is NOT read as empty; an empty array is fine). `facts`, when present, is an array of strings;
   3. every id (of a point, segment, polyline or bar) is a non-empty string; every segment's `a` and `b` are ids of points in the same scene;
   4. every coordinate is a finite number in [0, 1]: point `x` and `y`, every polyline vertex (a pair of two such numbers), bar `x0`, `x1`, `y_top`, `y_base`, and `axes.x_axis_y` and `axes.y_axis_x` when they are not null;
   5. every bar `value` is a finite number;
   6. `aspect`, when present, is a finite number in [0.05, 20];
   7. `title`, when present, is a string or null; every `label`, when present, is a string or null, and every bar label is a string; `axes`, when present, is null or an object;
   8. sizes: at most 500 points, 1000 segments, 50 polylines, 1000 vertices in any one polyline, 100 bars and 100 facts (the backend's `MAX_SCENE_*` in `backend/app/validate.py`), and every string (title, label, fact, bar label) at most 300 characters (`MAX_TEXT_CHARS`).
3. THE guard SHALL NOT require anything the backend does not require beyond 2.2 (it does not demand unique ids, reserved-id checks or a drawable element; those stay with the validators and `validateSceneInvariants`). A scene the backend accepts and that has all four arrays SHALL be accepted.
4. THE guard SHALL be total and pure: for any value, including cyclic-free JSON of any shape, it returns a boolean and never throws; no React, no browser API, no i18n, no import except scene types.
5. `deserialise` SHALL return `undefined` for a saved entry whose scene the guard rejects, in addition to its existing checks. A saved entry written before this requirement with a missing array is therefore dropped as corrupt (decided by the owner's brief: a missing array is not acceptable).
6. FOR ANY accepted scene, AND any finger position and viewport, `hitTest`, `step`, `directionOf`/`vertexExits`/`lineEnds`/`nearestElement`, `curveYAtX` and `followTarget` SHALL NOT throw and SHALL return only finite numbers. IF a counterexample is found in `core/`, THEN work SHALL stop, the counterexample SHALL be logged in `docs/BUILD_LOG.md`, and the fix SHALL be its own specified task.



### Requirement 36: Vibration and tone are off after the last finger or a lost page, whatever the input (task 64)
> Written by Kiro on 2026-11-16 BEFORE the test, for the pure touch pipeline: `hitTest` (or `followTarget` when sticky lines are on), `step()` and, when it is on, `heartbeatStep`. Test only: no file under `frontend/src/` changes and no tuned value changes. The Explore screen's own event handling (pointer capture, the keep-alive timer, visibility listeners) is not exercised here; the test models it as the five events below and says so.

**User Story:** As a blind student, I want the phone to go quiet the moment I lift my finger or the page is hidden, however strange the touches before it were, so that a stuck buzz or tone never tells me something is under my finger when nothing is.

#### Definitions
- **Event:** pointer down, move, up or cancel of pointer 0, 1 or 2 at any screen position (outside the canvas, exactly on a corner, NaN or infinite included); `blur`; `hidden`. The first pointer down is the primary one; the oldest remaining pointer becomes primary when the primary one ends (Requirement 4.8).
- **Lift:** the last pointer up or cancelled, or `blur`, or `hidden`. A `blur` or `hidden` clears every pointer.

#### Acceptance Criteria
1. FOR ANY sequence of 1 to 400 events with time steps from 0 ms to 5 s (equal timestamps included), over any bundled sample scene or any valid scene, including scenes with zero-length segments, coincident points, bars with `x0 == x1`, polylines of two identical points and a viewport with zero width or height, THE pipeline SHALL NOT throw, SHALL produce at most 4 effects per step, and every `tone` effect SHALL carry `null` or a finite frequency.
2. AFTER a lift THE effect list of that step SHALL end with `vibrate(0)` as its last vibration effect and `tone(null)` as its last tone effect, THE engine state SHALL equal `initialState()`, the heartbeat state SHALL equal its initial state, the followed target SHALL be none, and NO further effect SHALL be produced until the next pointer down. This holds with the heartbeat and sticky lines on or off.
3. WHILE one touch lasts, TWO consecutive corner announcements of the same vertex SHALL be at least `quietMs` apart (Requirement 4.9). Labels in the generated scenes are unique per vertex, so a repeat is the same vertex.
4. THE same event sequence over the same scene SHALL give exactly the same effects, and the scene SHALL be unchanged afterwards.
5. IF a sequence breaks 1 to 4 THEN its seed SHALL be kept as a pinned regression example in the test file and reported; the invariant SHALL NOT be weakened to get a green run.


### Requirement 37: Lift means quiet (task 67; spec before code, bug from the owner's phone and `docs/reports/fable-blind-user-plan.md`)
> Written by Kiro on 2026-11-17 BEFORE the fix. Today `handlePointerLift` stops vibration and tone when the last finger lifts but leaves the speech running, so a corner or axis sentence keeps talking over the next thing the student does. The fix is for agy lane ux1 in `screens/Explore.tsx`. No tuned haptic value changes.

**User Story:** As a blind student who lifts my finger to think, I want the app to stop talking about what my finger was on, so that I can hear my screen reader or the next thing I do, and I do not want an answer I asked for to be cut off.

#### Acceptance Criteria
1. WHEN the last finger lifts (no pointer remains after promotion, Requirement 4.8; a promotion is not a lift) AND exploration speech is playing, THEN the system SHALL stop that speech within 400 ms of the lift. "Exploration speech" is speech started by finger movement or a hold: a corner label and its exits, an axis word, a bar label or value, a line name, the where-am-I rest sentence, the page-edge sentence, "Centre.".
2. WHEN an Ask answer is in progress (from the moment the answer is handed to the speech driver until it ends), or a Guide announcement is playing, THEN a lift SHALL NOT stop it.
3. WHEN a new touch begins within 300 ms of the lift THEN the system SHALL NOT stop speech on behalf of that earlier lift, so the label that the new touch speaks is not cut. A stop that is waiting SHALL be cancelled by the new touch. (So the stop happens between 300 and 400 ms after a lift that is not followed by a touch.)
4. THE stop SHALL be requested through the speech driver (`stopSpeaking`) and SHALL NOT change what is spoken by the next touch.
5. THE lift SHALL still stop vibration and tone exactly as before (Requirement 4.7); this requirement adds no effect to the engine, and `step()` is unchanged.

### Requirement 38: Hold services survive Guide and Ask (task 67)
> Written by Kiro on 2026-11-17 BEFORE the fix. Today a pointer-down while Guide is guiding stops the keep-alive timer and never restarts it, so after Guide arrives a finger that rests on a line is silent until it moves. The same holds after Ask listening ends. For agy lane ux2.

**User Story:** As a blind student whose finger is still down when a guided trip ends, I want the line under my finger to keep buzzing, so that I do not have to lift and touch again to feel where I am.

#### Acceptance Criteria
1. WHILE a finger is down AND Guide is not guiding AND Ask is not active, THE hold keep-alive ticks (Requirement 4.1, 60 ms) SHALL run for the primary finger, whatever stopped them earlier in the same hold (a pointer-down while guiding, a pointer-down while Ask was listening, a Guide start, a Guide arrival or stop, the end of Ask listening).
2. WHEN Guide ends (arrival, stop, timeout, Back) or Ask listening ends while the primary finger is still down THEN the ticks SHALL resume from the finger's last known position within 60 ms plus one tick interval, without waiting for a pointer move. A pointer-down or move that arrives while Guide or Ask holds the engine silent SHALL still record the finger position for this.
3. A finger resting on a line after Guide arrives SHALL therefore get the line buzz of Requirement 4.1 (`vibrate(80)`) within 1 s of arrival.
4. THE guards of Requirements 28.7, 29.6 and 30.4 (no exits, no line name, no where-am-I, no click, no scan tone while Ask listens or Guide guides) are unchanged: this requirement only makes the ticks come back when those guards open.
5. No tuned haptic value changes; `step()` is unchanged.

### Requirement 39: One sound, one meaning (task 67)
> Written by Kiro on 2026-11-17 BEFORE the fix. `applyMoveResult` plays `playEarcon('back')` when the page-edge sentence is spoken, but 'back' is the earcon that means "leaving Explore" (`handleExit`, the Back subscription). For agy lane ux3.

**User Story:** As a blind student, I want each short sound to mean one thing, so that the sound I hear when I slide off the page is not the sound that tells me I have left the diagram.

#### Acceptance Criteria
1. WHEN the finger leaves the unit square (Requirement 32.1) THEN the system SHALL speak the edge sentence (`edge.top`, `edge.bottom`, `edge.left`, `edge.right`) and SHALL NOT play the `back` earcon.
2. ANY earcon the edge cue plays SHALL be a kind that no other event plays (a new earcon kind, or no earcon). THE `back` earcon SHALL still play when the student leaves Explore, exactly as before.
3. THE edge cue SHALL still use no vibration (Requirement 32.1) and SHALL still fire once per exit and re-arm as in 32.1 and 32.4.

### Requirement 40: Where am I on rest is never lost (task 67)
> Written by Kiro on 2026-11-17 BEFORE the fix. In the keep-alive tick, `checkWhereAmIDwell` marks the rest as spoken (`spoken: true`) before the code checks `!isSpeechSpeaking()`, so a dwell that falls due while the overview is still playing is consumed and nothing is ever spoken for that rest. For agy lane ux2.

**User Story:** As a blind student who rests on empty space while the diagram overview is still being read, I want to hear where I am once it finishes, instead of silence.

#### Acceptance Criteria
1. WHEN the rest dwell of Requirement 30.1 falls due while other speech is playing THEN it SHALL stay due, and the system SHALL speak the where-am-I sentence once that speech has ended, provided the finger is still at rest, Directions is on, Ask is not listening and Guide is not guiding. It SHALL be spoken within 1.5 s of the end of that speech.
2. THE rest SHALL be marked as spoken only when the sentence is actually handed to the speech driver. A dwell SHALL NEVER be consumed without speech.
3. THE once-per-rest rule, the 20 CSS px re-arm and the 1500 ms speech quiet window of Requirement 30 are unchanged.

### Requirement 41: Graph scan tone never covers a corner (task 67)
> Written by Kiro on 2026-11-17 BEFORE the fix. `scanTone` (`flow/explore.ts`) returns a curve-height tone for any target except the polyline itself, so on a `function_graph` with a labelled point the quiet scan tone starts again right after the engine stopped the tone for the corner (Requirement 4.3: `tone(null)`). For agy lane ux3.

#### Acceptance Criteria
1. WHEN the target is a vertex THEN `scanTone` SHALL return `null`, for any scene, x and y.
2. WHILE the target is a vertex, the audio driver SHALL receive no `setTone` call with a frequency, and the scan SHALL NOT re-arm a tone that the engine stopped in the same step.
3. Everything else about the scan (Requirement 5.6, level 0.33, off the curve only, the Graph scan switch) is unchanged.

### Requirement 42: Axis side is re-seeded when a hold begins or Guide ends (task 67)
> Written by Kiro on 2026-11-17 BEFORE the fix. `handlePointerDown` seeds the axis side only on the non-guiding path, so a hold that starts while Guide is guiding keeps the side of an earlier hold, and the first move after Guide arrives speaks a crossing ("y-axis") that the finger never made. For agy lane ux2.

#### Acceptance Criteria
1. AT the start of every hold, including a hold that starts while Guide guides or Ask listens, THE axis side SHALL be seeded silently from the finger's position (as Requirement 5.4 and the existing seed do).
2. WHEN Guide ends while the finger is down THEN the axis side SHALL be seeded again, silently, from the finger's position at that moment, so a move after arrival speaks a crossing only if the finger crossed an axis after the seed.
3. A crossing that the finger really makes after the seed SHALL still be spoken once (Requirement 5.4 and 17.2 are unchanged).


### Requirement 43: An element with no label is described, never named by its id, when the id is machine-made (task 69)
> Written by Kiro on 2026-11-17 BEFORE the code. Raw Mode names its points `raw_p<n>` and segments `raw_s<n>`; speaking such an id aloud is noise. This covers the pure rule in `frontend/src/core/speakable.ts` only. Wiring it into Explore, Ask and the TalkBack labels is a later agy lane (`flow/`, `screens/` are not edited here). No tuned value changes.

**User Story:** As a blind student exploring a Raw Mode or unlabelled diagram, I want the app to describe an element instead of reading me a code like "raw underscore p 17", so that what I hear means something.

#### Acceptance Criteria
1. THE core SHALL answer `isMachineId(id)`: true when the id starts with `raw_`, `point_`, `pt_`, `seg_`, `line_`, `poly_` or `bar_` (any letter case) followed by an optional single letter and then digits only; or is longer than 12 characters; or contains both an underscore and a digit. Otherwise false. A non-string SHALL count as machine-made.
2. THE core SHALL answer `speakableName(label, id)`: the trimmed label when it is a non-blank string; otherwise the trimmed id when it is a non-blank string and not machine-made; otherwise `null`. A label always wins over its id, even when the id is speakable.
3. Single letters and short textbook names ("A", "B'", "P1", "O", "AB") SHALL be speakable. Every id the backend Raw Mode produces (`raw_p<n>`, `raw_s<n>`) SHALL NOT be.
4. WHEN `speakableName` returns `null` THE caller SHALL describe the element (kind, position or direction) and SHALL NOT speak the id. The wording and wiring are a later lane.
5. Both functions SHALL be pure and total: never throw for any input, no browser API, no i18n, no import.


### Requirement 44: Three presets set every Explore switch at once (core half; task 70)
> Written by Kiro on 2026-11-17 BEFORE the code. This requirement covers the pure data module `frontend/src/core/presets.ts` only. Reading and writing storage, the Settings UI, spoken text and strings are lane ux10. No tuned value changes and no stored default changes.

**User Story:** As a blind student (or the person helping me), I want to pick one of three named settings instead of six switches, so that I get a sensible set without having to understand each one.

#### Definitions
- **Explore settings:** speech detail (`full` or `short`) and five switches: directions, finding sound, graph scan, stay on line (`stickyLine`), corner heartbeat (`cornerHeartbeat`).
- **PROPOSED feature:** one whose values `tech.md` marks "PROPOSED, pending owner approval, not phone-tested" and that ships OFF: stay on line (Requirement 33) and corner heartbeat (Requirement 34).

#### Acceptance Criteria
1. THE core SHALL export three presets, `simple`, `standard` and `explorer`, each giving a value for every Explore setting:

   | Preset | speechDetail | directions | findingSound | graphScan | stickyLine | cornerHeartbeat |
   |---|---|---|---|---|---|---|
   | simple | short | on | off | off | off | off |
   | standard | full | on | on | on | off | off |
   | explorer | full | on | on | on | on | on |

2. THE `standard` preset SHALL equal the defaults the app ships today, which are the documented defaults of the storage getters (`getStoredSpeechDetailSetting`, `getStoredDirectionsSetting`, `getStoredFindingSoundSetting`, `getStoredGraphScanSetting`, `getStoredStickyLineSetting`, `getStoredCornerHeartbeatSetting`) when nothing is stored. A test SHALL read them from those getters, so the two cannot drift.
3. A preset SHALL NOT turn on a PROPOSED feature (stay on line, corner heartbeat) unless it is `explorer`. Only `explorer` has either on. (Finding sound is also still PROPOSED, task 51, but it ships on today, owner decision OD-2; `standard` keeps today's value and does not change it. `simple` turns it off.)
4. `applyPreset(id)` SHALL return the settings of that preset as a new object each call, so a caller cannot change the preset table by editing the result. IF `id` is not one of the three (junk from storage) THEN it SHALL return a copy of `standard`.
5. `presetOf(settings)` SHALL return the id of the preset whose six values all equal `settings`, and `'custom'` for every other value, including a missing or mistyped field, extra fields with the right six values being ignored, `null`, `undefined` and any non-object. It SHALL never throw.
6. FOR EVERY id, `presetOf(applyPreset(id))` SHALL equal `id`. The three presets SHALL differ from one another, so the answer is never ambiguous.
7. THE module SHALL be pure: no storage, `localStorage`, React, i18n, DOM or other import. It SHALL NOT import from `flow/` (it declares its own `'full' | 'short'` type).
8. No tuned haptic value, storage key or stored default SHALL change. THE module is not called by the app until lane ux10.



### Requirement 45: A voice command matches a whole phrase, never a word inside a question (task 71)
> Written by Kiro on 2026-11-17 BEFORE the tests. `flow/commands.ts` `parseExploreCommand` decides help, describe, repeat, next corner, faster and slower with `includes(...)` and `startsWith(...)`, so a question that merely contains one of those words is run as a command (for example "Can you help me find AB?" opens the help list instead of being asked). The fix is for an agy lane in `flow/commands.ts`; Kiro writes the test first, red until then. No tuned value changes.

**User Story:** As a blind student who asks a real question by voice, I want my question to be answered, not swallowed by a command that shares one word with it.

#### Acceptance Criteria
1. THE transcript is normalised as today (lower case, trimmed, punctuation removed, spaces collapsed). A command (help, describe, repeat, next corner, set rate) SHALL match only when ONE of these holds:
   1. the normalised transcript equals one of that command's listed phrases (any length), or
   2. the transcript has at most 3 words AND every word of it is a word of a listed phrase of that same command.
2. A transcript that only contains a command word or phrase inside a longer sentence SHALL NOT match: it parses as `unknown` and goes on to Ask. This holds in English, Hindi and Gujarati (a Hindi or Gujarati phrase inside a longer sentence is not a command either).
3. THE bare commands in the three languages ("help", "मदद", "મદદ"; "repeat", "दोहराएं", "ફરી બોલો"; "next corner", "अगला कोना", "આગળનો ખૂણો"; "describe", "वर्णन करें", "વર્ણન કરો"; "faster", "तेज़", "ઝડપી"; "slower", "धीमा", "ધીમું") SHALL still parse to the same command as before.
4. Where am I and the Guide commands are not changed by this requirement (they are listed as a known limit: `where am i` also uses `startsWith` / `includes`; a separate requirement will decide it).
5. Assumption recorded by Kiro: the request said "an exact phrase or a transcript of at most 3 words". Read literally, "Describe angle B" (3 words) would still match, yet it is one of the questions that must NOT. Clause 1.2 therefore adds "every word is a word of the command's own phrases", so "help me" and "repeat that" match and "describe angle B" does not. If the owner wants the literal rule, 1.2 changes and that row moves out of the table.

### Requirement 46: A saved on/off setting reads back exactly, and a failed write is not lost (task 72)
> Written by Kiro on 2026-11-17 BEFORE the tests. Seven boolean getters (`getStoredDirectionsSetting`, `getStoredFindingSoundSetting`, `getStoredStickyLineSetting`, `getStoredCornerHeartbeatSetting` in `drivers/storage.ts`; `getStoredGraphScanSetting` in `flow/explore.ts`; `getStoredGuideSetting` in `config/features.ts`; `getStoredTeacherSetting` in `flow/teach.ts`) read `stored === 'true'` whenever anything is stored, and prefer a stored value over the in-memory one. Fix is for an agy lane; no stored default and no storage key changes.

#### Acceptance Criteria
1. WHEN the stored string is exactly `'true'` THE getter SHALL return true; WHEN it is exactly `'false'` it SHALL return false. FOR ANY other stored string (empty, `'TRUE'`, `'1'`, `'yes'`, ` true`, anything) AND no in-memory value, THE getter SHALL return its documented default: directions, finding sound and graph scan true; stay on line, corner heartbeat, Guide and Teacher false. Nothing is stored: the same default.
2. WHEN a write to storage fails (`setItem` throws, for example a full or blocked store) THEN the value just set SHALL be what the getter returns afterwards, whatever string was stored before (valid, junk or none). The in-memory value wins over a stale stored one.
3. A write that succeeds SHALL still be what the getter returns (unchanged behaviour).

### Requirement 47: Explore stays quiet when it should and buzzes when it should, over a minute of mixed use (task 73)
> Written by Kiro on 2026-11-17 BEFORE the test. Test only. A soak on the real `Explore` screen with fake drivers and fake timers, about 60 simulated seconds of random use. It joins the guard tests of task 65 and the oracles of task 67; it does not replace them.

#### Definitions
- **Operations:** pointer down, move and up (one finger); window `blur`; `visibilitychange` to hidden; Ask start and Ask stop (a recognised phrase); Guide start (by voice) and Guide arrival (the finger reaches the target); a change of any of the six Explore switches (speech detail, directions, finding sound, graph scan, stay on line, corner heartbeat); and the passing of 0 to 300 ms between them.
- **Lifted:** no finger is down: after a pointer up, `blur` or hidden, until the next pointer down.
- **Settled tail:** after the random operations, Ask is stopped and Guide is ended, the finger is put on a line (moved there if down, put down there if lifted), 600 ms pass (so the 450 ms quiet window of a corner is over), then 300 ms pass with no event.

#### Acceptance Criteria
1. WHILE lifted, THE screen SHALL NOT call `vibrate` with a pattern that has a positive entry and SHALL NOT call `setTone` with a frequency. (`vibrate(0)` and `setTone(null)` are allowed: they are the stop.)
2. WHILE Ask is listening, THE screen SHALL NOT call `setTone` with a frequency.
3. AFTER the settled tail, a `vibrate(80)` SHALL have been called in the last 200 ms of the 300 ms (Requirements 4.1, 38.1, 38.2).
4. THE run SHALL NOT throw, and SHALL be repeatable from its seed. A failing sequence SHALL be kept as a pinned example in the test file and reported; the invariant SHALL NOT be weakened to get a green run. A red invariant that is a known bug (task 67 oracles U1) is marked `it.fails` with its reason, and a second run that skips only that path keeps the other invariants guarded.
5. Known limits: one finger only (promotion is covered by Requirement 4.8's own tests), two scenes (triangle and sine sample), no real speech engine or phone.


### Requirement 48: The Correct button is offered only when Teacher tools is on (task 79)
> Written by Kiro on 2026-11-18 BEFORE the code, from owner decision D6 (`docs/reports/opus-owner-decisions-2026-11-18.md`). Reason: a blind student who lands in an editor they cannot see could overwrite the teacher's corrections. Teacher tools' own gating (`VITE_FEATURE_SHARE` and the Settings switch, `isTeacherActive()` in `flow/teach.ts`) is not changed.

**User Story:** As a blind student, I want the Explore screen to offer only controls I can use, so that I never open a visual editor by accident and change a diagram my teacher corrected.

#### Acceptance Criteria
1. WHEN `isTeacherActive()` is false THEN `App` SHALL NOT pass `onCorrect` to `Explore`, and Explore SHALL render no Correct button: no element, no accessible name "Correct", no focus stop.
2. WHEN `isTeacherActive()` is true THEN `App` SHALL pass `onCorrect` and Explore SHALL show the Correct button as before (accessible name, at least 48 x 48 CSS px).
3. WHILE the button is absent THE footer SHALL leave no empty slot or gap and the other controls (Where am I, Ask, Back, Guide me when on) SHALL stay inside the viewport and at least 48 x 48 CSS px. Requirement 25 holds unchanged: the canvas box and the fixed-height status area do not depend on the button.
4. THE decision SHALL be read each time Explore is rendered from `App`, so turning Teacher tools on in Settings shows the button the next time Explore opens.
5. THE Correct screen, its Back policy (Requirement 24.1), the `#/teach` route and the gating of Teacher tools SHALL NOT change. A saved or shared link that is already open on the Correct screen is not affected by this criterion.
6. No new string. No tuned haptic value changes.



### Requirement 49: "Show me" highlight of the touched element (core half; task 80.1)
> Written by Kiro on 2026-11-20 BEFORE the code, from `docs/reports/fable-project-improvement-report.md` item I29 and owner decision D9 (`docs/reports/opus-owner-decisions-2026-11-18.md`): on by default, no switch; dropped if not merged by Nov 28. This requirement covers the pure helper `frontend/src/core/highlight.ts` and states what the screen lane (task 81) must do. `screens/`, `flow/`, `App.tsx`, `hitTest.ts`, `hapticEngine.ts` and every tuned haptic value are NOT changed by task 80.

**User Story:** As a low-vision student, or a sighted teacher watching over my shoulder, I want the part of the diagram my finger is on to light up, so that what I feel and what I see agree.

#### Definitions
- **Hit:** the `Target` that `hitTest` (or `followTarget`, when Stay on line is on) reports for the primary finger.
- **Highlight:** `{ kind: 'vertex' | 'segment' | 'polyline' | 'axis' | 'bar' | 'none', id: string | null }`.

#### Acceptance Criteria
1. THE core SHALL export `highlightFor(hit, scene)` returning a Highlight. A `vertex` hit gives `vertex` with that id when a point with that id exists. A `line` hit gives `segment`, `polyline` or `axis` by its `elementKind` when a segment or polyline with that id exists, or (axis) when the id is `x-axis` and `axes.x_axis_y` is a number, or the id is `y-axis` and `axes.y_axis_x` is a number. A `line` hit with `elementKind` `bar-edge`, and a `bar` hit, give `bar` with that id when a bar with that id exists.
2. IN every other case, including a `none` hit, `null`, `undefined`, a hit of an unknown kind, a hit whose id is not in the scene or is not a string, or a scene with missing arrays, THE result SHALL be `{ kind: 'none', id: null }`. THE helper SHALL NEVER return an id that is not an id of an element of that kind in the scene, and SHALL NEVER throw.
3. THE helper SHALL be pure and deterministic: the same hit and scene give deep-equal results, a hit and a copy of it give the same answer, it returns a new object on each call, and it mutates neither input. It SHALL NOT read the viewport, the finger or the time, and SHALL import only types.
4. (Screen lane, task 81) WHILE a finger is down AND the highlight is not `none`, THE Explore canvas SHALL draw that element thicker and brighter than the rest of the drawing. Proposed: stroke at least twice as wide, in a lighter tint of the existing line colour, pending the owner's look on a phone. A vertex SHALL be drawn with a larger, brighter dot. A bar SHALL have its outline thicker and brighter; its fill is not changed.
5. (Screen lane) THE highlight SHALL clear, and the canvas SHALL be redrawn without it, on lift (last pointer up or cancelled, `blur`, page hidden), on a scene change, and when the target becomes `none`. A promotion of a second finger (Requirement 4.8) SHALL follow the new primary finger's target.
6. (Screen lane) THE highlight SHALL be draw-only. For every recorded trace the `vibrate`, `setTone`, `speak`, `stopSpeaking` and `playEarcon` calls with the highlight SHALL be identical to those of the build without it. No new speech, earcon, vibration or tone.
7. (Screen lane) THE highlight SHALL NOT change the layout: the canvas box, the status card and the status line keep the sizes of Requirement 25. It is drawn inside the canvas bitmap, so no element is added to the flow.
8. (Screen lane) THE highlight SHALL NOT animate, pulse or flash (Requirement 14.5, WCAG 2.3.1); under `prefers-reduced-motion` nothing differs, because there is nothing to disable. It is a static redraw.
9. (Screen lane) Requirement 14.6 (tactile canvas purity) stands: the highlight changes the weight and tint of an existing stroke. It adds no texture, grid, stitch, rivet or glow region to the canvas.
10. (Screen lane) THE highlight SHALL be on by default with no Settings switch (decision D9). IF the screen lane is not merged by Nov 28 THEN this requirement is withdrawn, not shipped half-done.
11. (Screen lane) FOR testability, THE canvas element SHALL carry `data-highlight` with the value `none` or `<kind>:<id>` (for example `vertex:A`), updated with every redraw. It is not read by assistive technology (it is a data attribute, not a label) and changes no layout.
12. THE helper SHALL add no tuned value and no user-facing string.



### Requirement 50: A Help button in Explore that speaks the gestures for the current mode (core half; task 80.2)
> Written by Kiro on 2026-11-20 BEFORE the code, from `docs/reports/fable-project-improvement-report.md` item I20 (the Help button; the practice sample of I20 is not part of this requirement). Today the gestures are spoken only on entry, and `commands.help` (`i18n/index.ts`) lists voice commands, is reachable only by saying "help" and omits guide and stop. This requirement covers the pure helper `frontend/src/core/help.ts` and states what the screen lane (task 81) must do. `screens/`, `flow/`, `App.tsx`, `i18n/`, `hitTest.ts`, `hapticEngine.ts` and every tuned haptic value are NOT changed by task 80.

**User Story:** As a blind student who has forgotten a gesture, I want one button that tells me what I can do on this screen right now, so that I do not have to leave Explore or guess.

#### Definitions
- **Help keys:** the six i18n keys `help.touch`, `help.back`, `help.ask`, `help.guide`, `help.stop`, `help.raw`, in that order. The Help button's own name key is `explore.help`.
- **Context:** `{ raw: boolean; guideOn: boolean; askOn: boolean }`: the scene is a Raw Mode scene; the Guide feature is switched on (feature flag and Settings switch, as Explore already decides it); the Ask control is available.

#### Acceptance Criteria
1. THE core SHALL export `helpSentences(ctx)` returning an array of Help keys, never wording. The array SHALL always contain `help.touch` and `help.back`; SHALL contain `help.ask` exactly when `ctx.askOn === true`; SHALL contain `help.guide` and `help.stop` exactly when `ctx.guideOn === true`; SHALL contain `help.raw` exactly when `ctx.raw === true`. The keys SHALL be in the declared order (`help.touch`, `help.back`, `help.ask`, `help.guide`, `help.stop`, `help.raw`), with no duplicates, and the array SHALL NEVER be empty.
2. THE helper SHALL be pure and total: same context gives an equal array and a new array each call; it SHALL never throw and SHALL treat any field that is not exactly `true` (missing, `null`, a string, a number, a missing context) as off. It SHALL import nothing, hold no wording, and add no tuned value.
3. (Screen lane, task 81) THE Explore footer SHALL have a Help button: class `gt-explore__help`, a visible and accessible name from `t('explore.help')`, at least 48 x 48 CSS px, in the same flex row as Ask, Where am I and Back. It SHALL be present whether or not Teacher tools or Guide are on.
4. (Screen lane) WHEN Help is activated THEN the screen SHALL speak, as ONE utterance, the sentences `t(key)` for each key of `helpSentences({ raw: isRawScene, guideOn: <Guide is enabled>, askOn: true })` in order, joined with `joinAnnouncements` (Requirement 17.2). A new speak cancels earlier speech, as every speak does. (Amended by Kiro, task 81.2 follow-up, review `kiro-review-hi3-hi4.md` issue 1: `raw` is the screen's own Raw Mode determination, `isRawScene` in `Explore.tsx`: the `isRaw` prop when given, otherwise the scene kind is `unknown` or the entry announcement is the raw announcement. It is not the `isRaw` prop alone, because `App.tsx` does not pass the prop. The sentence list is exact: `help.raw` is spoken for a Raw Mode scene and never for any other, and no sentence outside `helpSentences` is added.)
5. (Screen lane) HELP SHALL be an explicit request, like Where am I (Requirement 30.3): it works whether Directions is on or off, whether or not a finger is down, and while Guide is guiding or Ask is listening. It starts no Ask, Guide or other mode, moves no focus, and navigates nowhere.
6. (Screen lane) HELP SHALL change no `vibrate` or `setTone` call and no other speech: for a recorded trace with no Help press the calls are the same as before this requirement. The footer SHALL still wrap and keep every button at least 48 x 48 CSS px inside the viewport; the canvas box and the fixed status area of Requirement 25 SHALL NOT change; the existing e2e layout specs SHALL still pass. Folding other buttons into a "More" menu (I20) is NOT part of this requirement.
7. (Screen lane) THE seven strings (`explore.help` and the six Help keys) SHALL exist in `en`, `hi` and `gu` in `frontend/src/i18n/index.ts`, be non-blank, have Hindi and Gujarati values that differ from the English, and SHALL NOT contain "verified", "correct", "checked" or "approved" (any case). They SHALL be listed in `docs/user-test/translation-review.csv` and `.md` for native review. The wording says what a student does ("Drag one finger to feel the diagram."), never that the diagram is right.
8. (Screen lane) THE guide sentence SHALL name how Guide is started by voice and `help.stop` how to end it, as the app does today; the wording MAY NOT promise a gesture the app does not have. The Raw Mode sentence SHALL say the outlines are rough, as Requirement 8.1 does.
9. Known limit, not changed here: the voice command "help" still speaks `commands.help` (the command list). Making it speak the same sentences is a later lane, so the two do not drift; Requirement 45 (whole-phrase matching) is unchanged.
