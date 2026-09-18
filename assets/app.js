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
  + 'no_sertifikat_pendidik,mapel_utama,no_hp,email,catatan';
const PTK = ['Guru Tetap Yayasan','Guru Tidak Tetap','Tenaga Kependidikan','Pimpinan'];
const STATUS_SISWA = ['aktif', 'pindah', 'keluar', 'lulus'];
const STATUS_GURU  = ['Aktif', 'Cuti', 'Nonaktif'];

let sesi = { token: '', petugas: '', ta: '2026/2027' };
let D = { siswa: [], guru: [], rombel: [], mapel: [], tugas: [], tahun: [], jabatan: [],
          jenis: [], piket: [], komponen: [],
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
    ambil('guru', 'select=' + KOLOM_GURU + '&order=nama'),
    ambil('rombel', `select=id,kode,tingkat,tahun_ajaran&tahun_ajaran=eq.${enc(sesi.ta)}&order=kode`),
    ambil('kg_mapel', 'select=id,nama_mapel,rumpun_mapel&order=nama_mapel'),
    ambilSemua('guru_tugas', `select=id,guru_id,jenis,rombel_id,jabatan,jam_tambahan_mengajar,jam_piket_unit,keterangan,mulai,selesai,aktif,tahun_ajaran&tahun_ajaran=eq.${enc(sesi.ta)}`),
    ambil('jabatan', 'select=nama,kategori,aktif&order=urutan'),
    ambil('jenis_tugas', 'select=nama,perlu_rombel,perlu_jabatan,piket_sekolah,piket_libur,tambah_jam_mengajar,jam_unit,hak_transport,penjelasan&order=urutan&aktif=is.true')
  ]);
  D.guru = guru || []; D.rombel = rombel || [];

  // Piket dan komponen honor dibaca dari view, bukan disimpulkan sendiri.
  // Sumber kebenaran piket adalah jadwal kg_piket milik aplikasi
  // Kehadiran Guru, jadi halaman ini hanya menampilkan.
  try {
    [D.piket, D.komponen] = await Promise.all([
      ambil('v_guru_piket', 'select=*'),
      ambilSemua('v_komponen_guru', 'select=*')
    ]);
    try { D.piketJadwal = await ambilSemua('v_jadwal_piket', 'select=*'); }
    catch (e) { D.piketJadwal = []; console.warn('v_jadwal_piket belum ada:', e.message); }
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
      ambil('kg_jam_pelajaran', 'select=*&order=jam_ke')
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
  D.guru = [
    ['G001','1','Dra. Siti Aminah, M.Pd.','Matematika','Guru Tetap Yayasan','P'],
    ['G002','2','Ahmad Fauzi, S.Pd.','PJOK','Guru Tidak Tetap','L'],
    ['G003','3','Devy Resmisari, S.Pd.','Sejarah','Guru Tetap Yayasan','P'],
    ['G004','4','Rina Sulastri, S.Si.','Kimia','Guru Tetap Yayasan','P']
  ].map(([id, nig, nama, mapel, ptk, jk]) =>
    ({ id, nig, nama, mapel_utama: mapel, jenis_ptk: ptk, jenis_kelamin: jk,
       status_aktif: 'Aktif', tmt_sekolah: '2018-07-16', tmt_guru: '2016-07-18',
       nip: '', nuptk: '', pendidikan_terakhir: 'S1', jurusan: '', linier: true,
       no_sertifikat_pendidik: '', no_hp: '', email: '', catatan: '' }));

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
      penjelasan:'Dicatat juga di aplikasi Absensi Ekskul.' }
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
    unduhAbsenXlsx('Daftar Hadir Tatap Muka',
      { labelKelas: 'Kelas', labelGuru: 'Wali Kelas', nilaiGuru: '' },
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
    nilai: { ...g, linier: g.linier === true ? 'ya' : g.linier === false ? 'tidak' : '' },
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
      D.guru.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
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
  const data = D.tugas
    .filter(t => !ui.jenisTugas || t.jenis === ui.jenisTugas)
    .filter(t => !ui.guruTugas || t.guru_id === ui.guruTugas)
    .sort((a, b) => (a.jenis || '').localeCompare(b.jenis || '')
                 || namaGuru(a.guru_id).localeCompare(namaGuru(b.guru_id), 'id'));

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
              ${t.aktif ? '<button class="btn btn-sm bSelesai">Akhiri</button>' : ''}</td></tr>`;
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

function akhiriTugas(t) {
  konfirmasi({
    judul: 'Akhiri tugas', bahaya: false, tombol: 'Akhiri',
    pesan: `Tugas <b>${esc(t.jenis)}</b> untuk <b>${esc(namaGuru(t.guru_id))}</b> ditandai selesai.
            Datanya tetap tersimpan sebagai riwayat, tidak dihapus.`,
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

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Matriks Jadwal Piket</h1>
      <p>Siapa berjaga pada hari dan jam mana. Jam yang kosong tidak ada petugasnya.</p></div>
      <div class="sp"></div>
      <button class="btn" id="bUnduhPiket">Unduh (xlsx)</button></div>

    <div class="bar">
      <button class="chip" data-tab="ringkasan">Ringkasan</button>
      <button class="chip on" data-tab="matriks">Matriks jadwal piket</button>
    </div>

    ${!data.length ? `<div class="panel"><div class="empty"><b>Belum ada jadwal piket terbaca</b>
      Jalankan berkas 35 lebih dulu, lalu muat ulang halaman.</div></div>` : `
    <div class="panel"><div class="scroll"><table><thead><tr>
      <th style="width:92px">Jam</th>
      ${pakai.map(h => `<th style="text-align:center">${h}</th>`).join('')}
    </tr></thead><tbody>${
      jamKe.map(j => `<tr>
        <td style="font-weight:600">Jam ${j}
          ${jamTeks(j) ? `<div class="kecil" style="font-weight:400">${esc(jamTeks(j))}</div>` : ''}</td>
        ${pakai.map(h => {
          const isi = sel(h, j);
          return `<td class="sel-piket" data-hari="${h}" data-jam="${j}"
                   style="vertical-align:top;cursor:pointer${isi.length ? '' : ';background:#F7FAF9'}">
            ${isi.map(p => `
            <div style="margin-bottom:4px">
              <div style="font-size:13px;font-weight:500">${esc(p.guru)}</div>
              <div class="kecil">${esc(p.dasar)}${p.staf ? ' · tanpa transport' : ''}</div>
            </div>`).join('') || '<div class="kecil" style="text-align:center">+</div>'}</td>`;
        }).join('')}
      </tr>`).join('')
    }</tbody></table></div>
    <div class="foot"><div class="info">${data.length} jam piket ·
      ${new Set(data.map(p => p.guru_id)).size} petugas ·
      ${pakai.length} hari</div></div></div>

    <p class="kecil">Ketuk sel untuk mengatur siapa yang berjaga pada hari dan jam itu.
      Sel berlatar abu berarti belum ada petugasnya.
      Keterangan di bawah nama menunjukkan atas dasar apa ia berjaga.</p>`}`;

  $$('[data-tab]').forEach(b => b.onclick = () => { ui.piketTab = b.dataset.tab; gambar(); });
  if ($('#bUnduhPiket')) $('#bUnduhPiket').onclick = () => unduhPiketXlsx(pakai, jamKe, sel, jamTeks);
  $$('.sel-piket').forEach(td => td.onclick = () =>
    dialogPiketSel(td.dataset.hari, +td.dataset.jam));
}

/* Mengatur petugas pada satu hari dan jam: menambah atau mengeluarkan. */
function dialogPiketSel(hari, jamKe) {
  const isi = (D.piketJadwal || []).filter(p => p.hari === hari && p.jam_ke === jamKe);
  const sudah = new Set(isi.map(p => p.guru_id));
  const calon = D.guru.filter(g => g.status_aktif === 'Aktif' && !sudah.has(g.id))
                      .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

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
        ${calon.map(g => `<option value="${esc(g.id)}">${esc(g.nama)}</option>`).join('')}
      </select>
      <div class="hint">Guru yang sudah berjaga pada jam ini tidak ditampilkan.</div></div>
    </div>
    <div class="aksi"><button class="btn" id="m-batal">Tutup</button>
      <button class="btn btn-p" id="m-tambah">Tambahkan</button></div>`);

  $('#m-batal').onclick = tutupModal;
  $$('[data-keluar]').forEach(b => b.onclick = () => {
    const id = b.dataset.keluar;
    tutupModal();
    jalankan('Menyimpan…', async () => {
      if (MODE === 'db') await buang('kg_piket', `id=eq.${enc(id)}`);
      D.piketJadwal = D.piketJadwal.filter(p => String(p.id) !== String(id));
      if (MODE === 'db') await muatSemua();
      toast('Petugas dikeluarkan');
    });
  });
  $('#m-tambah').onclick = () => {
    const guruId = $('#pTambah').value;
    if (!guruId) { $('#pTambah').focus(); return; }
    tutupModal();
    jalankan('Menyimpan…', async () => {
      if (MODE === 'contoh') { toast('Mode contoh: tidak tersimpan'); return; }
      await simpanBaru('kg_piket', {
        id: 'PK' + Date.now().toString(36).toUpperCase(),
        guru_id: guruId, hari: hari, jam_ke: jamKe });
      await muatSemua();
      toast('Petugas ditambahkan');
    });
  };
}

/* Berkas Excel berkop, memakai ExcelJS supaya logo dan penggabungan sel
   bisa dipakai — SheetJS tidak mendukung penyisipan gambar.            */
async function muatExcelJS() {
  if (window.ExcelJS) return window.ExcelJS;
  await new Promise((selesai, gagal) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    sc.onload = selesai;
    sc.onerror = () => gagal(new Error('Pembuat Excel gagal dimuat. Periksa sambungan internet.'));
    document.head.appendChild(sc);
  });
  return window.ExcelJS;
}

async function unduhPiketXlsx(hari, jamKe, sel, jamTeks) {
  await jalankan('Menyiapkan berkas…', async () => {
    const ExcelJS = await muatExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Jadwal Piket', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });
    const kolomTerakhir = hari.length + 1;

    // Lebar kolom hari mengikuti nama terpanjang yang benar-benar ada
    // pada jadwal ini, bukan angka tetap — supaya nama guru yang panjang
    // tidak pecah menjadi tiga baris.
    const semuaNama = [];
    hari.forEach(h => jamKe.forEach(j =>
      sel(h, j).forEach(p => semuaNama.push(p.guru + (p.staf ? ' (staf)' : '')))));
    const terpanjang = Math.max(18, ...semuaNama.map(n => n.length));
    const lebarHari = Math.min(34, terpanjang + 2);
    ws.columns = [{ width: 13 }, ...hari.map(() => ({ width: lebarHari }))];

    let r = await kopExcel(wb, ws, 'Jadwal Piket Meja Sekolah',
      `Tahun Pelajaran ${sesi.ta}`, kolomTerakhir);
    const judul = ws.getRow(r);
    ['Jam', ...hari].forEach((t, i) => {
      const c = judul.getCell(i + 1);
      c.value = t;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12262E' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                   left: { style: 'thin' }, right: { style: 'thin' } };
    });
    judul.height = 22;
    r++;

    jamKe.forEach(j => {
      const baris = ws.getRow(r);
      const kiri = baris.getCell(1);
      kiri.value = jamTeks(j) ? `Jam ${j}\n${jamTeks(j)}` : `Jam ${j}`;
      kiri.font = { bold: true, size: 10 };
      kiri.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      hari.forEach((h, i) => {
        const c = baris.getCell(i + 2);
        const isi = sel(h, j);
        c.value = isi.map(p => p.guru + (p.staf ? ' (staf)' : '')).join('\n');
        c.alignment = { vertical: 'middle', wrapText: true };
        c.font = { size: 10 };
        if (!isi.length) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
      });

      baris.eachCell(c => {
        c.border = { top: { style: 'thin' }, bottom: { style: 'thin' },
                     left: { style: 'thin' }, right: { style: 'thin' } };
      });
      const terbanyak = Math.max(1, ...hari.map(h => sel(h, j).length));
      baris.height = Math.max(22, terbanyak * 14);
      r++;
    });

    r = kakiExcel(ws, r + 1, kolomTerakhir);
    ttdExcel(ws, r + 2, kolomTerakhir);

    const buf = await wb.xlsx.writeBuffer();
    unduhBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
              `Jadwal_Piket_${stempel()}.xlsx`);
    toast('Jadwal piket diunduh');
  });
}

/* ---------------------------------------------------------- jadwal */
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const idJadwalBaru = () => 'JD' + Date.now().toString(36).toUpperCase();

function halJadwal() {
  const sudut = ui.jadwalSudut || 'kelas';          // 'kelas' atau 'guru'
  // Semester bawaan mengikuti isi datanya, bukan ditebak.
  const smtAda = [...new Set(D.jadwal.map(j => Number(j.semester)))].sort();
  const smt = ui.jadwalSemester || smtAda[0] || 1;
  const jamKe = D.jamPel.length ? D.jamPel.map(j => j.jam_ke)
                                : [...new Set(D.jadwal.map(j => j.jam_ke))].sort((a, b) => a - b);

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
          (a.jenis === b.jenis ? 0 : a.jenis === 'Rombel' ? -1 : 1) ||
          a.nama.localeCompare(b.nama, 'id', { numeric: true }));
      })()
    : D.guru.filter(g => g.status_aktif === 'Aktif')
            .map(g => ({ id: g.id, nama: g.nama, jenis: '' }))
            .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  const pilih = ui.jadwalPilih || (daftar[0] && daftar[0].nama) || '';
  const baris = D.jadwal.filter(j => j.semester == smt &&
    (sudut === 'kelas' ? j.kelas === pilih : j.guru === pilih));

  const sel = (hari, jam) => baris.filter(j => j.hari === hari && j.jam_ke === jam);

  // Jam yang dipakai kelompok belajar — Tahsin dan Matematika Dasar.
  // Pada tampilan per kelas, jam itu bukan milik rombel: tiap siswa
  // berangkat ke kelompoknya masing-masing. Jadi ditampilkan sebagai
  // keterangan dan tidak bisa diisi dari sini.
  const tingkatKelas = sudut === 'kelas' ? tingkatDari(pilih) : null;
  // Satu jam bisa dipakai lebih dari satu program. Seluruhnya
  // dikumpulkan, bukan dipilih salah satu — kalau hanya satu yang
  // ditampilkan, yang terbaca bergantung urutan data dan mudah
  // menyesatkan.
  const jamKelompok = new Map();
  if (sudut === 'kelas' && tingkatKelas) {
    D.jadwal.filter(j => j.semester == smt && j.jenis_kelas === 'Kelompok'
                      && (!j.tingkat || j.tingkat === tingkatKelas))
            .forEach(j => {
              const k = j.hari + '|' + j.jam_ke;
              if (!jamKelompok.has(k)) jamKelompok.set(k, new Set());
              jamKelompok.get(k).add(j.mapel);
            });
  }
  const kunci = (h, j) => {
    const v = jamKelompok.get(h + '|' + j);
    return v ? [...v].sort() : null;
  };

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Jadwal KBM</h1>
      <p>Disunting di sini; aplikasi Kehadiran Guru hanya membacanya.
         Tahun ajaran ${esc(sesi.ta)}, semester ${smt}.</p></div>
      <div class="sp"></div>
      <button class="btn" id="bUnduhJadwal">Unduh (xlsx)</button>
      <button class="btn" id="bUnduhSemua">Unduh semua kelas</button></div>

    <div class="bar">
      <button class="chip ${sudut === 'kelas' ? 'on' : ''}" data-sudut="kelas">Per kelas</button>
      <button class="chip ${sudut === 'guru' ? 'on' : ''}" data-sudut="guru">Per guru</button>
      <div style="width:12px"></div>
      <select class="field" id="fPilih" style="width:auto;min-width:220px">
        ${daftar.map(d => `<option value="${esc(d.nama)}" ${d.nama === pilih ? 'selected' : ''}>
          ${esc(d.nama)}${d.jenis === 'Kelompok' ? ' (kelompok)' : ''}</option>`).join('')}
      </select>
      <select class="field" id="fSemester" style="width:auto">
        ${(smtAda.length ? smtAda : [1, 2]).map(n =>
          `<option value="${n}" ${smt == n ? 'selected' : ''}>Semester ${n}</option>`).join('')}
      </select>
      <div class="sp" style="flex:1"></div>
      <div class="info kecil">${baris.length} jam per minggu</div>
    </div>

    ${D.galat.jadwal ? `<div class="info-box"><b>Jadwal tidak dapat dibaca.</b>
      ${esc(D.galat.jadwal)}<br>Kemungkinan berkas <code>33_jadwal_kbm.sql</code> belum dijalankan —
      tampilan ini bersandar pada view <code>v_jadwal</code> yang dibuat di sana.</div>`
     : (!D.jadwal.length ? `<div class="info-box"><b>Belum ada jadwal tersimpan.</b>
        Tabel jadwal terbaca, tetapi isinya kosong untuk tahun ajaran ${esc(sesi.ta)}.</div>`
     : (!baris.length ? `<div class="info-box">Tidak ada jam pelajaran untuk
        <b>${esc(pilih)}</b> pada semester ${smt}.
        ${smtAda.length > 1 ? 'Coba ganti semesternya.' : ''}</div>` : ''))}

    <div class="panel"><div class="scroll"><table><thead><tr>
      <th style="width:70px">Jam</th>
      ${HARI.map(h => `<th>${h}</th>`).join('')}
    </tr></thead><tbody>${
      jamKe.map(jk => {
        const jp = D.jamPel.find(x => x.jam_ke === jk);
        return `<tr>
          <td class="kecil" style="font-weight:600">${jk}
            ${jp && jp.mulai ? `<div class="kecil" style="font-weight:400">${String(jp.mulai).slice(0,5)}</div>` : ''}</td>
          ${HARI.map(h => {
            const prog = kunci(h, jk);
            if (prog) return `<td style="background:#EDF5F3;text-align:center;vertical-align:middle">
              <div style="font-size:12.5px;font-weight:500;color:var(--primary)">${esc(prog.join(' · '))}</div>
              <div class="kecil">berdasarkan kelompoknya</div></td>`;
            const isi = sel(h, jk);
            if (!isi.length) return `<td class="sel-jadwal" data-hari="${h}" data-jam="${jk}"
              style="cursor:pointer;color:var(--ink3);text-align:center">+</td>`;
            return `<td class="sel-jadwal" data-hari="${h}" data-jam="${jk}">
              ${isi.map(j => `<div data-jid="${esc(j.id)}" style="cursor:pointer;margin-bottom:3px">
                <div style="font-weight:500;font-size:13px">${esc(sudut === 'kelas' ? j.mapel : j.kelas)}</div>
                <div class="kecil">${esc(sudut === 'kelas' ? j.guru : j.mapel)}</div></div>`).join('')}
              ${isi.length > 1 ? '<div class="kecil" style="color:var(--warn)">beregu</div>' : ''}</td>`;
          }).join('')}
        </tr>`;
      }).join('')
    }</tbody></table></div></div>

    <p class="kecil">Ketuk sel kosong untuk menambah, atau ketuk isinya untuk mengubah dan menghapus.
      Satu sel boleh berisi lebih dari satu guru pada kelompok Tahsin dan Matematika Dasar —
      itu pengajaran beregu, bukan bentrokan.<br>
      Sel berwarna hijau muda adalah jam kelompok belajar: siswa kelas ini berangkat ke
      kelompoknya masing-masing, jadi tidak diisi dari jadwal kelas.
      Untuk menyusunnya, pilih kelompoknya sendiri pada daftar di atas —
      Tahsin dan MD ada di bagian bawah daftar, ditandai "(kelompok)".</p>`;

  $$('[data-sudut]').forEach(b => b.onclick = () => {
    ui.jadwalSudut = b.dataset.sudut; ui.jadwalPilih = null; gambar();
  });
  $('#fPilih').onchange = e => { ui.jadwalPilih = e.target.value; gambar(); };
  $('#fSemester').onchange = e => { ui.jadwalSemester = +e.target.value; gambar(); };
  $('#bUnduhJadwal').onclick = () => unduhJadwalXlsx([pilih], sudut, smt);
  // daftar jadwal dalam bentuk tabel, bukan matriks

  $('#bUnduhSemua').onclick = () => unduhJadwalXlsx(
    daftar.filter(d => d.jenis !== 'Kelompok').map(d => d.nama), sudut, smt);

  $('tbody').onclick = e => {
    const kotak = e.target.closest('[data-jid]');
    if (kotak) { formJadwal(D.jadwal.find(j => String(j.id) === kotak.dataset.jid)); return; }
    const td = e.target.closest('.sel-jadwal');
    if (td) formJadwal(null, td.dataset.hari, +td.dataset.jam, sudut, pilih, smt);
  };
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

    let logoId = null;
    try {
      const gbr = await fetch(SEKOLAH.logo).then(r => r.ok ? r.arrayBuffer() : Promise.reject());
      logoId = wb.addImage({ buffer: gbr, extension: 'png' });
    } catch (e) { /* tanpa logo pun berkasnya tetap terbentuk */ }

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
      if (j) await perbarui('kg_jadwal_kbm', `id=eq.${enc(j.id)}`, isi);
      else   await simpanBaru('kg_jadwal_kbm',
                { id: idJadwalBaru(), ...isi, created_at: new Date().toISOString() });
      await muatSemua();
      toast(j ? 'Jam pelajaran diperbarui' : 'Jam pelajaran ditambahkan');
    },
    hapus: j ? async () => {
      if (MODE === 'db') await buang('kg_jadwal_kbm', `id=eq.${enc(j.id)}`);
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
      <button class="linkish" id="bLihatBelum" style="color:#6B4700">Lihat daftarnya</button></div>` : ''}

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
    unduhAbsenXlsx('Daftar Hadir ' + (kel.mapel || 'Kelompok Belajar'),
      { labelKelas: 'Kelompok', labelGuru: 'Pembimbing', nilaiGuru: '' },
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
  const totJam = D.piket.reduce((a, p) => a + (p.jam_per_minggu || 0), 0);
  const dibayar = D.piket.filter(p => p.dihitung_transport);
  const belumDasar = D.piket.filter(p => p.dasar === 'belum tercatat');
  const belumIsi = D.komponen.filter(k => k.belum_diisi);

  // komponen dikelompokkan per guru
  const perGuru = new Map();
  D.komponen.forEach(k => {
    if (!perGuru.has(k.nama)) perGuru.set(k.nama, {});
    perGuru.get(k.nama)[k.komponen] = k;
  });

  if ((ui.piketTab || 'ringkasan') === 'matriks') return halPiketMatriks();

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Piket &amp; Komponen Honor</h1>
      <p>Halaman baca saja. Jadwal piket dikelola aplikasi Kehadiran Guru;
         di sini hanya ditampilkan siapa bertugas dan berapa jamnya.</p></div></div>

    <div class="bar">
      <button class="chip on" data-tab="ringkasan">Ringkasan</button>
      <button class="chip" data-tab="matriks">Matriks jadwal piket</button>
    </div>

    ${belumDasar.length ? `<div class="info-box"><b>${belumDasar.length} guru ada di jadwal piket
      tetapi belum tercatat dasar penugasannya.</b> Catatkan lewat halaman Tugas Guru — sebagai
      wali kelas, staf, atau guru yang ditugaskan piket — supaya jelas atas dasar apa ia berjaga.</div>` : ''}

    ${belumIsi.length ? `<div class="info-box"><b>${belumIsi.length} komponen honor belum ada angkanya.</b>
      Perhitungan honor tidak bisa dijalankan selama masih ada yang kosong.</div>` : ''}

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
        D.piket.length ? D.piket.slice().sort((a, b) => b.jam_per_minggu - a.jam_per_minggu)
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
            Jadwal dikelola aplikasi Kehadiran Guru.</div></td></tr>`
      }</tbody></table></div></div>

    <div class="panel"><div class="panel-head"><h3>Komponen honor wali kelas</h3>
      <div class="sp" style="flex:1"></div><div class="info">jam per minggu</div></div>
      <div class="scroll"><table><thead><tr>
        <th>Guru</th><th style="width:110px">Upacara</th>
        <th style="width:140px">Bimbingan</th><th style="width:150px">Piket</th>
      </tr></thead><tbody>${
        perGuru.size ? [...perGuru.entries()].map(([nama, k]) => {
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

  $$('[data-tab]').forEach(b => b.onclick = () => { ui.piketTab = b.dataset.tab; gambar(); });
  $$('.sel-komponen').forEach(el => el.onclick = () => {
    const x = D.komponen.find(c => String(c.tugas_id) === el.dataset.tugas
                                && c.komponen === el.dataset.komponen);
    if (x) formKomponen(x);
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
      <p>Dipakai bersama oleh data guru dan jadwal KBM. Tersimpan pada tabel <code>kg_mapel</code>.</p></div>
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
      <code>kg_jadwal_kbm</code> merujuk tabel ini. Mapel yang tidak dipakai lagi cukup dibiarkan.</p>`;

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
        await perbarui('kg_mapel', `id=eq.${enc(m.id)}`, isi);
        Object.assign(m, { nama: isi.nama_mapel, rumpun: isi.rumpun_mapel });
      } else {
        if (D.mapel.some(x => x.id === n.id.trim())) throw new Error('Kode ' + n.id + ' sudah dipakai.');
        await simpanBaru('kg_mapel', { id: n.id.trim(), ...isi });
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
  const contoh = (D.jadwal[0] || {});

  $('#isi').innerHTML = `
    <div class="head"><div><h1>Profil Dokumen</h1>
      <p>Identitas sekolah yang dipakai pada kop seluruh berkas Excel yang diunduh
         aplikasi ini — jadwal KBM, jadwal piket, rekap, dan cadangan data.</p></div>
      <div class="sp"></div>
      <button class="btn btn-p" id="bUbahProfil">Ubah profil</button></div>

    ${D.galat.profil ? `<div class="info-box"><b>Profil dokumen tidak dapat dibaca.</b>
      ${esc(D.galat.profil)}<br>Kemungkinan berkas <code>41_profil_dokumen.sql</code> belum dijalankan.
      Sementara ini kop memakai nilai bawaan yang tertulis di dalam aplikasi.</div>` : ''}

    <div class="panel"><div class="panel-head"><h3>Yang tercetak pada kop</h3></div>
      <div class="panel-body">
        <div style="border:1px solid var(--line);border-radius:8px;padding:18px;background:#fff">
          <div style="display:flex;gap:16px;align-items:flex-start">
            <div style="width:62px;height:62px;border:1px dashed var(--line);border-radius:6px;
                        display:flex;align-items:center;justify-content:center;flex:none;
                        overflow:hidden;background:#F7FAF9">
              <img src="${esc(SEKOLAH.logo)}" alt="" style="max-width:100%;max-height:100%"
                   onerror="this.style.display='none';this.parentNode.innerHTML='<span class=&quot;kecil&quot;>logo</span>'">
            </div>
            <div style="flex:1">
              <div style="font-size:17px;font-weight:600">${esc(SEKOLAH.nama || '—')}</div>
              <div class="kecil">${esc([SEKOLAH.alamat, SEKOLAH.npsn ? 'NPSN ' + SEKOLAH.npsn : '']
                                       .filter(Boolean).join('  ·  ') || '—')}</div>
            </div>
          </div>
          <div style="text-align:center;margin:16px 0 6px;border-top:2px solid var(--ink);padding-top:14px">
            <div style="font-size:15px;font-weight:600">JADWAL KEGIATAN BELAJAR MENGAJAR</div>
            <div class="kecil">Kelas 10-1 · Semester 1 · Tahun Pelajaran ${esc(sesi.ta)}</div>
          </div>
          <div style="text-align:right;margin-top:18px">
            <div class="kecil">${esc(SEKOLAH.kota || '—')}, ${new Date().toLocaleDateString('id-ID',
              { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            <div class="kecil">Kepala Sekolah,</div>
            <div style="height:34px"></div>
            <div style="font-weight:600;text-decoration:underline">${esc(SEKOLAH.kepala || '—')}</div>
            ${SEKOLAH.nip ? `<div class="kecil">NIP. ${esc(SEKOLAH.nip)}</div>` : ''}
          </div>
        </div>
        <p class="kecil" style="margin-top:10px">Tampilan di atas meniru kop berkas Excel,
          termasuk letak logo dan blok tanda tangan.</p>
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

    <p class="kecil">Logo diambil dari berkas yang disebut pada isian <b>Berkas logo</b>,
      relatif terhadap letak aplikasi — biasanya <code>assets/logo.png</code>.
      Bila berkasnya tidak ada, berkas Excel tetap terbentuk tanpa logo.</p>`;

  $('#bUbahProfil').onclick = () => formProfil();
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
/* Kop seragam untuk seluruh berkas Excel: logo di kiri, nama dan
   alamat sekolah di sebelahnya, judul di tengah. Dipakai halaman mana
   pun, sehingga identitas sekolah cukup diatur di satu tempat —
   halaman Profil Dokumen.                                            */
async function kopExcel(wb, ws, judul, subjudul, kolomAkhir) {
  try {
    const gbr = await fetch(SEKOLAH.logo).then(r => r.ok ? r.arrayBuffer() : Promise.reject());
    const id = wb.addImage({ buffer: gbr, extension: 'png' });
    ws.addImage(id, { tl: { col: 0.2, row: 0.15 }, ext: { width: 62, height: 62 } });
  } catch (e) { /* tanpa logo pun berkasnya tetap terbentuk */ }

  // Logo selebar kira-kira 9 satuan lebar kolom. Teks kop diletakkan
  // pada kolom tempat logo berakhir, lalu digeser ke dalam sejauh sisa
  // lebar logo — sehingga tulisan menempel di sebelah logo, tidak
  // melompat satu kolom penuh dan tidak pula tertimpa.
  const LEBAR_LOGO = 9;
  const daftarLebar = (ws.columns || []).map(k => (k && k.width) || 10);
  let lebarKumpul = 0, kolomTeks = 2, geser = 0;
  for (let i = 0; i < daftarLebar.length; i++) {
    const sebelum = lebarKumpul;
    lebarKumpul += daftarLebar[i];
    if (lebarKumpul >= LEBAR_LOGO) {
      kolomTeks = i + 1;
      geser = Math.max(0, Math.round(LEBAR_LOGO - sebelum));
      break;
    }
  }
  if (kolomTeks < 2) { kolomTeks = 2; geser = 0; }
  kolomTeks = Math.min(kolomTeks, Math.max(2, kolomAkhir));

  const akhirKol = Math.max(kolomTeks, kolomAkhir);
  const kiri = (r, t, u, tb) => {
    ws.mergeCells(r, kolomTeks, r, akhirKol);
    const c = ws.getCell(r, kolomTeks);
    c.value = t; c.font = { name: 'Calibri', size: u, bold: tb };
    c.alignment = { horizontal: 'left', vertical: 'middle', indent: geser };
    ws.getRow(r).height = u >= 13 ? 24 : 16;
  };
  const tengah = (r, t, u, tb) => {
    ws.mergeCells(r, 1, r, Math.max(1, kolomAkhir));
    const c = ws.getCell(r, 1);
    c.value = t; c.font = { name: 'Calibri', size: u, bold: tb };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = u >= 13 ? 26 : 18;
  };

  // Seluruh isian Profil Dokumen yang terisi ikut tercetak; yang kosong
  // dilewati sehingga tidak meninggalkan baris kosong.
  let r = 1;
  kiri(r++, SEKOLAH.nama, 14, true);

  const barisAlamat = [SEKOLAH.alamat,
                       SEKOLAH.npsn ? 'NPSN ' + SEKOLAH.npsn : '',
                       SEKOLAH.telepon ? 'Telp. ' + SEKOLAH.telepon : ''].filter(Boolean);
  if (barisAlamat.length) kiri(r++, barisAlamat.join('  ·  '), 10, false);

  const barisHubung = [SEKOLAH.email, SEKOLAH.laman].filter(Boolean);
  if (barisHubung.length) kiri(r++, barisHubung.join('  ·  '), 9.5, false);

  // Logo setinggi tiga baris; bila kopnya pendek, ditambah baris kosong
  // supaya judul tidak menabrak logo.
  while (r < 4) { ws.getRow(r).height = 8; r++; }

  tengah(r++, judul.toUpperCase(), 14, true);
  if (subjudul) tengah(r++, subjudul, 10, false);

  const garis = r - 1;
  for (let k = 1; k <= kolomAkhir; k++)
    ws.getCell(garis, k).border = { bottom: { style: 'medium', color: { argb: 'FF12262E' } } };

  return r + 1;      // baris pertama yang bebas dipakai isi
}

/* Catatan kaki dari Profil Dokumen, bila diisi. */
function kakiExcel(ws, baris, kolomAkhir) {
  if (!SEKOLAH.catatan) return baris;
  ws.mergeCells(baris, 1, baris, Math.max(1, kolomAkhir));
  const c = ws.getCell(baris, 1);
  c.value = SEKOLAH.catatan;
  c.font = { size: 9, italic: true, color: { argb: 'FF48606A' } };
  c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  return baris + 1;
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
