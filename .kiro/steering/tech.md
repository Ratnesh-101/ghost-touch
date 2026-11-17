# Tech Stack & Conventions

## Stack
- **Frontend:** React 19 + Vite + TypeScript, installable PWA. Chrome on Android is the target runtime.
- **Browser APIs:** Vibration API (`navigator.vibrate`), Web Audio API (theremin), Web Speech API (`speechSynthesis` for output, `SpeechRecognition` for voice questions), Pointer Events, `<input type="file" capture="environment">` for the camera.
- **Backend:** Python 3.11 + FastAPI + Pydantic v2.
- **AI:** one vision-capable LLM behind a provider interface (`VisionProvider`). The model and API key come from environment variables. Never hard-code a provider.
- **Raw Mode edge detection:** OpenCV (`opencv-python-headless`) on the backend.
- **Testing:** Vitest + fast-check (frontend property-based tests), pytest + Hypothesis (backend property-based tests).
- **Deploy:** frontend on Vercel, backend on Render.
- **Fallback runtime:** if web haptics prove too limited, wrap the same React app with Capacitor (`@capacitor/haptics`) as a native Android app. Keep haptic calls behind the `HapticDriver` interface so this swap touches one file.

## Architecture rules
1. **Pure core, thin shell.** All decision logic (hit-testing, haptic sequencing, pitch mapping, coordinate transforms) lives in `frontend/src/core/` as pure TypeScript functions with no DOM, React, or browser API access. Browser APIs are called only from `frontend/src/drivers/`.
2. **The haptic engine is a state machine:** `step(state, input) -> { state, effects }`. Effects are plain data (`{ kind: 'vibrate', pattern }`, `{ kind: 'speak', text }`, `{ kind: 'tone', hz }`). Drivers execute effects. This makes every haptic rule property-testable.
3. **One schema, two languages.** `DiagramScene` is defined once as a Pydantic model in `backend/app/schema.py`. The TypeScript type is generated from its JSON Schema. Do not hand-write a second copy.
4. **All coordinates are normalized to [0, 1]** in `DiagramScene`. Conversion to screen pixels happens only in `core/geometry.ts`.
5. **Validate every LLM response** against the schema. Invalid or empty output triggers one retry, then Raw Mode. Never pass unvalidated LLM output to the frontend.

## Haptic vocabulary (current tuned values; change only here)
| Meaning | Pattern | Notes |
|---|---|---|
| On a line | `vibrate(80)` re-triggered every 70 ms while the finger stays on the line | feels continuous |
| Leaving a line | `vibrate(0)` | unless a corner pulse is playing |
| Vertex / corner | `vibrate([50, 90, 50])`, then 450 ms quiet window with no line buzz | felt as "bzzzz-tap" on the test device |
| Label / point of interest | corner pattern + spoken label | speech is cancelled and replaced on each new target |
| Graph curve | line buzz + theremin tone, 200–1000 Hz, higher on screen = higher pitch | |
| Centre reference tick (proposed, pending approval) | `vibrate(25)` | one 25 ms pulse, distinct from line and corner patterns; fires on hold start at centre |
| **PROPOSED, pending owner approval, not phone-tested (task 51, Requirement 27): near-line click cue** | audio only, never `vibrate` | click when off the line within 48 px of it (and on a line inside the 450 ms quiet window, at the closest setting). Interval 400 ms at 48 px to 90 ms at 14 px or less; pitch 500 Hz to 1200 Hz, rising as the finger nears; gain 0.3 to 0.6; pan toward the line. The 14 px is the existing line radius, copied. Lives in `core/proximity.ts` (`DEFAULT_PROXIMITY`); no existing row above changes |
| **PROPOSED, pending owner approval, not phone-tested (task 58, Requirement 33): sticky line (optional, OFF by default)** | none (changes which target is reported, adds no effect) | once a line has been the target for 200 ms or more, the same line stays the target out to 24 px (finger to the line) when `hitTest` reports none or a bar, until another line or a vertex is reported or the finger lifts. Acquisition still needs the 14 px line radius, which is unchanged. Lives in `core/sticky.ts` (`STICKY_HOLD_MS`, `STICKY_RADIUS_PX`). Wired into Explore behind the Settings switch "Stay on line" (storage key `gt_sticky_line_enabled`), which is OFF by default; with the switch off Explore calls `hitTest` as before. The values are still proposals and have not been felt on a phone; no existing row above changes |
| **PROPOSED, pending owner approval, not phone-tested (task 59, Requirement 34): corner heartbeat (optional, OFF by default)** | `vibrate([50, 90, 50])` (the tuned corner pattern, reused), one call per beat | while the finger rests on the same vertex, the double pulse repeats every 900 ms (start to start), first beat one period after the corner pattern. No speech and no tone on a beat. Never inside the 450 ms quiet window; leaving the vertex stops a beat in the same step (the line buzz replaces it, otherwise `vibrate(0)`). Lives in `core/heartbeat.ts` (`DEFAULT_HEARTBEAT`). Wired into Explore behind the Settings switch "Corner heartbeat" (storage key `gt_corner_heartbeat_enabled`), which is OFF by default; with the switch off Explore passes no heartbeat configuration and the effects are the engine's own. The values are still proposals and have not been felt on a phone; no existing row above changes |

Hit radii: vertex 22 CSS px, line 14 CSS px. Vertex hits take priority over line hits.

## Code style
- TypeScript `strict: true`. No `any` in `core/`.
- Python: type hints everywhere, `ruff` for lint and format.
- Small functions, named exports, no default exports in `core/`.
- Every user-facing string goes through `frontend/src/i18n/` (English first, Hindi later).

## Git
- Do not commit or push unless the user explicitly asks.
- The `/.kiro` directory must always be committed. Never add it to `.gitignore`.
