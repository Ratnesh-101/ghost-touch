# T08b — Production equation route for function graphs

Builder: Antigravity | Reviewer: Claude Code (Kiro paused)
Spec: WIN_PLAN item 4; Requirement 3 (Diagram Scene Pipeline)

## Problem
`gemini-2.5-flash-lite` is fast (~2.6 s latency), but traced graph polylines scored only 0.49 composite with 0 of 5 samples usable. Full `gemini-3.8-flash` is accurate on graphs but takes 29 to 169 s per call, blowing past the 15 s scene latency budget.

## Approach
Instead of asking a fast vision LLM to trace 40–150 pixel coordinates directly:
1. The vision model reads the mathematical equation, axis ranges ($x_{\min}, x_{\max}, y_{\min}, y_{\max}$), and visible tick marks.
2. The backend safely parses the equation and samples the polyline mathematically.
3. The original traced polyline extraction remains the fallback if equation extraction fails.

## Architecture and Files
- `backend/app/graphs/expr.py`: Safe expression parser with strictly no `eval()`.
- `backend/app/graphs/sample.py`: Graph spec validation, uniform curve sampling, and `DiagramScene` builder.
- `backend/app/graphs/route.py`: Specialized equation extraction prompt and provider chain caller.
- Hook points in `backend/app/main.py`:
  - **Upgrade**: When standard extraction yields a valid `function_graph` scene, attempt equation sampling to upgrade curve fidelity.
  - **Rescue**: When primary extraction is invalid, try the graph route before falling back to Raw Mode.

## Safety Rules
- Strictly no `eval()`, `exec()`, or arbitrary code execution.
- Hard caps: expression string length, AST depth, node count, exponent magnitudes, and sample count.
- Numeric bounds enforced on all axis ranges, ticks, and step sizes.

## Default Model Decision
- Fast tier (`gemini-2.5-flash-lite`) handles all incoming diagrams by default, paired with the backend equation route for `function_graph` diagrams.
- `gemini-3.8-flash` is reserved solely for a future asynchronous background "improve" pass that never blocks the initial 15 s interactive budget (NOT built yet).

## Tests
- `backend/tests/test_graphs.py`: unit tests for expression parsing, spec validation, curve sampling, and error handling.

## Measurement Protocol
Run the spike runner against graph samples using both Nebius and Gemini:
```
backend/.venv/Scripts/python research/vision_spike.py --provider nebius --graph-route --only 05,06,07 --variants clean,photo
backend/.venv/Scripts/python research/vision_spike.py --provider gemini --model gemini-3.5-flash-lite --graph-route --only 05,06,07 --variants clean,photo
```

## Acceptance Criteria
- Composite score >= 0.8 on `05_sine_graph`, `06_parabola`, and `07_line_graph` in the `clean` variant.
- Per-call latency under 8 s.
- Report accuracy and latency in a results table.

## Results
Measured 2026-11-02 with `research/vision_spike.py --provider nebius --graph-route --only 05,06,07` (the production equation route, scored by the same scorer against ground truth). Key: Nebius, the test key.

**Final run (model `openbmb/MiniCPM-V-4_5`, derived facts included):**

| sample | clean | photo | secs (clean / photo) |
|---|---|---|---|
| 05_sine_graph | 0.88 | 0.88 | 1.9 / 2.0 |
| 06_parabola | 0.92 | 0.92 | 1.5 / 2.0 |
| 07_line_graph | 1.00 | 1.00 | 1.4 / 2.1 |
| mean | 0.93 | 0.93 | median 1.5 / 2.0 |

6 of 6 usable (>= 0.7), 6 of 6 valid, 0 errors. Acceptance (>= 0.8 clean on all three, < 8 s per call) is met. An earlier run before the derived facts existed scored 0.78 / 0.82 / 0.90 (`facts_recall` was 0.00 because the expected facts are maxima, minima, intercepts, slope and vertex); computing those from the equation (`backend/app/graphs/facts.py`) fixed it. Repeating the earlier clean run gave identical scores, so the route is stable at temperature 0.

**Model choice (graph route, clean variant, before derived facts):**

| model on Nebius | usable | median secs | notes |
|---|---|---|---|
| openbmb/MiniCPM-V-4_5 | 3/3 | 1.7 | chosen default |
| Qwen/Qwen3.8-27B | 2/3 | 7.9 | one empty response |
| google/gemma-3-27b-it | 2/3 | 37.0 | far too slow, one read timeout |
| nvidia/Nemotron-3.5-Super-VL | 0/3 | - | empty responses |

`Qwen/Qwen2.5-VL-72B-Instruct` is not available on this Nebius account.

**Baseline (what the route replaces):** the same MiniCPM model with the normal trace-the-curve prompt returned 0/6 (it cannot produce the large scene JSON), and Gemini flash-lite tracing scored 0.49 with 0 of 5 usable earlier (docs/research/vision-spike.md). In the pipeline a failed trace now falls through to the equation rescue before Raw Mode.

**Limits to know:** only the 3 synthetic graphs (clean + simulated photo) were measured; no real textbook photos yet. Sine `curve_score` is 0.73 (the model's axis-range estimate is slightly off the ground-truth plot area). MiniCPM is a graph-spec specialist here: do not rely on Nebius for geometry or bar charts (the full scene JSON prompt fails with this model), which is why it is only the last fallback and the key for bulk tests.
