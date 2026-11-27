import { API } from './api.js';

// Global state
let globalIngredients = [];
let globalProducts = [];
let globalCart = [];
let profitChartInstance = null;
let currentTab = 'dashboard';
let currentPeriod = '30days';
let currentTxTypeFilter = 'all';
let currentInvFilter = 'all';
let activeImportIngredient = null;
let activeCookIngredient = null;

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

// ==================== 2. MENU & COSTING (2 TẦNG + NHIỀU SIZE + ĐÓNG CHAI) ====================
export async function loadCostingData() {
  try {
    const [products, ingredients] = await Promise.all([API.getProducts(), API.getIngredients()]);
    globalProducts = products;
    globalIngredients = ingredients;

    const container = document.getElementById('products-grid');
    if (!products.length) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-2">
          <i data-lucide="coffee" class="w-10 h-10 mx-auto text-slate-300"></i>
          <p class="font-semibold text-slate-600">Menu chưa có món nước nào!</p>
          <p class="text-xs text-slate-400">Bấm "Thêm Món Nước Mới" hoặc thử nút "🌽 Nạp mẫu Trà Sữa Ôlong Bắp Non" ở góc trên.</p>
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

      const subCount = (p.subRecipeBreakdowns || []).length;
      const extraSizes = (p.variantBreakdowns || []).slice(1);
      const hasBottling = p.bottlingSummary !== null && p.bottlingSummary !== undefined;

      const badgesHtml = `
        <div class="flex flex-wrap gap-1 mt-1.5">
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">${escapeHtml(p.baseSizeLabel || 'Ly 500ml')}</span>
          ${subCount > 0 ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">🍲 ${subCount} bán thành phẩm</span>` : ''}
          ${extraSizes.length > 0 ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">+${extraSizes.length} size</span>` : ''}
          ${hasBottling ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">🍾 Chai ${p.bottlingSummary.bottleVolumeMl}ml</span>` : ''}
          ${p.totalKcal > 0 ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold">${formatNumber(p.totalKcal)} kcal</span>` : ''}
        </div>
      `;

      const sizeMiniTable = extraSizes.length > 0 ? `
        <div class="mt-2 pt-2 border-t border-slate-200/70 space-y-1">
          ${extraSizes.map(v => `
            <div class="flex justify-between text-[11px] text-slate-600">
              <span>${escapeHtml(v.name)} <span class="text-slate-400">(vốn ${formatMoney(v.costPrice)})</span></span>
              <span class="font-bold text-slate-800">${formatMoney(v.price)} <span class="text-emerald-600">(${v.profitMargin}%)</span></span>
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex items-start gap-2.5">
                <span class="text-2xl p-2 rounded-xl bg-slate-100">${escapeHtml(p.image || '🥤')}</span>
                <div>
                  <h3 class="font-bold text-slate-900 text-base leading-tight">${escapeHtml(p.name)}</h3>
                  <span class="text-[11px] text-slate-500 font-medium">${escapeHtml(p.category)}</span>
                  ${badgesHtml}
                </div>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${marginBadgeColor}">
                Lãi ${p.profitMargin}%
              </span>
            </div>

            <div class="bg-slate-50 rounded-xl p-3 space-y-1.5 text-xs my-3 border border-slate-100">
              <div class="flex justify-between">
                <span class="text-slate-500">Giá bán (${escapeHtml(p.baseSizeLabel || 'Size chuẩn')}):</span>
                <span class="font-bold text-slate-900 text-sm">${formatMoney(p.price)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Giá vốn (COGS · ${p.foodCostPercent || 0}%):</span>
                <span class="font-bold text-amber-700">${formatMoney(p.costPrice)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Gợi ý bán (${p.targetCostPercent || 30}% cost):</span>
                <span class="font-semibold text-blue-700">${formatMoney(p.suggestedPrice)}</span>
              </div>
              <div class="flex justify-between pt-1.5 border-t border-slate-200">
                <span class="font-bold text-emerald-800">Lãi gộp trên 1 ly:</span>
                <span class="font-extrabold text-emerald-600 text-sm">${formatMoney(p.grossProfit)}</span>
              </div>
              ${sizeMiniTable}
            </div>

            <div class="flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${maxCupsColor} mb-2">
              <span class="font-medium">Tồn kho pha được:</span>
              <span class="font-extrabold">${p.hasTrackedIngredient === false ? '∞ Không giới hạn' : `${formatNumber(p.maxCupsPossible)} ly`}</span>
            </div>
          </div>

          <div class="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs">
            <button onclick="window.viewCostBreakdown('${p._id}')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold flex items-center gap-1.5 transition-all">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i> Phiếu công thức & Giá
            </button>
            <div class="flex gap-1.5">
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

// ==================== PHIẾU CÔNG THỨC & GIÁ THÀNH KIỂU TRÀ LỘC PHÁT ====================
window.viewCostBreakdown = async function(productId) {
  try {
    const p = await API.getProduct(productId);
    document.getElementById('breakdown-drink-name').textContent = `${p.image || ''} ${p.name}`;
    document.getElementById('breakdown-drink-category').textContent =
      `Danh mục: ${p.category}${p.description ? ' | ' + p.description : ''}`;

    const sopToggle = document.getElementById('toggle-sop-mode');
    if (sopToggle) sopToggle.checked = false;
    document.getElementById('recipe-sheet-printable')?.classList.remove('sop-mode');

    const sectionsHtml = [];

    // TẦNG 1: Từng bảng Bán thành phẩm (Nước cốt, Sốt, Trân châu...) giống ảnh Trà Lộc Phát
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

        const wasteNote = sub.wastePercent > 0
          ? `<span class="text-[11px] font-normal text-amber-700 ml-1">(đã tính hao hụt ${sub.wastePercent}%)</span>`
          : '';

        const portionsNote = sub.portionsPerBatch > 0
          ? ` <span class="font-normal text-slate-600">(tương đương ~${sub.portionsPerBatch} ly)</span>`
          : '';

        const instrHtml = sub.instructions
          ? `<div class="text-[11px] bg-amber-50/70 text-amber-900 px-3 py-1.5 border border-t-0 border-slate-300"><b>Cách nấu (SOP):</b> ${escapeHtml(sub.instructions)}</div>`
          : '';

        sectionsHtml.push(`
          <div>
            <table class="recipe-sheet-table">
              <thead>
                <tr>
                  <th colspan="5" class="recipe-sheet-header">${escapeHtml(sub.name)}</th>
                </tr>
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
                  <td colspan="3">Thành phẩm thu được ${formatNumber(sub.yieldQuantity)}${escapeHtml(sub.unit)}${portionsNote}${wasteNote}</td>
                  <td class="text-center cost-only">${formatMoneyExact(sub.costPerUnit)}/${escapeHtml(sub.unit)}</td>
                  <td class="text-right font-extrabold text-emerald-900 cost-only">${formatNumber(sub.batchCost)}</td>
                </tr>
                <tr class="bg-white font-bold text-slate-800 cost-only">
                  <td colspan="4">Giá vốn dùng ${formatNumber(sub.usedQuantityInDrink)}${escapeHtml(sub.unit)} cho 1 ${escapeHtml(p.baseSizeLabel || 'ly')}</td>
                  <td class="text-right text-amber-700">${formatNumber(sub.usedCostInDrink)}</td>
                </tr>
              </tbody>
            </table>
            ${instrHtml}
          </div>
        `);
      });
    }

    // TẦNG 2: Bảng RA MÓN SIZE CHUẨN
    const mainRows = (p.recipeDetails || []).map((item, idx) => `
      <tr>
        <td class="text-center text-slate-500 font-medium">${idx + 1}</td>
        <td class="font-medium text-slate-900">
          ${item.isSubRecipe ? '<span class="text-amber-600 mr-1">🍲</span>' : ''}${escapeHtml(item.name)}
        </td>
        <td class="text-center text-slate-600 cost-only">${escapeHtml(item.specPrice)}</td>
        <td class="text-center font-semibold text-slate-800">
          ${formatNumber(item.quantity)}${escapeHtml(item.unit)}
          ${item.kcal > 0 ? `<span class="text-[11px] font-normal text-slate-500"> (${item.kcal}kcal)</span>` : ''}
        </td>
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

    // Các dòng tổng kết từng Size (500ml / 700ml / 1000ml) ngay dưới bảng RA MÓN đúng kiểu ảnh Trà Lộc Phát
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
          <tr>
            <th colspan="5" class="recipe-sheet-header">RA MÓN ${escapeHtml(p.name)} — ${escapeHtml(p.baseSizeLabel || 'LY 500ML')}</th>
          </tr>
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

    // TẦNG 3: Bảng phân tích Lợi nhuận & Gợi ý giá bán theo Size (Ẩn khi in SOP nhân viên)
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
            <tr>
              <th colspan="6" class="bg-emerald-700 text-white font-bold text-center uppercase tracking-wider">PHÂN TÍCH LỢI NHUẬN & GỢI Ý GIÁ BÁN (MỤC TIÊU ${p.targetCostPercent || 30}% COST)</th>
            </tr>
            <tr class="bg-slate-50 text-slate-700">
              <th class="text-left">Size</th>
              <th class="text-right">Giá Vốn</th>
              <th class="text-right">Giá Bán</th>
              <th class="text-right">Lãi Gộp</th>
              <th class="text-center">% Cost</th>
              <th class="text-right">Giá Gợi Ý</th>
            </tr>
          </thead>
          <tbody>${profitRows}</tbody>
        </table>
      </div>
    `);

    // TẦNG 4: Bảng phân tích TRÀ SỮA ĐÓNG CHAI (nếu có bật)
    if (p.bottlingSummary) {
      const b = p.bottlingSummary;
      sectionsHtml.push(`
        <div class="cost-only">
          <table class="recipe-sheet-table">
            <thead>
              <tr>
                <th colspan="4" class="bg-blue-700 text-white font-bold text-center uppercase tracking-wider">🍾 PHÂN TÍCH TRÀ SỮA ĐÓNG CHAI (${b.bottleVolumeMl}ML)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-semibold text-slate-700">Tiền cốt & nguyên liệu (${b.bottleVolumeMl}ml)</td>
                <td class="text-right font-bold">${formatMoney(b.liquidCostPerBottle)}</td>
                <td class="font-semibold text-slate-700">Vỏ chai + Nắp + Tem nhãn</td>
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
                    💡 <b>Hiệu suất theo mẻ (${escapeHtml(b.mainSubName)}):</b> 1 mẻ đóng được khoảng <b>${b.bottlesPerBatch} chai ${b.bottleVolumeMl}ml</b>
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

    document.getElementById('breakdown-sheet-content').innerHTML = sectionsHtml.join('');
    window.openModal('modal-cost-breakdown');
  } catch (err) {
    showToast(err.message, 'error');
  }
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

window.addProductVariantRow = function(name = '', volumeMl = '', scaleFactor = 1.4, price = '', extraPackagingCost = 0) {
  const container = document.getElementById('variant-rows-container');
  const row = document.createElement('div');
  row.className = 'variant-row grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs';

  row.innerHTML = `
    <input type="text" placeholder="VD: Ly 700ml" value="${escapeHtml(name)}" class="var-name col-span-3 px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold">
    <div class="col-span-2">
      <input type="number" placeholder="700ml" value="${volumeMl}" min="0" class="var-vol w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white" title="Dung tích (ml)">
    </div>
    <div class="col-span-2 flex items-center">
      <span class="text-[10px] text-slate-500 mr-1">x</span>
      <input type="number" step="0.05" min="0.2" value="${scaleFactor}" class="var-scale w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-bold text-emerald-700" title="Hệ số nhân định lượng">
    </div>
    <div class="col-span-2">
      <input type="number" min="0" step="100" value="${extraPackagingCost}" placeholder="+Bao bì" class="var-pkg w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white" title="Phụ phí bao bì thêm (đ)">
    </div>
    <div class="col-span-2">
      <input type="number" min="0" step="500" value="${price}" placeholder="Giá bán" class="var-price w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white font-bold" title="Giá bán lẻ (đ)">
    </div>
    <div class="col-span-1 flex items-center justify-end gap-1">
      <button type="button" class="btn-del-var p-1 text-slate-400 hover:text-rose-600"><i data-lucide="x" class="w-4 h-4"></i></button>
    </div>
    <div class="col-span-12 var-live-info text-[11px] text-slate-500 flex justify-between px-1"></div>
  `;

  container.appendChild(row);
  row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateLiveCostCalculation));
  row.querySelector('.btn-del-var').addEventListener('click', () => {
    row.remove();
    updateLiveCostCalculation();
  });

  if (window.lucide) window.lucide.createIcons();
  updateLiveCostCalculation();
};

function updateRowUnitDisplay(row, selectSelector, unitSelector) {
  const select = row.querySelector(selectSelector);
  const unitSpan = row.querySelector(unitSelector);
  const selectedOpt = select?.options[select.selectedIndex];
  if (unitSpan && selectedOpt && selectedOpt.dataset.unit) {
    unitSpan.textContent = selectedOpt.dataset.unit;
  }
}

export function updateLiveCostCalculation() {
  const rows = document.querySelectorAll('#recipe-rows-container > div');
  let rawCost = 0;
  let totalKcal = 0;

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
      rawCost += exactRowCost;
      totalKcal += kcalPerUnit * qty;
    } else {
      costSpan.textContent = '0 đ';
    }
  });

  const pkgCost = Number(document.getElementById('prod-packaging-cost')?.value) || 0;
  const wastePct = Number(document.getElementById('prod-waste-percent')?.value) || 0;
  const targetPct = Number(document.getElementById('prod-target-cost')?.value) || 30;
  const salePrice = Number(document.getElementById('prod-price')?.value) || 0;

  const totalCost = Math.round(rawCost * (1 + wastePct / 100) + pkgCost);
  const grossProfit = salePrice - totalCost;
  const margin = salePrice > 0 ? Math.round((grossProfit / salePrice) * 100) : 0;
  const suggested = suggestRetailPrice(totalCost, targetPct);

  document.getElementById('preview-cost').textContent = formatMoney(totalCost);
  document.getElementById('preview-profit').textContent = formatMoney(grossProfit);
  document.getElementById('preview-margin').textContent = `(${margin}%)`;
  document.getElementById('preview-target-pct').textContent = targetPct;
  document.getElementById('preview-suggested-price').textContent = formatMoney(suggested);
  document.getElementById('preview-kcal').textContent = `${Math.round(totalKcal)} kcal`;

  // Cập nhật live từng dòng Size mở rộng
  document.querySelectorAll('#variant-rows-container .variant-row').forEach(vRow => {
    const factor = Number(vRow.querySelector('.var-scale').value) || 1;
    const extraPkg = Number(vRow.querySelector('.var-pkg').value) || 0;
    const vPrice = Number(vRow.querySelector('.var-price').value) || 0;
    const vCost = Math.round(rawCost * factor * (1 + wastePct / 100) + pkgCost + extraPkg);
    const vKcal = Math.round(totalKcal * factor);
    const vProfit = vPrice - vCost;
    const vMargin = vPrice > 0 ? Math.round((vProfit / vPrice) * 100) : 0;
    const vSuggested = suggestRetailPrice(vCost, targetPct);

    vRow.querySelector('.var-live-info').innerHTML = `
      <span>Vốn: <b class="text-amber-700">${formatMoney(vCost)}</b> ${vKcal > 0 ? `· ${vKcal} kcal` : ''}</span>
      <span>Gợi ý bán: <b class="text-blue-700">${formatMoney(vSuggested)}</b> ${vPrice > 0 ? `· Lãi <b class="text-emerald-700">${vMargin}%</b>` : ''}</span>
    `;
  });
}

window.openAddProductModal = async function() {
  if (!globalIngredients.length) globalIngredients = await API.getIngredients();

  document.getElementById('modal-product-title').textContent = 'Thêm Món Nước Mới & Công Thức';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-category').value = 'Trà sữa';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-base-size').value = 'Ly 500ml';
  document.getElementById('prod-base-vol').value = '500';
  document.getElementById('prod-target-cost').value = '30';
  document.getElementById('prod-packaging-cost').value = '0';
  document.getElementById('prod-packaging-note').value = 'Ly, muỗng, ống hút';
  document.getElementById('prod-waste-percent').value = '0';
  document.getElementById('prod-image').value = '🧋';
  document.getElementById('prod-description').value = '';

  document.getElementById('prod-bottling-enabled').checked = false;
  document.getElementById('prod-bottling-fields').classList.add('hidden');
  document.getElementById('prod-bottle-vol').value = '330';
  document.getElementById('prod-bottle-cost').value = '2200';
  document.getElementById('prod-bottle-price').value = '28000';

  document.getElementById('recipe-rows-container').innerHTML = '';
  document.getElementById('variant-rows-container').innerHTML = '';

  addRecipeRow();
  addRecipeRow();
  window.openModal('modal-product');
};

window.openEditProductModal = async function(productId) {
  if (!globalIngredients.length) globalIngredients = await API.getIngredients();
  const p = await API.getProduct(productId);
  if (!p) return;

  document.getElementById('modal-product-title').textContent = `Chỉnh Sửa Món: ${p.name}`;
  document.getElementById('prod-id').value = p._id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-base-size').value = p.baseSizeLabel || 'Ly 500ml';
  document.getElementById('prod-base-vol').value = p.baseVolumeMl || 500;
  document.getElementById('prod-target-cost').value = p.targetCostPercent || 30;
  document.getElementById('prod-packaging-cost').value = p.packagingCost || 0;
  document.getElementById('prod-packaging-note').value = p.packagingNote || 'Ly, muỗng, ống hút';
  document.getElementById('prod-waste-percent').value = p.wastePercent || 0;
  document.getElementById('prod-image').value = p.image || '🥤';
  document.getElementById('prod-description').value = p.description || '';

  const bottleEnabled = !!(p.bottlingConfig && p.bottlingConfig.enabled);
  document.getElementById('prod-bottling-enabled').checked = bottleEnabled;
  document.getElementById('prod-bottling-fields').classList.toggle('hidden', !bottleEnabled);
  document.getElementById('prod-bottle-vol').value = p.bottlingConfig?.bottleVolumeMl || 330;
  document.getElementById('prod-bottle-cost').value = p.bottlingConfig?.bottleCost || 2200;
  document.getElementById('prod-bottle-price').value = p.bottlingConfig?.sellPricePerBottle || 28000;

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

  const varContainer = document.getElementById('variant-rows-container');
  varContainer.innerHTML = '';
  if (p.variants && p.variants.length > 0) {
    p.variants.forEach(v => {
      window.addProductVariantRow(v.name, v.volumeMl || '', v.scaleFactor || 1, v.price || 0, v.extraPackagingCost || 0);
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
  if (lbl1) lbl1.textContent = unit;
  if (lbl2) lbl2.textContent = unit;
}

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

// ==================== 4. POS (HỖ TRỢ CHỌN NHANH NHIỀU SIZE & ĐÓNG CHAI) ====================
export async function loadPosData() {
  try {
    const products = await API.getProducts();
    globalProducts = products;

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

  container.innerHTML = products.map(p => {
    const isOutOfStock = p.hasTrackedIngredient !== false && p.maxCupsPossible <= 0;
    const variants = p.variantBreakdowns || [];
    const hasMultipleOptions = variants.length > 1 || !!p.bottlingSummary;

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

      optionsHtml = `<div class="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100">${sizeBtns}${bottleBtn}</div>`;
    } else {
      optionsHtml = `
        <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
          <span class="font-extrabold text-slate-900 text-sm">${formatMoney(p.price)}</span>
          <button type="button" ${isOutOfStock ? 'disabled' : `onclick="window.addToCart('${p._id}', '${escapeHtml(p.baseSizeLabel || '')}')"`} class="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          </button>
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

window.addToCart = function(productId, variantName = '') {
  const product = globalProducts.find(p => p._id === productId);
  if (!product) return;

  let displayLabel = product.name;
  let unitPrice = product.price;
  let unitCost = product.costPrice || 0;
  let resolvedVariant = variantName || product.baseSizeLabel || '';

  if (variantName === '__BOTTLE__' && product.bottlingSummary) {
    displayLabel = `${product.name} (Chai ${product.bottlingSummary.bottleVolumeMl}ml)`;
    unitPrice = product.bottlingSummary.sellPricePerBottle;
    unitCost = product.bottlingSummary.costPerBottle;
  } else if (variantName && product.variantBreakdowns) {
    const matched = product.variantBreakdowns.find(v => v.name === variantName);
    if (matched) {
      displayLabel = product.variantBreakdowns.length > 1 ? `${product.name} (${matched.name})` : product.name;
      unitPrice = matched.price;
      unitCost = matched.costPrice;
    }
  }

  const cartKey = `${productId}::${resolvedVariant}`;
  const existing = globalCart.find(item => item.cartKey === cartKey);
  if (existing) {
    existing.quantity++;
  } else {
    globalCart.push({
      cartKey,
      productId,
      variantName: resolvedVariant,
      displayLabel,
      price: unitPrice,
      cost: unitCost,
      quantity: 1
    });
  }

  updateCartUI();
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
        <p class="text-[11px] text-slate-400">Chọn món (hoặc size) bên trái để thêm vào đơn</p>
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

    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
        <div class="flex-1 pr-2">
          <h5 class="font-bold text-slate-900">${escapeHtml(item.displayLabel)}</h5>
          <span class="text-slate-500">${formatMoney(item.price)} x ${item.quantity} = </span>
          <span class="font-bold text-emerald-700">${formatMoney(subtotal)}</span>
        </div>
        <div class="flex items-center gap-1.5">
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

  // Seed Demo Trà Sữa Ôlong Bắp Non button
  document.getElementById('btn-seed-demo-recipe')?.addEventListener('click', async () => {
    try {
      const res = await API.seedDemoRecipe();
      showToast(res.message || 'Đã nạp công thức mẫu thành công!');
      await loadCostingData();
      if (res.product && res.product._id) {
        window.viewCostBreakdown(res.product._id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Modals open buttons
  document.getElementById('btn-open-add-product')?.addEventListener('click', window.openAddProductModal);
  document.getElementById('btn-open-add-ingredient')?.addEventListener('click', () => window.openAddIngredientModal(false));
  document.getElementById('btn-open-add-subrecipe')?.addEventListener('click', () => window.openAddIngredientModal(true));
  document.getElementById('btn-add-recipe-row')?.addEventListener('click', () => addRecipeRow());
  document.getElementById('btn-add-subrecipe-row')?.addEventListener('click', () => window.addSubRecipeRow());

  // Live calculations in Product modal
  ['prod-price', 'prod-packaging-cost', 'prod-waste-percent', 'prod-target-cost'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateLiveCostCalculation);
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

  // Submit Product (with multi-size & bottling)
  document.getElementById('form-product')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;

    const recipe = [];
    document.querySelectorAll('#recipe-rows-container > div').forEach(row => {
      const ingId = row.querySelector('.recipe-ing-select').value;
      const qty = Number(row.querySelector('.recipe-qty-input').value);
      if (ingId && qty > 0) recipe.push({ ingredient: ingId, quantity: qty });
    });

    const variants = [];
    document.querySelectorAll('#variant-rows-container .variant-row').forEach(vRow => {
      const name = vRow.querySelector('.var-name').value.trim();
      const volumeMl = Number(vRow.querySelector('.var-vol').value) || 0;
      const scaleFactor = Number(vRow.querySelector('.var-scale').value) || 1;
      const extraPackagingCost = Number(vRow.querySelector('.var-pkg').value) || 0;
      const price = Number(vRow.querySelector('.var-price').value) || 0;
      if (name) variants.push({ name, volumeMl, scaleFactor, extraPackagingCost, price });
    });

    const payload = {
      name: document.getElementById('prod-name').value.trim(),
      category: document.getElementById('prod-category').value,
      price: Number(document.getElementById('prod-price').value),
      baseSizeLabel: document.getElementById('prod-base-size').value.trim() || 'Ly 500ml',
      baseVolumeMl: Number(document.getElementById('prod-base-vol').value) || 500,
      targetCostPercent: Number(document.getElementById('prod-target-cost').value) || 30,
      packagingCost: Number(document.getElementById('prod-packaging-cost').value) || 0,
      packagingNote: document.getElementById('prod-packaging-note').value.trim(),
      wastePercent: Number(document.getElementById('prod-waste-percent').value) || 0,
      image: document.getElementById('prod-image').value.trim() || '🥤',
      description: document.getElementById('prod-description').value.trim(),
      recipe,
      variants,
      bottlingConfig: {
        enabled: document.getElementById('prod-bottling-enabled').checked,
        bottleVolumeMl: Number(document.getElementById('prod-bottle-vol').value) || 330,
        bottleCost: Number(document.getElementById('prod-bottle-cost').value) || 0,
        sellPricePerBottle: Number(document.getElementById('prod-bottle-price').value) || 0
      }
    };

    try {
      if (id) await API.updateProduct(id, payload);
      else await API.createProduct(payload);
      showToast('Lưu món nước & công thức thành công!');
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
      quantity: i.quantity
    }));

    try {
      const res = await API.createOrder({ items, paymentMethod });
      showToast('Tạo đơn thành công! Đã trừ kho theo size.');
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
