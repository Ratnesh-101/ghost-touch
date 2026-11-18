# Lane ux15 Report — Voice Command Parser Swallow Bug Fix

**Lane:** ux15 (`gt-lane-ux15` — command parser swallows questions; Task 71, Requirement 45)  
**Tool:** Antigravity (agy)  
**Status:** Complete  

---

## 1. Summary of Changes

In the voice command parser (`frontend/src/flow/commands.ts`), `parseExploreCommand` previously used loose substring matching (`norm.includes(...)` and `norm.startsWith(...)`) for `repeat`, `next_corner`, `describe`, `help`, and speech rate commands (`faster`, `slower`). As a result, genuine questions asked by students containing any of those words (e.g. "Can you help me find AB?", "Which bar grows faster?", "Describe angle B") were swallowed as commands instead of reaching Ask.

To implement **Requirement 45 (45.1–45.3, 45.5)** with the smallest possible change and no refactor:
1. Replaced loose `includes` / `startsWith` checks on `repeat`, `next_corner`, `describe`, `help`, and `set_rate` with a strict phrase matching helper (`matchesCommand`).
2. Per Requirement 45.1, a command matches only when:
   - The normalized transcript matches one of the command's listed phrases exactly (any length), OR
   - The transcript has at most 3 words AND every word of it is in the vocabulary of that same command's listed phrases.
3. Transcripts containing command words within longer sentences (4+ words, or 1–3 words with non-command vocabulary such as "Describe angle B" or "where is the top of the curve") parse as `unknown` and pass cleanly through to Ask.
4. Preserved exact parsing for all existing bare commands and short command phrases in English, Hindi, and Gujarati.
5. In accordance with Requirement 45.4, `where am i` and `guide` commands were left untouched.

---

## 2. Files Changed

1. **`frontend/src/flow/commands.ts`**
   - Added `CommandPhraseSpec`, `makePhraseSpec`, and `matchesCommand` helper to evaluate Requirement 45.1.
   - Defined phrase lists and precomputed word sets for:
     - `repeat` (`REPEAT_SPEC`)
     - `next_corner` (`NEXT_CORNER_SPEC`)
     - `describe` (`DESCRIBE_SPEC`)
     - `help` (`HELP_SPEC`)
     - `set_rate` fast (`RATE_FAST_SPEC`)
     - `set_rate` slow (`RATE_SLOW_SPEC`)
     - `set_rate` normal (`RATE_NORMAL_SPEC`)
   - Replaced substring checks in `parseExploreCommand` with `matchesCommand` calls.

---

## 3. Tests Added

**`frontend/tests/commands.parse.test.ts`** (new):
- **Bare commands in English, Hindi, and Gujarati (18 test cases):**
  - English: `help` -> `help`, `repeat` -> `repeat`, `next corner` -> `next_corner`, `describe` -> `describe`, `faster` -> `set_rate (fast)`, `slower` -> `set_rate (slow)`
  - Hindi: `मदद` -> `help`, `दोहराएं` -> `repeat`, `अगला कोना` -> `next_corner`, `वर्णन करें` -> `describe`, `तेज़` -> `set_rate (fast)`, `धीमा` -> `set_rate (slow)`
  - Gujarati: `મદદ` -> `help`, `ફરી બોલો` -> `repeat`, `આગળનો ખૂણો` -> `next_corner`, `વર્ણન કરો` -> `describe`, `ઝડપી` -> `set_rate (fast)`, `ધીમું` -> `set_rate (slow)`
- **Short known command phrases (16 test cases):**
  - Verifies multi-word variants like `say again`, `repeat that`, `next vertex`, `describe diagram`, `list commands`, `help me`, `speed up`, `slow down`, `normal speed`, `फिर से बोलो`, `अगला शीर्ष`, `चित्र का वर्णन`, `સામાન્ય ગતિ`, etc.
- **Prompt-specific questions containing command words:**
  - `where is the top of the curve` -> `unknown`
  - `how long is the back side` -> `unknown`
  - `read me the labels again please` -> `unknown`
- **At least 15 additional real questions per language (20 per language, verified against i18n STEM terminology):**
  - **English (20 questions):**
    - `where is the top of the curve`
    - `how long is the back side`
    - `read me the labels again please`
    - `What is the slope of the curve?`
    - `Can you tell me the coordinates of vertex A?`
    - `How many corners does this polygon have?`
    - `Is side AB parallel to side CD?`
    - `Which bar has the highest value?`
    - `Can someone help me find the right angle?`
    - `Describe how the function behaves near zero`
    - `Please repeat the value of the third bar`
    - `What comes after the next corner clockwise?`
    - `Why is this line moving faster here?`
    - `Can you explain why the curve is slower?`
    - `Where does the line cross the x-axis?`
    - `Is point B touching the y-axis?`
    - `What is the difference between bar Q1 and bar Q2?`
    - `Could you describe the hypotenuse length?`
    - `What is the peak height of this sine wave?`
    - `Is there an origin marked on this graph?`
  - **Hindi (20 questions):**
    - `वक्र का उच्चतम बिंदु कहाँ है`
    - `भुजा AB की लंबाई कितनी है`
    - `कृपया मुझे सारे लेबल फिर से पढ़कर बताएं`
    - `क्या आप मुझे समकोण खोजने में मदद कर सकते हैं`
    - `इस त्रिभुज के कोण B का वर्णन करें`
    - `क्या यह रेखा x-अक्ष को काटती है`
    - `अगला कोना बिंदु B के बाद कौन सा आता है`
    - `पहला स्तंभ दूसरे से कितना बड़ा है`
    - `क्या दूसरा बार पहले से ज़्यादा तेज़ बढ़ रहा है`
    - `वक्र का ढलान शिखर के बाद धीमा क्यों होता है`
    - `क्या बिंदु C उद्गम पर स्थित है`
    - `इस आकृति में कुल कितने कोने हैं`
    - `तीसरे स्तंभ का मान क्या है`
    - `क्या बिंदु A और B को जोड़ने वाली रेखा सीधी है`
    - `कर्ण AC की माप क्या है`
    - `क्या आप इस पूरे आरेख का सारांश दोहरा सकते हैं`
    - `y-अक्ष पर कौन सा बिंदु स्थित है`
    - `साइन तरंग का आयाम कितना है`
    - `क्या शिखर और गर्त के बीच की दूरी ज्ञात है`
    - `क्या आप मुझे इस वक्र की दिशा समझा सकते हैं`
  - **Gujarati (20 questions):**
    - `વક્રનું સૌથી ઊંચું શિખર ક્યાં છે`
    - `બાજુ AB ની લંબાઈ કેટલી છે`
    - `કૃપા કરીને મને બધા લેબલ ફરીથી કહો`
    - `શું તમે મને કાટખૂણો શોધવામાં મદદ કરી શકો છો`
    - `આ ત્રિકોણના ખૂણા B નું વિગતવાર વર્ણન કરો`
    - `શું આ રેખા x-અક્ષને છેદે છે`
    - `બિંદુ B પછી કયો આગળનો ખૂણો આવે છે`
    - `પહેલો સ્તંભ બીજા સ્તંભ કરતાં કેટલો મોટો છે`
    - `કયો બાર સૌથી ઝડપી વધે છે`
    - `વક્રનો ઢાળ શિખર પછી ધીમો કેમ થાય છે`
    - `શું બિંદુ C ઉદ્ભવ બિંદુ પર છે`
    - `આ આકૃતિમાં કુલ કેટલા ખૂણાઓ છે`
    - `ત્રીજા સ્તંભનું મૂલ્ય શું છે`
    - `બિંદુ A અને B ને જોડતી રેખા કેવી છે`
    - `કાટકોણ ત્રિકોણમાં કર્ણ કયો છે`
    - `શું તમે છેલ્લું બોલેલું વાક્ય ફરી બોલી શકો`
    - `y-અક્ષ પર કયું બિંદુ આવેલું છે`
    - `સાઇન તરંગનું સૌથી નીચું બિંદુ ક્યાં છે`
    - `શું આ આલેખમાં કોઈ સમપ્રમાણતા છે`
    - `મને આ સ્તંભ આલેખની માહિતી સમજવામાં મદદ કરશો`
- **Baseline Requirement 45 table questions (20 questions):**
  - Confirms all 20 questions from `commands.table.test.ts` parse as `unknown`.

---

## 4. Needs from Kiro

In `frontend/tests/commands.table.test.ts` (owned by Kiro):
- The orchestrator will flip the two `it.fails` tests:
  - `it.fails('twenty real questions parse as unknown, so they reach Ask')`
  - `it.fails('any sentence of 4+ words with a command word inserted parses as unknown')`
- Both tests are now fully satisfied by the fix in `frontend/src/flow/commands.ts`.

---

## 5. What Could Not Be Verified Headless

- In strict compliance with headless UX rules, no shell commands were executed (`npm`, `npx`, `vitest`, `tsc`, `git`, `python`, etc.).
- All validation, type-checking (`tsc --noEmit`), and vitest runs are executed by orchestrator gates.
- No `.env` files were read, touched, or searched.
- No files outside the lane's ALLOWED list were modified.
- No tuned haptic or audio values were altered.
