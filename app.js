const cameras = Array.from({ length: 150 }, (_, index) => {
  const id = index + 1;

  return {
    id,
    name: `Camera ${String(id).padStart(2, "0")}`,
    location: "Palembang, Sumatera Selatan",
    stream: `https://stream.palembang.go.id/cam${id}/main_stream.m3u8`,
  };
});

const cameraGrid = document.getElementById("cameraGrid");
const cameraCount = document.getElementById("cameraCount");
const searchInput = document.getElementById("searchInput");
const reloadAllBtn = document.getElementById("reloadAllBtn");
const globalStatus = document.getElementById("globalStatus");
const globalDot = document.querySelector(".dot");
const template = document.getElementById("cameraCardTemplate");
const cameraSectionTitle = document.getElementById(
  "cameraSectionTitle"
);
const navCctv = document.getElementById("navCctv");
const navFavorites = document.getElementById("navFavorites");
const pager = document.getElementById("pager");
const pagerInfo = document.getElementById("pagerInfo");
const pagerInfoShort = document.getElementById("pagerInfoShort");
const pageNumbers = document.getElementById("pageNumbers");
const pagerIndicator = document.getElementById("pagerIndicator");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageSizeSelect = document.getElementById("pageSizeSelect");

const players = new Map();

const favorites = new Set(
  JSON.parse(localStorage.getItem("cctvFavorites") || "[]")
);

let activeFilter = "all";
let currentPage = 1;
let pageSize = Number(pageSizeSelect.value) || 12;

// =========================
// GLOBAL STATUS
// =========================

function setGlobalStatus(text, status = "waiting") {
  globalStatus.textContent = text;

  if (globalDot) {
    globalDot.className = `dot ${status}`;
  }
}

// =========================
// FAVORITES
// =========================

function saveFavorites() {
  localStorage.setItem(
    "cctvFavorites",
    JSON.stringify([...favorites])
  );
}

// =========================
// TAMPILAN (SEMUA / FAVORIT)
// =========================

function visibleCameras() {
  const query = searchInput.value
    .trim()
    .toLowerCase();

  const base =
    activeFilter === "favorites"
      ? cameras.filter(
          (camera) => favorites.has(camera.id)
        )
      : cameras;

  if (!query) return base;

  return base.filter((camera) => {
    const searchable = `
      ${camera.name}
      ${camera.location}
      cam${camera.id}
    `
      .toLowerCase();

    return searchable.includes(query);
  });
}

function setActiveView(view) {
  activeFilter = view;

  if (navCctv) {
    navCctv.classList.toggle(
      "active",
      view === "all"
    );
  }

  if (navFavorites) {
    navFavorites.classList.toggle(
      "active",
      view === "favorites"
    );
  }

  if (cameraSectionTitle) {
    cameraSectionTitle.textContent =
      view === "favorites"
        ? "Daftar Favorit"
        : "Daftar CCTV";
  }

  currentPage = 1;

  renderCameras(visibleCameras());
}

// =========================
// PLAYER MANAGEMENT
// =========================

function destroyPlayer(id) {
  const current = players.get(id);

  if (!current) return;

  try {
    if (current.hls) {
      current.hls.destroy();
    }

    if (current.video) {
      current.video.pause();
      current.video.removeAttribute("src");
      current.video.load();
    }
  } catch (_) {}

  players.delete(id);
}

// =========================
// STREAM
// =========================

function attachStream(camera, video, badge, errorText) {
  destroyPlayer(camera.id);

  badge.textContent = "MENGHUBUNGKAN";
  badge.className = "status-badge waiting";

  errorText.hidden = true;
  errorText.textContent = "";

  const markOnline = () => {
    badge.textContent = "LIVE";
    badge.className = "status-badge online";

    setGlobalStatus(
      "Streaming CCTV tersedia",
      "online"
    );
  };

  const markOffline = (message) => {
    badge.textContent = "OFFLINE";
    badge.className = "status-badge offline";

    errorText.textContent = message;
    errorText.hidden = false;

    setGlobalStatus(
      "Sebagian stream tidak dapat dimuat",
      "offline"
    );
  };

  video.addEventListener(
    "playing",
    markOnline,
    { once: true }
  );

  video.addEventListener(
    "error",
    () => {
      markOffline(
        "Video gagal diputar. Periksa koneksi, status stream, atau konfigurasi CORS server."
      );
    },
    { once: true }
  );

  // Native HLS
  // Safari / iPhone / iPad
  if (
    video.canPlayType(
      "application/vnd.apple.mpegurl"
    )
  ) {
    video.src = camera.stream;

    players.set(camera.id, {
      video,
      hls: null,
    });

    video.play().catch(() => {});

    return;
  }

  // HLS.js
  // Chrome / Edge / Android
  if (
    window.Hls &&
    Hls.isSupported()
  ) {
    const hls = new Hls({
      liveSyncDurationCount: 3,
      maxLiveSyncPlaybackRate: 1.2,
      enableWorker: true,
    });

    hls.loadSource(camera.stream);
    hls.attachMedia(video);

    hls.on(
      Hls.Events.MANIFEST_PARSED,
      () => {
        video.play().catch(() => {});
      }
    );

    hls.on(
      Hls.Events.ERROR,
      (_, data) => {
        if (!data.fatal) return;

        if (
          data.type ===
          Hls.ErrorTypes.NETWORK_ERROR
        ) {
          markOffline(
            "Gagal mengambil stream HLS. Jika URL stream bisa dibuka langsung tetapi gagal di website ini, kemungkinan server belum mengizinkan CORS."
          );

          try {
            hls.startLoad();
          } catch (_) {}

          return;
        }

        if (
          data.type ===
          Hls.ErrorTypes.MEDIA_ERROR
        ) {
          try {
            hls.recoverMediaError();
          } catch (_) {}

          return;
        }

        markOffline(
          "Player mengalami error fatal saat memutar stream."
        );

        try {
          hls.destroy();
        } catch (_) {}

        players.delete(camera.id);
      }
    );

    players.set(camera.id, {
      video,
      hls,
    });

    return;
  }

  markOffline(
    "Browser ini tidak mendukung pemutaran HLS."
  );
}

// =========================
// CAMERA CARD
// =========================

function createCameraCard(camera) {
  const fragment =
    template.content.cloneNode(true);

  const card =
    fragment.querySelector(
      ".camera-card"
    );

  const video =
    fragment.querySelector("video");

  const badge =
    fragment.querySelector(
      ".status-badge"
    );

  const errorText =
    fragment.querySelector(
      ".error-text"
    );

  const favoriteBtn =
    fragment.querySelector(
      ".favorite-btn"
    );

  const reloadBtn =
    fragment.querySelector(
      ".reload-btn"
    );

  const cameraName =
    fragment.querySelector(
      ".camera-name"
    );

  card.dataset.cameraId =
    camera.id;

  cameraName.textContent =
    camera.name;

  badge.textContent = "SIAP";
  badge.className =
    "status-badge waiting";

  // =========================
  // FAVORITE STATUS
  // =========================

  if (
    favorites.has(camera.id)
  ) {
    favoriteBtn.classList.add(
      "active"
    );

    favoriteBtn.textContent = "★";
  } else {
    favoriteBtn.textContent = "☆";
  }

  // =========================
  // PLAY (klik video untuk mulai/jeda)
  // =========================

  video.addEventListener(
    "click",
    () => {
      if (
        players.has(camera.id)
      ) {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        return;
      }

      attachStream(
        camera,
        video,
        badge,
        errorText
      );

      video.play().catch(() => {});
    }
  );

  // =========================
  // RELOAD
  // =========================

  reloadBtn.addEventListener(
    "click",
    () => {
      destroyPlayer(camera.id);

      badge.textContent =
        "MENGHUBUNGKAN";

      badge.className =
        "status-badge waiting";

      errorText.hidden = true;

      attachStream(
        camera,
        video,
        badge,
        errorText
      );
    }
  );

  // =========================
  // FAVORITE
  // =========================

  favoriteBtn.addEventListener(
    "click",
    () => {
      if (
        favorites.has(camera.id)
      ) {
        favorites.delete(camera.id);

        favoriteBtn.classList.remove(
          "active"
        );

        favoriteBtn.textContent = "☆";
      } else {
        favorites.add(camera.id);

        favoriteBtn.classList.add(
          "active"
        );

        favoriteBtn.textContent = "★";
      }

      saveFavorites();

      if (activeFilter === "favorites") {
        renderCameras(visibleCameras());
      }
    }
  );

  return fragment;
}

// =========================
// RENDER CAMERA
// =========================

function renderCameras(
  list = visibleCameras()
) {
  players.forEach((_, id) => {
    destroyPlayer(id);
  });

  cameraGrid.innerHTML = "";

  const total = list.length;
  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  currentPage = Math.max(
    1,
    Math.min(currentPage, totalPages)
  );

  cameraCount.textContent =
    activeFilter === "favorites"
      ? `${total} favorit`
      : `${total} kamera`;

  if (!total) {
    const emptyMessage =
      activeFilter === "favorites"
        ? "Belum ada kamera favorit. Ketuk bintang pada kartu kamera untuk menambahkannya."
        : "CCTV tidak ditemukan.";

    cameraGrid.innerHTML = `
      <div class="empty-state">
        ${emptyMessage}
      </div>
    `;

    setGlobalStatus(
      "Tidak ada kamera untuk ditampilkan",
      "offline"
    );

    pager.classList.remove("visible");
    return;
  }

  const startIndex =
    (currentPage - 1) * pageSize;

  const pageItems = list.slice(
    startIndex,
    startIndex + pageSize
  );

  pageItems.forEach((camera) => {
    cameraGrid.appendChild(
      createCameraCard(camera)
    );
  });

  renderPager(total, totalPages);

  const noun =
    activeFilter === "favorites"
      ? "favorit"
      : "kamera";

  setGlobalStatus(
    `${pageItems.length} dari ${total} ${noun} tampil`,
    "waiting"
  );
}

// =========================
// PAGINATION
// =========================

function renderPager(total, totalPages) {
  const firstShown =
    (currentPage - 1) * pageSize + 1;

  const lastShown = Math.min(
    currentPage * pageSize,
    total
  );

  const rangeText =
    `${firstShown}–${lastShown} dari ${total}`;

  pager.classList.add("visible");

  pagerInfo.textContent =
    `Menampilkan ${rangeText}`;

  pagerInfoShort.textContent = rangeText;

  pagerIndicator.textContent =
    `${currentPage} / ${totalPages}`;

  prevPageBtn.disabled =
    currentPage === 1;

  nextPageBtn.disabled =
    currentPage === totalPages;

  pageNumbers.innerHTML = "";

  const pages = pageWindow(
    currentPage,
    totalPages
  );

  pages.forEach((entry) => {
    if (entry === "...") {
      const dots = document.createElement("span");
      dots.className = "page-dots";
      dots.textContent = "…";
      pageNumbers.appendChild(dots);
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      entry === currentPage
        ? "page-btn current"
        : "page-btn";
    button.textContent = entry;
    button.setAttribute(
      "aria-label",
      `Halaman ${entry}`
    );
    button.addEventListener("click", () => {
      goToPage(entry);
    });
    pageNumbers.appendChild(button);
  });
}

function pageWindow(current, total) {
  if (total <= 7) {
    return Array.from(
      { length: total },
      (_, i) => i + 1
    );
  }

  const result = [1];
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(
    total - 1,
    current + 1
  );

  if (windowStart > 2) {
    result.push("...");
  }

  for (let i = windowStart; i <= windowEnd; i++) {
    result.push(i);
  }

  if (windowEnd < total - 1) {
    result.push("...");
  }

  result.push(total);
  return result;
}

function goToPage(page) {
  if (page === currentPage) return;

  currentPage = page;
  renderCameras(visibleCameras());
}

prevPageBtn.addEventListener(
  "click",
  () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }
);

nextPageBtn.addEventListener(
  "click",
  () => {
    const totalPages = Math.max(
      1,
      Math.ceil(
        visibleCameras().length / pageSize
      )
    );

    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }
);

pageSizeSelect.addEventListener(
  "change",
  () => {
    pageSize =
      Number(pageSizeSelect.value) || 12;

    currentPage = 1;
    renderCameras(visibleCameras());
  }
);

// =========================
// SEARCH
// =========================

searchInput.addEventListener(
  "input",
  () => {
    currentPage = 1;

    renderCameras(visibleCameras());
  }
);

// =========================
// REFRESH LIST
// =========================

reloadAllBtn.addEventListener(
  "click",
  () => {
    searchInput.value = "";

    currentPage = 1;

    renderCameras(visibleCameras());
  }
);

// =========================
// NAVIGASI BAWAH
// =========================

navCctv.addEventListener(
  "click",
  () => {
    setActiveView("all");
  }
);

navFavorites.addEventListener(
  "click",
  () => {
    setActiveView("favorites");
  }
);

// =========================
// CLEANUP
// =========================

window.addEventListener(
  "beforeunload",
  () => {
    players.forEach(
      (_, id) => {
        destroyPlayer(id);
      }
    );
  }
);

// =========================
// INITIAL LOAD
// =========================

renderCameras();


