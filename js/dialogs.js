// Amatu Project — dialog tugas/sumber daya/proyek: Informasi Tugas, Informasi Sumber Daya, Informasi & Statistik Proyek,
// Ubah Waktu Kerja (kalender, pengecualian, minggu kerja, libur nasional), Opsi, Tetapkan Sumber Daya, Garis Dasar,
// Perbarui Tugas/Proyek, Pindahkan Proyek/Tugas, Tanggal Status, Pemerataan, Pisahkan, Tugas Berulang, Subproyek,
// Dependensi, Periksa Tugas, Cari & Ganti, Pergi ke, Riwayat Versi.
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, M = AP.M, S = AP.S, F = AP.F, D = AP.D, Cal = AP.Cal, Store = AP.Store, V = AP.V, { el, icon, esc } = U;
const Dlg = AP.Dlg = AP.Dlg || {};
const A = () => AP.app;
const P_ = () => AP.app.P;
const fdate = t => (t == null ? 'NA' : U.fmtDate(t, P_().opts.dateFmt));
const grid2 = (...k) => el('div.fgrid', ...k);

/* ---------------- Informasi Tugas ---------------- */
Dlg.taskInfo = (t0, tab) => {
  const app = A(), P = P_();
  const t = P.byUid.get(t0.uid);
  if (!t) return;
  const ch = {};   // field → text
  const set = k => v => { ch[k] = v; };
  const inp = (k, w) => { const i = el('input.inp', { value: F.text('task', k, t, P), disabled: F.isRO('task', k, t, P) }); if (w) i.style.width = w; i.addEventListener('change', () => { ch[k] = i.value; }); return i; };
  const dt = (k, clear) => { const v = F.raw('task', k, t, P); const w = UI.dateInput(v, x => { ch[k] = x == null ? '' : U.fmtDate(x, 'dd/mm/yyyy HH.MM'); }, { clear, time: true, defTime: /finish|deadline/i.test(k) ? P.opts.dayEnd : P.opts.dayStart }); if (F.isRO('task', k, t, P)) w.input.disabled = true; return w; };
  const cb = (k, label) => UI.checkbox(label, !!F.raw('task', k, t, P), v => { ch[k] = v ? 'Ya' : 'Tidak'; }, { disabled: F.isRO('task', k, t, P) });
  // umum
  const mode = UI.radio('tmode', [['auto', 'Dijadwalkan otomatis'], ['manual', 'Dijadwalkan manual']], t.mode, v => { ch.mode = v; });
  const gen = el('div.tab-in',
    UI.field('Nama', inp('name')),
    grid2(UI.field('Durasi', inp('dur')), el('div.fcol', el('span.lbl', ' '), cb('est', 'Diperkirakan')), UI.field('% selesai', inp('pct')), UI.field('Prioritas', inp('pri'))),
    grid2(UI.field('Mulai', dt('start')), UI.field('Selesai', dt('finish')), el('div.fcol', el('span.lbl', 'Mode penjadwalan'), mode)),
    el('div.checks', cb('active', 'Aktif'), cb('tl', 'Tampilkan di Garis Waktu'), cb('hideBar', 'Sembunyikan batang'), cb('ms', 'Tandai sebagai tonggak')));
  // pendahulu
  const preds = t.pred.map(L => ({ id: (P.byUid.get(L.uid) || {}).id, name: (P.byUid.get(L.uid) || {}).name, type: L.type, lag: D.fmtLag(L, P.opts) || '0 hari', uid: L.uid }));
  const predTbl = UI.miniTable([
    { k: 'id', t: 'ID', w: 60, parse: v => { const n = parseInt(v, 10); const x = P.tasks[n - 1]; if (!x) throw 'ID ' + v + ' tidak ada'; return n; }, onSet: (r, v) => { const x = P.tasks[v - 1]; r.name = x.name; r.uid = x.uid; predTbl.redraw(); } },
    { k: 'name', t: 'Nama Tugas', ro: true },
    { k: 'type', t: 'Jenis', w: 190, type: 'select', opts: D.TYPES.map(k => [k, D.TYPE_L[k]]) },
    { k: 'lag', t: 'Lag', w: 100, parse: v => { if (!D.parseLag(v, P.opts)) throw 'Lag tidak dikenali (contoh: 2 hari, -1h, 50%)'; return v; } },
  ], preds, () => { ch.__pred = true; }, { add: () => ({ id: '', name: '', type: 'FS', lag: '0 hari' }), addLabel: 'Tambah pendahulu' });
  // sumber daya
  const asg = (P.asgT.get(t.uid) || []).map(a => { const r = P.resByUid.get(a.r); return { r: r.uid, units: r.type === 'work' ? U.num(a.units * 100, 1) + '%' : r.type === 'material' ? U.num(a.units, 2) : U.money(a.cost, P), cost: a.costV }; });
  const resOpts = () => [['', '—'], ...P.res.map(r => [String(r.uid), r.name + (r.type === 'work' ? '' : r.type === 'material' ? ' (material)' : ' (biaya)')])];
  const resTbl = UI.miniTable([
    { k: 'r', t: 'Nama Sumber Daya', type: 'select', opts: resOpts, onSet: r => { const x = P.resByUid.get(+r.r); if (x) r.units = x.type === 'work' ? '100%' : x.type === 'material' ? '1' : 'Rp0'; resTbl.redraw(); } },
    { k: 'units', t: 'Unit / Jumlah / Biaya', w: 150 },
    { k: 'cost', t: 'Biaya', w: 120, ro: true, fmt: v => (v == null ? '' : U.money(v, P)) },
  ], asg, () => { ch.__asg = true; }, { add: () => ({ r: '', units: '100%' }), addLabel: 'Tambah sumber daya' });
  // lanjutan
  const consSel = UI.select(F.CONS, t.cons || 'ASAP', v => { ch.cons = v; });
  const typeSel = UI.select(F.TYPES, t.type || 'FU', v => { ch.type = v; });
  const calSel = UI.select([['', 'Tidak ada'], ...P.cals.map(c => [c.id, c.name])], t.cal || '', v => { ch.cal = v; });
  const fcaSel = UI.select(F.ACCRUE, t.fca || 'pro', v => { ch.fca = v; });
  const adv = el('div.tab-in',
    grid2(UI.field('Tenggat', dt('deadline', true)), UI.field('Kode WBS', inp('wbs'))),
    grid2(UI.field('Jenis batasan', consSel), UI.field('Tanggal batasan', dt('consDate', true))),
    grid2(UI.field('Jenis tugas', typeSel), el('div.fcol', el('span.lbl', ' '), cb('effort', 'Didorong upaya')), UI.field('Kalender', calSel)),
    grid2(UI.field('Biaya tetap', inp('fixedCost')), UI.field('Akrual biaya tetap', fcaSel), UI.field('Penundaan pemerataan', inp('ld'))),
    t.sum ? el('p.hint', 'Tugas ringkasan: tanggal, durasi, kerja dan biaya dihitung dari subtugasnya.') : null);
  // catatan
  const notes = el('textarea.inp.notes', { rows: 12, value: t.notes || '', placeholder: 'Catatan untuk tugas ini…' });
  notes.addEventListener('input', () => { ch.notes = notes.value; });
  const link = el('input.inp', { value: t.link || '', placeholder: 'https://…' });
  link.addEventListener('change', () => { ch.link = link.value; });
  const notesTab = el('div.tab-in', notes, UI.field('Hyperlink', link));
  // kolom kustom
  const cust = el('div.tab-in.cust');
  const used = Object.keys(F.T).filter(k => F.T[k].custom && ((P.fields[F.T[k].custom] && P.fields[F.T[k].custom].name) || (t.x && t.x[F.T[k].custom] != null)));
  const show = used.length ? used : ['text1', 'text2', 'text3', 'num1', 'num2', 'flag1', 'flag2', 'date1', 'cost1'];
  cust.append(el('div.fgrid.g3', ...show.map(k => UI.field(F.title(k, P), F.T[k].type === 'flag' ? cb(k, 'Ya') : inp(k)))), el('p.hint', 'Ganti nama kolom kustom di Proyek › Kolom Kustom.'));
  const tabs = UI.tabs([
    { label: 'Umum', body: gen }, { label: 'Pendahulu', body: el('div.tab-in', predTbl) }, { label: 'Sumber Daya', body: el('div.tab-in', resTbl, el('p.hint', 'Unit 100% = satu orang penuh waktu. Material: jumlah (mis. 10). Sumber daya biaya: nominal (mis. Rp500.000).')) },
    { label: 'Lanjutan', body: adv }, { label: 'Catatan', body: notesTab }, { label: 'Kolom Kustom', body: cust },
  ]);
  if (tab === 'notes') tabs.show(4); else if (tab === 'pred') tabs.show(1); else if (tab === 'res') tabs.show(2);
  UI.dialog({
    title: (t.sum ? 'Informasi Tugas Ringkasan' : 'Informasi Tugas') + ' · ID ' + t.id, width: 'min(720px, 100%)', cls: 'tinfo', body: tabs,
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      const keys = Object.keys(ch);
      if (!keys.length) return;
      const ok = app.tx('Informasi tugas', P2 => {
        S.calc(P2);
        const x = P2.byUid.get(t.uid);
        const order = ['name', 'mode', 'type', 'effort', 'cal', 'dur', 'est', 'start', 'finish', 'cons', 'consDate', 'deadline', 'pct', 'pri', 'active', 'tl', 'hideBar', 'ms', 'wbs', 'fixedCost', 'fca', 'ld', 'notes', 'link'];
        const rest = keys.filter(k => !order.includes(k) && !k.startsWith('__'));
        for (const k of [...order.filter(k => k in ch), ...rest]) {
          const f = F.T[k];
          if (!f || !f.set) continue;
          if (k === 'notes') { x.notes = ch.notes; continue; }
          f.set(x, P2, ch[k], P2._ctx);
          M.index(P2); S.calc(P2);
        }
        if (ch.__pred) {
          const list = [];
          for (const r of preds) {
            if (!r.uid) continue;
            const p = P2.byUid.get(r.uid);
            if (!p || p === x) continue;
            if (M.isAncestor(p, x) || M.isAncestor(x, p)) throw 'Tugas ringkasan tidak dapat ditautkan ke subtugasnya sendiri';
            const lg = D.parseLag(r.lag, P2.opts) || { lag: 0, lagU: 'd', pct: null, el: false };
            if (!list.some(q => q.uid === r.uid)) list.push({ uid: r.uid, type: r.type, ...lg });
          }
          x.pred = [];
          M.index(P2);
          for (const L of list) { if (M.wouldLoop(P2, P2.byUid.get(L.uid), x)) throw 'Tautan ke ID ' + P2.byUid.get(L.uid).id + ' membuat ketergantungan melingkar'; x.pred.push(L); M.index(P2); }
        }
        if (ch.__asg) {
          M.index(P2);
          const want = asg.filter(r => r.r);
          for (const a of (P2.asgT.get(x.uid) || []).slice()) if (!want.some(w => +w.r === a.r)) M.unassign(P2, x, P2.resByUid.get(a.r));
          for (const w of want) {
            const r = P2.resByUid.get(+w.r);
            if (!r) continue;
            const v = U.parseNum(String(w.units).replace('%', ''));
            if (r.type === 'work') M.assign(P2, x, r, { units: isFinite(v) ? v / 100 : 1 });
            else if (r.type === 'material') M.assign(P2, x, r, { qty: isFinite(v) ? v : 1 });
            else M.assign(P2, x, r, { cost: isFinite(v) ? v : 0 });
          }
        }
      });
      if (!ok) return false;
    } }],
  });
};

/* ---------------- Informasi Sumber Daya ---------------- */
Dlg.resInfo = (r0, tab) => {
  const app = A(), P = P_();
  const r = P.resByUid.get(r0.uid);
  if (!r) return;
  const ch = {};
  const inp = k => { const i = el('input.inp', { value: F.text('res', k, r, P), disabled: F.isRO('res', k, r, P) }); i.addEventListener('change', () => { ch[k] = i.value; }); return i; };
  const type = UI.select(F.RTYPES, r.type, v => { ch.type = v; });
  const acc = UI.select(F.ACCRUE, r.accrue || 'pro', v => { ch.accrue = v; });
  const cal = UI.select([['', 'Kalender proyek'], ...P.cals.map(c => [c.id, c.name])], r.cal || '', v => { ch.cal = v; });
  const gen = el('div.tab-in',
    grid2(UI.field('Nama sumber daya', inp('name')), UI.field('Inisial', inp('ini'))),
    grid2(UI.field('Email', inp('email')), UI.field('Grup', inp('group')), UI.field('Kode', inp('code'))),
    grid2(UI.field('Jenis', type), UI.field('Label material', inp('mat')), UI.field('Unit maksimum', inp('max'))),
    el('div.checks', UI.checkbox('Generik', !!r.generic, v => { ch.generic = v ? 'Ya' : 'Tidak'; }), UI.checkbox('Aktif', r.active !== false, v => { ch.active = v ? 'Ya' : 'Tidak'; })),
    el('div.frow', UI.field('Kalender dasar', cal), el('button.btn', { type: 'button', onclick: () => Dlg.workTime(null, r) }, icon('schedule'), 'Ubah Waktu Kerja…')));
  const cost = el('div.tab-in', grid2(UI.field('Tarif standar', inp('std')), UI.field('Tarif lembur', inp('ovt'))), grid2(UI.field('Biaya per pemakaian', inp('costUse')), UI.field('Akrual biaya', acc)),
    el('p.hint', 'Contoh tarif: Rp50.000/jam, 400rb/hari, 8jt/bln. Material: harga per unit (mis. Rp70.000 per sak).'));
  const notes = el('textarea.inp.notes', { rows: 10, value: r.notes || '' });
  notes.addEventListener('input', () => { ch.notes = notes.value; });
  const asgList = el('div.tab-in', el('table.mt-list', el('thead', el('tr', el('th', 'ID'), el('th', 'Tugas'), el('th', 'Unit'), el('th', 'Kerja'), el('th', 'Mulai'), el('th', 'Selesai'))),
    el('tbody', ...(P.asgR.get(r.uid) || []).map(a => { const t = P.byUid.get(a.t); return el('tr', el('td', t.id), el('td', t.name), el('td', r.type === 'work' ? U.num(a.units * 100, 1) + '%' : U.num(a.units, 2)), el('td', r.type === 'work' ? D.fmtWork(a.work, P.opts) : ''), el('td', fdate(a.start)), el('td', fdate(a.finish))); }))));
  const tabs = UI.tabs([{ label: 'Umum', body: gen }, { label: 'Biaya', body: cost }, { label: 'Penugasan', body: asgList }, { label: 'Catatan', body: el('div.tab-in', notes) }]);
  if (tab === 'notes') tabs.show(3);
  UI.dialog({ title: 'Informasi Sumber Daya · ' + r.name, width: 'min(680px, 100%)', body: tabs, buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
    if (!Object.keys(ch).length) return;
    if (!app.tx('Informasi sumber daya', P2 => {
      const x = P2.resByUid.get(r.uid);
      for (const k of ['type', 'name', 'ini', 'email', 'group', 'code', 'mat', 'max', 'generic', 'active', 'cal', 'std', 'ovt', 'costUse', 'accrue']) if (k in ch) F.R[k].set(x, P2, ch[k]);
      if ('notes' in ch) x.notes = ch.notes;
    })) return false;
  } }] });
};

/* ---------------- Informasi Proyek ---------------- */
Dlg.projectInfo = () => {
  const app = A(), P = P_();
  let fromFinish = !!P.fromFinish, start = P.start, finish = P.root ? P.root.finish : P.finish, cur = P.currentDate, sd = P.statusDate, cal = P.calendar, pri = P.priority;
  const props = { ...P.props };
  const sIn = UI.dateInput(start, v => { start = v; }, { time: true, defTime: P.opts.dayStart });
  const fIn = UI.dateInput(finish, v => { finish = v; }, { time: true, defTime: P.opts.dayEnd });
  const upd = () => { sIn.input.disabled = fromFinish; fIn.input.disabled = !fromFinish; };
  const from = UI.select([['start', 'Tanggal Mulai Proyek'], ['finish', 'Tanggal Selesai Proyek']], fromFinish ? 'finish' : 'start', v => { fromFinish = v === 'finish'; upd(); });
  const cIn = UI.dateInput(cur, v => { cur = v; }, { clear: true, time: true });
  const sdIn = UI.dateInput(sd, v => { sd = v; }, { clear: true, time: true, defTime: P.opts.dayEnd });
  const calSel = UI.select(P.cals.map(c => [c.id, c.name]), cal, v => { cal = v; });
  const priIn = el('input.inp', { type: 'number', min: 0, max: 1000, value: pri });
  upd();
  const pf = (k, label) => { const i = el('input.inp', { value: props[k] || '' }); i.addEventListener('change', () => { props[k] = i.value; }); return UI.field(label, i); };
  const com = el('textarea.inp', { rows: 3, value: props.comments || '' });
  com.addEventListener('change', () => { props.comments = com.value; });
  UI.dialog({
    title: 'Informasi Proyek · ' + P.name, width: 'min(720px, 100%)',
    body: el('div',
      grid2(UI.field('Tanggal mulai', sIn), UI.field('Tanggal selesai', fIn), UI.field('Jadwalkan dari', from)),
      grid2(UI.field('Tanggal saat ini', cIn), UI.field('Tanggal status', sdIn), UI.field('Kalender', calSel), UI.field('Prioritas', priIn)),
      el('p.hint', fromFinish ? 'Dijadwalkan dari tanggal selesai: semua tugas mulai selambat mungkin.' : 'Dijadwalkan dari tanggal mulai: semua tugas mulai secepat mungkin. Tanggal saat ini kosong = hari ini.'),
      el('h4', 'Properti'),
      grid2(pf('title', 'Judul'), pf('subject', 'Subjek'), pf('manager', 'Manajer')),
      grid2(pf('author', 'Penulis'), pf('company', 'Perusahaan'), pf('category', 'Kategori')),
      UI.field('Komentar', com)),
    buttons: [{ label: 'Statistik…', left: true, icon: 'query_stats', run: () => { Dlg.stats(); return false; } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      app.tx('Informasi proyek', P2 => {
        P2.fromFinish = fromFinish;
        if (fromFinish) P2.finish = finish; else P2.start = start;
        P2.currentDate = cur; P2.statusDate = sd; P2.calendar = cal; P2.priority = U.clamp(+priIn.value || 500, 0, 1000);
        P2.props = props;
        if (props.title && props.title.trim()) P2.name = props.title.trim();
      });
      U.$('#doc-title').value = app.P.name;
    } }],
  });
};
Dlg.stats = () => {
  const P = P_(), R = P.root, b = (R.bl && R.bl[0]) || null;
  const fd = t => (t == null ? 'NA' : U.fmtDate(t, 'dd mmm yyyy'));
  const dur = v => (v == null ? 'NA' : D.fmtDur(v, 'd', P.opts));
  const row = (a, ...c) => el('tr', el('th', a), ...c.map(x => el('td', x)));
  const pctDur = R.pct, pctWork = R.pwc;
  UI.dialog({ title: 'Statistik Proyek · ' + P.name, width: 'min(680px, 100%)', body: el('div',
    el('table.stats',
      el('thead', el('tr', el('th', ''), el('th', 'Mulai'), el('th', 'Selesai'))),
      el('tbody', row('Saat ini', fd(R.start), fd(R.finish)), row('Garis dasar', fd(b && b.s), fd(b && b.f)), row('Aktual', fd(R.aStartC || (R.pct > 0 ? R.start : null)), fd(R.pct >= 100 ? R.finish : null)), row('Varians', b ? D.fmtDur(P._ctx.signed(P.calendar, b.s, R.start), 'd', P.opts) : 'NA', b ? D.fmtDur(P._ctx.signed(P.calendar, b.f, R.finish), 'd', P.opts) : 'NA'))),
    el('table.stats',
      el('thead', el('tr', el('th', ''), el('th', 'Durasi'), el('th', 'Kerja'), el('th', 'Biaya'))),
      el('tbody', row('Saat ini', dur(R.sdur), D.fmtWork(R.work, P.opts), U.money(R.cost, P)), row('Garis dasar', dur(b && b.d), b ? D.fmtWork(b.w, P.opts) : 'NA', b ? U.money(b.c, P) : 'NA'), row('Aktual', dur(R.aDur), D.fmtWork(R.aWork, P.opts), U.money(R.aCost, P)), row('Sisa', dur(R.rDur), D.fmtWork(R.rWork, P.opts), U.money(R.rCost, P)))),
    el('div.stats-pct', el('div', el('span', 'Persentase selesai'), el('b', U.num(pctDur, 0) + '% (durasi)')), el('div', el('span', 'Kerja selesai'), el('b', U.num(pctWork, 0) + '%')),
      el('div', el('span', 'Tugas'), el('b', P.tasks.filter(t => !t.sum).length + ' (' + P.tasks.filter(t => !t.sum && t.pct >= 100).length + ' selesai)')), el('div', el('span', 'Tugas kritis'), el('b', String(P.tasks.filter(t => !t.sum && t.crit).length)))),
  ), buttons: [{ label: 'Tutup', primary: true }] });
};

/* ---------------- Ubah Waktu Kerja ---------------- */
Dlg.workTime = (calId, res) => {
  const app = A();
  let P = U.deep(M.clean(P_()));   // edit on a copy, applied on OK
  P = M.fix(P);
  if (res) {
    // a resource gets its own calendar based on its base calendar (as in Project)
    const r = P.res.find(x => x.uid === res.uid);
    if (r && (!r.cal || !(P.cals.find(c => c.id === r.cal) || {}).own)) {
      const base = r.cal || P.calendar;
      const c = Cal.make('r' + r.uid + '_' + U.uid().slice(-4), r.name, base);
      c.own = r.uid;
      P.cals.push(c);
      r.cal = c.id;
    }
    calId = r && r.cal;
  }
  let cur = calId || P.calendar;
  let view = U.ymd(U.today()), selDay = U.today() / 1440 | 0;
  const box = el('div.wt');
  const C = () => P.cals.find(c => c.id === cur);
  const ctx = () => Cal.ctx(P);
  const draw = () => {
    const c = C(), X = ctx();
    const calSel = UI.select(P.cals.filter(k => !k.own || (res && k.own === res.uid)).map(k => [k.id, k.name + (k.id === P.calendar ? ' (kalender proyek)' : k.base ? ' — berdasarkan ' + ((P.cals.find(b => b.id === k.base) || {}).name || '?') : '')]), cur, v => { cur = v; draw(); });
    const tools = el('div.wt-tools', calSel,
      el('button.btn.sm', { type: 'button', onclick: async () => { const n = await UI.prompt('Kalender baru', 'Nama kalender', 'Kalender ' + (P.cals.length + 1)); if (!n) return; const k = { ...U.deep(C()), id: U.uid('c'), name: n.trim(), own: null }; P.cals.push(k); cur = k.id; draw(); } }, icon('add'), 'Buat Kalender'),
      el('button.btn.sm', { type: 'button', disabled: !!C().own, onclick: async () => { const n = await UI.prompt('Ganti nama kalender', 'Nama', C().name); if (n) { C().name = n.trim(); draw(); } } }, icon('edit'), 'Ganti Nama'),
      el('button.btn.sm', { type: 'button', disabled: P.cals.length <= 1 || cur === P.calendar || !!C().own, onclick: async () => { if (!(await UI.confirm('Hapus kalender "' + C().name + '"? Tugas/sumber daya yang memakainya kembali ke kalender proyek.', { ok: 'Hapus', danger: true }))) return; const id = cur; P.cals = P.cals.filter(k => k.id !== id); for (const t of P.tasks) if (t.cal === id) t.cal = null; for (const r of P.res) if (r.cal === id) r.cal = null; for (const k of P.cals) if (k.base === id) k.base = null; cur = P.calendar; draw(); } }, icon('delete'), 'Hapus'),
      el('button.btn.sm', { type: 'button', disabled: cur === P.calendar || !!C().own, onclick: () => { P.calendar = cur; draw(); } }, icon('star'), 'Jadikan Kalender Proyek'));
    // month
    const first = U.mk(view.y, view.m, 1), ws = P.opts.weekStart;
    const off = ((U.ymd(first).dow - ws) + 7) % 7;
    const mon = el('div.wt-mon');
    mon.append(el('div.wt-mh', el('button.icon-btn.sm', { type: 'button', onclick: () => { view = U.ymd(U.mk(view.y, view.m - 1, 1)); draw(); } }, icon('chevron_left')), el('b', U.MON_L[view.m] + ' ' + view.y), el('button.icon-btn.sm', { type: 'button', onclick: () => { view = U.ymd(U.mk(view.y, view.m + 1, 1)); draw(); } }, icon('chevron_right'))));
    const g = el('div.wt-grid');
    for (let i = 0; i < 7; i++) g.append(el('span.wt-dow', U.DOW_S[(ws + i) % 7]));
    for (let i = 0; i < 42; i++) {
      const di = Math.floor(first / 1440) + i - off, a = U.ymd(di * 1440);
      const iv = X.iv(cur, di), work = Cal.ivLen(iv);
      const exc = (c.exc || []).find(e => Cal.hits(e, di));
      const std = work === Cal.ivLen(X.iv(P.calendar === cur ? '__none' : P.calendar, di));
      const cls = (a.m !== view.m ? '.out' : '') + (work ? '.work' : '.off') + (exc ? '.exc' : '') + (di === selDay ? '.on' : '') + (di === Math.floor(U.today() / 1440) ? '.today' : '');
      g.append(el('button.wt-d' + cls, { type: 'button', 'data-tip': (exc ? exc.name + ' · ' : '') + (work ? 'Kerja ' + iv.map(([s, e]) => U.hm(s) + '–' + U.hm(e)).join(', ') : 'Tidak bekerja'), onclick: () => { selDay = di; draw(); } }, String(a.d)));
      void std;
    }
    mon.append(g, el('div.wt-leg', el('span.lg.work', 'Kerja'), el('span.lg.off', 'Libur'), el('span.lg.exc', 'Pengecualian'), el('span.lg.today', 'Hari ini')));
    // day info
    const iv = X.iv(cur, selDay);
    const info = el('div.wt-info', el('b', U.fmtDate(selDay * 1440, 'dddd, dd mmmm yyyy')), el('div', iv.length ? 'Jam kerja: ' + iv.map(([s, e]) => U.hm(s) + '–' + U.hm(e)).join(', ') + ' (' + D.fmtWork(Cal.ivLen(iv), P.opts) + ')' : 'Hari tidak bekerja'),
      el('div.wt-quick',
        el('button.btn.sm', { type: 'button', onclick: () => { c.exc.push({ name: 'Libur', from: selDay, to: selDay, work: [] }); draw(); } }, icon('event_busy'), 'Jadikan Libur'),
        el('button.btn.sm', { type: 'button', onclick: () => { c.exc.push({ name: 'Hari kerja khusus', from: selDay, to: selDay, work: U.deep(Cal.STD_DAY) }); draw(); } }, icon('work'), 'Jadikan Hari Kerja')));
    // exceptions table
    const exc = c.exc || (c.exc = []);
    const excRows = exc.map(e => ({ e, name: e.name, from: U.fmtDate(e.from * 1440, 'dd/mm/yyyy'), to: U.fmtDate(e.to * 1440, 'dd/mm/yyyy'), kind: e.work && e.work.length ? 'work' : 'off', times: e.work && e.work.length ? e.work.map(([s, f]) => U.hm(s) + '-' + U.hm(f)).join(', ') : '', rec: e.rec ? e.rec.t : '' }));
    const parseTimes = s => { const out = []; for (const part of String(s).split(/[,;]/)) { const m = /^\s*(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})\s*$/.exec(part); if (m) out.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]); else if (part.trim()) throw 'Jam tidak dikenali: ' + part + ' (contoh: 08.00-12.00, 13.00-17.00)'; } return Cal.normIv(out); };
    const pd = s => { const v = U.parseDate(s, 0); if (!isFinite(v)) throw 'Tanggal tidak dikenali: ' + s; return v; };
    const excTbl = UI.miniTable([
      { k: 'name', t: 'Nama', w: 200, onSet: (r, v) => { r.e.name = v; } },
      { k: 'from', t: 'Mulai', w: 104, parse: s => { pd(s); return s; }, onSet: (r, v) => { r.e.from = Math.floor(pd(v) / 1440); if (r.e.to < r.e.from) r.e.to = r.e.from; draw(); } },
      { k: 'to', t: 'Selesai', w: 104, parse: s => { pd(s); return s; }, onSet: (r, v) => { r.e.to = Math.max(r.e.from, Math.floor(pd(v) / 1440)); draw(); } },
      { k: 'kind', t: 'Jenis', w: 110, type: 'select', opts: [['off', 'Tidak bekerja'], ['work', 'Bekerja']], onSet: (r, v) => { r.e.work = v === 'work' ? U.deep(Cal.STD_DAY) : []; draw(); } },
      { k: 'times', t: 'Jam kerja', w: 150, parse: s => { parseTimes(s); return s; }, onSet: (r, v) => { r.e.work = parseTimes(v); draw(); } },
      { k: 'rec', t: 'Berulang', w: 100, type: 'select', opts: [['', 'Tidak'], ['y', 'Tiap tahun'], ['m', 'Tiap bulan'], ['w', 'Tiap minggu']], onSet: (r, v) => { r.e.rec = v ? { t: v } : null; if (v && r.e.to === r.e.from) r.e.to = r.e.from + 3650; draw(); } },
    ], excRows, rows => { c.exc = rows.map(r => r.e); draw(); }, { add: () => { const e = { name: 'Pengecualian baru', from: selDay, to: selDay, work: [] }; return { e, name: e.name, from: U.fmtDate(selDay * 1440, 'dd/mm/yyyy'), to: U.fmtDate(selDay * 1440, 'dd/mm/yyyy'), kind: 'off', times: '', rec: '' }; }, addLabel: 'Tambah pengecualian' });
    // work week
    const wk = el('div.wt-week');
    for (let i = 0; i < 7; i++) {
      const dow = (ws + i) % 7;
      const day = c.week ? c.week[dow] : null;
      const inherit = day == null;
      const val = inherit ? null : day;
      const times = el('input.inp.sm', { value: val && val.length ? val.map(([s, e]) => U.hm(s) + '-' + U.hm(e)).join(', ') : '', placeholder: inherit ? 'ikut kalender dasar' : 'libur', disabled: inherit || (val && !val.length) });
      const modeSel = UI.select([...(c.base ? [['inh', 'Ikut kalender dasar']] : []), ['work', 'Bekerja'], ['off', 'Tidak bekerja']], inherit ? 'inh' : val.length ? 'work' : 'off', v => {
        c.week ||= [null, null, null, null, null, null, null];
        c.week[dow] = v === 'inh' ? null : v === 'off' ? [] : U.deep(Cal.STD_DAY);
        draw();
      });
      times.addEventListener('change', () => { try { c.week[dow] = parseTimes(times.value); draw(); } catch (e) { UI.toast(String(e), { kind: 'bad' }); } });
      wk.append(el('div.wt-wd', el('b', U.DOW_L[dow]), modeSel, times));
    }
    const holi = el('div.wt-holi',
      el('b', 'Libur nasional Indonesia'),
      ...[U.ymd(U.today()).y, U.ymd(U.today()).y + 1].map(y => el('button.btn.sm', { type: 'button', onclick: () => holidayDlg(c, y, draw) }, icon('flag'), 'Tambahkan ' + y)));
    box.replaceChildren(tools, el('div.wt-body', mon, el('div.wt-side', info, holi)),
      UI.tabs([{ label: 'Pengecualian (' + exc.length + ')', body: el('div.tab-in', excTbl) }, { label: 'Minggu Kerja', body: el('div.tab-in', wk, el('p.hint', 'Jam kerja dipisah koma, mis. 08.00-12.00, 13.00-17.00. Untuk jadwal minggu berbeda pada periode tertentu, buat kalender baru dan pakai sebagai kalender tugas.')) }]));
  };
  draw();
  UI.dialog({ title: res ? 'Ubah Waktu Kerja · ' + res.name : 'Ubah Waktu Kerja', width: 'min(980px, 100%)', cls: 'wtdlg', body: box, buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
    app.tx('Ubah waktu kerja', P2 => { P2.cals = P.cals; P2.calendar = P.calendar; for (const r of P2.res) { const x = P.res.find(q => q.uid === r.uid); if (x) r.cal = x.cal; } for (const t of P2.tasks) { const x = P.tasks.find(q => q.uid === t.uid); if (x) t.cal = x.cal; } });
  } }] });
};
function holidayDlg(c, y, redraw) {
  const list = Cal.holidaysID(y);
  const pick = new Set(list.map((h, i) => i));
  const has = h => (c.exc || []).some(e => e.from === h.di && e.to === h.di);
  const box = el('div.holi-list', ...list.map((h, i) => UI.checkbox(U.fmtDate(h.di * 1440, 'ddd dd mmm yyyy') + ' — ' + h.n + (has(h) ? ' (sudah ada)' : ''), !has(h), v => { if (v) pick.add(i); else pick.delete(i); })));
  for (const [i, h] of list.entries()) if (has(h)) pick.delete(i);
  UI.dialog({ title: 'Libur nasional ' + y, width: '520px', body: el('div', box, el('p.hint', AP.Cal.LUNAR_YEARS.includes(y) ? 'Tanggal hari raya berbasis kalender bulan mengikuti SKB yang diumumkan; yang ditandai "perkiraan" sebaiknya dicek ulang.' : 'Untuk tahun ini hanya libur bertanggal tetap dan hari raya Kristen (dihitung) yang tersedia; tambahkan hari raya lain secara manual.')),
    buttons: [{ label: 'Batal' }, { label: 'Tambahkan', primary: true, run: () => { c.exc ||= []; for (const i of pick) { const h = list[i]; c.exc.push({ name: h.n, from: h.di, to: h.di, work: [] }); } c.exc.sort((a, b) => a.from - b.from); redraw(); UI.toast(pick.size + ' hari libur ditambahkan'); } }] });
}

/* ---------------- Opsi ---------------- */
Dlg.options = () => {
  const app = A(), P = P_();
  const o = U.deep(P.opts);
  const num = (k, lo, hi, step = 1) => { const i = el('input.inp', { type: 'number', min: lo, max: hi, step, value: o[k] }); i.addEventListener('change', () => { o[k] = U.clamp(+i.value || 0, lo, hi); }); return i; };
  const sel = (k, opts) => UI.select(opts, String(o[k]), v => { o[k] = typeof o[k] === 'number' ? +v : v === 'true' ? true : v === 'false' ? false : v; });
  const ck = (k, label) => UI.checkbox(label, !!o[k], v => { o[k] = v; });
  const time = k => { const i = el('input.inp', { type: 'time', value: U.hmColon(o[k]) }); i.addEventListener('change', () => { const [h, m] = i.value.split(':').map(Number); o[k] = h * 60 + m; }); return i; };
  const theme = UI.select([['auto', 'Ikuti sistem'], ['light', 'Terang'], ['dark', 'Gelap']], app.theme(), v => { Store.pref('theme', v); app.applyTheme(); });
  const gen = el('div.tab-in',
    grid2(UI.field('Tema', theme), UI.field('Format tanggal', UI.select(U.DATE_FORMATS.map(([f, ex]) => [f, ex]), o.dateFmt, v => { o.dateFmt = v; }))),
    grid2(UI.field('Simbol mata uang', (() => { const i = el('input.inp', { value: o.cur }); i.addEventListener('change', () => { o.cur = i.value; }); return i; })()), UI.field('Desimal', num('curDec', 0, 4)), UI.field('Posisi simbol', sel('curPos', [['before', 'Sebelum (Rp1.000)'], ['after', 'Sesudah (1.000 Rp)']]))),
    grid2(UI.field('Tinggi baris (px)', num('rowH', 18, 48)), el('div')));
  const sch = el('div.tab-in',
    grid2(UI.field('Minggu dimulai hari', sel('weekStart', U.DOW_L.map((d, i) => [String(i), d]))), UI.field('Tahun fiskal mulai', sel('fyStart', U.MON_L.map((m, i) => [String(i), m])))),
    grid2(UI.field('Jam mulai default', time('dayStart')), UI.field('Jam selesai default', time('dayEnd'))),
    grid2(UI.field('Jam per hari', num('hpd', 1, 24, 0.5)), UI.field('Jam per minggu', num('hpw', 1, 168, 0.5)), UI.field('Hari per bulan', num('dpm', 1, 31))),
    grid2(UI.field('Satuan durasi', sel('durU', [['m', 'Menit'], ['h', 'Jam'], ['d', 'Hari'], ['w', 'Minggu'], ['mo', 'Bulan']])), UI.field('Satuan kerja', sel('workU', [['m', 'Menit'], ['h', 'Jam'], ['d', 'Hari'], ['w', 'Minggu']])), UI.field('Jenis tugas default', sel('taskType', F.TYPES))),
    el('div.checks', ck('newAuto', 'Tugas baru dijadwalkan otomatis'), ck('autoOnToday', 'Tugas otomatis dijadwalkan mulai tanggal hari ini (bukan tanggal mulai proyek)'), ck('effort', 'Tugas baru didorong upaya'), ck('autoLink', 'Tautkan otomatis tugas yang disisipkan atau dipindah'), ck('split', 'Pisahkan tugas yang sedang berjalan'), ck('honor', 'Tugas selalu mematuhi tanggal batasannya'), ck('estimated', 'Tampilkan "?" untuk durasi perkiraan tugas baru')),
    el('p.hint', 'Mengubah jam per hari / minggu / bulan mengubah arti "1 hari" pada semua durasi.'));
  const calc = el('div.tab-in',
    grid2(UI.field('Perhitungan', sel('calc', [['auto', 'Otomatis'], ['manual', 'Manual (tekan F9)']])), UI.field('Tugas kritis bila slack ≤ (hari)', num('critSlack', 0, 100))),
    el('div.checks', ck('multiCrit', 'Hitung beberapa jalur kritis'), ck('updateStatus', 'Perbarui status tugas memperbarui status sumber daya')));
  const vw = el('div.tab-in', el('div.checks', ck('showSum', 'Tampilkan tugas ringkasan'), ck('projSum', 'Tampilkan tugas ringkasan proyek (ID 0)'), ck('outlineNum', 'Tampilkan nomor kerangka di nama tugas')));
  UI.dialog({ title: 'Opsi Amatu Project', width: 'min(700px, 100%)', body: UI.tabs([{ label: 'Umum', body: gen }, { label: 'Jadwal', body: sch }, { label: 'Perhitungan', body: calc }, { label: 'Tampilan', body: vw }]),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { app.tx('Opsi', P2 => { const conv = P2.opts.hpd !== o.hpd; P2.opts = o; if (conv) UI.toast('Jam per hari berubah: durasi dalam hari dihitung ulang'); }); } }] });
};

/* ---------------- Tetapkan Sumber Daya (tidak modal) ---------------- */
let assignBox = null;
Dlg.assign = () => {
  const app = A();
  if (assignBox) { assignBox.close(); assignBox = null; }
  const body = el('div.asgdlg');
  let q = '';
  const draw = () => {
    const P = P_();
    const sel = app.selTasks().filter(t => !t.sum);
    const head = el('div.asg-head', sel.length ? el('span', icon('task'), sel.length === 1 ? 'Tugas: ' + sel[0].name : sel.length + ' tugas dipilih') : el('span.hint', 'Pilih tugas di Bagan Gantt untuk menetapkan sumber daya'),
      el('input.inp.sm', { type: 'search', placeholder: 'Cari sumber daya', value: q, oninput: e => { q = e.target.value; draw(); } }));
    const list = el('div.asg-list');
    const rs = P.res.filter(r => r.active !== false && (!q || r.name.toLowerCase().includes(q.toLowerCase())));
    for (const r of rs) {
      const as = sel.map(t => (P.asgT.get(t.uid) || []).find(a => a.r === r.uid)).filter(Boolean);
      const allOn = sel.length && as.length === sel.length, some = as.length > 0;
      const units = el('input.inp.sm.asg-u', { value: r.type === 'work' ? (as[0] ? U.num(as[0].units * 100, 1) + '%' : U.num((r.max || 1) * 100, 0) + '%') : r.type === 'material' ? (as[0] ? U.num(as[0].units, 2) : '1') : (as[0] ? U.money(as[0].cost, P) : ''), placeholder: r.type === 'cost' ? 'Rp' : '' });
      const ck = el('input', { type: 'checkbox', checked: allOn, disabled: !sel.length });
      ck.indeterminate = some && !allOn;
      const apply = on => app.tx(on ? 'Tetapkan sumber daya' : 'Hapus sumber daya', P2 => {
        for (const t of sel) {
          const x = P2.byUid.get(t.uid), rr = P2.resByUid.get(r.uid);
          if (!on) { M.unassign(P2, x, rr); continue; }
          const v = U.parseNum(String(units.value).replace('%', ''));
          if (rr.type === 'work') M.assign(P2, x, rr, { units: isFinite(v) ? v / 100 : 1 });
          else if (rr.type === 'material') M.assign(P2, x, rr, { qty: isFinite(v) ? v : 1 });
          else M.assign(P2, x, rr, { cost: isFinite(v) ? v : 0 });
        }
      });
      ck.addEventListener('change', () => { apply(ck.checked); draw(); });
      units.addEventListener('change', () => { if (some) { apply(true); draw(); } });
      list.append(el('label.asg-r' + (some ? '.on' : '') + (r.over ? '.over' : ''), ck, el('span.asg-n', r.name, r.type !== 'work' ? el('small', r.type === 'material' ? ' material' + (r.mat ? ' (' + r.mat + ')' : '') : ' biaya') : null, r.over ? el('span.ms.bad', { 'data-tip': 'Teralokasi berlebih' }, 'person_alert') : null), units, el('span.asg-c', as.length ? U.money(U.sum(as, a => a.costV || 0), P) : '')));
    }
    if (!rs.length) list.append(el('div.hint.asg-empty', P.res.length ? 'Tidak ada yang cocok.' : 'Belum ada sumber daya. Tambahkan di bawah atau ketik nama di kolom Nama Sumber Daya.'));
    const addName = el('input.inp.sm', { placeholder: 'Nama sumber daya baru' });
    const addType = UI.select(F.RTYPES, 'work'); addType.classList.add('sm');
    const add = el('div.asg-add', addName, addType, el('button.btn.sm', { type: 'button', onclick: () => { const n = addName.value.trim(); if (!n) return; if (P.res.some(x => x.name.toLowerCase() === n.toLowerCase())) { UI.toast('Nama sudah ada'); return; } app.tx('Tambah sumber daya', P2 => { P2.res.push(M.newRes(P2, { name: n, type: addType.value, ini: n.slice(0, 1).toUpperCase() })); }); draw(); } }, icon('person_add'), 'Tambah'));
    body.replaceChildren(head, list, add);
  };
  draw();
  const unsub = () => { app._assignRedraw = null; assignBox = null; };
  app._assignRedraw = draw;
  assignBox = UI.dialog({ title: 'Tetapkan Sumber Daya', width: '460px', modeless: true, cls: 'asg', body, buttons: [{ label: 'Lembar Sumber Daya', left: true, run: () => { app.setView('rsheet'); return false; } }, { label: 'Tutup', primary: true }], onClose: unsub });
  const ob = app.onSel;
  void ob;
};
// keep the assign dialog in step with the selection
const _onSel = () => { const a = A(); if (a && a._assignRedraw) a._assignRedraw(); };
setInterval(() => { const a = A(); if (a && a._assignRedraw) { const k = a.selTasks().map(t => t.uid).join(','); if (k !== Dlg._asgK) { Dlg._asgK = k; _onSel(); } } }, 400);

/* ---------------- Garis Dasar ---------------- */
Dlg.baseline = (clear = false) => {
  const app = A(), P = P_();
  let mode = 'bl', n = 0, scope = 'all', interim = 1;
  const info = k => (P.blInfo && P.blInfo[k] ? ' (disimpan ' + new Date(P.blInfo[k]).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ')' : '');
  const blSel = UI.select([...Array(11)].map((_, k) => [String(k), (k ? 'Garis Dasar ' + k : 'Garis Dasar') + info(k)]), '0', v => { n = +v; });
  const imSel = UI.select([...Array(10)].map((_, k) => [String(k + 1), 'Mulai/Selesai ' + (k + 1)]), '1', v => { interim = +v; });
  const modeR = UI.radio('blm', [['bl', clear ? 'Hapus garis dasar' : 'Tetapkan garis dasar'], ['im', clear ? 'Hapus rencana sementara' : 'Tetapkan rencana sementara']], 'bl', v => { mode = v; });
  const scopeR = UI.radio('bls', [['all', 'Seluruh proyek'], ['sel', 'Tugas yang dipilih (' + app.selTasks().length + ')']], 'all', v => { scope = v; });
  UI.dialog({ title: clear ? 'Hapus Garis Dasar' : 'Tetapkan Garis Dasar', width: '520px', body: el('div', modeR, UI.field('Garis dasar', blSel), UI.field('Rencana sementara (salin Mulai/Selesai saat ini ke)', imSel), el('div.lbl', 'Untuk'), scopeR,
    el('p.hint', clear ? 'Menghapus data garis dasar untuk dibandingkan.' : 'Garis dasar menyimpan tanggal, durasi, kerja dan biaya saat ini sebagai patokan. Tampilkan di Gantt Pelacakan atau Format › Garis Dasar.')),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: async () => {
      const uids = scope === 'sel' ? app.selTasks().map(t => t.uid) : null;
      if (scope === 'sel' && !uids.length) { UI.toast('Pilih tugas terlebih dahulu'); return false; }
      if (!clear && mode === 'bl' && P.blInfo && P.blInfo[n] && scope === 'all' && !(await UI.confirm('Garis dasar ini sudah pernah disimpan. Timpa dengan data saat ini?', { ok: 'Timpa' }))) return false;
      app.tx(clear ? 'Hapus garis dasar' : 'Tetapkan garis dasar', P2 => {
        if (clear) { if (mode === 'bl') M.clearBaseline(P2, n, uids); else for (const t of P2.tasks) if (t.ip && (!uids || uids.includes(t.uid))) delete t.ip[interim]; }
        else if (mode === 'bl') M.setBaseline(P2, n, uids); else M.setBaseline(P2, 0, uids, interim);
      });
      UI.toast(clear ? 'Garis dasar dihapus' : 'Garis dasar disimpan' + (mode === 'bl' && n === 0 ? ' — lihat di Tampilan › Gantt Pelacakan' : ''), { ms: 3500 });
    } }] });
};

/* ---------------- Perbarui tugas / proyek ---------------- */
Dlg.updateTasks = () => {
  const app = A(), P = P_();
  const sel = app.selTasks().filter(t => !t.sum);
  if (!sel.length) { UI.toast('Pilih tugas (bukan ringkasan)'); return; }
  const t = sel[0];
  const one = sel.length === 1;
  const pct = el('input.inp', { type: 'number', min: 0, max: 100, value: one ? t.pct : '' });
  const aDur = el('input.inp', { value: one ? F.text('task', 'aDur', t, P) : '' });
  const rDur = el('input.inp', { value: one ? F.text('task', 'rDur', t, P) : '' });
  let aS = one ? t.aStart : null, aF = one ? t.aFinish : null, chS = false, chF = false;
  const aSi = UI.dateInput(aS, v => { aS = v; chS = true; }, { clear: true, time: true });
  const aFi = UI.dateInput(aF, v => { aF = v; chF = true; }, { clear: true, time: true, defTime: P.opts.dayEnd });
  const ch = {};
  pct.addEventListener('change', () => { ch.pct = pct.value; });
  aDur.addEventListener('change', () => { ch.aDur = aDur.value; });
  rDur.addEventListener('change', () => { ch.rDur = rDur.value; });
  UI.dialog({ title: 'Perbarui Tugas' + (one ? ' · ' + t.name : ' · ' + sel.length + ' tugas'), width: '560px', body: el('div',
    one ? el('div.ut-cur', el('span', 'Jadwal saat ini: ' + fdate(t.start) + ' – ' + fdate(t.finish) + ' (' + F.text('task', 'dur', t, P) + ')')) : null,
    grid2(UI.field('% selesai', pct), UI.field('Durasi aktual', aDur), UI.field('Durasi sisa', rDur)),
    grid2(UI.field('Mulai aktual', aSi), UI.field('Selesai aktual', aFi))),
    buttons: [{ label: 'Catatan…', left: true, run: () => { Dlg.taskInfo(t, 'notes'); return false; } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      app.tx('Perbarui tugas', P2 => {
        for (const s of sel) {
          const x = P2.byUid.get(s.uid);
          if (chS) F.T.aStart.set(x, P2, aS == null ? '' : U.fmtDate(aS, 'dd/mm/yyyy HH.MM'));
          if ('pct' in ch && ch.pct !== '') M.setPct(P2, x, +ch.pct, P2._ctx);
          if (ch.aDur) F.T.aDur.set(x, P2, ch.aDur);
          if (ch.rDur) F.T.rDur.set(x, P2, ch.rDur);
          if (chF) F.T.aFinish.set(x, P2, aF == null ? '' : U.fmtDate(aF, 'dd/mm/yyyy HH.MM'), P2._ctx);
          S.calc(P2);
        }
      });
    } }] });
};
Dlg.updateProject = () => {
  const app = A(), P = P_();
  let mode = 'work', how = 'pct', scope = 'all';
  let d1 = P.statusDate != null ? P.statusDate : U.today() + P.opts.dayEnd, d2 = d1;
  const r1 = UI.radio('upm', [['work', 'Perbarui pekerjaan sebagai selesai sampai'], ['resched', 'Jadwalkan ulang pekerjaan yang belum selesai mulai setelah']], 'work', v => { mode = v; });
  const di1 = UI.dateInput(d1, v => { d1 = v; }, { time: true, defTime: P.opts.dayEnd });
  const di2 = UI.dateInput(d2, v => { d2 = v; }, { time: true, defTime: P.opts.dayEnd });
  const r2 = UI.radio('uph', [['pct', 'Atur 0% – 100% selesai'], ['all', 'Atur 0% atau 100% saja']], 'pct', v => { how = v; });
  const r3 = UI.radio('ups', [['all', 'Seluruh proyek'], ['sel', 'Tugas yang dipilih']], 'all', v => { scope = v; });
  UI.dialog({ title: 'Perbarui Proyek', width: '560px', body: el('div', r1, grid2(UI.field('Tanggal (perbarui pekerjaan)', di1), UI.field('Tanggal (jadwal ulang)', di2)), r2, el('div.lbl', 'Untuk'), r3),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      const uids = scope === 'sel' ? new Set(app.selTasks().map(t => t.uid)) : null;
      app.tx('Perbarui proyek', P2 => {
        const C = P2._ctx;
        for (const x of P2.tasks) {
          if (x.sum || (uids && !uids.has(x.uid)) || x.inact) continue;
          if (mode === 'work') {
            if (how === 'all') { if (x.finish <= d1) M.setPct(P2, x, 100, C); else if (x.start > d1) { /* keep */ } }
            else M.markOnTrack(P2, x, d1, C);
          } else if (x.pct < 100 && x.start < d2) {
            if (x.pct > 0 && P2.opts.split) {
              const off = Math.round(x.dur * x.pct / 100), stop = C.add(x.calId, x.start, off), resume = C.next(x.calId, d2);
              if (resume > stop) x.splits = [[off, C.between(x.calId, stop, resume)]];
            } else if (!x.pct) { x.cons = 'SNET'; x.consDate = C.next(x.calId, d2); }
          }
        }
      });
    } }] });
};
Dlg.moveProject = () => {
  const app = A(), P = P_();
  let ns = P.root.start;
  let dl = true;
  const di = UI.dateInput(ns, v => { ns = v; }, { time: true });
  UI.dialog({ title: 'Pindahkan Proyek', width: '480px', body: el('div', el('p', 'Tanggal mulai saat ini: ' + fdate(P.root.start)), UI.field('Tanggal mulai baru', di), UI.checkbox('Pindahkan juga tenggat & tanggal batasan', true, v => { dl = v; })),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      const d = ns - P.root.start;
      if (!d) return;
      app.tx('Pindahkan proyek', P2 => {
        P2.start += d;
        if (P2.fromFinish) P2.finish += d;
        for (const t of P2.tasks) {
          if (t.mStart != null) t.mStart += d; if (t.mFinish != null) t.mFinish += d;
          if (dl) { if (t.consDate != null) t.consDate += d; if (t.deadline != null) t.deadline += d; }
          if (t.aStart != null) t.aStart += d; if (t.aFinish != null) t.aFinish += d;
        }
        if (P2.statusDate != null) P2.statusDate += d;
      });
      if (app.view && app.view.scrollToStart) app.view.scrollToStart();
    } }] });
};
Dlg.statusDate = () => {
  const app = A(), P = P_();
  let v = P.statusDate;
  const di = UI.dateInput(v, x => { v = x; }, { clear: true, time: true, defTime: P.opts.dayEnd });
  UI.dialog({ title: 'Tanggal Status', width: '420px', body: el('div', UI.field('Tanggal status', di), el('p.hint', 'Dipakai untuk status tugas (terlambat/sesuai jadwal), nilai hasil, garis kemajuan, dan Tandai Sesuai Jadwal. NA = hari ini.')),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => { app.tx('Tanggal status', P2 => { P2.statusDate = v; }); } }] });
};
Dlg.moveTasks = () => {
  const app = A(), P = P_();
  const sel = app.selTasks();
  const n = el('input.inp', { value: '1 hari' });
  let dir = 'f';
  UI.dialog({ title: 'Pindahkan Tugas', width: '420px', body: el('div', UI.radio('mtd', [['f', 'Maju (lebih lambat)'], ['b', 'Mundur (lebih awal)']], 'f', v => { dir = v; }), UI.field('Sejauh', n)),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      const x = D.parseDur(n.value, P.opts);
      if (!x) { UI.toast('Durasi tidak valid'); return false; }
      app.tx('Pindahkan tugas', P2 => { const C = P2._ctx; for (const t of sel) { const y = P2.byUid.get(t.uid); if (!y || y.sum) continue; const s = dir === 'f' ? C.addX(y.calId, y.start, x.v, x.el) : C.subX(y.calId, y.start, x.v, x.el); if (y.mode === 'manual') y.mStart = C.next(y.calId, s); else { y.cons = 'SNET'; y.consDate = C.next(y.calId, s); } } });
    } }] });
};
Dlg.levelOpts = () => {
  const app = A(), P = P_();
  const lv = { ...P.opts.level };
  const sel = (k, opts) => UI.select(opts, String(lv[k]), v => { lv[k] = v === 'true' ? true : v === 'false' ? false : v; });
  UI.dialog({ title: 'Opsi Pemerataan Sumber Daya', width: '560px', body: el('div',
    UI.radio('lva', [['false', 'Manual'], ['true', 'Otomatis (ratakan setiap perubahan)']], String(!!lv.auto), v => { lv.auto = v === 'true'; }),
    grid2(UI.field('Cari alokasi berlebih per', sel('basis', [['day', 'Hari demi hari'], ['week', 'Minggu demi minggu']])), UI.field('Urutan pemerataan', sel('order', [['id', 'Hanya ID'], ['std', 'Standar'], ['pri', 'Prioritas, Standar']])))
    , el('div.checks', UI.checkbox('Hapus penundaan pemerataan sebelum meratakan', !!lv.clear, v => { lv.clear = v; }), UI.checkbox('Ratakan hanya dalam slack yang tersedia', !!lv.slack, v => { lv.slack = v; })),
    el('p.hint', 'Pemerataan menunda tugas (berdasarkan prioritas, slack, dan tanggal) agar beban tiap sumber daya per hari tidak melebihi unit maksimumnya. Prioritas 1000 = tidak pernah ditunda.')),
    buttons: [{ label: 'Hapus Pemerataan', left: true, run: () => { app.cmd('level:clear'); } }, { label: 'Batal' }, { label: 'Ratakan Semua', primary: true, run: () => { app.tx('Opsi pemerataan', P2 => { P2.opts.level = lv; }); app.cmd('level:all'); } }] });
};
Dlg.split = () => {
  const app = A(), P = P_();
  const t = app.focusTask();
  if (!t || t.sum || F.isMs(t)) { UI.toast('Pilih tugas biasa (bukan ringkasan/tonggak)'); return; }
  let at = P._ctx.add(t.calId, t.start, Math.round(t.dur / 2));
  const di = UI.dateInput(at, v => { at = v; }, { time: true });
  const gap = el('input.inp', { value: '1 hari' });
  UI.dialog({ title: 'Pisahkan Tugas · ' + t.name, width: '460px', body: el('div', el('p.hint', 'Tugas berhenti pada tanggal berikut dan dilanjutkan setelah jeda. Untuk menyambung lagi, kosongkan jeda (0).'), UI.field('Berhenti pada', di), UI.field('Lama jeda', gap)),
    buttons: [{ label: 'Hapus Pemisahan', left: true, run: () => { app.tx('Hapus pemisahan', P2 => { P2.byUid.get(t.uid).splits = null; }); } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      const g = D.parseDur(gap.value, P.opts);
      if (!g) { UI.toast('Jeda tidak valid'); return false; }
      app.tx('Pisahkan tugas', P2 => {
        const x = P2.byUid.get(t.uid), C = P2._ctx;
        const off = U.clamp(C.between(x.calId, x.start, at), 1, x.dur - 1);
        x.splits = (x.splits || []).filter(s => s[0] !== off);
        if (g.v > 0) x.splits.push([off, g.el ? C.between(x.calId, at, at + g.v) : g.v]);
        x.splits.sort((a, b) => a[0] - b[0]);
      });
    } }] });
};
Dlg.recurring = () => {
  const app = A(), P = P_();
  const name = el('input.inp', { value: 'Rapat mingguan' });
  const dur = el('input.inp', { value: '1 jam' });
  let pat = 'w', every = 1, days = [1], mday = 1, start = U.today() + P.opts.dayStart, end = U.addMonths(U.today(), 2) + P.opts.dayEnd, endBy = 'date', count = 8;
  const dowBox = el('div.dows', ...[1, 2, 3, 4, 5, 6, 0].map(d => UI.checkbox(U.DOW_S[d], days.includes(d), v => { days = v ? [...new Set([...days, d])] : days.filter(x => x !== d); })));
  const patR = UI.radio('rp', [['d', 'Harian'], ['w', 'Mingguan'], ['m', 'Bulanan'], ['y', 'Tahunan']], 'w', v => { pat = v; dowBox.hidden = v !== 'w'; });
  const ev = el('input.inp', { type: 'number', min: 1, max: 52, value: 1, style: { width: '80px' } }); ev.addEventListener('change', () => { every = +ev.value || 1; });
  const md = el('input.inp', { type: 'number', min: 1, max: 31, value: 1, style: { width: '80px' } }); md.addEventListener('change', () => { mday = +md.value || 1; });
  const sI = UI.dateInput(start, v => { start = v; }, { time: true });
  const eI = UI.dateInput(end, v => { end = v; }, { time: true });
  const cI = el('input.inp', { type: 'number', min: 1, max: 500, value: 8, style: { width: '90px' } }); cI.addEventListener('change', () => { count = +cI.value || 1; });
  UI.dialog({ title: 'Informasi Tugas Berulang', width: '600px', body: el('div', grid2(UI.field('Nama tugas', name), UI.field('Durasi', dur)), el('div.lbl', 'Pola pengulangan'), patR, el('div.frow', UI.field('Setiap (minggu/hari/bulan)', ev), UI.field('Tanggal (bulanan)', md)), dowBox,
    grid2(UI.field('Mulai', sI), el('div.fcol', UI.radio('re', [['date', 'Berakhir pada'], ['count', 'Berakhir setelah (kali)']], 'date', v => { endBy = v; }), el('div.frow', eI, cI)))),
    buttons: [{ label: 'Batal' }, { label: 'OK', primary: true, run: () => {
      const d = D.parseDur(dur.value, P.opts);
      if (!d) { UI.toast('Durasi tidak valid'); return false; }
      const list = M.recurDays(start, { t: pat, n: every, days, day: mday, until: endBy === 'date' ? end : null, count: endBy === 'count' ? count : null });
      if (!list.length) { UI.toast('Tidak ada kejadian pada rentang ini'); return false; }
      if (list.length > 400) { UI.toast('Terlalu banyak kejadian (' + list.length + ')'); return false; }
      let uid = null;
      app.tx('Sisipkan tugas berulang', P2 => {
        const selT = app.selTasks()[0];
        const at = selT ? P2.byUid.get(selT.uid).id - 1 : P2.tasks.length;
        const lvl = selT ? P2.byUid.get(selT.uid).lvl : 1;
        const sum = M.newTask(P2, { name: name.value.trim() || 'Tugas berulang', lvl, recur: { t: pat, n: every, days, count: list.length } });
        const kids = list.map((di, i) => M.newTask(P2, { name: (name.value.trim() || 'Tugas berulang') + ' ' + (i + 1), lvl: lvl + 1, dur: d.v, durU: d.u, el: d.el, est: false, cons: 'SNET', consDate: di * 1440 + (start % 1440), recurKid: 1 }));
        M.insertTasks(P2, at, [sum, ...kids]);
        uid = sum.uid;
      });
      app.reselect([uid]);
      UI.toast(list.length + ' kejadian dibuat');
    } }] });
};
Dlg.insertProject = async () => {
  const app = A();
  const list = (await Store.list()).filter(m => m.id !== app.P.id);
  if (!list.length) { UI.toast('Belum ada proyek lain untuk disisipkan'); return; }
  let pick = list[0].id, link = false;
  UI.dialog({ title: 'Sisipkan Subproyek', width: '520px', body: el('div', UI.field('Proyek', UI.select(list.map(m => [m.id, m.name + ' (' + (m.n || 0) + ' tugas)']), pick, v => { pick = v; })), UI.checkbox('Tautkan ke tugas yang dipilih (selesai-ke-mulai)', false, v => { link = v; }), el('p.hint', 'Tugas, tautan dan penugasan proyek tersebut disalin ke bawah sebuah tugas ringkasan. Sumber daya dengan nama sama digabung.')),
    buttons: [{ label: 'Batal' }, { label: 'Sisipkan', primary: true, run: async () => {
      const Q = M.fix(await Store.get(pick));
      S.calc(Q);
      app.tx('Sisipkan subproyek', P2 => {
        const selT = app.selTasks()[0];
        const at = selT ? P2.byUid.get(selT.uid).id : P2.tasks.length;
        const lvl = selT ? P2.byUid.get(selT.uid).lvl : 1;
        const sum = M.newTask(P2, { name: Q.name, lvl, notes: 'Disisipkan dari proyek "' + Q.name + '"' });
        if (link && selT) sum.pred.push({ uid: selT.uid, type: 'FS', lag: 0, lagU: 'd', pct: null, el: false });
        const map = new Map(), resMap = new Map();
        for (const r of Q.res) { let x = P2.res.find(y => y.name.toLowerCase() === r.name.toLowerCase()); if (!x) { x = { ...U.deep(r), uid: M.uid(P2), cal: null }; P2.res.push(x); } resMap.set(r.uid, x.uid); }
        const kids = Q.tasks.map(t => { const c = M.newTask(P2, {}); for (const k of M.TASK_KEYS) if (k !== 'uid' && t[k] !== undefined) c[k] = U.deep(t[k]); c.lvl = lvl + t.lvl; c.cal = null; if (!c.consDate && Q.start > P2.start) { /* keep relative */ } map.set(t.uid, c.uid); return c; });
        for (const c of kids) c.pred = (c.pred || []).filter(L => map.has(L.uid)).map(L => ({ ...L, uid: map.get(L.uid) }));
        M.insertTasks(P2, at, [sum, ...kids]);
        for (const a of Q.asg) if (map.has(a.t) && resMap.has(a.r)) P2.asg.push({ ...U.deep(a), uid: M.uid(P2), t: map.get(a.t), r: resMap.get(a.r) });
      });
    } }] });
};
Dlg.link = (p, s) => {
  const app = A(), P = P_();
  const L = s.pred.find(x => x.uid === p.uid);
  if (!L) return;
  let type = L.type;
  const lag = el('input.inp', { value: D.fmtLag(L, P.opts) || '0 hari' });
  UI.dialog({ title: 'Ketergantungan Tugas', width: '520px', body: el('div', el('table.dep', el('tr', el('th', 'Dari'), el('td', p.id + ' · ' + p.name)), el('tr', el('th', 'Ke'), el('td', s.id + ' · ' + s.name))),
    grid2(UI.field('Jenis', UI.select(D.TYPES.map(k => [k, D.TYPE_L[k]]), type, v => { type = v; })), UI.field('Lag (mis. 2 hari, -1h, 50%)', lag))),
    buttons: [{ label: 'Hapus', danger: true, left: true, run: () => { app.cmd('setLink', s, L, { del: true }); } }, { label: 'Batal' }, { label: 'OK', primary: true, run: () => { app.cmd('setLink', s, L, { type, lagText: lag.value }); } }] });
};
Dlg.inspect = t => {
  const app = A(), P = P_();
  const items = [];
  if (t.aStart != null) items.push(['play_circle', 'Mulai aktual', 'Tugas sudah dimulai pada ' + fdate(t.aStart) + '. Tanggal mulai tidak lagi ditentukan tautan.']);
  if (t.mode === 'manual') items.push(['push_pin', 'Dijadwalkan manual', t.warn === 'link' ? 'Tautan pendahulu menunjukkan tugas ini seharusnya mulai lebih lambat.' : 'Tanggal ditentukan sendiri, tidak mengikuti tautan.']);
  if (t.drv) items.push(['link', 'Pendahulu penentu', t.drv.p.id + ' · ' + t.drv.p.name + ' (' + D.TYPE_L[t.drv.L.type] + (D.fmtLag(t.drv.L, P.opts) ? ' ' + D.fmtLag(t.drv.L, P.opts) : '') + ')']);
  if (t.cons && t.cons !== 'ASAP') items.push(['calendar_clock', 'Batasan', F.CONS_L[t.cons] + (t.consDate != null ? ' ' + fdate(t.consDate) : '') + (t.warn === 'cons' ? ' — bertentangan dengan tautan' : '')]);
  if (t.ld) items.push(['hourglass_bottom', 'Penundaan pemerataan', D.fmtDur(t.ld, 'd', P.opts, true)]);
  if (t.parent && t.parent.pred.length) items.push(['subdirectory_arrow_right', 'Tautan ringkasan', 'Ringkasan "' + t.parent.name + '" memiliki pendahulu yang juga membatasi tugas ini.']);
  const cal = P.cals.find(c => c.id === t.calId);
  items.push(['calendar_month', 'Kalender', (cal ? cal.name : 'Standar') + (t.cal ? ' (kalender tugas)' : t.calId !== P.calendar ? ' (kalender sumber daya)' : ' (kalender proyek)')]);
  if (!t.drv && t.aStart == null && (!t.cons || t.cons === 'ASAP') && t.mode !== 'manual') items.push(['start', 'Tanggal mulai proyek', 'Tidak ada pendahulu: mulai pada tanggal mulai proyek ' + fdate(P.start) + '.']);
  if (t.deadline != null) items.push(['flag', 'Tenggat', fdate(t.deadline) + (t.lateBy ? ' — terlewati ' + D.fmtDur(t.lateBy, 'd', P.opts) : '')]);
  if (t.over) items.push(['person_alert', 'Alokasi berlebih', 'Sumber dayanya teralokasi berlebih. Pilih Sumber Daya › Ratakan.']);
  UI.dialog({ title: 'Periksa Tugas · ' + t.id + ' ' + t.name, width: '560px', body: el('div.insp', el('div.insp-d', 'Mulai ' + fdate(t.start) + ' · Selesai ' + fdate(t.finish) + ' · Slack total ' + F.text('task', 'ts', t, P)), ...items.map(([ic, a, b]) => el('div.insp-i', icon(ic), el('div', el('b', a), el('span', b))))),
    buttons: [...(t.mode === 'manual' || t.warn ? [{ label: 'Hormati Tautan', left: true, run: () => app.cmd('respectLinks') }] : []), { label: 'Tutup', primary: true }] });
};

/* ---------------- Cari / Ganti / Pergi ke ---------------- */
Dlg.find = (replace) => {
  const app = A(), P = P_();
  const kind = app.kind();
  const fields = F.list(kind, P).filter(f => !['ind'].includes(f.k));
  let k = 'name', op = 'has';
  const what = el('input.inp', { placeholder: 'Cari…' });
  const rep = el('input.inp', { placeholder: 'Ganti dengan…' });
  const match = x => { const s = F.text(kind, k, x, P).toLowerCase(), w = what.value.toLowerCase(); return op === 'has' ? s.includes(w) : op === 'eq' ? s === w : op === 'start' ? s.startsWith(w) : s !== w; };
  const rows = () => (app.view && app.view.grid ? app.view.grid.rows.filter(r => r.x && r.kind === (kind === 'res' ? 'res' : 'task') && !r.x.root) : []);
  const next = (dir = 1) => {
    const g = app.view && app.view.grid;
    if (!g) return;
    const rs = rows();
    const cur = g.idx(g.focusKey);
    const all = g.rows;
    for (let s = 1; s <= all.length; s++) { const i = (cur + s * dir + all.length * 2) % all.length; const r = all[i]; if (rs.includes(r) && match(r.x)) { g.colKey = g.cols.some(c => c.k === k) ? k : g.colKey; g.selectIdx(i); if (app.view.scrollToTask && r.kind === 'task') app.view.scrollToTask(r.x); return; } }
    UI.toast('Tidak ditemukan: ' + what.value);
  };
  const replaceAll = () => {
    const f = F.reg(kind)[k];
    if (!f || !f.set) { UI.toast('Kolom ini tidak dapat diganti'); return; }
    let n = 0;
    app.tx('Ganti semua', P2 => {
      for (const x of (kind === 'res' ? P2.res : P2.tasks)) {
        const s = F.text(kind, k, x, P2);
        if (!match(x)) continue;
        const ns = op === 'has' ? s.split(new RegExp(what.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join(rep.value) : rep.value;
        if (ns !== s) { try { f.set(x, P2, ns, P2._ctx); n++; } catch { } }
      }
      if (!n) return false;
    });
    UI.toast(n + ' diganti');
  };
  UI.dialog({ title: replace ? 'Ganti' : 'Cari', width: '520px', modeless: true, body: el('div', UI.field('Cari', what), replace ? UI.field('Ganti dengan', rep) : null,
    grid2(UI.field('Di kolom', UI.select(fields.map(f => [f.k, f.t]), k, v => { k = v; })), UI.field('Uji', UI.select([['has', 'berisi'], ['eq', 'sama dengan'], ['start', 'diawali'], ['ne', 'tidak sama dengan']], op, v => { op = v; })))),
    buttons: [...(replace ? [{ label: 'Ganti Semua', run: () => { replaceAll(); return false; } }] : []), { label: 'Sebelumnya', run: () => { next(-1); return false; } }, { label: 'Cari Berikutnya', primary: true, run: () => { next(1); return false; } }] });
};
Dlg.goto = async () => {
  const app = A(), P = P_();
  const v = await UI.prompt('Pergi ke', 'ID tugas atau tanggal (mis. 12 atau 18/11/26)', '');
  if (v == null || !v.trim()) return;
  const n = parseInt(v, 10);
  if (/^\d+$/.test(v.trim()) && P.tasks[n - 1]) { const t = P.tasks[n - 1]; for (let p = t.parent; p; p = p.parent) if (p.col) app.tx('Perluas', P2 => { P2.byUid.get(p.uid).col = false; }); app.reselect([t.uid]); if (app.view.scrollToTask) app.view.scrollToTask(t); return; }
  const d = U.parseDate(v, 0);
  if (isFinite(d) && app.view && app.view.chart) { app.view.chart.scrollToDate(d, 0.3); return; }
  UI.toast('Tidak ditemukan: ' + v);
};

/* ---------------- Riwayat versi ---------------- */
Dlg.versions = async () => {
  const app = A();
  await app.save();
  const box = el('div.ver');
  let dlg;
  const draw = async () => {
    const list = await Store.versions(app.P.id);
    if (!list.length) { box.replaceChildren(el('p.hint', 'Belum ada versi. Versi dibuat otomatis saat Anda mulai mengedit dan setiap 15 menit, atau simpan versi bernama.')); return; }
    box.replaceChildren(...list.map(v => el('div.ver-r',
      el('div', el('b', v.label || 'Versi otomatis'), el('span', new Date(v.at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) + ' · ' + (v.n || 0) + ' tugas')),
      el('div.ver-a',
        el('button.btn.sm', { type: 'button', onclick: async () => { if (!(await UI.confirm('Pulihkan versi ini? Keadaan sekarang tetap bisa dibatalkan (' + U.MOD + '+Z).', { ok: 'Pulihkan' }))) return; const data = M.fix(U.deep(v.data)); app.tx('Pulihkan versi', P2 => { const keep = { id: P2.id, view: P2.view }; for (const k of Object.keys(P2)) delete P2[k]; Object.assign(P2, data, keep); }); dlg.close(); UI.toast('Versi dipulihkan'); } }, icon('restore'), 'Pulihkan'),
        el('button.btn.sm', { type: 'button', onclick: async () => { const c = M.fix(U.deep(v.data)); c.id = U.uid('p'); c.name = (v.name || 'Proyek') + ' (' + new Date(v.at).toLocaleDateString('id-ID') + ')'; c.created = c.updated = Date.now(); S.calc(c); await Store.put(c); UI.toast('Salinan dibuat', { action: { label: 'Buka', run: () => app.go('#/p/' + c.id) } }); } }, icon('file_copy'), 'Salinan'),
        el('button.icon-btn.sm', { type: 'button', 'data-tip': 'Ganti nama', onclick: async () => { const n = await UI.prompt('Nama versi', 'Nama', v.label || ''); if (n == null) return; await Store.renameVersion(v.vid, n.trim()); draw(); } }, icon('edit')),
        el('button.icon-btn.sm', { type: 'button', 'data-tip': 'Hapus', onclick: async () => { await Store.delVersion(v.vid); draw(); } }, icon('delete'))))));
  };
  dlg = UI.dialog({ title: 'Riwayat Versi · ' + app.P.name, width: 'min(680px, 100%)', body: box, buttons: [{ label: 'Simpan Versi Bernama…', left: true, icon: 'bookmark_add', run: async () => { await app.cmd('saveVersion'); setTimeout(draw, 300); return false; } }, { label: 'Tutup', primary: true }] });
  draw();
};
})();
