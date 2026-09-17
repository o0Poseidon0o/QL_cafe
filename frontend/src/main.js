import { API } from './api.js';

// Global state
let globalIngredients = [];
let globalProducts = [];
let globalCart = [];
let profitChartInstance = null;
let currentTab = 'dashboard';
let currentPeriod = '30days';
let currentTxTypeFilter = 'all';

// Utility functions
export function formatMoney(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 đ';
  return Math.round(amount).toLocaleString('vi-VN') + ' đ';
}

export function formatNumber(num) {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return Number(num).toLocaleString('vi-VN');
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

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Attach to window so onclick handlers in modals work
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

    if (el) {
      if (t === tabId) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
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

// 1. DASHBOARD
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
    const report = await API.getDashboardReport(period);
    const summary = report.summary || {};

    document.getElementById('stat-revenue').textContent = formatMoney(summary.totalRevenue);
    document.getElementById('stat-order-count').textContent = formatNumber(summary.orderCount);
    document.getElementById('stat-cups-sold').textContent = formatNumber(summary.totalCupsSold);

    document.getElementById('stat-cogs').textContent = formatMoney(summary.totalCogs);
    document.getElementById('stat-gross-profit').textContent = formatMoney(summary.grossProfit);
    document.getElementById('stat-operating').textContent = formatMoney(summary.totalOperatingExpenses);
    
    const netEl = document.getElementById('stat-net-profit');
    netEl.textContent = formatMoney(summary.netProfit);
    netEl.className = summary.netProfit < 0 ? 'text-2xl sm:text-3xl font-extrabold text-rose-600' : 'text-2xl sm:text-3xl font-extrabold text-emerald-600';
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
            <span class="font-bold text-slate-800">${item.name}</span>
            <p class="text-amber-700 font-semibold mt-0.5">Còn ${formatNumber(item.stock)} ${item.unit} (Ngưỡng: ${formatNumber(item.alert)})</p>
          </div>
          <button onclick="window.quickImportByName('${item.name}')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-xs">
            Nhập ngay
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
            <span class="font-bold text-slate-900">${p.name}</span>
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

// 2. MENU & COSTING
export async function loadCostingData() {
  try {
    const [products, ingredients] = await Promise.all([API.getProducts(), API.getIngredients()]);
    globalProducts = products;
    globalIngredients = ingredients;

    const container = document.getElementById('products-grid');
    if (!products.length) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <i data-lucide="coffee" class="w-10 h-10 mx-auto mb-2 text-slate-300"></i>
          <p class="font-medium text-slate-600">Menu chưa có món nước nào!</p>
          <p class="text-xs text-slate-400 mt-1">Bấm nút "Thêm Món Nước Mới" để thiết lập công thức định lượng.</p>
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

      return `
        <div class="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2 mb-3">
              <div class="flex items-center gap-2.5">
                <span class="text-2xl p-2 rounded-xl bg-slate-100">${p.image || '🥤'}</span>
                <div>
                  <h3 class="font-bold text-slate-900 text-base leading-tight">${p.name}</h3>
                  <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">${p.category}</span>
                </div>
              </div>
              <span class="text-xs px-2.5 py-1 rounded-full font-bold ${marginBadgeColor}">
                Lãi ${p.profitMargin}%
              </span>
            </div>

            <div class="bg-slate-50 rounded-xl p-3 space-y-2 text-xs my-3 border border-slate-100">
              <div class="flex justify-between">
                <span class="text-slate-500">Giá bán lẻ niêm yết:</span>
                <span class="font-bold text-slate-900 text-sm">${formatMoney(p.price)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500 flex items-center gap-1">
                  Giá thành 1 ly (COGS):
                  <i data-lucide="info" class="w-3 h-3 text-slate-400 cursor-pointer" onclick="window.viewCostBreakdown('${p._id}')"></i>
                </span>
                <span class="font-bold text-amber-700">${formatMoney(p.costPrice)}</span>
              </div>
              <div class="flex justify-between pt-1.5 border-t border-slate-200">
                <span class="font-bold text-emerald-800">Lãi gộp trên 1 ly:</span>
                <span class="font-extrabold text-emerald-600 text-sm">${formatMoney(p.grossProfit)}</span>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${maxCupsColor} mb-3">
              <span class="font-medium">Tồn kho pha được:</span>
              <span class="font-extrabold">${formatNumber(p.maxCupsPossible)} ly</span>
            </div>

            <div class="text-[11px] text-slate-500 line-clamp-2">
              <span class="font-semibold text-slate-700">Công thức (${(p.recipe || []).length} nguyên liệu):</span>
              ${(p.recipe || []).map(r => r.ingredient ? `${r.ingredient.name} (${r.quantity}${r.ingredient.unit})` : '').filter(Boolean).join(', ')}
            </div>
          </div>

          <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
            <button onclick="window.viewCostBreakdown('${p._id}')" class="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> Chi tiết giá thành
            </button>
            <div class="flex gap-2">
              <button onclick="window.openEditProductModal('${p._id}')" class="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Chỉnh sửa">
                <i data-lucide="edit-2" class="w-4 h-4"></i>
              </button>
              <button onclick="window.confirmDeleteProduct('${p._id}', '${p.name}')" class="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50" title="Xóa món">
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

window.viewCostBreakdown = async function(productId) {
  try {
    const p = await API.getProduct(productId);
    document.getElementById('breakdown-drink-name').textContent = `${p.image || '🥤'} ${p.name}`;
    document.getElementById('breakdown-drink-category').textContent = `Danh mục: ${p.category} | ${p.description || ''}`;

    const tbody = document.getElementById('breakdown-table-body');
    tbody.innerHTML = (p.recipeDetails || []).map(item => `
      <tr>
        <td class="py-2 px-2 font-medium text-slate-800">
          ${item.name}
          <span class="block text-[10px] text-slate-400">Tồn: ${formatNumber(item.currentStock)} ${item.unit}</span>
        </td>
        <td class="py-2 px-2 text-center font-semibold text-slate-700">${item.quantity} ${item.unit}</td>
        <td class="py-2 px-2 text-right text-slate-500">${formatMoney(item.costPerUnit)}/${item.unit}</td>
        <td class="py-2 px-2 text-right font-bold text-slate-900">${formatMoney(item.itemCost)}</td>
      </tr>
    `).join('');

    document.getElementById('breakdown-total-cost').textContent = formatMoney(p.costPrice);
    document.getElementById('breakdown-sale-price').textContent = formatMoney(p.price);
    document.getElementById('breakdown-profit').textContent = `${formatMoney(p.grossProfit)} (${p.profitMargin}%)`;

    window.openModal('modal-cost-breakdown');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

export function addRecipeRow(ingredientId = '', quantity = '') {
  const container = document.getElementById('recipe-rows-container');
  const rowId = 'recipe-row-' + Math.random().toString(36).substring(2, 9);
  const row = document.createElement('div');
  row.id = rowId;
  row.className = 'flex items-center gap-2 text-xs';

  let optionsHtml = '<option value="">-- Chọn nguyên liệu --</option>';
  globalIngredients.forEach(ing => {
    const selected = ing._id === ingredientId ? 'selected' : '';
    optionsHtml += `<option value="${ing._id}" data-cost="${ing.costPerUnit}" data-unit="${ing.unit}" ${selected}>${ing.name} (${formatMoney(ing.costPerUnit)}/${ing.unit})</option>`;
  });

  row.innerHTML = `
    <select class="recipe-ing-select flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white">
      ${optionsHtml}
    </select>
    <div class="flex items-center w-28">
      <input type="number" min="0.01" step="any" value="${quantity}" placeholder="Định lượng" class="recipe-qty-input w-full px-2 py-1.5 border border-slate-200 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-emerald-500">
      <span class="recipe-unit-display px-2 py-1.5 bg-slate-100 text-slate-500 rounded-r-lg border border-l-0 border-slate-200">đ/v</span>
    </div>
    <span class="recipe-row-cost font-bold text-slate-700 w-20 text-right">0 đ</span>
    <button type="button" class="btn-del-row p-1 text-slate-400 hover:text-rose-600 rounded">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(row);
  updateRecipeRowUnits(row);

  row.querySelector('.recipe-ing-select').addEventListener('change', () => {
    updateRecipeRowUnits(row);
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

function updateRecipeRowUnits(row) {
  const select = row.querySelector('.recipe-ing-select');
  const unitSpan = row.querySelector('.recipe-unit-display');
  const selectedOpt = select.options[select.selectedIndex];
  if (selectedOpt && selectedOpt.dataset.unit) {
    unitSpan.textContent = selectedOpt.dataset.unit;
  }
}

export function updateLiveCostCalculation() {
  const rows = document.querySelectorAll('#recipe-rows-container > div');
  let totalCost = 0;

  rows.forEach(row => {
    const select = row.querySelector('.recipe-ing-select');
    const qtyInput = row.querySelector('.recipe-qty-input');
    const costSpan = row.querySelector('.recipe-row-cost');
    const selectedOpt = select.options[select.selectedIndex];

    if (selectedOpt && selectedOpt.value) {
      const costPerUnit = Number(selectedOpt.dataset.cost) || 0;
      const qty = Number(qtyInput.value) || 0;
      const rowCost = Math.round(costPerUnit * qty);
      costSpan.textContent = formatMoney(rowCost);
      totalCost += rowCost;
    } else {
      costSpan.textContent = '0 đ';
    }
  });

  const salePrice = Number(document.getElementById('prod-price').value) || 0;
  const grossProfit = salePrice - totalCost;
  const margin = salePrice > 0 ? Math.round((grossProfit / salePrice) * 100) : 0;

  document.getElementById('preview-cost').textContent = formatMoney(totalCost);
  document.getElementById('preview-profit').textContent = formatMoney(grossProfit);
  document.getElementById('preview-margin').textContent = `${margin}%`;
}

window.openAddProductModal = async function() {
  if (!globalIngredients.length) globalIngredients = await API.getIngredients();

  document.getElementById('modal-product-title').textContent = 'Thêm Món Nước Mới & Công Thức';
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-price').value = '';
  document.getElementById('prod-image').value = '🥤';
  document.getElementById('prod-description').value = '';
  document.getElementById('recipe-rows-container').innerHTML = '';

  addRecipeRow();
  addRecipeRow();
  window.openModal('modal-product');
};

window.openEditProductModal = async function(productId) {
  const p = await API.getProduct(productId);
  if (!p) return;

  document.getElementById('modal-product-title').textContent = `Chỉnh Sửa Món: ${p.name}`;
  document.getElementById('prod-id').value = p._id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-image').value = p.image || '🥤';
  document.getElementById('prod-description').value = p.description || '';

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

// 3. INVENTORY
export async function loadInventoryData() {
  try {
    const ingredients = await API.getIngredients();
    globalIngredients = ingredients;

    let totalValue = 0;
    let lowStockCount = 0;

    const tbody = document.getElementById('ingredients-table-body');
    if (!ingredients.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">Chưa có nguyên liệu nào. Nhấn "Thêm Nguyên Liệu" để bắt đầu!</td></tr>`;
    } else {
      tbody.innerHTML = ingredients.map(ing => {
        totalValue += ing.totalInventoryValue || 0;
        if (ing.isLowStock) lowStockCount++;

        const statusBadge = ing.isLowStock
          ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 badge-low-stock">Cảnh báo: Sắp hết</span>`
          : `<span class="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Dồi dào</span>`;

        return `
          <tr class="hover:bg-slate-50/80 transition-colors">
            <td class="py-3 px-4 font-bold text-slate-900">${ing.name}</td>
            <td class="py-3 px-4 text-slate-600"><span class="px-2 py-0.5 rounded-md bg-slate-100 text-xs">${ing.category}</span></td>
            <td class="py-3 px-4 text-slate-600 font-semibold">${ing.unit}</td>
            <td class="py-3 px-4 text-right font-medium text-slate-700">${formatMoney(ing.costPerUnit)} / ${ing.unit}</td>
            <td class="py-3 px-4 text-center font-bold text-slate-900">${formatNumber(ing.stockQuantity)} <span class="text-xs text-slate-400 font-normal">/${formatNumber(ing.minStockAlert)}</span></td>
            <td class="py-3 px-4 text-right font-bold text-emerald-700">${formatMoney(ing.totalInventoryValue)}</td>
            <td class="py-3 px-4 text-center">${statusBadge}</td>
            <td class="py-3 px-4 text-center">
              <div class="flex items-center justify-center gap-1.5">
                <button onclick="window.openImportModal('${ing._id}', '${ing.name}', '${ing.unit}', ${ing.costPerUnit})" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">Nhập kho</button>
                <button onclick="window.openEditIngredientModal('${ing._id}')" class="p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100" title="Chỉnh sửa"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
                <button onclick="window.confirmDeleteIngredient('${ing._id}', '${ing.name}')" class="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50" title="Xóa"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    document.getElementById('inv-total-value').textContent = formatMoney(totalValue);
    document.getElementById('inv-total-items').textContent = ingredients.length;
    document.getElementById('inv-low-stock-count').textContent = lowStockCount;
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

window.openAddIngredientModal = function() {
  document.getElementById('modal-ingredient-title').textContent = 'Thêm Nguyên Liệu Mới';
  document.getElementById('ing-id').value = '';
  document.getElementById('ing-name').value = '';
  document.getElementById('ing-unit').value = '';
  document.getElementById('ing-cost').value = '';
  document.getElementById('ing-stock').value = '0';
  document.getElementById('ing-min-alert').value = '100';
  document.getElementById('ing-notes').value = '';
  window.openModal('modal-ingredient');
};

window.openEditIngredientModal = function(id) {
  const ing = globalIngredients.find(i => i._id === id);
  if (!ing) return;

  document.getElementById('modal-ingredient-title').textContent = `Chỉnh Sửa: ${ing.name}`;
  document.getElementById('ing-id').value = ing._id;
  document.getElementById('ing-name').value = ing.name;
  document.getElementById('ing-category').value = ing.category;
  document.getElementById('ing-unit').value = ing.unit;
  document.getElementById('ing-cost').value = ing.costPerUnit;
  document.getElementById('ing-stock').value = ing.stockQuantity;
  document.getElementById('ing-min-alert').value = ing.minStockAlert;
  document.getElementById('ing-notes').value = ing.notes || '';
  window.openModal('modal-ingredient');
};

window.openImportModal = function(id, name, unit, currentCost) {
  document.getElementById('import-ing-id').value = id;
  document.getElementById('import-stock-subtitle').textContent = `Nguyên liệu: ${name} (Đang có đơn giá chuẩn: ${formatMoney(currentCost)}/${unit})`;
  document.getElementById('import-unit-label').textContent = `(${unit})`;
  document.getElementById('import-unit-cost').value = currentCost;
  document.getElementById('import-qty').value = '';
  document.getElementById('import-total-cost').value = '';
  document.getElementById('import-notes').value = '';
  window.openModal('modal-import-stock');
};

window.quickImportByName = function(name) {
  const ing = globalIngredients.find(i => i.name === name);
  if (ing) window.openImportModal(ing._id, ing.name, ing.unit, ing.costPerUnit);
};

window.confirmDeleteIngredient = async function(id, name) {
  if (confirm(`Bạn có chắc muốn xóa nguyên liệu "${name}" không?`)) {
    try {
      await API.deleteIngredient(id);
      showToast('Đã xóa nguyên liệu thành công!');
      loadInventoryData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
};

// 4. POS
export async function loadPosData() {
  try {
    const products = await API.getProducts();
    globalProducts = products;

    const categories = ['Tất cả', ...new Set(products.map(p => p.category))];
    const catContainer = document.getElementById('pos-category-filters');
    catContainer.innerHTML = categories.map((c, i) => `
      <button class="pos-cat-btn ${i === 0 ? 'active bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap" data-category="${c}">
        ${c}
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
    const isOutOfStock = p.maxCupsPossible <= 0;
    return `
      <div onclick="${isOutOfStock ? `window.showToast('Món này đã hết nguyên liệu để pha chế!', 'warning')` : `window.addToCart('${p._id}')`}" class="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden ${isOutOfStock ? 'opacity-60 grayscale' : ''}">
        <div>
          <div class="flex items-start justify-between">
            <span class="text-3xl">${p.image || '🥤'}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isOutOfStock ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
              ${isOutOfStock ? 'Hết hàng' : `Còn ${p.maxCupsPossible} ly`}
            </span>
          </div>
          <h4 class="font-bold text-slate-900 text-sm mt-2 leading-tight">${p.name}</h4>
          <span class="text-[11px] text-slate-400">${p.category}</span>
        </div>
        <div class="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
          <span class="font-extrabold text-slate-900 text-sm">${formatMoney(p.price)}</span>
          <span class="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"><i data-lucide="plus" class="w-3.5 h-3.5"></i></span>
        </div>
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

window.addToCart = function(productId) {
  const product = globalProducts.find(p => p._id === productId);
  if (!product) return;

  const existingItem = globalCart.find(item => item.product._id === productId);
  if (existingItem) {
    if (existingItem.quantity >= product.maxCupsPossible) {
      showToast(`Tồn kho nguyên liệu chỉ đủ để pha tối đa ${product.maxCupsPossible} ly!`, 'warning');
      return;
    }
    existingItem.quantity++;
  } else {
    globalCart.push({ product, quantity: 1 });
  }

  updateCartUI();
};

window.updateCartItemQty = function(productId, delta) {
  const itemIndex = globalCart.findIndex(item => item.product._id === productId);
  if (itemIndex > -1) {
    const item = globalCart[itemIndex];
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      globalCart.splice(itemIndex, 1);
    } else {
      if (delta > 0 && newQty > item.product.maxCupsPossible) {
        showToast(`Tồn kho chỉ đủ pha tối đa ${item.product.maxCupsPossible} ly!`, 'warning');
        return;
      }
      item.quantity = newQty;
    }
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
        <p class="text-[11px] text-slate-400">Chọn món từ menu để thêm vào đơn</p>
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
    const subtotal = item.product.price * item.quantity;
    const subcost = (item.product.costPrice || 0) * item.quantity;
    totalQty += item.quantity;
    totalAmount += subtotal;
    totalCost += subcost;

    return `
      <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
        <div class="flex-1 pr-2">
          <h5 class="font-bold text-slate-900">${item.product.name}</h5>
          <span class="text-slate-500">${formatMoney(item.product.price)} x ${item.quantity} = </span>
          <span class="font-bold text-emerald-700">${formatMoney(subtotal)}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <button onclick="window.updateCartItemQty('${item.product._id}', -1)" class="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100">-</button>
          <span class="font-extrabold text-slate-900 px-1">${item.quantity}</span>
          <button onclick="window.updateCartItemQty('${item.product._id}', 1)" class="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 hover:bg-slate-100">+</button>
        </div>
      </div>
    `;
  }).join('');

  const grossProfit = totalAmount - totalCost;
  document.getElementById('pos-cart-total-qty').textContent = totalQty;
  document.getElementById('pos-cart-total-cost').textContent = formatMoney(totalCost);
  document.getElementById('pos-cart-estimated-profit').textContent = formatMoney(grossProfit);
  document.getElementById('pos-cart-total-amount').textContent = formatMoney(totalAmount);
  if (window.lucide) window.lucide.createIcons();
}

// 5. CASHFLOW
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
            <td class="py-3 px-4 font-semibold text-slate-800">${t.category}</td>
            <td class="py-3 px-4 text-slate-600 text-xs">${t.description || '-'}</td>
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

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) window.lucide.createIcons();

  // Navigation click listeners
  const tabNames = ['dashboard', 'costing', 'inventory', 'pos', 'cashflow'];
  tabNames.forEach(t => {
    const btn = document.getElementById(`nav-${t}`);
    const mBtn = document.getElementById(`m-nav-${t}`);
    if (btn) btn.addEventListener('click', () => switchTab(t));
    if (mBtn) mBtn.addEventListener('click', () => switchTab(t));
  });

  // Period buttons
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => loadDashboard(btn.dataset.period));
  });

  // Search inputs
  const ingSearch = document.getElementById('search-ingredient-input');
  if (ingSearch) {
    ingSearch.addEventListener('keyup', () => {
      const q = ingSearch.value.toLowerCase();
      document.querySelectorAll('#ingredients-table-body tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  const posSearch = document.getElementById('pos-search-input');
  if (posSearch) {
    posSearch.addEventListener('keyup', () => {
      const q = posSearch.value.toLowerCase();
      renderPosProductList(globalProducts.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
    });
  }

  // Buttons open modal
  document.getElementById('btn-open-add-product')?.addEventListener('click', window.openAddProductModal);
  document.getElementById('btn-open-add-ingredient')?.addEventListener('click', window.openAddIngredientModal);
  document.getElementById('btn-add-recipe-row')?.addEventListener('click', () => addRecipeRow());
  document.getElementById('prod-price')?.addEventListener('input', updateLiveCostCalculation);

  document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
    globalCart = [];
    updateCartUI();
  });

  document.getElementById('btn-submit-order')?.addEventListener('click', async () => {
    if (!globalCart.length) return showToast('Giỏ hàng trống!', 'warning');
    const paymentMethod = document.querySelector('input[name="pos-payment"]:checked').value;
    const items = globalCart.map(i => ({ productId: i.product._id, quantity: i.quantity }));
    try {
      const res = await API.createOrder({ items, paymentMethod });
      showToast('Tạo đơn thành công! Đã trừ tồn kho.');
      if (res.stockWarnings) res.stockWarnings.forEach(w => showToast(w, 'warning'));
      globalCart = [];
      updateCartUI();
      await loadPosData();
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // Forms
  document.getElementById('form-ingredient')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ing-id').value;
    const name = document.getElementById('ing-name').value.trim();
    const category = document.getElementById('ing-category').value;
    const unit = document.getElementById('ing-unit').value.trim();
    const costPerUnit = Number(document.getElementById('ing-cost').value);
    const stockQuantity = Number(document.getElementById('ing-stock').value);
    const minStockAlert = Number(document.getElementById('ing-min-alert').value);
    const notes = document.getElementById('ing-notes').value.trim();
    const payload = { name, category, unit, costPerUnit, stockQuantity, minStockAlert, notes };
    try {
      if (id) await API.updateIngredient(id, payload);
      else await API.createIngredient(payload);
      showToast('Lưu nguyên liệu thành công!');
      window.closeModal('modal-ingredient');
      loadInventoryData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('form-import-stock')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('import-ing-id').value;
    const quantity = Number(document.getElementById('import-qty').value);
    const costPerUnit = Number(document.getElementById('import-unit-cost').value);
    const totalCost = Number(document.getElementById('import-total-cost').value);
    const notes = document.getElementById('import-notes').value.trim();
    try {
      await API.importIngredient(id, { quantity, costPerUnit, totalCost, notes });
      showToast('Nhập kho thành công!');
      window.closeModal('modal-import-stock');
      loadInventoryData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('import-qty')?.addEventListener('input', () => {
    const q = Number(document.getElementById('import-qty').value) || 0;
    const c = Number(document.getElementById('import-unit-cost').value) || 0;
    if (q > 0 && c > 0) document.getElementById('import-total-cost').value = Math.round(q * c);
  });
  document.getElementById('import-unit-cost')?.addEventListener('input', () => {
    const q = Number(document.getElementById('import-qty').value) || 0;
    const c = Number(document.getElementById('import-unit-cost').value) || 0;
    if (q > 0 && c > 0) document.getElementById('import-total-cost').value = Math.round(q * c);
  });

  document.getElementById('form-product')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const price = Number(document.getElementById('prod-price').value);
    const image = document.getElementById('prod-image').value.trim();
    const description = document.getElementById('prod-description').value.trim();

    const recipe = [];
    document.querySelectorAll('#recipe-rows-container > div').forEach(row => {
      const ingId = row.querySelector('.recipe-ing-select').value;
      const qty = Number(row.querySelector('.recipe-qty-input').value);
      if (ingId && qty > 0) recipe.push({ ingredient: ingId, quantity: qty });
    });

    const payload = { name, category, price, image, description, recipe };
    try {
      if (id) await API.updateProduct(id, payload);
      else await API.createProduct(payload);
      showToast('Lưu món nước thành công!');
      window.closeModal('modal-product');
      loadCostingData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-open-add-transaction')?.addEventListener('click', () => {
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-desc').value = '';
    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    updateTxCategories();
    window.openModal('modal-transaction');
  });

  document.querySelectorAll('input[name="tx-type"]').forEach(r => {
    r.addEventListener('change', updateTxCategories);
  });

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
