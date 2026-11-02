```
Vision spike - Qwen/Qwen3.8-27B - 2026-11-02 13:56

sample                    truth->pred                    score  valid   secs  notes
-----------------------------------------------------------------------------------
clean/05_sine_graph       function_graph->function_graph  0.82      1    5.8  low facts_recall=0.00
clean/06_parabola         function_graph->function_graph  0.82      1   10.0  low facts_recall=0.00
clean/07_line_graph       function_graph->-               0.00     -      -   SpikeError: empty response from nebius

Summary
-------
ALL                n=3   score=0.55 kind 2/3  valid 2/3  usable(>=0.7) 2/3  errors 1  median 7.9s
variant:clean      n=3   score=0.55 kind 2/3  valid 2/3  usable(>=0.7) 2/3  errors 1  median 7.9s
kind:function_graph n=3   score=0.55 kind 2/3  valid 2/3  usable(>=0.7) 2/3  errors 1  median 7.9s

appearance-only labels (lower is better): 0.00
```
