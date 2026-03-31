import type { ReactNode } from "react";

import { AppCard } from "./AppCard";

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function FormSectionCard(props: Props) {
  return (
    <AppCard className="space-y-3">
      <div>
        <div className="text-base font-semibold text-slate-900">{props.title}</div>
        {props.description ? (
          <div className="mt-1 text-sm text-slate-600">{props.description}</div>
        ) : null}
      </div>
      <div>{props.children}</div>
    </AppCard>
  );
}

