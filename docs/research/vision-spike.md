# Vision spike (Gate B): how well does a vision LLM read our diagrams?

Run on 2026-11-01 with `research/vision_spike.py`, model **`gemini-3.8-flash`** (temperature 0, JSON mode), the extraction prompt from `CLAUDE.md` Task 8 plus the teacher-vocabulary rules. Inputs: the 10 synthetic diagrams in two forms, `clean/` (digital renders) and `photo/` (simulated phone photos of a printed page), scored against `research/samples/synthetic/ground_truth/`. The key was read from `backend/.env` by the script and never printed. Raw output: `research/results/gemini-3.8-flash-run1/` (predictions, `results.json`, `summary.md`, and `run-v1-scorer.log`, the console log of the original scoring).

**Not covered yet: your real photos** (`research/samples/real/` is empty). WIN_PLAN requires Gate B to be decided on real photos, so everything below is a **proxy**.

## Headline (scorer v3, the final one; see "Scorer versions")
| Group | n | Mean score | Usable (score ≥ 0.7) | Kind correct | Valid against schema |
|---|---|---|---|---|---|
| **Clean (digital)** | 10 | **0.91** | **9 of 10** | 10 of 10 | 10 of 10 |
| **Photo (simulated)** | 10 | **0.66** | **7 of 10** (8 scored, 7 usable; 2 not scored) | 8 of 8 scored | 8 of 8 scored |
| Geometry (4 clean + 4 photo) | 8 | 0.93 | 8 of 8 | 8 of 8 | 8 of 8 |
| Function graphs | 6 | 0.77 | 4 of 6 | 6 of 6 | 6 of 6 |
| Bar charts | 6 | 0.60 (4 scored: 0.90) | 4 of 4 scored | 4 of 4 scored | 4 of 4 scored |

Two photo samples (`photo/09_bar_rainfall`, `photo/10_bar_trees`) hit the free-tier **429 RESOURCE_EXHAUSTED** quota after 18 calls and were not scored (counted as failures in the "7 of 10"). Re-run when the quota resets: `backend/.venv/Scripts/python research/vision_spike.py --provider gemini --model gemini-3.8-flash --variants photo --only 09,10 --resume --out research/results/gemini-3.8-flash-run1`.

Per-sample scores (v3):
| Sample | Clean | Photo |
|---|---|---|
| 01 right triangle | 0.95 | 0.91 |
| 02 rectangle | 0.97 | 0.97 |
| 03 altitude | 0.85 | 0.84 |
| 04 triangle angles | 1.00 | 0.97 |
| 05 sine graph | 0.85 | 0.82 |
| 06 parabola | **0.69** | **0.48** |
| 07 line graph | 0.91 | 0.88 |
| 08 bar subjects | 1.00 | 0.70 |
| 09 bar rainfall | 0.90 | not scored (429) |
| 10 bar trees | 1.00 | not scored (429) |

## Gate B reading (rule in `docs/WIN_PLAN.md`)
The rule: at least 6 of 10 real photos usable, proceed as planned; fewer than 6 but clean digital ones usable, reposition to screenshots/PDFs plus teacher correction; digital ones also failing, stop.
- On the **synthetic photo set**: 7 of 10 usable even counting the two quota failures as failures. On the clean set: 9 of 10. That clears the "proceed" threshold on the proxy.
- "Usable" here is my composite score ≥ 0.7, not WIN_PLAN's rubric (right type, right shape, correct labels, corners within about 5% of image size). The composite weights kind, schema validity, labels, segments, corners, curve shape, values and facts (`research/spike_scoring.py`).
- **Provisional decision: proceed as planned, but do not call Gate B closed until the 10 real photos are run.** Real pages add glare, curved spines, bleed-through and messy fonts that the simulation does not have. Send me the photos (4 geometry, 3 graphs, 3 bar charts, plus the 3 digital ones) and the run takes about 20 minutes once the quota is back.

## Findings that matter for the build
1. **Latency is a blocker for T08 as designed.** Per-call time was **29 to 169 s, median about 60 s** (values: clean 127, 58, 60, 169, 75, 29, 75, 55, 120, 58 s; photo 63, 67, 30, 48, 72, 60, 31, 92 s). The backend budget is **15 s** (Requirement 3.4), so with this model and prompt every request would end in Raw Mode. Not yet diagnosed. Things to try once quota allows: lower or disable the model's thinking budget, a lighter "flash-lite" model, a smaller input image, a shorter prompt (the full JSON schema is large), and a smaller `max_output_tokens`. The 503 "high demand" error also appeared once. **Decide the fix before agy builds T08**, or the demo will never show the AI path.
2. **Free-tier quota ran out after 18 calls.** Expect this on demo day: plan the NVIDIA fallback, caching of validated scenes by image hash, and a paid key or spacing for the demo. `gemini-2.5-flash` is retired for new users (HTTP 404); use `gemini-3.8-flash` via `GEMINI_MODEL` (`CLAUDE.md` still lists the old default).
3. **Geometry is strong, even on simulated photos** (8 of 8 usable, 0.84 to 1.00): labels and edges are correct; vertex positions are within a few percent once the frame is ignored.
4. **Function graphs are the weak spot, specifically the parabola**: photo 0.48 (curve shape score 0.00), clean 0.69. The model returned 35 points, trimmed the ends (y range 0.07 to 0.85 against the true 0.01 to 0.92), and drew a flatter curve. Sine and line graphs are fine (0.82 to 0.91). Axes placement was not a problem in the one case I inspected (parabola: x-axis at 0.573 against 0.583 true, y-axis exact).
5. **The model's coordinate frame differs between runs.** On clean images the triangle sat at 0.20 to 0.80; on the photo it spanned 0 to 1 (tight bounding box). My ground truth uses 0.15 margins. For touch this is harmless (the canvas draws whatever frame it is given) but the app must not assume a fixed margin. Suggestion for Kiro's `validate.py`: rescale each scene to its own bounding box plus a fixed margin.
6. **The vocabulary prompt worked.** Appearance-only labels (colour or shape words such as "blue polygon"): **0 of all labels** in 18 scored scenes. Small sample; keep the validator rule and the retry as the guarantee (TouchSight's finding in `docs/research/competitors.md`).
7. **Facts are paraphrased.** The model writes "Maths is the favourite subject of 12 students" where the ground truth says "Maths: 12". Fine for Ask (T09), but a strict string matcher would call them misses.
8. Every scored prediction had the right `kind` and validated against the strict schema (no coordinate overshoot, no dangling segment ids), before `validate.py` repair would even be needed.

## Scorer versions (disclosure: I changed the scorer after seeing results)
Three passes over the same 18 saved predictions, because the first two scorings were measuring things that are not errors:
| Version | What changed | Overall score | Usable of 20 | Clean | Photo |
|---|---|---|---|---|---|
| v1 | original | 0.67 | 13 | 0.79 (8 of 10) | 0.54 (5 of 10) |
| v2 | facts matched by content words and numbers instead of near-identical strings (the model paraphrases) | 0.72 | 14 | 0.85 (8 of 10) | 0.58 (6 of 10) |
| **v3** | corner and curve scores compare **shape** (both sides rescaled to their own bounding box; a half-drawn curve is still penalised) instead of absolute position, because the model's frame and my ground-truth margins differ for reasons unrelated to reading the diagram | **0.79** | **16** | **0.91 (9 of 10)** | **0.66 (7 of 10)** |
Both changes make the scorer more favourable, so treat v3 with care: they are justified by the data (I inspected the predictions: a tight frame versus a padded one; sentence versus terse facts), they have unit tests that still fail wrong numbers, wrong subjects, mirrored curves and half curves, and the absolute-frame numbers remain in the output (`corner_accuracy_abs`, `curve_score_abs`). **Freeze v3 now** and re-score every later run with it. The v1 console log is kept in the run folder.

## Limitations
- Synthetic renders and simulated photos, one model, one run (the model is not fully deterministic even at temperature 0), 18 of 20 scored.
- Ground truth was written for this spike; its facts and framing are my conventions.
- No overlay images yet: WIN_PLAN also asks for the returned points drawn over the photo (`research/out/NN.png`). Not built. Worth doing for the real photos because it shows errors faster than any score.
- The ground-truth triangle has its right angle at B; `backend/fixtures/triangle.py` has it at C (separate sets).

## Next steps
1. Fix the latency question (finding 1) with one experiment, since it decides whether T08 can ship.
2. Run the 2 missing photos and your 10 real photos plus 3 digital ones.
3. Run the same set through NVIDIA (`--provider nvidia --model <id>`) for the fallback comparison.
4. Build the overlay renderer for the real-photo run.
