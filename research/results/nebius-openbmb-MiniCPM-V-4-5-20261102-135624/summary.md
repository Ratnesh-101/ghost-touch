```
Vision spike - openbmb/MiniCPM-V-4_5 - 2026-11-02 13:56

sample                    truth->pred                    score  valid   secs  notes
-----------------------------------------------------------------------------------
clean/05_sine_graph       function_graph->function_graph  0.78      1    2.2  low facts_recall=0.00
clean/06_parabola         function_graph->function_graph  0.82      1    1.6  low facts_recall=0.00
clean/07_line_graph       function_graph->function_graph  0.90      1    1.7  low facts_recall=0.00

Summary
-------
ALL                n=3   score=0.83 kind 3/3  valid 3/3  usable(>=0.7) 3/3  errors 0  median 1.7s
variant:clean      n=3   score=0.83 kind 3/3  valid 3/3  usable(>=0.7) 3/3  errors 0  median 1.7s
kind:function_graph n=3   score=0.83 kind 3/3  valid 3/3  usable(>=0.7) 3/3  errors 0  median 1.7s

appearance-only labels (lower is better): 0.00
```
