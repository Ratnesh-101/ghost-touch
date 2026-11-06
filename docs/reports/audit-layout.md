# Audit Report: Layout, Zoom, and Translation-Length Risks

**Auditor:** Antigravity (agy)  
**Date:** 2026-11-06  
**Scope:** Screens (`Start`, `Capture`, `Explore`, `SavedDiagrams`, `Correct`, `Debug`), CSS (`tokens.css`, `global.css`, `saved.css`, `correct.css`), i18n strings (`frontend/src/i18n/index.ts`), and geometry/hit-test pipelines (`geometry.ts`, `hitTest.ts`, `flow/correct.ts`).  
**Context:** Preparation for the "Frankenstein's Laboratory" UI redesign (`docs/briefs/lab-spec.md`).  
**Baseline Test Suite:** 42 test files, 473 passed (`npm --prefix frontend test`).

---

## 1. Executive Summary

This audit assesses the resilience of Ghost Touch across all screens against extreme physical display conditions: 320 px viewport widths, 200% browser zoom (effective 160 px width), landscape orientation on small handhelds, camera notches (`viewport-fit=cover`), virtual keyboard activation, and translation expansion for Hindi and Gujarati.

### Screen Safety Verdicts
| Screen | Verdict | Key Risk Factor |
|---|---|---|
| **Start** | **UNSAFE** | Classic flexbox scroll clipping bug hides mascot/title at 200% zoom and in landscape; hard-coded English organ chips bypass i18n. |
| **Capture** | **MOSTLY SAFE** | Scrollable page; however, toolbar and 3-column sample diagram grid experience text wrapping and vertical bloat under 200% zoom. Missing safe-area insets. |
| **Explore** | **CRITICAL UNSAFE** | Fixed `height: 100dvh` with `overflow: hidden` traps users: in landscape, at 200% zoom, or with the virtual keyboard open, footer controls (Ask, Correct, and Back) are pushed entirely off-screen and cannot be scrolled into view. Actions row lacks `flex-wrap: wrap`. Title truncates with ellipsis. |
| **SavedDiagrams** | **MOSTLY SAFE** | List is cleanly scrollable with `flex-wrap` controls; however, header flexbox lacks wrapping, risking collision between heading and Back button on narrow viewports. Missing safe-area insets. |
| **Correct** | **CRITICAL UNSAFE** | Severe coordinate desynchronization bug: `<canvas>` bitmap is hard-coded to 600×400 with CSS `object-fit: contain`, while pointer hit-testing and dragging assume direct unletterboxed scaling to CSS `getBoundingClientRect()`. Points near edges cannot be selected or dragged. Rigid `min-height: 280px` breaks landscape editing. |
| **Debug** | **SAFE** | Simple test screen with wrapping flex rows and standard document scroll. Minor status grid tightness at 160 px width. |

---

## 2. Screen-by-Screen Layout & Zoom Audit

### 2.1 Start Screen (`frontend/src/screens/Start.tsx`)
- **Structure:** Single full-screen `<button>` (`.gt-start-surface`) listening for `click` events to unlock browser audio/vibration gestures, enclosing creature emblem SVG, title, tagline, 3 organ chips, and "Tap anywhere to begin" action badge.
- **320 px width:**
  - Content width is bounded by padding: `padding: var(--gt-space-xl) var(--gt-space-lg)` (24 px top/bottom, 20 px left/right), leaving 280 px usable width.
  - The triad chips (`.gt-start__triad`) have `flex-wrap: wrap; justify-content: center;`, which wraps onto 2 or 3 lines.
  - `.gt-start__action-badge` has `padding: 16px 28px` (56 px horizontal padding). In Hindi (`शुरू करने के लिए कहीं भी टैप करें`, 34 chars) and Gujarati (`શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો`, 31 chars), the badge width exceeds 290 px, risking horizontal edge overflow within 280 px container width.
- **200% Zoom (effective 160 px CSS width / cramped height):**
  - **Severe Defect (Flexbox Scroll-Clipping):** `.gt-start-surface` sets `display: flex; flex-direction: column; align-items: center; justify-content: center; overflow-y: auto;` while `.gt-start__hero` sets `margin: auto 0;` (`global.css:122-160`). In CSS flexbox, when content overflows a scrollable container that centers its children via `justify-content: center` or `margin: auto`, the top half overflows past the top scroll boundary into negative scroll coordinates. Browsers do not permit scrolling above origin (0, 0). Consequently, the mascot emblem and title are permanently truncated and cannot be scrolled into view.
- **Landscape on Small Phone (height ≤ 360 px):**
  - `@media (max-height: 540px) and (orientation: landscape)` (`global.css:958-978`) reduces mascot size to 56 px and padding to 12 px. However, the vertical stack (mascot 56 px + title 32 px + tagline 24 px + triad 30 px + action badge 52 px + subhint 16 px + gaps) totals ~260 px without translations. With Hindi/Gujarati text, height exceeds 320 px, triggering the same flexbox top-clipping defect.
- **Notch & Safe-Area Insets:**
  - Uses `inset: 0` without `env(safe-area-inset-top)` or `env(safe-area-inset-bottom)`. On devices with notches or home indicator bars, the creature emblem and subhint touch physical screen cutouts.
- **Internationalization Defect:**
  - Lines 53–55 and 64 contain hard-coded English text: `"Nerves · Vibration"`, `"Eyes · Vision AI"`, `"Voice · Synthesizer"`, and `"TalkBack & touch ready"`. None of these strings flow through `t()`.

---

### 2.2 Capture Screen (`frontend/src/screens/Capture.tsx`)
- **Structure:** Vertical document flow inside `<main className="gt-capture">` with `.gt-toolbar` (Language & Rate selectors), brand header, status card, primary/secondary capture buttons, and a 3-column sample diagram grid.
- **320 px width:**
  - Usable width: 320 px - 32 px (`padding: 24px 16px 48px`) = 288 px.
  - In `.gt-toolbar`, `<LanguageSelector />` has 3 buttons (English, हिन्दी, ગુજરાતી) each with `min-width: 48px; padding: 6px 12px;`. Total width is ~235 px.
  - `<RateSelector />` has 3 buttons with full label and multiplier (e.g. "Slow speech 0.8x"). In Hindi ("धीमी गति", "सामान्य गति", "तेज़ गति"), the 3 buttons require ~255 px.
  - Because `.gt-toolbar` uses `display: flex; flex-wrap: wrap; justify-content: space-between;`, the selectors wrap cleanly onto two stacked rows.
  - The sample diagrams grid (`.gt-capture__samples-grid`) uses `grid-template-columns: repeat(3, 1fr); gap: 6px;` under 380 px width (`global.css:1004-1018`). Each card gets ~92 px width. At standard zoom, two-line text fits tightly.
- **200% Zoom:**
  - Document flows naturally with root page scroll, preventing clipping.
  - However, within the 92 px sample buttons, doubling font size causes multi-line text wrapping (3 to 4 lines) with the CSS icon, expanding card height to ~110 px.
- **Landscape on Small Phone:**
  - Document scrolls vertically as expected.
- **Notch & Safe-Area Insets:**
  - `.gt-capture` lacks `padding-top: env(safe-area-inset-top)` and `padding-bottom: env(safe-area-inset-bottom)`. The top toolbar can sit directly behind a landscape camera punch-hole or portrait notch.

---

### 2.3 Explore Screen (`frontend/src/screens/Explore.tsx`)
- **Structure:**
  - Header: Toolbar (LanguageSelector, RateSelector), Diagram title + badge.
  - Status card: Spoken status text.
  - Canvas container: 100% width, flexible height, housing `<canvas className="gt-explore__canvas">`.
  - Debug offset display.
  - Conditional Ask text-fallback form (input + submit button).
  - Footer: Action buttons (Ask, optional Correct, Back).
- **CSS Constraints:**
  - `.gt-explore` specifies:
    ```css
    display: flex;
    flex-direction: column;
    height: 100dvh;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gt-space-sm) var(--gt-space-md) var(--gt-space-md);
    box-sizing: border-box;
    overflow: hidden; /* <-- CRITICAL DEFECT */
    ```
- **Total Minimum Vertical Budget Required:**
  1. Header (toolbar wrapped onto 2 rows on mobile + title row): ~120 px
  2. Status card: 40 px
  3. Canvas container (`min-height: 200px`): 200 px
  4. Debug text: 20 px
  5. Text fallback form (when active): 56 px
  6. Footer actions: 56 px
  7. Container padding: 28 px
  **Total minimum height required: 520 px** (464 px without text fallback).
- **320 px width:**
  - In portrait (height ~568–640 px), the screen fits, but leaves the canvas with only ~200–240 px vertical space.
  - Diagram title (`.gt-explore__title`) has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`. Long or translated titles truncate prematurely.
- **200% Zoom & Landscape Phone (CRITICAL TRAP):**
  - At 200% zoom, the effective viewport height is 300–400 px.
  - In landscape on a small phone (e.g. 320–360 px height), the viewport is strictly smaller than the required 520 px.
  - **Result:** Because `overflow: hidden` is enforced on `.gt-explore`, everything below the canvas—specifically the Ask text fallback form, the Ask button, the Correct button, and the **Back button**—is completely clipped outside the viewport. The user CANNOT scroll down, CANNOT see the controls, CANNOT submit an ask, and CANNOT touch the Back button to leave.
- **On-Screen Keyboard Open:**
  - When a user taps into the text fallback input (`#gt-ask-input`), the mobile virtual keyboard consumes 40%–50% of the screen height (leaving ~260 px viewport height).
  - The input and send buttons are pushed off-screen. Because `overflow: hidden` prevents scrolling, the user cannot see what they are typing.
- **Footer Actions Horizontal Overflow:**
  - `.gt-explore__actions` (`global.css:738-742`) has `display: flex; gap: var(--gt-space-sm); width: 100%;` without `flex-wrap: wrap;`.
  - When `onCorrect` is present, there are 3 buttons: Ask, Correct, Back.
  - With `min-width: 48px`, `padding: 12px 18px`, borders and text, 3 buttons require minimum 260 px. At 200% zoom (160 px width), buttons overflow horizontally and are clipped by the screen boundary.
  - Furthermore, `.gt-explore__ask` and `.gt-explore__back` have `flex: 1`, but `.gt-explore__correct` has no entry in `global.css`, causing uneven button sizing.

---

### 2.4 SavedDiagrams Screen (`frontend/src/screens/SavedDiagrams.tsx`)
- **Structure:** `<main className="gt-saved">` with header (`h1` + Back button), status row, and diagram card list (`.gt-saved__list`).
- **320 px width:**
  - Usable width: 288 px.
  - Header (`.gt-saved__header` in `saved.css:20-25`) has `display: flex; justify-content: space-between; align-items: center; gap: 12px;` without `flex-wrap: wrap;`.
  - The heading has `font-size: 1.75rem` (`saved.heading`: "Saved diagrams" / "सहेजे गए आरेख" / "સેવ કરેલ આકૃતિઓ").
  - The Back button (`saved.back`: "Back to Capture" / "कैप्चर पर वापस" / "Capture પર પાછા") is 14–16 characters long.
  - Combined width of heading and button exceeds 290 px at 320 px width, causing text squashing or slight overflow.
- **200% Zoom & Landscape:**
  - The card list and controls (`.gt-saved__controls`) use `display: flex; flex-wrap: wrap; gap: 8px;`, allowing buttons (Open, Pin, Delete, Confirm Delete, Cancel) to wrap onto multiple lines cleanly.
  - Page scrolls normally (`min-height: 100dvh`).
- **Notch & Safe-Area Insets:**
  - Missing safe-area padding top and bottom.

---

### 2.5 Correct Screen (`frontend/src/screens/Correct.tsx`)
- **Structure:** Teacher correction mode containing header (title + Cancel), status card, overlay canvas container, label edit panel, and bottom toolbar (Undo, Redo, Delete, Save).
- **CRITICAL DEFECT: Canvas Coordinate & Hit-Test Desynchronization:**
  - In `Correct.tsx` line 419: `<canvas ref={canvasRef} className="gt-correct__canvas" width={600} height={400} ... />`
  - In `correct.css` lines 69–75:
    ```css
    .gt-correct__canvas {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain; /* <-- Triggers letterboxing */
      cursor: crosshair;
    }
    ```
  - In `renderCanvas()` (`Correct.tsx:126`): Points and lines are drawn using `width = canvas.width` (600) and `height = canvas.height` (400).
  - In `handlePointerDown()` (`Correct.tsx:233-238`):
    `rect = canvas.getBoundingClientRect();`
    `px = e.clientX - rect.left; py = e.clientY - rect.top;`
    `hitTestCorrect(scene, px, py, rect.width, rect.height);`
  - In `hitTestPoint()` (`flow/correct.ts:38-39`):
    `sx = pt.x * canvasWidth; sy = pt.y * canvasHeight;` (where `canvasWidth = rect.width` and `canvasHeight = rect.height`).
  - **The Mathematical Clash:**
    The canvas internal bitmap aspect ratio is 600:400 = 1.5. On a 320 px phone in portrait, `.gt-correct__canvas-container` is ~296 px wide by 280 px tall (aspect 1.05). `object-fit: contain` scales the 600×400 canvas to 296×197 px, creating letterbox black margins of ~41.5 px on top and bottom.
    The points are visually rendered inside that 296×197 px box.
    However, `hitTestCorrect` calculates point coordinates assuming the scene fills the entire 296×280 px box without letterboxing!
    - Example: For a point at normalized coordinates `(0.5, 0.1)`:
      - Visual screen position: `41.5 px (margin) + 0.1 * 197 px = 61.2 px` from canvas top.
      - Hit-test expected position: `0.1 * 280 px = 28 px` from canvas top.
      - Discrepancy: `61.2 - 28 = 33.2 px`.
      - Since `HIT_POINT_RADIUS_PX` is 24 px, this point CANNOT BE SELECTED OR TAPPED.
    - When dragging a point (`pointerToNorm` in `Correct.tsx:264`):
      `pointerToNorm` divides `px` and `py` by `rect.width` and `rect.height`. The point jumps away from the teacher's finger under drag.
- **Landscape Phone (Canvas `min-height: 280px`):**
  - In `correct.css:57-58`: `min-height: 280px; max-height: 55vh;`.
  - In CSS, `min-height` overrides `max-height`. On a 320 px landscape screen, the canvas container forces a minimum height of 280 px. The entire screen becomes >480 px tall, pushing the label edit input and Save/Undo/Delete toolbar far below the fold.
- **Virtual Keyboard Open:**
  - Tapping into the label text input opens the virtual keyboard, reducing screen height to ~250 px. With canvas fixed at 280 px, the toolbar is obscured.

---

### 2.6 Debug Screen (`frontend/src/screens/Debug.tsx`)
- **Structure:** Standalone `#/debug` diagnostics page with driver status definitions and flex rows of driver test buttons.
- **Audit Findings:**
  - All button groups (`.gt-debug__row`) use `display: flex; flex-wrap: wrap; gap: 8px;`.
  - Page uses standard browser scrolling.
  - Safe at 320 px and 200% zoom.
  - Minor: `.gt-debug__status` uses `grid-template-columns: max-content 1fr; gap: 4px 16px;`. At 160 px effective width, long driver status strings may wrap tightly.

---

## 3. Translation Length & Typography Analysis

### 3.1 String Length Comparison Table
Comparing English (`en`), Hindi (`hi`), and Gujarati (`gu`) for all UI button and heading keys:

| Key | Context / Element | English (`en`) | Hindi (`hi`) | Gujarati (`gu`) | Length Ratio (Max / EN) | Risk Level |
|---|---|---|---|---|---|---|
| `app.name` | Brand Title | Ghost Touch (11) | घोस्ट टच (8) | ગોસ્ટ ટચ (8) | 1.0x | Low |
| `app.tagline` | Tagline | Feel diagrams you cannot see. (29) | वे चित्र महसूस करें जो आप देख नहीं सकते। (40) | જે આકૃતિઓ તમે જોઈ શકતા નથી તેને સ્પર્શથી અનુભવો. (47) | **1.62x** | Medium |
| `start.tapToBegin` | Start Action Pill | Tap anywhere to begin (21) | शुरू करने के लिए कहीं भी टैप करें (34) | શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો (31) | **1.62x** | **High** |
| `start.begin` | Start Button | Begin (5) | शुरू करें (9) | શરૂ કરો (7) | **1.80x** | Low |
| `capture.takePhoto` | Primary Action | Take photo (10) | फोटो लें (8) | ફોટો લો (7) | 1.0x | Low |
| `capture.chooseImage` | Secondary Action | Choose image (12) | छवि चुनें (9) | ઇમેજ પસંદ કરો (13) | 1.08x | Low |
| `capture.savedDiagrams` | Secondary Action | Saved diagrams (14) | सहेजे गए आरेख (13) | સેવ કરેલ આકૃતિઓ (16) | 1.14x | Low |
| `capture.samples` | Grid Heading | Sample diagrams (15) | नमूना चित्र (11) | નમૂના આકૃતિઓ (12) | 1.0x | Low |
| `capture.sampleTriangle` | Sample Card 1 | Sample: triangle (16) | नमूना: त्रिभुज (14) | નમૂનો: ત્રિકોણ (14) | 1.0x | Medium |
| `capture.sampleSine` | Sample Card 2 | Sample: sine graph (18) | नमूना: साइन ग्राफ़ (18) | નમૂનો: સાઇન આલેખ (16) | 1.0x | Medium |
| `capture.sampleBarchart` | Sample Card 3 | Sample: bar chart (17) | नमूना: बार चार्ट (16) | નમૂનો: સ્તંભ આલેખ (17) | 1.0x | Medium |
| `rate.slow` | Rate Selector | Slow speech (11) | धीमी गति (8) | ધીમી વાણી (9) | 1.0x | Low |
| `rate.normal` | Rate Selector | Normal speech (13) | सामान्य गति (11) | સામાન્ય વાણી (12) | 1.0x | Low |
| `rate.fast` | Rate Selector | Fast speech (11) | तेज़ गति (7) | ઝડપી વાણી (9) | 1.0x | Low |
| `ask.button` | Explore Footer | Ask (3) | पूछें (5) | પૂછો (4) | 1.67x | Low |
| `explore.correct` | Explore Footer | Correct (7) | सुधारें (7) | સુધારો (6) | 1.0x | Low |
| `common.back` | Footer / Header | Back (4) | वापस (5) | પાછા (4) | 1.25x | Low |
| `ask.placeholder` | Text Ask Input | Type a question about the diagram… (34) | चित्र के बारे में प्रश्न पूछें… (31) | આકૃતિ વિશે પ્રશ્ન પૂછો… (23) | 1.0x | Low |
| `ask.send` | Text Ask Submit | Send (4) | भेजें (5) | મોકલો (5) | 1.25x | Low |
| `saved.heading` | Saved Heading | Saved diagrams (14) | सहेजे गए आरेख (13) | સેવ કરેલ આકૃતિઓ (16) | 1.14x | Medium |
| `saved.back` | Saved Header | Back to Capture (15) | कैप्चर पर वापस (14) | Capture પર પાછા (16) | 1.07x | Medium |
| `saved.open` | Saved Card Action | Open (4) | खोलें (5) | ખોલો (4) | 1.25x | Low |
| `saved.pin` | Saved Card Action | Pin (3) | पिन करें (8) | પિન કરો (7) | **2.67x** | Medium |
| `saved.unpin` | Saved Card Action | Unpin (5) | पिन हटाएं (9) | પિન દૂર કરો (11) | **2.20x** | Medium |
| `saved.delete` | Saved Card Action | Delete (6) | हटाएं (5) | ભૂંસો (5) | 1.0x | Low |
| `saved.confirmDelete` | Saved Card Action | Confirm delete (14) | हटाने की पुष्टि करें (20) | ભૂંસવાની ખાતરી કરો (18) | **1.43x** | **High** |
| `saved.cancel` | Saved Card Action | Cancel (6) | रद्द करें (8) | રદ કરો (6) | 1.33x | Low |
| `correct.title` | Correct Heading | Teacher Correction (18) | शिक्षक सुधार (12) | શિક્ષક સુધારણા (14) | 1.0x | Low |
| `correct.save` | Correct Action | Save (4) | सहेजें (6) | સાચવો (5) | 1.50x | Low |
| `correct.undo` | Correct Action | Undo (4) | पूर्ववत करें (11) | પૂર્વવત્ કરો (11) | **2.75x** | **High** |
| `correct.redo` | Correct Action | Redo (4) | फिर से करें (11) | ફરીથી કરો (8) | **2.75x** | **High** |
| `correct.delete` | Correct Action | Delete (6) | हटाएं (5) | કાઢી નાખો (9) | **1.50x** | Low |
| `correct.applyLabel` | Correct Action | Apply label (11) | लेबल लागू करें (14) | લેબલ લાગુ કરો (13) | 1.27x | Low |
| `correct.validating` | Correct Busy Button | Validating diagram… (19) | आरेख का सत्यापन किया जा रहा है… (32) | આકૃતિની ચકાસણી થઈ રહી છે… (25) | **1.68x** | Medium |

### 3.2 Glyph Height and Line Box Dynamics
1. **Vertical Bounds Expansion:** Both Devanagari and Gujarati scripts include upper vowels/diacritics (*shirorekha* modifiers such as ी, ें, ৈ, ો) and lower sub-base ligatures/halants (ु, ू, ृ, ्). These require roughly **25%–35% more vertical line box height** than Latin typography of equivalent font size.
2. **Clipping from Tight Line Heights:**
   - In `tokens.css:84`, `--gt-line-height-tight: 1.2`.
   - In `global.css:888, 896`, `.gt-lang-selector__native` and `.gt-rate-selector__label` set `line-height: 1.2`.
   - In `.gt-capture__sample-btn` (`global.css:512`), `line-height: 1.25`.
   - A `line-height` of 1.2 to 1.25 clips the top matras and descending conjuncts unless overflow is visible.
3. **Font Fallback Vulnerability:**
   - Atkinson Hyperlegible (the chosen Lab UI font) contains Latin, Greek, and Cyrillic glyphs, but **zero Devanagari or Gujarati glyphs**.
   - Browsers fall back to system fonts (e.g., *Noto Sans Devanagari*, *Mangal*, *Nirmala UI*). System Indian language fonts feature larger intrinsic font metrics (taller ascender/descender ratios). When rendered inside fixed or min-height buttons alongside Latin text, vertical misalignment and unexpected box expansion occur.

---

## 4. CSS Properties Audit

### 4.1 Usage Audit Table
| Property / Value | File & Line | Element | Layout & Accessibility Impact |
|---|---|---|---|
| `position: fixed` | `global.css:123` | `.gt-start-surface` | Fullscreen modal overlay (`inset: 0`). Ignores `env(safe-area-inset-*)`. Combines with flex centering to cause top-clipping. |
| `min-height: 100dvh` | `global.css:307` | `.gt-capture` | Modern dynamic viewport height. Correctly handles Android URL bar retraction. Needs `100vh` fallback. |
| `height: 100dvh` | `global.css:582` | `.gt-explore` | **CRITICAL DEFECT:** Rigid viewport lock. Prevents page scroll when footer chrome overflows. |
| `min-height: 100dvh` | `saved.css:16` | `.gt-saved` | Clean dynamic viewport sizing; normal scrolling preserved. Needs `100vh` fallback. |
| `min-height: 100vh; min-height: 100dvh` | `correct.css:11-12` | `.gt-correct` | Good practice: `100vh` fallback precedes `100dvh`. Normal scrolling preserved. |
| `overflow: hidden` | `global.css:35` | `html, body, #root` (`overflow-x`) | Prevents spurious horizontal page shaking; safe. |
| `overflow: hidden` | `global.css:588` | `.gt-explore` | **CRITICAL DEFECT:** Traps keyboard, landscape, and zoomed users by clipping the entire footer. |
| `overflow: hidden` | `global.css:607` | `.gt-explore__title` | Truncates diagram title with ellipsis. Blocks low-vision users from reading full name. |
| `overflow: hidden` | `global.css:649` | `.gt-explore__canvas-container` | Clips canvas to border radius; safe. |
| `overflow: hidden` | `correct.css:65` | `.gt-correct__canvas-container` | Clips canvas to container boundary; safe. |
| `touch-action: none` | `global.css:664` | `.gt-explore__canvas` | Essential: isolates touch gestures for pure haptic engine without browser panning interference. |
| `touch-action: none` | `correct.css:66` | `.gt-correct__canvas-container` | Prevents container scroll during point dragging. |
| `touch-action: manipulation` | `correct.css:144` | `.gt-correct__btn` | Eliminates 300 ms double-tap zoom delay; safe. |

### 4.2 Android Address Bar & TalkBack Exploration Interactions
1. **Android Dynamic Address Bar:**
   - Chrome on Android shrinks/expands the address bar when scrolling down/up.
   - On `Explore`, because `height: 100dvh` and `overflow: hidden` are used, no page scroll can ever occur. The browser keeps the address bar fully expanded, permanently locking the screen to the smaller viewport area.
2. **TalkBack Reachability:**
   - When TalkBack is enabled, users navigate linearly via right-swipes (`AccessibilityNodeInfo`).
   - If `.gt-explore` has `overflow: hidden`, TalkBack will still focus elements logically located below the viewport fold (e.g. Back button or fallback input), but the browser will not visually scroll them into view. Sighted assistants, dual-modality users, or low-vision users cannot see what TalkBack is focusing.

---

## 5. Explore Canvas Sizing, Frame, Aspect Ratio, and Hit-Testing

### 5.1 Current Canvas Pipeline Analysis
In `Explore.tsx`:
```typescript
const updateDimensions = (): void => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const view = makeViewport(width, height);
  viewportRef.current = view;
  renderStaticScene(view, dpr);
  draw(view, pendingCursor.current);
};
```
Pointer coordinates in `getCanvasCoords`:
```typescript
const getCanvasCoords = (e: PointerEvent<HTMLCanvasElement>): ScreenPoint => {
  const canvas = canvasRef.current;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
};
```

### 5.2 Lab Spec Frame Addition Assessment
The Lab specification (`docs/briefs/lab-spec.md` line 17) calls for a "specimen table" frame with a stitched border and decorative rivets around the Explore canvas.

1. **Where Canvas Reads Its Sizing:**
   - Canvas reads directly from `canvas.getBoundingClientRect()`, which is its own layout box in CSS pixels.
   - It does NOT read from `window` or its parent container directly.
2. **Impact of Adding Borders or Padding:**
   - **Borders/Padding on `.gt-explore__canvas` directly:** **DANGEROUS.** In `box-sizing: border-box`, `canvas.getBoundingClientRect()` includes border and padding. However, HTML5 Canvas 2D context drawing origin `(0, 0)` begins inside the padding, while `e.clientX - rect.left` measures from the outer border edge. Applying a border to the canvas itself introduces a spatial offset equal to `border-width`, corrupting hit-testing.
   - **Borders/Padding on `.gt-explore__canvas-container`:** **SAFE.** If borders, padding, and decorative stitched seams are placed on `.gt-explore__canvas-container`, the inner `<canvas>` element cleanly occupies the container's content box. `canvas.getBoundingClientRect()` continues to report the canvas's exact inner bounds, and `e.clientX - rect.left` remains perfectly synchronized with `renderStaticScene` and `hitTest`.
3. **Decorative Rivets and Overlays:**
   - If rivets or stitched border lines are implemented using absolute child `<div>`s or `::before`/`::after` pseudo-elements over the canvas container, they **MUST set `pointer-events: none;`**.
   - Otherwise, a user touching a rivet will have their touch event intercepted by the rivet element instead of delivering pointer capture to `<canvas>`, breaking relative touch exploration.
4. **Letterboxing Resilience:**
   - `makeViewport(width, height)` computes `scale = Math.min(width, height)` and centers the unit square via `offsetX = (width - scale) / 2` and `offsetY = (height - scale) / 2`.
   - When a frame changes container dimensions, `ResizeObserver` triggers `updateDimensions()`, recomputing letterbox margins. Because both rendering (`toScreen`) and hit-testing (`toNorm` / screen distance) use the exact same `view` object, letterboxing geometry remains robust.

---

## 6. Concrete Bugs and Risks Ordered by Severity

| Severity | ID | File : Line | Problem | Concrete Fix |
|---|---|---|---|---|
| **Critical** | BUG-01 | `global.css:582, 588` | `.gt-explore` has `height: 100dvh; overflow: hidden;`. At 200% zoom, in landscape, or with virtual keyboard open, footer controls (Ask, Correct, and Back) are pushed off-screen and are completely unreachable. | Replace `height: 100dvh; overflow: hidden;` with `min-height: 100dvh; overflow-y: auto;` or give the non-canvas chrome a scrollable container while keeping `touch-action: none` on `<canvas>`. |
| **Critical** | BUG-02 | `Correct.tsx:126, 233`, `correct.css:69-75` | `<canvas>` bitmap is hard-coded to 600×400 with CSS `object-fit: contain`. Hit-testing in `hitTestCorrect` calculates positions assuming direct unletterboxed scaling to `rect.width` and `rect.height`. Points cannot be tapped or dragged accurately near edges. | Remove `object-fit: contain`. Dynamically size canvas bitmap to `rect.width * dpr` and `rect.height * dpr` using `ResizeObserver`, and apply letterboxed `makeViewport` to both drawing and hit testing. |
| **High** | BUG-03 | `global.css:122-160` | `.gt-start-surface` uses `display: flex; align-items: center; justify-content: center; overflow-y: auto;` with `.gt-start__hero` set to `margin: auto 0;`. Flexbox scroll clipping bug renders mascot and title permanently unscrollable when zoomed. | Remove `justify-content: center;` and `margin: auto 0;`. Use `margin: 0 auto; min-height: 100%;` and `align-items: center;` to ensure overflow scrolls down from top origin (0, 0). |
| **High** | BUG-04 | `global.css:738-742` | `.gt-explore__actions` has `display: flex; gap: var(--gt-space-sm);` without `flex-wrap: wrap;`. In 160 px effective zoom width, Ask, Correct, and Back buttons collide and overflow horizontally. | Add `flex-wrap: wrap;` to `.gt-explore__actions`. Allow buttons to wrap into a 2-row layout. |
| **High** | BUG-05 | `saved.css:20-25` | `.gt-saved__header` has `display: flex; justify-content: space-between;` without `flex-wrap: wrap;`. Heading (`1.75rem`) and Back button (`15` chars) collide and overflow at 320 px width. | Add `flex-wrap: wrap; gap: var(--gt-space-sm);` to `.gt-saved__header`. |
| **Medium** | BUG-06 | `index.html:5`, all CSS | `viewport-fit=cover` is declared, but CSS lacks safe-area insets (`env(safe-area-inset-*)`). Hardware notches, dynamic islands, and home indicators obscure controls. | Add `padding-top: max(var(--gt-space-md), env(safe-area-inset-top));` and `padding-bottom: max(var(--gt-space-md), env(safe-area-inset-bottom));` to all main screen containers. |
| **Medium** | BUG-07 | `correct.css:57-58` | `.gt-correct__canvas-container` has rigid `min-height: 280px; max-height: 55vh;`. In landscape, `min-height` forces 280 px height, breaking the editing layout. | Use `min-height: clamp(160px, 40vh, 280px);` and add `@media (orientation: landscape) and (max-height: 540px) { min-height: 160px; }`. |
| **Medium** | BUG-08 | `global.css:599-610` | `.gt-explore__title` has `white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`. Long or translated diagram titles truncate aggressively. | Allow 2 lines of text (`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal;`). |
| **Medium** | BUG-09 | `Start.tsx:53-55, 64` | Organ badges (`Nerves · Vibration`, etc.) and subhint (`TalkBack & touch ready`) are hardcoded in English, bypassing `t()`. | Move all chip strings and subhint into `frontend/src/i18n/index.ts` with English, Hindi, and Gujarati translations. |
| **Low** | BUG-10 | `global.css:738-780` | `.gt-explore__correct` class is omitted from `global.css`, lacking `flex: 1`, resulting in asymmetrical button sizing in Explore footer. | Add `.gt-explore__correct` to `global.css` with `flex: 1; min-height: 52px;`. |
| **Low** | BUG-11 | `global.css:307, 582`, `saved.css:16` | `100dvh` is used without preceding `100vh` fallback in `global.css` and `saved.css`. | Prepend `min-height: 100vh;` before `min-height: 100dvh;`. |
| **Low** | BUG-12 | `tokens.css:84`, `global.css:888` | `line-height: 1.2` is too tight for Devanagari and Gujarati diacritics, risking clipping of matras and halants. | Increase minimum line-height for typography tokens to at least `1.35`–`1.4`. |

---

## 7. Recommendations for Lab Redesign Lanes

1. **For Lane `foundation` (`tokens.css`, `global.css`, `lab.css`):**
   - Provide safe-area utility variables in `tokens.css`:
     `--gt-safe-top: env(safe-area-inset-top, 0px);`
     `--gt-safe-bottom: env(safe-area-inset-bottom, 0px);`
   - Ensure the stitched frame class for the Explore canvas container sets `box-sizing: border-box`, applies borders and padding exclusively to `.gt-explore__canvas-container`, and enforces `pointer-events: none` on any decorative pseudo-elements or rivet icons.
   - Adjust `--gt-line-height-tight` to `1.35` to accommodate Indian script ascenders/descenders.
2. **For Lane `i18n` (`i18n/index.ts`, `LabSettings.tsx`):**
   - Consolidating language and rate selectors into a single "Lab Settings" sheet button (as specified in `lab-spec.md` line 15) eliminates the 2-row toolbar crowding on Capture and Explore, saving ~60 px of vertical height.
   - Add the missing Start organ tile strings to `i18n/index.ts`.
3. **For Lane `screens` (subsequent implementation):**
   - Replace rigid `height: 100dvh; overflow: hidden;` on Explore with a layout that allows the chrome to scroll or dynamically shrinks the canvas when viewport height drops below 500 px.
   - Port the robust letterboxed `Viewport` pattern from `Explore.tsx` to `Correct.tsx` to fix the canvas touch coordinate misalignment.
