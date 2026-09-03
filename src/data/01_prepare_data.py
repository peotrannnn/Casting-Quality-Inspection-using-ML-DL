from pathlib import Path

import torch
from torchvision import datasets, transforms
from torch.utils.data import DataLoader, Subset


# Dataset path
DATA_DIR = Path("data/raw/casting_data/casting_data")

TRAIN_DIR = DATA_DIR / "train"
TEST_DIR = DATA_DIR / "test"


# Settings
IMG_SIZE = 224
BATCH_SIZE = 32
VAL_RATIO = 0.2
SEED = 42


# ============================================================
# IMPORTANT: Split data BEFORE fitting or learning anything.
# Never use validation/test data to make training decisions.
# ============================================================

# Training transform
# Augmentation is allowed ONLY for training data.
train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ToTensor(),
])


# Validation/Test transform
# No augmentation here.
val_test_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
])


# Load the same training images with different transforms.
train_data = datasets.ImageFolder(
    TRAIN_DIR,
    transform=train_transform
)

val_data = datasets.ImageFolder(
    TRAIN_DIR,
    transform=val_test_transform
)


# Test data must remain completely untouched until final evaluation.
test_data = datasets.ImageFolder(
    TEST_DIR,
    transform=val_test_transform
)


# Create a reproducible train/validation split.
# Validation images are NOT used to train the model.
generator = torch.Generator().manual_seed(SEED)

indices = torch.randperm(
    len(train_data),
    generator=generator
).tolist()

val_size = int(len(indices) * VAL_RATIO)

val_indices = indices[:val_size]
train_indices = indices[val_size:]


train_dataset = Subset(train_data, train_indices)
val_dataset = Subset(val_data, val_indices)


# DataLoaders
train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False
)

test_loader = DataLoader(
    test_data,
    batch_size=BATCH_SIZE,
    shuffle=False
)


# Dataset information
print("Classes:", train_data.classes)
print("Training images:", len(train_dataset))
print("Validation images:", len(val_dataset))
print("Test images:", len(test_data))