/* =====================================================================
   DATA INDUK SEKOLAH — SMA Plus Merdeka Soreang
   Satu berkas berisi seluruh logika aplikasi.

   ISI TIGA BARIS DI BAWAH INI setelah database siap.
   Selama masih kosong, aplikasi berjalan dalam MODE CONTOH: seluruh
   tampilan bisa dicoba dengan data karangan, tanpa menyentuh database.
   ===================================================================== */
const KONFIG = {
  url:     'https://xgtoneyvzfvfbidicotq.supabase.co',                                 // https://xxxxx.supabase.co
  anonKey: 'sb_publishable_rjHVGT0ULc03TC2ljIytSA_2X54xzR1',                                 // Settings > API > anon public
  akun:    'operator@smapmerdeka.sch.id',      // akun bersama
  sekolah: 'SMA Plus Merdeka Soreang'
};

/* Nilai cadangan bila tabel profil_dokumen belum ada atau belum diisi.
   Yang berlaku sehari-hari adalah isian pada halaman Profil Dokumen. */
const SEKOLAH_BAWAAN = {
  nama:    'SMA Plus "Merdeka" Soreang',
  alamat:  'Jl. Citaliktik-Sindang Wargi Soreang Kab. Bandung',
  kota:    'Soreang',
  kepala:  'Mohamad Gunawan, S.Si',
  logo:    'assets/logo.png'     // salin dari repo lain; boleh tidak ada
};

/* Profil yang berlaku. Diisi ulang setiap kali data dimuat. */
let SEKOLAH = { ...SEKOLAH_BAWAAN };

const MODE = (KONFIG.url && KONFIG.anonKey) ? 'db' : 'contoh';

/* Kolom tabel guru yang sebenarnya di database sekolah. */
const KOLOM_GURU = 'id,nig,nama,nip,nuptk,jenis_kelamin,jenis_ptk,status_aktif,'
  + 'tmt_sekolah,tmt_guru,tmt_status,pendidikan_terakhir,jurusan,linier,'
  + 'no_sertifikat_pendidik,mapel_utama,no_hp,email,catatan,insentif_fingerprint';
const PTK = ['Guru Tetap Yayasan','Guru Tidak Tetap','Tenaga Kependidikan','Pimpinan'];
const STATUS_SISWA = ['aktif', 'pindah', 'keluar', 'lulus'];
const STATUS_GURU  = ['Aktif', 'Cuti', 'Nonaktif'];

let sesi = { token: '', petugas: '', ta: '2026/2027' };
let D = { siswa: [], guru: [], rombel: [], mapel: [], tugas: [], tahun: [], jabatan: [],
          jenis: [], piket: [], komponen: [], parkiran: [], piketUnit: [], ttd: {},
          kelompok: [], anggota: [], belumKelompok: [], dikecualikan: [],
          jadwal: [], jamPel: [], piketJadwal: [], profil: null, galat: {} };
let halaman = 'beranda';
let sel = new Set();
let ui = { qSiswa: '', kelasSiswa: '', statusSiswa: 'aktif', hal: 1, ukuran: 50,
           qGuru: '', statusGuru: 'Aktif', jenisTugas: '' };

/* ---------------------------------------------------------------- util */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const enc = encodeURIComponent;
const kosong = v => v === null || v === undefined || String(v).trim() === '';

function toast(pesan, salah) {
  const r = $('#toast-root');
  r.innerHTML = `<div class="toast${salah ? ' err' : ''}">${esc(pesan)}</div>`;
  clearTimeout(r._t);
  r._t = setTimeout(() => r.innerHTML = '', salah ? 6000 : 3200);
}
function sibuk(t) { $('#busy-root').innerHTML = t ? `<div class="sibuk">${esc(t)}</div>` : ''; }

async function jalankan(pesan, fn) {
  sibuk(pesan);
  try { await fn(); }
  catch (e) { toast(pesanRamah(e), true); }
  finally { sibuk(''); gambar(); }
}
function pesanRamah(e) {
  const m = e && e.message ? e.message : String(e);
  if (/violates foreign key/i.test(m))
    return 'Data ini masih dipakai di tempat lain, jadi tidak bisa dihapus. Ubah statusnya menjadi nonaktif saja.';
  if (/duplicate key|already exists/i.test(m))
    return 'Data dengan penanda yang sama sudah ada.';
  return m;
}
function tglIndo(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '—';
  const b = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${b[Number(m) - 1]} ${y}`;
}
function warnaTingkat(t) {
  return t == 10 ? 'var(--g10)' : t == 11 ? 'var(--g11)' : t == 12 ? 'var(--g12)' : 'var(--ink2)';
}
const tingkatDari = kode => {
  const n = parseInt(String(kode).split('-')[0], 10);
  return Number.isNaN(n) ? 0 : n;
};

/* ------------------------------------------------------------ database */
async function api(jalur, opsi = {}) {
  const r = await fetch(KONFIG.url + jalur, {
    ...opsi,
    headers: {
      apikey: KONFIG.anonKey,
      Authorization: 'Bearer ' + (sesi.token || KONFIG.anonKey),
      'Content-Type': 'application/json',
      'x-petugas': sesi.petugas || '',
      ...(opsi.headers || {})
    }
  });
  const teks = await r.text();
  let data = null;
  try { data = teks ? JSON.parse(teks) : null; } catch (e) {}
  if (r.status === 401) { sesi.token = ''; layarMasuk('Sesi berakhir. Silakan masuk kembali.'); throw new Error('Sesi berakhir'); }
  if (!r.ok) throw new Error((data && (data.message || data.hint || data.error_description)) || `Gagal (HTTP ${r.status})`);
  return data;
}
const ambil = (tabel, query = '') => api(`/rest/v1/${tabel}?${query}`);

/* PostgREST membatasi setiap permintaan pada 1.000 baris. Tanpa
   pengambilan bertahap, tabel besar terpotong diam-diam — dan yang
   hilang justru bagian akhir, sehingga terlihat seperti data yang
   memang belum ada. Dipakai untuk seluruh tabel yang bisa melewati
   seribu baris. */
async function ambilSemua(tabel, query = '') {
  let hasil = [], offset = 0;
  for (;;) {
    const d = await ambil(tabel, `${query}${query ? '&' : ''}limit=1000&offset=${offset}`);
    if (!d || !d.length) break;
    hasil = hasil.concat(d);
    if (d.length < 1000) break;
    offset += 1000;
  }
  return hasil;
}
const simpanBaru = (tabel, isi, tambahan = '') =>
  api(`/rest/v1/${tabel}${tambahan ? '?' + tambahan : ''}`,
      { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify([isi]) });
const perbarui = (tabel, syarat, isi) =>
  api(`/rest/v1/${tabel}?${syarat}`, { method: 'PATCH', body: JSON.stringify(isi) });
const buang = (tabel, syarat) => api(`/rest/v1/${tabel}?${syarat}`, { method: 'DELETE' });

async function masuk(petugas, sandi) {
  const r = await fetch(KONFIG.url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: KONFIG.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: KONFIG.akun, password: sandi })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error_description || d.msg || 'Kata sandi salah.');
  sesi.token = d.access_token;
  sesi.petugas = petugas;
}

/* -------------------------------------------------------- muat semua */
async function muatSemua() {
  if (MODE === 'contoh') { dataContoh(); return; }
  D.galat = {};

  const tahun = await ambil('tahun_ajaran', 'select=kode,mulai,selesai,aktif&order=kode.desc');
  D.tahun = tahun || [];
  const aktif = D.tahun.find(t => t.aktif);
  if (aktif) sesi.ta = aktif.kode;

  const [guru, rombel, mapel, tugas, jabatan, jenis] = await Promise.all([
    ambil('guru', 'select=' + KOLOM_GURU + '&order=tmt_sekolah.asc.nullslast,nama.asc'),
    ambil('rombel', `select=id,kode,tingkat,tahun_ajaran&tahun_ajaran=eq.${enc(sesi.ta)}&order=kode`),
    ambil('mapel', 'select=id,nama_mapel,rumpun_mapel&order=nama_mapel'),
    ambilSemua('guru_tugas', `select=id,guru_id,jenis,rombel_id,jabatan,jam_tambahan_mengajar,jam_piket_unit,keterangan,mulai,selesai,aktif,tahun_ajaran&tahun_ajaran=eq.${enc(sesi.ta)}`),
    ambil('jabatan', 'select=nama,kategori,aktif&order=urutan'),
    ambil('jenis_tugas', 'select=nama,perlu_rombel,perlu_jabatan,piket_sekolah,piket_libur,tambah_jam_mengajar,jam_unit,hak_transport,penjelasan&order=urutan&aktif=is.true')
  ]);
  D.guru = guru || []; D.rombel = rombel || [];

  // Piket dan komponen honor dibaca dari view, bukan disimpulkan sendiri.
  // Sumber kebenaran piket adalah jadwal piket
  // Kehadiran Guru, jadi halaman ini hanya menampilkan.
  try {
    [D.piket, D.komponen] = await Promise.all([
      ambil('v_guru_piket', 'select=*'),
      ambilSemua('v_komponen_guru', 'select=*')
    ]);
    try { D.piketJadwal = await ambilSemua('v_jadwal_piket', 'select=*'); }
    catch (e) { D.piketJadwal = []; console.warn('v_jadwal_piket belum ada:', e.message); }
    // Roster parkiran ditulis dari halaman ini, jadi kegagalannya tidak
    // boleh menjatuhkan seluruh halaman piket.
    try { D.parkiran = await ambil('v_piket_parkiran', 'select=*&order=urutan_hari'); }
    catch (e) { D.parkiran = []; console.warn('v_piket_parkiran belum ada:', e.message); }
    try { D.piketUnit = await ambilSemua('v_jadwal_piket_unit', 'select=*'); }
    catch (e) { D.piketUnit = []; console.warn('v_jadwal_piket_unit belum ada:', e.message); }
    // Penanda tangan dokumen, diturunkan dari jabatan aktif di guru_tugas.
    try { D.ttd = (await ambil('v_penanda_tangan', 'select=*&limit=1'))[0] || {}; }
    catch (e) { D.ttd = {}; console.warn('v_penanda_tangan belum ada:', e.message); }
  } catch (e) {
    D.profil = { id:1, nama_sekolah:'SMA Plus "Merdeka" Soreang',
    alamat:'Jl. Citaliktik-Sindang Wargi Soreang Kab. Bandung', kota:'Soreang',
    npsn:'', kepala_sekolah:'Mohamad Gunawan, S.Si', nip_kepala:'', logo_url:'assets/logo.png' };
  SEKOLAH = { nama:D.profil.nama_sekolah, alamat:D.profil.alamat, kota:D.profil.kota,
              kepala:D.profil.kepala_sekolah, nip:'', npsn:'', catatan:'', logo:D.profil.logo_url };

  D.piket = []; D.komponen = [];
    D.galat.piket = e.message;
    console.warn('View piket/komponen belum tersedia:', e.message);
  }

  // Profil dokumen untuk kop berkas cetak.
  try {
    const pr = await ambil('profil_dokumen', 'select=*&limit=1');
    D.profil = (pr && pr[0]) || null;
    if (D.profil) SEKOLAH = {
      nama:   D.profil.nama_sekolah || SEKOLAH_BAWAAN.nama,
      alamat: D.profil.alamat       || '',
      kota:   D.profil.kota         || '',
      kepala: D.profil.kepala_sekolah || '',
      nip:    D.profil.nip_kepala   || '',
      npsn:   D.profil.npsn         || '',
      catatan: D.profil.catatan_kaki || '',
      logo:   D.profil.logo_url     || SEKOLAH_BAWAAN.logo
    };
  } catch (e) {
    D.profil = null; D.galat.profil = e.message;
    SEKOLAH = { ...SEKOLAH_BAWAAN };
  }

  // Jadwal KBM beserta daftar jam pelajarannya.
  try {
    [D.jadwal, D.jamPel] = await Promise.all([
      ambilSemua('v_jadwal', 'select=*'),
      ambil('jam_pelajaran', 'select=*&order=jam_ke')
    ]);
  } catch (e) {
    D.jadwal = []; D.jamPel = [];
    D.galat.jadwal = e.message;
    console.warn('View jadwal belum tersedia:', e.message);
  }

  // Kelompok belajar: Tahsin, Matematika Dasar, dan sejenisnya.
  try {
    [D.kelompok, D.anggota, D.belumKelompok, D.dikecualikan] = await Promise.all([
      ambil('v_satuan_jadwal', 'select=*&jenis=eq.Kelompok&order=mapel,nama'),
      ambilSemua('v_anggota_kelompok', 'select=*'),
      ambilSemua('v_siswa_belum_berkelompok', 'select=*'),
      ambil('v_pengecualian', 'select=*')
    ]);
  } catch (e) {
    D.kelompok = []; D.anggota = []; D.belumKelompok = []; D.dikecualikan = [];
    D.galat.kelompok = e.message;
    console.warn('View kelompok belajar belum tersedia:', e.message);
  }
  D.mapel = (mapel || []).map(m => ({ id: m.id, nama: m.nama_mapel, rumpun: m.rumpun_mapel }));
  D.tugas = tugas || []; D.jabatan = jabatan || []; D.jenis = jenis || [];

  await muatSiswa();
}

async function muatSiswa() {
  if (MODE === 'contoh') return;
  const pilih = 'id,nisn,nis,nama,jenis_kelamin,tanggal_lahir,status,penempatan_kelas(rombel_id,tahun_ajaran)';
  let semua = [], offset = 0;
  for (;;) {
    const d = await ambil('siswa',
      `select=${enc(pilih)}&penempatan_kelas.tahun_ajaran=eq.${enc(sesi.ta)}&order=nama&limit=1000&offset=${offset}`);
    semua = semua.concat(d);
    if (d.length < 1000) break;
    offset += 1000;
  }
  D.siswa = semua.map(s => {
    const p = (s.penempatan_kelas || [])[0];
    const r = p && D.rombel.find(x => x.id === p.rombel_id);
    return { id: s.id, nisn: s.nisn || '', nis: s.nis || '', nama: s.nama || '',
             jk: s.jenis_kelamin || '', tgl: s.tanggal_lahir || '',
             status: s.status || 'aktif', kelas: r ? r.kode : '', rombel_id: p ? p.rombel_id : null };
  });
}

async function idRombel(kode) {
  const ada = D.rombel.find(r => r.kode === kode);
  if (ada) return ada.id;
  const d = await simpanBaru('rombel', { kode, tingkat: tingkatDari(kode), tahun_ajaran: sesi.ta },
                             'on_conflict=kode,tahun_ajaran');
  D.rombel.push(d[0]);
  return d[0].id;
}
async function tempatkan(siswaId, kode) {
  const rid = await idRombel(kode);
  await api('/rest/v1/penempatan_kelas?on_conflict=siswa_id,tahun_ajaran', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ siswa_id: siswaId, rombel_id: rid, tahun_ajaran: sesi.ta }])
  });
}

/* ------------------------------------------------------- mode contoh */
function dataContoh() {
  sesi.ta = '2026/2027';
  D.tahun = [{ kode: '2026/2027', mulai: '2026-07-13', selesai: '2027-06-30', aktif: true }];
  D.rombel = ['10-1','10-2','11-1','11-2','12-1','12-2'].map((k, i) =>
    ({ id: 'R' + i, kode: k, tingkat: tingkatDari(k), tahun_ajaran: sesi.ta }));
  D.mapel = [['MAT','Matematika','MIPA'],['BIND','Bahasa Indonesia','Bahasa'],
             ['KIM','Kimia','MIPA'],['PJOK','PJOK','Umum'],['SEJ','Sejarah','IPS']]
    .map(([id, nama, rumpun]) => ({ id, nama, rumpun }));
  // TMT sengaja dibuat berbeda-beda supaya urutan menurut masa kerja terlihat
  // di mode contoh; daftarnya ditulis acak agar pengurutannya benar-benar teruji.
  D.guru = [
    ['G001','1','Dra. Siti Aminah, M.Pd.','Matematika','Guru Tetap Yayasan','P','2010-07-12'],
    ['G002','2','Ahmad Fauzi, S.Pd.','PJOK','Guru Tidak Tetap','L','2021-07-12'],
    ['G003','3','Devy Resmisari, S.Pd.','Sejarah','Guru Tetap Yayasan','P','2004-07-19'],
    ['G004','4','Rina Sulastri, S.Si.','Kimia','Guru Tetap Yayasan','P','2016-07-18']
  ].map(([id, nig, nama, mapel, ptk, jk, tmt]) =>
    ({ id, nig, nama, mapel_utama: mapel, jenis_ptk: ptk, jenis_kelamin: jk,
       status_aktif: 'Aktif', tmt_sekolah: tmt, tmt_guru: tmt,
       nip: '', nuptk: '', pendidikan_terakhir: 'S1', jurusan: '', linier: true,
       no_sertifikat_pendidik: '', no_hp: '', email: '', catatan: '' }))
    .sort(urutGuru);

  D.jenis = [
    { nama:'Wali Kelas', perlu_rombel:true, perlu_jabatan:false, piket_sekolah:'Melekat',
      piket_libur:false, tambah_jam_mengajar:false, jam_unit:false, hak_transport:true,
      penjelasan:'Membina satu rombel. Piket meja sekolah melekat, dan kedatangan piketnya berhak transport.' },
    { nama:'Staf', perlu_rombel:false, perlu_jabatan:true, piket_sekolah:'Melekat',
      piket_libur:true, tambah_jam_mengajar:false, jam_unit:false, hak_transport:false,
      penjelasan:'Jabatan struktural, bertugas penuh Senin-Sabtu. Kehadiran lewat fingerprint, tanpa transport piket terpisah.' },
    { nama:'Tugas Tambahan', perlu_rombel:false, perlu_jabatan:true, piket_sekolah:null,
      piket_libur:false, tambah_jam_mengajar:true, jam_unit:false, hak_transport:false,
      penjelasan:'Dibayar hanya lewat penambahan jam mengajar. Bukan tatap muka, tanpa transport kedatangan.' },
    { nama:'Diperbantukan', perlu_rombel:false, perlu_jabatan:true, piket_sekolah:null,
      piket_libur:false, tambah_jam_mengajar:false, jam_unit:true, hak_transport:true,
      penjelasan:'Penanggung jawab unit. Honor penanggung jawab plus transport pada jam piket unitnya. Bukan piket meja sekolah.' },
    { nama:'Piket', perlu_rombel:false, perlu_jabatan:false, piket_sekolah:'Ditugaskan',
      piket_libur:false, tambah_jam_mengajar:false, jam_unit:false, hak_transport:true,
      penjelasan:'Ditugaskan khusus menambal jam piket meja sekolah.' },
    { nama:'Pembina Ekskul', perlu_rombel:false, perlu_jabatan:false, piket_sekolah:null,
      piket_libur:false, tambah_jam_mengajar:false, jam_unit:false, hak_transport:false,
      penjelasan:'Dicatat juga di aplikasi Absensi Ekskul.' },
    { nama:'Pembina OSIS', perlu_rombel:false, perlu_jabatan:false, piket_sekolah:null,
      piket_libur:false, tambah_jam_mengajar:false, jam_unit:false, hak_transport:false,
      penjelasan:'Membina OSIS sesudah jam pulang. Belum masuk payroll.' },
    { nama:'Pembimbing Tahfidz', perlu_rombel:false, perlu_jabatan:false, piket_sekolah:null,
      piket_libur:false, tambah_jam_mengajar:false, jam_unit:false, hak_transport:false,
      penjelasan:'Pembinaan Imtaq. Pertemuan dan transportnya di aplikasi Absensi Ekskul.' }
  ];
  D.jabatan = [
    ['Wakasek Kurikulum','Struktural'], ['Wakasek Kesiswaan','Struktural'],
    ['Penanggung Jawab Laboratorium IPA','Unit'], ['Penanggung Jawab Perpustakaan','Unit'],
    ['Penanggung Jawab Ketertiban','Unit']
  ].map(([nama, kategori]) => ({ nama, kategori, aktif: true }));

  D.tugas = [
    { id:'T1', guru_id:'G001', jenis:'Wali Kelas', rombel_id:'R0', jabatan:null,
      jam_tambahan_mengajar:null, jam_piket_unit:null, mulai:'2026-07-13', aktif:true, tahun_ajaran:sesi.ta },
    { id:'T2', guru_id:'G003', jenis:'Staf', rombel_id:null, jabatan:'Wakasek Kesiswaan',
      jam_tambahan_mengajar:null, jam_piket_unit:null, mulai:'2026-07-13', aktif:true, tahun_ajaran:sesi.ta },
    { id:'T3', guru_id:'G004', jenis:'Diperbantukan', rombel_id:null, jabatan:'Penanggung Jawab Laboratorium IPA',
      jam_tambahan_mengajar:null, jam_piket_unit:4, mulai:'2026-07-13', aktif:true, tahun_ajaran:sesi.ta },
    { id:'T4', guru_id:'G002', jenis:'Piket', rombel_id:null, jabatan:null,
      jam_tambahan_mengajar:null, jam_piket_unit:null, mulai:'2026-07-13', aktif:true, tahun_ajaran:sesi.ta },
    { id:'T5', guru_id:'G002', jenis:'Tugas Tambahan', rombel_id:null, jabatan:null,
      jam_tambahan_mengajar:null, jam_piket_unit:null, mulai:'2026-07-13', aktif:true, tahun_ajaran:sesi.ta }
  ];

  D.profil = { id:1, nama_sekolah:'SMA Plus "Merdeka" Soreang',
    alamat:'Jl. Citaliktik-Sindang Wargi Soreang Kab. Bandung', kota:'Soreang',
    npsn:'', kepala_sekolah:'Mohamad Gunawan, S.Si', nip_kepala:'', logo_url:'assets/logo.png' };
  SEKOLAH = { nama:D.profil.nama_sekolah, alamat:D.profil.alamat, kota:D.profil.kota,
              kepala:D.profil.kepala_sekolah, nip:'', npsn:'', catatan:'', logo:D.profil.logo_url };

  D.piket = [
    { guru_id:'G002', nama:'Ahmad Fauzi, S.Pd.', jam_per_minggu:6, jumlah_hari:4,
      hari:'Senin, Selasa, Rabu, Kamis', staf:false, dihitung_transport:true, dasar:'Piket' },
    { guru_id:'G001', nama:'Dra. Siti Aminah, M.Pd.', jam_per_minggu:4, jumlah_hari:3,
      hari:'Senin, Rabu, Jumat', staf:false, dihitung_transport:true, dasar:'Wali Kelas' },
    { guru_id:'G003', nama:'Devy Resmisari, S.Pd.', jam_per_minggu:3, jumlah_hari:2,
      hari:'Selasa, Kamis', staf:true, dihitung_transport:false, dasar:'Staf' }
  ];
  D.parkiran = [
    { hari:'Senin',  urutan_hari:1, guru_id:'G003', nama:'Devy Resmisari, S.Pd.', jenis_ptk:'Guru Tetap Yayasan', status_aktif:'Aktif', catatan:null },
    { hari:'Selasa', urutan_hari:2, guru_id:'G003', nama:'Devy Resmisari, S.Pd.', jenis_ptk:'Guru Tetap Yayasan', status_aktif:'Aktif', catatan:null }
  ];
  D.komponen = [
    { guru_id:'G001', nama:'Dra. Siti Aminah, M.Pd.', komponen:'UPACARA',   jam_per_minggu:1, asal_angka:'bawaan', belum_diisi:false },
    { guru_id:'G001', nama:'Dra. Siti Aminah, M.Pd.', komponen:'BIMBINGAN', jam_per_minggu:1, asal_angka:'bawaan', belum_diisi:false },
    { guru_id:'G001', nama:'Dra. Siti Aminah, M.Pd.', komponen:'PIKET',     jam_per_minggu:4, asal_angka:'dari jadwal piket', belum_diisi:false },
    { guru_id:'G004', nama:'Rina Sulastri, S.Si.',    komponen:'UPACARA',   jam_per_minggu:1, asal_angka:'bawaan', belum_diisi:false },
    { guru_id:'G004', nama:'Rina Sulastri, S.Si.',    komponen:'BIMBINGAN', jam_per_minggu:1, asal_angka:'bawaan', belum_diisi:false },
    { guru_id:'G004', nama:'Rina Sulastri, S.Si.',    komponen:'PIKET',     jam_per_minggu:null, asal_angka:'belum ada', belum_diisi:true }
  ];

  D.kelompok = [
    { id:'T1', nama:'Tahsin · Pratahsin 1', jenis:'Kelompok', tingkat:0, mapel:'Tahsin', jam_terjadwal:4 },
    { id:'T2', nama:'Tahsin · Mahir 1', jenis:'Kelompok', tingkat:0, mapel:'Tahsin', jam_terjadwal:4 },
    { id:'M1', nama:'MD10-1', jenis:'Kelompok', tingkat:10, mapel:'Matematika Dasar', jam_terjadwal:2 }
  ];
  D.anggota = [
    { id:'A1', siswa_id:'S0', nisn:'1000000000', siswa:'Abdan Hamal', kelompok:'Tahsin · Pratahsin 1',
      mapel:'Tahsin', rombel:'10-1', wali_kelas:'Dra. Siti Aminah, M.Pd.' },
    { id:'A2', siswa_id:'S1', nisn:'1000000001', siswa:'Agni Mutia', kelompok:'Tahsin · Mahir 1',
      mapel:'Tahsin', rombel:'10-2', wali_kelas:'' },
    { id:'A3', siswa_id:'S0', nisn:'1000000000', siswa:'Abdan Hamal', kelompok:'MD10-1',
      mapel:'Matematika Dasar', rombel:'10-1', wali_kelas:'Dra. Siti Aminah, M.Pd.' }
  ];
  D.belumKelompok = [
    { rombel:'11-1', siswa:'Bayu Ridwan', nisn:'1000000002', siswa_id:'S2', belum_tahsin:'Tahsin', belum_matdas:null }
  ];
  D.dikecualikan = [
    { nisn:'1000000003', siswa:'Citra Lestari', rombel:'11-2', program:'Tahsin',
      alasan:'Non-muslim', dicatat_oleh:'Wakasek Kesiswaan' }
  ];

  D.siswa = [];
  const nama = ['Abdan Hamal','Agni Mutia','Bayu Ridwan','Citra Lestari','Dimas Prakoso','Eka Ramadhani'];
  nama.forEach((n, i) => D.siswa.push({
    id: 'S' + i, nisn: String(1000000000 + i), nis: '2627100' + (i + 10),
    nama: n, jk: i % 2 ? 'P' : 'L', tgl: '2010-0' + ((i % 9) + 1) + '-15',
    status: 'aktif', kelas: D.rombel[i % D.rombel.length].kode,
    rombel_id: D.rombel[i % D.rombel.length].id
  }));
}

/* ------------------------------------------------------------- modal */
function tutupModal() { $('#modal-root').innerHTML = ''; }
function bukaModal(html, lebar) {
  $('#modal-root').innerHTML = `<div class="ov"><div class="modal${lebar ? ' lebar' : ''}">${html}</div></div>`;
  const ov = $('#modal-root .ov');
  ov.onclick = e => { if (e.target === ov) tutupModal(); };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') tutupModal(); });

/* Formulir umum.
   kolom: [{k, label, tipe:'teks|angka|tanggal|pilih|panjang', opsi:[{v,t}],
            wajib, hint, bila:(nilai)=>bool, pemicu:true}]            */
function formulir({ judul, kolom, nilai = {}, simpan, lebar, catatan, hapus }) {
  const isi = { ...nilai };

  const gambarKolom = () => kolom.filter(k => !k.bila || k.bila(isi)).map(k => {
    const v = isi[k.k] == null ? '' : isi[k.k];
    let kendali;
    if (k.tipe === 'pilih') {
      kendali = `<select class="field" data-k="${k.k}" ${k.pemicu ? 'data-pemicu="1"' : ''}>` +
        (k.opsi || []).map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.t)}</option>`).join('') +
        `</select>`;
    } else if (k.tipe === 'panjang') {
      kendali = `<textarea class="field" data-k="${k.k}">${esc(v)}</textarea>`;
    } else {
      const t = k.tipe === 'tanggal' ? 'date' : 'text';
      kendali = `<input class="field${k.tipe === 'angka' ? ' num' : ''}" type="${t}" data-k="${k.k}" value="${esc(v)}"
        ${k.tipe === 'angka' ? 'inputmode="numeric"' : ''} ${k.daftar ? `list="dl-${k.k}"` : ''} autocomplete="off">` +
        (k.daftar ? `<datalist id="dl-${k.k}">${k.daftar.map(d => `<option value="${esc(d)}">`).join('')}</datalist>` : '');
    }
    return `<div class="fg ${k.lebar === 'penuh' ? 'penuh' : ''}" data-fg="${k.k}">
      <label>${esc(k.label)}${k.wajib ? ' <span style="color:var(--danger)">*</span>' : ''}</label>
      ${kendali}${k.hint ? `<div class="hint">${esc(k.hint)}</div>` : ''}</div>`;
  }).join('');

  const pasang = () => {
    $$('#modal-root [data-k]').forEach(el => {
      el.addEventListener('input', () => { isi[el.dataset.k] = el.value; });
      if (el.dataset.pemicu) el.addEventListener('change', () => {
        isi[el.dataset.k] = el.value;
        $('#form-isi').innerHTML = gambarKolom();
        pasang();
      });
    });
  };

  bukaModal(`<h2>${esc(judul)}</h2><div class="body">
      ${catatan ? `<p class="msg kecil">${esc(catatan)}</p>` : ''}
      <div id="form-isi">${gambarKolom()}</div></div>
    <div class="aksi">
      ${hapus ? '<button class="btn btn-d" id="m-hapus">Hapus</button><div style="flex:1"></div>' : ''}
      <button class="btn" id="m-batal">Batal</button>
      <button class="btn btn-p" id="m-simpan">Simpan</button></div>`, lebar);
  pasang();
  $('#m-batal').onclick = tutupModal;
  if (hapus) $('#m-hapus').onclick = () => {
    tutupModal();
    konfirmasi({ judul: 'Hapus', pesan: 'Data ini akan dihapus. Lanjutkan?', lanjut: hapus });
  };
  $('#m-simpan').onclick = async () => {
    $$('#modal-root .fg').forEach(f => { f.classList.remove('bad'); const e = $('.err', f); if (e) e.remove(); });
    let ok = true;
    kolom.filter(k => (!k.bila || k.bila(isi)) && k.wajib).forEach(k => {
      if (kosong(isi[k.k])) {
        const f = $(`[data-fg="${k.k}"]`);
        f.classList.add('bad');
        f.insertAdjacentHTML('beforeend', `<div class="err">${esc(k.label)} wajib diisi.</div>`);
        ok = false;
      }
    });
    if (!ok) return;
    tutupModal();
    await jalankan('Menyimpan…', () => simpan(isi));
  };
  const p = $('#modal-root .field');
  if (p) p.focus();
}

function konfirmasi({ judul, pesan, daftar, tombol = 'Hapus', bahaya = true, lanjut }) {
  bukaModal(`<h2>${esc(judul)}</h2><div class="body">
    <p class="msg">${pesan}</p>
    ${daftar && daftar.length ? `<ul class="list">${daftar.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}
      ${daftar.length > 12 ? `<li>… dan ${daftar.length - 12} lainnya</li>` : ''}</ul>` : ''}
    </div><div class="aksi"><button class="btn" id="m-batal">Batal</button>
    <button class="btn ${bahaya ? '' : 'btn-p'}" id="m-ya"
      ${bahaya ? 'style="background:var(--danger);border-color:var(--danger);color:#fff"' : ''}>${esc(tombol)}</button></div>`);
  $('#m-batal').onclick = tutupModal;
  $('#m-ya').onclick = async () => { tutupModal(); await jalankan('Memproses…', lanjut); };
}

/* ------------------------------------------------------------- layar */
function layarMasuk(pesan) {
  $('#layar').innerHTML = `<div class="gate"><div class="gate-card">
    <h1>Data Induk Sekolah</h1><p class="sub">${esc(KONFIG.sekolah)}</p>
    ${pesan ? `<div class="gate-err">${esc(pesan)}</div>` : ''}
    <div class="fg"><label>Nama petugas</label><input class="field" id="g-nama" autocomplete="off"></div>
    <div class="fg"><label>Kata sandi</label><input class="field" id="g-sandi" type="password"></div>
    <button class="btn btn-p btn-blok" id="g-masuk">Masuk</button>
    <p class="note">Nama petugas dicatat pada setiap perubahan data.</p></div></div>`;
  const coba = async () => {
    const nama = $('#g-nama').value.trim(), sandi = $('#g-sandi').value;
    if (!nama) return $('#g-nama').focus();
    if (!sandi) return $('#g-sandi').focus();
    sibuk('Memeriksa…');
    try { await masuk(nama, sandi); await muatSemua(); layarUtama(); toast('Selamat bekerja, ' + nama); }
    catch (e) { layarMasuk(e.message); }
    finally { sibuk(''); }
  };
  $('#g-masuk').onclick = coba;
  ['#g-nama', '#g-sandi'].forEach(s => $(s).onkeydown = e => { if (e.key === 'Enter') coba(); });
  $('#g-nama').focus();
}

function layarUtama() {
  $('#layar').innerHTML = '';
  $('#layar').appendChild($('#tpl-utama').content.cloneNode(true));
  $('#fPetugas').textContent = MODE === 'contoh' ? 'Mode contoh' : sesi.petugas;
  $('#fTa').textContent = 'TA ' + sesi.ta;
  $('#bKeluar').onclick = () => {
    sesi.token = ''; sesi.petugas = '';
    if (MODE === 'db') layarMasuk(); else toast('Mode contoh tidak memakai login');
  };
  $$('#nav button').forEach(b => b.onclick = () => {
    halaman = b.dataset.hal; sel.clear();
    $$('#nav button').forEach(x => x.classList.toggle('on', x === b));
    gambar();
  });
  gambar();
}

function gambar() {
  if (!$('#isi')) return;
  ({ beranda: halBeranda, siswa: halSiswa, guru: halGuru, tugas: halTugas,
     kelas: halKelas, jadwal: halJadwal, kelompok: halKelompok, mapel: halMapel, jabatan: halJabatan, piket: halPiket, profil: halProfil, tahun: halTahun }[halaman] || halBeranda)();
  gambarSelbar();
}

/* ----------------------------------------------------------- beranda */
function halBeranda() {
  const sAktif = D.siswa.filter(s => s.status === 'aktif');
  const gAktif = D.guru.filter(g => g.status_aktif === 'Aktif');
  const tanpaKelas = sAktif.filter(s => !s.kelas).length;
  const kurang = gAktif.filter(g => kosong(g.tmt_sekolah) || kosong(g.mapel_utama) || kosong(g.jenis_ptk)).length;
  const piket = new Set(D.tugas.filter(t => t.aktif &&
    (D.jenis.find(j => j.nama === t.jenis) || {}).wajib_piket).map(t => t.guru_id)).size;

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Beranda</h1>
      <p>Data induk sekolah — dipakai bersama oleh seluruh aplikasi. Tahun ajaran ${esc(sesi.ta)}.</p></div>
      <div class="sp"></div>
      <button class="btn" id="bCadangan">Unduh cadangan</button></div>
    ${MODE === 'contoh' ? `<div class="info-box"><b>Mode contoh.</b> Isi bagian KONFIG di
      <code>assets/app.js</code> untuk menyambungkan ke database. Perubahan tidak tersimpan.</div>` : ''}
    <div class="kartu-baris">
      <div class="kartu"><b>${sAktif.length}</b><span>siswa aktif</span></div>
      <div class="kartu"><b>${gAktif.length}</b><span>guru aktif</span></div>
      <div class="kartu"><b>${D.rombel.length}</b><span>rombel</span></div>
      <div class="kartu"><b>${D.mapel.filter(m => m.aktif !== false).length}</b><span>mata pelajaran</span></div>
      <div class="kartu"><b>${piket}</b><span>petugas piket</span></div>
    </div>
    ${(tanpaKelas || kurang) ? `<div class="kartu-baris">
      ${tanpaKelas ? `<div class="kartu warn"><b>${tanpaKelas}</b><span>siswa aktif belum punya kelas</span></div>` : ''}
      ${kurang ? `<div class="kartu warn"><b>${kurang}</b><span>guru datanya belum lengkap</span></div>` : ''}
    </div>` : ''}
    <div class="panel"><div class="panel-head"><h3>Jumlah siswa per rombel</h3></div>
      <div class="panel-body"><div class="bar">${
        D.rombel.length ? D.rombel.map(r => {
          const n = sAktif.filter(s => s.kelas === r.kode).length;
          return `<span class="chip" style="border-left:3px solid ${warnaTingkat(r.tingkat)}">${esc(r.kode)}<span class="c">${n}</span></span>`;
        }).join('') : '<span class="kecil">Belum ada rombel pada tahun ajaran ini.</span>'
      }</div></div></div>`;
  $('#bCadangan').onclick = unduhCadangan;
}

/* ------------------------------------------------------------- siswa */
function siswaTersaring() {
  const q = ui.qSiswa.trim().toLowerCase();
  return D.siswa.filter(s => {
    if (ui.statusSiswa !== 'semua' && s.status !== ui.statusSiswa) return false;
    if (ui.kelasSiswa && s.kelas !== ui.kelasSiswa) return false;
    if (q && !(s.nama + ' ' + s.nisn + ' ' + s.nis + ' ' + s.kelas).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (a.kelas || '').localeCompare(b.kelas || '', 'id', { numeric: true })
                 || a.nama.localeCompare(b.nama, 'id'));
}

function halSiswa() {
  const data = siswaTersaring();
  const maxHal = Math.max(1, Math.ceil(data.length / ui.ukuran));
  if (ui.hal > maxHal) ui.hal = maxHal;
  const mulai = (ui.hal - 1) * ui.ukuran;
  const laman = data.slice(mulai, mulai + ui.ukuran);

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Data Siswa</h1><p>${D.siswa.length} siswa terdaftar pada tahun ajaran ${esc(sesi.ta)}.</p></div>
      <div class="sp"></div>
      <button class="btn btn-p" id="bTambah">+ Tambah siswa</button>
      <button class="btn" id="bUnggah">Unggah berkas</button>
      <button class="btn" id="bUnduh">Unduh Data (xlsx)</button>
      <button class="btn" id="bUnduhAbsen">Unduh Absen (xlsx)</button></div>
    <div class="bar">
      <div class="grow"><input class="field" id="q" placeholder="Cari nama, NISN, atau NIS…" value="${esc(ui.qSiswa)}"></div>
      <select class="field" id="fStatus" style="width:auto">
        ${['semua', ...STATUS_SISWA].map(s => `<option value="${s}" ${ui.statusSiswa === s ? 'selected' : ''}>${s === 'semua' ? 'Semua status' : s}</option>`).join('')}
      </select>
      <select class="field" id="fUkuran" style="width:auto">
        ${[25, 50, 100, 99999].map(n => `<option value="${n}" ${ui.ukuran === n ? 'selected' : ''}>${n === 99999 ? 'Semua' : n + ' baris'}</option>`).join('')}
      </select></div>
    <div class="bar">
      <button class="chip ${ui.kelasSiswa === '' ? 'on' : ''}" data-kelas="">Semua kelas</button>
      ${D.rombel.map(r => `<button class="chip ${ui.kelasSiswa === r.kode ? 'on' : ''}" data-kelas="${esc(r.kode)}">${esc(r.kode)}<span class="c">${D.siswa.filter(s => s.kelas === r.kode && s.status === 'aktif').length}</span></button>`).join('')}
    </div>
    <div class="panel">
      <div class="panel-head"><div class="info">${data.length === D.siswa.length ? data.length + ' siswa' : data.length + ' dari ' + D.siswa.length + ' siswa'}</div></div>
      <div class="scroll"><table><thead><tr>
        <th style="width:34px"><input type="checkbox" class="cbx" id="cbAll"></th>
        <th style="width:44px" class="hide-sm">No</th>
        <th style="width:118px">NISN</th><th style="width:108px" class="hide-sm">NIS</th>
        <th>Nama</th><th style="width:86px">Kelas</th>
        <th style="width:110px" class="hide-sm">Tgl lahir</th>
        <th style="width:82px" class="hide-sm">Status</th><th style="width:118px"></th>
      </tr></thead><tbody>${
        laman.length ? laman.map((s, i) => `<tr class="${sel.has(s.id) ? 'sel' : ''} ${s.status !== 'aktif' ? 'mati' : ''}" data-id="${esc(s.id)}">
          <td><input type="checkbox" class="cbx cb" ${sel.has(s.id) ? 'checked' : ''}></td>
          <td class="num hide-sm kecil">${mulai + i + 1}</td>
          <td class="num">${esc(s.nisn || '—')}</td>
          <td class="num hide-sm">${esc(s.nis || '—')}</td>
          <td style="font-weight:500">${esc(s.nama)}</td>
          <td>${s.kelas ? `<span class="tag" style="background:${warnaTingkat(tingkatDari(s.kelas))}">${esc(s.kelas)}</span>` : '<span class="kecil">belum</span>'}</td>
          <td class="num hide-sm">${tglIndo(s.tgl)}</td>
          <td class="hide-sm"><span class="tag tag-l">${esc(s.status)}</span></td>
          <td class="act"><button class="btn btn-sm bUbah">Ubah</button>
            <button class="btn btn-sm btn-d bHapus">Hapus</button></td></tr>`).join('')
        : `<tr><td colspan="9"><div class="empty"><b>Tidak ada siswa yang cocok</b>Ubah pencarian atau saringan.</div></td></tr>`
      }</tbody></table></div>
      <div class="foot"><div class="info">${data.length ? `Menampilkan ${mulai + 1}–${Math.min(mulai + ui.ukuran, data.length)} dari ${data.length}` : '—'}</div>
        <div class="sp" style="flex:1"></div><div class="pg" id="pg"></div></div>
    </div>`;

  pasangPager(maxHal, n => { ui.hal = n; gambar(); });
  $('#q').oninput = e => { clearTimeout(window._q); window._q = setTimeout(() => { ui.qSiswa = e.target.value; ui.hal = 1; gambar(); }, 200); };
  $('#fStatus').onchange = e => { ui.statusSiswa = e.target.value; ui.hal = 1; gambar(); };
  $('#fUkuran').onchange = e => { ui.ukuran = +e.target.value; ui.hal = 1; gambar(); };
  $$('[data-kelas]').forEach(b => b.onclick = () => { ui.kelasSiswa = b.dataset.kelas; ui.hal = 1; gambar(); });
  $('#bTambah').onclick = () => formSiswa(null);
  $('#bUnggah').onclick = () => pilihBerkas(m => imporSiswa(m));
  $('#bUnduhAbsen').onclick = () => {
    const per = new Map();
    siswaTersaring().filter(x => x.status === 'aktif').forEach(x => {
      const k = x.kelas || '(tanpa kelas)';
      if (!per.has(k)) per.set(k, []);
      per.get(k).push(x);
    });
    [...per.values()].forEach(a => a.sort((x, y) => x.nama.localeCompare(y.nama, 'id')));
    // Wali kelas diambil dari tugas guru bila rombelnya tunggal.
    const kelasTerpilih = [...per.keys()];
    const wali = kelasTerpilih.length === 1 ? namaWali(kelasTerpilih[0]) : '';
    unduhAbsenXlsx('Daftar Hadir Tatap Muka',
      { labelKelas: 'Kelas', labelGuru: 'Wali Kelas', nilaiGuru: wali },
      new Map([...per.entries()].sort()), '');
  };
  $('#bUnduh').onclick = () => unduhTabel('Daftar Siswa', kolomSiswa(), siswaTersaring(),
    `Tahun Pelajaran ${sesi.ta}` + (ui.kelasSiswa ? `  ·  Kelas ${ui.kelasSiswa}` : ''));
  $('#cbAll').onchange = e => { laman.forEach(s => e.target.checked ? sel.add(s.id) : sel.delete(s.id)); gambar(); };
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const id = tr.dataset.id;
    if (e.target.classList.contains('cb')) { e.target.checked ? sel.add(id) : sel.delete(id); gambar(); }
    else if (e.target.classList.contains('bUbah')) formSiswa(id);
    else if (e.target.classList.contains('bHapus')) hapusSiswa([id]);
  };
}

function formSiswa(id) {
  const s = id ? D.siswa.find(x => x.id === id) : { status: 'aktif', kelas: ui.kelasSiswa || '' };
  formulir({
    judul: id ? 'Ubah data siswa' : 'Tambah siswa',
    nilai: s,
    kolom: [
      { k: 'nama', label: 'Nama lengkap', wajib: true },
      { k: 'nisn', label: 'NISN', tipe: 'angka', hint: '10 digit' },
      { k: 'nis', label: 'NIS', tipe: 'angka' },
      { k: 'kelas', label: 'Kelas', daftar: D.rombel.map(r => r.kode), hint: 'Boleh kelas baru, akan dibuat otomatis' },
      { k: 'jk', label: 'Jenis kelamin', tipe: 'pilih', opsi: [{ v: '', t: '— belum diisi —' }, { v: 'L', t: 'Laki-laki' }, { v: 'P', t: 'Perempuan' }] },
      { k: 'tgl', label: 'Tanggal lahir', tipe: 'tanggal' },
      { k: 'status', label: 'Status', tipe: 'pilih', opsi: STATUS_SISWA.map(v => ({ v, t: v })),
        hint: 'Siswa mutasi keluar cukup diubah statusnya, jangan dihapus.' }
    ],
    simpan: async n => {
      const isi = { nisn: n.nisn || null, nis: n.nis || null, nama: n.nama.trim(),
                    jenis_kelamin: n.jk || null, tanggal_lahir: n.tgl || null, status: n.status || 'aktif' };
      if (MODE === 'contoh') {
        if (id) Object.assign(s, n); else D.siswa.push({ id: 'S' + Date.now(), ...n });
      } else if (id) {
        await perbarui('siswa', `id=eq.${enc(id)}`, isi);
        if (n.kelas && n.kelas !== s.kelas) await tempatkan(id, n.kelas);
        await muatSiswa();
      } else {
        const d = await simpanBaru('siswa', isi);
        if (n.kelas) await tempatkan(d[0].id, n.kelas);
        await muatSiswa();
      }
      toast(id ? 'Data diperbarui' : 'Siswa ditambahkan');
    }
  });
}

function hapusSiswa(ids) {
  const nama = D.siswa.filter(s => ids.includes(s.id)).map(s => s.nama);
  konfirmasi({
    judul: ids.length > 1 ? `Hapus ${ids.length} siswa` : 'Hapus data siswa',
    pesan: 'Data berikut dihapus permanen. Untuk siswa yang pindah atau keluar, lebih baik ubah statusnya saja agar riwayat tetap utuh.',
    daftar: nama,
    lanjut: async () => {
      if (MODE === 'db') for (const id of ids) await buang('siswa', `id=eq.${enc(id)}`);
      D.siswa = D.siswa.filter(s => !ids.includes(s.id));
      ids.forEach(i => sel.delete(i));
      toast(ids.length + ' data dihapus');
    }
  });
}


/* Nama wali kelas suatu rombel, dari tugas guru yang aktif. */
function namaWali(kodeRombel) {
  const r = D.rombel.find(x => x.kode === kodeRombel);
  if (!r) return '';
  const t = D.tugas.find(x => x.jenis === 'Wali Kelas' && x.aktif && x.rombel_id === r.id);
  return t ? namaGuru(t.guru_id) : '';
}

/* Daftar hadir kosong untuk diisi manual, mengikuti bentuk yang sudah
   dipakai sekolah: kop, keterangan kelas dan pengajar, lalu kolom
   pertemuan ke-1 sampai ke-20 yang dibiarkan kosong. */
async function unduhAbsenXlsx(judulAbsen, keterangan, kelompokSiswa, mapel) {
  const isiTotal = [...kelompokSiswa.values()].reduce((a, b) => a + b.length, 0);
  if (!isiTotal) return toast('Tidak ada siswa untuk dibuatkan daftar hadir.', true);

  await jalankan('Menyiapkan daftar hadir…', async () => {
    const ExcelJS = await muatExcelJS();
    const wb = new ExcelJS.Workbook();
    const PERTEMUAN = 20;

    for (const [namaKelas, siswa] of kelompokSiswa) {
      if (!siswa.length) continue;
      const ws = wb.addWorksheet(namaKelas.replace(/[\\\/?*\[\]:]/g, '-').slice(0, 31), {
        pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                     margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } }
      });
      const kolomAkhir = 4 + PERTEMUAN;
      ws.columns = [{ width: 4.5 }, { width: 32 }, { width: 5 }, { width: 8 },
                    ...Array.from({ length: PERTEMUAN }, () => ({ width: 3.4 }))];

      // Kop yang sama dengan berkas lain: logo, nama dan alamat sekolah
      // di sebelahnya, lalu judul di tengah.
      let r = await kopExcel(wb, ws, judulAbsen, 'Tahun Pelajaran ' + sesi.ta, kolomAkhir);
      const isiKet = [[keterangan.labelKelas, namaKelas]]
        .concat(mapel ? [['Mata Pelajaran', mapel]] : [])
        .concat([[keterangan.labelGuru, keterangan.nilaiGuru || '……………………………………………']]);
      isiKet.forEach(function (pasangan) {
        ws.mergeCells(r, 1, r, 2);
        ws.getCell(r, 1).value = pasangan[0];
        ws.getCell(r, 1).font = { size: 10 };
        ws.mergeCells(r, 3, r, 8);
        ws.getCell(r, 3).value = ': ' + pasangan[1];
        ws.getCell(r, 3).font = { size: 10 };
        r++;
      });
      r++;

      const b1 = r, b2 = r + 1;
      [['No', 1], ['Nama Siswa', 2], ['L/P', 3], ['Kelas', 4]].forEach(function (x) {
        ws.mergeCells(b1, x[1], b2, x[1]);
        const c = ws.getCell(b1, x[1]);
        c.value = x[0];
        c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      ws.mergeCells(b1, 5, b1, kolomAkhir);
      const cp = ws.getCell(b1, 5);
      cp.value = 'Pertemuan Ke / Tanggal';
      cp.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
      cp.alignment = { horizontal: 'center', vertical: 'middle' };
      for (let n = 1; n <= PERTEMUAN; n++) {
        const c = ws.getCell(b2, 4 + n);
        c.value = n;
        c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      ws.getRow(b1).height = 20; ws.getRow(b2).height = 16;
      r = b2 + 1;

      siswa.forEach(function (sw, i) {
        const br = ws.getRow(r);
        br.getCell(1).value = i + 1;
        br.getCell(2).value = sw.nama;
        br.getCell(3).value = sw.jk || '';
        br.getCell(4).value = sw.kelas || '';
        br.getCell(1).alignment = { horizontal: 'center' };
        br.getCell(3).alignment = { horizontal: 'center' };
        br.getCell(4).alignment = { horizontal: 'center' };
        br.getCell(2).font = { size: 10 };
        br.height = 18;
        for (let k = 1; k <= kolomAkhir; k++) {
          const c = ws.getCell(r, k);
          if (!c.font) c.font = { size: 10 };
          c.border = { top: { style: 'thin', color: { argb: 'FFBFC9C6' } },
                       bottom: { style: 'thin', color: { argb: 'FFBFC9C6' } },
                       left: { style: 'thin', color: { argb: 'FFBFC9C6' } },
                       right: { style: 'thin', color: { argb: 'FFBFC9C6' } } };
        }
        r++;
      });

      ws.views = [{ state: 'frozen', xSplit: 4, ySplit: b2 }];
      r = kakiExcel(ws, r + 1, kolomAkhir);
      ttdExcel(ws, r + 1, kolomAkhir);
    }

    if (!wb.worksheets.length) throw new Error('Tidak ada daftar hadir yang terbentuk.');
    const buf = await wb.xlsx.writeBuffer();
    unduhBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
              judulAbsen.replace(/[^\w]+/g, '_') + '_' + stempel() + '.xlsx');
    toast(wb.worksheets.length + ' lembar daftar hadir diunduh');
  });
}

/* -------------------------------------------------------------- guru */
function halGuru() {
  const q = ui.qGuru.trim().toLowerCase();
  const data = D.guru.filter(g => {
    if (ui.statusGuru !== 'semua' && g.status_aktif !== ui.statusGuru) return false;
    if (q && !(g.nama + ' ' + g.nig + ' ' + g.id + ' ' + (g.mapel_utama || '')).toLowerCase().includes(q)) return false;
    return true;
  });
  const tugasGuru = id => D.tugas.filter(t => t.guru_id === id && t.aktif);

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Data Guru</h1><p>${D.guru.length} guru terdaftar. Tugas melekat dicatat per tahun ajaran.</p></div>
      <div class="sp"></div>
      <button class="btn btn-p" id="bTambah">+ Tambah guru</button>
      <button class="btn" id="bUnggah">Unggah berkas</button>
      <button class="btn" id="bUnduh">Unduh Data (xlsx)</button></div>
    <div class="bar">
      <div class="grow"><input class="field" id="q" placeholder="Cari nama, NIG, atau mapel…" value="${esc(ui.qGuru)}"></div>
      <select class="field" id="fStatus" style="width:auto">
        ${['semua', ...STATUS_GURU].map(s => `<option value="${s}" ${ui.statusGuru === s ? 'selected' : ''}>${s === 'semua' ? 'Semua status' : s}</option>`).join('')}
      </select></div>
    <div class="panel"><div class="panel-head"><div class="info">${data.length} dari ${D.guru.length} guru</div></div>
      <div class="scroll"><table><thead><tr>
        <th style="width:60px">NIG</th><th>Nama</th>
        <th style="width:130px" class="hide-sm">Mapel utama</th>
        <th style="width:130px" class="hide-sm">Jenis PTK</th>
        <th style="width:100px" class="hide-sm">TMT</th>
        <th>Tugas melekat</th><th style="width:130px"></th>
      </tr></thead><tbody>${
        data.length ? data.map(g => `<tr class="${g.status_aktif !== 'Aktif' ? 'mati' : ''}" data-id="${esc(g.id)}">
          <td class="num">${esc(g.nig || g.id)}</td>
          <td style="font-weight:500">${esc(g.nama)}
            ${g.status_aktif !== 'Aktif' ? `<span class="tag tag-l">${esc(g.status_aktif)}</span>` : ''}</td>
          <td class="hide-sm">${g.mapel_utama ? esc(g.mapel_utama) : '<span class="kecil">—</span>'}</td>
          <td class="hide-sm">${g.jenis_ptk ? esc(g.jenis_ptk) : '<span class="kecil">—</span>'}</td>
          <td class="hide-sm">${tglIndo(g.tmt_sekolah)}</td>
          <td>${tugasGuru(g.id).map(t => `<span class="tag tag-l">${esc(t.jenis)}${t.jabatan ? ' · ' + esc(t.jabatan) : (t.rombel_id ? ' · ' + esc(kodeRombel(t.rombel_id)) : '')}</span>`).join(' ') || '<span class="kecil">—</span>'}</td>
          <td class="act"><button class="btn btn-sm bUbah">Ubah</button>
            <button class="btn btn-sm bTugas">Tugas</button></td></tr>`).join('')
        : `<tr><td colspan="7"><div class="empty"><b>Tidak ada guru yang cocok</b>Ubah pencarian atau saringan.</div></td></tr>`
      }</tbody></table></div></div>`;

  $('#q').oninput = e => { clearTimeout(window._qg); window._qg = setTimeout(() => { ui.qGuru = e.target.value; gambar(); }, 200); };
  $('#fStatus').onchange = e => { ui.statusGuru = e.target.value; gambar(); };
  $('#bTambah').onclick = () => formGuru(null);
  $('#bUnggah').onclick = () => pilihBerkas(m => imporGuru(m));
  $('#bUnduh').onclick = () => unduhTabel('Daftar Guru', kolomGuru(), D.guru,
    `Tahun Pelajaran ${sesi.ta}  ·  ${D.guru.filter(g => g.status_aktif === 'Aktif').length} guru aktif`);
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (e.target.classList.contains('bUbah')) formGuru(tr.dataset.id);
    else if (e.target.classList.contains('bTugas')) { halaman = 'tugas'; ui.guruTugas = tr.dataset.id; $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.hal === 'tugas')); gambar(); }
  };
}

function nigBerikut() {
  const a = D.guru.map(g => parseInt(String(g.nig || g.id).replace(/\D/g, ''), 10)).filter(n => !Number.isNaN(n));
  return a.length ? Math.max(...a) + 1 : 1;
}

function formGuru(id) {
  const g = id ? D.guru.find(x => x.id === id) : { status_aktif: 'Aktif', nig: String(nigBerikut()) };
  formulir({
    judul: id ? 'Ubah data guru' : 'Tambah guru',
    nilai: { ...g, linier: g.linier === true ? 'ya' : g.linier === false ? 'tidak' : '',
             insentif_fingerprint: g.insentif_fingerprint ? 'ya' : 'tidak' },
    lebar: true,
    catatan: id ? 'NIG dan ID tidak dapat diubah karena sudah dirujuk jadwal KBM dan data lain.' : '',
    kolom: [
      { k: 'nama', label: 'Nama lengkap dengan gelar', wajib: true },
      ...(id ? [] : [{ k: 'nig', label: 'NIG', tipe: 'angka', wajib: true,
                       hint: 'Usulan nomor berikutnya sudah diisikan. ID guru dibuat otomatis dari NIG.' }]),
      { k: 'jenis_kelamin', label: 'Jenis kelamin', tipe: 'pilih',
        opsi: [{ v: '', t: '— belum diisi —' }, { v: 'L', t: 'Laki-laki' }, { v: 'P', t: 'Perempuan' }] },
      { k: 'jenis_ptk', label: 'Jenis PTK', tipe: 'pilih', wajib: true,
        opsi: PTK.map(v => ({ v, t: v })) },
      { k: 'status_aktif', label: 'Status', tipe: 'pilih', wajib: true,
        opsi: STATUS_GURU.map(v => ({ v, t: v })),
        hint: 'Guru nonaktif tetap terbaca pada data lama, tetapi tidak muncul di daftar pilihan.' },

      { k: 'nip', label: 'NIP', tipe: 'angka' },
      { k: 'nuptk', label: 'NUPTK', tipe: 'angka' },

      { k: 'tmt_sekolah', label: 'TMT di sekolah ini', tipe: 'tanggal',
        hint: 'Dipakai untuk perhitungan masa kerja' },
      { k: 'tmt_guru', label: 'TMT sebagai guru', tipe: 'tanggal' },
      { k: 'tmt_status', label: 'TMT status kepegawaian', tipe: 'tanggal' },

      { k: 'pendidikan_terakhir', label: 'Pendidikan terakhir', tipe: 'pilih',
        opsi: ['', 'D3', 'S1', 'S2', 'S3'].map(v => ({ v, t: v || '— belum diisi —' })) },
      { k: 'jurusan', label: 'Jurusan' },
      { k: 'mapel_utama', label: 'Mata pelajaran utama', tipe: 'pilih',
        opsi: [{ v: '', t: '— belum diisi —' }, ...D.mapel.map(m => ({ v: m.nama, t: m.nama }))] },
      { k: 'linier', label: 'Linier dengan mapel utama', tipe: 'pilih',
        opsi: [{ v: '', t: '— belum diisi —' }, { v: 'ya', t: 'Ya' }, { v: 'tidak', t: 'Tidak' }],
        hint: 'Kesesuaian jurusan pendidikan dengan mata pelajaran yang diampu' },
      { k: 'no_sertifikat_pendidik', label: 'Nomor sertifikat pendidik' },
      { k: 'insentif_fingerprint', label: 'Insentif TM & Konsumsi lewat fingerprint', tipe: 'pilih',
        opsi: [{ v: 'tidak', t: 'Tidak — dihitung dari rekap kehadiran' }, { v: 'ya', t: 'Ya — dibayar akhir bulan dari fingerprint' }],
        hint: 'Sesuai kontrak kerja. Honor Mengajar & Transport Berdiri tetap dihitung (berbeda dengan Staf).' },

      { k: 'no_hp', label: 'Nomor HP' },
      { k: 'email', label: 'Email' },
      { k: 'catatan', label: 'Catatan', tipe: 'panjang' }
    ],
    simpan: async n => {
      const bersih = v => (v == null || String(v).trim() === '') ? null : String(v).trim();
      const isi = {
        nama: n.nama.trim(),
        nip: bersih(n.nip), nuptk: bersih(n.nuptk),
        jenis_kelamin: bersih(n.jenis_kelamin),
        jenis_ptk: n.jenis_ptk, status_aktif: n.status_aktif || 'Aktif',
        tmt_sekolah: bersih(n.tmt_sekolah), tmt_guru: bersih(n.tmt_guru),
        tmt_status: bersih(n.tmt_status),
        pendidikan_terakhir: bersih(n.pendidikan_terakhir), jurusan: bersih(n.jurusan),
        linier: n.linier === 'ya' ? true : n.linier === 'tidak' ? false : null,
        no_sertifikat_pendidik: bersih(n.no_sertifikat_pendidik),
        mapel_utama: bersih(n.mapel_utama),
        insentif_fingerprint: n.insentif_fingerprint === 'ya',
        no_hp: bersih(n.no_hp), email: bersih(n.email), catatan: bersih(n.catatan)
      };
      if (MODE === 'contoh') {
        if (id) Object.assign(g, isi);
        else D.guru.push({ id: 'G' + String(n.nig).padStart(3, '0'), nig: n.nig, ...isi });
      } else if (id) {
        await perbarui('guru', `id=eq.${enc(id)}`, isi);
        Object.assign(g, isi);
      } else {
        const idBaru = 'G' + String(n.nig).replace(/\D/g, '').padStart(3, '0');
        if (D.guru.some(x => x.id === idBaru)) throw new Error(`ID ${idBaru} sudah dipakai. Gunakan NIG lain.`);
        const d = await simpanBaru('guru', { id: idBaru, nig: n.nig, ...isi });
        D.guru.push(d[0]);
      }
      D.guru.sort(urutGuru);
      toast(id ? 'Data guru diperbarui' : 'Guru ditambahkan');
    }
  });
}

/* ------------------------------------------------------- tugas guru */
const sifat = (namaJenis, kunci) => (D.jenis.find(j => j.nama === namaJenis) || {})[kunci];
const namaGuru = id => (D.guru.find(g => g.id === id) || {}).nama || id;
const kodeRombel = rid => (D.rombel.find(r => r.id === rid) || {}).kode || '';

function rincianTugas(t) {
  if (t.jabatan) return t.jabatan;
  if (t.rombel_id) return kodeRombel(t.rombel_id);
  return '—';
}
function jamTugas(t) {
  if (t.jam_tambahan_mengajar) return t.jam_tambahan_mengajar + ' jam tambahan mengajar/minggu';
  if (t.jam_piket_unit) return t.jam_piket_unit + ' jam piket unit/minggu';
  return '';
}
function belumLengkap(t) {
  const kurang = [];
  if (sifat(t.jenis, 'perlu_jabatan') && kosong(t.jabatan)) kurang.push('jabatan');
  if (sifat(t.jenis, 'perlu_rombel') && !t.rombel_id) kurang.push('kelas');
  if (sifat(t.jenis, 'tambah_jam_mengajar') && !t.jam_tambahan_mengajar) kurang.push('jam tambahan');
  if (sifat(t.jenis, 'jam_unit') && !t.jam_piket_unit) kurang.push('jam piket unit');
  return kurang;
}

function halTugas() {
  const peringkat = peringkatGuru();
  const data = D.tugas
    .filter(t => !ui.jenisTugas || t.jenis === ui.jenisTugas)
    .filter(t => !ui.guruTugas || t.guru_id === ui.guruTugas)
    .sort((a, b) => (a.jenis || '').localeCompare(b.jenis || '')
                 || peringkat(a.guru_id) - peringkat(b.guru_id));

  const piket = D.piket;   // dari jadwal, bukan disimpulkan dari jenis tugas
  const unit  = D.tugas.filter(t => t.aktif && sifat(t.jenis, 'jam_unit'));
  const perlu = D.tugas.filter(t => t.aktif && belumLengkap(t).length);

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Tugas Guru</h1>
      <p>Tugas yang melekat pada guru untuk tahun ajaran ${esc(sesi.ta)}. Satu guru boleh merangkap beberapa tugas.</p></div>
      <div class="sp"></div><button class="btn btn-p" id="bTambah">+ Tambah tugas</button></div>

    ${perlu.length ? `<div class="info-box"><b>${perlu.length} tugas belum lengkap.</b>
      Data lama tetap tersimpan, tetapi akan diminta dilengkapi begitu disunting.
      Baris yang perlu dilengkapi ditandai di tabel bawah.</div>` : ''}

    <div class="kartu-baris">
      <div class="kartu"><b>${piket.length}</b><span>petugas piket menurut jadwal</span></div>
      <div class="kartu"><b>${unit.length}</b><span>penanggung jawab unit</span></div>
      <div class="kartu"><b>${D.tugas.filter(t => t.aktif).length}</b><span>tugas aktif</span></div>
    </div>

    <div class="bar">
      <button class="chip ${!ui.jenisTugas ? 'on' : ''}" data-jenis="">Semua jenis</button>
      ${D.jenis.map(j => `<button class="chip ${ui.jenisTugas === j.nama ? 'on' : ''}" data-jenis="${esc(j.nama)}">${esc(j.nama)}<span class="c">${D.tugas.filter(t => t.jenis === j.nama && t.aktif).length}</span></button>`).join('')}
      ${ui.guruTugas ? `<button class="chip on" id="bSemuaGuru">Hanya ${esc(namaGuru(ui.guruTugas))} ✕</button>` : ''}
    </div>

    <div class="panel"><div class="panel-head"><div class="info">${data.length} tugas</div></div>
      <div class="scroll"><table><thead><tr>
        <th>Guru</th><th style="width:130px">Jenis</th><th style="width:190px">Kelas / Jabatan</th>
        <th style="width:180px" class="hide-sm">Jam</th>
        <th style="width:95px" class="hide-sm">Mulai</th><th style="width:70px">Status</th>
        <th style="width:150px"></th>
      </tr></thead><tbody>${
        data.length ? data.map(t => {
          const kurang = belumLengkap(t);
          return `<tr class="${t.aktif ? '' : 'mati'} ${kurang.length ? 'bad' : ''}" data-id="${esc(t.id)}">
            <td style="font-weight:500">${esc(namaGuru(t.guru_id))}</td>
            <td><span class="tag tag-l">${esc(t.jenis)}</span></td>
            <td>${esc(rincianTugas(t))}
              ${kurang.length ? `<div class="kecil" style="color:var(--warn)">belum ada: ${esc(kurang.join(', '))}</div>` : ''}</td>
            <td class="hide-sm kecil">${esc(jamTugas(t) || '—')}</td>
            <td class="num hide-sm">${tglIndo(t.mulai)}</td>
            <td>${t.aktif ? 'aktif' : '<span class="kecil">selesai</span>'}</td>
            <td class="act"><button class="btn btn-sm bUbah">Ubah</button>
              ${t.aktif ? '<button class="btn btn-sm bSelesai">Akhiri</button>' : ''}
              <button class="btn btn-sm btn-d bHapusTugas">Hapus</button></td></tr>`;
        }).join('')
        : `<tr><td colspan="7"><div class="empty"><b>Belum ada tugas tercatat</b>Tambahkan lewat tombol di atas.</div></td></tr>`
      }</tbody></table></div></div>`;

  $$('[data-jenis]').forEach(b => b.onclick = () => { ui.jenisTugas = b.dataset.jenis; gambar(); });
  if ($('#bSemuaGuru')) $('#bSemuaGuru').onclick = () => { ui.guruTugas = null; gambar(); };
  $('#bTambah').onclick = () => formTugas(null);
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const t = D.tugas.find(x => String(x.id) === tr.dataset.id);
    if (e.target.classList.contains('bUbah')) formTugas(t);
    else if (e.target.classList.contains('bSelesai')) akhiriTugas(t);
    else if (e.target.classList.contains('bHapusTugas')) hapusTugas(t);
  };
}

function formTugas(t) {
  const baru = !t;
  const awal = t ? { ...t, rombel_ref: kodeRombel(t.rombel_id) }
                 : { guru_id: ui.guruTugas || '', jenis: 'Wali Kelas',
                     mulai: new Date().toISOString().slice(0, 10) };
  const penjelasan = n => (D.jenis.find(j => j.nama === n.jenis) || {}).penjelasan || '';

  formulir({
    judul: baru ? 'Tambah tugas guru' : 'Ubah tugas guru',
    nilai: awal,
    lebar: true,
    kolom: [
      { k: 'guru_id', label: 'Guru', tipe: 'pilih', wajib: true,
        opsi: [{ v: '', t: '— pilih guru —' },
               ...D.guru.filter(g => g.status_aktif === 'Aktif' || g.id === awal.guru_id)
                        .map(g => ({ v: g.id, t: g.nama }))] },
      { k: 'jenis', label: 'Jenis tugas', tipe: 'pilih', wajib: true, pemicu: true,
        opsi: D.jenis.map(j => ({ v: j.nama, t: j.nama })),
        hint: penjelasan(awal) },

      { k: 'rombel_ref', label: 'Kelas', tipe: 'pilih', wajib: true,
        bila: n => sifat(n.jenis, 'perlu_rombel'),
        opsi: [{ v: '', t: '— pilih kelas —' }, ...D.rombel.map(r => ({ v: r.kode, t: r.kode }))],
        hint: 'Satu kelas satu wali, dan satu guru hanya boleh menjadi wali satu kelas. '
            + 'Piket meja sekolah tidak otomatis mengikuti — itu ditentukan jadwal piket.' },

      { k: 'jabatan', label: 'Jabatan / unit', tipe: 'pilih', wajib: true,
        bila: n => sifat(n.jenis, 'perlu_jabatan'),
        opsi: [{ v: '', t: D.jabatan.length ? '— pilih jabatan —' : '— daftar jabatan masih kosong —' },
               // jabatan yang sedang dipakai baris ini tetap ditampilkan,
               // walaupun sudah ditandai nonaktif
               ...D.jabatan.filter(j => j.aktif !== false || j.nama === awal.jabatan)
                           .map(j => ({ v: j.nama, t: `${j.nama} (${j.kategori})` }))],
        hint: D.jabatan.length
          ? 'Belum ada di daftar? Tambahkan lewat halaman Jabatan & Unit, daftar ini langsung ikut terbarui.'
          : 'Daftar jabatan masih kosong. Isi lebih dulu lewat halaman Jabatan & Unit.' },

      { k: 'jam_tambahan_mengajar', label: 'Jam tambahan mengajar per minggu', tipe: 'angka', wajib: true,
        bila: n => sifat(n.jenis, 'tambah_jam_mengajar'),
        hint: 'Dibayar lewat penambahan jam mengajar. Bukan tatap muka, dan tidak menimbulkan transport kedatangan.' },

      { k: 'jam_piket_unit', label: 'Jam piket unit per minggu', tipe: 'angka', wajib: true,
        bila: n => sifat(n.jenis, 'jam_unit'),
        hint: 'Jam kehadiran di unit yang menjadi tanggung jawabnya. Menjadi dasar transport kedatangan. Bukan piket meja sekolah.' },

      { k: 'mulai', label: 'Mulai bertugas', tipe: 'tanggal' },
      { k: 'keterangan', label: 'Keterangan', tipe: 'panjang' }
    ],
    simpan: async n => {
      const isi = {
        guru_id: n.guru_id, tahun_ajaran: sesi.ta, jenis: n.jenis,
        rombel_id: sifat(n.jenis, 'perlu_rombel')
          ? (MODE === 'contoh' ? null : await idRombel(n.rombel_ref)) : null,
        jabatan: sifat(n.jenis, 'perlu_jabatan') ? n.jabatan : null,
        jam_tambahan_mengajar: sifat(n.jenis, 'tambah_jam_mengajar') ? Number(n.jam_tambahan_mengajar) : null,
        jam_piket_unit: sifat(n.jenis, 'jam_unit') ? Number(n.jam_piket_unit) : null,
        keterangan: n.keterangan || null, mulai: n.mulai || null, aktif: true
      };
      if (MODE === 'contoh') {
        if (t) Object.assign(t, isi); else D.tugas.push({ id: 'T' + Date.now(), ...isi });
      } else if (t) {
        await perbarui('guru_tugas', `id=eq.${enc(t.id)}`, isi);
        Object.assign(t, isi);
      } else {
        const d = await simpanBaru('guru_tugas', isi);
        D.tugas.push(d[0]);
      }
      toast(t ? 'Tugas diperbarui' : 'Tugas ditambahkan');
    }
  });
}

/* Menghapus tugas yang salah dicatat. Berbeda dengan Akhiri: yang ini
   menghilangkan catatannya sama sekali, seolah tidak pernah ada.
   Dipakai hanya bila tugasnya memang keliru, bukan bila tugasnya
   berakhir — riwayat yang benar tetap perlu disimpan.                */
function hapusTugas(t) {
  const akibat = [];
  if (t.jenis === 'Staf')
    akibat.push('guru ini kembali masuk perhitungan honor tambahan: komponen upacara, '
              + 'bimbingan, dan piketnya akan muncul sebagai belum diisi');
  if (t.jenis === 'Wali Kelas')
    akibat.push('rombel ' + (kodeRombel(t.rombel_id) || '—') + ' menjadi tanpa wali kelas');
  if (t.jenis === 'Diperbantukan')
    akibat.push('hak transport pada unit ' + (t.jabatan || '—') + ' ikut hilang');

  konfirmasi({
    judul: 'Hapus tugas',
    pesan: `Hapus tugas <b>${esc(t.jenis)}</b> untuk <b>${esc(namaGuru(t.guru_id))}</b>?
            Catatannya hilang sama sekali.
            <br><br>Bila tugas ini sebenarnya pernah dijalankan lalu berakhir,
            jangan dihapus — pakai <b>Akhiri</b>, supaya rekap bulan-bulan sebelumnya
            tidak ikut berubah.
            ${akibat.length ? '<br><br>Sesudah dihapus: ' + esc(akibat.join('; ')) + '.' : ''}`,
    tombol: 'Hapus',
    lanjut: async () => {
      if (MODE === 'db') await buang('guru_tugas', `id=eq.${enc(t.id)}`);
      D.tugas = D.tugas.filter(x => x.id !== t.id);
      if (MODE === 'db') await muatSemua();
      toast('Tugas dihapus');
    }
  });
}

function akhiriTugas(t) {
  konfirmasi({
    judul: 'Akhiri tugas', bahaya: false, tombol: 'Akhiri',
    pesan: `Tugas <b>${esc(t.jenis)}</b> untuk <b>${esc(namaGuru(t.guru_id))}</b> ditandai selesai.
            Datanya tetap tersimpan sebagai riwayat, tidak dihapus.
            Pakai ini bila tugasnya memang pernah dijalankan lalu berakhir.`,
    lanjut: async () => {
      if (MODE === 'db')
        await perbarui('guru_tugas', `id=eq.${enc(t.id)}`,
                       { aktif: false, selesai: new Date().toISOString().slice(0, 10) });
      t.aktif = false;
      toast('Tugas diakhiri');
    }
  });
}





/* ------------------------------------------- matriks jadwal piket */
/* Satu sumber untuk bilah tab halaman Piket. Sebelumnya tiap tab menuliskan
   bilahnya sendiri, dan tiap penambahan tab harus disalin ke semua. */
const TAB_PIKET = [
  ['meja',     'Piket Meja Sekolah'],
  ['unit',     'Piket Unit + Diperbantukan'],
  ['parkiran', 'Piket parkiran']
];
const barPiket = (aktif, ekstra = '') => `<div class="bar">${
  TAB_PIKET.map(([k, t]) => `<button class="chip${k === aktif ? ' on' : ''}" data-tab="${k}">${esc(t)}</button>`).join('')
}${ekstra}</div>`;

/* Tiga tampilan dalam satu halaman Piket Meja Sekolah. Dipakai segmented
   control, bukan chip, supaya jelas ini tingkat di bawah tab utama. */
const SUB_MEJA = [
  ['matriks',  'Matriks jadwal'],
  ['petugas',  'Petugas piket'],
  ['komponen', 'Komponen honor wali kelas']
];
const barSubMeja = (aktif, ekstra = '') => `<div class="bar"><div class="mx-seg">${
  SUB_MEJA.map(([k, t]) => `<button class="${k === aktif ? 'on' : ''}" data-sub="${k}">${esc(t)}</button>`).join('')
}</div>${ekstra}</div>`;

/* Satu tempat memasang seluruh tombol perpindahan halaman piket. */
function pasangTabPiket() {
  $$('[data-tab]').forEach(b => b.onclick = () => { ui.piketTab = b.dataset.tab; gambar(); });
  $$('[data-sub]').forEach(b => b.onclick = () => { ui.mejaSub = b.dataset.sub; gambar(); });
}

function halPiketMatriks() {
  const HR = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const data = D.piketJadwal || [];
  const jamKe = [...new Set(data.map(p => p.jam_ke))].sort((a, b) => a - b);
  const pakai = HR.filter(h => data.some(p => p.hari === h));
  const sel = (h, j) => data.filter(p => p.hari === h && p.jam_ke === j);
  const jamTeks = j => {
    const x = data.find(p => p.jam_ke === j && p.jam_mulai);
    return x ? String(x.jam_mulai).slice(0, 5) + '–' + String(x.jam_selesai || '').slice(0, 5) : '';
  };

  // Kolom = jam pelajaran (termasuk yang belum ada petugasnya, supaya bisa
  // diisi), jeda istirahat diberi kolom sela tipis.
  const jamList = [...new Set([...D.jamPel.map(x => Number(x.jam_ke)), ...jamKe])].sort((a, b) => a - b)
    .map(n => D.jamPel.find(x => Number(x.jam_ke) === n) || { jam_ke: n });
  const kolom = [];
  jamList.forEach((j, i) => {
    const prev = jamList[i - 1];
    if (prev && prev.selesai && j.mulai && jam5(prev.selesai) !== jam5(j.mulai))
      kolom.push({ sela: true, dari: jam5(prev.selesai), sampai: jam5(j.mulai) });
    kolom.push({ jam: j, jk: Number(j.jam_ke) });
  });

  // Warna pita menurut dasar penugasan piketnya.
  const WARNA_DASAR = { 'Piket': WARNA_BLOK[1], 'Wali Kelas': WARNA_BLOK[0], 'Staf': WARNA_BLOK[2] };
  const dasarAda = [...new Set(data.map(p => p.dasar))].sort((a, b) =>
    (a === 'belum tercatat') - (b === 'belum tercatat') || urutNama(a, b));
  const warnaDasar = d => d === 'belum tercatat' ? ['#FCE9E7', '#A32F2A']
    : WARNA_DASAR[d] || WARNA_BLOK[3 + dasarAda.indexOf(d) % 8];

  const hariNyata = ['Minggu', ...HARI][new Date().getDay()];
  const sekarang = jamBerjalan();
  const peringkat = peringkatGuru();

  // Tiap petugas menempati satu lajur dalam baris hari, jadi jam berturut-turut
  // orang yang sama tersambung jadi satu pita. Petugas yang jam jaganya tidak
  // bertumpuk berbagi lajur, supaya baris hari tetap pendek.
  const barisHtml = pakai.map(h => {
    const hariIni = data.filter(p => p.hari === h);
    const rentang = new Map();
    hariIni.forEach(p => {
      const r = rentang.get(p.guru_id) || { a: 99, b: 0 };
      rentang.set(p.guru_id, { a: Math.min(r.a, p.jam_ke), b: Math.max(r.b, p.jam_ke) });
    });
    const petugas = [...rentang.keys()].sort((x, y) => rentang.get(x).a - rentang.get(y).a ||
      peringkat(x) - peringkat(y));
    const akhirLajur = [], lajurDari = new Map();
    petugas.forEach(g => {
      let i = akhirLajur.findIndex(akhir => akhir < rentang.get(g).a);
      if (i < 0) i = akhirLajur.push(0) - 1;
      akhirLajur[i] = rentang.get(g).b;
      lajurDari.set(g, i);
    });
    const jalur = akhirLajur.map((_, i) => petugas.filter(g => lajurDari.get(g) === i));
    const ada = (g, jk) => hariIni.find(p => p.guru_id === g && p.jam_ke === jk);

    const tds = kolom.map((c, ci) => {
      if (c.sela) return '<td class="mx-sela"></td>';
      const skr = h === hariNyata && sekarang === c.jk ? ' skr' : '';
      const kiri = kolom[ci - 1], kanan = kolom[ci + 1];
      const n = hariIni.filter(p => p.jam_ke === c.jk).length;
      const pita = !n ? '' : jalur.map(lajur => {
        const g = lajur.find(x => ada(x, c.jk)), p = g && ada(g, c.jk);
        if (!p) return '<div class="pk-kosong"></div>';
        const w = warnaDasar(p.dasar);
        const sambungKiri = kiri && !kiri.sela && ada(g, kiri.jk);
        const sambungKanan = kanan && !kanan.sela && ada(g, kanan.jk);
        return `<div class="pk-pita${sambungKiri ? ' kiri' : ''}${sambungKanan ? ' kanan' : ''}${p.staf ? ' staf' : ''}"
          draggable="true" data-id="${esc(p.id)}"
          style="--bg:${w[0]};--aksen:${w[1]}"
          title="${esc(p.guru + '\n' + h + ' jam ke-' + c.jk + (jamTeks(c.jk) ? ' (' + jamTeks(c.jk) + ')' : '')
                 + '\nDasar: ' + p.dasar + (p.staf ? ' · tanpa transport' : '')
                 + '\nSeret untuk memindahkan')}">${esc(namaPendek(p.guru))}</div>`;
      }).join('');
      return `<td class="mx-sel pk-sel${skr}${n ? '' : ' pk-nol'}" data-hari="${h}" data-jam="${c.jk}"
        title="${esc(h + ' jam ke-' + c.jk + ' · ' + (n ? n + ' petugas' : 'belum ada petugas') + ' — klik untuk mengatur')}">
        ${pita}<span class="pk-tambah">+</span></td>`;
    }).join('');

    return `<tr class="${h === hariNyata ? 'aktif' : ''}"><th class="mx-label" scope="row">
      <span>${h}</span><small>${petugas.length} petugas</small></th>${tds}</tr>`;
  }).join('');

  const nSela = kolom.filter(c => c.sela).length;
  const lebarMin = 96 + (kolom.length - nSela) * 76 + nSela * 12;
  const kepala = kolom.map(c => c.sela
    ? `<th class="mx-sela" title="Istirahat ${c.dari}–${c.sampai}"></th>`
    : `<th class="mx-jam${sekarang === c.jk && pakai.includes(hariNyata) ? ' skr' : ''}">
        <b>${c.jk}</b>${c.jam.mulai ? `<span>${jam5(c.jam.mulai)}–${jam5(c.jam.selesai)}</span>` : ''}
        ${c.jam.keterangan ? `<i>${esc(c.jam.keterangan)}</i>` : ''}</th>`).join('');

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Piket Meja Sekolah</h1>
      <p>Siapa berjaga pada hari dan jam mana. Jam yang kosong tidak ada petugasnya.</p></div>
      <div class="sp"></div>
      <button class="btn" id="bUnduhPiket">Unduh (xlsx)</button></div>

    ${barPiket('meja')}
    ${barSubMeja('matriks', '<div class="sp" style="flex:1"></div>' + dasarAda.map(d => {
      const w = warnaDasar(d);
      return `<span class="pk-legenda" style="--bg:${w[0]};--aksen:${w[1]}">${esc(d)}</span>`;
    }).join(''))}

    ${!data.length ? `<div class="panel"><div class="empty"><b>Belum ada jadwal piket terbaca</b>
      Jalankan berkas 35 lebih dulu, lalu muat ulang halaman.</div></div>` : `
    <div class="panel"><div class="mx-scroll"><table class="mx" style="min-width:${lebarMin}px"><thead><tr>
      <th class="mx-sudut">Hari</th>${kepala}
    </tr></thead><tbody>${barisHtml}</tbody></table></div>
    <div class="foot"><div class="info">${data.length} jam piket ·
      ${new Set(data.map(p => p.guru_id)).size} petugas ·
      ${pakai.length} hari</div></div></div>

    <p class="kecil">Ketuk sel mana pun untuk mengatur siapa yang berjaga pada hari dan jam itu —
      menambah atau mengeluarkan petugas. Tiap petugas punya lajurnya sendiri dalam satu hari,
      jadi jam jaga yang berturut-turut tampil sebagai satu pita panjang.
      Warna pita menunjukkan atas dasar apa ia berjaga; pita bergaris putus-putus berarti staf
      (tanpa transport). Kolom berlatar abu belum ada petugasnya.
      Seret pita untuk memindahkan jam jaganya; penempatan ditolak bila pada jam itu guru
      tersebut sedang mengajar atau menjaga unit.</p>

    <div class="pu-tray buang" id="pkBuang">Seret pita ke sini untuk mengeluarkan petugas dari jadwal</div>`}`;

  pasangTabPiket();
  if ($('#bUnduhPiket')) $('#bUnduhPiket').onclick = () => unduhPiketMejaXlsx(pakai, jamKe, sel, jamTeks);
  pasangSeretMeja();
}

/* Seret pita piket meja sekolah antar sel; ketuk sel tetap membuka daftar
   untuk menambah atau mengeluarkan, dan itulah jalan di layar sentuh. */
function pasangSeretMeja() {
  let bawa = null;

  $$('.pk-pita[data-id]').forEach(el => {
    el.addEventListener('dragstart', ev => {
      bawa = { id: el.dataset.id };
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', JSON.stringify(bawa));
      el.classList.add('seret');
    });
    el.addEventListener('dragend', () => { el.classList.remove('seret'); bawa = null; });
  });

  $$('.pk-sel').forEach(td => {
    td.addEventListener('dragover', ev => { ev.preventDefault(); td.classList.add('incar'); });
    td.addEventListener('dragleave', () => td.classList.remove('incar'));
    td.addEventListener('drop', ev => {
      ev.preventDefault();
      td.classList.remove('incar');
      const m = bawa || bacaMuatan(ev);
      if (m && m.id) pindahPiketMeja(m.id, td.dataset.hari, Number(td.dataset.jam));
    });
    td.addEventListener('click', () => dialogPiketSel(td.dataset.hari, +td.dataset.jam));
  });

  const buang = $('#pkBuang');
  if (buang) {
    buang.addEventListener('dragover', ev => { ev.preventDefault(); buang.classList.add('incar'); });
    buang.addEventListener('dragleave', () => buang.classList.remove('incar'));
    buang.addEventListener('drop', ev => {
      ev.preventDefault();
      buang.classList.remove('incar');
      const m = bawa || bacaMuatan(ev);
      if (m && m.id) keluarkanPiketMeja(m.id);
    });
  }
}

/* Bentrok bagi petugas piket meja sekolah. Piket meja sendiri tidak dihitung
   bentrok antar petugas — satu jam boleh dijaga beberapa orang — yang dicegah
   adalah satu orang berada di dua tempat sekaligus. */
function bentrokMeja(guruId, hari, jamKe, kecualiId) {
  const j = D.jadwal.find(x => x.guru_id === guruId && x.hari === hari && Number(x.jam_ke) === jamKe);
  if (j) return `sedang mengajar ${j.mapel || ''} di ${j.kelas || ''}`.replace(/\s+/g, ' ').trim();
  const u = (D.piketUnit || []).find(x => x.guru_id === guruId && x.hari === hari && Number(x.jam_ke) === jamKe);
  if (u) return `sedang menjaga ${u.unit || 'unit'}`;
  const m = (D.piketJadwal || []).find(x => x.guru_id === guruId && x.hari === hari &&
    Number(x.jam_ke) === jamKe && String(x.id) !== String(kecualiId));
  if (m) return 'sudah berjaga di meja sekolah';
  return null;
}

function pindahPiketMeja(id, hari, jamKe) {
  const p = (D.piketJadwal || []).find(x => String(x.id) === String(id));
  if (!p || (p.hari === hari && Number(p.jam_ke) === jamKe)) return;
  jalankan('Menyimpan…', async () => {
    const sebab = bentrokMeja(p.guru_id, hari, jamKe, id);
    if (sebab) throw new Error(`${p.guru} ${sebab} pada ${hari} jam ke-${jamKe}.`);
    if (MODE === 'db') { await perbarui('piket', `id=eq.${enc(id)}`, { hari, jam_ke: jamKe }); await muatSemua(); }
    else { p.hari = hari; p.jam_ke = jamKe; }
    toast(`${namaPendek(p.guru)}: ${hari} jam ke-${jamKe}`);
  });
}

function keluarkanPiketMeja(id) {
  const p = (D.piketJadwal || []).find(x => String(x.id) === String(id));
  if (!p) return;
  jalankan('Menyimpan…', async () => {
    if (MODE === 'db') { await buang('piket', `id=eq.${enc(id)}`); await muatSemua(); }
    else D.piketJadwal = D.piketJadwal.filter(x => String(x.id) !== String(id));
    toast(`${namaPendek(p.guru)} dikeluarkan dari ${p.hari} jam ke-${p.jam_ke}`);
  });
}

/* Mengatur petugas pada satu hari dan jam: menambah atau mengeluarkan. */
function dialogPiketSel(hari, jamKe) {
  const isi = (D.piketJadwal || []).filter(p => p.hari === hari && p.jam_ke === jamKe);
  const sudah = new Set(isi.map(p => p.guru_id));
  // D.guru sudah urut masa kerja, jadi penyaringan saja sudah cukup.
  const calon = D.guru.filter(g => g.status_aktif === 'Aktif' && !sudah.has(g.id));

  bukaModal(`<h2>Piket ${esc(hari)} jam ke-${jamKe}</h2><div class="body">
    ${isi.length ? `<p class="msg kecil">Yang berjaga sekarang:</p>
      <table class="log"><tbody>${isi.map(p => `<tr>
        <td style="font-weight:500">${esc(p.guru)}</td>
        <td class="kecil">${esc(p.dasar)}</td>
        <td style="text-align:right"><button class="btn btn-sm btn-d"
          data-keluar="${esc(p.id)}">Keluarkan</button></td></tr>`).join('')}</tbody></table>`
     : '<p class="msg kecil">Belum ada petugas pada jam ini.</p>'}

    <div class="fg" style="margin-top:14px"><label>Tambahkan petugas</label>
      <select class="field" id="pTambah">
        <option value="">— pilih guru —</option>
        ${calon.map(g => {
          const sebab = bentrokMeja(g.id, hari, jamKe, null);
          return `<option value="${esc(g.id)}" ${sebab ? 'disabled' : ''}>${esc(g.nama)}${
            sebab ? ` — ${esc(sebab)}` : ''}</option>`;
        }).join('')}
      </select>
      <div class="hint">Guru yang sudah berjaga pada jam ini tidak ditampilkan; yang sedang
        mengajar atau menjaga unit ditampilkan tetapi tidak bisa dipilih.</div></div>
    </div>
    <div class="aksi"><button class="btn" id="m-batal">Tutup</button>
      <button class="btn btn-p" id="m-tambah">Tambahkan</button></div>`);

  $('#m-batal').onclick = tutupModal;
  $$('[data-keluar]').forEach(b => b.onclick = () => { tutupModal(); keluarkanPiketMeja(b.dataset.keluar); });
  $('#m-tambah').onclick = () => {
    const guruId = $('#pTambah').value;
    if (!guruId) { $('#pTambah').focus(); return; }
    tutupModal();
    jalankan('Menyimpan…', async () => {
      const sebab = bentrokMeja(guruId, hari, jamKe, null);
      if (sebab) throw new Error(`${namaGuru(guruId)} ${sebab} pada ${hari} jam ke-${jamKe}.`);
      if (MODE === 'contoh') { toast('Mode contoh: tidak tersimpan'); return; }
      await simpanBaru('piket', {
        id: 'PK' + Date.now().toString(36).toUpperCase(),
        guru_id: guruId, hari: hari, jam_ke: jamKe });
      await muatSemua();
      toast('Petugas ditambahkan');
    });
  };
}

/* Berkas Excel berkop, memakai ExcelJS supaya logo dan penggabungan sel
   bisa dipakai — SheetJS tidak mendukung penyisipan gambar.            */
/* Dua alamat, dicoba berurutan. Satu CDN saja pernah membuat seluruh
   unduhan xlsx mati di jaringan yang memblokirnya, dan pesannya
   ("periksa sambungan internet") menyesatkan karena internetnya sendiri
   hidup. Kehadiran Guru memuat pustaka yang sama dari jsdelivr, jadi
   itulah cadangannya. */
const CDN_EXCELJS = [
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'
];

async function muatExcelJS() {
  if (window.ExcelJS) return window.ExcelJS;
  for (const alamat of CDN_EXCELJS) {
    try {
      await new Promise((selesai, gagal) => {
        const sc = document.createElement('script');
        sc.src = alamat;
        sc.onload = selesai;
        sc.onerror = () => gagal(new Error('gagal memuat ' + alamat));
        document.head.appendChild(sc);
      });
      if (window.ExcelJS) return window.ExcelJS;
    } catch (e) { console.warn(e.message); }
  }
  throw new Error('Pembuat Excel (ExcelJS) tidak bisa diunduh dari internet. '
    + 'Biasanya jaringan sekolah memblokir cdnjs.cloudflare.com dan cdn.jsdelivr.net — '
    + 'coba lewat jaringan lain, atau minta keduanya dibuka.');
}

/* --------------------------------------------- unduhan halaman Piket
   Ketiga tab bisa diunduh, dan tiap berkas berisi dua macam lembar:

     Jadwal          matriks isi jadwalnya — untuk ditempel dan diarsipkan
     Formulir paraf  lembar sepekan yang kosong, untuk dibubuhi tangan

   Keduanya sengaja dipisah. Matriks menyatakan SIAPA TERJADWAL, dan
   barisnya adalah hari — "Senin", bukan "Senin, 21 September 2026".
   Paraf di atasnya tidak membuktikan apa pun, karena lembar yang sama
   berlaku sepanjang tahun. Yang dibubuhi paraf karena itu lembar
   tersendiri, yang pekannya ditulis tangan. Versi bertanggal ada di
   Kehadiran Guru → Pelaksanaan Piket, halaman yang memang tahu
   tanggalnya.

   Bentuk formulirnya sendiri ada di assets/formulir-piket.js, berkas
   yang sama persis di kedua aplikasi: dokumen yang ditandatangani guru
   tidak boleh berbeda tergantung dari mana diunduhnya.               */

function formulirBersama() {
  if (!window.FormulirPiket) throw new Error(
    'Berkas assets/formulir-piket.js belum termuat, sehingga formulir paraf tidak bisa dibuat. '
    + 'Muat ulang halaman; bila tetap gagal, laporkan ke operator.');
  return window.FormulirPiket;
}

/* Penanda tangan formulir: Kepala Sekolah mengetahui, Wakasek Kurikulum
   sebagai penanggung jawab isinya — susunan yang sama dengan berkas
   rekap di Kehadiran Guru. Tanggalnya kosong karena lembarnya memang
   diisi tangan pada pekan yang bersangkutan. */
const ttdFormulir = () => ({
  tempat: SEKOLAH.kota, tanggal: null, kepala: SEKOLAH.kepala,
  labelKanan: 'Wakasek Kurikulum,', namaKanan: (D.ttd || {}).kurikulum || ''
});

/* Matriks piket di kertas: baris jam pelajaran, kolom hari. Sengaja
   berlawanan dengan layar — di kertas kolom hari yang cuma lima membuat
   nama guru terbaca utuh, sedangkan dua belas kolom jam memaksa
   tulisannya mengecil sampai tidak terbaca lagi.

   isiSel(hari, jam) mengembalikan daftar tulisan untuk satu sel; itulah
   satu-satunya yang berbeda antara matriks meja dan matriks unit.     */
async function lembarMatriksPiket(wb, { nama, judul, hari, jamKe, isiSel, jamTeks }) {
  const ws = wb.addWorksheet(formulirBersama().namaLembar(nama));
  const kolomTerakhir = hari.length + 1;

  // Lebar kolom hari mengikuti tulisan terpanjang yang benar-benar ada
  // pada jadwal ini, bukan angka tetap — supaya nama guru yang panjang
  // tidak pecah menjadi tiga baris.
  const semua = [];
  hari.forEach(h => jamKe.forEach(j => semua.push(...isiSel(h, j))));
  const terpanjang = Math.max(18, ...semua.map(t => String(t).length));
  ws.columns = [{ width: 13 }, ...hari.map(() => ({ width: Math.min(34, terpanjang + 2) }))];

  let r = await kopExcel(wb, ws, judul, `Tahun Pelajaran ${sesi.ta}`, kolomTerakhir);

  const barisKepala = r;
  const kepala = ws.getRow(r);
  ['Jam', ...hari].forEach((t, i) => {
    const c = kepala.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                 left: { style: 'thin' }, right: { style: 'thin' } };
  });
  kepala.height = 22;
  r++;

  jamKe.forEach((j, urutan) => {
    const baris = ws.getRow(r);
    const kiri = baris.getCell(1);
    kiri.value = jamTeks(j) ? `Jam ${j}\n${jamTeks(j)}` : `Jam ${j}`;
    kiri.font = { bold: true, size: 10 };
    kiri.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    hari.forEach((h, i) => {
      const c = baris.getCell(i + 2);
      const isi = isiSel(h, j);
      c.value = isi.join('\n');
      c.alignment = { vertical: 'middle', wrapText: true };
      c.font = { size: 10 };
      // Jam tanpa petugas diarsir; selebihnya berseling tipis supaya mata
      // tidak melompat baris saat membaca ke kanan.
      if (!isi.length) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      else if (urutan % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF9F4' } };
    });

    baris.eachCell(c => {
      c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                   left: { style: 'thin' }, right: { style: 'thin' } };
    });
    const terbanyak = Math.max(1, ...hari.map(h => isiSel(h, j).length));
    baris.height = Math.max(22, terbanyak * 14);
    r++;
  });

  r = kakiExcel(ws, r + 1, kolomTerakhir);
  ttdExcel(ws, r + 2, kolomTerakhir);
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                   margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
                   horizontalCentered: true, printTitlesRow: `${barisKepala}:${barisKepala}` };
  ws.views = [{ showGridLines: false }];
  return ws;
}

/* Baris formulir paraf: satu petugas, jam jaganya dikelompokkan per hari.
   Jamnya diserahkan sebagai DAFTAR ANGKA, bukan ringkasan "1–3": tiap jam
   mendapat lariknya sendiri di kertas karena tiap jam diparaf sendiri.
   Urut masa kerja, seperti seluruh daftar guru di aplikasi ini. */
function barisParaf(rows, ambilKunci, ambilNama, ambilUnit) {
  const peringkat = peringkatGuru();
  const per = new Map();
  rows.forEach(p => {
    const k = String(ambilKunci(p));
    if (!per.has(k)) per.set(k, { guruId: p.guru_id, nama: ambilNama(p),
                                  unit: ambilUnit ? ambilUnit(p) : '', jam: {} });
    const e = per.get(k);
    (e.jam[p.hari] = e.jam[p.hari] || []).push(Number(p.jam_ke));
  });
  const daftar = [...per.values()];
  daftar.forEach(e => Object.keys(e.jam).forEach(h => {
    e.jam[h] = [...new Set(e.jam[h])].sort((a, b) => a - b);
  }));
  return daftar.sort((a, b) => String(a.unit || '').localeCompare(String(b.unit || ''), 'id')
                            || peringkat(a.guruId) - peringkat(b.guruId));
}

async function simpanBukuPiket(wb, namaBerkas, kabar) {
  const buf = await wb.xlsx.writeBuffer();
  unduhBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            `${namaBerkas}_${stempel()}.xlsx`);
  toast(kabar);
}

async function unduhPiketMejaXlsx(hari, jamKe, sel, jamTeks) {
  await jalankan('Menyiapkan berkas…', async () => {
    const ExcelJS = await muatExcelJS();
    const F = formulirBersama();
    const wb = new ExcelJS.Workbook();
    await lembarMatriksPiket(wb, {
      nama: 'Jadwal', judul: 'Jadwal Piket Meja Sekolah', hari, jamKe, jamTeks,
      isiSel: (h, j) => sel(h, j).map(p => p.guru + (p.staf ? ' (staf)' : ''))
    });
    F.lembarParaf(wb, {
      wb, kop: kopBersama(), logo: await logoKop(), profil: profilKop(), jenis: 'meja',
      judul: 'Formulir Paraf Piket Meja Sekolah', sub: `Tahun Pelajaran ${sesi.ta}`,
      namaLembar: 'Formulir Paraf', pekan: null, ttd: ttdFormulir(),
      baris: barisParaf(D.piketJadwal || [], p => p.guru_id, p => p.guru)
    });
    await simpanBukuPiket(wb, 'Piket_Meja_Sekolah', 'Jadwal dan formulir paraf piket meja sekolah diunduh');
  });
}

async function unduhPiketUnitXlsx() {
  await jalankan('Menyiapkan berkas…', async () => {
    const ExcelJS = await muatExcelJS();
    const F = formulirBersama();
    const data = D.piketUnit || [];
    const hari = HARI_UNIT.filter(h => data.some(p => p.hari === h));
    const jamKe = [...new Set(data.map(p => Number(p.jam_ke)))].sort((a, b) => a - b);
    if (!hari.length) throw new Error('Belum ada jam piket unit yang terjadwal, jadi belum ada yang bisa '
      + 'diunduh. Susun dulu jadwalnya dengan menyeret kotak ke matriks.');
    const jamTeks = j => {
      const x = D.jamPel.find(v => Number(v.jam_ke) === j);
      return x && x.mulai ? jam5(x.mulai) + '–' + jam5(x.selesai) : '';
    };
    const wb = new ExcelJS.Workbook();
    await lembarMatriksPiket(wb, {
      nama: 'Jadwal', judul: 'Jadwal Piket Unit', hari, jamKe, jamTeks,
      isiSel: (h, j) => data.filter(p => p.hari === h && Number(p.jam_ke) === j)
                            .map(p => `${p.guru}\n${p.unit || 'unit belum diisi'}`)
    });
    F.lembarParaf(wb, {
      wb, kop: kopBersama(), logo: await logoKop(), profil: profilKop(), jenis: 'unit',
      judul: 'Formulir Paraf Piket Unit', sub: `Tahun Pelajaran ${sesi.ta}`,
      namaLembar: 'Formulir Paraf', pekan: null, ttd: ttdFormulir(),
      baris: barisParaf(data, p => p.tugas_id, p => p.guru, p => p.unit)
    });
    await simpanBukuPiket(wb, 'Piket_Unit', 'Jadwal dan formulir paraf piket unit diunduh');
  });
}

async function unduhPiketParkiranXlsx() {
  await jalankan('Menyiapkan berkas…', async () => {
    const ExcelJS = await muatExcelJS();
    const F = formulirBersama();
    const HR = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const roster = D.parkiran || [];
    const wb = new ExcelJS.Workbook();

    /* Jadwalnya tidak berbentuk matriks jam: parkiran dihitung per HARI,
       satu petugas, sesudah jam pulang. Daftar lima baris sudah memuat
       seluruhnya, sedangkan matriks jam akan kosong melompong.        */
    const ws = wb.addWorksheet('Jadwal');
    const KOL = 4;
    ws.columns = [{ width: 12 }, { width: 34 }, { width: 22 }, { width: 30 }];
    let r = await kopExcel(wb, ws, 'Jadwal Piket Parkiran', `Tahun Pelajaran ${sesi.ta}`, KOL);
    const kepala = ws.getRow(r);
    ['Hari', 'Petugas', 'Jenis PTK', 'Catatan'].forEach((t, i) => {
      const c = kepala.getCell(i + 1);
      c.value = t;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                   left: { style: 'thin' }, right: { style: 'thin' } };
    });
    kepala.height = 22;
    r++;
    HR.forEach((h, i) => {
      const p = roster.find(x => x.hari === h);
      const baris = ws.getRow(r);
      [h, p ? p.nama : 'belum ada petugas', p ? (p.jenis_ptk || '—') : '—',
       (p && p.catatan) || ''].forEach((v, k) => {
        const c = baris.getCell(k + 1);
        c.value = v;
        c.font = { size: 10, italic: !p && k === 1 };
        c.alignment = { horizontal: k === 0 ? 'center' : 'left', vertical: 'middle', wrapText: true };
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                     left: { style: 'thin' }, right: { style: 'thin' } };
        if (!p) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        else if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBF9F4' } };
      });
      baris.height = 22;
      r++;
    });
    r += 1;
    ws.mergeCells(r, 1, r, KOL);
    const catatan = ws.getCell(r, 1);
    catatan.value = 'Pengawas parkiran sesudah jam pulang, sekitar 30 menit. Kompensasinya dihitung '
      + 'per hari petugas benar-benar hadir, bukan per hari terjadwal.';
    catatan.font = { size: 8, italic: true, color: { argb: 'FF5E5548' } };
    r = kakiExcel(ws, r + 2, KOL);
    ttdExcel(ws, r + 2, KOL);
    ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                     margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
                     horizontalCentered: true };
    ws.views = [{ showGridLines: false }];

    F.lembarParaf(wb, {
      wb, kop: kopBersama(), logo: await logoKop(), profil: profilKop(), jenis: 'parkiran',
      judul: 'Formulir Paraf Piket Parkiran', sub: `Tahun Pelajaran ${sesi.ta}`,
      namaLembar: 'Formulir Paraf', pekan: null, ttd: ttdFormulir(),
      baris: Object.fromEntries(roster.map(p => [p.hari, p.nama]))
    });
    await simpanBukuPiket(wb, 'Piket_Parkiran', 'Jadwal dan formulir paraf piket parkiran diunduh');
  });
}

/* ---------------------------------------------------------- jadwal */
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const idJadwalBaru = () => 'JD' + Date.now().toString(36).toUpperCase();

/* Warna blok matriks per mata pelajaran — pasangan [latar, aksen] yang
   lembut, supaya pola jadwal terbaca sekilas tanpa menyilaukan. */
const WARNA_BLOK = [
  ['#E3EEF7', '#2B6CB0'], ['#DCEFE8', '#0F6E5C'], ['#EEE4F3', '#7B4397'], ['#FBEBD5', '#B26A00'],
  ['#F7E1DE', '#A32F2A'], ['#DDEFF1', '#1F7A85'], ['#F1EDD5', '#7A6A12'], ['#F3E0EA', '#9A3F6C'],
  ['#E4E9D6', '#55702A'], ['#E6E3F3', '#4B4E9E'], ['#EFE4D9', '#8A5A35'], ['#E3E8EA', '#48606A']
];
const warnaMapel = nama => {
  const i = D.mapel.findIndex(m => m.nama === nama);
  return WARNA_BLOK[(i < 0 ? 0 : i) % WARNA_BLOK.length];
};
const jam5 = t => String(t || '').slice(0, 5);
/* "Dra. Siti Aminah, M.Pd." -> "Siti Aminah"; nama lengkap tetap ada di tooltip. */
function namaPendek(nama) {
  let n = String(nama || '').split(',')[0];
  n = n.replace(/^((dra?s?|dr|h|hj|ir|prof|kh|ust|ustadz|ustadzah)\.?\s+)+/i, '').trim();
  const kata = n.split(/\s+/);
  return kata.length > 2 ? kata.slice(0, 2).join(' ') : n;
}
const urutNama = (a, b) => a.localeCompare(b, 'id', { numeric: true });

/* Kebiasaan sekolah: daftar guru disusun menurut masa kerja, yang paling lama
   lebih dulu. Dasarnya tmt_sekolah — masa kerja di sekolah lain tidak diakui,
   jadi itulah satu-satunya ukuran masa kerja di seluruh aplikasi.
   Yang TMT-nya belum diisi ditaruh paling akhir, bukan di depan; dan karena
   ada TMT yang dipakai beberapa guru, namanya selalu jadi pemecah seri. */
function urutGuru(a, b) {
  const ta = (a && a.tmt_sekolah) || '', tb = (b && b.tmt_sekolah) || '';
  if (ta !== tb) {
    if (!ta) return 1;
    if (!tb) return -1;
    return ta < tb ? -1 : 1;
  }
  return urutNama(String((a && a.nama) || ''), String((b && b.nama) || ''));
}
/* Peringkat menurut D.guru yang sudah urut, untuk daftar turunan yang hanya
   membawa guru_id. */
const peringkatGuru = () => {
  const p = new Map(D.guru.map((g, i) => [g.id, i]));
  return id => (p.has(id) ? p.get(id) : Number.MAX_SAFE_INTEGER);
};

function halJadwal() {
  const sudut = ui.jadwalSudut || 'kelas';          // 'kelas', 'guru', atau 'hari'
  // Semester bawaan mengikuti isi datanya, bukan ditebak.
  const smtAda = [...new Set(D.jadwal.map(j => Number(j.semester)))].sort();
  const smt = ui.jadwalSemester || smtAda[0] || 1;
  const jadwalSmt = D.jadwal.filter(j => j.semester == smt);
  // Sabtu hanya ditampilkan bila memang ada jadwalnya.
  const hariAda = HARI.filter(h => h !== 'Sabtu' || jadwalSmt.some(j => j.hari === 'Sabtu'));
  const hariNyata = ['Minggu', ...HARI][new Date().getDay()];

  // Program kelompok belajar (Tahsin, Matematika Dasar, …) — dikenali dari
  // mapel kelompoknya.
  const programDari = namaKelas => (D.kelompok.find(k => k.nama === namaKelas) || {}).mapel;
  const programJadwal = j => programDari(j.kelas) || j.mapel;
  const program = [...new Set([...D.kelompok.map(k => k.mapel),
    ...jadwalSmt.filter(j => j.jenis_kelas === 'Kelompok').map(j => j.mapel)])].filter(Boolean).sort(urutNama);

  // daftar pilihan sesuai sudut pandang
  // Daftar pilihan memuat rombel DAN kelompok belajar, termasuk yang
  // belum punya jadwal sama sekali — supaya jadwal kelompok baru bisa
  // disusun dari sini, tidak harus lewat tampilan per guru.
  const daftar = sudut === 'kelas'
    ? (() => {
        const peta = new Map();
        D.jadwal.forEach(j => peta.set(j.kelas, { id: j.kelas_id, nama: j.kelas, jenis: j.jenis_kelas }));
        D.rombel.forEach(r => { if (!peta.has(r.kode)) peta.set(r.kode, { id: r.id, nama: r.kode, jenis: 'Rombel' }); });
        D.kelompok.forEach(k => { if (!peta.has(k.nama)) peta.set(k.nama, { id: k.id, nama: k.nama, jenis: 'Kelompok' }); });
        return [...peta.values()].sort((a, b) =>
          (a.jenis === b.jenis ? 0 : a.jenis === 'Rombel' ? -1 : 1) || urutNama(a.nama, b.nama));
      })()
    : sudut === 'guru'
      // D.guru sudah urut masa kerja; sumbu "Per guru" ikut urutan itu.
      ? D.guru.filter(g => g.status_aktif === 'Aktif')
              .map(g => ({ id: g.id, nama: g.nama, jenis: '' }))
      : [];

  const pilih = ui.jadwalPilih || (daftar[0] && daftar[0].nama) || '';
  const iPilih = daftar.findIndex(d => d.nama === pilih);
  const hariPilih = hariAda.includes(ui.jadwalHari) ? ui.jadwalHari
                  : hariAda.includes(hariNyata) ? hariNyata : hariAda[0];
  const lingkup = program.includes(ui.jadwalLingkup) ? ui.jadwalLingkup : 'reguler';
  const matriksProgram = sudut === 'hari' && lingkup !== 'reguler';

  // ---- kolom: jam pelajaran, jeda istirahat diberi kolom sela tipis
  const jamList = D.jamPel.length ? D.jamPel
    : [...new Set(D.jadwal.map(j => j.jam_ke))].sort((a, b) => a - b).map(n => ({ jam_ke: n }));
  const kolom = [];
  jamList.forEach((j, i) => {
    const prev = jamList[i - 1];
    if (prev && prev.selesai && j.mulai && jam5(prev.selesai) !== jam5(j.mulai))
      kolom.push({ sela: true, dari: jam5(prev.selesai), sampai: jam5(j.mulai) });
    kolom.push({ jam: j, jk: Number(j.jam_ke) });
  });

  // ---- jam kelompok belajar per tingkat. Pada tampilan kelas, jam itu bukan
  // milik rombel: tiap siswa berangkat ke kelompoknya masing-masing. Jadi
  // ditampilkan sebagai keterangan dan tidak bisa diisi dari sini.
  // Satu jam bisa dipakai lebih dari satu program — seluruhnya dikumpulkan,
  // bukan dipilih salah satu, supaya yang terbaca tidak bergantung urutan data.
  const jamKelompok = new Map();
  jadwalSmt.filter(j => j.jenis_kelas === 'Kelompok').forEach(j => {
    const k = (j.tingkat || 0) + '|' + j.hari + '|' + j.jam_ke;
    if (!jamKelompok.has(k)) jamKelompok.set(k, new Set());
    jamKelompok.get(k).add(programJadwal(j));
  });
  const kunci = (namaKelas, h, jk) => {
    const t = tingkatDari(namaKelas);
    if (!t) return null;
    const v = new Set([...(jamKelompok.get('0|' + h + '|' + jk) || []), ...(jamKelompok.get(t + '|' + h + '|' + jk) || [])]);
    return v.size ? [...v].sort(urutNama) : null;
  };
  const isRombel = nama => !D.kelompok.some(k => k.nama === nama) &&
    !jadwalSmt.some(j => j.kelas === nama && j.jenis_kelas === 'Kelompok');

  // ---- baris & isi
  let baris, isiDari;
  if (sudut !== 'hari') {
    const milik = jadwalSmt.filter(j => sudut === 'kelas' ? j.kelas === pilih : j.guru === pilih);
    const rombelIni = sudut === 'kelas' && isRombel(pilih);
    baris = hariAda.map(h => ({ kunci: h, label: h, hari: h, kelas: sudut === 'kelas' ? pilih : '',
                                aktif: h === hariNyata, jml: milik.filter(j => j.hari === h).length }));
    isiDari = (b, jk) => {
      const prog = rombelIni ? kunci(pilih, b.hari, jk) : null;
      if (prog) return { kunci: prog };
      return { daftar: milik.filter(j => j.hari === b.hari && j.jam_ke === jk) };
    };
  } else {
    const hariIni = jadwalSmt.filter(j => j.hari === hariPilih);
    const kelompokDari = nama => !isRombel(nama);
    if (lingkup === 'reguler') {
      const nama = new Set([...D.rombel.map(r => r.kode),
        ...jadwalSmt.filter(j => j.jenis_kelas !== 'Kelompok').map(j => j.kelas)]);
      baris = [...nama].filter(n => !kelompokDari(n)).sort(urutNama)
        .map(n => ({ kunci: n, label: n, hari: hariPilih, kelas: n,
                     jml: hariIni.filter(j => j.kelas === n).length }));
      program.forEach(p => {
        const isi = hariIni.filter(j => j.jenis_kelas === 'Kelompok' && programJadwal(j) === p);
        if (isi.length) baris.push({ kunci: 'grup:' + p, label: p, hari: hariPilih, grup: p,
                                     sub: new Set(isi.map(j => j.kelas)).size + ' kelompok' });
      });
    } else {
      const nama = new Set([...D.kelompok.filter(k => k.mapel === lingkup).map(k => k.nama),
        ...jadwalSmt.filter(j => j.jenis_kelas === 'Kelompok' && programJadwal(j) === lingkup).map(j => j.kelas)]);
      baris = [...nama].sort(urutNama).map(n => ({
        kunci: n, hari: hariPilih, kelas: n, jml: hariIni.filter(j => j.kelas === n).length,
        label: n.replace(new RegExp('^' + lingkup.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[·:-]\\s*', 'i'), '') }));
    }
    isiDari = (b, jk) => {
      if (b.grup) {
        const isi = hariIni.filter(j => j.jam_ke === jk && j.jenis_kelas === 'Kelompok' && programJadwal(j) === b.grup);
        return { ringkas: isi };
      }
      const prog = lingkup === 'reguler' ? kunci(b.kelas, b.hari, jk) : null;
      if (prog) return { kunci: prog };
      return { daftar: hariIni.filter(j => j.kelas === b.kelas && j.jam_ke === jk) };
    };
  }

  // Isi blok menyesuaikan sudut pandang: yang sudah jelas dari judul tidak diulang.
  const utama = j => sudut === 'guru' ? j.kelas : matriksProgram ? namaPendek(j.guru) : j.mapel;
  const kedua = j => sudut === 'guru' || matriksProgram ? j.mapel : namaPendek(j.guru);
  const ketRingkas = isi => {
    const kel = new Set(isi.map(j => j.kelas));
    const tk = new Set(isi.map(j => j.tingkat || 0));
    return (tk.size === 1 && !tk.has(0) ? 'Kelas ' + [...tk][0] + ' · ' : '') + kel.size + ' kelompok';
  };

  // ---- susun sel tiap baris, lalu sambungkan jam berurutan yang sama
  const barisHtml = baris.map(b => {
    const sel = kolom.map(c => {
      if (c.sela) return c;
      const s = { ...c, ...isiDari(b, c.jk) };
      if (s.ringkas) s.sambung = s.ringkas.length ? 'grup|' + ketRingkas(s.ringkas) : null;
      else if (s.kunci) s.sambung = 'kunci|' + s.kunci.join();
      else s.sambung = s.daftar.length === 1 ? s.daftar[0].mapel + '|' + s.daftar[0].guru + '|' + s.daftar[0].kelas : null;
      return s;
    });
    sel.forEach((s, i) => {
      const p = sel[i - 1];
      if (s.sambung && p && !p.sela && p.sambung === s.sambung) { s.kiri = true; p.kanan = true; }
    });
    for (let i = sel.length - 1; i >= 0; i--) sel[i].rentang = sel[i].kanan ? sel[i + 1].rentang + 1 : 1;

    const sel_ = sel.map(s => {
      if (s.sela) return '<td class="mx-sela"></td>';
      const skr = b.hari === hariNyata && jamBerjalan() === s.jk ? ' skr' : '';
      const sambung = (s.kiri ? ' kiri' : '') + (s.kanan ? ' kanan' : '');
      const gaya = w => `style="--bg:${w[0]};--aksen:${w[1]};--rentang:${s.rentang}"`;
      if (s.ringkas) {
        if (!s.ringkas.length) return `<td class="mx-sel${skr}"></td>`;
        const ket = ketRingkas(s.ringkas);
        return `<td class="mx-sel${skr}"><div class="mx-blok ringkas${sambung}" data-lingkup="${esc(b.grup)}"
          ${gaya(warnaMapel(s.ringkas[0].mapel))} title="${esc('Kelompok ' + b.grup + ' · ' + ket + '\nKlik untuk membuka matriks ' + b.grup)}">
          <span class="u">Kelompok ${esc(b.grup)}</span><span class="k">${esc(ket)} ›</span></div></td>`;
      }
      if (s.kunci) return `<td class="mx-sel${skr}"><div class="mx-blok kunci${sambung}" style="--rentang:${s.rentang}"
          title="${esc(s.kunci.join(' · ') + ' — siswa berangkat ke kelompoknya masing-masing.\nDisusun dari jadwal kelompoknya.')}">
          <span class="u">${esc(s.kunci.join(' · '))}</span><span class="k">jam kelompok</span></div></td>`;
      const data = `data-hari="${esc(b.hari)}" data-jam="${s.jk}" data-kelas="${esc(b.kelas || '')}"`;
      if (!s.daftar.length) return `<td class="mx-sel kosong${skr}" ${data}><span class="mx-tambah">+</span></td>`;
      const bentrok = sudut === 'guru' && new Set(s.daftar.map(j => j.kelas)).size > 1;
      const banyak = s.daftar.length > 1;
      const blok = s.daftar.map(j => {
        const jp = D.jamPel.find(x => x.jam_ke === j.jam_ke);
        const judul = `${j.hari} · Jam ke-${j.jam_ke}${jp ? ` (${jam5(jp.mulai)}–${jam5(jp.selesai)})` : ''}\n`
                    + `${j.kelas} — ${j.mapel}\n${j.guru}\nKlik untuk mengubah atau menghapus`;
        return `<div class="mx-blok${sambung}${banyak ? ' rapat' : ''}" data-jid="${esc(j.id)}" ${gaya(warnaMapel(j.mapel))} title="${esc(judul)}">
          <span class="u">${esc(utama(j))}</span><span class="k">${esc(kedua(j))}</span></div>`;
      }).join('');
      return `<td class="mx-sel${skr}${bentrok ? ' bentrok' : ''}" ${data}>
        ${banyak ? `<div class="mx-tumpuk">${blok}</div>` : blok}</td>`;
    }).join('');

    const sub = b.grup ? b.sub : b.jml + ' JP';
    return `<tr class="${[b.aktif && 'aktif', b.grup && 'grup'].filter(Boolean).join(' ')}">
      <th class="mx-label" scope="row"><span>${esc(b.label)}</span><small>${esc(sub)}</small></th>${sel_}</tr>`;
  }).join('');

  const sekarang = hariAda.includes(hariNyata) ? jamBerjalan() : null;
  const kepala = kolom.map(c => c.sela
    ? `<th class="mx-sela" title="Istirahat ${c.dari}–${c.sampai}"></th>`
    : `<th class="mx-jam${sekarang === c.jk && (sudut !== 'hari' || hariPilih === hariNyata) ? ' skr' : ''}">
        <b>${c.jk}</b>${c.jam.mulai ? `<span>${jam5(c.jam.mulai)}–${jam5(c.jam.selesai)}</span>` : ''}
        ${c.jam.keterangan ? `<i>${esc(c.jam.keterangan)}</i>` : ''}</th>`).join('');
  const nSela = kolom.filter(c => c.sela).length;
  const lebarMin = 96 + (kolom.length - nSela) * 76 + nSela * 12;

  const jmlJam = sudut === 'hari'
    ? jadwalSmt.filter(j => j.hari === hariPilih && (lingkup === 'reguler'
        ? j.jenis_kelas !== 'Kelompok' : j.jenis_kelas === 'Kelompok' && programJadwal(j) === lingkup)).length
    : jadwalSmt.filter(j => sudut === 'kelas' ? j.kelas === pilih : j.guru === pilih).length;

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Jadwal KBM</h1>
      <p>Disunting di sini; aplikasi Kehadiran Guru hanya membacanya.
         Tahun ajaran ${esc(sesi.ta)}, semester ${smt}.</p></div>
      <div class="sp"></div>
      ${sudut !== 'hari' ? '<button class="btn" id="bUnduhJadwal">Unduh (xlsx)</button>' : ''}
      <button class="btn" id="bUnduhSemua">Unduh semua kelas</button></div>

    <div class="bar">
      <div class="mx-seg">
        <button class="${sudut === 'kelas' ? 'on' : ''}" data-sudut="kelas">Per kelas</button>
        <button class="${sudut === 'guru' ? 'on' : ''}" data-sudut="guru">Per guru</button>
        <button class="${sudut === 'hari' ? 'on' : ''}" data-sudut="hari">Per hari</button>
      </div>
      ${sudut !== 'hari' ? `
      <div class="mx-pilih">
        <button class="btn btn-sm" id="bSebelum" title="Sebelumnya" ${iPilih <= 0 ? 'disabled' : ''}>‹</button>
        <select class="field" id="fPilih">
          ${daftar.map(d => `<option value="${esc(d.nama)}" ${d.nama === pilih ? 'selected' : ''}>
            ${esc(d.nama)}${d.jenis === 'Kelompok' ? ' (kelompok)' : ''}</option>`).join('')}
        </select>
        <button class="btn btn-sm" id="bSesudah" title="Berikutnya" ${iPilih >= daftar.length - 1 ? 'disabled' : ''}>›</button>
      </div>` : `
      <div class="mx-seg">
        ${hariAda.map(h => `<button class="${h === hariPilih ? 'on' : ''}" data-hari-pilih="${h}">${h}</button>`).join('')}
      </div>`}
      <select class="field" id="fSemester" style="width:auto">
        ${(smtAda.length ? smtAda : [1, 2]).map(n =>
          `<option value="${n}" ${smt == n ? 'selected' : ''}>Semester ${n}</option>`).join('')}
      </select>
      <div class="sp" style="flex:1"></div>
      <div class="info kecil">${jmlJam} jam ${sudut === 'hari' ? 'hari ' + hariPilih : 'per minggu'}</div>
    </div>

    ${sudut === 'hari' && program.length ? `
    <div class="bar">
      <span class="kecil">Tampilkan:</span>
      <div class="mx-seg">
        <button class="${lingkup === 'reguler' ? 'on' : ''}" data-lingkup-pilih="reguler">Kelas Reguler</button>
        ${program.map(p => {
          const w = warnaMapel(p);
          return `<button class="${lingkup === p ? 'on' : ''}" data-lingkup-pilih="${esc(p)}">
            <i class="mx-titik" style="background:${w[1]}"></i>${esc(p)}</button>`;
        }).join('')}
      </div>
    </div>` : ''}

    ${D.galat.jadwal ? `<div class="info-box"><b>Jadwal tidak dapat dibaca.</b>
      ${esc(D.galat.jadwal)}<br>Kemungkinan berkas <code>33_jadwal_kbm.sql</code> belum dijalankan —
      tampilan ini bersandar pada view <code>v_jadwal</code> yang dibuat di sana.</div>`
     : (!D.jadwal.length ? `<div class="info-box"><b>Belum ada jadwal tersimpan.</b>
        Tabel jadwal terbaca, tetapi isinya kosong untuk tahun ajaran ${esc(sesi.ta)}.</div>`
     : (sudut !== 'hari' && !jmlJam ? `<div class="info-box">Tidak ada jam pelajaran untuk
        <b>${esc(pilih)}</b> pada semester ${smt}.
        ${smtAda.length > 1 ? 'Coba ganti semesternya.' : ''}</div>` : ''))}

    <div class="panel"><div class="mx-scroll"><table class="mx" style="min-width:${lebarMin}px"><thead><tr>
      <th class="mx-sudut">${sudut === 'hari' ? (matriksProgram ? 'Kelompok' : 'Kelas') : 'Hari'}</th>${kepala}
    </tr></thead><tbody>${barisHtml ||
      `<tr><td colspan="${kolom.length + 1}" class="empty">Belum ada kelas untuk ditampilkan.</td></tr>`}</tbody></table></div></div>

    <p class="kecil">Ketuk sel kosong <b>+</b> untuk menambah, atau ketuk blok pelajaran untuk mengubah dan
      menghapus. Jam berurutan dengan pelajaran dan guru yang sama tampil sebagai satu blok panjang,
      tetapi tetap bisa diketuk per jam.<br>
      Satu sel boleh berisi lebih dari satu guru pada kelompok Tahsin dan Matematika Dasar —
      itu pengajaran beregu, bukan bentrokan. Pada tampilan per guru, sel merah berarti guru
      terjadwal di dua kelas sekaligus.<br>
      Sel bergaris adalah jam kelompok belajar: siswa kelas ini berangkat ke kelompoknya
      masing-masing, jadi tidak diisi dari jadwal kelas. Untuk menyusunnya, buka
      <b>Per hari</b> lalu pilih programnya, atau pilih kelompoknya pada <b>Per kelas</b>
      (ada di bagian bawah daftar, ditandai "(kelompok)").</p>`;

  const ganti = perubahan => { Object.assign(ui, perubahan); gambar(); };
  $$('[data-sudut]').forEach(b => b.onclick = () => ganti({ jadwalSudut: b.dataset.sudut, jadwalPilih: null }));
  $$('[data-hari-pilih]').forEach(b => b.onclick = () => ganti({ jadwalHari: b.dataset.hariPilih }));
  $$('[data-lingkup-pilih]').forEach(b => b.onclick = () => ganti({ jadwalLingkup: b.dataset.lingkupPilih }));
  if ($('#fPilih')) {
    $('#fPilih').onchange = e => ganti({ jadwalPilih: e.target.value });
    $('#bSebelum').onclick = () => ganti({ jadwalPilih: daftar[iPilih - 1].nama });
    $('#bSesudah').onclick = () => ganti({ jadwalPilih: daftar[iPilih + 1].nama });
  }
  $('#fSemester').onchange = e => ganti({ jadwalSemester: +e.target.value });
  if ($('#bUnduhJadwal')) $('#bUnduhJadwal').onclick = () => unduhJadwalXlsx([pilih], sudut, smt);
  $('#bUnduhSemua').onclick = () => unduhJadwalXlsx(sudut === 'kelas' ? daftar.filter(d => d.jenis !== 'Kelompok').map(d => d.nama)
    : sudut === 'guru' ? daftar.map(d => d.nama)
    : D.rombel.map(r => r.kode).sort(urutNama), sudut === 'hari' ? 'kelas' : sudut, smt);

  $('table.mx tbody').onclick = e => {
    const ringkas = e.target.closest('[data-lingkup]');
    if (ringkas) { ganti({ jadwalLingkup: ringkas.dataset.lingkup }); return; }
    const blok = e.target.closest('[data-jid]');
    if (blok) { formJadwal(D.jadwal.find(j => String(j.id) === blok.dataset.jid)); return; }
    const td = e.target.closest('td.kosong');
    if (!td) return;
    if (sudut === 'guru') formJadwal(null, td.dataset.hari, +td.dataset.jam, 'guru', pilih, smt);
    else formJadwal(null, td.dataset.hari, +td.dataset.jam, 'kelas', td.dataset.kelas, smt);
  };
}

/* Jam ke berapa yang sedang berlangsung sekarang (untuk sorotan kolom), atau null. */
function jamBerjalan() {
  const n = new Date();
  const hhmm = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
  const j = D.jamPel.find(x => jam5(x.mulai) <= hhmm && hhmm < jam5(x.selesai));
  return j ? Number(j.jam_ke) : null;
}

/* Jadwal KBM dalam bentuk Excel berkop. Satu lembar per kelas atau per
   guru, dengan warna per mata pelajaran supaya pola jadwal terbaca
   sekilas. Memakai ExcelJS karena butuh logo, penggabungan sel, dan
   pewarnaan — SheetJS tidak menyediakannya.                          */
const WARNA_RUMPUN = ['FFE8F1F7','FFF3EDF7','FFEAF4EF','FFFDF6E7','FFF7EDEA','FFEDF1F7'];

async function unduhJadwalXlsx(daftarNama, sudut, smt) {
  await jalankan('Menyiapkan berkas…', async () => {
    const ExcelJS = await muatExcelJS();
    const wb = new ExcelJS.Workbook();
    const HR = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    // satu warna per mata pelajaran, tetap sama di seluruh lembar
    const mapelUrut = [...new Set(D.jadwal.map(j => j.mapel))].sort();
    const warna = m => WARNA_RUMPUN[mapelUrut.indexOf(m) % WARNA_RUMPUN.length];

    for (const nama of daftarNama) {
      const baris = D.jadwal.filter(j => j.semester == smt &&
        (sudut === 'kelas' ? j.kelas === nama : j.guru === nama));
      const jamKe = [...new Set(D.jadwal.filter(j => j.semester == smt).map(j => j.jam_ke))]
                      .sort((a, b) => a - b);
      const hariAda = HR.filter(h => D.jadwal.some(j => j.semester == smt && j.hari === h));
      if (!hariAda.length) continue;

      // jam kelompok belajar untuk kelas ini
      const tingkat = sudut === 'kelas' ? tingkatDari(nama) : null;
      const jamKelompok = new Map();
      if (tingkat) D.jadwal.filter(j => j.semester == smt && j.jenis_kelas === 'Kelompok'
                                     && (!j.tingkat || j.tingkat === tingkat))
                           .forEach(j => {
                             const k = j.hari + '|' + j.jam_ke;
                             if (!jamKelompok.has(k)) jamKelompok.set(k, new Set());
                             jamKelompok.get(k).add(j.mapel);
                           });

      const ws = wb.addWorksheet(nama.replace(/[\\/?*\[\]:]/g, '-').slice(0, 31), {
        pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                     margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
      });
      const kolomAkhir = hariAda.length + 1;
      // Kolom dilebarkan supaya nama guru yang panjang tidak pecah
      // menjadi tiga baris. Lebar disesuaikan dengan nama terpanjang
      // pada lembar ini, dibatasi agar tetap muat sehalaman.
      const terpanjang = Math.max(14, ...baris.map(j =>
        Math.max(String(sudut === 'kelas' ? j.mapel : j.kelas).length,
                 String(sudut === 'kelas' ? j.guru : j.mapel).length)));
      const lebarHari = Math.min(30, Math.max(24, terpanjang + 3));
      ws.columns = [{ width: 11 }, ...hariAda.map(() => ({ width: lebarHari }))];

      let r = await kopExcel(wb, ws, 'Jadwal Kegiatan Belajar Mengajar',
        (sudut === 'kelas' ? 'Kelas ' : 'Guru: ') + nama +
        `  ·  Semester ${smt}  ·  Tahun Pelajaran ${sesi.ta}`, kolomAkhir);
      const judul = ws.getRow(r);
      ['Jam', ...hariAda].forEach((t, i) => {
        const c = judul.getCell(i + 1);
        c.value = t;
        c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                     left: { style: 'thin' }, right: { style: 'thin' } };
      });
      judul.height = 24;
      r++;

      jamKe.forEach(jk => {
        const jp = D.jamPel.find(x => x.jam_ke === jk);
        const br = ws.getRow(r);
        const sel1 = br.getCell(1);
        sel1.value = jp && jp.mulai
          ? `Jam ${jk}\n${String(jp.mulai).slice(0,5)}–${String(jp.selesai || '').slice(0,5)}`
          : `Jam ${jk}`;
        sel1.font = { bold: true, size: 9.5 };
        sel1.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        sel1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F5F4' } };

        hariAda.forEach((h, i) => {
          const c = br.getCell(i + 2);
          const progSet = jamKelompok.get(h + '|' + jk);
          const prog = progSet ? [...progSet].sort().join(' · ') : null;
          const isi = baris.filter(j => j.hari === h && j.jam_ke === jk);

          if (prog) {
            c.value = {
              richText: [
                { text: prog + '\n', font: { bold: true, size: 10.5, color: { argb: 'FF0F6E5C' } } },
                { text: 'berdasarkan kelompoknya',
                  font: { size: 8.5, italic: true, color: { argb: 'FF48606A' } } }
              ]
            };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF5F3' } };
          } else if (isi.length) {
            c.value = {
              richText: isi.flatMap((j, n) => ([
                ...(n ? [{ text: '\n' }] : []),
                { text: (sudut === 'kelas' ? j.mapel : j.kelas) + '\n',
                  font: { bold: true, size: 10.5, color: { argb: 'FF12262E' } } },
                { text: sudut === 'kelas' ? j.guru : j.mapel,
                  font: { size: 9, color: { argb: 'FF48606A' } } }
              ]))
            };
            c.fill = { type: 'pattern', pattern: 'solid',
                       fgColor: { argb: warna(isi[0].mapel) } };
          } else {
            c.value = '';
          }
          c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        br.eachCell(c => {
          c.border = { top: { style: 'thin', color: { argb: 'FFD6DEDC' } },
                       bottom: { style: 'thin', color: { argb: 'FFD6DEDC' } },
                       left: { style: 'thin', color: { argb: 'FFD6DEDC' } },
                       right: { style: 'thin', color: { argb: 'FFD6DEDC' } } };
        });
        const terbanyak = Math.max(1, ...hariAda.map(h =>
          baris.filter(j => j.hari === h && j.jam_ke === jk).length));
        br.height = Math.max(30, terbanyak * 26);
        r++;
      });

      // ringkasan & tanda tangan
      r += 1;
      ws.mergeCells(r, 1, r, kolomAkhir);
      const rk = ws.getCell(r, 1);
      rk.value = `${baris.length} jam pelajaran per minggu` +
        (sudut === 'kelas' ? '' : ` · ${new Set(baris.map(j => j.kelas)).size} kelas`);
      rk.font = { size: 9.5, italic: true, color: { argb: 'FF48606A' } };
      rk.alignment = { horizontal: 'left' };

      r = kakiExcel(ws, r + 1, kolomAkhir);
      ttdExcel(ws, r + 2, kolomAkhir);
    }

    if (!wb.worksheets.length) throw new Error('Tidak ada jadwal untuk diunduh.');
    const buf = await wb.xlsx.writeBuffer();
    const namaBerkas = daftarNama.length === 1
      ? `Jadwal_${daftarNama[0].replace(/[^\w-]/g, '_')}_${stempel()}.xlsx`
      : `Jadwal_KBM_Semua_${stempel()}.xlsx`;
    unduhBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
              namaBerkas);
    toast(`${wb.worksheets.length} lembar jadwal diunduh`);
  });
}

function formJadwal(j, hari, jamKe, sudut, pilih, smt) {
  const baru = !j;
  const kelasPilihan = [
    ...D.rombel.map(r => ({ v: r.kode, t: r.kode })),
    ...D.kelompok.map(k => ({ v: k.nama, t: k.nama + ' (kelompok)' }))
  ];
  const awal = baru
    ? { hari, jam_ke: jamKe, semester: smt,
        kelas: sudut === 'kelas' ? pilih : '', guru: sudut === 'guru' ? pilih : '' }
    : { ...j };

  formulir({
    judul: baru ? 'Tambah jam pelajaran' : 'Ubah jam pelajaran',
    lebar: true,
    catatan: baru ? '' : 'Mengubah jam atau hari akan diperiksa ulang terhadap jadwal guru dan kelas.',
    nilai: awal,
    kolom: [
      { k: 'kelas', label: 'Kelas atau kelompok', tipe: 'pilih', wajib: true,
        opsi: [{ v: '', t: '— pilih —' }, ...kelasPilihan] },
      { k: 'mapel', label: 'Mata pelajaran', tipe: 'pilih', wajib: true,
        opsi: [{ v: '', t: '— pilih —' }, ...D.mapel.map(m => ({ v: m.nama, t: m.nama }))] },
      { k: 'guru', label: 'Guru', tipe: 'pilih', wajib: true,
        opsi: [{ v: '', t: '— pilih —' },
               ...D.guru.filter(g => g.status_aktif === 'Aktif').map(g => ({ v: g.nama, t: g.nama }))] },
      { k: 'hari', label: 'Hari', tipe: 'pilih', wajib: true,
        opsi: HARI.map(h => ({ v: h, t: h })) },
      { k: 'jam_ke', label: 'Jam ke', tipe: 'pilih', wajib: true,
        opsi: (D.jamPel.length ? D.jamPel.map(x => x.jam_ke) : [1,2,3,4,5,6,7,8,9,10])
              .map(n => ({ v: n, t: 'Jam ke-' + n })) },
      { k: 'semester', label: 'Semester', tipe: 'pilih',
        opsi: [{ v: 1, t: 'Semester 1' }, { v: 2, t: 'Semester 2' }] }
    ],
    simpan: async n => {
      const kelas = D.kelompok.find(k => k.nama === n.kelas)
                 || D.rombel.find(r => r.kode === n.kelas);
      const kelasId = kelas ? (kelas.id || null) : null;
      const mapel = D.mapel.find(m => m.nama === n.mapel);
      const guru  = D.guru.find(g => g.nama === n.guru);
      if (!kelasId) throw new Error('Kelas "' + n.kelas + '" belum terdaftar sebagai satuan jadwal.');
      if (!mapel)   throw new Error('Mata pelajaran tidak dikenal.');
      if (!guru)    throw new Error('Guru tidak dikenal.');

      const isi = { hari: n.hari, jam_ke: Number(n.jam_ke), kelas_id: kelasId,
                    mapel_id: mapel.id, guru_id: guru.id,
                    tahun_ajaran: sesi.ta, semester: Number(n.semester),
                    updated_at: new Date().toISOString() };

      if (MODE === 'contoh') { toast('Mode contoh: tidak tersimpan'); return; }
      if (j) await perbarui('jadwal_kbm', `id=eq.${enc(j.id)}`, isi);
      else   await simpanBaru('jadwal_kbm',
                { id: idJadwalBaru(), ...isi, created_at: new Date().toISOString() });
      await muatSemua();
      toast(j ? 'Jam pelajaran diperbarui' : 'Jam pelajaran ditambahkan');
    },
    hapus: j ? async () => {
      if (MODE === 'db') await buang('jadwal_kbm', `id=eq.${enc(j.id)}`);
      D.jadwal = D.jadwal.filter(x => x.id !== j.id);
      if (MODE === 'db') await muatSemua();
      toast('Jam pelajaran dihapus');
    } : null
  });
}

/* ------------------------------------------------- kelompok belajar */
function halKelompok() {
  const pilih = ui.kelompokPilih || (D.kelompok[0] && D.kelompok[0].nama) || '';
  const anggota = D.anggota.filter(a => a.kelompok === pilih)
                           .sort((a, b) => a.siswa.localeCompare(b.siswa, 'id'));
  const kel = D.kelompok.find(k => k.nama === pilih);
  const jumlah = n => D.anggota.filter(a => a.kelompok === n).length;

  // dikelompokkan per mata pelajaran
  const perMapel = new Map();
  D.kelompok.forEach(k => {
    const m = k.mapel || '(belum ada mapel)';
    if (!perMapel.has(m)) perMapel.set(m, []);
    perMapel.get(m).push(k);
  });

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Kelompok Belajar</h1>
      <p>Pengelompokan ulang siswa untuk mata pelajaran tertentu — Tahsin dan Matematika Dasar.
         Rapornya tetap dikembalikan ke wali kelas rombel masing-masing.</p></div>
      <div class="sp"></div>
      ${kel ? '<button class="btn btn-p" id="bTambahAnggota">+ Tambah anggota</button>' : ''}
      <button class="btn" id="bUnduhKelompok">Unduh Data (xlsx)</button>
      ${kel ? '<button class="btn" id="bUnduhAbsenKel">Unduh Absen (xlsx)</button>' : ''}</div>

    ${D.galat.kelompok ? `<div class="info-box"><b>Data kelompok tidak dapat dibaca.</b>
      ${esc(D.galat.kelompok)}<br>Kemungkinan berkas kelompok belajar belum dijalankan.</div>` : ''}
    ${D.belumKelompok.length ? `<div class="info-box"><b>${D.belumKelompok.length} siswa belum masuk kelompok</b>
      dan belum tercatat pengecualiannya. Sebagian mungkin memang tidak mengikuti program —
      catat pengecualiannya supaya peringatan ini hanya menunjuk yang benar-benar terlewat.
      <button class="linkish" id="bLihatBelum">Lihat daftarnya</button></div>` : ''}

    <div class="kartu-baris">
      <div class="kartu"><b>${D.kelompok.length}</b><span>kelompok</span></div>
      <div class="kartu"><b>${D.anggota.length}</b><span>keanggotaan tercatat</span></div>
      <div class="kartu"><b>${D.dikecualikan.length}</b><span>dikecualikan</span></div>
      ${D.belumKelompok.length ? `<div class="kartu warn"><b>${D.belumKelompok.length}</b><span>belum tertangani</span></div>` : ''}
    </div>

    ${[...perMapel.entries()].map(([m, daftar]) => `
      <div class="kelas-rail"><div class="kelas-row">
        <span class="lbl">${esc(m)}</span>
        ${daftar.map(k => `<button class="chip ${pilih === k.nama ? 'on' : ''}" data-kel="${esc(k.nama)}">
          ${esc(k.nama.replace(/^Tahsin · /, ''))}<span class="c">${jumlah(k.nama)}</span></button>`).join('')}
      </div></div>`).join('')}

    ${kel ? `<div class="panel">
      <div class="panel-head"><h3>${esc(kel.nama)}</h3>
        <div class="sp" style="flex:1"></div>
        <div class="info">${anggota.length} siswa${kel.tingkat ? ' · khusus tingkat ' + kel.tingkat : ' · semua tingkat'}</div></div>
      <div class="scroll"><table><thead><tr>
        <th style="width:44px" class="hide-sm">No</th><th>Siswa</th>
        <th style="width:110px" class="hide-sm">NISN</th>
        <th style="width:90px">Rombel</th><th style="width:170px" class="hide-sm">Wali kelas</th>
        <th style="width:110px"></th>
      </tr></thead><tbody>${
        anggota.length ? anggota.map((a, i) => `<tr data-id="${esc(a.id)}">
          <td class="num hide-sm kecil">${i + 1}</td>
          <td style="font-weight:500">${esc(a.siswa)}</td>
          <td class="num hide-sm">${esc(a.nisn || '—')}</td>
          <td>${a.rombel ? `<span class="tag" style="background:${warnaTingkat(tingkatDari(a.rombel))}">${esc(a.rombel)}</span>` : '<span class="kecil">—</span>'}</td>
          <td class="hide-sm kecil">${esc(a.wali_kelas || '—')}</td>
          <td class="act"><button class="btn btn-sm btn-d bKeluar">Keluarkan</button></td></tr>`).join('')
        : `<tr><td colspan="6"><div class="empty"><b>Belum ada anggota</b>Tambahkan lewat tombol di atas.</div></td></tr>`
      }</tbody></table></div></div>` : `<div class="panel"><div class="empty">
        <b>Belum ada kelompok belajar</b>Muncul setelah kelompok dibuat dan mata pelajarannya diisi.</div></div>`}

    ${D.dikecualikan.length ? `<div class="panel"><div class="panel-head"><h3>Dikecualikan</h3>
      <div class="sp" style="flex:1"></div><div class="info">${D.dikecualikan.length} siswa</div></div>
      <div class="scroll"><table><thead><tr>
        <th>Siswa</th><th style="width:90px">Rombel</th><th style="width:140px">Program</th>
        <th>Alasan</th><th style="width:150px" class="hide-sm">Dicatat oleh</th>
      </tr></thead><tbody>${
        D.dikecualikan.map(x => `<tr>
          <td style="font-weight:500">${esc(x.siswa)}</td>
          <td>${esc(x.rombel || '—')}</td><td>${esc(x.program)}</td>
          <td class="kecil">${esc(x.alasan)}</td>
          <td class="hide-sm kecil">${esc(x.dicatat_oleh || '—')}</td></tr>`).join('')
      }</tbody></table></div></div>` : ''}`;

  $$('[data-kel]').forEach(b => b.onclick = () => { ui.kelompokPilih = b.dataset.kel; gambar(); });
  if ($('#bTambahAnggota')) $('#bTambahAnggota').onclick = () => formAnggota(kel);
  if ($('#bLihatBelum')) $('#bLihatBelum').onclick = dialogBelumKelompok;
  $('#bUnduhKelompok').onclick = unduhRekapKelompok;
  if ($('#bUnduhAbsenKel')) $('#bUnduhAbsenKel').onclick = () => {
    const daftar = anggota.map(a => ({ nama: a.siswa, kelas: a.rombel || '',
      jk: (D.siswa.find(s => s.id === a.siswa_id) || {}).jk || '' }));
    // Pembimbing diambil dari jadwal. Satu kelompok bisa dipegang lebih
    // dari satu guru — tanggung jawabnya bersama, jadi seluruh namanya
    // ditulis, bukan dipilih salah satu.
    const pembimbing = [...new Set(D.jadwal
      .filter(j => j.kelas === kel.nama)
      .map(j => j.guru))].sort().join(', ');
    unduhAbsenXlsx('Daftar Hadir ' + (kel.mapel || 'Kelompok Belajar'),
      { labelKelas: 'Kelompok', labelGuru: 'Pembimbing', nilaiGuru: pembimbing },
      new Map([[kel.nama, daftar]]), kel.mapel || '');
  };
  const tb = $('tbody');
  if (tb) tb.onclick = e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (e.target.classList.contains('bKeluar'))
      keluarkanAnggota(D.anggota.find(a => String(a.id) === tr.dataset.id));
  };
}

function formAnggota(kel) {
  // siswa yang belum masuk kelompok untuk mapel ini
  const sudah = new Set(D.anggota.filter(a => a.mapel === kel.mapel).map(a => a.siswa_id));
  const dikecualikan = new Set(D.dikecualikan.filter(x => x.program === kel.mapel).map(x => x.nisn));
  const calon = D.siswa.filter(s => s.status === 'aktif'
      && !sudah.has(s.id) && !dikecualikan.has(s.nisn)
      && (!kel.tingkat || tingkatDari(s.kelas) === kel.tingkat));

  formulir({
    judul: 'Tambah anggota — ' + kel.nama,
    lebar: true,
    catatan: kel.tingkat
      ? `Hanya siswa tingkat ${kel.tingkat} yang dapat dipilih, karena kelompok ini dibentuk per tingkat.`
      : 'Kelompok ini bercampur semua tingkat.',
    nilai: {},
    kolom: [
      { k: 'siswa_id', label: 'Siswa', tipe: 'pilih', wajib: true,
        opsi: [{ v: '', t: `— pilih siswa (${calon.length} tersedia) —` },
               ...calon.sort((a, b) => (a.kelas || '').localeCompare(b.kelas || '', 'id', { numeric: true })
                                    || a.nama.localeCompare(b.nama, 'id'))
                       .map(s => ({ v: s.id, t: `${s.kelas || '—'} · ${s.nama}` }))],
        hint: 'Siswa yang sudah masuk kelompok lain untuk mata pelajaran ini tidak ditampilkan.' }
    ],
    simpan: async n => {
      if (MODE === 'contoh') { toast('Mode contoh: tidak tersimpan'); return; }
      await simpanBaru('anggota_kelompok', {
        siswa_id: n.siswa_id, kelas_id: kel.id, tahun_ajaran: sesi.ta });
      await muatSemua();
      toast('Anggota ditambahkan');
    }
  });
}

function keluarkanAnggota(a) {
  if (!a) return;
  konfirmasi({
    judul: 'Keluarkan dari kelompok',
    pesan: `Keluarkan <b>${esc(a.siswa)}</b> dari <b>${esc(a.kelompok)}</b>?
            Setelah ini ia akan muncul sebagai belum masuk kelompok sampai didaftarkan
            ke kelompok lain atau dicatat pengecualiannya.`,
    tombol: 'Keluarkan',
    lanjut: async () => {
      if (MODE === 'db') await buang('anggota_kelompok', `id=eq.${enc(a.id)}`);
      D.anggota = D.anggota.filter(x => x.id !== a.id);
      if (MODE === 'db') await muatSemua();
      toast(a.siswa + ' dikeluarkan dari kelompok');
    }
  });
}

function dialogBelumKelompok() {
  const d = D.belumKelompok;
  bukaModal(`<h2>Belum masuk kelompok</h2><div class="body" style="padding:0">
    <table class="log"><thead><tr><th>Rombel</th><th>Siswa</th><th>Belum</th></tr></thead>
    <tbody>${d.map(x => `<tr><td>${esc(x.rombel)}</td><td>${esc(x.siswa)}</td>
      <td class="kecil">${esc([x.belum_tahsin, x.belum_matdas].filter(Boolean).join(', '))}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="aksi"><button class="btn" id="m-batal">Tutup</button></div>`, true);
  $('#m-batal').onclick = tutupModal;
}

function unduhRekapKelompok() {
  if (!D.anggota.length) return toast('Belum ada keanggotaan untuk diunduh.', true);
  const kolom = [['Rombel', 'rombel'], ['Siswa', 'siswa'], ['NISN', 'nisn'],
                 ['Mata pelajaran', 'mapel'], ['Kelompok', 'kelompok'], ['Wali kelas', 'wali_kelas']];
  const data = D.anggota.slice().sort((a, b) =>
    (a.rombel || '').localeCompare(b.rombel || '', 'id', { numeric: true })
    || a.siswa.localeCompare(b.siswa, 'id'));
  unduhTabel('Rekap Kelompok Belajar', kolom, data,
    `Tahun Pelajaran ${sesi.ta}  ·  diurutkan per rombel`);
}

/* --------------------------------------------------- piket & honor */
function halPiket() {
  const peringkat = peringkatGuru();
  const totJam = D.piket.reduce((a, p) => a + (p.jam_per_minggu || 0), 0);
  const dibayar = D.piket.filter(p => p.dihitung_transport);
  const belumDasar = D.piket.filter(p => p.dasar === 'belum tercatat');
  const belumIsi = D.komponen.filter(k => k.belum_diisi);

  // Komponen dikelompokkan per guru, dikunci guru_id — bukan nama — supaya
  // urutannya bisa mengikuti masa kerja seperti daftar guru lainnya.
  const perGuru = new Map();
  D.komponen.slice()
    .sort((a, b) => peringkat(a.guru_id) - peringkat(b.guru_id))
    .forEach(k => {
      if (!perGuru.has(k.guru_id)) perGuru.set(k.guru_id, { nama: k.nama });
      perGuru.get(k.guru_id)[k.komponen] = k;
    });

  if (ui.piketTab === 'unit') return halPiketUnit();
  if (ui.piketTab === 'parkiran') return halPiketParkiran();
  const sub = ui.mejaSub || 'matriks';
  if (sub === 'matriks') return halPiketMatriks();
  if (sub === 'komponen') return halPiketKomponen(perGuru, belumIsi);

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Piket Meja Sekolah</h1>
      <p>Siapa bertugas menurut jadwal dan berapa jamnya. Jadwalnya diubah di tab
         Matriks jadwal.</p></div></div>

    ${barPiket('meja')}
    ${barSubMeja('petugas')}

    ${belumDasar.length ? `<div class="info-box"><b>${belumDasar.length} guru ada di jadwal piket
      tetapi belum tercatat dasar penugasannya.</b> Catatkan lewat halaman Tugas Guru — sebagai
      wali kelas, staf, atau guru yang ditugaskan piket — supaya jelas atas dasar apa ia berjaga.</div>` : ''}

    <div class="kartu-baris">
      <div class="kartu"><b>${D.piket.length}</b><span>petugas piket</span></div>
      <div class="kartu"><b>${totJam}</b><span>jam piket per minggu</span></div>
      <div class="kartu"><b>${dibayar.length}</b><span>dihitung transportnya</span></div>
      <div class="kartu"><b>${D.piket.length - dibayar.length}</b><span>staf, tidak dihitung</span></div>
    </div>

    <div class="panel"><div class="panel-head"><h3>Petugas piket meja sekolah</h3>
      <div class="sp" style="flex:1"></div><div class="info">menurut jadwal</div></div>
      <div class="scroll"><table><thead><tr>
        <th>Guru</th><th style="width:90px">Jam/minggu</th>
        <th style="width:190px" class="hide-sm">Hari</th>
        <th style="width:150px">Dasar</th><th style="width:150px">Transport</th>
      </tr></thead><tbody>${
        D.piket.length ? D.piket.slice().sort((a, b) => peringkat(a.guru_id) - peringkat(b.guru_id))
          .map(p => `<tr class="${p.dasar === 'belum tercatat' ? 'bad' : ''}">
            <td style="font-weight:500">${esc(p.nama)}</td>
            <td class="num">${p.jam_per_minggu}</td>
            <td class="hide-sm kecil">${esc(p.hari || '—')}</td>
            <td>${p.dasar === 'belum tercatat'
                  ? '<span class="kecil" style="color:var(--warn)">belum tercatat</span>'
                  : `<span class="tag tag-l">${esc(p.dasar)}</span>`}</td>
            <td>${p.dihitung_transport ? 'dihitung'
                  : '<span class="kecil">tidak — staf, sudah masuk jam kerja</span>'}</td></tr>`).join('')
        : `<tr><td colspan="5"><div class="empty"><b>Belum ada jadwal piket terbaca</b>
            Jadwal diatur di tab Matriks jadwal.</div></td></tr>`
      }</tbody></table></div></div>

    <p class="kecil">Jam per minggu dan harinya dihitung dari matriks jadwal, bukan diisi di sini.
      Kolom Dasar menyebut atas dasar apa guru itu berjaga — wali kelas, staf, atau ditugaskan
      khusus — dan itu dicatat di halaman Tugas Guru.</p>`;

  pasangTabPiket();
}

/* Komponen honor wali kelas — sub dari halaman Piket Meja Sekolah karena
   salah satu komponennya, PIKET, angkanya berasal dari jadwal piket. */
function halPiketKomponen(perGuru, belumIsi) {
  $('#isi').innerHTML = `
    <div class="head"><div><h1>Komponen Honor Wali Kelas</h1>
      <p>Jam per minggu untuk Upacara, Bimbingan, dan Piket. Ketuk angkanya untuk mengubah.</p></div></div>

    ${barPiket('meja')}
    ${barSubMeja('komponen')}

    ${belumIsi.length ? `<div class="info-box"><b>${belumIsi.length} komponen honor belum ada angkanya.</b>
      Perhitungan honor tidak bisa dijalankan selama masih ada yang kosong.</div>` : ''}

    <div class="panel"><div class="panel-head"><h3>Komponen honor wali kelas</h3>
      <div class="sp" style="flex:1"></div><div class="info">jam per minggu</div></div>
      <div class="scroll"><table><thead><tr>
        <th>Guru</th><th style="width:110px">Upacara</th>
        <th style="width:140px">Bimbingan</th><th style="width:150px">Piket</th>
      </tr></thead><tbody>${
        perGuru.size ? [...perGuru.values()].map(k => {
          const nama = k.nama;
          const sel = kode => {
            const x = k[kode];
            if (!x) return '<span class="kecil">—</span>';
            const isi = x.belum_diisi
              ? '<span class="kecil" style="color:var(--warn)">belum diisi</span>'
              : `${x.jam_per_minggu} <span class="kecil">(${esc(x.asal_angka || '')})</span>`;
            return `<span class="sel-komponen" data-tugas="${esc(x.tugas_id)}" data-komponen="${esc(kode)}"
                      style="cursor:pointer;border-bottom:1px dashed var(--line)">${isi}</span>`;
          };
          return `<tr><td style="font-weight:500">${esc(nama)}</td>
            <td>${sel('UPACARA')}</td><td>${sel('BIMBINGAN')}</td><td>${sel('PIKET')}</td></tr>`;
        }).join('')
        : `<tr><td colspan="4"><div class="empty"><b>Belum ada komponen honor</b>
            Muncul setelah wali kelas tercatat di halaman Tugas Guru.</div></td></tr>`
      }</tbody></table></div></div>

    <p class="kecil">Ketuk angka pada tabel komponen untuk mengubahnya.
      Isi <b>0</b> bila guru itu memang tidak menjalankan komponen tersebut —
      berbeda maknanya dengan "belum diisi".<br>
      Guru yang memegang tugas Staf tidak muncul pada tabel ini, karena kontraknya
      dihitung berdasarkan jam kerja lewat fingerprint. Kalau ada staf yang masih tampil,
      berarti tugas Staf-nya belum dicatat di halaman Tugas Guru.</p>`;

  pasangTabPiket();
  $$('.sel-komponen').forEach(el => el.onclick = () => {
    const x = D.komponen.find(c => String(c.tugas_id) === el.dataset.tugas
                                && c.komponen === el.dataset.komponen);
    if (x) formKomponen(x);
  });
}

/* --------------------------------------- matriks piket unit (seret) */
/* Guru diperbantukan menjaga unitnya sekian jam per minggu; angka itu ada di
   guru_tugas.jam_piket_unit dan menjadi dasar transport. Halaman ini
   menyatakan KAPAN jam-jam itu dijalankan, dan sengaja tidak menimpa angka
   kesepakatannya — selisih keduanya ditampilkan apa adanya.               */
const HARI_UNIT = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const tugasUnitAktif = () => D.tugas
  .filter(t => t.aktif && sifat(t.jenis, 'jam_unit'))
  .sort((a, b) => urutNama(a.jabatan || '', b.jabatan || ''));
const warnaUnit = tugasId => {
  const i = tugasUnitAktif().findIndex(t => String(t.id) === String(tugasId));
  return WARNA_BLOK[(i < 0 ? 0 : i) % WARNA_BLOK.length];
};

/* Kolom matriks: tiap jam pelajaran, dengan kolom sela tipis pada jeda
   istirahat — sama seperti matriks jadwal piket meja sekolah. */
function kolomJam() {
  const jamList = D.jamPel.slice().sort((a, b) => Number(a.jam_ke) - Number(b.jam_ke));
  const kolom = [];
  jamList.forEach((j, i) => {
    const prev = jamList[i - 1];
    if (prev && prev.selesai && j.mulai && jam5(prev.selesai) !== jam5(j.mulai))
      kolom.push({ sela: true, dari: jam5(prev.selesai), sampai: jam5(j.mulai) });
    kolom.push({ jam: j, jk: Number(j.jam_ke) });
  });
  return kolom;
}

function halPiketUnit() {
  const data = D.piketUnit || [];
  const unit = tugasUnitAktif();
  const kolom = kolomJam();
  const nSela = kolom.filter(c => c.sela).length;
  const lebarMin = 96 + (kolom.length - nSela) * 76 + nSela * 12;
  const hariNyata = ['Minggu', ...HARI][new Date().getDay()];
  const sekarang = jamBerjalan();
  const ditempatkan = id => data.filter(p => String(p.tugas_id) === String(id)).length;

  const isiSel = (h, jk) => data.filter(p => p.hari === h && Number(p.jam_ke) === jk);

  const barisHtml = HARI_UNIT.map(h => {
    const tds = kolom.map(c => {
      if (c.sela) return '<td class="mx-sela"></td>';
      const isi = isiSel(h, c.jk);
      const skr = h === hariNyata && sekarang === c.jk ? ' skr' : '';
      const kotak = isi.map(p => {
        const w = warnaUnit(p.tugas_id);
        return `<div class="pu-kotak" draggable="true" data-id="${esc(p.id)}"
          style="--bg:${w[0]};--aksen:${w[1]}"
          title="${esc(`${p.guru}\n${p.unit}\n${h} jam ke-${c.jk}` +
                       (p.jam_mulai ? ` (${jam5(p.jam_mulai)}–${jam5(p.jam_selesai)})` : '') +
                       '\nSeret untuk memindahkan')}">${esc(namaPendek(p.guru))}</div>`;
      }).join('');
      return `<td class="mx-sel pu-sel${skr}${isi.length ? '' : ' pk-nol'}"
        data-hari="${esc(h)}" data-jam="${c.jk}"
        title="${esc(`${h} jam ke-${c.jk} — seret kotak ke sini, atau ketuk untuk mengatur`)}">
        ${kotak}<span class="pk-tambah">+</span></td>`;
    }).join('');
    const n = data.filter(p => p.hari === h).length;
    return `<tr class="${h === hariNyata ? 'aktif' : ''}"><th class="mx-label" scope="row">
      <span>${h}</span><small>${n} jam</small></th>${tds}</tr>`;
  }).join('');

  // Sisa jam yang belum ditempatkan, siap diseret ke matriks.
  const sisaHtml = unit.map(t => {
    const sepakat = Number(t.jam_piket_unit) || 0;
    const sudah = ditempatkan(t.id);
    const sisa = sepakat - sudah;
    const w = warnaUnit(t.id);
    const nama = namaGuru(t.guru_id);
    if (sisa <= 0) return `<span class="pu-sisa ${sisa < 0 ? 'lebih' : 'penuh'}"
      style="--bg:${w[0]};--aksen:${w[1]}" title="${esc(`${nama}\n${t.jabatan || ''}`)}">
      ${esc(namaPendek(nama))} <b>${sisa < 0 ? 'lebih ' + (-sisa) + ' jam' : 'pas'}</b></span>`;
    return `<span class="pu-sisa" draggable="true" data-tugas="${esc(t.id)}"
      style="--bg:${w[0]};--aksen:${w[1]}"
      title="${esc(`${nama}\n${t.jabatan || ''}\nSisa ${sisa} dari ${sepakat} jam — seret ke matriks`)}">
      ${esc(namaPendek(nama))} <b>${sisa} jam</b></span>`;
  }).join('');

  const belumSepakat = unit.filter(t => !Number(t.jam_piket_unit));
  const lebih = unit.filter(t => ditempatkan(t.id) > (Number(t.jam_piket_unit) || 0));

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Piket Unit + Diperbantukan</h1>
      <p>Kapan tiap penanggung jawab menjaga unitnya. Seret kotak untuk memindahkan,
         atau ketuk sel untuk mengaturnya lewat daftar.</p></div>
      <div class="sp"></div>
      <button class="btn" id="bUnduhUnit">Unduh (xlsx)</button></div>

    ${barPiket('unit', '<div class="sp" style="flex:1"></div>' + unit.map(t => {
      const w = warnaUnit(t.id);
      return `<span class="pk-legenda" style="--bg:${w[0]};--aksen:${w[1]}">${esc(t.jabatan || namaGuru(t.guru_id))}</span>`;
    }).join(''))}

    ${!unit.length ? `<div class="panel"><div class="empty"><b>Belum ada guru diperbantukan</b>
      Catatkan lewat halaman Tugas Guru dengan jenis Diperbantukan, beserta jam piket unitnya.</div></div>` : `

    ${belumSepakat.length ? `<div class="info-box"><b>${belumSepakat.length} penugasan belum menyebut jam piket unit per minggu.</b>
      Isi dulu di halaman Tugas Guru — tanpa angka itu, sisa jamnya tidak bisa dihitung.</div>` : ''}
    ${lebih.length ? `<div class="info-box"><b>${lebih.length} unit dijadwalkan melebihi jam yang disepakati.</b>
      Angka transport tetap mengikuti jam kesepakatan di Tugas Guru, bukan jumlah kotak di sini.</div>` : ''}

    <div class="panel"><div class="panel-head"><h3>Sisa jam belum ditempatkan</h3>
      <div class="sp" style="flex:1"></div><div class="info">seret ke matriks</div></div>
      <div class="pu-tray" id="puTray">${sisaHtml ||
        '<span class="kecil">Seluruh jam sudah ditempatkan.</span>'}</div>
      <div class="foot"><div class="info">Seret kotak dari matriks ke kotak ini untuk mengeluarkannya dari jadwal.</div></div>
    </div>

    <div class="panel"><div class="mx-scroll"><table class="mx" style="min-width:${lebarMin}px"><thead><tr>
      <th class="mx-sudut">Hari</th>${kolom.map(c => c.sela
        ? `<th class="mx-sela" title="Istirahat ${c.dari}–${c.sampai}"></th>`
        : `<th class="mx-jam${sekarang === c.jk ? ' skr' : ''}">
            <b>${c.jk}</b>${c.jam.mulai ? `<span>${jam5(c.jam.mulai)}–${jam5(c.jam.selesai)}</span>` : ''}
            ${c.jam.keterangan ? `<i>${esc(c.jam.keterangan)}</i>` : ''}</th>`).join('')}
    </tr></thead><tbody>${barisHtml}</tbody></table></div>
    <div class="foot"><div class="info">${data.length} jam terjadwal ·
      ${unit.length} unit · ${unit.reduce((a, t) => a + (Number(t.jam_piket_unit) || 0), 0)} jam disepakati</div></div></div>

    <p class="kecil">Jam kesepakatan tiap unit diisi di <b>Tugas Guru</b> dan itulah yang dipakai
      menghitung transport. Matriks ini menyatakan kapan jam-jam itu dijalankan, sehingga keduanya
      bisa dibandingkan. Penempatan ditolak bila pada jam yang sama guru tersebut sedang mengajar,
      berjaga di meja sekolah, atau menjaga unit lain.</p>`}`;

  pasangTabPiket();
  if ($('#bUnduhUnit')) $('#bUnduhUnit').onclick = unduhPiketUnitXlsx;
  if (unit.length) pasangSeretUnit();
}

/* Seret-lepas HTML5 untuk tetikus, plus ketuk sel sebagai jalan cadangan di
   layar sentuh — di sana seret bawaan peramban tidak berfungsi.            */
function pasangSeretUnit() {
  let bawa = null;                       // { id } dari matriks, atau { tugasId } dari daftar sisa

  const mulai = (el, muatan) => {
    el.addEventListener('dragstart', ev => {
      bawa = muatan;
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', JSON.stringify(muatan));
      el.classList.add('seret');
    });
    el.addEventListener('dragend', () => { el.classList.remove('seret'); bawa = null; });
  };

  $$('.pu-kotak').forEach(el => mulai(el, { id: el.dataset.id }));
  $$('.pu-sisa[data-tugas]').forEach(el => mulai(el, { tugasId: el.dataset.tugas }));

  $$('.pu-sel').forEach(td => {
    td.addEventListener('dragover', ev => { ev.preventDefault(); td.classList.add('incar'); });
    td.addEventListener('dragleave', () => td.classList.remove('incar'));
    td.addEventListener('drop', ev => {
      ev.preventDefault();
      td.classList.remove('incar');
      const m = bawa || bacaMuatan(ev);
      if (m) taruhPiketUnit(m, td.dataset.hari, Number(td.dataset.jam));
    });
    td.addEventListener('click', () => dialogPiketUnitSel(td.dataset.hari, Number(td.dataset.jam)));
  });

  const tray = $('#puTray');
  if (tray) {
    tray.addEventListener('dragover', ev => { ev.preventDefault(); tray.classList.add('incar'); });
    tray.addEventListener('dragleave', () => tray.classList.remove('incar'));
    tray.addEventListener('drop', ev => {
      ev.preventDefault();
      tray.classList.remove('incar');
      const m = bawa || bacaMuatan(ev);
      if (m && m.id) hapusPiketUnit(m.id);
    });
  }
}

function bacaMuatan(ev) {
  try { return JSON.parse(ev.dataTransfer.getData('text/plain')); } catch (e) { return null; }
}

/* Satu guru tidak boleh berada di dua tempat pada jam yang sama. Diperiksa di
   sini karena sumbernya tiga tabel berbeda; pesannya menyebut bentrok apa. */
function bentrokUnit(guruId, hari, jamKe, kecualiId) {
  const j = D.jadwal.find(x => x.guru_id === guruId && x.hari === hari && Number(x.jam_ke) === jamKe);
  if (j) return `sedang mengajar ${j.mapel || ''} di ${j.kelas || ''}`.replace(/\s+/g, ' ').trim();
  const m = (D.piketJadwal || []).find(x => x.guru_id === guruId && x.hari === hari && Number(x.jam_ke) === jamKe);
  if (m) return 'sedang piket meja sekolah';
  const u = (D.piketUnit || []).find(x => x.guru_id === guruId && x.hari === hari &&
    Number(x.jam_ke) === jamKe && String(x.id) !== String(kecualiId));
  if (u) return `sedang menjaga ${u.unit || 'unit lain'}`;
  return null;
}

async function muatPiketUnit() {
  if (MODE === 'db') D.piketUnit = await ambilSemua('v_jadwal_piket_unit', 'select=*');
}

function taruhPiketUnit(muatan, hari, jamKe) {
  const lama = muatan.id ? (D.piketUnit || []).find(p => String(p.id) === String(muatan.id)) : null;
  const tugasId = lama ? lama.tugas_id : muatan.tugasId;
  const tugas = D.tugas.find(t => String(t.id) === String(tugasId));
  if (!tugas) return;
  if (lama && lama.hari === hari && Number(lama.jam_ke) === jamKe) return;   // tidak pindah ke mana-mana

  jalankan('Menyimpan…', async () => {
    const sebab = bentrokUnit(tugas.guru_id, hari, jamKe, muatan.id);
    if (sebab) throw new Error(`${namaGuru(tugas.guru_id)} ${sebab} pada ${hari} jam ke-${jamKe}.`);
    if ((D.piketUnit || []).some(p => String(p.tugas_id) === String(tugasId) &&
        p.hari === hari && Number(p.jam_ke) === jamKe))
      throw new Error(`${tugas.jabatan || 'Unit ini'} sudah terjadwal pada ${hari} jam ke-${jamKe}.`);

    if (MODE === 'contoh') {
      if (lama) { lama.hari = hari; lama.jam_ke = jamKe; }
      else D.piketUnit.push({ id: 'PU' + Date.now(), tugas_id: tugasId, hari, jam_ke: jamKe,
                              guru_id: tugas.guru_id, guru: namaGuru(tugas.guru_id), unit: tugas.jabatan });
    } else {
      if (lama) await perbarui('piket_unit', `id=eq.${enc(lama.id)}`, { hari, jam_ke: jamKe });
      else await simpanBaru('piket_unit', { tugas_id: Number(tugasId), hari, jam_ke: jamKe });
      await muatPiketUnit();
    }
    toast(`${namaPendek(namaGuru(tugas.guru_id))}: ${hari} jam ke-${jamKe}`);
  });
}

function hapusPiketUnit(id) {
  const p = (D.piketUnit || []).find(x => String(x.id) === String(id));
  if (!p) return;
  jalankan('Menyimpan…', async () => {
    if (MODE === 'db') { await buang('piket_unit', `id=eq.${enc(id)}`); await muatPiketUnit(); }
    else D.piketUnit = D.piketUnit.filter(x => String(x.id) !== String(id));
    toast(`${namaPendek(p.guru)} dikeluarkan dari ${p.hari} jam ke-${p.jam_ke}`);
  });
}

/* Jalan cadangan tanpa seret: mengatur satu sel lewat daftar. */
function dialogPiketUnitSel(hari, jamKe) {
  const isi = (D.piketUnit || []).filter(p => p.hari === hari && Number(p.jam_ke) === jamKe);
  const sudah = new Set(isi.map(p => String(p.tugas_id)));
  const calon = tugasUnitAktif().filter(t => !sudah.has(String(t.id)));

  bukaModal(`<h2>Piket unit ${esc(hari)} jam ke-${jamKe}</h2><div class="body">
    ${isi.length ? `<p class="msg kecil">Yang menjaga sekarang:</p>
      <table class="log"><tbody>${isi.map(p => `<tr>
        <td style="font-weight:500">${esc(p.guru)}</td>
        <td class="kecil">${esc(p.unit || '—')}</td>
        <td style="text-align:right"><button class="btn btn-sm btn-d"
          data-keluar="${esc(p.id)}">Keluarkan</button></td></tr>`).join('')}</tbody></table>`
     : '<p class="msg kecil">Belum ada yang menjaga pada jam ini.</p>'}

    <div class="fg" style="margin-top:14px"><label>Tambahkan unit</label>
      <select class="field" id="puTambah">
        <option value="">— pilih unit —</option>
        ${calon.map(t => `<option value="${esc(t.id)}">${esc(t.jabatan || '(unit belum diisi)')} — ${esc(namaGuru(t.guru_id))}</option>`).join('')}
      </select>
      <div class="hint">Unit yang sudah terjadwal pada jam ini tidak ditampilkan.</div></div>
    </div>
    <div class="aksi"><button class="btn" id="m-batal">Tutup</button>
      <button class="btn btn-p" id="m-tambah">Tambahkan</button></div>`);

  $('#m-batal').onclick = tutupModal;
  $$('[data-keluar]').forEach(b => b.onclick = () => { tutupModal(); hapusPiketUnit(b.dataset.keluar); });
  $('#m-tambah').onclick = () => {
    const id = $('#puTambah').value;
    if (!id) { $('#puTambah').focus(); return; }
    tutupModal();
    taruhPiketUnit({ tugasId: id }, hari, jamKe);
  };
}

/* ------------------------------------------------- piket parkiran */
/* Roster pengawas parkiran sesudah jam pulang: satu petugas per hari kerja,
   sekitar 30 menit. Sengaja tidak ikut tabel `piket` maupun guru_tugas —
   satuannya per hari (bukan per jam pelajaran), dan petugasnya staf, yang
   pada kedua jalur itu justru gugur dari perhitungan honor.
   Kehadiran hariannya dicatat di aplikasi Kehadiran Guru.              */
function halPiketParkiran() {
  const HR = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const petugas = h => (D.parkiran || []).find(p => p.hari === h);
  const kosongHari = HR.filter(h => !petugas(h));
  const orang = new Set((D.parkiran || []).map(p => p.guru_id));
  const hariNyata = ['Minggu', ...HARI][new Date().getDay()];

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Piket Parkiran</h1>
      <p>Pengawas parkiran sesudah jam pulang — satu petugas per hari kerja.
         Kehadirannya dicatat di aplikasi Kehadiran Guru, halaman Pelaksanaan Piket.</p></div>
      <div class="sp"></div>
      <button class="btn" id="bUnduhParkiran">Unduh (xlsx)</button></div>

    ${barPiket('parkiran')}

    ${kosongHari.length ? `<div class="info-box"><b>${kosongHari.length} hari belum ada petugasnya:</b>
      ${esc(kosongHari.join(', '))}. Hari yang kosong tidak bisa dicatat pelaksanaannya.</div>` : ''}

    <div class="kartu-baris">
      <div class="kartu"><b>${HR.length - kosongHari.length}</b><span>hari sudah ada petugas</span></div>
      <div class="kartu"><b>${orang.size}</b><span>petugas terlibat</span></div>
    </div>

    <div class="panel"><div class="panel-head"><h3>Jadwal petugas</h3>
      <div class="sp" style="flex:1"></div><div class="info">Senin–Jumat</div></div>
      <div class="scroll"><table><thead><tr>
        <th style="width:110px">Hari</th><th>Petugas</th>
        <th style="width:180px" class="hide-sm">Jenis PTK</th>
        <th class="hide-sm">Catatan</th><th style="width:170px"></th>
      </tr></thead><tbody>${HR.map(h => {
        const p = petugas(h);
        const nonaktif = p && p.status_aktif !== 'Aktif';
        return `<tr data-hari="${esc(h)}" class="${nonaktif ? 'bad' : ''}">
          <td><span class="tag tag-l">${esc(h)}</span>${h === hariNyata ? ' <span class="kecil">hari ini</span>' : ''}</td>
          <td style="font-weight:500">${p ? esc(p.nama) : '<span class="kecil">belum ada petugas</span>'}</td>
          <td class="hide-sm kecil">${p ? esc(p.jenis_ptk || '—') : '—'}${
            nonaktif ? ` · <span style="color:var(--warn)">${esc(p.status_aktif)}</span>` : ''}</td>
          <td class="hide-sm kecil">${p && p.catatan ? esc(p.catatan) : ''}</td>
          <td class="act"><button class="btn btn-sm bAtur">${p ? 'Ubah' : 'Tetapkan'}</button>
            ${p ? '<button class="btn btn-sm btn-d bKosong">Kosongkan</button>' : ''}</td></tr>`;
      }).join('')}</tbody></table></div></div>

    <p class="kecil">Kompensasinya dihitung per hari petugas benar-benar hadir, bukan per hari terjadwal.
      Besar tarifnya diatur di <b>Kehadiran Guru → Rekap → Pengaturan</b>, dan rekapnya ada di tab Piket
      pada halaman yang sama. Bila petugas berhalangan, penggantinya dicatat saat mengisi pelaksanaan —
      jadwal di sini tidak perlu diubah.</p>`;

  pasangTabPiket();
  if ($('#bUnduhParkiran')) $('#bUnduhParkiran').onclick = unduhPiketParkiranXlsx;
  $$('.bAtur').forEach(b => b.onclick = () => formParkiran(b.closest('tr').dataset.hari));
  $$('.bKosong').forEach(b => b.onclick = () => {
    const hari = b.closest('tr').dataset.hari;
    konfirmasi({
      judul: 'Kosongkan petugas', tombol: 'Kosongkan',
      pesan: `Hari ${esc(hari)} tidak akan punya petugas parkiran. Catatan pelaksanaan yang sudah tersimpan tetap ada.`,
      lanjut: async () => {
        if (MODE === 'db') await buang('piket_parkiran', `hari=eq.${enc(hari)}`);
        D.parkiran = (D.parkiran || []).filter(p => p.hari !== hari);
        if (MODE === 'db') await muatSemua();
        toast(`Petugas ${hari} dikosongkan`);
      }
    });
  });
}

function formParkiran(hari) {
  const p = (D.parkiran || []).find(x => x.hari === hari);
  // Selama ini petugasnya selalu staf, jadi staf didahulukan — tetapi guru
  // lain tetap bisa dipilih supaya tidak menghalangi keadaan darurat.
  const urut = g => (g.jenis_ptk === 'Tenaga Kependidikan' ? 0 : 1);
  const calon = D.guru.filter(g => g.status_aktif === 'Aktif')
    .sort((a, b) => urut(a) - urut(b) || urutGuru(a, b));

  formulir({
    judul: `Petugas parkiran — ${hari}`,
    catatan: 'Mengawasi parkiran sesudah jam pulang, sekitar 30 menit: memastikan siswa segera pulang, '
           + 'tidak merokok atau nongkrong.',
    nilai: { guru_id: p ? p.guru_id : '', catatan: p ? (p.catatan || '') : '' },
    kolom: [
      { k: 'guru_id', label: 'Petugas', tipe: 'pilih', wajib: true,
        // Keterangan ditulis untuk semua, termasuk Tenaga Kependidikan. Kalau
        // hanya sebagian yang diberi keterangan, nama yang polos terbaca
        // seperti datanya belum lengkap.
        opsi: [{ v: '', t: '— pilih petugas —' }].concat(calon.map(g => ({
          v: g.id, t: g.nama + (g.jenis_ptk ? ` (${g.jenis_ptk})` : '') }))),
        hint: 'Tenaga kependidikan ditampilkan lebih dulu.' },
      { k: 'catatan', label: 'Catatan (opsional)', tipe: 'panjang',
        hint: 'Misalnya kesepakatan tukar hari.' }
    ],
    simpan: async n => {
      if (!n.guru_id) throw new Error('Petugas wajib dipilih.');
      const isi = { hari, guru_id: n.guru_id, catatan: n.catatan ? n.catatan.trim() : null,
                    diubah_pada: new Date().toISOString() };
      if (MODE === 'contoh') {
        const g = D.guru.find(x => x.id === n.guru_id) || {};
        D.parkiran = (D.parkiran || []).filter(x => x.hari !== hari)
          .concat([{ ...isi, nama: g.nama, jenis_ptk: g.jenis_ptk, status_aktif: g.status_aktif,
                     urutan_hari: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'].indexOf(hari) + 1 }])
          .sort((a, b) => a.urutan_hari - b.urutan_hari);
      } else {
        await api('/rest/v1/piket_parkiran?on_conflict=hari', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify([isi])
        });
        await muatSemua();
      }
      toast(`Petugas parkiran ${hari}: ${namaGuru(n.guru_id)}`);
    }
  });
}

function formKomponen(x) {
  const bawaan = x.asal_angka === 'dari jadwal piket'
    ? 'Angka sekarang diambil dari jadwal piket. Mengisi di sini akan menggantikannya khusus untuk guru ini.'
    : x.asal_angka === 'bawaan'
      ? 'Angka sekarang mengikuti jam bawaan yang berlaku untuk semua wali kelas.'
      : x.asal_angka === 'diisi khusus'
        ? 'Angka ini sudah diisi khusus untuk guru ini.'
        : 'Belum ada angkanya.';

  formulir({
    judul: `${x.nama_komponen} — ${x.nama}`,
    catatan: bawaan,
    nilai: { jam: x.jam_per_minggu == null ? '' : x.jam_per_minggu },
    kolom: [
      { k: 'jam', label: 'Jam per minggu', tipe: 'angka', wajib: true,
        hint: 'Isi 0 bila guru ini memang tidak menjalankannya — misalnya wali kelas '
            + 'yang tidak piket karena jam mengajarnya sudah padat.' },
      { k: 'catatan', label: 'Alasan (opsional)', tipe: 'panjang',
        hint: 'Berguna bila angkanya berbeda dari yang umum.' }
    ],
    simpan: async n => {
      const jam = Number(n.jam);
      if (!(jam >= 0)) throw new Error('Jam harus berupa angka, minimal 0.');
      if (MODE === 'contoh') { toast('Mode contoh: tidak tersimpan'); return; }
      await api('/rest/v1/guru_tugas_jam?on_conflict=tugas_id,komponen', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify([{ tugas_id: x.tugas_id, komponen: x.komponen,
                                jam: jam, catatan: n.catatan || null }])
      });
      await muatSemua();
      toast(`${x.nama_komponen} ${x.nama}: ${jam} jam per minggu`);
    },
    hapus: x.asal_angka === 'diisi khusus' ? async () => {
      if (MODE === 'db')
        await buang('guru_tugas_jam', `tugas_id=eq.${enc(x.tugas_id)}&komponen=eq.${enc(x.komponen)}`);
      await muatSemua();
      toast('Kembali mengikuti angka bawaan');
    } : null
  });
}

/* ------------------------------------------------------------ kelas */
function halKelas() {
  const jml = kode => D.siswa.filter(s => s.kelas === kode && s.status === 'aktif').length;
  const wali = kode => {
    const r = D.rombel.find(x => x.kode === kode);
    const t = r && D.tugas.find(x => x.jenis === 'Wali Kelas' && x.aktif && x.rombel_id === r.id);
    return t ? namaGuru(t.guru_id) : '';
  };
  const belum = D.siswa.filter(s => s.status === 'aktif' && !s.kelas);

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Kelas &amp; Rombel</h1><p>Rombongan belajar tahun ajaran ${esc(sesi.ta)}.</p></div>
      <div class="sp"></div><button class="btn btn-p" id="bTambah">+ Tambah rombel</button></div>
    ${belum.length ? `<div class="info-box"><b>${belum.length} siswa aktif belum ditempatkan</b> di rombel mana pun.
      Buka Data Siswa, pilih siswa yang dimaksud, lalu gunakan tombol Pindah kelas.</div>` : ''}
    <div class="panel"><div class="panel-head"><div class="info">${D.rombel.length} rombel</div></div>
      <div class="scroll"><table><thead><tr>
        <th style="width:100px">Kode</th><th style="width:80px">Tingkat</th>
        <th style="width:100px">Siswa</th><th>Wali kelas</th><th style="width:130px"></th>
      </tr></thead><tbody>${
        D.rombel.length ? D.rombel.map(r => `<tr data-id="${esc(r.id)}">
          <td><span class="tag" style="background:${warnaTingkat(r.tingkat)}">${esc(r.kode)}</span></td>
          <td class="num">${r.tingkat || '—'}</td>
          <td class="num">${jml(r.kode)}</td>
          <td>${wali(r.kode) ? esc(wali(r.kode)) : '<span class="kecil">belum ada wali</span>'}</td>
          <td class="act"><button class="btn btn-sm bLihat">Lihat siswa</button>
            <button class="btn btn-sm btn-d bHapus">Hapus</button></td></tr>`).join('')
        : `<tr><td colspan="5"><div class="empty"><b>Belum ada rombel</b>Tambahkan rombel untuk tahun ajaran ini.</div></td></tr>`
      }</tbody></table></div></div>`;

  $('#bTambah').onclick = () => formulir({
    judul: 'Tambah rombel',
    nilai: { kode: '' },
    kolom: [{ k: 'kode', label: 'Kode rombel', wajib: true, hint: 'Contoh: 10-1, 11-3, 12-6' }],
    simpan: async n => {
      const kode = n.kode.trim();
      if (D.rombel.some(r => r.kode === kode)) throw new Error('Rombel ' + kode + ' sudah ada.');
      if (MODE === 'contoh') D.rombel.push({ id: 'R' + Date.now(), kode, tingkat: tingkatDari(kode), tahun_ajaran: sesi.ta });
      else await idRombel(kode);
      D.rombel.sort((a, b) => a.kode.localeCompare(b.kode, 'id', { numeric: true }));
      toast('Rombel ' + kode + ' ditambahkan');
    }
  });
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const r = D.rombel.find(x => String(x.id) === tr.dataset.id);
    if (e.target.classList.contains('bLihat')) {
      halaman = 'siswa'; ui.kelasSiswa = r.kode; ui.hal = 1;
      $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.hal === 'siswa'));
      gambar();
    } else if (e.target.classList.contains('bHapus')) {
      const isi = jml(r.kode);
      if (isi) return toast(`Rombel ${r.kode} masih berisi ${isi} siswa. Pindahkan dulu siswanya.`, true);
      konfirmasi({
        judul: 'Hapus rombel', pesan: `Rombel <b>${esc(r.kode)}</b> dihapus dari tahun ajaran ${esc(sesi.ta)}.`,
        lanjut: async () => {
          if (MODE === 'db') await buang('rombel', `id=eq.${enc(r.id)}`);
          D.rombel = D.rombel.filter(x => x.id !== r.id);
          toast('Rombel dihapus');
        }
      });
    }
  };
}

/* ------------------------------------------------------------ mapel */
function halMapel() {
  $('#isi').innerHTML = `
    <div class="head"><div><h1>Mata Pelajaran</h1>
      <p>Dipakai bersama oleh data guru dan jadwal KBM. Tersimpan pada tabel <code>mapel</code>.</p></div>
      <div class="sp"></div><button class="btn btn-p" id="bTambah">+ Tambah mapel</button></div>
    <div class="panel"><div class="panel-head"><div class="info">${D.mapel.length} mata pelajaran</div></div>
      <div class="scroll"><table><thead><tr>
        <th style="width:90px">Kode</th><th>Nama</th><th style="width:170px">Rumpun</th>
        <th style="width:130px">Guru pengampu</th><th style="width:90px"></th>
      </tr></thead><tbody>${
        D.mapel.map(m => `<tr data-id="${esc(m.id)}">
          <td class="kecil">${esc(m.id)}</td>
          <td style="font-weight:500">${esc(m.nama)}</td>
          <td>${m.rumpun ? esc(m.rumpun) : '<span class="kecil">—</span>'}</td>
          <td class="num">${D.guru.filter(g => g.mapel_utama === m.nama).length}</td>
          <td class="act"><button class="btn btn-sm bUbah">Ubah</button></td></tr>`).join('')
        || `<tr><td colspan="5"><div class="empty"><b>Belum ada mata pelajaran</b></div></td></tr>`
      }</tbody></table></div></div>
    <p class="kecil">Penghapusan mata pelajaran tidak disediakan di sini karena
      <code>jadwal_kbm</code> merujuk tabel ini. Mapel yang tidak dipakai lagi cukup dibiarkan.</p>`;

  $('#bTambah').onclick = () => formMapel(null);
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    if (e.target.classList.contains('bUbah')) formMapel(D.mapel.find(x => String(x.id) === tr.dataset.id));
  };
}

function formMapel(m) {
  formulir({
    judul: m ? 'Ubah mata pelajaran' : 'Tambah mata pelajaran',
    nilai: m || {},
    kolom: [
      ...(m ? [] : [{ k: 'id', label: 'Kode mapel', wajib: true,
                      hint: 'Penanda pendek, misalnya MAT atau BIND. Dipakai jadwal KBM dan tidak bisa diubah.' }]),
      { k: 'nama', label: 'Nama mata pelajaran', wajib: true },
      { k: 'rumpun', label: 'Rumpun', hint: 'Contoh: MIPA, IPS, Bahasa, Umum' }
    ],
    simpan: async n => {
      const isi = { nama_mapel: n.nama.trim(), rumpun_mapel: n.rumpun || null };
      if (MODE === 'contoh') {
        if (m) Object.assign(m, { nama: isi.nama_mapel, rumpun: isi.rumpun_mapel });
        else D.mapel.push({ id: n.id, nama: isi.nama_mapel, rumpun: isi.rumpun_mapel });
      } else if (m) {
        await perbarui('mapel', `id=eq.${enc(m.id)}`, isi);
        Object.assign(m, { nama: isi.nama_mapel, rumpun: isi.rumpun_mapel });
      } else {
        if (D.mapel.some(x => x.id === n.id.trim())) throw new Error('Kode ' + n.id + ' sudah dipakai.');
        await simpanBaru('mapel', { id: n.id.trim(), ...isi });
      }
      if (MODE === 'db') await muatSemua();
      D.mapel.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
      toast('Tersimpan');
    }
  });
}

/* --------------------------------------------------------- jabatan */
function halJabatan() {
  const dipakai = nama => D.tugas.filter(t => t.jabatan === nama && t.aktif).length;
  $('#isi').innerHTML = `
    <div class="head"><div><h1>Jabatan &amp; Unit</h1>
      <p>Pilihan yang tersedia saat mencatat tugas Staf dan Diperbantukan.</p></div>
      <div class="sp"></div><button class="btn btn-p" id="bTambah">+ Tambah jabatan</button></div>
    <div class="panel"><div class="panel-head"><div class="info">${D.jabatan.length} jabatan</div></div>
      <div class="scroll"><table><thead><tr>
        <th>Nama</th><th style="width:130px">Kategori</th>
        <th style="width:120px">Dipegang</th><th style="width:90px">Status</th><th style="width:90px"></th>
      </tr></thead><tbody>${
        D.jabatan.map(j => `<tr class="${j.aktif === false ? 'mati' : ''}" data-nama="${esc(j.nama)}">
          <td style="font-weight:500">${esc(j.nama)}</td>
          <td><span class="tag tag-l">${esc(j.kategori)}</span></td>
          <td class="num">${dipakai(j.nama)} guru</td>
          <td>${j.aktif === false ? '<span class="kecil">nonaktif</span>' : 'aktif'}</td>
          <td class="act"><button class="btn btn-sm bUbah">Ubah</button>
            ${dipakai(j.nama)
                ? (j.aktif === false ? '' : ' <button class="btn btn-sm bNonaktif">Nonaktifkan</button>')
                : ' <button class="btn btn-sm btn-d bHapus">Hapus</button>'}</td></tr>`).join('')
        || `<tr><td colspan="5"><div class="empty"><b>Belum ada jabatan</b></div></td></tr>`
      }</tbody></table></div></div>`;

  $('#bTambah').onclick = () => formJabatan(null);
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-nama]'); if (!tr) return;
    const jb = D.jabatan.find(x => x.nama === tr.dataset.nama);
    if (e.target.classList.contains('bUbah')) formJabatan(jb);
    else if (e.target.classList.contains('bHapus')) konfirmasi({
      judul: 'Hapus jabatan',
      pesan: `Hapus <b>${esc(jb.nama)}</b> dari daftar pilihan? Belum dipegang siapa pun, jadi tidak ada tugas yang terpengaruh.`,
      lanjut: async () => {
        if (MODE === 'db') await buang('jabatan', `nama=eq.${enc(jb.nama)}`);
        D.jabatan = D.jabatan.filter(x => x.nama !== jb.nama);
        if (MODE === 'db') await muatSemua();
        toast(jb.nama + ' dihapus');
      }
    });
    else if (e.target.classList.contains('bNonaktif')) konfirmasi({
      judul: 'Nonaktifkan jabatan', bahaya: false, tombol: 'Nonaktifkan',
      pesan: `<b>${esc(jb.nama)}</b> sudah dipegang ${dipakai(jb.nama)} guru, jadi tidak bisa dihapus —
              menghapusnya akan memutus catatan tugas yang sudah ada.<br><br>
              Sebagai gantinya jabatan ini ditandai nonaktif: tidak lagi muncul sebagai pilihan
              saat mencatat tugas baru, sedangkan tugas yang sudah ada tetap utuh.`,
      lanjut: async () => {
        if (MODE === 'db') await perbarui('jabatan', `nama=eq.${enc(jb.nama)}`, { aktif: false });
        jb.aktif = false;
        if (MODE === 'db') await muatSemua();
        toast(jb.nama + ' ditandai nonaktif');
      }
    });
  };
}

function formJabatan(j) {
  const dipakai = j ? D.tugas.filter(t => t.jabatan === j.nama && t.aktif).length : 0;
  formulir({
    judul: j ? 'Ubah jabatan' : 'Tambah jabatan',
    hapus: j ? async () => {
      if (dipakai) throw new Error(
        `${j.nama} masih dipegang ${dipakai} guru, jadi tidak bisa dihapus. ` +
        'Ubah statusnya menjadi nonaktif supaya tidak muncul lagi di pilihan, ' +
        'sementara tugas yang terlanjur memakainya tetap utuh.');
      if (MODE === 'db') await buang('jabatan', `nama=eq.${enc(j.nama)}`);
      D.jabatan = D.jabatan.filter(x => x.nama !== j.nama);
      if (MODE === 'db') await muatSemua();
      toast(j.nama + ' dihapus');
    } : null,
    nilai: j ? { ...j, aktif: String(j.aktif !== false) } : { kategori: 'Unit', aktif: 'true' },
    kolom: [
      { k: 'nama', label: 'Nama jabatan atau unit', wajib: true,
        hint: j
          ? (dipakai ? `Sedang dipegang ${dipakai} guru. Mengubah namanya ikut memperbarui tugas mereka.`
                     : 'Belum dipegang siapa pun, jadi aman diubah atau dihapus.')
          : 'Contoh: Penanggung Jawab Laboratorium IPA' },
      { k: 'kategori', label: 'Kategori', tipe: 'pilih',
        opsi: [{ v: 'Struktural', t: 'Struktural — jabatan ber-SK' },
               { v: 'Unit', t: 'Unit — penanggung jawab bidang' }] },
      { k: 'aktif', label: 'Status', tipe: 'pilih',
        opsi: [{ v: 'true', t: 'Aktif' }, { v: 'false', t: 'Nonaktif' }] }
    ],
    simpan: async n => {
      const isi = { nama: n.nama.trim(), kategori: n.kategori, aktif: String(n.aktif) !== 'false' };
      if (MODE === 'contoh') {
        if (j) Object.assign(j, isi); else D.jabatan.push(isi);
      } else if (j) {
        await perbarui('jabatan', `nama=eq.${enc(j.nama)}`, isi);
        Object.assign(j, isi);
      } else {
        await simpanBaru('jabatan', isi);
      }
      // Muat ulang dari database supaya daftar pilihan di halaman lain
      // — terutama formulir Tugas Guru — ikut terbarui.
      if (MODE === 'db') await muatSemua();
      toast('Tersimpan');
    }
  });
}


/* --------------------------------------------------- profil dokumen */
function halProfil() {
  const p = D.profil || {};

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Profil Dokumen</h1>
      <p>Identitas sekolah dan tata letak kop yang dipakai seluruh berkas yang diunduh
         — di aplikasi ini maupun di Kehadiran Guru, Absensi Ekstrakurikuler,
         dan Induk Pembiayaan.</p></div>
      <div class="sp"></div>
      <button class="btn btn-p" id="bUbahProfil">Ubah profil</button></div>

    ${D.galat.profil ? `<div class="info-box"><b>Profil dokumen tidak dapat dibaca.</b>
      ${esc(D.galat.profil)}<br>Kemungkinan berkas <code>41_profil_dokumen.sql</code> belum dijalankan.
      Sementara ini kop memakai nilai bawaan yang tertulis di dalam aplikasi.</div>` : ''}

    <div class="panel"><div class="panel-head"><h3>Tata letak kop</h3>
      <div class="sp" style="flex:1"></div>
      <div class="info" id="kopStatus">belum ada perubahan</div>
      <button class="btn" id="bKopBawaan">Kembalikan ke bawaan</button>
      <button class="btn btn-p" id="bKopSimpan">Simpan tata letak</button></div>
      <div class="panel-body">
        <p class="kecil" style="margin-top:0">Seret <b>logo</b> dan <b>tulisan kop</b> di bawah ini
          ke tempat yang dikehendaki. Yang terlihat di sini sama dengan yang keluar di berkas.</p>
        <div class="kop-atur" id="kopAtur"></div>
        <div class="kop-kertas-bungkus"><div class="kop-kertas" id="kopKertas"></div></div>
        <p class="kecil">Lebar di atas mewakili satu halaman A4 tegak. Laporan yang mendatar
          lebih lebar, tetapi jarak tulisan dari tepi kiri tetap sama seperti yang terlihat di sini.
          Excel hanya bisa menggeser tulisan per 10 piksel, jadi letaknya dibulatkan ke angka itu —
          selisihnya paling banyak setengah milimeter.</p>
      </div></div>

    <div class="panel"><div class="panel-head"><h3>Isian</h3></div>
      <div class="scroll"><table><tbody>
        ${[['Nama sekolah', p.nama_sekolah], ['Alamat', p.alamat], ['Kota tanda tangan', p.kota],
           ['NPSN', p.npsn], ['Telepon', p.telepon], ['Email', p.email], ['Laman', p.laman],
           ['Kepala sekolah', p.kepala_sekolah], ['NIP kepala sekolah', p.nip_kepala],
           ['Berkas logo', p.logo_url], ['Catatan kaki', p.catatan_kaki]]
          .map(([l, v]) => `<tr><td style="width:210px;color:var(--ink2)">${esc(l)}</td>
            <td style="font-weight:500">${v ? esc(v) : '<span class="kecil">belum diisi</span>'}</td></tr>`).join('')}
      </tbody></table></div></div>

    <div class="panel"><div class="panel-head"><h3>Penanda tangan dokumen</h3>
      <div class="sp" style="flex:1"></div><div class="info">dari Tugas Guru</div></div>
      <div class="scroll"><table><tbody>
        ${[['Kepala Sekolah', p.kepala_sekolah, 'Profil Dokumen'],
           ['Wakasek Kurikulum', (D.ttd || {}).kurikulum, 'Tugas Guru'],
           ['Wakasek Kesiswaan', (D.ttd || {}).kesiswaan, 'Tugas Guru'],
           ['Bendahara', (D.ttd || {}).bendahara, 'Tugas Guru']]
          .map(([l, v, asal]) => `<tr><td style="width:210px;color:var(--ink2)">${esc(l)}</td>
            <td style="font-weight:500">${v ? esc(v)
              : '<span class="kecil" style="color:var(--warn)">belum ada pemegangnya</span>'}</td>
            <td style="width:140px" class="kecil">${esc(asal)}</td></tr>`).join('')}
      </tbody></table></div></div>

    <p class="kecil">Nama ketiga pejabat di atas <b>tidak diketik di sini</b> — diturunkan dari
      jabatan yang berlaku di halaman <b>Tugas Guru</b>. Mengganti pejabat cukup dilakukan di
      sana, dan seluruh dokumen di semua aplikasi langsung ikut. Kalau disimpan dua kali,
      cepat atau lambat keduanya akan berbeda tanpa ada yang menyadari.</p>

    <p class="kecil">Logo diambil dari berkas yang disebut pada isian <b>Berkas logo</b>,
      relatif terhadap letak aplikasi — biasanya <code>assets/logo.png</code>.
      Bila berkasnya tidak ada, berkas Excel tetap terbentuk tanpa logo.</p>`;

  $('#bUbahProfil').onclick = () => formProfil();
  pasangEditorKop();
}

/* ------------------------------------------------ editor tata letak kop
   Pratinjau yang bisa diseret. Susunan barisnya dihitung oleh
   KopDokumen.susunanKop — fungsi yang sama yang dipakai penulis berkas
   Excel — sehingga apa yang terlihat di sini tidak bisa menyimpang dari
   apa yang tercetak.                                                    */
const LEBAR_KERTAS = 720;   // kira-kira lebar daerah cetak A4 tegak, dalam piksel

function pasangEditorKop() {
  const K = window.KopDokumen;
  if (!K) return;   // berkas kop-dokumen.js belum termuat

  const p = D.profil || {};
  const asli = JSON.stringify(K.tataLetak(p.tata_letak));
  let TL = JSON.parse(asli);

  const JUDUL_CONTOH = 'DAFTAR HADIR GURU';
  const SUB_CONTOH = 'BULAN : SEPTEMBER 2026';

  const kertas = $('#kopKertas');
  const status = $('#kopStatus');

  const berubah = () => JSON.stringify(TL) !== asli;
  const tandai = () => {
    status.textContent = berubah() ? 'ada perubahan yang belum disimpan' : 'belum ada perubahan';
    status.style.color = berubah() ? 'var(--warn)' : '';
  };
  /* Selama menyeret atau menggeser penggaris, hanya pratinjau yang
     digambar ulang. Tombol pengaturnya dibiarkan utuh supaya penggaris
     yang sedang dipegang tidak ikut terhapus dari bawah jari. */
  const segarRingan = () => { tandai(); gambar(); };
  const segar = () => { segarRingan(); atur(); };

  // ---------------------------------------------------------- pratinjau
  function gambar() {
    const susun = K.susunanKop(TL, p, JUDUL_CONTOH, SUB_CONTOH);
    const baris = susun.baris;
    const nomor = n => baris[n - 1];

    const rataGaya = r => r === 'tengah' ? 'left:0;right:0;text-align:center'
                        : r === 'kanan'  ? 'left:0;right:0;text-align:right'
                        : `left:${susun.teksX}px;right:0;text-align:left`;

    const bNama = nomor(susun.indeks.nama);
    const bIdentitas = susun.indeks.identitas.map(nomor);
    const bJudul = susun.indeks.judul ? nomor(susun.indeks.judul) : null;
    const bSub = susun.indeks.sub ? nomor(susun.indeks.sub) : null;
    const bGaris = susun.indeks.garis ? nomor(susun.indeks.garis) : null;

    const atasTeks = bNama.atas;
    const akhirTeks = bIdentitas.length ? bIdentitas[bIdentitas.length - 1] : bNama;
    const tinggiTeks = akhirTeks.atas + akhirTeks.px - atasTeks;

    kertas.style.height = (susun.tinggi + 150) + 'px';
    kertas.innerHTML = `
      <div class="kop-benda" id="kopTeks"
           style="${rataGaya(TL.teks.rata)};top:${atasTeks}px;height:${tinggiTeks}px">
        <div style="font-size:${TL.teks.ukuranNama}pt;font-weight:700;line-height:${bNama.px}px">
          ${esc(p.nama_sekolah || 'Nama sekolah belum diisi')}</div>
        ${bIdentitas.map((b, i) => `<div style="font-size:${TL.teks.ukuranAlamat}pt;
          color:var(--ink2);line-height:${b.px}px">${esc(susun.identitas[i])}</div>`).join('')}
      </div>

      ${bJudul ? `<div class="kop-mati" style="${rataGaya(TL.judul.rata)};top:${bJudul.atas}px;
        height:${bJudul.px}px;line-height:${bJudul.px}px;font-size:${TL.judul.ukuran}pt;
        font-weight:700">${esc(JUDUL_CONTOH)}</div>` : ''}
      ${bSub ? `<div class="kop-mati" style="${rataGaya(TL.judul.rata)};top:${bSub.atas}px;
        height:${bSub.px}px;line-height:${bSub.px}px;font-size:10pt;color:var(--ink2)"
        >${esc(SUB_CONTOH)}</div>` : ''}
      ${bGaris ? `<div class="kop-garis" style="top:${bGaris.atas + bGaris.px - 2}px"></div>` : ''}

      <div class="kop-tabel" style="top:${susun.tinggi + 10}px">
        <div class="kop-tabel-kepala">NO &nbsp;·&nbsp; NAMA &nbsp;·&nbsp; JUMLAH</div>
        <div class="kop-tabel-baris"></div>
        <div class="kop-tabel-baris"></div>
      </div>
      ${TL.kaki.tampil && p.catatan_kaki ? `<div class="kop-mati kop-kaki"
        style="left:0;right:0;top:${susun.tinggi + 96}px;text-align:${
          TL.kaki.rata === 'kiri' ? 'left' : TL.kaki.rata === 'kanan' ? 'right' : 'center'}"
        >${esc(p.catatan_kaki)}</div>` : ''}

      <!-- Logo sengaja ditulis PALING AKHIR supaya tergambar di ATAS tulisan.
           Di Excel gambar memang selalu di atas sel dan tidak bisa ditaruh di
           belakang tulisan; kalau pratinjau ini menggambarnya di bawah,
           tabrakan logo dengan tulisan baru ketahuan setelah berkasnya
           diunduh. Tabrakannya sendiri sudah dicegah — tulisan berhenti di
           tepi logo — tetapi yang terlihat di sini harus tetap jujur. -->
      ${TL.logo.tampil ? `<div class="kop-benda kop-logo" id="kopLogo"
           style="left:${TL.logo.x}px;top:${TL.logo.y}px;width:${TL.logo.ukuran}px;height:${TL.logo.ukuran}px">
           <img src="${esc(SEKOLAH.logo)}" alt="" draggable="false"
                onerror="this.style.display='none'">
           <span class="kop-pegangan" id="kopUbahUkuran" title="Tarik untuk mengubah ukuran"></span>
         </div>` : ''}`;

    if (TL.logo.tampil) {
      seret($('#kopLogo'), (dx, dy, awal) => {
        TL.logo.x = Math.max(0, Math.min(LEBAR_KERTAS - TL.logo.ukuran, awal.x + dx));
        TL.logo.y = Math.max(0, Math.min(200, awal.y + dy));
      }, () => ({ x: TL.logo.x, y: TL.logo.y }), '#kopUbahUkuran');

      seret($('#kopUbahUkuran'), (dx, dy, awal) => {
        TL.logo.ukuran = Math.max(20, Math.min(140, awal.u + Math.round((dx + dy) / 2)));
      }, () => ({ u: TL.logo.ukuran }));
    }

    // Tulisan hanya bisa digeser mendatar bila perataannya kiri; kalau
    // rata tengah atau kanan, letaknya ditentukan lebar halaman.
    seret($('#kopTeks'), (dx, dy, awal) => {
      // Digeser tegak dulu, baru mendatar: menggeser tulisan ke bawah logo
      // membebaskannya dari batas kiri, dan itu baru diketahui sesudah y
      // yang baru dipakai.
      TL.teks.y = Math.max(0, Math.min(200, Math.round((awal.y + dy) / 2) * 2));
      if (TL.teks.rata === 'kiri') {
        const L = K.LANGKAH_GESER;
        // Berhenti di tepi logo. Nilai yang tersimpan sama dengan yang
        // terlihat, supaya tidak ada letak tersembunyi yang muncul lagi
        // sewaktu logonya digeser.
        const batasKiri = K.susunanKop(TL, p, JUDUL_CONTOH, SUB_CONTOH).teksMinX;
        TL.teks.x = Math.max(batasKiri, Math.min(LEBAR_KERTAS - 120,
          Math.round((awal.x + dx) / L) * L));
      }
    }, () => ({ x: TL.teks.x, y: TL.teks.y }));

    const teks = $('#kopTeks');
    if (teks) teks.style.cursor = TL.teks.rata === 'kiri' ? 'move' : 'ns-resize';
  }

  /* Satu penangan seret untuk mouse, layar sentuh, dan pena sekaligus.
     Memakai pointer event, bukan drag-and-drop HTML5, karena yang kedua
     tidak bekerja di layar sentuh.

     Pengikutnya dipasang pada `window`, bukan pada kotak yang diseret.
     Setiap gerakan menggambar ulang pratinjau — supaya yang terlihat
     selalu sama dengan hasil cetaknya — dan penggambaran itu mengganti
     kotaknya dengan yang baru. Kalau pengikutnya menempel pada kotak,
     seretan akan putus pada gerakan pertama. */
  function seret(el, geser, mulai, kecuali) {
    if (!el) return;
    el.addEventListener('pointerdown', ev => {
      if (kecuali && ev.target.closest(kecuali)) return;
      ev.preventDefault();
      const x0 = ev.clientX, y0 = ev.clientY, awal = mulai();
      const jalan = e => { geser(e.clientX - x0, e.clientY - y0, awal); segarRingan(); };
      const henti = () => {
        window.removeEventListener('pointermove', jalan);
        window.removeEventListener('pointerup', henti);
        window.removeEventListener('pointercancel', henti);
      };
      window.addEventListener('pointermove', jalan);
      window.addEventListener('pointerup', henti);
      window.addEventListener('pointercancel', henti);
    });
  }

  // ------------------------------------------------------ tombol pengatur
  function atur() {
    const pilih = (label, nilai, daftar, saat) => `
      <div class="kop-atur-baris"><span class="kop-atur-label">${esc(label)}</span>
        <span class="kop-pilih" data-saat="${esc(saat)}">${daftar.map(([v, t]) =>
          `<button type="button" class="kop-pilih-btn${v === nilai ? ' aktif' : ''}"
             data-nilai="${esc(String(v))}">${esc(t)}</button>`).join('')}</span></div>`;

    const geser = (label, nilai, min, maks, saat, satuan) => `
      <div class="kop-atur-baris"><span class="kop-atur-label">${esc(label)}</span>
        <input type="range" class="kop-geser" data-saat="${esc(saat)}"
               min="${min}" max="${maks}" value="${nilai}">
        <span class="kop-atur-nilai">${nilai}${esc(satuan || '')}</span></div>`;

    $('#kopAtur').innerHTML = `
      <div class="kop-atur-kel"><h4>Logo</h4>
        ${pilih('Tampilkan', TL.logo.tampil, [[true, 'Ya'], [false, 'Tidak']], 'logo.tampil')}
        ${TL.logo.tampil ? geser('Ukuran', TL.logo.ukuran, 20, 140, 'logo.ukuran', ' px') : ''}
      </div>
      <div class="kop-atur-kel"><h4>Tulisan kop</h4>
        ${pilih('Perataan', TL.teks.rata, [['kiri', 'Kiri'], ['tengah', 'Tengah'], ['kanan', 'Kanan']], 'teks.rata')}
        ${geser('Besar nama', TL.teks.ukuranNama, 8, 28, 'teks.ukuranNama', ' pt')}
        ${geser('Besar alamat', TL.teks.ukuranAlamat, 6, 20, 'teks.ukuranAlamat', ' pt')}
      </div>
      <div class="kop-atur-kel"><h4>Judul laporan</h4>
        ${pilih('Perataan', TL.judul.rata, [['kiri', 'Kiri'], ['tengah', 'Tengah'], ['kanan', 'Kanan']], 'judul.rata')}
        ${geser('Besar judul', TL.judul.ukuran, 8, 24, 'judul.ukuran', ' pt')}
      </div>
      <div class="kop-atur-kel"><h4>Lain-lain</h4>
        ${pilih('Garis pembatas', TL.garis, [[true, 'Ada'], [false, 'Tidak']], 'garis')}
        ${pilih('Catatan kaki', TL.kaki.tampil, [[true, 'Tampil'], [false, 'Tidak']], 'kaki.tampil')}
        ${TL.kaki.tampil ? pilih('Letak catatan kaki', TL.kaki.rata,
            [['kiri', 'Kiri'], ['tengah', 'Tengah'], ['kanan', 'Kanan']], 'kaki.rata') : ''}
      </div>`;

    const tulis = (jalur, nilai) => {
      const bagian = jalur.split('.');
      let o = TL;
      while (bagian.length > 1) o = o[bagian.shift()];
      o[bagian[0]] = nilai;
    };
    const bacaNilai = t => t === 'true' ? true : t === 'false' ? false : t;

    $('#kopAtur').querySelectorAll('.kop-pilih-btn').forEach(b => {
      b.onclick = () => {
        tulis(b.parentNode.dataset.saat, bacaNilai(b.dataset.nilai));
        segar();
      };
    });
    $('#kopAtur').querySelectorAll('.kop-geser').forEach(g => {
      g.oninput = () => {
        tulis(g.dataset.saat, Number(g.value));
        g.nextElementSibling.textContent = g.value +
          (g.dataset.saat.includes('ukuranNama') || g.dataset.saat.includes('ukuranAlamat')
           || g.dataset.saat === 'judul.ukuran' ? ' pt' : ' px');
        segarRingan();
      };
    });
  }

  // ------------------------------------------------------------- simpan
  $('#bKopBawaan').onclick = () => {
    TL = JSON.parse(JSON.stringify(K.TATA_LETAK_BAWAAN));
    segar();
    toast('Tata letak dikembalikan ke bawaan — belum disimpan');
  };

  $('#bKopSimpan').onclick = async () => {
    if (!berubah()) { toast('Tidak ada yang berubah'); return; }
    if (MODE === 'contoh') {
      (D.profil || (D.profil = {})).tata_letak = TL;
      toast('Mode contoh: tidak tersimpan');
      return;
    }
    try {
      await api('/rest/v1/profil_dokumen?id=eq.1', {
        method: 'PATCH', body: JSON.stringify({ tata_letak: TL })
      });
      await muatSemua();
      halProfil();
      toast('Tata letak kop disimpan — berlaku di semua aplikasi');
    } catch (e) {
      toast('Gagal menyimpan: ' + e.message, true);
    }
  };

  segar();
}

function formProfil() {
  const p = D.profil || {};
  formulir({
    judul: 'Profil dokumen',
    lebar: true,
    catatan: 'Dipakai seragam oleh seluruh unduhan Excel aplikasi ini.',
    nilai: p,
    kolom: [
      { k: 'nama_sekolah', label: 'Nama sekolah', wajib: true,
        hint: 'Ditulis persis seperti yang dikehendaki muncul di kop.' },
      { k: 'alamat', label: 'Alamat' },
      { k: 'npsn', label: 'NPSN' },
      { k: 'telepon', label: 'Telepon' },
      { k: 'email', label: 'Email' },
      { k: 'laman', label: 'Laman' },
      { k: 'kota', label: 'Kota tanda tangan', hint: 'Muncul sebagai "Soreang, 17 September 2026"' },
      { k: 'kepala_sekolah', label: 'Nama kepala sekolah' },
      { k: 'nip_kepala', label: 'NIP kepala sekolah', hint: 'Dikosongkan bila tidak dipakai' },
      { k: 'logo_url', label: 'Berkas logo',
        hint: 'Contoh: assets/logo.png — letakkan berkasnya di folder yang sama dengan aplikasi.' },
      { k: 'catatan_kaki', label: 'Catatan kaki', tipe: 'panjang',
        hint: 'Opsional, muncul di bagian bawah berkas.' }
    ],
    simpan: async n => {
      const bersih = v => (v == null || String(v).trim() === '') ? null : String(v).trim();
      const isi = {
        id: 1,
        nama_sekolah: n.nama_sekolah.trim(),
        alamat: bersih(n.alamat), npsn: bersih(n.npsn), telepon: bersih(n.telepon),
        email: bersih(n.email), laman: bersih(n.laman), kota: bersih(n.kota),
        kepala_sekolah: bersih(n.kepala_sekolah), nip_kepala: bersih(n.nip_kepala),
        logo_url: bersih(n.logo_url), catatan_kaki: bersih(n.catatan_kaki)
      };
      if (MODE === 'contoh') { Object.assign(D.profil || (D.profil = {}), isi); toast('Mode contoh: tidak tersimpan'); return; }
      await api('/rest/v1/profil_dokumen?on_conflict=id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify([isi])
      });
      await muatSemua();
      toast('Profil dokumen diperbarui');
    }
  });
}

/* ------------------------------------------------------ tahun ajaran */
function halTahun() {
  $('#isi').innerHTML = `
    <div class="head"><div><h1>Tahun Ajaran</h1>
      <p>Pergantian tahun ajaran menambah data baru, tidak menimpa yang lama.</p></div>
      <div class="sp"></div><button class="btn" id="bTambah">+ Tambah tahun ajaran</button>
      <button class="btn btn-p" id="bNaik">Proses kenaikan kelas</button></div>
    <div class="panel"><div class="panel-head"><div class="info">${D.tahun.length} tahun ajaran tercatat</div></div>
      <div class="scroll"><table><thead><tr>
        <th style="width:130px">Kode</th><th style="width:120px">Mulai</th><th style="width:120px">Selesai</th>
        <th style="width:100px">Rombel</th><th style="width:90px">Status</th><th style="width:120px"></th>
      </tr></thead><tbody>${
        D.tahun.map(t => `<tr data-kode="${esc(t.kode)}">
          <td style="font-weight:500">${esc(t.kode)}</td>
          <td class="num">${tglIndo(t.mulai)}</td><td class="num">${tglIndo(t.selesai)}</td>
          <td class="num">${t.kode === sesi.ta ? D.rombel.length : '—'}</td>
          <td>${t.aktif ? '<span class="tag" style="background:var(--primary)">aktif</span>' : '<span class="kecil">arsip</span>'}</td>
          <td class="act">${t.aktif ? '' : '<button class="btn btn-sm bAktif">Jadikan aktif</button>'}</td></tr>`).join('')
      }</tbody></table></div></div>
    <div class="panel"><div class="panel-head"><h3>Cadangan data</h3></div>
      <div class="panel-body">
        <p class="msg">Unduh seluruh isi data induk menjadi satu berkas Excel berisi beberapa lembar:
          siswa, guru, rombel, tugas, dan mata pelajaran. Simpan di drive sekolah secara berkala —
          Supabase versi gratis tidak menyediakan pemulihan otomatis ke titik waktu tertentu.</p>
        <button class="btn" id="bCadangan">Unduh cadangan lengkap</button></div></div>`;

  $('#bCadangan').onclick = unduhCadangan;
  $('#bTambah').onclick = () => formulir({
    judul: 'Tambah tahun ajaran',
    nilai: {},
    kolom: [
      { k: 'kode', label: 'Kode tahun ajaran', wajib: true, hint: 'Contoh: 2027/2028' },
      { k: 'mulai', label: 'Mulai', tipe: 'tanggal' },
      { k: 'selesai', label: 'Selesai', tipe: 'tanggal' }
    ],
    simpan: async n => {
      const isi = { kode: n.kode.trim(), mulai: n.mulai || null, selesai: n.selesai || null, aktif: false };
      if (MODE === 'db') await simpanBaru('tahun_ajaran', isi);
      D.tahun.unshift(isi);
      toast('Tahun ajaran ditambahkan');
    }
  });
  $('#bNaik').onclick = wizardKenaikan;
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-kode]'); if (!tr) return;
    if (!e.target.classList.contains('bAktif')) return;
    const kode = tr.dataset.kode;
    konfirmasi({
      judul: 'Ganti tahun ajaran aktif', bahaya: false, tombol: 'Jadikan aktif',
      pesan: `Seluruh aplikasi sekolah akan membaca tahun ajaran <b>${esc(kode)}</b> sebagai tahun berjalan.`,
      lanjut: async () => {
        if (MODE === 'db') {
          await perbarui('tahun_ajaran', 'aktif=is.true', { aktif: false });
          await perbarui('tahun_ajaran', `kode=eq.${enc(kode)}`, { aktif: true });
          await muatSemua();
        } else { D.tahun.forEach(t => t.aktif = t.kode === kode); sesi.ta = kode; }
        $('#fTa').textContent = 'TA ' + sesi.ta;
        toast('Tahun ajaran aktif: ' + kode);
      }
    });
  };
}

function wizardKenaikan() {
  const t10 = D.siswa.filter(s => s.status === 'aktif' && tingkatDari(s.kelas) === 10).length;
  const t11 = D.siswa.filter(s => s.status === 'aktif' && tingkatDari(s.kelas) === 11).length;
  const t12 = D.siswa.filter(s => s.status === 'aktif' && tingkatDari(s.kelas) === 12).length;
  formulir({
    judul: 'Proses kenaikan kelas',
    lebar: true,
    catatan: 'Data tahun berjalan tidak diubah. Yang dilakukan: membuat rombel tahun ajaran baru, memindahkan siswa kelas 10 ke 11 dan 11 ke 12 dengan nomor rombel yang sama, lalu menandai siswa kelas 12 sebagai lulus.',
    nilai: { kode: '', mulai: '', selesai: '' },
    kolom: [
      { k: 'kode', label: 'Tahun ajaran baru', wajib: true, hint: `Sekarang: ${sesi.ta}. Contoh isian: 2027/2028` },
      { k: 'mulai', label: 'Mulai', tipe: 'tanggal' },
      { k: 'selesai', label: 'Selesai', tipe: 'tanggal' },
      { k: 'konfirmasi', label: 'Ketik LANJUT untuk menegaskan', wajib: true,
        hint: `Akan diproses: ${t10} siswa naik ke kelas 11, ${t11} naik ke kelas 12, ${t12} ditandai lulus.` }
    ],
    simpan: async n => {
      if (String(n.konfirmasi).trim().toUpperCase() !== 'LANJUT') throw new Error('Pengetikan penegasan tidak cocok. Proses dibatalkan.');
      const baru = n.kode.trim();
      if (MODE === 'contoh') { toast('Mode contoh: proses kenaikan tidak dijalankan'); return; }

      await simpanBaru('tahun_ajaran', { kode: baru, mulai: n.mulai || null, selesai: n.selesai || null, aktif: false },
                       'on_conflict=kode');
      const petaRombel = {};
      for (const r of D.rombel) {
        if (r.tingkat !== 10 && r.tingkat !== 11) continue;
        const kodeBaru = (r.tingkat + 1) + '-' + r.kode.split('-')[1];
        const d = await api('/rest/v1/rombel?on_conflict=kode,tahun_ajaran', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify([{ kode: kodeBaru, tingkat: r.tingkat + 1, tahun_ajaran: baru }])
        });
        petaRombel[r.kode] = d[0].id;
      }
      const naik = D.siswa.filter(s => s.status === 'aktif' && petaRombel[s.kelas]);
      for (let i = 0; i < naik.length; i += 200) {
        sibuk(`Memindahkan siswa ${i + 1}–${Math.min(i + 200, naik.length)} dari ${naik.length}…`);
        await api('/rest/v1/penempatan_kelas?on_conflict=siswa_id,tahun_ajaran', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(naik.slice(i, i + 200).map(s =>
            ({ siswa_id: s.id, rombel_id: petaRombel[s.kelas], tahun_ajaran: baru })))
        });
      }
      const lulus = D.siswa.filter(s => s.status === 'aktif' && tingkatDari(s.kelas) === 12).map(s => s.id);
      if (lulus.length) {
        await perbarui('siswa', `id=in.(${lulus.map(enc).join(',')})`,
                       { status: 'lulus', tanggal_status: new Date().toISOString().slice(0, 10) });
      }
      toast(`Kenaikan kelas selesai. ${naik.length} siswa dipindahkan, ${lulus.length} ditandai lulus. Aktifkan tahun ajaran ${baru} bila sudah siap.`);
      await muatSemua();
    }
  });
}

/* ------------------------------------------------------- pilih massal */
function gambarSelbar() {
  const root = $('#selbar-root');
  if (!sel.size || halaman !== 'siswa') { root.innerHTML = ''; return; }
  root.innerHTML = `<div class="selbar"><span><b>${sel.size}</b> siswa dipilih</span>
    <button class="btn btn-sm" id="sPindah">Pindah kelas</button>
    <button class="btn btn-sm" id="sStatus">Ubah status</button>
    <button class="btn btn-sm btn-d" id="sHapus">Hapus</button>
    <button class="btn btn-sm" id="sBatal">Batal</button></div>`;
  $('#sBatal').onclick = () => { sel.clear(); gambar(); };
  $('#sHapus').onclick = () => hapusSiswa([...sel]);
  $('#sPindah').onclick = () => formulir({
    judul: `Pindah kelas ${sel.size} siswa`,
    nilai: {},
    kolom: [{ k: 'kelas', label: 'Kelas tujuan', wajib: true, daftar: D.rombel.map(r => r.kode),
              hint: 'Kelas yang belum ada akan dibuat otomatis' }],
    simpan: async n => {
      const ids = [...sel];
      if (MODE === 'db') {
        const rid = await idRombel(n.kelas.trim());
        for (let i = 0; i < ids.length; i += 200) {
          await api('/rest/v1/penempatan_kelas?on_conflict=siswa_id,tahun_ajaran', {
            method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(ids.slice(i, i + 200).map(id => ({ siswa_id: id, rombel_id: rid, tahun_ajaran: sesi.ta })))
          });
        }
      }
      D.siswa.forEach(s => { if (ids.includes(s.id)) s.kelas = n.kelas.trim(); });
      sel.clear();
      toast(`${ids.length} siswa dipindahkan ke ${n.kelas}`);
    }
  });
  $('#sStatus').onclick = () => formulir({
    judul: `Ubah status ${sel.size} siswa`,
    nilai: { status: 'pindah' },
    kolom: [{ k: 'status', label: 'Status baru', tipe: 'pilih', opsi: STATUS_SISWA.map(v => ({ v, t: v })),
              hint: 'Dipakai untuk mutasi keluar, mengundurkan diri, atau kelulusan.' }],
    simpan: async n => {
      const ids = [...sel];
      if (MODE === 'db') await perbarui('siswa', `id=in.(${ids.map(enc).join(',')})`,
        { status: n.status, tanggal_status: new Date().toISOString().slice(0, 10) });
      D.siswa.forEach(s => { if (ids.includes(s.id)) s.status = n.status; });
      sel.clear();
      toast(`${ids.length} siswa ditandai ${n.status}`);
    }
  });
}

function pasangPager(maxHal, ke) {
  const el = $('#pg'); if (!el) return;
  if (maxHal <= 1) { el.innerHTML = ''; return; }
  const p = ui.hal, out = [];
  const tbl = (t, n, on, mati) => out.push(`<button data-p="${n}" class="${on ? 'on' : ''}" ${mati ? 'disabled' : ''}>${t}</button>`);
  tbl('‹', p - 1, false, p <= 1);
  [...new Set([1, maxHal, p, p - 1, p + 1])].filter(n => n >= 1 && n <= maxHal).sort((a, b) => a - b)
    .forEach((n, i, arr) => { if (i && n - arr[i - 1] > 1) out.push('<span class="kecil" style="padding:0 3px">…</span>'); tbl(n, n, n === p); });
  tbl('›', p + 1, false, p >= maxHal);
  el.innerHTML = out.join('');
  $$('#pg button[data-p]').forEach(b => b.onclick = () => { if (!b.disabled) { ke(+b.dataset.p); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
}

/* ------------------------------------------------------ impor berkas */
function pilihBerkas(lanjut) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.csv,.xlsx,.xls,.txt';
  inp.onchange = () => { const f = inp.files[0]; if (f) bacaBerkas(f, lanjut); };
  inp.click();
}
function bacaBerkas(file, lanjut) {
  const fr = new FileReader();
  const n = file.name.toLowerCase();
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) {
    if (typeof XLSX === 'undefined') return toast('Pembaca Excel belum termuat. Gunakan berkas CSV.', true);
    fr.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
        lanjut(m.filter(r => r.some(v => String(v).trim() !== '')), file.name);
      } catch (err) { toast('Berkas Excel gagal dibaca: ' + err.message, true); }
    };
    fr.readAsArrayBuffer(file);
  } else {
    fr.onload = e => { try { lanjut(pecahCSV(e.target.result), file.name); } catch (err) { toast('Berkas gagal dibaca: ' + err.message, true); } };
    fr.readAsText(file, 'UTF-8');
  }
}
function pecahCSV(teks) {
  teks = teks.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const b1 = teks.split('\n')[0] || '';
  const d = [';', '\t', ',', '|'].sort((a, b) => (b1.split(b).length - 1) - (b1.split(a).length - 1))[0];
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (q) { if (c === '"') { if (teks[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(v => String(v).trim() !== ''));
}
const normal = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function petakan(header, aturan) {
  const map = {};
  header.forEach((h, i) => {
    const n = normal(h);
    for (const [kunci, cocok] of Object.entries(aturan))
      if (map[kunci] === undefined && cocok.some(c => n === c || n.includes(c))) { map[kunci] = i; break; }
  });
  return map;
}
function normalTanggal(v) {
  if (v == null) return '';
  if (v instanceof Date && !isNaN(v))
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  const s = String(v).trim(); if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s;
}

/* Berkas hasil unduhan aplikasi ini berkop, sehingga judul kolom tidak
   berada di baris pertama. Barisnya dicari, bukan diandaikan — supaya
   berkas yang baru diunduh bisa langsung diunggah kembali.           */
function cariBarisJudul(matrix) {
  const i = matrix.findIndex(r => r.some(v => normal(v) === 'nama' || normal(v).startsWith('nama')));
  return i > 0 ? matrix.slice(i) : matrix;
}

function imporSiswa(matrix, namaBerkas) {
  matrix = cariBarisJudul(matrix);
  const map = petakan(matrix[0], { nisn: ['nisn'], nis: ['nis'], nama: ['nama'], kelas: ['kelas', 'rombel'],
                                   tgl: ['tanggallahir', 'tgllahir', 'lahir'], jk: ['jeniskelamin', 'lp', 'gender'] });
  if (map.nama === undefined) return toast('Kolom "Nama" tidak ditemukan pada baris pertama berkas.', true);
  const amb = (r, i) => i === undefined ? '' : String(r[i] == null ? '' : r[i]).trim();
  const baris = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    const o = { nisn: amb(r, map.nisn).replace(/\s/g, ''), nis: amb(r, map.nis).replace(/\s/g, ''),
                nama: amb(r, map.nama).replace(/\s+/g, ' '), kelas: amb(r, map.kelas),
                tgl: normalTanggal(map.tgl === undefined ? '' : r[map.tgl]),
                jk: amb(r, map.jk).toUpperCase().startsWith('P') ? 'P' : amb(r, map.jk).toUpperCase().startsWith('L') ? 'L' : '' };
    if (o.nama) baris.push(o);
  }
  if (!baris.length) return toast('Tidak ada baris data yang terbaca.', true);

  konfirmasi({
    judul: 'Unggah data siswa', bahaya: false, tombol: `Proses ${baris.length} baris`,
    pesan: `<b>${esc(namaBerkas)}</b> berisi <b>${baris.length}</b> baris.<br>
      Pencocokan memakai NISN: yang sudah ada diperbarui, yang belum ada ditambahkan.
      Tidak ada data yang dihapus. Siswa dengan NISN kosong selalu dianggap siswa baru.`,
    lanjut: async () => {
      if (MODE === 'contoh') { toast('Mode contoh: unggahan tidak disimpan'); return; }
      const isi = baris.filter(b => /^\d{10}$/.test(b.nisn)).map(b =>
        ({ nisn: b.nisn, nis: b.nis || null, nama: b.nama, tanggal_lahir: b.tgl || null, jenis_kelamin: b.jk || null }));
      for (let i = 0; i < isi.length; i += 200) {
        sibuk(`Mengirim ${i + 1}–${Math.min(i + 200, isi.length)} dari ${isi.length}…`);
        await api('/rest/v1/siswa?on_conflict=nisn', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(isi.slice(i, i + 200))
        });
      }
      const tanpaNisn = baris.filter(b => !/^\d{10}$/.test(b.nisn));
      for (const b of tanpaNisn) await simpanBaru('siswa', { nisn: b.nisn || null, nis: b.nis || null, nama: b.nama,
                                                             tanggal_lahir: b.tgl || null, jenis_kelamin: b.jk || null });
      await muatSiswa();
      const perKelas = new Map();
      baris.filter(b => b.kelas).forEach(b => {
        if (!perKelas.has(b.kelas)) perKelas.set(b.kelas, []);
        perKelas.get(b.kelas).push(b.nisn || b.nama);
      });
      for (const [kelas, kunci] of perKelas) {
        sibuk('Menempatkan kelas ' + kelas + '…');
        const rid = await idRombel(kelas);
        const ids = D.siswa.filter(s => kunci.includes(s.nisn) || kunci.includes(s.nama)).map(s => s.id);
        for (let i = 0; i < ids.length; i += 200)
          await api('/rest/v1/penempatan_kelas?on_conflict=siswa_id,tahun_ajaran', {
            method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(ids.slice(i, i + 200).map(id => ({ siswa_id: id, rombel_id: rid, tahun_ajaran: sesi.ta })))
          });
      }
      await muatSemua();
      toast(baris.length + ' baris diproses');
    }
  });
}

function imporGuru(matrix, namaBerkas) {
  matrix = cariBarisJudul(matrix);
  const map = petakan(matrix[0], { nig: ['nig'], id: ['idguru'], nama: ['nama'], mapel: ['mapel', 'matapelajaran'],
                                   ptk: ['jenisptk', 'ptk', 'status kepegawaian'], tmt: ['tmt'],
                                   nuptk: ['nuptk'], hp: ['hp', 'telepon', 'wa'] });
  if (map.nama === undefined) return toast('Kolom "Nama" tidak ditemukan pada baris pertama berkas.', true);
  const amb = (r, i) => i === undefined ? '' : String(r[i] == null ? '' : r[i]).trim();
  const baris = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    const nama = amb(r, map.nama).replace(/\s+/g, ' ');
    if (!nama) continue;
    const nig = amb(r, map.nig).replace(/\D/g, '');
    baris.push({ id: amb(r, map.id) || ('G' + String(nig || (nigBerikut() + baris.length)).padStart(3, '0')),
                 nig: nig || String(nigBerikut() + baris.length), nama,
                 mapel_utama: amb(r, map.mapel) || null, jenis_ptk: amb(r, map.ptk) || null,
                 tmt_sekolah: normalTanggal(map.tmt === undefined ? '' : r[map.tmt]) || null,
                 nuptk: amb(r, map.nuptk) || null, no_hp: amb(r, map.hp) || null, status_aktif: 'Aktif' });
  }
  if (!baris.length) return toast('Tidak ada baris data yang terbaca.', true);

  konfirmasi({
    judul: 'Unggah data guru', bahaya: false, tombol: `Proses ${baris.length} baris`,
    pesan: `<b>${esc(namaBerkas)}</b> berisi <b>${baris.length}</b> baris.<br>
      Pencocokan memakai ID guru. Yang sudah ada diperbarui, yang belum ada ditambahkan.`,
    lanjut: async () => {
      if (MODE === 'contoh') { toast('Mode contoh: unggahan tidak disimpan'); return; }
      for (let i = 0; i < baris.length; i += 100) {
        sibuk(`Mengirim ${i + 1}–${Math.min(i + 100, baris.length)} dari ${baris.length}…`);
        await api('/rest/v1/guru?on_conflict=id', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(baris.slice(i, i + 100))
        });
      }
      await muatSemua();
      toast(baris.length + ' data guru diproses');
    }
  });
}

/* ------------------------------------------------------------ ekspor */
const kolomSiswa = () => [['NISN', 'nisn'], ['NIS', 'nis'], ['Nama', 'nama'], ['Kelas', 'kelas'],
                          ['L/P', 'jk'], ['Tanggal Lahir', 'tgl'], ['Status', 'status']];
const kolomGuru  = () => [['ID', 'id'], ['NIG', 'nig'], ['Nama', 'nama'], ['Mapel Utama', 'mapel_utama'],
                          ['Jenis PTK', 'jenis_ptk'], ['TMT', 'tmt_sekolah'], ['NUPTK', 'nuptk'],
                          ['No HP', 'no_hp'], ['Status', 'status_aktif']];

function keAOA(kolom, data) {
  return [kolom.map(k => k[0])].concat(data.map(r => kolom.map(k => r[k[1]] == null ? '' : r[k[1]])));
}
function unduhBlob(blob, nama) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nama;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function stempel() {
  const t = new Date(), p = n => String(n).padStart(2, '0');
  return `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}`;
}
/* Penjaga: bila assets/kop-dokumen.js tidak termuat, unduhan gagal dengan
   pesan yang bisa ditindaklanjuti, bukan "undefined". */
function kopBersama() {
  if (!window.KopDokumen) throw new Error(
    'Berkas assets/kop-dokumen.js belum termuat, sehingga kop dokumen tidak bisa dibuat. '
    + 'Muat ulang halaman; bila tetap gagal, laporkan ke operator.');
  return window.KopDokumen;
}

/* Kop seragam untuk seluruh berkas Excel. Susunan dan letaknya tidak lagi
   ditentukan di sini melainkan di assets/kop-dokumen.js, yang sama persis
   di keempat aplikasi dan membaca tata letak yang diatur operator di
   halaman Profil Dokumen. Fungsi ini tinggal menyiapkan logo dan profil. */
async function kopExcel(wb, ws, judul, subjudul, kolomAkhir) {
  return kopBersama().kopExcel(ws, {
    wb, logo: await logoKop(),
    profil: profilKop(),
    judul: (judul || '').toUpperCase(),
    sub: subjudul || '',
    kolomAkhir: Math.max(1, kolomAkhir),
    warnaGaris: 'FF12262E'
  });
}

/* Catatan kaki dari Profil Dokumen, bila diisi. */
function kakiExcel(ws, baris, kolomAkhir) {
  return kopBersama().kakiExcel(ws, baris, {
    profil: profilKop(), kolomAkhir: Math.max(1, kolomAkhir)
  });
}

/* Berkas logo dibaca sekali saja. Satu unduhan jadwal KBM bisa berisi
   puluhan lembar, dan tiap lembar memerlukan logo yang sama. */
let _logoKop;
async function logoKop() {
  if (_logoKop !== undefined) return _logoKop;
  try {
    _logoKop = { buffer: await fetch(SEKOLAH.logo).then(r => r.ok ? r.arrayBuffer() : Promise.reject()) };
  } catch (e) { _logoKop = null; }   // tanpa logo pun berkasnya tetap terbentuk
  return _logoKop;
}

/* Profil apa adanya bila tabelnya terbaca; bila tidak — mode contoh atau
   tabel belum ada — disusun dari nilai cadangan supaya kop tetap terbentuk. */
function profilKop() {
  if (D.profil) return D.profil;
  return { nama_sekolah: SEKOLAH.nama, alamat: SEKOLAH.alamat, kota: SEKOLAH.kota,
           npsn: SEKOLAH.npsn, telepon: SEKOLAH.telepon, email: SEKOLAH.email,
           laman: SEKOLAH.laman, catatan_kaki: SEKOLAH.catatan };
}

/* Blok tanda tangan seragam, juga dari Profil Dokumen. */
function ttdExcel(ws, baris, kolomAkhir) {
  // Blok tanda tangan digabung dari beberapa kolom terakhir sampai
  // lebarnya cukup memuat tanggal — kalau ditaruh pada satu kolom
  // sempit, tulisannya meluber melewati garis tabel paling kanan.
  const lebar = (ws.columns || []).map(k => (k && k.width) || 10);
  let kumpul = 0, mulai = kolomAkhir;
  for (let k = kolomAkhir; k >= 1; k--) {
    kumpul += lebar[k - 1] || 10;
    mulai = k;
    if (kumpul >= 30) break;
  }

  const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const tulis = (r, teks, gaya) => {
    if (mulai < kolomAkhir) ws.mergeCells(r, mulai, r, kolomAkhir);
    const c = ws.getCell(r, mulai);
    c.value = teks;
    c.font = Object.assign({ size: 10 }, gaya || {});
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  };

  tulis(baris, (SEKOLAH.kota || '') + ', ' + tgl);
  tulis(baris + 1, 'Kepala Sekolah,');
  tulis(baris + 5, SEKOLAH.kepala || '', { bold: true, underline: true });
  if (SEKOLAH.nip) tulis(baris + 6, 'NIP. ' + SEKOLAH.nip, { size: 9.5 });
}

/* Daftar bertabel — siswa, guru, kelompok, dan sejenisnya. Kini berkop
   seperti jadwal, supaya seluruh berkas aplikasi ini seragam.        */
async function unduhTabel(judul, kolom, data, subjudul) {
  if (!data.length) return toast('Tidak ada data untuk diunduh.', true);
  await jalankan('Menyiapkan berkas…', async () => {
    const ExcelJS = await muatExcelJS();
    const wb = new ExcelJS.Workbook();
    const nama = judul.replace(/_/g, ' ');
    const ws = wb.addWorksheet(nama.slice(0, 31), {
      pageSetup: { orientation: kolom.length > 6 ? 'landscape' : 'portrait',
                   fitToPage: true, fitToWidth: 1, fitToHeight: 0,
                   margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
    });
    const kolomAkhir = kolom.length + 1;   // + kolom nomor

    ws.columns = [{ width: 5 }, ...kolom.map(([judulKolom]) =>
      ({ width: Math.min(34, Math.max(judulKolom.length <= 4 ? 6 : 12, judulKolom.length + 4,
        ...data.slice(0, 200).map(d => String(d[kolom.find(k => k[0] === judulKolom)[1]] ?? '').length + 2))) }))];

    let r = await kopExcel(wb, ws, nama, subjudul ||
      `Tahun Pelajaran ${sesi.ta}  ·  ${data.length} baris`, kolomAkhir);
    const barisJudulKolom = r;
    const judulBaris = ws.getRow(r);
    ['No.', ...kolom.map(k => k[0])].forEach((t, i) => {
      const c = judulBaris.getCell(i + 1);
      c.value = t;
      c.font = { bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                   left: { style: 'thin' }, right: { style: 'thin' } };
    });
    judulBaris.height = 24;
    r++;

    data.forEach((d, i) => {
      const br = ws.getRow(r);
      br.getCell(1).value = i + 1;
      br.getCell(1).alignment = { horizontal: 'center' };
      kolom.forEach((k, n) => {
        const v = d[k[1]];
        br.getCell(n + 2).value = (v === null || v === undefined) ? '' : v;
      });
      br.eachCell(c => {
        c.font = { size: 10 };
        c.border = { top: { style: 'hair', color: { argb: 'FFD6DEDC' } },
                     bottom: { style: 'hair', color: { argb: 'FFD6DEDC' } },
                     left: { style: 'hair', color: { argb: 'FFD6DEDC' } },
                     right: { style: 'hair', color: { argb: 'FFD6DEDC' } } };
        c.alignment = Object.assign({ vertical: 'middle' }, c.alignment || {});
      });
      if (i % 2) br.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF9' } };
      });
      r++;
    });

    ws.views = [{ state: 'frozen', ySplit: barisJudulKolom }];
    ws.autoFilter = { from: { row: barisJudulKolom, column: 1 },
                      to: { row: r - 1, column: kolomAkhir } };

    r = kakiExcel(ws, r + 1, kolomAkhir);
    ttdExcel(ws, r + 2, kolomAkhir);

    const buf = await wb.xlsx.writeBuffer();
    unduhBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
              `${judul}_${stempel()}.xlsx`);
    toast(`${data.length} baris diunduh`);
  });
}

/* Cadangan sengaja TIDAK diberi kop. Berkas ini dipakai untuk memuat
   ulang data lewat Table Editor, dan kop akan menggeser baris judul
   kolom sehingga impornya gagal. Sebagai gantinya ditambahkan satu
   lembar identitas, supaya tetap jelas berkas ini milik siapa dan
   kapan dibuat.                                                      */
function unduhCadangan() {
  if (typeof XLSX === 'undefined') return toast('Pembuat Excel belum termuat. Coba muat ulang halaman.', true);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['CADANGAN DATA INDUK'],
    ['Sekolah', SEKOLAH.nama],
    ['Alamat', SEKOLAH.alamat || ''],
    ['NPSN', SEKOLAH.npsn || ''],
    ['Tahun ajaran', sesi.ta],
    ['Dibuat', new Date().toLocaleString('id-ID')],
    ['Oleh', sesi.petugas || '-'],
    [],
    ['Berkas ini sengaja tanpa kop agar tiap lembarnya bisa diimpor'],
    ['kembali lewat Table Editor: baris pertama harus judul kolom.']
  ]), 'Identitas');
  const tambah = (nama, kolom, data) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(keAOA(kolom, data)), nama);
  tambah('Siswa', kolomSiswa(), D.siswa);
  tambah('Guru', kolomGuru(), D.guru);
  tambah('Rombel', [['Kode', 'kode'], ['Tingkat', 'tingkat'], ['Tahun Ajaran', 'tahun_ajaran']], D.rombel);
  tambah('Tugas', [['Guru', 'namaGuru'], ['ID Guru', 'guru_id'], ['Jenis', 'jenis'], ['Kelas', 'kelas'],
                   ['Jabatan', 'jabatan'], ['Jam tambahan mengajar', 'jam_tambahan_mengajar'],
                   ['Jam piket unit', 'jam_piket_unit'], ['Mulai', 'mulai'], ['Aktif', 'aktif'],
                   ['Tahun Ajaran', 'tahun_ajaran']],
         D.tugas.map(t => ({ ...t, namaGuru: namaGuru(t.guru_id), kelas: kodeRombel(t.rombel_id) })));
  tambah('Mapel', [['Nama', 'nama'], ['Kelompok', 'kelompok'], ['Aktif', 'aktif']], D.mapel);
  tambah('TahunAjaran', [['Kode', 'kode'], ['Mulai', 'mulai'], ['Selesai', 'selesai'], ['Aktif', 'aktif']], D.tahun);
  XLSX.writeFile(wb, `Cadangan_Data_Induk_SMAPM_${stempel()}.xlsx`);
  toast('Cadangan diunduh');
}

/* ------------------------------------------------------ jaring galat
   Tanpa ini, galat apa pun saat pemuatan membuat layar kosong tanpa
   keterangan — dan penyebabnya hanya terlihat di Console peramban.
   Dengan ini, pesannya tampil di layar apa adanya.                   */
function layarGalat(e, dimana) {
  const pesan = (e && (e.message || e.error || e)) + '';
  const tumpukan = e && e.stack ? String(e.stack).split('\n').slice(0, 4).join('\n') : '';
  const el = document.getElementById('layar') || document.body;
  el.innerHTML =
    '<div style="max-width:640px;margin:48px auto;padding:22px;background:#fff;' +
    'border:1px solid #E3C9C7;border-radius:10px;font-family:system-ui,sans-serif">' +
    '<h1 style="font-size:17px;margin:0 0 10px;color:#A32F2A">Aplikasi gagal dimuat</h1>' +
    '<p style="font-size:13.5px;color:#48606A;margin:0 0 14px">Terjadi saat: ' + esc(dimana) + '</p>' +
    '<pre style="background:#F7FAF9;border:1px solid #D6DEDC;border-radius:8px;padding:12px;' +
    'font-size:12.5px;white-space:pre-wrap;color:#12262E">' + esc(pesan) + '</pre>' +
    (tumpukan ? '<pre style="font-size:11.5px;color:#7A8E96;white-space:pre-wrap">' + esc(tumpukan) + '</pre>' : '') +
    '<p style="font-size:13px;color:#48606A;margin:14px 0 0">Kirimkan pesan di atas apa adanya. ' +
    'Bila baru saja mengganti berkas, coba muat ulang paksa dengan Ctrl+Shift+R.</p></div>';
}

window.addEventListener('error', ev => layarGalat(ev.error || ev, 'pemuatan halaman'));
window.addEventListener('unhandledrejection', ev => layarGalat(ev.reason, 'pengambilan data'));

/* ------------------------------------------------------------- mulai */
(async function () {
  try {
    if (MODE === 'db') { layarMasuk(); return; }
    await muatSemua();
    layarUtama();
  } catch (e) {
    layarGalat(e, MODE === 'db' ? 'menyiapkan layar masuk' : 'menyiapkan mode contoh');
  }
})();
