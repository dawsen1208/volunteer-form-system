import type { ReactNode } from "react";

import { AppCard } from "../components/AppCard";

type Props = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  bottom?: ReactNode;
};

export function AuthLayout(props: Props) {
  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{props.title}</h1>
          {props.subtitle ? (
            <p className="mt-1 text-sm text-slate-600">{props.subtitle}</p>
          ) : null}
        </div>
        <AppCard>{props.children}</AppCard>
        {props.bottom ? <div>{props.bottom}</div> : null}
      </div>
    </div>
  );
}
