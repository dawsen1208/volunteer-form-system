import { Button, Form, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { FormType } from "../types";
import { findMajorCategoryByName, getMajorCatalog, isMajorInCategory } from "../utils/majorCatalog";

type Props = {
  type: FormType;
  categories: readonly string[];
  maxRows?: number;
  readonly?: boolean;
};

type Row = {
  index: number;
  majorCategory?: string;
  majorName?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function encodeMajorValue(majorName: string, majorCategory: string) {
  return `${majorName}@@${majorCategory}`;
}

function decodeMajorValue(value: string): { majorName: string; majorCategory: string } | undefined {
  const raw = normalizeText(value);
  if (!raw) return undefined;
  const idx = raw.lastIndexOf("@@");
  if (idx <= 0 || idx >= raw.length - 2) return undefined;
  return {
    majorName: raw.slice(0, idx),
    majorCategory: raw.slice(idx + 2)
  };
}

export function MajorPreferenceTable(props: Props) {
  const maxRows = props.maxRows ?? 20;
  const catalog = getMajorCatalog(props.type);

  const columns: ColumnsType<Row> = [
    {
      title: "序",
      dataIndex: "index",
      width: 60,
      render: (_value, _record, rowIndex) => rowIndex + 1
    },
    {
      title: "专业大类",
      dataIndex: "majorCategory",
      render: (_value, _record, rowIndex) => (
        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue, setFieldValue }) => {
            const majorCategoryPath = ["majorPreferences", rowIndex, "majorCategory"];
            const majorNamePath = ["majorPreferences", rowIndex, "majorName"];
            const currentCategory = normalizeText(getFieldValue(majorCategoryPath));
            const currentMajorName = normalizeText(getFieldValue(majorNamePath));

            return (
              <Form.Item name={majorCategoryPath} className="mb-0">
                <Select
                  placeholder="请选择"
                  options={props.categories.map((c) => ({ label: c, value: c }))}
                  allowClear
                  disabled={props.readonly}
                  onChange={(next) => {
                    const nextCategory = normalizeText(next);
                    if (!nextCategory) {
                      setFieldValue(majorNamePath, "");
                      return;
                    }
                    if (currentMajorName && !isMajorInCategory(props.type, nextCategory, currentMajorName)) {
                      setFieldValue(majorNamePath, "");
                    }
                  }}
                />
              </Form.Item>
            );
          }}
        </Form.Item>
      )
    },
    {
      title: "具体专业",
      dataIndex: "majorName",
      render: (_value, _record, rowIndex) => (
        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue, setFieldValue }) => {
            const majorCategoryPath = ["majorPreferences", rowIndex, "majorCategory"];
            const majorNamePath = ["majorPreferences", rowIndex, "majorName"];
            const currentCategory = normalizeText(getFieldValue(majorCategoryPath));

            const options = currentCategory
              ? (catalog[currentCategory] ?? []).map((m) => ({ label: m, value: m }))
              : Object.entries(catalog).flatMap(([cat, majors]) =>
                  (majors ?? []).map((m) => ({
                    label: `${m}（${cat}）`,
                    value: encodeMajorValue(m, cat)
                  }))
                );

            return (
              <Form.Item
                name={majorNamePath}
                className="mb-0"
                getValueProps={(value) => {
                  const stored = normalizeText(value);
                  if (!stored) return { value: undefined };
                  if (currentCategory) return { value: stored };
                  const cat = normalizeText(findMajorCategoryByName(props.type, stored));
                  return cat ? { value: encodeMajorValue(stored, cat) } : { value: undefined };
                }}
                getValueFromEvent={(value) => {
                  const v = normalizeText(value);
                  if (!v) return "";
                  if (currentCategory) return v;
                  const decoded = decodeMajorValue(v);
                  return decoded ? decoded.majorName : v;
                }}
              >
                <Select
                  placeholder="请选择/搜索"
                  showSearch
                  allowClear
                  disabled={props.readonly}
                  options={options}
                  filterOption={(input, option) => {
                    const q = normalizeText(input).toLowerCase();
                    if (!q) return true;
                    const label = String(option?.label ?? "").toLowerCase();
                    return label.includes(q);
                  }}
                  onChange={(next) => {
                    const v = normalizeText(next);
                    if (!v) {
                      return;
                    }

                    if (currentCategory) {
                      return;
                    }

                    const decoded = decodeMajorValue(v);
                    if (!decoded) {
                      const cat = findMajorCategoryByName(props.type, v);
                      if (cat) setFieldValue(majorCategoryPath, cat);
                      return;
                    }

                    setFieldValue(majorCategoryPath, decoded.majorCategory);
                  }}
                />
              </Form.Item>
            );
          }}
        </Form.Item>
      )
    },
    {
      title: "操作",
      width: 90,
      render: (_value, _record, rowIndex) => (
        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue, setFieldValue }) => {
            const rows = (getFieldValue("majorPreferences") as Row[] | undefined) ?? [];
            return (
              <Button
                danger
                type="link"
                disabled={props.readonly || rows.length <= 1}
                onClick={() => {
                  const next = rows.filter((_, i) => i !== rowIndex);
                  setFieldValue("majorPreferences", next);
                }}
              >
                删除
              </Button>
            );
          }}
        </Form.Item>
      )
    }
  ];

  return (
    <Form.Item shouldUpdate noStyle>
      {({ getFieldValue, setFieldValue }) => {
        const rows = (getFieldValue("majorPreferences") as Row[] | undefined) ?? [];
        return (
          <div className="space-y-3">
            <Table<Row>
              rowKey={(_, idx) => String(idx)}
              dataSource={rows.length ? rows : Array.from({ length: 10 }).map((_, i) => ({ index: i + 1 }))}
              columns={columns}
              pagination={false}
              size="small"
            />
            <div>
              <Button
                onClick={() => {
                  const current = rows.length ? rows : Array.from({ length: 10 }).map((_, i) => ({ index: i + 1 }));
                  if (current.length >= maxRows) return;
                  setFieldValue("majorPreferences", [...current, { index: current.length + 1 }]);
                }}
                disabled={props.readonly || (rows.length ? rows.length : 10) >= maxRows}
              >
                新增一行
              </Button>
              <span className="ml-2 text-xs text-slate-500">最多 {maxRows} 行</span>
            </div>
          </div>
        );
      }}
    </Form.Item>
  );
}
