import cv2

from skimage.feature import hog


def extract_hog(image):
    """Extract HOG features."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    features = hog(
        gray,
        orientations=9,
        pixels_per_cell=(16, 16),
        cells_per_block=(2, 2),
        visualize=False
    )

    return features