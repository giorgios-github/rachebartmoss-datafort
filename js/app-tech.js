/* app-tech.js — TECH section: the image press.
   Upload / paste a screenshot of any object → run it through a 1-bit press so it
   reads as a Cyberpunk 2020 sourcebook illustration (the original books did exactly
   this: high-contrast thresholded photos). Pure canvas, no server, ink #111 on
   pure white. v1 = the image engine alone; the fiche layer comes next.
   Exposes window.TechSection { render(tab, pane) }. */
(function () {
  'use strict';
  var INK = 17;                       // #111
  var MAXW = 1000;                    // longest side after downscale, px
  var LS_MODE = 'bartmoss_tech_mode';

  var MODES = [
    { key: 'trame', label: 'TRAME', title: 'Atkinson dither — the sourcebook halftone' },
    { key: 'seuil', label: 'SEUIL', title: 'Hard threshold (Otsu) — pure silhouette' },
    { key: 'trait', label: 'TRAIT', title: 'Sobel edges — line drawing' },
  ];

  /* ── per-pane state (one press per tab) ── */
  function st(pane) {
    if (!pane._tech) pane._tech = { gray: null, w: 0, h: 0, mode: localStorage.getItem(LS_MODE) || 'trame', name: 'untitled' };
    return pane._tech;
  }

  /* ── pipeline: image → downscaled grayscale (auto-levelled) ── */
  function toGray(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var s = Math.min(1, MAXW / Math.max(w, h));
    var W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data;
    var g = new Float32Array(W * H);
    for (var i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2];
    // auto-levels: stretch the 2–98 percentile span to full range
    var hist = new Uint32Array(256);
    for (i = 0; i < g.length; i++) hist[g[i] | 0]++;
    var lo = 0, hi = 255, acc = 0, n2 = g.length * 0.02, n98 = g.length * 0.98;
    for (i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n2) { lo = i; break; } }
    for (acc = 0, i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n98) { hi = i; break; } }
    var span = Math.max(1, hi - lo);
    for (i = 0; i < g.length; i++) g[i] = Math.max(0, Math.min(255, (g[i] - lo) * 255 / span));
    return { g: g, w: W, h: H };
  }

  /* ── treatments: grayscale → Uint8Array of 0 (ink) / 1 (paper) ── */
  function otsu(g) {
    var hist = new Uint32Array(256), i;
    for (i = 0; i < g.length; i++) hist[g[i] | 0]++;
    var total = g.length, sum = 0;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0, wB = 0, best = 127, maxVar = 0;
    for (i = 0; i < 256; i++) {
      wB += hist[i]; if (!wB) continue;
      var wF = total - wB; if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; best = i; }
    }
    return best;
  }
  function pressSeuil(s) {
    var t = otsu(s.gray), out = new Uint8Array(s.w * s.h);
    for (var i = 0; i < out.length; i++) out[i] = s.gray[i] > t ? 1 : 0;
    return out;
  }
  function pressTrame(s) {
    // Atkinson error diffusion — the photocopied-halftone voice of the sourcebooks
    var w = s.w, h = s.h, g = Float32Array.from(s.gray), out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x, v = g[i], on = v > 127 ? 1 : 0;
      out[i] = on;
      var err = (v - (on ? 255 : 0)) / 8;
      if (x + 1 < w) g[i + 1] += err;
      if (x + 2 < w) g[i + 2] += err;
      if (y + 1 < h) {
        if (x > 0) g[i + w - 1] += err;
        g[i + w] += err;
        if (x + 1 < w) g[i + w + 1] += err;
      }
      if (y + 2 < h) g[i + 2 * w] += err;
    }
    return out;
  }
  function pressTrait(s) {
    var w = s.w, h = s.h, g = s.gray;
    var mag = new Float32Array(w * h), i, x, y;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x;
      var gx = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - 1] + g[i + w - 1]);
      var gy = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - w] + g[i - w + 1]);
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
    // ink the strongest ~12% of gradients (percentile, robust to exposure)
    var samp = [], step = Math.max(1, (w * h / 20000) | 0);
    for (i = 0; i < mag.length; i += step) if (mag[i] > 0) samp.push(mag[i]);
    samp.sort(function (a, b) { return a - b; });
    var thr = samp.length ? samp[Math.floor(samp.length * 0.88)] : 80;
    var out = new Uint8Array(w * h);
    for (i = 0; i < out.length; i++) out[i] = mag[i] > thr ? 0 : 1;
    return out;
  }

  function press(s) {
    if (!s.gray) return null;
    var fn = s.mode === 'seuil' ? pressSeuil : s.mode === 'trait' ? pressTrait : pressTrame;
    return fn(s);
  }
  function paint(canvas, s) {
    var bits = press(s); if (!bits) return;
    canvas.width = s.w; canvas.height = s.h;
    var x = canvas.getContext('2d'), im = x.createImageData(s.w, s.h), d = im.data;
    for (var i = 0, j = 0; i < bits.length; i++, j += 4) {
      var v = bits[i] ? 255 : INK;
      d[j] = v; d[j + 1] = v; d[j + 2] = v; d[j + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  }

  /* ── input plumbing ── */
  function loadBlob(pane, blob, name) {
    var url = URL.createObjectURL(blob), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var s = st(pane), r = toGray(img);
      s.gray = r.g; s.w = r.w; s.h = r.h;
      s.name = (name || 'capture').replace(/\.[a-z0-9]+$/i, '');
      redraw(pane);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* ── UI ── */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function redraw(pane) {
    var s = st(pane);
    var stage = pane.querySelector('.tech-stage'), bar = pane.querySelector('.tech-modes');
    if (!stage) return;
    if (bar) bar.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-mode') === s.mode);
    });
    pane.querySelectorAll('.tech-need-img').forEach(function (b) { b.disabled = !s.gray; });
    if (!s.gray) {
      stage.innerHTML =
        '<div class="tech-drop"><div class="tech-drop-g">▣</div>' +
        '<div class="tech-drop-l">DROP A SCREENSHOT</div>' +
        '<div class="tech-drop-s">click to browse · or paste with ⌘V</div></div>';
      stage.querySelector('.tech-drop').onclick = function () { pane.querySelector('.tech-file').click(); };
      return;
    }
    stage.innerHTML = '<div class="tech-plate"><canvas class="tech-canvas"></canvas>' +
      '<div class="tech-plate-cap">' + esc(s.name.toUpperCase()) + ' · ' + s.w + '×' + s.h + ' · 1-BIT</div></div>';
    paint(stage.querySelector('.tech-canvas'), s);
  }

  function render(tab, pane) {
    var s = st(pane);
    pane.classList.add('tech-pane');
    pane.innerHTML =
      '<div class="tech-bar">' +
        '<span class="tech-title">TECH · PRESS</span>' +
        '<span class="tech-modes">' + MODES.map(function (m) {
          return '<button class="app-btn" data-mode="' + m.key + '" title="' + m.title + '">' + m.label + '</button>';
        }).join('') + '</span>' +
        '<span class="tech-bar-sp"></span>' +
        '<button class="app-btn tech-import">⇪ IMPORT</button>' +
        '<button class="app-btn tech-export tech-need-img">▤ EXPORT PNG</button>' +
        '<input type="file" class="tech-file" accept="image/*" style="display:none">' +
      '</div>' +
      '<div class="tech-stage"></div>';

    pane.querySelector('.tech-import').onclick = function () { pane.querySelector('.tech-file').click(); };
    pane.querySelector('.tech-file').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) loadBlob(pane, f, f.name);
      e.target.value = '';
    };
    pane.querySelector('.tech-export').onclick = function () {
      if (!s.gray) return;
      var c = pane.querySelector('.tech-canvas'); if (!c) return;
      var a = document.createElement('a');
      a.download = s.name + '-' + s.mode + '.png';
      a.href = c.toDataURL('image/png');
      a.click();
    };
    pane.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () {
        s.mode = b.getAttribute('data-mode');
        try { localStorage.setItem(LS_MODE, s.mode); } catch (e) {}
        redraw(pane);
      };
    });

    // drag & drop anywhere on the pane
    pane.addEventListener('dragover', function (e) { e.preventDefault(); pane.classList.add('tech-over'); });
    pane.addEventListener('dragleave', function () { pane.classList.remove('tech-over'); });
    pane.addEventListener('drop', function (e) {
      e.preventDefault(); pane.classList.remove('tech-over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && /^image\//.test(f.type)) loadBlob(pane, f, f.name);
    });
    // paste (⌘V) while this pane is on screen
    if (!pane._techPaste) {
      pane._techPaste = function (e) {
        if (!document.body.contains(pane) || pane.style.display === 'none') return;
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) if (/^image\//.test(items[i].type)) {
          loadBlob(pane, items[i].getAsFile(), 'paste');
          e.preventDefault(); return;
        }
      };
      document.addEventListener('paste', pane._techPaste);
    }
    redraw(pane);
  }

  window.TechSection = { render: render };
})();
