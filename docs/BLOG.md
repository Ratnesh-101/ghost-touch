# Ghost Touch: Feeling STEM Diagrams You Cannot See

Diagrams lock blind students out of STEM education. In geometry, algebra, and physics, the
diagram is where the lesson happens: the right triangle, the wave curve, the comparative bar chart.
For a blind student, that diagram is usually a blank spot on the page. Raised-line tactile
graphics on swell paper require specialist equipment, cost thousands of pounds over a school
year, and often arrive weeks after the class has moved on. Modern refreshable tactile tablets
exist, but at upwards of £6,500, they remain out of reach for almost every classroom. Standard
AI image captioning outputs a paragraph of prose, but a paragraph cannot tell your fingers
where a hypotenuse meets a base.

Yet nearly every student already carries an ordinary Android phone. That phone contains a
vibration motor, a loudspeaker, and a touchscreen.

We built Ghost Touch by stitching these spare parts into a single assistive creature: an
inexpensive phone notification buzzer for tactile nerves, vision AI for eyes, and a browser
Web Audio synthesizer for voice.

When a teacher snaps a photo of a textbook page, our vision pipeline extracts a clean
mathematical scene: vertices, segments, curves, and bars, with coordinates normalized to the
screen. If the cloud AI model times out or encounters a poorly lit photograph, Ghost Touch never
leaves the student with nothing: our classical computer vision fallback—Raw Mode, powered by
OpenCV edge detection—extracts physical outlines directly on the backend.

On the phone screen, the diagram becomes a tactile terrain. Dragging a finger along a line
produces continuous vibration. At a corner, the phone gives a distinct double pulse and speaks
the corner's label, for example "C". Tracing a mathematical curve plays a continuous tone
whose pitch rises and falls with graph height (from 200 Hz to 1000 Hz). On bar charts, touching
a bar plays a height tone and announces its value. Students can ask questions aloud ("How long
is AC?") and receive concise answers drawn strictly from diagram facts. On a laptop or iPhone
without a vibration motor, the app plays an audible buzz and displays a pulse ring instead:
*"No vibration on this device. You will hear a buzz instead. Use Chrome on Android to feel it."*

Building assistive software demands rigorous engineering. We paired three tools: Kiro for
formal EARS requirements, steering guardrails, agent hooks, and foundational pure core modules
(properties P1–P13); Antigravity for the Frankenstein Lab interface, screens, drivers, and
hardening; and Claude Code for supervision and review.

The power of spec-driven engineering showed up clearly during hardware testing. When the
repository owner tested the installed app on a Samsung Galaxy S24+, they found a critical layout
bug: after the first touch hold, the Explore canvas kept expanding in height for several
seconds, pushing navigation buttons off the screen. Rather than applying a quick hack, Kiro
resolved it spec-first under Requirement 25 (Task 42): defining formal invariants first,
adding an automated Playwright regression suite (`frontend/e2e`), and fixing the underlying CSS
layout feedback loop. The owner confirmed on the Samsung Galaxy S24+ that the fix worked.

We believe in radical honesty about what is proven and what is not. Ghost Touch passes
2,231 frontend tests across 181 files and 834 backend tests, verifying
83 numbered correctness properties with fast-check and Hypothesis. The haptic timings were tuned
on a OnePlus Nord CE6, the TalkBack double-tap-and-hold gesture worked on our prototype there,
and the canvas growth bug fix was confirmed on the Galaxy S24+. Nothing else has been verified
on hardware by the owner. Full-app testing of other phone steps is pending. No blind student
has tested it yet; accuracy on real textbook photos has not been benchmarked; and Hindi and
Gujarati text is machine-translated and awaits native-speaker review. Guide and Share ship in
the app but stay off until enabled in Settings, and neither has been tested on a phone.

Ghost Touch is open source, built for Kiroween 2026. #KiroweenHackathon26
