/**
 * Locale detection driver.
 *
 * Architecture rule: browser APIs live only in frontend/src/drivers/.
 * Detects device language from navigator.languages with prefix matching
 * ('en' | 'hi' | 'gu'). Wrapped in try/catch to safely fall back to 'en'.
 */

export type DeviceLang = 'en' | 'hi' | 'gu';

/**
 * Detect the preferred language from navigator.languages.
 * Matches the first supported prefix ('hi', 'gu', 'en'), falling back to 'en'.
 * Inside try/catch: safely handles undefined navigator, missing languages, or restricted access.
 */
export function deviceLang(languages?: readonly string[]): DeviceLang {
  try {
    const list =
      languages ??
      (typeof navigator !== 'undefined' ? navigator.languages : undefined);

    if (Array.isArray(list)) {
      for (const raw of list) {
        if (typeof raw !== 'string') continue;
        const normalized = raw.trim().toLowerCase();
        const prefix = normalized.split(/[-_]/)[0];
        if (prefix === 'hi' || normalized.startsWith('hi')) return 'hi';
        if (prefix === 'gu' || normalized.startsWith('gu')) return 'gu';
        if (prefix === 'en' || normalized.startsWith('en')) return 'en';
      }
    }
  } catch {
    // navigator or property access threw; safely fall back to English
  }
  return 'en';
}
