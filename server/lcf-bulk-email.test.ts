import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dedupeLcfBulkRecipients,
  renderLcfBulkTemplate,
  type LcfBulkRecipientSnapshot,
} from "./lcfBulkEmailService";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const recipient = (overrides: Partial<LcfBulkRecipientSnapshot> = {}): LcfBulkRecipientSnapshot => ({
  applicationType: "company",
  applicationId: 10,
  eventYear: "2026-02",
  email: "brand@example.com",
  name: "山田 太郎",
  company: "株式会社サンプル",
  ...overrides,
});

describe("LCF属性別一斉メール", () => {
  it("氏名・会社名・開催回・属性を宛先ごとに差し込む", () => {
    expect(renderLcfBulkTemplate("{{name}}様／{{company}}／{{event}}／{{type}}", recipient())).toBe(
      "山田 太郎様／株式会社サンプル／第2回（2026年12月）／企業・ブランド",
    );
  });

  it("メールアドレスを小文字へ正規化し、異なる属性の重複宛先を1件へまとめる", () => {
    const result = dedupeLcfBulkRecipients([
      recipient({ email: "Brand@Example.com" }),
      recipient({ applicationType: "liver", applicationId: 20, email: "brand@example.com" }),
      recipient({ applicationId: 30, email: "not-an-email" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("brand@example.com");
  });

  it("対象プレビューと明示確認後だけ永続キューを開始する", () => {
    const router = read("server/festivalRouter.ts");
    const service = read("server/lcfBulkEmailService.ts");
    const dialog = read("client/src/components/lcf/LcfBulkEmailDialog.tsx");
    expect(router).toContain("previewLcfBulkEmail: festivalAdminProcedure");
    expect(router).toContain('confirmation: z.literal("一斉送信を開始")');
    expect(router).toContain("cancelLcfBulkEmailCampaign");
    expect(service).toContain("festivalBulkEmailCampaigns");
    expect(service).toContain("festivalBulkEmailRecipients");
    expect(service).toContain("SEND_INTERVAL_MS = 2_000");
    expect(service).toContain("RECIPIENT_INSERT_CHUNK_SIZE = 250");
    expect(service).toContain("db.transaction(async (tx)");
    expect(service).toContain("queueLcfBulkEmailCampaign(campaignId)");
    expect(dialog).toContain("対象件数と本文を確認");
    expect(dialog).toContain("実際にメール送信することを確認しました");
    expect(dialog).toContain("宛先を他の受信者へ公開しません");
    expect(dialog).toContain("max-w-none");
    expect(dialog).toContain("sm:max-w-[1120px]");
  });

  it("配信途中のプロセス停止後も不明状態を自動再送せず重複送信を防ぐ", () => {
    const service = read("server/lcfBulkEmailService.ts");
    expect(service).toContain("DELIVERY_STATE_UNKNOWN_MANUAL_REVIEW");
    expect(service).toContain("UNKNOWN_DELIVERY_AFTER_MS = 10 * 60_000");
    expect(service).toContain('eq(festivalBulkEmailRecipients.status, "pending")');
    expect(service).toContain('status: "sending"');
  });

  it("企業・ライブコマーサー・一般参加・スポンサーを属性として選択できる", () => {
    const service = read("server/lcfBulkEmailService.ts");
    expect(service).toContain('selection.audienceTypes.includes("company")');
    expect(service).toContain('selection.audienceTypes.includes("liver")');
    expect(service).toContain('selection.audienceTypes.includes("general")');
    expect(service).toContain('selection.audienceTypes.includes("sponsor")');
    expect(service).toContain('eq(festivalSponsors.status, "confirmed")');
  });

  it("DBマイグレーションと既存migration障害時fallbackを持つ", () => {
    const migration = read("drizzle/0141_lcf_bulk_email_campaigns.sql");
    const runner = read("run-migrations.mjs");
    expect(migration).toContain("festival_bulk_email_campaigns");
    expect(migration).toContain("festival_bulk_email_recipients");
    expect(migration).toContain("uk_lcf_bulk_recipient_campaign_email");
    expect(runner).toContain("Ensuring LCF bulk email tables");
    expect(runner).toContain("0141_lcf_bulk_email_campaigns.sql");
  });

  it("営業分類を含むメールテンプレートを保存・呼び出し・上書き・削除できる", () => {
    const schema = read("drizzle/festivalSchema.ts");
    const migration = read("drizzle/0142_lcf_bulk_email_templates.sql");
    const journal = read("drizzle/meta/_journal.json");
    const runner = read("run-migrations.mjs");
    const service = read("server/lcfBulkEmailTemplateService.ts");
    const router = read("server/festivalRouter.ts");
    const dialog = read("client/src/components/lcf/LcfBulkEmailDialog.tsx");

    expect(schema).toContain('festivalBulkEmailTemplates = mysqlTable("festival_bulk_email_templates"');
    expect(schema).toContain('["sales", "event", "follow_up", "other"]');
    expect(migration).toContain("uk_lcf_bulk_template_category_name");
    expect(journal).toContain('"tag": "0142_lcf_bulk_email_templates"');
    expect(runner).toContain("Ensuring LCF bulk email template table");
    expect(runner).toContain("0142_lcf_bulk_email_templates.sql");
    expect(service).toContain("listLcfBulkEmailTemplates");
    expect(service).toContain("createLcfBulkEmailTemplate");
    expect(service).toContain("updateLcfBulkEmailTemplate");
    expect(service).toContain("deleteLcfBulkEmailTemplate");
    expect(service).toContain("validateLcfEmailContent");
    expect(router).toContain("listLcfBulkEmailTemplates: festivalAdminProcedure");
    expect(router).toContain("createLcfBulkEmailTemplate: festivalAdminProcedure");
    expect(router).toContain("updateLcfBulkEmailTemplate: festivalAdminProcedure");
    expect(router).toContain("deleteLcfBulkEmailTemplate: festivalAdminProcedure");
    expect(router).toContain('confirmation: z.literal("テンプレートを削除")');
    expect(dialog).toContain("営業テンプレート");
    expect(dialog).toContain("保存済みテンプレート");
    expect(dialog).toContain("上書き保存");
    expect(dialog).toContain("新規保存");
  });
});
