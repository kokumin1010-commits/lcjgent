import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const schema = read("drizzle/lcmSchema.ts");
const upgrade = read("server/lcmMarketplaceUpgrade.ts");
const router = read("server/lcmRouter.ts");
const product = read("client/src/pages/LcmProduct.tsx");
const manage = read("client/src/pages/LcmManage.tsx");

describe("LCM brand contact threads", () => {
  it("creates additive, indexed contact and message tables through the guarded upgrade", () => {
    for (const table of ["lcm_brand_contacts", "lcm_brand_contact_messages"]) {
      expect(schema).toContain(`"${table}"`);
      expect(upgrade).toContain(`"${table}"`);
      expect(upgrade).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(schema).toContain('uniqueIndex("uq_lcm_brand_contact_code")');
    expect(schema).toContain('index("idx_lcm_brand_contact_requester")');
    expect(schema).toContain('index("idx_lcm_brand_contact_brand")');
    expect(schema).toContain('index("idx_lcm_brand_contact_message_thread")');
    expect(upgrade).toContain('const UPGRADE_KEY = "lcm-marketplace-v5-brand-contacts"');
    expect(upgrade).toContain("additive empty tables and nullable columns only");
  });

  it("exposes a prominent contact CTA for every product without negative sample availability labels", () => {
    expect(product).toContain('const contactPath = `/lcm/manage?contact=${product.id}`');
    expect(product).toContain('buildFestivalLoginUrl(contactPath)');
    expect(product).toContain('<a href={contactHref}');
    expect(product).not.toContain('<Link href={contactHref}');
    expect(product).toContain("touch-manipulation");
    expect(product).toContain("relative z-10");
    expect(product).toContain('aria-label={`${product.brandName}へ商品について連絡する`}');
    expect(product).toContain("ブランドさんに連絡");
    expect(product).toContain("連携済みのブランド担当者へメール通知します。担当者未連携時はLCM運営が受け付けます");
    expect(product).toContain('bg-[#bd480d]');
    expect(product.indexOf("ブランドさんに連絡")).toBeLessThan(product.indexOf("取引条件を見る"));
    expect(product).not.toContain("サンプル受付なし");
    expect(product).not.toContain(">サンプル対応</span>");
    expect(product).not.toContain("現在、この商品のサンプル申請は受け付けていません");
  });

  it("stores the first message and audits it before notification delivery", () => {
    expect(router).toContain("createBrandContact: lcmMemberProcedure");
    expect(router).toContain('eq(lcmProducts.status, "published")');
    expect(router).toContain('eq(lcmBrandProfiles.status, "published")');
    expect(router).toContain("自社ブランドの商品には連絡できません");
    expect(router).toContain("tx.insert(lcmBrandContacts)");
    expect(router).toContain("tx.insert(lcmBrandContactMessages)");
    expect(router).toContain('entityType: "brand_contact"');
    expect(router.indexOf("tx.insert(lcmBrandContactMessages)")).toBeLessThan(router.indexOf("const brandNotification = await notifyLcm"));
    expect(router).toContain("assertBrandContactRateLimit");
    expect(router).toContain("FOR UPDATE");
    expect(router).toContain("短時間に送信できる連絡は5件までです");
  });

  it("keeps requester and brand histories account-scoped and replies authorization-gated", () => {
    expect(router).toContain("listMyBrandContacts: lcmMemberProcedure");
    expect(router).toContain("listBrandContacts: lcmMemberProcedure");
    expect(router).toContain("replyBrandContact: lcmMemberProcedure");
    expect(router).toContain("eq(lcmBrandContacts.requesterAccountId, ctx.lcmAccount.accountId)");
    expect(router).toContain("requireActiveBrandMember(ctx.lcmAccount.accountId, input.brandId)");
    expect(router).toContain("if (!isRequester && !isBrand)");
    expect(router).toContain("この連絡threadを操作できません");
    expect(router).toContain('senderRole === "brand" ? "replied" : "open"');
    expect(router).toContain("BRAND_CONTACT_PAGE_SIZE = 10");
    expect(router).toContain("BRAND_CONTACT_MESSAGE_PAGE_SIZE = 50");
    expect(router).toContain("getBrandContactThread: lcmMemberProcedure");
    expect(router).toContain("lastMessageAt: z.string().datetime()");
    expect(router).toContain("lt(lcmBrandContacts.lastMessageAt");
    expect(router).toContain("lt(lcmBrandContacts.id, input.cursor.id)");
    expect(router).toContain("nextCursor:");
    expect(router).not.toContain("max(10_000)");
  });

  it("emails active brand owners and the requester while hiding email addresses from the UI", () => {
    expect(router).toContain("const owners = await brandOwnerEmails");
    expect(router).toContain('eq(lcmBrandMembers.role, "owner")');
    expect(router).toContain('eq(lcmBrandMembers.status, "active")');
    expect(router).toContain('const LCM_CONTACT_FALLBACK_EMAIL = "lcj.inquiry@livecommercejapan.jp"');
    expect(router).toContain('deliveryRoute = owners.length > 0 ? "brand_owners"');
    expect(router).toContain('owners.length > 0 ? owners : [LCM_CONTACT_FALLBACK_EMAIL]');
    expect(router).toContain('replyBrandOwners.length > 0');
    expect(router).toContain("LCMにブランド宛ての新しい連絡が届きました");
    expect(router).toContain("【LCM】ブランドへの連絡を受け付けました");
    expect(router).toContain("【LCM】ブランド連絡に新しい返信");
    expect(router).toContain('params.subject.replace(/[\\r\\n\\u0000-\\u001F\\u007F]+/g, " ")');
    expect(router).toContain("/manage?contacts=1");
    expect(router).toContain("&contacts=1");
    expect(manage).toContain("相手のメールアドレスは公開しません");
    expect(manage).toContain("担当者未連携のためLCM運営受付へ通知しました");
    expect(manage).toContain("連携済みのブランド担当者へメール通知します。担当者未連携時はLCM運営が受け付けます");
    const contactForm = manage.slice(manage.indexOf("function BrandContactApplication"), manage.indexOf("function BrandContactHistory"));
    expect(contactForm).not.toMatch(/type="email"|mailto:/);
  });

  it("renders the same chronological thread in requester and brand my pages with reply controls", () => {
    expect(manage).toContain("BrandContactApplication");
    expect(manage).toContain("BrandContactHistory");
    expect(manage).toContain("BrandContactInbox");
    expect(manage).toContain("ContactThreadList");
    expect(router).toContain('orderBy(desc(lcmBrandContactMessages.id))');
    expect(router).toContain('.limit(BRAND_CONTACT_MESSAGE_PAGE_SIZE + 1)');
    expect(router).toContain('if (input.cursor) conditions.push(lt(lcmBrandContactMessages.id, input.cursor))');
    expect(manage).toContain("ブランド連絡履歴");
    expect(manage).toContain("ブランド宛て連絡");
    expect(manage).toContain("listMyBrandContacts.useInfiniteQuery");
    expect(manage).toContain("listBrandContacts.useInfiniteQuery");
    expect(manage).toContain("useInfiniteQuery({ contactId }");
    expect(manage).toContain("以前のメッセージを表示");
    expect(manage).toContain("以前の連絡をさらに表示");
    expect(manage).toContain("ブランド連絡を読み込めませんでした");
    expect(manage).toContain("返信して通知");
    expect(manage).toContain("maxLength={5000}");
    expect(manage).toContain("個人の住所・電話番号・決済情報は書かないでください");
    expect(manage).toContain("await onReply(contactId, draft.trim())");
    expect(manage).toContain("mutation onError preserves and reports the draft");
  });
});
