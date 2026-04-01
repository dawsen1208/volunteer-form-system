import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select } from "antd";
import type { ReactNode } from "react";
import dayjs from "dayjs";

import type { FieldDef, SectionDef } from "../utils/formSchema";
import { normalizeRequired, normalizeVisible } from "../utils/formSchema";
import { FormSectionCard } from "./FormSectionCard";

type SubjectSelectionEditorProps = {
  fixed: string[];
  optional: string[];
  maxOptional: number;
  value?: string[];
  onChange?: (value: string[]) => void;
};

function SubjectSelectionEditor(props: SubjectSelectionEditorProps) {
  const selected = Array.isArray(props.value) ? props.value : [];
  const fixedSet = new Set(props.fixed);
  const optionalSelected = selected.filter((s) => props.optional.includes(s)).slice(0, props.maxOptional);

  const optionalOptions = props.optional.map((o) => ({
    label: o,
    value: o,
    disabled: !optionalSelected.includes(o) && optionalSelected.length >= props.maxOptional
  }));

  return (
    <div className="space-y-2">
      <Checkbox.Group
        value={[...new Set([...props.fixed, ...optionalSelected])]}
        options={[...props.fixed.map((s) => ({ label: s, value: s, disabled: true })), ...optionalOptions]}
        onChange={(next) => {
          const arr = Array.isArray(next) ? (next as string[]) : [];
          const normalizedOptional = arr.filter((s) => props.optional.includes(s)).slice(0, props.maxOptional);
          const normalized = [...props.fixed, ...normalizedOptional];
          props.onChange?.(normalized);
        }}
      />
      <div className="text-xs text-slate-500">
        固定科目：{props.fixed.join("、")}；其余科目最多选择 {props.maxOptional} 项
      </div>
    </div>
  );
}

type ProvinceOrderSelectProps = {
  options: { label: string; value: any }[];
  value?: string[];
  onChange?: (value: string[]) => void;
};

function ProvinceOrderSelect(props: ProvinceOrderSelectProps) {
  const selected: string[] = Array.isArray(props.value) ? (props.value as string[]) : [];

  function move(from: number, to: number) {
    const next = [...selected];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    props.onChange?.(next);
  }

  return (
    <div className="space-y-2">
      <Select
        placeholder="请选择"
        mode="multiple"
        options={props.options}
        allowClear
        value={selected}
        onChange={(v) => props.onChange?.(Array.isArray(v) ? (v as string[]) : [])}
      />
      {selected.length ? (
        <div className="space-y-2 rounded-md border border-slate-200 p-3">
          <div className="text-xs font-medium text-slate-700">已选省份排序（从上到下）</div>
          <div className="space-y-2">
            {selected.map((p, idx) => (
              <div key={`${p}-${idx}`} className="flex items-center gap-2">
                <div className="flex-1 text-sm text-slate-900">
                  {idx + 1}. {p}
                </div>
                <Button size="small" disabled={idx === 0} onClick={() => move(idx, idx - 1)}>
                  上移
                </Button>
                <Button
                  size="small"
                  disabled={idx === selected.length - 1}
                  onClick={() => move(idx, idx + 1)}
                >
                  下移
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  section: SectionDef;
  contentSnapshot: any;
  extraTopRight?: ReactNode;
};

function renderEditor(field: FieldDef) {
  const editor = field.editor;
  if (editor.type === "input") return <Input placeholder={editor.placeholder} />;
  if (editor.type === "textarea") return <Input.TextArea placeholder={editor.placeholder} rows={editor.rows ?? 3} />;
  if (editor.type === "number") return <InputNumber placeholder={editor.placeholder} className="w-full" />;
  if (editor.type === "date")
    return (
      <DatePicker
        className="w-full"
        placeholder={editor.placeholder ?? "请选择"}
        format="YYYY-MM-DD"
        allowClear
      />
    );
  if (editor.type === "radio") return <Radio.Group options={editor.options} />;
  if (editor.type === "select")
    return (
      <Select
        placeholder="请选择"
        mode={editor.mode}
        options={editor.options}
        allowClear
      />
    );
  if (editor.type === "checkbox") return <Checkbox>{editor.label}</Checkbox>;
  if (editor.type === "checkboxGroup") return <Checkbox.Group options={Array.isArray(editor.options) ? editor.options : []} />;
  return null;
}

export function FormSchemaSection(props: Props) {
  const fields = props.section.fields;

  function renderField(field: FieldDef) {
    const editor = field.editor;

    if (editor.type === "checkboxGroup" && typeof editor.options === "function") {
      const options = editor.options(props.contentSnapshot);
      return <Checkbox.Group options={options} />;
    }

    if (editor.type === "subjectSelection") {
      return (
        <SubjectSelectionEditor
          fixed={editor.fixed}
          optional={editor.optional}
          maxOptional={editor.maxOptional}
        />
      );
    }

    if (
      editor.type === "select" &&
      editor.mode === "multiple" &&
      field.name.length === 1 &&
      field.name[0] === "intendedProvinces"
    ) {
      return <ProvinceOrderSelect options={editor.options} />;
    }

    return renderEditor(field);
  }

  return (
    <FormSectionCard title={props.section.title} description={props.section.description}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const visible = normalizeVisible(field.visibleWhen, props.contentSnapshot);
          if (!visible) return null;

          const isCheckbox = field.editor.type === "checkbox";
          const isRequired = Boolean(field.required || normalizeRequired(field.requiredWhen, props.contentSnapshot));
          const messagePrefix =
            field.editor.type === "select" || field.editor.type === "radio" || field.editor.type === "checkboxGroup" || field.editor.type === "subjectSelection"
              ? "请选择"
              : "请输入";
          const rules = isRequired ? [{ required: true, message: `${messagePrefix}${field.label}` }] : undefined;
          const className = field.span === 2 ? "md:col-span-2" : undefined;

          const isDate = field.editor.type === "date";
          const dateRules = isRequired ? [{ required: true, message: `请选择${field.label}` }] : undefined;

          return (
            <Form.Item
              key={field.name.join(".")}
              label={isCheckbox ? undefined : field.label}
              name={field.name as any}
              rules={(isDate ? dateRules : rules) as any}
              valuePropName={isCheckbox ? "checked" : undefined}
              className={className}
              getValueProps={
                isDate
                  ? (value: any) => ({ value: value ? dayjs(String(value), "YYYY-MM-DD") : null })
                  : undefined
              }
              getValueFromEvent={
                isDate
                  ? (v: any) => {
                      if (!v) return "";
                      if (typeof v.format === "function") return v.format("YYYY-MM-DD");
                      return "";
                    }
                  : undefined
              }
            >
              {renderField(field)}
            </Form.Item>
          );
        })}
      </div>
    </FormSectionCard>
  );
}
