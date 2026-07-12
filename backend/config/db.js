/**
 * MongoDB connection (via Mongoose).
 *
 * Replaces the earlier zero-config JSON file store. Set MONGODB_URI in your
 * .env — either a local instance (mongodb://127.0.0.1:27017/invoicemd) or a
 * MongoDB Atlas connection string. All models live in ../models; routes only
 * ever talk to Mongoose models, never to this file directly.
 */
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/invoicemd";

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    console.log(`MongoDB connected -> ${mongoose.connection.name}`);
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.error(
      "Check MONGODB_URI in your .env — it should point to a running MongoDB " +
        "instance (local mongod, Docker, or an Atlas connection string)."
    );
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
}

module.exports = { connectDB };
