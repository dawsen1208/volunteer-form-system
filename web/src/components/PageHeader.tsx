import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  extra?: ReactNode;
};

export function PageHeader(props: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-xl font-semibold text-slate-900">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="mt-1 break-words text-sm text-slate-600">{props.subtitle}</p>
        ) : null}
      </div>
      {props.extra ? <div className="w-full sm:w-auto">{props.extra}</div> : null}
    </div>
  );
}
