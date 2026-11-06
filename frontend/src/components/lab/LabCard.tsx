import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { Rivets } from './Rivets';

export interface LabCardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  variant?: 'primary' | 'secondary' | 'specimen';
  hasRivets?: boolean;
  hasStitches?: boolean;
  className?: string;
}

/**
 * LabCard — Wrapper card composing stitched edge + corner rivets (Frankenstein's Laboratory).
 *
 * Children are preserved untouched.
 * Decorative elements carry aria-hidden="true" and do not interfere with screen readers.
 */
export function LabCard({
  children,
  variant = 'primary',
  hasRivets,
  hasStitches = true,
  className = '',
  ...restProps
}: LabCardProps): ReactElement {
  // Primary cards get rivets by default; secondary/specimen cards do not unless explicitly requested
  const showRivets = hasRivets ?? (variant === 'primary');

  const classes = [
    'gt-lab-card',
    `gt-lab-card--${variant}`,
    hasStitches ? 'gt-lab-card--stitched' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...restProps}>
      {showRivets && <Rivets />}
      {children}
    </div>
  );
}
