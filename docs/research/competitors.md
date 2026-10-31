# Competitors and prior art

Compiled by Claude Code, 2026-10-31, updated 2026-11-01. Facts only; each claim has a source below. Not a full literature survey. Pricing and usage limits that I could not confirm are marked as such.

## Competitor table (matches `docs/WIN_PLAN.md` §8, extended)
| Product | What it does | Gap vs. Ghost Touch |
|---|---|---|
| Dot Pad | Refreshable tactile pin display for graphics | About £6,500 to £7,800 hardware (WIN_PLAN figure; not re-verified) |
| Microsoft Seeing AI (explore photo) | Touch a photo, hear people and objects | Not built for STEM diagrams; no line or corner haptics; no maths Q&A |
| Desmos Audio Trace | Sonifies graphs (pitch follows the curve) | Equations or data are typed in, not photographed |
| Grafici Accessibili (Univ. Padova) | Android tablet app with haptic points for 3 function types | Typed equations, tablet, no photos |
| **TouchSight** (hackathon, Banana Hacks 2026) | Photo of a diagram becomes a tactile sheet (swell paper SVG/PDF), a 3D-printable STL and a spoken "explore mode" | Needs an embosser or printer; **no phone haptics** (feedback is raised paper or print); **not tested with blind users** by its author |
| Raised Lines Foundation / IIT Delhi | Physical tactile textbooks and low-cost tactile graphics | Slow to produce, not on demand |
| Research prototypes (Vanderbilt line-tracing app, Tennison et al. Android vibration library, multimodal tablet studies) | Phone or tablet vibrates when a finger is on a line; audio can be added | Graphics are authored in advance; Ghost Touch builds the scene from the student's own photo |
| AI describers (Be My AI, Seeing AI) | Describe a photo in words | Words, not exploration. In a University of Maryland study (11 blind users) more than half were bothered by the long scene description Be My AI opens with. |

## TouchSight: lessons we are applying
Source: its README and its write-up "I built a tool that turns diagrams into something blind students can touch. Here's what broke" (links below). I read both on 2026-11-01. The author reports no accuracy figures and no user numbers.
1. **Prompt for the audience and teacher vocabulary.** Gemini's first labels were useless ("Upper left section", "Faceted heart shield"). Telling the model who the diagram is for and to use the terms a teacher would use fixed most of it. *Ghost Touch:* the extraction prompt requires teacher vocabulary and forbids colour or shape descriptions (`docs/briefs/T08-scene-pipeline.md`).
2. **Validating the output matters as much as the prompt.** The author's own words: "checking the AI's output matters as much as the prompt". If a label still contains colour or shape words, the code asks the model again, **once**. *Ghost Touch:* `validate.py` rejects colour-only and shape-only labels and the pipeline retries once (T08, design property P13).
3. **AI labels plus classical computer vision worked best.** Edge detection alone failed on shaded, realistic drawings; Gemini's rough boxes combined with GrabCut gave correct named parts. *Ghost Touch:* the same split in spirit: the model supplies meaning and labels; OpenCV supplies the Raw Mode fallback and could refine boundaries later.
4. **Failed responses are never cached, and the system falls through to the next model on a quota error or when a model is busy.** *Ghost Touch:* Gemini primary with an NVIDIA fallback, and Raw Mode as the floor. (We saw a 503 "high demand" from Gemini in our own spike on 2026-11-01.)
5. **Browsers block speech until the user interacts.** TouchSight opens on a "tap anywhere to start" screen, and suggests turning voice off for screen-reader users so the two do not talk over each other. *Ghost Touch:* the same Start screen; the status text is no longer a live region when the app speaks it.
6. **It was never tested with blind students.** The author calls that "the most important next step". This is the gap our school session (BPA, `docs/user-test/plan.md`) fills; we should say so plainly and not claim more than we measure.
7. **Differences:** TouchSight outputs physical tactile media (needs hardware); Ghost Touch outputs vibration, sound and speech on the phone the student already has. TouchSight is a good reference for the vocabulary and validate-then-retry findings, not for the touch interaction.

## What this means for our design (only points the sources support)
1. **Pair touch with sound.** Tennison's group tested vibration, audio and the two combined for straight lines. Ghost Touch does both (buzz plus speech and pitch).
2. **Keep announcements short.** The Maryland finding argues against a long opening description.
3. **A phone motor cannot localise.** The whole screen shakes (arXiv 2112.13459), so position is encoded in timing, patterns and speech: that is why the corner pattern and quiet window matter.
4. **Teach with both.** Perkins recommends introducing tactile graphics before digital audio graphs. For user tests, compare Ghost Touch against a raised/tactile version or a verbal description.
5. **Be modest in claims.** Most studies have small samples (6 to 26 users). Say "early evidence".

## Positioning (draft, one sentence)
"Existing tools need a teacher to author the graphic, the student to type the equation, or an embosser to print it; Ghost Touch turns the student's own textbook photo, screenshot or PDF page into something they can feel and ask questions about, on a phone they already have, and it works with TalkBack on."

## Sources
- [TouchSight repository (MIT, Banana Hacks 2026)](https://github.com/DhruvalAnandkar/touchsight)
- [TouchSight write-up on dev.to: "I built a tool that turns diagrams into something blind students can touch. Here's what broke"](https://dev.to/dhruvalanandkar/i-built-a-tool-that-turns-diagrams-into-something-blind-students-can-touch-heres-what-broke-41k)
- [Vanderbilt line-tracing app and related coverage (NSF grant record)](https://grantome.com/grant/NSF/IIP-1632787)
- [Evaluating touch-screen vibration modality for blind users](https://soe.lau.edu.lb/files/Tekli_Journal_1.pdf)
- [Establishing vibration-based tactile line profiles (Tennison et al.)](https://par.nsf.gov/servlets/purl/10204748)
- [Exploration strategies for tactile graphics by electrovibration (arXiv 2112.13459)](https://arxiv.org/pdf/2112.13459)
- [Grating haptic perception through touchscreen (arXiv 2511.10026)](https://arxiv.org/html/2511.10026)
- [Perkins: Desmos Audio Trace and sonified graphs](https://www.perkins.org/resource/desmos-audio-tracing-introducing-sonified-graphs/)
- [Smarter Balanced Desmos calculators](https://smarterbalanced.org/new-smarter-balanced-desmos-calculators-are-free-and-accessible-to-students/)
- [California Dept of Education STEAM tools list](https://www.csb-cde.ca.gov/resources/whatsavailable/steamtools.aspx)
- [University of Maryland study on AI apps for blind users](https://root-nation.com/en/news-en/it-news-en/en-ai-apps-blind-users-umd-study/)
- [Making Charts Speak: LLM-based chart question answering for BLV users](https://researchconnect.stonybrook.edu/en/publications/making-charts-speak-llm-based-conversational-chart-question-answe/)
- [Experiences with lower-cost access to tactile graphics in India](https://www.microsoft.com/en-us/research/?p=157957)
- [APH and Orbit Research refreshable tactile graphics display (press release)](https://sites.aph.org/pr/aph-and-orbit-research-announce-the-worlds-first-affordable-refreshable-tactile-graphics-display)
- [HaptImage coverage](https://iconnect007.com/article/115905/device-turns-digital-images-into-physical-sensations/115908/ein)

Not verified: Dot Pad's current price; Be My AI and Seeing AI pricing and limits; details of Grafici Accessibili beyond the WIN_PLAN summary. Check the vendors before quoting numbers.
