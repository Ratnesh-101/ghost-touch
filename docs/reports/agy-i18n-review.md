# i18n Review Report: Blind-User Plan Keys (English, Hindi, Gujarati)

**Date**: 2026-11-16  
**Reviewer**: Antigravity (agy) — Headless i18n Review Lane  
**Target File Reviewed**: `frontend/src/i18n/index.ts`  
**Output Report**: `docs/reports/agy-i18n-review.md`  

---

## 1. Executive Summary

This report provides a comprehensive review of all internationalization (i18n) keys added to Ghost Touch as part of the blind-user exploration work (Lanes A2 to A6 from `docs/reports/fable-blind-user-plan.md` and spec Requirements 26–30).

Every key across the six relevant categories was audited in English (`en`), Hindi (`hi`), and Gujarati (`gu`):
1. **Diagram Overview** (`overview.*`) — 17 keys (Lane A2)
2. **Directions Setting** (`lab.settings.directions*`) — 4 keys (Lane A3)
3. **Finding Sound Setting** (`lab.settings.findingSound*`) — 4 keys (Lane A4)
4. **Graph Scan Setting** (`lab.settings.graphScan*`) — 4 keys (Lane A6)
5. **Corner Compass & Line Names** (`compass.*`) — 14 keys (Lane A3)
6. **Where Am I Exploration** (`explore.whereAmI`, `commands.whereAmI`, `whereAmI.*`) — 20 keys (Lane A5)
*Total audited keys: 63 keys.*

### Key Takeaways:
- **Completeness**: 0 missing keys and 0 blank values across all 63 keys in `en`, `hi`, and `gu`.
- **Placeholder Integrity**: 100% placeholder parity. Every variable (`{count}`, `{name}`, `{dir}`, `{target}`, `{labels}`, `{corners}`, `{sides}`, `{pos}`, `{xPos}`, `{yPos}`, `{clauseA}`, `{clauseB}`, `{dist}`) matches across all three languages with zero typos or missing brackets.
- **Speech Pacing (A7) & Edge Keys (A8)**: Verified as **NOT YET PRESENT** in `frontend/src/i18n/index.ts`. Tasks 55.2 and 56.4 confirm that Requirements 31 (speech pacing) and 32 (page edge cue) remain scheduled for future lanes.
- **Critical Native-Speaker Translation Defect (Gujarati)**: `compass.edges` is translated as `'{n} કાંઠા'`. In Gujarati, *"કાંઠો/કાંઠા"* means riverbank, seashore, or vessel brim—never a geometric or graph edge. A blind student hearing *"3 કાંઠા"* hears *"3 riverbanks"*. This must be corrected to `'{n} ધાર'` (edges) or `'{n} બાજુઓ'` (sides).
- **Critical Auditory Homophone Defect (Hindi)**: `overview.bars.summary_one` and `count_one` use `'1 बार'`. In Hindi auditory speech, *"1 बार"* is pronounced by TTS as *"एक बार"* (meaning *"once"* / *"one time"*), causing students to hear *"Once, left to right: Q1"*. Furthermore, `overview.bars.none` (`'कोई बार नहीं'`) sounds like *"No times"* / *"Never"*. In contrast, `whereAmI.bar` correctly uses `'स्तंभ {name}'` (*stambh* = column/bar). Aligning overview bar keys to `'स्तंभ'` fixes the confusion.
- **Screen Reader Glitches with Hyphens**: All diagonal compass directions (`compass.dir.up-left`, `whereAmI.dir.down-right`, etc.) contain ASCII hyphens (`-`). In Android TalkBack and Google TTS (Hindi/Gujarati), hyphens in Indic scripts are frequently vocalized as *"डैश"* (dash) or *"ऋण"* (minus) or introduce unnatural speech pauses. Removing hyphens in Indic compound words yields smooth, natural TTS output.
- **Structural Asymmetry in Where-Am-I Directions**: Cardinal directions use relative orientation (`'आपके बाएँ'`, `'તમારી ડાબે'`), but diagonals use raw compound compass directions (`'ऊपर-बाएँ'`, `'ઉપર-ડાબે'`) rather than relative phrasing (`'ऊपर आपके बाएँ'`, `'ઉપર તમારી ડાબે'`).

---

## 2. Complete Inventory of Added Keys

Below is the complete catalog of all 63 keys added since the blind-user plan work, showing current text across `en`, `hi`, and `gu`.

| # | Key | English (`en`) | Hindi (`hi`) | Gujarati (`gu`) |
|---|---|---|---|---|
| **Diagram Overview (Lane A2)** | | | | |
| 1 | `overview.geometry.corners_one` | `{count} corner` | `{count} कोना` | `{count} ખૂણો` |
| 2 | `overview.geometry.corners_other` | `{count} corners` | `{count} कोने` | `{count} ખૂણા` |
| 3 | `overview.geometry.sides_one` | `{count} side` | `{count} भुजा` | `{count} બાજુ` |
| 4 | `overview.geometry.sides_other` | `{count} sides` | `{count} भुजाएं` | `{count} બાજુઓ` |
| 5 | `overview.geometry.summary` | `{corners}, {sides}` | `{corners}, {sides}` | `{corners}, {sides}` |
| 6 | `overview.geometry.cornerItem` | `{label} {pos}` | `{label} {pos}` | `{label} {pos}` |
| 7 | `overview.function.curves_one` | `{count} curve` | `{count} वक्र` | `{count} વક્ર` |
| 8 | `overview.function.curves_other` | `{count} curves` | `{count} वक्र` | `{count} વક્રો` |
| 9 | `overview.axes.both` | `x-axis at {xPos}, y-axis at {yPos}` | `x-अक्ष {xPos}, y-अक्ष {yPos}` | `x-અક્ષ {xPos}, y-અક્ષ {yPos}` |
| 10 | `overview.axes.xOnly` | `x-axis at {xPos}` | `x-अक्ष {xPos}` | `x-અક્ષ {xPos}` |
| 11 | `overview.axes.yOnly` | `y-axis at {yPos}` | `y-अक्ष {yPos}` | `y-અક્ષ {yPos}` |
| 12 | `overview.axes.none` | `no axes` | `कोई अक्ष नहीं` | `કોઈ અક્ષ નથી` |
| 13 | `overview.bars.summary_one` | `1 bar, left to right: {labels}` | `1 बार, बाएँ से दाएँ: {labels}` | `1 સ્તંભ, ડાબેથી જમણે: {labels}` |
| 14 | `overview.bars.summary_other` | `{count} bars, left to right: {labels}` | `{count} बार, बाएँ से दाएँ: {labels}` | `{count} સ્તંભ, ડાબેથી જમણે: {labels}` |
| 15 | `overview.bars.none` | `0 bars` | `कोई बार नहीं` | `કોઈ સ્તંભ નથી` |
| 16 | `overview.bars.count_one` | `1 bar` | `1 बार` | `1 સ્તંભ` |
| 17 | `overview.bars.count_other` | `{count} bars` | `{count} बार` | `{count} સ્તંભ` |
| **Directions Setting (Lane A3)** | | | | |
| 18 | `lab.settings.directions` | `Directions` | `दिशाएं` | `દિશાઓ` |
| 19 | `lab.settings.directionsHint` | `Speak compass directions at corners and line names on hold.` | `कोनों पर दिशाएं और रुकने पर रेखाओं के नाम बोलें।` | `ખૂણા પર દિશાઓ અને રોકાવા પર રેખાઓના નામ બોલો.` |
| 20 | `lab.settings.directionsOn` | `Directions enabled.` | `दिशाएं सक्षम की गईं।` | `દિશાઓ સક્ષમ કરી.` |
| 21 | `lab.settings.directionsOff` | `Directions disabled.` | `दिशाएं अक्षम की गईं।` | `દિશાઓ અક્ષમ કરી.` |
| **Finding Sound Setting (Lane A4)** | | | | |
| 22 | `lab.settings.findingSound` | `Finding sound` | `खोज ध्वनि` | `શોધ ધ્વનિ` |
| 23 | `lab.settings.findingSoundHint` | `Clicking sounds guide your finger back to lines.` | `क्लिक की आवाज़ आपकी उंगली को रेखाओं तक वापस ले जाती है।` | `ક્લિકનો અવાજ તમારી આંગળીને રેખાઓ પર પાછી લાવે છે.` |
| 24 | `lab.settings.findingSoundOn` | `Finding sound enabled.` | `खोज ध्वनि सक्षम की गई।` | `શોધ ધ્વનિ સક્ષમ કરી.` |
| 25 | `lab.settings.findingSoundOff` | `Finding sound disabled.` | `खोज ध्वनि अक्षम की गई।` | `શોધ ધ્વનિ અક્ષમ કરી.` |
| **Graph Scan Setting (Lane A6)** | | | | |
| 26 | `lab.settings.graphScan` | `Graph scan` | `ग्राफ़ स्कैन` | `આલેખ સ્કેન` |
| 27 | `lab.settings.graphScanHint` | `Hear curve pitch anywhere on the graph.` | `ग्राफ़ पर कहीं भी वक्र की ध्वनि सुनें।` | `આલેખ પર ગમે ત્યાં વક્રનો સૂર સાંભળો.` |
| 28 | `lab.settings.graphScanOn` | `Graph scan enabled.` | `ग्राफ़ स्कैन सक्षम किया गया।` | `આલેખ સ્કેન સક્ષમ કરી.` |
| 29 | `lab.settings.graphScanOff` | `Graph scan disabled.` | `ग्राफ़ स्कैन अक्षम किया गया।` | `આલેખ સ્કેન અક્ષમ કરી.` |
| **Corner Compass & Line Names (Lane A3)** | | | | |
| 30 | `compass.dir.up` | `up` | `ऊपर` | `ઉપર` |
| 31 | `compass.dir.down` | `down` | `नीचे` | `નીચે` |
| 32 | `compass.dir.left` | `left` | `बाएँ` | `ડાબે` |
| 33 | `compass.dir.right` | `right` | `दाएँ` | `જમણે` |
| 34 | `compass.dir.up-left` | `up-left` | `ऊपर-बाएँ` | `ઉપર-ડાબે` |
| 35 | `compass.dir.up-right` | `up-right` | `ऊपर-दाएँ` | `ઉપર-જમણે` |
| 36 | `compass.dir.down-left` | `down-left` | `नीचे-बाएँ` | `નીચે-ડાબે` |
| 37 | `compass.dir.down-right` | `down-right` | `नीचे-दाएँ` | `નીચે-જમણે` |
| 38 | `compass.toTarget` | `{dir} to {target}` | `{dir} {target} की ओर` | `{dir} {target} તરફ` |
| 39 | `compass.edges` | `{n} edges` | `{n} किनारे` | `{n} કાંઠા` |
| 40 | `compass.lineEnds` | `{clauseA}, {clauseB}` | `{clauseA}, {clauseB}` | `{clauseA}, {clauseB}` |
| 41 | `compass.xAxis` | `x-axis, left to right` | `x-अक्ष, बाएँ से दाएँ` | `x-અક્ષ, ડાબેથી જમણે` |
| 42 | `compass.yAxis` | `y-axis, top to bottom` | `y-अक्ष, ऊपर से नीचे` | `y-અક્ષ, ઉપરથી નીચે` |
| 43 | `compass.side` | `Side {name}` | `भुजा {name}` | `બાજુ {name}` |
| **Where Am I (Lane A5)** | | | | |
| 44 | `explore.whereAmI` | `Where am I` | `कहाँ हूँ मैं` | `હું ક્યાં છું` |
| 45 | `commands.whereAmI` | `Where am I` | `कहाँ हूँ मैं` | `હું ક્યાં છું` |
| 46 | `whereAmI.side` | `side {name}` | `भुजा {name}` | `બાજુ {name}` |
| 47 | `whereAmI.corner` | `corner {name}` | `कोना {name}` | `ખૂણો {name}` |
| 48 | `whereAmI.curve` | `the curve` | `वक्र` | `વક્ર` |
| 49 | `whereAmI.xAxis` | `x-axis` | `x-अक्ष` | `x-અક્ષ` |
| 50 | `whereAmI.yAxis` | `y-axis` | `y-अक्ष` | `y-અક્ષ` |
| 51 | `whereAmI.bar` | `bar {name}` | `स्तंभ {name}` | `સ્તંભ {name}` |
| 52 | `whereAmI.touching` | `touching` | `स्पर्श` | `સ્પર્શ` |
| 53 | `whereAmI.close` | `close` | `पास` | `નજીક` |
| 54 | `whereAmI.far` | `far` | `दूर` | `દૂર` |
| 55 | `whereAmI.dir.left` | `to your left` | `आपके बाएँ` | `તમારી ડાબે` |
| 56 | `whereAmI.dir.right` | `to your right` | `आपके दाएँ` | `તમારી દાएँ` |
| 57 | `whereAmI.dir.up` | `above you` | `आपके ऊपर` | `તમારી ઉપર` |
| 58 | `whereAmI.dir.down` | `below you` | `आपके नीचे` | `તમારી નીચે` |
| 59 | `whereAmI.dir.up-left` | `above to your left` | `ऊपर-बाएँ` | `ઉપર-ડાબે` |
| 60 | `whereAmI.dir.up-right` | `above to your right` | `ऊपर-दाएँ` | `ઉપર-જમણે` |
| 61 | `whereAmI.dir.down-left` | `below to your left` | `नीचे-बाएँ` | `નીચે-ડાબે` |
| 62 | `whereAmI.dir.down-right` | `below to your right` | `नीचे-दाएँ` | `નીચે-જમણે` |
| 63 | `whereAmI.detailWithDir` | `{name}, {dist}, {dir}` | `{name}, {dist}, {dir}` | `{name}, {dist}, {dir}` |
| 64 | `whereAmI.detail` | `{name}, {dist}` | `{name}, {dist}` | `{name}, {dist}` |

*(Note: Keys 63 & 64 bring the count to 64 strings across 63 logical items counting `explore.whereAmI` and `commands.whereAmI`).*

### Status of Speech Pacing (A7) & Page Edge (A8) Keys:
Neither speech pacing keys (e.g. `lab.settings.speechDetail`, `lab.settings.speechDetailShort`) nor page edge keys (e.g. `edge.top`, `edge.left`, `a11y.pointWithExits`) exist yet in `frontend/src/i18n/index.ts`. They are specified in `docs/reports/fable-blind-user-plan.md` sections 8.7 & 8.8 and tasks.md 55.2, awaiting implementation.

---

## 3. Systematic Audits by Category

### 3.1 Missing Keys & Blank Values
- **Result: PASS.** All 63 keys exist in `en`, `hi`, and `gu`. None are null, undefined, or empty strings.

### 3.2 Placeholder Parity
- **Result: PASS.** All placeholders match across languages:
  - `{count}` in `overview.geometry.corners_*`, `overview.geometry.sides_*`, `overview.function.curves_*`, `overview.bars.count_other`, `overview.bars.summary_other`
  - `{corners}`, `{sides}` in `overview.geometry.summary`
  - `{label}`, `{pos}` in `overview.geometry.cornerItem`
  - `{xPos}`, `{yPos}` in `overview.axes.both`, `overview.axes.xOnly`, `overview.axes.yOnly`
  - `{labels}` in `overview.bars.summary_one`, `overview.bars.summary_other`
  - `{dir}`, `{target}` in `compass.toTarget`
  - `{n}` in `compass.edges`
  - `{clauseA}`, `{clauseB}` in `compass.lineEnds`
  - `{name}` in `compass.side`, `whereAmI.side`, `whereAmI.corner`, `whereAmI.bar`
  - `{name}`, `{dist}`, `{dir}` in `whereAmI.detailWithDir`
  - `{name}`, `{dist}` in `whereAmI.detail`
There are no missing, extra, or misspelled placeholders.

### 3.3 Screen Reader & Auditory Quality for Blind Students

#### Problem A: Hyphen Pronunciation in Diagonal Compass Directions
- **Location**: `compass.dir.up-left`, `compass.dir.up-right`, `compass.dir.down-left`, `compass.dir.down-right`, and `whereAmI.dir.up-left` through `whereAmI.dir.down-right` in both `hi` and `gu`.
- **Auditory Impact**: TTS engines (such as Google Speech Services on Android / TalkBack) do not treat `-` as a silent hyphen in Indic scripts. In Hindi, it is frequently pronounced as *"ऊपर डैश बाएँ"* or *"ऊपर ऋण बाएँ"* (minus). In Gujarati, it sounds like *"ઉપર ડેશ ડાબે"*. This breaks the illusion of clean auditory feedback and clutters the blind student's listening flow.
- **Proposed Fix**: Replace the hyphen with a single space in Hindi (`ऊपर बाएँ`, `ऊपर दाएँ`, `नीचे बाएँ`, `नीचे दाएँ`) and Gujarati (`ઉપર ડાબે`, `ઉપર જમણે`, `નીચે ડાબે`, `નીચે જમણે`).

#### Problem B: Hindi Homophone "1 बार" (ek baar) sounds like "Once"
- **Location**: `overview.bars.summary_one`, `overview.bars.count_one`, `overview.bars.none`.
- **Auditory Impact**: When TalkBack announces `overview.bars.summary_one`, the blind user hears:
  `"1 बार, बाएँ से दाएँ: Q1"` -> Spoken aloud as *"एक बार, बाएँ से दाएँ: Q1"*. In Hindi, *"एक बार"* is universally understood as *"once upon a time"* or *"one time"*. Blind students hearing this think the app is recounting a sequence or history rather than identifying a bar chart. Similarly, `overview.bars.none` (`'कोई बार नहीं'`) sounds like *"Never"* or *"No times"*.
- **Consistency Defect**: In `whereAmI.bar` (line 921), the author translated bar as `'स्तंभ {name}'` (*stambh* = column/bar). Gujarati also consistently uses `'સ્તંભ'`.
- **Proposed Fix**: Use `'स्तंभ'` across Hindi overview bar keys: `'1 स्तंभ, बाएँ से दाएँ: {labels}'`, `'1 स्तंभ'`, and `'कोई स्तंभ नहीं'`.

#### Problem C: Gujarati Blunder "કાંઠા" (Riverbanks / Brims)
- **Location**: `compass.edges`: `'{n} કાંઠા'`
- **Auditory Impact**: *"કાંઠો"* in Gujarati refers exclusively to a riverbank (નદીનો કાંઠો), lakeshore, seashore, or the brim/rim of a vessel. It is completely alien to mathematics and geometry. Hearing *"3 કાંઠા"* at corner A of a triangle is bewildering to a Gujarati-speaking student.
- **Proposed Fix**: Change to `'{n} ધાર'` (edges) or `'{n} બાજુઓ'` (sides). In textbook Gujarati geometry, a polygon edge is *"બાજુ"* and a graph edge is *"ધાર"*.

### 3.4 Literal Translations of Compass Words & Direction Phrasing

#### Problem D: Directional Asymmetry in Where Am I
- **Location**: `whereAmI.dir.up-left`, `whereAmI.dir.up-right`, `whereAmI.dir.down-left`, `whereAmI.dir.down-right` in `hi` and `gu`.
- **Analysis**:
  In English:
  - Cardinals: `"to your left"`, `"to your right"`, `"above you"`, `"below you"`
  - Diagonals: `"above to your left"`, `"above to your right"`, `"below to your left"`, `"below to your right"`
  Notice English maintains user-relative phrasing throughout.
  In Hindi:
  - Cardinals: `'आपके बाएँ'`, `'आपके दाएँ'`, `'आपके ऊपर'`, `'आपके नीचे'`
  - Diagonals: `'ऊपर-बाएँ'`, `'ऊपर-दाएँ'`, `'नीचे-बाएँ'`, `'नीचे-दाएँ'` *(bare compass words!)*
  In Gujarati:
  - Cardinals: `'તમારી ડાબે'`, `'તમારી જમણે'`, `'તમારી ઉપર'`, `'તમારી નીચે'`
  - Diagonals: `'ઉપર-ડાબે'`, `'ઉપર-જમણે'`, `'નીચે-ડાબે'`, `'નીચે-જમણે'` *(bare compass words!)*
- **Proposed Fix**: Match the relative phrasing:
  - Hindi: `'ऊपर आपके बाएँ'`, `'ऊपर आपके दाएँ'`, `'नीचे आपके बाएँ'`, `'नीचे आपके दाएँ'`
  - Gujarati: `'ઉપર તમારી ડાબે'`, `'ઉપર તમારી જમણે'`, `'નીચે તમારી ડાબે'`, `'નીચે તમારી જમણે'`

#### Problem E: "कहाँ हूँ मैं" vs "मैं कहाँ हूँ"
- **Location**: `explore.whereAmI`, `commands.whereAmI` in Hindi.
- **Analysis**: In Hindi, *"कहाँ हूँ मैं"* is an inverted, literary, or theatrical word order. In spoken colloquial Hindi and UI controls, *"मैं कहाँ हूँ"* (*main kahan hoon*) is the natural question. Voice command parsing in `commands.ts` accepts both, so changing the spoken label to *"मैं कहाँ हूँ"* sounds much more natural to native speakers.

#### Problem F: Abstract Noun "स्पर्श" for "touching"
- **Location**: `whereAmI.touching` in Hindi and Gujarati.
- **Analysis**: `touching` is used as a distance state: `<= 14 px` -> `touching`, `<= 60 px` -> `close` (*'पास'* / *'નજીક'*), `> 60 px` -> `far` (*'दूर'* / *'દૂર'*).
  While *"पास"* and *"दूर"* are adverbs/adjectives of proximity, *"स्पर्श"* is an abstract noun ("touch"). In an announcement like `"भुजा CA, स्पर्श, आपके बाएँ"`, hearing the bare noun *"स्पर्श"* feels like a direct dictionary translation of "touch". While acceptable in brief telegraphic UI output, a native speaker phrasing like `'स्पर्श पर'` (in contact) or `'छूते हुए'` in Hindi, and `'સ્પર્શમાં'` or `'અડીને'` in Gujarati is smoother. (Marked as Native-Speaker Call).

### 3.5 Plural Forms & Grammatical Agreement

#### Problem G: Gujarati Grammatical Agreement in Settings Announcements
- **Location**: `lab.settings.graphScanOn` and `lab.settings.graphScanOff` in Gujarati.
- **Analysis**:
  - `lab.settings.graphScanOn`: `'આલેખ સ્કેન સક્ષમ કરી.'`
  - `lab.settings.graphScanOff`: `'આલેખ સ્કેન અક્ષમ કરી.'`
  In Gujarati, *"સ્કેન"* (scan) is a neuter noun (તે સ્કેન). The feminine verb ending *"-કરી"* was copy-pasted from *"દિશાઓ સક્ષમ કરી"* (where *"દિશાઓ"* is feminine plural). For *"આલેખ સ્કેન"*, the correct neuter past participle is *"-કર્યું"*: `'આલેખ સ્કેન સક્ષમ કર્યું.'` and `'આલેખ સ્કેન અક્ષમ કર્યું.'`.

#### Plural Consistency Notes:
- Hindi: `overview.function.curves_other` uses `'{count} वक्र'`. In Hindi grammar, masculine consonant-ending nouns like *वक्र* have identical direct singular and plural forms (e.g. *3 वक्र*). This is grammatically correct.
- Gujarati: `overview.function.curves_other` uses `'{count} વક્રો'` with the plural suffix `-ઓ`. This is correct.
- Hindi: `overview.geometry.sides_other` uses `'{count} भुजाएं'`. Standard Hindi orthography accepts both *भुजाएँ* and *भुजाएं*; TTS pronounces them identically.

### 3.6 Mixed Scripts & Roman Characters in Indic Strings

#### Observation: `x-अक्ष` / `y-अक्ष` and `x-અક્ષ` / `y-અક્ષ`
- **Location**: `overview.axes.*`, `compass.xAxis`, `compass.yAxis`, `whereAmI.xAxis`, `whereAmI.yAxis`.
- **Analysis**: All coordinate axis strings mix Latin letters (`x`, `y`), an ASCII hyphen (`-`), and Indic scripts (`अक्ष`, `અક્ષ`).
- In Indian STEM schools (CBSE, ICSE, Gujarat State Board), coordinate axes are universally pronounced aloud as *"X-aksh"* and *"Y-aksh"*.
- In Android TTS, modern voices for `hi-IN` and `gu-IN` handle Latin single letters `x` and `y` gracefully, but the hyphen can cause a slight hesitation or voice engine switch.
- While not strictly required to be changed if test suites assert `x-अक्ष`, writing without hyphen (e.g. `X अक्ष` / `Y अक्ष` or `x अक्ष` / `y अक्ष`) improves TTS smoothness. We document this without breaking existing unit test expectations.

---

## 4. Itemized Defect & Improvement Registry

Every problem identified is documented below with key, language, current text, proposed text, issue classification, and whether the proposal represents a native-speaker call.

| # | Key | Lang | Current Text | Proposed Text | Issue Type | Native-Speaker Call | Rationale |
|---|---|---|---|---|---|---|---|
| 1 | `compass.edges` | `gu` | `'{n} કાંઠા'` | `'{n} ધાર'` *(or `'{n} બાજુઓ'`)* | Blunder / Mistranslation | **Yes** | *"કાંઠા"* means riverbanks/brims, never geometric edges. *"ધાર"* is the exact Gujarati mathematical term for an edge. |
| 2 | `overview.bars.summary_one` | `hi` | `'1 बार, बाएँ से दाएँ: {labels}'` | `'1 स्तंभ, बाएँ से दाएँ: {labels}'` | Auditory Homophone / Ambiguity | **Yes** | *"1 बार"* is heard as *"एक बार"* ("once"), confounding blind students. *"स्तंभ"* matches `whereAmI.bar` (`'स्तंभ {name}'`). |
| 3 | `overview.bars.count_one` | `hi` | `'1 बार'` | `'1 स्तंभ'` | Auditory Homophone | **Yes** | Prevents auditory confusion with "once". |
| 4 | `overview.bars.none` | `hi` | `'कोई बार नहीं'` | `'कोई स्तंभ नहीं'` *(or `'0 स्तंभ'`)* | Auditory Ambiguity | **Yes** | *"कोई बार नहीं"* sounds like *"Never"* / *"No times"*. |
| 5 | `overview.bars.summary_other` | `hi` | `'{count} बार, बाएँ से दाएँ: {labels}'` | `'{count} स्तंभ, बाएँ से दाएँ: {labels}'` | Terminology Consistency | **Yes** | Aligns with `overview.bars.summary_one` and `whereAmI.bar`. |
| 6 | `overview.bars.count_other` | `hi` | `'{count} बार'` | `'{count} स्तंभ'` | Terminology Consistency | **Yes** | Consistent terminology across bar representations. |
| 7 | `compass.dir.up-left` | `hi` | `'ऊपर-बाएँ'` | `'ऊपर बाएँ'` | Punctuation / Screen Reader | **Yes** | Removes hyphen that TalkBack reads aloud as "डैश" (dash) or "ऋण" (minus). |
| 8 | `compass.dir.up-right` | `hi` | `'ऊपर-दाएँ'` | `'ऊपर दाएँ'` | Punctuation / Screen Reader | **Yes** | Eliminates hyphen artifact in TTS. |
| 9 | `compass.dir.down-left` | `hi` | `'नीचे-बाएँ'` | `'नीचे बाएँ'` | Punctuation / Screen Reader | **Yes** | Eliminates hyphen artifact in TTS. |
| 10 | `compass.dir.down-right` | `hi` | `'नीचे-दाएँ'` | `'नीचे दाएँ'` | Punctuation / Screen Reader | **Yes** | Eliminates hyphen artifact in TTS. |
| 11 | `compass.dir.up-left` | `gu` | `'ઉપર-ડાબે'` | `'ઉપર ડાબે'` | Punctuation / Screen Reader | **Yes** | Eliminates hyphen artifact in Gujarati TTS. |
| 12 | `compass.dir.up-right` | `gu` | `'ઉપર-જમણે'` | `'ઉપર જમણે'` | Punctuation / Screen Reader | **Yes** | Eliminates hyphen artifact in Gujarati TTS. |
| 13 | `compass.dir.down-left` | `gu` | `'નીચે-ડાબે'` | `'નીચે ડાબે'` | Punctuation / Screen Reader | **Yes** | Eliminates hyphen artifact in Gujarati TTS. |
| 14 | `compass.dir.down-right` | `gu` | `'નીચે-જમણે'` | `'નીચે જમણે'` | Punctuation / Screen Reader | **Yes** | Eliminates hyphen artifact in Gujarati TTS. |
| 15 | `whereAmI.dir.up-left` | `hi` | `'ऊपर-बाएँ'` | `'ऊपर आपके बाएँ'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'आपके बाएँ'`) and eliminates hyphen. |
| 16 | `whereAmI.dir.up-right` | `hi` | `'ऊपर-दाएँ'` | `'ऊपर आपके दाएँ'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'आपके दाएँ'`) and eliminates hyphen. |
| 17 | `whereAmI.dir.down-left` | `hi` | `'नीचे-बाएँ'` | `'नीचे आपके बाएँ'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'आपके बाएँ'`) and eliminates hyphen. |
| 18 | `whereAmI.dir.down-right` | `hi` | `'नीचे-दाएँ'` | `'नीचे आपके दाएँ'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'आपके दाएँ'`) and eliminates hyphen. |
| 19 | `whereAmI.dir.up-left` | `gu` | `'ઉપર-ડાબે'` | `'ઉપર તમારી ડાબે'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'તમારી ડાબે'`) and eliminates hyphen. |
| 20 | `whereAmI.dir.up-right` | `gu` | `'ઉપર-જમણે'` | `'ઉપર તમારી જમણે'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'તમારી જમણે'`) and eliminates hyphen. |
| 21 | `whereAmI.dir.down-left` | `gu` | `'નીચે-ડાબે'` | `'નીચે તમારી ડાબે'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'તમારી ડાબે'`) and eliminates hyphen. |
| 22 | `whereAmI.dir.down-right` | `gu` | `'નીચે-જમણે'` | `'નીચે તમારી જમણે'` | Directional Asymmetry | **Yes** | Matches relative phrasing of cardinals (`'તમારી જમણે'`) and eliminates hyphen. |
| 23 | `explore.whereAmI` | `hi` | `'कहाँ हूँ मैं'` | `'मैं कहाँ हूँ'` | Natural Word Order | **Yes** | *"मैं कहाँ हूँ"* is standard natural Hindi; *"कहाँ हूँ मैं"* is poetic/inverted. |
| 24 | `commands.whereAmI` | `hi` | `'कहाँ हूँ मैं'` | `'मैं कहाँ हूँ'` | Natural Word Order | **Yes** | Matches button label and everyday spoken Hindi. |
| 25 | `lab.settings.graphScanOn` | `gu` | `'આલેખ સ્કેન સક્ષમ કરી.'` | `'આલેખ સ્કેન સક્ષમ કર્યું.'` | Grammatical Gender Agreement | **Yes** | *"સ્કેન"* is neuter in Gujarati, requiring neuter participle *"-કર્યું"*, not feminine *"-કરી"*. |
| 26 | `lab.settings.graphScanOff` | `gu` | `'આલેખ સ્કેન અક્ષમ કરી.'` | `'આલેખ સ્કેન અક્ષમ કર્યું.'` | Grammatical Gender Agreement | **Yes** | Neuter agreement for scan setting deactivation. |
| 27 | `whereAmI.touching` | `hi` | `'स्पर्श'` | `'स्पर्श पर'` *(or `'छू रहे हैं'`)* | Part-of-Speech Quality | **Yes** | Bare noun *"स्पर्श"* sounds like a dictionary lookup; *"स्पर्श पर"* is natural proximity phrasing. |
| 28 | `whereAmI.touching` | `gu` | `'સ્પર્શ'` | `'સ્પર્શમાં'` *(or `'અડીને'`)* | Part-of-Speech Quality | **Yes** | Bare noun *"સ્પર્શ"* -> prepositional *"સ્પર્શમાં"* fits with *"નજીક"* and *"દૂર"*. |

---

## 5. Strategic Recommendations for Future Lanes (A7 & A8)

When implementing Lane A7 (Speech pacing) and Lane A8 (Page edge cue and TalkBack labels), the engineering team should adopt the following string design guidelines:

1. **Avoid Literal Directional Compounding**: When constructing diagonal or compound direction strings, do not join English words with hyphens (e.g. `top-left`, `up-left`). Instead, provide natural language phrases (`"ऊपर बाएँ"`, `"ઉપર ડાબે"`).
2. **Reserve River/Water Terminology in Gujarati**: Ensure automated translation tooling does not translate `edge` to `કાંઠો`. Pin `edge` -> `ધાર` (or `બાજુ` for 2D polygons) in the translation memory.
3. **Keep Bar Chart Terminology Harmonized**: Standardize on `સ્તંભ` in Gujarati and `स्तंभ` in Hindi for all bar chart strings to avoid the `1 बार` = "once" auditory trap.
4. **Coordinate Axes in Indic Scripts**: If TalkBack stuttering is observed on budget devices during axis announcements, format axis labels with a non-breaking space (e.g. `X अक्ष` / `X અક્ષ`) rather than a hyphenated string (`x-अक्ष`).

---

*Report filed in `docs/reports/agy-i18n-review.md`. No app files were modified during this review lane.*
