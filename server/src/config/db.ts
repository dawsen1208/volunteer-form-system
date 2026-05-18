import mongoose from "mongoose";

import { env } from "./env";

export async function connectToDatabase(): Promise<void> {
  mongoose.set("strictQuery", true);
  const serverSelectionTimeoutMS = Number(
    process.env.MONGOOSE_SERVER_SELECTION_TIMEOUT_MS ?? 5000
  );

  console.log("Connecting to MongoDB...");
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: Number.isFinite(serverSelectionTimeoutMS)
      ? serverSelectionTimeoutMS
      : 5000
  });
  console.log("MongoDB connected");
}
