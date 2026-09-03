"""Shared classical ML configuration: features, classifiers, and prediction helpers.

`04_classical_ml.ipynb` and `08_classical_full_benchmark.ipynb` each carry
their own inline copy of the 21 (feature x classifier) configurations. This
module is a single, tested, de-duplicated version of that same
configuration, kept as a reference implementation - `09_export_web_assets.ipynb`
does not import it, since it reads `08_classical_full_benchmark.ipynb`'s
already-computed predictions CSV directly rather than reloading and
re-predicting with all 21 joblib pipelines. Useful if a later notebook needs
to retrain or re-predict with these configurations directly.
"""

import cv2
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from src.features.edges import extract_canny_features, extract_sobel_features
from src.features.histogram import extract_histogram
from src.features.hog import extract_hog
from src.features.raw_pixels import extract_raw_pixels
from src.features.texture import extract_glcm, extract_lbp

IMG_SIZE = 224
SEED = 42

# Every classical feature representation used in this project, keyed by the
# display name shown in results tables / the web UI.
FEATURE_EXTRACTORS = {
    "Raw Pixels": extract_raw_pixels,
    "Histogram": extract_histogram,
    "Sobel": extract_sobel_features,
    "Canny": extract_canny_features,
    "LBP": extract_lbp,
    "HOG": extract_hog,
    "GLCM": extract_glcm,
}


def load_image(path, img_size=IMG_SIZE):
    """Read an image from disk as BGR and resize it to the project's standard size."""

    image = cv2.imread(str(path))
    if image is None:
        raise ValueError(f"Could not read image: {path}")
    return cv2.resize(image, (img_size, img_size))


def create_models(seed=SEED):
    """The 3 classifiers used with every feature representation."""

    return {
        "Logistic Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(max_iter=2000, random_state=seed)),
        ]),
        "SVM": Pipeline([
            ("scaler", StandardScaler()),
            ("model", SVC(kernel="rbf", random_state=seed)),
        ]),
        "Random Forest": RandomForestClassifier(
            n_estimators=200, random_state=seed, n_jobs=-1
        ),
    }


def config_id(feature_name, classifier_name):
    """Canonical id for a (feature, classifier) pair, e.g. 'histogram_svm'.

    Used consistently as the saved model filename, the row key in the
    predictions table, and the model id shown in the web UI's URL/state.
    """

    return (
        f"{feature_name.lower().replace(' ', '_')}"
        f"_{classifier_name.lower().replace(' ', '_')}"
    )


def get_final_estimator(pipeline):
    """Return the actual classifier, unwrapping a Pipeline if needed."""

    return pipeline.steps[-1][1] if hasattr(pipeline, "steps") else pipeline


def predict_with_confidence(pipeline, X):
    """Return (predicted_label, confidence) for every row of X.

    Confidence is in [0.5, 1.0]: for Logistic Regression / Random Forest it is
    `max(predict_proba)`. SVC here is trained *without* `probability=True`
    (that calibration is expensive to fit 21 times over), so its confidence is
    a monotonic transform of the decision margin instead: `sigmoid(|margin|)`.
    This is not a calibrated probability, but it is a fast, honest, and
    consistently-scaled stand-in for "how far past the decision boundary this
    prediction is" - and it is documented as such wherever it's shown.
    """

    predictions = pipeline.predict(X)
    estimator = get_final_estimator(pipeline)

    if isinstance(estimator, SVC):
        margin = pipeline.decision_function(X)
        confidence = 1 / (1 + np.exp(-np.abs(margin)))
    else:
        proba = pipeline.predict_proba(X)
        confidence = proba.max(axis=1)

    return predictions, confidence


def positive_class_score(pipeline, X):
    """Score oriented so that higher = more confident in class 1 ('ok_front').

    Use this (never the raw stored 'confidence') for ROC/PR curves, so the
    curve's positive-class orientation is correct regardless of classifier
    type. See the pos_label bug fixed in 06_model_testing.ipynb for why this
    matters.
    """

    estimator = get_final_estimator(pipeline)

    if isinstance(estimator, SVC):
        return pipeline.decision_function(X)

    proba = pipeline.predict_proba(X)
    classes = list(estimator.classes_)
    return proba[:, classes.index(1)]
