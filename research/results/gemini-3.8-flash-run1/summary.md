```
Vision spike - rescore - 2026-11-01 02:51

sample                    truth->pred                    score  valid   secs  notes
-----------------------------------------------------------------------------------
clean/01_right_triangle   geometry->geometry              0.95      1     -   low facts_recall=0.50
clean/02_rectangle        geometry->geometry              0.97      1     -   low facts_recall=0.75
clean/03_altitude         geometry->geometry              0.85      1     -   low facts_recall=0.33
clean/04_triangle_angles  geometry->geometry              1.00      1     -   
clean/05_sine_graph       function_graph->function_graph  0.85      1     -   low facts_recall=0.67
clean/06_parabola         function_graph->function_graph  0.69      1     -   low curve_score=0.51
clean/07_line_graph       function_graph->function_graph  0.91      1     -   low facts_recall=0.67
clean/08_bar_subjects     bar_chart->bar_chart            1.00      1     -   
clean/09_bar_rainfall     bar_chart->bar_chart            0.90      1     -   low facts_recall=0.00
clean/10_bar_trees        bar_chart->bar_chart            1.00      1     -   
photo/01_right_triangle   geometry->geometry              0.91      1     -   low facts_recall=0.50
photo/02_rectangle        geometry->geometry              0.97      1     -   low facts_recall=0.75
photo/03_altitude         geometry->geometry              0.84      1     -   low segment_f1=0.67
photo/04_triangle_angles  geometry->geometry              0.97      1     -   low corner_accuracy=0.79
photo/05_sine_graph       function_graph->function_graph  0.82      1     -   low facts_recall=0.67
photo/06_parabola         function_graph->function_graph  0.48      1     -   low curve_score=0.00
photo/07_line_graph       function_graph->function_graph  0.88      1     -   low facts_recall=0.67
photo/08_bar_subjects     bar_chart->bar_chart            0.70      1     -   low facts_recall=0.25
photo/09_bar_rainfall     bar_chart->-                    0.00     -      -   SpikeError: no saved prediction
photo/10_bar_trees        bar_chart->-                    0.00     -      -   SpikeError: no saved prediction

Summary
-------
ALL                n=20  score=0.79 kind 18/20  valid 18/20  usable(>=0.7) 16/20  errors 2  median   - s
variant:clean      n=10  score=0.91 kind 10/10  valid 10/10  usable(>=0.7) 9/10  errors 0  median   - s
kind:geometry      n=8   score=0.93 kind 8/8  valid 8/8  usable(>=0.7) 8/8  errors 0  median   - s
kind:function_graph n=6   score=0.77 kind 6/6  valid 6/6  usable(>=0.7) 4/6  errors 0  median   - s
kind:bar_chart     n=6   score=0.60 kind 4/6  valid 4/6  usable(>=0.7) 4/6  errors 2  median   - s
variant:photo      n=10  score=0.66 kind 8/10  valid 8/10  usable(>=0.7) 7/10  errors 2  median   - s

appearance-only labels (lower is better): 0.00
```
