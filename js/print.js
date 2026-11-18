// Amatu Project — dialog Cetak / PDF (Ctrl/⌘+P, tombol cetak, Berkas › Cetak, Ekspor › PDF), setara Amatu Sheets:
// - yang dicetak dipilih otomatis: tampilan aktif (sesuai layar), seluruh proyek, tugas terpilih, sampai tingkat kerangka,
//   atau paket lengkap (Gantt + Lembar SD + laporan … dipilih otomatis menurut isi proyek);
// - orientasi & skala Otomatis, skala waktu menyesuaikan kertas, − / + mengubah skala lalu halaman dirapikan ulang;
// - grup tugas tidak terpotong (pindah utuh), grup lebih panjang dari 1 halaman berlanjut dengan judul kolom, skala waktu
//   dan ringkasan induk diulang; pemisah halaman manual dihormati.
// Pratinjau = iframe di dialog. Yang dicetak = #print-root di halaman aplikasi (juga untuk menu Print bawaan browser).
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, V = AP.V, Pg = AP.Pg, { el, icon, esc } = U;
const Pr = AP.Pr = {};
const cm = v => String(+(+v).toFixed(2)).replace('.', ',');
const clamp = U.clamp;
const ORIENT = { portrait: 'potret', landscape: 'lanskap' };
const PREVIEW_MAX = 40;
let cur = null, busy = false;
Pr.isOpen = () => !!cur;

const sec = (label, ...kids) => el('div.field.prv-sec', el('span.lbl', label), ...kids);
function seg(items, value, onPick) {
  const w = UI.seg(items, value, onPick);
  w.classList.add('full', 'prv-seg');
  return w;
}

Pr.open = (app, { pdf = false, scope: scope0 = null } = {}) => {
  if (cur || !app.P) return;
  const P = app.P;
  const viewNow = app.viewId;
  let view = Pg.engine(viewNow) && viewNow;
  const key = () => Pg.keyOf(view);
  const q = Pg.setup(P, key());
  const sel = app.selTasks();
  const book = Pg.autoBook(app);
  const isTaskView = () => V.def(String(view).split(':')[0]).kind === 'task' && Pg.engine(view) !== 'art';
  const scopes = () => {
    const out = [{ value: 'view', label: 'Tampilan aktif · ' + Pg.itemName(view) + ' (sesuai layar)' }];
    if (isTaskView()) {
      out.push({ value: 'all', label: 'Seluruh proyek · ' + P.tasks.length + ' tugas, semua subtugas' });
      if (sel.length > 1) out.push({ value: 'sel', label: 'Tugas yang dipilih · ' + sel.length + ' tugas' });
      const maxL = Math.max(1, ...P.tasks.map(t => t.lvl));
      for (let l = 1; l < Math.min(maxL, 4); l++) out.push({ value: 'lvl:' + l, label: 'Sampai tingkat kerangka ' + l });
    }
    out.push({ value: 'book', label: 'Paket lengkap · ' + book.filter(b => b.on).length + ' tampilan dipilih otomatis' });
    return out;
  };
  let scope = scope0 || (sel.length > 1 && isTaskView() ? 'view' : 'view');
  const views = Object.entries(V.VIEWS).filter(([k, d]) => d.type !== 'report').map(([k, d]) => ({ value: k, label: d.t }));
  if (AP.Rep) for (const r of AP.Rep.LIST) views.push({ value: 'report:' + r.id, label: 'Laporan: ' + r.t });
  if (!views.some(v => v.value === view)) view = 'gantt';

  /* ---------- controls ---------- */
  const frame = el('iframe.prv-frame', { title: 'Pratinjau cetak', tabIndex: -1 });
  const badge = el('div.prv-badge', { 'aria-live': 'polite' });
  let big = false;
  const zoomBtn = el('button.icon-btn.sm', { type: 'button', 'data-tip': 'Perbesar pratinjau', 'aria-label': 'Perbesar pratinjau', onclick: () => { big = !big; zoomBtn.firstChild.textContent = big ? 'zoom_out' : 'zoom_in'; fitPreview(); } }, icon('zoom_in'));
  const stage = el('div.prv-stage', frame, badge, el('div.prv-tools', zoomBtn));
  const scopeBox = el('div');
  const viewSel = UI.select(views.map(v => [v.value, v.label]), view, v => { view = v; Object.assign(q, Pg.setup(P, key())); syncAll(); update(); });
  const bookBox = el('div.prv-book');
  const drawBook = () => bookBox.replaceChildren(...book.map(b => { const c = UI.checkbox(Pg.itemName(b.view) + ' — ' + b.why, b.on, v => { b.on = v; update(); }); return c; }));
  const drawScope = () => {
    const s = UI.select(scopes().map(x => [x.value, x.label]), scope, v => { scope = v; update(); });
    scopeBox.replaceChildren(s);
  };
  const rangeSel = UI.select([['all', 'Seluruh rentang proyek'], ['custom', 'Dari – sampai…']], q.range ? 'custom' : 'all', v => { if (v === 'all') { q.range = null; rangeBox.hidden = true; update(); } else { q.range = q.range || [P.root.start, P.root.finish]; rangeBox.hidden = false; rFrom.set(q.range[0]); rTo.set(q.range[1]); update(); } });
  const rFrom = UI.dateInput(q.range ? q.range[0] : P.root.start, v => { if (v == null) return; q.range = [v, q.range ? q.range[1] : P.root.finish]; update(); });
  const rTo = UI.dateInput(q.range ? q.range[1] : P.root.finish, v => { if (v == null) return; q.range = [q.range ? q.range[0] : P.root.start, v]; update(); });
  const rangeBox = el('div.prv-range', rFrom, el('span', '–'), rTo);
  rangeBox.hidden = !q.range;
  const paperSel = UI.select(Object.entries(Pg.PAPER).map(([k, v]) => [k, `${v.n} · ${cm(v.mm[0] / 10)} × ${cm(v.mm[1] / 10)} cm`]), q.size, v => { q.size = v; update(); });
  const orientSeg = seg([['auto', 'Otomatis', 'auto_awesome'], ['portrait', 'Potret', 'crop_portrait'], ['landscape', 'Lanskap', 'crop_landscape']], q.orient, v => { q.orient = v; update(); });
  const orientHint = el('div.prv-hint');
  const fitSeg = seg([['auto', 'Otomatis', 'auto_awesome'], ['width', 'Lebar', 'width'], ['page', '1 halaman', 'fit_page']], q.fit, v => { q.fit = v; update(); });
  const pct = el('input.inp.prv-pct', { type: 'number', min: 10, max: 400, step: 5, 'aria-label': 'Skala (%)', 'data-noenter': '1' });
  const setPct = () => { const v = parseFloat(pct.value); if (v > 0) { q.fit = 'normal'; q.scale = clamp(Math.round(v), 10, 400); update(); } };
  pct.addEventListener('change', setPct);
  pct.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); setPct(); } });
  const minus = el('button.icon-btn.prv-step', { type: 'button', 'data-tip': 'Perkecil|' + U.MOD + '+−', 'aria-label': 'Perkecil skala', onclick: () => step(-1) }, icon('remove'));
  const plus = el('button.icon-btn.prv-step', { type: 'button', 'data-tip': 'Perbesar|' + U.MOD + '++', 'aria-label': 'Perbesar skala', onclick: () => step(1) }, icon('add'));
  const scaleHint = el('div.prv-hint');
  const tsSel = UI.select([['auto', 'Otomatis — pas di lebar kertas'], ['view', 'Seperti di layar (zoom saat ini)'], ['day', 'Hari'], ['week', 'Minggu'], ['month', 'Bulan'], ['quarter', 'Kuartal'], ['year', 'Tahun']], q.ts, v => { q.ts = v; update(); });
  const tsBox = sec('Skala waktu', tsSel);
  const mOpts = [...Pg.MARGINS.map(([k, n, v]) => [k, `${n} · ${v.map(cm).join(' / ')} cm`]), ['custom', 'Kustom…']];
  const mSel = UI.select(mOpts, Pg.marginPreset(q.m) || 'custom', v => { if (v === 'custom') { mBox.hidden = false; return; } [q.m.t, q.m.b, q.m.l, q.m.r] = Pg.MARGINS.find(x => x[0] === v)[2]; syncMargins(); update(); });
  const mIn = k => { const i = el('input.inp.sm', { type: 'number', min: 0, max: 10, step: 0.1, 'data-noenter': '1', 'aria-label': 'Margin (cm)' }); const set = () => { q.m[k] = clamp(parseFloat(i.value) || 0, 0, 10); mSel.value = Pg.marginPreset(q.m) || 'custom'; update(); }; i.addEventListener('change', set); i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); set(); } }); return i; };
  const mInputs = { t: mIn('t'), b: mIn('b'), l: mIn('l'), r: mIn('r') };
  const syncMargins = () => { for (const k of ['t', 'b', 'l', 'r']) mInputs[k].value = +(+q.m[k]).toFixed(2); };
  const mBox = el('div.prv-m', ...[['t', 'Atas'], ['b', 'Bawah'], ['l', 'Kiri'], ['r', 'Kanan']].map(([k, n]) => el('label.field', el('span.lbl', n), mInputs[k])));
  const ck = (k, label) => { const c = UI.checkbox(label, !!q[k], v => { q[k] = v; update(); }); c.dataset.k = k; return c; };
  const titleSel = UI.select([['first', 'Judul proyek di halaman pertama'], ['every', 'Judul proyek di setiap halaman'], ['none', 'Tanpa judul proyek']], q.title, v => { q.title = v; update(); });
  const legSel = UI.select([['last', 'Legenda di halaman terakhir'], ['every', 'Legenda di setiap halaman'], ['none', 'Tanpa legenda']], q.legend, v => { q.legend = v; update(); });
  const tblSel = UI.select([['all', 'Tabel di setiap halaman ke samping'], ['label', 'Hanya ID & Nama di halaman ke samping'], ['first', 'Tabel hanya di kolom halaman pertama']], q.tbl, v => { q.tbl = v; update(); });
  const colsSel = UI.select([['visible', 'Kolom yang terlihat di layar'], ['all', 'Semua kolom tabel']], q.cols, v => { q.cols = v; update(); });
  const checks = el('div.checks.prv-checks',
    ck('keep', 'Jangan potong grup tugas — pindahkan utuh ke halaman berikutnya'),
    ck('hdr', 'Ulangi judul kolom, skala waktu & ringkasan induk di halaman berikutnya'),
    ck('wrap', 'Bungkus nama tugas yang panjang'),
    ck('hc', 'Tengahkan horizontal'), ck('vc', 'Tengahkan vertikal'),
    ck('grid', 'Garis kisi tabel'), ck('num', 'Nomor halaman'), ck('notes', 'Catatan tugas di halaman terakhir'));
  const notes = el('div.prv-notes');
  const bandOnly = el('div', sec('Rentang tanggal', rangeSel, rangeBox), tsBox);
  const side = el('div.prv-side',
    sec('Yang dicetak', scopeBox), el('div.prv-viewsel', sec('Tampilan', viewSel)), bookBox,
    bandOnly,
    sec('Ukuran kertas', paperSel),
    sec('Orientasi', orientSeg, orientHint),
    sec('Skala', fitSeg, el('div.prv-scale', minus, pct, el('span.prv-unit', '%'), plus), scaleHint),
    sec('Margin', mSel, mBox),
    sec('Kepala & kaki halaman', titleSel, legSel),
    el('div.prv-tblopts', sec('Tabel', colsSel, tblSel)),
    checks, notes);
  const info = el('span.prv-info');
  const dlg = UI.dialog({
    title: pdf ? 'Ekspor PDF' : 'Cetak', width: 'min(1220px, 100%)', cls: 'print-dlg', noBackdropClose: true, drag: false,
    body: el('div.prv', stage, side),
    buttons: [
      { label: 'Gambar PNG', left: true, icon: 'image', run: () => { pngNow(); return false; } },
      { label: 'Batal' },
      { label: 'Simpan PDF', primary: pdf, icon: 'picture_as_pdf', run: () => { go(true); return false; } },
      { label: 'Cetak', primary: !pdf, icon: 'print', run: () => { go(false); return false; } },
    ],
    onClose: () => { if (cur === me) cur = null; window.removeEventListener('keydown', keys, true); ro.disconnect(); app.view && app.view.focus && app.view.focus(); },
  });
  dlg.el.querySelector('.dlg-foot').prepend(info);
  setTimeout(() => { if (dlg.el.contains(document.activeElement)) document.activeElement.blur(); }, 40);

  /* ---------- pratinjau ---------- */
  const doc = frame.contentDocument;
  const fonts = [...document.querySelectorAll('link[rel=stylesheet][href*="fonts.googleapis.com"]')].filter(l => !/Material\+Symbols/.test(l.href)).map(l => `<link rel="stylesheet" href="${esc(l.href)}">`).join('');
  doc.open();
  doc.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(P.name)}</title>${fonts}<style id="pc"></style><style id="pv"></style></head><body></body></html>`);
  doc.close();
  const fwin = frame.contentWindow;
  fwin.addEventListener('scroll', () => badgeNow(), { passive: true });
  fwin.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); dlg.close(); } else keys(e); });
  const ro = new ResizeObserver(() => fitPreview());
  ro.observe(stage);
  let D = null;
  const items = () => scope === 'book' ? book.filter(b => b.on).map(b => ({ view: b.view, scope: 'all' })) : [{ view, scope }];
  const over = () => pick(q);
  function pick(o) { const r = {}; for (const k of Pg.KEYS) r[k] = k === 'm' ? { ...o.m } : k === 'range' ? (o.range ? [...o.range] : null) : o[k]; return r; }
  function paint() {
    doc.getElementById('pc').textContent = D.css + '\nhtml,body{margin:0}@media print{html,body{background:#fff!important;zoom:1!important}}';
    doc.body.innerHTML = D.total ? D.body : '<p style="font:14px Inter,Arial,sans-serif;color:#5f6368;text-align:center;margin-top:40px">Tidak ada isi untuk dicetak</p>';
    fitPreview();
  }
  function fitPreview() {
    if (!D) return;
    let mw = 0, mh = 0;
    for (const { L } of D.all) if (!L.empty) { mw = Math.max(mw, L.paper.W); mh = Math.max(mh, L.paper.H); }
    if (!mw) { mw = 794; mh = 1123; }
    const sw = stage.clientWidth || 600, sh = stage.clientHeight || 500;
    const z = big ? clamp((sw - 40) / mw, 0.2, 1.6) : clamp(Math.min((sw - 40) / mw, (sh - 64) / mh), 0.1, 1.2);
    const bg = getComputedStyle(stage).backgroundColor || '#dfe3e8';
    let tall = 0, count = 0;
    for (const { L } of D.all) if (!L.empty) { tall += L.pages * L.paper.H; count += L.pages; }
    const top = Math.max(18, (sh - (tall * z + Math.max(0, count - 1) * 18)) / 2);
    doc.getElementById('pv').textContent = `@media screen{html{zoom:${z.toFixed(4)}}body{background:${bg};padding:${(top / z).toFixed(1)}px 0 ${(48 / z).toFixed(1)}px}.pg{margin:0 auto ${(18 / z).toFixed(1)}px!important;box-shadow:0 ${(2 / z).toFixed(1)}px ${(10 / z).toFixed(1)}px rgba(16,24,40,.22)!important}}`;
    badgeNow();
  }
  function badgeNow() {
    const pages = doc.querySelectorAll('.pg');
    badge.hidden = !pages.length;
    if (!pages.length) return;
    let i = 0;
    const mid = (fwin.innerHeight || 400) * 0.4;
    pages.forEach((p, k) => { if (p.getBoundingClientRect().top <= mid) i = k; });
    badge.textContent = `Halaman ${i + 1} dari ${D ? D.total : pages.length}`;
  }
  function syncAll() {
    paperSel.value = q.size; orientSeg.set(q.orient); fitSeg.set(q.fit); tsSel.value = q.ts; titleSel.value = q.title; legSel.value = q.legend; tblSel.value = q.tbl; colsSel.value = q.cols;
    mSel.value = Pg.marginPreset(q.m) || 'custom'; mBox.hidden = mSel.value !== 'custom'; syncMargins();
    for (const c of checks.querySelectorAll('[data-k]')) c.input.checked = !!q[c.dataset.k];
    rangeSel.value = q.range ? 'custom' : 'all'; rangeBox.hidden = !q.range;
  }

  /* ---------- keadaan → layar ---------- */
  function update() {
    drawScope();
    const its = items();
    D = Pg.printDoc(app, { items: its, over: over(), limit: PREVIEW_MAX });
    paint();
    const first = D.all.find(x => !x.L.empty);
    const L = first ? first.L : null;
    const eng = L ? L.eng : 'gantt';
    side.querySelector('.prv-viewsel').hidden = scope === 'book';
    bookBox.hidden = scope !== 'book';
    if (scope === 'book' && !bookBox.children.length) drawBook();
    bandOnly.hidden = scope !== 'book' && !(eng === 'gantt' || eng === 'usage');
    side.querySelector('.prv-tblopts').hidden = scope !== 'book' && eng === 'art';
    const sc = L ? Math.round(L.s * 100) : 100;
    pct.value = sc;
    fitSeg.set(q.fit); orientSeg.set(q.orient);
    minus.disabled = sc <= 10; plus.disabled = sc >= 400;
    // texts
    const o2 = L && L.other;
    orientHint.textContent = q.orient !== 'auto' || !L || L.empty ? '' : o2 ? `Dipilih ${ORIENT[L.orient]}: tulisan ${sc}%, ${L.pages} halaman (${ORIENT[o2.orient]}: ${Math.round(o2.s * 100)}%, ${o2.pages} halaman)` : `Dipilih ${ORIENT[L.orient]}`;
    const fitTxt = {
      auto: L && L.s < Math.min(L.eng === 'gantt' || L.eng === 'usage' ? 1 : 1.25, L.fitW) - 1e-3 ? `Otomatis ${sc}% — diperkecil sedikit agar muat di ${L.pages} halaman` : `Otomatis ${sc}% — memenuhi lebar kertas`,
      width: `${sc}% — selebar kertas`, page: `${sc}% — semua isi dalam 1 halaman`,
      normal: L && L.colPages && L.colPages.length > 1 ? `${sc}% — skala manual, dibagi ${L.colPages.length} halaman ke samping` : `${sc}% — skala manual, halaman tetap dirapikan`,
    };
    scaleHint.textContent = L && !L.empty ? fitTxt[q.fit] || '' : '';
    const N = [];
    if (L && !L.empty && L.A) {
      if (!L.split) N.push(['check_circle', 'Tidak ada grup tugas yang terpotong']);
      else if (q.hdr && L.repeated) N.push(['view_headline', `${L.split} grup lebih panjang dari 1 halaman — berlanjut dengan judul kolom, skala waktu & ringkasan induk diulang`]);
      else N.push(['content_cut', `${L.split} grup lebih panjang dari 1 halaman dan berlanjut ke halaman berikutnya`]);
      if (L.moved) N.push(['move_down', `Pemisah halaman digeser ${L.moved}× agar grup tugas tidak terpotong`]);
      const pbN = L.A.pb.size; if (pbN) N.push(['insert_page_break', `${pbN} pemisah halaman manual dihormati`]);
      if (L.s < 0.5) N.push(['warning', `Tulisan kecil (${sc}%). Coba kertas lebih besar (A3/F4), orientasi lanskap, margin Sempit, atau kurangi kolom.`, 'warn']);
      if (L.across && L.colPages.length > 1) N.push(['view_week', `Skala waktu dibagi ${L.colPages.length} halaman ke samping` + (q.tbl === 'label' ? ' — ID & Nama diulang di kiri' : q.tbl === 'all' ? ' — tabel diulang di kiri' : '') + '. Pilih skala waktu Otomatis agar muat selebar kertas.', 'warn']);
      if (L.A.eng === 'gantt' && L.ppd) N.push(['calendar_view_week', 'Skala waktu: ' + L.tiers.map(t => AP.TS.name(t.u).toLowerCase()).join(' / ') + ` (${U.num(L.ppd, 1)} px/hari)`]);
    }
    if (D.shown < D.total) N.push(['info', `Pratinjau menampilkan ${D.shown} halaman pertama dari ${D.total}; semuanya ikut dicetak.`]);
    if (scope === 'book') N.push(['library_books', `${D.all.filter(x => !x.L.empty).length} tampilan dalam paket · masing-masing diatur otomatis (orientasi & skala sendiri)`]);
    notes.replaceChildren(...N.map(([ic, t, k]) => el('div.prv-note' + (k ? '.' + k : ''), icon(ic), el('span', t))));
    const paper = (Pg.PAPER[q.size] || {}).n || 'A4';
    info.textContent = D.total ? `${D.total} halaman · ${paper}${L && scope !== 'book' ? ' ' + ORIENT[L.orient] + ' · ' + sc + '%' : ''}` : 'Tidak ada isi';
  }
  function step(d) {
    const first = D && D.all.find(x => !x.L.empty);
    if (!first) return;
    const c = Math.round(first.L.s * 100);
    q.fit = 'normal';
    q.scale = clamp(d > 0 ? Math.floor(c / 5) * 5 + 5 : Math.ceil(c / 5) * 5 - 5, 10, 400);
    update();
  }
  function keys(e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || e.altKey) return;
    const k = e.key;
    if (k === '=' || k === '+') { e.preventDefault(); e.stopPropagation(); step(1); }
    else if (k === '-' || k === '_') { e.preventDefault(); e.stopPropagation(); step(-1); }
    else if (k === '0') { e.preventDefault(); e.stopPropagation(); q.fit = 'auto'; update(); }
    else if ((k === 'p' || k === 'P') && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); go(false); }
  }
  window.addEventListener('keydown', keys, true);
  // the dialog's settings become the view's page setup once something is printed (not an undo step)
  function save() {
    if (scope === 'book') return;
    P.page ||= {};
    P.page[key()] = { v: 1, ...pick(q) };
    app.viewChanged();
  }
  function go(asPdf) {
    if (!D || !D.total) { UI.toast('Tidak ada isi untuk dicetak'); return; }
    save();
    if (asPdf) UI.toast('Di jendela cetak, pilih Tujuan: "Simpan sebagai PDF"', { ms: 6000 });
    mainPrint(app, { items: items(), over: over() }, U.safeName(P.name) + (scope === 'book' ? '' : ' - ' + Pg.itemName(view)), () => { if (cur === me) dlg.close(); });
  }
  async function pngNow() {
    if (!D || !D.total) return;
    try { await AP.IO.pagesToPNG(app, Pg.printDoc(app, { items: items(), over: over() }), U.safeName(P.name)); }
    catch (e) { UI.toast('Gagal membuat gambar: ' + (e.message || e), { kind: 'bad' }); }
  }
  const me = { go, close: () => dlg.close() };
  cur = me;
  syncMargins();
  update();
};

/* ---------- mencetak di halaman aplikasi ---------- */
function ready(doc, root = doc) {
  return Promise.race([Promise.resolve(doc.fonts && doc.fonts.ready), new Promise(r => setTimeout(r, 2500))]);
}
function mount(app, opts) {
  unmount();
  const d = Pg.printDoc(app, { ...opts, scope: '#print-root ' });
  if (!d.total) return false;
  const style = el('style', { id: 'print-root-css' });
  style.textContent = d.css;
  const root = el('div', { id: 'print-root' });
  root.innerHTML = d.body;
  document.head.append(style);
  document.body.append(root);
  return root;
}
function unmount() { const a = document.getElementById('print-root'); if (a) a.remove(); const b = document.getElementById('print-root-css'); if (b) b.remove(); }
let busyAt = 0;
function mainPrint(app, opts, name, done) {
  if (busy && Date.now() - busyAt < 60000) return;
  const root = mount(app, opts);
  if (!root) { UI.toast('Tidak ada isi untuk dicetak'); return; }
  const t0 = document.title;
  document.title = name;
  busy = true; busyAt = Date.now();
  let fin = false;
  const end = () => { if (fin) return; fin = true; busy = false; window.removeEventListener('afterprint', end); unmount(); document.title = t0; done && done(); };
  window.addEventListener('afterprint', end);
  ready(document, root).then(() => {
    const t = performance.now();
    window.print();
    if (performance.now() - t > 300) setTimeout(end, 60);
  });
}
Pr.mainPrint = mainPrint;
// the browser's own Print menu prints the current view, fitted (instead of the app screen)
window.addEventListener('beforeprint', () => {
  const app = AP.app;
  const ap = document.getElementById('app');
  if (busy || document.getElementById('print-root') || !app || !app.P || !ap || ap.hidden) return;
  if (!mount(app, { items: [{ view: app.viewId, scope: 'view' }] })) return;
  window.addEventListener('afterprint', () => { if (!busy) unmount(); }, { once: true });
});
})();
