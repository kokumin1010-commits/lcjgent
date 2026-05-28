import { getDb } from "./db";
import { brands, feishuSyncHistory } from "../drizzle/schema";
import { eq, or, sql } from "drizzle-orm";

const SIX_HOURS = 6 * 60 * 60 * 1000; // 6時間

/**
 * 飛書自動同期スケジューラ
 * - サーバー起動5分後に初回同期実行
 * - その後6時間ごとに自動同期
 */
export function startFeishuSyncScheduler() {
  console.log("[Feishu Sync] Starting auto-sync scheduler (runs every 6 hours)...");

  // 起動5分後に初回実行（サーバー安定後）
  setTimeout(() => {
    runFeishuSync("auto").catch(err => {
      console.error("[Feishu Sync] Initial sync failed:", err?.message);
    });
  }, 5 * 60 * 1000);

  // 6時間ごとに定期実行
  setInterval(() => {
    runFeishuSync("auto").catch(err => {
      console.error("[Feishu Sync] Scheduled sync failed:", err?.message);
    });
  }, SIX_HOURS);
}

/**
 * 飛書同期を実行し、履歴をDBに記録する
 */
export async function runFeishuSync(triggeredBy: "auto" | "manual" = "auto"): Promise<{
  total: number;
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}> {
  const startTime = Date.now();
  const db = await getDb();

  try {
    const { fetchFeishuBrands, mapLarkStageToStatus, isFeishuConfigured } = await import("./feishuService");

    if (!isFeishuConfigured()) {
      console.log("[Feishu Sync] Not configured, skipping...");
      return { total: 0, synced: 0, created: 0, updated: 0, errors: ["飛書APIが設定されていません"] };
    }

    console.log(`[Feishu Sync] Starting ${triggeredBy} sync...`);
    const larkBrands = await fetchFeishuBrands();
    let synced = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors: string[] = [];

    for (const larkBrand of larkBrands) {
      try {
        // ========== タスク/メモレコードのフィルタリング ==========
        // パターン: 「タスク内容 < ブランド名」はタスクレコードであり、ブランドではない
        const isTaskRecord = larkBrand.brandName.includes('<') || larkBrand.brandName.includes('＜');
        
        if (isTaskRecord) {
          // < の右側からブランド名を抽出して既存ブランドに紐付け試行
          const separator = larkBrand.brandName.includes('<') ? '<' : '＜';
          const parts = larkBrand.brandName.split(separator);
          const actualBrandName = (parts[1] || '').trim();
          
          if (actualBrandName) {
            // 既存ブランドが見つかれば、タスク情報をlarkIntroに追記（ブランド自体は作成しない）
            const existingBrand = await db.select().from(brands)
              .where(eq(brands.name, actualBrandName))
              .limit(1);
            
            if (existingBrand.length > 0) {
              // 既存ブランドにタスク情報を追記（larkIntroにのみ）
              const taskInfo = parts[0].trim();
              const currentIntro = existingBrand[0].larkIntro || '';
              if (!currentIntro.includes(taskInfo)) {
                const updatedIntro = currentIntro ? `${currentIntro}\n[タスク] ${taskInfo}` : `[タスク] ${taskInfo}`;
                await db.update(brands)
                  .set({ larkIntro: updatedIntro, larkSyncedAt: new Date() })
                  .where(eq(brands.id, existingBrand[0].id));
              }
            }
          }
          skipped++;
          continue;
        }

        // ブランド名が空、Unknown、または明らかに無効なレコードをスキップ
        if (!larkBrand.brandName || larkBrand.brandName === 'Unknown' || larkBrand.brandName.length > 80) {
          skipped++;
          continue;
        }

        // 既存ブランドをlarkRecordIdまたは名前で検索
        const existing = await db.select().from(brands)
          .where(
            or(
              eq(brands.larkRecordId, larkBrand.recordId),
              eq(brands.name, larkBrand.brandName)
            )
          )
          .limit(1);

        const larkFields = {
          larkRecordId: larkBrand.recordId,
          larkStage: larkBrand.stage,
          larkTier: larkBrand.tier,
          larkCategory: larkBrand.category,
          larkContactPlatform: larkBrand.contactPlatform,
          larkBrandManager: larkBrand.brandManager,
          larkBusinessContact: larkBrand.businessContact,
          larkBusinessLead: larkBrand.businessLead,
          larkOperationsContact: larkBrand.operationsContact,
          larkShopId: larkBrand.shopId,
          larkIntro: larkBrand.intro,
          larkSyncedAt: new Date(),
        };

        if (existing.length > 0) {
          // 更新（飞書データを優先）
          await db.update(brands)
            .set({
              ...larkFields,
              status: mapLarkStageToStatus(larkBrand.stage),
              materialCategory: larkBrand.category || existing[0].materialCategory,
            })
            .where(eq(brands.id, existing[0].id));
          updated++;
        } else {
          // 新規作成
          await db.insert(brands).values({
            name: larkBrand.brandName,
            nameJa: larkBrand.brandName,
            status: mapLarkStageToStatus(larkBrand.stage),
            materialCategory: larkBrand.category || undefined,
            ...larkFields,
            createdBy: 1, // System user
          });
          created++;
        }
        synced++;
      } catch (err: any) {
        errors.push(`${larkBrand.brandName}: ${err.message}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // 同期履歴をDBに記録
    await saveSyncHistory(db, {
      syncType: "brands",
      status: "success",
      totalRecords: larkBrands.length,
      newRecords: created,
      updatedRecords: updated,
      triggeredBy,
      durationMs,
      errorMessage: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
    });

    console.log(`[Feishu Sync] Completed: ${synced}/${larkBrands.length} synced (${created} new, ${updated} updated, ${skipped} skipped) in ${durationMs}ms`);

    return { total: larkBrands.length, synced, created, updated, errors: errors.slice(0, 10) };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;

    // エラー履歴をDBに記録
    await saveSyncHistory(db, {
      syncType: "brands",
      status: "error",
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      triggeredBy,
      durationMs,
      errorMessage: err?.message || "Unknown error",
    });

    console.error(`[Feishu Sync] Failed:`, err?.message);
    throw err;
  }
}

/**
 * 同期履歴をDBに保存（テーブルが存在しない場合は自動作成）
 */
async function saveSyncHistory(db: any, data: {
  syncType: string;
  status: string;
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  triggeredBy: string;
  durationMs: number;
  errorMessage: string | null;
}) {
  try {
    // テーブルが存在するか確認し、なければ作成
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feishu_sync_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        syncType VARCHAR(50) NOT NULL DEFAULT 'brands',
        status VARCHAR(20) NOT NULL DEFAULT 'success',
        totalRecords INT NOT NULL DEFAULT 0,
        newRecords INT NOT NULL DEFAULT 0,
        updatedRecords INT NOT NULL DEFAULT 0,
        errorMessage TEXT,
        triggeredBy VARCHAR(50) NOT NULL DEFAULT 'auto',
        durationMs INT DEFAULT 0,
        syncedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.insert(feishuSyncHistory).values(data);
  } catch (err: any) {
    console.error("[Feishu Sync] Failed to save sync history:", err?.message);
  }
}
