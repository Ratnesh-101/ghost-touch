/**
 * Share constants and limits.
 *
 * Contract: guide-share-contract.md § Share contract
 */

export const SHARE_VERSION = 1 as const;

export const LIMITS = {
  maxHashChars: 12000,
  maxDecompressedChars: 200000,
  maxName: 60,
  maxNote: 280,
  maxLabel: 60,
  qrMaxUrlChars: 2000,
  maxPoints: 300,
  maxSegments: 300,
  maxPolylinePoints: 2000,
  maxBars: 60,
  maxFacts: 50,
} as const;
