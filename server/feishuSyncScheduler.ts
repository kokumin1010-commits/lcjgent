import { getDb } from "./db";
import { brands, feishuSyncHistory } from "../drizzle/schema";
import { eq, or, sql, isNull } from "drizzle-orm";

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
 * ブランド名を正規化してマッチング用のキーを生成
 * - 大文字小文字統一
 * - カッコ内の補足を除去
 * - スペース統一
 * - 全角半角統一
 */
function normalizeBrandName(name: string): string {
  let n = name.trim();
  // カッコ内の補足を除去 (英語・日本語カッコ両方)
  n = n.replace(/[\(（].*?[\)）]/g, '');
  // 全角英数字を半角に変換
  n = n.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  // 小文字に統一
  n = n.toLowerCase();
  // スペースを統一して除去
  n = n.replace(/[\s\u3000]+/g, '');
  // 末尾の特殊文字を除去
  n = n.replace(/[・\-_]+$/, '');
  return n;
}

/**
 * 2つのブランド名が同一ブランドかどうかを判定
 * - 正規化後の完全一致
 * - 正規化後の前方一致（短い方が3文字以上の場合のみ）
 * - 正規化後の包含一致（短い方が4文字以上の場合のみ）
 */
function isSameBrand(name1: string, name2: string): boolean {
  const n1 = normalizeBrandName(name1);
  const n2 = normalizeBrandName(name2);
  
  if (!n1 || !n2) return false;
  
  // 完全一致
  if (n1 === n2) return true;
  
  const shorter = n1.length <= n2.length ? n1 : n2;
  const longer = n1.length <= n2.length ? n2 : n1;
  
  // 短い方が3文字未満の場合はマッチしない（誤マッチ防止）
  if (shorter.length < 3) return false;
  
  // 前方一致（短い方が長い方の先頭と一致）
  if (longer.startsWith(shorter) && shorter.length >= 4) return true;
  
  // 包含一致（短い方が4文字以上で長い方に含まれる）
  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  
  return false;
}

/**
 * 飛書同期を実行し、履歴をDBに記録する
 * 改善版: ブランド名の正規化マッチングにより重複作成を防止
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

    // ========== 全既存ブランドを事前にロード（マッチング用） ==========
    const allExistingBrands = await db.select({
      id: brands.id,
      name: brands.name,
      larkRecordId: brands.larkRecordId,
    }).from(brands).where(isNull(brands.deletedAt));

    // larkRecordId → brand のマップ
    const byRecordId = new Map<string, { id: number; name: string }>();
    for (const b of allExistingBrands) {
      if (b.larkRecordId) {
        byRecordId.set(b.larkRecordId, { id: b.id, name: b.name });
      }
    }

    for (const larkBrand of larkBrands) {
      try {
        // ========== タスク/メモレコードのフィルタリング ==========
        const isTaskRecord = larkBrand.brandName.includes('<') || larkBrand.brandName.includes('＜');
        
        if (isTaskRecord) {
          const separator = larkBrand.brandName.includes('<') ? '<' : '＜';
          const parts = larkBrand.brandName.split(separator);
          const actualBrandName = (parts[1] || '').trim();
          
          if (actualBrandName) {
            // 正規化マッチングで既存ブランドを検索
            const matchedBrand = allExistingBrands.find(b => isSameBrand(b.name, actualBrandName));
            
            if (matchedBrand) {
              const taskInfo = parts[0].trim();
              // 既存ブランドのlarkIntroにタスク情報を追記
              const existingBrand = await db.select().from(brands)
                .where(eq(brands.id, matchedBrand.id))
                .limit(1);
              if (existingBrand.length > 0) {
                const currentIntro = existingBrand[0].larkIntro || '';
                if (!currentIntro.includes(taskInfo)) {
                  const updatedIntro = currentIntro ? `${currentIntro}\n[タスク] ${taskInfo}` : `[タスク] ${taskInfo}`;
                  await db.update(brands)
                    .set({ larkIntro: updatedIntro, larkSyncedAt: new Date() })
                    .where(eq(brands.id, matchedBrand.id));
                }
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

        // ========== 改善版マッチングロジック ==========
        // 優先度1: larkRecordIdで完全一致
        let matchedBrand = byRecordId.get(larkBrand.recordId);
        
        // 優先度2: ブランド名の正規化マッチング（全既存ブランドと比較）
        if (!matchedBrand) {
          const nameMatch = allExistingBrands.find(b => isSameBrand(b.name, larkBrand.brandName));
          if (nameMatch) {
            matchedBrand = { id: nameMatch.id, name: nameMatch.name };
          }
        }

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

        if (matchedBrand) {
          // ========== 既存ブランドを更新（新規作成しない） ==========
          await db.update(brands)
            .set({
              ...larkFields,
              status: mapLarkStageToStatus(larkBrand.stage),
            })
            .where(eq(brands.id, matchedBrand.id));
          updated++;
          
          // byRecordIdマップも更新（同じrecordIdで再マッチしないように）
          byRecordId.set(larkBrand.recordId, matchedBrand);
        } else {
          // ========== 新規作成（既存に一致するブランドがない場合のみ） ==========
          const result = await db.insert(brands).values({
            name: larkBrand.brandName,
            nameJa: larkBrand.brandName,
            status: mapLarkStageToStatus(larkBrand.stage),
            materialCategory: larkBrand.category || undefined,
            ...larkFields,
            createdBy: 1, // System user
          });
          created++;
          
          // 新規作成したブランドもallExistingBrandsとbyRecordIdに追加
          const newId = (result as any)[0]?.insertId || 0;
          if (newId) {
            allExistingBrands.push({ id: newId, name: larkBrand.brandName, larkRecordId: larkBrand.recordId });
            byRecordId.set(larkBrand.recordId, { id: newId, name: larkBrand.brandName });
          }
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
