"""VisionProvider interface (Task 8).

Concrete providers live in ``vision/<provider>.py`` and read the model name and
API key from environment variables. The interface is kept here so the rest of
the pipeline depends on the abstraction, never a specific vendor.
"""
