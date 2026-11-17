/**
 * Which element ids may be spoken aloud (Requirement 43). Pure, no imports.
 * Raw Mode ids such as `raw_p17` are machine-made; a caller describes the element instead.
 */

const PREFIXED_ID = /^(raw|point|pt|seg|line|poly|bar)_[a-z]?\d+$/i;
const MAX_SPEAKABLE_ID_LENGTH = 12;

/** True when the id looks machine-made. A non-string counts as machine-made. */
export function isMachineId(id: string): boolean {
  if (typeof id !== 'string') return true;
  if (id.length > MAX_SPEAKABLE_ID_LENGTH) return true;
  if (id.includes('_') && /\d/.test(id)) return true;
  return PREFIXED_ID.test(id);
}

/** The trimmed label, else the trimmed id when it is not machine-made, else null. */
export function speakableName(label: string | undefined, id: string): string | null {
  if (typeof label === 'string') {
    const l = label.trim();
    if (l !== '') return l;
  }
  if (typeof id !== 'string') return null;
  const i = id.trim();
  if (i === '' || isMachineId(i)) return null;
  return i;
}