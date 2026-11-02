```
Vision spike - openbmb/MiniCPM-V-4_5 - 2026-11-02 14:07

sample                    truth->pred                    score  valid   secs  notes
-----------------------------------------------------------------------------------
clean/05_sine_graph       function_graph->function_graph  0.88      1    1.9  low curve_score=0.73
clean/06_parabola         function_graph->function_graph  0.92      1    1.5  
clean/07_line_graph       function_graph->function_graph  1.00      1    1.4  
photo/05_sine_graph       function_graph->function_graph  0.88      1    2.0  low curve_score=0.73
photo/06_parabola         function_graph->function_graph  0.92      1    2.0  
photo/07_line_graph       function_graph->function_graph  1.00      1    2.1  

Summary
-------
ALL                n=6   score=0.93 kind 6/6  valid 6/6  usable(>=0.7) 6/6  errors 0  median 2.0s
variant:clean      n=3   score=0.93 kind 3/3  valid 3/3  usable(>=0.7) 3/3  errors 0  median 1.5s
kind:function_graph n=6   score=0.93 kind 6/6  valid 6/6  usable(>=0.7) 6/6  errors 0  median 2.0s
variant:photo      n=3   score=0.93 kind 3/3  valid 3/3  usable(>=0.7) 3/3  errors 0  median 2.0s

appearance-only labels (lower is better): 0.00
```
