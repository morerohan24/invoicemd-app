/* Minimal fetch wrapper for the InvoiceMD backend API. */

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000/api"
    : "https://invoice-md-api.onrender.com/api";

const Api = {
  token: localStorage.getItem("invoicemd_token") || null,

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem("invoicemd_token", token);
    else localStorage.removeItem("invoicemd_token");
  },

  async request(path, { method = "GET", body, raw = false } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (raw) {
      if (!res.ok) throw new Error("Request failed");
      return res;
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {}

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }

    return data;
  },

  // ...keep the rest of your file exactly the same...
};
