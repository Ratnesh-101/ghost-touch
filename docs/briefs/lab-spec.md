# Lab theme: shared spec (all lanes read this first)

Ghost Touch gets a Kiroween "Frankenstein's Laboratory" look. Ghost Touch is a creature stitched from spare phone parts: buzzer = nerves, vision AI = eyes, synthesizer = voice. The UI is the lab where it comes alive. The spookiness lives in the creature and the lab, NEVER in blindness: no blindfolds, no eye-gore, no "darkness/blind" jokes.

## Visual system (tokens live in `frontend/src/styles/tokens.css`; no hard-coded colours in components or screen CSS)
- Background: deep lab charcoal `#0b0e0c` with a faint blueprint grid (suits diagrams).
- Primary "life" green stays `#39ff88` (matches the diagram strokes).
- Accents: voltage cyan (electric sparks), aged copper/brass (lab hardware, button borders), bone/parchment (stitch lines, secondary text).
- Signature motif: stitched seams (SVG dashed sutures) as section dividers and card edges; small bolts/rivets on primary cards.
- Typography: Atkinson Hyperlegible (designed for low-vision readers) for ALL UI text, self-hosted (woff2 files are in `frontend/src/assets/fonts/`, OFL licence beside them). The PWA must work offline, so fonts are precached. Atkinson has no Devanagari or Gujarati glyphs: keep a system-font fallback stack that covers them. No novelty horror fonts for body text.
- Motion: an "IT'S ALIVE" moment when a scene finishes loading: brief spark arc + glow pulse + the EXISTING `success` earcon (no audio code changes). Respect `prefers-reduced-motion`. No more than 3 flashes per second (WCAG 2.3.1). Total animation under 1.2 s.

## Screen intent (later lanes implement these; foundation/brand/i18n lanes prepare the parts)
1. Start: hero with logo, tagline "Feel diagrams you can't see", three "organ" tiles (Nerves = vibration, Eyes = vision AI, Voice = theremin + speech), one line each; one huge "Wake the creature" start button (keep the existing start logic and the whole-screen single button).
2. Capture: brand first, primary action second. Language + speech rate move into a "Lab settings" sheet behind ONE clearly labelled button showing the current choice (e.g. "Settings: English, 1.0×"). Take photo = primary; Choose image / PDF and Saved diagrams = secondary. Sample diagrams become larger "specimen jar" cards with a real mini preview of each diagram.
3. Loading: "Reading your diagram…" styled as the lab powering up (copper meter / charging bar); spoken message and progress tone unchanged.
4. Explore: the canvas stays maximum contrast, glowing green lines on near-black, NO decorative texture inside the canvas, nothing that competes with haptics. The frame around it can be the "specimen table" (stitched border, rivets). Restyle only the HUD/status chip.
5. Ask, Raw Mode notice, errors, Saved diagrams: same system. Raw Mode copy: "The creature's eyes are blurry — you can still feel the outlines."
6. Mascot (inline SVG, original: a friendly stitched phone with a bolt and a glowing screen-face) on Start and the empty states. Not a known character.

## Hard constraints (never break these)
- Do not touch `frontend/src/core/**`, any `*.prop.test.ts`, drivers' haptic logic, the tuned haptic values, the TalkBack relative-cursor behaviour, speech/earcon logic, routing, `.kiro/**`, or any backend file. Styling and markup only, plus new presentational components, plus the i18n strings.
- Keep every accessible name, role, live region and spoken message. Every control at least 48x48 CSS px. Text contrast at least 7:1 (large text at least 4.5:1). Visible focus rings (copper or cyan). Works at 200% zoom and 320 px width.
- Every user-facing string goes through `t()` with en, hi and gu entries (hi/gu machine-translated: say so in your report).
- All existing tests pass (473 frontend tests at the start). Several tests read CSS: `tests/a11y.contrast.test.ts` parses `src/styles/tokens.css` for hex tokens; `tests/a11y.targets.test.ts`, `tests/a11y.motion.test.ts` and `tests/screens.render.test.ts` read `src/styles/global.css?raw`. Keep those working; extend them (in new test files) rather than weakening them.
- No new runtime or dev dependencies. SVG and CSS only. No image over 30 KB. Browser APIs only in `drivers/`.
- Atkinson Hyperlegible is the UI font; the document language fallbacks for hi/gu must stay readable.

## Ownership across lanes (so parallel lanes do not collide)
- foundation: `tokens.css`, the base and primitives parts of `global.css`, `styles/lab.css`, `components/lab/**`, fonts, `docs/design/LAB_THEME.md`, the `globPatterns` line of `vite.config.ts`.
- brand: `public/brand/**`, favicons, `components/Logo.tsx`, `components/Mascot.tsx`, `index.html`, the manifest block of `vite.config.ts`, `scripts/build-brand.mjs`, README top, `docs/design/LOGO.md`.
- i18n: `i18n/index.ts`, `components/LabSettings.tsx`, `styles/settings.css`, their tests.
- Later lanes (do NOT touch their files now): `screens/**`, screen-specific rules in `global.css` (`.gt-start*`, `.gt-capture*`, `.gt-explore*`, `.gt-saved*`, `.gt-correct*`).

## Rules for every run
Read AGENTS.md first. No git state changes (you cannot run add, commit or push), no installs, no `.env` access, no new dependencies. You may only run the allow-listed commands (see the run rules above). Run them for real and record true results, including failures. End your final report with a **"Commit groups"** section (ordered logical commits: conventional message plus the exact files each). Write the report to `docs/reports/agy-<lane>-report.md`.
