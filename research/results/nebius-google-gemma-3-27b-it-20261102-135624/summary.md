```
Vision spike - google/gemma-3-27b-it - 2026-11-02 13:59

sample                    truth->pred                    score  valid   secs  notes
-----------------------------------------------------------------------------------
clean/05_sine_graph       function_graph->function_graph  0.82      1   38.0  low facts_recall=0.00
clean/06_parabola         function_graph->function_graph  0.82      1   35.9  low facts_recall=0.00
clean/07_line_graph       function_graph->-               0.00     -      -   ReadTimeout: The read operation timed out

Summary
-------
ALL                n=3   score=0.55 kind 2/3  valid 2/3  usable(>=0.7) 2/3  errors 1  median 37.0s
variant:clean      n=3   score=0.55 kind 2/3  valid 2/3  usable(>=0.7) 2/3  errors 1  median 37.0s
kind:function_graph n=3   score=0.55 kind 2/3  valid 2/3  usable(>=0.7) 2/3  errors 1  median 37.0s

appearance-only labels (lower is better): 0.00
```
