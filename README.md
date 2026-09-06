Casting Quality Inspection — ML & DL
Automated visual quality inspection for cast metal parts: 22 models — 21 classical
computer-vision + machine-learning pipelines and one fine-tuned ResNet18 — benchmarked
head-to-head on the same 715 real factory photos, with an interactive results dashboard
and a full write-up of two things that went wrong along the way (data leakage, and a
brightness shortcut) and how they were caught.
Live demo: `https://peotrannnn.github.io/Casting-Quality-Inspection-using-ML-DL/` (enable GitHub Pages on the `docs/` folder if it isn't live yet)
---
Table of Contents
Overview
Dataset
Repository Structure
Method
Results
Key Findings: Two Things That Went Wrong
Notebooks
Getting Started
Interactive Dashboard
Limitations & Future Work
Tech Stack
Acknowledgments
License
Phiên bản Tiếng Việt
---
Overview
Can a machine spot a bad casting just by looking at it? This project answers that with
real data instead of assumptions: 7 hand-crafted computer-vision features × 3 classical
classifiers (21 combinations) are benchmarked against a fine-tuned ResNet18, all on the
exact same held-out test set, with a consistent, leakage-aware evaluation protocol.
The top classical model (a 256-bin grayscale histogram + SVM) and the deep model both
reach 99.86% test accuracy — but this repo doesn't stop at the leaderboard. Two
follow-up investigations are included because the numbers looked too good to trust
blindly:
A train/test duplicate-image leak was found and fixed (see below).
A brightness "shortcut" was uncovered with Grad-CAM, class-wise statistics, and a
robustness stress test — showing that both the classical and deep models lean on the
same illumination confound in this dataset.
Dataset
Source: Real-life Industrial Dataset of Casting Product on Kaggle, published by ravirajsinh45.
Provenance: real photos from an actual production line at Pilot TechnoCast, a casting manufacturer in Shapar, Rajkot, India — not a synthetic benchmark.
Subject: a submersible pump impeller.
Classes: `def_front` (defective) and `ok_front` (OK).
Size used in this project: 7,284 images (300×300 grayscale-look RGB), pre-split into train/test.
`def_front`: 3,758 train / 453 test
`ok_front`: 2,811 train / 262 test (before leak cleanup — see Key Findings)
Defects include blow holes, pinholes, burr, shrinkage, and mould-material/pouring-metal defects.
Download it yourself with:
```bash
python src/data/00_download_data.py
```
(uses `kagglehub`; it downloads into `data/raw/`).
Repository Structure
```
Casting Quality Inspection/
├── data/
│   ├── raw/casting_data/casting_data/{train,test}/{def_front,ok_front}/   # original split
│   └── leaked_duplicates_removed_from_train/ok_front/                    # the 64 images pulled out of train/
├── src/
│   ├── data/
│   │   ├── 00_download_data.py     # pulls the dataset from Kaggle via kagglehub
│   │   └── 01_prepare_data.py      # leakage-aware train/val/test DataLoaders
│   └── features/                   # hand-crafted feature extractors (reused by the notebooks)
│       ├── histogram.py            # 256-bin grayscale intensity histogram
│       ├── edges.py                # Sobel magnitude + Canny edge map
│       ├── texture.py              # LBP histogram + GLCM statistics
│       └── hog.py                  # Histogram of Oriented Gradients
├── notebooks/
│   ├── 01_EDA.ipynb                         # dataset exploration
│   ├── 02_check_data_pipeline.ipynb         # train/val split + leakage sanity checks
│   ├── 03_classical_features.ipynb          # visualizes every hand-crafted feature
│   ├── 04_classical_ml.ipynb                # classical benchmark, first pass
│   ├── 05_deep_learning.ipynb               # ResNet18 fine-tuning
│   ├── 06_model_testing.ipynb               # statistical evaluation, both model families
│   ├── 07_error_analysis.ipynb              # Grad-CAM, shortcut-learning checks (see below)
│   └── 08_classical_full_benchmark.ipynb    # all 21 feature×classifier combos, final test numbers
├── results/
│   ├── metrics/                    # classical_full_test_results.csv, model_testing_results.csv
│   └── error_analysis/             # Grad-CAM heatmaps, misclassified examples, robustness CSV
└── docs/                           # GitHub Pages dashboard (About / Playground / Model Stats)
```
Method
Classical pipeline — 7 feature extractors × 3 classifiers, 21 total combinations,
every one trained and evaluated on the identical split:
Feature	What it captures	Dim.
Raw Pixels	flattened 64×64 grayscale image (baseline)	4,096
Histogram	256-bin normalized grayscale intensity distribution	256
Sobel	gradient magnitude, x/y Sobel kernels	flattened
Canny	binary edge map	flattened
LBP	Local Binary Pattern texture histogram (P=8, R=1)	10
HOG	Histogram of Oriented Gradients (9 orientations, 16×16 cells)	6,084
GLCM	gray-level co-occurrence texture stats (contrast, homogeneity, energy, correlation, dissimilarity)	5
Classifiers: Logistic Regression, Random Forest (200 trees), SVM (RBF
kernel) — all scikit-learn defaults except where noted, wrapped in a
`StandardScaler → classifier` pipeline.
Deep learning — ResNet18, pretrained on ImageNet, fine-tuned end-to-end for 10
epochs (Adam, lr=1e-4, batch size 32, `RandomHorizontalFlip` + `RandomRotation(10°)`
augmentation on train only, 224×224 ImageNet-normalized input). Model checkpoint
selected by best validation F1 across the 10 epochs.
Both families share the same reproducible train/val split (`torch.Generator` seeded at
42, 80/20) and the same untouched test set.
Results
Top of the 21-model classical leaderboard, plus ResNet18, on the held-out test set
(after the leak fix — see below):
Rank	Model	Test Accuracy	F1
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
¹ ResNet18's own held-out test evaluation (`06_model_testing.ipynb`) reports 99.86%;
a later run recorded in `docs/data/models.json` shows 99.72% — the small difference
reflects normal run-to-run variance from a non-deterministic GPU training step, not a
data change.
Full numbers for all 21 classical combinations: `results/metrics/classical_full_test_results.csv`. Cross-validated + test statistics for the two headline models: `results/metrics/model_testing_results.csv`.
The full leaderboard, filterable and sortable, is also on the live dashboard.
Key Findings: Two Things That Went Wrong
A 99.86% accuracy on a real-world visual-defect dataset is worth being suspicious of.
This project didn't stop at the leaderboard — two separate investigations dug into
why the numbers were this good.
1. Data leakage: 64 duplicate images in train and test
While reviewing the dataset, one `ok_front` image was found to exist, byte-for-byte
identical (MD5-matched), in both `train/` and `test/`. A full MD5 sweep of the
dataset turned up 64 such duplicates — all in `ok_front`, none in `def_front` — meaning
24.4% of the `ok_front` test set had already been seen by the model during training.
Fix: the 64 duplicates were moved out of `train/` (kept in
`data/leaked_duplicates_removed_from_train/`
for the record) and every one of the 22 models was retrained from scratch on the
cleaned split, then re-scored on the exact same, untouched test set.
Result: accuracy barely moved — mean shift across all 21 classical models was
-0.49 percentage points, worst single-model drop -2.66 points. The leak was real,
but it wasn't propping up the headline numbers; fixing it mostly just makes the reported
accuracy honestly measured rather than artificially inflated.
2. A brightness shortcut, found with Grad-CAM + a robustness stress test
`06_model_testing.ipynb` showed both model families generalize well (no classic
overfitting). But a spatially-blind 256-number grayscale histogram scoring almost
as well as a fine-tuned CNN, on a task that's supposedly about spotting small localized
defects, is an unusual pattern — `07_error_analysis.ipynb` dug into why:
Grad-CAM on ResNet18 shows attention correctly localizing to the part's inner
bore/rim region on every high-confidence correct "defective" prediction — a
physically sensible signal, not a black box copying the histogram.
Class-wise statistics (n = 7,348, Mann-Whitney U + Welch's t-test) confirm
`def_front` images are systematically ~10-11 intensity levels darker than
`ok_front`, with slightly higher edge density — both differences significant at
p ≈ 0.
The stress test: flattening every image's brightness histogram (LAB-channel
equalization) collapses test accuracy from 99.86% to 63.4% (Histogram+SVM) and
63.8% (ResNet18) — a ~36-point drop for both models, essentially the same
magnitude for the CNN as for the classical baseline.
UMAP shows ResNet18's learned 512-d features separate the two classes far more
cleanly than the raw histogram does in 2D — a qualitatively better representation —
but section 8's numbers show that better representation is just as
brightness-dependent once illumination is normalized.
Takeaway: ResNet18 does appear to learn a genuine, localized notion of what a
casting defect looks like — but neither model's 99.86% accuracy should be assumed to
transfer to images captured under different lighting/exposure conditions. Before
deploying either model, retrain with brightness/contrast augmentation and re-run this
same robustness test.
Notebooks
Run in order — each one after `02` depends on artifacts from the previous ones:
`01_EDA.ipynb` — dataset exploration: class balance, image dimensions, sample visualization.
`02_check_data_pipeline.ipynb` — validates the train/val split (no leakage between them, augmentation only on train).
`03_classical_features.ipynb` — visualizes every hand-crafted feature (histogram, Sobel, Canny, LBP, HOG, GLCM) with interpretation notes.
`04_classical_ml.ipynb` — first-pass classical benchmark (subset of feature×classifier combos).
`05_deep_learning.ipynb` — ResNet18 transfer learning and fine-tuning.
`06_model_testing.ipynb` — rigorous statistical evaluation (cross-validation, confidence intervals) of the two headline models.
`07_error_analysis.ipynb` — Grad-CAM, class-wise stats, the brightness robustness test, and UMAP embeddings. Requires `pip install grad-cam umap-learn` and the models saved by notebook 06.
`08_classical_full_benchmark.ipynb` — all 21 classical combinations scored on the test set, producing `results/metrics/classical_full_test_results.csv`.
Getting Started
```bash
git clone https://github.com/peotrannnn/Casting-Quality-Inspection-using-ML-DL.git
cd Casting-Quality-Inspection-using-ML-DL

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install numpy pandas matplotlib tqdm joblib \
            opencv-python scikit-image scikit-learn \
            torch torchvision \
            kagglehub grad-cam umap-learn \
            jupyter

python src/data/00_download_data.py   # downloads the Kaggle dataset into data/raw/

jupyter notebook notebooks/01_EDA.ipynb   # then work through 02 -> 08 in order
```
`src/data/00_download_data.py` uses `kagglehub`, which needs a Kaggle account/API
token configured locally (see the kagglehub docs
if you haven't set one up).
Trained model weights (`models/classical/*.joblib`, `models/resnet18_casting.pt`) are
not included in this repository — re-run the notebooks to reproduce them.
Interactive Dashboard
The `docs/` folder is a static, GitHub-Pages-ready site with three pages:
About — the story above, illustrated with real figures from the notebooks.
Playground — browse the 715 test-set images against 22 models' precomputed
predictions (15,730 predictions total) without running any code.
Model Stats — the full sortable/filterable 22-model leaderboard, the
leakage before/after table, and the UMAP embeddings, all drawn live from the
underlying JSON data in `docs/data/`.
To view it locally: `python -m http.server --directory docs` and open
`http://localhost:8000`. To publish it, enable GitHub Pages on this repo pointing at
the `docs/` folder (Settings → Pages → Source: `docs/`).
Limitations & Future Work
Illumination sensitivity: as shown above, ~99.9% accuracy should not be assumed
to hold under different lighting/exposure than this dataset's capture conditions.
Retraining with brightness/contrast augmentation, and validating against images from
a different capture source, is the recommended next step before any deployment.
Single capture source: all images come from one production line at one factory;
generalization to other casting types or cameras is untested.
Corner Grad-CAM artifact: all 6 highest-confidence correct "OK" predictions
showed a small, low-magnitude hot spot in an image corner (outside the part). It
doesn't change any decision (P(defective) still rounds to 0.000 in every case), but
is worth a closer look — possibly a fixture/lighting artifact in the capture setup.
Tech Stack
Python · OpenCV · scikit-image · scikit-learn · PyTorch / torchvision · pandas / numpy
· matplotlib · `grad-cam` · `umap-learn` · Jupyter · a static HTML/CSS/JS dashboard for
`docs/`.
Acknowledgments
Dataset: ravirajsinh45 / Real-life Industrial Dataset of Casting Product (Kaggle), photographed at Pilot TechnoCast, Shapar, Rajkot, India.
The error-analysis methodology in `07_error_analysis.ipynb` was inspired by the
evaluation/interpretability techniques in Lee et al., Int. J. Precis. Eng. Manuf.
(link), adapted here
from their unsupervised GAN setting to this project's supervised classifiers.
License
No license file is currently included in this repository. If you intend others to
reuse this code, add a `LICENSE` file (e.g. MIT or Apache-2.0) — until then, all
rights are reserved by default. The dataset itself is subject to its own license on
Kaggle; check the dataset page before redistributing it.
---
Phiên bản Tiếng Việt
Tổng quan
Máy có thể phát hiện một sản phẩm đúc bị lỗi chỉ bằng cách "nhìn" vào ảnh không? Dự án
này trả lời câu hỏi đó bằng dữ liệu thật: 7 đặc trưng thị giác máy tính thủ công × 3 bộ
phân loại cổ điển (21 tổ hợp) được so sánh trực tiếp với một mô hình ResNet18 fine-tune,
tất cả trên cùng một tập test giữ lại, theo cùng một quy trình đánh giá nhất quán, có
kiểm soát rò rỉ dữ liệu.
Model classical tốt nhất (histogram xám 256 bin + SVM) và model deep learning đều đạt
99,86% accuracy trên tập test — nhưng dự án không dừng lại ở bảng xếp hạng. Có 2
cuộc điều tra tiếp theo vì con số này "tốt một cách đáng ngờ":
Phát hiện và sửa rò rỉ dữ liệu do ảnh trùng lặp giữa train/test.
Phát hiện "đường tắt" (shortcut) dựa vào độ sáng bằng Grad-CAM, thống kê theo
lớp, và một bài test độ bền — cho thấy cả model classical lẫn deep learning đều dựa
vào cùng một điểm nhiễu về ánh sáng trong bộ dữ liệu này.
Bộ dữ liệu
Nguồn: Real-life Industrial Dataset of Casting Product trên Kaggle, do ravirajsinh45 đăng tải.
Xuất xứ: ảnh chụp thật từ dây chuyền sản xuất tại Pilot TechnoCast, một nhà máy đúc kim loại ở Shapar, Rajkot, Ấn Độ — không phải dữ liệu tổng hợp.
Chi tiết đúc: cánh bơm chìm (submersible pump impeller).
2 lớp: `def_front` (lỗi) và `ok_front` (đạt chuẩn).
Số lượng dùng trong dự án: 7.284 ảnh (300×300, RGB), đã chia sẵn train/test.
`def_front`: 3.758 train / 453 test
`ok_front`: 2.811 train / 262 test (trước khi dọn dữ liệu rò rỉ — xem phần Phát hiện quan trọng)
Các lỗi bao gồm: rỗ khí, lỗ kim, ba-via, co ngót, lỗi khuôn/lỗi rót kim loại.
Tải dữ liệu bằng:
```bash
python src/data/00_download_data.py
```
(dùng thư viện `kagglehub`, tự tải về `data/raw/`).
Cấu trúc thư mục
Xem sơ đồ đầy đủ ở phần tiếng Anh phía trên (Repository Structure) — giữ nguyên tên thư mục gốc để khớp với repo thật.
Phương pháp
Pipeline classical — 7 loại đặc trưng × 3 bộ phân loại = 21 tổ hợp, mỗi tổ hợp
huấn luyện/đánh giá trên đúng cùng 1 tập chia:
Đặc trưng	Ý nghĩa	Số chiều
Raw Pixels	ảnh xám 64×64 làm phẳng thành vector (baseline)	4.096
Histogram	phân bố độ sáng xám, 256 bin	256
Sobel	độ lớn gradient theo kernel Sobel x/y	làm phẳng
Canny	bản đồ biên nhị phân	làm phẳng
LBP	histogram texture Local Binary Pattern (P=8, R=1)	10
HOG	Histogram of Oriented Gradients (9 hướng, ô 16×16)	6.084
GLCM	thống kê texture từ ma trận đồng xuất hiện mức xám	5
Bộ phân loại: Logistic Regression, Random Forest (200 cây), SVM (kernel
RBF) — dùng tham số mặc định của scikit-learn trừ khi ghi chú khác, đóng gói trong
pipeline `StandardScaler → classifier`.
Deep learning — ResNet18 pretrained trên ImageNet, fine-tune toàn bộ trong 10
epoch (Adam, lr=1e-4, batch size 32, augment `RandomHorizontalFlip` + `RandomRotation(10°)`
chỉ trên tập train, ảnh đầu vào 224×224 chuẩn hoá theo ImageNet). Checkpoint được chọn
theo validation F1 tốt nhất trong 10 epoch.
Cả 2 nhánh dùng chung 1 cách chia train/val (seed 42, tỉ lệ 80/20) và chung 1 tập test
không bao giờ bị động vào.
Kết quả
Top bảng xếp hạng 21 model classical, cộng thêm ResNet18, trên tập test (sau khi đã sửa
lỗi rò rỉ):
Hạng	Model	Accuracy	F1
1	Histogram + SVM	99,86%	0,9981
1=	ResNet18	99,86%¹	0,9985
3	Histogram + Random Forest	99,58%	0,9943
4	HOG + SVM	99,30%	0,9905
5	Raw Pixels + SVM	99,16%	0,9886
6	HOG + Random Forest	98,32%	0,9771
...	(tổng 21 tổ hợp)		
19	Canny + SVM	70,35%	
20	Canny + Random Forest	64,90%	
21	Canny + Logistic Regression	59,86%	
¹ Kết quả test độc lập của ResNet18 trong `06_model_testing.ipynb` là 99,86%; một lần
chạy khác ghi trong `docs/data/models.json` cho 99,72% — chênh lệch nhỏ này đến từ độ
bất định bình thường của quá trình train trên GPU, không phải do thay đổi dữ liệu.
Số liệu đầy đủ 21 tổ hợp: `results/metrics/classical_full_test_results.csv`. Thống kê cross-validation + test của 2 model chính: `results/metrics/model_testing_results.csv`.
Bảng xếp hạng đầy đủ, có thể lọc/sắp xếp, cũng có trên dashboard trực tuyến.
Phát hiện quan trọng: Hai sự cố đã gặp
Accuracy 99,86% trên một bộ dữ liệu lỗi thị giác thực tế là con số đáng để nghi ngờ.
Dự án không dừng ở bảng xếp hạng — 2 cuộc điều tra riêng biệt đã đi tìm lý do vì sao
kết quả tốt đến vậy.
1. Rò rỉ dữ liệu: 64 ảnh trùng lặp giữa train và test
Trong lúc rà soát, phát hiện 1 ảnh `ok_front` tồn tại giống hệt từng byte (khớp
MD5) ở cả `train/` và `test/`. Quét MD5 toàn bộ dataset phát hiện 64 ảnh trùng
lặp như vậy — toàn bộ đều thuộc `ok_front`, không có ở `def_front` — nghĩa là
24,4% tập test của `ok_front` đã bị model "nhìn thấy" ngay trong lúc train.
Cách sửa: 64 ảnh trùng được chuyển ra khỏi `train/` (lưu lại trong
`data/leaked_duplicates_removed_from_train/`
để đối chiếu), toàn bộ 22 model được train lại từ đầu trên tập dữ liệu đã dọn sạch, rồi
đánh giá lại trên đúng tập test cũ, không đổi.
Kết quả: accuracy gần như không đổi — trung bình 21 model classical chỉ lệch
-0,49 điểm phần trăm, model tụt nhiều nhất cũng chỉ -2,66 điểm. Rò rỉ là có
thật, nhưng không phải nguyên nhân chính tạo ra con số cao — sửa lỗi này chủ yếu giúp
accuracy được đo một cách trung thực thay vì bị thổi phồng.
2. "Đường tắt" dựa vào độ sáng — phát hiện bằng Grad-CAM + bài test độ bền
`06_model_testing.ipynb` cho thấy cả 2 nhóm model đều generalize tốt (không overfitting
kiểu cổ điển). Nhưng việc một histogram độ sáng 256 số, hoàn toàn không có thông tin
không gian, lại đạt điểm gần bằng một CNN fine-tune, trong một bài toán vốn dĩ là phát
hiện lỗi cục bộ nhỏ, là một dấu hiệu bất thường — `07_error_analysis.ipynb` đã đi tìm lý do:
Grad-CAM trên ResNet18 cho thấy vùng chú ý khoanh đúng vào khu vực lỗ trong/vành
của chi tiết ở mọi dự đoán "lỗi" có độ tin cậy cao — một tín hiệu hợp lý về mặt vật
lý, không phải "học vẹt" theo histogram.
Thống kê theo lớp (n = 7.348, kiểm định Mann-Whitney U + Welch's t-test) xác nhận
ảnh `def_front` tối hơn khoảng 10-11 mức sáng so với `ok_front` một cách có hệ
thống, cùng với mật độ biên cao hơn một chút — cả 2 khác biệt đều có ý nghĩa thống kê
ở mức p ≈ 0.
Bài test độ bền: làm phẳng histogram độ sáng của từng ảnh (cân bằng kênh LAB)
khiến accuracy rơi từ 99,86% xuống còn 63,4% (Histogram+SVM) và 63,8%
(ResNet18) — cả 2 model đều giảm khoảng 36 điểm, gần như tương đương nhau.
UMAP cho thấy đặc trưng 512 chiều mà ResNet18 học được tách 2 lớp rõ ràng hơn
nhiều so với histogram thô khi chiếu xuống 2D — một biểu diễn tốt hơn về mặt chất
lượng — nhưng số liệu ở bước trên cho thấy biểu diễn "tốt hơn" đó vẫn phụ thuộc độ
sáng y hệt như vậy khi ánh sáng bị chuẩn hoá.
Kết luận: ResNet18 thực sự học được một khái niệm hợp lý, có vị trí cụ thể, về hình
dạng lỗi đúc — nhưng không nên mặc định accuracy 99,86% của bất kỳ model nào sẽ giữ
nguyên trên ảnh chụp trong điều kiện ánh sáng/phơi sáng khác. Trước khi triển khai thực
tế, cần train lại với augmentation về độ sáng/tương phản và chạy lại đúng bài test độ
bền này.
Notebooks
Chạy theo đúng thứ tự — mỗi notebook sau `02` đều phụ thuộc vào kết quả của notebook
trước:
`01_EDA.ipynb` — khám phá dữ liệu: cân bằng lớp, kích thước ảnh, xem mẫu.
`02_check_data_pipeline.ipynb` — kiểm tra chia train/val (không rò rỉ giữa 2 tập, chỉ augment trên train).
`03_classical_features.ipynb` — trực quan hoá từng đặc trưng thủ công (histogram, Sobel, Canny, LBP, HOG, GLCM) kèm giải thích.
`04_classical_ml.ipynb` — benchmark classical lần đầu (một phần tổ hợp).
`05_deep_learning.ipynb` — fine-tune ResNet18.
`06_model_testing.ipynb` — đánh giá thống kê chặt chẽ (cross-validation, khoảng tin cậy) cho 2 model chính.
`07_error_analysis.ipynb` — Grad-CAM, thống kê theo lớp, bài test độ bền độ sáng, UMAP. Cần `pip install grad-cam umap-learn` và các model đã lưu từ notebook 06.
`08_classical_full_benchmark.ipynb` — chạy đủ 21 tổ hợp classical trên tập test, sinh ra `results/metrics/classical_full_test_results.csv`.
Bắt đầu
```bash
git clone https://github.com/peotrannnn/Casting-Quality-Inspection-using-ML-DL.git
cd Casting-Quality-Inspection-using-ML-DL

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install numpy pandas matplotlib tqdm joblib \
            opencv-python scikit-image scikit-learn \
            torch torchvision \
            kagglehub grad-cam umap-learn \
            jupyter

python src/data/00_download_data.py   # tải dataset từ Kaggle về data/raw/

jupyter notebook notebooks/01_EDA.ipynb   # rồi chạy tiếp 02 -> 08 theo thứ tự
```
`src/data/00_download_data.py` dùng `kagglehub`, cần có tài khoản/API token Kaggle đã
cấu hình sẵn trên máy (xem tài liệu kagglehub
nếu chưa thiết lập).
Trọng số model đã train (`models/classical/*.joblib`, `models/resnet18_casting.pt`)
không được đưa vào repo — chạy lại notebook để tái tạo.
Dashboard tương tác
Thư mục `docs/` là một trang web tĩnh, sẵn sàng deploy bằng GitHub Pages, gồm 3 trang:
About — kể lại câu chuyện ở trên, minh hoạ bằng hình ảnh thật từ notebook.
Playground — xem thử dự đoán có sẵn của 22 model trên 715 ảnh test (tổng 15.730
dự đoán) mà không cần chạy code.
Model Stats — bảng xếp hạng đầy đủ 22 model (lọc/sắp xếp được), bảng so sánh
trước/sau khi sửa rò rỉ, và biểu đồ UMAP — tất cả lấy trực tiếp từ dữ liệu JSON trong
`docs/data/`.
Xem thử ở máy local: `python -m http.server --directory docs` rồi mở
`http://localhost:8000`. Để public: bật GitHub Pages cho repo này, trỏ vào thư mục
`docs/` (Settings → Pages → Source: `docs/`).
Hạn chế & hướng phát triển
Nhạy với ánh sáng: như đã chứng minh ở trên, không nên mặc định accuracy ~99,9%
sẽ giữ nguyên trên ảnh chụp với ánh sáng/phơi sáng khác. Nên train lại với
augmentation về độ sáng/tương phản, và validate thêm trên ảnh từ nguồn chụp khác,
trước khi triển khai thực tế.
Chỉ một nguồn chụp: toàn bộ ảnh đến từ 1 dây chuyền, 1 nhà máy; chưa kiểm chứng
khả năng tổng quát hoá sang loại sản phẩm đúc hoặc camera khác.
Hiện tượng lạ ở góc ảnh trong Grad-CAM: cả 6 dự đoán "OK" tin cậy cao nhất đều
xuất hiện 1 điểm sáng nhỏ ở góc ảnh (ngoài chi tiết đúc). Không ảnh hưởng đến quyết
định cuối (P(defective) vẫn làm tròn về 0.000), nhưng đáng để xem xét thêm — có thể
là do đồ gá hoặc ánh sáng trong lúc chụp.
Công nghệ sử dụng
Python · OpenCV · scikit-image · scikit-learn · PyTorch / torchvision · pandas / numpy
· matplotlib · `grad-cam` · `umap-learn` · Jupyter · dashboard tĩnh HTML/CSS/JS cho
`docs/`.
Lời cảm ơn
Dataset: ravirajsinh45 / Real-life Industrial Dataset of Casting Product (Kaggle), chụp tại Pilot TechnoCast, Shapar, Rajkot, Ấn Độ.
Phương pháp phân tích lỗi trong `07_error_analysis.ipynb` lấy cảm hứng từ kỹ thuật
đánh giá/giải thích trong Lee et al., Int. J. Precis. Eng. Manuf.
(link), được chuyển
đổi từ bối cảnh GAN không giám sát của họ sang bộ phân loại có giám sát của dự án này.
Giấy phép
Repo hiện chưa có file giấy phép (LICENSE). Nếu muốn cho phép người khác sử dụng lại
code, hãy thêm file `LICENSE` (ví dụ MIT hoặc Apache-2.0) — trước khi có file này, mặc
định mọi quyền đều thuộc về tác giả. Bản thân bộ dữ liệu tuân theo giấy phép riêng trên
Kaggle — xem trang dataset trước khi phân phối lại.
