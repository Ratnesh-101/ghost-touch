# Social Media Posts: Ghost Touch

Draft posts for Kiroween 2026. Every draft begins with `#KiroweenHackathon26` and contains the required placeholder markers.

---

## 1. Short Post (X / Twitter / Bluesky)

#KiroweenHackathon26 — Ghost Touch lets blind students explore STEM diagrams by touch on ordinary Android phones.

We stitched 3 phone parts into an assistive creature in our Frankenstein's Lab redesign:
🔊 Phone buzzer for tactile nerves (continuous vibration on lines, "bzzzz-tap" at corners)
👁️ Vision AI for eyes (reads textbook photos, PDFs & falls back to classical Raw Mode)
🎵 Theremin synthesizer for voice (height = pitch on curves, tones on bar charts)

Works with Android TalkBack. 1049 frontend + 348 backend tests, 17 mathematical properties verified with fast-check & Hypothesis. Spec-driven engineering by Kiro; Lab redesign built by Antigravity (agy); supervised by Claude Code.

Demo video: [FILL: video URL]  
Repo & live demo: [FILL: repo or live URL]  

---

## 2. Medium Post (LinkedIn / Community Forums)

#KiroweenHackathon26 — How do you teach geometry or algebra to a student who cannot see the blackboard?

Diagrams lock blind students out of STEM. Raised-line tactile graphics cost thousands of pounds and take weeks to print. Refreshable tactile displays cost upwards of £6,500. Standard AI captioning outputs a paragraph of prose, but a paragraph cannot tell your fingers where a hypotenuse meets a curve.

We built Ghost Touch: a web app for budget Android phones that turns visual diagrams into interactive tactile-audio experiences. In our Frankenstein's Laboratory redesign, the app comes alive as an assistive creature stitched from spare phone parts:
- **Haptic Nerves:** An ordinary notification buzzer delivers continuous vibration along lines and crisp "bzzzz-tap" double pulses at vertices with a 450 ms quiet period.
- **Theremin Voice:** Continuous Web Audio sine synthesis translates mathematical curve height into musical pitch (200 Hz to 1000 Hz) and sonifies bar charts.
- **TalkBack Pass-Through:** A double-tap-and-hold relative cursor gesture designed specifically for blind users, starting at diagram centre.
- **Lab Settings Sheet:** One accessible button switches speech rate and languages between English, Hindi, and Gujarati (machine-translated; community review underway).
- **Raw Mode Safety Net:** If cloud vision models time out or provider keys fail, classical OpenCV Canny edge extraction ensures students are never left with an empty screen: *"The creature's eyes are blurry, you can still feel the outlines."*
- **Teacher Correct Mode:** Sighted teachers can adjust detected vertices over a photo underlay and validate scenes in seconds.
- **Offline Specimen Cards:** Right triangle, Sine wave, and Bar chart specimen cards run 100% locally with zero network requests.

Ghost Touch was built through honest multi-agent pairing: spec-driven architecture, locked haptic steering, 5 agent hooks, and core property tests (P1–P13) authored by Kiro; full Frankenstein Lab redesign, Teacher Correct mode (P16/P17), and offline storage (P14/P15) built by Antigravity (agy); overall supervision by Claude Code.

Next step: in-person usability testing with blind students at the Blind People's Association (BPA) in Ahmedabad (physical phone motor validation pending).

Watch the 3-minute demo: [FILL: video URL]  
Explore the codebase: [FILL: repo or live URL]  

---

## 3. Four-Post Thread (X / Mastodon / Bluesky)

### Post 1/4 (The Problem & The Stitched Creature)
#KiroweenHackathon26 1/4: Diagrams lock blind students out of STEM. Tactile graphics take weeks to produce and tactile tablets cost £6,500+.

We stitched three common phone parts into an assistive creature in our Frankenstein's Lab redesign:
• Buzzer = tactile nerves  
• Vision AI = eyes  
• Theremin = voice  

Start screen features a friendly creature mascot and one "Wake the creature" button. Explore diagrams on a high-contrast specimen table.

Demo video: [FILL: video URL]  
Repo: [FILL: repo or live URL]  

### Post 2/4 (How It Feels & TalkBack)
#KiroweenHackathon26 2/4: How does Ghost Touch work?
• Finger on a line → continuous motor buzz  
• Finger at a corner → crisp "bzzzz-tap" double pulse + spoken vertex label  
• Curve on a graph → rising/falling theremin pitch (200–1000 Hz)  
• Double-tap-and-hold pass-through gesture works directly with Android TalkBack!  

If cloud AI fails, classical OpenCV Canny edge detection (Raw Mode) guarantees the screen is never blank: *"The creature's eyes are blurry, you can still feel the outlines."* Sighted teachers can use Teacher Correct mode to fine-tune geometry.

### Post 3/4 (Spec-Driven Rigor & Multi-Agent Attribution)
#KiroweenHackathon26 3/4: Architecture & transparent tools disclosure:
• Kiro: formal EARS requirements, locked haptic steering, 5 agent hooks, and property tests (P1–P13)  
• Kiro diagnosed and resolved the P1 subnormal float flake with a deterministic tie-rule fix  
• Antigravity (agy): built the full Frankenstein Lab redesign, Teacher Correct mode (P16/P17), and offline storage (P14/P15)  
• Claude Code: supervised architecture, lane reviews, and integration  

### Post 4/4 (Open Source & Next Steps)
#KiroweenHackathon26 4/4: Radical transparency: 1049 frontend tests and 348 backend tests pass cleanly. What remains untested is physical phone motor calibration and trials with blind students at the Blind People's Association (BPA) in Ahmedabad.

Watch the full walkthrough: [FILL: video URL]  
Try the app or inspect the code: [FILL: repo or live URL]  
