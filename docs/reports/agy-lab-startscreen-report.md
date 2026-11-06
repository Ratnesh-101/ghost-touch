# Lane lab-startscreen: Build the Lab Start Screen — Final Report

**Builder:** Antigravity (agy)  
**Date:** 2026-11-06  
**Lane:** `lab-startscreen`  
**Specification:** `docs/briefs/lab-spec.md` & `docs/briefs/agy-lab-startscreen.md`  

---

## 1. Executive Summary

This lane implemented the Frankenstein's Laboratory Start screen for Ghost Touch, transforming the opening screen into an atmospheric, tactile laboratory where the creature comes alive. 

All key requirements have been satisfied:
- **Full-Screen Single Button Accessibility Contract:** The whole screen remains ONE accessible button (`<button className="gt-start-surface" aria-label={t('start.intro')}>`). Screen readers announce exclusively the introduction sentence ("Ghost Touch. Tap anywhere to begin.").
- **Aria-Hidden Hero Composition:** All visual hero content sits inside `<span className="gt-start__hero" aria-hidden="true">` to prevent duplicate or confusing announcements by assistive technologies.
- **Hero Elements:**
  - **Logo:** Embedded `<Logo variant="full" decorative className="gt-start__logo" />` displaying the creature phone mark, glowing wordmark ("Ghost Touch"), and subtle suture underline.
  - **Mascot Emblem:** Embedded `<Mascot />` inside `.gt-start__creature-emblem` depicting the stitched phone creature with two gentle glowing optic eyes, theremin pitch rod, and tactile buzzer.
  - **Tagline:** Visible tagline `t('app.tagline')` styled with bone/parchment token `--gt-bone` (>13:1 contrast on lab charcoal).
  - **Seam Divider:** Decorative stitched suture divider `<Seam className="gt-start__seam" />`.
  - **Organ Tiles:** Displayed via `<OrganTiles organs={[...]} />` showing the creature triad:
    - **Nerves:** `t('lab.organ.nerves.title')` ("Nerves"), `t('lab.organ.nerves.line')` ("Feel lines and corners as vibration") with motor icon & rivet.
    - **Eyes:** `t('lab.organ.eyes.title')` ("Eyes"), `t('lab.organ.eyes.line')` ("AI reads your diagram") with optical lens icon & rivet.
    - **Voice:** `t('lab.organ.voice.title')` ("Voice"), `t('lab.organ.voice.line')` ("Tones and speech tell you more") with theremin antenna icon & rivet.
  - **Call to Action Badge:** Huge "Wake the creature" call to action badge (`.gt-start__action-badge`) displaying `t('lab.start.wake')` with an idle pulse dot (`.gt-start__pulse-dot`) and subtle slow idle glow.
  - **Subhint:** Replaced hard-coded English subhint with translated `t('lab.start.subhint')` ("TalkBack & touch ready").
- **Zero Hard-Coded English Strings:** All strings routed through `t()`. Added `lab.start.subhint` to `en`, `hi`, and `gu` in `frontend/src/i18n/index.ts` (Hindi and Gujarati machine-translated). Verified that in Hindi and Gujarati, zero English organ text appears.
- **Layout & Zoom Fix (Audit BUG-03):** Removed `justify-content: center` and `margin: auto 0` which caused flexbox scroll clipping at 200% zoom and in landscape. Replaced with `margin: 0 auto; min-height: 100%` and `justify-content: safe center`, ensuring content scrolls from top origin `(0, 0)`. Added safe-area padding (`env(safe-area-inset-*)`).
- **Typography & Indian Script Safety:** Ensured no `white-space: nowrap` or fixed heights on text elements, with `line-height: 1.5` to accommodate tall Devanagari and Gujarati diacritics.
- **Motion & Reduced Motion:** Set idle glow to 3s period (0.33 Hz) and pulse to 2s period (0.5 Hz), well below WCAG 2.3.1 3 flashes/second limit. Fully suppressed under `@media (prefers-reduced-motion: reduce)`.
- **Focus Ring:** 3px visible focus outline (`outline: 3px solid var(--gt-focus)`) with voltage cyan glow on `.gt-start-surface:focus-visible`.

---

## 2. Definition of Done Command Verification

All commands specified in the lane brief and runner rules were executed directly from the repo root with real results:

### 1. TypeScript Compilation
```bash
npm --prefix frontend exec -- tsc -p frontend --noEmit
```
- **Exit Code:** 0
- **Output:** Clean (0 errors).

### 2. Frontend Test Suite
```bash
npm --prefix frontend test
```
- **Exit Code:** 0
- **Duration:** 797 ms
- **Test Files Passed:** 54 passed (54 total)
- **Tests Passed:** 753 passed (753 total)
  - Prior baseline: 53 test files, 737 tests passed.
  - New test file: `frontend/tests/start.lab.test.tsx` (16 tests passed).
  - Regressions: 0.

### 3. Frontend Production & PWA Build
```bash
npm --prefix frontend run build
```
- **Exit Code:** 0
- **Duration:** 159 ms
- **Result:** Vite build transformed 65 modules and generated production client assets and PWA service worker with 22 precache entries (462.85 KiB).
- **CSS Verification:** Confirmed that all `.gt-start*` and `.gt-organ*` rules exist in minified `frontend/dist/assets/index-C0JTVz3Z.css`.

---

## 3. Diff Stat for `Start.tsx`

```
 frontend/src/screens/Start.tsx | 55 +++++++++++++++++++++++++++++++++++++------------------
 1 file changed, 37 insertions(+), 18 deletions(-)
```

### Overall Diff Stat
```
 frontend/src/i18n/index.ts     |   3 +
 frontend/src/screens/Start.tsx |  55 +++++++++++----
 frontend/src/styles/global.css | 154 +++++++++++++++++++++++++++--------------
 3 files changed, 148 insertions(+), 64 deletions(-)
```

---

## 4. Audit BUG-03 Analysis & Resolution

| Audit Finding | Root Cause | Solution Implemented |
|---|---|---|
| **BUG-03: Flexbox Scroll-Clipping** | `.gt-start-surface` specified `justify-content: center` with `.gt-start__hero` set to `margin: auto 0`. Under 200% zoom (effective 160 px width) or mobile landscape (height <= 360 px), top half of content overflowed into negative scroll coordinates above (0, 0), permanently truncating the mascot emblem and title. | Removed `justify-content: center` from `.gt-start-surface` and `margin: auto 0` from `.gt-start__hero`. Applied `margin: 0 auto; min-height: 100%` on `.gt-start__hero` and `justify-content: flex-start; justify-content: safe center;` on `.gt-start-surface`. Container scrolls cleanly from origin `(0, 0)` down. |
| **BUG-06: Missing Safe-Area Insets** | Container lacked safe-area padding for notch/island/home indicator cutouts. | Added `padding-top: max(var(--gt-space-xl), var(--gt-safe-top, env(safe-area-inset-top, 0px)))` (and bottom/left/right equivalents) to `.gt-start-surface`. |
| **BUG-09: Hard-coded English Strings** | English chips ("Nerves · Vibration", etc.) and subhint ("TalkBack & touch ready") bypassed `t()`. | Replaced with `OrganTiles` reading `lab.organ.*` keys from `t()` and added `lab.start.subhint` to all three language dictionaries (`en`, `hi`, `gu`). |

---

## 5. Internationalization & Translation Verification

Tested using server rendering across all three supported languages in `frontend/tests/start.lab.test.tsx`:

- **English (`en`):**
  - Spoken accessible name: "Ghost Touch. Tap anywhere to begin."
  - Tagline: "Feel diagrams you can't see."
  - Organs: "Nerves" / "Feel lines and corners as vibration", "Eyes" / "AI reads your diagram", "Voice" / "Tones and speech tell you more"
  - CTA: "Wake the creature"
  - Subhint: "TalkBack & touch ready"
- **Hindi (`hi` - machine-translated):**
  - Spoken accessible name: "घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें।"
  - Tagline: "वे चित्र महसूस करें जो आप देख नहीं सकते।"
  - Organs: "तंत्रिकाएं" / "रेखाओं और कोनों को कंपन के रूप में महसूस करें", "आंखें" / "एआई आपके चित्र को पढ़ता है", "आवाज़" / "टोन और आवाज़ आपको अधिक बताते हैं"
  - CTA: "जीव को जगाएं"
  - Subhint: "टॉकबैक और स्पर्श तैयार"
  - **Zero English organ text appears.**
- **Gujarati (`gu` - machine-translated):**
  - Spoken accessible name: "ગોસ્ટ ટચ. શરૂ કરવા માટે ગમે ત્યાં ટેપ કરો."
  - Tagline: "જે આકૃતિઓ તમે જોઈ શકતા નથી તેને સ્પર્શથી અનુભવો."
  - Organs: "ચેતાઓ" / "રેખાઓ અને ખૂણાઓને વાઇબ્રેશન તરીકે અનુભવો", "આંખો" / "AI તમારી આકૃતિ વાંચે છે", "અવાજ" / "ટોન અને વાણી તમને વધુ વિગત જણાવે છે"
  - CTA: "પ્રાણીને જગાડો"
  - Subhint: "ટોકબેક અને સ્પર્શ તૈયાર"
  - **Zero English organ text appears.**

---

## 6. Commit groups

Ordered logical commits for review and staging:

### Commit 1: i18n
- **Message:** `feat(i18n): add lab.start.subhint translation key for en, hi, and gu`
- **Files:**
  - `frontend/src/i18n/index.ts`

### Commit 2: styles
- **Message:** `fix(styles): resolve BUG-03 zoom flexbox scroll-clipping and restyle start screen for lab theme`
- **Files:**
  - `frontend/src/styles/global.css`

### Commit 3: screens
- **Message:** `feat(screens): rebuild Start hero with full Logo, Mascot, OrganTiles, and Wake CTA`
- **Files:**
  - `frontend/src/screens/Start.tsx`

### Commit 4: tests & docs
- **Message:** `test(screens): add lab Start screen tests and update build log`
- **Files:**
  - `frontend/tests/start.lab.test.tsx`
  - `docs/BUILD_LOG.md`
  - `docs/reports/agy-lab-startscreen-report.md`
