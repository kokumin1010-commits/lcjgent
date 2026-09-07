import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isUnauthorizedTrpcError } from "../client/src/lib/trpcAuthError";

describe("tRPC unauthorized error detection", () => {
  it("recognizes the canonical production message", () => {
    expect(isUnauthorizedTrpcError({ message: "Please login (10001)" })).toBe(true);
  });

  it("recognizes data.code without relying on an error class", () => {
    expect(isUnauthorizedTrpcError({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).toBe(true);
  });

  it("recognizes shape.data.code from cross-chunk tRPC errors", () => {
    expect(isUnauthorizedTrpcError({ shape: { data: { code: "UNAUTHORIZED" } } })).toBe(true);
  });

  it("recognizes an HTTP 401 fallback", () => {
    expect(isUnauthorizedTrpcError({ data: { httpStatus: 401 } })).toBe(true);
  });

  it("does not redirect for unrelated preview failures", () => {
    expect(isUnauthorizedTrpcError({ message: "Database not available", data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 } })).toBe(false);
    expect(isUnauthorizedTrpcError(null)).toBe(false);
  });
});

describe("Pass 2 expired-session recovery contract", () => {
  const root = path.resolve(__dirname, "..");
  const mainSource = fs.readFileSync(path.join(root, "client/src/main.tsx"), "utf8");
  const receiptSource = fs.readFileSync(path.join(root, "client/src/pages/LineReceiptManagement.tsx"), "utf8");

  it("uses structural unauthorized detection globally", () => {
    expect(mainSource).toContain("isUnauthorizedTrpcError(error)");
    expect(mainSource).not.toContain("error instanceof TRPCClientError");
  });

  it("shows a clear no-write message and one-click login on Pass 2 preview 401", () => {
    expect(receiptSource).toContain("登录已过期。预演未执行，也没有修改任何数据。");
    expect(receiptSource).toContain("重新登录");
    expect(receiptSource).toContain("window.location.href = getLoginUrl()");
  });

  it("keeps failed previews non-executable and offers retry for non-auth errors", () => {
    expect(receiptSource).toContain("!holdRulesPreview?.confirmationToken");
    expect(receiptSource).toContain("!pass2ExecutionConfirmed");
    expect(receiptSource).toContain("void refetchHoldRulesPreview()");
  });
});
