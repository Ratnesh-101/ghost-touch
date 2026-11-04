# Ghost Touch: Feeling STEM Diagrams You Cannot See

Diagrams lock blind students out of STEM. In geometry, algebra, and physics, the diagram is where the lesson happens: the right-angle triangle, the parabolic trajectory, the comparative bar chart. For a blind student, that diagram is usually a blank spot on the page. Traditional tactile graphics on swell paper take specialist equipment, cost thousands of pounds over a school year, and often arrive weeks after the class has moved on. Modern refreshable tactile tablets exist, but at upwards of £6,500, they remain out of reach for almost every classroom. Meanwhile, standard AI image captioning reduces a geometric diagram to a flat paragraph of descriptive prose. A paragraph cannot tell your fingers where a hypotenuse meets the base.

Almost every student already has an Android phone in their pocket. That phone contains a vibration motor, a loudspeaker, and a touchscreen.

We built Ghost Touch by stitching three disparate parts into a single assistive creature: an inexpensive phone notification buzzer for tactile nerves, a vision-language model for eyes, and a browser Web Audio theremin synthesizer for a voice.

When a teacher snaps a photo of a textbook page, uploads an image, or drops in a PDF worksheet, our vision pipeline extracts a clean mathematical scene: vertices, segments, curves, and bars, with all coordinates normalized. If the cloud AI model times out or stumbles on a poorly lit photograph, Ghost Touch never leaves the student with nothing. Our classical computer vision fallback—Raw Mode, powered by OpenCV Canny edge detection—immediately extracts the physical outlines directly on the backend.

On the phone screen, the diagram becomes a tactile terrain. Dragging a finger along a line produces a crisp, continuous vibration. Hitting a corner triggers a distinct, hand-tuned "bzzzz-tap" pulse and speaks the vertex label aloud. Tracing a mathematical function curve plays a continuous theremin tone whose pitch rises and falls with graph height (from 200 Hz to 1000 Hz). On bar charts, tapping a bar sounds a value-proportional tone and announces its quantity. Sighted teachers can also use Teacher Correct mode to tweak detected points or edit labels on the fly. Students can ask spoken questions ("How long is AC?") and receive concise answers drawn strictly from verified facts.

Crucially, Ghost Touch works seamlessly with Android's TalkBack screen reader. Rather than fighting TalkBack's touch interception, we implemented a double-tap-and-hold pass-through gesture with a haptic centre reference tick, allowing non-visual navigation using standard accessibility habits.

To build this reliably, we relied heavily on Kiro and spec-driven development. Kiro authored our formal EARS requirements, system architecture, and steering guardrails. Physical haptic timings—tuned on real hardware to prevent motor overheating or sensory blur—were locked in steering files. Kiro also introduced automated agent hooks that kept our TypeScript and Pydantic schemas in continuous sync, ran property tests upon saving core files, and enforced architectural reviews.

Kiro's property-based testing strategy proved invaluable. Using fast-check and Hypothesis, we tested invariants across thousands of randomized inputs. This caught subtle edge cases before any student touched the screen. In property P1 ("every point is reachable"), fast-check exposed a 20% flake where two points differing by 1e-45 collapsed onto the same screen pixel under letterboxed projection. Kiro diagnosed the issue as an over-claiming generator assumption and fixed it by requiring a 22-pixel screen separation and adding a deterministic tie-rule regression test.

We believe in radical honesty about what is real. Ghost Touch passes 418 frontend tests and 346 backend tests, but two critical things remain untested: testing across diverse ultra-budget smartphone vibration motors, and in-person trials with blind students at the Blind People's Association (BPA) in Ahmedabad. Those sessions are scheduled next.

Built for Kiroween 2026. #KiroweenHackathon26
