// ============================================================
// config.js — Konfigurasi terpusat aplikasi.
// Satu-satunya file yang perlu diubah saat migrasi ke Supabase.
// ============================================================

const AppConfig = {
  // ----------------------------------------------------------
  // PILIH BACKEND AUTH
  //   "local"     -> prototipe. Akun tersimpan di localStorage
  //                  perangkat (mode demo, bukan produksi).
  //   "supabase"  -> (migrasi nanti) memakai @supabase/supabase-js.
  // ----------------------------------------------------------
  AUTH_BACKEND: "local",

  APP_NAME: "CCTV Palembang",

  // Halaman aplikasi (dipakai untuk redirect antar halaman).
  PAGES: {
    login: "index.html",
    dashboard: "dashboard.html",
  },

  // ----------------------------------------------------------
  // KREDENSIAL SUPABASE — untuk MIGRASI nanti.
  // Isi dari dashboard supabase.com -> Project Settings -> API:
  //   url      = Project URL
  //   anonKey  = anon public key
  // lalu ubah AUTH_BACKEND menjadi "supabase".
  // Catatan: anon key bersifat publik. Keamanan data dijaga
  // oleh Row Level Security (RLS), bukan oleh kerahasiaan key.
  // ----------------------------------------------------------
  SUPABASE: {
    url: "https://XXXXX.supabase.co",
    anonKey: "Paste_anon_public_key_di_sini",
  },

  // Seluruh key penyimpanan dipusatkan agar mudah ditemukan
  // saat diganti menjadi tabel/query di Supabase.
  STORAGE_KEYS: {
    users: "cctvAuthUsers", // "tabel" akun versi lokal
    session: "cctvAuthSession", // sesi aktif
    favorites: "cctvFavorites", // favorit per akun (dengan akhiran userId)
  },

  // Aturan kata sandi mengikuti default Supabase Auth.
  PASSWORD_MIN_LENGTH: 8,
};
