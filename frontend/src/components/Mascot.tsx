/**
 * Mascot — the friendly stitched Frankenstein phone creature.
 *
 * Stitched from three parts:
 *  - Nerves: tactile buzzer / vibration motor (eccentric weight & haptic ripples)
 *  - Eyes: cybernetic camera lens sensor (aperture rings & glowing optic pupil)
 *  - Voice: theremin antenna (tone transmitter radiating pitch waves)
 *
 * Original art, decorative only (aria-hidden="true", no text tags, <= 8 KB).
 * Used on screens/Start.tsx only (Requirement 12 / Lane G).
 */

import type { JSX } from 'react';

export interface MascotProps {
  className?: string;
  size?: number;
}

export function Mascot({ className = '', size = 96 }: MascotProps): JSX.Element {
  return (
    <svg
      className={`gt-mascot ${className}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      data-testid="gt-creature-mascot"
    >
      {/* --- Theremin Audio Waves (Voice / Pitch Synthesizer) --- */}
      <path
        d="M87 4 C92 7 92 11 87 14"
        stroke="#39ff88"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M93 1 C100 6 100 14 93 19"
        stroke="#39ff88"
        strokeWidth="1.5"
        strokeDasharray="2 3"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M69 6 C65 3 63 9 59 6"
        stroke="#39ff88"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* --- Theremin Antenna Rod & Sphere --- */}
      <path d="M78 24 V7" stroke="#39ff88" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M74 24 H82" stroke="#39ff88" strokeWidth="2" strokeLinecap="round" />
      <circle cx="78" cy="6" r="3.5" fill="#39ff88" />
      <circle cx="78" cy="6" r="6" stroke="#39ff88" strokeWidth="1" opacity="0.4" />

      {/* --- Frankenstein Chassis Mounting Bolts / Electrodes --- */}
      <rect x="25" y="56" width="7" height="12" rx="2" fill="#1c1c2a" stroke="#39ff88" strokeWidth="1.5" />
      <line x1="28" y1="58" x2="28" y2="66" stroke="#39ff88" strokeWidth="1" opacity="0.6" />
      <rect x="88" y="56" width="7" height="12" rx="2" fill="#1c1c2a" stroke="#39ff88" strokeWidth="1.5" />
      <line x1="92" y1="58" x2="92" y2="66" stroke="#39ff88" strokeWidth="1" opacity="0.6" />

      {/* --- Phone Chassis Body --- */}
      <rect
        x="32"
        y="22"
        width="56"
        height="80"
        rx="14"
        fill="#14141e"
        stroke="#39ff88"
        strokeWidth="2.5"
      />

      {/* Stitched Seams across Chassis */}
      <path
        d="M32 40 L48 22"
        stroke="#39ff88"
        strokeWidth="1.75"
        strokeDasharray="3 2"
        opacity="0.75"
      />
      <line x1="37" y1="32" x2="41" y2="36" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="43" y1="26" x2="47" y2="30" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" />

      <path
        d="M74 102 L88 88"
        stroke="#39ff88"
        strokeWidth="1.75"
        strokeDasharray="3 2"
        opacity="0.75"
      />
      <line x1="78" y1="98" x2="82" y2="94" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="84" y1="92" x2="88" y2="88" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" />

      {/* --- Screen Bezel & Display Area --- */}
      <rect
        x="38"
        y="30"
        width="44"
        height="64"
        rx="8"
        fill="#0b0b10"
        stroke="rgba(57, 255, 136, 0.3)"
        strokeWidth="1.5"
      />

      {/* --- Cybernetic Eye Sensor (Vision AI Eyes) --- */}
      <path
        d="M48 42 Q60 36 72 42"
        stroke="#39ff88"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lens socket and iris rings */}
      <circle cx="60" cy="51" r="14" stroke="#39ff88" strokeWidth="2" fill="rgba(57, 255, 136, 0.08)" />
      <circle cx="60" cy="51" r="10" stroke="#39ff88" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.7" />
      {/* Optic pupil with pupil glow and glint */}
      <circle cx="60" cy="51" r="5.5" fill="#39ff88" />
      <circle cx="58" cy="49" r="1.75" fill="#ffffff" />

      {/* --- Friendly Stitched Smile --- */}
      <path
        d="M51 72 Q60 80 69 72"
        stroke="#39ff88"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="55" y1="73" x2="55" y2="76" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="60" y1="75" x2="60" y2="78" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="65" y1="73" x2="65" y2="76" stroke="#39ff88" strokeWidth="1.5" strokeLinecap="round" />

      {/* --- Tactile Buzzer Module (Haptic Nerves & Vibration) --- */}
      {/* Vibration arcs radiating outward */}
      <path
        d="M13 74 A12 12 0 0 0 13 96"
        stroke="#39ff88"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M7 69 A18 18 0 0 0 7 101"
        stroke="#39ff88"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Buzzer motor cylinder attached to side */}
      <rect
        x="17"
        y="75"
        width="16"
        height="20"
        rx="4"
        fill="#1c1c2a"
        stroke="#39ff88"
        strokeWidth="1.75"
      />
      {/* Internal copper coil windings */}
      <line x1="20" y1="80" x2="30" y2="80" stroke="#25a357" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="85" x2="30" y2="85" stroke="#25a357" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="90" x2="30" y2="90" stroke="#25a357" strokeWidth="1.5" strokeLinecap="round" />
      {/* Motor axis pin and weight */}
      <circle cx="25" cy="85" r="2.5" fill="#39ff88" />
    </svg>
  );
}
