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
Filled in by the brand lane
