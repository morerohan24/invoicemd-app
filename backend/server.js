
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDB } = require("./config/db");
const { seedHospitals } = require("./config/seed");

const doctorRoutes = require("./routes/doctors");
const hospitalRoutes = require("./routes/hospitals");
const invoiceRoutes = require("./routes/invoices");
const prescriptionRoutes = require("./routes/prescriptions");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
      : true,
  })
);

app.use(express.json({ limit: "1mb" }));

// Health endpoint: does not require a database connection.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

// Initialize the database once per warm server instance.
let initializationPromise;

function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await connectDB();
      await seedHospitals();
    })().catch((error) => {
      // Allow a later request to retry initialization.
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

// Database-dependent API routes.
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  if (req.path === "/api/health") {
    return next();
  }

  try {
    await initializeDatabase();
    next();
  } catch (error) {
    console.error("Database initialization failed:", error.message);

    res.status(503).json({
      error: "Database is temporarily unavailable",
    });
  }
});

app.use("/api/doctors", doctorRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

// API 404 handler.
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found",
  });
});

// Central error handler.
app.use((err, req, res, next) => {
  console.error("Request error:", err);

  if (res.headersSent) {
    return next(err);
  }

  if (err.name === "ValidationError") {
    const message = Object.values(err.errors || {})
      .map((item) => item.message)
      .join(", ");

    return res.status(400).json({
      error: message || "Validation failed",
    });
  }

  if (err.name === "CastError") {
    return res.status(404).json({
      error: "Not found",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: "A record with that value already exists",
    });
  }

  res.status(500).json({
    error: "Something went wrong on the server",
  });
});

// Export the Express app for Vercel.
module.exports = app;

// Keep local development working.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`InvoiceMD API running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start InvoiceMD:", error);
      process.exit(1);
    });
}
