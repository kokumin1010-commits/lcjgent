import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createStaffContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 901,
    openId: "line-history-non-admin",
    email: "staff@example.com",
    name: "LINE history staff",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { origin: "https://localhost:3000" },
    } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("LINE management authorization", () => {
  it("rejects non-admin user enumeration before any LINE data is returned", async () => {
    const caller = appRouter.createCaller(createStaffContext());
    await expect(caller.line.listUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.line.listLiverLinkedUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects non-admin communication and AI execution history reads", async () => {
    const caller = appRouter.createCaller(createStaffContext());
    await expect(caller.line.listMessages({
      lineUserId: "U00000000000000000000000000000000",
      limit: 50,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.line.getAiManagerHistory({
      lineUserId: "U00000000000000000000000000000000",
      limit: 50,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.line.getGroupAiInsight({
      lineGroupId: "C00000000000000000000000000000000",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.line.analyzeGroupConversation({
      lineGroupId: "C00000000000000000000000000000000",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.line.generateGroupMessageDraft({
      lineGroupId: "C00000000000000000000000000000000",
      currentDraft: "この文を整えてください",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.line.sendMessage({
      to: "C00000000000000000000000000000000",
      message: "権限テスト",
      requestId: "00000000-0000-4000-8000-000000000001",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
