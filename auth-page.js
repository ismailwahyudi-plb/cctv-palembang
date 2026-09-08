// ============================================================
// auth-page.js — Logika halaman masuk & daftar (index.html).
// ============================================================
(function () {
  "use strict";

  var form = document.getElementById("authForm");
  var emailInput = document.getElementById("authEmail");
  var passwordInput = document.getElementById("authPassword");
  var confirmField = document.getElementById("confirmField");
  var confirmInput = document.getElementById("authConfirm");
  var errorBox = document.getElementById("authError");
  var submitBtn = document.getElementById("authSubmit");
  var tabLogin = document.getElementById("tabLogin");
  var tabSignup = document.getElementById("tabSignup");
  var switchModeBtn = document.getElementById("switchMode");
  var switchText = document.getElementById("switchText");
  var togglePassword = document.getElementById("togglePassword");

  var mode = "login"; // "login" | "signup"

  function showError(message) {
    if (!message) {
      errorBox.hidden = true;
      errorBox.textContent = "";
      return;
    }
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function setMode(nextMode) {
    mode = nextMode;
    var isSignup = mode === "signup";

    tabLogin.classList.toggle("active", !isSignup);
    tabSignup.classList.toggle("active", isSignup);
    tabLogin.setAttribute("aria-selected", String(!isSignup));
    tabSignup.setAttribute("aria-selected", String(isSignup));

    confirmField.hidden = !isSignup;
    confirmInput.required = isSignup;
    submitBtn.textContent = isSignup ? "Daftar Akun" : "Masuk";

    passwordInput.setAttribute(
      "autocomplete",
      isSignup ? "new-password" : "current-password"
    );

    switchText.textContent = isSignup
      ? "Sudah punya akun?"
      : "Belum punya akun?";
    switchModeBtn.textContent = isSignup ? "Masuk di sini" : "Daftar akun baru";

    showError(null);
  }

  tabLogin.addEventListener("click", function () {
    setMode("login");
  });

  tabSignup.addEventListener("click", function () {
    setMode("signup");
  });

  switchModeBtn.addEventListener("click", function () {
    setMode(mode === "login" ? "signup" : "login");
  });

  togglePassword.addEventListener("click", function () {
    var isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.setAttribute(
      "aria-label",
      isHidden ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
    );
    togglePassword.textContent = isHidden ? "◉" : "○";
  });

  // Hapus pesan error begitu pengguna mulai mengetik lagi.
  [emailInput, passwordInput, confirmInput].forEach(function (input) {
    input.addEventListener("input", function () {
      showError(null);
    });
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var email = emailInput.value.trim();
    var password = passwordInput.value;
    var isSignup = mode === "signup";

    showError(null);

    // ---------- Validasi sisi klien ----------
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Masukkan alamat email yang valid.");
      emailInput.focus();
      return;
    }

    if (!password) {
      showError("Kata sandi wajib diisi.");
      passwordInput.focus();
      return;
    }

    if (isSignup) {
      if (password.length < AppConfig.PASSWORD_MIN_LENGTH) {
        showError(
          "Kata sandi minimal " + AppConfig.PASSWORD_MIN_LENGTH + " karakter."
        );
        passwordInput.focus();
        return;
      }

      if (password !== confirmInput.value) {
        showError("Konfirmasi kata sandi tidak sama.");
        confirmInput.focus();
        return;
      }
    }

    // ---------- Proses via AuthService ----------
    submitBtn.disabled = true;
    submitBtn.textContent = "Memproses…";

    var result = isSignup
      ? await AuthService.signUp({ email: email, password: password })
      : await AuthService.signIn({ email: email, password: password });

    submitBtn.disabled = false;
    submitBtn.textContent = isSignup ? "Daftar Akun" : "Masuk";

    if (result.error) {
      showError(result.error.message);
      return;
    }

    // Sukses -> pindah ke dashboard.
    location.href = AppConfig.PAGES.dashboard;
  });
})();
