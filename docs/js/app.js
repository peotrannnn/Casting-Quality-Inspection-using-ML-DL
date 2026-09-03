/* Casting Quality Inspector — Playground page logic.
 * Fully static: reads data/images.json, data/models.json, data/predictions.json
 * (all precomputed by 09_export_web_assets.ipynb) and renders everything
 * client-side. No backend, no build step. Depends on js/ui.js (loaded first)
 * for the shared tooltip/lightbox/i18n/theme helpers.
 */

(function () {
  'use strict';

  var T = window.CQI.t;

  var state = {
    images: [],
    models: [],
    modelsById: {},
    predictions: {},
    currentIndex: 0,
    selectedModelId: null,
    filter: 'all',
    modelTypeFilter: 'all',
    outcomeFilter: 'all',
    confidenceFilter: 'all',
  };

  function pad3(n) { return String(n).padStart(3, '0'); }
  function labelText(l) { return l === 'def_front' ? T('inference.defective') : T('inference.ok'); }

  /* Formats a 0..1 fraction as a percentage string WITHOUT rounding a
   * near-100% value up to a fake-looking "100.0%". Real confidence values
   * here are rarely exactly 1.0 (e.g. 0.9998) - showing that as "100.0%"
   * misrepresents the model as more certain than it actually is, so this
   * adds decimal places as needed until the rounded value stops reading
   * as a full 100% for anything that isn't truly 1.0. */
  function pct(x) {
    var p = x * 100;
    var decimals = 1;
    while (decimals < 6 && p < 100 && parseFloat(p.toFixed(decimals)) >= 100) {
      decimals++;
    }
    return p.toFixed(decimals);
  }

  /* Confidence is read as one of three tiers rather than a fine 0-100
   * scale: <=70% uncertain, >=90% confident, everything in between
   * moderate. */
  function confidenceTier(conf) {
    if (conf >= 0.90) return 'confident';
    if (conf <= 0.70) return 'uncertain';
    return 'moderate';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function matchesFilter(img) {
    if (state.filter !== 'all' && img.true_label !== state.filter) return false;
    if (state.outcomeFilter !== 'all' || state.confidenceFilter !== 'all') {
      var pred = (state.predictions[img.id] || {})[state.selectedModelId];
      if (!pred) return false;
      if (state.outcomeFilter === 'correct' && pred.pred !== img.true_label) return false;
      if (state.outcomeFilter === 'incorrect' && pred.pred === img.true_label) return false;
      if (state.confidenceFilter !== 'all' && confidenceTier(pred.confidence) !== state.confidenceFilter) return false;
    }
    return true;
  }

  function matchesModelType(model) {
    return state.modelTypeFilter === 'all' || model.type === state.modelTypeFilter;
  }

  /* Counts how many records the current filter combination (true label +
   * outcome + confidence, the last two evaluated against whichever model
   * is selected) actually matches, and shows that count - or an explicit
   * "nothing matches" message - right under the filter controls. */
  function updateFilterCount() {
    var n = 0;
    for (var i = 0; i < state.images.length; i++) {
      if (matchesFilter(state.images[i])) n++;
    }
    var el = document.getElementById('filter-match-count');
    if (el && state.images.length) {
      if (n === 0) {
        el.textContent = T('filter.matchCountNone');
        el.className = 'filter-match-count none';
      } else {
        el.textContent = T('filter.matchCount', { n: n });
        el.className = 'filter-match-count';
      }
    }
    return n;
  }

  function dlHtml(rows) {
    return '<dl>' + rows.map(function (pair) {
      return '<dt>' + escapeHtml(pair[0]) + '</dt><dd>' + escapeHtml(pair[1]) + '</dd>';
    }).join('') + '</dl>';
  }

  function modelSpecHtml(m) {
    var overview = [];
    if (m.type === 'classical') {
      overview.push([T('field.feature'), m.feature + ' (' + m.feature_dim + '-dim)']);
      overview.push([T('field.classifier'), m.classifier]);
    } else {
      overview.push([T('field.architecture'), m.architecture || 'ResNet18']);
    }
    overview.push([T('field.testAcc'), pct(m.test_accuracy) + '%']);
    overview.push([T('field.testF1'), pct(m.test_f1) + '%']);
    overview.push([T('col.gradcam'), m.supports_gradcam ? T('field.yes') : T('field.no')]);
    overview.push([T('field.confCalibrated'), m.confidence_is_calibrated === false ? T('field.noMargin') : T('field.yes')]);

    var hyperparams = m.type === 'classical' ? (m.classifier_hyperparameters || {}) : (m.hyperparameters || {});
    var paramRows = Object.keys(hyperparams).map(function (k) { return [k, hyperparams[k]]; });

    var html = '<p style="margin:0 0 6px; font-weight:bold;">' + escapeHtml(m.display_name) + '</p>' +
      '<div class="spec-section">' + T('modal.overview') + '</div>' + dlHtml(overview);

    if (paramRows.length) {
      html += '<div class="spec-section">' + T('modal.parameters') + '</div>' + dlHtml(paramRows);
    }

    html += '<p class="muted" style="margin-top:8px; margin-bottom:0;">' + T('modelSpec.footer') + '</p>';
    return html;
  }

  /* ---------------------------------------------------------------------
     Deep link (?i=<record>&m=<model_id> in the URL hash) - lets a specific
     record + model combination be bookmarked or shared.
     --------------------------------------------------------------------- */

  function readHash() {
    var out = {};
    var raw = location.hash.replace(/^#/, '');
    raw.split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  function updateHash() {
    var h = 'i=' + state.currentIndex + '&m=' + encodeURIComponent(state.selectedModelId || '');
    history.replaceState(null, '', '#' + h);
  }

  /* ---------------------------------------------------------------------
     Data loading
     --------------------------------------------------------------------- */

  function loadData() {
    Promise.all([
      fetch('data/images.json').then(function (r) { return r.json(); }),
      fetch('data/models.json').then(function (r) { return r.json(); }),
      fetch('data/predictions.json').then(function (r) { return r.json(); }),
    ]).then(function (results) {
      state.images = results[0];
      state.models = results[1];
      state.predictions = results[2];
      state.models.forEach(function (m) { state.modelsById[m.model_id] = m; });

      var hash = readHash();
      state.selectedModelId = (hash.m && state.modelsById[hash.m]) ? hash.m : state.models[0].model_id;
      var hi = parseInt(hash.i, 10);
      state.currentIndex = (!isNaN(hi) && hi >= 0 && hi < state.images.length) ? hi : 0;

      document.getElementById('stat-models').textContent = T('status.modelsLoaded') + ': ' + state.models.length;
      document.getElementById('stat-images').textContent = T('status.testRecords') + ': ' + state.images.length;

      renderModelList();
      render();
    }).catch(function (err) {
      document.getElementById('model-list').innerHTML =
        '<div class="loading-line" style="color:var(--def);">FAILED TO LOAD DATA: ' + err + '<br>' +
        '(if you opened this file directly, browsers block local fetch() — serve the docs/ ' +
        'folder with a static server, e.g. `python -m http.server`, or view it via GitHub Pages.)</div>';
      console.error(err);
    });
  }

  /* ---------------------------------------------------------------------
     Model list panel
     --------------------------------------------------------------------- */

  function renderModelList() {
    var container = document.getElementById('model-list');
    container.innerHTML = '';
    window.CQI.hideTooltip();

    state.models.filter(matchesModelType).forEach(function (m) {
      var row = document.createElement('div');
      row.className = 'model-row' + (m.model_id === state.selectedModelId ? ' selected' : '');
      row.dataset.modelId = m.model_id;

      var name = document.createElement('span');
      name.className = 'row-name';
      name.textContent = m.display_name;

      var tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = (m.type === 'deep_learning' ? T('type.cnn') + ' ' : '') + pct(m.test_accuracy) + '%';

      row.appendChild(name);
      row.appendChild(tag);
      row.addEventListener('click', function () {
        state.selectedModelId = m.model_id;
        renderModelList();
        // Outcome/confidence filters are model-specific - jump off a record
        // that no longer qualifies under the newly selected model.
        if (state.images.length && !matchesFilter(state.images[state.currentIndex])) {
          goStep(1);
        } else {
          render();
        }
      });
      row.addEventListener('mouseenter', function () { window.CQI.showTooltip(modelSpecHtml(m), row); });
      row.addEventListener('mouseleave', window.CQI.hideTooltip);

      container.appendChild(row);
    });
  }

  /* ---------------------------------------------------------------------
     Main render
     --------------------------------------------------------------------- */

  function render() {
    if (!state.images.length) return;

    var matchCount = updateFilterCount();

    var img = state.images[state.currentIndex];
    var model = state.modelsById[state.selectedModelId];

    var viewerImg = document.getElementById('viewer-image');
    if (viewerImg.src.indexOf(img.image) === -1) {
      viewerImg.style.opacity = '0';
      var swap = function () {
        viewerImg.src = img.image;
        viewerImg.onload = function () { viewerImg.style.opacity = '1'; };
      };
      window.setTimeout(swap, 90);
    }
    viewerImg.alt = 'Test image, true label ' + img.true_label;
    document.getElementById('viewer-caption').textContent =
      T('recordViewer.caption', { n: pad3(state.currentIndex), total: state.images.length - 1, label: labelText(img.true_label) });
    document.getElementById('record-jump').value = state.currentIndex;

    // Nothing in the dataset satisfies the current filter combination -
    // the record still on screen (state.currentIndex) is left over from
    // before the filter was applied and doesn't actually qualify, so the
    // right-side result panels must show an explicit "nothing" state
    // rather than that stale record's verdict/Grad-CAM.
    if (matchCount === 0) {
      document.getElementById('v-model-name').textContent = model.display_name;
      var vTruthEl = document.getElementById('v-truth');
      vTruthEl.textContent = '--';
      vTruthEl.className = 'verdict-label';
      document.getElementById('v-label').textContent = T('inference.noMatch');
      document.getElementById('v-label').className = 'verdict-label';
      document.getElementById('v-correct').textContent = '--';
      document.getElementById('v-correct').className = 'correctness';
      document.getElementById('v-conf-bar').style.width = '0%';
      document.getElementById('v-conf-pct').textContent = '--%';
      document.getElementById('v-conf-note').innerHTML = '';
      document.getElementById('v-conf-tier').style.display = 'none';
      document.getElementById('gradcam-body').innerHTML =
        '<div class="loading-line">' + T('gradcam.noMatch') + '</div>';
      updateHash();
      return;
    }

    var predSet = state.predictions[img.id] || {};
    var pred = predSet[model.model_id];

    document.getElementById('v-model-name').textContent = model.display_name;
    document.getElementById('v-truth').textContent = labelText(img.true_label);
    document.getElementById('v-truth').className = 'verdict-label ' + (img.true_label === 'def_front' ? 'def' : 'ok');

    var tierEl = document.getElementById('v-conf-tier');

    if (!pred) {
      document.getElementById('v-label').textContent = 'NO DATA';
      document.getElementById('v-correct').textContent = '--';
      document.getElementById('v-conf-bar').style.width = '0%';
      document.getElementById('v-conf-pct').textContent = '--%';
      tierEl.style.display = 'none';
      document.getElementById('gradcam-body').innerHTML = '<div class="loading-line">NO PREDICTION DATA FOR THIS PAIR.</div>';
      updateHash();
      return;
    }

    var vLabel = document.getElementById('v-label');
    vLabel.textContent = labelText(pred.pred);
    vLabel.className = 'verdict-label ' + (pred.pred === 'def_front' ? 'def' : 'ok');

    var correct = pred.pred === img.true_label;
    var corrEl = document.getElementById('v-correct');
    corrEl.textContent = correct ? T('inference.correct') : T('inference.wrong');
    corrEl.className = 'correctness ' + (correct ? 'correct' : 'wrong');

    var tier = confidenceTier(pred.confidence);
    var confPctStr = pct(pred.confidence);
    // pct() only ever returns the literal "100.0" for a true 1.0 confidence
    // value (it adds decimal places for anything just short of that) - for
    // that genuine case, say "near-certain" instead of "approx. 100%",
    // since "approximately 100%" reads like a contradiction in terms.
    document.getElementById('v-conf-pct').textContent =
      confPctStr === '100.0' ? T('inference.nearCertain') : (T('inference.approx') + confPctStr + '%');
    tierEl.textContent = T('tier.' + tier);
    tierEl.className = 'tier-badge tier-' + tier;
    tierEl.style.display = '';
    tierEl.title = T('tier.' + tier + 'Hint');
    var bar = document.getElementById('v-conf-bar');
    bar.style.width = pct(pred.confidence) + '%';
    bar.className = 'meter-fill tier-' + tier;

    var noteEl = document.getElementById('v-conf-note');
    if (model.confidence_is_calibrated === false) {
      noteEl.innerHTML =
        '<span class="tooltip-wrap" data-tooltip-i18n="notCalibrated.body">' +
          '<button class="info-btn" type="button">' + T('notCalibrated.label') + '</button>' +
        '</span>';
      window.CQI.wireStaticTooltips(noteEl);
    } else {
      noteEl.innerHTML = '';
    }

    renderGradcam(img, model, pred);
    updateHash();
  }

  function renderGradcam(img, model, pred) {
    var body = document.getElementById('gradcam-body');

    if (model.supports_gradcam && pred.gradcam) {
      body.innerHTML =
        '<div class="gradcam-pair">' +
          '<div class="img-frame clickable" data-src="' + img.image + '" data-caption="Original">' +
            '<img src="' + img.image + '" alt="original">' +
            '<div class="frame-caption">' + T('gradcam.original') + '</div>' +
          '</div>' +
          '<div class="img-frame clickable" data-src="' + pred.gradcam + '" data-caption="Grad-CAM overlay">' +
            '<img src="' + pred.gradcam + '" alt="gradcam overlay">' +
            '<div class="frame-caption">' + T('gradcam.gradcam') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tooltip-wrap" style="margin-top:10px;" data-tooltip-html="' +
          escapeHtml(T('gradcam.howToReadBody', { verdict: labelText(pred.pred) })) + '">' +
          '<button class="info-btn" type="button">' + T('gradcam.howToRead') + '</button>' +
        '</div>';

      var frames = body.querySelectorAll('.gradcam-pair .img-frame');
      var items = [
        { src: img.image, caption: 'Original — record ' + pad3(state.currentIndex) },
        { src: pred.gradcam, caption: 'Grad-CAM — ' + model.display_name },
      ];
      frames.forEach(function (frame, i) {
        frame.addEventListener('click', function () { window.CQI.openLightbox(items, i); });
      });
      window.CQI.wireStaticTooltips(body);
    } else {
      body.innerHTML =
        '<div class="gradcam-na">' +
          'GRAD-CAM: N/A<br><br>' +
          '<span class="muted">' + escapeHtml(model.display_name) + ' is a ' +
          (model.type === 'classical' ? 'classical ML model (feature: ' + escapeHtml(model.feature) + ')' : 'model') +
          ' — pixel-level attribution only exists for the deep learning model (ResNet18).<br>' +
          'Switch to ResNet18 in the model list to see an explanation for this record.</span>' +
        '</div>';
    }
  }

  /* ---------------------------------------------------------------------
     Navigation
     --------------------------------------------------------------------- */

  function goStep(direction) {
    var n = state.images.length;
    for (var step = 1; step <= n; step++) {
      var ni = (state.currentIndex + direction * step + n) % n;
      if (matchesFilter(state.images[ni])) {
        state.currentIndex = ni;
        render();
        return;
      }
    }
    // Nothing in the whole dataset matches the current filter combination -
    // render whatever's current so the UI doesn't just freeze silently.
    render();
  }

  function goRandom() {
    var candidates = [];
    state.images.forEach(function (img, i) { if (matchesFilter(img)) candidates.push(i); });
    if (!candidates.length) return;
    state.currentIndex = candidates[Math.floor(Math.random() * candidates.length)];
    render();
  }

  function goJump(value) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return;
    n = Math.max(0, Math.min(state.images.length - 1, n));
    state.currentIndex = n;
    render();
  }

  /* ---------------------------------------------------------------------
     Wire up controls
     --------------------------------------------------------------------- */

  document.getElementById('btn-prev').addEventListener('click', function () { goStep(-1); });
  document.getElementById('btn-next').addEventListener('click', function () { goStep(1); });
  document.getElementById('btn-random').addEventListener('click', goRandom);

  document.getElementById('record-jump').addEventListener('change', function (e) { goJump(e.target.value); });
  document.getElementById('record-jump').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') goJump(e.target.value);
  });

  document.getElementById('filter-select').addEventListener('change', function (e) {
    state.filter = e.target.value;
    // goStep() re-renders (and so refreshes the match count) only when it
    // actually has to jump; when the current record already satisfies the
    // new filter, nothing else would update the match count, so it's
    // refreshed unconditionally here either way.
    if (state.images.length && !matchesFilter(state.images[state.currentIndex])) {
      goStep(1);
    } else {
      updateFilterCount();
    }
  });

  document.getElementById('outcome-filter').addEventListener('change', function (e) {
    state.outcomeFilter = e.target.value;
    if (state.images.length && !matchesFilter(state.images[state.currentIndex])) {
      goStep(1);
    } else {
      updateFilterCount();
    }
  });

  document.getElementById('confidence-filter').addEventListener('change', function (e) {
    state.confidenceFilter = e.target.value;
    if (state.images.length && !matchesFilter(state.images[state.currentIndex])) {
      goStep(1);
    } else {
      updateFilterCount();
    }
  });

  document.getElementById('model-type-filter').addEventListener('change', function (e) {
    state.modelTypeFilter = e.target.value;
    renderModelList();
  });

  var viewerFrame = document.getElementById('viewer-frame');
  viewerFrame.addEventListener('click', function () {
    if (!state.images.length) return;
    var img = state.images[state.currentIndex];
    window.CQI.openLightbox([{ src: img.image, caption: 'Record ' + pad3(state.currentIndex) + ' — true label ' + labelText(img.true_label) }], 0);
  });

  /* Keyboard shortcuts: Left/Right to browse, R for random. Ignored while
     the user is typing in a text field or using a <select>. */
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === 'ArrowLeft') { goStep(-1); }
    else if (e.key === 'ArrowRight') { goStep(1); }
    else if (e.key === 'r' || e.key === 'R') { goRandom(); }
  });

  document.getElementById('btn-lang-toggle').addEventListener('click', window.CQI.toggleLang);
  document.getElementById('btn-theme-toggle').addEventListener('click', window.CQI.toggleTheme);

  window.addEventListener('cqi:langchange', function () {
    document.getElementById('stat-models').textContent = T('status.modelsLoaded') + ': ' + state.models.length;
    document.getElementById('stat-images').textContent = T('status.testRecords') + ': ' + state.images.length;
    renderModelList();
    render();
  });

  loadData();
})();
