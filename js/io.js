// Amatu Project — impor & ekspor:
// - Excel .xlsx: lembar kerja dipilih otomatis (Tugas, Gantt berwarna, Sumber Daya, Penugasan, Penggunaan, Ringkasan,
//   Kalender) + pengaturan cetak di dalam file (kertas, orientasi, muat selebar 1 halaman, baris judul diulang,
//   pemisah halaman rapi yang tidak memotong grup tugas, nomor halaman, panel beku, AutoFilter, kerangka/grouping);
// - Microsoft Project XML (MSPDI) ekspor & impor; CSV; gambar PNG halaman; kalender .ics; file .amproj (JSON).
(() => {
'use strict';
const AP = window.AP, U = AP.U, UI = AP.UI, M = AP.M, S = AP.S, F = AP.F, D = AP.D, V = AP.V, Cal = AP.Cal, Store = AP.Store, { el, icon, esc } = U;
const IO = AP.IO = {};
const fname = (P, ext) => U.safeName(P.name) + '.' + ext;

/* ======================= CSV ======================= */
const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
IO.exportCSV = app => {
  const P = app.P, v = app.view;
  let kind = 'task', cols, rows;
  if (v && v.grid) { kind = v.grid.kind === 'res' ? 'res' : 'task'; cols = v.grid.cols.filter(c => c.k !== 'ind' && c.k !== 'mode'); rows = v.grid.rows.filter(r => r.x && r.kind !== 'blank' && r.kind !== 'group' && r.kind !== 'asg' && !r.x.root); }
  else { cols = F.TABLES.task.export.cols.map(c => ({ k: c[0] })); rows = P.tasks.map(t => ({ kind: 'task', x: t })); }
  const head = ['ID', ...cols.map(c => F.title(c.k, P, kind)), ...(kind === 'task' ? ['Tingkat Kerangka'] : [])];
  const lines = [head.map(csvCell).join(',')];
  for (const r of rows) lines.push([r.x.id, ...cols.map(c => F.text(kind, c.k, r.x, P)), ...(kind === 'task' ? [r.x.lvl] : [])].map(csvCell).join(','));
  U.download('\ufeff' + lines.join('\r\n'), fname(P, 'csv'), 'text/csv;charset=utf-8');
  UI.toast('CSV diunduh (' + rows.length + ' baris)');
};

/* ======================= JSON (.amproj) ======================= */
IO.exportJSON = app => {
  const data = { format: 'amatu-project', v: 1, exported: new Date().toISOString(), project: M.clean(app.P) };
  delete data.project.lock;
  U.download(JSON.stringify(data), fname(app.P, 'amproj'), 'application/json');
  UI.toast('File .amproj diunduh');
};
IO.parseJSON = text => {
  const d = JSON.parse(text);
  const P = d.project || d;
  if (!P || !Array.isArray(P.tasks)) throw 'Bukan file Amatu Project';
  return M.fix(P);
};

/* ======================= iCalendar ======================= */
IO.exportICS = app => {
  const P = app.P;
  const dt = t => { const a = U.ymd(t); return '' + a.y + U.p2(a.m + 1) + U.p2(a.d); };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const fold = s => s.replace(/(.{70})/g, '$1\r\n ');
  const escI = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Amatu//Amatu Project//ID', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + escI(P.name)];
  let n = 0;
  for (const t of P.tasks) {
    if (t.sum || t.inact) continue;
    const end = F.isMs(t) ? U.dayStart(t.start) + 1440 : Math.ceil(t.finish / 1440) * 1440;
    L.push('BEGIN:VEVENT', 'UID:' + P.id + '-' + t.uid + '@amatu-project', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + dt(t.start), 'DTEND;VALUE=DATE:' + dt(end),
      fold('SUMMARY:' + escI((F.isMs(t) ? '◆ ' : '') + t.name)), fold('DESCRIPTION:' + escI([P.name, 'Durasi: ' + F.text('task', 'dur', t, P), 'Sumber daya: ' + F.text('task', 'rn', t, P), t.notes].filter(Boolean).join('\n'))), 'END:VEVENT');
    n++;
  }
  L.push('END:VCALENDAR');
  U.download(L.join('\r\n'), fname(P, 'ics'), 'text/calendar');
  UI.toast(n + ' tugas diekspor ke kalender (.ics)');
};

/* ======================= gambar PNG ======================= */
IO.pagesToPNG = async (app, doc, base) => {
  const host = el('div', { style: { position: 'fixed', left: '-99999px', top: '0' } });
  host.innerHTML = doc.body;
  document.body.append(host);
  const secs = [...host.querySelectorAll('section.pg')];
  const blobs = [];
  try {
    for (const [i, sec] of secs.entries()) {
      const svg = sec.querySelector('.pg-z > svg');
      if (!svg) continue;
      const L = doc.all.find(x => !x.L.empty) || {};
      const z = parseFloat(sec.querySelector('.pg-z').style.zoom) || 1;
      const w = svg.width.baseVal.value, h = svg.height.baseVal.value;
      const k = 2 * z, pad = 24;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * k + pad * 2); cv.height = Math.ceil(h * k + pad * 2);
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      const src = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('SVG tidak dapat digambar')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); });
      ctx.drawImage(img, pad, pad, w * k, h * k);
      blobs.push(await new Promise(r => cv.toBlob(r, 'image/png')));
      void L; void i;
    }
  } finally { host.remove(); }
  if (!blobs.length) { UI.toast('Tidak ada halaman bergambar'); return; }
  if (blobs.length === 1) { U.download(blobs[0], base + '.png', 'image/png'); return; }
  const JSZip = await U.lib('jszip');
  const zip = new JSZip();
  blobs.forEach((b, i) => zip.file(base + ' - halaman ' + (i + 1) + '.png', b));
  U.download(await zip.generateAsync({ type: 'blob' }), base + ' (PNG).zip', 'application/zip');
  UI.toast(blobs.length + ' halaman disimpan sebagai PNG (zip)');
};
IO.exportPNG = async app => {
  try {
    UI.toast('Membuat gambar…', { ms: 1500 });
    const doc = AP.Pg.printDoc(app, { items: [{ view: app.viewId, scope: 'view' }], over: { title: 'first', legend: 'last', num: false } });
    await IO.pagesToPNG(app, doc, U.safeName(app.P.name) + ' - ' + AP.Pg.itemName(app.viewId));
  } catch (e) { UI.toast('Gagal: ' + (e.message || e), { kind: 'bad' }); }
};

/* ======================= Excel (.xlsx) ======================= */
const XL = {
  head: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F7A55' } }, alignment: { vertical: 'center', wrapText: true }, border: { bottom: { style: 'thin', color: { rgb: '0A5C3F' } } } },
  sum: { font: { bold: true }, fill: { fgColor: { rgb: 'EEF1F5' } } },
  thin: { style: 'thin', color: { rgb: 'D9DEE4' } },
};
const cellBorder = () => ({ top: XL.thin, bottom: XL.thin, left: XL.thin, right: XL.thin });
const colL = c => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const toExcelDate = t => t / 1440 + 25569;   // minutes → Excel serial (local wall clock)
// sheet candidates, chosen automatically from what the project contains
IO.xlsxSheets = app => {
  const P = app.P;
  const nRes = P.res.length, nAsg = P.asg.length, over = P.res.filter(r => r.over).length;
  return [
    { id: 'tasks', t: 'Tugas', on: true, why: P.tasks.length + ' tugas, kolom tabel ' + (F.TABLES.task[V.tableOf(P, app.viewId)] || F.TABLES.task.entry).t },
    { id: 'gantt', t: 'Gantt', on: P.tasks.length > 0, why: 'batang berwarna per periode, siap cetak' },
    { id: 'res', t: 'Sumber Daya', on: nRes > 0, why: nRes ? nRes + ' sumber daya' : 'belum ada sumber daya' },
    { id: 'asg', t: 'Penugasan', on: nAsg > 0, why: nAsg ? nAsg + ' penugasan' : 'belum ada penugasan' },
    { id: 'rusage', t: 'Penggunaan SD', on: over > 0, why: over ? over + ' sumber daya teralokasi berlebih' : 'kerja per sumber daya per periode' },
    { id: 'tusage', t: 'Penggunaan Tugas', on: false, why: 'kerja per tugas per periode' },
    { id: 'summary', t: 'Ringkasan', on: true, why: 'informasi & statistik proyek' },
    { id: 'cal', t: 'Kalender', on: P.cals.some(c => (c.exc || []).length), why: 'hari libur & pengecualian' },
  ];
};
IO.xlsxDialog = app => {
  const P = app.P;
  const sheets = IO.xlsxSheets(app);
  const o = { cols: 'view', unit: 'auto', sum: true, group: true, paper: 'a4', orient: 'auto', breaks: true, fit: true, freeze: true };
  const list = el('div.xl-list', ...sheets.map(s => UI.checkbox(s.t + ' — ' + s.why, s.on, v => { s.on = v; })));
  UI.dialog({ title: 'Ekspor ke Excel (.xlsx)', width: 'min(620px, 100%)', body: el('div',
    el('div.lbl', 'Lembar kerja (dipilih otomatis menurut isi proyek)'), list,
    el('div.fgrid',
      UI.field('Kolom lembar Tugas', UI.select([['view', 'Tabel tampilan aktif'], ['full', 'Lengkap (semua kolom penting)']], o.cols, v => { o.cols = v; })),
      UI.field('Satuan Gantt / penggunaan', UI.select([['auto', 'Otomatis'], ['day', 'Hari'], ['week', 'Minggu'], ['month', 'Bulan']], o.unit, v => { o.unit = v; }))),
    el('div.fgrid',
      UI.field('Kertas saat dicetak dari Excel', UI.select(Object.entries(AP.Pg.PAPER).filter(([k]) => ['a4', 'f4', 'letter', 'legal', 'a3'].includes(k)).map(([k, v]) => [k, v.n]), o.paper, v => { o.paper = v; })),
      UI.field('Orientasi', UI.select([['auto', 'Otomatis'], ['portrait', 'Potret'], ['landscape', 'Lanskap']], o.orient, v => { o.orient = v; }))),
    el('div.checks',
      UI.checkbox('Sertakan tugas ringkasan + kerangka (grup baris di Excel)', true, v => { o.sum = v; o.group = v; }),
      UI.checkbox('Pemisah halaman otomatis — grup tugas tidak terpotong, judul kolom diulang', true, v => { o.breaks = v; }),
      UI.checkbox('Muat selebar 1 halaman saat dicetak', true, v => { o.fit = v; }),
      UI.checkbox('Bekukan baris judul & kolom nama', true, v => { o.freeze = v; }))),
    buttons: [{ label: 'Batal' }, { label: 'Ekspor', primary: true, icon: 'download', run: async () => {
      const on = sheets.filter(s => s.on);
      if (!on.length) { UI.toast('Pilih minimal satu lembar kerja'); return false; }
      try { UI.toast('Menyiapkan file Excel…', { ms: 1500 }); await IO.exportXLSX(app, on.map(s => s.id), o); }
      catch (e) { console.error(e); UI.toast('Gagal ekspor: ' + (e.message || e), { kind: 'bad', ms: 6000 }); return false; }
    } }] });
};
IO.exportXLSX = async (app, ids, o) => {
  const XLSX = await U.lib('xlsx');
  const P = app.P;
  const wb = XLSX.utils.book_new();
  const meta = [];   // per sheet: {name, rows (excel rows count), header rows, breaks, orient, widthPx}
  const add = (name, ws, m) => { XLSX.utils.book_append_sheet(wb, ws, name); meta.push({ name, ...m }); };
  const tasksAll = o.sum ? P.tasks : P.tasks.filter(t => !t.sum);
  const unitOf = () => { if (o.unit !== 'auto') return o.unit; const days = (P.root.finish - P.root.start) / 1440; return days <= 45 ? 'day' : days <= 300 ? 'week' : 'month'; };
  // ---- Tugas
  if (ids.includes('tasks')) {
    const cols = o.cols === 'view' && app.view && app.view.grid && app.view.grid.kind !== 'res' ? app.view.grid.cols.filter(c => c.k !== 'ind' && c.k !== 'mode').map(c => c.k) : ['wbs', 'name', 'dur', 'start', 'finish', 'pred', 'rn', 'pct', 'work', 'cost', 'bStart', 'bFinish', 'ts', 'crit', 'status', 'notes'];
    const head = ['ID', ...cols.map(k => F.title(k, P))];
    const aoa = [head];
    const rowsMeta = [];
    for (const t of tasksAll) {
      aoa.push([t.id, ...cols.map(k => xlValue(P, 'task', k, t))]);
      rowsMeta.push(t);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    styleTable(XLSX, ws, aoa, cols, 'task', rowsMeta, o, P);
    const widths = [6, ...cols.map(k => xlWidth(k, aoa, cols.indexOf(k) + 1))];
    ws['!cols'] = widths.map(w => ({ wch: w }));
    if (o.group) ws['!rows'] = [{ hpt: 30 }, ...rowsMeta.map(t => ({ level: Math.max(0, Math.min(7, t.lvl - 1)) }))];
    else ws['!rows'] = [{ hpt: 30 }];
    ws['!autofilter'] = { ref: 'A1:' + colL(head.length - 1) + aoa.length };
    ws['!margins'] = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
    const wPx = widths.reduce((s, w) => s + w * 7 + 5, 0);
    add('Tugas', ws, { header: 1, freeze: { r: 1, c: 2 }, breaks: o.breaks ? xlBreaks(rowsMeta, 1, o, wPx) : [], widthPx: wPx });
  }
  // ---- Gantt (warna sel)
  if (ids.includes('gantt')) {
    const unit = unitOf();
    const a = AP.TS.floor(unit, P.root.start, P), b = AP.TS.next(unit, AP.TS.floor(unit, P.root.finish, P));
    const ticks = AP.TS.ticks(unit, 1, a, b, P, 400);
    const top = unit === 'day' ? 'week' : unit === 'week' ? 'month' : 'quarter';
    const fixed = ['ID', 'Nama Tugas', 'Durasi', 'Mulai', 'Selesai', '% Selesai'];
    const r1 = [...fixed.map(() => ''), ...ticks.map(tk => AP.TS.labels(top, AP.TS.floor(top, tk.s, P), AP.TS.next(top, AP.TS.floor(top, tk.s, P)), P, 'top')[unit === 'day' ? 3 : 2])];
    const r2 = [...fixed, ...ticks.map(tk => unit === 'day' ? U.ymd(tk.s).d : unit === 'week' ? U.ymd(tk.s).d + '/' + (U.ymd(tk.s).m + 1) : U.MON_S[U.ymd(tk.s).m])];
    // top labels only on the first period of each group
    let last = null;
    for (let i = 0; i < ticks.length; i++) { const k = AP.TS.floor(top, ticks[i].s, P); if (k === last) r1[fixed.length + i] = ''; last = k; }
    const aoa = [r1, r2];
    const pal = AP.G.bars(P);
    const hex = c => String(c || '#4a8fd9').replace('#', '').toUpperCase().slice(0, 6);
    for (const t of tasksAll) aoa.push([t.id, ('   '.repeat(Math.max(0, t.lvl - 1))) + t.name, F.text('task', 'dur', t, P), toExcelDate(t.start), toExcelDate(t.finish), (t.pct || 0) / 100, ...ticks.map(() => '')]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let c = 0; c < r2.length; c++) for (const r of [0, 1]) { const ref = colL(c) + (r + 1); if (!ws[ref]) ws[ref] = { t: 's', v: '' }; ws[ref].s = { ...XL.head, alignment: { horizontal: c >= fixed.length ? 'center' : 'left', vertical: 'center' } }; }
    tasksAll.forEach((t, i) => {
      const R = i + 3;
      const base = t.sum ? XL.sum : {};
      for (let c = 0; c < fixed.length; c++) { const ref = colL(c) + R; if (!ws[ref]) continue; ws[ref].s = { ...base, border: cellBorder(), numFmt: c === 3 || c === 4 ? 'dd/mm/yy' : c === 5 ? '0%' : undefined }; }
      const fill = t.sum ? pal.sum.fill : F.isMs(t) ? pal.ms.fill : t.crit ? pal.crit.fill : t.color || pal.task.fill;
      const prog = t.sum ? pal.sum.prog : t.crit ? pal.crit.prog : pal.task.prog;
      const done = t.pct > 0 ? t.start + (t.finish - t.start) * t.pct / 100 : null;
      ticks.forEach((tk, k) => {
        const ref = colL(fixed.length + k) + R;
        const on = F.isMs(t) ? t.start >= tk.s && t.start < tk.e : t.start < tk.e && t.finish > tk.s;
        const st = { border: { left: { style: 'hair', color: { rgb: 'E5E8EC' } }, bottom: { style: 'hair', color: { rgb: 'E5E8EC' } } } };
        const we = unit === 'day' && P._ctx.dayWork(P.calendar, Math.floor(tk.s / 1440)) === 0;
        if (we) st.fill = { fgColor: { rgb: 'F1F3F5' } };
        if (on) {
          if (F.isMs(t)) { ws[ref] = { t: 's', v: '◆', s: { ...st, font: { color: { rgb: hex(fill) }, bold: true }, alignment: { horizontal: 'center' } } }; return; }
          st.fill = { fgColor: { rgb: hex(done != null && tk.s < done ? prog : fill) } };
        }
        ws[ref] = { t: 's', v: '', s: st };
      });
    });
    ws['!cols'] = [{ wch: 5 }, { wch: 34 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 7 }, ...ticks.map(() => ({ wch: unit === 'day' ? 3 : unit === 'week' ? 5 : 5 }))];
    ws['!rows'] = [{ hpt: 18 }, { hpt: 18 }, ...(o.group ? tasksAll.map(t => ({ level: Math.max(0, Math.min(7, t.lvl - 1)) })) : [])];
    ws['!margins'] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
    const wPx = 5 * 7 + 34 * 7 + 9 * 21 + 7 * 7 + ticks.length * (unit === 'day' ? 3 : 5) * 7;
    add('Gantt', ws, { header: 2, freeze: { r: 2, c: 2 }, breaks: o.breaks ? xlBreaks(tasksAll, 2, o, wPx) : [], widthPx: wPx, land: true });
  }
  // ---- Sumber Daya
  if (ids.includes('res') && P.res.length) {
    const cols = ['name', 'type', 'mat', 'ini', 'group', 'max', 'std', 'ovt', 'costUse', 'accrue', 'work', 'cost', 'peak', 'email'];
    const aoa = [['ID', ...cols.map(k => F.title(k, P, 'res'))]];
    for (const r of P.res) aoa.push([r.id, ...cols.map(k => xlValue(P, 'res', k, r))]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    styleTable(XLSX, ws, aoa, cols, 'res', P.res, o, P);
    ws['!cols'] = [{ wch: 5 }, ...cols.map((k, i) => ({ wch: xlWidth(k, aoa, i + 1) }))];
    ws['!autofilter'] = { ref: 'A1:' + colL(cols.length) + aoa.length };
    add('Sumber Daya', ws, { header: 1, freeze: { r: 1, c: 2 }, breaks: [], widthPx: cols.length * 90 });
  }
  // ---- Penugasan
  if (ids.includes('asg') && P.asg.length) {
    const aoa = [['ID Tugas', 'Nama Tugas', 'Sumber Daya', 'Jenis', 'Unit / Jumlah', 'Kerja (jam)', 'Biaya', 'Mulai', 'Selesai']];
    const rowsT = [];
    for (const t of P.tasks) for (const a of P.asgT.get(t.uid) || []) {
      const r = P.resByUid.get(a.r);
      aoa.push([t.id, t.name, r.name, (F.RTYPES.find(x => x[0] === r.type) || ['', ''])[1], r.type === 'work' ? a.units : a.units, r.type === 'work' ? Math.round(a.work / 60 * 100) / 100 : '', Math.round(a.costV || 0), toExcelDate(a.start != null ? a.start : t.start), toExcelDate(a.finish != null ? a.finish : t.finish)]);
      rowsT.push(t);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let c = 0; c < aoa[0].length; c++) ws[colL(c) + '1'].s = XL.head;
    for (let r = 2; r <= aoa.length; r++) for (let c = 0; c < aoa[0].length; c++) { const ref = colL(c) + r; if (!ws[ref]) continue; ws[ref].s = { border: cellBorder(), numFmt: c === 4 ? (aoa[r - 1][3] === 'Kerja' ? '0%' : '#,##0.##') : c === 6 ? '"' + (P.opts.cur || 'Rp') + '"#,##0' : c >= 7 ? 'dd/mm/yy' : undefined }; }
    ws['!cols'] = [{ wch: 8 }, { wch: 34 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 11 }, { wch: 15 }, { wch: 10 }, { wch: 10 }];
    ws['!autofilter'] = { ref: 'A1:I' + aoa.length };
    add('Penugasan', ws, { header: 1, freeze: { r: 1, c: 2 }, breaks: [], widthPx: 900 });
  }
  // ---- Penggunaan (time-phased)
  const usage = (kind) => {
    const unit = unitOf();
    const a = AP.TS.floor(unit, P.root.start, P), b = AP.TS.next(unit, AP.TS.floor(unit, P.root.finish, P));
    const ticks = AP.TS.ticks(unit, 1, a, b, P, 300);
    const label = tk => (unit === 'day' ? U.fmtDate(tk.s, 'dd/mm') : unit === 'week' ? U.fmtDate(tk.s, 'dd mmm') : U.fmtDate(tk.s, 'mmm yy'));
    const aoa = [[kind === 'res' ? 'Sumber Daya / Tugas' : 'Tugas / Sumber Daya', 'Total (jam)', ...ticks.map(label)]];
    const lv = [];
    const hours = v => (v ? Math.round(v / 60 * 10) / 10 : '');
    if (kind === 'res') {
      for (const r of P.res.filter(x => x.type === 'work')) {
        aoa.push([r.name, hours(r.work), ...ticks.map(tk => hours(S.resIn(P, r, tk.s, tk.e)))]); lv.push(0);
        for (const as of P.asgR.get(r.uid) || []) { const t = P.byUid.get(as.t); aoa.push(['   ' + t.name, hours(as.work), ...ticks.map(tk => hours(S.asgIn(P, as, tk.s, tk.e)))]); lv.push(1); }
      }
    } else {
      for (const t of P.tasks.filter(x => !x.sum)) {
        const as = (P.asgT.get(t.uid) || []).filter(x => (P.resByUid.get(x.r) || {}).type === 'work');
        aoa.push([t.name, hours(t.work), ...ticks.map(tk => hours(U.sum(as, x => S.asgIn(P, x, tk.s, tk.e))))]); lv.push(0);
        for (const x of as) { const r = P.resByUid.get(x.r); aoa.push(['   ' + r.name, hours(x.work), ...ticks.map(tk => hours(S.asgIn(P, x, tk.s, tk.e)))]); lv.push(1); }
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let c = 0; c < aoa[0].length; c++) ws[colL(c) + '1'].s = { ...XL.head, alignment: { horizontal: c ? 'center' : 'left' } };
    for (let r = 2; r <= aoa.length; r++) for (let c = 0; c < aoa[0].length; c++) { const ref = colL(c) + r; if (!ws[ref]) ws[ref] = { t: 's', v: '' }; ws[ref].s = { ...(lv[r - 2] === 0 ? XL.sum : {}), border: cellBorder(), numFmt: c ? '0.#' : undefined }; }
    ws['!cols'] = [{ wch: 34 }, { wch: 10 }, ...ticks.map(() => ({ wch: 8 }))];
    ws['!rows'] = [{ hpt: 20 }, ...lv.map(l => ({ level: l }))];
    add(kind === 'res' ? 'Penggunaan SD' : 'Penggunaan Tugas', ws, { header: 1, freeze: { r: 1, c: 1 }, breaks: [], widthPx: 44 * 7 + ticks.length * 60, land: true });
  };
  if (ids.includes('rusage') && P.res.length) usage('res');
  if (ids.includes('tusage')) usage('task');
  // ---- Ringkasan
  if (ids.includes('summary')) {
    const R = P.root, b = (R.bl && R.bl[0]) || null;
    const fd = t => (t == null ? 'NA' : U.fmtDate(t, 'dd mmm yyyy'));
    const aoa = [['Ringkasan Proyek', ''], ['Nama proyek', P.name], ['Manajer', P.props.manager || ''], ['Perusahaan', P.props.company || ''], ['Mulai', fd(R.start)], ['Selesai', fd(R.finish)], ['Durasi', D.fmtDur(R.sdur, 'd', P.opts)], ['% selesai', R.pct / 100], ['Kerja', D.fmtWork(R.work, P.opts)], ['Biaya', Math.round(R.cost)], ['Biaya aktual', Math.round(R.aCost)], ['Biaya sisa', Math.round(R.rCost)], ['Garis dasar selesai', b ? fd(b.f) : 'NA'], ['Garis dasar biaya', b ? Math.round(b.c) : 'NA'],
      ['Jumlah tugas', P.tasks.filter(t => !t.sum).length], ['Tugas selesai', P.tasks.filter(t => !t.sum && t.pct >= 100).length], ['Tugas kritis', P.tasks.filter(t => !t.sum && t.crit).length], ['Tugas terlambat', P.tasks.filter(t => !t.sum && t.status === 'late').length], ['Sumber daya', P.res.length], ['Teralokasi berlebih', P.res.filter(r => r.over).length], ['Diekspor', U.fmtDate(U.now(), 'dd mmm yyyy HH.MM')]];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws.A1.s = { font: { bold: true, sz: 14, color: { rgb: '0F7A55' } } };
    for (let r = 2; r <= aoa.length; r++) { ws['A' + r].s = { font: { bold: true }, border: cellBorder(), fill: { fgColor: { rgb: 'F4F6F9' } } }; const v = ws['B' + r]; if (v) v.s = { border: cellBorder(), numFmt: aoa[r - 1][0] === '% selesai' ? '0%' : /Biaya|biaya/.test(aoa[r - 1][0]) ? '"' + (P.opts.cur || 'Rp') + '"#,##0' : undefined, alignment: { horizontal: 'left' } }; }
    ws['!cols'] = [{ wch: 24 }, { wch: 40 }];
    add('Ringkasan', ws, { header: 0, breaks: [], widthPx: 500 });
  }
  // ---- Kalender
  if (ids.includes('cal')) {
    const aoa = [['Kalender', 'Nama', 'Mulai', 'Selesai', 'Jenis', 'Jam kerja']];
    for (const c of P.cals) for (const e of c.exc || []) aoa.push([c.name, e.name, toExcelDate(e.from * 1440), toExcelDate(e.to * 1440), e.work && e.work.length ? 'Bekerja' : 'Libur', (e.work || []).map(([s, f]) => U.hm(s) + '–' + U.hm(f)).join(', ')]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    for (let c = 0; c < 6; c++) ws[colL(c) + '1'].s = XL.head;
    for (let r = 2; r <= aoa.length; r++) for (let c = 0; c < 6; c++) { const ref = colL(c) + r; if (ws[ref]) ws[ref].s = { border: cellBorder(), numFmt: c === 2 || c === 3 ? 'ddd dd/mm/yyyy' : undefined }; }
    ws['!cols'] = [{ wch: 16 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 22 }];
    add('Kalender', ws, { header: 1, breaks: [], widthPx: 800 });
  }
  wb.Props = { Title: P.name, Author: P.props.author || 'Amatu Project', Company: P.props.company || '' };
  let buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  buf = await xlPatch(buf, meta, o, P);
  U.download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fname(P, 'xlsx'));
  UI.toast('Excel diunduh · ' + meta.length + ' lembar kerja: ' + meta.map(m => m.name).join(', '), { ms: 4500 });
};
function xlValue(P, kind, k, x) {
  const f = F.reg(kind)[k];
  if (!f) return '';
  const raw = F.raw(kind, k, x, P);
  if (f.type === 'date') return raw == null ? '' : toExcelDate(raw);
  if (f.type === 'cost') return raw == null ? '' : Math.round(raw * 100) / 100;
  if (f.type === 'pct') return raw == null ? '' : raw / 100;
  if (f.type === 'int' || f.type === 'num') return raw == null ? '' : raw;
  if (k === 'name') return '   '.repeat(Math.max(0, (x.lvl || 1) - 1)) + (x.name || '');
  return F.text(kind, k, x, P);
}
function xlWidth(k, aoa, col) {
  let w = 8;
  for (const row of aoa.slice(0, 400)) { const v = row[col]; const s = typeof v === 'number' ? (v > 30000 && v < 80000 ? 10 : String(Math.round(v)).length + 3) : String(v == null ? '' : v).length; if (s > w) w = s; }
  return Math.min(k === 'name' ? 48 : k === 'notes' ? 50 : 30, w + 2);
}
function styleTable(XLSX, ws, aoa, cols, kind, rowsMeta, o, P) {
  for (let c = 0; c <= cols.length; c++) { const ref = colL(c) + '1'; if (ws[ref]) ws[ref].s = XL.head; }
  rowsMeta.forEach((x, i) => {
    const R = i + 2;
    for (let c = 0; c <= cols.length; c++) {
      const ref = colL(c) + R;
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      const k = c ? cols[c - 1] : 'id';
      const f = F.reg(kind)[k] || {};
      const st = { border: cellBorder(), alignment: { vertical: 'top' } };
      if (kind === 'task' && x.sum) Object.assign(st, XL.sum, { border: cellBorder() });
      if (kind === 'task' && x.crit && !x.sum && k === 'name') st.font = { color: { rgb: 'B3261E' } };
      if (f.type === 'date') st.numFmt = 'ddd dd/mm/yy';
      else if (f.type === 'cost') st.numFmt = '"' + (P.opts.cur || 'Rp') + '"#,##0';
      else if (f.type === 'pct') st.numFmt = '0%';
      if (f.al === 'r') st.alignment = { ...st.alignment, horizontal: 'right' };
      ws[ref].s = st;
    }
  });
}
// page breaks for a task sheet: groups (summary + subtasks) are kept whole when they fit on one page
function xlBreaks(tasks, headerRows, o, widthPx) {
  const paper = AP.Pg.PAPER[o.paper] || AP.Pg.PAPER.a4;
  const land = o.orient === 'landscape' || (o.orient === 'auto' && widthPx > 760);
  const [wmm, hmm] = land ? [paper.mm[1], paper.mm[0]] : paper.mm;
  const usableW = (wmm - 25) / 25.4 * 96, usableH = (hmm - 30) / 25.4 * 96;
  const scale = o.fit ? Math.min(1, usableW / Math.max(1, widthPx)) : 1;
  const rowPx = 20 * scale, cap = Math.floor((usableH - headerRows * 20 * scale) / rowPx);
  const out = [];
  if (cap < 3) return out;
  let start = 0;
  const end = i => { const t = tasks[i]; let j = i + 1; while (j < tasks.length && tasks[j].lvl > t.lvl) j++; return j - 1; };
  while (start + cap < tasks.length) {
    let b = start + cap;   // first row of the next page
    // a group crossing the break that fits on a page moves whole
    for (let i = b - 1; i > start; i--) { const t = tasks[i]; if (!t.sum) continue; const e = end(i); if (e >= b && e - i + 1 <= cap) { b = i; break; } }
    // a summary is never the last row of a page
    while (b - 1 > start && tasks[b - 1].sum) b--;
    if (b <= start) b = start + cap;
    out.push(headerRows + b);   // excel row index (0-based count of rows above the break)
    start = b;
  }
  return out;
}
// print settings, frozen panes, page breaks, print titles — written into the xlsx XML (SheetJS CE omits them)
async function xlPatch(buf, meta, o, P) {
  const JSZip = await U.lib('jszip');
  const zip = await JSZip.loadAsync(buf);
  const paperSize = { a4: 9, f4: 14, letter: 1, legal: 5, a3: 8 }[o.paper] || 9;
  const wbXml = await zip.file('xl/workbook.xml').async('string');
  const names = [];
  for (let i = 0; i < meta.length; i++) {
    const m = meta[i];
    const path = 'xl/worksheets/sheet' + (i + 1) + '.xml';
    const f = zip.file(path);
    if (!f) continue;
    let x = await f.async('string');
    const land = o.orient === 'landscape' || (o.orient === 'auto' && (m.land || m.widthPx > 760));
    // sheetPr: outline summary rows above, fit to page
    const pr = `<sheetPr><outlinePr summaryBelow="0"/>${o.fit ? '<pageSetUpPr fitToPage="1"/>' : ''}</sheetPr>`;
    if (/<sheetPr[\s>]/.test(x)) x = x.replace(/<sheetPr\b[^>]*\/>|<sheetPr\b[\s\S]*?<\/sheetPr>/, pr);
    else x = x.replace(/(<worksheet\b[^>]*>)/, '$1' + pr);
    // frozen panes
    if (o.freeze && m.freeze) {
      const tl = colL(m.freeze.c) + (m.freeze.r + 1);
      const pane = `<sheetView workbookViewId="0"><pane${m.freeze.c ? ` xSplit="${m.freeze.c}"` : ''} ySplit="${m.freeze.r}" topLeftCell="${tl}" activePane="${m.freeze.c ? 'bottomRight' : 'bottomLeft'}" state="frozen"/></sheetView>`;
      if (/<sheetViews>/.test(x)) x = x.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, '<sheetViews>' + pane + '</sheetViews>');
      else x = x.replace(/(<dimension\b[^>]*\/>)/, '$1<sheetViews>' + pane + '</sheetViews>');
    }
    // print options, page setup, header/footer, row breaks (after pageMargins, schema order)
    const setup = `<pageSetup paperSize="${paperSize}" orientation="${land ? 'landscape' : 'portrait'}"${o.fit ? ' fitToWidth="1" fitToHeight="0"' : ''}/>`;
    const hf = `<headerFooter><oddHeader>&amp;L&amp;"-,Bold"${esc(P.name).replace(/&amp;/g, '&amp;&amp;')}&amp;R${esc(m.name)}</oddHeader><oddFooter>&amp;LAmatu Project&amp;CHalaman &amp;P dari &amp;N&amp;R&amp;D</oddFooter></headerFooter>`;
    const brk = m.breaks && m.breaks.length ? `<rowBreaks count="${m.breaks.length}" manualBreakCount="${m.breaks.length}">${m.breaks.map(r => `<brk id="${r}" max="16383" man="1"/>`).join('')}</rowBreaks>` : '';
    if (!/<pageMargins\b/.test(x)) x = x.replace(/<\/sheetData>/, '</sheetData><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>');
    x = x.replace(/<pageMargins\b[^>]*\/>/, mm => '<printOptions horizontalCentered="1"/>' + mm + setup + hf + brk);
    zip.file(path, x);
    if (m.header) names.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${m.name.replace(/'/g, "''")}'!$1:$${m.header}</definedName>`);
  }
  let w = wbXml;
  if (names.length) {
    if (/<definedNames>/.test(w)) w = w.replace('</definedNames>', names.join('') + '</definedNames>');
    else w = w.replace('</sheets>', '</sheets><definedNames>' + names.join('') + '</definedNames>');
    zip.file('xl/workbook.xml', w);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/* ======================= Microsoft Project XML (MSPDI) ======================= */
const pad = n => String(n).padStart(2, '0');
const xd = t => (t == null ? '' : U.isoDT(t));
const xdur = m => { m = Math.max(0, Math.round(m || 0)); return 'PT' + Math.floor(m / 60) + 'H' + (m % 60) + 'M0S'; };
const tag = (n, v) => (v == null || v === '' ? '' : `<${n}>${esc(v)}</${n}>`);
const DFMT = { m: 3, h: 5, d: 7, w: 9, mo: 11 }, DFMT_E = { m: 4, h: 6, d: 8, w: 10, mo: 12 };
const CONS_X = { ASAP: 0, ALAP: 1, MSO: 2, MFO: 3, SNET: 4, SNLT: 5, FNET: 6, FNLT: 7 };
const LINK_X = { FF: 0, FS: 1, SF: 2, SS: 3 };
const ACC_X = { start: 1, end: 2, pro: 3 };
const TYPE_X = { FU: 0, FD: 1, FW: 2 };
IO.toXML = P => {
  const o = P.opts, R = P.root;
  const calUid = new Map(P.cals.map((c, i) => [c.id, i + 1]));
  const out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '<Project xmlns="http://schemas.microsoft.com/project">'];
  out.push(tag('SaveVersion', 14), tag('Name', fname(P, 'xml')), tag('Title', P.props.title || P.name), tag('Subject', P.props.subject), tag('Category', P.props.category), tag('Company', P.props.company), tag('Manager', P.props.manager), tag('Author', P.props.author), tag('Comments', P.props.comments),
    tag('CreationDate', xd(Math.round((P.created - new Date().getTimezoneOffset() * 60000) / 60000))), tag('ScheduleFromStart', P.fromFinish ? 0 : 1), tag('StartDate', xd(R.start)), tag('FinishDate', xd(R.finish)), tag('FYStartDate', (o.fyStart || 0) + 1),
    tag('CriticalSlackLimit', o.critSlack || 0), tag('CurrencyDigits', o.curDec || 0), tag('CurrencySymbol', o.cur || 'Rp'), tag('CurrencyCode', 'IDR'), tag('CurrencySymbolPosition', o.curPos === 'after' ? 1 : 0), tag('CalendarUID', calUid.get(P.calendar) || 1),
    tag('DefaultStartTime', U.hmColon(o.dayStart) + ':00'), tag('DefaultFinishTime', U.hmColon(o.dayEnd) + ':00'), tag('MinutesPerDay', o.hpd * 60), tag('MinutesPerWeek', o.hpw * 60), tag('DaysPerMonth', o.dpm),
    tag('DefaultTaskType', TYPE_X[o.taskType] || 0), tag('DefaultFixedCostAccrual', 3), tag('DurationFormat', DFMT[o.durU] || 7), tag('WorkFormat', { m: 1, h: 2, d: 3, w: 4, mo: 5 }[o.workU] || 2), tag('WeekStartDay', o.weekStart),
    tag('HonorConstraints', o.honor ? 1 : 0), tag('NewTasksEffortDriven', o.effort ? 1 : 0), tag('NewTasksEstimated', o.estimated ? 1 : 0), tag('MultipleCriticalPaths', o.multiCrit ? 1 : 0), tag('NewTaskStartDate', 0),
    P.statusDate != null ? tag('StatusDate', xd(P.statusDate)) : '', P.currentDate != null ? tag('CurrentDate', xd(P.currentDate)) : '');
  // calendars
  out.push('<Calendars>');
  for (const c of P.cals) {
    out.push('<Calendar>', tag('UID', calUid.get(c.id)), tag('Name', c.name), tag('IsBaseCalendar', c.own ? 0 : 1), tag('BaseCalendarUID', c.base ? calUid.get(c.base) || -1 : -1), '<WeekDays>');
    for (let dow = 0; dow < 7; dow++) {
      const iv = c.week ? c.week[dow] : null;
      if (iv == null && c.base) continue;
      const day = iv || (dow === 0 || dow === 6 ? [] : Cal.STD_DAY);
      out.push('<WeekDay>', tag('DayType', dow + 1), tag('DayWorking', day.length ? 1 : 0));
      if (day.length) out.push('<WorkingTimes>' + day.map(([s, e]) => `<WorkingTime><FromTime>${U.hmColon(s)}:00</FromTime><ToTime>${U.hmColon(e % 1440)}:00</ToTime></WorkingTime>`).join('') + '</WorkingTimes>');
      out.push('</WeekDay>');
    }
    out.push('</WeekDays>');
    const ex = (c.exc || []).filter(e => !e.rec || !e.rec.t);
    if (ex.length) {
      out.push('<Exceptions>');
      for (const e of ex) {
        out.push('<Exception>', tag('EnteredByOccurrences', 0), `<TimePeriod><FromDate>${xd(e.from * 1440)}</FromDate><ToDate>${xd(e.to * 1440 + 1439)}</ToDate></TimePeriod>`, tag('Occurrences', 1), tag('Name', e.name), tag('Type', 1), tag('DayWorking', e.work && e.work.length ? 1 : 0));
        if (e.work && e.work.length) out.push('<WorkingTimes>' + e.work.map(([s, f]) => `<WorkingTime><FromTime>${U.hmColon(s)}:00</FromTime><ToTime>${U.hmColon(f % 1440)}:00</ToTime></WorkingTime>`).join('') + '</WorkingTimes>');
        out.push('</Exception>');
      }
      out.push('</Exceptions>');
    }
    out.push('</Calendar>');
  }
  out.push('</Calendars>');
  // tasks
  out.push('<Tasks>');
  out.push('<Task>', tag('UID', 0), tag('ID', 0), tag('Name', P.name), tag('Type', 1), tag('IsNull', 0), tag('OutlineNumber', 0), tag('OutlineLevel', 0), tag('Start', xd(R.start)), tag('Finish', xd(R.finish)), tag('Duration', xdur(R.sdur)), tag('DurationFormat', 7), tag('Summary', 1), tag('PercentComplete', R.pct || 0), tag('Cost', Math.round((R.cost || 0) * 100)), tag('Work', xdur(R.work)), '</Task>');
  for (const t of P.tasks) {
    const ms = F.isMs(t);
    out.push('<Task>', tag('UID', t.uid), tag('ID', t.id), tag('Name', t.name), tag('Active', t.active === false ? 0 : 1), tag('Manual', t.mode === 'manual' ? 1 : 0), tag('Type', TYPE_X[t.type] || 0), tag('IsNull', 0),
      tag('CreateDate', xd(Math.round(((t.created || P.created) - new Date().getTimezoneOffset() * 60000) / 60000))), tag('WBS', t.wbs), tag('OutlineNumber', t.outline), tag('OutlineLevel', t.lvl), tag('Priority', t.pri == null ? 500 : t.pri),
      tag('Start', xd(t.start)), tag('Finish', xd(t.finish)), tag('Duration', xdur(t.sum ? t.sdur : t.dur)), tag('DurationFormat', t.sum ? 7 : (t.el ? DFMT_E : DFMT)[t.durU || 'd'] + (t.est && !t.el ? 32 : 0)),
      tag('Work', xdur(t.work)), tag('ResumeValid', 0), tag('EffortDriven', t.effort ? 1 : 0), tag('Recurring', 0), tag('OverAllocated', t.over ? 1 : 0), tag('Estimated', t.est ? 1 : 0), tag('Milestone', ms ? 1 : 0), tag('Summary', t.sum ? 1 : 0), tag('Critical', t.crit ? 1 : 0),
      tag('IsSubproject', 0), tag('IsSubprojectReadOnly', 0), tag('ExternalTask', 0), tag('FixedCostAccrual', ACC_X[t.fca || 'pro']), tag('FixedCost', Math.round((t.fixedCost || 0) * 100)), tag('Cost', Math.round((t.cost || 0) * 100)),
      tag('PercentComplete', t.pct || 0), tag('PercentWorkComplete', t.pwc || 0), t.aStart != null ? tag('ActualStart', xd(t.aStart)) : '', t.aFinish != null ? tag('ActualFinish', xd(t.aFinish)) : '',
      tag('ActualDuration', xdur(t.aDur)), tag('RemainingDuration', xdur(t.rDur)), tag('ConstraintType', CONS_X[t.cons || 'ASAP']), t.consDate != null ? tag('ConstraintDate', xd(t.consDate)) : '', t.deadline != null ? tag('Deadline', xd(t.deadline)) : '',
      tag('CalendarUID', t.cal ? calUid.get(t.cal) || -1 : -1), tag('LevelingDelay', Math.round((t.ld || 0) * 10)), tag('LevelingDelayFormat', 8), tag('HideBar', t.hideBar ? 1 : 0), tag('Rollup', 0), tag('DisplayOnTimeline', t.tl ? 1 : 0),
      t.notes ? tag('Notes', t.notes) : '', t.link ? tag('Hyperlink', t.link) + tag('HyperlinkAddress', t.link) : '');
    for (const L of t.pred) {
      const p = P.byUid.get(L.uid);
      let lag = L.lag || 0, fmt = (L.el ? DFMT_E : DFMT)[L.lagU || 'd'];
      if (L.pct != null) { lag = Math.round(L.pct / 100 * (p ? (p.sum ? p.sdur : p.dur) : 0)); fmt = DFMT[o.durU] || 7; }
      out.push('<PredecessorLink>', tag('PredecessorUID', L.uid), tag('Type', LINK_X[L.type]), tag('CrossProject', 0), tag('LinkLag', Math.round(lag * 10)), tag('LagFormat', fmt), '</PredecessorLink>');
    }
    for (const [n, b] of Object.entries(t.bl || {})) out.push('<Baseline>', tag('Number', n), tag('Start', xd(b.s)), tag('Finish', xd(b.f)), tag('Duration', xdur(b.d)), tag('DurationFormat', 7), tag('Work', xdur(b.w)), tag('Cost', Math.round((b.c || 0) * 100)), '</Baseline>');
    out.push('</Task>');
  }
  out.push('</Tasks>');
  // resources
  out.push('<Resources>');
  for (const r of P.res) {
    const perH = r.type === 'material' ? (r.std && r.std.v) || 0 : D.rateHour(r.std, o);
    const fmtR = { m: 1, h: 2, d: 3, w: 4, mo: 5, y: 7 }[(r.std && r.std.u) || 'h'] || 2;
    out.push('<Resource>', tag('UID', r.uid), tag('ID', r.id), tag('Name', r.name), tag('Type', r.type === 'material' ? 0 : r.type === 'cost' ? 2 : 1), tag('IsNull', 0), tag('Initials', r.ini), tag('Group', r.group), tag('Code', r.code), tag('EmailAddress', r.email),
      r.type === 'material' ? tag('MaterialLabel', r.mat) : '', tag('MaxUnits', r.type === 'work' ? (r.max == null ? 1 : r.max).toFixed(2) : ''), tag('StandardRate', +perH.toFixed(4)), tag('StandardRateFormat', r.type === 'material' ? 2 : fmtR),
      tag('OvertimeRate', +(D.rateHour(r.ovt, o)).toFixed(4)), tag('OvertimeRateFormat', 2), tag('CostPerUse', Math.round((r.costUse || 0) * 100)), tag('AccrueAt', ACC_X[r.accrue || 'pro']), tag('IsGeneric', r.generic ? 1 : 0), tag('IsInactive', r.active === false ? 1 : 0),
      r.cal ? tag('CalendarUID', calUid.get(r.cal)) : '', tag('Work', xdur(r.work)), tag('Cost', Math.round((r.cost || 0) * 100)), r.notes ? tag('Notes', r.notes) : '', '</Resource>');
  }
  out.push('</Resources>');
  // assignments
  out.push('<Assignments>');
  for (const a of P.asg) {
    const t = P.byUid.get(a.t), r = P.resByUid.get(a.r);
    if (!t || !r) continue;
    const work = r.type === 'material' ? a.units * 60 : r.type === 'cost' ? 0 : a.work;
    out.push('<Assignment>', tag('UID', a.uid), tag('TaskUID', a.t), tag('ResourceUID', a.r), tag('Units', r.type === 'cost' ? 1 : +(+a.units).toFixed(4)), tag('Work', xdur(work)), tag('Start', xd(a.start != null ? a.start : t.start)), tag('Finish', xd(a.finish != null ? a.finish : t.finish)),
      tag('Cost', Math.round((a.costV || 0) * 100)), tag('PercentWorkComplete', t.pct || 0), tag('Delay', Math.round((a.delay || 0) * 10)), tag('WorkContour', { flat: 0, back: 1, front: 2, double: 3, early: 4, late: 5, bell: 6, turtle: 7 }[a.contour || 'flat'] || 0), '</Assignment>');
  }
  out.push('</Assignments>');
  out.push('</Project>');
  return out.filter(Boolean).join('\n');
};
IO.exportXML = app => {
  U.download(IO.toXML(app.P), fname(app.P, 'xml'), 'application/xml');
  UI.toast('Microsoft Project XML diunduh — buka di Microsoft Project lewat Berkas › Buka › jenis "XML"', { ms: 6000 });
};
// parse MSPDI
const pdur = s => { const m = /^-?PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(String(s || '').trim()); if (!m) return 0; return Math.round((+m[1] || 0) * 60 + (+m[2] || 0) + (+m[3] || 0) / 60); };
const pdt = s => { if (!s) return null; const v = U.parseDate(String(s).trim().replace('T', ' ').slice(0, 16).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/, '$1T$2:$3'), 0); return isFinite(v) ? v : null; };
IO.fromXML = text => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw 'File XML tidak valid';
  const root = doc.documentElement;
  if (root.localName !== 'Project') throw 'Bukan file Microsoft Project XML (MSPDI)';
  const kid = (n, name) => { for (const c of n.children) if (c.localName === name) return c; return null; };
  const kids = (n, name) => (n ? [...n.children].filter(c => c.localName === name) : []);
  const txt = (n, name) => { const c = kid(n, name); return c ? c.textContent : null; };
  const num = (n, name, d = 0) => { const v = txt(n, name); return v == null || v === '' ? d : +v; };
  const P = M.newProject(txt(root, 'Title') || (txt(root, 'Name') || 'Proyek Impor').replace(/\.xml$/i, ''));
  const o = P.opts;
  o.hpd = num(root, 'MinutesPerDay', 480) / 60; o.hpw = num(root, 'MinutesPerWeek', 2400) / 60; o.dpm = num(root, 'DaysPerMonth', 20);
  const dst = txt(root, 'DefaultStartTime'), dft = txt(root, 'DefaultFinishTime');
  if (dst) { const [h, m] = dst.split(':').map(Number); o.dayStart = h * 60 + m; }
  if (dft) { const [h, m] = dft.split(':').map(Number); o.dayEnd = h * 60 + m; }
  o.weekStart = num(root, 'WeekStartDay', 1); o.honor = num(root, 'HonorConstraints', 1) === 1;
  o.cur = txt(root, 'CurrencySymbol') || o.cur; o.curDec = num(root, 'CurrencyDigits', o.curDec);
  o.taskType = ['FU', 'FD', 'FW'][num(root, 'DefaultTaskType', 0)] || 'FU';
  o.critSlack = num(root, 'CriticalSlackLimit', 0) / (o.hpd * 60) || 0;
  P.props = { ...P.props, title: P.name, subject: txt(root, 'Subject') || '', company: txt(root, 'Company') || '', manager: txt(root, 'Manager') || '', author: txt(root, 'Author') || '', category: txt(root, 'Category') || '', comments: txt(root, 'Comments') || '' };
  P.fromFinish = num(root, 'ScheduleFromStart', 1) === 0;
  P.start = pdt(txt(root, 'StartDate')) || P.start;
  P.finish = pdt(txt(root, 'FinishDate')) || P.start;
  if (txt(root, 'StatusDate')) P.statusDate = pdt(txt(root, 'StatusDate'));
  // calendars
  const calMap = new Map();
  const cals = [];
  for (const c of kids(kid(root, 'Calendars'), 'Calendar')) {
    const uid = txt(c, 'UID'), base = txt(c, 'BaseCalendarUID');
    const isBase = num(c, 'IsBaseCalendar', 1) === 1;
    const cal = { id: 'x' + uid, name: txt(c, 'Name') || 'Kalender ' + uid, base: base && base !== '-1' ? 'x' + base : null, week: [null, null, null, null, null, null, null], exc: [], ww: [] };
    if (!isBase) cal.own = -1;
    for (const wd of kids(kid(c, 'WeekDays'), 'WeekDay')) {
      const dt = num(wd, 'DayType', -1), working = num(wd, 'DayWorking', 0) === 1;
      const times = kids(kid(wd, 'WorkingTimes'), 'WorkingTime').map(w => { const a = (txt(w, 'FromTime') || '00:00').split(':').map(Number), b = (txt(w, 'ToTime') || '00:00').split(':').map(Number); let e = b[0] * 60 + b[1]; if (e === 0) e = 1440; return [a[0] * 60 + a[1], e]; });
      if (dt >= 1 && dt <= 7) cal.week[dt - 1] = working ? Cal.normIv(times) : [];
      else if (dt === 0) { const tp = kid(wd, 'TimePeriod'); if (tp) { const f = pdt(txt(tp, 'FromDate')), t2 = pdt(txt(tp, 'ToDate')); if (f != null) cal.exc.push({ name: 'Pengecualian', from: Math.floor(f / 1440), to: Math.floor((t2 != null ? t2 : f) / 1440), work: working ? Cal.normIv(times) : [] }); } }
    }
    for (const ex of kids(kid(c, 'Exceptions'), 'Exception')) {
      const tp = kid(ex, 'TimePeriod');
      if (!tp) continue;
      const f = pdt(txt(tp, 'FromDate')), t2 = pdt(txt(tp, 'ToDate'));
      if (f == null) continue;
      const times = kids(kid(ex, 'WorkingTimes'), 'WorkingTime').map(w => { const a = (txt(w, 'FromTime') || '00:00').split(':').map(Number), b = (txt(w, 'ToTime') || '00:00').split(':').map(Number); let e = b[0] * 60 + b[1]; if (e === 0) e = 1440; return [a[0] * 60 + a[1], e]; });
      cal.exc.push({ name: txt(ex, 'Name') || 'Pengecualian', from: Math.floor(f / 1440), to: Math.floor((t2 != null ? t2 : f) / 1440), work: num(ex, 'DayWorking', 0) === 1 ? Cal.normIv(times) : [] });
    }
    if (!cal.base && cal.week.some(d => d == null)) for (let i = 0; i < 7; i++) if (cal.week[i] == null) cal.week[i] = i === 0 || i === 6 ? [] : U.deep(Cal.STD_DAY);
    calMap.set(uid, cal.id);
    cals.push(cal);
  }
  if (cals.length) { P.cals = cals; const pc = txt(root, 'CalendarUID'); P.calendar = calMap.get(pc) || cals[0].id; }
  // tasks
  const TT = kids(kid(root, 'Tasks'), 'Task').filter(t => num(t, 'IsNull', 0) !== 1 && num(t, 'OutlineLevel', 1) >= 1 && txt(t, 'UID') !== '0');
  TT.sort((a, b) => num(a, 'ID', 0) - num(b, 'ID', 0));
  const uidMap = new Map();
  const CONS = Object.fromEntries(Object.entries(CONS_X).map(([k, v]) => [v, k]));
  const UFMT = { 3: 'm', 4: 'm', 5: 'h', 6: 'h', 7: 'd', 8: 'd', 9: 'w', 10: 'w', 11: 'mo', 12: 'mo' };
  const tasks = TT.map(x => {
    const uid = M.uid(P);
    uidMap.set(txt(x, 'UID'), uid);
    let fmt = num(x, 'DurationFormat', 7);
    const est = fmt >= 35 || num(x, 'Estimated', 0) === 1;
    if (fmt >= 35) fmt -= 32;
    const el = [4, 6, 8, 10, 12].includes(fmt);
    const t = M.newTask(P, {
      uid, name: txt(x, 'Name') || '', lvl: Math.max(1, num(x, 'OutlineLevel', 1)), dur: pdur(txt(x, 'Duration')), durU: UFMT[fmt] || 'd', el, est: est && num(x, 'Summary', 0) !== 1,
      mode: num(x, 'Manual', 0) === 1 ? 'manual' : 'auto', type: ['FU', 'FD', 'FW'][num(x, 'Type', 0)] || 'FU', effort: num(x, 'EffortDriven', 0) === 1, pri: num(x, 'Priority', 500),
      pct: num(x, 'PercentComplete', 0), aStart: pdt(txt(x, 'ActualStart')), aFinish: pdt(txt(x, 'ActualFinish')), fixedCost: num(x, 'FixedCost', 0) / 100, fca: { 1: 'start', 2: 'end', 3: 'pro' }[num(x, 'FixedCostAccrual', 3)] || 'pro',
      cons: CONS[num(x, 'ConstraintType', 0)] || 'ASAP', consDate: pdt(txt(x, 'ConstraintDate')), deadline: pdt(txt(x, 'Deadline')), notes: txt(x, 'Notes') || '', link: txt(x, 'HyperlinkAddress') || txt(x, 'Hyperlink') || '',
      active: num(x, 'Active', 1) !== 0, hideBar: num(x, 'HideBar', 0) === 1, tl: num(x, 'DisplayOnTimeline', 0) === 1, ld: num(x, 'LevelingDelay', 0) / 10, ms: num(x, 'Milestone', 0) === 1 && pdur(txt(x, 'Duration')) > 0,
    });
    if (t.mode === 'manual') { t.mStart = pdt(txt(x, 'ManualStart')) || pdt(txt(x, 'Start')); t.mFinish = pdt(txt(x, 'ManualFinish')) || null; }
    const cu = txt(x, 'CalendarUID');
    if (cu && cu !== '-1' && calMap.has(cu)) t.cal = calMap.get(cu);
    if (t.cons === 'ASAP' || t.cons === 'ALAP') t.consDate = null;
    const wbs = txt(x, 'WBS'); if (wbs && wbs !== txt(x, 'OutlineNumber')) t.wbsCode = wbs;
    for (const b of kids(x, 'Baseline')) { const n = num(b, 'Number', 0); t.bl ||= {}; t.bl[n] = { s: pdt(txt(b, 'Start')), f: pdt(txt(b, 'Finish')), d: pdur(txt(b, 'Duration')), w: pdur(txt(b, 'Work')), c: num(b, 'Cost', 0) / 100 }; P.blInfo[n] = Date.now(); }
    t._x = x;
    return t;
  });
  const LT = Object.fromEntries(Object.entries(LINK_X).map(([k, v]) => [v, k]));
  for (const t of tasks) {
    for (const L of kids(t._x, 'PredecessorLink')) {
      const pu = uidMap.get(txt(L, 'PredecessorUID'));
      if (pu == null) continue;
      let fmt = num(L, 'LagFormat', 7);
      if (fmt >= 35) fmt -= 32;
      const lag = num(L, 'LinkLag', 0) / 10;
      const el = [4, 6, 8, 10, 12].includes(fmt);
      if (fmt === 19 || fmt === 20) t.pred.push({ uid: pu, type: LT[num(L, 'Type', 1)] || 'FS', lag: 0, lagU: 'd', pct: lag, el: false });
      else t.pred.push({ uid: pu, type: LT[num(L, 'Type', 1)] || 'FS', lag: Math.round(lag), lagU: UFMT[fmt] || 'd', pct: null, el });
    }
    delete t._x;
  }
  P.tasks = tasks;
  // resources
  const resMap = new Map();
  for (const x of kids(kid(root, 'Resources'), 'Resource')) {
    if (num(x, 'IsNull', 0) === 1 || txt(x, 'UID') === '0' || !txt(x, 'Name')) continue;
    const type = { 0: 'material', 1: 'work', 2: 'cost' }[num(x, 'Type', 1)] || 'work';
    const fmtR = { 1: 'm', 2: 'h', 3: 'd', 4: 'w', 5: 'mo', 7: 'y' }[num(x, 'StandardRateFormat', 2)] || 'h';
    const perH = num(x, 'StandardRate', 0);
    const r = M.newRes(P, { name: txt(x, 'Name'), type, ini: txt(x, 'Initials') || '', group: txt(x, 'Group') || '', code: txt(x, 'Code') || '', email: txt(x, 'EmailAddress') || '', mat: txt(x, 'MaterialLabel') || '',
      max: type === 'work' ? num(x, 'MaxUnits', 1) : 1, std: { v: type === 'material' ? perH : perH * D.hoursIn(fmtR, o), u: fmtR }, ovt: { v: num(x, 'OvertimeRate', 0), u: 'h' }, costUse: num(x, 'CostPerUse', 0) / 100,
      accrue: { 1: 'start', 2: 'end', 3: 'pro' }[num(x, 'AccrueAt', 3)] || 'pro', generic: num(x, 'IsGeneric', 0) === 1, active: num(x, 'IsInactive', 0) !== 1, notes: txt(x, 'Notes') || '' });
    const cu = txt(x, 'CalendarUID');
    if (cu && calMap.has(cu)) { r.cal = calMap.get(cu); const c = P.cals.find(k => k.id === r.cal); if (c && c.own === -1) c.own = r.uid; }
    resMap.set(txt(x, 'UID'), r);
    P.res.push(r);
  }
  // assignments
  for (const x of kids(kid(root, 'Assignments'), 'Assignment')) {
    const t = uidMap.get(txt(x, 'TaskUID')), r = resMap.get(txt(x, 'ResourceUID'));
    if (t == null || !r) continue;
    const work = pdur(txt(x, 'Work'));
    P.asg.push({ uid: M.uid(P), t, r: r.uid, units: r.type === 'material' ? (work ? work / 60 : num(x, 'Units', 1)) : num(x, 'Units', 1), work: r.type === 'material' ? (work ? work / 60 : num(x, 'Units', 1)) : work, cost: r.type === 'cost' ? num(x, 'Cost', 0) / 100 : 0, contour: ['flat', 'back', 'front', 'double', 'early', 'late', 'bell', 'turtle'][num(x, 'WorkContour', 0)] || 'flat', delay: num(x, 'Delay', 0) / 10 });
  }
  M.fix(P);
  M.index(P);
  M.dropBadLinks(P);
  return P;
};

/* ======================= Excel / CSV impor ======================= */
const SYN = {
  name: ['nama tugas', 'task name', 'name', 'nama', 'tugas', 'pekerjaan', 'uraian', 'uraian pekerjaan', 'kegiatan', 'aktivitas', 'activity', 'task'],
  dur: ['durasi', 'duration', 'lama', 'waktu', 'hari', 'days'], start: ['mulai', 'start', 'tanggal mulai', 'start date', 'tgl mulai'], finish: ['selesai', 'finish', 'tanggal selesai', 'end', 'end date', 'tgl selesai', 'akhir'],
  pred: ['pendahulu', 'predecessors', 'predecessor', 'pred', 'ketergantungan'], rn: ['nama sumber daya', 'resource names', 'resources', 'sumber daya', 'resource', 'pelaksana', 'pic'],
  pct: ['% selesai', '% complete', 'progress', 'kemajuan', 'persen', 'progres'], lvl: ['tingkat kerangka', 'outline level', 'level', 'tingkat'], wbs: ['wbs', 'no', 'no.', 'nomor', 'kode'],
  notes: ['catatan', 'notes', 'keterangan', 'note'], fixedCost: ['biaya tetap', 'fixed cost', 'biaya', 'anggaran', 'cost', 'harga', 'jumlah harga', 'nilai'], deadline: ['tenggat', 'deadline'], ms: ['tonggak', 'milestone'],
};
const guess = h => { const s = String(h || '').trim().toLowerCase(); if (!s) return ''; for (const [k, list] of Object.entries(SYN)) if (list.includes(s)) return k; const f = F.byName('task', s); return f || ''; };
IO.readTable = async file => {
  const XLSX = await U.lib('xlsx');
  const buf = await U.readFile(file, 'buf');
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const out = [];
  for (const n of wb.SheetNames) {
    const ws = wb.Sheets[n];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    out.push({ name: n, aoa, ws });
  }
  return out;
};
IO.importTableDialog = async (app, file, mode) => {
  let sheets;
  try { sheets = await IO.readTable(file); } catch (e) { UI.toast('Gagal membaca: ' + (e.message || e), { kind: 'bad' }); return; }
  let si = 0;
  const box = el('div.imp');
  let map = [], hdr = 0;
  const detect = () => {
    const aoa = sheets[si].aoa;
    hdr = 0;
    let best = -1;
    for (let r = 0; r < Math.min(15, aoa.length); r++) { const n = aoa[r].filter(h => guess(h)).length; if (n > best) { best = n; hdr = r; } }
    map = (aoa[hdr] || []).map(h => guess(h));
    if (!map.includes('name')) { const i = (aoa[hdr] || []).findIndex((h, k) => aoa.slice(hdr + 1, hdr + 6).some(r => typeof r[k] === 'string' && r[k].length > 3)); if (i >= 0) map[i] = 'name'; }
  };
  const fields = [['', '(abaikan)'], ...Object.keys(SYN).map(k => [k, k === 'lvl' ? 'Tingkat Kerangka' : F.title(k === 'ms' ? 'ms' : k, app.P || { fields: {} })]), ...F.list('task', app.P || AP.M.newProject()).filter(f => !SYN[f.k]).map(f => [f.k, f.t])];
  const draw = () => {
    const aoa = sheets[si].aoa;
    const head = aoa[hdr] || [];
    const tbl = el('table.imp-t', el('thead', el('tr', ...head.map((h, i) => el('th', el('div', String(h || '(kolom ' + (i + 1) + ')')), UI.select(fields, map[i] || '', v => { map[i] = v; }))))),
      el('tbody', ...aoa.slice(hdr + 1, hdr + 9).map(r => el('tr', ...head.map((_, i) => el('td', String(r[i] == null ? '' : r[i]).slice(0, 40)))))));
    box.replaceChildren(
      el('div.fgrid', sheets.length > 1 ? UI.field('Lembar', UI.select(sheets.map((s, i) => [String(i), s.name]), String(si), v => { si = +v; detect(); draw(); })) : null,
        UI.field('Baris judul', (() => { const i = el('input.inp', { type: 'number', min: 1, value: hdr + 1 }); i.addEventListener('change', () => { hdr = Math.max(0, (+i.value || 1) - 1); map = (sheets[si].aoa[hdr] || []).map(h => guess(h)); draw(); }); return i; })())),
      el('p.hint', 'Kolom dikenali otomatis dari judulnya (Nama Tugas, Durasi, Mulai, Selesai, Pendahulu, Sumber Daya, % Selesai, WBS/No …). Tingkat kerangka diambil dari kolom Tingkat, dari nomor WBS (1.2.3), atau dari spasi di depan nama.'),
      el('div.imp-wrap', tbl));
  };
  detect(); draw();
  UI.dialog({ title: 'Impor tabel · ' + file.name, width: 'min(980px, 100%)', body: box, buttons: [{ label: 'Batal' }, { label: mode === 'insert' ? 'Sisipkan ke Proyek' : 'Buat Proyek', primary: true, run: async () => {
    if (!map.includes('name')) { UI.toast('Tentukan kolom Nama Tugas'); return false; }
    const P = mode === 'insert' ? null : M.newProject(file.name.replace(/\.(xlsx|xls|csv|ods)$/i, ''));
    const target = P || app.P;
    const rows = sheets[si].aoa.slice(hdr + 1).filter(r => r.some(v => v !== '' && v != null));
    const made = buildFromRows(target, rows, map);
    if (P) { M.fix(P); S.calc(P); await app.newProject(P); }
    else app.tx('Impor tabel', P2 => { P2.tasks.push(...made.tasks); P2.res.push(...made.res.filter(r => !P2.res.includes(r))); P2.asg.push(...made.asg); });
    UI.toast(made.tasks.length + ' tugas diimpor');
  } }] });
};
function buildFromRows(P, rows, map) {
  const col = k => map.indexOf(k);
  const iName = col('name'), iLvl = col('lvl'), iWbs = col('wbs');
  const tmp = M.newProject('tmp');
  tmp.opts = P.opts; tmp.nextUid = P.nextUid; tmp.res = P.res.slice(); tmp.tasks = []; tmp.asg = [];
  const pending = [];
  for (const r of rows) {
    const raw = r[iName];
    const name = String(raw == null ? '' : raw);
    if (!name.trim()) continue;
    let lvl = 1;
    if (iLvl >= 0 && +r[iLvl] > 0) lvl = Math.round(+r[iLvl]);
    else if (iWbs >= 0 && /^\d+(\.\d+)+\.?$/.test(String(r[iWbs]).trim())) lvl = String(r[iWbs]).trim().replace(/\.$/, '').split('.').length;
    else { const m = /^(\s+)/.exec(name); if (m) lvl = 1 + Math.floor(m[1].replace(/\t/g, '    ').length / 3); }
    const t = M.newTask(tmp, { name: name.trim(), lvl, est: false });
    tmp.tasks.push(t);
    pending.push({ t, r });
  }
  M.index(tmp); S.calc(tmp);
  const xlDate = v => (typeof v === 'number' && v > 20000 && v < 80000 ? Math.round((v - 25569) * 1440) : v);
  for (const { t, r } of pending) {
    map.forEach((k, i) => {
      if (!k || k === 'name' || k === 'lvl' || r[i] === '' || r[i] == null) return;
      try {
        if (k === 'wbs') { if (!/^\d+(\.\d+)*\.?$/.test(String(r[i]).trim())) t.wbsCode = String(r[i]).trim(); return; }
        if (k === 'dur' && typeof r[i] === 'number') { if (!t.sum) AP.M.setDur(tmp, t, Math.round(r[i] * tmp.opts.hpd * 60)); return; }
        if ((k === 'start' || k === 'finish' || k === 'deadline') && typeof r[i] === 'number') { const v = xlDate(r[i]); if (k === 'start') M.setStart(tmp, t, v + (v % 1440 ? 0 : tmp.opts.dayStart)); else if (k === 'finish') { if (!t.sum && !t.pred.length) M.setFinish(tmp, t, v + (v % 1440 ? 0 : tmp.opts.dayEnd), tmp._ctx); } else t.deadline = v + tmp.opts.dayEnd; return; }
        if (k === 'pct' && typeof r[i] === 'number') { M.setPct(tmp, t, r[i] <= 1 && r[i] > 0 ? r[i] * 100 : r[i], tmp._ctx); return; }
        if (k === 'fixedCost') { const v = U.parseNum(r[i]); if (isFinite(v)) t.fixedCost = v; return; }
        const f = F.T[k];
        if (f && f.set && !(t.sum && ['dur', 'start', 'finish'].includes(k))) f.set(t, tmp, String(r[i]), tmp._ctx);
        if (k === 'start' || k === 'dur' || k === 'pred') { M.index(tmp); S.calc(tmp); }
      } catch (e) { /* ignore a bad cell */ }
    });
  }
  P.nextUid = tmp.nextUid;
  if (P !== tmp) for (const r of tmp.res) if (!P.res.includes(r)) P.res.push(r);
  return { tasks: tmp.tasks, res: tmp.res, asg: tmp.asg };
}

/* ======================= dialog impor ======================= */
IO.importDialog = app => {
  const inProject = !!(app.P && !document.getElementById('app').hidden);
  let mode = 'new';
  const drop = el('div.imp-drop', icon('upload_file'), el('b', 'Pilih atau letakkan file di sini'), el('span', 'Microsoft Project XML (.xml) · Excel (.xlsx/.xls) · CSV · Amatu Project (.amproj/.json)'));
  const handle = async file => {
    if (!file) return;
    const n = file.name.toLowerCase();
    try {
      if (/\.mpp$/.test(n)) { UI.alert('File .mpp adalah format biner Microsoft Project. Buka file itu di Microsoft Project lalu pilih Berkas › Simpan Sebagai › "XML Format (*.xml)", kemudian impor file .xml tersebut di sini.', 'File .mpp'); return; }
      if (/\.(xlsx|xls|csv|ods|tsv)$/.test(n)) { dlg.close(); IO.importTableDialog(app, file, mode); return; }
      const text = await U.readFile(file);
      let P;
      if (/\.xml$/.test(n) || /^\s*<\?xml|<Project/.test(text.slice(0, 300))) P = IO.fromXML(text);
      else P = IO.parseJSON(text);
      P.id = U.uid('p'); P.created = P.updated = Date.now();
      if (!P.name) P.name = file.name.replace(/\.\w+$/, '');
      S.calc(P);
      dlg.close();
      if (mode === 'insert' && inProject) {
        app.tx('Sisipkan proyek impor', P2 => {
          const map = new Map(), resMap = new Map();
          for (const r of P.res) { let x = P2.res.find(y => y.name.toLowerCase() === r.name.toLowerCase()); if (!x) { x = { ...U.deep(r), uid: M.uid(P2), cal: null }; P2.res.push(x); } resMap.set(r.uid, x.uid); }
          const sum = M.newTask(P2, { name: P.name, lvl: 1 });
          const kids = P.tasks.map(t => { const c = M.newTask(P2, {}); for (const k of M.TASK_KEYS) if (k !== 'uid' && t[k] !== undefined) c[k] = U.deep(t[k]); c.lvl = 1 + t.lvl; c.cal = null; map.set(t.uid, c.uid); return c; });
          for (const c of kids) c.pred = (c.pred || []).filter(L => map.has(L.uid)).map(L => ({ ...L, uid: map.get(L.uid) }));
          P2.tasks.push(sum, ...kids);
          for (const a of P.asg) if (map.has(a.t) && resMap.has(a.r)) P2.asg.push({ ...U.deep(a), uid: M.uid(P2), t: map.get(a.t), r: resMap.get(a.r) });
        });
        UI.toast(P.tasks.length + ' tugas disisipkan');
      } else { await app.newProject(P); UI.toast('Diimpor: ' + P.tasks.length + ' tugas, ' + P.res.length + ' sumber daya'); }
    } catch (e) { console.error(e); UI.toast('Gagal mengimpor: ' + (typeof e === 'string' ? e : e.message || e), { kind: 'bad', ms: 6000 }); }
  };
  drop.addEventListener('click', async () => handle(await U.pickFile('.xml,.mpp,.xlsx,.xls,.csv,.ods,.tsv,.amproj,.json')));
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files[0]); });
  const dlg = UI.dialog({ title: 'Impor', width: 'min(560px, 100%)', body: el('div', drop, inProject ? UI.radio('impm', [['new', 'Buka sebagai proyek baru'], ['insert', 'Sisipkan ke proyek ini (di bawah ringkasan baru)']], 'new', v => { mode = v; }) : null,
    el('p.hint', 'Dari Microsoft Project: Berkas › Simpan Sebagai › XML. Dari Excel: baris pertama berisi judul kolom seperti Nama Tugas, Durasi, Mulai, Pendahulu, Sumber Daya.')), buttons: [{ label: 'Tutup' }] });
};
})();
