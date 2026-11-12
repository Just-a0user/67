(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Konstanten ---------- */
  var CHARS = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,!?-:;()"\'/&@+=%€');
  var CHARSET = {};
  CHARS.forEach(function (c) { CHARSET[c] = true; });

  // Hilfslinien im Schreibfeld, in Anteilen der Feldhöhe (= 1 em)
  var ASC = 0.2, XH = 0.45, BASE = 0.7, DESC = 0.9;
  var SPACE = 0.3;           // Breite eines Leerzeichens in em
  var EXPORT_EM = 240;       // Pixelhöhe der exportierten PNGs
  var STORE_G = 'hw67_glyphs_v1';
  var STORE_S = 'hw67_settings_v1';

  var DEFAULTS = {
    pen: 0.02, color: '#1b2a6b', target: 3, auto: true,
    size: 90, gnSize: 48, jitter: 50, spacing: 0.05, lineHeight: 0.85, unit: 'letter',
    text: 'Hallo Welt!\nSo sieht meine Handschrift aus. 0123456789'
  };

  /* ---------- Speicher ---------- */
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { alert('Speichern im Browser ist fehlgeschlagen (Speicher voll oder gesperrt).'); }
  }

  var glyphs = sanitizeGlyphs(load(STORE_G, {}));
  var settings = Object.assign({}, DEFAULTS, load(STORE_S, {}));

  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }

  function sanitizeGlyphs(src) {
    var out = {};
    if (!src || typeof src !== 'object') return out;
    Object.keys(src).forEach(function (ch) {
      if (!CHARSET[ch] || !Array.isArray(src[ch])) return;
      var list = [];
      src[ch].forEach(function (v) {
        if (!v || !Array.isArray(v.strokes)) return;
        var strokes = [];
        v.strokes.forEach(function (s) {
          if (!Array.isArray(s)) return;
          var pts = [];
          s.forEach(function (p) {
            if (Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])) {
              pts.push([Number(p[0]), Number(p[1]), isFinite(p[2]) ? Number(p[2]) : 0.5]);
            }
          });
          if (pts.length) strokes.push(pts);
        });
        if (strokes.length) list.push({ w: Math.max(0.03, num(v.w, 0.3)), strokes: strokes });
      });
      if (list.length) out[ch] = list;
    });
    return out;
  }

  /* ---------- Zeichnen ---------- */
  function pf(p) { return 0.55 + 0.9 * p; }   // Druck -> Breitenfaktor (0.5 => 1.0)

  // Punkte liegen in em-Einheiten (1 em = Höhe des Schreibfelds)
  function drawStrokes(ctx, strokes, ox, oy, size, color, pen, lwMul) {
    lwMul = lwMul || 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach(function (s) {
      if (!s.length) return;
      if (s.length === 1) {
        ctx.beginPath();
        ctx.arc(ox + s[0][0] * size, oy + s[0][1] * size, Math.max(0.5, pen * size * pf(s[0][2]) * lwMul / 2), 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      for (var i = 1; i < s.length; i++) {
        var a = s[i - 1], b = s[i];
        ctx.lineWidth = Math.max(0.5, pen * size * pf((a[2] + b[2]) / 2) * lwMul);
        ctx.beginPath();
        ctx.moveTo(ox + a[0] * size, oy + a[1] * size);
        ctx.lineTo(ox + b[0] * size, oy + b[1] * size);
        ctx.stroke();
      }
    });
  }

  /* ======================================================
     1. SCHRIFT AUFNEHMEN
     ====================================================== */
  var pad = $('pad');
  var pctx = pad.getContext('2d');
  var padW = 0, padH = 0, dpr = 1;
  var curCh = CHARS[0];
  var strokes = [];
  var activeStroke = null;
  var activeId = null;
  var penSeen = false;

  function sizePad() {
    var wrap = $('padWrap');
    var w = Math.min(wrap.clientWidth || 600, 720);
    if (w < 50) return;
    padW = w;
    padH = Math.round(w * 0.7);
    dpr = window.devicePixelRatio || 1;
    pad.width = Math.round(padW * dpr);
    pad.height = Math.round(padH * dpr);
    pad.style.width = padW + 'px';
    pad.style.height = padH + 'px';
    redrawPad();
  }

  function guide(y, color, width) {
    pctx.strokeStyle = color;
    pctx.lineWidth = width;
    pctx.beginPath();
    pctx.moveTo(0, y * padH);
    pctx.lineTo(padW, y * padH);
    pctx.stroke();
  }

  function redrawPad() {
    if (!padW) return;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.clearRect(0, 0, padW, padH);
    pctx.fillStyle = '#fff';
    pctx.fillRect(0, 0, padW, padH);
    guide(ASC, '#e3e8f7', 1);
    guide(XH, '#e3e8f7', 1);
    guide(DESC, '#e3e8f7', 1);
    guide(BASE, '#9db1ee', 2);
    drawStrokes(pctx, strokes, 0, 0, padH, settings.color, settings.pen, 1);
  }

  function addPoint(e) {
    var r = pad.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.height;
    var y = (e.clientY - r.top) / r.height;
    var p = (e.pointerType === 'pen' && e.pressure > 0) ? e.pressure : 0.5;
    var last = activeStroke[activeStroke.length - 1];
    if (last && Math.hypot(x - last[0], y - last[1]) < 0.002) return;
    activeStroke.push([x, y, p]);
  }

  pad.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'pen') penSeen = true;
    if (e.pointerType === 'touch' && penSeen) return;   // Handballen ignorieren, sobald ein Pencil benutzt wurde
    if (activeStroke) return;
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
    activeId = e.pointerId;
    activeStroke = [];
    addPoint(e);
    strokes.push(activeStroke);
    redrawPad();
  });
  pad.addEventListener('pointermove', function (e) {
    if (!activeStroke || e.pointerId !== activeId) return;
    e.preventDefault();
    var list = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
    if (list.length) list.forEach(addPoint); else addPoint(e);
    redrawPad();
  });
  function endStroke(e) {
    if (!activeStroke || e.pointerId !== activeId) return;
    activeStroke = null;
    activeId = null;
    redrawPad();
  }
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);
  pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function r4(v) { return Math.round(v * 10000) / 10000; }

  function saveVariant() {
    if (!strokes.length) return;
    var minX = Infinity, maxX = -Infinity;
    strokes.forEach(function (s) { s.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }); });
    var out = strokes.map(function (s) {
      return s.map(function (p) { return [r4(p[0] - minX), r4(p[1]), Math.round(p[2] * 100) / 100]; });
    });
    if (!glyphs[curCh]) glyphs[curCh] = [];
    glyphs[curCh].push({ w: r4(Math.max(0.03, maxX - minX)), strokes: out });
    save(STORE_G, glyphs);
    strokes = [];
    var n = glyphs[curCh].length;
    if (settings.auto && n >= settings.target) {
      var i = CHARS.indexOf(curCh);
      curCh = CHARS[(i + 1) % CHARS.length];
    }
    refreshWrite();
  }

  function selectChar(ch) {
    curCh = ch;
    strokes = [];
    refreshWrite();
  }

  function buildGrid() {
    var g = $('charGrid');
    g.innerHTML = '';
    var done = 0;
    CHARS.forEach(function (ch) {
      var n = (glyphs[ch] || []).length;
      if (n >= settings.target) done++;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ch' + (ch === curCh ? ' sel' : '') + (n >= settings.target ? ' done' : (n > 0 ? ' some' : ''));
      var t = document.createElement('span');
      t.textContent = ch;
      b.appendChild(t);
      if (n) { var c = document.createElement('i'); c.textContent = n; b.appendChild(c); }
      b.addEventListener('click', function () { selectChar(ch); });
      g.appendChild(b);
    });
    $('progress').textContent = done + ' von ' + CHARS.length + ' Zeichen mit mindestens ' + settings.target + ' Varianten';
  }

  function buildVariants() {
    var box = $('variants');
    box.innerHTML = '';
    (glyphs[curCh] || []).forEach(function (v, idx) {
      var d = document.createElement('div');
      d.className = 'variant';
      var cv = document.createElement('canvas');
      var s = 82, ratio = 2;
      cv.width = s * ratio; cv.height = s * ratio;
      var c = cv.getContext('2d');
      c.setTransform(ratio, 0, 0, ratio, 0, 0);
      var size = Math.min(s, (s - 14) / Math.max(v.w, 0.01));
      drawStrokes(c, v.strokes, (s - v.w * size) / 2, (s - size) / 2 + 0.05 * size, size, settings.color, settings.pen, 1);
      d.appendChild(cv);
      var del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.setAttribute('aria-label', 'Variante löschen');
      del.addEventListener('click', function () {
        glyphs[curCh].splice(idx, 1);
        if (!glyphs[curCh].length) delete glyphs[curCh];
        save(STORE_G, glyphs);
        refreshWrite();
      });
      d.appendChild(del);
      box.appendChild(d);
    });
  }

  function refreshWrite() {
    $('curChar').textContent = curCh;
    $('curCount').textContent = (glyphs[curCh] || []).length + ' Variante(n) gespeichert';
    buildGrid();
    buildVariants();
    redrawPad();
  }

  $('btnUndo').addEventListener('click', function () { strokes.pop(); redrawPad(); });
  $('btnClear').addEventListener('click', function () { strokes = []; redrawPad(); });
  $('btnSave').addEventListener('click', saveVariant);

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }

  $('btnBackup').addEventListener('click', function () {
    download(new Blob([JSON.stringify({ version: 1, glyphs: glyphs })], { type: 'application/json' }), 'meine-handschrift.json');
  });
  $('fileRestore').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var g = sanitizeGlyphs(data && data.glyphs);
        var count = Object.keys(g).length;
        if (!count) { alert('In der Datei wurde keine Handschrift gefunden.'); return; }
        if (!confirm(count + ' Zeichen laden? Die aktuelle Handschrift wird ersetzt.')) return;
        glyphs = g;
        save(STORE_G, glyphs);
        refreshWrite();
      } catch (err) { alert('Datei konnte nicht gelesen werden.'); }
    };
    reader.readAsText(f);
  });
  $('btnWipe').addEventListener('click', function () {
    if (!confirm('Wirklich die komplette Handschrift löschen?')) return;
    glyphs = {};
    save(STORE_G, glyphs);
    strokes = [];
    refreshWrite();
  });

  /* ======================================================
     2. TEXT & EXPORT
     ====================================================== */
  var seed = 1;
  var lastLayout = null;
  var parts = [];      // [{ name, blob, url }]

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function currentOpts() {
    return { jitter: settings.jitter / 100, spacing: settings.spacing, pen: settings.pen, color: settings.color };
  }

  // Erzeugt eine zufällig leicht veränderte Kopie eines Buchstabens
  function makeInstance(ch, rnd, o, last) {
    var vs = glyphs[ch];
    if (!vs || !vs.length) return null;
    var idx = Math.floor(rnd() * vs.length);
    if (vs.length > 1 && idx === last[ch]) idx = (idx + 1 + Math.floor(rnd() * (vs.length - 1))) % vs.length;
    last[ch] = idx;
    var v = vs[idx];
    var j = o.jitter;

    var rot = (rnd() - 0.5) * 2 * 0.10 * j;
    var sc = 1 + (rnd() - 0.5) * 2 * 0.08 * j;
    var dy = (rnd() - 0.5) * 2 * 0.018 * j;
    var amp = 0.006 * j;
    var ph1 = rnd() * 6.283, ph2 = rnd() * 6.283;
    var cx = v.w / 2, cy = BASE;
    var cos = Math.cos(rot), sin = Math.sin(rot);

    var minX = Infinity, maxX = -Infinity;
    var out = v.strokes.map(function (s) {
      return s.map(function (p) {
        var X = (p[0] - cx) * sc, Y = (p[1] - cy) * sc;
        var rx = X * cos - Y * sin + cx;
        var ry = X * sin + Y * cos + cy + dy;
        rx += amp * Math.sin(ry * 14 + ph1);
        ry += amp * Math.sin(rx * 14 + ph2);
        if (rx < minX) minX = rx;
        if (rx > maxX) maxX = rx;
        return [rx, ry, p[2]];
      });
    });
    out.forEach(function (s) { s.forEach(function (p) { p[0] -= minX; }); });

    var w = Math.max(0.03, maxX - minX);
    return {
      ch: ch,
      strokes: out,
      w: w,
      lw: 1 + (rnd() - 0.5) * 0.2 * j,
      adv: w + o.spacing + (rnd() - 0.5) * 0.03 * j
    };
  }

  function layout(text, o, maxW) {
    var rnd = mulberry32(seed);
    var last = {};
    var missing = {};
    var lines = [];
    var line = [];
    var x = 0;
    var letters = [];
    var words = [];

    function newLine() { lines.push(line); line = []; x = 0; }

    text.replace(/\r/g, '').split('\n').forEach(function (para, pi) {
      if (pi > 0) newLine();
      para.split(/( +)/).forEach(function (tok) {
        if (!tok) return;
        if (/^ +$/.test(tok)) {
          for (var i = 0; i < tok.length; i++) {
            if (x > 0) x += SPACE + (rnd() - 0.5) * 0.04 * o.jitter;
          }
          return;
        }
        var insts = [];
        Array.from(tok).forEach(function (ch) {
          var inst = makeInstance(ch, rnd, o, last);
          if (inst) insts.push(inst); else missing[ch] = true;
        });
        if (!insts.length) return;
        var wW = insts.reduce(function (s, i) { return s + i.adv; }, 0);
        if (x > 0 && x + wW > maxW) newLine();
        var wx = 0, items = [];
        insts.forEach(function (inst) {
          if (x > 0 && x + inst.w > maxW) newLine();
          inst.line = lines.length;   // Zeilenindex und x-Position für den Seitenexport
          inst.lx = x;
          line.push({ inst: inst, x: x });
          letters.push(inst);
          items.push({ inst: inst, x: wx });
          x += inst.adv;
          wx += inst.adv;
        });
        words.push(items);
      });
    });
    lines.push(line);
    return { lines: lines, letters: letters, words: words, missing: Object.keys(missing) };
  }

  function renderPreview() {
    var cv = $('preview');
    var wrap = $('previewWrap');
    var cssW = Math.max(220, wrap.clientWidth || 600);
    var size = settings.size;
    var margin = Math.round(size * 0.25);
    var o = currentOpts();
    var L = layout(settings.text, o, (cssW - 2 * margin) / size);
    lastLayout = L;

    var lh = settings.lineHeight;
    var cssH = Math.ceil(margin * 2 + (L.lines.length - 1) * lh * size + size);
    var d = window.devicePixelRatio || 1;
    while (cssW * d * cssH * d > 1.6e7 && d > 1) d -= 0.5;
    cv.width = Math.round(cssW * d);
    cv.height = Math.round(cssH * d);
    cv.style.width = cssW + 'px';
    cv.style.height = cssH + 'px';
    var ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cssW, cssH);
    L.lines.forEach(function (ln, i) {
      var oy = margin + i * lh * size;
      ln.forEach(function (it) {
        drawStrokes(ctx, it.inst.strokes, margin + it.x * size, oy, size, o.color, o.pen, it.inst.lw);
      });
    });

    var warn = $('missing');
    if (L.missing.length) {
      warn.hidden = false;
      warn.textContent = 'Noch nicht aufgenommen, wird übersprungen: ' + L.missing.join(' ');
    } else {
      warn.hidden = true;
    }
  }

  var previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(function () {
      if (!$('viewText').hidden) renderPreview();
    }, 120);
  }

  /* ---------- Export ---------- */
  function partLabel(unit, items) {
    if (unit === 'letter') {
      var ch = items[0].inst.ch;
      return /^[A-Za-z0-9]$/.test(ch) ? ch : 'u' + ch.codePointAt(0).toString(16);
    }
    var s = items.map(function (it) { return it.inst.ch; }).join('');
    s = s.replace(/[^A-Za-z0-9]/g, '_').slice(0, 20);
    return s || 'wort';
  }

  var PADX = 0.06, PADY = 0.04;   // Rand um jedes exportierte Teil, in em

  // liefert { blob, w, h } (Pixelmaße des PNG)
  function renderUnit(items, o) {
    var EM = EXPORT_EM, padX = PADX, padY = PADY;
    var minX = Infinity, maxX = -Infinity;
    items.forEach(function (it) {
      minX = Math.min(minX, it.x);
      maxX = Math.max(maxX, it.x + it.inst.w);
    });
    var cv = document.createElement('canvas');
    cv.width = Math.ceil((maxX - minX + 2 * padX) * EM);
    cv.height = Math.ceil((1 + 2 * padY) * EM);
    var ctx = cv.getContext('2d');
    items.forEach(function (it) {
      drawStrokes(ctx, it.inst.strokes, (it.x - minX + padX) * EM, padY * EM, EM, o.color, o.pen, it.inst.lw);
    });
    return new Promise(function (res) {
      cv.toBlob(function (blob) { res({ blob: blob, w: cv.width, h: cv.height }); }, 'image/png');
    });
  }

  function clearParts() {
    parts.forEach(function (p) { URL.revokeObjectURL(p.url); });
    parts = [];
    $('parts').innerHTML = '';
    $('partsActions').hidden = true;
  }

  async function buildParts() {
    if (!lastLayout) renderPreview();
    clearParts();
    var o = currentOpts();
    var unit = settings.unit;
    var units = unit === 'word'
      ? lastLayout.words
      : lastLayout.letters.map(function (inst) { return [{ inst: inst, x: 0 }]; });
    if (!units.length) { $('partsStatus').textContent = 'Nichts zu exportieren. Nimm zuerst Zeichen auf oder gib Text ein.'; return; }

    var btn = $('btnParts');
    btn.disabled = true;
    var box = $('parts');
    for (var i = 0; i < units.length; i++) {
      $('partsStatus').textContent = 'Erzeuge ' + (i + 1) + ' von ' + units.length + ' …';
      var blob = (await renderUnit(units[i], o)).blob;
      var name = String(i + 1).padStart(3, '0') + '_' + partLabel(unit, units[i]) + '.png';
      var url = URL.createObjectURL(blob);
      parts.push({ name: name, blob: blob, url: url });

      var fig = document.createElement('figure');
      var img = document.createElement('img');
      img.src = url;
      img.alt = name;
      img.draggable = true;
      var cap = document.createElement('figcaption');
      cap.textContent = name;
      fig.appendChild(img);
      fig.appendChild(cap);
      box.appendChild(fig);
      if (i % 10 === 9) await new Promise(function (r) { setTimeout(r, 0); });
    }
    btn.disabled = false;
    $('partsStatus').textContent = units.length + ' Teile bereit.';
    $('partsActions').hidden = false;
  }

  async function downloadZip() {
    if (!parts.length) return;
    var files = [];
    for (var i = 0; i < parts.length; i++) {
      files.push({ name: parts[i].name, data: new Uint8Array(await parts[i].blob.arrayBuffer()) });
    }
    download(new Blob([makeZip(files)], { type: 'application/zip' }), 'handschrift-teile.zip');
  }

  async function shareParts() {
    if (!parts.length) return;
    var files = parts.map(function (p) { return new File([p.blob], p.name, { type: 'image/png' }); });
    if (navigator.canShare && navigator.canShare({ files: files }) && navigator.share) {
      try { await navigator.share({ files: files }); }
      catch (e) { /* abgebrochen */ }
    } else {
      alert('Teilen wird hier nicht unterstützt. Bitte die ZIP-Datei laden.');
    }
  }

  /* ---------- .goodnotes (experimentell) ---------- */
  var gnFile = null;   // zuletzt erzeugte Datei { blob, name }

  async function exportGoodnotes() {
    var status = $('gnStatus');
    var btn = $('btnGn');
    $('gnActions').hidden = true;
    gnFile = null;
    if (typeof buildGoodnotes !== 'function' || !globalThis.GN_TEMPLATE) { status.textContent = 'GoodNotes-Modul nicht geladen.'; return; }
    btn.disabled = true;
    try {
      var o = currentOpts();
      var P = globalThis.GN_PAGE;
      var areaW = P.right - P.left, areaH = P.bottom - P.top;
      var lh = settings.lineHeight;
      var size = settings.gnSize, L, shrunk = false;
      for (;;) {
        L = layout(settings.text, o, areaW / size);
        var needH = (L.lines.length - 1) * lh * size + size;
        if (needH <= areaH || size <= 16) break;
        size *= 0.93; shrunk = true;
      }
      var units = settings.unit === 'word'
        ? L.words.map(function (items) { return { items: items, line: items[0].inst.line, lx: items[0].inst.lx }; })
        : L.letters.map(function (inst) { return { items: [{ inst: inst, x: 0 }], line: inst.line, lx: inst.lx }; });
      if (!units.length) { status.textContent = 'Nichts zu exportieren. Nimm zuerst Zeichen auf oder gib Text ein.'; return; }

      var images = [];
      for (var i = 0; i < units.length; i++) {
        status.textContent = 'Erzeuge ' + (i + 1) + ' von ' + units.length + ' …';
        var u = units[i];
        var r = await renderUnit(u.items, o);
        images.push({
          png: new Uint8Array(await r.blob.arrayBuffer()),
          x: P.left + (u.lx - PADX) * size,
          y: P.top + u.line * lh * size - PADY * size,
          w: r.w * size / EXPORT_EM,
          h: r.h * size / EXPORT_EM
        });
        if (i % 10 === 9) await new Promise(function (r2) { setTimeout(r2, 0); });
      }

      // Vorschaubild der Seite
      var tw = 386, th = 499, s = tw / P.w;
      var tc = document.createElement('canvas');
      tc.width = tw; tc.height = th;
      var tctx = tc.getContext('2d');
      tctx.fillStyle = '#fff';
      tctx.fillRect(0, 0, tw, th);
      L.lines.forEach(function (ln, li) {
        ln.forEach(function (it) {
          drawStrokes(tctx, it.inst.strokes, (P.left + it.x * size) * s, (P.top + li * lh * size) * s, size * s, o.color, o.pen, it.inst.lw);
        });
      });
      var thumb = new Uint8Array(await new Promise(function (res) { tc.toBlob(res, 'image/jpeg', 0.85); }).then(function (b) { return b.arrayBuffer(); }));

      var data = buildGoodnotes(images, thumb);
      gnFile = { blob: new Blob([data], { type: 'application/octet-stream' }), name: 'handschrift.goodnotes' };
      status.textContent = units.length + ' Bildobjekte auf Seite 2' + (shrunk ? ' (Schrift automatisch verkleinert, damit alles auf die Seite passt)' : '') + '. Datei bereit.';
      $('gnActions').hidden = false;
    } catch (err) {
      status.textContent = 'Fehler: ' + (err && err.message ? err.message : err);
    } finally {
      btn.disabled = false;
    }
  }

  $('btnGn').addEventListener('click', exportGoodnotes);
  $('btnGnDownload').addEventListener('click', function () { if (gnFile) download(gnFile.blob, gnFile.name); });
  $('btnGnShare').addEventListener('click', async function () {
    if (!gnFile) return;
    var f = new File([gnFile.blob], gnFile.name, { type: 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [f] }) && navigator.share) {
      try { await navigator.share({ files: [f] }); } catch (e) { /* abgebrochen */ }
    } else {
      download(gnFile.blob, gnFile.name);
    }
  });

  $('btnParts').addEventListener('click', buildParts);
  $('btnZip').addEventListener('click', downloadZip);
  $('btnShare').addEventListener('click', shareParts);
  $('btnReroll').addEventListener('click', function () { seed = (Math.random() * 1e9) | 0; renderPreview(); });

  /* ---------- Einstellungen binden ---------- */
  function fmt(k, v) {
    if (k === 'pen') return (Math.round(v * 1000) / 1000).toString();
    if (k === 'jitter') return v + ' %';
    if (k === 'size') return v + ' px';
    if (k === 'gnSize') return v + ' pt';
    return (Math.round(v * 100) / 100).toString();
  }

  document.querySelectorAll('[data-set]').forEach(function (el) {
    var k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = settings[k];
    var out = document.querySelector('[data-val="' + k + '"]');
    if (out) out.textContent = fmt(k, settings[k]);
    el.addEventListener('input', function () {
      var v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'range' || el.type === 'number') v = num(el.value, DEFAULTS[k]);
      else v = el.value;
      if (k === 'target') v = Math.min(10, Math.max(1, Math.round(v)));
      settings[k] = v;
      save(STORE_S, settings);
      if (out) out.textContent = fmt(k, v);
      if (k === 'pen' || k === 'color') { redrawPad(); buildVariants(); }
      if (k === 'target') buildGrid();
      schedulePreview();
    });
  });

  /* ---------- Tabs ---------- */
  function showTab(which) {
    var w = which === 'write';
    $('viewWrite').hidden = !w;
    $('viewText').hidden = w;
    $('tabWrite').classList.toggle('active', w);
    $('tabText').classList.toggle('active', !w);
    if (w) sizePad(); else renderPreview();
  }
  $('tabWrite').addEventListener('click', function () { showTab('write'); });
  $('tabText').addEventListener('click', function () { showTab('text'); });

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!$('viewWrite').hidden) sizePad(); else renderPreview();
    }, 150);
  });

  /* ---------- Start ---------- */
  refreshWrite();
  sizePad();
})();
