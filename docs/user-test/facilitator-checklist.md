# Facilitator Checklist: Pre-Session, In-Session & Teardown

> **Purpose:**  
> Operational checklist for conducting smooth, respectful, and reliable user testing sessions with blind and low-vision students using the Ghost Touch prototype.

---

## 1. Equipment & Materials Inventory

### Hardware
- [ ] **Primary Android Phone:** (e.g., OnePlus Nord CE6) charged to 100%.
- [ ] **Secondary Spare Android Phone:** (e.g., budget Redmi/Samsung device) charged to 100%, identically configured.
- [ ] **Power Bank & USB-C Cables:** Charged and accessible.
- [ ] **Bluetooth Speaker:** Charged and paired to primary phone (for noisy classrooms).
- [ ] **Over-Ear Headphones:** Clean, with 3.5 mm / USB-C adapter (alternative for noisy environments).
- [ ] **Stopwatch / Timer:** Dedicated digital timer or secondary watch (do not use the testing phone).

### Printed Documentation & Stationery
- [ ] **Spoken Consent & Assent Scripts (`consent-script.md`):** 4 printed copies.
- [ ] **Observation & Task Sheets (`task-sheet.md`):** 4 printed copies.
- [ ] **Result Templates (`results-template.md`):** 4 printed copies (one per participant: P1, P2, P3, P4).
- [ ] **Tactile / Printed Baseline Cards:** Diagram description cards or embossed prints for baseline comparison.
- [ ] **Pens & Clipboard:** 2 functioning pens.
- [ ] **Sanitizing Wipes:** Skin-safe device wipes for cleaning screens between participants.

---

## 2. Phone Configuration Checklist (Complete 1 Hour Before Session)

Perform these steps on **both** the primary phone and the spare phone:

### A. Network & HTTPS Verification
- [ ] **HTTPS Live:** Open Chrome and navigate to the Ghost Touch deployment URL.  
  *(Note: Chrome strictly requires a valid HTTPS origin or localhost for the Web Vibration API to function).*
- [ ] **PWA Precache:** Refresh once to ensure the Service Worker installs and caches application assets.
- [ ] **Offline Mode Test:**  
  1. Turn on Android **Airplane Mode**.  
  2. Refresh the app.  
  3. Verify the Start screen loads.  
  4. Tap "Tap anywhere to begin" to reach Capture.  
  5. Tap the Triangle, Sine, and Bar chart sample cards.  
  6. Confirm all 3 diagrams load into Explore with working vibration and audio without an internet connection.  
  7. Turn Airplane Mode back off (or leave on if testing purely offline).

### B. Android System & Accessibility Settings
- [ ] **Vibration & Haptics:**  
  - Navigate to: `Settings > Sound & vibration > Vibration & haptic strength` (or `Settings > Accessibility > Vibration & haptic strength`).  
  - Ensure **Touch feedback / Haptic feedback** is toggled **ON** and set to maximum slider intensity.  
  - Test vibration response: tap system navigation keys to confirm motor actuation.
- [ ] **Volume Levels:**  
  - Set **Media Volume** to **75%–80%**.  
  - Ensure **Ring & Notification Volume** is silenced (Do Not Disturb enabled) so notifications do not vibrate or interrupt during tests.
- [ ] **Screen Timeout:**  
  - Set `Settings > Display > Screen timeout` to **10 minutes** (or "Never") to prevent screen dimming/locking during finger pauses.
- [ ] **TalkBack Shortcut:**  
  - Ensure the **Accessibility Shortcut** is configured: *Press and hold both Volume Up and Volume Down keys for 3 seconds* to quickly toggle TalkBack on and off.

### C. Live Gesture Smoke-Test (Facilitator Test)
- [ ] **TalkBack ON Test:**  
  1. Turn TalkBack ON.  
  2. Double-tap the Start screen to enter Capture.  
  3. Double-tap the Triangle sample card to enter Explore.  
  4. Perform the Explore gesture: **Double-tap, hold on the second tap, and drag**.  
  5. Verify:  
     - App speaks "Centre." with a subtle 25 ms tick when placed.  
     - Continuous vibration buzzes when crossing triangle lines.  
     - Sharp pulse triggers and corner label speaks ("Point A", "Point B") at vertices.  
  6. Test Exit: perform the TalkBack Back gesture (or press Android Back); confirm return to Capture.
- [ ] **TalkBack OFF Test:**  
  1. Turn TalkBack OFF.  
  2. Touch and drag directly across lines on the screen; verify identical haptics and pitch.  
  3. Perform the two-finger swipe down gesture; verify clean return to Capture.

---

## 3. In-Session Facilitator Protocol Checklist

### Arrival & Room Setup (10 Minutes Prior)
- [ ] Meet school contact and teacher at `[ROOM / LOCATION]`.
- [ ] Position table and chairs: quiet corner away from hallway echoes, chairs at comfortable table height.
- [ ] Wipe down phone screens with sanitizing wipes.
- [ ] Place Bluetooth speaker centered on table (paired and volume balanced).

### Participant Workflow (Repeat for P1, P2, P3, P4 — 20 Min Each)
- [ ] **Step 1: Welcome & Assent (2 min):**  
  - Read `docs/user-test/consent-script.md` aloud clearly.  
  - Confirm student verbal assent and teacher/guardian consent.  
  - Record chosen media option: Notes Only OR Hands-and-Phone Only.
- [ ] **Step 2: Gesture Practice (2 min):**  
  - Demonstrate double-tap-and-hold drag.  
  - Count attempts until independent execution.
- [ ] **Step 3: Baseline Comparison (2 min):**  
  - If Participant is odd (P1, P3): do baseline verbal description first.  
  - If Participant is even (P2, P4): do Ghost Touch app first.
- [ ] **Step 4: Task Execution (10 min):**  
  - Task 1: Find 3 corners of Triangle (time in seconds, corners 0–3).  
  - Task 2: Identify Right Angle (correct Y/N, seconds).  
  - Task 3: Count Sine Wave peaks (correct Y/N, theremin tone clarity).  
  - Task 4: Identify Tallest Bar (correct Y/N, pitch comparison).  
  - Task 5: Ask voice question (record question, answer clarity, latency).
- [ ] **Step 5: Post-Session Spoken Survey (3 min):**  
  - Read aloud Q1–Q5 (1–5 scale).  
  - Ask qualitative questions (confusing parts, homework use, hard diagrams).  
  - Thank student warmly and offer a small gesture of appreciation / certificate.

### Teacher Interview (5 Min at Conclusion of Session)
- [ ] Ask teacher about most challenging STEM diagrams in current curriculum.
- [ ] Ask about 1-minute AI correction workflow feasibility.
- [ ] Request feedback on TalkBack integration and classroom utility.

---

## 4. Teardown & Data Governance Checklist

### Media & Anonymity Audit (Before Leaving School)
- [ ] **Face Check:** Review every captured photo or video recording on the device.  
  - **Verify: STRICTLY ZERO FACES appear in any frame.**  
  - If a face or identifying school uniform insignia appears inadvertently: **crop or delete the file immediately.**
- [ ] **Audio Review:** Confirm no spoken student names or identifying details exist on audio snippets.
- [ ] **Paper Form Security:** Verify all forms use participant codes (`P1`, `P2`, `P3`, `P4`) only. No student phone numbers or personal information written down.
- [ ] **No Secrets in Repo:** Confirm no personal data, phone numbers, or emails are added to git.

### Equipment Pack-Down
- [ ] Disconnect and turn off Bluetooth speaker / headphones.
- [ ] Turn off TalkBack on test phones (hold both volume buttons 3 s).
- [ ] Clear browser cache/history if personal accounts were inadvertently used.
- [ ] Sanitise phones and place in protective cases.
- [ ] Pack cables, chargers, clipboards, and consent documentation.
- [ ] Thank the host teacher and administration warmly.
