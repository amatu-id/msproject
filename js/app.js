// Amatu Project — aplikasi: beranda (proyek & templat), membuka proyek, transaksi (undo/redo), simpan otomatis,
// riwayat versi, pengelolaan tampilan/panel, perintah (CMD) yang dipakai ribbon, menu konteks, keyboard, papan klip.
(() => {
'use strict';
const AP = window.AP, U = AP.U, M = AP.M, S = AP.S, F = AP.F, D = AP.D, UI = AP.UI, V = AP.V, Store = AP.Store, { el, icon, esc } = U;
const app = AP.app = {
  P: null, view: null, viewId: 'gantt', detail: null, tl: null, readOnly: false, clip: null,
  hist: { undo: [], redo: [] }, dirty: false, cmds: {},
};
const CMD = app.cmds;
const $ = s => document.querySelector(s);

/* ---------------- tema ---------------- */
app.theme = () => Store.pref('theme') || 'auto';
app.applyTheme = () => {
  const t = app.theme();
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = dark ? '#17191d' : '#f3f5f7';
  if (app.view) app.refresh();
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => app.applyTheme());

/* ---------------- transaksi & riwayat ---------------- */
const snapOf = P => { const c = M.clean(P); delete c.view; delete c.share; return JSON.stringify(c); };
app.snapOf = snapOf;
app.rowH = () => (app.P && app.P.opts.rowH) || 24;
app.tx = (label, fn, o = {}) => {
  const P = app.P;
  if (!P) return false;
  if (app.readOnly) { UI.toast('Proyek ini hanya bisa dilihat', { kind: 'warn' }); return false; }
  const before = snapOf(P);
  let r;
  try { r = fn(P); }
  catch (e) { app.restore(before, true); if (typeof e === 'string') UI.toast(e, { kind: 'bad', ms: 5000 }); else { console.error(e); UI.toast('Gagal: ' + (e && e.message || e), { kind: 'bad', ms: 6000 }); } return false; }
  if (r === false) { app.recalc(); app.refresh(); return false; }
  app.hist.undo.push({ label, s: before });
  let bytes = 0;
  for (let i = app.hist.undo.length - 1; i >= 0; i--) { bytes += app.hist.undo[i].s.length; if (bytes > 60e6 || app.hist.undo.length - i > 150) { app.hist.undo.splice(0, i); break; } }
  app.hist.redo = [];
  app.recalc();
  app.markDirty();
  if (o.render !== false) app.refresh();
  return true;
};
app.restore = (s, quiet) => {
  const view = app.P.view, id = app.P.id, share = app.P.share;
  const P = M.fix(JSON.parse(s));
  P.view = view; P.id = id; P.share = share;
  app.P = P;
  app.recalc();
  if (!quiet) { app.markDirty(); app.refresh(); }
  else app.refresh();
};
app.undo = () => {
  const h = app.hist.undo.pop();
  if (!h) { UI.toast('Tidak ada yang bisa dibatalkan'); return; }
  app.hist.redo.push({ label: h.label, s: snapOf(app.P) });
  app.restore(h.s);
  UI.toast('Dibatalkan: ' + h.label, { key: 'undo', ms: 1800 });
};
app.redo = () => {
  const h = app.hist.redo.pop();
  if (!h) { UI.toast('Tidak ada yang bisa diulang'); return; }
  app.hist.undo.push({ label: h.label, s: snapOf(app.P) });
  app.restore(h.s);
  UI.toast('Diulang: ' + h.label, { key: 'undo', ms: 1800 });
};
app.recalc = () => {
  const P = app.P;
  if (P.opts.calc === 'manual' && app._calcOnce !== true && P.root) { M.index(P); P.needCalc = true; return; }
  app._calcOnce = false;
  S.calc(P);
  P.needCalc = false;
};
app.viewChanged = () => { app.markDirty(true); };
app.viewChangedSoon = U.debounce(() => app.viewChanged(), 800);

/* ---------------- simpan ---------------- */
let saveT = 0, verAt = 0, editedSinceOpen = false;
app.markDirty = (viewOnly) => {
  const P = app.P;
  if (!P) return;
  app.dirty = true;
  if (!viewOnly) { P.updated = Date.now(); P.rev = (P.rev || 0) + 1; }
  app.saveState('saving');
  clearTimeout(saveT);
  saveT = setTimeout(() => app.save(), 1100);
  if (!viewOnly && !editedSinceOpen) { editedSinceOpen = true; app.autoVersion(true); }
  if (!viewOnly && app.live) app.live.changed();
};
// save the open project without counting it as an edit (changes that came through a share link, sync bookkeeping)
app.saveQuiet = U.debounce(() => { if (app.P) Store.put(app.P).catch(() => { }); }, 700);
app.save = async () => {
  clearTimeout(saveT);
  const P = app.P;
  if (!P || !app.dirty) return;
  app.dirty = false;
  try {
    await Store.put(P);
    app.saveState('saved');
    if (Date.now() - verAt > 15 * 60000) app.autoVersion();
  } catch (e) { app.dirty = true; app.saveState('error'); console.error(e); UI.toast('Gagal menyimpan: ' + (e.message || e), { kind: 'bad' }); }
};
app.autoVersion = async (before) => {
  const P = app.P;
  if (!P) return;
  try {
    const list = await Store.versions(P.id);
    if (before && list[0] && Date.now() - list[0].at < 30 * 60000) { verAt = list[0].at; return; }
    verAt = Date.now();
    await Store.addVersion(P, before ? 'Sebelum diedit' : '', true);
  } catch (e) { console.warn('versi', e); }
};
app.saveState = st => {
  const b = $('#save-state');
  if (!b) return;
  b.dataset.st = st;
  const ls = app.liveState;
  if (ls && st !== 'error') { b.replaceChildren(icon(ls[0]), el('span', ls[1])); b.dataset.tip = ls[2] || ls[1]; if (ls[0] === 'sync') b.dataset.st = 'saving'; return; }
  delete b.dataset.tip;
  b.replaceChildren(icon(st === 'saving' ? 'sync' : st === 'error' ? 'cloud_off' : 'cloud_done'), el('span', st === 'saving' ? 'Menyimpan…' : st === 'error' ? 'Gagal disimpan' : 'Tersimpan'));
};
addEventListener('pagehide', () => { if (app.dirty) app.save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && app.dirty) app.save(); });

/* ---------------- membuka / beranda ---------------- */
app.go = hash => { if (location.hash !== hash) location.hash = hash; else route(); };
let linkKey = AP.Share ? AP.Share.key() : null;
async function route() {
  if (linkKey && AP.Share) {   // ?share=<key>: open the shared project (cached under its own id)
    const key = linkKey;
    linkKey = null;
    try {
      const id = await AP.Share.openLink(key);
      history.replaceState(null, '', location.pathname + location.search + '#/p/' + id);
    } catch (e) { console.error(e); UI.toast('Tautan tidak dapat dibuka: ' + (e.message || e), { kind: 'bad' }); }
  }
  const m = /^#\/p\/([\w-]+)/.exec(location.hash);
  if (m) {
    if (app.P && app.P.id === m[1]) { show('app'); return; }
    await app.save();
    const P = await Store.get(m[1]);
    if (!P) { UI.toast('Proyek tidak ditemukan di perangkat ini'); app.go('#/'); return; }
    openProject(M.fix(P));
  } else {
    if (app.P) { await app.save(); }
    closeProject();
    AP.Home.show();
  }
}
app.route = route;
function show(which) {
  $('#home').hidden = which !== 'home';
  $('#app').hidden = which !== 'app';
  document.body.classList.toggle('in-app', which === 'app');
}
app.show = show;
function closeProject() {
  if (AP.Share && (app.live || app.readOnly)) AP.Share.detach(app);
  if (app.view) { app.view.unmount(); app.view = null; }
  if (app.detail) { app.detail.unmount(); app.detail = null; }
  if (app.tl) { app.tl.unmount(); app.tl = null; }
  app.P = null; app.hist = { undo: [], redo: [] };
  show('home');
  document.title = 'Amatu Project';
}
async function openProject(P) {
  closeProject();
  if (AP.Lock && P.lock && !AP.Lock.isOpen(P)) {
    show('app');
    const ok = await AP.Lock.gate(P);
    if (!ok) { app.go('#/'); return; }
  }
  app.P = P;
  app.hist = { undo: [], redo: [] };
  editedSinceOpen = false;
  app.readOnly = false;
  S.calc(P);
  show('app');
  AP.Ribbon.build();
  $('#doc-title').value = P.name;
  document.title = P.name + ' — Amatu Project';
  app.saveState('saved');
  const vs = V.vs(P);
  app.setView(vs.cur || 'gantt', true);
  app.layoutPanes();
  app.updateStatus();
  if (AP.Share) AP.Share.attach(app);
  Store.putMeta({ ...Store.metaOf(P), opened: Date.now() }).catch(() => { });
}
app.openProject = openProject;
app.newProject = async (P) => {
  await app.save();
  P = M.fix(P || M.newProject());
  S.calc(P);
  await Store.put(P);
  app.go('#/p/' + P.id);
};

/* ---------------- tampilan & panel ---------------- */
app.setView = (id, first) => {
  const P = app.P;
  if (!P) return;
  if (!V.VIEWS[id] && !/^report/.test(id)) id = 'gantt';
  const def = V.def(id.split(':')[0]);
  const T = V.TYPES[def.type];
  if (!T) { UI.toast('Tampilan belum tersedia: ' + def.t); return; }
  const keepSel = app.view && app.view.selectedTasks ? app.selTasks().map(t => t.uid) : [];
  if (app.view) app.view.unmount();
  const host = $('#primary');
  host.replaceChildren();
  app.viewId = id;
  app.view = new T(app, id);
  app.view.mount(host);
  V.vs(P).cur = id;
  if (!first) app.viewChanged();
  if (keepSel.length && app.view.selectUids) app.view.selectUids(keepSel);
  AP.Ribbon.refresh();
  app.updateStatus();
  app.refreshDetail();
  setTimeout(() => app.view && app.view.focus && app.view.focus(), 0);
};
app.refresh = () => {
  if (!app.P) return;
  if (app.view) app.view.render();
  if (app.detail) app.detail.render();
  if (app.tl) app.tl.render();
  AP.Ribbon.refresh();
  app.updateStatus();
  const ti = $('#doc-title');
  if (ti && document.activeElement !== ti) ti.value = app.P.name;
};
app.onSel = U.raf(() => { if (app.detail) app.detail.render(); if (app.tl) app.tl.render(); AP.Ribbon.refresh(); app.updateStatus(); });
app.refreshDetail = () => { if (app.detail) app.detail.render(); };
app.layoutPanes = () => {
  const P = app.P, vs = V.vs(P);
  // timeline pane
  const tlBox = $('#tlpane');
  if (vs.split.tl && AP.Timeline) {
    tlBox.hidden = false;
    if (!app.tl) { app.tl = new AP.Timeline(app, true); app.tl.mount(tlBox); }
    else app.tl.render();
  } else { tlBox.hidden = true; if (app.tl) { app.tl.unmount(); app.tl = null; } }
  // detail pane
  const dBox = $('#detail'), bar = $('#hsplit');
  if (vs.split.detail) {
    dBox.hidden = false; bar.hidden = false;
    const want = vs.split.detail;
    if (!app.detail || app.detail.kindId !== want) {
      if (app.detail) app.detail.unmount();
      const Cls = want === 'taskform' ? V.TaskForm : AP.DetailViews && AP.DetailViews[want];
      app.detail = Cls ? new Cls(app) : new V.TaskForm(app);
      app.detail.kindId = want;
      dBox.replaceChildren();
      app.detail.mount(dBox);
    } else app.detail.render();
    const h = Store.ui('split.detail');
    dBox.style.height = (h || 230) + 'px';
  } else { dBox.hidden = true; bar.hidden = true; if (app.detail) { app.detail.unmount(); app.detail = null; } }
  if (app.view) app.view.render();
};
app.toggleTimeline = (on) => { const vs = V.vs(app.P); vs.split.tl = on == null ? !vs.split.tl : on; app.layoutPanes(); app.viewChanged(); AP.Ribbon.refresh(); };
app.toggleDetail = (kind) => { const vs = V.vs(app.P); vs.split.detail = kind === undefined ? (vs.split.detail ? null : 'taskform') : kind; app.layoutPanes(); app.viewChanged(); AP.Ribbon.refresh(); };

/* ---------------- seleksi ---------------- */
app.isTaskView = () => app.view && V.def(app.viewId.split(':')[0]).kind === 'task' && !!app.view.selectedTasks;
app.selTasks = () => (app.view && app.view.selectedTasks ? app.view.selectedTasks() : []).filter(t => t && t.lvl != null && !t.root);
app.selRes = () => (app.view && app.view.selectedRes ? app.view.selectedRes() : []);
app.focusTask = () => { if (!app.view) return null; if (app.view.focusTask) return app.view.focusTask(); const r = app.view.focusRow && app.view.focusRow(); return r && r.x && r.kind === 'task' ? r.x : null; };
app.focusRes = () => { if (!app.view) return null; if (app.view.focusRes) return app.view.focusRes(); const r = app.view.focusRow && app.view.focusRow(); return r && r.x && r.kind === 'res' ? r.x : null; };
app.needTasks = (min = 1) => { const t = app.selTasks(); if (t.length < min) { UI.toast(min > 1 ? 'Pilih minimal ' + min + ' tugas' : 'Pilih tugas terlebih dahulu'); return null; } return t; };
app.reselect = uids => { if (app.view && app.view.selectUids) app.view.selectUids(uids); };

/* ---------------- edit sel ---------------- */
app.commitCell = (kind, r, k, v) => {
  const P = app.P;
  const f = F.reg(kind)[k];
  if (!f || !f.set) return false;
  let ok = true, newUid = null;
  const label = 'Ubah ' + F.title(k, P, kind);
  const done = app.tx(label, P2 => {
    let x = r.x;
    if (r.kind === 'blank') {
      if (kind === 'res') { x = M.newRes(P2, { name: 'Sumber Daya ' + (P2.res.length + 1) }); P2.res.push(x); }
      else { const lvl = P2.tasks.length ? P2.tasks[P2.tasks.length - 1].lvl : 1; x = M.newTask(P2, { name: '', lvl }); P2.tasks.push(x); if (P2.opts.autoLink === 'new') { /* no */ } }
      M.index(P2);
      newUid = x.uid;
      if (k !== 'name' && kind === 'task') x.name = '';
    } else if (kind === 'task') x = P2.byUid.get(r.x.uid) || x;
    else if (kind === 'res') x = P2.resByUid.get(r.x.uid) || x;
    if (kind === 'task') { M.index(P2); S.calc(P2); x = P2.byUid.get(x.uid); }
    if (kind === 'task' && x && x.root) { if (k === 'name') { P2.name = String(v).trim() || P2.name; return; } throw 'Ubah tanggal proyek lewat Proyek › Informasi Proyek'; }
    f.set(x, P2, v, P2._ctx);
  });
  if (!done) ok = false;
  if (ok && newUid && app.view && app.view.selectUids) app.view.selectUids([newUid]);
  if (ok && k === 'name' && kind === 'task' && r.x && r.x.root) { $('#doc-title').value = app.P.name; }
  return ok;
};

/* ---------------- daftar perintah ---------------- */
const def = (id, o) => { CMD[id] = o; };
app.cmd = (id, ...a) => {
  const c = CMD[id];
  if (!c) { const m = /^(\w+):(.+)$/.exec(id); if (m && CMD[m[1] + ':*']) return CMD[m[1] + ':*'].run(m[2], ...a); console.warn('cmd?', id); return; }
  if (c.enabled && !c.enabled()) { if (c.why) UI.toast(c.why()); return; }
  try { return c.run(...a); } catch (e) { console.error(e); UI.toast(String(e && e.message || e), { kind: 'bad' }); }
};
const needP = () => !!app.P;
const tv = () => app.isTaskView();
const selN = (n = 1) => () => tv() && app.selTasks().length >= n;

// berkas
def('home', { label: 'Beranda', icon: 'home', run: () => app.go('#/') });
def('new', { label: 'Proyek Baru', icon: 'note_add', key: U.MOD + '+N', run: () => AP.Home.newDialog() });
def('save', { label: 'Simpan', icon: 'save', key: U.MOD + '+S', run: async () => { app.dirty = true; await app.save(); UI.toast('Proyek disimpan', { key: 'save', ms: 1500 }); } });
def('saveCopy', { label: 'Simpan Salinan', icon: 'file_copy', run: async () => { const name = await UI.prompt('Simpan salinan', 'Nama salinan', app.P.name + ' (salinan)'); if (name == null) return; const c = M.fix(JSON.parse(JSON.stringify(M.clean(app.P)))); c.id = U.uid('p'); c.name = name.trim() || c.name; c.created = c.updated = Date.now(); delete c.lock; S.calc(c); await Store.put(c); UI.toast('Salinan dibuat', { action: { label: 'Buka', run: () => app.go('#/p/' + c.id) } }); } });
def('rename', { label: 'Ganti Nama', icon: 'edit', run: async () => { const n = await UI.prompt('Ganti nama proyek', 'Nama proyek', app.P.name); if (n == null || !n.trim()) return; app.tx('Ganti nama proyek', P => { P.name = n.trim(); P.props.title = P.name; }); $('#doc-title').value = app.P.name; document.title = app.P.name + ' — Amatu Project'; } });
def('versions', { label: 'Riwayat Versi', icon: 'history', run: () => AP.Dlg.versions() });
def('saveVersion', { label: 'Simpan Versi Bernama', icon: 'bookmark_add', run: async () => { const n = await UI.prompt('Simpan versi', 'Nama versi', 'Versi ' + U.fmtDate(U.now(), 'dd mmm yyyy HH.MM')); if (n == null) return; await app.save(); await Store.addVersion(app.P, n.trim() || 'Versi', false); UI.toast('Versi disimpan'); } });
def('print', { label: 'Cetak', icon: 'print', key: U.MOD + '+P', run: () => AP.Pr && AP.Pr.open(app, { pdf: false }) });
def('exportPdf', { label: 'PDF', icon: 'picture_as_pdf', run: () => AP.Pr && AP.Pr.open(app, { pdf: true }) });
def('exportXlsx', { label: 'Excel (.xlsx)', icon: 'grid_on', run: () => AP.IO.xlsxDialog(app) });
def('exportCsv', { label: 'CSV', icon: 'csv', run: () => AP.IO.exportCSV(app) });
def('exportXml', { label: 'Microsoft Project XML', icon: 'code', run: () => AP.IO.exportXML(app) });
def('exportJson', { label: 'File Amatu Project (.amproj)', icon: 'data_object', run: () => AP.IO.exportJSON(app) });
def('exportPng', { label: 'Gambar PNG', icon: 'image', run: () => AP.IO.exportPNG(app) });
def('exportIcs', { label: 'Kalender (.ics)', icon: 'event', run: () => AP.IO.exportICS(app) });
def('import', { label: 'Impor', icon: 'upload_file', run: () => AP.IO.importDialog(app) });
def('options', { label: 'Opsi', icon: 'settings', run: () => AP.Dlg.options() });
def('lock', { label: 'Kunci dengan Kata Sandi', icon: 'lock', run: () => AP.Lock && AP.Lock.dialog(app) });
def('share', { label: 'Bagikan', icon: 'share', run: () => AP.Share && AP.Share.dialog(app) });
def('theme:*', { run: v => { Store.pref('theme', v); app.applyTheme(); AP.Ribbon.refresh(); } });

// edit
def('undo', { label: 'Batalkan', icon: 'undo', key: U.MOD + '+Z', enabled: () => app.hist.undo.length > 0, run: () => app.undo() });
def('redo', { label: 'Ulangi', icon: 'redo', key: U.MOD + '+Y', enabled: () => app.hist.redo.length > 0, run: () => app.redo() });
def('copy', { label: 'Salin', icon: 'content_copy', key: U.MOD + '+C', run: () => app.copy(false) });
def('cut', { label: 'Potong', icon: 'content_cut', key: U.MOD + '+X', run: () => app.copy(true) });
def('paste', { label: 'Tempel', icon: 'content_paste', key: U.MOD + '+V', run: text => app.paste(text) });
def('fillDown', { label: 'Isi ke Bawah', icon: 'south', key: U.MOD + '+D', run: () => app.fillDown() });
def('clearCells', { label: 'Hapus Isi', icon: 'backspace', run: () => app.clearCells() });
def('find', { label: 'Cari', icon: 'search', key: U.MOD + '+F', run: () => AP.Dlg.find(false) });
def('replace', { label: 'Ganti', icon: 'find_replace', key: U.MOD + '+H', run: () => AP.Dlg.find(true) });
def('goto', { label: 'Pergi ke', icon: 'move_down', key: 'F5', run: () => AP.Dlg.goto() });
def('scrollTask', { label: 'Gulir ke Tugas', icon: 'center_focus_strong', key: U.MOD + '+Shift+F5', run: () => { const t = app.focusTask(); if (!t) { UI.toast('Pilih tugas'); return; } if (app.view.scrollToTask) app.view.scrollToTask(t); } });
def('selMove', { run: d => { const g = app.view && app.view.grid; if (!g) return; const i = g.idx(g.focusKey); g.selectIdx(i + d); } });

// tugas
const insertAt = (P, kind) => {
  const sel = app.selTasks();
  const g = app.view && app.view.grid;
  const fr = g && g.focusRow();
  let at = P.tasks.length;
  if (sel.length) at = sel[0].id - 1;
  else if (fr && fr.kind === 'blank') at = P.tasks.length;
  return { at, sel };
};
def('insertRow', { label: 'Tugas', icon: 'add_task', key: 'Insert', enabled: () => tv(), why: () => 'Buka tampilan tugas (mis. Bagan Gantt) untuk menyisipkan tugas', run: () => {
  let uid = null;
  app.tx('Sisipkan tugas', P => {
    const { at } = insertAt(P);
    const ref = P.tasks[at] || null;
    const t = M.newTask(P, { name: 'Tugas Baru', lvl: ref ? ref.lvl : (P.tasks.length ? P.tasks[P.tasks.length - 1].lvl : 1) });
    M.insertTasks(P, at, [t]);
    uid = t.uid;
    if (P.opts.autoLink) autoLinkInsert(P, t);
  });
  app.reselect([uid]); setTimeout(() => app.view.grid && app.view.grid.edit(), 30);
} });
function autoLinkInsert(P, t) {
  // Project: inserting a task inside a linked FS chain links it into the chain
  M.index(P);
  const i = t.id - 1, prev = P.tasks[i - 1], next = P.tasks[i + 1];
  if (!prev || !next || prev.sum || next.sum || prev.lvl !== t.lvl || next.lvl !== t.lvl) return;
  const L = next.pred.find(x => x.uid === prev.uid && x.type === 'FS');
  if (!L) return;
  next.pred = next.pred.filter(x => x !== L);
  t.pred.push({ ...L, uid: prev.uid });
  next.pred.push({ uid: t.uid, type: 'FS', lag: 0, lagU: L.lagU, pct: null, el: false });
}
def('insertMilestone', { label: 'Tonggak', icon: 'diamond', enabled: () => tv(), run: () => {
  let uid = null;
  app.tx('Sisipkan tonggak', P => { const { at } = insertAt(P); const ref = P.tasks[at]; const t = M.newTask(P, { name: 'Tonggak Baru', dur: 0, est: false, lvl: ref ? ref.lvl : 1 }); M.insertTasks(P, at, [t]); uid = t.uid; });
  app.reselect([uid]); setTimeout(() => app.view.grid && app.view.grid.edit(), 30);
} });
def('insertSummary', { label: 'Ringkasan', icon: 'subtitles', enabled: () => tv(), run: () => {
  let uid = null;
  app.tx('Sisipkan tugas ringkasan', P => {
    const sel = app.selTasks().filter(x => !x.root);
    M.index(P);
    if (sel.length) {
      // the new summary goes above the selection, which is indented under it
      const first = P.byUid.get(sel[0].uid), at = first.id - 1;
      const t = M.newTask(P, { name: 'Tugas Ringkasan Baru', lvl: first.lvl });
      M.insertTasks(P, at, [t]); uid = t.uid;
      M.indent(P, sel.map(x => x.uid));
    } else { const t = M.newTask(P, { name: 'Tugas Ringkasan Baru', lvl: 1 }); const k = M.newTask(P, { name: 'Subtugas Baru', lvl: 2 }); P.tasks.push(t, k); uid = t.uid; }
  });
  app.reselect([uid]); setTimeout(() => app.view.grid && app.view.grid.edit(), 30);
} });
def('insertRecurring', { label: 'Tugas Berulang…', icon: 'event_repeat', enabled: () => tv(), run: () => AP.Dlg.recurring() });
def('insertBlank', { label: 'Baris Kosong', icon: 'table_rows', enabled: () => tv(), run: () => CMD.insertRow.run() });
def('insertSub', { label: 'Subproyek…', icon: 'library_add', enabled: () => tv(), run: () => AP.Dlg.insertProject() });
def('deleteRows', { label: 'Hapus Tugas', icon: 'delete', key: 'Delete', run: async () => {
  if (app.isTaskView()) {
    const sel = app.selTasks();
    if (!sel.length) return;
    const sums = sel.filter(t => t.sum).length;
    if (sums && !(await UI.confirm(`Menghapus ${sums > 1 ? sums + ' tugas ringkasan' : 'tugas ringkasan "' + sel.find(t => t.sum).name + '"'} juga menghapus semua subtugasnya. Lanjutkan?`, { ok: 'Hapus', danger: true }))) return;
    const g = app.view.grid, i = g ? g.idx(g.focusKey) : -1;
    app.tx('Hapus tugas', P => { M.deleteTasks(P, sel.map(t => t.uid)); });
    if (g && i >= 0) g.selectIdx(Math.min(i, g.rows.length - 1));
  } else if (app.selRes().length) CMD.deleteRes.run();
} });
def('indent', { label: 'Turunkan Tingkat', icon: 'format_indent_increase', key: 'Alt+Shift+→', enabled: selN(), run: () => { const s = app.selTasks(); app.tx('Indent', P => { if (!M.indent(P, s.map(t => t.uid))) return false; }); app.reselect(s.map(t => t.uid)); } });
def('outdent', { label: 'Naikkan Tingkat', icon: 'format_indent_decrease', key: 'Alt+Shift+←', enabled: selN(), run: () => { const s = app.selTasks(); app.tx('Outdent', P => { if (!M.outdent(P, s.map(t => t.uid))) return false; }); app.reselect(s.map(t => t.uid)); } });
def('moveUp', { label: 'Pindah ke Atas', icon: 'arrow_upward', enabled: selN(), run: () => moveSel(-1) });
def('moveDown', { label: 'Pindah ke Bawah', icon: 'arrow_downward', enabled: selN(), run: () => moveSel(1) });
function moveSel(d) {
  const s = app.selTasks();
  if (!s.length) return;
  app.tx('Pindahkan tugas', P => {
    M.index(P);
    const first = P.byUid.get(s[0].uid), last = P.byUid.get(s[s.length - 1].uid);
    if (d < 0) {
      // before the previous sibling (or the row above)
      let i = first.id - 2;
      while (i >= 0 && P.tasks[i].lvl > first.lvl) i--;
      if (i < 0) return false;
      return M.moveTasks(P, s.map(t => t.uid), i) || false;
    }
    const end = M.subtreeEnd(P, last.id - 1);
    if (end >= P.tasks.length) return false;
    const nxt = P.tasks[end], after = M.subtreeEnd(P, end);
    return M.moveTasks(P, s.map(t => t.uid), after) || false;
  });
  app.reselect(s.map(t => t.uid));
}
app.moveRows = (keys, to, rows) => {
  const uids = keys.map(k => rows.find(r => r.key === k)).filter(r => r && r.kind === 'task' && r.x && !r.x.root).map(r => r.x.uid);
  if (!uids.length) return;
  const target = rows[to];
  app.tx('Pindahkan tugas', P => {
    M.index(P);
    const at = target && target.kind === 'task' && target.x && !target.x.root ? P.byUid.get(target.x.uid).id - 1 : P.tasks.length;
    return M.moveTasks(P, uids, at) || false;
  });
  app.reselect(uids);
};
def('link', { label: 'Tautkan Tugas', icon: 'link', key: U.MOD + '+F2', enabled: selN(1), run: () => {
  const s = app.selTasks();
  if (s.length === 1) { UI.toast('Pilih dua tugas atau lebih untuk ditautkan (Shift/' + U.MOD + '+klik)'); return; }
  app.tx('Tautkan tugas', P => { if (!M.link(P, s.map(t => t.uid))) { UI.toast('Tugas sudah tertaut, atau tautan akan melingkar'); return false; } });
} });
def('unlink', { label: 'Putuskan Tautan', icon: 'link_off', key: U.MOD + '+Shift+F2', enabled: selN(1), run: () => { const s = app.selTasks(); app.tx('Putuskan tautan', P => { if (!M.unlink(P, s.map(t => t.uid))) return false; }); } });
def('linkPair', { run: (a, b) => {
  app.tx('Tautkan tugas', P => {
    M.index(P);
    const A = P.byUid.get(a.uid), B = P.byUid.get(b.uid);
    if (!A || !B) return false;
    if (M.isAncestor(A, B) || M.isAncestor(B, A)) { UI.toast('Tugas ringkasan tidak dapat ditautkan ke subtugasnya'); return false; }
    if (B.pred.some(L => L.uid === A.uid)) { UI.toast('Kedua tugas sudah tertaut'); return false; }
    if (M.wouldLoop(P, A, B)) { UI.toast('Tautan ini akan membuat ketergantungan melingkar', { kind: 'bad' }); return false; }
    B.pred.push({ uid: A.uid, type: 'FS', lag: 0, lagU: P.opts.durU, pct: null, el: false });
  });
} });
def('linkDlg', { run: (p, s) => AP.Dlg.link(p, s) });
def('setLink', { run: (t, L, ch) => {
  app.tx('Ubah tautan', P => {
    const x = P.byUid.get(t.uid), LL = x && x.pred.find(q => q.uid === L.uid);
    if (!LL) return false;
    if (ch.type) LL.type = ch.type;
    if (ch.lagText != null) { const lg = D.parseLag(ch.lagText, P.opts); if (!lg) throw 'Lag tidak dikenali: ' + ch.lagText; Object.assign(LL, lg); }
    if (ch.del) x.pred = x.pred.filter(q => q !== LL);
  });
} });
def('split', { label: 'Pisahkan Tugas', icon: 'call_split', enabled: selN(), run: () => AP.Dlg.split() });
def('inactivate', { label: 'Nonaktifkan', icon: 'block', enabled: selN(), checked: () => { const s = app.selTasks(); return s.length > 0 && s.every(t => t.active === false); }, run: () => { const s = app.selTasks(); const on = !s.every(t => t.active === false); app.tx(on ? 'Nonaktifkan tugas' : 'Aktifkan tugas', P => { for (const t of s) P.byUid.get(t.uid).active = !on; }); } });
def('manual', { label: 'Jadwalkan Manual', icon: 'push_pin', enabled: selN(), checked: () => { const s = app.selTasks(); return s.length > 0 && s.every(t => t.mode === 'manual'); }, run: () => { const s = app.selTasks(); app.tx('Jadwalkan manual', P => { for (const t of s) { const x = P.byUid.get(t.uid); if (x.mode !== 'manual') { x.mode = 'manual'; x.mStart = x.start; x.mFinish = null; } } }); } });
def('auto', { label: 'Jadwalkan Otomatis', icon: 'event_repeat', enabled: selN(), checked: () => { const s = app.selTasks(); return s.length > 0 && s.every(t => t.mode !== 'manual'); }, run: () => { const s = app.selTasks(); app.tx('Jadwalkan otomatis', P => { for (const t of s) { const x = P.byUid.get(t.uid); x.mode = 'auto'; x.mStart = null; x.mFinish = null; } }); } });
def('respectLinks', { label: 'Hormati Tautan', icon: 'link', enabled: selN(), run: () => { const s = app.selTasks(); app.tx('Hormati tautan', P => { const E = S.engine(P); for (const t of s) { const x = P.byUid.get(t.uid); const req = E.linkStart(x); if (req != null && x.mode === 'manual') { x.mStart = req; x.mFinish = null; } else if (req != null && x.cons === 'SNET' && x.consDate < req) x.consDate = null, x.cons = 'ASAP'; } }); } });
def('pct:*', { run: v => { const s = app.selTasks(); if (!s.length) { UI.toast('Pilih tugas'); return; } app.cmd('setPct', s, +v); } });
def('setPct', { run: (list, v) => { app.tx('% selesai ' + v + '%', P => { for (const t of list) { const x = P.byUid.get(t.uid); if (x) M.setPct(P, x, v, P._ctx); } }); } });
def('markOnTrack', { label: 'Tandai Sesuai Jadwal', icon: 'task_alt', enabled: selN(), run: () => { const s = app.selTasks(); app.tx('Tandai sesuai jadwal', P => { const sd = P.statusDate != null ? P.statusDate : U.now(); for (const t of s) M.markOnTrack(P, P.byUid.get(t.uid), sd, P._ctx); }); } });
def('updateTasks', { label: 'Perbarui Tugas…', icon: 'edit_calendar', enabled: selN(), run: () => AP.Dlg.updateTasks() });
def('moveTask:*', { run: v => {
  const s = app.selTasks(); if (!s.length) { UI.toast('Pilih tugas'); return; }
  if (v === 'custom') { AP.Dlg.moveTasks(); return; }
  const P0 = app.P;
  const days = { f1d: 1, f1w: 5, f4w: 20, b1d: -1, b1w: -5, b4w: -20 }[v];
  app.tx('Pindahkan tugas', P => {
    const C = P._ctx;
    for (const t of s) {
      const x = P.byUid.get(t.uid);
      if (!x || x.sum) continue;
      if (v === 'sd') { const sd = P.statusDate != null ? P.statusDate : U.now(); if (x.start < sd && x.pct < 100) { if (x.pct > 0) { const off = Math.round(x.dur * x.pct / 100); x.splits = [[off, Math.max(0, C.between(x.calId, C.add(x.calId, x.start, off), C.next(x.calId, sd)))]]; } else { x.cons = 'SNET'; x.consDate = C.next(x.calId, sd); } } continue; }
      if (v === 'res') continue;
      const d = days * P.opts.hpd * 60;
      const ns = d >= 0 ? C.add(x.calId, x.start, d) : C.sub(x.calId, x.start, -d);
      if (x.mode === 'manual') x.mStart = C.next(x.calId, ns); else { x.cons = 'SNET'; x.consDate = C.next(x.calId, ns); }
    }
  });
  void P0;
} });
def('dragMove', { run: (t, s) => {
  app.tx('Pindahkan tugas', P => {
    const x = P.byUid.get(t.uid), C = P._ctx;
    if (!x) return false;
    const ns = F.isMs(x) ? C.point(x.calId, s) : C.next(x.calId, s);
    if (x.pct > 0 && x.aStart != null) { x.aStart = ns; return; }
    if (x.mode === 'manual') { const d = x.dur; x.mStart = ns; x.mFinish = null; x.dur = d; } else { x.cons = 'SNET'; x.consDate = ns; }
  });
} });
def('dragSize', { run: (t, f) => {
  app.tx('Ubah durasi', P => {
    const x = P.byUid.get(t.uid), C = P._ctx;
    if (!x) return false;
    const fin = C.prevEnd(x.calId, f);
    let d = Math.max(0, x.el ? fin - x.start : C.between(x.calId, x.start, fin));
    // round to the duration unit like Project (days → whole days when zoomed out)
    const per = D.per(x.durU || 'd', P.opts);
    if (x.durU === 'd' || x.durU === 'w' || x.durU === 'mo') d = Math.max(per / (x.durU === 'd' ? 2 : 1), Math.round(d / (P.opts.hpd * 30)) * P.opts.hpd * 30);
    x.est = false;
    if (x.mode === 'manual' && x.mFinish != null) x.mFinish = null;
    M.setDur(P, x, Math.round(d));
  });
} });
def('taskInfo', { label: 'Informasi Tugas', icon: 'info', key: 'Shift+F2', run: t => { t = t || app.focusTask(); if (!t) { UI.toast('Pilih tugas'); return; } if (t.root) { CMD.projectInfo.run(); return; } AP.Dlg.taskInfo(t); } });
def('notes', { label: 'Catatan', icon: 'sticky_note_2', run: () => { const t = app.focusTask(); if (!t) { UI.toast('Pilih tugas'); return; } AP.Dlg.taskInfo(t, 'notes'); } });
def('details', { label: 'Rincian', icon: 'splitscreen_bottom', checked: () => !!(app.P && V.vs(app.P).split.detail), run: () => app.toggleDetail() });
def('addTimeline', { label: 'Tambahkan ke Garis Waktu', icon: 'add_road', enabled: selN(), run: () => { const s = app.selTasks(); const on = !s.every(t => t.tl); app.tx(on ? 'Tambahkan ke garis waktu' : 'Hapus dari garis waktu', P => { for (const t of s) P.byUid.get(t.uid).tl = on; }); if (on && !V.vs(app.P).split.tl && V.def(app.viewId).type !== 'timeline') app.toggleTimeline(true); } });
def('inspect', { label: 'Periksa Tugas', icon: 'manage_search', run: () => { const t = app.focusTask(); if (!t) { UI.toast('Pilih tugas'); return; } AP.Dlg.inspect(t); } });
def('toggleRow', { run: t => { if (!t || !t.sum) return; app.tx(t.col ? 'Perluas' : 'Ciutkan', P => { const x = P.byUid.get(t.uid); x.col = !x.col; }, {}); } });
def('collapse', { label: 'Ciutkan', run: () => { const s = app.selTasks().filter(t => t.sum); if (!s.length) { const t = app.focusTask(); if (t && t.parent) s.push(t.parent); } if (!s.length) return; app.tx('Ciutkan', P => { for (const t of s) P.byUid.get(t.uid).col = true; }); app.reselect(s.map(t => t.uid)); } });
def('expand', { label: 'Perluas', run: () => { const s = app.selTasks().filter(t => t.sum); if (!s.length) return; app.tx('Perluas', P => { for (const t of s) P.byUid.get(t.uid).col = false; }); } });
def('outline:*', { run: v => { const P = app.P, vs = V.vs(P); if (v === 'all') { vs.outlineLvl = null; app.tx('Tampilkan semua subtugas', P2 => { for (const t of P2.tasks) t.col = false; }); } else { vs.outlineLvl = +v; for (const t of P.tasks) t.col = false; app.viewChanged(); app.refresh(); } } });
def('outlineAll', { run: () => app.cmd('outline:all') });
def('autoLinkToggle', { label: 'Tautkan otomatis', checked: () => !!(app.P && app.P.opts.autoLink), run: () => app.tx('Opsi tautan otomatis', P => { P.opts.autoLink = !P.opts.autoLink; }) });
def('newMode:*', { run: v => app.tx('Mode tugas baru', P => { P.opts.newAuto = v === 'auto'; }) });

// sumber daya
def('assignDlg', { label: 'Tetapkan Sumber Daya', icon: 'group_add', key: 'Alt+F10', run: () => AP.Dlg.assign() });
def('addRes:*', { run: type => {
  let uid = null;
  app.tx('Tambah sumber daya', P => { const n = { work: 'Sumber Daya Baru', material: 'Material Baru', cost: 'Biaya Baru' }[type] || 'Sumber Daya Baru'; const r = M.newRes(P, { name: uniqueName(P, n), type, mat: type === 'material' ? 'unit' : '' }); r.ini = r.name.slice(0, 1); P.res.push(r); uid = r.uid; });
  if (!/^(rsheet|rusage)$/.test(app.viewId)) app.setView('rsheet');
  setTimeout(() => { if (app.view.selectUids) app.view.selectUids([uid]); app.view.grid && (app.view.grid.colKey = 'name', app.view.grid.edit()); }, 40);
} });
function uniqueName(P, base) { let n = base, i = 2; while (P.res.some(r => r.name === n)) n = base + ' ' + i++; return n; }
def('resInfo', { label: 'Informasi Sumber Daya', icon: 'badge', run: r => { r = r || app.focusRes(); if (!r) { UI.toast('Pilih sumber daya (buka Lembar Sumber Daya)'); return; } AP.Dlg.resInfo(r); } });
def('deleteRes', { label: 'Hapus Sumber Daya', icon: 'person_remove', run: async () => {
  const s = app.selRes(); if (!s.length) return;
  const n = U.sum(s, r => (app.P.asgR.get(r.uid) || []).length);
  if (n && !(await UI.confirm(`Sumber daya ini punya ${n} penugasan. Hapus sumber daya beserta penugasannya?`, { ok: 'Hapus', danger: true }))) return;
  app.tx('Hapus sumber daya', P => { const ids = new Set(s.map(r => r.uid)); P.res = P.res.filter(r => !ids.has(r.uid)); P.asg = P.asg.filter(a => !ids.has(a.r)); });
} });
def('level:*', { run: v => {
  if (v === 'opts') { AP.Dlg.levelOpts(); return; }
  if (v === 'clear') { const s = app.selTasks(); app.tx('Hapus pemerataan', P => { const n = S.clearLevel(P, s.length > 1 ? s.map(t => t.uid) : null); for (const t of P.tasks) t.pre = null; if (!n) return false; }); UI.toast('Penundaan pemerataan dihapus'); return; }
  let n = 0;
  const uids = v === 'sel' ? app.selTasks().map(t => t.uid) : v === 'res' ? null : null;
  const resSel = v === 'res' ? app.selRes().map(r => r.uid) : null;
  if (v === 'sel' && !uids.length) { UI.toast('Pilih tugas yang akan diratakan'); return; }
  app.tx('Ratakan sumber daya', P => {
    for (const t of P.tasks) t.pre = [t.start, t.finish];
    let scope = uids;
    if (resSel && resSel.length) scope = P.asg.filter(a => resSel.includes(a.r)).map(a => a.t);
    n = S.level(P, { uids: scope });
  });
  const over = app.P.res.filter(r => r.over).length;
  UI.toast(n ? `${n} tugas digeser agar sumber daya tidak teralokasi berlebih${over ? ` · ${over} masih berlebih` : ''}` : over ? 'Tidak dapat meratakan: alokasi berlebih tidak bisa diselesaikan dengan menunda tugas' : 'Tidak ada alokasi berlebih', { ms: 4200 });
} });
def('nextOver', { label: 'Alokasi Berlebih Berikutnya', icon: 'skip_next', run: () => {
  const P = app.P, g = app.view && app.view.grid;
  if (!g) return;
  const i0 = g.idx(g.focusKey);
  const rows = g.rows;
  for (let k = 1; k <= rows.length; k++) { const r = rows[(i0 + k) % rows.length]; if (r.x && r.x.over && !r.x.sum) { g.selectIdx(rows.indexOf(r)); if (app.view.scrollToTask && r.kind === 'task') app.view.scrollToTask(r.x); return; } }
  UI.toast('Tidak ada alokasi berlebih lagi');
} });
def('setAsgUnits', { run: (t, a, txt) => app.tx('Ubah unit', P => {
  const x = P.byUid.get(t.uid), as = P.asg.find(q => q.uid === a.uid), r = P.resByUid.get(as.r);
  const v = U.parseNum(String(txt).replace('%', ''));
  if (!isFinite(v) || v < 0) throw 'Unit tidak valid';
  if (r.type === 'work') M.setUnits(P, x, as, /%/.test(txt) || v > 5 ? v / 100 : v);
  else { as.units = v; as.work = v; }
}) });
def('setAsgWork', { run: (t, a, txt) => app.tx('Ubah kerja penugasan', P => {
  const x = P.byUid.get(t.uid), as = P.asg.find(q => q.uid === a.uid);
  const w = D.parseWork(txt, P.opts);
  if (w == null) throw 'Kerja tidak valid';
  as.work = w;
  if (x.type !== 'FD') { const ws = M.workRes(P, x); x.dur = Math.round(Math.max(...ws.map(q => (q.units > 0 ? q.work / q.units : 0)), 0)); }
  else as.units = x.dur > 0 ? w / x.dur : as.units;
}) });

// proyek
def('projectInfo', { label: 'Informasi Proyek', icon: 'info', run: () => AP.Dlg.projectInfo() });
def('stats', { label: 'Statistik Proyek', icon: 'query_stats', run: () => AP.Dlg.stats() });
def('workTime', { label: 'Ubah Waktu Kerja', icon: 'schedule', run: c => AP.Dlg.workTime(c) });
def('customFields', { label: 'Kolom Kustom', icon: 'tune', run: () => AP.Dlg.customFields() });
def('wbsDef', { label: 'Definisi Kode WBS', icon: 'format_list_numbered', run: () => AP.Dlg.wbs() });
def('calcNow', { label: 'Hitung Proyek', icon: 'calculate', key: 'F9', run: () => { app._calcOnce = true; app.recalc(); app.refresh(); UI.toast('Jadwal dihitung ulang (' + (app.P.calcMs || 0) + ' md)', { ms: 1400 }); } });
def('baseline', { label: 'Tetapkan Garis Dasar', icon: 'flag', run: () => AP.Dlg.baseline() });
def('clearBaseline', { label: 'Hapus Garis Dasar', icon: 'flag', run: () => AP.Dlg.baseline(true) });
def('moveProject', { label: 'Pindahkan Proyek', icon: 'start', run: () => AP.Dlg.moveProject() });
def('statusDate', { label: 'Tanggal Status', icon: 'event_available', run: () => AP.Dlg.statusDate() });
def('updateProject', { label: 'Perbarui Proyek', icon: 'update', run: () => AP.Dlg.updateProject() });

// tampilan
def('view:*', { run: v => app.setView(v) });
def('report:*', { run: v => app.setView('report:' + v) });
def('table:*', { run: v => { const P = app.P; if (v === 'more') { AP.Dlg.tables(); return; } V.vs(P).table[app.viewId] = v; app.viewChanged(); app.refresh(); } });
def('filter:*', { run: (v, arg) => app.applyFilter('filter', v, arg) });
def('hl:*', { run: (v, arg) => app.applyFilter('hl', v, arg) });
def('group:*', { run: v => { const P = app.P, kind = app.kind(); if (v === 'custom') { AP.Dlg.groupBy(); return; } V.vs(P).group[kind] = v === 'none' ? null : { id: v }; app.viewChanged(); app.refresh(); } });
def('sort:*', { run: v => { const P = app.P, kind = app.kind(); if (v === 'custom') { AP.Dlg.sort(); return; } V.vs(P).sort[kind] = v === 'id' ? null : { id: v, outline: true }; app.viewChanged(); app.refresh(); } });
def('autoFilter', { label: 'AutoFilter', icon: 'filter_list', checked: () => !!(app.P && V.vs(app.P).afOn), run: () => { const vs = V.vs(app.P); vs.afOn = !vs.afOn; if (!vs.afOn) vs.af = {}; app.viewChanged(); app.refresh(); } });
def('clearFilter', { label: 'Hapus Filter', icon: 'filter_alt_off', run: () => { const vs = V.vs(app.P), k = app.kind(); vs.filter[k] = null; vs.hl[k] = null; vs.af[k] = {}; app.viewChanged(); app.refresh(); } });
def('zoomIn', { label: 'Perbesar', icon: 'zoom_in', run: () => app.zoom(1) });
def('zoomOut', { label: 'Perkecil', icon: 'zoom_out', run: () => app.zoom(-1) });
def('zoomEntire', { label: 'Seluruh Proyek', icon: 'fit_screen', run: () => { const v = app.view, P = app.P; if (v && v.chart) { v.chart.fitRange(P.root.start, P.root.finish); } else if (v && v.fit) v.fit(); } });
def('zoomSel', { label: 'Tugas yang Dipilih', icon: 'center_focus_weak', run: () => { const s = app.selTasks(), v = app.view; if (!s.length) { UI.toast('Pilih tugas'); return; } if (v && v.chart) v.chart.fitRange(Math.min(...s.map(t => t.start)), Math.max(...s.map(t => t.finish))); } });
def('tsUnit:*', { run: u => { const v = app.view; if (!v || !v.chart) return; const ppd = { year: 0.5, half: 0.8, quarter: 1.4, month: 4.5, third: 8, week: 16, day: 64, hour: 420 }[u] || 18; v.chart.setZoom(ppd); } });
def('timescaleDlg', { label: 'Skala Waktu…', icon: 'calendar_view_week', run: () => AP.Dlg.timescale() });
def('timeline', { label: 'Garis Waktu', icon: 'linear_scale', checked: () => !!(app.P && V.vs(app.P).split.tl), run: () => app.toggleTimeline() });
def('detailPane:*', { run: v => app.toggleDetail(v === 'none' ? null : v) });

// format
const gopt = (k, d) => { const P = app.P; const g = (P.view && P.view.gantt) || {}; return g[k] == null ? d : g[k]; };
const setG = (label, k, v) => { const P = app.P; V.vs(P).gantt ||= {}; P.view.gantt[k] = v; app.viewChanged(); app.refresh(); void label; };
def('fmtCrit', { label: 'Tugas Kritis', checked: () => !!app.P && gopt('crit', true) !== false, run: () => setG('Tugas kritis', 'crit', !gopt('crit', true)) });
def('fmtSlack', { label: 'Slack', checked: () => !!app.P && !!gopt('slack', false), run: () => setG('Slack', 'slack', !gopt('slack', false)) });
def('fmtLate', { label: 'Tugas Terlambat', checked: () => !!app.P && !!gopt('late', false), run: () => setG('Terlambat', 'late', !gopt('late', false)) });
def('fmtProgLine', { label: 'Garis Kemajuan', checked: () => !!app.P && !!gopt('progLine', false), run: () => { if (app.P.statusDate == null) UI.toast('Garis kemajuan memakai Tanggal Status (Proyek › Tanggal Status)'); setG('Garis kemajuan', 'progLine', !gopt('progLine', false)); } });
def('fmtBase:*', { run: v => setG('Garis dasar', 'base', v === 'none' ? null : +v) });
def('fmtOutlineNum', { label: 'Nomor Kerangka', checked: () => !!(app.P && app.P.opts.outlineNum), run: () => app.tx('Nomor kerangka', P => { P.opts.outlineNum = !P.opts.outlineNum; }) });
def('fmtProjSum', { label: 'Tugas Ringkasan Proyek', checked: () => !!(app.P && app.P.opts.projSum), run: () => app.tx('Ringkasan proyek', P => { P.opts.projSum = !P.opts.projSum; }) });
def('fmtSum', { label: 'Tugas Ringkasan', checked: () => !!(app.P && app.P.opts.showSum !== false), run: () => app.tx('Tugas ringkasan', P => { P.opts.showSum = P.opts.showSum === false; }) });
def('fmtPB', { label: 'Pemisah Halaman', checked: () => !!app.P && !!gopt('pb', false), run: () => setG('Pemisah halaman', 'pb', !gopt('pb', false)) });
def('pageBreak', { label: 'Sisipkan Pemisah Halaman', icon: 'insert_page_break', enabled: selN(), run: () => { const s = app.selTasks(); const on = !s[0].pb; app.tx(on ? 'Sisipkan pemisah halaman' : 'Hapus pemisah halaman', P => { P.byUid.get(s[0].uid).pb = on; }); if (on && !gopt('pb', false)) setG('', 'pb', true); UI.toast(on ? 'Pemisah halaman disisipkan di atas tugas ' + s[0].id + ' (dipakai saat mencetak)' : 'Pemisah halaman dihapus'); } });
def('barStyles', { label: 'Gaya Batang…', icon: 'format_paint', run: () => AP.Dlg.barStyles() });
def('textStyles', { label: 'Gaya Teks…', icon: 'text_format', run: () => AP.Dlg.textStyles() });
def('layoutDlg', { label: 'Tata Letak…', icon: 'dashboard_customize', run: () => AP.Dlg.layout() });
def('gridlines', { label: 'Garis Kisi…', icon: 'grid_4x4', run: () => AP.Dlg.gridlines() });
def('formatBar', { label: 'Format Batang…', icon: 'format_color_fill', enabled: selN(), run: () => AP.Dlg.formatBar() });
def('ganttStyle:*', { run: v => { const st = AP.Dlg.GANTT_STYLES[v]; if (!st) return; app.tx('Gaya Gantt', P => { P.bars = U.deep(st.bars); }); } });
def('insertCol', { label: 'Sisipkan Kolom', icon: 'view_column', run: () => app.insertColumn() });
def('colSettings', { label: 'Pengaturan Kolom', icon: 'settings_ethernet', run: () => { const g = app.view && app.view.grid; if (!g) return; const c = g.cols.find(x => x.k === g.colKey); if (c) AP.Dlg.fieldSettings(app.view, c); } });
def('fieldSettings', { run: (view, c) => AP.Dlg.fieldSettings(view, c) });
def('fontStyle:*', { run: v => { const s = app.selTasks(); if (!s.length) { UI.toast('Pilih tugas'); return; } app.tx('Format teks', P => { for (const t of s) { const x = P.byUid.get(t.uid); x.style ||= {}; if (v === 'b' || v === 'i' || v === 'u') x.style[v] = !s[0].style || !s[0].style[v]; else if (v === 'clear') delete x.style; } }); } });
def('fontColor', { run: c => { const s = app.selTasks(); if (!s.length) return; app.tx('Warna teks', P => { for (const t of s) { const x = P.byUid.get(t.uid); x.style ||= {}; if (c) x.style.c = c; else delete x.style.c; } }); } });
def('barColor', { run: c => { const s = app.selTasks(); if (!s.length) return; app.tx('Warna batang', P => { for (const t of s) { const x = P.byUid.get(t.uid); if (c) x.color = c; else delete x.color; } }); } });

// bantuan
def('shortcuts', { label: 'Pintasan Keyboard', icon: 'keyboard', run: () => AP.Dlg.shortcuts() });
def('about', { label: 'Tentang Amatu Project', icon: 'help', run: () => AP.Dlg.about() });
def('tellme', { run: () => { const i = $('#tellme'); if (i) i.focus(); } });

app.kind = () => V.def(app.viewId.split(':')[0]).kind || 'task';
app.applyFilter = async (where, v, arg) => {
  const P = app.P, kind = app.kind(), vs = V.vs(P);
  if (v === 'custom') { AP.Dlg.customFilter(where); return; }
  if (v === 'all' || v === 'none') { vs[where][kind] = null; app.viewChanged(); app.refresh(); return; }
  const f = V.FILTERS[kind].find(x => x[0] === v);
  if (!f) return;
  let a = arg;
  if (f[3] === 'res' && a == null) {
    const r = await AP.Dlg.pickRes('Filter: Menggunakan Sumber Daya', 'Tampilkan tugas yang menggunakan');
    if (r == null) return; a = r;
  } else if (f[3] === 'range' && a == null) {
    a = await AP.Dlg.pickRange();
    if (!a) return;
  } else if (f[3] === 'text' && a == null) {
    const s = await UI.prompt(f[1].replace('…', ''), 'Nilai', ''); if (s == null) return; a = s;
  }
  vs[where][kind] = { id: v, arg: a };
  app.viewChanged(); app.refresh();
};
app.zoom = d => {
  const v = app.view;
  if (v && v.chart) v.chart.zoomStep(d);
  else if (v && v.zoom) v.zoom(d);
};
app.updateZoomUI = () => AP.Ribbon.statusZoom && AP.Ribbon.statusZoom();
app.updateStatus = () => AP.Ribbon.status && AP.Ribbon.status();

/* ---------------- papan klip ---------------- */
app.copy = async (cut) => {
  const g = app.view && app.view.grid;
  if (!g) return;
  const rows = g.selected().filter(r => r.x && r.kind !== 'blank' && r.kind !== 'group');
  if (!rows.length) return;
  const P = app.P, kind = g.kind === 'res' ? 'res' : 'task';
  const ci = g.cols.findIndex(c => c.k === g.colKey), ca = g.colA != null ? g.cols.findIndex(c => c.k === g.colA) : ci;
  const whole = g.wholeRow;
  const cols = whole ? g.cols : g.cols.slice(Math.min(ci, ca), Math.max(ci, ca) + 1);
  const tsv = (whole ? [cols.map(c => F.title(c.k, P, kind))] : []).concat(rows.map(r => cols.map(c => F.text(r.kind === 'res' ? 'res' : 'task', c.k, r.x, P).replace(/[\t\n]/g, ' ')))).map(a => a.join('\t')).join('\n');
  await U.copyText(tsv);
  app.clip = { tsv, tasks: whole && kind === 'task' ? M.copyTasks(P, rows.map(r => r.x.uid)) : null, res: whole && kind === 'res' ? rows.map(r => U.deep(M.clean({ res: [r.x] }).res[0])) : null };
  if (cut) {
    if (whole && kind === 'task') app.tx('Potong tugas', P2 => { M.deleteTasks(P2, rows.map(r => r.x.uid)); });
    else if (whole && kind === 'res') app.tx('Potong sumber daya', P2 => { const ids = new Set(rows.map(r => r.x.uid)); P2.res = P2.res.filter(r => !ids.has(r.uid)); P2.asg = P2.asg.filter(a => !ids.has(a.r)); });
    else app.clearCells();
  }
  UI.toast(cut ? 'Dipotong' : 'Disalin' + (app.clip.tasks ? ' (' + rows.length + ' tugas)' : ''), { ms: 1200, key: 'clip' });
};
app.paste = async (text) => {
  const g = app.view && app.view.grid;
  if (!g) return;
  if (text == null) { try { text = await navigator.clipboard.readText(); } catch { text = null; } }
  const P = app.P, kind = g.kind === 'res' ? 'res' : 'task';
  // whole tasks copied in this app
  if (app.clip && app.clip.tasks && (text == null || text === app.clip.tsv) && kind === 'task') {
    const fr = g.focusRow();
    let uids = [];
    app.tx('Tempel tugas', P2 => {
      M.index(P2);
      const at = fr && fr.kind === 'task' && fr.x && !fr.x.root ? P2.byUid.get(fr.x.uid).id - 1 : P2.tasks.length;
      const ref = P2.tasks[at];
      uids = M.pasteTasks(P2, app.clip.tasks, at, ref ? ref.lvl : 1).map(t => t.uid);
    });
    app.reselect(uids);
    return;
  }
  if (app.clip && app.clip.res && (text == null || text === app.clip.tsv) && kind === 'res') {
    app.tx('Tempel sumber daya', P2 => { for (const r0 of app.clip.res) { const r = { ...U.deep(r0), uid: M.uid(P2) }; r.name = uniqueName(P2, r.name); P2.res.push(r); } });
    return;
  }
  if (!text) { UI.toast('Papan klip kosong'); return; }
  let lines = text.replace(/\r/g, '').split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const cells = lines.map(l => l.split('\t'));
  // header row from this app → skip
  if (cells.length > 1 && cells[0].every((h, i) => g.cols[i] && F.title(g.cols[i].k, P, kind) === h)) cells.shift();
  const fr = g.focusRow();
  let i0 = g.idx(g.focusKey);
  const c0 = Math.max(0, g.cols.findIndex(c => c.k === g.colKey));
  if (i0 < 0) i0 = 0;
  const errors = [];
  app.tx('Tempel', P2 => {
    M.index(P2); S.calc(P2);
    for (let r = 0; r < cells.length; r++) {
      const row = g.rows[i0 + r];
      let x;
      if (!row || row.kind === 'blank') {
        if (kind === 'res') { x = M.newRes(P2, { name: 'Sumber Daya ' + (P2.res.length + 1) }); P2.res.push(x); }
        else { x = M.newTask(P2, { name: '', lvl: P2.tasks.length ? P2.tasks[P2.tasks.length - 1].lvl : 1 }); P2.tasks.push(x); }
        M.index(P2); S.calc(P2);
      } else if (row.kind === 'group' || !row.x || row.x.root) continue;
      else x = kind === 'res' ? P2.resByUid.get(row.x.uid) : P2.byUid.get(row.x.uid);
      for (let c = 0; c < cells[r].length; c++) {
        const col = g.cols[c0 + c];
        if (!col) break;
        const f = F.reg(kind)[col.k];
        if (!f || !f.set || F.isRO(kind, col.k, x, P2)) continue;
        try { f.set(x, P2, cells[r][c], P2._ctx); if (kind === 'task') { M.index(P2); S.calc(P2); } } catch (e) { errors.push(String(e)); }
      }
    }
  });
  if (errors.length) UI.toast(errors.length + ' sel tidak dapat ditempel: ' + errors[0], { kind: 'warn', ms: 5000 });
  void fr;
};
app.clearCells = () => {
  const g = app.view && app.view.grid;
  if (!g) return;
  const P = app.P, kind = g.kind === 'res' ? 'res' : 'task';
  const rows = g.selected().filter(r => r.x && r.kind !== 'blank' && r.kind !== 'group' && !r.x.root);
  const ci = g.cols.findIndex(c => c.k === g.colKey), ca = g.colA != null ? g.cols.findIndex(c => c.k === g.colA) : ci;
  const cols = g.cols.slice(Math.min(ci, ca), Math.max(ci, ca) + 1);
  app.tx('Hapus isi sel', P2 => {
    let n = 0;
    for (const r of rows) {
      const x = kind === 'res' ? P2.resByUid.get(r.x.uid) : P2.byUid.get(r.x.uid);
      for (const c of cols) {
        const f = F.reg(kind)[c.k];
        if (!f || !f.set || F.isRO(kind, c.k, x, P2) || ['dur', 'start', 'finish', 'name', 'mode', 'type', 'cons'].includes(c.k)) continue;
        try { f.set(x, P2, f.type === 'flag' ? 'Tidak' : f.type === 'pct' || f.type === 'cost' || f.type === 'int' ? '0' : '', P2._ctx); n++; } catch { }
      }
    }
    if (!n) return false;
  });
};
app.fillDown = () => {
  const g = app.view && app.view.grid;
  if (!g) return;
  const P = app.P, kind = g.kind === 'res' ? 'res' : 'task';
  const rows = g.selected().filter(r => r.x && r.kind !== 'blank' && r.kind !== 'group' && !r.x.root);
  if (rows.length < 2) { UI.toast('Pilih beberapa baris: isi baris teratas disalin ke bawah'); return; }
  const ci = g.cols.findIndex(c => c.k === g.colKey), ca = g.colA != null ? g.cols.findIndex(c => c.k === g.colA) : ci;
  const cols = g.cols.slice(Math.min(ci, ca), Math.max(ci, ca) + 1);
  app.tx('Isi ke bawah', P2 => {
    const src = kind === 'res' ? P2.resByUid.get(rows[0].x.uid) : P2.byUid.get(rows[0].x.uid);
    for (const r of rows.slice(1)) {
      const x = kind === 'res' ? P2.resByUid.get(r.x.uid) : P2.byUid.get(r.x.uid);
      for (const c of cols) { const f = F.reg(kind)[c.k]; if (!f || !f.set || F.isRO(kind, c.k, x, P2)) continue; try { f.set(x, P2, F.text(kind, c.k, src, P2), P2._ctx); } catch { } }
    }
  });
};

/* ---------------- menu konteks ---------------- */
app.rowMenu = (e, kind, r, c) => {
  const z = U.zoom(), at = { x: e.clientX / z, y: e.clientY / z };
  if (kind === 'res') {
    UI.menu([
      { label: 'Potong', icon: 'content_cut', kbd: U.MOD + '+X', run: () => app.copy(true) },
      { label: 'Salin', icon: 'content_copy', kbd: U.MOD + '+C', run: () => app.copy(false) },
      { label: 'Tempel', icon: 'content_paste', kbd: U.MOD + '+V', run: () => app.paste() },
      { sep: true },
      { label: 'Informasi Sumber Daya…', icon: 'badge', run: () => app.cmd('resInfo', r.x), disabled: !r.x || r.kind === 'blank' },
      { label: 'Catatan…', icon: 'sticky_note_2', run: () => AP.Dlg.resInfo(r.x, 'notes'), disabled: !r.x || r.kind === 'blank' },
      { label: 'Ubah Waktu Kerja…', icon: 'schedule', run: () => AP.Dlg.workTime(r.x && r.x.cal ? r.x.cal : null, r.x), disabled: !r.x || r.x.type !== 'work' },
      { sep: true },
      { label: 'Sisipkan Sumber Daya', icon: 'person_add', run: () => app.cmd('addRes:work') },
      { label: 'Hapus Sumber Daya', icon: 'person_remove', danger: true, run: () => app.cmd('deleteRes'), disabled: !r.x || r.kind === 'blank' },
    ], at);
    return;
  }
  const t = r.x && r.kind === 'task' && !r.x.root ? r.x : null;
  UI.menu([
    { label: 'Potong', icon: 'content_cut', kbd: U.MOD + '+X', run: () => app.copy(true) },
    { label: 'Salin', icon: 'content_copy', kbd: U.MOD + '+C', run: () => app.copy(false) },
    { label: 'Tempel', icon: 'content_paste', kbd: U.MOD + '+V', run: () => app.paste() },
    { sep: true },
    { label: 'Sisipkan Tugas', icon: 'add_task', kbd: 'Insert', run: () => app.cmd('insertRow') },
    { label: 'Sisipkan Tonggak', icon: 'diamond', run: () => app.cmd('insertMilestone') },
    { label: 'Hapus Tugas', icon: 'delete', danger: true, run: () => app.cmd('deleteRows'), disabled: !t },
    { sep: true },
    { label: 'Informasi Tugas…', icon: 'info', kbd: 'Shift+F2', run: () => app.cmd('taskInfo', t), disabled: !t },
    { label: 'Catatan…', icon: 'sticky_note_2', run: () => t && AP.Dlg.taskInfo(t, 'notes'), disabled: !t },
    { label: 'Hyperlink…', icon: 'link', run: () => t && AP.Dlg.hyperlink(t), disabled: !t },
    { label: 'Tambahkan ke Garis Waktu', icon: 'add_road', checked: !!(t && t.tl), run: () => app.cmd('addTimeline'), disabled: !t },
    { sep: true },
    { label: 'Turunkan Tingkat', icon: 'format_indent_increase', run: () => app.cmd('indent'), disabled: !t },
    { label: 'Naikkan Tingkat', icon: 'format_indent_decrease', run: () => app.cmd('outdent'), disabled: !t },
    { label: 'Tautkan Tugas', icon: 'link', run: () => app.cmd('link'), disabled: app.selTasks().length < 2 },
    { label: 'Putuskan Tautan', icon: 'link_off', run: () => app.cmd('unlink'), disabled: !t },
    { label: '% Selesai', icon: 'percent', sub: () => [0, 25, 50, 75, 100].map(v => ({ label: v + '% selesai', checked: !!t && t.pct === v, run: () => app.cmd('pct:' + v) })), disabled: !t },
    { label: 'Mode Tugas', icon: 'event_repeat', sub: () => [{ label: 'Jadwalkan Otomatis', checked: !!t && t.mode !== 'manual', run: () => app.cmd('auto') }, { label: 'Jadwalkan Manual', checked: !!t && t.mode === 'manual', run: () => app.cmd('manual') }], disabled: !t },
    { label: t && t.active === false ? 'Aktifkan Tugas' : 'Nonaktifkan Tugas', icon: 'block', run: () => app.cmd('inactivate'), disabled: !t },
    { label: 'Pemisah Halaman (cetak)', icon: 'insert_page_break', checked: !!(t && t.pb), run: () => app.cmd('pageBreak'), disabled: !t },
    { sep: true },
    { label: 'Tetapkan Sumber Daya…', icon: 'group_add', kbd: 'Alt+F10', run: () => app.cmd('assignDlg'), disabled: !t },
    { label: 'Format Teks', icon: 'text_format', sub: [{ label: 'Tebal', icon: 'format_bold', run: () => app.cmd('fontStyle:b') }, { label: 'Miring', icon: 'format_italic', run: () => app.cmd('fontStyle:i') }, { label: 'Garis bawah', icon: 'format_underlined', run: () => app.cmd('fontStyle:u') }, { sep: true }, ...['#d93025', '#1a73e8', '#188038', '#e37400', '#8e24aa'].map(cc => ({ label: 'Warna teks', color: cc, run: () => app.cmd('fontColor', cc) })), { label: 'Hapus format', icon: 'format_clear', run: () => app.cmd('fontStyle:clear') }], disabled: !t },
  ], at);
};
app.barMenu = (e, t, bar) => {
  const z = U.zoom(), at = { x: e.clientX / z, y: e.clientY / z };
  if (t.root) { UI.menu([{ label: 'Informasi Proyek…', icon: 'info', run: () => app.cmd('projectInfo') }], at); return; }
  UI.menu([
    { label: 'Informasi Tugas…', icon: 'info', run: () => app.cmd('taskInfo', t) },
    { label: 'Format Batang…', icon: 'format_color_fill', run: () => app.cmd('formatBar') },
    { label: 'Warna Batang', icon: 'palette', sub: () => [...['#4a8fd9', '#1f9d6b', '#fb8c00', '#8e44ad', '#d93a4a', '#00897b', '#546e7a'].map(c => ({ label: 'Warna', color: c, run: () => app.cmd('barColor', c) })), { label: 'Bawaan', icon: 'format_color_reset', run: () => app.cmd('barColor', null) }] },
    { sep: true },
    { label: 'Pisahkan Tugas…', icon: 'call_split', run: () => app.cmd('split'), disabled: t.sum || F.isMs(t) },
    { label: '% Selesai', icon: 'percent', sub: () => [0, 25, 50, 75, 100].map(v => ({ label: v + '% selesai', checked: t.pct === v, run: () => app.cmd('pct:' + v) })) },
    { label: 'Tandai Sesuai Jadwal', icon: 'task_alt', run: () => app.cmd('markOnTrack') },
    { label: 'Tambahkan ke Garis Waktu', icon: 'add_road', checked: !!t.tl, run: () => app.cmd('addTimeline') },
    { label: 'Periksa Tugas…', icon: 'manage_search', run: () => app.cmd('inspect') },
    { sep: true },
    { label: 'Putuskan Semua Tautan', icon: 'link_off', run: () => app.cmd('unlink') },
    { label: 'Hapus Tugas', icon: 'delete', danger: true, run: () => app.cmd('deleteRows') },
  ], at);
};
app.linkMenu = (e, p, s) => {
  const z = U.zoom();
  const L = s.pred.find(x => x.uid === p.uid);
  UI.menu([
    { head: 'Tautan ' + p.id + ' → ' + s.id },
    { label: 'Ubah tautan…', icon: 'edit', run: () => AP.Dlg.link(p, s) },
    ...D.TYPES.map(ty => ({ label: D.TYPE_L[ty], checked: L && L.type === ty, run: () => app.cmd('setLink', s, L, { type: ty }) })),
    { sep: true },
    { label: 'Hapus tautan', icon: 'link_off', danger: true, run: () => app.cmd('setLink', s, L, { del: true }) },
  ], { x: e.clientX / z, y: e.clientY / z });
};
app.chartMenu = (e) => {
  const z = U.zoom();
  UI.menu([
    { label: 'Gaya Batang…', icon: 'format_paint', run: () => app.cmd('barStyles') },
    { label: 'Gaya Teks…', icon: 'text_format', run: () => app.cmd('textStyles') },
    { label: 'Garis Kisi…', icon: 'grid_4x4', run: () => app.cmd('gridlines') },
    { label: 'Tata Letak…', icon: 'dashboard_customize', run: () => app.cmd('layoutDlg') },
    { label: 'Skala Waktu…', icon: 'calendar_view_week', run: () => app.cmd('timescaleDlg') },
    { sep: true },
    { label: 'Tugas Kritis', checked: gopt('crit', true) !== false, run: () => app.cmd('fmtCrit') },
    { label: 'Slack', checked: !!gopt('slack', false), run: () => app.cmd('fmtSlack') },
    { label: 'Tugas Terlambat', checked: !!gopt('late', false), run: () => app.cmd('fmtLate') },
    { label: 'Garis Kemajuan', checked: !!gopt('progLine', false), run: () => app.cmd('fmtProgLine') },
    { label: 'Pemisah Halaman', checked: !!gopt('pb', false), run: () => app.cmd('fmtPB') },
  ], { x: e.clientX / z, y: e.clientY / z });
};
app.scaleMenu = (e, view) => {
  const z = U.zoom();
  UI.menu([
    { label: 'Skala Waktu…', icon: 'calendar_view_week', run: () => app.cmd('timescaleDlg') },
    { sep: true },
    ...AP.TS.UNITS.map(([u, n]) => ({ label: n, run: () => app.cmd('tsUnit:' + u) })),
    { sep: true },
    { label: 'Perbesar', icon: 'zoom_in', run: () => app.cmd('zoomIn') },
    { label: 'Perkecil', icon: 'zoom_out', run: () => app.cmd('zoomOut') },
    { label: 'Seluruh Proyek', icon: 'fit_screen', run: () => app.cmd('zoomEntire') },
  ], { x: e.clientX / z, y: e.clientY / z });
  void view;
};
app.headMenu = (e, kind, view, c) => {
  const z = U.zoom(), P = app.P;
  const g = view.grid;
  const i = g.cols.indexOf(c);
  UI.menu([
    { label: 'Sisipkan Kolom…', icon: 'view_column', run: () => app.insertColumn(i) },
    { label: 'Sembunyikan Kolom', icon: 'visibility_off', disabled: g.cols.length <= 1, run: () => { g.cols.splice(i, 1); F.saveCols(P, kind, view.table, g.cols); app.viewChanged(); app.refresh(); } },
    { label: 'Pengaturan Kolom…', icon: 'settings_ethernet', run: () => AP.Dlg.fieldSettings(view, c) },
    { label: 'Paskan Lebar Kolom', icon: 'fit_width', run: () => g.bestFit(i) },
    { label: 'Bungkus Teks', checked: !!c.wrap, run: () => { c.wrap = !c.wrap; F.saveCols(P, kind, view.table, g.cols); app.viewChanged(); app.refresh(); } },
    { sep: true },
    { label: 'Urutkan A → Z', icon: 'arrow_upward', run: () => { V.vs(P).sort[kind] = { keys: [{ k: c.k }], outline: true }; app.viewChanged(); app.refresh(); } },
    { label: 'Urutkan Z → A', icon: 'arrow_downward', run: () => { V.vs(P).sort[kind] = { keys: [{ k: c.k, desc: true }], outline: true }; app.viewChanged(); app.refresh(); } },
    { label: 'Kelompokkan menurut kolom ini', icon: 'workspaces', run: () => { V.vs(P).group[kind] = { id: 'field', k: c.k }; app.viewChanged(); app.refresh(); } },
    { label: 'Filter kolom ini…', icon: 'filter_alt', run: () => { V.vs(P).afOn = true; app.refresh(); setTimeout(() => { const btn = view.grid.head.querySelector(`.gfilt[data-f="${i}"]`); if (btn) app.autoFilterMenu(kind, c.k, btn, view); }, 30); } },
    { sep: true },
    { label: 'Kembalikan tabel bawaan', icon: 'restart_alt', run: () => { const tb = view.table; if (P.view.tables) delete P.view.tables[kind + ':' + tb]; app.viewChanged(); app.refresh(); } },
  ], { x: e.clientX / z, y: e.clientY / z });
};
app.insertColumn = async (at) => {
  const v = app.view;
  if (!v || !v.grid) { UI.toast('Buka tampilan tabel'); return; }
  const kind = v.grid.kind === 'res' ? 'res' : 'task';
  const k = await AP.Dlg.pickField(kind, 'Sisipkan kolom');
  if (!k) return;
  const g = v.grid;
  const i = at == null ? Math.max(0, g.cols.findIndex(c => c.k === g.colKey)) : at;
  g.cols.splice(i, 0, { k, w: F.reg(kind)[k].w || 100 });
  F.saveCols(app.P, kind, v.table, g.cols);
  app.viewChanged(); app.refresh();
};
app.autoFilterMenu = (kind, k, btn, view) => {
  const P = app.P, vs = V.vs(P);
  const xs = kind === 'res' ? P.res : P.tasks.filter(t => !t.sum);
  const vals = [...new Set(xs.map(x => F.text(kind, k, x, P)))].sort(U.cmpText).slice(0, 400);
  const cur = vs.af[kind] && vs.af[kind][k];
  const chosen = new Set(cur || vals);
  const box = el('div.af-box');
  const list = el('div.af-list');
  const draw = () => { list.replaceChildren(...vals.map(v => { const c = UI.checkbox(v || '(kosong)', chosen.has(v), on => { if (on) chosen.add(v); else chosen.delete(v); }); return c; })); };
  draw();
  const all = UI.checkbox('(Pilih Semua)', chosen.size === vals.length, on => { chosen.clear(); if (on) vals.forEach(v => chosen.add(v)); draw(); });
  box.append(all, list, el('div.af-foot',
    el('button.btn.sm', { type: 'button', onclick: () => { vs.af[kind] ||= {}; delete vs.af[kind][k]; UI.closeMenus(); app.viewChanged(); app.refresh(); } }, 'Hapus filter'),
    el('button.btn.primary.sm', { type: 'button', onclick: () => { vs.af[kind] ||= {}; if (chosen.size === vals.length) delete vs.af[kind][k]; else vs.af[kind][k] = [...chosen]; UI.closeMenus(); app.viewChanged(); app.refresh(); } }, 'OK')));
  UI.menu([
    { label: 'Urutkan A → Z', icon: 'arrow_upward', run: () => { vs.sort[kind] = { keys: [{ k }], outline: true }; app.viewChanged(); app.refresh(); } },
    { label: 'Urutkan Z → A', icon: 'arrow_downward', run: () => { vs.sort[kind] = { keys: [{ k, desc: true }], outline: true }; app.viewChanged(); app.refresh(); } },
    { sep: true }, { node: box },
  ], btn, { focus: false });
  void view;
};

/* ---------------- keyboard global ---------------- */
addEventListener('keydown', e => {
  if (!app.P || $('#app').hidden) return;
  const mod = e.ctrlKey || e.metaKey;
  const inField = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  if (UI.isDialogOpen() && !(mod && (e.key === 'p' || e.key === 'P'))) return;
  const k = e.key.toLowerCase();
  if (mod && !e.altKey) {
    if (k === 's') { e.preventDefault(); app.cmd('save'); return; }
    if (k === 'p') { e.preventDefault(); app.cmd('print'); return; }
    if (k === 'n' && !e.shiftKey) { e.preventDefault(); app.cmd('new'); return; }
    if (k === 'o') { e.preventDefault(); app.cmd('home'); return; }
    if (k === 'f') { e.preventDefault(); app.cmd('find'); return; }
    if (k === 'h') { e.preventDefault(); app.cmd('replace'); return; }
    if (inField) return;
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); app.undo(); return; }
    if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); app.redo(); return; }
    if (e.key === 'F2' && !e.shiftKey) { e.preventDefault(); app.cmd('link'); return; }
    if (e.key === 'F2' && e.shiftKey) { e.preventDefault(); app.cmd('unlink'); return; }
    if (e.key === 'F5' && e.shiftKey) { e.preventDefault(); app.cmd('scrollTask'); return; }
    if (k === 'c' || k === 'x' || k === 'v') {
      if (document.activeElement && document.activeElement.classList.contains('g-scroll')) return;   // grid handles copy/paste events
      e.preventDefault(); app.cmd(k === 'c' ? 'copy' : k === 'x' ? 'cut' : 'paste'); return;
    }
    if (e.key === 'F1') { e.preventDefault(); AP.Ribbon.toggleCollapse(); return; }
    return;
  }
  if (inField) return;
  if (e.key === 'F2' && e.shiftKey) { e.preventDefault(); app.cmd('taskInfo'); return; }
  if (e.key === 'F5') { e.preventDefault(); app.cmd('goto'); return; }
  if (e.key === 'F9') { e.preventDefault(); app.cmd('calcNow'); return; }
  if (e.key === 'F10' && e.altKey) { e.preventDefault(); app.cmd('assignDlg'); return; }
  if (e.altKey && !e.shiftKey && e.key === 'F3') { e.preventDefault(); app.cmd('taskInfo'); return; }
}, false);

/* ---------------- perubahan dari perangkat lain (/amatu.js) ---------------- */
addEventListener('amatu:change', async e => {
  const keys = (e.detail && e.detail.keys) || [];
  if (!keys.some(k => k === 'db:amatu-msproject' || /amatu-msproject/.test(k))) return;
  if (!app.P) { if (!$('#home').hidden) AP.Home.show(); return; }
  if (app.dirty || UI.isDialogOpen() || (app.view && app.view.grid && app.view.grid.editor)) return;
  const fresh = await Store.get(app.P.id);
  if (!fresh) return;
  if ((fresh.rev || 0) <= (app.P.rev || 0) && (fresh.updated || 0) <= (app.P.updated || 0)) return;
  const sel = app.selTasks().map(t => t.uid);
  const view = app.P.view;
  const P = M.fix(fresh);
  P.view = view;
  app.P = P;
  S.calc(P);
  app.refresh();
  app.reselect(sel);
  UI.toast('Proyek diperbarui dari perangkat lain', { key: 'remote', ms: 2200 });
});

/* ---------------- mulai ---------------- */
function boot() {
  app.applyTheme();
  UI.initTips();
  AP.Ribbon.init();
  addEventListener('hashchange', route);
  route();
  document.body.classList.remove('booting');
}
app.boot = boot;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
