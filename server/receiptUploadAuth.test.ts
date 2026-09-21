import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");
const main = read("client/src/main.tsx");
const receipt = read("client/src/pages/ReceiptUpload.tsx");
const mypage = read("client/src/pages/LineMypage.tsx");
const lineAgent = read("server/lineAgent.ts");

describe("receipt upload authentication and migration policy", () => {
  it("uses cookies for tRPC and never sends the LCJ member bearer token", () => {
    expect(main).toContain('credentials: "include"');
    expect(main).not.toContain("lcjSessionToken");
    expect(main).not.toContain("lcj_session_token");
  });

  it("renders the receipt page as a read-only Beauty Wallet migration notice", () => {
    expect(receipt).toContain("新規ポイント申請は現在停止中です");
    expect(receipt).toContain('setLocation("/beauty-wallet")');
    expect(receipt).not.toContain("params.get('token')");
    expect(receipt).not.toContain("lcj_session_token");
    expect(receipt).not.toContain("submitWebReceipt");
  });

  it("does not propagate a member token from the member page", () => {
    expect(mypage).not.toContain("/receipt-upload?token=");
    expect(mypage).not.toContain("localStorage.getItem('lcj_session_token')");
  });

  it("does not issue a long-lived token or tokenized URL from the LINE assistant", () => {
    expect(lineAgent).not.toContain("createLineMemberSessionToken");
    expect(lineAgent).not.toContain("/receipt-upload?token=");
    expect(lineAgent).not.toContain("3650 * 24 * 60 * 60 * 1000");
    expect(lineAgent).toContain("新しいLCJレシートポイント申請は停止中です");
    expect(lineAgent).toContain("${appUrl}/beauty-wallet");
  });
});
