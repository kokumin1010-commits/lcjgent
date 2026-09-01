import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOTH_RETIREMENT_SUBJECT,
  getBoothRetirementEmailContent,
  isRetiredBooth,
  RETIRED_BOOTH_IDS,
} from "./boothRetirementService";

describe("LCF T1-T4 booth retirement", () => {
  const source = fs.readFileSync(new URL("./boothRetirementService.ts", import.meta.url), "utf8");
  it("recognizes only the four retired booth IDs", () => {
    expect(RETIRED_BOOTH_IDS).toEqual(["T1", "T2", "T3", "T4"]);
    expect(isRetiredBooth("T1")).toBe(true);
    expect(isRetiredBooth("T4")).toBe(true);
    expect(isRetiredBooth("T13")).toBe(false);
    expect(isRetiredBooth("T24")).toBe(false);
  });

  it("keeps the approved Japanese cancellation notice intact", () => {
    const content = getBoothRetirementEmailContent();
    expect(content.subject).toBe(BOOTH_RETIREMENT_SUBJECT);
    expect(content.text).toContain("T1～T4");
    expect(content.text).toContain("現在予約がキャンセルされた状態");
    expect(content.text).toContain("改めて適切なブースへの再予約");
    expect(content.html).toContain("LIVE COMMERCE FESTIVAL 運営事務局");
  });

  it("backs up and cancels reservations transactionally before sending mail", () => {
    expect(source).toContain("SELECT GET_LOCK");
    expect(source).toContain("aes-256-gcm");
    expect(source).toContain("snapshot round-trip failed");
    expect(source).toContain("connection.beginTransaction()");
    expect(source).toContain("status = 'cancelled'");
    expect(source).toContain("DELETE FROM lcf_booth_active_slots");
    expect(source).toContain("retire_t1_t4_cancel_reservation");
    expect(source).toContain("connection.commit()");
    expect(source).toContain("connection.rollback()");
  });

  it("stores only hashed recipient audit data and skips already accepted deliveries", () => {
    expect(source).toContain('createHmac("sha256"');
    expect(source).toContain("recipientHash CHAR(64)");
    expect(source).not.toMatch(/lcf_booth_retirement_email_logs[\s\S]{0,500}\bemail\s+VARCHAR/i);
    expect(source).toContain('if (logRows[0]?.status === "accepted") continue');
    expect(source).toContain("attemptCount = attemptCount + 1");
    expect(source).toContain("to: [email]");
  });
});
