/* Casting Quality Inspector — Model Stats page logic.
 * Depends on js/ui.js (loaded first) for the shared tooltip/lightbox/i18n
 * helpers. Confusion matrices are computed live, client-side, from the
 * same predictions.json every model's Playground verdicts come from -
 * not a static screenshot, so it's correct for whichever model you open.
 */

(function () {
  'use strict';

  var T = window.CQI.t;

  var models = [];
  var images = [];
  var predictions = {};
  var sortKey = 'test_f1';
  var sortDir = -1; // -1 = descending
  var openModelId = null; // whichever model's modal is currently open, if any
  var cmSelectedModelId = null; // model shown in the inline confusion-matrix panel

  /* Same rounding-safe formatter as app.js: never displays a near-100%
   * value as a misleadingly-round "100.00%" unless it truly is 1.0. */
  function pct(x) {
    var p = x * 100;
    var decimals = 2;
    while (decimals < 6 && p < 100 && parseFloat(p.toFixed(decimals)) >= 100) {
      decimals++;
    }
    return p.toFixed(decimals) + '%';
  }

  function loadData() {
    Promise.all([
      fetch('data/models.json').then(function (r) { return r.json(); }),
      fetch('data/images.json').then(function (r) { return r.json(); }),
      fetch('data/predictions.json').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      models = results[0];
      images = results[1];
      predictions = results[2];

      document.getElementById('stat-models').textContent = 'MODELS LOADED: ' + models.length;
      renderAll();
    }).catch(function (err) {
      document.getElementById('model-table-body').innerHTML =
        '<tr><td colspan="9" style="color:var(--def);">FAILED TO LOAD DATA: ' + err + '</td></tr>';
      console.error(err);
    });
  }

  /* Re-runs every render function - used on first load and again whenever
     the language or theme changes, since the native SVG charts bake their
     colors and labels into the markup at draw time rather than reading
     CSS at paint time. */
  function renderAll() {
    renderTable();
    renderChart();
    renderDatasetOverview();
    renderFeatureTable();
    renderConfusionPanel();
    renderTrainingCurve();
    renderBrightnessBoxplot();
    renderEvidenceStrips();
    if (openModelId && window.modelsById()[openModelId]) {
      openModal(window.modelsById()[openModelId]);
    }
  }

  window.modelsById = function () {
    var map = {};
    models.forEach(function (m) { map[m.model_id] = m; });
    return map;
  };

  function sortedModels() {
    var copy = models.slice();
    copy.sort(function (a, b) {
      var av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'boolean') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (typeof av === 'string') return sortDir * av.localeCompare(bv);
      return sortDir * ((av > bv) - (av < bv));
    });
    return copy;
  }

  function renderTable() {
    var tbody = document.getElementById('model-table-body');
    tbody.innerHTML = '';

    sortedModels().forEach(function (m, i) {
      var tr = document.createElement('tr');
      if (m.type === 'deep_learning') tr.className = 'dl-row';

      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td>' + m.display_name + '</td>' +
        '<td>' + (m.type === 'deep_learning' ? T('type.cnn') : T('type.ml')) + '</td>' +
        '<td>' + barCell(m.test_accuracy) + '</td>' +
        '<td>' + pct(m.test_precision) + '</td>' +
        '<td>' + pct(m.test_recall) + '</td>' +
        '<td>' + pct(m.test_f1) + '</td>' +
        '<td>' + m.test_roc_auc.toFixed(4) + '</td>' +
        '<td>' + (m.supports_gradcam ? T('field.yes').toUpperCase() : '--') + '</td>';

      tr.addEventListener('click', function () { openModal(m); });
      tbody.appendChild(tr);
    });

    updateHeaderArrows();
    // Bars start at width:0 in CSS and animate to their real width once
    // painted, so the table's first render reads as a small "grow in".
    requestAnimationFrame(function () {
      tbody.querySelectorAll('.bar-fill[data-w]').forEach(function (el) {
        el.style.width = el.dataset.w;
      });
    });
  }

  function barCell(value) {
    return '<div class="bar-cell"><span class="mono-num">' + pct(value) + '</span>' +
      '<div class="bar-track"><div class="bar-fill" data-w="' + (value * 100) + '%"></div></div></div>';
  }

  function updateHeaderArrows() {
    var ths = document.querySelectorAll('#model-table thead th');
    ths.forEach(function (th) {
      th.querySelectorAll('.arrow').forEach(function (a) { a.remove(); });
      if (th.dataset.key === sortKey) {
        var arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = sortDir === 1 ? '▲' : '▼';
        th.appendChild(arrow);
      }
    });
  }

  document.querySelectorAll('#model-table thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.dataset.key;
      if (key === 'rank') return;
      if (sortKey === key) { sortDir *= -1; } else { sortKey = key; sortDir = -1; }
      renderTable();
    });
  });

  /* ---------------------------------------------------------------------
     Chart
     --------------------------------------------------------------------- */

  function renderChart() {
    var container = document.getElementById('chart-body');
    container.innerHTML = '';

    var ranked = models.slice().sort(function (a, b) { return b.test_accuracy - a.test_accuracy; });
    var max = ranked[0].test_accuracy;

    ranked.forEach(function (m) {
      var row = document.createElement('div');
      row.className = 'chart-row' + (m.type === 'deep_learning' ? ' dl' : '');

      var label = document.createElement('div');
      label.className = 'chart-label';
      label.textContent = m.display_name;

      var track = document.createElement('div');
      track.className = 'chart-track';
      var fill = document.createElement('div');
      fill.className = 'chart-fill';
      fill.dataset.w = (m.test_accuracy / max * 100) + '%';
      track.appendChild(fill);

      var value = document.createElement('div');
      value.className = 'mono-num';
      value.style.textAlign = 'right';
      value.textContent = pct(m.test_accuracy);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(value);
      container.appendChild(row);
    });

    requestAnimationFrame(function () {
      container.querySelectorAll('.chart-fill[data-w]').forEach(function (el) {
        el.style.width = el.dataset.w;
      });
    });
  }

  /* ---------------------------------------------------------------------
     Dataset overview (native bar chart, computed from images.json)
     --------------------------------------------------------------------- */

  function renderDatasetOverview() {
    var container = document.getElementById('dataset-overview-body');
    container.innerHTML = '';

    var counts = { def_front: 0, ok_front: 0 };
    images.forEach(function (img) { counts[img.true_label] = (counts[img.true_label] || 0) + 1; });
    var total = images.length;
    var max = Math.max(counts.def_front, counts.ok_front);

    var rows = [
      { label: T('datasetOverview.defective'), n: counts.def_front, cls: 'dl' },
      { label: T('datasetOverview.ok'), n: counts.ok_front, cls: '' },
    ];

    rows.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'chart-row' + (r.cls ? ' ' + r.cls : '');

      var label = document.createElement('div');
      label.className = 'chart-label';
      label.textContent = r.label;

      var track = document.createElement('div');
      track.className = 'chart-track';
      var fill = document.createElement('div');
      fill.className = 'chart-fill';
      fill.dataset.w = (r.n / max * 100) + '%';
      track.appendChild(fill);

      var value = document.createElement('div');
      value.className = 'mono-num';
      value.style.textAlign = 'right';
      value.textContent = r.n + ' (' + (r.n / total * 100).toFixed(1) + '%)';

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(value);
      container.appendChild(row);
    });

    requestAnimationFrame(function () {
      container.querySelectorAll('.chart-fill[data-w]').forEach(function (el) {
        el.style.width = el.dataset.w;
      });
    });
  }

  /* ---------------------------------------------------------------------
     Classical: feature x classifier table (native, computed from
     models.json - the same numbers behind 04_classical_ml's chart,
     redrawn in the site's own style instead of matplotlib's default one).
     --------------------------------------------------------------------- */

  function renderFeatureTable() {
    var container = document.getElementById('feature-table-body');
    container.innerHTML = '';

    var classical = models.filter(function (m) { return m.type === 'classical'; });
    var byFeature = {};
    classical.forEach(function (m) {
      if (!byFeature[m.feature]) byFeature[m.feature] = {};
      byFeature[m.feature][m.classifier] = m;
    });

    var classifiers = ['Logistic Regression', 'Random Forest', 'SVM'];
    var clfClass = { 'Logistic Regression': 'clf-a', 'Random Forest': 'clf-b', 'SVM': 'clf-c' };

    var table = document.createElement('table');
    table.className = 'data-table';
    var thead = '<thead><tr><th>' + T('col.feature') + '</th>' + classifiers.map(function (c) {
      return '<th style="cursor:default;">' + c.toUpperCase() + '</th>';
    }).join('') + '</tr></thead>';

    var rows = Object.keys(byFeature).sort().map(function (feature) {
      var cells = classifiers.map(function (c) {
        var m = byFeature[feature][c];
        if (!m) return '<td>&mdash;</td>';
        return '<td><div class="bar-cell"><span class="mono-num">' + pct(m.test_f1) + '</span>' +
          '<div class="bar-track"><div class="bar-fill ' + clfClass[c] + '" data-w="' + (m.test_f1 * 100) + '%"></div></div></div></td>';
      }).join('');
      return '<tr><td>' + feature + '</td>' + cells + '</tr>';
    }).join('');

    table.innerHTML = thead + '<tbody>' + rows + '</tbody>';
    container.appendChild(table);

    requestAnimationFrame(function () {
      container.querySelectorAll('.bar-fill[data-w]').forEach(function (el) {
        el.style.width = el.dataset.w;
      });
    });
  }

  /* ---------------------------------------------------------------------
     ResNet18 training curve (native SVG line chart).
     These are the exact per-epoch numbers 05_deep_learning.ipynb logged
     while training the checkpoint this site actually serves - not a
     re-run, not simulated. There's no epoch-level history for the
     classical models (they don't train over epochs), so this chart only
     applies to ResNet18.
     --------------------------------------------------------------------- */

  var TRAINING_HISTORY = {
    epochs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    train_loss: [0.0877, 0.0186, 0.0176, 0.0115, 0.0102, 0.0204, 0.0121, 0.0089, 0.0082, 0.0105],
    train_accuracy: [0.9670, 0.9953, 0.9938, 0.9962, 0.9962, 0.9925, 0.9960, 0.9972, 0.9972, 0.9960],
    val_f1: [0.9954, 0.9977, 0.9985, 0.9985, 0.9568, 0.9992, 0.9985, 0.9985, 0.9962, 0.9962],
    best_epoch: 6,
    best_val_f1: 0.9992,
  };

  function renderTrainingCurve() {
    var container = document.getElementById('training-curve-body');
    if (!container) return;
    container.innerHTML =
      '<div class="chart-block"><div class="chart-block-title">' + T('trainingCurve.lossTitle') + '</div><div id="tc-loss"></div></div>' +
      '<div class="chart-block"><div class="chart-block-title">' + T('trainingCurve.accTitle') + '</div><div id="tc-acc"></div></div>';

    var epochLabels = TRAINING_HISTORY.epochs.map(function (e) { return 'E' + e; });

    window.CQI.drawLineChart(document.getElementById('tc-loss'), {
      width: 860, height: 320,
      xLabels: epochLabels,
      series: [{ label: T('trainingCurve.lossLegend'), color: getCssVar('--def'), values: TRAINING_HISTORY.train_loss }],
      yTickFormat: function (v) { return v.toFixed(2); },
      ariaLabel: 'ResNet18 training loss per epoch',
    });

    window.CQI.drawLineChart(document.getElementById('tc-acc'), {
      width: 860, height: 320,
      xLabels: epochLabels,
      series: [
        { label: T('trainingCurve.trainAccLegend'), color: getCssVar('--clf-a'), values: TRAINING_HISTORY.train_accuracy },
        { label: T('trainingCurve.valF1Legend'), color: getCssVar('--ok'), values: TRAINING_HISTORY.val_f1 },
      ],
      yTickFormat: function (v) { return (v * 100).toFixed(0) + '%'; },
      ariaLabel: 'ResNet18 train accuracy and validation F1 per epoch',
    });

    var note = document.createElement('p');
    note.className = 'muted';
    note.style.cssText = 'margin:8px 0 0; font-size:10px; text-align:center;';
    note.innerHTML = T('trainingCurve.note', { epoch: TRAINING_HISTORY.best_epoch, f1: pct(TRAINING_HISTORY.best_val_f1) });
    container.appendChild(note);
  }

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#333';
  }

  /* ---------------------------------------------------------------------
     Brightness distribution box plot (native SVG).
     Real per-image grayscale-mean brightness, computed directly from all
     715 held-out test images (the same ones images.json lists) - not a
     re-plot of a cached figure. Quartiles/whiskers use the standard
     1.5xIQR convention. This is the same confound the advisory row below
     describes; the box plot is the visual evidence for it.
     --------------------------------------------------------------------- */

  var BRIGHTNESS_STATS = {
    def_front: { n: 453, min: 125.6, q1: 135.16, median: 138.41, q3: 141.99, max: 156.27, whisker_lo: 125.6, whisker_hi: 152.06, mean: 138.86, outliers: [152.24, 152.53, 152.74, 152.81, 152.91, 153.02, 153.12, 153.17, 154.81, 156.27] },
    ok_front: { n: 262, min: 132.24, q1: 141.87, median: 151.29, q3: 153.7, max: 158.66, whisker_lo: 132.24, whisker_hi: 158.66, mean: 148.88, outliers: [] },
  };

  function renderBrightnessBoxplot() {
    var container = document.getElementById('brightness-boxplot-body');
    if (!container) return;
    container.innerHTML = '<div class="chart-block" id="bp-chart"></div>';

    window.CQI.drawBoxPlot(document.getElementById('bp-chart'), {
      width: 860, height: 320,
      groups: [
        { label: 'def_front (n=' + BRIGHTNESS_STATS.def_front.n + ')', color: getCssVar('--def'), stats: BRIGHTNESS_STATS.def_front },
        { label: 'ok_front (n=' + BRIGHTNESS_STATS.ok_front.n + ')', color: getCssVar('--ok'), stats: BRIGHTNESS_STATS.ok_front },
      ],
      yTickFormat: function (v) { return v.toFixed(0); },
      ariaLabel: 'Grayscale brightness mean, def_front vs ok_front, test set',
    });

    var note = document.createElement('p');
    note.className = 'muted';
    note.style.cssText = 'margin:8px 0 0; font-size:10px; text-align:center;';
    note.innerHTML = T('brightness.note', {
      def: BRIGHTNESS_STATS.def_front.median.toFixed(1),
      ok: BRIGHTNESS_STATS.ok_front.median.toFixed(1),
    });
    container.appendChild(note);
  }

  /* ---------------------------------------------------------------------
     Evidence strips - the real notebook screenshot(s) most relevant to
     each native chart above, shown right under it (not just hidden behind
     the single gallery button). Every thumbnail opens the SAME shared
     gallery at its own index, so prev/next still cycles all 11.
     --------------------------------------------------------------------- */

  function getFigures() {
    return [
      { src: 'assets/figures/class_distribution.png', caption: T('fig.classDist'), source: '01_EDA.ipynb' },
      { src: 'assets/figures/sample_defective.png', caption: T('fig.sampleDef'), source: '01_EDA.ipynb' },
      { src: 'assets/figures/sample_ok.png', caption: T('fig.sampleOk'), source: '01_EDA.ipynb' },
      { src: 'assets/figures/sobel_edges.png', caption: T('fig.sobel'), source: '03_classical_features.ipynb' },
      { src: 'assets/figures/hog_visualization.png', caption: T('fig.hog'), source: '03_classical_features.ipynb' },
      { src: 'assets/figures/feature_comparison.png', caption: T('fig.featureCompare'), source: '04_classical_ml.ipynb' },
      { src: 'assets/figures/confusion_matrix_svm.png', caption: T('fig.confusionSvm'), source: '04_classical_ml.ipynb' },
      { src: 'assets/figures/resnet18_training.png', caption: T('fig.resnetTraining'), source: '05_deep_learning.ipynb' },
      { src: 'assets/figures/unified_comparison.png', caption: T('fig.unifiedCompare'), source: '06_model_testing.ipynb' },
      { src: 'assets/figures/brightness_confound.png', caption: T('fig.brightnessBox'), source: '07_error_analysis.ipynb' },
      { src: 'assets/figures/umap_embeddings.png', caption: T('fig.umap'), source: '07_error_analysis.ipynb' },
    ];
  }

  function buildEvidenceStrip(containerId, indexes) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var figures = getFigures();
    container.innerHTML = '<span class="evidence-label">' + T('evidence.label') + '</span>';
    indexes.forEach(function (idx) {
      var fig = figures[idx];
      var thumb = document.createElement('div');
      thumb.className = 'evidence-thumb';
      thumb.innerHTML = '<img src="' + fig.src + '" alt="' + fig.caption + '">' +
        '<div class="evidence-caption">' + fig.caption + '</div>';
      thumb.querySelector('img').addEventListener('click', function () {
        window.CQI.openLightbox(figures, idx);
      });
      container.appendChild(thumb);
    });
  }

  function renderEvidenceStrips() {
    // indexes into getFigures(), matched to the panel each strip sits under.
    // The feature-comparison chart, the resnet18 training-curve screenshot,
    // and the brightness box-plot screenshot were dropped from here - each
    // one just duplicates a chart the page already draws live right above
    // it (the feature table, the training-curve line chart, the box plot).
    // They're still available in the SOURCE FIGURES panel for reference.
    buildEvidenceStrip('evidence-features', [3, 4]);   // sobel, hog
    buildEvidenceStrip('evidence-brightness', [1, 2]);  // sample def/ok photos
  }

  /* ---------------------------------------------------------------------
     Live confusion matrix - computed from real per-image predictions, so
     it's correct for any of the 22 models, not just one screenshot.
     --------------------------------------------------------------------- */

  function computeConfusion(modelId) {
    var tp = 0, fp = 0, fn = 0, tn = 0, missing = 0;
    images.forEach(function (img) {
      var pred = (predictions[img.id] || {})[modelId];
      if (!pred) { missing++; return; }
      var actualPos = img.true_label === 'def_front';
      var predPos = pred.pred === 'def_front';
      if (actualPos && predPos) tp++;
      else if (actualPos && !predPos) fn++;
      else if (!actualPos && predPos) fp++;
      else tn++;
    });
    return { tp: tp, fp: fp, fn: fn, tn: tn, total: images.length - missing };
  }

  function confusionGridHtml(modelId) {
    var c = computeConfusion(modelId);
    if (!c.total) return '<p class="muted" style="margin:0;">' + T('cg.empty') + '</p>';
    function cell(n, cls) {
      return '<div class="cg-cell ' + cls + '">' + n + '<span class="cg-pct">' + (n / c.total * 100).toFixed(1) + '%</span></div>';
    }
    return (
      '<div class="confusion-grid">' +
        '<div class="cg-corner"></div>' +
        '<div class="cg-head">' + T('cg.predDef') + '</div>' +
        '<div class="cg-head">' + T('cg.predOk') + '</div>' +
        '<div class="cg-rowhead">' + T('cg.actDef') + '</div>' +
        cell(c.tp, 'hit') + cell(c.fn, 'miss') +
        '<div class="cg-rowhead">' + T('cg.actOk') + '</div>' +
        cell(c.fp, 'miss') + cell(c.tn, 'hit') +
      '</div>' +
      '<p class="muted" style="margin:6px 0 0; font-size:10px;">' + T('cg.note', { n: c.total }) + '</p>'
    );
  }

  /* Inline confusion-matrix panel (main page, not the modal) - a model
     picker plus the same live confusion-grid used in the modal, so the
     matrix is visible without having to open a row's full spec first.
     Defaults to whichever model has the best test F1. */
  function renderConfusionPanel() {
    var select = document.getElementById('cm-model-select');
    var container = document.getElementById('cm-container');
    if (!select || !container || !models.length) return;

    if (!cmSelectedModelId || !window.modelsById()[cmSelectedModelId]) {
      var best = models.slice().sort(function (a, b) { return b.test_f1 - a.test_f1; })[0];
      cmSelectedModelId = best.model_id;
    }

    select.innerHTML = models.slice().sort(function (a, b) { return b.test_f1 - a.test_f1; }).map(function (m) {
      return '<option value="' + m.model_id + '"' + (m.model_id === cmSelectedModelId ? ' selected' : '') + '>' +
        m.display_name + '</option>';
    }).join('');

    container.innerHTML = confusionGridHtml(cmSelectedModelId);

    if (!select.dataset.wired) {
      select.dataset.wired = '1';
      select.addEventListener('change', function (e) {
        cmSelectedModelId = e.target.value;
        container.innerHTML = confusionGridHtml(cmSelectedModelId);
      });
    }
  }

  /* ---------------------------------------------------------------------
     Modal
     --------------------------------------------------------------------- */

  function buildDl(rows) {
    var dl = document.createElement('dl');
    rows.forEach(function (pair) {
      var dt = document.createElement('dt'); dt.textContent = pair[0];
      var dd = document.createElement('dd'); dd.textContent = pair[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    return dl;
  }

  function openModal(m) {
    openModelId = m.model_id;
    document.getElementById('modal-title').textContent = m.display_name.toUpperCase();

    var overview = [
      [T('field.modelId'), m.model_id],
      [T('field.type'), m.type === 'deep_learning' ? T('field.typeDl') : T('field.typeClassical')],
    ];
    if (m.type === 'classical') {
      overview.push([T('field.feature'), m.feature + ' (' + m.feature_dim + '-dim)']);
      overview.push([T('field.featureDesc'), m.feature_description]);
      overview.push([T('field.classifier'), m.classifier]);
    } else {
      overview.push([T('field.architecture'), m.architecture]);
    }
    overview.push([T('field.testAcc'), pct(m.test_accuracy)]);
    overview.push([T('field.testPrec'), pct(m.test_precision)]);
    overview.push([T('field.testRecall'), pct(m.test_recall)]);
    overview.push([T('field.testF1'), pct(m.test_f1)]);
    overview.push([T('field.testRocAuc'), m.test_roc_auc.toFixed(4)]);
    overview.push([T('field.gradcamSupport'), m.supports_gradcam ? T('field.yes') : T('field.no')]);
    overview.push([T('field.confCalibrated'), m.confidence_is_calibrated ? T('field.yes') : T('field.noMargin')]);
    overview.push([T('field.weightsFile'), m.weights_path]);

    var hyperparams = m.type === 'classical' ? (m.classifier_hyperparameters || {}) : (m.hyperparameters || {});
    var paramRows = Object.keys(hyperparams).map(function (k) { return [k, hyperparams[k]]; });

    var body = document.getElementById('modal-body');
    body.innerHTML = '';

    var overviewHeader = document.createElement('div');
    overviewHeader.className = 'spec-section';
    overviewHeader.textContent = T('modal.overview');
    body.appendChild(overviewHeader);
    body.appendChild(buildDl(overview));

    if (paramRows.length) {
      var paramHeader = document.createElement('div');
      paramHeader.className = 'spec-section';
      paramHeader.textContent = T('modal.parameters');
      body.appendChild(paramHeader);
      body.appendChild(buildDl(paramRows));
    }

    var cmHeader = document.createElement('div');
    cmHeader.className = 'spec-section';
    cmHeader.textContent = T('modal.confusion');
    body.appendChild(cmHeader);
    var cmWrap = document.createElement('div');
    cmWrap.innerHTML = confusionGridHtml(m.model_id);
    body.appendChild(cmWrap);

    var backdrop = document.getElementById('modal-backdrop');
    var wasHidden = backdrop.hidden;
    backdrop.hidden = false;
    if (wasHidden) requestAnimationFrame(function () { backdrop.classList.add('show'); });
  }

  function closeModal() {
    openModelId = null;
    var backdrop = document.getElementById('modal-backdrop');
    backdrop.classList.remove('show');
    window.setTimeout(function () { backdrop.hidden = true; }, 160);
  }

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', function (e) {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !document.getElementById('modal-backdrop').hidden) closeModal();
  });

  document.getElementById('btn-view-figures').addEventListener('click', function () {
    window.CQI.openLightbox(getFigures(), 0);
  });

  document.getElementById('btn-lang-toggle').addEventListener('click', window.CQI.toggleLang);
  document.getElementById('btn-theme-toggle').addEventListener('click', window.CQI.toggleTheme);

  window.addEventListener('cqi:langchange', function () {
    document.getElementById('stat-models').textContent = 'MODELS LOADED: ' + models.length;
    renderAll();
  });
  window.addEventListener('cqi:themechange', function () {
    // Only the two native SVG charts bake colors into drawn attributes -
    // everything else is plain CSS and repaints on its own.
    if (models.length) { renderTrainingCurve(); renderBrightnessBoxplot(); }
  });

  window.CQI.wireStatusHints('status-hint');

  loadData();
})();
