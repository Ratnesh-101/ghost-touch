# Demo Script: Ghost Touch (2:55 Storyboard)

> **Target Duration:** 2 minutes 55 seconds (Hard limit: 3:00)  
> **Audience:** Kiroween and STEMergent judges.  
> **Filming Rules:** Show hands, screen, and physical interactions. No faces without explicit
> written consent. No copyrighted background music. Sound design, speech, and physical motor
> vibrations carry the narrative.  
> **Ethics & Theme Stance:** Spookiness lives strictly in the stitched creature and the mad-science
> lab aesthetic, **never** in blindness: eyes-closed trace by a sighted helper, or a real student
> with consent; no "darkness" jokes, and no eye-gore.

---

## 1. Pre-Filming Setup Checklist

- **Device:** Android smartphone running Chrome over HTTPS. Touch haptics active at maximum
  intensity in Android Settings > Accessibility. *(Note: The haptic timings were tuned on a
  OnePlus Nord CE6 and the TalkBack double-tap-and-hold gesture worked on the prototype there.
  On a Samsung Galaxy S24+, the canvas growth bug was confirmed fixed. Other phone steps are
  pending verification).*
- **Backend Warm-Up (Mandatory):** Render free-tier container sleeps after 15 min idle. Open
  `https://ghost-touch-api.onrender.com/api/v1/health` 1–2 minutes before filming until
  `{"ok":true}` returns (first call can take 30 to 60 seconds).
- **Offline Safety Net:** The three built-in specimen cards (Right triangle, Sine wave, Bar
  chart) run 100% locally with zero network calls. Use these for rock-solid live filming.
- **Audio Capture:** Place an external lavalier or directional mic within 10 cm of the phone body
  to capture physical motor hum, Web Audio theremin pitch, and speech synthesis clearly.
- **Laptop / iPhone Notice (Judge Fallback):** On devices lacking the Vibration API (laptop or
  iPhone), the app plays an audible buzz, displays a pulse ring at the cursor, and speaks:
  *"No vibration on this device. You will hear a buzz instead. Use Chrome on Android to feel it."*

---

## 2. Timed Storyboard & Narration (Total Runtime: 2:55)

> `[HW: owner to confirm]` marks a shot that depends on a step not yet verified on hardware in
> the full app.

| Time | Shot / Visual | Screen & Elements | Spoken Narration | Hardware Status |
|---|---|---|---|---|
| **0:00–0:12** (12s) | **The Hook:** Close shot, finger on the sample triangle. Motor hums continuously on line. At corner C, phone gives a double pulse and speaks "C". No voiceover narration for 5 seconds. | Explore screen (Right triangle). Jet-black canvas, green stroke. | *(5s silence while motor hums and corner speaks "C".)*<br><br>*"Ghost Touch. Feel diagrams you cannot see."* | `[HW: owner to confirm]` (Corner double-pulse and spoken corner label "C" on phone). |
| **0:12–0:30** (18s) | **The Problem:** Split shot: printed science textbook diagram on the left, ordinary phone on the right. | Printed textbook page next to budget Android phone. | *"Tactile graphics take weeks. A tactile tablet costs about £6,500. The phone in the student's pocket already has a motor, a camera and a speaker."* | Verified (hardware costs and production delays). |
| **0:30–0:45** (15s) | **The Creature & The Lab:** Start screen: mascot and three organ rows: Nerves, Eyes, Voice. Tap "Wake the creature". | Start screen (`#0b0e0c` charcoal background, mascot SVG, "Wake the creature" button). | *"Three spare parts, one creature: buzzer for nerves, vision AI for eyes, synthesizer for voice."* | Verified by code. |
| **0:45–1:20** (35s) | **Textbook Capture:** Photograph a real textbook triangle. Charging loading meter. Explore opens. Trace the detected triangle. | Camera capture → Loading meter → Explore screen with geometry. | *"A teacher or parent takes one photo."* | `[HW: owner to confirm]` (Real photo processing on phone). |
| **1:20–1:40** (20s) | **Voice Q&A:** Tap Ask. Ask aloud: *"How long is AC?"* Voice answers from diagram facts: *"AC is 4 cm long."* | Ask HUD dialog and response card. | *"The answer comes from the diagram's facts."* | `[HW: owner to confirm]` (Voice input on phone; keep typed Ask ready as backup). |
| **1:40–2:00** (20s) | **Mathematical Curves & Bar Charts:** Sine wave sample: continuous tone rises and falls with wave height (200–1000 Hz). Cut to Bar chart: touching bars plays height tone and speaks value. | Explore screen (Sine wave / Bar chart). | *"Height becomes pitch."* | `[HW: owner to confirm]` (Audio volume on phone loudspeaker). |
| **2:00–2:15** (15s) | **TalkBack Screen Reader:** TalkBack on. Double-tap and hold, then drag across diagram lines. Vibration passes through. | Explore screen with TalkBack accessibility focus. | *"It works with the screen reader blind students already use."* | `[HW: owner to confirm]` (Gesture passed on prototype on Nord CE6; full-app check pending). |
| **2:15–2:30** (15s) | **Raw Mode Safety Net:** Messy or poorly lit photo. App announces: *"The creature's eyes are blurry, you can still feel the outlines."* Explore opens with Canny edges. | Explore screen with Raw Mode banner and edge outlines. | *"It never leaves the student with nothing."* | `[HW: owner to confirm]` (Raw Mode on cluttered photo on phone). |
| **2:30–2:45** (15s) | **Spec-Driven Rigor:** Kiro IDE screen capture: formal EARS requirements, agent hook running tests on save, property test failing then passing. | Kiro IDE (spec task list, hooks, property test). | *"Specs, steering, hooks and property tests, built with Kiro."* | Recorded from Kiro IDE (`docs/kiro-evidence/`). |
| **2:45–2:55** (10s) | **Closing & Next Steps:** Final title card with repository link and live app URL. | Final title card: Ghost Touch, GitHub link, live URL. | *"Next: first sessions with blind students."* | Honest forward-looking close (school sessions pending). |

---

## 3. What Can Go Wrong and Live Fallbacks

| Risk / Failure Scenario | Why It Happens | Live Stage Fallback |
|---|---|---|
| **Cold Backend Latency** | Render free-tier container sleeps after 15 min idle. The first API call takes 30 to 60s. | **Prevent:** Ping `https://ghost-touch-api.onrender.com/api/v1/health` 1–2 minutes before filming.<br>**Fallback:** Use the three offline sample cards (Right triangle, Sine wave, Bar chart) on Capture. They run 100% locally with zero network calls. |
| **Speech Recognition Drop** | Background noise or mobile browser mic permission block. | **Fallback:** Tap "Ask" and type the question into the text input. Typed Ask runs against the identical deterministic backend facts endpoint. |
| **No Vibration on Filming Device** | Recording on a laptop, iPhone, or phone with vibration disabled. | **Fallback:** Desktop/laptop fallback buzzer and pulse rings fire automatically. Check that Android Settings > Accessibility > Touch feedback is ON for physical filming. |
| **Canvas Layout Instability** | High-DPR phone canvas expansion on hold. | **Verified Fixed:** The P0 canvas growth bug discovered on Samsung Galaxy S24+ was fixed spec-first (Requirement 25, properties P86/P87, Task 42) and verified on device. |
| **TalkBack Gesture Missed** | Lifting finger too quickly triggers a standard click. | **Recovery:** Lift finger completely and re-anchor: **double-tap, hold down on second tap, then drag**. The engine fires a 25 ms centre tick and speaks *"Centre."* to confirm re-anchoring. |

---

## 4. What NOT to Claim on Video

1. **Do not claim physical phone validation beyond what is verified:** State honestly that haptic
   timings were tuned on a OnePlus Nord CE6, the TalkBack gesture passed on the prototype there,
   and the canvas growth bug fix was verified on a Samsung Galaxy S24+. All other full-app phone
   steps are pending.
2. **Do not claim native-speaker verified translations:** Disclose that Hindi and Gujarati text
   and voices are machine-translated and pending review by native-speaking educators.
3. **Do not claim unmeasured accuracy on textbook photos:** Do not state percentage accuracy for
   camera capture until real-world benchmark data is measured.
4. **Do not fake blind student footage:** Show only footage and quotes collected with full, informed
   written consent. If field trials are pending, demonstrate the TalkBack pass-through gesture on
   camera with TalkBack speech clearly audible.
5. **Do not misattribute tool roles:** Be scrupulously honest: Kiro authored specs, steering,
   hooks, pure core, haptic engine, and property tests; Antigravity built the Frankenstein Lab
   redesign, screens, drivers, and hardening; Claude Code supervised, gated tasks, and reviewed.
6. **NO Blindness Tropes:** Never joke about darkness, blindness, or sightlessness; use eyes-closed
   trace by a sighted helper, or a real student with consent.
7. **Do not claim Guide or Share are hardware-verified:** Guide and Share ship in the live app
   but stay off until the user turns them on in Settings; neither has been tested on a phone.
8. **No claims of bug-free or completely secure code:** Security and bug audits are actively
   ongoing.
