import { describe, expect, it } from "vitest";
import { liverRouter } from "./liverRouter";

function unauthenticatedCaller() {
  return liverRouter.createCaller({
    user: null,
    req: {
      headers: {},
      cookies: {},
    },
    res: {},
  } as never);
}

describe("liver ad effect permissions", () => {
  it("rejects anonymous dashboard access", async () => {
    await expect(unauthenticatedCaller().adEffectDashboard({ yearMonth: "2026-08" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects anonymous ad cost updates", async () => {
    await expect(unauthenticatedCaller().updateLivestreamAdCost({
      livestreamId: 1,
      adStatus: "paid",
      adCost: 1000,
    })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
