
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

// CORS: allow the deployed frontend and local development.
const allowedOrigins = [
  "https://invoicemd-app-frontend.vercel.app",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(
    ...process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header, such as health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Health endpoint: verifies that the API is responding.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

// Initialize MongoDB once per warm server instance.
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

// Initialize the database before handling API requests that need it.
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    return next();
  }

  if (req.path === "/api/health") {
    return next();
  }

  try {
    await initializeDatabase();
    return next();
  } catch (error) {
    console.error("Database initialization failed:", error.message);

    return res.status(503).json({
      error: "Database is temporarily unavailable",
    });
  }
});

// API routes.
app.use("/api/doctors", doctorRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

// Return a clear error for unknown API endpoints.
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

  return res.status(500).json({
    error: "Something went wrong on the server",
  });
});

// Export the app for Vercel.
module.exports = app;

// Start the server when running locally.
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
