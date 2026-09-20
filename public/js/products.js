/* =========================================================
   Manajemen Produk & Supplier (Inventori) - High Performance
   ========================================================= */

// Kompresor foto otomatis client-side via Canvas (Max ~3KB per gambar agar ribuan produk tetap super ringan)
function compressImageFile(file, maxDim = 120, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

const Products = {
  items: [],
  suppliers: [],
  currentPage: 1,
  pageSize: 20,
  currentFilter: {
    q: '',
    low_stock: false
  },

  async init() {
    await this.loadSuppliers();
    await this.loadProducts();
    this.bindEvents();
  },

  async loadSuppliers() {
    try {
      const res = await API.request('/api/suppliers');
      this.suppliers = res.data || [];
    } catch (e) {
      showToast('Gagal memuat supplier', 'danger');
    }
  },

  async loadProducts() {
    try {
      let url = `/api/products?q=${encodeURIComponent(this.currentFilter.q)}`;
      if (this.currentFilter.low_stock) {
        url += '&low_stock=true';
      }
      const res = await API.request(url);
      this.items = res.data || [];
      this.currentPage = 1;
      this.renderProductTable();
    } catch (e) {
      showToast('Gagal memuat produk', 'danger');
    }
  },

  changePage(page) {
    this.currentPage = page;
    this.renderProductTable();
  },

  renderProductTable() {
    const tbody = document.getElementById('products-table-body');
    const paginationContainer = document.getElementById('products-pagination-container');
    if (!tbody) return;

    if (this.items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">
            Belum ada produk. Klik tombol <strong>+ Tambah Produk</strong> untuk mulai input manual.
          </td>
        </tr>
      `;
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    // Paginasi cepat agar tabel tetap responsif walau ada ribuan barang
    const totalPages = Math.ceil(this.items.length / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = startIdx + this.pageSize;
    const pageItems = this.items.slice(startIdx, endIdx);

    const fallbackSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.35;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;

    tbody.innerHTML = pageItems.map(p => {
      const stockNum = parseInt(p.stock, 10) || 0;
      const minStockNum = parseInt(p.min_stock, 10) || 5;
      const isLowStock = stockNum <= minStockNum;
      const isOut = stockNum <= 0;
      const thumb = p.image
        ? `<img src="${p.image.startsWith('http') || p.image.startsWith('data:') ? p.image : 'uploads/' + p.image}" alt="${p.name}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px;">`
        : `<div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: #f1f5f9; border-radius: 4px; margin: 0 auto;">${fallbackSvg}</div>`;

      return `
        <tr>
          <td style="width: 50px; text-align: center;">${thumb}</td>
          <td><code style="font-size: 11px; background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">${p.barcode}</code></td>
          <td><strong>${p.name}</strong></td>
          <td>${formatRupiah(p.cost_price)}</td>
          <td><strong>${formatRupiah(p.selling_price)}</strong></td>
          <td>
            <span class="badge ${isOut ? 'badge-danger' : isLowStock ? 'badge-warning' : 'badge-success'}">
              ${stockNum} ${p.unit}
            </span>
            ${isLowStock && !isOut ? `<div style="font-size: 10px; color: var(--danger); font-weight: 600;">Min: ${minStockNum}</div>` : ''}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-sm btn-secondary" onclick="Products.openEditModal('${p.id}')">Edit</button>
            <button class="btn btn-sm btn-danger-outline" onclick="Products.deleteProduct('${p.id}')">Hapus</button>
          </td>
        </tr>
      `;
    }).join('');

    // Render kontrol paginasi
    if (paginationContainer) {
      if (this.items.length <= this.pageSize) {
        paginationContainer.innerHTML = '';
      } else {
        paginationContainer.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 4px; font-size: 13px; flex-wrap: wrap; gap: 10px; border-top: 1px solid var(--border-color); margin-top: 8px;">
            <div style="color: var(--text-muted);">
              Menampilkan <strong>${startIdx + 1} - ${Math.min(endIdx, this.items.length)}</strong> dari <strong>${this.items.length}</strong> produk
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn btn-sm btn-secondary" onclick="Products.changePage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''}>
                Sebelumnya
              </button>
              <span style="font-weight: 600; padding: 0 8px;">Hal ${this.currentPage} dari ${totalPages}</span>
              <button class="btn btn-sm btn-secondary" onclick="Products.changePage(${this.currentPage + 1})" ${this.currentPage >= totalPages ? 'disabled' : ''}>
                Selanjutnya
              </button>
            </div>
          </div>
        `;
      }
    }
  },

  openAddModal() {
    this.showProductModal(null);
  },

  openEditModal(productId) {
    const prod = this.items.find(p => String(p.id) === String(productId));
    if (!prod) return;
    this.showProductModal(prod);
  },

  showProductModal(product) {
    const isEdit = !!product;
    const modal = document.getElementById('generic-modal');

    modal.innerHTML = `
      <div class="modal-content modal-content-lg">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Produk' : 'Tambah Produk Baru (Input Manual)'}</h3>
          <button class="modal-close-btn" onclick="Products.closeModal()">&times;</button>
        </div>
        <form id="product-form" onsubmit="Products.handleProductSubmit(event, ${isEdit ? `'${product.id}'` : 'null'})">
          <div class="modal-body">
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 14px;">
              <div class="form-group">
                <label>Barcode / SKU *</label>
                <input type="text" id="prod-barcode" class="form-control" value="${isEdit ? product.barcode : ''}" required placeholder="Scan atau ketik barcode" autofocus>
              </div>
              <div class="form-group">
                <label>Nama Produk *</label>
                <input type="text" id="prod-name" class="form-control" value="${isEdit ? product.name : ''}" required placeholder="Nama lengkap produk">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label>Harga Beli (Modal / HPP) *</label>
                <input type="number" id="prod-cost" class="form-control" value="${isEdit ? product.cost_price : ''}" required min="0" placeholder="0">
              </div>
              <div class="form-group">
                <label>Harga Jual *</label>
                <input type="number" id="prod-price" class="form-control" value="${isEdit ? product.selling_price : ''}" required min="0" placeholder="0">
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
              <div class="form-group">
                <label>${isEdit ? 'Stok Saat Ini *' : 'Stok Awal'}</label>
                <input type="number" id="prod-stock" class="form-control" value="${isEdit ? (product.stock ?? 0) : 0}" min="0">
              </div>
              <div class="form-group">
                <label>Batas Stok Minimum *</label>
                <input type="number" id="prod-min-stock" class="form-control" value="${isEdit ? product.min_stock : '5'}" min="0">
              </div>
              <div class="form-group">
                <label>Satuan</label>
                <input type="text" id="prod-unit" class="form-control" value="${isEdit ? product.unit : 'pcs'}" placeholder="pcs, kg, box, botol">
              </div>
            </div>

            <div class="form-group">
              <label>Foto Produk (Opsional)</label>
              <input type="file" id="prod-image" class="form-control" accept="image/*">
              ${isEdit && product.image ? `<small style="color: var(--text-muted);">Foto saat ini: ${product.image}</small>` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="Products.closeModal()">Batal</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Simpan Perubahan' : 'Tambah Produk'}</button>
          </div>
        </form>
      </div>
    `;
    modal.style.display = 'flex';
  },
  async handleProductSubmit(e, editId) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('barcode', document.getElementById('prod-barcode').value.trim());
    formData.append('name', document.getElementById('prod-name').value.trim());
    formData.append('cost_price', document.getElementById('prod-cost').value);
    formData.append('selling_price', document.getElementById('prod-price').value);
    formData.append('min_stock', document.getElementById('prod-min-stock').value);
    formData.append('unit', document.getElementById('prod-unit').value.trim() || 'pcs');

    const stockInput = document.getElementById('prod-stock');
    if (stockInput) {
      formData.append('stock', stockInput.value || 0);
    }

    const imageInput = document.getElementById('prod-image');
    if (imageInput && imageInput.files[0]) {
      const compressed = await compressImageFile(imageInput.files[0]);
      if (compressed) {
        formData.append('image', compressed);
      } else {
        formData.append('image', imageInput.files[0]);
      }
    }

    try {
      const isEditing = editId && editId !== 'null' && editId !== null && editId !== undefined;
      if (isEditing) {
        await API.upload(`/api/products/${editId}`, formData, 'PUT');
        showToast('Produk dan stok berhasil diperbarui', 'success');
      } else {
        await API.upload('/api/products', formData, 'POST');
        showToast('Produk berhasil ditambahkan', 'success');
      }
      this.closeModal();
      await this.loadProducts();
      Auth.updateLowStockBadge();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan produk', 'danger');
    }
  },

  async deleteProduct(productId) {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      await API.request(`/api/products/${productId}`, { method: 'DELETE' });
      showToast('Produk berhasil dihapus', 'info');
      await this.loadProducts();
      Auth.updateLowStockBadge();
    } catch (err) {
      showToast(err.message || 'Gagal menghapus produk', 'danger');
    }
  },

  // Modal Manajemen Supplier
  openSupplierModal() {
    const modal = document.getElementById('generic-modal');
    modal.innerHTML = `
      <div class="modal-content modal-content-lg">
        <div class="modal-header">
          <h3>Kelola Supplier / Vendor</h3>
          <button class="modal-close-btn" onclick="Products.closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <input type="text" id="new-sup-name" class="form-control" placeholder="Nama Supplier *">
            <input type="text" id="new-sup-phone" class="form-control" placeholder="No. Telepon / Kontak">
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <input type="text" id="new-sup-addr" class="form-control" placeholder="Alamat Supplier">
            <button class="btn btn-primary" style="white-space: nowrap;" onclick="Products.addSupplier()">+ Tambah</button>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Nama Supplier</th>
                  <th>Telepon</th>
                  <th>Alamat</th>
                  <th style="text-align: right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${this.suppliers.map(s => `
                  <tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.phone || '-'}</td>
                    <td>${s.address || '-'}</td>
                    <td style="text-align: right;">
                      <button class="btn btn-sm btn-danger-outline" onclick="Products.deleteSupplier(${s.id})">Hapus</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Products.closeModal()">Selesai</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  async addSupplier() {
    const name = document.getElementById('new-sup-name').value.trim();
    const phone = document.getElementById('new-sup-phone').value.trim();
    const address = document.getElementById('new-sup-addr').value.trim();
    if (!name) {
      showToast('Nama supplier wajib diisi', 'warning');
      return;
    }
    try {
      await API.request('/api/suppliers', {
        method: 'POST',
        body: JSON.stringify({ name, phone, address })
      });
      showToast('Supplier berhasil ditambahkan', 'success');
      await this.loadSuppliers();
      this.openSupplierModal();
    } catch (e) {
      showToast(e.message || 'Gagal menambah supplier', 'danger');
    }
  },

  async deleteSupplier(id) {
    if (!confirm('Hapus supplier ini?')) return;
    try {
      await API.request(`/api/suppliers/${id}`, { method: 'DELETE' });
      showToast('Supplier dihapus', 'info');
      await this.loadSuppliers();
      this.openSupplierModal();
    } catch (e) {
      showToast(e.message || 'Gagal menghapus supplier', 'danger');
    }
  },

  // Export Backup JSON
  exportBackup() {
    try {
      const data = MockDB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup-pos-minimarket-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Backup data berhasil diunduh', 'success');
    } catch (e) {
      showToast('Gagal melakukan backup: ' + e.message, 'danger');
    }
  },

  // Trigger restore dialog
  triggerRestore() {
    const input = document.getElementById('backup-file-input');
    if (input) {
      input.value = '';
      input.click();
    }
  },

  // Handle file restore
  async handleRestoreFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!confirm('Peringatan: Restore data akan memperbarui data lokal dengan isi file backup ini. Lanjutkan?')) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      MockDB.importAll(parsed);
      showToast('Data berhasil dipulihkan (restore)!', 'success');
      await this.loadSuppliers();
      await this.loadProducts();
      if (typeof Auth !== 'undefined' && Auth.updateLowStockBadge) {
        Auth.updateLowStockBadge();
      }
    } catch (err) {
      showToast('Gagal restore: ' + (err.message || 'File tidak valid'), 'danger');
    }
  },

  closeModal() {
    const modal = document.getElementById('generic-modal');
    if (modal) modal.style.display = 'none';
  },

  bindEvents() {
    const searchInput = document.getElementById('search-products');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilter.q = e.target.value;
        this.loadProducts();
      });
    }

    const lowStockBtn = document.getElementById('filter-low-stock-btn');
    if (lowStockBtn) {
      lowStockBtn.addEventListener('click', () => {
        this.currentFilter.low_stock = !this.currentFilter.low_stock;
        lowStockBtn.classList.toggle('btn-primary', this.currentFilter.low_stock);
        lowStockBtn.classList.toggle('btn-secondary', !this.currentFilter.low_stock);
        this.loadProducts();
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('products-table-body')) {
    Products.init();
  }
});
