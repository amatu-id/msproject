// Amatu Project — Bagikan: tautan "Lihat saja" / "Bisa mengedit" ke satu salinan proyek di server (lihat live.js),
// rute tamu (?share=<kunci>), sinkron proyek yang terbuka (pemilik & tamu), lencana peran, dan dialog Bagikan.
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, M = AP.M, S = AP.S, Store = AP.Store, L = AP.Live, { el, icon } = U;
const Sh = AP.Share = {};
const APP = 'msproject';
// local-only parts of a project never go to the share copy
const DROP = ['id', 'share', 'lock', 'view', 'starred', 'rev', 'updated', 'created', 'root', 'load', 'sd', 'calcMs', 'needCalc', 'loop', '_ctx'];
Sh.key = L.shareKey;
Sh.payload = P => { const c = M.clean(P); for (const k of DROP) delete c[k]; return c; };

/* ---------------- gabung: per tugas / sumber daya / penugasan / kalender ---------------- */
// two people adding a task at the same moment can get the same uid: theirs is renumbered (with its links/assignments)
function rekey(b, m, t) {
  const kinds = ['tasks', 'res', 'asg'];
  const used = new Set();
  for (const d of [b, m, t]) for (const k of kinds) for (const x of (d && d[k]) || []) used.add(x.uid);
  let next = Math.max(1, (m && m.nextUid) || 1, (t && t.nextUid) || 1, ...used) + 1;
  const remap = { tasks: new Map(), res: new Map(), asg: new Map() };
  for (const k of kinds) {
    const inB = new Set(((b && b[k]) || []).map(x => x.uid)), mine = new Map(((m && m[k]) || []).map(x => [x.uid, x]));
    for (const x of (t && t[k]) || []) if (!inB.has(x.uid) && mine.has(x.uid) && !L.eq(mine.get(x.uid), x)) remap[k].set(x.uid, next++);
  }
  if (!remap.tasks.size && !remap.res.size && !remap.asg.size) return { t, next };
  const T = U.deep(t);
  const mt = u => (remap.tasks.has(u) ? remap.tasks.get(u) : u), mr = u => (remap.res.has(u) ? remap.res.get(u) : u);
  for (const x of T.tasks || []) { x.uid = mt(x.uid); for (const p of x.pred || []) p.uid = mt(p.uid); }
  for (const x of T.res || []) x.uid = mr(x.uid);
  for (const a of T.asg || []) { if (remap.asg.has(a.uid)) a.uid = remap.asg.get(a.uid); a.t = mt(a.t); a.r = mr(a.r); }
  return { t: T, next };
}
Sh.merge = (b, m, t) => {
  const rk = rekey(b || {}, m, t);
  const r = L.merge3(b || {}, m, rk.t, {
    tasks: (bb, mm, tt) => L.mergeList('uid', bb, mm, tt),
    res: (bb, mm, tt) => L.mergeList('uid', bb, mm, tt),
    asg: (bb, mm, tt) => L.mergeList('uid', bb, mm, tt),
    cals: (bb, mm, tt) => L.mergeList('id', bb, mm, tt),
  });
  if (r && typeof r === 'object') r.nextUid = Math.max(rk.next, (m && m.nextUid) || 1, (rk.t && rk.t.nextUid) || 1);
  return r;
};

/* ---------------- menerapkan salinan server ke proyek yang terbuka ---------------- */
function applyDoc(app, doc) {
  const P0 = app.P;
  if (!P0 || !doc) return;
  const keep = { id: P0.id, share: P0.share, lock: P0.lock, view: P0.view, starred: P0.starred, created: P0.created };
  const N = M.fix(U.deep(doc));
  Object.assign(N, keep);
  if (!N.name) N.name = P0.name;
  N.updated = Date.now();
  // an editor can undo a change that arrived through the link, like any other step
  if (!app.readOnly && app.snapOf) { app.hist.undo.push({ label: 'Perubahan dari tautan berbagi', s: app.snapOf(P0) }); app.hist.redo = []; }
  const sel = app.selTasks().map(t => t.uid);
  app.P = N;
  S.calc(N);
  app.refresh();
  if (sel.length) app.reselect(sel);
  document.title = N.name + ' — Amatu Project';
  app.saveQuiet();
}

/* ---------------- membuka lewat tautan ---------------- */
Sh.openLink = async key => {
  const id = 'sh-' + key.slice(0, 16).replace(/[^\w-]/g, '_');
  let P = await Store.get(id);
  if (!P) { P = M.newProject('Memuat proyek…'); P.id = id; }
  P = M.fix(P);
  if (!P.share || P.share.key !== key) P.share = { key, role: 'view', owner: false, rev: 0, clean: true };
  S.calc(P);
  await Store.put(P);
  return id;
};

/* ---------------- sesi pada proyek yang terbuka ---------------- */
function badge(app, s) {
  let b = U.$('#share-badge');
  if (!s) { if (b) b.remove(); return; }
  if (!b) { b = el('button#share-badge.share-badge', { type: 'button', onclick: () => Sh.dialog(app) }); U.$('#save-state').after(b); }
  const [ic, tx, tip, cls] = s.revoked ? ['link_off', 'Tautan tidak berlaku', 'Pemilik mematikan atau mengganti tautan ini', 'bad']
    : s.owner ? ['group', 'Dibagikan', 'Proyek ini dibagikan dengan tautan', 'own']
      : s.role === 'edit' ? ['edit', 'Bisa mengedit', 'Anda membuka tautan edit', 'edit'] : ['visibility', 'Hanya melihat', 'Anda membuka tautan lihat saja', 'view'];
  b.className = 'share-badge ' + cls;
  b.replaceChildren(icon(ic), el('span', tx));
  b.dataset.tip = tip;
}
function setRole(app, s) {
  const view = !!(s && !s.owner && (s.role === 'view' || s.revoked));
  app.readOnly = view;
  document.body.classList.toggle('view-only', view);
  const ti = U.$('#doc-title');
  if (ti) ti.readOnly = view;
  badge(app, s && (s.role || s.owner || s.revoked) ? s : null);
  if (app.view && app.view.grid && app.view.grid.editor) app.view.grid.cancel();
  AP.Ribbon.refresh();
}
function status(app, st, info, e) {
  const P = app.P;
  if (st === 'revoked' && P && P.share && !P.share.owner) {
    P.share.revoked = true;
    setRole(app, P.share);
    if (app.live) { app.live.stop(); app.live = null; }
    Store.del(P.id).catch(() => { });
    UI.toast(L.errText({ code: 'notfound' }), { kind: 'bad', ms: 6000 });
  }
  if (st === 'denied' || st === 'error') UI.toast(L.errText(e || { code: 'denied' }), { kind: 'bad' });
  app.liveState = {
    synced: ['cloud_done', 'Tersinkron', 'Tersimpan di server berbagi' + (info && info.by ? ' · terakhir diubah oleh ' + info.by : '')],
    saving: ['sync', 'Menyinkronkan…'], pending: ['sync', 'Menyinkronkan…'],
    offline: ['cloud_off', 'Offline', 'Tidak terhubung. Perubahan disimpan di perangkat dan dikirim saat online.'],
    revoked: ['link_off', 'Tautan tidak berlaku'], denied: ['block', 'Ditolak'], error: ['error', 'Gagal sinkron'],
  }[st] || app.liveState;
  app.saveState(st === 'saving' || st === 'pending' ? 'saving' : 'saved');
}
Sh.detach = async app => {
  const lv = app.live;
  app.live = null; app.liveState = null;
  if (lv) { if (!lv.clean && lv.role === 'edit') await lv.save().catch(() => { }); lv.stop(); }
  app.readOnly = false;
  document.body.classList.remove('view-only');
  badge(app, null);
};
Sh.attach = app => {
  if (app.live) { app.live.stop(); app.live = null; }
  app.liveState = null;
  const P = app.P;
  const s = P && P.share;
  setRole(app, s && (s.role || s.owner) ? s : null);
  if (!s || !s.key) return;
  const pid = P.id;
  const mine = () => app.P && app.P.id === pid;
  const live = new L.Live(s.key, {
    payload: () => (mine() ? Sh.payload(app.P) : null),
    merge: Sh.merge,
    apply: x => { if (mine()) applyDoc(app, x); },
    // a dialog that edits the project, a cell being typed in or a bar being dragged: apply remote changes later
    // (the Bagikan dialog itself changes nothing in the project, it does not pause syncing)
    busy: () => !!([...document.querySelectorAll('.dlg-back:not(.modeless)')].some(b => !b.querySelector('.share-dlg')) || (app.view && app.view.grid && app.view.grid.editor) || (app.view && app.view.chart && app.view.chart.drag)),
    status: (st, info, e) => { if (mine()) status(app, st, info, e); },
    role: info => { if (!mine()) return; Object.assign(app.P.share, { role: info.role, by: info.by, ownerName: info.owner, owner: s.owner || false }); setRole(app, app.P.share); },
    name: () => (app.P ? app.P.name : ''),
    by: () => { const a = L.account(); return (a && a.u) || AP.Store.pref('name') || 'Tamu'; },
    persist: st => { if (mine()) { Object.assign(app.P.share, st); app.saveQuiet(); } },
  }, s);
  app.live = live;
  live.start().catch(e => status(app, e.code === 'notfound' ? 'revoked' : 'offline', null, e));
};

/* ---------------- dialog Bagikan ---------------- */
Sh.dialog = async app => {
  await app.save();
  const P = app.P, acc = L.account();
  const body = el('div.share-dlg');
  const copyRow = (label, desc, url, on, onToggle, onReset) => {
    const inp = el('input.inp', { readOnly: true, value: on ? url : 'Tautan dimatikan', disabled: !on, onfocus: e => e.target.select() });
    return el('div.share-row' + (on ? '' : '.off'),
      el('div.share-head', el('div', el('b', label), el('div.hint', desc)),
        onToggle ? el('label.switch', { 'data-tip': on ? 'Matikan tautan' : 'Nyalakan tautan' }, Object.assign(el('input', { type: 'checkbox', onchange: e => onToggle(e.target.checked) }), { checked: on }), el('span')) : null),
      el('div.share-link', inp,
        el('button.btn', { type: 'button', disabled: !on, onclick: () => U.copyText(url).then(() => UI.toast('Tautan disalin')) }, icon('content_copy'), 'Salin'),
        onReset && on ? el('button.icon-btn', { type: 'button', 'data-tip': 'Buat tautan baru (tautan lama berhenti berfungsi)', onclick: onReset }, icon('autorenew')) : null));
  };
  const note = (ic, title, text) => el('div.share-note', el('span.share-ic', icon(ic)), el('div', el('b', title), el('div.hint', text)));
  const files = () => el('div.share-files', el('span.hint', 'Atau kirim sebagai file:'),
    el('button.btn.sm', { type: 'button', onclick: () => { dlg.close(); app.cmd('exportPdf'); } }, icon('picture_as_pdf'), 'PDF'),
    el('button.btn.sm', { type: 'button', onclick: () => { dlg.close(); app.cmd('exportXlsx'); } }, icon('grid_on'), 'Excel'),
    el('button.btn.sm', { type: 'button', onclick: () => { dlg.close(); app.cmd('exportXml'); } }, icon('code'), 'MS Project XML'),
    el('button.btn.sm', { type: 'button', onclick: () => { dlg.close(); app.cmd('exportJson'); } }, icon('data_object'), '.amproj'));
  const render = () => {
    const s = app.P && app.P.share;
    const parts = [];
    if (s && !s.owner) {
      parts.push(note(s.revoked ? 'link_off' : s.role === 'edit' ? 'edit' : 'visibility', s.revoked ? 'Tautan ini tidak berlaku lagi' : s.role === 'edit' ? 'Anda dapat mengedit proyek ini' : 'Anda hanya dapat melihat proyek ini',
        s.revoked ? 'Minta tautan baru kepada pemilik proyek.' : `Dibagikan oleh ${s.ownerName || 'pemilik'}. ${s.role === 'edit' ? 'Perubahan tersimpan langsung untuk semua yang membuka tautan.' : 'Tampilan selalu mengikuti versi terbaru pemilik.'}`));
      if (!s.revoked) parts.push(copyRow('Tautan ini', 'Teruskan hanya ke orang yang Anda percaya.', L.linkFor(s.key), true));
    } else if (!acc) {
      parts.push(note('login', 'Masuk ke Portal AMATU untuk membuat tautan berbagi', 'Tautan "Lihat saja" dan "Bisa mengedit" disimpan di akun AMATU Anda. Tanpa akun, Anda tetap bisa mengirim file PDF / Excel / XML.'));
    } else if (!s) {
      parts.push(note('group_add', 'Bagikan dengan tautan', 'Proyek diunggah ke server AMATU. Anda mendapat dua tautan: "Lihat saja" (pelihat) dan "Bisa mengedit" (editor). Perubahan tersinkron otomatis untuk semua yang membukanya — termasuk Anda di perangkat lain.'),
        P.lock ? el('div.hint', icon('lock'), ' Proyek ini berkata sandi — tautan berbagi tetap dapat dibuka tanpa kata sandi.') : null,
        el('div', el('button.btn.primary', { type: 'button', onclick: create }, icon('link'), 'Buat tautan berbagi')));
    } else {
      parts.push(
        copyRow('Lihat saja (pelihat)', 'Siapa pun yang memiliki tautan dapat melihat Gantt, laporan, mencetak & mengekspor, tanpa mengubah proyek.', L.linkFor(s.vkey), s.view_on !== false, on => set({ p_view: on }), () => set({ p_reset: 'view' })),
        copyRow('Bisa mengedit (editor)', 'Siapa pun yang memiliki tautan dapat mengedit seluruh proyek: tugas, tautan, sumber daya, kemajuan.', L.linkFor(s.ekey), s.edit_on !== false, on => set({ p_edit: on }), () => set({ p_reset: 'edit' })),
        el('div.share-foot', el('span.hint', s.by ? `Terakhir diubah oleh ${s.by}` : ''), el('button.btn.danger', { type: 'button', onclick: stopSharing }, icon('link_off'), 'Berhenti berbagi')));
    }
    parts.push(files());
    body.replaceChildren(...parts);
  };
  async function create() {
    try {
      const r = await L.rpc('amt_share_create', { p_token: acc.t, p_app: APP, p_doc: P.id, p_name: P.name, p_data: Sh.payload(app.P) });
      app.P.share = { owner: true, id: r.id, key: r.okey, vkey: r.vkey, ekey: r.ekey, view_on: r.view_on, edit_on: r.edit_on, role: 'edit', rev: r.existing ? 0 : r.rev, clean: !r.existing };
      await Store.put(app.P);
      Sh.attach(app);
      render();
      UI.toast('Tautan berbagi dibuat');
    } catch (e) { UI.toast(L.errText(e), { kind: 'bad' }); }
  }
  async function set(args) {
    try {
      const r = await L.rpc('amt_share_set', { p_token: acc.t, p_id: app.P.share.id, p_view: null, p_edit: null, p_reset: null, p_delete: false, ...args });
      Object.assign(app.P.share, { vkey: r.vkey, ekey: r.ekey, view_on: r.view_on, edit_on: r.edit_on, key: r.okey });
      await Store.put(app.P);
      render();
      if (args.p_reset) UI.toast('Tautan baru dibuat. Tautan lama tidak berfungsi lagi.');
    } catch (e) { UI.toast(L.errText(e), { kind: 'bad' }); }
  }
  async function stopSharing() {
    if (!(await UI.confirm('Berhenti berbagi? Kedua tautan langsung tidak berfungsi dan salinan di server dihapus. Proyek Anda sendiri tetap ada.', { ok: 'Berhenti berbagi', danger: true }))) return;
    try {
      await L.rpc('amt_share_set', { p_token: acc.t, p_id: app.P.share.id, p_view: null, p_edit: null, p_reset: null, p_delete: true });
      await Sh.detach(app);
      app.P.share = null;
      await Store.put(app.P);
      app.saveState('saved');
      render();
      UI.toast('Berhenti berbagi. Kedua tautan tidak berfungsi lagi.');
    } catch (e) { UI.toast(L.errText(e), { kind: 'bad' }); }
  }
  // a share made on another device of this account
  if (acc && !P.share) L.rpc('amt_share_mine', { p_token: acc.t, p_app: APP, p_doc: P.id }).then(r => {
    if (r && app.P && !app.P.share) { app.P.share = { owner: true, id: r.id, key: r.okey, vkey: r.vkey, ekey: r.ekey, view_on: r.view_on, edit_on: r.edit_on, role: 'edit', rev: 0, clean: false }; Store.put(app.P); Sh.attach(app); render(); }
  }).catch(() => { });
  render();
  const dlg = UI.dialog({ title: `Bagikan "${P.name}"`, width: 'min(620px, 100%)', body, buttons: [{ label: 'Selesai', primary: true }] });
};
})();
