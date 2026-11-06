# Ghost Touch — 20-Minute OnePlus Nord CE6 Phone Test Script

> **Target Device:** OnePlus Nord CE6 (Android / Google Chrome over HTTPS)  
> **Total Time Budget:** ~20–22 minutes (excluding Step 0 cold-start wake)  
> **Date Prepared:** 2026-11-06  
> **Author:** Antigravity (agy)  
> **Test Document Target:** Single-hand operation with stopwatch

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
| **Total** | **End-to-End Phone Evaluation** | **~27.5 min** | |

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
| 3.6 | Tap **Close settings** button (or tap scrim area / press Android Back). | Sheet dismisses. Speaks: *"Lab settings closed"* (`lab.settings.closed`). Visual focus returns cleanly to the Settings trigger button. | |
| 3.7 | Swipe down from top of screen to pull-to-refresh (or close PWA and reopen). | App reloads. Inspect Settings button: the chosen language and speech speed remain active, loaded from `localStorage` (`gt_language`, `gt_speech_rate`). | |

---

## Step 4: Explore Samples with TalkBack OFF (3 min)

> [!NOTE]
> Ensure **TalkBack is OFF** during this step for direct-touch tactile evaluation.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 4.1 | On Capture screen, tap the **Right triangle** sample card (`lab.specimen.triangle` / `capture.sampleTriangle`). | Explore screen opens. Spoken announcement: *"Right Triangle ABC. Double-tap and hold, then drag to feel the diagram. You start at the centre. Press Back to leave."* Canvas shows glowing green strokes on pure near-black framed by specimen table border and corner rivets (new build). | |
| 4.2 | Touch and drag a single finger directly across any triangle line stroke. | Phone vibrates continuously with `vibrate(80)` pulses repeated every 70 ms while finger remains on the line. | |
| 4.3 | Slide finger off the line into empty black space, or lift finger. | Vibration instantly stops (`vibrate(0)`). Zero residual buzz. | |
| 4.4 | Slide finger directly over any triangle vertex (corner A, B, or C). | - Phone fires sharp double-pulse "bzzzz-tap" pattern (`vibrate([50, 90, 50])`).<br>- Vertex label is spoken immediately (e.g. *"Point A"*, *"Point B. Right angle."*, *"Point C"*), cancelling prior speech.<br>- Line buzz is suppressed for exactly 450 ms quiet window so the corner pulse feels crisp. | |
| 4.5 | Tap **Back** button at top left to return to Capture. Tap the **Sine wave** sample card (`lab.specimen.sine`). | Explore screen opens with sine graph. Tracing the curve vibrates continuously (`vibrate(80)` / 70 ms) **and** plays a smooth Web Audio theremin tone gliding between 200 Hz and 1000 Hz. Pitch rises as finger moves higher on screen and falls as finger moves lower. Crossing axes speaks *"x-axis"* and *"y-axis"*. | |
| 4.6 | Tap **Back** button. Tap the **Bar chart** sample card (`lab.specimen.bars`). | Explore screen opens with bar chart. Touching each vertical bar speaks its category and value, playing a discrete tone pitch proportional to the bar's height. | |

---

## Step 5: Explore Samples with TalkBack ON (3 min)

> [!IMPORTANT]
> Turn **TalkBack ON** now (hold Volume Up + Volume Down together for 3 seconds).  
> In TalkBack mode: swipe right/left to navigate controls, double-tap to activate buttons, and use the **double-tap-and-hold then drag** gesture on the Explore canvas.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 5.1 | On Capture screen, swipe right to the **Right triangle** sample card. Double-tap to activate. | Explore opens. TalkBack focus lands on the canvas and reads accessible label: *"Right Triangle ABC. Double-tap and hold, then drag to feel the diagram."* | |
| 5.2 | Perform the pass-through exploration gesture on canvas:<br>**Double-tap, hold down firmly on second tap, then slide finger.** | - At the exact moment hold begins, phone delivers one distinct 25 ms tick (`vibrate(25)`) and speaks *"Centre."* `(verify)`.<br>- Virtual finger cursor starts calibrated at center (0.5, 0.5). | |
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

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 11.1 | In Explore on a captured photo diagram, tap the **Correct** button (`explore.correct`). | Teacher Correction screen opens. Speaks: *"Correction mode. Tap elements to select, drag points to adjust, and save when done."* (`correct.intro`). | |
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
> **Prerequisites:** Feature flag `VITE_FEATURE_GUIDE=1` and Settings sheet toggle "Guide my finger" set to **ON** (default is OFF).
> Open the **Right triangle** sample in Explore.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 13.1 | **TalkBack OFF — Voice Target "take me to B":**<br>With TalkBack OFF, tap Voice Command button (or hold 2 fingers) and say: **"take me to B"**. Start moving finger on canvas. | - Guiding starts (`phase: "guiding"`). Normal theremin sound is suppressed.<br>- Target resolves to vertex B.<br>- Pulses accelerate as finger nears B (`pulseIntervalMs` throttled between 600 ms far and 120 ms near).<br>- Dynamic pitch rises as target B is above finger (`pitchFor(dy)`). | |
| 13.2 | **Speaker vs Headphones (Audio Pan & Spoken Hints):**<br>- **Test A (Phone Speaker):** Listen on built-in phone speaker without headphones.<br>- **Test B (Headphones):** Plug in 3.5 mm / USB-C headphones or connect Bluetooth earbuds. Move finger to the left and right of vertex B. | - **Test A (Speaker):** Phone speaker is mono, so stereo pan is not audible. Verify that spoken directional hints (*"left"*, *"right"*, *"up"*, *"down"*, *"up-right"*, etc.) speak clearly whenever direction changes or every 2.5 s (`hintEveryMs`).<br>- **Test B (Headphones):** Dynamic audio stereo pan is clearly audible: panning to left ear when target is to the left (`panFor(dx) < 0`), centred when aligned, and right ear when target is to the right (`panFor(dx) > 0`). | |
| 13.3 | **Arrival Buzz:**<br>Move finger directly onto Point B (within arrival radius). | - Phone fires distinct arrival buzz pattern (`arrive` effect) and speaks confirmation (*"Point B"* / arrived announcement).<br>- Phase transitions to `arrived`; pulses and guiding tones cease immediately. | |
| 13.4 | **TalkBack ON — Pass-Through Guiding:**<br>Turn TalkBack ON (Volume Up + Down). Double-tap and hold on the canvas, then drag. Speak voice command: **"next corner"**. | - Relative cursor pass-through feeds movement to guiding state machine.<br>- Directional pulses throttle and pitch responds smoothly as virtual cursor approaches the target corner.<br>- Upon arrival at corner, arrival buzz fires and corner name is spoken cleanly without TalkBack interrupting. | |
| 13.5 | **Voice Target "find the peak":**<br>Open **Sine wave** sample in Explore. Trigger voice command and say: **"find the peak"**. | - Target resolves to the local maximum peak of the sine curve in normalized scene space.<br>- Guiding starts with directional audio/haptic cues leading toward the peak coordinates. | |
| 13.6 | **Ask Integration — Ask then "Guide me":**<br>In Explore, tap Ask button. Speak question: **"where is the right angle?"**.<br>When answer is spoken, tap the **"Guide me"** action button (or speak *"Guide me"*). | - Ask endpoint returns target element (`{elementId: "B"}`).<br>- App offers *"Guide me"* action.<br>- Tapping/saying *"Guide me"* immediately initiates guiding toward vertex B. | |
| 13.7 | **Cancel by Voice "stop":**<br>Start guiding toward any point. Say clearly: **"stop"**. | - Guiding halts immediately (`stopped`, reason: `"voice"`).<br>- App speaks *"Guide stopped"* (`guide.stopped`) and returns cleanly to standard exploration mode. | |
| 13.8 | **Cancel by Back Gesture / Button:**<br>Start guiding toward any point. Tap the Back button (or perform Android system Back gesture). | - Guiding halts immediately (`stopped`, reason: `"back"`). | |
| 13.9 | **Cancel by 20 s Timeout:**<br>Start guiding toward a point, then lift finger and leave phone untouched for 20 seconds. | - At 20 seconds (`timeoutMs = 20000`), timer expires.<br>- App stops guiding (`stopped`, reason: `"timeout"`), speaks *"Guide stopped"*, and returns to idle exploration. | |

---

## Step 14: Teacher Verify & Share (Routes `#/teach`, Link Decompression Offline, Bad Links, QR) (3 min)

> [!NOTE]
> **Prerequisites:** Feature flag `VITE_FEATURE_SHARE=1` and Settings sheet toggle "Teacher verify & share" set to **ON** (default is OFF).
> Shared links encode diagram payload into the URL fragment (`#s=...`) using `lz-string`. The hash never reaches the server.

| # | Do this | Expected | Result (pass / fail / notes) |
|---|---|---|---|
| 14.1 | **Teacher Route `#/teach` on Laptop:**<br>On a desktop or laptop browser, open `https://ghost-touch-iota.vercel.app/#/teach` (or local dev server). | - Opens Teacher editor reusing the Correct pipeline.<br>- Displays diagram canvas with draggable vertices, labels, and axis-range fields for function graphs.<br>- Displays verification form: Teacher name ($\le 60$ chars), note ($\le 280$ chars).<br>- Displays honesty notice: *"Verified means a person reviewed this diagram. It is not cryptographic proof."* | |
| 14.2 | **Teacher Route `#/teach` on Phone:**<br>On the OnePlus Nord CE6 in Chrome, open `https://ghost-touch-iota.vercel.app/#/teach`. | - Responsive layout loads with all touch controls $\ge 48 \times 48$ CSS px.<br>- Can drag vertex handles, edit label text, enter teacher name (*"Mrs. Patel"*) and note (*"Verified for Class 9"*). | |
| 14.3 | **Generate Share Link & QR Code:**<br>In Teacher editor, tap **Verify & Share**. | - Encodes payload into URL fragment (`#s=...`) via `lz-string` compression.<br>- Share panel appears showing generated link, **Copy link** button, and on-screen QR code (rendered via `qrcode` when URL $\le 2000$ chars).<br>- If Web Share API is available on device, shows system share sheet option. | |
| 14.4 | **QR Scan from a Second Device:**<br>Using a second phone's camera (or QR scanner app), scan the on-screen QR code displayed on the laptop or first phone. | - Second phone opens Chrome and loads the `#s=...` URL.<br>- Client decodes payload, validates scene invariants offline via `validateShareScene`.<br>- Opens Explore screen displaying a visible banner: *"Verified by Mrs. Patel"*, and speaks: *"Verified by Mrs. Patel. Note: Verified for Class 9"* right after the scene-loaded announcement. | |
| 14.5 | **Cold Open Shared Link on Phone:**<br>Copy the `#s=...` URL. In a freshly opened Chrome tab (or closed/reopened Chrome), paste the link and navigate to it cold. | - URL fragment decodes before network calls.<br>- Validates scene bounds, coordinates, and structure.<br>- Launches directly into Explore with full haptic vibration and speech. | |
| 14.6 | **Open Shared Link in Airplane Mode (Offline):**<br>Turn **Airplane Mode ON** (disconnect Wi-Fi and mobile data). Open or refresh the `#s=...` URL. | - Diagram loads instantly and completely offline from the URL fragment.<br>- Tracing lines buzzes, corners pulse, and audio works 100% offline with zero server contact. | |
| 14.7 | **Bad Link / Truncated Hash Handling:**<br>Edit the URL in the address bar to simulate a corrupted/truncated link: delete the last 20 characters of the `#s=...` hash and press Enter. | - Client-side validator catches `ShareError` (`bad-format` or `bad-scene`).<br>- Does not crash or show unhandled error.<br>- Speaks a polite friendly error: *"Could not open shared diagram: invalid or damaged link."*<br>- Shows friendly error message card with accessible **Go to start** button ($\ge 48 \times 48$ px). | |
| 14.8 | **Restore Connectivity:**<br>Turn Airplane Mode OFF (reconnect Wi-Fi / mobile data). | Network connection restored for future testing. | |

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
3 (settings sheet):           PASS/FAIL - <notes>
4 (explore TalkBack OFF):     PASS/FAIL - <lines vibrate? corners bzzzz-tap? 450ms quiet? theremin pitch?>
5 (explore TalkBack ON):      PASS/FAIL - <pass-through gesture worked? 25ms centre tick heard/felt?>
6 (voice commands):           PASS/FAIL - <which recognized: where am I, repeat, next corner, describe, help, rate?>
7 (Ask by voice/text):        PASS/FAIL - <answer to "How long is AB?" / answer to "What colour is it?">
8 (photo textbook diagram):   PASS/FAIL - <mode: AI or Raw? reason if raw? elapsed seconds?>
9 (PDF upload):               PASS/FAIL - <first page extracted? elapsed seconds?>
10 (saved diagrams offline):  PASS/FAIL - <reopened in airplane mode? explored offline?>
11 (correct mode):            PASS/FAIL - <dragged point? validated & saved?>
12 (Hindi/Gujarati speech):   PASS/FAIL - <voices present or missing? notice heard? downloaded in TTS settings?>
13 (guide my finger):          PASS/FAIL - <TalkBack off/on? speaker hints vs headphone pan? cancel voice/back/timeout? arrival buzz? "take me to B"/"find the peak"/Ask "Guide me">
14 (teacher share & QR):       PASS/FAIL - <cold open #s=? airplane mode offline? bad truncated link spoken error? #/teach on laptop & phone? QR scanned from 2nd device?>

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
