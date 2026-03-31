import { Button, Form, Input, Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";

type Props = {
  categories: readonly string[];
  maxRows?: number;
  readonly?: boolean;
};

type Row = {
  index: number;
  majorCategory?: string;
  majorName?: string;
};

export function MajorPreferenceTable(props: Props) {
  const maxRows = props.maxRows ?? 20;

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
        <Form.Item name={["majorPreferences", rowIndex, "majorCategory"]} className="mb-0">
          <Select
            placeholder="请选择"
            options={props.categories.map((c) => ({ label: c, value: c }))}
            allowClear
            disabled={props.readonly}
          />
        </Form.Item>
      )
    },
    {
      title: "具体专业",
      dataIndex: "majorName",
      render: (_value, _record, rowIndex) => (
        <Form.Item name={["majorPreferences", rowIndex, "majorName"]} className="mb-0">
          <Input placeholder="请输入" disabled={props.readonly} />
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
