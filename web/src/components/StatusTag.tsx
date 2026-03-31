import { Tag } from "antd";

import type { AuthRole, FormStatus } from "../types";
import { mapFormStatus, mapRole } from "../utils/mapping";

type Props =
  | { kind: "role"; value: AuthRole }
  | { kind: "status"; value: FormStatus };

export function StatusTag(props: Props) {
  if (props.kind === "role") {
    const color = props.value === "admin" ? "gold" : "blue";
    return <Tag color={color}>{mapRole(props.value)}</Tag>;
  }

  const color = props.value === "submitted" ? "green" : "default";
  return <Tag color={color}>{mapFormStatus(props.value)}</Tag>;
}

