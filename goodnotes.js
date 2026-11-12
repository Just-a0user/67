/* Experimenteller .goodnotes-Writer.
 *
 * Das Format ist nicht dokumentiert. Dieser Writer baut ein Notizbuch nach dem Muster einer echten,
 * von GoodNotes erzeugten Datei (siehe goodnotes-template.js): zwei Seiten, Seite 2 enthält die
 * Bilder (je ein PNG pro Buchstabe/Wort) als einzelne Bildobjekte.
 * Alle Koordinaten sind Punkte auf einer Seite von 834.24 x 1078.825 pt, Ursprung oben links.
 */
(function (root) {
  'use strict';

  var DEVICE = 5785127698437571065n;   // konstante Kennung aus der Vorlage
  var PAGE_W = 834.24, PAGE_H = 1078.825;
  var SCHEMA = 24;

  /* ---------- Protobuf-Helfer ---------- */
  function varint(n) {
    var v = BigInt(n), out = [];
    while (v >= 0x80n) { out.push(Number(v & 0x7fn) | 0x80); v >>= 7n; }
    out.push(Number(v));
    return out;
  }
  function cat(list) {
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].length;
    var out = new Uint8Array(total), pos = 0;
    for (i = 0; i < list.length; i++) { out.set(list[i], pos); pos += list[i].length; }
    return out;
  }
  function u8(a) { return a instanceof Uint8Array ? a : Uint8Array.from(a); }
  function tag(f, w) { return u8(varint((f << 3) | w)); }
  function fVarint(f, v) { return cat([tag(f, 0), u8(varint(v))]); }
  function fBytes(f, b) { b = u8(b); return cat([tag(f, 2), u8(varint(b.length)), b]); }
  function fStr(f, s) { return fBytes(f, new TextEncoder().encode(s)); }
  function fMsg(f, parts) { return fBytes(f, cat(parts)); }
  function fF32(f, x) {
    var dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, x, true);
    return cat([tag(f, 5), new Uint8Array(dv.buffer)]);
  }
  function fF64(f, x) {
    var dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, x, true);
    return cat([tag(f, 1), new Uint8Array(dv.buffer)]);
  }
  function record(bytes) { return cat([u8(varint(bytes.length)), bytes]); }

  function b64(s) {
    if (typeof atob === 'function') {
      var bin = atob(s), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(s, 'base64'));
  }

  function rand32() {
    if (root.crypto && root.crypto.getRandomValues) return root.crypto.getRandomValues(new Uint32Array(1))[0];
    return Math.floor(Math.random() * 4294967296);
  }
  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID().toUpperCase();
    var h = '0123456789ABCDEF', s = '';
    for (var i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
      else if (i === 14) s += '4';
      else if (i === 19) s += h[8 + Math.floor(Math.random() * 4)];
      else s += h[Math.floor(Math.random() * 16)];
    }
    return s;
  }

  function xy(f, x, y) { return fMsg(f, [fF32(1, x), fF32(2, y)]); }

  /* ---------- Seitenobjekte ---------- */
  // Ein Bildobjekt besteht aus zwei Datensätzen: Kopf (Id, Typ 6, Anhang, Zähler) und Inhalt (Rahmen).
  function imageRecords(img, index, ids) {
    var token = rand32();
    var header = cat([
      fStr(1, ids.obj),
      fMsg(2, [fVarint(1, 6), fVarint(2, token)]),
      fStr(4, ids.att),
      fVarint(8, DEVICE),
      fVarint(9, 2776416 + index),
      fVarint(14, 5381),
      fVarint(16, SCHEMA)
    ]);
    var origin = fMsg(2, [xy(1, img.x, img.y), xy(2, img.w, img.h)]);
    var center = fMsg(3, [xy(1, img.x + img.w / 2, img.y + img.h / 2), xy(2, img.w, img.h)]);
    var order = fMsg(5, [fMsg(1, index ? [fVarint(1, index), fVarint(2, rand32())] : [fVarint(2, rand32())])]);
    var body = fMsg(1, [
      fStr(1, ids.obj), origin, center, fStr(4, ids.att), order,
      fVarint(6, 1),
      fMsg(15, [fVarint(1, 6), fVarint(2, token)]),
      fVarint(18, SCHEMA)
    ]);
    return [record(header), record(body)];
  }

  function attachmentEvent(id, size, docId, ts, counter) {
    var inner = cat([
      fStr(1, id), fStr(2, id), fVarint(5, size), fStr(6, docId),
      fF64(10, ts), fStr(11, uuid()), fBytes(12, []),
      fVarint(14, DEVICE), fVarint(15, counter), fVarint(16, SCHEMA)
    ]);
    return record(cat([fStr(1, id), fMsg(6, [inner])]));
  }

  function indexRecord(id, dir, extra) {
    return record(cat([fStr(1, id), fStr(2, dir + '/' + id)].concat(extra || [])));
  }

  /* images: [{ png: Uint8Array, x, y, w, h }]  (Punkte, oben links)
     thumbnail: Uint8Array (JPEG) */
  function buildGoodnotes(images, thumbnail) {
    var T = root.GN_TEMPLATE;
    if (!T) throw new Error('goodnotes-template.js fehlt');
    var files = [];
    function add(name, data) { files.push({ name: name, data: u8(data) }); }

    var pageRecords = [], attIds = [], attRecords = [];
    images.forEach(function (img, i) {
      var ids = { obj: uuid(), att: uuid() };
      attIds.push(ids.att);
      pageRecords = pageRecords.concat(imageRecords(img, i, ids));
    });

    // Journal: Vorlage plus ein Anhang-Eintrag pro Bild
    var events = T.events.map(function (e) { return record(b64(e)); });
    var ts = Date.now(), counter = 1784145195810;
    images.forEach(function (img, i) {
      events.push(attachmentEvent(attIds[i], img.png.length, T.docId, ts + i * 0.137, counter + i));
    });

    // Anhangs-Index: die beiden Seitenhintergründe plus alle PNGs
    attRecords.push(indexRecord(T.pdfB.id, 'attachments'));
    attRecords.push(indexRecord(T.pdfA.id, 'attachments'));
    attIds.forEach(function (id) { attRecords.push(indexRecord(id, 'attachments')); });

    add('document.info.pb', []);
    add('index.search.pb', cat([
      indexRecord(T.pdfB.id, 'search', [fVarint(3, 1)]),
      indexRecord(T.pdfA.id, 'search', [fVarint(3, 1)])
    ]));
    add('index.notes.pb', cat([indexRecord(T.emptyNoteId, 'notes'), indexRecord(T.pageNoteId, 'notes')]));
    add('search/' + T.pdfA.id, [0x04, 0x10, 0x01, 0x1a, 0x00]);
    add('search/' + T.pdfB.id, [0x04, 0x10, 0x01, 0x1a, 0x00]);
    add('notes/' + T.emptyNoteId, []);
    add('notes/' + T.pageNoteId, cat(pageRecords));
    add('index.events.pb', cat(events));
    add('thumbnail.jpg', thumbnail);
    add('index.attachments.pb', cat(attRecords));
    add('attachments/' + T.pdfA.id, b64(T.pdfA.data));
    add('attachments/' + T.pdfB.id, b64(T.pdfB.data));
    images.forEach(function (img, i) { add('attachments/' + attIds[i], img.png); });
    add('schema.pb', b64(T.schema));

    return root.makeZip(files);
  }

  root.GN_PAGE = { w: PAGE_W, h: PAGE_H, left: 44, top: 58.67, right: 746.24, bottom: 961.49 };
  root.buildGoodnotes = buildGoodnotes;
})(typeof globalThis !== 'undefined' ? globalThis : this);
