# Demo Script: Ghost Touch (Under 3:00)

> **Target Duration:** 2 minutes 50 seconds – 3 minutes 00 seconds (Hard limit: 3:00)  
> **Updated:** 2026-11-06 for the Frankenstein's Laboratory redesign (Start screen with mascot and organ rows, "Wake the creature" full-screen button, Lab settings sheet with machine-translated Hindi/Gujarati, specimen cards with previews, "The lab is powering up" meter, stitched specimen-table frame with spark arc, theremin sonification, TalkBack pass-through cursor, Ask by voice/text, Teacher Correct mode, and Raw Mode safety net).  
> **Filming Rules:** Show hands, screen, and physical interactions. No faces without explicit written consent. No copyrighted background music. Sound design and physical haptics carry the narrative.  
> **Ethics & Theme Stance:** Spookiness lives strictly in the stitched creature and the mad-science lab aesthetic, **never** in blindness: no blindfolds, no "darkness" jokes, and no eye-gore.

---

## 1. Pre-Filming Setup Checklist

- **Device:** Android smartphone (e.g. OnePlus Nord CE6 or budget Android device) running Chrome over HTTPS. Battery $\ge 80\%$, media volume set to $85\%+$. Touch haptics active at maximum slider intensity in Android Settings.  
  *(Note: The app has not yet been validated on a physical phone; physical motor testing is pending).*
- **Backend Warm-Up (Mandatory):** The Render free-tier backend sleeps after 15 minutes of inactivity, and the first request takes ~30–35 seconds. Open `https://ghost-touch-api.onrender.com/api/v1/health` in a browser 1 to 2 minutes prior to filming and confirm `{"ok":true}` before pressing record.
- **Microphone & Sound:** Place an external lavalier or directional microphone within 10 cm of the phone body to capture physical motor vibration buzzes, Web Audio theremin pitch glides, and Web Speech synthesis clearly without artificial sound effects.
- **Printed Props:** One clean printed textbook page with a labelled right triangle (e.g. NCERT Class 9 geometry) and one page with a function graph or bar chart.
- **Offline Safety:** The three built-in specimen cards (Right triangle, Sine wave, Bar chart) run 100% locally with zero network calls. Start the live demo from these specimen cards for maximum reliability.
- **Language Notice:** Hindi and Gujarati translations are machine-translated and not yet reviewed by a native speaker. Disclose this honestly when showing the settings sheet.

---

## 2. Timed Shot List & Stage Directions (Total Runtime: 3:00)

| Time | Visual / Action | Screen & Elements | Spoken Narration (Natural Delivery) |
|---|---|---|---|
| **0:00–0:15** (15s) | **The Hook:** Extreme close-up on a finger tracing a glowing green line on a jet-black canvas framed by aged copper rivets and stitched seams. Audible motor buzz. At the corner, a sharp "bzzzz-tap" double pulse sounds, followed by a 450 ms quiet window, and the voice speaks: *"Point B. Right angle."* Fade in Title Card: **Ghost Touch: feel diagrams you cannot see.** | Explore screen (Right triangle on specimen table frame). | *(Silence for 7 seconds. Let the physical vibration motor hum and speech hook the audience.)* <br><br>*"Ghost Touch. Feel diagrams you cannot see."* |
| **0:15–0:35** (20s) | **The Problem:** Split shot: printed science textbook diagram on the left, an ordinary budget Android phone on the right. | Printed textbook page vs. budget Android smartphone. | *"Diagrams lock blind students out of STEM education. Raised-line tactile graphics take weeks to produce and cost thousands of pounds. Refreshable tactile tablets cost upwards of £6,500. Yet nearly every student already carries a vibration motor, a camera, and a speaker right in their pocket."* |
| **0:35–0:55** (20s) | **The Creature & The Lab:** Full shot of Start screen: logo mark, friendly creature mascot with optic pupils, and three organ rows: **Nerves** (Buzzer), **Eyes** (Vision AI), **Voice** (Synthesizer). Tap the big "Wake the creature" button (the whole screen is one button). Phone delivers a 50 ms haptic buzz, plays ascending start earcon, and announces intro aloud. | Start screen (`#0b0e0c` charcoal background, mascot SVG, organ rows, "Wake the creature" button). | *"We stitched three phone parts into one creature: an ordinary notification buzzer for tactile nerves, a vision AI for eyes, and a browser synthesizer for a voice. Built with Atkinson Hyperlegible typography for low-vision readers, 48-pixel touch targets, and full screen-reader compliance."* |
| **0:55–1:15** (20s) | **Capture & Lab Settings:** Capture screen appears showing brand header with logo, primary glowing "Take photo" button, secondary "Choose image" and "Saved diagrams", and specimen cards. Tap ONE "Settings: English, 1.0×" button to open the Lab settings sheet. Switch language to **हिन्दी** (Hindi); immediately hear localized confirmation: *"भाषा हिंदी में सेट की गई।"* Note that Hindi/Gujarati are machine-translated. Close sheet. | Capture screen & Lab settings sheet modal. | *"The lab puts accessibility first. A single settings button opens the Lab settings sheet, letting students switch between English, Hindi, and Gujarati, or adjust speech speed. Hindi and Gujarati are currently machine-translated and awaiting native-speaker review."* |
| **1:15–1:40** (25s) | **Live Tactile Exploration (TalkBack ON):** With TalkBack active, tap the **Right triangle** specimen card (zero network needed). A brief spark arc (<1.2s) flashes as Explore opens. Student performs the TalkBack pass-through gesture: **double-tap, hold, and drag**. App gives a 25 ms tick and speaks *"Centre."* Finger traces lines (continuous buzz `vibrate(80)` every 70 ms). Hitting vertex A triggers "bzzzz-tap" (`vibrate([50, 90, 50])`), 450 ms quiet period, and speaks *"Point A"*. Tracing to B speaks *"Point B. Right angle."* | Explore screen (Specimen table, pure black canvas, glowing green strokes). | *"TalkBack users explore using their everyday gesture: double-tap, hold, and drag. A centre reference tick anchors the starting point. Lines buzz continuously, and corners pulse a distinct double-tap with a 450-millisecond quiet window so vertices stand out clearly."* |
| **1:40–1:55** (15s) | **Mathematical Curves & Bar Charts:** Tap Back; select **Sine wave** specimen card. As finger traces the curve, a Web Audio synthesizer produces a continuous theremin pitch rising from 200 Hz to 1000 Hz with wave peaks and dipping in troughs. Quick cut to **Bar chart** specimen card: touching bars plays tones matching heights and speaks category values. | Explore screen (Sine wave curve / Bar chart). | *"On mathematical function graphs, height becomes pitch. The Web Audio synthesizer acts like a theremin, rising as curves climb and falling into valleys. On bar charts, tone and speech let students compare quantities immediately."* |
| **1:55–2:15** (20s) | **Spoken Q&A (Ask) & Teacher Correct:** In Explore, double-tap the "Ask" button (or hold two fingers). Listening chime sounds. Ask aloud: *"What is the hypotenuse?"* Synthesizer answers from grounded diagram facts: *"AB is 5 centimetres."* Quick cut: tap "Correct" button; sighted teacher fine-tunes vertex placement over photo underlay, checks validation, and saves in seconds. | Ask status card & text fallback; Teacher Correct mode screen. | *"Students can ask questions aloud and receive short, grounded answers drawn strictly from the diagram's facts. If a diagram needs adjustment, a sighted teacher can tap Correct, fine-tune vertices, and validate the scene in seconds."* |
| **2:15–2:35** (20s) | **Raw Mode (The App Never Leaves You with Nothing):** Snap a photo of a messy or poorly lit textbook sketch. The vision model cannot parse labels, but the app announces: *"The creature's eyes are blurry, you can still feel the outlines."* Explore displays detected Canny edge outlines. Finger traces edges with full haptic vibration. | Capture loading meter ("The lab is powering up") → Explore Raw Mode notice and Canny outlines. | *"If a photo is blurry, a cloud provider times out, or the network drops, our classical computer vision fallback—Raw Mode—extracts the outlines. The creature's eyes may be blurry, but the app never leaves a blind student with an empty screen."* |
| **2:35–2:48** (13s) | **Real-World Focus & Student Testing:** Cut to phone and hands at student testing desk. Detail the upcoming usability evaluation at the Blind People's Association (BPA) in Ahmedabad. Note that physical device testing on budget Android phones is scheduled next. | User testing protocol / classroom desk with phone. | *"Engineered for budget Android phones and designed for classroom reality. While physical phone tests are pending, our structured protocol for in-person trials at the Blind People's Association in Ahmedabad is ready."* |
| **2:48–3:00** (12s) | **Engineering Rigor, Tools Disclosure & Close:** Rapid montage: test suite passing (1049 frontend tests, 348 backend tests, 17 property tests). Closing Title Card with repository link. Transparent attribution: Kiro for specs, steering, hooks, and property tests; Antigravity built the Lab redesign; Claude Code supervised. | Test suite terminal pass → Final Title Card. | *"Built with specs, steering rules, and 17 mathematical property tests. Spec-driven engineering by Kiro; the Lab redesign built by Antigravity; supervised by Claude Code. Ghost Touch: feel diagrams you cannot see."* |

---

## 2b. DRAFT Beats: Guide & Share Integration (Marked DRAFT)

> [!IMPORTANT]
> The following two beats are **DRAFT ONLY**. They demonstrate the "Guide my finger" and "Teacher verify & share" features currently implemented behind feature flags (`VITE_FEATURE_GUIDE` and `VITE_FEATURE_SHARE`). Neither feature has been validated on physical hardware; see Section 2c for how to cut existing shots to accommodate them within the strict $\le$ 3:00 ceiling.

| Beat ID | Visual / Action | Screen & Elements | Spoken Narration (Natural Delivery) | Duration |
|---|---|---|---|---|
| **Beat A [DRAFT]** | **Ask "Where is the right angle?" → "Guide me" → Finger arrives → Arrival buzz:**<br>In Explore on Right Triangle (with `VITE_FEATURE_GUIDE=1` active). Tap Ask button (or 2-finger long-press). Listening cue sounds. Sighted/student asks: *"Where is the right angle?"*. Status shows *"Thinking..."*. Voice answers: *"The right angle is at Point B, bottom right."* and provides a prominent **"Guide me"** action button. Student taps **"Guide me"** (or speaks *"Guide me"*). Directional guidance begins: the finger traces outward from center; pulse intervals accelerate rapidly as the finger nears vertex B (`pulseIntervalMs` throttling from 600 ms down to 120 ms); on headphones, dynamic stereo audio pans right (`panFor(dx)`); on phone speaker, voice prompts *"right"*, *"down"*, *"here"*. As the finger crosses Point B's arrival radius, a crisp, distinct arrival buzz fires (`vibrate([50, 90, 50])`), guiding tones stop, and the app speaks: *"Point B"*. | Explore screen status card with "Guide me" action button → canvas directional pulses and stereo audio → arrival buzz at vertex B. | *"When a student asks where the right angle is, Ghost Touch doesn't just describe it—it guides their finger directly to it. Tap 'Guide me', and audio and haptics turn into a tactile compass. Pulses accelerate as you get closer, stereo tones pan right, and arriving at Point B triggers a confirming arrival buzz."* | **16s** |
| **Beat B [DRAFT]** | **Teacher fixes a label on laptop → QR Code → Student phone opens "Verified by...":**<br>Over-the-shoulder split shot: On the left, a sighted teacher on a laptop at `#/teach` inspects an NCERT geometry diagram. The teacher drags a vertex into place and types label *"Point B (90°)"*. In the verification card, teacher enters name *"Mrs. Sharma"* and note *"Verified for Class 9 Geometry"*, then clicks **"Verify & Share"**. The diagram is immediately encoded into a compressed URL fragment hash (`#s=...`) and displays an on-screen QR code (zero server round-trip; no data sent to any cloud). On the right, a student holds an ordinary budget Android phone and points its camera at the laptop screen. The phone scans the QR code and opens Chrome cold. The diagram loads instantly and completely offline, displaying a green specimen-table header banner: *"Verified by Mrs. Sharma"*, and speaks: *"Verified by Mrs. Sharma. Note: Verified for Class 9 Geometry"* followed by the diagram title. | Teacher editor (`#/teach` on laptop) with verification card and on-screen QR code → Student Android phone scanning QR → Explore screen opening with "Verified by Mrs. Sharma" banner. | *"Teachers can verify and distribute diagrams in seconds. On a laptop at hash teach, a teacher adjusts a label, types their name, and generates an instant offline QR code. The student scans it, and the diagram opens directly from the URL hash—completely offline, with zero server storage, announcing 'Verified by Mrs. Sharma'."* | **19s** |

---

## 2c. What to Cut to Stay Under 3:00 (Budget Reconciliation)

The base script in Section 2 is timed to exactly **3 minutes 00 seconds (180s)**. Inserting Beat A (16s) and Beat B (19s) adds **35 seconds**, which would push total runtime to 3:35. To maintain the strict $\le$ 3:00 duration limit, apply the following cuts from the base script:

1. **Cut from Shot 8 (2:15–2:35, Raw Mode): Cut 12 seconds.**  
   *Current:* 20s showing photo snap, vision fallback notice, and edge tracing.  
   *Trim to 8s:* Show the photo snap, flash the notice (*"The creature's eyes are blurry, you can still feel the outlines"*), and trace one Canny green edge stroke in 8 seconds. Narration focuses on the one core message: the app never leaves a blind student with an empty screen.  
   *(Saves: 12s)*

2. **Cut from Shot 4 (0:55–1:15, Capture & Lab Settings): Cut 10 seconds.**  
   *Current:* 20s detailing Capture buttons, opening settings sheet, switching to Hindi, and closing.  
   *Trim to 10s:* Tap settings button directly, tap Hindi, hear *"भाषा हिंदी में सेट की गई।"*, and dismiss sheet immediately. Skip extended discussion of language picker layout.  
   *(Saves: 10s)*

3. **Cut from Shot 3 (0:35–0:55, The Creature & The Lab): Cut 8 seconds.**  
   *Current:* 20s panning over mascot SVG and narrating the three organ rows (Nerves, Eyes, Voice).  
   *Trim to 12s:* Focus camera on the big "Wake the creature" button, tap immediately, hear ascending start earcon, and speak: *"We stitched an ordinary buzzer for nerves, vision AI for eyes, and a browser synthesizer for voice."*  
   *(Saves: 8s)*

4. **Cut from Shot 9 (2:35–2:48, Real-World Focus & Student Testing): Cut 5 seconds.**  
   *Current:* 13s describing classroom reality and the upcoming BPA Ahmedabad testing protocol.  
   *Trim to 8s:* Show the phone and hands at the student testing desk with concise voiceover: *"Engineered for budget Android phones, with classroom usability trials at the Blind People's Association in Ahmedabad scheduled next."*  
   *(Saves: 5s)*

**Total Time Saved:** $12 + 10 + 8 + 5 = 35\text{ seconds}$.  
**Reconciled Runtime:** $180\text{s} - 35\text{s} + 35\text{s} = \mathbf{180\text{ seconds (2:55 – 3:00)}}$, preserving the hard 3:00 ceiling.

---

## 3. What Can Go Wrong and the Fallback

| Risk / Failure Scenario | Why It Happens | Live Stage Fallback |
|---|---|---|
| **Cold Backend Latency (~30–35s)** | Render free-tier container sleeps after 15 min idle. The first API call takes ~32s to spin up. | **Prevent:** Visit `https://ghost-touch-api.onrender.com/api/v1/health` 1–2 minutes before filming until `{"ok":true}` returns.<br>**Live Fallback:** Run the live demo directly from the offline **specimen cards** (Right triangle, Sine wave, Bar chart) on the Capture screen. They load in milliseconds with zero network requests. |
| **AI Provider Failure / Timeout** | Upstream vision LLM providers (Gemini/OpenAI) hit rate limits, quotas, or 503 high-demand errors. | **Feature it deliberately!** The app automatically degrades to **Raw Mode** (`mode: "raw"`), announcing: *"The creature's eyes are blurry, you can still feel the outlines."* Show this as an intentional resilience feature proving the app never leaves a blind student with a blank screen. |
| **Speech Blocked on Boot** | Mobile browsers block Web Audio and Web Speech until an explicit user gesture. | **Built-in solution:** The entire Start screen is a single button ("Wake the creature"). The first tap to enter Capture satisfies browser user-gesture policy, unlocking Web Audio oscillators and speech synthesis immediately. |
| **No Vibration on Recording Device** | Device vibration motor is toggled off in Android settings, or recording is done on an unsupported desktop/iOS browser. | **Pre-check:** Check Android Settings > Accessibility > Vibration & haptic strength > Touch feedback is ON.<br>**On-Camera:** Ensure an external microphone is placed close to the phone to record the physical motor hum. Remind viewers that tone sonification and spoken earcons always accompany vibrations. *(Note that physical phone motor validation is officially pending).* |
| **TalkBack Gesture Missed** | User lifts finger too quickly, triggering a standard TalkBack single click instead of pass-through. | **Recovery:** Lift finger completely and repeat: **double-tap, hold down on second tap, then drag**. The engine immediately fires the 25 ms centre reference tick and speaks *"Centre."* to confirm re-anchoring. |

---

## 4. What NOT to Claim on Video

1. **Do not claim physical phone validation:** Transparently state that testing has been performed in browser emulation and automated test suites, but physical on-device motor validation is pending.
2. **Do not claim native-speaker verified translations:** Clearly disclose that Hindi and Gujarati voices and interface strings are machine-translated and pending review by native-speaking educators.
3. **Do not claim unmeasured accuracy on textbook photos:** Do not state percentage accuracy for camera capture until real-world benchmark data is measured.
4. **Do not fake blind student footage:** Show only footage and quotes collected with full, informed written consent. If field trials are pending, demonstrate the TalkBack pass-through gesture on camera with TalkBack speech clearly audible.
5. **Do not misattribute tool roles:** Be scrupulously honest: Kiro authored specs, steering, hooks, and property tests; Antigravity built the Lab redesign; Claude Code supervised. Do not claim Kiro built the redesign.
6. **NO Blindness Tropes:** Never joke about darkness, blindness, or sightlessness; never use novelty blindfolds.
7. **Do not claim Guide or Share are hardware-verified:** Explicitly treat "Guide my finger" and "Teacher verify & share" as draft preview features tested under browser emulation; do not claim physical on-device haptic validation on video.
