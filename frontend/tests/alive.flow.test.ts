/**
 * Unit tests for alive registry flow module (Lane lab-explore4)
 *
 * Verifies:
 * - First load plays
 * - Remount with the same scene does not play
 * - A new scene plays
 * - Return from Correct does not play
 * - Registry has no side effects when shouldPlayAlive is called twice with the same scene
 * - resetAliveForTesting resets all state
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '../src/core/scene';
import {
  markAlivePlayed,
  markReturningFromCorrect,
  resetAliveForTesting,
  shouldPlayAlive,
} from '../src/flow/alive';

function makeScene(id: string, title = 'Sample Scene'): DiagramScene {
  return {
    kind: 'geometry',
    title: `${title} ${id}`,
    points: [{ id: 'p1', x: 0.1, y: 0.1 }],
    segments: [],
  };
}

describe('alive flow registry (flow/alive.ts)', () => {
  beforeEach(() => {
    resetAliveForTesting();
  });

  it('first load of a new scene plays', () => {
    const scene = makeScene('1', 'Scene 1');
    expect(shouldPlayAlive(scene)).toBe(true);
    markAlivePlayed(scene);
    expect(shouldPlayAlive(scene)).toBe(false);
  });

  it('calling shouldPlayAlive twice with the same scene has no side effects', () => {
    const scene = makeScene('pure', 'Pure Scene');
    // First query
    const firstCheck = shouldPlayAlive(scene);
    expect(firstCheck).toBe(true);

    // Second query without markAlivePlayed must still return true
    const secondCheck = shouldPlayAlive(scene);
    expect(secondCheck).toBe(true);

    // Third query
    expect(shouldPlayAlive(scene)).toBe(true);
  });

  it('remount with the same scene does not play once marked as played', () => {
    const scene = makeScene('remount', 'Remount Scene');
    expect(shouldPlayAlive(scene)).toBe(true);
    markAlivePlayed(scene);

    // Simulating component remount with exact same scene instance
    expect(shouldPlayAlive(scene)).toBe(false);
  });

  it('a distinct new scene plays even after an earlier scene played', () => {
    const sceneA = makeScene('A', 'Scene A');
    const sceneB = makeScene('B', 'Scene B');

    expect(shouldPlayAlive(sceneA)).toBe(true);
    markAlivePlayed(sceneA);
    expect(shouldPlayAlive(sceneA)).toBe(false);

    // Distinct scene B must play
    expect(shouldPlayAlive(sceneB)).toBe(true);
    markAlivePlayed(sceneB);
    expect(shouldPlayAlive(sceneB)).toBe(false);
  });

  it('return from Correct suppresses alive spark', () => {
    const scene = makeScene('correct', 'Scene Correct');
    markReturningFromCorrect();

    // Query returns false while returning from Correct
    expect(shouldPlayAlive(scene)).toBe(false);

    // Marking as played consumes/clears the return flag
    markAlivePlayed(scene);
    expect(shouldPlayAlive(scene)).toBe(false);

    // A subsequent new scene can play normally
    const nextScene = makeScene('next', 'Next Scene');
    expect(shouldPlayAlive(nextScene)).toBe(true);
  });

  it('calling shouldPlayAlive twice while returning from Correct has no side effects', () => {
    const scene = makeScene('correct-twice', 'Scene Correct');
    markReturningFromCorrect();

    expect(shouldPlayAlive(scene)).toBe(false);
    expect(shouldPlayAlive(scene)).toBe(false);
  });

  it('resetAliveForTesting clears all played scenes and flags', () => {
    const scene = makeScene('reset', 'Scene Reset');
    markAlivePlayed(scene);
    expect(shouldPlayAlive(scene)).toBe(false);

    resetAliveForTesting();
    expect(shouldPlayAlive(scene)).toBe(true);
  });

  it('gracefully handles null and undefined scenes', () => {
    expect(shouldPlayAlive(null)).toBe(false);
    expect(shouldPlayAlive(undefined)).toBe(false);
  });
});
