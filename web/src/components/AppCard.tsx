import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function AppCard(props: Props) {
  return (
    <div
      className={[
        "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5",
        props.className ?? ""
      ].join(" ")}
    >
      {props.children}
    </div>
  );
}

