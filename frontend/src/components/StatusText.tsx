/**
 * StatusText — the visible mirror of what the app says aloud.
 *
 * Double reading comes from a live region: an `aria-live` element is announced
 * by the screen reader on its own, on top of the app's speech. So when the app
 * speaks the line itself (`spoken`), this renders plain text with NO live
 * region. A screen-reader user can still swipe to it and re-read a message
 * they missed (for example an error), and nothing is announced twice.
 * When the app cannot speak (no speech synthesis), it becomes a polite live
 * region so the screen reader announces the message instead.
 */
import type { JSX, ReactNode } from 'react';

interface StatusTextProps {
  children: ReactNode;
  /** True when the speech driver says this same line. */
  spoken: boolean;
  className?: string;
}

export function StatusText({ children, spoken, className }: StatusTextProps): JSX.Element {
  return spoken ? (
    <p className={className}>{children}</p>
  ) : (
    <p className={className} role="status" aria-live="polite">
      {children}
    </p>
  );
}
