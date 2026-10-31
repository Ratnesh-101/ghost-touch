"""Raw Mode — OpenCV edge detection fallback (Task 8.4).

Grayscale -> GaussianBlur -> Canny -> findContours -> approxPolyDP
simplification, capped at <=300 normalized segments. Used when the vision LLM
fails validation twice, times out, or throws.
"""
