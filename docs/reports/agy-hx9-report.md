# AGY Lane HX9 Report

## Lane
**hx9**: keep low-end phones alive during photo decode, and keep saved diagrams.

## Files Changed
- [frontend/src/drivers/camera.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx9/frontend/src/drivers/camera.ts): Updated `decodeWithBitmap` to try downscaling with `resizeWidth: MAX_IMAGE_SIDE` and `resizeQuality: 'medium'`. If the decoded height exceeds `MAX_IMAGE_SIDE` (portrait orientation), the first bitmap is closed immediately and retried with `resizeHeight: MAX_IMAGE_SIDE`. If resize options reject, it catches and falls back to today's unresized call (`imageOrientation: 'from-image'`). If that rejects, `decode` falls back to `decodeWithImageElement` (`<img>`). Exported `decodeWithBitmap`, `decode`, and `DecodedImage` for testing.
- [frontend/src/drivers/persist.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx9/frontend/src/drivers/persist.ts) (new): Created `requestPersistentStorage()`, which calls `navigator.storage?.persist?.()` at most once per page load inside `try/catch` and resolves to a boolean (`Promise<boolean>`). Never throws, never rejects, and never speaks. Included `resetPersistentStorageForTest()` for unit testing.
- [frontend/src/flow/saved.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx9/frontend/src/flow/saved.ts): Added fire-and-forget `void requestPersistentStorage()` call upon successful save in both the atomic `putWithEviction` and non-atomic paths of `saveDiagramWithEviction`.

## Tests Added
- [frontend/tests/hx9.camera.test.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx9/frontend/tests/hx9.camera.test.ts) (new):
  - Landscape input downscaled so long side is at most 1600 px (tested 1600x1200).
  - Portrait input downscaled so long side is at most 1600 px (tested 1200x1600).
  - Discarded first bitmap in portrait retry is closed immediately.
  - Square input (1600x1600) accepted without retry.
  - Upscaled smaller image accepted without retry.
  - Rejecting resize call falls back to today's unresized call.
  - Portrait retry rejecting falls back to today's call and closes discarded first bitmap.
  - Both `createImageBitmap` calls rejecting falls back to the `<img>` element path (`decodeWithImageElement`).
  - Active bitmaps closed when `release()` is called.
- [frontend/tests/hx9.persist.test.ts](file:///C:/Users/Admin/Downloads/ghost-touch-main/gt-lane-hx9/frontend/tests/hx9.persist.test.ts) (new):
  - `requestPersistentStorage()` resolves to `true` when granted.
  - `requestPersistentStorage()` resolves to `false` when denied.
  - Persist requested at most once per page load across multiple calls.
  - Concurrent calls to `requestPersistentStorage()` invoke `persist()` only once.
  - Missing `navigator.storage` handled gracefully (resolves `false`, no throw).
  - Missing `navigator` handled gracefully (resolves `false`, no throw).
  - Missing `persist` method on `navigator.storage` handled gracefully.
  - Synchronous exception in `persist()` caught (resolves `false`, no throw).
  - Asynchronous rejection in `persist()` caught (resolves `false`, no throw).
  - Never speaks.
  - Integration with `saveDiagramWithEviction`: persist is requested once after two successful saves.
  - Missing `navigator.storage` during save does not cause failure.
  - Failed save does not trigger persistent storage request.
  - `all_pinned` failure does not trigger persistent storage request.
  - Atomic `putWithEviction` triggers persistent storage request on success.

## What Could Not Be Verified
- In accordance with the headless run rules ("Do NOT run any shell command. No npm, npx, python, pytest, ruff, git, curl. The orchestrator runs all gates"), no shell commands (`npm test`, `tsc`, `vite build`) were run. All gates are left for the orchestrator to run.
- Real hardware storage eviction behavior under low-memory Android environments could not be verified directly.
