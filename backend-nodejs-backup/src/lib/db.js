import mongoose from "mongoose";
import { ENV } from "./env.js";

export const connectDB = async () => {
  try {
    const { MONGO_URI } = ENV;
    if (!MONGO_URI) throw new Error("MONGO_URI is not set");

    console.log("Attempting to connect to MongoDB Atlas...");

    const conn = await mongoose.connect(ENV.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      family: 4, // Force IPv4
      retryWrites: true,
      retryReads: true,
      maxIdleTimeMS: 30000,
      bufferCommands: false // Disable mongoose buffering
    });

    console.log("✅ MONGODB CONNECTED:", conn.connection.host);
  } catch (error) {
    console.error("❌ Error connection to MONGODB:", error.message);
    console.log("🔄 Continuing without database connection for development...");

    // Don't exit process in development
    if (ENV.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};
