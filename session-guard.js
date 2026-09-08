// ============================================================
// session-guard.js — Pintu masuk aplikasi.
// Dipakai di index.html DAN dashboard.html (load lebih awal):
//   - buka dashboard tanpa login  -> dilempar ke halaman masuk
//   - buka halaman masuk saat sudah login -> dilempar ke dashboard
// ============================================================
(function () {
  "use strict";

  var currentFile = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var isDashboard = currentFile === AppConfig.PAGES.dashboard;

  if (!isDashboard && AuthService.getCurrentUser()) {
    location.replace(AppConfig.PAGES.dashboard);
    return;
  }

  if (isDashboard && !AuthService.getCurrentUser()) {
    location.replace(AppConfig.PAGES.login);
    return;
  }
})();
