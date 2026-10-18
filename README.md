# DongFlix Web

Home web DongFlix dibangun dengan Next.js dan berdiri terpisah dari proyek
Flutter. Kode Android, Windows, iOS, dan TV tidak digunakan atau diubah oleh
proyek ini.

## Menjalankan lokal

```powershell
cd D:\My-Website\dongflix-all\dongflix-web
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Environment produksi

Tambahkan dua environment variable berikut di Vercel, tanpa awalan
`NEXT_PUBLIC_`:

```text
DONGFLIX_DONGHUA_WORKER_KEY
DONGFLIX_ANIME_WORKER_KEY
```

Nilainya hanya dibaca oleh Route Handler Next.js. Browser memanggil
`/api/home`, sehingga kunci Worker tidak ikut masuk ke JavaScript frontend.

## Pemeriksaan

```powershell
npm run lint
npm run build
```
