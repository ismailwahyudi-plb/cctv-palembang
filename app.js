const cameras = Array.from({ length: 60 }, (_, index) => {
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

const players = new Map();
const favorites = new Set(JSON.parse(localStorage.getItem("cctvFavorites") || "[]"));

function setGlobalStatus(text, status = "waiting") {
  globalStatus.textContent = text;
  globalDot.className = `dot ${status}`;
}

function saveFavorites() {
  localStorage.setItem("cctvFavorites", JSON.stringify([...favorites]));
}

function destroyPlayer(id) {
  const current = players.get(id);
  if (current?.hls) current.hls.destroy();
  players.delete(id);
}

function attachStream(camera, video, badge, errorText) {
  destroyPlayer(camera.id);
  badge.textContent = "MENGHUBUNGKAN";
  badge.className = "status-badge waiting";
  errorText.hidden = true;

  const markOnline = () => {
    badge.textContent = "LIVE";
    badge.className = "status-badge online";
    setGlobalStatus("Streaming CCTV tersedia", "online");
  };

  const markOffline = (message) => {
    badge.textContent = "OFFLINE";
    badge.className = "status-badge offline";
    errorText.textContent = message;
    errorText.hidden = false;
    setGlobalStatus("Sebagian stream tidak dapat dimuat", "offline");
  };

  video.addEventListener("playing", markOnline, { once: true });
  video.addEventListener(
    "error",
    () => markOffline("Video gagal diputar. Periksa koneksi, status stream, atau konfigurasi CORS server."),
    { once: true }
  );

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = camera.stream;
    players.set(camera.id, { video, hls: null });
    video.play().catch(() => {});
    return;
  }

  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({
      liveSyncDurationCount: 3,
      maxLiveSyncPlaybackRate: 1.2,
      enableWorker: true,
    });

    hls.loadSource(camera.stream);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        markOffline("Gagal mengambil HLS stream. Jika URL bisa dibuka langsung tetapi gagal di web ini, kemungkinan server belum mengizinkan CORS.");
        hls.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      } else {
        markOffline("Player mengalami error fatal saat memutar stream.");
        hls.destroy();
      }
    });

    players.set(camera.id, { video, hls });
  } else {
    markOffline("Browser ini tidak mendukung pemutaran HLS.");
  }
}

function createCameraCard(camera) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".camera-card");
  const video = fragment.querySelector("video");
  const badge = fragment.querySelector(".status-badge");
  const errorText = fragment.querySelector(".error-text");
  const favoriteBtn = fragment.querySelector(".favorite-btn");

  card.dataset.cameraId = camera.id;
  fragment.querySelector(".camera-name").textContent = camera.name;
  fragment.querySelector(".camera-location").textContent = camera.location;

  if (favorites.has(camera.id)) {
    favoriteBtn.classList.add("active");
    favoriteBtn.textContent = "★";
  }

  fragment.querySelector(".play-btn").addEventListener("click", async () => {
    if (!players.has(camera.id)) attachStream(camera, video, badge, errorText);
    try {
      await video.play();
    } catch (_) {}
  });

  fragment.querySelector(".reload-btn").addEventListener("click", () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    attachStream(camera, video, badge, errorText);
  });

  fragment.querySelector(".fullscreen-btn").addEventListener("click", async () => {
    try {
      if (video.requestFullscreen) await video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch (_) {}
  });

  favoriteBtn.addEventListener("click", () => {
    if (favorites.has(camera.id)) {
      favorites.delete(camera.id);
      favoriteBtn.classList.remove("active");
      favoriteBtn.textContent = "☆";
    } else {
      favorites.add(camera.id);
      favoriteBtn.classList.add("active");
      favoriteBtn.textContent = "★";
    }
    saveFavorites();
  });

  // Penting: 60 stream TIDAK diputar otomatis agar HP/browser tidak terbebani.
  // Stream baru dimuat ketika tombol Putar ditekan.
  badge.textContent = "SIAP";
  badge.className = "status-badge waiting";

  return fragment;
}

function renderCameras(list = cameras) {
  players.forEach((_, id) => destroyPlayer(id));
  cameraGrid.innerHTML = "";
  cameraCount.textContent = `${list.length} kamera`;

  if (!list.length) {
    cameraGrid.innerHTML = '<div class="empty-state">CCTV tidak ditemukan.</div>';
    return;
  }

  list.forEach((camera) => cameraGrid.appendChild(createCameraCard(camera)));
  setGlobalStatus(`${list.length} kamera siap dipilih`, "waiting");
}

searchInput.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  const filtered = cameras.filter((camera) =>
    `${camera.name} ${camera.location} cam${camera.id}`.toLowerCase().includes(query)
  );
  renderCameras(filtered);
});

reloadAllBtn.addEventListener("click", () => renderCameras(cameras));
window.addEventListener("beforeunload", () => players.forEach((_, id) => destroyPlayer(id)));

renderCameras();

// ...existing code...

errorText.hidden = true;

const markOnline = () => {
  badge.textContent = "LIVE";
  badge.className = "status-badge online";
  setGlobalStatus("Streaming CCTV tersedia", "online");
};

const markOffline = (message) => {
  badge.textContent = "OFFLINE";
  badge.className = "status-badge offline";
  errorText.textContent = message;
  errorText.hidden = false;
  setGlobalStatus("Sebagian stream tidak dapat dimuat", "offline");
};

video.addEventListener("playing", markOnline, { once: true });
video.addEventListener(
  "error",
  () => markOffline("Video gagal diputar. Periksa koneksi, status stream, atau konfigurasi CORS server."),
  { once: true }
);

if (video.canPlayType("application/vnd.apple.mpegurl")) {
  video.src = camera.stream;
  players.set(camera.id, { video, hls: null });
  video.play().catch(() => {});
  return;
}

// Tambahkan kode fitur "Favorite" di bawah ini
document.addEventListener('DOMContentLoaded', () => {
  const favoriteButtons = document.querySelectorAll('.favorite-btn');

  favoriteButtons.forEach(button => {
    button.addEventListener('click', () => {
      const isFavorited = button.classList.toggle('favorited'); // Toggle class
      button.textContent = isFavorited ? '★' : '☆'; // Change icon

      // Optional: Save favorite status (e.g., using localStorage)
      const cameraLocation = button.closest('.camera-location')?.textContent || 'Unknown';
      if (isFavorited) {
        saveToFavorites(cameraLocation);
      } else {
        removeFromFavorites(cameraLocation);
      }
    });
  });
});

function saveToFavorites(location) {
  const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  if (!favorites.includes(location)) {
    favorites.push(location);
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }
}

function removeFromFavorites(location) {
  const favorites = JSON.parse(localStorage.getItem('favorites')) || [];
  const updatedFavorites = favorites.filter(fav => fav !== location);
  localStorage.setItem('favorites', JSON.stringify(updatedFavorites));
}