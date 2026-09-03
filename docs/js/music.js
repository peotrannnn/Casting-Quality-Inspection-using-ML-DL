/* ---------------------------------------------------------------------
   Background music player.

   Design notes (read this before touching the folder or the code):

   - Tracks live in "background music/" (kept as its own top-level folder,
     next to index.html/stats.html, since that's where the audio files
     were dropped). The player never lists that folder itself - static
     GitHub Pages hosting has no directory listing - so it reads
     "background music/manifest.json" instead, a plain JSON array of
     filenames. Run "background music/build-manifest.py" once whenever a
     track is added/removed/renamed, then redeploy; nothing in this file
     needs to change for a new song to show up in the rotation.
   - If the manifest can't be fetched for any reason (missing, bad JSON,
     offline dev preview without a local server), DEFAULT_TRACKS below is
     the fallback playlist, kept in sync with the folder's contents at the
     time this was written.
   - One specific track (EASTER_TRACK) triggers a screen "glitch" effect
     during its last 35 seconds - see the Horror-glitch easter egg section
     near the bottom.
   --------------------------------------------------------------------- */

(function () {
  'use strict';

  var MUSIC_DIR_ENCODED = encodeURIComponent('background music') + '/';
  var MANIFEST_URL = MUSIC_DIR_ENCODED + 'manifest.json';

  var DEFAULT_TRACKS = [
    'audiodollar-jazz-jazz-musical-background-553332.mp3',
    'chill_background-lofi-vibes-113884.mp3',
    'logicallism-canx27t-you-see-551349.mp3',
    'luis_humanoide-valley-view-center-mall-298790.mp3'
  ];

  // Matched against a track's filename with the extension stripped,
  // case-insensitively - renaming the file breaks the easter egg, but
  // nothing else.
  var EASTER_TRACK = 'luis_humanoide-valley-view-center-mall-298790';
  var EASTER_WINDOW_SECONDS = 35;

  var FADE_SECONDS = 10;
  // Kept well under 1.0 on purpose - this should sit behind the UI sounds
  // and never fight for attention. Combined with the lowpass filter below
  // it reads as a distant, half-heard "liminal space" loop rather than a
  // foreground soundtrack.
  var TARGET_VOLUME = 0.32;
  // A gentle lowpass - dulls the highs the way a cheap old speaker, a
  // muffled wall, or a worn-out cassette does. This (plus the volume cap
  // above) is the whole "old computer" / liminal coloring; deliberately
  // subtle rather than a heavy telephone-style band-pass, so it still
  // sounds like music and not a novelty effect.
  var LOWPASS_FREQ = 2800;
  var LOWPASS_Q = 0.6;

  function trackUrl(filename) {
    return MUSIC_DIR_ENCODED + encodeURIComponent(filename);
  }

  function baseName(filename) {
    return (filename || '').replace(/\.[^./]+$/, '');
  }

  function isEasterTrack(filename) {
    return !!filename && baseName(filename).toLowerCase() === EASTER_TRACK.toLowerCase();
  }

  /* ---------------------------------------------------------------------
     Small persisted-state helpers (mirrors the try/catch pattern in
     ui.js - private storage, incognito tabs, etc. must never break audio)
     --------------------------------------------------------------------- */

  function loadEnabledPref() {
    try {
      var v = localStorage.getItem('cqi:musicOn');
      return v === null ? true : v === '1';
    } catch (e) { return true; }
  }
  function saveEnabledPref(v) {
    try { localStorage.setItem('cqi:musicOn', v ? '1' : '0'); } catch (e) { /* ignore */ }
  }
  // sessionStorage (not localStorage): survives navigating between
  // index.html and stats.html in the same tab/session, but a fresh visit
  // later is free to pick anything - it's only here so hopping between
  // the two pages doesn't immediately replay the song you just heard.
  function getLastTrack() {
    try { return sessionStorage.getItem('cqi:lastTrack'); } catch (e) { return null; }
  }
  function setLastTrack(f) {
    try { sessionStorage.setItem('cqi:lastTrack', f); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------------------
     Playback state
     --------------------------------------------------------------------- */

  var tracks = DEFAULT_TRACKS.slice();
  var manifestReady = false;
  var gestureUnlocked = false;
  var musicEnabled = loadEnabledPref();

  var currentAudioEl = null;
  var currentSource = null;
  var currentFilter = null;
  var currentGain = null;
  var currentTrackFile = null;
  var rafId = null;

  function pickNextTrack(list, excludeFilename) {
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    var candidates = list.filter(function (f) { return f !== excludeFilename; });
    if (!candidates.length) candidates = list;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function getSharedAudioContext() {
    return (window.CQI && window.CQI.getAudioContext) ? window.CQI.getAudioContext() : null;
  }

  function computeFadeVolume(t, duration) {
    var fade = Math.min(FADE_SECONDS, duration / 2);
    if (fade <= 0) return 1;
    if (t < fade) return t / fade;
    if (t > duration - fade) return Math.max(0, (duration - t) / fade);
    return 1;
  }

  function disconnectQuietly(node) {
    if (!node) return;
    try { node.disconnect(); } catch (e) { /* already disconnected */ }
  }

  function stopCurrent() {
    if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
    if (currentAudioEl) {
      currentAudioEl.pause();
      currentAudioEl.removeAttribute('src');
    }
    disconnectQuietly(currentSource);
    disconnectQuietly(currentFilter);
    disconnectQuietly(currentGain);
    currentAudioEl = null;
    currentSource = null;
    currentFilter = null;
    currentGain = null;
    clearHorrorEffect();
  }

  function startTrack(filename) {
    if (!filename) return;
    stopCurrent();
    currentTrackFile = filename;
    setLastTrack(filename);

    var audioEl = new Audio(trackUrl(filename));
    audioEl.preload = 'auto';
    audioEl.loop = false;
    currentAudioEl = audioEl;

    var ctx = getSharedAudioContext();
    if (ctx) {
      try {
        var source = ctx.createMediaElementSource(audioEl);
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = LOWPASS_FREQ;
        filter.Q.value = LOWPASS_Q;
        var gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        currentSource = source;
        currentFilter = filter;
        currentGain = gain;
      } catch (e) {
        // Web Audio graph failed for some reason - fall back to the plain
        // <audio> element's own .volume for fading, no lowpass coloring.
        currentSource = null;
        currentFilter = null;
        currentGain = null;
      }
    }
    if (!currentGain) audioEl.volume = 0;

    audioEl.addEventListener('ended', function () {
      if (currentTrackFile === filename) advance();
    });

    var playPromise = audioEl.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(function () {
        // Blocked by autoplay policy - the gesture-unlock listener below
        // will retry once a real interaction happens.
      });
    }

    frameLoop();
  }

  function advance() {
    var next = pickNextTrack(tracks, currentTrackFile);
    startTrack(next);
  }

  function frameLoop() {
    var el = currentAudioEl;
    if (!el) return;
    var duration = el.duration;
    if (isFinite(duration) && duration > 0) {
      var vol = musicEnabled ? computeFadeVolume(el.currentTime, duration) : 0;
      if (currentGain) currentGain.gain.value = vol * TARGET_VOLUME;
      else el.volume = Math.max(0, Math.min(1, vol * TARGET_VOLUME));

      if (musicEnabled && isEasterTrack(currentTrackFile)) {
        var remaining = duration - el.currentTime;
        if (remaining >= 0 && remaining <= EASTER_WINDOW_SECONDS) {
          horrorTick(1 - remaining / EASTER_WINDOW_SECONDS);
        } else {
          clearHorrorEffect();
        }
      } else {
        clearHorrorEffect();
      }
    }
    rafId = window.requestAnimationFrame(frameLoop);
  }

  /* ---------------------------------------------------------------------
     Manifest loading
     --------------------------------------------------------------------- */

  function fetchManifest() {
    return fetch(MANIFEST_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('manifest not ok');
        return r.json();
      })
      .then(function (list) {
        if (!Array.isArray(list)) return null;
        var cleaned = list.filter(function (f) { return typeof f === 'string' && f.length > 0; });
        return cleaned.length ? cleaned : null;
      });
  }

  function tryBeginPlayback() {
    if (!manifestReady || !gestureUnlocked || !musicEnabled || currentAudioEl) return;
    startTrack(pickNextTrack(tracks, getLastTrack()));
  }

  /* ---------------------------------------------------------------------
     Mute toggle (persisted, mirrored across pages like theme/lang)
     --------------------------------------------------------------------- */

  function updateToggleLabel() {
    var btn = document.getElementById('btn-music-toggle');
    if (!btn || !window.CQI) return;
    btn.textContent = window.CQI.t(musicEnabled ? 'toggle.musicOn' : 'toggle.musicOff');
  }

  function setMusicEnabled(next) {
    musicEnabled = next;
    saveEnabledPref(next);
    updateToggleLabel();
    if (!musicEnabled) {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = null; }
      if (currentAudioEl) currentAudioEl.pause();
      clearHorrorEffect();
      return;
    }
    if (currentAudioEl) {
      var p = currentAudioEl.play();
      if (p && p.catch) p.catch(function () { /* ignore */ });
      if (!rafId) frameLoop();
    } else {
      tryBeginPlayback();
    }
  }

  function unlockGesture() {
    if (gestureUnlocked) return;
    gestureUnlocked = true;
    getSharedAudioContext();
    tryBeginPlayback();
  }

  /* ---------------------------------------------------------------------
     Horror-glitch easter egg - only ever active during the last 35s of
     EASTER_TRACK. Interpolates the page's --desktop background color
     from its normal value toward red and layers a flickering noise/
     vignette overlay + occasional screen-jitter, intensifying as the
     track approaches its end. Clears itself immediately once that
     condition is no longer true (track changes, ends, or music is off).
     --------------------------------------------------------------------- */

  var horrorOverlayEl = null;
  var horrorBaseDesktop = null; // [r,g,b] of --desktop as it was before the effect started
  var HORROR_RED = [150, 12, 12];
  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function ensureHorrorOverlay() {
    if (!horrorOverlayEl) {
      horrorOverlayEl = document.createElement('div');
      horrorOverlayEl.id = 'horror-overlay';
      horrorOverlayEl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(horrorOverlayEl);
    }
    return horrorOverlayEl;
  }

  function hexToRgb(hex) {
    hex = (hex || '').trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    if (hex.length !== 6) return [0, 128, 128];
    var num = parseInt(hex, 16);
    if (isNaN(num)) return [0, 128, 128];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

  function horrorTick(progress) {
    progress = Math.max(0, Math.min(1, progress));
    var overlay = ensureHorrorOverlay();

    if (horrorBaseDesktop === null) {
      var normal = getComputedStyle(document.documentElement).getPropertyValue('--desktop');
      horrorBaseDesktop = hexToRgb(normal);
    }

    var flicker = (Math.random() - 0.5) * 14 * progress;
    var mixed = [0, 1, 2].map(function (i) {
      return clamp255(horrorBaseDesktop[i] + (HORROR_RED[i] - horrorBaseDesktop[i]) * progress + flicker);
    });
    document.documentElement.style.setProperty('--desktop', 'rgb(' + mixed.join(',') + ')');

    var staticFlicker = 0.85 + Math.random() * 0.15;
    overlay.style.opacity = String(Math.min(0.6, progress * 0.65 * staticFlicker));

    if (!reducedMotion && Math.random() < 0.03 + progress * 0.22) {
      var shell = document.querySelector('.crt-shell');
      if (shell) {
        var dx = (Math.random() - 0.5) * (2 + progress * 9);
        var dy = (Math.random() - 0.5) * (2 + progress * 5);
        shell.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
        shell.style.filter = 'contrast(' + (1 + progress * 0.25).toFixed(2) + ') hue-rotate(' + (progress * -20).toFixed(0) + 'deg)';
        window.setTimeout(function () {
          if (shell) { shell.style.transform = ''; shell.style.filter = ''; }
        }, 55 + Math.random() * 90);
      }
    }
  }

  function clearHorrorEffect() {
    if (horrorBaseDesktop !== null) {
      document.documentElement.style.removeProperty('--desktop');
      horrorBaseDesktop = null;
    }
    if (horrorOverlayEl) horrorOverlayEl.style.opacity = '0';
    var shell = document.querySelector('.crt-shell');
    if (shell) { shell.style.transform = ''; shell.style.filter = ''; }
  }

  /* ---------------------------------------------------------------------
     Init
     --------------------------------------------------------------------- */

  function init() {
    updateToggleLabel();

    var btn = document.getElementById('btn-music-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        unlockGesture();
        setMusicEnabled(!musicEnabled);
      });
    }

    window.addEventListener('cqi:langchange', updateToggleLabel);

    document.addEventListener('pointerdown', unlockGesture, { capture: true, once: true });
    document.addEventListener('keydown', unlockGesture, { capture: true, once: true });

    fetchManifest()
      .then(function (list) { tracks = list || DEFAULT_TRACKS.slice(); })
      .catch(function () { tracks = DEFAULT_TRACKS.slice(); })
      .then(function () {
        manifestReady = true;
        tryBeginPlayback();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Small debug surface, not part of the feature itself - lets a real
  // issue be diagnosed from the browser console (or an automated check)
  // without needing to sit through a full track: which file is playing,
  // jump straight to a track/timestamp, read the current volume, etc.
  window.__cqiMusic = {
    getCurrentTrack: function () { return currentTrackFile; },
    getTracks: function () { return tracks.slice(); },
    isEnabled: function () { return musicEnabled; },
    seekTo: function (seconds) { if (currentAudioEl) currentAudioEl.currentTime = seconds; },
    seekToAndWait: function (seconds) {
      return new Promise(function (resolve) {
        if (!currentAudioEl) return resolve(false);
        var el = currentAudioEl;
        var done = false;
        function onSeeked() { if (done) return; done = true; el.removeEventListener('seeked', onSeeked); resolve(true); }
        el.addEventListener('seeked', onSeeked);
        el.currentTime = seconds;
        window.setTimeout(function () { onSeeked(); }, 3000);
      });
    },
    forceTrack: function (filename) { startTrack(filename); },
    getVolume: function () { return currentGain ? currentGain.gain.value : (currentAudioEl ? currentAudioEl.volume : null); },
    getDuration: function () { return currentAudioEl ? currentAudioEl.duration : null; },
    getCurrentTime: function () { return currentAudioEl ? currentAudioEl.currentTime : null; },
    getReadyState: function () { return currentAudioEl ? currentAudioEl.readyState : null; },
    getSeekable: function () {
      if (!currentAudioEl) return null;
      var s = currentAudioEl.seekable, out = [];
      for (var i = 0; i < s.length; i++) out.push([s.start(i), s.end(i)]);
      return out;
    },
    getHorrorOpacity: function () { return horrorOverlayEl ? horrorOverlayEl.style.opacity : null; },
    getDesktopColor: function () { return getComputedStyle(document.documentElement).getPropertyValue('--desktop'); }
  };
})();
