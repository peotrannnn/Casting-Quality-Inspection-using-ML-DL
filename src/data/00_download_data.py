import kagglehub

# Download dataset
path = kagglehub.dataset_download(
    "ravirajsinh45/real-life-industrial-dataset-of-casting-product",
    output_dir="data/raw"
)

print("Dataset downloaded to:", path)