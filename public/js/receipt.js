/* =========================================================
   Thermal Receipt 58mm Engine & Preview Generator
   Layout 12 Bagian Standar Printer Kasir Thermal 58mm
   ========================================================= */

const ReceiptEngine = {
  // Generate HTML Struk 58mm
  generateReceiptHTML(tx) {
    const settings = tx.settings || {};
    const storeName = settings.store_name || 'MINIMARKET SEJAHTERA';
    const storeAddress = settings.store_address || 'Jl. Raya Darmo No. 45, Surabaya';
    const storePhone = settings.store_phone || '0812-3456-7890';
    const receiptFooter = settings.receipt_footer || 'Barang yang sudah dibeli tidak dapat ditukar';

    // 32 karakter monospace separator
    const lineDouble = '================================';
    const lineSingle = '--------------------------------';

    const invoiceNo = tx.invoice_no || tx.invoice || '-';
    const dateFormatted = tx.created_at ? formatDateTime(tx.created_at) : formatDateTime(new Date());
    const cashier = tx.cashier_name || 'Kasir';

    // Item Rows
    let itemsHTML = '';
    const items = tx.items || [];
    items.forEach(item => {
      const name = item.product_name || item.name || 'Produk';
      const qty = item.qty || 1;
      const price = parseFloat(item.selling_price || item.price || 0);
      const subtotal = parseFloat(item.subtotal || (qty * price));
      const disc = parseFloat(item.discount_amount || 0);

      itemsHTML += `
        <div class="rcp-item-row">
          <div class="rcp-item-name">${name}</div>
          <div class="rcp-item-subline">
            <span class="rcp-item-qtyprice">${qty} x ${formatRupiah(price)}</span>
            <span class="rcp-item-subtotal">${formatRupiah(subtotal)}</span>
          </div>
          ${disc > 0 ? `<div style="font-size: 9px; padding-left: 6px; color: #555;">(Diskon: -${formatRupiah(disc)})</div>` : ''}
        </div>
      `;
    });

    const subtotal = parseFloat(tx.subtotal || 0);
    const discountAmount = parseFloat(tx.discount_amount || 0);
    const taxAmount = parseFloat(tx.tax_amount || 0);
    const grandTotal = parseFloat(tx.grand_total || 0);
    const payMethod = (tx.payment_method || 'TUNAI').toUpperCase();
    const cashReceived = parseFloat(tx.cash_received || 0);
    const changeAmount = parseFloat(tx.change_amount || 0);

    return `
      <div class="receipt-paper" id="receipt-paper-content">
        <!-- 1. Nama Toko -->
        <div class="rcp-store-name">${storeName}</div>
        
        <!-- 2. Alamat & No Telp -->
        <div class="rcp-store-address">${storeAddress}</div>
        <div class="rcp-store-phone">Telp: ${storePhone}</div>
        
        <!-- 3. Garis Pemisah (====) -->
        <div class="rcp-divider-double">${lineDouble}</div>
        
        <!-- 4. No Struk, Tanggal & Jam, Nama Kasir -->
        <div class="rcp-meta-row">
          <span>No: ${invoiceNo}</span>
          <span>${cashier}</span>
        </div>
        <div class="rcp-meta-row">
          <span>Tgl: ${dateFormatted}</span>
        </div>
        
        <!-- 5. Garis Pemisah (----) -->
        <div class="rcp-divider-single">${lineSingle}</div>
        
        <!-- 6. Daftar Item -->
        <div class="rcp-items-table">
          ${itemsHTML}
        </div>
        
        <!-- 7. Garis Pemisah (----) -->
        <div class="rcp-divider-single">${lineSingle}</div>
        
        <!-- 8. Subtotal, Diskon, Pajak, TOTAL -->
        <div class="rcp-summary-row">
          <span>Subtotal</span>
          <span>${formatRupiah(subtotal)}</span>
        </div>
        ${discountAmount > 0 ? `
          <div class="rcp-summary-row">
            <span>Diskon</span>
            <span>-${formatRupiah(discountAmount)}</span>
          </div>
        ` : ''}
        ${taxAmount > 0 ? `
          <div class="rcp-summary-row">
            <span>PPN (${tx.tax_percent || 11}%)</span>
            <span>${formatRupiah(taxAmount)}</span>
          </div>
        ` : ''}
        <div class="rcp-grand-total">
          <span>TOTAL</span>
          <span>${formatRupiah(grandTotal)}</span>
        </div>
        
        <!-- 9. Bayar & Kembalian -->
        <div class="rcp-payment-row">
          <span>Bayar (${payMethod})</span>
          <span>${payMethod === 'TUNAI' || payMethod === 'CASH' ? formatRupiah(cashReceived) : formatRupiah(grandTotal)}</span>
        </div>
        ${(payMethod === 'TUNAI' || payMethod === 'CASH') ? `
          <div class="rcp-payment-row">
            <span>Kembalian</span>
            <span>${formatRupiah(changeAmount)}</span>
          </div>
        ` : ''}
        
        <!-- 10. Garis Pemisah (====) -->
        <div class="rcp-divider-double">${lineDouble}</div>
        
        <!-- 11. Ucapan Terima Kasih & Catatan -->
        <div class="rcp-footer">
          <div class="thanks">TERIMA KASIH ATAS KUNJUNGAN ANDA</div>
          <div>${receiptFooter}</div>
        </div>
        
        <!-- 12. Ruang Kosong 3-4 Baris untuk Cutter Printer -->
        <div class="rcp-cutter-feed">&nbsp;<br>&nbsp;<br>&nbsp;</div>
      </div>
    `;
  },

  // Tampilkan Modal Preview Struk di Layar
  showPreview(transactionData) {
    // Siapkan print area di body
    let printArea = document.getElementById('thermal-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'thermal-print-area';
      document.body.appendChild(printArea);
    }

    const receiptHtml = this.generateReceiptHTML(transactionData);
    printArea.innerHTML = receiptHtml;

    // Buat Modal Preview
    let modal = document.getElementById('receipt-preview-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'receipt-preview-modal';
      modal.className = 'receipt-modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="receipt-preview-container">
        <div class="receipt-modal-header">
          <h3>Preview Struk (58mm)</h3>
          <button class="modal-close-btn" onclick="ReceiptEngine.closePreview()">&times;</button>
        </div>
        <div class="receipt-scroll-area">
          ${receiptHtml}
        </div>
        <div class="receipt-modal-actions">
          <button class="btn btn-secondary" style="flex: 1;" onclick="ReceiptEngine.closePreview()">Tutup</button>
          <button class="btn btn-primary" style="flex: 1;" onclick="ReceiptEngine.print()">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Cetak Struk
          </button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  closePreview() {
    const modal = document.getElementById('receipt-preview-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  },

  print() {
    window.print();
  }
};
