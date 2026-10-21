/* InvoiceMD API wrapper */

const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:5000/api"
    : "https://invoice-md-backend.vercel.app/api";

const Api = {
  token: localStorage.getItem("invoicemd_token") || null,

  // =========================
  // TOKEN
  // =========================

  setToken(token) {
    this.token = token;

    if (token) {
      localStorage.setItem("invoicemd_token", token);
    } else {
      localStorage.removeItem("invoicemd_token");
    }
  },

  // =========================
  // COMMON REQUEST
  // =========================

  async request(path, { method = "GET", body, raw = false } = {}) {
    const headers = {
      "Content-Type": "application/json"
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(API_BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    // For PDF/file responses
    if (raw) {
      if (!res.ok) {
        throw new Error("Request failed");
      }

      return res;
    }

    let data = null;

    try {
      data = await res.json();
    } catch (_) {
      // Response was not JSON
    }

    if (!res.ok) {
      const message =
        (data && data.error) ||
        `Request failed (${res.status})`;

      throw new Error(message);
    }

    return data;
  },

  // =========================
  // AUTHENTICATION
  // =========================

  async login({ email, password }) {
    return this.request("/doctors/login", {
      method: "POST",
      body: {
        email,
        password
      }
    });
  },

  async register(payload) {
    return this.request("/doctors/register", {
      method: "POST",
      body: payload
    });
  },

  async me() {
    return this.request("/doctors/me");
  },

  async updateProfile(payload) {
    return this.request("/doctors/me", {
      method: "PUT",
      body: payload
    });
  },

  // =========================
  // HOSPITALS
  // =========================

  async hospitals() {
    return this.request("/hospitals");
  },

  async createHospital(payload) {
    return this.request("/hospitals", {
      method: "POST",
      body: payload
    });
  },

  async updateHospital(id, payload) {
    return this.request(`/hospitals/${id}`, {
      method: "PUT",
      body: payload
    });
  },

  // =========================
  // INVOICES
  // =========================

  async invoices() {
    return this.request("/invoices");
  },

  async createInvoice(payload) {
    return this.request("/invoices", {
      method: "POST",
      body: payload
    });
  },

  async setInvoiceStatus(id, payload) {
    return this.request(`/invoices/${id}/status`, {
      method: "PATCH",
      body: payload
    });
  },

  async deleteInvoice(id) {
    return this.request(`/invoices/${id}`, {
      method: "DELETE"
    });
  },

  // =========================
  // INVOICE PDF
  // =========================

  async downloadInvoicePdf(id, filename) {
    const res = await this.request(`/invoices/${id}/pdf`, {
      raw: true
    });

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

  // =========================
  // PRESCRIPTIONS
  // =========================

  async prescriptions() {
    return this.request("/prescriptions");
  },

  async createPrescription(payload) {
    return this.request("/prescriptions", {
      method: "POST",
      body: payload
    });
  },

  async updatePrescription(id, payload) {
    return this.request(`/prescriptions/${id}`, {
      method: "PUT",
      body: payload
    });
  },

  async deletePrescription(id) {
    return this.request(`/prescriptions/${id}`, {
      method: "DELETE"
    });
  },

  async recordPrescriptionPayment(id, payload) {
    return this.request(`/prescriptions/${id}/payment`, {
      method: "PATCH",
      body: payload
    });
  },

  async resetPrescriptionPayment(id) {
    return this.request(`/prescriptions/${id}/payment`, {
      method: "DELETE"
    });
  },

  // =========================
  // PRESCRIPTION PDF
  // =========================

  /*
   * Get prescription PDF as a File.
   *
   * This is used when sharing the actual PDF
   * through the device share menu / WhatsApp.
   */
  async getPrescriptionPdf(id, filename) {
    const res = await this.request(`/prescriptions/${id}/pdf`, {
      raw: true
    });

    const blob = await res.blob();

    return new File(
      [blob],
      filename || "prescription.pdf",
      {
        type: "application/pdf"
      }
    );
  },

  /*
   * Download prescription PDF normally.
   */
  async downloadPrescriptionPdf(id, filename) {
    const res = await this.request(`/prescriptions/${id}/pdf`, {
      raw: true
    });

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

