import type { PropsWithChildren } from "react";

export function Status({ children }: PropsWithChildren) {
  return <span className="ui-status">{children}</span>;
}
