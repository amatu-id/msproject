// Amatu Project — mesin penjadwal (Critical Path Method) seperti Microsoft Project:
// urutan topologis termasuk tautan ke/dari tugas ringkasan, lag kerja/elapsed/persen, batasan (ASAP, ALAP, SNET, SNLT,
// FNET, FNLT, MSO, MFO), tenggat, tugas manual, aktual & progres, tugas terpisah (split), penundaan pemerataan,
// jadwal dari tanggal selesai proyek, slack total/bebas, jalur kritis, biaya/kerja, status, nilai hasil (earned value),
// beban sumber daya per hari + alokasi berlebih, distribusi waktu (kontur), dan pemerataan sumber daya.
(() => {
'use strict';
const AP = window.AP, U = AP.U, Cal = AP.Cal, M = AP.M, D = AP.D;
const S = AP.S = {};

S.calOf = (P, t) => {
  if (t.cal) return t.cal;
  if (!t.ignoreRes && P.asgT) for (const a of P.asgT.get(t.uid) || []) { const r = P.resByUid.get(a.r); if (r && r.type === 'work' && r.cal) return r.cal; }
  return P.calendar;
};
const gapsOf = t => (t.splits && t.splits.length ? t.splits.reduce((s, x) => s + (x[1] || 0), 0) : 0);

// small binary heap
function Heap(cmp) { const a = []; return { push(x) { a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (cmp(a[i], a[p]) >= 0) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }, pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && cmp(a[l], a[m]) < 0) m = l; if (r < a.length && cmp(a[r], a[m]) < 0) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; }, get size() { return a.length; } }; }

function engine(P) {
  M.index(P);
  const C = Cal.ctx(P);
  P._ctx = C;
  const o = P.opts, T = P.tasks, N = T.length;
  for (const t of T) {
    t.calId = S.calOf(P, t);
    t.warn = null; t.loop = false; t.drv = null;
    t.inact = t.active === false || !!(t.parent && t.parent.inact);
  }
  const leafCache = new Map();
  const leavesOf = t => { let l = leafCache.get(t.uid); if (!l) leafCache.set(t.uid, l = M.leaves(t)); return l; };
  const valid = (p, t) => p && p !== t && !M.isAncestor(p, t) && !M.isAncestor(t, p);
  // effective predecessors of a leaf: its own + those of every summary above it
  function effPreds(t) {
    const out = [];
    for (let x = t; x; x = x.parent) for (const L of x.pred) { const p = P.byUid.get(L.uid); if (valid(p, x)) out.push({ p, L, via: x }); }
    return out;
  }
  function effSuccs(t) {
    const out = [];
    for (let x = t; x; x = x.parent) for (const { t: s, L } of P.succ.get(x.uid) || []) if (valid(x, s)) out.push({ s, L, via: x });
    return out;
  }
  // graph order (Kahn) — summaries after their children, successors after predecessors
  const outE = Array.from({ length: N }, () => []), indeg = new Int32Array(N);
  const edge = (a, b) => { outE[a].push(b); indeg[b]++; };
  for (const t of T) {
    if (t.parent) edge(t.id - 1, t.parent.id - 1);
    for (const L of t.pred) {
      const p = P.byUid.get(L.uid);
      if (!valid(p, t)) continue;
      if (t.sum) for (const lf of leavesOf(t)) edge(p.id - 1, lf.id - 1); else edge(p.id - 1, t.id - 1);
    }
  }
  function order(cmp) {
    const deg = Int32Array.from(indeg), out = [], h = Heap(cmp || ((a, b) => a - b)), done = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (!deg[i]) h.push(i);
    const run = () => { while (h.size) { const i = h.pop(); if (done[i]) continue; done[i] = 1; out.push(i); for (const j of outE[i]) if (--deg[j] === 0) h.push(j); } };
    run();
    // a loop: take the first unfinished task anyway and mark it
    while (out.length < N) {
      let k = -1;
      for (let i = 0; i < N; i++) if (!done[i]) { k = i; break; }
      if (k < 0) break;
      T[k].loop = true; P.loop = true;
      deg[k] = 0; h.push(k); run();
    }
    return out;
  }
  const PS0 = () => {
    let ps = P.start;
    if (o.autoOnToday && !P.fromFinish) ps = Math.max(ps, U.today() + o.dayStart);
    return ps;
  };
  let PS = PS0();
  const durOf = t => Math.max(0, t.dur || 0);
  const isZero = t => durOf(t) === 0 && !(t.splits && t.splits.length);
  const norm = (t, x) => (isZero(t) ? C.point(t.calId, x) : C.next(t.calId, x));
  const endNorm = (t, x) => (isZero(t) ? x : C.prevEnd(t.calId, x));
  const addD = (t, s) => (isZero(t) ? s : t.el ? s + durOf(t) + gapsOf(t) : C.add(t.calId, s, durOf(t) + gapsOf(t)));
  const subD = (t, f) => (isZero(t) ? f : t.el ? f - durOf(t) - gapsOf(t) : C.sub(t.calId, f, durOf(t) + gapsOf(t)));
  const fromFinish = (t, f) => (isZero(t) ? C.point(t.calId, f) : subD(t, C.prevEnd(t.calId, f)));
  const lagMin = (L, p) => (L.pct != null ? Math.round((L.pct / 100) * (p.sum ? p.sdur || 0 : durOf(p))) : L.lag || 0);
  const lagAdd = (cal, x, m, el) => (m >= 0 ? C.addX(cal, x, m, el) : C.subX(cal, x, -m, el));
  const lagSub = (cal, x, m, el) => (m >= 0 ? C.subX(cal, x, m, el) : C.addX(cal, x, -m, el));

  // earliest start the links allow (null = no active predecessor)
  function linkStart(t) {
    let req = null, drv = null;
    for (const { p, L } of effPreds(t)) {
      if (p.inact) continue;
      if (p.start == null) continue;
      const m = lagMin(L, p), cal = t.calId;
      let s;
      if (L.type === 'SS') s = norm(t, lagAdd(cal, p.start, m, L.el));
      else if (L.type === 'FF') s = fromFinish(t, lagAdd(cal, p.finish, m, L.el));
      else if (L.type === 'SF') s = fromFinish(t, lagAdd(cal, p.start, m, L.el));
      else s = norm(t, lagAdd(cal, p.finish, m, L.el));
      if (req == null || s > req) { req = s; drv = { p, L }; }
    }
    t.drv = drv;
    return req;
  }
  function fwd(t, place) {
    const cal = t.calId;
    if (t.mode === 'manual') {
      const s = t.mStart != null ? t.mStart : (t.mFinish != null ? subD(t, t.mFinish) : C.next(cal, PS));
      const req = linkStart(t);
      if (req != null && req > s + 0.5 && !t.inact && t.aStart == null) t.warn = 'link';
      t.es = t.aStart != null ? t.aStart : s;
      t.ef = t.aFinish != null ? t.aFinish : t.mFinish != null && t.mStart != null ? t.mFinish : addD(t, t.es);
      t.start = t.es; t.finish = Math.max(t.es, t.ef);
      return;
    }
    let es = norm(t, PS);
    const req = linkStart(t);
    if (req != null && req > es) es = req;
    const cd = t.consDate;
    if (cd != null) switch (t.cons) {
      case 'SNET': es = Math.max(es, norm(t, cd)); break;
      case 'FNET': es = Math.max(es, fromFinish(t, cd)); break;
      case 'MSO': { const x = norm(t, cd); if (o.honor || x >= es) { if (x < es) t.warn = 'cons'; es = x; } else t.warn = 'cons'; break; }
      case 'MFO': { const x = fromFinish(t, cd); if (o.honor || x >= es) { if (x < es) t.warn = 'cons'; es = x; } else t.warn = 'cons'; break; }
      case 'SNLT': { const x = norm(t, cd); if (es > x) { t.warn = 'cons'; if (o.honor) es = x; } break; }
      case 'FNLT': { const x = fromFinish(t, cd); if (es > x) { t.warn = 'cons'; if (o.honor) es = x; } break; }
    }
    if (t.ld && t.cons !== 'MSO' && t.cons !== 'MFO') es = norm(t, es + t.ld);
    if (place) es = place(t, es);
    if (t.aStart != null) es = t.aStart;
    t.es = es;
    t.ef = t.aFinish != null ? Math.max(es, t.aFinish) : addD(t, es);
    t.start = t.es; t.finish = t.ef;
  }
  function roll(s) {
    let a = Infinity, b = -Infinity, ea = Infinity, eb = -Infinity;
    for (const k of s.kids) {
      if (k.inact && !s.inact) continue;
      if (k.start < a) a = k.start; if (k.finish > b) b = k.finish;
      if (k.es < ea) ea = k.es; if (k.ef > eb) eb = k.ef;
    }
    if (!isFinite(a)) { a = b = ea = eb = C.next(P.calendar, PS); }
    s.start = a; s.finish = b; s.es = ea; s.ef = eb;
    s.sdur = C.between(s.calId, a, b);
  }
  function forward(cmp, place) {
    PS = PS0();
    const ord = order(cmp);
    for (const i of ord) { const t = T[i]; if (t.sum) roll(t); else fwd(t, place); }
    return ord;
  }
  const projectFinish = () => {
    let f = -Infinity;
    for (const t of T) if (!t.sum && !t.inact && t.finish > f) f = t.finish;
    return isFinite(f) ? f : C.next(P.calendar, PS);
  };
  // As Late As Possible (and every task when scheduling from the project finish): finish just before successors' scheduled dates
  function alap(ord, PF) {
    let moved = false;
    for (let k = ord.length - 1; k >= 0; k--) {
      const t = T[ord[k]];
      if (t.sum || t.mode === 'manual' || t.aStart != null || t.inact) continue;
      if (!(t.cons === 'ALAP' || (P.fromFinish && t.cons === 'ASAP'))) continue;
      const cal = t.calId;
      let lf = endNorm(t, PF);
      for (const { s, L } of effSuccs(t)) {
        if (s.inact || s.start == null) continue;
        const m = lagMin(L, t);
        let f;
        if (L.type === 'SS') f = addD(t, C.next(cal, lagSub(cal, s.start, m, L.el)));
        else if (L.type === 'FF') f = endNorm(t, lagSub(cal, s.finish, m, L.el));
        else if (L.type === 'SF') f = addD(t, C.next(cal, lagSub(cal, s.finish, m, L.el)));
        else f = endNorm(t, lagSub(cal, s.start, m, L.el));
        if (f < lf) lf = f;
      }
      if (t.consDate != null && (t.cons === 'FNLT')) lf = Math.min(lf, endNorm(t, t.consDate));
      const ls = isZero(t) ? lf : subD(t, lf);
      if (ls > t.start) { t.start = ls; t.finish = isZero(t) ? ls : addD(t, ls); moved = true; }
    }
    if (moved) for (const i of ord) if (T[i].sum) rollSched(T[i]);
  }
  function rollSched(s) {
    let a = Infinity, b = -Infinity;
    for (const k of s.kids) { if (k.inact && !s.inact) continue; if (k.start < a) a = k.start; if (k.finish > b) b = k.finish; }
    if (isFinite(a)) { s.start = a; s.finish = b; s.sdur = C.between(s.calId, a, b); }
  }
  // late dates (for slack + critical path)
  function backward(ord, PF) {
    const lsC = new Map(), lfC = new Map();
    const sLS = s => { if (!s.sum) return s.ls; if (!lsC.has(s.uid)) lsC.set(s.uid, Math.min(...leavesOf(s).filter(x => !x.inact).map(x => x.ls))); return lsC.get(s.uid); };
    const sLF = s => { if (!s.sum) return s.lf; if (!lfC.has(s.uid)) lfC.set(s.uid, Math.max(...leavesOf(s).filter(x => !x.inact).map(x => x.lf))); return lfC.get(s.uid); };
    for (let k = ord.length - 1; k >= 0; k--) {
      const t = T[ord[k]];
      if (t.sum) continue;
      const cal = t.calId;
      const succs = effSuccs(t).filter(x => !x.s.inact);
      let lf = o.multiCrit && !succs.length ? t.finish : endNorm(t, PF);
      for (const { s, L } of succs) {
        const m = lagMin(L, t);
        const a = sLS(s), b = sLF(s);
        if (!isFinite(a) || !isFinite(b)) continue;
        let f;
        if (L.type === 'SS') f = addD(t, C.next(cal, lagSub(cal, a, m, L.el)));
        else if (L.type === 'FF') f = endNorm(t, lagSub(cal, b, m, L.el));
        else if (L.type === 'SF') f = addD(t, C.next(cal, lagSub(cal, b, m, L.el)));
        else f = endNorm(t, lagSub(cal, a, m, L.el));
        if (f < lf) lf = f;
      }
      if (t.deadline != null) lf = Math.min(lf, endNorm(t, t.deadline));
      const cd = t.consDate;
      if (cd != null) {
        if (t.cons === 'FNLT' || t.cons === 'MFO') lf = Math.min(lf, endNorm(t, cd));
        if (t.cons === 'SNLT' || t.cons === 'MSO') lf = Math.min(lf, addD(t, norm(t, cd)));
      }
      t.lf = lf;
      t.ls = isZero(t) ? lf : subD(t, lf);
    }
  }
  return { C, o, T, N, order, forward, alap, backward, projectFinish, roll, rollSched, effPreds, effSuccs, linkStart, fwd, addD, subD, norm, endNorm, isZero, durOf, leavesOf, get PS() { return PS; } };
}
S.engine = engine;

/* ---------------- perhitungan lengkap ---------------- */
S.calc = P => {
  const t0 = performance.now();
  P.loop = false;
  const E = engine(P), { C, o, T } = E;
  let ord;
  if (P.fromFinish) {
    const keepStart = P.start;
    P.start = (P.finish || P.start) - 3650 * 1440;
    ord = E.forward();
    E.alap(ord, P.finish);
    let ps = Infinity;
    for (const t of T) if (!t.sum && !t.inact && t.start < ps) ps = t.start;
    const sched = T.map(t => [t.start, t.finish]);
    P.start = isFinite(ps) ? ps : keepStart;
    ord = E.forward();
    T.forEach((t, i) => { t.start = sched[i][0]; t.finish = sched[i][1]; });
    for (const i of ord) if (T[i].sum) E.rollSched(T[i]);
  } else {
    ord = E.forward();
    E.alap(ord, E.projectFinish());
  }
  const PF = P.fromFinish ? P.finish : E.projectFinish();
  E.backward(ord, PF);
  if (!P.fromFinish) P.finish = PF;
  S.post(P, E, ord);
  P.calcMs = Math.round(performance.now() - t0);
  return P;
};

S.post = (P, E, ord) => {
  const { C, o, T } = E;
  const SD = P.statusDate != null ? P.statusDate : (P.currentDate != null ? P.currentDate : U.now());
  P.sd = SD;
  const critLim = (o.critSlack || 0) * o.hpd * 60 + 0.5;
  // splits → segments
  for (const t of T) {
    t.segs = null;
    if (t.sum || !t.splits || !t.splits.length || !(t.dur > 0)) continue;
    const cal = t.calId, sp = t.splits.filter(x => x[0] > 0 && x[0] < t.dur && x[1] > 0).sort((a, b) => a[0] - b[0]);
    if (!sp.length) continue;
    let cur = t.start, done = 0;
    const segs = [];
    for (const [off, gap] of sp) {
      if (off <= done) continue;
      const e = C.add(cal, cur, off - done);
      segs.push([cur, e]);
      cur = C.next(cal, C.add(cal, e, gap));
      done = off;
    }
    segs.push([cur, C.add(cal, cur, t.dur - done)]);
    t.segs = segs;
  }
  // leaves: slack, critical, work, cost, status, earned value
  for (const t of T) {
    if (t.sum) continue;
    const cal = t.calId, p = (t.pct || 0) / 100;
    if (t.ls == null) { t.ls = t.start; t.lf = t.finish; }
    t.ts = C.signed(cal, t.finish, t.lf);
    // free slack
    let fs = Infinity;
    const succs = E.effSuccs(t).filter(x => !x.s.inact);
    for (const { s, L } of succs) {
      const m = L.pct != null ? Math.round(L.pct / 100 * (t.dur || 0)) : L.lag || 0;
      const sub = x => (m >= 0 ? C.subX(cal, x, m, L.el) : C.addX(cal, x, -m, L.el));
      let v;
      if (L.type === 'SS') v = C.signed(cal, t.start, sub(s.start));
      else if (L.type === 'FF') v = C.signed(cal, t.finish, sub(s.finish));
      else if (L.type === 'SF') v = C.signed(cal, t.start, sub(s.finish));
      else v = C.signed(cal, t.finish, E.endNorm(t, sub(s.start)));
      if (v < fs) fs = v;
    }
    t.fs = succs.length ? Math.max(0, Math.min(fs, Math.max(0, t.ts))) : Math.max(0, t.ts);
    t.crit = !t.inact && t.pct < 100 && t.ts <= critLim;
    // work & cost
    let work = 0, mwork = 0, cost = 0, aCost = 0;
    for (const a of P.asgT.get(t.uid) || []) {
      const r = P.resByUid.get(a.r);
      if (!r) continue;
      a.start = t.start + (a.delay || 0);
      let c;
      if (r.type === 'work') {
        work += a.work || 0;
        const span = a.units > 0 ? (a.work || 0) / a.units : 0;
        a.finish = t.dur > 0 && span > 0 ? Math.min(Math.max(t.finish, a.start), C.add(cal, a.start, span + gapsOf(t))) : t.finish;
        if (Math.abs(span - t.dur) < 1) a.finish = t.finish;
        c = ((a.work || 0) / 60) * D.rateHour(r.std, o) + (r.costUse || 0);
      } else if (r.type === 'material') {
        a.finish = t.finish; mwork += a.units || 0;
        c = (a.units || 0) * ((r.std && r.std.v) || 0) + (r.costUse || 0);
      } else { a.finish = t.finish; c = a.cost || 0; }
      a.costV = c;
      cost += c;
      const ac = r.accrue === 'start' ? (p > 0 ? c : 0) : r.accrue === 'end' ? (p >= 1 ? c : 0) : c * p;
      a.aCost = ac; aCost += ac;
      a.aWork = r.type === 'work' ? (a.work || 0) * p : 0;
    }
    const fc = t.fixedCost || 0, fa = t.fca === 'start' ? (p > 0 ? fc : 0) : t.fca === 'end' ? (p >= 1 ? fc : 0) : fc * p;
    t.work = work; t.mwork = mwork; t.cost = cost + fc; t.aCost = aCost + fa; t.rCost = t.cost - t.aCost;
    t.aWork = work * p; t.rWork = work - t.aWork; t.pwc = t.pct;
    t.aDur = Math.round((t.dur || 0) * p); t.rDur = (t.dur || 0) - t.aDur;
    // status vs status date
    let exp;
    if (t.dur > 0) exp = t.start >= SD ? 0 : t.finish <= SD ? 1 : C.between(cal, t.start, SD) / t.dur;
    else exp = t.start <= SD ? 1 : 0;
    t.expPct = Math.min(100, exp * 100);
    t.status = t.pct >= 100 ? 'done' : t.start > SD ? 'future' : t.pct + 0.5 >= t.expPct ? 'ontrack' : 'late';
    // earned value (baseline 0)
    const bl = t.bl && t.bl[0];
    if (bl) {
      const bd = C.between(cal, bl.s, bl.f), frac = bl.s >= SD ? 0 : bl.f <= SD ? 1 : bd > 0 ? C.between(cal, bl.s, SD) / bd : 1;
      t.bcws = (bl.c || 0) * frac; t.bcwp = (bl.c || 0) * p;
    } else { t.bcws = 0; t.bcwp = 0; }
    t.acwp = t.aCost;
    t.lateBy = t.deadline != null && t.finish > t.deadline ? C.between(cal, t.deadline, t.finish) : 0;
  }
  // summaries bottom-up (task list order reversed = children before parents)
  for (let i = T.length - 1; i >= 0; i--) {
    const t = T[i];
    if (!t.sum) continue;
    const kids = t.kids.filter(k => !k.inact || t.inact);
    let work = 0, cost = t.fixedCost || 0, aCost = 0, aWork = 0, dw = 0, dd = 0, bcws = 0, bcwp = 0, acwp = 0, ls = Infinity, lf = -Infinity, crit = false;
    let aStart = Infinity, allDone = kids.length > 0, aFin = -Infinity, late = false, anyStarted = false, ws = 0, mwork = 0;
    const fcp = (t.pct || 0) / 100;
    for (const k of kids) {
      work += k.work || 0; mwork += k.mwork || 0; cost += k.cost || 0; aCost += k.aCost || 0; aWork += k.aWork || 0;
      const kd = k.sum ? k.sdur || 0 : k.dur || 0;
      dd += kd; dw += kd * (k.pct || 0);
      bcws += k.bcws || 0; bcwp += k.bcwp || 0; acwp += k.acwp || 0;
      if (k.ls < ls) ls = k.ls; if (k.lf > lf) lf = k.lf;
      crit ||= k.crit;
      if (k.aStart != null || k.pct > 0) { anyStarted = true; if ((k.aStart != null ? k.aStart : k.start) < aStart) aStart = k.aStart != null ? k.aStart : k.start; }
      if (k.pct < 100) allDone = false; else if ((k.aFinish != null ? k.aFinish : k.finish) > aFin) aFin = k.aFinish != null ? k.aFinish : k.finish;
      if (k.status === 'late') late = true;
      ws += kd * (k.expPct || 0);
    }
    t.work = work; t.mwork = mwork; t.cost = cost; t.aCost = aCost + (t.fixedCost || 0) * fcp; t.rCost = t.cost - t.aCost; t.aWork = aWork; t.rWork = work - aWork;
    t.pct = dd > 0 ? Math.round(dw / dd) : kids.length ? Math.round(U.sum(kids, k => k.pct) / kids.length) : 0;
    if (kids.length && kids.every(k => k.pct >= 100)) t.pct = 100;
    t.pwc = work > 0 ? Math.round((aWork / work) * 100) : t.pct;
    t.ls = isFinite(ls) ? ls : t.start; t.lf = isFinite(lf) ? lf : t.finish;
    t.ts = C.signed(t.calId, t.finish, t.lf); t.fs = 0; t.crit = crit;
    t.aStartC = anyStarted ? aStart : null; t.aFinishC = allDone ? aFin : null;
    t.aDur = Math.round((t.sdur || 0) * (t.pct / 100)); t.rDur = (t.sdur || 0) - t.aDur;
    t.expPct = dd > 0 ? ws / dd : 0;
    t.status = t.pct >= 100 ? 'done' : t.start > SD ? 'future' : late ? 'late' : 'ontrack';
    t.bcws = bcws; t.bcwp = bcwp; t.acwp = acwp;
    t.lateBy = t.deadline != null && t.finish > t.deadline ? C.between(t.calId, t.deadline, t.finish) : 0;
    t.dur = t.sdur;   // summaries show their span
  }
  // project summary (task 0)
  const top = T.filter(t => t.lvl === 1 && !t.inact);
  const R = P.root || (P.root = { uid: 0, lvl: 0, name: '', kids: [], pred: [], sum: true, root: true, mode: 'auto', cons: 'ASAP', active: true });
  R.name = P.name; R.id = 0; R.kids = top; R.calId = P.calendar; R.outline = '0'; R.wbs = '0';
  if (top.length) {
    R.start = Math.min(...top.map(t => t.start)); R.finish = Math.max(...top.map(t => t.finish));
  } else { R.start = P.start; R.finish = P.start; }
  R.es = R.start; R.ef = R.finish; R.sdur = C.between(P.calendar, R.start, R.finish); R.dur = R.sdur;
  const sumK = f => U.sum(top, f);
  R.work = sumK(t => t.work); R.cost = sumK(t => t.cost); R.aCost = sumK(t => t.aCost); R.rCost = R.cost - R.aCost; R.aWork = sumK(t => t.aWork); R.rWork = R.work - R.aWork; R.mwork = sumK(t => t.mwork);
  const dd = sumK(t => (t.sum ? t.sdur : t.dur) || 0);
  R.pct = dd > 0 ? Math.round(U.sum(top, t => ((t.sum ? t.sdur : t.dur) || 0) * t.pct) / dd) : 0;
  R.pwc = R.work > 0 ? Math.round(R.aWork / R.work * 100) : R.pct;
  R.crit = top.some(t => t.crit); R.ts = 0; R.fs = 0; R.ls = R.start; R.lf = R.finish;
  R.bcws = sumK(t => t.bcws); R.bcwp = sumK(t => t.bcwp); R.acwp = sumK(t => t.acwp);
  R.status = R.pct >= 100 ? 'done' : top.some(t => t.status === 'late') ? 'late' : R.start > SD ? 'future' : 'ontrack';
  R.aDur = Math.round(R.sdur * R.pct / 100); R.rDur = R.sdur - R.aDur;
  R.bl = {};
  for (const n of Object.keys(P.blInfo || {})) {
    const b = top.map(t => t.bl && t.bl[n]).filter(Boolean);
    if (b.length) R.bl[n] = { s: Math.min(...b.map(x => x.s)), f: Math.max(...b.map(x => x.f)), w: U.sum(b, x => x.w), c: U.sum(b, x => x.c) };
    if (R.bl[n]) R.bl[n].d = C.between(P.calendar, R.bl[n].s, R.bl[n].f);
  }
  for (const t of T) if (t.sum && t.bl) for (const n of Object.keys(t.bl)) { if (t.bl[n] && t.bl[n].d == null) t.bl[n].d = C.between(t.calId, t.bl[n].s, t.bl[n].f); }
  S.loads(P);
};

/* ---------------- beban sumber daya per hari + alokasi berlebih ---------------- */
// worked minutes of a task between a and b (skips split gaps)
S.worked = (P, t, a, b) => {
  const C = P._ctx, segs = t.segs || [[t.start, t.finish]];
  let m = 0;
  for (const [s, e] of segs) { const x = Math.max(s, a), y = Math.min(e, b); if (y > x) m += t.el ? y - x : C.between(t.calId, x, y); }
  return m;
};
S.CONTOURS = {
  flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], back: [1, 1.5, 2.5, 5, 5, 7.5, 7.5, 10, 10, 10], front: [10, 10, 10, 7.5, 7.5, 5, 5, 2.5, 1.5, 1],
  double: [2.5, 5, 10, 5, 2.5, 2.5, 5, 10, 5, 2.5], early: [2.5, 5, 10, 10, 7.5, 5, 5, 2.5, 2.5, 2.5], late: [2.5, 2.5, 2.5, 5, 5, 7.5, 10, 10, 5, 2.5],
  bell: [1, 2, 4, 8, 10, 10, 8, 4, 2, 1], turtle: [2.5, 5, 7.5, 10, 10, 10, 10, 7.5, 5, 2.5],
};
S.CONTOUR_L = { flat: 'Rata', back: 'Berat di akhir', front: 'Berat di awal', double: 'Dua puncak', early: 'Puncak awal', late: 'Puncak akhir', bell: 'Lonceng', turtle: 'Kura-kura' };
const cumCache = {};
const cumOf = k => {
  if (cumCache[k]) return cumCache[k];
  const w = S.CONTOURS[k] || S.CONTOURS.flat, tot = w.reduce((a, b) => a + b, 0), c = [0];
  for (const x of w) c.push(c[c.length - 1] + x / tot);
  return (cumCache[k] = c);
};
const Wx = (k, x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c = cumOf(k), i = Math.min(9, Math.floor(x * 10)); return c[i] + (c[i + 1] - c[i]) * (x * 10 - i); };
// amount (work minutes, material units or cost) of an assignment in [a, b)
S.asgIn = (P, as, a, b, what = 'work') => {
  const t = P.byUid.get(as.t), r = P.resByUid.get(as.r);
  if (!t || !r || t.inact) return 0;
  const total = what === 'cost' ? as.costV || 0 : what === 'awork' ? as.aWork || 0 : r.type === 'material' ? as.units || 0 : r.type === 'cost' ? 0 : as.work || 0;
  if (!total) return 0;
  const s0 = Math.max(as.start != null ? as.start : t.start, t.start), f0 = as.finish != null ? as.finish : t.finish;
  if (f0 <= s0) return a <= s0 && s0 < b ? total : 0;
  if (b <= s0 || a >= f0) return 0;
  if (what === 'cost') {
    const acc = r.accrue;
    if (acc === 'start') return a <= s0 && s0 < b ? total : 0;
    if (acc === 'end') return a < f0 && f0 <= b ? total : 0;
  }
  const span = S.worked(P, t, s0, f0) || 1;
  const x0 = S.worked(P, t, s0, Math.max(a, s0)) / span, x1 = S.worked(P, t, s0, Math.min(b, f0)) / span;
  return total * (Wx(as.contour || 'flat', x1) - Wx(as.contour || 'flat', x0));
};
// fixed cost of a task in [a,b)
S.fixedIn = (P, t, a, b) => {
  const fc = t.fixedCost || 0;
  if (!fc || t.inact) return 0;
  if (t.fca === 'start') return a <= t.start && t.start < b ? fc : 0;
  if (t.fca === 'end') return a < t.finish && t.finish <= b ? fc : 0;
  if (t.finish <= t.start) return a <= t.start && t.start < b ? fc : 0;
  const span = S.worked(P, t, t.start, t.finish) || 1;
  return fc * S.worked(P, t, Math.max(a, t.start), Math.min(b, t.finish)) / span;
};
S.loads = P => {
  const C = P._ctx;
  P.load = new Map();
  for (const r of P.res) { r.over = false; r.peak = 0; r.overDays = 0; r.work = 0; r.cost = 0; r.aWork = 0; r.aCost = 0; }
  for (const t of P.tasks) t.over = false;
  for (const a of P.asg) {
    const t = P.byUid.get(a.t), r = P.resByUid.get(a.r);
    if (!t || !r || t.sum) continue;
    r.cost += a.costV || 0; r.aCost += a.aCost || 0;
    if (r.type !== 'work' || t.inact || !(a.work > 0)) continue;
    r.work += a.work; r.aWork += a.aWork || 0;
    let m = P.load.get(r.uid);
    if (!m) P.load.set(r.uid, m = new Map());
    const d1 = Math.floor(a.start / 1440), d2 = Math.floor((a.finish - 1) / 1440);
    if (d2 - d1 > 4000) continue;
    for (let di = d1; di <= d2; di++) {
      const w = S.asgIn(P, a, di * 1440, di * 1440 + 1440);
      if (w > 0.01) m.set(di, (m.get(di) || 0) + w);
    }
  }
  for (const r of P.res) {
    const m = P.load.get(r.uid);
    if (!m) continue;
    const cal = r.cal || P.calendar;
    for (const [di, w] of m) {
      const cap = C.dayWork(cal, di) * (r.max || 0);
      const units = C.dayWork(cal, di) > 0 ? w / C.dayWork(cal, di) : w > 0 ? Infinity : 0;
      if (units > r.peak) r.peak = units;
      if (w > cap + 1) { r.over = true; r.overDays++; }
    }
  }
  for (const a of P.asg) {
    const t = P.byUid.get(a.t), r = P.resByUid.get(a.r);
    if (!t || !r || !r.over) continue;
    const m = P.load.get(r.uid), cal = r.cal || P.calendar;
    const d1 = Math.floor(a.start / 1440), d2 = Math.floor((a.finish - 1) / 1440);
    for (let di = d1; di <= d2 && di - d1 < 4000; di++) if ((m.get(di) || 0) > C.dayWork(cal, di) * (r.max || 0) + 1) { t.over = true; a.over = true; break; }
  }
  for (let i = P.tasks.length - 1; i >= 0; i--) { const t = P.tasks[i]; if (t.sum) t.over = t.kids.some(k => k.over); }
};
// Remaining availability / overallocation of a resource in [a,b) (minutes)
S.resIn = (P, r, a, b, what = 'work') => {
  let w = 0;
  for (const as of P.asgR.get(r.uid) || []) w += S.asgIn(P, as, a, b, what === 'cost' ? 'cost' : what === 'awork' ? 'awork' : 'work');
  return w;
};
S.capIn = (P, r, a, b) => P._ctx.between(r.cal || P.calendar, a, b) * (r.max || 0);

/* ---------------- pemerataan sumber daya (serial, prioritas) ---------------- */
S.level = (P, opt = {}) => {
  const lv = { ...P.opts.level, ...opt };
  const scope = opt.uids ? new Set(opt.uids) : null;
  if (lv.clear) for (const t of P.tasks) if (!scope || scope.has(t.uid)) t.ld = 0;
  S.calc(P);
  const base = new Map(P.tasks.map(t => [t.uid, { es: t.start, ts: t.ts }]));
  const E = engine(P), { C, T } = E;
  const load = new Map();   // res uid → Map(day → minutes)
  const cap = (r, di) => C.dayWork(r.cal || P.calendar, di) * (r.max || 0);
  const demand = (t, s) => {   // per resource per day for a start s
    const f = E.addD(t, s), out = [];
    for (const a of P.asgT.get(t.uid) || []) {
      const r = P.resByUid.get(a.r);
      if (!r || r.type !== 'work' || !(a.units > 0) || !(a.work > 0)) continue;
      const d1 = Math.floor(s / 1440), d2 = Math.floor((f - 1) / 1440);
      for (let di = d1; di <= d2 && di - d1 < 4000; di++) {
        const x = Math.max(s, di * 1440), y = Math.min(f, di * 1440 + 1440);
        const w = (t.el ? y - x : C.between(t.calId, x, y)) * a.units;
        if (w > 0.5) out.push([r, di, w]);
      }
    }
    return out;
  };
  const fits = dem => { for (const [r, di, w] of dem) { const c = cap(r, di); if (w > c + 1) continue; const m = load.get(r.uid); if (((m && m.get(di)) || 0) + w > c + 1) return di; } return -1; };
  const book = dem => { for (const [r, di, w] of dem) { let m = load.get(r.uid); if (!m) load.set(r.uid, m = new Map()); m.set(di, (m.get(di) || 0) + w); } };
  const cmpStd = (i, j) => {
    const a = T[i], b = T[j];
    if (a.sum !== b.sum) return a.sum ? -1 : 1;
    if (lv.order === 'id') return i - j;
    const ba = base.get(a.uid), bb = base.get(b.uid);
    if (lv.order === 'pri' && a.pri !== b.pri) return b.pri - a.pri;
    if (ba.es !== bb.es) return ba.es - bb.es;
    if (a.pri !== b.pri) return b.pri - a.pri;
    if (ba.ts !== bb.ts) return ba.ts - bb.ts;
    return i - j;
  };
  let delayed = 0;
  const place = (t, es) => {
    const fixed = t.mode === 'manual' || t.pct > 0 || t.aStart != null || t.pri >= 1000 || t.cons === 'MSO' || t.cons === 'MFO' || t.inact || (scope && !scope.has(t.uid));
    let s = es;
    if (!fixed && (P.asgT.get(t.uid) || []).length) {
      const lim = lv.slack ? es + Math.max(0, (base.get(t.uid) || {}).ts || 0) * 2 : Infinity;
      for (let g = 0; g < 1500; g++) {
        const bad = fits(demand(t, s));
        if (bad < 0) break;
        const ns = E.norm(t, (bad + 1) * 1440);
        if (ns <= s || ns > lim) { s = Math.min(s, lim); break; }
        s = ns;
      }
      if (s > es + 0.5) { t.ld = (t.ld || 0) + (s - es); delayed++; }
    }
    book(demand(t, s));
    return s;
  };
  for (const t of T) if (!scope || scope.has(t.uid)) t.ld = lv.clear ? 0 : t.ld || 0;
  E.forward(cmpStd, place);
  S.calc(P);
  return delayed;
};
S.clearLevel = (P, uids) => { const s = uids ? new Set(uids) : null; let n = 0; for (const t of P.tasks) if ((!s || s.has(t.uid)) && t.ld) { t.ld = 0; n++; } return n; };
})();
