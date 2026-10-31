import { describe, expect, it } from 'vitest';
import {
  MAX_CAMERA_BYTES,
  MAX_IMAGE_SIDE,
  MAX_UPLOAD_BYTES,
  computeTargetSize,
  validateImageFile,
} from '../src/drivers/camera';

describe('computeTargetSize', () => {
  it('scales a landscape photo so the longest side is 1600', () => {
    expect(computeTargetSize(4000, 3000, MAX_IMAGE_SIDE)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo so the longest side is 1600', () => {
    expect(computeTargetSize(3000, 4000, MAX_IMAGE_SIDE)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales a small image', () => {
    expect(computeTargetSize(800, 600, MAX_IMAGE_SIDE)).toEqual({ width: 800, height: 600 });
  });

  it('leaves an image exactly at the limit unchanged', () => {
    expect(computeTargetSize(1600, 900, MAX_IMAGE_SIDE)).toEqual({ width: 1600, height: 900 });
  });

  it('shrinks an image one pixel over the limit', () => {
    expect(computeTargetSize(1601, 1601, MAX_IMAGE_SIDE)).toEqual({ width: 1600, height: 1600 });
  });

  it('never returns a side below 1 pixel, even for extreme aspect ratios', () => {
    const size = computeTargetSize(100000, 10, MAX_IMAGE_SIDE);
    expect(size.width).toBe(1600);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });

  it('handles zero or invalid sizes without throwing', () => {
    expect(computeTargetSize(0, 0, MAX_IMAGE_SIDE)).toEqual({ width: 1, height: 1 });
    expect(computeTargetSize(Number.NaN, 10, MAX_IMAGE_SIDE)).toEqual({ width: 1, height: 1 });
  });
});

describe('validateImageFile', () => {
  it('accepts JPEG, PNG and WebP (any letter case)', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'IMAGE/PNG']) {
      expect(validateImageFile({ type, size: 1000 })).toBeNull();
    }
  });

  it('accepts a file of exactly 10 MB and rejects one byte more', () => {
    expect(validateImageFile({ type: 'image/png', size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateImageFile({ type: 'image/png', size: MAX_UPLOAD_BYTES + 1 })).toBe('size');
  });

  it('allows a larger raw camera photo when the camera limit is passed', () => {
    const elevenMb = 11 * 1024 * 1024;
    expect(validateImageFile({ type: 'image/jpeg', size: elevenMb })).toBe('size');
    expect(validateImageFile({ type: 'image/jpeg', size: elevenMb }, MAX_CAMERA_BYTES)).toBeNull();
    expect(validateImageFile({ type: 'image/jpeg', size: MAX_CAMERA_BYTES + 1 }, MAX_CAMERA_BYTES)).toBe('size');
  });

  it('rejects other types', () => {
    expect(validateImageFile({ type: 'image/gif', size: 1000 })).toBe('type');
    expect(validateImageFile({ type: 'text/plain', size: 1000 })).toBe('type');
    expect(validateImageFile({ type: '', size: 1000 })).toBe('type');
  });

  it('accepts PDFs up to the upload limit when allowed', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(validateImageFile({ type: 'application/pdf', size: MAX_UPLOAD_BYTES + 1 })).toBe('size');
    expect(validateImageFile({ type: 'application/pdf', size: 1000 }, MAX_CAMERA_BYTES, false)).toBe('pdf');
  });

  it('rejects an empty file', () => {
    expect(validateImageFile({ type: 'image/png', size: 0 })).toBe('empty');
  });
});
