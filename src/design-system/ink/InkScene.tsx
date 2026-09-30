import type { PropsWithChildren } from "react";
import "./ink-scene.css";

export function InkScene({ children }: PropsWithChildren) {
  return (
    <div className="ink-scene" data-testid="ink-scene">
      <div aria-hidden="true" className="ink-scene__layers" data-testid="ink-depth-layers">
        <span className="ink-scene__paper-grain" />
        <span className="ink-scene__cloud ink-scene__cloud--top" />
        <span className="ink-scene__cloud ink-scene__cloud--bottom" />
        <span className="ink-scene__orbit" />
        <span aria-hidden="true" className="ink-scene__opening-brush" />
        <span className="ink-scene__static-ink" />
      </div>
      <div className="ink-scene__content">{children}</div>
    </div>
  );
}
