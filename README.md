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
Prototype ini sudah membuat 60 kamera otomatis dari cam1 sampai cam60. Nama default adalah Camera 01 s/d Camera 60. Untuk mengganti nama, edit fungsi pembentuk data kamera di app.js atau ubah menjadi daftar objek manual jika ingin nama lokasi spesifik.

Catatan: demi performa mobile, 60 stream tidak dijalankan bersamaan. Stream baru dimuat saat tombol Putar pada kamera dipilih.
