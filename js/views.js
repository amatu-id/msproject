// Amatu Project — tampilan: daftar tampilan, baris (kerangka, filter, sorot, AutoFilter, urut, kelompok, baris kosong),
// tampilan Gantt (tabel + bagan, pembatas yang bisa digeser), lembar tugas & sumber daya, panel rincian (Formulir Tugas).
(() => {
'use strict';
const AP = window.AP, U = AP.U, F = AP.F, M = AP.M, D = AP.D, UI = AP.UI, { el, icon, esc } = U;
const V = AP.V = {};

V.VIEWS = {
  gantt: { t: 'Bagan Gantt', icon: 'view_timeline', type: 'gantt', mode: 'gantt', kind: 'task', table: 'entry', grp: 'task' },
  tracking: { t: 'Gantt Pelacakan', icon: 'ssid_chart', type: 'gantt', mode: 'tracking', kind: 'task', table: 'tracking', grp: 'task' },
  detail: { t: 'Gantt Rinci', icon: 'clarify', type: 'gantt', mode: 'detail', kind: 'task', table: 'delay', grp: 'task' },
  level: { t: 'Gantt Pemerataan', icon: 'align_justify_space_even', type: 'gantt', mode: 'level', kind: 'task', table: 'delay', grp: 'task' },
  tsheet: { t: 'Lembar Tugas', icon: 'table_view', type: 'sheet', kind: 'task', table: 'entry', grp: 'task' },
  tusage: { t: 'Penggunaan Tugas', icon: 'table_chart', type: 'usage', kind: 'task', table: 'usage', grp: 'task' },
  calendar: { t: 'Kalender', icon: 'calendar_month', type: 'calendar', kind: 'task', grp: 'task' },
  network: { t: 'Diagram Jaringan', icon: 'account_tree', type: 'network', kind: 'task', grp: 'task' },
  timeline: { t: 'Garis Waktu', icon: 'linear_scale', type: 'timeline', kind: 'task', grp: 'task' },
  board: { t: 'Papan Tugas', icon: 'view_kanban', type: 'board', kind: 'task', grp: 'task' },
  team: { t: 'Perencana Tim', icon: 'groups', type: 'team', kind: 'res', grp: 'res' },
  rsheet: { t: 'Lembar Sumber Daya', icon: 'badge', type: 'sheet', kind: 'res', table: 'entry', grp: 'res' },
  rusage: { t: 'Penggunaan Sumber Daya', icon: 'person_search', type: 'usage', kind: 'res', table: 'usage', grp: 'res' },
  rgraph: { t: 'Grafik Sumber Daya', icon: 'bar_chart', type: 'rgraph', kind: 'res', grp: 'res' },
  report: { t: 'Laporan', icon: 'monitoring', type: 'report', kind: 'task', grp: 'rep' },
};
V.TYPES = {};   // type → class (registered by the view files)
V.def = id => V.VIEWS[id] || V.VIEWS.gantt;
V.vs = P => { P.view ||= {}; const v = P.view; v.cur ||= 'gantt'; v.table ||= {}; v.filter ||= {}; v.hl ||= {}; v.group ||= {}; v.sort ||= {}; v.af ||= {}; v.zoom ||= {}; v.split ||= {}; return v; };
V.tableOf = (P, id) => { const vs = V.vs(P); return vs.table[id] || V.def(id).table || 'entry'; };

/* ---------------- filter ---------------- */
const SD = P => (P.statusDate != null ? P.statusDate : U.now());
V.FILTERS = {
  task: [
    ['all', 'Semua Tugas', () => true],
    ['active', 'Tugas Aktif', t => !t.inact],
    ['complete', 'Tugas Selesai', t => t.pct >= 100],
    ['incomplete', 'Tugas Belum Selesai', t => t.pct < 100],
    ['inprogress', 'Tugas Sedang Berjalan', t => t.pct > 0 && t.pct < 100],
    ['notstarted', 'Tugas Belum Dimulai', t => !t.pct],
    ['critical', 'Tugas Kritis', t => t.crit],
    ['milestones', 'Tonggak', t => F.isMs(t)],
    ['summary', 'Tugas Ringkasan', t => t.sum],
    ['late', 'Tugas Terlambat', t => t.status === 'late'],
    ['slipping', 'Tugas Tergelincir', t => t.pct < 100 && t.bl && t.bl[0] && t.finish > t.bl[0].f + 1],
    ['shouldStart', 'Seharusnya Sudah Mulai', (t, P) => !t.pct && t.start < SD(P)],
    ['manual', 'Tugas Dijadwalkan Manual', t => t.mode === 'manual'],
    ['estimated', 'Durasi Diperkirakan', t => t.est && !t.sum],
    ['overbudget', 'Biaya Melebihi Anggaran', t => t.bl && t.bl[0] && t.cost > (t.bl[0].c || 0) + 0.5],
    ['overalloc', 'Sumber Daya Teralokasi Berlebih', t => t.over],
    ['deadline', 'Tugas dengan Tenggat', t => t.deadline != null],
    ['fixed', 'Tugas dengan Tanggal Tetap', t => t.cons && t.cons !== 'ASAP' && t.cons !== 'ALAP'],
    ['lateDeadline', 'Melewati Tenggat', t => t.lateBy > 0],
    ['noRes', 'Tugas Tanpa Sumber Daya', (t, P) => !t.sum && !(P.asgT.get(t.uid) || []).length],
    ['next2w', 'Mulai dalam 2 Minggu', (t, P) => t.start >= U.today() && t.start < U.today() + 14 * 1440],
    ['resource', 'Menggunakan Sumber Daya…', (t, P, a) => (P.asgT.get(t.uid) || []).some(x => x.r === a), 'res'],
    ['range', 'Rentang Tanggal…', (t, P, a) => t.start < a[1] && t.finish > a[0], 'range'],
  ],
  res: [
    ['all', 'Semua Sumber Daya', () => true],
    ['work', 'Sumber Daya Kerja', r => r.type === 'work'],
    ['material', 'Sumber Daya Material', r => r.type === 'material'],
    ['cost', 'Sumber Daya Biaya', r => r.type === 'cost'],
    ['overalloc', 'Teralokasi Berlebih', r => r.over],
    ['assigned', 'Memiliki Penugasan', (r, P) => (P.asgR.get(r.uid) || []).length > 0],
    ['unassigned', 'Tanpa Penugasan', (r, P) => !(P.asgR.get(r.uid) || []).length],
    ['active', 'Sumber Daya Aktif', r => r.active !== false],
    ['group', 'Grup…', (r, P, a) => (r.group || '').toLowerCase() === String(a || '').toLowerCase(), 'text'],
  ],
};
V.filterFn = (P, kind, spec) => {
  if (!spec || spec.id === 'all') return null;
  if (spec.id === 'custom') return x => V.evalCustom(P, kind, spec, x);
  const f = V.FILTERS[kind].find(x => x[0] === spec.id);
  if (!f) return null;
  return x => { try { return !!f[2](x, P, spec.arg); } catch { return false; } };
};
// custom filter: {id:'custom', rules:[{k, op, v, join:'and'|'or'}]}
V.OPS = [['eq', 'sama dengan'], ['ne', 'tidak sama dengan'], ['gt', 'lebih besar dari'], ['ge', 'lebih besar atau sama'], ['lt', 'lebih kecil dari'], ['le', 'lebih kecil atau sama'], ['has', 'berisi'], ['nhas', 'tidak berisi'], ['empty', 'kosong'], ['nempty', 'tidak kosong']];
V.evalCustom = (P, kind, spec, x) => {
  let res = null;
  for (const r of spec.rules || []) {
    const f = F.reg(kind)[r.k];
    if (!f) continue;
    let ok;
    const raw = F.raw(kind, r.k, x, P);
    const txt = F.text(kind, r.k, x, P).toLowerCase();
    let want = r.v;
    const numeric = ['num', 'int', 'pct', 'cost', 'dur', 'work', 'slack', 'date'].includes(f.type);
    let a = raw, b = want;
    if (numeric) {
      if (f.type === 'date') b = U.parseDate(want, 0);
      else if (f.type === 'dur' || f.type === 'slack') { const d = D.parseDur(want, P.opts); b = d ? d.v : U.parseNum(want); }
      else if (f.type === 'work') b = D.parseWork(want, P.opts);
      else b = U.parseNum(String(want).replace('%', ''));
      if (f.type === 'date' && a != null) { a = U.dayStart(a); b = U.dayStart(b); }
    } else if (f.type === 'flag') { a = !!raw; b = /^(y|ya|yes|true|1)$/i.test(String(want)); }
    else { a = txt; b = String(want == null ? '' : want).toLowerCase(); }
    switch (r.op) {
      case 'eq': ok = numeric ? a === b : a === b; break;
      case 'ne': ok = a !== b; break;
      case 'gt': ok = a > b; break; case 'ge': ok = a >= b; break; case 'lt': ok = a < b; break; case 'le': ok = a <= b; break;
      case 'has': ok = txt.includes(String(want || '').toLowerCase()); break;
      case 'nhas': ok = !txt.includes(String(want || '').toLowerCase()); break;
      case 'empty': ok = !txt || txt === 'na'; break;
      case 'nempty': ok = !!txt && txt !== 'na'; break;
      default: ok = true;
    }
    res = res == null ? ok : r.join === 'or' ? res || ok : res && ok;
  }
  return res == null ? true : res;
};

/* ---------------- kelompok ---------------- */
const band = (v, edges, labels) => { for (let i = 0; i < edges.length; i++) if (v <= edges[i]) return labels[i]; return labels[labels.length - 1]; };
V.GROUPS = {
  task: [
    ['none', 'Tanpa Kelompok'],
    ['complete', 'Selesai dan Belum Selesai', t => (t.pct >= 100 ? '3|Selesai 100%' : t.pct > 0 ? '2|Sedang berjalan (1–99%)' : '1|Belum dimulai (0%)')],
    ['critical', 'Kritis', t => (t.crit ? '1|Kritis' : '2|Tidak kritis')],
    ['milestones', 'Tonggak', t => (F.isMs(t) ? '1|Tonggak' : '2|Bukan tonggak')],
    ['status', 'Status', t => ({ late: '1|Terlambat', ontrack: '2|Sesuai jadwal', future: '3|Tugas mendatang', done: '4|Selesai' })[t.status] || '5|Lainnya'],
    ['priority', 'Prioritas', t => band(t.pri, [99, 299, 499, 500, 699, 899, 1000], ['7|Terendah (0–99)', '6|Rendah (100–299)', '5|Agak rendah (300–499)', '4|Sedang (500)', '3|Agak tinggi (501–699)', '2|Tinggi (700–899)', '1|Tertinggi (900–1000)'])],
    ['duration', 'Durasi', (t, P) => { const d = t.dur / (P.opts.hpd * 60); return band(d, [0, 1, 5, 20, 1e9], ['1|0 hari (tonggak)', '2|≤ 1 hari', '3|1–5 hari', '4|1–4 minggu', '5|> 4 minggu']); }],
    ['mode', 'Mode Tugas', t => (t.mode === 'manual' ? '2|Dijadwalkan manual' : '1|Dijadwalkan otomatis')],
    ['active', 'Aktif vs Tidak Aktif', t => (t.inact ? '2|Tidak aktif' : '1|Aktif')],
    ['cons', 'Jenis Batasan', t => { const i = F.CONS.findIndex(c => c[0] === (t.cons || 'ASAP')); return (i + 1) + '|' + F.CONS[Math.max(0, i)][1]; }],
    ['resource', 'Sumber Daya', null],
  ],
  res: [
    ['none', 'Tanpa Kelompok'],
    ['type', 'Jenis Sumber Daya', r => ({ work: '1|Kerja', material: '2|Material', cost: '3|Biaya' })[r.type] || '4|Lainnya'],
    ['group', 'Grup', r => '1|' + (r.group || '(tanpa grup)')],
    ['over', 'Alokasi Berlebih', r => (r.over ? '1|Teralokasi berlebih' : '2|Normal')],
    ['std', 'Tarif Standar', (r, P) => '1|' + D.fmtRate(r.std, P, r.type === 'material')],
  ],
};

/* ---------------- urut ---------------- */
V.SORTS = {
  task: [['id', 'menurut ID', []], ['start', 'menurut Tanggal Mulai', [{ k: 'start' }, { k: 'finish' }]], ['finish', 'menurut Tanggal Selesai', [{ k: 'finish' }, { k: 'start' }]], ['pri', 'menurut Prioritas', [{ k: 'pri', desc: true }, { k: 'start' }]], ['cost', 'menurut Biaya', [{ k: 'cost', desc: true }]], ['name', 'menurut Nama', [{ k: 'name' }]], ['dur', 'menurut Durasi', [{ k: 'dur', desc: true }]], ['ts', 'menurut Slack Total', [{ k: 'ts' }]]],
  res: [['id', 'menurut ID', []], ['name', 'menurut Nama', [{ k: 'name' }]], ['cost', 'menurut Biaya', [{ k: 'cost', desc: true }]], ['work', 'menurut Kerja', [{ k: 'work', desc: true }]], ['group', 'menurut Grup', [{ k: 'group' }, { k: 'name' }]]],
};
V.sortKeys = (P, kind) => { const s = V.vs(P).sort[kind]; if (!s) return null; if (s.keys) return s.keys.length ? s : null; const b = V.SORTS[kind].find(x => x[0] === s.id); return b && b[2].length ? { keys: b[2], outline: s.outline !== false } : null; };
const cmpBy = (P, kind, keys) => (a, b) => {
  for (const k of keys) {
    const f = F.reg(kind)[k.k];
    if (!f) continue;
    let va = F.raw(kind, k.k, a, P), vb = F.raw(kind, k.k, b, P);
    let c = typeof va === 'string' || typeof vb === 'string' ? U.cmpText(va, vb) : U.cmp(va, vb);
    if (c) return k.desc ? -c : c;
  }
  return (a.id || 0) - (b.id || 0);
};

/* ---------------- baris tugas ---------------- */
V.taskRows = (P, o = {}) => {
  const vs = V.vs(P), opts = P.opts;
  const filt = o.noFilter ? null : V.filterFn(P, 'task', vs.filter.task);
  const hl = V.filterFn(P, 'task', vs.hl.task);
  const af = o.noFilter ? null : V.autoFilterFn(P, 'task');
  const lvlMax = vs.outlineLvl || null;
  const showSum = opts.showSum !== false;
  const grp = !o.noGroup && vs.group.task && vs.group.task.id !== 'none' ? vs.group.task : null;
  const sort = o.noSort ? null : V.sortKeys(P, 'task');
  const T = P.tasks;
  const keep = x => (!filt || filt(x)) && (!af || af(x));
  let list;
  const filtering = !!(filt || af);
  if (filtering) {
    // matching tasks + their summary tasks (Project: "Show related summary rows")
    const show = new Set();
    for (const t of T) if (!t.sum && keep(t)) { show.add(t.uid); for (let p = t.parent; p; p = p.parent) show.add(p.uid); }
    for (const t of T) if (t.sum && keep(t)) show.add(t.uid);
    list = T.filter(t => show.has(t.uid));
  } else list = T;
  // outline collapse / level
  const out = [];
  let hideBelow = Infinity;
  for (const t of list) {
    if (t.lvl > hideBelow) continue;
    hideBelow = Infinity;
    if (lvlMax && t.lvl > lvlMax) continue;
    if (!showSum && t.sum && !grp) { continue; }
    out.push(t);
    if (t.sum && (t.col || (lvlMax && t.lvl >= lvlMax)) && !filtering) hideBelow = t.lvl;
  }
  let rows;
  if (grp) rows = V.grouped(P, 'task', out.filter(t => !t.sum), grp, sort, hl);
  else {
    let seq = out;
    if (sort) {
      if (sort.outline !== false && showSum) {
        // sort siblings, keep the outline
        const kids = new Map(), roots = [];
        for (const t of seq) { const p = t.parent && seq.includes(t.parent) ? t.parent.uid : 0; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(t); }
        const cmp = cmpBy(P, 'task', sort.keys);
        const walk = (pid, acc) => { const k = (kids.get(pid) || []).slice().sort(cmp); for (const t of k) { acc.push(t); walk(t.uid, acc); } return acc; };
        seq = walk(0, roots);
      } else seq = seq.filter(t => !t.sum).slice().sort(cmpBy(P, 'task', sort.keys));
    }
    const flat = !!sort && sort.outline === false;
    rows = seq.map(t => ({ kind: 'task', x: t, key: 't' + t.uid, lvl: flat || !showSum ? 1 : t.lvl, flat, hl: hl ? hl(t) : false }));
  }
  if (opts.projSum && !grp) rows.unshift({ kind: 'task', x: P.root, key: 't0', lvl: 0, root: true });
  if (o.blank && !filtering && !grp && !sort) for (let i = 0; i < o.blank; i++) rows.push({ kind: 'blank', key: 'b' + i, i });
  return rows;
};
V.grouped = (P, kind, items, grp, sort, hl) => {
  const rows = [];
  const fn = (V.GROUPS[kind].find(g => g[0] === grp.id) || [])[2];
  const buckets = new Map();
  const add = (k, x) => { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(x); };
  if (kind === 'task' && grp.id === 'resource') {
    for (const t of items) { const as = P.asgT.get(t.uid) || []; if (!as.length) add('~|Tidak ditugaskan', t); for (const a of as) { const r = P.resByUid.get(a.r); add('1|' + (r ? r.name : '?'), t); } }
  } else if (grp.id === 'field' && grp.k) {
    for (const x of items) add('1|' + (F.text(kind, grp.k, x, P) || '(kosong)'), x);
  } else for (const x of items) add(fn ? fn(x, P) : '1|Semua', x);
  const keys = [...buckets.keys()].sort((a, b) => U.cmpText(a, b));
  const cmp = sort ? cmpBy(P, kind, sort.keys) : (a, b) => (a.id || 0) - (b.id || 0);
  keys.forEach((k, gi) => {
    const label = k.split('|').slice(1).join('|');
    const xs = buckets.get(k).sort(cmp);
    rows.push({ kind: 'group', key: 'g' + gi + '|' + label, label, n: xs.length, items: xs, lvl: 1, gi });
    for (const x of xs) rows.push({ kind: kind === 'res' ? 'res' : 'task', x, key: (kind === 'res' ? 'r' : 't') + x.uid + '|g' + gi, lvl: 2, flat: true, grp: gi, hl: hl ? hl(x) : false });
  });
  return rows;
};
V.resRows = (P, o = {}) => {
  const vs = V.vs(P);
  const filt = V.filterFn(P, 'res', vs.filter.res);
  const af = V.autoFilterFn(P, 'res');
  const hl = V.filterFn(P, 'res', vs.hl.res);
  let list = P.res.filter(r => (!filt || filt(r)) && (!af || af(r)));
  const grp = vs.group.res && vs.group.res.id !== 'none' ? vs.group.res : null;
  const sort = V.sortKeys(P, 'res');
  if (grp) return V.grouped(P, 'res', list, grp, sort, hl);
  if (sort) list = list.slice().sort(cmpBy(P, 'res', sort.keys));
  const rows = list.map(r => ({ kind: 'res', x: r, key: 'r' + r.uid, lvl: 1, hl: hl ? hl(r) : false }));
  if (o.blank && !filt && !af && !sort) for (let i = 0; i < o.blank; i++) rows.push({ kind: 'blank', key: 'b' + i, i });
  return rows;
};
// AutoFilter: per kolom, daftar nilai teks yang ditampilkan
V.autoFilterFn = (P, kind) => {
  const af = V.vs(P).af[kind];
  if (!af || !Object.keys(af).length) return null;
  const ks = Object.entries(af).filter(([, v]) => Array.isArray(v));
  if (!ks.length) return null;
  return x => ks.every(([k, vals]) => vals.includes(F.text(kind, k, x, P)));
};

/* ---------------- tampilan Gantt / lembar ---------------- */
class SplitView {
  constructor(app, id) { this.app = app; this.id = id; this.def = V.def(id); }
  get P() { return this.app.P; }
  mount(host) {
    this.host = host;
    const isSheet = this.def.type === 'sheet';
    this.wrap = el('div.vsplit' + (isSheet ? '.sheet' : ''));
    this.left = el('div.pane.pane-l');
    this.right = isSheet ? null : el('div.pane.pane-r');
    this.bar = isSheet ? null : el('div.vbar', { role: 'separator', 'aria-orientation': 'vertical', title: 'Geser untuk mengubah lebar' });
    this.wrap.append(this.left);
    if (!isSheet) this.wrap.append(this.bar, this.right);
    host.append(this.wrap);
    const kind = this.def.kind;
    this.grid = new AP.Grid({
      app: this.app, host: this.left, kind, label: this.def.t, canMove: kind === 'task',
      rowH: () => this.app.rowH(), headH: () => this.headH(), autoFilter: !!V.vs(this.P).afOn,
      idText: r => (r.kind === 'group' ? '' : r.x && r.x.root ? '0' : r.x ? r.x.id : ''),
      rowClass: r => V.rowClass(r),
      cell: (r, c) => (r.kind === 'group' ? (c.k === 'name' ? `<span class="gname grp" style="padding-left:6px"><span class="ms">folder_open</span>${esc(r.label)} <span class="gcount">${r.n}</span></span>` : V.groupCell(this.P, r, c, kind)) : null),
      onScroll: y => { if (this.chart) this.chart.setScrollTop(y); },
      onSel: () => { if (this.chart) this.chart.paint(); this.app.onSel(); },
      onCommit: (r, k, v) => this.app.commitCell(kind, r, k, v),
      onDbl: (r) => { if (r.kind === 'group') return; if (r.x && !r.x.root) this.app.cmd(kind === 'res' ? 'resInfo' : 'taskInfo', r.x); },
      onCtx: (e, r, c) => this.app.rowMenu(e, kind, r, c),
      onHeadCtx: (e, c) => this.app.headMenu(e, kind, this, c),
      onHeadDbl: c => this.app.cmd('fieldSettings', this, c),
      onColsChange: cols => { F.saveCols(this.P, kind, this.table, cols); this.app.viewChanged(); },
      onToggle: r => this.app.cmd('toggleRow', r.x),
      onMoveRows: (keys, to) => this.app.moveRows(keys, to, this.rows),
      onFilterBtn: (k, btn) => this.app.autoFilterMenu(kind, k, btn, this),
      filterIcon: k => { const a = V.vs(this.P).af[kind]; return a && Array.isArray(a[k]); },
      sortIcon: () => null,
    });
    if (!isSheet) {
      this.chart = new AP.Chart({
        app: this.app, host: this.right, mode: this.def.mode, ppd: V.vs(this.P).zoom[this.id] || V.vs(this.P).zoom.gantt || AP.TS.DEF_PPD,
        rowH: () => this.app.rowH(), headH: () => this.headH(),
        sel: () => this.grid.selKeys,
        onScroll: y => this.grid.setScrollTop(y),
        onSelectRow: (i, keep, e) => { if (keep && this.grid.selKeys.has(this.rows[i] && this.rows[i].key)) return; this.grid.selectIdx(i, e && e.shiftKey, e && (e.ctrlKey || e.metaKey)); this.grid.focus(); },
        onDblTask: t => { if (!t.root) this.app.cmd('taskInfo', t); },
        onBarCtx: (e, t, bar) => this.app.barMenu(e, t, bar),
        onBgCtx: e => this.app.chartMenu(e, this),
        onHeadCtx: e => this.app.scaleMenu(e, this),
        onZoom: ppd => { V.vs(this.P).zoom[this.id] = ppd; this.app.viewChangedSoon(); this.app.updateZoomUI(); },
      });
    }
    this.render(true);
    if (this.chart) this.initSplit();
    if (this.chart && this._first !== false) { this._first = false; requestAnimationFrame(() => this.scrollToStart()); }
  }
  headH() { return this.def.type === 'sheet' ? 30 : AP.TS.tiers(this.P, this.chart ? this.chart.ppd : 18).length > 2 ? 54 : 42; }
  initSplit() {
    const key = 'split.' + (this.def.type === 'gantt' ? 'gantt' : this.id);
    const setW = w => { const hw = this.host.clientWidth; this.left.style.width = Math.round(U.clamp(w, 60, Math.max(120, hw - 80))) + 'px'; };
    const apply = (tries = 0) => {
      const hw = this.host.clientWidth;
      if (!hw) { if (tries < 60) requestAnimationFrame(() => apply(tries + 1)); return; }
      const saved = AP.Store.ui(key);
      const narrow = hw < 700;
      setW(saved && saved.r ? saved.r * hw : Math.min(this.grid.totalW() + 2, Math.round(hw * (narrow ? 0.42 : 0.5))));
      this.grid.render(); this.chart.render();
    };
    this.left.style.width = '45%';
    apply();
    this.bar.addEventListener('pointerdown', e => {
      e.preventDefault();
      const x0 = e.clientX, w0 = this.left.offsetWidth, z = U.zoom();
      this.bar.classList.add('drag');
      const mv = ev => { setW(w0 + (ev.clientX - x0) / z); this.chart.draw(); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); this.bar.classList.remove('drag'); AP.Store.ui(key, { r: this.left.offsetWidth / Math.max(1, this.host.clientWidth) }); this.chart.render(); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    this.bar.addEventListener('dblclick', () => { setW(this.grid.totalW() + 2); AP.Store.ui(key, { r: this.left.offsetWidth / Math.max(1, this.host.clientWidth) }); this.chart.render(); });
  }
  get table() { return V.tableOf(this.P, this.id); }
  rowsNow() {
    const P = this.P;
    const n = Math.max(30, Math.ceil((this.host ? this.host.clientHeight : 800) / this.app.rowH()) + 10);
    return this.def.kind === 'res' ? V.resRows(P, { blank: n }) : V.taskRows(P, { blank: n });
  }
  render(full) {
    const P = this.P;
    this.rows = this.rowsNow();
    this.grid.o.autoFilter = !!V.vs(P).afOn;
    this.grid.setCols(F.cols(P, this.def.kind, this.table));
    this.grid.setRows(this.rows);
    this.grid.render();
    if (this.chart) { this.chart.setRows(this.rows); this.chart.render(); }
  }
  scrollToStart() { if (!this.chart) return; const R = this.P.root; const s = R && R.start != null ? R.start : this.P.start; this.chart.scrollToDate(s, 0.04); }
  selectedTasks() { return this.grid.selectedX().filter(x => !x.root); }
  selectedRows() { return this.grid.selected(); }
  focusRow() { return this.grid.focusRow(); }
  focus() { this.grid.focus(); }
  scrollToTask(t) { if (!this.chart || !t || t.start == null) return; this.chart.scrollToDate(t.start, 0.15); }
  selectUids(uids, focus) {
    const keys = this.rows.filter(r => r.x && uids.includes(r.x.uid)).map(r => r.key);
    if (!keys.length) return false;
    this.grid.selectKeys(keys, focus ? this.rows.find(r => r.x && r.x.uid === focus)?.key : keys[0]);
    const i = this.grid.idx(this.grid.focusKey);
    if (i >= 0) this.grid.ensureVisible(i, true);
    return true;
  }
  unmount() { if (this.chart && this.chart.ro) this.chart.ro.disconnect(); this.wrap.remove(); }
  zoomable() { return !!this.chart; }
}
V.rowClass = r => {
  const c = [];
  if (r.kind === 'blank') c.push('blank');
  if (r.kind === 'group') c.push('grp', 'grp' + (r.gi % 6));
  if (r.grp != null) c.push('ingrp');
  if (r.hl) c.push('hl');
  const x = r.x;
  if (x && r.kind === 'task') { if (x.sum) c.push('sum'); if (x.root) c.push('root'); if (x.inact) c.push('inact'); if (x.crit && x.sum === false && AP.app && AP.app.critText) c.push('crit'); }
  if (x && r.kind === 'res' && x.over) c.push('over');
  if (x && r.kind === 'res' && x.active === false) c.push('inact');
  return c.join(' ');
};
// group header cells: sums for work/cost/duration
V.groupCell = (P, r, c, kind) => {
  const f = F.reg(kind)[c.k];
  if (!f) return '';
  if (['work', 'cost', 'aCost', 'rCost', 'fixedCost', 'aWork', 'rWork', 'bCost', 'bWork'].includes(c.k)) {
    const v = U.sum(r.items.filter(x => !x.sum), x => F.raw(kind, c.k, x, P) || 0);
    return esc(f.fmt ? f.fmt(v, r.items[0], P) : U.num(v));
  }
  if (c.k === 'start' && kind === 'task') return esc(F.fmtDate(Math.min(...r.items.map(x => x.start)), P));
  if (c.k === 'finish' && kind === 'task') return esc(F.fmtDate(Math.max(...r.items.map(x => x.finish)), P));
  return '';
};
V.TYPES.gantt = SplitView;
V.TYPES.sheet = SplitView;
V.SplitView = SplitView;

/* ---------------- Formulir Tugas (panel rincian) ---------------- */
class TaskForm {
  constructor(app) { this.app = app; }
  get P() { return this.app.P; }
  mount(host) { this.host = host; this.box = el('div.tform'); host.append(this.box); this.render(); }
  unmount() { this.box.remove(); }
  render() {
    const P = this.P, app = this.app;
    const t = app.focusTask();
    this.box.replaceChildren();
    if (!t || t.root) { this.box.append(el('div.tf-empty', icon('touch_app'), 'Pilih satu tugas untuk melihat rinciannya')); return; }
    const fld = (label, node) => el('label.tf-f', el('span', label), node);
    const inp = (k, w) => { const i = el('input.inp.sm', { value: F.text('task', k, t, P), style: { width: w || '' }, disabled: F.isRO('task', k, t, P) }); i.addEventListener('change', () => app.commitCell('task', { kind: 'task', x: t, key: 't' + t.uid }, k, i.value)); return i; };
    const sel = (k, opts) => { const s = UI.select(opts, F.raw('task', k, t, P), v => app.commitCell('task', { kind: 'task', x: t, key: 't' + t.uid }, k, v)); s.classList.add('sm'); s.disabled = F.isRO('task', k, t, P); return s; };
    const nav = el('div.tf-nav',
      el('button.icon-btn.sm', { type: 'button', 'data-tip': 'Tugas sebelumnya', onclick: () => app.cmd('selMove', -1) }, icon('arrow_upward')),
      el('button.icon-btn.sm', { type: 'button', 'data-tip': 'Tugas berikutnya', onclick: () => app.cmd('selMove', 1) }, icon('arrow_downward')),
      el('button.btn.sm', { type: 'button', onclick: () => app.cmd('taskInfo', t) }, icon('info'), 'Informasi…'));
    const top = el('div.tf-top',
      fld('Nama', inp('name', '100%')), fld('Durasi', inp('dur', '90px')),
      fld('Mulai', inp('start', '130px')), fld('Selesai', inp('finish', '130px')),
      fld('% Selesai', inp('pct', '64px')), fld('Jenis tugas', sel('type', F.TYPES)),
      fld('Mode', sel('mode', [['auto', 'Otomatis'], ['manual', 'Manual']])),
      el('label.check.tf-eff', Object.assign(el('input', { type: 'checkbox', checked: !!t.effort, disabled: t.sum, onchange: e => app.commitCell('task', { kind: 'task', x: t, key: 't' + t.uid }, 'effort', e.target.checked ? 'Ya' : 'Tidak') })), el('span', 'Didorong upaya')),
      nav);
    // resources
    const asg = (P.asgT.get(t.uid) || []).map(a => ({ a, r: P.resByUid.get(a.r) }));
    const rt = el('table.tf-t', el('thead', el('tr', el('th', 'ID'), el('th', 'Nama Sumber Daya'), el('th', 'Unit'), el('th', 'Kerja'), el('th', 'Biaya'))));
    const rb = el('tbody');
    for (const { a, r } of asg) {
      const units = el('input.inp.sm', { value: r.type === 'work' ? U.num(a.units * 100, 1) + '%' : U.num(a.units, 2) + (r.mat ? ' ' + r.mat : ''), disabled: r.type === 'cost' });
      units.addEventListener('change', () => app.cmd('setAsgUnits', t, a, units.value));
      const work = el('input.inp.sm', { value: r.type === 'work' ? D.fmtWork(a.work, P.opts) : '', disabled: r.type !== 'work' });
      work.addEventListener('change', () => app.cmd('setAsgWork', t, a, work.value));
      rb.append(el('tr', el('td', r.id), el('td', r.name), el('td', units), el('td', work), el('td.r', U.money(a.costV || 0, P))));
    }
    rb.append(el('tr.tf-add', el('td', ''), el('td', { colSpan: 4 }, el('button.btn.link.sm', { type: 'button', onclick: () => app.cmd('assignDlg') }, icon('group_add'), 'Tetapkan sumber daya…'))));
    rt.append(rb);
    // predecessors
    const pt = el('table.tf-t', el('thead', el('tr', el('th', 'ID'), el('th', 'Nama Pendahulu'), el('th', 'Jenis'), el('th', 'Lag'))));
    const pb = el('tbody');
    for (const L of t.pred) {
      const p = P.byUid.get(L.uid);
      if (!p) continue;
      const type = UI.select(D.TYPES.map(k => [k, k]), L.type, v => app.cmd('setLink', t, L, { type: v }));
      type.classList.add('sm');
      const lag = el('input.inp.sm', { value: D.fmtLag(L, P.opts) || '0 hari' });
      lag.addEventListener('change', () => app.cmd('setLink', t, L, { lagText: lag.value }));
      pb.append(el('tr', el('td', p.id), el('td', p.name), el('td', type), el('td', lag)));
    }
    const addId = el('input.inp.sm', { placeholder: 'ID', style: { width: '56px' } });
    addId.addEventListener('change', () => { const v = addId.value.trim(); if (v) app.commitCell('task', { kind: 'task', x: t, key: 't' + t.uid }, 'pred', (D.fmtPreds(t, P) ? D.fmtPreds(t, P) + ';' : '') + v); });
    pb.append(el('tr.tf-add', el('td', addId), el('td', { colSpan: 3 }, el('small.hint', 'Ketik ID pendahulu, mis. 3 atau 3SS+2h'))));
    pt.append(pb);
    this.box.append(top, el('div.tf-tables', el('div.tf-col', el('h4', 'Sumber daya'), rt), el('div.tf-col', el('h4', 'Pendahulu'), pt)));
  }
}
V.TaskForm = TaskForm;
})();
