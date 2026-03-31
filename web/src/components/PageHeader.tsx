import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
};

export function PageHeader(props: Props) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{props.title}</h1>
        {props.subtitle ? (
          <p className="mt-1 text-sm text-slate-600">{props.subtitle}</p>
        ) : null}
      </div>
      {props.extra ? <div className="shrink-0">{props.extra}</div> : null}
    </div>
  );
}

