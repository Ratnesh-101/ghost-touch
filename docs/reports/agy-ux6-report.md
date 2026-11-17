# Lane ux6 Report: Documentation Truth and Audit Sync

**Lane:** ux6  
**Agent:** Antigravity (agy)  
**Date:** 2026-11-17  
**Gate Baseline Commit:** 8eda0ac (orchestrator gate run on 2026-11-17)

---

## 1. Files Changed

1. `README.md`
2. `docs/BLOG.md`
3. `docs/SOCIAL.md`
4. `docs/STEMERGENT_APPENDIX.md`
5. `docs/DEMO_SCRIPT.md`
6. `docs/DEPLOY.md`
7. `docs/PRIVACY.md`

*(Forbidden paths `docs/STEMERGENT_SUBMISSION.md`, `docs/BUILD_LOG.md`, `.env*`, and all `[FILL]`, `[OWNER]`, and `[HW]` slots were preserved strictly untouched.)*

---

## 2. Tests Added

**Zero test files added or modified.** Per the UX rules for this lane, no code or test files outside the ALLOWED public documentation list were touched. No shell commands were run.

---

## 3. What Could Not Be Verified

- Hardware test execution on physical devices (Samsung Galaxy S24+, OnePlus Nord CE6) could not be run by this agent directly; documentation now honestly reflects verified vs pending status.
- Live deployment behavior of `VITE_FEATURE_GUIDE` and `VITE_FEATURE_SHARE` flags on Vercel/Render was verified via code contracts and static docs, not via live browser sessions.

---

## 4. Detailed Sentence Changes (Old and New)

### File: `README.md`

1. **Low vision disclaimer (DO 5)**
   - **Old:**
     > It turns photos, screenshots, or PDF pages of STEM diagrams into tactile graphics that blind and low-vision students explore by touch on an ordinary Android phone. As students trace shapes on the screen, the phone vibrates along lines, pulses at corners, plays rising tones along curves, and answers spoken questions about the picture.
   - **New:**
     > It turns photos, screenshots, or PDF pages of STEM diagrams into tactile graphics that blind and low-vision students explore by touch on an ordinary Android phone. Low-vision students use the same touch and sound; the screen has no large-print or contrast options yet. As students trace shapes on the screen, the phone vibrates along lines, pulses at corners, plays rising tones along curves, and answers spoken questions about the picture.

2. **Soften resilience floor (DO 4)**
   - **Old:**
     > - **Resilience floor:** If AI providers are slow or unconfigured, the pipeline falls back to OpenCV edge detection (Raw Mode) so students are never left with an empty screen.
   - **New:**
     > - **Resilience floor:** If AI providers are slow or unconfigured, the pipeline falls back to OpenCV edge detection (Raw Mode), which still gives outlines to follow when online, even if rough.

3. **Experimental features line in "How it feels" (DO 3)**
   - **Old:**
     > *(Absent)*
   - **New:**
     > Experimental, off by default or awaiting a phone test: corner compass, where-am-I, near-line click, graph scan, stay on line, corner heartbeat. Their values are proposals, not tuned.

4. **Soften WCAG AAA (DO 4)**
   - **Old:**
     > - **7:1 contrast (WCAG AAA):** Laboratory color tokens exceed 7:1 contrast on deep charcoal backgrounds (`#0b0e0c`).
   - **New:**
     > - **7:1 contrast (colour tokens are tested at 7:1 or more):** Laboratory color tokens exceed 7:1 contrast on deep charcoal backgrounds (`#0b0e0c`).

5. **Soften works offline (DO 4)**
   - **Old:**
     > - **Offline PWA:** Progressive Web App with service worker precaching and built-in sample diagrams that work offline.
   - **New:**
     > - **Offline PWA:** Progressive Web App with service worker precaching; samples and saved diagrams work offline; a new photo needs the server.

6. **Commit count update (DO 1)**
   - **Old:**
     > Git log history shows over 300 commits authored under the repository owner's identity, so commit authorship does not reflect individual tool contributions.
   - **New:**
     > Git log history shows 898 commits (of which 88 carry the kiro: prefix) authored under the repository owner's identity, so commit authorship does not reflect individual tool contributions.

7. **Test suite status count block (DO 1)**
   - **Old:**
     > Current test suite status: **2,231 frontend tests across 181 files** and **834 backend tests** pass cleanly (counted on 2026-11-12; re-checked on submission day).
   - **New:**
     > Current test suite status: On 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix.

8. **Phone status (DO 2)**
   - **Old:**
     > - **Hardware testing status:** The owner ran the installed app on a Samsung Galaxy S24+ and found a P0 bug (the Explore canvas grew taller for several seconds after the first hold, pushing Ask/Correct/Back off screen). Kiro fixed it spec-first (Requirement 25, properties P86 and P87, task 42); a Playwright regression test exists (`frontend/e2e`); the owner confirmed on the phone that it is fixed. Say only that; do not claim other phone steps passed. Nothing else has been verified on hardware by the owner except: the haptic timings were tuned on a OnePlus Nord CE6 and the TalkBack double-tap-and-hold gesture worked on the prototype there. Full-app testing of all other phone steps is pending (`docs/OWNER_TEST_SHEET.md`).
   - **New:**
     > - **Hardware testing status:** The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype.

9. **Soften never written to server disk (DO 4)**
   - **Old:**
     > - **Data privacy:** All image processing is stateless and in-memory. Diagrams are never stored on disk. For detailed data flows, third-party AI provider disclosures, and local storage bounds, see [docs/PRIVACY.md](docs/PRIVACY.md).
   - **New:**
     > - **Data privacy:** All image processing is stateless and in-memory. Diagrams are not stored; a large upload may pass through a temporary file that is deleted when the request ends. For detailed data flows, third-party AI provider disclosures, and local storage bounds, see [docs/PRIVACY.md](docs/PRIVACY.md).

---

### File: `docs/BLOG.md`

1. **Soften never leaves the student with nothing (DO 4)**
   - **Old:**
     > If the cloud AI model times out or encounters a poorly lit photograph, Ghost Touch never leaves the student with nothing: our classical computer vision fallback—Raw Mode, powered by OpenCV edge detection—extracts physical outlines directly on the backend.
   - **New:**
     > If the cloud AI model times out or encounters a poorly lit photograph, Ghost Touch still gives outlines to follow when online, even if rough: our classical computer vision fallback—Raw Mode, powered by OpenCV edge detection—extracts physical outlines directly on the backend.

2. **Test suite count block and Phone status (DO 1 & DO 2)**
   - **Old:**
     > We believe in radical honesty about what is proven and what is not. Ghost Touch passes 2,231 frontend tests across 181 files and 834 backend tests, verifying 83 numbered correctness properties with fast-check and Hypothesis. The haptic timings were tuned on a OnePlus Nord CE6, the TalkBack double-tap-and-hold gesture worked on our prototype there, and the canvas growth bug fix was confirmed on the Galaxy S24+. Nothing else has been verified on hardware by the owner. Full-app testing of other phone steps is pending. No blind student
   - **New:**
     > We believe in radical honesty about what is proven and what is not. On 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix. The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype. No blind student

---

### File: `docs/SOCIAL.md`

1. **Short Post phone status and counts (DO 1 & DO 2)**
   - **Old:**
     > The TalkBack double-tap-and-hold gesture worked on our prototype on a OnePlus Nord CE6, and the S24+ canvas layout bug was fixed spec-first by Kiro and verified on phone. Other phone steps are pending. 2,231 frontend tests and 834 backend tests pass cleanly.
   - **New:**
     > The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype. On 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix.

2. **Medium Post phone status and counts (DO 1 & DO 2)**
   - **Old:**
     > Radical transparency: 2,231 frontend tests across 181 files and 834 backend tests pass cleanly. Haptic timings were tuned on a OnePlus Nord CE6, the TalkBack gesture worked on our prototype there, and the Galaxy S24+ canvas bug fix was confirmed on hardware; full-app phone testing of other steps is pending. No blind student has tested it yet, and Hindi and Gujarati text is machine-translated awaiting native review.
   - **New:**
     > Radical transparency: On 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix. The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype. No blind student has tested it yet, and Hindi and Gujarati text is machine-translated awaiting native review.

3. **Thread Post 2/4 safety net softening (DO 4)**
   - **Old:**
     > • Safety net → If cloud AI drops, OpenCV Raw Mode extracts outlines so the screen is never blank.
   - **New:**
     > • Safety net → If cloud AI drops, OpenCV Raw Mode extracts outlines, which still gives outlines to follow when online, even if rough.

4. **Thread Post 4/4 phone status and counts (DO 1 & DO 2)**
   - **Old:**
     > #KiroweenHackathon26 4/4: Honest engineering: 2,231 frontend tests and 834 backend tests verify mathematical invariants. Haptics were tuned on a OnePlus Nord CE6, the TalkBack gesture passed on the prototype there, and the S24+ canvas bug fix was confirmed on device. Full-app testing of other phone steps is pending.
   - **New:**
     > #KiroweenHackathon26 4/4: Honest engineering: on 2026-11-17 (at main 8eda0ac), frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix. The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype.

---

### File: `docs/STEMERGENT_APPENDIX.md`

1. **Header test counts (DO 1)**
   - **Old:**
     > Test counts were filled in from a full run on 2026-11-12 (2,231 frontend tests in 181 files, 834 backend tests); re-run the suites on submission day and update them if code has changed.
   - **New:**
     > Test counts from the gate run on 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix.

2. **Low vision disclaimer (DO 5)**
   - **Old:**
     > Take a photo, screenshot or PDF page of a school diagram, and a blind or low-vision student can explore it by touch on an ordinary Android phone: the phone buzzes on lines and at corners, speaks the labels, plays a rising tone along a graph, and answers spoken questions about the picture.
   - **New:**
     > Take a photo, screenshot or PDF page of a school diagram, and a blind or low-vision student can explore it by touch on an ordinary Android phone: the phone buzzes on lines and at corners, speaks the labels, plays a rising tone along a graph, and answers spoken questions about the picture. Low-vision students use the same touch and sound; the screen has no large-print or contrast options yet.

3. **Soften Raw Mode (DO 4)**
   - **Old:**
     > The student is never left with an empty screen.
   - **New:**
     > The app still gives outlines to follow when online, even if rough.

4. **Section 5 item 3 phone status (DO 2)**
   - **Old:**
     > These haptic parameters were tuned by hand on the owner's OnePlus Nord CE6 in the haptics prototype (prototypes/haptics-test.html); end-to-end testing of the full app on the phone is still pending.
   - **New:**
     > The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype.

5. **Soften without hallucination (DO 4)**
   - **Old:**
     > Semantic questions ("where is the right angle?", "what is the peak?") are resolved deterministically on the backend from diagram geometry without hallucination; non-semantic questions are answered by Gemini/OpenAI backed by deterministic facts lookup.
   - **New:**
     > Semantic questions ("where is the right angle?", "what is the peak?") and geometry questions are answered by code; others go to the model with the facts.

6. **Soften WCAG AAA (DO 4)**
   - **Old:**
     > High-contrast theme meeting WCAG AAA contrast ratios (≥7:1), Atkinson Hyperlegible typography for low-vision distinction,
   - **New:**
     > High-contrast theme where colour tokens are tested at 7:1 or more, Atkinson Hyperlegible typography for low-vision distinction,
   - **Old (table):**
     > | **Accessibility & Presentation:** WCAG AAA tokens (≥7:1), Atkinson Hyperlegible typography, creature mascot SVG, 48px+ touch targets, `prefers-reduced-motion` compliance. |
   - **New (table):**
     > | **Accessibility & Presentation:** Colour tokens are tested at 7:1 or more, Atkinson Hyperlegible typography, creature mascot SVG, 48px+ touch targets, `prefers-reduced-motion` compliance. |

7. **Models in render.yaml (DO 4)**
   - **Old:**
     > **Google Gemini** (`gemini-3.8-flash` / `gemini-3.5-flash-lite`) is the default vision model in codebase architecture, while production deployment on Render sets **OpenAI** (`gpt-4.1-mini`) as primary via `VISION_PROVIDERS: openai,gemini,nebius`.
   - **New:**
     > **Google Gemini** (`gemini-3.5-flash-lite`) is the default vision model in codebase architecture, while production deployment on Render sets **OpenAI** (`gpt-4.1-mini`) as primary via `VISION_PROVIDERS: openai,gemini,nebius` (with Nebius models `openbmb/MiniCPM-V-4_5` for vision and `nvidia/Nemotron-3-Ultra-550b-a55b` for text).

8. **Section 7 table phone status (DO 2)**
   - **Old:**
     > | **Physical Phone Verification:** Haptic values were tuned by hand on the owner's OnePlus Nord CE6 in the prototype; full-app phone testing is pending. End-to-end testing with physical vibration motor, audio, and gestures on an actual device is unverified and pending (see `docs/OWNER_CHECKLIST.md` and `docs/PHONE_TEST.md`). |
   - **New:**
     > | **Physical Phone Verification:** The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype. |

9. **Soften never written to server disk (DO 4)**
   - **Old:**
     > Diagram processing is stateless in RAM with zero disk writes (see `docs/PRIVACY.md`).
   - **New:**
     > Diagram processing is stateless in RAM; images are not stored; a large upload may pass through a temporary file that is deleted when the request ends (see `docs/PRIVACY.md`).

10. **Section 7 table verification counts (DO 1)**
    - **Old:**
      > | **Automated Verification:** 2,231 frontend tests passing across 181 files; 834 backend tests passing; `tsc --noEmit`, `ruff check`, and `ruff format --check` all clean. | |
    - **New:**
      > | **Automated Verification:** On 2026-11-17 (at main 8eda0ac): frontend tests 2,700 passed (plus 1 expected fail and 1 todo) in 213 files; backend tests 908 passed; Playwright 22 passed; requirements 36; properties numbered to P136 (P109 to P113 specified, not yet tested); tasks 66; commits 898, of which 88 carry the kiro: prefix. `tsc --noEmit`, `ruff check`, and `ruff format --check` all clean. | |

---

### File: `docs/DEMO_SCRIPT.md`

1. **Pre-Filming Setup Checklist phone status (DO 2)**
   - **Old:**
     > *(Note: The haptic timings were tuned on a OnePlus Nord CE6 and the TalkBack double-tap-and-hold gesture worked on the prototype there. On a Samsung Galaxy S24+, the canvas growth bug was confirmed fixed. Other phone steps are pending verification).*
   - **New:**
     > *(Note: The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype).*

2. **2:00 TalkBack shot evidence marking (DO 7)**
   - **Old:**
     > | **2:00–2:15** (15s) | **TalkBack Screen Reader:** TalkBack on. Double-tap and hold, then drag across diagram lines. Vibration passes through. | Explore screen with TalkBack accessibility focus. | *"It works with the screen reader blind students already use."* | `[HW: owner to confirm]` (Gesture passed on prototype on Nord CE6; full-app check pending). |
   - **New:**
     > | **2:00–2:15** (15s) | **TalkBack Screen Reader:** TalkBack on. Double-tap and hold, then drag across diagram lines. Vibration passes through. Film only if recorded evidence exists. | Explore screen with TalkBack accessibility focus. | *"It works with the screen reader blind students already use."* | `[HW: owner to confirm]` (Gesture passed on prototype on Nord CE6; full-app check pending; film only if recorded evidence exists). |

3. **2:15 Raw Mode narration softening (DO 4)**
   - **Old:**
     > *"It never leaves the student with nothing."*
   - **New:**
     > *"It still gives outlines to follow when online, even if rough."*

4. **2:30 Hook shot evidence marking (DO 7)**
   - **Old:**
     > | **2:30–2:45** (15s) | **Spec-Driven Rigor:** Kiro IDE screen capture: formal EARS requirements, agent hook running tests on save, property test failing then passing. | Kiro IDE (spec task list, hooks, property test). | *"Specs, steering, hooks and property tests, built with Kiro."* | Recorded from Kiro IDE (`docs/kiro-evidence/`). |
   - **New:**
     > | **2:30–2:45** (15s) | **Spec-Driven Rigor:** Kiro IDE screen capture: formal EARS requirements, agent hook running tests on save, property test failing then passing. Film only if recorded evidence exists. | Kiro IDE (spec task list, hooks, property test). | *"Specs, steering, hooks and property tests, built with Kiro."* | Recorded from Kiro IDE (`docs/kiro-evidence/`; film only if recorded evidence exists). |

5. **Section 4 Item 1 phone status (DO 2)**
   - **Old:**
     > 1. **Do not claim physical phone validation beyond what is verified:** State honestly that haptic timings were tuned on a OnePlus Nord CE6, the TalkBack gesture passed on the prototype there, and the canvas growth bug fix was verified on a Samsung Galaxy S24+. All other full-app phone steps are pending.
   - **New:**
     > 1. **Do not claim physical phone validation beyond what is verified:** The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype.

6. **Section 4 Item 5 hooks authorship (DO 7)**
   - **Old:**
     > Be scrupulously honest: Kiro authored specs, steering, hooks, pure core, haptic engine, and property tests; Antigravity built the Frankenstein Lab redesign, screens, drivers, and hardening; Claude Code supervised, gated tasks, and reviewed.
   - **New:**
     > Be scrupulously honest: Kiro and Antigravity wrote the hooks; Kiro authored specs, steering, pure core, haptic engine, and property tests; Antigravity built the Frankenstein Lab redesign, screens, drivers, and hardening; Claude Code supervised, gated tasks, and reviewed.

---

### File: `docs/DEPLOY.md`

1. **Step 2 environment variables for flags (DO 6)**
   - **Old:**
     > *(Absent from Step 2 variable list)*
   - **New:**
     > - **Key**: `VITE_FEATURE_GUIDE` *(Optional; default unset/0)*  
     > - **Value**: Set to `1` to enable the "Guide my finger" directional audio/haptic guidance feature (ships off until toggled in Settings).  
     > - **Key**: `VITE_FEATURE_SHARE` *(Optional; default unset/0)*  
     > - **Value**: Set to `1` to enable Teacher verify & share. Teacher tools are hidden without this flag.

2. **Step 5 Mobile Checklist feature flags (DO 6)**
   - **Old:**
     > - **Guide and Share:** Guide and Share ship in the live app but stay off until the user turns them on in Settings; neither has been tested on a phone.
   - **New:**
     > - **Guide and Share (`VITE_FEATURE_GUIDE`, `VITE_FEATURE_SHARE`):** Teacher tools are hidden without `VITE_FEATURE_SHARE`. Guide and Share ship in the live app but stay off until the user turns them on in Settings; neither has been tested on a phone.

3. **Section 7 phone status (DO 2)**
   - **Old:**
     > - **Hardware Verification Pending:** The TalkBack double-tap-and-hold gesture worked on our prototype on a OnePlus Nord CE6 (docs/research/talkback-spike.md). It has not yet been tested in the full app. Tactile motor strength and stereo panning are unverified on physical hardware (`docs/OWNER_CHECKLIST.md`).
   - **New:**
     > - **Hardware Verification Pending:** The installed app has been run on one phone (Samsung Galaxy S24+); that run found one layout bug and confirmed its fix. A full test pass has not been recorded yet. The vibration timings were tuned by hand on a OnePlus Nord CE6 in the prototype.

4. **Section 7 Feature Flags note (DO 6)**
   - **Old:**
     > - **Feature Flags:** Guide and Share ship in the live app but stay off until the user turns them on in Settings; neither has been tested on a phone.
   - **New:**
     > - **Feature Flags:** `VITE_FEATURE_GUIDE` (directional guidance) and `VITE_FEATURE_SHARE` (teacher sharing). Teacher tools are hidden without `VITE_FEATURE_SHARE`. Both features ship in the live app but stay off until the user turns them on in Settings; neither has been tested on a phone.

5. **Section 7 Privacy disk storage softening (DO 4)**
   - **Old:**
     > - **Privacy Architecture:** All diagram processing is stateless in RAM; images are never written to server disk. See [docs/PRIVACY.md](docs/PRIVACY.md) for full verified data flow.
   - **New:**
     > - **Privacy Architecture:** All diagram processing is stateless in RAM; images are not stored; a large upload may pass through a temporary file that is deleted when the request ends. See [docs/PRIVACY.md](docs/PRIVACY.md) for full verified data flow.

---

### File: `docs/PRIVACY.md`

1. **Low vision disclaimer (DO 5)**
   - **Old:**
     > Ghost Touch is an open-source assistive web application designed to help blind and low-vision students explore diagrams through vibration, sound, and spoken words on an Android phone.
   - **New:**
     > Ghost Touch is an open-source assistive web application designed to help blind and low-vision students explore diagrams through vibration, sound, and spoken words on an Android phone. Low-vision students use the same touch and sound; the screen has no large-print or contrast options yet.

2. **Server disk storage softening (DO 4)**
   - **Old:**
     > - **Photos Are Not Kept on Our Servers:** Our backend does not write photos to disk or keep them in a database. It temporarily caches the resulting line/point coordinate data in memory for up to 6 hours to save processing quota on repeated scans; the photo itself is discarded after processing.
   - **New:**
     > - **Photos Are Not Kept on Our Servers:** Photos are not stored; a large upload may pass through a temporary file that is deleted when the request ends. It temporarily caches the resulting line/point coordinate data in memory for up to 6 hours to save processing quota on repeated scans; the photo itself is discarded after processing.

3. **Verification Matrix disk storage softening (DO 4)**
   - **Old:**
     > | Backend does not store photos on disk | **VERIFIED** | `backend/app/main.py`, `backend/app/scene_cache.py` |
   - **New:**
     > | Photos not stored (temporary upload file deleted when request ends) | **VERIFIED** | `backend/app/main.py`, `backend/app/scene_cache.py` |
