# Ghost Touch — Teacher's Guide

## Add your own diagram (quick version)

1. [Step 1](#step-1-turn-teacher-tools-on-photograph-and-check-by-touch): Turn Teacher tools ON, photograph or upload your diagram, and check feel by touch.
2. [Step 2](#step-2-correct-mistakes-with-the-correct-screen-then-verify-and-share): Tap "Correct" to fix points or labels, then save and optionally share.
3. [Step 3](#step-3-hand-the-phone-to-the-student-with-teacher-tools-off): Turn Teacher tools OFF so editing controls are hidden, and hand phone to student.
4. [Classroom Device Setup & Troubleshooting](#classroom-device-setup--troubleshooting-checklist): Ensure phone vibration, volume, and permissions are configured before class.

This is a one-page, plain-language guide for teachers using Ghost Touch (e.g., `https://ghost-touch-iota.vercel.app`).

Ghost Touch is an open-source assistive web application running on Android Chrome over HTTPS. It turns printed textbook diagrams into tactile graphics that blind and low-vision students explore by touch, sound, and spoken words. Follow these steps to prepare diagrams, correct any recognition errors, configure your classroom devices, and hand the phone safely to your student.

---

> [!NOTE]
> **Honest Testing & Privacy Notice:**
> * **Hardware Testing Status:** The "Guide my finger" directional hints and "Teacher verify & share" features are built into the application, but **neither has undergone formal user testing on physical phones yet**. They have been verified through automated browser emulation tests.
> * **Privacy & AI Providers:** When you photograph or upload a diagram, the image is transmitted securely over encrypted HTTPS to our backend and processed by AI vision models (Google Gemini, OpenAI, or Nebius) to detect shapes and coordinates. **Photos are not saved or stored on our servers.** Image bytes are discarded as soon as processing completes, and extracted coordinates are temporarily cached in server memory for up to 6 hours to prevent re-processing costs. For full details, see [PRIVACY.md](PRIVACY.md).

---

## Classroom Device Setup & Troubleshooting Checklist

Before handing a device to a student, verify these five Android settings. Many classroom phones have default battery or sound policies that prevent tactile feedback from working.

### 1. System Vibration (Android Haptics Settings)
On many Android phones (including Samsung Galaxy, Xiaomi, Motorola, and Google Pixel), tactile touch feedback is turned off by default in system settings.
* Open Android **Settings** -> **Sound & vibration**.
* Tap **Haptics** (or **Vibration & haptic strength** / **Touch feedback**).
* Make sure **Touch feedback** is turned **ON** and the slider is set to high.
* *Important:* If this system setting is turned off, the phone will remain completely still during touch exploration, even though the web browser has full permission to vibrate!

### 2. Battery Saver Mode
Android automatically disables the internal vibration motor whenever the phone enters Battery Saver mode or when the battery drops below 20%.
* Open the quick settings panel (swipe down from the top of the screen).
* Verify that **Battery Saver** is turned **OFF**.
* For all-day classroom lessons, keep the phone connected to a charger or above 50% battery.

### 3. Media Volume vs. Ringtone Volume
Android uses separate volume controls for Ringtone/Calls, Notifications, and Media:
* Ghost Touch plays musical function curves (rising and falling theremin tones) and speaks corner labels exclusively through the **Media** audio channel.
* Press the physical volume rocker on the side of the phone, tap the three dots or slider settings, and verify that **Media volume** is turned up (at least 60–80%).
* If using headphones, stereo audio will help guide the student horizontally across the diagram.

### 4. Camera Permission in Android Chrome
When tapping "Take photo" for the first time, Chrome on Android asks for camera permission:
* Tap **"While using the app"** or **"Allow"**.
* *Troubleshooting:* If camera access was accidentally blocked, tap the tune/lock icon on the left side of Chrome's address bar, tap **Permissions**, select **Camera**, choose **Allow**, and refresh the page.

### 5. Backend 30–60 Second Cold Start (Free Hosting Tier)
* Ghost Touch's recognition service runs on a cloud hosting provider (Render free tier). When the service is idle between classes, the server goes into a low-power sleep state.
* When you upload your first new diagram photo, the server requires **30 to 60 seconds** to wake up and process the image.
* The phone will play periodic progress beeps and announce *"Reading your diagram..."*.
* **Do not refresh or leave the page** during this time; refreshing resets the connection and restarts the 30–60 second wake-up timer. Once awake, subsequent photos process much faster.
* *Tip:* Pre-packaged sample diagrams (such as the Right Triangle or Sine Wave) work instantly and 100% offline without needing the backend server.

### 6. Teaching the TalkBack Pass-Through Gesture
If your student uses Android's TalkBack screen reader:
* A standard single-finger swipe moves focus between buttons and controls.
* To touch and trace the tactile diagram itself, the student uses the **TalkBack pass-through gesture**: **double-tap, hold down on the second tap, and then drag the finger across the glass**.
* At the start of the hold, the phone emits a crisp reference tick and speaks *"Centre"* to orient the student's finger.

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

1. **Open Settings:** On the Capture screen (or later on Explore), tap the **Settings** button in the top header bar to open the Settings panel.
2. **Expand More Settings:** Tap **"More settings"** to reveal advanced options.
3. **Turn Teacher Tools ON:** Locate the **"Teacher tools"** section and toggle the switch to **ON**. The phone announces aloud: *"Teacher tools enabled."*
   *(Note: Teacher tools requires the sharing feature to be enabled on your deployment. If your school administrator deployed the app with sharing enabled, this toggle will be visible).*
4. **Close Settings:** Tap **"Close settings"** to return to the Capture screen.
5. **Photograph the Diagram:**
   * Tap **"Take photo"** to open the camera. Hold the phone flat and steady over the printed diagram in bright, even lighting, snap the photo, and accept it.
   * Alternatively, tap **"Choose image"** to upload an existing picture (JPEG, PNG, WebP) or a 1-page PDF.
   * The app announces *"Reading your diagram..."* with progress beeps while processing.
6. **Check the Diagram by Touch:** Once loaded, the Explore screen appears. Drag one finger across the screen to feel the geometry:
   * **Lines:** The phone vibrates continuously with a smooth buzz while your finger traces along a line.
   * **Corners / Vertices:** The phone gives a crisp double-pulse vibration and speaks the corner's name aloud (such as *"Point A"*).
   * **Curves (Function Graphs):** The phone plays a musical tone that smoothly glides higher as the curve goes up and lower as it goes down.

#### What the AI Can Get Wrong
AI vision models can make mistakes on complex or low-contrast textbook pages. Always inspect the diagram visually and by touch for:
* **Misplaced vertices:** Corner points slightly offset from actual line intersections.
* **Missed or phantom lines:** Faint lines overlooked, or page fold shadows misread as lines.
* **Label misreads:** Small print or handwriting confusions (e.g., reading '8' as 'B' or 'P' as 'R').
* **Raw Mode fallback:** If the internet connection is weak or vision providers time out, the app falls back to outline edge detection, announcing: *"I couldn't fully read this diagram. You can still feel its outlines."* In Raw Mode, named points are unavailable, but line outlines can still be felt.

---

### Step 2: Correct Mistakes with the Correct Screen, Then Verify and Share

If the AI made errors, use the built-in correction tools to adjust the diagram before giving it to a student:

1. **Open Correct Screen:** Because Teacher tools is ON, an accessible **"Correct"** button appears in the bottom action bar on the Explore screen. Tap it.
2. **Inspect the Overlay:** The Correction screen opens and announces: *"Correction mode. Tap elements to select, drag points to adjust, and save when done."* The original photograph is shown underneath a dark contrast background with the detected green diagram overlay on top.
3. **Make Adjustments:**
   * **Move points:** Touch and drag any circular vertex handle across the glass to align it with the photo underneath. When released, the app confirms: *"Moved point."*
   * **Edit labels:** Tap an element, type the corrected label in the "Label" field, and tap **"Apply label"**.
   * **Delete mistakes:** Tap an unwanted point, line, or curve, then tap **"Delete"**.
   * **Undo / Redo:** Use the **"Undo"** and **"Redo"** buttons to step backward or forward through your edits.
4. **Save Corrections:**
   * Tap **"Save"**. The app validates the geometry and confirms: *"Corrections saved."* You are returned to Explore with the corrected diagram active and saved to your device.
5. **(Optional) Verify and Share via Teacher Editor:**
   * If you want to share the diagram with other students or classroom devices, open Settings, expand "More settings", and tap **"Open Teacher Editor"** (or navigate to `#/teach`).
   * In Teacher Editor, you can review diagram details, adjust axes, and prepare sharing metadata:
     * Enter your name under **"Teacher name"** (required).
     * Enter an optional guidance note under **"Note"** (e.g., *"Focus on finding the hypotenuse first"*).
     * Tap **"Ready to share"**.
   * The diagram and note are compressed directly into the web address link. **The link never goes to a server.**
   * Tap **"Copy link"** to share the link directly, or display the on-screen **QR code** for students to scan with their devices.

---

### Step 3: Hand the Phone to the Student with Teacher Tools OFF

This is the most critical step to ensure an uninterrupted student learning experience:

1. **Turn Teacher Tools OFF:**
   * On the Explore or Capture screen, tap **Settings** in the top header.
   * Expand **"More settings"**.
   * Tap the **"Teacher tools"** switch to turn it **OFF**. The phone speaks: *"Teacher tools disabled."*
   * Close Settings.
2. **Why This Step Is Essential:**
   * When Teacher tools is turned OFF, the **"Correct" button is completely removed** from the bottom navigation bar.
   * Direct access to the Teacher Editor is locked.
   * The student cannot accidentally enter editing mode, drag points out of place, delete shapes, or change labels while exploring with their fingers.
3. **Hand the Phone to the Student:**
   * The student can now safely explore the diagram by touch.
   * When using TalkBack, the student explores using the pass-through gesture: **double-tap, hold down on the second tap, then drag**.
   * The student can tap **"Ask"** or hold two fingers on the diagram to ask spoken questions (such as *"Which side is the hypotenuse?"*).

#### If the Student Opens a Shared Link on Their Own Device
* When a student opens a shared link or scans your QR code on their device, they see a simple opening screen with a single button: **"Open the shared diagram"**.
* Tapping this button unlocks sound and speech on mobile browsers.
* The diagram opens in Explore with an honest banner: *"Shared by [Teacher Name], not checked"*. Tapping **"Read note"** reads your teacher instructions aloud.
* The student explores the diagram 100% offline with zero server calls!
