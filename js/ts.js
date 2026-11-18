// Amatu Project — skala waktu: satuan (tahun … jam), awal satuan, garis tik, label yang menyesuaikan lebar,
// tingkatan otomatis menurut zoom (piksel per hari) seperti Microsoft Project.
(() => {
'use strict';
const AP = window.AP, U = AP.U;
const TS = AP.TS = {};
TS.UNITS = [['year', 'Tahun'], ['half', 'Semester'], ['quarter', 'Kuartal'], ['month', 'Bulan'], ['third', 'Dasarian (10 hari)'], ['week', 'Minggu'], ['day', 'Hari'], ['hour', 'Jam']];
TS.ZOOMS = [0.2, 0.32, 0.5, 0.8, 1.2, 1.8, 2.8, 4.2, 6.5, 10, 14, 18, 24, 32, 44, 62, 90, 130, 190, 280, 420, 640, 960];
TS.DEF_PPD = 18;

TS.floor = (u, t, P, n = 1) => {
  const a = U.ymd(t);
  switch (u) {
    case 'year': return U.mk(a.y, 0, 1);
    case 'half': return U.mk(a.y, a.m < 6 ? 0 : 6, 1);
    case 'quarter': return U.mk(a.y, a.m - (a.m % 3), 1);
    case 'month': return U.mk(a.y, a.m, 1);
    case 'third': return U.mk(a.y, a.m, a.d <= 10 ? 1 : a.d <= 20 ? 11 : 21);
    case 'week': { const ws = (P && P.opts.weekStart != null) ? P.opts.weekStart : 1; const d0 = U.dayStart(t); return d0 - (((a.dow - ws) + 7) % 7) * 1440; }
    case 'day': return U.dayStart(t);
    case 'hour': { const h = n * 60; return Math.floor(t / h) * h; }
  }
  return U.dayStart(t);
};
TS.next = (u, s, n = 1) => {
  const a = U.ymd(s);
  switch (u) {
    case 'year': return U.mk(a.y + n, 0, 1);
    case 'half': return U.mk(a.y, a.m + 6 * n, 1);
    case 'quarter': return U.mk(a.y, a.m + 3 * n, 1);
    case 'month': return U.mk(a.y, a.m + n, 1);
    case 'third': { let y = a.y, m = a.m, d = a.d; for (let i = 0; i < n; i++) { if (d === 1) d = 11; else if (d === 11) d = 21; else { d = 1; m++; } } return U.mk(y, m, d); }
    case 'week': return s + 7 * 1440 * n;
    case 'day': return s + 1440 * n;
    case 'hour': return s + 60 * n;
  }
  return s + 1440;
};
TS.ticks = (u, n, a, b, P, max = 4000) => {
  const out = [];
  let s = TS.floor(u, a, P, u === 'hour' ? n : 1);
  if (u !== 'hour' && n > 1) { /* group from unit start */ }
  for (let g = 0; s < b && g < max; g++) { const e = TS.next(u, s, u === 'hour' ? n : n); out.push({ s, e }); s = e; }
  return out;
};
// label candidates, longest first
TS.labels = (u, s, e, P, tier) => {
  const a = U.ymd(s), yy = "'" + U.p2(a.y % 100);
  switch (u) {
    case 'year': return [String(a.y), yy];
    case 'half': { const h = a.m < 6 ? 1 : 2; return ['Semester ' + h + ' ' + a.y, 'Sem ' + h + ' ' + a.y, 'S' + h + ' ' + yy, 'S' + h]; }
    case 'quarter': { const q = Math.floor(a.m / 3) + 1; return ['Kuartal ' + q + ', ' + a.y, 'Kuartal ' + q + ' ' + yy, 'K' + q + ' ' + a.y, 'K' + q + ' ' + yy, 'K' + q]; }
    case 'month': return tier === 'top' ? [U.MON_L[a.m] + ' ' + a.y, U.MON_S[a.m] + ' ' + a.y, U.MON_S[a.m] + ' ' + yy, U.MON_S[a.m], U.MON_S[a.m][0]] : [U.MON_L[a.m] + ' ' + a.y, U.MON_L[a.m], U.MON_S[a.m] + ' ' + yy, U.MON_S[a.m], U.MON_S[a.m][0]];
    case 'third': { const k = a.d === 1 ? 'Awal' : a.d === 11 ? 'Tengah' : 'Akhir', last = U.ymd(e - 1440).d; return [a.d + '–' + last + ' ' + U.MON_S[a.m] + ' ' + a.y, a.d + '–' + last + ' ' + U.MON_S[a.m], k + ' ' + U.MON_S[a.m], k, k[0]]; }
    case 'week': return tier === 'top'
      ? [U.DOW_L[a.dow] + ', ' + a.d + ' ' + U.MON_L[a.m] + ' ' + a.y, a.d + ' ' + U.MON_S[a.m] + ' ' + a.y, a.d + ' ' + U.MON_S[a.m] + ' ' + yy, a.d + ' ' + U.MON_S[a.m], 'Mg ' + U.weekNo(s), String(a.d)]
      : [a.d + ' ' + U.MON_S[a.m] + ' ' + yy, a.d + ' ' + U.MON_S[a.m], 'Mg ' + U.weekNo(s), String(a.d), ''];
    case 'day': return [U.DOW_L[a.dow] + ' ' + a.d + ' ' + U.MON_S[a.m], U.DOW_S[a.dow] + ' ' + a.d + ' ' + U.MON_S[a.m], U.DOW_S[a.dow] + ' ' + a.d, U.DOW_S[a.dow], String(a.d), U.DOW_1[a.dow], ''];
    case 'hour': return [U.p2(a.h) + '.' + U.p2(a.mi), U.p2(a.h), String(a.h), ''];
  }
  return [''];
};
// tiers chosen from zoom (px per day)
TS.auto = ppd => {
  if (ppd >= 480) return [{ u: 'day', n: 1 }, { u: 'hour', n: 1 }];
  if (ppd >= 200) return [{ u: 'day', n: 1 }, { u: 'hour', n: 3 }];
  if (ppd >= 110) return [{ u: 'day', n: 1 }, { u: 'hour', n: 6 }];
  if (ppd >= 11) return [{ u: 'week', n: 1 }, { u: 'day', n: 1 }];
  if (ppd >= 3.8) return [{ u: 'month', n: 1 }, { u: 'week', n: 1 }];
  if (ppd >= 1.2) return [{ u: 'quarter', n: 1 }, { u: 'month', n: 1 }];
  if (ppd >= 0.42) return [{ u: 'year', n: 1 }, { u: 'quarter', n: 1 }];
  return [{ u: 'year', n: 1 }, { u: 'half', n: 1 }];
};
// tiers of a view: custom from Format › Skala Waktu, or automatic
TS.tiers = (P, ppd, cfg) => {
  const c = cfg || (P.view && P.view.ts) || null;
  if (c && !c.auto && c.tiers && c.tiers.length) return c.tiers.map(x => ({ u: x.u, n: x.n || 1 }));
  return TS.auto(ppd);
};
// choose for each tier the longest label format that fits its narrowest tick
const fmtCache = new Map();
TS.pickFormat = (u, n, ppd, P, tier, font) => {
  const k = u + n + '|' + Math.round(ppd * 100) + '|' + tier + '|' + font;
  if (fmtCache.has(k)) return fmtCache.get(k);
  const sample = [U.mk(2026, 8, 30), U.mk(2026, 1, 1), U.mk(2026, 10, 18, 8), U.mk(2026, 2, 15)];
  const widths = [];
  let minW = Infinity;
  for (const t of sample) { const s = TS.floor(u, t, P, n), e = TS.next(u, s, n); minW = Math.min(minW, ((e - s) / 1440) * ppd); }
  let best = 99;
  for (const t of sample) {
    const s = TS.floor(u, t, P, n), e = TS.next(u, s, n), L = TS.labels(u, s, e, P, tier);
    let i = 0;
    while (i < L.length - 1 && U.measure(L[i], font) > minW - 6) i++;
    if (i < best) best = i;
    widths.push(i);
  }
  const idx = Math.max(...widths);
  if (fmtCache.size > 400) fmtCache.clear();
  fmtCache.set(k, idx);
  return idx;
};
TS.label = (u, n, s, e, P, tier, idx) => { const L = TS.labels(u, s, e, P, tier); return L[Math.min(idx, L.length - 1)] || ''; };
TS.name = u => (TS.UNITS.find(x => x[0] === u) || ['', u])[1];
})();
