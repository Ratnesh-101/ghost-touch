# STEMergent submission (draft for the owner to edit)

Drafted by Claude Code on 2026-11-01 from the repository, `docs/WIN_PLAN.md` and updated by Antigravity on 2026-11-03 to reflect verifiable facts from the codebase. **Everything marked `[FILL]` is information only the owner has, or a result that does not exist yet. Do not submit with a `[FILL]` left in, and do not replace one with a guess.** Submit on **Nov 14** (hard stop Nov 16, 09:00 IST).

## Checklist (WIN_PLAN §5)
- [ ] Pathway: **Hackathon**
- [ ] Description below, edited into your own words
- [ ] AI disclosure (section 6) kept as is, or made more specific
- [ ] Screenshots or GIFs, demo video (under 3 min), repo link, live URL `[FILL: owner to provide media and deployment links]`
- [ ] Team details, at most 4 people `[FILL: owner to provide team member names, roles, and student details]`

## 1. Title and one line
**Ghost Touch: feel diagrams you cannot see.**
Take a photo, screenshot or PDF page of a school diagram, and a blind or low-vision student can explore it by touch on an ordinary Android phone: the phone buzzes on lines and at corners, speaks the labels, plays a rising tone along a graph, and answers spoken questions about the picture.

## 2. The problem
Diagrams are how much of STEM is taught: triangles in geometry, graphs in algebra, bar charts in data handling. For a blind or low-vision student, a diagram is a gap in the page. Tactile (raised-line) graphics fix this, but they are slow and costly to produce, so most diagrams never reach the student on the day they are taught. Refreshable tactile displays exist but cost thousands of pounds (e.g. Dot Pad at ~£6,500+). Image-description apps turn a picture into a paragraph, but a paragraph is not the same as feeling a shape.
Most students already own an Android phone, and phones have a vibration motor, speakers, a touchscreen and a microphone.

## 3. Who it helps
Blind and low-vision school students, and the teachers and parents who prepare material for them. The target device is a budget Android phone with Chrome; students who rely on TalkBack are a first-class case, not an afterthought (see "Works with TalkBack").
`[FILL: one sentence about the school session at BPA Ahmedabad, only if it takes place. Do not write numbers or quotes before they exist.]`

## 4. The STEM connection
The app is built for the diagrams STEM actually uses: **geometry** (labelled points, edges, right angles, lengths), **function graphs** (a curve whose height you hear as pitch), and **bar charts** (compare bar heights and read their values). The student can also ask questions such as "How long is AB?" and gets an answer drawn only from what the diagram says.

## 5. How it works
1. **See.** A vision model reads the photo and returns a structured description: points, segments, curves, bars, labels and facts, with all coordinates normalised in [0, 1]. The prompt asks for the words a teacher would use ("hypotenuse", "vertex B") and rejects labels that only describe appearance ("blue polygon"). Every answer from the model is checked against a strict schema and retried once; if that fails, a classical edge-detection fallback (**Raw Mode**) still gives the student the outlines, so the app never leaves them with nothing.
2. **Feel.** As the student drags a finger, the phone vibrates continuously along lines, plays a distinct "bzzzz-tap" pattern at corners and says the label, and plays a rising and falling tone along a graph (like a theremin). These patterns were tuned by hand on a real phone.
3. **Ask.** The student asks a question aloud and hears a short answer; there is a text box if speech recognition is unavailable. If no AI quota or provider is reachable, a deterministic facts lookup fallback still answers questions directly from detected measurements.
4. **Works with TalkBack.** TalkBack normally takes over one-finger touch. We tested a pass-through gesture on a real phone (double-tap, hold on the second tap, then drag) and it delivers the touches and the vibration. The Explore screen announces this gesture, always starts the cursor at the centre, plays a short centre reference tick on each new hold, and can be left with the Android Back gesture or a labelled button.
5. **Inputs.** Camera photo, a chosen image or screenshot, or the first page of a PDF (rendered client-side via lazy-loaded PDF.js); three sample diagrams work with no camera and no network.

The core decision logic is a pure state machine (no browser code), so it is thoroughly property-tested; browser APIs live in thin drivers.

## 6. AI tools used (disclosure)
- **Vision & Q&A Models**: **Google Gemini** (`gemini-3.8-flash` / `gemini-3.5-flash-lite`) is the primary model for diagram extraction and spoken Q&A. **OpenAI** (`gpt-4.1-mini`) and **Nebius** are configured as fallback providers in the pipeline, with classical OpenCV edge detection (**Raw Mode**) serving as the deterministic floor.
- **Kiro**: Spec-driven development: requirements, design, and implementation tasks (`.kiro/specs/ghost-touch/`); steering documents holding tuned haptic values (`tech.md`) and non-visual product principles (`product.md`); automated hooks (`.kiro/hooks/`) for schema-to-TypeScript synchronization and builder code reviews; pure core modules (`geometry.ts`, `hitTest.ts`, `hapticEngine.ts`, `pitch.ts`); sample diagram fixtures; backend validator (`validate.py`); and property-based tests (P1–P8, P9, P11, P13). When credits return, Kiro is slated to build Teacher Correct mode (Task 11), Hindi/Gujarati localization (Task 12), and offline diagram storage (Task 13).
- **Antigravity (agy)**: Autonomous coding agent used to build features from written briefs: PDF first-page rendering with dynamic chunking (`pdfjs-dist`), Explore screen with relative cursor and centre tick, backend scene pipeline with provider fallback and OpenCV Canny segmentation, frontend and backend Ask Q&A flow, deployment configurations (Render, Vercel), CSS token design system and accessible creature theme polish, and completion of property tests P10 and P12.
- **Claude Code**: Master planning (`docs/WIN_PLAN.md`), briefs, independent architectural code reviews (`docs/reviews/`), research spikes (vision spike, TalkBack spike), agy permission-safe launcher scripts (`scripts/agy-run.sh`, `scripts/agy-settings.json`), dev environment recovery (`scripts/setup-dev.ps1`), and builder stand-in for browser drivers and Start/Capture screens.
Each tool's work is logged in `docs/BUILD_LOG.md`. Reviews are in `docs/reviews/`.

## 7. What is real today, honestly
| Done and tested in code | Not done or not yet verified |
|---|---|
| **Full Pure Core & Haptic Engine:** Complete and passing all property tests: letterboxed coordinate mapping, hit-testing with bar-edge hits, state machine sequencing, theremin pitch mapping. | **Teacher Correction Mode:** Interactive canvas overlay for sighted teachers to adjust AI points and edit labels (Task 11). |
| **All 13 Correctness Properties:** P1–P13 implemented and passing using fast-check (frontend) and Hypothesis (backend). | **Localization:** Hindi and Gujarati interface strings, speech synthesis, and voice recognition (Task 12). |
| **Complete Screen Flow:** Accessible Start screen, Capture screen (camera photo, file chooser, PDF first-page rendering up to 1600 px), Explore screen (relative cursor, glowing creature theme, centre reference tick, axis crossing announcements, 48px+ touch targets), and Ask screen (voice input + text fallback). | **Offline Diagram Storage:** Saving captured diagrams to client-side IndexedDB for offline review (Task 13). |
| **Robust Multi-Provider Backend:** Pipeline with Google Gemini primary, OpenAI and Nebius fallbacks, OpenCV Canny edge detection (Raw Mode floor), ASGI rate limiting and payload validation, and facts lookup fallback for Q&A. | **Real Textbook Accuracy:** Accuracy measured on real textbook photos under varied classroom lighting (synthetic benchmarks complete in `docs/research/vision-spike.md`). |
| **Automated Verification:** 249 frontend tests passing across 25 files; 337 backend tests passing; `tsc --noEmit`, `ruff check`, and `ruff format --check` all clean. | **Field Testing:** Testing with blind students at BPA Ahmedabad `[FILL: school session observation and quotes pending live session]`; testing on a wide range of budget hardware. |
| **TalkBack Compatibility:** Pass-through gesture (double-tap-and-hold then drag) verified working on hardware (OnePlus Nord CE6). | **Live Deployment:** Production deployment `[FILL: owner to provide deployed URLs after running deploy pipeline]`. |

## 8. What is next
Test with students at the Blind People's Association (BPA) in Ahmedabad and fix whatever confuses them first; implement teacher correction mode so teachers can quickly fix any AI diagram mistakes in under a minute; add Hindi and Gujarati speech; enable offline saved diagrams; and evaluate an optional Capacitor native app wrapper if budget device motors benefit from native amplitude controls.

## 9. Links
- **Repository:** `[FILL: GitHub repository URL]`
- **Live App:** `[FILL: Vercel deployment URL]`
- **Demo Video:** `[FILL: YouTube demo video URL (under 3 minutes)]`
- **Testing Instructions:** Complete testing instructions for sighted users and TalkBack users are documented in `docs/DEPLOY.md`.
