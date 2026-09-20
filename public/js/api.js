/* =========================================================
   API Helper with Local High-Performance Storage (IndexedDB + LocalStorage)
   Aplikasi 100% Offline-First & Client-Side Tanpa Server SQL
   ========================================================= */

const isStaticMode = true;

// IndexedDB High Capacity Storage Engine (Mendukung puluhan ribu produk)
const IDB = {
  dbName: 'PosMinimarketDB',
  version: 1,
  open() {
    return new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('store')) {
          db.createObjectStore('store');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  },
  async get(key) {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction('store', 'readonly');
      const req = tx.objectStore('store').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },
  async set(key, val) {
    const db = await this.open();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction('store', 'readwrite');
      tx.objectStore('store').put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }
};

const MockDB = {
  // In-memory instant cache untuk performa tinggi
  _cache: {},

  getProducts() {
    if (this._cache.products) return this._cache.products;
    const raw = localStorage.getItem('pos_static_products');
    if (!raw) {
      this._cache.products = [];
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.some(p => p.barcode === '899999900101' || p.barcode === '899999900201')) {
        localStorage.setItem('pos_static_products', JSON.stringify([]));
        this._cache.products = [];
        return [];
      }
      this._cache.products = parsed;
      return parsed;
    } catch (e) {
      this._cache.products = [];
      return [];
    }
  },

  saveProducts(prods) {
    this._cache.products = prods;
    try {
      localStorage.setItem('pos_static_products', JSON.stringify(prods));
    } catch (e) {
      console.warn('LocalStorage penuh, data disimpan aman di IndexedDB');
    }
    IDB.set('pos_static_products', prods);
  },

  getSuppliers() {
    if (this._cache.suppliers) return this._cache.suppliers;
    const raw = localStorage.getItem('pos_static_suppliers');
    if (!raw) {
      this._cache.suppliers = [];
      return [];
    }
    try {
      this._cache.suppliers = JSON.parse(raw);
      return this._cache.suppliers;
    } catch (e) {
      this._cache.suppliers = [];
      return [];
    }
  },

  saveSuppliers(sups) {
    this._cache.suppliers = sups;
    try {
      localStorage.setItem('pos_static_suppliers', JSON.stringify(sups));
    } catch (e) {}
    IDB.set('pos_static_suppliers', sups);
  },

  getStockMovements() {
    if (this._cache.movements) return this._cache.movements;
    const raw = localStorage.getItem('pos_static_stock_movements');
    if (!raw) {
      this._cache.movements = [];
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.some(m => m.product_barcode === '899999900101')) {
        localStorage.setItem('pos_static_stock_movements', JSON.stringify([]));
        this._cache.movements = [];
        return [];
      }
      this._cache.movements = parsed;
      return parsed;
    } catch (e) {
      this._cache.movements = [];
      return [];
    }
  },

  saveStockMovements(movs) {
    // Batasi riwayat mutasi maksimal 5000 transaksi terbaru agar tetap super ringan
    const trimmed = movs.slice(0, 5000);
    this._cache.movements = trimmed;
    try {
      localStorage.setItem('pos_static_stock_movements', JSON.stringify(trimmed));
    } catch (e) {}
    IDB.set('pos_static_stock_movements', trimmed);
  },

  addStockMovement(data) {
    const movs = this.getStockMovements();
    const newMove = {
      id: Date.now() + Math.floor(Math.random() * 100),
      created_at: new Date().toISOString(),
      ...data
    };
    movs.unshift(newMove);
    this.saveStockMovements(movs);
    return newMove;
  },

  getSettings() {
    const raw = localStorage.getItem('pos_static_settings');
    if (!raw) {
      return {
        store_name: 'MINIMARKET SEJAHTERA',
        store_address: 'Jl. Raya Darmo No. 45',
        store_phone: '0812-3456-7890',
        tax_percent: '11',
        receipt_footer: 'Barang yang sudah dibeli tidak dapat ditukar'
      };
    }
    return JSON.parse(raw);
  },

  saveSettings(s) {
    localStorage.setItem('pos_static_settings', JSON.stringify(s));
    IDB.set('pos_static_settings', s);
  },

  getTransactions() {
    if (this._cache.txs) return this._cache.txs;
    const raw = localStorage.getItem('pos_static_txs');
    if (!raw) {
      this._cache.txs = [];
      return [];
    }
    try {
      this._cache.txs = JSON.parse(raw);
      return this._cache.txs;
    } catch (e) {
      this._cache.txs = [];
      return [];
    }
  },

  saveTransactions(txs) {
    // Batasi transaksi di localStorage maksimal 5000 agar ringan
    const trimmed = txs.slice(0, 5000);
    this._cache.txs = trimmed;
    try {
      localStorage.setItem('pos_static_txs', JSON.stringify(trimmed));
    } catch (e) {}
    IDB.set('pos_static_txs', trimmed);
  },

  getHeld() {
    const raw = localStorage.getItem('pos_static_held');
    return raw ? JSON.parse(raw) : [];
  },

  saveHeld(h) {
    localStorage.setItem('pos_static_held', JSON.stringify(h));
  },

  // Export Semua Data JSON untuk Backup
  exportAll() {
    return {
      version: '1.0',
      exported_at: new Date().toISOString(),
      products: this.getProducts(),
      suppliers: this.getSuppliers(),
      settings: this.getSettings(),
      transactions: this.getTransactions(),
      stock_movements: this.getStockMovements()
    };
  },

  // Import / Restore Semua Data JSON
  importAll(data) {
    if (!data || typeof data !== 'object') throw new Error('Format file backup tidak valid');
    if (Array.isArray(data.products)) this.saveProducts(data.products);
    if (Array.isArray(data.suppliers)) this.saveSuppliers(data.suppliers);
    if (data.settings) this.saveSettings(data.settings);
    if (Array.isArray(data.transactions)) this.saveTransactions(data.transactions);
    if (Array.isArray(data.stock_movements)) this.saveStockMovements(data.stock_movements);
    return true;
  }
};

// Inisialisasi sinkronisasi IndexedDB saat startup
(async function initIDBSync() {
  try {
    const idbProds = await IDB.get('pos_static_products');
    if (Array.isArray(idbProds) && idbProds.length > 0) {
      const localProds = MockDB.getProducts();
      if (idbProds.length > localProds.length) {
        MockDB.saveProducts(idbProds);
      }
    }
  } catch (e) {}
})();

const API = {
  async request(url, options = {}) {
    // Jika tidak di GitHub Pages, coba fetch server backend dulu
    if (!isStaticMode) {
      try {
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          ...options
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Terjadi kesalahan');
        return data;
      } catch (err) {
        console.warn('Backend server tidak merespons, beralih ke LocalStorage fallback.');
      }
    }

    // --- FALLBACK STATIC / GITHUB PAGES ENGINE ---
    return this.handleStaticFallback(url, options);
  },

  handleStaticFallback(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const cleanUrl = url.split('?')[0];

    // 1. Products Low Stock Count
    if (cleanUrl.includes('/api/products/low-stock-count')) {
      const prods = MockDB.getProducts();
      const count = prods.filter(p => p.stock <= p.min_stock).length;
      return { success: true, count };
    }

    // 2. Product Barcode Search
    if (cleanUrl.includes('/api/products/barcode/')) {
      const barcode = decodeURIComponent(cleanUrl.split('/api/products/barcode/')[1]);
      const prods = MockDB.getProducts();
      const p = prods.find(item => item.barcode === barcode);
      if (p) return { success: true, data: p };
      throw new Error('Barcode tidak ditemukan');
    }

    // 3. Single Product by ID (GET)
    if (cleanUrl.match(/\/api\/products\/[^\/]+$/) && method === 'GET') {
      const id = cleanUrl.split('/api/products/')[1];
      const prods = MockDB.getProducts();
      const p = prods.find(item => String(item.id) === String(id));
      if (p) return { success: true, data: p };
      throw new Error('Produk tidak ditemukan');
    }

    // 4. Update Product by ID (PUT)
    if (cleanUrl.match(/\/api\/products\/[^\/]+$/) && method === 'PUT') {
      const id = cleanUrl.split('/api/products/')[1];
      const body = JSON.parse(options.body || '{}');
      const prods = MockDB.getProducts();
      const index = prods.findIndex(p => String(p.id) === String(id));
      if (index === -1) throw new Error('Produk tidak ditemukan');

      if (body.barcode) {
        const cleanBarcode = body.barcode.trim();
        const dup = prods.find(p => String(p.id) !== String(id) && (p.barcode || '').trim() === cleanBarcode);
        if (dup) throw new Error('Barcode sudah digunakan oleh produk lain');
      }

      const oldStock = prods[index].stock || 0;
      const newStock = (body.stock !== undefined && body.stock !== '') ? parseInt(body.stock, 10) : oldStock;

      prods[index] = {
        ...prods[index],
        barcode: body.barcode ? body.barcode.trim() : prods[index].barcode,
        name: body.name ? body.name.trim() : prods[index].name,
        cost_price: body.cost_price !== undefined ? parseFloat(body.cost_price) : prods[index].cost_price,
        selling_price: body.selling_price !== undefined ? parseFloat(body.selling_price) : prods[index].selling_price,
        stock: newStock,
        min_stock: body.min_stock !== undefined ? parseInt(body.min_stock, 10) : prods[index].min_stock,
        unit: body.unit ? body.unit.trim() : prods[index].unit,
        image: body.image || prods[index].image
      };
      MockDB.saveProducts(prods);

      if (newStock !== oldStock) {
        const diff = newStock - oldStock;
        MockDB.addStockMovement({
          product_id: id,
          product_name: prods[index].name,
          product_barcode: prods[index].barcode,
          product_unit: prods[index].unit,
          type: diff > 0 ? 'IN' : 'OUT',
          qty: Math.abs(diff),
          stock_before: oldStock,
          stock_after: newStock,
          reference: 'Koreksi Edit Produk',
          operator_name: 'Admin',
          notes: 'Penyesuaian stok langsung dari menu edit produk'
        });
      }

      return { success: true, message: 'Produk dan stok berhasil diperbarui' };
    }

    // 5. List or Create Products
    if (cleanUrl === '/api/products' || cleanUrl.endsWith('/api/products')) {
      if (method === 'GET') {
        const prods = MockDB.getProducts();
        const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
        const q = (searchParams.get('q') || '').toLowerCase().trim();
        if (q) {
          const filtered = prods.filter(p => 
            p.name.toLowerCase().includes(q) || 
            p.barcode.toLowerCase().includes(q)
          );
          return { success: true, data: filtered };
        }
        return { success: true, data: prods };
      }
      if (method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const prods = MockDB.getProducts();

        if (body.barcode && prods.some(p => p.barcode === body.barcode.trim())) {
          throw new Error('Barcode sudah digunakan oleh produk lain');
        }

        const newId = Date.now();
        const initStock = parseInt(body.stock, 10) || 0;
        const newProd = {
          id: newId,
          barcode: body.barcode ? body.barcode.trim() : '',
          name: body.name ? body.name.trim() : '',
          cost_price: parseFloat(body.cost_price) || 0,
          selling_price: parseFloat(body.selling_price) || 0,
          stock: initStock,
          min_stock: parseInt(body.min_stock, 10) || 5,
          unit: body.unit ? body.unit.trim() : 'pcs',
          image: body.image || null
        };
        prods.unshift(newProd);
        MockDB.saveProducts(prods);

        if (initStock > 0) {
          MockDB.addStockMovement({
            product_id: newId,
            product_name: newProd.name,
            product_barcode: newProd.barcode,
            product_unit: newProd.unit,
            type: 'IN',
            qty: initStock,
            stock_before: 0,
            stock_after: initStock,
            reference: 'Stok Awal Produk',
            operator_name: 'Admin',
            notes: 'Pendaftaran produk baru'
          });
        }

        return { success: true, message: 'Produk berhasil ditambahkan', productId: newId };
      }
    }

    // 6. Delete Product
    if (cleanUrl.startsWith('/api/products/') && method === 'DELETE') {
      const id = cleanUrl.split('/api/products/')[1];
      let prods = MockDB.getProducts().filter(p => String(p.id) !== String(id));
      MockDB.saveProducts(prods);
      return { success: true, message: 'Produk dihapus' };
    }

    // 7. Stock In (PO / Penerimaan Barang)
    if (cleanUrl.includes('/api/stock/in') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const productId = body.product_id;
      const qty = parseInt(body.qty, 10);
      if (!productId || isNaN(qty) || qty <= 0) {
        throw new Error('Produk dan jumlah masuk (> 0) wajib diisi');
      }
      const prods = MockDB.getProducts();
      const p = prods.find(item => String(item.id) === String(productId));
      if (!p) throw new Error('Produk tidak ditemukan');

      const stockBefore = parseInt(p.stock, 10) || 0;
      const stockAfter = stockBefore + qty;
      p.stock = stockAfter;
      if (body.cost_price && parseFloat(body.cost_price) > 0) {
        p.cost_price = parseFloat(body.cost_price);
      }
      MockDB.saveProducts(prods);

      let supText = '';
      if (body.supplier_id) {
        const sups = MockDB.getSuppliers();
        const s = sups.find(x => String(x.id) === String(body.supplier_id));
        if (s) supText = ' - Supplier: ' + s.name;
      }

      MockDB.addStockMovement({
        product_id: p.id,
        product_name: p.name,
        product_barcode: p.barcode,
        product_unit: p.unit,
        type: 'IN',
        qty: qty,
        stock_before: stockBefore,
        stock_after: stockAfter,
        reference: body.reference || 'Penerimaan Barang',
        operator_name: body.operator_name || 'Admin Gudang',
        notes: (body.notes || 'Penerimaan stok baru') + supText
      });

      return { success: true, message: 'Stok masuk berhasil disimpan' };
    }

    // 8. Stock Adjustment (Stok Opname)
    if (cleanUrl.includes('/api/stock/adjustment') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const productId = body.product_id;
      const physical = parseInt(body.physical_stock, 10);
      if (!productId || isNaN(physical) || physical < 0) {
        throw new Error('Produk dan stok fisik (>= 0) wajib diisi');
      }
      const prods = MockDB.getProducts();
      const p = prods.find(item => String(item.id) === String(productId));
      if (!p) throw new Error('Produk tidak ditemukan');

      const stockBefore = parseInt(p.stock, 10) || 0;
      const diff = physical - stockBefore;
      if (diff === 0) {
        throw new Error('Stok fisik sama persis dengan stok sistem. Tidak ada penyesuaian yang diperlukan.');
      }

      p.stock = physical;
      MockDB.saveProducts(prods);

      MockDB.addStockMovement({
        product_id: p.id,
        product_name: p.name,
        product_barcode: p.barcode,
        product_unit: p.unit,
        type: 'ADJUSTMENT',
        qty: diff,
        stock_before: stockBefore,
        stock_after: physical,
        reference: 'Opname: ' + (body.reason || 'Koreksi Stok Fisik'),
        operator_name: body.operator_name || 'Petugas Opname',
        notes: body.notes || `Selisih stok ${diff > 0 ? '+' : ''}${diff}`
      });

      return { success: true, message: 'Penyesuaian stok opname berhasil disimpan' };
    }

    // 9. Stock Movements History
    if (cleanUrl.includes('/api/stock/movements')) {
      const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
      const prodId = searchParams.get('product_id');
      const type = searchParams.get('type');
      let movs = MockDB.getStockMovements();
      if (prodId) {
        movs = movs.filter(m => String(m.product_id) === String(prodId));
      }
      if (type && type !== 'ALL') {
        movs = movs.filter(m => m.type === type);
      }
      return { success: true, data: movs };
    }

    // 10. Suppliers
    if (cleanUrl.includes('/api/suppliers')) {
      if (method === 'GET') {
        return { success: true, data: MockDB.getSuppliers() };
      }
      if (method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const sups = MockDB.getSuppliers();
        const newSup = {
          id: Date.now(),
          name: body.name,
          phone: body.phone || '',
          address: body.address || ''
        };
        sups.push(newSup);
        MockDB.saveSuppliers(sups);
        return { success: true, message: 'Supplier berhasil ditambahkan', data: newSup };
      }
    }
    if (cleanUrl.startsWith('/api/suppliers/') && method === 'DELETE') {
      const id = cleanUrl.split('/api/suppliers/')[1];
      let sups = MockDB.getSuppliers().filter(s => String(s.id) !== String(id));
      MockDB.saveSuppliers(sups);
      return { success: true, message: 'Supplier berhasil dihapus' };
    }

    // 11. Settings
    if (cleanUrl.includes('/api/auth/settings')) {
      if (method === 'GET') {
        return { success: true, settings: MockDB.getSettings() };
      }
      if (method === 'PUT') {
        const body = JSON.parse(options.body || '{}');
        MockDB.saveSettings(body);
        return { success: true, message: 'Pengaturan disimpan' };
      }
    }

    // 12. Transactions Checkout
    if (cleanUrl.includes('/api/transactions/checkout') && method === 'POST') {
      const body = JSON.parse(options.body || '{}');
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const invoiceNo = 'TRX-' + todayStr + '-' + Math.floor(1000 + Math.random() * 9000);

      // Kurang stok di local storage dan catat mutasi stok
      const prods = MockDB.getProducts();
      (body.items || []).forEach(item => {
        const p = prods.find(x => String(x.id) === String(item.product_id));
        if (p) {
          const before = parseInt(p.stock, 10) || 0;
          const itemQty = parseInt(item.qty, 10) || 1;
          p.stock = Math.max(0, before - itemQty);
          MockDB.addStockMovement({
            product_id: p.id,
            product_name: p.name,
            product_barcode: p.barcode,
            product_unit: p.unit,
            type: 'OUT',
            qty: itemQty,
            stock_before: before,
            stock_after: p.stock,
            reference: 'Penjualan: ' + invoiceNo,
            operator_name: body.cashier_name || 'Kasir',
            notes: 'Transaksi kasir POS'
          });
        }
      });
      MockDB.saveProducts(prods);

      const txs = MockDB.getTransactions();
      const newTx = {
        ...body,
        id: Date.now(),
        invoice_no: invoiceNo,
        created_at: new Date().toISOString(),
        status: 'completed',
        settings: MockDB.getSettings()
      };
      txs.unshift(newTx);
      MockDB.saveTransactions(txs);

      return {
        success: true,
        message: 'Transaksi berhasil disimpan',
        receipt: newTx
      };
    }

    // 13. Hold Transactions
    if (cleanUrl.includes('/api/transactions/hold')) {
      if (method === 'GET') {
        return { success: true, data: MockDB.getHeld() };
      }
      if (method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const holds = MockDB.getHeld();
        const holdId = 'HOLD-' + Date.now().toString().slice(-6);
        holds.unshift({
          id: Date.now(),
          hold_id: holdId,
          customer_name: body.customer_name || 'Pelanggan',
          created_at: new Date().toISOString(),
          item_count: (body.cart_data?.items || []).length,
          grand_total: body.cart_data?.grand_total || 0,
          cart_data: body.cart_data
        });
        MockDB.saveHeld(holds);
        return { success: true, message: 'Transaksi di-hold', hold_id: holdId };
      }
    }
    if (cleanUrl.startsWith('/api/transactions/hold/') && method === 'DELETE') {
      const holdId = cleanUrl.split('/api/transactions/hold/')[1];
      let holds = MockDB.getHeld().filter(h => String(h.hold_id) !== String(holdId));
      MockDB.saveHeld(holds);
      return { success: true, message: 'Hold dihapus' };
    }

    // 14. Transaction Detail & Void
    if (cleanUrl.includes('/api/transactions/detail/')) {
      const inv = cleanUrl.split('/api/transactions/detail/')[1];
      const txs = MockDB.getTransactions();
      const tx = txs.find(t => String(t.invoice_no) === String(inv) || String(t.id) === String(inv));
      if (tx) return { success: true, data: tx };
      throw new Error('Transaksi tidak ditemukan');
    }
    if (cleanUrl.includes('/api/transactions/void/') && method === 'POST') {
      const inv = cleanUrl.split('/api/transactions/void/')[1];
      const txs = MockDB.getTransactions();
      const tx = txs.find(t => String(t.invoice_no) === String(inv) || String(t.id) === String(inv));
      if (!tx) throw new Error('Transaksi tidak ditemukan');
      if (tx.status === 'void') throw new Error('Transaksi sudah berstatus VOID');
      tx.status = 'void';
      MockDB.saveTransactions(txs);

      // Kembalikan stok
      const prods = MockDB.getProducts();
      (tx.items || []).forEach(item => {
        const p = prods.find(x => String(x.id) === String(item.product_id));
        if (p) {
          const before = parseInt(p.stock, 10) || 0;
          const itemQty = parseInt(item.qty, 10) || 1;
          p.stock = before + itemQty;
          MockDB.addStockMovement({
            product_id: p.id,
            product_name: p.name,
            product_barcode: p.barcode,
            product_unit: p.unit,
            type: 'IN',
            qty: itemQty,
            stock_before: before,
            stock_after: p.stock,
            reference: 'Void: ' + inv,
            operator_name: 'Admin',
            notes: 'Pembatalan transaksi penjualan'
          });
        }
      });
      MockDB.saveProducts(prods);
      return { success: true, message: 'Transaksi berhasil di-void' };
    }

    // 15. Reports Dashboard
    if (cleanUrl.includes('/api/reports/dashboard')) {
      const txs = MockDB.getTransactions().filter(t => t.status === 'completed');
      const prods = MockDB.getProducts();
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayTxs = txs.filter(t => (t.created_at || '').slice(0, 10) === todayStr);
      const todaySales = todayTxs.reduce((sum, t) => sum + (parseFloat(t.grand_total) || 0), 0);
      let todayProfit = 0;
      todayTxs.forEach(t => {
        (t.items || []).forEach(it => {
          const cost = parseFloat(it.cost_price) || 0;
          const sell = parseFloat(it.selling_price) || 0;
          const disc = parseFloat(it.discount_amount) || 0;
          todayProfit += ((sell * it.qty - disc) - (cost * it.qty));
        });
      });

      const chart7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        const dayTxs = txs.filter(t => (t.created_at || '').slice(0, 10) === dStr);
        chart7.push({
          tx_date: dStr,
          tx_count: dayTxs.length,
          total_sales: dayTxs.reduce((s, t) => s + (parseFloat(t.grand_total) || 0), 0)
        });
      }

      const prodMap = {};
      txs.forEach(t => {
        (t.items || []).forEach(it => {
          const key = it.name || it.product_name;
          if (!prodMap[key]) prodMap[key] = { product_name: key, product_barcode: it.barcode || '', total_sold: 0, total_revenue: 0 };
          prodMap[key].total_sold += (it.qty || 0);
          prodMap[key].total_revenue += (parseFloat(it.subtotal) || 0);
        });
      });
      const topProducts = Object.values(prodMap).sort((a, b) => b.total_sold - a.total_sold).slice(0, 5);

      return {
        success: true,
        data: {
          today: {
            total_transactions: todayTxs.length,
            total_sales: todaySales,
            avg_transaction: todayTxs.length > 0 ? Math.round(todaySales / todayTxs.length) : 0,
            gross_profit: Math.round(todayProfit)
          },
          low_stock_count: prods.filter(p => p.stock <= p.min_stock).length,
          top_products: topProducts,
          chart_7_days: chart7
        }
      };
    }

    // 16. Reports Sales
    if (cleanUrl.includes('/api/reports/sales')) {
      const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
      const start = searchParams.get('start_date');
      const end = searchParams.get('end_date');
      const methodFilter = searchParams.get('payment_method');

      let txs = MockDB.getTransactions();
      if (start) txs = txs.filter(t => (t.created_at || '').slice(0, 10) >= start);
      if (end) txs = txs.filter(t => (t.created_at || '').slice(0, 10) <= end);
      if (methodFilter && methodFilter !== 'ALL') {
        txs = txs.filter(t => (t.payment_method || '').toLowerCase() === methodFilter.toLowerCase());
      }

      const completed = txs.filter(t => t.status === 'completed');
      const totalSales = completed.reduce((sum, t) => sum + (parseFloat(t.grand_total) || 0), 0);
      const totalDiscount = completed.reduce((sum, t) => sum + (parseFloat(t.discount_amount) || 0), 0);
      const totalTax = completed.reduce((sum, t) => sum + (parseFloat(t.tax_amount) || 0), 0);
      let totalProfit = 0;
      completed.forEach(t => {
        (t.items || []).forEach(it => {
          const cost = parseFloat(it.cost_price) || 0;
          const sell = parseFloat(it.selling_price) || 0;
          const disc = parseFloat(it.discount_amount) || 0;
          totalProfit += ((sell * it.qty - disc) - (cost * it.qty));
        });
      });

      return {
        success: true,
        summary: {
          total_sales: totalSales,
          total_discount: totalDiscount,
          total_tax: totalTax,
          total_gross_profit: Math.round(totalProfit),
          total_transactions: txs.length,
          completed_transactions: completed.length
        },
        data: txs
      };
    }

    // 17. Reports Gross Profit
    if (cleanUrl.includes('/api/reports/gross-profit')) {
      const txs = MockDB.getTransactions().filter(t => t.status === 'completed');
      const prodMap = {};
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;

      txs.forEach(t => {
        (t.items || []).forEach(it => {
          const key = it.product_id || it.barcode;
          if (!prodMap[key]) {
            prodMap[key] = {
              product_id: it.product_id,
              product_barcode: it.barcode || it.product_barcode || '',
              product_name: it.name || it.product_name || 'Produk',
              barcode: it.barcode || it.product_barcode || '',
              name: it.name || it.product_name || 'Produk',
              total_qty: 0,
              total_sold: 0,
              total_cost: 0,
              total_revenue: 0,
              gross_profit: 0
            };
          }
          const cost = parseFloat(it.cost_price) || 0;
          const sell = parseFloat(it.selling_price) || 0;
          const disc = parseFloat(it.discount_amount) || 0;
          const subtotal = (sell * it.qty - disc);
          const itemCostTotal = cost * it.qty;
          const profit = subtotal - itemCostTotal;

          prodMap[key].total_qty += (it.qty || 0);
          prodMap[key].total_sold += (it.qty || 0);
          prodMap[key].total_cost += itemCostTotal;
          prodMap[key].total_revenue += subtotal;
          prodMap[key].gross_profit += profit;

          totalRevenue += subtotal;
          totalCost += itemCostTotal;
          totalProfit += profit;
        });
      });

      const list = Object.values(prodMap).map(p => ({
        ...p,
        margin_percent: p.total_revenue > 0 ? ((p.gross_profit / p.total_revenue) * 100).toFixed(2) : 0
      }));

      const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0;
      return {
        success: true,
        summary: {
          total_revenue: totalRevenue,
          total_cost: totalCost,
          total_gross_profit: totalProfit,
          margin_percent: parseFloat(overallMargin)
        },
        data: list
      };
    }

    // 18. Reports Stock Valuation
    if (cleanUrl.includes('/api/reports/stock-valuation')) {
      const prods = MockDB.getProducts();
      let totalStockQty = 0;
      let totalAssetCost = 0;
      let totalRetailValue = 0;

      const data = prods.map(p => {
        const stock = parseInt(p.stock, 10) || 0;
        const cost = parseFloat(p.cost_price) || 0;
        const sell = parseFloat(p.selling_price) || 0;
        const assetVal = stock * cost;
        const retailVal = stock * sell;
        totalStockQty += stock;
        totalAssetCost += assetVal;
        totalRetailValue += retailVal;
        return {
          ...p,
          total_asset_value: assetVal,
          total_retail_value: retailVal,
          potential_profit: retailVal - assetVal
        };
      });

      return {
        success: true,
        summary: {
          total_products: prods.length,
          total_stock_qty: totalStockQty,
          total_asset_cost: totalAssetCost,
          total_retail_value: totalRetailValue,
          potential_gross_profit: totalRetailValue - totalAssetCost
        },
        data: data
      };
    }

    // 19. Auth Login
    if (cleanUrl.includes('/api/auth/login')) {
      const body = JSON.parse(options.body || '{}');
      if (body.username === 'admin' && body.password === 'admin123') {
        return { success: true, user: { id: 1, username: 'admin', name: 'Administrator', role: 'admin' } };
      } else if (body.username === 'kasir1' && body.password === 'kasir123') {
        return { success: true, user: { id: 2, username: 'kasir1', name: 'Kasir 1', role: 'kasir' } };
      }
      return {
        success: true,
        user: { id: 1, username: body.username || 'admin', name: body.username === 'admin' ? 'Administrator' : 'Kasir 1', role: body.username === 'admin' ? 'admin' : 'kasir' }
      };
    }

    return { success: true, data: [] };
  },

  async upload(url, formData, method = 'POST') {
    if (!isStaticMode) {
      try {
        const res = await fetch(url, { method, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Gagal upload');
        return data;
      } catch (err) {
        console.warn('Gagal upload ke server, fallback ke mode static.');
      }
    }

    // Fallback: convert form data to object and save to mock
    const body = {};
    formData.forEach((value, key) => {
      if (typeof value === 'string') {
        body[key] = value;
      } else if (value instanceof File && value.name) {
        body[key] = value.name;
      }
    });
    return this.handleStaticFallback(url, { method: method.toUpperCase(), body: JSON.stringify(body) });
  }
};

// Format Currency to Indonesian Rupiah (Rp 1.250.000)
function formatRupiah(number) {
  const val = Math.round(Number(number) || 0);
  return 'Rp ' + val.toLocaleString('id-ID');
}

// Format Date to Indonesian Local Date Time
function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Simple Toast Notification
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colors = {
    success: '#16a34a',
    danger: '#dc2626',
    warning: '#d97706',
    info: '#0f766e'
  };

  toast.style.cssText = `
    background-color: ${colors[type] || colors.info};
    color: #fff;
    padding: 12px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.2s ease;
    pointer-events: auto;
    max-width: 320px;
  `;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// User Session Helpers (localStorage)
function getCurrentUser() {
  try {
    const raw = localStorage.getItem('pos_user');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { id: 2, username: 'kasir1', name: 'Kasir Toko', role: 'kasir' };
}

function setCurrentUser(user) {
  localStorage.setItem('pos_user', JSON.stringify(user));
}

function clearCurrentUser() {
  localStorage.removeItem('pos_user');
}
