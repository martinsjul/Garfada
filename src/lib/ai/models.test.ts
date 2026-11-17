import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { BUSY_MESSAGE, QUOTA_MESSAGE, friendlyError, withModelFallback } from "./models";

const perMinute = { status: 429, message: "Quota exceeded ... GenerateRequestsPerMinutePerProjectPerModel-FreeTier ... Please retry in 39.4s." };
const perDay = { status: 429, message: "Quota exceeded ... GenerateRequestsPerDayPerProjectPerModel-FreeTier" };

describe("friendlyError", () => {
  it("diferencia limite por minuto de limite diário", () => {
    expect(friendlyError(perMinute)).toBe(BUSY_MESSAGE);
    expect(friendlyError(perDay)).toBe(QUOTA_MESSAGE);
  });
});

describe("withModelFallback", () => {
  it("troca de modelo quando o limite por minuto estoura (cota é por modelo)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValueOnce(perMinute).mockResolvedValueOnce("ok");
    await expect(withModelFallback(["a", "b"], fn)).resolves.toBe("ok");
    expect(fn.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });

  it("limite diário também tenta o próximo modelo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fn = vi.fn().mockRejectedValueOnce(perDay).mockResolvedValueOnce("ok");
    await expect(withModelFallback(["a", "b"], fn)).resolves.toBe("ok");
  });

  it("erro comum não troca de modelo", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withModelFallback(["a", "b"], fn)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
