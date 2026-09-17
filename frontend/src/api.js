// API Client layer for Vite frontend
const API_BASE = '/api';

export const API = {
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await res.json();
    } catch (e) {
      return { status: 'error', database: 'disconnected', error: e.message };
    }
  },

  async getIngredients() {
    const res = await fetch(`${API_BASE}/ingredients`);
    if (!res.ok) throw new Error((await res.json()).message || 'Lỗi tải nguyên liệu');
    return await res.json();
  },

  async createIngredient(data) {
    const res = await fetch(`${API_BASE}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi thêm nguyên liệu');
    return result;
  },

  async updateIngredient(id, data) {
    const res = await fetch(`${API_BASE}/ingredients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi sửa nguyên liệu');
    return result;
  },

  async importIngredient(id, data) {
    const res = await fetch(`${API_BASE}/ingredients/${id}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi nhập kho');
    return result;
  },

  async deleteIngredient(id) {
    const res = await fetch(`${API_BASE}/ingredients/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi xóa nguyên liệu');
    return result;
  },

  async getProducts() {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error((await res.json()).message || 'Lỗi tải menu');
    return await res.json();
  },

  async getProduct(id) {
    const res = await fetch(`${API_BASE}/products/${id}`);
    if (!res.ok) throw new Error((await res.json()).message || 'Lỗi tải món');
    return await res.json();
  },

  async createProduct(data) {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi thêm món');
    return result;
  },

  async updateProduct(id, data) {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi sửa món');
    return result;
  },

  async deleteProduct(id) {
    const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi xóa món');
    return result;
  },

  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/orders?${query}`);
    if (!res.ok) throw new Error((await res.json()).message || 'Lỗi tải đơn hàng');
    return await res.json();
  },

  async createOrder(data) {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi tạo đơn hàng');
    return result;
  },

  async getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/transactions?${query}`);
    if (!res.ok) throw new Error((await res.json()).message || 'Lỗi tải thu chi');
    return await res.json();
  },

  async createTransaction(data) {
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi tạo thu chi');
    return result;
  },

  async deleteTransaction(id) {
    const res = await fetch(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Lỗi xóa thu chi');
    return result;
  },

  async getDashboardReport(period = '30days') {
    const res = await fetch(`${API_BASE}/reports/dashboard?period=${period}`);
    if (!res.ok) throw new Error((await res.json()).message || 'Lỗi tải báo cáo');
    return await res.json();
  }
};
