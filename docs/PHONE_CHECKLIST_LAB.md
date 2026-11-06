# Ghost Touch — Lab Redesign Phone Verification Checklist

Copy-paste checklist for the owner to run on a physical Android phone (e.g., OnePlus Nord CE6 or budget Android device running Google Chrome over HTTPS).

Run this checklist twice in full:
1. **Pass 1: TalkBack OFF** (direct touch, sighted inspection, audio/haptic feel).
2. **Pass 2: TalkBack ON** (screen-reader accessibility, double-tap activation, pass-through exploration gesture).

---

## Device & Environment Setup

- [ ] **Device info recorded:** Android OS version, device model, and Chrome browser version are noted.
  Result:
- [ ] **Volume and haptics enabled:** Device media volume is at least 80%, Touch haptics / Touch feedback is ON in Android System Settings.
  Result:
- [ ] **HTTPS deployment live:** App is loaded over secure HTTPS (required for Web Audio, Web Speech, and Service Worker APIs).
  Result:
- [ ] **Backend service awake:** FastAPI backend is running and responds with `{"ok": true}` at `GET /api/v1/health`.
  Result:
- [ ] **TalkBack toggle shortcut configured:** Android Accessibility shortcut (Volume up + Volume down held for 3 seconds) is set up to toggle TalkBack on/off rapidly.
  Result:

---

## PASS 1: TalkBack OFF (Direct Touch & Visual/Haptic/Audio Exploration)

### 1. PWA Installation & Offline Launch (Airplane Mode)
- [ ] **PWA installation prompt:** Chrome displays the "Install app" or "Add to Home screen" banner/menu item.
  Result:
- [ ] **Home screen icon & name:** App installs with the Frankenstein phone creature mascot icon and the name "Ghost Touch".
  Result:
- [ ] **Home screen splash:** Launching from the home screen icon shows the dark lab charcoal (`#0b0e0c`) splash background and creature emblem.
  Result:
- [ ] **Offline boot under Airplane Mode:** With phone switched to Airplane Mode, launching the installed PWA loads the app instantly from Service Worker cache.
  Result:
- [ ] **Font caching offline:** Atkinson Hyperlegible self-hosted font renders cleanly without FOIT (flash of invisible text) or fallback font jitter while offline.
  Result:
- [ ] **Vector icons display offline:** Inline SVG creature mascot, organism badges, and interface icons render crisply with zero network calls.
  Result:

### 2. Start Screen ("Frankenstein's Lab")
- [ ] **Visual theme & atmosphere:** Deep lab charcoal background (`#0b0e0c`) with faint blueprint grid, high-contrast life green (`#39ff88`), and copper/brass accents.
  Result:
- [ ] **Creature emblem & organ tiles:** Start screen displays stitched creature mascot SVG and three organ tiles: Nerves (vibration), Eyes (vision AI), Voice (theremin + speech).
  Result:
- [ ] **Tagline copy:** Tagline clearly displays "Feel diagrams you can't see".
  Result:
- [ ] **Spoken intro on mount:** On first load, browser attempts to speak "Ghost Touch. Tap anywhere to begin." (or speaks immediately upon first touch).
  Result:
- [ ] **Single full-screen action button:** The entire screen functions as one large tap target with accessible label "Wake the creature" (or "Tap anywhere to begin").
  Result:
- [ ] **Tap interaction & haptic buzz:** Single tap anywhere vibrates once (`vibrate(50)`), unlocks Web Audio, speaks "Choose a diagram" / Capture prompt, and moves to Capture.
  Result:
- [ ] **Vibration fallback notice:** If vibration is unsupported by hardware, app speaks the audio-only warning and proceeds without blocking navigation.
  Result:

### 3. Capture Screen (Hierarchy & Lab Settings Sheet)
- [ ] **Visual hierarchy:** Header displays creature brand and status line; primary action "Take photo" is prominent in glowing green; secondary actions are clearly distinct below.
  Result:
- [ ] **Lab settings button:** Shows a single clearly labelled button reflecting the current configuration (e.g., "Settings: English, 1.0×").
  Result:
- [ ] **Lab settings sheet opens:** Tapping the Lab settings button opens a modal sheet; visual focus moves inside; spoken announcement indicates settings opened.
  Result:
- [ ] **Language options:** Settings sheet displays accessible buttons for English, Hindi (हिन्दी), and Gujarati (ગુજરાતી) with >= 48×48 px targets.
  Result:
- [ ] **Speech rate options:** Settings sheet displays accessible buttons for 0.8× Slow, 1.0× Normal, and 1.25× Fast speech rates.
  Result:
- [ ] **Language switch confirmation:** Tapping a language (e.g. Hindi or Gujarati) immediately gives spoken confirmation in that selected language.
  Result:
- [ ] **Speech rate switch confirmation:** Tapping a rate (e.g. 1.25×) immediately speaks a confirmation at that updated rate.
  Result:
- [ ] **Settings sheet dismissal:** Tapping outside, pressing Escape, or tapping Close dismisses sheet; focus returns cleanly to the Lab settings trigger button.
  Result:
- [ ] **Settings persistence:** Reloading the app or launching from cold storage retains the chosen language and speech rate via `localStorage`.
  Result:
- [ ] **Specimen jar cards:** Sample diagrams (Triangle, Sine curve, Bar chart) appear as distinct "specimen jar" cards with real mini diagram previews.
  Result:

### 4. Capture Actions & Loading State ("Lab Powering Up")
- [ ] **Camera launch:** Tapping "Take photo" directly opens the device rear camera (`capture="environment"`).
  Result:
- [ ] **File / PDF chooser:** Tapping "Choose image / PDF" opens Android file picker accepting JPEG, PNG, WebP, and PDF files.
  Result:
- [ ] **Size validation:** Selecting an image over 10 MB rejects cleanly with spoken message: "That file is too large. Maximum is 10 megabytes."
  Result:
- [ ] **PDF upload processing:** Selecting a PDF extracts the first page, downscales to <= 1600 px longest side, and announces "Using the first page of the PDF."
  Result:
- [ ] **Powering up loading state:** During scene processing, status card displays "Reading your diagram…" with copper charging bar animation.
  Result:
- [ ] **Progress audio tone:** Soft periodic beep (`beep(440, 120)`) sounds every 1.5 s while processing and silences immediately upon completion or cancellation.
  Result:
- [ ] **"It's Alive" celebration animation:** When scene finishes loading, a brief spark arc + glow pulse displays and the `success` earcon plays.
  Result:
- [ ] **Animation safety limits:** "It's Alive" animation lasts under 1.2 seconds with no strobing (well below 3 flashes per second WCAG 2.3.1 limit).
  Result:

### 5. Explore Screen (Specimen Table & Tactile Haptics)
- [ ] **Specimen table frame:** Diagram canvas is framed by stitched borders and copper rivet accents; canvas interior remains pure high-contrast black with green strokes.
  Result:
- [ ] **Continuous line vibration:** Tracing a diagram line triggers continuous `vibrate(80)` pulses re-triggered every 70 ms while finger remains on the stroke.
  Result:
- [ ] **Line departure silence:** Lifting finger or drifting off a stroke immediately silences vibration (`vibrate(0)`).
  Result:
- [ ] **Vertex double-pulse ("bzzzz-tap"):** Contacting a corner/vertex fires the distinct `vibrate([50, 90, 50])` double-tap pattern.
  Result:
- [ ] **450 ms quiet period:** After a vertex hit, line buzz is suppressed for exactly 450 ms so the corner pulse feels crisp and distinct.
  Result:
- [ ] **Spoken vertex labels:** Touching a vertex speaks its label (e.g. "Point A", "Point B. Right angle.") and cancels prior speech immediately.
  Result:
- [ ] **Theremin sonification (Sine curve):** Tracing the sine wave sample plays a continuous Web Audio theremin tone gliding between 200 Hz and 1000 Hz with visual height.
  Result:
- [ ] **Bar chart comparison:** Touching bars on the bar chart sample speaks bar labels and values with height-proportional pitch tones.
  Result:

### 6. Voice Ask Q&A & Text Fallback
- [ ] **Two-finger long press:** Holding two fingers on the diagram canvas for > 500 ms triggers the listening earcon (`beep(587, 100)`).
  Result:
- [ ] **Double-tap Ask button:** Tapping the accessible "Ask" button in the bottom HUD triggers the same listening state.
  Result:
- [ ] **Spoken question input:** Asking aloud "What kind of triangle is this?" records speech and displays "Thinking…".
  Result:
- [ ] **Two-sentence answer:** App speaks a concise 2-sentence response grounded strictly in the diagram's visible facts.
  Result:
- [ ] **Text fallback input:** When speech recognition is unavailable or toggled off, typing into the question input and tapping "Send" returns the spoken answer.
  Result:

### 7. Raw Mode Safety Fallback
- [ ] **Raw mode activation:** Photographing an ambiguous, hand-drawn, or crumpled diagram triggers OpenCV edge detection fallback when AI vision fails.
  Result:
- [ ] **Updated notice copy:** App announces: "The creature's eyes are blurry — you can still feel the outlines." (or current repo fallback string `raw.announce`). (verify)
  Result:
- [ ] **Tactile edge outlines:** Canvas renders high-contrast Canny edge segments; user can trace and feel outlines via vibration motor.
  Result:

### 8. Saved Diagrams (Specimen Archive)
- [ ] **Automatic saving:** Photographing a diagram or loading a file automatically stores the scene in local IndexedDB.
  Result:
- [ ] **Saved diagrams navigation:** From Capture screen, tapping "Saved diagrams" opens the archive screen.
  Result:
- [ ] **Empty state presentation:** When no diagrams are saved, screen shows friendly mascot illustration and speaks "No saved diagrams yet."
  Result:
- [ ] **Saved diagram card metadata:** Each saved item shows miniature rendered thumbnail, title, timestamp, and pin status.
  Result:
- [ ] **Offline reopening:** With phone in Airplane Mode, tapping a saved diagram opens Explore immediately with zero network requests.
  Result:
- [ ] **Pinning protection:** Tapping Pin on a diagram marks it pinned; pinned diagrams are protected from FIFO cap eviction.
  Result:
- [ ] **Deletion confirmation:** Tapping Delete requests confirmation and speaks deletion notice upon removal.
  Result:

### 9. Teacher Correct Mode (Calibration Bench)
- [ ] **Enter Correct mode:** From Explore, tapping the "Correct" button opens Teacher Correct screen with the original photo underlaid.
  Result:
- [ ] **Draggable vertices:** Sighted instructor can drag a point to correct its coordinates against the underlying photo.
  Result:
- [ ] **Label editing:** Selecting a point enables an accessible text box to edit or correct the vertex label.
  Result:
- [ ] **Undo / Redo controls:** Tapping "Undo" reverts the previous adjustment; tapping "Redo" restores it.
  Result:
- [ ] **Live validation on Save:** Tapping "Save" sends `POST /api/v1/validate` to backend; valid scene updates Explore; invalid scene displays error reason.
  Result:
- [ ] **Cancel returns intact:** Tapping "Cancel" discards unsaved edits and returns to Explore with original scene untouched.
  Result:

### 10. Visual Accessibility, Zoom & Themes
- [ ] **200% font size scaling:** In Android Settings > Display > Font size set to Maximum (200%), all text wraps cleanly without overlap or clipping.
  Result:
- [ ] **320 px narrow viewport:** In Chrome DevTools device mode (or on a 320 px wide screen), all controls stack cleanly without horizontal scroll.
  Result:
- [ ] **OS Dark / Light theme independence:** Toggling Android system theme between Dark Mode and Light Mode leaves the dark lab theme (`#0b0e0c`) and contrast intact.
  Result:
- [ ] **Visible focus rings:** Navigating controls via hardware keyboard or DPAD shows high-visibility >= 3px copper/cyan focus rings.
  Result:
- [ ] **Touch target sizes:** All buttons, selectors, and interactive controls measure at least 48×48 CSS px.
  Result:
- [ ] **Reduced motion compliance:** In Android Settings > Accessibility > "Remove animations" ON, all pulses, sparks, and progress transitions stay static.
  Result:

---

## PASS 2: TalkBack ON (Screen Reader Pass-Through & Assistive Navigation)

*Instructions: Turn TalkBack ON (hold Volume Up + Volume Down for 3s). Use single swipe right/left to navigate items, double-tap to activate, and the pass-through gesture (double-tap-and-hold then drag) on the Explore canvas.*

### 1. PWA & Start Screen with TalkBack
- [ ] **Home screen icon announcement:** Swiping to the Ghost Touch home screen icon announces "Ghost Touch, Web application, Double-tap to open."
  Result:
- [ ] **Start screen full-surface focus:** Screen opens with focus on the main surface button; TalkBack reads accessible name: "Ghost Touch. Tap anywhere to begin."
  Result:
- [ ] **Double-tap activation:** Performing TalkBack double-tap anywhere on screen triggers activation buzz (`vibrate(50)`), Web Audio unlock, and opens Capture.
  Result:
- [ ] **No speech collision:** Spoken prompt from app does not get cut off or collide into an unreadable state with TalkBack voice output.
  Result:

### 2. Capture Screen with TalkBack
- [ ] **Initial focus placement:** Focus moves cleanly to the primary action button ("Take photo") on screen entry.
  Result:
- [ ] **Control announcements:** Swiping right through controls announces in order: Take photo button, Choose image button, Saved diagrams button, Lab settings button.
  Result:
- [ ] **Lab settings button label:** TalkBack speaks the button's exact state: e.g. "Settings: English, 1.0 speed, button. Double-tap to open lab settings."
  Result:
- [ ] **Lab settings sheet focus trap:** Double-tapping settings opens the sheet; TalkBack focus shifts immediately to the first option inside the sheet.
  Result:
- [ ] **Radio / selection semantics:** Language and speed options announce clear selected state (`aria-pressed="true"` or radio selected).
  Result:
- [ ] **Dismiss settings via Android Back:** Performing TalkBack 2-finger swipe down-and-left (or system Back button) closes the sheet and returns focus to settings button.
  Result:
- [ ] **Specimen jar buttons:** Swiping to sample diagrams announces: "Sample: triangle, button", "Sample: sine graph, button", "Sample: bar chart, button".
  Result:

### 3. Explore Canvas Pass-Through Exploration (Requirement 13.1 & Gate A)
- [ ] **Canvas accessibility label:** Swiping to the Explore diagram canvas announces diagram name, geometry type, and gesture hint: "Double-tap and hold, then drag to feel the diagram."
  Result:
- [ ] **Pass-through gesture activation:** Performing TalkBack double-tap-and-hold on the canvas delivers continuous raw pointer events to the web app.
  Result:
- [ ] **Centre reference tick:** When double-tap-and-hold starts, the app buzzes with one distinct 25 ms pulse (`vibrate(25)`) indicating virtual finger starts at centre.
  Result:
- [ ] **Relative cursor tracking:** Dragging finger across the screen moves the virtual probe relative to starting centre; motor vibrates when crossing lines.
  Result:
- [ ] **Vertex hit announcement:** Crossing a vertex pulses the `[50, 90, 50]` ms motor pattern and speaks vertex label via Web Speech without TalkBack canceling it.
  Result:
- [ ] **Theremin pitch with TalkBack:** Tracing curves produces continuous audio theremin tone while TalkBack remains quiet.
  Result:
- [ ] **Re-arming on new hold:** Lifting finger and performing double-tap-and-hold in a new location re-centres probe and buzzes centre tick again cleanly.
  Result:
- [ ] **Exit Explore via Back gesture:** Performing Android Back or TalkBack Back gesture exits Explore screen cleanly back to Capture.
  Result:

### 4. Voice Ask Q&A with TalkBack
- [ ] **Ask button discovery:** Swiping past canvas lands on accessible "Ask question" button (`min-height: 48px`).
  Result:
- [ ] **Activation and earcon:** Double-tapping Ask button plays listening earcon (`beep(587, 100)`) and sets status to "Listening…".
  Result:
- [ ] **Spoken response delivery:** Question answer is spoken clearly via Web Speech and mirrored to polite live region.
  Result:
- [ ] **Text box accessibility:** Fallback text field is reachable with next swipe; double-tap opens virtual keyboard; Send button submits question.
  Result:

### 5. Saved Diagrams & Correct Mode with TalkBack
- [ ] **Saved diagrams list navigation:** In Saved diagrams screen, swiping iterates through each saved item with title, timestamp, and Pin / Delete actions.
  Result:
- [ ] **Pin / Delete accessible names:** Pin button has clear label: e.g. "Pin Right Triangle diagram" / "Unpin Right Triangle diagram".
  Result:
- [ ] **Delete confirmation dialog:** Double-tapping Delete announces confirmation request; confirming removes entry and announces removal.
  Result:
- [ ] **Teacher Correct mode controls:** In Correct mode, all tool buttons (Undo, Redo, Label input, Save, Cancel) announce clear accessible names and states.
  Result:
- [ ] **Point selection feedback:** Selecting a point announces: e.g. "Selected Point A at coordinate X 0.2, Y 0.8".
  Result:

---

## Verification Summary Table

| Test Suite | Total Checks | Pass | Fail | Notes / Deviations |
|---|---|---|---|---|
| Pass 1: TalkBack OFF | 42 | | | |
| Pass 2: TalkBack ON | 25 | | | |
| **Total** | **67** | | | |

**Tester Signature:** ___________________________  
**Date Tested:** ___________________________  
**Device Tested:** ___________________________  
