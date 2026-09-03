import cv2
import numpy as np


def extract_sobel(image):
    """Extract Sobel edge features (full flattened gradient-magnitude map)."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    sobel_x = cv2.Sobel(
        gray,
        cv2.CV_64F,
        1,
        0,
        ksize=3
    )

    sobel_y = cv2.Sobel(
        gray,
        cv2.CV_64F,
        0,
        1,
        ksize=3
    )

    magnitude = cv2.magnitude(
        sobel_x.astype("float32"),
        sobel_y.astype("float32")
    )

    return magnitude.flatten()


def extract_canny(image):
    """Extract Canny edge features (full flattened binary edge map)."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    edges = cv2.Canny(
        gray,
        50,
        150
    )

    return edges.flatten()


# ---------------------------------------------------------------------------
# Compact summary-statistic versions.
#
# These are the ones actually used for classical ML training throughout this
# project (04_classical_ml.ipynb, 08_classical_full_benchmark.ipynb): a full
# flattened edge map (extract_sobel / extract_canny above) is 224*224 = 50,176
# dimensions, which is both slow to train on and highly correlated with the
# Raw Pixels feature. A handful of summary statistics keeps the same broad
# "how much edge activity is in this image" signal in a much smaller vector.
# ---------------------------------------------------------------------------

def extract_sobel_features(image):
    """Extract compact Sobel gradient-magnitude summary statistics (9-d)."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    sobel_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(sobel_x, sobel_y)

    features = [
        magnitude.mean(),
        magnitude.std(),
        magnitude.min(),
        magnitude.max(),
        np.percentile(magnitude, 25),
        np.percentile(magnitude, 50),
        np.percentile(magnitude, 75),
        np.percentile(magnitude, 90),
        np.percentile(magnitude, 95),
    ]

    return np.array(features, dtype=np.float32)


def extract_canny_features(image):
    """Extract compact Canny edge summary statistics (3-d)."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    edge_ratio = np.mean(edges > 0)

    features = [
        edge_ratio,
        edges.mean(),
        edges.std(),
    ]

    return np.array(features, dtype=np.float32)
