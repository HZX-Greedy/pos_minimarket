# Aplikasi Web POS (Point of Sale) Minimarket & Retail

Aplikasi POS retail/minimarket berbasis web dengan backend Node.js + Express, database MySQL/MariaDB, dan frontend vanilla HTML, CSS, dan JavaScript tanpa framework berat. Desain antarmuka dibuat bersih, minimalis, manusiawi, tactile dengan tombol besar, dan responsif nyaman digunakan di tablet kasir.

---

## Fitur Utama

### 1. Halaman Kasir (POS)
- **Katalog & Pencarian Cepat**: Pencarian instan berdasarkan nama produk dan nomor barcode/SKU.
- **Filter Kategori**: Tab kategori interaktif dengan badge item.
- **Scanner Barcode Otomatis**: Bidang pencarian otomatis fokus (auto-focus) dan langsung menambah item ke keranjang saat tombol `Enter` ditekan dari barcode scanner fisik.
- **Keranjang Belanja Pintar**:
  - Ubah kuantitas (qty) dengan tombol `[-]`, `[+]`, atau ketik langsung.
  - Diskon per item (nominal Rp atau persentase %).
  - Diskon transaksi global (nominal Rp atau persentase %).
  - Toggle pajak PPN 11% (bisa diaktifkan/dinonaktifkan).
  - Grand total dengan angka besar dan kontras tinggi.
- **Pembayaran Multi-Metode**:
  - **Tunai**: Tombol pecahan uang pas, Rp 10.000, 20.000, 50.000, 100.000, kalkulasi kembalian otomatis & validasi uang bayar.
  - **QRIS**: Tampilan QR code siap scan standar QRIS.
  - **Debit / EDC**: Input nama bank dan nomor approval EDC.
- **Hold / Pending Transaksi**: Simpan keranjang sementara untuk melayani pelanggan berikutnya, disertai nomor hold dan nama pelanggan.
- **Void Item & Void Transaksi**: Pembatalan item dari keranjang atau pembatalan total.
- **Shortcut Keyboard**:
  - `F1`: Buka modal pembayaran.
  - `F2`: Tahan transaksi (Hold).
  - `ESC`: Batal transaksi atau tutup modal.

### 2. Struk Thermal 58mm (Printer Kasir Retail)
- Format presisi standar kertas thermal 58mm (area cetak efektif ~48mm / 32 karakter per baris).
- Font monospace (`Courier New`), 10-12px, warna hitam pekat `#000`.
- Print CSS `@media print { @page { size: 58mm auto; margin: 0; } }` tanpa header/footer browser.
- **Struktur 12 Bagian Lengkap**:
  1. Nama Toko (Bold, Center)
  2. Alamat & No. Telepon
  3. Pemisah `================================`
  4. No. Struk, Tanggal & Jam, Nama Kasir
  5. Pemisah `--------------------------------`
  6. Rincian Item (Baris 1: Nama; Baris 2: Qty x Harga .... Subtotal)
  7. Pemisah `--------------------------------`
  8. Subtotal, Diskon, Pajak (PPN), TOTAL (Bold)
  9. Bayar & Kembalian
  10. Pemisah `================================`
  11. Ucapan Terima Kasih + "Barang yang sudah dibeli tidak dapat ditukar"
  12. Feed spasi cutter printer
- Dilengkapi **Preview Struk di layar** dan kemampuan **Cetak Ulang Struk** dari histori laporan transaksi.

### 3. Produk & Inventori
- CRUD lengkap produk: Barcode/SKU, nama produk, kategori, harga beli (HPP), harga jual, stok, batas minimum stok, satuan, dan upload foto via `multer`.
- CRUD kategori dan data supplier.
- Pengurangan stok otomatis saat checkout transaksi.
- Alert/badge stok menipis jika stok <= batas minimum stok.

### 4. Stok Masuk & Stok Opname
- **Stok Masuk**: Penerimaan barang dari supplier, update harga beli baru, no. faktur PO.
- **Stok Opname**: Penyesuaian stok fisik vs stok sistem, kalkulasi selisih real-time, opsi alasan (rusak, hilang, expired, selisih hitung).
- **Kartu Stok (Mutasi)**: Riwayat kronologis mutasi `IN`, `OUT`, dan `ADJUSTMENT` lengkap dengan stok sebelum, stok sesudah, dan operator.

### 5. Laporan & Dashboard Keuangan
- Dashboard: Omzet hari ini, jumlah transaksi, rata-rata belanja, laba kotor hari ini, top 5 produk terlaris.
- Grafik tren penjualan 7 hari (SVG responsif tanpa library berat).
- Laporan penjualan by filter tanggal (Hari ini, Kemarin, 7 hari, 30 hari, Custom).
- Laporan laba kotor (Harga Jual - Harga Beli) dan margin keuntungan (%).
- Laporan nilai aset inventori (Total modal HPP vs potensi omzet retail).
- Export laporan ke file **CSV / Excel** (UTF-8 BOM compatible).

---

## Struktur Direktori

```
pos-minimarket/
├── config/
│   └── database.js            # Konfigurasi pool koneksi MySQL & transaksi
├── controllers/
│   ├── authController.js       # Login & pengaturan toko
│   ├── productController.js    # CRUD produk & upload foto multer
│   ├── categoryController.js   # CRUD kategori
│   ├── supplierController.js   # CRUD supplier
│   ├── transactionController.js# Checkout, hold, void, detail struk
│   ├── stockController.js      # Stok masuk, stok opname, mutasi kartu stok
│   └── reportController.js     # Dashboard, laporan laba kotor, export CSV
├── routes/
│   ├── authRoutes.js
│   ├── productRoutes.js
│   ├── categoryRoutes.js
│   ├── supplierRoutes.js
│   ├── transactionRoutes.js
│   ├── stockRoutes.js
│   └── reportRoutes.js
├── public/
│   ├── css/
│   │   ├── style.css           # Design system minimalis & tablet responsive
│   │   ├── pos.css             # Layout 2 kolom kasir & touch target
│   │   ├── receipt.css         # Struk thermal 58mm & preview
│   │   └── modal.css           # Dialog pembayaran, hold list, diskon
│   ├── js/
│   │   ├── api.js              # Fetch client, formatter rupiah & session
│   │   ├── receipt.js          # Generator struk 12 bagian & window.print()
│   │   ├── pos.js              # State keranjang, barcode, shortcut F1/F2/ESC
│   │   ├── products.js         # Manajemen katalog, kategori, supplier
│   │   ├── stock.js            # Stok masuk, opname & mutasi
│   │   ├── reports.js          # Dashboard grafik, laba kotor, export CSV
│   │   └── auth.js             # Autentikasi kasir/admin
│   ├── uploads/                # Direktori foto produk
│   ├── index.html              # Halaman Kasir POS
│   ├── inventori.html          # Manajemen Produk
│   ├── stok.html               # Stok Masuk & Opname
│   ├── laporan.html            # Dashboard & Laporan
│   └── login.html              # Halaman Login Kasir & Admin
├── scripts/
│   └── init-db.js              # Auto-setup DB & seed 15 produk
├── database.sql                # SQL schema & data contoh
├── package.json
└── server.js                   # Server Node.js & Express
```

---

## Cara Menjalankan Aplikasi

1. **Pastikan MySQL Aktif**:
   Nyalakan MySQL di XAMPP Control Panel (default port `3306`).

2. **Inisialisasi Database & Data Contoh**:
   ```bash
   npm run init-db
   ```
   Script ini otomatis membuat database `pos_minimarket`, tabel-tabel, dan mengisi data awal (15 produk retail, 4 kategori, 3 supplier, dan akun kasir/admin).

3. **Jalankan Aplikasi**:
   ```bash
   npm start
   ```

4. **Akses di Browser**:
   Buka `http://localhost:3000`

### Akun Login Demo:
- **Kasir**: `kasir1` / `kasir123`
- **Admin**: `admin` / `admin123`
