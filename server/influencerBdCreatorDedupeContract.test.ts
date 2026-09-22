import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./influencerBdRouter.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/InfluencerBd.tsx", import.meta.url), "utf8");
const lightPageSource = readFileSync(new URL("../client/src/pages/InfluencerBdDedupe.tsx", import.meta.url), "utf8");
const startupSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");

describe("influencer creator dedupe and delete contracts", () => {
  it("limits dedupe execution to admins and serializes the transaction", () => {
    const start = routerSource.indexOf("previewCreatorDedupe: adminProcedure");
    const end = routerSource.indexOf("saveCreator: protectedProcedure", start);
    const block = routerSource.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(block).toContain("dedupeCreators: adminProcedure");
    expect(block).toContain("SELECT GET_LOCK(?,10) AS acquired");
    expect(block).toContain("await connection.beginTransaction()");
    expect(block).toContain("loadCreatorDedupeRows(connection, true)");
    expect(block).toContain("lockedPreview.fingerprint !== input.expectedFingerprint");
    expect(block).toContain("expectedDuplicateRecordCount");
    expect(block).toContain("[BD-CREATOR-DEDUPE-PREVIEW-STALE]");
    expect(routerSource).toContain('lock ? " FOR UPDATE" : ""');
    expect(block).toContain("await connection.commit()");
    expect(block).toContain("await connection.rollback()");
    expect(block).toContain("SELECT RELEASE_LOCK(?)");
  });

  it("moves business history before soft-deleting duplicate creator rows", () => {
    const start = routerSource.indexOf("dedupeCreators: adminProcedure");
    const end = routerSource.indexOf("saveCreator: protectedProcedure", start);
    const block = routerSource.slice(start, end);
    expect(block).toContain("UPDATE influencer_bd_outreach_logs SET creatorId=?");
    expect(block).toContain("UPDATE influencer_bd_attachments SET creatorId=?");
    expect(block).toContain("SELECT id,creatorId FROM influencer_bd_outreach_logs");
    expect(block).toContain("SELECT id,creatorId FROM influencer_bd_attachments");
    expect(block).toContain("sourceCreatorId: Number(row.creatorId)");
    expect(block).toContain('"creator_outreach_merge_manifest"');
    expect(block).toContain('"creator_attachment_merge_manifest"');
    expect(block).toContain("status='archived'");
    expect(block).toContain("deletedAt=COALESCE(deletedAt,CURRENT_TIMESTAMP)");
    expect(block).toContain("group.rows.some(row => !row.deletedAt)");
    expect(block).not.toContain("updatedByName=?,deletedAt=NULL");
    expect(block).toContain('action: "creator_duplicates_merged"');
    expect(block).toContain('action: "creator_merged_into_canonical"');
    expect(block).toContain("creatorMergeAuditSnapshot(group.keeper)");
    expect(block).toContain("creatorMergeAuditSnapshot(duplicate)");
    expect(block).not.toContain("before: group.keeper");
    expect(routerSource).toContain("accountKeyHash: normalizedHandle ? sha256Text");
    expect(routerSource).not.toContain("normalizedHandle: normalizeInfluencerCreatorAccountId(row.handle || row.normalizedHandle");
    expect(block).not.toContain("DELETE FROM influencer_bd_creators");
  });

  it("shows admin-only delete and account-ID dedupe confirmations", () => {
    expect(pageSource).toContain('trpc.influencerBd.archiveCreator.useMutation()');
    expect(pageSource).toContain('trpc.influencerBd.previewCreatorDedupe.useQuery');
    expect(pageSource).toContain('trpc.influencerBd.dedupeCreators.useMutation()');
    expect(pageSource).toContain('L("账号ID查重", "アカウントID重複確認")');
    expect(pageSource).toContain('L("确认删除", "削除を確定")');
    expect(pageSource).toContain("历史进度和审计记录仍保留");
    expect(pageSource).toContain("优先保留有TikTok名称的数据");
    expect(pageSource).toContain("omittedGroupCount");
    expect(pageSource).toContain("creatorDedupeConfirmCount");
    expect(pageSource).toContain("expectedFingerprint: preview.fingerprint");
    expect(pageSource).toContain("请输入待移除数量");
  });

  it("exposes only aggregate counts for production before-and-after verification", () => {
    const start = routerSource.indexOf("export async function getInfluencerCreatorDedupeHealth");
    const block = routerSource.slice(start);
    expect(start).toBeGreaterThan(0);
    expect(block).toContain("duplicateGroupCount");
    expect(block).toContain("duplicateRecordCount");
    expect(block).toContain("normalizationPendingCount");
    expect(block).not.toContain("displayName:");
    expect(startupSource).toContain('/api/health/influencer-creator-dedupe');
  });

  it("requires explicit count confirmation on the lightweight admin page", () => {
    expect(lightPageSource).toContain("confirmed = confirmCount === String(expectedCount)");
    expect(lightPageSource).toContain("expectedFingerprint: data.fingerprint");
    expect(lightPageSource).toContain("expectedDuplicateRecordCount: data.duplicateRecordCount");
    expect(lightPageSource).not.toContain("URLSearchParams");
    expect(lightPageSource).not.toContain("useEffect");
    expect(routerSource).toContain("dedupeCreators: adminProcedure");
  });
});
