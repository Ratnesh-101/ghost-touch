/**
 * Share codec for Teacher Share & Student Open.
 *
 * Implements LZ-string compression/decompression, format validation,
 * hostile input protection, and error handling.
 *
 * Contract: docs/briefs/guide-share-contract.md § Share contract
 */

import LZString from 'lz-string';
import type { DiagramScene } from '../core/scene';
import { LIMITS, SHARE_VERSION } from './limits';
import { sanitizeString, validateShareScene } from './validate';

export type ShareErrorCode =
  | 'too-large'
  | 'bad-format'
  | 'bad-version'
  | 'bad-scene'
  | 'empty';

export class ShareError extends Error {
  readonly code: ShareErrorCode;

  constructor(code: ShareErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ShareError';
    this.code = code;
    Object.setPrototypeOf(this, ShareError.prototype);
  }
}

export interface SharePayload {
  v: 1;
  scene: DiagramScene;
  verifiedBy: string;
  note: string;
  verifiedAt: string; /*ISO*/
}

/**
 * Encode a SharePayload into a compressed URI component string.
 * Throws ShareError('too-large') if compressed string exceeds LIMITS.maxHashChars.
 */
export function encodeShare(p: SharePayload): string {
  if (!p || typeof p !== 'object') {
    throw new ShareError('bad-format', 'Payload must be an object');
  }
  if (p.v !== SHARE_VERSION) {
    throw new ShareError('bad-version', `Unsupported version: ${String(p.v)}`);
  }
  if (!p.scene) {
    throw new ShareError('bad-scene', 'Scene is required');
  }

  const valResult = validateShareScene(p.scene);
  if (!valResult.ok) {
    throw new ShareError('bad-scene', valResult.errors.join('; '));
  }

  const payload: SharePayload = {
    v: SHARE_VERSION,
    scene: valResult.scene,
    verifiedBy: sanitizeString(p.verifiedBy ?? '', LIMITS.maxName),
    note: sanitizeString(p.note ?? '', LIMITS.maxNote, true),
    verifiedAt:
      typeof p.verifiedAt === 'string' && !Number.isNaN(Date.parse(p.verifiedAt))
        ? sanitizeString(p.verifiedAt, 100)
        : new Date().toISOString(),
  };

  const json = JSON.stringify(payload);
  const compressed = LZString.compressToEncodedURIComponent(json);
  if (!compressed) {
    throw new ShareError('bad-format', 'Compression produced empty output');
  }

  if (compressed.length > LIMITS.maxHashChars) {
    throw new ShareError(
      'too-large',
      `Encoded share payload exceeds limit of ${LIMITS.maxHashChars} characters`,
    );
  }

  return compressed;
}

/**
 * Fast pre-parse bracket depth counter to reject deeply nested hostile JSON
 * before JSON.parse and revivers exhaust the JS call stack.
 */
function checkNestingDepth(jsonStr: string, maxDepth = 32): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr.charCodeAt(i);
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === 92) {
      escaped = true;
      continue;
    }
    if (ch === 34) {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === 123 || ch === 91) {
        depth++;
        if (depth > maxDepth) return false;
      } else if (ch === 125 || ch === 93) {
        depth--;
      }
    }
  }
  return true;
}

/**
 * Build full share URL from origin and encoded payload.
 * Validates origin protocol and falls back safely to 'https://ghosttouch.app'
 * if origin is empty, 'null', or does not start with http:// or https:// (SEC-08).
 * Format: `${origin}/#s=${encoded}`
 */
export function shareUrl(origin: string, encoded: string): string {
  let cleanOrigin = (origin || '').trim().replace(/\/+$/, '');
  if (!cleanOrigin || cleanOrigin === 'null' || !/^https?:\/\//i.test(cleanOrigin)) {
    cleanOrigin = 'https://ghosttouch.app';
  }
  return `${cleanOrigin}/#s=${encoded}`;
}

/**
 * Total decode of a share hash string into a validated SharePayload.
 * Accepts raw compressed string or strings with '#s=' prefix.
 *
 * Guarantees:
 * - Total: throws only ShareError, never any other exception, for ANY input string.
 * - Hash length checked before decompression.
 * - Decompressed size capped (zip bomb protection).
 * - Safe JSON parsing (prototype pollution protection).
 * - Metadata strings sanitized and capped.
 * - DiagramScene validated through validateShareScene.
 */
export function decodeShare(hash: string): SharePayload {
  try {
    if (typeof hash !== 'string') {
      throw new ShareError('empty', 'Input must be a string');
    }

    let raw = hash.trim();

    // Check for #s= prefix or hash inside URL
    const hashIdx = raw.indexOf('#s=');
    if (hashIdx !== -1) {
      raw = raw.slice(hashIdx + 3);
    } else if (raw.startsWith('s=')) {
      raw = raw.slice(2);
    }

    // Check empty
    if (raw.length === 0) {
      throw new ShareError('empty', 'Empty share hash');
    }

    // Check length BEFORE any decompression call (zip bomb guard).
    // Note: Measure only the fragment (raw), not the full URL with origin (SEC-01 contract).
    if (raw.length > LIMITS.maxHashChars) {
      throw new ShareError(
        'too-large',
        `Share payload exceeds maximum length of ${LIMITS.maxHashChars} characters`,
      );
    }

    // Decompress
    let decompressed: string | null = null;
    try {
      decompressed = LZString.decompressFromEncodedURIComponent(raw);
    } catch {
      throw new ShareError('bad-format', 'Decompression failed');
    }

    if (!decompressed) {
      throw new ShareError('bad-format', 'Decompression produced null or empty result');
    }

    // Zip bomb check: decompressed length cap
    if (decompressed.length > LIMITS.maxDecompressedChars) {
      throw new ShareError(
        'too-large',
        `Decompressed payload exceeds maximum size of ${LIMITS.maxDecompressedChars} characters`,
      );
    }

    // Deep nesting guard: reject before recursive parse can exceed call stack
    if (!checkNestingDepth(decompressed, 32)) {
      throw new ShareError('bad-format', 'Payload exceeds maximum nesting depth');
    }

    // Safe JSON parse with prototype pollution prevention
    let parsed: unknown;
    try {
      parsed = JSON.parse(decompressed, (key, value) => {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return undefined;
        }
        return value;
      });
    } catch {
      throw new ShareError('bad-format', 'Invalid JSON payload');
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ShareError('bad-format', 'Expected JSON object in payload');
    }

    const payloadObj = parsed as Record<string, unknown>;

    // Version check
    if (payloadObj.v !== SHARE_VERSION) {
      throw new ShareError(
        'bad-version',
        `Unsupported share version: ${String(payloadObj.v)}`,
      );
    }

    // Missing scene check
    if (!payloadObj.scene || typeof payloadObj.scene !== 'object') {
      throw new ShareError('bad-scene', 'Missing scene in share payload');
    }

    // Validate scene
    const valResult = validateShareScene(payloadObj.scene);
    if (!valResult.ok) {
      throw new ShareError('bad-scene', valResult.errors.join('; '));
    }

    // Sanitize metadata strings
    const verifiedBy = sanitizeString(payloadObj.verifiedBy ?? '', LIMITS.maxName);
    const note = sanitizeString(payloadObj.note ?? '', LIMITS.maxNote, true);
    let verifiedAt: string;
    if (typeof payloadObj.verifiedAt === 'string') {
      const sanitized = sanitizeString(payloadObj.verifiedAt, 100);
      const parsedTime = Date.parse(sanitized);
      verifiedAt = !Number.isNaN(parsedTime) ? sanitized : new Date().toISOString();
    } else {
      verifiedAt = new Date().toISOString();
    }

    return {
      v: SHARE_VERSION,
      scene: valResult.scene,
      verifiedBy,
      note,
      verifiedAt,
    };
  } catch (err) {
    if (err instanceof ShareError) {
      throw err;
    }
    throw new ShareError(
      'bad-format',
      err instanceof Error ? err.message : 'Unknown share decode error',
    );
  }
}
