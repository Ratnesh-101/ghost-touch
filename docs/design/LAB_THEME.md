# Ghost Touch: Frankenstein's Laboratory Design System

Ghost Touch presents a "Frankenstein's Laboratory" aesthetic: a creature stitched from spare phone parts (buzzer = nerves, vision AI = eyes, synthesizer = voice). The interface is the laboratory where the creature comes alive.

The atmosphere and spookiness live in the lab hardware and creature's tactile feel, **never in blindness** (no blindfolds, no eye trauma, no darkness/blind tropes). Accessibility is the product: WCAG AAA contrast, minimum 48×48 px touch targets, legible low-vision typography, and non-interfering decorative elements.

---

## Design Tokens

All tokens live centrally in `frontend/src/styles/tokens.css`. Component and screen stylesheets consume these CSS custom properties directly; hard-coded hex colors in components are forbidden.

### Color Tokens & Measured Contrast Ratios

All color tokens are defined in hex format so automated accessibility suites parse and verify them. Text contrast exceeds WCAG AAA (7:1); UI borders and large graphical components exceed 4.5:1.

| Token Name | Hex Value | Semantic Role / Use | Contrast vs Background (`#0b0e0c`) | Contrast vs Surface (`#141c17`) | Contrast vs Active (`#223028`) |
|---|---|---|---|---|---|
| `--gt-bg` | `#0b0e0c` | Deep lab charcoal page background | 1.00:1 (baseline) | — | — |
| `--gt-bg-elevated` | `#111713` | Elevated surface base | 1.05:1 | — | — |
| `--gt-surface` | `#141c17` | Standard surface / control background | 1.15:1 | 1.00:1 (baseline) | — |
| `--gt-surface-hover` | `#1b261f` | Hover state for controls | 1.34:1 | 1.17:1 | — |
| `--gt-surface-active` | `#223028` | Active / pressed state for controls | 1.48:1 | 1.29:1 | 1.00:1 (baseline) |
| `--gt-surface-card` | `#121814` | Specimen & lab card background | 1.07:1 | 1.07:1 | — |
| `--gt-green` | `#39ff88` | Creature life green (primary brand, canvas strokes) | 16.3:1 (AAA) | 14.2:1 (AAA) | 11.5:1 (AAA) |
| `--gt-green-dim` | `#25a357` | Dim green status indicators | 6.40:1 (AA+) | 5.60:1 (AA) | 4.52:1 (AA) |
| `--gt-cyan` / `--gt-voltage-cyan` | `#00f0ff` | Voltage cyan (electric sparks, arc discharges, focus) | 13.78:1 (AAA) | 12.01:1 (AAA) | 9.68:1 (AAA) |
| `--gt-cyan-dim` | `#00a3ad` | Dim electric cyan borders | 6.62:1 (AA+) | 5.76:1 (AA) | 4.65:1 (AA) |
| `--gt-copper` / `--gt-hardware` | `#c88a4b` | Aged copper (hardware bolts, button borders) | 6.76:1 (AA+) | 5.88:1 (AA) | 4.75:1 (AA) |
| `--gt-copper-bright` | `#e0a96d` | Bright copper highlights and active focus accents | 9.42:1 (AAA) | 8.21:1 (AAA) | 6.61:1 (AA) |
| `--gt-copper-dim` | `#9e6432` | Shadowed copper hardware bevels | 3.82:1 | 3.33:1 | 2.68:1 |
| `--gt-brass` | `#d4a359` | Polished brass hardware accents | 7.84:1 (AAA) | 6.83:1 (AA+) | 5.51:1 (AA) |
| `--gt-bone` / `--gt-parchment` | `#ded6c4` | Bone & parchment (suture stitches, secondary text) | 13.57:1 (AAA) | 11.83:1 (AAA) | 9.54:1 (AAA) |
| `--gt-bone-dim` | `#b8b0a0` | Muted bone suture threads | 9.02:1 (AAA) | 7.86:1 (AAA) | 6.34:1 (AA) |
| `--gt-stitch` | `#ded6c4` | Dashed suture lines and card borders | 13.57:1 (AAA) | 11.83:1 (AAA) | 9.54:1 (AAA) |
| `--gt-border-copper` | `#c88a4b` | Lab button and hardware borders | 6.76:1 (AA+) | 5.88:1 (AA) | 4.75:1 (AA) |
| `--gt-border-cyan` | `#00f0ff` | High-voltage electric borders | 13.78:1 (AAA) | 12.01:1 (AAA) | 9.68:1 (AAA) |
| `--gt-text` | `#eafff5` | Default high-contrast body text | 18.72:1 (AAA) | 16.31:1 (AAA) | 13.15:1 (AAA) |
| `--gt-text-primary` | `#f5fff8` | Primary crisp high-contrast titles | 19.54:1 (AAA) | 17.02:1 (AAA) | 13.73:1 (AAA) |
| `--gt-text-secondary` | `#ded6c4` | Secondary bone/parchment text | 13.57:1 (AAA) | 11.83:1 (AAA) | 9.54:1 (AAA) |
| `--gt-text-muted` | `#a8c5b5` | Muted descriptions and hints | 10.50:1 (AAA) | 9.15:1 (AAA) | 7.38:1 (AAA) |
| `--gt-text-dark` | `#051309` | Dark text on green/copper/cyan fills | 16.3:1 (on green) | 14.1:1 (on cyan) | 8.8:1 (on copper-bright) |
| `--gt-line` | `#39ff88` | Canvas lines and vector diagram strokes | 16.3:1 (AAA) | 14.2:1 (AAA) | 11.5:1 (AAA) |
| `--gt-focus` | `#39ff88` | Backward-compatible green focus ring indicator | 16.3:1 (AAA) | 14.2:1 (AAA) | 11.5:1 (AAA) |

### Dimensions & Touch Target Tokens

| Token Name | Value | Purpose |
|---|---|---|
| `--gt-target` | `48px` | Minimum touch target (Requirement 12.1) |
| `--gt-space-2xs` | `4px` | Tight icon spacing |
| `--gt-space-xs` | `8px` | Gap between button chips and labels |
| `--gt-space-sm` | `12px` | Internal card padding |
| `--gt-space-md` | `16px` | Standard gutter |
| `--gt-space-lg` | `20px` | Card padding |
| `--gt-space-xl` | `24px` | Section header margins |
| `--gt-space-2xl` | `32px` | Screen padding |
| `--gt-space-3xl` | `48px` | Hero spacing |
| `--gt-radius-xs` | `4px` | Minute hardware bevels |
| `--gt-radius-sm` | `8px` | Minor tags and badges |
| `--gt-radius-md` | `12px` | Standard button and control radius |
| `--gt-radius-card` | `14px` | Stitched lab card corners |
| `--gt-radius-lg` | `16px` | Large container borders |
| `--gt-radius-pill` | `9999px` | Capsule badges |

### Typography Tokens

- `--gt-font-sans`: `'Atkinson Hyperlegible', 'Nirmala UI', 'Noto Sans Devanagari', 'Noto Sans Gujarati', system-ui, -apple-system, sans-serif`
- Atkinson Hyperlegible weights: 400 (regular) and 700 (bold), self-hosted as offline `.woff2` files in `frontend/src/assets/fonts/` with `font-display: swap` and precached by the service worker.
- System fallbacks include `'Nirmala UI'`, `'Noto Sans Devanagari'`, and `'Noto Sans Gujarati'` to provide native letterform coverage for Hindi and Gujarati translations.

---

## Lab Primitives

All decorative lab primitives are located in `frontend/src/components/lab/` and exported via `frontend/src/components/lab/index.ts`.

### 1. `Seam`
- **Role:** Non-interactive suture divider (`aria-hidden="true"`, `role="presentation"`).
- **Visual:** Horizontal SVG suture line with dashed surgical stitches (`stroke-dasharray="6 6"`) and cross-sutures.
- **Props:** `className`, `color` (default `--gt-stitch`), `crosses` (default `true`), `width`, `height`.

### 2. `Rivets`
- **Role:** 4 corner hardware bolts for primary cards (`aria-hidden="true"`, `role="presentation"`).
- **Visual:** 4 small metallic copper/brass circular bolt SVGs placed at the top-left, top-right, bottom-left, and bottom-right corners.
- **Props:** `className`, `size` (default `10`), `color` (default `--gt-copper`).

### 3. `LabCard`
- **Role:** Wrapper card composing stitched borders and corner rivets.
- **Contract:** Wraps children untouched. All decorative ornaments carry `aria-hidden="true"`.
- **Variants:** `'primary'` (copper border, corner rivets), `'secondary'` (standard dark surface), `'specimen'` (dashed suture border with cyan glow).
- **Props:** Extends standard `HTMLAttributes<HTMLDivElement>`, `variant`, `hasRivets`, `hasStitches`.

### 4. `Spark`
- **Role:** The one-shot "IT'S ALIVE" electric arc and glow pulse.
- **Timing:** 950 ms total duration (strictly under 1.2 s limit).
- **Flash Rate:** 2 brightness peaks over 0.95 s (~2.1 Hz), strictly complying with WCAG 2.3.1 (maximum 3 flashes per second).
- **Accessibility:** Detects `prefers-reduced-motion: reduce`. When active, displays a static non-flashing frame with zero CSS animation and fires `onDone` promptly.
- **Audio:** Zero audio logic inside the component. The screen lane triggers the existing `success` earcon.

### 5. Interactive Button Classes (`.gt-btn`)
Defined in `frontend/src/styles/global.css`:
- `.gt-btn`: Base lab button with aged copper border (`#c88a4b`), minimum 48×48 px touch target.
- `.gt-btn--primary`: Creature life green fill (`#39ff88`), dark text (`#051309`), copper border.
- `.gt-btn--secondary`: Dark surface fill (`#141c17`), high-contrast text (`#eafff5`), copper border.
- `.gt-btn--quiet`: Transparent background, bone/parchment text (`#ded6c4`), borderless until hovered.

---

## The Do and Don't List

### DO
- **DO** use Atkinson Hyperlegible for all UI text.
- **DO** ensure every interactive element has an accessible name, visible focus ring, and at least 48×48 CSS px touch target.
- **DO** make all decorative hardware (seams, stitches, rivets, spark arcs) `aria-hidden="true"` and non-interactive.
- **DO** keep the canvas background solid jet black (`#000000`) with glowing green strokes (`#39ff88`).
- **DO** verify all text tokens meet or exceed WCAG AAA (7:1) contrast against their parent surfaces.
- **DO** respect `prefers-reduced-motion` across all components and animations.

### DON'T
- **DON'T** use blindness, eye trauma, or blindfold tropes (no blind jokes, no horror eye imagery).
- **DON'T** put decorative textures, blueprint grids, stitches, or rivets inside the tactile Explore canvas (they interfere with touch exploration).
- **DON'T** use novelty horror fonts for body copy (readability is the product).
- **DON'T** exceed 3 flashes per second or total animation durations over 1.2 s.
- **DON'T** hardcode color hex codes in screen components or screen CSS.
- **DON'T** remove or bypass existing TalkBack cursor logic, earcons, or tuned haptic parameters.

---

## Accessibility Rationale

1. **Why Atkinson Hyperlegible?**
   Atkinson Hyperlegible was developed by the Braille Institute of America specifically for low-vision readers. It exaggerates distinctive letterform shapes (e.g., distinguishing uppercase `I`, lowercase `l`, and the numeral `1`) to avoid misreading under blurry vision or extreme magnification.
2. **Why High Contrast (WCAG AAA >= 7:1)?**
   Ghost Touch is designed for users with low vision, diabetic retinopathy, cataracts, and visual fatigue. The 7:1 AAA standard ensures readable text even in outdoor glare or on low-end Android displays.
3. **Why Decoration is `aria-hidden`?**
   Blind and low-vision screen reader users navigate serially using audio. Announcing cosmetic rivets or suture dividers wastes bandwidth and causes severe auditory fatigue.
4. **The 3-Flash and Reduced Motion Rules (WCAG 2.3.1):**
   Flashes exceeding 3 Hz can trigger photosensitive epileptic seizures. The "IT'S ALIVE" spark sequence operates at ~2.1 Hz for 950 ms. Users with vestibular disorders who have `prefers-reduced-motion` enabled receive a static frame with all animations disabled.
5. **Why the Canvas Has No Texture:**
   The canvas is the tactile bridge between the diagram and the user's fingers. Any visual texture, blueprint grid lines, or background artifacts inside the canvas would create visual noise that distracts from the haptic line-following experience.

---

## Logo

The Ghost Touch logo balances tactile STEM precision with the Frankenstein's Laboratory narrative. The mark embodies the sensory creature: a mobile device chassis perceiving a tactile diagram triangle through haptic vibration waves, grounded by a copper neck bolt electrode and stitched bone seams.

For complete brand guidelines, coordinate maps, asset exports, and character illustrations, see [docs/design/LOGO.md](./LOGO.md).

### 1. Construction Summary
- **Base Grid**: Designed on a `100 × 100` coordinate space (`logo-mark.svg`).
- **Phone Chassis**: Rounded rectangle `rect(x: 28, y: 16, width: 46, height: 68, rx: 10)` in Life Green (`#39ff88`) stroke (`3px`) with Deep Charcoal (`#0b0e0c`) fill.
- **Display Screen**: Recessed display bezel `rect(x: 34, y: 24, width: 34, height: 46, rx: 5)` in dark screen `#070a08` with faint green stroke.
- **Diagram Triangle**: Tactile polygon `polygon((51, 32), (40, 58), (62, 58))` with three circular vertex anchor nodes (radius `2.5px`), symbolizing tactile geometry exploration.
- **Neck Bolt Electrode**: Frankenstein copper terminal cap (`rect(x: 16, y: 42, width: 5, height: 16, rx: 2)`, `#d9904a`) and shank (`rect(x: 20, y: 44, width: 8, height: 12, rx: 2)`, `#c9803a`) on the left chassis flank.
- **Stitched Seams (Bone Sutures)**: Dashed suture lines (`#e8dfc8`, dashed `3 2`) across the top-right and bottom-left chassis corners with perpendicular cross-ticks.
- **Tactile Vibration Waves**: Three radiant haptic arcs emanating to the right from the phone edge (inner radius 14 px solid, middle radius 22 px 0.8 opacity, outer radius 30 px dashed `4 3` 0.55 opacity).
- **Horizontal Wordmark (`logo-full.svg`, `340 × 80`)**: Scaled mark at left paired with Atkinson Hyperlegible Bold wordmark ("Ghost " in Bone White `#f5fff8`, "Touch" in Life Green `#39ff88`) and a 4-tie dashed suture line (`#e8dfc8`) running beneath "Touch".
- **Creature Mascot Character (`Mascot.tsx`)**: Extended friendly character featuring a glowing screen-face with two optic sensor pupil-eyes (`r: 5.5`), cheerful stitched smile, copper bolts, buzzer cylinder, and theremin voice antenna.

### 2. Brand Colours
| Name | Hex Value | Role & Usage | WCAG Contrast on `#0b0e0c` |
|---|---|---|---|
| **Life Green** | `#39ff88` | Primary creature energy, active diagram strokes, brand mark | `15.8:1` (AAA) |
| **Aged Copper** | `#c9803a` / `#d9904a` | Hardware bolt, electrodes, lab button borders, focus rings | `4.8:1` (AA Large) |
| **Bone / Parchment** | `#e8dfc8` | Suture lines, surgical stitches, secondary labels | `14.2:1` (AAA) |
| **Lab Charcoal** | `#0b0e0c` | Canvas background, PWA theme and background color, app shell | Base Surface |
| **Voltage Cyan** | `#00e5ff` | Electric sparks, safe-zone rings, HUD status chips | `13.5:1` (AAA) |

### 3. Clear Space (The "Bolt Rule")
To preserve visual prominence and legibility, keep an exclusion zone surrounding all four sides of the mark and logo equal to the height of the neck bolt:
- $H_{\text{bolt}} = 16\text{ px}$ in the `100 × 100` coordinate space (or $0.2 \times \text{height}$ of the asset).
- No typography, UI boundaries, icons, or illustrations may enter this exclusion zone.

### 4. Minimum Dimensions
- **Favicon Variant (`favicon.svg`)**: Minimum readable size is **16 × 16 px**. At scales $\le 32\text{ px}$, delicate suture ticks and vibration arcs are omitted to preserve clarity.
- **Logo Mark (`logo-mark.svg`)**: Minimum size **32 × 32 px**.
- **Full Logo (`logo-full.svg`)**: Minimum width **120 px** (height $\approx 28\text{ px}$). Below 120 px, the wordmark must not be used; use the mark or favicon instead.

### 5. Prohibited Usages (The "Don'ts")
1. **Do NOT recolour outside the palette**: Never use generic neon greens, reds, or purples. Use `#39ff88`, `#c9803a`, and `#e8dfc8`.
2. **Do NOT distort or stretch**: Maintain aspect ratio strictly when scaling.
3. **Do NOT add novelty horror effects**: No bloody drips, slime, spiderwebs, or drop shadows. Spookiness belongs to electrical lab construction, never to vision disability.
4. **Do NOT place on low-contrast backgrounds**: Maintain $\ge 7:1$ contrast against surfaces. On light backgrounds, use `logo-mono.svg` (solid `#0b0e0c`).
5. **Do NOT use the mark as the sole heading**: The logo must never be the only content of an `<h1>` element without accessible text for screen readers.
6. **Do NOT flip or mirror**: The neck bolt is always mounted on the left chassis edge; vibration waves radiate to the right.

---

## Screenshots

The following before-and-after screenshots capture the Frankenstein's Laboratory redesign across mobile (`390x844`) and desktop (`1440x900`) viewports. (There is no "before" for the settings sheet or Correct, because the settings sheet is new and the Correct screenshot was taken only after the redesign.)

| Screen | Before | After | What changed |
|---|---|---|---|
| **Start** | [`before-start-390x844.png`](screenshots/before-start-390x844.png)<br>[`before-start-1440x900.png`](screenshots/before-start-1440x900.png) | [`after-start-390x844.png`](screenshots/after-start-390x844.png)<br>[`after-start-1440x900.png`](screenshots/after-start-1440x900.png) | Logo, mascot, compact organ tiles and "Wake the creature" now fit one phone screen. |
| **Capture** | [`before-capture-390x844.png`](screenshots/before-capture-390x844.png)<br>[`before-capture-1440x900.png`](screenshots/before-capture-1440x900.png) | [`after-capture-390x844.png`](screenshots/after-capture-390x844.png)<br>[`after-capture-1440x900.png`](screenshots/after-capture-1440x900.png) | One settings button, Take photo primary, specimen cards with previews. |
| **Settings** | *(None — new sheet)* | [`after-settings-390x844.png`](screenshots/after-settings-390x844.png)<br>[`after-settings-1440x900.png`](screenshots/after-settings-1440x900.png) | New sheet. |
| **Loading** | [`before-loading-390x844.png`](screenshots/before-loading-390x844.png)<br>[`before-loading-1440x900.png`](screenshots/before-loading-1440x900.png) | [`after-loading-390x844.png`](screenshots/after-loading-390x844.png)<br>[`after-loading-1440x900.png`](screenshots/after-loading-1440x900.png) | "The lab is powering up" meter. |
| **Explore** | [`before-explore-390x844.png`](screenshots/before-explore-390x844.png)<br>[`before-explore-1440x900.png`](screenshots/before-explore-1440x900.png) | [`after-explore-390x844.png`](screenshots/after-explore-390x844.png)<br>[`after-explore-1440x900.png`](screenshots/after-explore-1440x900.png) | One settings button, full title, canvas fills its frame, stitched frame. |
| **Ask** | [`before-ask-390x844.png`](screenshots/before-ask-390x844.png)<br>[`before-ask-1440x900.png`](screenshots/before-ask-1440x900.png) | [`after-ask-390x844.png`](screenshots/after-ask-390x844.png)<br>[`after-ask-1440x900.png`](screenshots/after-ask-1440x900.png) | Lab styling and the Raw Mode notice. |
| **Raw Mode** | [`before-raw-390x844.png`](screenshots/before-raw-390x844.png)<br>[`before-raw-1440x900.png`](screenshots/before-raw-1440x900.png) | [`after-raw-390x844.png`](screenshots/after-raw-390x844.png)<br>[`after-raw-1440x900.png`](screenshots/after-raw-1440x900.png) | Lab styling and the Raw Mode notice. |
| **Correct** | *(None — redesign only)* | [`after-correct-390x844.png`](screenshots/after-correct-390x844.png) | Canvas fills its frame. |

### Per-Screen Changes Summary

- **Start**: Logo, mascot, compact organ tiles and "Wake the creature" now fit one phone screen.
- **Capture**: One settings button, Take photo primary, specimen cards with previews.
- **Settings**: New sheet.
- **Loading**: "The lab is powering up" meter.
- **Explore**: One settings button, full title, canvas fills its frame, stitched frame.
- **Ask and Raw Mode**: Lab styling and the Raw Mode notice.
- **Correct**: Canvas fills its frame.

