// Amatu Project — beranda: proyek terbaru (kartu dengan Gantt mini), templat, buat proyek baru, impor, kelola proyek.
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, M = AP.M, S = AP.S, Store = AP.Store, { el, icon, esc } = U;
const H = AP.Home = {};
let q = '', sortBy = 'updated', viewMode = null;

H.show = async () => {
  const host = U.$('#home');
  AP.app.show('home');
  document.title = 'Amatu Project';
  viewMode = viewMode || Store.ui('home.view') || 'grid';
  let list = [];
  try { list = await Store.list(); } catch (e) { console.error(e); }
  const tpls = AP.Tpl ? AP.Tpl.list() : [];
  const head = el('header.h-top',
    el('div.h-brand', el('img', { src: 'icon.svg', alt: '', width: 34, height: 34 }), el('div', el('b', 'Amatu Project'), el('span', 'Jadwal proyek, Gantt & sumber daya'))),
    el('div.h-search', icon('search'), el('input#h-q', { type: 'search', placeholder: 'Cari proyek', value: q, oninput: e => { q = e.target.value; drawList(); } })),
    el('div.h-acts',
      el('button.btn', { type: 'button', onclick: () => AP.IO.importDialog(AP.app) }, icon('upload_file'), el('span', 'Impor')),
      el('button.icon-btn', { type: 'button', 'data-tip': 'Tema', onclick: e => UI.menu([['auto', 'Ikuti sistem', 'brightness_auto'], ['light', 'Terang', 'light_mode'], ['dark', 'Gelap', 'dark_mode']].map(([k, n, ic]) => ({ label: n, icon: ic, checked: AP.app.theme() === k, run: () => { Store.pref('theme', k); AP.app.applyTheme(); } })), e.currentTarget) }, icon('contrast')),
      el('button.btn.primary', { type: 'button', onclick: () => H.newDialog() }, icon('add'), el('span', 'Proyek Baru'))));
  const gallery = el('section.h-tpl',
    el('div.h-sec', el('h2', 'Mulai proyek baru'), el('button.btn.link', { type: 'button', onclick: () => H.newDialog() }, 'Semua templat', icon('chevron_right'))),
    el('div.h-tpls', ...[{ id: 'blank', t: 'Proyek Kosong', d: 'Mulai dari nol', icon: 'add' }, ...tpls.slice(0, 7)].map(t => tplCard(t))));
  const listBox = el('div.h-list');
  const listHead = el('div.h-sec',
    el('h2', 'Proyek terbaru'),
    el('div.h-tools',
      UI.select([['updated', 'Terakhir diubah'], ['opened', 'Terakhir dibuka'], ['name', 'Nama'], ['start', 'Tanggal mulai']], sortBy, v => { sortBy = v; drawList(); }),
      el('button.icon-btn' + (viewMode === 'grid' ? '.on' : ''), { type: 'button', 'data-tip': 'Kisi', onclick: () => { viewMode = 'grid'; Store.ui('home.view', 'grid'); H.show(); } }, icon('grid_view')),
      el('button.icon-btn' + (viewMode === 'list' ? '.on' : ''), { type: 'button', 'data-tip': 'Daftar', onclick: () => { viewMode = 'list'; Store.ui('home.view', 'list'); H.show(); } }, icon('view_list'))));
  host.replaceChildren(head, el('main.h-main', gallery, el('section.h-recent', listHead, listBox)));
  function drawList() {
    let xs = list.filter(m => !q || String(m.name || '').toLowerCase().includes(q.toLowerCase()));
    xs = xs.slice().sort((a, b) => sortBy === 'name' ? U.cmpText(a.name, b.name) : sortBy === 'start' ? (a.start || 0) - (b.start || 0) : sortBy === 'opened' ? (b.opened || 0) - (a.opened || 0) : (b.updated || 0) - (a.updated || 0));
    xs.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));
    listBox.className = 'h-list m-' + viewMode;
    if (!xs.length) { listBox.replaceChildren(el('div.h-empty', icon(q ? 'search_off' : 'folder_open'), el('p', q ? 'Tidak ada proyek yang cocok.' : 'Belum ada proyek. Buat proyek baru atau impor file Microsoft Project (.xml), Excel, atau CSV.'), q ? null : el('button.btn.primary', { type: 'button', onclick: () => H.newDialog() }, icon('add'), 'Proyek Baru'))); return; }
    listBox.replaceChildren(...xs.map(m => projCard(m)));
  }
  drawList();
  if (!U.touch) setTimeout(() => { const i = U.$('#h-q'); if (i && !list.length) i.blur(); }, 0);
};
function tplCard(t) {
  return el('button.h-tc', { type: 'button', onclick: () => t.id === 'blank' ? H.newDialog('blank') : H.newDialog(t.id) },
    el('div.h-tc-art', t.id === 'blank' ? icon('add') : thumbSVG(t.preview || [])),
    el('b', t.t), el('span', t.d || ''));
}
function thumbSVG(rows) {
  const n = Math.max(rows.length, 6), h = 6, gap = 3, H0 = n * (h + gap);
  const parts = rows.map((r, i) => {
    const [x0, x1, lvl, k] = r, y = i * (h + gap) + 2, a = 6 + x0 * 108, b = 6 + Math.max(x1, x0 + 0.01) * 108;
    if (k === 'm') return `<path d="M${a} ${y - 1}l4 4-4 4-4-4z" fill="#2b3138"/>`;
    if (k === 's') return `<rect x="${a}" y="${y + 1}" width="${b - a}" height="3" fill="#3c4450"/>`;
    return `<rect x="${a}" y="${y}" width="${Math.max(3, b - a)}" height="${h}" rx="1.5" fill="${k === 'c' ? '#e2574c' : '#4a8fd9'}"/>`;
  }).join('');
  const s = el('span.h-svg');
  s.innerHTML = `<svg viewBox="0 0 120 ${Math.max(60, H0 + 4)}" preserveAspectRatio="none"><g opacity=".95">${parts}</g></svg>`;
  return s;
}
function projCard(m) {
  const fd = t => (t ? U.fmtDate(t, 'dd mmm yyyy') : '—');
  const ago = m.updated ? rel(m.updated) : '';
  const open = () => AP.app.go('#/p/' + m.id);
  const card = el('div.h-pc', { tabIndex: 0, role: 'button', onclick: e => { if (!e.target.closest('.h-pc-menu')) open(); }, onkeydown: e => { if (e.key === 'Enter') open(); } },
    el('div.h-pc-art', m.locked ? el('div.h-lock', icon('lock'), 'Terkunci') : thumbSVG(m.thumb || [])),
    el('div.h-pc-body',
      el('div.h-pc-t', m.starred ? icon('star', 'star') : null, el('b', m.name || 'Tanpa nama')),
      el('div.h-pc-d', fd(m.start) + ' – ' + fd(m.finish)),
      el('div.h-pc-m', el('span.h-prog', el('i', { style: { width: (m.pct || 0) + '%' } })), el('span', U.num(m.pct || 0, 0) + '%'), el('span.h-dot', '·'), el('span', (m.n || 0) + ' tugas'), el('span.h-dot', '·'), el('span', ago))),
    el('button.icon-btn.sm.h-pc-menu', { type: 'button', 'aria-label': 'Menu proyek', onclick: e => { e.stopPropagation(); menu(m, e.currentTarget); } }, icon('more_vert')));
  return card;
}
function rel(ms) {
  const d = (Date.now() - ms) / 60000;
  if (d < 1) return 'baru saja';
  if (d < 60) return Math.round(d) + ' mnt lalu';
  if (d < 1440) return Math.round(d / 60) + ' jam lalu';
  if (d < 1440 * 30) return Math.round(d / 1440) + ' hari lalu';
  return new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
function menu(m, anchor) {
  UI.menu([
    { label: 'Buka', icon: 'open_in_new', run: () => AP.app.go('#/p/' + m.id) },
    { label: m.starred ? 'Hapus bintang' : 'Beri bintang', icon: 'star', run: async () => { const P = await Store.get(m.id); if (!P) return; P.starred = !m.starred; await Store.put(M.fix(P)); H.show(); } },
    { label: 'Ganti nama…', icon: 'edit', run: async () => { const n = await UI.prompt('Ganti nama proyek', 'Nama', m.name); if (n == null || !n.trim()) return; const P = await Store.get(m.id); P.name = n.trim(); (P.props ||= {}).title = P.name; await Store.put(M.fix(P)); H.show(); } },
    { label: 'Duplikat', icon: 'file_copy', run: async () => { const P = M.fix(await Store.get(m.id)); P.id = U.uid('p'); P.name = m.name + ' (salinan)'; P.created = P.updated = Date.now(); delete P.lock; S.calc(P); await Store.put(P); H.show(); } },
    { label: 'Unduh (.amproj)', icon: 'download', run: async () => { const P = await Store.get(m.id); U.download(JSON.stringify(P), U.safeName(m.name) + '.amproj', 'application/json'); } },
    { sep: true },
    { label: 'Hapus…', icon: 'delete', danger: true, run: async () => { if (!(await UI.confirm('Hapus proyek "' + m.name + '" beserta riwayat versinya? Tindakan ini tidak dapat dibatalkan.', { ok: 'Hapus', danger: true }))) return; await Store.del(m.id); UI.toast('Proyek dihapus'); H.show(); } },
  ], anchor);
}
// dialog proyek baru: nama, tanggal mulai, jadwal dari, kalender, templat
H.newDialog = (tplId = null) => {
  const tpls = AP.Tpl ? AP.Tpl.list() : [];
  let chosen = tplId || 'blank';
  const name = el('input.inp', { value: '', placeholder: 'Nama proyek' });
  const start = UI.dateInput(U.today() + 480, null, { defTime: 480 });
  const from = UI.select([['start', 'Tanggal mulai proyek'], ['finish', 'Tanggal selesai proyek']], 'start');
  const cal = UI.select([['std', 'Standar (Sen–Jum 08.00–17.00)'], ['six', '6 hari kerja (Sen–Sab)'], ['h24', '24 jam'], ['night', 'Shift malam']], 'std');
  const holi = UI.checkbox('Tambahkan hari libur nasional Indonesia ke kalender', true);
  const grid = el('div.nd-tpls');
  const draw = () => {
    grid.replaceChildren(...[{ id: 'blank', t: 'Proyek Kosong', d: 'Tanpa tugas', icon: 'add' }, ...tpls].map(t => el('button.nd-t' + (chosen === t.id ? '.on' : ''), { type: 'button', onclick: () => { chosen = t.id; if (!name.value || name.dataset.auto) { name.value = t.id === 'blank' ? '' : t.t; name.dataset.auto = '1'; } draw(); } },
      el('div.h-tc-art', t.id === 'blank' ? icon('add') : thumbSVG(t.preview || [])), el('b', t.t), el('span', t.d || ''))));
  };
  if (chosen !== 'blank') { const t = tpls.find(x => x.id === chosen); if (t) { name.value = t.t; name.dataset.auto = '1'; } }
  name.addEventListener('input', () => { delete name.dataset.auto; });
  draw();
  UI.dialog({
    title: 'Proyek Baru', width: 'min(920px, 100%)', cls: 'newdlg',
    body: el('div.nd', el('div.nd-l', UI.field('Nama proyek', name), UI.field('Jadwalkan dari', from), UI.field('Tanggal (mulai / selesai)', start), UI.field('Kalender proyek', cal), holi, el('p.hint', 'Semua bisa diubah lagi di Proyek › Informasi Proyek dan Ubah Waktu Kerja.')), el('div.nd-r', el('div.lbl', 'Templat'), grid)),
    buttons: [{ label: 'Batal' }, { label: 'Buat Proyek', primary: true, icon: 'add', run: async () => {
      const s = start.get() != null ? start.get() : U.today() + 480;
      let P;
      if (chosen !== 'blank' && AP.Tpl) P = AP.Tpl.make(chosen, s);
      else P = M.newProject('Proyek Baru', s);
      P.name = name.value.trim() || P.name || 'Proyek Baru';
      P.props.title = P.name;
      if (cal.value === 'six') { const c = AP.Cal.sixDay(); P.cals.push(c); P.calendar = c.id; }
      else P.calendar = cal.value;
      if (from.value === 'finish') { P.fromFinish = true; P.finish = U.dayStart(s) + P.opts.dayEnd; for (const t of P.tasks) if (t.cons === 'ASAP') t.cons = 'ASAP'; }
      if (holi.input.checked) { const c = P.cals.find(x => x.id === P.calendar) || P.cals[0]; if (c) { const y0 = U.ymd(s).y; for (const y of [y0, y0 + 1]) for (const h of AP.Cal.holidaysID(y)) c.exc.push({ name: h.n, from: h.di, to: h.di, work: [] }); } }
      await AP.app.newProject(P);
    } }],
  });
  setTimeout(() => name.focus(), 50);
};
})();
