import { describe, expect, it } from 'vitest';
import {
  asScene,
  loadSample,
  parseSceneResponse,
  requestScene,
  SAMPLE_IDS,
  SceneRequestError,
  type SampleId,
} from '../src/api/scene';
import type { DiagramScene } from '../src/core/scene';
import { isRenderableScene, SCENE_GUARD_LIMITS } from '../src/core/sceneGuard';
import sampleBars from '../public/samples/barchart.json';
import sampleSine from '../public/samples/sine.json';
import sampleTriangle from '../public/samples/triangle.json';

const sampleMap: Record<SampleId, unknown> = {
  triangle: sampleTriangle,
  sine: sampleSine,
  barchart: sampleBars,
};

function createSampleFetch(overrides?: Partial<Record<SampleId, unknown>>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const id of SAMPLE_IDS) {
      if (url.includes(`/samples/${id}.json`)) {
        const data = overrides && id in overrides ? overrides[id] : sampleMap[id];
        return {
          ok: true,
          status: 200,
          json: async () => data,
        } as unknown as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'Not found' }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function make500PointScene(): DiagramScene {
  const points = Array.from({ length: 500 }, (_, i) => ({
    id: `p${i}`,
    x: Number((i / 500).toFixed(4)),
    y: Number(((i % 100) / 100).toFixed(4)),
    label: `P${i}`,
  }));
  return {
    version: 1,
    kind: 'geometry',
    title: 'Valid 500-point raw diagram',
    points,
    segments: [],
    polylines: [],
    bars: [],
  };
}

describe('hx6: scene ingress guard wiring', () => {
  describe('malformed response rejection ("bad-response")', () => {
    it('throws SceneRequestError("bad-response") when scene lacks "points"', () => {
      const responseWithoutPoints = {
        mode: 'ai',
        scene: {
          kind: 'geometry',
          segments: [],
          polylines: [],
          bars: [],
        },
      };

      expect(() => parseSceneResponse(responseWithoutPoints)).toThrow(SceneRequestError);
      try {
        parseSceneResponse(responseWithoutPoints);
        expect.unreachable('Should have thrown SceneRequestError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneRequestError);
        expect((err as SceneRequestError).failure).toBe('bad-response');
      }
    });

    it('throws SceneRequestError("bad-response") when point has NaN for x coordinate', () => {
      const responseWithNanX = {
        mode: 'raw',
        scene: {
          kind: 'geometry',
          points: [{ id: 'p0', x: NaN, y: 0.5 }],
          segments: [],
          polylines: [],
          bars: [],
        },
      };

      expect(() => parseSceneResponse(responseWithNanX)).toThrow(SceneRequestError);
      try {
        parseSceneResponse(responseWithNanX);
        expect.unreachable('Should have thrown SceneRequestError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneRequestError);
        expect((err as SceneRequestError).failure).toBe('bad-response');
      }
    });

    it('throws SceneRequestError("bad-response") when point has NaN for y coordinate', () => {
      const responseWithNanY = {
        mode: 'ai',
        scene: {
          kind: 'geometry',
          points: [{ id: 'p0', x: 0.5, y: NaN }],
          segments: [],
          polylines: [],
          bars: [],
        },
      };

      expect(() => parseSceneResponse(responseWithNanY)).toThrow(SceneRequestError);
      try {
        parseSceneResponse(responseWithNanY);
        expect.unreachable('Should have thrown SceneRequestError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneRequestError);
        expect((err as SceneRequestError).failure).toBe('bad-response');
      }
    });

    it('throws SceneRequestError("bad-response") when segment refers to a missing point', () => {
      const responseWithDanglingSegment = {
        mode: 'ai',
        scene: {
          kind: 'geometry',
          points: [
            { id: 'p0', x: 0.1, y: 0.1 },
            { id: 'p1', x: 0.9, y: 0.9 },
          ],
          segments: [
            { id: 's0', a: 'p0', b: 'p1' },
            { id: 's1', a: 'p1', b: 'missing-point-id' },
          ],
          polylines: [],
          bars: [],
        },
      };

      expect(() => parseSceneResponse(responseWithDanglingSegment)).toThrow(SceneRequestError);
      try {
        parseSceneResponse(responseWithDanglingSegment);
        expect.unreachable('Should have thrown SceneRequestError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneRequestError);
        expect((err as SceneRequestError).failure).toBe('bad-response');
      }
    });

    it('requestScene rejects with SceneRequestError("bad-response") on ingress violation', async () => {
      const fakeImage = new Blob(['sample-image-data'], { type: 'image/jpeg' });

      // Lacks points
      await expect(
        requestScene(fakeImage, {
          baseUrl: 'http://127.0.0.1:8000',
          fetchImpl: ((async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              mode: 'ai',
              scene: { kind: 'geometry', segments: [], polylines: [], bars: [] },
            }),
          })) as unknown) as typeof fetch,
        }),
      ).rejects.toMatchObject({ failure: 'bad-response' });

      // NaN coordinate
      await expect(
        requestScene(fakeImage, {
          baseUrl: 'http://127.0.0.1:8000',
          fetchImpl: ((async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              mode: 'raw',
              scene: {
                kind: 'geometry',
                points: [{ id: 'p0', x: NaN, y: 0.5 }],
                segments: [],
                polylines: [],
                bars: [],
              },
            }),
          })) as unknown) as typeof fetch,
        }),
      ).rejects.toMatchObject({ failure: 'bad-response' });

      // Segment to missing point
      await expect(
        requestScene(fakeImage, {
          baseUrl: 'http://127.0.0.1:8000',
          fetchImpl: ((async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              mode: 'ai',
              scene: {
                kind: 'geometry',
                points: [{ id: 'p0', x: 0.1, y: 0.1 }],
                segments: [{ id: 's0', a: 'p0', b: 'non-existent' }],
                polylines: [],
                bars: [],
              },
            }),
          })) as unknown) as typeof fetch,
        }),
      ).rejects.toMatchObject({ failure: 'bad-response' });
    });
  });

  describe('sample files in frontend/public/samples', () => {
    it('reads all three sample files from disk and verifies they are accepted by isRenderableScene', () => {
      for (const id of SAMPLE_IDS) {
        const json = sampleMap[id];
        expect(isRenderableScene(json), `public/samples/${id}.json must be renderable`).toBe(true);
        expect(asScene(json)).toBeDefined();
      }
    });

    it('loads triangle, sine, and barchart via loadSample', async () => {
      const fetchImpl = createSampleFetch();

      for (const id of SAMPLE_IDS) {
        const scene = await loadSample(id, fetchImpl);
        expect(scene).toBeDefined();
        expect(isRenderableScene(scene)).toBe(true);
        expect(scene.kind).toBeDefined();
        expect(Array.isArray(scene.points)).toBe(true);
        expect(Array.isArray(scene.segments)).toBe(true);
        expect(Array.isArray(scene.polylines)).toBe(true);
        expect(Array.isArray(scene.bars)).toBe(true);
      }
    });

    it('loadSample throws SceneRequestError("bad-response") when fetched sample data is corrupted', async () => {
      const corruptFetch = createSampleFetch({
        triangle: { kind: 'geometry' }, // missing required points/segments/polylines/bars
      });

      await expect(loadSample('triangle', corruptFetch)).rejects.toMatchObject({
        failure: 'bad-response',
      });
    });

    it('loadSample throws SceneRequestError("bad-response") on JSON parse failure', async () => {
      const invalidJsonFetch = ((async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        },
      })) as unknown) as typeof fetch;

      await expect(loadSample('triangle', invalidJsonFetch)).rejects.toMatchObject({
        failure: 'bad-response',
      });
    });
  });

  describe('valid 500-point raw scene and limit enforcement', () => {
    it('accepts a valid 500-point raw scene', () => {
      const rawScene = make500PointScene();
      expect(rawScene.points!.length).toBe(SCENE_GUARD_LIMITS.points);
      expect(isRenderableScene(rawScene)).toBe(true);

      const asSceneResult = asScene(rawScene);
      expect(asSceneResult).toBeDefined();
      expect(asSceneResult!.points!.length).toBe(500);

      const response = {
        mode: 'raw' as const,
        scene: rawScene,
      };
      const parsed = parseSceneResponse(response);
      expect(parsed.mode).toBe('raw');
      expect(parsed.scene.points!.length).toBe(500);
      expect(parsed.scene.title).toBe('Valid 500-point raw diagram');
    });

    it('rejects a scene with 501 points exceeding the limit', () => {
      const points501 = Array.from({ length: 501 }, (_, i) => ({
        id: `p${i}`,
        x: Number((i / 501).toFixed(4)),
        y: 0.5,
      }));
      const scene501 = {
        version: 1,
        kind: 'geometry' as const,
        points: points501,
        segments: [],
        polylines: [],
        bars: [],
      };

      expect(isRenderableScene(scene501)).toBe(false);
      expect(asScene(scene501)).toBeUndefined();
      expect(() => parseSceneResponse({ mode: 'raw', scene: scene501 })).toThrow(
        SceneRequestError,
      );
      try {
        parseSceneResponse({ mode: 'raw', scene: scene501 });
        expect.unreachable('Should have thrown SceneRequestError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneRequestError);
        expect((err as SceneRequestError).failure).toBe('bad-response');
      }
    });

    it('rejects a 500-point scene if any coordinate is invalid (out of [0, 1] range or NaN)', () => {
      const scene = make500PointScene();
      // corrupt point 250 with coordinate > 1
      scene.points![250]!.x = 1.05;

      expect(isRenderableScene(scene)).toBe(false);
      expect(asScene(scene)).toBeUndefined();
      expect(() => parseSceneResponse({ mode: 'raw', scene })).toThrow(SceneRequestError);
      try {
        parseSceneResponse({ mode: 'raw', scene });
        expect.unreachable('Should have thrown SceneRequestError');
      } catch (err) {
        expect(err).toBeInstanceOf(SceneRequestError);
        expect((err as SceneRequestError).failure).toBe('bad-response');
      }
    });
  });

  describe('asScene helper behavior', () => {
    it('returns the diagram scene when valid', () => {
      const validScene: DiagramScene = {
        version: 1,
        kind: 'geometry',
        points: [{ id: 'p0', x: 0.5, y: 0.5 }],
        segments: [],
        polylines: [],
        bars: [],
      };
      expect(asScene(validScene)).toEqual(validScene);
    });

    it('returns undefined for non-objects or invalid shapes', () => {
      expect(asScene(null)).toBeUndefined();
      expect(asScene(undefined)).toBeUndefined();
      expect(asScene('a string')).toBeUndefined();
      expect(asScene(123)).toBeUndefined();
      expect(asScene([])).toBeUndefined();
      expect(asScene({})).toBeUndefined();
      expect(asScene({ kind: 'invalid_kind', points: [], segments: [], polylines: [], bars: [] })).toBeUndefined();
    });
  });
});
