import { describe, expect, it } from "vitest";
import { createBoothQrToken, verifyBoothQrToken } from "./boothReservationRouter";

describe("LCF booth QR tokens", () => {
  it("creates a stable high-entropy token bound to one booth", () => {
    const token = createBoothQrToken("T1");
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(createBoothQrToken("T1")).toBe(token);
    expect(createBoothQrToken("T2")).not.toBe(token);
  });

  it("rejects tampering and cross-booth reuse", () => {
    const token = createBoothQrToken("T13");
    expect(verifyBoothQrToken("T13", token)).toBe(true);
    expect(verifyBoothQrToken("T14", token)).toBe(false);
    expect(verifyBoothQrToken("T13", `${token.slice(0, -1)}x`)).toBe(false);
    expect(verifyBoothQrToken("INVALID", token)).toBe(false);
  });
});
