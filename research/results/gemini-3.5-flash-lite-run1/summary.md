```
Vision spike - gemini-3.5-flash-lite - 2026-11-01 03:40

sample                    truth->pred                    score  valid   secs  notes
-----------------------------------------------------------------------------------
clean/01_right_triangle   geometry->geometry              0.95      1    2.3  low facts_recall=0.50
clean/02_rectangle        geometry->geometry              0.97      1    2.8  low facts_recall=0.75
clean/03_altitude         geometry->geometry              0.93      1    2.3  low facts_recall=0.33
clean/04_triangle_angles  geometry->geometry              1.00      1    2.2  
clean/05_sine_graph       function_graph->function_graph  0.35      0    3.9  low curve_score=0.00
clean/06_parabola         function_graph->function_graph  0.48      1    2.3  low curve_score=0.00
clean/07_line_graph       function_graph->function_graph  0.63      1    1.7  low facts_recall=0.00
clean/08_bar_subjects     bar_chart->bar_chart            1.00      1    2.4  
clean/09_bar_rainfall     bar_chart->bar_chart            0.89      1    2.4  low facts_recall=0.00
clean/10_bar_trees        bar_chart->bar_chart            1.00      1    3.0  
photo/01_right_triangle   geometry->geometry              0.92      1    3.5  low facts_recall=0.50
photo/02_rectangle        geometry->geometry              0.90      1    3.2  low corner_accuracy=0.49
photo/03_altitude         geometry->geometry              0.90      1    2.1  low facts_recall=0.33
photo/04_triangle_angles  geometry->geometry              0.97      1    2.7  low corner_accuracy=0.79
photo/05_sine_graph       function_graph->function_graph  0.41      1    2.8  low curve_score=0.04
photo/06_parabola         function_graph->function_graph  0.56      1    3.5  low curve_score=0.27

Summary
-------
ALL                n=16  score=0.80 kind 16/16  valid 15/16  usable(>=0.7) 11/16  errors 0  median 2.6s
variant:clean      n=10  score=0.82 kind 10/10  valid 9/10  usable(>=0.7) 7/10  errors 0  median 2.4s
kind:geometry      n=8   score=0.94 kind 8/8  valid 8/8  usable(>=0.7) 8/8  errors 0  median 2.5s
kind:function_graph n=5   score=0.49 kind 5/5  valid 4/5  usable(>=0.7) 0/5  errors 0  median 2.8s
kind:bar_chart     n=3   score=0.96 kind 3/3  valid 3/3  usable(>=0.7) 3/3  errors 0  median 2.4s
variant:photo      n=6   score=0.78 kind 6/6  valid 6/6  usable(>=0.7) 4/6  errors 0  median 3.0s

appearance-only labels (lower is better): 0.00
```
