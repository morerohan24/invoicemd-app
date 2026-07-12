const root = document.getElementById("app");

function render() {
  const s = State.get();
  let html;
  switch (s.view) {
    case "register": html = viewRegister(s); break;
    case "dashboard": html = viewDashboard(s); break;
    case "new-invoice": html = viewNewInvoice(s); break;
    case "invoices": html = viewInvoices(s); break;
    case "new-prescription": html = viewNewPrescription(s); break;
    case "prescriptions": html = viewPrescriptions(s); break;
    case "profile": html = viewProfile(s); break;
    case "login":
    default: html = viewLogin(s); break;
  }
  root.innerHTML = html;
}

async function loadAppData() {
  const [doctor, hospitals, invoices, prescriptions] = await Promise.all([
    Api.me(),
    Api.hospitals(),
    Api.invoices(),
    Api.prescriptions()
  ]);
  State.set({ doctor, hospitals, invoices, prescriptions, view: "dashboard", error: null });
}

async function bootstrap() {
  if (Api.token) {
    try {
      await loadAppData();
      return;
    } catch (err) {
      Api.setToken(null);
    }
  }
  State.set({ view: "login" });
}

/* ---------------- Event delegation ---------------- */

root.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (e.target.id === "login-form") {
    const fd = new FormData(e.target);
    State.set({ loading: true, error: null });
    try {
      const { token, doctor } = await Api.login({ email: fd.get("email"), password: fd.get("password") });
      Api.setToken(token);
      State.set({ doctor, loading: false });
      await loadAppData();
    } catch (err) {
      State.set({ loading: false, error: err.message });
    }
  }

  if (e.target.id === "register-form") {
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    State.set({ loading: true, error: null });
    try {
      const { token, doctor } = await Api.register(payload);
      Api.setToken(token);
      State.set({ doctor, loading: false });
      await loadAppData();
    } catch (err) {
      State.set({ loading: false, error: err.message });
    }
  }

  if (e.target.id === "profile-form") {
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    State.set({ loading: true });
    try {
      const doctor = await Api.updateProfile(payload);
      State.set({ doctor, loading: false });
      showToast("Profile saved");
    } catch (err) {
      State.set({ loading: false });
      showToast(err.message, true);
    }
  }

  if (e.target.id === "add-hospital-form") {
    const fd = new FormData(e.target);
    const name = (fd.get("name") || "").trim();
    const description = (fd.get("description") || "").trim();
    if (!name) return;
    State.set({ loading: true });
    try {
      const hospital = await Api.createHospital({ name, description });
      const hospitals = await Api.hospitals();
      State.set({ hospitals, selectedHospitalId: hospital.id, formValues: {}, showAddHospitalForm: false, loading: false });
      showToast(`${hospital.name} added`);
    } catch (err) {
      State.set({ loading: false });
      showToast(err.message, true);
    }
  }

  if (e.target.id === "prescription-form") {
    const s = State.get();
    State.set({ loading: true });
    try {
      const prescription = await Api.createPrescription({
        ...s.rxPatient,
        date: s.rxDate,
        diagnosis: s.rxDiagnosis,
        medicines: s.rxMedicines,
        advice: s.rxAdvice,
        followUpDate: s.rxFollowUpDate,
        consultationFee: s.rxConsultationFee
      });
      const prescriptions = await Api.prescriptions();
      State.set({ prescriptions, view: "prescriptions", loading: false });
      showToast(`${prescription.prescriptionNumber} written for ${prescription.patientName}`);
    } catch (err) {
      State.set({ loading: false });
      showToast(err.message, true);
    }
  }
});

root.addEventListener("click", async (e) => {
  const nav = e.target.closest("[data-nav]");
  if (nav) {
    const view = nav.getAttribute("data-nav");
    if (view === "new-invoice") {
      State.set({ view, selectedHospitalId: null, formValues: {}, invoiceDescription: "", showAddHospitalForm: false });
    } else if (view === "new-prescription") {
      State.set({
        view,
        rxPatient: { patientName: "", patientAge: "", patientGender: "", patientPhone: "" },
        rxDate: new Date().toISOString().slice(0, 10),
        rxDiagnosis: "",
        rxAdvice: "",
        rxFollowUpDate: "",
        rxConsultationFee: State.data.doctor && State.data.doctor.defaultConsultationFee ? String(State.data.doctor.defaultConsultationFee) : "",
        rxMedicines: [{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }]
      });
    } else {
      State.set({ view });
    }
    return;
  }

  if (e.target.id === "go-register") State.set({ view: "register", error: null });
  if (e.target.id === "go-login") State.set({ view: "login", error: null });

  if (e.target.id === "logout-btn" || e.target.closest("#logout-btn")) {
    Api.setToken(null);
    State.set({ view: "login", doctor: null, invoices: [], hospitals: [], prescriptions: [] });
  }

  const hospitalTile = e.target.closest("[data-select-hospital]");
  if (hospitalTile) {
    State.set({ selectedHospitalId: hospitalTile.getAttribute("data-select-hospital"), formValues: {}, showAddHospitalForm: false });
  }

  if (e.target.id === "add-hospital-tile" || e.target.closest("#add-hospital-tile")) {
    State.set({ showAddHospitalForm: true, selectedHospitalId: null });
  }
  if (e.target.id === "cancel-add-hospital") {
    State.set({ showAddHospitalForm: false });
  }

  if (e.target.id === "submit-invoice" || e.target.closest("#submit-invoice")) {
    const s = State.get();
    const hospital = s.hospitals.find((h) => h.id === s.selectedHospitalId);
    State.set({ loading: true });
    try {
      const { invoice, warnings } = await Api.createInvoice({
        hospitalId: hospital.id,
        month: s.invoiceMonth,
        formValues: s.formValues,
        description: s.invoiceDescription || ""
      });
      const invoices = await Api.invoices();
      State.set({ invoices, view: "invoices", loading: false, selectedHospitalId: null, formValues: {}, invoiceDescription: "" });
      showToast(`${invoice.invoiceNumber} generated successfully`);
      if (warnings && warnings.length) showToast(warnings[0], true);
    } catch (err) {
      State.set({ loading: false });
      showToast(err.message, true);
    }
  }

  const downloadBtn = e.target.closest("[data-download]");
  if (downloadBtn) {
    const id = downloadBtn.getAttribute("data-download");
    const filename = downloadBtn.getAttribute("data-filename");
    const originalHtml = downloadBtn.innerHTML;
    downloadBtn.innerHTML = "…";
    try {
      await Api.downloadInvoicePdf(id, filename);
      downloadBtn.innerHTML = originalHtml;
    } catch (err) {
      downloadBtn.innerHTML = originalHtml;
      showToast("Could not generate PDF", true);
    }
  }

  const viewBtn = e.target.closest("[data-view-invoice]");
  if (viewBtn) {
    State.set({ viewingInvoiceId: viewBtn.getAttribute("data-view-invoice") });
  }

  if (e.target.id === "close-invoice-modal" || e.target.id === "close-invoice-modal-secondary" || e.target.id === "invoice-modal-backdrop") {
    State.set({ viewingInvoiceId: null });
  }

  const deleteBtn = e.target.closest("[data-delete-invoice]");
  if (deleteBtn) {
    const id = deleteBtn.getAttribute("data-delete-invoice");
    const number = deleteBtn.getAttribute("data-invoice-number");
    if (confirm(`Delete invoice ${number}? This can't be undone.`)) {
      try {
        await Api.deleteInvoice(id);
        const invoices = await Api.invoices();
        State.set({ invoices, viewingInvoiceId: null });
        showToast(`${number} deleted`);
      } catch (err) {
        showToast(err.message, true);
      }
    }
  }

  /* ---------------- Prescriptions ---------------- */

  if (e.target.id === "add-medicine-row" || e.target.closest("#add-medicine-row")) {
    State.set({
      rxMedicines: [...State.data.rxMedicines, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }]
    });
  }

  const removeMedBtn = e.target.closest("[data-remove-medicine]");
  if (removeMedBtn) {
    const idx = Number(removeMedBtn.getAttribute("data-remove-medicine"));
    const rows = State.data.rxMedicines.filter((_, i) => i !== idx);
    State.set({ rxMedicines: rows.length ? rows : [{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }] });
  }

  const rxViewBtn = e.target.closest("[data-view-prescription]");
  if (rxViewBtn) {
    State.set({ viewingPrescriptionId: rxViewBtn.getAttribute("data-view-prescription") });
  }

  if (e.target.id === "close-prescription-modal" || e.target.id === "close-prescription-modal-secondary" || e.target.id === "prescription-modal-backdrop") {
    State.set({ viewingPrescriptionId: null });
  }

  const rxDownloadBtn = e.target.closest("[data-download-prescription]");
  if (rxDownloadBtn) {
    const id = rxDownloadBtn.getAttribute("data-download-prescription");
    const filename = rxDownloadBtn.getAttribute("data-filename");
    const originalHtml = rxDownloadBtn.innerHTML;
    rxDownloadBtn.innerHTML = "…";
    try {
      await Api.downloadPrescriptionPdf(id, filename);
      rxDownloadBtn.innerHTML = originalHtml;
    } catch (err) {
      rxDownloadBtn.innerHTML = originalHtml;
      showToast("Could not generate PDF", true);
    }
  }

  const rxDeleteBtn = e.target.closest("[data-delete-prescription]");
  if (rxDeleteBtn) {
    const id = rxDeleteBtn.getAttribute("data-delete-prescription");
    const number = rxDeleteBtn.getAttribute("data-prescription-number");
    if (confirm(`Delete prescription ${number}? This can't be undone.`)) {
      try {
        await Api.deletePrescription(id);
        const prescriptions = await Api.prescriptions();
        State.set({ prescriptions, viewingPrescriptionId: null });
        showToast(`${number} deleted`);
      } catch (err) {
        showToast(err.message, true);
      }
    }
  }

  const recordPayBtn = e.target.closest("[data-record-payment]");
  if (recordPayBtn) {
    const id = recordPayBtn.getAttribute("data-record-payment");
    const label = recordPayBtn.getAttribute("data-payment-label") || "";
    const amount = Number(recordPayBtn.getAttribute("data-payment-amount") || 0);
    State.set({ paymentModal: { type: "prescription", id, label, amount, mode: "Cash", reference: "" } });
  }

  const resetPayBtn = e.target.closest("[data-reset-payment]");
  if (resetPayBtn) {
    const id = resetPayBtn.getAttribute("data-reset-payment");
    try {
      await Api.resetPrescriptionPayment(id);
      const prescriptions = await Api.prescriptions();
      State.set({ prescriptions });
      showToast("Payment reset to pending");
    } catch (err) {
      showToast(err.message, true);
    }
  }

  /* ---------------- Shared payment modal ---------------- */

  const modeBtn = e.target.closest("[data-payment-mode]");
  if (modeBtn && State.data.paymentModal) {
    State.set({ paymentModal: { ...State.data.paymentModal, mode: modeBtn.getAttribute("data-payment-mode") } });
  }

  if (e.target.id === "cancel-payment-modal" || e.target.id === "payment-modal-backdrop") {
    State.set({ paymentModal: null });
  }

  if (e.target.id === "confirm-payment-modal") {
    const pm = State.data.paymentModal;
    if (!pm) return;
    State.set({ loading: true });
    try {
      if (pm.type === "invoice") {
        await Api.setInvoiceStatus(pm.id, { status: "Paid", paymentMode: pm.mode, paymentReference: pm.reference });
        const invoices = await Api.invoices();
        State.set({ invoices, loading: false, paymentModal: null });
      } else {
        await Api.recordPrescriptionPayment(pm.id, { mode: pm.mode, reference: pm.reference });
        const prescriptions = await Api.prescriptions();
        State.set({ prescriptions, loading: false, paymentModal: null });
      }
      showToast(`Payment recorded — ${pm.mode}`);
    } catch (err) {
      State.set({ loading: false });
      showToast(err.message, true);
    }
  }
});

root.addEventListener("input", (e) => {
  if (e.target.id === "invoice-month") {
    State.data.invoiceMonth = e.target.value; // avoid re-render/caret jump
  }

  if (e.target.id === "invoice-description") {
    State.data.invoiceDescription = e.target.value; // avoid re-render/caret jump
  }

  if (e.target.id === "topbar-search" || e.target.id === "invoice-search" || e.target.id === "prescription-search") {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart;
    const activeId = e.target.id;
    State.data.searchQuery = value;
    render();
    const el = root.querySelector(`#${activeId}`);
    if (el) {
      el.focus();
      el.setSelectionRange(selectionStart, selectionStart);
    }
    return;
  }

  const patientField = e.target.getAttribute && e.target.getAttribute("data-patient-field");
  if (patientField) {
    State.data.rxPatient = { ...State.data.rxPatient, [patientField]: e.target.value };
    return; // no re-render needed, patient block doesn't affect the live preview total
  }

  if (e.target.id === "rx-date") { State.data.rxDate = e.target.value; return; }
  if (e.target.id === "rx-diagnosis") { State.data.rxDiagnosis = e.target.value; return; }
  if (e.target.id === "rx-advice") { State.data.rxAdvice = e.target.value; return; }
  if (e.target.id === "rx-follow-up") { State.data.rxFollowUpDate = e.target.value; return; }
  if (e.target.id === "rx-fee") { State.data.rxConsultationFee = e.target.value; render(); return; }

  const medField = e.target.getAttribute && e.target.getAttribute("data-med-field");
  if (medField) {
    const idx = Number(e.target.getAttribute("data-med-idx"));
    const rows = State.data.rxMedicines.map((m, i) => (i === idx ? { ...m, [medField]: e.target.value } : m));
    State.data.rxMedicines = rows;
    // Re-render the preview while preserving focus/caret on the field being edited
    const selectionStart = e.target.selectionStart;
    render();
    const el = root.querySelector(`[data-med-field="${medField}"][data-med-idx="${idx}"]`);
    if (el) {
      el.focus();
      if (selectionStart !== null && selectionStart !== undefined) el.setSelectionRange(selectionStart, selectionStart);
    }
    return;
  }

  if (e.target.id === "payment-reference" && State.data.paymentModal) {
    State.data.paymentModal = { ...State.data.paymentModal, reference: e.target.value };
    return;
  }

  const key = e.target.getAttribute && e.target.getAttribute("data-field-key");
  if (key) {
    State.data.formValues = { ...State.data.formValues, [key]: e.target.value };
    // Re-render only the preview + total by re-rendering the whole new-invoice view,
    // but preserve focus by re-reading value after render.
    const active = document.activeElement;
    const activeKey = active && active.getAttribute && active.getAttribute("data-field-key");
    const selectionStart = active && active.selectionStart;
    render();
    if (activeKey) {
      const el = root.querySelector(`[data-field-key="${activeKey}"]`);
      if (el) {
        el.focus();
        if (selectionStart !== null && selectionStart !== undefined) {
          el.setSelectionRange(selectionStart, selectionStart);
        }
      }
    }
  }
});

root.addEventListener("change", async (e) => {
  const patientField = e.target.getAttribute && e.target.getAttribute("data-patient-field");
  if (patientField) {
    State.data.rxPatient = { ...State.data.rxPatient, [patientField]: e.target.value };
    return;
  }

  if (e.target.id === "status-filter") {
    State.set({ statusFilter: e.target.value });
    return;
  }

  if (e.target.id === "prescription-payment-filter") {
    State.set({ prescriptionPaymentFilter: e.target.value });
    return;
  }

  const invoiceId = e.target.getAttribute && e.target.getAttribute("data-status-for");
  if (invoiceId) {
    const newStatus = e.target.value;
    if (newStatus === "Rejected") {
      const reason = prompt("Rejection reason (e.g. wrong template, missing signature, missing PAN):") || "Not specified";
      try {
        await Api.setInvoiceStatus(invoiceId, { status: "Rejected", rejectionReason: reason });
        const invoices = await Api.invoices();
        State.set({ invoices });
        showToast("Marked as rejected — reason saved for next time");
      } catch (err) {
        showToast(err.message, true);
      }
    } else if (newStatus === "Paid") {
      const inv = State.data.invoices.find((i) => i.id === invoiceId);
      State.set({
        paymentModal: { type: "invoice", id: invoiceId, label: inv ? inv.invoiceNumber : "", amount: inv ? inv.total : 0, mode: "Cash", reference: "" }
      });
    } else {
      try {
        await Api.setInvoiceStatus(invoiceId, { status: newStatus });
        const invoices = await Api.invoices();
        State.set({ invoices });
        showToast(`Status updated to ${newStatus}`);
      } catch (err) {
        showToast(err.message, true);
      }
    }
  }
});

root.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "topbar-search") {
    e.preventDefault();
    if (State.data.view !== "invoices") State.set({ view: "invoices" });
  }
});

bootstrap();
