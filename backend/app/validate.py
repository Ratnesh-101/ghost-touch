"""Post-LLM validation and repair (Task 8.3).

Enforces DiagramScene invariants: unique ids, valid point references, and all
coordinates in [0, 1]. Repairs trivial overshoot (clamp within +/-0.02), drops
dangling segments, and dedupes ids. A scene with no drawable elements is
rejected so the pipeline can fall back to Raw Mode.
"""
