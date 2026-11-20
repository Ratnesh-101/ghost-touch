# Kiro review of lane hi1 (commit ef0d7a6, I29a low-vision outlines)

**Verdict: FIX FIRST.** The draw code is correct and draw-only. The 2px border added to the canvas element itself (`explore.css:157`) shifts the pointer-to-bitmap mapping by up to 2 CSS px and squeezes the bitmap by 4 px. The CSS tests would not notice if the canvas border were removed.

Scope reviewed: `Explore.tsx` draw code, `explore.css`, `tests/explore.outlines.test.tsx`. I did not review `BUILD_LOG.md` or the agy report. No source file was edited (mutations were applied to a clean tree and restored; `git status` is clean).

## What checks out

- **Dark rings before fills:** vertex dot (`Explore.tsx:1078-1088`), cursor (`:1112-1122`) and guide ring (`:1129-1140`) each stroke `#000` first, then fill or stroke on top. `shadowBlur` is reset to 0 before each ring, so the 12 px green glow does not leak onto the ring.
- **No new vibrate, tone or speak:** the diff adds only `strokeStyle`, `lineWidth`, `beginPath`, `arc` and `stroke` calls. No driver, effect or `core/` file is touched. Requirement 49.6 and the draw-only promise hold by inspection.
- **No tuned value changed:** hit radii (22/14 px), `vibrate(80)`, 70 ms, `[50, 90, 50]`, 450 ms and 200 to 1000 Hz are untouched. The dot radius 6, cursor radius 5 and guide radius 14 are drawing sizes, not tuned values.
- **Kiro-owned files:** no `core/`, `.kiro/`, `*.prop.test.ts`, `schema.py` or `validate.py` change.
- **Status-line height (25.4):** `.gt-lab-status-card` keeps `height: 5rem` (`explore.css:211`), and `box-sizing: border-box` (`:212`) keeps the outer height at 5rem with the thicker border. The inner box shrinks from about 62 to 60 px. The text needs 3 x 1.45 x 14 = 60.9 px, which sits inside the 8 px padding, so nothing is clipped.
- **Verification:** `explore.outlines.test.tsx` 10/10 pass. `explore.layout`, `explore.lab` and `correct.lab` pass (74 tests). `tsc --noEmit` is clean.

## Contrast ratios (WCAG relative luminance, computed)

| Pair | Ratio |
|---|---|
| Border `#39ff88` on canvas/page bg `#0b0e0c` | 14.63 |
| Border `#39ff88` on status card bg `#121814` | 13.57 |
| Dot ring `#000` on dot fill `#e8ffe8` | 19.90 |
| Dot ring `#000` on green line `#39ff88` | 15.83 |
| Dot fill `#e8ffe8` on green line, no ring (the problem being fixed) | 1.26 |
| Cursor ring `#000` on cursor fill `#fff` | 21.00 |
| Cursor fill `#fff` on green line, no ring | 1.33 |
| Guide ring `#000` on cyan `#00f0ff` | 14.91 |
| Dark ring `#000` on canvas bg `#0b0e0c` | 1.08 |

The test's claim of at least 3:1 for the borders is true (14.6 and 13.6). The CSS adds no contrast comment of its own. The 1.08 row is expected: the ring separates the dot from the green line, not from the background. Where a dot sits off any line, only the 1.5 px of ring outside the fill (stroke spans r 4.5 to 7.5, fill covers to r 6) is visible, and it is nearly invisible on `#0b0e0c`. That is acceptable, but it means the dot is no more visible on empty background than before.

## Issues

1. **Medium (blocking) · `explore.css:157-159` (also `:797-803`) · The border on the canvas element misaligns touch and picture.**
   The canvas is `position: absolute; inset: 0; width/height: 100%`. The bitmap is sized from `container.clientWidth/clientHeight` (`Explore.tsx:1172-1173`), which is the container's padding box. With `border: 2px` and `box-sizing: border-box`, the canvas content box is 4 px smaller in each axis, so the browser scales the bitmap down by (W-4)/W (about 1.1% on a 360 px canvas) and offsets it 2 px right and down. Pointer coordinates are `clientX - rect.left` (`Explore.tsx:245-246`), and `rect` is the border box, so they ignore the offset and the scale. The picture is therefore drawn up to 2 px away from where the hit test thinks it is, worst at the left and right edges. Under `prefers-contrast: more` and `forced-colors`, the 3px rule makes this up to 3 px. The 14 and 22 px hit radii absorb this, but the project's rule is that what is felt and what is seen agree, and Requirement 25 exists because of canvas geometry drift. The border is also redundant: the container already draws a 2px green border (`:74`), so the canvas now has two nested borders.
   Fix: delete the `border` and `box-sizing` lines from `.gt-explore__canvas` and remove `.gt-explore__canvas` from the `prefers-contrast` selector list (`:797`). The container border already provides the visible edge. If a second edge is wanted, use `outline` or `box-shadow: inset`, neither of which changes the content box.

2. **Medium · `tests/explore.outlines.test.tsx:664` · The canvas-border test passes when the canvas border is removed.**
   Mutation: I deleted `border: 2px solid ...` from `.gt-explore__canvas` and the 10 tests still passed. The regex `\.gt-explore__canvas\b[^{]*{[^}]*border:\s*2px solid` matches `.gt-explore__canvas-container` (`\b` falls between `s` and `-`), and that block has the border. Line 673 has the same flaw for `.gt-lab-status-card` (it can match `--alive`). Lines 680 and 684-685 match anywhere in the file, so they prove nothing about the intended rule.
   Fix: parse the CSS with a rule-level lookup (select the block whose selector list contains exactly the class, for example `(^|[\s,])\.gt-explore__canvas\s*[,{]`) or, better, assert computed style in a browser-based test. After fixing issue 1, assert the opposite for the canvas: it has no border.

3. **Low · `tests/explore.outlines.test.tsx:669, 674` · The contrast tests are tautological.**
   They compute the ratio of two hard-coded hex strings and never read the CSS or `tokens.css`. If `--gt-line` changed, the tests would stay green. Fix: read `--gt-line` and `--gt-bg` from `tokens.css` (or `global.css`) and compute from those.

4. **Low · `tests/explore.outlines.test.tsx:577-660` · The three "trace" tests do not prove draw-only.**
   They assert only that some vibration, speech or tone happened. They do not compare against a baseline, so a stray `vibrate` added to the draw code would pass. The draw-only claim holds (by diff inspection above), but the test does not enforce it. Requirement 49.6 asks for identical effect lists with and without the change. Fix: record the `vibrate`, `setTone`, `speak`, `stopSpeaking` and `playEarcon` calls for each trace and compare them with a checked-in expected list (a snapshot taken from the parent commit).

5. **Low · `Explore.tsx:1079-1081, 1113-1115` · Drawing state is left at `#000` and 3 px after the dot loop.**
   Harmless today, because the offscreen pass restarts at `:984-997` and `draw()` sets stroke state before each later stroke. A future stroke added after the loop would inherit it. Fix: wrap each ring in `ctx.save()` and `ctx.restore()`, or leave a comment. Not required to merge.

6. **Low · `tests/explore.outlines.test.tsx:96-133` · Four `export`ed helpers (`hexToRgb`, `relativeLuminance`, `contrastRatio`) and two `@ts-expect-error` Node imports.**
   Exports from a test file are unused elsewhere. Fix: drop the `export` keywords. Not blocking.

## Mutation results

| Mutation | Result |
|---|---|
| Remove the vertex dark-ring stroke (`Explore.tsx:1078-1083`) | Caught: the vertex-dot test fails (1 of 10). The other two draw tests did not need to fail. |
| Remove the canvas `border` (`explore.css:157`) | **Not caught:** 10 of 10 pass (issue 2). |

## Needs from the owner

- Phone check on the S24+ after issue 1 is fixed: trace a line near the left and right edges and confirm the buzz starts on the drawn line, and check the dot and cursor outlines in sunlight.
- Requirement 49 (highlight, task 81) is not delivered by this commit. This is correct for I29a, but it should not be reported as covering 49.4 to 49.11.
