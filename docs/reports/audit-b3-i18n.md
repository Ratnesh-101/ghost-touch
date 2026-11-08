# Audit Report: Lane b3-i18n (Internationalisation: English, Hindi, Gujarati)

**Auditor:** Antigravity (agy, reviewed by Claude)  
**Date:** 2026-11-08  
**Scope:** Frontend (`frontend/src/i18n*`, screens, drivers/speech), backend Ask / semantic paths, `docs/user-test/translation-review.*`.  
**Rules:** Audit only. No source, test, config, or doc changes except this report and `docs/BUILD_LOG.md`.  
**Status:** DONE  

---

## Executive Summary

This comprehensive internationalisation audit evaluated the multilingual implementation of Ghost Touch across English (`en`), Hindi (`hi`), and Gujarati (`gu`). Ghost Touch's architecture correctly establishes a centralised string dictionary pattern (`frontend/src/i18n/index.ts`), strict BCP-47 language tag mappings (`LANG_BCP47`), and runtime voice matching heuristics with prefix fallbacks (`frontend/src/drivers/speech.ts`).

### Overall Health
- **100% Dictionary Key Parity:** All 154 dictionary keys exist across English, Hindi, and Gujarati tables with zero missing keys. All 25 parameterized templates maintain exact placeholder token parity (`{title}`, `{label}`, `{pos}`, `{errors}`, `{dx}`, `{dy}`, `{name}`, etc.).
- **Backend Semantic & Ask Alignment:** Backend Ask deterministic matcher (`facts_lookup`) and semantic target generator (`backend/app/semantic.py`) support Hindi and Gujarati with accurate vocabulary, correct coarse position mapping, and robust "I don't know" phrase detection (`is_dont_know`).
- **Core Critical Flaws:**
  1. `frontend/src/drivers/speech.ts:263-265` hardcodes an English voice fallback message, completely ignoring the localized string `t('speech.noVoiceNotice')`.
  2. Multiple `drivers.speech.speak(...)` call sites across `start.ts`, `Capture.tsx`, and `Explore.tsx` omit the `lang` argument, defaulting to `'en-IN'` and causing Hindi/Gujarati text to be spoken with an English TTS voice.
  3. `frontend/src/guide/semantic.ts` hardcodes English target labels (`'peak'`, `'lowest point'`, `'origin'`) that are interpolated directly into localized guidance strings.
  4. `backend/app/semantic.py:625` contains a grammatical gender mismatch in Gujarati (`"સૌથી નીચો બિંદુ"` instead of neuter `"સૌથી નીચું બિંદુ"`).
  5. UI button labels and status announcements built via string concatenation violate Indic Subject-Object-Verb (SOV) syntax.

A total of **16 findings** were identified (4 High, 6 Medium, 4 Low, 1 Suspected, 1 Unverified needing physical device validation).

---

## 1. Key Parity & Placeholders Across en, hi, gu

### Analysis
All three string tables (`en`, `hi`, `gu`) in `frontend/src/i18n/index.ts` were audited:
- **Total Keys:** 154 keys per language table (462 total key-value pairs).
- **Missing Keys:** 0 missing keys. Every key present in `en` is defined in both `hi` and `gu`.
- **Fallback Behavior:** `t(key)` safely falls back to English when a key is undefined in the active language, and finally returns the raw key if absent in English, avoiding silent blanks.
- **Placeholder Parity:** Exactly 25 keys across the tables utilize `{...}` replacement tokens:
  `explore.debugOffset` (`{dx}`, `{dy}`), `correct.validationFailed` (`{errors}`), `saved.opened` (`{title}`), `saved.deleted` (`{title}`), `saved.pinned.announced` (`{title}`), `saved.unpinned.announced` (`{title}`), `saved.deleteConfirm` (`{title}`), `speech.noVoiceNotice` (`{lang}`), `commands.cornerAnnounce` (`{index}`, `{total}`, `{label}`, `{pos}`), `commands.whereNearVertex` (`{label}`, `{pos}`), `commands.whereNearLine` (`{label}`, `{pos}`), `commands.whereEmpty` (`{pos}`), `commands.describe` (`{title}`, `{facts}`), `lab.settings.button` (`{lang}`, `{rate}`), `guide.start` (`{label}`), `guide.arrived` (`{label}`), `guide.notFound` (`{label}`), `share.verifiedBy` (`{name}`), `teach.loadedSuccess` (`{title}`), `teach.vertexAdded` (`{id}`), `teach.selectedVertex` (`{label}`), `teach.selectedSegment` (`{label}`), `teach.vertexMoved` (`{id}`), `teach.invalidDiagram` (`{errors}`), `teach.linkSize` (`{chars}`).
  Every placeholder token is identically named and positioned across all three languages.

---

## 2. Hard-Coded English Strings

### Analysis
While visible screen copy generally routes through `t()`, several critical execution paths bypass `t()` and present hard-coded English strings to students and teachers:

1. **Voice Fallback Notice (`frontend/src/drivers/speech.ts:263-265`):**
   When no native voice is installed on the host system for the requested language, `speak()` generates an English utterance:
   ```ts
   const langDisplay = lang.split('-')[0]?.toUpperCase() ?? lang;
   const noticeUtterance = createUtterance(
     `No system voice found for ${langDisplay}. Using default voice.`,
   );
   ```
   This bypasses the existing translated key `'speech.noVoiceNotice'`.
2. **Semantic Guide Labels (`frontend/src/guide/semantic.ts:360, 399, 424`):**
   `resolveSemantic()` returns object literals with hardcoded English labels:
   `label: 'peak'`, `label: 'lowest point'`, and `label: 'origin'`.
   When the guide starts, `Explore.tsx` speaks `t('guide.start').replace('{label}', resolved.label)`.
   In Hindi, this speaks: `"peak का मार्गदर्शन कर रहे हैं।"` instead of `"शिखर का मार्गदर्शन कर रहे हैं।"`.
3. **Visual Badges in Explore Screen (`frontend/src/screens/Explore.tsx:1110, 1125`):**
   - Line 1110: `<span className="gt-explore__badge gt-lab-badge" aria-hidden="true">Diagram</span>`
   - Line 1125: `<span className="gt-explore__raw-badge" aria-hidden="true">Raw</span>`
   Both render untranslated English text.
4. **Fallback Error Messages (`frontend/src/screens/Correct.tsx:458`, `flow/correct.ts:188`):**
   - Line 458: `formatValidationErrors(['Network or server validation error'])` in network catch block.
   - Line 188: `t('correct.validationFailed').replace('{errors}', 'Unknown error')` when `errors` is empty.
5. **Diagram Kind Enum Fallbacks (`frontend/src/flow/navigation.ts:11`, `core/savedDiagrams.ts:69, 72`, `components/teach/LoadModal.tsx:172, 234`):**
   When `scene.title` is absent or whitespace, `sceneName(scene)` and `savedTitle(scene)` return `scene.kind` directly (`"geometry"`, `"function_graph"`, `"bar_chart"`, `"generic"`).

---

## 3. Speech Drivers & Voice Fallback

### Analysis
`WebSpeechDriver` in `frontend/src/drivers/speech.ts` implements voice selection via `findVoiceForLang`:
1. **Selection Heuristic:**
   - Step 1: Exact match on normalized BCP-47 tag (e.g. `'hi-in'`).
   - Step 2: Prefix match on language subtag (e.g. `'hi'` matches `'hi-IN'`).
   - Step 3: Default system voice fallback (`voices.find(v => v.default) ?? voices[0]`).
2. **Missing `lang` Parameter in Call Sites:**
   The `speak` method signature is:
   ```ts
   speak(text: string, lang: string = DEFAULT_SPEECH_LANG): void
   ```
   where `DEFAULT_SPEECH_LANG = 'en-IN'`.
   Crucially, when call sites call `drivers.speech.speak(text)` without passing `lang`, the synthesizer defaults to `en-IN`. When `text` is Devanagari or Gujarati, an English voice is selected, producing incomprehensible or silence/spelling errors.
   - `frontend/src/flow/start.ts:20` (`speakIntro`)
   - `frontend/src/flow/start.ts:33` (`handleStartTap`)
   - `frontend/src/screens/Capture.tsx:122` (`say(text)`)
   - `frontend/src/screens/Explore.tsx:1106` (`SettingsLauncher` callback)

---

## 4. Speech Recognition Language

### Analysis
Speech recognition is handled by `WebSpeechDriver.listen(lang: string = DEFAULT_SPEECH_LANG)`:
- In `frontend/src/flow/ask.ts:164-165`:
  `const activeLang = deps.lang ?? LANG_BCP47[getLang()] ?? 'en-IN';`
  `const question = await deps.speech.listen(activeLang);`
  The Ask dialog correctly passes the active BCP-47 code (`'hi-IN'` or `'gu-IN'`).
- In `frontend/src/screens/Explore.tsx:288, 321`:
  `const lang = LANG_BCP47[getLang()] ?? 'en-IN';`
  `transcript = await drivers.speech.listen(lang);`
  Voice commands in Explore mode correctly configure recognition for the active language.
- In `frontend/src/screens/Debug.tsx:61`:
  `drivers.speech.listen()` omits `lang`, defaulting to `'en-IN'`. (Acceptable for an internal debug screen).

---

## 5. Number, Unit, and Punctuation Handling (danda, digits, units)

### Analysis
1. **Devanagari Danda (`।`) and Double Danda (`॥`):**
   - In `frontend/src/i18n/index.ts`, all declarative Hindi sentences terminate with Devanagari danda `।`.
   - In `backend/app/ask.py:63`, `SENTENCE_END_PATTERN = re.compile(r"(?<=[.!?।])\s+")` correctly includes `।`. However, it omits double danda `॥`.
   - In `backend/app/ask.py:355`, `clamp_answer` appends an ASCII `.` when truncating long answers (`clamped + "."`), even when the response language is Hindi.
2. **Gujarati Terminal Punctuation:**
   - Gujarati strings in `i18n/index.ts` terminate with standard ASCII period `.` (consistent with standard digital Gujarati orthography and textbooks).
3. **Arabic vs Indic Numerals:**
   - The app uses standard Arabic numerals (`0-9`) in all strings (`{index}/{total}`, `{chars}`, `1.0×`). Indic TTS engines (Google Speech Services on Android, eSpeak-ng) reliably pronounce Arabic numerals in Hindi and Gujarati, whereas Devanagari numerals (`१, २, ३`) often trigger character-by-character spelling bugs. Using Arabic digits is sound.
4. **Units ("cm", "mm", "°"):**
   - In `backend/app/ask.py`, `UNIT_TOKENS` and `normalize_token` normalize unit variants to `"cm"`, `"m"`, `"°"`.
   - In spoken output, "cm" is vocalised as English letters ("सी एम" / "સી એમ") rather than expanded words ("सेंटीमीटर" / "સેન્ટીમીટર"). While standard in Indian high school STEM instruction, expanding units in TTS improves comprehension for younger visually impaired students.

---

## 6. Template Concatenation, Pluralisation & Word Order

### Analysis
1. **Indic SOV vs English SVO Word Order:**
   Hindi and Gujarati follow Subject-Object-Verb (SOV) structure. Constructing strings by concatenating `t('verb') + " " + title` forces English SVO syntax onto Indic languages:
   - `frontend/src/screens/SavedDiagrams.tsx:181, 189, 200, 206, 215`:
     ``aria-label={`${t('saved.open')} ${entry.title}`}`` produces `"खोलें Triangle ABC"` / `"ખોલો Triangle ABC"` instead of `"Triangle ABC खोलें"` / `"Triangle ABC ખોલો"`.
   - `frontend/src/screens/Correct.tsx:386, 418, 424, 490`:
     ``sayAndStatus(`${t('correct.pointMoved')}: ${pointId}`)`` produces `"बिंदु स्थानांतरित किया: p1"` instead of `"बिंदु p1 स्थानांतरित किया"`.
2. **Fraction Slash in Corner Announcements (`frontend/src/i18n/index.ts:466, 767`):**
   - English: `'Corner {index} of {total}: Point {label} at {pos}.'`
   - Hindi: `'कोना {index}/{total}: बिंदु {label}, स्थिति {pos}।'`
   - Gujarati: `'ખૂણો {index}/{total}: બિંદુ {label}, સ્થાન {pos}.'`
   Replacing `"of"` with `"/"` causes TTS engines to pronounce the ratio as a mathematical fraction ("एक बटा तीन" or "1 slash 3") instead of conversational ordinal position ("3 में से 1" / "3 માંથી 1").
3. **Dead Translation Key (`commands.whereNearLine`):**
   `commands.whereNearLine` is translated across all three languages (`index.ts:167, 468, 769`), but `executeExploreCommand` in `flow/commands.ts` only executes `findNearestVertex`. Lines or segments are never queried; `commands.whereNearLine` is unreachable dead code.

---

## 7. Blind User Wording & Screen Reader Semantics

### Analysis
1. **Clarity & Brevity:**
   The majority of user-facing announcements are short, active, and accessible:
   - `start.intro`: `"घोस्ट टच। शुरू करने के लिए कहीं भी टैप करें।"`
   - `explore.gestureHint`: `"डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें। आप केंद्र से शुरू करते हैं।"`
   - `guide.hint.*`: Immediate directional commands (`"बाएँ चलें"`, `"दाएँ चलें"`, `"ऊपर चलें"`, `"नीचे चलें"`).
2. **Screen Reader Role & Live Region Semantics:**
   Status changes are announced via `StatusText` with `role="status"` and `aria-live="polite"`. Interactive elements have `.gt-control` (minimum 48×48 px) and accessible names.
3. **Punctuation Spacing:**
   Compound announcements in `navigation.ts:20-24` join sentences with `". "`:
   ``return `${name}. ${hint}`;``
   When `name` is in Hindi and ends with `।`, this creates `। . ` which can cause TTS to pause awkwardly or stutter.

---

## 8. Backend Ask & Semantic Answers (hi/gu)

### Analysis
1. **"I Don't Know" Fallback (`backend/app/ask.py:38-42`):**
   ```python
   DONT_KNOW_RESPONSES = {
       "en": "I don't know from this diagram.",
       "hi": "मुझे इस आरेख से यह ज्ञात नहीं है।",
       "gu": "મને આ આકૃતિ પરથી આની જાણ નથી.",
   }
   ```
   Both Hindi and Gujarati translations are clear, polite, and natural.
   The validation function `is_dont_know(text)` strips `_TRAILING_PUNCT` (`" \t\r\n.।॥"`) and matches against all three reference phrases.
2. **Gujarati Grammatical Gender Mismatch in `backend/app/semantic.py:625`:**
   In `backend/app/semantic.py:625`:
   `return f"સૌથી નીચો બિંદુ {pos} છે."`
   In Gujarati, "બિંદુ" (point) is neuter gender (નપુંસકલિંગ). The adjective must be neuter: "સૌથી નીચું બિંદુ", not masculine "નીચો".
3. **Semantic Target Descriptions (`backend/app/semantic.py:602-640`):**
   Hindi and Gujarati translations for peak, origin, tallest bar, shortest bar, right angle, and longest side use natural phrasing and correct coarse position postpositions (`"पर"`, `"છે"`).

---

## 9. Translation Review Coverage (`docs/user-test/translation-review.*`)

### Analysis
1. **Review Sheet Parity:**
   `docs/user-test/translation-review.md` and `.csv` provide native speakers with a comprehensive review sheet covering all 154 UI keys plus 7 voice command trigger phrases.
2. **Duplicate Rows and Section Drift:**
   - Key `teach.qrTooLong` appears twice consecutively at lines 502 and 503 in `.md` (and lines 270 and 271 in `.csv`).
   - Section 18 (`## 18. Teacher Share & Student Open (share.*)`, lines 330-348) is duplicated verbatim at Section 21 (`## 21. Teacher Share & Student Open (share.*)`, lines 532-549 in `.md` and lines 290-302 in `.csv`).
   - Newly added keys (`guide.semantic.none.*`, `voice.target.*`) are placed at Section 20, breaking numerical alignment with `i18n/index.ts`.

---

## Findings (Ranked by Severity)

### CONFIRMED

#### B3-01 · high · frontend/src/drivers/speech.ts:263-265 · Hardcoded English Voice Fallback Notice
- **What is wrong:** When the browser synthesiser has no voice installed for the requested language, `speak()` generates an English string:
  ``createUtterance(`No system voice found for ${langDisplay}. Using default voice.`)``.
  This completely ignores `'speech.noVoiceNotice'` in `frontend/src/i18n/index.ts`, speaking English to Hindi and Gujarati users.
- **Concrete failure scenario:** A user configures the app to Hindi on a browser without a `hi-IN` TTS voice pack. Upon first speech utterance, the user hears English: *"No system voice found for HI. Using default voice."* instead of Hindi: *"HI के लिए कोई सिस्टम आवाज़ नहीं मिली। डिफ़ॉल्ट आवाज़ का उपयोग कर रहे हैं।"*.
- **Proposed minimal fix:** Import `t` into `speech.ts` (or inject a resolver function) and format `'speech.noVoiceNotice'` with `{lang: langDisplay}`:
  ```ts
  const noticeText = t('speech.noVoiceNotice').replace('{lang}', langDisplay);
  const noticeUtterance = createUtterance(noticeText);
  ```
- **Proposed test:**
  ```ts
  it('B3-01: speaks localized noVoiceNotice when language voice is missing', () => {
    setLang('hi');
    const fakeUtterances: UtteranceLike[] = [];
    const host: SpeechHost = {
      synth: {
        cancel: () => {},
        speak: (u) => { fakeUtterances.push(u); },
        getVoices: () => [{ lang: 'en-US', name: 'English', default: true }],
      },
      createUtterance: (text) => ({ rate: 1, lang: 'en-US', text }),
    };
    const driver = new WebSpeechDriver(host);
    driver.speak('नमस्ते', 'hi-IN');
    expect(fakeUtterances[0]?.text).toContain('कोई सिस्टम आवाज़ नहीं मिली');
  });
  ```

#### B3-02 · high · frontend/src/flow/start.ts:20,33, frontend/src/screens/Capture.tsx:122, frontend/src/screens/Explore.tsx:1106 · speak(...) Call Sites Omit Language Parameter
- **What is wrong:** `speak(text, lang = DEFAULT_SPEECH_LANG)` defaults to `'en-IN'`. Multiple call sites call `drivers.speech.speak(text)` without passing `lang`, causing Hindi and Gujarati Devanagari/Gujarati text to be passed to the TTS engine with language tag `'en-IN'`.
- **Concrete failure scenario:** User switches language to Gujarati (`gu`) in settings. In `Capture.tsx`, when the user triggers `say(t('capture.busy'))`, line 122 calls `drivers.speech.speak(text)`. The synthesizer picks an Indian English voice (`en-IN`) and reads Gujarati text with English phoneme mappings, producing distorted output.
- **Proposed minimal fix:** Pass `LANG_BCP47[getLang()]` (or the active language tag) to all `speak()` call sites:
  ```ts
  // frontend/src/screens/Capture.tsx:122
  const say = (text: string): void => {
    drivers.speech.speak(text, LANG_BCP47[currentLang]);
    setStatus(text);
  };
  // frontend/src/flow/start.ts:20, 33
  export function speakIntro(drivers: Drivers, lang: string = LANG_BCP47[getLang()]): void {
    drivers.speech.speak(t('start.intro'), lang);
  }
  ```
- **Proposed test:**
  ```ts
  it('B3-02: Capture screen passes active language BCP-47 to speech driver', async () => {
    setLang('gu');
    const spokenLangs: string[] = [];
    const drivers = createFakeDrivers({
      speech: {
        speak: (_text, lang) => { spokenLangs.push(lang ?? 'default'); },
        canSpeak: true,
      },
    });
    render(<Capture drivers={drivers} onOpenExplore={() => {}} onOpenSaved={() => {}} />);
    // Trigger say via busy upload or sample click
    expect(spokenLangs).not.toContain('en-IN');
    expect(spokenLangs).toContain('gu-IN');
  });
  ```

#### B3-03 · high · frontend/src/guide/semantic.ts:360, 399, 424 · Semantic Guide Targets Contain Hard-Coded English Labels
- **What is wrong:** `resolveSemantic` returns targets with hardcoded English strings: `label: 'peak'`, `label: 'lowest point'`, and `label: 'origin'`. These are interpolated directly into localized templates `t('guide.start')` (`"{label} का मार्गदर्शन कर रहे हैं।"`) and `t('guide.arrived')`.
- **Concrete failure scenario:** A Hindi-speaking student exploring a graph issues the command "मुझे शिखर पर ले चलो" (guide me to peak). The app announces: *"peak का मार्गदर्शन कर रहे हैं।"* and upon arrival: *"peak पर पहुँच गए।"*, mixing English nouns into Hindi grammar.
- **Proposed minimal fix:** Add localized label keys to `i18n/index.ts` (`'guide.semantic.label.peak'`, `'guide.semantic.label.trough'`, `'guide.semantic.label.origin'`) and resolve the label dynamically using `t()`:
  ```ts
  // In frontend/src/guide/semantic.ts
  case 'peak':
    return { x: bestPt.x, y: bestPt.y, label: t('guide.semantic.label.peak') };
  ```
- **Proposed test:**
  ```ts
  it('B3-03: resolveSemantic returns localized label for active language', () => {
    setLang('hi');
    const scene: DiagramScene = {
      version: 1,
      kind: 'function_graph',
      polylines: [{ id: 'curve', points: [[0.1, 0.8], [0.5, 0.2], [0.9, 0.8]] }],
    };
    const target = resolveSemantic(scene, 'peak');
    expect(target?.label).toBe('शिखर');
  });
  ```

#### B3-04 · high · backend/app/semantic.py:625 · Gujarati Grammatical Gender Mismatch in Semantic Answer
- **What is wrong:** In `backend/app/semantic.py:625`, `_build_answer` returns `f"સૌથી નીચો બિંદુ {pos} છે."`. In Gujarati, the noun "બિંદુ" (point) is neuter gender (નપુંસકલિંગ - તે બિંદુ). The adjective "નીચો" is masculine (પુલ્લિંગ). The grammatically correct form is "સૌથી નીચું બિંદુ".
- **Concrete failure scenario:** A Gujarati student asks about the minimum point of a function. The backend returns: `"સૌથી નીચો બિંદુ નીચે ડાબે છે."`. A native speaker immediately notices the grammatical discordance.
- **Proposed minimal fix:** In `backend/app/semantic.py:625`, replace `"સૌથી નીચો બિંદુ"` with `"સૌથી નીચું બિંદુ"`:
  ```python
  if feature == FEATURE_TROUGH:
      return f"સૌથી નીચું બિંદુ {pos} છે."
  ```
- **Proposed test:**
  ```python
  def test_b3_04_gujarati_semantic_trough_neuter_gender():
      scene = DiagramScene(
          version=1,
          kind="function_graph",
          polylines=[Polyline(id="c1", points=[[0.1, 0.2], [0.5, 0.8], [0.9, 0.2]])],
      )
      ans = semantic_lookup(scene, "સૌથી નીચું બિંદુ ક્યાં છે", lang="gu-IN")
      assert ans is not None
      assert "સૌથી નીચું બિંદુ" in ans
      assert "નીચો" not in ans
  ```

#### B3-05 · medium · frontend/src/flow/navigation.ts:11, frontend/src/core/savedDiagrams.ts:69, 72 (Needs from Kiro), frontend/src/components/teach/LoadModal.tsx:172, 234 · Untranslated Scene Kind Enums in Titles and Spoken Announcements
- **What is wrong:** When a diagram lacks an explicit `title`, `sceneName(scene)` and `savedTitle(scene)` fall back to raw English enum values (`"geometry"`, `"function_graph"`, `"bar_chart"`, `"generic"`).
- **Concrete failure scenario:** A student opens an untitled geometry diagram in Hindi mode. Explore announcement speaks: *"geometry. डबल-टैप करके दबाए रखें..."*, uttering the English code identifier "geometry".
- **Proposed minimal fix:** Add translation keys `'scene.kind.geometry'`, `'scene.kind.function_graph'`, `'scene.kind.bar_chart'`, `'scene.kind.generic'` to `i18n/index.ts`, and map `scene.kind` through `t()`:
  ```ts
  export function sceneName(scene: DiagramScene): string {
    const title = scene.title;
    if (typeof title === 'string' && title.trim() !== '') return title;
    return t(`scene.kind.${scene.kind}`);
  }
  ```
  *(Note: `frontend/src/core/savedDiagrams.ts` is Kiro-owned; see "Needs from Kiro" section).*
- **Proposed test:**
  ```ts
  it('B3-05: sceneName translates diagram kind when title is omitted', () => {
    setLang('hi');
    const scene: DiagramScene = { version: 1, kind: 'function_graph' };
    expect(sceneName(scene)).toBe('फ़ंक्शन ग्राफ़');
  });
  ```

#### B3-06 · medium · frontend/src/screens/Correct.tsx:458, frontend/src/flow/correct.ts:188 · Hard-Coded English Strings in Validation Error Paths
- **What is wrong:** If diagram validation throws a network error, `Correct.tsx:458` passes `['Network or server validation error']`. In `correct.ts:188`, if `errors` is empty, it replaces `{errors}` with `'Unknown error'`. Both are unlocalized English.
- **Concrete failure scenario:** A teacher in Hindi mode attempts to save an invalid correction while disconnected from the network. The app displays and speaks: *"सत्यापन विफल: Network or server validation error"*.
- **Proposed minimal fix:** Add `'correct.errorNetwork'` and `'correct.errorUnknown'` to `i18n/index.ts`:
  ```ts
  // In Correct.tsx:458
  const errorText = formatValidationErrors([t('correct.errorNetwork')]);
  // In correct.ts:188
  if (errors.length === 0) return t('correct.validationFailed').replace('{errors}', t('correct.errorUnknown'));
  ```
- **Proposed test:**
  ```ts
  it('B3-06: formatValidationErrors localizes empty and network errors', () => {
    setLang('hi');
    expect(formatValidationErrors([])).not.toContain('Unknown error');
    expect(formatValidationErrors([])).toBe('सत्यापन विफल: अज्ञात त्रुटि');
  });
  ```

#### B3-07 · medium · frontend/src/screens/Explore.tsx:1110, 1125 · Hardcoded English Visual Badges in Explore Mode
- **What is wrong:** Visual badges `<span ...>Diagram</span>` and `<span ...>Raw</span>` are rendered with hardcoded English strings.
- **Concrete failure scenario:** A Gujarati-speaking sighted teacher or low-vision student looks at the screen in Gujarati mode. The header badge displays `"Diagram"` and the raw banner displays `"Raw"`, while the rest of the interface is in Gujarati.
- **Proposed minimal fix:** Use existing keys `'explore.badgeDiagram'` and `'explore.badgeRaw'` (or add them to `i18n/index.ts`):
  ```tsx
  <span className="gt-explore__badge gt-lab-badge" aria-hidden="true">{t('explore.badgeDiagram')}</span>
  <span className="gt-explore__raw-badge" aria-hidden="true">{t('explore.badgeRaw')}</span>
  ```
- **Proposed test:**
  ```tsx
  it('B3-07: renders localized badges in Explore screen', () => {
    setLang('gu');
    render(<Explore scene={mockScene} drivers={mockDrivers} onBack={() => {}} />);
    expect(screen.getByText('આકૃતિ')).toBeInTheDocument();
  });
  ```

#### B3-08 · medium · frontend/src/screens/Correct.tsx:386, 418, 424, 490, frontend/src/flow/correct.ts:174, 179 · SVO Concatenation with Colon Breaks Indic Syntax
- **What is wrong:** State announcements in Correct mode concatenate action verbs with item IDs using colons: `` `${t('correct.pointMoved')}: ${pointId}` `` -> `"बिंदु स्थानांतरित किया: p1"`. In Hindi/Gujarati, verbs follow the object: `"बिंदु p1 स्थानांतरित किया"` / `"બિંદુ p1 ખસેડાયું"`.
- **Concrete failure scenario:** A blind student using TalkBack adjusts a point. The screen reader vocalizes: *"बिंदु स्थानांतरित किया: p1"*, creating an awkward, unnatural phrasing with a colon pause.
- **Proposed minimal fix:** Define templates with `{id}` in `i18n/index.ts`:
  - `en`: `'correct.pointMoved': 'Moved point {id}'`
  - `hi`: `'correct.pointMoved': 'बिंदु {id} स्थानांतरित किया गया'`
  - `gu`: `'correct.pointMoved': 'બિંદુ {id} ખસેડાયું'`
  And call: `sayAndStatus(t('correct.pointMoved').replace('{id}', pointId));`.
- **Proposed test:**
  ```ts
  it('B3-08: formats point moved announcement with natural SOV word order', () => {
    setLang('hi');
    expect(formatPointMoved('p1')).toBe('बिंदु p1 स्थानांतरित किया गया');
  });
  ```

#### B3-09 · medium · frontend/src/screens/SavedDiagrams.tsx:181, 189, 200, 206, 215 · Concatenated Button Aria-Labels Violate Indic SOV Word Order
- **What is wrong:** In `SavedDiagrams.tsx`, button `aria-label`s are constructed via template concatenation:
  ``aria-label={`${t('saved.open')} ${entry.title}`}``
  ``aria-label={`${entry.pinned ? t('saved.unpin') : t('saved.pin')} ${entry.title}`}``
  In Hindi and Gujarati, verbs belong at the end of the sentence. Prefixing the verb produces awkward phrases: `"खोलें Triangle ABC"` (Hindi) or `"ખોલો Triangle ABC"` (Gujarati).
- **Concrete failure scenario:** A TalkBack user navigates the Saved Diagrams list in Gujarati. TalkBack speaks: *"ખોલો Triangle ABC, બટન"* instead of natural *"Triangle ABC ખોલો, બટન"*.
- **Proposed minimal fix:** Add parameterized keys to `i18n/index.ts`:
  - `'saved.openTitle'`: `en: 'Open {title}'`, `hi: '{title} खोलें'`, `gu: '{title} ખોલો'`
  - `'saved.pinTitle'`: `en: 'Pin {title}'`, `hi: '{title} पिन करें'`, `gu: '{title} પિન કરો'`
  - `'saved.unpinTitle'`: `en: 'Unpin {title}'`, `hi: '{title} अनपिन करें'`, `gu: '{title} અનપિન કરો'`
  And interpolate `entry.title` into the template.
- **Proposed test:**
  ```ts
  it('B3-09: formats saved diagram action labels with object-initial word order', () => {
    setLang('gu');
    expect(formatOpenLabel('Triangle ABC')).toBe('Triangle ABC ખોલો');
  });
  ```

#### B3-10 · medium · frontend/src/i18n/index.ts:466, 767 · Fraction Slash in Corner Announcements Causes Unnatural TTS Cadence
- **What is wrong:** `commands.cornerAnnounce` in Hindi and Gujarati uses a fraction slash `{index}/{total}`:
  - Hindi: `'कोना {index}/{total}: बिंदु {label}, स्थिति {pos}।'`
  - Gujarati: `'ખૂણો {index}/{total}: બિંદુ {label}, સ્થાન {pos}.'`
  Screen readers and TTS engines interpret `{index}/{total}` as a fraction ("1 बटा 3" or "1 slash 3") rather than an ordinal sequence ("3 में से 1" / "3 માંથી 1").
- **Concrete failure scenario:** User says "next corner" in Explore mode on a triangle. TTS speaks: *"कोना एक बटा तीन: बिंदु A, स्थिति शीर्ष पर।"*, which confuses blind students.
- **Proposed minimal fix:** Update the Hindi and Gujarati templates to use conversational phrasing:
  - Hindi: `'कोना {total} में से {index}: बिंदु {label}, स्थिति {pos}।'`
  - Gujarati: `'ખૂણો {total} માંથી {index}: બિંદુ {label}, સ્થાન {pos}.'`
- **Proposed test:**
  ```ts
  it('B3-10: formats corner announcement conversationally without fraction slash', () => {
    setLang('hi');
    const msg = t('commands.cornerAnnounce')
      .replace('{index}', '1')
      .replace('{total}', '3')
      .replace('{label}', 'A')
      .replace('{pos}', 'शीर्ष');
    expect(msg).not.toContain('1/3');
    expect(msg).toContain('3 में से 1');
  });
  ```

#### B3-11 · low · frontend/src/flow/commands.ts:611-622, frontend/src/i18n/index.ts:167, 468, 769 · Dead Translation Key `commands.whereNearLine`
- **What is wrong:** The key `commands.whereNearLine` (`"Near line {label}, {pos}."` / `"रेखा {label} के पास, {pos}।"` / `"રેખા {label} નજીક, {pos}."`) is fully translated across all three languages, but `executeExploreCommand` in `flow/commands.ts:611-622` only checks `findNearestVertex`. If no vertex is near, it immediately drops to `commands.whereEmpty`. `commands.whereNearLine` is never invoked.
- **Concrete failure scenario:** A student with their finger on a segment says "where am I". The system announces: *"खाली जगह में, केंद्र।"* (in open space) instead of *"रेखा AB के पास, केंद्र।"*, because segments are ignored.
- **Proposed minimal fix:** Either implement segment distance checking in `where_am_i` using `distToSegment`, or deprecate `commands.whereNearLine` in `i18n/index.ts`.
- **Proposed test:**
  ```ts
  it('B3-11: where_am_i announces near line when cursor is close to a segment', () => {
    const scene: DiagramScene = {
      version: 1,
      kind: 'geometry',
      points: [{ id: 'p1', x: 0.1, y: 0.1 }, { id: 'p2', x: 0.9, y: 0.1 }],
      segments: [{ id: 's1', start: 'p1', end: 'p2', label: 'AB' }],
    };
    const res = executeExploreCommand({ type: 'where_am_i', raw: 'where am I' }, {
      scene,
      view: { width: 100, height: 100, scale: 1, offsetX: 0, offsetY: 0 },
      cursorNorm: { x: 0.5, y: 0.11 }, // on line s1, away from endpoints
      lastSpoken: '',
      currentCornerIndex: 0,
      currentRate: 'normal',
    });
    expect(res.speech).toContain('Near line AB');
  });
  ```

#### B3-12 · low · backend/app/ask.py:63, 355 · Truncated Spoken Answers Hardcode Latin Period Instead of Devanagari Danda
- **What is wrong:** In `backend/app/ask.py:355`, `clamp_answer` terminates truncated answers with Latin period: `clamped + "."`. For Hindi responses, this produces mixed punctuation (`।` followed by `.`). Furthermore, `SENTENCE_END_PATTERN` on line 63 does not match double danda `॥`.
- **Concrete failure scenario:** A long Hindi LLM answer exceeding 300 characters is truncated by `clamp_answer`. The resulting string ends with an ASCII period `.` rather than a danda `।`.
- **Proposed minimal fix:** Update `clamp_answer` to accept `lang: str = "en"` and append `।` if `lang.startswith("hi")`, otherwise `.`. Update line 63 regex to `r"(?<=[.!?।॥])\s+"`.
- **Proposed test:**
  ```python
  def test_b3_12_clamp_answer_hindi_danda():
      long_hi = "यह एक बहुत लंबा वाक्य है " * 20
      clamped = clamp_answer(long_hi, lang="hi-IN")
      assert clamped.endswith("।")
      assert not clamped.endswith(".")
  ```

#### B3-13 · low · docs/user-test/translation-review.md:330-348, 502-503, 532-549, docs/user-test/translation-review.csv:270-271, 290-302 · Redundant Duplicate Sections in Translation Review Sheet
- **What is wrong:** Key `teach.qrTooLong` is duplicated on consecutive lines (502 & 503 in `.md`, 270 & 271 in `.csv`). Furthermore, Section 18 (`share.*`, 13 keys) is duplicated verbatim as Section 21 at the end of the file.
- **Concrete failure scenario:** Native speakers reviewing the translation sheet are presented with duplicate rows for `teach.qrTooLong` and repeat review of all 13 `share.*` keys, leading to duplicate feedback and review fatigue.
- **Proposed minimal fix:** Remove duplicate line 503 and duplicate Section 21 in `docs/user-test/translation-review.md` and their corresponding rows in `.csv`.
- **Proposed test:**
  ```ts
  it('B3-13: translation review sheet has no duplicate keys', () => {
    const content = fs.readFileSync('docs/user-test/translation-review.csv', 'utf8');
    const keys = content.split('\n').slice(1).map(line => line.split(',')[0]).filter(Boolean);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });
  ```

#### B3-14 · low · frontend/src/flow/navigation.ts:20-28, frontend/src/App.tsx:411 · Hardcoded Period Concatenation in Announcement Generators
- **What is wrong:** In `navigation.ts:20-24`, sentences are joined with Latin period `.` and space:
  ``return `${name}. ${hint}`;``
  ``return `${sceneName(scene)}. ${t('explore.gestureHint')}`;``
  In Hindi, where `name` and `hint` end with danda `।`, this injects an unpunctuated period after the danda.
- **Concrete failure scenario:** When Explore mode opens in Hindi, screen readers process `"त्रिभुज. डबल-टैप करके दबाए रखें..."`, vocalising an English stop rather than a Devanagari clause break.
- **Proposed minimal fix:** Use a localized sentence joiner helper:
  ```ts
  function joinSentences(parts: string[], lang: Lang = getLang()): string {
    const sep = lang === 'hi' ? '। ' : '. ';
    return parts.map(p => p.replace(/[.।]$/, '')).join(sep) + (lang === 'hi' ? '।' : '.');
  }
  ```
- **Proposed test:**
  ```ts
  it('B3-14: joins Hindi announcement sentences with danda', () => {
    setLang('hi');
    const msg = exploreAnnouncement({ version: 1, kind: 'geometry', title: 'त्रिभुज' }, 'normal');
    expect(msg).not.toContain('. ');
    expect(msg).toContain('। ');
  });
  ```

---

### SUSPECTED

#### B3-15 · low · frontend/src/i18n/index.ts:156-158, 457-459, 758-760 · Invariant Self-Referential Language Switch Announcements
- **What is wrong:** In all three tables, `lang.changedEn` is `"Language set to English."`, `lang.changedHi` is `"भाषा हिंदी में सेट की गई।"`, and `lang.changedGu` is `"ભાષા ગુજરાતીમાં સેટ થઈ."`. While this ensures the target language speaks in that language, switching language from Hindi to English causes the Hindi synthesizer to attempt pronouncing English sentence `"Language set to English."` before the new language voice is loaded.
- **Concrete failure scenario:** On devices with slow voice switching, the old voice speaks the new language announcement, resulting in accented or broken pronunciation.
- **Proposed minimal fix:** Speak the confirmation after setting the new language voice, and pass `LANG_BCP47[newLang]` explicitly to `speak()`.
- **Proposed test:**
  ```ts
  it('B3-15: language switch announces using the new language voice code', () => {
    const spokenLangs: string[] = [];
    const drivers = createFakeDrivers({
      speech: { speak: (_text, lang) => { spokenLangs.push(lang!); } }
    });
    setLangWithSpeech('hi', drivers);
    expect(spokenLangs[spokenLangs.length - 1]).toBe('hi-IN');
  });
  ```

---

### UNVERIFIED (Needs phone or screen reader)

#### B3-16 · high · frontend/src/drivers/speech.ts:140-169 · Mobile Browser System Voice Fallback Without Gujarati Voice Pack
- **What is wrong:** Many Android devices ship with Google Speech Services containing English and Hindi voices, but omitting Gujarati unless manually downloaded in Android TTS settings. When `hasVoiceForLang` is false, `findVoiceForLang` falls back to the default voice (often English or Hindi).
- **Concrete failure scenario:** On an Android phone without a Gujarati voice pack, a Gujarati user double taps to start. The browser silently reads Gujarati text using the Hindi or English TTS voice. Due to script and phoneme mismatches, the speech is either completely silent or sounds like unintelligible gibberish.
- **Proposed minimal fix:** When `hasVoiceForLang` is false and language is `gu-IN`, check if a `hi-IN` voice exists as a secondary regional fallback (since Hindi TTS can approximate Devanagari-cognate Gujarati vocabulary far better than English TTS), and alert the user via an accessible banner to install the Gujarati voice pack in device settings.
- **Proposed test:**
  ```ts
  it('B3-16: falls back to Hindi voice when Gujarati voice is missing but Hindi voice exists', () => {
    const voices = [
      { lang: 'en-US', name: 'English' },
      { lang: 'hi-IN', name: 'Hindi' },
    ];
    const match = findVoiceWithRegionalFallback(voices, 'gu-IN');
    expect(match.voice?.lang).toBe('hi-IN');
  });
  ```

---

## Needs from Kiro

Per AGENTS.md Rule 1 (`frontend/src/core/**` is locked to Kiro):
1. **`frontend/src/core/savedDiagrams.ts:56, 69, 72`**:
   `savedTitle(scene: DiagramScene, _lang: string = 'en')` receives an unused `_lang` parameter and hardcodes English enum fallback:
   ```ts
   if (labelledPoints.length > 0) {
     return `${scene.kind}: ${labelledPoints.join(', ')}`;
   }
   return scene.kind;
   ```
   **Request for Kiro:** Accept a translator function or localize `scene.kind` using a mapping dictionary so that untitled scenes do not generate raw English strings `"geometry"`, `"function_graph"`, or `"bar_chart"` in saved diagrams.

---

## Top 5 to Fix First

1. **B3-01 (`frontend/src/drivers/speech.ts:263-265`):** Replace hard-coded English voice fallback warning with `t('speech.noVoiceNotice')`.
2. **B3-02 (`frontend/src/flow/start.ts:20,33`, `screens/Capture.tsx:122`, `screens/Explore.tsx:1106`):** Explicitly pass active language tag (`LANG_BCP47[getLang()]`) to all `drivers.speech.speak(...)` call sites so Indic text is not pronounced by an English voice.
3. **B3-03 (`frontend/src/guide/semantic.ts:360, 399, 424`):** Localize semantic target labels (`'peak'`, `'lowest point'`, `'origin'`) so guidance announcements do not mix English labels into Hindi and Gujarati sentences.
4. **B3-04 (`backend/app/semantic.py:625`):** Fix Gujarati grammatical gender agreement from masculine `"સૌથી નીચો બિંદુ"` to neuter `"સૌથી નીચું બિંદુ"`.
5. **B3-10 (`frontend/src/i18n/index.ts:466, 767`):** Replace fraction slash `{index}/{total}` in Hindi and Gujarati corner announcements with conversational ordinal phrasing ("3 में से 1" / "3 માંથી 1").

> **Supervisor note (2026-11-08):** this lane was checked out before T26. B3-01 (hard-coded voice fallback warning in speech.ts) is ALREADY FIXED on main (CORE-10, key speech.noVoiceNotice in en/hi/gu). Treat the other findings as unverified until re-checked against current main. Hindi and Gujarati wording changes need native-speaker review.
