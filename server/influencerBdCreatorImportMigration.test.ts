import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("./databaseBackupScheduler", () => ({ runDatabaseBackup: vi.fn() }));

import { getInfluencerBdSchemaState } from "./influencerBdUpgrade";

const source = readFileSync(new URL("./influencerBdUpgrade.ts", import.meta.url), "utf8");

describe("influencer creator import schema upgrade", () => {
  it("uses a new recovery revision and includes both security tables in health checks", () => {
    expect(source).toContain('const UPGRADE_KEY = "influencer-bd-v2"');
    expect(source).toContain('"influencer_bd_creator_import_previews"');
    expect(source).toContain('"influencer_bd_import_rate_limits"');
    expect(source).toContain("CREATE TABLE IF NOT EXISTS influencer_bd_creator_import_previews");
    expect(source).toContain("tokenHash CHAR(64) PRIMARY KEY");
    expect(source).toContain("rowHashesJson JSON NOT NULL");
    expect(source).toContain("consumedAt TIMESTAMP NULL");
    expect(source).toContain("CREATE TABLE IF NOT EXISTS influencer_bd_import_rate_limits");
    expect(source).toContain('influencer_bd_campaigns: ["storeId"]');
    expect(source).toContain("ADD COLUMN storeId INT NULL AFTER brandId");
    expect(source).toContain("missingColumns");
    expect(source).toContain("missingIndexes");
    expect(source).toContain("INFORMATION_SCHEMA.STATISTICS");
    expect(source).toContain("ADD UNIQUE INDEX uq_influencer_bd_creator_handle");
    expect(source).toContain("ADD PRIMARY KEY (tokenHash)");
  });

  it("retains verified pre/post backup and no-business-row-change safeguards", () => {
    expect(source).toContain("await verifiedBackup(pool, PRE_REASON)");
    expect(source).toContain("await verifiedBackup(pool, POST_REASON)");
    expect(source).toContain("existingBusinessRowsModified: 0");
  });

  it("reports a missing campaign column and a non-unique creator handle index", async () => {
    const tables = [
      "influencer_bd_campaigns", "influencer_bd_creators", "influencer_bd_creator_import_previews",
      "influencer_bd_import_rate_limits", "influencer_bd_outreach_logs", "influencer_bd_attachments",
      "influencer_bd_ai_analyses", "influencer_bd_analysis_feedback", "influencer_bd_settings", "influencer_bd_audit_logs",
    ];
    const columns = [
      ...["tokenHash", "actorId", "rowHashesJson", "eligibleCount", "expiresAt", "consumedAt", "createdAt"].map(columnName => ({ tableName: "influencer_bd_creator_import_previews", columnName })),
      ...["bucketHash", "windowStartedAt", "attempts", "updatedAt"].map(columnName => ({ tableName: "influencer_bd_import_rate_limits", columnName })),
    ];
    const indexes = [
      { tableName: "influencer_bd_creators", indexName: "uq_influencer_bd_creator_handle", columnName: "platform", sequenceNumber: 1, nonUnique: 1 },
      { tableName: "influencer_bd_creators", indexName: "uq_influencer_bd_creator_handle", columnName: "normalizedHandle", sequenceNumber: 2, nonUnique: 1 },
      { tableName: "influencer_bd_creator_import_previews", indexName: "PRIMARY", columnName: "tokenHash", sequenceNumber: 1, nonUnique: 0 },
      { tableName: "influencer_bd_creator_import_previews", indexName: "idx_influencer_bd_import_preview_expiry", columnName: "expiresAt", sequenceNumber: 1, nonUnique: 1 },
      { tableName: "influencer_bd_creator_import_previews", indexName: "idx_influencer_bd_import_preview_expiry", columnName: "consumedAt", sequenceNumber: 2, nonUnique: 1 },
      { tableName: "influencer_bd_import_rate_limits", indexName: "PRIMARY", columnName: "bucketHash", sequenceNumber: 1, nonUnique: 0 },
      { tableName: "influencer_bd_import_rate_limits", indexName: "idx_influencer_bd_import_rate_updated", columnName: "updatedAt", sequenceNumber: 1, nonUnique: 1 },
    ];
    const pool = { query: vi.fn()
      .mockResolvedValueOnce([tables.map(tableName => ({ tableName })), []])
      .mockResolvedValueOnce([columns, []])
      .mockResolvedValueOnce([indexes, []]) };
    const state = await getInfluencerBdSchemaState(pool as any);
    expect(state.missing).toEqual([]);
    expect(state.missingColumns).toContain("influencer_bd_campaigns.storeId");
    expect(state.missingIndexes).toContain("influencer_bd_creators.uq_influencer_bd_creator_handle");
  });
});
