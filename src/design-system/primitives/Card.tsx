import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <section {...props} className={`paper-card ${props.className ?? ""}`.trim()}>
      {children}
    </section>
  );
}
