// Amatu Project — tabel virtual (lembar tugas / sumber daya / penggunaan): hanya baris yang terlihat yang digambar,
// kolom ID beku, ubah lebar & urutan kolom, edit sel di tempat (teks, durasi, tanggal + kalender, pilihan, sumber daya),
// seleksi sel/baris (Shift/Ctrl), keyboard seperti Microsoft Project, salin/tempel TSV, seret baris untuk memindahkan.
(() => {
'use strict';
const AP = window.AP, U = AP.U, F = AP.F, D = AP.D, UI = AP.UI, { el, icon, esc } = U;
let SBW = null;
const sbw = () => { if (SBW != null) return SBW; const d = el('div', { style: { position: 'absolute', top: '-200px', width: '100px', height: '100px', overflow: 'scroll' } }); document.body.append(d); SBW = d.offsetWidth - d.clientWidth; d.remove(); return SBW; };

class Grid {
  constructor(o) {
    this.o = o;
    this.app = o.app;
    this.kind = o.kind || 'task';
    this.rows = [];
    this.cols = [];
    this.selKeys = new Set();
    this.anchor = null; this.focusKey = null; this.colKey = null; this.colA = null;
    this.host = el('div.grid');
    o.host.append(this.host);
    this.scroll = el('div.g-scroll', { tabIndex: 0, 'aria-label': o.label || 'Tabel' });
    this.inner = el('div.g-inner');
    this.head = el('div.g-head');
    this.body = el('div.g-rows');
    this.inner.append(this.head, this.body);
    this.scroll.append(this.inner);
    this.host.append(this.scroll);
    if (o.hideV !== false) this.scroll.style.marginRight = -sbw() + 'px';
    this.paint = U.raf(() => this.drawRows());
    this.scroll.addEventListener('scroll', () => { this.paint(); if (this.o.onScroll && !this._syncing) this.o.onScroll(this.scroll.scrollTop); if (this.editor) this.placeEditor(); });
    this.bind();
  }
  get P() { return this.app.P; }
  get rowH() { return this.o.rowH ? this.o.rowH() : 24; }
  get headH() { return this.o.headH ? this.o.headH() : 44; }
  setRows(rows) { this.rows = rows; this.keyIdx = new Map(rows.map((r, i) => [r.key, i])); for (const k of [...this.selKeys]) if (!this.keyIdx.has(k)) this.selKeys.delete(k); }
  setCols(cols) { this.cols = cols; }
  idx(key) { const i = this.keyIdx && this.keyIdx.get(key); return i == null ? -1 : i; }
  setScrollTop(y) { if (Math.abs(this.scroll.scrollTop - y) < 1) return; this._syncing = true; this.scroll.scrollTop = y; this._syncing = false; this.paint(); }
  get scrollTop() { return this.scroll.scrollTop; }
  get viewH() { return this.scroll.clientHeight - this.headH; }
  totalW() { return (this.o.idW || 46) + this.cols.reduce((s, c) => s + c.w, 0); }
  colX(i) { let x = this.o.idW || 46; for (let k = 0; k < i; k++) x += this.cols[k].w; return x; }

  render() {
    const H = this.headH, rh = this.rowH, W = this.totalW();
    this.inner.style.width = W + 'px';
    this.inner.style.height = H + this.rows.length * rh + 'px';
    this.drawHead();
    this.drawRows();
  }
  drawHead() {
    const H = this.headH, P = this.P;
    const reg = F.reg(this.kind === 'res' ? 'res' : 'task');
    const cells = [`<div class="gh gid" style="width:${this.o.idW || 46}px;height:${H}px" data-h="id">${this.o.corner || ''}</div>`];
    let x = this.o.idW || 46;
    this.cols.forEach((c, i) => {
      const f = reg[c.k] || {};
      const title = c.title || (f.short != null ? f.short : F.title(c.k, P, this.kind === 'res' ? 'res' : 'task'));
      const ic = c.k === 'ind' ? '<span class="ms">info</span>' : c.k === 'mode' ? '<span class="ms">event_repeat</span>' : '';
      const filt = this.o.filterIcon && this.o.filterIcon(c.k);
      const sorted = this.o.sortIcon && this.o.sortIcon(c.k);
      cells.push(`<div class="gh${this.colKey === c.k && this.wholeCol ? ' on' : ''}" style="width:${c.w}px;height:${H}px;text-align:${c.al || (f.al === 'r' ? 'right' : f.al === 'c' ? 'center' : 'left')}" data-c="${i}" title="${esc(F.title(c.k, P, this.kind === 'res' ? 'res' : 'task'))}">${ic}<span class="ght">${esc(title)}</span>${sorted ? `<span class="ms gsort">${sorted}</span>` : ''}${this.o.autoFilter ? `<button class="gfilt${filt ? ' on' : ''}" data-f="${i}" tabindex="-1" aria-label="Filter"><span class="ms">${filt ? 'filter_alt' : 'arrow_drop_down'}</span></button>` : ''}<i class="grz" data-rz="${i}"></i></div>`);
      x += c.w;
    });
    this.head.style.height = H + 'px';
    this.head.innerHTML = cells.join('');
  }
  drawRows() {
    const rh = this.rowH, H = this.headH, top = this.scroll.scrollTop, vh = this.scroll.clientHeight;
    const n = this.rows.length;
    const i0 = Math.max(0, Math.floor(top / rh) - 10), i1 = Math.min(n - 1, Math.ceil((top + vh) / rh) + 10);
    const P = this.P, out = [];
    const focusI = this.focusKey != null ? this.idx(this.focusKey) : -1;
    const ci = this.cols.findIndex(c => c.k === this.colKey);
    const ca = this.colA != null ? this.cols.findIndex(c => c.k === this.colA) : ci;
    const c1 = Math.min(ci, ca), c2 = Math.max(ci, ca);
    for (let i = i0; i <= i1; i++) {
      const r = this.rows[i];
      const sel = this.selKeys.has(r.key);
      out.push(this.rowHTML(r, i, H + i * rh, rh, sel, i === focusI ? ci : -1, sel && !this.wholeRow ? [c1, c2] : null));
    }
    this.body.innerHTML = out.join('');
    if (this.o.afterPaint) this.o.afterPaint(i0, i1);
  }
  rowHTML(r, i, y, h, sel, focusC, rangeC) {
    const P = this.P, kind = this.kind;
    const cls = ['gr'];
    if (sel) cls.push('sel');
    if (this.o.rowClass) { const c = this.o.rowClass(r); if (c) cls.push(c); }
    const id = r.kind === 'blank' ? '' : this.o.idText ? this.o.idText(r) : (r.x && r.x.id != null ? r.x.id : '');
    const cells = [`<div class="gc gid${sel && this.wholeRow ? ' on' : ''}" style="width:${this.o.idW || 46}px" data-h="row">${id}</div>`];
    this.cols.forEach((c, k) => {
      const inRange = rangeC && k >= rangeC[0] && k <= rangeC[1];
      cells.push(`<div class="gc${k === focusC ? ' focus' : ''}${inRange ? ' rng' : ''}${c.wrap ? ' wrap' : ''}" style="width:${c.w}px${c.al ? ';text-align:' + (c.al === 'r' ? 'right' : c.al === 'c' ? 'center' : 'left') : ''}" data-c="${k}">${this.cellHTML(r, c)}</div>`);
    });
    return `<div class="${cls.join(' ')}" style="top:${y}px;height:${h}px" data-i="${i}">${cells.join('')}</div>`;
  }
  cellHTML(r, c) {
    if (this.o.cell) { const v = this.o.cell(r, c); if (v != null) return v; }
    if (r.kind === 'blank' || r.kind === 'group' || !r.x) return '';
    const kind = r.kind === 'res' ? 'res' : 'task';
    const P = this.P, f = F.reg(kind)[c.k];
    if (!f) return '';
    if (c.k === 'ind') {
      const list = kind === 'res' ? F.resIndicators(r.x, P) : F.indicators(r.x, P);
      return list.slice(0, 3).map(([ic, tip, k]) => `<span class="ms gind${k ? ' ' + k : ''}" data-tip="${esc(tip)}">${ic}</span>`).join('');
    }
    if (c.k === 'mode' && kind === 'task') return `<span class="ms gmode${r.x.mode === 'manual' ? ' man' : ''}" data-tip="${r.x.mode === 'manual' ? 'Dijadwalkan Manual' : 'Dijadwalkan Otomatis'}">${r.x.mode === 'manual' ? 'push_pin' : 'event_repeat'}</span>`;
    const txt = F.text(kind, c.k, r.x, P);
    if (c.k === 'name') {
      const lvl = r.lvl || (r.x.lvl || 1);
      const pad = (Math.max(1, lvl) - 1) * 16 + (kind === 'task' ? 18 : 4);
      let tog = '';
      if (kind === 'task' && r.x.sum && !r.flat) tog = `<span class="ms gtog" data-tog="1">${r.x.col ? 'chevron_right' : 'expand_more'}</span>`;
      if (r.kind === 'asg') tog = '';
      const st = r.x.style;
      const sty = st ? `${st.b ? 'font-weight:700;' : ''}${st.i ? 'font-style:italic;' : ''}${st.u ? 'text-decoration:underline;' : ''}${st.c ? 'color:' + st.c + ';' : ''}` : '';
      return `<span class="gname" style="padding-left:${pad}px;${sty}">${tog}<span class="gnt">${esc(txt)}</span></span>`;
    }
    if (f.type === 'flag' && !F.isRO(kind, c.k, r.x, P)) return `<span class="gflag${f.get(r.x, P) ? ' on' : ''}">${f.get(r.x, P) ? 'Ya' : 'Tidak'}</span>`;
    return esc(txt);
  }

  /* ---------------- selection ---------------- */
  selected() { return this.rows.filter(r => this.selKeys.has(r.key)); }
  selectedX() { return this.selected().filter(r => r.x && r.kind !== 'blank' && r.kind !== 'group').map(r => r.x); }
  focusRow() { const i = this.idx(this.focusKey); return i >= 0 ? this.rows[i] : null; }
  selectKeys(keys, focus, col) {
    this.selKeys = new Set(keys);
    this.focusKey = focus != null ? focus : keys[keys.length - 1];
    this.anchor = keys[0];
    if (col) this.colKey = col;
    if (!this.colKey && this.cols.length) this.colKey = (this.cols.find(c => c.k === 'name') || this.cols[0]).k;
    this.wholeRow = false; this.wholeCol = false; this.colA = null;
    this.paint();
    this.o.onSel && this.o.onSel();
  }
  selectIdx(i, extend = false, toggle = false, col = null) {
    if (!this.rows.length) return;
    i = U.clamp(i, 0, this.rows.length - 1);
    const key = this.rows[i].key;
    if (col) this.colKey = col;
    if (extend && this.anchor != null && this.idx(this.anchor) >= 0) {
      const a = this.idx(this.anchor), lo = Math.min(a, i), hi = Math.max(a, i);
      this.selKeys = new Set(this.rows.slice(lo, hi + 1).map(r => r.key));
    } else if (toggle) {
      if (this.selKeys.has(key)) this.selKeys.delete(key); else this.selKeys.add(key);
      this.anchor = key;
    } else { this.selKeys = new Set([key]); this.anchor = key; this.colA = null; }
    this.focusKey = key;
    if (!this.colKey && this.cols.length) this.colKey = (this.cols.find(c => c.k === 'name') || this.cols[0]).k;
    this.wholeCol = false;
    this.ensureVisible(i);
    this.paint();
    this.o.onSel && this.o.onSel();
  }
  ensureVisible(i, center = false) {
    const rh = this.rowH, top = this.scroll.scrollTop, vh = this.scroll.clientHeight - this.headH;
    const y = i * rh;
    let nt = top;
    if (center) nt = Math.max(0, y - vh / 2);
    else if (y < top) nt = y;
    else if (y + rh > top + vh) nt = y + rh - vh;
    if (nt !== top) { this.scroll.scrollTop = nt; if (this.o.onScroll) this.o.onScroll(nt); }
    // horizontal
    const ci = this.cols.findIndex(c => c.k === this.colKey);
    if (ci >= 0) {
      const x = this.colX(ci), w = this.cols[ci].w, l = this.scroll.scrollLeft, cw = this.scroll.clientWidth, idw = this.o.idW || 46;
      if (x - idw < l) this.scroll.scrollLeft = x - idw; else if (x + w > l + cw) this.scroll.scrollLeft = x + w - cw;
    }
  }
  focus() { if (document.activeElement !== this.scroll && !this.editor) this.scroll.focus({ preventScroll: true }); }

  /* ---------------- events ---------------- */
  bind() {
    const s = this.scroll;
    s.addEventListener('pointerdown', e => this.onDown(e));
    s.addEventListener('dblclick', e => this.onDbl(e));
    s.addEventListener('contextmenu', e => this.onCtx(e));
    s.addEventListener('keydown', e => this.onKey(e));
    s.addEventListener('copy', e => { if (this.editor) return; e.preventDefault(); this.app.cmd('copy'); });
    s.addEventListener('paste', e => { if (this.editor) return; e.preventDefault(); const t = e.clipboardData && e.clipboardData.getData('text/plain'); this.app.cmd('paste', t); });
    s.addEventListener('cut', e => { if (this.editor) return; e.preventDefault(); this.app.cmd('cut'); });
  }
  hit(e) {
    const p = U.rel(e, this.inner);
    const rh = this.rowH, H = this.headH;
    let c = -1, x = this.o.idW || 46;
    if (p.x >= x) for (let k = 0; k < this.cols.length; k++) { if (p.x < x + this.cols[k].w) { c = k; break; } x += this.cols[k].w; }
    const inHead = p.y - this.scroll.scrollTop < H;
    const i = inHead ? -1 : Math.floor((p.y - H) / rh);
    return { i: i >= 0 && i < this.rows.length ? i : -1, c, idCol: p.x < (this.o.idW || 46) + this.scroll.scrollLeft && !inHead ? true : p.x < (this.o.idW || 46), head: inHead, x: p.x, y: p.y };
  }
  onDown(e) {
    if (e.button === 2) return;
    const tg = e.target;
    if (this.editor && this.editor.wrap.contains(tg)) return;
    if (this.editor) this.commit();
    // column resize
    if (tg.dataset && tg.dataset.rz != null) { this.resizeCol(e, +tg.dataset.rz); return; }
    if (tg.closest && tg.closest('.gfilt')) { const i = +tg.closest('.gfilt').dataset.f; e.preventDefault(); this.o.onFilterBtn && this.o.onFilterBtn(this.cols[i].k, tg.closest('.gfilt')); return; }
    const h = this.hit(e);
    if (h.head) {
      if (h.c >= 0) { this.dragCol(e, h.c); }
      else if (tg.closest('.gid')) { this.selectAll(); }
      return;
    }
    if (h.i < 0) { this.focus(); return; }
    if (tg.dataset && tg.dataset.tog) { e.preventDefault(); this.o.onToggle && this.o.onToggle(this.rows[h.i]); return; }
    const r = this.rows[h.i];
    this.focus();
    const isId = !!tg.closest('.gid');
    if (isId) {
      if (e.shiftKey) this.selectIdx(h.i, true); else if (e.ctrlKey || e.metaKey) this.selectIdx(h.i, false, true); else this.selectIdx(h.i);
      this.wholeRow = true; this.paint();
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey && r.kind !== 'blank' && this.o.canMove) this.dragRows(e, h.i);
      return;
    }
    const col = h.c >= 0 ? this.cols[h.c].k : this.colKey;
    const wasFocused = this.focusKey === r.key && this.colKey === col && this.selKeys.size === 1;
    if (e.shiftKey) { if (this.colA == null) this.colA = this.colKey; this.colKey = col; this.selectIdx(h.i, true); }
    else if (e.ctrlKey || e.metaKey) { this.colKey = col; this.selectIdx(h.i, false, true); }
    else { this.colKey = col; this.colA = null; this.selectIdx(h.i); }
    this.wholeRow = false;
    // drag to extend selection
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey && e.pointerType !== 'touch') {
      const a = h.i, ac = this.colKey;
      const mv = ev => { const q = this.hit(ev); if (q.i < 0) return; if (q.c >= 0 && this.cols[q.c].k !== this.colKey) { this.colA = ac; this.colKey = this.cols[q.c].k; } this.anchor = this.rows[a].key; this.selectIdx(q.i, true); };
      const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    }
    // a click on a flag cell toggles it; on an already focused cell starts editing (touch)
    const f = F.reg(r.kind === 'res' ? 'res' : 'task')[col];
    if (f && f.type === 'flag' && r.x && r.kind !== 'asg' && !F.isRO(r.kind === 'res' ? 'res' : 'task', col, r.x, this.P) && tg.closest('.gflag')) { this.edit(null, '__toggle'); return; }
    if (wasFocused && e.pointerType === 'touch') setTimeout(() => this.edit(), 0);
  }
  selectAll() { this.selKeys = new Set(this.rows.filter(r => r.kind !== 'blank').map(r => r.key)); this.wholeRow = true; this.paint(); this.o.onSel && this.o.onSel(); }
  onDbl(e) {
    const h = this.hit(e);
    if (h.head) { if (h.c >= 0) this.o.onHeadDbl && this.o.onHeadDbl(this.cols[h.c]); return; }
    if (h.i < 0) return;
    const r = this.rows[h.i];
    if (e.target.dataset && e.target.dataset.tog) return;
    if (r.kind === 'blank') { this.edit(); return; }
    this.o.onDbl && this.o.onDbl(r, h.c >= 0 ? this.cols[h.c] : null);
  }
  onCtx(e) {
    e.preventDefault();
    if (this.editor) this.commit();
    const h = this.hit(e);
    if (h.head) { if (h.c >= 0 && this.o.onHeadCtx) this.o.onHeadCtx(e, this.cols[h.c]); return; }
    if (h.i >= 0) {
      const r = this.rows[h.i];
      if (!this.selKeys.has(r.key)) { this.colKey = h.c >= 0 ? this.cols[h.c].k : this.colKey; this.selectIdx(h.i); }
      this.o.onCtx && this.o.onCtx(e, r, h.c >= 0 ? this.cols[h.c] : null);
    }
  }
  onKey(e) {
    if (this.editor) return;
    const mod = e.ctrlKey || e.metaKey;
    const i = this.idx(this.focusKey);
    const ci = this.cols.findIndex(c => c.k === this.colKey);
    const n = this.rows.length;
    const page = Math.max(1, Math.floor(this.viewH / this.rowH) - 1);
    const moveCol = d => { const k = U.clamp(ci + d, 0, this.cols.length - 1); this.colKey = this.cols[k].k; };
    const k = e.key;
    if (this.o.onKey && this.o.onKey(e) === true) return;
    if (e.altKey && e.shiftKey) {
      if (k === 'ArrowRight') { e.preventDefault(); this.app.cmd('indent'); return; }
      if (k === 'ArrowLeft') { e.preventDefault(); this.app.cmd('outdent'); return; }
      if (k === 'ArrowUp') { e.preventDefault(); this.app.cmd('moveUp'); return; }
      if (k === 'ArrowDown') { e.preventDefault(); this.app.cmd('moveDown'); return; }
      if (k === '-' || k === '_' || e.code === 'Minus') { e.preventDefault(); this.app.cmd('collapse'); return; }
      if (k === '+' || k === '=' || e.code === 'Equal') { e.preventDefault(); this.app.cmd('expand'); return; }
      if (k === '*' || e.code === 'Digit8') { e.preventDefault(); this.app.cmd('outlineAll'); return; }
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); if (mod) this.selectIdx(n - 1, e.shiftKey); else this.selectIdx(i < 0 ? 0 : i + 1, e.shiftKey); return;
      case 'ArrowUp': e.preventDefault(); if (mod) this.selectIdx(0, e.shiftKey); else this.selectIdx(i < 0 ? 0 : i - 1, e.shiftKey); return;
      case 'ArrowRight': e.preventDefault(); if (e.shiftKey && this.colA == null) this.colA = this.colKey; if (!e.shiftKey) this.colA = null; moveCol(mod ? 99 : 1); this.selectIdx(Math.max(0, i), e.shiftKey && false); return;
      case 'ArrowLeft': e.preventDefault(); if (e.shiftKey && this.colA == null) this.colA = this.colKey; if (!e.shiftKey) this.colA = null; moveCol(mod ? -99 : -1); this.selectIdx(Math.max(0, i), false); return;
      case 'PageDown': e.preventDefault(); this.selectIdx(i + page, e.shiftKey); return;
      case 'PageUp': e.preventDefault(); this.selectIdx(i - page, e.shiftKey); return;
      case 'Home': e.preventDefault(); if (mod) this.selectIdx(0, e.shiftKey); else { moveCol(-99); this.selectIdx(Math.max(0, i)); } return;
      case 'End': e.preventDefault(); if (mod) this.selectIdx(Math.max(0, this.rows.filter(r => r.kind !== 'blank').length - 1), e.shiftKey); else { moveCol(99); this.selectIdx(Math.max(0, i)); } return;
      case 'Tab': e.preventDefault(); moveCol(e.shiftKey ? -1 : 1); this.selectIdx(Math.max(0, i)); return;
      case 'Enter': e.preventDefault(); if (e.shiftKey) this.selectIdx(i - 1); else if (mod) this.edit(); else this.selectIdx(i + 1); return;
      case 'F2': e.preventDefault(); this.edit(); return;
      case 'Delete': case 'Backspace':
        if (mod) return;
        e.preventDefault();
        if (this.wholeRow || this.colKey === 'name' || k === 'Delete' && this.selKeys.size > 1 && this.wholeRow) this.app.cmd('deleteRows');
        else this.app.cmd('clearCells');
        return;
      case 'Insert': e.preventDefault(); this.app.cmd('insertRow'); return;
      case ' ':
        if (this.colKey) { const r = this.focusRow(); const f = r && r.x && F.reg(r.kind === 'res' ? 'res' : 'task')[this.colKey]; if (f && f.type === 'flag') { e.preventDefault(); this.edit(null, '__toggle'); return; } }
        break;
    }
    if (mod && !e.altKey) {
      const kl = k.toLowerCase();
      if (kl === 'a') { e.preventDefault(); this.selectAll(); return; }
      if (kl === 'd') { e.preventDefault(); this.app.cmd('fillDown'); return; }
      return;
    }
    if (k.length === 1 && !e.altKey && !mod) { e.preventDefault(); this.edit(k); }
  }

  /* ---------------- editing ---------------- */
  edit(initial = null, special = null) {
    const r = this.focusRow();
    const ci = this.cols.findIndex(c => c.k === this.colKey);
    if (!r || ci < 0 || r.kind === 'group') return;
    const col = this.cols[ci];
    if (this.o.canEdit && !this.o.canEdit(r, col)) { if (this.o.onEditBlocked) this.o.onEditBlocked(r, col); return; }
    const kind = r.kind === 'res' || (r.kind === 'blank' && this.kind === 'res') ? 'res' : 'task';
    const f = F.reg(kind)[col.k];
    if (!f || !f.set) { if (f && this.o.onEditBlocked) this.o.onEditBlocked(r, col); return; }
    if (r.x && F.isRO(kind, col.k, r.x, this.P)) { if (this.o.onEditBlocked) this.o.onEditBlocked(r, col); return; }
    if (r.kind === 'asg') { this.o.onAsgEdit && this.o.onAsgEdit(r, col); return; }
    if (special === '__toggle') { this.o.onCommit(r, col.k, f.get(r.x, this.P) ? 'Tidak' : 'Ya'); return; }
    const cur = r.x ? (f.type === 'date' && f.get(r.x, this.P) == null ? '' : F.text(kind, col.k, r.x, this.P)) : '';
    if (f.type === 'enum' && initial == null) {
      const opts = typeof f.opts === 'function' ? f.opts() : f.opts;
      const cell = this.cellEl(this.idx(r.key), ci);
      UI.listPick(cell || this.scroll, opts, r.x ? f.get(r.x, this.P) : null, v => { this.o.onCommit(r, col.k, v); this.focus(); });
      return;
    }
    const y = this.headH + this.idx(r.key) * this.rowH, x = this.colX(ci);
    const inp = el('input.g-ed', { type: 'text', value: initial != null ? initial : cur, spellcheck: false, autocomplete: 'off' });
    const wrap = el('div.g-edw', { style: { left: x + 'px', top: y + 'px', width: Math.max(col.w, f.type === 'date' ? 150 : f.type === 'res' ? 200 : col.w) + 'px', height: this.rowH + 'px' } }, inp);
    if (f.type === 'date') wrap.append(el('button.g-edb', { type: 'button', tabIndex: -1, 'aria-label': 'Kalender', onpointerdown: e => { e.preventDefault(); const v0 = r.x ? f.get(r.x, this.P) : null; UI.datePicker(wrap, v0, v => { inp.value = v == null ? '' : U.fmtDate(v, this.P.opts.dateFmt); this.commit(); }, { clear: col.k !== 'start' && col.k !== 'finish', weekStart: this.P.opts.weekStart }); } }, icon('calendar_month')));
    if (f.type === 'res') wrap.append(el('button.g-edb', { type: 'button', tabIndex: -1, 'aria-label': 'Pilih sumber daya', onpointerdown: e => { e.preventDefault(); this.resPick(wrap, inp); } }, icon('arrow_drop_down')));
    this.inner.append(wrap);
    this.editor = { r, col, f, kind, inp, wrap, orig: cur };
    inp.focus();
    if (initial == null) inp.select(); else { const l = inp.value.length; inp.setSelectionRange(l, l); }
    inp.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.cancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (this.commit()) this.selectIdx(this.idx(r.key) + (e.shiftKey ? -1 : 1)); }
      else if (e.key === 'Tab') { e.preventDefault(); if (this.commit()) { const k = U.clamp(this.cols.findIndex(c => c.k === col.k) + (e.shiftKey ? -1 : 1), 0, this.cols.length - 1); this.colKey = this.cols[k].k; this.selectIdx(this.idx(r.key)); } }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.altKey && f.type !== 'res') { e.preventDefault(); if (this.commit()) this.selectIdx(this.idx(r.key) + (e.key === 'ArrowDown' ? 1 : -1)); }
      else if (e.key === 'ArrowDown' && e.altKey && f.type === 'date') { e.preventDefault(); wrap.querySelector('.g-edb').dispatchEvent(new PointerEvent('pointerdown')); }
    });
    if (f.type === 'res') inp.addEventListener('input', () => this.resSuggest(wrap, inp));
    inp.addEventListener('blur', () => setTimeout(() => { if (this.editor && this.editor.inp === inp && !UI.menuOpen() && document.activeElement !== inp) this.commit(); }, 120));
  }
  placeEditor() { /* the editor lives inside the scrolled content, it moves with it */ }
  cellEl(i, ci) { const row = this.body.querySelector(`.gr[data-i="${i}"]`); return row ? row.querySelector(`.gc[data-c="${ci}"]`) : null; }
  commit() {
    const ed = this.editor;
    if (!ed) return true;
    const v = ed.inp.value;
    if (v === ed.orig && ed.r.kind !== 'blank') { this.closeEditor(); return true; }
    if (ed.r.kind === 'blank' && !v.trim()) { this.closeEditor(); return true; }
    const ok = this.o.onCommit(ed.r, ed.col.k, v);
    if (ok === false) { ed.inp.focus(); ed.inp.select(); return false; }
    this.closeEditor();
    return true;
  }
  cancel() { this.closeEditor(); }
  closeEditor() { const ed = this.editor; if (!ed) return; this.editor = null; ed.wrap.remove(); UI.closeMenus(); this.focus(); this.paint(); }
  resPick(anchor, inp) {
    const P = this.P;
    const cur = D.parseRes(inp.value);
    const has = n => cur.some(x => x.name.toLowerCase() === n.toLowerCase());
    const items = P.res.filter(r => r.active !== false).map(r => ({ label: r.name + (r.type !== 'work' ? ' (' + (r.type === 'material' ? 'material' : 'biaya') + ')' : ''), checked: has(r.name), run: () => {
      const list = has(r.name) ? cur.filter(x => x.name.toLowerCase() !== r.name.toLowerCase()) : [...cur, { name: r.name }];
      inp.value = list.map(x => x.name + (x.units != null && Math.abs(x.units - 1) > 1e-6 ? '[' + U.num(x.units * 100, 1) + '%]' : x.qty != null ? '[' + U.num(x.qty, 2) + (x.label ? ' ' + x.label : '') + ']' : x.cost != null ? '[' + U.money(x.cost, P) + ']' : '')).join(';');
      inp.focus();
    } }));
    if (!items.length) items.push({ label: 'Belum ada sumber daya — ketik nama untuk membuatnya', disabled: true });
    items.push({ sep: true }, { label: 'Tetapkan Sumber Daya…', icon: 'group_add', run: () => { this.cancel(); this.app.cmd('assignDlg'); } });
    UI.menu(items, anchor, { focus: false });
  }
  resSuggest(anchor, inp) {
    const P = this.P, v = inp.value, last = v.split(/[;,]/).pop().trim().toLowerCase();
    if (!last) { UI.closeMenus(); return; }
    const m = P.res.filter(r => r.name.toLowerCase().startsWith(last) && r.name.toLowerCase() !== last).slice(0, 8);
    if (!m.length) { UI.closeMenus(); return; }
    UI.menu(m.map(r => ({ label: r.name, run: () => { const parts = v.split(/([;,])/); parts[parts.length - 1] = r.name; inp.value = parts.join(''); inp.focus(); } })), anchor, { focus: false });
    setTimeout(() => inp.focus(), 0);
  }

  /* ---------------- kolom: ubah lebar, pindah ---------------- */
  resizeCol(e, i) {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = this.cols[i].w, z = U.zoom();
    const line = el('div.g-rzline');
    this.host.append(line);
    const mv = ev => { this.cols[i].w = Math.max(16, Math.round(w0 + (ev.clientX - x0) / z)); this.render(); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); line.remove(); this.o.onColsChange && this.o.onColsChange(this.cols); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  dragCol(e, i) {
    const x0 = e.clientX;
    let moved = false, to = i, ghost = null;
    const mv = ev => {
      if (!moved && Math.abs(ev.clientX - x0) < 6) return;
      moved = true;
      const h = this.hit(ev);
      to = h.c >= 0 ? h.c : to;
      if (!ghost) { ghost = el('div.g-colmark'); this.inner.append(ghost); }
      ghost.style.left = this.colX(to) + 'px';
      ghost.style.height = this.inner.style.height;
    };
    const up = ev => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (ghost) ghost.remove();
      if (!moved) { // click on header: select whole column
        this.colKey = this.cols[i].k; this.colA = null; this.wholeCol = true;
        this.selKeys = new Set(this.rows.filter(r => r.kind !== 'blank').map(r => r.key));
        this.drawHead(); this.paint(); this.o.onSel && this.o.onSel();
        return;
      }
      if (to !== i) { const [c] = this.cols.splice(i, 1); this.cols.splice(to, 0, c); this.render(); this.o.onColsChange && this.o.onColsChange(this.cols); }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  bestFit(i) {
    const c = this.cols[i], P = this.P;
    const font = '12.5px Inter, Arial, sans-serif';
    let w = U.measure(F.title(c.k, P, this.kind === 'res' ? 'res' : 'task'), '600 12px Inter, Arial') + 28;
    for (const r of this.rows.slice(0, 3000)) {
      if (!r.x || r.kind === 'blank') continue;
      const t = F.text(r.kind === 'res' ? 'res' : 'task', c.k, r.x, P);
      const pad = c.k === 'name' ? ((r.lvl || r.x.lvl || 1) - 1) * 16 + 26 : 14;
      w = Math.max(w, U.measure(t, font) + pad);
    }
    c.w = Math.min(600, Math.ceil(w));
    this.render();
    this.o.onColsChange && this.o.onColsChange(this.cols);
  }

  /* ---------------- seret baris (pindah tugas) ---------------- */
  dragRows(e, i) {
    const y0 = e.clientY;
    let moved = false, to = i, mark = null;
    const keys = [...this.selKeys];
    const mv = ev => {
      if (!moved && Math.abs(ev.clientY - y0) < 6) return;
      moved = true;
      const h = this.hit(ev);
      const p = U.rel(ev, this.inner);
      to = U.clamp(Math.round((p.y - this.headH) / this.rowH), 0, this.rows.length);
      if (!mark) { mark = el('div.g-rowmark'); this.inner.append(mark); }
      mark.style.top = this.headH + to * this.rowH - 1 + 'px';
      mark.style.width = this.totalW() + 'px';
      // auto scroll
      const r = this.scroll.getBoundingClientRect();
      if (ev.clientY < r.top + this.headH + 10) this.scroll.scrollTop -= 12; else if (ev.clientY > r.bottom - 14) this.scroll.scrollTop += 12;
      void h;
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (mark) mark.remove();
      if (moved) this.o.onMoveRows && this.o.onMoveRows(keys, to);
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
}
AP.Grid = Grid;
})();
