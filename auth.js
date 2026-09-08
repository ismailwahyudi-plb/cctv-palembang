// ============================================================
// auth.js — AuthService (lapisan auth yang bisa ditukar).
//
// API sengaja meniru @supabase/supabase-js agar halaman tidak
// perlu diubah saat backend diganti. Setiap method mengembalikan
// Promise { data, error } (nilai null pada sisi yang kosong).
//
// Saat ini AUTH_BACKEND = "local": akun & sesi tersimpan di
// localStorage perangkat untuk keperluan prototipe.
//
// >>> CARA MIGRASI KE SUPABASE <<<
// 1. Salin file ini -> auth-supabase.js
// 2. Ganti isi tiap method dengan panggilan supabase-js:
//      signUp   -> supabase.auth.signUp({ email, password })
//      signIn   -> supabase.auth.signInWithPassword({ email, password })
//      signOut  -> supabase.auth.signOut()
//      getSession -> supabase.auth.getSession()
//    (onAuthStateChange sudah tersedia langsung di supabase-js)
// 3. Ubah AUTH_BACKEND di config.js -> "supabase" dan muat
//    script supabase-js (CDN) sebelum auth.js pada tiap halaman.
// ============================================================

(function () {
  "use strict";

  var KEYS = AppConfig.STORAGE_KEYS;
  var MIN_PASSWORD = AppConfig.PASSWORD_MIN_LENGTH || 8;

  // ------------------------------------------------------------
  // Helper kecil
  // ------------------------------------------------------------

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // Key akun dinormalisasi: huruf kecil + trim (email unik case-insensitive).
  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function uid() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Fallback sederhana untuk browser lama.
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function salt() {
    if (window.crypto && crypto.getRandomValues) {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Hash SHA-256 bila tersedia (secure context: localhost/https).
  // Fallback FNV-1a bila diakses via http IP LAN (non-secure context) —
  // prototipe saja, JANGAN dipakai untuk produksi.
  async function hashPassword(password, saltValue) {
    var text = saltValue + "::" + password;

    if (window.crypto && crypto.subtle) {
      var buffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
      );
      return Array.from(new Uint8Array(buffer), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    }

    var h1 = 0x811c9dc5;
    var h2 = 0x01000193;
    for (var i = 0; i < text.length; i++) {
      h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 ^ text.charCodeAt(i), 0x01000193) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }

  function error(message, code) {
    return { message: message || "Terjadi kesalahan.", code: code || "unknown" };
  }

  // ------------------------------------------------------------
  // "Tabel users" versi localStorage
  // Bentuk record sengaja menyerupai baris `auth.users` Supabase
  // (id, email, email_confirmed_at, created_at).
  // ------------------------------------------------------------

  function readUsers() {
    return readJSON(KEYS.users, {});
  }

  function writeUsers(map) {
    writeJSON(KEYS.users, map);
  }

  function findUserByEmail(email) {
    return readUsers()[normalizeEmail(email)] || null;
  }

  function findUserById(id) {
    var map = readUsers();
    for (var key in map) {
      if (Object.prototype.hasOwnProperty.call(map, key) && map[key].id === id) {
        return map[key];
      }
    }
    return null;
  }

  // ------------------------------------------------------------
  // Sesi aktif (mengikuti bentuk sesi supabase-js: { user })
  // ------------------------------------------------------------

  function readSession() {
    var session = readJSON(KEYS.session, null);
    if (!session || !session.user || !session.user.id) return null;

    // Validasi: pastikan akunnya masih ada di penyimpanan lokal.
    if (!findUserById(session.user.id)) {
      localStorage.removeItem(KEYS.session);
      return null;
    }
    return session;
  }

  function saveSession(user) {
    var session = {
      access_token: "demo-token", // prototipe; di Supabase token ini JWT asli
      user: {
        id: user.id,
        email: user.email,
      },
      created_at: new Date().toISOString(),
    };
    writeJSON(KEYS.session, session);
    notifyListeners("SIGNED_IN", session);
    return session;
  }

  // ------------------------------------------------------------
  // Listener sederhana (paritas onAuthStateChange supabase-js)
  // ------------------------------------------------------------

  var listeners = [];

  function notifyListeners(eventName, session) {
    listeners.forEach(function (entry) {
      try {
        entry(eventName, session);
      } catch (_) {}
    });
  }

  // ------------------------------------------------------------
  // AuthService
  // ------------------------------------------------------------

  window.AuthService = {
    /**
     * Mendaftarkan akun baru.
     * @param {string} params.email
     * @param {string} params.password
     * @returns {Promise<{data: {user}, error: null} | {data: null, error}>}
     *
     * Catatan migrasi Supabase: bila "Confirm email" aktif, akun baru
     * TIDAK otomatis login dan `email_confirmed_at` tetap null sampai
     * pengguna mengeklik tautan verifikasi dari emailnya. Di mode demo
     * lokal ini, aktivasi dianggap langsung (email_confirmed_at diisi).
     */
    async signUp(params) {
      if (AppConfig.AUTH_BACKEND === "supabase") {
        return this._supabaseNotReady();
      }

      var email = normalizeEmail(params.email);
      var password = String(params.password || "");

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { data: null, error: error("Masukkan alamat email yang valid.", "invalid_email") };
      }
      if (password.length < MIN_PASSWORD) {
        return { data: null, error: error("Kata sandi minimal " + MIN_PASSWORD + " karakter.", "weak_password") };
      }
      if (findUserByEmail(email)) {
        return { data: null, error: error("Akun dengan email ini sudah terdaftar. Silakan masuk.", "user_already_exists") };
      }

      var now = new Date().toISOString();
      var accountSalt = salt(); // dibuat sekali agar hash & record cocok
      var user = {
        id: uid(),
        email: email,
        email_confirmed_at: now, // demo: aktivasi langsung (tanpa email sungguhan)
        created_at: now,
      };

      var map = readUsers();
      map[email] = {
        id: user.id,
        email: user.email,
        salt: accountSalt,
        // Jangan pernah menyimpan password mentah, bahkan pada prototipe.
        password_hash: await hashPassword(password, accountSalt),
        email_confirmed_at: now,
        created_at: now,
      };
      writeUsers(map);

      return { data: { user: user }, error: null };
    },

    /**
     * Login dengan email + kata sandi.
     * @returns {Promise<{data: {session}, error: null} | {data: null, error}>}
     */
    async signIn(params) {
      if (AppConfig.AUTH_BACKEND === "supabase") {
        return this._supabaseNotReady();
      }

      var email = normalizeEmail(params.email);
      var password = String(params.password || "");

      var record = findUserByEmail(email);
      if (!record) {
        return { data: null, error: error("Email atau kata sandi salah.", "invalid_credentials") };
      }

      var attempt = await hashPassword(password, record.salt);
      if (attempt !== record.password_hash) {
        return { data: null, error: error("Email atau kata sandi salah.", "invalid_credentials") };
      }

      var session = saveSession(record);
      return { data: { session: session }, error: null };
    },

    /** Keluar dari sesi aktif. */
    signOut() {
      localStorage.removeItem(KEYS.session);
      notifyListeners("SIGNED_OUT", null);
    },

    /** Ambil sesi aktif (sinkron, sesuai sifat localStorage). */
    getSession() {
      return readSession();
    },

    /** Ambil pengguna yang sedang login, atau null. */
    getCurrentUser() {
      var session = readSession();
      return session ? session.user : null;
    },

    /** Daftarkan pendengar perubahan sesi. Mengembalikan fungsi berhenti. */
    onAuthStateChange(listener) {
      listeners.push(listener);
      return {
        unsubscribe: function () {
          var index = listeners.indexOf(listener);
          if (index !== -1) listeners.splice(index, 1);
        },
      };
    },

    // Pesan jelas bila AUTH_BACKEND diubah ke supabase tapi implementasinya belum tersedia.
    _supabaseNotReady() {
      return {
        data: null,
        error: error(
          "Backend 'supabase' belum diaktifkan di file auth.js. Ikuti panduan migrasi pada komentar file auth.js.",
          "backend_not_ready"
        ),
      };
    },
  };
})();
