import { createContext, type PropsWithChildren, useContext } from "react";
import type { ApplicationContainer } from "../infrastructure/container";

const ApplicationContext = createContext<ApplicationContainer | null>(null);

export function ApplicationProviders({
  children,
  container,
}: PropsWithChildren<{ container: ApplicationContainer }>) {
  return (
    <ApplicationContext.Provider value={container}>{children}</ApplicationContext.Provider>
  );
}

export function useApplicationContainer(): ApplicationContainer {
  const container = useContext(ApplicationContext);
  if (!container) {
    throw new Error("ApplicationProviders is missing");
  }
  return container;
}
