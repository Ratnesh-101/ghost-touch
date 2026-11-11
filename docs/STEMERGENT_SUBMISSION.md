# STEMergent submission (draft for the owner to edit in your own words)

**Before submitting:** the only `[FILL]` markers left are in section "Links and team" and the one line about a school session. They need information only the owner has; do not guess them. The long technical detail (tools, property tests, status tables) is in `docs/STEMERGENT_APPENDIX.md`. Submit on **Nov 14** (hard stop Nov 16, 09:00 IST).

## Ghost Touch: feel diagrams you cannot see

**The problem.** Much of STEM is taught with diagrams: triangles, graphs, bar charts. For a blind or low-vision student a diagram is a blank on the page. Raised-line tactile graphics take weeks to make, so most diagrams never arrive on the day they are taught. Tactile tablets cost thousands of pounds.

**Who it helps.** Blind and low-vision school students, and the teachers and parents who prepare their material. It runs in Chrome on an ordinary Android phone, which most students already own, so it needs no extra hardware. `[FILL: one sentence about a school session, only if one happens; no numbers or quotes before they exist]`

**What the student feels.** A teacher or parent photographs a textbook diagram. The student drags a finger over the screen. The phone buzzes along each line, gives a double pulse at a corner and speaks its label. On a graph, a tone rises and falls with the height of the curve, so the student can hear the peaks. The student can also ask by voice, "How long is AC?", and hear a short answer taken from the diagram. If the AI cannot read the picture, Raw Mode still turns the image's edges into lines to follow, so the student is never left with nothing. On a laptop or an iPhone, which have no vibration motor, the app plays an audible buzz and shows a pulse instead.

**The STEM link.** It covers geometry (vertices, sides, right angles, lengths), function graphs (sine waves and parabolas become pitch) and bar charts (height becomes pitch). Answers come from the diagram's own coordinates and printed facts, and the app says "I don't know from this diagram" rather than guess.

**What is proven, and what is not.**
- More than 2,000 automated tests pass, including property-based tests of the touch and haptic logic.
- The vibration timings were tuned by hand on a OnePlus Nord CE6, and the TalkBack touch gesture worked on our prototype there.
- On 10 Nov the live backend read a clean test triangle in AI mode in about five seconds.
- Not yet done: no blind student has used it, the full app has not been tested on a phone, and accuracy on real textbook photos has not been measured. Hindi and Gujarati text is machine-translated and awaits a native-speaker review.

**AI tools used.** Google Gemini and OpenAI read the diagram photos in the running app; OpenCV edge detection is the fallback. Kiro wrote the specification, the design properties and the core touch and haptic logic with its property tests. Antigravity (a Gemini-based coding agent) built screens and backend plumbing from written briefs. Claude Code planned, reviewed and merged that work. Every tool's work is logged in `docs/BUILD_LOG.md`.

**What is next.** Sessions with students at the Blind People's Association in Ahmedabad, native-speaker review of the Hindi and Gujarati text, and a full test on a phone.

## Links and team
- Repository: https://github.com/Ratnesh-101/ghost-touch
- Live app: https://ghost-touch-iota.vercel.app (the first photo after idle can take about 30 s while the server wakes)
- Demo video: `[FILL: YouTube URL, under 3 minutes]`
- Screenshots or GIFs: `[FILL: owner to provide]`
- Team (up to 4): `[FILL: names, roles, institution]`
- Full detail: `docs/STEMERGENT_APPENDIX.md`
