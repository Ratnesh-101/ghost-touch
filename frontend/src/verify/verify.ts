/**
 * Moved: the Spec Ghost module now lives in `frontend/src/core/verify.ts` (pure core, Kiro,
 * task 29). This file only re-exports it so imports that still use this path keep working
 * (`App.tsx` and agy's `tests/verify.test.ts`; `App.tsx` was not to be edited while lane k1 was
 * merged). New code should import from `../core/verify`.
 */
export * from '../core/verify';
