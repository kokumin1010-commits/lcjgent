import mysql, {
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { runDatabaseBackup } from "./databaseBackupScheduler";

const RECOVERY_KEY = "lcj-brain-knowledge-recovery-v1-2026-08-26";
const PRE_BACKUP_REASON = "pre-lcj-brain-recovery-v1";
const POST_BACKUP_REASON = "post-lcj-brain-recovery-v1";
const SOURCE_PREFIX = "lcj-recovery:";

type KnowledgeSeed = {
  sourceFileName: string;
  title: string;
  category: "sop" | "brand" | "other";
  content: string;
  summary: string;
  tags: string[];
};

const STATIC_KNOWLEDGE: KnowledgeSeed[] = [
  {
    sourceFileName: `${SOURCE_PREFIX}static:bd-handbook`,
    title: "LCJブランド招商 成交宝典（復旧版）",
    category: "sop",
    summary:
      "LCJのブランド営業における核心理念、顧客心理、交渉原則、禁止事項をまとめた公式運用知識。",
    tags: ["LCJ", "BD", "招商", "成交宝典", "営業"],
    content: `# LCJブランド招商 成交宝典\n\n## 核心理念\nBDは単なる販売ではなく、ブランドの課題を診断して処方する「医師型BD」である。まず問診し、その後に提案する。\n\n## 顧客心理\n- 顧客は支出自体より、無駄な支出を恐れている。\n- ROIを安易に約束せず、成果を構成する各工程へ分解して説明する。\n- 純コミッションを希望する顧客には、純コミッションと運営型プロジェクトは別サービスであることを明確にする。\n- 値下げ要求は担当者の自信と根拠を確認する行為でもある。\n- 反論時こそ専門性、安心感、安定した態度が重要である。\n\n## 交渉原則\n- 交渉は価格だけでなく、優先度、責任範囲、進行速度、成果条件を含む。\n- 顧客が「高い」と言った直後に値下げせず、プロジェクトの目的と価値へ話を戻す。\n- 強引さではなく、根拠を示して進行のリズムを主導する。\n\n## 禁止事項\n- 根拠のないGMVやROIを約束しない。\n- 「日本トップMCN」など抽象的な自社自慢だけで提案しない。\n- 顧客情報を確認せずに定型提案を押し込まない。`,
  },
  {
    sourceFileName: `${SOURCE_PREFIX}static:diagnosis-sop`,
    title: "ブランド問診12問・BDフォローSOP（復旧版）",
    category: "sop",
    summary: "初回接触から契約までの問診項目と4段階フォロー手順。",
    tags: ["問診", "SOP", "フォロー", "ブランド", "契約"],
    content: `# ブランド問診\n\n1. TikTok日本ショップの有無\n2. 日本法人・中国法人のどちらか\n3. 日本国内在庫の有無\n4. 現在販売している市場\n5. 中国市場での販売実績\n6. 粗利率と値引き余地\n7. クリエイター報酬を負担できるか\n8. 小規模テストから拡大する方式を受け入れられるか\n9. 最優先課題が認知、販売、チャネル参入のどれか\n10. ライブ／クリエイター施策の経験\n11. 物流、返品、CS体制\n12. 意思決定者と希望開始時期\n\n# フォローSOP\n\n1. 初回接触：会社紹介を急がず問診する。\n2. 2回目：診断レポートと根拠付き提案を送る。\n3. 3回目：条件、責任範囲、KPIを交渉する。\n4. 4回目：合意事項を確認し契約へ進める。`,
  },
  {
    sourceFileName: `${SOURCE_PREFIX}static:product-score`,
    title: "TikTok向け製品評価 6軸（復旧版）",
    category: "sop",
    summary: "ライブコマース適合性を判定する6つの評価軸。",
    tags: ["製品評価", "TikTok", "ライブコマース", "6軸"],
    content: `# TikTok向け製品評価 6軸\n\n1. 停留率：3秒で視聴を継続させる視覚的刺激やデモがあるか。\n2. 表現力：ライバーが短時間で特徴、差分、利用場面を説明できるか。\n3. 客単価：配信・物流・広告コストを吸収しながら衝動購入される価格帯か。\n4. 粗利：コミッション、プラットフォーム手数料、広告、配送、返品を引いても利益が残るか。\n5. 物流：日本向け包装、納期、破損、返品対応が安定しているか。\n6. リピート：継続購入が見込め、長期運営に適しているか。`,
  },
  {
    sourceFileName: `${SOURCE_PREFIX}static:objection-handling`,
    title: "BD反論対応・話術原則（復旧版）",
    category: "sop",
    summary: "高い、純コミッション、効果不安、競合比較、決断延期への対応原則。",
    tags: ["話術", "反論対応", "価格", "純佣", "競合"],
    content: `# 反論対応\n\n## 「高い」\n価格をすぐ弁解せず、顧客が実現したい成果、必要な工程、LCJが負う責任へ戻す。料金の内訳と省けない工程を示す。\n\n## 「純コミッションだけにしたい」\n純コミッションは優先度、運営責任、検証速度が異なる別モデルであると説明する。希望条件に応じてテスト範囲と双方の負担を明確にする。\n\n## 「効果が不安」\n保証できない数字を約束せず、商品力、価格、コンテンツ、ライバー、広告、在庫の各変数と検証計画を提示する。\n\n## 競合比較\n表面的な価格比較を避け、提供範囲、担当体制、速度、データ、改善責任を同じ条件にそろえて比較する。\n\n## 決断延期\n意思決定に不足している情報、社内承認者、期限、次回アクションを具体化する。`,
  },
  {
    sourceFileName: `${SOURCE_PREFIX}static:data-sources`,
    title: "LCJ Brain 接続データソース一覧（復旧版）",
    category: "other",
    summary: "LCJ Brainが業務回答時に参照する主要マスターと実績データ。",
    tags: ["LCJ Brain", "データソース", "Tool Calling"],
    content: `# LCJ Brain 接続データソース\n\nブランド・契約：ブランド管理、契約管理、商品マスター、広告実績。\nライバー・配信：ライバー管理、配信実績、月別実績、業績ランキング、短動画管理。\nスケジュール：配信スケジュール、配信シミュレーター。\nBD・営業：BD知識、知識庫、名刺、営業活動・コール履歴。\nタスク・日報：タスク管理、日報、スタッフ情報。\nEC・MALL：注文、商品、ポイント、レシート、LCJコイン。\nマーケティング：広告ダッシュボード、TikTok広告、ステップメール。\nその他：LINE管理、選品センター、24H商品ラボ、メガチャンネル。\n\nAIは質問内容を分析し、必要なデータソースを選択して横断的に参照する。`,
  },
];

function valueOrDash(value: unknown): string {
  const normalized =
    value === null || value === undefined ? "" : String(value).trim();
  return normalized || "未登録";
}

function compactTags(values: unknown[]): string[] {
  return [
    ...new Set(values.map(value => String(value || "").trim()).filter(Boolean)),
  ].slice(0, 12);
}

function brandToSeed(brand: RowDataPacket): KnowledgeSeed {
  const displayName = valueOrDash(brand.name);
  const sourceFileName = `${SOURCE_PREFIX}brand:${Number(brand.id)}`;
  const tags = compactTags([
    displayName,
    brand.nameJa,
    brand.companyName,
    brand.category,
    brand.materialCategory,
    brand.status,
    brand.larkStage,
    brand.larkTier,
    brand.larkCategory,
  ]);
  const content = [
    `# ブランド基本情報`,
    `ブランド名: ${displayName}`,
    `日本語名: ${valueOrDash(brand.nameJa)}`,
    `会社名: ${valueOrDash(brand.companyName)}`,
    `カテゴリ: ${valueOrDash(brand.category)}`,
    `商材カテゴリ: ${valueOrDash(brand.materialCategory)}`,
    `進行ステータス: ${valueOrDash(brand.status)}`,
    `Larkステージ: ${valueOrDash(brand.larkStage)}`,
    `Lark Tier: ${valueOrDash(brand.larkTier)}`,
    `Larkカテゴリ: ${valueOrDash(brand.larkCategory)}`,
    `ブランド紹介: ${valueOrDash(brand.larkIntro)}`,
    `社内メモ: ${valueOrDash(brand.memo)}`,
    "",
    "この文書は復旧時点のブランドマスターから自動再構築された。最新状態はブランド管理の実データを優先する。",
  ].join("\n");
  return {
    sourceFileName,
    title: `ブランド資料: ${displayName}`,
    category: "brand",
    summary: `${valueOrDash(brand.status)} / ${valueOrDash(brand.category)} / ${valueOrDash(brand.materialCategory)}`,
    tags,
    content,
  };
}

async function ensureRecoveryRunTable(connection: Connection): Promise<void> {
  await connection.execute(`CREATE TABLE IF NOT EXISTS lcj_brain_recovery_runs (
    recoveryKey VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details JSON DEFAULT NULL,
    startedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completedAt TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (recoveryKey)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function verifyBackup(
  connection: Connection,
  reason: string
): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT status, tableCount, rowCount, completedAt
       FROM db_backup_runs
      WHERE reason = ?
      ORDER BY id DESC
      LIMIT 1`,
    [reason]
  );
  if (!rows[0] || rows[0].status !== "success") {
    throw new Error(
      `required LCJ Brain backup did not complete successfully: ${reason}`
    );
  }
}

async function runVerifiedBackup(
  connection: Connection,
  reason: string
): Promise<void> {
  await runDatabaseBackup(reason, { force: true, waitForActive: true });
  await verifyBackup(connection, reason);
}

async function loadBrands(connection: Connection): Promise<RowDataPacket[]> {
  const [rows] = await connection.query<RowDataPacket[]>(`
    SELECT id, name, nameJa, companyName, category, materialCategory, status,
           larkStage, larkTier, larkCategory, larkIntro, memo
      FROM brands
     ORDER BY id
  `);
  return rows;
}

async function getRecoveredCount(connection: Connection): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS rowCount FROM lcj_brain_knowledge WHERE sourceFileName LIKE ?",
    [`${SOURCE_PREFIX}%`]
  );
  return Number(rows[0]?.rowCount || 0);
}

async function upsertKnowledge(
  connection: Connection,
  seed: KnowledgeSeed,
  uploadedBy: number | null
): Promise<"inserted" | "updated"> {
  const [existing] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM lcj_brain_knowledge WHERE sourceFileName = ? ORDER BY id LIMIT 1",
    [seed.sourceFileName]
  );
  const values = [
    seed.title,
    seed.category,
    seed.content,
    seed.summary,
    JSON.stringify(seed.tags),
    uploadedBy,
    "LCJ Brain Recovery",
  ];
  if (existing[0]?.id) {
    await connection.execute(
      `UPDATE lcj_brain_knowledge
          SET title = ?, category = ?, content = ?, summary = ?, tags = ?,
              uploadedBy = ?, uploadedByName = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [...values, Number(existing[0].id)]
    );
    return "updated";
  }
  await connection.execute<ResultSetHeader>(
    `INSERT INTO lcj_brain_knowledge
      (title, category, content, summary, participants, tags, meetingDate,
       sourceFileName, uploadedBy, uploadedByName, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      seed.title,
      seed.category,
      seed.content,
      seed.summary,
      JSON.stringify(seed.tags),
      seed.sourceFileName,
      uploadedBy,
      "LCJ Brain Recovery",
    ]
  );
  return "inserted";
}

export async function getLcjBrainDataRecoveryHealth() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for LCJ Brain recovery health");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureRecoveryRunTable(connection);
    const [counts] = await connection.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM brands) AS brands,
        (SELECT COUNT(*) FROM lcj_brain_knowledge) AS knowledge,
        (SELECT COUNT(*) FROM lcj_brain_knowledge WHERE sourceFileName LIKE '${SOURCE_PREFIX}%') AS recoveredKnowledge,
        (SELECT COUNT(*) FROM lcj_brain_chat_logs) AS chatLogs,
        (SELECT COUNT(*) FROM lcj_brain_conversations) AS conversations
    `);
    const [runs] = await connection.query<RowDataPacket[]>(
      "SELECT status, details, startedAt, completedAt FROM lcj_brain_recovery_runs WHERE recoveryKey = ? LIMIT 1",
      [RECOVERY_KEY]
    );
    const row = counts[0] || {};
    const expectedRecoveredKnowledge =
      Number(row.brands || 0) + STATIC_KNOWLEDGE.length;
    return {
      recoveryKey: RECOVERY_KEY,
      expectedRecoveredKnowledge,
      actual: {
        brands: Number(row.brands || 0),
        knowledge: Number(row.knowledge || 0),
        recoveredKnowledge: Number(row.recoveredKnowledge || 0),
        chatLogs: Number(row.chatLogs || 0),
        conversations: Number(row.conversations || 0),
      },
      healthy:
        Number(row.recoveredKnowledge || 0) >= expectedRecoveredKnowledge,
      latestRun: runs[0] || null,
    };
  } finally {
    await connection.end();
  }
}

export async function runLcjBrainDataRecovery(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required for LCJ Brain data recovery");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    await ensureRecoveryRunTable(connection);
    const before = await getRecoveredCount(connection);
    const brands = await loadBrands(connection);
    const expected = brands.length + STATIC_KNOWLEDGE.length;
    if (before >= expected) {
      console.log(
        `[LcjBrainRecovery] healthy recoveredKnowledge=${before} expected=${expected}`
      );
      return;
    }

    await connection.execute(
      `INSERT INTO lcj_brain_recovery_runs
        (recoveryKey, status, details, startedAt, completedAt)
       VALUES (?, 'running', ?, CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE status='running', details=VALUES(details), startedAt=CURRENT_TIMESTAMP, completedAt=NULL`,
      [
        RECOVERY_KEY,
        JSON.stringify({
          before,
          brands: brands.length,
          staticKnowledge: STATIC_KNOWLEDGE.length,
        }),
      ]
    );

    await runVerifiedBackup(connection, PRE_BACKUP_REASON);

    const [ownerRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE LOWER(email) = 'ryuhairartist@gmail.com' ORDER BY id LIMIT 1"
    );
    const uploadedBy = ownerRows[0]?.id ? Number(ownerRows[0].id) : null;
    let inserted = 0;
    let updated = 0;

    await connection.beginTransaction();
    try {
      const seeds = [...STATIC_KNOWLEDGE, ...brands.map(brandToSeed)];
      for (const seed of seeds) {
        const outcome = await upsertKnowledge(connection, seed, uploadedBy);
        if (outcome === "inserted") inserted += 1;
        else updated += 1;
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const after = await getRecoveredCount(connection);
    if (after < expected) {
      throw new Error(
        `LCJ Brain knowledge verification failed: recovered=${after}, expected=${expected}`
      );
    }

    await runVerifiedBackup(connection, POST_BACKUP_REASON);

    const details = {
      before,
      after,
      expected,
      brands: brands.length,
      staticKnowledge: STATIC_KNOWLEDGE.length,
      inserted,
      updated,
      chatRecovery: "not-available-no-pre-incident-backup",
    };
    await connection.execute(
      `UPDATE lcj_brain_recovery_runs
          SET status='success', details=?, completedAt=CURRENT_TIMESTAMP
        WHERE recoveryKey=?`,
      [JSON.stringify(details), RECOVERY_KEY]
    );
    console.log(`[LcjBrainRecovery] success ${JSON.stringify(details)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await connection
      .execute(
        `UPDATE lcj_brain_recovery_runs
          SET status='failed', details=?, completedAt=CURRENT_TIMESTAMP
        WHERE recoveryKey=?`,
        [JSON.stringify({ error: message.slice(0, 3000) }), RECOVERY_KEY]
      )
      .catch(() => undefined);
    console.error("[LcjBrainRecovery] failed", error);
    throw error;
  } finally {
    await connection.end();
  }
}
