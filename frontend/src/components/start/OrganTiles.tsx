/**
 * OrganTiles — Presentational tiles for the Start screen hero.
 *
 * Displays the Frankenstein creature triad:
 * - Nerves (vibration)
 * - Eyes (vision AI)
 * - Voice (theremin + speech)
 *
 * Rendered as a plain list (`ul` and `li`).
 * Non-interactive: no buttons, no tab stops (sits inside the whole-screen start button).
 */
import type { JSX } from 'react';
import '../../styles/start.css';
import { OrganIcon, type OrganId } from './OrganIcons';

export interface OrganItem {
  id: OrganId;
  title: string;
  line: string;
}

export interface OrganTilesProps {
  organs: Array<{
    id: OrganId;
    title: string;
    line: string;
  }>;
  className?: string;
}

export function OrganTiles({ organs, className }: OrganTilesProps): JSX.Element {
  return (
    <ul className={`gt-organ-tiles ${className ?? ''}`.trim()}>
      {organs.map((organ) => (
        <li
          key={organ.id}
          className={`gt-organ-tile gt-organ-tile--${organ.id}`}
        >
          {/* Decorative corner rivet */}
          <span className="gt-organ-tile__rivet" aria-hidden="true" />

          {/* Hand-written inline SVG icon */}
          <span className="gt-organ-tile__icon-wrapper" aria-hidden="true">
            <OrganIcon id={organ.id} className="gt-organ-tile__icon" />
          </span>

          {/* Tile content: Title + descriptive line */}
          <span className="gt-organ-tile__content">
            <span className="gt-organ-tile__title">{organ.title}</span>
            <span className="gt-organ-tile__line">{organ.line}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
