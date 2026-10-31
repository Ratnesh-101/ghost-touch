// TEMP-STUB: replaced by core/hapticEngine.ts (Task 4, Kiro). Do not extend.
//
// Shapes copied from .kiro/specs/ghost-touch/design.md and the tuned values
// from .kiro/steering/tech.md. Types and constants only: no engine logic.

export type Effect =
  | { kind: 'vibrate'; pattern: number | number[] }
  | { kind: 'speak'; text: string }
  | { kind: 'tone'; hz: number | null };

export interface HapticConfig {
  lineMs: number;
  retriggerMs: number;
  cornerPattern: number[];
  quietMs: number;
  vertexRadius: number;
  lineRadius: number;
}

export const DEFAULT_HAPTICS: HapticConfig = {
  lineMs: 80,
  retriggerMs: 70,
  cornerPattern: [50, 90, 50],
  quietMs: 450,
  vertexRadius: 22,
  lineRadius: 14,
};
