import { Descriptions } from "antd";

import type { FormContent, FormType, MajorPreferenceItem } from "../types";
import type { FieldDef, SectionDef } from "../utils/formSchema";
import { getFormSchema, getValueAtPath, normalizeVisible } from "../utils/formSchema";
import { FormSectionCard } from "./FormSectionCard";

function optionLabel(options: { label: string; value: any }[], value: any): string | null {
  const found = options.find((o) => o.value === value);
  return found ? found.label : null;
}

function toText(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined) return "-";
  const editor = field.editor;

  if (editor.type === "radio") {
    const label = optionLabel(editor.options, value);
    return label ?? String(value);
  }

  if (editor.type === "select") {
    if (Array.isArray(value)) {
      const mapped = value.map((v) => optionLabel(editor.options, v) ?? String(v));
      return mapped.length ? mapped.join("、") : "-";
    }
    const label = optionLabel(editor.options, value);
    return label ?? String(value);
  }

  if (editor.type === "checkboxGroup") {
    if (!Array.isArray(value)) return "-";
    return value.length ? value.join("、") : "-";
  }

  if (editor.type === "checkbox") {
    if (typeof value === "boolean") return value ? "是" : "否";
    return String(value);
  }

  if (typeof value === "string") return value || "-";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.length ? value.join("、") : "-";
  return JSON.stringify(value);
}

function getMajorPreferences(content: FormContent | undefined): MajorPreferenceItem[] {
  const list = (content as any)?.majorPreferences;
  if (Array.isArray(list)) return list as MajorPreferenceItem[];
  return [];
}

function splitByStep(schema: SectionDef[], step: number) {
  return schema.filter((s) => s.step === step);
}

export function FormContentView(props: { type: FormType; content: FormContent; step?: number }) {
  const schema = getFormSchema(props.type);
  const sections = props.step === undefined ? schema : splitByStep(schema, props.step);
  const majors = getMajorPreferences(props.content);

  return (
    <div className="space-y-4">
      {props.step === undefined || props.step === 2 ? (
        <FormSectionCard title="专业意向表格">
          <div className="space-y-2">
            {majors.length ? (
              majors.map((m, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-500">{idx + 1}.</span>
                  <span className="text-slate-900">{m.majorCategory || "-"}</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-slate-900">{m.majorName || "-"}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-600">未填写</div>
            )}
          </div>
        </FormSectionCard>
      ) : null}

      {sections.map((section) => {
        return (
          <FormSectionCard key={section.key} title={section.title} description={section.description}>
            <Descriptions size="small" column={2}>
              {section.fields
                .filter((f) => normalizeVisible(f.visibleWhen, props.content))
                .map((f) => (
                  <Descriptions.Item
                    key={f.name.join(".")}
                    label={f.label}
                    span={f.span === 2 ? 2 : 1}
                  >
                    {toText(f, getValueAtPath(props.content, f.name))}
                  </Descriptions.Item>
                ))}
            </Descriptions>
          </FormSectionCard>
        );
      })}
    </div>
  );
}
