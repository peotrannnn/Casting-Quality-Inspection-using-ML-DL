Casting Quality Inspection — ML & DL
> Can a machine spot a bad casting just by looking at it? **22 models** — 21 classical
> CV/ML pipelines + 1 fine-tuned ResNet18 — benchmarked on the same **715 real factory
> photos**, plus the story of two things that looked wrong and how they were caught.
Live demo: `https://peotrannnn.github.io/Casting-Quality-Inspection-using-ML-DL/`
(enable GitHub Pages → Source: `docs/` if not live yet)
---
Jump to
Overview · Dataset · Structure ·
Method · Results · Key Findings ·
Notebooks · Setup · Dashboard ·
Limitations · License ·
🇻🇳 Bản Tiếng Việt
---
Overview
7 hand-crafted CV features × 3 classical classifiers = 21 combinations, benchmarked against a fine-tuned ResNet18.
Same held-out test set for every model. Leakage-aware split throughout.
Top score: 99.86% test accuracy (both the best classical model and ResNet18).
The repo doesn't stop at the leaderboard — a 99.86% score on a real defect dataset is worth doubting, so two follow-ups are included:
🔍 A train/test duplicate-image leak — found, fixed, and re-measured.
🔍 A brightness "shortcut" — caught with Grad-CAM, stats, and a stress test.
Dataset
	
Source	Kaggle — Real-life Industrial Dataset of Casting Product by ravirajsinh45
Provenance	Real production photos, Pilot TechnoCast, Shapar, Rajkot, India
Subject	Submersible pump impeller
Classes	`def_front` (defective) · `ok_front` (OK)
Size	7,284 images, 300×300 RGB
Split	`def_front`: 3,758 train / 453 test · `ok_front`: 2,811 train / 262 test¹
Defect types	blow holes, pinholes, burr, shrinkage, mould/pouring-metal defects
¹ before the leak cleanup below — see Key Findings.
```bash
python src/data/00_download_data.py   # via kagglehub -> downloads into data/raw/
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
│       ├── histogram.py            # 256-bin grayscale histogram
│       ├── edges.py                # Sobel magnitude + Canny
│       ├── texture.py              # LBP + GLCM
│       └── hog.py                  # Histogram of Oriented Gradients
├── notebooks/           # 01 -> 08, run in order (see below)
├── results/
│   ├── metrics/          # classical_full_test_results.csv, model_testing_results.csv
│   └── error_analysis/   # Grad-CAM heatmaps, misclassified examples, robustness CSV
└── docs/                 # GitHub Pages dashboard (About / Playground / Model Stats)
```
Method
Classical — 7 features × 3 classifiers:
Feature	Captures	Dim.
Raw Pixels	flattened 64×64 grayscale (baseline)	4,096
Histogram	256-bin grayscale intensity distribution	256
Sobel	gradient magnitude (x/y kernels)	flattened
Canny	binary edge map	flattened
LBP	texture histogram (P=8, R=1)	10
HOG	9 orientations, 16×16 cells	6,084
GLCM	contrast / homogeneity / energy / correlation	5
Classifiers: Logistic Regression · Random Forest (200 trees) · SVM (RBF) — scikit-learn defaults, in a `StandardScaler → classifier` pipeline.
Deep learning:
ResNet18, ImageNet-pretrained, fine-tuned end-to-end for 10 epochs.
Adam, lr = 1e-4, batch size 32, 224×224 input.
Augmentation (train only): `RandomHorizontalFlip` + `RandomRotation(10°)`.
Checkpoint = best validation F1 across the 10 epochs.
Both families: same seeded 80/20 train/val split, same untouched test set.
Results
Top of the 21-model leaderboard + ResNet18 (test set, after the leak fix):
Rank	Model	Accuracy	F1
1	Histogram + SVM	99.86%	0.9981
1=	ResNet18	**99.86%**¹	0.9985
3	Histogram + Random Forest	99.58%	0.9943
4	HOG + SVM	99.30%	0.9905
5	Raw Pixels + SVM	99.16%	0.9886
6	HOG + Random Forest	98.32%	0.9771
⋯	(21 combos total)		
19	Canny + SVM	70.35%	
20	Canny + Random Forest	64.90%	
21	Canny + Logistic Regression	59.86%	
¹ A later logged run shows 99.72% (`docs/data/models.json`) — normal GPU run-to-run variance, not a data change.
📄 Full numbers: `classical_full_test_results.csv` · `model_testing_results.csv`
📊 Sortable/filterable version: live dashboard
Key Findings
> A 99.86% accuracy on a real-world defect dataset deserves suspicion, not applause.
> Two investigations below dug into *why* the numbers were this good.
1️⃣ Data leakage — 64 duplicate images
One `ok_front` image was found byte-identical (MD5 match) in both `train/` and `test/`.
A full MD5 sweep found 64 duplicates total — all `ok_front`, none `def_front`.
24.4% of the `ok_front` test set had already been seen during training.
Fix → moved the 64 images out of `train/` (kept in `data/leaked_duplicates_removed_from_train/`), retrained all 22 models from scratch, re-scored on the same untouched test set.
Result → accuracy barely moved:
Mean shift across 21 classical models: -0.49 points
Worst single-model drop: -2.66 points
The leak was real, but it wasn't propping up the headline numbers — fixing it just makes the accuracy honestly measured.
2️⃣ A brightness shortcut — caught with Grad-CAM
A spatially-blind 256-number histogram scoring almost as well as a fine-tuned CNN, on a task about spotting small localized defects, is a red flag. `07_error_analysis.ipynb` dug in:
Grad-CAM on ResNet18 → attention correctly localizes to the part's bore/rim region on every high-confidence "defective" call. A real signal, not a copy of the histogram.
Class-wise stats (n = 7,348, Mann-Whitney U + Welch's t-test) → `def_front` is systematically ~10-11 intensity levels darker than `ok_front`, plus higher edge density (p ≈ 0).
Stress test: flatten every image's brightness histogram (LAB equalization) →
Histogram + SVM: 99.86% → 63.4%
ResNet18: 99.86% → 63.8%
Both drop ~36 points — the CNN is not meaningfully more robust.
UMAP → ResNet18's 512-d features separate the classes far more cleanly than the raw histogram in 2D — a better representation, but just as brightness-dependent.
> **Takeaway:** ResNet18 does learn a genuine, localized notion of the defect — but neither
> model's 99.86% should be assumed to transfer to different lighting/exposure. Retrain with
> brightness/contrast augmentation and re-run this test before deploying either model.
Notebooks
Run in order — each depends on artifacts from the ones before it:
#	Notebook	What it does
01	`01_EDA.ipynb`	Class balance, image dimensions, sample visualization
02	`02_check_data_pipeline.ipynb`	Validates the train/val split + augmentation rules
03	`03_classical_features.ipynb`	Visualizes every hand-crafted feature
04	`04_classical_ml.ipynb`	First-pass classical benchmark
05	`05_deep_learning.ipynb`	ResNet18 fine-tuning
06	`06_model_testing.ipynb`	Statistical evaluation (CV, confidence intervals)
07	`07_error_analysis.ipynb`	Grad-CAM, class stats, robustness test, UMAP ⚠️ needs `pip install grad-cam umap-learn`
08	`08_classical_full_benchmark.ipynb`	All 21 combos, final test numbers
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

python src/data/00_download_data.py     # downloads dataset -> data/raw/
jupyter notebook notebooks/01_EDA.ipynb  # then 02 -> 08 in order
```
`00_download_data.py` needs a Kaggle account/API token (kagglehub docs).
Trained weights (`models/classical/*.joblib`, `models/resnet18_casting.pt`) are not included — re-run the notebooks to reproduce them.
Interactive Dashboard
`docs/` is a static, GitHub-Pages-ready site:
About — the story above, illustrated with real notebook figures.
Playground — browse 715 test images × 22 models' precomputed predictions (15,730 total) — no code needed.
Model Stats — full sortable leaderboard, leakage before/after table, UMAP plots.
```bash
python -m http.server --directory docs   # then open localhost:8000
```
To publish: Settings → Pages → Source: `docs/`
Limitations & Future Work
⚠️ Illumination sensitivity — ~99.9% accuracy is not expected to hold under different lighting. Retrain with brightness/contrast augmentation before deployment.
⚠️ Single capture source — all images from one factory/line; cross-source generalization untested.
ℹ️ Corner Grad-CAM artifact — all 6 top-confidence "OK" predictions show a faint hot spot in an image corner. Doesn't change any decision, but worth a look (possibly a fixture/lighting quirk).
Tech Stack
`Python` `OpenCV` `scikit-image` `scikit-learn` `PyTorch` `torchvision` `pandas` `numpy` `matplotlib` `grad-cam` `umap-learn` `Jupyter` — plus a static HTML/CSS/JS dashboard in `docs/`.
Acknowledgments
Dataset: ravirajsinh45 / Real-life Industrial Dataset of Casting Product — Pilot TechnoCast, Shapar, Rajkot, India.
Error-analysis methodology inspired by Lee et al., Int. J. Precis. Eng. Manuf. (link), adapted from their unsupervised GAN setting to this project's supervised classifiers.
License
No `LICENSE` file yet — add one (MIT / Apache-2.0) if you want others to reuse this code. The dataset has its own Kaggle license — check before redistributing it.
---
---
🇻🇳 Phiên bản Tiếng Việt
> Máy có thể phát hiện sản phẩm đúc lỗi chỉ bằng cách "nhìn" ảnh không? **22 model** —
> 21 pipeline CV/ML cổ điển + 1 ResNet18 fine-tune — so tài trên cùng **715 ảnh thật**
> từ nhà máy, kèm câu chuyện về 2 điều bất thường đã bị phát hiện.
Mục lục
Tổng quan · Dữ liệu · Cấu trúc ·
Phương pháp · Kết quả · Phát hiện quan trọng ·
Notebooks · Bắt đầu · Dashboard ·
Hạn chế · Giấy phép
---
Tổng quan
7 đặc trưng thị giác thủ công × 3 bộ phân loại cổ điển = 21 tổ hợp, so với ResNet18 fine-tune.
Cùng 1 tập test cho mọi model. Chia dữ liệu có kiểm soát rò rỉ xuyên suốt.
Điểm cao nhất: 99,86% accuracy (cả model classical tốt nhất lẫn ResNet18).
Dự án không dừng ở bảng xếp hạng — 99,86% trên dataset lỗi thật là con số đáng nghi:
🔍 Rò rỉ ảnh trùng lặp giữa train/test — phát hiện, sửa, đo lại.
🔍 "Đường tắt" dựa vào độ sáng — phát hiện bằng Grad-CAM, thống kê, stress test.
Dữ liệu
	
Nguồn	Kaggle — Real-life Industrial Dataset of Casting Product (ravirajsinh45)
Xuất xứ	Ảnh thật từ dây chuyền Pilot TechnoCast, Shapar, Rajkot, Ấn Độ
Chi tiết đúc	Cánh bơm chìm (submersible pump impeller)
2 lớp	`def_front` (lỗi) · `ok_front` (đạt)
Số lượng	7.284 ảnh, 300×300 RGB
Chia tập	`def_front`: 3.758 train / 453 test · `ok_front`: 2.811 train / 262 test¹
Loại lỗi	rỗ khí, lỗ kim, ba-via, co ngót, lỗi khuôn/rót kim loại
¹ trước khi dọn dữ liệu rò rỉ — xem Phát hiện quan trọng.
```bash
python src/data/00_download_data.py   # qua kagglehub -> tải về data/raw/
```
Cấu trúc thư mục
Xem sơ đồ đầy đủ ở phần tiếng Anh — giữ nguyên tên thư mục gốc.
Phương pháp
Classical — 7 đặc trưng × 3 bộ phân loại:
Đặc trưng	Ý nghĩa	Số chiều
Raw Pixels	ảnh xám 64×64 làm phẳng (baseline)	4.096
Histogram	phân bố độ sáng, 256 bin	256
Sobel	độ lớn gradient (kernel x/y)	làm phẳng
Canny	bản đồ biên nhị phân	làm phẳng
LBP	histogram texture (P=8, R=1)	10
HOG	9 hướng, ô 16×16	6.084
GLCM	contrast / homogeneity / energy / correlation	5
Bộ phân loại: Logistic Regression · Random Forest (200 cây) · SVM (RBF) — tham số mặc định scikit-learn, trong pipeline `StandardScaler → classifier`.
Deep learning:
ResNet18, pretrained ImageNet, fine-tune toàn bộ trong 10 epoch.
Adam, lr = 1e-4, batch size 32, ảnh vào 224×224.
Augment (chỉ train): `RandomHorizontalFlip` + `RandomRotation(10°)`.
Checkpoint = validation F1 tốt nhất trong 10 epoch.
Cả 2 nhánh: cùng 1 cách chia train/val (seed cố định, 80/20), cùng 1 tập test không đổi.
Kết quả
Top bảng xếp hạng 21 model + ResNet18 (tập test, sau khi đã sửa rò rỉ):
Hạng	Model	Accuracy	F1
1	Histogram + SVM	99,86%	0,9981
1=	ResNet18	**99,86%**¹	0,9985
3	Histogram + Random Forest	99,58%	0,9943
4	HOG + SVM	99,30%	0,9905
5	Raw Pixels + SVM	99,16%	0,9886
6	HOG + Random Forest	98,32%	0,9771
⋯	(tổng 21 tổ hợp)		
19	Canny + SVM	70,35%	
20	Canny + Random Forest	64,90%	
21	Canny + Logistic Regression	59,86%	
¹ Một lần chạy khác ghi 99,72% (`docs/data/models.json`) — do độ bất định bình thường khi train trên GPU, không phải đổi dữ liệu.
📄 Số liệu đầy đủ: `classical_full_test_results.csv` · `model_testing_results.csv`
📊 Bản lọc/sắp xếp được: dashboard trực tuyến
Phát hiện quan trọng
> Accuracy 99,86% trên dataset lỗi thật đáng để nghi ngờ hơn là ăn mừng.
> 2 cuộc điều tra dưới đây đi tìm *lý do* vì sao kết quả tốt đến vậy.
1️⃣ Rò rỉ dữ liệu — 64 ảnh trùng lặp
1 ảnh `ok_front` giống hệt từng byte (khớp MD5) ở cả `train/` và `test/`.
Quét MD5 toàn bộ dataset → 64 ảnh trùng — toàn bộ thuộc `ok_front`, không có `def_front`.
24,4% tập test của `ok_front` đã bị model "nhìn thấy" lúc train.
Cách sửa → chuyển 64 ảnh ra khỏi `train/` (lưu tại `data/leaked_duplicates_removed_from_train/`), train lại cả 22 model từ đầu, đánh giá lại trên đúng tập test cũ.
Kết quả → accuracy gần như không đổi:
Trung bình 21 model classical: -0,49 điểm
Model tụt nhiều nhất: -2,66 điểm
Rò rỉ là có thật, nhưng không phải nguyên nhân chính — sửa lỗi chỉ giúp accuracy được đo trung thực hơn.
2️⃣ "Đường tắt" độ sáng — phát hiện bằng Grad-CAM
Một histogram 256 số, không có thông tin không gian, đạt điểm gần bằng CNN fine-tune — trong bài toán vốn là phát hiện lỗi cục bộ nhỏ — là dấu hiệu bất thường. `07_error_analysis.ipynb` đã tìm ra:
Grad-CAM trên ResNet18 → vùng chú ý khoanh đúng khu vực lỗ trong/vành ở mọi dự đoán "lỗi" tin cậy cao. Tín hiệu thật, không phải học vẹt histogram.
Thống kê theo lớp (n = 7.348, Mann-Whitney U + Welch's t-test) → `def_front` tối hơn ~10-11 mức sáng so với `ok_front`, mật độ biên cao hơn (p ≈ 0).
Stress test: làm phẳng histogram độ sáng (cân bằng kênh LAB) →
Histogram + SVM: 99,86% → 63,4%
ResNet18: 99,86% → 63,8%
Cả 2 giảm ~36 điểm — CNN không bền hơn đáng kể.
UMAP → đặc trưng 512 chiều của ResNet18 tách lớp rõ hơn histogram thô trên 2D — nhưng vẫn phụ thuộc độ sáng y hệt.
> **Kết luận:** ResNet18 học được khái niệm thật, có vị trí cụ thể, về lỗi đúc — nhưng
> không nên mặc định accuracy 99,86% giữ nguyên ở điều kiện ánh sáng khác. Cần train lại
> với augmentation độ sáng/tương phản và chạy lại bài test này trước khi triển khai.
Notebooks
Chạy theo thứ tự — mỗi notebook phụ thuộc kết quả của các notebook trước:
#	Notebook	Nội dung
01	`01_EDA.ipynb`	Cân bằng lớp, kích thước ảnh, xem mẫu
02	`02_check_data_pipeline.ipynb`	Kiểm tra chia train/val + quy tắc augment
03	`03_classical_features.ipynb`	Trực quan hoá từng đặc trưng thủ công
04	`04_classical_ml.ipynb`	Benchmark classical lần đầu
05	`05_deep_learning.ipynb`	Fine-tune ResNet18
06	`06_model_testing.ipynb`	Đánh giá thống kê (CV, khoảng tin cậy)
07	`07_error_analysis.ipynb`	Grad-CAM, thống kê lớp, robustness test, UMAP ⚠️ cần `pip install grad-cam umap-learn`
08	`08_classical_full_benchmark.ipynb`	Đủ 21 tổ hợp, số liệu test cuối cùng
Bắt đầu
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

python src/data/00_download_data.py      # tải dataset -> data/raw/
jupyter notebook notebooks/01_EDA.ipynb   # rồi chạy tiếp 02 -> 08
```
`00_download_data.py` cần tài khoản/API token Kaggle (tài liệu kagglehub).
Trọng số model (`models/classical/*.joblib`, `models/resnet18_casting.pt`) không có trong repo — chạy lại notebook để tái tạo.
Dashboard tương tác
`docs/` là trang tĩnh, sẵn sàng deploy GitHub Pages:
About — kể lại câu chuyện trên, minh hoạ bằng hình thật từ notebook.
Playground — xem dự đoán có sẵn của 22 model trên 715 ảnh test (15.730 dự đoán) — không cần chạy code.
Model Stats — bảng xếp hạng đầy đủ, bảng so sánh trước/sau sửa rò rỉ, biểu đồ UMAP.
```bash
python -m http.server --directory docs   # rồi mở localhost:8000
```
Để public: Settings → Pages → Source: `docs/`
Hạn chế & hướng phát triển
⚠️ Nhạy ánh sáng — accuracy ~99,9% không chắc giữ nguyên ở ánh sáng khác. Nên train lại với augmentation độ sáng/tương phản trước khi triển khai.
⚠️ Chỉ 1 nguồn chụp — toàn bộ ảnh từ 1 nhà máy/dây chuyền; chưa kiểm chứng tổng quát hoá.
ℹ️ Hiện tượng lạ ở góc ảnh (Grad-CAM) — 6/6 dự đoán "OK" tin cậy cao nhất đều có điểm sáng nhỏ ở góc ảnh. Không đổi kết quả, nhưng đáng xem thêm (có thể do đồ gá/ánh sáng).
Công nghệ sử dụng
`Python` `OpenCV` `scikit-image` `scikit-learn` `PyTorch` `torchvision` `pandas` `numpy` `matplotlib` `grad-cam` `umap-learn` `Jupyter` — cùng dashboard tĩnh HTML/CSS/JS trong `docs/`.
Lời cảm ơn
Dataset: ravirajsinh45 / Real-life Industrial Dataset of Casting Product — Pilot TechnoCast, Shapar, Rajkot, Ấn Độ.
Phương pháp phân tích lỗi lấy cảm hứng từ Lee et al., Int. J. Precis. Eng. Manuf. (link), chuyển từ bối cảnh GAN không giám sát sang bộ phân loại có giám sát của dự án này.
Giấy phép
Repo chưa có file `LICENSE` — thêm 1 file (MIT / Apache-2.0) nếu muốn cho phép dùng lại code. Dataset có giấy phép riêng trên Kaggle — kiểm tra trước khi phân phối lại.
