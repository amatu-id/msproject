// Amatu Project — laporan (dasbor) seperti Microsoft Project: Ringkasan Proyek, Biaya, Pekerjaan, Tugas Mendatang,
// Burndown, Sumber Daya (alokasi berlebih, ringkasan), Arus Kas, Nilai Hasil, Biaya Tugas/Sumber Daya, Biaya Berlebih,
// Tugas Kritis, Terlambat, Tergelincir, Tonggak. Digambar sebagai SVG lebar tetap → tampil di layar & tercetak rapi.
(() => {
'use strict';
const AP = window.AP, U = AP.U, F = AP.F, D = AP.D, M = AP.M, S = AP.S, UI = AP.UI, V = AP.V, TS = AP.TS, G = AP.G, { el, icon, esc } = U;
const Rep = AP.Rep = {};
const FONT = 'Inter, Arial, Helvetica, sans-serif';
const W = 1000, GAP = 18;
const C = { blue: '#4a8fd9', green: '#1f9d6b', red: '#e2574c', amber: '#f2a33a', violet: '#8e6ed5', teal: '#26a6a6', gray: '#9aa3ad', ink: '#111827', ink2: '#4b5563', line: '#e3e7ec', accent: '#0f7a55' };
const PALETTE = [C.blue, C.green, C.amber, C.violet, C.teal, C.red, '#c2185b', '#6d4c41', '#3949ab', '#7cb342'];

/* ---------------- blok ---------------- */
const txt = (x, y, s, o = {}) => `<text x="${x}" y="${y}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''} style="font:${o.font || '11px ' + FONT}" fill="${o.fill || C.ink}">${esc(s)}</text>`;
function card(w, h, title, inner, sub) {
  return `<rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="#fff" stroke="#dde2e8"/>` + txt(16, 24, title, { font: '700 13px ' + FONT }) + (sub ? txt(w - 16, 24, sub, { anchor: 'end', font: '11px ' + FONT, fill: C.ink2 }) : '') + inner;
}
const B = {
  kpis(items, w) {
    const n = items.length, gw = (w - (n - 1) * 12) / n, h = 78;
    const svg = items.map((k, i) => { const x = i * (gw + 12); return `<g transform="translate(${x},0)"><rect width="${gw}" height="${h}" rx="12" fill="${k.bg || '#f4f7fb'}" stroke="#dde2e8"/>${txt(14, 24, k.label, { font: '600 11px ' + FONT, fill: C.ink2 })}${txt(14, 52, U.fit(k.value, '700 20px ' + FONT, gw - 24), { font: '700 20px ' + FONT, fill: k.color || C.ink })}${k.sub ? txt(14, 69, U.fit(k.sub, '10px ' + FONT, gw - 24), { font: '10px ' + FONT, fill: C.ink2 }) : ''}</g>`; }).join('');
    return { h, svg };
  },
  table(title, cols, rows, w, o = {}) {
    const rh = 22, head = 40, max = o.max || 14;
    const shown = rows.slice(0, max);
    const totalW = cols.reduce((s, c) => s + (c.w || 1), 0);
    const cw = cols.map(c => (c.w || 1) / totalW * (w - 32));
    let inner = '';
    let x = 16;
    cols.forEach((c, i) => { inner += txt(c.al === 'r' ? x + cw[i] - 4 : x + 4, head + 10, c.t, { anchor: c.al === 'r' ? 'end' : null, font: '600 10.5px ' + FONT, fill: C.ink2 }); x += cw[i]; });
    inner += `<line x1="16" y1="${head + 16}" x2="${w - 16}" y2="${head + 16}" stroke="#cfd5dc"/>`;
    shown.forEach((r, k) => {
      const y = head + 16 + k * rh;
      if (k % 2) inner += `<rect x="16" y="${y}" width="${w - 32}" height="${rh}" fill="#fafbfc"/>`;
      x = 16;
      cols.forEach((c, i) => { const v = r[i] == null ? '' : String(r[i]); inner += txt(c.al === 'r' ? x + cw[i] - 4 : x + 4, y + 15, U.fit(v, (c.b && c.b(r) ? '600 ' : '') + '11px ' + FONT, cw[i] - 8), { anchor: c.al === 'r' ? 'end' : null, fill: c.color ? c.color(r) : C.ink, font: (c.b && c.b(r) ? '600 ' : '') + '11px ' + FONT }); x += cw[i]; });
    });
    let h = head + 16 + shown.length * rh + 12;
    if (!rows.length) { inner += txt(w / 2, head + 40, o.empty || 'Tidak ada data', { anchor: 'middle', fill: C.gray }); h = head + 64; }
    if (rows.length > shown.length) { inner += txt(16, h + 2, '… dan ' + (rows.length - shown.length) + ' lagi', { fill: C.ink2, font: 'italic 10.5px ' + FONT }); h += 14; }
    return { h, svg: card(w, h, title, inner, o.sub) };
  },
  bars(title, items, w, o = {}) {
    const h = o.h || 250, pad = { l: o.labelW || 150, r: 70, t: 44, b: 16 };
    const bh = Math.min(22, (h - pad.t - pad.b) / Math.max(1, items.length) - 6);
    const max = Math.max(1, ...items.map(i => Math.max(i.value, i.value2 || 0)));
    let inner = '';
    items.forEach((it, k) => {
      const y = pad.t + k * (bh + 6);
      const bw = (w - pad.l - pad.r) * it.value / max;
      inner += txt(pad.l - 8, y + bh / 2 + 4, U.fit(it.label, '11px ' + FONT, pad.l - 22), { anchor: 'end' });
      if (it.value2 != null) inner += `<rect x="${pad.l}" y="${y + bh - 4}" width="${(w - pad.l - pad.r) * it.value2 / max}" height="4" fill="${C.gray}"/>`;
      inner += `<rect x="${pad.l}" y="${y}" width="${Math.max(1, bw)}" height="${it.value2 != null ? bh - 5 : bh}" rx="3" fill="${it.color || PALETTE[k % PALETTE.length]}"/>`;
      inner += txt(pad.l + bw + 6, y + bh / 2 + 4, o.fmt ? o.fmt(it.value) : U.num(it.value, 0), { font: '600 10.5px ' + FONT, fill: C.ink2 });
    });
    if (!items.length) inner += txt(w / 2, h / 2, o.empty || 'Tidak ada data', { anchor: 'middle', fill: C.gray });
    const hh = Math.max(h, pad.t + items.length * (bh + 6) + pad.b);
    return { h: hh, svg: card(w, hh, title, inner, o.sub) };
  },
  line(title, series, w, o = {}) {
    const h = o.h || 260, pad = { l: 64, r: 16, t: 44, b: 40 };
    const all = series.flatMap(s => s.points);
    if (!all.length) return { h, svg: card(w, h, title, txt(w / 2, h / 2, 'Tidak ada data', { anchor: 'middle', fill: C.gray }), o.sub) };
    const t0 = Math.min(...all.map(p => p[0])), t1 = Math.max(...all.map(p => p[0]), t0 + 1440);
    const vmax = Math.max(1, ...all.map(p => p[1])) * 1.06;
    const X = t => pad.l + (t - t0) / (t1 - t0) * (w - pad.l - pad.r), Y = v => pad.t + (h - pad.t - pad.b) * (1 - v / vmax);
    let inner = '';
    for (let g = 0; g <= 4; g++) { const v = vmax * g / 4; inner += `<line x1="${pad.l}" y1="${Y(v)}" x2="${w - pad.r}" y2="${Y(v)}" stroke="${C.line}"/>` + txt(pad.l - 6, Y(v) + 4, o.fmt ? o.fmt(v) : U.num(v, 0), { anchor: 'end', font: '10px ' + FONT, fill: C.ink2 }); }
    const days = (t1 - t0) / 1440, unit = days > 400 ? 'quarter' : days > 70 ? 'month' : 'week';
    const ticks = TS.ticks(unit, 1, t0, t1, AP.app.P, 60);
    const step = Math.max(1, Math.ceil(ticks.length / 12));
    ticks.forEach((tk, i) => { if (i % step || tk.s < t0) return; inner += `<line x1="${X(tk.s)}" y1="${h - pad.b}" x2="${X(tk.s)}" y2="${h - pad.b + 4}" stroke="${C.gray}"/>` + txt(X(tk.s), h - pad.b + 16, TS.labels(unit, tk.s, tk.e, AP.app.P, 'bot')[unit === 'week' ? 1 : 3] || '', { anchor: 'middle', font: '10px ' + FONT, fill: C.ink2 }); });
    if (o.mark != null && o.mark > t0 && o.mark < t1) inner += `<line x1="${X(o.mark)}" y1="${pad.t}" x2="${X(o.mark)}" y2="${h - pad.b}" stroke="#f08c00" stroke-dasharray="4 3"/>` + txt(X(o.mark) + 4, pad.t + 10, o.markLabel || 'Status', { font: '600 10px ' + FONT, fill: '#c76f00' });
    series.forEach(s => { if (!s.points.length) return; inner += `<polyline points="${s.points.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.2"${s.dash ? ' stroke-dasharray="6 4"' : ''}/>`; });
    let lx = pad.l;
    series.forEach(s => { inner += `<rect x="${lx}" y="${h - 14}" width="14" height="4" fill="${s.color}"/>` + txt(lx + 18, h - 9, s.name, { font: '10.5px ' + FONT, fill: C.ink2 }); lx += 30 + U.measure(s.name, '10.5px ' + FONT); });
    return { h, svg: card(w, h, title, inner, o.sub) };
  },
  donut(title, items, w, o = {}) {
    const h = o.h || 230, r = Math.min(70, (h - 70) / 2), cx = 26 + r, cy = 44 + r;
    const tot = items.reduce((s, i) => s + i.value, 0) || 1;
    let a = -Math.PI / 2, inner = '';
    items.forEach((it, k) => {
      const da = it.value / tot * Math.PI * 2;
      if (it.value > 0) {
        const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a), x2 = cx + r * Math.cos(a + da - 1e-6), y2 = cy + r * Math.sin(a + da - 1e-6);
        inner += da >= Math.PI * 2 - 1e-6 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${it.color || PALETTE[k]}"/>` : `<path d="M${cx} ${cy}L${x1.toFixed(2)} ${y1.toFixed(2)}A${r} ${r} 0 ${da > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}Z" fill="${it.color || PALETTE[k]}"/>`;
      }
      a += da;
    });
    inner += `<circle cx="${cx}" cy="${cy}" r="${r * 0.58}" fill="#fff"/>` + txt(cx, cy + 6, o.center || '', { anchor: 'middle', font: '700 18px ' + FONT });
    items.forEach((it, k) => { const y = 54 + k * 20; inner += `<rect x="${cx + r + 26}" y="${y - 9}" width="11" height="11" rx="2" fill="${it.color || PALETTE[k]}"/>` + txt(cx + r + 44, y, U.fit(it.label + ' — ' + (o.fmt ? o.fmt(it.value) : U.num(it.value, 0)), '11px ' + FONT, w - (cx + r + 60))); });
    return { h, svg: card(w, h, title, inner, o.sub) };
  },
  note(textS, w) { const lines = U.wrap(textS, '11.5px ' + FONT, w - 32, 6); const h = 22 + lines.length * 16; return { h, svg: `<rect width="${w}" height="${h}" rx="10" fill="#f4f7fb"/>` + lines.map((l, i) => txt(16, 26 + i * 16, l, { font: '11.5px ' + FONT, fill: C.ink2 })).join('') }; },
};
// layout: rows of blocks; each row = [block] or [block, block] (side by side)
function compose(title, sub, rows) {
  const out = [], breaks = [];
  out.push(`<rect width="${W}" height="64" fill="#fff"/>` + txt(0, 30, title, { font: '700 22px ' + FONT }) + txt(0, 52, sub, { font: '12px ' + FONT, fill: C.ink2 }) + `<line x1="0" y1="62" x2="${W}" y2="62" stroke="${C.accent}" stroke-width="2"/>`);
  let y = 78;
  for (const row of rows) {
    const n = row.length, w = (W - (n - 1) * GAP) / n;
    const blocks = row.map(f => f(w));
    const h = Math.max(...blocks.map(b => b.h));
    blocks.forEach((b, i) => out.push(`<g transform="translate(${i * (w + GAP)},${y})">${b.svg}</g>`));
    y += h + GAP;
    breaks.push(y - GAP / 2);
  }
  return { w: W, h: y, svg: out.join(''), breaks };
}

/* ---------------- data deret waktu ---------------- */
function series(P, kind) {
  const R = P.root, a = U.dayStart(Math.min(R.start, ...P.tasks.filter(t => t.bl && t.bl[0]).map(t => t.bl[0].s))), b = Math.max(R.finish, ...P.tasks.filter(t => t.bl && t.bl[0]).map(t => t.bl[0].f)) + 1440;
  const days = (b - a) / 1440, unit = days > 360 ? 'month' : days > 60 ? 'week' : 'day';
  const ticks = TS.ticks(unit, 1, a, b, P, 400);
  const leaves = P.tasks.filter(t => !t.sum && !t.inact);
  const C2 = P._ctx;
  const spread = (total, s, f, tk) => { if (!total) return 0; if (f <= s) return tk.s <= s && s < tk.e ? total : 0; const span = C2.between(P.calendar, s, f) || 1; return total * C2.between(P.calendar, Math.max(s, tk.s), Math.min(f, tk.e)) / span; };
  const sd = P.statusDate != null ? P.statusDate : U.now();
  let c1 = 0, c2 = 0, c3 = 0;
  const plan = [], base = [], act = [];
  for (const tk of ticks) {
    let p = 0, bb = 0, ac = 0;
    for (const t of leaves) {
      const total = kind === 'cost' ? t.cost : t.work;
      p += kind === 'cost' ? (P.asgT.get(t.uid) || []).reduce((s2, x) => s2 + S.asgIn(P, x, tk.s, tk.e, 'cost'), 0) + S.fixedIn(P, t, tk.s, tk.e) : (P.asgT.get(t.uid) || []).reduce((s2, x) => s2 + S.asgIn(P, x, tk.s, tk.e, 'work'), 0);
      const bl = t.bl && t.bl[0];
      if (bl) bb += spread(kind === 'cost' ? bl.c : bl.w, bl.s, bl.f, tk);
      const done = kind === 'cost' ? t.aCost : t.aWork;
      if (done && tk.s < sd) { const aEnd = t.pct >= 100 ? t.finish : Math.min(sd, t.finish); ac += spread(done, t.aStart != null ? t.aStart : t.start, Math.max(aEnd, (t.aStart || t.start) + 1), tk); }
      void total;
    }
    c1 += p; c2 += bb; c3 += ac;
    plan.push([tk.e, c1]); base.push([tk.e, c2]); if (tk.s < sd) act.push([Math.min(tk.e, sd), c3]);
    void tk;
  }
  const hasBl = P.tasks.some(t => t.bl && t.bl[0]);
  return { ticks, unit, plan, base: hasBl ? base : [], act, sd, a };
}
const fmtMoney = P => v => U.money(v, P);
const fmtH = v => U.num(Math.round(v / 60), 0) + 'j';
const tasksTbl = (P, list) => list.map(t => [t.id, t.name, F.text('task', 'dur', t, P), U.fmtDate(t.start, 'dd/mm/yy'), U.fmtDate(t.finish, 'dd/mm/yy'), U.num(t.pct, 0) + '%', D.fmtRes(t, P)]);
const TASK_COLS = [{ t: 'ID', w: 0.5 }, { t: 'Nama Tugas', w: 4 }, { t: 'Durasi', w: 1, al: 'r' }, { t: 'Mulai', w: 1.1 }, { t: 'Selesai', w: 1.1 }, { t: '%', w: 0.6, al: 'r' }, { t: 'Sumber Daya', w: 2.4 }];

/* ---------------- daftar laporan ---------------- */
Rep.LIST = [
  { id: 'overview', g: 'dash', t: 'Ringkasan Proyek', icon: 'dashboard' },
  { id: 'cost', g: 'dash', t: 'Ringkasan Biaya', icon: 'payments' },
  { id: 'work', g: 'dash', t: 'Ringkasan Pekerjaan', icon: 'engineering' },
  { id: 'upcoming', g: 'dash', t: 'Tugas Mendatang', icon: 'upcoming' },
  { id: 'burndown', g: 'dash', t: 'Burndown', icon: 'trending_down' },
  { id: 'resover', g: 'res', t: 'Sumber Daya Teralokasi Berlebih', icon: 'person_alert' },
  { id: 'resov', g: 'res', t: 'Ringkasan Sumber Daya', icon: 'groups' },
  { id: 'cashflow', g: 'cost', t: 'Arus Kas', icon: 'account_balance' },
  { id: 'overrun', g: 'cost', t: 'Biaya Berlebih', icon: 'money_off' },
  { id: 'ev', g: 'cost', t: 'Laporan Nilai Hasil', icon: 'stacked_line_chart' },
  { id: 'rescost', g: 'cost', t: 'Ringkasan Biaya Sumber Daya', icon: 'pie_chart' },
  { id: 'taskcost', g: 'cost', t: 'Ringkasan Biaya Tugas', icon: 'request_quote' },
  { id: 'critical', g: 'prog', t: 'Tugas Kritis', icon: 'priority_high' },
  { id: 'late', g: 'prog', t: 'Tugas Terlambat', icon: 'running_with_errors' },
  { id: 'milestones', g: 'prog', t: 'Laporan Tonggak', icon: 'flag' },
  { id: 'slipping', g: 'prog', t: 'Tugas Tergelincir', icon: 'trending_up' },
];
Rep.build = (P, id) => {
  const R = P.root, fm = fmtMoney(P), sd = P.statusDate != null ? P.statusDate : U.now();
  const leaves = P.tasks.filter(t => !t.sum && !t.inact);
  const top = P.tasks.filter(t => t.lvl === 1 && !t.inact);
  const sub = P.name + ' · ' + U.fmtDate(R.start, 'dd mmm yyyy') + ' – ' + U.fmtDate(R.finish, 'dd mmm yyyy') + ' · per ' + U.fmtDate(sd, 'dd mmm yyyy');
  const r = Rep.LIST.find(x => x.id === id) || Rep.LIST[0];
  const bl = R.bl && R.bl[0];
  const kpiBase = [
    { label: 'Mulai', value: U.fmtDate(R.start, 'dd mmm yyyy'), sub: U.DOW_L[U.ymd(R.start).dow] },
    { label: 'Selesai', value: U.fmtDate(R.finish, 'dd mmm yyyy'), sub: bl ? 'garis dasar ' + U.fmtDate(bl.f, 'dd mmm yy') : D.fmtDur(R.sdur, 'd', P.opts) },
    { label: '% selesai', value: U.num(R.pct, 0) + '%', color: C.accent, sub: leaves.filter(t => t.pct >= 100).length + ' dari ' + leaves.length + ' tugas' },
    { label: 'Biaya', value: U.money(R.cost, P), sub: 'aktual ' + U.money(R.aCost, P) },
  ];
  let rows;
  switch (r.id) {
    case 'overview': {
      const st = { done: 0, ontrack: 0, late: 0, future: 0 };
      for (const t of leaves) st[t.status] = (st[t.status] || 0) + 1;
      const ms = leaves.filter(t => F.isMs(t)).sort((a, b) => a.start - b.start);
      rows = [[w => B.kpis(kpiBase, w)],
        [w => B.donut('Status tugas', [{ label: 'Selesai', value: st.done, color: C.green }, { label: 'Sesuai jadwal', value: st.ontrack, color: C.blue }, { label: 'Terlambat', value: st.late, color: C.red }, { label: 'Mendatang', value: st.future, color: C.gray }], w, { center: U.num(R.pct, 0) + '%' }),
          w => B.bars('% selesai per fase', top.map(t => ({ label: t.name, value: t.pct, color: t.crit ? C.red : C.blue })), w, { fmt: v => U.num(v, 0) + '%', h: 230 })],
        [w => B.table('Tonggak', [{ t: 'Tonggak', w: 4 }, { t: 'Tanggal', w: 1.4 }, { t: 'Status', w: 1.4 }], ms.map(t => [t.name, U.fmtDate(t.start, 'ddd dd/mm/yy'), F.STATUS_L[t.status]]), w, { max: 10, empty: 'Belum ada tonggak' }),
          w => B.table('Tugas terlambat', [{ t: 'Tugas', w: 4 }, { t: 'Selesai', w: 1.4 }, { t: '%', w: 0.8, al: 'r' }], leaves.filter(t => t.status === 'late').map(t => [t.name, U.fmtDate(t.finish, 'dd/mm/yy'), U.num(t.pct, 0) + '%']), w, { max: 10, empty: 'Tidak ada tugas terlambat' })]];
      break;
    }
    case 'cost': {
      const sr = series(P, 'cost');
      rows = [[w => B.kpis([{ label: 'Biaya total', value: U.money(R.cost, P) }, { label: 'Biaya aktual', value: U.money(R.aCost, P) }, { label: 'Biaya sisa', value: U.money(R.rCost, P) }, { label: 'Garis dasar', value: bl ? U.money(bl.c, P) : 'NA', sub: bl ? 'varians ' + U.money(R.cost - bl.c, P) : 'belum ditetapkan', color: bl && R.cost > bl.c ? C.red : C.ink }], w)],
        [w => B.line('Biaya kumulatif (kurva S)', [{ name: 'Rencana', points: sr.plan, color: C.blue }, ...(sr.base.length ? [{ name: 'Garis dasar', points: sr.base, color: C.gray, dash: true }] : []), { name: 'Aktual', points: sr.act, color: C.green }], w, { fmt: fm, mark: sd })],
        [w => B.bars('Biaya per fase', top.map(t => ({ label: t.name, value: t.cost, value2: t.bl && t.bl[0] ? t.bl[0].c : null })), w, { fmt: fm, labelW: 200, h: 40 + top.length * 28 })]];
      break;
    }
    case 'work': {
      const sr = series(P, 'work');
      const res = P.res.filter(x => x.type === 'work');
      rows = [[w => B.kpis([{ label: 'Kerja total', value: D.fmtWork(R.work, P.opts) }, { label: 'Kerja aktual', value: D.fmtWork(R.aWork, P.opts) }, { label: 'Kerja sisa', value: D.fmtWork(R.rWork, P.opts) }, { label: '% kerja selesai', value: U.num(R.pwc, 0) + '%', color: C.accent }], w)],
        [w => B.line('Kerja kumulatif', [{ name: 'Rencana', points: sr.plan, color: C.blue }, ...(sr.base.length ? [{ name: 'Garis dasar', points: sr.base, color: C.gray, dash: true }] : []), { name: 'Aktual', points: sr.act, color: C.green }], w, { fmt: fmtH, mark: sd })],
        [w => B.bars('Kerja per sumber daya', res.map(x => ({ label: x.name, value: x.work, value2: x.aWork, color: x.over ? C.red : C.blue })), w, { fmt: fmtH, h: 40 + res.length * 28, empty: 'Belum ada sumber daya kerja' })]];
      break;
    }
    case 'upcoming': {
      const now = U.today(), end = now + 14 * 1440;
      rows = [[w => B.kpis([{ label: 'Sedang berjalan', value: String(leaves.filter(t => t.pct > 0 && t.pct < 100).length) }, { label: 'Mulai 2 minggu ke depan', value: String(leaves.filter(t => t.start >= now && t.start < end).length) }, { label: 'Selesai 2 minggu ke depan', value: String(leaves.filter(t => t.finish >= now && t.finish < end && t.pct < 100).length) }, { label: 'Terlambat', value: String(leaves.filter(t => t.status === 'late').length), color: C.red }], w)],
        [w => B.table('Sedang berjalan', TASK_COLS, tasksTbl(P, leaves.filter(t => t.pct > 0 && t.pct < 100)), w, { max: 12, empty: 'Belum ada tugas berjalan' })],
        [w => B.table('Mulai dalam 2 minggu', TASK_COLS, tasksTbl(P, leaves.filter(t => t.start >= now && t.start < end).sort((a, b) => a.start - b.start)), w, { max: 14, empty: 'Tidak ada tugas yang mulai dalam 2 minggu' })]];
      break;
    }
    case 'burndown': {
      const sr = series(P, 'work');
      const tot = R.work || 1;
      const rem = sr.plan.map(([t, v]) => [t, Math.max(0, tot - v)]), remB = sr.base.map(([t, v]) => [t, Math.max(0, (bl ? bl.w : tot) - v)]), remA = sr.act.map(([t, v]) => [t, Math.max(0, tot - v)]);
      const cnt = sr.ticks.map(tk => [tk.e, leaves.filter(t => t.finish > tk.e || (t.pct < 100 && tk.e > sd)).length]);
      rows = [[w => B.line('Kerja sisa', [{ name: 'Rencana', points: rem, color: C.blue }, ...(remB.length ? [{ name: 'Garis dasar', points: remB, color: C.gray, dash: true }] : []), { name: 'Aktual', points: remA, color: C.green }], w, { fmt: fmtH, mark: sd })],
        [w => B.line('Jumlah tugas tersisa', [{ name: 'Tugas tersisa', points: cnt, color: C.violet }], w, { mark: sd })]];
      break;
    }
    case 'resover': {
      const over = P.res.filter(x => x.over);
      rows = [[w => B.kpis([{ label: 'Teralokasi berlebih', value: String(over.length), color: over.length ? C.red : C.green }, { label: 'Sumber daya kerja', value: String(P.res.filter(x => x.type === 'work').length) }, { label: 'Tugas terdampak', value: String(leaves.filter(t => t.over).length) }], w)],
        [w => B.bars('Puncak pemakaian vs unit maksimum', P.res.filter(x => x.type === 'work').map(x => ({ label: x.name, value: Math.round((x.peak || 0) * 100), value2: Math.round((x.max || 1) * 100), color: x.over ? C.red : C.green })), w, { fmt: v => U.num(v, 0) + '%', h: 40 + P.res.length * 28 })],
        [w => B.table('Sumber daya teralokasi berlebih', [{ t: 'Nama', w: 3 }, { t: 'Unit maks', w: 1, al: 'r' }, { t: 'Puncak', w: 1, al: 'r' }, { t: 'Hari berlebih', w: 1, al: 'r' }, { t: 'Kerja', w: 1, al: 'r' }], over.map(x => [x.name, U.num(x.max * 100, 0) + '%', U.num(x.peak * 100, 0) + '%', String(x.overDays || 0), D.fmtWork(x.work, P.opts)]), w, { empty: 'Tidak ada alokasi berlebih 👍' })],
        [w => B.note('Gunakan Sumber Daya › Ratakan Semua untuk menunda tugas sampai beban tiap sumber daya per hari tidak melebihi unit maksimumnya, atau tambahkan/ganti sumber daya lewat Tetapkan Sumber Daya.', w)]];
      break;
    }
    case 'resov': {
      const res = P.res;
      rows = [[w => B.bars('Kerja per sumber daya', res.filter(x => x.type === 'work').map(x => ({ label: x.name, value: x.work, value2: x.aWork })), w, { fmt: fmtH, h: 40 + res.length * 26 })],
        [w => B.table('Ringkasan sumber daya', [{ t: 'Nama', w: 3 }, { t: 'Jenis', w: 1 }, { t: 'Kerja', w: 1.2, al: 'r' }, { t: 'Kerja aktual', w: 1.2, al: 'r' }, { t: 'Biaya', w: 1.6, al: 'r' }, { t: 'Puncak', w: 0.9, al: 'r' }], res.map(x => [x.name, (F.RTYPES.find(k => k[0] === x.type) || [])[1], x.type === 'work' ? D.fmtWork(x.work, P.opts) : '', x.type === 'work' ? D.fmtWork(x.aWork, P.opts) : '', U.money(x.cost, P), x.type === 'work' ? U.num((x.peak || 0) * 100, 0) + '%' : '']), w, { max: 24, empty: 'Belum ada sumber daya' })]];
      break;
    }
    case 'cashflow': {
      const sr = series(P, 'cost');
      const per = sr.plan.map(([t, v], i) => ({ label: TS.labels(sr.unit, sr.ticks[i].s, sr.ticks[i].e, P, 'bot')[sr.unit === 'day' ? 2 : 1], value: v - (i ? sr.plan[i - 1][1] : 0) }));
      rows = [[w => B.kpis([{ label: 'Total biaya', value: U.money(R.cost, P) }, { label: 'Sudah dikeluarkan', value: U.money(R.aCost, P) }, { label: 'Sisa', value: U.money(R.rCost, P) }], w)],
        [w => B.line('Biaya kumulatif', [{ name: 'Rencana', points: sr.plan, color: C.blue }, { name: 'Aktual', points: sr.act, color: C.green }, ...(sr.base.length ? [{ name: 'Garis dasar', points: sr.base, color: C.gray, dash: true }] : [])], w, { fmt: fm, mark: sd })],
        [w => B.table('Biaya per ' + TS.name(sr.unit).toLowerCase(), [{ t: 'Periode', w: 2 }, { t: 'Biaya', w: 2, al: 'r' }, { t: 'Kumulatif', w: 2, al: 'r' }], per.map((p, i) => [p.label + ' (' + U.fmtDate(sr.ticks[i].s, 'dd/mm/yy') + ')', U.money(p.value, P), U.money(sr.plan[i][1], P)]).filter((x, i) => per[i].value > 0.5), w, { max: 26 })]];
      break;
    }
    case 'overrun': {
      const list = leaves.filter(t => t.bl && t.bl[0] && t.cost > t.bl[0].c + 0.5).sort((a, b) => (b.cost - b.bl[0].c) - (a.cost - a.bl[0].c));
      rows = [[w => B.kpis([{ label: 'Tugas melebihi anggaran', value: String(list.length), color: list.length ? C.red : C.green }, { label: 'Total kelebihan', value: U.money(U.sum(list, t => t.cost - t.bl[0].c), P) }, { label: 'Biaya vs garis dasar', value: bl ? U.money(R.cost - bl.c, P) : 'NA' }], w)],
        [w => B.table('Tugas dengan biaya berlebih', [{ t: 'ID', w: 0.5 }, { t: 'Tugas', w: 4 }, { t: 'Garis dasar', w: 1.6, al: 'r' }, { t: 'Biaya', w: 1.6, al: 'r' }, { t: 'Varians', w: 1.6, al: 'r' }], list.map(t => [t.id, t.name, U.money(t.bl[0].c, P), U.money(t.cost, P), U.money(t.cost - t.bl[0].c, P)]), w, { max: 20, empty: bl ? 'Tidak ada tugas yang melebihi anggaran' : 'Tetapkan garis dasar dulu (Proyek › Garis Dasar)' })]];
      break;
    }
    case 'ev': {
      const sr = series(P, 'cost');
      const spi = R.bcws ? R.bcwp / R.bcws : null, cpi = R.acwp ? R.bcwp / R.acwp : null;
      const evPts = sr.base.map(([t, v]) => [t, t <= sd ? Math.min(v, R.bcwp) : null]).filter(p => p[1] != null);
      rows = [[w => B.kpis([{ label: 'PV (BCWS)', value: U.money(R.bcws, P) }, { label: 'EV (BCWP)', value: U.money(R.bcwp, P) }, { label: 'AC (ACWP)', value: U.money(R.acwp, P) }, { label: 'SPI / CPI', value: (spi == null ? '–' : U.numFix(spi, 2)) + ' / ' + (cpi == null ? '–' : U.numFix(cpi, 2)), color: (spi != null && spi < 0.95) || (cpi != null && cpi < 0.95) ? C.red : C.green }], w)],
        [w => B.line('Nilai hasil dari waktu ke waktu', [{ name: 'Nilai rencana (PV)', points: sr.base, color: C.gray, dash: true }, { name: 'Biaya aktual (AC)', points: sr.act, color: C.red }, { name: 'Nilai hasil (EV)', points: evPts, color: C.green }], w, { fmt: fm, mark: sd })],
        [w => B.table('Nilai hasil per fase', [{ t: 'Fase', w: 3 }, { t: 'PV', w: 1.4, al: 'r' }, { t: 'EV', w: 1.4, al: 'r' }, { t: 'AC', w: 1.4, al: 'r' }, { t: 'SV', w: 1.4, al: 'r' }, { t: 'CV', w: 1.4, al: 'r' }], top.map(t => [t.name, U.money(t.bcws, P), U.money(t.bcwp, P), U.money(t.acwp, P), U.money(t.bcwp - t.bcws, P), U.money(t.bcwp - t.acwp, P)]), w, { empty: 'Tetapkan garis dasar untuk menghitung nilai hasil' })],
        [w => B.note('PV = biaya garis dasar pekerjaan yang dijadwalkan sampai tanggal status; EV = biaya garis dasar × % selesai; AC = biaya aktual. SPI = EV/PV (<1 terlambat), CPI = EV/AC (<1 boros). Memerlukan garis dasar.', w)]];
      break;
    }
    case 'rescost': {
      const res = P.res.filter(x => x.cost > 0).sort((a, b) => b.cost - a.cost);
      rows = [[w => B.donut('Porsi biaya sumber daya', res.slice(0, 8).map((x, i) => ({ label: x.name, value: x.cost, color: PALETTE[i % PALETTE.length] })), w, { fmt: fm, center: res.length + ' SD', h: Math.max(230, 60 + Math.min(8, res.length) * 20) })],
        [w => B.table('Biaya per sumber daya', [{ t: 'Nama', w: 3 }, { t: 'Jenis', w: 1 }, { t: 'Biaya', w: 1.6, al: 'r' }, { t: 'Aktual', w: 1.6, al: 'r' }, { t: 'Sisa', w: 1.6, al: 'r' }], res.map(x => [x.name, (F.RTYPES.find(k => k[0] === x.type) || [])[1], U.money(x.cost, P), U.money(x.aCost, P), U.money(x.cost - x.aCost, P)]), w, { max: 24, empty: 'Belum ada biaya sumber daya' })]];
      break;
    }
    case 'taskcost': {
      rows = [[w => B.bars('Biaya per fase', top.map(t => ({ label: t.name, value: t.cost, value2: t.bl && t.bl[0] ? t.bl[0].c : null })), w, { fmt: fm, labelW: 200, h: 40 + top.length * 28 })],
        [w => B.table('Biaya tugas', [{ t: 'ID', w: 0.5 }, { t: 'Tugas', w: 4 }, { t: 'Biaya tetap', w: 1.5, al: 'r' }, { t: 'Biaya', w: 1.5, al: 'r' }, { t: 'Aktual', w: 1.5, al: 'r' }, { t: 'Sisa', w: 1.5, al: 'r' }], P.tasks.filter(t => !t.inact && (t.cost || t.sum)).map(t => [t.id, '  '.repeat(t.lvl - 1) + t.name, U.money(t.fixedCost || 0, P), U.money(t.cost, P), U.money(t.aCost, P), U.money(t.rCost, P)]), w, { max: 30 })]];
      break;
    }
    case 'critical': rows = [[w => B.kpis([{ label: 'Tugas kritis', value: String(leaves.filter(t => t.crit).length), color: C.red }, { label: 'Durasi proyek', value: D.fmtDur(R.sdur, 'd', P.opts) }, { label: 'Selesai proyek', value: U.fmtDate(R.finish, 'dd mmm yyyy') }], w)], [w => B.table('Tugas di jalur kritis', TASK_COLS, tasksTbl(P, leaves.filter(t => t.crit)), w, { max: 30, empty: 'Tidak ada tugas kritis' })]]; break;
    case 'late': rows = [[w => B.table('Tugas terlambat (per tanggal status)', [...TASK_COLS.slice(0, 5), { t: '% / harus', w: 1.1, al: 'r' }], leaves.filter(t => t.status === 'late').map(t => [t.id, t.name, F.text('task', 'dur', t, P), U.fmtDate(t.start, 'dd/mm/yy'), U.fmtDate(t.finish, 'dd/mm/yy'), U.num(t.pct, 0) + '% / ' + U.num(t.expPct, 0) + '%']), w, { max: 30, empty: 'Tidak ada tugas terlambat' })]]; break;
    case 'milestones': rows = [[w => B.table('Tonggak', [{ t: 'ID', w: 0.5 }, { t: 'Tonggak', w: 4 }, { t: 'Tanggal', w: 1.4 }, { t: 'Garis dasar', w: 1.4 }, { t: 'Status', w: 1.4 }], leaves.filter(t => F.isMs(t)).sort((a, b) => a.start - b.start).map(t => [t.id, t.name, U.fmtDate(t.start, 'ddd dd/mm/yy'), t.bl && t.bl[0] ? U.fmtDate(t.bl[0].f, 'dd/mm/yy') : 'NA', F.STATUS_L[t.status]]), w, { max: 40, empty: 'Belum ada tonggak' })]]; break;
    case 'slipping': rows = [[w => B.table('Tugas tergelincir (selesai setelah garis dasar)', [{ t: 'ID', w: 0.5 }, { t: 'Tugas', w: 4 }, { t: 'Selesai', w: 1.2 }, { t: 'Garis dasar', w: 1.2 }, { t: 'Varians', w: 1.2, al: 'r' }], leaves.filter(t => t.pct < 100 && t.bl && t.bl[0] && t.finish > t.bl[0].f + 1).map(t => [t.id, t.name, U.fmtDate(t.finish, 'dd/mm/yy'), U.fmtDate(t.bl[0].f, 'dd/mm/yy'), F.text('task', 'fVar', t, P)]), w, { max: 30, empty: bl ? 'Tidak ada tugas tergelincir' : 'Tetapkan garis dasar dulu (Proyek › Garis Dasar)' })]]; break;
  }
  return compose(r.t, sub, rows);
};

/* ---------------- tampilan laporan ---------------- */
class ReportView {
  constructor(app, id) { this.app = app; this.id = id; this.rid = String(id).split(':')[1] || 'overview'; }
  get P() { return this.app.P; }
  mount(host) {
    this.host = host;
    this.wrap = el('div.vwrap.repv');
    host.append(this.wrap);
    this.ro = new ResizeObserver(() => this.render());
    this.ro.observe(this.wrap);
    this.render();
  }
  unmount() { this.ro.disconnect(); this.wrap.remove(); }
  focus() { }
  selectedTasks() { return []; }
  render() {
    const P = this.P;
    const sel = UI.select(Rep.LIST.map(r => [r.id, r.t]), this.rid, v => { this.app.setView('report:' + v); });
    sel.classList.add('sm');
    const tools = el('div.vtool', icon('monitoring'), sel, el('span.sp'),
      el('button.btn.sm', { type: 'button', onclick: () => AP.Pr.open(this.app, { pdf: true }) }, icon('picture_as_pdf'), 'PDF'),
      el('button.btn.sm', { type: 'button', onclick: () => AP.IO.exportPNG(this.app) }, icon('image'), 'Gambar'));
    const art = Rep.build(P, this.rid);
    const box = el('div.rep-box');
    const avail = Math.max(320, (this.wrap.clientWidth || 1000) - 40);
    const z = Math.min(1.25, avail / art.w);
    box.innerHTML = `<svg width="${art.w * z}" height="${art.h * z}" viewBox="0 0 ${art.w} ${art.h}">${art.svg}</svg>`;
    this.wrap.replaceChildren(tools, box);
  }
}
ReportView.printArt = (app, id) => { const a = Rep.build(app.P, String(id).split(':')[1] || 'overview'); return { ...a, prefer: 'portrait', maxScale: 1 }; };
V.TYPES.report = ReportView;
})();
