/* Each function returns an HTML string for a screen. app.js swaps #app content. */

function fmtMoney(n) {
  return `INR ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function stampClass(status) {
  return {
    Submitted: "stamp-submitted",
    Approved: "stamp-approved",
    Accounts: "stamp-accounts",
    Paid: "stamp-paid",
    Rejected: "stamp-rejected"
  }[status] || "stamp-submitted";
}

function initials(name) {
  if (!name) return "Dr";
  return name.replace(/^Dr\.?\s*/i, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "Dr";
}

function paymentBadge(payment) {
  if (!payment || payment.status !== "paid") {
    return `<span class="pay-badge pay-pending">${Icon.clock} Pending</span>`;
  }
  if (payment.mode === "Cash") {
    return `<span class="pay-badge pay-cash">${Icon.cash} Cash</span>`;
  }
  return `<span class="pay-badge pay-gpay">${Icon.qr} GPay${payment.reference ? ` · ${payment.reference}` : ""}</span>`;
}

const REMINDER_AFTER_DAYS = 14;
const OPEN_STATUSES = ["Submitted", "Approved", "Accounts"];

function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function isOverdue(inv) {
  return OPEN_STATUSES.includes(inv.status) && daysSince(inv.createdAt) >= REMINDER_AFTER_DAYS;
}

function whatsappLink(inv, kind) {
  const days = daysSince(inv.createdAt);
  const message = kind === "reminder"
    ? `Hi, following up on invoice ${inv.invoiceNumber} for ${inv.hospitalName} (${inv.month}), submitted ${days} days ago and still pending. Total: ${fmtMoney(inv.total)}. Could you please share a status update? Thank you.`
    : `Hi, sharing invoice ${inv.invoiceNumber} for ${inv.hospitalName} — ${inv.month}. Total: ${fmtMoney(inv.total)}. Please find the PDF attached.`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function prescriptionWhatsappLink(p) {
  const medList = p.medicines.map((m) => `- ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.frequency ? `, ${m.frequency}` : ""}`).join("\n");
  const message = `Prescription ${p.prescriptionNumber} for ${p.patientName} — ${new Date(p.date).toLocaleDateString("en-IN")}\n\n${medList}${p.advice ? `\n\nAdvice: ${p.advice}` : ""}${p.followUpDate ? `\nFollow-up: ${new Date(p.followUpDate).toLocaleDateString("en-IN")}` : ""}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/* ---------------- Auth views ---------------- */

function viewLogin(s) {
  return `
  <div class="auth-shell">
    <div class="auth-card">
      <div class="brand"><span class="mark">Md</span><h1>InvoiceMD</h1></div>
      <p class="tagline">Invoices hospitals accept, the first time.</p>
      ${s.error ? `<div class="error-banner">${s.error}</div>` : ""}
      <form id="login-form">
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" required placeholder="dr.sharma@example.com" />
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" name="password" required placeholder="••••••••" />
        </div>
        <button class="btn btn-primary btn-block" type="submit" ${s.loading ? "disabled" : ""}>
          ${s.loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p class="switch-line">New here? <button id="go-register">Create a free account</button></p>
    </div>
  </div>`;
}

function viewRegister(s) {
  return `
  <div class="auth-shell">
    <div class="auth-card" style="max-width:460px;">
      <div class="brand"><span class="mark">Md</span><h1>InvoiceMD</h1></div>
      <p class="tagline">Set up your profile once. Bill any hospital in seconds.</p>
      ${s.error ? `<div class="error-banner">${s.error}</div>` : ""}
      <form id="register-form">
        <div class="field-row">
          <div class="field"><label>Full name</label><input name="name" required placeholder="Dr. Anjali Sharma" /></div>
          <div class="field"><label>Qualification</label><input name="qualification" placeholder="MBBS, MD" /></div>
        </div>
        <div class="field"><label>Email</label><input type="email" name="email" required placeholder="you@example.com" /></div>
        <div class="field"><label>Password</label><input type="password" name="password" required minlength="6" placeholder="At least 6 characters" /></div>
        <div class="field-row">
          <div class="field"><label>Medical registration no.</label><input name="registrationNo" placeholder="MH-12345" /></div>
          <div class="field"><label>PAN</label><input name="pan" placeholder="ABCDE1234F" /></div>
        </div>
        <button class="btn btn-primary btn-block" type="submit" ${s.loading ? "disabled" : ""}>
          ${s.loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p class="switch-line">Already have an account? <button id="go-login">Sign in</button></p>
    </div>
  </div>`;
}

/* ---------------- App shell ---------------- */

function navItem(id, label, iconKey, active, badge) {
  return `<button class="nav-item ${active ? "active" : ""}" data-nav="${id}">
    ${Icon[iconKey]}<span>${label}</span>
    ${badge ? `<span class="badge-count">${badge}</span>` : ""}
  </button>`;
}

function appShell(s, content) {
  const v = s.view;
  const overdueCount = s.invoices.filter(isOverdue).length;
  const pendingRxCount = s.prescriptions.filter((p) => p.payment.status === "pending").length;

  return `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand"><span class="mark">Md</span><h1>InvoiceMD</h1></div>
      ${navItem("dashboard", "Dashboard", "dashboard", v === "dashboard")}
      ${navItem("new-invoice", "New Invoice", "invoice", v === "new-invoice")}
      ${navItem("invoices", "Invoice History", "history", v === "invoices", overdueCount || null)}
      <div class="nav-section-label">Patients</div>
      ${navItem("new-prescription", "New Prescription", "pill", v === "new-prescription")}
      ${navItem("prescriptions", "Prescriptions", "history", v === "prescriptions", pendingRxCount || null)}
      <div class="nav-section-label">Account</div>
      ${navItem("profile", "Profile", "profile", v === "profile")}
      <div class="sidebar-footer">
        <div class="profile-chip">
          <span class="avatar-circle">${initials(s.doctor && s.doctor.name)}</span>
          <span>
            <span class="doc-name">${s.doctor ? s.doctor.name : ""}</span>
            <span class="doc-email">${s.doctor ? s.doctor.email : ""}</span>
          </span>
          <button class="icon-btn" id="logout-btn" title="Sign out">${Icon.logout}</button>
        </div>
      </div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div class="topbar-search">
          ${Icon.search}
          <input id="topbar-search" placeholder="Search invoices or hospitals…" value="${s.searchQuery || ""}" />
        </div>
        <div class="topbar-right">
          <button class="icon-btn" title="${overdueCount ? overdueCount + " invoice(s) awaiting follow-up" : "No reminders"}" data-nav="invoices" style="position:relative;">
            ${Icon.bell}
            ${overdueCount ? `<span class="badge-count" style="position:absolute;top:2px;right:2px;">${overdueCount}</span>` : ""}
          </button>
          <button class="btn btn-soft" data-nav="new-prescription">${Icon.pill} New Prescription</button>
          <button class="btn btn-primary" data-nav="new-invoice">${Icon.plus} New Invoice</button>
        </div>
      </div>
      ${content}
    </main>
  </div>
  ${s.toast ? `<div class="toast ${s.toast.isError ? "error" : ""}">${s.toast.message}</div>` : ""}
  ${s.paymentModal ? paymentModalView(s) : ""}
  `;
}

/* ---------------- Dashboard ---------------- */

function statusCounts(invoices) {
  const counts = { Submitted: 0, Approved: 0, Accounts: 0, Paid: 0, Rejected: 0 };
  invoices.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
  return counts;
}

function donutChart(counts) {
  const palette = {
    Submitted: "#2E90E5",
    Approved: "#F59E0B",
    Accounts: "#4F46E5",
    Paid: "#16A34A",
    Rejected: "#EF4444"
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  let gradient = "";
  let cursor = 0;

  if (total === 0) {
    gradient = "#EAEBF3 0deg 360deg";
  } else {
    const parts = [];
    Object.keys(palette).forEach((key) => {
      const count = counts[key] || 0;
      if (count === 0) return;
      const startDeg = (cursor / total) * 360;
      cursor += count;
      const endDeg = (cursor / total) * 360;
      parts.push(`${palette[key]} ${startDeg}deg ${endDeg}deg`);
    });
    gradient = parts.join(", ");
  }

  const legend = Object.keys(palette).map((key) => `
    <li><span class="swatch" style="background:${palette[key]}"></span>${key}<span class="count">${counts[key] || 0}</span></li>
  `).join("");

  return `
    <div class="donut-wrap">
      <div style="width:128px;height:128px;border-radius:50%;background:conic-gradient(${gradient});flex:none;display:flex;align-items:center;justify-content:center;">
        <div style="width:78px;height:78px;border-radius:50%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <strong style="font-size:1.2rem;">${total}</strong>
          <span class="small muted" style="font-size:0.65rem;">invoices</span>
        </div>
      </div>
      <ul class="donut-legend">${legend}</ul>
    </div>`;
}

function viewDashboard(s) {
  const invoices = s.invoices;
  const prescriptions = s.prescriptions;
  const total = invoices.reduce((sum, i) => sum + i.total, 0);
  const paid = invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + i.total, 0);
  const pending = invoices.filter((i) => i.status !== "Paid" && i.status !== "Rejected").length;
  const rejected = invoices.filter((i) => i.status === "Rejected").length;
  const overdue = invoices.filter(isOverdue);

  const cashCollected = invoices.filter((i) => i.payment && i.payment.mode === "Cash").reduce((s2, i) => s2 + i.total, 0)
    + prescriptions.filter((p) => p.payment.mode === "Cash").reduce((s2, p) => s2 + p.consultationFee, 0);
  const gpayCollected = invoices.filter((i) => i.payment && i.payment.mode === "GPay").reduce((s2, i) => s2 + i.total, 0)
    + prescriptions.filter((p) => p.payment.mode === "GPay").reduce((s2, p) => s2 + p.consultationFee, 0);
  const pendingRxPayments = prescriptions.filter((p) => p.payment.status === "pending");

  const recent = invoices.slice(0, 6);
  const rows = recent.length ? recent.map((inv) => `
      <tr>
        <td><strong>${inv.invoiceNumber}</strong></td>
        <td>${inv.hospitalName}</td>
        <td>${inv.month}</td>
        <td>${fmtMoney(inv.total)}</td>
        <td><span class="stamp ${stampClass(inv.status)}">${inv.status}</span></td>
        <td><button class="btn btn-ghost btn-sm" data-view-invoice="${inv.id}">${Icon.eye} View</button></td>
      </tr>`).join("") : `<tr><td colspan="6" class="muted small" style="text-align:center;padding:24px;">No invoices yet.</td></tr>`;

  const reminderRows = overdue.length ? overdue.map((inv) => `
    <tr>
      <td><strong>${inv.invoiceNumber}</strong><div class="small muted">${inv.hospitalName}</div></td>
      <td>${fmtMoney(inv.total)}</td>
      <td><span class="reminder-chip">${Icon.alert} ${daysSince(inv.createdAt)} days</span></td>
      <td>
        <a class="btn btn-whatsapp btn-sm" href="${whatsappLink(inv, "reminder")}" target="_blank" rel="noopener">${Icon.whatsapp} Send Reminder</a>
      </td>
    </tr>`).join("") : "";

  return appShell(s, `
    <div class="page-header">
      <div>
        <span class="eyebrow">Overview</span>
        <h2>Welcome back, ${s.doctor ? s.doctor.name.split(" ")[0] : ""}</h2>
        <p>Here's how your billing and prescriptions are tracking.</p>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-top"><div class="stat-icon violet">${Icon.wallet}</div><span class="stat-delta flat">All time</span></div>
        <div><div class="value">${fmtMoney(total)}</div><div class="label">Total Invoiced</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><div class="stat-icon green">${Icon.check}</div><span class="stat-delta up">Collected</span></div>
        <div><div class="value">${fmtMoney(paid)}</div><div class="label">Total Paid</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><div class="stat-icon amber">${Icon.clock}</div><span class="stat-delta flat">In progress</span></div>
        <div><div class="value">${pending}</div><div class="label">Awaiting Payment</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><div class="stat-icon red">${Icon.alert}</div><span class="stat-delta flat">Needs action</span></div>
        <div><div class="value">${rejected}</div><div class="label">Rejected</div></div>
      </div>
    </div>

    <div class="dashboard-grid" style="margin-bottom:18px;">
      <div class="card">
        <div class="card-head"><div><h3>Payments collected</h3><p>Across invoices and prescriptions</p></div></div>
        <div class="pay-collect-row">
          <div class="pay-collect-item">
            <span class="pay-badge pay-cash">${Icon.cash} Cash</span>
            <div class="value" style="margin-top:8px;">${fmtMoney(cashCollected)}</div>
          </div>
          <div class="pay-collect-item">
            <span class="pay-badge pay-gpay">${Icon.qr} GPay</span>
            <div class="value" style="margin-top:8px;">${fmtMoney(gpayCollected)}</div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Prescriptions</h3><p>${prescriptions.length} written · ${pendingRxPayments.length} fee(s) pending</p></div></div>
        ${prescriptions.length === 0 ? `
          <div class="empty-state" style="padding:24px 10px;">
            <p>No prescriptions yet.</p>
            <button class="btn btn-soft btn-sm" data-nav="new-prescription" style="margin-top:10px;">${Icon.pill} Write one</button>
          </div>
        ` : `
          <table class="ledger">
            <thead><tr><th>Patient</th><th>Date</th><th>Fee</th><th>Payment</th></tr></thead>
            <tbody>
              ${prescriptions.slice(0, 5).map((p) => `
                <tr>
                  <td><strong>${p.patientName}</strong><div class="small muted">${p.prescriptionNumber}</div></td>
                  <td>${new Date(p.date).toLocaleDateString("en-IN")}</td>
                  <td>${fmtMoney(p.consultationFee)}</td>
                  <td>${paymentBadge(p.payment)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        `}
      </div>
    </div>

    ${overdue.length ? `
      <div class="card" style="border-color:#F3B4B0;background:linear-gradient(180deg,#FFF8F8,var(--surface) 40%);">
        <div class="card-head">
          <div><h3>Payment reminders</h3><p>${overdue.length} invoice(s) pending ${REMINDER_AFTER_DAYS}+ days — a nudge usually helps.</p></div>
        </div>
        <table class="ledger">
          <thead><tr><th>Invoice</th><th>Amount</th><th>Pending</th><th></th></tr></thead>
          <tbody>${reminderRows}</tbody>
        </table>
      </div>
    ` : ""}

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-head"><div><h3>Status breakdown</h3><p>Across all invoices</p></div></div>
        ${donutChart(statusCounts(invoices))}
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Recent invoices</h3><p>Latest 6 submissions</p></div></div>
        <table class="ledger">
          <thead><tr><th>Invoice</th><th>Hospital</th><th>Month</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    ${s.viewingInvoiceId ? viewInvoiceModal(s) : ""}
  `);
}

/* ---------------- New invoice ---------------- */

function fieldInput(field, value) {
  return `
    <div class="field">
      <label>${field.label}${field.type === "number" ? ` <span class="muted" style="text-transform:none;font-weight:500;">(₹${field.rate || 0}/unit)</span>` : ""}</label>
      <input type="number" min="0" step="0.01" data-field-key="${field.key}"
             value="${value !== undefined ? value : ""}" placeholder="0" />
    </div>`;
}

function computeLineItems(hospital, formValues) {
  if (!hospital) return [];
  const items = [];
  for (const field of hospital.requiredFields) {
    const raw = formValues[field.key];
    if (raw === undefined || raw === "" || raw === null) continue;
    const num = Number(raw);
    if (!(num > 0)) continue;
    if (field.type === "amount") {
      items.push({ label: field.label, amount: num });
    } else {
      items.push({ label: `${field.label} (${num} × ₹${field.rate || 0})`, amount: num * (field.rate || 0) });
    }
  }
  return items;
}

function viewNewInvoice(s) {
  const hospital = s.hospitals.find((h) => h.id === s.selectedHospitalId) || null;
  const lineItems = computeLineItems(hospital, s.formValues);
  const total = lineItems.reduce((sum, i) => sum + i.amount, 0);

  const warnings = [];
  if (hospital) {
    if (hospital.requiresSignature && !s.doctor.signature) warnings.push("This hospital requires your digital signature — add one in Profile.");
    if (hospital.requiresGST && !s.doctor.gst) warnings.push("This hospital requires a GSTIN — add one in Profile.");
    if (!s.doctor.pan) warnings.push("PAN is missing from your profile — most hospitals require it.");
  }

  const hospitalTiles = s.hospitals.map((h) => `
    <div class="hospital-tile ${h.id === s.selectedHospitalId ? "selected" : ""}" data-select-hospital="${h.id}">
      ${h.name}
      <span class="req">${h.requiresSignature ? "Signature · " : ""}${h.requiresGST ? "GST · " : ""}${h.requiredFields.length} fields</span>
    </div>`).join("")
    + `<div class="hospital-tile hospital-tile-add" id="add-hospital-tile">${Icon.plus} Add hospital<span class="req">Just type the name — no setup needed</span></div>`;

  const addHospitalForm = s.showAddHospitalForm ? `
    <form id="add-hospital-form" class="card" style="margin-top:14px;background:var(--surface-muted);box-shadow:none;">
      <h3 style="font-size:0.95rem;margin-bottom:14px;">Add a hospital</h3>
      <div class="field">
        <label>Hospital name</label>
        <input name="name" required placeholder="e.g. City Care Hospital" autofocus />
      </div>
      <div class="field">
        <label>Description <span class="muted" style="text-transform:none;font-weight:500;">(optional)</span></label>
        <textarea name="description" placeholder="Any notes about their requirements — optional"></textarea>
      </div>
      <p class="small muted" style="margin:-4px 0 14px;">We'll set up a standard set of billable fields (OPD visits, on-call, procedure &amp; professional fees). You can adjust amounts per invoice.</p>
      <div class="actions-row" style="margin-top:0;">
        <button class="btn btn-primary btn-sm" type="submit">Add hospital</button>
        <button class="btn btn-ghost btn-sm" type="button" id="cancel-add-hospital">Cancel</button>
      </div>
    </form>` : "";

  const formFields = hospital ? hospital.requiredFields.map((f) => fieldInput(f, s.formValues[f.key])).join("") : "";

  const previewRows = lineItems.length ? lineItems.map((i) => `
      <tr><td>${i.label}</td><td>${fmtMoney(i.amount)}</td></tr>`).join("")
    : `<tr><td colspan="2" class="muted small" style="text-align:center;padding:14px 0;">Fill in the form to see the invoice preview.</td></tr>`;

  return appShell(s, `
    <div class="page-header">
      <div><span class="eyebrow">Billing</span><h2>New Invoice</h2><p>Pick a hospital, fill in the numbers, and download a PDF that matches their format.</p></div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-head"><div><h3>1. Select hospital</h3></div></div>
      <div class="hospital-picker">${hospitalTiles}</div>
      ${hospital && hospital.notes ? `<p class="small muted" style="margin-top:12px;">ℹ️ ${hospital.notes}</p>` : ""}
      ${addHospitalForm}
    </div>

    <div class="invoice-builder">
      <div class="card">
        <div class="card-head"><div><h3>2. Billing details</h3></div></div>
        ${hospital ? `
          <div class="field">
            <label>Billing month</label>
            <input id="invoice-month" value="${s.invoiceMonth}" />
          </div>
          <div id="dynamic-fields">${formFields}</div>
          <div class="field">
            <label>Description <span class="muted" style="text-transform:none;font-weight:500;">(optional)</span></label>
            <textarea id="invoice-description" placeholder="Any extra context for the accounts team — optional">${s.invoiceDescription || ""}</textarea>
          </div>
        ` : `<p class="muted small">Select a hospital above to load its invoice fields.</p>`}
      </div>

      <div class="sheet">
        ${hospital ? `
          <div class="sheet-head">
            <div><h3>${s.doctor.name}</h3><div class="small muted">${s.doctor.qualification || ""}</div></div>
            <div class="sheet-meta">Bill To<br /><strong style="color:var(--ink)">${hospital.name}</strong></div>
          </div>
          <div class="sheet-block"><span class="k">Billing month</span><div>${s.invoiceMonth}</div></div>
          ${s.invoiceDescription ? `<div class="sheet-block"><span class="k">Description</span><div>${s.invoiceDescription}</div></div>` : ""}
          ${warnings.length ? `<ul class="warning-list">${warnings.map((w) => `<li>${Icon.alert} ${w}</li>`).join("")}</ul>` : ""}
          <table class="sheet-table">${previewRows}</table>
          <div class="sheet-total"><span>Total</span><span>${fmtMoney(total)}</span></div>
          <div class="actions-row">
            <button class="btn btn-primary" id="submit-invoice" ${lineItems.length ? "" : "disabled"}>${Icon.check} Generate Invoice</button>
          </div>
        ` : `<div class="sheet-empty">Your invoice preview will appear here — fill the left side and watch this update.</div>`}
      </div>
    </div>
  `);
}

/* ---------------- Invoice history ---------------- */

const STATUS_FLOW = ["Submitted", "Approved", "Accounts", "Paid"];
const ALL_STATUSES = ["Submitted", "Approved", "Accounts", "Paid", "Rejected"];

function viewInvoices(s) {
  const q = (s.searchQuery || "").trim().toLowerCase();
  const filtered = s.invoices.filter((inv) => {
    const matchesQuery = !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.hospitalName.toLowerCase().includes(q) ||
      inv.month.toLowerCase().includes(q);
    const matchesStatus = s.statusFilter === "all" || inv.status === s.statusFilter;
    return matchesQuery && matchesStatus;
  });

  const rows = filtered.length ? filtered.map((inv) => `
    <tr>
      <td><strong>${inv.invoiceNumber}</strong><div class="small muted">${new Date(inv.createdAt).toLocaleDateString("en-IN")}</div></td>
      <td>${inv.hospitalName}</td>
      <td>${inv.month}</td>
      <td>${fmtMoney(inv.total)}</td>
      <td>
        <span class="stamp ${stampClass(inv.status)}">${inv.status}</span>
        ${inv.status === "Paid" ? `<div style="margin-top:4px;">${paymentBadge(inv.payment)}</div>` : ""}
        ${inv.status === "Rejected" && inv.rejectionReason ? `<div class="small muted" style="margin-top:4px;">${inv.rejectionReason}</div>` : ""}
        ${isOverdue(inv) ? `<div><span class="reminder-chip">${Icon.alert} ${daysSince(inv.createdAt)}d pending</span></div>` : ""}
      </td>
      <td>
        <select class="status-select" data-status-for="${inv.id}">
          ${STATUS_FLOW.map((st) => `<option value="${st}" ${inv.status === st ? "selected" : ""}>${st}</option>`).join("")}
          <option value="Rejected" ${inv.status === "Rejected" ? "selected" : ""}>Rejected</option>
        </select>
      </td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-sm" data-view-invoice="${inv.id}" title="View">${Icon.eye}</button>
        <a class="btn btn-whatsapp btn-sm" href="${whatsappLink(inv, isOverdue(inv) ? "reminder" : "share")}" target="_blank" rel="noopener" title="Share on WhatsApp">${Icon.whatsapp}</a>
        <button class="btn btn-ghost btn-sm" data-download="${inv.id}" data-filename="${inv.invoiceNumber}.pdf" title="Download PDF">${Icon.download}</button>
        <button class="btn btn-danger btn-sm" data-delete-invoice="${inv.id}" data-invoice-number="${inv.invoiceNumber}" title="Delete">${Icon.trash}</button>
      </td>
    </tr>`).join("") : "";

  return appShell(s, `
    <div class="page-header">
      <div><span class="eyebrow">Billing</span><h2>Invoice History</h2><p>Track every invoice from submission to payment.</p></div>
      <button class="btn btn-primary" data-nav="new-invoice">${Icon.plus} New Invoice</button>
    </div>
    ${s.invoices.length ? `
      <div class="card">
        <div class="table-toolbar">
          <div class="table-search">
            ${Icon.search}
            <input id="invoice-search" placeholder="Search by invoice, hospital, or month…" value="${s.searchQuery || ""}" />
          </div>
          <select class="filter-select" id="status-filter">
            <option value="all" ${s.statusFilter === "all" ? "selected" : ""}>All statuses</option>
            ${ALL_STATUSES.map((st) => `<option value="${st}" ${s.statusFilter === st ? "selected" : ""}>${st}</option>`).join("")}
          </select>
        </div>
        ${filtered.length ? `
          <table class="ledger">
            <thead><tr><th>Invoice</th><th>Hospital</th><th>Month</th><th>Amount</th><th>Status</th><th>Update</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : `<div class="empty-state"><h3>No matches</h3><p>Try a different search term or status filter.</p></div>`}
      </div>
    ` : `
      <div class="empty-state">
        <h3>No invoices yet</h3>
        <p>Once you generate your first invoice, it'll show up here with full payment tracking.</p>
        <button class="btn btn-primary" data-nav="new-invoice" style="margin-top:14px;">Create your first invoice</button>
      </div>
    `}
    ${s.viewingInvoiceId ? viewInvoiceModal(s) : ""}
  `);
}

function viewInvoiceModal(s) {
  const inv = s.invoices.find((i) => i.id === s.viewingInvoiceId);
  if (!inv) return "";

  const rows = inv.lineItems.map((li) => `
    <tr><td>${li.label}</td><td>${fmtMoney(li.amount)}</td></tr>`).join("");

  const history = inv.statusHistory && inv.statusHistory.length
    ? inv.statusHistory.map((h) => `
        <li><span class="stamp ${stampClass(h.status)}">${h.status}</span>
          <span class="small muted">${new Date(h.at).toLocaleString("en-IN")}</span></li>`).join("")
    : "";

  return `
  <div class="modal-backdrop" id="invoice-modal-backdrop">
    <div class="modal">
      <div class="modal-head">
        <h3>${inv.invoiceNumber}</h3>
        <button class="modal-close" id="close-invoice-modal" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="sheet-block"><span class="k">Hospital</span><div>${inv.hospitalName}</div></div>
        <div class="sheet-block"><span class="k">Billing month</span><div>${inv.month}</div></div>
        ${inv.description ? `<div class="sheet-block"><span class="k">Description</span><div>${inv.description}</div></div>` : ""}
        <table class="sheet-table">${rows}</table>
        <div class="sheet-total"><span>Total</span><span>${fmtMoney(inv.total)}</span></div>
        ${inv.status === "Paid" ? `<div class="sheet-block" style="margin-top:14px;"><span class="k">Payment</span><div>${paymentBadge(inv.payment)}</div></div>` : ""}
        ${inv.status === "Rejected" && inv.rejectionReason ? `<div class="info-banner" style="margin-top:14px;">Rejected: ${inv.rejectionReason}</div>` : ""}
        ${isOverdue(inv) ? `<div class="info-banner" style="margin-top:14px;">Pending ${daysSince(inv.createdAt)} days — consider sending a reminder.</div>` : ""}
        <div class="field" style="margin-top:20px;">
          <label>Status history</label>
          <ul class="history-list">${history}</ul>
        </div>
      </div>
      <div class="modal-footer">
        <a class="btn btn-whatsapp btn-sm" href="${whatsappLink(inv, isOverdue(inv) ? "reminder" : "share")}" target="_blank" rel="noopener">${Icon.whatsapp} WhatsApp</a>
        <button class="btn btn-ghost btn-sm" data-download="${inv.id}" data-filename="${inv.invoiceNumber}.pdf">${Icon.download} Download PDF</button>
        <button class="btn btn-primary btn-sm" id="close-invoice-modal-secondary">Close</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- New prescription ---------------- */

function medicineRow(med, idx) {
  return `
    <div class="med-row">
      <input placeholder="Medicine name" data-med-field="name" data-med-idx="${idx}" value="${med.name || ""}" />
      <input placeholder="Dosage (e.g. 500mg)" data-med-field="dosage" data-med-idx="${idx}" value="${med.dosage || ""}" />
      <input placeholder="Frequency (1-0-1)" data-med-field="frequency" data-med-idx="${idx}" value="${med.frequency || ""}" />
      <input placeholder="Duration (5 days)" data-med-field="duration" data-med-idx="${idx}" value="${med.duration || ""}" />
      <input placeholder="Instructions (after food)" data-med-field="instructions" data-med-idx="${idx}" value="${med.instructions || ""}" />
      <button type="button" class="icon-btn" data-remove-medicine="${idx}" title="Remove">${Icon.trash}</button>
    </div>`;
}

function viewNewPrescription(s) {
  const p = s.rxPatient;
  const medRows = s.rxMedicines.map((m, i) => medicineRow(m, i)).join("");
  const previewMeds = s.rxMedicines.filter((m) => m.name && m.name.trim());

  return appShell(s, `
    <div class="page-header">
      <div><span class="eyebrow">Patients</span><h2>New Prescription</h2><p>Write a prescription and record how the consultation fee was paid.</p></div>
    </div>

    <form id="prescription-form">
      <div class="invoice-builder">
        <div>
          <div class="card" style="margin-bottom:18px;">
            <div class="card-head"><div><h3>1. Patient details</h3></div></div>
            <div class="field-row">
              <div class="field"><label>Patient name</label><input data-patient-field="patientName" value="${p.patientName}" required placeholder="Patient's full name" /></div>
              <div class="field"><label>Age</label><input data-patient-field="patientAge" value="${p.patientAge}" placeholder="e.g. 34" /></div>
            </div>
            <div class="field-row">
              <div class="field">
                <label>Gender</label>
                <select data-patient-field="patientGender">
                  <option value="" ${!p.patientGender ? "selected" : ""}>Not specified</option>
                  <option value="Male" ${p.patientGender === "Male" ? "selected" : ""}>Male</option>
                  <option value="Female" ${p.patientGender === "Female" ? "selected" : ""}>Female</option>
                  <option value="Other" ${p.patientGender === "Other" ? "selected" : ""}>Other</option>
                </select>
              </div>
              <div class="field"><label>Phone <span class="muted" style="text-transform:none;font-weight:500;">(optional)</span></label><input data-patient-field="patientPhone" value="${p.patientPhone}" placeholder="10-digit mobile" /></div>
            </div>
            <div class="field"><label>Visit date</label><input type="date" id="rx-date" value="${s.rxDate}" /></div>
            <div class="field"><label>Diagnosis / notes <span class="muted" style="text-transform:none;font-weight:500;">(optional)</span></label><textarea id="rx-diagnosis" placeholder="e.g. Viral fever with mild dehydration">${s.rxDiagnosis}</textarea></div>
          </div>

          <div class="card" style="margin-bottom:18px;">
            <div class="card-head"><div><h3>2. Medicines</h3></div></div>
            <div class="med-row med-row-head">
              <span>Medicine</span><span>Dosage</span><span>Frequency</span><span>Duration</span><span>Instructions</span><span></span>
            </div>
            <div id="medicine-rows">${medRows}</div>
            <button type="button" class="btn btn-outline btn-sm" id="add-medicine-row" style="margin-top:10px;">${Icon.plus} Add medicine</button>
          </div>

          <div class="card">
            <div class="card-head"><div><h3>3. Advice &amp; follow-up</h3></div></div>
            <div class="field"><label>Advice <span class="muted" style="text-transform:none;font-weight:500;">(optional)</span></label><textarea id="rx-advice" placeholder="e.g. Plenty of fluids, rest for 3 days">${s.rxAdvice}</textarea></div>
            <div class="field-row">
              <div class="field"><label>Follow-up date <span class="muted" style="text-transform:none;font-weight:500;">(optional)</span></label><input type="date" id="rx-follow-up" value="${s.rxFollowUpDate}" /></div>
              <div class="field"><label>Consultation fee (₹)</label><input type="number" min="0" step="1" id="rx-fee" value="${s.rxConsultationFee}" placeholder="0" /></div>
            </div>
          </div>
        </div>

        <div class="sheet rx-sheet">
          <div class="sheet-head">
            <div><h3>${s.doctor.name}</h3><div class="small muted">${s.doctor.qualification || ""}</div></div>
            <div class="sheet-meta">℞ Prescription<br /><strong style="color:var(--ink)">${p.patientName || "Patient"}</strong></div>
          </div>
          ${p.patientAge || p.patientGender ? `<div class="sheet-block"><span class="k">Patient</span><div>${[p.patientAge ? `${p.patientAge} yrs` : null, p.patientGender].filter(Boolean).join(" · ")}</div></div>` : ""}
          <div class="sheet-block"><span class="k">Date</span><div>${new Date(s.rxDate).toLocaleDateString("en-IN")}</div></div>
          ${s.rxDiagnosis ? `<div class="sheet-block"><span class="k">Diagnosis</span><div>${s.rxDiagnosis}</div></div>` : ""}
          ${previewMeds.length ? `
            <table class="preview-med-table">
              <thead><tr><th>Medicine</th><th>Dosage</th><th>Freq.</th><th>Duration</th></tr></thead>
              <tbody>
                ${previewMeds.map((m) => `<tr><td>${m.name}</td><td>${m.dosage || "-"}</td><td>${m.frequency || "-"}</td><td>${m.duration || "-"}</td></tr>`).join("")}
              </tbody>
            </table>
          ` : `<div class="sheet-empty">Add at least one medicine to see the prescription preview.</div>`}
          ${s.rxFollowUpDate ? `<div class="sheet-block" style="margin-top:14px;"><span class="k">Follow-up</span><div>${new Date(s.rxFollowUpDate).toLocaleDateString("en-IN")}</div></div>` : ""}
          <div class="sheet-total"><span>Consultation Fee</span><span>${fmtMoney(s.rxConsultationFee || 0)}</span></div>
          <div class="actions-row">
            <button class="btn btn-primary" type="submit" ${previewMeds.length ? "" : "disabled"}>${Icon.check} Save Prescription</button>
          </div>
        </div>
      </div>
    </form>
  `);
}

/* ---------------- Prescription history ---------------- */

function viewPrescriptions(s) {
  const q = (s.searchQuery || "").trim().toLowerCase();
  const filtered = s.prescriptions.filter((p) => {
    const matchesQuery = !q ||
      p.patientName.toLowerCase().includes(q) ||
      p.prescriptionNumber.toLowerCase().includes(q) ||
      (p.diagnosis || "").toLowerCase().includes(q);
    const matchesPayment = s.prescriptionPaymentFilter === "all" || p.payment.status === s.prescriptionPaymentFilter;
    return matchesQuery && matchesPayment;
  });

  const rows = filtered.length ? filtered.map((p) => `
    <tr>
      <td><strong>${p.prescriptionNumber}</strong><div class="small muted">${new Date(p.createdAt).toLocaleDateString("en-IN")}</div></td>
      <td>${p.patientName}<div class="small muted">${[p.patientAge ? p.patientAge + " yrs" : null, p.patientGender].filter(Boolean).join(" · ")}</div></td>
      <td>${p.medicines.length} item${p.medicines.length === 1 ? "" : "s"}</td>
      <td>${fmtMoney(p.consultationFee)}</td>
      <td>
        ${paymentBadge(p.payment)}
        ${p.payment.status === "pending"
          ? `<div style="margin-top:6px;"><button type="button" class="btn btn-soft btn-sm" data-record-payment="${p.id}" data-payment-label="${p.prescriptionNumber}" data-payment-amount="${p.consultationFee}">Record payment</button></div>`
          : `<div style="margin-top:6px;"><button type="button" class="muted-link-btn" data-reset-payment="${p.id}">Undo</button></div>`}
      </td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-sm" data-view-prescription="${p.id}" title="View">${Icon.eye}</button>
        <a class="btn btn-whatsapp btn-sm" href="${prescriptionWhatsappLink(p)}" target="_blank" rel="noopener" title="Share on WhatsApp">${Icon.whatsapp}</a>
        <button class="btn btn-ghost btn-sm" data-download-prescription="${p.id}" data-filename="${p.prescriptionNumber}.pdf" title="Download PDF">${Icon.download}</button>
        <button class="btn btn-danger btn-sm" data-delete-prescription="${p.id}" data-prescription-number="${p.prescriptionNumber}" title="Delete">${Icon.trash}</button>
      </td>
    </tr>`).join("") : "";

  return appShell(s, `
    <div class="page-header">
      <div><span class="eyebrow">Patients</span><h2>Prescriptions</h2><p>Every prescription written, and how the consultation fee was collected.</p></div>
      <button class="btn btn-primary" data-nav="new-prescription">${Icon.pill} New Prescription</button>
    </div>
    ${s.prescriptions.length ? `
      <div class="card">
        <div class="table-toolbar">
          <div class="table-search">
            ${Icon.search}
            <input id="prescription-search" placeholder="Search by patient, prescription no., or diagnosis…" value="${s.searchQuery || ""}" />
          </div>
          <select class="filter-select" id="prescription-payment-filter">
            <option value="all" ${s.prescriptionPaymentFilter === "all" ? "selected" : ""}>All payments</option>
            <option value="paid" ${s.prescriptionPaymentFilter === "paid" ? "selected" : ""}>Paid</option>
            <option value="pending" ${s.prescriptionPaymentFilter === "pending" ? "selected" : ""}>Pending</option>
          </select>
        </div>
        ${filtered.length ? `
          <table class="ledger">
            <thead><tr><th>Rx No.</th><th>Patient</th><th>Medicines</th><th>Fee</th><th>Payment</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : `<div class="empty-state"><h3>No matches</h3><p>Try a different search term or payment filter.</p></div>`}
      </div>
    ` : `
      <div class="empty-state">
        <h3>No prescriptions yet</h3>
        <p>Write your first prescription — patient details, medicines, and a printable PDF in under a minute.</p>
        <button class="btn btn-primary" data-nav="new-prescription" style="margin-top:14px;">${Icon.pill} Write a prescription</button>
      </div>
    `}
    ${s.viewingPrescriptionId ? viewPrescriptionModal(s) : ""}
  `);
}

function viewPrescriptionModal(s) {
  const p = s.prescriptions.find((x) => x.id === s.viewingPrescriptionId);
  if (!p) return "";

  const medRows = p.medicines.map((m) => `
    <tr>
      <td><strong>${m.name}</strong>${m.instructions ? `<div class="small muted">${m.instructions}</div>` : ""}</td>
      <td>${m.dosage || "-"}</td>
      <td>${m.frequency || "-"}</td>
      <td>${m.duration || "-"}</td>
    </tr>`).join("");

  return `
  <div class="modal-backdrop" id="prescription-modal-backdrop">
    <div class="modal">
      <div class="modal-head">
        <h3>${p.prescriptionNumber}</h3>
        <button class="modal-close" id="close-prescription-modal" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="sheet-block"><span class="k">Patient</span><div>${p.patientName} ${[p.patientAge ? p.patientAge + " yrs" : null, p.patientGender].filter(Boolean).length ? `(${[p.patientAge ? p.patientAge + " yrs" : null, p.patientGender].filter(Boolean).join(" · ")})` : ""}</div></div>
        <div class="sheet-block"><span class="k">Date</span><div>${new Date(p.date).toLocaleDateString("en-IN")}</div></div>
        ${p.diagnosis ? `<div class="sheet-block"><span class="k">Diagnosis</span><div>${p.diagnosis}</div></div>` : ""}
        <table class="preview-med-table" style="margin-top:6px;">
          <thead><tr><th>Medicine</th><th>Dosage</th><th>Freq.</th><th>Duration</th></tr></thead>
          <tbody>${medRows}</tbody>
        </table>
        ${p.advice ? `<div class="sheet-block" style="margin-top:14px;"><span class="k">Advice</span><div>${p.advice}</div></div>` : ""}
        ${p.followUpDate ? `<div class="sheet-block"><span class="k">Follow-up</span><div>${new Date(p.followUpDate).toLocaleDateString("en-IN")}</div></div>` : ""}
        <div class="sheet-total"><span>Consultation Fee</span><span>${fmtMoney(p.consultationFee)}</span></div>
        <div class="sheet-block" style="margin-top:14px;"><span class="k">Payment</span><div>${paymentBadge(p.payment)}</div></div>
      </div>
      <div class="modal-footer">
        ${p.payment.status === "pending" ? `<button class="btn btn-soft btn-sm" data-record-payment="${p.id}" data-payment-label="${p.prescriptionNumber}" data-payment-amount="${p.consultationFee}">Record payment</button>` : ""}
        <a class="btn btn-whatsapp btn-sm" href="${prescriptionWhatsappLink(p)}" target="_blank" rel="noopener">${Icon.whatsapp} WhatsApp</a>
        <button class="btn btn-ghost btn-sm" data-download-prescription="${p.id}" data-filename="${p.prescriptionNumber}.pdf">${Icon.download} Download PDF</button>
        <button class="btn btn-primary btn-sm" id="close-prescription-modal-secondary">Close</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- Shared payment-recording modal ---------------- */

function paymentModalView(s) {
  const pm = s.paymentModal;
  return `
  <div class="modal-backdrop" id="payment-modal-backdrop">
    <div class="modal" style="max-width:400px;">
      <div class="modal-head">
        <h3>Record payment</h3>
        <button class="modal-close" id="cancel-payment-modal" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <div class="sheet-block"><span class="k">${pm.type === "invoice" ? "Invoice" : "Prescription"}</span><div>${pm.label}</div></div>
        <div class="sheet-total" style="margin:6px 0 18px;padding-top:0;border-top:none;"><span>Amount</span><span>${fmtMoney(pm.amount)}</span></div>
        <div class="field">
          <label>How was this paid?</label>
          <div class="pay-mode-toggle">
            <button type="button" class="pay-mode-btn ${pm.mode === "Cash" ? "active" : ""}" data-payment-mode="Cash">${Icon.cash} Cash</button>
            <button type="button" class="pay-mode-btn ${pm.mode === "GPay" ? "active" : ""}" data-payment-mode="GPay">${Icon.qr} GPay</button>
          </div>
        </div>
        ${pm.mode === "GPay" ? `
          <div class="field">
            <label>UPI reference no. <span class="muted" style="text-transform:none;font-weight:500;">(optional)</span></label>
            <input id="payment-reference" value="${pm.reference || ""}" placeholder="e.g. last 4 digits or UTR" />
          </div>
        ` : ""}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" id="cancel-payment-modal">Cancel</button>
        <button class="btn btn-primary btn-sm" id="confirm-payment-modal" ${s.loading ? "disabled" : ""}>${s.loading ? "Saving…" : "Confirm payment"}</button>
      </div>
    </div>
  </div>`;
}

/* ---------------- Profile ---------------- */

function viewProfile(s) {
  const d = s.doctor;
  return appShell(s, `
    <div class="page-header">
      <div><span class="eyebrow">Account</span><h2>Profile</h2><p>Saved once, reused on every hospital invoice and prescription.</p></div>
    </div>
    <div class="card" style="max-width:640px;">
      <form id="profile-form">
        <div class="field-row">
          <div class="field"><label>Full name</label><input name="name" value="${d.name}" required /></div>
          <div class="field"><label>Qualification</label><input name="qualification" value="${d.qualification || ""}" /></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Registration number</label><input name="registrationNo" value="${d.registrationNo || ""}" /></div>
          <div class="field"><label>PAN</label><input name="pan" value="${d.pan || ""}" /></div>
        </div>
        <div class="field"><label>GSTIN (optional)</label><input name="gst" value="${d.gst || ""}" /></div>
        <div class="field"><label>Bank details (shown on invoice)</label>
          <textarea name="bankDetails" placeholder="Bank name, account no., IFSC">${d.bankDetails || ""}</textarea>
        </div>
        <div class="field"><label>Signature on file</label>
          <input name="signature" value="${d.signature || ""}" placeholder="Type your name to record a signature on file" />
          <p class="small muted" style="margin-top:6px;">Some hospitals require a signature line on the invoice — filling this in satisfies that check.</p>
        </div>

        <div class="card-head" style="margin-top:8px;"><div><h3 style="font-size:0.95rem;">Clinic &amp; prescriptions</h3><p>Shown on the prescription header, and used to prefill new prescriptions.</p></div></div>
        <div class="field-row">
          <div class="field"><label>Clinic / practice name</label><input name="clinicName" value="${d.clinicName || ""}" placeholder="e.g. Sunrise Family Clinic" /></div>
          <div class="field"><label>Default consultation fee (₹)</label><input type="number" min="0" step="1" name="defaultConsultationFee" value="${d.defaultConsultationFee || ""}" placeholder="0" /></div>
        </div>
        <div class="field"><label>Clinic address</label><input name="clinicAddress" value="${d.clinicAddress || ""}" placeholder="Shown under the clinic name on prescriptions" /></div>
        <div class="field"><label>UPI ID <span class="muted" style="text-transform:none;font-weight:500;">(optional, for your reference)</span></label>
          <input name="upiId" value="${d.upiId || ""}" placeholder="e.g. yourname@okhdfcbank" />
        </div>

        <button class="btn btn-primary" type="submit" ${s.loading ? "disabled" : ""}>${s.loading ? "Saving…" : "Save profile"}</button>
      </form>
    </div>
  `);
}
