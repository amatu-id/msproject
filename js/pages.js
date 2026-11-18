// Amatu Project — tata letak cetak / PDF (setara pengaturan ekspor Amatu Sheets):
// - yang dicetak dipilih otomatis (tampilan aktif, seluruh proyek, tugas terpilih, tingkat kerangka, atau paket lengkap
//   berisi tampilan yang relevan: Gantt, Lembar Sumber Daya, Penggunaan, laporan);
// - kertas, margin, skala Otomatis (memenuhi lebar kertas), orientasi Otomatis (yang paling terbaca), skala waktu yang
//   menyesuaikan halaman;
// - pemisah halaman rapi: grup tugas (ringkasan + subtugas) tidak dipotong bila muat satu halaman — dipindah utuh ke
//   halaman berikutnya; ringkasan tidak ditinggal sendirian di bawah halaman; grup yang lebih panjang dari satu halaman
//   berlanjut dengan judul kolom, skala waktu dan ringkasan induk diulang; pemisah halaman manual dihormati;
// - tabel/skala waktu yang lebih lebar dari kertas dibagi rata ke samping dengan kolom ID & Nama diulang.
// Halaman digambar sebagai SVG (tajam di PDF); satu kode untuk pratinjau dan cetak.
(() => {
'use strict';
const AP = window.AP, U = AP.U, F = AP.F, D = AP.D, V = AP.V, TS = AP.TS, G = AP.G, S = AP.S, { esc } = U;
const Pg = AP.Pg = {};

Pg.PAPER = {
  a4: { n: 'A4', mm: [210, 297] }, f4: { n: 'F4 / Folio', mm: [215, 330] }, letter: { n: 'Letter', mm: [215.9, 279.4] }, legal: { n: 'Legal', mm: [215.9, 355.6] },
  a3: { n: 'A3', mm: [297, 420] }, a2: { n: 'A2', mm: [420, 594] }, a1: { n: 'A1', mm: [594, 841] }, a5: { n: 'A5', mm: [148, 210] }, b5: { n: 'B5', mm: [176, 250] }, tabloid: { n: 'Tabloid', mm: [279.4, 431.8] },
};
Pg.MARGINS = [['normal', 'Normal', [1.91, 1.91, 1.78, 1.78]], ['narrow', 'Sempit', [1.27, 1.27, 0.64, 0.64]], ['wide', 'Lebar', [2.54, 2.54, 2.54, 2.54]], ['none', 'Minimal', [0.5, 0.5, 0.5, 0.5]], ['skripsi', 'Skripsi (4-3-3-4)', [4, 3, 4, 3]]];
const MPX = 96 / 2.54;
Pg.MPX = MPX;
// settings of a print view (shared keys edited by the dialog; per view in P.page[viewType])
Pg.DEF = { v: 1, size: 'a4', orient: 'auto', m: { t: 1.91, b: 1.91, l: 1.78, r: 1.78 }, fit: 'auto', scale: 100, hc: true, vc: false, num: true, title: 'first', legend: 'last', hdr: true, keep: true, tbl: 'all', cols: 'visible', wrap: false, ts: 'auto', grid: true, notes: false, range: null };
Pg.KEYS = Object.keys(Pg.DEF).filter(k => k !== 'v');
Pg.setup = (P, key) => { const p = (P.page && P.page[key]) || {}; return { ...Pg.DEF, ...p, m: { ...Pg.DEF.m, ...(p.m || {}) } }; };
Pg.marginPreset = m => (Pg.MARGINS.find(([, , v]) => v.every((x, i) => Math.abs(x - [m.t, m.b, m.l, m.r][i]) < 0.005)) || [''])[0];
Pg.paperPx = (p, orient) => { let [w, h] = (Pg.PAPER[p.size] || Pg.PAPER.a4).mm; if (orient === 'landscape') [w, h] = [h, w]; return { w, h, W: w / 25.4 * 96, H: h / 25.4 * 96 }; };
// print engine of a view
Pg.engine = viewId => {
  const d = V.def(String(viewId).split(':')[0]);
  if (d.type === 'gantt') return 'gantt';
  if (d.type === 'sheet') return 'table';
  if (d.type === 'usage') return 'usage';
  return 'art';
};
Pg.keyOf = viewId => { const d = V.def(String(viewId).split(':')[0]); return d.type === 'gantt' ? 'gantt' : String(viewId).split(':')[0]; };

/* ---------------- ukuran huruf & baris (px pada skala 100%) ---------------- */
const FS = 11, FONT = `${FS}px Inter, Arial, Helvetica, sans-serif`, FONT_B = `600 ${FS}px Inter, Arial, Helvetica, sans-serif`, FONT_H = `600 10.5px Inter, Arial, Helvetica, sans-serif`, FONT_S = '10px Inter, Arial, Helvetica, sans-serif';
const RH = 18, LINE = 13.5, TITLE_H = 48, LEG_H = 46, NUM_H = 18, TIER_H = 16, PERIOD_W = 44;
const AUTO_MAX = 1.25, SLACK = 0.99;

/* ---------------- model pita (Gantt / tabel / penggunaan) ---------------- */
// rows to print for a scope: 'view' (as on screen), 'all', 'sel', 'lvl:N'
Pg.rowsFor = (app, viewId, scope) => {
  const P = app.P, d = V.def(String(viewId).split(':')[0]);
  const kind = d.kind;
  if (Pg.engine(viewId) === 'usage') return V.usageRows ? V.usageRows(P, kind, { all: scope === 'all', sel: scope === 'sel' ? app.selTasks().map(t => t.uid) : null }) : [];
  if (kind === 'res') { const rows = V.resRows(P, {}).filter(r => r.kind !== 'blank'); return scope === 'sel' ? rows.filter(r => r.kind === 'group' || app.selRes().includes(r.x)) : rows; }
  let rows;
  if (scope === 'all' || /^lvl:/.test(scope)) {
    const lvl = /^lvl:(\d+)/.exec(scope);
    const vs = V.vs(P), keepCol = new Map(P.tasks.map(t => [t.uid, t.col])), keepF = vs.filter.task, keepAF = vs.af.task, keepLvl = vs.outlineLvl, keepG = vs.group.task;
    for (const t of P.tasks) t.col = false;
    vs.filter.task = null; vs.af.task = {}; vs.outlineLvl = lvl ? +lvl[1] : null; vs.group.task = null;
    try { rows = V.taskRows(P, {}); } finally { for (const t of P.tasks) t.col = keepCol.get(t.uid); vs.filter.task = keepF; vs.af.task = keepAF; vs.outlineLvl = keepLvl; vs.group.task = keepG; }
  } else rows = V.taskRows(P, {});
  rows = rows.filter(r => r.kind !== 'blank');
  if (scope === 'sel') {
    const sel = new Set(app.selTasks().map(t => t.uid));
    const keep = new Set();
    for (const t of P.tasks) if (sel.has(t.uid)) { keep.add(t.uid); for (let p = t.parent; p; p = p.parent) keep.add(p.uid); if (t.sum) for (const k of AP.M.leaves(t)) { keep.add(k.uid); for (let q = k.parent; q && q !== t; q = q.parent) keep.add(q.uid); } }
    rows = rows.filter(r => r.kind === 'group' || (r.x && (r.x.root || keep.has(r.x.uid))));
  }
  return rows;
};
// table columns to print
function colsFor(app, viewId, p) {
  const P = app.P, d = V.def(String(viewId).split(':')[0]);
  const kind = d.kind;
  if (Pg.engine(viewId) === 'usage') return [{ k: 'name', w: 200 }, { k: 'work', w: 70 }];
  const tb = V.tableOf(P, viewId);
  let cols = F.cols(P, kind, tb).map(c => ({ ...c }));
  // what the screen shows left of the divider (Gantt), unless all columns are wanted
  if (p.cols === 'visible' && Pg.engine(viewId) === 'gantt' && app.view && app.view.id === viewId && app.view.left) {
    const W = app.view.left.clientWidth - 46 + (app.view.grid ? app.view.grid.scroll.scrollLeft : 0);
    let x = 0; const out = [];
    for (const c of cols) { if (x + c.w * 0.35 > W && out.length) break; out.push(c); x += c.w; }
    cols = out;
  }
  // icon-only columns (indicators, task mode) are left out; widths scaled to print text size
  cols = cols.filter(c => c.k !== 'ind' && c.k !== 'mode');
  if (!cols.length) cols = [{ k: 'name', w: 220 }];
  return cols.map(c => ({ ...c, w: Math.max(28, Math.round(c.w * 0.86)) }));
}
const cellText = (P, kind, r, c) => {
  if (r.kind === 'group') return c.k === 'name' ? r.label + ' (' + r.n + ')' : '';
  if (!r.x) return '';
  if (r.kind === 'asg') return Pg.asgCell ? Pg.asgCell(P, r, c) : '';
  if (c.k === 'ind') { const n = (kind === 'res' ? F.resIndicators(r.x, P) : F.indicators(r.x, P)).length; return n ? '•' : ''; }
  if (c.k === 'mode') return r.x.mode === 'manual' ? 'M' : '';
  let s = F.text(kind, c.k, r.x, P);
  if (c.k === 'name' && P.opts.outlineNum && kind === 'task' && !r.x.root) s = r.x.outline + ' ' + s;
  return s;
};
Pg.cellText = cellText;
function bandModel(app, item, p) {
  const P = app.P, viewId = item.view, eng = Pg.engine(viewId), d = V.def(String(viewId).split(':')[0]);
  const kind = d.kind === 'res' ? 'res' : 'task';
  const rows = item.rows || Pg.rowsFor(app, viewId, item.scope || 'view');
  const cols = colsFor(app, viewId, p);
  const tableW = cols.reduce((s, c) => s + c.w, 0) + 30;   // + ID column
  // row heights (wrap long task names)
  const nameCol = cols.find(c => c.k === 'name');
  const hs = rows.map(r => {
    if (!p.wrap || !nameCol || !r.x || r.kind === 'group') return RH;
    const txt = cellText(P, kind, r, nameCol), pad = ((r.lvl || 1) - 1) * 10 + 8;
    const lines = U.wrap(txt, r.x.sum ? FONT_B : FONT, nameCol.w - pad - 6, 3).length;
    return Math.max(RH, lines * LINE + 5);
  });
  // time range
  let t0 = null, t1 = null;
  if (eng !== 'table') {
    const R = P.root;
    let a = Infinity, b = -Infinity;
    for (const r of rows) if (r.x && r.x.start != null && r.kind !== 'group') { a = Math.min(a, r.x.start); b = Math.max(b, r.x.finish); if (eng === 'gantt' && r.x.bl && r.x.bl[0]) { a = Math.min(a, r.x.bl[0].s); b = Math.max(b, r.x.bl[0].f); } if (r.x.deadline != null) b = Math.max(b, r.x.deadline); }
    if (!isFinite(a)) { a = R.start; b = R.finish; }
    if (p.range && p.range[0] != null) { a = p.range[0]; b = p.range[1]; }
    const span = Math.max(1440, b - a);
    t0 = U.dayStart(a - Math.max(1440, span * 0.015));
    t1 = Math.ceil((b + Math.max(1440 * 3, span * (eng === 'gantt' ? 0.13 : 0.03))) / 1440) * 1440;
  }
  // summary context: ancestors of each task row that are printed rows
  const idx = new Map();
  rows.forEach((r, i) => { if (r.x && r.kind === 'task' && !r.x.root) idx.set(r.x.uid, i); });
  const anc = rows.map(r => { const out = []; if (r.x && r.kind === 'task' && !r.x.root && !r.flat) for (let q = r.x.parent; q; q = q.parent) if (idx.has(q.uid)) out.unshift(idx.get(q.uid)); return out; });
  // groups (summary + its printed descendants) → [start, end]
  const groups = [];
  rows.forEach((r, i) => {
    if (r.kind === 'group') { let j = i + 1; while (j < rows.length && rows[j].kind !== 'group') j++; groups.push({ a: i, b: j - 1, lvl: 0 }); return; }
    if (!(r.x && r.kind === 'task' && r.x.sum) || r.flat || r.x.root) return;
    let j = i + 1;
    while (j < rows.length && rows[j].x && rows[j].kind === 'task' && !rows[j].x.root && rows[j].x.lvl > r.x.lvl) j++;
    if (eng === 'usage') { while (j < rows.length && rows[j].kind === 'asg') j++; }
    if (j - 1 > i) groups.push({ a: i, b: j - 1, lvl: r.x.lvl });
  });
  // usage: a task/resource row with its assignment rows is a unit too
  if (eng === 'usage') rows.forEach((r, i) => { if (r.kind === 'asg') return; let j = i + 1; while (j < rows.length && rows[j].kind === 'asg') j++; if (j - 1 > i) groups.push({ a: i, b: j - 1, lvl: 99 }); });
  const pre = new Float64Array(rows.length + 1);
  for (let i = 0; i < rows.length; i++) pre[i + 1] = pre[i] + hs[i];
  const hOf = (a, b) => (b < a ? 0 : pre[b + 1] - pre[a]);
  const pb = new Set();
  rows.forEach((r, i) => { if (i > 0 && r.x && r.kind === 'task' && r.x.pb) pb.add(i); });
  return { P, viewId, eng, kind, rows, hs, hOf, cols, tableW, t0, t1, anc, groups, pb, d };
}

/* ---------------- pemisah halaman (baris) ---------------- */
function rowPages(A, cap, p, extra) {
  const { rows, hOf, anc, groups, pb } = A;
  const pages = [];
  let start = 0, moved = 0;
  const ctxOf = i => (p.hdr ? anc[i].filter(j => j < i) : []);
  const ctxH = i => ctxOf(i).reduce((s, j) => s + A.hs[j], 0);
  while (start < rows.length) {
    const first = !pages.length;
    const avail = cap(pages.length) - (first ? 0 : ctxH(start)) - (extra ? extra(pages.length) : 0);
    // furthest row that fits (at least one)
    let e = start;
    if (hOf(start, start) <= avail) { let lo = start, hi = rows.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (hOf(start, mid) <= avail + 1e-6) lo = mid; else hi = mid - 1; } e = lo; }
    let b = e + 1;
    // manual page break
    for (const x of pb) if (x > start && x < b) { b = x; break; }
    const forced = [...pb].some(x => x === b);
    if (b < rows.length && !forced && p.keep) { const nb = tidy(A, b, start, cap(pages.length + 1) - 0, ctxH); if (nb !== b) moved++; b = nb; }
    pages.push({ r0: start, r1: Math.min(b - 1, rows.length - 1), ctx: first ? [] : ctxOf(start) });
    start = b;
  }
  return { pages, moved };
}
// move a page break up so a task group is not cut when it fits on a page, and no summary is left alone at the bottom
function tidy(A, b0, start, capNext, ctxH) {
  const { rows, hOf, groups } = A;
  let b = b0;
  for (let g = 0; g < 40; g++) {
    let nb = b;
    // 1. the outermost group crossing the break that fits on one page moves whole
    let best = null;
    for (const G0 of groups) if (G0.a < nb && G0.b >= nb && G0.a > start && hOf(G0.a, G0.b) + ctxH(G0.a) <= capNext * SLACK) { if (!best || G0.a < best.a) best = G0; }
    if (best) nb = best.a;
    // 2. no heading (summary / group row) as the last row of a page
    while (nb - 1 > start && rows[nb - 1] && (rows[nb - 1].kind === 'group' || (rows[nb - 1].x && rows[nb - 1].x.sum && rows[nb] && rows[nb].x && rows[nb].kind !== 'group' && (rows[nb].x.lvl > rows[nb - 1].x.lvl || rows[nb].kind === 'asg')))) nb--;
    // 3. a task row is not separated from its assignment rows (usage views)
    while (nb > start + 1 && rows[nb] && rows[nb].kind === 'asg' && hOf(start, nb) > 0) { const k = nb; let a = k; while (a > start && rows[a].kind === 'asg') a--; if (a > start) nb = a; else break; }
    if (nb === b) break;
    b = nb;
  }
  return b > start ? b : b0;
}

/* ---------------- skala & orientasi ---------------- */
const TS_PPD = { day: 22, week: 5.5, month: 1.4, quarter: 0.55, year: 0.18 };
function solveBand(A, p, orient, app) {
  const paper = Pg.paperPx(p, orient);
  const cw = paper.W - (p.m.l + p.m.r) * MPX;
  const chBase = paper.H - (p.m.t + p.m.b) * MPX - (p.num ? NUM_H : 0);
  const hasChart = A.eng !== 'table';
  const days = hasChart ? Math.max(1, (A.t1 - A.t0) / 1440) : 0;
  const tiersFor = ppd => (A.eng === 'usage' ? [{ u: usageUnit(ppd), n: 1 }] : TS.tiers(A.P, ppd, p.ts === 'view' ? null : { auto: true }));
  const headH = ppd => (hasChart ? Math.max(30, tiersFor(ppd).length * TIER_H + (A.eng === 'usage' ? 14 : 0)) : 30);
  const titleH = i => (p.title === 'every' || (p.title === 'first' && i === 0) ? TITLE_H : 0);
  const legH = A.eng === 'gantt' && p.legend !== 'none' ? LEG_H : 0;
  // manual zoom: from the screen or a fixed unit
  const viewPpd = () => { const v = app.view; return v && v.chart ? v.chart.ppd : (V.vs(A.P).zoom.gantt || TS.DEF_PPD); };
  const fixedPpd = p.ts === 'view' ? viewPpd() : TS_PPD[p.ts] || null;
  const minChart = d => Math.max(240, days * (A.eng === 'usage' ? 0 : 0.45)) + (A.eng === 'usage' ? PERIOD_W * 3 : 0);
  let s, ppd, across = false;
  const fitW = hasChart ? cw / (A.tableW + minChart()) : cw / (A.tableW + 2);
  const fitAll = s0 => Math.min(s0, (chBase - TITLE_H - legH) / (headH(fixedPpd || 2) + A.hOf(0, A.rows.length - 1) + 2));
  if (p.fit === 'normal') s = (p.scale || 100) / 100;
  else if (p.fit === 'page') s = Math.min(AUTO_MAX, fitAll(fitW));
  else s = Math.min(hasChart ? 1 : AUTO_MAX, fitW);
  s = U.clamp(s, 0.1, 4);
  const chartW = s => Math.max(80, cw / s - A.tableW);
  if (hasChart) {
    if (fixedPpd && (p.fit === 'normal' || p.ts !== 'auto')) { ppd = fixedPpd; across = days * ppd > chartW(s) + 1; }
    else ppd = chartW(s) / days;
    if (A.eng === 'usage' && !fixedPpd) ppd = chartW(s) / days;
  }
  const at = sc => rowPages(A, i => (chBase / sc) * SLACK - headH(ppd) - titleH(i) - (p.legend === 'every' ? legH : 0), p, null);
  // pages incl. a legend that needs room on the last page
  const count = sc => {
    const R0 = at(sc);
    if (!(legH && p.legend === 'last')) return R0.pages.length;
    const last = R0.pages[R0.pages.length - 1];
    const used = A.hOf(last.r0, last.r1) + (last.ctx || []).reduce((q, j) => q + A.hs[j], 0);
    return used + legH > (chBase / sc) * SLACK - headH(ppd) - titleH(R0.pages.length - 1) ? R0.pages.length + 1 : R0.pages.length;
  };
  // automatic: a document that spills onto an almost empty last page shrinks a little more when that saves a page
  if (p.fit === 'auto') {
    const n = count(s);
    if (n > 1 && n <= 4) {
      const lo = s * (s >= 0.9 ? 0.78 : s >= 0.7 ? 0.84 : 0.9), nLo = count(lo);
      if (nLo < n) { let a = lo, b = s; for (let i = 0; i < 10; i++) { const mid = (a + b) / 2; if (count(mid) <= nLo) a = mid; else b = mid; } s = a; if (hasChart && !fixedPpd) ppd = chartW(s) / days; }
    }
  }
  let R = at(s);
  // legend on the last page: make room
  if (legH && p.legend === 'last') {
    const last = R.pages[R.pages.length - 1];
    const used = A.hOf(last.r0, last.r1) + (last.ctx || []).reduce((q, j) => q + A.hs[j], 0);
    const cap = (chBase / s) * SLACK - headH(ppd) - titleH(R.pages.length - 1);
    if (used + legH > cap) {
      const n0 = R.pages.length;
      R = rowPages(A, i => (chBase / s) * SLACK - headH(ppd) - titleH(i) - (i >= n0 - 1 ? legH : 0), p, null);
    }
  }
  // columns across: time chunks (and table columns when too wide)
  let colPages = [{ c0: 0, c1: A.cols.length - 1, t0: A.t0, t1: A.t1, table: true }];
  if (hasChart && across) {
    const chunks = [];
    let t = A.t0, k = 0;
    const tUnit = A.eng === 'usage' ? usageUnit(ppd) : null;
    while (t < A.t1 && k < 200) {
      const tbl = k === 0 || p.tbl === 'all' ? A.tableW : p.tbl === 'label' ? labelW(A) : 0;
      const w = Math.max(60, cw / s - tbl);
      let e = t + (w / ppd) * 1440;
      if (tUnit) { const ticks = TS.ticks(tUnit, 1, t, A.t1 + 1, A.P); let x = t; for (const tk of ticks) { if (tk.e > e && x > t) break; x = tk.e; } e = Math.max(x, TS.next(tUnit, TS.floor(tUnit, t, A.P))); }
      chunks.push({ c0: 0, c1: A.cols.length - 1, t0: t, t1: Math.min(e, A.t1), table: k === 0 || p.tbl === 'all', label: k > 0 && p.tbl === 'label' });
      t = e; k++;
    }
    colPages = chunks;
  } else if (!hasChart && A.tableW * s > cw + 1) {
    // a table wider than the paper: split columns, ID & Name repeated on the next pages
    const W = cw / s, lab = labelW(A);
    const chunks = [];
    let c = 0;
    while (c < A.cols.length) {
      let w = c === 0 ? 30 : lab, e = c;
      for (; e < A.cols.length; e++) { if (w + A.cols[e].w > W && e > c) break; w += A.cols[e].w; }
      chunks.push({ c0: c, c1: e - 1, label: c > 0 });
      c = e;
      if (c > 0 && A.cols[c] && A.cols[c].k === 'name') c++;
    }
    colPages = chunks;
  }
  const pages = colPages.length * R.pages.length;
  const split = A.groups.filter(g => R.pages.some(x => x.r0 > g.a && x.r0 <= g.b)).length;
  return { orient, paper, cw, ch: chBase, s, ppd, tiers: hasChart ? tiersFor(ppd || 2) : null, headH: headH(ppd || 2), rowPages: R.pages, colPages, pages, moved: R.moved, split, repeated: R.pages.filter(x => x.ctx && x.ctx.length).length, fitW, across, legH };
}
const labelW = A => 30 + A.cols.filter(c => c.k === 'name').reduce((s, c) => s + c.w, 0);
const usageUnit = ppd => (ppd * 1 >= PERIOD_W ? 'day' : ppd * 7 >= PERIOD_W ? 'week' : ppd * 30.4 >= PERIOD_W ? 'month' : ppd * 91 >= PERIOD_W ? 'quarter' : 'year');
Pg.usageUnit = usageUnit;

/** Layout of one print item {view, scope, rows?} with settings p. */
Pg.layout = (app, item, over) => {
  const P = app.P, key = Pg.keyOf(item.view);
  const p = { ...Pg.setup(P, key), ...(over || {}) };
  const eng = Pg.engine(item.view);
  if (eng === 'art') return Pg.layoutArt(app, item, p);
  const A = bandModel(app, item, p);
  if (!A.rows.length) return { p, item, A, eng, empty: true, pages: 0, paper: Pg.paperPx(p, p.orient === 'landscape' ? 'landscape' : 'portrait'), orient: 'portrait', s: 1 };
  const cands = (p.orient === 'auto' ? ['portrait', 'landscape'] : [p.orient === 'landscape' ? 'landscape' : 'portrait']).map(o => solveBand(A, p, o, app));
  // fewest pages, small print counts (each 10% under 85% weighs a page), pages side by side weigh half a page more;
  // a Gantt prefers the paper on which the timescale gets more room
  // a Gantt also weighs how much room the timescale gets (bars of a few px per day are hard to read) and leans to landscape
  const cost = c => c.pages + Math.max(0, 0.85 - c.s) * 10 + (c.colPages.length - 1) * 0.5 + (A.eng === 'gantt' && c.ppd ? Math.max(0, 4 - c.ppd) * 0.3 + (c.orient === 'portrait' ? 0.3 : 0) : 0);
  let best = cands[0];
  for (const c of cands.slice(1)) { const d = cost(c) - cost(best); if (d < -1e-9 || (Math.abs(d) <= 1e-9 && (c.s > best.s + 1e-9 || (A.eng !== 'table' && c.orient === 'landscape')))) best = c; }
  return { p, item, A, eng, ...best, other: cands.find(c => c !== best) || null };
};

/* ---------------- menggambar halaman pita ---------------- */
function pageSVG(app, L, rp, cp, idx, total) {
  const P = app.P, A = L.A, p = L.p, s = L.s;
  const W = L.cw / s, Hc = L.ch / s;
  const out = [];
  const isFirst = rp === L.rowPages[0] && cp === L.colPages[0];
  const showTitle = p.title === 'every' || (p.title === 'first' && isFirst);
  let y = 0;
  if (showTitle) { out.push(titleBlock(P, W, A)); y += TITLE_H; }
  const cols = cp.table === false && !cp.label ? [] : cp.label ? A.cols.filter(c => c.k === 'name') : A.cols.slice(cp.c0, cp.c1 + 1);
  const showTable = cp.table !== false || cp.label;
  const idW = showTable ? 30 : 0;
  const tW = showTable ? idW + cols.reduce((q, c) => q + c.w, 0) : 0;
  const hasChart = A.eng !== 'table';
  const chartX = tW, chartW = hasChart ? Math.max(40, W - tW) : 0;
  const HH = L.headH;
  // rows of this page: context rows + rows
  const list = [...(rp.ctx || []).map(i => ({ i, ctx: true })), ...range(rp.r0, rp.r1).map(i => ({ i }))];
  const ys = [], hs = [];
  let yy = y + HH;
  for (const it of list) { ys.push(yy); hs.push(A.hs[it.i]); yy += A.hs[it.i]; }
  const bodyBottom = yy;
  // header row
  out.push(`<rect x="0" y="${y}" width="${tW + chartW}" height="${HH}" fill="#f2f4f7"/>`);
  if (showTable) {
    let x = 0;
    out.push(cellBox(0, y, idW, HH, 'ID', 'c', FONT_H, '#3c4450', true));
    x = idW;
    for (const c of cols) { out.push(cellBox(x, y, c.w, HH, c.title || (F.reg(A.kind)[c.k] || {}).short || F.title(c.k, P, A.kind), c.al || alignOf(A.kind, c.k), FONT_H, '#3c4450', true, true)); x += c.w; }
  }
  // body rows (table)
  const RP = P;
  list.forEach((it, k) => {
    const r = A.rows[it.i], ry = ys[k], rh = hs[k];
    const sum = r.x && r.x.sum && r.kind === 'task';
    const fill = it.ctx ? '#f7f8fa' : r.kind === 'group' ? '#eaf0f8' : sum ? '#f6f7f9' : r.hl ? '#fff3b8' : r.kind === 'asg' ? '#ffffff' : '#ffffff';
    if (showTable) {
      out.push(`<rect x="0" y="${ry}" width="${tW}" height="${rh}" fill="${fill}"/>`);
      const idTxt = r.kind === 'group' || r.kind === 'asg' ? '' : r.x ? String(r.x.id != null ? r.x.id : '') : '';
      out.push(cellBox(0, ry, idW, rh, idTxt, 'c', FONT_S, '#7b8490', p.grid));
      let x = idW;
      for (const c of cols) {
        let txt = cellText(RP, A.kind, r, c);
        const bold = (sum || r.kind === 'group') && !it.ctx;
        let font = bold ? FONT_B : FONT;
        let color = it.ctx ? '#7b8490' : r.x && r.x.inact ? '#9aa3ad' : r.kind === 'asg' ? '#4b5563' : '#1f2328';
        if (c.k === 'name' && it.ctx) { txt += ' (lanjutan)'; font = `italic ${FONT}`; }
        if (c.k === 'name') {
          const lvl = r.kind === 'asg' ? (r.lvl || 2) : (r.lvl || (r.x && r.x.lvl) || 1);
          const pad = Math.max(0, lvl - 1) * 10 + 4;
          if (p.wrap && !it.ctx) { const lines = U.wrap(txt, font, c.w - pad - 6, 3); out.push(cellBox(x, ry, c.w, rh, '', 'l', font, color, p.grid)); lines.forEach((ln, q) => out.push(`<text x="${(x + pad + 3).toFixed(1)}" y="${(ry + 4 + LINE * (q + 0.78)).toFixed(1)}" style="font:${font}" fill="${color}">${esc(ln)}</text>`)); }
          else out.push(cellBox(x, ry, c.w, rh, txt, 'l', font, color, p.grid, false, pad));
        } else out.push(cellBox(x, ry, c.w, rh, txt, c.al || alignOf(A.kind, c.k), font, color, p.grid));
        x += c.w;
      }
    }
  });
  // chart
  if (hasChart) {
    const ppd = L.ppd, t0 = cp.t0 != null ? cp.t0 : A.t0, t1 = cp.t1 != null ? cp.t1 : A.t1;
    const cwid = Math.min(chartW, ((t1 - t0) / 1440) * ppd + 1);
    const clip = 'c' + idx;
    out.push(`<clipPath id="${clip}"><rect x="${chartX}" y="${y}" width="${cwid}" height="${bodyBottom - y}"/></clipPath><clipPath id="${clip}b"><rect x="${chartX}" y="${y + HH}" width="${cwid}" height="${Math.max(0, bodyBottom - y - HH)}"/></clipPath><g clip-path="url(#${clip})">`);
    if (A.eng === 'usage') out.push(usageGrid(app, L, list, ys, hs, chartX, y, cwid, t0, t1));
    else {
      out.push(`<g transform="translate(${chartX},${y})">${G.scaleSVG({ P, ppd, origin: t0, x0: 0, x1: cwid, h: HH, tiers: L.tiers, font: '500 10px Inter, Arial, sans-serif', color: '#4b5563', line: '#cfd5dc', stick: true, vx0: 0, vx1: cwid })}</g>`);
      // rows for G.svg: printed list order, coordinates of all rows (links reach outside the page)
      const rowsP = list.map(it => A.rows[it.i]);
      const rowIdx = new Map();
      rowsP.forEach((r, i) => { if (r.x && r.kind === 'task') rowIdx.set(r.x.uid, i); });
      // rows outside this page keep their place above/below so links leave the page in the right direction
      const allIdx = new Map();
      A.rows.forEach((r, i) => { if (r.x && r.kind === 'task' && !rowIdx.has(r.x.uid)) allIdx.set(r.x.uid, i); });
      const extRows = [...rowsP];
      const yOf = [...ys.map(v => v - y - HH)], hOfA = [...hs];
      for (const [uid, i] of allIdx) { const r = A.rows[i]; const before = i < rp.r0; extRows.push(r); rowIdx.set(uid, extRows.length - 1); yOf.push(before ? -40 - (rp.r0 - i) * 6 : bodyBottom - y - HH + 40 + (i - rp.r1) * 6); hOfA.push(A.hs[i]); }
      const go = { ...G.optsOf(P), shade: ppd >= 6, today: false, sd: false, sel: null, pb: false };
      const res = G.svg({ P, rows: extRows, yOf: i => yOf[i], hOf: i => hOfA[i], rowH: RH, ppd, origin: t0, x0: 0, x1: cwid, i0: 0, i1: rowsP.length - 1, mode: V.def(String(A.viewId).split(':')[0]).mode || 'gantt', go, pal: G.bars(P), font: '500 10px Inter, Arial, sans-serif', fontSmall: '9.5px Inter, Arial, sans-serif', text: '#1f2328', rowIdx, tiers: L.tiers, barFrac: 0.55 });
      out.push(`<g clip-path="url(#${clip}b)"><g transform="translate(${chartX},${y + HH})">${res.svg}</g></g>`);
      // context rows are drawn lighter
      list.forEach((it, k) => { if (it.ctx) out.push(`<rect x="${chartX}" y="${ys[k]}" width="${cwid}" height="${hs[k]}" fill="#ffffff" opacity=".55"/>`); });
    }
    out.push('</g>');
    out.push(`<rect x="${chartX}" y="${y}" width="${cwid}" height="${bodyBottom - y}" fill="none" stroke="#b9c1ca" stroke-width="1"/>`);
  }
  // table frame & row lines
  if (showTable) {
    if (p.grid) for (let k = 0; k < list.length; k++) out.push(`<line x1="0" y1="${(ys[k] + hs[k]).toFixed(1)}" x2="${tW}" y2="${(ys[k] + hs[k]).toFixed(1)}" stroke="#dde2e8" stroke-width=".8"/>`);
    out.push(`<line x1="0" y1="${y + HH}" x2="${tW + (hasChart ? 0 : 0)}" y2="${y + HH}" stroke="#9aa3ad"/>`);
    out.push(`<rect x="0" y="${y}" width="${tW}" height="${bodyBottom - y}" fill="none" stroke="#9aa3ad" stroke-width="1"/>`);
  }
  // legend
  const lastPage = idx === total;
  let used = bodyBottom;
  if (L.legH && (p.legend === 'every' || (p.legend === 'last' && rp === L.rowPages[L.rowPages.length - 1] && cp === L.colPages[L.colPages.length - 1]))) {
    out.push(legend(P, used + 10, W, A));
    used += L.legH + 10;
  }
  if (p.notes && lastPage) { /* notes are a separate block page section */ }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}" height="${Math.max(used, 10).toFixed(1)}" viewBox="0 0 ${W.toFixed(1)} ${Math.max(used, 10).toFixed(1)}">${out.join('')}</svg>`, h: used, W, Hc };
}
const range = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(i); return o; };
const alignOf = (kind, k) => { const f = F.reg(kind)[k] || {}; return f.al === 'r' ? 'r' : f.al === 'c' ? 'c' : 'l'; };
function cellBox(x, y, w, h, txt, al, font, color, grid, head, pad = 0) {
  const t = U.fit(txt, font, w - 8 - pad);
  const tx = al === 'r' ? x + w - 4 : al === 'c' ? x + w / 2 : x + 4 + pad;
  const anchor = al === 'r' ? 'end' : al === 'c' ? 'middle' : 'start';
  const ty = head ? y + h - 7 : y + Math.min(h, RH) / 2 + 3.8;
  return (grid !== false ? `<line x1="${(x + w).toFixed(1)}" y1="${y}" x2="${(x + w).toFixed(1)}" y2="${(y + h).toFixed(1)}" stroke="#dde2e8" stroke-width=".8"/>` : '') + (t ? `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" style="font:${font}" fill="${color}">${esc(t)}</text>` : '');
}
function titleBlock(P, W, A) {
  const R = P.root;
  const sub = [U.fmtDate(R.start, 'dd mmm yyyy') + ' – ' + U.fmtDate(R.finish, 'dd mmm yyyy'), D.fmtDur(R.sdur, 'd', P.opts), U.num(R.pct, 0) + '% selesai', P.props.manager ? 'Manajer: ' + P.props.manager : '', P.props.company || ''].filter(Boolean).join('  ·  ');
  const vname = V.def(String(A.viewId).split(':')[0]).t;
  return `<text x="0" y="17" style="font:700 15px Inter, Arial, sans-serif" fill="#111827">${esc(U.fit(P.name, '700 15px Inter, Arial', W * 0.7))}</text>`
    + `<text x="${W}" y="17" text-anchor="end" style="font:500 10px Inter, Arial, sans-serif" fill="#6b7280">${esc(vname + ' · dicetak ' + U.fmtDate(U.now(), 'dd mmm yyyy HH.MM'))}</text>`
    + `<text x="0" y="34" style="font:10.5px Inter, Arial, sans-serif" fill="#4b5563">${esc(U.fit(sub, '10.5px Inter, Arial', W))}</text>`
    + `<line x1="0" y1="${TITLE_H - 7}" x2="${W}" y2="${TITLE_H - 7}" stroke="#0f7a55" stroke-width="1.5"/>`;
}
function legend(P, y, W, A) {
  const pal = G.bars(P), go = G.optsOf(P);
  const items = [['task', 'Tugas'], ['crit', 'Tugas kritis'], ['prog', 'Kemajuan'], ['sum', 'Ringkasan'], ['ms', 'Tonggak'], ['manual', 'Tugas manual']];
  if (go.base != null || V.def(String(A.viewId).split(':')[0]).mode === 'tracking') items.push(['base', 'Garis dasar']);
  if (P.tasks.some(t => t.deadline != null)) items.push(['dead', 'Tenggat']);
  if (P.tasks.some(t => t.inact)) items.push(['inact', 'Tidak aktif']);
  const out = [`<rect x="0" y="${y}" width="${W}" height="${LEG_H - 6}" fill="#fafbfc" stroke="#cfd5dc"/>`];
  out.push(`<text x="10" y="${y + 15}" style="font:600 10px Inter, Arial, sans-serif" fill="#111827">${esc(U.fit(P.name, '600 10px Inter', 210))}</text><text x="10" y="${y + 29}" style="font:9.5px Inter, Arial, sans-serif" fill="#6b7280">${esc('Tanggal: ' + U.fmtDate(U.now(), 'dd mmm yyyy'))}</text>`);
  let x = 240, row = 0;
  const colW = Math.max(110, (W - 250) / Math.ceil(items.length / 2));
  items.forEach(([k, n], i) => {
    const xx = x + Math.floor(i / 2) * colW, yy = y + 9 + (i % 2) * 15;
    let sym = '';
    if (k === 'task' || k === 'crit' || k === 'manual' || k === 'base') sym = `<rect x="${xx}" y="${yy + 1}" width="26" height="${k === 'base' ? 5 : 8}" rx="1.5" fill="${pal[k].fill}" stroke="${pal[k].line || pal[k].fill}" stroke-width=".6"${k === 'manual' ? ' stroke-dasharray="3 2"' : ''}/>`;
    else if (k === 'prog') sym = `<rect x="${xx}" y="${yy + 1}" width="26" height="8" rx="1.5" fill="${pal.task.fill}"/><rect x="${xx}" y="${yy + 3}" width="16" height="4" fill="${pal.task.prog}"/>`;
    else if (k === 'sum') sym = `<path d="M${xx} ${yy + 2}h26v7l-3-3h-20l-3 3z" fill="${pal.sum.fill}"/>`;
    else if (k === 'ms') sym = `<path d="M${xx + 13} ${yy}l5 5-5 5-5-5z" fill="${pal.ms.fill}"/>`;
    else if (k === 'dead') sym = `<path d="M${xx + 9} ${yy + 1}h8l-4 6z" fill="${pal.dead.fill}"/>`;
    else if (k === 'inact') sym = `<rect x="${xx}" y="${yy + 1}" width="26" height="8" fill="none" stroke="${pal.inact.line}"/>`;
    out.push(sym + `<text x="${xx + 32}" y="${yy + 9}" style="font:9.5px Inter, Arial, sans-serif" fill="#374151">${esc(n)}</text>`);
    void row;
  });
  return out.join('');
}
// time-phased grid of usage views (work per period)
function usageGrid(app, L, list, ys, hs, x0, y, w, t0, t1) {
  const P = app.P, A = L.A;
  const unit = usageUnit(L.ppd);
  const X = t => x0 + ((t - t0) / 1440) * L.ppd;
  const ticks = TS.ticks(unit, 1, t0, t1, P, 2000);
  const out = [];
  const HH = L.headH;
  // header: two lines (period label + upper unit)
  const top = unit === 'day' ? 'week' : unit === 'week' ? 'month' : unit === 'month' ? 'quarter' : 'year';
  out.push(`<g transform="translate(${x0},${y})">${G.scaleSVG({ P, ppd: L.ppd, origin: t0, x0: 0, x1: w, h: HH, tiers: [{ u: top, n: 1 }, { u: unit, n: 1 }], font: '500 10px Inter, Arial, sans-serif', color: '#4b5563', line: '#cfd5dc' })}</g>`);
  list.forEach((it, k) => {
    const r = A.rows[it.i];
    if (!r.x || r.kind === 'group') return;
    for (const tk of ticks) {
      const a = X(tk.s), b = X(tk.e);
      const v = Pg.usageValue ? Pg.usageValue(P, r, tk.s, tk.e, 'work') : 0;
      if (!v) continue;
      const over = r.kind === 'res' && r.x.over && v > S.capIn(P, r.x, tk.s, tk.e) + 1;
      const txt = Pg.fmtUsage ? Pg.fmtUsage(P, r, v) : U.num(v / 60, 1) + 'j';
      out.push(`<text x="${(b - 4).toFixed(1)}" y="${(ys[k] + RH / 2 + 3.6).toFixed(1)}" text-anchor="end" style="font:${r.kind === 'asg' ? '' : '600 '}9.5px Inter, Arial, sans-serif" fill="${over ? '#c62828' : '#1f2328'}">${esc(U.fit(txt, '9.5px Inter', b - a - 5))}</text>`);
    }
  });
  for (const tk of ticks) { const a = X(tk.s); out.push(`<line x1="${a.toFixed(1)}" y1="${y + HH}" x2="${a.toFixed(1)}" y2="${(ys[ys.length - 1] || y) + (hs[hs.length - 1] || 0)}" stroke="#e3e7ec" stroke-width=".8"/>`); }
  list.forEach((it, k) => out.push(`<line x1="${x0}" y1="${(ys[k] + hs[k]).toFixed(1)}" x2="${x0 + w}" y2="${(ys[k] + hs[k]).toFixed(1)}" stroke="#eef1f4" stroke-width=".8"/>`));
  return out.join('');
}

/* ---------------- tampilan lain: gambar yang diskalakan & dipotong rapi ---------------- */
// view classes provide printArt(app, p) → {w, h, svg, breaks:[y...]} (natural size in px)
Pg.layoutArt = (app, item, p) => {
  const P = app.P;
  const id = String(item.view);
  const d = V.def(id.split(':')[0]);
  const T = V.TYPES[d.type];
  const art = T && T.printArt ? T.printArt(app, id, p, item) : null;
  if (!art || !art.w || !art.h) return { p, item, eng: 'art', empty: true, pages: 0, paper: Pg.paperPx(p, 'portrait'), orient: 'portrait', s: 1 };
  const solve = orient => {
    const paper = Pg.paperPx(p, orient);
    const cw = paper.W - (p.m.l + p.m.r) * MPX, ch = paper.H - (p.m.t + p.m.b) * MPX - (p.num ? NUM_H : 0);
    const tH = p.title !== 'none' ? TITLE_H : 0;
    let s;
    const fitW = cw / art.w, fitP = Math.min(fitW, (ch - tH) / art.h);
    if (p.fit === 'normal') s = (p.scale || 100) / 100;
    else if (p.fit === 'page' || (p.fit === 'auto' && fitP >= Math.min(fitW, art.maxScale || 1.2) * 0.7)) s = Math.min(art.maxScale || 1.2, fitP);
    else s = Math.min(art.maxScale || 1.2, fitW);
    // too small to read on one page: print larger across several pages (tiles)
    if (p.fit === 'auto' && s < 0.45) s = Math.min(0.62, art.maxScale || 1);
    s = U.clamp(s, 0.08, 4);
    // vertical slices at safe break points
    const capFirst = (ch - tH) / s, cap = (ch - (p.title === 'every' ? tH : 0)) / s;
    const slices = [];
    let y0 = 0;
    const br = [...(art.breaks || []), art.h].sort((a, b) => a - b);
    let k = 0;
    while (y0 < art.h - 0.5 && k++ < 500) {
      const lim = y0 + (slices.length ? cap : capFirst);
      let y1 = art.h;
      if (lim < art.h) { const cand = br.filter(b => b > y0 + 20 && b <= lim); y1 = cand.length ? cand[cand.length - 1] : lim; }
      slices.push([y0, y1]);
      y0 = y1;
    }
    // horizontal tiles when wider than the paper at this scale
    const tiles = [];
    const tw = cw / s;
    if (art.w * s > cw + 1) { for (let x = 0; x < art.w - 0.5; x += tw) tiles.push([x, Math.min(art.w, x + tw)]); }
    else tiles.push([0, art.w]);
    return { orient, paper, cw, ch, s, slices, tiles, pages: slices.length * tiles.length, fitW, tH };
  };
  const cands = (p.orient === 'auto' ? [art.prefer === 'portrait' ? 'portrait' : 'landscape', art.prefer === 'portrait' ? 'landscape' : 'portrait'] : [p.orient === 'landscape' ? 'landscape' : 'portrait']).map(solve);
  const cost = c => c.pages + Math.max(0, 0.7 - c.s) * 8 + (c.tiles.length - 1) * 0.5;
  let best = cands[0];
  for (const c of cands.slice(1)) if (cost(c) < cost(best) - 1e-9) best = c;
  return { p, item, eng: 'art', art, ...best, other: cands.find(c => c !== best) || null };
};
function artPageSVG(app, L, sl, tl, isFirst) {
  const P = app.P, s = L.s, p = L.p;
  const W = L.cw / s;
  const showTitle = p.title === 'every' || (p.title === 'first' && isFirst);
  const tH = showTitle ? TITLE_H : 0;
  const h = sl[1] - sl[0], w = tl[1] - tl[0];
  const head = showTitle ? titleBlock(P, W, { viewId: L.item.view }) : '';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}" height="${(tH + h).toFixed(1)}" viewBox="0 0 ${W.toFixed(1)} ${(tH + h).toFixed(1)}">${head}<svg x="0" y="${tH}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${tl[0].toFixed(1)} ${sl[0].toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}">${L.art.svg}</svg></svg>` };
}

/* ---------------- dokumen cetak ---------------- */
Pg.printCSS = (S0 = '') => `${S0}.pg{position:relative;box-sizing:border-box;background:#fff;color:#000;margin:18px auto;box-shadow:0 1px 4px rgba(60,64,67,.3);overflow:hidden;isolation:isolate}
${S0}.pg *{box-sizing:border-box}
${S0}.pg-in{position:relative;overflow:hidden;display:flex;flex-direction:column}
${S0}.pg-in.vc{justify-content:center}
${S0}.pg-z{transform-origin:0 0}
${S0}.pg-in.hc .pg-z{margin:0 auto}
${S0}.pg-z svg{display:block}
${S0}.pg-num{text-align:center;font:9pt Inter,Arial,Helvetica,sans-serif;color:#555}
${S0}.pg-notes{font:10px/1.45 Inter,Arial,sans-serif;color:#1f2328;width:100%}
${S0}.pg-notes h3{font:600 13px Inter,Arial,sans-serif;margin:0 0 8px}
${S0}.pg-notes .nt{border-bottom:1px solid #e5e7eb;padding:5px 0}
${S0}.pg-notes .nt b{display:block}
@media print{${S0}.pg{margin:0!important;box-shadow:none!important;break-after:page;padding:0!important;width:auto!important;height:auto!important}${S0}.pg:last-child{break-after:auto}}`;
/** {items:[{view, scope, over?}], over (all items), limit} → {css, body, total, shown, all:[{item, L}]} */
Pg.printDoc = (app, { items, over = null, scope = '', limit = Infinity }) => {
  const all = items.map(item => ({ item, L: Pg.layout(app, item, { ...(over || {}), ...(item.over || {}) }) }));
  const total = all.reduce((a, x) => a + (x.L.empty ? 0 : x.L.pages) + (x.L.p.notes && x.L.eng !== 'art' && !x.L.empty && notesOf(app, x.L).length ? 1 : 0), 0);
  const css = [Pg.printCSS(scope)], parts = [];
  let n = 0;
  all.forEach(({ L }, k) => {
    if (L.empty) return;
    const p = L.p, name = 'pg' + k;
    css.push(`@page ${name}{size:${L.paper.w}mm ${L.paper.h}mm;margin:${p.m.t * 10}mm ${p.m.r * 10}mm ${p.m.b * 10}mm ${p.m.l * 10}mm}${scope}.${name}{page:${name};width:${L.paper.W.toFixed(2)}px;height:${L.paper.H.toFixed(2)}px;padding:${(p.m.t * MPX).toFixed(2)}px ${(p.m.r * MPX).toFixed(2)}px ${(p.m.b * MPX).toFixed(2)}px ${(p.m.l * MPX).toFixed(2)}px}`);
    const wrap = (inner, num) => `<section class="pg ${name}"><div class="pg-in${p.hc ? ' hc' : ''}${p.vc ? ' vc' : ''}" style="width:${L.cw.toFixed(2)}px;height:${(L.ch - 0.5).toFixed(2)}px"><div class="pg-z" style="zoom:${L.s.toFixed(4)}">${inner}</div></div>${p.num ? `<div class="pg-num" style="height:${NUM_H}px;line-height:${NUM_H}px">${num} / ${total}</div>` : ''}</section>`;
    if (L.eng === 'art') {
      let first = true;
      for (const tl of L.tiles) for (const sl of L.slices) { if (++n > limit) return; parts.push(wrap(artPageSVG(app, L, sl, tl, first && k === 0).svg, n)); first = false; }
    } else {
      // down, then over (as Microsoft Project / Excel)
      for (const cp of L.colPages) for (const rp of L.rowPages) {
        if (++n > limit) return;
        const pg = pageSVG(app, L, rp, cp, n, total);
        parts.push(wrap(pg.svg, n));
      }
      const notes = p.notes ? notesOf(app, L) : [];
      if (notes.length && ++n <= limit) parts.push(wrap(`<div class="pg-notes" style="width:${(L.cw / L.s).toFixed(1)}px"><h3>Catatan tugas</h3>${notes.map(t => `<div class="nt"><b>${esc(t.id + ' · ' + t.name)}</b>${esc(t.notes).replace(/\n/g, '<br>')}</div>`).join('')}</div>`, n));
    }
  });
  return { css: css.join('\n'), body: parts.join(''), total, shown: Math.min(total, limit), all };
};
function notesOf(app, L) {
  if (!L.A) return [];
  return L.A.rows.filter(r => r.x && r.kind === 'task' && r.x.notes && !r.x.root).map(r => r.x);
}
// items of "Paket lengkap": views worth printing, chosen automatically from the project's content
Pg.autoBook = app => {
  const P = app.P, out = [{ view: 'gantt', on: true, why: 'jadwal semua tugas' }];
  const hasRes = P.res.length > 0, hasAsg = P.asg.length > 0, hasCost = (P.root.cost || 0) > 0, hasBl = Object.keys(P.blInfo || {}).length > 0;
  out.push({ view: 'rsheet', on: hasRes, why: hasRes ? P.res.length + ' sumber daya' : 'belum ada sumber daya' });
  out.push({ view: 'rusage', on: hasAsg && P.res.some(r => r.over), why: P.res.some(r => r.over) ? 'ada alokasi berlebih' : 'beban per periode' });
  out.push({ view: 'tusage', on: false, why: 'kerja per tugas per periode' });
  out.push({ view: 'report:overview', on: true, why: 'ringkasan proyek' });
  out.push({ view: 'report:cost', on: hasCost, why: hasCost ? 'biaya ' + U.money(P.root.cost, P) : 'belum ada biaya' });
  out.push({ view: 'report:critical', on: P.tasks.some(t => t.crit && !t.sum), why: 'tugas kritis' });
  out.push({ view: 'tracking', on: hasBl, why: hasBl ? 'garis dasar tersimpan' : 'belum ada garis dasar' });
  out.push({ view: 'network', on: false, why: 'diagram jaringan' });
  out.push({ view: 'calendar', on: false, why: 'kalender bulanan' });
  out.push({ view: 'timeline', on: P.tasks.some(t => t.tl), why: 'garis waktu' });
  return out.filter(x => (x.view.startsWith('report:') ? !!AP.Rep : V.TYPES[V.def(x.view.split(':')[0]).type]));
};
Pg.itemName = view => { const d = V.def(String(view).split(':')[0]); if (d.type === 'report') { const r = AP.Rep && AP.Rep.LIST.find(x => x.id === String(view).split(':')[1]); return 'Laporan: ' + (r ? r.t : ''); } return d.t; };
})();
