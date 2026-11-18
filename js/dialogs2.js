// Amatu Project — dialog format & tampilan: Kolom Kustom (alias, rumus, indikator grafis), Kode WBS, Tabel, Kelompok,
// Urutkan, Filter kustom, Skala Waktu, Gaya Batang, Gaya Gantt, Gaya Teks, Tata Letak, Garis Kisi, Format Batang,
// Pengaturan Kolom, pemilih kolom/sumber daya/rentang, Hyperlink, Pintasan Keyboard, Tentang.
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, M = AP.M, F = AP.F, D = AP.D, V = AP.V, TS = AP.TS, G = AP.G, { el, icon, esc } = U;
const Dlg = AP.Dlg = AP.Dlg || {};
const A = () => AP.app, P_ = () => AP.app.P;
const grid2 = (...k) => el('div.fgrid', ...k);

/* ---------------- pemilih ---------------- */
Dlg.pickField = (kind, title) => new Promise(res => {
  const P = P_();
  const list = F.list(kind, P);
  let q = '', v = null;
  const box = el('div.pf-list');
  const draw = () => { box.replaceChildren(...list.filter(f => !q || f.t.toLowerCase().includes(q) || (f.en || '').toLowerCase().includes(q)).map(f => el('button.pf-i' + (v === f.k ? '.on' : ''), { type: 'button', onclick: () => { v = f.k; draw(); }, ondblclick: () => { v = f.k; d.primary.click(); } }, el('b', f.t), el('span', f.en || '')))); };
  const s = el('input.inp', { type: 'search', placeholder: 'Cari kolom (Indonesia / English)…', oninput: e => { q = e.target.value.toLowerCase(); draw(); } });
  draw();
  const d = UI.dialog({ title: title || 'Pilih kolom', width: '460px', body: el('div', s, box), buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { if (!v) { UI.toast('Pilih kolom'); return false; } } }], onClose: () => res(v) });
  d.el.querySelector('.dlg-foot .btn:not(.primary)').addEventListener('click', () => { v = null; });
});
Dlg.pickRes = (title, label) => new Promise(res => {
  const P = P_();
  if (!P.res.length) { UI.toast('Belum ada sumber daya'); res(null); return; }
  let v = P.res[0].uid, ok = false;
  UI.dialog({ title, width: '420px', body: UI.field(label, UI.select(P.res.map(r => [String(r.uid), r.name]), String(v), x => { v = +x; })), buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { ok = true; } }], onClose: () => res(ok ? v : null) });
});
Dlg.pickRange = () => new Promise(res => {
  const P = P_();
  let a = U.today(), b = U.today() + 14 * 1440, ok = false;
  UI.dialog({ title: 'Filter: Rentang Tanggal', width: '460px', body: el('div', el('p.hint', 'Tampilkan tugas yang berlangsung di antara tanggal berikut.'), grid2(UI.field('Dari', UI.dateInput(a, v => { a = v; })), UI.field('Sampai', UI.dateInput(b, v => { b = v; })))),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { ok = true; } }], onClose: () => res(ok ? [a, b + 1440] : null) });
  void P;
});
Dlg.hyperlink = t => {
  const app = A();
  const addr = el('input.inp', { value: t.link || '', placeholder: 'https://contoh.com/dokumen' });
  UI.dialog({ title: 'Hyperlink · ' + t.name, width: '480px', body: UI.field('Alamat', addr), buttons: [...(t.link ? [{ label: 'Buka', left: true, run: () => { const u = /^https?:\/\//i.test(t.link) ? t.link : 'https://' + t.link; window.open(u, '_blank', 'noopener'); return false; } }] : []), { label: 'Batal' }, { label: 'OK', primary: true, run: () => { app.tx('Hyperlink', P2 => { P2.byUid.get(t.uid).link = addr.value.trim(); }); } }] });
};

/* ---------------- Kolom kustom ---------------- */
Dlg.customFields = () => {
  const app = A(), P = P_();
  const fields = U.deep(P.fields || {});
  let type = 'text', sel = 'text1';
  const box = el('div.cf');
  const draw = () => {
    const def = F.CUSTOM.find(c => c[0] === type);
    const list = [...Array(def[2])].map((_, i) => type + (i + 1));
    if (!list.includes(sel)) sel = list[0];
    const f = fields[sel] || (fields[sel] = {});
    const lst = el('div.cf-list', ...list.map(k => el('button.cf-i' + (k === sel ? '.on' : ''), { type: 'button', onclick: () => { sel = k; draw(); } }, el('b', def[1] + k.replace(/\D+/, '')), el('span', (fields[k] && fields[k].name) || ''), fields[k] && fields[k].formula ? icon('function') : null)));
    const name = el('input.inp', { value: f.name || '', placeholder: 'Nama alias (mis. "Lokasi", "Status RAG")' });
    name.addEventListener('change', () => { f.name = name.value.trim(); draw(); });
    const formula = el('textarea.inp.code', { rows: 3, value: f.formula || '', placeholder: 'Contoh: IIf([% Selesai]=100;"Selesai";IIf([Selesai]<Now();"Terlambat";"Berjalan"))' });
    formula.addEventListener('change', () => { f.formula = formula.value.trim(); test(); });
    const out = el('div.cf-test');
    const test = () => {
      if (!f.formula) { out.textContent = ''; return; }
      const t = app.focusTask() || P.tasks.find(x => !x.sum);
      try { const v = AP.Fx.run(P, f.formula, t, type); out.textContent = 'Uji pada tugas ' + (t ? t.id : '-') + ': ' + AP.Fx.show(v, type, P); out.className = 'cf-test ok'; }
      catch (e) { out.textContent = String(e); out.className = 'cf-test bad'; }
    };
    test();
    // graphical indicators
    f.ind ||= [];
    const indTbl = UI.miniTable([
      { k: 'op', t: 'Uji', w: 150, type: 'select', opts: V.OPS.filter(o => !['has', 'nhas'].includes(o[0])) },
      { k: 'v', t: 'Nilai', w: 140 },
      { k: 'ic', t: 'Ikon', w: 150, type: 'select', opts: AP.Fx.ICONS.map(([k, n]) => [k, n]) },
    ], f.ind, rows => { f.ind = rows; }, { add: () => ({ op: 'eq', v: '', ic: 'g' }), addLabel: 'Tambah kriteria' });
    const showInd = UI.checkbox('Tampilkan sebagai ikon di kolom Indikator', !!f.showInd, v => { f.showInd = v; });
    box.replaceChildren(
      el('div.cf-type', UI.field('Jenis', UI.select(F.CUSTOM.map(c => [c[0], c[1]]), type, v => { type = v; draw(); }))),
      el('div.cf-body', lst, el('div.cf-ed',
        UI.field('Nama kolom', name),
        UI.field('Rumus (kosong = isi manual)', formula), out,
        el('details.cf-help', el('summary', 'Panduan rumus'), el('p', 'Kolom ditulis dalam kurung siku memakai nama Indonesia atau Inggris, mis. [Durasi], [Duration], [% Selesai], [Biaya], [Mulai]. Pemisah argumen ; atau ,. Fungsi: IIf, Switch, Choose, Abs, Int, Round, Min, Max, Len, Left, Right, Mid, InStr, UCase, LCase, Trim, Now, Date, Year, Month, Day, Weekday, DateAdd, DateDiff, ProjDateDiff, ProjDateAdd, IsNull, Format. Operator: + - * / & = <> < > <= >= And Or Not Mod.')),
        el('h4', 'Indikator grafis'), indTbl, showInd)));
  };
  draw();
  UI.dialog({ title: 'Kolom Kustom', width: 'min(860px, 100%)', cls: 'cfdlg', body: box, buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
    for (const k of Object.keys(fields)) { const f = fields[k]; if (!f.name && !f.formula && !(f.ind && f.ind.length)) delete fields[k]; }
    app.tx('Kolom kustom', P2 => { P2.fields = fields; });
  } }] });
};

/* ---------------- WBS ---------------- */
Dlg.wbs = () => {
  const app = A(), P = P_();
  const def = U.deep(P.wbsDef || { prefix: '', levels: [{ seq: 'num', len: 0, sep: '.' }] });
  const prefix = el('input.inp', { value: def.prefix || '', placeholder: 'mis. PRJ-' });
  prefix.addEventListener('input', () => { def.prefix = prefix.value; prev(); });
  const pv = el('div.wbs-prev');
  const prev = () => { pv.textContent = 'Contoh: ' + (def.prefix || '') + def.levels.map((L, i) => (i ? (L.sep == null ? '.' : L.sep) : '') + ({ num: String(i + 1).padStart(L.len || 0, '0'), up: 'ABC'[i] || 'A', low: 'abc'[i] || 'a', chr: '*' })[L.seq]).join(''); };
  const tbl = UI.miniTable([
    { k: 'seq', t: 'Urutan', w: 180, type: 'select', opts: [['num', 'Angka (berurutan)'], ['up', 'Huruf besar'], ['low', 'Huruf kecil']], onSet: prev },
    { k: 'len', t: 'Panjang (0 = bebas)', w: 120, parse: v => Math.max(0, parseInt(v, 10) || 0), onSet: prev },
    { k: 'sep', t: 'Pemisah', w: 80, onSet: prev },
  ], def.levels, () => prev(), { add: () => ({ seq: 'num', len: 0, sep: '.' }), addLabel: 'Tambah tingkat' });
  prev();
  UI.dialog({ title: 'Definisi Kode WBS', width: '560px', body: el('div', UI.field('Awalan kode proyek', prefix), tbl, pv, el('p.hint', 'Tingkat terakhir dipakai untuk tingkat yang lebih dalam. WBS manual pada tugas (kolom WBS) tetap diutamakan.')),
    buttons: [{ label: 'Pakai Nomor Kerangka', left: true, run: () => { app.tx('Kode WBS', P2 => { P2.wbsDef = null; }); } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => { app.tx('Kode WBS', P2 => { P2.wbsDef = def; }); } }] });
};

/* ---------------- Tabel ---------------- */
Dlg.tables = () => {
  const app = A(), P = P_();
  const kind = app.kind();
  let tb = V.tableOf(P, app.viewId);
  const reg = F.reg(kind);
  const box = el('div.tbl-ed');
  const draw = () => {
    const cols = F.cols(P, kind, tb).map(c => ({ k: c.k, w: c.w, t: c.title || '' }));
    const tsel = UI.select(Object.entries(F.TABLES[kind]).map(([k, t]) => [k, t.t]), tb, v => { tb = v; draw(); });
    const tbl = UI.miniTable([
      { k: 'k', t: 'Kolom', w: 220, type: 'select', opts: F.list(kind, P).map(f => [f.k, f.t]) },
      { k: 't', t: 'Judul (opsional)', w: 160 },
      { k: 'w', t: 'Lebar', w: 70, parse: v => U.clamp(parseInt(v, 10) || 80, 16, 800) },
    ], cols, rows => { F.saveCols(P, kind, tb, rows.filter(r => reg[r.k]).map(r => ({ k: r.k, w: r.w || reg[r.k].w, title: r.t || null }))); }, { add: () => ({ k: 'name', w: 120, t: '' }), addLabel: 'Tambah kolom' });
    box.replaceChildren(UI.field('Tabel', tsel), tbl);
  };
  draw();
  UI.dialog({ title: 'Tabel', width: 'min(620px, 100%)', body: box, buttons: [{ label: 'Kembalikan Bawaan', left: true, run: () => { if (P.view.tables) delete P.view.tables[kind + ':' + tb]; draw(); return false; } }, { label: 'Tutup' }, { label: 'Terapkan', primary: true, run: () => { V.vs(P).table[app.viewId] = tb; app.viewChanged(); app.refresh(); } }] });
};

/* ---------------- Kelompok & urut kustom ---------------- */
Dlg.groupBy = () => {
  const app = A(), P = P_(), kind = app.kind();
  let k = 'name';
  UI.dialog({ title: 'Kelompok Kustom', width: '440px', body: UI.field('Kelompokkan menurut kolom', UI.select(F.list(kind, P).map(f => [f.k, f.t]), k, v => { k = v; })),
    buttons: [{ label: 'Batal' }, { label: 'Terapkan', primary: true, run: () => { V.vs(P).group[kind] = { id: 'field', k }; app.viewChanged(); app.refresh(); } }] });
};
Dlg.sort = () => {
  const app = A(), P = P_(), kind = app.kind();
  const cur = V.sortKeys(P, kind);
  const keys = cur ? U.deep(cur.keys) : [{ k: 'start' }];
  while (keys.length < 3) keys.push({ k: '' });
  let outline = cur ? cur.outline !== false : true, renumber = false;
  const opts = [['', '(tidak ada)'], ...F.list(kind, P).map(f => [f.k, f.t])];
  const rows = keys.map((x, i) => el('div.frow', UI.field(i ? 'Lalu menurut' : 'Urutkan menurut', UI.select(opts, x.k, v => { x.k = v; })), UI.field('Arah', UI.select([['asc', 'Naik (A→Z, 1→9)'], ['desc', 'Turun']], x.desc ? 'desc' : 'asc', v => { x.desc = v === 'desc'; }))));
  UI.dialog({ title: 'Urutkan', width: '520px', body: el('div', ...rows, el('div.checks', UI.checkbox('Pertahankan struktur kerangka', outline, v => { outline = v; }), kind === 'task' ? UI.checkbox('Nomori ulang tugas secara permanen', false, v => { renumber = v; }) : null)),
    buttons: [{ label: 'Setel ulang (ID)', left: true, run: () => { V.vs(P).sort[kind] = null; app.viewChanged(); app.refresh(); } }, { label: 'Batal' }, { label: 'Urutkan', primary: true, run: () => {
      const ks = keys.filter(x => x.k).map(x => ({ k: x.k, desc: !!x.desc }));
      if (renumber && kind === 'task') {
        V.vs(P).sort[kind] = { keys: ks, outline };
        const rows2 = V.taskRows(P, { noFilter: true, noGroup: true });
        const order = rows2.filter(r => r.kind === 'task' && !r.x.root).map(r => r.x.uid);
        V.vs(P).sort[kind] = null;
        app.tx('Urutkan & nomori ulang', P2 => { const map = new Map(P2.tasks.map(t => [t.uid, t])); const seen = new Set(order); P2.tasks = [...order.map(u => map.get(u)), ...P2.tasks.filter(t => !seen.has(t.uid))]; if (!outline) for (const t of P2.tasks) t.lvl = t.sum ? t.lvl : t.lvl; });
        return;
      }
      V.vs(P).sort[kind] = ks.length ? { keys: ks, outline } : null; app.viewChanged(); app.refresh();
    } }] });
};
Dlg.customFilter = where => {
  const app = A(), P = P_(), kind = app.kind();
  const cur = V.vs(P)[where][kind];
  const rules = cur && cur.id === 'custom' ? U.deep(cur.rules) : [{ k: 'name', op: 'has', v: '', join: 'and' }];
  const tbl = UI.miniTable([
    { k: 'join', t: 'Dan/Atau', w: 84, type: 'select', opts: [['and', 'Dan'], ['or', 'Atau']] },
    { k: 'k', t: 'Kolom', w: 200, type: 'select', opts: F.list(kind, P).map(f => [f.k, f.t]) },
    { k: 'op', t: 'Uji', w: 170, type: 'select', opts: V.OPS },
    { k: 'v', t: 'Nilai', w: 150 },
  ], rules, () => { }, { add: () => ({ k: 'name', op: 'has', v: '', join: 'and' }), addLabel: 'Tambah kriteria' });
  UI.dialog({ title: where === 'hl' ? 'Sorot Kustom' : 'Filter Kustom', width: 'min(720px, 100%)', body: el('div', tbl, el('p.hint', 'Tanggal: 18/11/26 · durasi: 5 hari · persen: 50 · tanda: Ya/Tidak. Tugas ringkasan dari tugas yang cocok tetap ditampilkan.')),
    buttons: [{ label: 'Batal' }, { label: where === 'hl' ? 'Sorot' : 'Terapkan', primary: true, run: () => { V.vs(P)[where][kind] = { id: 'custom', rules }; app.viewChanged(); app.refresh(); } }] });
};

/* ---------------- Skala waktu ---------------- */
Dlg.timescale = () => {
  const app = A(), P = P_();
  const v = app.view;
  const ppd = v && v.chart ? v.chart.ppd : TS.DEF_PPD;
  const cfg = U.deep((P.view && P.view.ts) || { auto: true });
  const cur = TS.tiers(P, ppd, cfg);
  let auto = cfg.auto !== false && !(cfg.tiers && cfg.tiers.length && !cfg.auto);
  let tiers = cur.map(x => ({ ...x }));
  let count = tiers.length;
  const box = el('div.tsd');
  const prev = el('div.tsd-prev');
  const draw = () => {
    while (tiers.length < count) tiers.push({ u: 'day', n: 1 });
    tiers.length = count;
    const rows = tiers.map((t, i) => el('div.frow', el('b.tsd-l', ['Atas', 'Tengah', 'Bawah'][count === 1 ? 2 : count === 2 ? (i ? 2 : 0) : i]), UI.field('Satuan', UI.select(TS.UNITS, t.u, x => { t.u = x; draw(); })), UI.field('Jumlah', (() => { const i2 = el('input.inp', { type: 'number', min: 1, max: 24, value: t.n || 1, style: { width: '72px' } }); i2.addEventListener('change', () => { t.n = U.clamp(+i2.value || 1, 1, 24); draw(); }); return i2; })())));
    box.replaceChildren(UI.checkbox('Otomatis mengikuti zoom', auto, x => { auto = x; draw(); }),
      el('div' + (auto ? '.dim' : ''), UI.field('Tingkat yang ditampilkan', UI.select([['1', 'Satu (bawah)'], ['2', 'Dua (atas, bawah)'], ['3', 'Tiga (atas, tengah, bawah)']], String(count), x => { count = +x; draw(); })), ...rows),
      el('div.frow', UI.checkbox('Arsir waktu non-kerja', (P.view && P.view.gantt && P.view.gantt.shade) !== false, x => { cfg.shade = x; }), UI.field('Kalender arsiran', UI.select(P.cals.map(c => [c.id, c.name]), cfg.shadeCal || P.calendar, x => { cfg.shadeCal = x; }))),
      prev);
    const h = count > 2 ? 54 : 42, w = 560;
    const t0 = TS.floor('week', U.today(), P);
    prev.innerHTML = `<svg width="${w}" height="${h}">${G.scaleSVG({ P, ppd, origin: t0 - 2 * 1440, x0: 0, x1: w, h, tiers: auto ? TS.auto(ppd) : tiers, font: '500 11px Inter, Arial', color: 'var(--text-2)', line: 'var(--line)' })}</svg>`;
  };
  draw();
  UI.dialog({ title: 'Skala Waktu', width: 'min(640px, 100%)', body: box, buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
    V.vs(P);
    P.view.ts = { auto, tiers: auto ? [] : tiers, shadeCal: cfg.shadeCal || null };
    P.view.gantt ||= {};
    if (cfg.shade != null) P.view.gantt.shade = cfg.shade;
    app.viewChanged(); app.refresh();
  } }] });
};

/* ---------------- Gaya Gantt, Gaya Batang, Format Batang ---------------- */
const mk = (task, crit, sum, ms, extra = {}) => ({ ...U.deep(G.DEF_BARS), task: { fill: task[0], line: task[1], prog: task[2] }, crit: { fill: crit[0], line: crit[1], prog: crit[2] }, sum: { fill: sum, prog: G.shade(sum, -0.4) }, ms: { fill: ms }, ...extra });
Dlg.GANTT_STYLES = {
  biru: { t: 'Biru (bawaan)', bars: U.deep(G.DEF_BARS) },
  hijau: { t: 'Hijau', bars: mk(['#3fae7a', '#2a8c5d', '#1b5e3f'], ['#e2574c', '#b8392f', '#8f241c'], '#2f4f3e', '#1f3a2c') },
  oranye: { t: 'Oranye', bars: mk(['#f29c38', '#cf7a17', '#8a4d06'], ['#d93a4a', '#a8222f', '#78101b'], '#5a3a1a', '#4a2a0a') },
  ungu: { t: 'Ungu', bars: mk(['#8f6ed5', '#6b4bb3', '#43297f'], ['#e2574c', '#b8392f', '#8f241c'], '#3e3456', '#2b2340') },
  abu: { t: 'Abu-abu', bars: mk(['#8d99a6', '#6c7884', '#3f4852'], ['#e2574c', '#b8392f', '#8f241c'], '#2f353b', '#1f2428') },
  tosca: { t: 'Toska', bars: mk(['#26a6a6', '#178585', '#0b5656'], ['#f05a28', '#c2410c', '#7c2d12'], '#134e4a', '#0f3b38') },
  merah: { t: 'Kontras', bars: mk(['#1d4ed8', '#1e3a8a', '#0b1f55'], ['#dc2626', '#991b1b', '#5f0f0f'], '#111827', '#000000') },
};
Dlg.barStyles = () => {
  const app = A(), P = P_();
  const bars = G.bars(P);
  const text = { ...G.defText(), ...((P.view && P.view.gantt && P.view.gantt.text) || {}) };
  const ITEMS = [['task', 'Tugas'], ['crit', 'Tugas kritis'], ['sum', 'Ringkasan'], ['proj', 'Ringkasan proyek'], ['ms', 'Tonggak'], ['msCrit', 'Tonggak kritis'], ['manual', 'Tugas manual'], ['base', 'Garis dasar'], ['late', 'Tugas terlambat'], ['slack', 'Slack'], ['pre', 'Sebelum pemerataan'], ['dead', 'Tenggat']];
  const rows = ITEMS.map(([k, n]) => {
    const b = bars[k];
    const sw = p => { const i = el('input', { type: 'color', value: (b[p] && b[p] !== 'none') ? b[p] : '#ffffff' }); i.addEventListener('input', () => { b[p] = i.value; }); return i; };
    return el('tr', el('td', n), el('td', b.fill != null ? sw('fill') : ''), el('td', b.line != null ? sw('line') : ''), el('td', b.prog != null ? sw('prog') : ''));
  });
  const tf = (grp, pos) => UI.select(G.TEXT_FIELDS, text[grp][pos] || '', v => { text[grp][pos] = v; });
  const ttbl = el('table.bs-t', el('thead', el('tr', el('th', 'Teks batang'), el('th', 'Kiri'), el('th', 'Kanan'), el('th', 'Atas'), el('th', 'Di dalam'))),
    el('tbody', ...[['task', 'Tugas'], ['ms', 'Tonggak'], ['sum', 'Ringkasan']].map(([g, n]) => el('tr', el('td', n), el('td', tf(g, 'l')), el('td', tf(g, 'r')), el('td', tf(g, 't')), el('td', g === 'task' ? tf(g, 'i') : '')))));
  UI.dialog({ title: 'Gaya Batang', width: 'min(760px, 100%)', body: el('div', el('table.bs-t', el('thead', el('tr', el('th', 'Batang'), el('th', 'Isi'), el('th', 'Garis'), el('th', 'Progres'))), el('tbody', ...rows)), ttbl),
    buttons: [{ label: 'Kembalikan Bawaan', left: true, run: () => { app.tx('Gaya batang', P2 => { P2.bars = null; if (P2.view && P2.view.gantt) delete P2.view.gantt.text; }); } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => { app.tx('Gaya batang', P2 => { P2.bars = bars; V.vs(P2).gantt ||= {}; P2.view.gantt.text = text; }); } }] });
};
Dlg.formatBar = () => {
  const app = A();
  const s = app.selTasks();
  if (!s.length) return;
  let c = s[0].color || '#4a8fd9';
  UI.dialog({ title: 'Format Batang · ' + (s.length === 1 ? s[0].name : s.length + ' tugas'), width: '420px', body: el('div', UI.field('Warna batang', UI.color(c, v => { c = v; })), el('p.hint', 'Tugas kritis tetap merah saat "Tugas Kritis" aktif.')),
    buttons: [{ label: 'Warna Bawaan', left: true, run: () => app.cmd('barColor', null) }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => app.cmd('barColor', c) }] });
};
Dlg.textStyles = () => {
  const app = A(), P = P_();
  const o = { ...P.opts };
  let rowH = o.rowH || 24, sumBold = (P.view && P.view.tstyle && P.view.tstyle.sumBold) !== false, critRed = !!(P.view && P.view.tstyle && P.view.tstyle.critRed);
  const rh = el('input.inp', { type: 'number', min: 18, max: 48, value: rowH });
  rh.addEventListener('change', () => { rowH = U.clamp(+rh.value || 24, 18, 48); });
  UI.dialog({ title: 'Gaya Teks', width: '440px', body: el('div', UI.field('Tinggi baris (px)', rh), el('div.checks', UI.checkbox('Tugas ringkasan ditebalkan', sumBold, v => { sumBold = v; }), UI.checkbox('Nama tugas kritis berwarna merah', critRed, v => { critRed = v; })), el('p.hint', 'Format per tugas (tebal, miring, warna): pilih tugas lalu Tugas › Font.')),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { app.tx('Gaya teks', P2 => { P2.opts.rowH = rowH; V.vs(P2).tstyle = { sumBold, critRed }; }); app.critText = critRed; document.body.classList.toggle('sum-normal', !sumBold); } }] });
};
Dlg.layout = () => {
  const app = A(), P = P_();
  const g = G.optsOf(P);
  let links = g.links, round = g.round, barH = g.barH, df = g.dateFmt;
  UI.dialog({ title: 'Tata Letak', width: '480px', body: el('div',
    el('div.lbl', 'Tautan'), UI.radio('lyl', [['elbow', 'Siku (seperti Microsoft Project)'], ['straight', 'Lurus'], ['none', 'Tidak ditampilkan']], links, v => { links = v; }),
    grid2(UI.field('Format tanggal pada batang', UI.select([['d/m', '18/11'], ['d mmm', '18 Nov'], ['dd/mm/yy', '18/11/26']], df, v => { df = v; })), UI.field('Tinggi batang', UI.select([['0.42', 'Kecil'], ['0.5', 'Sedang'], ['0.62', 'Besar']], String(barH), v => { barH = +v; }))),
    UI.checkbox('Bulatkan batang ke hari penuh', round, v => { round = v; })),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { V.vs(P).gantt ||= {}; Object.assign(P.view.gantt, { links, round, barH, dateFmt: df }); app.viewChanged(); app.refresh(); } }] });
};
Dlg.gridlines = () => {
  const app = A(), P = P_();
  const g = G.optsOf(P);
  const o = { rowLines: g.rowLines, grid: g.grid, today: g.today, sd: g.sd, shade: g.shade, pb: g.pb };
  UI.dialog({ title: 'Garis Kisi', width: '440px', body: el('div.checks',
    UI.checkbox('Garis antar baris Gantt', o.rowLines, v => { o.rowLines = v; }),
    UI.checkbox('Garis vertikal skala waktu (tingkat atas)', o.grid !== 'none', v => { o.grid = v ? 'top' : 'none'; }),
    UI.checkbox('Garis tanggal saat ini', o.today, v => { o.today = v; }),
    UI.checkbox('Garis tanggal status', o.sd, v => { o.sd = v; }),
    UI.checkbox('Arsir waktu non-kerja', o.shade, v => { o.shade = v; }),
    UI.checkbox('Pemisah halaman', o.pb, v => { o.pb = v; })),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { V.vs(P).gantt ||= {}; Object.assign(P.view.gantt, o); app.viewChanged(); app.refresh(); } }] });
};
Dlg.fieldSettings = (view, c) => {
  const app = A(), P = P_();
  const g = view.grid, kind = g.kind === 'res' ? 'res' : 'task';
  const title = el('input.inp', { value: c.title || '', placeholder: F.title(c.k, P, kind) });
  const w = el('input.inp', { type: 'number', min: 16, max: 800, value: c.w });
  let al = c.al || '', wrap = !!c.wrap, k = c.k;
  UI.dialog({ title: 'Pengaturan Kolom', width: '460px', body: el('div', UI.field('Nama kolom', UI.select(F.list(kind, P).map(f => [f.k, f.t]), k, v => { k = v; })), UI.field('Judul', title), grid2(UI.field('Rata', UI.select([['', 'Bawaan'], ['l', 'Kiri'], ['c', 'Tengah'], ['r', 'Kanan']], al, v => { al = v; })), UI.field('Lebar', w)), UI.checkbox('Bungkus teks', wrap, v => { wrap = v; })),
    buttons: [{ label: 'Paskan Lebar', left: true, run: () => { g.bestFit(g.cols.indexOf(c)); } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => { c.k = k; c.title = title.value.trim() || null; c.w = U.clamp(+w.value || c.w, 16, 800); c.al = al || null; c.wrap = wrap; F.saveCols(P, kind, view.table, g.cols); app.viewChanged(); app.refresh(); } }] });
};

/* ---------------- bantuan ---------------- */
Dlg.shortcuts = () => {
  const K = [
    ['Umum', [['Simpan', U.MOD + '+S'], ['Cetak / PDF', U.MOD + '+P'], ['Proyek baru', U.MOD + '+N'], ['Batalkan / Ulangi', U.MOD + '+Z / ' + U.MOD + '+Y'], ['Cari / Ganti', U.MOD + '+F / ' + U.MOD + '+H'], ['Pergi ke', 'F5'], ['Hitung proyek', 'F9'], ['Ciutkan ribbon', U.MOD + '+F1']]],
    ['Tugas', [['Sisipkan tugas', 'Insert'], ['Hapus tugas', 'Delete (kolom Nama)'], ['Informasi tugas', 'Shift+F2 / klik ganda'], ['Turunkan / naikkan tingkat', 'Alt+Shift+→ / ←'], ['Pindah ke atas / bawah', 'Alt+Shift+↑ / ↓'], ['Tautkan / putuskan', U.MOD + '+F2 / ' + U.MOD + '+Shift+F2'], ['Ciutkan / perluas', 'Alt+Shift+− / +'], ['Gulir ke tugas', U.MOD + '+Shift+F5'], ['Tetapkan sumber daya', 'Alt+F10']]],
    ['Tabel', [['Edit sel', 'F2 / langsung ketik'], ['Isi ke bawah', U.MOD + '+D'], ['Salin / potong / tempel', U.MOD + '+C / X / V'], ['Pilih semua', U.MOD + '+A'], ['Perluas seleksi', 'Shift+panah'], ['Pilih tambahan', U.MOD + '+klik']]],
    ['Bagan Gantt', [['Zoom skala waktu', U.MOD + '+roda mouse'], ['Pindahkan tugas', 'seret batang'], ['Ubah durasi', 'seret ujung kanan'], ['% selesai', 'seret dari ujung kiri batang'], ['Tautkan tugas', 'seret batang ke bawah/atas ke tugas lain'], ['Ubah tautan', 'klik ganda garis tautan']]],
  ];
  UI.dialog({ title: 'Pintasan Keyboard & Mouse', width: 'min(760px, 100%)', body: el('div.keys', ...K.map(([g, xs]) => el('div', el('h4', g), el('table', ...xs.map(([a, b]) => el('tr', el('td', a), el('td', el('kbd', b)))))))), buttons: [{ label: 'Tutup', primary: true }] });
};
Dlg.about = () => {
  UI.dialog({ title: 'Tentang Amatu Project', width: '520px', body: el('div.about', el('img', { src: 'icon.svg', width: 64, height: 64, alt: '' }), el('div',
    el('h3', 'Amatu Project'), el('p', 'Perencanaan & pengendalian proyek di browser dengan fitur Microsoft Project: tugas berjenjang, jalur kritis, tautan FS/SS/FF/SF + lag, batasan, kalender kerja & libur nasional, sumber daya kerja/material/biaya, pemerataan, garis dasar, nilai hasil, tampilan Gantt, Penggunaan, Kalender, Diagram Jaringan, Garis Waktu, Perencana Tim, Papan Tugas, laporan, serta cetak/PDF dan ekspor Excel/XML yang rapi.'),
    el('p.hint', 'Data tersimpan di perangkat dan tersinkron ke akun Portal AMATU. Versi: ' + (document.querySelector('meta[name=versi]') || {}).content))), buttons: [{ label: 'Tutup', primary: true }] });
};
})();
