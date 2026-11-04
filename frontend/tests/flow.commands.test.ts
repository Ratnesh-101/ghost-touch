import { describe, expect, it } from 'vitest';
import { makeViewport } from '../src/core/geometry';
import type { DiagramScene } from '../src/core/scene';
import {
  executeExploreCommand,
  findNearestVertex,
  getCoarsePosition,
  parseExploreCommand,
  type ExploreCommandContext,
} from '../src/flow/commands';

const testScene: DiagramScene = {
  version: 1,
  kind: 'geometry',
  title: 'Right-Angled Triangle ABC',
  points: [
    { id: 'p1', label: 'A', x: 0.2, y: 0.2 },
    { id: 'p2', label: 'B', x: 0.8, y: 0.8 },
    { id: 'p3', label: 'C', x: 0.2, y: 0.8 },
  ],
  segments: [
    { id: 's1', a: 'p1', b: 'p2', label: 'hypotenuse' },
    { id: 's2', a: 'p2', b: 'p3', label: 'base' },
    { id: 's3', a: 'p3', b: 'p1', label: 'height' },
  ],
  facts: ['AB = 10 cm', 'BC = 8 cm', 'AC = 6 cm', 'Angle C = 90 degrees'],
};

const defaultContext: ExploreCommandContext = {
  scene: testScene,
  view: makeViewport(300, 300),
  cursorNorm: { x: 0.21, y: 0.21 }, // near Point A
  lastSpoken: 'Point A',
  currentCornerIndex: 0,
  currentRate: 'normal',
};

describe('parseExploreCommand', () => {
  describe('English commands', () => {
    it('parses "where am I" variants', () => {
      expect(parseExploreCommand('where am I').type).toBe('where_am_i');
      expect(parseExploreCommand('where am i now?').type).toBe('where_am_i');
      expect(parseExploreCommand('my position').type).toBe('where_am_i');
      expect(parseExploreCommand('what is here').type).toBe('where_am_i');
    });

    it('parses "repeat" variants', () => {
      expect(parseExploreCommand('repeat').type).toBe('repeat');
      expect(parseExploreCommand('say again!').type).toBe('repeat');
      expect(parseExploreCommand('what did you say?').type).toBe('repeat');
    });

    it('parses "next corner" variants', () => {
      expect(parseExploreCommand('next corner').type).toBe('next_corner');
      expect(parseExploreCommand('next vertex').type).toBe('next_corner');
      expect(parseExploreCommand('go to next corner').type).toBe('next_corner');
    });

    it('parses "describe" variants', () => {
      expect(parseExploreCommand('describe').type).toBe('describe');
      expect(parseExploreCommand('describe diagram').type).toBe('describe');
      expect(parseExploreCommand('facts').type).toBe('describe');
      expect(parseExploreCommand('what is this?').type).toBe('describe');
    });

    it('parses "help" variants', () => {
      expect(parseExploreCommand('help').type).toBe('help');
      expect(parseExploreCommand('what can I say?').type).toBe('help');
      expect(parseExploreCommand('list commands').type).toBe('help');
    });

    it('parses speech rate commands', () => {
      expect(parseExploreCommand('faster')).toEqual({ type: 'set_rate', rateSetting: 'fast', raw: 'faster' });
      expect(parseExploreCommand('slower')).toEqual({ type: 'set_rate', rateSetting: 'slow', raw: 'slower' });
      expect(parseExploreCommand('normal speed')).toEqual({
        type: 'set_rate',
        rateSetting: 'normal',
        raw: 'normal speed',
      });
    });
  });

  describe('Hindi commands', () => {
    it('parses "कहाँ हूँ मैं" (where am I)', () => {
      expect(parseExploreCommand('कहाँ हूँ मैं').type).toBe('where_am_i');
      expect(parseExploreCommand('मैं कहाँ हूँ?').type).toBe('where_am_i');
      expect(parseExploreCommand('मेरी स्थिति').type).toBe('where_am_i');
    });

    it('parses "दोहराएं" (repeat)', () => {
      expect(parseExploreCommand('दोहराएं').type).toBe('repeat');
      expect(parseExploreCommand('फिर से बोलो').type).toBe('repeat');
      expect(parseExploreCommand('क्या कहा?').type).toBe('repeat');
    });

    it('parses "अगला कोना" (next corner)', () => {
      expect(parseExploreCommand('अगला कोना').type).toBe('next_corner');
      expect(parseExploreCommand('अगला शीर्ष').type).toBe('next_corner');
      expect(parseExploreCommand('कोना').type).toBe('next_corner');
    });

    it('parses "वर्णन करें" (describe)', () => {
      expect(parseExploreCommand('वर्णन करें').type).toBe('describe');
      expect(parseExploreCommand('चित्र का वर्णन').type).toBe('describe');
      expect(parseExploreCommand('तथ्य').type).toBe('describe');
    });

    it('parses "मदद" (help)', () => {
      expect(parseExploreCommand('मदद').type).toBe('help');
      expect(parseExploreCommand('सहायता').type).toBe('help');
      expect(parseExploreCommand('मैं क्या बोल सकता हूँ').type).toBe('help');
    });

    it('parses speech rate in Hindi', () => {
      expect(parseExploreCommand('तेज़').type).toBe('set_rate');
      expect(parseExploreCommand('धीमा').type).toBe('set_rate');
      expect(parseExploreCommand('सामान्य गति').type).toBe('set_rate');
    });
  });

  describe('Gujarati commands', () => {
    it('parses "હું ક્યાં છું" (where am I)', () => {
      expect(parseExploreCommand('હું ક્યાં છું').type).toBe('where_am_i');
      expect(parseExploreCommand('ક્યાં છું?').type).toBe('where_am_i');
      expect(parseExploreCommand('મારી જગ્યા').type).toBe('where_am_i');
    });

    it('parses "ફરી બોલો" (repeat)', () => {
      expect(parseExploreCommand('ફરી બોલો').type).toBe('repeat');
      expect(parseExploreCommand('ફરીથી બોલો').type).toBe('repeat');
      expect(parseExploreCommand('દોહરાવો').type).toBe('repeat');
    });

    it('parses "આગળનો ખૂણો" (next corner)', () => {
      expect(parseExploreCommand('આગળનો ખૂણો').type).toBe('next_corner');
      expect(parseExploreCommand('ખૂણો').type).toBe('next_corner');
    });

    it('parses "વર્ણન કરો" (describe)', () => {
      expect(parseExploreCommand('વર્ણન કરો').type).toBe('describe');
      expect(parseExploreCommand('આ શું છે?').type).toBe('describe');
    });

    it('parses "મદદ" (help)', () => {
      expect(parseExploreCommand('મદદ').type).toBe('help');
      expect(parseExploreCommand('સહાય').type).toBe('help');
    });

    it('parses speech rate in Gujarati', () => {
      expect(parseExploreCommand('ઝડપી').type).toBe('set_rate');
      expect(parseExploreCommand('ધીમું').type).toBe('set_rate');
      expect(parseExploreCommand('સામાન્ય ગતિ').type).toBe('set_rate');
    });
  });

  it('marks unrecognised phrases as unknown', () => {
    expect(parseExploreCommand('what is the formula for area of circle?').type).toBe('unknown');
    expect(parseExploreCommand('calculate sine of 45 degrees').type).toBe('unknown');
  });
});

describe('getCoarsePosition', () => {
  it('identifies centre', () => {
    expect(getCoarsePosition({ x: 0.5, y: 0.5 })).toBe('centre');
    expect(getCoarsePosition({ x: 0.4, y: 0.6 })).toBe('centre');
  });

  it('identifies corners', () => {
    expect(getCoarsePosition({ x: 0.1, y: 0.1 })).toBe('top left');
    expect(getCoarsePosition({ x: 0.9, y: 0.1 })).toBe('top right');
    expect(getCoarsePosition({ x: 0.1, y: 0.9 })).toBe('bottom left');
    expect(getCoarsePosition({ x: 0.9, y: 0.9 })).toBe('bottom right');
  });

  it('identifies edges', () => {
    expect(getCoarsePosition({ x: 0.5, y: 0.1 })).toBe('top');
    expect(getCoarsePosition({ x: 0.5, y: 0.9 })).toBe('bottom');
    expect(getCoarsePosition({ x: 0.1, y: 0.5 })).toBe('left');
    expect(getCoarsePosition({ x: 0.9, y: 0.5 })).toBe('right');
  });
});

describe('findNearestVertex', () => {
  it('returns closest point from the scene', () => {
    const nearest = findNearestVertex(testScene.points, { x: 0.22, y: 0.22 });
    expect(nearest?.point.id).toBe('p1');
    expect(nearest?.point.label).toBe('A');
  });
});

describe('executeExploreCommand', () => {
  it('executes "where am I" near a vertex', () => {
    const res = executeExploreCommand({ type: 'where_am_i', raw: 'where am I' }, defaultContext);
    expect(res.speech).toContain('Point A');
    expect(res.speech).toContain('top left');
    expect(res.earcon).toBe('success');
  });

  it('executes "where am I" in open space', () => {
    const contextInEmptySpace: ExploreCommandContext = {
      ...defaultContext,
      cursorNorm: { x: 0.5, y: 0.5 },
    };
    const res = executeExploreCommand({ type: 'where_am_i', raw: 'where am I' }, contextInEmptySpace);
    expect(res.speech).toContain('open space');
    expect(res.speech).toContain('centre');
    expect(res.earcon).toBe('success');
  });

  it('executes "repeat"', () => {
    const res = executeExploreCommand({ type: 'repeat', raw: 'repeat' }, defaultContext);
    expect(res.speech).toBe('Point A');
  });

  it('executes "next_corner" and updates cursor and index', () => {
    // Current corner index 0 (p1 = A). Next is index 1 (p2 = B, at 0.8, 0.8)
    const res = executeExploreCommand({ type: 'next_corner', raw: 'next corner' }, defaultContext);
    expect(res.nextCornerIndex).toBe(1);
    expect(res.speech).toContain('Corner 2 of 3');
    expect(res.speech).toContain('Point B');
    expect(res.speech).toContain('bottom right');
    expect(res.nextCursor).toBeDefined();
    expect(res.earcon).toBe('success');
  });

  it('executes "describe" reading title and facts', () => {
    const res = executeExploreCommand({ type: 'describe', raw: 'describe' }, defaultContext);
    expect(res.speech).toContain('Right-Angled Triangle ABC');
    expect(res.speech).toContain('AB = 10 cm');
    expect(res.speech).toContain('Angle C = 90 degrees');
    expect(res.earcon).toBe('success');
  });

  it('executes "help" listing available commands', () => {
    const res = executeExploreCommand({ type: 'help', raw: 'help' }, defaultContext);
    expect(res.speech).toContain('where am I');
    expect(res.speech).toContain('repeat');
    expect(res.speech).toContain('next corner');
    expect(res.speech).toContain('describe');
    expect(res.earcon).toBe('success');
  });

  it('executes "set_rate" updating rate and speaking confirmation', () => {
    const res = executeExploreCommand(
      { type: 'set_rate', rateSetting: 'fast', raw: 'faster' },
      defaultContext,
    );
    expect(res.nextRate).toBe('fast');
    expect(res.speech).toBe('Speech rate set to fast.');
    expect(res.earcon).toBe('success');
  });
});
