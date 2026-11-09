/**
 * Share module entry point.
 *
 * Implements the full Share contract:
 * - SHARE_VERSION, LIMITS
 * - SharePayload, ShareError, ShareErrorCode
 * - encodeShare, shareUrl, decodeShare
 * - validateShareScene, sanitizeString
 * - qrDataUrl
 * - ShareGate, honesty helpers
 *
 * Contract: docs/briefs/guide-share-contract.md § Share contract
 */

export { LIMITS, SHARE_VERSION } from './limits';

export {
  ShareError,
  decodeShare,
  encodeShare,
  shareUrl,
  type ShareErrorCode,
  type SharePayload,
} from './codec';

export { sanitizeString, validateShareScene } from './validate';

export { qrDataUrl } from './qr';

export { ShareGate, type ShareGateProps } from '../components/ShareGate';

export {
  buildHonestShareAnnouncement,
  formatShareTitleAnnouncement,
  honestSharedByLabel,
  sanitizeShareName,
  sanitizeShareTitle,
  type HonestShareAnnouncementOptions,
} from '../flow/share';
