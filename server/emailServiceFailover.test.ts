import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createTransportMock } = vi.hoisted(() => ({
  createTransportMock: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import { getEmailProviderConfiguration, sendEmail } from "./emailService";

const envKeys = ["EMAIL_USER", "EMAIL_PASSWORD", "EMAIL_SMTP_HOST", "EMAIL_SMTP_PORT", "EMAIL_SMTP_SECURE", "SMTP_USER", "SMTP_PASS"] as const;
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

function setProviderEnv() {
  process.env.EMAIL_USER = "enterprise@example.test";
  process.env.EMAIL_PASSWORD = "enterprise-secret";
  process.env.SMTP_USER = "backup@example.test";
  process.env.SMTP_PASS = "backup-secret";
}

function smtpError(code: string) {
  return Object.assign(new Error(code), { code, command: "AUTH" });
}

describe("email service provider failover", () => {
  beforeEach(() => {
    createTransportMock.mockReset();
    for (const key of envKeys) delete process.env[key];
  });

  afterEach(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
  });

  it("uses enterprise SMTP first and returns an auditable message id", async () => {
    setProviderEnv();
    const enterpriseSend = vi.fn().mockResolvedValue({ messageId: "enterprise-message-id" });
    const gmailSend = vi.fn().mockResolvedValue({ messageId: "gmail-message-id" });
    createTransportMock
      .mockReturnValueOnce({ sendMail: enterpriseSend })
      .mockReturnValueOnce({ sendMail: gmailSend });

    const result = await sendEmail({ to: ["recipient@example.test"], subject: "subject", content: "plain text" });

    expect(result).toEqual({ success: true, provider: "aliyun", messageId: "enterprise-message-id" });
    expect(enterpriseSend).toHaveBeenCalledTimes(1);
    expect(gmailSend).not.toHaveBeenCalled();
    expect(createTransportMock.mock.calls[0][0]).toMatchObject({ auth: { user: "enterprise@example.test" } });
  });

  it("falls back to Gmail only when enterprise transport or authentication fails", async () => {
    setProviderEnv();
    const enterpriseSend = vi.fn().mockRejectedValue(smtpError("EAUTH"));
    const gmailSend = vi.fn().mockResolvedValue({ messageId: "fallback-message-id" });
    createTransportMock
      .mockReturnValueOnce({ sendMail: enterpriseSend })
      .mockReturnValueOnce({ sendMail: gmailSend });

    const result = await sendEmail({ to: ["recipient@example.test"], subject: "subject", content: "plain text" });

    expect(result).toEqual({ success: true, provider: "gmail", messageId: "fallback-message-id" });
    expect(enterpriseSend).toHaveBeenCalledTimes(1);
    expect(gmailSend).toHaveBeenCalledTimes(1);
  });

  it("does not send a duplicate through Gmail when the message itself is rejected", async () => {
    setProviderEnv();
    const enterpriseSend = vi.fn().mockRejectedValue(smtpError("EENVELOPE"));
    const gmailSend = vi.fn().mockResolvedValue({ messageId: "must-not-send" });
    createTransportMock
      .mockReturnValueOnce({ sendMail: enterpriseSend })
      .mockReturnValueOnce({ sendMail: gmailSend });

    const result = await sendEmail({ to: ["invalid@example.test"], subject: "subject", content: "plain text" });

    expect(result.success).toBe(false);
    expect(result.provider).toBe("aliyun");
    expect(result.errorCode).toBe("EENVELOPE");
    expect(gmailSend).not.toHaveBeenCalled();
  });

  it("does not report the same mailbox as two independent providers", () => {
    process.env.EMAIL_USER = "same@example.test";
    process.env.EMAIL_PASSWORD = "enterprise-secret";
    process.env.SMTP_USER = "same@example.test";
    process.env.SMTP_PASS = "duplicate-secret";

    expect(getEmailProviderConfiguration()).toEqual({
      aliyunConfigured: true,
      gmailConfigured: false,
      priority: ["aliyun"],
    });
  });

  it("fails safely without attempting delivery when no SMTP provider is configured", async () => {
    expect(getEmailProviderConfiguration()).toEqual({ aliyunConfigured: false, gmailConfigured: false, priority: [] });

    const result = await sendEmail({ to: ["recipient@example.test"], subject: "subject", content: "plain text" });

    expect(result).toEqual({ success: false, error: "SMTP provider is not configured", errorCode: "SMTP_NOT_CONFIGURED" });
    expect(createTransportMock).not.toHaveBeenCalled();
  });
});
