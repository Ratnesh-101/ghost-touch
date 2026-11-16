/**
 * Service Worker Update Watcher driver — Lane hx7.
 *
 * Never strand a user on stale code, and never reload under a finger.
 * Listens for service worker controllerchange events and coordinates safe reloads.
 * All operations wrapped in try/catch.
 */

export const RELOADED_STORAGE_KEY = 'gt_reloaded';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ServiceWorkerContainerLike {
  controller?: unknown;
  addEventListener(type: string, listener: (ev?: unknown) => void): void;
  removeEventListener?(type: string, listener: (ev?: unknown) => void): void;
}

export interface UpdateWatcherOptions {
  sw?: ServiceWorkerContainerLike | null;
  reload?: () => void;
  storage?: StorageLike | null;
}

export interface UpdateWatcher {
  onUpdate: (listener: () => void) => () => void;
  reloadOnce: (reason?: string) => boolean;
  dispose?: () => void;
}

const defaultReload = (): void => {
  try {
    if (
      typeof window !== 'undefined' &&
      window.location &&
      typeof window.location.reload === 'function'
    ) {
      window.location.reload();
    }
  } catch {
    // ignore reload failure
  }
};

export function createUpdateWatcher(options: UpdateWatcherOptions = {}): UpdateWatcher {
  const sw: ServiceWorkerContainerLike | null =
    options.sw !== undefined
      ? options.sw
      : typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : null;

  const storage: StorageLike | null =
    options.storage !== undefined
      ? options.storage
      : typeof sessionStorage !== 'undefined'
        ? sessionStorage
        : null;

  const reload: () => void = options.reload ?? defaultReload;

  const listeners = new Set<() => void>();

  // Determine whether an existing controller was already active on initialisation.
  // If sw.controller is null / falsy initially, this is a fresh install.
  // The very first controllerchange event represents the fresh install activating
  // and claiming clients, and must be ignored.
  let hadInitialController = false;
  try {
    if (sw && 'controller' in sw) {
      hadInitialController = Boolean(sw.controller);
    }
  } catch {
    hadInitialController = false;
  }

  const handleControllerChange = (): void => {
    try {
      if (!hadInitialController) {
        hadInitialController = true;
        return; // ignore the very first controller of a fresh install
      }
      for (const listener of Array.from(listeners)) {
        try {
          listener();
        } catch {
          // ignore listener errors
        }
      }
    } catch {
      // ignore
    }
  };

  try {
    if (sw && typeof sw.addEventListener === 'function') {
      sw.addEventListener('controllerchange', handleControllerChange);
    }
  } catch {
    // ignore
  }

  let inMemoryReloaded = false;

  const reloadOnce = (reason?: string): boolean => {
    try {
      let alreadyReloaded = inMemoryReloaded;
      if (storage) {
        try {
          if (storage.getItem(RELOADED_STORAGE_KEY)) {
            alreadyReloaded = true;
          }
        } catch {
          // ignore storage read error
        }
      }

      if (alreadyReloaded) {
        return false;
      }

      inMemoryReloaded = true;

      if (storage) {
        try {
          storage.setItem(RELOADED_STORAGE_KEY, reason ?? '1');
        } catch {
          // ignore storage write error
        }
      }

      reload();
      return true;
    } catch {
      return false;
    }
  };

  const onUpdate = (listener: () => void): (() => void) => {
    try {
      listeners.add(listener);
    } catch {
      // ignore
    }
    return () => {
      try {
        listeners.delete(listener);
      } catch {
        // ignore
      }
    };
  };

  const dispose = (): void => {
    try {
      if (sw && typeof sw.removeEventListener === 'function') {
        sw.removeEventListener('controllerchange', handleControllerChange);
      }
      listeners.clear();
    } catch {
      // ignore
    }
  };

  return {
    onUpdate,
    reloadOnce,
    dispose,
  };
}

let defaultWatcher: UpdateWatcher | null = null;

export function getDefaultUpdateWatcher(): UpdateWatcher {
  if (!defaultWatcher) {
    defaultWatcher = createUpdateWatcher();
  }
  return defaultWatcher;
}

export function reloadOnce(reason?: string): boolean {
  return getDefaultUpdateWatcher().reloadOnce(reason);
}

export function _resetDefaultWatcherForTests(): void {
  defaultWatcher?.dispose?.();
  defaultWatcher = null;
}
