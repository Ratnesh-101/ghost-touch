# AGY Report: Lane ux9 — Tell the user what to do after Raw Mode

## Summary of Changes

Implemented structured handling of Raw Mode fallback reasons and guidance messages for users when diagram recognition falls back to OpenCV Raw Mode.

1. **Closed Union & Mapping Function (`frontend/src/flow/navigation.ts`)**:
   - Defined `RawReason` closed union: `'timeout' | 'budget' | 'provider' | 'unreadable'`.
   - Exported `RAW_REASONS` array containing all 4 valid members.
   - Implemented `mapRawReason(serverReason?: string | null): RawReason`:
     - Maps server string variations (such as `'timeout'`, `'queue_timeout'`, `'budget'`, `'budget_exhausted'`, `'provider'`, `'no_provider'`, `'provider_error'`, `'unreadable'`) to the closed union members.
     - Maps unknown server strings (e.g. `'invalid'`, `'error'`, `'unknown'`) to `'unreadable'`.
     - Maps missing reasons (`undefined`, `null`, `''`) to `'unreadable'`.
   - Implemented `rawReasonSentence(reason?: RawReason | string | null): string`:
     - Returns localized guidance string via `t('raw.reason.' + mapped)`.
     - Never speaks or exposes raw server strings.

2. **Explore Entry Announcement (`frontend/src/flow/navigation.ts`)**:
   - Updated `exploreAnnouncement(scene, mode, verifyMode, options, rawReason)`:
     - When `mode === 'raw'`, appends the localized reason guidance sentence immediately following `t('raw.announce')` via `joinAnnouncements`.
     - Keeps the leading `raw.announce` sentence required by Requirement 8.1.
     - Never includes the raw server string in spoken or announced text.

3. **Capture & App Data Flow (`frontend/src/screens/Capture.tsx`, `frontend/src/App.tsx`)**:
   - In `Capture.tsx`: When `processImageFile` returns a scene with `mode === 'raw'`, maps `outcome.response.reason` via `mapRawReason` and passes it as a closed union `RawReason` to `onScene`.
   - In `App.tsx`: `handleScene` receives `rawReason?: RawReason`, resolves it via `mapRawReason`, and passes it to `exploreAnnouncement`, ensuring the spoken and live-region announcements incorporate the appropriate guidance.

4. **i18n Translation Tables (`frontend/src/i18n/index.ts`)**:
   - Added translations for the 4 keys in English (`en`), Hindi (`hi`), and Gujarati (`gu`):
     - `raw.reason.timeout`:
       - `en`: "The reader was slow. Try once more."
       - `hi`: "रीडर धीमा था। एक बार फिर प्रयास करें।"
       - `gu`: "રીડર ધીમું હતું. ફરી એકવાર પ્રયાસ કરો."
     - `raw.reason.budget`:
       - `en`: "Today's AI limit is used up. Saved diagrams still work. Try again tomorrow."
       - `hi`: "आज की एआई सीमा समाप्त हो गई है। सहेजे गए आरेख अभी भी काम करते हैं। कल पुनः प्रयास करें।"
       - `gu`: "આજની AI મર્યાદા સમાપ્ત થઈ ગઈ છે. સેવ કરેલી આકૃતિઓ હજી પણ કામ કરે છે. આવતીકાલે ફરી પ્રયાસ કરો."
     - `raw.reason.provider`:
       - `en`: "The reader is not available right now. Try again in a minute."
       - `hi`: "रीडर अभी उपलब्ध नहीं है। एक मिनट में पुनः प्रयास करें।"
       - `gu`: "રીડર અત્યારે ઉપલબ્ધ નથી. એક મિનિટમાં ફરી પ્રયાસ કરો."
     - `raw.reason.unreadable`:
       - `en`: "Try again with the page flat, closer, and in more light."
       - `hi`: "पृष्ठ को सीधा, पास और अधिक प्रकाश में रखकर पुनः प्रयास करें।"
       - `gu`: "પેજને સપાટ, નજીક અને વધુ પ્રકાશમાં રાખીને ફરી પ્રયાસ કરો."

## Files Changed

- `frontend/src/i18n/index.ts`: Added `raw.reason.*` translations for en, hi, gu.
- `frontend/src/flow/navigation.ts`: Exported `RawReason`, `RAW_REASONS`, `mapRawReason`, `rawReasonSentence`, and updated `exploreAnnouncement`.
- `frontend/src/screens/Capture.tsx`: Passed mapped `rawReason` through `onScene`.
- `frontend/src/App.tsx`: Received `rawReason` in `handleScene` and passed to `exploreAnnouncement`.
- `frontend/tests/raw.reason.test.ts`: New comprehensive test suite.

## Tests Added

`frontend/tests/raw.reason.test.ts`:
- `mapRawReason`: Standard strings (`timeout`, `budget`, `provider`, `unreadable`).
- `mapRawReason`: Server variants (`budget_exhausted`, `no_provider`, `provider_error`, `queue_timeout`).
- `mapRawReason`: Whitespace and case-insensitivity.
- `mapRawReason`: Unknown strings (`invalid`, `error`, `blurry`, etc.) mapping to `unreadable`.
- `mapRawReason`: Missing inputs (`undefined`, `null`, `''`) mapping to `unreadable`.
- `rawReasonSentence`: Accurate sentences for all 4 reasons across `en`, `hi`, and `gu`.
- `exploreAnnouncement`: Correct sentence appended directly after `raw.announce` in all 3 languages.
- Negative test: Raw server strings are never present in announcements or spoken output.
- Negative test: AI mode scenes never receive raw reason guidance sentences.

## What Could Not Be Verified

Per UX headless run instructions:
- Shell commands (`npm test`, `npm run build`, `tsc`, `pytest`, etc.) were not executed; the orchestrator runs all validation gates.
