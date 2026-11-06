import type { ReactElement } from 'react';

export interface RivetsProps {
  className?: string;
  size?: number;
  color?: string;
}

interface SingleRivetProps {
  positionClass: string;
  size: number;
  color: string;
}

function SingleRivet({ positionClass, size, color }: SingleRivetProps): ReactElement {
  return (
    <svg
      className={`gt-rivet ${positionClass}`}
      width={size}
      height={size}
      viewBox="0 0 12 12"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="6"
        cy="6"
        r="5.5"
        fill={color}
        stroke="rgba(0, 0, 0, 0.6)"
        strokeWidth="1"
      />
      {/* Metallic highlight */}
      <circle
        cx="4.5"
        cy="4.5"
        r="2"
        fill="rgba(255, 255, 255, 0.4)"
      />
      {/* Center bolt slot */}
      <line
        x1="3"
        y1="6"
        x2="9"
        y2="6"
        stroke="rgba(0, 0, 0, 0.7)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Rivets — 4 corner hardware bolts for primary cards (Frankenstein's Laboratory).
 *
 * Non-interactive, decorative, aria-hidden="true".
 * Places 4 aged copper bolts at the top-left, top-right, bottom-left, and bottom-right corners.
 */
export function Rivets({
  className = '',
  size = 10,
  color = 'var(--gt-copper, #c88a4b)',
}: RivetsProps): ReactElement {
  return (
    <div
      className={`gt-rivets ${className}`.trim()}
      aria-hidden="true"
      role="presentation"
    >
      <SingleRivet positionClass="gt-rivet--tl" size={size} color={color} />
      <SingleRivet positionClass="gt-rivet--tr" size={size} color={color} />
      <SingleRivet positionClass="gt-rivet--bl" size={size} color={color} />
      <SingleRivet positionClass="gt-rivet--br" size={size} color={color} />
    </div>
  );
}
