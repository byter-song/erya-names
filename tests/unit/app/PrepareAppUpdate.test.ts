import { describe, expect, it, vi } from "vitest";
import { PrepareAppUpdate } from "../../../src/application/use-cases/PrepareAppUpdate";

describe("PrepareAppUpdate", () => {
  it("flushes every durable writer before allowing refresh", async () => {
    const first = { flush: vi.fn().mockResolvedValue(undefined) };
    const second = { flush: vi.fn().mockResolvedValue(undefined) };

    await expect(new PrepareAppUpdate([first, second]).execute()).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(first.flush).toHaveBeenCalledOnce();
    expect(second.flush).toHaveBeenCalledOnce();
  });

  it("blocks refresh when a durable writer cannot flush", async () => {
    const result = await new PrepareAppUpdate([
      { flush: vi.fn().mockRejectedValue(new Error("draft-write-failed")) },
    ]).execute();

    expect(result).toEqual({ ok: false, error: "draft-write-failed" });
  });
});
