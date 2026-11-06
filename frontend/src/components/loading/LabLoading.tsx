/**
 * LabLoading — Kiroween "Frankenstein's Laboratory" loading visual.
 *
 * Presentational component shown while a diagram is being captured/analyzed.
 * Features an indeterminate copper charge meter with sequentially filling cells
 * and an electric spark glyph.
 *
 * Accessibility:
 * - Meter is aria-hidden="true" (purely visual indeterminate animation).
 * - Component contains NO live region (the parent screen owns the live region
 *   and spoken announcement to avoid double speech).
 * - No role="progressbar" without an explicit deterministic value.
 * - Respects prefers-reduced-motion via loading.css.
 */
import type { JSX } from 'react';
import '../../styles/loading.css';

export interface LabLoadingProps {
  title: string;
  hint: string;
  className?: string;
}

export function LabLoading({ title, hint, className }: LabLoadingProps): JSX.Element {
  const rootClass = className ? `gt-lab-loading ${className}` : 'gt-lab-loading';

  return (
    <div className={rootClass}>
      <p className="gt-lab-loading__title">{title}</p>
      <div className="gt-lab-loading__meter" aria-hidden="true">
        <div className="gt-lab-loading__track">
          <span className="gt-lab-loading__cell gt-lab-loading__cell--1" />
          <span className="gt-lab-loading__cell gt-lab-loading__cell--2" />
          <span className="gt-lab-loading__cell gt-lab-loading__cell--3" />
          <span className="gt-lab-loading__cell gt-lab-loading__cell--4" />
          <span className="gt-lab-loading__cell gt-lab-loading__cell--5" />
          <span className="gt-lab-loading__cell gt-lab-loading__cell--6" />
          <span className="gt-lab-loading__cell gt-lab-loading__cell--7" />
          <span className="gt-lab-loading__cell gt-lab-loading__cell--8" />
        </div>
        <svg
          className="gt-lab-loading__spark"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          focusable="false"
          aria-hidden="true"
        >
          <path
            d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
            fill="currentColor"
          />
        </svg>
      </div>
      <p className="gt-lab-loading__hint">{hint}</p>
    </div>
  );
}
