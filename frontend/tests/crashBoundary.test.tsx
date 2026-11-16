// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashScreen } from '../src/components/CrashScreen';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { _resetCrashGuardStateForTests } from '../src/drivers/crashGuard';
import { t } from '../src/i18n';

describe('ErrorBoundary & CrashScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let speakMock: ReturnType<typeof vi.fn>;
  let cancelMock: ReturnType<typeof vi.fn>;
  let vibrateMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  class MockUtterance {
    text: string;
    lang = '';
    constructor(text: string) {
      this.text = text;
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    _resetCrashGuardStateForTests();

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    speakMock = vi.fn();
    cancelMock = vi.fn();
    vibrateMock = vi.fn().mockReturnValue(true);

    vi.stubGlobal('speechSynthesis', { speak: speakMock, cancel: cancelMock });
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    window.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;
    vi.stubGlobal('navigator', { vibrate: vibrateMock });

    // React logs error details to console.error when a boundary catches an error.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function CrashingChild(): never {
    throw new Error('Simulated runtime error in child component');
  }

  function SafeChild(): React.JSX.Element {
    return <div data-testid="safe-child">Normal content</div>;
  }

  it('renders children normally when no error occurs', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <SafeChild />
        </ErrorBoundary>,
      );
    });

    expect(container.querySelector('[data-testid="safe-child"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(speakMock).not.toHaveBeenCalled();
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('boundary shows the screen and speaks once when a child throws', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <CrashingChild />
        </ErrorBoundary>,
      );
    });

    // Alert screen is rendered
    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
    expect(alertEl?.textContent).toContain(t('crash.message'));

    // Speech synthesis called once
    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0]?.[0] as MockUtterance | undefined;
    expect(utterance?.text).toBe(t('crash.message'));
  });

  it('vibrate(0) called when an error is caught', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <CrashingChild />
        </ErrorBoundary>,
      );
    });

    expect(vibrateMock).toHaveBeenCalledWith(0);
    expect(cancelMock).toHaveBeenCalledTimes(1);
  });

  it('button has a name and the 48 px class, and is focused on mount', async () => {
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <CrashingChild />
        </ErrorBoundary>,
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();

    // Has an accessible name matching crash.restart
    const name = button?.getAttribute('aria-label') || button?.textContent;
    expect(name).toContain(t('crash.restart'));

    // Has the 48 px class (gt-control)
    expect(button?.classList.contains('gt-control')).toBe(true);

    // Button is focused on mount
    expect(document.activeElement).toBe(button);
  });

  it('second error inside 5 s is silent', async () => {
    // First crash at t = 0
    await act(async () => {
      root.render(
        <ErrorBoundary>
          <CrashingChild />
        </ErrorBoundary>,
      );
    });
    expect(speakMock).toHaveBeenCalledTimes(1);

    // Second crash within 5 seconds (advance 2000 ms)
    vi.advanceTimersByTime(2000);

    const secondContainer = document.createElement('div');
    document.body.appendChild(secondContainer);
    const secondRoot = createRoot(secondContainer);

    await act(async () => {
      secondRoot.render(
        <ErrorBoundary>
          <CrashingChild />
        </ErrorBoundary>,
      );
    });

    // Speech synthesis was NOT called a second time (silent within 5 s)
    expect(speakMock).toHaveBeenCalledTimes(1);

    // After 5 seconds elapsed (advance 3001 ms, total 5001 ms)
    vi.advanceTimersByTime(3001);

    const thirdContainer = document.createElement('div');
    document.body.appendChild(thirdContainer);
    const thirdRoot = createRoot(thirdContainer);

    await act(async () => {
      thirdRoot.render(
        <ErrorBoundary>
          <CrashingChild />
        </ErrorBoundary>,
      );
    });

    // Speaks again after 5 s
    expect(speakMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondRoot.unmount();
      thirdRoot.unmount();
    });
    secondContainer.remove();
    thirdContainer.remove();
  });

  it('works when speechSynthesis and navigator.vibrate are undefined', async () => {
    vi.stubGlobal('speechSynthesis', undefined);
    vi.stubGlobal('navigator', {});

    await act(async () => {
      root.render(
        <ErrorBoundary>
          <CrashingChild />
        </ErrorBoundary>,
      );
    });

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
    expect(alertEl?.textContent).toContain(t('crash.message'));
    expect(container.querySelector('button')?.classList.contains('gt-control')).toBe(true);
  });

  it('CrashScreen directly renders role="alert", message, restart button with gt-control and handles restart', async () => {
    const onRestartMock = vi.fn();

    await act(async () => {
      root.render(<CrashScreen onRestart={onRestartMock} />);
    });

    const alertEl = container.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
    expect(alertEl?.textContent).toContain(t('crash.message'));

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.classList.contains('gt-control')).toBe(true);
    expect(document.activeElement).toBe(button);

    // Click restart button
    button?.click();
    expect(onRestartMock).toHaveBeenCalledTimes(1);
  });
});
