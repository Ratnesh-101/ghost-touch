/**
 * OrganIcons — Original inline-SVG icons for Frankenstein lab organ tiles.
 *
 * Creature triad:
 * - nerves: vibrating motor with eccentric rotor, zig-zag pulse and vibration arcs
 * - eyes: stitched, friendly optical lens (never gory, laboratory suture accents)
 * - voice: theremin antenna with finial ball, volume loop, and acoustic sound waves
 *
 * Accessibility & constraints:
 * - Hand-written, under 1.5 KB each.
 * - aria-hidden="true" and focusable="false" on every SVG.
 * - Uses currentColor for styling; no hard-coded color literals.
 */
import type { JSX } from 'react';

export type OrganId = 'nerves' | 'eyes' | 'voice';

export interface OrganIconProps {
  className?: string;
}

/**
 * Nerves icon: vibrating motor core, central electrical impulse, and vibration ripple arcs.
 */
export function NervesIcon({ className }: OrganIconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Central coin vibration motor casing */}
      <circle cx="16" cy="16" r="6" stroke="currentColor" strokeWidth="1.75" />
      {/* Eccentric rotor mass showing vibration mechanism */}
      <path
        d="M 16,10 A 6,6 0 0,1 22,16 L 16,16 Z"
        fill="currentColor"
        fillOpacity="0.25"
      />
      {/* Zig-zag nerve / electric impulse running through center */}
      <path
        d="M 16,6 L 17.5,11 L 14.5,16 L 17.5,21 L 16,26"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vibration resonance arcs - left */}
      <path
        d="M 8,12 C 6,14.5 6,17.5 8,20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M 5,9 C 2,13 2,19 5,23"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Vibration resonance arcs - right */}
      <path
        d="M 24,12 C 26,14.5 26,17.5 24,20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M 27,9 C 30,13 30,19 27,23"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Eyes icon: friendly optical camera lens with laboratory suture cross-stitches.
 * Never gory: represents the creature's vision AI organ stitched from phone optics.
 */
export function EyesIcon({ className }: OrganIconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Outer camera lens bezel */}
      <circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.75" />
      {/* Inner aperture ring */}
      <circle cx="16" cy="16" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Friendly pupil with highlight */}
      <circle
        cx="16"
        cy="16"
        r="3.5"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="17.5" cy="14.5" r="1" fill="currentColor" />
      {/* Frankenstein laboratory stitched sutures across bezel */}
      <line
        x1="5.5"
        y1="8.5"
        x2="9.5"
        y2="12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="5.5"
        y1="12.5"
        x2="9.5"
        y2="8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="22.5"
        y1="19.5"
        x2="26.5"
        y2="23.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="22.5"
        y1="23.5"
        x2="26.5"
        y2="19.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Voice icon: laboratory theremin antenna with capacitive ball, loop, and sound waves.
 * Represents synthesizer speech and musical tone synthesis.
 */
export function VoiceIcon({ className }: OrganIconProps): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Antenna base mount */}
      <line x1="6" y1="27" x2="14" y2="27" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="24" x2="12" y2="24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Vertical theremin pitch antenna rod */}
      <line x1="10" y1="7" x2="10" y2="27" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      {/* Capacitive antenna ball */}
      <circle
        cx="10"
        cy="6"
        r="2.5"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Volume control loop at antenna base */}
      <path
        d="M 6,18 C 3.5,18 3.5,22 6,22 L 10,22"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Radiating sound waves from antenna */}
      <path
        d="M 16,12 C 18,14.5 18,17.5 16,20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M 21,9 C 24.5,13 24.5,19 21,23"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M 26,6 C 31,11 31,21 26,26"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * OrganIcon — renders the corresponding organ icon based on organ id.
 */
export function OrganIcon({ id, className }: { id: OrganId; className?: string }): JSX.Element {
  switch (id) {
    case 'nerves':
      return <NervesIcon className={className} />;
    case 'eyes':
      return <EyesIcon className={className} />;
    case 'voice':
      return <VoiceIcon className={className} />;
  }
}
