// Amatu Project — durasi, kerja, lag, tarif, teks pendahulu ("3FS+2 hari;5SS") dan teks sumber daya ("Budi[50%];Semen[10 sak]").
(() => {
'use strict';
const AP = window.AP, U = AP.U;
const D = AP.D = {};
D.UL = { m: 'mnt', h: 'jam', d: 'hari', w: 'mgg', mo: 'bln' };
D.UL_LONG = { m: 'Menit', h: 'Jam', d: 'Hari', w: 'Minggu', mo: 'Bulan' };
const UMAP = {
  m: 'm', mn: 'm', mnt: 'm', min: 'm', mins: 'm', menit: 'm', minute: 'm', minutes: 'm',
  j: 'h', jm: 'h', jam: 'h', hour: 'h', hours: 'h', hrs: 'h',
  h: 'd', hr: 'd', hri: 'd', hari: 'd', d: 'd', dy: 'd', day: 'd', days: 'd',
  w: 'w', wk: 'w', wks: 'w', week: 'w', weeks: 'w', mg: 'w', mgg: 'w', minggu: 'w', pekan: 'w',
  mo: 'mo', mon: 'mo', mons: 'mo', month: 'mo', months: 'mo', bl: 'mo', bln: 'mo', bulan: 'mo',
};
D.unit = s => { s = String(s || '').toLowerCase().replace(/\.$/, ''); if (s in UMAP) return { u: UMAP[s], el: false }; if (s.length > 1 && s[0] === 'e' && s.slice(1) in UMAP) return { u: UMAP[s.slice(1)], el: true }; return null; };
D.per = (u, o) => ({ m: 1, h: 60, d: o.hpd * 60, w: o.hpw * 60, mo: o.dpm * o.hpd * 60 }[u] || o.hpd * 60);
D.perEl = u => ({ m: 1, h: 60, d: 1440, w: 10080, mo: 43200 }[u] || 1440);
D.perX = (u, o, el) => (el ? D.perEl(u) : D.per(u, o));
const r2 = v => Math.round(v * 100) / 100;
D.label = (u, el) => (el ? 'e' : '') + (D.UL[u] || 'hari');
D.fmtDur = (v, u, o, el = false, est = false) => {
  if (v == null || !isFinite(v)) return '';
  u = u || o.durU || 'd';
  return U.num(r2(v / D.perX(u, o, el)), 2) + ' ' + D.label(u, el) + (est ? '?' : '');
};
// best display unit for a raw minutes value (import, summary)
D.bestUnit = (v, o) => (v % D.per('d', o) === 0 || v >= D.per('d', o) ? 'd' : v % 60 === 0 ? 'h' : 'm');
// "5", "5h", "3 hari", "2 mgg", "4 jam", "1,5 bln", "2ehari", "3d?" → {v (menit), u, el, est}; null jika tidak valid
D.parseDur = (s, o, defU) => {
  const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*([a-z]*)\.?\s*(\?)?\s*$/i.exec(String(s == null ? '' : s));
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(n) || n < 0) return null;
  let u = defU || o.durU || 'd', el = false;
  if (m[2]) { const x = D.unit(m[2]); if (!x) return null; u = x.u; el = x.el; }
  return { v: Math.round(n * D.perX(u, o, el)), u, el, est: !!m[3] };
};
D.fmtWork = (v, o, u) => (v == null || !isFinite(v) ? '' : U.num(r2(v / D.per(u || o.workU || 'h', o)), 2) + ' ' + D.label(u || o.workU || 'h'));
D.parseWork = (s, o) => { const x = D.parseDur(s, o, o.workU || 'h'); return x && !x.el ? x.v : null; };

/* ---------------- lag ---------------- */
// "+2 hari", "-1h", "2ehari", "50%", "-25%" → {lag, lagU, pct, el}
D.parseLag = (s, o) => {
  s = String(s == null ? '' : s).trim().replace(/\s+/g, '');
  if (!s || s === '0') return { lag: 0, lagU: o.durU || 'd', pct: null, el: false };
  let m = /^([+-]?)(\d+(?:[.,]\d+)?)%$/.exec(s);
  if (m) return { lag: 0, lagU: 'd', pct: (m[1] === '-' ? -1 : 1) * parseFloat(m[2].replace(',', '.')), el: false };
  m = /^([+-]?)(\d+(?:[.,]\d+)?)([a-z]*)$/i.exec(s);
  if (!m) return null;
  let u = o.durU || 'd', el = false;
  if (m[3]) { const x = D.unit(m[3]); if (!x) return null; u = x.u; el = x.el; }
  const v = parseFloat(m[2].replace(',', '.')) * D.perX(u, o, el);
  return { lag: Math.round(m[1] === '-' ? -v : v), lagU: u, pct: null, el };
};
D.fmtLag = (L, o) => {
  if (L.pct != null) return (L.pct >= 0 ? '+' : '') + U.num(L.pct, 2) + '%';
  if (!L.lag) return '';
  const u = L.lagU || o.durU || 'd';
  return (L.lag > 0 ? '+' : '-') + U.num(r2(Math.abs(L.lag) / D.perX(u, o, L.el)), 2) + ' ' + D.label(u, L.el);
};
D.TYPES = ['FS', 'SS', 'FF', 'SF'];
D.TYPE_L = { FS: 'Selesai-ke-Mulai (FS)', SS: 'Mulai-ke-Mulai (SS)', FF: 'Selesai-ke-Selesai (FF)', SF: 'Mulai-ke-Selesai (SF)' };
const TALIAS = { fs: 'FS', ss: 'SS', ff: 'FF', sf: 'SF', sm: 'FS', mm: 'SS', ms: 'SF' };
D.fmtLink = (id, L, o) => { const lag = D.fmtLag(L, o); return id + (L.type === 'FS' && !lag ? '' : L.type) + lag; };
D.fmtPreds = (t, P) => (t.pred || []).map(L => { const p = P.byUid.get(L.uid); return p ? D.fmtLink(p.id, L, P.opts) : ''; }).filter(Boolean).join(';');
D.fmtSuccs = (t, P) => (P.succ.get(t.uid) || []).map(({ t: s, L }) => D.fmtLink(s.id, L, P.opts)).join(';');
// "3", "3FS+2 hari;5SS", "4FF-1h,7" → [{uid,type,lag,lagU,pct,el}] ; throws pesan
D.parsePreds = (s, P, self) => {
  s = String(s == null ? '' : s).trim();
  if (!s) return [];
  const re = /\s*(\d+)\s*(fs|ss|ff|sf|sm|mm|ms)?\s*([+-]\s*\d+(?:[.,]\d+)?\s*(?:%|e?[a-z]+)?)?\s*(?:[;,]|$)/iy;
  const out = [];
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m || m[0] === '') throw 'Tulisan pendahulu tidak dikenali: "' + s.slice(pos) + '". Contoh: 3;5SS+2 hari;7FF-1h';
    pos = re.lastIndex;
    const id = +m[1], p = P.tasks[id - 1];
    if (!p) throw 'Tidak ada tugas dengan ID ' + id;
    if (self && p.uid === self.uid) throw 'Tugas tidak dapat menjadi pendahulunya sendiri';
    const L = m[3] ? D.parseLag(m[3], P.opts) : { lag: 0, lagU: P.opts.durU || 'd', pct: null, el: false };
    if (!L) throw 'Lag tidak dikenali: ' + m[3];
    const type = TALIAS[(m[2] || 'fs').toLowerCase()];
    if (!out.some(x => x.uid === p.uid)) out.push({ uid: p.uid, type, ...L });
  }
  return out;
};

/* ---------------- sumber daya ---------------- */
// "Budi[50%];Semen[10 sak];Transport[Rp500.000]" → [{name, units|qty|cost}]
D.parseRes = s => {
  s = String(s == null ? '' : s).trim();
  if (!s) return [];
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '[') depth++;
    if (ch === ']') depth = Math.max(0, depth - 1);
    if ((ch === ';' || ch === ',') && !depth) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map(p => p.trim()).filter(Boolean).map(p => {
    const m = /^(.*?)\s*\[(.*)\]\s*$/.exec(p);
    if (!m) return { name: p };
    const name = m[1].trim(), v = m[2].trim();
    if (/%$/.test(v)) return { name, units: U.parseNum(v.slice(0, -1)) / 100 };
    if (/^(rp|\$|idr)/i.test(v)) return { name, cost: U.parseNum(v) };
    const q = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(v);
    if (q) return { name, qty: U.parseNum(q[1]), label: q[2] || '' };
    return { name };
  });
};
D.fmtAsg = (a, r, P) => {
  if (!r) return '';
  if (r.type === 'material') return r.name + '[' + U.num(a.units, 2) + (r.mat ? ' ' + r.mat : '') + ']';
  if (r.type === 'cost') return a.cost ? r.name + '[' + U.money(a.cost, P) + ']' : r.name;
  return Math.abs(a.units - 1) < 1e-6 ? r.name : r.name + '[' + U.num(Math.round(a.units * 1000) / 10, 1) + '%]';
};
D.fmtRes = (t, P) => (P.asgT.get(t.uid) || []).map(a => D.fmtAsg(a, P.resByUid.get(a.r), P)).filter(Boolean).join(';');
D.fmtInitials = (t, P) => (P.asgT.get(t.uid) || []).map(a => { const r = P.resByUid.get(a.r); return r ? (r.ini || r.name.slice(0, 1)) : ''; }).filter(Boolean).join(';');

/* ---------------- tarif ---------------- */
D.RU = { m: 'mnt', h: 'jam', d: 'hari', w: 'mgg', mo: 'bln', y: 'thn' };
D.hoursIn = (u, o) => ({ m: 1 / 60, h: 1, d: o.hpd, w: o.hpw, mo: o.dpm * o.hpd, y: 52 * o.hpw }[u] || 1);
D.rateHour = (rate, o) => (!rate || !rate.v ? 0 : rate.v / D.hoursIn(rate.u || 'h', o));
D.fmtRate = (rate, P, material) => {
  if (!rate) return U.money(0, P) + (material ? '' : '/jam');
  return U.money(rate.v || 0, P) + (material ? '' : '/' + (D.RU[rate.u] || 'jam'));
};
// "50000", "Rp50.000/jam", "400rb/hari", "1,2jt/bln"
D.parseRate = (s, o) => {
  s = String(s == null ? '' : s).trim();
  if (!s) return { v: 0, u: 'h' };
  const m = /^(.*?)(?:\/\s*([a-z]+))?$/i.exec(s);
  const v = U.parseNum(m[1]);
  if (!isFinite(v) || v < 0) return null;
  let u = 'h';
  if (m[2]) {
    const k = m[2].toLowerCase();
    const map = { m: 'm', mnt: 'm', menit: 'm', min: 'm', j: 'h', jam: 'h', h: 'h', hr: 'h', hour: 'h', jm: 'h', hari: 'd', d: 'd', day: 'd', mg: 'w', mgg: 'w', minggu: 'w', w: 'w', wk: 'w', week: 'w', bln: 'mo', bulan: 'mo', mo: 'mo', month: 'mo', thn: 'y', tahun: 'y', y: 'y', yr: 'y', year: 'y' };
    u = map[k];
    if (!u) return null;
  }
  return { v, u };
};
})();
