import cv2
import numpy as np

from skimage.feature import local_binary_pattern
from skimage.feature import graycomatrix, graycoprops


def extract_lbp(image):
    """Extract LBP histogram."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    radius = 1
    points = 8 * radius

    lbp = local_binary_pattern(
        gray,
        points,
        radius,
        method="uniform"
    )

    bins = points + 2

    histogram, _ = np.histogram(
        lbp.ravel(),
        bins=bins,
        range=(0, bins),
        density=True
    )

    return histogram


def extract_glcm(image):
    """Extract GLCM texture statistics."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    gray = (gray // 32).astype(np.uint8)

    glcm = graycomatrix(
        gray,
        distances=[1],
        angles=[0],
        levels=8,
        symmetric=True,
        normed=True
    )

    features = [
        graycoprops(glcm, "contrast")[0, 0],
        graycoprops(glcm, "dissimilarity")[0, 0],
        graycoprops(glcm, "homogeneity")[0, 0],
        graycoprops(glcm, "energy")[0, 0],
        graycoprops(glcm, "correlation")[0, 0],
    ]

    return np.array(features)