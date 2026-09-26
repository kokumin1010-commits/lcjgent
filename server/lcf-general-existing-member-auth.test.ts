import { describe, expect, it, vi } from "vitest";
import { requireAuthenticatedExistingMemberForSecondEdition } from "./festivalRouter";

function buildDb(existingAccounts: Array<{ id: number }>) {
  const limit = vi.fn().mockResolvedValue(existingAccounts);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select } as any, select, from, where, limit };
}

describe("LCF edition-two existing-member authorization", () => {
  it("preserves first-edition public general applications without an account lookup", async () => {
    const { db, select } = buildDb([{ id: 1 }]);
    const verifyRequest = vi.fn();

    await expect(requireAuthenticatedExistingMemberForSecondEdition({
      db,
      req: {},
      email: "member@example.com",
      edition: 1,
      verifyRequest,
    })).resolves.toBeUndefined();

    expect(select).not.toHaveBeenCalled();
    expect(verifyRequest).not.toHaveBeenCalled();
  });

  it("keeps edition-two registration public for a genuinely new email", async () => {
    const { db } = buildDb([]);
    const verifyRequest = vi.fn();

    await expect(requireAuthenticatedExistingMemberForSecondEdition({
      db,
      req: {},
      email: "new@example.com",
      edition: 2,
      verifyRequest,
    })).resolves.toBeUndefined();

    expect(verifyRequest).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request for an existing email before duplicate or ticket access", async () => {
    const { db } = buildDb([{ id: 42 }]);
    const verifyRequest = vi.fn().mockResolvedValue(null);

    await expect(requireAuthenticatedExistingMemberForSecondEdition({
      db,
      req: { headers: {} },
      email: "member@example.com",
      edition: 2,
      verifyRequest,
    })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "既存会員の方は、登録済みパスワードで本人確認してからお申し込みください",
    });
  });

  it("rejects a logged-in account whose email does not match", async () => {
    const { db } = buildDb([{ id: 42 }]);
    const verifyRequest = vi.fn().mockResolvedValue({ email: "other@example.com" });

    await expect(requireAuthenticatedExistingMemberForSecondEdition({
      db,
      req: { headers: {} },
      email: "member@example.com",
      edition: 2,
      verifyRequest,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("accepts the authenticated matching account case-insensitively", async () => {
    const { db } = buildDb([{ id: 42 }]);
    const verifyRequest = vi.fn().mockResolvedValue({ email: "  MEMBER@Example.COM  " });

    await expect(requireAuthenticatedExistingMemberForSecondEdition({
      db,
      req: { headers: {} },
      email: "member@example.com",
      edition: 2,
      verifyRequest,
    })).resolves.toBeUndefined();
  });
});
