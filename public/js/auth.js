/* =========================================================
   Header Utilities & Store Settings Management
   ========================================================= */

const Auth = {
  init() {
    // Jika masih membuka login.html, otomatis alihkan langsung ke kasir
    if (window.location.pathname.includes('login.html')) {
      window.location.replace('index.html');
      return;
    }

    this.updateLowStockBadge();
  },

  async updateLowStockBadge() {
    try {
      const res = await API.request('/api/products/low-stock-count');
      const badge = document.getElementById('header-low-stock-badge');
      if (badge) {
        if (res.count > 0) {
          badge.innerText = res.count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {}
  },

  // Modal Pengaturan Struk & Toko
  async openStoreSettingsModal() {
    try {
      const res = await API.request('/api/auth/settings');
      const s = res.settings || {};

      let modal = document.getElementById('generic-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'generic-modal';
        modal.className = 'modal-backdrop';
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h3>Pengaturan Toko & Struk Kasir</h3>
            <button class="modal-close-btn" onclick="Auth.closeSettingsModal()">&times;</button>
          </div>
          <form onsubmit="Auth.saveStoreSettings(event)">
            <div class="modal-body">
              <div class="form-group">
                <label>Nama Toko (Header Struk) *</label>
                <input type="text" id="setting-store-name" class="form-control" value="${s.store_name || ''}" required placeholder="Contoh: TOKO BERKAH REZEKI">
              </div>

              <div class="form-group">
                <label>Alamat Toko (Struk)</label>
                <input type="text" id="setting-store-address" class="form-control" value="${s.store_address || ''}" placeholder="Jl. Raya No. 123, Kota">
              </div>

              <div class="form-group">
                <label>No. Telepon / WhatsApp Toko</label>
                <input type="text" id="setting-store-phone" class="form-control" value="${s.store_phone || ''}" placeholder="0812-3456-7890">
              </div>

              <div class="form-group">
                <label>Pajak Standar PPN (%)</label>
                <input type="number" step="0.1" id="setting-tax-percent" class="form-control" value="${s.tax_percent || '11'}" placeholder="11">
              </div>

              <div class="form-group">
                <label>Catatan / Pesan Footer Struk</label>
                <textarea id="setting-receipt-footer" class="form-control" rows="2" placeholder="Barang yang sudah dibeli tidak dapat ditukar">${s.receipt_footer || 'Barang yang sudah dibeli tidak dapat ditukar'}</textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Auth.closeSettingsModal()">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan Pengaturan</button>
            </div>
          </form>
        </div>
      `;
      modal.style.display = 'flex';
    } catch (e) {
      showToast('Gagal memuat pengaturan toko', 'danger');
    }
  },

  async saveStoreSettings(e) {
    e.preventDefault();
    const store_name = document.getElementById('setting-store-name').value.trim();
    const store_address = document.getElementById('setting-store-address').value.trim();
    const store_phone = document.getElementById('setting-store-phone').value.trim();
    const tax_percent = document.getElementById('setting-tax-percent').value;
    const receipt_footer = document.getElementById('setting-receipt-footer').value.trim();

    try {
      await API.request('/api/auth/settings', {
        method: 'PUT',
        body: JSON.stringify({
          store_name,
          store_address,
          store_phone,
          tax_percent,
          receipt_footer
        })
      });

      showToast('Pengaturan struk & toko berhasil disimpan!', 'success');
      this.closeSettingsModal();

      // Update brand text jika ada di halaman
      const brandH1 = document.querySelector('.brand-text h1');
      if (brandH1) brandH1.innerText = store_name;

      // Update POS cart settings jika di halaman kasir
      if (typeof POS !== 'undefined' && POS.loadStoreSettings) {
        POS.loadStoreSettings();
      }
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan pengaturan', 'danger');
    }
  },

  closeSettingsModal() {
    const modal = document.getElementById('generic-modal');
    if (modal) modal.style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Auth.init();
});
