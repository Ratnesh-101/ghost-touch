# Social Media Posts: Ghost Touch

> **Note for the Repository Owner:**  
> The Kiroween social prize evaluates your authentic personal experience building with Kiro.  
> Replace the `[OWNER: say in your own words ...]` slots below with your own perspective on
> one Kiro capability (e.g., spec-driven architecture, agent hooks, or property tests catching
> real bugs like the S24+ canvas layout feedback loop).

---

## 1. Short Post (X / Twitter / Bluesky)

#KiroweenHackathon26 — Ghost Touch turns STEM diagrams into tactile graphics that blind
students explore on an ordinary Android phone.

We stitched three phone parts into an assistive creature:
🔊 Buzzer for tactile nerves (continuous vibration on lines, double pulse at corners)
👁️ Vision AI for eyes (reads textbook photos, falls back to OpenCV Raw Mode)
🎵 Synthesizer for voice (height becomes pitch on curves, spoken answers to diagram questions)

[OWNER: say in your own words how one Kiro feature—such as formal EARS specs, steering rules, or
property tests—shaped how you built this.]

The TalkBack double-tap-and-hold gesture worked on our prototype on a OnePlus Nord CE6, and the
S24+ canvas layout bug was fixed spec-first by Kiro and verified on phone. Other phone steps are
pending. [RECOUNT] frontend tests and [RECOUNT] backend tests pass cleanly.

Demo video: [FILL: video URL]  
Live app: https://ghost-touch-iota.vercel.app  
Repo: https://github.com/Ratnesh-101/ghost-touch  

---

## 2. Medium Post (LinkedIn / Community Forums)

#KiroweenHackathon26 — How do you teach geometry or physics to a student who cannot see the
blackboard?

Raised-line tactile graphics take weeks to produce. Refreshable tactile tablets cost upwards of
£6,500. Yet nearly every student carries an Android phone with a vibration motor, a camera, and
a speaker.

Ghost Touch stitches these spare parts into an assistive creature:
- **Nerves:** Continuous vibration along lines; double pulse and spoken corner label at vertices.
- **Eyes:** Cloud vision parses textbook diagrams into normalized geometry, with OpenCV Raw
  Mode as a resilient fallback.
- **Voice:** Continuous Web Audio pitch rises and falls with mathematical curves, while spoken
  Q&A answers questions from diagram facts.
- **Universal access:** Designed for Android TalkBack (double-tap-and-hold gesture worked on our
  prototype on a OnePlus Nord CE6). On laptops or iPhones without vibration, it plays an audible
  buzz and pulse ring.

[OWNER: say in your own words what stood out most about using Kiro—e.g., how writing formal
requirements and property tests before code caught edge cases like the Galaxy S24+ canvas growth
bug, or how agent hooks automated your workflow.]

Radical transparency: [RECOUNT] frontend tests across [RECOUNT] files and [RECOUNT] backend tests
pass cleanly. Haptic timings were tuned on a OnePlus Nord CE6, the TalkBack gesture worked on
our prototype there, and the Galaxy S24+ canvas bug fix was confirmed on hardware; full-app
phone testing of other steps is pending. No blind student has tested it yet, and Hindi and
Gujarati text is machine-translated awaiting native review.

Watch the 3-minute demo: [FILL: video URL]  
Live demo: https://ghost-touch-iota.vercel.app  
Source code: https://github.com/Ratnesh-101/ghost-touch  

---

## 3. Four-Post Thread (X / Mastodon / Bluesky)

### Post 1/4 (The Problem & The Creature)
#KiroweenHackathon26 1/4: Diagrams lock blind students out of STEM education. Tactile graphics
take weeks to produce and tactile tablets cost £6,500+.

We built Ghost Touch on an ordinary Android phone by stitching three spare parts into an
assistive creature:
• Buzzer = tactile nerves  
• Vision AI = eyes  
• Theremin = voice  

Demo video: [FILL: video URL]  
Live app: https://ghost-touch-iota.vercel.app  

### Post 2/4 (How It Feels)
#KiroweenHackathon26 2/4: How does Ghost Touch feel on the screen?
• Tracing a line → continuous motor vibration  
• Hitting a corner → double pulse and spoken corner label (e.g. "C")  
• Tracing a curve → tone rises and falls with graph height (200–1000 Hz)  
• Screen reader → TalkBack double-tap-and-hold pass-through gesture (passed on prototype on
  OnePlus Nord CE6)  
• Safety net → If cloud AI drops, OpenCV Raw Mode extracts outlines so the screen is never blank.

### Post 3/4 (Building with Kiro — Owner's Perspective)
#KiroweenHackathon26 3/4: [OWNER: say in your own words what Kiro did best for this project. Focus
on one specific feature—for example, how Kiro's spec-first approach caught and resolved the
Samsung Galaxy S24+ canvas layout bug (Requirement 25), or how Kiro's property-based testing and
agent hooks kept the pure core rock solid.]

### Post 4/4 (Open Source & Honest Next Steps)
#KiroweenHackathon26 4/4: Honest engineering: [RECOUNT] frontend tests and [RECOUNT] backend tests
verify mathematical invariants. Haptics were tuned on a OnePlus Nord CE6, the TalkBack gesture
passed on the prototype there, and the S24+ canvas bug fix was confirmed on device. Full-app
testing of other phone steps is pending.

Next step: first testing sessions with blind students at the Blind People's Association in
Ahmedabad.

Inspect the code: https://github.com/Ratnesh-101/ghost-touch
