// Amatu Project — tampilan lain: Penggunaan Tugas / Sumber Daya (kerja per periode), Kalender, Diagram Jaringan,
// Garis Waktu (tampilan & panel), Papan Tugas (kanban), Perencana Tim, Grafik Sumber Daya. Setiap tampilan punya
// printArt() untuk cetak/PDF (diskalakan & dipotong rapi oleh pages.js).
(() => {
'use strict';
const AP = window.AP, U = AP.U, F = AP.F, D = AP.D, M = AP.M, S = AP.S, UI = AP.UI, V = AP.V, TS = AP.TS, G = AP.G, Pg = AP.Pg, { el, icon, esc } = U;
const FONT = 'Inter, Arial, Helvetica, sans-serif';

/* ======================= Penggunaan (Task Usage / Resource Usage) ======================= */
V.usageRows = (P, kind, o = {}) => {
  const rows = [];
  if (kind === 'res') {
    for (const r of P.res.filter(x => x.type !== 'cost')) {
      rows.push({ kind: 'res', x: r, key: 'r' + r.uid, lvl: 1 });
      for (const a of P.asgR.get(r.uid) || []) { const t = P.byUid.get(a.t); if (t && (!o.sel || o.sel.includes(t.uid))) rows.push({ kind: 'asg', x: a, a, t, r, key: 'a' + a.uid, lvl: 2, of: 'res' }); }
    }
    return rows;
  }
  const base = o.all ? (() => { const keep = new Map(P.tasks.map(t => [t.uid, t.col])); for (const t of P.tasks) t.col = false; const r = V.taskRows(P, { noFilter: true }); for (const t of P.tasks) t.col = keep.get(t.uid); return r; })() : V.taskRows(P, {});
  for (const r of base) {
    if (r.kind !== 'task' || !r.x || r.x.root) { if (r.kind === 'group') rows.push(r); continue; }
    if (o.sel && !o.sel.includes(r.x.uid)) continue;
    rows.push(r);
    if (!r.x.sum) for (const a of P.asgT.get(r.x.uid) || []) { const res = P.resByUid.get(a.r); if (res) rows.push({ kind: 'asg', x: a, a, t: r.x, r: res, key: 'a' + a.uid, lvl: (r.lvl || r.x.lvl || 1) + 1, of: 'task' }); }
  }
  return rows;
};
// cell text of an assignment row in a table
Pg.asgCell = (P, row, c) => {
  const a = row.a, r = row.r, t = row.t;
  switch (c.k) {
    case 'name': return row.of === 'res' ? t.name : r.name;
    case 'work': return r.type === 'work' ? D.fmtWork(a.work, P.opts) : r.type === 'material' ? U.num(a.units, 2) + (r.mat ? ' ' + r.mat : '') : '';
    case 'cost': return U.money(a.costV || 0, P);
    case 'start': return F.fmtDate(a.start, P);
    case 'finish': return F.fmtDate(a.finish, P);
    case 'dur': return '';
    case 'rn': return r.name;
  }
  return '';
};
Pg.usageValue = (P, row, a, b, what = 'work') => {
  if (row.kind === 'asg') return S.asgIn(P, row.a, a, b, what);
  if (row.kind === 'res') return what === 'avail' ? Math.max(0, S.capIn(P, row.x, a, b) - S.resIn(P, row.x, a, b)) : what === 'over' ? Math.max(0, S.resIn(P, row.x, a, b) - S.capIn(P, row.x, a, b)) : S.resIn(P, row.x, a, b, what);
  if (row.kind === 'task') {
    const t = row.x;
    const leaves = t.root ? P.tasks.filter(x => !x.sum) : t.sum ? M.leaves(t) : [t];
    let v = 0;
    for (const L of leaves) { for (const as of P.asgT.get(L.uid) || []) v += S.asgIn(P, as, a, b, what === 'cost' ? 'cost' : what); if (what === 'cost') v += S.fixedIn(P, L, a, b); }
    return v;
  }
  return 0;
};
Pg.fmtUsage = (P, row, v, what = 'work') => {
  if (what === 'cost') return U.money(v, P);
  if (row.kind === 'asg' && row.r && row.r.type === 'material') return U.num(Math.round(v * 100) / 100, 2);
  return U.num(Math.round(v / 60 * 10) / 10, 1) + 'j';
};
const USAGE_DETAILS = { task: [['work', 'Kerja'], ['cost', 'Biaya'], ['awork', 'Kerja Aktual']], res: [['work', 'Kerja'], ['cost', 'Biaya'], ['over', 'Alokasi Berlebih'], ['avail', 'Ketersediaan Sisa']] };
class UsageChart extends AP.Chart {
  constructor(o) { super(o); this.what = 'work'; }
  draw() {
    if (this.origin == null) this.layout();
    const P = this.P, sl = this.scroll.scrollLeft, st = this.scroll.scrollTop, cw = this.scroll.clientWidth, ch = this.scroll.clientHeight;
    const H = this.headH, rh = this.rowH;
    const cs = getComputedStyle(this.host);
    const text = cs.getPropertyValue('--text').trim() || '#1f2328', line = cs.getPropertyValue('--line').trim() || '#d0d7de', text2 = cs.getPropertyValue('--text-2').trim() || '#57606a', bad = cs.getPropertyValue('--danger').trim() || '#d93025';
    const PADX = 200, ox = Math.max(0, sl - PADX), w = cw + 2 * PADX;
    const unit = Pg.usageUnit(this.ppd);
    const top = unit === 'day' ? 'week' : unit === 'week' ? 'month' : unit === 'month' ? 'quarter' : 'year';
    const tiers = [{ u: top, n: 1 }, { u: unit, n: 1 }];
    this.headBox.style.height = H + 'px';
    this.headBox.innerHTML = `<svg style="position:absolute;left:${ox}px;top:0" width="${w}" height="${H}" viewBox="${ox} 0 ${w} ${H}">${G.scaleSVG({ P, ppd: this.ppd, origin: this.origin, x0: ox, x1: ox + w, h: H, tiers, font: '500 11px ' + FONT, color: text2, line, stick: true, vx0: sl, vx1: sl + cw })}</svg>`;
    const PADY = 8 * rh, oy = Math.max(0, st - PADY), h = Math.max(0, ch - H) + 2 * PADY;
    const i0 = Math.max(0, Math.floor(oy / rh)), i1 = Math.min(this.rows.length - 1, Math.ceil((oy + h) / rh));
    this.layer.style.left = ox + 'px'; this.layer.style.top = H + oy + 'px'; this.layer.style.width = w + 'px'; this.layer.style.height = h + 'px';
    const tA = this.T(ox), tB = this.T(ox + w);
    const ticks = TS.ticks(unit, 1, tA, tB, P, 600);
    const out = [];
    const sel = this.o.sel ? this.o.sel() : null;
    for (const tk of ticks) { const a = this.X(tk.s).toFixed(1); out.push(`<line x1="${a}" y1="${i0 * rh}" x2="${a}" y2="${(i1 + 1) * rh}" stroke="${line}" stroke-opacity=".6"/>`); }
    for (let i = i0; i <= i1; i++) {
      const r = this.rows[i];
      if (!r) continue;
      const y = i * rh;
      if (sel && sel.has(r.key)) out.push(`<rect x="${ox}" y="${y}" width="${w}" height="${rh}" fill="var(--sel-band)"/>`);
      if (r.kind !== 'asg' && r.kind !== 'group') out.push(`<rect x="${ox}" y="${y}" width="${w}" height="${rh}" fill="var(--sum-bg)" opacity=".7"/>`);
      out.push(`<line x1="${ox}" y1="${y + rh - 0.5}" x2="${ox + w}" y2="${y + rh - 0.5}" stroke="${line}" stroke-opacity=".5"/>`);
      if (!r.x || r.kind === 'group') continue;
      for (const tk of ticks) {
        const v = Pg.usageValue(P, r, tk.s, tk.e, this.what);
        if (!v || Math.abs(v) < 0.05) continue;
        const a = this.X(tk.s), b = this.X(tk.e);
        let over = false;
        if (this.what === 'work' && (r.kind === 'res' || (r.kind === 'asg' && r.r && r.r.over))) { const res = r.kind === 'res' ? r.x : r.r; over = res.type === 'work' && S.resIn(P, res, tk.s, tk.e) > S.capIn(P, res, tk.s, tk.e) + 1; }
        const txt = U.fit(Pg.fmtUsage(P, r, v, this.what), '11px ' + FONT, b - a - 6);
        if (over && r.kind === 'res') out.push(`<rect x="${(a + 1).toFixed(1)}" y="${y + 2}" width="${(b - a - 2).toFixed(1)}" height="${rh - 4}" rx="3" fill="${bad}" opacity=".12"/>`);
        out.push(`<text x="${(b - 5).toFixed(1)}" y="${y + rh / 2 + 4}" text-anchor="end" style="font:${r.kind === 'asg' ? '' : '600 '}11px ${FONT}" fill="${over ? bad : text}">${esc(txt)}</text>`);
      }
    }
    this.layer.innerHTML = `<svg width="${w}" height="${h}" viewBox="${ox} ${oy} ${w} ${h}">${out.join('')}</svg>`;
    this.geo = new Map(); this.links = [];
  }
  hitBar(p) { const i = Math.floor(p.y / this.rowH); return { i, r: this.rows[i] }; }
  onHover() { }
  onDown(e) { if (e.button !== 0) return; const p = this.pos(e); if (p.y < 0) return; const i = Math.floor(p.y / this.rowH); if (i >= 0 && i < this.rows.length) this.o.onSelectRow && this.o.onSelectRow(i, false, e); if (e.pointerType !== 'touch') this.pan(e); }
}
class UsageView extends V.SplitView {
  mount(host) {
    this.host = host;
    const P = this.P, kind = this.def.kind;
    this.wrap = el('div.vsplit');
    this.left = el('div.pane.pane-l');
    this.right = el('div.pane.pane-r');
    this.bar = el('div.vbar', { role: 'separator' });
    this.wrap.append(this.left, this.bar, this.right);
    host.append(this.wrap);
    this.grid = new AP.Grid({
      app: this.app, host: this.left, kind, label: this.def.t, rowH: () => this.app.rowH(), headH: () => 42,
      idText: r => (r.kind === 'asg' || r.kind === 'group' ? '' : r.x && r.x.id != null ? r.x.id : ''),
      rowClass: r => (r.kind === 'asg' ? 'asg' : V.rowClass(r)),
      cell: (r, c) => (r.kind === 'asg' ? `<span class="${c.k === 'name' ? 'gname' : ''}" style="${c.k === 'name' ? 'padding-left:' + ((r.lvl - 1) * 16 + 18) + 'px' : ''}"><span class="gnt">${esc(c.k === 'name' ? (kind === 'res' ? r.t.name : r.r.name) : Pg.asgCell(P, r, c))}</span></span>` : r.kind === 'group' ? (c.k === 'name' ? esc(r.label) : '') : null),
      onScroll: y => this.chart.setScrollTop(y), onSel: () => { this.chart.paint(); this.app.onSel(); },
      onCommit: (r, k, v) => this.app.commitCell(kind, r, k, v),
      onDbl: r => { if (r.kind === 'asg') AP.Dlg.asgInfo(r.a); else if (r.x && !r.x.root) this.app.cmd(kind === 'res' ? 'resInfo' : 'taskInfo', r.x); },
      onAsgEdit: r => AP.Dlg.asgInfo(r.a),
      onCtx: (e, r, c) => this.app.rowMenu(e, kind, r, c),
      onHeadCtx: (e, c) => this.app.headMenu(e, kind, this, c),
      onColsChange: cols => { F.saveCols(this.app.P, kind, this.table, cols); this.app.viewChanged(); },
      onToggle: r => this.app.cmd('toggleRow', r.x),
      canEdit: r => r.kind !== 'group' && !this.app.readOnly,
    });
    this.chart = new UsageChart({
      app: this.app, host: this.right, ppd: V.vs(P).zoom[this.id] || 9, rowH: () => this.app.rowH(), headH: () => 42, sel: () => this.grid.selKeys,
      onScroll: y => this.grid.setScrollTop(y),
      onSelectRow: (i, keep, e) => { this.grid.selectIdx(i, e && e.shiftKey, e && (e.ctrlKey || e.metaKey)); this.grid.focus(); },
      onHeadCtx: e => this.app.scaleMenu(e, this),
      onZoom: ppd => { V.vs(this.app.P).zoom[this.id] = ppd; this.app.viewChangedSoon(); this.app.updateZoomUI(); },
    });
    // detail picker (Kerja / Biaya / ...)
    const pick = UI.select(USAGE_DETAILS[kind], 'work', v => { this.chart.what = v; this.chart.draw(); });
    pick.classList.add('sm', 'usage-pick');
    this.right.append(el('div.usage-tools', el('span', 'Rincian:'), pick));
    this.render(true);
    this.initSplit();
    requestAnimationFrame(() => this.scrollToStart());
  }
  rowsNow() { return V.usageRows(this.P, this.def.kind, {}); }
  selectedTasks() { return this.def.kind === 'task' ? this.grid.selected().filter(r => r.kind === 'task' && r.x && !r.x.root).map(r => r.x) : []; }
  selectedRes() { return this.def.kind === 'res' ? this.grid.selected().filter(r => r.kind === 'res').map(r => r.x) : []; }
}
V.TYPES.usage = UsageView;
// Informasi Penugasan
AP.Dlg = AP.Dlg || {};
AP.Dlg.asgInfo = a0 => {
  const app = AP.app, P = app.P;
  const a = P.asg.find(x => x.uid === a0.uid);
  if (!a) return;
  const t = P.byUid.get(a.t), r = P.resByUid.get(a.r);
  const units = el('input.inp', { value: r.type === 'work' ? U.num(a.units * 100, 1) + '%' : U.num(a.units, 2) });
  const work = el('input.inp', { value: r.type === 'work' ? D.fmtWork(a.work, P.opts) : '', disabled: r.type !== 'work' });
  const delay = el('input.inp', { value: D.fmtDur(a.delay || 0, 'd', P.opts, true) });
  let contour = a.contour || 'flat';
  const cost = el('input.inp', { value: r.type === 'cost' ? U.money(a.cost || 0, P) : '', disabled: r.type !== 'cost' });
  UI.dialog({ title: 'Informasi Penugasan', width: '520px', body: el('div', el('p', el('b', t.name), ' — ', r.name),
    el('div.fgrid', UI.field(r.type === 'work' ? 'Unit' : 'Jumlah', units), UI.field('Kerja', work), UI.field('Biaya (sumber daya biaya)', cost)),
    el('div.fgrid', UI.field('Kontur kerja', UI.select(Object.entries(S.CONTOUR_L), contour, v => { contour = v; })), UI.field('Penundaan penugasan', delay)),
    el('p.hint', 'Mulai ' + F.fmtDate(a.start, P) + ' · Selesai ' + F.fmtDate(a.finish, P) + ' · Biaya ' + U.money(a.costV || 0, P))),
    buttons: [{ label: 'Hapus Penugasan', left: true, danger: true, run: () => { app.tx('Hapus penugasan', P2 => { M.unassign(P2, P2.byUid.get(t.uid), P2.resByUid.get(r.uid)); }); } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      app.tx('Ubah penugasan', P2 => {
        const x = P2.asg.find(q => q.uid === a.uid), tt = P2.byUid.get(t.uid);
        const v = U.parseNum(String(units.value).replace('%', ''));
        if (r.type === 'work' && isFinite(v)) M.setUnits(P2, tt, x, v / 100);
        else if (r.type === 'material' && isFinite(v)) { x.units = v; x.work = v; }
        if (r.type === 'work' && work.value.trim()) { const w = D.parseWork(work.value, P2.opts); if (w != null && Math.abs(w - x.work) > 0.5) { x.work = w; if (tt.type !== 'FD') { const ws = M.workRes(P2, tt); tt.dur = Math.round(Math.max(...ws.map(q => (q.units > 0 ? q.work / q.units : 0)), 0)); } } }
        if (r.type === 'cost') { const c = U.parseNum(cost.value); if (isFinite(c)) x.cost = c; }
        x.contour = contour;
        const dl = D.parseDur(delay.value, P2.opts, 'd'); x.delay = dl ? (dl.el ? dl.v : Math.round(dl.v / (P2.opts.hpd * 60)) * 1440) : 0;
      });
    } }] });
};

/* ======================= Kalender ======================= */
class CalendarView {
  constructor(app, id) { this.app = app; this.id = id; this.sel = null; }
  get P() { return this.app.P; }
  mount(host) {
    this.host = host;
    const now = U.ymd(this.sel ? this.sel.start : U.today() >= this.P.root.start && U.today() <= this.P.root.finish ? U.today() : this.P.root.start);
    this.m = { y: now.y, m: now.m };
    this.wrap = el('div.vwrap.calv');
    host.append(this.wrap);
    this.render();
  }
  unmount() { this.wrap.remove(); }
  focus() { }
  selectedTasks() { return this.sel ? [this.sel] : []; }
  focusTask() { return this.sel; }
  selectUids(u) { const t = this.P.byUid.get(u[0]); if (t) { this.sel = t; const a = U.ymd(t.start); this.m = { y: a.y, m: a.m }; this.render(); return true; } return false; }
  scrollToTask(t) { this.selectUids([t.uid]); }
  zoom(d) { this.weeks = U.clamp((this.weeks || 0) + (d < 0 ? 1 : -1), 0, 0); }
  render() {
    const P = this.P, app = this.app;
    const tools = el('div.vtool',
      el('button.icon-btn.sm', { type: 'button', 'aria-label': 'Bulan sebelumnya', onclick: () => { this.m = shiftM(this.m, -1); this.render(); } }, icon('chevron_left')),
      el('button.btn.sm', { type: 'button', onclick: () => { const a = U.ymd(U.today()); this.m = { y: a.y, m: a.m }; this.render(); } }, 'Hari ini'),
      el('button.icon-btn.sm', { type: 'button', 'aria-label': 'Bulan berikutnya', onclick: () => { this.m = shiftM(this.m, 1); this.render(); } }, icon('chevron_right')),
      el('b', U.MON_L[this.m.m] + ' ' + this.m.y),
      el('span.sp'),
      el('button.btn.sm', { type: 'button', onclick: () => { const a = U.ymd(P.root.start); this.m = { y: a.y, m: a.m }; this.render(); } }, icon('first_page'), 'Awal proyek'),
      el('button.btn.sm', { type: 'button', onclick: () => { const a = U.ymd(P.root.finish); this.m = { y: a.y, m: a.m }; this.render(); } }, icon('last_page'), 'Akhir proyek'));
    const svgBox = el('div.cal-body');
    svgBox.innerHTML = CalendarView.monthSVG(P, this.m.y, this.m.m, Math.max(600, (this.host.clientWidth || 1000) - 24), this.sel ? this.sel.uid : null, true);
    svgBox.addEventListener('click', e => { const g = e.target.closest('[data-uid]'); if (g) { this.sel = P.byUid.get(+g.dataset.uid); app.onSel(); this.render(); } });
    svgBox.addEventListener('dblclick', e => { const g = e.target.closest('[data-uid]'); if (g) app.cmd('taskInfo', P.byUid.get(+g.dataset.uid)); });
    svgBox.addEventListener('contextmenu', e => { const g = e.target.closest('[data-uid]'); if (!g) return; e.preventDefault(); this.sel = P.byUid.get(+g.dataset.uid); app.barMenu(e, this.sel, true); });
    this.wrap.replaceChildren(tools, svgBox);
  }
}
const shiftM = (m, d) => { const a = U.ymd(U.mk(m.y, m.m + d, 1)); return { y: a.y, m: a.m }; };
CalendarView.monthSVG = (P, y, m, W, selUid, live) => {
  const ws = P.opts.weekStart;
  const first = U.mk(y, m, 1), last = U.mk(y, m + 1, 1);
  const off = ((U.ymd(first).dow - ws) + 7) % 7;
  const start = first - off * 1440;
  const weeks = Math.ceil((off + (last - first) / 1440) / 7);
  const cw = W / 7, headH = 26, dayH = 20, barH = 17, lanesMax = 5;
  const tasks = V.taskRows(P, {}).filter(r => r.kind === 'task' && r.x && !r.x.sum && !r.x.root && !r.x.inact).map(r => r.x);
  const out = [], C = P._ctx, pal = G.bars(P);
  let y0 = headH;
  for (let i = 0; i < 7; i++) out.push(`<text x="${i * cw + cw / 2}" y="17" text-anchor="middle" style="font:600 11px ${FONT}" fill="#5b6470">${U.DOW_L[(ws + i) % 7]}</text>`);
  const rowsH = [];
  for (let w = 0; w < weeks; w++) {
    const ws0 = start + w * 7 * 1440, we = ws0 + 7 * 1440;
    const items = tasks.filter(t => t.start < we && (t.finish > ws0 || (t.finish === t.start && t.start >= ws0))).sort((a, b) => a.start - b.start || (b.finish - b.start) - (a.finish - a.start));
    const lanes = [];
    const placed = [];
    for (const t of items) {
      const a = Math.max(0, Math.floor((U.dayStart(t.start) - ws0) / 1440)), b = Math.min(6, Math.floor((Math.max(t.start, t.finish - 1) - ws0) / 1440));
      let L = 0; while (lanes[L] != null && lanes[L] >= a) L++;
      lanes[L] = b;
      placed.push({ t, a, b, L });
    }
    const nL = Math.min(lanesMax, lanes.length);
    const h = Math.max(92, dayH + nL * (barH + 3) + (lanes.length > lanesMax ? 16 : 6));
    rowsH.push(h);
    for (let d = 0; d < 7; d++) {
      const di = ws0 / 1440 + d, a = U.ymd(di * 1440), x = d * cw;
      const off2 = C.dayWork(P.calendar, di) === 0, out2 = a.m !== m;
      out.push(`<rect x="${x}" y="${y0}" width="${cw}" height="${h}" fill="${out2 ? '#f6f7f9' : off2 ? '#fafbfc' : '#fff'}" stroke="#dde2e8"/>`);
      const today = di === Math.floor(U.today() / 1440);
      out.push(`<text x="${x + 6}" y="${y0 + 14}" style="font:${today ? '700' : '500'} 11px ${FONT}" fill="${today ? '#0f7a55' : out2 ? '#9aa3ad' : '#374151'}">${a.d === 1 ? a.d + ' ' + U.MON_S[a.m] : a.d}</text>`);
    }
    const more = new Array(7).fill(0);
    for (const p of placed) {
      if (p.L >= lanesMax) { for (let d = p.a; d <= p.b; d++) more[d]++; continue; }
      const t = p.t, x = p.a * cw + 2, w2 = (p.b - p.a + 1) * cw - 4, yy = y0 + dayH + p.L * (barH + 3);
      const ms = F.isMs(t);
      const fill = ms ? '#fff' : t.crit ? pal.crit.fill : t.color || pal.task.fill;
      const sel = selUid === t.uid;
      out.push(`<g data-uid="${t.uid}" style="cursor:pointer">` + (ms ? `<path d="M${x + 8} ${yy + 2}l6 6.5-6 6.5-6-6.5z" fill="${t.crit ? pal.msCrit.fill : pal.ms.fill}"/><text x="${x + 18}" y="${yy + 12.5}" style="font:600 10.5px ${FONT}" fill="#1f2328">${esc(U.fit(t.name, '600 10.5px ' + FONT, w2 - 20))}</text>`
        : `<rect x="${x}" y="${yy}" width="${w2}" height="${barH}" rx="4" fill="${fill}"${sel ? ' stroke="#111" stroke-width="2"' : ''}/>${t.pct ? `<rect x="${x}" y="${yy + barH - 3}" width="${w2 * t.pct / 100}" height="3" fill="rgba(0,0,0,.35)"/>` : ''}<text x="${x + 6}" y="${yy + 12.3}" style="font:500 10.5px ${FONT}" fill="#fff">${esc(U.fit((t.start < ws0 ? '◀ ' : '') + t.name + (t.finish > we ? ' ▶' : ''), '500 10.5px ' + FONT, w2 - 10))}</text>`) + '</g>');
    }
    more.forEach((n, d) => { if (n) out.push(`<text x="${d * cw + cw - 6}" y="${y0 + h - 5}" text-anchor="end" style="font:600 10px ${FONT}" fill="#5b6470">+${n} lagi</text>`); });
    y0 += h;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y0 + 2}" viewBox="0 0 ${W} ${y0 + 2}"${live ? ' class="cal-svg"' : ''}>${out.join('')}</svg>`;
};
CalendarView.printArt = (app, id, p) => {
  const P = app.P, W = 1000;
  const a = U.ymd(P.root.start), b = U.ymd(P.root.finish);
  const parts = [], breaks = [];
  let y = 0;
  for (let k = 0, m = { y: a.y, m: a.m }; k < 36 && (m.y < b.y || (m.y === b.y && m.m <= b.m)); k++, m = shiftM(m, 1)) {
    const svg = CalendarView.monthSVG(P, m.y, m.m, W, null, false);
    const h = +/height="([\d.]+)"/.exec(svg)[1];
    parts.push(`<text x="0" y="${y + 22}" style="font:700 16px ${FONT}" fill="#111827">${U.MON_L[m.m]} ${m.y}</text><g transform="translate(0,${y + 32})">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`);
    y += h + 50;
    breaks.push(y - 10);
  }
  return { w: W, h: y, svg: parts.join(''), breaks, prefer: 'landscape', maxScale: 1 };
};
V.TYPES.calendar = CalendarView;

/* ======================= Diagram Jaringan ======================= */
const NB = { w: 178, h: 70, gx: 46, gy: 22 };
function netLayout(P) {
  const rows = V.taskRows(P, {}).filter(r => r.kind === 'task' && r.x && !r.x.root && !r.x.inact);
  const tasks = rows.map(r => r.x).filter(t => !t.sum);
  const set = new Set(tasks.map(t => t.uid));
  const rank = new Map();
  const E = AP.S.engine(P);
  // longest path rank following effective links (summary links reach their subtasks)
  const order = tasks.slice().sort((a, b) => a.start - b.start || a.id - b.id);
  for (const t of order) {
    let r = 0;
    for (const { p } of E.effPreds(t)) { const ls = p.sum ? M.leaves(p) : [p]; for (const q of ls) if (set.has(q.uid) && rank.has(q.uid)) r = Math.max(r, rank.get(q.uid) + 1); }
    rank.set(t.uid, r);
  }
  const cols = new Map();
  for (const t of tasks) { const r = rank.get(t.uid) || 0; if (!cols.has(r)) cols.set(r, []); cols.get(r).push(t); }
  const pos = new Map();
  let maxY = 0;
  for (const [r, list] of cols) { list.sort((a, b) => a.id - b.id); list.forEach((t, i) => { pos.set(t.uid, { x: 20 + r * (NB.w + NB.gx), y: 20 + i * (NB.h + NB.gy), t }); maxY = Math.max(maxY, 20 + i * (NB.h + NB.gy) + NB.h); }); }
  const W = 40 + (cols.size || 1) * (NB.w + NB.gx);
  return { pos, W, H: maxY + 20, tasks, E };
}
function netSVG(P, L, selUid) {
  const out = [], pal = G.bars(P);
  // links
  for (const t of L.tasks) {
    const b = L.pos.get(t.uid);
    for (const { p } of L.E.effPreds(t)) {
      for (const q of p.sum ? M.leaves(p) : [p]) {
        const a = L.pos.get(q.uid);
        if (!a) continue;
        const crit = q.crit && t.crit;
        const x1 = a.x + NB.w, y1 = a.y + NB.h / 2, x2 = b.x, y2 = b.y + NB.h / 2, mx = x1 + NB.gx / 2;
        out.push(`<path d="M${x1} ${y1}H${mx}V${y2}H${x2 - 1}" fill="none" stroke="${crit ? pal.linkCrit : '#7b8794'}" stroke-width="1.2"/><path d="M${x2} ${y2}l-6 -4v8z" fill="${crit ? pal.linkCrit : '#7b8794'}"/>`);
      }
    }
  }
  for (const { x, y, t } of L.pos.values()) {
    const crit = t.crit, ms = F.isMs(t), sel = selUid === t.uid;
    const stroke = sel ? '#1f2328' : crit ? pal.crit.fill : pal.task.fill;
    const bg = t.pct >= 100 ? '#eef7f1' : t.pct > 0 ? '#f2f7fd' : '#ffffff';
    out.push(`<g data-uid="${t.uid}" style="cursor:pointer"><rect x="${x}" y="${y}" width="${NB.w}" height="${NB.h}" rx="${ms ? 14 : 6}" fill="${bg}" stroke="${stroke}" stroke-width="${sel ? 2.5 : 1.6}"/>`);
    if (t.pct >= 100) out.push(`<path d="M${x} ${y + NB.h}L${x + NB.w} ${y}" stroke="${stroke}" stroke-opacity=".25"/>`);
    else if (t.pct > 0) out.push(`<path d="M${x} ${y + NB.h}L${x + NB.w / 2} ${y + NB.h / 2}" stroke="${stroke}" stroke-opacity=".3"/>`);
    out.push(`<text x="${x + 8}" y="${y + 16}" style="font:600 11px ${FONT}" fill="#111827">${esc(U.fit(t.name, '600 11px ' + FONT, NB.w - 16))}</text>`);
    const l1 = 'ID ' + t.id + (ms ? ' · Tonggak' : ' · ' + D.fmtDur(t.dur, t.durU, P.opts, t.el)), l2 = 'Mulai ' + U.fmtDate(t.start, 'dd/mm/yy'), l3 = 'Selesai ' + U.fmtDate(t.finish, 'dd/mm/yy'), l4 = D.fmtRes(t, P);
    out.push(`<text x="${x + 8}" y="${y + 31}" style="font:10px ${FONT}" fill="#4b5563">${esc(l1)}</text><text x="${x + 8}" y="${y + 44}" style="font:10px ${FONT}" fill="#4b5563">${esc(l2)}</text><text x="${x + NB.w / 2 + 4}" y="${y + 44}" style="font:10px ${FONT}" fill="#4b5563">${esc(l3.replace('Selesai ', 'Sls '))}</text><text x="${x + 8}" y="${y + 58}" style="font:10px ${FONT}" fill="#6b7280">${esc(U.fit(l4 || '—', '10px ' + FONT, NB.w - 16))}</text></g>`);
  }
  return out.join('');
}
class NetworkView {
  constructor(app, id) { this.app = app; this.id = id; this.z = 1; this.sel = null; }
  get P() { return this.app.P; }
  mount(host) {
    this.host = host;
    this.wrap = el('div.vwrap.netv');
    this.tools = el('div.vtool', el('b', 'Diagram Jaringan'), el('span.hint', 'Kotak merah = jalur kritis · klik ganda untuk informasi tugas'), el('span.sp'),
      el('button.icon-btn.sm', { type: 'button', 'data-tip': 'Perkecil', onclick: () => this.zoom(-1) }, icon('zoom_out')), el('button.icon-btn.sm', { type: 'button', 'data-tip': 'Perbesar', onclick: () => this.zoom(1) }, icon('zoom_in')), el('button.btn.sm', { type: 'button', onclick: () => this.fit() }, icon('fit_screen'), 'Pas layar'));
    this.box = el('div.net-box');
    this.wrap.append(this.tools, this.box);
    host.append(this.wrap);
    this.box.addEventListener('click', e => { const g = e.target.closest('[data-uid]'); if (g) { this.sel = this.P.byUid.get(+g.dataset.uid); this.app.onSel(); this.render(); } });
    this.box.addEventListener('dblclick', e => { const g = e.target.closest('[data-uid]'); if (g) this.app.cmd('taskInfo', this.P.byUid.get(+g.dataset.uid)); });
    this.box.addEventListener('contextmenu', e => { const g = e.target.closest('[data-uid]'); if (!g) return; e.preventDefault(); this.sel = this.P.byUid.get(+g.dataset.uid); this.app.barMenu(e, this.sel, true); });
    this.wrap.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); this.zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    this.render();
  }
  unmount() { this.wrap.remove(); }
  focus() { }
  selectedTasks() { return this.sel ? [this.sel] : []; }
  focusTask() { return this.sel; }
  selectUids(u) { const t = this.P.byUid.get(u[0]); if (t) { this.sel = t; this.render(); return true; } return false; }
  scrollToTask(t) { this.selectUids([t.uid]); const p = this.L && this.L.pos.get(t.uid); if (p) { this.wrap.scrollLeft = p.x * this.z - 100; this.wrap.scrollTop = p.y * this.z - 100; } }
  zoom(d) { this.z = U.clamp(this.z * (d > 0 ? 1.2 : 1 / 1.2), 0.25, 2.5); this.render(); }
  fit() { const L = this.L; if (!L) return; this.z = U.clamp(Math.min((this.wrap.clientWidth - 20) / L.W, (this.wrap.clientHeight - 60) / L.H), 0.2, 1.4); this.render(); }
  render() {
    const P = this.P;
    this.L = netLayout(P);
    const L = this.L;
    if (!L.tasks.length) { this.box.innerHTML = '<div class="empty-v"><span class="ms">account_tree</span>Belum ada tugas</div>'; return; }
    this.box.innerHTML = `<svg width="${L.W * this.z}" height="${L.H * this.z}" viewBox="0 0 ${L.W} ${L.H}">${netSVG(P, L, this.sel && this.sel.uid)}</svg>`;
  }
}
NetworkView.printArt = app => { const P = app.P, L = netLayout(P); return L.tasks.length ? { w: L.W, h: L.H, svg: netSVG(P, L, null), breaks: [], prefer: 'landscape', maxScale: 1 } : null; };
V.TYPES.network = NetworkView;

/* ======================= Garis Waktu ======================= */
function timelineSVG(P, W, H, selUid) {
  const R = P.root;
  const a = R.start, b = Math.max(R.finish, a + 1440);
  const pad = 24, x0 = pad, x1 = W - pad;
  const X = t => x0 + (t - a) / (b - a) * (x1 - x0);
  const out = [];
  const midY = Math.round(H * 0.5), barY = midY - 14, pal = G.bars(P);
  // axis with months
  out.push(`<rect x="${x0}" y="${barY}" width="${x1 - x0}" height="28" rx="6" fill="#eef3f8" stroke="#cdd6e0"/>`);
  const days = (b - a) / 1440, unit = days > 700 ? 'quarter' : days > 120 ? 'month' : days > 35 ? 'week' : 'day';
  for (const tk of TS.ticks(unit, 1, a, b, P, 200)) { const x = X(Math.max(tk.s, a)); if (tk.s > a) out.push(`<line x1="${x}" y1="${barY + 4}" x2="${x}" y2="${barY + 24}" stroke="#cdd6e0"/>`); const lab = TS.labels(unit, tk.s, tk.e, P, 'bot')[unit === 'day' ? 4 : unit === 'week' ? 1 : 1]; const xm = (X(Math.max(tk.s, a)) + X(Math.min(tk.e, b))) / 2; if (X(Math.min(tk.e, b)) - X(Math.max(tk.s, a)) > U.measure(lab, '10px ' + FONT) + 6) out.push(`<text x="${xm}" y="${barY + 18}" text-anchor="middle" style="font:10px ${FONT}" fill="#5b6470">${esc(lab)}</text>`); }
  out.push(`<text x="${x0}" y="${barY - 6}" style="font:600 10px ${FONT}" fill="#374151">Mulai ${U.fmtDate(a, 'dd mmm yyyy')}</text><text x="${x1}" y="${barY - 6}" text-anchor="end" style="font:600 10px ${FONT}" fill="#374151">Selesai ${U.fmtDate(b, 'dd mmm yyyy')}</text>`);
  // tasks on the timeline (bars on the axis band), milestones as callouts below
  let list = P.tasks.filter(t => t.tl && !t.inact);
  if (!list.length) list = P.tasks.filter(t => (t.lvl === 1 && t.sum) || F.isMs(t)).slice(0, 14);
  const bars = list.filter(t => !F.isMs(t)), mss = list.filter(t => F.isMs(t));
  const colors = ['#4a8fd9', '#1f9d6b', '#fb8c00', '#8e44ad', '#00897b', '#e65a3f', '#5e35b1', '#c2185b'];
  const lanes = [];
  bars.forEach((t, i) => {
    let L = 0; while (lanes[L] != null && lanes[L] > t.start) L++; lanes[L] = t.finish;
    const yy = barY - 16 - 22 - L * 22;
    const xa = X(t.start), xb = Math.max(X(t.finish), xa + 3);
    const c = t.color || colors[i % colors.length];
    out.push(`<g data-uid="${t.uid}" style="cursor:pointer"><rect x="${xa}" y="${yy}" width="${xb - xa}" height="18" rx="4" fill="${c}"${selUid === t.uid ? ' stroke="#111" stroke-width="2"' : ''}/><text x="${xa + 5}" y="${yy + 12.5}" style="font:600 10px ${FONT}" fill="#fff">${esc(U.fit(t.name, '600 10px ' + FONT, xb - xa - 8))}</text></g>`);
  });
  mss.forEach((t, i) => {
    const x = X(t.start), yy = barY + 34 + (i % 3) * 16;
    out.push(`<g data-uid="${t.uid}" style="cursor:pointer"><line x1="${x}" y1="${barY + 28}" x2="${x}" y2="${yy - 5}" stroke="#9aa3ad"/><path d="M${x} ${barY + 6}l7 7-7 7-7-7z" fill="${t.crit ? pal.msCrit.fill : pal.ms.fill}"/><text x="${x + 4}" y="${yy + 6}" style="font:600 10px ${FONT}" fill="#1f2328">${esc(U.fit(t.name + ' · ' + U.fmtDate(t.start, 'dd/mm'), '600 10px ' + FONT, 220))}</text></g>`);
  });
  // today
  const now = U.now();
  if (now > a && now < b) out.push(`<line x1="${X(now)}" y1="${barY - 4}" x2="${X(now)}" y2="${barY + 32}" stroke="#f08c00" stroke-width="2"/><text x="${X(now)}" y="${barY + 44}" text-anchor="middle" style="font:600 9.5px ${FONT}" fill="#c76f00">Hari ini</text>`);
  return out.join('');
}
class TimelineView {
  constructor(app, pane) { this.app = app; this.pane = pane === true; this.id = 'timeline'; this.sel = null; }
  get P() { return this.app.P; }
  mount(host) {
    this.host = host;
    this.wrap = el('div' + (this.pane ? '.tl-pane' : '.vwrap.tlv'));
    if (!this.pane) this.wrap.append(el('div.vtool', el('b', 'Garis Waktu'), el('span.hint', 'Tugas dengan "Tampilkan di Garis Waktu" (klik kanan › Tambahkan ke Garis Waktu). Tanpa pilihan, tampil fase utama & tonggak.')));
    this.box = el('div.tl-box');
    this.wrap.append(this.box);
    host.append(this.wrap);
    this.box.addEventListener('click', e => { const g = e.target.closest('[data-uid]'); if (!g) return; const t = this.P.byUid.get(+g.dataset.uid); if (this.pane) { this.app.reselect([t.uid]); if (this.app.view.scrollToTask) this.app.view.scrollToTask(t); } else { this.sel = t; this.app.onSel(); this.render(); } });
    this.box.addEventListener('dblclick', e => { const g = e.target.closest('[data-uid]'); if (g) this.app.cmd('taskInfo', this.P.byUid.get(+g.dataset.uid)); });
    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(this.box);
    this.render();
  }
  unmount() { if (this.ro) this.ro.disconnect(); this.wrap.remove(); }
  focus() { }
  selectedTasks() { return this.sel ? [this.sel] : []; }
  focusTask() { return this.sel; }
  render() {
    const W = Math.max(400, this.box.clientWidth || 900), H = this.pane ? 90 : Math.max(260, this.box.clientHeight || 300);
    this.box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${timelineSVG(this.P, W, H, this.sel && this.sel.uid)}</svg>`;
  }
}
TimelineView.printArt = app => ({ w: 1100, h: 300, svg: timelineSVG(app.P, 1100, 300, null), breaks: [], prefer: 'landscape', maxScale: 1.2 });
AP.Timeline = TimelineView;
V.TYPES.timeline = class extends TimelineView { constructor(app) { super(app, false); } };
V.TYPES.timeline.printArt = TimelineView.printArt;

/* ======================= Papan Tugas ======================= */
class BoardView {
  constructor(app, id) { this.app = app; this.id = id; this.sel = null; }
  get P() { return this.app.P; }
  mount(host) { this.host = host; this.wrap = el('div.vwrap.boardv'); host.append(this.wrap); this.render(); }
  unmount() { this.wrap.remove(); }
  focus() { }
  selectedTasks() { return this.sel ? [this.sel] : []; }
  focusTask() { return this.sel; }
  selectUids(u) { const t = this.P.byUid.get(u[0]); if (t) { this.sel = t; this.render(); return true; } return false; }
  render() {
    const P = this.P, app = this.app;
    const tasks = V.taskRows(P, {}).filter(r => r.kind === 'task' && r.x && !r.x.sum && !r.x.root && !r.x.inact).map(r => r.x);
    const cols = F.BOARD.map(([k, n]) => ({ k, n, list: tasks.filter(t => F.boardOf(t) === k) }));
    const board = el('div.board');
    for (const c of cols) {
      const col = el('div.bcol', { 'data-k': c.k }, el('div.bcol-h', el('b', c.n), el('span', String(c.list.length))));
      const body = el('div.bcol-b');
      for (const t of c.list) {
        const card = el('div.bcard' + (this.sel === t ? '.on' : '') + (t.crit ? '.crit' : ''), { draggable: true, 'data-uid': t.uid },
          el('div.bc-t', t.name || '(tanpa nama)'),
          el('div.bc-m', el('span', 'ID ' + t.id), el('span', U.fmtDate(t.start, 'dd mmm') + ' – ' + U.fmtDate(t.finish, 'dd mmm'))),
          D.fmtRes(t, P) ? el('div.bc-r', icon('person'), D.fmtRes(t, P)) : null,
          el('div.bc-p', el('i', { style: { width: t.pct + '%' } })));
        card.addEventListener('click', () => { this.sel = t; app.onSel(); this.render(); });
        card.addEventListener('dblclick', () => app.cmd('taskInfo', t));
        card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(t.uid)); card.classList.add('drag'); });
        card.addEventListener('dragend', () => card.classList.remove('drag'));
        body.append(card);
      }
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', () => col.classList.remove('over'));
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const uid = +e.dataTransfer.getData('text/plain'); app.tx('Status papan', P2 => { const x = P2.byUid.get(uid); if (x) F.setBoard(P2, x, c.k); }); });
      col.append(body);
      board.append(col);
    }
    this.wrap.replaceChildren(el('div.vtool', el('b', 'Papan Tugas'), el('span.hint', 'Seret kartu antar kolom: Sedang Dikerjakan = 50%, Selesai = 100% (bisa diubah lewat % Selesai)')), board);
  }
}
BoardView.printArt = app => {
  const P = app.P;
  const tasks = V.taskRows(P, {}).filter(r => r.kind === 'task' && r.x && !r.x.sum && !r.x.root && !r.x.inact).map(r => r.x);
  const W = 1040, cw = W / 4, ch = 64, gap = 8;
  const out = [];
  let maxH = 0;
  F.BOARD.forEach(([k, n], i) => {
    const list = tasks.filter(t => F.boardOf(t) === k);
    const x = i * cw;
    out.push(`<rect x="${x + 4}" y="0" width="${cw - 8}" height="30" rx="6" fill="#eef1f5"/><text x="${x + 14}" y="20" style="font:700 12px ${FONT}" fill="#111827">${esc(n)} (${list.length})</text>`);
    list.forEach((t, j) => {
      const y = 38 + j * (ch + gap);
      out.push(`<rect x="${x + 6}" y="${y}" width="${cw - 12}" height="${ch}" rx="6" fill="#fff" stroke="${t.crit ? '#e2574c' : '#cfd5dc'}"/><text x="${x + 14}" y="${y + 17}" style="font:600 11px ${FONT}" fill="#111827">${esc(U.fit(t.name, '600 11px ' + FONT, cw - 30))}</text><text x="${x + 14}" y="${y + 33}" style="font:10px ${FONT}" fill="#4b5563">${esc('ID ' + t.id + ' · ' + U.fmtDate(t.start, 'dd/mm') + '–' + U.fmtDate(t.finish, 'dd/mm/yy'))}</text><text x="${x + 14}" y="${y + 48}" style="font:10px ${FONT}" fill="#6b7280">${esc(U.fit(D.fmtRes(t, P) || '—', '10px ' + FONT, cw - 30))}</text><rect x="${x + 14}" y="${y + 54}" width="${cw - 28}" height="4" rx="2" fill="#eef1f5"/><rect x="${x + 14}" y="${y + 54}" width="${(cw - 28) * t.pct / 100}" height="4" rx="2" fill="#0f7a55"/>`);
      maxH = Math.max(maxH, y + ch + gap);
    });
  });
  const breaks = [];
  for (let y = 38; y < maxH; y += ch + gap) breaks.push(y - gap / 2);
  return { w: W, h: Math.max(80, maxH), svg: out.join(''), breaks, prefer: 'landscape', maxScale: 1 };
};
V.TYPES.board = BoardView;

/* ======================= Perencana Tim ======================= */
class TeamChart extends AP.Chart {
  setRes(rows) { this.rows = rows; this.rowIdx = new Map(); }
  draw() {
    if (this.origin == null) this.layout();
    const P = this.P, sl = this.scroll.scrollLeft, st = this.scroll.scrollTop, cw = this.scroll.clientWidth, ch = this.scroll.clientHeight;
    const H = this.headH, rh = this.rowH;
    const cs = getComputedStyle(this.host);
    const text2 = cs.getPropertyValue('--text-2').trim() || '#57606a', line = cs.getPropertyValue('--line').trim() || '#d0d7de';
    const PADX = 200, ox = Math.max(0, sl - PADX), w = cw + 2 * PADX;
    const tiers = TS.tiers(P, this.ppd);
    this.headBox.style.height = H + 'px';
    this.headBox.innerHTML = `<svg style="position:absolute;left:${ox}px;top:0" width="${w}" height="${H}" viewBox="${ox} 0 ${w} ${H}">${G.scaleSVG({ P, ppd: this.ppd, origin: this.origin, x0: ox, x1: ox + w, h: H, tiers, font: '500 11px ' + FONT, color: text2, line, stick: true, vx0: sl, vx1: sl + cw })}</svg>`;
    const oy = Math.max(0, st - 4 * rh), h = Math.max(0, ch - H) + 8 * rh;
    this.layer.style.left = ox + 'px'; this.layer.style.top = H + oy + 'px'; this.layer.style.width = w + 'px'; this.layer.style.height = h + 'px';
    this.blocks = [];
    const out = [`<g>${teamRowsSVG(P, this.rows, this.X.bind(this), ox, ox + w, rh, this.blocks, this.dragUid, this.sel)}</g>`];
    this.layer.innerHTML = `<svg width="${w}" height="${h}" viewBox="${ox} ${oy} ${w} ${h}">${out.join('')}${this.dragSVG || ''}</svg>`;
    this.geo = new Map(); this.links = [];
  }
  hitBlock(p) { for (let k = this.blocks.length - 1; k >= 0; k--) { const b = this.blocks[k]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b; } return null; }
  onHover(e) { const p = this.pos(e); const b = p.y >= 0 && this.hitBlock(p); this.scroll.style.cursor = b ? 'grab' : ''; if (b) this.showCard(b.t, e); else UI.card(null); }
  onDown(e) {
    if (e.button !== 0) return;
    UI.card(null);
    const p = this.pos(e);
    if (p.y < 0) return;
    const b = this.hitBlock(p);
    if (!b) { if (e.pointerType !== 'touch') this.pan(e); return; }
    this.sel = b.t.uid; this.o.onPick && this.o.onPick(b.t);
    const x0 = p.x, y0 = p.y, rh = this.rowH;
    let moved = false, dt = 0, toRow = null;
    const mv = ev => {
      const q = this.pos(ev);
      if (!moved && Math.abs(q.x - x0) + Math.abs(q.y - y0) < 5) return;
      moved = true;
      dt = Math.round((q.x - x0) / this.ppd) * 1440;
      toRow = this.rows[Math.floor(q.y / rh)] || null;
      const ry = toRow ? this.rows.indexOf(toRow) * rh : b.y;
      this.dragSVG = `<rect x="${b.x + (q.x - x0)}" y="${ry + 3}" width="${b.w}" height="${rh - 6}" rx="4" fill="none" stroke="#2f6fb5" stroke-width="1.6" stroke-dasharray="4 2"/>`;
      this.draw();
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      this.dragSVG = '';
      if (!moved) { this.draw(); return; }
      this.o.onDrop && this.o.onDrop(b, dt, toRow);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
}
// rows: resources (+ unassigned); blocks per assignment, stacked when they overlap (overlap = red outline)
function teamRowsSVG(P, rows, X, xa, xb, rh, blocks, dragUid, selUid) {
  const out = [], pal = G.bars(P);
  rows.forEach((r, i) => {
    const y = i * rh;
    out.push(`<rect x="${xa}" y="${y}" width="${xb - xa}" height="${rh}" fill="${i % 2 ? '#fafbfc' : '#ffffff'}" opacity=".6"/><line x1="${xa}" y1="${y + rh - 0.5}" x2="${xb}" y2="${y + rh - 0.5}" stroke="#e3e7ec"/>`);
    const items = r.items;
    const lanes = [];
    for (const it of items) { let L = 0; while (lanes[L] != null && lanes[L] > it.t.start) L++; lanes[L] = it.t.finish; it.L = L; }
    const n = Math.max(1, lanes.length), lh = (rh - 6) / n;
    for (const it of items) {
      const t = it.t, x = X(t.start), w = Math.max(4, X(t.finish) - x), yy = y + 3 + it.L * lh;
      const over = !!(r.res && r.res.over && it.a && it.a.over && items.some(o2 => o2 !== it && o2.t.start < t.finish && o2.t.finish > t.start));
      const fill = t.crit ? pal.crit.fill : t.color || pal.task.fill;
      out.push(`<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${w.toFixed(1)}" height="${(lh - 2).toFixed(1)}" rx="4" fill="${fill}" stroke="${over ? '#c62828' : selUid === t.uid ? '#111' : 'none'}" stroke-width="${over || selUid === t.uid ? 2 : 0}"/>`);
      if (t.pct) out.push(`<rect x="${x.toFixed(1)}" y="${(yy + lh - 5).toFixed(1)}" width="${(w * t.pct / 100).toFixed(1)}" height="3" fill="rgba(0,0,0,.35)"/>`);
      if (lh >= 14) out.push(`<text x="${(x + 5).toFixed(1)}" y="${(yy + lh / 2 + 3).toFixed(1)}" style="font:500 10.5px ${FONT}" fill="#fff">${esc(U.fit(t.name, '500 10.5px ' + FONT, w - 8))}</text>`);
      if (blocks) blocks.push({ x, y: yy, w, h: lh - 2, t, a: it.a, row: r });
    }
  });
  return out.join('');
}
function teamRows(P) {
  const rows = P.res.filter(r => r.type === 'work' && r.active !== false).map(r => ({ res: r, name: r.name, items: (P.asgR.get(r.uid) || []).map(a => ({ a, t: P.byUid.get(a.t) })).filter(x => x.t && !x.t.inact).sort((p, q) => p.t.start - q.t.start) }));
  const un = P.tasks.filter(t => !t.sum && !t.inact && !(P.asgT.get(t.uid) || []).some(a => (P.resByUid.get(a.r) || {}).type === 'work'));
  rows.push({ res: null, name: 'Tugas belum ditugaskan', items: un.map(t => ({ t })) });
  return rows;
}
class TeamView {
  constructor(app, id) { this.app = app; this.id = id; this.sel = null; }
  get P() { return this.app.P; }
  mount(host) {
    this.host = host;
    this.wrap = el('div.vsplit');
    this.left = el('div.pane.pane-l.team-l', { style: { width: '220px' } });
    this.right = el('div.pane.pane-r');
    this.wrap.append(this.left, el('div.vbar'), this.right);
    host.append(this.wrap);
    this.list = el('div.team-list');
    this.left.append(el('div.team-h', 'Nama Sumber Daya'), this.list);
    this.chart = new TeamChart({
      app: this.app, host: this.right, ppd: V.vs(this.P).zoom.team || 24, rowH: () => Math.max(40, this.app.rowH() + 16), headH: () => 42,
      onScroll: y => { this.list.scrollTop = y; },
      onPick: t => { this.sel = t; this.app.onSel(); },
      onDrop: (b, dt, toRow) => this.drop(b, dt, toRow),
      onZoom: ppd => { V.vs(this.app.P).zoom.team = ppd; this.app.viewChangedSoon(); this.app.updateZoomUI(); },
      onHeadCtx: e => this.app.scaleMenu(e, this),
    });
    this.chart.scroll.addEventListener('dblclick', e => { const p = this.chart.pos(e); const b = p.y >= 0 && this.chart.hitBlock(p); if (b) this.app.cmd('taskInfo', b.t); });
    this.chart.scroll.addEventListener('contextmenu', e => { const p = this.chart.pos(e); const b = p.y >= 0 && this.chart.hitBlock(p); if (b) { e.preventDefault(); e.stopPropagation(); this.sel = b.t; this.app.barMenu(e, b.t, true); } }, true);
    this.render();
    requestAnimationFrame(() => { const R = this.P.root; this.chart.scrollToDate(R.start, 0.04); });
  }
  drop(b, dt, toRow) {
    const app = this.app;
    app.tx(toRow && toRow !== b.row ? 'Pindahkan penugasan' : 'Pindahkan tugas', P2 => {
      const t = P2.byUid.get(b.t.uid), C = P2._ctx;
      if (!t) return false;
      if (dt) { const ns = C.next(t.calId, t.start + dt); if (t.mode === 'manual') t.mStart = ns; else { t.cons = 'SNET'; t.consDate = ns; } }
      if (toRow && toRow !== b.row) {
        if (b.row.res) M.unassign(P2, t, P2.resByUid.get(b.row.res.uid));
        if (toRow.res) M.assign(P2, t, P2.resByUid.get(toRow.res.uid), { units: b.a ? b.a.units : 1 });
      }
    });
  }
  unmount() { if (this.chart.ro) this.chart.ro.disconnect(); this.wrap.remove(); }
  focus() { }
  selectedTasks() { return this.sel ? [this.sel] : []; }
  focusTask() { return this.sel; }
  selectedRes() { return []; }
  render() {
    const P = this.P;
    this.rows = teamRows(P);
    const rh = this.chart.rowH;
    this.list.replaceChildren(...this.rows.map(r => el('div.team-r' + (r.res && r.res.over ? '.over' : ''), { style: { height: rh + 'px' } }, r.res ? icon(r.res.over ? 'person_alert' : 'person') : icon('help'), el('span', r.name), el('small', r.items.length + ' tugas'))));
    this.list.style.paddingBottom = '40px';
    this.chart.setRes(this.rows);
    this.chart.sel = this.sel && this.sel.uid;
    this.chart.render();
  }
}
TeamView.printArt = (app, id, p) => {
  const P = app.P, rows = teamRows(P), rh = 34, nameW = 170, R = P.root;
  const a = U.dayStart(R.start) - 1440, b = Math.ceil(R.finish / 1440) * 1440 + 2 * 1440;
  const W = 1100, ppd = (W - nameW) / ((b - a) / 1440), H = 36;
  const X = t => nameW + (t - a) / 1440 * ppd;
  const out = [`<g transform="translate(${nameW},0)">${G.scaleSVG({ P, ppd, origin: a, x0: 0, x1: W - nameW, h: H, tiers: TS.auto(ppd), font: '500 10px ' + FONT, color: '#4b5563', line: '#cfd5dc' })}</g>`];
  out.push(`<g transform="translate(0,${H})">${teamRowsSVG(P, rows, X, nameW, W, rh, null, null, null)}</g>`);
  rows.forEach((r, i) => out.push(`<text x="6" y="${H + i * rh + rh / 2 + 4}" style="font:600 11px ${FONT}" fill="${r.res && r.res.over ? '#c62828' : '#111827'}">${esc(U.fit(r.name, '600 11px ' + FONT, nameW - 12))}</text>`));
  out.push(`<line x1="${nameW}" y1="0" x2="${nameW}" y2="${H + rows.length * rh}" stroke="#9aa3ad"/>`);
  const breaks = rows.map((_, i) => H + (i + 1) * rh);
  return { w: W, h: H + rows.length * rh, svg: out.join(''), breaks, prefer: 'landscape', maxScale: 1 };
};
V.TYPES.team = TeamView;

/* ======================= Grafik Sumber Daya ======================= */
function graphSVG(P, r, a, b, W, H, unit) {
  const ticks = TS.ticks(unit, 1, a, b, P, 400);
  const pad = { l: 46, r: 10, t: 14, b: 26 };
  const vals = ticks.map(tk => { const cap = P._ctx.between(r.cal || P.calendar, tk.s, tk.e); const w = S.resIn(P, r, tk.s, tk.e); return { tk, u: cap ? w / cap * 100 : 0, cap, w }; });
  const maxU = Math.max(100 * (r.max || 1), ...vals.map(v => v.u), 100) * 1.1;
  const Y = u => pad.t + (H - pad.t - pad.b) * (1 - u / maxU);
  const X = t => pad.l + (t - a) / (b - a) * (W - pad.l - pad.r);
  const out = [];
  for (let g = 0; g <= maxU; g += maxU > 400 ? 100 : 50) out.push(`<line x1="${pad.l}" y1="${Y(g)}" x2="${W - pad.r}" y2="${Y(g)}" stroke="#eef1f4"/><text x="${pad.l - 6}" y="${Y(g) + 3.5}" text-anchor="end" style="font:9.5px ${FONT}" fill="#6b7280">${g}%</text>`);
  const lim = 100 * (r.max || 1);
  for (const v of vals) {
    if (!v.u) continue;
    const x = X(v.tk.s) + 1, w = Math.max(1, X(v.tk.e) - X(v.tk.s) - 2);
    const okH = Math.min(v.u, lim);
    out.push(`<rect x="${x}" y="${Y(okH)}" width="${w}" height="${Y(0) - Y(okH)}" fill="#4a8fd9"/>`);
    if (v.u > lim + 0.5) out.push(`<rect x="${x}" y="${Y(v.u)}" width="${w}" height="${Y(lim) - Y(v.u)}" fill="#e2574c"/>`);
  }
  out.push(`<line x1="${pad.l}" y1="${Y(lim)}" x2="${W - pad.r}" y2="${Y(lim)}" stroke="#0f7a55" stroke-width="1.5" stroke-dasharray="5 3"/><text x="${W - pad.r}" y="${Y(lim) - 4}" text-anchor="end" style="font:600 9.5px ${FONT}" fill="#0f7a55">Unit maks ${U.num(lim, 0)}%</text>`);
  const step = Math.max(1, Math.ceil(ticks.length / 16));
  ticks.forEach((tk, i) => { if (i % step) return; out.push(`<text x="${(X(tk.s) + X(tk.e)) / 2}" y="${H - 8}" text-anchor="middle" style="font:9.5px ${FONT}" fill="#4b5563">${esc(TS.labels(unit, tk.s, tk.e, P, 'bot')[unit === 'day' ? 4 : 1])}</text>`); });
  out.push(`<line x1="${pad.l}" y1="${Y(0)}" x2="${W - pad.r}" y2="${Y(0)}" stroke="#9aa3ad"/>`);
  return out.join('');
}
class RGraphView {
  constructor(app, id) { this.app = app; this.id = id; this.i = 0; }
  get P() { return this.app.P; }
  mount(host) { this.host = host; this.wrap = el('div.vwrap.rgv'); host.append(this.wrap); this.ro = new ResizeObserver(() => this.render()); this.ro.observe(this.wrap); this.render(); }
  unmount() { this.ro.disconnect(); this.wrap.remove(); }
  focus() { }
  selectedTasks() { return []; }
  selectedRes() { const r = this.res()[this.i]; return r ? [r] : []; }
  focusRes() { return this.res()[this.i] || null; }
  res() { return this.P.res.filter(r => r.type === 'work'); }
  render() {
    const P = this.P, list = this.res();
    if (!list.length) { this.wrap.innerHTML = '<div class="empty-v"><span class="ms">bar_chart</span>Belum ada sumber daya kerja</div>'; return; }
    this.i = U.clamp(this.i, 0, list.length - 1);
    const r = list[this.i];
    const R = P.root, a = U.dayStart(R.start), b = Math.ceil(R.finish / 1440) * 1440 + 1440;
    const W = Math.max(500, (this.wrap.clientWidth || 900) - 30), H = Math.max(260, (this.wrap.clientHeight || 400) - 70);
    const days = (b - a) / 1440, unit = days / (W / 46) <= 1 ? 'day' : days / (W / 46) <= 7 ? 'week' : 'month';
    const sel = UI.select(list.map((x, k) => [String(k), x.name + (x.over ? ' ⚠' : '')]), String(this.i), v => { this.i = +v; this.render(); });
    sel.classList.add('sm');
    const tools = el('div.vtool', el('button.icon-btn.sm', { type: 'button', onclick: () => { this.i = (this.i - 1 + list.length) % list.length; this.render(); } }, icon('chevron_left')), sel, el('button.icon-btn.sm', { type: 'button', onclick: () => { this.i = (this.i + 1) % list.length; this.render(); } }, icon('chevron_right')),
      el('span.hint', 'Puncak ' + U.num((r.peak || 0) * 100, 0) + '% · maks ' + U.num((r.max || 1) * 100, 0) + '%' + (r.over ? ' · teralokasi berlebih' : '')), el('span.sp'), el('span.lg-b', el('i.b1'), 'Teralokasi'), el('span.lg-b', el('i.b2'), 'Berlebih'));
    const box = el('div.rg-box');
    box.innerHTML = `<svg width="${W}" height="${H}">${graphSVG(P, r, a, b, W, H, unit)}</svg>`;
    this.wrap.replaceChildren(tools, box);
  }
}
RGraphView.printArt = app => {
  const P = app.P, list = P.res.filter(r => r.type === 'work');
  if (!list.length) return null;
  const R = P.root, a = U.dayStart(R.start), b = Math.ceil(R.finish / 1440) * 1440 + 1440;
  const W = 1000, H = 200, gap = 44, days = (b - a) / 1440, unit = days <= 30 ? 'day' : days <= 200 ? 'week' : 'month';
  const parts = [], breaks = [];
  list.forEach((r, i) => { const y = i * (H + gap); parts.push(`<text x="0" y="${y + 18}" style="font:700 13px ${FONT}" fill="${r.over ? '#c62828' : '#111827'}">${esc(r.name)}${r.over ? ' — teralokasi berlebih' : ''}</text><g transform="translate(0,${y + 24})">${graphSVG(P, r, a, b, W, H - 24, unit)}</g>`); breaks.push(y + H + gap / 2); });
  return { w: W, h: list.length * (H + gap), svg: parts.join(''), breaks, prefer: 'landscape', maxScale: 1 };
};
V.TYPES.rgraph = RGraphView;
})();
