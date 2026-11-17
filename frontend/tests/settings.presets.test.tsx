// @vitest-environment jsdom
/**
 * Presets and More Settings Tests (Lane ux10)
 *
 * Verifies:
 * - choosing each preset sets all six settings
 * - flipping one switch shows Custom
 * - names do not change when toggled
 * - the disclosure is collapsed on open
 * - garbage in storage yields defaults
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabSettings } from '../src/components/LabSettings';
import { PRESETS, presetOf } from '../src/core/presets';
import {
  _resetCornerHeartbeatSettingForTesting,
  _resetDirectionsSettingForTesting,
  _resetFindingSoundSettingForTesting,
  _resetStickyLineSettingForTesting,
  getStoredCornerHeartbeatSetting,
  getStoredDirectionsSetting,
  getStoredFindingSoundSetting,
  getStoredStickyLineSetting,
  safeSet,
  setStoredCornerHeartbeatSetting,
  setStoredDirectionsSetting,
  setStoredFindingSoundSetting,
  setStoredStickyLineSetting,
  STORAGE_KEY_CORNER_HEARTBEAT,
  STORAGE_KEY_DIRECTIONS,
  STORAGE_KEY_FINDING_SOUND,
  STORAGE_KEY_STICKY_LINE,
} from '../src/drivers/storage';
import {
  _resetGraphScanSettingForTesting,
  _resetSpeechDetailSettingForTesting,
  getStoredGraphScanSetting,
  getStoredSpeechDetailSetting,
} from '../src/flow/explore';
import { getLang, setLang, t, type Lang } from '../src/i18n';
import type { Drivers } from '../src/drivers';
import type { SpeechRateSetting } from '../src/drivers/speech';
import { MemoryDiagramStore } from '../src/drivers';

function createMockDrivers(): Drivers {
  return {
    haptics: { supported: true, lastResult: null, vibrate: vi.fn(), stop: vi.fn() },
    audio: { unlock: vi.fn(), setTone: vi.fn(), beep: vi.fn(), playEarcon: vi.fn(), state: 'locked' },
    speech: {
      speak: vi.fn(),
      listen: vi.fn(),
      canSpeak: true,
      canListen: true,
      getRate: vi.fn((): SpeechRateSetting => 'normal'),
      setRate: vi.fn(),
    },
    diagramStore: new MemoryDiagramStore(),
  };
}

describe('Lane ux10: Presets, Disclosure, and Storage Tests', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let prevLang: Lang;

  beforeEach(() => {
    vi.stubEnv('VITE_FEATURE_GUIDE', '1');
    vi.stubEnv('VITE_FEATURE_SHARE', '1');

    prevLang = getLang();
    setLang('en');

    _resetDirectionsSettingForTesting();
    _resetFindingSoundSettingForTesting();
    _resetStickyLineSettingForTesting();
    _resetCornerHeartbeatSettingForTesting();
    _resetGraphScanSettingForTesting();
    _resetSpeechDetailSettingForTesting();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;

    setLang(prevLang);
    vi.unstubAllEnvs();
  });

  it('choosing each preset sets all six settings', async () => {
    const drivers = createMockDrivers();
    const speakMock = vi.fn();

    await act(async () => {
      root?.render(
        <LabSettings
          open={true}
          onClose={vi.fn()}
          speak={speakMock}
          drivers={drivers}
        />,
      );
    });

    // Verify radiogroup exists with 3 radios
    const radiogroup = container?.querySelector('div[role="radiogroup"]');
    expect(radiogroup).not.toBeNull();
    const radios = container?.querySelectorAll('button[role="radio"]');
    expect(radios?.length).toBe(3);

    const simpleRadio = container?.querySelector(
      'button[role="radio"][aria-label="Simple"]',
    ) as HTMLButtonElement | null;
    const standardRadio = container?.querySelector(
      'button[role="radio"][aria-label="Standard"]',
    ) as HTMLButtonElement | null;
    const explorerRadio = container?.querySelector(
      'button[role="radio"][aria-label="Explorer"]',
    ) as HTMLButtonElement | null;

    expect(simpleRadio).not.toBeNull();
    expect(standardRadio).not.toBeNull();
    expect(explorerRadio).not.toBeNull();

    // 1. Click Simple preset
    await act(async () => {
      simpleRadio?.click();
    });

    expect(getStoredSpeechDetailSetting()).toBe(PRESETS.simple.speechDetail);
    expect(getStoredDirectionsSetting()).toBe(PRESETS.simple.directions);
    expect(getStoredFindingSoundSetting()).toBe(PRESETS.simple.findingSound);
    expect(getStoredGraphScanSetting()).toBe(PRESETS.simple.graphScan);
    expect(getStoredStickyLineSetting()).toBe(PRESETS.simple.stickyLine);
    expect(getStoredCornerHeartbeatSetting()).toBe(PRESETS.simple.cornerHeartbeat);

    expect(simpleRadio?.getAttribute('aria-checked')).toBe('true');
    expect(standardRadio?.getAttribute('aria-checked')).toBe('false');
    expect(explorerRadio?.getAttribute('aria-checked')).toBe('false');

    const simpleState = {
      speechDetail: getStoredSpeechDetailSetting(),
      directions: getStoredDirectionsSetting(),
      findingSound: getStoredFindingSoundSetting(),
      graphScan: getStoredGraphScanSetting(),
      stickyLine: getStoredStickyLineSetting(),
      cornerHeartbeat: getStoredCornerHeartbeatSetting(),
    };
    expect(presetOf(simpleState)).toBe('simple');

    // 2. Click Explorer preset
    await act(async () => {
      explorerRadio?.click();
    });

    expect(getStoredSpeechDetailSetting()).toBe(PRESETS.explorer.speechDetail);
    expect(getStoredDirectionsSetting()).toBe(PRESETS.explorer.directions);
    expect(getStoredFindingSoundSetting()).toBe(PRESETS.explorer.findingSound);
    expect(getStoredGraphScanSetting()).toBe(PRESETS.explorer.graphScan);
    expect(getStoredStickyLineSetting()).toBe(PRESETS.explorer.stickyLine);
    expect(getStoredCornerHeartbeatSetting()).toBe(PRESETS.explorer.cornerHeartbeat);

    expect(simpleRadio?.getAttribute('aria-checked')).toBe('false');
    expect(standardRadio?.getAttribute('aria-checked')).toBe('false');
    expect(explorerRadio?.getAttribute('aria-checked')).toBe('true');

    const explorerState = {
      speechDetail: getStoredSpeechDetailSetting(),
      directions: getStoredDirectionsSetting(),
      findingSound: getStoredFindingSoundSetting(),
      graphScan: getStoredGraphScanSetting(),
      stickyLine: getStoredStickyLineSetting(),
      cornerHeartbeat: getStoredCornerHeartbeatSetting(),
    };
    expect(presetOf(explorerState)).toBe('explorer');

    // 3. Click Standard preset
    await act(async () => {
      standardRadio?.click();
    });

    expect(getStoredSpeechDetailSetting()).toBe(PRESETS.standard.speechDetail);
    expect(getStoredDirectionsSetting()).toBe(PRESETS.standard.directions);
    expect(getStoredFindingSoundSetting()).toBe(PRESETS.standard.findingSound);
    expect(getStoredGraphScanSetting()).toBe(PRESETS.standard.graphScan);
    expect(getStoredStickyLineSetting()).toBe(PRESETS.standard.stickyLine);
    expect(getStoredCornerHeartbeatSetting()).toBe(PRESETS.standard.cornerHeartbeat);

    expect(simpleRadio?.getAttribute('aria-checked')).toBe('false');
    expect(standardRadio?.getAttribute('aria-checked')).toBe('true');
    expect(explorerRadio?.getAttribute('aria-checked')).toBe('false');

    // 4. Reset button applies Standard
    await act(async () => {
      simpleRadio?.click();
    });
    expect(simpleRadio?.getAttribute('aria-checked')).toBe('true');

    const resetBtn = container?.querySelector('.gt-preset-reset-btn') as HTMLButtonElement | null;
    expect(resetBtn).not.toBeNull();
    await act(async () => {
      resetBtn?.click();
    });

    expect(getStoredSpeechDetailSetting()).toBe(PRESETS.standard.speechDetail);
    expect(getStoredDirectionsSetting()).toBe(PRESETS.standard.directions);
    expect(getStoredFindingSoundSetting()).toBe(PRESETS.standard.findingSound);
    expect(getStoredGraphScanSetting()).toBe(PRESETS.standard.graphScan);
    expect(getStoredStickyLineSetting()).toBe(PRESETS.standard.stickyLine);
    expect(getStoredCornerHeartbeatSetting()).toBe(PRESETS.standard.cornerHeartbeat);

    expect(standardRadio?.getAttribute('aria-checked')).toBe('true');
  });

  it('flipping one switch shows Custom', async () => {
    const drivers = createMockDrivers();

    await act(async () => {
      root?.render(
        <LabSettings
          open={true}
          onClose={vi.fn()}
          drivers={drivers}
        />,
      );
    });

    const standardRadio = container?.querySelector(
      'button[role="radio"][aria-label="Standard"]',
    ) as HTMLButtonElement | null;
    expect(standardRadio?.getAttribute('aria-checked')).toBe('true');

    // Initially standard is active, so "Custom" status badge is not visible
    expect(container?.querySelector('.gt-preset-status')).toBeNull();

    // Flip finding sound switch inside more settings
    const findingSoundSection = container?.querySelector(
      'section[aria-labelledby="lab-settings-section-finding-sound"]',
    );
    const findingSoundSwitch = findingSoundSection?.querySelector(
      'button[role="switch"]',
    ) as HTMLButtonElement | null;
    expect(findingSoundSwitch).not.toBeNull();
    expect(findingSoundSwitch?.getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      findingSoundSwitch?.click();
    });

    // Finding sound is now false, while other standard settings remain unchanged
    expect(findingSoundSwitch?.getAttribute('aria-checked')).toBe('false');
    expect(getStoredFindingSoundSetting()).toBe(false);

    // Shows "Custom"
    const customStatus = container?.querySelector('.gt-preset-status');
    expect(customStatus).not.toBeNull();
    expect(customStatus?.textContent?.trim()).toBe('Custom');

    // None of the presets should be aria-checked
    const radios = container?.querySelectorAll('button[role="radio"]');
    radios?.forEach((r) => {
      expect(r.getAttribute('aria-checked')).toBe('false');
    });

    // Flipping it back restores Standard
    await act(async () => {
      findingSoundSwitch?.click();
    });
    expect(findingSoundSwitch?.getAttribute('aria-checked')).toBe('true');
    expect(container?.querySelector('.gt-preset-status')).toBeNull();
    expect(standardRadio?.getAttribute('aria-checked')).toBe('true');
  });

  it('names do not change when toggled', async () => {
    const drivers = createMockDrivers();

    await act(async () => {
      root?.render(
        <LabSettings
          open={true}
          onClose={vi.fn()}
          drivers={drivers}
        />,
      );
    });

    // 1. Directions
    const dirSection = container?.querySelector('section[aria-labelledby="lab-settings-section-directions"]');
    const dirSwitch = dirSection?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    const initialDirText = dirSwitch?.textContent?.trim();
    expect(initialDirText).toBe(t('lab.settings.directions'));
    await act(async () => {
      dirSwitch?.click();
    });
    expect(dirSwitch?.textContent?.trim()).toBe(initialDirText);
    await act(async () => {
      dirSwitch?.click();
    });
    expect(dirSwitch?.textContent?.trim()).toBe(initialDirText);

    // 2. Finding sound
    const fsSection = container?.querySelector('section[aria-labelledby="lab-settings-section-finding-sound"]');
    const fsSwitch = fsSection?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    const initialFsText = fsSwitch?.textContent?.trim();
    expect(initialFsText).toBe(t('lab.settings.findingSound'));
    await act(async () => {
      fsSwitch?.click();
    });
    expect(fsSwitch?.textContent?.trim()).toBe(initialFsText);

    // 3. Sticky line
    const slSection = container?.querySelector('section[aria-labelledby="lab-settings-section-sticky-line"]');
    const slSwitch = slSection?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    const initialSlText = slSwitch?.textContent?.trim();
    expect(initialSlText).toBe(t('lab.settings.stickyLine'));
    await act(async () => {
      slSwitch?.click();
    });
    expect(slSwitch?.textContent?.trim()).toBe(initialSlText);

    // 4. Graph scan (previously changed name dynamically between on/off)
    const gsSection = container?.querySelector('section[aria-labelledby="lab-settings-section-graph-scan"]');
    const gsSwitch = gsSection?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    const initialGsText = gsSwitch?.textContent?.trim();
    expect(initialGsText).toBe(t('lab.settings.graphScan'));
    await act(async () => {
      gsSwitch?.click();
    });
    expect(gsSwitch?.textContent?.trim()).toBe(initialGsText);
    await act(async () => {
      gsSwitch?.click();
    });
    expect(gsSwitch?.textContent?.trim()).toBe(initialGsText);

    // 5. Corner heartbeat
    const hbSection = container?.querySelector('section[aria-labelledby="lab-settings-section-corner-heartbeat"]');
    const hbSwitch = hbSection?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    const initialHbText = hbSwitch?.textContent?.trim();
    expect(initialHbText).toBe(t('lab.settings.cornerHeartbeat'));
    await act(async () => {
      hbSwitch?.click();
    });
    expect(hbSwitch?.textContent?.trim()).toBe(initialHbText);

    // 6. Guide (previously changed name dynamically between on/off)
    const guideSection = container?.querySelector('section[aria-labelledby="lab-settings-section-guide"]');
    const guideSwitch = guideSection?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    const initialGuideText = guideSwitch?.textContent?.trim();
    expect(initialGuideText).toBe(t('lab.settings.guide'));
    await act(async () => {
      guideSwitch?.click();
    });
    expect(guideSwitch?.textContent?.trim()).toBe(initialGuideText);
    await act(async () => {
      guideSwitch?.click();
    });
    expect(guideSwitch?.textContent?.trim()).toBe(initialGuideText);

    // 7. Teacher
    const teacherSection = container?.querySelector('section[aria-labelledby="lab-settings-section-teacher"]');
    const teacherSwitch = teacherSection?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    const initialTeacherText = teacherSwitch?.textContent?.trim();
    expect(initialTeacherText).toBe(t('lab.settings.teacher'));
    await act(async () => {
      teacherSwitch?.click();
    });
    expect(teacherSwitch?.textContent?.trim()).toBe(initialTeacherText);
  });

  it('the disclosure is collapsed on open', async () => {
    const drivers = createMockDrivers();

    await act(async () => {
      root?.render(
        <LabSettings
          open={true}
          onClose={vi.fn()}
          drivers={drivers}
        />,
      );
    });

    const moreToggle = container?.querySelector(
      '.gt-lab-settings__more-toggle',
    ) as HTMLButtonElement | null;
    expect(moreToggle).not.toBeNull();
    expect(moreToggle?.getAttribute('aria-expanded')).toBe('false');

    const moreContent = container?.querySelector('#lab-settings-more-content');
    expect(moreContent).not.toBeNull();
    expect(moreContent?.hasAttribute('hidden')).toBe(true);

    // Click to expand
    await act(async () => {
      moreToggle?.click();
    });
    expect(moreToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(moreContent?.hasAttribute('hidden')).toBe(false);

    // Click to collapse
    await act(async () => {
      moreToggle?.click();
    });
    expect(moreToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(moreContent?.hasAttribute('hidden')).toBe(true);

    // Reopening sheet resets disclosure to collapsed
    await act(async () => {
      moreToggle?.click();
    });
    expect(moreToggle?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      root?.render(
        <LabSettings
          open={false}
          onClose={vi.fn()}
          drivers={drivers}
        />,
      );
    });

    await act(async () => {
      root?.render(
        <LabSettings
          open={true}
          onClose={vi.fn()}
          drivers={drivers}
        />,
      );
    });

    const reopenedToggle = container?.querySelector('.gt-lab-settings__more-toggle');
    const reopenedContent = container?.querySelector('#lab-settings-more-content');
    expect(reopenedToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(reopenedContent?.hasAttribute('hidden')).toBe(true);
  });

  it('garbage in storage yields defaults', () => {
    // 1. Directions (default: true)
    _resetDirectionsSettingForTesting();
    for (const junk of ['garbage', 'TRUE', '1', 'yes', ' true', 'null', 'undefined', '']) {
      safeSet(STORAGE_KEY_DIRECTIONS, junk);
      expect(getStoredDirectionsSetting()).toBe(true);
    }
    safeSet(STORAGE_KEY_DIRECTIONS, 'false');
    expect(getStoredDirectionsSetting()).toBe(false);
    safeSet(STORAGE_KEY_DIRECTIONS, 'true');
    expect(getStoredDirectionsSetting()).toBe(true);

    // In-memory value wins over stale stored value
    setStoredDirectionsSetting(false);
    safeSet(STORAGE_KEY_DIRECTIONS, 'true');
    expect(getStoredDirectionsSetting()).toBe(false);
    _resetDirectionsSettingForTesting();

    // 2. Finding sound (default: true)
    _resetFindingSoundSettingForTesting();
    for (const junk of ['garbage', 'TRUE', '1', 'yes', 'falsey', '']) {
      safeSet(STORAGE_KEY_FINDING_SOUND, junk);
      expect(getStoredFindingSoundSetting()).toBe(true);
    }
    safeSet(STORAGE_KEY_FINDING_SOUND, 'false');
    expect(getStoredFindingSoundSetting()).toBe(false);
    safeSet(STORAGE_KEY_FINDING_SOUND, 'true');
    expect(getStoredFindingSoundSetting()).toBe(true);

    setStoredFindingSoundSetting(false);
    safeSet(STORAGE_KEY_FINDING_SOUND, 'true');
    expect(getStoredFindingSoundSetting()).toBe(false);
    _resetFindingSoundSettingForTesting();

    // 3. Sticky line (default: false)
    _resetStickyLineSettingForTesting();
    for (const junk of ['garbage', 'TRUE', '1', 'yes', ' truthy', '']) {
      safeSet(STORAGE_KEY_STICKY_LINE, junk);
      expect(getStoredStickyLineSetting()).toBe(false);
    }
    safeSet(STORAGE_KEY_STICKY_LINE, 'true');
    expect(getStoredStickyLineSetting()).toBe(true);
    safeSet(STORAGE_KEY_STICKY_LINE, 'false');
    expect(getStoredStickyLineSetting()).toBe(false);

    setStoredStickyLineSetting(true);
    safeSet(STORAGE_KEY_STICKY_LINE, 'false');
    expect(getStoredStickyLineSetting()).toBe(true);
    _resetStickyLineSettingForTesting();

    // 4. Corner heartbeat (default: false)
    _resetCornerHeartbeatSettingForTesting();
    for (const junk of ['garbage', 'TRUE', '1', 'yes', 'on', '']) {
      safeSet(STORAGE_KEY_CORNER_HEARTBEAT, junk);
      expect(getStoredCornerHeartbeatSetting()).toBe(false);
    }
    safeSet(STORAGE_KEY_CORNER_HEARTBEAT, 'true');
    expect(getStoredCornerHeartbeatSetting()).toBe(true);
    safeSet(STORAGE_KEY_CORNER_HEARTBEAT, 'false');
    expect(getStoredCornerHeartbeatSetting()).toBe(false);

    setStoredCornerHeartbeatSetting(true);
    safeSet(STORAGE_KEY_CORNER_HEARTBEAT, 'false');
    expect(getStoredCornerHeartbeatSetting()).toBe(true);
    _resetCornerHeartbeatSettingForTesting();
  });
});
