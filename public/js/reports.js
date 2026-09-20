/* =========================================================
   Laporan & Dashboard Analytics - Part 1
   ========================================================= */

const Reports = {
  activeTab: 'dashboard',
  dateFilter: {
    start: new Date().toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  },

  async init() {
    this.initDates();
    this.bindEvents();
    await this.loadDashboardData();
  },

  initDates() {
    const today = new Date().toISOString().slice(0, 10);
    this.dateFilter.start = today;
    this.dateFilter.end = today;

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput) startInput.value = today;
    if (endInput) endInput.value = today;
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.report-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    document.getElementById('view-dashboard').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('view-sales').style.display = tab === 'sales' ? 'block' : 'none';
    document.getElementById('view-profit').style.display = tab === 'profit' ? 'block' : 'none';
    document.getElementById('view-inventory').style.display = tab === 'inventory' ? 'block' : 'none';

    if (tab === 'dashboard') this.loadDashboardData();
    if (tab === 'sales') this.loadSalesReport();
    if (tab === 'profit') this.loadGrossProfitReport();
    if (tab === 'inventory') this.loadInventoryValuation();
  },

  // 1. Dashboard Metrics & Trends
  async loadDashboardData() {
    try {
      const res = await API.request('/api/reports/dashboard');
      const d = res.data;

      document.getElementById('dash-today-sales').innerText = formatRupiah(d.today.total_sales);
      document.getElementById('dash-today-tx').innerText = `${d.today.total_transactions} trx`;
      document.getElementById('dash-today-avg').innerText = formatRupiah(d.today.avg_transaction);
      document.getElementById('dash-today-profit').innerText = formatRupiah(d.today.gross_profit);

      this.renderTopProducts(d.top_products || []);
      this.renderSalesChart(d.chart_7_days || []);
    } catch (e) {
      showToast('Gagal memuat ringkasan dashboard', 'danger');
    }
  },

  renderTopProducts(items) {
    const container = document.getElementById('dash-top-products');
    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<div style="color: var(--text-muted); padding: 10px;">Belum ada penjualan tercatat.</div>';
      return;
    }

    container.innerHTML = items.map((p, idx) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: var(--accent-subtle); color: var(--accent-primary); font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center;">
            ${idx + 1}
          </div>
          <div>
            <div style="font-weight: 600; font-size: 13px;">${p.product_name}</div>
            <div style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${p.product_barcode}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; font-size: 13px;">${p.total_sold} terjual</div>
          <div style="font-size: 11px; color: var(--text-muted);">${formatRupiah(p.total_revenue)}</div>
        </div>
      </div>
    `).join('');
  },

  // Responsive SVG Chart Generator (Minimalist, zero dependency)
  renderSalesChart(data) {
    const chartContainer = document.getElementById('dash-sales-chart');
    if (!chartContainer) return;

    if (!data || data.length === 0) {
      chartContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Belum ada data grafik penjualan 7 hari terakhir.</div>';
      return;
    }

    const maxSales = Math.max(...data.map(d => parseFloat(d.total_sales)), 100000);
    const width = 600;
    const height = 200;
    const padding = 35;

    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 1.8;

    const barWidth = Math.max(16, Math.min(38, chartWidth / data.length - 14));

    const bars = data.map((d, i) => {
      const sales = parseFloat(d.total_sales);
      const barH = (sales / maxSales) * chartHeight;
      const x = padding + i * (chartWidth / data.length) + (chartWidth / data.length - barWidth) / 2;
      const y = height - padding - barH;
      const dateLabel = d.tx_date.slice(5); // MM-DD

      return `
        <g class="chart-bar-group">
          <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="#0f766e" />
          <text x="${x + barWidth / 2}" y="${height - 10}" font-size="10" fill="#64748b" text-anchor="middle">${dateLabel}</text>
          <text x="${x + barWidth / 2}" y="${y - 6}" font-size="9" font-weight="600" fill="#0f172a" text-anchor="middle">
            ${sales > 0 ? (sales >= 1000000 ? (sales/1000000).toFixed(1)+'jt' : (sales/1000).toFixed(0)+'k') : '0'}
          </text>
        </g>
      `;
    }).join('');

    chartContainer.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; max-height: 220px; overflow: visible;">
        <!-- Grid horizontal lines -->
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#e2e8f0" stroke-width="1"/>
        <line x1="${padding}" y1="${height - padding - chartHeight / 2}" x2="${width - padding}" y2="${height - padding - chartHeight / 2}" stroke="#e2e8f0" stroke-dasharray="3,3"/>
        <line x1="${padding}" y1="${height - padding - chartHeight}" x2="${width - padding}" y2="${height - padding - chartHeight}" stroke="#e2e8f0" stroke-dasharray="3,3"/>
        ${bars}
      </svg>
    `;
  },
  // 2. Laporan Penjualan
  async loadSalesReport() {
    const start = document.getElementById('report-start-date')?.value || this.dateFilter.start;
    const end = document.getElementById('report-end-date')?.value || this.dateFilter.end;
    const method = document.getElementById('report-payment-method')?.value || 'ALL';

    try {
      const res = await API.request(`/api/reports/sales?start_date=${start}&end_date=${end}&payment_method=${method}`);
      const s = res.summary;
      const txs = res.data || [];

      document.getElementById('sales-summary-total').innerText = formatRupiah(s.total_sales);
      document.getElementById('sales-summary-count').innerText = `${s.completed_transactions} transaksi`;
      document.getElementById('sales-summary-discount').innerText = formatRupiah(s.total_discount);
      document.getElementById('sales-summary-profit').innerText = formatRupiah(s.total_gross_profit);

      const tbody = document.getElementById('sales-table-body');
      if (!tbody) return;

      if (txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">Tidak ada transaksi pada periode ini.</td></tr>`;
        return;
      }

      tbody.innerHTML = txs.map(t => {
        const isVoid = t.status === 'void';
        return `
          <tr style="${isVoid ? 'opacity: 0.6; background-color: #fef2f2;' : ''}">
            <td><strong>${t.invoice_no}</strong></td>
            <td><small>${formatDateTime(t.created_at)}</small></td>
            <td>${t.cashier_name}</td>
            <td><span class="badge badge-neutral">${(t.payment_method || '').toUpperCase()}</span></td>
            <td>${t.total_items} item</td>
            <td><strong>${formatRupiah(t.grand_total)}</strong></td>
            <td><span class="badge ${isVoid ? 'badge-danger' : 'badge-success'}">${isVoid ? 'BATAL' : 'SELESAI'}</span></td>
            <td style="text-align: right; white-space: nowrap;">
              <button class="btn btn-sm btn-secondary" onclick="Reports.viewTransactionDetail('${t.invoice_no}')">Detail</button>
              <button class="btn btn-sm btn-primary" onclick="Reports.reprintReceipt('${t.invoice_no}')">Cetak Struk</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      showToast('Gagal memuat laporan penjualan', 'danger');
    }
  },

  async viewTransactionDetail(invoiceNo) {
    try {
      const res = await API.request(`/api/transactions/detail/${invoiceNo}`);
      const tx = res.data;
      const modal = document.getElementById('generic-modal');

      modal.innerHTML = `
        <div class="modal-content modal-content-lg">
          <div class="modal-header">
            <h3>Detail Transaksi: ${tx.invoice_no}</h3>
            <button class="modal-close-btn" onclick="Reports.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; font-size: 13px;">
              <div><strong>Waktu:</strong> ${formatDateTime(tx.created_at)}</div>
              <div><strong>Kasir:</strong> ${tx.cashier_name}</div>
              <div><strong>Metode Bayar:</strong> ${(tx.payment_method || '').toUpperCase()}</div>
              <div><strong>Status:</strong> <span class="badge ${tx.status === 'completed' ? 'badge-success' : 'badge-danger'}">${tx.status.toUpperCase()}</span></div>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th>Harga</th>
                    <th>Qty</th>
                    <th>Diskon</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${(tx.items || []).map(i => `
                    <tr>
                      <td><strong>${i.product_name}</strong><br><code style="font-size: 10px; color: var(--text-muted);">${i.product_barcode}</code></td>
                      <td>${formatRupiah(i.selling_price)}</td>
                      <td>${i.qty}</td>
                      <td>${i.discount_amount > 0 ? formatRupiah(i.discount_amount) : '-'}</td>
                      <td><strong>${formatRupiah(i.subtotal)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="margin-top: 14px; text-align: right; font-size: 14px; display: flex; flex-direction: column; gap: 4px;">
              <div>Subtotal: <strong>${formatRupiah(tx.subtotal)}</strong></div>
              ${tx.discount_amount > 0 ? `<div>Diskon: <strong>-${formatRupiah(tx.discount_amount)}</strong></div>` : ''}
              ${tx.tax_amount > 0 ? `<div>PPN (${tx.tax_percent}%): <strong>${formatRupiah(tx.tax_amount)}</strong></div>` : ''}
              <div style="font-size: 18px; font-weight: 800; color: var(--accent-primary); border-top: 1px solid var(--border-color); padding-top: 6px; margin-top: 4px;">
                TOTAL: ${formatRupiah(tx.grand_total)}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Reports.closeModal()">Tutup</button>
            <button class="btn btn-primary" onclick="Reports.reprintReceipt('${tx.invoice_no}')">Cetak Ulang Struk</button>
          </div>
        </div>
      `;
      modal.style.display = 'flex';
    } catch (e) {
      showToast('Gagal memuat detail transaksi', 'danger');
    }
  },

  async reprintReceipt(invoiceNo) {
    try {
      const res = await API.request(`/api/transactions/detail/${invoiceNo}`);
      ReceiptEngine.showPreview(res.data);
    } catch (e) {
      showToast('Gagal memuat struk', 'danger');
    }
  },

  // 3. Laporan Laba Kotor
  async loadGrossProfitReport() {
    const start = document.getElementById('report-start-date')?.value || this.dateFilter.start;
    const end = document.getElementById('report-end-date')?.value || this.dateFilter.end;

    try {
      const res = await API.request(`/api/reports/gross-profit?start_date=${start}&end_date=${end}`);
      const s = res.summary;
      const items = res.data || [];

      document.getElementById('profit-summary-revenue').innerText = formatRupiah(s.total_revenue);
      document.getElementById('profit-summary-cost').innerText = formatRupiah(s.total_cost);
      document.getElementById('profit-summary-gross').innerText = formatRupiah(s.total_gross_profit);
      document.getElementById('profit-summary-margin').innerText = `${s.margin_percent}%`;

      const tbody = document.getElementById('profit-table-body');
      if (!tbody) return;

      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">Belum ada data laba kotor pada periode ini.</td></tr>`;
        return;
      }

      tbody.innerHTML = items.map(p => `
        <tr>
          <td><strong>${p.product_name || p.name || 'Produk'}</strong><br><code style="font-size: 10px; color: var(--text-muted);">${p.product_barcode || p.barcode || '-'}</code></td>
          <td>${p.total_qty || p.total_sold || 0}</td>
          <td>${formatRupiah(p.total_cost)}</td>
          <td>${formatRupiah(p.total_revenue)}</td>
          <td><strong style="color: var(--success);">${formatRupiah(p.gross_profit)}</strong></td>
          <td><span class="badge badge-success">${p.margin_percent}%</span></td>
        </tr>
      `).join('');
    } catch (e) {
      showToast('Gagal memuat laba kotor', 'danger');
    }
  },

  // 4. Laporan Nilai Inventori
  async loadInventoryValuation() {
    try {
      const res = await API.request('/api/reports/stock-valuation');
      const s = res.summary;
      const items = res.data || [];

      document.getElementById('inv-summary-count').innerText = `${s.total_products} jenis`;
      document.getElementById('inv-summary-qty').innerText = `${s.total_stock_qty} pcs`;
      document.getElementById('inv-summary-cost').innerText = formatRupiah(s.total_asset_cost);
      document.getElementById('inv-summary-retail').innerText = formatRupiah(s.total_retail_value);
      document.getElementById('inv-summary-potential').innerText = formatRupiah(s.potential_gross_profit);

      const tbody = document.getElementById('inventory-table-body');
      if (!tbody) return;

      tbody.innerHTML = items.map(p => `
        <tr>
          <td><code>${p.barcode}</code></td>
          <td><strong>${p.name}</strong></td>
          <td>${formatRupiah(p.cost_price)}</td>
          <td>${formatRupiah(p.selling_price)}</td>
          <td><strong>${p.stock} ${p.unit}</strong></td>
          <td>${formatRupiah(p.total_asset_value)}</td>
          <td><strong>${formatRupiah(p.total_retail_value)}</strong></td>
        </tr>
      `).join('');
    } catch (e) {
      showToast('Gagal memuat nilai inventori', 'danger');
    }
  },

  exportCsv() {
    const start = document.getElementById('report-start-date')?.value || this.dateFilter.start;
    const end = document.getElementById('report-end-date')?.value || this.dateFilter.end;
    const method = document.getElementById('report-payment-method')?.value || 'ALL';

    let txs = (typeof MockDB !== 'undefined') ? MockDB.getTransactions() : [];
    if (start) txs = txs.filter(t => (t.created_at || '').slice(0, 10) >= start);
    if (end) txs = txs.filter(t => (t.created_at || '').slice(0, 10) <= end);
    if (method && method !== 'ALL') {
      txs = txs.filter(t => (t.payment_method || '').toLowerCase() === method.toLowerCase());
    }

    let csv = '\uFEFFInvoice,Tanggal,Kasir,Metode,Total Item,Diskon,Pajak,Grand Total,Status\n';
    txs.forEach(t => {
      const itemCount = (t.items || []).reduce((sum, it) => sum + (it.qty || 1), 0);
      const disc = t.discount_amount || t.discount_total || 0;
      const tax = t.tax_amount || 0;
      const grand = t.grand_total || t.final_amount || 0;
      csv += `"${t.invoice_no}","${t.created_at || ''}","${t.cashier_name || 'Kasir'}","${(t.payment_method || '').toUpperCase()}","${itemCount}","${disc}","${tax}","${grand}","${t.status || 'completed'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `laporan-penjualan-${start}-sd-${end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  setQuickDate(preset) {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      // today
    } else if (preset === 'yesterday') {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (preset === '7days') {
      start.setDate(today.getDate() - 6);
    } else if (preset === '30days') {
      start.setDate(today.getDate() - 29);
    } else if (preset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const fmt = (d) => d.toISOString().slice(0, 10);
    document.getElementById('report-start-date').value = fmt(start);
    document.getElementById('report-end-date').value = fmt(end);

    if (this.activeTab === 'sales') this.loadSalesReport();
    if (this.activeTab === 'profit') this.loadGrossProfitReport();
  },

  closeModal() {
    const modal = document.getElementById('generic-modal');
    if (modal) modal.style.display = 'none';
  },

  bindEvents() {
    const applyBtn = document.getElementById('report-filter-apply-btn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (this.activeTab === 'sales') this.loadSalesReport();
        if (this.activeTab === 'profit') this.loadGrossProfitReport();
      });
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dash-today-sales')) {
    Reports.init();
  }
});
