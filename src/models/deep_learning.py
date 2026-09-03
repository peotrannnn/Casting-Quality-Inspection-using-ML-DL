"""Shared deep learning configuration: architectures, transforms, and the
train/evaluate loop.

`05_deep_learning.ipynb` and `06_model_testing.ipynb` each carry their own
inline copy of this loop - the divergence between those two copies is
exactly how the ROC-AUC `pos_label` bug happened in one of them but not the
other. This module is a single, tested, de-duplicated version of that same
loop, kept as a reference implementation for any notebook added later (e.g.
retraining ResNet18 with brightness augmentation) - it is not currently
imported by any existing notebook, so nothing needs to change today.

EfficientNet-B0 support (`build_model("efficientnet_b0")` etc.) is kept here
even though this project ended up using only ResNet18 - see
`src/inference/registry.py`'s module docstring for why EfficientNet-B0 was
dropped. Left in in case a second CNN candidate is worth revisiting later
with a more capable machine.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from torchvision import models, transforms

IMG_SIZE = 224

# ImageNet normalization statistics, required by every torchvision pretrained
# backbone used in this project.
_NORMALIZE = transforms.Normalize(
    mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
)

train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ToTensor(),
    _NORMALIZE,
])

eval_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    _NORMALIZE,
])


def build_model(architecture):
    """Build a pretrained backbone with its head replaced for 2-class output.

    `architecture` is one of "resnet18" / "efficientnet_b0".
    """

    if architecture == "resnet18":
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        model.fc = nn.Linear(model.fc.in_features, 2)
        return model

    if architecture == "efficientnet_b0":
        model = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.DEFAULT)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, 2)
        return model

    raise ValueError(f"Unknown architecture: {architecture!r}")


def gradcam_target_layer(model, architecture):
    """The last convolutional block to hook Grad-CAM onto, per architecture."""

    if architecture == "resnet18":
        return model.layer4[-1]

    if architecture == "efficientnet_b0":
        return model.features[-1]

    raise ValueError(f"Unknown architecture: {architecture!r}")


def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()

    total_loss = 0
    correct = 0
    total = 0

    for images, labels in loader:
        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * images.size(0)
        predictions = outputs.argmax(dim=1)
        correct += (predictions == labels).sum().item()
        total += labels.size(0)

    return total_loss / total, correct / total


def evaluate_model(model, loader, device, criterion=None):
    """Evaluate a model on a DataLoader.

    `scores` in the result is P(class 0 = "def_front") for every example -
    remember to pass `pos_label=0` to sklearn's roc_curve /
    precision_recall_curve / average_precision_score when using it, since
    scikit-learn's default (pos_label=1) assumes the opposite orientation.
    """

    model.eval()

    all_labels = []
    all_predictions = []
    all_scores = []
    total_loss = 0
    total = 0

    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)

            if criterion is not None:
                loss = criterion(outputs, labels.to(device))
                total_loss += loss.item() * images.size(0)
                total += labels.size(0)

            probabilities = torch.softmax(outputs, dim=1)
            predictions = outputs.argmax(dim=1)

            all_predictions.extend(predictions.cpu().numpy())
            all_labels.extend(labels.numpy())
            all_scores.extend(probabilities[:, 0].cpu().numpy())

    result = {
        "accuracy": accuracy_score(all_labels, all_predictions),
        "precision": precision_score(all_labels, all_predictions, average="macro", zero_division=0),
        "recall": recall_score(all_labels, all_predictions, average="macro", zero_division=0),
        "f1": f1_score(all_labels, all_predictions, average="macro", zero_division=0),
        "labels": all_labels,
        "predictions": all_predictions,
        "scores": all_scores,
    }

    if criterion is not None:
        result["loss"] = total_loss / total

    return result


def train_model(
    model, train_loader, val_loader, device,
    model_name="model", epochs=10, learning_rate=0.0001,
):
    """Full training loop: trains for `epochs`, keeps the checkpoint with the
    best validation F1, and returns (model_with_best_weights_loaded, history).
    """

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    history = {
        "train_loss": [], "train_accuracy": [],
        "val_loss": [], "val_accuracy": [], "val_f1": [],
    }

    best_f1 = -1
    best_state = None

    for epoch in range(epochs):
        train_loss, train_accuracy = train_one_epoch(
            model, train_loader, criterion, optimizer, device
        )
        val_result = evaluate_model(model, val_loader, device, criterion=criterion)

        history["train_loss"].append(train_loss)
        history["train_accuracy"].append(train_accuracy)
        history["val_loss"].append(val_result["loss"])
        history["val_accuracy"].append(val_result["accuracy"])
        history["val_f1"].append(val_result["f1"])

        print(
            f"{model_name} | Epoch {epoch + 1}/{epochs} | "
            f"Train Loss: {train_loss:.4f} | Val Loss: {val_result['loss']:.4f} | "
            f"Train Acc: {train_accuracy:.4f} | Val Acc: {val_result['accuracy']:.4f} | "
            f"Val F1: {val_result['f1']:.4f}"
        )

        if val_result["f1"] > best_f1:
            best_f1 = val_result["f1"]
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    print()
    print("Best validation F1:", round(best_f1, 4))

    return model, history
