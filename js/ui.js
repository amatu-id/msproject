// Amatu Project — komponen antarmuka: dialog, konfirmasi, prompt, menu (submenu dibuka dengan klik), toast, tooltip,
// pemilih tanggal, daftar pilihan, tab, input, kotak centang, segmented control, pemilih warna.
(() => {
'use strict';
const AP = window.AP, U = AP.U, { el, icon } = U;
const UI = AP.UI = {};

/* ---------------- toast ---------------- */
let toastBox = null;
UI.toast = (msg, o = {}) => {
  if (!toastBox) { toastBox = el('div.toasts', { 'aria-live': 'polite' }); document.body.append(toastBox); }
  const t = el('div.toast' + (o.kind ? '.' + o.kind : ''), o.icon ? icon(o.icon) : null, el('span', msg));
  if (o.action) t.append(el('button.btn.link', { type: 'button', onclick: () => { o.action.run(); t.remove(); } }, o.action.label));
  if (o.key) for (const x of toastBox.querySelectorAll('[data-key]')) if (x.dataset.key === o.key) x.remove();
  if (o.key) t.dataset.key = o.key;
  toastBox.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, o.ms || 3200);
  return t;
};

/* ---------------- dialog ---------------- */
const stack = [];
UI.dialog = (o) => {
  UI.closeMenus();
  const back = el('div.dlg-back' + (o.modeless ? '.modeless' : ''));
  const foot = el('div.dlg-foot');
  const head = el('div.dlg-head', el('h2', o.title || ''), el('button.icon-btn.sm.dlg-x', { type: 'button', 'aria-label': 'Tutup', onclick: () => close() }, icon('close')));
  const body = el('div.dlg-body', o.body || null);
  const box = el('div.dlg' + (o.cls ? '.' + o.cls.split(' ').join('.') : ''), { role: 'dialog', 'aria-modal': o.modeless ? 'false' : 'true', style: { width: o.width || '' } }, head, body, foot);
  back.append(box);
  let closed = false;
  const me = { el: box, back, body, foot, close, head };
  function close(v) {
    if (closed) return;
    closed = true;
    back.classList.remove('in');
    setTimeout(() => back.remove(), 160);
    const i = stack.indexOf(me); if (i >= 0) stack.splice(i, 1);
    window.removeEventListener('keydown', onKey, true);
    o.onClose && o.onClose(v);
  }
  for (const b of o.buttons || [{ label: 'Tutup', primary: true }]) {
    const btn = el('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : '') + (b.left ? '.left' : ''), { type: 'button' }, b.icon ? icon(b.icon) : null, b.label);
    btn.addEventListener('click', async () => {
      if (b.run) { let r; try { r = await b.run(me); } catch (e) { UI.toast(String(e && e.message || e), { kind: 'bad', ms: 5000 }); return; } if (r === false) return; }
      close(b.value);
    });
    if (b.left) foot.prepend(btn); else foot.append(btn);
    if (b.primary) me.primary = btn;
  }
  if (!(o.buttons || [1]).length) foot.remove();
  function onKey(e) {
    if (stack[stack.length - 1] !== me) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!document.querySelector('.menu')) close(); else UI.closeMenus(); }
    else if (e.key === 'Enter' && me.primary && !e.shiftKey && !e.isComposing) {
      const a = document.activeElement;
      if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'BUTTON' || a.tagName === 'SELECT' || (a.isContentEditable))) return;
      if (a && a.dataset && a.dataset.noenter) return;
      e.preventDefault(); me.primary.click();
    }
  }
  window.addEventListener('keydown', onKey, true);
  if (!o.noBackdropClose && !o.modeless) back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  document.body.append(back);
  stack.push(me);
  requestAnimationFrame(() => {
    back.classList.add('in');
    const f = o.focus ? box.querySelector(o.focus) : box.querySelector('[autofocus], .dlg-body input:not([type=checkbox]):not([type=radio]):not([disabled]), .dlg-body select, .dlg-body textarea');
    if (f && !U.touch) { f.focus(); if (f.select && f.type !== 'number' && f.type !== 'date') try { f.select(); } catch { } }
  });
  if (o.drag !== false) dragBy(head, box);
  return me;
};
UI.isDialogOpen = () => stack.some(d => d.back.isConnected && !d.back.classList.contains('modeless'));
function dragBy(handle, box) {
  handle.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || matchMedia('(max-width: 760px)').matches) return;
    const r = box.getBoundingClientRect(), z = U.zoom(), x0 = e.clientX, y0 = e.clientY;
    box.style.position = 'fixed'; box.style.margin = '0'; box.style.left = r.left / z + 'px'; box.style.top = r.top / z + 'px';
    const mv = ev => { box.style.left = (r.left + ev.clientX - x0) / z + 'px'; box.style.top = Math.max(0, (r.top + ev.clientY - y0) / z) + 'px'; };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
}
UI.confirm = (msg, o = {}) => new Promise(res => {
  let v = false;
  UI.dialog({ title: o.title || 'Konfirmasi', width: o.width || '440px', body: el('div.confirm-msg', typeof msg === 'string' ? el('p', msg) : msg),
    buttons: [{ label: o.cancel || 'Batal' }, { label: o.ok || 'OK', primary: true, danger: !!o.danger, run: () => { v = true; } }], onClose: () => res(v) });
});
UI.alert = (msg, title = 'Amatu Project') => UI.confirm(msg, { title, ok: 'OK', cancel: 'Tutup' });
UI.prompt = (title, label, value = '', o = {}) => new Promise(res => {
  const inp = o.multiline ? el('textarea.inp', { rows: o.rows || 6, value }) : el('input.inp', { type: o.type || 'text', value, placeholder: o.placeholder || '' });
  let v = null;
  UI.dialog({ title, width: o.width || '460px', body: el('div', UI.field(label, inp, o.hint)), buttons: [{ label: 'Batal' }, { label: o.ok || 'OK', primary: true, run: () => { v = inp.value; } }], onClose: () => res(v) });
});

/* ---------------- form controls ---------------- */
UI.field = (label, input, hint) => el('label.field', el('span.lbl', label), input, hint ? el('small.hint', hint) : null);
UI.row = (...kids) => el('div.frow', ...kids);
UI.select = (opts, value, onChange, attrs = {}) => {
  const s = el('select.inp', attrs);
  for (const o of opts) {
    const [v, l] = Array.isArray(o) ? o : [o.value, o.label];
    s.append(el('option', { value: v }, l));
  }
  s.value = value == null ? '' : value;
  if (onChange) s.addEventListener('change', () => onChange(s.value, s));
  return s;
};
UI.input = (value, onChange, attrs = {}) => {
  const i = el('input.inp', { type: 'text', ...attrs, value: value == null ? '' : value });
  if (onChange) i.addEventListener('change', () => onChange(i.value, i));
  return i;
};
UI.checkbox = (label, checked, onChange, attrs = {}) => {
  const i = el('input', { type: 'checkbox', ...attrs });
  i.checked = !!checked;
  if (onChange) i.addEventListener('change', () => onChange(i.checked, i));
  const l = el('label.check', i, el('span', label));
  l.input = i;
  return l;
};
UI.radio = (name, items, value, onChange) => {
  const w = el('div.radios');
  for (const [v, label] of items) {
    const i = el('input', { type: 'radio', name, value: v });
    i.checked = v === value;
    i.addEventListener('change', () => { if (i.checked) onChange && onChange(v); });
    w.append(el('label.check', i, el('span', label)));
  }
  w.value = () => (w.querySelector('input:checked') || {}).value;
  return w;
};
UI.seg = (items, value, onPick) => {
  const w = el('div.seg', { role: 'radiogroup' });
  const btns = items.map(([v, label, ic]) => { const b = el('button', { type: 'button', role: 'radio', onclick: () => { set(v); onPick && onPick(v); } }, ic ? icon(ic) : null, label ? el('span', label) : null); b._v = v; w.append(b); return b; });
  function set(v) { for (const b of btns) { b.classList.toggle('on', b._v === v); b.setAttribute('aria-checked', String(b._v === v)); } w._v = v; }
  set(value);
  w.set = set; w.get = () => w._v;
  return w;
};
UI.tabs = (tabs, onChange) => {
  const bar = el('div.tabs-bar', { role: 'tablist' }), pages = el('div.tabs-pages');
  const w = el('div.tabs', bar, pages);
  tabs.forEach((t, i) => {
    const b = el('button.tab', { type: 'button', role: 'tab' }, t.label);
    const p = el('div.tab-page', t.body);
    b.addEventListener('click', () => show(i));
    bar.append(b); pages.append(p);
  });
  function show(i) { [...bar.children].forEach((b, k) => b.classList.toggle('on', k === i)); [...pages.children].forEach((p, k) => { p.hidden = k !== i; }); w.cur = i; onChange && onChange(i); }
  show(0);
  w.show = show;
  return w;
};
UI.SWATCH = ['#4a8fd9', '#2f6fb5', '#1f9d6b', '#43a047', '#7cb342', '#fbc02d', '#fb8c00', '#e65a3f', '#d93a4a', '#c2185b', '#8e44ad', '#5e35b1', '#3949ab', '#00897b', '#00acc1', '#6d4c41', '#546e7a', '#9e9e9e', '#424242', '#000000'];
UI.color = (value, onChange) => {
  const w = el('div.colors');
  const inp = el('input', { type: 'color', value: value || '#4a8fd9' });
  for (const c of UI.SWATCH) w.append(el('button.sw', { type: 'button', style: { background: c }, 'aria-label': c, onclick: () => { inp.value = c; onChange(c); mark(); } }));
  inp.addEventListener('input', () => { onChange(inp.value); mark(); });
  w.append(inp);
  const mark = () => { for (const b of w.querySelectorAll('.sw')) b.classList.toggle('on', b.style.background && U.rgbHex(b.style.background) === inp.value.toLowerCase()); };
  mark();
  w.input = inp;
  return w;
};
U.rgbHex = s => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s); return m ? '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('') : String(s).toLowerCase(); };

/* ---------------- menu (klik untuk membuka submenu) ---------------- */
let menus = [];
UI.closeMenus = () => { for (const m of menus) m.remove(); menus = []; document.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', menuKey, true); if (UI._menuClose) { const f = UI._menuClose; UI._menuClose = null; f(); } };
function outside(e) { if (!menus.some(m => m.contains(e.target)) && !(UI._menuAnchor && UI._menuAnchor.contains(e.target))) UI.closeMenus(); }
function menuKey(e) {
  if (!menus.length) return;
  const m = menus[menus.length - 1];
  const items = [...m.querySelectorAll('.mi:not(.dis)')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (menus.length > 1) { menus.pop().remove(); const p = menus[menus.length - 1].querySelector('.mi.open'); if (p) { p.classList.remove('open'); p.focus(); } } else UI.closeMenus(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); (items[(i + 1) % items.length] || items[0]).focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); (items[(i - 1 + items.length) % items.length] || items[0]).focus(); }
  else if (e.key === 'ArrowRight' && document.activeElement && document.activeElement._sub) { e.preventDefault(); document.activeElement.click(); }
  else if (e.key === 'ArrowLeft' && menus.length > 1) { e.preventDefault(); menus.pop().remove(); const p = menus[menus.length - 1].querySelector('.mi.open'); if (p) { p.classList.remove('open'); p.focus(); } }
  else if (e.key === 'Enter' && document.activeElement && document.activeElement.classList.contains('mi')) { e.preventDefault(); document.activeElement.click(); }
}
const val = (v, ...a) => (typeof v === 'function' ? v(...a) : v);
function build(items, level) {
  const m = el('div.menu', { role: 'menu' });
  for (const it of items) {
    if (!it || val(it.hidden)) continue;
    if (it.sep) { m.append(el('div.msep')); continue; }
    if (it.head) { m.append(el('div.mhead', it.head)); continue; }
    if (it.node) { m.append(it.node); continue; }
    const dis = !!val(it.disabled), chk = val(it.checked);
    const row = el('button.mi' + (dis ? '.dis' : '') + (it.danger ? '.danger' : ''), { type: 'button', role: 'menuitem', tabIndex: -1 },
      el('span.mic', chk === true ? icon('check') : it.icon ? icon(it.icon) : null),
      el('span.mlabel', val(it.label)),
      it.kbd ? el('span.mkbd', it.kbd) : null,
      it.sub ? el('span.marr', icon('chevron_right')) : null);
    if (it.color) row.querySelector('.mic').append(el('i.mdot', { style: { background: it.color } }));
    row._sub = !!it.sub;
    row.addEventListener('click', e => {
      e.stopPropagation();
      if (dis) return;
      if (it.sub) {
        // close deeper menus, toggle this submenu
        const lvl = menus.indexOf(m);
        const wasOpen = row.classList.contains('open');
        while (menus.length > lvl + 1) menus.pop().remove();
        m.querySelectorAll('.mi.open').forEach(x => x.classList.remove('open'));
        if (wasOpen) return;
        row.classList.add('open');
        const sm = build(val(it.sub) || [], level + 1);
        document.body.append(sm);
        menus.push(sm);
        place(sm, row.getBoundingClientRect(), true);
        const f = sm.querySelector('.mi:not(.dis)'); if (f) f.focus();
        return;
      }
      UI.closeMenus();
      try { it.run && it.run(); } catch (err) { UI.toast(String(err && err.message || err), { kind: 'bad' }); }
    });
    m.append(row);
  }
  if (!m.children.length) m.append(el('div.mhead', 'Tidak ada pilihan'));
  return m;
}
function place(m, r, side) {
  const z = U.zoom(), vw = innerWidth / z, vh = innerHeight / z;
  const R = { left: r.left / z, right: r.right / z, top: r.top / z, bottom: r.bottom / z };
  m.style.visibility = 'hidden';
  const w = m.offsetWidth, h = m.offsetHeight;
  let x = side ? R.right - 2 : R.left, y = side ? R.top - 4 : R.bottom + 2;
  if (x + w > vw - 4) x = side ? Math.max(4, R.left - w + 2) : Math.max(4, vw - w - 4);
  if (y + h > vh - 4) y = side ? Math.max(4, vh - h - 4) : (R.top - h - 2 > 4 ? R.top - h - 2 : Math.max(4, vh - h - 4));
  m.style.left = x + 'px'; m.style.top = y + 'px'; m.style.maxHeight = (vh - 8) + 'px';
  m.style.visibility = '';
}
// UI.menu(items, anchorElement | {x,y}, {onClose})
UI.menu = (items, at, o = {}) => {
  UI.closeMenus();
  const m = build(items, 0);
  document.body.append(m);
  menus.push(m);
  let r;
  if (at instanceof Element) { r = at.getBoundingClientRect(); UI._menuAnchor = at; }
  else { const z = U.zoom(); r = { left: at.x * z, right: at.x * z, top: at.y * z, bottom: at.y * z }; UI._menuAnchor = null; }
  place(m, r, false);
  UI._menuClose = o.onClose || null;
  setTimeout(() => { document.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', menuKey, true); }, 0);
  if (o.focus !== false && !U.touch) { const f = m.querySelector('.mi:not(.dis)'); if (f) f.focus({ preventScroll: true }); }
  return m;
};
UI.menuOpen = () => menus.length > 0;

/* ---------------- tooltip ---------------- */
let tipEl = null, tipT = 0, tipFor = null;
UI.initTips = () => {
  tipEl = el('div.tip', { role: 'tooltip' });
  document.body.append(tipEl);
  document.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t === tipFor) return;
    hideTip();
    if (!t) return;
    tipFor = t;
    tipT = setTimeout(() => showTip(t), 480);
  });
  document.addEventListener('pointerdown', hideTip, true);
  document.addEventListener('keydown', hideTip, true);
  window.addEventListener('blur', hideTip);
};
function showTip(t) {
  if (!t.isConnected || UI.menuOpen()) return;
  const [a, b] = String(t.dataset.tip).split('|');
  tipEl.replaceChildren(el('b', a), b ? el('span.tk', b) : null);
  if (t.dataset.tipd) tipEl.append(el('div.td', t.dataset.tipd));
  tipEl.classList.add('show');
  const r = t.getBoundingClientRect(), z = U.zoom();
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = r.left / z + r.width / z / 2 - w / 2, y = r.bottom / z + 6;
  if (y + h > innerHeight / z - 4) y = r.top / z - h - 6;
  tipEl.style.left = U.clamp(x, 4, innerWidth / z - w - 4) + 'px';
  tipEl.style.top = y + 'px';
}
function hideTip() { clearTimeout(tipT); tipFor = null; if (tipEl) tipEl.classList.remove('show'); }
UI.hideTip = hideTip;
// floating hover card (bars, indicators)
let card = null;
UI.card = (content, x, y) => {
  if (!card) { card = el('div.hcard'); document.body.append(card); }
  if (!content) { card.classList.remove('show'); return; }
  card.replaceChildren(content);
  card.classList.add('show');
  const z = U.zoom(), w = card.offsetWidth, h = card.offsetHeight, vw = innerWidth / z, vh = innerHeight / z;
  card.style.left = U.clamp(x + 14, 4, vw - w - 6) + 'px';
  card.style.top = (y + 18 + h > vh - 6 ? Math.max(4, y - h - 12) : y + 18) + 'px';
};

/* ---------------- pemilih tanggal ---------------- */
UI.datePicker = (anchor, value, onPick, o = {}) => {
  UI.closeMenus();
  const today = U.today();
  let view = U.ymd(value != null && isFinite(value) ? value : today);
  const box = el('div.menu.dp', { role: 'dialog' });
  const time = value != null && isFinite(value) ? value % 1440 : o.defTime || 0;
  const draw = () => {
    const first = U.mk(view.y, view.m, 1), ws = o.weekStart == null ? 1 : o.weekStart;
    const off = ((U.ymd(first).dow - ws) + 7) % 7;
    const head = el('div.dp-head',
      el('button.icon-btn.sm', { type: 'button', 'aria-label': 'Bulan sebelumnya', onclick: e => { e.stopPropagation(); view = U.ymd(U.mk(view.y, view.m - 1, 1)); draw(); } }, icon('chevron_left')),
      el('b', U.MON_L[view.m] + ' ' + view.y),
      el('button.icon-btn.sm', { type: 'button', 'aria-label': 'Bulan berikutnya', onclick: e => { e.stopPropagation(); view = U.ymd(U.mk(view.y, view.m + 1, 1)); draw(); } }, icon('chevron_right')));
    const grid = el('div.dp-grid');
    for (let i = 0; i < 7; i++) grid.append(el('span.dp-dow', U.DOW_1[(ws + i) % 7]));
    for (let i = 0; i < 42; i++) {
      const t = first + (i - off) * 1440, a = U.ymd(t);
      const b = el('button.dp-d' + (a.m !== view.m ? '.out' : '') + (t === today ? '.today' : '') + (value != null && U.dayStart(value) === t ? '.on' : '') + (a.dow === 0 || a.dow === 6 ? '.we' : ''), { type: 'button', onclick: e => { e.stopPropagation(); UI.closeMenus(); onPick(t + time); } }, String(a.d));
      grid.append(b);
    }
    const foot = el('div.dp-foot',
      el('button.btn.sm', { type: 'button', onclick: e => { e.stopPropagation(); UI.closeMenus(); onPick(today + time); } }, 'Hari ini'),
      o.clear ? el('button.btn.sm', { type: 'button', onclick: e => { e.stopPropagation(); UI.closeMenus(); onPick(null); } }, 'Kosongkan (NA)') : null);
    box.replaceChildren(head, grid, foot);
  };
  draw();
  document.body.append(box);
  menus.push(box);
  UI._menuAnchor = anchor;
  place(box, anchor.getBoundingClientRect(), false);
  setTimeout(() => { document.addEventListener('pointerdown', outside, true); window.addEventListener('keydown', menuKey, true); }, 0);
  return box;
};
// date input with calendar button (dialogs)
UI.dateInput = (value, onChange, o = {}) => {
  const P = AP.app && AP.app.P;
  const fmt = v => (v == null || !isFinite(v) ? (o.clear ? 'NA' : '') : U.fmtDate(v, o.fmt || (P ? P.opts.dateFmt : 'dd/mm/yy') + (o.time ? ' HH.MM' : '')));
  const inp = el('input.inp', { type: 'text', value: fmt(value), placeholder: o.placeholder || 'dd/mm/yy' });
  let cur = value;
  const set = v => { cur = v; inp.value = fmt(v); onChange && onChange(v); };
  inp.addEventListener('change', () => {
    const s = inp.value.trim();
    if (!s || /^na$/i.test(s)) { if (o.clear) set(null); else inp.value = fmt(cur); return; }
    const v = U.parseDate(s, o.defTime == null ? (cur != null ? cur % 1440 : 0) : o.defTime);
    if (!isFinite(v)) { UI.toast('Tanggal tidak dikenali: ' + s, { kind: 'bad' }); inp.value = fmt(cur); return; }
    set(v);
  });
  const btn = el('button.icon-btn.sm.dt-btn', { type: 'button', 'aria-label': 'Pilih tanggal', onclick: () => UI.datePicker(w, cur, v => set(v), { clear: o.clear, defTime: o.defTime, weekStart: P ? P.opts.weekStart : 1 }) }, icon('calendar_month'));
  const w = el('div.dt-inp', inp, btn);
  w.input = inp; w.get = () => cur; w.set = v => { cur = v; inp.value = fmt(v); };
  return w;
};
// pick from a list (enum editor)
UI.listPick = (anchor, opts, value, onPick) => UI.menu(opts.map(([v, l, ic]) => ({ label: l, icon: ic, checked: v === value, run: () => onPick(v) })), anchor);

/* ---------------- tabel kecil yang bisa diedit (dialog) ---------------- */
// cols: [{k, t, w, type:'text'|'num'|'select'|'date', opts, ro}], rows: array of objects; onChange(rows)
UI.miniTable = (cols, rows, onChange, o = {}) => {
  const w = el('div.mtable');
  const draw = () => {
    const tbl = el('table');
    tbl.append(el('thead', el('tr', ...cols.map(c => el('th', { style: { width: c.w ? c.w + 'px' : '' } }, c.t)), o.del !== false ? el('th', { style: { width: '30px' } }) : null)));
    const tb = el('tbody');
    rows.forEach((r, i) => {
      const tr = el('tr');
      for (const c of cols) {
        let inp;
        const v = r[c.k];
        if (c.ro) inp = el('span.mt-ro', c.fmt ? c.fmt(v, r) : v == null ? '' : String(v));
        else if (c.type === 'select') { inp = UI.select(typeof c.opts === 'function' ? c.opts(r) : c.opts, v, nv => { r[c.k] = nv; c.onSet && c.onSet(r, nv); onChange(rows); }); }
        else { inp = el('input.inp.sm', { type: 'text', value: c.fmt ? c.fmt(v, r) : v == null ? '' : v }); inp.addEventListener('change', () => { try { r[c.k] = c.parse ? c.parse(inp.value, r) : inp.value; c.onSet && c.onSet(r, r[c.k]); onChange(rows); } catch (e) { UI.toast(String(e), { kind: 'bad' }); inp.value = c.fmt ? c.fmt(r[c.k], r) : r[c.k] == null ? '' : r[c.k]; } }); }
        tr.append(el('td', inp));
      }
      if (o.del !== false) tr.append(el('td', el('button.icon-btn.sm', { type: 'button', 'aria-label': 'Hapus baris', onclick: () => { rows.splice(i, 1); onChange(rows); draw(); } }, icon('delete'))));
      tb.append(tr);
    });
    tbl.append(tb);
    w.replaceChildren(tbl);
    if (o.add) w.append(el('button.btn.sm.mt-add', { type: 'button', onclick: () => { rows.push(o.add()); onChange(rows); draw(); } }, icon('add'), o.addLabel || 'Tambah baris'));
  };
  draw();
  w.redraw = draw;
  return w;
};
})();
