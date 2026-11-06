# Lab Demo Notes: Ghost Touch Video Script & Production Guide

A practical guide for recording the 3-minute video presentation of the Ghost Touch "Frankenstein's Lab" redesign.

> **Target Duration:** 2 minutes 45 seconds to 2 minutes 55 seconds (Hard limit: 3:00)  
> **Core Pitch:** "Ghost Touch is a creature stitched from spare phone parts: an ordinary notification buzzer for nerves, a vision LLM for eyes, and a browser synthesizer for a voice. The UI is the lab where it comes alive."  
> **Accessibility Stance:** The spooky Frankenstein theme lives strictly in the stitched creature and the mad-science lab aesthetic. It **NEVER** jokes about blindness, visual impairment, or sightlessness.

---

## 1. Filming Rules & Equipment Setup

- **Filming Focus:** Camera frames the phone screen, tactile gestures, and hands. No faces are filmed without explicit, signed consent.
- **Audio Priority:** Sound carries the product story. Place a lavalier microphone or directional condenser within 10 cm of the phone body to capture physical motor vibrations, Web Audio theremin tones, and Web Speech synthesis clearly.
- **Device Configuration:** Android smartphone (e.g. OnePlus Nord CE6 or budget Android device) running Google Chrome over HTTPS. Media volume set to 85%+. Touch haptics active in Android settings.
- **Props Prepared:**
  1. One clean printed textbook page with a labelled geometric diagram (e.g., NCERT Class 9 right triangle).
  2. One printed textbook page with a Cartesian graph or bar chart.
- **PWA Pre-Installed:** Ghost Touch PWA added to the Android home screen so offline launching can be demonstrated on camera.
- **Backend Service Awake:** If running against Render free-tier, send a curl request to `GET /api/v1/health` 2 minutes before recording to warm up the container.

---

## 2. Timed Shot List & Voiceover Script (Under 3 Minutes)

| Time | Shot & Visual Action | Screen / UI Elements | Voiceover Script (Natural Delivery) | Fallback if Glitch Occurs |
|---|---|---|---|---|
| **0:00–0:18** (18s) | **Cold Open Hook:** Extreme close-up on hands exploring a dark screen. Clear audible motor buzz as finger traces green line. Corner triggers distinct double-tap `vibrate([50, 90, 50])` and synthesizer speaks: *"Point B. Right angle."* Fade in Title Card: **Ghost Touch: feel diagrams you can't see.** | Explore screen (Triangle diagram) framed by copper rivets and stitched border. | *(Silence for 8 seconds. Let the physical vibration hum and spoken voice hook the audience.)* <br><br>*"Ghost Touch. Feel diagrams you cannot see."* | If browser audio was locked, tap the screen once before recording the take to grant user gesture activation. |
| **0:18–0:38** (20s) | **The Problem:** Split shot: printed science textbook diagram on the left, an ordinary budget Android phone on the right. | Printed page vs. budget phone. | *"Diagrams lock blind and low-vision students out of STEM education. Raised-line tactile graphics take weeks to produce and cost thousands of pounds. But almost every student already carries a vibration motor, a camera, and a speaker right in their pocket."* | Keep focus on the textbook diagram if props slip. |
| **0:38–1:00** (22s) | **The Creature & The Lab:** Full view of the Start screen. Stitched Frankenstein phone creature mascot SVG visible with bolts and glowing optic pupil. Three organ tiles shown: **Nerves (Vibration)**, **Eyes (Vision AI)**, **Voice (Synthesizer)**. Double-tap full-screen button; app buzzes and speaks *"Ghost Touch ready."* | Start screen (`#0b0e0c` charcoal background, blueprint grid, `#39ff88` accents). | *"We stitched three phone parts into one creature: an ordinary buzzer for tactile nerves, a vision AI for eyes, and a browser synthesizer for a voice. Built with Atkinson Hyperlegible typography for low-vision readers, forty-eight pixel touch targets, and full screen-reader compliance."* | If Web Speech is delayed on cold boot, double-tap the screen to trigger speech inside the gesture. |
| **1:00–1:20** (20s) | **Capture & Lab Settings:** Capture screen appears. Show layout: brand header, primary glowing "Take photo" button, specimen jar cards. Tap the "Lab settings" button (*"Settings: English, 1.0×"*). Sheet opens; switch language to Hindi or Gujarati, hear immediate localized speech confirmation, adjust rate to 1.25×, dismiss sheet. | Capture screen & Lab Settings sheet. | *"The lab puts accessibility first. A single settings button opens the Lab settings sheet, letting students switch between English, Hindi, and Gujarati, or speed up speech, with instant spoken confirmation."* | If settings sheet is still in review/stub state, highlight the accessible toolbar selectors directly on Capture screen. (verify) |
| **1:20–1:40** (20s) | **Powering Up & "IT'S ALIVE!":** Snap photo of printed triangle (or tap "Triangle" specimen jar card). Status card displays *"Reading your diagram…"*; copper meter charging bar pulses with 1.5s interval beeps. Suddenly, brief spark arc + glow pulse triggers and the `success` earcon chimes as Explore opens. | Loading state (copper charging bar) → Explore screen transition. | *"Snap a photo, choose an image or textbook PDF, or pick a specimen jar sample. As the vision pipeline extracts geometry into a normalized tactile scene, the lab powers up. When it's ready: it comes alive."* | If cloud vision API times out or hits quota, tap the built-in "Triangle" specimen card. It loads in milliseconds with zero network requests. |
| **1:40–2:10** (30s) | **Tactile Exploration (TalkBack ON):** Turn TalkBack ON on camera (or show active TalkBack speech). Perform the TalkBack pass-through gesture: double-tap, hold, and drag. Center reference tick buzzes (`vibrate(25)`). Trace lines (continuous vibration `vibrate(80)` every 70ms). Hit vertex B: "bzzzz-tap" double pulse, 450ms quiet window, synthesizer speaks *"Point B"*. | Explore screen ("Specimen Table" frame, pure black canvas, glowing green strokes). | *"TalkBack users explore using their everyday gesture: double-tap, hold, and drag. A centre reference tick anchors the starting point. Lines buzz continuously, and corners pulse a distinct double-tap with a four-hundred-and-fifty millisecond quiet window so vertices stand out clearly."* | If TalkBack gesture slips, lift finger and perform double-tap-and-hold again; the engine automatically re-arms the centre tick. |
| **2:10–2:25** (15s) | **Mathematical Curves & Theremin Tone:** Switch to the Sine Wave diagram. Drag finger along the curve; Web Audio synthesizer plays a continuous theremin pitch rising from 200 Hz to 1000 Hz with visual peak height and falling into troughs. | Explore screen (Sine wave / graph curve). | *"On mathematical curves and function graphs, height becomes pitch. The Web Audio synthesizer acts like a theremin, rising as curves climb and falling as they dip."* | If sine wave sample is not on screen, tap Capture → Sine sample card to switch instantly. |
| **2:25–2:40** (15s) | **Spoken Voice Q&A (Ask):** In Explore, hold two fingers on canvas for 500ms (or double-tap "Ask" button). Listening earcon sounds (`beep(587, 100)`). Ask aloud: *"What kind of triangle is this?"* Phone synthesizer answers: *"This is a right-angled triangle with vertex B at ninety degrees."* Point out the fallback text box. | Explore screen (Ask listening status card & question text input). | *"Students can ask questions naturally with a two-finger hold. The AI answers aloud in two concise sentences drawn strictly from the diagram's visible facts."* | If microphone input is noisy, type question into the fallback text box and tap Send. |
| **2:40–2:50** (10s) | **Raw Mode & Offline Specimen Archive:** Photograph a crumpled or low-light diagram. App announces: *"The creature's eyes are blurry — you can still feel the outlines."* User traces Canny edge outlines. Quick cut: open Saved diagrams in Airplane mode. | Raw Mode outline display; Saved diagrams screen. | *"If a photo is blurry or AI providers fail, classical Raw Mode edge detection extracts tactile outlines, and saved diagrams reopen completely offline. The creature never leaves a student with an empty screen."* | If backend OpenCV is unreachable, demonstrate on a saved raw diagram locally. |
| **2:50–3:00** (10s) | **Teacher Calibration & Engineering Rigor:** Quick 3-second glimpse of Teacher Correct mode (dragging vertex over photo underlay with live validation). Quick cut to test summary card: 473 frontend tests, 347 backend tests, 17 property tests. Closing Title Card. | Teacher Correct screen → Test suite terminal montage → Final title card. | *"With a teacher correction bench and over eight hundred automated tests, Ghost Touch brings STEM graphics within reach of every student. Feel diagrams you cannot see."* | If video runtime is tight, cut the Correct screen shot and prioritize the test suite & closing title card. |

---

## 3. What NOT to Show / What NOT to Say

To ensure the demo remains ethical, professional, and compliant with accessibility standards, strictly observe these rules:

1. **NO Blindness Jokes or Gags:**
   - **Never** say "It's so easy a blind person could do it" or make jokes about darkness, night, seeing, or blindness.
   - **Never** depict simulated blindness using novelty blindfolds, sleep masks, or blackout glasses. Such tropes trivialize visual impairment.
2. **NO Medical Gore or Horror Tropes:**
   - The "Frankenstein's Lab" concept is playful, scientific retro-futurism (copper rivets, stitched seams, blueprint grids, electrical sparks).
   - **Never** include blood, severed body parts, surgical needles, or grotesque imagery.
3. **NO Novelty or Unreadable Horror Fonts:**
   - All text must remain in **Atkinson Hyperlegible** (or clean system sans-serif fallback).
   - Do not use dripping, blood-splatter, or cracked novelty fonts for titles or captions.
4. **NO Flashing Animations or Strobing Lights:**
   - Never show animations flashing faster than 3 times per second (WCAG 2.3.1 compliance).
   - The "It's Alive" spark animation must remain under 1.2 seconds in duration.
5. **NO Post-Production Audio Sweetening of Haptics:**
   - Do not overlay artificial synthetic buzz sound effects in video editing software.
   - Record genuine physical vibration motor audio using an external microphone near the phone body.
6. **NO Unverified Claims or Exaggerated Accuracy:**
   - Do not claim "100% diagram recognition" or unverified benchmark percentages.
   - Acknowledge cloud latency honestly if demonstrated on a live mobile network, or demonstrate the instant local specimen jar sample path.
7. **NO Exposure of API Keys or Environment Files:**
   - Never show terminal commands displaying `.env` files, API keys, or token secrets.
8. **NO Unconsented Faces:**
   - Focus the camera exclusively on hands, the smartphone screen, and tactile interactions unless signed model release forms are on file.

---

## 4. Production Checklist Before Filming

- [ ] Phone screen cleaned of fingerprints and smudges.
- [ ] Screen brightness set to 100% to avoid camera sensor flicker.
- [ ] "Do Not Disturb" active on phone to prevent notification popups.
- [ ] Android media volume at 85%; touch haptics enabled.
- [ ] Practice the TalkBack pass-through gesture (double-tap, hold 0.5s, then drag) 3 times to ensure smooth continuous execution on camera.
- [ ] Timer running beside the camera to keep total run time strictly under 3:00.
