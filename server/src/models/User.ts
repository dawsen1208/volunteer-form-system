import mongoose, { type InferSchemaType } from "mongoose";

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    passwordCipherText: { type: String },
    passwordIv: { type: String },
    passwordTag: { type: String },
    resetVersion: { type: Number, default: 0 },
    role: { type: String, enum: ["user"], default: "user" }
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel =
  (mongoose.models.User as mongoose.Model<User>) ||
  mongoose.model<User>("User", userSchema);
