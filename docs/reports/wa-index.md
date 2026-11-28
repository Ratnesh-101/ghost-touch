# Wave A index and Wave B lane map (orchestrator: Claude Code, plan: Opus 5.5)

Inputs: docs/reports/wa-a1..a8 (Kiro default agent A1-A6, agy A7-A8). Probe (Playwright, Pixel 7): Start, Capture, Explore have no unnamed controls, no target under 48 px, no overflow at 200% font; triangle sample opens offline.

## Lanes (disjoint file ownership)
| Lane | Owner | May write only | Findings |
|---|---|---|---|
| B-host | Kiro gt-fixer | frontend/src/i18n/index.ts, frontend/src/flow/**, frontend/src/core/hostPolicy.ts, frontend/src/api/health.ts, frontend/src/App.tsx, frontend/src/screens/Capture.tsx, frontend/src/screens/Start.tsx, frontend/src/drivers/speech.ts, frontend/tests/** except e2e, .kiro/specs/ghost-touch/** | A1 W1-W8, A3-01, A3-02, A8 wording table |
| B-a11y | Kiro gt-fixer | frontend/src/screens/Correct.tsx, Teach.tsx, Build.tsx, SavedDiagrams.tsx, frontend/src/components/**, frontend/src/styles/**, frontend/tests/a11y.* and new frontend/tests/*.a11y.test.tsx | A2-01..A2-06 |
| B-e2e | Kiro default | frontend/e2e/host.guide.spec.ts, frontend/e2e/a11y.screens.spec.ts, frontend/e2e/support/hostProbe.ts (new). Write specs only; do NOT run playwright or npm run build (orchestrator runs them) | Ghost Host flows, per-screen a11y, 200% font, offline sample |
| B-sub | Kiro default | submission/**, docs/DEMO_SCRIPT.md | A6-01..A6-05, A6-07 |
| B-comm | agy (no shell) | CONTRIBUTING.md, CODE_OF_CONDUCT.md (new), docs/TEACHER_GUIDE.md, README.md | A7 COMM-01..08, A6-06, A6-08, A6-14 |

## Rules for every lane
No commits, no npm run build, never touch .kiro/agents, tuned haptic values unchanged, core stays pure, never weaken or skip a test. Notes go to docs/kiro-evidence/<lane>.md (not BUILD_LOG). A4-1 (agents permissions) is the owner's decision; do not edit .kiro/agents.
