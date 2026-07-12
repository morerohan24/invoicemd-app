# InvoiceMD — Billing & Prescriptions for Freelance Doctors

Generate invoices that hospitals accept the first time, and write patient
prescriptions with the consultation fee tracked as Cash or GPay — all in one
lightweight app with no build step.

This is a working MVP covering Phase 1 + Phase 2 of the product roadmap,
plus a **patient-facing prescription and payment module**:

- Doctor profile (registration no., PAN, GST, bank details, signature on file,
  plus clinic name/address, default consultation fee, and UPI ID)
- Hospital-specific invoice templates (Apollo, Ruby Hall, ONGC seeded; add your own)
- Dynamic invoice form driven by each hospital's required fields, with live preview
- One-click PDF export
- Invoice history with an auto-incrementing invoice number, **View** (full
  detail modal with status history) and **Delete** actions per invoice
- Payment tracker (Submitted → Approved → Accounts → Paid) with a rejection
  reason tracker that resurfaces as a warning next time you bill that hospital
- **New Prescription** — patient details, a dynamic medicine table (name,
  dosage, frequency, duration, instructions), diagnosis, advice, and a
  follow-up date, with a live "Rx pad" preview as you type
- **Printable prescription PDF** — clinic header, patient strip, Rx-style
  medicine table, advice, signature line, and a payment stamp at the bottom
- **Payment recording (Cash or GPay)** — when you mark an invoice **Paid**, or
  record a prescription's consultation fee, a small modal asks how it was
  paid. Cash is one tap; GPay lets you attach the UPI reference number. This
  is shown as a badge everywhere that invoice/prescription appears, and rolled
  up on the dashboard as a Cash vs GPay collections total
- "+ Add hospital" — type just the hospital's name and it's added instantly
  with a standard set of billable fields, no manual field setup required
- WhatsApp share for both invoices and prescriptions
- Search & filter on both Invoice History and Prescriptions (by patient,
  invoice/Rx number, hospital, month, status, or payment state)
- Modern dashboard UI: icon sidebar, top search bar, KPI cards, a
  status-breakdown donut chart, and pill-style status/payment badges

## Project structure

```
doctor-invoice-app/
├── backend/                          Node.js + Express API
│   ├── config/
│   │   ├── db.js                     Mongoose connection (MONGODB_URI)
│   │   └── seed.js                   Seeds the 3 default hospital templates on first run
│   ├── models/                       Mongoose schemas
│   │   ├── Doctor.js
│   │   ├── Hospital.js
│   │   ├── Invoice.js
│   │   ├── Prescription.js
│   │   └── plugins.js                Shared toJSON transform (_id -> id, like the old JSON store)
│   ├── routes/
│   │   ├── doctors.js                Register / login / profile (incl. clinic + UPI fields)
│   │   ├── hospitals.js              Hospital templates (seeded + custom)
│   │   ├── invoices.js               Invoice creation, status tracker + payment mode, PDF export
│   │   └── prescriptions.js          Prescription creation, payment recording, PDF export
│   ├── utils/
│   │   ├── authMiddleware.js
│   │   ├── asyncHandler.js           Forwards async route errors to the error handler
│   │   ├── pdfGenerator.js           Renders an invoice to PDF with pdf-lib
│   │   └── prescriptionPdfGenerator.js   Renders a prescription (Rx pad) to PDF
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/                         Static SPA (no build step — vanilla JS, unchanged)
    ├── index.html
    ├── css/style.css
    └── js/
        ├── icons.js
        ├── api.js
        ├── state.js
        ├── views.js
        └── app.js
```

## Database: MongoDB

The app now stores everything in **MongoDB** via Mongoose instead of the
earlier JSON file. Nothing about the API's request/response shape changed —
every document is still returned with a plain `id` string (Mongo's `_id` is
converted automatically), so the frontend needed **zero changes**.

### Running MongoDB locally

Pick one:

**Option A — Docker (fastest):**
```bash
docker run -d --name invoicemd-mongo -p 27017:27017 mongo:7
```

**Option B — Install MongoDB Community Server** directly:
https://www.mongodb.com/docs/manual/administration/install-community/

**Option C — MongoDB Atlas (free hosted cluster):**
Create a free cluster at https://www.mongodb.com/atlas, add your IP to the
access list, and copy the connection string it gives you (it looks like
`mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/invoicemd`).

Whichever you pick, put the connection string in `backend/.env` as
`MONGODB_URI`.

### First run

```bash
cd backend
cp .env.example .env      # set MONGODB_URI (and JWT_SECRET) here
npm install
npm start
```

On startup the server connects to MongoDB, seeds the three default hospital
templates (Apollo, Ruby Hall, ONGC) **only if the hospitals collection is
empty**, then starts listening on `http://localhost:5000` — which also
serves the frontend directly, so there's no separate frontend build step.

If `MONGODB_URI` is wrong or MongoDB isn't running, the server prints a clear
error and exits rather than hanging:
```
MongoDB connection failed: connect ECONNREFUSED 127.0.0.1:27017
Check MONGODB_URI in your .env — it should point to a running MongoDB instance...
```

1. Open `http://localhost:5000`
2. Click **Create a free account** and fill in your doctor profile
3. In **Profile**, optionally add your clinic name, default consultation fee,
   and UPI ID — these prefill new prescriptions
4. Go to **New Invoice**, pick a hospital, fill in the billing numbers, and
   watch the live preview update as you type
5. Click **Generate Invoice**, then **Download PDF** from Invoice History
6. Move the status dropdown through Submitted → Approved → Accounts → Paid.
   Choosing **Paid** opens a small modal — pick **Cash** or **GPay** (with an
   optional UPI reference) to record how you were paid
7. Go to **New Prescription**, add the patient's details and one or more
   medicines, then **Save Prescription**
8. From **Prescriptions**, click **Record payment** on any pending
   prescription to log Cash or GPay, or **Download PDF** for a printable copy

## Data model (MongoDB collections)

- **doctors** — profile, bcrypt password hash (never returned by the API,
  stripped in the `toJSON` transform as well as excluded from queries by
  default), invoice/prescription counters
- **hospitals** — shared templates (not scoped to one doctor), each with a
  `requiredFields` array describing that hospital's billable line items
- **invoices** — one per submission, embeds `lineItems`, `statusHistory`, and
  an optional `payment` (mode/reference/paidAt)
- **prescriptions** — one per patient visit, embeds `medicines` and a
  `payment` sub-document (`status`, `mode`, `reference`, `paidAt`)

All four are plain Mongoose models in `backend/models/`; routes never touch
the database driver directly.

## Adding a new hospital template

`POST /api/hospitals` (while logged in) with:

```json
{
  "name": "City Care Hospital",
  "requiresSignature": true,
  "requiresGST": false,
  "notes": "Submit by the 5th of each month.",
  "requiredFields": [
    { "key": "opdVisits", "label": "No. of OPD Visits", "type": "number", "rate": 450 },
    { "key": "procedureCharges", "label": "Procedure Charges", "type": "amount" }
  ]
}
```

Field `type` is either `"number"` (quantity × rate, e.g. per-visit fees) or
`"amount"` (a direct rupee figure, e.g. ICU charges). New hospitals then show
up as a tile in the New Invoice screen for every doctor using the app.

## Prescriptions & payment API

```
POST   /api/prescriptions              Create a prescription
GET    /api/prescriptions              List the logged-in doctor's prescriptions
GET    /api/prescriptions/:id          Fetch one
PATCH  /api/prescriptions/:id/payment  { "mode": "Cash" | "GPay", "reference": "optional UPI ref" }
PATCH  /api/prescriptions/:id/payment/reset   Revert a mis-recorded payment to pending
DELETE /api/prescriptions/:id
GET    /api/prescriptions/:id/pdf      Download the prescription as a PDF
```

Marking an invoice `Paid` now requires a payment mode too:

```
PATCH /api/invoices/:id/status
{ "status": "Paid", "paymentMode": "Cash" | "GPay", "paymentReference": "optional UPI ref" }
```

## What's deliberately out of scope for this MVP

Per the roadmap in the product spec, these are natural next steps rather
than missing bugs:

- AI-based OCR to auto-create a hospital template from a sample invoice photo
- AI chat-to-invoice / chat-to-prescription ("15 ICU visits, 8 OPD…" → filled form)
- A UPI QR code rendered on the prescription/invoice (currently the UPI ID is
  stored on the profile for your own reference; scanning/deep-link payment is
  a natural next step)
- Multi-doctor hospital admin console (approve/reject from the hospital side)
- Subscription billing / plan limits (Free vs Pro vs Enterprise)
- Patient records as a first-class entity (patients are currently entered
  fresh per prescription; a searchable patient list with visit history is a
  natural next step)

The codebase is structured (separate routes/controllers/utils, a single data
access layer) so each of these can be added without restructuring what's here.
