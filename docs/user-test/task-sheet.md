# User Test Task Sheet & Facilitator Protocol

> **Target Session Length:** ~20 minutes per student  
> **Audience:** Blind and low-vision students (middle school, high school, or college)  
> **Facilitator Materials:**  
> - Primary Android phone (charged >= 80%, volume at comfortable 70%, vibration enabled)  
> - Secondary backup Android phone (identically configured)  
> - Observation / scoring sheet and pen  
> - Optional tactile print or baseline verbal description card  
> - Stopwatch / timer  
>
> **Designated Explore Gesture:**  
> - **With TalkBack ON:** Double-tap and **hold** on the second tap, then drag without lifting.  
> - **With TalkBack OFF:** Direct single-finger touch and drag (or double-tap-and-hold drag).  
> - *Note on Relative Cursor:* The virtual finger starts at the exact centre of the diagram. A subtle 25 ms tick and spoken "Centre." confirms entry.

---

## Session Time Budget (20 Minutes Total)

| Section | Activity | Time Box |
|---|---|---|
| **0. Welcome & Consent** | Read consent script, verify assent/permissions | 2–3 min |
| **1. Gesture Practice** | Teach the double-tap-and-hold drag gesture on a blank/neutral area | 2 min |
| **2. Baseline Comparison** | Half the participants do baseline first; half do app first | 2 min |
| **3. Task 1: Triangle Corners** | Locate all 3 corners of the triangle and name them | 3–4 min |
| **4. Task 2: Right Angle** | Identify which corner forms the 90° right angle | 1–2 min |
| **5. Task 3: Sine Graph Peaks** | Trace the wave and count the upward peaks | 2–3 min |
| **6. Task 4: Bar Chart** | Identify which vertical bar is the tallest | 2 min |
| **7. Task 5: Voice Question** | Ask one spoken question using the microphone button | 2 min |
| **8. Debrief & Survey** | Spoken 5-question survey and open feedback | 3 min |

---

## Baseline Protocol (Order Balance)

To measure whether Ghost Touch provides an advantage over standard classroom methods:
- **Group A (Odd Participants - P1, P3...):** Baseline description first, then Ghost Touch prototype.
- **Group B (Even Participants - P2, P4...):** Ghost Touch prototype first, then baseline description.

### Baseline Stimulus (Spoken Description)
**[SPOKEN - Baseline Only]**  
> *"I am going to describe a diagram to you with words: 'There is a right-angled triangle labeled ABC. Corner A is at the top left, corner B is at the bottom left with a 90-degree right angle, and corner C is at the bottom right. The line AB is vertical, BC is horizontal, and AC connects them diagonally.' "*  
> *Ask: "Which corner is the right angle, and where is corner C located?"*  
> *Record: Response accuracy and response latency in seconds.*

---

## Step-by-Step Facilitator Protocol

### Step 1: Teaching the Gesture (2 Minutes)

**[FACILITATOR INSTRUCTION]**  
Place the phone flat on the desk in front of the student or let them hold it securely. Ensure TalkBack is running.

**[SPOKEN]**  
> *"To explore any diagram in Ghost Touch with TalkBack running, we use a special gesture:*  
> *You tap twice with one finger, but on the second tap, **keep your finger pressed down against the glass**, then gently slide your finger around.*  
> *When your finger touches down, the app places your cursor right at the center of the screen, and you will hear a small click and the word 'Centre'. As you slide across lines, the phone will buzz. When you hit a corner or label, it will give a sharp double-pulse and speak the name.*  
> *Let's try that touch together once."*

**[FACILITATOR INSTRUCTION]**  
- If invited, gently guide the student's finger: tap-tap (hold) and drag.  
- Count how many attempts it takes until the student performs the gesture independently.

**What to Observe:**
- Does the student release their finger too quickly (triggering a normal TalkBack click)?
- Did the student hear the "Centre." prompt?
- Number of attempts required (Target: <= 2 attempts).

---

### Step 2: Task 1 — Find the Corners of the Triangle (3–4 Minutes)

**[FACILITATOR INSTRUCTION]**  
Load the bundled Triangle sample (`/samples/triangle.json` or tap the "Right triangle" sample card on the Capture screen). Confirm the Explore screen is active.

**[SPOKEN]**  
> *"On the screen right now is a triangle. Using your double-tap-and-hold drag gesture, explore the screen to find all the corners of the triangle. Tell me out loud when you feel a corner and what letter it announces."*

**What to Observe:**
- Does the student search systematically (spiral, grid, or sweeping back and forth)?
- Does the student feel the line buzz before reaching a corner?
- Does the corner pulse feel distinct from the line vibration?
- Start stopwatch when the student touches the glass; stop when they name the 3rd corner.
- Record corners found (0 to 3) and elapsed seconds.

---

### Step 3: Task 2 — Identify the Right Angle (1–2 Minutes)

**[FACILITATOR INSTRUCTION]**  
Remain on the same triangle diagram.

**[SPOKEN]**  
> *"One of the corners in this triangle forms a 90-degree right angle. Explore the corners again, and tell me: which corner is the right angle?"*

**What to Observe:**
- Does the student explore the perpendicular lines meeting at corner B?
- Does the app speak "Right angle" or does the student deduce it from geometry?
- Record: Correct (Yes / No) and elapsed time in seconds.

---

### Step 4: Task 3 — Count the Peaks on the Sine Graph (2–3 Minutes)

**[FACILITATOR INSTRUCTION]**  
Tap Back (or use TalkBack back gesture) to return to Capture. Tap the "Sine wave" sample card. Verify the Explore screen is loaded with the sine graph.

**[SPOKEN]**  
> *"Now we have a mathematical graph of a curve on the screen. As you trace along this curve, you will feel vibration, and you will hear a theremin tone that gets higher in pitch as the curve goes up, and lower in pitch as the curve goes down.*  
> *Explore the curve from left to right, and tell me: how many high peaks does this wave have?"*

**What to Observe:**
- Does the student notice the rising and falling audio pitch?
- Does the audio pitch assist in staying centered on the curve?
- Does the student detect when crossing the x-axis or y-axis (app speaks "x-axis" / "y-axis")?
- Record: Peaks counted (Correct: 1 peak above axis on standard sample) and elapsed seconds.

---

### Step 5: Task 4 — Identify the Tallest Bar (2 Minutes)

**[FACILITATOR INSTRUCTION]**  
Return to Capture. Tap the "Bar chart" sample card. Verify the Explore screen is loaded with the bar chart.

**[SPOKEN]**  
> *"Now we have a bar chart with vertical bars representing categories. When your finger touches a bar, the phone will speak the category name and play a tone matching its height.*  
> *Explore the bars across the screen and tell me: which bar is the tallest?"*

**What to Observe:**
- Does the student distinguish between adjacent bars?
- Does the pitch comparison clearly convey which value is greater?
- Record: Correct bar named (Yes / No) and elapsed seconds.

---

### Step 6: Task 5 — Ask One Question by Voice (2 Minutes)

**[FACILITATOR INSTRUCTION]**  
Remain on either the triangle or the bar chart. Point out the "Ask a question" button located at the bottom of the screen (or teach the two-finger long-press shortcut: hold two fingers for 600 ms).

**[SPOKEN]**  
> *"Ghost Touch has a voice assistant that can answer questions about the diagram you are touching. I am going to help you activate the microphone button.*  
> *When it chirps, ask a question about the diagram, such as: 'How long is side AB?' or 'Which corner has the right angle?' "*

**What to Observe:**
- Does the student activate the microphone successfully?
- Is the student's question captured clearly without speech overlap?
- Does the assistant answer within 2 sentences using diagram facts?
- If the student asks an unanswerable question, does it say: *"I don't know from this diagram"*?
- Record: Question asked, answer received, understood (Yes / No).

---

## Troubleshooting & Fail-Safe Contingency Plans

| Failure Scenario | Immediate Action |
|---|---|
| **No Internet / Wi-Fi drops** | The app is a Progressive Web App (PWA) with built-in offline samples. **Do not attempt camera capture.** Direct the student to the 3 offline sample cards (Triangle, Sine, Bar chart) on the Capture screen. All haptics, pitch, and facts run locally in the browser engine. |
| **Vision API timeout / Cloud 429 error** | If capturing a new photo fails or takes >15 s, the app automatically switches to **Raw Mode**. Inform the student: *"The AI could not read the text labels, so the phone is now vibrating on the visual lines directly."* Continue testing line tracing. |
| **Phone vibration feels weak or absent** | 1. Check Android Settings > Accessibility > Vibration & haptics > Touch feedback (must be ON).<br>2. Confirm Chrome has permission for vibration.<br>3. If persistent, switch immediately to the **spare phone**. |
| **TalkBack gesture is frustrating or failing** | 1. Remind the student: *"Remember to keep your finger pressed down on that second tap before moving."*<br>2. If TalkBack continues to consume gestures after 3 failed attempts, use the Android accessibility shortcut: **press and hold both volume keys for 3 seconds** to suspend TalkBack, test direct touch exploration, then hold both volume keys again to resume TalkBack. Document this fallback in the notes. |
| **Audio cannot be heard clearly** | Turn on the paired Bluetooth speaker or offer clean over-ear headphones. Ensure device media volume is set to 75%+. |
