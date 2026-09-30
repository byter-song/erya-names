import type { DurableWriter } from "../../application/ports/DurableWriter";

export const ONBOARDING_DRAFT_KEY = "erya-names:onboarding-draft:v1";

export class LocalDraftWriter implements DurableWriter {
  async flush(): Promise<void> {
    const probeKey = "erya-names:durable-write-probe";
    localStorage.setItem(probeKey, "ok");
    localStorage.removeItem(probeKey);
  }
}
