Casting Quality Inspection — ML & DL
Can a machine spot a bad casting just by looking at it? 22 models — 21 classical
CV/ML pipelines plus a fine-tuned ResNet18 — benchmarked on the same 715 real
factory photos, including two things that looked wrong and how they were caught.
Live demo: `https://peotrannnn.github.io/Casting-Quality-Inspection-using-ML-DL/`
(enable GitHub Pages, Source: `docs/`, if not live yet)
Contents: Overview · Dataset · Structure · Method · Results · Key Findings · Notebooks · Setup · Dashboard · Limitations · License · Tiếng Việt
---
Overview
7 hand-crafted CV features × 3 classical classifiers = 21 combinations, benchmarked against a fine-tuned ResNet18.
Same held-out test set for every model, leakage-aware split throughout.
Top score: 99.86% test accuracy, reached by both the best classical model and ResNet18.
A score that high on a real defect dataset deserves scrutiny, not applause — two follow-up checks are included:
A train/test duplicate-image leak, found and fixed.
A brightness shortcut, caught with Grad-CAM and a robustness test.
Dataset
	
Source	Kaggle — Real-life Industrial Dataset of Casting Product, by ravirajsinh45
Provenance	Pilot TechnoCast production line, Shapar, Rajkot, India
Subject	Submersible pump impeller
Classes	`def_front` (defective), `ok_front` (OK)
Size	7,284 images, 300×300 RGB
Split	`def_front`: 3,758 train / 453 test — `ok_front`: 2,811 train / 262 test¹
Defect types	blow holes, pinholes, burr, shrinkage, mould/pouring-metal defects
¹ Before the leak cleanup in Key Findings.
```bash
python src/data/00_download_data.py   # via kagglehub, downloads into data/raw/
```
Repository Structure
```
Casting Quality Inspection/
├── data/
│   ├── raw/casting_data/casting_data/{train,test}/{def_front,ok_front}/  # original split
│   └── leaked_duplicates_removed_from_train/ok_front/   # the 64 images pulled from train/
├── src/
│   ├── data/
│   │   ├── 00_download_data.py     # Kaggle download via kagglehub
│   │   └── 01_prepare_data.py      # leakage-aware train/val/test loaders
│   └── features/                   # hand-crafted feature extractors
│       ├── histogram.py
│       ├── edges.py                # Sobel + Canny
│       ├── texture.py              # LBP + GLCM
│       └── hog.py
├── notebooks/           # 01 to 08, run in order — see below
├── results/
│   ├── metrics/          # classical_full_test_results.csv, model_testing_results.csv
│   └── error_analysis/   # Grad-CAM heatmaps, misclassified examples, robustness CSV
└── docs/                 # GitHub Pages dashboard (About / Playground / Model Stats)
```
Method
Feature	Captures	Dim.
Raw Pixels	flattened 64×64 grayscale (baseline)	4,096
Histogram	256-bin grayscale intensity distribution	256
Sobel	gradient magnitude, x/y kernels	flattened
Canny	binary edge map	flattened
LBP	texture histogram (P=8, R=1)	10
HOG	9 orientations, 16×16 cells	6,084
GLCM	contrast, homogeneity, energy, correlation	5
Classifiers: Logistic Regression, Random Forest (200 trees), SVM (RBF) — scikit-learn
defaults, in a `StandardScaler → classifier` pipeline. 7 × 3 = 21 combinations.
ResNet18: ImageNet-pretrained, fine-tuned end-to-end for 10 epochs. Adam, lr 1e-4,
batch size 32, 224×224 input, `RandomHorizontalFlip` + `RandomRotation(10°)` on train
only. Checkpoint picked by best validation F1.
Both families share the same seeded 80/20 train/val split and the same untouched test set.
Results
Top of the 21-model leaderboard plus ResNet18, on the test set, after the leak fix:
Rank	Model	Accuracy	F1
1	Histogram + SVM	99.86%	0.9981
1=	ResNet18	99.86%¹	0.9985
3	Histogram + Random Forest	99.58%	0.9943
4	HOG + SVM	99.30%	0.9905
5	Raw Pixels + SVM	99.16%	0.9886
6	HOG + Random Forest	98.32%	0.9771
...	(21 combinations total)		
19	Canny + SVM	70.35%	
20	Canny + Random Forest	64.90%	
21	Canny + Logistic Regression	59.86%	
¹ A later logged run shows 99.72% (`docs/data/models.json`) — normal GPU run-to-run
variance, not a data change.
Full numbers: `classical_full_test_results.csv`, `model_testing_results.csv`. Sortable version: live dashboard.
Key Findings
A 99.86% accuracy on a real-world defect dataset is worth doubting. Two investigations
dug into why the numbers were this good.
1. Data leakage — 64 duplicate images
One `ok_front` image was found byte-identical (MD5 match) in both `train/` and
`test/`. A full MD5 sweep found 64 such duplicates — all `ok_front`, none `def_front` —
meaning 24.4% of the `ok_front` test set had already been seen during training.
Fix: the 64 images were moved out of `train/` (kept in
`data/leaked_duplicates_removed_from_train/`),
all 22 models were retrained from scratch, and re-scored on the same untouched test set.
Result: accuracy barely moved — mean shift across the 21 classical models was
-0.49 points, worst single-model drop -2.66 points. The leak was real, but it
wasn't propping up the headline numbers; fixing it made the accuracy honestly measured.
2. A brightness shortcut, caught with Grad-CAM
A spatially-blind 256-number histogram scoring almost as well as a fine-tuned CNN, on a
task about spotting small localized defects, is unusual. `07_error_analysis.ipynb`
checked why:
Grad-CAM on ResNet18 shows attention correctly localizing to the part's bore/rim region on every high-confidence "defective" prediction — a real signal, not a copy of the histogram.
Class-wise statistics (n = 7,348, Mann-Whitney U + Welch's t-test) confirm `def_front` is systematically about 10-11 intensity levels darker than `ok_front`, with higher edge density (p ≈ 0).
Flattening every image's brightness histogram (LAB equalization) drops accuracy from 99.86% to 63.4% (Histogram+SVM) and 63.8% (ResNet18) — about 36 points for both; the CNN is not meaningfully more robust.
UMAP shows ResNet18's learned features separate the two classes more cleanly than the raw histogram in 2D, but that representation is just as brightness-dependent once illumination is normalized.
Takeaway: ResNet18 does learn a genuine, localized notion of the defect, but neither
model's 99.86% should be assumed to transfer to different lighting or exposure.
Retrain with brightness/contrast augmentation and re-run this test before deployment.
Notebooks
Run in order — each depends on artifacts from the ones before it.
#	Notebook	What it does
01	`01_EDA.ipynb`	class balance, image dimensions, sample visualization
02	`02_check_data_pipeline.ipynb`	validates the train/val split and augmentation rules
03	`03_classical_features.ipynb`	visualizes every hand-crafted feature
04	`04_classical_ml.ipynb`	first-pass classical benchmark
05	`05_deep_learning.ipynb`	ResNet18 fine-tuning
06	`06_model_testing.ipynb`	statistical evaluation (cross-validation, confidence intervals)
07	`07_error_analysis.ipynb`	Grad-CAM, class stats, robustness test, UMAP — needs `pip install grad-cam umap-learn`
08	`08_classical_full_benchmark.ipynb`	all 21 combinations, final test numbers
Getting Started
```bash
git clone https://github.com/peotrannnn/Casting-Quality-Inspection-using-ML-DL.git
cd Casting-Quality-Inspection-using-ML-DL

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install numpy pandas matplotlib tqdm joblib \
            opencv-python scikit-image scikit-learn \
            torch torchvision \
            kagglehub grad-cam umap-learn \
            jupyter

python src/data/00_download_data.py      # downloads dataset into data/raw/
jupyter notebook notebooks/01_EDA.ipynb  # then 02 -> 08 in order
```
`00_download_data.py` needs a Kaggle account/API token (kagglehub docs).
Trained weights (`models/classical/*.joblib`, `models/resnet18_casting.pt`) are not
included — re-run the notebooks to reproduce them.
Interactive Dashboard
`docs/` is a static, GitHub-Pages-ready site with three pages:
About — the story above, illustrated with real notebook figures.
Playground — browse 715 test images against 22 models' precomputed predictions (15,730 total), no code needed.
Model Stats — full sortable leaderboard, leakage before/after table, UMAP plots.
```bash
python -m http.server --directory docs   # then open localhost:8000
```
To publish: Settings → Pages → Source: `docs/`.
Limitations & Future Work
Illumination sensitivity — ~99.9% accuracy is not expected to hold under different lighting; retrain with brightness/contrast augmentation before deployment.
Single capture source — all images come from one factory line; generalization to other sources is untested.
Corner Grad-CAM artifact — all 6 top-confidence "OK" predictions show a faint hot spot in an image corner. It doesn't change any decision, but is worth a look (possibly a fixture or lighting quirk).
Tech Stack
Python, OpenCV, scikit-image, scikit-learn, PyTorch, torchvision, pandas, numpy,
matplotlib, `grad-cam`, `umap-learn`, Jupyter, plus a static HTML/CSS/JS dashboard in
`docs/`.
Acknowledgments
Dataset: ravirajsinh45 / Real-life Industrial Dataset of Casting Product, Pilot TechnoCast, Shapar, Rajkot, India.
Error-analysis methodology inspired by Lee et al., Int. J. Precis. Eng. Manuf. (link), adapted from their unsupervised GAN setting to this project's supervised classifiers.
License
No `LICENSE` file yet — add one (MIT or Apache-2.0) if you want others to reuse this
code. The dataset has its own Kaggle license — check before redistributing it.
---
Tóm tắt Tiếng Việt
Dự án so sánh 22 model — 21 tổ hợp đặc trưng thị giác cổ điển × bộ phân loại, cộng một
ResNet18 fine-tune — trên cùng 715 ảnh thật từ nhà máy đúc Pilot TechnoCast (Shapar,
Rajkot, Ấn Độ), chi tiết là cánh bơm chìm, 2 lớp `def_front`/`ok_front`.
Model tốt nhất (Histogram + SVM) và ResNet18 đều đạt 99,86% accuracy trên tập test —
bảng đầy đủ ở mục Results. Vì con số này quá cao với một bài toán lỗi thị
giác thực tế, dự án đã điều tra thêm 2 việc, xem chi tiết ở Key Findings:
Rò rỉ dữ liệu: phát hiện 64 ảnh `ok_front` trùng lặp (khớp MD5) giữa `train/` và
`test/`, chiếm 24,4% tập test của lớp này. Sau khi loại bỏ và train lại toàn bộ 22
model, accuracy trung bình chỉ đổi -0,49 điểm — rò rỉ có thật nhưng không phải nguyên
nhân chính tạo ra kết quả cao.
"Đường tắt" độ sáng: `def_front` tối hơn `ok_front` khoảng 10-11 mức sáng một
cách có hệ thống (p ≈ 0). Khi làm phẳng độ sáng ảnh, accuracy của cả model classical
lẫn ResNet18 đều rơi từ 99,86% xuống còn khoảng 63-64% — nghĩa là ResNet18 không bền
hơn model cổ điển trước thay đổi ánh sáng, dù Grad-CAM cho thấy nó vẫn nhìn đúng vùng
lỗi trên chi tiết.
Kết luận: không nên mặc định accuracy ~99,9% giữ nguyên trên ảnh chụp ở điều kiện ánh
sáng khác. Cần train lại với augmentation độ sáng/tương phản trước khi triển khai thực
tế.
Cách chạy dự án, cấu trúc thư mục, danh sách notebook và dashboard tương tác: xem các
mục tương ứng ở phần tiếng Anh phía trên — Repository Structure,
Notebooks, Getting Started,
Interactive Dashboard.
