/**
 * QR Code data URL helper for shared diagram URLs.
 *
 * Contract: docs/briefs/guide-share-contract.md § Share contract
 * Pure helper using only the qrcode library's data-URL API (no DOM/React).
 */

import QRCode from 'qrcode';
import { LIMITS } from './limits';

/**
 * Generate a data:image/ URL for a given URL string.
 * Returns null if url length > LIMITS.qrMaxUrlChars, if url is empty,
 * or if QR code generation fails.
 */
export async function qrDataUrl(url: string): Promise<string | null> {
  if (typeof url !== 'string' || url.length === 0 || url.length > LIMITS.qrMaxUrlChars) {
    return null;
  }

  try {
    const result = await QRCode.toDataURL(url, {
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return result;
  } catch {
    return null;
  }
}
