import mongoose from "mongoose";

import { FormModel } from "../models/Form";
import { UserModel } from "../models/User";
import { AppError } from "../utils/errors";

export type FormType = "undergrad" | "junior";
export type FormStatus = "draft" | "submitted";

function isValidFormType(type: string): type is FormType {
  return type === "undergrad" || type === "junior";
}

function ensureObjectContent(content: unknown): Record<string, any> {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    throw new AppError(400, "表单内容必须是对象");
  }
  return content as Record<string, any>;
}

function ensureNonEmptyObject(content: Record<string, any>): void {
  if (Object.keys(content).length === 0) {
    throw new AppError(400, "表单内容不能为空，无法提交");
  }
}

const ORAL_EXAM_STATUS_VALUES = ["合格", "不合格", "未参加"] as const;
const TUITION_RANGE_VALUES = [
  "无要求",
  "1万以内",
  "1-2万",
  "2-3万",
  "3-5万",
  "5-10万",
  "10万以上"
] as const;
const HOUSEHOLD_TYPE_VALUES = ["城市户口", "农村户口", "高校专项", "农村地方专项"] as const;
const UPGRADE_INTENT_VALUES = ["升本", "不升本"] as const;

function validateEnumField(params: {
  content: Record<string, any>;
  key: string;
  label: string;
  allowed: readonly string[];
}): void {
  const value = params.content[params.key];
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string") {
    throw new AppError(400, `${params.label}取值不合法`);
  }
  if (!params.allowed.includes(value)) {
    throw new AppError(400, `${params.label}取值不合法`);
  }
}

function validateStrictEnums(type: FormType, content: Record<string, any>): void {
  validateEnumField({
    content,
    key: "oralExamStatus",
    label: "口语考试",
    allowed: ORAL_EXAM_STATUS_VALUES
  });
  validateEnumField({
    content,
    key: "tuitionRange",
    label: "学费区间",
    allowed: TUITION_RANGE_VALUES
  });
  validateEnumField({
    content,
    key: "householdType",
    label: "户籍类型",
    allowed: HOUSEHOLD_TYPE_VALUES
  });

  if (type === "junior") {
    validateEnumField({
      content,
      key: "upgradeIntent",
      label: "专升本意向",
      allowed: UPGRADE_INTENT_VALUES
    });
  }
}

export async function createForm(userId: string, type: FormType) {
  if (!isValidFormType(type)) {
    throw new AppError(400, "表单类型非法");
  }
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError(400, "Invalid input");
  }

  const user = await UserModel.findById(userId).select("resetVersion").exec();
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }
  const userVersion = Number((user as any).resetVersion ?? 0) || 0;

  const created = await FormModel.create({
    userId: new mongoose.Types.ObjectId(userId),
    userVersion,
    type,
    status: "draft",
    content: {}
  });
  return created;
}

export async function getMyForms(userId: string) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new AppError(400, "Invalid input");
  }
  const user = await UserModel.findById(userId).select("resetVersion").exec();
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }
  const userVersion = Number((user as any).resetVersion ?? 0) || 0;
  const query =
    userVersion <= 0
      ? { userId, $or: [{ userVersion: 0 }, { userVersion: { $exists: false } }] }
      : { userId, userVersion };
  return FormModel.find(query).sort({ updatedAt: -1 }).exec();
}

export async function getMyFormById(userId: string, formId: string) {
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(formId)) {
    throw new AppError(400, "Invalid input");
  }

  const user = await UserModel.findById(userId).select("resetVersion").exec();
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }
  const userVersion = Number((user as any).resetVersion ?? 0) || 0;
  const query =
    userVersion <= 0
      ? { _id: formId, userId, $or: [{ userVersion: 0 }, { userVersion: { $exists: false } }] }
      : { _id: formId, userId, userVersion };

  const form = await FormModel.findOne(query).exec();
  if (!form) {
    throw new AppError(404, "表单不存在");
  }
  return form;
}

export async function updateMyForm(
  userId: string,
  formId: string,
  content: Record<string, any>
) {
  const nextContent = ensureObjectContent(content);

  const form = await getMyFormById(userId, formId);
  if (form.status !== "draft") {
    throw new AppError(409, "已提交表单不可修改");
  }

  const prevContent =
    typeof form.content === "object" && form.content !== null && !Array.isArray(form.content)
      ? (form.content as Record<string, any>)
      : {};

  validateStrictEnums(form.type as FormType, nextContent);

  const getRecommendSig = (c: Record<string, any>): string => {
    const scores = c.scores && typeof c.scores === "object" && !Array.isArray(c.scores) ? c.scores : {};
    const totalScore = (scores as any).totalScore ?? null;
    const rank = (scores as any).rank ?? null;
    const subjectsSelected = Array.isArray((scores as any).subjectsSelected)
      ? (scores as any).subjectsSelected
      : [];
    const majorPreferences = Array.isArray(c.majorPreferences) ? c.majorPreferences : [];
    const majors = majorPreferences.map((m: any) => ({
      index: m?.index ?? null,
      majorCategory: m?.majorCategory ?? null,
      majorName: m?.majorName ?? null
    }));
    return JSON.stringify({ totalScore, rank, subjectsSelected, majors });
  };

  const prevSig = getRecommendSig(prevContent);
  const nextSig = getRecommendSig(nextContent);

  const meta: Record<string, any> = {};
  if (prevSig === nextSig) {
    if ("__recommendation" in prevContent) meta.__recommendation = (prevContent as any).__recommendation;
    if ("__recommendationError" in prevContent) meta.__recommendationError = (prevContent as any).__recommendationError;
  }

  form.content = { ...nextContent, ...meta };
  await form.save();
  return form;
}

export async function submitForm(userId: string, formId: string) {
  const form = await getMyFormById(userId, formId);
  if (form.status !== "draft") {
    throw new AppError(409, "不可重复提交");
  }

  const content = ensureObjectContent(form.content);
  ensureNonEmptyObject(content);
  validateStrictEnums(form.type as FormType, content);

  form.status = "submitted";
  form.submittedAt = new Date();
  await form.save();
  return form;
}

export async function deleteMyDraft(userId: string, formId: string) {
  const form = await getMyFormById(userId, formId);
  if (form.status !== "draft") {
    throw new AppError(409, "已提交表单不可删除");
  }
  await FormModel.deleteOne({ _id: formId, userId }).exec();
  return { deleted: true };
}
