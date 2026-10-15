/* Pembuat Panduan Data Induk (15 Okt 2026) — mesin sama dengan Tryout_Guru, absen_ekskul, kehadiran_guru, induk_pembiayaan
   ---------------------------------------------------------------
   Satu sumber isi (ISI di bawah) → dua berkas di akar proyek, dibuka lewat tombol 📘 Panduan di bilah samping:
     Panduan_Data_Induk.pdf   (dicetak Chrome/Edge tanpa jendela, lewat DevTools Protocol)
     Panduan_Data_Induk.docx  (paket npm "docx")
   Jalankan dari akar proyek (paket docx dipinjam dari Tryout_Guru, tidak perlu node_modules di sini):
     NODE_PATH=../Tryout_Guru/node_modules node alat/buat-panduan.js
   Ubah isi panduan di sini bila tampilan atau aturan aplikasi berubah, lalu jalankan ulang. */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), { spawn } = require("child_process");

const SUBJUDUL = "Siswa, guru, kelas, jadwal KBM, tugas, piket, jam kerja, tahun ajaran, dan profil dokumen", UNTUK = "operator data / Tata Usaha, Wakasek Kurikulum, dan Kepala Sekolah";
const AKAR = path.join(__dirname, ".."), NAMA = "Panduan_Data_Induk";
const JUDUL = "Panduan Data Induk Sekolah", VERSI = "15 Oktober 2026", MEREK = "DATA INDUK SEKOLAH · SMA PLUS MERDEKA SOREANG";

/* ================= Isi panduan =================
   Blok: H1/H2/H3 (judul, dinomori otomatis), P (paragraf), UL/OL (daftar), TB (tabel: kepala, baris, lebar relatif),
   KOTAK (jenis: info | saran | awas | bahaya), STAT (kotak angka contoh). Teks boleh memakai **tebal**. */
const H1 = s => ({ t: "h1", s }), H2 = s => ({ t: "h2", s }), H3 = s => ({ t: "h3", s }), P = s => ({ t: "p", s });
const UL = (...a) => ({ t: "ul", a }), OL = (...a) => ({ t: "ol", a });
const TB = (kepala, baris, lebar) => ({ t: "tb", kepala, baris, lebar: lebar || kepala.map(() => 1) });
const KOTAK = (jenis, judul, ...isi) => ({ t: "kotak", jenis, judul, isi });
const STAT = (ket, ...a) => ({ t: "stat", a, ket });

const ISI = [
  /* ============================ 1 ============================ */
  H1("Mengenal Data Induk"),
  P("Data Induk adalah **satu-satunya tempat mengubah data pokok sekolah**: siswa, guru, kelas, mata pelajaran, jadwal KBM, tugas guru, jadwal piket, jam kerja staf, tahun ajaran, dan kop dokumen. Aplikasi lain hanya **membaca** data ini — satu tempat mengubah, banyak tempat membaca."),
  TB(["Aplikasi", "Yang dibaca dari Data Induk"], [
    ["**Kehadiran Guru**", "Jadwal KBM, jadwal piket (meja, unit, parkiran), tugas guru, jam kerja staf"],
    ["**Absensi Ekstrakurikuler**", "Data siswa, pembina dari data guru dan tugas Pembina Ekskul/Tahfidz"],
    ["**Induk Pembiayaan**", "Masa kerja, tugas dan pola honor staf, kelompok tarif, pengesahan TuSehat/TuKerja"],
    ["**Asesmen/Tryout, Matematika Dasar, English Reading**", "Siswa, kelas, kelompok belajar, dan guru (ditarik lewat tombol sinkron di aplikasi masing-masing)"],
    ["**Semua aplikasi**", "Tahun ajaran aktif dan kop dokumen (Profil Dokumen)"],
  ], [2.2, 3.8]),
  KOTAK("awas", "Perubahan di sini berdampak ke semua aplikasi",
    "Mengubah jadwal, tugas, atau status guru langsung memengaruhi pencatatan kehadiran dan perhitungan honor. Periksa dua kali sebelum menyimpan, dan utamakan **Akhiri / ubah status** daripada **Hapus** supaya riwayat tetap utuh."),
  H2("Menu aplikasi"),
  TB(["Menu", "Isi"], [
    ["**Beranda**", "Ringkasan siswa, guru, rombel; peringatan data yang belum lengkap; unduh cadangan."],
    ["**Data Siswa**", "Daftar siswa, pindah kelas, ubah status, unggah dari Excel, daftar hadir kelas."],
    ["**Kelas dan Rombel**", "Rombongan belajar tahun ajaran aktif."],
    ["**Kelompok Belajar**", "Kelompok Tahsin dan Matematika Dasar, anggota, pengecualian."],
    ["**Mata Pelajaran**", "Kode, nama, dan rumpun mata pelajaran."],
    ["**Data Guru**", "Identitas guru dan staf, status, TMT, pengesahan TuSehat/TuKerja."],
    ["**Jadwal KBM**", "Menyusun jadwal mengajar per kelas, per guru, per hari."],
    ["**Jabatan dan Unit**", "Pilihan jabatan untuk tugas Staf dan Diperbantukan."],
    ["**Tugas Guru**", "Wali kelas, staf, tugas tambahan, diperbantukan, piket, pembina."],
    ["**Jadwal Piket**", "Piket meja sekolah, piket unit, piket parkiran."],
    ["**Jam Kerja Staf**", "Jam masuk–pulang bawaan dan pengecualian per orang."],
    ["**Tahun Ajaran**", "Tahun ajaran baru, kenaikan kelas, cadangan lengkap."],
    ["**Profil Dokumen**", "Kop surat, identitas sekolah, penanda tangan."],
  ], [1.7, 4.3]),
  P("Di komputer, menu ada di bilah samping kiri. Di HP, menu tersusun di bagian atas layar dan beberapa kolom tabel disembunyikan supaya muat — untuk menyusun jadwal dan piket, gunakan komputer."),

  /* ============================ 2 ============================ */
  H1("Masuk dan Keluar"),
  OL("Buka alamat aplikasi. Isi **Nama petugas** (nama Anda sendiri) dan **Kata sandi** Data Induk, lalu **Masuk**.",
    "Nama Anda tampil di kaki bilah samping, bersama tahun ajaran aktif dan tombol **Keluar**."),
  KOTAK("info", "Tulis nama sendiri",
    "Kata sandinya dipakai bersama, tetapi **nama petugas dicatat pada setiap perubahan data** (termasuk sebagai pengesah tunjangan). Selalu tulis nama Anda sendiri, bukan nama orang lain."),
  UL("Sesi tidak disimpan di peramban: **memuat ulang halaman (F5) atau menutup tab berarti masuk lagi**.",
    "Bila muncul \"Sesi berakhir. Silakan masuk kembali.\", masuk lagi; data yang sudah tersimpan tidak hilang.",
    "Komputer sekolah dipakai bersama — **selalu tekan Keluar** setelah selesai."),

  /* ============================ 3 ============================ */
  H1("Siswa, Kelas, dan Kelompok Belajar"),
  H2("Data Siswa"),
  P("Saring dengan kotak **Cari nama, NISN, atau NIS…**, pilihan status (bawaannya **aktif**), dan chip kelas. Siswa tidak aktif tampil pudar."),
  UL("**+ Tambah siswa** / **Ubah**: Nama lengkap, NISN (10 digit), NIS, Kelas (kelas baru dibuat otomatis), Jenis kelamin, Tanggal lahir, Status. NISN/NIS yang sudah dipakai siswa lain akan ditolak dengan nama pemiliknya.",
    "**Pindah kelas** atau **Ubah status** banyak siswa sekaligus: centang siswa, lalu pakai bilah di bawah layar.",
    "**Unduh data** (daftar siswa berkop) dan **Unduh daftar hadir** (satu kelas, atau satu lembar per kelas yang tampil)."),
  KOTAK("awas", "Siswa pindah, keluar, atau lulus: ubah statusnya, jangan dihapus",
    "Status **pindah / keluar / lulus** menjaga riwayat nilai, kehadiran, dan tryout siswa. **Hapus** hanya untuk salah input; data yang masih dipakai di tempat lain memang tidak bisa dihapus."),
  H3("Unggah data siswa dari Excel"),
  OL("Siapkan berkas .xlsx / .csv dengan kolom **Nama** (wajib), **NISN**, **NIS**, **Kelas**, **Tanggal lahir**, **Jenis kelamin**. Hasil **Unduh data** bisa dipakai sebagai contoh.",
    "Klik **Unggah berkas**, pilih berkasnya, lalu **Proses … baris**."),
  P("Pencocokan memakai **NISN**: yang sudah ada diperbarui, yang belum ada ditambahkan, **tidak ada yang dihapus**. Siswa tanpa NISN selalu dianggap siswa baru — lengkapi NISN supaya tidak tercatat ganda."),
  H2("Kelas dan Rombel"),
  UL("**+ Tambah rombel** dengan kode seperti 10-1, 11-3, 12-6 (tingkat diambil dari angka di depan).",
    "**Lihat siswa** membuka Data Siswa tersaring kelas itu. Wali kelas diatur di **Tugas Guru**.",
    "Rombel yang masih berisi siswa tidak bisa dihapus; pindahkan dulu siswanya."),
  H2("Kelompok Belajar (Tahsin dan Matematika Dasar)"),
  P("Siswa dikelompokkan ulang untuk Tahsin dan Matematika Dasar; rapornya tetap kembali ke wali kelas rombel masing-masing."),
  UL("**+ Tambah kelompok**: Nama kelompok (mis. MD11-1, Tahsin · Mahir 3), Mata pelajaran, dan Tingkat (kelompok bertingkat hanya menerima siswa setingkat).",
    "**+ Tambah anggota** memasukkan siswa yang belum berkelompok untuk mapel itu.",
    "**Pindah** / **Pindahkan … terpilih**: pilih kelompok tujuan dan **Berlaku mulai**. Keanggotaan lama ditutup sehari sebelumnya, sehingga riwayatnya tetap tercatat (klik nama siswa untuk melihat riwayat).",
    "**Keluarkan**: **Akhiri keanggotaan** (tidak lagi ikut) atau **Hapus (salah input)**.",
    "Panel **Di luar kelompok** menampilkan siswa yang **Belum dimasukkan** (kuning) — **Masukkan** atau **Kecualikan** dengan alasan (mis. tidak mengikuti program).",
    "Kelompok bisa **dinonaktifkan** bila sudah tanpa anggota dan tanpa jadwal di semester berjalan."),
  KOTAK("saran", "Perombakan kelompok sekaligus: lembar pindah",
    "**Unduh lembar pindah**, isi kolom kuning (kelompok baru atau alasan tidak ikut), lalu **Unggah lembar pindah** dengan tanggal berlaku. Hanya baris yang berubah yang diproses. Tanggal berlaku paling lambat hari ini — unggah pada hari pertama semester."),

  /* ============================ 4 ============================ */
  H1("Guru, Mata Pelajaran, dan Jabatan"),
  H2("Data Guru"),
  P("Daftar guru dan staf diurutkan menurut masa kerja (TMT di sekolah). Saring dengan **Cari nama, NIG, atau mapel…** dan status (bawaannya Aktif). Tombol **Tugas** pada baris membuka Tugas Guru tersaring guru itu."),
  UL("**+ Tambah guru** / **Ubah**: Nama lengkap dengan gelar, NIG (ID guru dibuat otomatis dari NIG), Jenis kelamin, **Jenis PTK**, **Status**, NIP, NUPTK, **TMT di sekolah ini** (dasar masa kerja), TMT sebagai guru, TMT status kepegawaian, TMT sebagai staf, pendidikan, jurusan, **Mata pelajaran utama**, linier, sertifikat pendidik, insentif lewat fingerprint, HP, email, catatan.",
    "NIG dan ID tidak bisa diubah setelah disimpan karena sudah dirujuk jadwal dan data lain.",
    "Guru yang berhenti: ubah **Status** menjadi **Nonaktif** (tidak ada hapus guru). Guru nonaktif tetap terbaca di data lama tetapi tidak muncul di daftar pilihan.",
    "Beranda memperingatkan guru aktif yang **TMT sekolah, mapel utama, atau Jenis PTK**-nya masih kosong — lengkapi, karena dipakai perhitungan honor dan tunjangan."),
  TB(["Jenis PTK", "Keterangan"], [
    ["**Guru Tetap Yayasan**", "Guru tetap yang Dapodiknya menginduk di sekolah ini."],
    ["**Guru Tidak Tetap**", "Dapodiknya tidak menginduk di sekolah ini, sehingga tidak berhak TuSehat."],
    ["**Tenaga Kependidikan**", "Staf / tenaga administrasi dan pendukung."],
    ["**Pimpinan**", "Kepala sekolah dan pimpinan."],
  ], [1.8, 4.2]),
  H2("Pengesahan TuSehat dan TuKerja (Kepala Sekolah)"),
  P("Database menghitung siapa yang **memenuhi syarat**; Kepala Sekolah yang **mengesahkan**. Hasilnya dibaca Induk Pembiayaan."),
  TB(["Tunjangan", "Syarat", "Gugur bila"], [
    ["**TuSehat** (Tunjangan Kesehatan)", "Masa kerja di sekolah ini genap 5 tahun dan bukan Guru Tidak Tetap.", "Guru nonaktif atau menjadi Guru Tidak Tetap."],
    ["**TuKerja** (Tunjangan Ketenagakerjaan)", "Memegang tugas Staf dan masa kerja genap 5 tahun (dari TMT di sekolah; Guru Tetap Yayasan yang merangkap staf: dari TMT sebagai staf).", "Guru nonaktif atau tidak lagi memegang tugas Staf."],
  ], [1.7, 2.8, 1.9]),
  OL("Lencana kuning **TuSehat: memenuhi syarat** (atau TuKerja) tampil di baris guru; kotak di atas daftar juga menyebut nama-namanya.",
    "Klik tombol **TuSehat** / **TuKerja** pada baris itu. Isi **Bulan pertama tunjangan** (bawaannya bulan sesudah genap lima tahun) dan catatan, lalu simpan.",
    "Lencana menjadi hijau **TuSehat sejak …**. Bila syarat gugur, lencana merah **terhenti**; tombol yang sama dipakai untuk **Cabut pengesahan** (riwayatnya tetap tersimpan)."),
  KOTAK("info", "Siapa yang mengesahkan",
    "Pengesahan dicatat atas nama petugas yang sedang masuk. Lakukan pengesahan dengan **nama Kepala Sekolah** saat masuk, atau oleh petugas atas persetujuan Kepala Sekolah."),
  H2("Mata Pelajaran"),
  P("**+ Tambah mapel**: Kode mapel (tidak bisa diubah kemudian), Nama, dan Rumpun (mis. MIPA, IPS, Bahasa, Umum — dipakai rekomendasi guru pengganti \"Serumpun\"). Mata pelajaran tidak bisa dihapus karena dirujuk jadwal; yang tidak dipakai cukup dibiarkan."),
  H2("Jabatan dan Unit"),
  P("Pilihan jabatan saat mencatat tugas **Staf** dan **Diperbantukan**. Kategori: **Struktural** (jabatan ber-SK), **Unit** (penanggung jawab bidang, mis. Lab, Perpustakaan), **Pendukung** (satpam, kebersihan, tenaga harian). Jabatan yang sudah dipegang hanya bisa dinonaktifkan."),

  /* ============================ 5 ============================ */
  H1("Jadwal KBM"),
  P("Jadwal disusun **di sini**; Kehadiran Guru hanya membacanya. Yang tampil adalah jadwal tahun ajaran aktif."),
  OL("Pilih sudut pandang **Per kelas**, **Per guru**, atau **Per hari**, dan **Semester** (1 · Jul–Des atau 2 · Jan–Jun).",
    "Ketuk sel kosong **+** untuk **Tambah jam pelajaran**: Kelas atau kelompok, Mata pelajaran, Guru, Hari, Jam ke, Semester.",
    "Ketuk blok yang ada untuk **Ubah** atau **Hapus**."),
  UL("Jam berurutan dengan pelajaran dan guru yang sama tampil sebagai satu blok (\"… jam\").",
    "**Bentrok ditolak**: guru tidak bisa dijadwalkan di dua tempat sekaligus, dan kelas tidak bisa punya dua pelajaran pada jam yang sama (kecuali kelompok belajar). Pada tampilan Per guru, **sel merah** menandai bentrok.",
    "**Sel bergaris** adalah jam kelompok belajar (Tahsin/MD) dan tidak diisi dari tampilan kelas — susun lewat **Per hari** + pilihan program, atau pilih kelompoknya di Per kelas. Kelompok boleh berisi lebih dari satu guru.",
    "**Unduh** (kelas/guru yang tampil) atau **Unduh semua kelas**: Excel berkop."),
  KOTAK("awas", "Jadwal semester 2 disusun tersendiri",
    "Belum ada fitur menyalin jadwal antarsemester; jadwal semester 2 diisi dari awal pada pilihan Semester 2. Jam pelajaran (jam ke-1 sampai ke-12 dan waktunya) diatur oleh admin database, tidak dari halaman ini."),

  /* ============================ 6 ============================ */
  H1("Tugas Guru"),
  P("Tugas yang melekat pada guru untuk tahun ajaran aktif. Satu guru boleh merangkap beberapa tugas. Saring per jenis dengan chip; **Unduh** mengikuti saringan."),
  TB(["Jenis tugas", "Isian khusus", "Dipakai untuk"], [
    ["**Wali Kelas**", "Kelas; jam piket meja per minggu", "Rombel dan rapor; honor wali kelas; upacara & bimbingan"],
    ["**Staf**", "Jabatan; **Pola honor**; sumber hari hadir; jam mengajar termasuk/di luar tupoksi; jam piket meja", "Gaji dan insentif staf, TuKerja, jam kerja"],
    ["**Tugas Tambahan**", "Jabatan; jam tambahan mengajar per minggu", "Tambahan jam kontrak (tanda (+n) di rekap)"],
    ["**Diperbantukan**", "Unit; jam piket unit per minggu", "Penjaga unit (Lab, Perpustakaan, dsb.)"],
    ["**Piket**", "Jam piket meja per minggu", "Guru yang berjaga di meja sekolah tanpa tugas Wali Kelas/Staf"],
    ["**Pembina Ekskul / OSIS, Pembimbing Tahfidz**", "—", "Pertemuannya dicatat di Absensi Ekskul"],
  ], [1.6, 2.6, 2.2]),
  UL("**Pola honor** staf: honor bulanan saja / bulanan + insentif kedatangan per hari hadir / upah harian per kedatangan. Nominalnya diisi di Induk Pembiayaan.",
    "Satu kelas satu wali, dan satu guru hanya boleh menjadi wali satu kelas.",
    "Wali Kelas dan Staf sudah membawa jam piket meja sendiri; tugas **Piket** terpisah untuk guru yang sama akan ditolak.",
    "**Akhiri** = tugas selesai, tetap tersimpan sebagai riwayat. **Hapus** = salah input (aplikasi menjelaskan dampaknya, mis. rombel menjadi tanpa wali).",
    "Baris merah \"belum ada: …\" berarti isian wajibnya belum lengkap."),
  KOTAK("info", "Penanda tangan dokumen",
    "Nama Wakasek Kurikulum, Wakasek Kesiswaan, dan Bendahara di semua dokumen diambil dari tugas aktif (mis. **Staf**) yang jabatannya **Wakasek Kurikulum**, **Wakasek Kesiswaan**, atau **Bendahara**. Bila pejabat berganti, akhiri tugas yang lama dan tambahkan yang baru."),

  /* ============================ 7 ============================ */
  H1("Jadwal Piket dan Jam Kerja Staf"),
  H2("Piket Meja Sekolah"),
  P("Tab **Matriks jadwal**: baris hari, kolom jam pelajaran. Panel **Sisa jam belum ditempatkan** menunjukkan berapa jam tiap petugas belum dijadwalkan dibandingkan jam piket yang disepakati di Tugas Guru."),
  UL("**Seret** nama dari daftar sisa ke sel matriks; seret pita untuk memindahkan; seret ke kotak bawah untuk mengeluarkan.",
    "Di HP atau layar sentuh: **ketuk sel**, lalu pilih **Tambahkan petugas** / **Keluarkan**.",
    "Guru yang sedang mengajar, menjaga unit, atau sudah berjaga pada jam itu tidak bisa ditempatkan (alasannya ditampilkan).",
    "Pita bergaris putus-putus = staf (piketnya termasuk jam kerja, tanpa transport). Label sisa: **pas**, **lebih … jam** (merah), **belum disepakati**.",
    "Tab **Petugas piket** merangkum jam per minggu dan apakah transportnya dihitung."),
  H2("Piket Unit + Diperbantukan"),
  P("Matriks yang sama untuk guru Diperbantukan. Angka transport tetap mengikuti jam kesepakatan di Tugas Guru, bukan jumlah kotak di matriks."),
  H2("Piket Parkiran"),
  P("Satu petugas per hari kerja, mengawasi parkiran sesudah jam pulang. Tekan **Tetapkan** / **Ubah** pada hari itu, pilih **Petugas** (tenaga kependidikan didahulukan) dan catatan, atau **Kosongkan**. Kehadirannya dicatat di Kehadiran Guru → Pelaksanaan Piket."),
  P("Setiap tab piket punya **Unduh**: lembar jadwal dan **Formulir Paraf** sepekan berkop."),
  H2("Jam Kerja Staf"),
  UL("Panel **Ketentuan bawaan sekolah**: ketuk hari untuk mengatur hari kerja, jam masuk, dan jam pulang.",
    "Panel **Staf yang tunduk** (pemegang tugas Staf dan Pimpinan): tekan **Atur** untuk pengecualian per orang per hari (**Ikut bawaan** / **Jam khusus** / **Libur**) dan **Kelompok tarif honor**.",
    "Jam kerja ini dipakai Kehadiran Guru (pembanding fingerprint: terlambat, pulang cepat) dan Induk Pembiayaan."),

  /* ============================ 8 ============================ */
  H1("Tahun Ajaran dan Profil Dokumen"),
  H2("Pergantian tahun ajaran"),
  P("Pergantian tahun ajaran **menambah data baru**, tidak menimpa yang lama. Langkah yang dianjurkan menjelang Juli:"),
  OL("**Unduh cadangan lengkap** lebih dulu.",
    "Isi penempatan kelas tahun baru, dengan salah satu cara:",
    "**Ganti tahun ajaran aktif** dengan **Jadikan aktif** pada tahun baru, lalu periksa Data Siswa, Kelas, dan Kelompok Belajar."),
  TB(["Cara", "Keterangan"], [
    ["**Lembar kenaikan (Excel)** — dianjurkan", "**Unduh lembar kenaikan**, isi kolom kuning: Rombel baru (10→11, 11→12, 12→LULUS, atau PINDAH/KELUAR), MD baru, Tahsin baru, atau alasan tidak ikut. **Unggah lembar kenaikan**: semua kesalahan ditampilkan dulu dan tidak ada yang disimpan sampai bersih. Bisa diunggah ulang untuk memperbaiki."],
    ["**Proses kenaikan kelas** (otomatis)", "Menaikkan seluruh rombel dengan nomor yang sama (10-1 → 11-1, 11-2 → 12-2). Kelompok belajar tidak ikut. Ketik **LANJUT** untuk menegaskan."],
  ], [2, 4]),
  KOTAK("awas", "Akibat \"Jadikan aktif\"",
    "Seluruh aplikasi sekolah langsung membaca tahun ajaran baru. Siswa kelas 12 yang tidak punya rombel di tahun baru ditandai **lulus**; siswa kelas 10–11 tanpa rombel hanya diperingatkan. Lakukan di luar jam sekolah, setelah penempatan kelas lengkap."),
  H2("Profil Dokumen"),
  P("Identitas dan kop yang dipakai **seluruh unduhan** di Data Induk, Kehadiran Guru, Absensi Ekstrakurikuler, dan Induk Pembiayaan."),
  UL("**Ubah profil**: Nama sekolah, Alamat, Kota tanda tangan, NPSN, Telepon, Email, Laman, Kepala sekolah, NIP kepala sekolah, Berkas logo, Catatan kaki.",
    "**Tata letak kop**: seret logo dan tulisan pada pratinjau A4, atur ukuran, perataan, garis pembatas, dan catatan kaki, lalu **Simpan tata letak** (berlaku di semua aplikasi). **Kembalikan ke bawaan** bila berantakan.",
    "**Penanda tangan dokumen**: Kepala Sekolah dari profil ini; Wakasek Kurikulum, Wakasek Kesiswaan, dan Bendahara dari **Tugas Guru**."),

  /* ============================ 9 ============================ */
  H1("Cadangan, Unduhan, dan Masalah Umum"),
  H2("Cadangan"),
  P("**Unduh cadangan** (Beranda) atau **Unduh cadangan lengkap** (Tahun Ajaran) menghasilkan satu berkas Excel berisi identitas, siswa, guru, rombel, tugas, mata pelajaran, dan tahun ajaran. Simpan sebelum perubahan besar (kenaikan kelas, unggah massal). Database sekolah juga dicadangkan otomatis setiap hari."),
  H2("Unduhan Excel"),
  P("Semua unduhan berbentuk Excel berkop dan memerlukan internet. Bila muncul \"Pembuat Excel (ExcelJS) tidak bisa diunduh dari internet\", jaringan sekolah kemungkinan memblokir cdnjs.cloudflare.com dan cdn.jsdelivr.net — coba lewat jaringan lain (mis. hotspot HP)."),
  H2("Masalah umum"),
  TB(["Keadaan / pesan", "Yang dilakukan"], [
    ["Data ini masih dipakai di tempat lain, jadi tidak bisa dihapus.", "Ubah statusnya menjadi nonaktif / keluar, atau akhiri tugasnya."],
    ["NISN ini sudah dipakai siswa lain…", "Periksa juga siswa berstatus pindah/keluar/lulus (pilih \"Semua status\")."],
    ["Jadwal ditolak / sel merah", "Guru atau kelas sudah terisi pada jam itu. Periksa tampilan Per guru."],
    ["Server terlalu lama menjawab saat menyimpan…", "Perubahan **mungkin sudah tersimpan**. Muat ulang, masuk lagi, dan periksa sebelum mengulang."],
    ["Tanggal berlaku paling lambat hari ini.", "Pindah kelompok tidak bisa diberi tanggal di masa depan; unggah pada hari pertama berlakunya."],
    ["Perubahan tidak terlihat di Kehadiran Guru", "Aplikasi itu menyimpan data rujukan ±15 menit; tunggu sebentar atau muat ulang di sana."],
    ["Aplikasi gagal dimuat", "Muat ulang paksa dengan **Ctrl+Shift+R**; bila tetap, kirim pesan galatnya apa adanya ke pengelola aplikasi."],
  ], [2.6, 3.4]),
  H2("Istilah"),
  TB(["Istilah", "Arti"], [
    ["**Rombel**", "Rombongan belajar; dasar wali kelas dan rapor."],
    ["**Kelompok belajar**", "Pengelompokan ulang untuk Tahsin dan Matematika Dasar."],
    ["**NISN / NIS / NIG**", "Nomor induk siswa nasional (10 digit) / nomor induk sekolah / nomor induk guru."],
    ["**TMT**", "Terhitung mulai tanggal; TMT di sekolah ini menjadi dasar masa kerja."],
    ["**Jenis PTK**", "Jenis pendidik dan tenaga kependidikan (bagian 4)."],
    ["**TuSehat / TuKerja**", "Tunjangan Kesehatan / Tunjangan Ketenagakerjaan."],
    ["**Tugas melekat**", "Tugas yang dipegang guru pada tahun ajaran itu."],
    ["**Akhiri / Hapus**", "Selesai dengan riwayat tetap / buang karena salah input."],
    ["**Pola honor**", "Cara staf dibayar: bulanan, bulanan + insentif kedatangan, upah harian."],
    ["**Kelompok tarif**", "Golongan besaran honor staf (Kepala Sekolah, Wakil, Staf, Kepala TU, Tata Usaha, Caraka dan Satpam, Tenaga Pendukung)."],
  ], [1.7, 4.3]),
];

/* ================= Penomoran judul ================= */
(function nomori() { const n = [0, 0, 0];
  ISI.forEach(b => { if (!/^h[123]$/.test(b.t)) return; const k = +b.t[1] - 1; n[k]++; for (let i = k + 1; i < 3; i++) n[i] = 0;
    b.no = k === 0 ? `${n[0]}.` : n.slice(0, k + 1).join("."); b.id = "b" + n.slice(0, k + 1).join("-"); }); })();
const DAFTAR = ISI.filter(b => b.t === "h1" || b.t === "h2");

/* ================= HTML untuk PDF ================= */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sebaris = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const WARNA_KOTAK = { info: ["#2F7FD8", "#E8F1FC"], saran: ["#2E9E5B", "#E7F5EC"], awas: ["#C98A12", "#FDF4E1"], bahaya: ["#D9534F", "#FBE9E8"] };
function htmlBlok(b) {
  if (b.t === "h1") return `<h1 id="${b.id}">${b.no} ${sebaris(b.s)}</h1>`;
  if (b.t === "h2") return `<h2 id="${b.id}">${b.no} ${sebaris(b.s)}</h2>`;
  if (b.t === "h3") return `<h3 id="${b.id}">${b.no} ${sebaris(b.s)}</h3>`;
  if (b.t === "p") return `<p>${sebaris(b.s)}</p>`;
  if (b.t === "ul" || b.t === "ol") return `<${b.t}>${b.a.map(x => `<li>${sebaris(x)}</li>`).join("")}</${b.t}>`;
  if (b.t === "tb") { const tot = b.lebar.reduce((a, x) => a + x, 0);
    return `<table><colgroup>${b.lebar.map(w => `<col style="width:${(w / tot * 100).toFixed(1)}%">`).join("")}</colgroup><thead><tr>${b.kepala.map(k => `<th>${sebaris(k)}</th>`).join("")}</tr></thead>
      <tbody>${b.baris.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="pertama"' : ""}>${sebaris(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`; }
  if (b.t === "kotak") { const [w, l] = WARNA_KOTAK[b.jenis];
    return `<div class="kotak" style="border-color:${w};background:${l}"><div class="kotak-judul" style="color:${w}">${sebaris(b.judul)}</div>${b.isi.map(x => `<p>${sebaris(x)}</p>`).join("")}</div>`; }
  if (b.t === "stat") return `<div class="stat">${b.a.map(([a, k]) => `<div><b>${esc(a)}</b><span>${esc(k)}</span></div>`).join("")}</div><p class="stat-ket">${esc(b.ket)}</p>`;
  throw new Error("Blok tidak dikenal: " + b.t);
}
function buatHTML() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${JUDUL}</title><style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Calibri, "Segoe UI", Carlito, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1F2633; }
  b { font-weight: 700; }
  .sampul { height: 247mm; display: flex; flex-direction: column; justify-content: center; break-after: page; }
  .sampul .atas { font-size: 11pt; font-weight: 700; letter-spacing: .08em; color: #8F6B1A; }
  .sampul h1 { break-before: auto; font-size: 34pt; color: #1D2A3A; margin: 10px 0 6px; border: 0; padding: 0; }
  .sampul .sub { font-size: 15pt; color: #33445A; }
  .sampul .garis { height: 4px; background: linear-gradient(90deg, #1D2A3A 0 70%, #F2B92E 70%); margin: 34px 0 22px; border-radius: 2px; }
  .sampul ul { margin: 8px 0 0; } .sampul .kaki { margin-top: 70px; color: #556070; font-size: 9.5pt; }
  .daftar { break-after: page; } .daftar h1 { break-before: auto; }
  .daftar a { color: inherit; text-decoration: none; display: block; padding: 3px 0; border-bottom: 1px dotted #C9D2DE; }
  .daftar .d1 { font-weight: 700; margin-top: 8px; } .daftar .d2 { padding-left: 18px; color: #33445A; }
  h1 { break-before: page; font-size: 19pt; color: #1D2A3A; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2.5px solid #1D2A3A; }
  h2 { font-size: 13.5pt; color: #1D2A3A; margin: 20px 0 6px; break-after: avoid; }
  h3 { font-size: 11.5pt; color: #2F6FB8; margin: 14px 0 4px; break-after: avoid; }
  p { margin: 0 0 8px; } ul, ol { margin: 0 0 10px; padding-left: 22px; } li { margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 9.5pt; }
  th { background: #1D2A3A; color: #fff; text-align: left; padding: 6px 8px; font-weight: 700; }
  td { padding: 6px 8px; border-bottom: 1px solid #D5DCE6; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #F6F8FB; } tr { break-inside: avoid; } td.pertama { font-weight: 400; }
  .kotak { border-left: 5px solid; border-radius: 4px; padding: 10px 14px; margin: 8px 0 14px; break-inside: avoid; font-size: 9.8pt; }
  .kotak-judul { font-weight: 700; margin-bottom: 3px; } .kotak p { margin: 0 0 4px; }
  .stat { display: flex; gap: 6px; margin: 8px 0 2px; break-inside: avoid; }
  .stat div { flex: 1; background: #EEF2F7; border-radius: 6px; padding: 8px 6px; text-align: center; }
  .stat b { display: block; font-size: 17pt; color: #1D2A3A; line-height: 1.1; } .stat span { font-size: 8.5pt; color: #556070; }
  .stat-ket { text-align: center; font-size: 8.5pt; font-style: italic; color: #8A93A3; margin-bottom: 12px; }
  </style></head><body>
  <section class="sampul"><div class="atas">${MEREK}</div><h1>${JUDUL}</h1>
    <div class="sub">${SUBJUDUL}</div><div class="garis"></div>
    <p>Isi panduan ini:</p><ul>${ISI.filter(b => b.t === "h1").map(b => `<li><b>${esc(b.s)}</b></li>`).join("")}</ul>
    <div class="kaki">Untuk: ${UNTUK}<br>Versi: ${VERSI} (sesuai tampilan aplikasi per tanggal tersebut)</div></section>
  <section class="daftar"><h1>Daftar Isi</h1>${DAFTAR.map(b => `<a class="d${b.t[1]}" href="#${b.id}">${b.no} ${sebaris(b.s)}</a>`).join("")}</section>
  ${ISI.map(htmlBlok).join("\n")}
  </body></html>`;
}

/* ================= Cetak PDF lewat Chrome/Edge (DevTools Protocol) ================= */
function cariPeramban() {
  const calon = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  const ada = calon.find(p => p && fs.existsSync(p)); if (!ada) throw new Error("Chrome/Edge tidak ditemukan. Atur variabel CHROME ke lokasi chrome.exe."); return ada;
}
const tunggu = ms => new Promise(r => setTimeout(r, ms));
async function cetakPDF(berkasHTML, keluaran) {
  const port = 9300 + Math.floor(Math.random() * 500), profil = fs.mkdtempSync(path.join(os.tmpdir(), "panduan-"));
  const p = spawn(cariPeramban(), ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
  try {
    let daftar;
    for (let i = 0; i < 100 && !daftar; i++) { try { daftar = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch (e) { await tunggu(150); } }
    const hal = daftar && daftar.find(x => x.type === "page"); if (!hal) throw new Error("Peramban tidak merespons.");
    const ws = new WebSocket(hal.webSocketDebuggerUrl); await new Promise((ok, gagal) => { ws.onopen = ok; ws.onerror = gagal; });
    let id = 0; const janji = new Map(), acara = [];
    ws.onmessage = m => { const x = JSON.parse(m.data); if (x.id && janji.has(x.id)) { janji.get(x.id)(x); janji.delete(x.id); } else if (x.method) acara.push(x.method); };
    const kirim = (method, params = {}) => new Promise(ok => { const k = ++id; janji.set(k, ok); ws.send(JSON.stringify({ id: k, method, params })); });
    await kirim("Page.enable");
    await kirim("Page.navigate", { url: "file:///" + berkasHTML.replace(/\\/g, "/") });
    for (let i = 0; i < 100 && !acara.includes("Page.loadEventFired"); i++) await tunggu(100);
    await kirim("Runtime.evaluate", { expression: "document.fonts.ready.then(() => 1)", awaitPromise: true });
    const gaya = "font-family:Calibri,'Segoe UI',sans-serif;font-size:8px;color:#8A93A3;width:100%;padding:0 18mm;";
    const opsi = { printBackground: true, displayHeaderFooter: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.75, marginBottom: 0.7, marginLeft: 0.71, marginRight: 0.71,
      headerTemplate: `<div style="${gaya}text-align:right">${JUDUL}</div>`,
      footerTemplate: `<div style="${gaya}text-align:center">Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>`,
      generateDocumentOutline: true, generateTaggedPDF: true };
    let r = await kirim("Page.printToPDF", opsi);
    if (r.error) { delete opsi.generateDocumentOutline; delete opsi.generateTaggedPDF; r = await kirim("Page.printToPDF", opsi); }   // Chrome lama
    if (r.error) throw new Error(r.error.message);
    fs.writeFileSync(keluaran, Buffer.from(r.result.data, "base64")); ws.close();
  } finally { p.kill(); await tunggu(400); try { fs.rmSync(profil, { recursive: true, force: true }); } catch (e) { /* biarkan */ } }
}

/* ================= Word (.docx) ================= */
async function buatDOCX(keluaran) {
  const D = require("docx");
  const LEBAR = 9638;   // lebar isi A4 dengan margin 2 cm (twip)
  const lari = (s, o = {}) => String(s).split(/(\*\*.+?\*\*)/).filter(Boolean).map(x => /^\*\*.+\*\*$/.test(x) ? new D.TextRun({ text: x.slice(2, -2), bold: true, ...o }) : new D.TextRun({ text: x, ...o }));
  const par = (s, o = {}, r = {}) => new D.Paragraph({ children: lari(s, r), spacing: { after: 120 }, ...o });
  const garis = { style: D.BorderStyle.SINGLE, size: 4, color: "D5DCE6" }, kosong = { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const sel = (isi, lebar, o = {}) => new D.TableCell({ width: { size: lebar, type: D.WidthType.DXA }, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: isi, ...o });
  let nomorDaftar = 0;
  const blok = b => {
    if (b.t === "h1") return [new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, pageBreakBefore: true, children: lari(`${b.no} ${b.s}`) })];
    if (b.t === "h2") return [new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, children: lari(`${b.no} ${b.s}`) })];
    if (b.t === "h3") return [new D.Paragraph({ heading: D.HeadingLevel.HEADING_3, children: lari(`${b.no} ${b.s}`) })];
    if (b.t === "p") return [par(b.s)];
    if (b.t === "ul") return b.a.map(x => par(x, { bullet: { level: 0 }, spacing: { after: 60 } }));
    if (b.t === "ol") { const n = ++nomorDaftar; return b.a.map(x => par(x, { numbering: { reference: "angka", level: 0, instance: n }, spacing: { after: 60 } })); }
    if (b.t === "tb") { const tot = b.lebar.reduce((a, x) => a + x, 0), w = b.lebar.map(x => Math.round(x / tot * LEBAR));
      return [new D.Table({ width: { size: LEBAR, type: D.WidthType.DXA }, columnWidths: w,
        borders: { top: garis, bottom: garis, left: kosong, right: kosong, insideHorizontal: garis, insideVertical: kosong },
        rows: [new D.TableRow({ tableHeader: true, cantSplit: true, children: b.kepala.map((k, i) => sel([par(k, { spacing: { after: 0 } }, { bold: true, color: "FFFFFF", size: 19 })], w[i], { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "1D2A3A" } })) }),
          ...b.baris.map((r, j) => new D.TableRow({ cantSplit: true, children: r.map((c, i) => sel([par(c, { spacing: { after: 0 } }, { size: 19 })], w[i], j % 2 ? { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "F6F8FB" } } : {})) }))] }),
        new D.Paragraph({ spacing: { after: 120 }, children: [] })]; }
    if (b.t === "kotak") { const [w, l] = WARNA_KOTAK[b.jenis].map(x => x.slice(1));
      return [new D.Table({ width: { size: LEBAR, type: D.WidthType.DXA }, columnWidths: [LEBAR],
        borders: { top: kosong, bottom: kosong, right: kosong, left: { style: D.BorderStyle.SINGLE, size: 30, color: w }, insideHorizontal: kosong, insideVertical: kosong },
        rows: [new D.TableRow({ cantSplit: true, children: [sel([par(b.judul, { spacing: { after: 40 } }, { bold: true, color: w, size: 20 }), ...b.isi.map(x => par(x, { spacing: { after: 40 } }, { size: 19 }))], LEBAR,
          { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: l }, margins: { top: 120, bottom: 120, left: 200, right: 160 } })] })] }),
        new D.Paragraph({ spacing: { after: 120 }, children: [] })]; }
    if (b.t === "stat") { const w = Math.floor(LEBAR / b.a.length), putih = { style: D.BorderStyle.SINGLE, size: 24, color: "FFFFFF" };
      return [new D.Table({ width: { size: LEBAR, type: D.WidthType.DXA }, columnWidths: b.a.map(() => w),
        borders: { top: putih, bottom: putih, left: putih, right: putih, insideHorizontal: putih, insideVertical: putih },
        rows: [new D.TableRow({ cantSplit: true, children: b.a.map(([a, k]) => sel([
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: a, bold: true, size: 34, color: "1D2A3A" })] }),
          new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: k, size: 16, color: "556070" })] })], w, { shading: { type: D.ShadingType.CLEAR, color: "auto", fill: "EEF2F7" } })) })] }),
        new D.Paragraph({ alignment: D.AlignmentType.CENTER, spacing: { before: 40, after: 160 }, children: [new D.TextRun({ text: b.ket, italics: true, size: 16, color: "8A93A3" })] })]; }
    throw new Error("Blok tidak dikenal: " + b.t);
  };
  const sampul = [
    new D.Paragraph({ spacing: { before: 3200, after: 120 }, children: [new D.TextRun({ text: MEREK, bold: true, size: 22, color: "8F6B1A" })] }),
    new D.Paragraph({ spacing: { after: 120 }, children: [new D.TextRun({ text: JUDUL, bold: true, size: 64, color: "1D2A3A" })] }),
    new D.Paragraph({ spacing: { after: 400 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 24, color: "1D2A3A", space: 18 } },
      children: [new D.TextRun({ text: SUBJUDUL, size: 30, color: "33445A" })] }),
    par("Isi panduan ini:"),
    ...ISI.filter(b => b.t === "h1").map(b => par(`**${b.s}**`, { bullet: { level: 0 }, spacing: { after: 40 } })),
    new D.Paragraph({ spacing: { before: 1400, after: 0 }, children: [new D.TextRun({ text: "Untuk: " + UNTUK, size: 19, color: "556070" })] }),
    new D.Paragraph({ children: [new D.TextRun({ text: `Versi: ${VERSI} (sesuai tampilan aplikasi per tanggal tersebut)`, size: 19, color: "556070" })] }),
  ];
  const daftarIsi = [new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: [new D.TextRun("Daftar Isi")] }),
    ...DAFTAR.map(b => new D.Paragraph({ spacing: { after: 50, before: b.t === "h1" ? 140 : 0 }, indent: { left: b.t === "h1" ? 0 : 360 },
      children: lari(`${b.no} ${b.s}`, { bold: b.t === "h1", color: b.t === "h1" ? "1F2633" : "33445A" }) }))];
  const kepala = new D.Header({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: JUDUL, size: 16, color: "8A93A3" })] })] });
  const kaki = new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ children: ["Halaman ", D.PageNumber.CURRENT], size: 16, color: "8A93A3" })] })] });
  const halaman = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } };
  const doc = new D.Document({
    creator: "Data Induk Sekolah", title: JUDUL, description: SUBJUDUL,
    styles: { default: { document: { run: { font: "Calibri", size: 21, color: "1F2633" }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 36, bold: true, color: "1D2A3A" },
          paragraph: { spacing: { before: 0, after: 200 }, border: { bottom: { style: D.BorderStyle.SINGLE, size: 18, color: "1D2A3A", space: 6 } } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 27, bold: true, color: "1D2A3A" }, paragraph: { spacing: { before: 320, after: 100 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: "2F6FB8" }, paragraph: { spacing: { before: 220, after: 80 }, keepNext: true } }] },
    numbering: { config: [{ reference: "angka", levels: [{ level: 0, format: D.LevelFormat.DECIMAL, text: "%1.", alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{ properties: halaman, children: sampul },
      { properties: halaman, headers: { default: kepala }, footers: { default: kaki }, children: [...daftarIsi, ...ISI.flatMap(blok)] }],
  });
  fs.writeFileSync(keluaran, await D.Packer.toBuffer(doc));
}

(async () => {
  const html = path.join(os.tmpdir(), NAMA + ".html"); fs.writeFileSync(html, buatHTML());
  if (process.argv.includes("--html")) { fs.copyFileSync(html, path.join(AKAR, NAMA + ".html")); console.log("HTML →", NAMA + ".html"); }
  await cetakPDF(html, path.join(AKAR, NAMA + ".pdf")); console.log("PDF  →", NAMA + ".pdf");
  await buatDOCX(path.join(AKAR, NAMA + ".docx")); console.log("DOCX →", NAMA + ".docx");
})().catch(e => { console.error("Gagal:", e.message); process.exit(1); });
