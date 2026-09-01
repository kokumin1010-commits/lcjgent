import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routerSource = readFileSync(
  new URL("./tiktokCompetitorDailyRouter.ts", import.meta.url),
  "utf8"
);
const upgradeSource = readFileSync(
  new URL("./tiktokCompetitorDailyUpgrade.ts", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../client/src/pages/TiktokCompetitorDaily.tsx", import.meta.url),
  "utf8"
);

describe("TikTok competitor import draft persistence", () => {
  it("stores only the S3 reference and parsed rows until confirmation or explicit discard", () => {
    expect(upgradeSource).toContain(
      "CREATE TABLE IF NOT EXISTS tiktok_competitor_import_drafts"
    );
    expect(upgradeSource).toContain("fileKey VARCHAR(700) NOT NULL");
    expect(upgradeSource).toContain("rowsJson LONGTEXT NOT NULL");
    expect(upgradeSource).toContain(
      "status ENUM('pending','committing','committed','discarded','failed')"
    );
    expect(upgradeSource).toContain(
      "uq_tiktok_competitor_import_draft_owner_file"
    );
    expect(routerSource).toContain("createdById,createdByName,expiresAt)");
    expect(routerSource).toContain("'pending',NULL,NULL,?,?,NULL)");
    expect(routerSource).not.toContain(
      "DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 7 DAY)"
    );
    expect(routerSource).toContain("action:'ranking_draft_saved'");
    expect(routerSource).toContain("existingPendingIsActive");
    expect(routerSource).toContain("没有识别到包含店铺名称的排名数据");
    expect(routerSource).not.toMatch(
      /tiktok_competitor_import_drafts[\s\S]{0,800}\b(BLOB|LONGBLOB|MEDIUMBLOB)\b/i
    );
  });

  it("lists only active pending drafts and enforces owner or administrator access", () => {
    expect(routerSource).toContain("listImportDrafts: protectedProcedure");
    expect(routerSource).toContain(
      "status='pending' AND (expiresAt IS NULL OR expiresAt>CURRENT_TIMESTAMP)"
    );
    expect(routerSource).toContain(
      "上次正式保存中断，草稿已自动恢复，可重新确认"
    );
    expect(routerSource).toContain("只能放弃自己上传的待确认草稿");
    expect(routerSource).toContain("只能提交自己上传的待确认草稿");
    expect(routerSource).toContain("action:'ranking_draft_discarded'");
  });

  it("claims a draft atomically and prevents concurrent or duplicate formal imports", () => {
    expect(routerSource).toContain("SET status='committing',errorMessage=NULL");
    expect(routerSource).toContain(
      "status='committing' AND updatedAt<DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 15 MINUTE)"
    );
    expect(routerSource).toContain(
      "competitorRowsSha256(draftRows)!==String(draft.rowsSha256)"
    );
    expect(routerSource).toContain(
      "findDuplicateCompetitorBatch(pool,date,String(draft.fileSha256))"
    );
    expect(routerSource).toContain(
      "SET status='committed',committedSnapshotId=?"
    );
    expect(routerSource).toContain("SET status='pending',errorMessage=?");
    expect(routerSource).toContain(
      "草稿保存为正式批次失败，草稿已保留，可稍后重试"
    );
  });

  it("restores the full 13-column preview after return or refresh without auto-committing", () => {
    expect(pageSource).toContain("listImportDrafts.useQuery");
    expect(pageSource).toContain("pendingFromDraft");
    expect(pageSource).toContain("草稿已保存，返回或刷新后仍保留");
    expect(pageSource).toContain("持续保留到确认或主动放弃");
    expect(pageSource).toContain("上传字段识别明细（13列）");
    expect(pageSource).toContain("confirmImport=async");
    expect(pageSource).toContain(
      "commitDraft.mutateAsync({draftId:item.draftId})"
    );
    expect(pageSource).toContain(
      "discardDraft.mutateAsync({draftId:item.draftId})"
    );
    const uploadFlow = pageSource.slice(
      pageSource.indexOf("const handleFiles="),
      pageSource.indexOf("const confirmImport=")
    );
    expect(uploadFlow).toContain("uploadRanking.mutateAsync");
    expect(uploadFlow).not.toContain("commitDraft.mutateAsync");
  });
});
