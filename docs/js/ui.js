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
      'nav.about': '01_ABOUT',
      'nav.playground': '02_PLAYGROUND',
      'nav.stats': '03_MODEL_STATS',
      'nav.source': '04_SOURCE',
      'nav.about.hint': 'Where this project and dataset come from.',
      'nav.playground.hint': 'Browse test records and try any of the 22 models.',
      'nav.stats.hint': 'Compare all 22 models and read the write-ups.',
      'nav.source.hint': 'Open the project source on GitHub.',
      'status.online': 'SYSTEM ONLINE',
      'status.modelsLoaded': 'MODELS LOADED',
      'status.testRecords': 'TEST RECORDS',
      'status.aboutHint': 'A quick tour before you dive in — where the data comes from and what this project does.',
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
      'recordViewer.pause': 'PAUSE',
      'recordViewer.resume': 'RESUME',
      'recordViewer.pauseHint': 'Leave the viewer alone and it wanders to a random record on its own after a 10s countdown. Click to stop (or resume) that.',
      'recordViewer.idleBarHint': 'Auto-advance countdown - fills up, then the viewer jumps to a random record. Any click resets it.',
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
      'titlebar.about': 'Welcome',
      'titlebar.playground': 'Playground',
      'titlebar.stats': 'Model Stats',
      'title.about': 'Peotran QC — Welcome',
      'title.playground': 'Peotran QC — Playground',
      'title.stats': 'Peotran QC — Model Stats',

      'about.linkOpenCV': '↗ OpenCV docs',
      'about.linkSkimage': '↗ scikit-image docs',
      'about.linkSklearn': '↗ scikit-learn docs',
      'about.linkArxiv': '↗ arXiv paper',
      'about.linkPyTorch': '↗ PyTorch / torchvision docs',
      'about.linkKaggle': '↗ open on Kaggle',

      'about.boot': 'SYSTEM BOOT: peotran_qc.exe &rarr; loading casting_quality_inspection.story&hellip; READY!',
      'about.title': 'CASTING QUALITY INSPECTION',
      'about.subtitle': 'Can a machine spot a bad casting just by looking at it?! This site puts 22 models — from a straight-line classifier to a full deep neural network — up against the same 715 real factory photos!',
      'about.ctaPlayground': '&rarr; 02_PLAYGROUND — try a model yourself!',
      'about.ctaStats': '&rarr; 03_MODEL_STATS — see the full leaderboard!',

      'about.dataset.title': 'THE DATASET',
      'about.dataset.subtitle': 'real photos, from a real factory',
      'about.dataset.p1': 'Every photo on this site comes from a public dataset on Kaggle, <a href="https://www.kaggle.com/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting-product" target="_blank" rel="noopener">casting product image data for quality inspection</a>, published by <strong>ravirajsinh45</strong>. The photos themselves were taken on an actual production line at <strong>Pilot TechnoCast</strong>, a casting manufacturer in Shapar, Rajkot, India — real parts, a real camera, real defects, not a synthetic benchmark.',
      'about.dataset.p2': 'The part being photographed is a <strong>submersible pump impeller</strong>. Every image is labeled one of two ways — <code>def_front</code> (defective) or <code>ok_front</code> (OK) — flagged for real casting defects such as blow holes, pinholes, burr, shrinkage, and mould-material or pouring-metal defects.',
      'about.dataset.stat1Label': 'PHOTOS<br>in the original dataset',
      'about.dataset.stat2Label': 'CLASSES<br>def_front &middot; ok_front',
      'about.dataset.stat3Label': 'ORIGINAL RESOLUTION<br>a 300&times;300 augmented set ships too',
      'about.dataset.sampleOkCaption': '6 OK examples, straight from the dataset',
      'about.dataset.sampleDefCaption': '6 defective examples, straight from the dataset',

      'about.problem.title': 'THE PROBLEM',
      'about.problem.subtitle': 'teaching a machine to do the first pass',
      'about.problem.p1': 'In a real factory, the first line of defense against a bad casting is usually a person standing at a lightbox — reliable, but slow, subjective, and expensive to run on every single part, every shift. This project asks a narrower question: can a model do that first pass instead? It\'s a binary image classification problem — given one photo of a cast impeller, predict <code>def_front</code> or <code>ok_front</code>.',
      'about.problem.p2': 'To find out, this project doesn\'t train just one model — it trains <strong>22</strong>, then compares every one of them on the exact same 715 held-out test photos. Head to <a href="playground.html">02_PLAYGROUND</a> to watch any of them make a real prediction, record by record, or <a href="stats.html">03_MODEL_STATS</a> for the full leaderboard, training curves, and known limitations.',
      'about.problem.flow1': 'PHOTO IN',
      'about.problem.flow2': '22 MODELS PREDICT',
      'about.problem.flow3': 'DEF_FRONT / OK_FRONT OUT',

      'about.features.title': 'FEATURE EXTRACTION — CLASSICAL CV',
      'about.features.subtitle': '7 ways to turn a photo into numbers, before any classifier ever sees it',
      'about.features.raw.title': 'RAW PIXELS',
      'about.features.raw.desc': 'The flattened, normalized grayscale pixel grid itself — no feature engineering at all, just the baseline every other feature has to beat.',
      'about.features.raw.tooltip': '<p>The flattened, normalized grayscale pixel grid itself — no feature engineering at all, just the baseline every other feature has to beat.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/d3/df2/tutorial_py_basic_ops.html" target="_blank" rel="noopener">↗ OpenCV docs</a></p>',
      'about.features.hist.title': 'GRAYSCALE HISTOGRAM',
      'about.features.hist.desc': 'The distribution of brightness values across the whole photo. Cheap — and, as the SYSTEM ADVISORY on this site explains, almost too good at solving this particular dataset.',
      'about.features.hist.tooltip': '<p>The distribution of brightness values across the whole photo. Cheap — and, as the SYSTEM ADVISORY on this site explains, almost too good at solving this particular dataset.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/d1/db7/tutorial_py_histogram_begins.html" target="_blank" rel="noopener">↗ OpenCV docs</a></p>',
      'about.features.sobel.title': 'SOBEL',
      'about.features.sobel.desc': 'A gradient-based edge detector — highlights where brightness changes sharply, tracing the rim and any cracks.',
      'about.features.sobel.tooltip': '<p>A gradient-based edge detector — highlights where brightness changes sharply, tracing the rim and any cracks.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/d2/d2c/tutorial_sobel_derivatives.html" target="_blank" rel="noopener">↗ OpenCV docs</a></p>',
      'about.features.canny.title': 'CANNY',
      'about.features.canny.desc': 'A cleaner, thresholded edge map built on the same gradient idea as Sobel — crisp outlines instead of raw gradient strength.',
      'about.features.canny.tooltip': '<p>A cleaner, thresholded edge map built on the same gradient idea as Sobel — crisp outlines instead of raw gradient strength.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/da/d22/tutorial_py_canny.html" target="_blank" rel="noopener">↗ OpenCV docs</a></p>',
      'about.features.lbp.title': 'LBP',
      'about.features.lbp.desc': 'Local Binary Patterns — encodes texture by comparing each pixel to its neighbors, good at picking up the fine surface texture a defect leaves behind.',
      'about.features.lbp.tooltip': '<p>Local Binary Patterns — encodes texture by comparing each pixel to its neighbors, good at picking up the fine surface texture a defect leaves behind.</p><p style="margin:0;"><a href="https://scikit-image.org/docs/stable/auto_examples/features_detection/plot_local_binary_pattern.html" target="_blank" rel="noopener">↗ scikit-image docs</a></p>',
      'about.features.hog.title': 'HOG',
      'about.features.hog.desc': 'Histogram of Oriented Gradients — summarizes edge direction and strength in local cells, capturing shape and contour structure.',
      'about.features.hog.tooltip': '<p>Histogram of Oriented Gradients — summarizes edge direction and strength in local cells, capturing shape and contour structure.</p><p style="margin:0;"><a href="https://scikit-image.org/docs/stable/auto_examples/features_detection/plot_hog.html" target="_blank" rel="noopener">↗ scikit-image docs</a></p>',
      'about.features.glcm.title': 'GLCM',
      'about.features.glcm.desc': 'Gray-Level Co-occurrence Matrix — a statistical texture descriptor: how often pairs of pixel values occur next to each other, at a given distance and direction.',
      'about.features.glcm.tooltip': '<p>Gray-Level Co-occurrence Matrix — a statistical texture descriptor: how often pairs of pixel values occur next to each other, at a given distance and direction.</p><p style="margin:0;"><a href="https://scikit-image.org/docs/stable/auto_examples/features_detection/plot_glcm.html" target="_blank" rel="noopener">↗ scikit-image docs</a></p>',

      'about.models.title': 'CLASSICAL MODELS',
      'about.models.subtitle': '3 classifiers &times; 7 features = 21 classical models',
      'about.models.logreg.title': 'LOGISTIC REGRESSION',
      'about.models.logreg.desc': 'A linear baseline — draws a single straight decision boundary through feature space. Fast, interpretable, and surprisingly hard to beat here.',
      'about.models.logreg.tooltip': '<p>A linear baseline — draws a single straight decision boundary through feature space. Fast, interpretable, and surprisingly hard to beat here.</p><p style="margin:0;"><a href="https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression" target="_blank" rel="noopener">↗ scikit-learn docs</a></p>',
      'about.models.rf.title': 'RANDOM FOREST',
      'about.models.rf.desc': 'An ensemble of decision trees, each voting on a random subset of features — captures non-linear patterns raw pixels leave on the table.',
      'about.models.rf.tooltip': '<p>An ensemble of decision trees, each voting on a random subset of features — captures non-linear patterns raw pixels leave on the table.</p><p style="margin:0;"><a href="https://scikit-learn.org/stable/modules/ensemble.html#forests-of-randomized-trees" target="_blank" rel="noopener">↗ scikit-learn docs</a></p>',
      'about.models.svm.title': 'SVM',
      'about.models.svm.desc': 'Finds the widest possible margin between the two classes in feature space — this project\'s single best classical result.',
      'about.models.svm.tooltip': '<p>Finds the widest possible margin between the two classes in feature space — this project\'s single best classical result.</p><p style="margin:0;"><a href="https://scikit-learn.org/stable/modules/svm.html" target="_blank" rel="noopener">↗ scikit-learn docs</a></p>',

      'about.dl.title': 'DEEP LEARNING',
      'about.dl.subtitle': 'letting a network learn its own features',
      'about.dl.resnetTitle': 'RESNET18',
      'about.dl.resnetDesc': 'Instead of hand-crafted features, a convolutional neural network learns its own — 18 layers deep, with residual ("skip") connections that let gradients keep flowing through a very deep network. This project fine-tunes a version pretrained on ImageNet (transfer learning) rather than training from scratch.',
      'about.dl.resnetTooltip': '<p>Instead of hand-crafted features, a convolutional neural network learns its own — 18 layers deep, with residual ("skip") connections that let gradients keep flowing through a very deep network. This project fine-tunes a version pretrained on ImageNet (transfer learning) rather than training from scratch.</p><p style="margin:0 0 4px;"><a href="https://arxiv.org/abs/1512.03385" target="_blank" rel="noopener">↗ arXiv paper</a></p><p style="margin:0;"><a href="https://pytorch.org/vision/stable/models/resnet.html" target="_blank" rel="noopener">↗ PyTorch / torchvision docs</a></p>',
      'about.dl.gradcamTitle': 'GRAD-CAM',
      'about.dl.gradcamDesc': 'Every ResNet18 prediction on 02_PLAYGROUND ships with a Grad-CAM heatmap — a way to see which pixels actually pushed the model toward its verdict, instead of trusting the confidence number blindly.',
      'about.dl.gradcamTooltip': '<p>Every ResNet18 prediction on 02_PLAYGROUND ships with a Grad-CAM heatmap — a way to see which pixels actually pushed the model toward its verdict, instead of trusting the confidence number blindly.</p><p style="margin:0;"><a href="https://arxiv.org/abs/1610.02391" target="_blank" rel="noopener">↗ arXiv paper</a></p>',

      'about.footer.cta': '&rarr; 02_PLAYGROUND — pick a model and see it classify a real photo',
      'footer.about1': 'PEOTRAN_QC.EXE v1.0 — a tour of the dataset and the approach behind every number on this site',

      'methodology.title': 'METHODOLOGY',
      'methodology.subtitle': 'how these numbers were produced',
      'methodology.stat1': 'TEST PHOTOS<br>held out before any training',
      'methodology.stat2': 'DUPLICATES FOUND<br>leaking into the training set',
      'methodology.stat3': 'MODELS<br>retrained from scratch',
      'methodology.flow1': 'TRAIN PHOTOS',
      'methodology.flow2': 'CHECKED AGAINST TEST PHOTOS',
      'methodology.flow3': '64 DUPLICATES FOUND',
      'methodology.flow4': 'REMOVED FROM TRAIN',
      'methodology.flow5': 'ALL 22 MODELS RETRAINED',
      'methodology.pipeline': 'The <strong>715 test photos</strong> were set aside <strong>before any of the 22 models were trained</strong>, so none of them ever saw these images during training. Every number on this page comes from testing on those same 715 photos.',
      'methodology.leakage': 'Before publishing, every test photo was checked against every training photo for accidental duplicates. <strong>64 duplicate photos</strong> turned up in the training set — removed, then <strong>all 22 models were retrained from scratch</strong>. The table below shows what changed.',
      'methodology.leakageDetailsBtn': '(i) HOW THE DUPLICATES WERE FOUND',
      'methodology.leakageDetailsBody': '<ul><li>Every training and test photo is hashed with <strong>MD5</strong> — a fingerprint of the file’s exact bytes.</li><li>A cheap <strong>file-size pre-filter</strong> runs first, so only files that already match in size get hashed and compared — this keeps the check fast across thousands of images.</li><li>A pair only counts as a duplicate if it’s <strong>byte-for-byte identical</strong> — the same photo saved twice, not just visually similar.</li><li class="muted">Matches are moved out of train/ into a separate backup folder, never deleted — and the test set itself is never touched.</li></ul>',
      'leakageTable.title': 'ACCURACY BEFORE → AFTER CLEANUP',
      'leakageTable.subtitle': 'All 22 models, same 715 test photos, before vs. after removing the 64 duplicates.',
      'leakageTable.before': 'BEFORE',
      'leakageTable.after': 'AFTER',
      'leakageTable.delta': 'Δ',
      'leakageTable.summary': 'Average change: <strong>{mean} pts</strong> across all 22 models (mostly small drops — those 64 duplicates were inflating a handful of models’ test accuracy). Worst hit: <strong>{worstModel}</strong> at <strong>{worst} pts</strong>. The two models everyone actually cites, Histogram+SVM and ResNet18, barely moved.',

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
      'trainingCurve.note': 'Best checkpoint: epoch <strong>{epoch}</strong>, {f1} validation F1. Validation F1 stays in a tight 0.991–0.998 band for the whole run, tracking training accuracy closely — no sign of overfitting.',
      'brightness.title': 'BRIGHTNESS DISTRIBUTION',
      'brightness.subtitle': 'def_front vs ok_front · test set, 715 images · box plot',
      'brightness.note': 'Median brightness: <strong>{def}</strong> for def_front vs <strong>{ok}</strong> for ok_front (0–255 grayscale). See KNOWN LIMITATIONS below for what that means for how much to trust these models.',
      'umap.title': 'UMAP EMBEDDINGS',
      'umap.subtitle': 'test set, 715 images · feature space projected to 2-D',
      'umap.histogramTitle': 'HISTOGRAM FEATURES (256-D)',
      'umap.resnetTitle': 'RESNET18 FEATURES (512-D)',
      'umap.legendDef': 'def_front',
      'umap.legendOk': 'ok_front',
      'umap.legendWrong': 'misclassified',
      'umap.note': 'Histogram\'s 256-d space shows the two classes partially interleaved; ResNet18\'s 512-d space splits them into two clean, non-overlapping clusters instead. Misclassified: <strong>{histWrong}</strong> for Histogram, <strong>{resnetWrong}</strong> for ResNet18.',
      'umap.missing': 'UMAP coordinates not exported yet — run the export cell in 07_error_analysis.ipynb §9 to add this chart.',
      'sourceFigures.title': 'SOURCE FIGURES',
      'sourceFigures.intro': 'All of the charts on this page, UMAP included, are drawn straight from the real numbers behind them, not pasted-in screenshots — that keeps them interactive and visually consistent with the rest of the site. The plain sample photos and the edge/HOG illustrations below are the exception, since they were never charts to begin with. For the exact matplotlib output as it rendered in notebooks 01–09 — as evidence, not a redraw — open the gallery.',
      'sourceFigures.confusionNoteBtn': '(i) WHY THE HISTOGRAM+SVM CONFUSION MATRIX LOOKS DIFFERENT',
      'sourceFigures.confusionNoteBody': '<p style="margin:0 0 8px;">One figure in the gallery is a partial exception to the note above: the <strong>Confusion matrix — Histogram+SVM</strong> screenshot comes straight from <code>04_classical_ml.ipynb</code>, but that cell runs on an internal <strong>validation split</strong> carved out of the training data — used only to pick the best feature+classifier combination before the final model is trained.</p><p style="margin:0;">Click that model\'s row in MODEL COMPARISON below and you\'ll see a different, <strong>live</strong> confusion matrix — that one is computed from the real <strong>715-image held-out test set</strong>, the same numbers behind every other chart on this page. The two are expected to differ; it\'s not a bug, just two different splits shown for two different purposes.</p>',
      'sourceFigures.btn': 'VIEW 11 SOURCE FIGURES',
      'sourceFigures.btnHint': 'Open the 11 original notebook screenshots in a viewer.',
      'evidence.label': 'From the notebooks:',
      'advisoryLog.title': 'KNOWN LIMITATIONS & ADVISORY LOG',
      'advisoryLog.subtitle': 'hover (i) for the full write-up',
      'advisoryLog.fullWriteup': '(i) FULL WRITE-UP',
      'advisory.brightness.title': 'BRIGHTNESS CONFOUND (ALL MODELS)',
      'advisory.brightness.short': 'def_front images run about 10–11 intensity levels darker; accuracy collapses to ~63–73% once brightness is equalized.',
      'advisory.brightness.full': '<p><strong>def_front images run ~10–11 intensity levels darker</strong> than ok_front on average (p ≈ 0, n = 7,284) — <em>most likely a lighting/photography artifact</em>, not the defects themselves.</p><ul><li>Flattening brightness (LAB equalization) still tanks accuracy for <em>both</em> model types, though after retraining on the leakage-cleaned data, ResNet18 now holds up noticeably better than the classical model:</li></ul><table class="data-table"><thead><tr><th>MODEL</th><th>ORIGINAL</th><th>EQUALIZED</th><th>DROP</th></tr></thead><tbody><tr><td>Histogram + SVM</td><td>99.86%</td><td>63.36%</td><td>&minus;36.50 pts</td></tr><tr><td>ResNet18</td><td>99.72%</td><td>72.73%</td><td>&minus;26.99 pts</td></tr></tbody></table><ul><li>ResNet18 collapses about 9.5 points less than the classical model once brightness is flattened — a real, if partial, robustness edge that the earlier (leaky) run did not show.</li><li>Grad-CAM and UMAP both suggest ResNet18 isn’t <em>purely</em> a brightness detector, consistent with that edge — but it still leans on the confound substantially.</li><li><strong>Neither model’s ~99.7–99.9% accuracy should be assumed to carry over</strong> to different lighting or exposure without further testing or brightness/contrast augmentation.</li><li class="muted">Not fixed in v1 — brightness/contrast augmentation is the obvious next step.</li></ul>',
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
      'fig.confusionSvm': 'Confusion matrix — Histogram+SVM (validation split, not the final test set)',
      'fig.resnetTraining': 'ResNet18 training curves',
      'fig.unifiedCompare': 'Test accuracy, 95% bootstrap CI',
      'fig.brightnessBox': 'Brightness confound (box plots)',
      'fig.umap': 'UMAP: histogram vs. ResNet18 features',
      'tooltip.pinnedHint': 'PINNED — CLICK THE BUTTON OR PRESS ESC TO CLOSE',
    },
    vi: {
      'nav.about': '01_GIỚI_THIỆU',
      'nav.playground': '02_SÂN_THỬ',
      'nav.stats': '03_THỐNG_KÊ_MODEL',
      'nav.source': '04_MÃ_NGUỒN',
      'nav.about.hint': 'Dự án và bộ dữ liệu này đến từ đâu.',
      'nav.playground.hint': 'Duyệt qua ảnh test và thử bất kỳ model nào trong 22 model.',
      'nav.stats.hint': 'So sánh cả 22 model và đọc phần phân tích.',
      'nav.source.hint': 'Mở mã nguồn dự án trên GitHub.',
      'status.online': 'HỆ THỐNG HOẠT ĐỘNG',
      'status.modelsLoaded': 'SỐ MODEL',
      'status.testRecords': 'SỐ ẢNH TEST',
      'status.aboutHint': 'Một vòng giới thiệu nhanh trước khi bắt đầu — dữ liệu từ đâu ra và dự án này làm gì.',
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
      'recordViewer.pause': 'TẠM DỪNG',
      'recordViewer.resume': 'TIẾP TỤC',
      'recordViewer.pauseHint': 'Để yên không thao tác, sau 10 giây đếm ngược web sẽ tự nhảy đến ảnh ngẫu nhiên. Bấm để dừng (hoặc tiếp tục) việc này.',
      'recordViewer.idleBarHint': 'Thanh đếm ngược tự chuyển ảnh — đầy thì web nhảy sang ảnh ngẫu nhiên. Bấm bất cứ đâu sẽ reset lại.',
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
      'titlebar.about': 'Giới thiệu',
      'titlebar.playground': 'Sân thử',
      'titlebar.stats': 'Thống kê Model',
      'title.about': 'Peotran QC — Giới thiệu',
      'title.playground': 'Peotran QC — Sân thử',
      'title.stats': 'Peotran QC — Thống kê Model',

      'about.linkOpenCV': '↗ Tài liệu OpenCV',
      'about.linkSkimage': '↗ Tài liệu scikit-image',
      'about.linkSklearn': '↗ Tài liệu scikit-learn',
      'about.linkArxiv': '↗ Bài báo gốc (arXiv)',
      'about.linkPyTorch': '↗ Tài liệu PyTorch / torchvision',
      'about.linkKaggle': '↗ Mở trên Kaggle',

      'about.boot': 'SYSTEM BOOT: peotran_qc.exe &rarr; đang tải casting_quality_inspection.story&hellip; SẴN SÀNG!',
      'about.title': 'KIỂM TRA CHẤT LƯỢNG VẬT ĐÚC',
      'about.subtitle': 'Máy có nhận ra một sản phẩm đúc bị lỗi chỉ bằng cách nhìn vào nó không?! Mình cho 22 model đấu nhau — từ một bộ phân loại tuyến tính đơn giản cho tới một mạng neural — trên cùng 715 tấm ảnh thật chụp tại nhà máy!',
      'about.ctaPlayground': '&rarr; 02_SÂN_THỬ — tự mình thử một model!',
      'about.ctaStats': '&rarr; 03_THỐNG_KÊ_MODEL — xem toàn bộ bảng xếp hạng!',

      'about.dataset.title': 'BỘ DỮ LIỆU',
      'about.dataset.subtitle': 'ảnh thật, từ một nhà máy thật',
      'about.dataset.p1': 'Ảnh trên trang này mình lấy từ một bộ dữ liệu công khai trên Kaggle, <a href="https://www.kaggle.com/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting-product" target="_blank" rel="noopener">casting product image data for quality inspection</a>, do <strong>ravirajsinh45</strong> đăng tải — chụp ngay trên dây chuyền của <strong>Pilot TechnoCast</strong>, một nhà máy đúc kim loại ở Shapar, Rajkot, Ấn Độ.',
      'about.dataset.p2': 'Sản phẩm trong ảnh là <strong>impeller (cánh bơm) của bơm chìm</strong>, gán nhãn <code>def_front</code> (lỗi) hoặc <code>ok_front</code> (đạt) theo các lỗi đúc thật như rỗ khí, lỗ kim, ba-via, co ngót và vài lỗi khuôn/rót kim loại khác.',
      'about.dataset.stat1Label': 'ẢNH<br>trong bộ dữ liệu gốc',
      'about.dataset.stat2Label': 'LỚP<br>def_front &middot; ok_front',
      'about.dataset.stat3Label': 'ĐỘ PHÂN GIẢI GỐC<br>còn có bản 300&times;300 đã augment',
      'about.dataset.sampleOkCaption': '6 ảnh mẫu OK, lấy thẳng từ bộ dữ liệu',
      'about.dataset.sampleDefCaption': '6 ảnh mẫu lỗi, lấy thẳng từ bộ dữ liệu',

      'about.problem.title': 'BÀI TOÁN',
      'about.problem.subtitle': 'dạy máy làm bước kiểm tra đầu tiên',
      'about.problem.p1': 'Ở nhà máy, bước kiểm tra đầu tiên thường là một người đứng soi đèn — đáng tin nhưng chậm và tốn sức nếu làm với từng sản phẩm, từng ca. Mình muốn xem một model có làm được bước đó thay người không: cho một ảnh cánh bơm đúc, đoán xem nó là <code>def_front</code> hay <code>ok_front</code>.',
      'about.problem.p2': 'Mình không chỉ train 1 model — mà train tới <strong>22</strong>, rồi so tất cả trên cùng 715 ảnh test giữ riêng ra. Ghé <a href="playground.html">02_SÂN_THỬ</a> để xem từng model đoán trên ảnh thật, hoặc <a href="stats.html">03_THỐNG_KÊ_MODEL</a> để xem bảng xếp hạng và các giới hạn mình đã ghi nhận.',
      'about.problem.flow1': 'ẢNH ĐẦU VÀO',
      'about.problem.flow2': '22 MODEL DỰ ĐOÁN',
      'about.problem.flow3': 'KẾT QUẢ: DEF_FRONT / OK_FRONT',

      'about.features.title': 'TRÍCH XUẤT ĐẶC TRƯNG — CLASSICAL CV',
      'about.features.subtitle': '7 cách biến một tấm ảnh thành con số, trước khi đưa vào bất kỳ classifier nào',
      'about.features.raw.title': 'RAW PIXELS',
      'about.features.raw.desc': 'Chính là lưới pixel grayscale đã chuẩn hóa và làm phẳng — không có kỹ thuật trích xuất nào cả, chỉ là baseline mà mọi feature khác phải vượt qua.',
      'about.features.raw.tooltip': '<p>Y nguyên bảng pixel grayscale sau khi chuẩn hoá — không xử lý gì thêm cả, chỉ để làm mốc so sánh cho các feature khác.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/d3/df2/tutorial_py_basic_ops.html" target="_blank" rel="noopener">↗ Tài liệu OpenCV</a></p>',
      'about.features.hist.title': 'HISTOGRAM ĐỘ SÁNG',
      'about.features.hist.desc': 'Phân bố độ sáng của toàn bộ tấm ảnh. Rẻ tiền — và như phần SYSTEM ADVISORY trên trang này giải thích, gần như "quá giỏi" trong việc giải bộ dữ liệu này.',
      'about.features.hist.tooltip': '<p>Đo độ sáng trải đều thế nào trên cả tấm ảnh. Rẻ, dễ tính — nhưng đúng như mục SYSTEM ADVISORY ở trang bên nói, nó "ăn gian" hơi nhiều với bộ dữ liệu này.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/d1/db7/tutorial_py_histogram_begins.html" target="_blank" rel="noopener">↗ Tài liệu OpenCV</a></p>',
      'about.features.sobel.title': 'SOBEL',
      'about.features.sobel.desc': 'Bộ dò cạnh dựa trên gradient — làm nổi bật những chỗ độ sáng thay đổi đột ngột, vẽ lại viền và các vết nứt.',
      'about.features.sobel.tooltip': '<p>Dò cạnh dựa trên gradient — chỗ nào độ sáng đổi đột ngột thì nổi bật lên, giúp thấy rõ viền và vết nứt.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/d2/d2c/tutorial_sobel_derivatives.html" target="_blank" rel="noopener">↗ Tài liệu OpenCV</a></p>',
      'about.features.canny.title': 'CANNY',
      'about.features.canny.desc': 'Một bản đồ cạnh sạch hơn, có ngưỡng, dựa trên cùng ý tưởng gradient như Sobel — cho đường viền rõ nét thay vì cường độ gradient thô.',
      'about.features.canny.tooltip': '<p>Cũng dựa trên gradient như Sobel, nhưng lọc bớt để ra đường viền sạch, rõ nét hơn thay vì giữ nguyên cường độ gradient thô.</p><p style="margin:0;"><a href="https://docs.opencv.org/4.x/da/d22/tutorial_py_canny.html" target="_blank" rel="noopener">↗ Tài liệu OpenCV</a></p>',
      'about.features.lbp.title': 'LBP',
      'about.features.lbp.desc': 'Local Binary Patterns — mã hóa kết cấu bằng cách so sánh từng pixel với các pixel lân cận, giỏi bắt được kết cấu bề mặt nhỏ mà một vết lỗi để lại.',
      'about.features.lbp.tooltip': '<p>So từng pixel với các pixel xung quanh để nắm bắt kết cấu bề mặt — hợp để bắt những vết xước, vết lỗi nhỏ trên bề mặt.</p><p style="margin:0;"><a href="https://scikit-image.org/docs/stable/auto_examples/features_detection/plot_local_binary_pattern.html" target="_blank" rel="noopener">↗ Tài liệu scikit-image</a></p>',
      'about.features.hog.title': 'HOG',
      'about.features.hog.desc': 'Histogram of Oriented Gradients — tóm tắt hướng và cường độ cạnh trong từng ô cục bộ, nắm được cấu trúc hình dạng và đường viền.',
      'about.features.hog.tooltip': '<p>Gom hướng và độ mạnh của cạnh theo từng ô nhỏ, giúp nắm được hình dạng và đường viền tổng thể của vật thể.</p><p style="margin:0;"><a href="https://scikit-image.org/docs/stable/auto_examples/features_detection/plot_hog.html" target="_blank" rel="noopener">↗ Tài liệu scikit-image</a></p>',
      'about.features.glcm.title': 'GLCM',
      'about.features.glcm.desc': 'Gray-Level Co-occurrence Matrix — một descriptor kết cấu thống kê: tần suất các cặp giá trị pixel xuất hiện cạnh nhau, theo một khoảng cách và hướng cho trước.',
      'about.features.glcm.tooltip': '<p>Thống kê xem các cặp giá trị pixel hay đứng cạnh nhau theo hướng nào, cách nhau bao xa — một cách đo kết cấu bề mặt.</p><p style="margin:0;"><a href="https://scikit-image.org/docs/stable/auto_examples/features_detection/plot_glcm.html" target="_blank" rel="noopener">↗ Tài liệu scikit-image</a></p>',

      'about.models.title': 'CÁC MODEL CLASSICAL',
      'about.models.subtitle': '3 classifier &times; 7 feature = 21 model classical',
      'about.models.logreg.title': 'LOGISTIC REGRESSION',
      'about.models.logreg.desc': 'Một baseline tuyến tính — vẽ một đường biên quyết định thẳng duy nhất trong không gian feature. Nhanh, dễ diễn giải, và khó bị đánh bại hơn bạn tưởng ở bài toán này.',
      'about.models.logreg.tooltip': '<p>Một đường thẳng phân chia 2 lớp trong không gian feature. Đơn giản, dễ hiểu, mà kết quả ở bài này thì khó ngờ.</p><p style="margin:0;"><a href="https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression" target="_blank" rel="noopener">↗ Tài liệu scikit-learn</a></p>',
      'about.models.rf.title': 'RANDOM FOREST',
      'about.models.rf.desc': 'Một tập hợp (ensemble) các cây quyết định, mỗi cây "bỏ phiếu" dựa trên một tập con feature ngẫu nhiên — bắt được các pattern phi tuyến mà raw pixel bỏ sót.',
      'about.models.rf.tooltip': '<p>Một đám cây quyết định, mỗi cây nhìn một góc feature khác nhau rồi cùng biểu quyết — bắt được cả những pattern mà pixel thô bỏ sót.</p><p style="margin:0;"><a href="https://scikit-learn.org/stable/modules/ensemble.html#forests-of-randomized-trees" target="_blank" rel="noopener">↗ Tài liệu scikit-learn</a></p>',
      'about.models.svm.title': 'SVM',
      'about.models.svm.desc': 'Tìm biên độ (margin) rộng nhất có thể giữa 2 lớp trong không gian feature — đây là kết quả classical tốt nhất của cả dự án.',
      'about.models.svm.tooltip': '<p>Tìm ranh giới rộng nhất có thể giữa 2 lớp trong không gian feature — và đây là kết quả classical tốt nhất trong cả 21 model.</p><p style="margin:0;"><a href="https://scikit-learn.org/stable/modules/svm.html" target="_blank" rel="noopener">↗ Tài liệu scikit-learn</a></p>',

      'about.dl.title': 'DEEP LEARNING',
      'about.dl.subtitle': 'để mạng neural tự học lấy feature của riêng nó',
      'about.dl.resnetTitle': 'RESNET18',
      'about.dl.resnetDesc': 'Thay vì dùng feature thủ công, một mạng neural tích chập (CNN) tự học lấy feature của riêng nó — sâu 18 lớp, với các kết nối residual ("skip") giúp gradient chảy xuyên suốt một mạng rất sâu mà không bị mất mát. Dự án này fine-tune một bản đã pretrain trên ImageNet (transfer learning) thay vì train lại từ đầu.',
      'about.dl.resnetTooltip': '<p>Thay vì tự tay thiết kế feature, một mạng neural tích chập (CNN) 18 lớp tự học lấy đặc trưng riêng, nhờ các kết nối "tắt" (residual) giúp thông tin đi xuyên qua mạng sâu mà không bị rớt mất. Mình fine-tune từ một bản đã pretrain trên ImageNet chứ không train lại từ đầu.</p><p style="margin:0 0 4px;"><a href="https://arxiv.org/abs/1512.03385" target="_blank" rel="noopener">↗ Bài báo gốc (arXiv)</a></p><p style="margin:0;"><a href="https://pytorch.org/vision/stable/models/resnet.html" target="_blank" rel="noopener">↗ Tài liệu PyTorch / torchvision</a></p>',
      'about.dl.gradcamTitle': 'GRAD-CAM',
      'about.dl.gradcamDesc': 'Mọi dự đoán của ResNet18 ở 02_SÂN_THỬ đều đi kèm một heatmap Grad-CAM — cách để xem chính xác những pixel nào đã đẩy model tới kết luận đó, thay vì chỉ tin vào con số confidence một cách mù quáng.',
      'about.dl.gradcamTooltip': '<p>Mỗi lần ResNet18 đưa ra dự đoán ở 02_SÂN_THỬ, sẽ có kèm một heatmap Grad-CAM — cho thấy chính xác pixel nào khiến model nghiêng về kết luận đó, thay vì chỉ tin mù quáng vào con số confidence.</p><p style="margin:0;"><a href="https://arxiv.org/abs/1610.02391" target="_blank" rel="noopener">↗ Bài báo gốc (arXiv)</a></p>',

      'about.footer.cta': '&rarr; 02_SÂN_THỬ — chọn một model và xem nó phân loại một tấm ảnh thật',
      'footer.about1': 'PEOTRAN_QC.EXE v1.0 — giới thiệu về bộ dữ liệu và cách tiếp cận đứng sau mọi con số trên trang này',

      'methodology.title': 'PHƯƠNG PHÁP',
      'methodology.subtitle': 'các số liệu này được tạo ra thế nào',
      'methodology.stat1': 'ẢNH TEST<br>tách riêng trước khi train',
      'methodology.stat2': 'ẢNH TRÙNG LẶP<br>bị lọt vào tập train',
      'methodology.stat3': 'MODEL<br>được train lại từ đầu',
      'methodology.flow1': 'ẢNH TRAIN',
      'methodology.flow2': 'SO KHỚP VỚI ẢNH TEST',
      'methodology.flow3': '64 ẢNH TRÙNG LẶP',
      'methodology.flow4': 'LOẠI KHỎI TẬP TRAIN',
      'methodology.flow5': 'TRAIN LẠI CẢ 22 MODEL',
      'methodology.pipeline': '<strong>715 ảnh test</strong> được tách riêng <strong>từ trước khi train bất kỳ model nào trong số 22 model</strong>, nên không model nào từng thấy các ảnh này lúc train. Mọi số liệu trên trang này đều được đo trên đúng 715 ảnh test đó.',
      'methodology.leakage': 'Trước khi công bố, từng ảnh test đã được so khớp với từng ảnh train để tìm ảnh bị trùng lặp ngoài ý muốn. Phát hiện <strong>64 ảnh trùng lặp</strong> nằm trong tập train — đã loại bỏ, rồi <strong>train lại cả 22 model từ đầu</strong>. Bảng bên dưới cho thấy kết quả thay đổi thế nào.',
      'methodology.leakageDetailsBtn': '(i) CÁCH TÌM RA ẢNH TRÙNG LẶP',
      'methodology.leakageDetailsBody': '<ul><li>Mọi ảnh train và test đều được băm bằng <strong>MD5</strong> — một dấu vân tay tính từ đúng nội dung byte của file.</li><li>Có một bước <strong>lọc theo kích thước file</strong> chạy trước để tiết kiệm thời gian — chỉ những file cùng kích thước mới được đem đi băm và so sánh, nên việc kiểm tra vẫn nhanh dù có hàng ngàn ảnh.</li><li>Chỉ tính là trùng lặp khi <strong>giống hệt nhau từng byte</strong> — tức đúng một tấm ảnh được lưu 2 lần, chứ không chỉ là "nhìn giống nhau".</li><li class="muted">Các ảnh trùng chỉ bị chuyển ra khỏi train/ vào một thư mục backup riêng chứ không hề bị xóa, và tập test hoàn toàn không bị đụng tới.</li></ul>',
      'leakageTable.title': 'ĐỘ CHÍNH XÁC TRƯỚC → SAU KHI LÀM SẠCH',
      'leakageTable.subtitle': 'Cả 22 model, cùng 715 ảnh test, trước vs. sau khi loại bỏ 64 ảnh trùng lặp.',
      'leakageTable.before': 'TRƯỚC',
      'leakageTable.after': 'SAU',
      'leakageTable.delta': 'Δ',
      'leakageTable.summary': 'Thay đổi trung bình: <strong>{mean} điểm %</strong> trên cả 22 model (đa số giảm nhẹ — 64 ảnh trùng lặp đó từng làm tăng ảo độ chính xác của một số model). Giảm nhiều nhất: <strong>{worstModel}</strong> với <strong>{worst} điểm %</strong>. Hai model được nhắc đến nhiều nhất, Histogram+SVM và ResNet18, gần như không đổi.',

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
      'trainingCurve.note': 'Checkpoint tốt nhất: epoch <strong>{epoch}</strong>, F1 validation {f1}. F1 trên tập validation luôn nằm trong khoảng hẹp 0,991–0,998 suốt quá trình train, bám sát độ chính xác lúc train — không có dấu hiệu overfitting.',
      'brightness.title': 'PHÂN BỐ ĐỘ SÁNG',
      'brightness.subtitle': 'def_front vs ok_front · tập test, 715 ảnh · box plot',
      'brightness.note': 'Độ sáng trung vị: <strong>{def}</strong> ở def_front so với <strong>{ok}</strong> ở ok_front (thang xám 0–255). Xem mục GIỚI HẠN ĐÃ BIẾT bên dưới để hiểu điều này ảnh hưởng thế nào đến độ tin cậy của các model.',
      'umap.title': 'UMAP EMBEDDINGS',
      'umap.subtitle': 'tập test, 715 ảnh · không gian đặc trưng chiếu xuống 2 chiều',
      'umap.histogramTitle': 'FEATURE HISTOGRAM (256 CHIỀU)',
      'umap.resnetTitle': 'FEATURE RESNET18 (512 CHIỀU)',
      'umap.legendDef': 'def_front',
      'umap.legendOk': 'ok_front',
      'umap.legendWrong': 'đoán sai',
      'umap.note': 'Không gian 256 chiều của Histogram vẫn xen kẽ 2 lớp với nhau; không gian 512 chiều của ResNet18 thì tách thành 2 cụm rõ ràng, gần như không chồng lấn. Số ảnh đoán sai: <strong>{histWrong}</strong> với Histogram, <strong>{resnetWrong}</strong> với ResNet18.',
      'umap.missing': 'Chưa xuất tọa độ UMAP — chạy cell export ở mục 9 trong 07_error_analysis.ipynb để có biểu đồ này.',
      'sourceFigures.title': 'ẢNH GỐC TỪ NOTEBOOK',
      'sourceFigures.intro': 'Mọi biểu đồ trên trang này, kể cả UMAP, đều được vẽ trực tiếp từ số liệu thật, không phải ảnh chụp dán vào — nhờ vậy chúng tương tác được và đồng bộ phong cách với phần còn lại của trang. Ảnh mẫu và ảnh minh họa edge/HOG bên dưới là ngoại lệ, vì chúng vốn không phải biểu đồ ngay từ đầu. Muốn xem đúng kết quả matplotlib như khi chạy trong notebook 01–09 — làm bằng chứng, không phải vẽ lại — thì mở gallery bên dưới.',
      'sourceFigures.confusionNoteBtn': '(i) VÌ SAO CONFUSION MATRIX CỦA HISTOGRAM+SVM NHÌN KHÁC',
      'sourceFigures.confusionNoteBody': '<p style="margin:0 0 8px;">Có một ảnh trong gallery là ngoại lệ một phần so với ghi chú ở trên: ảnh <strong>Confusion matrix — Histogram+SVM</strong> lấy thẳng từ <code>04_classical_ml.ipynb</code>, nhưng cell đó chạy trên một tập <strong>validation</strong> nội bộ được tách ra từ dữ liệu train — chỉ dùng để chọn ra tổ hợp feature + classifier tốt nhất, trước khi train model cuối cùng.</p><p style="margin:0;">Nếu bấm vào đúng dòng model đó trong bảng MODEL COMPARISON bên dưới, bạn sẽ thấy một confusion matrix khác, <strong>tính trực tiếp (live)</strong> — cái đó được tính từ đúng <strong>715 ảnh test</strong> giữ riêng ra, cùng số liệu đứng sau mọi biểu đồ khác trên trang này. Hai cái này vốn dĩ sẽ khác nhau — không phải lỗi, chỉ là 2 tập dữ liệu khác nhau cho 2 mục đích khác nhau.</p>',
      'sourceFigures.btn': 'XEM 11 ẢNH GỐC',
      'sourceFigures.btnHint': 'Mở 11 ảnh chụp gốc từ notebook.',
      'evidence.label': 'Từ notebook:',
      'advisoryLog.title': 'GIỚI HẠN ĐÃ BIẾT & NHẬT KÝ CẢNH BÁO',
      'advisoryLog.subtitle': 'rê chuột vào (i) để xem chi tiết',
      'advisoryLog.fullWriteup': '(i) XEM CHI TIẾT',
      'advisory.brightness.title': 'ĐỘ SÁNG GÂY NHIỄU (TẤT CẢ MODEL)',
      'advisory.brightness.short': 'Ảnh def_front tối hơn khoảng 10–11 mức sáng; độ chính xác tụt xuống còn ~63–73% khi cân bằng độ sáng.',
      'advisory.brightness.full': '<p><strong>Ảnh def_front tối hơn ok_front trung bình ~10–11 mức sáng</strong> (p ≈ 0, n = 7.284) — <em>nhiều khả năng là do ánh sáng/cách chụp</em>, không phải do bản thân lỗi sản phẩm.</p><ul><li>Cân bằng độ sáng (LAB equalization) vẫn làm độ chính xác tụt mạnh ở <em>cả hai</em> loại model, nhưng sau khi train lại trên dữ liệu đã làm sạch, ResNet18 giờ chống chịu tốt hơn hẳn model classical:</li></ul><table class="data-table"><thead><tr><th>MODEL</th><th>GỐC</th><th>ĐÃ CÂN BẰNG</th><th>MỨC TỤT</th></tr></thead><tbody><tr><td>Histogram + SVM</td><td>99.86%</td><td>63.36%</td><td>&minus;36.50 điểm</td></tr><tr><td>ResNet18</td><td>99.72%</td><td>72.73%</td><td>&minus;26.99 điểm</td></tr></tbody></table><ul><li>ResNet18 tụt ít hơn khoảng 9,5 điểm so với model classical khi độ sáng bị làm phẳng — một lợi thế chống chịu thật sự (dù chỉ một phần) mà lượt chạy cũ (còn leakage) không cho thấy.</li><li>Grad-CAM và UMAP đều cho thấy ResNet18 không <em>chỉ</em> dựa vào độ sáng để đoán, khớp với lợi thế này — nhưng nó vẫn dựa khá nhiều vào yếu tố nhiễu đó.</li><li><strong>Không nên mặc định độ chính xác ~99,7–99,9% của cả hai model</strong> sẽ giữ nguyên khi đổi điều kiện ánh sáng/phơi sáng, nếu chưa kiểm tra hoặc augment thêm.</li><li class="muted">Chưa khắc phục ở bản v1 — bước tiếp theo hợp lý là augment độ sáng/tương phản lúc train.</li></ul>',
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
      'fig.confusionSvm': 'Confusion matrix — Histogram+SVM (tập validation, không phải tập test cuối)',
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
     Native SVG scatter plot (used for the UMAP embeddings). opts:
     { width, height, points: [{x,y,color,misclassified}], xLabel, yLabel,
       legend: [{label,color,shape:'dot'|'x'}], ariaLabel }
     Correct points draw as small translucent dots, misclassified points as
     a bold X in the same color - same visual language matplotlib's
     scatter() + marker="x" used in the original notebook figure.
     --------------------------------------------------------------------- */

  function drawScatterChart(container, opts) {
    if (!container) return;
    var W = opts.width || 420, H = opts.height || 340;
    var padL = 14, padR = 14, padT = 14, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var points = opts.points || [];
    var xs = points.map(function (p) { return p.x; });
    var ys = points.map(function (p) { return p.y; });
    var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
    var yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    var xSpan = (xMax - xMin) || 1, ySpan = (yMax - yMin) || 1;
    var xPad = xSpan * 0.08, yPad = ySpan * 0.08;
    xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;
    xSpan = xMax - xMin; ySpan = yMax - yMin;

    function xPos(v) { return padL + ((v - xMin) / xSpan) * plotW; }
    function yPos(v) { return padT + plotH - ((v - yMin) / ySpan) * plotH; }

    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'native-chart', role: 'img', 'aria-label': opts.ariaLabel || 'scatter plot' });
    svg.appendChild(svgEl('rect', { x: padL, y: padT, width: plotW, height: plotH, fill: 'none', class: 'chart-axis' }));

    var correctPts = points.filter(function (p) { return !p.misclassified; });
    var wrongPts = points.filter(function (p) { return p.misclassified; });

    correctPts.forEach(function (p) {
      svg.appendChild(svgEl('circle', {
        cx: xPos(p.x), cy: yPos(p.y), r: 2.6, fill: p.color, 'fill-opacity': 0.55, class: 'chart-point',
      }));
    });
    wrongPts.forEach(function (p) {
      var cx = xPos(p.x), cy = yPos(p.y), s = 5.5;
      svg.appendChild(svgEl('line', { x1: cx - s, y1: cy - s, x2: cx + s, y2: cy + s, stroke: p.color, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
      svg.appendChild(svgEl('line', { x1: cx - s, y1: cy + s, x2: cx + s, y2: cy - s, stroke: p.color, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
    });

    container.innerHTML = '';
    container.appendChild(svg);

    if (opts.legend) {
      var legend = document.createElement('div');
      legend.className = 'chart-legend';
      opts.legend.forEach(function (item) {
        var el = document.createElement('span');
        el.className = 'chart-legend-item';
        if (item.shape === 'x') {
          el.innerHTML = '<span class="chart-swatch chart-swatch-x" style="color:' + item.color + '">&times;</span>' + item.label;
        } else {
          el.innerHTML = '<span class="chart-swatch" style="background:' + item.color + '; border-radius:50%;"></span>' + item.label;
        }
        legend.appendChild(el);
      });
      container.appendChild(legend);
    }
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
    drawScatterChart: drawScatterChart,
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
