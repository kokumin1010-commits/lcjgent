import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateTikTokScheduleClaims } from "./tiktokPublicScheduleAuth";

const validClaims = {
  repository: "kokumin1010-commits/lcjgent",
  ref: "refs/heads/main",
  workflow_ref:
    "kokumin1010-commits/lcjgent/.github/workflows/tiktok-public-monitor.yml@refs/heads/main",
  run_id: "123456789",
  sub: "repo:kokumin1010-commits/lcjgent:ref:refs/heads/main",
};

describe("TikTok public monitor GitHub OIDC authentication", () => {
  it("accepts only the expected repository, main ref and workflow", () => {
    expect(validateTikTokScheduleClaims(validClaims)).toEqual({
      runId: "123456789",
      subject: validClaims.sub,
    });
  });

  it.each([
    [
      "repository",
      "another-owner/another-repo",
      "Unexpected schedule repository",
    ],
    ["ref", "refs/heads/feature", "Unexpected schedule ref"],
    [
      "workflow_ref",
      "kokumin1010-commits/lcjgent/.github/workflows/other.yml@refs/heads/main",
      "Unexpected schedule workflow",
    ],
    ["run_id", "", "Schedule token missing run_id"],
  ])("rejects an unexpected %s claim", (field, value, message) => {
    expect(() =>
      validateTikTokScheduleClaims({ ...validClaims, [field]: value })
    ).toThrow(message);
  });

  it("keeps the workflow unique, six-hourly, short-lived and free of static secrets", () => {
    const workflow = readFileSync(
      new URL(
        "../.github/workflows/tiktok-public-monitor.yml",
        import.meta.url
      ),
      "utf8"
    );
    expect(workflow).toContain('cron: "23 */6 * * *"');
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("timeout-minutes: 2");
    expect(workflow).toContain("lcjmall-tiktok-public-monitor");
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).not.toMatch(/setInterval|node-cron/);
  });

  it("keeps the scheduled endpoint protected by OIDC verification", () => {
    const source = readFileSync(
      new URL("./_core/index.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain("authenticateTikTokScheduleRequest(req)");
    expect(source).not.toContain("cron-only");
  });
});
