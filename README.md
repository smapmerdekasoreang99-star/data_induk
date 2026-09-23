# Data Induk Sekolah — SMA Plus Merdeka Soreang

Aplikasi pengelola data induk: siswa, guru, tugas guru, jadwal KBM, kelompok
belajar, kelas, mata pelajaran, jabatan, dan tahun ajaran.

Satu tempat mengubah, banyak tempat membaca. Aplikasi lain — Kehadiran Guru,
Absensi Ekskul, dan payroll nanti — membaca data ini, tidak mengubahnya.

---

## 1. Memasang

### a. Siapkan databasenya

Jalankan di SQL Editor Supabase, **berurutan**. Semuanya aman diulang, jadi
kalau ragu apakah sudah pernah dijalankan, jalankan saja lagi.

| Urutan | Berkas | Isinya |
|---|---|---|
| 1 | `13a_langkah_sekarang.sql` | menutup data pribadi guru dari akses publik |
| 2 | `13b_pulihkan_ekskul.sql` | memulihkan pembacaan data siswa oleh aplikasi ekskul |
| 3 | `SEKALI_JALAN_fondasi_data_induk.sql` | tugas guru, piket, kelompok belajar, mata pelajaran |
| 4 | `30_impor_tahsin.sql` bagian A | tabel sementara untuk impor |
| 5 | *(lewat Table Editor)* | impor `tahsin_keanggotaan.csv` ke tabel `impor_tahsin` |
| 6 | `30_impor_tahsin.sql` bagian C lalu D | memeriksa, lalu memasukkan keanggotaan |
| 7 | `31_pengecualian_tahsin.sql` | mencatat siswa yang tidak mengikuti Tahsin |
| 8 | `32_tambah_siswa_baru.sql` | menambahkan Muhammad Zyian |
| 9 | `33_jadwal_kbm.sql` | pengaman jadwal dan tampilannya |
| 10 | `34_rls_tabel_baru.sql` | kebijakan akses tabel-tabel baru |
| 11 | `35_jadwal_piket.sql` | rincian jadwal piket |
| 12 | `36_jam_dan_piket.sql` | jam ke-11 dan ke-12, hak sunting piket |
| 13 | `40_perbaiki_kode_tahsin.sql` | mengembalikan kode Tahsin ke M26 |
| 14 | `41_profil_dokumen.sql` | identitas sekolah untuk kop berkas |
| 15 | `42` lalu `43` | jenis kelamin siswa |
| 16 | `44_jenis_kelamin_guru.sql` | jenis kelamin guru — periksa dulu |
| 17 | `46_rapikan_nama_tabel.sql` | membersihkan tabel impor, merapikan penamaan |

Berkas bernomor `01` sampai `12` adalah tahapan awal yang sudah dilewati atau
sudah digantikan. `09`, `10`, `14`, `15`, dan `21` **tidak berlaku lagi** —
disusun dari dugaan yang kemudian terbukti keliru.

### b. Sambungkan aplikasinya

Isi tiga baris pertama pada `assets/app.js`:

```js
const KONFIG = {
  url:     'https://xxxxx.supabase.co',      // Settings > API > Project URL
  anonKey: '...',                            // Settings > API > anon public
  akun:    'operator@smapmerdeka.sch.id',    // akun bersama di Authentication > Users
  sekolah: 'SMA Plus Merdeka Soreang'
};
```

Selama `url` dan `anonKey` masih kosong, aplikasi berjalan dalam **mode contoh**
dengan data karangan — berguna untuk melihat tampilan tanpa menyentuh database.

Unggah seluruh isi folder ini ke repo GitHub, aktifkan GitHub Pages.

### c. Coba dulu sebelum diserahkan ke petugas

1. Masuk dengan akun bersama. Beranda harus menampilkan 684 siswa dan 39 guru.
2. Ubah nomor HP seorang guru, simpan, muat ulang halaman — perubahannya harus bertahan.
3. Tambah satu siswa uji, lalu hapus lagi.
4. Buka Jadwal KBM, tambah satu jam pelajaran, lalu hapus.
5. Unduh cadangan dari Beranda.

---

## 2. Cara kerjanya

### Halaman

| Halaman | Isinya |
|---|---|
| Beranda | ringkasan jumlah, kelengkapan data, unduh cadangan |
| Data Siswa | 684 siswa; tambah, ubah, pindah kelas massal, unggah CSV/Excel |
| Data Guru | 39 guru dengan 20 isian; tugas melekat tampil di tiap baris. Tanda kelayakan TuSehat, Tunjangan Kesehatan (masa kerja 5 tahun, bukan Guru Tidak Tetap) dan TuKerja, Tunjangan Ketenagakerjaan (pemegang tugas Staf, 5 tahun sejak menjadi staf), masing-masing dengan tombol pengesahan kepala sekolah |
| Tugas Guru | wali kelas, staf, tugas tambahan, diperbantukan, piket, pembina ekskul; jam piket meja sekolah dan jam piket unit yang disepakati dicatat di sini. Tugas Staf juga menyimpan pola honor (bulanan, bulanan + insentif kedatangan, upah harian) dan sumber hari hadirnya (fingerprint / absen manual) |
| Jadwal KBM | matriks hari × jam, per kelas atau per guru |
| Kelompok Belajar | Tahsin dan Matematika Dasar beserta anggotanya |
| Jadwal Piket | tiga tab: Piket Meja Sekolah (matriks jadwal dengan daftar sisa jam belum ditempatkan, petugas), Piket Unit + Diperbantukan, Piket parkiran. Ketiganya bisa diunduh sebagai xlsx berisi dua lembar: **Jadwal** dan **Formulir Paraf** (lihat di bawah) |
| Jam Kerja Staf | ketentuan jam masuk–pulang bawaan sekolah per hari, dan pengecualian per staf (jam khusus atau libur); dibaca Kehadiran Guru untuk membandingkan rekaman fingerprint |
| Kelas dan Rombel | 18 rombel tahun berjalan |
| Mata Pelajaran | dibaca dari `kg_mapel`, dipakai bersama jadwal KBM |
| Jabatan dan Unit | pilihan untuk tugas Staf dan Diperbantukan; kategori Struktural, Unit, dan Pendukung (satpam, kebersihan) |
| Tahun Ajaran | pergantian tahun dan pemandu kenaikan kelas |

### Unduhan halaman Piket: jadwal dan formulir paraf

Tiap tab Jadwal Piket punya tombol **Unduh (xlsx)**, dan berkasnya berisi dua
lembar dengan tugas yang berbeda:

| Lembar | Isinya | Untuk apa |
|---|---|---|
| **Jadwal** | matriks jadwalnya — baris jam pelajaran, kolom hari | ditempel di ruang guru, diarsipkan |
| **Formulir Paraf** | daftar petugas dengan kolom Senin–Jumat yang kosong | dicetak, dibubuhi paraf, jadi bukti bagi bendahara |

Paraf membuktikan kejadian pada sebuah **tanggal**, sedangkan baris matriks
jadwal adalah **hari** — "Senin", bukan "Senin, 21 September 2026". Karena itu
parafnya tidak ditaruh di lembar jadwal, melainkan di lembar tersendiri.

Lembar formulirnya **tidak bertanggal**: isian *"Pekan: ___ s.d. ___"* dan kolom
tanggal tiap hari dibiarkan kosong untuk ditulis tangan, supaya sekali cetak bisa
diperbanyak dengan fotokopi untuk pekan-pekan berikutnya. Lembar yang sama juga
bisa diunduh dari **Kehadiran Guru → Pelaksanaan Piket**; bentuk kertas keduanya
sama persis karena ditulis oleh berkas yang sama,
[`assets/formulir-piket.js`](assets/formulir-piket.js) — salinan serupa di kedua
aplikasi, seperti `kop-dokumen.js`:

```
md5sum ../data_induk/assets/formulir-piket.js ../kehadiran_guru/assets/formulir-piket.js
```

Lembar formulirnya disusun **menurut waktu: baris jam pelajaran, kolom hari** —
tiap hari dua kolom, nama tercetak dan kolom kosong di sebelah kanannya untuk
paraf, dengan garis tebal memisahkan jam dan garis tipis memisahkan petugas di
jam yang sama. Susunan itu dipilih karena pada satu jam paling banyak dua orang
berjaga bersamaan, sehingga sepekan penuh cukup 23 larik dan **muat satu
lembar**; disusun menurut orang, piket meja sekolah perlu 55 larik dan tumpah ke
tiga sampai empat halaman. Sel berlatar tipis tidak perlu diisi — pada jam itu
memang tidak ada yang berjaga.

Penanda tangan di kanan mengikuti ranah isinya: **Kurikulum** untuk meja sekolah
dan unit, **Kesiswaan** untuk parkiran.

### Aturan yang dijaga database, bukan diingat petugas

- Satu kelas satu wali; satu guru hanya boleh menjadi wali satu kelas
- Tugas Staf dan Diperbantukan wajib menyebut jabatan atau unit
- Tugas Tambahan wajib menyebut jumlah jam tambahan mengajar
- Diperbantukan wajib menyebut jam piket unit
- Guru tidak boleh dijadwalkan di dua tempat pada jam yang sama
- Rombel tidak boleh diisi dua mata pelajaran pada jam yang sama —
  kelompok dikecualikan, karena Tahsin dan Matematika Dasar memang beregu
- Satu siswa satu kelompok untuk tiap mata pelajaran
- Siswa yang dikecualikan tidak bisa dimasukkan ke kelompoknya, dan sebaliknya
- Memegang tugas Staf menggugurkan seluruh perhitungan honor tambahan
- Kelayakan tunjangan BPJS dihitung, bukan diketik: Kesehatan = aktif, bukan Guru Tidak Tetap (Dapodiknya tidak menginduk di sini), TMT sekolah sudah 5 tahun; Ketenagakerjaan = aktif, memegang tugas Staf, 5 tahun sejak menjadi staf (dari TMT sekolah; Guru Tetap Yayasan yang merangkap staf: dari TMT sebagai staf). Yang diketik hanya pengesahan kepala sekolah per jenis, dan pembayaran berhenti sendiri begitu syaratnya gugur

### Istilah yang mudah tertukar

**Jam tugas tambahan** — tugas khusus yang dibayar lewat penambahan jam
mengajar. Tidak ada di jadwal KBM; tatap muka maupun transport kedatangan tidak
diperhitungkan.

**Guru diperbantukan** — penanggung jawab satu unit sekolah, misalnya Lab IPA.
Mendapat honor penanggung jawab ditambah transport kedatangan pada jam piket
unitnya sendiri. Bukan piket meja sekolah.

**Rombel** (18) — rombongan belajar administratif, dasar wali kelas dan rapor.
**Satuan jadwal** (`kelas`, 39) — yang diajar pada satu jam pelajaran:
18 rombel ditambah 21 kelompok Tahsin. Keduanya berbeda fungsi, bukan duplikasi.

### Penamaan tabel

Lima tabel yang dipakai bersama sudah dilepas dari awalan `kg_`:

| Sekarang | Dulu |
|---|---|
| `mapel` | `kg_mapel` |
| `kelas` | `kg_kelas` |
| `jadwal_kbm` | `kg_jadwal_kbm` |
| `jam_pelajaran` | `kg_jam_pelajaran` |
| `piket` | `kg_piket` |

Nama lama masih ada sebagai **view** yang menunjuk tabel yang sama, supaya
aplikasi Kehadiran Guru tetap berjalan tanpa diubah. Datanya satu, bukan
salinan. Setelah aplikasi itu dialihkan ke nama baru, kelima view tersebut
harus dihapus — jangan dibiarkan bertahun-tahun, karena dua nama untuk satu
benda menyesatkan siapa pun yang membaca database nanti:

```sql
drop view kg_mapel, kg_kelas, kg_jadwal_kbm, kg_jam_pelajaran, kg_piket;
```

---

## 3. Yang rutin dikerjakan

**Tiap awal tahun ajaran** — Tahun Ajaran → tambah tahun baru → Proses kenaikan
kelas → aktifkan tahun barunya. Data tahun lama tetap terbaca.

**Mutasi masuk** — Data Siswa → Tambah siswa → tempatkan di rombel → daftarkan
ke kelompok belajar.

**Mutasi keluar** — ubah statusnya menjadi pindah atau keluar. Jangan dihapus,
supaya rekap yang sudah dilaporkan tidak berubah surut.

**Cadangan** — unduh dari Beranda sebulan sekali, simpan di drive sekolah.
Supabase versi gratis tidak menyediakan pemulihan otomatis.

---

## 4. Yang belum selesai

- Jenis kelamin: 10 siswa yang kedua daftar hadirnya bertentangan, dan
  2 guru yang perkiraannya belum pasti
- Tugas Staf dan Diperbantukan belum ada satu pun tercatat
- 8 siswa perlu dicatat pengecualian Tahsin-nya (berkas `31`)
- Aplikasi Kehadiran Guru masih perlu dialihkan ke nama tabel baru
  (`jadwal_kbm`, `piket`, `mapel`, `kelas`, `jam_pelajaran`) atau ke
  `v_jadwal` dan `v_guru_piket`, lalu hak tulisnya dicabut dan view
  penyambung `kg_*` dihapus
- Sisa akses anon pada tabel induk belum ditutup seluruhnya
- Aplikasi payroll tersendiri, dikerjakan setelah data induk mapan
