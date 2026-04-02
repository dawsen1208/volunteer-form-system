import mongoose from "mongoose";

import { FormModel } from "../models/Form";
import { AppError } from "../utils/errors";

export async function getAllForms() {
  return FormModel.find()
    .sort({ updatedAt: -1 })
    .populate("userId", "phone")
    .exec();
}

export async function getFormByIdForAdmin(formId: string) {
  if (!mongoose.isValidObjectId(formId)) {
    throw new AppError(400, "Invalid input");
  }

  const form = await FormModel.findById(formId).populate("userId", "phone").exec();
  if (!form) {
    throw new AppError(404, "表单不存在");
  }
  return form;
}

export async function deleteFormByIdForAdmin(formId: string) {
  if (!mongoose.isValidObjectId(formId)) {
    throw new AppError(400, "Invalid input");
  }

  const found = await FormModel.findById(formId).exec();
  if (!found) {
    throw new AppError(404, "表单不存在");
  }
  await FormModel.deleteOne({ _id: formId }).exec();
  return { deleted: true };
}
