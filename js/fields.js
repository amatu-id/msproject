// Amatu Project — daftar kolom (field) tugas, sumber daya, penugasan + tabel bawaan (Entri, Biaya, Jadwal, Pelacakan, ...).
// Setiap kolom: t (judul), en (nama Inggris untuk impor/rumus), type, w, al, ro, get(x,P), fmt(v,x,P), set(x,P,str,ctx).
(() => {
'use strict';
const AP = window.AP, U = AP.U, D = AP.D, M = AP.M;
const F = AP.F = {};
const NA = 'NA';
const PO = (a, b) => (b && b.opts ? b : a);   // fmt(v, x, P) or helper(v, P)
const fd = (v, a, b) => (v == null || !isFinite(v) ? NA : U.fmtDate(v, PO(a, b).opts.dateFmt));
const dayStart = P => P.opts.dayStart, dayEnd = P => P.opts.dayEnd;
const parseD = (s, P, end) => {
  s = String(s == null ? '' : s).trim();
  if (!s || /^(na|n\/a|t\/a|-|–)$/i.test(s)) return null;
  const v = U.parseDate(s, end ? dayEnd(P) : dayStart(P));
  if (!isFinite(v)) throw 'Tanggal tidak dikenali: "' + s + '". Contoh: 18/11/26, 18 Nov 2026';
  return v;
};
F.parseDate = parseD;
F.fmtDate = fd;
const durOf = t => (t.sum ? t.sdur : t.dur);
const blOf = (t, n = 0) => (t.bl && t.bl[n]) || null;
F.CONS = [['ASAP', 'Secepat Mungkin'], ['ALAP', 'Selambat Mungkin'], ['SNET', 'Mulai Tidak Lebih Awal Dari'], ['SNLT', 'Mulai Tidak Lebih Lambat Dari'], ['FNET', 'Selesai Tidak Lebih Awal Dari'], ['FNLT', 'Selesai Tidak Lebih Lambat Dari'], ['MSO', 'Harus Mulai Pada'], ['MFO', 'Harus Selesai Pada']];
F.CONS_L = Object.fromEntries(F.CONS);
F.TYPES = [['FU', 'Unit Tetap'], ['FD', 'Durasi Tetap'], ['FW', 'Kerja Tetap']];
F.MODES = [['auto', 'Dijadwalkan Otomatis'], ['manual', 'Dijadwalkan Manual']];
F.ACCRUE = [['start', 'Awal'], ['pro', 'Prorata'], ['end', 'Akhir']];
F.RTYPES = [['work', 'Kerja'], ['material', 'Material'], ['cost', 'Biaya']];
F.STATUS_L = { done: 'Selesai', ontrack: 'Sesuai Jadwal', late: 'Terlambat', future: 'Tugas Mendatang' };
F.BOARD = [['todo', 'Belum Dimulai'], ['next', 'Berikutnya'], ['doing', 'Sedang Dikerjakan'], ['done', 'Selesai']];
F.boardOf = t => (t.pct >= 100 ? 'done' : t.pct > 0 ? 'doing' : t.board === 'next' ? 'next' : 'todo');
const yesNo = v => (v ? 'Ya' : 'Tidak');
const parseFlag = s => /^(y|ya|yes|true|1|benar|✓|x)$/i.test(String(s).trim());
const num = (s, lo = -Infinity, hi = Infinity) => { const v = U.parseNum(s); if (!isFinite(v)) throw 'Angka tidak valid: ' + s; return U.clamp(v, lo, hi); };
const money = (v, a, b) => U.money(v || 0, PO(a, b));
const fdur = (v, P, u) => D.fmtDur(v, u || P.opts.durU, P.opts);
const fwork = (v, a, b) => D.fmtWork(v || 0, PO(a, b).opts);
const pdur = (s, P) => { const x = D.parseDur(s, P.opts); if (!x) throw 'Durasi tidak dikenali: "' + s + '". Contoh: 5 hari, 2 mgg, 4 jam, 1 bln, 3ehari'; return x; };
const manual = t => t.mode === 'manual';
const ctxOf = P => P._ctx;
const ro = true;

/* ---------------- kolom tugas ---------------- */
const T = F.T = {
  id: { t: 'ID', en: 'ID', type: 'int', w: 44, al: 'c', ro, get: t => t.id },
  uid: { t: 'ID Unik', en: 'Unique ID', type: 'int', w: 70, al: 'r', ro, get: t => t.uid },
  ind: { t: 'Indikator', short: '', en: 'Indicators', type: 'ind', w: 34, al: 'c', ro, get: t => F.indicators(t, AP.app && AP.app.P).length },
  mode: { t: 'Mode Tugas', short: '', en: 'Task Mode', type: 'enum', w: 34, al: 'c', opts: F.MODES, get: t => t.mode,
    fmt: v => (v === 'manual' ? 'Manual' : 'Otomatis'),
    set: (t, P, v) => { const m = /man/i.test(v) ? 'manual' : 'auto'; if (m === 'manual' && t.mode !== 'manual') { t.mStart = t.start; t.mFinish = null; } t.mode = m; } },
  name: { t: 'Nama Tugas', en: 'Name', type: 'name', w: 260, get: t => t.name, set: (t, P, v) => { t.name = String(v).slice(0, 255); } },
  dur: { t: 'Durasi', en: 'Duration', type: 'dur', w: 74, al: 'r', get: t => durOf(t),
    fmt: (v, t, P) => (t.sum ? fdur(v, P, 'd') : D.fmtDur(v, t.durU, P.opts, t.el, t.est && !t.sum)),
    ro: t => t.sum && !manual(t),
    set: (t, P, s) => { const x = pdur(s, P); t.durU = x.u; t.el = x.el; t.est = x.est; M.setDur(P, t, x.v); } },
  start: { t: 'Mulai', en: 'Start', type: 'date', w: 118, get: t => t.start, fmt: fd, ro: t => t.sum && !manual(t),
    set: (t, P, s) => { const v = parseD(s, P); if (v == null) throw 'Tanggal mulai harus diisi'; M.setStart(P, t, v); } },
  finish: { t: 'Selesai', en: 'Finish', type: 'date', w: 118, get: t => t.finish, fmt: fd, ro: t => t.sum && !manual(t),
    set: (t, P, s) => { const v = parseD(s, P, true); if (v == null) throw 'Tanggal selesai harus diisi'; if (v < t.start) throw 'Tanggal selesai tidak boleh sebelum tanggal mulai'; M.setFinish(P, t, v, ctxOf(P)); } },
  pred: { t: 'Pendahulu', en: 'Predecessors', type: 'pred', w: 92, get: t => (t.pred || []).length, fmt: (v, t, P) => D.fmtPreds(t, P),
    set: (t, P, s) => {
      const list = D.parsePreds(s, P, t);
      const keep = t.pred;
      t.pred = [];
      M.index(P);
      for (const L of list) {
        const p = P.byUid.get(L.uid);
        if (M.isAncestor(p, t) || M.isAncestor(t, p)) { t.pred = keep; throw 'Tugas ringkasan tidak dapat ditautkan ke subtugasnya sendiri (ID ' + p.id + ')'; }
        if (M.wouldLoop(P, p, t)) { t.pred = keep; throw 'Tautan ' + p.id + ' → ' + t.id + ' membuat ketergantungan melingkar'; }
        t.pred.push(L);
        M.index(P);
      }
    } },
  succ: { t: 'Penerus', en: 'Successors', type: 'pred', w: 92, get: (t, P) => ((P.succ.get(t.uid) || []).length), fmt: (v, t, P) => D.fmtSuccs(t, P),
    set: (t, P, s) => {
      const list = D.parsePreds(s, P, t);
      for (const x of P.tasks) x.pred = x.pred.filter(L => L.uid !== t.uid);
      M.index(P);
      for (const L of list) {
        const sx = P.byUid.get(L.uid);
        if (M.isAncestor(sx, t) || M.isAncestor(t, sx) || M.wouldLoop(P, t, sx)) throw 'Tautan ke ID ' + sx.id + ' tidak valid';
        sx.pred.push({ ...L, uid: t.uid });
        M.index(P);
      }
    } },
  rn: { t: 'Nama Sumber Daya', en: 'Resource Names', type: 'res', w: 160, get: (t, P) => D.fmtRes(t, P), fmt: v => v, set: (t, P, s) => M.setResText(P, t, s) },
  ri: { t: 'Inisial Sumber Daya', en: 'Resource Initials', type: 'text', w: 90, ro, get: (t, P) => D.fmtInitials(t, P) },
  pct: { t: '% Selesai', en: '% Complete', type: 'pct', w: 70, al: 'r', get: t => t.pct || 0, fmt: v => U.num(v, 0) + '%', set: (t, P, s) => M.setPct(P, t, num(String(s).replace('%', ''), 0, 100), ctxOf(P)) },
  pwc: { t: '% Kerja Selesai', en: '% Work Complete', type: 'pct', w: 74, al: 'r', ro, get: t => t.pwc || 0, fmt: v => U.num(v, 0) + '%' },
  work: { t: 'Kerja', en: 'Work', type: 'work', w: 80, al: 'r', get: t => t.work || 0, fmt: fwork, ro: t => t.sum,
    set: (t, P, s) => { const v = D.parseWork(s, P.opts); if (v == null) throw 'Kerja tidak dikenali (contoh: 40 jam, 5 hari)'; if (!M.setWork(P, t, v)) throw 'Tetapkan sumber daya kerja ke tugas ini untuk mengubah kerjanya'; } },
  cost: { t: 'Biaya', en: 'Cost', type: 'cost', w: 100, al: 'r', ro, get: t => t.cost || 0, fmt: money },
  fixedCost: { t: 'Biaya Tetap', en: 'Fixed Cost', type: 'cost', w: 100, al: 'r', get: t => t.fixedCost || 0, fmt: money, set: (t, P, s) => { t.fixedCost = num(s, 0); } },
  fca: { t: 'Akrual Biaya Tetap', en: 'Fixed Cost Accrual', type: 'enum', w: 100, opts: F.ACCRUE, get: t => t.fca || 'pro', fmt: v => (F.ACCRUE.find(x => x[0] === v) || F.ACCRUE[1])[1], set: (t, P, v) => { t.fca = enumVal(F.ACCRUE, v); } },
  aStart: { t: 'Mulai Aktual', en: 'Actual Start', type: 'date', w: 118, get: t => (t.sum ? t.aStartC : t.aStart), fmt: fd, ro: t => t.sum,
    set: (t, P, s) => { const v = parseD(s, P); if (v == null) { M.setPct(P, t, 0, ctxOf(P)); return; } t.aStart = v; if (!t.pct) t.pct = 1; } },
  aFinish: { t: 'Selesai Aktual', en: 'Actual Finish', type: 'date', w: 118, get: t => (t.sum ? t.aFinishC : t.aFinish), fmt: fd, ro: t => t.sum,
    set: (t, P, s) => { const v = parseD(s, P, true); if (v == null) { t.aFinish = null; if (t.pct >= 100) t.pct = 99; return; } if (t.aStart == null) t.aStart = t.start; if (v < t.aStart) throw 'Selesai aktual sebelum mulai aktual'; t.aFinish = v; t.pct = 100; const C = ctxOf(P); if (C && !t.el) M.setDur(P, t, C.between(t.calId || P.calendar, t.aStart, v)); } },
  aDur: { t: 'Durasi Aktual', en: 'Actual Duration', type: 'dur', w: 84, al: 'r', get: t => t.aDur || 0, fmt: (v, t, P) => fdur(v, P, t.durU), ro: t => t.sum,
    set: (t, P, s) => { const x = pdur(s, P); if (x.v >= t.dur) { M.setDur(P, t, x.v); M.setPct(P, t, 100, ctxOf(P)); } else M.setPct(P, t, t.dur ? 100 * x.v / t.dur : 0, ctxOf(P)); } },
  rDur: { t: 'Durasi Sisa', en: 'Remaining Duration', type: 'dur', w: 84, al: 'r', get: t => t.rDur || 0, fmt: (v, t, P) => fdur(v, P, t.durU), ro: t => t.sum,
    set: (t, P, s) => { const x = pdur(s, P); const a = t.aDur || 0; M.setDur(P, t, a + x.v); M.setPct(P, t, a + x.v > 0 ? 100 * a / (a + x.v) : 0, ctxOf(P)); } },
  aWork: { t: 'Kerja Aktual', en: 'Actual Work', type: 'work', w: 84, al: 'r', ro, get: t => t.aWork || 0, fmt: fwork },
  rWork: { t: 'Kerja Sisa', en: 'Remaining Work', type: 'work', w: 84, al: 'r', ro, get: t => t.rWork || 0, fmt: fwork },
  aCost: { t: 'Biaya Aktual', en: 'Actual Cost', type: 'cost', w: 100, al: 'r', ro, get: t => t.aCost || 0, fmt: money },
  rCost: { t: 'Biaya Sisa', en: 'Remaining Cost', type: 'cost', w: 100, al: 'r', ro, get: t => t.rCost || 0, fmt: money },
  bStart: { t: 'Mulai Garis Dasar', en: 'Baseline Start', type: 'date', w: 118, ro, get: t => (blOf(t) || {}).s, fmt: fd },
  bFinish: { t: 'Selesai Garis Dasar', en: 'Baseline Finish', type: 'date', w: 118, ro, get: t => (blOf(t) || {}).f, fmt: fd },
  bDur: { t: 'Durasi Garis Dasar', en: 'Baseline Duration', type: 'dur', w: 84, al: 'r', ro, get: t => (blOf(t) || {}).d, fmt: (v, t, P) => (v == null ? '' : fdur(v, P, t.durU)) },
  bWork: { t: 'Kerja Garis Dasar', en: 'Baseline Work', type: 'work', w: 84, al: 'r', ro, get: t => (blOf(t) || {}).w, fmt: (v, t, P) => (v == null ? '' : fwork(v, P)) },
  bCost: { t: 'Biaya Garis Dasar', en: 'Baseline Cost', type: 'cost', w: 100, al: 'r', ro, get: t => (blOf(t) || {}).c, fmt: (v, t, P) => (v == null ? '' : money(v, P)) },
  sVar: { t: 'Varians Mulai', en: 'Start Variance', type: 'slack', w: 84, al: 'r', ro, get: (t, P) => { const b = blOf(t); return b ? P._ctx.signed(t.calId || P.calendar, b.s, t.start) : null; }, fmt: (v, t, P) => (v == null ? '' : fdur(v, P, 'd')) },
  fVar: { t: 'Varians Selesai', en: 'Finish Variance', type: 'slack', w: 84, al: 'r', ro, get: (t, P) => { const b = blOf(t); return b ? P._ctx.signed(t.calId || P.calendar, b.f, t.finish) : null; }, fmt: (v, t, P) => (v == null ? '' : fdur(v, P, 'd')) },
  dVar: { t: 'Varians Durasi', en: 'Duration Variance', type: 'slack', w: 84, al: 'r', ro, get: t => { const b = blOf(t); return b ? durOf(t) - (b.d || 0) : null; }, fmt: (v, t, P) => (v == null ? '' : fdur(v, P, 'd')) },
  wVar: { t: 'Varians Kerja', en: 'Work Variance', type: 'work', w: 84, al: 'r', ro, get: t => { const b = blOf(t); return b ? (t.work || 0) - (b.w || 0) : null; }, fmt: (v, t, P) => (v == null ? '' : fwork(v, P)) },
  cVar: { t: 'Varians Biaya', en: 'Cost Variance', type: 'cost', w: 100, al: 'r', ro, get: t => { const b = blOf(t); return b ? (t.cost || 0) - (b.c || 0) : null; }, fmt: (v, t, P) => (v == null ? '' : money(v, P)) },
  ts: { t: 'Slack Total', en: 'Total Slack', type: 'slack', w: 80, al: 'r', ro, get: t => t.ts || 0, fmt: (v, t, P) => fdur(v, P, 'd') },
  fs: { t: 'Slack Bebas', en: 'Free Slack', type: 'slack', w: 80, al: 'r', ro, get: t => t.fs || 0, fmt: (v, t, P) => fdur(v, P, 'd') },
  crit: { t: 'Kritis', en: 'Critical', type: 'flag', w: 60, al: 'c', ro, get: t => !!t.crit, fmt: yesNo },
  es: { t: 'Mulai Awal', en: 'Early Start', type: 'date', w: 118, ro, get: t => t.es, fmt: fd },
  ef: { t: 'Selesai Awal', en: 'Early Finish', type: 'date', w: 118, ro, get: t => t.ef, fmt: fd },
  ls: { t: 'Mulai Akhir', en: 'Late Start', type: 'date', w: 118, ro, get: t => t.ls, fmt: fd },
  lf: { t: 'Selesai Akhir', en: 'Late Finish', type: 'date', w: 118, ro, get: t => t.lf, fmt: fd },
  cons: { t: 'Jenis Batasan', en: 'Constraint Type', type: 'enum', w: 150, opts: F.CONS, get: t => t.cons || 'ASAP', fmt: v => F.CONS_L[v] || v, ro: t => t.sum,
    set: (t, P, v) => { const c = enumVal(F.CONS, v); t.cons = c; if (c === 'ASAP' || c === 'ALAP') t.consDate = null; else if (t.consDate == null) t.consDate = c[0] === 'S' || c === 'MSO' ? t.start : t.finish; } },
  consDate: { t: 'Tanggal Batasan', en: 'Constraint Date', type: 'date', w: 118, get: t => t.consDate, fmt: fd, ro: t => t.sum,
    set: (t, P, s) => { const end = /^F|MFO/.test(t.cons || ''); const v = parseD(s, P, end); t.consDate = v; if (v == null) t.cons = 'ASAP'; else if (!t.cons || t.cons === 'ASAP' || t.cons === 'ALAP') t.cons = 'SNET'; } },
  deadline: { t: 'Tenggat', en: 'Deadline', type: 'date', w: 118, get: t => t.deadline, fmt: fd, set: (t, P, s) => { t.deadline = parseD(s, P, true); } },
  pri: { t: 'Prioritas', en: 'Priority', type: 'int', w: 66, al: 'r', get: t => (t.pri == null ? 500 : t.pri), set: (t, P, s) => { t.pri = Math.round(num(s, 0, 1000)); } },
  type: { t: 'Jenis Tugas', en: 'Type', type: 'enum', w: 100, opts: F.TYPES, get: t => t.type || 'FU', fmt: v => (F.TYPES.find(x => x[0] === v) || F.TYPES[0])[1], set: (t, P, v) => { t.type = enumVal(F.TYPES, v); } },
  effort: { t: 'Didorong Upaya', en: 'Effort Driven', type: 'flag', w: 80, al: 'c', get: t => !!t.effort, fmt: yesNo, set: (t, P, s) => { t.effort = parseFlag(s); } },
  cal: { t: 'Kalender Tugas', en: 'Task Calendar', type: 'enum', w: 110, get: t => t.cal || '', opts: () => [['', 'Tidak ada'], ...(AP.app.P.cals.map(c => [c.id, c.name]))],
    fmt: (v, t, P) => (v ? (P.cals.find(c => c.id === v) || {}).name || v : 'Tidak ada'), set: (t, P, v) => { const c = P.cals.find(c => c.id === v || c.name.toLowerCase() === String(v).toLowerCase()); t.cal = c ? c.id : null; } },
  wbs: { t: 'WBS', en: 'WBS', type: 'text', w: 64, get: t => t.wbs, set: (t, P, s) => { t.wbsCode = String(s).trim() || null; } },
  outline: { t: 'Nomor Kerangka', en: 'Outline Number', type: 'text', w: 74, ro, get: t => t.outline },
  lvl: { t: 'Tingkat Kerangka', en: 'Outline Level', type: 'int', w: 70, al: 'r', ro, get: t => t.lvl },
  ms: { t: 'Tonggak', en: 'Milestone', type: 'flag', w: 66, al: 'c', get: t => isMs(t), fmt: yesNo, ro: t => t.sum, set: (t, P, s) => { const f = parseFlag(s); if (f && t.dur > 0) t.ms = true; else if (!f) { t.ms = false; if (t.dur === 0) M.setDur(P, t, P.opts.hpd * 60); } else t.ms = true; } },
  sum: { t: 'Ringkasan', en: 'Summary', type: 'flag', w: 72, al: 'c', ro, get: t => !!t.sum, fmt: yesNo },
  notes: { t: 'Catatan', en: 'Notes', type: 'text', w: 200, get: t => t.notes || '', fmt: v => String(v || '').replace(/\s+/g, ' '), set: (t, P, s) => { t.notes = String(s); } },
  link: { t: 'Hyperlink', en: 'Hyperlink', type: 'text', w: 160, get: t => t.link || '', set: (t, P, s) => { t.link = String(s).trim(); } },
  active: { t: 'Aktif', en: 'Active', type: 'flag', w: 56, al: 'c', get: t => t.active !== false, fmt: yesNo, set: (t, P, s) => { t.active = parseFlag(s); } },
  status: { t: 'Status', en: 'Status', type: 'enum', w: 110, ro, opts: Object.entries(F.STATUS_L), get: t => t.status, fmt: v => F.STATUS_L[v] || '' },
  board: { t: 'Status Papan', en: 'Board Status', type: 'enum', w: 120, opts: F.BOARD, get: t => F.boardOf(t), fmt: v => (F.BOARD.find(x => x[0] === v) || F.BOARD[0])[1],
    set: (t, P, v) => { const b = enumVal(F.BOARD, v); AP.F.setBoard(P, t, b); } },
  est: { t: 'Diperkirakan', en: 'Estimated', type: 'flag', w: 70, al: 'c', get: t => !!t.est, fmt: yesNo, set: (t, P, s) => { t.est = parseFlag(s); } },
  tl: { t: 'Tampilkan di Garis Waktu', en: 'Display on Timeline', type: 'flag', w: 80, al: 'c', get: t => !!t.tl, fmt: yesNo, set: (t, P, s) => { t.tl = parseFlag(s); } },
  hideBar: { t: 'Sembunyikan Batang', en: 'Hide Bar', type: 'flag', w: 80, al: 'c', get: t => !!t.hideBar, fmt: yesNo, set: (t, P, s) => { t.hideBar = parseFlag(s); } },
  ld: { t: 'Penundaan Pemerataan', en: 'Leveling Delay', type: 'dur', w: 92, al: 'r', get: t => t.ld || 0, fmt: (v, t, P) => D.fmtDur(v, 'd', P.opts, true), set: (t, P, s) => { const x = D.parseDur(s, P.opts, 'd'); if (!x) throw 'Durasi tidak valid'; t.ld = x.el ? x.v : Math.round(x.v / (P.opts.hpd * 60)) * 1440; } },
  lateBy: { t: 'Lewat Tenggat', en: 'Deadline Overrun', type: 'slack', w: 84, al: 'r', ro, get: t => t.lateBy || 0, fmt: (v, t, P) => (v ? fdur(v, P, 'd') : '') },
  created: { t: 'Dibuat', en: 'Created', type: 'date', w: 118, ro, get: t => (t.created ? Math.round((t.created - new Date(t.created).getTimezoneOffset() * 60000) / 60000) : null), fmt: fd },
  // nilai hasil (earned value) — dasar: garis dasar 0, tanggal status
  bcws: { t: 'BCWS (PV)', en: 'BCWS', type: 'cost', w: 100, al: 'r', ro, get: t => t.bcws || 0, fmt: money },
  bcwp: { t: 'BCWP (EV)', en: 'BCWP', type: 'cost', w: 100, al: 'r', ro, get: t => t.bcwp || 0, fmt: money },
  acwp: { t: 'ACWP (AC)', en: 'ACWP', type: 'cost', w: 100, al: 'r', ro, get: t => t.acwp || 0, fmt: money },
  sv: { t: 'SV', en: 'SV', type: 'cost', w: 96, al: 'r', ro, get: t => (t.bcwp || 0) - (t.bcws || 0), fmt: money },
  cv: { t: 'CV', en: 'CV', type: 'cost', w: 96, al: 'r', ro, get: t => (t.bcwp || 0) - (t.acwp || 0), fmt: money },
  spi: { t: 'SPI', en: 'SPI', type: 'num', w: 60, al: 'r', ro, get: t => (t.bcws ? t.bcwp / t.bcws : null), fmt: v => (v == null ? '' : U.numFix(v, 2)) },
  cpi: { t: 'CPI', en: 'CPI', type: 'num', w: 60, al: 'r', ro, get: t => (t.acwp ? t.bcwp / t.acwp : null), fmt: v => (v == null ? '' : U.numFix(v, 2)) },
  bac: { t: 'BAC', en: 'BAC', type: 'cost', w: 100, al: 'r', ro, get: t => (blOf(t) || {}).c || 0, fmt: money },
  eac: { t: 'EAC', en: 'EAC', type: 'cost', w: 100, al: 'r', ro, get: t => { const bac = (blOf(t) || {}).c || 0, cpi = t.acwp ? t.bcwp / t.acwp : 0; return cpi > 0 ? (t.acwp || 0) + (bac - (t.bcwp || 0)) / cpi : t.cost || 0; }, fmt: money },
  vac: { t: 'VAC', en: 'VAC', type: 'cost', w: 100, al: 'r', ro, get: (t, P) => ((blOf(t) || {}).c || 0) - T.eac.get(t, P), fmt: money },
  tcpi: { t: 'TCPI', en: 'TCPI', type: 'num', w: 60, al: 'r', ro, get: t => { const bac = (blOf(t) || {}).c || 0; const d = bac - (t.acwp || 0); return d ? (bac - (t.bcwp || 0)) / d : null; }, fmt: v => (v == null ? '' : U.numFix(v, 2)) },
};
function enumVal(opts, v) { v = String(v == null ? '' : v); const o = opts.find(x => x[0] === v) || opts.find(x => x[1].toLowerCase() === v.toLowerCase()) || opts.find(x => x[1].toLowerCase().startsWith(v.toLowerCase())); if (!o) throw 'Pilihan tidak dikenali: ' + v; return o[0]; }
F.enumVal = enumVal;
const isMs = t => !t.sum && (t.ms || ((t.dur || 0) === 0 && !t.el));
F.isMs = isMs;
F.setBoard = (P, t, b) => {
  t.board = b === 'next' ? 'next' : null;
  if (b === 'done') M.setPct(P, t, 100, P._ctx);
  else if (b === 'doing') { if (!(t.pct > 0 && t.pct < 100)) M.setPct(P, t, 50, P._ctx); }
  else if (t.pct) M.setPct(P, t, 0, P._ctx);
};
// kolom kustom: Teks1–20, Angka1–20, Tanda1–20, Tanggal1–10, Biaya1–10, Durasi1–10 (alias + rumus + indikator di P.fields)
F.CUSTOM = [['text', 'Teks', 20, 'text', 120], ['num', 'Angka', 20, 'num', 80], ['flag', 'Tanda', 20, 'flag', 64], ['date', 'Tanggal', 10, 'date', 118], ['cost', 'Biaya', 10, 'cost', 100], ['dur', 'Durasi', 10, 'dur', 80]];
for (const [p, label, n, type, w] of F.CUSTOM) for (let i = 1; i <= n; i++) {
  const k = p + i, en = { text: 'Text', num: 'Number', flag: 'Flag', date: 'Date', cost: 'Cost', dur: 'Duration' }[p] + i;
  T[k] = {
    t: label + i, en, type: type === 'dur' ? 'dur' : type, w, al: type === 'num' || type === 'cost' || type === 'dur' ? 'r' : type === 'flag' ? 'c' : 'l', custom: k,
    get: (t, P) => { const f = P.fields[k]; if (f && f.formula && AP.Fx) return AP.Fx.evalField(P, f, t); const v = t.x && t.x[k]; return type === 'flag' ? !!v : v == null ? (type === 'num' || type === 'cost' ? 0 : null) : v; },
    fmt: (v, t, P) => type === 'flag' ? yesNo(v) : type === 'date' ? (v == null ? NA : fd(v, P)) : type === 'cost' ? money(v, P) : type === 'num' ? (v == null ? '' : U.num(v, 4)) : type === 'dur' ? (v == null ? '' : fdur(v, P)) : v == null ? '' : String(v),
    ro: (t, P) => !!(P && P.fields[k] && P.fields[k].formula),
    set: (t, P, s) => {
      t.x ||= {};
      let v;
      if (type === 'flag') v = parseFlag(s);
      else if (type === 'date') v = parseD(s, P);
      else if (type === 'num' || type === 'cost') v = String(s).trim() === '' ? null : num(s);
      else if (type === 'dur') { if (String(s).trim() === '') v = null; else v = pdur(s, P).v; }
      else v = String(s);
      if (v == null || v === '' || v === false) delete t.x[k]; else t.x[k] = v;
    },
  };
}
// judul kolom dengan alias kolom kustom
F.title = (k, P, kind = 'task') => {
  const f = (kind === 'res' ? F.R : F.T)[k];
  if (!f) return k;
  if (f.custom && P && P.fields[f.custom] && P.fields[f.custom].name) return P.fields[f.custom].name;
  return f.t;
};

/* ---------------- kolom sumber daya ---------------- */
const rcal = (r, P) => (r.cal ? (P.cals.find(c => c.id === r.cal) || {}) : null);
F.R = {
  id: { t: 'ID', en: 'ID', type: 'int', w: 44, al: 'c', ro, get: r => r.id },
  uid: { t: 'ID Unik', en: 'Unique ID', type: 'int', w: 70, al: 'r', ro, get: r => r.uid },
  ind: { t: 'Indikator', short: '', en: 'Indicators', type: 'ind', w: 34, al: 'c', ro, get: r => (r.over ? 1 : 0) },
  name: { t: 'Nama Sumber Daya', en: 'Name', type: 'name', w: 190, get: r => r.name, set: (r, P, s) => { const v = String(s).trim(); if (!v) throw 'Nama sumber daya harus diisi'; if (/[\[\];,]/.test(v)) throw 'Nama sumber daya tidak boleh berisi [ ] ; atau ,'; r.name = v; if (!r.ini) r.ini = v.slice(0, 1).toUpperCase(); } },
  type: { t: 'Jenis', en: 'Type', type: 'enum', w: 84, opts: F.RTYPES, get: r => r.type || 'work', fmt: v => (F.RTYPES.find(x => x[0] === v) || F.RTYPES[0])[1], set: (r, P, v) => { r.type = enumVal(F.RTYPES, v); } },
  mat: { t: 'Label Material', en: 'Material Label', type: 'text', w: 90, get: r => r.mat || '', ro: r => r.type !== 'material', set: (r, P, s) => { r.mat = String(s).trim(); } },
  ini: { t: 'Inisial', en: 'Initials', type: 'text', w: 60, get: r => r.ini || '', set: (r, P, s) => { r.ini = String(s).trim(); } },
  group: { t: 'Grup', en: 'Group', type: 'text', w: 90, get: r => r.group || '', set: (r, P, s) => { r.group = String(s).trim(); } },
  max: { t: 'Unit Maks', en: 'Max. Units', type: 'pct', w: 74, al: 'r', get: r => (r.type === 'work' ? (r.max == null ? 1 : r.max) * 100 : null), fmt: v => (v == null ? '' : U.num(v, 1) + '%'), ro: r => r.type !== 'work', set: (r, P, s) => { r.max = num(String(s).replace('%', ''), 0, 1e6) / 100; } },
  std: { t: 'Tarif Std.', en: 'Standard Rate', type: 'cost', w: 112, al: 'r', get: r => (r.std && r.std.v) || 0, fmt: (v, r, P) => (r.type === 'cost' ? '' : D.fmtRate(r.std, P, r.type === 'material')), ro: r => r.type === 'cost',
    set: (r, P, s) => { const x = D.parseRate(s, P.opts); if (!x) throw 'Tarif tidak dikenali (contoh: Rp50.000/jam, 400rb/hari)'; r.std = x; } },
  ovt: { t: 'Tarif Lembur', en: 'Overtime Rate', type: 'cost', w: 112, al: 'r', get: r => (r.ovt && r.ovt.v) || 0, fmt: (v, r, P) => (r.type === 'work' ? D.fmtRate(r.ovt, P) : ''), ro: r => r.type !== 'work',
    set: (r, P, s) => { const x = D.parseRate(s, P.opts); if (!x) throw 'Tarif tidak dikenali'; r.ovt = x; } },
  costUse: { t: 'Biaya/Pakai', en: 'Cost/Use', type: 'cost', w: 96, al: 'r', get: r => r.costUse || 0, fmt: (v, r, P) => (r.type === 'cost' ? '' : money(v, P)), ro: r => r.type === 'cost', set: (r, P, s) => { r.costUse = num(s, 0); } },
  accrue: { t: 'Akrual', en: 'Accrue At', type: 'enum', w: 80, opts: F.ACCRUE, get: r => r.accrue || 'pro', fmt: v => (F.ACCRUE.find(x => x[0] === v) || F.ACCRUE[1])[1], set: (r, P, v) => { r.accrue = enumVal(F.ACCRUE, v); } },
  cal: { t: 'Kalender Dasar', en: 'Base Calendar', type: 'enum', w: 110, get: r => r.cal || '', opts: () => [['', 'Kalender proyek'], ...AP.app.P.cals.map(c => [c.id, c.name])],
    fmt: (v, r, P) => { const c = rcal(r, P); return c ? c.name || '' : (P.cals.find(x => x.id === P.calendar) || {}).name || 'Standar'; }, ro: r => r.type !== 'work',
    set: (r, P, v) => { const c = P.cals.find(c => c.id === v || c.name.toLowerCase() === String(v).toLowerCase()); r.cal = c ? c.id : null; } },
  code: { t: 'Kode', en: 'Code', type: 'text', w: 70, get: r => r.code || '', set: (r, P, s) => { r.code = String(s).trim(); } },
  email: { t: 'Email', en: 'Email Address', type: 'text', w: 150, get: r => r.email || '', set: (r, P, s) => { r.email = String(s).trim(); } },
  work: { t: 'Kerja', en: 'Work', type: 'work', w: 84, al: 'r', ro, get: r => r.work || 0, fmt: (v, r, P) => (r.type === 'work' ? fwork(v, P) : '') },
  aWork: { t: 'Kerja Aktual', en: 'Actual Work', type: 'work', w: 84, al: 'r', ro, get: r => r.aWork || 0, fmt: (v, r, P) => (r.type === 'work' ? fwork(v, P) : '') },
  rWork: { t: 'Kerja Sisa', en: 'Remaining Work', type: 'work', w: 84, al: 'r', ro, get: r => (r.work || 0) - (r.aWork || 0), fmt: (v, r, P) => (r.type === 'work' ? fwork(v, P) : '') },
  cost: { t: 'Biaya', en: 'Cost', type: 'cost', w: 104, al: 'r', ro, get: r => r.cost || 0, fmt: money },
  aCost: { t: 'Biaya Aktual', en: 'Actual Cost', type: 'cost', w: 104, al: 'r', ro, get: r => r.aCost || 0, fmt: money },
  rCost: { t: 'Biaya Sisa', en: 'Remaining Cost', type: 'cost', w: 104, al: 'r', ro, get: r => (r.cost || 0) - (r.aCost || 0), fmt: money },
  peak: { t: 'Puncak', en: 'Peak', type: 'pct', w: 70, al: 'r', ro, get: r => (r.type === 'work' ? Math.round((r.peak || 0) * 1000) / 10 : null), fmt: v => (v == null ? '' : U.num(v, 1) + '%') },
  over: { t: 'Teralokasi Berlebih', en: 'Overallocated', type: 'flag', w: 80, al: 'c', ro, get: r => !!r.over, fmt: yesNo },
  asgN: { t: 'Jumlah Penugasan', en: 'Assignments', type: 'int', w: 80, al: 'r', ro, get: (r, P) => (P.asgR.get(r.uid) || []).length },
  generic: { t: 'Generik', en: 'Generic', type: 'flag', w: 64, al: 'c', get: r => !!r.generic, fmt: yesNo, set: (r, P, s) => { r.generic = parseFlag(s); } },
  active: { t: 'Aktif', en: 'Active', type: 'flag', w: 56, al: 'c', get: r => r.active !== false, fmt: yesNo, set: (r, P, s) => { r.active = parseFlag(s); } },
  notes: { t: 'Catatan', en: 'Notes', type: 'text', w: 200, get: r => r.notes || '', fmt: v => String(v || '').replace(/\s+/g, ' '), set: (r, P, s) => { r.notes = String(s); } },
};
for (const p of ['text', 'num']) for (let i = 1; i <= 10; i++) {
  const k = 'r' + p + i;
  F.R[k] = { t: (p === 'text' ? 'Teks' : 'Angka') + i, en: (p === 'text' ? 'Text' : 'Number') + i, type: p === 'text' ? 'text' : 'num', w: p === 'text' ? 120 : 80, al: p === 'num' ? 'r' : 'l', custom: k,
    get: r => (r.x && r.x[k] != null ? r.x[k] : p === 'num' ? null : ''), fmt: v => (v == null ? '' : p === 'num' ? U.num(v, 4) : String(v)),
    set: (r, P, s) => { r.x ||= {}; const v = p === 'num' ? (String(s).trim() === '' ? null : num(s)) : String(s); if (v == null || v === '') delete r.x[k]; else r.x[k] = v; } };
}

/* ---------------- kolom penugasan (tampilan penggunaan) ---------------- */
F.A = {
  work: { t: 'Kerja', type: 'work', get: a => a.work || 0 },
  units: { t: 'Unit', type: 'pct', get: a => a.units },
  cost: { t: 'Biaya', type: 'cost', get: a => a.costV || 0 },
  start: { t: 'Mulai', type: 'date', get: a => a.start },
  finish: { t: 'Selesai', type: 'date', get: a => a.finish },
};

/* ---------------- tabel bawaan ---------------- */
const C = (k, w) => (w ? [k, w] : [k]);
F.TABLES = {
  task: {
    entry: { t: 'Entri', cols: [C('ind'), C('mode'), C('name', 250), C('dur'), C('start'), C('finish'), C('pred'), C('rn')] },
    cost: { t: 'Biaya', cols: [C('name', 230), C('fixedCost'), C('fca'), C('cost'), C('bCost'), C('cVar'), C('aCost'), C('rCost')] },
    sched: { t: 'Jadwal', cols: [C('name', 230), C('start'), C('finish'), C('ls'), C('lf'), C('fs'), C('ts')] },
    summary: { t: 'Ringkasan', cols: [C('name', 230), C('dur'), C('start'), C('finish'), C('pct'), C('cost'), C('work')] },
    tracking: { t: 'Pelacakan', cols: [C('name', 230), C('aStart'), C('aFinish'), C('pct'), C('pwc'), C('aDur'), C('rDur'), C('aCost'), C('aWork')] },
    usage: { t: 'Penggunaan', cols: [C('ind'), C('name', 230), C('work'), C('dur'), C('start'), C('finish')] },
    variance: { t: 'Varians', cols: [C('name', 230), C('start'), C('finish'), C('bStart'), C('bFinish'), C('sVar'), C('fVar')] },
    work: { t: 'Kerja', cols: [C('name', 230), C('work'), C('bWork'), C('wVar'), C('aWork'), C('rWork'), C('pwc')] },
    baseline: { t: 'Garis Dasar', cols: [C('name', 230), C('bDur'), C('bStart'), C('bFinish'), C('bWork'), C('bCost')] },
    constraint: { t: 'Batasan Tanggal', cols: [C('name', 230), C('dur'), C('cons'), C('consDate'), C('deadline')] },
    delay: { t: 'Penundaan', cols: [C('ind'), C('name', 220), C('ld'), C('dur'), C('start'), C('finish'), C('succ'), C('rn')] },
    ev: { t: 'Nilai Hasil', cols: [C('name', 220), C('bcws'), C('bcwp'), C('acwp'), C('sv'), C('cv'), C('eac'), C('bac'), C('vac')] },
    evs: { t: 'Indikator Jadwal NH', cols: [C('name', 220), C('bcws'), C('bcwp'), C('sv'), C('spi')] },
    evc: { t: 'Indikator Biaya NH', cols: [C('name', 220), C('bcws'), C('bcwp'), C('cv'), C('cpi'), C('bac'), C('eac'), C('vac'), C('tcpi')] },
    link: { t: 'Hyperlink', cols: [C('ind'), C('name', 230), C('link', 260)] },
    export: { t: 'Ekspor Lengkap', cols: [C('wbs'), C('name', 230), C('dur'), C('start'), C('finish'), C('pred'), C('rn'), C('pct'), C('work'), C('cost'), C('bStart'), C('bFinish'), C('ts'), C('crit'), C('status'), C('notes')] },
  },
  res: {
    entry: { t: 'Entri', cols: [C('ind'), C('name'), C('type'), C('mat'), C('ini'), C('group'), C('max'), C('std'), C('ovt'), C('costUse'), C('accrue'), C('cal'), C('code')] },
    cost: { t: 'Biaya', cols: [C('name'), C('cost'), C('aCost'), C('rCost'), C('std'), C('costUse')] },
    work: { t: 'Kerja', cols: [C('name'), C('work'), C('aWork'), C('rWork'), C('peak'), C('max')] },
    summary: { t: 'Ringkasan', cols: [C('name'), C('group'), C('max'), C('peak'), C('std'), C('ovt'), C('cost'), C('work')] },
    usage: { t: 'Penggunaan', cols: [C('ind'), C('name'), C('work')] },
    contact: { t: 'Kontak', cols: [C('name'), C('ini'), C('group'), C('email', 200), C('code'), C('notes')] },
  },
};
// columns of a table (project overrides in P.view.tables[kind+':'+id])
F.cols = (P, kind, tbl) => {
  const ov = P.view && P.view.tables && P.view.tables[kind + ':' + tbl];
  const def = (F.TABLES[kind][tbl] || F.TABLES[kind].entry).cols;
  const reg = kind === 'res' ? F.R : F.T;
  return (ov || def).filter(c => reg[c[0]]).map(c => ({ k: c[0], w: c[1] || reg[c[0]].w, title: c[2] || null, al: c[3] || null, wrap: !!c[4] }));
};
F.saveCols = (P, kind, tbl, cols) => {
  P.view ||= {}; P.view.tables ||= {};
  P.view.tables[kind + ':' + tbl] = cols.map(c => [c.k, Math.round(c.w), c.title || null, c.al || null, c.wrap ? 1 : 0]);
};

/* ---------------- nilai & format umum ---------------- */
F.reg = kind => (kind === 'res' ? F.R : F.T);
F.raw = (kind, k, x, P) => { const f = F.reg(kind)[k]; if (!f) return null; try { return f.get(x, P); } catch { return null; } };
F.text = (kind, k, x, P) => {
  const f = F.reg(kind)[k];
  if (!f) return '';
  let v;
  try { v = f.get(x, P); } catch { return '#ERR'; }
  if (f.fmt) { try { return f.fmt(v, x, P); } catch { return ''; } }
  if (v == null) return '';
  if (f.type === 'int') return String(v);
  if (f.type === 'num') return U.num(v, 4);
  return String(v);
};
F.isRO = (kind, k, x, P) => { const f = F.reg(kind)[k]; if (!f || !f.set) return true; return typeof f.ro === 'function' ? !!f.ro(x, P) : !!f.ro; };
// list of all fields for pickers (Sisipkan Kolom), grouped
F.list = (kind, P) => Object.entries(F.reg(kind)).filter(([k]) => k !== 'id').map(([k, f]) => ({ k, t: F.title(k, P, kind), en: f.en, type: f.type })).sort((a, b) => U.cmpText(a.t, b.t));
// find a field by Indonesian or English title (import, formulas)
F.byName = (kind, name) => {
  const n = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  for (const [k, f] of Object.entries(F.reg(kind))) if (f.t.toLowerCase() === n || (f.en && f.en.toLowerCase() === n) || k.toLowerCase() === n) return k;
  return null;
};

/* ---------------- indikator ---------------- */
F.indicators = (t, P) => {
  if (!P || !t) return [];
  const out = [];
  if (t.root) return out;
  if (t.pct >= 100) out.push(['check_circle', 'Tugas ini selesai pada ' + fd(t.sum ? t.aFinishC || t.finish : t.aFinish != null ? t.aFinish : t.finish, P) + '.', 'ok']);
  if (!t.sum && t.cons && t.cons !== 'ASAP' && t.cons !== 'ALAP' && t.consDate != null) {
    const hard = t.cons === 'MSO' || t.cons === 'MFO' || t.cons === 'SNLT' || t.cons === 'FNLT';
    out.push([t.warn === 'cons' ? 'event_busy' : 'calendar_clock', 'Tugas ini memiliki batasan "' + F.CONS_L[t.cons] + '" pada ' + fd(t.consDate, P) + '.' + (t.warn === 'cons' ? ' Batasan bertentangan dengan tautan pendahulu.' : ''), t.warn === 'cons' ? 'bad' : hard ? 'warn' : '']);
  }
  if (t.cons === 'ALAP' && !t.sum) out.push(['schedule', 'Dijadwalkan selambat mungkin.', '']);
  if (t.deadline != null && t.finish > t.deadline + 0.5) out.push(['assignment_late', 'Tugas ini selesai setelah tenggatnya (' + fd(t.deadline, P) + ').', 'bad']);
  if (t.over) out.push(['person_alert', 'Sumber daya pada tugas ini teralokasi berlebih. Gunakan Sumber Daya › Ratakan untuk memperbaikinya.', 'bad']);
  if (t.warn === 'link') out.push(['error', 'Tugas manual ini dapat dimulai lebih lambat dari tanggalnya karena tautan pendahulu. Gunakan Hormati Tautan.', 'warn']);
  if (t.loop) out.push(['sync_problem', 'Tugas ini berada dalam ketergantungan melingkar.', 'bad']);
  if (t.cal) { const c = P.cals.find(c => c.id === t.cal); out.push(['calendar_month', 'Kalender tugas: ' + (c ? c.name : t.cal), '']); }
  if (t.recur) out.push(['repeat', 'Tugas berulang.', '']);
  if (t.inact) out.push(['block', 'Tugas tidak aktif: tidak memengaruhi jadwal, biaya, atau sumber daya.', '']);
  if (t.notes) out.push(['sticky_note_2', String(t.notes).slice(0, 300), '']);
  if (t.link) out.push(['link', t.link, '']);
  if (AP.Fx) for (const ind of AP.Fx.indicatorsFor(P, t)) out.push(ind);
  return out;
};
F.resIndicators = (r, P) => {
  const out = [];
  if (r.over) out.push(['person_alert', 'Sumber daya ini teralokasi berlebih (puncak ' + U.num((r.peak || 0) * 100, 0) + '% dari ' + U.num((r.max || 0) * 100, 0) + '%). Ratakan atau ubah penugasannya.', 'bad']);
  if (r.notes) out.push(['sticky_note_2', String(r.notes).slice(0, 300), '']);
  if (r.cal) { const c = P.cals.find(c => c.id === r.cal); out.push(['calendar_month', 'Kalender: ' + (c ? c.name : ''), '']); }
  return out;
};
})();
