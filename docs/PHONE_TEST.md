# Ghost Touch — 20-Minute OnePlus Nord CE6 Phone Test Script

> **Target Device:** OnePlus Nord CE6 (Android / Google Chrome over HTTPS)  
> **Total Time Budget:** ~20–22 minutes (excluding Step 0 cold-start wake)  
> **Date Prepared:** 2026-11-06  
> **Author:** Antigravity (agy)  
> **Test Document Target:** Single-hand operation with stopwatch

---

## Browser check results (Playwright, 2026-11-24 and 25): what is already checked, what is left for the phone

> [!WARNING]
> This is an **emulated Chrome in Playwright**, not a phone. It proves the app makes the right calls (vibrate, speak, set a tone), shows the right text and layout, and handles touch, offline and links correctly. It does **not** prove that a motor buzzes, how a voice sounds, how TalkBack behaves, what the camera sees, or how anything looks in sunlight. A PASS below never replaces the phone row: it only means that row is unlikely to fail for a software reason. Backend answers in the Ask and photo rows are mocked here.
>
> Rerun: `cd frontend && npx playwright test e2e/phone-test-emulated*.spec.ts` (it builds and serves on port 4173; stop any other preview server first). Test titles start with the row number, for example "PT 4.2".

| Step | Checked in the browser (PASS) | Left for the phone |
|---|---|---|
| 0 wake backend | 0.1, 0.2: `/api/v1/health` returned `{"ok":true}` in 28 s from a cold start (checked live from a laptop) | timing on the phone's network |
| 1 PWA | 1.3, 1.4: manifest name, standalone display, `#0b0e0c` background, icons | 1.1, 1.2 install prompt, icon look, splash |
| 2 start | 2.2: tap vibrates 50, speaks the capture prompt, shows Capture | 2.1 spoken intro (autoplay), mascot look, earcon sound |
| 3 settings | 3.1 to 3.9: opening and closing each speak once (fixed by lane hi18 after this pass found they did not), language confirmations in en, hi and gu, speech speed (the real rate is 1.1 x 0.8, 1.0 and 1.25, not 0.8, 1.0 and 1.25 as the rows say), Guide and Teacher switches, language persists after a reload | focus feel, scrim |
| 4 explore (TalkBack off) | 4.1 to 4.6: announcement, `vibrate(80)` on a line, `vibrate(0)` off it, `[50,90,50]` and the label at a corner, no line buzz for 450 ms, sine tone inside 200 to 1000 Hz and rising with height, bar label | whether it is felt and heard, how the pitch sounds |
| 5 explore (TalkBack on) | nothing | all of it |
| 6 voice commands | 6.2 to 6.7 command handling with a fake recogniser (describe, help, next corner, where am I, repeat, faster, normal speed) | the real microphone and recognition accuracy in en, hi and gu |
| 7 Ask | 7.1 to 7.3 plumbing with a mocked backend: Thinking, spoken answer, the exact fallback line, the typed fallback sends the question | real answers (backend), the keyboard on the phone |
| 8 photo | 8.2 to 8.5 through a file upload with a mocked backend: Reading your diagram, Explore opens, the Raw Mode announcement, a failure is never silent | 8.1 camera, 8.4 which mode a real photo gets |
| 9 PDF | not automated | all of it |
| 10 saved offline | 10.1 to 10.6: saved, pin spoken, opens with the network off and no API call, line buzz works offline | real airplane mode |
| 11 Correct | 11.1, 11.3 to 11.5: opens, point drag spoken, undo and redo spoken, save validates and confirms | 11.2 scrim look, drag feel |
| 12 hi and gu | the spoken text is in the chosen language | installed voices, pronunciation (the utterance language tag depends on the voices installed) |
| 13 Guide | 13.1, 13.7, 13.8: "take me to B" starts, "stop" and Back stop it | 13.2 to 13.6, 13.9: audio pan, arrival feel, the 20 s timeout |
| 14 share | 14.1 the route opens with Teacher tools on and is ignored with them off, 14.5 and 14.7 a share link opens (through its gate button) and a truncated one is refused, offline by a URL fragment change | 14.2 to 14.4 QR from a second device, 14.6 a true offline reload (needs the service worker) |
| 15 highlight | 15.4 to 15.7: clears on lift, follows the remaining finger, the feel calls are unchanged, layout is stable (other specs) | 15.1 to 15.3 how it looks |
| 16 Help | 16.1 to 16.4, 16.6 to 16.9: size and position, spoken once, second-finger tap, slid-off tap, the Raw sentence, Help during Guide, landscape footer, rotation | 16.5 TalkBack double-tap |
| 17 Planchette | 17.1 to 17.4, 17.6, 17.7, 17.9, 17.10, 17.12, 17.13: steps spoken on reaching the part, next step, repeat, Your turn with wrong rests (including a perfectly still finger, found broken by this pass and fixed by task 89), stop, no extra vibration, no walk on a Raw photo, a long sentence is a question | 17.5 lift feel, 17.8 the two-minute idle end (unit-tested only), 17.14 TalkBack. **17.11:** the sine sample DOES show a Walk me through button: record it as a discrepancy with the request, as the row says |
| 18 Ghost Hand | 18.1 to 18.4, 18.6 to 18.9, 18.11 to 18.15: sliders with value text, Pin speaks x and y without brackets, an occupied spot is refused, undo removes one at a time, stitch twice changes nothing, Feel and touching a pin, Back keeps the pins, Hand in gives a link and a list marked not checked, the link opens on the same graph, no walk on a draft. The status line after pins was reported wrong by the owner (it still said Empty graph) and fixed by lane hi17 | 18.2 sliders under TalkBack, 18.5, 18.10 by feel, whether `x 2 y 5` reads well in Android speech |
| 19 footer | 19.1 to 19.4: every footer button inside the screen, at least 48 x 48, canvas not squeezed, in English, Hindi and Gujarati at 320, 360 and 384 px, Help text reachable | 19.5 TalkBack order |

Three real defects were found by this pass and fixed before any phone test: the settings sheet never spoke opened or closed, the Ghost Hand Build status line stayed on the empty prompt after pins, and a perfectly still finger was never counted in Planchette's Your turn. See docs/BUILD_LOG.md.

---

## Critical Live Environment Facts (Verified Today, 2026-11-06)

1. **Live Frontend URL:** `https://ghost-touch-iota.vercel.app` (Vercel)  
   - The live site currently serves the **older build** (legacy theme color `#0b0b10`, no Frankenstein creature mascot or brand files) until the repository owner pushes `main` and Vercel redeploys `(verify)`.  
   - *How to handle this:* Steps or checks that mention the **Frankenstein Lab look** (creature emblem, organ tiles, copper borders, rivets) apply fully after redeployment; before redeployment, mark those visual styling checks **"n/a (old build)"**. All functional logic, haptics, Web Audio, and speech work on both builds.

2. **Live Backend URL:** `https://ghost-touch-api.onrender.com` (Render Free Tier)  
   - Render free-tier containers automatically sleep after 15 minutes of inactivity. The **first request after idle takes ~32–35 seconds** (measured 32 s today for `/api/v1/health`).  
   - **Step 0 is mandatory:** You must open `https://ghost-touch-api.onrender.com/api/v1/health` in Chrome and wait until the browser displays `{"ok":true}` **BEFORE starting your 20-minute test stopwatch**.

3. **AI Mode vs. Raw Mode (Flaky Vision Provider Warning):**  
   - On 2026-11-06, a live test with a clean triangle image returned **Raw Mode** with reason `"timeout"` because vision providers were slow or temporarily unavailable (Google Gemini returned HTTP 503 "high demand" during local spike benchmarking).  
   - Expect AI mode to be intermittent until API provider keys, timeouts, and quotas are finalized on Render.  
   - **How to tell AI Mode from Raw Mode:**
     - **AI Mode (`mode: "ai"`):** Explore screen spoken announcement reads: `<Title>. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave.`. Canvas displays clean geometric lines, point circles, and text labels. **No warning banner** is present.
     - **Raw Mode (`mode: "raw"`):** Explore screen spoken announcement begins with the fallback warning: *"I couldn't fully read this diagram. You can still feel its outlines."* (`raw.announce`). In addition, the status area displays a visible warning notice: *"The creature's eyes are blurry — you can still feel the outlines."* (`lab.raw.notice` / `raw.announce`). Canvas displays OpenCV Canny edge outlines (`kind: "unknown"`).  
     - **In Step 8, always record which mode occurred** and the elapsed seconds.

---

## Equipment & Phone Preparation (Before Starting Timer)

- **Device:** OnePlus Nord CE6 charged to at least 50%.
- **Sound:** Media Volume set to at least 80%.
- **Haptics:** Android Settings > Sound & vibration > Haptics / Touch feedback set to **ON** (intensity high).
- **TalkBack Shortcut:** Android Settings > Accessibility > TalkBack > **TalkBack shortcut set to Volume Up + Volume Down held for 3 seconds** (allows rapid 3-second toggle).
- **Physical Diagram:** One printed STEM / geometry diagram (e.g. triangle, coordinate graph, or textbook figure) placed flat on desk under clear lighting.
- **Sample PDF:** A 1-page PDF document saved locally in Android Downloads folder (or accessible via Google Drive).

---

## 20-Minute Time Budget Overview

| Phase | Step Name | Time Budget | TalkBack State |
|---|---|---|---|
| **Step 0** | Wake the Render Backend | 0 min (pre-test warmup) | OFF |
| **Step 1** | Install PWA to Home Screen | 1 min | OFF |
| **Step 2** | Start Screen & Audio Unlock | 1 min | OFF |
| **Step 3** | Lab Settings Sheet & Persistence | 2 min | OFF |
| **Step 4** | Explore Samples (Triangle, Sine, Bars) | 3 min | **OFF** |
| **Step 5** | Explore Samples with Relative Pass-Through | 3 min | **ON** |
| **Step 6** | Voice Commands in Explore | 2 min | ON or OFF |
| **Step 7** | Ask Assistant by Voice and Text | 2 min | ON or OFF |
| **Step 8** | Camera Photo Extraction (AI vs Raw) | 2 min | OFF |
| **Step 9** | PDF Upload (First Page Extraction) | 1.5 min | OFF |
| **Step 10** | Saved Diagrams under Airplane Mode | 1.5 min | OFF |
| **Step 11** | Teacher Correct Mode (Drag, Validate, Save) | 1.5 min | OFF |
| **Step 12** | Hindi & Gujarati TTS Voices | 1.5 min | OFF |
| **Step 13** | Guide My Finger (TalkBack OFF & ON, Pan vs Speaker, Cancel, Ask) | 3 min | OFF & ON |
| **Step 14** | Teacher Verify & Share (Routes `#/teach`, Link Decompression Offline, Bad Links, QR) | 3 min | OFF |
| **Step 15** | Highlight of the touched element and the dark outlines (added 2026-11-22) | ~3 min (estimate) | OFF, then ON |
| **Step 16** | Explore Help button (added 2026-11-22) | ~4 min (estimate) | OFF, then ON |
| **Step 17** | Planchette: Walk me through (added 2026-11-22) | ~6 min (estimate) | OFF, then ON |
| **Step 18** | Ghost Hand: Make my own graph (added 2026-11-22) | ~7 min (estimate) | OFF, then ON |
| **Step 19** | Compact footer at 360 px in English, Hindi and Gujarati (added 2026-11-22) | ~3 min (estimate) | OFF |
| **Total (Steps 0 to 14)** | **End-to-End Phone Evaluation** | **~27.5 min** | |
| **Total (Steps 15 to 19)** | **Added on 2026-11-22; run as a second session** | **~23 min (estimate)** | |

---

## Step 0: Wake the Render Backend (Pre-Test, 0 min on stopwatch)

> [!IMPORTANT]
> Complete this step **before** starting your 20-minute stopwatch. Do not proceed until you see `{"ok":true}`.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 0.1 | Open Chrome on OnePlus Nord CE6 and navigate to:<br>`https://ghost-touch-api.onrender.com/api/v1/health` | Browser loads. If container is asleep, the page loads for ~32–35 seconds. | |
| 0.2 | Wait for page response without navigating away. | Browser displays JSON response: `{"ok":true}` with HTTP 200 OK. Backend container is now active and warm. | |

---

## Step 1: Install as a PWA (1 min)

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 1.1 | In Chrome on OnePlus Nord CE6, open:<br>`https://ghost-touch-iota.vercel.app` | App loads over secure HTTPS. Chrome displays "Install app" prompt or "Add Ghost Touch to Home screen" banner. | |
| 1.2 | Tap Chrome three-dot menu (⋮) > **Install app** (or tap the bottom banner prompt). Tap **Install** in confirmation dialog. | Android installs PWA to app launcher. Toast confirms "Ghost Touch installed". | |
| 1.3 | Return to Android Home screen. Locate and inspect the new Ghost Touch icon. | App icon displays creature mascot (new build) or circular ghost emblem (old build), labelled "Ghost Touch". | |
| 1.4 | Tap the Home screen icon to launch the installed PWA. | Launches in standalone window without Chrome address bar or browser controls. Shows dark charcoal (`#0b0e0c`) splash background. | |

---

## Step 2: Start Screen & Audio Unlock (1 min)

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 2.1 | Observe visual layout and listen on PWA launch. | Spoken intro announces: *"Ghost Touch. Tap anywhere to begin."* (`start.intro`). If new build: shows blueprint grid, stitched creature mascot, tagline *"Feel diagrams you can't see."*, and three organ tiles (Nerves, Eyes, Voice). If old build: mark "n/a (old build)". | |
| 2.2 | Single-tap anywhere on the screen surface. | - Device delivers a single 50 ms haptic buzz (`vibrate(50)`).<br>- Web Audio oscillator unlocks; plays ascending two-tone `start` earcon (440 Hz → 660 Hz).<br>- App speaks: *"Take a photo, choose an image, or pick a sample diagram."* (`capture.prompt`).<br>- Transitions smoothly to Capture screen. | |

---

## Step 3: Settings Sheet & Persistence (2 min)

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 3.1 | On Capture screen, locate and tap the **Lab settings button** (shows e.g. "Settings: English, 1.0×"). *(Note: if old build has inline buttons, mark "n/a (old build)").* | Settings sheet slides up. Speaks: *"Lab settings opened"* (`lab.settings.opened`). Focus moves cleanly inside sheet to the first control. All buttons measure $\ge 48 \times 48$ CSS px. | |
| 3.2 | In Language section, tap **हिन्दी** (Hindi). | Immediately speaks Hindi confirmation: *"भाषा हिंदी में सेट की गई।"* (`lang.changedHi`). | |
| 3.3 | In Language section, tap **ગુજરાતી** (Gujarati). | Immediately speaks Gujarati confirmation: *"ભાષા ગુજરાતીમાં સેટ થઈ."* (`lang.changedGu`). | |
| 3.4 | In Language section, tap **English**. | Immediately speaks English confirmation: *"Language set to English."* (`lang.changedEn`). | |
| 3.5 | In Speech speed section, tap **0.8× Slow**, then **1.25× Fast**, then **1.0× Normal**. | - Tapping Slow speaks: *"Speech rate set to slow."* at 0.8× speed.<br>- Tapping Fast speaks: *"Speech rate set to fast."* at 1.25× speed.<br>- Tapping Normal speaks: *"Speech rate set to normal."* at standard 1.0× speed. | |
| 3.6 | In Guide my finger section (`lab.settings.guide`, visible when `VITE_FEATURE_GUIDE=1`), observe status and tap switch button. | Switch button toggles between *"Finger guidance disabled."* (`lab.settings.guideOff`) and *"Finger guidance enabled."* (`lab.settings.guideOn`), speaking the respective confirmation. Updates `gt_guide_enabled` in `localStorage`. | |
| 3.7 | In Teacher tools section (`lab.settings.teacher`, visible when `VITE_FEATURE_SHARE=1`), observe status and tap switch button. | - Switch button toggles between *"Teacher tools disabled."* (`lab.settings.teacherOff`) and *"Teacher tools enabled."* (`lab.settings.teacherOn`), speaking the respective confirmation. Updates `gt_teacher_enabled` in `localStorage`.<br>- When enabled, displays secondary button **"Open Teacher Editor"** (`lab.settings.openTeacher`). Tapping it navigates to `#/teach`. | |
| 3.8 | Tap **Close settings** button (or tap scrim area / press Android Back). | Sheet dismisses. Speaks: *"Lab settings closed"* (`lab.settings.closed`). Visual focus returns cleanly to the Settings trigger button. | |
| 3.9 | Swipe down from top of screen to pull-to-refresh (or close PWA and reopen). | App reloads. Inspect Settings button & sheet: chosen language, speech speed, and feature toggles remain active from `localStorage`. | |

---

## Step 4: Explore Samples with TalkBack OFF (3 min)

> [!NOTE]
> Ensure **TalkBack is OFF** during this step for direct-touch tactile evaluation.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 4.1 | On Capture screen, tap the **Right triangle** sample card (`lab.specimen.triangle` / `capture.sampleTriangle`). | Explore screen opens. Spoken announcement: *"Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave."* Canvas shows glowing green strokes on pure near-black framed by specimen table border and corner rivets (new build). | |
| 4.2 | Touch and drag a single finger directly across any triangle line stroke. | Phone vibrates continuously with `vibrate(80)` pulses repeated every 70 ms while finger remains on the line. | |
| 4.3 | Slide finger off the line into empty black space, or lift finger. | Vibration instantly stops (`vibrate(0)`). Zero residual buzz. | |
| 4.4 | Slide finger directly over any triangle vertex (corner A, B, or C). | - Phone fires sharp double-pulse "bzzzz-tap" pattern (`vibrate([50, 90, 50])`).<br>- Vertex label is spoken immediately (e.g. *"Point A"*, *"Point B"*, *"Point C. Right angle."*), cancelling prior speech.<br>- Line buzz is suppressed for exactly 450 ms quiet window so the corner pulse feels crisp. | |
| 4.5 | Tap **Back** button at top left to return to Capture. Tap the **Sine wave** sample card (`lab.specimen.sine`). | Explore screen opens with sine graph. Tracing the curve vibrates continuously (`vibrate(80)` / 70 ms) **and** plays a smooth Web Audio theremin tone gliding between 200 Hz and 1000 Hz. Pitch rises as finger moves higher on screen and falls as finger moves lower. Crossing axes speaks *"x-axis"* and *"y-axis"*. | |
| 4.6 | Tap **Back** button. Tap the **Bar chart** sample card (`lab.specimen.bars`). | Explore screen opens with bar chart. Touching each vertical bar speaks its category and value, playing a discrete tone pitch proportional to the bar's height. | |

---

## Step 5: Explore Samples with TalkBack ON (3 min)

> [!IMPORTANT]
> Turn **TalkBack ON** now (hold Volume Up + Volume Down together for 3 seconds).  
> In TalkBack mode: swipe right/left to navigate controls, double-tap to activate buttons, and use the **double-tap-and-hold then drag** gesture on the Explore canvas.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 5.1 | On Capture screen, swipe right to the **Right triangle** sample card. Double-tap to activate. | Explore opens. TalkBack focus lands on the canvas and reads the accessible diagram announcement first: *"Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave."* | |
| 5.2 | Perform the pass-through exploration gesture on canvas:<br>**Double-tap, hold down firmly on second tap, then slide finger.** | - At the exact moment hold begins, phone delivers one distinct 25 ms tick (`vibrate(25)`) and speaks *"Centre."* (`explore.centre`).<br>- Virtual finger cursor starts calibrated at center (0.5, 0.5). | |
| 5.3 | Slide held finger toward the edges across triangle lines and corners. | Relative cursor tracks held finger movement. Tracing a line vibrates continuously. Crossing a corner fires the `[50, 90, 50]` ms double-pulse and speaks vertex name aloud without TalkBack interrupting. | |
| 5.4 | Lift finger off screen completely. In a different part of the screen, perform double-tap-and-hold again. | Cursor re-centers at (0.5, 0.5), fires the 25 ms centre reference tick, and speaks *"Centre."* again cleanly. | |
| 5.5 | Use Android system Back gesture (or TalkBack 2-finger swipe down and left) to return to Capture. Open **Sine wave** sample with TalkBack. Perform double-tap-and-hold drag along the curve. | Web Audio theremin tone glides continuously between 200 Hz and 1000 Hz with wave height while TalkBack remains quiet. | |
| 5.6 | Return to Capture. Open **Bar chart** sample with TalkBack. Double-tap-and-hold across vertical bars. | Touching bars produces height tones and speaks bar values. Return to Capture screen via Back gesture. | |

---

## Step 6: Voice Commands in Explore (2 min)

> [!NOTE]
> Can be tested with TalkBack ON or OFF. Open the **Right triangle** sample in Explore.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 6.1 | Tap the **Voice command / Ask button** at bottom (`ask.button` / `commands.button`), or hold two fingers on canvas for > 500 ms. | TTS stops speaking. Plays 660 Hz listening beep. Status displays *"Listening..."* (`ask.listening`). | |
| 6.2 | When listening, say clearly:<br>**"where am I"**<br>*(Hindi: "कहाँ हूँ मैं" / "kahan hoon"; Gujarati: "હું ક્યાં છું" / "kya chu")* | Plays `success` earcon. Speaks coarse position relative to nearest vertex or open space: e.g. *"Near Point A, top left."* (`commands.whereNearVertex`) or *"In open space, centre."* (`commands.whereEmpty`). | |
| 6.3 | Tap button to listen. Say clearly:<br>**"repeat"**<br>*(Hindi: "दोहराएं" / "phir se bolo"; Gujarati: "ફરી બોલો" / "fari bolo")* | App repeats the last spoken line verbatim. | |
| 6.4 | Tap button to listen. Say clearly:<br>**"next corner"**<br>*(Hindi: "अगला कोना"; Gujarati: "આગળનો ખૂણો")* | Plays `success` earcon. Virtual cursor jumps to vertex and speaks: *"Corner 1 of 3: Point A at top left."* (`commands.cornerAnnounce`). Repeating advances to Corner 2, then Corner 3. | |
| 6.5 | Tap button to listen. Say clearly:<br>**"describe"**<br>*(Hindi: "वर्णन करें"; Gujarati: "વર્ણન કરો")* | Plays `success` earcon. Speaks diagram name and facts: *"Diagram: Right Triangle ABC. angle C = 90 degrees. AC = 4 cm. BC = 3 cm. AB = 5 cm."* (`commands.describe`). | |
| 6.6 | Tap button to listen. Say clearly:<br>**"help"**<br>*(Hindi: "मदद"; Gujarati: "મદદ")* | Plays `success` earcon. Speaks available commands list: *"Available commands: where am I, repeat, next corner, describe, rate, help."* (`commands.help`). | |
| 6.7 | Tap button to listen. Say clearly:<br>**"faster"** *(Hindi: "तेज़"; Gujarati: "ઝડપી")*, then tap and say **"normal speed"** *(Hindi: "सामान्य गति"; Gujarati: "સામાન્ય ગતિ")*. | - "faster" speaks: *"Speech rate set to fast."* (`rate.setFast`) and increases speech rate.<br>- "normal speed" speaks: *"Speech rate set to normal."* (`rate.setNormal`) and resets rate. | |

---

## Step 7: Ask by Voice and by Text (2 min)

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 7.1 | In Explore on Right Triangle, tap the **Ask** button. Speak a diagram question:<br>**"How long is AB?"** *(or "How long is BC?")* | Status shows *"Thinking..."* (`ask.thinking`). App answers in at most 2 sentences from diagram facts (e.g. *"AB = 5 cm."* or *"3 centimetres"* depending on provider response / facts lookup) `(verify)`. | |
| 7.2 | Tap **Ask** button. Speak an unanswerable question:<br>**"What colour is it?"** *(or "Who drew this?")* | Status shows *"Thinking..."*. App strictly returns the grounding fallback phrase: *"I don't know from this diagram."* (`DONT_KNOW_PHRASE`). Zero hallucinations or invented facts. | |
| 7.3 | Tap the text fallback input ("Type a question about the diagram…"). Type `"How long is AC?"` and tap **Send**. | Virtual keyboard submits query. Status shows *"Thinking..."*. App speaks answer: *"AC = 4 cm."* and displays it in status card. | |

---

## Step 8: Take Photo of a Real Textbook Diagram (2 min)

> [!IMPORTANT]
> Have your printed diagram ready on the desk. You will record whether **AI Mode** or **Raw Mode** was returned.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 8.1 | Return to Capture screen. Tap glowing green primary button: **Take photo** (`capture.takePhoto`). | Opens rear camera directly via `<input capture="environment">`. Point camera at diagram, hold steady, snap photo, tap checkmark. Start stopwatch. | |
| 8.2 | Observe loading state. | Status displays *"Reading your diagram…"*. Progress audio tone beeps every 1.5 seconds (`beep(440, 120)`). Charging bar animates (new build). | |
| 8.3 | Wait for scene processing to finish (typically 4–15 seconds). | Progress tone stops. Plays bright major-triad `success` earcon (523 → 659 → 784 Hz). Brief "It's Alive" spark animation pulses (< 1.2s). Opens Explore screen. | |
| 8.4 | **Check Mode:** Listen to the entry announcement and inspect the screen.<br>*(See "Critical Live Environment Facts" above)* | **Record which occurred:**<br>- **AI Mode:** Speaks title + gesture hint without warning. Clean geometric lines, points, and labels rendered. No warning banner.<br>- **Raw Mode:** Speaks *"I couldn't fully read this diagram. You can still feel its outlines."*. Shows banner *"The creature's eyes are blurry — you can still feel the outlines."*. Renders green Canny edge lines. | **Mode:** `AI / RAW`<br>**Reason (if raw):** `______`<br>**Time:** `______ s` |

---

## Step 9: PDF Upload (First Page Extraction) (1.5 min)

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 9.1 | Return to Capture screen. Tap **Choose image / PDF** (`capture.chooseImage`). In Android file picker, select a 1-page STEM PDF ($\le 10$ MB). | Validates MIME type (`application/pdf`). Speaks immediately: *"Using the first page of the PDF. Reading your diagram"* (`capture.firstPagePdf` + `capture.reading`). | |
| 9.2 | Wait for PDF.js client rendering and server scene extraction. | Progress tone beeps every 1.5s. First page renders to hidden canvas scaled to $\le 1600$ px longest side. Image is sent to `POST /api/v1/scene`. | |
| 9.3 | Observe completion. | Beep silences, `success` chime plays, Explore screen opens with the diagram from the PDF's first page. | |

---

## Step 10: Saved Diagrams Offline (1.5 min)

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 10.1 | Note: The diagram captured in Step 8/9 was automatically saved to local IndexedDB (`ghost-touch-db`). | Background storage write succeeded silently without user intervention. | |
| 10.2 | Swipe down Android system notification shade. **Turn Airplane Mode ON** (disconnect Wi-Fi and mobile data). | Phone is now completely offline with zero network connectivity. | |
| 10.3 | Return to Capture screen. Tap **Saved diagrams** button (`capture.savedDiagrams`). | Saved diagrams screen opens offline. Speaks list of saved diagrams (e.g. *"Saved diagrams: Right triangle..."*). | |
| 10.4 | Locate your captured diagram card. Tap the **Pin** button (`saved.pin`). | Pin icon highlights. Speaks: *"{title} pinned."* (`saved.pinned.announced`). Diagram is now protected from FIFO cap eviction. | |
| 10.5 | Tap **Open** (`saved.open`) on the diagram card. | Explore screen opens **immediately with zero network calls** while in Airplane Mode. | |
| 10.6 | Trace the diagram canvas with your finger. | Lines vibrate continuously, corners pulse, and theremin plays entirely offline. | |
| 10.7 | Swipe down shade and **turn Airplane Mode OFF** (reconnect network). | Network connection restored for remaining tests. | |

---

## Step 11: Teacher Correct Mode (1.5 min)

> [!NOTE]
> **Prerequisites:** "Teacher tools" (`lab.settings.teacher`) must be set to **ON** in Lab Settings (and `VITE_FEATURE_SHARE=1`), otherwise the **Correct** button is hidden on Explore (Requirement 48).

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 11.1 | Ensure Teacher tools is ON in Settings. In Explore on a captured photo diagram, tap the **Correct** button (`explore.correct`). | Teacher Correction screen opens. Speaks: *"Correction mode. Tap elements to select, drag points to adjust, and save when done."* (`correct.intro`). | |
| 11.2 | Inspect the screen. | Original photo is underlaid with a 40% dark contrast scrim; diagram points and line segments are overlaid in high-contrast green. | |
| 11.3 | Touch any vertex point handle (circle) and drag it 2–3 cm across the glass. | Point follows finger smoothly in real-time. On release, speaks: *"Moved point: <id>"* (`correct.pointMoved`). | |
| 11.4 | Tap **Undo** button (`correct.undo`), then tap **Redo** button (`correct.redo`). | - Undo returns point to prior position; speaks *"Undo"*. - Redo restores the dragged position; speaks *"Redo"*. | |
| 11.5 | Tap **Save** button (`correct.save`). | Status displays *"Validating diagram…"*. Sends `POST /api/v1/validate` to backend. When valid, speaks *"Corrections saved."* (`correct.saved`), plays `success` chime, and returns to Explore with updated diagram. | |

---

## Step 12: Hindi and Gujarati Speech Voices (1.5 min)

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 12.1 | Open Lab Settings. Tap **हिन्दी** (Hindi). Tap Close. Listen to Capture screen prompt. Open Triangle sample in Explore and listen to speech. | - Capture speaks: *"फोटो लें, कोई छवि चुनें, या कोई नमूना चित्र चुनें।"* (`capture.prompt`).<br>- Explore speaks: *"समकोण त्रिभुज... डबल-टैप करके दबाए रखें, फिर चित्र महसूस करने के लिए खींचें। आप केंद्र से शुरू करते हैं।"* (`explore.gestureHint`). | |
| 12.2 | Open Lab Settings. Tap **ગુજરાતી** (Gujarati). Tap Close. Listen to Capture prompt and Explore announcements. | - Capture speaks: *"ફોટો લો, ઇમેજ પસંદ કરો, અથવા નમૂના આકૃતિ પસંદ કરો."* (`capture.prompt`).<br>- Explore speaks: *"નમૂનો: ત્રિકોણ... ડબલ-ટેપ કરીને દબાવી રાખો, પછી આકૃતિ અનુભવવા માટે ખેંચો. તમે કેન્દ્રથી શરૂ કરો છો."* (`explore.gestureHint`). | |
| 12.3 | **Voice Naturalness & Missing Voice Notice:** Listen closely to pronunciation quality. | - If natural Hindi / Gujarati system voices are installed: speaks with authentic Indian language phonetics.<br>- If the phone lacks a Gujarati or Hindi voice pack: WebSpeechDriver speaks notice once per session: *"No system voice found for HI/GU. Using default voice."* before falling back to default voice `(verify)`. | |
| 12.4 | **Where to install Hindi & Gujarati voices on OnePlus / Android (if missing):**<br>1. Android Settings > **System settings** (or **Additional settings**) > **Accessibility** > **Text-to-speech output**.<br>2. Look at **Preferred engine** (*Speech Recognition and Synthesis by Google*).<br>3. Tap the **Settings gear icon (⚙)** next to Preferred engine.<br>4. Tap **Install voice data**.<br>5. Scroll to **Hindi (India)** and **Gujarati (India)**; tap download icon to install offline voice packs `(verify)`. | Check whether voice packs were already present on your OnePlus Nord CE6 or if download was required. Record in notes. | |
| 12.5 | Open Lab Settings, tap **English**, tap Close. | Language reset back to English. | |

---

## Step 13: Guide My Finger (TalkBack OFF & ON, Pan vs Speaker, Cancel, Ask) (3 min)

> [!NOTE]
> **Prerequisites:** Feature flag `VITE_FEATURE_GUIDE=1` and Settings sheet toggle "Guide my finger" (`lab.settings.guide`) set to **ON** (*"Finger guidance enabled."* / `lab.settings.guideOn`; default is OFF).
> Open the **Right triangle** sample in Explore.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 13.1 | **TalkBack OFF — Voice Target "take me to B":**<br>With TalkBack OFF, tap Voice Command button (or hold 2 fingers > 500 ms) and say: **"take me to B"** *(or "find B", "guide me to B")*. Start moving finger on canvas. | - Plays `success` earcon. Status and speech announce: *"Guiding to B."* (`guide.start`).<br>- Guiding starts (`phase: "guiding"`). Normal theremin sound is suppressed.<br>- Target resolves to vertex B.<br>- Pulses accelerate as finger nears B (`pulseIntervalMs` throttled between 600 ms far and 120 ms near).<br>- Dynamic pitch rises as target B is above finger (`pitchFor(dy)`). | |
| 13.2 | **Speaker vs Headphones (Audio Pan & Spoken Hints):**<br>- **Test A (Phone Speaker):** Listen on built-in phone speaker without headphones.<br>- **Test B (Headphones):** Plug in 3.5 mm / USB-C headphones or connect Bluetooth earbuds. Move finger to the left and right of vertex B. | - **Test A (Speaker):** Phone speaker is mono, so stereo pan is not audible. Verify that spoken directional hints (*"Move left"*, *"Move right"*, *"Move up"*, *"Move down"*, *"Move up-right"*, *"Move up-left"*, *"Move down-right"*, *"Move down-left"*, *"You are here"* / `guide.hint.*`) speak clearly whenever direction changes or every 2.5 s (`hintEveryMs`).<br>- **Test B (Headphones):** Dynamic audio stereo pan is clearly audible: panning to left ear when target is to the left (`panFor(dx) < 0`), centred when aligned, and right ear when target is to the right (`panFor(dx) > 0`). | |
| 13.3 | **Arrival Buzz:**<br>Move finger directly onto Point B (within arrival radius). | - Phone fires distinct arrival buzz pattern (`[50, 90, 50]` ms `cornerPattern`) and plays `success` earcon chime.<br>- Speaks confirmation: *"Arrived at B."* (`guide.arrived`).<br>- Phase transitions to `arrived`; pulses and guiding tones cease immediately. | |
| 13.4 | **TalkBack ON — Pass-Through Guiding:**<br>Turn TalkBack ON (Volume Up + Down). Double-tap and hold on the canvas, then drag. Speak voice command: **"next corner"** *(or "take me to A")*. | - When `isGuideActive()` is ON, saying `"next corner"` initiates guidance to that corner, speaks *"Guiding to {label}."* (`guide.start`).<br>- Relative cursor pass-through feeds movement to guiding state machine.<br>- Directional pulses throttle and pitch responds smoothly as virtual cursor approaches the target corner.<br>- Upon arrival at corner, arrival buzz fires (`[50, 90, 50]` ms + chime) and speaks *"Arrived at {label}."* (`guide.arrived`) cleanly without TalkBack interrupting. | |
| 13.5 | **Semantic Voice Targets & Scene Invariants:**<br>Test semantic targets across diagram kinds:<br>- In **Sine wave**: say **"find the peak"** *(or "peak", "highest point", "take me to the peak")*, **"lowest point"** *(or "trough")*, or **"origin"** *(or "where the axes cross")*.<br>- In **Right triangle**: say **"where is the right angle"** *(or "find right angle", "take me to C")*, or **"longest side"** *(or "find AC")*.<br>- In **Bar chart**: say **"tallest bar"** *(or "highest bar")*, or **"shortest bar"** *(or "take me to Q1")*.<br>- *(Negative check)* In **Right triangle**: say **"find the peak"** *(or in Sine wave: "tallest bar")*. | - Sine wave: "find the peak" resolves to crest vertex `(0.30, 0.20)` and speaks *"Guiding to peak."* (`guide.start`); "lowest point" resolves to `(0.70, 0.80)` and speaks *"Guiding to lowest point."*; "origin" resolves to `(0.08, 0.50)` where axes intersect and speaks *"Guiding to origin."*.<br>- Triangle: "right angle" resolves to vertex C and speaks *"Guiding to C."*; "longest side" resolves to hypotenuse midpoint and speaks *"Guiding to AB."*.<br>- Bar chart: "tallest bar" resolves to Q4 center and speaks *"Guiding to Q4."*; "shortest bar" resolves to Q1 center and speaks *"Guiding to Q1."*.<br>- Negative check: when a semantic target does not exist in the diagram, app speaks plain feedback in ONE utterance: *"There is no peak in this diagram."* (`guide.semantic.none.peak`) with an error earcon. | |
| 13.6 | **Ask Integration — Ask then "Guide me":**<br>In Explore on Right Triangle, tap Ask button. Speak question: **"where is angle C?"** *(or "where is the right angle?")*.<br>When answer is spoken, tap the **"Guide me"** action button. | - Ask endpoint answers from diagram facts: *"angle C = 90 degrees. Tap Guide me to feel it."* (`ask.guideOffer`).<br>- App displays a glowing $\ge 48 \times 48$ px action button: **Guide me** (`ask.guideMe`).<br>- Tapping **Guide me** immediately speaks *"Guiding to C."* (`guide.start`) and initiates guiding toward vertex C.<br>*(Note: "Guide me" is an on-screen action button activated by touch; speaking "Guide me" without a target is not a voice command and submits as a question).* | |
| 13.7 | **Cancel by Voice "stop":**<br>Start guiding toward any point. Say clearly: **"stop"** *(or "stop guide", "cancel guide", Hindi "रुकें" / "रोको", Gujarati "ઊભા રહો" / "રોકો")*. | - Guiding halts immediately (`stopped`, reason: `"voice"`).<br>- Plays `back` earcon, speaks *"Guide stopped."* (`guide.stopped`), and returns cleanly to standard exploration mode. | |
| 13.8 | **Cancel by Back Gesture / Button:**<br>Start guiding toward any point. Tap the Back button (or perform Android system Back gesture). | - Guiding halts immediately (`stopped`, reason: `"back"`).<br>- Plays `back` earcon, speaks *"Guide stopped."* (`guide.stopped`), and stays in Explore screen. | |
| 13.9 | **Cancel by 20 s Timeout:**<br>Start guiding toward a point, then lift finger and leave phone untouched for 20 seconds. | - At 20 seconds (`timeoutMs = 20000`), timer expires.<br>- App stops guiding (`stopped`, reason: `"timeout"`), speaks *"Guide stopped."* (`guide.stopped`), silences tones, and returns to idle exploration. | |

---

## Step 14: Teacher Verify & Share (Routes `#/teach`, Link Decompression Offline, Bad Links, QR) (3 min)

> [!NOTE]
> **Prerequisites:** Feature flag `VITE_FEATURE_SHARE=1` and Settings sheet toggle "Teacher tools" (`lab.settings.teacher`) set to **ON** (*"Teacher tools enabled."* / `lab.settings.teacherOn`; default is OFF).
> Shared links encode diagram payload into the URL fragment (`#s=...`) using `lz-string`. The hash never reaches the server.
>
> **Reaching the Teacher Editor:** There are two ways in:
> 1. **Visible UI Button:** Open Lab Settings sheet on Capture or Explore; once "Teacher tools" is enabled, tap the **"Open Teacher Editor"** button (`lab.settings.openTeacher`) that appears in the sheet.
> 2. **Direct URL Navigation:** Type or open `https://ghost-touch-iota.vercel.app/#/teach` in the browser address bar.  
> *(IMPORTANT: If `gt_teacher_enabled` is not turned ON in Settings or `VITE_FEATURE_SHARE` is not "1", navigating to `#/teach` is strictly ignored by `App.tsx` and the app remains on the Start screen).*

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 14.1 | **Teacher Route `#/teach` on Laptop:**<br>On a desktop or laptop browser, enable Teacher tools in Lab Settings (or verify `gt_teacher_enabled` is true) and open `https://ghost-touch-iota.vercel.app/#/teach` (or click "Open Teacher Editor" in Settings). | - Opens Teacher editor reusing the Correct pipeline.<br>- Status card announces: *"Teacher editor. Edit diagrams, verify accuracy, and share with students."* (`teach.intro`).<br>- Displays diagram canvas with draggable vertices (`teach.canvasLabel`), Add vertex (`teach.addVertex`), Delete (`teach.delete`), Undo/Redo, and element label editor.<br>- If `function_graph`: shows axis position fields (`teach.xAxisY`, `teach.yAxisX`) validated to $[0, 1]$ or empty.<br>- Live validation status displays *"Diagram is valid and ready to verify."* (`teach.validDiagram`).<br>- Displays verification form: Teacher name ($\le 60$ chars), note ($\le 280$ chars).<br>- Displays honesty notice: *"Verified means a person reviewed this diagram. It is not cryptographic proof."* (`share.honesty`).<br>- **"Mark verified"** button (`teach.markVerified`) is disabled until diagram is valid and teacher name is entered. | |
| 14.2 | **Teacher Route `#/teach` on Phone:**<br>On the OnePlus Nord CE6 in Chrome, enable Teacher tools in Settings and tap **"Open Teacher Editor"** (or open `https://ghost-touch-iota.vercel.app/#/teach`). | - Responsive layout loads with all touch controls $\ge 48 \times 48$ CSS px.<br>- Can drag vertex handles, edit label text, enter teacher name (*"Mrs. Patel"*) and note (*"Verified for Class 9"*). | |
| 14.3 | **Generate Share Link & QR Code:**<br>In Teacher editor, enter name *"Mrs. Patel"*, optional note *"Verified for Class 9"*, and tap **Mark verified** (`teach.markVerified`). | - Validates scene and form; speaks confirmation: *"Diagram verified and share link ready."* (`teach.verifiedSuccess`).<br>- Encodes payload into URL fragment (`#s=...`) via `lz-string` compression.<br>- Share panel appears showing heading *"Share link"* (`teach.shareLink`), character size (`teach.linkSize`), **Copy link** button (`teach.copyLink`), and on-screen QR code (rendered via `qrcode` when URL $\le 2000$ chars; `teach.qrCodeAlt`).<br>- Tapping **Copy link** copies the `#s=...` URL to clipboard and speaks *"Link copied"* (`teach.linkCopied`).<br>- If Web Share API is available on device, shows system share sheet option. | |
| 14.4 | **QR Scan from a Second Device:**<br>Using a second phone's camera (or QR scanner app), scan the on-screen QR code displayed on the laptop or first phone. | - Second phone opens Chrome and loads the `#s=...` URL.<br>- Client decodes payload, validates scene invariants offline via `validateShareScene`.<br>- Opens Explore screen displaying a visible banner: *"✓ Verified by Mrs. Patel"* (`share.verifiedBy`).<br>- Spoken entry utterance joins scene announcement and verification: *"<Title>. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave. Verified by Mrs. Patel"*. *(Note: teacher note is NOT spoken automatically at entry to prevent speech delay).*<br>- Banner displays accessible button **"Read note"** (`share.readNote`). Tapping it reveals the note text and speaks: *"Verified for Class 9"*. Tapping again shows **"Hide note"** (`share.hideNote`). | |
| 14.5 | **Cold Open Shared Link on Phone:**<br>Copy the `#s=...` URL. In a freshly opened Chrome tab (or closed/reopened Chrome), paste the link and navigate to it cold. | - URL fragment decodes before network calls (does not trigger backend warmup).<br>- Validates scene bounds, coordinates, and structure.<br>- Launches directly into Explore with full haptic vibration and speech. | |
| 14.6 | **Open Shared Link in Airplane Mode (Offline):**<br>Turn **Airplane Mode ON** (disconnect Wi-Fi and mobile data). Open or refresh the `#s=...` URL. | - Diagram loads instantly and completely offline from the URL fragment.<br>- Tracing lines buzzes, corners pulse, and audio works 100% offline with zero server contact. | |
| 14.7 | **Bad Link / Truncated Hash Handling:**<br>Edit the URL in the address bar to simulate a corrupted/truncated link: delete the last 20 characters of the `#s=...` hash and press Enter. | - Client-side validator catches `ShareError` (`bad-format`).<br>- Does not crash or show unhandled error.<br>- Renders friendly ShareError screen with title *"Could not open diagram"* (`share.error.title`).<br>- Alert card and speech announce: *"This shared link is corrupted or incomplete."* (`share.error.badFormat`).<br>- Shows accessible **Go to start** button (`share.goToStart`) ($\ge 48 \times 48$ px). Tapping it clears hash and returns to Start screen. | |
| 14.8 | **Restore Connectivity:**<br>Turn Airplane Mode OFF (reconnect Wi-Fi / mobile data). | Network connection restored for future testing. | |

---

## Steps 15 to 19: features built since 2026-11-20 (added 2026-11-22)

> [!WARNING]
> **Everything in Steps 15 to 19 is untested on a phone.** It passes automated tests in a simulated browser and, for some layout checks, in an emulated Chrome. Nobody has felt, heard or looked at any of it on a real device, with or without TalkBack. A fail here is expected information, not a surprise. Hindi and Gujarati wording is machine-translated and not reviewed by native speakers.
>
> **Two ways to test, write which one you used in the notes:** **TalkBack OFF** (direct touch) and **TalkBack ON** (double-tap-and-hold, then drag, as in Step 5). If you have no TalkBack, do only the OFF rows and write "no TalkBack" in the notes. Time estimates are guesses.
>
> Open the **Right triangle** sample unless a row says otherwise. Turn **Teacher tools** ON in Settings only where a row needs it.

### Step 15: Highlight of the touched element and the dark outlines

> [!NOTE]
> The highlight is on by default and has no switch. It is drawn only while a finger is down. It adds no sound, speech or vibration, so those must feel exactly as in Step 4. This is a **look** test: judge colour and thickness on the real screen.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 15.1 | **Look, indoors.** TalkBack OFF. Open the Right triangle. Hold a finger on side AC and look at the screen (or ask a sighted helper). Then slide to corner B, then onto a bar in the Bar chart sample. | While the finger is on a side, that side is drawn clearly thicker and brighter than the others. On a corner, that corner is a larger, brighter dot. On a bar, its outline is thicker and brighter (the fill does not change). The other elements stay as they were. Nothing blinks or pulses. **Fail:** nothing changes, the wrong element lights up, it flashes, the highlight stays after you lift, or you can not tell it apart from the normal line. Write the thickness and colour as you see it (for example "about twice as thick, light green"). | |
| 15.2 | **Look, outdoors.** Take the phone into daylight (shade and direct sun if you can) at normal screen brightness. Repeat 15.1 on one side and one corner. | The highlighted element can still be told from the rest at arm's length. **Fail:** you can not see it in daylight, or it looks the same as the other lines. Note the brightness setting and the conditions. | |
| 15.3 | **Dark outlines.** Look at the plain (not touched) drawing on the Right triangle, Sine wave and Bar chart. | The strokes are clear glowing green on a near-black background with no texture, grid, stitches or rivets inside the drawing area. **Fail:** any decoration inside the drawing area, strokes too dim or too thin to see indoors, or a visible glow that blurs two close lines together. Note which sample and what you saw. | |
| 15.4 | **It clears.** Hold a finger on a side, then lift. Repeat, and also press the Home button while holding, then come back. | The highlight disappears the moment you lift and does not come back by itself. **Fail:** the element stays lit after the finger is up or after returning to the app. | |
| 15.5 | **Two fingers.** Put one finger on side AC, then add a second finger on another side, then lift the first finger only. | The highlight follows the finger that is now in charge: after the first finger lifts, it moves to the element under the remaining finger. **Fail:** the old element stays lit, or nothing is lit while a finger is down on a line. | |
| 15.6 | **Feel and sound are unchanged.** TalkBack OFF, eyes closed, helper watching. Trace the triangle as in Step 4. Then TalkBack ON and use double-tap-and-hold. | Line buzz, corner double pulse, spoken corner label and the quiet window feel exactly as before. **Fail:** any new buzz, tone or speech, or anything delayed or lost compared with Step 4. | |
| 15.7 | **Layout stays put.** Watch the canvas edges and the buttons under it while you press and drag on the diagram. | The canvas and the buttons do not move or resize. **Fail:** anything jumps. | |

### Step 16: The Help button

> [!NOTE]
> Help speaks the gestures that apply to the screen you are on, as one sentence list: touch, Back, Ask, Guide and stop (only when Guide is on), and a rough-outlines sentence on a Raw photo. It works with or without a finger down and while Ask or Guide is active. The wording is not final.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 16.1 | Open the Right triangle. Find the **Help** button in the row under the drawing (TalkBack ON: swipe right until it is read). | A button named "Help" exists, is at least about 48 x 48 px (finger-sized), and is reachable by TalkBack swipe. **Fail:** missing, too small to hit, or not read by TalkBack. | |
| 16.2 | Tap Help with no finger on the drawing. | One spoken sequence: how to explore by touch, how to go Back, how to Ask. The same words appear in the status card. It finishes without being cut. **Fail:** nothing is spoken, it speaks twice, or it says something that is not a gesture the app has. | |
| 16.3 | **Second-finger tap.** TalkBack OFF. Rest one finger on the middle of side AC (so the line buzz is on). With a second finger, tap Help once and lift the second finger. Keep the first finger down. | Help is spoken exactly once. The first finger keeps buzzing on the line and keeps exploring. The highlight stays on AC. **Fail:** Help does not speak, it speaks twice, the buzz stops or restarts, the highlight clears or jumps, or the second finger takes over the exploring. Repeat once with **Where am I** instead of Help; it should behave the same way. | |
| 16.4 | **Slid-off tap.** Press down on Help with one finger, slide off the button, lift. Then press down on Help and lift in a different place on the screen. | Nothing is spoken for a touch that does not end on the button. **Fail:** Help speaks anyway. | |
| 16.5 | **Keyboard and TalkBack double-tap.** TalkBack ON: focus Help, double-tap. | Help speaks once. **Fail:** twice, or not at all. | |
| 16.6 | **Help on a Raw photo.** Take a messy photo (clutter, a table) so the result is Raw Mode (see Step 8). Open Help and read the status card without TalkBack. | The spoken list ends with a sentence that the diagram is only rough outlines and labels may be missing, and **that last sentence is fully visible**, or you can scroll the status card to see it. **Fail:** the last sentence is cut off and you can not scroll to it. Also write whether the card, the drawing and the buttons moved when the help text appeared (they must not). Repeat with Language set to Hindi, then Gujarati, and write what you see. | |
| 16.7 | **Help in Guide or Ask.** With Guide on (Step 13) start guiding, then tap Help. Also try while Ask is listening. | Help speaks and does not start or cancel anything else. **Fail:** Help ends Guide, starts Ask, or navigates away. | |
| 16.8 | **Landscape footer.** TalkBack OFF. Rotate the phone to landscape on the Right triangle. Do not scroll. | All the buttons under or beside the drawing (Back, Where am I, Ask, Help, plus Correct and Guide me if they are on) are fully on screen, each at least about 48 x 48 px, with no scrolling needed. The drawing stays usable. Rotate back to portrait. **Fail:** any button is cut off or only reachable by scrolling, or the drawing becomes tiny. Write the phone's landscape size if you know it and how tall the drawing is. | |
| 16.9 | **Rotation does not jump the canvas.** Hold a finger on the drawing and rotate. | The drawing keeps its position until the rotation finishes; nothing grows for several seconds. **Fail:** the drawing keeps growing or shifts under your finger. | |

### Step 17: Planchette, "Walk me through"

> [!NOTE]
> A walk leads your finger through the reasoning behind a number, one part at a time, and then asks you to find one part yourself. It is built from fixed templates, with no AI and no new vibration or tone. It speaks arithmetic on the printed numbers only. It never says the diagram is "right". Start it with the **Walk me through** button or by saying the whole phrase "walk me through". Say "next step" or press the next-step control to go on. Say "repeat" to hear a prompt again and "stop" to end it.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 17.1 | **Triangle walk starts.** Open the Right triangle sample. Find and press **Walk me through** (TalkBack ON: swipe to it, double-tap). | A button named "Walk me through" exists and is at least about 48 x 48 px. After pressing it you hear a short opening, then a prompt telling you which part to find first (for example a side). **Fail:** no button on the triangle, the prompt gives a number before you have touched anything, or it says something is "correct" or "verified". | |
| 17.2 | **A step is spoken only when you reach it.** Touch somewhere that is not the requested part, then find the requested side or corner. | The wrong place gives no step sentence. When your finger reaches the right part, you hear its sentence once (for example a length). The corner or side label may be heard in the same sentence rather than cutting it off. **Fail:** a step sentence is spoken without touching the right part, it is spoken twice in a row, or the label cuts the sentence short. | |
| 17.3 | **Do all the steps.** Say "next step" for each step. Then do the same again with the on-screen next control instead of your voice. | Each "next step" gives the prompt for the next part. "Next step" before you have reached the current part repeats the prompt instead of skipping ahead. The last triangle step speaks the squares, their sum and the square root, and the numbers agree with the lengths printed on the diagram. **Fail:** it skips a step, a spoken number does not match the diagram's printed lengths, or the voice phrase is not recognised (write what you said and what the app did). Also say "next" alone: it should not start or advance a walk (it keeps its old job). | |
| 17.4 | **Your turn, with a wrong touch.** After the last step say "next step" to hear the Your-turn prompt. Rest your finger on a **wrong** side or corner for about a second, then lift and rest on a different wrong one. Then find the right one. | The prompt names no number and does not give the answer. Passing quickly over other parts counts as nothing. After the second wrong rest, the app tells you the answer once and guides your finger to it. Touching the right part always ends it with a success line and a closing line. **Fail:** the answer is given at the first wrong touch or while you only slide past, it repeats the answer over and over, touching the right part does not finish the walk, or you are told you are "correct". | |
| 17.5 | **Lift during a step.** Start a walk. Reach a part so its sentence starts, then lift your finger right away. | The step sentence finishes; lifting does not cut it. A plain corner label spoken when not in a walk is still cut when you lift (as in Step 4 and the main test). **Fail:** the walk sentence is cut off on lift. | |
| 17.6 | **Stop.** Start a walk, then say "stop". Try again with the Back button. | The walk ends with one short spoken line. If Guide was also running there is one stop line, not two. Nothing keeps speaking afterwards and the drawing still works. **Fail:** speech continues, two lines are spoken, or the walk is still active. | |
| 17.7 | **Repeat.** In a walk, say "repeat" once at a find prompt and once after a step sentence. | The current prompt or sentence is spoken again. **Fail:** nothing, or the wrong sentence. | |
| 17.8 | **Idle end.** Start a walk and leave the phone for about two minutes without touching. | The walk ends quietly. Touching afterwards behaves like normal exploring. **Fail:** the walk keeps going or speaks by itself after the end. | |
| 17.9 | **Bar chart walk.** Open the Bar chart sample and start the walk. Reach each requested bar. | The steps name the tallest bar and the shortest bar and give the difference as highest minus lowest. The numbers match the values you hear when you rest on each bar normally. Your turn asks for a bar taller than the lowest one. **Fail:** a bar is named that does not match, the difference does not match the two values, or the steps contradict the diagram. | |
| 17.10 | **Does the walk change the feel?** Trace the triangle with a walk active, eyes closed. | Line buzz, corner double pulse and tones are the same as without a walk. **Fail:** any new vibration, tone or earcon from the walk. | |
| 17.11 | **No walk on the Sine sample.** Open the Sine wave sample. Look for **Walk me through** (and say "walk me through"). | The request says no walk is offered on the sine sample. **Note for the tester:** the written design (design.md, property P170) expects the shipped sine to get a curve-shape walk, so this row can go either way. Write exactly what happens: no button, or a button and what the steps say. Report a button as a **discrepancy with the request**, not as a pass. If a walk does start, check that its steps stay on the origin, the peak and the trough and that it speaks no numbers. | |
| 17.12 | **No walk on a Raw photo.** Take the messy photo from 16.6 so the result is Raw Mode, and look for **Walk me through**. Say "walk me through". | No button. Saying the phrase does not start a walk (it is handled as an ordinary spoken line, or ignored). **Fail:** a walk starts on a Raw photo. | |
| 17.13 | **A question is not a command.** In the triangle say a long sentence that contains the words, for example: "can you walk me through the proof of this triangle". | It is treated as a question to Ask, not as a walk start. **Fail:** a walk starts. | |
| 17.14 | **TalkBack ON, whole walk.** Do 17.1 to 17.4 once with TalkBack ON, using double-tap-and-hold and drag to reach each part. | The walk works with TalkBack. TalkBack does not read extra text over the walk sentences. **Fail:** TalkBack speaks over the walk, a step is lost, or the reached part is not noticed. Describe exactly what you did. | |

### Step 18: Ghost Hand, "Make my own graph"

> [!IMPORTANT]
> This lets you plot your own graph on a fixed grid (x 0 to 6, y 0 to 8) with two sliders and a Pin button, then feel it. **The Hand in link needs the share feature:** the Vercel build must have `VITE_FEATURE_SHARE=1` and Teacher tools must be ON in Settings. **Before row 18.12, open one existing share link on this phone** (for example a link made in Step 14.3) to confirm sharing is available on this build. If a link does not open, write "share not on this build" and skip 18.12. Everything in this step is untested on a phone. Pin labels are spoken like "x 2 y 5".

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 18.1 | On the Capture screen find and open **Make my own graph**. | A button of at least about 48 x 48 px with that name opens a screen with two sliders (x and y), a Pin button, an Undo button, a Stitch in order button, and Feel and Hand in buttons. Feel and Hand in are **disabled** with no pins. **Fail:** no way in, a control is too small to hit, or Feel is usable with nothing pinned. | |
| 18.2 | **Sliders under TalkBack.** TalkBack ON. Swipe to the x slider, then swipe up or down (or use the volume keys) to change it. Repeat for y. | TalkBack reads each as, for example, "x 3" and "y 5" and the value changes by one whole step each time (x from 0 to 6, y from 0 to 8). **Fail:** the slider has no name, reads only a percentage, jumps by more than one, or can not be changed with TalkBack. Also try the sliders with TalkBack OFF by dragging them and note whether you can reach every value. | |
| 18.3 | **Pin.** Set x 2, y 5. Press Pin. | It speaks that a point was added with its name and "x 2 y 5". Pins are named A, B, C and so on. **Fail:** silence, the wrong coordinates, or the text includes brackets or the word "correct". | |
| 18.4 | **Same crossing twice.** Press Pin again without moving the sliders. | Nothing new is added and it speaks that the spot is already taken. **Fail:** a second point appears at the same place, or no explanation is spoken. | |
| 18.5 | **Plot several.** Pin (0, 1), (1, 3), (2, 5). Order the pins any way you like. | Each pin is announced. **Fail:** any pin lands at the wrong place when you later feel it (check in 18.9). | |
| 18.6 | **Undo.** Press Undo once. | The last pin is removed and the app says what was removed. Undo again removes the one before. **Fail:** more or less than one pin is removed per press, or silence. Pin it back again afterwards. | |
| 18.7 | **Stitch in order.** With three or more pins, press Stitch in order. Press it again. | Pins are joined into a chain from left to right (for three pins, two lines), spoken once. A second press changes nothing. One Undo removes the whole stitch. **Fail:** a pin is skipped, lines connect in the wrong order, a line appears that you did not stitch, or Undo needs several presses. | |
| 18.8 | **Feel.** Press Feel. | The ordinary Explore screen opens on your graph. Axes lie along the bottom and left edges. **Fail:** the screen shows another diagram or is empty. | |
| 18.9 | **Touch a pin.** Move your finger onto each pin. | Each pin gives the corner double pulse and its spoken label ("x 0 y 1", "x 1 y 3" and so on). Between two stitched pins the line buzz is felt. The pins are the places you chose. **Fail:** a pin is missing, announced with the wrong coordinates, can not be found by touch, or two pins merge so you can not tell them apart. Note whether neighbouring pins feel too close together on this phone; the app says so out loud if the screen is small. | |
| 18.10 | **No pitch for slope.** Slide along a stitched line. | The line buzz is steady. No rising or falling tone, because these are straight segments. **Fail:** a tone that you take as "the slope". | |
| 18.11 | **Back keeps the pins.** From Feel press Back (or the Back gesture). | You return to the sliders screen and the spoken prompt says so; every pin and stitch you made is still there. Press Back again with pins present: it asks you to confirm before leaving and leaving without confirming does nothing. **Fail:** pins are lost on the first Back, or it leaves without asking. | |
| 18.12 | **Hand in.** (Needs share on this build, see the box above.) Press Hand in. | You get a link and a text list of the pins, one line per pin, for example "A: x 0 y 1", in order. Both say the work is not checked. The words "verified", "correct" and "approved" do not appear. **Fail:** the list is missing a pin or has the wrong coordinates, the text says the work is checked or correct, or the link is missing. | |
| 18.13 | **Open the link.** Copy the link, open it in a new Chrome tab (or in airplane mode for a second test). | It opens on the Explore screen with the same pins and lines. **Fail:** error screen, a different graph, or lost points. Write what was shown. | |
| 18.14 | **Empty hand-in.** Remove all pins and look at Hand in and Feel. | Both are disabled and say why when pressed. **Fail:** either works with no pins. | |
| 18.15 | **Does it ruin the walk or fact check?** Make a 3-4-5 shape of pins and press Feel. Press **Walk me through**, and also listen for any spoken disagreement. | No walk is offered and no "facts and drawing disagree" sentence is spoken on your own plot. **Fail:** a walk or a disagreement sentence appears. | |

### Step 19: Compact footer at 360 px width in English, Hindi and Gujarati

> [!NOTE]
> 360 px is a common budget-phone width in CSS pixels. Check it with the phone in portrait. If your phone is wider, you can narrow the layout by turning on **Settings > Display > Display size and text** to the largest setting, or note your real width and say so. Check that the footer buttons are all visible, readable and not touching.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 19.1 | Settings language **English**. Open the Right triangle and look at the buttons under the drawing. With Teacher tools and Guide ON, also check with those on. | Every button (Back, Where am I, Ask, Help, and Correct and Guide me when on) is fully visible, readable, at least about 48 x 48 px and has a clear gap to the next. The status card and the drawing have the same size as before you pressed anything. **Fail:** text is cut off or overlaps, a button is off screen, or the drawing is much smaller than the buttons. | |
| 19.2 | Settings language **Hindi** (हिन्दी). Same screen. | Same as 19.1. Hindi words are longer: check that every label is readable, not clipped to "..." and the buttons wrap onto a second row cleanly if they must. **Fail:** same as 19.1. Note which label is longest. | |
| 19.3 | Settings language **Gujarati** (ગુજરાતી). Same screen. | Same as 19.1 and 19.2. **Fail:** same. | |
| 19.4 | Press Help in each language. | The status card shows the help text; its card height does not change and, if the text is longer than the card, you can scroll the card. The last sentence is reachable. **Fail:** text is cut off with no way to scroll, or the drawing moves. | |
| 19.5 | TalkBack ON, English. Swipe through every footer button. | Each button has a clear name; all are reached in a sensible order. **Fail:** a button is skipped, read twice, or has no name. | |
| 19.6 | Set Language back to English when finished. | Language is English. | |

---

## Paste This Back to the Team

Copy the block below, fill in `PASS` or `FAIL` and your notes, and paste it back into your discussion or issue:

```text
======================================================
GHOST TOUCH PHONE TEST REPORT — ONEPLUS NORD CE6
Date Tested: 2026-11-06
Tester: Owner
======================================================

0 (wake backend):             PASS/FAIL - <seconds to {"ok":true}>
1 (PWA install):              PASS/FAIL - <notes>
2 (start screen):             PASS/FAIL - <notes>
3 (settings sheet & toggles): PASS/FAIL - <lang, rate, guide toggle, teacher toggle + "Open Teacher Editor" button>
4 (explore TalkBack OFF):     PASS/FAIL - <lines vibrate? corners bzzzz-tap? 450ms quiet? theremin pitch?>
5 (explore TalkBack ON):      PASS/FAIL - <accessible announcement read first? pass-through gesture worked? 25ms centre tick heard/felt?>
6 (voice commands):           PASS/FAIL - <which recognized: where am I, repeat, next corner, describe, help, rate?>
7 (Ask by voice/text):        PASS/FAIL - <answer to "How long is AB?" / answer to "What colour is it?">
8 (photo textbook diagram):   PASS/FAIL - <mode: AI or Raw? reason if raw? elapsed seconds?>
9 (PDF upload):               PASS/FAIL - <first page extracted? elapsed seconds?>
10 (saved diagrams offline):  PASS/FAIL - <reopened in airplane mode? explored offline?>
11 (correct mode):            PASS/FAIL - <dragged point? validated & saved?>
12 (Hindi/Gujarati speech):   PASS/FAIL - <voices present or missing? notice heard? downloaded in TTS settings?>
13 (guide my finger):          PASS/FAIL - <TalkBack off/on? speaker hints vs headphone pan? cancel voice/back/timeout? arrival buzz? "take me to B"/"find AC"/Ask "Guide me" button>
14 (teacher share & QR):       PASS/FAIL - <cold open #s=? airplane mode offline? bad truncated link spoken error? Open Teacher Editor / #/teach? Mark verified? QR scanned from 2nd device? Read note toggle?>

15 (highlight, outlines):      PASS/FAIL - <colour and thickness indoors and outdoors? clears on lift? feel/sound unchanged? TalkBack on/off?>
16 (Help button):              PASS/FAIL - <spoken once? second-finger tap while resting on AC? Raw photo last sentence reachable? landscape footer visible?>
17 (Walk me through):          PASS/FAIL - <triangle and bar walks? next step by voice and button? Your turn wrong touch? lift during step? stop? no walk on sine / Raw photo (what actually happened on sine)?>
18 (Ghost Hand):               PASS/FAIL - <sliders under TalkBack? Pin, Undo, Stitch? Feel and touching a pin? Back kept pins? Hand in link opened? share on this build?>
19 (footer at 360 px):         PASS/FAIL - <English / Hindi / Gujarati, anything clipped? width used>
(Steps 15 to 19 were not tested on any phone before this run.)

------------------------------------------------------
FAILURE / ANOMALY DATA (fill in if any step failed or behaved strangely):
- Chrome version:           <e.g. Chrome 128.0.xxxx from chrome://version>
- Android OS / OxygenOS:    <e.g. Android 14 / OxygenOS 14.1>
- TalkBack on or off:       <ON / OFF>
- Exact spoken error text:  <verbatim utterance spoken by device>
- Step duration / elapsed:  <seconds or minutes on stopwatch>
- Network state:            <Wi-Fi / 5G / Airplane Mode>
======================================================
```

## Budget-phone check: worst-case share link (only if Share is turned on)

Tester: ____  Phone model: ____  Android / Chrome: ____  Date: ____

- [ ] Open the worst-case share link from docs/reports (the 12,000-character link that decompresses to about 19 million characters, produced by frontend/tests/share.decodeBound.test.ts). The app must show the 'too large' message without freezing, restarting or running out of memory. Result: ____
- If it freezes or crashes, or if Share is turned on by default for students, switch task 63.4 to GO (bounded decoder).
