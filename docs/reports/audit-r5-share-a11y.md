# Audit Report: Lane r5-share-a11y

**Status: DONE**  
**Auditor:** agy, reviewed by Claude  
**Date:** 2026-11-09  
**Scope:** `frontend/src/components/ShareGate.tsx`, `VerifiedBanner.tsx`, `LanguageSelector.tsx`,
`RateSelector.tsx`, `Logo.tsx`, `frontend/src/flow/share.ts`, `frontend/src/share/index.ts`,
`frontend/src/screens/Explore.tsx` (A11Y changes), `frontend/src/App.tsx` (share-route code),
`frontend/src/i18n/index.ts` (`share.*` and a11y strings in en, hi, gu),
tests `m3.sharedLinkGate.test.ts` and `m1.a11y.test.tsx`.

---

## 1. Executive Summary

This audit evaluated accessibility, honesty enforcement, touch target compliance, internationalization
parity, and test validity across the shared link gating and accessibility components.

Key discoveries include:
1. **Sanitizer bypass via modern checkmark emojis and invisible Unicode marks (`R5-01`):** `sanitizeShareName`
   and `sanitizeShareTitle` fail to match the ubiquitous mobile checkmark emoji `✅` (U+2705), directional
   marks (`\u200E`, `\u202E`), zero-width spaces (`\u200B`), and Indic badge words (`सत्यापित`, `પ્રમાણિત`),
   allowing badges and "verified" claims to bypass sanitization entirely.
2. **Jarring contradiction in honesty wording (`R5-02`):** The entry announcement states that the diagram is
   "not checked", but the very next sentence speaks `share.honesty`, claiming "Verified means a person reviewed
   this diagram", creating user confusion and misleading blind students.
3. **Sham test for GT-06 storage failure guard (`R5-03`):** Test `storage failure does not invoke speech.speak
   during Explore entry` in `m3.sharedLinkGate.test.ts` merely tests a mocked store without invoking `saveDiagram`
   or any application logic.
4. **Dual-speech collisions on ShareError and VerifiedBanner note (`R5-04`, `R5-05`):** Mounting assertive
   `role="alert"` in `ShareError.tsx` and expanding notes inside `<aside role="status">` in `VerifiedBanner.tsx`
   cause TalkBack to speak simultaneously with Web Speech synthesis.
5. **Template injection corruption via `$` in names or titles (`R5-06`):** Using `string.replace(target, replacement)`
   without function replacers causes author names or titles containing `$` to corrupt output with `{name}` placeholders.

---

## 2. CONFIRMED Findings (Highest Severity First)

#### R5-01 · HIGH · frontend/src/flow/share.ts:19,25-26
- **Problem:** `LEADING_CHECKMARKS` regex is defined as `/^[✓✔☑√\s]+/u` and only matches four specific Unicode
  symbols (`✓`, `✔`, `☑`, `√`). It fails to match `✅` (U+2705 White Heavy Check Mark emoji, standard on mobile
  keyboards), `🗹` (U+1F5F9), or `✔️` with variation selector (U+2714 U+FE0F). Additionally, JavaScript's `\s`
  does not match directional formatting characters (U+200E LRM, U+200F RLM, U+202E RLO), zero-width spaces
  (U+200B), or combining diacritical marks. Because `LEADING_CHECKMARKS` and `LEADING_BADGE_WORDS` both anchor
  at `^`, prepending any directional mark or emoji prevents matching. Furthermore, `LEADING_BADGE_WORDS` only
  matches English "verified" and "certified", ignoring Hindi `सत्यापित` and Gujarati `પ્રમાણિત`.
- **Quote:**
  Line 19: `const LEADING_CHECKMARKS = /^[✓✔☑√\s]+/u;`  
  Lines 25-26: `const LEADING_BADGE_WORDS = /^(?:verified|certified)(?:\s*(?:and|&)\s+|[:\s,.-]+|\s+|$)/i;`
- **Concrete failure scenario:** A user shares a diagram with author name `"✅ Verified NCERT"` or
  `"\u200E✓ Verified Mrs Sharma"` or `"सत्यापित शिक्षक"`. `LEADING_CHECKMARKS` fails to match the leading
  character. `LEADING_BADGE_WORDS` fails to match. `sanitizeShareName` returns the string unstripped. The Explore
  screen displays `"Shared by ✅ Verified NCERT, not checked"`, displaying the prominent verification checkmark
  and badge word, deceiving visually impaired and low-vision students into believing the diagram is verified.
- **Minimal fix:** In `frontend/src/flow/share.ts`:
  1. Strip leading Unicode directional formatting, zero-width characters, and combining marks
     (`[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\p{M}]` with `/u`).
  2. Include `\u2705` (`✅`), `\u{1F5F9}` (`🗹`), and `\uFE0F` in `LEADING_CHECKMARKS`.
  3. Include localized badge words `सत्यापित` and `પ્રમાણિત` in `LEADING_BADGE_WORDS`.

#### R5-02 · HIGH · frontend/src/i18n/index.ts:281,598,915 (and frontend/src/flow/share.ts:124,129)
- **Problem:** Requirement R1 states: *"Never say 'Verified' for link content; say 'Shared by <name>, not checked'
  style wording. Honesty is the rule."* However, `share.honesty` in `frontend/src/i18n/index.ts` hardcodes:
  `'Verified means a person reviewed this diagram. It is not cryptographic proof.'` In `buildHonestShareAnnouncement`
  (`frontend/src/flow/share.ts:123-130`), `honestSharedByLabel` ("Shared by <name>, not checked") and `t('share.honesty')`
  are joined into a single spoken entry utterance.
- **Quote:**
  Line 281: `'share.honesty': 'Verified means a person reviewed this diagram. It is not cryptographic proof.'`
- **Concrete failure scenario:** A student taps "Open the shared diagram". The app speaks aloud:
  `"... Shared by Alice, not checked. Verified means a person reviewed this diagram. It is not cryptographic proof."`
  The announcement first asserts the diagram was "not checked", but the very next sentence speaks the word
  "Verified" and explicitly claims that "a person reviewed this diagram". This contradicts the "not checked" status,
  misleads blind students into believing a human teacher reviewed and checked the diagram, and violates honesty.
- **Minimal fix:** Rephrase `share.honesty` across `en`, `hi`, and `gu` to remove the assertion that a person
  reviewed the diagram and eliminate the word "Verified":
  `'This diagram was shared as a link and has not been verified or checked by Ghost Touch.'`  
  (Hindi: `'यह आरेख एक लिंक के रूप में साझा किया गया है और घोस्ट टच द्वारा जाँचा या सत्यापित नहीं किया गया है।'`)  
  (Gujarati: `'આ આકૃતિ લિંક તરીકે શેર કરવામાં આવી છે અને ગોસ્ટ ટચ દ્વારા ચકાસાયેલ કે પ્રમાણિત નથી.'`)

#### R5-03 · HIGH · frontend/tests/m3.sharedLinkGate.test.ts:288-325
- **Problem:** Test `'storage failure does not invoke speech.speak during Explore entry'` purports to verify
  Requirement GT-06 (that `saveDiagram` storage failure in `App.tsx` does not cancel Explore speech). However,
  the test body creates a mocked `MemoryDiagramStore` and a mock `speech` driver, manually calls
  `speech.speak(sceneAnnouncement, 'en-IN')`, awaits `mockDrivers.diagramStore.list()`, and asserts
  `expect(speech.speak).toHaveBeenCalledTimes(1)`. It never calls `saveDiagram`, never renders `App.tsx`, and never
  tests any application code.
- **Quote:**
  Line 321: `const listRes = await mockDrivers.diagramStore.list();`
- **Concrete failure scenario:** If a regression is introduced into `App.tsx:saveDiagram` that invokes
  `drivers.speech.speak(t('saved.errorSave'))` upon IndexedDB storage failure (cutting off the Explore announcement),
  this test still passes with 100% green status because it only calls `failingStore.list()` which has no reference
  to `speech`.
- **Minimal fix:** Rewrite the test to execute `saveDiagram` from `App.tsx` with a failing `diagramStore` and assert
  that `speech.speak` call count remains 1 and that status text receives the error message.

#### R5-04 · MED · frontend/src/App.tsx:339 and frontend/src/screens/ShareError.tsx:47
- **Problem:** When a shared link has an invalid or corrupted hash (`resolution.kind === 'error'`), `App.tsx:339`
  invokes `speakShareAnnouncements(drivers.speech, resolution, LANG_BCP47[currentLang]);`, speaking the error
  message through Web Speech synthesis. Concurrently, `ShareError.tsx` mounts `<section role="alert">` containing
  the exact same message. `role="alert"` is an assertive ARIA live region.
- **Quote:**
  Line 339 (`App.tsx`): `speakShareAnnouncements(drivers.speech, resolution, LANG_BCP47[currentLang]);`  
  Line 47 (`ShareError.tsx`): `<section className="gt-share-error__card" role="alert">`
- **Concrete failure scenario:** A user opens a corrupted share link (`#s=invalid`). Web Speech synthesis begins
  speaking `errorMessage`. Concurrently, TalkBack intercepts the newly mounted `role="alert"` element and speaks
  the same message in the system screen-reader voice. Both voices speak at the exact same instant, resulting in
  dual-voice collision.
- **Minimal fix:** Use the existing `StatusText` component pattern from `Capture.tsx` and `Explore.tsx` (which
  omits the live region when `drivers.speech.canSpeak` is true) or avoid calling `speakShareAnnouncements` on mount
  when `role="alert"` is active.

#### R5-05 · MED · frontend/src/components/VerifiedBanner.tsx:41,55,80-86
- **Problem:** In `VerifiedBanner.tsx`, the outer container has `role="status"` (line 55), making it a polite
  ARIA live region. When the user taps the "Read note" button, `handleToggleNote` (line 41) calls `onSpeak(cleanNote)`,
  invoking `drivers.speech.speak(cleanNote)` via Web Speech. Simultaneously, `showNote` flips to `true`, injecting
  the note body paragraph (`<div className="gt-verified-banner__note-body"><p><bdi>{cleanNote}</bdi></p></div>`)
  into the DOM inside the `role="status"` live region.
- **Quote:**
  Line 41: `onSpeak(cleanNote);`  
  Line 55: `<aside className="gt-verified-banner" role="status" aria-label={labelText}>`
- **Concrete failure scenario:** A TalkBack user taps "Read note". Web Speech begins speaking `cleanNote`.
  Concurrently, TalkBack detects the DOM mutation inside the `role="status"` live region and reads the note text aloud
  in the screen-reader voice, producing dual speech on one action.
- **Minimal fix:** Remove `role="status"` from the outer `<aside>` (or mark the note container `aria-live="off"`),
  so that speech is handled exclusively by either the speech driver or the screen reader, not both.

#### R5-06 · MED · frontend/src/flow/share.ts:75,91 and frontend/src/flow/navigation.ts:60
- **Problem:** In `honestSharedByLabel`, `formatShareTitleAnnouncement`, and `exploreAnnouncement`, string interpolation
  is performed via `string.replace('{name}', clean)` and `string.replace('{title}', clean)`. In JavaScript, the second
  argument of `String.prototype.replace` treats `$&`, `$'`, and `$1`-`$99` as special replacement patterns.
- **Quote:**
  Line 75 (`share.ts`): `return t('share.sharedBy').replace('{name}', clean);`  
  Line 91 (`share.ts`): `const prefix = t('share.titlePrefix').replace('{title}', trimmedTitle);`  
  Line 60 (`navigation.ts`): `name = clean !== '' ? t('share.titlePrefix').replace('{title}', clean) : scene.kind;`
- **Concrete failure scenario:** An author's name is `"Prof. $& Sharma"` or diagram title contains `"Budget: $&"`.
  When `t('share.sharedBy').replace('{name}', "Prof. $& Sharma")` runs, JavaScript replaces `$&` with the matched
  pattern `"{name}"`, resulting in `"Shared by Prof. {name} Sharma, not checked"`. If `$'` is used, it duplicates
  the remaining template text (`"Shared by Prof. , not checked, not checked"`).
- **Minimal fix:** Use the codebase's `tf()` utility from `i18n/index.ts` or a replacer function:
  `t('share.sharedBy').replace('{name}', () => clean)`.

#### R5-07 · MED · frontend/src/flow/navigation.ts:14,61,87 and frontend/src/screens/Explore.tsx:1255,1304
- **Problem:** When a diagram title is missing or stripped because it consisted entirely of spoofed badge words,
  `sceneName(scene)` falls back to `scene.kind`. `scene.kind` contains untranslated English code identifiers
  (`'geometry'`, `'function_graph'`, `'bar_chart'`, `'unknown'`). These are rendered in `Explore.tsx:1255`
  (`<h1 className="gt-explore__title">{sceneName(scene)}</h1>`) and in `canvasAriaLabel(scene)` (`navigation.ts:87`).
- **Quote:**
  Line 14 (`navigation.ts`): `return typeof title === 'string' && title.trim() !== '' ? title : scene.kind;`  
  Line 61 (`navigation.ts`): `: scene.kind;`
- **Concrete failure scenario:** A student with language set to Hindi or Gujarati explores a shared diagram
  without a title or whose title was `✓ Verified`. The main `<h1>` heading displays `"function_graph"`, and
  TalkBack announces `"function_graph. डबल-टैप करके दबाए रखें..."`. Raw English programming identifiers leak directly
  into Indic screen-reader and visual output.
- **Minimal fix:** Map `scene.kind` through localized keys `t('kind.' + scene.kind)` or fall back to
  `t('share.gate.heading')` when `scene.title` is empty.

#### R5-08 · LOW · frontend/src/components/ShareGate.tsx:41-42
- **Problem:** In `VerifiedBanner.tsx`, author names and notes are wrapped in `<bdi>` elements to isolate untrusted
  bidirectional text from surrounding LTR UI elements. In `ShareGate.tsx:39-44`, `title` and `sharedBy` are rendered
  as plain text children of `<p>` without `<bdi>` isolation.
- **Quote:**
  Line 41: `{title && <p className="gt-share-gate__diagram-title">{title}</p>}`  
  Line 42: `{sharedBy && <p className="gt-share-gate__diagram-by">{sharedBy}</p>}`
- **Concrete failure scenario:** A shared diagram title contains an unclosed Right-to-Left Override character
  (`\u202E`, RLO) or RTL phrase. Because `ShareGate.tsx` lacks `<bdi>` isolation, the bidirectional override spills
  out of the card into the parent flex container and following button, reversing the visual text of "Open the
  shared diagram".
- **Minimal fix:** Wrap `{title}` and `{sharedBy}` in `<bdi>` elements inside `ShareGate.tsx`:
  `<p className="gt-share-gate__diagram-title"><bdi>{title}</bdi></p>`.

#### R5-09 · LOW · frontend/src/components/ShareGate.tsx:42 and frontend/src/App.tsx:670
- **Problem:** `App.tsx:670` passes `sharedBy={view.resolution.verified.by}` to `ShareGate`, which is the bare
  cleaned name (e.g. `"Alice"`). `ShareGate.tsx:42` renders `<p className="gt-share-gate__diagram-by">{sharedBy}</p>`
  without any localized prefix or accessible description.
- **Quote:**
  Line 42 (`ShareGate.tsx`): `{sharedBy && <p className="gt-share-gate__diagram-by">{sharedBy}</p>}`  
  Line 670 (`App.tsx`): `sharedBy={view.resolution.verified.by}`
- **Concrete failure scenario:** A student opens a shared diagram from "Mrs. Sharma". TalkBack reads the card lines:
  "Right Triangle ABC", then reads "Mrs. Sharma" in isolation. A blind student has no context indicating whether
  "Mrs. Sharma" is an author or a diagram label. In Hindi and Gujarati, no Indic descriptor appears.
- **Minimal fix:** Use `honestSharedByLabel(sharedBy)` in `ShareGate.tsx:42`:
  `<p className="gt-share-gate__diagram-by"><bdi>{honestSharedByLabel(sharedBy)}</bdi></p>`.

#### R5-10 · LOW · frontend/src/components/LanguageSelector.tsx:61
- **Problem:** In `LanguageSelector.tsx:61`, the button accessible name is computed as
  `aria-label={`${info.english} (${info.native})`}`. For English, `LANG_NAMES.en` has `native: 'English'` and
  `english: 'English'`, evaluating to `aria-label="English (English)"`.
- **Quote:**
  Line 61: `aria-label={`${info.english} (${info.native})`}`
- **Concrete failure scenario:** When focusing the English language button, TalkBack announces
  `"English (English), button, selected"`. The repeated word sounds like an utterance glitch.
- **Minimal fix:** Check `info.english === info.native` and emit `info.english` alone when identical:
  `aria-label={info.english === info.native ? info.english : `${info.english} (${info.native})`}`.

#### R5-11 · LOW · frontend/src/components/RateSelector.tsx:21-25,60
- **Problem:** `RateSelector.tsx:22-24` hardcodes `multiplierText: '0.8x'`, `'1.0x'`, `'1.25x'` with an ASCII `'x'`.
  `frontend/src/i18n/index.ts:1081-1100` already defines `formatRateMultiplier(rate)` to format multipliers with the
  proper multiplication symbol `'×'` (`'0.8×'`).
- **Quote:**
  Line 22: `{ id: 'slow', labelKey: 'rate.slow', multiplierText: '0.8x' },`
- **Concrete failure scenario:** In Hindi or Gujarati, TalkBack reads `aria-label`: `"धीमी गति (0.8x)"`, pronouncing
  the English letter "एक्स" instead of a clean rate multiplier.
- **Minimal fix:** Use `formatRateMultiplier(id)` or localized multiplier formatting instead of hardcoded ASCII strings.

#### R5-12 · LOW · frontend/src/App.tsx:126
- **Problem:** `resolveShareRoute` defaults `useHonest` to `false` (`options?.honest ?? false`). If called without
  `{ honest: true }`, it constructs legacy announcements with `t('share.verifiedBy')` ("Verified by {name}").
- **Quote:**
  Line 126: `const useHonest = options?.honest ?? false;`
- **Concrete failure scenario:** Any caller invoking `resolveShareRoute(hash)` without explicitly passing
  `{ honest: true }` receives the legacy announcement containing "Verified by {name}", bypassing honesty rules.
- **Minimal fix:** Default `useHonest` to `true` (`options?.honest ?? true`).

---

## 3. Meaningless / Weak Tests Identified

1. **`m3.sharedLinkGate.test.ts:288-325` (`GT-06 saveDiagram Failure Speech Cancellation Guard`):**  
   Asserts nothing meaningful about `saveDiagram`. It creates a mock store with failing `list()`, manually
   invokes `speech.speak(sceneAnnouncement)`, calls `failingStore.list()`, and asserts `speech.speak` call count
   remains 1. It never touches `saveDiagram` or `App.tsx`.
2. **`m1.a11y.test.tsx:146-152` (`preserves exported helpers for backward compatibility`):**  
   Tests `resolveCanvasAriaLabel`, which returns `undefined` when `canSpeak` is true. `Explore.tsx:1304` no longer
   calls `resolveCanvasAriaLabel` (it assigns `aria-label={canvasAriaLabel(scene)}` unconditionally). The test
   verifies dead helper logic that does not match component behavior.

---

## 4. Sound Areas (Checked and Verified)

- **GT-05 Cold Shared Link Gating:** Cold shared diagram links (`#s=...`) never open Explore mode without explicit
  user activation. In `App.tsx`, initial load and hash changes resolve to `{ screen: 'shareGate', resolution }`,
  requiring a physical tap on `AccessibleButton` ("Open the shared diagram") to unlock audio and navigate to Explore.
- **Touch Target Sizes (>= 48x48 CSS px):** All buttons across `ShareGate.tsx`, `VerifiedBanner.tsx`,
  `LanguageSelector.tsx`, `RateSelector.tsx`, and `Explore.tsx` enforce touch targets of at least 48×48 CSS px
  via `.gt-control` and explicit CSS declarations.
- **XSS Immunity via React Children:** Author names, diagram titles, and notes are rendered exclusively as React
  text children (`{title}`, `{sharedBy}`, `{cleanNote}`) without `dangerouslySetInnerHTML`.
- **Offline Share Decoding:** `decodeShare` in `src/share/codec.ts` operates entirely offline via `lz-string`
  and client-side schema validation, making zero network calls.
- **Decorative Logo SVGs:** `Logo.tsx` properly applies `aria-hidden="true"` and `focusable="false"` when
  `decorative={true}` and conditionally omits `<title>` to prevent screen reader leakage.
- **Selector Focus Cleanliness:** `LanguageSelector.tsx` and `RateSelector.tsx` have no `onFocus` speech handlers,
  relying on native accessible names and producing exactly one spoken confirmation upon user selection.
- **Document Root Lang Synchronization:** `updateDocumentLang` in `i18n/index.ts` correctly synchronizes
  `<html lang="...">` on startup and on every language switch (`setLang`) across `en`, `hi`, and `gu`.

---

## 5. Top 5 to Fix First

1. **R5-01 (`flow/share.ts:19,25`):** Add `✅` (U+2705), directional marks (`\u200E`, `\u202E`), zero-width spaces,
   and Indic words (`सत्यापित`, `પ્રમાણિત`) to `stripLeadingBadge` to prevent sanitizer bypass.
2. **R5-02 (`i18n/index.ts:281,598,915`):** Remove "Verified means a person reviewed this diagram" from `share.honesty`
   to resolve the contradiction with "not checked".
3. **R5-03 (`tests/m3.sharedLinkGate.test.ts:288-325`):** Replace sham storage failure test with real integration
   test exercising `saveDiagram`.
4. **R5-04 (`App.tsx:339`, `ShareError.tsx:47`):** Suppress duplicate Web Speech on `ShareError` mount to eliminate
   dual-voice collision with `role="alert"`.
5. **R5-05 (`VerifiedBanner.tsx:41,55`):** Prevent dual speech when opening notes by removing `role="status"` live
   region from `<aside>`.
