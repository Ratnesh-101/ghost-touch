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
