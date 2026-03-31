import { Checkbox, Form, Input, InputNumber, Radio, Select } from "antd";
import type { ReactNode } from "react";

import type { FieldDef, SectionDef } from "../utils/formSchema";
import { normalizeRequired, normalizeVisible } from "../utils/formSchema";
import { FormSectionCard } from "./FormSectionCard";

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
  if (editor.type === "checkboxGroup") return <Checkbox.Group options={editor.options} />;
  return null;
}

export function FormSchemaSection(props: Props) {
  const fields = props.section.fields;

  return (
    <FormSectionCard title={props.section.title} description={props.section.description}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((field) => {
          const visible = normalizeVisible(field.visibleWhen, props.contentSnapshot);
          if (!visible) return null;

          const isCheckbox = field.editor.type === "checkbox";
          const isRequired = Boolean(field.required || normalizeRequired(field.requiredWhen, props.contentSnapshot));
          const rules = isRequired ? [{ required: true, message: `请输入${field.label}` }] : undefined;
          const className = field.span === 2 ? "md:col-span-2" : undefined;

          return (
            <Form.Item
              key={field.name.join(".")}
              label={isCheckbox ? undefined : field.label}
              name={field.name as any}
              rules={rules as any}
              valuePropName={isCheckbox ? "checked" : undefined}
              className={className}
            >
              {renderEditor(field)}
            </Form.Item>
          );
        })}
      </div>
    </FormSectionCard>
  );
}
