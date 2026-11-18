# Amatu Project — catatan desain (untuk pengembang)

Klon Microsoft Project di browser. Tanpa framework/bundler: skrip klasik `js/*.js` dimuat berurutan oleh
`index.src.html`; `./build.sh` menulis `index.html` dengan `?v=<hash>` + `versi.txt`. Semua modul menempel ke
`window.AP`.

## Waktu
- Semua waktu = **menit sejak epoch, jam dinding lokal disimpan sebagai UTC** (integer). `U.mk(y,m,d,h,mi)`,
  `U.ymd(t)`, `U.today()`, `U.fmtDate(t, fmt)`, `U.parseDate(str)`. Tidak ada DST.
- Indeks hari `di = floor(t/1440)`, hari-minggu `(di+4)%7` (0 = Minggu).
- Durasi kerja dalam menit kerja: 1h(ari) = `opts.hpd*60`, 1mg = `opts.hpw*60`, 1bln = `opts.dpm*opts.hpd*60`.
  Durasi elapsed (`e`) = menit kalender.

## Data proyek (P) — lihat `M.newProject`
- `P.tasks[]` urut kerangka (ID = indeks+1), tiap tugas punya `uid` tetap. `lvl` = tingkat kerangka (1..).
  Ringkasan = tugas yang diikuti tugas ber-`lvl` lebih dalam (dihitung `M.index`).
- Input tugas: name, lvl, mode('auto'|'manual'), dur (menit kerja), durU, est, el(elapsed), ms(milestone paksa),
  mStart/mFinish (manual), cons/consDate, deadline, pri, type('FU'|'FD'|'FW'), effort, cal, pred[{uid,type,lag,lagU,pct,el}],
  pct, aStart, aFinish, fixedCost, fca, notes, link, active, hideBar, tl(timeline), ld(leveling delay, menit elapsed),
  splits[[off,gap]], bl{n:{s,f,d,w,c}}, x{text1..,num1..,flag1..,date1..}, style{b,i,u,c,bg}, col(collapsed), pb(page break), board.
- Hasil hitung (`S.calc`): id, parent, kids, sum, outline, wbs, start, finish, es, ef, ls, lf, ts, fs, crit, work, cost,
  aWork, aCost, status, over, warn, ev{...}.
- `P.res[]` sumber daya, `P.asg[]` penugasan {uid,t,r,units,work,cost,contour,delay}.
- `P.cals[]` kalender {id,name,base,week[7] (null=ikut base), exc[{name,from,to,work,rec}], ww[]}.

## Modul
U util · Cal kalender · D durasi/parse · M model+operasi · S penjadwal (CPM) · Lv pemerataan · F kolom/tabel ·
Fx rumus kolom kustom · TS skala waktu · UI dialog/menu/toast · Grid tabel virtual · Chart Gantt · V tampilan ·
Rep laporan · IO impor/ekspor · Pg tata letak cetak · Pr dialog cetak · Store IndexedDB · Tpl templat · app.
- Semua perubahan data lewat `app.tx(label, fn)` (undo/redo snapshot JSON → `S.calc` → render → autosave).
- IndexedDB `amatu-msproject` (stores meta, projects, versions) → disinkron otomatis oleh /amatu.js (Portal AMATU).
