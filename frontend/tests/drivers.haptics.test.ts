import { describe, it, expect, vi } from 'vitest';
import { WebHapticDriver } from '../src/drivers/haptics';

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

  it('stop() vibrates with 0', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    new WebHapticDriver({ vibrate }).stop();
    expect(vibrate).toHaveBeenCalledWith(0);
  });

  it('stop() is safe when vibration is unsupported', () => {
    expect(() => new WebHapticDriver(undefined).stop()).not.toThrow();
  });
});
