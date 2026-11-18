// Amatu Project — ribbon (tab Berkas, Tugas, Sumber Daya, Laporan, Proyek, Tampilan, Format, Bantuan), toolbar akses
// cepat, kotak "Beri tahu saya" (cari perintah), bilah status (mode tugas baru, filter, pintasan tampilan, zoom).
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, V = AP.V, F = AP.F, TS = AP.TS, { el, icon } = U;
const R = AP.Ribbon = {};
const app = () => AP.app;
const C = id => app().cmds[id] || {};
const run = (id, ...a) => () => app().cmd(id, ...a);
const viewItems = grp => Object.entries(V.VIEWS).filter(([k, v]) => k !== 'report' && (!grp || v.grp === grp)).map(([k, v]) => ({ label: v.t, icon: v.icon, checked: () => app().viewId === k, run: run('view:' + k) }));
const allViews = () => [{ head: 'Tampilan tugas' }, ...viewItems('task'), { sep: true }, { head: 'Tampilan sumber daya' }, ...viewItems('res'), { sep: true }, { label: 'Laporan…', icon: 'monitoring', run: run('report:overview') }];
const tableItems = () => {
  const P = app().P; if (!P) return [];
  const kind = app().kind(), id = app().viewId;
  return [...Object.entries(F.TABLES[kind] || {}).map(([k, t]) => ({ label: t.t, checked: () => V.tableOf(P, id) === k, run: run('table:' + k) }))];
};
const filterItems = (where) => () => {
  const P = app().P; if (!P) return [];
  const kind = app().kind(), cur = V.vs(P)[where][kind];
  return [
    { label: where === 'hl' ? '[Tanpa Sorotan]' : '[Tanpa Filter]', checked: !cur, run: run(where + ':all') },
    { sep: true },
    ...V.FILTERS[kind].filter(f => f[0] !== 'all').map(f => ({ label: f[1], checked: !!cur && cur.id === f[0], run: run(where + ':' + f[0]) })),
    { sep: true },
    { label: 'Filter Kustom…', icon: 'tune', checked: !!cur && cur.id === 'custom', run: run(where + ':custom') },
    { label: 'Hapus Filter', icon: 'filter_alt_off', run: run('clearFilter') },
  ];
};
const groupItems = () => {
  const P = app().P; if (!P) return [];
  const kind = app().kind(), cur = V.vs(P).group[kind];
  return [...V.GROUPS[kind].map(g => ({ label: g[1], checked: g[0] === 'none' ? !cur : !!cur && cur.id === g[0], run: run('group:' + g[0]) })), { sep: true }, { label: 'Kelompok Kustom…', icon: 'tune', run: run('group:custom') }];
};
const sortItems = () => {
  const P = app().P; if (!P) return [];
  const kind = app().kind(), cur = V.vs(P).sort[kind];
  return [...V.SORTS[kind].map(s => ({ label: s[1][0].toUpperCase() + s[1].slice(1), checked: s[0] === 'id' ? !cur : !!cur && cur.id === s[0], run: run('sort:' + s[0]) })), { sep: true }, { label: 'Urutkan menurut…', icon: 'sort', run: run('sort:custom') }];
};
const outlineItems = () => [
  { label: 'Tampilkan Semua Subtugas', icon: 'unfold_more', run: run('outline:all') },
  { label: 'Ciutkan Tugas Terpilih', icon: 'unfold_less', run: run('collapse') },
  { label: 'Perluas Tugas Terpilih', icon: 'unfold_more', run: run('expand') },
  { sep: true },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ({ label: 'Tingkat ' + n, checked: () => app().P && V.vs(app().P).outlineLvl === n, run: run('outline:' + n) })),
];
const reportItems = grp => () => (AP.Rep ? AP.Rep.LIST.filter(r => !grp || r.g === grp).map(r => ({ label: r.t, icon: r.icon, run: run('report:' + r.id) })) : []);
const pctBtn = v => ({ cmd: 'pct:' + v, icon: { 0: 'radio_button_unchecked', 25: 'clock_loader_10', 50: 'clock_loader_40', 75: 'clock_loader_60', 100: 'check_circle' }[v], label: v + '%', tip: v + '% selesai', small: true, iconOnly: true });
const GANTT_STYLE_PRESETS = () => (AP.Dlg && AP.Dlg.GANTT_STYLES ? Object.entries(AP.Dlg.GANTT_STYLES) : []);

R.TABS = [
  { id: 'file', t: 'Berkas', file: true },
  { id: 'task', t: 'Tugas', groups: [
    { t: 'Tampilan', items: [{ big: true, label: 'Gantt', icon: 'view_timeline', menu: allViews, tip: 'Ganti tampilan', id: 'viewbtn' }] },
    { t: 'Papan Klip', items: [{ big: true, cmd: 'paste' }, { col: [{ cmd: 'cut' }, { cmd: 'copy' }] }] },
    { t: 'Font', items: [{ col: [{ cmd: 'fontStyle:b', icon: 'format_bold', label: 'Tebal', iconOnly: true }, { cmd: 'fontStyle:i', icon: 'format_italic', label: 'Miring', iconOnly: true }] }, { col: [{ cmd: 'fontStyle:u', icon: 'format_underlined', label: 'Garis bawah', iconOnly: true }, { label: 'Warna teks', icon: 'format_color_text', iconOnly: true, menu: () => [...['#d93025', '#1a73e8', '#188038', '#e37400', '#8e24aa', '#000000'].map(c => ({ label: c, color: c, run: run('fontColor', c) })), { label: 'Otomatis', icon: 'format_color_reset', run: run('fontColor', null) }] }] }, { col: [{ cmd: 'fontStyle:clear', icon: 'format_clear', label: 'Hapus format', iconOnly: true }] }] },
    { t: 'Jadwal', items: [
      { grid: [pctBtn(0), pctBtn(25), pctBtn(50), pctBtn(75), pctBtn(100)] },
      { col: [{ cmd: 'markOnTrack', menu: () => [{ label: 'Tandai Sesuai Jadwal', icon: 'task_alt', run: run('markOnTrack') }, { label: 'Perbarui Tugas…', icon: 'edit_calendar', run: run('updateTasks') }] }, { cmd: 'respectLinks' }, { cmd: 'inactivate' }] },
      { col: [{ cmd: 'link' }, { cmd: 'unlink' }, { cmd: 'split' }] },
      { col: [{ cmd: 'outdent', iconOnly: true }, { cmd: 'indent', iconOnly: true }] },
    ] },
    { t: 'Tugas', items: [{ big: true, cmd: 'manual', label: 'Jadwal Manual' }, { big: true, cmd: 'auto', label: 'Jadwal Otomatis' }, { col: [{ cmd: 'inspect', label: 'Periksa' }, { label: 'Pindahkan', icon: 'trending_flat', menu: () => [
      { label: 'Maju 1 hari', run: run('moveTask:f1d') }, { label: 'Maju 1 minggu', run: run('moveTask:f1w') }, { label: 'Maju 4 minggu', run: run('moveTask:f4w') }, { label: 'Maju kustom…', run: run('moveTask:custom') }, { sep: true },
      { label: 'Mundur 1 hari', run: run('moveTask:b1d') }, { label: 'Mundur 1 minggu', run: run('moveTask:b1w') }, { label: 'Mundur 4 minggu', run: run('moveTask:b4w') }, { sep: true },
      { label: 'Bagian belum selesai ke Tanggal Status', run: run('moveTask:sd') }] }, { label: 'Mode', icon: 'tune', menu: () => [{ head: 'Tugas baru dijadwalkan' }, { label: 'Otomatis', checked: () => app().P && app().P.opts.newAuto, run: run('newMode:auto') }, { label: 'Manual', checked: () => app().P && !app().P.opts.newAuto, run: run('newMode:manual') }] }] }] },
    { t: 'Sisipkan', items: [{ big: true, cmd: 'insertRow', label: 'Tugas', menu: () => [{ label: 'Tugas', icon: 'add_task', run: run('insertRow') }, { label: 'Tugas Berulang…', icon: 'event_repeat', run: run('insertRecurring') }, { label: 'Baris Kosong', icon: 'table_rows', run: run('insertBlank') }, { label: 'Subproyek…', icon: 'library_add', run: run('insertSub') }] }, { col: [{ cmd: 'insertSummary' }, { cmd: 'insertMilestone' }] }] },
    { t: 'Properti', items: [{ big: true, cmd: 'taskInfo', label: 'Informasi' }, { col: [{ cmd: 'notes' }, { cmd: 'details', toggle: true }, { cmd: 'addTimeline', label: 'Ke Garis Waktu' }] }] },
    { t: 'Pengeditan', items: [{ big: true, cmd: 'scrollTask' }, { col: [{ label: 'Cari', icon: 'search', menu: () => [{ label: 'Cari…', icon: 'search', kbd: U.MOD + '+F', run: run('find') }, { label: 'Ganti…', icon: 'find_replace', kbd: U.MOD + '+H', run: run('replace') }, { label: 'Pergi ke…', icon: 'move_down', kbd: 'F5', run: run('goto') }] }, { label: 'Hapus', icon: 'ink_eraser', menu: () => [{ label: 'Hapus Isi Sel', run: run('clearCells') }, { label: 'Hapus Tugas', run: run('deleteRows') }] }, { cmd: 'fillDown', label: 'Isi' }] }] },
  ] },
  { id: 'res', t: 'Sumber Daya', groups: [
    { t: 'Tampilan', items: [{ big: true, label: 'Perencana Tim', icon: 'groups', menu: () => [...viewItems('res'), { sep: true }, ...viewItems('task')] }] },
    { t: 'Penugasan', items: [{ big: true, cmd: 'assignDlg' }] },
    { t: 'Sisipkan', items: [{ big: true, label: 'Tambah Sumber Daya', icon: 'person_add', menu: () => [{ label: 'Sumber Daya Kerja', icon: 'engineering', run: run('addRes:work') }, { label: 'Sumber Daya Material', icon: 'inventory_2', run: run('addRes:material') }, { label: 'Sumber Daya Biaya', icon: 'payments', run: run('addRes:cost') }] }] },
    { t: 'Properti', items: [{ big: true, cmd: 'resInfo', label: 'Informasi' }, { col: [{ cmd: 'deleteRes', label: 'Hapus' }, { cmd: 'details', toggle: true }] }] },
    { t: 'Pemerataan', items: [{ big: true, label: 'Ratakan Pilihan', icon: 'align_horizontal_left', cmd: 'level:sel' }, { big: true, label: 'Ratakan Sumber Daya', icon: 'person_search', cmd: 'level:res' }, { big: true, label: 'Ratakan Semua', icon: 'align_justify_space_between', cmd: 'level:all' }, { col: [{ label: 'Opsi Pemerataan', icon: 'tune', cmd: 'level:opts' }, { label: 'Hapus Pemerataan', icon: 'layers_clear', cmd: 'level:clear' }, { cmd: 'nextOver', label: 'Alokasi Berlebih Berikutnya' }] }] },
  ] },
  { id: 'rep', t: 'Laporan', groups: [
    { t: 'Lihat Laporan', items: [{ big: true, label: 'Dasbor', icon: 'dashboard', menu: reportItems('dash') }, { big: true, label: 'Sumber Daya', icon: 'groups', menu: reportItems('res') }, { big: true, label: 'Biaya', icon: 'payments', menu: reportItems('cost') }, { big: true, label: 'Sedang Berjalan', icon: 'pending_actions', menu: reportItems('prog') }, { big: true, label: 'Semua Laporan', icon: 'lab_profile', menu: reportItems(null) }] },
    { t: 'Ekspor', items: [{ big: true, cmd: 'exportPdf', label: 'PDF / Cetak' }, { col: [{ cmd: 'exportXlsx' }, { cmd: 'exportPng' }, { cmd: 'exportCsv' }] }] },
  ] },
  { id: 'proj', t: 'Proyek', groups: [
    { t: 'Sisipkan', items: [{ big: true, cmd: 'insertSub', label: 'Subproyek' }] },
    { t: 'Properti', items: [{ big: true, cmd: 'projectInfo' }, { col: [{ cmd: 'customFields' }, { cmd: 'wbsDef', label: 'Kode WBS' }, { cmd: 'stats' }] }, { big: true, cmd: 'workTime' }] },
    { t: 'Jadwal', items: [{ big: true, cmd: 'calcNow' }, { big: true, label: 'Garis Dasar', icon: 'flag', menu: () => [{ label: 'Tetapkan Garis Dasar…', icon: 'flag', run: run('baseline') }, { label: 'Hapus Garis Dasar…', icon: 'outlined_flag', run: run('clearBaseline') }] }, { col: [{ cmd: 'moveProject' }] }] },
    { t: 'Status', items: [{ big: true, cmd: 'statusDate', id: 'sdbtn' }, { big: true, cmd: 'updateProject' }] },
  ] },
  { id: 'view', t: 'Tampilan', groups: [
    { t: 'Tampilan Tugas', items: [{ big: true, label: 'Bagan Gantt', icon: 'view_timeline', menu: () => [...['gantt', 'tracking', 'detail', 'level'].map(k => ({ label: V.VIEWS[k].t, icon: V.VIEWS[k].icon, checked: () => app().viewId === k, run: run('view:' + k) }))] }, { col: [{ label: 'Penggunaan Tugas', icon: 'table_chart', cmd: 'view:tusage' }, { label: 'Diagram Jaringan', icon: 'account_tree', cmd: 'view:network' }, { label: 'Kalender', icon: 'calendar_month', cmd: 'view:calendar' }] }, { col: [{ label: 'Papan Tugas', icon: 'view_kanban', cmd: 'view:board' }, { label: 'Lembar Tugas', icon: 'table_view', cmd: 'view:tsheet' }, { label: 'Tampilan Lain', icon: 'more_horiz', menu: allViews }] }] },
    { t: 'Tampilan Sumber Daya', items: [{ col: [{ label: 'Perencana Tim', icon: 'groups', cmd: 'view:team' }, { label: 'Penggunaan SD', icon: 'person_search', cmd: 'view:rusage' }, { label: 'Lembar SD', icon: 'badge', cmd: 'view:rsheet' }] }, { col: [{ label: 'Grafik SD', icon: 'bar_chart', cmd: 'view:rgraph' }] }] },
    { t: 'Data', items: [{ col: [{ label: 'Urutkan', icon: 'sort', menu: sortItems }, { label: 'Kerangka', icon: 'format_list_bulleted', menu: outlineItems }, { label: 'Tabel', icon: 'table', menu: tableItems }] }, { col: [{ label: 'Sorot', icon: 'ink_highlighter', menu: filterItems('hl'), id: 'hlbtn' }, { label: 'Filter', icon: 'filter_alt', menu: filterItems('filter'), id: 'filtbtn' }, { label: 'Kelompok', icon: 'workspaces', menu: groupItems, id: 'grpbtn' }] }, { col: [{ cmd: 'autoFilter', toggle: true }, { cmd: 'clearFilter' }] }] },
    { t: 'Zoom', items: [{ big: true, label: 'Skala Waktu', icon: 'calendar_view_week', menu: () => [...TS.UNITS.map(([u, n]) => ({ label: n, run: run('tsUnit:' + u) })), { sep: true }, { label: 'Skala Waktu…', icon: 'tune', run: run('timescaleDlg') }] }, { col: [{ cmd: 'zoomIn', iconOnly: false }, { cmd: 'zoomOut' }] }, { big: true, cmd: 'zoomEntire' }, { big: true, cmd: 'zoomSel' }] },
    { t: 'Tampilan Terpisah', items: [{ col: [{ check: 'timeline', label: 'Garis Waktu' }, { check: 'details', label: 'Rincian' }, { label: 'Panel rincian', icon: 'splitscreen_bottom', menu: () => [{ label: 'Formulir Tugas', checked: () => app().P && V.vs(app().P).split.detail === 'taskform', run: run('detailPane:taskform') }, ...(AP.DetailViews ? Object.entries(AP.DetailViews).map(([k, c]) => ({ label: c.title, checked: () => app().P && V.vs(app().P).split.detail === k, run: run('detailPane:' + k) })) : []), { sep: true }, { label: 'Tutup panel rincian', run: run('detailPane:none') }] }] }] },
    { t: 'Tema', items: [{ big: true, label: 'Tema', icon: 'contrast', menu: () => [['auto', 'Ikuti sistem', 'brightness_auto'], ['light', 'Terang', 'light_mode'], ['dark', 'Gelap', 'dark_mode']].map(([k, n, ic]) => ({ label: n, icon: ic, checked: () => app().theme() === k, run: run('theme:' + k) })) }] },
  ] },
  { id: 'fmt', t: 'Format', ctx: 'Alat Bagan Gantt', groups: [
    { t: 'Format', items: [{ col: [{ cmd: 'textStyles', label: 'Gaya Teks' }, { cmd: 'gridlines', label: 'Garis Kisi' }, { cmd: 'layoutDlg', label: 'Tata Letak' }] }] },
    { t: 'Kolom', items: [{ big: true, cmd: 'insertCol' }, { col: [{ cmd: 'colSettings', label: 'Pengaturan Kolom' }, { label: 'Paskan Lebar', icon: 'fit_width', run: () => { const g = app().view && app().view.grid; if (g) g.bestFit(Math.max(0, g.cols.findIndex(c => c.k === g.colKey))); } }] }] },
    { t: 'Gaya Batang', items: [{ col: [{ cmd: 'formatBar', label: 'Format Batang' }, { cmd: 'barStyles', label: 'Gaya Batang' }, { label: 'Garis Dasar', icon: 'flag', menu: () => [{ label: 'Tidak ditampilkan', checked: () => !(app().P.view && app().P.view.gantt && app().P.view.gantt.base != null), run: run('fmtBase:none') }, ...[0, 1, 2, 3, 4, 5].map(n => ({ label: n ? 'Garis Dasar ' + n : 'Garis Dasar', checked: () => app().P.view && app().P.view.gantt && app().P.view.gantt.base === n, run: run('fmtBase:' + n) }))] }] }, { col: [{ check: 'fmtCrit' }, { check: 'fmtSlack' }, { check: 'fmtLate' }] }, { col: [{ check: 'fmtProgLine' }] }] },
    { t: 'Gaya Gantt', items: [{ gallery: true }] },
    { t: 'Tampilkan/Sembunyikan', items: [{ col: [{ check: 'fmtOutlineNum' }, { check: 'fmtProjSum' }, { check: 'fmtSum' }] }, { col: [{ check: 'fmtPB' }, { cmd: 'pageBreak', label: 'Sisipkan Pemisah' }] }] },
    { t: 'Skala', items: [{ big: true, cmd: 'timescaleDlg', label: 'Skala Waktu' }] },
  ] },
  { id: 'help', t: 'Bantuan', groups: [
    { t: 'Bantuan', items: [{ big: true, cmd: 'shortcuts' }, { big: true, cmd: 'about' }] },
  ] },
];

/* ---------------- bangun ribbon ---------------- */
let curTab = 'task', collapsed = false;
const btns = [];
R.init = () => {
  // title bar actions
  const tb = U.$('#titlebar');
  if (!tb) return;
  U.$('#app-logo').addEventListener('click', () => app().cmd('home'));
  U.$('#qat-save').addEventListener('click', () => app().cmd('save'));
  U.$('#qat-undo').addEventListener('click', () => app().cmd('undo'));
  U.$('#qat-redo').addEventListener('click', () => app().cmd('redo'));
  U.$('#qat-print').addEventListener('click', () => app().cmd('print'));
  const ti = U.$('#doc-title');
  ti.addEventListener('change', () => { const v = ti.value.trim(); if (!v) { ti.value = app().P.name; return; } app().tx('Ganti nama proyek', P => { P.name = v; P.props.title = v; }); document.title = v + ' — Amatu Project'; });
  ti.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ti.blur(); app().view && app().view.focus && app().view.focus(); } });
  tellMe();
  U.$('#ribbon-collapse').addEventListener('click', () => R.toggleCollapse());
  collapsed = !!AP.Store.ui('ribbon.collapsed');
  document.body.classList.toggle('rb-collapsed', collapsed);
};
R.toggleCollapse = () => { collapsed = !collapsed; document.body.classList.toggle('rb-collapsed', collapsed); AP.Store.ui('ribbon.collapsed', collapsed); U.$('#ribbon-collapse').firstChild.textContent = collapsed ? 'expand_more' : 'expand_less'; setTimeout(() => app().view && app().view.render && app().view.render(), 0); };
R.build = () => {
  const tabs = U.$('#ribbon-tabs'), body = U.$('#ribbon');
  tabs.replaceChildren();
  for (const t of R.TABS) {
    const b = el('button.rtab' + (t.file ? '.file' : '') + (t.ctx ? '.ctx' : ''), { type: 'button', role: 'tab', 'data-tab': t.id, onclick: () => { if (t.file) { R.backstage(); return; } if (collapsed && curTab === t.id && body.classList.contains('peek')) { body.classList.remove('peek'); return; } curTab = t.id; R.drawTab(); if (collapsed) body.classList.add('peek'); } }, t.ctx ? el('span.rctx', t.ctx) : null, t.t);
    tabs.append(b);
  }
  R.drawTab();
  document.addEventListener('pointerdown', e => { if (collapsed && body.classList.contains('peek') && !body.contains(e.target) && !tabs.contains(e.target) && !e.target.closest('.menu')) body.classList.remove('peek'); }, true);
  U.$('#ribbon-collapse').firstChild.textContent = collapsed ? 'expand_more' : 'expand_less';
};
R.drawTab = () => {
  const body = U.$('#ribbon');
  btns.length = 0;
  const tab = R.TABS.find(t => t.id === curTab) || R.TABS[1];
  U.$$('.rtab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab.id));
  const box = el('div.rbody');
  for (const g of tab.groups || []) {
    const items = el('div.rg-items');
    for (const it of g.items) items.append(item(it));
    box.append(el('div.rgroup', items, el('div.rg-t', g.t)));
  }
  body.replaceChildren(box);
  R.refresh();
};
function item(it) {
  if (it.col) return el('div.rcol', ...it.col.map(x => item({ ...x, small: true })));
  if (it.grid) return el('div.rgrid', ...it.grid.map(x => item({ ...x, small: true })));
  if (it.check) {
    const c = C(it.check);
    const cb = UI.checkbox(it.label || c.label, false, () => app().cmd(it.check));
    cb.classList.add('rcheck');
    btns.push({ el: cb, check: it.check });
    return cb;
  }
  if (it.gallery) {
    const g = el('div.rgallery');
    for (const [k, st] of GANTT_STYLE_PRESETS()) {
      const b = el('button.rgal', { type: 'button', 'data-tip': st.t, onclick: run('ganttStyle:' + k) }, el('i', { style: { background: st.bars.task.fill } }), el('i', { style: { background: st.bars.crit.fill } }), el('i', { style: { background: st.bars.sum.fill } }));
      g.append(b);
    }
    return g;
  }
  const c = it.cmd ? C(it.cmd.replace(/:.*/, ':*') === it.cmd ? it.cmd : it.cmd) : {};
  const cc = it.cmd && !app().cmds[it.cmd] ? {} : c;
  const label = it.label || cc.label || it.cmd;
  const ic = it.icon || cc.icon || 'circle';
  const b = el('button.rbtn' + (it.big ? '.big' : '.small') + (it.iconOnly ? '.io' : '') + (it.menu ? '.dd' : ''), { type: 'button', 'data-tip': (it.tip || label) + (cc.key ? '|' + cc.key : ''), 'aria-label': label }, icon(ic), it.iconOnly ? null : el('span.rl', label), it.menu ? el('span.ms.rdd', 'arrow_drop_down') : null);
  if (it.id) b.id = it.id;
  b.addEventListener('click', e => {
    if (it.menu && (!it.cmd || e.target.closest('.rdd') || it.big && !it.cmd)) { UI.menu(typeof it.menu === 'function' ? it.menu() : it.menu, b); return; }
    if (it.run) { it.run(); return; }
    if (it.cmd) app().cmd(it.cmd);
  });
  if (it.cmd) btns.push({ el: b, cmd: it.cmd, toggle: it.toggle });
  return b;
}
R.refresh = () => {
  const A = app();
  if (!A || !A.P) return;
  for (const x of btns) {
    if (x.check) { const c = C(x.check); x.el.input.checked = !!(c.checked && c.checked()); continue; }
    const c = A.cmds[x.cmd];
    if (!c) continue;
    const en = !c.enabled || c.enabled();
    x.el.disabled = !en;
    x.el.classList.toggle('on', !!(c.checked && c.checked()));
  }
  const vb = U.$('#viewbtn');
  if (vb) { const d = V.def(A.viewId.split(':')[0]); vb.querySelector('.ms').textContent = d.icon; vb.querySelector('.rl').textContent = d.type === 'report' ? 'Laporan' : d.t.replace('Bagan ', ''); }
  const sd = U.$('#sdbtn');
  if (sd) sd.querySelector('.rl').textContent = A.P.statusDate != null ? 'Status: ' + U.fmtDate(A.P.statusDate, 'dd/mm/yy') : 'Tanggal Status';
  const P = A.P, kind = A.kind(), vs = V.vs(P);
  const fb = U.$('#filtbtn'); if (fb) fb.classList.toggle('on', !!vs.filter[kind]);
  const hb = U.$('#hlbtn'); if (hb) hb.classList.toggle('on', !!vs.hl[kind]);
  const gb = U.$('#grpbtn'); if (gb) gb.classList.toggle('on', !!vs.group[kind]);
  U.$('#qat-undo').disabled = !A.hist.undo.length;
  U.$('#qat-redo').disabled = !A.hist.redo.length;
  U.$('#qat-undo').dataset.tip = A.hist.undo.length ? 'Batalkan: ' + A.hist.undo[A.hist.undo.length - 1].label + '|' + U.MOD + '+Z' : 'Batalkan|' + U.MOD + '+Z';
  U.$('#qat-redo').dataset.tip = A.hist.redo.length ? 'Ulangi: ' + A.hist.redo[A.hist.redo.length - 1].label + '|' + U.MOD + '+Y' : 'Ulangi|' + U.MOD + '+Y';
  // Format tab only for Gantt views (as Project's contextual tab)
  const isG = V.def(A.viewId.split(':')[0]).type === 'gantt';
  const ft = U.$('.rtab[data-tab="fmt"]');
  if (ft) { ft.hidden = !isG; if (!isG && curTab === 'fmt') { curTab = 'task'; R.drawTab(); } }
};

/* ---------------- Berkas (backstage) ---------------- */
R.backstage = (page = 'info') => {
  const A = app(), P = A.P;
  const wrap = el('div.bs');
  const nav = el('nav.bs-nav');
  const main = el('div.bs-main');
  const close = () => { wrap.classList.remove('in'); setTimeout(() => wrap.remove(), 180); removeEventListener('keydown', esc, true); };
  const esc = e => { if (e.key === 'Escape' && !UI.isDialogOpen()) { e.preventDefault(); close(); } };
  addEventListener('keydown', esc, true);
  const pages = [
    ['back', 'Kembali', 'arrow_back'], ['info', 'Info', 'info'], ['new', 'Baru', 'note_add'], ['open', 'Buka', 'folder_open'], ['savecopy', 'Simpan Salinan', 'file_copy'],
    ['import', 'Impor', 'upload_file'], ['export', 'Ekspor', 'ios_share'], ['print', 'Cetak', 'print'], ['versions', 'Riwayat Versi', 'history'], ['sep'], ['options', 'Opsi', 'settings'], ['close', 'Tutup', 'close'],
  ];
  const go = id => {
    if (id === 'back') { close(); return; }
    if (id === 'close') { close(); A.cmd('home'); return; }
    if (id === 'new') { close(); A.cmd('new'); return; }
    if (id === 'open') { close(); A.cmd('home'); return; }
    if (id === 'savecopy') { close(); A.cmd('saveCopy'); return; }
    if (id === 'print') { close(); A.cmd('print'); return; }
    if (id === 'options') { close(); A.cmd('options'); return; }
    if (id === 'versions') { close(); A.cmd('versions'); return; }
    if (id === 'import') { close(); A.cmd('import'); return; }
    U.$$('.bs-nav button').forEach(b => b.classList.toggle('on', b.dataset.p === id));
    main.replaceChildren(id === 'export' ? exportPage(close) : infoPage(close));
  };
  for (const [id, t, ic] of pages) {
    if (id === 'sep') { nav.append(el('div.bs-sep')); continue; }
    nav.append(el('button' + (id === 'back' ? '.bs-back' : ''), { type: 'button', 'data-p': id, onclick: () => go(id) }, icon(ic), el('span', t)));
  }
  wrap.append(nav, main);
  U.$('#app').append(wrap);
  requestAnimationFrame(() => wrap.classList.add('in'));
  go(page);
  void P;
};
function infoPage(close) {
  const A = app(), P = A.P, R0 = P.root;
  const fd = t => U.fmtDate(t, 'dddd, dd mmmm yyyy');
  const stat = (label, v) => el('div.bs-stat', el('span', label), el('b', v));
  return el('div.bs-page',
    el('h1', 'Info'),
    el('div.bs-card',
      el('h2', P.name),
      el('div.bs-stats', stat('Mulai', fd(R0.start)), stat('Selesai', fd(R0.finish)), stat('Durasi', AP.D.fmtDur(R0.sdur, 'd', P.opts)), stat('Selesai', U.num(R0.pct, 0) + '%'), stat('Biaya', U.money(R0.cost, P)), stat('Kerja', AP.D.fmtWork(R0.work, P.opts)), stat('Tugas', String(P.tasks.length)), stat('Sumber daya', String(P.res.length))),
      el('div.bs-actions',
        el('button.btn', { type: 'button', onclick: () => { close(); A.cmd('projectInfo'); } }, icon('info'), 'Informasi Proyek'),
        el('button.btn', { type: 'button', onclick: () => { close(); A.cmd('stats'); } }, icon('query_stats'), 'Statistik'),
        el('button.btn', { type: 'button', onclick: () => { close(); A.cmd('rename'); } }, icon('edit'), 'Ganti Nama'),
        AP.Lock ? el('button.btn', { type: 'button', onclick: () => { close(); A.cmd('lock'); } }, icon(P.lock ? 'lock' : 'lock_open'), P.lock ? 'Kata Sandi…' : 'Kunci dengan Kata Sandi') : null)),
    el('div.bs-card', el('h3', 'Properti'), el('table.bs-props', ...[['Judul', P.props.title || P.name], ['Subjek', P.props.subject], ['Penulis', P.props.author], ['Manajer', P.props.manager], ['Perusahaan', P.props.company], ['Dibuat', U.fmtDate(Math.round((P.created - new Date().getTimezoneOffset() * 60000) / 60000), 'dd mmm yyyy HH.MM')], ['Terakhir diubah', U.fmtDate(Math.round((P.updated - new Date().getTimezoneOffset() * 60000) / 60000), 'dd mmm yyyy HH.MM')]].map(([a, b]) => el('tr', el('td', a), el('td', b || '—'))))),
  );
}
function exportPage(close) {
  const A = app();
  const card = (ic, t, d, cmd) => el('button.bs-exp', { type: 'button', onclick: () => { close(); A.cmd(cmd); } }, icon(ic), el('div', el('b', t), el('span', d)));
  return el('div.bs-page', el('h1', 'Ekspor'),
    el('div.bs-grid',
      card('picture_as_pdf', 'PDF / Cetak', 'Pratinjau halaman, kertas, skala & orientasi otomatis, pemisah halaman rapi, tabel tidak terpotong', 'exportPdf'),
      card('grid_on', 'Microsoft Excel (.xlsx)', 'Pilih lembar kerja otomatis (Tugas, Gantt berwarna, Sumber Daya, Penugasan), siap cetak dengan pemisah halaman', 'exportXlsx'),
      card('code', 'Microsoft Project XML', 'Dibuka langsung di Microsoft Project (Berkas › Buka › XML)', 'exportXml'),
      card('csv', 'CSV', 'Tabel tampilan aktif sebagai teks dipisah koma', 'exportCsv'),
      card('image', 'Gambar PNG', 'Bagan Gantt / tampilan aktif sebagai gambar resolusi tinggi', 'exportPng'),
      card('event', 'Kalender (.ics)', 'Tugas & tonggak untuk Google Calendar / Outlook', 'exportIcs'),
      card('data_object', 'File Amatu Project', 'Cadangan lengkap (.amproj) yang bisa diimpor kembali', 'exportJson')));
}

/* ---------------- Beri tahu saya ---------------- */
function tellMe() {
  const inp = U.$('#tellme');
  if (!inp) return;
  const all = () => {
    const out = [];
    const walk = (it, grp) => {
      if (it.col || it.grid) (it.col || it.grid).forEach(x => walk(x, grp));
      else if (it.check) out.push({ label: it.label || C(it.check).label, icon: 'check_box', run: () => app().cmd(it.check), grp });
      else if (it.cmd) { const c = app().cmds[it.cmd] || {}; out.push({ label: it.label || c.label || it.cmd, icon: it.icon || c.icon, run: () => app().cmd(it.cmd), grp, kbd: c.key }); }
      if (it.menu) { try { for (const m of (typeof it.menu === 'function' ? it.menu() : it.menu)) if (m.label && m.run) out.push({ label: m.label, icon: m.icon, run: m.run, grp: grp + ' › ' + (it.label || '') }); } catch { } }
    };
    for (const t of R.TABS) for (const g of t.groups || []) for (const it of g.items) walk(it, t.t + ' › ' + g.t);
    for (const [k, v] of Object.entries(V.VIEWS)) out.push({ label: 'Tampilan: ' + v.t, icon: v.icon, run: () => app().cmd('view:' + k), grp: 'Tampilan' });
    return out;
  };
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) { UI.closeMenus(); return; }
    const seen = new Set();
    const hits = all().filter(x => x.label && String(x.label).toLowerCase().includes(q) && !seen.has(x.label) && seen.add(x.label)).slice(0, 12);
    if (!hits.length) { UI.menu([{ label: 'Tidak ada perintah untuk "' + inp.value + '"', disabled: true }], inp, { focus: false }); return; }
    UI.menu(hits.map(h => ({ label: h.label, icon: h.icon, kbd: h.kbd, run: () => { inp.value = ''; h.run(); } })), inp, { focus: false });
    inp.focus();
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const f = document.querySelector('.menu .mi:not(.dis)'); if (f) f.click(); inp.value = ''; }
    else if (e.key === 'ArrowDown') { const f = document.querySelector('.menu .mi:not(.dis)'); if (f) { e.preventDefault(); f.focus(); } }
    else if (e.key === 'Escape') { inp.value = ''; UI.closeMenus(); inp.blur(); }
  });
}

/* ---------------- bilah status ---------------- */
R.status = () => {
  const A = app(), P = A.P, sb = U.$('#statusbar');
  if (!P || !sb) return;
  const kind = A.kind(), vs = V.vs(P);
  if (!sb.dataset.built) {
    sb.dataset.built = '1';
    sb.append(
      el('div.sb-l', el('span#sb-ready', 'Siap'), el('button#sb-mode.sb-btn', { type: 'button', 'data-tip': 'Mode penjadwalan tugas baru', onclick: e => UI.menu([{ head: 'Tugas baru' }, { label: 'Dijadwalkan Otomatis', icon: 'event_repeat', checked: () => P.opts.newAuto, run: run('newMode:auto') }, { label: 'Dijadwalkan Manual', icon: 'push_pin', checked: () => !P.opts.newAuto, run: run('newMode:manual') }], e.currentTarget) }), el('button#sb-filter.sb-btn', { type: 'button', onclick: run('clearFilter'), 'data-tip': 'Klik untuk menghapus filter' }), el('span#sb-info')),
      el('div.sb-r',
        ...[['gantt', 'view_timeline', 'Bagan Gantt'], ['tusage', 'table_chart', 'Penggunaan Tugas'], ['team', 'groups', 'Perencana Tim'], ['rsheet', 'badge', 'Lembar Sumber Daya'], ['report:overview', 'monitoring', 'Laporan']].map(([v, ic, t]) => el('button.sb-v', { type: 'button', 'data-v': v, 'data-tip': t, onclick: () => (v.startsWith('report') ? A.cmd(v) : A.cmd('view:' + v)) }, icon(ic))),
        el('div.sb-zoom', el('button.icon-btn.xs', { type: 'button', onclick: run('zoomOut'), 'aria-label': 'Perkecil' }, icon('remove')), el('input#sb-zr', { type: 'range', min: 0, max: TS.ZOOMS.length - 1, step: 1, 'aria-label': 'Zoom skala waktu' }), el('button.icon-btn.xs', { type: 'button', onclick: run('zoomIn'), 'aria-label': 'Perbesar' }, icon('add')))));
    U.$('#sb-zr').addEventListener('input', e => { const v = A.view; if (v && v.chart) v.chart.setZoom(TS.ZOOMS[+e.target.value]); else if (v && v.zoomTo) v.zoomTo(+e.target.value); });
  }
  U.$('#sb-mode').replaceChildren(icon(P.opts.newAuto ? 'event_repeat' : 'push_pin'), el('span', 'Tugas Baru: ' + (P.opts.newAuto ? 'Dijadwalkan Otomatis' : 'Dijadwalkan Manual')));
  const f = vs.filter[kind], h = vs.hl[kind], g = vs.group[kind], af = vs.af[kind] && Object.keys(vs.af[kind]).length;
  const fb = U.$('#sb-filter');
  fb.hidden = !(f || h || g || af || vs.outlineLvl);
  const bits = [];
  if (f) bits.push('Filter: ' + ((V.FILTERS[kind].find(x => x[0] === f.id) || [0, 'Kustom'])[1]).replace('…', ''));
  if (af) bits.push('AutoFilter');
  if (h) bits.push('Sorotan');
  if (g) bits.push('Kelompok');
  if (vs.outlineLvl) bits.push('Kerangka ≤ ' + vs.outlineLvl);
  fb.replaceChildren(icon('filter_alt'), el('span', bits.join(' · ')));
  const sel = A.selTasks();
  const info = [];
  if (P.loop) info.push('⚠ Tautan melingkar');
  if (P.needCalc) info.push('Hitung (F9)');
  if (sel.length > 1) info.push(sel.length + ' tugas dipilih');
  if (P.statusDate != null) info.push('Tanggal status ' + U.fmtDate(P.statusDate, 'dd/mm/yy'));
  U.$('#sb-info').textContent = info.join(' · ');
  U.$$('.sb-v').forEach(b => b.classList.toggle('on', b.dataset.v === A.viewId || (b.dataset.v.startsWith('report') && A.viewId.startsWith('report'))));
  R.statusZoom();
};
R.statusZoom = () => {
  const A = app(), v = A.view, zr = U.$('#sb-zr');
  if (!zr) return;
  const z = v && v.chart ? v.chart.ppd : v && v.zoomIdx != null ? null : null;
  zr.parentElement.hidden = !(v && (v.chart || v.zoomTo));
  if (z != null) { let i = 0; TS.ZOOMS.forEach((q, k) => { if (Math.abs(Math.log(q / z)) < Math.abs(Math.log(TS.ZOOMS[i] / z))) i = k; }); zr.value = i; }
  else if (v && v.zoomIdx != null) zr.value = v.zoomIdx;
};
})();
