# Project Structure

```
ghost-touch/
├── .kiro/
│   ├── specs/ghost-touch/      # requirements.md, design.md, tasks.md
│   ├── steering/               # product.md, tech.md, structure.md
│   └── hooks/                  # agent hooks (created in Kiro)
├── frontend/
│   ├── src/
│   │   ├── core/               # PURE logic, no browser APIs (property-tested)
│   │   │   ├── geometry.ts     # normalize/denormalize, distance-to-segment
│   │   │   ├── hitTest.ts      # finger position -> target (vertex > line > none)
│   │   │   ├── hapticEngine.ts # step(state, input) -> { state, effects }
│   │   │   ├── pitch.ts        # y -> Hz mapping
│   │   │   └── scene.ts        # DiagramScene helpers, generated types import
│   │   ├── drivers/            # the ONLY place browser APIs are called
│   │   │   ├── haptics.ts      # HapticDriver (web vibrate; Capacitor later)
│   │   │   ├── audio.ts        # theremin oscillator
│   │   │   ├── speech.ts       # TTS + speech recognition
│   │   │   └── camera.ts
│   │   ├── screens/            # Start, Capture, Explore, Ask, Correct
│   │   ├── components/
│   │   ├── i18n/
│   │   ├── api/                # backend client
│   │   └── types/scene.gen.ts  # GENERATED from backend JSON Schema; do not edit
│   ├── tests/                  # *.test.ts (unit) and *.prop.test.ts (fast-check)
│   └── public/                 # PWA manifest, icons, sample diagrams
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app and routes
│   │   ├── schema.py           # DiagramScene Pydantic models (source of truth)
│   │   ├── vision/             # VisionProvider interface + implementations
│   │   ├── raw_mode.py         # OpenCV edge detection -> segments
│   │   ├── ask.py              # answer questions from scene JSON
│   │   └── validate.py         # post-LLM validation and repair
│   └── tests/                  # pytest + Hypothesis
├── prototypes/haptics-test.html  # haptics spike (built Oct 31, 2026)
├── docs/                       # demo script, Kiro write-up, blog draft
├── LICENSE                     # MIT, visible in GitHub About section
└── README.md
```

## Naming
- Property tests: `*.prop.test.ts` / `test_*_props.py`.
- React components: `PascalCase.tsx`. Core modules: `camelCase.ts`.
- API routes: `/api/v1/...`.
