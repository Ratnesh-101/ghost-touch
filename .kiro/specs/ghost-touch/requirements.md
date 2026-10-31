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
2. WHEN the user selects "Choose image" THEN the system SHALL accept JPEG, PNG, or WebP up to 10 MB.
3. WHEN an image is submitted THEN the system SHALL announce "Reading your diagram" and play a soft repeating progress tone until a result arrives.
4. THE system SHALL offer at least three bundled sample diagrams (triangle, sine graph, bar chart) usable without a camera or network.

### Requirement 3: Convert image to DiagramScene
**User Story:** As a student, I want the app to understand what the diagram contains, so that I feel shapes and hear meaningful labels instead of noise.

#### Acceptance Criteria
1. WHEN the backend receives an image THEN it SHALL return a `DiagramScene` classified as one of: `geometry`, `function_graph`, `bar_chart`, or `unknown`.
2. THE system SHALL express every coordinate in the `DiagramScene` normalized to the range [0, 1].
3. WHEN the vision LLM returns output that fails schema validation THEN the backend SHALL retry once, and IF the retry also fails THEN it SHALL return a Raw Mode scene.
4. THE backend SHALL respond within 15 seconds, or return a Raw Mode scene with a `timeout` reason.
5. THE system SHALL give every element in a `DiagramScene` a unique id, and every segment endpoint SHALL refer to an existing point.

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

### Requirement 10: Multilingual voice (Kiroween)
**User Story:** As a Hindi- or Gujarati-speaking student, I want labels and answers in my language.

#### Acceptance Criteria
1. THE system SHALL support English, Hindi, and Gujarati for all spoken output and UI strings.
2. WHEN the language changes THEN the system SHALL apply it to speech output and question answering.

### Requirement 11: Saved diagrams (Kiroween)
**User Story:** As a student, I want my diagrams saved on my phone, so that I can revisit them offline.

#### Acceptance Criteria
1. WHEN a scene is loaded successfully THEN the system SHALL save it locally with its thumbnail and a spoken title.
2. WHILE offline THEN the system SHALL allow exploring saved diagrams.

### Requirement 12: Accessibility and theme
**User Story:** As a blind or low-vision user, I want the whole app to work with TalkBack and high contrast, so that I can use it independently.

#### Acceptance Criteria
1. THE system SHALL give every control an accessible name and a touch target of at least 48×48 CSS px.
2. THE system SHALL use a dark theme with glowing green lines and a contrast ratio of at least 7:1 for text.
3. WHILE the Explore canvas is active THEN the system SHALL capture touches directly, and SHALL provide a clearly announced exit gesture (for example, a two-finger swipe down).
