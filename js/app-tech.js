/* app-tech.js — TECH section: the image press.
   Upload / paste a screenshot of any object → press it into a Cyberpunk 2020
   sourcebook illustration (the original books did exactly this: high-contrast
   thresholded photos). Pure canvas, no server, ink #111 on pure white.

   Layout: SOURCE plate on the left (colour original — the pipette and the cutout
   lasso work HERE), pressed plate on the right. Pipeline: colour separation first
   (deterministic k-means over RGB, labels cleaned by 3×3 majority vote, clusters
   ranked by brightness onto spread tones); every cluster is a CHIP (colour swatch
   → editable gray) — the pipette picks a pixel on the source and selects its
   chip. Outline = region-boundary map (crisp, no texture noise). Cutout: one or
   MORE polygons drawn full-page on the source (live preview line, draggable
   points); outside the union stays present but FADES INSIDE THE PRESS
   ITSELF (ordered Bayer mask on the ink — still strictly 1-bit), dosed by BACKDROP.
   Exposes window.TechSection { render(tab, pane) }. */
(function () {
  'use strict';
  var INK = 17;                       // #111
  var MAXW = 1000;                    // longest side after downscale, px
  var LS_MODE = 'bartmoss_tech_mode';
  var LS_PAR = 'bartmoss_tech_params';
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  var MODES = [
    { key: 'trame', label: 'HALFTONE', title: 'Atkinson dither + region outline — the sourcebook look' },
    { key: 'seuil', label: 'THRESHOLD', title: 'Hard threshold (Otsu + level) on separated tones' },
    { key: 'trait', label: 'LINES', title: 'Line drawing — region boundaries + strong gradients' },
  ];
  function modeLabel(key) { for (var i = 0; i < MODES.length; i++) if (MODES[i].key === key) return MODES[i].label; return key; }
  function defaults() {
    return { k: 5, chroma: 250, relief: 40, gamma: 100, bias: 0, outline: 1, fine: 88, fond: 35 };
  }
  // slider registry: [key, label, min, max, step, title, advancedOnly]
  var SLIDERS = [
    ['k', 'COLORS', 2, 8, 1, 'colour groups — how many tones the press separates', false],
    ['outline', 'OUTLINE', 0, 3, 1, 'region-boundary line thickness in px (0 = off)', false],
    ['fond', 'BACKDROP', 0, 100, 5, 'outside the cutout: how much of the press remains (0 = removed)', false],
    ['chroma', 'HUE', 100, 500, 25, 'how much hue separates the groups — raise it when two colours of similar darkness merge (blue vs gray)', true],
    ['relief', 'SHADING', 0, 100, 5, 'in-region shading kept (0 = flat poster tones)', true],
    ['gamma', 'GAMMA', 40, 250, 5, 'tone curve before the press (1.00 = neutral; lower = darker plate)', true],
    ['bias', 'LEVEL', -60, 60, 2, 'THRESHOLD: ink more (+) or less (−) than Otsu suggests', true],
    ['fine', 'DETAIL', 70, 98, 1, 'LINES: gradient percentile — higher = fewer, finer lines', true],
  ];
  var LS_ADV = 'bartmoss_tech_adv';

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
      labels: null, L: null, mL: null, tone: null, cent: null, _kDone: 0,
      toneOv: {},                    // pipette: label → user gray
      selLab: -1,                    // selected chip
      tool: 'none',                  // 'none' | 'pip' | 'cut'
      adv: localStorage.getItem(LS_ADV) === '1',
      cuts: [], draft: [], _mask: null, _hover: null, _drag: null, _moved: false,
    };
    return pane._tech;
  }

  /* ── stage 1 · COLOUR SEPARATION: k-means, deterministic. The distance runs in
     [Y, α·Cb, α·Cr] — chrominance AMPLIFIED (α = HUE/100) so hue separates
     groups more than brightness: a dark desaturated blue and a dark gray are
     neighbours in RGB but far apart here. ── */
  function clusterize(s) {
    var d = s.rgba, W = s.w, H = s.h, N = W * H, K = s.params.k, i, k;
    var A = s.params.chroma / 100;
    var L = s.L;
    if (!L) {
      L = new Float32Array(N);
      for (i = 0; i < N; i++) { var j0 = i * 4; L[i] = 0.2126 * d[j0] + 0.7152 * d[j0 + 1] + 0.0722 * d[j0 + 2]; }
      s.L = L;
    }
    var feat = function (i2) {                                   // pixel → [Y, α·Cb, α·Cr]
      var p3 = i2 * 4, Y = L[i2];
      return [Y, A * (d[p3 + 2] - Y), A * (d[p3] - Y)];
    };
    var step = Math.max(1, Math.floor(N / 12000)), samp = [];
    for (i = 0; i < N; i += step) samp.push(i);
    var sorted = samp.slice().sort(function (a, b) { return L[a] - L[b]; });
    var cent = [], centF = [];
    for (k = 0; k < K; k++) {
      var sIdx = sorted[Math.floor((k + 0.5) / K * (sorted.length - 1))];
      var si = sIdx * 4;
      cent.push([d[si], d[si + 1], d[si + 2]]);
      centF.push(feat(sIdx));
    }
    var nearest = function (f) {
      var bi = 0, bd = Infinity;
      for (var c = 0; c < K; c++) {
        var d0 = f[0] - centF[c][0], d1 = f[1] - centF[c][1], d2 = f[2] - centF[c][2];
        var dist = d0 * d0 + d1 * d1 + d2 * d2;
        if (dist < bd) { bd = dist; bi = c; }
      }
      return bi;
    };
    for (var it = 0; it < 8; it++) {
      var sum = [], sumF = [], cnt = [];
      for (k = 0; k < K; k++) { sum.push([0, 0, 0]); sumF.push([0, 0, 0]); cnt.push(0); }
      for (i = 0; i < samp.length; i++) {
        var f2 = feat(samp[i]), c = nearest(f2), p = samp[i] * 4;
        sum[c][0] += d[p]; sum[c][1] += d[p + 1]; sum[c][2] += d[p + 2];
        sumF[c][0] += f2[0]; sumF[c][1] += f2[1]; sumF[c][2] += f2[2];
        cnt[c]++;
      }
      for (k = 0; k < K; k++) if (cnt[k]) {
        cent[k] = [sum[k][0] / cnt[k], sum[k][1] / cnt[k], sum[k][2] / cnt[k]];
        centF[k] = [sumF[k][0] / cnt[k], sumF[k][1] / cnt[k], sumF[k][2] / cnt[k]];
      }
    }
    // label every pixel, then clean speckle with a 3×3 majority vote (crisp regions)
    var lab = new Uint8Array(N);
    for (i = 0; i < N; i++) lab[i] = nearest(feat(i));
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
    s.labels = lab2; s.mL = mL; s.tone = tone; s.cent = cent; s._kDone = K; s._cDone = s.params.chroma;
    s.toneOv = {}; s.selLab = -1;                 // new clustering = new chips
  }

  /* ── stage 2 · the separated channel: chip tones + relief + gamma ── */
  function toneOf(s, c) { return s.toneOv[c] != null ? s.toneOv[c] : s.tone[c]; }
  function chanOf(s) {
    var N = s.w * s.h, out = new Float32Array(N);
    var relief = s.params.relief / 100, inv = 100 / s.params.gamma;
    for (var i = 0; i < N; i++) {
      var c = s.labels[i];
      var v = Math.max(0, Math.min(255, toneOf(s, c) + relief * (s.L[i] - s.mL[c])));
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

  /* ── cutout: polygon (source px) → inside mask; outside fades IN the press ── */
  function pointInPoly(pts, x, y) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function maskOf(s) {
    var zones = (s.cuts || []).filter(function (c) { return c.pts.length >= 3; });
    if (!zones.length) return null;
    if (s._mask) return s._mask;
    var W = s.w, H = s.h, m = new Uint8Array(W * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      for (var z = 0; z < zones.length; z++) if (pointInPoly(zones[z].pts, x + 0.5, y + 0.5)) { m[y * W + x] = 1; break; }
    }
    s._mask = m;
    return m;
  }
  function applyFade(s, bits) {
    var m = maskOf(s); if (!m) return bits;
    var keep = s.params.fond / 100, W = s.w;
    for (var i = 0; i < bits.length; i++) {
      if (bits[i] || m[i]) continue;                             // ink outside the cutout:
      var x = i % W, y = (i / W) | 0;
      if (BAYER[y & 3][x & 3] / 16 >= keep) bits[i] = 1;         // thin it — still 1-bit
    }
    return bits;
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
    return applyFade(s, out);
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
    return applyFade(s, out);
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
    return applyFade(s, out);
  }

  function press(s) {
    if (!s.rgba) return null;
    if (s._kDone !== s.params.k || s._cDone !== s.params.chroma || !s.labels) clusterize(s);
    var fn = s.mode === 'seuil' ? pressSeuil : s.mode === 'trait' ? pressTrait : pressTrame;
    return fn(s);
  }
  function paintPress(canvas, s) {
    var bits = press(s); if (!bits) return;
    canvas.width = s.w; canvas.height = s.h;
    var x = canvas.getContext('2d'), im = x.createImageData(s.w, s.h), d = im.data;
    for (var i = 0, j = 0; i < bits.length; i++, j += 4) {
      var v = bits[i] ? 255 : INK;
      d[j] = v; d[j + 1] = v; d[j + 2] = v; d[j + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  }
  function paintSource(canvas, s) {
    canvas.width = s.w; canvas.height = s.h;
    var x = canvas.getContext('2d');
    x.putImageData(new ImageData(new Uint8ClampedArray(s.rgba), s.w, s.h), 0, 0);
    var lw = Math.max(1.5, s.w / 400), r = Math.max(2.5, s.w / 250);
    var drawPoly = function (pts, closed) {
      if (!pts.length) return;
      x.strokeStyle = '#111'; x.lineWidth = lw; x.setLineDash([6, 4]);
      x.beginPath();
      x.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
      if (closed) x.closePath();
      x.stroke(); x.setLineDash([]);
      x.fillStyle = '#fff'; x.strokeStyle = '#111'; x.lineWidth = 1.5;
      for (i = 0; i < pts.length; i++) { x.fillRect(pts[i][0] - r, pts[i][1] - r, 2 * r, 2 * r); x.strokeRect(pts[i][0] - r, pts[i][1] - r, 2 * r, 2 * r); }
    };
    for (var z = 0; z < s.cuts.length; z++) drawPoly(s.cuts[z].pts, true);
    drawPoly(s.draft, false);
    // live preview: last draft point → cursor; snaps SOLID onto the first point when closable
    if (s.tool === 'cut' && s.draft.length && s._hover && !s._drag) {
      var last = s.draft[s.draft.length - 1], tgt = s._hover;
      var closeR = Math.max(6, s.w / 60);
      var snap = s.draft.length >= 3 && Math.hypot(s.draft[0][0] - tgt[0], s.draft[0][1] - tgt[1]) < closeR;
      if (snap) tgt = s.draft[0];
      x.strokeStyle = '#111'; x.lineWidth = lw; x.setLineDash(snap ? [] : [3, 4]);
      x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(tgt[0], tgt[1]); x.stroke();
      x.setLineDash([]);
      if (snap) { x.fillStyle = '#111'; x.fillRect(s.draft[0][0] - r, s.draft[0][1] - r, 2 * r, 2 * r); }
    }
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
      s.toneOv = {}; s.selLab = -1; s.cuts = []; s.draft = []; s._mask = null; s.tool = 'none';
      s.name = (name || 'capture').replace(/\.[a-z0-9]+$/i, '');
      redraw(pane);
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* ── UI ── */
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function fmtVal(key, v) { return key === 'gamma' ? (v / 100).toFixed(2) : String(v); }
  function imgXY(canvas, s, e) {
    var r = canvas.getBoundingClientRect();
    return [Math.max(0, Math.min(s.w - 1, (e.clientX - r.left) * s.w / r.width)),
            Math.max(0, Math.min(s.h - 1, (e.clientY - r.top) * s.h / r.height))];
  }

  function chipsHtml(s) {
    if (!s.labels) return '';
    var order = [];
    for (var k = 0; k < s.params.k; k++) order.push(k);
    order.sort(function (a, b) { return toneOf(s, a) - toneOf(s, b); });
    return order.map(function (c) {
      var col = 'rgb(' + Math.round(s.cent[c][0]) + ',' + Math.round(s.cent[c][1]) + ',' + Math.round(s.cent[c][2]) + ')';
      var v = Math.round(toneOf(s, c));
      return '<span class="tech-chip' + (s.selLab === c ? ' is-sel' : '') + '" data-chip="' + c + '">' +
        '<span class="tech-chip-sw" style="background:' + col + '"></span>' +
        '<input type="range" data-tone="' + c + '" min="0" max="255" step="5" value="' + v + '">' +
        '<span class="tech-chip-v" data-tval="' + c + '">' + v + '</span></span>';
    }).join('');
  }

  function redraw(pane) {
    var s = st(pane);
    var stage = pane.querySelector('.tech-stage'), bar = pane.querySelector('.tech-modes');
    if (!stage) return;
    if (bar) bar.querySelectorAll('[data-mode]').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-mode') === s.mode);
    });
    pane.querySelectorAll('.tech-need-img').forEach(function (b) { b.disabled = !s.rgba; });
    var tp = pane.querySelector('.tech-tool-pip'), tc = pane.querySelector('.tech-tool-cut'), tz = pane.querySelector('.tech-tool-clear');
    if (tp) tp.classList.toggle('is-on', s.tool === 'pip');
    if (tc) tc.classList.toggle('is-on', s.tool === 'cut');
    if (tz) tz.style.display = (s.cuts.length || s.draft.length) ? '' : 'none';
    if (!s.rgba || !s.adv) {
      if (s.tool === 'pip') s.tool = 'none';
      pane.querySelector('.tech-tones').innerHTML = '';
    }
    if (!s.rgba) {
      stage.innerHTML =
        '<div class="tech-drop"><div class="tech-drop-g">▣</div>' +
        '<div class="tech-drop-l">DROP A SCREENSHOT</div>' +
        '<div class="tech-drop-s">click to browse · or paste with ⌘V</div></div>';
      stage.querySelector('.tech-drop').onclick = function () { pane.querySelector('.tech-file').click(); };
      return;
    }
    if (s._kDone !== s.params.k || s._cDone !== s.params.chroma || !s.labels) clusterize(s);
    // chips (picker targets) — advanced only
    var tones = pane.querySelector('.tech-tones');
    if (s.adv) {
    tones.innerHTML = '<span class="tech-tones-l">GRAYS</span>' + chipsHtml(s);
    tones.querySelectorAll('[data-tone]').forEach(function (inp) {
      inp.oninput = function () {
        var c = +inp.getAttribute('data-tone');
        s.toneOv[c] = +inp.value;
        var out = tones.querySelector('[data-tval="' + c + '"]');
        if (out) out.textContent = inp.value;
        redrawPressSoon(pane);
      };
    });
    tones.querySelectorAll('.tech-chip').forEach(function (ch) {
      ch.onclick = function (e) {
        if (e.target && e.target.getAttribute && e.target.getAttribute('data-tone')) return;   // slider drag
        s.selLab = +ch.getAttribute('data-chip');
        tones.querySelectorAll('.tech-chip').forEach(function (o) { o.classList.toggle('is-sel', +o.getAttribute('data-chip') === s.selLab); });
      };
    });
    }
    // plates — CUTOUT takes the FULL page (source only, live lasso); else side by side
    var cutMode = s.tool === 'cut';
    stage.classList.toggle('is-cutfull', cutMode);
    stage.innerHTML =
      '<div class="tech-plate tech-plate-src"><canvas class="tech-src"></canvas>' +
        '<div class="tech-plate-cap">SOURCE · ' + (cutMode ? 'CUTOUT: click = point · close on the first point · drag a point to move it · keep clicking for more zones' : s.tool === 'pip' ? 'PICKER: click a colour' : (s.adv ? 'picker + cutout work here' : 'cutout works here')) + '</div></div>' +
      (cutMode ? '' :
      '<div class="tech-plate"><canvas class="tech-canvas"></canvas>' +
        '<div class="tech-plate-cap">' + esc(s.name.toUpperCase()) + ' · ' + s.w + '×' + s.h + ' · 1-BIT · ' + modeLabel(s.mode) + '</div></div>');
    var src = stage.querySelector('.tech-src');
    paintSource(src, s);
    if (!cutMode) paintPress(stage.querySelector('.tech-canvas'), s);
    src.classList.toggle('is-pip', s.tool === 'pip');
    src.classList.toggle('is-cut', cutMode);
    // vertex hit-test over closed zones + the open draft (image px)
    var hitVertex = function (xy) {
      var r = Math.max(5, s.w / 90), i;
      for (var z = 0; z < s.cuts.length; z++) {
        var pts = s.cuts[z].pts;
        for (i = 0; i < pts.length; i++) if (Math.hypot(pts[i][0] - xy[0], pts[i][1] - xy[1]) < r) return { poly: z, i: i };
      }
      for (i = 0; i < s.draft.length; i++) if (Math.hypot(s.draft[i][0] - xy[0], s.draft[i][1] - xy[1]) < r) return { poly: -1, i: i };
      return null;
    };
    src.onmousedown = function (e) {
      if (!cutMode) return;
      var v = hitVertex(imgXY(src, s, e));
      if (v) { s._drag = v; s._moved = false; e.preventDefault(); }
    };
    src.onmousemove = function (e) {
      if (!cutMode) return;
      var xy = imgXY(src, s, e);
      s._hover = xy;
      if (s._drag) {
        s._moved = true;
        if (s._drag.poly >= 0) { s.cuts[s._drag.poly].pts[s._drag.i] = xy; s._mask = null; }
        else s.draft[s._drag.i] = xy;
      }
      paintSource(src, s);
    };
    src.onmouseleave = function () { if (cutMode) { s._hover = null; paintSource(src, s); } };
    src.onclick = function (e) {
      var xy = imgXY(src, s, e), xi = Math.round(xy[0]), yi = Math.round(xy[1]);
      if (s.tool === 'pip') {
        s.selLab = s.labels[yi * s.w + xi];
        var chips = pane.querySelectorAll('.tech-chip');
        chips.forEach(function (o) { o.classList.toggle('is-sel', +o.getAttribute('data-chip') === s.selLab); });
        return;
      }
      if (cutMode) {
        if (s._moved) { s._moved = false; return; }                       // that was a drag, not a click
        var closeR = Math.max(6, s.w / 60);
        var canClose = s.draft.length >= 3 && Math.hypot(s.draft[0][0] - xy[0], s.draft[0][1] - xy[1]) < closeR;
        if (canClose) {
          s.cuts.push({ pts: s.draft, closed: true });                    // zone closed — stay in the tool, add more
          s.draft = []; s._mask = null;
          redraw(pane);
        } else if (hitVertex(xy)) {
          /* clicking an existing point = grab target, not a new point */
        } else { s.draft.push([xy[0], xy[1]]); paintSource(src, s); }
      }
    };
  }
  var _rt = null;
  function redrawPressSoon(pane) {
    clearTimeout(_rt);
    _rt = setTimeout(function () {
      var s = st(pane), c = pane.querySelector('.tech-canvas');
      if (c && s.rgba) paintPress(c, s); else redraw(pane);
    }, 70);
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
        (s.adv ? '<button class="app-btn tech-tool-pip tech-need-img" title="pick a colour on the SOURCE — selects its gray chip">⌖ PICKER</button>' : '') +
        '<button class="app-btn tech-tool-cut tech-need-img" title="draw a polygon on the SOURCE around the object — outside fades (BACKDROP)">▱ CUTOUT</button>' +
        '<button class="app-btn tech-tool-clear" title="remove the cutout">✕ CLEAR</button>' +
        '<span class="tech-bar-sp"></span>' +
        '<button class="app-btn tech-adv' + (s.adv ? ' is-on' : '') + '" title="colour picker, gray chips, and the full slider set">⚙ ADVANCED</button>' +
        '<button class="app-btn tech-reset tech-need-img">↺ RESET</button>' +
        '<button class="app-btn tech-import">⇪ IMPORT</button>' +
        '<button class="app-btn tech-export tech-need-img">▤ EXPORT PNG</button>' +
        '<input type="file" class="tech-file" accept="image/*" style="display:none">' +
      '</div>' +
      '<div class="tech-ctrl">' + SLIDERS.filter(function (S) { return s.adv || !S[6]; }).map(function (S) {
        var v = s.params[S[0]];
        return '<label class="tech-sl" title="' + S[5] + '"><span class="tech-sl-l">' + S[1] + '</span>' +
          '<input type="range" data-par="' + S[0] + '" min="' + S[2] + '" max="' + S[3] + '" step="' + S[4] + '" value="' + v + '">' +
          '<span class="tech-sl-v" data-val="' + S[0] + '">' + fmtVal(S[0], v) + '</span></label>';
      }).join('') + '</div>' +
      '<div class="tech-tones"></div>' +
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
      s.params = defaults(); s.toneOv = {}; s.selLab = -1;
      try { localStorage.setItem(LS_PAR, JSON.stringify(s.params)); } catch (e) {}
      SLIDERS.forEach(function (S) {
        var inp = pane.querySelector('[data-par="' + S[0] + '"]'), out = pane.querySelector('[data-val="' + S[0] + '"]');
        if (inp) inp.value = s.params[S[0]];
        if (out) out.textContent = fmtVal(S[0], s.params[S[0]]);
      });
      redraw(pane);
    };
    pane.querySelector('.tech-adv').onclick = function () {
      s.adv = !s.adv;
      try { localStorage.setItem(LS_ADV, s.adv ? '1' : '0'); } catch (e) {}
      render(tab, pane);
    };
    var pipBtn = pane.querySelector('.tech-tool-pip');
    if (pipBtn) pipBtn.onclick = function () { s.tool = s.tool === 'pip' ? 'none' : 'pip'; redraw(pane); };
    pane.querySelector('.tech-tool-cut').onclick = function () {
      if (s.tool === 'cut') { s.tool = 'none'; s.draft = []; }
      else s.tool = 'cut';
      redraw(pane);
    };
    pane.querySelector('.tech-tool-clear').onclick = function () { s.cuts = []; s.draft = []; s._mask = null; redraw(pane); };
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
        if (key === 'k' || key === 'chroma') redraw(pane); else redrawPressSoon(pane);
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
    if (!pane._techUp) {
      pane._techUp = function () { var s2 = st(pane); s2._drag = null; };
      document.addEventListener('mouseup', pane._techUp);
    }
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
    _press: {
      defaults: defaults, clusterize: clusterize, chanOf: chanOf, boundaryBits: boundaryBits,
      otsu: otsu, pressTrame: pressTrame, pressSeuil: pressSeuil, pressTrait: pressTrait,
      maskOf: maskOf, applyFade: applyFade, toneOf: toneOf,
    },
  };
})();
