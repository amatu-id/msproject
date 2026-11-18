// Amatu Project — templat proyek (tugas berjenjang, tautan, sumber daya + tarif dalam Rupiah).
// Baris: [tingkat, nama, durasi hari ('m' = tonggak), pendahulu (nomor baris templat, "3,5" atau "4SS+2"), sumber daya]
(() => {
'use strict';
const AP = window.AP, U = AP.U, M = AP.M, S = AP.S, D = AP.D, Store = AP.Store;
const Tpl = AP.Tpl = {};
const R = (name, type, std, extra = {}) => ({ name, type, std, ...extra });
const T = {
  simple: { t: 'Rencana Proyek Sederhana', d: 'Inisiasi → perencanaan → pelaksanaan → penutupan', icon: 'checklist',
    res: [R('Manajer Proyek', 'work', 120000, { u: 'h', ini: 'MP' }), R('Tim Teknis', 'work', 80000, { u: 'h', max: 3, ini: 'TT' }), R('Sponsor', 'work', 0, { ini: 'SP' })],
    rows: [
      [1, 'Inisiasi'], [2, 'Tentukan tujuan & ruang lingkup', 2, '', 'Manajer Proyek'], [2, 'Identifikasi pemangku kepentingan', 1, '2', 'Manajer Proyek'], [2, 'Piagam proyek disetujui', 'm', '3', 'Sponsor'],
      [1, 'Perencanaan'], [2, 'Susun WBS & jadwal', 3, '4', 'Manajer Proyek'], [2, 'Rencana anggaran', 2, '6', 'Manajer Proyek'], [2, 'Rencana risiko & komunikasi', 2, '6', 'Manajer Proyek;Tim Teknis'], [2, 'Rencana disetujui', 'm', '7,8', 'Sponsor'],
      [1, 'Pelaksanaan'], [2, 'Pekerjaan tahap 1', 10, '9', 'Tim Teknis[200%]'], [2, 'Pekerjaan tahap 2', 10, '11', 'Tim Teknis[200%]'], [2, 'Uji & perbaikan', 4, '12', 'Tim Teknis'], [2, 'Hasil kerja selesai', 'm', '13'],
      [1, 'Pemantauan & Pengendalian'], [2, 'Laporan kemajuan', 2, '11SS+5', 'Manajer Proyek'], [2, 'Kendali perubahan', 1, '16', 'Manajer Proyek'],
      [1, 'Penutupan'], [2, 'Serah terima hasil', 2, '14', 'Manajer Proyek;Sponsor'], [2, 'Evaluasi & pelajaran', 1, '19', 'Manajer Proyek;Tim Teknis'], [2, 'Proyek selesai', 'm', '20'],
    ] },
  house: { t: 'Pembangunan Rumah', d: 'Persiapan, pondasi, struktur, dinding, atap, MEP, finishing + material', icon: 'construction',
    res: [R('Mandor', 'work', 150000, { u: 'd', ini: 'MD' }), R('Tukang', 'work', 130000, { u: 'd', max: 4, ini: 'TK' }), R('Pekerja', 'work', 100000, { u: 'd', max: 6, ini: 'PK' }),
      R('Semen', 'material', 70000, { mat: 'sak' }), R('Pasir', 'material', 300000, { mat: 'm³' }), R('Bata merah', 'material', 900, { mat: 'buah' }), R('Besi beton', 'material', 14000, { mat: 'kg' }), R('Sewa alat', 'cost', 0)],
    rows: [
      [1, 'Pekerjaan Persiapan'], [2, 'Pembersihan lahan', 2, '', 'Pekerja[200%]'], [2, 'Pengukuran & bouwplank', 2, '2', 'Mandor;Tukang'], [2, 'Direksi keet & gudang', 3, '2', 'Tukang;Pekerja'],
      [1, 'Pekerjaan Tanah & Pondasi'], [2, 'Galian tanah pondasi', 4, '3', 'Pekerja[400%];Sewa alat[Rp1.500.000]'], [2, 'Urugan pasir & lantai kerja', 2, '6', 'Pekerja[200%];Pasir[6 m³];Semen[10 sak]'], [2, 'Pasangan pondasi batu kali', 6, '7', 'Tukang[200%];Pekerja[200%];Semen[60 sak];Pasir[12 m³]'], [2, 'Sloof beton bertulang', 5, '8', 'Tukang[200%];Pekerja[200%];Besi beton[650 kg];Semen[45 sak]'], [2, 'Urugan kembali & pemadatan', 2, '9', 'Pekerja[300%]'], [2, 'Pondasi selesai', 'm', '10'],
      [1, 'Pekerjaan Struktur'], [2, 'Kolom praktis', 5, '11', 'Tukang[200%];Pekerja[200%];Besi beton[420 kg];Semen[30 sak]'], [2, 'Ring balok', 5, '13', 'Tukang[200%];Pekerja[200%];Besi beton[380 kg];Semen[28 sak]'],
      [1, 'Pekerjaan Dinding'], [2, 'Pasangan bata', 10, '13SS+2', 'Tukang[300%];Pekerja[300%];Bata merah[9000 buah];Semen[70 sak];Pasir[14 m³]'], [2, 'Plesteran', 8, '16FS-2', 'Tukang[200%];Pekerja[200%];Semen[55 sak];Pasir[10 m³]'], [2, 'Acian', 5, '17', 'Tukang[200%];Semen[25 sak]'],
      [1, 'Pekerjaan Atap'], [2, 'Rangka atap baja ringan', 4, '14', 'Tukang[200%];Sewa alat[Rp750.000]'], [2, 'Penutup atap genteng', 3, '20', 'Tukang[200%];Pekerja'], [2, 'Lisplang & talang', 2, '21', 'Tukang'],
      [1, 'Kusen, Pintu & Jendela'], [2, 'Pasang kusen', 3, '16SS+5', 'Tukang'], [2, 'Daun pintu & jendela', 3, '18,24', 'Tukang'],
      [1, 'Mekanikal & Elektrikal'], [2, 'Instalasi listrik', 5, '16SS+4', 'Tukang'], [2, 'Instalasi air bersih & kotor', 5, '16SS+4', 'Tukang;Pekerja'], [2, 'Septic tank & resapan', 3, '10', 'Tukang;Pekerja[200%]'],
      [1, 'Finishing'], [2, 'Plafon gypsum', 5, '21,27', 'Tukang[200%]'], [2, 'Keramik lantai', 6, '18', 'Tukang[200%];Pekerja;Semen[30 sak]'], [2, 'Keramik kamar mandi', 3, '28,32', 'Tukang'], [2, 'Pengecatan', 6, '31,33', 'Tukang[200%];Pekerja'], [2, 'Pasang sanitair & lampu', 2, '34', 'Tukang'],
      [1, 'Serah Terima'], [2, 'Pembersihan akhir', 2, '35', 'Pekerja[300%]'], [2, 'Serah terima kunci', 'm', '37', 'Mandor'],
    ] },
  software: { t: 'Pengembangan Perangkat Lunak', d: 'Analisis, desain, pengembangan, pengujian, rilis', icon: 'code',
    res: [R('Manajer Proyek', 'work', 150000, { u: 'h' }), R('Analis Bisnis', 'work', 110000, { u: 'h' }), R('Desainer UI/UX', 'work', 100000, { u: 'h' }), R('Pengembang', 'work', 120000, { u: 'h', max: 3 }), R('Penguji QA', 'work', 90000, { u: 'h', max: 2 }), R('Server & lisensi', 'cost', 0)],
    rows: [
      [1, 'Analisis Kebutuhan'], [2, 'Wawancara pengguna', 3, '', 'Analis Bisnis'], [2, 'Dokumen kebutuhan (SRS)', 4, '2', 'Analis Bisnis'], [2, 'Persetujuan kebutuhan', 'm', '3', 'Manajer Proyek'],
      [1, 'Desain'], [2, 'Arsitektur sistem', 3, '4', 'Pengembang'], [2, 'Wireframe & prototipe', 5, '4', 'Desainer UI/UX'], [2, 'Desain basis data', 2, '6', 'Pengembang'], [2, 'Tinjauan desain', 1, '7,8', 'Manajer Proyek;Pengembang;Desainer UI/UX'],
      [1, 'Pengembangan'], [2, 'Backend & API', 12, '9', 'Pengembang[200%]'], [2, 'Frontend', 12, '9', 'Pengembang'], [2, 'Integrasi', 4, '11,12', 'Pengembang[200%]'], [2, 'Siap diuji', 'm', '13'],
      [1, 'Pengujian'], [2, 'Uji fungsional', 5, '14', 'Penguji QA[200%]'], [2, 'Perbaikan bug', 4, '16SS+2', 'Pengembang[200%]'], [2, 'Uji penerimaan pengguna (UAT)', 3, '16,17', 'Analis Bisnis;Penguji QA'],
      [1, 'Rilis'], [2, 'Persiapan server produksi', 2, '13', 'Pengembang;Server & lisensi[Rp4.500.000]'], [2, 'Rilis ke produksi', 1, '18,20', 'Pengembang'], [2, 'Pelatihan pengguna', 2, '21', 'Analis Bisnis'], [2, 'Go-live', 'm', '22', 'Manajer Proyek'],
    ] },
  agile: { t: 'Scrum — 3 Sprint', d: 'Backlog, sprint 2 mingguan, review & retrospektif', icon: 'sprint',
    res: [R('Product Owner', 'work', 130000, { u: 'h' }), R('Scrum Master', 'work', 120000, { u: 'h' }), R('Tim Pengembang', 'work', 110000, { u: 'h', max: 4 })],
    rows: [
      [1, 'Persiapan'], [2, 'Visi produk & backlog awal', 3, '', 'Product Owner'], [2, 'Sprint 0: lingkungan kerja', 3, '2', 'Tim Pengembang[200%]'],
      [1, 'Sprint 1'], [2, 'Sprint planning 1', 1, '3', 'Product Owner;Scrum Master;Tim Pengembang[400%]'], [2, 'Pengembangan sprint 1', 8, '5', 'Tim Pengembang[400%]'], [2, 'Review & retrospektif 1', 1, '6', 'Product Owner;Scrum Master;Tim Pengembang[400%]'], [2, 'Inkremen 1', 'm', '7'],
      [1, 'Sprint 2'], [2, 'Sprint planning 2', 1, '8', 'Product Owner;Scrum Master;Tim Pengembang[400%]'], [2, 'Pengembangan sprint 2', 8, '10', 'Tim Pengembang[400%]'], [2, 'Review & retrospektif 2', 1, '11', 'Product Owner;Scrum Master;Tim Pengembang[400%]'], [2, 'Inkremen 2', 'm', '12'],
      [1, 'Sprint 3'], [2, 'Sprint planning 3', 1, '13', 'Product Owner;Scrum Master;Tim Pengembang[400%]'], [2, 'Pengembangan sprint 3', 8, '15', 'Tim Pengembang[400%]'], [2, 'Review & retrospektif 3', 1, '16', 'Product Owner;Scrum Master;Tim Pengembang[400%]'], [2, 'Rilis produk', 'm', '17', 'Product Owner'],
    ] },
  event: { t: 'Penyelenggaraan Acara', d: 'Seminar/konferensi: tempat, pembicara, promosi, hari-H', icon: 'celebration',
    res: [R('Ketua Panitia', 'work', 0), R('Tim Acara', 'work', 0, { max: 3 }), R('Tim Promosi', 'work', 0, { max: 2 }), R('Sewa gedung', 'cost', 0), R('Konsumsi', 'material', 45000, { mat: 'porsi' }), R('Cetak & spanduk', 'cost', 0)],
    rows: [
      [1, 'Perencanaan'], [2, 'Tentukan konsep, tanggal & anggaran', 3, '', 'Ketua Panitia'], [2, 'Bentuk kepanitiaan', 2, '2', 'Ketua Panitia'], [2, 'Konsep disetujui', 'm', '3'],
      [1, 'Tempat & Logistik'], [2, 'Survei & sewa tempat', 5, '4', 'Tim Acara;Sewa gedung[Rp15.000.000]'], [2, 'Vendor konsumsi', 3, '6', 'Tim Acara;Konsumsi[300 porsi]'], [2, 'Sound system & dekorasi', 3, '6', 'Tim Acara'],
      [1, 'Pembicara & Materi'], [2, 'Undang pembicara', 5, '4', 'Ketua Panitia'], [2, 'Susun rundown', 2, '10', 'Tim Acara'], [2, 'Kumpulkan materi', 5, '10', 'Tim Acara'],
      [1, 'Promosi & Pendaftaran'], [2, 'Desain publikasi', 3, '4', 'Tim Promosi;Cetak & spanduk[Rp2.500.000]'], [2, 'Kampanye media sosial', 15, '14', 'Tim Promosi'], [2, 'Pendaftaran peserta', 15, '14SS+2', 'Tim Promosi'],
      [1, 'Pelaksanaan'], [2, 'Gladi bersih', 1, '7,8,11,12', 'Tim Acara[300%];Ketua Panitia'], [2, 'Hari-H acara', 1, '18,15,16', 'Tim Acara[300%];Tim Promosi[200%];Ketua Panitia'], [2, 'Evaluasi & laporan', 3, '19', 'Ketua Panitia'], [2, 'Acara selesai', 'm', '20'],
    ] },
  launch: { t: 'Peluncuran Produk', d: 'Riset pasar, branding, kanal penjualan, kampanye', icon: 'rocket_launch',
    res: [R('Manajer Produk', 'work', 140000, { u: 'h' }), R('Tim Pemasaran', 'work', 90000, { u: 'h', max: 3 }), R('Desainer', 'work', 95000, { u: 'h' }), R('Iklan digital', 'cost', 0)],
    rows: [
      [1, 'Riset'], [2, 'Riset pasar & pesaing', 5, '', 'Tim Pemasaran'], [2, 'Persona & proposisi nilai', 3, '2', 'Manajer Produk'], [2, 'Strategi harga', 2, '3', 'Manajer Produk'],
      [1, 'Branding & Materi'], [2, 'Nama, logo & kemasan', 6, '3', 'Desainer'], [2, 'Foto & video produk', 4, '6', 'Desainer;Tim Pemasaran'], [2, 'Situs & halaman produk', 5, '6', 'Desainer'],
      [1, 'Kanal Penjualan'], [2, 'Marketplace & toko online', 4, '4,8', 'Tim Pemasaran'], [2, 'Mitra distributor', 6, '4', 'Manajer Produk'],
      [1, 'Kampanye'], [2, 'Pra-peluncuran (teaser)', 7, '7,8', 'Tim Pemasaran[200%];Iklan digital[Rp5.000.000]'], [2, 'Hari peluncuran', 'm', '13,10,11'], [2, 'Iklan & promosi pasca-peluncuran', 14, '14', 'Tim Pemasaran[200%];Iklan digital[Rp12.000.000]'], [2, 'Evaluasi penjualan bulan pertama', 2, '15', 'Manajer Produk'],
    ] },
  office: { t: 'Renovasi Kantor', d: 'Desain, izin, pekerjaan sipil, interior, pindahan', icon: 'domain',
    res: [R('Koordinator', 'work', 0), R('Kontraktor', 'work', 0, { max: 5 }), R('Desainer Interior', 'work', 0), R('Furnitur', 'cost', 0), R('Jasa pindahan', 'cost', 0)],
    rows: [
      [1, 'Perencanaan'], [2, 'Kebutuhan ruang & anggaran', 3, '', 'Koordinator'], [2, 'Desain interior', 7, '2', 'Desainer Interior'], [2, 'Pengurusan izin pengelola gedung', 5, '2', 'Koordinator'], [2, 'Pilih kontraktor', 4, '3', 'Koordinator'],
      [1, 'Pekerjaan Sipil'], [2, 'Bongkar & bersihkan', 3, '4,5', 'Kontraktor[300%]'], [2, 'Partisi & plafon', 6, '7', 'Kontraktor[300%]'], [2, 'Listrik, data & AC', 6, '7SS+2', 'Kontraktor[200%]'], [2, 'Lantai & pengecatan', 5, '8', 'Kontraktor[300%]'],
      [1, 'Interior & Pindahan'], [2, 'Pengadaan furnitur', 10, '3', 'Koordinator;Furnitur[Rp85.000.000]'], [2, 'Pemasangan furnitur', 3, '10,12', 'Kontraktor[200%]'], [2, 'Pindahan & instalasi IT', 2, '13,9', 'Koordinator;Jasa pindahan[Rp7.500.000]'], [2, 'Kantor baru siap dipakai', 'm', '14'],
    ] },
  thesis: { t: 'Penelitian & Skripsi', d: 'Proposal, kajian pustaka, pengumpulan data, sidang', icon: 'school',
    res: [R('Mahasiswa', 'work', 0), R('Pembimbing', 'work', 0)],
    rows: [
      [1, 'Proposal'], [2, 'Pilih topik & judul', 5, '', 'Mahasiswa'], [2, 'Bab 1 Pendahuluan', 7, '2', 'Mahasiswa'], [2, 'Bab 2 Kajian pustaka', 10, '3SS+3', 'Mahasiswa'], [2, 'Bab 3 Metodologi', 7, '4', 'Mahasiswa'], [2, 'Bimbingan proposal', 3, '5', 'Pembimbing;Mahasiswa'], [2, 'Seminar proposal', 'm', '6'],
      [1, 'Penelitian'], [2, 'Susun instrumen', 5, '7', 'Mahasiswa'], [2, 'Pengumpulan data', 15, '9', 'Mahasiswa'], [2, 'Olah & analisis data', 10, '10', 'Mahasiswa'],
      [1, 'Penulisan'], [2, 'Bab 4 Hasil & pembahasan', 12, '11SS+5', 'Mahasiswa'], [2, 'Bab 5 Kesimpulan', 4, '13', 'Mahasiswa'], [2, 'Bimbingan & revisi', 8, '14', 'Pembimbing;Mahasiswa'],
      [1, 'Sidang'], [2, 'Pendaftaran sidang', 2, '15', 'Mahasiswa'], [2, 'Sidang skripsi', 'm', '17'], [2, 'Revisi pasca-sidang', 7, '18', 'Mahasiswa'], [2, 'Unggah & yudisium', 'm', '19'],
    ] },
};
Tpl.T = T;
// build a project from a template
Tpl.make = (id, start) => {
  const def = T[id];
  const P = M.newProject(def.t, start);
  const o = P.opts;
  for (const r of def.res) {
    const x = M.newRes(P, { name: r.name, type: r.type, ini: r.ini || r.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase(), max: r.max || 1, mat: r.mat || '', std: { v: r.std || 0, u: r.type === 'work' ? r.u || 'h' : 'h' } });
    P.res.push(x);
  }
  const tasks = def.rows.map(row => {
    const [lvl, name, dur] = row;
    const ms = dur === 'm';
    return M.newTask(P, { name, lvl, dur: ms ? 0 : dur == null ? o.hpd * 60 : dur * o.hpd * 60, est: false, tl: lvl === 1 || ms });
  });
  P.tasks = tasks;
  M.index(P);
  def.rows.forEach((row, i) => {
    const pred = row[3];
    if (pred) tasks[i].pred = D.parsePreds(pred.replace(/([+-]\d+(?:[.,]\d+)?)(?![a-z%\d])/gi, '$1h'), P, tasks[i]);
  });
  M.index(P);
  def.rows.forEach((row, i) => { if (row[4] && !tasks[i].sum) M.setResText(P, tasks[i], row[4]); });
  for (const t of tasks) t.effort = false;
  S.calc(P);
  return P;
};
let cache = null;
Tpl.list = () => {
  if (cache) return cache;
  cache = Object.entries(T).map(([id, d]) => {
    let preview = [];
    try { const P = Tpl.make(id, U.mk(2026, 0, 5, 8)); preview = Store.thumb(P); } catch (e) { console.warn('tpl', id, e); }
    return { id, t: d.t, d: d.d, icon: d.icon, preview };
  });
  return cache;
};
})();
