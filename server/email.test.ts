import { describe, expect, it } from "vitest";
import nodemailer from "nodemailer";

describe("SMTP Configuration", () => {
  it("should have valid SMTP credentials configured", async () => {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    expect(smtpUser).toBeDefined();
    expect(smtpPass).toBeDefined();
    expect(smtpUser).toContain("@gmail.com");
    expect(smtpPass).toHaveLength(16); // Gmail app passwords are 16 characters
  });

  it("should successfully connect to Gmail SMTP server", async () => {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Verify connection
    await expect(transporter.verify()).resolves.toBe(true);
  }, 30000); // 30 second timeout for network operation
});
