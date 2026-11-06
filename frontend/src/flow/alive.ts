/**
 * Alive registry — pure state tracker for the one-shot "IT'S ALIVE" spark moment.
 *
 * Rules:
 * - Plays once per freshly loaded scene.
 * - Does not play when returning from Correct or Ask.
 * - Pure query: shouldPlayAlive(scene) has NO side effects when called.
 * - Calling shouldPlayAlive(scene) twice with the same scene returns the same boolean.
 * - State mutations happen only via markAlivePlayed(scene) or markReturningFromCorrect().
 * - resetAliveForTesting() resets state between unit tests.
 */
import type { DiagramScene } from '../core/scene';

let playedScenes = new WeakSet<DiagramScene>();
let isReturningFromCorrect = false;

/**
 * Pure query checking whether the alive spark should play for the given scene.
 * Has no side effects.
 */
export function shouldPlayAlive(scene: DiagramScene | null | undefined): boolean {
  if (!scene) return false;
  if (isReturningFromCorrect) return false;
  return !playedScenes.has(scene);
}

/**
 * Record that the alive spark has been played (or handled) for the given scene.
 * Also clears the returning-from-correct flag.
 */
export function markAlivePlayed(scene: DiagramScene): void {
  playedScenes.add(scene);
  isReturningFromCorrect = false;
}

/**
 * Signal that navigation is returning from Correct mode, suppressing the alive spark.
 */
export function markReturningFromCorrect(): void {
  isReturningFromCorrect = true;
}

/**
 * Reset all alive registry state for test isolation.
 */
export function resetAliveForTesting(): void {
  playedScenes = new WeakSet<DiagramScene>();
  isReturningFromCorrect = false;
}
