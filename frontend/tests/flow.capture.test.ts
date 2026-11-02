import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneResponse } from '../src/api/scene';
import {
  PROGRESS_BEEP_HZ,
  PROGRESS_BEEP_MS,
  PROGRESS_INTERVAL_MS,
  pdfErrorMessage,
  processImageFile,
  rejectionMessage,
  startProgressTone,
} from '../src/flow/capture';
import { exploreAnnouncement, sceneName } from '../src/flow/navigation';
import { PdfError } from '../src/drivers/pdf';
import { t } from '../src/i18n';

const response: SceneResponse = { scene: { kind: 'geometry', title: 'Right triangle' }, mode: 'ai' };

function jpeg(size = 1000, type = 'image/jpeg'): Blob & { type: string; size: number } {
  return new Blob([new Uint8Array(size)], { type });
}

function setup() {
  const audio = { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), state: 'running' };
  const said: string[] = [];
  const controller = new AbortController();
  return { audio, said, controller, say: (text: string) => void said.push(text) };
}

describe('startProgressTone', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('beeps softly every 1.5 s and stops when told to', () => {
    const { audio } = setup();
    const stop = startProgressTone(audio);
    vi.advanceTimersByTime(PROGRESS_INTERVAL_MS * 3);
    expect(audio.beep).toHaveBeenCalledTimes(3);
    expect(audio.beep).toHaveBeenCalledWith(PROGRESS_BEEP_HZ, PROGRESS_BEEP_MS);
    expect(PROGRESS_INTERVAL_MS).toBe(1500);
    stop();
    vi.advanceTimersByTime(PROGRESS_INTERVAL_MS * 3);
    expect(audio.beep).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('processImageFile', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('accepts a chosen PDF, speaks first-page line, prepares with PDF renderer and uploads', async () => {
    const { audio, say, said, controller } = setup();
    const renderedImage = jpeg(500, 'image/jpeg');
    const renderPdf = vi.fn().mockResolvedValue(renderedImage);
    const request = vi.fn().mockResolvedValue(response);
    const outcome = await processImageFile(jpeg(1000, 'application/pdf'), {
      audio,
      say,
      renderPdf,
      request,
      signal: controller.signal,
      source: 'file',
    });
    expect(outcome).toEqual({ kind: 'scene', response });
    expect(said).toEqual([`${t('capture.firstPagePdf')} ${t('capture.reading')}`]);
    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(renderedImage, controller.signal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('accepts a file with empty MIME type and .pdf extension, routes to PDF renderer', async () => {
    const { audio, say, said, controller } = setup();
    const renderedImage = jpeg(500, 'image/jpeg');
    const renderPdf = vi.fn().mockResolvedValue(renderedImage);
    const request = vi.fn().mockResolvedValue(response);

    const pdfFile = new File([new Uint8Array(1000)], 'test-diagram.pdf', { type: '' });

    const outcome = await processImageFile(pdfFile, {
      audio,
      say,
      renderPdf,
      request,
      signal: controller.signal,
      source: 'file',
    });

    expect(outcome).toEqual({ kind: 'scene', response });
    expect(said).toEqual([`${t('capture.firstPagePdf')} ${t('capture.reading')}`]);
    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(renderedImage, controller.signal);
  });

  it('handles PDF errors (password, invalid, empty, timeout) with distinct spoken messages', async () => {
    for (const reason of ['password', 'invalid', 'empty', 'timeout'] as const) {
      const { audio, say, said, controller } = setup();
      const renderPdf = vi.fn().mockRejectedValue(new PdfError(reason));
      const request = vi.fn();
      const outcome = await processImageFile(jpeg(1000, 'application/pdf'), {
        audio,
        say,
        renderPdf,
        request,
        signal: controller.signal,
      });
      expect(outcome.kind).toBe('failed');
      expect(said[0]).toBe(`${t('capture.firstPagePdf')} ${t('capture.reading')}`);
      expect(said[1]).toBe(pdfErrorMessage(reason));
      expect(request).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it('rejects a PDF with its own message when received from camera source', async () => {
    const { audio, say, said, controller } = setup();
    const prepare = vi.fn();
    const request = vi.fn();
    const outcome = await processImageFile(jpeg(1000, 'application/pdf'), {
      audio,
      say,
      prepare,
      request,
      signal: controller.signal,
      source: 'camera',
    });
    expect(outcome.kind).toBe('rejected');
    expect(said).toEqual([t('capture.errorPdf')]);
    expect(prepare).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an unsupported type and an oversize file with a spoken reason', async () => {
    const { audio, say, said, controller } = setup();
    const deps = { audio, say, prepare: vi.fn(), request: vi.fn(), signal: controller.signal };
    await processImageFile(jpeg(1000, 'image/gif'), deps);
    await processImageFile(jpeg(10 * 1024 * 1024 + 1, 'image/png'), deps);
    expect(said).toEqual([rejectionMessage('type'), rejectionMessage('size')]);
    expect(said[1]).toBe('That file is too large. Maximum is 10 megabytes.');
    expect(deps.request).not.toHaveBeenCalled();
  });

  it('accepts an 11 MB camera photo (it is shrunk before upload) but not an 11 MB chosen file', async () => {
    const big = jpeg(11 * 1024 * 1024);
    const camera = setup();
    const cameraOutcome = await processImageFile(big, {
      audio: camera.audio,
      say: camera.say,
      source: 'camera',
      prepare: (file) => Promise.resolve(file),
      request: () => Promise.resolve(response),
      signal: camera.controller.signal,
    });
    expect(cameraOutcome.kind).toBe('scene');
    const chosen = setup();
    const chosenOutcome = await processImageFile(big, {
      audio: chosen.audio,
      say: chosen.say,
      source: 'file',
      prepare: vi.fn(),
      request: vi.fn(),
      signal: chosen.controller.signal,
    });
    expect(chosenOutcome.kind).toBe('rejected');
    expect(chosen.said).toEqual(['That file is too large. Maximum is 10 megabytes.']);
  });

  it('says a camera photo that is far too large cannot be opened, without quoting 10 MB', async () => {
    const { audio, say, said, controller } = setup();
    await processImageFile(jpeg(51 * 1024 * 1024), {
      audio, say, source: 'camera', prepare: vi.fn(), request: vi.fn(), signal: controller.signal,
    });
    expect(said).toEqual([rejectionMessage('size', 'camera')]);
    expect(said[0]).not.toContain('10 megabytes');
  });

  it('says "Reading your diagram", beeps while waiting, then stops all timers on success', async () => {
    const { audio, say, said, controller } = setup();
    let finish: (value: SceneResponse) => void = () => undefined;
    const request = vi.fn().mockReturnValue(new Promise<SceneResponse>((resolve) => (finish = resolve)));
    const pending = processImageFile(jpeg(), {
      audio, say, prepare: (file) => Promise.resolve(file), request, signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(PROGRESS_INTERVAL_MS * 2 + 10);
    expect(said).toEqual(['Reading your diagram']);
    expect(audio.beep).toHaveBeenCalledTimes(2);
    finish(response);
    const outcome = await pending;
    expect(outcome).toEqual({ kind: 'scene', response });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(PROGRESS_INTERVAL_MS * 3);
    expect(audio.beep).toHaveBeenCalledTimes(2);
  });

  it('speaks the error, stops the timer, and reports failure when the upload fails', async () => {
    const { audio, say, said, controller } = setup();
    const request = vi.fn().mockRejectedValue(new Error('network'));
    const outcome = await processImageFile(jpeg(), {
      audio, say, prepare: (file) => Promise.resolve(file), request, signal: controller.signal,
    });
    expect(outcome.kind).toBe('failed');
    expect(said).toEqual(['Reading your diagram', 'Something went wrong. Please try again, or pick a sample.']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('speaks the error when the image cannot be prepared', async () => {
    const { audio, say, said, controller } = setup();
    const outcome = await processImageFile(jpeg(), {
      audio, say, prepare: () => Promise.reject(new Error('decode')), request: vi.fn(), signal: controller.signal,
    });
    expect(outcome.kind).toBe('failed');
    expect(said.at(-1)).toBe(t('capture.error'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('on unmount (abort) stops the timer and stays silent', async () => {
    const { audio, say, said, controller } = setup();
    const request = vi.fn().mockImplementation(
      (_image: Blob, signal: AbortSignal) =>
        new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
    );
    const pending = processImageFile(jpeg(), {
      audio, say, prepare: (file) => Promise.resolve(file), request, signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(PROGRESS_INTERVAL_MS + 10);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    controller.abort();
    const outcome = await pending;
    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(said).toEqual(['Reading your diagram']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes a raw-mode response through unchanged', async () => {
    const { audio, say, controller } = setup();
    const raw: SceneResponse = { scene: { kind: 'unknown' }, mode: 'raw', reason: 'invalid' };
    const outcome = await processImageFile(jpeg(), {
      audio, say, prepare: (file) => Promise.resolve(file), request: () => Promise.resolve(raw), signal: controller.signal,
    });
    expect(outcome).toEqual({ kind: 'scene', response: raw });
  });
});

describe('Explore announcements', () => {
  it('starts a raw-mode announcement with the exact required sentence (Requirement 8.1)', () => {
    const text = exploreAnnouncement({ kind: 'unknown' }, 'raw');
    expect(text.startsWith("I couldn't fully read this diagram. You can still feel its outlines.")).toBe(true);
  });

  it('names an AI scene by its title, or by its kind when it has none', () => {
    expect(exploreAnnouncement(response.scene, 'ai').startsWith('Right triangle.')).toBe(true);
    expect(sceneName({ kind: 'bar_chart' })).toBe('bar_chart');
    expect(sceneName({ kind: 'geometry', title: '   ' })).toBe('geometry');
  });
});
