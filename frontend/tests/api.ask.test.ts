import { describe, expect, it, vi } from 'vitest';
import {
  ASK_TIMEOUT_MS,
  AskRequestError,
  parseAskResponse,
  requestAsk,
  type AskResponse,
} from '../src/api/ask';
import type { DiagramScene } from '../src/core/scene';

const sampleScene: DiagramScene = {
  kind: 'geometry',
  title: 'Right Triangle',
  points: [
    { id: 'A', x: 0.2, y: 0.2, label: 'Point A' },
    { id: 'B', x: 0.2, y: 0.8, label: 'Point B' },
    { id: 'C', x: 0.8, y: 0.8, label: 'Point C' },
  ],
  segments: [
    { id: 'AB', a: 'A', b: 'B' },
    { id: 'BC', a: 'B', b: 'C' },
    { id: 'AC', a: 'A', b: 'C' },
  ],
  facts: ['AB = 3 cm', 'BC = 4 cm', 'AC = 5 cm'],
};

describe('parseAskResponse', () => {
  it('parses valid responses for each source kind', () => {
    const aiResp: AskResponse = parseAskResponse({ answer: 'AC is 5 cm.', source: 'ai' });
    expect(aiResp).toEqual({ answer: 'AC is 5 cm.', source: 'ai' });

    const factsResp: AskResponse = parseAskResponse({ answer: 'AB = 3 cm.', source: 'facts' });
    expect(factsResp).toEqual({ answer: 'AB = 3 cm.', source: 'facts' });

    const unknownResp: AskResponse = parseAskResponse({
      answer: "I don't know from this diagram.",
      source: 'unknown',
    });
    expect(unknownResp).toEqual({
      answer: "I don't know from this diagram.",
      source: 'unknown',
    });
  });

  it('rejects null, non-objects, arrays, and bad fields', () => {
    expect(() => parseAskResponse(null)).toThrow(AskRequestError);
    expect(() => parseAskResponse('string')).toThrow(AskRequestError);
    expect(() => parseAskResponse([])).toThrow(AskRequestError);
    expect(() => parseAskResponse({ answer: 123, source: 'ai' })).toThrow(AskRequestError);
    expect(() => parseAskResponse({ answer: 'ok', source: 'other' })).toThrow(AskRequestError);
    expect(() => parseAskResponse({})).toThrow(AskRequestError);
  });
});

describe('requestAsk', () => {
  it('sends POST /api/v1/ask with scene, trimmed question and lang, returning parsed response', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: unknown;

    const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedMethod = init?.method ?? '';
      capturedHeaders = (init?.headers as Record<string, string>) ?? {};
      capturedBody = JSON.parse(init?.body as string);

      return new Response(
        JSON.stringify({
          answer: 'The length of AC is 5 cm.',
          source: 'facts',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const res = await requestAsk(sampleScene, '  How long is AC?  ', 'en-IN', {
      baseUrl: 'https://api.example.com',
      fetchImpl: fakeFetch,
    });

    expect(capturedUrl).toBe('https://api.example.com/api/v1/ask');
    expect(capturedMethod).toBe('POST');
    expect(capturedHeaders['Content-Type']).toBe('application/json');
    expect(capturedBody).toEqual({
      scene: sampleScene,
      question: 'How long is AC?',
      lang: 'en-IN',
    });
    expect(res).toEqual({
      answer: 'The length of AC is 5 cm.',
      source: 'facts',
    });
  });

  it('throws AskRequestError("http") on non-200 responses', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Unprocessable Entity' }), { status: 422 });
    });

    await expect(
      requestAsk(sampleScene, 'Question', 'en', {
        baseUrl: 'https://api.example.com',
        fetchImpl: fakeFetch,
      }),
    ).rejects.toMatchObject({
      name: 'AskRequestError',
      failure: 'http',
    });
  });

  it('throws AskRequestError("bad-response") on malformed JSON', async () => {
    const fakeFetch = vi.fn(async () => {
      return new Response('Not JSON', { status: 200 });
    });

    await expect(
      requestAsk(sampleScene, 'Question', 'en', {
        baseUrl: 'https://api.example.com',
        fetchImpl: fakeFetch,
      }),
    ).rejects.toMatchObject({
      name: 'AskRequestError',
      failure: 'bad-response',
    });
  });

  it('throws AskRequestError("timeout") when request exceeds timeoutMs', async () => {
    const fakeFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await expect(
      requestAsk(sampleScene, 'Question', 'en', {
        timeoutMs: 20,
        fetchImpl: fakeFetch,
      }),
    ).rejects.toMatchObject({
      name: 'AskRequestError',
      failure: 'timeout',
    });
  });

  it('throws AskRequestError("aborted") when external signal is aborted', async () => {
    const controller = new AbortController();
    const fakeFetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const promise = requestAsk(sampleScene, 'Question', 'en', {
      signal: controller.signal,
      fetchImpl: fakeFetch,
    });
    controller.abort();

    await expect(promise).rejects.toMatchObject({
      name: 'AskRequestError',
      failure: 'aborted',
    });
  });

  it('throws AskRequestError("network") on network failures', async () => {
    const fakeFetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      requestAsk(sampleScene, 'Question', 'en', {
        fetchImpl: fakeFetch,
      }),
    ).rejects.toMatchObject({
      name: 'AskRequestError',
      failure: 'network',
    });
  });

  it('exports ASK_TIMEOUT_MS as 12000 ms', () => {
    expect(ASK_TIMEOUT_MS).toBe(12_000);
  });
});
