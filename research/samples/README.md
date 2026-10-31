# Vision spike samples

## synthetic/ (generated, original content — no copyrighted textbook images)
10 textbook-style diagrams, each in three forms:
- `clean/NN_name.png` — clean digital render (stands in for a screenshot / PDF crop)
- `photo/NN_name.jpg` — simulated phone photo of a printed page: perspective tilt, rotation,
  uneven light, shadow, warm cast, blur, noise, surrounding body text and a figure caption
- `ground_truth/NN_name.json` — the correct `DiagramScene` (schema v1 from design.md).
  Coordinates are normalized to the **diagram's own box** (origin top-left), so compare
  shapes and labels exactly and positions loosely.

| # | File | Kind |
|---|---|---|
| 01 | right_triangle | geometry (ABC, right angle at B, 3-4-5 cm) |
| 02 | rectangle | geometry (PQRS + diagonal PR) |
| 03 | altitude | geometry (isosceles ABC + altitude AD) |
| 04 | triangle_angles | geometry (XYZ with 70/60/50°) |
| 05 | sine_graph | function_graph (y = sin x) |
| 06 | parabola | function_graph (y = x² − 4) |
| 07 | line_graph | function_graph (y = 2x + 1) |
| 08 | bar_subjects | bar_chart (4 bars) |
| 09 | bar_rainfall | bar_chart (5 bars) |
| 10 | bar_trees | bar_chart (3 bars) |

Because ground truth exists, the vision spike can score these **automatically**
(type match, label match, point count, mean corner error).

## real/
Your own phone photos of real textbooks. Synthetic photos are a useful first pass,
but real pages have glare, bleed-through, curved spines and messy fonts — the Gate B
decision must include real photos.
