import { Button, Form, Spin, Steps, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { getMyFormById, submitForm, updateMyForm } from "../api/forms";
import { AppCard } from "../components/AppCard";
import { FormContentView } from "../components/FormContentView";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { StickyFormFooter } from "../components/StickyFormFooter";
import { MainLayout } from "../layouts/MainLayout";
import type { FormContent, FormRecord, FormType, MajorPreferenceItem } from "../types";
import { mapFormType } from "../utils/mapping";
import { mergeDefaultContent } from "../utils/formConfig";
import {
  getFormSchema,
  getMajorCategories,
  HOUSEHOLD_TYPE_VALUES,
  normalizeRequired,
  normalizeVisible,
  ORAL_EXAM_STATUS_VALUES,
  TUITION_RANGE_VALUES,
  UPGRADE_INTENT_VALUES
} from "../utils/formSchema";
import { FormStepOne } from "./form/FormStepOne";
import { FormStepTwo } from "./form/FormStepTwo";

function formatTime(value: string) {
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return value;
  return t.toLocaleString();
}

function validateMajorPreferences(list: MajorPreferenceItem[] | undefined) {
  const rows = Array.isArray(list) ? list : [];
  const active = rows
    .map((r) => ({
      majorCategory: (r.majorCategory ?? "").trim(),
      majorName: (r.majorName ?? "").trim()
    }))
    .filter((r) => r.majorCategory || r.majorName);

  if (active.length === 0) throw new Error("请至少填写一条专业意向");

  const incomplete = active.find((r) => !r.majorCategory || !r.majorName);
  if (incomplete) throw new Error("专业意向中已填写的行需同时填写“专业大类”和“具体专业”");
}

export function FormPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [api, contextHolder] = message.useMessage();
  const [form] = Form.useForm();

  const type = params.type as FormType | undefined;
  const formId = search.get("id") ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState<FormRecord | null>(null);
  const [step, setStep] = useState(0);

  const isValidType = type === "undergrad" || type === "junior";
  const schema = useMemo(() => (isValidType ? getFormSchema(type) : []), [isValidType, type]);
  const contentSnapshot = Form.useWatch([], form) ?? {};
  const myopiaHas = Form.useWatch(["body", "myopia", "has"], form);
  const advanceBatchOptions = Form.useWatch(["advanceBatchOptions"], form);
  const specialBatchOptions = Form.useWatch(["specialBatchOptions"], form);

  useEffect(() => {
    async function load() {
      if (!formId) {
        api.error("缺少表单 ID");
        navigate("/records", { replace: true });
        return;
      }
      if (!isValidType) {
        api.error("表单类型参数错误");
        navigate("/records", { replace: true });
        return;
      }
      try {
        setLoading(true);
        const data = await getMyFormById(formId);
        setRecord(data);
        if (data.type !== type) {
          navigate(`/form/${data.type}?id=${data._id}`, { replace: true });
          return;
        }
        const initial = mergeDefaultContent(data.type, data.content);
        form.setFieldsValue(initial);
      } catch (err: any) {
        api.error(err?.message || "表单不存在");
        navigate("/records", { replace: true });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api, form, formId, isValidType, navigate, type]);

  const readOnly = record?.status === "submitted";
  const majorCategories = useMemo(
    () => (isValidType ? getMajorCategories(type) : []),
    [isValidType, type]
  );

  useEffect(() => {
    if (!myopiaHas) {
      form.setFieldsValue({ body: { myopia: { leftDegree: undefined, rightDegree: undefined } } });
    }
  }, [form, myopiaHas]);

  useEffect(() => {
    if (Array.isArray(advanceBatchOptions) && !advanceBatchOptions.includes("其他")) {
      form.setFieldValue("advanceBatchOtherNote", undefined);
    }
  }, [advanceBatchOptions, form]);

  useEffect(() => {
    if (Array.isArray(specialBatchOptions) && !specialBatchOptions.includes("其他")) {
      form.setFieldValue("specialBatchOtherNote", undefined);
    }
  }, [form, specialBatchOptions]);

  function validatePhone(value: unknown, label: string) {
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) return;
    if (!/^1\d{10}$/.test(v)) throw new Error(`${label}格式不正确`);
  }

  function validateIdNumber(value: unknown) {
    const v = typeof value === "string" ? value.trim() : "";
    if (!v) return;
    if (!/(^\d{15}$)|(^\d{17}[\dXx]$)/.test(v)) throw new Error("身份证号格式不正确");
  }

  function validateEnumValue(
    value: unknown,
    allowed: readonly string[],
    label: string
  ) {
    if (value === undefined || value === null || value === "") return;
    if (typeof value !== "string") throw new Error(`${label}取值不合法`);
    if (!allowed.includes(value)) throw new Error(`${label}取值不合法`);
  }

  function getStepRequiredFieldNames(targetStep: number): (string | number)[][] {
    const sections = schema.filter((s) => s.step === targetStep);
    const fields = sections.flatMap((s) => s.fields);
    return fields
      .filter((f) => normalizeVisible(f.visibleWhen, contentSnapshot))
      .filter((f) => Boolean(f.required || normalizeRequired(f.requiredWhen, contentSnapshot)))
      .map((f) => f.name);
  }

  function getOptionalSubjectCount(selected: string[]) {
    const fixed = new Set(["数学", "语文", "英语"]);
    return selected.filter((s) => !fixed.has(s)).length;
  }

  async function validateStep(targetStep: number) {
    const names = getStepRequiredFieldNames(targetStep);
    if (names.length) {
      await form.validateFields(names as any);
    }

    if (targetStep === 0) {
      const name = String(form.getFieldValue("name") ?? "").trim();
      if (!name) throw new Error("请输入姓名");

      const graduateSchool = String(form.getFieldValue("graduateSchool") ?? "").trim();
      if (!graduateSchool) throw new Error("请输入毕业学校");

      validatePhone(form.getFieldValue("candidatePhone"), "考生电话");
      validatePhone(form.getFieldValue("parentPhone"), "家长电话");
      validateIdNumber(form.getFieldValue("idNumber"));

      validateEnumValue(form.getFieldValue("oralExamStatus"), ORAL_EXAM_STATUS_VALUES, "口语考试");
      validateEnumValue(form.getFieldValue("tuitionRange"), TUITION_RANGE_VALUES, "学费区间");
      validateEnumValue(form.getFieldValue("householdType"), HOUSEHOLD_TYPE_VALUES, "户籍类型");
      if (type === "junior") {
        validateEnumValue(form.getFieldValue("upgradeIntent"), UPGRADE_INTENT_VALUES, "专升本意向");
      }
    }

    if (targetStep === 1) {
      const selected = form.getFieldValue(["scores", "subjectsSelected"]);
      const list: string[] = Array.isArray(selected) ? selected : [];
      const fixed = ["数学", "语文", "英语"];
      const missingFixed = fixed.find((s) => !list.includes(s));
      if (missingFixed) throw new Error("选科情况必须包含数学、语文、英语");
      if (getOptionalSubjectCount(list) !== 3) {
        throw new Error("除数学、语文、英语外，请再选择三门科目");
      }
    }

    if (targetStep === 2) {
      const content = form.getFieldsValue(true) as any;
      validateMajorPreferences(content.majorPreferences as MajorPreferenceItem[] | undefined);
    }
  }

  async function goNext() {
    if (step >= 3) return;
    try {
      await validateStep(step);
      setStep(step + 1);
    } catch (err: any) {
      api.error(err?.message || "请先完成当前步骤的必填项");
    }
  }

  function goPrev() {
    if (step <= 0) return;
    setStep(step - 1);
  }

  async function saveDraft() {
    if (!record) return;
    if (readOnly) return;
    try {
      setSaving(true);
      const content = form.getFieldsValue(true) as FormContent;
      const updated = await updateMyForm(record._id, content);
      setRecord(updated);
      api.success("草稿已保存");
    } catch (err: any) {
      api.error(err?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!record) return;
    if (readOnly) return;
    try {
      setSubmitting(true);
      await validateStep(0);
      await validateStep(1);
      await validateStep(2);
      await validateStep(3);
      const content = form.getFieldsValue(true) as FormContent;
      if (!content) throw new Error("表单内容不能为空，无法提交");
      await updateMyForm(record._id, content);
      const submitted = await submitForm(record._id);
      setRecord(submitted);
      api.success("提交成功");
      navigate("/records", { replace: true });
    } catch (err: any) {
      api.error(err?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isValidType) {
    return (
      <MainLayout title="志愿表单">
        <AppCard>页面参数错误</AppCard>
      </MainLayout>
    );
  }

  const step0Sections = schema.filter((s) => s.step === 0);
  const step1Sections = schema.filter((s) => s.step === 1);
  const step2Sections = schema.filter((s) => s.step === 2);
  const step3Sections = schema.filter((s) => s.step === 3);
  const viewContent = mergeDefaultContent(type, record?.content ?? {});
  const totalSteps = 4;
  const effectiveType = record?.type ?? type;

  return (
    <MainLayout title={mapFormType(effectiveType)}>
      {contextHolder}
      <div className="space-y-6 pb-24">
        <PageHeader
          title={mapFormType(effectiveType)}
          subtitle={
            record
              ? `更新时间：${formatTime(record.updatedAt)}${
                  record.submittedAt ? ` · 提交时间：${formatTime(record.submittedAt)}` : ""
                }`
              : ""
          }
          extra={
            <div className="flex items-center gap-2">
              {record ? <StatusTag kind="status" value={record.status} /> : null}
              <Button onClick={() => navigate("/records")}>返回</Button>
            </div>
          }
        />

        <AppCard>
          <Steps
            current={step}
            onChange={async (v) => {
              if (readOnly) {
                setStep(v);
                return;
              }
              if (v <= step) {
                setStep(v);
                return;
              }
              try {
                for (let i = step; i < v; i++) {
                  await validateStep(i);
                }
                setStep(v);
              } catch {
                api.error("请先完成当前步骤的必填项");
              }
            }}
            items={[
              { title: "基础信息" },
              { title: "成绩与身体" },
              { title: "志愿条件" },
              { title: "备注" }
            ]}
          />
        </AppCard>

        {loading || !record ? (
          <AppCard>
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          </AppCard>
        ) : (
          readOnly ? (
            <FormContentView type={effectiveType} content={viewContent as any} step={step as any} />
          ) : (
            <Form form={form} layout="vertical">
              {step === 0 ? <FormStepOne sections={step0Sections} contentSnapshot={contentSnapshot} /> : null}
              {step === 1 ? <FormStepOne sections={step1Sections} contentSnapshot={contentSnapshot} /> : null}
              {step === 2 ? (
                <FormStepTwo
                  sections={step2Sections}
                  contentSnapshot={contentSnapshot}
                  majorCategories={majorCategories}
                />
              ) : null}
              {step === 3 ? <FormStepOne sections={step3Sections} contentSnapshot={contentSnapshot} /> : null}
            </Form>
          )
        )}
      </div>

      <StickyFormFooter
        left={
          <Button onClick={() => navigate("/records")} disabled={loading}>
            返回
          </Button>
        }
        onPrev={goPrev}
        onNext={goNext}
        onSave={saveDraft}
        onSubmit={submit}
        loadingSave={saving}
        loadingSubmit={submitting}
        currentStep={step}
        totalSteps={totalSteps}
        readonly={readOnly}
      />
    </MainLayout>
  );
}
