/* =========================================================
   Manajemen Stok Masuk, Stok Opname & Mutasi Kartu Stok
   ========================================================= */

const Stock = {
  products: [],
  suppliers: [],
  movements: [],
  activeTab: 'in',

  async init() {
    await this.loadInitialData();
    this.switchTab('in');
    this.bindEvents();
  },

  async loadInitialData() {
    try {
      const [pRes, sRes] = await Promise.all([
        API.request('/api/products'),
        API.request('/api/suppliers')
      ]);
      this.products = pRes.data || [];
      this.suppliers = sRes.data || [];

      this.populateProductSelects();
      this.populateSupplierSelects();
    } catch (e) {
      showToast('Gagal memuat data inventori', 'danger');
    }
  },

  populateProductSelects() {
    const selIn = document.getElementById('stock-in-product');
    const selAdj = document.getElementById('stock-adj-product');
    const selFilter = document.getElementById('movement-filter-product');

    const options = '<option value="">-- Pilih Produk --</option>' + 
      this.products.map(p => `<option value="${p.id}" data-stock="${p.stock}" data-cost="${p.cost_price}">${p.name} (${p.barcode}) - Stok: ${p.stock}</option>`).join('');

    if (selIn) selIn.innerHTML = options;
    if (selAdj) selAdj.innerHTML = options;
    if (selFilter) selFilter.innerHTML = '<option value="">Semua Produk</option>' + 
      this.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  },

  populateSupplierSelects() {
    const sel = document.getElementById('stock-in-supplier');
    if (sel) {
      sel.innerHTML = '<option value="">-- Tanpa Supplier / Pembelian Langsung --</option>' +
        this.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.stock-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    document.getElementById('view-stock-in').style.display = tab === 'in' ? 'block' : 'none';
    document.getElementById('view-stock-adj').style.display = tab === 'adj' ? 'block' : 'none';
    document.getElementById('view-stock-history').style.display = tab === 'history' ? 'block' : 'none';

    if (tab === 'history') {
      this.loadMovements();
    }
  },

  // 1. Submit Stok Masuk
  async handleStockInSubmit(e) {
    e.preventDefault();
    const productId = document.getElementById('stock-in-product').value;
    const supplierId = document.getElementById('stock-in-supplier').value;
    const qty = document.getElementById('stock-in-qty').value;
    const costPrice = document.getElementById('stock-in-cost').value;
    const ref = document.getElementById('stock-in-ref').value;
    const notes = document.getElementById('stock-in-notes').value;

    const user = getCurrentUser();

    try {
      await API.request('/api/stock/in', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          supplier_id: supplierId || null,
          qty: parseInt(qty, 10),
          cost_price: costPrice ? parseFloat(costPrice) : null,
          reference: ref || 'Penerimaan Barang',
          notes: notes,
          operator_name: user ? user.name : 'Petugas'
        })
      });

      showToast('Stok berhasil ditambahkan!', 'success');
      document.getElementById('form-stock-in').reset();
      await this.loadInitialData();
      Auth.updateLowStockBadge();
    } catch (err) {
      showToast(err.message || 'Gagal memproses stok masuk', 'danger');
    }
  },

  // 2. Submit Stok Opname (Adjustment)
  async handleStockAdjSubmit(e) {
    e.preventDefault();
    const productId = document.getElementById('stock-adj-product').value;
    const physicalStock = document.getElementById('stock-adj-physical').value;
    const reason = document.getElementById('stock-adj-reason').value;
    const notes = document.getElementById('stock-adj-notes').value;

    const user = getCurrentUser();

    try {
      await API.request('/api/stock/adjustment', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productId,
          physical_stock: parseInt(physicalStock, 10),
          reason: reason,
          notes: notes,
          operator_name: user ? user.name : 'Petugas Opname'
        })
      });

      showToast('Stok penyesuaian (opname) berhasil disimpan!', 'success');
      document.getElementById('form-stock-adj').reset();
      document.getElementById('stock-adj-diff-info').innerHTML = '';
      await this.loadInitialData();
      Auth.updateLowStockBadge();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan opname', 'danger');
    }
  },

  // 3. Load Riwayat Mutasi (Kartu Stok)
  async loadMovements() {
    const prodId = document.getElementById('movement-filter-product')?.value || '';
    const type = document.getElementById('movement-filter-type')?.value || 'ALL';

    try {
      let url = `/api/stock/movements?limit=100`;
      if (prodId) url += `&product_id=${prodId}`;
      if (type && type !== 'ALL') url += `&type=${type}`;

      const res = await API.request(url);
      this.movements = res.data || [];
      this.renderMovementsTable();
    } catch (err) {
      showToast('Gagal memuat mutasi stok', 'danger');
    }
  },

  renderMovementsTable() {
    const tbody = document.getElementById('movements-table-body');
    if (!tbody) return;

    if (this.movements.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">
            Belum ada riwayat pergerakan stok.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.movements.map(m => {
      let badgeClass = 'badge-neutral';
      let typeLabel = m.type;
      let qtyDisplay = m.qty;

      if (m.type === 'IN') {
        badgeClass = 'badge-success';
        typeLabel = 'MASUK';
        qtyDisplay = `+${m.qty}`;
      } else if (m.type === 'OUT') {
        badgeClass = 'badge-danger';
        typeLabel = 'KELUAR';
        qtyDisplay = `${m.qty}`;
      } else if (m.type === 'ADJUSTMENT') {
        badgeClass = 'badge-warning';
        typeLabel = 'PENYESUAIAN';
        qtyDisplay = m.qty > 0 ? `+${m.qty}` : `${m.qty}`;
      }

      return `
        <tr>
          <td><small>${formatDateTime(m.created_at)}</small></td>
          <td><strong>${m.product_name}</strong><br><code style="font-size: 10px; color: var(--text-muted);">${m.product_barcode}</code></td>
          <td><span class="badge ${badgeClass}">${typeLabel}</span></td>
          <td><strong style="color: ${m.qty > 0 ? 'var(--success)' : 'var(--danger)'};">${qtyDisplay} ${m.product_unit}</strong></td>
          <td>${m.stock_before}</td>
          <td><strong>${m.stock_after}</strong></td>
          <td><strong>${m.reference || '-'}</strong><br><small style="color: var(--text-muted);">${m.notes || ''}</small></td>
          <td><small>${m.operator_name || 'Kasir'}</small></td>
        </tr>
      `;
    }).join('');
  },

  bindEvents() {
    const selAdj = document.getElementById('stock-adj-product');
    const inputPhys = document.getElementById('stock-adj-physical');
    const diffInfo = document.getElementById('stock-adj-diff-info');

    const updateDiff = () => {
      if (!selAdj || !inputPhys || !diffInfo) return;
      const selected = selAdj.selectedOptions[0];
      if (!selected || !selected.dataset.stock) {
        diffInfo.innerHTML = '';
        return;
      }

      const systemStock = parseInt(selected.dataset.stock, 10);
      const physical = parseInt(inputPhys.value, 10);

      if (isNaN(physical)) {
        diffInfo.innerHTML = `<span style="color: var(--text-muted);">Stok di sistem saat ini: <strong>${systemStock}</strong></span>`;
        return;
      }

      const diff = physical - systemStock;
      if (diff === 0) {
        diffInfo.innerHTML = `<span class="badge badge-success">Cocok! Tidak ada selisih (Stok: ${systemStock})</span>`;
      } else if (diff > 0) {
        diffInfo.innerHTML = `<span class="badge badge-info">Selisih lebih +${diff} (Sistem: ${systemStock} -> Fisik: ${physical})</span>`;
      } else {
        diffInfo.innerHTML = `<span class="badge badge-danger">Selisih kurang ${diff} (Sistem: ${systemStock} -> Fisik: ${physical})</span>`;
      }
    };

    if (selAdj) selAdj.addEventListener('change', updateDiff);
    if (inputPhys) inputPhys.addEventListener('input', updateDiff);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('form-stock-in')) {
    Stock.init();
  }
});
