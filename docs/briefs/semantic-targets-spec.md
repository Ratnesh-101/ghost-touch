# Semantic targets: shared definition (frontend and backend MUST agree)
Coordinates are scene space [0,1], y=0 is TOP. Scene = DiagramScene (points, segments, polylines, bars, axes, kind).

| name | applies to | definition | target returned |
|---|---|---|---|
| peak (also: highest point, maximum, top of the curve) | any polyline | the polyline vertex with the smallest y across all polylines; ties: first in document order | point {x,y}, label "peak" |
| trough (lowest point, minimum, bottom of the curve) | any polyline | vertex with the largest y; ties first | point {x,y}, label "lowest point" |
| origin (where the axes cross) | scene.axes with BOTH x_axis_y and y_axis_x non-null | point (y_axis_x, x_axis_y) | point {x,y}, label "origin" |
| tallest bar / shortest bar | bars | bar with max / min `value`; ties first | element {elementId: bar.id} |
| right angle | points + segments | a point with exactly two incident segments whose angle at that point is within 90 +/- 3 degrees (scene space); first match in document order | element {elementId: point.id} |
| longest side | segments | segment with max Euclidean length; ties first | element {elementId: segment.id} |

If a name does not apply or nothing matches, there is NO target and the app says so plainly ("There is no peak in this diagram.").

Phrases (case-insensitive, after the existing normalisation).
- English: peak, highest point, maximum, top of the curve; lowest point, minimum, trough, bottom of the curve; origin; tallest bar, highest bar, biggest bar; shortest bar, smallest bar; right angle; longest side.
- Hindi: शिखर, सबसे ऊँचा बिंदु, मूल बिंदु, समकोण, सबसे लंबी भुजा (add natural equivalents for the rest).
- Gujarati: શિખર, સૌથી ઊંચો બિંદુ, ઉદ્ભવ બિંદુ, કાટખૂણો, સૌથી લાંબી બાજુ (add natural equivalents for the rest).
List every phrase you chose in your report, and append them to `docs/user-test/translation-review.md` and `.csv` so the owner can native-check them.
