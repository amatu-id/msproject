// Amatu Project — model proyek: pembuatan, indeks kerangka (ID, ringkasan, nomor kerangka, WBS), dan operasi
// pengeditan (sisip, hapus, indent, outdent, pindah, tautan, penugasan sumber daya, aturan jenis tugas).
(() => {
'use strict';
const AP = window.AP, U = AP.U, D = AP.D, Cal = AP.Cal;
const M = AP.M = {};

M.OPTS = () => ({
  hpd: 8, hpw: 40, dpm: 20, dayStart: 480, dayEnd: 1020, weekStart: 1, fyStart: 0,
  durU: 'd', workU: 'h', newAuto: true, autoOnToday: false, taskType: 'FU', effort: false, autoLink: true, split: true,
  estimated: true, honor: true, critSlack: 0, multiCrit: false, calc: 'auto', updateStatus: true,
  showSum: true, projSum: false, outlineNum: false, cur: 'Rp', curDec: 0, curPos: 'before', dateFmt: 'ddd dd/mm/yy',
  stdRate: { v: 0, u: 'h' }, ovtRate: { v: 0, u: 'h' }, rowH: 24,
  level: { auto: false, basis: 'day', clear: true, order: 'std', slack: false, adjust: true, split: false },
});
M.newProject = (name = 'Proyek Baru', start = null) => {
  const s = start == null ? U.today() + 480 : start;
  const P = {
    v: 1, id: U.uid('p'), name, created: Date.now(), updated: Date.now(),
    props: { title: name, subject: '', author: '', manager: '', company: '', category: '', keywords: '', comments: '' },
    start: s, finish: s, fromFinish: false, statusDate: null, currentDate: null, calendar: 'std', priority: 500,
    opts: M.OPTS(), cals: Cal.defaults(), tasks: [], res: [], asg: [], nextUid: 1,
    fields: {},            // alias/formula/indikator kolom kustom: { text1: {name, formula, ind:[...]}, ... }
    wbsDef: null,          // { prefix, levels:[{seq:'num'|'up'|'low'|'chr', len, sep}] }
    bars: null, styles: null, view: null, page: {}, blInfo: {},
  };
  return P;
};
M.fix = P => {   // fill defaults on older/imported data
  const o = M.OPTS();
  P.opts = { ...o, ...(P.opts || {}), level: { ...o.level, ...((P.opts || {}).level || {}) } };
  P.props ||= {}; P.cals = P.cals && P.cals.length ? P.cals : Cal.defaults(); P.tasks ||= []; P.res ||= []; P.asg ||= [];
  P.fields ||= {}; P.page ||= {}; P.blInfo ||= {}; P.calendar ||= P.cals[0].id;
  let max = 0;
  for (const x of [...P.tasks, ...P.res, ...P.asg]) if (x.uid > max) max = x.uid;
  P.nextUid = Math.max(P.nextUid || 1, max + 1);
  for (const t of P.tasks) { t.pred ||= []; if (t.lvl == null) t.lvl = 1; if (t.mode == null) t.mode = 'auto'; if (t.dur == null) t.dur = P.opts.hpd * 60; if (t.pct == null) t.pct = 0; if (t.active == null) t.active = true; if (t.pri == null) t.pri = 500; if (!t.cons) t.cons = 'ASAP'; if (!t.type) t.type = P.opts.taskType; }
  for (const r of P.res) { if (!r.type) r.type = 'work'; if (r.max == null) r.max = 1; r.std ||= { v: 0, u: 'h' }; r.ovt ||= { v: 0, u: 'h' }; if (r.active == null) r.active = true; }
  return P;
};
M.uid = P => P.nextUid++;

M.newTask = (P, props = {}) => {
  const o = P.opts;
  return Object.assign({
    uid: M.uid(P), name: '', lvl: 1, mode: o.newAuto ? 'auto' : 'manual', dur: o.hpd * 60, durU: o.durU || 'd', est: !!o.estimated, el: false,
    cons: 'ASAP', consDate: null, deadline: null, pri: 500, type: o.taskType || 'FU', effort: !!o.effort, cal: null,
    pred: [], pct: 0, aStart: null, aFinish: null, fixedCost: 0, fca: 'pro', notes: '', link: '', active: true, created: Date.now(),
  }, props);
};
M.newRes = (P, props = {}) => Object.assign({
  uid: M.uid(P), name: '', type: 'work', mat: '', ini: '', group: '', max: 1, std: { ...P.opts.stdRate }, ovt: { ...P.opts.ovtRate },
  costUse: 0, accrue: 'pro', cal: null, code: '', email: '', notes: '', generic: false, active: true,
}, props);

/* ---------------- index: ID, pohon, ringkasan, nomor kerangka, WBS, peta penugasan ---------------- */
const SEQ = {
  num: n => String(n), up: n => alpha(n).toUpperCase(), low: n => alpha(n), chr: n => String(n),
};
function alpha(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(97 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
M.index = P => {
  const T = P.tasks;
  P.byUid = new Map();
  P.resByUid = new Map();
  for (const r of P.res) P.resByUid.set(r.uid, r);
  const stack = [];   // ancestors
  const counters = [];
  let prevLvl = 0;
  for (let i = 0; i < T.length; i++) {
    const t = T[i];
    t.id = i + 1;
    // a task can be at most one level deeper than the one above it
    if (t.lvl > prevLvl + 1) t.lvl = prevLvl + 1;
    if (t.lvl < 1) t.lvl = 1;
    while (stack.length >= t.lvl) stack.pop();
    t.parent = stack.length ? stack[stack.length - 1] : null;
    t.kids = [];
    if (t.parent) t.parent.kids.push(t);
    counters.length = t.lvl;
    counters[t.lvl - 1] = (counters[t.lvl - 1] || 0) + 1;
    t.outline = counters.slice(0, t.lvl).join('.');
    stack.push(t);
    prevLvl = t.lvl;
    P.byUid.set(t.uid, t);
  }
  for (const t of T) t.sum = t.kids.length > 0;
  // WBS
  const def = P.wbsDef;
  if (def && def.levels && def.levels.length) {
    const cnt = [];
    for (const t of T) {
      cnt.length = t.lvl; cnt[t.lvl - 1] = (cnt[t.lvl - 1] || 0) + 1;
      let s = def.prefix || '';
      for (let l = 0; l < t.lvl; l++) {
        const L = def.levels[Math.min(l, def.levels.length - 1)];
        let part = (SEQ[L.seq] || SEQ.num)(cnt[l]);
        if (L.len && L.seq === 'num') part = part.padStart(L.len, '0');
        s += (l ? (L.sep == null ? '.' : L.sep) : '') + part;
      }
      t.wbs = t.wbsCode || s;
    }
  } else for (const t of T) t.wbs = t.wbsCode || t.outline;
  // assignments
  P.asgT = new Map(); P.asgR = new Map();
  P.asg = P.asg.filter(a => P.byUid.has(a.t) && P.resByUid.has(a.r));
  for (const a of P.asg) {
    if (!P.asgT.has(a.t)) P.asgT.set(a.t, []);
    if (!P.asgR.has(a.r)) P.asgR.set(a.r, []);
    P.asgT.get(a.t).push(a); P.asgR.get(a.r).push(a);
  }
  // successors
  P.succ = new Map();
  for (const t of T) {
    t.pred = (t.pred || []).filter(L => L.uid !== t.uid && P.byUid.has(L.uid));
    for (const L of t.pred) { if (!P.succ.has(L.uid)) P.succ.set(L.uid, []); P.succ.get(L.uid).push({ t, L }); }
  }
  for (const r of P.res) r.id = P.res.indexOf(r) + 1;
  return P;
};
M.isAncestor = (a, b) => { for (let p = b.parent; p; p = p.parent) if (p === a) return true; return false; };
M.leaves = t => { const out = []; const go = x => { if (x.kids.length) x.kids.forEach(go); else out.push(x); }; go(t); return out; };
M.subtreeEnd = (P, i) => { const t = P.tasks[i]; let j = i + 1; while (j < P.tasks.length && P.tasks[j].lvl > t.lvl) j++; return j; };   // exclusive

/* ---------------- operasi tugas ---------------- */
M.insertTasks = (P, at, list) => {
  at = U.clamp(at, 0, P.tasks.length);
  P.tasks.splice(at, 0, ...list);
  return list;
};
// sisip satu tugas baru di posisi `at` dengan tingkat mengikuti tugas di posisi itu
M.insertTaskAt = (P, at, props = {}) => {
  const ref = P.tasks[at] || P.tasks[at - 1];
  const lvl = props.lvl || (P.tasks[at] ? P.tasks[at].lvl : ref ? (ref.sum && !P.tasks[at] ? ref.lvl + 1 : ref.lvl) : 1);
  const t = M.newTask(P, { ...props, lvl });
  M.insertTasks(P, at, [t]);
  return t;
};
M.deleteTasks = (P, uids) => {
  const del = new Set();
  M.index(P);
  for (const u of uids) {
    const t = P.byUid.get(u);
    if (!t) continue;
    del.add(u);
    // a summary goes with its subtasks (as in Microsoft Project)
    const i = t.id - 1, j = M.subtreeEnd(P, i);
    for (let k = i + 1; k < j; k++) del.add(P.tasks[k].uid);
  }
  if (!del.size) return 0;
  // relink: tasks around a deleted one keep their chain (A→X→B becomes A→B) when autolink is on
  if (P.opts.autoLink) {
    for (const t of P.tasks) {
      if (del.has(t.uid)) continue;
      const add = [];
      for (const L of t.pred) if (del.has(L.uid)) {
        const x = P.byUid.get(L.uid);
        for (const L2 of x ? x.pred : []) if (!del.has(L2.uid) && L.type === 'FS' && L2.type === 'FS' && !t.pred.some(q => q.uid === L2.uid) && !add.some(q => q.uid === L2.uid)) add.push({ ...L2 });
      }
      if (add.length) t.pred.push(...add);
    }
  }
  P.tasks = P.tasks.filter(t => !del.has(t.uid));
  for (const t of P.tasks) t.pred = t.pred.filter(L => !del.has(L.uid));
  P.asg = P.asg.filter(a => !del.has(a.t));
  return del.size;
};
// indent: each selected task one level deeper (with its subtasks); not past the task above + 1
M.indent = (P, uids) => {
  M.index(P);
  const sel = new Set(uids);
  let n = 0;
  for (let i = 0; i < P.tasks.length; i++) {
    const t = P.tasks[i];
    if (!sel.has(t.uid)) continue;
    const prev = P.tasks[i - 1];
    if (!prev || t.lvl > prev.lvl) continue;
    const j = M.subtreeEnd(P, i);
    for (let k = i; k < j; k++) { P.tasks[k].lvl++; if (k > i) sel.delete(P.tasks[k].uid); }
    n++;
    // a task that becomes a summary drops its assignments' meaning: Project keeps them, we keep too
  }
  if (n) dropSummaryLinksToKids(P);
  return n;
};
M.outdent = (P, uids) => {
  M.index(P);
  const sel = new Set(uids);
  let n = 0;
  for (let i = 0; i < P.tasks.length; i++) {
    const t = P.tasks[i];
    if (!sel.has(t.uid) || t.lvl <= 1) continue;
    const j = M.subtreeEnd(P, i);
    for (let k = i; k < j; k++) { P.tasks[k].lvl--; if (k > i) sel.delete(P.tasks[k].uid); }
    n++;
  }
  return n;
};
// a link between a summary and one of its own subtasks is not allowed
function dropSummaryLinksToKids(P) {
  M.index(P);
  for (const t of P.tasks) t.pred = t.pred.filter(L => { const p = P.byUid.get(L.uid); return p && !M.isAncestor(p, t) && !M.isAncestor(t, p); });
}
M.dropBadLinks = dropSummaryLinksToKids;
// move selected tasks (with subtasks) so they sit before index `to` (in the current list)
M.moveTasks = (P, uids, to) => {
  M.index(P);
  const sel = new Set(uids);
  const blocks = [];
  for (let i = 0; i < P.tasks.length; i++) {
    const t = P.tasks[i];
    if (!sel.has(t.uid)) continue;
    const j = M.subtreeEnd(P, i);
    blocks.push(P.tasks.slice(i, j));
    i = j - 1;
  }
  if (!blocks.length) return false;
  const moving = new Set(blocks.flat().map(t => t.uid));
  const anchor = P.tasks[to];
  if (anchor && moving.has(anchor.uid)) return false;
  const rest = P.tasks.filter(t => !moving.has(t.uid));
  let at = anchor ? rest.indexOf(anchor) : rest.length;
  if (at < 0) at = rest.length;
  // level: follow the row we land on (first moved block's root takes the level of the anchor row)
  const base = blocks[0][0].lvl;
  const target = anchor ? anchor.lvl : (rest[rest.length - 1] ? Math.min(rest[rest.length - 1].lvl + (rest[rest.length - 1].kids && rest[rest.length - 1].kids.length ? 1 : 0), base) : 1);
  const dl = target - base;
  const flat = blocks.flat();
  if (dl) for (const t of flat) t.lvl = Math.max(1, t.lvl + dl);
  rest.splice(at, 0, ...flat);
  P.tasks = rest;
  dropSummaryLinksToKids(P);
  return true;
};
// link selected tasks in order (FS); a single selected task links to the one above when called from the toolbar
M.link = (P, uids, type = 'FS') => {
  M.index(P);
  const list = uids.map(u => P.byUid.get(u)).filter(Boolean);
  let n = 0;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (M.isAncestor(a, b) || M.isAncestor(b, a)) continue;
    if (b.pred.some(L => L.uid === a.uid)) continue;
    if (M.wouldLoop(P, a, b)) continue;
    b.pred.push({ uid: a.uid, type, lag: 0, lagU: P.opts.durU || 'd', pct: null, el: false });
    n++;
  }
  return n;
};
M.unlink = (P, uids) => {
  M.index(P);
  const sel = new Set(uids);
  let n = 0;
  if (sel.size === 1) {   // one task: remove all its links
    const u = uids[0];
    for (const t of P.tasks) { const k = t.pred.length; t.pred = t.uid === u ? [] : t.pred.filter(L => L.uid !== u); n += k - t.pred.length; }
    return n;
  }
  for (const t of P.tasks) if (sel.has(t.uid)) { const k = t.pred.length; t.pred = t.pred.filter(L => !sel.has(L.uid)); n += k - t.pred.length; }
  return n;
};
// would adding a → b (b after a) create a loop?
M.wouldLoop = (P, a, b) => {
  // b reaches a through successors (incl. summary families)?
  const seen = new Set(), stack = [b];
  const fam = x => { const out = [x]; for (let p = x.parent; p; p = p.parent) out.push(p); return out; };
  while (stack.length) {
    const x = stack.pop();
    if (x === a || M.isAncestor(x, a) || M.isAncestor(a, x)) return true;
    if (seen.has(x.uid)) continue;
    seen.add(x.uid);
    for (const f of fam(x)) for (const { t } of P.succ.get(f.uid) || []) stack.push(t);
    for (const k of x.kids || []) stack.push(k);
  }
  return false;
};

/* ---------------- penugasan & aturan jenis tugas ---------------- */
// Work = Duration × Units for work resources. Task type decides what moves when one of them is edited.
M.workRes = (P, t) => (P.asgT.get(t.uid) || []).filter(a => (P.resByUid.get(a.r) || {}).type === 'work');
M.syncWork = (P, t) => { for (const a of M.workRes(P, t)) a.work = Math.round(t.dur * a.units); };
M.setDur = (P, t, dur) => {
  const w = M.workRes(P, t);
  if (!w.length || t.type !== 'FW') { t.dur = dur; M.syncWork(P, t); return; }
  // fixed work: units change
  const old = t.dur || 1;
  t.dur = dur;
  for (const a of w) { a.units = dur > 0 ? Math.max(0.001, (a.work || old * a.units) / dur) : a.units; }
};
M.setWork = (P, t, work) => {
  const w = M.workRes(P, t);
  if (!w.length) return false;
  const sumU = w.reduce((s, a) => s + a.units, 0) || 1;
  if (t.type === 'FD') {   // duration stays, units change
    for (const a of w) { a.work = Math.round(work * a.units / sumU); a.units = t.dur > 0 ? a.work / t.dur : a.units; }
  } else {   // FU / FW: duration changes
    for (const a of w) a.work = Math.round(work * a.units / sumU);
    t.dur = Math.round(work / sumU);
  }
  return true;
};
M.setUnits = (P, t, a, units) => {
  units = Math.max(0, units);
  if (t.type === 'FD') { a.units = units; a.work = Math.round(t.dur * units); return; }
  if (t.type === 'FW' || t.type === 'FU') {   // work stays, duration follows (Project: FU + units edit changes duration)
    const work = a.work || t.dur * a.units;
    a.units = units;
    a.work = Math.round(work);
    const w = M.workRes(P, t);
    t.dur = Math.round(Math.max(...w.map(x => (x.units > 0 ? x.work / x.units : 0)), 0));
  }
};
// assign (or update) a resource; effort-driven tasks keep their total work
M.assign = (P, t, r, { units, qty, cost } = {}) => {
  M.index(P);
  let a = (P.asgT.get(t.uid) || []).find(x => x.r === r.uid);
  const workBefore = M.workRes(P, t).reduce((s, x) => s + x.work, 0);
  const effort = t.effort && r.type === 'work' && workBefore > 0 && !a;
  if (!a) {
    a = { uid: M.uid(P), t: t.uid, r: r.uid, units: r.type === 'work' ? (units == null ? Math.min(1, r.max || 1) : units) : (qty == null ? 1 : qty), work: 0, cost: cost || 0, contour: 'flat', delay: 0 };
    P.asg.push(a);
    M.index(P);
  } else {
    if (r.type === 'work' && units != null) a.units = units;
    if (r.type === 'material' && qty != null) a.units = qty;
    if (r.type === 'cost' && cost != null) a.cost = cost;
  }
  if (r.type === 'work') {
    if (effort) {
      // total work kept: FU → shorter duration, FD → lower units
      const w = M.workRes(P, t), sumU = w.reduce((s, x) => s + x.units, 0) || 1;
      if (t.type === 'FD') { for (const x of w) { x.work = Math.round(workBefore * x.units / sumU); } }
      else { t.dur = Math.round(workBefore / sumU); for (const x of w) x.work = Math.round(t.dur * x.units); }
    } else a.work = Math.round(t.dur * a.units);
  } else if (r.type === 'material') a.work = a.units;
  return a;
};
M.unassign = (P, t, r) => {
  M.index(P);
  const w0 = M.workRes(P, t);
  const workBefore = w0.reduce((s, x) => s + x.work, 0);
  const a = (P.asgT.get(t.uid) || []).find(x => x.r === r.uid);
  if (!a) return false;
  P.asg = P.asg.filter(x => x !== a);
  M.index(P);
  if (t.effort && r.type === 'work') {
    const w = M.workRes(P, t), sumU = w.reduce((s, x) => s + x.units, 0);
    if (w.length && sumU > 0 && t.type !== 'FD') { t.dur = Math.round(workBefore / sumU); for (const x of w) x.work = Math.round(t.dur * x.units); }
  }
  return true;
};
// apply "Budi[50%];Semen[10 sak]" to a task; unknown names become new work resources (as in Project)
M.setResText = (P, t, text) => {
  const want = D.parseRes(text);
  M.index(P);
  const cur = P.asgT.get(t.uid) || [];
  const findRes = name => P.res.find(r => r.name.toLowerCase() === name.toLowerCase());
  const keep = new Set();
  for (const w of want) {
    let r = findRes(w.name);
    if (!r) { r = M.newRes(P, { name: w.name, ini: w.name.slice(0, 1).toUpperCase(), type: w.qty != null ? 'material' : w.cost != null ? 'cost' : 'work', mat: w.label || '' }); P.res.push(r); M.index(P); }
    keep.add(r.uid);
    M.assign(P, t, r, { units: w.units, qty: w.qty, cost: w.cost });
  }
  for (const a of cur) if (!keep.has(a.r)) M.unassign(P, t, P.resByUid.get(a.r));
};

/* ---------------- tanggal: mengetik mulai/selesai ---------------- */
// Auto-scheduled task: typing a start sets "Start No Earlier Than", typing a finish sets "Finish No Earlier Than" (Project).
M.setStart = (P, t, start) => {
  if (t.mode === 'manual') { const d = t.dur; t.mStart = start; if (t.mFinish != null && !t.sum) t.mFinish = null; t.dur = d; return; }
  if (t.sum) return;
  if (t.pct > 0 && t.aStart != null) { t.aStart = start; return; }
  t.cons = 'SNET'; t.consDate = start;
};
M.setFinish = (P, t, finish, ctx) => {
  if (t.mode === 'manual') {
    const s = t.mStart != null ? t.mStart : t.start;
    if (s != null && ctx) { t.dur = Math.max(0, ctx.between(AP.S.calOf(P, t), s, finish)); t.durU ||= 'd'; M.syncWork(P, t); }
    return;
  }
  if (t.sum) return;
  if (t.pct >= 100 && t.aFinish != null) { t.aFinish = finish; return; }
  // Project: typing a finish on an auto task changes the duration when it has no links driving it, else FNET
  if (!t.pred.length && ctx) {
    const cal = AP.S.calOf(P, t), s = t.start;
    if (finish > s) { M.setDur(P, t, ctx.between(cal, s, finish)); t.est = false; return; }
  }
  t.cons = 'FNET'; t.consDate = finish;
};
M.setPct = (P, t, pct, ctx) => {
  pct = U.clamp(Math.round(pct), 0, 100);
  if (t.sum) {   // spread to subtasks like Project does when you type % on a summary
    for (const k of M.leaves(t)) M.setPct(P, k, pct, ctx);
    return;
  }
  t.pct = pct;
  if (pct > 0 && t.aStart == null) t.aStart = t.start;
  if (pct === 0) { t.aStart = null; t.aFinish = null; }
  if (pct >= 100) { if (t.aFinish == null) t.aFinish = t.finish; } else t.aFinish = null;
};
M.markOnTrack = (P, t, sd, ctx) => {
  if (t.sum) { for (const k of M.leaves(t)) M.markOnTrack(P, k, sd, ctx); return; }
  if (t.dur <= 0) { M.setPct(P, t, t.start <= sd ? 100 : 0, ctx); return; }
  const cal = AP.S.calOf(P, t);
  const done = ctx.between(cal, t.start, Math.min(sd, t.finish));
  M.setPct(P, t, Math.round(100 * done / t.dur), ctx);
};

/* ---------------- tugas berulang ---------------- */
// pattern: {t:'d'|'w'|'m'|'y', n, days:[dow], day, count, until} → list of day indexes
M.recurDays = (from, pat) => {
  const out = [], start = Math.floor(from / 1440), lim = pat.count ? 1000 : 3660;
  const until = pat.until != null ? Math.floor(pat.until / 1440) : Infinity, count = pat.count || Infinity;
  for (let di = start, g = 0; g < 3660 * 3 && out.length < Math.min(count, lim) && di <= until; di++, g++) {
    const a = U.ymd(di * 1440);
    let ok = false;
    if (pat.t === 'd') ok = (di - start) % (pat.n || 1) === 0;
    else if (pat.t === 'w') ok = (pat.days || [U.ymd(from).dow]).includes(a.dow) && Math.floor((di - start) / 7) % (pat.n || 1) === 0;
    else if (pat.t === 'm') { const f = U.ymd(from); ok = a.d === (pat.day || f.d) && (((a.y - f.y) * 12 + a.m - f.m) % (pat.n || 1) === 0); }
    else if (pat.t === 'y') { const f = U.ymd(from); ok = a.d === f.d && a.m === f.m; }
    if (ok) out.push(di);
  }
  return out;
};

/* ---------------- garis dasar ---------------- */
M.setBaseline = (P, n = 0, uids = null, interim = null) => {
  const sel = uids ? new Set(uids) : null;
  for (const t of P.tasks) {
    if (sel && !sel.has(t.uid)) continue;
    if (interim) { t.ip ||= {}; t.ip[interim] = { s: t.start, f: t.finish }; continue; }
    t.bl ||= {};
    t.bl[n] = { s: t.start, f: t.finish, d: t.sum ? t.sdur : t.dur, w: t.work || 0, c: t.cost || 0 };
    for (const a of P.asgT.get(t.uid) || []) { a.bl ||= {}; a.bl[n] = { w: a.work, c: a.costV || 0, s: a.start, f: a.finish }; }
  }
  if (!interim) P.blInfo[n] = Date.now();
};
M.clearBaseline = (P, n = 0, uids = null) => {
  const sel = uids ? new Set(uids) : null;
  for (const t of P.tasks) { if (sel && !sel.has(t.uid)) continue; if (t.bl) delete t.bl[n]; for (const a of P.asgT.get(t.uid) || []) if (a.bl) delete a.bl[n]; }
  if (!sel) delete P.blInfo[n];
};

/* ---------------- salin / tempel tugas ---------------- */
M.copyTasks = (P, uids) => {
  M.index(P);
  const sel = new Set(uids), rows = [];
  for (const t of P.tasks) if (sel.has(t.uid)) rows.push(t);
  const minL = Math.min(...rows.map(t => t.lvl));
  const pack = rows.map(t => {
    const c = {};
    for (const k of TASK_KEYS) if (t[k] !== undefined) c[k] = U.deep(t[k]);
    c.lvl = t.lvl - minL + 1;
    c.asg = (P.asgT.get(t.uid) || []).map(a => ({ r: a.r, rname: (P.resByUid.get(a.r) || {}).name, units: a.units, work: a.work, cost: a.cost, contour: a.contour }));
    return c;
  });
  return { kind: 'amatu-project-tasks', uids: rows.map(t => t.uid), tasks: pack };
};
const TASK_KEYS = ['uid', 'name', 'lvl', 'mode', 'dur', 'durU', 'est', 'el', 'ms', 'mStart', 'mFinish', 'cons', 'consDate', 'deadline', 'pri', 'type', 'effort', 'cal', 'pred', 'pct', 'aStart', 'aFinish', 'fixedCost', 'fca', 'notes', 'link', 'linkText', 'active', 'hideBar', 'tl', 'ld', 'splits', 'bl', 'x', 'style', 'col', 'pb', 'board', 'color', 'wbsCode', 'created', 'rollup', 'recur'];
M.TASK_KEYS = TASK_KEYS;
M.pasteTasks = (P, clip, at, lvlBase) => {
  const map = new Map(), out = [];
  for (const c of clip.tasks) {
    const t = M.newTask(P, {});
    for (const k of TASK_KEYS) if (k !== 'uid' && c[k] !== undefined) t[k] = U.deep(c[k]);
    t.lvl = Math.max(1, (lvlBase || 1) + c.lvl - 1);
    map.set(c.uid, t.uid);
    out.push({ t, c });
  }
  // links among pasted tasks are kept, links to outside tasks are dropped (Project behaviour for copy)
  for (const { t } of out) t.pred = (t.pred || []).filter(L => map.has(L.uid)).map(L => ({ ...L, uid: map.get(L.uid) }));
  M.insertTasks(P, at, out.map(x => x.t));
  M.index(P);
  for (const { t, c } of out) for (const a of c.asg || []) {
    const r = P.resByUid.get(a.r) || P.res.find(x => x.name === a.rname);
    if (r) P.asg.push({ uid: M.uid(P), t: t.uid, r: r.uid, units: a.units, work: a.work, cost: a.cost || 0, contour: a.contour || 'flat', delay: 0 });
  }
  return out.map(x => x.t);
};

/* ---------------- serialisasi ---------------- */
const CT = new Set(['id', 'parent', 'kids', 'sum', 'outline', 'wbs', 'start', 'finish', 'es', 'ef', 'ls', 'lf', 'ts', 'fs', 'crit', 'work', 'cost', 'aWork', 'aCost', 'rWork', 'rCost', 'status', 'over', 'warn', 'ev', 'sdur', 'pwc', 'aDur', 'rDur', 'calId', 'segs', 'drv', 'loop', 'expPct', 'lateBy', 'mwork', 'bcws', 'bcwp', 'acwp']);
const CR = new Set(['id', 'work', 'cost', 'aWork', 'aCost', 'over', 'peak', 'overDays', 'rWork', 'bWork', 'bCost', 'pct']);
const CA = new Set(['start', 'finish', 'costV', 'aWork', 'aCost', 'rWork', 'over', 'id']);
M.clean = P => JSON.parse(JSON.stringify(P, function (k, v) {
  if (k === 'byUid' || k === 'resByUid' || k === 'asgT' || k === 'asgR' || k === 'succ' || k === '_ctx' || k === '_cache') return undefined;
  if (this && this.uid != null) {
    if ('lvl' in this) { if (CT.has(k)) return undefined; }
    else if ('t' in this && 'r' in this) { if (CA.has(k)) return undefined; }
    else if (CR.has(k)) return undefined;
  }
  return v;
}));
// snapshot for undo (computed values dropped; restored + recalculated)
M.snap = P => JSON.stringify(M.clean(P));
})();
