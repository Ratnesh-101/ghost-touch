import { describe, it, expect, vi } from 'vitest';
import {
  fallbackPulse,
  MIN_FALLBACK_PULSE_MS,
  WebHapticDriver,
} from '../src/drivers/haptics';

describe('WebHapticDriver', () => {
  it('reports unsupported and returns false when there is no host', () => {
    const driver = new WebHapticDriver(undefined);
    expect(driver.supported).toBe(false);
    expect(driver.vibrate(80)).toBe(false);
    expect(driver.lastResult).toBe(false);
  });

  it('reports unsupported when the host has no vibrate function', () => {
    const driver = new WebHapticDriver({});
    expect(driver.supported).toBe(false);
    expect(driver.vibrate([50, 90, 50])).toBe(false);
  });

  it('passes the pattern through and records the browser return value', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.supported).toBe(true);
    expect(driver.lastResult).toBeNull();
    expect(driver.vibrate([50, 90, 50])).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([50, 90, 50]);
    expect(driver.lastResult).toBe(true);
  });

  it('records a false return from the browser', () => {
    const driver = new WebHapticDriver({ vibrate: () => false });
    expect(driver.vibrate(80)).toBe(false);
    expect(driver.lastResult).toBe(false);
  });

  it('never throws when the browser throws', () => {
    const driver = new WebHapticDriver({
      vibrate: () => {
        throw new Error('no user activation');
      },
    });
    expect(driver.vibrate(80)).toBe(false);
    expect(driver.lastResult).toBe(false);
  });

  it('falls back to a single 100 ms pulse when the array pattern is rejected', () => {
    const vibrate = vi.fn((p: number | number[]) => !Array.isArray(p));
    const driver = new WebHapticDriver({ vibrate });
    expect(driver.vibrate([50, 90, 50])).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith(100);
  });

  it('calls a working host exactly once with the unchanged pattern', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    const driver = new WebHapticDriver({ vibrate });
    const pattern = [50, 90, 50];
    expect(driver.vibrate(pattern)).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(pattern);
  });

  it('retries exactly once with fallbackPulse when a host returns false for an array', () => {
    const vibrate = vi.fn((p: number | number[]) => !Array.isArray(p));
    const driver = new WebHapticDriver({ vibrate });
    const pattern = [50, 90, 50];
    expect(driver.vibrate(pattern)).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenNthCalledWith(1, pattern);
    expect(vibrate).toHaveBeenNthCalledWith(2, 100);
  });

  it('stop() vibrates with 0', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    new WebHapticDriver({ vibrate }).stop();
    expect(vibrate).toHaveBeenCalledWith(0);
  });

  it('stop() is safe when vibration is unsupported', () => {
    expect(() => new WebHapticDriver(undefined).stop()).not.toThrow();
  });
});

describe('fallbackPulse', () => {
  it('never returns less than 100 and equals max(sum of ON entries, 100)', () => {
    expect(MIN_FALLBACK_PULSE_MS).toBe(100);
    expect(fallbackPulse([50, 90, 50])).toBe(100);
    expect(fallbackPulse([80, 10, 80])).toBe(160);
    expect(fallbackPulse([10])).toBe(100);
    expect(fallbackPulse([])).toBe(100);
    expect(fallbackPulse([0, 50, 0])).toBe(100);
    expect(fallbackPulse([150, 20, 30])).toBe(180);
    expect(fallbackPulse([-10, 50])).toBe(100);
  });
});

