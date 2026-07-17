/* app-tech.js — TECH section: the image press.
   Upload / paste a screenshot of any object → run it through a 1-bit press so it
   reads as a Cyberpunk 2020 sourcebook illustration (the original books did exactly
   this: high-contrast thresholded photos). Pure canvas, no server, ink #111 on
   pure white.

   Pipeline: COLOUR SEPARATION first (deterministic k-means over RGB, clusters
   ranked by brightness and spread over well-separated tones, labels cleaned by a
   3×3 majority filter) — so two colours of equal brightness stay distinct and the
   OBJECT appears. Presses read that channel through a gamma. The outline is NOT a
   gradient filter (that inked texture noise): it is the region-boundary map —
   crisp 1px lines exactly where two colour regions meet.
   Precise sliders drive every stage; all deterministic.
   Exposes window.TechSection { render(tab, pane) }. */
(function () {
  'use strict';
  var INK = 17;                       // #111
  var MAXW = 1000;                    // longest side after downscale, px
  var LS_MODE = 'bartmoss_tech_mode';
  var LS_PAR = 'bartmoss_tech_params';

  var MODES = [
    { key: 'trame', label: 'TRAME', title: 'Atkinson dither + region outline — the sourcebook halftone' },
    { key: 'seuil', label: 'SEUIL', title: 'Hard threshold (Otsu + bias) on separated tones' },
    { key: 'trait', label: 'TRAIT', title: 'Line drawing — region boundaries + strong gradients' },
  ];
  function defaults() {
    return { k: 5, relief: 40, gamma: 100, bias: 0, outline: 1, fine: 88 };
  }
  // slider registry: [key, label, min, max, step, title]
  var SLIDERS = [
    ['k', 'COULEURS', 2, 8, 1, 'colour groups — how many tones the press separates'],
    ['relief', 'RELIEF', 0, 100, 5, 'in-region shading kept (0 = flat posters)'],
    ['gamma', 'GAMMA', 40, 250, 5, 'tone curve before the press (100 = neutral; lower = darker plate)'],
    ['bias', 'NIVEAU', -60, 60, 2, 'SEUIL: ink more (+) or less (−) than Otsu suggests'],
    ['outline', 'CONTOUR', 0, 3, 1, 'region-boundary line thickness in px (0 = off)'],
    ['fine', 'FINESSE', 70, 98, 1, 'TRAIT: gradient percentile — higher = fewer, finer lines'],
  ];

  /* ── per-pane state (one press per tab) ── */
  function loadParams() {
    try {
      var p = JSON.parse(localStorage.getItem(LS_PAR)) || {};
      var d = defaults();
      for (var k in d) if (typeof p[k] === 'number') d[k] = p[k];
      return d;
    } catch (e) { return defaults(); }
  }
  function st(pane) {
    if (!pane._tech) pane._tech = {
      rgba: null, w: 0, h: 0, name: 'untitled',
      mode: localStorage.getItem(LS_MODE) || 'trame',
      params: loadParams(),
      labels: null, L: null, mL: null, tone: null, _kDone: 0,
    };
    return pane._tech;
  }

  /* ── stage 1 · COLOUR SEPARATION: k-means over RGB, deterministic ── */
  function clusterize(s) {
    var d = s.rgba, W = s.w, H = s.h, N = W * H, K = s.params.k, i, k;
    var L = s.L;
    if (!L) {
      L = new Float32Array(N);
      for (i = 0; i < N; i++) { var j0 = i * 4; L[i] = 0.2126 * d[j0] + 0.7152 * d[j0 + 1] + 0.0722 * d[j0 + 2]; }
      s.L = L;
    }
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
    // label every pixel, then clean speckle with a 3×3 majority vote (crisp regions)
    var lab = new Uint8Array(N);
    for (i = 0; i < N; i++) { var p2 = i * 4; lab[i] = nearest(d[p2], d[p2 + 1], d[p2 + 2]); }
    var lab2 = new Uint8Array(N), votes = new Uint8Array(K);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      i = y * W + x;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { lab2[i] = lab[i]; continue; }
      votes.fill(0);
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) votes[lab[i + dy * W + dx]]++;
      var best = lab[i];
      for (k = 0; k < K; k++) if (votes[k] > votes[best]) best = k;
      lab2[i] = best;
    }
    // cluster mean luminance → rank → spread tones over [10..245]
    var mL = new Float32Array(K), mC = new Uint32Array(K);
    for (i = 0; i < N; i++) { mL[lab2[i]] += L[i]; mC[lab2[i]]++; }
    for (k = 0; k < K; k++) mL[k] = mC[k] ? mL[k] / mC[k] : 128;
    var order = [];
    for (k = 0; k < K; k++) order.push(k);
    order.sort(function (a, b) { return mL[a] - mL[b]; });
    var tone = new Float32Array(K);
    for (k = 0; k < K; k++) tone[order[k]] = K === 1 ? 128 : 10 + k * (235 / (K - 1));
    s.labels = lab2; s.mL = mL; s.tone = tone; s._kDone = K;
  }

  /* ── stage 2 · the separated channel, through relief + gamma ── */
  function chanOf(s) {
    var N = s.w * s.h, out = new Float32Array(N);
    var relief = s.params.relief / 100, inv = 100 / s.params.gamma;
    for (var i = 0; i < N; i++) {
      var c = s.labels[i];
      var v = Math.max(0, Math.min(255, s.tone[c] + relief * (s.L[i] - s.mL[c])));
      out[i] = 255 * Math.pow(v / 255, inv);
    }
    return out;
  }

  /* ── stage 3 · outline = region boundaries (labels change), dilated to px ── */
  function boundaryBits(s) {
    var W = s.w, H = s.h, lab = s.labels, t = s.params.outline;
    var out = new Uint8Array(W * H).fill(1);
    if (!t) return out;
    for (var y = 0; y < H - 1; y++) for (var x = 0; x < W - 1; x++) {
      var i = y * W + x;
      if (lab[i] !== lab[i + 1] || lab[i] !== lab[i + W]) out[i] = 0;
    }
    for (var pass = 1; pass < t; pass++) {           // thickness: dilate ink
      var prev = Uint8Array.from(out);
      for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) {
        i = y * W + x;
        if (!prev[i - 1] || !prev[i + 1] || !prev[i - W] || !prev[i + W]) out[i] = 0;
      }
    }
    return out;
  }

  /* ── presses: state → Uint8Array of 0 (ink) / 1 (paper) ── */
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
    var g = chanOf(s), t = Math.max(1, Math.min(254, otsu(g) + s.params.bias));
    var out = new Uint8Array(s.w * s.h);
    for (var i = 0; i < out.length; i++) out[i] = g[i] > t ? 1 : 0;
    var edge = boundaryBits(s);
    for (i = 0; i < out.length; i++) if (!edge[i]) out[i] = 0;
    return out;
  }
  function pressTrame(s) {
    // Atkinson error diffusion, then the region outline inked on top
    var w = s.w, h = s.h, g = chanOf(s), out = new Uint8Array(w * h);
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
    var edge = boundaryBits(s);
    for (var j = 0; j < out.length; j++) if (!edge[j]) out[j] = 0;
    return out;
  }
  function pressTrait(s) {
    // line drawing: region boundaries + the strongest in-region gradients
    var w = s.w, h = s.h, g = chanOf(s);
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
    var thr = samp.length ? samp[Math.floor(samp.length * (s.params.fine / 100))] : 80;
    var out = new Uint8Array(w * h);
    for (i = 0; i < out.length; i++) out[i] = mag[i] > thr ? 0 : 1;
    var edge = boundaryBits(s);
    for (i = 0; i < out.length; i++) if (!edge[i]) out[i] = 0;
    return out;
  }

  function press(s) {
    if (!s.rgba) return null;
    if (s._kDone !== s.params.k || !s.labels) clusterize(s);
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
      var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      var sc = Math.min(1, MAXW / Math.max(w, h));
      var W = Math.max(1, Math.round(w * sc)), H = Math.max(1, Math.round(h * sc));
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(img, 0, 0, W, H);
      var s = st(pane);
      s.rgba = x.getImageData(0, 0, W, H).data; s.w = W; s.h = H;
      s.L = null; s.labels = null; s._kDone = 0;
      s.name = (name || 'capture').replace(/\.[a-z0-9]+$/i, '');
      redraw(pane);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* ── UI ── */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmtVal(key, v) { return key === 'gamma' ? (v / 100).toFixed(2) : String(v); }
  function redraw(pane) {
    var s = st(pane);
    var stage = pane.querySelector('.tech-stage'), bar = pane.querySelector('.tech-modes');
    if (!stage) return;
    if (bar) bar.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-mode') === s.mode);
    });
    pane.querySelectorAll('.tech-need-img').forEach(function (b) { b.disabled = !s.rgba; });
    if (!s.rgba) {
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
  var _rt = null;
  function redrawSoon(pane) { clearTimeout(_rt); _rt = setTimeout(function () { redraw(pane); }, 70); }

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
        '<button class="app-btn tech-reset tech-need-img">↺ RESET</button>' +
        '<button class="app-btn tech-import">⇪ IMPORT</button>' +
        '<button class="app-btn tech-export tech-need-img">▤ EXPORT PNG</button>' +
        '<input type="file" class="tech-file" accept="image/*" style="display:none">' +
      '</div>' +
      '<div class="tech-ctrl">' + SLIDERS.map(function (S) {
        var v = s.params[S[0]];
        return '<label class="tech-sl" title="' + S[5] + '"><span class="tech-sl-l">' + S[1] + '</span>' +
          '<input type="range" data-par="' + S[0] + '" min="' + S[2] + '" max="' + S[3] + '" step="' + S[4] + '" value="' + v + '">' +
          '<span class="tech-sl-v" data-val="' + S[0] + '">' + fmtVal(S[0], v) + '</span></label>';
      }).join('') + '</div>' +
      '<div class="tech-stage"></div>';

    pane.querySelector('.tech-import').onclick = function () { pane.querySelector('.tech-file').click(); };
    pane.querySelector('.tech-file').onchange = function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) loadBlob(pane, f, f.name);
      e.target.value = '';
    };
    pane.querySelector('.tech-export').onclick = function () {
      if (!s.rgba) return;
      var c = pane.querySelector('.tech-canvas'); if (!c) return;
      var a = document.createElement('a');
      a.download = s.name + '-' + s.mode + '.png';
      a.href = c.toDataURL('image/png');
      a.click();
    };
    pane.querySelector('.tech-reset').onclick = function () {
      s.params = defaults();
      try { localStorage.setItem(LS_PAR, JSON.stringify(s.params)); } catch (e) {}
      SLIDERS.forEach(function (S) {
        var inp = pane.querySelector('[data-par="' + S[0] + '"]'), out = pane.querySelector('[data-val="' + S[0] + '"]');
        if (inp) inp.value = s.params[S[0]];
        if (out) out.textContent = fmtVal(S[0], s.params[S[0]]);
      });
      redraw(pane);
    };
    pane.querySelectorAll('[data-mode]').forEach(function (b) {
      b.onclick = function () {
        s.mode = b.getAttribute('data-mode');
        try { localStorage.setItem(LS_MODE, s.mode); } catch (e) {}
        redraw(pane);
      };
    });
    pane.querySelectorAll('[data-par]').forEach(function (inp) {
      inp.oninput = function () {
        var key = inp.getAttribute('data-par'), v = +inp.value;
        s.params[key] = v;
        var out = pane.querySelector('[data-val="' + key + '"]');
        if (out) out.textContent = fmtVal(key, v);
        try { localStorage.setItem(LS_PAR, JSON.stringify(s.params)); } catch (e) {}
        redrawSoon(pane);
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

  window.TechSection = {
    render: render,
    _press: { defaults: defaults, clusterize: clusterize, chanOf: chanOf, boundaryBits: boundaryBits, otsu: otsu, pressTrame: pressTrame, pressSeuil: pressSeuil, pressTrait: pressTrait },
  };
})();
