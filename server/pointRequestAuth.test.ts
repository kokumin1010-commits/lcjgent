import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pointRequestSource = readFileSync(resolve("client/src/pages/PointRequest.tsx"), "utf8");
const mainSource = readFileSync(resolve("client/src/main.tsx"), "utf8");

describe("PointRequest Cookie-only and read-only policy", () => {
  it("does not restore, persist, or propagate a member bearer token", () => {
    expect(pointRequestSource).not.toContain("window.location.search");
    expect(pointRequestSource).not.toContain("lcj_session_token");
    expect(pointRequestSource).not.toContain("sessionToken");
    expect(mainSource).not.toContain("lcj_session_token");
  });

  it("does not expose a new local point request mutation", () => {
    expect(pointRequestSource).not.toContain("pointRequest.submit.useMutation");
    expect(pointRequestSource).toContain("新規LCJポイント申請は停止中です");
    expect(pointRequestSource).toContain("自動合算や自動移行は行いません");
  });

  it("keeps the route as a migration notice with a Beauty Wallet action", () => {
    expect(mainSource).toContain("/point-request");
    expect(pointRequestSource).toContain('href="/beauty-wallet"');
  });
});
