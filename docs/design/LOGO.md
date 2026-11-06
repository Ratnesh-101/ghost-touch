# Ghost Touch Logo & Brand Guidelines

> **Laboratory Theme Specification** — The visual identity of Ghost Touch balances tactile precision with an original "Frankenstein's Laboratory" aesthetic. The creature is stitched together from spare phone components: tactile buzzer (nerves), vision AI (eyes), and pitch synthesizer (voice).
>
> **Owner Approval (2026-11-06)**: The current mark (`frontend/public/brand/logo-mark.svg`) and favicon (`frontend/public/favicon.svg`), alongside the rest of the brand set, were approved by the owner on 2026-11-06. The alternative-logo exploration was cancelled. The standalone 64×64 PNG favicon (`frontend/public/favicon-64x64.png`) is included in the production asset set.

---

## 1. Concept & Narrative

Ghost Touch is not a cold utility; it is a creature that comes alive in the lab to help blind and low-vision students feel diagrams they cannot see.

- **The Phone Chassis**: A durable, rounded mobile device body.
- **The Screen & Diagram**: An illuminated diagrammatic triangle with vertex nodes—representing tactile geometry perceived through touch.
- **The Neck Bolt**: A Frankenstein copper electrode on the chassis flank, grounding the creature in the lab motif.
- **The Stitched Seams**: Bone-hued dashed sutures across the chassis, signifying the assembled nature of the sensory organs.
- **The Vibration Arcs**: Three radiant haptic waves emanating from the right edge, visualizing tactile sensory feedback.
- **The Wordmark**: Clean, highly legible typography with a thin surgical suture beneath "Touch".

---

## 2. Anatomy & Construction

### 2.1 Mark Coordinate Grid (`100 × 100` Base Space)

```text
       0        20   28           74   85  100
     0 ┌────────┬────┬─────────────┬────┬───┐
       │        │    │             │    │   │
    16 │        │    │ ┌─────────┐ │    │   │  <-- Top chassis edge (y=16, rx=10)
       │        │    │ │ ┌─────┐ │ │    │   │      Top-right suture (y=16 -> y=32)
    24 │        │    │ │ │  ▲  │ │ │    │ ) │  <-- Screen top (y=24), Triangle (y=32)
    42 │     ┌──┤    │ │ │ / \ │ │ │    │) )│  <-- Bolt cap (x=16..21, y=42..58)
    44 │     │  │    │ │ │/___\│ │ │   ))) )│  <-- Bolt stem (x=20..28, y=44..56)
    58 │     └──┤    │ │ └─────┘ │ │    │) )│  <-- Screen bottom (y=70), Base (y=58)
    72 │        │    │ │         │ │    │ ) │  <-- Bottom-left suture (y=72 -> y=84)
    84 │        │    │ └─────────┘ │    │   │  <-- Bottom chassis edge (y=84)
       │        │    │             │    │   │
   100 └────────┴────┴─────────────┴────┴───┘
```

1. **Phone Body**: `rect(x: 28, y: 16, width: 46, height: 68, rx: 10)`
   - Stroke: `3px` Life Green (`#39ff88`), Fill: Deep Charcoal (`#0b0e0c`).
2. **Display Screen**: `rect(x: 34, y: 24, width: 34, height: 46, rx: 5)`
   - Stroke: `1.5px` Green `35%` opacity, Fill: Dark Screen (`#070a08`).
3. **Diagram Triangle**: `polygon((51, 32), (40, 58), (62, 58))`
   - Stroke: `2.5px` Life Green, Fill: Green `15%` glow.
   - Three vertex anchor circles: radius `2.5px` at each triangle corner.
4. **Neck Bolt Electrode**:
   - Terminal Cap: `rect(x: 16, y: 42, width: 5, height: 16, rx: 2)` Copper (`#d9904a`)
   - Shank: `rect(x: 20, y: 44, width: 8, height: 12, rx: 2)` Copper (`#c9803a`)
   - Slotted Center Line: `line((18.5, 46) -> (18.5, 54))` Dark Copper (`#783c0c`).
5. **Suture Marks (Bone Stitching)**:
   - Top-Right Seam: `path(M 58 16 L 74 32)` dashed `3 2` in `#e8dfc8`.
   - Three cross-sutures: perpendicular tick marks (`stroke-width: 1.5px`).
   - Bottom-Left Seam: `path(M 28 72 L 40 84)` dashed `3 2` with two cross-sutures.
6. **Tactile Vibration Waves**:
   - Arc 1 (Inner): `M 79 38 A 14 14 0 0 1 79 62`, stroke `2.5px`, `#39ff88`.
   - Arc 2 (Middle): `M 85 32 A 22 22 0 0 1 85 68`, stroke `2px`, opacity `0.8`.
   - Arc 3 (Outer): `M 91 26 A 30 30 0 0 1 91 74`, stroke `1.5px`, dashed `4 3`, opacity `0.55`.

### 2.2 Horizontal Full Logo (`340 × 80` Base Space)

- **Mark Position**: Scaled to `72 × 72` px, translated to `(2, 4)`.
- **Wordmark Typography**:
  - Baseline: `y = 48`
  - Font: Atkinson Hyperlegible Bold, size `34px`, tracking `-0.5px`.
  - "Ghost ": Fill Bone White (`#f5fff8`).
  - "Touch": Fill Life Green (`#39ff88`).
- **Touch Suture Accent**:
  - Suture line running beneath "Touch" from `x = 184` to `x = 282` at `y = 58`.
  - Dashed `4 3`, stroke `2px`, Bone Parchment (`#e8dfc8`).
  - Four perpendicular suture cross-ties at `x = 200, 224, 248, 272`.

### 2.3 Creature Mascot Character (`120 × 120` Base Space)

While the brand mark is a clean geometric symbol (phone chassis feeling a diagram triangle), the app's creature mascot (`Mascot.tsx`) brings the creature to life as a friendly character:
- **Phone Body & Sutures**: Rounded phone silhouette (`rx: 14`) in Deep Charcoal (`#0b0e0c`) with Life Green outline (`#39ff88`), stitched with Bone sutures (`#e8dfc8`, dashed `3 2`).
- **Neck Bolts**: Aged copper electrodes (`#c9803a` with `#d9904a` terminal caps) flanking the chassis.
- **Glowing Screen-Face**: A high-contrast dark screen bezel framing an optic sensor halo (`r: 14`), two glowing green camera-pupil eyes (`r: 5.5`, glint `#ffffff`), gentle brows, and a cheerful stitched smile.
- **Sensory Organs**:
  - *Nerves*: Tactile buzzer motor cylinder with internal copper coils (`#25a357`) and radiating haptic arcs.
  - *Voice*: Theremin antenna rod on the chassis top with radiated pitch tone waves.
  - *Eyes*: Vision AI optic sensor array embedded directly into the screen display.
- **Accessibility**: Purely decorative (`aria-hidden="true"`, `focusable="false"`, no text tags), strictly under 8 KB budget.

---

## 3. Brand Color Palette

| Name | Hex | Role & Purpose | WCAG Contrast on `#0b0e0c` |
|---|---|---|---|
| **Life Green** | `#39ff88` | Primary creature energy, active diagram strokes, branding mark | `15.8 : 1` (AAA) |
| **Aged Copper** | `#c9803a` | Hardware bolt, electrodes, lab hardware, focus rings | `4.8 : 1` (AA Large) |
| **Bone / Parchment** | `#e8dfc8` | Suture lines, stitches, secondary labels | `14.2 : 1` (AAA) |
| **Lab Charcoal** | `#0b0e0c` | Canvas background, PWA theme-color, app shell surface | Base Surface |
| **Voltage Cyan** | `#00e5ff` | Electric sparks, HUD status accents, safe-zone rings | `13.5 : 1` (AAA) |

---

## 4. Clear Space & Minimum Sizes

### 4.1 Clear Space (The "Bolt Rule")

To preserve visual autonomy and legibility, keep a clear space surrounding all sides of the mark and logo equal to the height of the neck bolt ($H_{bolt} = 16\text{ px}$ in the mark space, or $0.2 \times \text{height}$ of the asset).

```text
        ┌──────────────────────────────────────┐
        │              H_bolt                  │
        │      ┌────────────────────────┐      │
        │      │                        │      │
 H_bolt │      │     GHOST TOUCH        │      │ H_bolt
        │      │                        │      │
        │      └────────────────────────┘      │
        │              H_bolt                  │
        └──────────────────────────────────────┘
```

No typography, UI boundaries, icons, or illustrations may enter this exclusion zone.

### 4.2 Minimum Dimensions

- **Favicon Variant (`favicon.svg`)**: Minimum readable size is **16 × 16 px**.
  *At small scales ($\le 32\text{ px}$), suture ticks and vibration arcs are omitted. Only the bold phone silhouette, copper bolt, and high-contrast screen triangle are rendered. Multi-resolution renders are generated into `favicon.ico` (16, 32, 48 px) and the standalone 64×64 PNG favicon (`favicon-64x64.png`).*
- **Logo Mark (`logo-mark.svg`)**: Minimum size **32 × 32 px**.
- **Full Logo (`logo-full.svg`)**: Minimum width **120 px** (height $\approx 28\text{ px}$). Below 120 px, the wordmark must not be used; use the mark or favicon instead.

---

## 5. Typography Standards

- **Primary Typeface**: **Atkinson Hyperlegible** (Braille Institute).
- **Weights**: Bold (`700`) for headers and logo wordmark; Regular (`400`) for body text.
- **Glyph Fallback Stack**:
  ```css
  font-family: 'Atkinson Hyperlegible', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  ```
- *Note on Indic scripts*: Atkinson Hyperlegible does not include Devanagari (Hindi) or Gujarati characters; the fallback stack gracefully maps to native system fonts for those locales.

---

## 6. The "Don'ts" — Prohibited Usages

1. **Do NOT recolour outside the palette**: Never use generic neon greens, reds, or purples. Use `#39ff88`, `#c9803a`, and `#e8dfc8`.
2. **Do NOT distort or stretch**: Maintain aspect ratio strictly when scaling.
3. **Do NOT add novelty horror effects**: No bloody drips, slime, spiderwebs, or drop shadows. Spookiness belongs to the creature's electrical construction, never to vision disability.
4. **Do NOT place on busy or low-contrast backgrounds**: Always ensure $\ge 7:1$ contrast against light or dark surfaces. On light backgrounds, use `logo-mono.svg` (solid `#0b0e0c`).
5. **Do NOT use the mark as the sole heading**: The logo must never be the only content of an `<h1>` element. Web pages must retain semantic text headings for screen readers.
6. **Do NOT flip or mirror**: The neck bolt is always mounted on the left chassis edge; vibration waves radiate to the right.

---

## 7. Asset Inventory

| Asset Path | Format | Size | Description |
|---|---|---|---|
| `frontend/public/brand/logo-mark.svg` | SVG | 2.5 KB | Approved full-detail creature mark on transparent background |
| `frontend/public/brand/logo-full.svg` | SVG | 3.4 KB | Horizontal mark + wordmark with suture accent |
| `frontend/public/brand/logo-mono.svg` | SVG | 3.0 KB | Monochrome `#0b0e0c` version for light documentation/print |
| `frontend/public/brand/logo-maskable.svg` | SVG | 2.8 KB | Centered mark inside 80% safe zone with solid `#0b0e0c` bg |
| `frontend/public/brand/og-image.svg` | SVG | 8.8 KB | 1200×630 OpenGraph / Twitter preview with 3 organ cards |
| `frontend/public/favicon.svg` | SVG | 0.8 KB | Approved simplified 16 px icon (phone + bolt + triangle) |
| `frontend/public/favicon.ico` | ICO | 2.7 KB | Multi-size ICO container (16, 32, 48 px PNG frames) |
| `frontend/public/favicon-64x64.png` | PNG | ~1.5 KB | Standalone 64×64 transparent PNG favicon |
| `frontend/public/apple-touch-icon.png` | PNG | 5.2 KB | 180×180 iOS home-screen icon |
| `frontend/public/icons/icon-192.png` | PNG | 5.6 KB | 192×192 standard PWA home-screen icon |
| `frontend/public/icons/icon-512.png` | PNG | 15.7 KB | 512×512 high-resolution PWA splash icon |
| `frontend/public/icons/icon-maskable-512.png` | PNG | 15.7 KB | 512×512 Android adaptive maskable icon |
| `frontend/public/brand/og-image.png` | PNG | 248 KB | 1200×630 production OpenGraph raster image |
| `docs/design/screenshots/logo-sizes.png` | PNG | 72.9 KB | Contact sheet: 16/32/64 favicon & masked icon |
| `frontend/src/components/Logo.tsx` | React / TSX | ~4 KB | Accessible inline SVG component (`'full' \| 'mark'`) |
| `frontend/src/components/Mascot.tsx` | React / TSX | ~3.8 KB | Decorative creature mascot SVG with 2-eyed screen-face and organ triad |
| `scripts/build-brand.mjs` | Node ESM | ~9 KB | Headless Chromium rasterizer for PNG/ICO & contact sheet |
