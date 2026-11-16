/**
 * Run-count knob for property tests (task 62).
 *
 * `runs(n)` is `n` by default. Setting the environment variable `FC_RUNS_MULT` (for example
 * `FC_RUNS_MULT=10` for a soak run, or `0.5` for a quick one) scales every call. The result is
 * rounded up and is never below 1, and a missing, zero, negative or non-numeric multiplier
 * means 1. `process.env` is read through `globalThis` so the test tsconfig needs no node types.
 */
export function runs(n: number): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const raw = Number(env?.FC_RUNS_MULT);
  const mult = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return Math.max(1, Math.ceil(n * mult));
}
