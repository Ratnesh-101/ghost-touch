# Ghost Host audit: spoken strings, errors, aria labels, touch targets

Auditor: Kiro. Read-only audit; no source files were changed and nothing was committed.

Scope read: `frontend/src/i18n/index.ts` (en table in full; hi/gu spot-checked), `flow/start.ts`, `flow/ask.ts`, `flow/capture.ts`, `drivers/speech.ts`, `screens/Start.tsx`, `screens/Capture.tsx`, the text-fallback and ask paths in `screens/Explore.tsx`, `components/AccessibleButton.tsx`, and the touch-target CSS (`global.css`, `explore.css`, `start.css`).

Line numbers for `i18n/index.ts` are the English table. Where I only have a key name I give the key.

## 1. Overall result

- **Touch targets:** no real violation found. Every interactive control goes through `AccessibleButton` (`.gt-control`, `min-width/min-height: var(--gt-target)` = 48 px, `global.css:34,82-85`) or a screen class with the same minimum. The 44 px and 38 px boxes in `start.css:65-66,148-149` are `aria-hidden` decoration inside the Start button, so they are not targets. One risk is listed as GH-10.
- **Aria labels:** every control has an accessible name. A few `aria-label`s only repeat the visible text (`LabSettings.tsx:375`, `Build.tsx:269`, `Capture.tsx:336`). That is harmless, so it is not a finding.
- **Spoken strings:** the wording is plain and always offers a next step in the Capture and Raw Mode paths. The weak spots are the Ask errors (technical words, the text box is never located) and the start sequence (no greeting, no "what happens next").
- **Speech driver:** the one real defect is the missing-voice notice (GH-06).

## 2. Findings

Severity: High = harms a blind user or breaks a core flow. Medium = wrong or confusing in a realistic case. Low = polish.

| ID | Severity | File:line | Issue | Suggested wording / fix |
|---|---|---|---|---|
| GH-01 | Medium | `screens/Explore.tsx:1388` (voice ask `finally`), text box at `Explore.tsx:2980-3012`; strings `i18n/index.ts:74-81` | Every Ask error says "You can type your question instead", but after a failed voice ask focus goes back to the Ask button (`focusAfterRender(askButtonRef)`), not to the text box that was just revealed. A blind user is told to type, and is never told where the box is or taken to it. Only the text-submit failure path (`Explore.tsx:1474`) focuses the input. | Move focus to `textInputRef` when `onFallbackNeeded` fires, and say where: "I couldn't hear that. A typing box is now open below the diagram. Type your question and press Send." |
| GH-02 | Medium | `i18n/index.ts:74-79` (`ask.errorNoSpeech`, `errorDenied`, `errorTimeout`, `errorServer`, `errorOffline`) | Error lines use technical words: "Request timed out", "Server error", "Network error", "Microphone permission denied". They say what failed, not what to do. `errorDenied` does not say how to fix it. `errorServer` is also used for `busy`, `http` and `bad-response` (`flow/ask.ts:128-130`), so three different causes get one line. | Ghost Host wording in section 3. Keep the next step first, the joke (if any) last. Split `busy` from `http` so "try again in a few seconds" is only said when it is true. |
| GH-03 | Medium | `flow/start.ts:41-47`, `screens/Start.tsx:33-37`, `i18n/index.ts:59` | The opening line is only "Ghost Touch. Tap anywhere to begin." There is no greeting, no one-line purpose and no hint of what comes next. The tap then speaks `capture.prompt` (`start.ts:62`), a list of three options with no lead-in. For a first-time blind user the app never says what it does. "Tap" is also wrong for TalkBack users, who must double-tap (the Explore screen has a separate TalkBack hint, Start does not). | "Hi, I'm Ghost Host. I turn diagrams into touch and sound. Tap anywhere to begin. With TalkBack, double-tap." After the tap: "Okay. Take a photo of a diagram, choose an image, or try a sample. Samples work without internet." |
| GH-04 | Medium | `screens/Start.tsx:35-36,69` | Start speaks the intro through `speechSynthesis` and also calls `surface.current?.focus()` on a button whose `aria-label` is the same sentence. With TalkBack on, the focus announcement and the synthesized speech play together, so the intro is heard twice or overlapping. `StatusText` already solves this for status lines (`components/StatusText.tsx:1-12`) but Start does not use the same rule. | Keep the focus and the `aria-label`, and skip `speakIntro` when a screen reader is active. If detecting that is not wanted, give the label a short name ("Ghost Touch, start") and let the synthesized intro carry the greeting. Test on a TalkBack device before choosing. |
| GH-05 | Medium | `flow/start.ts:28-33` (`speakLangOffer`), `screens/Start.tsx:35`, `flow/start.ts:62` | `speakLangOffer` writes the "spoken" flag (`gt_lang_offer_spoken`) before anything is heard. Chrome often blocks speech before the first tap (the code comments say so), and a tap straight after the intro calls `speak` without `queue`, which cancels the offer. In both cases the offer is marked done and never repeated, so the user never learns Hindi and Gujarati exist. | Set the flag from the utterance's `end` event (needs a callback in `SpeechDriver`, which is agy's file), or speak the offer after the first tap, queued after the capture prompt. |
| GH-06 | Medium | `drivers/speech.ts:313-318`, `i18n/index.ts:206` | The missing-voice notice inserts `lang.split('-')[0].toUpperCase()` into the text, so it says "No system voice found for HI." and a text-to-speech voice reads "HI" as the word "hi" (or "H I"). The notice is also English-only in the hi/gu tables (no translation key there), so a Hindi user with no Hindi voice hears English through the default voice. | Use the language's English name from `LANG_NAMES` (`i18n/index.ts:26-30`): "I don't have a Hindi voice on this phone, so I'll speak English for now. You can add a Hindi voice in your phone's text-to-speech settings." |
| GH-07 | Low | `i18n/index.ts:76-77` | `ask.errorTimeout` and `ask.errorListenTimeout` are different problems (server slow, or nobody spoke) but both start with "timed out"/"didn't hear". `ask.errorNoSpeech` (line 74) and `ask.errorListenTimeout` mean the same thing to the user. | Merge the two microphone lines into one. Keep a separate server-slow line. |
| GH-08 | Low | `i18n/index.ts` keys `correct.validationFailed`, `teach.invalidDiagram` | Both read raw validator output aloud ("Validation failed: {errors}"). Backend error text is not written for speech and may be long or in code-like terms. | Say a fixed sentence first, then at most the first error: "I couldn't save that. One thing to fix: {first}." |
| GH-09 | Low | `i18n/index.ts` keys `explore.backHint` vs `help.back`; `crash.message` (line 561) | Back is described two ways: "Press Back to leave." and "Swipe down with two fingers, or press Back, to leave." The crash line says "Double tap the screen" while the control is a button named "Restart" (`CrashScreen.tsx:16`). Both are understandable but inconsistent. | Use the `help.back` wording everywhere. Crash: "Oops, I tripped over my own bolts. Double-tap anywhere to restart me." |
| GH-10 | Low | `styles/explore.css:326-336` | The Explore action buttons are forced to `height: 48px` with `font-size: 0.875rem`, `padding: 2px 4px` and wrapping text. Longer Hindi or Gujarati labels, or a large system font size, can need three lines and be clipped inside a fixed 48 px height. Targets stay 48 px, but the visible label can be cut. Not verified on a device. | Use `min-height: 48px` without the fixed `height`, or allow the row to grow. Add a test that renders the `hi` and `gu` labels at 200 % font size. |
| GH-11 | Low | `i18n/index.ts` hi table header (`// TODO-REVIEW: machine-translated strings for Hindi`, line 652); gu table | Persona wording will be machine-translated like the rest. Jokes translate badly and a wrong joke next to an error harms trust. | Ship Ghost Host jokes in English only at first. Hindi and Gujarati get the plain, joke-free line until a native speaker reviews them. |
| GH-12 | Low | `i18n/index.ts` key `lab.raw.notice` | Visible text uses an em dash ("blurry — you can still feel"). Screen readers pause or read the dash inconsistently, and it is the only place that does. It is not one of the spoken strings (the spoken one is `raw.announce`), so impact is small. | Replace with a full stop. |

Checked and fine, so no finding: `capture.reading` is spoken and followed by a 1.5 s beep (`flow/capture.ts:29-31`); `capture.error*` always name the next step; `raw.announce` plus `raw.reason.*` follow "never silent failure"; the Capture screen returns focus to "Take photo" after a failure (`Capture.tsx:260-262`); the Start button, Settings dialog and Crash screen all have names and 48 px targets.

## 3. Ghost Host persona plan

Rules, in priority order. The first rule beats every other rule.

1. **Accessibility before jokes.** Every message gives the fact and the next step first. A joke may follow, never replace or delay either. Maximum one short joke clause per message.
2. **No jokes while the user is mid-task or stuck twice.** After a second failure in a row, drop the joke and be plain. No jokes in: permission errors, destructive confirmations ("Delete {title}?"), crash recovery wording after the first sentence, Spec Ghost fact-check lines (`verify.disagree`, fixed wording, never change), and anything with numbers or answers (Ask answers stay untouched).
3. **Never joke about the user, their sight, their phone or their mistakes.** The creature is the clumsy one ("my bolts", "my stitches"). This follows `product.md` principle 5.
4. **Short.** Under 20 words per sentence where possible. Plain verbs. Use a comma, not a dash, because dashes make speech engines pause oddly.
5. **Never say** "verified", "correct" or "checked" about a diagram (Spec Ghost rules). Never say "sorry" more than once per flow.
6. **Same voice, one name.** Ghost Host speaks in first person ("I"). The product name stays "Ghost Touch".

### Moments Ghost Host owns

| Moment | Today | Ghost Host line |
|---|---|---|
| Greeting (Start, first load) | "Ghost Touch. Tap anywhere to begin." | "Hi, I'm Ghost Host. I turn diagrams into touch and sound. Tap anywhere to begin." |
| After first tap | "Take a photo, choose an image, or pick a sample diagram." | "Okay. Take a photo of a diagram, choose an image, or try a sample. Samples work without internet." |
| Reading a diagram | "Reading your diagram" | "Reading your diagram. Hold on, my eyes are warming up." (beeps continue) |
| Server waking (Render cold start) | "The server is waking up. One moment." | "My brain is still waking up. This can take up to a minute. I'll tell you when it's ready." |
| Entering Explore | "Drag one finger to feel the diagram." | "Ready. Drag one finger to feel the diagram. Press Help any time." (TalkBack: "Double-tap and hold, then drag.") |
| Ask: listening | earcon only | Keep the earcon only, because spoken words would be picked up by the microphone. |
| Ask: thinking | "Thinking..." | "Let me look." |
| Raw Mode | "I couldn't fully read this diagram. You can still feel its outlines." | Keep. It is already plain and complete. |
| Goodbye / leaving | none | None. Do not add chatter on exit. |

### Error lines (replace the ask.* and capture.* defaults)

Format: what happened, what to do, optional single light clause. Apply the "no joke" rules from section 3.

| Key | Current | Suggested |
|---|---|---|
| `ask.errorNoSpeech` and `ask.errorListenTimeout` (merge) | "No speech heard. You can type your question instead." / "I didn't hear anything. ..." | "I didn't hear anything. Try again, or type your question in the box below the diagram." |
| `ask.errorDenied` | "Microphone permission denied. You can type your question instead." | "I can't use the microphone. You can allow it in the browser's site settings, or type your question in the box below the diagram." (no joke) |
| `ask.errorTimeout` | "Request timed out. ..." | "That took too long. My brain is slow today. Try again, or type your question." |
| `ask.errorServer` | "Server error. ..." | "I couldn't get an answer. Try again in a few seconds, or type your question." |
| `ask.errorOffline` | "Network error. Check your connection or type your question." | "I can't reach the internet. Check your connection and try again. Samples still work." |
| `ask.errorFailed` | "Could not hear your question. ..." | "I missed that. Try again, or type your question in the box below the diagram." |
| `ask.errorUnsupported` | "Speech recognition is not supported. You can type your question." | "This browser can't listen. Type your question in the box below the diagram." |
| `ask.errorEmpty` | "Please enter a question." | "The box is empty. Type a question, then press Send." |
| `ask.busy` | "Still answering the last question. Please wait." | "I'm still working on your last question. One moment." |
| `capture.error` | "Something went wrong. Please try again, or pick a sample." | "Something went wrong. Try again, or pick a sample." |
| `capture.errorBusy` | "The server is busy right now. Please try again in a moment." | "I'm busy with other students right now. Try again in a minute." |
| `capture.errorGateway` | "The server is waking up. Please try again in a few seconds." | "My brain is still waking up. Try again in a few seconds." |
| `capture.errorTimeout` | "The server took too long; please try again." | "That took too long. Try again, or pick a sample." |
| `capture.errorOffline` | "You are offline. Samples still work. Try again when you are connected." | Keep. Already clear. |
| `capture.errorType` | "That file type is not supported. Use a JPEG, PNG or WebP image." | "I can't read that kind of file. Use a photo, or a JPEG, PNG or WebP image." |
| `crash.message` | "Something went wrong. Double tap the screen to start again." | "Oops, I tripped over my own bolts. Double-tap anywhere to restart." |
| `raw.reason.budget` | "Today's AI limit is used up. ..." | "I've used up my reading budget for today. Saved diagrams still work. Try again tomorrow." |

Persona strings should live in new keys (for example `host.*`) or replace the existing values in place. Keep the key names above so that `askErrorMessage` and `captureErrorMessage` need no change.

### Implementation order (suggested, small steps)

1. Fix the functional gaps first, because they change behaviour, not wording: GH-01 (focus to the text box), GH-05 (offer flag), GH-06 (voice notice name), GH-04 (double read on Start).
2. Replace the English error values listed above. Keys and callers stay the same.
3. Add the greeting and post-tap lines (GH-03).
4. Leave Hindi and Gujarati plain and joke-free until a native speaker reviews them (GH-11).
5. Tests to add: a snapshot of every `ask.error*` and `capture.error*` string asserting it contains a next-step word ("try", "type", "choose", "pick") and is under 25 words; a test that no string contains "verified", "correct" (as a diagram claim) or "checked" in the persona set; a test that focus lands in `#gt-ask-input` after a failed voice ask.

## 4. Who fixes what

| Finding | Owner |
|---|---|
| GH-01, GH-03, GH-04, GH-06, GH-08, GH-09, GH-10, GH-12 | agy (screens, flow, CSS, i18n values) |
| GH-02, GH-07 | agy (strings). A wording review by the owner is needed before shipping. |
| GH-05 | agy for the driver callback and `flow/start.ts`. No `frontend/src/core` change. |
| GH-11 | Owner (native-speaker review) |

No finding touches `frontend/src/core`, the tuned haptic values, or `verify.disagree`.
