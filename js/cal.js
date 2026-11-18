// Amatu Project — kalender kerja: jam kerja mingguan, minggu kerja alternatif, pengecualian (libur/lembur, berulang),
// kalender turunan (sumber daya), dan hitungan waktu kerja (maju/mundur/selisih) dalam menit.
(() => {
'use strict';
const AP = window.AP, U = AP.U;
const Cal = AP.Cal = {};
const STD_DAY = [[480, 720], [780, 1020]];   // 08.00–12.00, 13.00–17.00
const cp = a => a.map(x => [x[0], x[1]]);
Cal.STD_DAY = STD_DAY;
Cal.make = (id, name, base = null) => ({ id, name, base, week: base ? [null, null, null, null, null, null, null] : [[], cp(STD_DAY), cp(STD_DAY), cp(STD_DAY), cp(STD_DAY), cp(STD_DAY), []], exc: [], ww: [] });
Cal.std = () => Cal.make('std', 'Standar');
Cal.h24 = () => ({ id: 'h24', name: '24 Jam', base: null, week: [0, 1, 2, 3, 4, 5, 6].map(() => [[0, 1440]]), exc: [], ww: [] });
Cal.night = () => ({ id: 'night', name: 'Shift Malam', base: null, week: [[], [[1380, 1440]], [[0, 180], [240, 480], [1380, 1440]], [[0, 180], [240, 480], [1380, 1440]], [[0, 180], [240, 480], [1380, 1440]], [[0, 180], [240, 480], [1380, 1440]], [[0, 180], [240, 480]]], exc: [], ww: [] });
Cal.sixDay = () => { const c = Cal.make('six', '6 Hari Kerja'); c.week[6] = [[480, 720], [780, 1020]]; return c; };
Cal.defaults = () => [Cal.std(), Cal.h24(), Cal.night()];
Cal.ivLen = iv => iv.reduce((a, [s, e]) => a + e - s, 0);
Cal.normIv = iv => {   // sort + merge + clamp 0..1440
  const a = (iv || []).map(([s, e]) => [U.clamp(Math.round(s), 0, 1440), U.clamp(Math.round(e), 0, 1440)]).filter(([s, e]) => e > s).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const x of a) { const l = out[out.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else out.push(x); }
  return out;
};

// does a (possibly recurring) exception apply on day di?
function hits(e, di) {
  if (di < e.from || di > e.to) return false;
  const r = e.rec;
  if (!r || !r.t) return true;
  const a = U.ymd(di * 1440), f = U.ymd(e.from * 1440);
  if (r.t === 'y') return a.m === (r.m == null ? f.m : r.m) && a.d === (r.d == null ? f.d : r.d);
  if (r.t === 'm') return a.d === (r.d == null ? f.d : r.d) && (((a.y - f.y) * 12 + a.m - f.m) % (r.n || 1) === 0);
  if (r.t === 'w') return (r.days || [a.dow]).includes(a.dow) && Math.floor((di - e.from) / 7) % (r.n || 1) === 0;
  if (r.t === 'd') return (di - e.from) % (r.n || 1) === 0;
  return true;
}
Cal.hits = hits;

/** Resolver bound to a project: working intervals per day (cached) + working-time arithmetic. */
Cal.ctx = function (P) {
  const map = new Map((P.cals || []).map(c => [c.id, c]));
  const projId = map.has(P.calendar) ? P.calendar : (P.cals && P.cals[0] ? P.cals[0].id : 'std');
  const fallback = Cal.std();
  const get = id => map.get(id) || map.get(projId) || fallback;
  const cache = new Map();
  const chain = c => { const out = [c]; let b = c, n = 0; while (b.base && n++ < 6) { const nb = map.get(b.base); if (!nb || out.includes(nb)) break; out.push(nb); b = nb; } return out; };
  function resolve(c, di) {
    const ch = chain(c), dow = (((di % 7) + 11) % 7);
    // 1. pengecualian sendiri, lalu pengecualian kalender dasar (hari libur berlaku juga untuk sumber daya)
    for (const k of ch) for (const e of k.exc || []) if (hits(e, di)) return e.work || [];
    // 2. minggu kerja alternatif / minggu default sendiri, lalu dari kalender dasar
    for (const k of ch) {
      for (const w of k.ww || []) if (di >= w.from && di <= w.to && w.week && w.week[dow]) return w.week[dow];
      if (k.week && k.week[dow]) return k.week[dow];
    }
    return dow === 0 || dow === 6 ? [] : STD_DAY;
  }
  function iv(id, di) {
    let m = cache.get(id);
    if (!m) cache.set(id, m = new Map());
    let r = m.get(di);
    if (!r) { r = resolve(get(id), di); m.set(di, r); }
    return r;
  }
  const LIM = 36600;   // ±100 tahun: kalender tanpa jam kerja tidak membuat macet
  function next(id, t) {
    let di = Math.floor(t / 1440);
    for (let g = 0; g < LIM; g++, di++) { const b = di * 1440; for (const [s, e] of iv(id, di)) if (t < b + e) return Math.max(t, b + s); }
    return t;
  }
  function prevEnd(id, t) {
    let di = Math.floor(t / 1440);
    for (let g = 0; g < LIM; g++, di--) { const b = di * 1440, a = iv(id, di); for (let i = a.length - 1; i >= 0; i--) if (t > b + a[i][0]) return Math.min(t, b + a[i][1]); }
    return t;
  }
  function add(id, t, m) {
    if (!(m > 0)) return t;
    let di = Math.floor(t / 1440);
    for (let g = 0; g < LIM; g++, di++) {
      const b = di * 1440;
      for (const [s, e] of iv(id, di)) {
        const E = b + e;
        if (E <= t) continue;
        const from = Math.max(b + s, t), av = E - from;
        if (m <= av) return from + m;
        m -= av;
      }
    }
    return t + m;
  }
  function sub(id, t, m) {
    if (!(m > 0)) return t;
    let di = Math.floor(t / 1440);
    for (let g = 0; g < LIM; g++, di--) {
      const b = di * 1440, a = iv(id, di);
      for (let i = a.length - 1; i >= 0; i--) {
        const S = b + a[i][0];
        if (S >= t) continue;
        const to = Math.min(b + a[i][1], t), av = to - S;
        if (m <= av) return to - m;
        m -= av;
      }
    }
    return t - m;
  }
  function between(id, a, b) {
    if (!(b > a)) return 0;
    let tot = 0;
    const d1 = Math.floor(a / 1440), d2 = Math.floor((b - 1) / 1440);
    if (d2 - d1 > LIM) return Math.round((b - a) / 3);
    for (let di = d1; di <= d2; di++) {
      const base = di * 1440;
      for (const [s, e] of iv(id, di)) { const x = Math.max(base + s, a), y = Math.min(base + e, b); if (y > x) tot += y - x; }
    }
    return tot;
  }
  const signed = (id, a, b) => (b >= a ? between(id, a, b) : -between(id, b, a));
  function isWork(id, t) { const di = Math.floor(t / 1440), b = di * 1440; return iv(id, di).some(([s, e]) => t >= b + s && t < b + e); }
  const dayWork = (id, di) => Cal.ivLen(iv(id, di));
  // milestone / zero-length point: keep a time that sits inside working time or exactly at its end
  function point(id, t) {
    const di = Math.floor(t / 1440), b = di * 1440;
    for (const [s, e] of iv(id, di)) if (t > b + s && t <= b + e) return t;
    return next(id, t);
  }
  return { P, projId, get, map, iv, next, prevEnd, add, sub, between, signed, isWork, dayWork, point,
    // elapsed-aware helpers (el = durasi/lag elapsed: 24 jam × 7 hari)
    addX: (id, t, m, el) => (el ? t + m : add(id, t, m)), subX: (id, t, m, el) => (el ? t - m : sub(id, t, m)),
  };
};

/* ---------------- hari libur nasional Indonesia ---------------- */
// Tanggal tetap + Paskah (algoritma) dihitung untuk tahun berapa pun; hari raya berbasis bulan dari daftar SKB.
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1, day = ((h + l - 7 * m + 114) % 31) + 1;
  return U.mk(y, month, day);
}
const LUNAR = {
  2025: [['01-27', 'Isra Mikraj Nabi Muhammad SAW'], ['01-29', 'Tahun Baru Imlek 2576'], ['03-29', 'Hari Suci Nyepi (Tahun Baru Saka 1947)'], ['03-31', 'Idulfitri 1446 H'], ['04-01', 'Idulfitri 1446 H (hari ke-2)'], ['05-12', 'Hari Raya Waisak 2569 BE'], ['06-06', 'Iduladha 1446 H'], ['06-27', 'Tahun Baru Islam 1447 H'], ['09-05', 'Maulid Nabi Muhammad SAW']],
  2026: [['01-16', 'Isra Mikraj Nabi Muhammad SAW'], ['02-17', 'Tahun Baru Imlek 2577'], ['03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'], ['03-21', 'Idulfitri 1447 H'], ['03-22', 'Idulfitri 1447 H (hari ke-2)'], ['05-27', 'Iduladha 1447 H'], ['05-31', 'Hari Raya Waisak 2570 BE'], ['06-16', 'Tahun Baru Islam 1448 H'], ['08-25', 'Maulid Nabi Muhammad SAW']],
  2027: [['01-06', 'Isra Mikraj (perkiraan)'], ['02-06', 'Tahun Baru Imlek 2578'], ['03-08', 'Hari Suci Nyepi (perkiraan)'], ['03-10', 'Idulfitri 1448 H (perkiraan)'], ['03-11', 'Idulfitri 1448 H hari ke-2 (perkiraan)'], ['05-17', 'Iduladha 1448 H (perkiraan)'], ['05-20', 'Hari Raya Waisak (perkiraan)'], ['06-06', 'Tahun Baru Islam 1449 H (perkiraan)'], ['08-15', 'Maulid Nabi (perkiraan)']],
};
Cal.LUNAR_YEARS = Object.keys(LUNAR).map(Number);
Cal.holidaysID = y => {
  const out = [[U.mk(y, 0, 1), 'Tahun Baru Masehi'], [U.mk(y, 4, 1), 'Hari Buruh Internasional'], [U.mk(y, 5, 1), 'Hari Lahir Pancasila'], [U.mk(y, 7, 17), 'Hari Proklamasi Kemerdekaan RI'], [U.mk(y, 11, 25), 'Hari Raya Natal']];
  const e = easter(y);
  out.push([e - 2 * 1440, 'Wafat Yesus Kristus (Jumat Agung)'], [e, 'Kebangkitan Yesus Kristus (Paskah)'], [e + 39 * 1440, 'Kenaikan Yesus Kristus']);
  for (const [md, n] of LUNAR[y] || []) { const [m, d] = md.split('-').map(Number); out.push([U.mk(y, m - 1, d), n]); }
  return out.sort((a, b) => a[0] - b[0]).map(([t, n]) => ({ di: Math.floor(t / 1440), n, est: /perkiraan/.test(n) }));
};
})();
