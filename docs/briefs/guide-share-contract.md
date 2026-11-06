# Contract: "Guide my finger" and "Teacher verify & share"
Planner/reviewer: Claude Code. Builder: agy for every lane. Label all of this "built by agy, reviewed by Claude" (never Kiro).
Every lane brief points here. If a lane needs something not in this contract, write it under "Needs from planner" in your report; do not invent a different interface.

## Global rules (all lanes)
- Read AGENTS.md first. Forbidden to edit: `frontend/src/core/**` (ZERO-line diff, tuned haptic values locked), `.kiro/**`, `.env*`, `backend/app/schema.py`, `backend/app/validate.py`, `frontend/src/types/scene.gen.ts`, existing `*.prop.test.ts` / `test_*_props.py` (new ones are fine).
- You may IMPORT from `core/`; you may not change it. If the engine interface truly lacks something, stop and say so in the report.
- Browser APIs only in `frontend/src/drivers/`. All strings via `t()` in en, hi, gu. No `any`, no `console.log`. Targets >= 48x48 px, accessible names, every state change spoken.
- No new dependencies except `lz-string` and `qrcode` (+ `@types/qrcode`), installed by the planner/owner. No git.
- Feature flags: `VITE_FEATURE_GUIDE`, `VITE_FEATURE_SHARE` (build-time, read in ONE helper `frontend/src/config/features.ts`; ON only when the env value is "1", unset = OFF) AND a user setting (Settings sheet toggle, persisted via `drivers/storage.ts`, default off). A feature is active only when env flag AND setting are on. The owner flips defaults after the phone test.
- Finish: write your report `docs/reports/agy-<lane>-report.md` FIRST (save as you go), add a `docs/BUILD_LOG.md` entry (tool = "agy, reviewed by Claude"), run only the commands the runner allows. Backend lanes: do NOT run pytest/ruff (the supervisor does); frontend lanes may run tests/tsc/build.

## Guide contract (module `frontend/src/guide/`, pure, no browser APIs)
```ts
export type GuideTarget =
  | { kind: 'element'; elementId: string }      // point/segment/polyline/bar id from the scene
  | { kind: 'point'; x: number; y: number };    // scene space, [0,1]
export interface GuideConfig { farMs: number /*600*/; nearMs: number /*120*/; arriveRadius: number /*scene units*/; hintEveryMs: number /*2500*/; timeoutMs: number /*20000*/; pitchLoHz: number; pitchHiHz: number }
export const DEFAULT_GUIDE: GuideConfig;        // own constants; do NOT touch core haptics
export interface ResolvedTarget { x: number; y: number; label: string }
export type HintKey = 'left'|'right'|'up'|'down'|'up-left'|'up-right'|'down-left'|'down-right'|'here';
export function resolveTarget(scene: DiagramScene, t: GuideTarget): ResolvedTarget | null; // null if id missing / out of range
export function vectorTo(finger: NormPoint, target: NormPoint): { dx: number; dy: number; dist: number };
export function pulseIntervalMs(dist: number, cfg?: GuideConfig): number;     // monotone: nearer => shorter, clamped [nearMs, farMs]
export function pitchFor(dy: number, cfg?: GuideConfig): number;              // target above (dy<0, y=0 is top) => higher pitch
export function panFor(dx: number): number;                                    // [-1,1]; target left => negative
export function directionHint(dx: number, dy: number): HintKey;
export function hasArrived(dist: number, cfg?: GuideConfig): boolean;
export interface GuideState { phase: 'idle'|'guiding'|'arrived'|'stopped'; target: ResolvedTarget|null; startedAt: number; lastHintAt: number; lastHint: HintKey|null; lastPulseAt: number }
export type GuideInput =
  | { type: 'start'; target: ResolvedTarget; now: number }
  | { type: 'move'; finger: NormPoint; now: number }
  | { type: 'lift'; now: number }
  | { type: 'cancel'; reason: 'voice'|'back'|'timeout'|'user'; now: number }
  | { type: 'tick'; now: number };
export type GuideEffect =
  | { type: 'pulse'; ms: number }
  | { type: 'tone'; hz: number; pan: number }
  | { type: 'toneOff' }
  | { type: 'speak'; key: string /*i18n key*/; hint?: HintKey; label?: string }
  | { type: 'arrive'; label: string }
  | { type: 'stopped'; reason: string };
export const initialGuideState: () => GuideState;
export function guideStep(s: GuideState, i: GuideInput, cfg?: GuideConfig): { state: GuideState; effects: GuideEffect[] };
```
Rules: spoken hint when direction changes OR every `hintEveryMs`; pulses throttled by `pulseIntervalMs`; `tick` past `timeoutMs` => `stopped` + speak "guide stopped"; `arrive` exactly once, then phase `arrived`. While guiding the theremin is suppressed (Explore must not play it). The phone speaker is MONO: spoken hints are mandatory, stereo pan is a headphone bonus.

## Ask-target contract (G3, backend)
`AskResponse` gains optional `target: {elementId: string} | {x: number, y: number} | null` (default null; old clients unaffected). The prompt tells the model to choose only from the scene's element ids (list them in the prompt). Server drops any `elementId` not in the scene (and any x/y outside [0,1]) => `target: null`. `facts_lookup` path may return null target. `AskRequest` unchanged. Frontend client `frontend/src/api/ask.ts`: `AskResponse.target?: GuideTarget` (map `{elementId}` to `{kind:'element',...}`, `{x,y}` to `{kind:'point',...}`); `parseAskResponse` tolerant (bad target => undefined, never throws).

## Share contract (module `frontend/src/share/`, pure except `qr.ts`)
```ts
export const SHARE_VERSION = 1;
export interface SharePayload { v: 1; scene: DiagramScene; verifiedBy: string; note: string; verifiedAt: string /*ISO*/ }
export const LIMITS = { maxHashChars: 12000, maxDecompressedChars: 200000, maxName: 60, maxNote: 280, maxLabel: 60, qrMaxUrlChars: 2000 };
export type ShareErrorCode = 'too-large'|'bad-format'|'bad-version'|'bad-scene'|'empty';
export class ShareError extends Error { code: ShareErrorCode }
export function encodeShare(p: SharePayload): string;      // lz-string compressToEncodedURIComponent; ShareError('too-large') if > maxHashChars
export function shareUrl(origin: string, encoded: string): string;   // `${origin}/#s=${encoded}`
export function decodeShare(hash: string): SharePayload;   // accepts '#s=...'; length check BEFORE decompress; decompressed-length cap; JSON.parse in try; v === 1; sanitise strings (strip control chars, cap lengths); scene must pass validateShareScene; throws ShareError only
export function validateShareScene(scene: unknown): { ok: true; scene: DiagramScene } | { ok: false; errors: string[] };
export function qrDataUrl(url: string): Promise<string | null>;   // null when url.length > qrMaxUrlChars
```
`validateShareScene` applies the SAME rules as the AI-output validator (`backend/app/validate.py`: coordinates within +-0.02 of [0,1] clamped, segments with missing endpoints dropped, ids de-duplicated, at least one drawable element) plus `validateSceneInvariants` from `core/correct.ts` plus caps (<=300 points/segments, <=2000 polyline points, <=60 bars, label <= maxLabel). It is re-implemented client-side because Student-open must work offline; cite validate.py in a comment. Unknown extra keys are dropped.
Rendering rule: labels/name/note are React text children only; never `dangerouslySetInnerHTML`.
Honesty copy (teacher screen + README): "Verified means a person reviewed this diagram. It is not cryptographic proof." The hash never reaches the server.
Routes (no router dep): extend `drivers/hashRoute.ts`: `#/teach` => Teacher editor; `#s=<payload>` => Student open; `#/debug` unchanged.
Teacher editor REUSES the existing Correct pipeline (`core/correct.ts`, `screens/Correct.tsx`, `flow/correct*.ts`); do not rebuild it. It adds: axis-range fields (function_graph only), verify form (name <=60, note <=280), share panel (link, Copy link, Web Share API when available, QR when the URL fits, plain-language message otherwise).
Student open: decode -> validate -> Explore with a `verified` banner prop -> speak "Verified by <name>" after the scene-loaded announcement; no network call; on error speak + show a friendly message and a "Go to start" button.
