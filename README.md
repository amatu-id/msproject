# Amatu Project

Perencanaan & pengendalian proyek gaya **Microsoft Project** di browser — bagian dari [Portal AMATU](https://amatu-id.github.io/).

**Buka:** https://amatu-id.github.io/msproject/

## Fitur
- **Tugas & jadwal**: tugas berjenjang (indent/outdent), ringkasan & ringkasan proyek, tonggak, tugas berulang, tugas manual/otomatis, durasi perkiraan & elapsed, tugas terpisah (split), tidak aktif, WBS & nomor kerangka.
- **Penjadwalan CPM**: tautan FS/SS/FF/SF + lag (hari/jam/%/elapsed), tautan ke ringkasan, batasan (ASAP, ALAP, SNET, SNLT, FNET, FNLT, MSO, MFO), tenggat, jadwal dari tanggal selesai, slack total/bebas, jalur kritis (termasuk beberapa jalur kritis), Periksa Tugas.
- **Kalender kerja**: Standar, 24 Jam, Shift Malam, kalender sendiri, pengecualian berulang, minggu kerja, libur nasional Indonesia, kalender tugas & sumber daya.
- **Sumber daya**: kerja/material/biaya, unit maks, tarif standar/lembur, biaya per pemakaian, akrual, jenis tugas (unit/durasi/kerja tetap), didorong upaya, kontur kerja, alokasi berlebih, **pemerataan** (Ratakan Pilihan/Sumber Daya/Semua).
- **Pelacakan**: % selesai, aktual, Perbarui Tugas/Proyek, Tandai Sesuai Jadwal, tanggal status, garis dasar 0–10 & rencana sementara, varians, nilai hasil (PV/EV/AC/SPI/CPI/EAC/VAC/TCPI), garis kemajuan.
- **Tampilan**: Bagan Gantt, Gantt Pelacakan/Rinci/Pemerataan, Lembar Tugas, Penggunaan Tugas, Kalender, Diagram Jaringan, Garis Waktu, Papan Tugas, Perencana Tim, Lembar/Penggunaan/Grafik Sumber Daya, 16 laporan dasbor.
- **Data**: tabel (Entri, Biaya, Jadwal, Pelacakan, Varians, Kerja, Nilai Hasil, …), filter & sorot (termasuk kustom & AutoFilter), kelompok, urut, kolom kustom dengan rumus & indikator grafis, cari/ganti, salin/tempel, undo/redo, riwayat versi, kunci kata sandi.
- **Cetak / PDF** (setara pengaturan ekspor Amatu Sheets): cakupan dipilih otomatis (tampilan aktif, seluruh proyek, tugas terpilih, tingkat kerangka, atau paket lengkap), orientasi & skala otomatis, skala waktu pas di kertas, pemisah halaman rapi (grup tugas tidak terpotong, judul kolom + skala waktu + ringkasan induk diulang, pemisah manual), legenda, nomor halaman.
- **Ekspor/Impor**: Excel .xlsx (lembar kerja dipilih otomatis + pengaturan cetak & pemisah halaman di file), Microsoft Project XML (ekspor & impor), CSV, PNG, kalender .ics, file .amproj.

## Pengembangan
Tanpa framework: skrip klasik `js/*.js` (namespace `window.AP`), lihat `DESIGN.md`.
`./build.sh` memeriksa sintaks, lalu menulis `index.html` (cap versi `?v=`) dan `versi.txt`. Terbit = commit + `git push` (GitHub Pages, cabang `main`).
