require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { connectDB } = require("./config/db");
const { seedHospitals } = require("./config/seed");

const doctorRoutes = require("./routes/doctors");
const hospitalRoutes = require("./routes/hospitals");
const invoiceRoutes = require("./routes/invoices");
const prescriptionRoutes = require("./routes/prescriptions");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// API routes
app.use("/api/doctors", doctorRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Serve the frontend (static SPA)
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Central error handler — catches everything forwarded by asyncHandler()
// (Mongoose validation/cast errors, duplicate-key errors, etc.) so a bad
// request or DB hiccup returns a clean JSON error instead of hanging or
// crashing the process.
app.use((err, req, res, next) => {
  console.error(err);

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((e) => e.message).join(", ");
    return res.status(400).json({ error: message || "Validation failed" });
  }
  if (err.name === "CastError") {
    return res.status(404).json({ error: "Not found" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: "A record with that value already exists" });
  }

  res.status(500).json({ error: "Something went wrong on the server" });
});

async function start() {
  await connectDB();
  await seedHospitals();
  app.listen(PORT, () => {
    console.log(`Doctor Invoice API running on http://localhost:${PORT}`);
  });
}

start();
