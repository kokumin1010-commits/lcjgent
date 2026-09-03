import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getLcfCheckInErrorMessage,
  getLcfTicketIdValidationMessage,
  normalizeLcfTicketId,
} from "../client/src/lib/lcfCheckInValidation";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LCF admin check-in validation", () => {
  it("normalizes a manually entered ticket ID before submission", () => {
    expect(normalizeLcfTicketId("  lcf-ab12_cd3  ")).toBe("LCF-AB12_CD3");
    expect(getLcfTicketIdValidationMessage("  lcf-ab12_cd3  ")).toBeNull();
  });

  it("blocks empty and malformed ticket IDs with concise Japanese guidance", () => {
    expect(getLcfTicketIdValidationMessage(" ")).toBe("チケットIDを入力してください。");
    expect(getLcfTicketIdValidationMessage("山田太郎")).toBe(
      "チケットIDの形式が正しくありません。例：LCF-XXXXXXXX",
    );
  });

  it("never exposes Zod JSON or regex details to an administrator", () => {
    const rawError = {
      message: '[{"origin":"string","code":"invalid_format","format":"regex","pattern":"/^LCF-/"}]',
      data: { code: "BAD_REQUEST" },
    };
    const display = getLcfCheckInErrorMessage(rawError);
    expect(display).toBe("チケットIDの形式が正しくありません。例：LCF-XXXXXXXX");
    expect(display).not.toContain("invalid_format");
    expect(display).not.toContain("regex");
    expect(display).not.toContain("pattern");
  });

  it("keeps business errors actionable without leaking internal failures", () => {
    expect(getLcfCheckInErrorMessage({ message: "チケットが見つかりません", data: { code: "NOT_FOUND" } }))
      .toBe("チケットが見つかりません。IDを確認してください。");
    expect(getLcfCheckInErrorMessage({ message: "既に受付済みです（2026/9/8 10:00:00）", data: { code: "BAD_REQUEST" } }))
      .toBe("既に受付済みです（2026/9/8 10:00:00）");
    expect(getLcfCheckInErrorMessage({ message: "database detail", data: { code: "INTERNAL_SERVER_ERROR" } }))
      .toBe("受付処理に失敗しました。時間をおいてもう一度お試しください。");
  });

  it("keeps list search separate from the manual check-in submit path", () => {
    const admin = read("client/src/pages/LcfAdmin.tsx");
    const checkInMutation = admin.slice(
      admin.indexOf("const checkInMut"),
      admin.indexOf("const handleManualCheckIn"),
    );
    expect(admin).toContain('aria-label="手動受付用チケットID"');
    expect(admin).toContain('aria-label="チケット一覧検索"');
    expect(admin).toContain("getLcfTicketIdValidationMessage(manualInput)");
    expect(admin).toContain("search: searchQuery || undefined");
    expect(checkInMutation).not.toContain("`❌ ${err.message}`");
  });

  it("provides a readable server-side schema message for direct API clients", () => {
    const router = read("server/festivalRouter.ts");
    expect(router.match(/チケットIDの形式が正しくありません。例：LCF-XXXXXXXX/g)?.length).toBe(2);
    expect(router).toContain("既に受付済みです");
    expect(router).not.toContain("既に签到済みです");
  });
});
