/* app-tech.js — TECH section: the image press.
   Upload / paste a screenshot of any object → run it through a 1-bit press so it
   reads as a Cyberpunk 2020 sourcebook illustration (the original books did exactly
   this: high-contrast thresholded photos). Pure canvas, no server, ink #111 on
   pure white. v1 = the image engine alone; the fiche layer comes next.

   The press does NOT threshold raw luminance: two different colours of equal
   brightness would melt together. It first SEPARATES colours — k-means over RGB
   (deterministic), clusters ranked by brightness and remapped to well-spread
   tones, in-cluster shading kept — so the OBJECT appears. All three presses read
   that separated channel; TRAME also inks a fine outline along region boundaries.
   Exposes window.TechSection { render(tab, pane) }. */
(function () {
  'use strict';
  var INK = 17;                       // #111
  var MAXW = 1000;                    // longest side after downscale, px
  var LS_MODE = 'bartmoss_tech_mode';

  var MODES = [
    { key: 'trame', label: 'TRAME', title: 'Atkinson dither + fine outline — the sourcebook halftone' },
    { key: 'seuil', label: 'SEUIL', title: 'Hard threshold (Otsu) on separated tones — pure silhouette' },
    { key: 'trait', label: 'TRAIT', title: 'Sobel edges — line drawing' },
  ];

  /* ── per-pane state (one press per tab) ── */
  function st(pane) {
    if (!pane._tech) pane._tech = { gray: null, w: 0, h: 0, mode: localStorage.getItem(LS_MODE) || 'trame', name: 'untitled' };
    return pane._tech;
  }

  /* ── COLOUR SEPARATION: RGBA → one channel where colour differences survive.
     k-means (K=5) in RGB, deterministic init (centroids at luminance quantiles of
     a fixed-step sample); clusters ranked by mean luminance and spread over
     [10..245]; each pixel = its cluster tone + damped in-cluster shading. ── */
  function separate(d, W, H) {
    var N = W * H, L = new Float32Array(N), i, k;
    for (i = 0; i < N; i++) { var j = i * 4; L[i] = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]; }
    var K = 5;
    var step = Math.max(1, Math.floor(N / 12000)), samp = [];
    for (i = 0; i < N; i += step) samp.push(i);
    var sorted = samp.slice().sort(function (a, b) { return L[a] - L[b]; });
    var cent = [];
    for (k = 0; k < K; k++) {
      var si = sorted[Math.floor((k + 0.5) / K * (sorted.length - 1))] * 4;
      cent.push([d[si], d[si + 1], d[si + 2]]);
    }
    var nearest = function (r, g, b) {
      var bi = 0, bd = Infinity;
      for (var c = 0; c < K; c++) {
        var dr = r - cent[c][0], dg = g - cent[c][1], db = b - cent[c][2];
        var dist = dr * dr + dg * dg + db * db;
        if (dist < bd) { bd = dist; bi = c; }
      }
      return bi;
    };
    for (var it = 0; it < 8; it++) {
      var sum = [], cnt = [];
      for (k = 0; k < K; k++) { sum.push([0, 0, 0]); cnt.push(0); }
      for (i = 0; i < samp.length; i++) {
        var p = samp[i] * 4, c = nearest(d[p], d[p + 1], d[p + 2]);
        sum[c][0] += d[p]; sum[c][1] += d[p + 1]; sum[c][2] += d[p + 2]; cnt[c]++;
      }
      for (k = 0; k < K; k++) if (cnt[k]) cent[k] = [sum[k][0] / cnt[k], sum[k][1] / cnt[k], sum[k][2] / cnt[k]];
    }
    // cluster mean luminance (over the sample) → rank → spread tones
    var mL = [], mC = [];
    for (k = 0; k < K; k++) { mL.push(0); mC.push(0); }
    for (i = 0; i < samp.length; i++) { var c2 = nearest(d[samp[i] * 4], d[samp[i] * 4 + 1], d[samp[i] * 4 + 2]); mL[c2] += L[samp[i]]; mC[c2]++; }
    for (k = 0; k < K; k++) mL[k] = mC[k] ? mL[k] / mC[k] : 128;
    var order = [0, 1, 2, 3, 4].slice(0, K).sort(function (a, b) { return mL[a] - mL[b]; });
    var tone = new Float32Array(K);
    for (k = 0; k < K; k++) tone[order[k]] = 10 + k * (235 / (K - 1));
    // assign every pixel: cluster tone + damped in-cluster relief
    var sep = new Float32Array(N);
    for (i = 0; i < N; i++) {
      var p2 = i * 4, c3 = nearest(d[p2], d[p2 + 1], d[p2 + 2]);
      sep[i] = Math.max(0, Math.min(255, tone[c3] + 0.4 * (L[i] - mL[c3])));
    }
    return sep;
  }

  /* ── pipeline: image → downscaled, colour-separated channel ── */
  function toChannels(img) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    var s = Math.min(1, MAXW / Math.max(w, h));
    var W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, W, H);
    var d = x.getImageData(0, 0, W, H).data;
    return { g: separate(d, W, H), w: W, h: H };
  }

  /* ── treatments: separated channel → Uint8Array of 0 (ink) / 1 (paper) ── */
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
  // Sobel on the separated channel → 0 where edge ink lands. pct picks fineness:
  // higher percentile = fewer, finer lines (region boundaries survive first).
  function edgeBits(s, pct) {
    var w = s.w, h = s.h, g = s.gray;
    var mag = new Float32Array(w * h), i, x, y;
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x;
      var gx = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - 1] + g[i + w - 1]);
      var gy = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]) - (g[i - w - 1] + 2 * g[i - w] + g[i - w + 1]);
      mag[i] = Math.sqrt(gx * gx + gy * gy);
    }
    var samp = [], step = Math.max(1, (w * h / 20000) | 0);
    for (i = 0; i < mag.length; i += step) if (mag[i] > 0) samp.push(mag[i]);
    samp.sort(function (a, b) { return a - b; });
    var thr = samp.length ? samp[Math.floor(samp.length * pct)] : 80;
    var out = new Uint8Array(w * h);
    for (i = 0; i < out.length; i++) out[i] = mag[i] > thr ? 0 : 1;
    return out;
  }
  function pressSeuil(s) {
    var t = otsu(s.gray), out = new Uint8Array(s.w * s.h);
    for (var i = 0; i < out.length; i++) out[i] = s.gray[i] > t ? 1 : 0;
    return out;
  }
  function pressTrame(s) {
    // Atkinson error diffusion — the photocopied-halftone voice of the sourcebooks —
    // then a FINE OUTLINE inked along the separated-region boundaries.
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
    var edge = edgeBits(s, 0.94);
    for (var j = 0; j < out.length; j++) if (!edge[j]) out[j] = 0;
    return out;
  }
  function pressTrait(s) { return edgeBits(s, 0.88); }

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
      var s = st(pane), r = toChannels(img);
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

  window.TechSection = { render: render, _press: { separate: separate, otsu: otsu, edgeBits: edgeBits, pressTrame: pressTrame, pressSeuil: pressSeuil, pressTrait: pressTrait } };
})();
