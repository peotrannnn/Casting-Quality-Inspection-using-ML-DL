"""Grad-CAM helpers, generalized across CNN architectures via
`gradcam_target_layer()` in `src/models/deep_learning.py` (ResNet18,
EfficientNet-B0).

Introduced in `07_error_analysis.ipynb` for ResNet18 only; generalized here
as a reference implementation for any notebook that needs Grad-CAM on more
than one CNN architecture. Not currently imported by any notebook -
`09_export_web_assets.ipynb` computes Grad-CAM inline for ResNet18 (this
project's only deep learning model - see `src/inference/registry.py`'s
module docstring for why EfficientNet-B0 was dropped), the same approach
`07_error_analysis.ipynb` uses, rather than importing this module.

Requires the `grad-cam` package: pip install grad-cam
"""

import numpy as np
from PIL import Image

from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget

from src.models.deep_learning import IMG_SIZE, eval_transform, gradcam_target_layer


def build_cam(model, architecture):
    """Construct a GradCAM instance hooked to the right layer for this
    architecture. Reuse this across many images/calls - don't rebuild it
    per-image."""

    target_layers = [gradcam_target_layer(model, architecture)]
    return GradCAM(model=model, target_layers=target_layers)


def load_for_cam(path, img_size=IMG_SIZE):
    """Return (input_tensor[1,3,H,W], rgb_float_image[H,W,3] in [0,1])."""

    pil_image = Image.open(path).convert("RGB")
    tensor = eval_transform(pil_image).unsqueeze(0)

    resized = pil_image.resize((img_size, img_size))
    rgb_float = np.asarray(resized).astype(np.float32) / 255.0

    return tensor, rgb_float


def compute_gradcam(cam, path, target_class, device):
    """Return (rgb_float_image, grayscale_cam, overlay_uint8_image) for one
    image, explained with respect to `target_class` (0 = def_front,
    1 = ok_front)."""

    tensor, rgb_float = load_for_cam(path)
    targets = [ClassifierOutputTarget(target_class)]

    grayscale_cam = cam(input_tensor=tensor.to(device), targets=targets)[0]
    overlay = show_cam_on_image(rgb_float, grayscale_cam, use_rgb=True)

    return rgb_float, grayscale_cam, overlay
