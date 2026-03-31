import mongoose, { type InferSchemaType } from "mongoose";

const formSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["undergrad", "junior"], required: true },
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
    submittedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export type Form = InferSchemaType<typeof formSchema>;

export const FormModel =
  (mongoose.models.Form as mongoose.Model<Form>) ||
  mongoose.model<Form>("Form", formSchema);

