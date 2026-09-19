import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateLcfEmailContent } from "./lcfAdminEmailService";

const serviceSource = readFileSync(new URL("./lcfAdminEmailService.ts", import.meta.url), "utf8");

describe("LCF管理メールの送信品質ガード", () => {
  it("数字だけの件名と短文を送信前に拒否する", () => {
    const result = validateLcfEmailContent("1111", "test");
    expect(result.errors).toHaveLength(2);
    expect(result.errors.join(" ")).toContain("数字だけ");
    expect(result.errors.join(" ")).toContain("40文字以上");
  });

  it("入力案内を残したままの本文を拒否する", () => {
    const result = validateLcfEmailContent(
      "【LIVE COMMERCE FESTIVAL】申込みのご確認",
      "山田様\n\nこちらに具体的なご用件をご入力ください。よろしくお願いいたします。",
    );
    expect(result.errors).toContain("本文は宛名・用件・連絡内容が分かる40文字以上の正式な文章にしてください");
  });

  it("宛名・用件を含む正式な日本語メールを許可する", () => {
    const result = validateLcfEmailContent(
      "【LIVE COMMERCE FESTIVAL】第2回ご参加内容の確認",
      "山田様\n\nLIVE COMMERCE FESTIVAL運営事務局です。第2回イベントのお申込み内容について確認事項があり、ご連絡いたしました。参加日程をご確認のうえ、ご返信をお願いいたします。",
    );
    expect(result.errors).toEqual([]);
  });

  it("アドレス指定検索・限定フォールバック・5分キャッシュで高速化する", () => {
    expect(serviceSource).toContain("client.search");
    expect(serviceSource).toContain("total - 299");
    expect(serviceSource).not.toContain("total - 999");
    expect(serviceSource).toContain("matchingUids.length === 0 && scanOnEmpty && !usedFallback");
    expect(serviceSource).toContain("HISTORY_CACHE_TTL_MS = 5 * 60_000");
    expect(serviceSource).toContain("Promise.allSettled([loadInbox(), loadSent()])");
    expect(serviceSource).toContain("IMAP_TASK_TIMEOUT_MS = 7_000");
    expect(serviceSource).toContain("IMAP_MANUAL_REFRESH_TIMEOUT_MS = 20_000");
    expect(serviceSource).toContain("if (forceRefresh)");
    expect(serviceSource).toContain("Manual address sync failed");
    expect(serviceSource).toContain("Promise.race");
    expect(serviceSource).toContain("IMAP_TASK_TIMEOUT");
  });

  it("全体履歴はLCF申込メールだけを新しい順に最大200件まで返す", () => {
    expect(serviceSource).toContain("export async function listRecentLcfEmailLogs");
    expect(serviceSource).toContain('eq(salesEmailLogs.sendType, "lcf_application")');
    expect(serviceSource).toContain("Math.min(200, Math.trunc(limit))");
    expect(serviceSource).toContain("orderBy(desc(salesEmailLogs.sentAt))");
  });

  it("表示上はLCF、SMTP認証とenvelopeは既存の認証済みアドレスを使う", () => {
    expect(serviceSource).toContain('from: `"LIVE COMMERCE FESTIVAL" <${LCF_FROM_ADDRESS}>`');
    expect(serviceSource).toContain("sender: ENV.emailUser");
    expect(serviceSource).toContain("envelope: { from: ENV.emailUser");
    expect(serviceSource).toContain("replyTo: LCF_FROM_ADDRESS");
  });

  it("SMTP受付後の履歴保存失敗を送信失敗として扱わず重複再送を防ぐ", () => {
    expect(serviceSource).toContain("SMTP accepted but history save failed");
    expect(serviceSource).toContain("historySaved = false");
    expect(serviceSource.indexOf("} catch (error) {")).toBeLessThan(serviceSource.indexOf("let historySaved = true"));
  });
});
