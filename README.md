# CCTV Palembang Prototype V1

Prototype mobile-first untuk menampilkan HLS CCTV Palembang dari file `.m3u8`.

## Menjalankan

Jangan hanya double-click `index.html` jika browser membatasi beberapa resource. Jalankan melalui local web server.

### VS Code
1. Buka folder ini di VS Code.
2. Install extension **Live Server** bila belum ada.
3. Klik kanan `index.html` -> **Open with Live Server**.
4. Buka alamat yang diberikan Live Server dari browser PC atau HP pada jaringan yang sama.

Atau dengan Python:

```bash
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Menambah Kamera

Edit array `cameras` pada `app.js`:

```js
{
  id: 47,
  name: "Nama Simpang",
  location: "Jl. ... Palembang",
  stream: "https://.../main_stream.m3u8"
}
```

## Catatan Penting: CORS

hls.js mensyaratkan seluruh resource HLS (manifest dan segmen video) dikirim dengan header CORS yang mengizinkan request dari origin web dashboard.

Jika stream dapat dibuka langsung tetapi player menampilkan error network/CORS, solusi production yang disarankan adalah reverse proxy pada backend/domain dashboard, bukan menonaktifkan keamanan browser.


## Daftar kamera
Prototype membuat 150 entri otomatis dari cam1 sampai cam150. Nama/title untuk kamera yang terdaftar di data resmi (`cctv-Palembang.json` dari palembang.go.id) diambil dari objek `cctvTitles` di `app.js` (mis. cam42 = "CCTV SP BOM BARU"). Kamera yang tidak tercantum di data resmi tetap memakai nama default `Camera NN`.

Catatan: demi performa mobile, stream tidak dijalankan bersamaan. Stream baru dimuat saat kartu video diklik/diputar.
