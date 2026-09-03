/* Casting Quality Inspector — shared UI helpers used by both pages.
 * Loaded BEFORE app.js / stats.js.
 *
 * Provides:
 *   - A floating tooltip that measures itself and clamps its position to
 *     the viewport, so it can never overflow off-screen (this replaced an
 *     earlier CSS-only :hover tooltip that could run off the edge).
 *   - A reusable image lightbox / gallery viewer (single image or a
 *     prev/next-able set), used for the record viewer, Grad-CAM images,
 *     and the notebook figure evidence gallery.
 *   - Status-bar hover hints: any element with a data-hint attribute
 *     updates a status-bar segment on hover/focus (classic Windows UX).
 */
window.CQI = (function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Tiny localStorage wrapper - wrapped in try/catch because this is a
     real static site (GitHub Pages), not a sandboxed preview, and the
     lang/theme toggles need to survive navigating between index.html and
     stats.html (two separate page loads). Storage can still legitimately
     be unavailable (private-mode Safari, locked-down browsers), so every
     call is defensive and just falls back to the in-memory default.
     --------------------------------------------------------------------- */

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------------
     Theme (light / dark)
     --------------------------------------------------------------------- */

  var theme = storageGet('cqi:theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);

  function getTheme() { return theme; }

  function setTheme(next) {
    theme = next === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    storageSet('cqi:theme', theme);
    document.querySelectorAll('[data-theme-label]').forEach(function (el) {
      el.textContent = theme === 'dark' ? t('toggle.themeToLight') : t('toggle.themeToDark');
    });
    window.dispatchEvent(new CustomEvent('cqi:themechange', { detail: { theme: theme } }));
  }

  function toggleTheme() { setTheme(theme === 'dark' ? 'light' : 'dark'); }

  /* ---------------------------------------------------------------------
     i18n (English / Vietnamese)

     State is mirrored to localStorage so a toggle made on one page (say,
     switching to dark mode on the Playground) is still in effect after
     navigating to Model Stats - each page still boots from its own fresh
     load, but reads the same saved preference. Every toggle re-applies
     every data-i18n-tagged node in the document and fires an event so
     app.js/stats.js can redraw the bits they generated in JS (tables,
     charts, tooltips).
     --------------------------------------------------------------------- */

  var lang = storageGet('cqi:lang') === 'vi' ? 'vi' : 'en';
  document.documentElement.setAttribute('lang', lang);

  var DICT = {
    en: {
      'nav.playground': '01_PLAYGROUND',
      'nav.stats': '02_MODEL_STATS',
      'nav.source': '03_SOURCE',
      'nav.playground.hint': 'Browse test records and try any of the 22 models.',
      'nav.stats.hint': 'Compare all 22 models and read the write-ups.',
      'nav.source.hint': 'Open the project source on GitHub.',
      'status.online': 'SYSTEM ONLINE',
      'status.modelsLoaded': 'MODELS LOADED',
      'status.testRecords': 'TEST RECORDS',
      'status.playgroundHint': 'Submersible pump impeller casting dataset — test split only.',
      'status.statsHint': '21 classical (7 features × 3 classifiers) + 1 deep learning (ResNet18) — test-set metrics.',
      'toggle.lang': 'TIẾNG VIỆT',
      'toggle.theme': 'Toggle dark mode',
      'toggle.themeToDark': 'DARK',
      'toggle.themeToLight': 'LIGHT',
      'toggle.music': 'Toggle background music',
      'toggle.musicOn': 'MUSIC: ON',
      'toggle.musicOff': 'MUSIC: OFF',
      'recordViewer.title': 'RECORD VIEWER',
      'recordViewer.loading': 'LOADING...',
      'recordViewer.viewerHint': 'Click the image to see it full-size.',
      'recordViewer.prev': '← PREV',
      'recordViewer.prevHint': 'Go to the previous test record. (Left arrow)',
      'recordViewer.next': 'NEXT →',
      'recordViewer.nextHint': 'Go to the next test record. (Right arrow)',
      'recordViewer.random': 'RANDOM',
      'recordViewer.randomHint': 'Jump to a random test record. (R)',
      'recordViewer.jumpHint': 'Type a record number and hit Enter to jump there.',
      'recordViewer.filterLabel': 'FILTER:',
      'recordViewer.filterHint': 'Only browse records with this true label.',
      'recordViewer.filterAll': 'ALL RECORDS',
      'recordViewer.filterDef': 'TRUE LABEL: DEFECTIVE',
      'recordViewer.filterOk': 'TRUE LABEL: OK',
      'recordViewer.caption': 'RECORD {n} / {total} — TRUE LABEL: {label}',
      'selectModel.title': 'SELECT MODEL',
      'selectModel.subtitle': '22 available — hover a row for spec',
      'selectModel.loading': 'LOADING MODEL REGISTRY...',
      'selectModel.typeLabel': 'TYPE:',
      'selectModel.typeHint': 'Filter the model list by type.',
      'selectModel.typeAll': 'ALL (21 CLASSICAL + 1 CNN)',
      'selectModel.typeDl': 'DEEP LEARNING ONLY',
      'selectModel.typeClassical': 'CLASSICAL ML ONLY',
      'inference.title': 'INFERENCE RESULT',
      'inference.modelLabel': 'MODEL:',
      'inference.trueLabel': 'TRUE LABEL',
      'inference.correct': 'CORRECT',
      'inference.wrong': 'WRONG',
      'inference.confidence': 'CONFIDENCE',
      'inference.approx': 'approx. ',
      'inference.nearCertain': 'near-certain',
      'inference.noMatch': 'NO MATCHING RECORD',
      'gradcam.noMatch': 'NO RECORD MATCHES THE CURRENT FILTER.',
      'inference.defective': 'DEFECTIVE',
      'inference.ok': 'OK',
      'tier.confident': 'CONFIDENT',
      'tier.moderate': 'MODERATE',
      'tier.uncertain': 'UNCERTAIN',
      'tier.confidentHint': '90% confidence or higher.',
      'tier.moderateHint': 'Between 70% and 90% confidence.',
      'tier.uncertainHint': '70% confidence or lower.',
      'filter.outcomeLabel': 'OUTCOME:',
      'filter.outcomeHint': 'Only browse records where the selected model was right or wrong.',
      'filter.outcomeAll': 'ANY OUTCOME',
      'filter.outcomeCorrect': 'CORRECT ONLY',
      'filter.outcomeIncorrect': 'MISCLASSIFIED ONLY',
      'filter.confidenceLabel': 'CONFIDENCE:',
      'filter.confidenceHint': 'Only browse records in this confidence tier for the selected model.',
      'filter.confidenceAll': 'ANY CONFIDENCE',
      'filter.confidenceConfident': 'CONFIDENT (≥90%)',
      'filter.confidenceModerate': 'MODERATE (70–90%)',
      'filter.confidenceUncertain': 'UNCERTAIN (≤70%)',
      'filter.matchCount': '{n} record(s) match this filter.',
      'filter.matchCountNone': 'No records match this filter.',
      'gradcam.title': 'GRAD-CAM EXPLANATION',
      'gradcam.loading': 'SELECT A MODEL TO SEE AN EXPLANATION',
      'gradcam.original': 'ORIGINAL',
      'gradcam.gradcam': 'GRAD-CAM',
      'gradcam.howToRead': '(i) HOW TO READ THIS',
      'gradcam.naTitle': 'No Grad-CAM for this model',
      'gradcam.naBody': 'Grad-CAM needs a convolutional network’s feature maps — only ResNet18 has those. The classical models work from a flat feature vector, so there’s no map to overlay.',
      'gradcam.howToReadBody': '<ul><li><strong>Warm</strong> (red/yellow) = pushed toward the predicted verdict (<strong>{verdict}</strong>).</li><li><em>Cool</em> = pushed away from it.</li><li class="muted">Computed against the model’s own predicted class, not a fixed target.</li></ul>',
      'notCalibrated.label': '(i) NOT CALIBRATED',
      'notCalibrated.body': '<p style="margin:0;">This classifier (SVM) isn’t probability-calibrated — the confidence shown is a scaled decision-margin score, not a real probability. See Model Stats for detail.</p>',
      'modelSpec.footer': 'Full breakdown: click this model’s row on the Model Stats page.',
      'advisory.short': 'SYSTEM ADVISORY: every model here leans partly on a brightness shortcut in this dataset.',
      'advisory.details': '(i) DETAILS',
      'advisory.detailsBody': '<ul><li>All 22 models rely partly on a <strong>global brightness shortcut</strong> in this dataset.</li><li>Test accuracy drops from ~99.9% to <strong>~63%</strong> for <em>every</em> model once brightness is equalized.</li><li class="muted">Treat predictions here as valid for this dataset’s capture conditions only.</li></ul><p style="margin:0;"><a href="stats.html#advisory">MODEL_STATS &rarr; full write-up</a></p>',
      'footer.playground2': '715 test images × 22 models = 15,730 precomputed predictions',
      'titlebar.playground': 'Playground',
      'titlebar.stats': 'Model Stats',
      'title.playground': 'Peotran QC — Playground',
      'title.stats': 'Peotran QC — Model Stats',

      'datasetOverview.title': 'DATASET OVERVIEW',
      'datasetOverview.subtitle': 'held-out test split, 715 images',
      'datasetOverview.defective': 'Defective (def_front)',
      'datasetOverview.ok': 'OK (ok_front)',
      'modelComparison.title': 'MODEL COMPARISON',
      'modelComparison.subtitle': 'click a row for the full spec',
      'confusionPanel.title': 'CONFUSION MATRIX',
      'confusionPanel.subtitle': 'computed live from real test-set predictions',
      'confusionPanel.selectHint': 'Pick which model’s confusion matrix to show.',
      'modelComparison.loading': 'LOADING...',
      'col.rank': '#',
      'col.model': 'MODEL',
      'col.type': 'TYPE',
      'col.accuracy': 'ACCURACY',
      'col.precision': 'PRECISION',
      'col.recall': 'RECALL',
      'col.f1': 'F1',
      'col.rocauc': 'ROC AUC',
      'col.gradcam': 'GRAD-CAM',
      'type.cnn': 'CNN',
      'type.ml': 'ML',
      'testAccuracy.title': 'TEST ACCURACY — ALL MODELS, RANKED',
      'featureTable.title': 'CLASSICAL: FEATURE × CLASSIFIER',
      'featureTable.subtitle': 'test F1',
      'col.feature': 'FEATURE',
      'trainingCurve.title': 'RESNET18 TRAINING CURVE',
      'trainingCurve.subtitle': '10 epochs, the real per-epoch numbers',
      'trainingCurve.lossTitle': 'TRAINING LOSS',
      'trainingCurve.accTitle': 'TRAIN ACCURACY vs VALIDATION F1',
      'trainingCurve.lossLegend': 'Train loss',
      'trainingCurve.trainAccLegend': 'Train accuracy',
      'trainingCurve.valF1Legend': 'Validation F1',
      'trainingCurve.note': 'Best checkpoint: epoch <strong>{epoch}</strong>, {f1} validation F1. The dip at epoch 5 is just one noisy validation batch — not overfitting, since F1 snaps straight back at epoch 6.',
      'brightness.title': 'BRIGHTNESS DISTRIBUTION',
      'brightness.subtitle': 'def_front vs ok_front · test set, 715 images · box plot',
      'brightness.note': 'Median brightness: <strong>{def}</strong> for def_front vs <strong>{ok}</strong> for ok_front (0–255 grayscale). See KNOWN LIMITATIONS below for what that means for how much to trust these models.',
      'sourceFigures.title': 'SOURCE FIGURES',
      'sourceFigures.intro': 'All of the charts on this page are drawn straight from the real numbers behind them, not pasted-in screenshots — that keeps them interactive and visually consistent with the rest of the site. One exception: UMAP needs the actual 512-d/256-d feature vectors plus a fresh UMAP run, neither of which the site ships, so that plot is still a real screenshot below (same for the plain sample photos and the edge/HOG illustrations, which were never charts to begin with). For the exact matplotlib output as it rendered in notebooks 01–09 — as evidence, not a redraw — open the gallery.',
      'sourceFigures.btn': 'VIEW 11 SOURCE FIGURES',
      'sourceFigures.btnHint': 'Open the 11 original notebook screenshots in a viewer.',
      'evidence.label': 'From the notebooks:',
      'advisoryLog.title': 'KNOWN LIMITATIONS & ADVISORY LOG',
      'advisoryLog.subtitle': 'hover (i) for the full write-up',
      'advisoryLog.fullWriteup': '(i) FULL WRITE-UP',
      'advisory.brightness.title': 'BRIGHTNESS CONFOUND (ALL MODELS)',
      'advisory.brightness.short': 'def_front images run about 10–11 intensity levels darker; accuracy collapses to ~63% once brightness is equalized.',
      'advisory.brightness.full': '<p><strong>def_front images run ~10–11 intensity levels darker</strong> than ok_front on average (p ≈ 0, n = 7,348) — <em>most likely a lighting/photography artifact</em>, not the defects themselves.</p><ul><li>Flattening brightness (LAB equalization) tanks accuracy for <em>both</em> model types:</li></ul><table class="data-table"><thead><tr><th>MODEL</th><th>ORIGINAL</th><th>EQUALIZED</th><th>DROP</th></tr></thead><tbody><tr><td>Histogram + SVM</td><td>99.86%</td><td>63.36%</td><td>&minus;36.50 pts</td></tr><tr><td>ResNet18</td><td>99.86%</td><td>63.78%</td><td>&minus;36.08 pts</td></tr></tbody></table><ul><li>Grad-CAM and UMAP both suggest ResNet18 isn’t <em>purely</em> a brightness detector — but it still leans on the confound about as much as the classical model does.</li><li><strong>None of the 22 models’ ~99.9% accuracy should be assumed to carry over</strong> to different lighting or exposure.</li><li class="muted">Not fixed in v1 — brightness/contrast augmentation is the obvious next step.</li></ul>',
      'advisory.rawpixels.title': 'RAW PIXELS: 64×64, NOT 224×224',
      'advisory.rawpixels.short': 'Downsized to dodge a scikit-learn float64 conversion that was crashing the training machine.',
      'advisory.rawpixels.full': '<p><strong>64×64 instead of 224×224 — a memory fix, not a shortcut.</strong></p><ul><li>Every other feature uses the full 224×224 image; Raw Pixels alone is downsized.</li><li>scikit-learn’s LogisticRegression/SVC force an internal float64 copy — at 50,176 dims that’s ~2.5 GB in one allocation, plenty to crash the training machine.</li><li>64×64 (4,096 dims) keeps the “no feature engineering” point of this baseline while staying safe on ordinary hardware.</li></ul>',
      'advisory.effnet.title': 'WHY NO EFFICIENTNET-B0',
      'advisory.effnet.short': 'Crashed Peotran’s machine and made Peotran sad — ResNet18 already had a finalized checkpoint.',
      'advisory.effnet.full': '<p><strong>Crashed Peotran’s machine <span class="frown">:(</span> — and made Peotran sad.</strong></p><ul><li>Fewer parameters than ResNet18 on paper, but its MBConv blocks need more activation memory mid-training.</li><li>That blew past the available RAM on Peotran’s machine every single time.</li><li>ResNet18 already had a finalized, tested checkpoint, so EfficientNet-B0 wasn’t chased any further.</li><li class="muted">Worth revisiting on a beefier machine — Peotran would be happy again <span class="frown">:)</span>.</li></ul>',
      'footer.stats1': 'PEOTRAN_QC.EXE v1.0 — all metrics computed on the held-out test set (715 images)',
      'footer.stats.back': '← BACK TO PLAYGROUND',

      'modal.overview': 'OVERVIEW',
      'modal.parameters': 'PARAMETERS',
      'modal.confusion': 'CONFUSION MATRIX (LIVE, TEST SET)',
      'modal.close': 'CLOSE',
      'field.modelId': 'Model ID',
      'field.type': 'Type',
      'field.typeDl': 'Deep learning (CNN)',
      'field.typeClassical': 'Classical ML',
      'field.feature': 'Feature',
      'field.featureDesc': 'Feature description',
      'field.classifier': 'Classifier',
      'field.architecture': 'Architecture',
      'field.testAcc': 'Test accuracy',
      'field.testPrec': 'Test precision',
      'field.testRecall': 'Test recall',
      'field.testF1': 'Test F1',
      'field.testRocAuc': 'Test ROC AUC',
      'field.gradcamSupport': 'Grad-CAM support',
      'field.confCalibrated': 'Confidence calibrated',
      'field.weightsFile': 'Weights file',
      'field.yes': 'Yes',
      'field.no': 'No',
      'field.noMargin': 'No (decision-margin based)',
      'cg.predDef': 'PRED. DEF.',
      'cg.predOk': 'PRED. OK',
      'cg.actDef': 'ACT. DEF.',
      'cg.actOk': 'ACT. OK',
      'cg.note': 'Computed live from this model’s {n} test-set predictions.',
      'cg.empty': 'No prediction data for this model.',

      'fig.classDist': 'Class distribution',
      'fig.sampleDef': 'Sample defective parts',
      'fig.sampleOk': 'Sample OK parts',
      'fig.sobel': 'Sobel edge detection',
      'fig.hog': 'HOG visualization',
      'fig.featureCompare': 'Feature × classifier comparison',
      'fig.confusionSvm': 'Confusion matrix — Histogram+SVM',
      'fig.resnetTraining': 'ResNet18 training curves',
      'fig.unifiedCompare': 'Test accuracy, 95% bootstrap CI',
      'fig.brightnessBox': 'Brightness confound (box plots)',
      'fig.umap': 'UMAP: histogram vs. ResNet18 features',
      'tooltip.pinnedHint': 'PINNED — CLICK THE BUTTON OR PRESS ESC TO CLOSE',
    },
    vi: {
      'nav.playground': '01_SÂN_THử',
      'nav.stats': '02_THỐNG_KÊ_MODEL',
      'nav.source': '03_MÃ_NGUỒN',
      'nav.playground.hint': 'Duyệt qua ảnh test và thử bất kỳ model nào trong 22 model.',
      'nav.stats.hint': 'So sánh cả 22 model và đọc phần phân tích.',
      'nav.source.hint': 'Mở mã nguồn dự án trên GitHub.',
      'status.online': 'HỆ THỐNG HOẠT ĐỘNG',
      'status.modelsLoaded': 'SỐ MODEL',
      'status.testRecords': 'SỐ ẢNH TEST',
      'status.playgroundHint': 'Bộ dữ liệu ảnh đúc impeller bơm chìm — chỉ dùng phần test.',
      'status.statsHint': '21 model classical (7 feature × 3 classifier) + 1 deep learning (ResNet18) — số liệu trên tập test.',
      'toggle.lang': 'ENGLISH',
      'toggle.theme': 'Bật/tắt chế độ tối',
      // Deliberately left in English in both languages, per user request -
      // the LIGHT/DARK button label stays "LIGHT"/"DARK" either way.
      'toggle.themeToDark': 'DARK',
      'toggle.themeToLight': 'LIGHT',
      'toggle.music': 'Bật/tắt nhạc nền',
      'toggle.musicOn': 'NHẠC: BẬT',
      'toggle.musicOff': 'NHẠC: TẮT',
      'recordViewer.title': 'XEM ẢNH TEST',
      'recordViewer.loading': 'ĐANG TẢI...',
      'recordViewer.viewerHint': 'Bấm vào ảnh để xem cỡ to.',
      'recordViewer.prev': '← TRƯỚC',
      'recordViewer.prevHint': 'Ảnh test trước đó. (Phím ←)',
      'recordViewer.next': 'TIẾP →',
      'recordViewer.nextHint': 'Ảnh test tiếp theo. (Phím →)',
      'recordViewer.random': 'NGẪU NHIÊN',
      'recordViewer.randomHint': 'Nhảy đến một ảnh test bất kỳ. (Phím R)',
      'recordViewer.jumpHint': 'Gõ số thứ tự ảnh rồi nhấn Enter để nhảy tới.',
      'recordViewer.filterLabel': 'LỌC:',
      'recordViewer.filterHint': 'Chỉ duyệt ảnh có nhãn thật này.',
      'recordViewer.filterAll': 'TẤT CẢ ẢNH',
      'recordViewer.filterDef': 'NHÃN THẬT: LỖI',
      'recordViewer.filterOk': 'NHÃN THẬT: OK',
      'recordViewer.caption': 'ẢNH {n} / {total} — NHÃN THẬT: {label}',
      'selectModel.title': 'CHỌN MODEL',
      'selectModel.subtitle': '22 model — rê chuột vào một dòng để xem thông số',
      'selectModel.loading': 'ĐANG TẢI DANH SÁCH MODEL...',
      'selectModel.typeLabel': 'LOẠI:',
      'selectModel.typeHint': 'Lọc danh sách model theo loại.',
      'selectModel.typeAll': 'TẤT CẢ (21 CLASSICAL + 1 CNN)',
      'selectModel.typeDl': 'CHỈ DEEP LEARNING',
      'selectModel.typeClassical': 'CHỈ CLASSICAL ML',
      'inference.title': 'KẾT QUẢ DỰ ĐOÁN',
      'inference.modelLabel': 'MODEL:',
      'inference.trueLabel': 'NHÃN THẬT',
      'inference.correct': 'ĐÚNG',
      'inference.wrong': 'SAI',
      'inference.confidence': 'ĐỘ TIN CẬY',
      'inference.approx': 'xấp xỉ ',
      'inference.nearCertain': 'gần như tuyệt đối',
      'inference.noMatch': 'KHÔNG CÓ ẢNH PHÙ HỢP',
      'gradcam.noMatch': 'KHÔNG CÓ ẢNH NÀO THỎA MÃN BỘ LỌC HIỆN TẠI.',
      'inference.defective': 'LỖI',
      'inference.ok': 'OK',
      'tier.confident': 'TỰ TIN',
      'tier.moderate': 'TƯƠNG ĐỐI',
      'tier.uncertain': 'KHÔNG CHẮC',
      'tier.confidentHint': 'Độ tin cậy từ 90% trở lên.',
      'tier.moderateHint': 'Độ tin cậy trong khoảng 70–90%.',
      'tier.uncertainHint': 'Độ tin cậy từ 70% trở xuống.',
      'filter.outcomeLabel': 'KẾT QUẢ:',
      'filter.outcomeHint': 'Chỉ duyệt ảnh mà model đang chọn đoán đúng hoặc đoán sai.',
      'filter.outcomeAll': 'MỌI KẾT QUẢ',
      'filter.outcomeCorrect': 'CHỈ ĐOÁN ĐÚNG',
      'filter.outcomeIncorrect': 'CHỈ ĐOÁN SAI',
      'filter.confidenceLabel': 'ĐỘ TIN CẬY:',
      'filter.confidenceHint': 'Chỉ duyệt ảnh ở mức độ tin cậy này với model đang chọn.',
      'filter.confidenceAll': 'MỌI MỨC',
      'filter.confidenceConfident': 'TỰ TIN (≥90%)',
      'filter.confidenceModerate': 'TƯƠNG ĐỐI (70–90%)',
      'filter.confidenceUncertain': 'KHÔNG CHẮC (≤70%)',
      'filter.matchCount': 'Có {n} ảnh thỏa mãn bộ lọc này.',
      'filter.matchCountNone': 'Không có ảnh nào thỏa mãn bộ lọc này.',
      'gradcam.title': 'GIẢI THÍCH GRAD-CAM',
      'gradcam.loading': 'CHỌN MỘT MODEL ĐỂ XEM GIẢI THÍCH',
      'gradcam.original': 'ẢNH GỐC',
      'gradcam.gradcam': 'GRAD-CAM',
      'gradcam.howToRead': '(i) CÁCH ĐỌC BIỂU ĐỒ NÀY',
      'gradcam.naTitle': 'Model này không có Grad-CAM',
      'gradcam.naBody': 'Grad-CAM cần feature map của một mạng tích chập (CNN) — chỉ ResNet18 có cái đó. Các model classical dùng vector đặc trưng phẳng nên không có map nào để chồng lên ảnh cả.',
      'gradcam.howToReadBody': '<ul><li><strong>Vùng ấm</strong> (đỏ/vàng) = đẩy về phía kết quả dự đoán (<strong>{verdict}</strong>).</li><li><em>Vùng lạnh</em> = đẩy ngược lại kết quả đó.</li><li class="muted">Tính theo đúng lớp mà model dự đoán, không phải một mục tiêu cố định.</li></ul>',
      'notCalibrated.label': '(i) CHƯA HIỆU CHỈNH',
      'notCalibrated.body': '<p style="margin:0;">Classifier này (SVM) chưa được hiệu chỉnh xác suất — con số hiển thị là decision-margin đã co giãn, không phải xác suất thật. Xem thêm ở trang Thống kê Model.</p>',
      'modelSpec.footer': 'Xem đầy đủ: bấm vào dòng của model này ở trang Thống kê Model.',
      'advisory.short': 'CẢNH BÁO HỆ THỐNG: model nào trong số này cũng dựa một phần vào độ sáng ảnh như một đường tắt.',
      'advisory.details': '(i) CHI TIẾT',
      'advisory.detailsBody': '<ul><li>Cả 22 model đều dựa một phần vào <strong>độ sáng tổng thể</strong> của bộ dữ liệu này như một đường tắt.</li><li>Độ chính xác test tụt từ ~99.9% xuống còn <strong>~63%</strong> ở <em>mọi</em> model khi cân bằng độ sáng.</li><li class="muted">Chỉ nên tin các dự đoán này trong đúng điều kiện chụp ảnh của bộ dữ liệu này.</li></ul><p style="margin:0;"><a href="stats.html#advisory">THỐNG_KÊ_MODEL &rarr; xem chi tiết</a></p>',
      'footer.playground2': '715 ảnh test × 22 model = 15.730 dự đoán tính sẵn',
      'titlebar.playground': 'Sân thử',
      'titlebar.stats': 'Thống kê Model',
      'title.playground': 'Peotran QC — Sân thử',
      'title.stats': 'Peotran QC — Thống kê Model',

      'datasetOverview.title': 'TỔNG QUAN DỮ LIỆU',
      'datasetOverview.subtitle': 'phần test tách riêng, 715 ảnh',
      'datasetOverview.defective': 'Lỗi (def_front)',
      'datasetOverview.ok': 'OK (ok_front)',
      'modelComparison.title': 'SO SÁNH MODEL',
      'modelComparison.subtitle': 'bấm vào một dòng để xem chi tiết',
      'confusionPanel.title': 'MA TRẬN NHẦM LẪN',
      'confusionPanel.subtitle': 'tính trực tiếp từ dự đoán thật trên tập test',
      'confusionPanel.selectHint': 'Chọn model muốn xem ma trận nhầm lẫn.',
      'modelComparison.loading': 'ĐANG TẢI...',
      'col.rank': '#',
      'col.model': 'MODEL',
      'col.type': 'LOẠI',
      'col.accuracy': 'ĐỘ CHÍNH XÁC',
      'col.precision': 'PRECISION',
      'col.recall': 'RECALL',
      'col.f1': 'F1',
      'col.rocauc': 'ROC AUC',
      'col.gradcam': 'GRAD-CAM',
      'type.cnn': 'CNN',
      'type.ml': 'ML',
      'testAccuracy.title': 'ĐỘ CHÍNH XÁC TEST — XẾP HẠNG TẤT CẢ MODEL',
      'featureTable.title': 'CLASSICAL: FEATURE × CLASSIFIER',
      'featureTable.subtitle': 'F1 trên tập test',
      'col.feature': 'FEATURE',
      'trainingCurve.title': 'ĐƯỜNG CONG HUẤN LUYỆN RESNET18',
      'trainingCurve.subtitle': '10 epoch, số liệu thật từng epoch',
      'trainingCurve.lossTitle': 'TRAINING LOSS',
      'trainingCurve.accTitle': 'TRAIN ACCURACY vs VALIDATION F1',
      'trainingCurve.lossLegend': 'Loss lúc train',
      'trainingCurve.trainAccLegend': 'Độ chính xác lúc train',
      'trainingCurve.valF1Legend': 'F1 trên tập validation',
      'trainingCurve.note': 'Checkpoint tốt nhất: epoch <strong>{epoch}</strong>, F1 validation {f1}. Cái "dụt" ở epoch 5 chỉ là một batch validation bị nhiễu — không phải overfitting, vì F1 hồi phục ngay ở epoch 6.',
      'brightness.title': 'PHÂN BỐ ĐỘ SÁNG',
      'brightness.subtitle': 'def_front vs ok_front · tập test, 715 ảnh · box plot',
      'brightness.note': 'Độ sáng trung vị: <strong>{def}</strong> ở def_front so với <strong>{ok}</strong> ở ok_front (thang xám 0–255). Xem mục GIỚI HẠN ĐÃ BIẾT bên dưới để hiểu điều này ảnh hưởng thế nào đến độ tin cậy của các model.',
      'sourceFigures.title': 'ẢNH GỐC TỪ NOTEBOOK',
      'sourceFigures.intro': 'Mọi biểu đồ trên trang này đều được vẽ trực tiếp từ số liệu thật, không phải ảnh chụp dán vào — nhờ vậy chúng tương tác được và đồng bộ phong cách với phần còn lại của trang. Có một ngoại lệ: UMAP cần vector đặc trưng 512 chiều/256 chiều thật và phải chạy lại thuật toán UMAP, hai thứ mà trang web không có sẵn, nên biểu đồ đó vẫn là ảnh chụp thật bên dưới (giống như ảnh mẫu và ảnh minh họa edge/HOG, vốn không phải biểu đồ ngay từ đầu). Muốn xem đúng kết quả matplotlib như khi chạy trong notebook 01–09 — làm bằng chứng, không phải vẽ lại — thì mở gallery bên dưới.',
      'sourceFigures.btn': 'XEM 11 ẢNH GỐC',
      'sourceFigures.btnHint': 'Mở 11 ảnh chụp gốc từ notebook.',
      'evidence.label': 'Từ notebook:',
      'advisoryLog.title': 'GIỚI HẠN ĐÃ BIẾT & NHẬT KÝ CẢNH BÁO',
      'advisoryLog.subtitle': 'rê chuột vào (i) để xem chi tiết',
      'advisoryLog.fullWriteup': '(i) XEM CHI TIẾT',
      'advisory.brightness.title': 'ĐỘ SÁNG GÂY NHIỄU (TẤT CẢ MODEL)',
      'advisory.brightness.short': 'Ảnh def_front tối hơn khoảng 10–11 mức sáng; độ chính xác tụt xuống còn ~63% khi cân bằng độ sáng.',
      'advisory.brightness.full': '<p><strong>Ảnh def_front tối hơn ok_front trung bình ~10–11 mức sáng</strong> (p ≈ 0, n = 7.348) — <em>nhiều khả năng là do ánh sáng/cách chụp</em>, không phải do bản thân lỗi sản phẩm.</p><ul><li>Cân bằng độ sáng (LAB equalization) làm độ chính xác tụt mạnh ở <em>cả hai</em> loại model:</li></ul><table class="data-table"><thead><tr><th>MODEL</th><th>GỐC</th><th>ĐÃ CÂN BẰNG</th><th>MỨC TỤT</th></tr></thead><tbody><tr><td>Histogram + SVM</td><td>99.86%</td><td>63.36%</td><td>&minus;36.50 điểm</td></tr><tr><td>ResNet18</td><td>99.86%</td><td>63.78%</td><td>&minus;36.08 điểm</td></tr></tbody></table><ul><li>Grad-CAM và UMAP đều cho thấy ResNet18 không <em>chỉ</em> dựa vào độ sáng để đoán — nhưng nó vẫn dựa vào yếu tố nhiễu này gần bằng model classical.</li><li><strong>Không nên mặc định độ chính xác ~99.9% của cả 22 model</strong> sẽ giữ nguyên khi đổi điều kiện ánh sáng/phơi sáng.</li><li class="muted">Chưa khắc phục ở bản v1 — bước tiếp theo hợp lý là augment độ sáng/tương phản lúc train.</li></ul>',
      'advisory.rawpixels.title': 'RAW PIXELS: 64×64, KHÔNG PHẢI 224×224',
      'advisory.rawpixels.short': 'Giảm kích thước để tránh lỗi chuyển float64 của scikit-learn từng làm sập máy huấn luyện.',
      'advisory.rawpixels.full': '<p><strong>64×64 thay vì 224×224 — là để tránh tràn bộ nhớ, không phải để đi tắt.</strong></p><ul><li>Mọi feature khác đều dùng ảnh 224×224 đầy đủ; chỉ riêng Raw Pixels bị giảm kích thước.</li><li>LogisticRegression/SVC của scikit-learn bắt buộc phải copy sang float64 nội bộ — ở 50.176 chiều thì một lần cấp phát đã tốn ~2,5 GB, đủ để làm sập máy huấn luyện.</li><li>64×64 (4.096 chiều) vẫn giữ đúng tinh thần "không feature engineering" của baseline này mà không làm sập máy thường.</li></ul>',
      'advisory.effnet.title': 'VÌ SAO KHÔNG DÙNG EFFICIENTNET-B0',
      'advisory.effnet.short': 'Làm sập máy của Peotran và khiến Peotran buồn — ResNet18 thì đã có checkpoint hoàn chỉnh rồi.',
      'advisory.effnet.full': '<p><strong>Làm sập máy của Peotran <span class="frown">:(</span> — và khiến Peotran buồn.</strong></p><ul><li>Trên giấy tờ thì ít tham số hơn ResNet18, nhưng khối MBConv của nó cần nhiều bộ nhớ activation hơn lúc train.</li><li>Lần nào chạy cũng vượt quá RAM có sẵn trên máy của Peotran.</li><li>ResNet18 thì đã có checkpoint hoàn chỉnh, đã test xong, nên không theo đuổi EfficientNet-B0 thêm nữa.</li><li class="muted">Đáng thử lại nếu có máy khỏe hơn — lúc đó Peotran sẽ vui trở lại <span class="frown">:)</span>.</li></ul>',
      'footer.stats1': 'PEOTRAN_QC.EXE v1.0 — mọi chỉ số tính trên tập test tách riêng (715 ảnh)',
      'footer.stats.back': '← QUAY LẠI SÂN THỬ',

      'modal.overview': 'TỔNG QUAN',
      'modal.parameters': 'THAM SỐ',
      'modal.confusion': 'CONFUSION MATRIX (TÍNH TRỰC TIẾP, TẬP TEST)',
      'modal.close': 'ĐÓNG',
      'field.modelId': 'Model ID',
      'field.type': 'Loại',
      'field.typeDl': 'Deep learning (CNN)',
      'field.typeClassical': 'Classical ML',
      'field.feature': 'Feature',
      'field.featureDesc': 'Mô tả feature',
      'field.classifier': 'Classifier',
      'field.architecture': 'Kiến trúc',
      'field.testAcc': 'Độ chính xác (test)',
      'field.testPrec': 'Precision (test)',
      'field.testRecall': 'Recall (test)',
      'field.testF1': 'F1 (test)',
      'field.testRocAuc': 'ROC AUC (test)',
      'field.gradcamSupport': 'Hỗ trợ Grad-CAM',
      'field.confCalibrated': 'Độ tin cậy đã hiệu chỉnh',
      'field.weightsFile': 'File weights',
      'field.yes': 'Có',
      'field.no': 'Không',
      'field.noMargin': 'Không (dựa theo decision margin)',
      'cg.predDef': 'DỰ ĐOÁN: LỖI',
      'cg.predOk': 'DỰ ĐOÁN: OK',
      'cg.actDef': 'THẬT: LỖI',
      'cg.actOk': 'THẬT: OK',
      'cg.note': 'Tính trực tiếp từ {n} dự đoán trên tập test của model này.',
      'cg.empty': 'Model này chưa có dữ liệu dự đoán.',

      'fig.classDist': 'Phân bố lớp',
      'fig.sampleDef': 'Ảnh mẫu sản phẩm lỗi',
      'fig.sampleOk': 'Ảnh mẫu sản phẩm OK',
      'fig.sobel': 'Dò cạnh Sobel',
      'fig.hog': 'Minh họa HOG',
      'fig.featureCompare': 'So sánh feature × classifier',
      'fig.confusionSvm': 'Confusion matrix — Histogram+SVM',
      'fig.resnetTraining': 'Đường cong huấn luyện ResNet18',
      'fig.unifiedCompare': 'Độ chính xác test, khoảng tin cậy bootstrap 95%',
      'fig.brightnessBox': 'Độ sáng gây nhiễu (box plot)',
      'fig.umap': 'UMAP: feature histogram vs. ResNet18',
      'tooltip.pinnedHint': 'ĐÃ GHIM — BẤM NÚT HOẶC NHẤN ESC ĐỂ ĐÓNG',
    },
  };

  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace('{' + k + '}', vars[k]);
      });
    }
    return s;
  }

  function getLang() { return lang; }

  function setLang(next) {
    lang = next === 'vi' ? 'vi' : 'en';
    document.documentElement.setAttribute('lang', lang);
    storageSet('cqi:lang', lang);
    document.querySelectorAll('[data-lang-label]').forEach(function (el) {
      el.textContent = t('toggle.lang');
    });
    applyTranslations(document);
    if (tipEl) hideTooltip();
    window.dispatchEvent(new CustomEvent('cqi:langchange', { detail: { lang: lang } }));
  }

  function toggleLang() { setLang(lang === 'vi' ? 'en' : 'vi'); }

  function applyTranslations(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    (root || document).querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    (root || document).querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    (root || document).querySelectorAll('[data-i18n-hint]').forEach(function (el) {
      el.setAttribute('data-hint', t(el.getAttribute('data-i18n-hint')));
    });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
  }

  /* ---------------------------------------------------------------------
     Floating tooltip
     --------------------------------------------------------------------- */

  var tipEl = null;
  var hideTimer = null;
  var pinned = false;      // true once the trigger has been clicked - stays open
  var overTip = false;     // true while the pointer is over the floating panel itself
  var overTrigger = false; // true while the pointer is over the trigger button

  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip-panel';
      document.body.appendChild(tipEl);
      // Hovering the panel itself (to reach a link/button inside it) must
      // NOT close it - only cancel any pending close while the pointer is
      // still somewhere over the trigger-or-panel pair.
      tipEl.addEventListener('mouseenter', function () { overTip = true; cancelHide(); });
      tipEl.addEventListener('mouseleave', function () { overTip = false; maybeScheduleHide(); });
    }
    return tipEl;
  }

  function cancelHide() {
    if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
  }

  function maybeScheduleHide() {
    cancelHide();
    if (pinned) return;
    hideTimer = window.setTimeout(function () {
      if (!overTip && !overTrigger && !pinned) hideTooltip();
    }, 200);
  }

  function showTooltip(html, anchorEl) {
    var tip = ensureTip();
    cancelHide();
    tip.innerHTML = html;
    tip.style.left = '0px';
    tip.style.top = '0px';

    var margin = 10;
    // `zoom` (used to enlarge Vietnamese text - see style.css) rescales
    // this element's own local coordinate system, but window.innerWidth/
    // innerHeight and getBoundingClientRect() always report true,
    // un-rescaled viewport pixels. offsetWidth/offsetHeight follow the
    // *local* (zoomed) space instead, so comparing them against
    // window.innerWidth/innerHeight - as this used to - silently
    // under-measured the panel by the zoom factor and let it run off the
    // bottom/right edge of the screen in Vietnamese mode. Everything below
    // is computed in true viewport pixels (via getBoundingClientRect for
    // BOTH the anchor and the tooltip itself) and only converted back to
    // local pixels at the very end, right before assignment to .style.
    var zoomFactor = parseFloat(getComputedStyle(document.body).zoom) || 1;

    var maxW = Math.min(380, window.innerWidth - margin * 2);
    tip.style.maxWidth = (maxW / zoomFactor) + 'px';

    var r = anchorEl.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var w = tipRect.width;
    var h = tipRect.height;

    var left = r.right + margin;
    if (left + w > window.innerWidth - margin) left = r.left - w - margin;
    if (left < margin) left = Math.max(margin, Math.min(r.left, window.innerWidth - w - margin));

    var top = r.top;
    if (top + h > window.innerHeight - margin) top = window.innerHeight - h - margin;
    if (top < margin) top = margin;

    tip.style.left = (left / zoomFactor) + 'px';
    tip.style.top = (top / zoomFactor) + 'px';
    tip.classList.add('visible');
  }

  function hideTooltip() {
    cancelHide();
    pinned = false;
    overTip = false;
    overTrigger = false;
    if (tipEl) { tipEl.classList.remove('visible'); tipEl.classList.remove('pinned'); }
  }

  /* Wires every .tooltip-wrap present in `root`: its .tooltip-panel child
     supplies the HTML content once, then is detached from the flow (its
     content only ever renders inside the single shared floating element
     from then on, so it can never be clipped by a scrolling ancestor or
     run off the edge of the screen again). Safe to call repeatedly - each
     wrap is wired only once via a data attribute guard.

     Two independent ways to keep a tooltip open long enough to click
     something inside it:
       1. Move the mouse from the trigger into the panel itself - the panel
          cancels the close timer as long as the pointer stays over it.
       2. Click the trigger to PIN the tooltip open - it then stays open
          (and gets a small pinned-state highlight) until the trigger is
          clicked again, Escape is pressed, or the user clicks elsewhere. */
  function wireStaticTooltips(root) {
    (root || document).querySelectorAll('.tooltip-wrap').forEach(function (wrap) {
      if (wrap.dataset.tooltipWired) return;
      // Three content sources, checked in order: a data-tooltip-html
      // attribute (already-rendered HTML, for content built in JS that
      // needed interpolation - e.g. the Grad-CAM verdict word - and gets
      // rebuilt fresh by its caller on every language switch anyway); a
      // data-tooltip-i18n dictionary key (resolved through t() fresh on
      // every open, so it tracks language switches on its own); or a plain
      // .tooltip-panel child with fixed HTML (detached once) for content
      // that doesn't need translating.
      var fixedHtml = wrap.getAttribute('data-tooltip-html');
      var i18nKey = wrap.getAttribute('data-tooltip-i18n');
      var panel = wrap.querySelector('.tooltip-panel');
      if (!fixedHtml && !i18nKey && !panel) return;
      var trigger = wrap.querySelector('.info-btn') || wrap;
      wrap.dataset.tooltipWired = '1';
      var staticHtml = null;
      if (panel) {
        staticHtml = panel.innerHTML;
        panel.parentNode.removeChild(panel);
      }

      function openFromTrigger() {
        overTrigger = true;
        showTooltip(fixedHtml || (i18nKey ? t(i18nKey) : staticHtml), trigger);
      }

      trigger.addEventListener('mouseenter', openFromTrigger);
      trigger.addEventListener('mouseleave', function () {
        overTrigger = false;
        maybeScheduleHide();
      });
      trigger.addEventListener('focus', openFromTrigger);
      trigger.addEventListener('blur', function () {
        overTrigger = false;
        maybeScheduleHide();
      });
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (pinned && tipEl && tipEl.classList.contains('visible')) {
          hideTooltip();
          return;
        }
        pinned = true;
        openFromTrigger();
        if (tipEl) {
          tipEl.classList.add('pinned');
          tipEl.setAttribute('data-pinned-label', t('tooltip.pinnedHint'));
        }
      });
    });

    // Click anywhere outside an open pinned tooltip (and outside its
    // trigger) closes it; Escape does too.
    if (!wireStaticTooltips._globalWired) {
      wireStaticTooltips._globalWired = true;
      document.addEventListener('click', function (e) {
        if (!pinned || !tipEl) return;
        if (tipEl.contains(e.target)) return;
        if (e.target.closest && e.target.closest('.tooltip-wrap')) return;
        hideTooltip();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && pinned) hideTooltip();
      });
    }
  }

  /* ---------------------------------------------------------------------
     Lightbox / image gallery
     --------------------------------------------------------------------- */

  var lightbox = null;

  function ensureLightbox() {
    if (lightbox) return lightbox;

    var backdrop = document.createElement('div');
    backdrop.className = 'lightbox-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML =
      '<div class="lightbox-box">' +
        '<div class="panel-title">' +
          '<span class="lb-title">FIGURE</span>' +
          '<span class="lb-controls">' +
            '<button type="button" class="btn small lb-prev">&#8592; PREV</button>' +
            '<span class="lb-counter mono-num"></span>' +
            '<button type="button" class="btn small lb-next">NEXT &#8594;</button>' +
            '<button type="button" class="btn small lb-close">CLOSE</button>' +
          '</span>' +
        '</div>' +
        '<div class="lightbox-body">' +
          '<img class="lb-img" src="" alt="">' +
          '<div class="figure-source lb-source"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(backdrop);

    var state = { items: [], index: 0 };

    function render() {
      var item = state.items[state.index];
      if (!item) return;
      backdrop.querySelector('.lb-title').textContent = (item.caption || 'FIGURE').toUpperCase();
      backdrop.querySelector('.lb-img').src = item.src;
      backdrop.querySelector('.lb-img').alt = item.caption || '';
      backdrop.querySelector('.lb-source').textContent = item.source ? ('Source: ' + item.source) : '';
      var multi = state.items.length > 1;
      backdrop.querySelector('.lb-counter').textContent = multi ? (state.index + 1) + ' / ' + state.items.length : '';
      backdrop.querySelector('.lb-prev').style.visibility = multi ? 'visible' : 'hidden';
      backdrop.querySelector('.lb-next').style.visibility = multi ? 'visible' : 'hidden';
    }

    function open(items, startIndex) {
      state.items = items;
      state.index = startIndex || 0;
      render();
      backdrop.hidden = false;
      requestAnimationFrame(function () { backdrop.classList.add('show'); });
    }

    function close() {
      backdrop.classList.remove('show');
      window.setTimeout(function () { backdrop.hidden = true; }, 160);
    }

    backdrop.querySelector('.lb-prev').addEventListener('click', function () {
      state.index = (state.index - 1 + state.items.length) % state.items.length;
      render();
    });
    backdrop.querySelector('.lb-next').addEventListener('click', function () {
      state.index = (state.index + 1) % state.items.length;
      render();
    });
    backdrop.querySelector('.lb-close').addEventListener('click', close);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function (e) {
      if (backdrop.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') backdrop.querySelector('.lb-prev').click();
      if (e.key === 'ArrowRight') backdrop.querySelector('.lb-next').click();
    });

    lightbox = { open: open, close: close };
    return lightbox;
  }

  function openLightbox(items, startIndex) {
    ensureLightbox().open(items, startIndex);
  }

  /* ---------------------------------------------------------------------
     Native SVG line chart (used for the ResNet18 training curve).
     Draws directly from real per-epoch numbers - no screenshot involved.
     opts: { width, height, xLabels: [], series: [{label,color,values}],
             yMin, yMax, yTickFormat(v) }
     --------------------------------------------------------------------- */

  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function drawLineChart(container, opts) {
    if (!container) return;
    var W = opts.width || 420, H = opts.height || 220;
    var padL = 42, padR = 14, padT = 14, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var xLabels = opts.xLabels || [];
    var series = opts.series || [];
    var allVals = series.reduce(function (acc, s) { return acc.concat(s.values); }, []);
    var yMin = opts.yMin != null ? opts.yMin : Math.min.apply(null, allVals);
    var yMax = opts.yMax != null ? opts.yMax : Math.max.apply(null, allVals);
    if (yMax === yMin) { yMax += 1; yMin -= 1; }
    var span = yMax - yMin;
    var pad = span * 0.08;
    yMin -= pad; yMax += pad;
    span = yMax - yMin;

    var n = xLabels.length || (series[0] ? series[0].values.length : 1);
    function xPos(i) { return padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1)); }
    function yPos(v) { return padT + plotH - ((v - yMin) / span) * plotH; }
    var fmt = opts.yTickFormat || function (v) { return v.toFixed(2); };

    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'native-chart', role: 'img', 'aria-label': opts.ariaLabel || 'chart' });

    // gridlines + y ticks
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var v = yMin + (span * t) / ticks;
      var y = yPos(v);
      svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: 'chart-grid' }));
      var lbl = svgEl('text', { x: padL - 6, y: y + 3, class: 'chart-axis-label', 'text-anchor': 'end' });
      lbl.textContent = fmt(v);
      svg.appendChild(lbl);
    }
    // x ticks
    xLabels.forEach(function (label, i) {
      var x = xPos(i);
      var lbl = svgEl('text', { x: x, y: H - 6, class: 'chart-axis-label', 'text-anchor': 'middle' });
      lbl.textContent = label;
      svg.appendChild(lbl);
    });
    // axes
    svg.appendChild(svgEl('line', { x1: padL, x2: padL, y1: padT, y2: padT + plotH, class: 'chart-axis' }));
    svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH, class: 'chart-axis' }));

    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return xPos(i) + ',' + yPos(v); }).join(' ');
      svg.appendChild(svgEl('polyline', { points: pts, fill: 'none', stroke: s.color, 'stroke-width': 1.6, class: 'chart-line' }));
      s.values.forEach(function (v, i) {
        svg.appendChild(svgEl('circle', { cx: xPos(i), cy: yPos(v), r: 2.4, fill: s.color, class: 'chart-point' }));
      });
    });

    container.innerHTML = '';
    container.appendChild(svg);

    if (series.length > 1 || (series[0] && series[0].label)) {
      var legend = document.createElement('div');
      legend.className = 'chart-legend';
      series.forEach(function (s) {
        var item = document.createElement('span');
        item.className = 'chart-legend-item';
        item.innerHTML = '<span class="chart-swatch" style="background:' + s.color + '"></span>' + s.label;
        legend.appendChild(item);
      });
      container.appendChild(legend);
    }
  }

  /* ---------------------------------------------------------------------
     Native SVG box plot (used for the brightness-confound comparison).
     opts: { width, height, groups: [{label,color,stats:{min,q1,median,q3,
             max,whisker_lo,whisker_hi,outliers:[]}}], yTickFormat(v) }
     --------------------------------------------------------------------- */

  function drawBoxPlot(container, opts) {
    if (!container) return;
    var W = opts.width || 420, H = opts.height || 220;
    var padL = 42, padR = 14, padT = 14, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var groups = opts.groups || [];
    var allVals = groups.reduce(function (acc, g) {
      var s = g.stats;
      return acc.concat([s.min, s.max], s.outliers || []);
    }, []);
    var yMin = Math.min.apply(null, allVals);
    var yMax = Math.max.apply(null, allVals);
    var span = (yMax - yMin) || 1;
    var pad = span * 0.1;
    yMin -= pad; yMax += pad;
    span = yMax - yMin;
    function yPos(v) { return padT + plotH - ((v - yMin) / span) * plotH; }
    var fmt = opts.yTickFormat || function (v) { return v.toFixed(0); };

    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'native-chart', role: 'img', 'aria-label': opts.ariaLabel || 'box plot' });

    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var v = yMin + (span * t) / ticks;
      var y = yPos(v);
      svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: 'chart-grid' }));
      var lbl = svgEl('text', { x: padL - 6, y: y + 3, class: 'chart-axis-label', 'text-anchor': 'end' });
      lbl.textContent = fmt(v);
      svg.appendChild(lbl);
    }
    svg.appendChild(svgEl('line', { x1: padL, x2: padL, y1: padT, y2: padT + plotH, class: 'chart-axis' }));
    svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH, class: 'chart-axis' }));

    var boxW = Math.min(120, (plotW / groups.length) * 0.4);
    groups.forEach(function (g, i) {
      var cx = padL + (plotW * (i + 0.5)) / groups.length;
      var s = g.stats;
      var yWhiskerLo = yPos(s.whisker_lo);
      var yWhiskerHi = yPos(s.whisker_hi);
      var yQ1 = yPos(s.q1), yQ3 = yPos(s.q3), yMed = yPos(s.median);

      // whisker stem
      svg.appendChild(svgEl('line', { x1: cx, x2: cx, y1: yWhiskerHi, y2: yQ3, class: 'chart-axis', stroke: g.color }));
      svg.appendChild(svgEl('line', { x1: cx, x2: cx, y1: yQ1, y2: yWhiskerLo, class: 'chart-axis', stroke: g.color }));
      // whisker caps
      svg.appendChild(svgEl('line', { x1: cx - boxW / 4, x2: cx + boxW / 4, y1: yWhiskerHi, y2: yWhiskerHi, stroke: g.color, 'stroke-width': 1.2 }));
      svg.appendChild(svgEl('line', { x1: cx - boxW / 4, x2: cx + boxW / 4, y1: yWhiskerLo, y2: yWhiskerLo, stroke: g.color, 'stroke-width': 1.2 }));
      // box
      svg.appendChild(svgEl('rect', {
        x: cx - boxW / 2, y: yQ3, width: boxW, height: Math.max(1, yQ1 - yQ3),
        fill: g.color, 'fill-opacity': 0.22, stroke: g.color, 'stroke-width': 1.4
      }));
      // median line
      svg.appendChild(svgEl('line', { x1: cx - boxW / 2, x2: cx + boxW / 2, y1: yMed, y2: yMed, stroke: g.color, 'stroke-width': 2 }));
      // outliers
      (s.outliers || []).forEach(function (v) {
        svg.appendChild(svgEl('circle', { cx: cx, cy: yPos(v), r: 2, fill: 'none', stroke: g.color, 'stroke-width': 1, class: 'chart-outlier' }));
      });
      // x label
      var lbl = svgEl('text', { x: cx, y: H - 6, class: 'chart-axis-label', 'text-anchor': 'middle' });
      lbl.textContent = g.label;
      svg.appendChild(lbl);
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  /* ---------------------------------------------------------------------
     UI sounds - short synthesized beeps (Web Audio oscillators, no audio
     files to host) on hover/click of interactive elements, in keeping
     with the classic-Windows theme. Deliberately quiet. The AudioContext
     is created lazily on the first interaction, since browsers refuse to
     make sound before any user gesture anyway.
     --------------------------------------------------------------------- */

  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { audioCtx = new Ctor(); } catch (e) { return null; }
    }
    if (audioCtx.state === 'suspended') { audioCtx.resume().catch(function () {}); }
    return audioCtx;
  }

  function playBeep(freqStart, freqEnd, duration, type, volume) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      var now = ctx.currentTime;
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd && freqEnd !== freqStart) osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);
      gain.gain.setValueAtTime(volume || 0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    } catch (e) { /* audio is a nicety, never let it break the UI */ }
  }

  // A short burst of filtered, decaying noise - the "thock" body of a
  // chunky mechanical switch, layered under playClickSound()'s low tone
  // so a click reads as a muffled thump rather than a pure electronic tone.
  function playNoiseBurst(duration, volume, filterFreq) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        var decay = 1 - (i / bufferSize);
        data[i] = (Math.random() * 2 - 1) * decay * decay;
      }
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq || 900, ctx.currentTime);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime);
    } catch (e) { /* audio is a nicety, never let it break the UI */ }
  }

  // Soft, low "tock" - a duller, quieter mechanical tap instead of a
  // bright rising whoosh, played when the pointer enters a button/row.
  function playHoverSound() { playBeep(220, 170, 0.05, 'sine', 0.03); }
  // Muffled percussive "thock" (filtered noise) plus a low sine body tone
  // underneath - chunky and mechanical rather than a shrill chime, at
  // roughly the same overall loudness as before.
  function playClickSound() {
    playNoiseBurst(0.05, 0.05, 700);
    playBeep(180, 130, 0.08, 'sine', 0.05);
  }

  var SOUND_SELECTOR = '.btn, .info-btn, .toolbar a, .tb-toggle, .model-row, ' +
    '.data-table tbody tr, .evidence-thumb img, .img-frame.clickable, ' +
    'select, .record-jump, #modal-close, .lightbox-box .btn';
  var lastHoverSoundEl = null;
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest(SOUND_SELECTOR);
    if (el && el !== lastHoverSoundEl) {
      lastHoverSoundEl = el;
      playHoverSound();
    } else if (!el) {
      lastHoverSoundEl = null;
    }
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest(SOUND_SELECTOR);
    if (el) playClickSound();
  });

  // Chrome/Safari only ever unlock a page's AudioContext from a real user
  // "activation" gesture (a click/tap/keypress) - a plain mouseover does
  // NOT count, so ensureAudio()'s resume() from playHoverSound() alone can
  // leave the context permanently suspended (silently - no error) on any
  // page where the visitor happens to hover things before ever clicking
  // anything, e.g. browsing the stats-page tables without pressing a
  // button first. Priming it on the very first pointerdown/keydown
  // anywhere on the page - independent of SOUND_SELECTOR - guarantees it
  // gets unlocked immediately, so every page's hover/click sounds work
  // the same from that point on.
  var audioPrimed = false;
  function primeAudioOnce() {
    if (audioPrimed) return;
    audioPrimed = true;
    ensureAudio();
  }
  document.addEventListener('pointerdown', primeAudioOnce, { capture: true, once: true });
  document.addEventListener('keydown', primeAudioOnce, { capture: true, once: true });

  /* ---------------------------------------------------------------------
     Status-bar hover hints
     --------------------------------------------------------------------- */

  function wireStatusHints(hintElId) {
    var hintEl = document.getElementById(hintElId);
    if (!hintEl) return;
    var fallbackDefault = hintEl.textContent;
    // Read the "resting" text fresh each time rather than caching it once,
    // so it stays correct after a language switch instead of reverting to
    // whatever was on screen at wire time.
    function restingText() {
      var key = hintEl.getAttribute('data-i18n');
      return key ? t(key) : fallbackDefault;
    }
    document.addEventListener('mouseover', function (e) {
      var hinted = e.target.closest && e.target.closest('[data-hint]');
      if (hinted) hintEl.textContent = hinted.getAttribute('data-hint');
    });
    document.addEventListener('mouseout', function (e) {
      var hinted = e.target.closest && e.target.closest('[data-hint]');
      if (hinted) hintEl.textContent = restingText();
    });
    document.addEventListener('focusin', function (e) {
      var hinted = e.target.closest && e.target.closest('[data-hint]');
      if (hinted) hintEl.textContent = hinted.getAttribute('data-hint');
    });
    document.addEventListener('focusout', function (e) {
      var hinted = e.target.closest && e.target.closest('[data-hint]');
      if (hinted) hintEl.textContent = restingText();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyTranslations(document);
    wireStaticTooltips(document);
    // Sync the two toggle buttons' visible labels to whatever state was
    // just restored from storage (they still carry their light/en default
    // text baked into the HTML until this runs).
    document.querySelectorAll('[data-lang-label]').forEach(function (el) {
      el.textContent = t('toggle.lang');
    });
    document.querySelectorAll('[data-theme-label]').forEach(function (el) {
      el.textContent = theme === 'dark' ? t('toggle.themeToLight') : t('toggle.themeToDark');
    });
  });

  return {
    showTooltip: showTooltip,
    hideTooltip: hideTooltip,
    wireStaticTooltips: wireStaticTooltips,
    openLightbox: openLightbox,
    wireStatusHints: wireStatusHints,
    drawLineChart: drawLineChart,
    drawBoxPlot: drawBoxPlot,
    t: t,
    getLang: getLang,
    setLang: setLang,
    toggleLang: toggleLang,
    applyTranslations: applyTranslations,
    getTheme: getTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,
    // Shared with js/music.js, so the background-music player reuses the
    // same AudioContext (and the same gesture-unlock timing) as the UI
    // hover/click sounds instead of spinning up a second one.
    getAudioContext: ensureAudio,
  };
})();
