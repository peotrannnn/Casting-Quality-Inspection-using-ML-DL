"""Canonical list of every model this project has produced (22 total: 21
classical configurations + 1 deep learning model, ResNet18).

EfficientNet-B0 was dropped from this project: training it crashed the kernel
on the development machine (RAM-limited; EfficientNet's MBConv blocks need
more activation memory during training than ResNet18 despite having fewer
parameters), and ResNet18 already had a finalized, test-evaluated checkpoint,
so it was not worth chasing further for a second CNN candidate. If that
changes later, add a second entry back into build_deep_learning_registry().

This is the single source of truth `09_export_web_assets.ipynb` will iterate
over to generate the site's predictions.json / models_meta.json, so the model
lineup only needs to be defined once. If a model is added or removed later
(e.g. a v2 brightness-robust ResNet18), update it here.
"""

from src.models.classical import FEATURE_EXTRACTORS, config_id, create_models

# Fixed, human-readable descriptions of each classifier's key hyperparameters,
# for display on the web's "Model Stats" page. Keep in sync with
# src.models.classical.create_models().
_CLASSIFIER_HYPERPARAMETERS = {
    "Logistic Regression": {
        "max_iter": 2000,
        "solver": "lbfgs (scikit-learn default)",
        "regularization": "L2, C=1.0 (scikit-learn default)",
    },
    "SVM": {
        "kernel": "rbf",
        "C": "1.0 (scikit-learn default)",
        "gamma": "scale (scikit-learn default)",
    },
    "Random Forest": {
        "n_estimators": 200,
        "criterion": "gini (scikit-learn default)",
        "max_depth": "None (scikit-learn default, nodes expand fully)",
    },
}

_FEATURE_DESCRIPTIONS = {
    "Raw Pixels": "Flattened grayscale pixel intensities, downsized to 64x64 (baseline, no hand-crafted structure).",
    "Histogram": "256-bin normalized grayscale intensity histogram (global brightness distribution).",
    "Sobel": "9 summary statistics (mean/std/min/max/percentiles) of the Sobel gradient magnitude map.",
    "Canny": "3 summary statistics (edge ratio, mean, std) of the Canny binary edge map.",
    "LBP": "10-bin uniform Local Binary Pattern histogram (local texture micro-patterns).",
    "HOG": "Histogram of Oriented Gradients (9 orientations, 16x16 cells, 2x2 blocks) - shape/contour structure.",
    "GLCM": "5 Gray-Level Co-occurrence Matrix statistics (contrast, dissimilarity, homogeneity, energy, correlation).",
}

_FEATURE_DIMENSIONS = {
    "Raw Pixels": 64 * 64,
    "Histogram": 256,
    "Sobel": 9,
    "Canny": 3,
    "LBP": 10,
    "HOG": 6084,
    "GLCM": 5,
}


def build_classical_registry():
    """One registry entry per (feature, classifier) = 21 total."""

    entries = {}

    for feature_name in FEATURE_EXTRACTORS:
        for classifier_name in create_models():
            model_id = config_id(feature_name, classifier_name)

            entries[model_id] = {
                "display_name": f"{feature_name} + {classifier_name}",
                "type": "classical",
                "feature": feature_name,
                "feature_description": _FEATURE_DESCRIPTIONS[feature_name],
                "feature_dim": _FEATURE_DIMENSIONS[feature_name],
                "classifier": classifier_name,
                "classifier_hyperparameters": _CLASSIFIER_HYPERPARAMETERS[classifier_name],
                "weights_path": f"models/classical/{model_id}.joblib",
                "supports_gradcam": False,
                "confidence_is_calibrated": classifier_name != "SVM",
            }

    return entries


def build_deep_learning_registry():
    """One registry entry per CNN = 1 total (ResNet18 only - see module
    docstring for why EfficientNet-B0 was dropped)."""

    return {
        "resnet18": {
            "display_name": "ResNet18",
            "type": "deep_learning",
            "architecture": "resnet18",
            "weights_path": "models/resnet18_casting.pt",
            "supports_gradcam": True,
            "confidence_is_calibrated": True,
            "hyperparameters": {
                "pretrained_on": "ImageNet",
                "epochs": 10,
                "optimizer": "Adam",
                "learning_rate": 0.0001,
                "batch_size": 32,
                "loss": "CrossEntropyLoss",
                "augmentation": "RandomHorizontalFlip, RandomRotation(10 deg)",
                "input_size": "224x224, ImageNet-normalized",
                "model_selection": "checkpoint with the best validation F1 across 10 epochs",
            },
        },
    }


def build_full_registry():
    """All 22 models this project has produced, keyed by model_id."""

    registry = {}
    registry.update(build_classical_registry())
    registry.update(build_deep_learning_registry())
    return registry


MODEL_REGISTRY = build_full_registry()
