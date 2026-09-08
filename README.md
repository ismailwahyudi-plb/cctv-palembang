# CCTV Palembang — Prototype V2 (dengan Login Akun)

Prototype mobile-first untuk menampilkan HLS CCTV Palembang dari file `.m3u8`,
kini dilindungi **halaman masuk akun** dengan fitur **daftar akun sendiri**
(email aktif + kata sandi) sebelum masuk ke dashboard.

> **Status backend auth:** `local` (prototipe). Akun & sesi tersimpan di
> `localStorage` perangkat — bukan produksi. Kode sudah diarsitekturkan agar
> mudah dimigrasi ke **Supabase** (lihat bagian Migrasi di bawah).

## Alur Aplikasi

```
index.html (Masuk / Daftar)  ──sukses login──▶  dashboard.html (150 CCTV)
      ▲                                             │
      └────────── belum login / logout ◀────────────┘
```

- `index.html` → halaman **Masuk** dan **Daftar Akun** (email + kata sandi ≥ 8
  karakter + konfirmasi kata sandi). Akun baru otomatis aktif di mode demo.
- `dashboard.html` → dashboard CCTV (grid, pencarian, pager, favorit).
  Hanya bisa diakses setelah login; header menampilkan email akun + tombol
  **Keluar**.
- `session-guard.js` → pengarah: belum login dibawa ke halaman masuk; sudah
  login tidak bisa membuka halaman masuk lagi.
- **Favorit kini per-akun** (disimpan dengan kunci ber-akhiran `userId`), bukan
  satu daftar global di browser.

## Menjalankan

Jangan double-click `index.html` — auth & HLS butuh web server (Web Crypto
SHA-256 juga hanya aktif di `localhost`/`https`).

### VS Code
1. Buka folder ini di VS Code.
2. Install extension **Live Server** bila belum ada.
3. Klik kanan `index.html` -> **Open with Live Server**.

### Python
```bash
python -m http.server 8080
```
Lalu buka `http://localhost:8080`.

## Struktur File

| File | Peran |
|---|---|
| `index.html` | Halaman masuk / daftar akun. |
| `dashboard.html` | Dashboard CCTV (konten lama index.html). |
| `auth.css` | Tampilan halaman masuk/daftar (tema gelap). |
| `style.css` | Tampilan dashboard. |
| `config.js` | **Konfigurasi terpusat** — ubah di sini saat migrasi ke Supabase. |
| `auth.js` | `AuthService`: API meniru supabase-js → `signUp / signIn / signOut / getSession / getCurrentUser / onAuthStateChange`. |
| `auth-page.js` | Logika UI halaman masuk/daftar. |
| `session-guard.js` | Redirect antar halaman sesuai status login. |
| `app.js` | Logika dashboard CCTV + info akun + tombol keluar. |

### Catatan keamanan mode demo
- Password **tidak pernah disimpan mentah**: di-hash SHA-256 + salt unik
  (fallback hash ringan bila dibuka lewat HTTP IP non-localhost).
- Mode demo **bukan produksi**: localStorage bisa dibaca/dihapus pengguna dan
  hanya ada di satu perangkat. Untuk verifikasi "email aktif" yang sungguhan,
  gunakan Supabase (email confirmation).

## Migrasi ke Supabase (langkah-langkah)

1. **Buat project** di [supabase.com](https://supabase.com) (bebas/kuota kecil
   cukup) lalu buka **Authentication → Providers → Email** dan aktifkan
   **Confirm email** agar akun harus diaktivasi lewat email.
2. Salin **Project URL** dan **anon public key** dari
   *Project Settings → API* ke `config.js` → objek `SUPABASE`.
3. Ubah `AUTH_BACKEND` di `config.js` dari `"local"` menjadi `"supabase"`.
4. Muat `@supabase/supabase-js` lewat CDN di `index.html` dan `dashboard.html`
   **sebelum** `auth.js`:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ```
5. Salin `auth.js` ke `auth-supabase.js` lalu ganti isi tiap method dengan
   panggilan supabase-js (panduan ada di komentar paling atas `auth.js`):
   `signUp`, `signInWithPassword`, `signOut`, `getSession`.
   `onAuthStateChange` sudah tersedia di supabase-js.
6. **Atur URL redirect** di *Authentication → URL Configuration*: masukkan
   alamat saat aplikasi dijalankan (mis. `http://localhost:8080`) agar tautan
   verifikasi/reset email mengarah balik dengan benar.
7. **Buat tabel `favorites`** untuk sinkronisasi favorit antar perangkat:
   - Kolom: `user_id uuid references auth.users(id)`, `camera_id int`,
     `created_at timestamptz`, primary key `(user_id, camera_id)`.
   - Aktifkan **RLS** dan buat policy:
     ```sql
     create policy "favorites milik sendiri" on favorites
       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
     ```
   - Ganti isi `FavoritesStore` di `app.js` (load/save) dengan query tabel
     tersebut — pemakaian lain tidak berubah.

## Catatan Penting: CORS

hls.js mensyaratkan seluruh resource HLS (manifest dan segmen video) dikirim
dengan header CORS yang mengizinkan request dari origin web dashboard. Jika
stream gagal dengan error network/CORS, solusi production yang disarankan
adalah reverse proxy pada backend/domain dashboard.

## Daftar kamera

Dashboard membuat 150 entri otomatis dari cam1 sampai cam150. Nama untuk kamera
yang terdaftar di data resmi (`cctv-Palembang.json` dari palembang.go.id)
diambil dari objek `cctvTitles` di `app.js` (mis. cam42 = "CCTV SP BOM BARU").
Kamera yang tidak tercantum memakai nama default `Camera NN`.

Catatan: demi performa mobile, stream tidak dijalankan bersamaan. Stream baru
dimuat saat kartu video diklik/diputar.
