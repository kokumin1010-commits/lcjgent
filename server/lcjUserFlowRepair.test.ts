import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SignJWT } from "jose";
import { createLineMemberSessionToken, verifyLineMemberSessionToken } from "./lineMemberSession";
import { canonicalPointKeyForEvidence } from "./pointRecoveryLedgerUpgrade";

const root = path.resolve(process.cwd());
const routersSource = fs.readFileSync(path.join(root, "server/routers.ts"), "utf8");
const callbackSource = fs.readFileSync(path.join(root, "client/src/pages/LineLoginCallback.tsx"), "utf8");
const loginSource = fs.readFileSync(path.join(root, "client/src/pages/LineLogin.tsx"), "utf8");
const productsSource = fs.readFileSync(path.join(root, "client/src/pages/MallProducts.tsx"), "utf8");
const productDetailSource = fs.readFileSync(path.join(root, "client/src/pages/MallProductDetail.tsx"), "utf8");
const lineMypageSource = fs.readFileSync(path.join(root, "client/src/pages/LineMypage.tsx"), "utf8");
const mallMembersSource = fs.readFileSync(path.join(root, "client/src/pages/MallMembers.tsx"), "utf8");
const memberDetailSource = fs.readFileSync(path.join(root, "client/src/pages/MemberDetail.tsx"), "utf8");
const myPointsSource = fs.readFileSync(path.join(root, "client/src/pages/MyPoints.tsx"), "utf8");
const ledgerSource = fs.readFileSync(path.join(root, "server/pointRecoveryLedgerUpgrade.ts"), "utf8");
const startupSource = fs.readFileSync(path.join(root, "server/_core/index.ts"), "utf8");

const TEST_SECRET = "lcj-user-flow-repair-test-secret-2026-at-least-32-chars";

describe("LCJ member signed fallback session", () => {
  const previousSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it("accepts a valid signed LINE member token", async () => {
    const expiresAt = Date.now() + 60_000;
    const token = await createLineMemberSessionToken({ lineUserId: "Uverified", userId: 42, expiresAt });
    const session = await verifyLineMemberSessionToken(token);
    expect(session?.lineUserId).toBe("Uverified");
    expect(session?.userId).toBe(42);
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects legacy unsigned Base64 and tampered tokens", async () => {
    const legacy = Buffer.from(JSON.stringify({ lineUserId: "Uforged", expiresAt: Date.now() + 60_000 })).toString("base64");
    expect(await verifyLineMemberSessionToken(legacy)).toBeNull();

    const token = await createLineMemberSessionToken({ lineUserId: "Uverified", expiresAt: Date.now() + 60_000 });
    const [header, payload, signature] = token.split(".");
    const tamperedSignature = `${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
    expect(await verifyLineMemberSessionToken(`${header}.${payload}.${tamperedSignature}`)).toBeNull();
  });

  it("rejects expired signed tokens", async () => {
    const token = await new SignJWT({ scope: "lcj_member", lineUserId: "Uexpired" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(TEST_SECRET));
    expect(await verifyLineMemberSessionToken(token)).toBeNull();
  });
});

describe("restored point opening history", () => {
  it("maps legacy email evidence to the verified LINE key", () => {
    expect(canonicalPointKeyForEvidence({
      evidenceKey: "email_100",
      memberId: 100,
      verifiedLineUserId: "Ucanonical",
    })).toBe("Ucanonical");
    expect(canonicalPointKeyForEvidence({
      evidenceKey: "email_101",
      memberId: 101,
      verifiedLineUserId: null,
    })).toBe("email_101");
  });

  it("creates display-only audited history without changing balances", () => {
    expect(ledgerSource).toContain("opening_history_only");
    expect(ledgerSource).toContain("'adjustment'");
    expect(ledgerSource).toContain("系统恢复余额");
    expect(ledgerSource).toContain("point totals changed while creating display-only recovery history");
    expect(ledgerSource).toContain("point_recovery_ledger_exclusions");
    expect(ledgerSource).toContain("excludedMismatches");
    expect(ledgerSource).not.toMatch(/UPDATE\s+line_point_balances/i);
    expect(ledgerSource).not.toMatch(/DELETE\s+FROM\s+line_point_balances/i);
    expect(ledgerSource).toContain("pre-user-flow-fix-v1");
    expect(ledgerSource).toContain("post-point-ledger-v1");
  });

  it("is only exposed through the temporary keyed audit before first production execution", () => {
    expect(startupSource).not.toContain("runPointRecoveryLedgerUpgrade");
    expect(ledgerSource).toContain("point_recovery_ledger_entry_unique");
    expect(ledgerSource).toContain("point_recovery_ledger_exclusion_unique");
    expect(ledgerSource).toContain("GET_LOCK");
    expect(ledgerSource).toContain("SELECT lineUserId, balance FROM line_point_balances ORDER BY id FOR UPDATE");
  });

  it("renders recovery opening history as a distinct non-duplicate system restoration", () => {
    expect(lineMypageSource).toContain("システム復旧（再付与なし）");
    expect(mallMembersSource).toContain("システム復旧（残高への再付与なし）");
    expect(memberDetailSource).toContain("システム復旧（残高への再付与なし）");
    expect(myPointsSource).toContain("表示履歴の復元であり、残高への再付与はありません");
  });
});

describe("login and exchange user experience", () => {
  it("stores the signed callback token before navigating and never displays OAuth secrets", () => {
    expect(callbackSource).toContain('localStorage.setItem("lcj_session_token", data.sessionToken)');
    expect(callbackSource).toContain('window.location.replace("/mypage")');
    expect(callbackSource).not.toContain("code=${code}");
    expect(callbackSource).not.toContain("state=${state}");
    expect(callbackSource).not.toContain("デバッグ情報");
  });

  it("does not accept unsigned bearer sessions on the server", () => {
    expect(routersSource).toContain("verifyLineMemberSessionToken");
    expect(routersSource).not.toContain("Buffer.from(token, 'base64').toString('utf-8')");
    expect(routersSource).toContain("sessionToken,");
  });

  it("recovers safely from stale member sessions and explains LINE-only login", () => {
    expect(lineMypageSource).toContain("userQuerySucceeded && user === null");
    expect(lineMypageSource).toContain("localStorage.removeItem('lcj_session_token')");
    expect(lineMypageSource).toContain("/line-login?redirect=/mypage&retry=1");
    expect(loginSource).toContain("LINEアカウント名で登録した方は");
    expect(loginSource).toContain("window.location.replace(result.data.loginUrl)");
    expect(loginSource).not.toContain("window.location.href = result.data.loginUrl");
    expect(loginSource).toContain("email: email.trim().toLowerCase()");
    expect(routersSource).toContain("const normalizedEmail = input.email.trim().toLowerCase()");
  });

  it("explains the global stock hold and guarantees no point deduction", () => {
    expect(productsSource).toContain("現在、交換できる在庫を確認中です");
    expect(productsSource).toContain("操作してもポイントは減りません");
    expect(productDetailSource).toContain("在庫確認中・現在は交換できません");
    expect(productDetailSource).toContain("この状態ではポイントは減りません");
  });
});
