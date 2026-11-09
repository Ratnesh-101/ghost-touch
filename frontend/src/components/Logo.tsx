/**
 * Logo — the Ghost Touch brand mark and wordmark.
 *
 * Requirements (Lane Lab-Brand):
 * - Props: `variant?: 'full' | 'mark'`, `decorative?: boolean`, `className?`, `height?: number`.
 * - Inline SVG (no network requests).
 * - If `decorative`, `aria-hidden="true"` and `focusable="false"`.
 * - If NOT `decorative`, `role="img"` with `aria-label={t('app.name')}` and `focusable="false"`.
 * - The visible page heading must remain real text: Logo is never the only content of an <h1>.
 */

import type { JSX } from 'react';
import { t } from '../i18n';

export interface LogoProps {
  variant?: 'full' | 'mark';
  decorative?: boolean;
  className?: string;
  height?: number;
}

export function Logo({
  variant = 'full',
  decorative = false,
  className = '',
  height,
}: LogoProps): JSX.Element {
  const accessibleAttrs = decorative
    ? {
        'aria-hidden': true as const,
        focusable: 'false' as const,
      }
    : {
        role: 'img' as const,
        'aria-label': t('app.name'),
        focusable: 'false' as const,
      };

  const classes = `gt-logo gt-logo--${variant} ${className}`.trim();

  if (variant === 'mark') {
    const markSize = height ?? 100;
    return (
      <svg
        className={classes}
        width={markSize}
        height={markSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        data-testid="gt-logo-mark"
        {...accessibleAttrs}
      >
        {!decorative && <title>{t('app.name')}</title>}

        {/* Frankenstein Neck Bolt */}
        <rect x="20" y="44" width="8" height="12" rx="2" fill="#c9803a" stroke="#9a5a1f" strokeWidth="1.5" />
        <rect x="16" y="42" width="5" height="16" rx="2" fill="#d9904a" stroke="#9a5a1f" strokeWidth="1.5" />
        <line x1="18.5" y1="46" x2="18.5" y2="54" stroke="#783c0c" strokeWidth="1.5" strokeLinecap="round" />

        {/* Phone Chassis Body */}
        <rect x="28" y="16" width="46" height="68" rx="10" fill="#0b0e0c" stroke="#39ff88" strokeWidth="3" />
        <line x1="47" y1="20" x2="55" y2="20" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* Screen Bezel & Display */}
        <rect x="34" y="24" width="34" height="46" rx="5" fill="#070a08" stroke="#39ff88" strokeOpacity="0.35" strokeWidth="1.5" />

        {/* Glowing Diagram (Triangle with Vertex Nodes) */}
        <polygon
          points="51,32 40,58 62,58"
          fill="#39ff88"
          fillOpacity="0.15"
          stroke="#39ff88"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="51" cy="32" r="2.5" fill="#39ff88" />
        <circle cx="40" cy="58" r="2.5" fill="#39ff88" />
        <circle cx="62" cy="58" r="2.5" fill="#39ff88" />

        {/* Stitched Seams (Bone Sutures Across Chassis) */}
        <path d="M58 16 L74 32" stroke="#e8dfc8" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9" />
        <line x1="60" y1="16" x2="63" y2="21" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="65" y1="21" x2="68" y2="26" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="70" y1="26" x2="73" y2="31" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />

        <path d="M28 72 L40 84" stroke="#e8dfc8" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9" />
        <line x1="30" y1="73" x2="33" y2="78" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="35" y1="78" x2="38" y2="83" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />

        {/* Tactile Vibration Arcs */}
        <path d="M79 38 A 14 14 0 0 1 79 62" stroke="#39ff88" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M85 32 A 22 22 0 0 1 85 68" stroke="#39ff88" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <path d="M91 26 A 30 30 0 0 1 91 74" stroke="#39ff88" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" opacity="0.55" />
      </svg>
    );
  }

  // variant === 'full'
  const fullHeight = height ?? 80;
  const fullWidth = height ? Math.round(height * (340 / 80)) : 340;

  return (
    <svg
      className={classes}
      width={fullWidth}
      height={fullHeight}
      viewBox="0 0 340 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-testid="gt-logo-full"
      {...accessibleAttrs}
    >
      {!decorative && <title>{t('app.name')}</title>}

      {/* Creature Phone Mark */}
      <g transform="translate(2, 4) scale(0.72)">
        {/* Neck Bolt */}
        <rect x="20" y="44" width="8" height="12" rx="2" fill="#c9803a" stroke="#9a5a1f" strokeWidth="1.5" />
        <rect x="16" y="42" width="5" height="16" rx="2" fill="#d9904a" stroke="#9a5a1f" strokeWidth="1.5" />
        <line x1="18.5" y1="46" x2="18.5" y2="54" stroke="#783c0c" strokeWidth="1.5" strokeLinecap="round" />

        {/* Phone Chassis */}
        <rect x="28" y="16" width="46" height="68" rx="10" fill="#0b0e0c" stroke="#39ff88" strokeWidth="3" />
        <line x1="47" y1="20" x2="55" y2="20" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* Screen Bezel */}
        <rect x="34" y="24" width="34" height="46" rx="5" fill="#070a08" stroke="#39ff88" strokeOpacity="0.35" strokeWidth="1.5" />

        {/* Glowing Triangle */}
        <polygon
          points="51,32 40,58 62,58"
          fill="#39ff88"
          fillOpacity="0.15"
          stroke="#39ff88"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="51" cy="32" r="2.5" fill="#39ff88" />
        <circle cx="40" cy="58" r="2.5" fill="#39ff88" />
        <circle cx="62" cy="58" r="2.5" fill="#39ff88" />

        {/* Stitched Seams */}
        <path d="M58 16 L74 32" stroke="#e8dfc8" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9" />
        <line x1="60" y1="16" x2="63" y2="21" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="65" y1="21" x2="68" y2="26" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="70" y1="26" x2="73" y2="31" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />

        <path d="M28 72 L40 84" stroke="#e8dfc8" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.9" />
        <line x1="30" y1="73" x2="33" y2="78" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="35" y1="78" x2="38" y2="83" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />

        {/* Vibration Arcs */}
        <path d="M79 38 A 14 14 0 0 1 79 62" stroke="#39ff88" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M85 32 A 22 22 0 0 1 85 68" stroke="#39ff88" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <path d="M91 26 A 30 30 0 0 1 91 74" stroke="#39ff88" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" opacity="0.55" />
      </g>

      {/* Wordmark */}
      <text
        x="82"
        y="48"
        fontFamily="Atkinson Hyperlegible, system-ui, sans-serif"
        fontSize="34"
        fontWeight="700"
        fill="#f5fff8"
        letterSpacing="-0.5"
      >
        Ghost <tspan fill="#39ff88">Touch</tspan>
      </text>

      {/* Thin Suture Line under "Touch" */}
      <line x1="184" y1="58" x2="282" y2="58" stroke="#e8dfc8" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
      <line x1="198" y1="54" x2="202" y2="62" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="222" y1="54" x2="226" y2="62" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="246" y1="54" x2="250" y2="62" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="270" y1="54" x2="274" y2="62" stroke="#e8dfc8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
