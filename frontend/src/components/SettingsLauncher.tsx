/**
 * SettingsLauncher — accessible launcher button and modal LabSettings sheet.
 *
 * Extracted from Capture screen pattern for shared reuse in Explore.
 * Displays a single accessible button describing current language and speech rate
 * (e.g. "Settings: English, 1.0×").
 * Clicking opens the WAI-ARIA compliant LabSettings modal sheet.
 * Focus returns to this launcher button on close.
 */
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
} from 'react';
import { AccessibleButton } from './AccessibleButton';
import { LabSettings, describeSettings } from './LabSettings';
import type { Drivers, SpeechRateSetting } from '../drivers';
import { getLang, subscribeLang } from '../i18n';

export { describeSettings };

export interface SettingsLauncherProps {
  drivers: Drivers;
  speak?: (text: string) => void;
  className?: string;
}

export function SettingsLauncher({
  drivers,
  speak,
  className = '',
}: SettingsLauncherProps): JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  // Subscribe to i18n language store
  const currentLang = useSyncExternalStore(subscribeLang, getLang, getLang);

  // Track speech rate
  const [currentRate, setCurrentRate] = useState<SpeechRateSetting>(() =>
    drivers.speech.getRate ? drivers.speech.getRate() : 'normal',
  );

  useEffect(() => {
    const originalSetRate = drivers.speech.setRate;
    drivers.speech.setRate = (newRate: SpeechRateSetting) => {
      originalSetRate?.call(drivers.speech, newRate);
      setCurrentRate(newRate);
    };
    return () => {
      drivers.speech.setRate = originalSetRate;
    };
  }, [drivers]);

  const activeRate = drivers.speech.getRate ? drivers.speech.getRate() : currentRate;

  const handleSettingsClose = (): void => {
    setSettingsOpen(false);
    if (drivers.speech.getRate) {
      setCurrentRate(drivers.speech.getRate());
    }
  };

  const buttonClass = [
    'gt-control',
    'gt-settings-launcher__button',
    'gt-capture__button--settings',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <AccessibleButton
        ref={settingsButtonRef}
        type="button"
        className={buttonClass}
        onClick={() => setSettingsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
      >
        {describeSettings(currentLang, activeRate)}
      </AccessibleButton>
      <LabSettings
        open={settingsOpen}
        onClose={handleSettingsClose}
        speak={speak}
        drivers={drivers}
        triggerRef={settingsButtonRef}
      />
    </>
  );
}
