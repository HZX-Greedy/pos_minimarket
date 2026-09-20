/* =========================================================
   POS Kasir Controller (Main Cashier Logic)
   Clean Version (Tanpa Kategori)
   ========================================================= */

const POS = {
  products: [],
  filteredProducts: [],
  
  // Cart State
  cart: {
    items: [],
    subtotal: 0,
    discount_type: 'fixed',
    discount_value: 0,
    discount_amount: 0,
    tax_enabled: true,
    tax_percent: 11,
    tax_amount: 0,
    grand_total: 0,
    hold_id: null,
    customer_name: 'Pelanggan Umum'
  },

  // Payment Modal State
  payment: {
    method: 'cash',
    cash_received: 0,
    change_amount: 0,
    reference: ''
  },

  displayLimit: 36,
  barcodeMap: new Map(),

  async init() {
    this.bindEvents();
    this.bindShortcuts();
    await this.loadProducts();
    await this.loadStoreSettings();
    this.updateHeldBadge();
    this.focusBarcodeInput();
  },

  focusBarcodeInput() {
    const input = document.getElementById('pos-barcode-input');
    if (input) {
      input.focus();
    }
  },

  async loadProducts() {
    try {
      const res = await API.request('/api/products');
      this.products = res.data || [];
      
      // Indexing Barcode Hash Map untuk pencarian instan O(1) < 1ms walaupun puluhan ribu barang
      this.barcodeMap = new Map();
      this.products.forEach(p => {
        if (p.barcode) this.barcodeMap.set(String(p.barcode).trim(), p);
      });

      this.filterProducts();
    } catch (err) {
      showToast('Gagal memuat katalog produk', 'danger');
    }
  },

  async loadStoreSettings() {
    try {
      const res = await API.request('/api/auth/settings');
      if (res.settings) {
        if (res.settings.tax_percent) {
          this.cart.tax_percent = parseFloat(res.settings.tax_percent);
        }
        if (res.settings.tax_enabled !== undefined) {
          this.cart.tax_enabled = res.settings.tax_enabled === '1' || res.settings.tax_enabled === true;
        }
        const taxSwitch = document.getElementById('pos-tax-switch');
        if (taxSwitch) {
          taxSwitch.checked = this.cart.tax_enabled;
        }
        const taxRateLabel = document.getElementById('pos-tax-rate-label');
        if (taxRateLabel) {
          taxRateLabel.innerText = `PPN (${this.cart.tax_percent}%)`;
        }
      }
    } catch (e) {}
  },

  filterProducts() {
    const query = (document.getElementById('pos-barcode-input')?.value || '').toLowerCase().trim();
    
    this.filteredProducts = this.products.filter(p => {
      return !query || 
        (p.name && p.name.toLowerCase().includes(query)) || 
        (p.barcode && String(p.barcode).toLowerCase().includes(query));
    });

    this.renderProducts();
  },

  showMoreProducts() {
    this.displayLimit += 36;
    this.renderProducts();
  },

  renderProducts() {
    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    if (this.filteredProducts.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <p style="font-size: 15px; font-weight: 600;">Belum ada produk</p>
          <p style="font-size: 13px;">Silakan input produk di menu "Inventori" atau ketik kata kunci pencarian</p>
        </div>
      `;
      return;
    }

    // Batasi render DOM awal maksimal displayLimit agar tablet/laptop tidak lag walau ada ribuan barang
    const visibleProducts = this.filteredProducts.slice(0, this.displayLimit);
    const fallbackSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.35;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

    let html = visibleProducts.map(p => {
      const stockNum = parseInt(p.stock, 10) || 0;
      const minStockNum = parseInt(p.min_stock, 10) || 5;
      const isLowStock = stockNum <= minStockNum;
      const isOutOfStock = stockNum <= 0;
      const thumb = p.image 
        ? `<img src="${p.image.startsWith('http') || p.image.startsWith('data:') ? p.image : 'uploads/' + p.image}" alt="${p.name}" onerror="this.src=''; this.parentElement.innerHTML='${fallbackSvg}';">`
        : fallbackSvg;

      return `
        <div class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" onclick="POS.addToCartById('${p.id}')">
          <div class="product-card-thumb">${thumb}</div>
          <div class="product-card-body">
            <div>
              <div class="product-card-barcode">${p.barcode}</div>
              <div class="product-card-title" title="${p.name}">${p.name}</div>
            </div>
            <div class="product-card-meta">
              <div class="product-card-price">${formatRupiah(p.selling_price)}</div>
              <div class="product-card-stock ${isLowStock ? 'low-stock' : ''}">
                ${isOutOfStock ? 'Habis' : `Stok: ${stockNum}`}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Tombol muat lebih banyak jika masih ada produk
    if (this.filteredProducts.length > this.displayLimit) {
      const sisa = this.filteredProducts.length - this.displayLimit;
      html += `
        <div style="grid-column: 1 / -1; text-align: center; padding: 18px;">
          <button class="btn btn-secondary" onclick="POS.showMoreProducts()">
            Muat Lebih Banyak (${sisa} produk lainnya)
          </button>
        </div>
      `;
    }

    grid.innerHTML = html;
  },

  addToCartById(productId) {
    const product = this.products.find(p => String(p.id) === String(productId));
    if (!product) return;

    const stockNum = parseInt(product.stock, 10) || 0;
    if (stockNum <= 0) {
      showToast(`Stok ${product.name} habis!`, 'danger');
      return;
    }

    const existingIndex = this.cart.items.findIndex(i => String(i.product_id) === String(product.id));

    if (existingIndex > -1) {
      const currentQty = this.cart.items[existingIndex].qty;
      if (currentQty + 1 > stockNum) {
        showToast(`Stok hanya tersisa ${stockNum}`, 'warning');
        return;
      }
      this.cart.items[existingIndex].qty += 1;
      this.cart.items[existingIndex].subtotal = this.calcItemSubtotal(this.cart.items[existingIndex]);
    } else {
      const newItem = {
        product_id: product.id,
        barcode: product.barcode,
        name: product.name,
        unit: product.unit,
        selling_price: parseFloat(product.selling_price) || 0,
        cost_price: parseFloat(product.cost_price) || 0,
        stock: stockNum,
        qty: 1,
        discount_type: 'fixed',
        discount_value: 0,
        discount_amount: 0,
        subtotal: parseFloat(product.selling_price) || 0
      };
      this.cart.items.push(newItem);
    }

    this.calculateCart();
    this.renderCart();
  },

  async handleBarcodeEnter(barcodeText) {
    if (!barcodeText || !barcodeText.trim()) return;
    const cleanBarcode = barcodeText.trim();

    // Pencarian instan O(1) menggunakan hash map index
    const localProd = this.barcodeMap?.get(cleanBarcode) || this.products.find(p => String(p.barcode || '').trim() === cleanBarcode);
    if (localProd) {
      this.addToCartById(localProd.id);
      document.getElementById('pos-barcode-input').value = '';
      this.filterProducts();
      return;
    }

    try {
      const res = await API.request(`/api/products/barcode/${encodeURIComponent(cleanBarcode)}`);
      if (res.data) {
        if (!this.products.some(p => String(p.id) === String(res.data.id))) {
          this.products.push(res.data);
          if (res.data.barcode) this.barcodeMap?.set(String(res.data.barcode).trim(), res.data);
        }
        this.addToCartById(res.data.id);
        document.getElementById('pos-barcode-input').value = '';
        this.filterProducts();
      }
    } catch (e) {
      showToast(`Produk dengan barcode "${cleanBarcode}" tidak ditemukan`, 'warning');
    }
  },
  updateItemQty(index, newQty) {
    const item = this.cart.items[index];
    if (!item) return;

    const qty = parseInt(newQty, 10);
    if (isNaN(qty) || qty <= 0) {
      this.removeItem(index);
      return;
    }

    if (qty > item.stock) {
      showToast(`Stok maksimal: ${item.stock}`, 'warning');
      item.qty = item.stock;
    } else {
      item.qty = qty;
    }

    item.subtotal = this.calcItemSubtotal(item);
    this.calculateCart();
    this.renderCart();
  },

  changeQtyBy(index, delta) {
    const item = this.cart.items[index];
    if (!item) return;
    this.updateItemQty(index, item.qty + delta);
  },

  removeItem(index) {
    const item = this.cart.items[index];
    this.cart.items.splice(index, 1);
    this.calculateCart();
    this.renderCart();
    showToast(`${item ? item.name : 'Item'} dihapus dari keranjang`, 'info');
  },

  calcItemSubtotal(item) {
    const raw = item.qty * item.selling_price;
    let disc = 0;
    if (item.discount_type === 'percent') {
      disc = (raw * item.discount_value) / 100;
    } else {
      disc = item.discount_value || 0;
    }
    item.discount_amount = Math.min(disc, raw);
    return Math.max(0, raw - item.discount_amount);
  },

  calculateCart() {
    let sub = 0;
    this.cart.items.forEach(i => {
      sub += i.subtotal;
    });
    this.cart.subtotal = sub;

    let transDisc = 0;
    if (this.cart.discount_type === 'percent') {
      transDisc = (sub * this.cart.discount_value) / 100;
    } else {
      transDisc = this.cart.discount_value || 0;
    }
    this.cart.discount_amount = Math.min(transDisc, sub);
    const afterDiscount = Math.max(0, sub - this.cart.discount_amount);

    if (this.cart.tax_enabled) {
      this.cart.tax_amount = (afterDiscount * this.cart.tax_percent) / 100;
    } else {
      this.cart.tax_amount = 0;
    }

    this.cart.grand_total = Math.round(afterDiscount + this.cart.tax_amount);
  },

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    const badge = document.getElementById('pos-cart-count');
    const subtotalEl = document.getElementById('pos-subtotal');
    const discEl = document.getElementById('pos-discount-total');
    const taxEl = document.getElementById('pos-tax-amount');
    const grandTotalEl = document.getElementById('pos-grand-total');
    const tabletBarTotal = document.getElementById('tablet-bar-total');
    const tabletBarCount = document.getElementById('tablet-bar-count');

    const totalItemCount = this.cart.items.reduce((sum, i) => sum + i.qty, 0);

    if (badge) badge.innerText = `${totalItemCount} item`;
    if (tabletBarCount) tabletBarCount.innerText = `${totalItemCount} item`;
    if (subtotalEl) subtotalEl.innerText = formatRupiah(this.cart.subtotal);
    if (discEl) discEl.innerText = `-${formatRupiah(this.cart.discount_amount)}`;
    if (taxEl) taxEl.innerText = formatRupiah(this.cart.tax_amount);
    if (grandTotalEl) grandTotalEl.innerText = formatRupiah(this.cart.grand_total);
    if (tabletBarTotal) tabletBarTotal.innerText = formatRupiah(this.cart.grand_total);

    if (!container) return;

    if (this.cart.items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Keranjang Kosong</div>
          <div style="font-size: 12px;">Pindai barcode atau klik produk untuk transaksi</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.cart.items.map((item, idx) => `
      <div class="cart-item-row">
        <div class="cart-item-top">
          <div class="cart-item-name">${item.name}</div>
          <button class="cart-item-del-btn" title="Hapus Item" onclick="POS.removeItem(${idx})">
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-controller">
            <button class="qty-btn" onclick="POS.changeQtyBy(${idx}, -1)">-</button>
            <input type="number" class="qty-input" value="${item.qty}" min="1" max="${item.stock}" onchange="POS.updateItemQty(${idx}, this.value)">
            <button class="qty-btn" onclick="POS.changeQtyBy(${idx}, 1)">+</button>
          </div>
          <div class="cart-item-pricing">
            <span class="item-disc-badge" onclick="POS.openItemDiscountModal(${idx})">
              ${item.discount_amount > 0 ? `Diskon: -${formatRupiah(item.discount_amount)}` : '+ Diskon'}
            </span>
            <div class="cart-item-subtotal">${formatRupiah(item.subtotal)}</div>
          </div>
        </div>
      </div>
    `).join('');
  },

  openItemDiscountModal(index) {
    const item = this.cart.items[index];
    if (!item) return;

    const modal = document.getElementById('generic-modal');
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 360px;">
        <div class="modal-header">
          <h3>Diskon Item: ${item.name}</h3>
          <button class="modal-close-btn" onclick="POS.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Tipe Diskon</label>
            <select id="item-disc-type" class="form-control">
              <option value="fixed" ${item.discount_type === 'fixed' ? 'selected' : ''}>Nominal (Rp)</option>
              <option value="percent" ${item.discount_type === 'percent' ? 'selected' : ''}>Persentase (%)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Nilai Diskon</label>
            <input type="number" id="item-disc-val" class="form-control" value="${item.discount_value || 0}" min="0">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="POS.closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="POS.applyItemDiscount(${index})">Simpan</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  applyItemDiscount(index) {
    const item = this.cart.items[index];
    if (!item) return;

    const type = document.getElementById('item-disc-type').value;
    const val = parseFloat(document.getElementById('item-disc-val').value) || 0;

    item.discount_type = type;
    item.discount_value = val;
    item.subtotal = this.calcItemSubtotal(item);

    this.calculateCart();
    this.renderCart();
    this.closeModal();
  },

  openTotalDiscountModal() {
    const modal = document.getElementById('generic-modal');
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 360px;">
        <div class="modal-header">
          <h3>Diskon Transaksi</h3>
          <button class="modal-close-btn" onclick="POS.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Tipe Diskon</label>
            <select id="total-disc-type" class="form-control">
              <option value="fixed" ${this.cart.discount_type === 'fixed' ? 'selected' : ''}>Nominal (Rp)</option>
              <option value="percent" ${this.cart.discount_type === 'percent' ? 'selected' : ''}>Persentase (%)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Nilai Diskon</label>
            <input type="number" id="total-disc-val" class="form-control" value="${this.cart.discount_value || 0}" min="0">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="POS.closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="POS.applyTotalDiscount()">Simpan</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  applyTotalDiscount() {
    const type = document.getElementById('total-disc-type').value;
    const val = parseFloat(document.getElementById('total-disc-val').value) || 0;

    this.cart.discount_type = type;
    this.cart.discount_value = val;

    this.calculateCart();
    this.renderCart();
    this.closeModal();
  },

  toggleTax(checked) {
    this.cart.tax_enabled = checked;
    this.calculateCart();
    this.renderCart();
  },
  openPaymentModal() {
    if (this.cart.items.length === 0) {
      showToast('Keranjang masih kosong!', 'warning');
      return;
    }

    this.payment.method = 'cash';
    this.payment.cash_received = this.cart.grand_total;
    this.payment.change_amount = 0;
    this.payment.reference = '';

    const modal = document.getElementById('payment-modal');
    modal.style.display = 'flex';
    this.renderPaymentBody();
  },

  renderPaymentBody() {
    const body = document.getElementById('payment-modal-body');
    const grand = this.cart.grand_total;
    const change = Math.max(0, this.payment.cash_received - grand);
    this.payment.change_amount = change;

    const next5k = Math.ceil(grand / 5000) * 5000;
    const next10k = Math.ceil(grand / 10000) * 10000;
    const next20k = Math.ceil(grand / 20000) * 20000;
    const next50k = Math.ceil(grand / 50000) * 50000;
    const next100k = Math.ceil(grand / 100000) * 100000;

    const uniqueDenoms = Array.from(new Set([grand, next5k, next10k, next20k, next50k, next100k, 200000]))
      .filter(d => d >= grand)
      .slice(0, 6);

    let methodContent = '';
    if (this.payment.method === 'cash') {
      methodContent = `
        <div class="form-group">
          <label>Uang Tunai Diterima (Rp)</label>
          <input type="number" id="pay-cash-input" class="form-control" style="font-size: 18px; font-weight: 700;" value="${this.payment.cash_received}" oninput="POS.handleCashInput(this.value)">
        </div>

        <div class="quick-cash-grid">
          <button class="btn-quick-cash pas-btn" onclick="POS.setCashAmount(${grand})">Uang Pas</button>
          ${uniqueDenoms.filter(d => d !== grand).map(d => `
            <button class="btn-quick-cash" onclick="POS.setCashAmount(${d})">${formatRupiah(d)}</button>
          `).join('')}
        </div>

        <div class="change-box ${this.payment.cash_received >= grand ? 'success' : ''}">
          <span class="change-label">Kembalian</span>
          <span class="change-value" id="pay-change-display">${formatRupiah(change)}</span>
        </div>
      `;
    } else if (this.payment.method === 'qris') {
      methodContent = `
        <div class="qris-display-box">
          <div class="qris-qr-code">
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <rect width="100" height="100" fill="white"/>
              <rect x="10" y="10" width="25" height="25" fill="#000"/>
              <rect x="15" y="15" width="15" height="15" fill="#fff"/>
              <rect x="18" y="18" width="9" height="9" fill="#000"/>
              <rect x="65" y="10" width="25" height="25" fill="#000"/>
              <rect x="70" y="15" width="15" height="15" fill="#fff"/>
              <rect x="73" y="18" width="9" height="9" fill="#000"/>
              <rect x="10" y="65" width="25" height="25" fill="#000"/>
              <rect x="15" y="70" width="15" height="15" fill="#fff"/>
              <rect x="18" y="73" width="9" height="9" fill="#000"/>
              <rect x="45" y="45" width="12" height="12" fill="#0f766e"/>
              <circle cx="51" cy="51" r="3" fill="#fff"/>
              <rect x="40" y="15" width="6" height="6" fill="#000"/>
              <rect x="50" y="25" width="6" height="6" fill="#000"/>
              <rect x="42" y="65" width="6" height="6" fill="#000"/>
              <rect x="75" y="55" width="6" height="6" fill="#000"/>
              <rect x="65" y="75" width="15" height="6" fill="#000"/>
            </svg>
          </div>
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 2px;">QRIS STANDAR PEMBAYARAN</div>
          <div style="font-size: 12px; color: var(--text-muted);">Mendukung GoPay, OVO, Dana, ShopeePay, BCA, Mandiri</div>
        </div>
      `;
    } else if (this.payment.method === 'debit') {
      methodContent = `
        <div class="form-group">
          <label>Nama Bank / Kartu Debit</label>
          <input type="text" id="pay-bank-name" class="form-control" placeholder="Contoh: BCA Debit, Mandiri EDC">
        </div>
        <div class="form-group">
          <label>Nomor Referensi / No. Transaksi EDC (Opsional)</label>
          <input type="text" id="pay-ref-input" class="form-control" placeholder="No. approval EDC">
        </div>
      `;
    }

    body.innerHTML = `
      <div class="payment-tabs">
        <button class="pay-tab-btn ${this.payment.method === 'cash' ? 'active' : ''}" onclick="POS.setPaymentMethod('cash')">
          Tunai (Cash)
        </button>
        <button class="pay-tab-btn ${this.payment.method === 'qris' ? 'active' : ''}" onclick="POS.setPaymentMethod('qris')">
          QRIS
        </button>
        <button class="pay-tab-btn ${this.payment.method === 'debit' ? 'active' : ''}" onclick="POS.setPaymentMethod('debit')">
          Debit / Transfer
        </button>
      </div>

      <div class="pay-total-box">
        <div class="caption">Total Tagihan</div>
        <div class="amount">${formatRupiah(grand)}</div>
      </div>

      ${methodContent}
    `;

    if (this.payment.method === 'cash') {
      setTimeout(() => {
        const cashInput = document.getElementById('pay-cash-input');
        if (cashInput) {
          cashInput.focus();
          cashInput.select();
        }
      }, 50);
    }
  },

  setPaymentMethod(method) {
    this.payment.method = method;
    if (method !== 'cash') {
      this.payment.cash_received = this.cart.grand_total;
      this.payment.change_amount = 0;
    }
    this.renderPaymentBody();
  },

  handleCashInput(val) {
    const received = parseFloat(val) || 0;
    this.payment.cash_received = received;
    const change = Math.max(0, received - this.cart.grand_total);
    this.payment.change_amount = change;

    const changeEl = document.getElementById('pay-change-display');
    if (changeEl) {
      changeEl.innerText = formatRupiah(change);
      const box = changeEl.parentElement;
      if (received >= this.cart.grand_total) {
        box.classList.add('success');
      } else {
        box.classList.remove('success');
      }
    }
  },

  setCashAmount(amt) {
    this.payment.cash_received = amt;
    const input = document.getElementById('pay-cash-input');
    if (input) input.value = amt;
    this.handleCashInput(amt);
  },

  async processCheckout() {
    if (this.payment.method === 'cash' && this.payment.cash_received < this.cart.grand_total) {
      showToast('Uang pembayaran masih kurang!', 'danger');
      return;
    }

    const currentUser = getCurrentUser();

    const payload = {
      items: this.cart.items,
      subtotal: this.cart.subtotal,
      discount_type: this.cart.discount_type,
      discount_value: this.cart.discount_value,
      discount_amount: this.cart.discount_amount,
      tax_percent: this.cart.tax_enabled ? this.cart.tax_percent : 0,
      tax_amount: this.cart.tax_amount,
      grand_total: this.cart.grand_total,
      payment_method: this.payment.method,
      cash_received: this.payment.method === 'cash' ? this.payment.cash_received : this.cart.grand_total,
      change_amount: this.payment.method === 'cash' ? this.payment.change_amount : 0,
      payment_reference: this.payment.reference || null,
      user_id: currentUser ? currentUser.id : null,
      cashier_name: currentUser ? currentUser.name : 'Kasir',
      hold_id: this.cart.hold_id
    };

    try {
      const res = await API.request('/api/transactions/checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      showToast('Transaksi berhasil disimpan!', 'success');
      this.closeModal();

      await this.loadProducts();
      this.resetCart();

      if (res.receipt) {
        ReceiptEngine.showPreview(res.receipt);
      }
    } catch (err) {
      showToast(err.message || 'Gagal memproses transaksi', 'danger');
    }
  },

  resetCart() {
    this.cart.items = [];
    this.cart.subtotal = 0;
    this.cart.discount_value = 0;
    this.cart.discount_amount = 0;
    this.cart.tax_amount = 0;
    this.cart.grand_total = 0;
    this.cart.hold_id = null;
    this.renderCart();
    this.focusBarcodeInput();
    this.updateHeldBadge();
  },

  async holdCurrentTransaction() {
    if (this.cart.items.length === 0) {
      showToast('Keranjang belanja kosong', 'warning');
      return;
    }

    const customerName = prompt('Nama/Catatan Pelanggan untuk transaksi ini:', 'Pelanggan ' + (new Date().toLocaleTimeString('id-ID')));
    if (customerName === null) return;

    try {
      const currentUser = getCurrentUser();
      await API.request('/api/transactions/hold', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: customerName || 'Pelanggan',
          cart_data: this.cart,
          user_id: currentUser ? currentUser.id : null
        })
      });

      showToast('Transaksi berhasil ditahan (HOLD)', 'success');
      this.resetCart();
    } catch (err) {
      showToast('Gagal menahan transaksi: ' + err.message, 'danger');
    }
  },

  async openHeldModal() {
    try {
      const res = await API.request('/api/transactions/hold');
      const holds = res.data || [];

      const modal = document.getElementById('generic-modal');
      modal.innerHTML = `
        <div class="modal-content modal-content-lg">
          <div class="modal-header">
            <h3>Daftar Transaksi Ditahan (Pending)</h3>
            <button class="modal-close-btn" onclick="POS.closeModal()">&times;</button>
          </div>
          <div class="modal-body" style="padding: 0;">
            ${holds.length === 0 ? `
              <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                Tidak ada transaksi yang sedang ditahan.
              </div>
            ` : `
              <div class="table-responsive" style="border: none;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>ID Hold</th>
                      <th>Pelanggan / Catatan</th>
                      <th>Waktu</th>
                      <th>Item</th>
                      <th>Total</th>
                      <th style="text-align: right;">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${holds.map(h => `
                      <tr>
                        <td><strong>${h.hold_id}</strong></td>
                        <td>${h.customer_name || '-'}</td>
                        <td>${formatDateTime(h.created_at)}</td>
                        <td><span class="badge badge-neutral">${h.item_count} item</span></td>
                        <td><strong>${formatRupiah(h.grand_total)}</strong></td>
                        <td style="text-align: right; white-space: nowrap;">
                          <button class="btn btn-sm btn-primary" onclick="POS.resumeHeldTransaction('${h.hold_id}')">Lanjutkan</button>
                          <button class="btn btn-sm btn-danger-outline" onclick="POS.deleteHeldTransaction('${h.hold_id}')">Hapus</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="POS.closeModal()">Tutup</button>
          </div>
        </div>
      `;
      modal.style.display = 'flex';
    } catch (err) {
      showToast('Gagal memuat transaksi hold', 'danger');
    }
  },

  async resumeHeldTransaction(holdId) {
    try {
      const res = await API.request('/api/transactions/hold');
      const hold = (res.data || []).find(h => h.hold_id === holdId);
      if (!hold) return;

      if (this.cart.items.length > 0) {
        if (!confirm('Keranjang saat ini berisi item. Timpa dengan transaksi yang di-resume?')) {
          return;
        }
      }

      this.cart = {
        ...hold.cart_data,
        hold_id: hold.hold_id
      };

      this.calculateCart();
      this.renderCart();
      this.closeModal();
      showToast(`Transaksi ${hold.hold_id} dimuat kembali`, 'info');
    } catch (err) {
      showToast('Gagal memulihkan transaksi', 'danger');
    }
  },

  async deleteHeldTransaction(holdId) {
    if (!confirm(`Hapus transaksi pending ${holdId}?`)) return;
    try {
      await API.request(`/api/transactions/hold/${holdId}`, { method: 'DELETE' });
      showToast('Transaksi hold dihapus', 'info');
      this.openHeldModal();
      this.updateHeldBadge();
    } catch (err) {
      showToast('Gagal menghapus', 'danger');
    }
  },

  async updateHeldBadge() {
    try {
      const res = await API.request('/api/transactions/hold');
      const count = (res.data || []).length;
      const badge = document.getElementById('pos-held-badge');
      if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
      }
    } catch (e) {}
  },

  voidCurrentCart() {
    if (this.cart.items.length === 0) return;
    if (confirm('Batalkan (Void) seluruh keranjang belanja saat ini?')) {
      this.resetCart();
      showToast('Keranjang belanja telah dibatalkan', 'info');
    }
  },

  closeModal() {
    const payModal = document.getElementById('payment-modal');
    if (payModal) payModal.style.display = 'none';

    const genModal = document.getElementById('generic-modal');
    if (genModal) genModal.style.display = 'none';

    ReceiptEngine.closePreview();
    this.focusBarcodeInput();
  },

  bindShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        this.openPaymentModal();
      } else if (e.key === 'F2') {
        e.preventDefault();
        this.holdCurrentTransaction();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const payModal = document.getElementById('payment-modal');
        const genModal = document.getElementById('generic-modal');
        const receiptModal = document.getElementById('receipt-preview-modal');

        if (payModal && payModal.style.display === 'flex') {
          this.closeModal();
        } else if (genModal && genModal.style.display === 'flex') {
          this.closeModal();
        } else if (receiptModal && receiptModal.style.display === 'flex') {
          ReceiptEngine.closePreview();
        } else {
          this.voidCurrentCart();
        }
      }
    });
  },

  bindEvents() {
    const barcodeInput = document.getElementById('pos-barcode-input');
    if (barcodeInput) {
      barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleBarcodeEnter(barcodeInput.value);
        }
      });
      barcodeInput.addEventListener('input', () => {
        this.filterProducts();
      });
    }

    const taxSwitch = document.getElementById('pos-tax-switch');
    if (taxSwitch) {
      taxSwitch.addEventListener('change', (e) => {
        this.toggleTax(e.target.checked);
      });
    }

    const openCartBtn = document.getElementById('tablet-open-cart-btn');
    const closeCartBtn = document.getElementById('tablet-close-cart-btn');
    const cartCol = document.getElementById('pos-cart-column');
    const backdrop = document.getElementById('pos-cart-backdrop');

    if (openCartBtn && cartCol && backdrop) {
      openCartBtn.addEventListener('click', () => {
        cartCol.classList.add('open');
        backdrop.classList.add('open');
      });
    }
    if (closeCartBtn && cartCol && backdrop) {
      closeCartBtn.addEventListener('click', () => {
        cartCol.classList.remove('open');
        backdrop.classList.remove('open');
      });
    }
    if (backdrop && cartCol) {
      backdrop.addEventListener('click', () => {
        cartCol.classList.remove('open');
        backdrop.classList.remove('open');
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('pos-barcode-input')) {
    POS.init();
  }
});
