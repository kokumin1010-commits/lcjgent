import { describe, expect, it } from "vitest";
import { parseLcfApplicationFormError } from "../client/src/lib/lcfApplicationFormErrors";

describe("LCF application form error recovery", () => {
  it("extracts the field and message from a JSON Zod issue", () => {
    const result = parseLcfApplicationFormError({
      message: JSON.stringify([
        { code: "invalid_format", path: ["tiktokShopUrl"], message: "有効なTikTok Shop URLを入力してください" },
      ]),
      data: { code: "BAD_REQUEST" },
    });

    expect(result).toEqual({
      fieldId: "tiktokShopUrl",
      message: "有効なTikTok Shop URLを入力してください",
      code: "LCF-BAD-REQUEST",
    });
  });

  it("extracts an issue from the structured TRPC zodError payload", () => {
    const result = parseLcfApplicationFormError({
      message: "入力内容にエラーがあります",
      data: {
        code: "BAD_REQUEST",
        zodError: {
          issues: [{ code: "too_small", path: ["contactDepartment"], message: "担当者部署は必須です" }],
        },
      },
    });

    expect(result.fieldId).toBe("contactDepartment");
    expect(result.message).toBe("担当者部署は必須です");
    expect(result.code).toBe("LCF-BAD-REQUEST");
  });

  it("falls back to the Japanese field label when the server message has no path", () => {
    const result = parseLcfApplicationFormError(new Error("電話番号の形式が正しくありません"));

    expect(result.fieldId).toBe("phone");
    expect(result.code).toBe("LCF-FORM-PHONE");
  });

  it("keeps a stable generic code for unknown failures", () => {
    const result = parseLcfApplicationFormError(new Error("通信に失敗しました"));

    expect(result.fieldId).toBeNull();
    expect(result.message).toBe("通信に失敗しました");
    expect(result.code).toBe("LCF-FORM-VALIDATION");
  });
});
