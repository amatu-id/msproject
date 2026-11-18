// Amatu Project — utilitas bersama: DOM, angka, uang, tanggal (menit jam dinding sebagai UTC), unduhan, pustaka.
(() => {
'use strict';
const AP = window.AP = window.AP || {};
const U = AP.U = {};

/* ---------------- DOM ---------------- */
// el('div.a.b#id', {attr|on*|style|dataset}, ...kids)
U.el = function el(sel, attrs, ...kids) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
  const n = document.createElement(m[1] || 'div');
  if (m[2]) for (const p of m[2].match(/[.#][\w-]+/g) || []) { if (p[0] === '.') n.classList.add(p.slice(1)); else n.id = p.slice(1); }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k in n && !/^(list|form|type|width|height)$/.test(k) && typeof n[k] !== 'function') { try { n[k] = v; } catch { n.setAttribute(k, v); } }
    else n.setAttribute(k, v === true ? '' : v);
  }
  add(n, kids);
  return n;
};
function add(n, kids) {
  for (const k of kids) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) add(n, k);
    else n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
U.icon = (name, cls) => U.el('span.ms' + (cls ? '.' + cls : ''), { 'aria-hidden': 'true' }, name);
U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
U.$ = (s, r = document) => r.querySelector(s);
U.$$ = (s, r = document) => [...r.querySelectorAll(s)];
U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
U.uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
U.debounce = (fn, ms) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.cancel = () => clearTimeout(t); f.now = (...a) => { clearTimeout(t); fn(...a); }; return f; };
U.raf = fn => { let q = false; return () => { if (q) return; q = true; requestAnimationFrame(() => { q = false; fn(); }); }; };
U.zoom = () => parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
// pointer position relative to an element (divides by CSS zoom that /amatu.js may put on <html>)
U.rel = (e, node) => { const r = node.getBoundingClientRect(), z = U.zoom(); return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z }; };
U.isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
U.MOD = U.isMac ? '⌘' : 'Ctrl';
U.touch = matchMedia('(pointer: coarse)').matches;
U.copyText = async t => { try { await navigator.clipboard.writeText(t); return true; } catch { const a = U.el('textarea', { value: t, style: { position: 'fixed', opacity: 0 } }); document.body.append(a); a.select(); try { document.execCommand('copy'); } catch { } a.remove(); return true; } };

/* ---------------- angka & uang ---------------- */
const NF = {};
U.num = (v, d = 0) => { if (v == null || !isFinite(v)) return ''; const k = d; NF[k] ||= new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: d }); return NF[k].format(v); };
U.numFix = (v, d = 0) => { if (v == null || !isFinite(v)) return ''; const k = 'f' + d; NF[k] ||= new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }); return NF[k].format(v); };
U.money = (v, P) => {
  if (v == null || !isFinite(v)) return '';
  const o = P && P.opts || {}, sym = o.cur == null ? 'Rp' : o.cur, d = o.curDec == null ? 0 : o.curDec;
  const s = U.numFix(Math.abs(v), d);
  return (v < 0 ? '-' : '') + (o.curPos === 'after' ? s + ' ' + sym : sym + s);
};
// "Rp1.250.000", "1.250.000,50", "1,250,000.50", "2,5jt", "1.5k" → number
U.parseNum = s => {
  if (typeof s === 'number') return s;
  s = String(s == null ? '' : s).trim().toLowerCase().replace(/rp\.?|idr|usd|\$|€|\s/g, '');
  if (!s) return NaN;
  let mul = 1;
  const suf = /(jt|juta|rb|ribu|k|m|mn|miliar|t|triliun)$/.exec(s);
  if (suf) { mul = { jt: 1e6, juta: 1e6, rb: 1e3, ribu: 1e3, k: 1e3, m: 1e6, mn: 1e9, miliar: 1e9, t: 1e12, triliun: 1e12 }[suf[1]]; s = s.slice(0, -suf[1].length); }
  const neg = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()\-+]/g, '');
  const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
  if (dots && commas) { if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); }
  else if (commas) s = commas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (dots > 1 || (dots === 1 && /^\d{1,3}\.\d{3}$/.test(s) && !suf)) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  return isFinite(v) ? (neg ? -v : v) * mul : NaN;
};
U.pct = v => v == null || !isFinite(v) ? '' : U.num(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) + '%';

/* ---------------- tanggal: menit sejak epoch, jam dinding disimpan sebagai UTC ---------------- */
U.DAY = 1440;
U.DOW_S = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
U.DOW_L = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
U.DOW_1 = ['M', 'S', 'S', 'R', 'K', 'J', 'S'];
U.MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
U.MON_L = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
U.mk = (y, m, d, h = 0, mi = 0) => Math.round(Date.UTC(y, m, d, h, mi) / 60000);
U.ymd = t => { const D = new Date(t * 60000); return { y: D.getUTCFullYear(), m: D.getUTCMonth(), d: D.getUTCDate(), h: D.getUTCHours(), mi: D.getUTCMinutes(), dow: D.getUTCDay() }; };
U.dow = t => ((Math.floor(t / 1440) % 7) + 11) % 7;   // 1970-01-01 = Kamis (4)
U.dayStart = t => Math.floor(t / 1440) * 1440;
U.today = () => { const d = new Date(); return U.mk(d.getFullYear(), d.getMonth(), d.getDate()); };
U.now = () => { const d = new Date(); return U.mk(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()); };
U.addMonths = (t, n) => { const a = U.ymd(t); const last = new Date(Date.UTC(a.y, a.m + n + 1, 0)).getUTCDate(); return U.mk(a.y, a.m + n, Math.min(a.d, last), a.h, a.mi); };
U.weekNo = t => { // ISO week number
  const a = U.ymd(t), d = new Date(Date.UTC(a.y, a.m, a.d)); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - y0) / 86400000 + 1) / 7);
};
const p2 = n => String(n).padStart(2, '0');
U.p2 = p2;
U.hm = mins => p2(Math.floor(mins / 60)) + '.' + p2(mins % 60);
U.hmColon = mins => p2(Math.floor(mins / 60)) + ':' + p2(mins % 60);
// format codes: dd d mm mmm mmmm yy yyyy ddd dddd HH MM ; default from project options
U.DATE_FORMATS = [
  ['ddd dd/mm/yy', 'Rab 18/11/26'], ['dd/mm/yy', '18/11/26'], ['dd/mm/yyyy', '18/11/2026'], ['ddd dd/mm/yy HH.MM', 'Rab 18/11/26 08.00'],
  ['dd/mm/yy HH.MM', '18/11/26 08.00'], ['dd mmm yyyy', '18 Nov 2026'], ['dd mmm yy', '18 Nov 26'], ['ddd dd mmm yy', 'Rab 18 Nov 26'],
  ['dd mmmm yyyy', '18 November 2026'], ['dddd, dd mmmm yyyy', 'Rabu, 18 November 2026'], ['yyyy-mm-dd', '2026-11-18'], ['mm/dd/yy', '11/18/26'],
];
U.fmtDate = (t, fmt = 'ddd dd/mm/yy') => {
  if (t == null || !isFinite(t)) return '';
  const a = U.ymd(t);
  return fmt.replace(/dddd|ddd|dd|d|mmmm|mmm|mm|yyyy|yy|HH|MM/g, k => {
    switch (k) {
      case 'dddd': return U.DOW_L[a.dow]; case 'ddd': return U.DOW_S[a.dow]; case 'dd': return p2(a.d); case 'd': return String(a.d);
      case 'mmmm': return U.MON_L[a.m]; case 'mmm': return U.MON_S[a.m]; case 'mm': return p2(a.m + 1);
      case 'yyyy': return String(a.y); case 'yy': return p2(a.y % 100); case 'HH': return p2(a.h); case 'MM': return p2(a.mi);
    }
    return k;
  });
};
U.isoDate = t => { const a = U.ymd(t); return a.y + '-' + p2(a.m + 1) + '-' + p2(a.d); };
U.isoDT = t => { const a = U.ymd(t); return a.y + '-' + p2(a.m + 1) + '-' + p2(a.d) + 'T' + p2(a.h) + ':' + p2(a.mi) + ':00'; };
const monIdx = s => {
  s = s.toLowerCase().replace(/\.$/, '');
  const map = { jan: 0, januari: 0, january: 0, feb: 1, peb: 1, februari: 1, pebruari: 1, february: 1, mar: 2, maret: 2, march: 2, apr: 3, april: 3, mei: 4, may: 4, jun: 5, juni: 5, june: 5, jul: 6, juli: 6, july: 6, agu: 7, agt: 7, ags: 7, aug: 7, agustus: 7, august: 7, sep: 8, sept: 8, september: 8, okt: 9, oct: 9, oktober: 9, october: 9, nov: 10, nop: 10, november: 10, nopember: 10, des: 11, dec: 11, desember: 11, december: 11 };
  return s in map ? map[s] : -1;
};
// "18/11/26", "18-11-2026", "2026-11-18", "18 Nov 2026", "18 nov", "Rab 18/11/26 13.30", "hari ini", "besok", "+3" (hari)
// defTime: menit jam bila tidak ditulis (mis. 480). Hasil: menit, atau NaN. Urutan hari/bulan/tahun.
U.parseDate = (s, defTime = 0, base = null) => {
  if (s == null) return NaN;
  if (typeof s === 'number') return s;
  let str = String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!str) return NaN;
  const today = U.today();
  if (/^(hari ini|today|sekarang|now)$/.test(str)) return today + defTime;
  if (/^(besok|tomorrow)$/.test(str)) return today + 1440 + defTime;
  if (/^(kemarin|yesterday)$/.test(str)) return today - 1440 + defTime;
  let m = /^([+-])\s*(\d+)\s*(h|hari|d)?$/.exec(str);
  if (m) return (base == null ? today : U.dayStart(base)) + (m[1] === '-' ? -1 : 1) * +m[2] * 1440 + defTime;
  let time = null;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})[t ](\d{1,2}):(\d{2})/.exec(str))) { time = +m[4] * 60 + +m[5]; str = m[1] + '-' + m[2] + '-' + m[3]; }
  else if ((m = / (\d{1,2})[.:](\d{2})(?::\d{2})?(?: ?(am|pm))?$/.exec(str))) {
    let h = +m[1]; if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0;
    if (h <= 24 && +m[2] < 60) { time = Math.min(1440, h * 60 + +m[2]); str = str.slice(0, m.index).trim(); }
  }
  str = str.replace(/^(min|sen|sel|rab|kam|jum|sab|sun|mon|tue|wed|thu|fri|sat)[a-z']*\.?,? /, '');
  let y, mo, d;
  const Y = () => U.ymd(today).y;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str))) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
  else if ((m = /^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/.exec(str))) { d = +m[1]; mo = +m[2] - 1; y = m[3] ? +m[3] : Y(); }
  else if ((m = /^(\d{1,2})[ \-]?([a-z]+)\.?[ \-]?(\d{2,4})?$/.exec(str)) && monIdx(m[2]) >= 0) { d = +m[1]; mo = monIdx(m[2]); y = m[3] ? +m[3] : Y(); }
  else if ((m = /^([a-z]+)\.? (\d{1,2}),? ?(\d{2,4})?$/.exec(str)) && monIdx(m[1]) >= 0) { mo = monIdx(m[1]); d = +m[2]; y = m[3] ? +m[3] : Y(); }
  else return NaN;
  if (y < 100) y += 2000;
  if (mo < 0 || mo > 11 || d < 1 || d > 31 || y < 1900 || y > 2200) return NaN;
  if (d > new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()) return NaN;
  return U.mk(y, mo, d) + (time == null ? defTime : time);
};

/* ---------------- unduhan & pustaka ---------------- */
U.download = (data, name, type = 'application/octet-stream') => {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = U.el('a', { href: url, download: name, style: { display: 'none' } });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
};
U.safeName = s => String(s || 'Proyek').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Proyek';
U.LIBS = {
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js',
  jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
};
const loaded = {};
U.lib = name => loaded[name] || (loaded[name] = new Promise((res, rej) => {
  const s = U.el('script', { src: U.LIBS[name], async: true });
  s.onload = () => res(name === 'xlsx' ? window.XLSX : name === 'jszip' ? window.JSZip : true);
  s.onerror = () => { delete loaded[name]; rej(new Error('Gagal memuat pustaka ' + name + ' (periksa koneksi internet)')); };
  document.head.append(s);
}));
U.readFile = (file, as = 'text') => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result); r.onerror = () => rej(r.error);
  if (as === 'buf') r.readAsArrayBuffer(file); else if (as === 'url') r.readAsDataURL(file); else r.readAsText(file);
});
U.pickFile = (accept, multiple = false) => new Promise(res => {
  const i = U.el('input', { type: 'file', accept, multiple, style: { display: 'none' } });
  i.addEventListener('change', () => { res(multiple ? [...i.files] : i.files[0] || null); i.remove(); });
  document.body.append(i); i.click();
  setTimeout(() => { if (!document.body.contains(i)) return; }, 1000);
});
// canvas text measuring (print layout)
let mctx = null;
U.measure = (text, font) => { mctx ||= document.createElement('canvas').getContext('2d'); mctx.font = font; return mctx.measureText(text).width; };
U.fit = (text, font, w) => {   // shorten with … to fit width
  text = String(text == null ? '' : text);
  if (w <= 6) return '';
  if (U.measure(text, font) <= w) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (U.measure(text.slice(0, mid) + '…', font) <= w) lo = mid; else hi = mid - 1; }
  return lo ? text.slice(0, lo).trimEnd() + '…' : '';
};
U.wrap = (text, font, w, maxLines = 3) => {   // word wrap into lines
  text = String(text == null ? '' : text);
  if (U.measure(text, font) <= w) return [text];
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const wd of words) {
    const t = cur ? cur + ' ' + wd : wd;
    if (U.measure(t, font) <= w || !cur) cur = t; else { lines.push(cur); cur = wd; }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    const used = lines.join(' ').length;
    if (used < text.length - 1) lines[maxLines - 1] = U.fit(lines[maxLines - 1] + ' ' + text.slice(used + 1), font, w);
  }
  return lines.map(l => U.fit(l, font, w));
};
U.hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
U.deep = o => o == null ? o : JSON.parse(JSON.stringify(o));
U.sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
U.byKey = (arr, k) => { const m = new Map(); for (const x of arr) m.set(x[k], x); return m; };
U.cmp = (a, b) => (a == null) - (b == null) || (a < b ? -1 : a > b ? 1 : 0);
U.cmpText = (a, b) => String(a || '').localeCompare(String(b || ''), 'id', { numeric: true, sensitivity: 'base' });
})();
