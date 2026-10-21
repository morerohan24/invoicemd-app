/* Tiny global state store + pub/sub renderer trigger. */
const State = {
  data: {
    view: "login", // login | register | dashboard | new-invoice | invoices | new-prescription | prescriptions | profile
    doctor: null,
    hospitals: [],
    invoices: [],
    prescriptions: [],
    selectedHospitalId: null,
    formValues: {},
    invoiceMonth: new Date().toLocaleString("en-IN", { month: "long", year: "numeric" }),
    invoiceDescription: "",
    viewingInvoiceId: null,
    viewingPrescriptionId: null,
    showAddHospitalForm: false,
    mobileNavOpen: false,
    searchQuery: "",
    statusFilter: "all", // all | Submitted | Approved | Accounts | Paid | Rejected
    prescriptionPaymentFilter: "all", // all | paid | pending
    // Draft state for the New Prescription form
    rxPatient: { patientName: "", patientAge: "", patientGender: "", patientPhone: "" },
    rxDate: new Date().toISOString().slice(0, 10),
    rxDiagnosis: "",
    rxAdvice: "",
    rxFollowUpDate: "",
    rxConsultationFee: "",
    rxMedicines: [{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }],
    // Shared payment-recording modal, used for both invoices ("Paid") and prescriptions
    paymentModal: null, // { type: 'invoice' | 'prescription', id, invoiceNumber, mode: 'Cash' | 'GPay', reference }
    loading: false,
    error: null,
    toast: null
  },

  set(patch) {
    Object.assign(this.data, patch);
    render();
  },

  get() {
    return this.data;
  }
};

function showToast(message, isError = false) {
  State.set({ toast: { message, isError } });
  setTimeout(() => {
    if (State.data.toast && State.data.toast.message === message) {
      State.set({ toast: null });
    }
  }, 3200);
}
