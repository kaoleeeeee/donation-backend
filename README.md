# Donasi Backend (Saweria + Bagibagi -> Roblox)

Backend ini nerima webhook dari Saweria & Bagibagi, nyimpen ke Vercel KV (Redis),
lalu di-poll sama script Roblox kamu di `/api/donations`.

## Struktur

```
api/
  webhook/
    saweria.js     <- endpoint webhook Saweria
    bagibagi.js     <- endpoint webhook Bagibagi
  donations.js      <- di-poll sama Roblox
lib/
  store.js          <- logic antrian donasi (Vercel KV)
package.json
```

## Langkah Setup

### 1. Push ke GitHub, deploy ke Vercel
- Buat repo baru, push semua file ini.
- Import repo itu di https://vercel.com/new
- Vercel otomatis detect ini sebagai serverless functions (gak perlu framework/build command khusus).

### 2. Aktifkan Vercel KV (buat storage)
- Di dashboard project Vercel kamu -> tab **Storage** -> **Create Database** -> pilih **KV** (Upstash Redis).
- Connect ke project kamu. Vercel otomatis inject env vars yang dibutuhin `@vercel/kv`
  (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, dll) — kamu gak perlu isi manual.

### 3. (Opsional tapi disarankan) Isi env vars buat verifikasi signature
Di **Settings -> Environment Variables**, tambahin:
- `SAWERIA_STREAM_KEY` — Stream Key kamu dari Saweria (Pengaturan -> Stream Key)
- `BAGIBAGI_WEBHOOK_TOKEN` — Webhook Token dari Bagibagi (tab Integrasi)

Kalau env var ini gak diisi, webhook tetap jalan tapi tanpa verifikasi signature
(siapa aja yang tau URL kamu bisa kirim donasi palsu — kurang aman untuk production).

### 4. Masukin URL webhook ke masing-masing platform

**Saweria:**
- Buka Saweria -> Pengaturan -> Integrasi/Streaming Widget -> cari kolom Webhook/Callback URL
- Isi: `https://donasi-kamu.vercel.app/api/webhook/saweria`

**Bagibagi:**
- Buka https://bagibagi.co/stream-overlay -> tab **Integrasi**
- Isi kolom **Custom Webhook Url**: `https://donasi-kamu.vercel.app/api/webhook/bagibagi`

### 5. Update script Roblox kamu
Di script `SociaBuzzServerHandler` (yang kamu kirim), ganti baris:
```lua
local BACKEND_URL = "https://donasi-kamu.vercel.app"
```
jadi domain Vercel kamu yang sebenernya (dari hasil deploy di step 1).

### 6. Test
- Pakai fitur "test donation" / "test notifikasi" yang ada di dashboard Saweria & Bagibagi (kalau ada), atau
- Kirim manual pakai curl:
```bash
curl -X POST https://donasi-kamu.vercel.app/api/webhook/saweria \
  -H "Content-Type: application/json" \
  -d '{"donator_name":"Test User","amount_raw":15000,"message":"tes donasi"}'
```
Lalu cek:
```bash
curl https://donasi-kamu.vercel.app/api/donations
```
Harusnya muncul donasi tadi di array `donations`. Kalau game Roblox kamu jalan,
efek donasi bakal otomatis muncul dalam 3 detik (sesuai `CHECK_INTERVAL`).

## Catatan
- `/api/donations` bersifat "pop" — begitu di-poll, antrian dikosongin. Ini match sama
  cara kerja script Roblox kamu yang polling tiap beberapa detik.
- Kalau donasinya sempet ke-skip (misalnya Roblox server lagi restart), donasi yang
  numpuk selama itu tetap aman di Redis dan bakal keambil di poll berikutnya.
