# Social Media Posts: Ghost Touch

Draft posts for Kiroween 2026. Every draft begins with `#KiroweenHackathon26` and contains the required placeholder markers.

---

## 1. Short Post (X / Twitter / Bluesky)

#KiroweenHackathon26 — Ghost Touch lets blind students explore STEM diagrams by touch on ordinary Android phones.

We stitched 3 phone parts into an assistive creature in our Frankenstein's Lab redesign:
🔊 Phone buzzer for tactile nerves (continuous vibration on lines, "bzzzz-tap" at corners)
👁️ Vision AI for eyes (reads textbook photos, PDFs & falls back to classical Raw Mode)
🎵 Theremin synthesizer for voice (height = pitch on curves, tones on bar charts)

Supports Android TalkBack pass-through gesture (unverified on hardware). [RECOUNT] frontend + [RECOUNT] backend tests, [RECOUNT] mathematical properties verified with fast-check & Hypothesis. Spec-driven engineering by Kiro (pure core, P1–P13, Round 2 P40–P46, Round 3/4 P51–P57, P62–P65, P66–P78); Lab redesign, Spec Ghost, Ghostwriter UI & hardening by Antigravity (agy, P14–P30, P47–P50, P58–P61, lanes m1–m3, n1–n2, p1–p3, p5, q1); supervised and gated by Claude Code.

Demo video: [FILL: video URL]  
Repo & live demo: https://github.com/Ratnesh-101/ghost-touch | https://ghost-touch-iota.vercel.app  

---

## 2. Medium Post (LinkedIn / Community Forums)

#KiroweenHackathon26 — How do you teach geometry or algebra to a student who cannot see the blackboard?

Diagrams lock blind students out of STEM. Raised-line tactile graphics cost thousands of pounds and take weeks to print. Refreshable tactile displays cost upwards of £6,500. Standard AI captioning outputs a paragraph of prose, but a paragraph cannot tell your fingers where a hypotenuse meets a curve.

We built Ghost Touch: a web app for budget Android phones that turns visual diagrams into interactive tactile-audio experiences. In our Frankenstein's Laboratory redesign, the app comes alive as an assistive creature stitched from spare phone parts:
- **Haptic Nerves:** An ordinary notification buzzer delivers continuous vibration along lines and crisp "bzzzz-tap" double pulses at vertices with a 450 ms quiet period.
- **Theremin Voice:** Continuous Web Audio sine synthesis translates mathematical curve height into musical pitch (200 Hz to 1000 Hz) and sonifies bar charts.
- **TalkBack Pass-Through:** A double-tap-and-hold relative cursor gesture designed for blind users, starting at diagram centre (unverified on physical hardware).
- **Lab Settings Sheet:** One accessible button switches speech rate and languages between English, Hindi, and Gujarati (machine-translated; community review underway).
- **Raw Mode Safety Net:** If cloud vision models time out or provider keys fail, classical OpenCV Canny edge extraction ensures students are never left with an empty screen: *"The creature's eyes are blurry, you can still feel the outlines."*
- **Teacher Correct Mode:** Sighted teachers can adjust detected vertices over a photo underlay and validate scenes in seconds.
- **Ghostwriter in Teach Mode:** Sighted teachers can add points and join edges at `#/teach` with accessible controls (min 48×48 px targets, spoken confirmation, and undo).
- **Offline Specimen Cards:** Right triangle, Sine wave, and Bar chart specimen cards run 100% locally with zero network requests.

Ghost Touch was built through honest multi-agent pairing: formal EARS requirements, steering, 5 hooks, pure core, P1–P13, and Round 2 spec (Req 16–17, tasks 23–28, properties P40–P46) authored by Kiro (plus Round 3/4 Spec Ghost review, CORE-09/NEEDS-KIRO-02 fix P51, hit-test P52–P53, Ghostwriter core P54–P57, localized angle naming Task 35, delete kinds P62–P65, and audit property oracles P66–P78); full Frankenstein Lab redesign, Spec Ghost build (P47–P50), Teacher Correct mode (P16/P17), offline storage (P14/P15), Ghostwriter UI (lane g1, P58–P61), and hardening lanes (m1–m3, n1–n2, p1–p3, p5, q1) built by Antigravity (agy); overall supervision, Round 2 gating, and backend properties P40–P46 by Claude Code.

Next step: in-person usability testing with blind students at the Blind People's Association (BPA) in Ahmedabad (session pending; physical phone motor validation pending). Haptic values were tuned by hand on the owner's OnePlus Nord CE6 in the prototype; full-app phone testing is pending. Security audits ongoing: Round 2 items CORE-09 and NEEDS-KIRO-02 resolved in Round 3; Round-5 audit fixes resolved backend permits and MIME, IndexedDB atomic eviction, and share sanitization (P66–P78 test oracles tracking open items). Guide and Share stay flagged OFF and unverified on hardware; link content is "Shared by <name>, not checked". Data privacy details in docs/PRIVACY.md.

Watch the 3-minute demo: [FILL: video URL]  
Explore the codebase: https://github.com/Ratnesh-101/ghost-touch  

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
Repo: https://github.com/Ratnesh-101/ghost-touch  

### Post 2/4 (How It Feels & TalkBack)
#KiroweenHackathon26 2/4: How does Ghost Touch work?
• Finger on a line → continuous motor buzz  
• Finger at a corner → crisp "bzzzz-tap" double pulse + spoken vertex label  
• Curve on a graph → rising/falling theremin pitch (200–1000 Hz)  
• Double-tap-and-hold pass-through gesture designed for Android TalkBack (unverified on hardware)!  

If cloud AI fails, classical OpenCV Canny edge detection (Raw Mode) guarantees the screen is never blank: *"The creature's eyes are blurry, you can still feel the outlines."* Sighted teachers can use Teacher Correct mode to fine-tune geometry.

### Post 3/4 (Spec-Driven Rigor & Multi-Agent Attribution)
#KiroweenHackathon26 3/4: Architecture & transparent tools disclosure:
• Kiro: formal EARS requirements, locked haptic steering, 5 hooks, pure core, PBT (P1–P13), Round 2 spec (P40–P46), Round 3/4 (CORE-09/P51–P53, Ghostwriter core P54–P57, P62–P65, P66–P78)  
• Kiro diagnosed and resolved the P1 subnormal float flake with a deterministic tie-rule fix  
• Antigravity (agy): built Lab redesign, Spec Ghost (P47–P50), Teacher Correct (P16/P17), offline storage (P14/P15), Ghostwriter UI (P58–P61), drivers & hardening lanes (m1–m3, n1–n2, p1–p3, p5, q1)  
• Claude Code: supervised architecture, gated Round 2 T25/T26, wrote backend properties P40–P46, evidence  

### Post 4/4 (Open Source & Next Steps)
#KiroweenHackathon26 4/4: Radical transparency: [RECOUNT] frontend tests and [RECOUNT] backend tests pass cleanly across [RECOUNT] properties. Haptic values were tuned by hand on the owner's OnePlus Nord CE6 in the prototype; full-app phone testing is pending. What remains unverified on hardware is physical motor calibration, Guide/Share (flagged OFF; link content "Shared by <name>, not checked"), and trials with blind students at BPA Ahmedabad. Security audits ongoing: Round 2 items CORE-09 and NEEDS-KIRO-02 resolved in Round 3; Round-5 audit fixes resolved backend permits and MIME, IndexedDB atomic eviction, and share sanitization (P66–P78 test oracles tracking open items).

Watch the full walkthrough: [FILL: video URL]  
Try the app or inspect the code: https://ghost-touch-iota.vercel.app  
