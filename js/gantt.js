// Amatu Project — bagan Gantt. `G.svg()` menggambar batang/tautan/garis untuk layar dan cetak (satu kode),
// `G.scaleSVG()` menggambar skala waktu bertingkat. `Chart` = panel Gantt di layar: hanya bagian terlihat yang digambar,
// seret batang (pindah), tepi kanan (durasi), ujung progres (% selesai), seret vertikal ke tugas lain (tautkan),
// dobel klik (informasi tugas / dependensi), Ctrl+roda (zoom), geser area kosong.
(() => {
'use strict';
const AP = window.AP, U = AP.U, F = AP.F, D = AP.D, TS = AP.TS, UI = AP.UI, { el, icon, esc } = U;
const G = AP.G = {};

G.DEF_BARS = {
  task: { fill: '#4a8fd9', line: '#2f6fb5', prog: '#1e4f8c' },
  crit: { fill: '#e2574c', line: '#b8392f', prog: '#8f241c' },
  sum: { fill: '#3c4450', prog: '#1d232b' },
  proj: { fill: '#7b8794', prog: '#4a5562' },
  ms: { fill: '#2b3138' }, msCrit: { fill: '#c8352b' },
  manual: { fill: '#9fd0f4', line: '#3d8fd1', prog: '#2f6fb5' },
  inact: { fill: 'none', line: '#a3abb5' },
  base: { fill: '#aab3bd', line: '#8a949f' },
  slack: { fill: '#1aa89a' },
  late: { fill: '#f0a030', line: '#c97b12', prog: '#8d520a' },
  pre: { fill: '#e8c79a', line: '#c9a371' },
  dead: { fill: '#2e9b62' },
  link: '#4b5563', linkCrit: '#d63c30',
  today: '#f08c00', status: '#2f6fb5', shade: 'rgba(120,130,145,.11)', grid: 'rgba(120,130,145,.16)', pb: '#7d8794',
};
G.bars = P => { const b = U.deep(G.DEF_BARS); if (P && P.bars) for (const k in P.bars) b[k] = typeof b[k] === 'object' && b[k] ? { ...b[k], ...P.bars[k] } : P.bars[k]; return b; };
G.TEXT_FIELDS = [['', '(tidak ada)'], ['rn', 'Nama Sumber Daya'], ['name', 'Nama Tugas'], ['dur', 'Durasi'], ['start', 'Mulai'], ['finish', 'Selesai'], ['pct', '% Selesai'], ['ri', 'Inisial Sumber Daya'], ['wbs', 'WBS'], ['cost', 'Biaya'], ['work', 'Kerja']];
G.defText = () => ({ task: { r: 'rn', l: '', t: '', i: '' }, ms: { r: 'start', l: '', t: '' }, sum: { r: '', l: '', t: '' } });
G.optsOf = P => {
  const v = (P.view && P.view.gantt) || {};
  return { crit: v.crit !== false, slack: !!v.slack, late: !!v.late, base: v.base == null ? null : v.base, links: v.links || 'elbow', round: !!v.round, barH: v.barH || 0.5,
    text: { ...G.defText(), ...(v.text || {}) }, shade: v.shade !== false, today: v.today !== false, sd: v.sd !== false, grid: v.grid || 'top', rowLines: !!v.rowLines, progLine: !!v.progLine, pb: !!v.pb, dateFmt: v.dateFmt || 'd/m' };
};
const shortDate = (t, f) => { const a = U.ymd(t); return f === 'd mmm' ? a.d + ' ' + U.MON_S[a.m] : f === 'dd/mm/yy' ? U.fmtDate(t, 'dd/mm/yy') : a.d + '/' + (a.m + 1); };

/* ---------------- SVG: skala waktu ---------------- */
// o: {P, ppd, origin, x0, x1, h, tiers, font, color, line, bg, shade}
G.scaleSVG = o => {
  const tiers = o.tiers || TS.tiers(o.P, o.ppd), n = tiers.length, th = o.h / n;
  const out = [];
  const tA = o.origin + (o.x0 / o.ppd) * 1440, tB = o.origin + (o.x1 / o.ppd) * 1440;
  const X = t => ((t - o.origin) / 1440) * o.ppd;
  if (o.bg) out.push(`<rect x="${o.x0}" y="0" width="${o.x1 - o.x0}" height="${o.h}" fill="${o.bg}"/>`);
  tiers.forEach((tr, k) => {
    const tierName = n > 1 && k === 0 ? 'top' : 'bot';
    const idx = TS.pickFormat(tr.u, tr.n, o.ppd, o.P, tierName, o.font);
    const ticks = TS.ticks(tr.u, tr.n, tA, tB, o.P, 3000);
    const y = k * th;
    for (const tk of ticks) {
      const a = X(tk.s), b = X(tk.e), w = b - a;
      out.push(`<line x1="${a.toFixed(1)}" y1="${y}" x2="${a.toFixed(1)}" y2="${y + th}" stroke="${o.line}" stroke-width="1"/>`);
      const lab = TS.label(tr.u, tr.n, tk.s, tk.e, o.P, tierName, idx);
      if (!lab || w < 7) continue;
      const fits = U.measure(lab, o.font) <= w - 4;
      const txt = fits ? lab : U.fit(lab, o.font, w - 4);
      if (!txt) continue;
      // label centred in its tick; for a tick cut by the screen edge it slides into the visible part (or is left out)
      let cx = (a + b) / 2;
      const lw = U.measure(txt, o.font);
      if (o.stick) {
        const va = o.vx0 != null ? o.vx0 : o.x0, vb = o.vx1 != null ? o.vx1 : o.x1;
        const l = Math.max(a, va), r = Math.min(b, vb);
        if (a < va || b > vb) { if (r - l < lw + 10) continue; cx = U.clamp(cx, l + lw / 2 + 4, r - lw / 2 - 4); }
      }
      out.push(`<text x="${cx.toFixed(1)}" y="${(y + th / 2 + 4).toFixed(1)}" text-anchor="middle" fill="${o.color}" style="font:${o.font}">${esc(txt)}</text>`);
    }
    out.push(`<line x1="${o.x0}" y1="${(y + th).toFixed(1)}" x2="${o.x1}" y2="${(y + th).toFixed(1)}" stroke="${o.line}"/>`);
  });
  return out.join('');
};

/* ---------------- SVG: batang, tautan, garis ---------------- */
// o: {P, rows, yOf(i), hOf(i), ppd, origin, x0, x1, i0, i1, mode, go (G.optsOf), pal (G.bars), font, text(color), sel:Set, rowIdx:Map(uid→i), noLinks, mute}
G.svg = o => {
  const P = o.P, go = o.go, pal = o.pal, out = [], top = [];
  const X = t => ((t - o.origin) / 1440) * o.ppd;
  const C = P._ctx;
  const font = o.font, small = o.fontSmall || font;
  const y0 = o.yOf(o.i0), y1 = o.yOf(o.i1) + o.hOf(o.i1);
  // shading of nonworking time (project calendar)
  if (go.shade && o.ppd >= 3.5 && C) {
    const d0 = Math.floor((o.origin + (o.x0 / o.ppd) * 1440) / 1440) - 1, d1 = Math.ceil((o.origin + (o.x1 / o.ppd) * 1440) / 1440) + 1;
    const cal = (P.view && P.view.ts && P.view.ts.shadeCal) || P.calendar;
    let run = null;
    for (let di = d0; di <= d1 + 1; di++) {
      const off = di <= d1 && C.dayWork(cal, di) === 0;
      if (off && run == null) run = di;
      if (!off && run != null) { const a = X(run * 1440), b = X(di * 1440); out.push(`<rect x="${a.toFixed(1)}" y="${y0}" width="${(b - a).toFixed(1)}" height="${y1 - y0}" fill="${pal.shade}"/>`); run = null; }
    }
  }
  // vertical grid lines at the top tier
  if (go.grid !== 'none' && o.tiers) {
    const tr = o.tiers[0];
    const tA = o.origin + (o.x0 / o.ppd) * 1440, tB = o.origin + (o.x1 / o.ppd) * 1440;
    for (const tk of TS.ticks(tr.u, tr.n, tA, tB, P, 2000)) { const a = X(tk.s).toFixed(1); out.push(`<line x1="${a}" y1="${y0}" x2="${a}" y2="${y1}" stroke="${pal.grid}" stroke-width="1"/>`); }
  }
  // rows: selection band, row lines, page breaks
  for (let i = o.i0; i <= o.i1; i++) {
    const r = o.rows[i];
    if (!r) continue;
    const y = o.yOf(i), h = o.hOf(i);
    if (o.sel && o.sel.has(r.key)) out.push(`<rect x="${o.x0}" y="${y}" width="${o.x1 - o.x0}" height="${h}" fill="var(--sel-band, rgba(74,143,217,.13))"/>`);
    if (go.rowLines) out.push(`<line x1="${o.x0}" y1="${y + h - 0.5}" x2="${o.x1}" y2="${y + h - 0.5}" stroke="${pal.grid}"/>`);
    if (go.pb && r.x && r.x.pb) out.push(`<line x1="${o.x0}" y1="${y + 0.5}" x2="${o.x1}" y2="${y + 0.5}" stroke="${pal.pb}" stroke-dasharray="6 4"/>`);
  }
  // today / status date
  const vline = (t, color, dash) => { if (t == null) return; const x = X(t); if (x < o.x0 - 2 || x > o.x1 + 2) return; out.push(`<line x1="${x.toFixed(1)}" y1="${y0}" x2="${x.toFixed(1)}" y2="${y1}" stroke="${color}" stroke-width="1.4" stroke-dasharray="${dash}"/>`); };
  if (go.today) vline(P.currentDate != null ? P.currentDate : U.now(), pal.today, '5 3');
  if (go.sd && P.statusDate != null) vline(P.statusDate, pal.status, '2 3');
  // bars
  const geo = new Map();
  const tx = (k, t) => (k ? F.text('task', k, t, P) : '');
  const isTracking = o.mode === 'tracking', isDetail = o.mode === 'detail', isLevel = o.mode === 'level';
  const bh = o.barFrac || go.barH || 0.5;
  for (let i = o.i0; i <= o.i1; i++) {
    const r = o.rows[i];
    if (!r || !r.x || r.kind === 'blank' || r.kind === 'group' || r.kind === 'asg') continue;
    const t = r.x;
    if (t.hideBar || t.start == null) continue;
    const y = o.yOf(i), h = o.hOf(i), cy = y + Math.min(h, o.rowH || h) / 2;
    const rowH = Math.min(h, o.rowH || h);
    let x1 = X(t.start), x2 = X(t.finish);
    if (go.round && !t.sum) { x1 = X(U.dayStart(t.start)); x2 = X(Math.ceil(t.finish / 1440) * 1440); }
    const ms = F.isMs(t);
    const crit = go.crit && t.crit;
    const bl = go.base != null || isTracking ? t.bl && t.bl[isTracking ? 0 : go.base] : null;
    let H = Math.max(6, Math.round(rowH * bh)), by = cy - H / 2;
    if (isTracking || (bl && !t.sum)) { H = Math.max(5, Math.round(rowH * 0.32)); by = cy - H - 0.5; }
    if (isLevel && t.pre) { H = Math.max(5, Math.round(rowH * 0.32)); by = cy + 0.5; }
    geo.set(t.uid, { x1, x2, cy, y: by, h: H, ms, i });
    if (x2 < o.x0 - 400 || x1 > o.x1 + 400) continue;
    const lateSt = go.late && !t.sum && t.status === 'late';
    let sty = t.inact ? pal.inact : t.mode === 'manual' && !t.sum ? pal.manual : crit ? pal.crit : lateSt ? pal.late : pal.task;
    if (t.color && !t.sum && !crit && !t.inact) sty = { fill: t.color, line: t.color, prog: shade(t.color, -0.35) };
    // baseline bar (below)
    if (bl && bl.s != null) {
      const a = X(bl.s), b = X(bl.f), bh2 = Math.max(4, Math.round(rowH * 0.24)), yy = isTracking || !t.sum ? cy + 1.5 : cy + H / 2 + 1;
      if (b - a < 1 && !t.sum) out.push(diamond(a, yy + bh2 / 2, bh2 / 2 + 2, pal.base.fill, pal.base.line));
      else out.push(`<rect x="${a.toFixed(1)}" y="${yy.toFixed(1)}" width="${Math.max(1, b - a).toFixed(1)}" height="${bh2}" fill="${pal.base.fill}" stroke="${pal.base.line}" stroke-width=".6" rx="1"/>`);
    }
    if (isLevel && t.pre && !t.sum) { const a = X(t.pre[0]), b = X(t.pre[1]); out.push(`<rect x="${a.toFixed(1)}" y="${(cy - H - 0.5).toFixed(1)}" width="${Math.max(1, b - a).toFixed(1)}" height="${H}" fill="${pal.pre.fill}" stroke="${pal.pre.line}" stroke-width=".6"/>`); }
    // slack (detail gantt / Format › Slack)
    if ((go.slack || isDetail) && !t.sum && t.ts > 0 && t.lf > t.finish) { const a = X(t.finish), b = X(t.lf); out.push(`<rect x="${a.toFixed(1)}" y="${(cy + H / 2 + 1).toFixed(1)}" width="${(b - a).toFixed(1)}" height="2" fill="${pal.slack.fill}"/>`); }
    if ((isDetail || isLevel) && t.ld) { const a = X(t.start - t.ld), b = x1; out.push(`<line x1="${a.toFixed(1)}" y1="${cy}" x2="${b.toFixed(1)}" y2="${cy}" stroke="${pal.pre.line}" stroke-width="1.5" stroke-dasharray="2 2"/>`); }
    if (t.sum) {
      const st = t.root ? pal.proj : pal.sum;
      const sh = Math.max(4, Math.round(rowH * 0.28)), sy = cy - sh / 2 - 1;
      out.push(`<path d="M${x1.toFixed(1)} ${sy}H${x2.toFixed(1)}V${(sy + sh + 4).toFixed(1)}L${(x2 - 4).toFixed(1)} ${(sy + sh).toFixed(1)}H${(x1 + 4).toFixed(1)}L${x1.toFixed(1)} ${(sy + sh + 4).toFixed(1)}Z" fill="${t.inact ? 'none' : st.fill}" stroke="${t.inact ? pal.inact.line : st.fill}" stroke-width="${t.inact ? 1 : 0.5}"/>`);
      if (t.pct > 0 && !t.inact) out.push(`<rect x="${x1.toFixed(1)}" y="${(sy + sh / 2 - 1).toFixed(1)}" width="${((x2 - x1) * t.pct / 100).toFixed(1)}" height="2.4" fill="${st.prog}" opacity=".85"/>`);
      geo.get(t.uid).y = sy; geo.get(t.uid).h = sh + 4;
    } else if (ms) {
      const s = Math.max(5, Math.round(rowH * 0.27));
      out.push(diamond(x1, cy, s, t.inact ? 'none' : crit ? pal.msCrit.fill : pal.ms.fill, t.inact ? pal.inact.line : 'none'));
      geo.get(t.uid).x1 = x1 - s; geo.get(t.uid).x2 = x1 + s;
    } else {
      const segs = t.segs || [[t.start, t.finish]];
      const pctX = t.pct > 0 ? progressX(t, segs, X) : null;
      segs.forEach(([s, e], k) => {
        const a = X(s), b = Math.max(X(e), a + 1.5);
        if (k > 0) { const pe = X(segs[k - 1][1]); out.push(`<line x1="${pe.toFixed(1)}" y1="${cy}" x2="${a.toFixed(1)}" y2="${cy}" stroke="${sty.line || sty.fill}" stroke-width="1.2" stroke-dasharray="2 3"/>`); }
        const dash = t.mode === 'manual' ? ' stroke-dasharray="3 2"' : '';
        out.push(`<rect x="${a.toFixed(1)}" y="${by.toFixed(1)}" width="${(b - a).toFixed(1)}" height="${H}" rx="2" fill="${sty.fill}" stroke="${sty.line || sty.fill}" stroke-width="${t.inact || t.mode === 'manual' ? 1 : 0.6}"${dash}/>`);
        if (pctX != null && !t.inact) { const pb = Math.min(b, pctX); if (pb > a) out.push(`<rect x="${a.toFixed(1)}" y="${(by + H / 2 - Math.max(2, H * 0.22)).toFixed(1)}" width="${(pb - a).toFixed(1)}" height="${Math.max(3, H * 0.44).toFixed(1)}" rx="1" fill="${sty.prog || sty.line}"/>`); }
      });
      if (t.mode === 'manual' && t.mStart == null && t.mFinish == null && !t.inact) { /* duration only: light bar already */ }
    }
    // deadline marker
    if (t.deadline != null) { const dx = X(t.deadline); out.push(`<path d="M${(dx - 4).toFixed(1)} ${(by - 6).toFixed(1)}h8l-4 6z" fill="${t.finish > t.deadline + 0.5 ? pal.crit.fill : pal.dead.fill}"/>`); }
    // bar texts
    if (!o.noText) {
      const set = t.sum ? go.text.sum : ms ? go.text.ms : go.text.task;
      const g = geo.get(t.uid);
      const col = t.inact ? '#9aa3ad' : o.text;
      const fmt = k => (k === 'start' || k === 'finish') && ms ? shortDate(t[k], go.dateFmt) : isTracking && k === 'pct' ? U.num(t.pct, 0) + '%' : tx(k, t);
      const rTxt = isTracking && !set.r ? U.num(t.pct, 0) + '%' : fmt(set.r);
      if (rTxt) top.push(`<text x="${(g.x2 + 5).toFixed(1)}" y="${(cy + 3.8).toFixed(1)}" fill="${col}" style="font:${small}">${esc(rTxt)}</text>`);
      if (set.l) { const s = fmt(set.l); if (s) top.push(`<text x="${(g.x1 - 5).toFixed(1)}" y="${(cy + 3.8).toFixed(1)}" text-anchor="end" fill="${col}" style="font:${small}">${esc(s)}</text>`); }
      if (set.t) { const s = fmt(set.t); if (s) top.push(`<text x="${((g.x1 + g.x2) / 2).toFixed(1)}" y="${(g.y - 2).toFixed(1)}" text-anchor="middle" fill="${col}" style="font:${small}">${esc(s)}</text>`); }
      if (set.i && !t.sum && !ms) { const s = U.fit(fmt(set.i), small, g.x2 - g.x1 - 6); if (s) top.push(`<text x="${(g.x1 + 3).toFixed(1)}" y="${(cy + 3.6).toFixed(1)}" fill="#fff" style="font:${small}">${esc(s)}</text>`); }
    }
  }
  // links
  const links = [];
  if (!o.noLinks && go.links !== 'none' && o.rowIdx) {
    for (const r of o.rows) {
      if (!r.x || r.kind !== 'task') continue;
      const t = r.x, ti = o.rowIdx.get(t.uid);
      for (const L of t.pred || []) {
        const pi = o.rowIdx.get(L.uid);
        if (pi == null || ti == null) continue;
        const lo = Math.min(pi, ti), hi = Math.max(pi, ti);
        if (hi < o.i0 - 1 || lo > o.i1 + 1) continue;
        const p = o.rows[pi].x;
        const gp = geo.get(p.uid) || geoOf(p, pi, o, X), gs = geo.get(t.uid) || geoOf(t, ti, o, X);
        if (!gp || !gs || p.hideBar || t.hideBar) continue;
        const crit = go.crit && p.crit && t.crit;
        const d = linkPath(L.type, gp, gs, o, go.links === 'straight');
        if (!d) continue;
        links.push({ pred: p, succ: t, L, pts: d.pts });
        out.push(`<path d="${d.d}" fill="none" stroke="${crit ? pal.linkCrit : pal.link}" stroke-width="1"/>` + arrow(d.end, d.dir, crit ? pal.linkCrit : pal.link));
      }
    }
  }
  // progress line through the status date
  if (go.progLine && P.statusDate != null) {
    const sx = X(P.statusDate), pts = [];
    for (let i = o.i0; i <= o.i1; i++) {
      const r = o.rows[i];
      if (!r || !r.x || r.kind !== 'task' || r.x.sum) continue;
      const t = r.x, g = geo.get(t.uid);
      if (!g) continue;
      let px = sx;
      if (t.start <= P.statusDate && t.pct < 100 && !F.isMs(t)) px = progressX(t, t.segs || [[t.start, t.finish]], X) || X(t.start);
      pts.push([px, g.cy]);
    }
    if (pts.length) out.push(`<polyline points="${[[sx, y0], ...pts, [sx, y1]].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="${pal.crit.fill}" stroke-width="1.3"/>`);
  }
  return { svg: out.join('') + top.join(''), geo, links };
};
function geoOf(t, i, o, X) {
  if (t.start == null) return null;
  const h = o.hOf(i), rowH = Math.min(h, o.rowH || h), cy = o.yOf(i) + rowH / 2;
  const ms = F.isMs(t), s = Math.max(5, Math.round(rowH * 0.27));
  const H = Math.max(6, Math.round(rowH * 0.5));
  return { x1: ms ? X(t.start) - s : X(t.start), x2: ms ? X(t.start) + s : X(t.finish), cy, y: cy - H / 2, h: H, ms, i };
}
function progressX(t, segs, X) {
  if (!(t.pct > 0)) return null;
  const C = AP.app.P._ctx;
  let need = (t.dur || 0) * t.pct / 100;
  for (const [s, e] of segs) {
    const w = t.el ? e - s : C.between(t.calId, s, e);
    if (need <= w + 0.5) return X(t.el ? s + need : C.add(t.calId, s, need));
    need -= w;
  }
  return X(segs[segs.length - 1][1]);
}
const diamond = (x, y, s, fill, line) => `<path d="M${x.toFixed(1)} ${(y - s).toFixed(1)}L${(x + s).toFixed(1)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y + s).toFixed(1)}L${(x - s).toFixed(1)} ${y.toFixed(1)}Z" fill="${fill}" stroke="${line}" stroke-width="1"/>`;
const arrow = (p, dir, c) => {
  const [x, y] = p, s = 3.6;
  const d = dir === 'r' ? `M${x} ${y}l-${s * 1.4} -${s}v${s * 2}z` : dir === 'l' ? `M${x} ${y}l${s * 1.4} -${s}v${s * 2}z` : dir === 'd' ? `M${x} ${y}l-${s} -${s * 1.4}h${s * 2}z` : `M${x} ${y}l-${s} ${s * 1.4}h${s * 2}z`;
  return `<path d="${d}" fill="${c}"/>`;
};
function linkPath(type, a, b, o, straight) {
  const down = b.cy > a.cy;
  const gapY = down ? Math.min(b.y, b.cy - 3) : Math.max(b.y + b.h, b.cy + 3);
  const f = v => v.toFixed(1);
  let pts, end, dir;
  if (straight) {
    const sx = type === 'SS' || type === 'SF' ? a.x1 : a.x2, ex = type === 'FF' || type === 'SF' ? b.x2 : b.x1;
    pts = [[sx, a.cy], [ex, b.cy]]; end = [ex, b.cy]; dir = ex >= sx ? 'r' : 'l';
  } else if (type === 'SS') {
    const x = Math.min(a.x1, b.x1) - 8;
    pts = [[a.x1, a.cy], [x, a.cy], [x, b.cy], [b.x1, b.cy]]; end = [b.x1, b.cy]; dir = 'r';
  } else if (type === 'FF') {
    const x = Math.max(a.x2, b.x2) + 8;
    pts = [[a.x2, a.cy], [x, a.cy], [x, b.cy], [b.x2, b.cy]]; end = [b.x2, b.cy]; dir = 'l';
  } else if (type === 'SF') {
    const x = a.x1 - 8, mid = down ? a.cy + (o.rowH || 24) / 2 : a.cy - (o.rowH || 24) / 2, x2 = b.x2 + 8;
    pts = [[a.x1, a.cy], [x, a.cy], [x, mid], [x2, mid], [x2, b.cy], [b.x2, b.cy]]; end = [b.x2, b.cy]; dir = 'l';
  } else {
    if (b.x1 >= a.x2 + 2) {
      // classic Project link: out of the bar's end, then down onto the start of the successor
      const x = Math.max(b.x1 + (b.ms ? (b.x2 - b.x1) / 2 : 5), a.x2 + 6);
      pts = [[a.x2, a.cy], [x, a.cy], [x, gapY]]; end = [x, gapY]; dir = down ? 'd' : 'u';
    } else {
      const x = a.x2 + 6, mid = down ? a.cy + (o.rowH || 24) / 2 : a.cy - (o.rowH || 24) / 2, x3 = b.x1 - 8;
      pts = [[a.x2, a.cy], [x, a.cy], [x, mid], [x3, mid], [x3, b.cy], [b.x1, b.cy]]; end = [b.x1, b.cy]; dir = 'r';
    }
  }
  const d = 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
  return { d, pts, end: end.map(v => +v.toFixed(1)), dir };
}
function shade(hex, k) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || '');
  if (!m) return hex;
  const c = [1, 2, 3].map(i => parseInt(m[i], 16)).map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
  return '#' + c.map(v => U.clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
G.shade = shade;

/* ---------------- panel Gantt di layar ---------------- */
class Chart {
  constructor(o) {
    this.o = o; this.app = o.app; this.mode = o.mode || 'gantt';
    this.host = el('div.chart');
    o.host.append(this.host);
    this.scroll = el('div.c-scroll', { tabIndex: -1 });
    this.space = el('div.c-space');
    this.headBox = el('div.c-head');
    this.layer = el('div.c-layer');
    this.space.append(this.headBox, this.layer);
    this.scroll.append(this.space);
    this.host.append(this.scroll);
    this.ppd = o.ppd || TS.DEF_PPD;
    this.rows = []; this.links = []; this.geo = new Map();
    this.paint = U.raf(() => this.draw());
    this.scroll.addEventListener('scroll', () => { this.paint(); if (this.o.onScroll && !this._syncing) this.o.onScroll(this.scroll.scrollTop); });
    this.bind();
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.scroll);
  }
  get P() { return this.app.P; }
  get rowH() { return this.o.rowH ? this.o.rowH() : 24; }
  get headH() { return this.o.headH ? this.o.headH() : 44; }
  setRows(rows) { this.rows = rows; this.rowIdx = new Map(); rows.forEach((r, i) => { if (r.x && r.kind === 'task') this.rowIdx.set(r.x.uid, i); }); }
  // time range of the chart
  range() {
    const P = this.P, R = P.root || {};
    let a = R.start != null ? R.start : P.start, b = R.finish != null ? R.finish : P.start;
    for (const t of P.tasks) if (t.bl && t.bl[0]) { a = Math.min(a, t.bl[0].s); b = Math.max(b, t.bl[0].f); }
    const now = U.today();
    if (now < a && a - now < 90 * 1440) a = now;
    if (now > b && now - b < 90 * 1440) b = now;
    const span = Math.max(7 * 1440, b - a);
    a = TS.floor('month', a - Math.max(14 * 1440, span * 0.06), P);
    b = TS.next('month', TS.floor('month', b + Math.max(60 * 1440, span * 0.5), P));
    return [a, b];
  }
  X(t) { return ((t - this.origin) / 1440) * this.ppd; }
  T(x) { return this.origin + (x / this.ppd) * 1440; }
  layout() {
    const [a, b] = this.range();
    const keepT = this.origin != null ? this.T(this.scroll.scrollLeft) : null;
    this.origin = a; this.end = b;
    this.W = Math.max(this.X(b), this.scroll.clientWidth);
    this.space.style.width = this.W + 'px';
    this.space.style.height = this.headH + this.rows.length * this.rowH + 'px';
    if (keepT != null && this._keepScroll !== false) { const x = this.X(keepT); if (Math.abs(this.scroll.scrollLeft - x) > 1) this.scroll.scrollLeft = x; }
  }
  render() { this.layout(); this.draw(); }
  setScrollTop(y) { if (Math.abs(this.scroll.scrollTop - y) < 1) return; this._syncing = true; this.scroll.scrollTop = y; this._syncing = false; this.paint(); }
  scrollToDate(t, align = 0.08) { const x = this.X(t) - this.scroll.clientWidth * align; this.scroll.scrollLeft = Math.max(0, x); this.paint(); }
  setZoom(ppd, anchorX) {
    ppd = U.clamp(ppd, TS.ZOOMS[0], TS.ZOOMS[TS.ZOOMS.length - 1]);
    const ax = anchorX == null ? this.scroll.clientWidth / 2 : anchorX;
    const t = this.T(this.scroll.scrollLeft + ax);
    this.ppd = ppd;
    this._keepScroll = false; this.layout(); this._keepScroll = true;
    this.scroll.scrollLeft = Math.max(0, this.X(t) - ax);
    this.draw();
    this.o.onZoom && this.o.onZoom(ppd);
  }
  zoomStep(d) {
    const Z = TS.ZOOMS;
    let i = Z.findIndex(z => z >= this.ppd - 1e-6);
    if (i < 0) i = Z.length - 1;
    if (d > 0 && Z[i] <= this.ppd + 1e-6) i++;
    if (d < 0) i--;
    this.setZoom(Z[U.clamp(i, 0, Z.length - 1)]);
  }
  fitRange(a, b) {
    const w = Math.max(200, this.scroll.clientWidth - 40);
    const days = Math.max(1, (b - a) / 1440);
    this.ppd = U.clamp(w / days, TS.ZOOMS[0], 960);
    this._keepScroll = false; this.layout(); this._keepScroll = true;
    this.scroll.scrollLeft = Math.max(0, this.X(a) - 20);
    this.draw();
    this.o.onZoom && this.o.onZoom(this.ppd);
  }
  draw() {
    if (this.origin == null) this.layout();
    const P = this.P;
    const sl = this.scroll.scrollLeft, st = this.scroll.scrollTop, cw = this.scroll.clientWidth, ch = this.scroll.clientHeight;
    const H = this.headH, rh = this.rowH;
    const cs = getComputedStyle(this.host);
    const text = cs.getPropertyValue('--text').trim() || '#1f2328', line = cs.getPropertyValue('--line').trim() || '#d0d7de', text2 = cs.getPropertyValue('--text-2').trim() || '#57606a';
    const fontS = '500 11px Inter, Arial, sans-serif';
    // header: sticky at the top, scrolls sideways with the chart; drawn for the visible part + overscan
    const PADX = 260, PADY = 10 * rh;
    const ox = Math.max(0, sl - PADX), w = cw + 2 * PADX;
    const tiers = TS.tiers(P, this.ppd);
    this.headBox.style.height = H + 'px';
    this.headBox.innerHTML = `<svg style="position:absolute;left:${ox}px;top:0" width="${w}" height="${H}" viewBox="${ox} 0 ${w} ${H}">${G.scaleSVG({ P, ppd: this.ppd, origin: this.origin, x0: ox, x1: ox + w, h: H, tiers, font: fontS, color: text2, line, stick: true, vx0: sl, vx1: sl + cw })}</svg>`;
    // body layer in content coordinates (moves natively while scrolling, redrawn next frame)
    const oy = Math.max(0, st - PADY), h = Math.max(0, ch - H) + 2 * PADY;
    const i0 = Math.max(0, Math.floor(oy / rh)), i1 = Math.min(this.rows.length - 1, Math.ceil((oy + h) / rh));
    this.layer.style.left = ox + 'px'; this.layer.style.top = H + oy + 'px';
    this.layer.style.width = w + 'px'; this.layer.style.height = h + 'px';
    if (this.rows.length === 0 || i1 < i0) { this.layer.innerHTML = ''; this.geo = new Map(); this.links = []; return; }
    const go = G.optsOf(P);
    const res = G.svg({ P, rows: this.rows, yOf: i => i * rh, hOf: () => rh, rowH: rh, ppd: this.ppd, origin: this.origin, x0: ox, x1: ox + w, i0, i1, mode: this.mode, go, pal: G.bars(P), font: fontS, fontSmall: '11px Inter, Arial, sans-serif', text, sel: this.o.sel ? this.o.sel() : null, rowIdx: this.rowIdx, tiers });
    this.geo = res.geo; this.links = res.links;
    this.layer.innerHTML = `<svg width="${w}" height="${h}" viewBox="${ox} ${oy} ${w} ${h}">${res.svg}${this.dragSVG || ''}</svg>`;
  }

  /* ---------------- interaksi ---------------- */
  pos(e) { const p = U.rel(e, this.scroll); return { x: p.x + this.scroll.scrollLeft, y: p.y + this.scroll.scrollTop - this.headH, sx: p.x, sy: p.y }; }
  hitBar(p) {
    const rh = this.rowH, i = Math.floor(p.y / rh);
    const r = this.rows[i];
    if (!r || !r.x || r.kind !== 'task') return { i, r };
    const t = r.x, g = this.geo.get(t.uid);
    if (!g) return { i, r, t };
    const inY = p.y >= g.y - 4 && p.y <= g.y + g.h + 4;
    if (!inY || p.x < g.x1 - 4 || p.x > g.x2 + 6) return { i, r, t };
    let part = 'move';
    if (t.sum) part = 'sum';
    else if (g.ms) part = 'move';
    else if (p.x >= g.x2 - 6) part = 'size';
    else {
      const px = t.pct > 0 ? this.X(t.start) + (g.x2 - g.x1) * t.pct / 100 : g.x1;
      if (Math.abs(p.x - px) <= 4 && (t.pct > 0 || p.x - g.x1 <= 5)) part = 'pct';
    }
    return { i, r, t, g, part, bar: true };
  }
  hitLink(p) {
    let best = null, bd = 5;
    for (const L of this.links) for (let k = 1; k < L.pts.length; k++) {
      const [a, b] = [L.pts[k - 1], L.pts[k]];
      const d = segDist(p.x, p.y, a[0], a[1], b[0], b[1]);
      if (d < bd) { bd = d; best = L; }
    }
    return best;
  }
  bind() {
    const s = this.scroll;
    s.addEventListener('pointerdown', e => this.onDown(e));
    s.addEventListener('pointermove', e => this.onHover(e));
    s.addEventListener('pointerleave', () => { UI.card(null); s.style.cursor = ''; });
    s.addEventListener('dblclick', e => {
      const p = this.pos(e);
      if (p.y < 0) { this.app.cmd('timescaleDlg'); return; }
      const h = this.hitBar(p);
      if (h.bar) { this.o.onDblTask && this.o.onDblTask(h.t); return; }
      const L = this.hitLink(p);
      if (L) { this.app.cmd('linkDlg', L.pred, L.succ); return; }
      if (h.t) this.o.onDblTask && this.o.onDblTask(h.t);
    });
    s.addEventListener('contextmenu', e => {
      e.preventDefault();
      const p = this.pos(e);
      if (p.y < 0) { this.o.onHeadCtx && this.o.onHeadCtx(e); return; }
      const h = this.hitBar(p);
      if (h.t) { this.o.onSelectRow && this.o.onSelectRow(h.i, true); this.o.onBarCtx && this.o.onBarCtx(e, h.t, !!h.bar); return; }
      const L = this.hitLink(p);
      if (L) { this.app.linkMenu(e, L.pred, L.succ); return; }
      this.o.onBgCtx && this.o.onBgCtx(e);
    });
    s.addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const p = U.rel(e, this.scroll);
      const f = Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022));
      this.setZoom(this.ppd * f, p.x);
    }, { passive: false });
  }
  onHover(e) {
    if (this.drag || e.pointerType === 'touch') return;
    const p = this.pos(e);
    if (p.y < 0) { this.scroll.style.cursor = ''; UI.card(null); return; }
    const h = this.hitBar(p);
    const cur = !h.bar ? (this.hitLink(p) ? 'pointer' : '') : h.part === 'size' ? 'ew-resize' : h.part === 'pct' ? 'col-resize' : h.part === 'sum' ? 'default' : 'grab';
    this.scroll.style.cursor = this.app.readOnly && cur ? 'default' : cur;
    if (h.bar) {
      if (this._hov !== h.t.uid) { this._hov = h.t.uid; clearTimeout(this._hovT); UI.card(null); this._hovT = setTimeout(() => this.showCard(h.t, e), 320); }
      else if (document.querySelector('.hcard.show')) this.showCard(h.t, e);
    } else { const L = this.hitLink(p); if (L) { if (this._hov !== 'L' + L.pred.uid + L.succ.uid) { this._hov = 'L' + L.pred.uid + L.succ.uid; this.showLinkCard(L, e); } } else { this._hov = null; clearTimeout(this._hovT); UI.card(null); } }
  }
  showCard(t, e) {
    const P = this.P, z = U.zoom();
    const rows = [['Mulai', F.text('task', 'start', t, P)], ['Selesai', F.text('task', 'finish', t, P)], ['Durasi', F.text('task', 'dur', t, P)]];
    if (t.pct) rows.push(['% Selesai', U.num(t.pct, 0) + '%']);
    const rn = F.text('task', 'rn', t, P); if (rn) rows.push(['Sumber daya', rn]);
    if (!t.sum) rows.push(['Slack total', F.text('task', 'ts', t, P)]);
    if (t.bl && t.bl[0]) rows.push(['Garis dasar', U.fmtDate(t.bl[0].s, 'dd/mm/yy') + ' – ' + U.fmtDate(t.bl[0].f, 'dd/mm/yy')]);
    const kind = t.sum ? 'Ringkasan' : F.isMs(t) ? 'Tonggak' : t.crit ? 'Tugas kritis' : t.mode === 'manual' ? 'Tugas manual' : 'Tugas';
    UI.card(el('div', el('div.hc-k', kind + (t.id ? ' · ID ' + t.id : '')), el('div.hc-t', t.name || '(tanpa nama)'), el('table', ...rows.map(([a, b]) => el('tr', el('td', a), el('td', b))))), e.clientX / z, e.clientY / z);
  }
  showLinkCard(L, e) {
    const P = this.P, z = U.zoom();
    const lag = D.fmtLag(L.L, P.opts);
    UI.card(el('div', el('div.hc-k', 'Tautan tugas'), el('div.hc-t', D.TYPE_L[L.L.type] + (lag ? ' ' + lag : '')), el('table', el('tr', el('td', 'Dari'), el('td', L.pred.id + ' ' + L.pred.name)), el('tr', el('td', 'Ke'), el('td', L.succ.id + ' ' + L.succ.name))), el('div.hc-n', 'Klik dua kali untuk mengubah')), e.clientX / z, e.clientY / z);
  }
  onDown(e) {
    if (e.button !== 0) return;
    UI.card(null); clearTimeout(this._hovT);
    const p = this.pos(e);
    if (p.y < 0) return;
    const h = this.hitBar(p);
    if (h.i >= 0 && h.i < this.rows.length) this.o.onSelectRow && this.o.onSelectRow(h.i, false, e);
    const ro = this.app.readOnly;
    if (!h.bar || ro || h.part === 'sum' || e.pointerType === 'touch' && !this._touchArmed) {
      // pan on empty area (mouse)
      if (e.pointerType !== 'touch') this.pan(e);
      return;
    }
    e.preventDefault();
    const t = h.t, x0 = p.x, y0 = p.y, P = this.P;
    const t0 = { start: t.start, finish: t.finish, pct: t.pct };
    let mode = h.part, moved = false, target = null;
    this.drag = true;
    const snap = v => { const step = this.ppd >= 40 ? 60 : this.ppd >= 12 ? 1440 / 2 : 1440; return Math.round(v / step) * step; };
    const mv = ev => {
      const q = this.pos(ev), dx = q.x - x0, dy = q.y - y0;
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      if (!moved && mode === 'move' && Math.abs(dy) > Math.abs(dx) * 1.3 && Math.abs(dy) > 6) mode = 'link';
      moved = true;
      const g = h.g;
      if (mode === 'link') {
        const hh = this.hitBar(q);
        target = hh.t && hh.t !== t && !hh.t.sum ? hh.t : hh.t && hh.t.sum && hh.t !== t ? hh.t : null;
        this.dragSVG = `<line x1="${(g.x2).toFixed(1)}" y1="${g.cy}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="#2f6fb5" stroke-width="1.6" stroke-dasharray="4 3"/>` + (target ? `<rect x="${this.X(target.start) - 3}" y="${hh.i * this.rowH + 2}" width="${this.X(target.finish) - this.X(target.start) + 6}" height="${this.rowH - 4}" fill="none" stroke="#2f6fb5" stroke-width="1.5" rx="3"/>` : '');
        UI.card(el('div', el('div.hc-k', 'Tautkan tugas'), el('div.hc-t', target ? 'Dari ' + t.id + ' ke ' + target.id + ' (Selesai-ke-Mulai)' : 'Lepaskan di atas tugas penerus')), ev.clientX / U.zoom(), ev.clientY / U.zoom());
      } else {
        const dt = snap((dx / this.ppd) * 1440);
        let s = t0.start, f = t0.finish;
        if (mode === 'move') { s = t0.start + dt; f = t0.finish + dt; }
        if (mode === 'size') f = Math.max(t0.start + 60, t0.finish + dt);
        const a = this.X(s), b = this.X(f);
        if (mode === 'pct') {
          const pc = U.clamp(Math.round(((q.x - g.x1) / Math.max(1, g.x2 - g.x1)) * 100), 0, 100);
          this.dragSVG = `<rect x="${g.x1}" y="${g.y + g.h / 2 - 2}" width="${(g.x2 - g.x1) * pc / 100}" height="4" fill="#123"/>`;
          this._pct = pc;
          UI.card(el('div', el('div.hc-k', 'Kemajuan'), el('div.hc-t', pc + '% selesai')), ev.clientX / U.zoom(), ev.clientY / U.zoom());
        } else {
          this.dragSVG = F.isMs(t) ? diamond(a, g.cy, 7, 'none', '#2f6fb5') : `<rect x="${a.toFixed(1)}" y="${g.y - 1}" width="${Math.max(2, b - a).toFixed(1)}" height="${g.h + 2}" fill="none" stroke="#2f6fb5" stroke-width="1.5" stroke-dasharray="4 2" rx="2"/>`;
          const fmt = v => U.fmtDate(v, P.opts.dateFmt + (this.ppd >= 40 ? ' HH.MM' : ''));
          UI.card(el('div', el('div.hc-k', mode === 'move' ? 'Pindahkan tugas' : 'Ubah durasi'), el('div.hc-t', t.name), el('table', el('tr', el('td', 'Mulai'), el('td', fmt(P._ctx.next(t.calId, s)))), el('tr', el('td', 'Selesai'), el('td', fmt(mode === 'size' ? P._ctx.prevEnd(t.calId, f) : f))))), ev.clientX / U.zoom(), ev.clientY / U.zoom());
          this._drag = { s, f };
        }
      }
      this.draw();
      // auto scroll near edges
      const sr = this.scroll.getBoundingClientRect();
      if (ev.clientX > sr.right - 24) this.scroll.scrollLeft += 14; else if (ev.clientX < sr.left + 16) this.scroll.scrollLeft -= 14;
      if (ev.clientY > sr.bottom - 18) this.scroll.scrollTop += 12; else if (ev.clientY < sr.top + this.headH + 10) this.scroll.scrollTop -= 12;
    };
    const up = () => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      this.drag = false; this.dragSVG = ''; UI.card(null);
      if (!moved) { this.draw(); return; }
      if (mode === 'link') { if (target) this.app.cmd('linkPair', t, target); else this.draw(); }
      else if (mode === 'pct') this.app.cmd('setPct', [t], this._pct);
      else if (this._drag) {
        const { s, f } = this._drag;
        if (mode === 'move') this.app.cmd('dragMove', t, s);
        else this.app.cmd('dragSize', t, f);
      }
      this._drag = null;
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  pan(e) {
    const x0 = e.clientX, y0 = e.clientY, l0 = this.scroll.scrollLeft, t0 = this.scroll.scrollTop, z = U.zoom();
    let moved = false;
    const mv = ev => { const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z; if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return; moved = true; this.scroll.style.cursor = 'grabbing'; this.scroll.scrollLeft = l0 - dx; this.scroll.scrollTop = t0 - dy; };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); this.scroll.style.cursor = ''; };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
}
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = U.clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
AP.Chart = Chart;
})();
