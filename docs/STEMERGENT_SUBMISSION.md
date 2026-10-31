# STEMergent submission (draft for the owner to edit)

Drafted by Claude Code on 2026-11-01 from the repository, `docs/WIN_PLAN.md` and the research notes. **Everything marked `[FILL]` is information only the owner has, or a result that does not exist yet. Do not submit with a `[FILL]` left in, and do not replace one with a guess.** Submit on **Nov 14** (hard stop Nov 16, 09:00 IST).

## Checklist (WIN_PLAN §5)
- [ ] Pathway: **Hackathon**
- [ ] Description below, edited into your own words
- [ ] AI disclosure (section 6) kept as is, or made more specific
- [ ] Screenshots or GIFs, demo video (under 3 min), repo link, live URL `[FILL]`
- [ ] Team details, at most 4 people `[FILL]`

## 1. Title and one line
**Ghost Touch: feel diagrams you cannot see.**
Take a photo, screenshot or PDF page of a school diagram, and a blind or low-vision student can explore it by touch on an ordinary Android phone: the phone buzzes on lines and at corners, speaks the labels, plays a rising tone along a graph, and answers spoken questions about the picture.

## 2. The problem
Diagrams are how much of STEM is taught: triangles in geometry, graphs in algebra, bar charts in data handling. For a blind or low-vision student, a diagram is a gap in the page. Tactile (raised-line) graphics fix this, but they are slow and costly to produce, so most diagrams never reach the student on the day they are taught. Refreshable tactile displays exist but cost thousands of pounds. Image-description apps turn a picture into a paragraph, but a paragraph is not the same as feeling a shape.
Most students already own an Android phone, and phones have a vibration motor, speakers, a touchscreen and a microphone.

## 3. Who it helps
Blind and low-vision school students, and the teachers and parents who prepare material for them. The target device is a budget Android phone with Chrome; students who rely on TalkBack are a first-class case, not an afterthought (see "Works with TalkBack").
`[FILL: one sentence about the school session, only if it takes place. Do not write numbers or quotes before they exist.]`

## 4. The STEM connection
The app is built for the diagrams STEM actually uses: **geometry** (labelled points, edges, right angles, lengths), **function graphs** (a curve whose height you hear as pitch), and **bar charts** (compare bar heights and read their values). The student can also ask questions such as "How long is AB?" and gets an answer drawn only from what the diagram says.

## 5. How it works
1. **See.** A vision model reads the photo and returns a structured description: points, segments, curves, bars, labels and facts, with all coordinates normalised. The prompt asks for the words a teacher would use ("hypotenuse", "vertex B") and rejects labels that only describe appearance ("blue polygon"). Every answer from the model is checked against a strict schema and retried once; if that fails, a classical edge-detection fallback (**Raw Mode**) still gives the student the outlines, so the app never leaves them with nothing.
2. **Feel.** As the student drags a finger, the phone vibrates continuously along lines, plays a distinct "bzzzz-tap" pattern at corners and says the label, and plays a rising and falling tone along a graph (like a theremin). These patterns were tuned by hand on a real phone.
3. **Ask.** The student asks a question aloud and hears a short answer; there is a text box if speech recognition is unavailable.
4. **Works with TalkBack.** TalkBack normally takes over one-finger touch. We tested a pass-through gesture on a real phone (double-tap, hold, then drag) and it delivers the touches and the vibration. The Explore screen announces this gesture, always starts the cursor at the centre, plays a short centre cue on each new hold, and can be left with the Android Back gesture or a labelled button.
5. **Inputs.** Camera photo, a chosen image or screenshot, or the first page of a PDF; three sample diagrams work with no camera and no network.

The core decision logic is a pure state machine (no browser code), so it can be property-tested; browser APIs live in thin drivers.

## 6. AI tools used (disclosure)
- **Google Gemini**: the vision model that reads the diagram, and the model that answers questions. (A second provider, NVIDIA, is wired as a fallback.)
- **Kiro**: spec-driven development: requirements, design and tasks; steering documents holding the tuned haptic values and architecture rules; hooks; and property-based tests for the core (geometry, hit testing). Kiro was also used to review builds. `[FILL: be specific about what Kiro built before its credits ran out and what it will build next.]`
- **Antigravity (agy)**: a coding agent used to build parts of the app from written briefs (backend scene pipeline, Explore screen, PDF input).
- **Claude Code**: planning, briefs, independent code reviews, research notes and documentation, and it built the first two frontend tasks (drivers, Start and Capture screens) when the builder agent could not run unattended.
Each tool's work is logged in `docs/BUILD_LOG.md`. Reviews are in `docs/reviews/`.

## 7. What is real today, honestly
| Done and tested in code | Not done or not yet verified |
|---|---|
| Schema, geometry and hit-testing core with property tests; haptic drivers; Start, Capture (photo, image, PDF) and Explore screens; scene pipeline with provider fallback and Raw Mode; automated tests (frontend and backend) | The full haptic engine and its property tests (Kiro's task; a temporary stand-in is used); teacher correction; Hindi and Gujarati; offline saved diagrams |
| Vision accuracy measured on **synthetic** diagrams: geometry strong, graphs weaker (`docs/research/vision-spike.md`) | Accuracy on **real textbook photos** (pending); response time of the real model (it was far slower than our 15 s budget in the first test) |
| TalkBack pass-through gesture works on one real phone (the owner's) | Testing with blind students `[FILL if it happens]`; a budget phone; the live deployed URL `[FILL]` |

## 8. What is next
Test with students at a school for the blind and fix what confuses them first; finish the haptic engine with property tests; teacher correction of the AI's mistakes; Hindi and Gujarati; saved diagrams for offline use; an optional native app if the web gesture proves too limiting.

## 9. Links
Repo `[FILL]` · Live app `[FILL]` · Demo video `[FILL]` · Testing instructions (with and without TalkBack) in `docs/DEPLOY.md` `[after the deploy job]`.
