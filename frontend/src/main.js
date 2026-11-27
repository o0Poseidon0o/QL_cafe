import { API } from './api.js';

// Global state
let globalIngredients = [];
let globalProducts = [];
let globalToppings = [];
let globalCart = [];
let profitChartInstance = null;
let currentTab = 'dashboard';
let currentPeriod = '30days';
let currentTxTypeFilter = 'all';
let currentInvFilter = 'all';
let currentCostingSubTab = 'products';
let activeImportIngredient = null;
let activeCookIngredient = null;
let activeBreakdownProduct = null;
let posToppingContext = null; // { mode: 'add' | 'edit', productId, variantName, cartKey, selectedMap: { [toppingId]: qty } }

// ==================== UTILITIES ====================
export function formatMoney(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 đ';
  return Math.round(amount).toLocaleString('vi-VN') + ' đ';
}

export function formatMoneyExact(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 đ';
  const rounded = Math.round(Number(amount) * 100) / 100;
  return rounded.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' đ';
}

export function formatNumber(num) {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return Number(num).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function suggestRetailPrice(costPrice, targetPct = 30) {
  if (!costPrice || costPrice <= 0) return 0;
  const pct = Math.max(5, Math.min(95, Number(targetPct) || 30));
  return Math.ceil((costPrice / (pct / 100)) / 1000) * 1000;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all transform duration-300 translate-y-2 opacity-0 ${
    type === 'success' ? 'bg-emerald-800 text-white border-emerald-700' :
    type === 'warning' ? 'bg-amber-800 text-white border-amber-700' :
    'bg-rose-800 text-white border-rose-700'
  }`;

  const iconName = type === 'success' ? 'check-circle' : type === 'warning' ? 'alert-triangle' : 'alert-circle';
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i> <span>${message}</span>`;
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}
window.showToast = showToast;

window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
};

export function switchTab(tabId) {
  currentTab = tabId;
  const tabs = ['dashboard', 'costing', 'inventory', 'pos', 'cashflow'];

  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    const mNavBtn = document.getElementById(`m-nav-${t}`);

    if (el) el.classList.toggle('hidden', t !== tabId);
    if (navBtn) {
      if (t === tabId) {
        navBtn.classList.add('active', 'bg-emerald-600', 'text-white');
        navBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
      } else {
        navBtn.classList.remove('active', 'bg-emerald-600', 'text-white');
        navBtn.classList.add('text-slate-600', 'hover:bg-slate-100');
      }
    }
    if (mNavBtn) {
      if (t === tabId) {
        mNavBtn.classList.add('bg-emerald-600', 'text-white');
        mNavBtn.classList.remove('bg-slate-100', 'text-slate-700');
      } else {
        mNavBtn.classList.remove('bg-emerald-600', 'text-white');
        mNavBtn.classList.add('bg-slate-100', 'text-slate-700');
      }
    }
  });

  if (tabId === 'dashboard') loadDashboard(currentPeriod);
  if (tabId === 'costing') loadCostingData();
  if (tabId === 'inventory') loadInventoryData();
  if (tabId === 'pos') loadPosData();
  if (tabId === 'cashflow') loadCashflowData();

  if (window.lucide) window.lucide.createIcons();
}

// ==================== 1. DASHBOARD ====================
export async function loadDashboard(period = currentPeriod) {
  currentPeriod = period;

  document.querySelectorAll('.period-btn').forEach(btn => {
    if (btn.dataset.period === period) {
      btn.classList.add('active', 'bg-emerald-600', 'text-white', 'shadow-sm');
      btn.classList.remove('text-slate-600');
    } else {
      btn.classList.remove('active', 'bg-emerald-600', 'text-white', 'shadow-sm');
      btn.classList.add('text-slate-600');
    }
  });

  try {
    const [report, ingredients] = await Promise.all([
      API.getDashboardReport(period),
      globalIngredients.length ? Promise.resolve(globalIngredients) : API.getIngredients()
    ]);
    globalIngredients = ingredients;
    const summary = report.summary || {};

    document.getElementById('stat-revenue').textContent = formatMoney(summary.totalRevenue);
    document.getElementById('stat-order-count').textContent = formatNumber(summary.orderCount);
    document.getElementById('stat-cups-sold').textContent = formatNumber(summary.totalCupsSold);
    document.getElementById('stat-cogs').textContent = formatMoney(summary.totalCogs);
    document.getElementById('stat-gross-profit').textContent = formatMoney(summary.grossProfit);
    document.getElementById('stat-operating').textContent = formatMoney(summary.totalOperatingExpenses);

    const netEl = document.getElementById('stat-net-profit');
    netEl.textContent = formatMoney(summary.netProfit);
    netEl.className = summary.netProfit < 0
      ? 'text-2xl sm:text-3xl font-extrabold text-rose-600'
      : 'text-2xl sm:text-3xl font-extrabold text-emerald-600';
    document.getElementById('stat-margin').textContent = `${summary.profitMargin || 0}%`;

    const lowStockContainer = document.getElementById('low-stock-list');
    document.getElementById('low-stock-count-badge').textContent = (report.lowStockItems || []).length;

    if (!report.lowStockItems || report.lowStockItems.length === 0) {
      lowStockContainer.innerHTML = `
        <div class="text-center py-6 text-slate-400 text-xs">
          <i data-lucide="check-circle" class="w-6 h-6 mx-auto mb-1 text-emerald-500"></i>
          Nguyên liệu kho hàng đang ở mức an toàn!
        </div>
      `;
    } else {
      lowStockContainer.innerHTML = report.lowStockItems.map(item => `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-xs">
          <div>
            <span class="font-bold text-slate-800">${escapeHtml(item.name)}</span>
            <p class="text-amber-700 font-semibold mt-0.5">Còn ${formatNumber(item.stock)} ${escapeHtml(item.unit)} (Ngưỡng: ${formatNumber(item.alert)})</p>
          </div>
          <button onclick="window.quickImportByName('${escapeHtml(item.name)}')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs">
            Nhập / Nấu
          </button>
        </div>
      `).join('');
    }

    const topProdContainer = document.getElementById('top-products-list');
    if (!report.topProducts || report.topProducts.length === 0) {
      topProdContainer.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">Chưa có dữ liệu bán hàng.</div>`;
    } else {
      topProdContainer.innerHTML = report.topProducts.map((p, idx) => `
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">${idx + 1}</span>
            <span class="font-bold text-slate-900">${escapeHtml(p.name)}</span>
          </div>
          <div class="text-right">
            <span class="font-bold text-emerald-600">${formatNumber(p.quantity)} ly</span>
            <span class="text-slate-400 block text-[10px]">${formatMoney(p.revenue)}</span>
          </div>
        </div>
      `).join('');
    }

    renderProfitChart(report.chartData);
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderProfitChart(chartData) {
  const ctx = document.getElementById('profitChart');
  if (!ctx || !window.Chart) return;
  if (profitChartInstance) profitChartInstance.destroy();

  profitChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.labels || [],
      datasets: [
        { label: 'Doanh Thu', data: chartData.revenue || [], backgroundColor: '#3b82f6', borderRadius: 6, barPercentage: 0.6 },
        { label: 'Giá Vốn (COGS)', data: chartData.cogs || [], backgroundColor: '#f59e0b', borderRadius: 6, barPercentage: 0.6 },
        { label: 'Lợi Nhuận Gộp', data: chartData.profit || [], backgroundColor: '#10b981', borderRadius: 6, barPercentage: 0.6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Inter', size: 11, weight: '500' } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.raw)}` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (val) => (val / 1000).toLocaleString() + 'k', font: { size: 10 } }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

// ==================== 2. MENU & COSTING + TOPPINGS GỌI THÊM ====================
window.switchCostingSubTab = function(subTab) {
  currentCostingSubTab = subTab;
  const isProd = subTab === 'products';
  document.getElementById('costing-subtab-products')?.classList.toggle('hidden', !isProd);
  document.getElementById('costing-subtab-toppings')?.classList.toggle('hidden', isProd);

  const btnProd = document.getElementById('subtab-btn-products');
  const btnTop = document.getElementById('subtab-btn-toppings');
  if (btnProd && btnTop) {
    if (isProd) {
      btnProd.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xs transition-all flex items-center gap-1.5';
      btnTop.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5';
    } else {
      btnTop.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white shadow-xs transition-all flex items-center gap-1.5';
      btnProd.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center gap-1.5';
    }
  }
};

export async function loadCostingData() {
  try {
    const [products, ingredients, toppings] = await Promise.all([
      API.getProducts(),
      API.getIngredients(),
      API.getToppings()
    ]);
    globalProducts = products;
    globalIngredients = ingredients;
    globalToppings = toppings;

    const badgeProd = document.getElementById('badge-count-products');
    const badgeTop = document.getElementById('badge-count-toppings');
    if (badgeProd) badgeProd.textContent = products.length;
    if (badgeTop) badgeTop.textContent = toppings.length;

    renderToppingsGrid(toppings);

    const container = document.getElementById('products-grid');
    if (!products.length) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-2">
          <i data-lucide="coffee" class="w-10 h-10 mx-auto text-slate-300"></i>
          <p class="font-semibold text-slate-600">Menu chưa có món nước nào!</p>
          <p class="text-xs text-slate-400">Bấm nút "Thêm Món Nước Mới" để thiết lập công thức pha từng ly hoặc pha mẻ lớn chia ly.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = products.map(p => {
      const marginBadgeColor = p.profitMargin >= 60 ? 'bg-emerald-100 text-emerald-800' :
                               p.profitMargin >= 40 ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800';
      const maxCupsColor = p.maxCupsPossible > 20 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                           p.maxCupsPossible > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-rose-700 bg-rose-50 border-rose-200';

      const isBatch = p.recipeMode === 'batch' && p.batchSummary;
      const allSizes = p.variantBreakdowns || [];

      const batchBanner = isBatch ? `
        <div class="text-[11px] bg-amber-50 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-200/80 flex justify-between items-center mt-2">
          <span>🫗 Mẻ <b>${formatNumber(p.batchSummary.yieldVolume)}${escapeHtml(p.batchSummary.yieldUnit)}</b> · Vốn mẻ <b>${formatMoney(p.batchSummary.batchTotalCost)}</b></span>
          <span class="font-bold text-amber-800">${formatMoneyExact(p.batchSummary.costPerYieldUnit)}/${escapeHtml(p.batchSummary.yieldUnit)}</span>
        </div>
      ` : '';

      const sizesTableHtml = `
        <div class="bg-slate-50 rounded-xl p-2.5 my-3 border border-slate-100 space-y-1.5">
          <div class="grid grid-cols-12 text-[10px] font-bold uppercase text-slate-400 px-1 pb-1 border-b border-slate-200/70">
            <span class="col-span-5">Cỡ ly / Dung tích</span>
            <span class="col-span-3 text-right">Giá vốn</span>
            <span class="col-span-4 text-right">Giá bán (Lãi)</span>
          </div>
          ${allSizes.map(v => `
            <div class="grid grid-cols-12 items-center text-xs px-1 py-0.5">
              <div class="col-span-5 pr-1">
                <div class="font-bold text-slate-800 leading-tight">${escapeHtml(v.name)}</div>
                ${isBatch && v.cupsPerBatch
                  ? `<div class="text-[10px] text-amber-700">${formatNumber(v.portionVolume)}${escapeHtml(p.batchSummary.yieldUnit)} · ${v.cupsPerBatch} ly/mẻ</div>`
                  : (v.scaleFactor && v.scaleFactor !== 1 ? `<div class="text-[10px] text-slate-400">định lượng x${v.scaleFactor}</div>` : '')}
              </div>
              <div class="col-span-3 text-right font-semibold text-amber-700">${formatMoney(v.costPrice)}</div>
              <div class="col-span-4 text-right">
                <span class="font-extrabold text-slate-900">${formatMoney(v.price)}</span>
                <span class="block text-[10px] font-bold text-emerald-600">+${formatMoney(v.grossProfit)} (${v.profitMargin}%)</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      return `
        <div class="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <span class="text-2xl p-2 rounded-xl bg-slate-100">${escapeHtml(p.image || '🥤')}</span>
                <div>
                  <h3 class="font-bold text-slate-900 text-base leading-tight">${escapeHtml(p.name)}</h3>
                  <span class="text-[11px] text-slate-500 font-medium">${escapeHtml(p.category)}${allSizes.length > 1 ? ` · ${allSizes.length} cỡ ly` : ''}</span>
                </div>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${marginBadgeColor}">
                Lãi ${p.profitMargin}%
              </span>
            </div>

            ${batchBanner}
            ${sizesTableHtml}

            <div class="flex items-center justify-between text-xs px-3 py-1.5 rounded-xl border ${maxCupsColor}">
              <span class="font-medium">Tồn kho pha được:</span>
              <span class="font-extrabold">${p.hasTrackedIngredient === false ? '∞ Không giới hạn' : `${formatNumber(p.maxCupsPossible)} ly`}</span>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
            <button onclick="window.viewCostBreakdown('${p._id}')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold flex items-center gap-1.5 transition-all">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i> Xem bảng giá & In
            </button>
            <div class="flex gap-1">
              <button onclick="window.openEditProductModal('${p._id}')" class="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Chỉnh sửa">
                <i data-lucide="edit-2" class="w-4 h-4"></i>
              </button>
              <button onclick="window.confirmDeleteProduct('${p._id}', '${escapeHtml(p.name)}')" class="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50" title="Xóa món">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderToppingsGrid(toppings) {
  const container = document.getElementById('toppings-grid');
  if (!container) return;

  if (!toppings || !toppings.length) {
    container.innerHTML = `
      <div class="col-span-full py-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-2">
        <div class="text-3xl">🍡</div>
        <p class="font-semibold text-slate-600 text-sm">Chưa có topping gọi thêm nào</p>
        <p class="text-xs text-slate-400">Bấm "Thêm Topping Gọi Thêm" để tạo các loại topping khách hay gọi kèm (Trân châu, Kem cheese, Đào miếng...).</p>
      </div>
    `;
    return;
  }

  container.innerHTML = toppings.map(t => `
    <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3">
      <div>
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-slate-900 text-sm flex items-center gap-1.5"><span>🍡</span> ${escapeHtml(t.name)}</h4>
            <p class="text-[11px] text-slate-500 mt-0.5">Kho: <b>${escapeHtml(t.ingredientName)}</b> · <b>${formatNumber(t.quantity)} ${escapeHtml(t.unit)}</b>/phần</p>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">+${formatMoney(t.price)}</span>
        </div>

        <div class="mt-3 bg-slate-50 rounded-xl p-2.5 text-xs space-y-1 border border-slate-100">
          <div class="flex justify-between">
            <span class="text-slate-500">Giá vốn 1 phần:</span>
            <span class="font-bold text-amber-700">${formatMoney(t.costPrice)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Lãi gộp / phần:</span>
            <span class="font-extrabold text-emerald-600">${formatMoney(t.grossProfit)} (${t.profitMargin}%)</span>
          </div>
          <div class="flex justify-between text-[11px] pt-1 border-t border-slate-200">
            <span class="text-slate-500">Tồn kho còn bán được:</span>
            <span class="font-bold ${t.maxPortionsPossible > 10 ? 'text-emerald-700' : 'text-amber-700'}">${!t.trackInventory ? '∞ Không giới hạn' : `${formatNumber(t.maxPortionsPossible)} phần`}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <span class="text-[11px] text-slate-400 truncate max-w-[160px]">${escapeHtml(t.notes || '')}</span>
        <div class="flex gap-1">
          <button onclick="window.openEditToppingModal('${t._id}')" class="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Sửa"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
          <button onclick="window.confirmDeleteTopping('${t._id}', '${escapeHtml(t.name)}')" class="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50" title="Xóa"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>
    </div>
  `).join('');

  if (window.lucide) window.lucide.createIcons();
}

function updateToppingLivePreview() {
  const select = document.getElementById('topping-ingredient');
  const opt = select?.options[select.selectedIndex];
  const unit = opt?.dataset?.unit || 'g';
  const unitCost = Number(opt?.dataset?.cost) || 0;
  const qty = Number(document.getElementById('topping-qty')?.value) || 0;
  const price = Number(document.getElementById('topping-price')?.value) || 0;

  const lbl = document.getElementById('topping-unit-label');
  if (lbl) lbl.textContent = unit;

  const cost = Math.round(unitCost * qty);
  const profit = price - cost;
  const margin = price > 0 ? Math.round((profit / price) * 100) : 0;

  document.getElementById('topping-preview-cost').textContent = formatMoney(cost);
  document.getElementById('topping-preview-profit').textContent = formatMoney(profit);
  document.getElementById('topping-preview-margin').textContent = `${margin}%`;
}

window.openAddToppingModal = async function() {
  if (!globalIngredients.length) globalIngredients = await API.getIngredients();
  document.getElementById('modal-topping-title').textContent = 'Thêm Topping Gọi Thêm';
  document.getElementById('topping-id').value = '';
  document.getElementById('topping-name').value = '';
  document.getElementById('topping-ingredient').innerHTML = buildIngredientOptionsHtml('');
  document.getElementById('topping-qty').value = '40';
  document.getElementById('topping-price').value = '5000';
  document.getElementById('topping-notes').value = '';
  updateToppingLivePreview();
  window.openModal('modal-topping');
};

window.openEditToppingModal = async function(id) {
  if (!globalIngredients.length) globalIngredients = await API.getIngredients();
  const t = globalToppings.find(x => x._id === id);
  if (!t) return;

  document.getElementById('modal-topping-title').textContent = `Sửa Topping: ${t.name}`;
  document.getElementById('topping-id').value = t._id;
  document.getElementById('topping-name').value = t.name;
  document.getElementById('topping-ingredient').innerHTML = buildIngredientOptionsHtml(t.ingredientId || '');
  document.getElementById('topping-qty').value = t.quantity;
  document.getElementById('topping-price').value = t.price;
  document.getElementById('topping-notes').value = t.notes || '';
  updateToppingLivePreview();
  window.openModal('modal-topping');
};

window.confirmDeleteTopping = async function(id, name) {
  if (confirm(`Bạn có chắc muốn xóa topping "${name}" không?`)) {
    try {
      await API.deleteTopping(id);
      showToast('Đã xóa topping!');
      loadCostingData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// ==================== PHIẾU CÔNG THỨC & GIÁ THÀNH KIỂU TRÀ LỘC PHÁT ====================
window.viewCostBreakdown = async function(productId) {
  try {
    const [p, toppings] = await Promise.all([
      API.getProduct(productId),
      globalToppings.length ? Promise.resolve(globalToppings) : API.getToppings()
    ]);
    globalToppings = toppings;
    activeBreakdownProduct = p;

    document.getElementById('breakdown-drink-name').textContent = `${p.image || ''} ${p.name}`;
    document.getElementById('breakdown-drink-category').textContent =
      `Danh mục: ${p.category}${p.recipeMode === 'batch' ? ' | Chế độ Pha Mẻ Lớn Chia Ly' : ''}${p.description ? ' | ' + p.description : ''}`;

    const sopToggle = document.getElementById('toggle-sop-mode');
    if (sopToggle) sopToggle.checked = false;
    document.getElementById('recipe-sheet-printable')?.classList.remove('sop-mode');

    const sectionsHtml = [];
    const isBatch = p.recipeMode === 'batch' && p.batchSummary;

    // TẦNG 1: Từng bảng Bán thành phẩm (nếu có dùng bán thành phẩm từ kho)
    if (p.subRecipeBreakdowns && p.subRecipeBreakdowns.length > 0) {
      p.subRecipeBreakdowns.forEach(sub => {
        const rows = (sub.items || []).map((item, idx) => `
          <tr>
            <td class="text-center text-slate-500 font-medium">${idx + 1}</td>
            <td class="font-medium text-slate-900">${escapeHtml(item.name)}</td>
            <td class="text-center text-slate-600 cost-only">${escapeHtml(item.specPrice)}</td>
            <td class="text-center font-semibold text-slate-800">${formatNumber(item.quantity)}${escapeHtml(item.unit)}</td>
            <td class="text-right font-bold text-slate-900 cost-only">${item.itemCost > 0 ? formatNumber(item.itemCost) : '-'}</td>
          </tr>
        `).join('');

        const instrHtml = sub.instructions
          ? `<div class="text-[11px] bg-amber-50/70 text-amber-900 px-3 py-1.5 border border-t-0 border-slate-300"><b>Cách nấu (SOP):</b> ${escapeHtml(sub.instructions)}</div>`
          : '';

        sectionsHtml.push(`
          <div>
            <table class="recipe-sheet-table">
              <thead>
                <tr><th colspan="5" class="recipe-sheet-header">${escapeHtml(sub.name)}</th></tr>
                <tr class="bg-slate-50 text-slate-700">
                  <th class="w-10 text-center">STT</th>
                  <th class="text-left">Nguyên Liệu</th>
                  <th class="text-center cost-only">Giá Quy Cách</th>
                  <th class="text-center">Định Lượng</th>
                  <th class="text-right cost-only">Giá Vốn (đ)</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
                <tr class="recipe-sheet-subheader">
                  <td colspan="3">Thành phẩm thu được ${formatNumber(sub.yieldQuantity)}${escapeHtml(sub.unit)}</td>
                  <td class="text-center cost-only">${formatMoneyExact(sub.costPerUnit)}/${escapeHtml(sub.unit)}</td>
                  <td class="text-right font-extrabold text-emerald-900 cost-only">${formatNumber(sub.batchCost)}</td>
                </tr>
              </tbody>
            </table>
            ${instrHtml}
          </div>
        `);
      });
    }

    // TẦNG 2: Khác biệt rõ giữa CHẾ ĐỘ PHA MẺ LỚN vs PHA TỪNG LY
    if (isBatch) {
      const bs = p.batchSummary;
      const batchRows = (p.recipeDetails || []).map((item, idx) => `
        <tr>
          <td class="text-center text-slate-500 font-medium">${idx + 1}</td>
          <td class="font-medium text-slate-900">${escapeHtml(item.name)}</td>
          <td class="text-center text-slate-600 cost-only">${escapeHtml(item.specPrice)}</td>
          <td class="text-center font-semibold text-slate-800">${formatNumber(item.quantity)}${escapeHtml(item.unit)}</td>
          <td class="text-right font-bold text-slate-900 cost-only">${item.itemCost > 0 ? formatNumber(item.itemCost) : '-'}</td>
        </tr>
      `).join('');

      sectionsHtml.push(`
        <table class="recipe-sheet-table">
          <thead>
            <tr><th colspan="5" class="recipe-sheet-header">CÔNG THỨC NẤU 1 MẺ LỚN (${formatNumber(bs.yieldVolume)}${escapeHtml(bs.yieldUnit)})</th></tr>
            <tr class="bg-slate-50 text-slate-700">
              <th class="w-10 text-center">STT</th>
              <th class="text-left">Nguyên Liệu Nấu Mẻ</th>
              <th class="text-center cost-only">Giá Quy Cách</th>
              <th class="text-center">Định Lượng Mẻ</th>
              <th class="text-right cost-only">Giá Vốn (đ)</th>
            </tr>
          </thead>
          <tbody>
            ${batchRows}
            ${p.wastePercent > 0 ? `<tr class="cost-only bg-amber-50/40"><td class="text-center">-</td><td colspan="2">Hao hụt nấu/lọc (${p.wastePercent}%)</td><td class="text-center">+${p.wastePercent}%</td><td class="text-right font-bold text-amber-800">${formatNumber(bs.wasteCost)}</td></tr>` : ''}
            <tr class="recipe-sheet-subheader">
              <td colspan="3">Thành phẩm thu được: <b>${formatNumber(bs.yieldVolume)} ${escapeHtml(bs.yieldUnit)}</b></td>
              <td class="text-center cost-only">${formatMoneyExact(bs.costPerYieldUnit)}/${escapeHtml(bs.yieldUnit)}</td>
              <td class="text-right font-extrabold text-emerald-900 cost-only">${formatNumber(bs.batchTotalCost)} đ</td>
            </tr>
          </tbody>
        </table>
      `);

      // Bảng phụ liệu / topping cố định cộng riêng từng ly (nếu có)
      if ((p.perCupExtraDetails && p.perCupExtraDetails.length > 0) || p.packagingCost > 0) {
        const extraRows = (p.perCupExtraDetails || []).map((item, idx) => `
          <tr>
            <td class="text-center text-slate-500">${idx + 1}</td>
            <td class="font-medium text-slate-900">${escapeHtml(item.name)}</td>
            <td class="text-center text-slate-600 cost-only">${escapeHtml(item.specPrice)}</td>
            <td class="text-center font-semibold">${formatNumber(item.quantity)}${escapeHtml(item.unit)}</td>
            <td class="text-right font-bold cost-only">${formatNumber(item.itemCost)}</td>
          </tr>
        `);
        if (p.packagingCost > 0) {
          extraRows.push(`
            <tr>
              <td class="text-center text-slate-500">${extraRows.length + 1}</td>
              <td class="font-medium">${escapeHtml(p.packagingNote || 'Ly, muỗng, ống hút')}</td>
              <td class="text-center cost-only">-</td>
              <td class="text-center">1 bộ</td>
              <td class="text-right font-bold cost-only">${formatNumber(p.packagingCost)}</td>
            </tr>
          `);
        }
        sectionsHtml.push(`
          <table class="recipe-sheet-table">
            <thead>
              <tr><th colspan="5" class="recipe-sheet-header">PHỤ LIỆU & BAO BÌ CỘNG RIÊNG CHO MỖI LY</th></tr>
            </thead>
            <tbody>${extraRows.join('')}</tbody>
          </table>
        `);
      }

      // Bảng chia mẻ ra từng cỡ ly / chai + Lãi ròng cả mẻ
      const splitRows = (p.variantBreakdowns || []).map(v => `
        <tr>
          <td class="font-bold text-slate-900">${escapeHtml(v.name)}</td>
          <td class="text-center font-semibold">${formatNumber(v.portionVolume)}${escapeHtml(bs.yieldUnit)}/ly</td>
          <td class="text-center font-extrabold text-amber-800">${v.cupsPerBatch} ly ${v.leftoverVolume > 0 ? `<span class="text-[10px] font-normal text-slate-500">(dư ${v.leftoverVolume}${escapeHtml(bs.yieldUnit)})</span>` : ''}</td>
          <td class="text-right cost-only">${formatMoney(v.liquidCostPerCup)} + ${formatMoney((v.extrasCostPerCup || 0) + (v.packagingCost || 0))}</td>
          <td class="text-right font-extrabold text-amber-700 cost-only">${formatMoney(v.costPrice)}</td>
          <td class="text-right font-bold cost-only">${formatMoney(v.price)}</td>
          <td class="text-right font-extrabold text-emerald-700 cost-only">${formatMoney(v.grossProfit)} (${v.profitMargin}%)</td>
          <td class="text-right font-extrabold text-emerald-800 bg-emerald-50/70 cost-only">${formatMoney(v.profitPerBatch)}</td>
        </tr>
      `).join('');

      sectionsHtml.push(`
        <table class="recipe-sheet-table">
          <thead>
            <tr><th colspan="8" class="bg-emerald-700 text-white font-bold text-center uppercase">BẢNG CHIA MẺ ${formatNumber(bs.yieldVolume)}${escapeHtml(bs.yieldUnit)} RA TỪNG CỠ LY & LỢI NHUẬN CẢ MẺ</th></tr>
            <tr class="bg-slate-50 text-slate-700">
              <th class="text-left">Cỡ ly / Chai</th>
              <th class="text-center">Lượng rót</th>
              <th class="text-center">Số ly / mẻ</th>
              <th class="text-right cost-only">Nước + Phụ/Bao bì</th>
              <th class="text-right cost-only">Tổng vốn / ly</th>
              <th class="text-right cost-only">Giá bán</th>
              <th class="text-right cost-only">Lãi / ly</th>
              <th class="text-right cost-only">Tổng lãi cả mẻ</th>
            </tr>
          </thead>
          <tbody>${splitRows}</tbody>
        </table>
      `);
    } else {
      const mainRows = (p.recipeDetails || []).map((item, idx) => `
        <tr>
          <td class="text-center text-slate-500 font-medium">${idx + 1}</td>
          <td class="font-medium text-slate-900">${item.isSubRecipe ? '<span class="text-amber-600 mr-1">🍲</span>' : ''}${escapeHtml(item.name)}</td>
          <td class="text-center text-slate-600 cost-only">${escapeHtml(item.specPrice)}</td>
          <td class="text-center font-semibold text-slate-800">${formatNumber(item.quantity)}${escapeHtml(item.unit)}${item.kcal > 0 ? ` <span class="text-[11px] font-normal text-slate-500">(${item.kcal}kcal)</span>` : ''}</td>
          <td class="text-right font-bold text-slate-900 cost-only">${item.itemCost > 0 ? formatNumber(item.itemCost) : '-'}</td>
        </tr>
      `);

      if (p.packagingCost > 0) {
        mainRows.push(`
          <tr>
            <td class="text-center text-slate-500 font-medium">${mainRows.length + 1}</td>
            <td class="font-medium text-slate-900">${escapeHtml(p.packagingNote || 'Ly, muỗng, ống hút')}</td>
            <td class="text-center text-slate-500 cost-only">-</td>
            <td class="text-center text-slate-500">1 bộ</td>
            <td class="text-right font-bold text-slate-900 cost-only">${formatNumber(p.packagingCost)}</td>
          </tr>
        `);
      }

      if (p.wastePercent > 0 && p.wasteCost > 0) {
        mainRows.push(`
          <tr class="cost-only bg-amber-50/40">
            <td class="text-center text-slate-500">-</td>
            <td class="font-medium text-amber-800">Dự phòng hao hụt pha chế (${p.wastePercent}%)</td>
            <td class="text-center text-slate-500">-</td>
            <td class="text-center text-amber-700">+${p.wastePercent}%</td>
            <td class="text-right font-bold text-amber-800">${formatNumber(p.wasteCost)}</td>
          </tr>
        `);
      }

      const sizeSummaryRows = (p.variantBreakdowns || []).map(v => `
        <tr class="recipe-sheet-subheader">
          <td colspan="3" class="font-extrabold text-slate-900">
            Giá vốn ${escapeHtml(v.name)} ${v.scaleFactor !== 1 ? `<span class="font-normal text-xs text-slate-600">(định lượng x${v.scaleFactor})</span>` : ''}
          </td>
          <td class="text-center font-bold text-slate-800">${v.kcal > 0 ? `${formatNumber(v.kcal)} kcal` : '-'}</td>
          <td class="text-right font-extrabold text-amber-800 text-sm cost-only">${formatNumber(v.costPrice)} đ</td>
        </tr>
      `).join('');

      sectionsHtml.push(`
        <table class="recipe-sheet-table">
          <thead>
            <tr><th colspan="5" class="recipe-sheet-header">RA MÓN ${escapeHtml(p.name)} — ${escapeHtml(p.baseSizeLabel || 'LY 500ML')}</th></tr>
            <tr class="bg-slate-50 text-slate-700">
              <th class="w-10 text-center">STT</th>
              <th class="text-left">Nguyên Liệu / Bán Thành Phẩm</th>
              <th class="text-center cost-only">Giá Quy Cách</th>
              <th class="text-center">Định Lượng</th>
              <th class="text-right cost-only">Giá Vốn (đ)</th>
            </tr>
          </thead>
          <tbody>
            ${mainRows.join('')}
            ${sizeSummaryRows}
          </tbody>
        </table>
      `);

      const profitRows = (p.variantBreakdowns || []).map(v => `
        <tr>
          <td class="font-bold text-slate-900">${escapeHtml(v.name)}</td>
          <td class="text-right font-bold text-amber-700">${formatMoney(v.costPrice)}</td>
          <td class="text-right font-bold text-slate-900">${formatMoney(v.price)}</td>
          <td class="text-right font-extrabold text-emerald-700">${formatMoney(v.grossProfit)} (${v.profitMargin}%)</td>
          <td class="text-center font-semibold ${v.foodCostPercent <= (p.targetCostPercent || 30) ? 'text-emerald-700' : 'text-rose-600'}">${v.foodCostPercent}%</td>
          <td class="text-right font-bold text-blue-700">${formatMoney(v.suggestedPrice)}</td>
        </tr>
      `).join('');

      sectionsHtml.push(`
        <div class="cost-only">
          <table class="recipe-sheet-table">
            <thead>
              <tr><th colspan="6" class="bg-emerald-700 text-white font-bold text-center uppercase tracking-wider">PHÂN TÍCH LỢI NHUẬN & GỢI Ý GIÁ BÁN (MỤC TIÊU ${p.targetCostPercent || 30}% VỐN)</th></tr>
              <tr class="bg-slate-50 text-slate-700">
                <th class="text-left">Size</th>
                <th class="text-right">Giá Vốn</th>
                <th class="text-right">Giá Bán</th>
                <th class="text-right">Lãi Gộp</th>
                <th class="text-center">% Vốn</th>
                <th class="text-right">Giá Gợi Ý</th>
              </tr>
            </thead>
            <tbody>${profitRows}</tbody>
          </table>
        </div>
      `);
    }

    // TẦNG 4: Đóng chai (nếu có bật)
    if (p.bottlingSummary) {
      const b = p.bottlingSummary;
      sectionsHtml.push(`
        <div class="cost-only">
          <table class="recipe-sheet-table">
            <thead>
              <tr><th colspan="4" class="bg-blue-700 text-white font-bold text-center uppercase tracking-wider">🍾 PHÂN TÍCH ĐÓNG CHAI (${b.bottleVolumeMl}ML)</th></tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-semibold text-slate-700">Tiền nước cốt (${b.bottleVolumeMl}ml)</td>
                <td class="text-right font-bold">${formatMoney(b.liquidCostPerBottle)}</td>
                <td class="font-semibold text-slate-700">Vỏ chai + Nắp + Tem</td>
                <td class="text-right font-bold">${formatMoney(b.bottleCost)}</td>
              </tr>
              <tr class="bg-blue-50">
                <td class="font-extrabold text-slate-900">Tổng giá vốn 1 chai ${b.bottleVolumeMl}ml</td>
                <td class="text-right font-extrabold text-amber-700">${formatMoney(b.costPerBottle)}</td>
                <td class="font-extrabold text-slate-900">Giá bán / Lãi gộp 1 chai</td>
                <td class="text-right font-extrabold text-emerald-700">${formatMoney(b.sellPricePerBottle)} (Lãi ${formatMoney(b.profitPerBottle)} · ${b.marginPerBottle}%)</td>
              </tr>
              ${b.bottlesPerBatch ? `
                <tr>
                  <td colspan="4" class="bg-emerald-50/70 text-emerald-900 text-xs">
                    💡 <b>Hiệu suất theo mẻ (${escapeHtml(b.mainSubName)}):</b> 1 mẻ đóng được <b>${b.bottlesPerBatch} chai ${b.bottleVolumeMl}ml</b>
                    ${b.leftoverMl > 0 ? `(dư ${formatNumber(b.leftoverMl)}ml)` : ''}
                    → Tổng lãi gộp ước tính mỗi mẻ: <b class="text-emerald-700">${formatMoney(b.profitPerBatch)}</b>.
                  </td>
                </tr>
              ` : ''}
            </tbody>
          </table>
        </div>
      `);
    }

    // TẦNG 5: Khung thử ghép Dung tích / Size + nhiều loại Topping (tương tác live, ẩn khi in)
    if (globalToppings.length > 0) {
      const sizeOpts = (p.variantBreakdowns || []).map((v, idx) =>
        `<option value="v:${idx}">${escapeHtml(v.name)} (vốn ${formatMoney(v.costPrice)} · bán ${formatMoney(v.price)})</option>`
      );
      if (p.bottlingSummary) {
        sizeOpts.push(`<option value="bottle">🍾 Chai ${p.bottlingSummary.bottleVolumeMl}ml (vốn ${formatMoney(p.bottlingSummary.costPerBottle)} · bán ${formatMoney(p.bottlingSummary.sellPricePerBottle)})</option>`);
      }

      const topCheckboxes = globalToppings.map(t => `
        <label class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-purple-200 hover:border-purple-400 cursor-pointer text-xs">
          <input type="checkbox" class="sim-topping-cb accent-purple-600" value="${t._id}" onchange="window.updateSheetToppingSimulation()">
          <span class="font-semibold text-slate-800">${escapeHtml(t.name)}</span>
          <span class="text-[11px] text-purple-700 font-bold">+${Math.round(t.price / 1000)}k</span>
          <span class="text-[10px] text-slate-400">(vốn ${formatMoney(t.costPrice)})</span>
        </label>
      `).join('');

      sectionsHtml.push(`
        <div class="cost-only no-print p-3.5 rounded-2xl bg-purple-50/80 border border-purple-200 space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs font-bold text-purple-900">🍡 Thử ghép Dung tích + Nhiều loại Topping → Ra giá 1 ly hoàn chỉnh:</div>
            <select id="sheet-sim-size-select" onchange="window.updateSheetToppingSimulation()" class="px-2.5 py-1.5 text-xs font-bold bg-white border border-purple-300 rounded-lg text-slate-800">
              ${sizeOpts.join('')}
            </select>
          </div>
          <div class="flex flex-wrap gap-2">${topCheckboxes}</div>
          <div id="sheet-topping-sim-result" class="text-xs bg-white p-2.5 rounded-xl border border-purple-100 text-slate-600">
            Chọn dung tích và tích thêm 1 hoặc nhiều loại topping để xem tổng vốn & giá bán của 1 ly hoàn chỉnh.
          </div>
        </div>
      `);
    }

    document.getElementById('breakdown-sheet-content').innerHTML = sectionsHtml.join('');
    window.openModal('modal-cost-breakdown');
    window.updateSheetToppingSimulation();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.updateSheetToppingSimulation = function() {
  const p = activeBreakdownProduct;
  const resultEl = document.getElementById('sheet-topping-sim-result');
  if (!p || !resultEl) return;

  const sizeKey = document.getElementById('sheet-sim-size-select')?.value || 'v:0';
  let sizeName = p.baseSizeLabel || 'Size chuẩn';
  let baseCost = p.costPrice || 0;
  let basePrice = p.price || 0;

  if (sizeKey === 'bottle' && p.bottlingSummary) {
    sizeName = `Chai ${p.bottlingSummary.bottleVolumeMl}ml`;
    baseCost = p.bottlingSummary.costPerBottle || 0;
    basePrice = p.bottlingSummary.sellPricePerBottle || 0;
  } else if (sizeKey.startsWith('v:')) {
    const idx = Number(sizeKey.slice(2)) || 0;
    const v = (p.variantBreakdowns || [])[idx];
    if (v) {
      sizeName = v.name;
      baseCost = v.costPrice || 0;
      basePrice = v.price || 0;
    }
  }

  const checkedIds = Array.from(document.querySelectorAll('.sim-topping-cb:checked')).map(cb => cb.value);
  let extraCost = 0;
  let extraPrice = 0;
  const names = [];
  checkedIds.forEach(id => {
    const t = globalToppings.find(x => x._id === id);
    if (t) {
      extraCost += t.costPrice || 0;
      extraPrice += t.price || 0;
      names.push(t.name);
    }
  });

  const totalCost = baseCost + extraCost;
  const totalPrice = basePrice + extraPrice;
  const totalProfit = totalPrice - totalCost;
  const margin = totalPrice > 0 ? Math.round((totalProfit / totalPrice) * 100) : 0;

  resultEl.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span><b>${escapeHtml(p.name)} (${escapeHtml(sizeName)})</b>${names.length ? ` + ${names.map(escapeHtml).join(' + ')}` : ' <span class="text-slate-400">(chưa thêm topping)</span>'}</span>
      <span>
        Tổng vốn 1 ly: <b class="text-amber-700">${formatMoney(totalCost)}</b> ·
        Giá bán: <b class="text-slate-900 text-sm">${formatMoney(totalPrice)}</b> ·
        Lãi: <b class="text-emerald-700">${formatMoney(totalProfit)} (${margin}%)</b>
      </span>
    </div>
  `;
};

window.printRecipeSheet = function(isSopMode) {
  const sheet = document.getElementById('recipe-sheet-printable');
  const toggle = document.getElementById('toggle-sop-mode');
  if (sheet) sheet.classList.toggle('sop-mode', !!isSopMode);
  if (toggle) toggle.checked = !!isSopMode;
  window.print();
};

// ==================== MODAL THÊM / SỬA MÓN & NHIỀU SIZE ====================
function buildIngredientOptionsHtml(selectedId = '', excludeId = '') {
  const subList = globalIngredients.filter(i => i.isSubRecipe && i._id !== excludeId);
  const rawList = globalIngredients.filter(i => !i.isSubRecipe && i._id !== excludeId);

  let html = '<option value="">-- Chọn nguyên liệu / bán thành phẩm --</option>';

  if (subList.length > 0) {
    html += '<optgroup label="🍲 Bán thành phẩm (Nước cốt, Sốt, Topping tự nấu)">';
    subList.forEach(ing => {
      const sel = ing._id === selectedId ? 'selected' : '';
      html += `<option value="${ing._id}" data-cost="${ing.costPerUnit}" data-unit="${escapeHtml(ing.unit)}" data-kcal="${ing.kcalPerUnit || 0}" ${sel}>🍲 ${escapeHtml(ing.name)} (${escapeHtml(ing.specPrice || formatMoneyExact(ing.costPerUnit) + '/' + ing.unit)})</option>`;
    });
    html += '</optgroup>';
  }

  if (rawList.length > 0) {
    html += '<optgroup label="📦 Nguyên liệu & Bao bì mua ngoài">';
    rawList.forEach(ing => {
      const sel = ing._id === selectedId ? 'selected' : '';
      const priceLabel = ing.costPerUnit > 0 ? (ing.specPrice || `${formatMoneyExact(ing.costPerUnit)}/${ing.unit}`) : '0đ (không tính vốn)';
      html += `<option value="${ing._id}" data-cost="${ing.costPerUnit}" data-unit="${escapeHtml(ing.unit)}" data-kcal="${ing.kcalPerUnit || 0}" ${sel}>${escapeHtml(ing.name)} (${escapeHtml(priceLabel)})</option>`;
    });
    html += '</optgroup>';
  }

  return html;
}

export function addRecipeRow(ingredientId = '', quantity = '') {
  const container = document.getElementById('recipe-rows-container');
  const row = document.createElement('div');
  row.className = 'flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs';

  row.innerHTML = `
    <select class="recipe-ing-select flex-1 min-w-[200px] px-2.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white">
      ${buildIngredientOptionsHtml(ingredientId)}
    </select>
    <div class="flex items-center w-28">
      <input type="number" min="0.01" step="any" value="${quantity}" placeholder="Định lượng" class="recipe-qty-input w-full px-2 py-2 border border-slate-200 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-semibold">
      <span class="recipe-unit-display px-2 py-2 bg-slate-100 text-slate-500 rounded-r-lg border border-l-0 border-slate-200">đ/v</span>
    </div>
    <span class="recipe-row-cost font-bold text-slate-700 w-20 text-right">0 đ</span>
    <button type="button" class="btn-del-row p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(row);
  updateRowUnitDisplay(row, '.recipe-ing-select', '.recipe-unit-display');

  row.querySelector('.recipe-ing-select').addEventListener('change', () => {
    updateRowUnitDisplay(row, '.recipe-ing-select', '.recipe-unit-display');
    updateLiveCostCalculation();
  });
  row.querySelector('.recipe-qty-input').addEventListener('input', updateLiveCostCalculation);
  row.querySelector('.btn-del-row').addEventListener('click', () => {
    row.remove();
    updateLiveCostCalculation();
  });

  if (window.lucide) window.lucide.createIcons();
  updateLiveCostCalculation();
}

window.setProductRecipeMode = function(mode) {
  const isBatch = mode === 'batch';
  document.getElementById('prod-recipe-mode').value = isBatch ? 'batch' : 'per_cup';

  const btnPer = document.getElementById('prod-mode-percup-btn');
  const btnBatch = document.getElementById('prod-mode-batch-btn');
  if (btnPer && btnBatch) {
    if (isBatch) {
      btnBatch.className = 'p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-left transition-all';
      btnPer.className = 'p-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-left transition-all';
    } else {
      btnPer.className = 'p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-left transition-all';
      btnBatch.className = 'p-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-left transition-all';
    }
  }

  document.getElementById('prod-batch-yield-bar')?.classList.toggle('hidden', !isBatch);
  document.getElementById('prod-batch-split-toggle')?.classList.toggle('hidden', !isBatch);
  document.getElementById('prod-percup-extras-block')?.classList.toggle('hidden', !isBatch);

  const labelEl = document.getElementById('prod-recipe-section-label');
  if (labelEl) {
    labelEl.textContent = isBatch
      ? 'Nhập nguyên liệu cho 1 MẺ LỚN (VD: cả nồi 2 Lít)'
      : 'Nhập nguyên liệu cho 1 LY CHUẨN';
  }

  const sizesTitle = document.getElementById('prod-sizes-title');
  const sizesSub = document.getElementById('prod-sizes-subtitle');
  const quickBtns = document.getElementById('size-quick-add-btns');

  if (isBatch) {
    if (sizesTitle) sizesTitle.textContent = 'Chia mẻ ra các cỡ ly / dung tích & Đặt giá bán';
    if (sizesSub) sizesSub.textContent = 'Mỗi dòng là 1 cỡ ly/chai với lượng rót khác nhau — App tự chia vốn từ mẻ lớn';
    if (quickBtns) {
      quickBtns.innerHTML = `
        <button type="button" onclick="window.addUnifiedSizeRow({ name: 'Ly S (350ml)', portionVolume: 120, portionCount: 16, packagingCost: 1100, price: 20000 })" class="px-2 py-1 text-[11px] font-bold bg-white hover:bg-emerald-50 text-slate-700 rounded-lg border border-slate-200">+ Ly S (120ml)</button>
        <button type="button" onclick="window.addUnifiedSizeRow({ name: 'Ly M (500ml)', portionVolume: 150, portionCount: 13, packagingCost: 1300, price: 25000 })" class="px-2 py-1 text-[11px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">+ Ly M (150ml)</button>
        <button type="button" onclick="window.addUnifiedSizeRow({ name: 'Ly L (700ml)', portionVolume: 210, portionCount: 9, packagingCost: 1800, price: 32000 })" class="px-2 py-1 text-[11px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">+ Ly L (210ml)</button>
        <button type="button" onclick="window.addUnifiedSizeRow({ name: 'Chai 330ml', portionVolume: 330, portionCount: 6, packagingCost: 2200, price: 28000 })" class="px-2 py-1 text-[11px] font-bold bg-white hover:bg-blue-50 text-blue-700 rounded-lg border border-blue-200">+ Chai 330ml</button>
        <button type="button" onclick="window.addUnifiedSizeRow({ name: '', portionVolume: 180, portionCount: 11, packagingCost: 1300, price: '' })" class="px-2 py-1 text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg">+ Cỡ khác</button>
      `;
    }
  } else {
    if (sizesTitle) sizesTitle.textContent = 'Các cỡ ly (Size) & Giá bán cho khách';
    if (sizesSub) sizesSub.textContent = 'Dòng đầu là Size chuẩn (x1). Có thể thêm Size L (x1.4), Size XL (x2.0)...';
    if (quickBtns) {
      quickBtns.innerHTML = `
        <button type="button" onclick="window.addUnifiedSizeRow({ name: 'Ly L (700ml)', scaleFactor: 1.4, packagingCost: 1800, price: '' })" class="px-2 py-1 text-[11px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">+ Ly L (x1.4)</button>
        <button type="button" onclick="window.addUnifiedSizeRow({ name: 'Ly XL (1000ml)', scaleFactor: 2.0, packagingCost: 2500, price: '' })" class="px-2 py-1 text-[11px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">+ Ly XL (x2.0)</button>
        <button type="button" onclick="window.addUnifiedSizeRow({ name: '', scaleFactor: 1.2, packagingCost: 0, price: '' })" class="px-2 py-1 text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg">+ Cỡ khác</button>
      `;
    }
  }

  syncBatchSplitModeUI();
  if (window.lucide) window.lucide.createIcons();
};

function syncBatchSplitModeUI() {
  const isBatch = document.getElementById('prod-recipe-mode')?.value === 'batch';
  const splitMode = document.querySelector('input[name="prod-batch-split-mode"]:checked')?.value || 'by_volume';
  const yieldUnit = document.getElementById('prod-batch-yield-unit')?.value || 'ml';

  const colHeader = document.getElementById('size-col-metric-header');
  if (colHeader) {
    if (!isBatch) colHeader.textContent = 'Hệ số định lượng';
    else colHeader.textContent = splitMode === 'by_count' ? 'Số ly / 1 mẻ' : `Lượng rót (${yieldUnit}/ly)`;
  }

  document.querySelectorAll('#unified-sizes-container .size-row').forEach((row, idx) => {
    row.querySelector('.sz-percup-col')?.classList.toggle('hidden', isBatch);
    row.querySelector('.sz-batch-vol-col')?.classList.toggle('hidden', !(isBatch && splitMode === 'by_volume'));
    row.querySelector('.sz-batch-cnt-col')?.classList.toggle('hidden', !(isBatch && splitMode === 'by_count'));
    const unitTag = row.querySelector('.sz-unit-tag');
    if (unitTag) unitTag.textContent = yieldUnit;
    // Dòng đầu tiên ở chế độ per_cup mặc định hệ số 1
    if (!isBatch && idx === 0) {
      const sc = row.querySelector('.sz-scale');
      if (sc && !Number(sc.value)) sc.value = '1';
    }
  });

  updateLiveCostCalculation();
}

window.addPerCupExtraRow = function(ingredientId = '', quantity = '') {
  const container = document.getElementById('percup-extras-container');
  const row = document.createElement('div');
  row.className = 'flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs';

  row.innerHTML = `
    <select class="extra-ing-select flex-1 min-w-[180px] px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white">
      ${buildIngredientOptionsHtml(ingredientId)}
    </select>
    <div class="flex items-center w-28">
      <input type="number" min="0.01" step="any" value="${quantity}" placeholder="Lượng/ly" class="extra-qty-input w-full px-2 py-1.5 border border-slate-200 rounded-l-lg bg-white font-semibold">
      <span class="extra-unit-display px-2 py-1.5 bg-slate-100 text-slate-600 rounded-r-lg border border-l-0 border-slate-200">cái</span>
    </div>
    <span class="extra-row-cost font-bold text-slate-700 w-20 text-right">0 đ</span>
    <button type="button" class="btn-del-extra p-1 text-slate-400 hover:text-rose-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
  `;

  container.appendChild(row);
  updateRowUnitDisplay(row, '.extra-ing-select', '.extra-unit-display');

  row.querySelector('.extra-ing-select').addEventListener('change', () => {
    updateRowUnitDisplay(row, '.extra-ing-select', '.extra-unit-display');
    updateLiveCostCalculation();
  });
  row.querySelector('.extra-qty-input').addEventListener('input', updateLiveCostCalculation);
  row.querySelector('.btn-del-extra').addEventListener('click', () => {
    row.remove();
    updateLiveCostCalculation();
  });

  if (window.lucide) window.lucide.createIcons();
  updateLiveCostCalculation();
};

window.addUnifiedSizeRow = function({
  name = '',
  portionVolume = 150,
  portionCount = 13,
  scaleFactor = 1,
  packagingCost = 0,
  price = ''
} = {}) {
  const container = document.getElementById('unified-sizes-container');
  const row = document.createElement('div');
  row.className = 'size-row bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2';

  const yieldUnit = document.getElementById('prod-batch-yield-unit')?.value || 'ml';

  row.innerHTML = `
    <div class="grid grid-cols-12 gap-2 items-center text-xs">
      <div class="col-span-12 sm:col-span-4">
        <label class="sm:hidden block text-[10px] font-bold text-slate-500 mb-0.5">Tên cỡ ly / chai</label>
        <input type="text" required placeholder="VD: Ly M (500ml)" value="${escapeHtml(name)}" class="sz-name w-full px-2.5 py-2 border border-slate-200 rounded-lg font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-none">
      </div>

      <div class="sz-batch-vol-col col-span-6 sm:col-span-3">
        <label class="sm:hidden block text-[10px] font-bold text-slate-500 mb-0.5">Lượng rót (${yieldUnit}/ly)</label>
        <div class="flex items-center">
          <input type="number" min="1" step="any" value="${portionVolume}" class="sz-portion-vol w-full px-2.5 py-2 border border-amber-300 rounded-l-lg font-extrabold text-amber-800 bg-amber-50/40 focus:outline-none">
          <span class="sz-unit-tag px-2 py-2 bg-amber-100 text-amber-900 font-bold rounded-r-lg border border-l-0 border-amber-300">${escapeHtml(yieldUnit)}</span>
        </div>
      </div>

      <div class="sz-batch-cnt-col hidden col-span-6 sm:col-span-3">
        <label class="sm:hidden block text-[10px] font-bold text-slate-500 mb-0.5">Số ly / 1 mẻ</label>
        <div class="flex items-center">
          <input type="number" min="1" step="1" value="${portionCount}" class="sz-portion-cnt w-full px-2.5 py-2 border border-amber-300 rounded-l-lg font-extrabold text-amber-800 bg-amber-50/40 focus:outline-none">
          <span class="px-2 py-2 bg-amber-100 text-amber-900 font-bold rounded-r-lg border border-l-0 border-amber-300">ly</span>
        </div>
      </div>

      <div class="sz-percup-col hidden col-span-6 sm:col-span-3">
        <label class="sm:hidden block text-[10px] font-bold text-slate-500 mb-0.5">Hệ số định lượng</label>
        <div class="flex items-center">
          <span class="px-2 py-2 bg-slate-100 text-slate-500 font-bold rounded-l-lg border border-r-0 border-slate-200">x</span>
          <input type="number" min="0.2" step="0.05" value="${scaleFactor}" class="sz-scale w-full px-2.5 py-2 border border-slate-200 rounded-r-lg font-bold text-emerald-700 focus:outline-none">
        </div>
      </div>

      <div class="col-span-6 sm:col-span-2">
        <label class="sm:hidden block text-[10px] font-bold text-slate-500 mb-0.5">Tiền ly/chai (đ)</label>
        <input type="number" min="0" step="100" value="${packagingCost}" placeholder="1300" class="sz-pkg w-full px-2 py-2 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:outline-none" title="Tiền ly, nắp, ống hút hoặc vỏ chai của cỡ này">
      </div>

      <div class="col-span-10 sm:col-span-2">
        <label class="sm:hidden block text-[10px] font-bold text-slate-500 mb-0.5">Giá bán (đ)</label>
        <input type="number" required min="0" step="500" value="${price}" placeholder="25000" class="sz-price w-full px-2 py-2 border border-emerald-300 rounded-lg font-extrabold text-slate-900 bg-emerald-50/30 focus:ring-1 focus:ring-emerald-500 focus:outline-none">
      </div>

      <div class="col-span-2 sm:col-span-1 flex justify-end">
        <button type="button" class="btn-del-size p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Xóa cỡ này">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
    <div class="sz-live-summary text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg text-slate-600 flex flex-wrap items-center justify-between gap-1.5"></div>
  `;

  container.appendChild(row);
  row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateLiveCostCalculation));
  row.querySelector('.btn-del-size').addEventListener('click', () => {
    if (container.querySelectorAll('.size-row').length <= 1) {
      return showToast('Cần giữ lại ít nhất 1 cỡ ly để bán!', 'warning');
    }
    row.remove();
    updateLiveCostCalculation();
  });

  syncBatchSplitModeUI();
  if (window.lucide) window.lucide.createIcons();
};

function updateRowUnitDisplay(row, selectSelector, unitSelector) {
  const select = row.querySelector(selectSelector);
  const unitSpan = row.querySelector(unitSelector);
  const selectedOpt = select?.options[select.selectedIndex];
  if (unitSpan && selectedOpt && selectedOpt.dataset.unit) {
    unitSpan.textContent = selectedOpt.dataset.unit;
  }
}

let cachedProductSimSizes = [];

export function updateLiveCostCalculation() {
  const isBatch = document.getElementById('prod-recipe-mode')?.value === 'batch';
  const rows = document.querySelectorAll('#recipe-rows-container > div');
  let rawRecipeCost = 0;
  let rawRecipeKcal = 0;

  rows.forEach(row => {
    const select = row.querySelector('.recipe-ing-select');
    const qtyInput = row.querySelector('.recipe-qty-input');
    const costSpan = row.querySelector('.recipe-row-cost');
    const selectedOpt = select.options[select.selectedIndex];

    if (selectedOpt && selectedOpt.value) {
      const costPerUnit = Number(selectedOpt.dataset.cost) || 0;
      const kcalPerUnit = Number(selectedOpt.dataset.kcal) || 0;
      const qty = Number(qtyInput.value) || 0;
      const exactRowCost = costPerUnit * qty;
      costSpan.textContent = formatMoney(exactRowCost);
      rawRecipeCost += exactRowCost;
      rawRecipeKcal += kcalPerUnit * qty;
    } else {
      costSpan.textContent = '0 đ';
    }
  });

  let extrasCostPerCup = 0;
  if (isBatch) {
    document.querySelectorAll('#percup-extras-container > div').forEach(row => {
      const select = row.querySelector('.extra-ing-select');
      const qty = Number(row.querySelector('.extra-qty-input')?.value) || 0;
      const costSpan = row.querySelector('.extra-row-cost');
      const opt = select?.options[select.selectedIndex];
      if (opt && opt.value) {
        const c = (Number(opt.dataset.cost) || 0) * qty;
        costSpan.textContent = formatMoney(c);
        extrasCostPerCup += c;
      } else if (costSpan) {
        costSpan.textContent = '0 đ';
      }
    });
  }

  const wastePct = Number(document.getElementById('prod-waste-percent')?.value) || 0;
  const targetPct = Number(document.getElementById('prod-target-cost')?.value) || 30;
  const yieldVol = Math.max(0, Number(document.getElementById('prod-batch-yield-vol')?.value) || 0);
  const yieldUnit = document.getElementById('prod-batch-yield-unit')?.value || 'ml';
  const splitMode = document.querySelector('input[name="prod-batch-split-mode"]:checked')?.value || 'by_volume';
  const batchTotalCost = Math.round(rawRecipeCost * (1 + wastePct / 100));
  const costPerUnitYield = yieldVol > 0 ? Math.round((batchTotalCost / yieldVol) * 100) / 100 : 0;

  if (isBatch) {
    const pillEl = document.getElementById('batch-live-unit-cost-pill');
    if (pillEl) {
      pillEl.textContent = `Tổng vốn mẻ: ${formatMoney(batchTotalCost)} (${formatMoneyExact(costPerUnitYield)}/${yieldUnit})`;
    }
  }

  // Tính live cho TẤT CẢ các cỡ ly trong bảng thống nhất
  const simSizes = [];
  document.querySelectorAll('#unified-sizes-container .size-row').forEach((row, idx) => {
    const name = row.querySelector('.sz-name')?.value?.trim() || `Cỡ ${idx + 1}`;
    const pkg = Number(row.querySelector('.sz-pkg')?.value) || 0;
    const price = Number(row.querySelector('.sz-price')?.value) || 0;
    const summaryEl = row.querySelector('.sz-live-summary');

    let cupCost = 0;
    let leftInfo = '';
    let rightInfo = '';

    if (isBatch) {
      let cups = 0;
      let frac = 0;
      let leftover = 0;
      let pVol = 0;

      if (splitMode === 'by_count') {
        cups = Math.max(1, Number(row.querySelector('.sz-portion-cnt')?.value) || 1);
        frac = 1 / cups;
        pVol = yieldVol > 0 ? Math.round(yieldVol / cups) : 0;
      } else {
        pVol = Math.max(1, Number(row.querySelector('.sz-portion-vol')?.value) || 150);
        if (yieldVol > 0) {
          cups = Math.floor(yieldVol / pVol);
          leftover = Math.round(yieldVol - cups * pVol);
          frac = pVol / yieldVol;
        }
      }

      const liquidCost = Math.round(batchTotalCost * frac);
      cupCost = Math.round(liquidCost + extrasCostPerCup + pkg);
      const profit = price - cupCost;
      const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
      const suggested = suggestRetailPrice(cupCost, targetPct);
      const profitBatch = cups * profit;

      leftInfo = `<span>Chia được <b class="text-amber-800">${cups} ly/mẻ</b>${leftover > 0 ? ` (dư ${leftover}${yieldUnit})` : (splitMode === 'by_count' && pVol > 0 ? ` (~${pVol}${yieldUnit}/ly)` : '')} · Vốn: <b class="text-amber-700">${formatMoney(cupCost)}/ly</b></span>`;
      rightInfo = price > 0
        ? `<span>Lãi: <b class="text-emerald-700">${formatMoney(profit)} (${margin}%)</b> · Cả mẻ lãi <b class="text-emerald-800">${formatMoney(profitBatch)}</b></span>`
        : `<span>Gợi ý giá bán (${targetPct}% vốn): <b class="text-blue-700">${formatMoney(suggested)}</b></span>`;
    } else {
      const factor = Number(row.querySelector('.sz-scale')?.value) || 1;
      cupCost = Math.round(rawRecipeCost * factor * (1 + wastePct / 100) + pkg);
      const kcal = Math.round(rawRecipeKcal * factor);
      const profit = price - cupCost;
      const margin = price > 0 ? Math.round((profit / price) * 100) : 0;
      const suggested = suggestRetailPrice(cupCost, targetPct);

      leftInfo = `<span>Giá vốn 1 ly: <b class="text-amber-700">${formatMoney(cupCost)}</b>${kcal > 0 ? ` · ${kcal} kcal` : ''}</span>`;
      rightInfo = price > 0
        ? `<span>Lãi gộp: <b class="text-emerald-700">${formatMoney(profit)} (${margin}%)</b> · Gợi ý: <b class="text-blue-700">${formatMoney(suggested)}</b></span>`
        : `<span>Gợi ý giá bán (${targetPct}% vốn): <b class="text-blue-700">${formatMoney(suggested)}</b></span>`;
    }

    if (summaryEl) summaryEl.innerHTML = `${leftInfo}${rightInfo}`;
    simSizes.push({ id: `sz-${idx}`, name, cost: cupCost, price });
  });

  // Cập nhật Bước 4: Bộ ghép thử Size + Nhiều Topping
  cachedProductSimSizes = simSizes;
  const sizeSelect = document.getElementById('prod-sim-size-select');
  const topListEl = document.getElementById('prod-sim-toppings-list');
  if (sizeSelect && topListEl) {
    const prevVal = sizeSelect.value;
    sizeSelect.innerHTML = simSizes.map(s => `<option value="${s.id}">${escapeHtml(s.name)} (vốn ${formatMoney(s.cost)})</option>`).join('');
    if (simSizes.some(s => s.id === prevVal)) sizeSelect.value = prevVal;

    const prevChecked = new Set(Array.from(topListEl.querySelectorAll('input:checked')).map(i => i.value));
    if (!globalToppings.length) {
      topListEl.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 w-full text-[11px] text-slate-600">
          <span>Quán chưa tạo topping gọi thêm nào (Trân châu, Pudding, Kem cheese...).</span>
          <button type="button" onclick="window.openAddToppingModal()" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg">+ Tạo Topping ngay</button>
        </div>
      `;
    } else {
      topListEl.innerHTML = globalToppings.map(t => `
        <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-purple-200 hover:border-purple-400 cursor-pointer text-[11px]">
          <input type="checkbox" class="prod-sim-top-cb accent-purple-600" value="${t._id}" ${prevChecked.has(t._id) ? 'checked' : ''} onchange="window.recalcProductModalCupSimulator()">
          <span class="font-semibold text-slate-800">${escapeHtml(t.name)}</span>
          <span class="text-purple-700 font-bold">+${Math.round(t.price / 1000)}k</span>
        </label>
      `).join('');
    }
    window.recalcProductModalCupSimulator();
  }
}

window.recalcProductModalCupSimulator = function() {
  const sizeSelect = document.getElementById('prod-sim-size-select');
  const resEl = document.getElementById('prod-sim-result');
  if (!sizeSelect || !resEl) return;

  const chosen = cachedProductSimSizes.find(s => s.id === sizeSelect.value) || cachedProductSimSizes[0];
  if (!chosen) return;

  const checkedIds = Array.from(document.querySelectorAll('.prod-sim-top-cb:checked')).map(cb => cb.value);
  let topCost = 0;
  let topPrice = 0;
  const topNames = [];
  checkedIds.forEach(id => {
    const t = globalToppings.find(x => x._id === id);
    if (t) {
      topCost += t.costPrice || 0;
      topPrice += t.price || 0;
      topNames.push(t.name);
    }
  });

  const totalCost = chosen.cost + topCost;
  const totalPrice = chosen.price + topPrice;
  const profit = totalPrice - totalCost;
  const margin = totalPrice > 0 ? Math.round((profit / totalPrice) * 100) : 0;
  const targetPct = Number(document.getElementById('prod-target-cost')?.value) || 30;
  const suggested = suggestRetailPrice(totalCost, targetPct);

  resEl.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <span class="font-bold text-slate-900">1 ly ${escapeHtml(chosen.name)}</span>${topNames.length ? ` <span class="text-purple-700 font-semibold">+ ${topNames.map(escapeHtml).join(' + ')}</span>` : ' <span class="text-slate-400">(chưa thêm topping)</span>'}
        <div class="text-[11px] text-slate-500 mt-0.5">
          Vốn ly (${formatMoney(chosen.cost)})${topCost > 0 ? ` + Vốn topping (${formatMoney(topCost)})` : ''} = <b class="text-amber-700">${formatMoney(totalCost)}</b>
        </div>
      </div>
      <div class="text-right">
        <div class="text-sm font-extrabold text-emerald-700">Giá khách trả: ${formatMoney(totalPrice)}</div>
        <div class="text-[11px] text-slate-600">Lãi: <b class="text-emerald-700">${formatMoney(profit)} (${margin}%)</b> · Gợi ý: <b class="text-blue-700">${formatMoney(suggested)}</b></div>
      </div>
    </div>
  `;
};

window.openAddProductModal = async function() {
  if (!globalIngredients.length) globalIngredients = await API.getIngredients();
  if (!globalToppings.length) globalToppings = await API.getToppings();

  document.getElementById('modal-product-title').textContent = 'Thêm Món Nước Mới';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-category').value = 'Trà sữa';
  document.getElementById('prod-image').value = '🧋';
  document.getElementById('prod-description').value = '';
  document.getElementById('prod-target-cost').value = '30';
  document.getElementById('prod-packaging-note').value = 'Ly, nắp, ống hút';
  document.getElementById('prod-waste-percent').value = '0';

  document.getElementById('prod-batch-yield-vol').value = '2000';
  document.getElementById('prod-batch-yield-unit').value = 'ml';
  document.querySelector('input[name="prod-batch-split-mode"][value="by_volume"]').checked = true;

  document.getElementById('recipe-rows-container').innerHTML = '';
  document.getElementById('percup-extras-container').innerHTML = '';
  document.getElementById('unified-sizes-container').innerHTML = '';

  window.setProductRecipeMode('batch');
  addRecipeRow();
  addRecipeRow();
  window.addUnifiedSizeRow({ name: 'Ly M (500ml)', portionVolume: 150, portionCount: 13, scaleFactor: 1, packagingCost: 1300, price: 25000 });
  window.addUnifiedSizeRow({ name: 'Ly L (700ml)', portionVolume: 210, portionCount: 9, scaleFactor: 1.4, packagingCost: 1800, price: 32000 });
  window.openModal('modal-product');
};

window.openEditProductModal = async function(productId) {
  if (!globalIngredients.length) globalIngredients = await API.getIngredients();
  if (!globalToppings.length) globalToppings = await API.getToppings();
  const p = await API.getProduct(productId);
  if (!p) return;

  document.getElementById('modal-product-title').textContent = `Chỉnh Sửa Món: ${p.name}`;
  document.getElementById('prod-id').value = p._id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-image').value = p.image || '🥤';
  document.getElementById('prod-description').value = p.description || '';
  document.getElementById('prod-target-cost').value = p.targetCostPercent || 30;
  document.getElementById('prod-packaging-note').value = p.packagingNote || 'Ly, nắp, ống hút';
  document.getElementById('prod-waste-percent').value = p.wastePercent || 0;

  document.getElementById('prod-batch-yield-vol').value = p.batchYieldVolume || 2000;
  document.getElementById('prod-batch-yield-unit').value = p.batchYieldUnit || 'ml';
  const splitModeVal = p.batchSplitMode === 'by_count' ? 'by_count' : 'by_volume';
  const splitRadio = document.querySelector(`input[name="prod-batch-split-mode"][value="${splitModeVal}"]`);
  if (splitRadio) splitRadio.checked = true;

  const container = document.getElementById('recipe-rows-container');
  container.innerHTML = '';
  if (p.recipe && p.recipe.length > 0) {
    p.recipe.forEach(item => {
      const ingId = item.ingredient ? (item.ingredient._id || item.ingredient) : '';
      addRecipeRow(ingId, item.quantity);
    });
  } else {
    addRecipeRow();
  }

  const extrasContainer = document.getElementById('percup-extras-container');
  extrasContainer.innerHTML = '';
  if (Array.isArray(p.perCupExtras) && p.perCupExtras.length > 0) {
    p.perCupExtras.forEach(item => {
      const ingId = item.ingredient ? (item.ingredient._id || item.ingredient) : '';
      window.addPerCupExtraRow(ingId, item.quantity);
    });
  }

  const sizesContainer = document.getElementById('unified-sizes-container');
  sizesContainer.innerHTML = '';
  window.setProductRecipeMode(p.recipeMode === 'batch' ? 'batch' : 'per_cup');

  // Nạp dòng đầu tiên từ Size mặc định
  window.addUnifiedSizeRow({
    name: p.baseSizeLabel || 'Ly 500ml',
    portionVolume: p.batchPortionVolume || 150,
    portionCount: p.batchPortionCount || 15,
    scaleFactor: 1,
    packagingCost: p.packagingCost || 0,
    price: p.price || 0
  });

  // Nạp các size mở rộng (nếu có)
  if (Array.isArray(p.variants) && p.variants.length > 0) {
    p.variants.forEach(v => {
      const vPkg = v.packagingCost !== null && v.packagingCost !== undefined
        ? Number(v.packagingCost)
        : (Number(p.packagingCost) || 0) + (Number(v.extraPackagingCost) || 0);
      window.addUnifiedSizeRow({
        name: v.name,
        portionVolume: v.portionVolume || v.volumeMl || 200,
        portionCount: v.portionCount || 10,
        scaleFactor: v.scaleFactor || 1.4,
        packagingCost: vPkg,
        price: v.price || 0
      });
    });
  }

  window.openModal('modal-product');
  updateLiveCostCalculation();
};

window.confirmDeleteProduct = async function(id, name) {
  if (confirm(`Bạn có chắc chắn muốn xóa món "${name}" khỏi thực đơn không?`)) {
    try {
      await API.deleteProduct(id);
      showToast('Đã xóa món thành công!');
      loadCostingData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// ==================== 3. INVENTORY & SUB-RECIPES (ĐƠN GIẢN HÓA) ====================
export async function loadInventoryData() {
  try {
    const ingredients = await API.getIngredients();
    globalIngredients = ingredients;
    renderInventoryTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderInventoryTable() {
  const searchQuery = (document.getElementById('search-ingredient-input')?.value || '').toLowerCase().trim();

  let totalValue = 0;
  let totalRaw = 0;
  let totalSub = 0;
  let lowStockCount = 0;

  globalIngredients.forEach(ing => {
    totalValue += ing.totalInventoryValue || 0;
    if (ing.isSubRecipe) totalSub++;
    else totalRaw++;
    if (ing.isLowStock) lowStockCount++;
  });

  document.getElementById('inv-total-value').textContent = formatMoney(totalValue);
  document.getElementById('inv-total-raw').textContent = totalRaw;
  document.getElementById('inv-total-sub').textContent = totalSub;
  document.getElementById('inv-low-stock-count').textContent = lowStockCount;

  const filtered = globalIngredients.filter(ing => {
    if (currentInvFilter === 'raw' && ing.isSubRecipe) return false;
    if (currentInvFilter === 'sub' && !ing.isSubRecipe) return false;
    if (currentInvFilter === 'low' && !ing.isLowStock) return false;
    if (searchQuery && !ing.name.toLowerCase().includes(searchQuery) && !(ing.category || '').toLowerCase().includes(searchQuery)) {
      return false;
    }
    return true;
  });

  const tbody = document.getElementById('ingredients-table-body');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400 text-xs">Không có nguyên liệu nào phù hợp bộ lọc.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(ing => {
    const isSub = !!ing.isSubRecipe;
    const isTracked = ing.trackInventory !== false;

    const statusBadge = !isTracked
      ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">∞ Không trừ kho</span>`
      : ing.isLowStock
        ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 badge-low-stock">Sắp hết</span>`
        : `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Đủ dùng</span>`;

    const subSubtitle = isSub
      ? `<div class="text-[11px] text-amber-700 mt-1 flex items-center gap-1.5">
           <span class="bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold">🍲 1 mẻ thu được ${formatNumber(ing.yieldQuantity)} ${escapeHtml(ing.unit)}</span>
           ${ing.wastePercent > 0 ? `<span class="text-slate-400">(hao hụt ${ing.wastePercent}%)</span>` : ''}
         </div>`
      : (ing.usedInSubRecipes && ing.usedInSubRecipes.length > 0
          ? `<div class="text-[10px] text-slate-400 mt-0.5">Dùng trong: ${ing.usedInSubRecipes.map(escapeHtml).join(', ')}</div>`
          : '');

    const primaryActionBtn = isSub
      ? `<button onclick="window.openCookBatchModal('${ing._id}')" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all">🔥 Nấu mẻ</button>`
      : (isTracked
          ? `<button onclick="window.openImportModal('${ing._id}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all">+ Nhập kho</button>`
          : `<span class="text-[11px] text-slate-400 px-2">SOP</span>`);

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-slate-900 flex items-center gap-1.5">
            <span>${isSub ? '🍲' : '📦'}</span>
            <span>${escapeHtml(ing.name)}</span>
          </div>
          ${subSubtitle}
        </td>
        <td class="py-3 px-4 text-slate-600">
          <span class="px-2 py-0.5 rounded-md ${isSub ? 'bg-amber-100 text-amber-900 font-semibold' : 'bg-slate-100 text-slate-700'} text-xs">${escapeHtml(ing.category)}</span>
        </td>
        <td class="py-3 px-4 text-right font-semibold text-slate-800 whitespace-nowrap">${escapeHtml(ing.specPrice || '-')}</td>
        <td class="py-3 px-4 text-right text-xs text-emerald-700 font-bold whitespace-nowrap">
          ${ing.costPerUnit > 0 ? `${formatMoneyExact(ing.costPerUnit)} / ${escapeHtml(ing.unit)}` : '0 đ'}
        </td>
        <td class="py-3 px-4 text-center font-bold text-slate-900 whitespace-nowrap">
          ${isTracked ? `${formatNumber(ing.stockQuantity)} ${escapeHtml(ing.unit)}` : '<span class="text-slate-400 font-normal">-</span>'}
        </td>
        <td class="py-3 px-4 text-center">${statusBadge}</td>
        <td class="py-3 px-4 text-center">
          <div class="flex items-center justify-center gap-1.5">
            ${primaryActionBtn}
            <button onclick="window.openEditIngredientModal('${ing._id}')" class="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Chỉnh sửa"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
            <button onclick="window.confirmDeleteIngredient('${ing._id}', '${escapeHtml(ing.name)}')" class="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50" title="Xóa"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

// ==================== MODAL THÊM / SỬA NGUYÊN LIỆU & BÁN THÀNH PHẨM ====================
window.setIngredientTypeMode = function(isSubRecipe) {
  document.getElementById('ing-is-subrecipe').value = isSubRecipe ? 'true' : 'false';
  const rawBtn = document.getElementById('ing-type-raw-btn');
  const subBtn = document.getElementById('ing-type-sub-btn');
  const rawSection = document.getElementById('section-raw-ingredient');
  const subSection = document.getElementById('section-sub-recipe');
  const roleLabel = document.getElementById('ing-name-role-label');

  if (isSubRecipe) {
    subBtn.classList.add('border-amber-500', 'bg-amber-50');
    subBtn.classList.remove('border-slate-200', 'bg-white');
    rawBtn.classList.remove('border-emerald-500', 'bg-emerald-50');
    rawBtn.classList.add('border-slate-200', 'bg-white');
    rawSection.classList.add('hidden');
    subSection.classList.remove('hidden');
    if (roleLabel) roleLabel.textContent = 'bán thành phẩm (mẻ)';
    document.getElementById('ing-category').value = 'Bán thành phẩm (Mẻ)';
    if (!document.getElementById('ing-unit').value || document.getElementById('ing-unit').value === 'g') {
      document.getElementById('ing-unit').value = 'ml';
    }
    const subContainer = document.getElementById('subrecipe-rows-container');
    if (subContainer && subContainer.children.length === 0) {
      window.addSubRecipeRow();
      window.addSubRecipeRow();
    }
    updateSubRecipeLivePreview();
  } else {
    rawBtn.classList.add('border-emerald-500', 'bg-emerald-50');
    rawBtn.classList.remove('border-slate-200', 'bg-white');
    subBtn.classList.remove('border-amber-500', 'bg-amber-50');
    subBtn.classList.add('border-slate-200', 'bg-white');
    rawSection.classList.remove('hidden');
    subSection.classList.add('hidden');
    if (roleLabel) roleLabel.textContent = 'nguyên liệu mua vào';
    window.calculateIngredientCostFromPackage();
  }
  syncSubUnitLabels();
};

function syncSubUnitLabels() {
  const unit = (document.getElementById('ing-unit')?.value || 'g').trim() || 'g';
  const lbl1 = document.getElementById('ing-calc-base-unit-text');
  const lbl2 = document.getElementById('sub-yield-unit-label');
  const convUnitLbl = document.getElementById('ing-conv-unit-label');
  const convHint = document.getElementById('ing-conv-hint');
  if (lbl1) lbl1.textContent = unit;
  if (lbl2) lbl2.textContent = unit;
  if (convUnitLbl) convUnitLbl.textContent = unit;

  if (convHint) {
    const u = unit.toLowerCase();
    if (u === 'miếng') convHint.textContent = 'VD: 1 Lon đào = 12 miếng · 1 Vỉ thạch = 10 miếng';
    else if (u === 'trái' || u === 'quả') convHint.textContent = 'VD: 1 Kg chanh = 15 trái · 1 Bắp = 1 trái';
    else if (u === 'lát') convHint.textContent = 'VD: 1 Trái cam = 8 lát · 1 Kg chanh = 60 lát';
    else if (u === 'cái') convHint.textContent = 'VD: 1 Lốc ly = 50 cái · 1 Hộp bánh flan = 10 cái';
    else if (u === 'ml') convHint.textContent = 'VD: 1 Hộp sữa = 1000 ml · 1 Chai siro = 750 ml';
    else convHint.textContent = 'VD: 1kg = 1000g · 1 lon đào = 12 miếng';
  }
}

window.setBaseUnitQuick = function(unit) {
  const unitInput = document.getElementById('ing-unit');
  if (unitInput) {
    unitInput.value = unit;
    syncSubUnitLabels();
    window.calculateIngredientCostFromPackage();
    updateSubRecipeLivePreview();
  }
};

window.addSubRecipeRow = function(ingredientId = '', quantity = '') {
  const container = document.getElementById('subrecipe-rows-container');
  const currentEditingId = document.getElementById('ing-id')?.value || '';
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2 text-xs';

  row.innerHTML = `
    <select class="sub-ing-select flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-amber-500">
      ${buildIngredientOptionsHtml(ingredientId, currentEditingId)}
    </select>
    <div class="flex items-center w-28">
      <input type="number" min="0.01" step="any" value="${quantity}" placeholder="Lượng" class="sub-qty-input w-full px-2 py-1.5 border border-slate-200 rounded-l-lg bg-white font-semibold">
      <span class="sub-unit-display px-2 py-1.5 bg-slate-100 text-slate-500 rounded-r-lg border border-l-0 border-slate-200">g</span>
    </div>
    <span class="sub-row-cost font-bold text-slate-700 w-20 text-right">0 đ</span>
    <button type="button" class="btn-del-sub-row p-1 text-slate-400 hover:text-rose-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
  `;

  container.appendChild(row);
  updateRowUnitDisplay(row, '.sub-ing-select', '.sub-unit-display');

  row.querySelector('.sub-ing-select').addEventListener('change', () => {
    updateRowUnitDisplay(row, '.sub-ing-select', '.sub-unit-display');
    updateSubRecipeLivePreview();
  });
  row.querySelector('.sub-qty-input').addEventListener('input', updateSubRecipeLivePreview);
  row.querySelector('.btn-del-sub-row').addEventListener('click', () => {
    row.remove();
    updateSubRecipeLivePreview();
  });

  if (window.lucide) window.lucide.createIcons();
  updateSubRecipeLivePreview();
};

function updateSubRecipeLivePreview() {
  const rows = document.querySelectorAll('#subrecipe-rows-container > div');
  let rawBatchCost = 0;
  let totalBatchKcal = 0;

  rows.forEach(row => {
    const select = row.querySelector('.sub-ing-select');
    const qty = Number(row.querySelector('.sub-qty-input').value) || 0;
    const costSpan = row.querySelector('.sub-row-cost');
    const opt = select.options[select.selectedIndex];

    if (opt && opt.value) {
      const unitCost = Number(opt.dataset.cost) || 0;
      const kcalPerUnit = Number(opt.dataset.kcal) || 0;
      const rowCost = qty * unitCost;
      costSpan.textContent = rowCost > 0 ? formatMoney(rowCost) : '-';
      rawBatchCost += rowCost;
      totalBatchKcal += qty * kcalPerUnit;
    } else {
      costSpan.textContent = '0 đ';
    }
  });

  const yieldQty = Number(document.getElementById('sub-yield-qty')?.value) || 0;
  const wastePct = Number(document.getElementById('sub-waste-percent')?.value) || 0;
  const unit = (document.getElementById('ing-unit')?.value || 'ml').trim();

  const batchCost = Math.round(rawBatchCost * (1 + wastePct / 100));
  const unitCost = yieldQty > 0 ? Math.round((batchCost / yieldQty) * 10000) / 10000 : 0;
  const kcalPer100 = yieldQty > 0 ? Math.round((totalBatchKcal / yieldQty) * 100) : 0;

  document.getElementById('sub-preview-batch-cost').textContent = formatMoney(batchCost);
  document.getElementById('sub-preview-unit-cost').textContent = `${formatMoneyExact(unitCost)} / ${unit}`;
  document.getElementById('sub-preview-kcal').textContent = `${kcalPer100} kcal`;
}

window.applyPreset = function(presetKey) {
  const presets = {
    tra_olong: { name: 'Trà Ôlong Lộc Phát', unit: 'g', category: 'Trà & Thảo mộc', purchaseUnit: 'Gói', conversionRate: 1000, purchasePrice: 305000, kcal100: 0, track: true },
    suatuoi: { name: 'Sữa yến mạch Oatside', unit: 'ml', category: 'Sữa & Béo', purchaseUnit: 'Hộp', conversionRate: 1000, purchasePrice: 42000, kcal100: 46, track: true },
    suadac: { name: 'Sữa đặc (1kg)', unit: 'g', category: 'Sữa & Béo', purchaseUnit: 'Hộp', conversionRate: 1000, purchasePrice: 41000, kcal100: 313, track: true },
    nuocduong: { name: 'Nước đường Hàn Quốc', unit: 'ml', category: 'Đường & Syrup', purchaseUnit: 'Can', conversionRate: 25000, purchasePrice: 568000, kcal100: 280, track: true },
    dao_mieng: { name: 'Đào ngâm lon Kronos', unit: 'miếng', category: 'Topping', purchaseUnit: 'Lon', conversionRate: 12, purchasePrice: 54000, kcal100: 0, track: true },
    cafe: { name: 'Cà phê hạt Robusta mộc', unit: 'g', category: 'Cà phê', purchaseUnit: 'Bao', conversionRate: 1000, purchasePrice: 260000, kcal100: 0, track: true },
    ly: { name: 'Ly nhựa PP 500ml + Nắp', unit: 'cái', category: 'Bao bì & Vật tư', purchaseUnit: 'Lốc', conversionRate: 50, purchasePrice: 32500, kcal100: 0, track: true },
    nuoc_da: { name: 'Nước lọc pha chế', unit: 'ml', category: 'Nguyên liệu khác', purchaseUnit: 'Lít', conversionRate: 1000, purchasePrice: 0, kcal100: 0, track: false }
  };

  const p = presets[presetKey];
  if (!p) return;

  const nameInput = document.getElementById('ing-name');
  if (!nameInput.value.trim()) nameInput.value = p.name;
  document.getElementById('ing-unit').value = p.unit;
  document.getElementById('ing-category').value = p.category;
  document.getElementById('ing-purchase-unit').value = p.purchaseUnit;
  document.getElementById('ing-conversion-rate').value = p.conversionRate;
  document.getElementById('ing-purchase-price').value = p.purchasePrice;
  document.getElementById('ing-kcal-100').value = p.kcal100;
  document.getElementById('ing-track-inventory').checked = p.track;
  document.getElementById('ing-stock-fields-box').classList.toggle('opacity-50', !p.track);
  if (!p.track) document.getElementById('ing-cost').value = 0;

  window.calculateIngredientCostFromPackage();
};

window.calculateIngredientCostFromPackage = function() {
  syncSubUnitLabels();
  const baseUnit = (document.getElementById('ing-unit')?.value || 'g').trim();
  const rate = Number(document.getElementById('ing-conversion-rate')?.value) || 0;
  const pPrice = Number(document.getElementById('ing-purchase-price')?.value) || 0;
  const pUnit = (document.getElementById('ing-purchase-unit')?.value || 'đơn vị').trim();

  if (rate > 0 && pPrice >= 0 && document.getElementById('ing-purchase-price').value !== '') {
    const costPerUnit = Math.round((pPrice / rate) * 10000) / 10000;
    document.getElementById('ing-cost').value = costPerUnit;
    document.getElementById('ing-calc-cost-result').textContent = `${formatMoneyExact(costPerUnit)} / ${baseUnit}`;
    document.getElementById('ing-calc-spec-preview').textContent =
      `Quy đổi: 1 ${pUnit} (${formatNumber(rate)} ${baseUnit}) = ${formatMoney(pPrice)}`;
  } else {
    const manualCost = Number(document.getElementById('ing-cost')?.value) || 0;
    document.getElementById('ing-calc-cost-result').textContent = `${formatMoneyExact(manualCost)} / ${baseUnit}`;
  }
};

window.openAddIngredientModal = function(isSubRecipe = false) {
  document.getElementById('modal-ingredient-title').textContent = isSubRecipe
    ? 'Tạo Bán Thành Phẩm / Mẻ Nấu Mới'
    : 'Thêm Nguyên Liệu Mua Vào';
  document.getElementById('ing-id').value = '';
  document.getElementById('ing-name').value = '';
  document.getElementById('ing-unit').value = isSubRecipe ? 'ml' : 'g';
  document.getElementById('ing-category').value = isSubRecipe ? 'Bán thành phẩm (Mẻ)' : 'Trà & Thảo mộc';
  document.getElementById('ing-track-inventory').checked = true;
  document.getElementById('ing-stock-fields-box').classList.remove('opacity-50');
  document.getElementById('ing-purchase-unit').value = '';
  document.getElementById('ing-conversion-rate').value = '';
  document.getElementById('ing-purchase-price').value = '';
  document.getElementById('ing-cost').value = '0';
  document.getElementById('ing-stock').value = '0';
  document.getElementById('ing-min-alert').value = '200';
  document.getElementById('ing-kcal-100').value = '0';
  document.getElementById('ing-notes').value = '';
  document.getElementById('sub-yield-qty').value = '';
  document.getElementById('sub-waste-percent').value = '0';
  document.getElementById('sub-stock').value = '0';
  document.getElementById('sub-instructions').value = '';
  document.getElementById('subrecipe-rows-container').innerHTML = '';

  window.setIngredientTypeMode(isSubRecipe);
  window.openModal('modal-ingredient');
};

window.openEditIngredientModal = function(id) {
  const ing = globalIngredients.find(i => i._id === id);
  if (!ing) return;

  const isSub = !!ing.isSubRecipe;
  document.getElementById('modal-ingredient-title').textContent = `Chỉnh Sửa: ${ing.name}`;
  document.getElementById('ing-id').value = ing._id;
  document.getElementById('ing-name').value = ing.name;
  document.getElementById('ing-category').value = ing.category;
  document.getElementById('ing-unit').value = ing.unit;
  document.getElementById('ing-track-inventory').checked = ing.trackInventory !== false;
  document.getElementById('ing-stock-fields-box').classList.toggle('opacity-50', ing.trackInventory === false);
  document.getElementById('ing-cost').value = ing.costPerUnit;
  document.getElementById('ing-stock').value = ing.stockQuantity;
  document.getElementById('ing-min-alert').value = ing.minStockAlert;
  document.getElementById('ing-kcal-100').value = Math.round((ing.kcalPerUnit || 0) * 100 * 100) / 100;
  document.getElementById('ing-notes').value = ing.notes || '';

  document.getElementById('ing-purchase-unit').value = ing.purchaseUnit || '';
  document.getElementById('ing-conversion-rate').value = ing.conversionRate > 1 ? ing.conversionRate : '';
  document.getElementById('ing-purchase-price').value = ing.purchasePrice || '';

  document.getElementById('sub-yield-qty').value = ing.yieldQuantity || '';
  document.getElementById('sub-waste-percent').value = ing.wastePercent || 0;
  document.getElementById('sub-stock').value = ing.stockQuantity || 0;
  document.getElementById('sub-instructions').value = ing.instructions || '';

  const subContainer = document.getElementById('subrecipe-rows-container');
  subContainer.innerHTML = '';
  if (isSub && Array.isArray(ing.subRecipe) && ing.subRecipe.length > 0) {
    ing.subRecipe.forEach(r => {
      const childId = r.ingredient ? (r.ingredient._id || r.ingredient) : '';
      window.addSubRecipeRow(childId, r.quantity);
    });
  }

  window.setIngredientTypeMode(isSub);
  window.openModal('modal-ingredient');
};

// ==================== MODAL NHẬP KHO SIÊU ĐƠN GIẢN (2 BƯỚC) ====================
window.openImportModal = function(id) {
  const ing = globalIngredients.find(i => i._id === id);
  if (!ing) return;
  activeImportIngredient = ing;

  const rate = ing.conversionRate > 1 ? ing.conversionRate : 1;
  const packUnit = ing.purchaseUnit || (ing.unit === 'g' ? 'Gói' : ing.unit === 'ml' ? 'Hộp' : ing.unit);

  document.getElementById('import-ing-id').value = ing._id;
  document.getElementById('import-conversion-rate').value = rate;
  document.getElementById('import-base-unit').value = ing.unit;
  document.getElementById('import-pack-unit').value = packUnit;

  document.getElementById('import-stock-title').textContent = `Nhập kho: ${ing.name}`;
  document.getElementById('import-stock-subtitle').textContent =
    `Đang tồn ${formatNumber(ing.stockQuantity)} ${ing.unit} · Giá vốn hiện tại: ${ing.specPrice || formatMoneyExact(ing.costPerUnit) + '/' + ing.unit}`;

  const unitSelect = document.getElementById('import-unit-choice');
  if (rate > 1) {
    unitSelect.innerHTML = `
      <option value="package">${escapeHtml(packUnit)} (1 ${escapeHtml(packUnit)} = ${formatNumber(rate)} ${escapeHtml(ing.unit)})</option>
      <option value="base">Nhập lẻ theo ${escapeHtml(ing.unit)}</option>
    `;
  } else {
    unitSelect.innerHTML = `<option value="base">${escapeHtml(ing.unit)}</option>`;
  }

  document.getElementById('import-simple-qty').value = '1';
  document.getElementById('import-price-input-mode').value = 'total';
  document.getElementById('import-money-label').textContent = 'Tổng tiền bạn đã trả (đ)?';
  document.getElementById('btn-toggle-import-price-mode').textContent = 'Đổi sang nhập giá 1 đơn vị';
  document.getElementById('import-money-hint').textContent =
    'Gõ đúng số tiền trên hóa đơn / chuyển khoản. App tự chia ra giá từng g/ml.';

  // Gợi ý sẵn giá gần nhất để chủ quán sửa cho nhanh
  const suggestedTotal = rate > 1
    ? Math.round(ing.purchasePrice || (ing.costPerUnit * rate))
    : Math.round(ing.costPerUnit || 0);
  document.getElementById('import-simple-money').value = suggestedTotal > 0 ? suggestedTotal : '';
  document.getElementById('import-notes').value = '';

  const cascadeEl = document.getElementById('import-cascade-notice');
  if (ing.usedInSubRecipes && ing.usedInSubRecipes.length > 0) {
    cascadeEl.classList.remove('hidden');
    cascadeEl.innerHTML = `⚡ <b>Tự động đồng bộ:</b> Giá vốn mới sẽ tự động cập nhật cho bán thành phẩm: <b>${ing.usedInSubRecipes.map(escapeHtml).join(', ')}</b>`;
  } else {
    cascadeEl.classList.add('hidden');
  }

  updateSimpleImportPreview();
  window.openModal('modal-import-stock');
};

function updateSimpleImportPreview() {
  const ing = activeImportIngredient;
  if (!ing) return;

  const qtyInput = Number(document.getElementById('import-simple-qty')?.value) || 0;
  const moneyInput = Number(document.getElementById('import-simple-money')?.value) || 0;
  const unitChoice = document.getElementById('import-unit-choice')?.value || 'base';
  const priceMode = document.getElementById('import-price-input-mode')?.value || 'total';
  const rate = Number(document.getElementById('import-conversion-rate')?.value) || 1;
  const baseUnit = ing.unit;
  const packUnit = document.getElementById('import-pack-unit')?.value || baseUnit;

  const baseQtyAdded = unitChoice === 'package'
    ? Math.round(qtyInput * rate * 100) / 100
    : qtyInput;

  const totalCost = priceMode === 'total'
    ? Math.round(moneyInput)
    : Math.round(moneyInput * qtyInput);

  const batchUnitCost = baseQtyAdded > 0 ? Math.round((totalCost / baseQtyAdded) * 10000) / 10000 : 0;
  const batchPackCost = unitChoice === 'package' && qtyInput > 0 ? Math.round(totalCost / qtyInput) : Math.round(batchUnitCost * rate);

  const oldStock = Math.max(0, Number(ing.stockQuantity) || 0);
  const newStock = Math.round((oldStock + baseQtyAdded) * 100) / 100;
  const newAvgCost = newStock > 0
    ? Math.round(((oldStock * (ing.costPerUnit || 0) + totalCost) / newStock) * 10000) / 10000
    : batchUnitCost;

  document.getElementById('import-step1-explain').innerHTML = baseQtyAdded > 0
    ? `→ Sẽ cộng thêm <b>${formatNumber(baseQtyAdded)} ${escapeHtml(baseUnit)}</b> vào kho (tồn tăng từ ${formatNumber(oldStock)} lên <b>${formatNumber(newStock)} ${escapeHtml(baseUnit)}</b>)`
    : 'Nhập số lượng bạn vừa mua để xem số lượng cộng vào kho...';

  document.getElementById('import-live-summary').innerHTML = `
    <li>• Cộng vào kho: <b class="text-slate-900">+${formatNumber(baseQtyAdded)} ${escapeHtml(baseUnit)}</b> (Tổng tồn mới: <b>${formatNumber(newStock)} ${escapeHtml(baseUnit)}</b>)</li>
    <li>• Đơn giá đợt nhập này: <b class="text-emerald-700">${formatMoneyExact(batchUnitCost)} / ${escapeHtml(baseUnit)}</b> ${rate > 1 ? `<span class="text-slate-500">(tương đương ${formatMoney(batchPackCost)}/${escapeHtml(packUnit)})</span>` : ''}</li>
    <li>• Giá vốn bình quân sau nhập: <b class="text-emerald-900">${formatMoneyExact(newAvgCost)} / ${escapeHtml(baseUnit)}</b> <span class="text-slate-500">(trung bình tồn cũ & hàng mới)</span></li>
    <li>• Sổ Thu - Chi: tự động ghi 1 phiếu Chi <b class="text-rose-600">${formatMoney(totalCost)}</b></li>
  `;
}

// ==================== MODAL NẤU MẺ BÁN THÀNH PHẨM ====================
window.openCookBatchModal = function(id) {
  const sub = globalIngredients.find(i => i._id === id && i.isSubRecipe);
  if (!sub) return;
  activeCookIngredient = sub;

  document.getElementById('cook-sub-id').value = sub._id;
  document.getElementById('cook-batch-title').textContent = `🍲 Nấu mẻ: ${sub.name}`;
  document.getElementById('cook-batch-subtitle').textContent =
    `1 mẻ chuẩn thu được ${formatNumber(sub.yieldQuantity)} ${sub.unit} · Đang tồn ${formatNumber(sub.stockQuantity)} ${sub.unit}`;
  document.getElementById('cook-yield-unit').textContent = sub.unit;
  document.getElementById('cook-batches-count').value = '1';
  document.getElementById('cook-actual-yield').value = sub.yieldQuantity || '';
  document.getElementById('cook-notes').value = '';

  updateCookBatchPreview();
  window.openModal('modal-cook-batch');
};

function updateCookBatchPreview() {
  const sub = activeCookIngredient;
  if (!sub) return;
  const batches = Number(document.getElementById('cook-batches-count')?.value) || 0;
  const container = document.getElementById('cook-deductions-preview');

  const items = sub.subRecipe || [];
  if (!items.length) {
    container.innerHTML = '<div class="text-slate-400">Chưa có nguyên liệu con trong công thức mẻ này.</div>';
    return;
  }

  container.innerHTML = items.map(row => {
    const child = row.ingredient;
    if (!child || typeof child !== 'object') return '';
    const needed = Math.round(row.quantity * batches * 100) / 100;
    const isTracked = child.trackInventory !== false;
    const enough = !isTracked || (child.stockQuantity >= needed);

    return `
      <div class="flex items-center justify-between py-1 border-b border-slate-200/70 last:border-0">
        <span class="font-medium text-slate-800">${escapeHtml(child.name)}</span>
        <span class="font-bold ${!isTracked ? 'text-slate-400' : (enough ? 'text-emerald-700' : 'text-rose-600')}">
          ${!isTracked ? `${formatNumber(needed)} ${escapeHtml(child.unit)} (không trừ kho)` : `-${formatNumber(needed)} ${escapeHtml(child.unit)} (còn ${formatNumber(child.stockQuantity)})`}
        </span>
      </div>
    `;
  }).join('');
}

window.quickImportByName = function(name) {
  const ing = globalIngredients.find(i => i.name === name);
  if (!ing) return;
  if (ing.isSubRecipe) window.openCookBatchModal(ing._id);
  else window.openImportModal(ing._id);
};

window.confirmDeleteIngredient = async function(id, name) {
  if (confirm(`Bạn có chắc muốn xóa "${name}" không?`)) {
    try {
      await API.deleteIngredient(id);
      showToast('Đã xóa thành công!');
      loadInventoryData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// ==================== 4. POS (HỖ TRỢ NHIỀU SIZE, ĐÓNG CHAI & CHỌN NHIỀU TOPPING) ====================
export async function loadPosData() {
  try {
    const [products, toppings] = await Promise.all([API.getProducts(), API.getToppings()]);
    globalProducts = products;
    globalToppings = toppings;

    const categories = ['Tất cả', ...new Set(products.map(p => p.category))];
    const catContainer = document.getElementById('pos-category-filters');
    catContainer.innerHTML = categories.map((c, i) => `
      <button class="pos-cat-btn ${i === 0 ? 'active bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap" data-category="${escapeHtml(c)}">
        ${escapeHtml(c)}
      </button>
    `).join('');

    catContainer.querySelectorAll('.pos-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => filterPosByCategory(btn.dataset.category));
    });

    renderPosProductList(products);
    updateCartUI();
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPosProductList(products) {
  const container = document.getElementById('pos-product-list');
  if (!products.length) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs">Không tìm thấy món nào.</div>`;
    return;
  }

  const hasToppings = globalToppings.length > 0;

  container.innerHTML = products.map(p => {
    const isOutOfStock = p.hasTrackedIngredient !== false && p.maxCupsPossible <= 0;
    const variants = p.variantBreakdowns || [];
    const hasMultipleOptions = variants.length > 1 || !!p.bottlingSummary;

    const toppingBtn = !isOutOfStock && (hasToppings || hasMultipleOptions) ? `
      <button type="button" onclick="event.stopPropagation(); window.openPosToppingModalForNew('${p._id}', '${escapeHtml(p.baseSizeLabel || '')}')"
        class="px-2 py-1 rounded-lg text-[11px] font-bold border border-purple-200 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-800 transition-all" title="Chọn dung tích / size và nhiều loại topping">
        ${hasMultipleOptions && hasToppings ? '⚙️ Size + Topping' : '+ Topping'}
      </button>
    ` : '';

    let optionsHtml = '';
    if (hasMultipleOptions) {
      const sizeBtns = variants.map(v => `
        <button type="button" ${isOutOfStock ? 'disabled' : `onclick="window.addToCart('${p._id}', '${escapeHtml(v.name)}')"`}
          class="px-2 py-1 rounded-lg text-[11px] font-bold border border-emerald-200 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 transition-all">
          ${escapeHtml(v.name)} · ${Math.round(v.price / 1000)}k
        </button>
      `).join('');

      const bottleBtn = p.bottlingSummary ? `
        <button type="button" ${isOutOfStock ? 'disabled' : `onclick="window.addToCart('${p._id}', '__BOTTLE__')"`}
          class="px-2 py-1 rounded-lg text-[11px] font-bold border border-blue-200 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-800 transition-all">
          🍾 Chai ${p.bottlingSummary.bottleVolumeMl}ml · ${Math.round(p.bottlingSummary.sellPricePerBottle / 1000)}k
        </button>
      ` : '';

      optionsHtml = `<div class="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100">${sizeBtns}${bottleBtn}${toppingBtn}</div>`;
    } else {
      optionsHtml = `
        <div class="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
          <span class="font-extrabold text-slate-900 text-sm">${formatMoney(p.price)}</span>
          <div class="flex items-center gap-1.5">
            ${toppingBtn}
            <button type="button" ${isOutOfStock ? 'disabled' : `onclick="event.stopPropagation(); window.addToCart('${p._id}', '${escapeHtml(p.baseSizeLabel || '')}')"`} class="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div ${!hasMultipleOptions && !isOutOfStock ? `onclick="window.addToCart('${p._id}', '${escapeHtml(p.baseSizeLabel || '')}')"` : ''}
        class="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden ${!hasMultipleOptions ? 'cursor-pointer' : ''} ${isOutOfStock ? 'opacity-60 grayscale' : ''}">
        <div>
          <div class="flex items-start justify-between">
            <span class="text-3xl">${escapeHtml(p.image || '🥤')}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isOutOfStock ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
              ${isOutOfStock ? 'Hết hàng' : (p.hasTrackedIngredient === false ? 'Sẵn sàng' : `Còn ${p.maxCupsPossible} ly`)}
            </span>
          </div>
          <h4 class="font-bold text-slate-900 text-sm mt-2 leading-tight">${escapeHtml(p.name)}</h4>
          <span class="text-[11px] text-slate-400">${escapeHtml(p.category)}</span>
        </div>
        ${optionsHtml}
      </div>
    `;
  }).join('');
  if (window.lucide) window.lucide.createIcons();
}

function filterPosByCategory(category) {
  document.querySelectorAll('.pos-cat-btn').forEach(btn => {
    if (btn.dataset.category === category) {
      btn.classList.add('active', 'bg-slate-900', 'text-white');
      btn.classList.remove('bg-slate-100', 'text-slate-700');
    } else {
      btn.classList.remove('active', 'bg-slate-900', 'text-white');
      btn.classList.add('bg-slate-100', 'text-slate-700');
    }
  });

  if (category === 'Tất cả') renderPosProductList(globalProducts);
  else renderPosProductList(globalProducts.filter(p => p.category === category));
}

function buildCartKey(productId, variantName, selectedToppings = []) {
  const topSig = selectedToppings
    .slice()
    .sort((a, b) => a.toppingId.localeCompare(b.toppingId))
    .map(t => `${t.toppingId}x${t.quantity}`)
    .join(',');
  return `${productId}::${variantName}::${topSig}`;
}

function resolveProductVariantInfo(product, variantName = '') {
  let displayLabel = product.name;
  let basePrice = product.price;
  let baseCost = product.costPrice || 0;
  let resolvedVariant = variantName || product.baseSizeLabel || '';

  if (variantName === '__BOTTLE__' && product.bottlingSummary) {
    displayLabel = `${product.name} (Chai ${product.bottlingSummary.bottleVolumeMl}ml)`;
    basePrice = product.bottlingSummary.sellPricePerBottle;
    baseCost = product.bottlingSummary.costPerBottle;
  } else if (variantName && product.variantBreakdowns) {
    const matched = product.variantBreakdowns.find(v => v.name === variantName);
    if (matched) {
      displayLabel = product.variantBreakdowns.length > 1 ? `${product.name} (${matched.name})` : product.name;
      basePrice = matched.price;
      baseCost = matched.costPrice;
    }
  }
  return { displayLabel, basePrice, baseCost, resolvedVariant };
}

window.addToCart = function(productId, variantName = '', selectedToppings = []) {
  const product = globalProducts.find(p => p._id === productId);
  if (!product) return;

  const { displayLabel, basePrice, baseCost, resolvedVariant } = resolveProductVariantInfo(product, variantName);
  const topPrice = selectedToppings.reduce((sum, t) => sum + (t.price * t.quantity), 0);
  const topCost = selectedToppings.reduce((sum, t) => sum + (t.cost * t.quantity), 0);

  const cartKey = buildCartKey(productId, resolvedVariant, selectedToppings);
  const existing = globalCart.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.quantity++;
  } else {
    globalCart.push({
      cartKey,
      productId,
      variantName: resolvedVariant,
      displayLabel,
      basePrice,
      baseCost,
      toppings: selectedToppings,
      price: basePrice + topPrice,
      cost: baseCost + topCost,
      quantity: 1
    });
  }

  updateCartUI();
};

// Mở popup 2 bước (1. Chọn Dung tích/Size -> 2. Chọn nhiều Topping) cho món mới trên POS
window.openPosToppingModalForNew = function(productId, variantName = '') {
  const product = globalProducts.find(p => p._id === productId);
  if (!product) return;
  const info = resolveProductVariantInfo(product, variantName);
  posToppingContext = {
    mode: 'add',
    productId,
    variantName: info.resolvedVariant,
    basePrice: info.basePrice,
    baseCost: info.baseCost,
    displayLabel: info.displayLabel,
    selectedMap: {}
  };
  renderPosToppingPickerModal();
  window.openModal('modal-pos-topping');
};

// Mở popup đổi Size / thêm-sửa Topping cho 1 dòng đã có trong giỏ hàng
window.openPosToppingModalForCart = function(cartKey) {
  const item = globalCart.find(i => i.cartKey === cartKey);
  if (!item) return;
  const selectedMap = {};
  (item.toppings || []).forEach(t => { selectedMap[t.toppingId] = t.quantity; });

  posToppingContext = {
    mode: 'edit',
    cartKey,
    productId: item.productId,
    variantName: item.variantName,
    basePrice: item.basePrice ?? item.price,
    baseCost: item.baseCost ?? item.cost,
    displayLabel: item.displayLabel,
    selectedMap
  };
  renderPosToppingPickerModal();
  window.openModal('modal-pos-topping');
};

window.selectPosModalVariant = function(variantKey) {
  if (!posToppingContext) return;
  const product = globalProducts.find(p => p._id === posToppingContext.productId);
  if (!product) return;
  const info = resolveProductVariantInfo(product, variantKey);
  posToppingContext.variantName = variantKey === '__BOTTLE__' ? '__BOTTLE__' : info.resolvedVariant;
  posToppingContext.basePrice = info.basePrice;
  posToppingContext.baseCost = info.baseCost;
  posToppingContext.displayLabel = info.displayLabel;
  renderPosToppingPickerModal();
};

function renderPosToppingPickerModal() {
  const ctx = posToppingContext;
  if (!ctx) return;

  const product = globalProducts.find(p => p._id === ctx.productId);
  const variants = product?.variantBreakdowns || [];
  const hasBottle = !!(product && product.bottlingSummary);

  // Bước 1: Render chọn Dung tích / Size ngay đầu popup
  const sizeWrap = document.getElementById('pos-size-selector-wrap');
  const sizeSection = document.getElementById('pos-size-selector-section');
  if (sizeWrap && sizeSection && product) {
    const sizeBtns = variants.map(v => {
      const isSelected = ctx.variantName === v.name || (!ctx.variantName && v.isBase);
      return `
        <button type="button" onclick="window.selectPosModalVariant('${escapeHtml(v.name)}')"
          class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${isSelected ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-400'}">
          ${escapeHtml(v.name)} · ${Math.round(v.price / 1000)}k
        </button>
      `;
    });

    if (hasBottle) {
      const b = product.bottlingSummary;
      const isSelected = ctx.variantName === '__BOTTLE__';
      sizeBtns.push(`
        <button type="button" onclick="window.selectPosModalVariant('__BOTTLE__')"
          class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-blue-800 border-blue-200 hover:border-blue-400'}">
          🍾 Chai ${b.bottleVolumeMl}ml · ${Math.round(b.sellPricePerBottle / 1000)}k
        </button>
      `);
    }

    sizeWrap.innerHTML = sizeBtns.join('');
    sizeSection.classList.toggle('hidden', sizeBtns.length === 0);
  }

  document.getElementById('pos-topping-drink-title').textContent = ctx.displayLabel;
  document.getElementById('pos-topping-drink-subtitle').textContent = `Giá ly chưa topping: ${formatMoney(ctx.basePrice)} (vốn ${formatMoney(ctx.baseCost || 0)})`;
  document.getElementById('btn-confirm-pos-toppings').textContent = ctx.mode === 'edit' ? 'Cập nhật ly này' : 'Thêm 1 ly vào đơn';

  const listEl = document.getElementById('pos-topping-list');
  if (!globalToppings.length) {
    listEl.innerHTML = '<div class="text-center py-4 text-xs text-slate-400">Chưa có topping gọi thêm nào. Bạn có thể tạo ở tab Menu & Giá thành → Topping gọi thêm.</div>';
  } else {
    listEl.innerHTML = globalToppings.map(t => {
      const qty = ctx.selectedMap[t._id] || 0;
      const isSelected = qty > 0;
      return `
        <div class="flex items-center justify-between p-2.5 rounded-xl border transition-all ${isSelected ? 'border-purple-400 bg-purple-50/70' : 'border-slate-200 bg-white'}">
          <div class="flex-1 pr-2 cursor-pointer" onclick="window.adjustPosToppingQty('${t._id}', ${isSelected ? 0 : 1}, true)">
            <div class="font-bold text-xs text-slate-900">🍡 ${escapeHtml(t.name)}</div>
            <div class="text-[11px] text-purple-700 font-semibold">+${formatMoney(t.price)} <span class="text-slate-400 font-normal">(${formatNumber(t.quantity)}${escapeHtml(t.unit)} · vốn ${formatMoney(t.costPrice)})</span></div>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="window.adjustPosToppingQty('${t._id}', -1)" class="w-7 h-7 rounded-lg bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-100">-</button>
            <span class="w-5 text-center font-extrabold text-xs ${isSelected ? 'text-purple-800' : 'text-slate-400'}">${qty}</span>
            <button type="button" onclick="window.adjustPosToppingQty('${t._id}', 1)" class="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700">+</button>
          </div>
        </div>
      `;
    }).join('');
  }

  let extraPrice = 0;
  let extraCost = 0;
  Object.entries(ctx.selectedMap).forEach(([tid, qty]) => {
    const t = globalToppings.find(x => x._id === tid);
    if (t && qty > 0) {
      extraPrice += (t.price || 0) * qty;
      extraCost += (t.costPrice || 0) * qty;
    }
  });

  const finalPrice = (ctx.basePrice || 0) + extraPrice;
  const finalCost = (ctx.baseCost || 0) + extraCost;
  document.getElementById('pos-topping-live-total').textContent = formatMoney(finalPrice);
  const costEl = document.getElementById('pos-topping-live-cost');
  const profEl = document.getElementById('pos-topping-live-profit');
  if (costEl) costEl.textContent = formatMoney(finalCost);
  if (profEl) profEl.textContent = formatMoney(finalPrice - finalCost);
}

window.adjustPosToppingQty = function(toppingId, deltaOrVal, isAbsolute = false) {
  if (!posToppingContext) return;
  const cur = posToppingContext.selectedMap[toppingId] || 0;
  const next = isAbsolute ? deltaOrVal : Math.max(0, cur + deltaOrVal);
  if (next <= 0) delete posToppingContext.selectedMap[toppingId];
  else posToppingContext.selectedMap[toppingId] = next;
  renderPosToppingPickerModal();
};

window.updateCartItemQty = function(cartKey, delta) {
  const idx = globalCart.findIndex(item => item.cartKey === cartKey);
  if (idx > -1) {
    const newQty = globalCart[idx].quantity + delta;
    if (newQty <= 0) globalCart.splice(idx, 1);
    else globalCart[idx].quantity = newQty;
  }
  updateCartUI();
};

function updateCartUI() {
  const cartContainer = document.getElementById('pos-cart-items');
  if (!globalCart.length) {
    cartContainer.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-slate-400 py-12 text-center">
        <i data-lucide="shopping-bag" class="w-10 h-10 text-slate-200 mb-2"></i>
        <p class="text-xs font-medium text-slate-500">Giỏ hàng đang trống</p>
        <p class="text-[11px] text-slate-400">Chọn món, size hoặc bấm "+ Topping" bên trái</p>
      </div>
    `;
    document.getElementById('pos-cart-total-qty').textContent = '0';
    document.getElementById('pos-cart-total-cost').textContent = '0 đ';
    document.getElementById('pos-cart-estimated-profit').textContent = '0 đ';
    document.getElementById('pos-cart-total-amount').textContent = '0 đ';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  let totalQty = 0;
  let totalAmount = 0;
  let totalCost = 0;

  cartContainer.innerHTML = globalCart.map(item => {
    const subtotal = item.price * item.quantity;
    const subcost = (item.cost || 0) * item.quantity;
    totalQty += item.quantity;
    totalAmount += subtotal;
    totalCost += subcost;

    const topBadges = (item.toppings && item.toppings.length > 0)
      ? `<div class="flex flex-wrap gap-1 mt-1">${item.toppings.map(t => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold">+ ${t.quantity > 1 ? `${t.quantity}x ` : ''}${escapeHtml(t.name)}</span>`).join('')}</div>`
      : '';

    const editTopBtn = globalToppings.length > 0
      ? `<button type="button" onclick="window.openPosToppingModalForCart('${escapeHtml(item.cartKey)}')" class="text-[10px] font-bold text-purple-700 hover:underline mt-1 inline-block">🍡 ${item.toppings && item.toppings.length > 0 ? 'Sửa topping' : '+ Thêm topping'}</button>`
      : '';

    return `
      <div class="flex items-start justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
        <div class="flex-1 pr-2">
          <h5 class="font-bold text-slate-900">${escapeHtml(item.displayLabel)}</h5>
          ${topBadges}
          <div class="mt-1">
            <span class="text-slate-500">${formatMoney(item.price)} x ${item.quantity} = </span>
            <span class="font-bold text-emerald-700">${formatMoney(subtotal)}</span>
          </div>
          ${editTopBtn}
        </div>
        <div class="flex items-center gap-1.5 pt-0.5">
          <button onclick="window.updateCartItemQty('${escapeHtml(item.cartKey)}', -1)" class="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100">-</button>
          <span class="font-extrabold text-slate-900 px-1">${item.quantity}</span>
          <button onclick="window.updateCartItemQty('${escapeHtml(item.cartKey)}', 1)" class="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100">+</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('pos-cart-total-qty').textContent = totalQty;
  document.getElementById('pos-cart-total-cost').textContent = formatMoney(totalCost);
  document.getElementById('pos-cart-estimated-profit').textContent = formatMoney(totalAmount - totalCost);
  document.getElementById('pos-cart-total-amount').textContent = formatMoney(totalAmount);
  if (window.lucide) window.lucide.createIcons();
}

// ==================== 5. CASHFLOW ====================
export async function loadCashflowData(type = currentTxTypeFilter) {
  currentTxTypeFilter = type;
  const params = {};
  if (type !== 'all') params.type = type;

  try {
    const data = await API.getTransactions(params);
    const summary = data.summary || {};

    document.getElementById('cashflow-total-income').textContent = formatMoney(summary.totalIncome);
    document.getElementById('cashflow-total-expense').textContent = formatMoney(summary.totalExpense);

    const balEl = document.getElementById('cashflow-balance');
    balEl.textContent = formatMoney(summary.balance);
    balEl.className = summary.balance >= 0 ? 'text-2xl font-extrabold text-slate-900 mt-1' : 'text-2xl font-extrabold text-rose-600 mt-1';

    const tbody = document.getElementById('transactions-table-body');
    if (!data.transactions || !data.transactions.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400">Chưa có giao dịch thu chi nào.</td></tr>`;
    } else {
      tbody.innerHTML = data.transactions.map(t => {
        const isIncome = t.type === 'income';
        const typeBadge = isIncome
          ? `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Thu (+)</span>`
          : `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Chi (-)</span>`;
        const amountColor = isIncome ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold';
        const formattedDate = new Date(t.date || t.createdAt).toLocaleString('vi-VN', {
          hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
        });

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">${formattedDate}</td>
            <td class="py-3 px-4">${typeBadge}</td>
            <td class="py-3 px-4 font-semibold text-slate-800">${escapeHtml(t.category)}</td>
            <td class="py-3 px-4 text-slate-600 text-xs">${escapeHtml(t.description || '-')}</td>
            <td class="py-3 px-4 text-right ${amountColor}">${isIncome ? '+' : '-'}${formatMoney(t.amount)}</td>
            <td class="py-3 px-4 text-center">
              <button onclick="window.confirmDeleteTransaction('${t._id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50" title="Xóa phiếu">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

window.confirmDeleteTransaction = async function(id) {
  if (confirm('Bạn có chắc muốn xóa phiếu thu/chi này không?')) {
    try {
      await API.deleteTransaction(id);
      showToast('Đã xóa phiếu thành công!');
      loadCashflowData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

function updateTxCategories() {
  const type = document.querySelector('input[name="tx-type"]:checked').value;
  const select = document.getElementById('tx-category');
  if (type === 'income') {
    select.innerHTML = `
      <option value="Bán hàng">Bán hàng</option>
      <option value="Thu nợ khách">Thu nợ khách</option>
      <option value="Thu khác">Thu khác</option>
    `;
  } else {
    select.innerHTML = `
      <option value="Tiền mặt bằng">Tiền mặt bằng</option>
      <option value="Điện nước & Internet">Điện nước & Internet</option>
      <option value="Lương nhân viên">Lương nhân viên</option>
      <option value="Đá lạnh & Vật tư tiêu hao">Đá lạnh & Vật tư tiêu hao</option>
      <option value="Sửa chữa máy móc">Sửa chữa máy móc</option>
      <option value="Chi phí khác">Chi phí khác</option>
    `;
  }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();

  // Navigation
  ['dashboard', 'costing', 'inventory', 'pos', 'cashflow'].forEach(t => {
    document.getElementById(`nav-${t}`)?.addEventListener('click', () => switchTab(t));
    document.getElementById(`m-nav-${t}`)?.addEventListener('click', () => switchTab(t));
  });

  // Dashboard periods
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => loadDashboard(btn.dataset.period));
  });

  // Inventory guide toggle
  document.getElementById('btn-toggle-inv-guide')?.addEventListener('click', (e) => {
    const body = document.getElementById('inv-guide-body');
    const hidden = body.classList.toggle('hidden');
    e.currentTarget.textContent = hidden ? 'Xem hướng dẫn' : 'Thu gọn';
  });

  // Inventory filter pills & search
  document.querySelectorAll('.inv-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentInvFilter = btn.dataset.filter;
      document.querySelectorAll('.inv-filter-btn').forEach(b => {
        if (b === btn) {
          b.classList.add('active', 'bg-slate-900', 'text-white');
          b.classList.remove('bg-slate-100', 'text-slate-600');
        } else {
          b.classList.remove('active', 'bg-slate-900', 'text-white');
          b.classList.add('bg-slate-100', 'text-slate-600');
        }
      });
      renderInventoryTable();
    });
  });

  document.getElementById('search-ingredient-input')?.addEventListener('input', renderInventoryTable);

  // POS search
  document.getElementById('pos-search-input')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderPosProductList(globalProducts.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
  });

  // Modals open buttons
  document.getElementById('btn-open-add-product')?.addEventListener('click', window.openAddProductModal);
  document.getElementById('btn-open-add-topping')?.addEventListener('click', window.openAddToppingModal);
  document.getElementById('btn-open-add-ingredient')?.addEventListener('click', () => window.openAddIngredientModal(false));
  document.getElementById('btn-open-add-subrecipe')?.addEventListener('click', () => window.openAddIngredientModal(true));
  document.getElementById('btn-add-recipe-row')?.addEventListener('click', () => addRecipeRow());
  document.getElementById('btn-add-percup-extra-row')?.addEventListener('click', () => window.addPerCupExtraRow());
  document.getElementById('btn-add-subrecipe-row')?.addEventListener('click', () => window.addSubRecipeRow());

  // Menu guide toggle
  document.getElementById('btn-toggle-menu-guide')?.addEventListener('click', (e) => {
    const body = document.getElementById('menu-guide-body');
    const hidden = body.classList.toggle('hidden');
    e.currentTarget.textContent = hidden ? 'Xem hướng dẫn' : 'Thu gọn';
  });

  document.getElementById('prod-sim-size-select')?.addEventListener('change', window.recalcProductModalCupSimulator);

  // Live calculations in Product modal (both per_cup and batch)
  [
    'prod-waste-percent', 'prod-target-cost',
    'prod-batch-yield-vol', 'prod-batch-yield-unit'
  ].forEach(id => {
    document.getElementById(id)?.addEventListener('input', syncBatchSplitModeUI);
    document.getElementById(id)?.addEventListener('change', syncBatchSplitModeUI);
  });

  document.querySelectorAll('input[name="prod-batch-split-mode"]').forEach(r => {
    r.addEventListener('change', syncBatchSplitModeUI);
  });

  // Live calculations & Submit for Topping Modal
  ['topping-ingredient', 'topping-qty', 'topping-price'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateToppingLivePreview);
    document.getElementById(id)?.addEventListener('change', updateToppingLivePreview);
  });

  document.getElementById('form-topping')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('topping-id').value;
    const payload = {
      name: document.getElementById('topping-name').value.trim(),
      ingredient: document.getElementById('topping-ingredient').value,
      quantity: Number(document.getElementById('topping-qty').value),
      price: Number(document.getElementById('topping-price').value),
      notes: document.getElementById('topping-notes').value.trim()
    };
    try {
      if (id) await API.updateTopping(id, payload);
      else await API.createTopping(payload);
      showToast('Lưu topping thành công!');
      window.closeModal('modal-topping');
      await loadCostingData();
      updateLiveCostCalculation();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Confirm multi-select toppings on POS
  document.getElementById('btn-confirm-pos-toppings')?.addEventListener('click', () => {
    const ctx = posToppingContext;
    if (!ctx) return;

    const selectedToppings = Object.entries(ctx.selectedMap)
      .filter(([, qty]) => qty > 0)
      .map(([tid, qty]) => {
        const t = globalToppings.find(x => x._id === tid);
        return t ? { toppingId: t._id, name: t.name, price: t.price || 0, cost: t.costPrice || 0, quantity: qty } : null;
      })
      .filter(Boolean);

    if (ctx.mode === 'edit') {
      const idx = globalCart.findIndex(i => i.cartKey === ctx.cartKey);
      if (idx > -1) {
        const item = globalCart[idx];
        const topPrice = selectedToppings.reduce((s, t) => s + t.price * t.quantity, 0);
        const topCost = selectedToppings.reduce((s, t) => s + t.cost * t.quantity, 0);
        item.variantName = ctx.variantName;
        item.displayLabel = ctx.displayLabel;
        item.basePrice = ctx.basePrice;
        item.baseCost = ctx.baseCost;
        item.toppings = selectedToppings;
        item.price = ctx.basePrice + topPrice;
        item.cost = (ctx.baseCost || 0) + topCost;
        item.cartKey = buildCartKey(item.productId, item.variantName, selectedToppings);
      }
      updateCartUI();
    } else {
      window.addToCart(ctx.productId, ctx.variantName, selectedToppings);
    }

    window.closeModal('modal-pos-topping');
  });

  document.getElementById('prod-bottling-enabled')?.addEventListener('change', (e) => {
    document.getElementById('prod-bottling-fields')?.classList.toggle('hidden', !e.target.checked);
  });

  // SOP toggle in Recipe Sheet modal
  document.getElementById('toggle-sop-mode')?.addEventListener('change', (e) => {
    document.getElementById('recipe-sheet-printable')?.classList.toggle('sop-mode', e.target.checked);
  });

  // Ingredient form live calculations
  ['ing-unit', 'ing-purchase-unit', 'ing-conversion-rate', 'ing-purchase-price', 'ing-cost'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', window.calculateIngredientCostFromPackage);
  });

  document.getElementById('ing-track-inventory')?.addEventListener('change', (e) => {
    document.getElementById('ing-stock-fields-box')?.classList.toggle('opacity-50', !e.target.checked);
  });

  ['sub-yield-qty', 'sub-waste-percent', 'ing-unit'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      syncSubUnitLabels();
      updateSubRecipeLivePreview();
    });
  });

  // Submit Ingredient / Sub-Recipe
  document.getElementById('form-ingredient')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ing-id').value;
    const isSubRecipe = document.getElementById('ing-is-subrecipe').value === 'true';
    const name = document.getElementById('ing-name').value.trim();
    const category = document.getElementById('ing-category').value;
    const unit = document.getElementById('ing-unit').value.trim();
    const trackInventory = document.getElementById('ing-track-inventory').checked;
    const notes = document.getElementById('ing-notes').value.trim();

    let payload;
    if (isSubRecipe) {
      const subRecipe = [];
      document.querySelectorAll('#subrecipe-rows-container > div').forEach(row => {
        const ingId = row.querySelector('.sub-ing-select').value;
        const qty = Number(row.querySelector('.sub-qty-input').value);
        if (ingId && qty > 0) subRecipe.push({ ingredient: ingId, quantity: qty });
      });

      const yieldQuantity = Number(document.getElementById('sub-yield-qty').value);
      if (!yieldQuantity || yieldQuantity <= 0) {
        return showToast('Vui lòng nhập "Thành phẩm thu được 1 mẻ" lớn hơn 0!', 'warning');
      }
      if (!subRecipe.length) {
        return showToast('Vui lòng thêm ít nhất 1 nguyên liệu để nấu mẻ!', 'warning');
      }

      payload = {
        name,
        category: category || 'Bán thành phẩm (Mẻ)',
        unit,
        trackInventory,
        isSubRecipe: true,
        yieldQuantity,
        wastePercent: Number(document.getElementById('sub-waste-percent').value) || 0,
        stockQuantity: Number(document.getElementById('sub-stock').value) || 0,
        minStockAlert: Math.round(yieldQuantity * 0.2),
        subRecipe,
        instructions: document.getElementById('sub-instructions').value.trim(),
        notes
      };
    } else {
      const kcal100 = Number(document.getElementById('ing-kcal-100').value) || 0;
      payload = {
        name,
        category,
        unit,
        trackInventory,
        isSubRecipe: false,
        costPerUnit: Number(document.getElementById('ing-cost').value) || 0,
        stockQuantity: trackInventory ? (Number(document.getElementById('ing-stock').value) || 0) : 0,
        minStockAlert: trackInventory ? (Number(document.getElementById('ing-min-alert').value) || 0) : 0,
        purchaseUnit: document.getElementById('ing-purchase-unit').value.trim(),
        conversionRate: Number(document.getElementById('ing-conversion-rate').value) || 1,
        purchasePrice: Number(document.getElementById('ing-purchase-price').value) || 0,
        kcalPerUnit: Math.round((kcal100 / 100) * 10000) / 10000,
        notes
      };
    }

    try {
      const res = id ? await API.updateIngredient(id, payload) : await API.createIngredient(payload);
      showToast(isSubRecipe ? 'Đã lưu bán thành phẩm & tính giá vốn mẻ!' : 'Lưu nguyên liệu thành công!');
      if (res.updatedSubRecipes && res.updatedSubRecipes.length > 0 && !isSubRecipe) {
        showToast(`Đã tự động cập nhật giá vốn cho: ${res.updatedSubRecipes.join(', ')}`, 'success');
      }
      window.closeModal('modal-ingredient');
      loadInventoryData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Simplified Import Stock interactions
  ['import-simple-qty', 'import-simple-money', 'import-unit-choice'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateSimpleImportPreview);
    document.getElementById(id)?.addEventListener('change', updateSimpleImportPreview);
  });

  document.getElementById('btn-toggle-import-price-mode')?.addEventListener('click', (e) => {
    const modeInput = document.getElementById('import-price-input-mode');
    const isTotal = modeInput.value === 'total';
    modeInput.value = isTotal ? 'unit' : 'total';
    document.getElementById('import-money-label').textContent = isTotal
      ? 'Giá mua của 1 đơn vị vừa chọn (đ)?'
      : 'Tổng tiền bạn đã trả (đ)?';
    e.currentTarget.textContent = isTotal
      ? 'Đổi sang nhập tổng tiền hóa đơn'
      : 'Đổi sang nhập giá 1 đơn vị';
    document.getElementById('import-money-hint').textContent = isTotal
      ? 'Nhập giá mua 1 gói/hộp/đơn vị, app tự nhân theo số lượng mua ở Bước 1.'
      : 'Gõ đúng số tiền trên hóa đơn / chuyển khoản. App tự chia ra giá từng g/ml.';
    updateSimpleImportPreview();
  });

  document.getElementById('form-import-stock')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ing = activeImportIngredient;
    if (!ing) return;

    const qtyInput = Number(document.getElementById('import-simple-qty').value);
    const moneyInput = Number(document.getElementById('import-simple-money').value);
    const unitChoice = document.getElementById('import-unit-choice').value;
    const priceMode = document.getElementById('import-price-input-mode').value;
    const rate = Number(document.getElementById('import-conversion-rate').value) || 1;
    const packUnit = document.getElementById('import-pack-unit').value;
    let notes = document.getElementById('import-notes').value.trim();

    const quantity = unitChoice === 'package' ? Math.round(qtyInput * rate * 100) / 100 : qtyInput;
    const totalCost = priceMode === 'total' ? Math.round(moneyInput) : Math.round(moneyInput * qtyInput);
    const purchasePrice = unitChoice === 'package' && qtyInput > 0 ? Math.round(totalCost / qtyInput) : 0;

    if (unitChoice === 'package' && qtyInput > 0) {
      const packLabel = `Nhập ${qtyInput} ${packUnit}`;
      notes = notes ? `${packLabel} - ${notes}` : packLabel;
    }

    try {
      const res = await API.importIngredient(ing._id, { quantity, totalCost, notes, purchasePrice });
      showToast('Nhập kho thành công & đã ghi Sổ Chi!');
      if (res.updatedSubRecipes && res.updatedSubRecipes.length > 0) {
        showToast(`Đã tự động cập nhật giá vốn cho: ${res.updatedSubRecipes.join(', ')}`, 'success');
      }
      window.closeModal('modal-import-stock');
      loadInventoryData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Cook Batch interactions
  document.getElementById('cook-batches-count')?.addEventListener('input', (e) => {
    const batches = Number(e.target.value) || 0;
    if (activeCookIngredient && activeCookIngredient.yieldQuantity > 0) {
      document.getElementById('cook-actual-yield').value = Math.round(activeCookIngredient.yieldQuantity * batches * 100) / 100;
    }
    updateCookBatchPreview();
  });

  document.getElementById('form-cook-batch')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cook-sub-id').value;
    const batches = Number(document.getElementById('cook-batches-count').value);
    const actualYield = Number(document.getElementById('cook-actual-yield').value);
    const notes = document.getElementById('cook-notes').value.trim();

    try {
      const res = await API.cookSubRecipeBatch(id, { batches, actualYield, notes });
      showToast(res.message || 'Nấu mẻ thành công!');
      if (res.warnings) res.warnings.forEach(w => showToast(w, 'warning'));
      window.closeModal('modal-cook-batch');
      loadInventoryData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Submit Product (unified size table -> base size + variants)
  document.getElementById('form-product')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const recipeMode = document.getElementById('prod-recipe-mode').value === 'batch' ? 'batch' : 'per_cup';
    const batchSplitMode = document.querySelector('input[name="prod-batch-split-mode"]:checked')?.value || 'by_volume';

    const recipe = [];
    document.querySelectorAll('#recipe-rows-container > div').forEach(row => {
      const ingId = row.querySelector('.recipe-ing-select').value;
      const qty = Number(row.querySelector('.recipe-qty-input').value);
      if (ingId && qty > 0) recipe.push({ ingredient: ingId, quantity: qty });
    });

    if (!recipe.length) {
      return showToast('Vui lòng chọn ít nhất 1 nguyên liệu ở Bước 2!', 'warning');
    }

    const perCupExtras = [];
    if (recipeMode === 'batch') {
      document.querySelectorAll('#percup-extras-container > div').forEach(row => {
        const ingId = row.querySelector('.extra-ing-select').value;
        const qty = Number(row.querySelector('.extra-qty-input').value);
        if (ingId && qty > 0) perCupExtras.push({ ingredient: ingId, quantity: qty });
      });
    }

    const allSizeRows = [];
    document.querySelectorAll('#unified-sizes-container .size-row').forEach(row => {
      const name = row.querySelector('.sz-name')?.value?.trim();
      const portionVolume = Number(row.querySelector('.sz-portion-vol')?.value) || 0;
      const portionCount = Number(row.querySelector('.sz-portion-cnt')?.value) || 0;
      const scaleFactor = Number(row.querySelector('.sz-scale')?.value) || 1;
      const packagingCost = Number(row.querySelector('.sz-pkg')?.value) || 0;
      const price = Number(row.querySelector('.sz-price')?.value) || 0;
      if (name) {
        allSizeRows.push({ name, portionVolume, portionCount, scaleFactor, packagingCost, price });
      }
    });

    if (!allSizeRows.length) {
      return showToast('Vui lòng nhập ít nhất 1 cỡ ly / dung tích ở Bước 3!', 'warning');
    }

    const firstSize = allSizeRows[0];
    const extraVariants = allSizeRows.slice(1).map(s => ({
      name: s.name,
      volumeMl: s.portionVolume || 0,
      scaleFactor: s.scaleFactor || 1,
      portionVolume: s.portionVolume || 0,
      portionCount: s.portionCount || 0,
      packagingCost: s.packagingCost,
      extraPackagingCost: 0,
      price: s.price
    }));

    const payload = {
      name: document.getElementById('prod-name').value.trim(),
      category: document.getElementById('prod-category').value,
      recipeMode,
      batchYieldVolume: Number(document.getElementById('prod-batch-yield-vol').value) || 2000,
      batchYieldUnit: document.getElementById('prod-batch-yield-unit').value || 'ml',
      batchSplitMode,
      batchPortionVolume: firstSize.portionVolume || 150,
      batchPortionCount: firstSize.portionCount || 15,
      perCupExtras,
      price: firstSize.price,
      baseSizeLabel: firstSize.name,
      baseVolumeMl: firstSize.portionVolume || 500,
      targetCostPercent: Number(document.getElementById('prod-target-cost').value) || 30,
      packagingCost: firstSize.packagingCost,
      packagingNote: document.getElementById('prod-packaging-note').value.trim(),
      wastePercent: Number(document.getElementById('prod-waste-percent').value) || 0,
      image: document.getElementById('prod-image').value.trim() || '🥤',
      description: document.getElementById('prod-description').value.trim(),
      recipe,
      variants: extraVariants
    };

    try {
      if (id) await API.updateProduct(id, payload);
      else await API.createProduct(payload);
      showToast('Lưu món nước & bảng giá thành công!');
      window.closeModal('modal-product');
      loadCostingData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // POS Cart actions
  document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
    globalCart = [];
    updateCartUI();
  });

  document.getElementById('btn-submit-order')?.addEventListener('click', async () => {
    if (!globalCart.length) return showToast('Giỏ hàng trống!', 'warning');
    const paymentMethod = document.querySelector('input[name="pos-payment"]:checked').value;
    const items = globalCart.map(i => ({
      productId: i.productId,
      variantName: i.variantName,
      quantity: i.quantity,
      toppings: (i.toppings || []).map(t => ({ toppingId: t.toppingId, quantity: t.quantity }))
    }));

    try {
      const res = await API.createOrder({ items, paymentMethod });
      showToast('Tạo đơn thành công! Đã trừ kho theo size & topping.');
      if (res.stockWarnings) res.stockWarnings.forEach(w => showToast(w, 'warning'));
      globalCart = [];
      updateCartUI();
      await loadPosData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // Cashflow modal
  document.getElementById('btn-open-add-transaction')?.addEventListener('click', () => {
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-desc').value = '';
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    updateTxCategories();
    window.openModal('modal-transaction');
  });

  document.querySelectorAll('input[name="tx-type"]').forEach(r => r.addEventListener('change', updateTxCategories));

  document.getElementById('form-transaction')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="tx-type"]:checked').value;
    const category = document.getElementById('tx-category').value;
    const amount = Number(document.getElementById('tx-amount').value);
    const description = document.getElementById('tx-desc').value.trim();
    const date = document.getElementById('tx-date').value;
    try {
      await API.createTransaction({ type, category, amount, description, date });
      showToast('Tạo phiếu thu chi thành công!');
      window.closeModal('modal-transaction');
      loadCashflowData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.querySelectorAll('.tx-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tx-filter-btn').forEach(b => {
        if (b === btn) {
          b.classList.add('active', 'bg-slate-800', 'text-white');
          b.classList.remove('bg-slate-100', 'text-slate-600');
        } else {
          b.classList.remove('active', 'bg-slate-800', 'text-white');
          b.classList.add('bg-slate-100', 'text-slate-600');
        }
      });
      loadCashflowData(btn.dataset.type);
    });
  });

  // Health check
  const health = await API.checkHealth();
  const badge = document.getElementById('db-status-badge');
  if (health.database === 'connected') {
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> <span>MongoDB Atlas Online</span>`;
    badge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
  }

  loadDashboard('30days');
});
