# Lane g4-semantic-voice Report

**Tool:** Antigravity (`agy`, headless run)  
**Lane:** `g4-semantic-voice`  
**Status:** Completed  
**Attribution:** Built by agy, reviewed by Claude

---

## 1. Goal & Context

- **Goal:** Semantic voice targets for Guide, pure and tested.
- **Context:** Voice commands "find \<label\>" / "take me to \<label\>" previously only resolved labelled elements, so "find the peak" did not work (known limitation).
- **Core function:** `resolveSemantic(scene: DiagramScene, name: SemanticName): ResolvedTarget | null`
  - Semantic names: `'peak' | 'trough' | 'origin' | 'tallestBar' | 'shortestBar' | 'rightAngle' | 'longestSide'`
  - Fall-through: When guide is inactive, phrases fall through to unrecognized command (same as existing guide commands).
  - Negative feedback: When active but no target matches, speaks plain "no X in this diagram" (`guide.semantic.none.<name>`) in ONE speak call.
  - Success feedback: Starts guide towards resolved target with announcement "Guiding to {label}." (`guide.start`).

---

## 2. Specification Compliance (`docs/briefs/semantic-targets-spec.md`)

| Name | Applies To | Definition | Target Returned | Handled by |
|---|---|---|---|---|
| `peak` | any polyline | Smallest y across all polyline vertices; ties: first in document order | point `{x, y}`, label "peak" | `resolveSemantic(scene, 'peak')` |
| `trough` | any polyline | Largest y across all polyline vertices; ties: first in document order | point `{x, y}`, label "lowest point" | `resolveSemantic(scene, 'trough')` |
| `origin` | scene.axes with non-null `x_axis_y` and `y_axis_x` | Point `(y_axis_x, x_axis_y)` | point `{x, y}`, label "origin" | `resolveSemantic(scene, 'origin')` |
| `tallestBar` | bars | Bar with max `value`; ties: first in document order | element `{elementId: bar.id}` | `resolveSemantic(scene, 'tallestBar')` |
| `shortestBar` | bars | Bar with min `value`; ties: first in document order | element `{elementId: bar.id}` | `resolveSemantic(scene, 'shortestBar')` |
| `rightAngle` | points + segments | Point with exactly two incident segments whose angle at that point is within 90 +/- 3 degrees; ties: first in document order | element `{elementId: point.id}` | `resolveSemantic(scene, 'rightAngle')` |
| `longestSide` | segments | Segment with max Euclidean length; ties: first in document order | element `{elementId: segment.id}` | `resolveSemantic(scene, 'longestSide')` |

---

## 3. Chosen Phrases List (English, Hindi, Gujarati)

Every phrase chosen and matched by `matchSemanticPhrase`:

### English (`en`):
- **peak:** `peak`, `the peak`, `highest point`, `the highest point`, `maximum`, `the maximum`, `top of the curve`, `top of curve`, `the top of the curve`, `the top of curve`, `highest vertex`
- **trough:** `lowest point`, `the lowest point`, `minimum`, `the minimum`, `trough`, `the trough`, `bottom of the curve`, `bottom of curve`, `the bottom of the curve`, `the bottom of curve`, `lowest vertex`
- **origin:** `origin`, `the origin`, `where the axes cross`, `where axes cross`, `where the axis cross`, `where axis cross`, `axes cross`, `axis cross`, `axes crossing`, `axis crossing`
- **tallestBar:** `tallest bar`, `the tallest bar`, `highest bar`, `the highest bar`, `biggest bar`, `the biggest bar`, `maximum bar`, `the maximum bar`, `max bar`, `largest bar`
- **shortestBar:** `shortest bar`, `the shortest bar`, `smallest bar`, `the smallest bar`, `lowest bar`, `the lowest bar`, `minimum bar`, `min bar`
- **rightAngle:** `right angle`, `the right angle`, `right corner`, `the right corner`, `90 degree angle`, `90 degrees angle`
- **longestSide:** `longest side`, `the longest side`, `longest segment`, `longest line`, `biggest side`
- *Prefixes automatically handled:* `find ...`, `take me to ...`, `guide me to ...`, `guide to ...`, `go to ...`, `where is ...`, `show me ...`

### Hindi (`hi`):
- **peak:** `शिखर`, `सबसे ऊँचा बिंदु`, `सबसे ऊंचा बिंदु`, `अधिकतम`, `अधिकतम बिंदु`, `वक्र का शीर्ष`, `वक्र का सबसे ऊँचा बिंदु`, `वक्र का सबसे ऊंचा बिंदु`, `वक्र की चोटी`
- **trough:** `न्यूनतम बिंदु`, `सबसे निचला बिंदु`, `न्यूनतम`, `गर्त`, `वक्र का तल`, `वक्र का सबसे निचला बिंदु`
- **origin:** `मूल बिंदु`, `उद्गम बिंदु`, `उद्गम`, `जहां अक्ष मिलते हैं`, `जहाँ अक्ष मिलते हैं`, `जहां अक्ष काटते हैं`, `जहाँ अक्ष काटते हैं`, `अक्ष मिलन`
- **tallestBar:** `सबसे ऊँचा बार`, `सबसे ऊंचा बार`, `सबसे बड़ा बार`, `उच्चतम बार`, `सबसे ऊँचा स्तंभ`, `सबसे ऊंचा स्तंभ`, `सबसे बड़ा स्तंभ`
- **shortestBar:** `सबसे छोटा बार`, `सबसे निचला बार`, `सबसे लघु बार`, `सबसे छोटा स्तंभ`
- **rightAngle:** `समकोण`, `नब्बे अंश का कोण`, `90 अंश का कोण`, `90 डिग्री का कोण`
- **longestSide:** `सबसे लंबी भुजा`, `सबसे लंबा किनारा`, `सबसे बड़ी भुजा`
- *Prefixes & suffixes automatically handled:* `मुझे ... पर ले चलो`, `... पर ले जाओ`, `... खोजें`, `... ढूंढें`, `... ढूंढो`, `... दिखाओ`, `... बताओ`, `... कहाँ है`

### Gujarati (`gu`):
- **peak:** `શિખર`, `સૌથી ઊંચો બિંદુ`, `સૌથી ઊંચું બિંદુ`, `મહત્તમ`, `મહત્તમ બિંદુ`, `વળાંકની ટોચ`
- **trough:** `સૌથી નીચો બિંદુ`, `સૌથી નીચું બિંદુ`, `ન્યૂનતમ`, `ન્યૂનતમ બિંદુ`, `ગર્ત`, `ખાડો`, `વળાંકનું તળિયું`
- **origin:** `ઉદ્ભવ બિંદુ`, `મૂળ બિંદુ`, `જ્યાં ધરીઓ મળે છે`, `જ્યાં અક્ષો મળે છે`, `ધરીઓનું છેદન બિંદુ`
- **tallestBar:** `સૌથી ઊંચો બાર`, `સૌથી મોટો બાર`, `સૌથી ઊંચો સ્તંભ`, `સૌથી મોટો સ્તંભ`
- **shortestBar:** `સૌથી ટૂંકો બાર`, `સૌથી ટૂંકી બાર`, `સૌથી નાનો બાર`, `સૌથી ટૂંકો સ્તંભ`, `સૌથી નાનો સ્તંભ`
- **rightAngle:** `કાટખૂણો`, `કાટકોણ`, `90 ડિગ્રીનો ખૂણો`, `નેવું અંશનો ખૂણો`
- **longestSide:** `સૌથી લાંબી બાજુ`, `સૌથી મોટો કાંઠો`
- *Prefixes & suffixes automatically handled:* `મને ... પર લઈ જાઓ`, `... શોધો`, `... બતાવો`, `... ક્યાં છે`

All phrases were appended to `docs/user-test/translation-review.md` and `docs/user-test/translation-review.csv` under Section 20.

---

## 4. Negative Spoken Feedback Keys (`guide.semantic.none.*`)

Added to `frontend/src/i18n/index.ts` across English, Hindi, and Gujarati:
- `guide.semantic.none.peak`:
  - `en`: `"There is no peak in this diagram."`
  - `hi`: `"इस आरेख में कोई शिखर नहीं है।"`
  - `gu`: `"આ આકૃતિમાં કોઈ શિખર નથી."`
- `guide.semantic.none.trough`:
  - `en`: `"There is no lowest point in this diagram."`
  - `hi`: `"इस आरेख में कोई न्यूनतम बिंदु नहीं है।"`
  - `gu`: `"આ આકૃતિમાં કોઈ સૌથી નીચો બિંદુ નથી."`
- `guide.semantic.none.origin`:
  - `en`: `"There is no origin in this diagram."`
  - `hi`: `"इस आरेख में कोई मूल बिंदु नहीं है।"`
  - `gu`: `"આ આકૃતિમાં કોઈ ઉદ્ભવ બિંદુ નથી."`
- `guide.semantic.none.tallestBar`:
  - `en`: `"There is no tallest bar in this diagram."`
  - `hi`: `"इस आरेख में कोई सबसे ऊँचा बार नहीं है।"`
  - `gu`: `"આ આકૃતિમાં કોઈ સૌથી ઊંચો બાર નથી."`
- `guide.semantic.none.shortestBar`:
  - `en`: `"There is no shortest bar in this diagram."`
  - `hi`: `"इस आरेख में कोई सबसे छोटा बार नहीं है।"`
  - `gu`: `"આ આકૃતિમાં કોઈ સૌથી નાનો બાર નથી."`
- `guide.semantic.none.rightAngle`:
  - `en`: `"There is no right angle in this diagram."`
  - `hi`: `"इस आरेख में कोई समकोण नहीं है।"`
  - `gu`: `"આ આકૃતિમાં કોઈ કાટખૂણો નથી."`
- `guide.semantic.none.longestSide`:
  - `en`: `"There is no longest side in this diagram."`
  - `hi`: `"इस आरेख में कोई सबसे लंबी भुजा नहीं है।"`
  - `gu`: `"આ આકૃતિમાં કોઈ સૌથી લાંબી બાજુ નથી."`

---

## 5. Files Touched

- `frontend/src/guide/semantic.ts` (new): pure resolver and multi-lingual phrase parser
- `frontend/src/guide/index.ts`: re-exports `resolveSemantic`, `matchSemanticPhrase`, `normalizeSemanticInput`, `SEMANTIC_NAMES`, `SemanticName`
- `frontend/src/flow/commands.ts`: integrates `guide_semantic` commands, flag gating, and single-utterance speech feedback
- `frontend/src/i18n/index.ts`: adds 7 new negative-feedback keys in en, hi, and gu (strict 100% key parity)
- `frontend/tests/guide.semantic.unit.test.ts` (new): 19 unit & acceptance tests across bundled fixtures, tie-breaking, non-matches, en/hi/gu parsing, flag-off fall-through, and speech execution
- `frontend/tests/guide.semantic.prop.test.ts` (new): 7 fast-check property tests (>= 200 runs each) proving mathematical properties, strict angular tolerance, and phrase matcher totality
- `docs/PHONE_TEST.md`: Step 13.5 updated to verify semantic targets and remove the limitation note
- `docs/user-test/translation-review.md` & `docs/user-test/translation-review.csv`: appended Section 20 with all 7 keys and voice command trigger phrases
- `docs/reports/agy-g4-semantic-voice-report.md`: this report
- `docs/BUILD_LOG.md`: added entry for Lane g4-semantic-voice

---

## 6. Verification Results & DoD Proof

### 1. TypeScript Check
Command: `npm --prefix frontend exec -- tsc -p frontend --noEmit`
Result: Clean exit code 0. Zero errors across all project and test files.

### 2. Frontend Test Suite
Command: `npm --prefix frontend test`
Result:
- Test Files: 107 passed (was 105; +2 new test files)
- Tests: 1459 passed (was 1420; +39 new tests)
- Duration: 1.86s
- Regressions: 0

### 3. Production Build
Command: `npm --prefix frontend run build`
Result:
- Build: Vite client built in 182ms (128 modules transformed)
- Bundle: JS 486.52 kB (gzip: 140.74 kB), CSS 73.20 kB (gzip: 11.46 kB)
- PWA: Service worker generated cleanly with 22 precached entries (651.87 KiB)

### 4. Git Status and Ownership Quarantine
Command: `git status --short`
Result: Touched only allowed files listed in brief. Zero lines changed in `core/`, zero backend changes, zero `.env*` or `.kiro/**` edits.
