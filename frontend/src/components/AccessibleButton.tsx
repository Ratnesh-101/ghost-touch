/**
 * AccessibleButton — the one control primitive Ghost Touch screens use.
 *
 * Requirement 12.1: every control SHALL have an accessible name and a touch
 * target of at least 48×48 CSS px. This component guarantees both:
 *  - `aria-label` (or visible text) always provides an accessible name.
 *  - The element is sized to at least 48×48 px via `.gt-control` (global.css).
 *
 * Keeping one shared primitive means a future accessibility audit only has to
 * check this file, not every screen.
 *
 * It forwards its ref so screens can move focus to it (for example back to
 * "Take photo" after an error), which screen-reader users rely on.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name. If omitted, `children` must provide visible text. */
  'aria-label'?: string;
  children?: ReactNode;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  function AccessibleButton({ children, className, ...rest }, ref) {
    return (
      <button ref={ref} type="button" className={`gt-control ${className ?? ''}`} {...rest}>
        {children}
      </button>
    );
  },
);
