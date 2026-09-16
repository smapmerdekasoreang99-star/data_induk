
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

const MODE = (KONFIG.url && KONFIG.anonKey) ? 'db' : 'contoh';

/* Kolom tabel guru yang sebenarnya di database sekolah. */
const KOLOM_GURU = 'id,nig,nama,nip,nuptk,jenis_kelamin,jenis_ptk,status_aktif,'
  + 'tmt_sekolah,tmt_guru,tmt_status,pendidikan_terakhir,jurusan,linier,'
  + 'no_sertifikat_pendidik,mapel_utama,no_hp,email,catatan';
const PTK = ['Guru Tetap Yayasan','Guru Tidak Tetap','Tenaga Kependidikan','Pimpinan'];
const STATUS_SISWA = ['aktif', 'pindah', 'keluar', 'lulus'];
const STATUS_GURU  = ['Aktif', 'Cuti', 'Nonaktif'];

let sesi = { token: '', petugas: '', ta: '2026/2027' };
let D = { siswa: [], guru: [], rombel: [], mapel: [], tugas: [], tahun: [], jabatan: [], jenis: [] };
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

  const tahun = await ambil('tahun_ajaran', 'select=kode,mulai,selesai,aktif&order=kode.desc');
  D.tahun = tahun || [];
  const aktif = D.tahun.find(t => t.aktif);
  if (aktif) sesi.ta = aktif.kode;

  const [guru, rombel, mapel, tugas, jabatan, jenis] = await Promise.all([
    ambil('guru', 'select=' + KOLOM_GURU + '&order=nama'),
    ambil('rombel', `select=id,kode,tingkat,tahun_ajaran&tahun_ajaran=eq.${enc(sesi.ta)}&order=kode`),
    ambil('kg_mapel', 'select=id,nama_mapel,rumpun_mapel&order=nama_mapel'),
    ambil('guru_tugas', `select=id,guru_id,jenis,rombel_id,jabatan,jam_tambahan_mengajar,jam_piket_unit,keterangan,mulai,selesai,aktif,tahun_ajaran&tahun_ajaran=eq.${enc(sesi.ta)}`),
    ambil('jabatan', 'select=nama,kategori,aktif&order=urutan'),
    ambil('jenis_tugas', 'select=nama,perlu_rombel,perlu_jabatan,piket_sekolah,piket_libur,tambah_jam_mengajar,jam_unit,hak_transport,penjelasan&order=urutan&aktif=is.true')
  ]);
  D.guru = guru || []; D.rombel = rombel || [];
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
function formulir({ judul, kolom, nilai = {}, simpan, lebar, catatan }) {
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
    <div class="aksi"><button class="btn" id="m-batal">Batal</button>
    <button class="btn btn-p" id="m-simpan">Simpan</button></div>`, lebar);
  pasang();
  $('#m-batal').onclick = tutupModal;
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
     kelas: halKelas, mapel: halMapel, jabatan: halJabatan, tahun: halTahun }[halaman] || halBeranda)();
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
      <button class="btn" id="bUnduh">Unduh</button></div>
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
  $('#bUnduh').onclick = () => unduhTabel('Siswa', kolomSiswa(), siswaTersaring());
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
      <button class="btn" id="bUnduh">Unduh</button></div>
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
          <td>${tugasGuru(g.id).map(t => `<span class="tag tag-l">${esc(t.jenis)}${t.jabatan ? ' · ' + esc(t.jabatan) : (t.rombel_ref && t.rombel_ref !== '-' ? ' · ' + esc(t.rombel_ref) : '')}</span>`).join(' ') || '<span class="kecil">—</span>'}</td>
          <td class="act"><button class="btn btn-sm bUbah">Ubah</button>
            <button class="btn btn-sm bTugas">Tugas</button></td></tr>`).join('')
        : `<tr><td colspan="7"><div class="empty"><b>Tidak ada guru yang cocok</b>Ubah pencarian atau saringan.</div></td></tr>`
      }</tbody></table></div></div>`;

  $('#q').oninput = e => { clearTimeout(window._qg); window._qg = setTimeout(() => { ui.qGuru = e.target.value; gambar(); }, 200); };
  $('#fStatus').onchange = e => { ui.statusGuru = e.target.value; gambar(); };
  $('#bTambah').onclick = () => formGuru(null);
  $('#bUnggah').onclick = () => pilihBerkas(m => imporGuru(m));
  $('#bUnduh').onclick = () => unduhTabel('Guru', kolomGuru(), D.guru);
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

  const piket = new Set(D.tugas.filter(t => t.aktif && sifat(t.jenis, 'piket_sekolah')).map(t => t.guru_id));
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
      <div class="kartu"><b>${piket.size}</b><span>berkewajiban piket meja sekolah</span></div>
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
        hint: 'Satu kelas satu wali, dan satu guru hanya boleh menjadi wali satu kelas.' },

      { k: 'jabatan', label: 'Jabatan / unit', tipe: 'pilih', wajib: true,
        bila: n => sifat(n.jenis, 'perlu_jabatan'),
        opsi: [{ v: '', t: '— pilih jabatan —' },
               ...D.jabatan.filter(j => j.aktif !== false).map(j => ({ v: j.nama, t: `${j.nama} (${j.kategori})` }))],
        hint: 'Belum ada di daftar? Tambahkan lebih dulu lewat halaman Jabatan.' },

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

/* ------------------------------------------------------------ kelas */
function halKelas() {
  const jml = kode => D.siswa.filter(s => s.kelas === kode && s.status === 'aktif').length;
  const wali = kode => {
    const t = D.tugas.find(x => x.jenis === 'Wali Kelas' && x.aktif && x.rombel_ref === kode);
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
        const d = await simpanBaru('kg_mapel', { id: n.id.trim(), ...isi });
        D.mapel.push({ id: d[0].id, nama: d[0].nama_mapel, rumpun: d[0].rumpun_mapel });
      }
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
          <td class="act"><button class="btn btn-sm bUbah">Ubah</button></td></tr>`).join('')
        || `<tr><td colspan="5"><div class="empty"><b>Belum ada jabatan</b></div></td></tr>`
      }</tbody></table></div></div>`;

  $('#bTambah').onclick = () => formJabatan(null);
  $('tbody').onclick = e => {
    const tr = e.target.closest('tr[data-nama]'); if (!tr) return;
    if (e.target.classList.contains('bUbah')) formJabatan(D.jabatan.find(x => x.nama === tr.dataset.nama));
  };
}

function formJabatan(j) {
  formulir({
    judul: j ? 'Ubah jabatan' : 'Tambah jabatan',
    nilai: j ? { ...j, aktif: String(j.aktif !== false) } : { kategori: 'Unit', aktif: 'true' },
    kolom: [
      { k: 'nama', label: 'Nama jabatan atau unit', wajib: true,
        hint: j ? 'Mengubah nama ikut memperbarui tugas yang memakainya.' : 'Contoh: Penanggung Jawab Laboratorium IPA' },
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
        const d = await simpanBaru('jabatan', isi);
        D.jabatan.push(d[0]);
      }
      toast('Tersimpan');
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

function imporSiswa(matrix, namaBerkas) {
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
                          ['Jenis Kelamin', 'jk'], ['Tanggal Lahir', 'tgl'], ['Status', 'status']];
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
function unduhTabel(judul, kolom, data) {
  if (!data.length) return toast('Tidak ada data untuk diunduh.', true);
  if (typeof XLSX === 'undefined') {
    const csv = '\uFEFF' + keAOA(kolom, data).map(r => r.map(v => /[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(';')).join('\r\n');
    return unduhBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${judul}_${stempel()}.csv`);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(keAOA(kolom, data)), judul);
  XLSX.writeFile(wb, `${judul}_SMAPM_${stempel()}.xlsx`);
  toast(`${data.length} baris diunduh`);
}
function unduhCadangan() {
  if (typeof XLSX === 'undefined') return toast('Pembuat Excel belum termuat. Coba muat ulang halaman.', true);
  const wb = XLSX.utils.book_new();
  const tambah = (nama, kolom, data) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(keAOA(kolom, data)), nama);
  tambah('Siswa', kolomSiswa(), D.siswa);
  tambah('Guru', kolomGuru(), D.guru);
  tambah('Rombel', [['Kode', 'kode'], ['Tingkat', 'tingkat'], ['Tahun Ajaran', 'tahun_ajaran']], D.rombel);
  tambah('Tugas', [['Guru', 'namaGuru'], ['ID Guru', 'guru_id'], ['Jenis', 'jenis'], ['Kelas', 'rombel_ref'],
                   ['Jabatan', 'jabatan'], ['Mulai', 'mulai'], ['Aktif', 'aktif'], ['Tahun Ajaran', 'tahun_ajaran']],
         D.tugas.map(t => ({ ...t, namaGuru: namaGuru(t.guru_id) })));
  tambah('Mapel', [['Nama', 'nama'], ['Kelompok', 'kelompok'], ['Aktif', 'aktif']], D.mapel);
  tambah('TahunAjaran', [['Kode', 'kode'], ['Mulai', 'mulai'], ['Selesai', 'selesai'], ['Aktif', 'aktif']], D.tahun);
  XLSX.writeFile(wb, `Cadangan_Data_Induk_SMAPM_${stempel()}.xlsx`);
  toast('Cadangan diunduh');
}

/* ------------------------------------------------------------- mulai */
(async function () {
  if (MODE === 'db') { layarMasuk(); return; }
  await muatSemua();
  layarUtama();
})();
