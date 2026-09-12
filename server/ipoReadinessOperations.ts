import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

export type IpoWorkstream =
  | "finance_close"
  | "audit"
  | "internal_control"
  | "governance"
  | "legal_disclosure"
  | "information_systems"
  | "capital_markets";
export type IpoTaskPriority = "low" | "medium" | "high" | "critical";
export type IpoTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type IpoBoardReportStatus = "draft" | "final";

export type IpoActor = { id?: number | null; name?: string | null };
export type IpoEvidence = { label: string; url: string };

export type IpoMonthlyPlanInput = {
  month: string;
  revenueTargetJpy?: number | null;
  grossProfitTargetJpy?: number | null;
  operatingProfitTargetJpy?: number | null;
  note?: string | null;
};

export type IpoReadinessSettingsInput = {
  targetOperatingMarginPct?: number | null;
  downsideFactor: number;
  baseFactor: number;
  upsideFactor: number;
  monthlyCloseDueDay: number;
};

export type IpoReadinessTaskInput = {
  id?: number;
  workstream: IpoWorkstream;
  title: string;
  description?: string | null;
  ownerName?: string | null;
  priority: IpoTaskPriority;
  status: IpoTaskStatus;
  progress: number;
  dueDate?: string | null;
  blocker?: string | null;
  evidence: IpoEvidence[];
};

export type IpoBoardReportInput = {
  asOfMonth: string;
  title: string;
  status: IpoBoardReportStatus;
  summary: Record<string, unknown>;
};

const TASK_TEMPLATES: Array<{
  templateKey: string;
  workstream: IpoWorkstream;
  title: string;
  description: string;
  priority: IpoTaskPriority;
  sortOrder: number;
}> = [
  { templateKey: "monthly-close-policy", workstream: "finance_close", title: "月次決算と会計方針を固定", description: "売上、売上原価、在庫、未収未払、減価償却、税金を含む月次決算手順と締切を文書化する。", priority: "critical", sortOrder: 10 },
  { templateKey: "bank-reconciliation", workstream: "finance_close", title: "銀行残高と会計帳簿を毎月照合", description: "全口座の銀行残高、会計帳簿、内部送金の差異を月次で解消し、証拠を保存する。", priority: "critical", sortOrder: 20 },
  { templateKey: "inventory-ar-ap", workstream: "finance_close", title: "在庫・売掛・買掛の月次照合", description: "在庫評価、売掛金回収、買掛金残高の明細と総勘定元帳を一致させる。", priority: "high", sortOrder: 30 },
  { templateKey: "audit-firm-plan", workstream: "audit", title: "監査法人と監査計画を確定", description: "監査法人、監査対象期間、提出資料、期中レビューと期末監査の日程を確定する。", priority: "critical", sortOrder: 40 },
  { templateKey: "audit-evidence-room", workstream: "audit", title: "監査証拠一覧を整備", description: "財務諸表、銀行、請求書、契約、在庫、税務、取締役会資料の証拠所在を一覧化する。", priority: "high", sortOrder: 50 },
  { templateKey: "related-party-register", workstream: "legal_disclosure", title: "関連当事者取引台帳を整備", description: "役員、株主、グループ会社との取引を識別し、承認、価格根拠、開示資料を保存する。", priority: "critical", sortOrder: 60 },
  { templateKey: "board-governance", workstream: "governance", title: "取締役会運営と規程を整備", description: "取締役会の権限、開催、議事録、決裁基準、利益相反管理を継続運用する。", priority: "high", sortOrder: 70 },
  { templateKey: "whistleblowing", workstream: "governance", title: "内部通報と不祥事対応を整備", description: "通報窓口、匿名性、調査、是正、再発防止と取締役会報告の手順を文書化する。", priority: "high", sortOrder: 80 },
  { templateKey: "internal-controls", workstream: "internal_control", title: "主要業務プロセスの内部統制を文書化", description: "売上、購買、在庫、給与、支払、IT権限の承認、実行、記録、照合を分離する。", priority: "critical", sortOrder: 90 },
  { templateKey: "access-control", workstream: "information_systems", title: "システム権限と変更管理を整備", description: "入退社、特権ID、二次認証、変更承認、ログ保全、バックアップ復旧を定期点検する。", priority: "high", sortOrder: 100 },
  { templateKey: "contracts-disclosure", workstream: "legal_disclosure", title: "重要契約とリスク開示を整理", description: "重要契約、許認可、紛争、個人情報、知的財産と事業リスクの証拠を一覧化する。", priority: "high", sortOrder: 110 },
  { templateKey: "capital-policy", workstream: "capital_markets", title: "資本政策と株主構成を確定", description: "完全希薄化後株式数、ストックオプション、資金調達方針、主要株主とロックアップ論点を整理する。", priority: "high", sortOrder: 120 },
  { templateKey: "timely-disclosure", workstream: "capital_markets", title: "適時開示体制を構築", description: "重要事実の収集、判断、承認、開示、インサイダー情報管理の責任者と手順を確定する。", priority: "critical", sortOrder: 130 },
];

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function actorId(actor: IpoActor) {
  const value = Number(actor.id || 0);
  return value > 0 ? value : null;
}

function actorName(actor: IpoActor) {
  return actor.name?.trim().slice(0, 255) || null;
}

async function createTables(db: Pick<Pool, "query"> | Pick<PoolConnection, "query">) {
  await db.query(`CREATE TABLE IF NOT EXISTS ipo_monthly_plans (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    month VARCHAR(7) NOT NULL,
    revenueTargetJpy DECIMAL(18,2) NULL,
    grossProfitTargetJpy DECIMAL(18,2) NULL,
    operatingProfitTargetJpy DECIMAL(18,2) NULL,
    note VARCHAR(1000) NULL,
    createdBy BIGINT NULL,
    updatedBy BIGINT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ipo_monthly_plan_month (month)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS ipo_readiness_settings (
    settingKey VARCHAR(64) NOT NULL PRIMARY KEY,
    targetOperatingMarginPct DECIMAL(8,4) NULL,
    downsideFactor DECIMAL(8,4) NOT NULL DEFAULT 0.8,
    baseFactor DECIMAL(8,4) NOT NULL DEFAULT 1,
    upsideFactor DECIMAL(8,4) NOT NULL DEFAULT 1.2,
    monthlyCloseDueDay INT NOT NULL DEFAULT 10,
    createdBy BIGINT NULL,
    updatedBy BIGINT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS ipo_readiness_tasks (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    templateKey VARCHAR(100) NULL,
    workstream ENUM('finance_close','audit','internal_control','governance','legal_disclosure','information_systems','capital_markets') NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NULL,
    ownerName VARCHAR(255) NULL,
    priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    status ENUM('todo','in_progress','blocked','done') NOT NULL DEFAULT 'todo',
    progress INT NOT NULL DEFAULT 0,
    dueDate DATE NULL,
    blocker TEXT NULL,
    evidenceJson JSON NULL,
    sortOrder INT NOT NULL DEFAULT 0,
    completedAt TIMESTAMP NULL,
    deletedAt TIMESTAMP NULL,
    createdBy BIGINT NULL,
    updatedBy BIGINT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ipo_task_template (templateKey),
    KEY idx_ipo_task_list (workstream,status,dueDate,deletedAt),
    KEY idx_ipo_task_priority (priority,status,dueDate)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS ipo_board_report_snapshots (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    seriesKey VARCHAR(64) NOT NULL,
    asOfMonth VARCHAR(7) NOT NULL,
    versionNumber INT NOT NULL DEFAULT 1,
    title VARCHAR(500) NOT NULL,
    status ENUM('draft','final') NOT NULL DEFAULT 'draft',
    summaryJson JSON NOT NULL,
    generatedBy BIGINT NULL,
    generatedByName VARCHAR(255) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ipo_board_series_version (seriesKey,versionNumber),
    KEY idx_ipo_board_month (asOfMonth,createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.query(`CREATE TABLE IF NOT EXISTS ipo_readiness_audit_logs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    entityType ENUM('monthly_plan','settings','task','board_report') NOT NULL,
    entityId BIGINT NULL,
    action VARCHAR(100) NOT NULL,
    beforeJson JSON NULL,
    afterJson JSON NULL,
    actorId BIGINT NULL,
    actorName VARCHAR(255) NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ipo_audit_entity (entityType,entityId,createdAt),
    KEY idx_ipo_audit_time (createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function seedDefaults(db: Pick<Pool, "query"> | Pick<PoolConnection, "query">) {
  await db.query(`INSERT IGNORE INTO ipo_readiness_settings
    (settingKey,targetOperatingMarginPct,downsideFactor,baseFactor,upsideFactor,monthlyCloseDueDay)
    VALUES ('default',NULL,0.8,1,1.2,10)`);
  for (const task of TASK_TEMPLATES) {
    await db.query(
      `INSERT IGNORE INTO ipo_readiness_tasks
        (templateKey,workstream,title,description,priority,status,progress,sortOrder)
       VALUES (?,?,?,?,?,'todo',0,?)`,
      [task.templateKey, task.workstream, task.title, task.description, task.priority, task.sortOrder],
    );
  }
}

export async function ensureIpoReadinessOperationsSchema(db: Pick<Pool, "query"> | Pick<PoolConnection, "query">) {
  await createTables(db);
  await seedDefaults(db);
}

async function writeAudit(
  connection: PoolConnection,
  input: {
    entityType: "monthly_plan" | "settings" | "task" | "board_report";
    entityId?: number | null;
    action: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    actor: IpoActor;
  },
) {
  await connection.query(
    `INSERT INTO ipo_readiness_audit_logs
      (entityType,entityId,action,beforeJson,afterJson,actorId,actorName)
     VALUES (?,?,?,?,?,?,?)`,
    [
      input.entityType,
      input.entityId ?? null,
      input.action.slice(0, 100),
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      actorId(input.actor),
      actorName(input.actor),
    ],
  );
}

function mapMonthlyPlan(row: any) {
  return {
    id: Number(row.id),
    month: String(row.month),
    revenueTargetJpy: row.revenueTargetJpy == null ? null : Number(row.revenueTargetJpy),
    grossProfitTargetJpy: row.grossProfitTargetJpy == null ? null : Number(row.grossProfitTargetJpy),
    operatingProfitTargetJpy: row.operatingProfitTargetJpy == null ? null : Number(row.operatingProfitTargetJpy),
    note: row.note == null ? null : String(row.note),
    updatedAt: row.updatedAt,
  };
}

function mapTask(row: any) {
  return {
    id: Number(row.id),
    templateKey: row.templateKey == null ? null : String(row.templateKey),
    workstream: row.workstream as IpoWorkstream,
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    ownerName: row.ownerName == null ? null : String(row.ownerName),
    priority: row.priority as IpoTaskPriority,
    status: row.status as IpoTaskStatus,
    progress: Math.max(0, Math.min(100, Number(row.progress || 0))),
    dueDate: row.dueDate == null ? null : String(row.dueDate).slice(0, 10),
    blocker: row.blocker == null ? null : String(row.blocker),
    evidence: parseJson<IpoEvidence[]>(row.evidenceJson, []),
    sortOrder: Number(row.sortOrder || 0),
    completedAt: row.completedAt,
    updatedAt: row.updatedAt,
  };
}

function mapBoardReport(row: any) {
  return {
    id: Number(row.id),
    seriesKey: String(row.seriesKey),
    asOfMonth: String(row.asOfMonth),
    versionNumber: Number(row.versionNumber || 1),
    title: String(row.title),
    status: row.status as IpoBoardReportStatus,
    summary: parseJson<Record<string, unknown>>(row.summaryJson, {}),
    generatedByName: row.generatedByName == null ? null : String(row.generatedByName),
    createdAt: row.createdAt,
  };
}

export async function listIpoReadinessOperations(pool: Pool) {
  await ensureIpoReadinessOperationsSchema(pool);
  const [planResult, settingsResult, taskResult, reportResult] = await Promise.all([
    pool.query<RowDataPacket[]>(`SELECT * FROM ipo_monthly_plans ORDER BY month ASC`),
    pool.query<RowDataPacket[]>(`SELECT * FROM ipo_readiness_settings WHERE settingKey='default' LIMIT 1`),
    pool.query<RowDataPacket[]>(`SELECT * FROM ipo_readiness_tasks WHERE deletedAt IS NULL ORDER BY sortOrder ASC, FIELD(priority,'critical','high','medium','low'), id ASC`),
    pool.query<RowDataPacket[]>(`SELECT * FROM ipo_board_report_snapshots ORDER BY asOfMonth DESC, versionNumber DESC, id DESC LIMIT 24`),
  ]);
  const setting = settingsResult[0][0];
  return {
    monthlyPlans: planResult[0].map(mapMonthlyPlan),
    settings: {
      targetOperatingMarginPct: setting?.targetOperatingMarginPct == null ? null : Number(setting.targetOperatingMarginPct),
      downsideFactor: Number(setting?.downsideFactor || 0.8),
      baseFactor: Number(setting?.baseFactor || 1),
      upsideFactor: Number(setting?.upsideFactor || 1.2),
      monthlyCloseDueDay: Number(setting?.monthlyCloseDueDay || 10),
      updatedAt: setting?.updatedAt || null,
    },
    tasks: taskResult[0].map(mapTask),
    boardReports: reportResult[0].map(mapBoardReport),
  };
}

export async function upsertIpoMonthlyPlan(pool: Pool, input: IpoMonthlyPlanInput, actor: IpoActor) {
  await ensureIpoReadinessOperationsSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [beforeRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ipo_monthly_plans WHERE month=? LIMIT 1 FOR UPDATE`, [input.month]);
    const before = beforeRows[0] ? mapMonthlyPlan(beforeRows[0]) : null;
    await connection.query(
      `INSERT INTO ipo_monthly_plans
        (month,revenueTargetJpy,grossProfitTargetJpy,operatingProfitTargetJpy,note,createdBy,updatedBy)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE revenueTargetJpy=VALUES(revenueTargetJpy),grossProfitTargetJpy=VALUES(grossProfitTargetJpy),
         operatingProfitTargetJpy=VALUES(operatingProfitTargetJpy),note=VALUES(note),updatedBy=VALUES(updatedBy),updatedAt=CURRENT_TIMESTAMP`,
      [
        input.month,
        input.revenueTargetJpy ?? null,
        input.grossProfitTargetJpy ?? null,
        input.operatingProfitTargetJpy ?? null,
        input.note?.trim() || null,
        actorId(actor),
        actorId(actor),
      ],
    );
    const [afterRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ipo_monthly_plans WHERE month=? LIMIT 1`, [input.month]);
    const after = mapMonthlyPlan(afterRows[0]);
    await writeAudit(connection, { entityType: "monthly_plan", entityId: after.id, action: before ? "update" : "create", before, after, actor });
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateIpoReadinessSettings(pool: Pool, input: IpoReadinessSettingsInput, actor: IpoActor) {
  await ensureIpoReadinessOperationsSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [beforeRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ipo_readiness_settings WHERE settingKey='default' LIMIT 1 FOR UPDATE`);
    const beforeRow = beforeRows[0];
    const before = beforeRow ? {
      targetOperatingMarginPct: beforeRow.targetOperatingMarginPct == null ? null : Number(beforeRow.targetOperatingMarginPct),
      downsideFactor: Number(beforeRow.downsideFactor),
      baseFactor: Number(beforeRow.baseFactor),
      upsideFactor: Number(beforeRow.upsideFactor),
      monthlyCloseDueDay: Number(beforeRow.monthlyCloseDueDay),
    } : null;
    await connection.query(
      `INSERT INTO ipo_readiness_settings
        (settingKey,targetOperatingMarginPct,downsideFactor,baseFactor,upsideFactor,monthlyCloseDueDay,createdBy,updatedBy)
       VALUES ('default',?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE targetOperatingMarginPct=VALUES(targetOperatingMarginPct),downsideFactor=VALUES(downsideFactor),
         baseFactor=VALUES(baseFactor),upsideFactor=VALUES(upsideFactor),monthlyCloseDueDay=VALUES(monthlyCloseDueDay),
         updatedBy=VALUES(updatedBy),updatedAt=CURRENT_TIMESTAMP`,
      [input.targetOperatingMarginPct ?? null, input.downsideFactor, input.baseFactor, input.upsideFactor, input.monthlyCloseDueDay, actorId(actor), actorId(actor)],
    );
    const after = { ...input, targetOperatingMarginPct: input.targetOperatingMarginPct ?? null };
    await writeAudit(connection, { entityType: "settings", action: "update", before, after, actor });
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveIpoReadinessTask(pool: Pool, input: IpoReadinessTaskInput, actor: IpoActor) {
  await ensureIpoReadinessOperationsSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let before: ReturnType<typeof mapTask> | null = null;
    if (input.id) {
      const [beforeRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ipo_readiness_tasks WHERE id=? AND deletedAt IS NULL LIMIT 1 FOR UPDATE`, [input.id]);
      if (!beforeRows[0]) throw new Error("IPO_TASK_NOT_FOUND");
      before = mapTask(beforeRows[0]);
      await connection.query(
        `UPDATE ipo_readiness_tasks SET workstream=?,title=?,description=?,ownerName=?,priority=?,status=?,progress=?,dueDate=?,blocker=?,
          evidenceJson=?,completedAt=CASE WHEN ?='done' THEN COALESCE(completedAt,CURRENT_TIMESTAMP) ELSE NULL END,updatedBy=?,updatedAt=CURRENT_TIMESTAMP
         WHERE id=? AND deletedAt IS NULL`,
        [input.workstream, input.title.trim(), input.description?.trim() || null, input.ownerName?.trim() || null, input.priority, input.status,
          input.progress, input.dueDate || null, input.blocker?.trim() || null, JSON.stringify(input.evidence), input.status, actorId(actor), input.id],
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO ipo_readiness_tasks
          (templateKey,workstream,title,description,ownerName,priority,status,progress,dueDate,blocker,evidenceJson,sortOrder,completedAt,createdBy,updatedBy)
         VALUES (NULL,?,?,?,?,?,?,?,?,?,?,999,CASE WHEN ?='done' THEN CURRENT_TIMESTAMP ELSE NULL END,?,?)`,
        [input.workstream, input.title.trim(), input.description?.trim() || null, input.ownerName?.trim() || null, input.priority, input.status,
          input.progress, input.dueDate || null, input.blocker?.trim() || null, JSON.stringify(input.evidence), input.status, actorId(actor), actorId(actor)],
      );
      input.id = Number((result as any).insertId);
    }
    const [afterRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ipo_readiness_tasks WHERE id=? LIMIT 1`, [input.id]);
    const after = mapTask(afterRows[0]);
    await writeAudit(connection, { entityType: "task", entityId: after.id, action: before ? "update" : "create", before, after, actor });
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function archiveIpoReadinessTask(pool: Pool, id: number, actor: IpoActor) {
  await ensureIpoReadinessOperationsSchema(pool);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [beforeRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ipo_readiness_tasks WHERE id=? AND deletedAt IS NULL LIMIT 1 FOR UPDATE`, [id]);
    if (!beforeRows[0]) throw new Error("IPO_TASK_NOT_FOUND");
    const before = mapTask(beforeRows[0]);
    await connection.query(`UPDATE ipo_readiness_tasks SET deletedAt=CURRENT_TIMESTAMP,updatedBy=?,updatedAt=CURRENT_TIMESTAMP WHERE id=? AND deletedAt IS NULL`, [actorId(actor), id]);
    await writeAudit(connection, { entityType: "task", entityId: id, action: "archive", before, after: { ...before, archived: true }, actor });
    await connection.commit();
    return { success: true as const, id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createIpoBoardReportSnapshot(pool: Pool, input: IpoBoardReportInput, actor: IpoActor) {
  await ensureIpoReadinessOperationsSchema(pool);
  const connection = await pool.getConnection();
  const seriesKey = `ipo-board-${input.asOfMonth}`;
  try {
    await connection.beginTransaction();
    await connection.query(`SELECT settingKey FROM ipo_readiness_settings WHERE settingKey='default' FOR UPDATE`);
    const [versionRows] = await connection.query<RowDataPacket[]>(
      `SELECT COALESCE(MAX(versionNumber),0)+1 AS nextVersion FROM ipo_board_report_snapshots WHERE seriesKey=?`,
      [seriesKey],
    );
    const versionNumber = Number(versionRows[0]?.nextVersion || 1);
    const [result] = await connection.query(
      `INSERT INTO ipo_board_report_snapshots
        (seriesKey,asOfMonth,versionNumber,title,status,summaryJson,generatedBy,generatedByName)
       VALUES (?,?,?,?,?,?,?,?)`,
      [seriesKey, input.asOfMonth, versionNumber, input.title.trim(), input.status, JSON.stringify(input.summary), actorId(actor), actorName(actor)],
    );
    const id = Number((result as any).insertId);
    const [afterRows] = await connection.query<RowDataPacket[]>(`SELECT * FROM ipo_board_report_snapshots WHERE id=? LIMIT 1`, [id]);
    const after = mapBoardReport(afterRows[0]);
    await writeAudit(connection, { entityType: "board_report", entityId: id, action: "create_version", after, actor });
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
