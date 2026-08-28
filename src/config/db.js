const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      autoIndex: process.env.NODE_ENV !== "production",
    });
    console.log(`[db] connected -> ${mongoose.connection.host}/${mongoose.connection.name}`);
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[db] disconnected");
  });
}

module.exports = connectDB;
