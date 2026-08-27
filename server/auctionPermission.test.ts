import { describe, expect, it } from "vitest";
import { auctionRouter } from "./auctionRouter";

function context(user: null | { id: number; role: "user" | "admin" }) {
  return {
    user: user ? {
      id: user.id,
      openId: `auction-user-${user.id}`,
      email: `auction-${user.id}@example.invalid`,
      name: "Auction User",
      loginMethod: "test",
      role: user.role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { headers: {} },
    res: {},
  } as any;
}

describe("auction procedure permissions", () => {
  it("rejects unauthenticated list access before database work", async () => {
    const caller = auctionRouter.createCaller(context(null));
    await expect(caller.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated create and update before database work", async () => {
    const caller = auctionRouter.createCaller(context(null));
    await expect(caller.create({ productName: "x", auctionDate: "2026-08-27" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.update({ id: 1, note: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated original-file imports before parsing or storage", async () => {
    const caller = auctionRouter.createCaller(context(null));
    await expect(caller.importBatch({
      sourceFileName: "auction.xlsx",
      sourceFileSha256: "0".repeat(64),
      sourceFileBase64: "AAAA",
      sourceFileSize: 3,
      sourceMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fallbackDate: "2026-08-28",
      liverName: "主播",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("keeps schema health restricted to administrators", async () => {
    const caller = auctionRouter.createCaller(context({ id: 1, role: "user" }));
    await expect(caller.schemaHealth()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
