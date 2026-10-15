import type { PropsWithChildren } from "react";
import "./ink-scene.css";

export function InkScene({ children }: PropsWithChildren) {
  return (
    <div className="ink-scene" data-testid="ink-scene">
      <div className="ink-scene__ambient" aria-hidden="true" />
      <div className="ink-scene__content">{children}</div>
    </div>
  );
}