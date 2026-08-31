import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

const mocks = vi.hoisted(() => {
  const sendEmailMock = vi.fn();
  const poolQueryMock = vi.fn(async () => [[]]);
  const connectionQueryMock = vi.fn();
  const releaseMock = vi.fn();
  const getConnectionMock = vi.fn(async () => ({ query: connectionQueryMock, release: releaseMock }));
  return { sendEmailMock, poolQueryMock, connectionQueryMock, releaseMock, getConnectionMock };
});

vi.mock("./emailService", () => ({
  sendEmail: mocks.sendEmailMock,
}));
vi.mock("./selectionCenterRouter", () => ({
  getPool: () => ({ query: mocks.poolQueryMock, getConnection: mocks.getConnectionMock }),
}));
vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,aGVsbG8=") },
}));

import {
  __resetFestivalApplicationEmailSchemaForTests,
  buildCompanyApplicationReceiptMessage,
  sendCompanyApplicationReceipt,
} from "./festivalApplicationEmail";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const input = {
  applicationId: 42,
  email: "Maker@example.com",
  companyName: "Example <Maker>",
  contactName: "担当 <太郎>",
  ticketId: "LCF-TEST42",
  source: "application" as const,
};

function mockConnection(existing: any[] = []) {
  mocks.connectionQueryMock.mockImplementation(async (sql: string) => {
    if (sql.includes("GET_LOCK")) return [[{ acquired: 1 }]];
    if (sql.includes("SELECT status, provider")) return [existing];
    return [[]];
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetFestivalApplicationEmailSchemaForTests();
  mocks.poolQueryMock.mockResolvedValue([[]]);
  mockConnection([]);
});

describe("Festival company application receipt email", () => {
  it("explains receipt, QR ticket and the three-business-day next step without leaking HTML", async () => {
    const message = await buildCompanyApplicationReceiptMessage(input);
    expect(message.to).toEqual(["maker@example.com"]);
    expect(message.subject).toContain("LCF-C-000042");
    expect(message.content).toContain("3営業日以内");
    expect(message.content).toContain("次の手順または確認事項");
    expect(message.content).toContain("info@livecommercejapan.jp");
    expect(message.html).toContain("Example &lt;Maker&gt;");
    expect(message.html).not.toContain("Example <Maker>");
    expect(message.attachments).toEqual([
      expect.objectContaining({ filename: "lcf-2026-ticket.png", cid: "lcf-company-ticket", contentType: "image/png" }),
    ]);
  });

  it("records a successful first attempt and only stores a recipient hash plus domain", async () => {
    mocks.sendEmailMock.mockResolvedValue({ success: true, provider: "aliyun", messageId: "message-1" });
    const result = await sendCompanyApplicationReceipt(input);
    expect(result).toMatchObject({ success: true, auditStatus: "accepted", alreadyAccepted: false, attemptCount: 1 });
    expect(mocks.sendEmailMock).toHaveBeenCalledTimes(1);
    const insertCall = mocks.connectionQueryMock.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO festival_application_email_deliveries"));
    expect(insertCall).toBeTruthy();
    const values = insertCall?.[1] as unknown[];
    expect(values).not.toContain(input.email);
    expect(values?.[3]).toBe("example.com");
    expect(String(values?.[2])).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not send twice after the same application receipt was already accepted", async () => {
    mockConnection([{ status: "accepted", provider: "aliyun", messageId: "message-1", errorCode: null, attemptCount: 1 }]);
    const result = await sendCompanyApplicationReceipt({ ...input, source: "duplicate_submission" });
    expect(result).toMatchObject({ success: true, auditStatus: "accepted", alreadyAccepted: true, attemptCount: 1 });
    expect(mocks.sendEmailMock).not.toHaveBeenCalled();
  });

  it("keeps a failed attempt retryable with a safe error code", async () => {
    mockConnection([{ status: "failed", provider: "aliyun", messageId: null, errorCode: "EAUTH", attemptCount: 1 }]);
    mocks.sendEmailMock.mockResolvedValue({ success: false, provider: "gmail", errorCode: "ETIMEDOUT", error: "ETIMEDOUT" });
    const result = await sendCompanyApplicationReceipt({ ...input, source: "admin_retry" });
    expect(result).toMatchObject({ success: false, auditStatus: "failed", alreadyAccepted: false, attemptCount: 2, errorCode: "ETIMEDOUT" });
    expect(mocks.sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a concurrent duplicate while another delivery owns the lock", async () => {
    mocks.connectionQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("GET_LOCK")) return [[{ acquired: 0 }]];
      return [[]];
    });
    const result = await sendCompanyApplicationReceipt(input);
    expect(result).toMatchObject({ success: false, auditStatus: "failed", errorCode: "DELIVERY_BUSY" });
    expect(mocks.sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("Festival company email integration", () => {
  it("routes company submission through the unified auditable service", () => {
    const router = read("server/festivalRouter.ts");
    expect(router).toContain("sendCompanyApplicationReceipt");
    expect(router).toContain("source: 'application'");
    expect(router).toContain("source: 'duplicate_submission'");
    expect(router).toContain("retryCompanyApplicationEmail: festivalAdminProcedure");
    expect(router).toContain("getCompanyApplicationEmailStatuses");
    const submitCompanySection = router.split("submitCompany: publicProcedure")[1]?.split("submitLiver: publicProcedure")[0] || "";
    expect(submitCompanySection).not.toContain("sendTicketEmail(");
  });

  it("shows an explicit applicant-facing result and admin single-send status", () => {
    const apply = read("client/src/pages/FestivalApplyCompany.tsx");
    const admin = read("client/src/pages/LcfAdmin.tsx");
    expect(apply).toContain("申込受付完了メール（QRコード・今後の流れ）を送信しました。");
    expect(apply).toContain("担当者より受付後3営業日以内に、次の手順または確認事項をご連絡いたします。");
    expect(admin).toContain("旧申込・送信記録なし");
    expect(admin).toContain("単件送信");
    expect(admin).toContain("retryCompanyApplicationEmail.mutate({ applicationId: item.id })");
    expect(admin).not.toContain("retryCompanyApplicationEmail.mutate({ applicationIds:");
  });

  it("keeps the migration and schema idempotency key aligned", () => {
    const migration = read("drizzle/0129_festival_application_email_delivery.sql");
    const schema = read("drizzle/festivalSchema.ts");
    expect(migration).toContain("uk_festival_application_email_purpose");
    expect(schema).toContain("applicationPurposeUnique");
    expect(schema).toContain("recipientHash");
    expect(schema).not.toContain("recipientEmail: varchar");
  });
});
