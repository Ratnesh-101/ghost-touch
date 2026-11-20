# Ghost Touch — Teacher's Guide

This is a one-page, plain-language guide for a teacher who has received the link to Ghost Touch (e.g., `https://ghost-touch-iota.vercel.app`).

Ghost Touch is an open-source assistive web app running on Android Chrome over HTTPS. It turns printed textbook diagrams into tactile graphics that blind and low-vision students explore by touch, sound, and spoken words. Follow these three steps to prepare a diagram, fix any reading errors, and hand the phone safely to your student.

---

> [!NOTE]
> **Honest Testing & Privacy Notice:**
> - **Hardware Testing Status:** The "Guide my finger" and "Teacher verify & share" features ship in the live code, but **neither has been tested on a physical phone yet**. They have been verified through unit and property tests only.
> - **Privacy & AI Providers:** When you photograph or upload a diagram, the image is transmitted over encrypted HTTPS to our backend and forwarded to third-party AI vision providers (Google Gemini, OpenAI, or Nebius) to detect shapes and coordinates. **Photos are not stored on our servers or kept on disk.** Image bytes are discarded as soon as processing completes, and extracted coordinates are temporarily cached in server RAM for up to 6 hours to save processing quota. For full details, see [PRIVACY.md](PRIVACY.md).

---

## The 3-Step Teacher Workflow

```
[Step 1] Turn Teacher tools ON  ──> Photograph diagram ──> Check feel by touch
             │
[Step 2] Tap "Correct"          ──> Fix points/labels   ──> Save & optionally share (link/QR)
             │
[Step 3] Turn Teacher tools OFF ──> "Correct" is hidden ──> Hand phone to student
```

---

### Step 1: Turn Teacher Tools On, Photograph, and Check by Touch

Before capturing a diagram, enable teacher controls so you can inspect and correct the AI's work:

1. **Open Settings:** On the Capture screen (or later on Explore), look at the top header bar for the Settings button (e.g. `Settings: English, 1.0×`, `.gt-capture__button--settings` / `.gt-settings-launcher__button`). Tap it to open the Lab Settings sheet.
2. **Expand More Settings:** Tap **"More settings"** (`lab.settings.moreSettings`) to reveal advanced controls.
3. **Turn Teacher Tools ON:** Scroll to the **"Teacher tools"** section (`lab.settings.teacher`). Tap the toggle switch (`role="switch"`) to turn it ON. The phone announces aloud: *"Teacher tools enabled."* (`lab.settings.teacherOn`).
   - *Technical flag:* Teacher tools requires the build-time flag `VITE_FEATURE_SHARE=1` (`frontend/src/config/features.ts: isShareEnvOn()`). If this flag was not enabled when building the site, the Teacher tools section will not appear.
   - *Guidance flag:* The optional "Guide my finger" directional guidance feature is similarly controlled by `VITE_FEATURE_GUIDE=1` (`isGuideEnvOn()`) and its own toggle in Settings.
4. **Close Settings:** Tap **"Close settings"** (`lab.settings.close`) to return to the Capture screen.
5. **Photograph the Diagram:**
   - Tap **"Take photo"** (`capture.takePhoto`), which opens the camera (`<input capture="environment">`). Hold the phone flat and steady over the printed diagram in good light, snap the picture, and accept it.
   - Alternatively, tap **"Choose image"** (`capture.chooseImage`) to upload a saved JPEG, PNG, WebP image, or 1-page PDF.
   - The app announces *"Reading your diagram…"* (`capture.reading`) with progress beeps while the backend processes the image.
6. **Check the Diagram by Touch:** Once loaded, the Explore screen opens. Drag one finger across the screen to feel the geometry:
   - **Lines:** Phone vibrates continuously (`vibrate(80)` every 70 ms) while your finger stays on a line.
   - **Corners / Vertices:** Phone gives a sharp double pulse (`vibrate([50, 90, 50])` ms), suppresses line vibration for 450 ms, and speaks the corner's name (e.g. *"Point A"*).
   - **Curves (Function Graphs):** Phone plays a smooth theremin tone gliding between 200 Hz and 1000 Hz that rises as the curve goes higher and falls as it goes lower.

#### What the AI Can Get Wrong
AI vision models are not infallible. Always check the diagram visually and tactilely for:
- **Misplaced vertices:** Corner points slightly offset from actual line intersections.
- **Missed or phantom lines:** Faint lines omitted, or page fold shadows misread as lines.
- **Label misreads:** Handwritten or small print OCR confusions (e.g. reading '8' as 'B' or 'P' as 'R').
- **Disconnected shapes:** Polygon vertices failing to snap together.
- **Raw Mode fallback:** If the server is slow or vision providers time out, the backend falls back to OpenCV Canny edge detection, announcing: *"I couldn't fully read this diagram. You can still feel its outlines."* (`raw.announce`). In Raw Mode, named points are unavailable, and only edge outlines can be felt.

---

### Step 2: Correct Mistakes with the Correct Screen, Then Verify and Share

If the AI made errors, use the built-in correction tools to adjust the diagram before giving it to a student:

1. **Open Correct Screen:** Because Teacher tools is ON, an accessible **"Correct"** button (`explore.correct`, `.gt-explore__correct`) appears in the bottom action bar on the Explore screen (`frontend/src/App.tsx: onCorrect={isTeacherActive() ? handleCorrect : undefined}`). Tap it.
2. **Inspect the Overlay:** The Teacher Correction screen (`frontend/src/screens/Correct.tsx`) speaks: *"Correction mode. Tap elements to select, drag points to adjust, and save when done."* (`correct.intro`). The original photograph is shown underneath a dark contrast scrim with the detected green diagram overlay on top.
3. **Make Adjustments:**
   - **Move points:** Touch and drag any vertex circle handle across the glass to align it with the photo. When released, the app speaks *"Moved point"* (`correct.pointMoved`).
   - **Edit labels:** Tap an element, type the corrected label in the "Label" text box (`correct.label`), and tap **"Apply label"** (`correct.applyLabel`).
   - **Delete mistakes:** Tap an unwanted point, line, or curve, then tap **"Delete"** (`correct.delete`).
   - **Undo / Redo:** Use **"Undo"** (`correct.undo`) and **"Redo"** (`correct.redo`) to step backward or forward through edits.
4. **Save Corrections:**
   - Tap **"Save"** (`correct.save`). The app announces *"Validating diagram…"*, validates the geometry against `POST /api/v1/validate` (or local invariants if offline), and speaks *"Corrections saved."* (`correct.saved`). You are returned to Explore with the corrected diagram active and saved to local storage.
5. **(Optional) Verify and Share via Teacher Editor (`#/teach`):**
   - If you want to share the diagram with other students or devices, open Settings, expand "More settings", and tap **"Open Teacher Editor"** (`lab.settings.openTeacher`), or navigate to `#/teach`.
   - In Teacher Editor (`frontend/src/screens/Teach.tsx`), you can load the current diagram ("Load diagram" -> "Current diagram"), add vertices ("Add point"), or add connecting segments ("Add edge"). For function graphs, set axis positions (`teach.xAxisY`, `teach.yAxisX`) between 0 and 1.
   - In the **"Ready to share"** section (`teach.verifySection`):
     - Enter your name under **"Teacher name"** (`teach.teacherName`, required, max 60 characters).
     - Enter an optional note under **"Note"** (`teach.teacherNote`, max 280 characters).
     - Tap **"Ready to share"** (`teach.markVerified`).
   - The diagram and metadata are compressed into a URL fragment (`#s=...`) using LZ-String. **The link never goes to a server.**
   - Tap **"Copy link"** (`teach.copyLink`) to copy the link to clipboard, or have students scan the on-screen **QR code** (`teach.qrCodeAlt`, generated when the link is $\le 2000$ characters).

---

### Step 3: Hand the Phone to the Student with Teacher Tools OFF

This is the most critical step to ensure a safe student experience:

1. **Turn Teacher Tools OFF:**
   - On the Explore screen (or Capture screen), tap the **Settings** button in the top header.
   - Expand **"More settings"**.
   - Tap the **"Teacher tools"** switch to turn it **OFF**. The phone speaks: *"Teacher tools disabled."* (`lab.settings.teacherOff`).
   - Close Settings.
2. **Why This Step Is Essential (Requirement 48):**
   - In `frontend/src/App.tsx`, the Explore screen only renders the Correct button when teacher tools is active:
     ```tsx
     onCorrect={isTeacherActive() ? handleCorrect : undefined}
     ```
   - When Teacher tools is turned OFF, `isTeacherActive()` returns `false`. The **"Correct" button is completely removed** from the Explore screen footer.
   - Direct navigation to `#/teach` is also disabled and redirects to Start.
   - The student cannot accidentally enter editing mode, drag points out of place, delete lines, or change labels while exploring with their fingers.
3. **Hand the Phone to the Student:**
   - The student can now safely explore the diagram by touch.
   - If using Android **TalkBack**, the student explores using the standard pass-through gesture: **double-tap, hold down on the second tap, then drag** across the screen. At the start of the hold, the phone emits a 25 ms centre reference tick and speaks *"Centre."* (`explore.centre`).
   - The student can tap **"Ask"** (`ask.button`) or hold two fingers on the canvas for $> 500$ ms to ask spoken questions about the diagram (e.g. *"How long is AB?"*).

#### If the Student Opens a Shared Link on Their Own Device
- When opening a shared link (`#s=...`) or scanning a QR code cold on their own phone, the student sees the **Share Gate** (`frontend/src/components/ShareGate.tsx`).
- The screen displays a single, focused button: **"Open the shared diagram"** (`share.gate.open`).
- Tapping this button satisfies browser user-gesture requirements, unlocking audio and speech.
- The diagram opens in Explore with an honest banner: *"Shared by [Teacher Name], not checked"* (`share.sharedBy`). Tapping **"Read note"** (`share.readNote`) reads your guidance note aloud. The student explores the verified diagram 100% offline with zero server calls!
