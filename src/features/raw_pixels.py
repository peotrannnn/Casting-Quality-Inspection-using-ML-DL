import cv2
import numpy as np

# Deliberately smaller than the project's IMG_SIZE=224 used everywhere else.
# At the full 224x224 resolution this feature is 50,176-dimensional; fitting
# LogisticRegression/SVC on that many training images requires an internal
# float64 copy (a hard-coded scikit-learn/scipy solver requirement, not
# something tunable from caller code) large enough to reliably crash on
# machines without a lot of free RAM - this happened in practice while
# training 08_classical_full_benchmark.ipynb. 64x64 = 4,096 dimensions keeps
# that same conversion under ~220 MB while still serving Raw Pixels' purpose
# as a no-feature-engineering baseline.
RAW_PIXEL_SIZE = 64


def extract_raw_pixels(image):
    """Downsize to RAW_PIXEL_SIZE and flatten the grayscale image (baseline)."""

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, (RAW_PIXEL_SIZE, RAW_PIXEL_SIZE), interpolation=cv2.INTER_AREA)

    return (
        small.flatten()
        .astype(np.float32)
        / 255.0
    )
