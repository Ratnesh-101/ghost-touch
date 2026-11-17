# AGY Report: Lane ux4 — Say only what is true

## Summary of Changes

Implemented truthful gesture guidance and accessible descriptions for the Explore and Start screens:

1. **Gesture Hint Distinction (`frontend/src/i18n/index.ts`)**:
   - Updated `'explore.gestureHint'` to `"Drag one finger to feel the diagram."` across all three supported languages (`en`, `hi`, `gu`):
     - `en`: `"Drag one finger to feel the diagram."`
     - `hi`: `"चित्र महसूस करने के लिए एक उंगली खींचें।"`
     - `gu`: `"આકૃતિ અનુભવવા માટે એક આંગળી ખેંચો."`
   - Added `'explore.gestureHintTalkBack'` containing the pass-through gesture wording:
     - `en`: `"Double-tap and hold, then drag to feel the diagram."`
     - `hi`: `"डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें।"`
     - `gu`: `"ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો."`
   - Maintained strict key parity across `tables.en`, `tables.hi`, and `tables.gu`.
   - Changed zero other keys in the string tables.

2. **Start Screen Subhint (`frontend/src/i18n/index.ts`, `frontend/src/screens/Start.tsx`)**:
   - Updated `'lab.start.subhint'` to `"Touch, sound and speech"` across `en`, `hi`, `gu`:
     - `en`: `"Touch, sound and speech"`
     - `hi`: `"स्पर्श, ध्वनि और वाणी"`
     - `gu`: `"સ્પર્શ, ધ્વનિ અને વાણી"`
   - Updated comment in `frontend/src/screens/Start.tsx` to reflect the updated subhint.

3. **Explore Announcement & Canvas Accessible Description (`frontend/src/flow/navigation.ts`)**:
   - `buildEntryAnnouncement`: Exported pure text builder (alias for `exploreAnnouncement`). Spoken text uses `t('explore.gestureHint')` ("Drag one finger to feel the diagram.") and contains no "double-tap" / "डबल-टैप" / "ડબલ-ટેપ" across any language or diagram mode.
   - `canvasAriaLabel`: Updated to use `t('explore.gestureHintTalkBack')`, ensuring the canvas element that receives TalkBack focus (`aria-label`) continues to read the pass-through double-tap-and-hold instructions.
   - `canvasAriaDescription`: Exported standalone helper returning `t('explore.gestureHintTalkBack')` (or with optional scene title prefix).
   - App's own speech never speaks the TalkBack pass-through wording.

## Files Changed

- `frontend/src/i18n/index.ts`: Updated `explore.gestureHint` and `lab.start.subhint`; added `explore.gestureHintTalkBack` across en, hi, gu.
- `frontend/src/flow/navigation.ts`: Exported `buildEntryAnnouncement`, updated `canvasAriaLabel` to use `explore.gestureHintTalkBack`, exported `canvasAriaDescription`.
- `frontend/src/screens/Start.tsx`: Updated subhint section comment.
- `frontend/tests/navigation.hint.test.ts`: New unit test suite.

## Tests Added

`frontend/tests/navigation.hint.test.ts`:
- String table copy checks for `explore.gestureHint`, `explore.gestureHintTalkBack`, and `lab.start.subhint` in `en`, `hi`, `gu`.
- Negative assertion: `explore.gestureHint` contains no "double-tap", "डबल-टैप", or "ડબલ-ટેપ".
- Negative assertion: `lab.start.subhint` contains no "TalkBack", "टॉकबैक", or "ટોકબેક".
- Key parity check confirming `en`, `hi`, and `gu` string tables have identical keys.
- `buildEntryAnnouncement` and `exploreAnnouncement` verification across `en`, `hi`, `gu` in `ai`, `sample`, `shared`, and `raw` modes: zero occurrences of "double-tap" in any language.
- `canvasAriaLabel` and `canvasAriaDescription` verification in `en`, `hi`, `gu`: correctly carries the TalkBack wording.
- Back navigation policy check (`leaveByBack` from teach and correct to explore): announces `explore.gestureHint`, speaking the single-finger drag instructions rather than double-tap.

## Needs from Kiro

- Existing test `frontend/tests/start.lab.test.tsx` (from lane `lab-startscreen`, not in this lane's ALLOWED list) hardcoded the old subhint copy at line 187 (`expect(html).toContain('टॉकबैक और स्पर्श तैयार')`) and line 219 (`expect(html).toContain('ટોકબેક અને સ્પર્શ તૈયાર')`). These two assertions should be updated to check `t('lab.start.subhint')` or `'स्पर्श, ध्वनि और वाणी'` / `'સ્પર્શ, ધ્વનિ અને વાણી'`.

## What Could Not Be Verified

- Per UX headless run rules, no shell commands (`npm test`, `npm run build`, `tsc`, `git`, etc.) were executed. Verification relies on static inspection, type contract enforcement, and orchestrator gate execution.
