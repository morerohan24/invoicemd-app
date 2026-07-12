/* Minimal fetch wrapper for the InvoiceMD backend API. */
const API_BASE = "/api";

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
    try { data = await res.json(); } catch (_) { /* no body */ }

    if (!res.ok) {
      const message = (data && data.error) || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  },

  register(payload) { return this.request("/doctors/register", { method: "POST", body: payload }); },
  login(payload) { return this.request("/doctors/login", { method: "POST", body: payload }); },
  me() { return this.request("/doctors/me"); },
  updateProfile(payload) { return this.request("/doctors/me", { method: "PUT", body: payload }); },

  hospitals() { return this.request("/hospitals"); },
  createHospital(payload) { return this.request("/hospitals", { method: "POST", body: payload }); },

  invoices() { return this.request("/invoices"); },
  invoice(id) { return this.request(`/invoices/${id}`); },
  createInvoice(payload) { return this.request("/invoices", { method: "POST", body: payload }); },
  setInvoiceStatus(id, payload) { return this.request(`/invoices/${id}/status`, { method: "PATCH", body: payload }); },
  deleteInvoice(id) { return this.request(`/invoices/${id}`, { method: "DELETE" }); },
  invoicePdfUrl(id) { return `${API_BASE}/invoices/${id}/pdf`; },

  prescriptions() { return this.request("/prescriptions"); },
  prescription(id) { return this.request(`/prescriptions/${id}`); },
  createPrescription(payload) { return this.request("/prescriptions", { method: "POST", body: payload }); },
  recordPrescriptionPayment(id, payload) { return this.request(`/prescriptions/${id}/payment`, { method: "PATCH", body: payload }); },
  resetPrescriptionPayment(id) { return this.request(`/prescriptions/${id}/payment/reset`, { method: "PATCH" }); },
  deletePrescription(id) { return this.request(`/prescriptions/${id}`, { method: "DELETE" }); },

  async downloadInvoicePdf(id, filename) {
    const res = await this.request(`/invoices/${id}/pdf`, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "invoice.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async downloadPrescriptionPdf(id, filename) {
    const res = await this.request(`/prescriptions/${id}/pdf`, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "prescription.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};
