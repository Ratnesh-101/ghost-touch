# Report: Lane bu12 — Stay on line switch and wiring for Kiro task T58 sticky line

- **Status:** DONE
- **Tool:** Antigravity (agy)
- **Lane:** bu12
- **Date:** 2026-11-16
- **Requirement:** Requirement 33 (Sticky line following, Kiro task T58 / lane T58b)

## Summary

Implemented the "Stay on line" Settings switch and wired sticky line following into the Explore move pipeline. When active, if a blind user has held a line continuously for at least 200 ms (`STICKY_HOLD_MS`), the line remains acquired out to 24 CSS px (`STICKY_RADIUS_PX`) even if the user's finger drifts slightly off the line (normal line radius is 14 px).

> [!IMPORTANT]
> **Phone-untested notice:** The sticky parameters (`STICKY_HOLD_MS = 200` ms, `STICKY_RADIUS_PX = 24` CSS px) are **PROPOSED and phone-untested**, pending owner approval and field testing on a physical phone per `tech.md` and Requirement 33.

---

## Changes Implemented

### 1. Storage & Persistence (`frontend/src/drivers/storage.ts`)
- Added `STORAGE_KEY_STICKY_LINE = 'gt_sticky_line_enabled'`.
- Implemented `getStoredStickyLineSetting(): boolean` with safe `localStorage` access and fallback to in-memory boolean. **Defaults to `false` (DEFAULT OFF)**.
- Implemented `setStoredStickyLineSetting(enabled: boolean): void` persisting setting and notifying registered settings subscribers.
- Implemented `_resetStickyLineSettingForTesting(): void` to restore pristine defaults between tests.

### 2. Localization (`frontend/src/i18n/index.ts`)
Added i18n keys across all supported languages (`en`, `hi`, `gu`):
- `lab.settings.stickyLine`:
  - `en`: `'Stay on line'`
  - `hi`: `'रेखा पर बने रहें'`
  - `gu`: `'રેખા પર રહો'`
- `lab.settings.stickyLineHint`:
  - `en`: `'Keep following a line even if your finger drifts slightly.'`
  - `hi`: `'उंगली थोड़ा भटकने पर भी रेखा का अनुसरण जारी रखें।'`
  - `gu`: `'આંગળી થોડી ખસી જાય તો પણ રેખા અનુસરવાનું ચાલુ રાખો.'`
- `lab.settings.stickyLineOn`:
  - `en`: `'Stay on line enabled.'`
  - `hi`: `'रेखा पर बने रहें सक्षम किया गया।'`
  - `gu`: `'રેખા પર રહો સક્ષમ કરી.'`
- `lab.settings.stickyLineOff`:
  - `en`: `'Stay on line disabled.'`
  - `hi`: `'रेखा पर बने रहें अक्षम किया गया।'`
  - `gu`: `'રેખા પર રહો અક્ષમ કરી.'`

None of the strings contain forbidden verification words ("verified", "correct", "checked", "approved").

### 3. LabSettings Switch (`frontend/src/components/LabSettings.tsx`)
- Added switch `<AccessibleButton role="switch" aria-checked={stickyLineEnabled}>` in `<section aria-labelledby="lab-settings-section-sticky-line">`.
- Minimum 48×48 CSS px touch target (`minWidth: '48px', minHeight: '48px'`, plus `.gt-control` CSS rules).
- Fixed button label (`{t('lab.settings.stickyLine')}`) with state carried strictly via `aria-checked` to prevent screen readers from reading state twice.
- State change spoken on toggle via `doSpeak(next ? t('lab.settings.stickyLineOn') : t('lab.settings.stickyLineOff'))`.
- Reads `getStoredStickyLineSetting()` on mount/open, defaulting to `false`.

### 4. Move Pipeline Decision Logic (`frontend/src/flow/explore.ts`)
- Imported pure core helpers `followTarget`, `STICKY_HOLD_MS`, `STICKY_RADIUS_PX` from `../core/sticky`.
- Added pure hold tracking helpers:
  - `initialStickyHoldState(): StickyHoldState`
  - `resetStickyHoldOnLift(): StickyHoldState`
  - `getHeldMs(state, prevTarget, now): number`
  - `updateStickyHoldState(state, newTarget, now): StickyHoldState`
- Updated `processPointerMove(..., sticky?: ProcessPointerMoveStickyOptions)`:
  - When `sticky?.enabled` is `false` or omitted: calls `hitTest(scene, finger, view, radii)` directly. **No call to `followTarget` is made; behavior is byte-identical to today.**
  - When `sticky?.enabled` is `true`: calls `followTarget(sticky.prevTarget, sticky.heldMs, scene, finger, view, radii, sticky.stickyRadiusPx ?? STICKY_RADIUS_PX)`.
  - Re-exported storage and sticky helpers.

### 5. Explore Screen Wiring (`frontend/src/screens/Explore.tsx`)
- Subscribed to settings changes via `subscribeSettings` and maintained `stickyLineSettingRef`.
- Tracked continuous line hold duration via `stickyHoldRef` and `prevTargetRef`.
- Passed `{ enabled: stickyLineSettingRef.current, prevTarget, heldMs, stickyRadiusPx: STICKY_RADIUS_PX }` to `processPointerMove` across `handlePointerDown`, `handlePointerMove`, secondary pointer promotion, and the `keepAliveTimer` tick handler.
- Did not hard-code any radius or duration constant; imported `STICKY_RADIUS_PX` from core/flow.
- Reset hold time and previous target on:
  - **Lift** (`handlePointerLift` on all fingers lifted)
  - **Secondary promotion** (resets for new primary hold)
  - **Cancel** (`onPointerCancel`, `onLostPointerCapture`)
  - **Blur** (`handleWindowBlur`, `visibilitychange` hidden)
  - **Ask** (`handleVoiceAsk`, `handleTextSubmit`, `askActive`)
  - **Guide** (`handleStartGuideFromOffer`, voice command guide)
  - **Exit / Navigation back** (`handleExit`, `unbindBack`)
- Kept stationary keep-alive timer active: stationary fingers resting at drift distances within `STICKY_RADIUS_PX` after a 200 ms hold continue to receive keep-alive ticks and line buzz.

---

## Proof & Tests

Added comprehensive tests in `frontend/tests/stickyWiring.test.ts` and `frontend/tests/labSettings.test.tsx` that will fail if any part of the wiring is removed:

1. **Switch default off:**
   - Verifies `getStoredStickyLineSetting()` returns `false` by default.
   - Verifies LabSettings switch renders `role="switch"` and `aria-checked="false"`.
2. **Off equals today's output for scripted triangle trace:**
   - Runs a 5-step triangle trace (including vertex entrance, quiet window, and 18 px drift off line).
   - Verifies that with switch off, the output is deeply/byte-for-byte identical to baseline `processPointerMove` without sticky options. At 18 px drift, target is `{ kind: 'none' }` and `followTarget` is not called.
3. **On keeps the line target when finger drifts 18 px off after 300 ms:**
   - Holds segment for 300 ms (`heldMs >= STICKY_HOLD_MS`).
   - Drifts 18 px off line (outside normal 14 px radius, inside 24 px sticky radius).
   - Verifies pipeline returns the held line segment and produces continuous line buzz (`vibrate(80)`).
   - Verifies drift to 30 px off (> 24 px) breaks hold and returns `{ kind: 'none' }`.
4. **First touch still needs the normal line radius:**
   - First touch at 18 px off line returns `{ kind: 'none' }` and no vibration (initial touch has no prior held line; acquisition radius is unchanged at 14 px).
   - First touch within 14 px acquires the line normally.
5. **Resets on lift (and cancel, blur, Ask, Guide):**
   - After holding a line for 300 ms, finger lifts.
   - Subsequent touch at 18 px off returns `{ kind: 'none' }`.
   - Re-touch on the line held for only 50 ms followed by 18 px drift returns `{ kind: 'none' }` (hold duration was reset to 0 on lift, so 50 ms < 200 ms).
   - Entering vertex, switching lines, or leaving lines resets the sticky hold tracker.
6. **Keep-alive timer still works:**
   - Finger rests stationary at 18 px off line after holding for 300 ms.
   - Verifies `shouldKeepAlive(400, 460, 60)` is true.
   - Keep-alive tick at t=460 ms and t=520 ms processes move with accumulated hold time and keeps line buzzing.

---

## Files Touched
- `frontend/src/drivers/storage.ts`
- `frontend/src/i18n/index.ts`
- `frontend/src/components/LabSettings.tsx`
- `frontend/src/flow/explore.ts`
- `frontend/src/screens/Explore.tsx`
- `frontend/tests/labSettings.test.tsx`
- `frontend/tests/stickyWiring.test.ts`
- `docs/reports/agy-bu12-report.md`
