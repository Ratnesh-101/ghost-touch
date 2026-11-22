/**
 * Task 85 (Requirement 45.6, design.md P169): the walk phrases in the voice command table.
 *
 * `parseExploreCommand` has no walk command yet. The positive rows are `it.fails` until the agy lane
 * (85b) adds `walk_start` and `walk_next` to `flow/commands.ts`; that lane removes `.fails`. The
 * negative rows pass today and must keep passing: a sentence that merely contains the phrase, and
 * fragments of it, are never walk commands.
 *
 * Only the English phrases are pinned here. The Hindi and Gujarati listed forms are the lane's
 * (native review pending); the pure matcher, `walkCommandOf` in `core/walk.ts`, takes the phrase
 * lists as arguments and is covered by P169.
 */
import { describe, expect, it } from 'vitest';
import { parseExploreCommand } from '../src/flow/commands';

const type = (s: string): string => parseExploreCommand(s).type as string;

describe('task 85: walk phrases in the command table (Requirement 45.6)', () => {
  // Fail today: the command types do not exist, so "walk me through" is `unknown`.
  it.fails('"walk me through" starts a walk, in any case, with punctuation', () => {
    expect(type('walk me through')).toBe('walk_start');
    expect(type('Walk me through.')).toBe('walk_start');
    expect(type('  WALK   ME  THROUGH! ')).toBe('walk_start');
  });

  it.fails('"next step" moves a walk on', () => {
    expect(type('next step')).toBe('walk_next');
    expect(type('Next step.')).toBe('walk_next');
  });

  it('a sentence that contains the phrase is not a walk command', () => {
    for (const s of [
      'Can you walk me through the proof for AB?',
      'walk me through why AB is five',
      'please walk me through it',
      'what is the next step in the proof',
      'show me the next step of the walk',
    ]) {
      expect(type(s), s).not.toBe('walk_start');
      expect(type(s), s).not.toBe('walk_next');
    }
  });

  it('a fragment of a phrase is not a walk command; "next" alone keeps its old meaning', () => {
    for (const s of ['walk', 'walk through', 'walk me', 'step', 'next steps']) {
      expect(type(s), s).not.toBe('walk_start');
      expect(type(s), s).not.toBe('walk_next');
    }
    expect(type('next')).not.toBe('walk_next');
    expect(type('next corner')).toBe('next_corner');
  });
});
