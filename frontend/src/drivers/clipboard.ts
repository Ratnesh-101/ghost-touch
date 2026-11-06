/**
 * Clipboard and Web Share API drivers.
 *
 * Architecture rule (AGENTS.md rule 7):
 * Browser APIs live only in frontend/src/drivers/.
 *
 * Provides:
 * - copyToClipboard: copies text to system clipboard via navigator.clipboard or fallback
 * - canWebShare: checks if navigator.share is available
 * - shareViaWebShare: invokes navigator.share
 * - getShareOrigin: resolves base origin using VITE_SITE_URL or window.location.origin
 */

/**
 * Copy text to clipboard using the asynchronous Clipboard API with execCommand fallback.
 * Returns true if copy succeeded, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string') return false;

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API rejected or unavailable; proceed to fallback
  }

  // Fallback for older browsers or headless DOM environments
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    let textarea: HTMLTextAreaElement | null = null;
    try {
      textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      return success;
    } catch {
      // Fallback failed
    } finally {
      if (textarea && textarea.parentNode) {
        textarea.parentNode.removeChild(textarea);
      }
    }
  }

  return false;
}

/**
 * Test if the Web Share API is available in the current environment.
 */
export function canWebShare(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  );
}

export interface WebShareData {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * Share data using the Web Share API if available.
 * Returns true if shared, false if unsupported or cancelled by user.
 */
export async function shareViaWebShare(data: WebShareData): Promise<boolean> {
  if (!canWebShare()) return false;

  try {
    await navigator.share(data);
    return true;
  } catch (err) {
    // If the user cancelled the share dialog (AbortError), treat as graceful non-error
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
      return false;
    }
    return false;
  }
}

/**
 * Determine the base origin URL for shared diagram links.
 * Prefers import.meta.env.VITE_SITE_URL if configured, then window.location.origin,
 * falling back to 'http://localhost'.
 */
export function getShareOrigin(): string {
  const envUrl = import.meta.env.VITE_SITE_URL;
  if (typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }

  if (
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.origin === 'string' &&
    window.location.origin.trim() !== ''
  ) {
    return window.location.origin.replace(/\/+$/, '');
  }

  return 'http://localhost';
}
