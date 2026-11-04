# Social Media Posts: Ghost Touch

Draft posts for Kiroween 2026. Every draft begins with `#KiroweenHackathon26` and contains the required placeholder markers.

---

## 1. Short Post (X / Twitter / Bluesky)

#KiroweenHackathon26 — Ghost Touch lets blind students explore STEM diagrams by touch on ordinary Android phones.

We stitched 3 parts into an assistive creature:
🔊 Phone buzzer for tactile nerves (vibrates on lines/corners)
👁️ Vision AI for eyes (reads textbook photos & PDFs)
🎵 Theremin synthesizer for voice (height = pitch on graphs)

Works with TalkBack. 418 frontend + 346 backend tests, 17 mathematical invariants verified with fast-check & Hypothesis. Built with Kiro spec-driven development.

Demo video: [FILL: video URL]  
Repo & live demo: [FILL: repo or live URL]  

---

## 2. Medium Post (LinkedIn / Community Forums)

#KiroweenHackathon26 — How do you teach geometry or algebra to a student who cannot see the blackboard?

Diagrams lock blind students out of STEM. Raised-line tactile graphics cost thousands of pounds and take weeks to print. Refreshable tactile displays cost upwards of £6,500. Standard AI captioning outputs a paragraph of prose, but a paragraph cannot tell your fingers where a hypotenuse meets a curve.

We built Ghost Touch: a web app for budget Android phones that turns visual diagrams into interactive tactile-audio experiences:
- **Haptic Nerves:** An ordinary notification buzzer delivers continuous vibration along line segments and crisp "bzzzz-tap" pulses at vertices.
- **Theremin Audio:** Continuous Web Audio sine synthesis translates curve height into musical pitch (200 Hz to 1000 Hz).
- **TalkBack Pass-Through:** A double-tap-and-hold relative cursor gesture designed specifically for blind users.
- **Raw Mode Fallback:** If cloud vision models time out, classical OpenCV Canny edge extraction ensures students are never left with an empty screen.
- **Teacher Correct Mode:** Sighted teachers can adjust detected vertices and edit labels on the fly.

Ghost Touch was built with Kiro using spec-driven development (EARS requirements, locked haptic steering, agent hooks) and property-based testing (fast-check & Hypothesis).

Next step: in-person sessions with blind students at the Blind People's Association (BPA) in Ahmedabad.

Watch the 3-minute demo: [FILL: video URL]  
Explore the codebase: [FILL: repo or live URL]  

---

## 3. Four-Post Thread (X / Mastodon / Bluesky)

### Post 1/4 (The Problem & The Stitch)
#KiroweenHackathon26 1/4: Diagrams lock blind students out of STEM. Tactile graphics take weeks to produce and tactile tablets cost £6,500+.

We stitched three common technologies into one assistive creature on standard Android smartphones:
• Buzzer = tactile nerves  
• Vision AI = eyes  
• Theremin = voice  

Demo video: [FILL: video URL]  
Repo: [FILL: repo or live URL]  

### Post 2/4 (How It Feels & TalkBack)
#KiroweenHackathon26 2/4: How does Ghost Touch work?
• Finger on a line → continuous motor buzz  
• Finger at a corner → crisp "bzzzz-tap" pulse + spoken vertex label  
• Curve on a graph → rising/falling theremin pitch (200–1000 Hz)  
• Double-tap-and-hold pass-through gesture works directly with Android TalkBack!  

If cloud AI fails, classical OpenCV Canny edge detection (Raw Mode) guarantees the screen is never blank. Sighted teachers can use Teacher Correct mode to fine-tune detected geometry.

### Post 3/4 (Spec-Driven Engineering with Kiro)
#KiroweenHackathon26 3/4: Architecture & technological rigor with Kiro:
• Formal EARS requirements & locked haptic timings in steering documents  
• 5 automated agent hooks for schema codegen, property runs, and stop reviews  
• 17 mathematical correctness properties (P1–P17) tested with fast-check & Hypothesis  
• When property P1 flaked on subnormal floats (1e-45), Kiro diagnosed the test-generator assumption and codified a deterministic tie-rule fix.

### Post 4/4 (Open Source & Next Steps)
#KiroweenHackathon26 4/4: Radical transparency: 418 frontend tests and 346 backend tests pass cleanly. What remains untested is trials with real blind students and multi-phone motor calibration; testing at the Blind People's Association (BPA) in Ahmedabad is scheduled next.

Watch the full walkthrough: [FILL: video URL]  
Try the app or inspect the code: [FILL: repo or live URL]  
