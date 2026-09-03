import cv2
import numpy as np


def extract_histogram(image):
    """Extract normalized grayscale histogram."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    histogram = cv2.calcHist(
        [gray],
        [0],
        None,
        [256],
        [0, 256]
    )

    histogram = cv2.normalize(
        histogram,
        histogram
    )

    return histogram.flatten()