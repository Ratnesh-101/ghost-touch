import type { ReactElement } from 'react';

export interface SeamProps {
  className?: string;
  color?: string;
  crosses?: boolean;
  width?: string | number;
  height?: number;
}

/**
 * Seam — Decorative stitched suture divider (Frankenstein's Laboratory).
 *
 * Non-interactive, aria-hidden="true".
 * Renders a horizontal suture line with dashed surgical stitches and cross-sutures.
 */
export function Seam({
  className = '',
  color = 'var(--gt-stitch, #ded6c4)',
  crosses = true,
  width = '100%',
  height = 16,
}: SeamProps): ReactElement {
  return (
    <div
      className={`gt-seam ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      <svg
        className="gt-seam__svg"
        width={width}
        height={height}
        viewBox="0 0 400 16"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {/* Main dashed suture line */}
        <line
          x1="0"
          y1="8"
          x2="400"
          y2="8"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="6 6"
          strokeLinecap="round"
        />

        {/* Cross sutures along the seam */}
        {crosses && (
          <g stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.85">
            <line x1="30" y1="3" x2="36" y2="13" />
            <line x1="36" y1="3" x2="30" y2="13" />

            <line x1="90" y1="4" x2="94" y2="12" />

            <line x1="150" y1="3" x2="156" y2="13" />
            <line x1="156" y1="3" x2="150" y2="13" />

            <line x1="210" y1="4" x2="214" y2="12" />

            <line x1="270" y1="3" x2="276" y2="13" />
            <line x1="276" y1="3" x2="270" y2="13" />

            <line x1="330" y1="4" x2="334" y2="12" />

            <line x1="375" y1="3" x2="381" y2="13" />
            <line x1="381" y1="3" x2="375" y2="13" />
          </g>
        )}
      </svg>
    </div>
  );
}
