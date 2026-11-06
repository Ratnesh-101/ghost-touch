import { useEffect, useState, type ReactElement } from 'react';

export interface SparkProps {
  className?: string;
  onDone?: () => void;
  overlay?: boolean;
}

/**
 * Spark — The one-shot "IT'S ALIVE" electric arc + glow pulse (Frankenstein's Laboratory).
 *
 * Characteristics:
 * - Plays once on mount
 * - Duration: 950ms (WCAG compliant, strictly < 1.2s)
 * - Flash rate: 2 pulses over 0.95s (~2.1 Hz, WCAG 2.3.1 compliant <= 3 flashes/second)
 * - Respects prefers-reduced-motion: renders a static final frame with zero animation
 * - Calls optional onDone() callback on completion
 * - No audio logic (audio is owned by the screen lane using the existing success earcon)
 * - Non-interactive, aria-hidden="true"
 */
export function Spark({
  className = '',
  onDone,
  overlay = true,
}: SparkProps): ReactElement {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    // If reduced motion is preferred, invoke onDone promptly without animation
    if (reducedMotion) {
      if (onDone) {
        const timer = setTimeout(onDone, 50);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Normal motion: complete after 950ms (strictly < 1.2s)
    if (onDone) {
      const timer = setTimeout(onDone, 950);
      return () => clearTimeout(timer);
    }
  }, [reducedMotion, onDone]);

  const classes = [
    'gt-spark',
    overlay ? 'gt-spark--overlay' : '',
    reducedMotion ? 'gt-spark--reduced' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      aria-hidden="true"
      role="presentation"
      data-testid="gt-spark"
    >
      <svg
        className="gt-spark__svg"
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <radialGradient
            id="gt-spark-radial"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" stopColor="var(--gt-cyan, #00f0ff)" stopOpacity="0.8" />
            <stop offset="45%" stopColor="var(--gt-green, #39ff88)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--gt-cyan, #00f0ff)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient radial glow pulse */}
        <circle
          className="gt-spark__glow"
          cx="120"
          cy="120"
          r="90"
          fill="url(#gt-spark-radial)"
        />

        {/* Primary voltage spark arc discharges (lightning paths) */}
        <path
          className="gt-spark__arc"
          d="M 120 20
             L 112 75
             L 135 90
             L 105 130
             L 128 145
             L 110 190
             L 120 220"
        />

        <path
          className="gt-spark__arc"
          d="M 30 115
             L 75 125
             L 90 108
             L 135 122
             L 160 102
             L 210 118"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}
