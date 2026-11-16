# Lane bu8c Report — Richer TalkBack Labels

**Lane**: `bu8c` (richer TalkBack labels only)  
**Builder**: Antigravity (agy)  
**Scope**: `frontend/src/flow/a11yFeatures.ts`, `frontend/src/i18n/index.ts`, `frontend/tests/a11yFeatures.test.ts`, `docs/reports/agy-bu8c-labels-report.md`  
**Execution Mode**: Headless, file-only mode (zero shell commands run; tests/builds run by orchestrator).

---

## 1. Summary of Changes

### A. Richer TalkBack Feature Labels (`frontend/src/flow/a11yFeatures.ts`)
- **Points / Corners**:
  - Imported `vertexExits` from `../core/compass` and `getCoarsePosition` from `./commands`.
  - Determines coarse 2D position for each vertex via `getCoarsePosition(p)`.
  - Determines connected incident vertices via `vertexExits(scene, p.id)` and extracts destination vertex names in order of appearance (deduplicating parallel edges).
  - When incident vertices exist, formats label using `tf('a11y.corner', { name, pos, coarsePosition: pos, names: joinedNames, joined: joinedNames })`:  
    `"Corner {name}, {coarse position}, joined to {names}"`
  - When no incident vertices exist (standalone / unjoined point), formats label using `tf('a11y.cornerStandalone', { name, pos, coarsePosition: pos })`:  
    `"Corner {name}, {coarse position}"`
- **Segments / Sides**:
  - Resolves coarse positions for endpoints `a` and `b` via `getCoarsePosition(a)` and `getCoarsePosition(b)`.
  - Formats label using `tf('a11y.side', { name, from: posA, to: posB, a: posA, b: posB })`:  
    `"Side {name}, from {coarse position of a} to {coarse position of b}"`
- **Other Elements Preserved**:
  - Bars, curves (`polylines`), and axes remain completely unchanged.
  - `MAX_A11Y_FEATURES` (60) and kind share-out quota logic remain completely unchanged.

### B. Localization / Internationalization (`frontend/src/i18n/index.ts`)
Updated translation tables for English (`en`), Hindi (`hi`), and Gujarati (`gu`):

| Key | English (`en`) | Hindi (`hi`) | Gujarati (`gu`) |
|---|---|---|---|
| `a11y.corner` | `Corner {name}, {pos}, joined to {names}` | `कोना {name}, {pos}, {names} से जुड़ा` | `ખૂણો {name}, {pos}, {names} સાથે જોડાયેલ` |
| `a11y.cornerStandalone` | `Corner {name}, {pos}` | `कोना {name}, {pos}` | `ખૂણો {name}, {pos}` |
| `a11y.side` | `Side {name}, from {from} to {to}` | `भुजा {name}, {from} से {to} तक` | `બાજુ {name}, {from} થી {to} સુધી` |

All three translation tables maintain strict 1:1 key parity.

### C. Comprehensive Unit Tests (`frontend/tests/a11yFeatures.test.ts`)
Created unit test suite covering:
1. **Triangle Sample (`public/samples/triangle.json`)**:
   - **English (`en`)**:
     - Point A: `Corner A, top left, joined to C, B`
     - Point B: `Corner B, bottom right, joined to A, C`
     - Point C: `Corner C, bottom left, joined to A, B`
     - Side CA: `Side CA, from bottom left to top left`
     - Side AB: `Side AB, from top left to bottom right`
     - Side BC: `Side BC, from bottom right to bottom left`
   - **Hindi (`hi`)**:
     - Point A: `कोना A, ऊपर बाएँ, C, B से जुड़ा`
     - Point B: `कोना B, नीचे दाएँ, A, C से जुड़ा`
     - Point C: `कोना C, नीचे बाएँ, A, B से जुड़ा`
     - Side CA: `भुजा CA, नीचे बाएँ से ऊपर बाएँ तक`
     - Side AB: `भुजा AB, ऊपर बाएँ से नीचे दाएँ तक`
     - Side BC: `भुजा BC, नीचे दाएँ से नीचे बाएँ तक`
   - **Gujarati (`gu`)**:
     - Point A: `ખૂણો A, ઉપર ડાબે, C, B સાથે જોડાયેલ`
     - Point B: `ખૂણો B, નીચે જમણે, A, C સાથે જોડાયેલ`
     - Point C: `ખૂણો C, નીચે ડાબે, A, B સાથે જોડાયેલ`
     - Side CA: `બાજુ CA, નીચે ડાબે થી ઉપર ડાબે સુધી`
     - Side AB: `બાજુ AB, ઉપર ડાબે થી નીચે જમણે સુધી`
     - Side BC: `બાજુ BC, નીચે જમણે થી નીચે ડાબે સુધી`
2. **Standalone Points**:
   - Formats correctly as `Corner Origin, centre` in English, `कोना Origin, केंद्र` in Hindi, `ખૂણો Origin, કેન્દ્ર` in Gujarati.
   - Falls back to `p.id` when `label` is absent or empty.
3. **Preservation of Bars, Curves, and Axes**:
   - Bar: `Bar1, value 42`
   - Curve: `Curve CurveA`
   - Axes: `x-axis`, `y-axis`
4. **Quota and Limit Handling**:
   - Verifies `buildA11yFeatures` returns `[]` when `maxFeatures <= 0`.
   - Verifies capping behaves as expected.
5. **Key Completeness & Non-blank Checks**:
   - Verifies `a11y.corner`, `a11y.cornerStandalone`, and `a11y.side` are present and non-empty in `en`, `hi`, and `gu`.
   - Verifies expected placeholder parameters (`{name}`, `{pos}`, `{names}`, `{from}`, `{to}`) exist in the strings.

---

## 2. Verification of Constraints

- [x] **Zero shell commands**: No terminal, shell, npm, npx, or git commands were executed.
- [x] **Strict path boundaries**: Only files within allowed paths were modified or created:
  - `frontend/src/flow/a11yFeatures.ts`
  - `frontend/src/i18n/index.ts`
  - `frontend/tests/a11yFeatures.test.ts`
  - `docs/reports/agy-bu8c-labels-report.md`
- [x] **Forbidden files untouched**:
  - `Explore.tsx` and `flow/explore.ts` were NOT edited.
  - `frontend/src/core/**` was read-only; no files in core were modified.
  - `.kiro/**`, `tasks.md`, `.gitignore`, `.env*`, and `package.json` were NOT touched.
- [x] **No core engine/haptics changes**: `hitTest`, `hapticEngine`, and haptics values were untouched.
- [x] **Clean TypeScript types**: All imports, exports, and function calls are fully typed with no `any` and no `console.log`.
