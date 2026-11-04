import { describe, expect, it, vi } from 'vitest';
import {
  parseValidateResponse,
  requestValidate,
  ValidateRequestError,
  type ValidateResponse,
} from '../src/api/validate';
import type { DiagramScene } from '../src/core/scene';

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Test Triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.2, label: 'Point A' },
    { id: 'B', x: 0.2, y: 0.8, label: 'Point B' },
  ],
  segments: [{ id: 'AB', a: 'A', b: 'B' }],
};

describe('parseValidateResponse', () => {
  it('parses valid response with ok: true', () => {
    const raw = {
      ok: true,
      scene: sampleScene,
      errors: [],
    };
    const parsed = parseValidateResponse(raw);
    expect(parsed).toEqual({
      ok: true,
      scene: sampleScene,
      errors: [],
    });
  });

  it('parses valid response with ok: false and error messages', () => {
    const raw = {
      ok: false,
      scene: null,
      errors: ['Dangling segment reference: endpoint C not found'],
    };
    const parsed = parseValidateResponse(raw);
    expect(parsed).toEqual({
      ok: false,
      scene: null,
      errors: ['Dangling segment reference: endpoint C not found'],
    });
  });

  it('rejects invalid responses (non-objects, missing ok, bad errors array)', () => {
    expect(() => parseValidateResponse(null)).toThrow(ValidateRequestError);
    expect(() => parseValidateResponse('bad')).toThrow(ValidateRequestError);
    expect(() => parseValidateResponse([])).toThrow(ValidateRequestError);
    expect(() => parseValidateResponse({ ok: 'not-bool', errors: [] })).toThrow(ValidateRequestError);
    expect(() => parseValidateResponse({ ok: true, errors: [123] })).toThrow(ValidateRequestError);
    expect(() => parseValidateResponse({ ok: true })).toThrow(ValidateRequestError);
    expect(() => parseValidateResponse({ ok: true, errors: [], scene: 'not-an-object' })).toThrow(
      ValidateRequestError,
    );
  });
});

describe('requestValidate', () => {
  it('sends POST /api/v1/validate with { scene } body', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: unknown;

    const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedMethod = init?.method ?? '';
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      capturedBody = JSON.parse(init?.body as string);

      const resp: ValidateResponse = {
        ok: true,
        scene: sampleScene,
        errors: [],
      };
      return new Response(JSON.stringify(resp), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const res = await requestValidate(sampleScene, {
      baseUrl: 'https://api.example.com',
      fetchImpl: fakeFetch,
    });

    expect(capturedUrl).toBe('https://api.example.com/api/v1/validate');
    expect(capturedMethod).toBe('POST');
    expect(capturedHeaders['Content-Type']).toBe('application/json');
    expect(capturedBody).toEqual({ scene: sampleScene });
    expect(res.ok).toBe(true);
    expect(res.scene).toEqual(sampleScene);
    expect(res.errors).toEqual([]);
  });

  it('throws ValidateRequestError("http") on non-200 responses', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Server Error' }), { status: 500 });
    });

    await expect(
      requestValidate(sampleScene, {
        baseUrl: 'https://api.example.com',
        fetchImpl: fakeFetch,
      }),
    ).rejects.toThrow(ValidateRequestError);
  });

  it('throws ValidateRequestError("network") on network failures', async () => {
    const fakeFetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      requestValidate(sampleScene, {
        baseUrl: 'https://api.example.com',
        fetchImpl: fakeFetch,
      }),
    ).rejects.toThrow(ValidateRequestError);
  });

  it('throws ValidateRequestError("aborted") when signal aborts', async () => {
    const controller = new AbortController();
    const fakeFetch = vi.fn(async () => {
      controller.abort();
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });

    await expect(
      requestValidate(sampleScene, {
        baseUrl: 'https://api.example.com',
        signal: controller.signal,
        fetchImpl: fakeFetch,
      }),
    ).rejects.toThrow(ValidateRequestError);
  });
});
