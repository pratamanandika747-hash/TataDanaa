# TataDana — Catat Keuangan Semudah Chat 🍊

**TataDana** adalah aplikasi SaaS manajemen keuangan pribadi premium Indonesia yang terintegrasi langsung dengan Telegram Bot multimodal, database Supabase (PostgreSQL + Auth + Storage), Midtrans payment gateway, serta in-app reporting interaktif dan generator dokumen PDF/Excel on-demand.

---

## 🚀 Fitur Unggulan

1. **Telegram Bot Multimodal**:
   - **Teks Bahasa Natural**: Mendukung format nominal khas Indonesia ("beli bakso 15rb" -> Rp15.000, "gajian 5jt" -> Rp5.000.000, "kopi 35k" -> Rp35.000).
   - **Foto Struk Belanja (Khusus PRO)**: Ekstraksi nama merchant, tanggal, total belanja, dan rincian barang belanjaan per item.
   - **Voice Note Audio (Maks 60s)**: Transkripsi suara otomatis dengan kutipan transkrip di balasan chat.
   - **Idempotent Webhook**: Deduplikasi `update_id` mencegah transaksi ganda dari retry server Telegram.
   - **Format Balasan Visual**: Balasan rapi dengan progress bar budget monospace (`█` dan `░`), status saldo terkini, dan motivasi keuangan.
   - **Perintah Cepat**: `/saldo`, `/hari ini`, `/minggu ini`, `/bulan ini`, `/budget`, `/sheet`, `/bantuan`.

2. **AI Multi-Provider Engine**:
   - Google Gemini 2.5 Flash sebagai primary provider (kecepatan tinggi & hemat biaya).
   - Failover otomatis ke OpenAI (GPT-4o-mini & Whisper) dan DeepSeek.
   - Pengaturan mode *Single* atau *Failover* langsung dari Admin Dashboard.
   - Proactive AI Financial Advisor (Khusus Pro): Peringatan otomatis jika pengeluaran kategori melonjak >50% atau memakan >20% budget.

3. **In-App Reporting & Export Dokumen**:
   - Halaman Laporan native dengan tabel transaksi paginasi, pencarian catatan, dan filter tanggal/dompet/kategori.
   - Expandable receipt items: Rincian struk belanja dapat dibuka-tutup (*accordion*).
   - Export on-demand ke **PDF** (layout resmi fintech) dan **Excel (.xlsx)**.
   - Supabase Storage signed URLs (24 jam) dengan fallback direct streaming download.

4. **Multi-Wallet & Budgeting**:
   - Dukungan multi dompet: Cash, BCA, Mandiri, GoPay, OVO, dll.
   - 1 dompet default untuk transaksi Telegram.
   - Budget bulanan per kategori dengan alert 80% dan 100%.

5. **Admin Dashboard Terpadu**:
   - Superadmin impersonation user tanpa re-login.
   - Manajemen API keys AI terenkripsi & AI call logs.
   - Approval/reject pembayaran manual Midtrans.
   - **Built-in Webhook Simulator**: Uji coba pengiriman teks, struk foto, dan suara langsung dari peramban tanpa memerlukan tunnel publik (ngrok).

---

## 📦 Menjalankan di Localhost

Jalankan server aplikasi TataDana menggunakan Node.js runtime:

```bash
# Menggunakan runtime agy-node
agy-node server/server.js
```

Buka peramban Anda di:
👉 **`http://localhost:3000`**

---

## 🗄️ Database Migrations (Supabase)

Seluruh migrasi SQL tersedia di `supabase/migrations/`:
- `20261010000001_initial_schema.sql` (Skema inti, tabel, indexes)
- `20261010000002_rls_and_policies.sql` (Row Level Security & policies)
- `20261010000003_seed_data.sql` (Default data & user onboarding trigger)
- `20261031000001_harden_user_registration_approval.sql` (Persetujuan Super Admin, password hashing scrypt, & pending registration workflow)

---

## ⚡ Panduan Deploy ke Vercel & GitHub

### 1. Upload ke GitHub:
1. Buat repository baru di [GitHub](https://github.com/new).
2. Ekstrak atau salin isi file `tatadana-siap-deploy.zip` ke folder repository lokal.
3. Jalankan git commit & push:
   ```bash
   git init
   git add .
   git commit -m "feat: TataDana siap deploy dengan integrasi registrasi dan Super Admin dashboard"
   git branch -M main
   git remote add origin https://github.com/USERNAME/REPO_NAME.git
   git push -u origin main
   ```

### 2. Deploy Langsung ke Vercel:
1. Buka [Vercel Dashboard](https://vercel.com/new).
2. Pilih **Import Git Repository** dari akun GitHub Anda (atau upload menggunakan `vercel deploy`).
3. Vercel akan otomatis mengenali konfigurasi `vercel.json` dan folder `api/index.js`.
4. Klik **Deploy** — Aplikasi langsung live dalam hitungan detik!
