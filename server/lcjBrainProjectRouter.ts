import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";
import {
  resolveReportVisibilityScope,
  canReadReport,
} from "./reportVisibility";
import { ensureLcjBrainProjectUpgrade } from "./lcjBrainProjectUpgrade";
import {
  attachSopGenerationMetadata,
  buildProjectSourceKey,
  canTransitionProjectStatus,
  collectValidSourceRefs,
  hasUnknownSourceRefs,
  LCJ_BRAIN_DAILY_SUMMARY_JSON_SCHEMA,
  LCJ_BRAIN_SOP_JSON_SCHEMA,
  LCJ_BRAIN_SOP_PROMPT_VERSION,
  matchAutoCollectCandidate,
  normalizeNumericIds,
  normalizeProjectKeywords,
  pendingSopSourceIds,
  readSopGenerationMetadata,
  sopContentToMarkdown,
  stripSopGenerationMetadata,
  todayInTokyo,
  type LcjBrainProjectSourceType,
  type LcjBrainProjectStatus,
} from "../shared/lcjBrainProjectSop";

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is not configured");
    pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return pool;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function cleanText(value: unknown, max = 60_000): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, max);
}

function actorName(user: {
  id: number;
  name?: string | null;
  email?: string | null;
}): string {
  return cleanText(user.name || user.email || `user:${user.id}`, 255);
}

function toSqlDateTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new TRPCError({ code: "BAD_REQUEST", message: "日期格式不正确" });
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function projectCode(): string {
  const stamp = todayInTokyo().replaceAll("-", "");
  return `SOP-${stamp}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function userIdsForStaffIds(staffIds: number[]): Promise<number[]> {
  if (!staffIds.length) return [];
  const placeholders = staffIds.map(() => "?").join(",");
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT DISTINCT u.id FROM staff s INNER JOIN users u ON LOWER(TRIM(u.email))=LOWER(TRIM(s.email)) WHERE s.id IN (${placeholders})`,
    staffIds
  );
  return rows.map(row => Number(row.id)).filter(Number.isInteger);
}

function asProject(row: any) {
  return {
    ...row,
    autoCollectEnabled: Boolean(row.autoCollectEnabled),
    memberUserIds: parseJson<number[]>(row.memberUserIds, []),
    memberStaffIds: parseJson<number[]>(row.memberStaffIds, []),
    keywords: parseJson<string[]>(row.keywords, []),
    milestones: parseJson<any[]>(row.milestones, []),
  };
}

function asSource(row: any) {
  return { ...row, excluded: Boolean(row.excluded) };
}

type Actor = {
  id: number;
  name: string;
  email: string | null;
  isSuperAdmin: boolean;
};

async function getActor(user: {
  id: number;
  name?: string | null;
  email?: string | null;
}): Promise<Actor> {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "数据库不可用",
    });
  const access = await getUserManagementAccess(db, user.id);
  return {
    id: user.id,
    name: actorName(user),
    email: user.email || null,
    isSuperAdmin: access.isSuperAdmin,
  };
}

async function getProjectRow(
  projectId: number,
  connection: Pool | PoolConnection = getPool()
): Promise<any> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT * FROM lcj_brain_projects WHERE id = ? LIMIT 1",
    [projectId]
  );
  if (!rows[0])
    throw new TRPCError({ code: "NOT_FOUND", message: "项目不存在" });
  return asProject(rows[0]);
}

function projectAccess(project: any, actor: Actor) {
  const memberUserIds = new Set(parseJson<number[]>(project.memberUserIds, []));
  const isOwner =
    Number(project.ownerUserId) === actor.id ||
    Number(project.createdBy) === actor.id;
  return {
    canView: actor.isSuperAdmin || isOwner || memberUserIds.has(actor.id),
    canManage: actor.isSuperAdmin || isOwner,
    canAddSource: actor.isSuperAdmin || isOwner || memberUserIds.has(actor.id),
  };
}

async function requireProject(
  projectId: number,
  actor: Actor,
  mode: "view" | "manage" | "add" = "view"
) {
  await ensureLcjBrainProjectUpgrade();
  const project = await getProjectRow(projectId);
  const access = projectAccess(project, actor);
  if (
    (mode === "view" && !access.canView) ||
    (mode === "manage" && !access.canManage) ||
    (mode === "add" && !access.canAddSource)
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该项目" });
  }
  return { project, access };
}

async function writeAudit(
  input: {
    projectId: number;
    entityType: string;
    entityId?: number | null;
    action: string;
    actor: Actor;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string | null;
  },
  connection: Pool | PoolConnection = getPool()
) {
  await connection.query(
    `INSERT INTO lcj_brain_project_audit_logs
      (projectId, entityType, entityId, action, beforeJson, afterJson, actorId, actorName, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.projectId,
      input.entityType,
      input.entityId ?? null,
      input.action,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.actor.id,
      input.actor.name,
      input.reason || null,
    ]
  );
}

async function insertSourceSnapshot(input: {
  projectId: number;
  sourceType: LcjBrainProjectSourceType;
  sourceId?: string | number | null;
  sourceKey: string;
  title: string;
  summary?: string | null;
  content: string;
  occurredAt: Date | string | number;
  sourceUrl?: string | null;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  sha256?: string | null;
  contributorUserId?: number | null;
  contributorName?: string | null;
  matchedBy?:
    | "manual"
    | "keyword"
    | "member_keyword"
    | "direct_link"
    | "system";
  matchReason?: string | null;
  actor: Actor;
}): Promise<{ id: number; created: boolean }> {
  const db = getPool();
  const [existing] = await db.query<RowDataPacket[]>(
    "SELECT id, excluded FROM lcj_brain_project_sources WHERE projectId = ? AND sourceKey = ? LIMIT 1",
    [input.projectId, input.sourceKey]
  );
  if (existing[0]) return { id: Number(existing[0].id), created: false };
  const [result] = await db.query<ResultSetHeader>(
    `INSERT INTO lcj_brain_project_sources
      (projectId, sourceType, sourceId, sourceKey, title, summary, content, occurredAt, sourceUrl,
       storageKey, fileName, mimeType, fileSize, sha256, contributorUserId, contributorName,
       matchedBy, matchReason, createdBy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.projectId,
      input.sourceType,
      input.sourceId == null ? null : String(input.sourceId),
      input.sourceKey,
      cleanText(input.title, 500),
      cleanText(input.summary, 10_000) || null,
      cleanText(input.content),
      toSqlDateTime(input.occurredAt),
      input.sourceUrl || null,
      input.storageKey || null,
      cleanText(input.fileName, 500) || null,
      input.mimeType || null,
      input.fileSize || null,
      input.sha256 ||
        crypto
          .createHash("sha256")
          .update(cleanText(input.content))
          .digest("hex"),
      input.contributorUserId || null,
      cleanText(input.contributorName, 255) || null,
      input.matchedBy || "manual",
      cleanText(input.matchReason, 4_000) || null,
      input.actor.id,
    ]
  );
  await writeAudit({
    projectId: input.projectId,
    entityType: "source",
    entityId: result.insertId,
    action: "source_added",
    actor: input.actor,
    after: {
      sourceType: input.sourceType,
      sourceKey: input.sourceKey,
      title: input.title,
    },
    reason: input.matchReason || null,
  });
  return { id: result.insertId, created: true };
}

export async function addProjectFileSource(input: {
  projectId: number;
  actorUser: { id: number; name?: string | null; email?: string | null };
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  extractedText: string;
  storageKey: string;
  storageUrl: string;
  occurredAt?: string | Date;
}) {
  await ensureLcjBrainProjectUpgrade();
  const actor = await getActor(input.actorUser);
  await requireProject(input.projectId, actor, "add");
  const result = await insertSourceSnapshot({
    projectId: input.projectId,
    sourceType: "file",
    sourceId: input.sha256,
    sourceKey: buildProjectSourceKey("file", input.sha256),
    title: input.fileName,
    summary: `项目资料：${input.fileName}`,
    content: input.extractedText,
    occurredAt: input.occurredAt || new Date(),
    sourceUrl: null,
    storageKey: input.storageKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    sha256: input.sha256,
    contributorUserId: actor.id,
    contributorName: actor.name,
    matchedBy: "direct_link",
    matchReason: "项目成员直接上传",
    actor,
  });
  if (result.created) {
    await getPool().query(
      "UPDATE lcj_brain_project_sources SET sourceUrl=? WHERE id=?",
      [`/api/lcj-brain/project-source/${result.id}/download`, result.id]
    );
  }
  return result;
}

export async function getProjectFileDownloadForUser(input: {
  sourceId: number;
  actorUser: { id: number; name?: string | null; email?: string | null };
}) {
  await ensureLcjBrainProjectUpgrade();
  const actor = await getActor(input.actorUser);
  const [rows] = await getPool().query<RowDataPacket[]>(
    "SELECT id,projectId,sourceType,storageKey,fileName,mimeType FROM lcj_brain_project_sources WHERE id=? AND excluded=0 LIMIT 1",
    [input.sourceId]
  );
  const source: any = rows[0];
  if (!source || source.sourceType !== "file" || !source.storageKey)
    throw new TRPCError({ code: "NOT_FOUND", message: "项目文件不存在" });
  await requireProject(Number(source.projectId), actor, "view");
  return {
    storageKey: String(source.storageKey),
    fileName: String(source.fileName || "document"),
    mimeType: String(source.mimeType || "application/octet-stream"),
  };
}

async function fetchExistingSource(
  type: Exclude<LcjBrainProjectSourceType, "file" | "note" | "decision">,
  id: number,
  actor: Actor
) {
  const db = getPool();
  if (type === "meeting") {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM morning_meetings WHERE id = ? LIMIT 1",
      [id]
    );
    const row: any = rows[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "会议不存在" });
    const summary = parseJson<any>(row.summary, {});
    const participants = parseJson<any[]>(row.participantSnapshot, []);
    return {
      title: `${row.date} 早会${row.teamCode && row.teamCode !== "legacy" ? ` · ${row.teamCode}` : ""}`,
      summary: cleanText(summary.overview || ""),
      content: cleanText(
        [summary.overview, row.transcript].filter(Boolean).join("\n\n")
      ),
      occurredAt: `${row.date}T00:00:00+09:00`,
      sourceUrl: `/master/morning-meeting?date=${encodeURIComponent(row.date)}`,
      contributorUserId: row.createdBy,
      contributorName: row.createdByName,
      personIds: participants
        .flatMap(p => [p.userId, p.staffId])
        .filter(Number.isInteger),
      personNames: participants.map(p => p.name).filter(Boolean),
    };
  }
  if (type === "daily_report") {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT r.*, rs.name AS staffName, rs.linkedStaffId
       FROM reports r INNER JOIN report_staff rs ON rs.id = r.reportStaffId
       WHERE r.id = ? LIMIT 1`,
      [id]
    );
    const row: any = rows[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "日报不存在" });
    const visibility = await resolveReportVisibilityScope({
      id: actor.id,
      email: actor.email,
      name: actor.name,
    });
    if (
      !canReadReport(visibility, {
        reportStaffId: Number(row.reportStaffId),
        createdBy: Number(row.createdBy),
      })
    ) {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权导入该日报" });
    }
    return {
      title: `${row.staffName} · ${new Date(row.reportDate).toISOString().slice(0, 10)} 日报`,
      summary: cleanText(row.workContent, 2_000),
      content: cleanText(
        [
          "已完成／工作内容",
          row.workContent,
          "问题与备注",
          row.issues,
          row.remarks,
        ]
          .filter(Boolean)
          .join("\n\n")
      ),
      occurredAt: row.reportDate,
      sourceUrl: `/master/reports?reportId=${row.id}`,
      contributorUserId: row.createdBy,
      contributorName: row.staffName,
      personIds: [row.createdBy, row.linkedStaffId].filter(Number.isInteger),
      personNames: [row.staffName].filter(Boolean),
    };
  }
  if (type === "task") {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT t.*, s.name AS staffName, GROUP_CONCAT(ts.staffId) AS assignedStaffIds
       FROM tasks t LEFT JOIN staff s ON s.id = t.staffId LEFT JOIN task_staff ts ON ts.taskId = t.id
       WHERE t.id = ? GROUP BY t.id LIMIT 1`,
      [id]
    );
    const row: any = rows[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
    return {
      title: cleanText(row.taskDetail, 160),
      summary: cleanText(row.notes || row.extractedContext, 2_000),
      content: cleanText(
        [row.taskDetail, row.extractedContext, row.notes, `状态：${row.status}`]
          .filter(Boolean)
          .join("\n\n")
      ),
      occurredAt: Number(row.startDate) || row.createdAt,
      sourceUrl: `/master/tasks?taskId=${row.id}`,
      contributorUserId: row.createdBy,
      contributorName: row.staffName,
      personIds: [
        row.createdBy,
        row.staffId,
        ...String(row.assignedStaffIds || "")
          .split(",")
          .map(Number),
      ].filter(Number.isInteger),
      personNames: [row.staffName].filter(Boolean),
    };
  }
  if (type === "issue") {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM issues WHERE id = ? LIMIT 1",
      [id]
    );
    const row: any = rows[0];
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "问题不存在" });
    const allowed =
      actor.isSuperAdmin ||
      !Boolean(row.isPrivate) ||
      [row.creatorId, row.assigneeId, row.helperId]
        .map(Number)
        .includes(actor.id) ||
      row.creatorName === actor.name;
    if (!allowed)
      throw new TRPCError({ code: "FORBIDDEN", message: "无权导入该私密问题" });
    return {
      title: cleanText(row.title, 500),
      summary: cleanText(row.description, 2_000),
      content: cleanText(
        [
          row.description,
          row.solution,
          `状态：${row.status}`,
          `优先级：${row.priority}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      ),
      occurredAt: row.createdAt,
      sourceUrl: `/master/issues?id=${row.id}`,
      contributorUserId: row.creatorId,
      contributorName: row.creatorName,
      personIds: [row.creatorId, row.assigneeId, row.helperId]
        .map(Number)
        .filter(Number.isInteger),
      personNames: [row.creatorName, row.assigneeName, row.helperName].filter(
        Boolean
      ),
    };
  }
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM lcj_brain_knowledge WHERE id = ? LIMIT 1",
    [id]
  );
  const row: any = rows[0];
  if (!row)
    throw new TRPCError({ code: "NOT_FOUND", message: "知识资料不存在" });
  return {
    title: cleanText(row.title, 500),
    summary: cleanText(row.summary, 2_000),
    content: cleanText(row.content),
    occurredAt: row.meetingDate || row.createdAt,
    sourceUrl: `/master/lcj-brain?tab=knowledge&knowledgeId=${row.id}`,
    contributorUserId: row.uploadedBy,
    contributorName: row.uploadedByName,
    personIds: [row.uploadedBy].map(Number).filter(Number.isInteger),
    personNames: parseJson<string[]>(row.participants, []),
  };
}

async function generateDailySummary(
  project: any,
  sourceRows: any[],
  summaryDate: string
) {
  const sourceIds = sourceRows.map(row => Number(row.id));
  const sourceText = sourceRows
    .map(row => `[S${row.id}] ${row.title}\n${cleanText(row.content, 6_000)}`)
    .join("\n\n");
  const result = await invokeLLM({
    model: "gpt-5-mini",
    responseFormat: {
      type: "json_schema",
      json_schema: LCJ_BRAIN_DAILY_SUMMARY_JSON_SCHEMA as any,
    },
    messages: [
      {
        role: "system",
        content:
          "你是LCJ项目日结整理员。只能依据给出的来源，不能补写事实。sourceIds只能使用输入中的S编号。没有证据的内容放入gaps。输出严格JSON。",
      },
      {
        role: "user",
        content: `项目：${project.name}\n日期：${summaryDate}\n目标：${project.objective || "未填写"}\n\n来源：\n${sourceText}`,
      },
    ],
  });
  const raw = result.choices?.[0]?.message?.content;
  if (typeof raw !== "string") throw new Error("DAILY_SUMMARY_EMPTY_RESPONSE");
  const parsed = JSON.parse(raw);
  parsed.sourceIds = collectValidSourceRefs(
    { sourceRefs: parsed.sourceIds },
    sourceIds
  );
  return { parsed, model: result.model || "gpt-5-mini" };
}

export async function runProjectDailyCollection(
  projectId: number,
  now = new Date(),
  options: { force?: boolean; actorUserId?: number } = {}
) {
  await ensureLcjBrainProjectUpgrade();
  const db = getPool();
  const project = await getProjectRow(projectId);
  const dateKey = todayInTokyo(now);
  const runKey = options.force
    ? `project:${projectId}:manual:${Date.now()}:${crypto.randomBytes(3).toString("hex")}`
    : `project:${projectId}:daily:${dateKey}`;
  const lockConnection = await db.getConnection();
  const lockName = `lcj_sop:${projectId}:${dateKey}`;
  const [lockRows] = await lockConnection.query<RowDataPacket[]>(
    "SELECT GET_LOCK(?, 0) AS acquired",
    [lockName]
  );
  if (Number(lockRows[0]?.acquired) !== 1) {
    lockConnection.release();
    return { status: "skipped", reason: "同一项目的整理任务正在运行" };
  }
  try {
    const [existing] = await db.query<RowDataPacket[]>(
      "SELECT * FROM lcj_brain_project_runs WHERE runKey = ? LIMIT 1",
      [runKey]
    );
    if (existing[0] && !options.force)
      return {
        status: existing[0].status,
        runId: Number(existing[0].id),
        reused: true,
      };
    if (project.status !== "active" || !project.autoCollectEnabled)
      return { status: "skipped", reason: "项目未启用自动归集" };
    if (
      !project.keywords.length ||
      (!project.memberUserIds.length && !project.memberStaffIds.length)
    ) {
      return { status: "skipped", reason: "请先配置项目成员和至少一个关键词" };
    }

    const started = Date.now();
    const [run] = await db.query<ResultSetHeader>(
      `INSERT INTO lcj_brain_project_runs (projectId, runKey, runType, status)
     VALUES (?, ?, 'daily_scan', 'running')
     ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id), status=IF(status='failed','running',status), errorCode=NULL, errorMessage=NULL, startedAt=IF(status='failed',CURRENT_TIMESTAMP,startedAt)`,
      [projectId, runKey]
    );
    const runId = run.insertId;
    if (!runId) return { status: "skipped", reason: "本日已运行" };
    try {
      const dayStart = `${project.startDate} 00:00:00`;
      const dayEnd = `${project.endDate || dateKey} 23:59:59`;
      const candidates: Array<{
        type: Exclude<LcjBrainProjectSourceType, "file" | "note" | "decision">;
        id: number;
      }> = [];
      const [meetingRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM morning_meetings WHERE date BETWEEN ? AND ? AND status = 'completed' ORDER BY date ASC",
        [project.startDate, project.endDate || dateKey]
      );
      meetingRows.forEach(row =>
        candidates.push({ type: "meeting", id: Number(row.id) })
      );
      const [reportRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM reports WHERE reportDate BETWEEN ? AND ? ORDER BY reportDate ASC",
        [dayStart, dayEnd]
      );
      reportRows.forEach(row =>
        candidates.push({ type: "daily_report", id: Number(row.id) })
      );
      const [taskRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM tasks WHERE createdAt BETWEEN ? AND ? ORDER BY createdAt ASC",
        [dayStart, dayEnd]
      );
      taskRows.forEach(row =>
        candidates.push({ type: "task", id: Number(row.id) })
      );
      const [issueRows] = await db
        .query<
          RowDataPacket[]
        >("SELECT id FROM issues WHERE createdAt BETWEEN ? AND ? AND (isPrivate = 0 OR isPrivate IS NULL) ORDER BY createdAt ASC", [dayStart, dayEnd])
        .catch(() => [[] as RowDataPacket[], []] as any);
      (issueRows as RowDataPacket[]).forEach(row =>
        candidates.push({ type: "issue", id: Number(row.id) })
      );
      const [knowledgeRows] = await db.query<RowDataPacket[]>(
        "SELECT id FROM lcj_brain_knowledge WHERE COALESCE(meetingDate, createdAt) BETWEEN ? AND ? ORDER BY createdAt ASC",
        [dayStart, dayEnd]
      );
      knowledgeRows.forEach(row =>
        candidates.push({ type: "knowledge", id: Number(row.id) })
      );

      const automationUserId =
        options.actorUserId || Number(project.ownerUserId);
      const [automationUserRows] = await db.query<RowDataPacket[]>(
        "SELECT id,name,email FROM users WHERE id=? LIMIT 1",
        [automationUserId]
      );
      const automationUser = automationUserRows[0]
        ? await getActor({
            id: Number(automationUserRows[0].id),
            name: String(automationUserRows[0].name || ""),
            email: String(automationUserRows[0].email || ""),
          })
        : {
            id: Number(project.ownerUserId),
            name: "LCJ Brain 自动归集",
            email: null,
            isSuperAdmin: false,
          };
      const systemActor: Actor = {
        ...automationUser,
        name: `LCJ Brain 自动归集（${automationUser.name}）`,
      };
      let added = 0;
      const addedSourceIds: number[] = [];
      for (const candidate of candidates) {
        let source: Awaited<ReturnType<typeof fetchExistingSource>>;
        try {
          source = await fetchExistingSource(
            candidate.type,
            candidate.id,
            systemActor
          );
        } catch (error: any) {
          if (error?.code === "FORBIDDEN") continue;
          throw error;
        }
        const occurredDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(source.occurredAt));
        const match = matchAutoCollectCandidate(
          {
            startDate: project.startDate,
            endDate: project.endDate,
            keywords: project.keywords,
            memberUserIds: project.memberUserIds,
            memberStaffIds: project.memberStaffIds,
            mode: project.autoCollectMode,
          },
          {
            occurredDate,
            text: `${source.title}\n${source.content}`,
            personIds: source.personIds,
            personNames: source.personNames,
          }
        );
        if (!match.matched) continue;
        const inserted = await insertSourceSnapshot({
          projectId,
          sourceType: candidate.type,
          sourceId: candidate.id,
          sourceKey: buildProjectSourceKey(candidate.type, candidate.id),
          ...source,
          matchedBy: match.keywordHits.length ? "member_keyword" : "keyword",
          matchReason: match.reason,
          actor: systemActor,
        });
        if (inserted.created) {
          added += 1;
          addedSourceIds.push(inserted.id);
        }
      }

      let summarySources: RowDataPacket[] = [];
      if (addedSourceIds.length) {
        const [priorRows] = await db.query<RowDataPacket[]>(
          "SELECT sourceIds FROM lcj_brain_project_daily_summaries WHERE projectId=? AND summaryDate=? LIMIT 1",
          [projectId, dateKey]
        );
        const sourceIds = [
          ...new Set([
            ...parseJson<number[]>(priorRows[0]?.sourceIds, []),
            ...addedSourceIds,
          ]),
        ];
        const placeholders = sourceIds.map(() => "?").join(",");
        const [rows] = await db.query<RowDataPacket[]>(
          `SELECT * FROM lcj_brain_project_sources WHERE projectId = ? AND excluded = 0 AND id IN (${placeholders}) ORDER BY occurredAt ASC, id ASC`,
          [projectId, ...sourceIds]
        );
        summarySources = rows;
      }
      let summaryId: number | null = null;
      if (summarySources.length) {
        const { parsed, model } = await generateDailySummary(
          project,
          summarySources,
          dateKey
        );
        const [summaryResult] = await db.query<ResultSetHeader>(
          `INSERT INTO lcj_brain_project_daily_summaries
          (projectId, summaryDate, status, summary, completedItems, decisions, issues, risks, nextActions, gaps, sourceIds, model, generatedBy)
         VALUES (?, ?, 'generated', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), summary=VALUES(summary), completedItems=VALUES(completedItems), decisions=VALUES(decisions), issues=VALUES(issues), risks=VALUES(risks), nextActions=VALUES(nextActions), gaps=VALUES(gaps), sourceIds=VALUES(sourceIds), model=VALUES(model), generatedBy=VALUES(generatedBy)`,
          [
            projectId,
            dateKey,
            parsed.summary,
            JSON.stringify(parsed.completedItems),
            JSON.stringify(parsed.decisions),
            JSON.stringify(parsed.issues),
            JSON.stringify(parsed.risks),
            JSON.stringify(parsed.nextActions),
            JSON.stringify(parsed.gaps),
            JSON.stringify(parsed.sourceIds),
            model,
            systemActor.id,
          ]
        );
        summaryId = summaryResult.insertId || null;
      } else {
        const [summaryResult] = await db.query<ResultSetHeader>(
          `INSERT INTO lcj_brain_project_daily_summaries
          (projectId,summaryDate,status,summary,completedItems,decisions,issues,risks,nextActions,gaps,sourceIds,model,generatedBy)
         VALUES (?,?,'generated','当日未归集到新的项目资料','[]','[]','[]','[]','[]',?,'[]',NULL,?)
         ON DUPLICATE KEY UPDATE summary=VALUES(summary),gaps=VALUES(gaps),sourceIds=VALUES(sourceIds),model=NULL,generatedBy=VALUES(generatedBy)`,
          [
            projectId,
            dateKey,
            JSON.stringify([
              "当日没有匹配到新的会议、日报、任务、问题或资料，请确认是否遗漏记录",
            ]),
            systemActor.id,
          ]
        );
        summaryId = summaryResult.insertId || null;
      }
      await db.query(
        "UPDATE lcj_brain_projects SET lastAutoCollectedDate = ? WHERE id = ?",
        [dateKey, projectId]
      );
      await db.query(
        "UPDATE lcj_brain_project_runs SET status='success', sourceCount=?, outputId=?, model=?, durationMs=?, finishedAt=CURRENT_TIMESTAMP WHERE id=?",
        [
          added,
          summaryId,
          summarySources.length ? "gpt-5-mini" : null,
          Date.now() - started,
          runId,
        ]
      );
      return { status: "success", added, summaryId, runId };
    } catch (error: any) {
      await db.query(
        "UPDATE lcj_brain_project_runs SET status='failed', errorCode=?, errorMessage=?, durationMs=?, finishedAt=CURRENT_TIMESTAMP WHERE id=?",
        [
          String(error?.message || "DAILY_SCAN_FAILED").slice(0, 100),
          String(error?.message || error).slice(0, 4_000),
          Date.now() - started,
          runId,
        ]
      );
      throw error;
    }
  } finally {
    await lockConnection
      .query("SELECT RELEASE_LOCK(?)", [lockName])
      .catch(() => undefined);
    lockConnection.release();
  }
}

function buildSopSourceInput(
  sources: RowDataPacket[],
  maxCharacters = 180_000
): { text: string; sourceIds: number[] } {
  const blocks: string[] = [];
  const sourceIds: number[] = [];
  let remaining = maxCharacters;
  for (const row of sources) {
    const prefix = `[S${row.id}] ${row.title} (${new Date(row.occurredAt).toISOString()})\n`;
    if (remaining <= prefix.length + 100) break;
    const content = cleanText(
      row.content,
      Math.min(8_000, remaining - prefix.length)
    );
    const block = `${prefix}${content}`;
    blocks.push(block);
    sourceIds.push(Number(row.id));
    remaining -= block.length + 2;
  }
  return { text: blocks.join("\n\n"), sourceIds };
}

async function generateSopVersion(
  project: any,
  actor: Actor,
  status: "draft" | "final",
  reason?: string,
  options?: { mode?: "full" | "incremental"; baseVersionId?: number }
) {
  const db = getPool();
  const mode = options?.mode || "full";
  const started = Date.now();
  const runKey = `project:${project.id}:sop:${mode}:${Date.now()}:${crypto.randomBytes(3).toString("hex")}`;
  const [run] = await db.query<ResultSetHeader>(
    "INSERT INTO lcj_brain_project_runs (projectId,runKey,runType,status) VALUES (?,?,?,'running')",
    [project.id, runKey, status === "final" ? "sop_final" : "sop_draft"]
  );
  const runId = run.insertId;
  try {
    const [sources] = await db.query<RowDataPacket[]>(
      "SELECT * FROM lcj_brain_project_sources WHERE projectId = ? AND excluded = 0 ORDER BY occurredAt ASC, id ASC",
      [project.id]
    );
    if (!sources.length)
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "请先导入至少一条项目资料",
      });

    let baseVersion: RowDataPacket | null = null;
    let baselineSourceIds: number[] = [];
    let pendingIds = sources.map(row => Number(row.id));
    let removedSourceIds: number[] = [];
    if (mode === "incremental") {
      const [baseRows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM lcj_brain_project_sop_versions WHERE projectId=? ORDER BY version DESC LIMIT 1",
        [project.id]
      );
      baseVersion = baseRows[0] || null;
      if (!baseVersion)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "尚无可补充的SOP基础版本，请先生成SOP",
        });
      if (
        options?.baseVersionId &&
        Number(baseVersion.id) !== options.baseVersionId
      )
        throw new TRPCError({
          code: "CONFLICT",
          message: "SOP已由其他成员更新，请刷新后重新补充",
        });
      const metadata = readSopGenerationMetadata(
        parseJson(baseVersion.structuredContent, {})
      );
      if (metadata?.includedSourceIds.length) {
        baselineSourceIds = metadata.includedSourceIds;
        pendingIds = pendingSopSourceIds(
          sources.map(row => Number(row.id)),
          baselineSourceIds
        );
      } else {
        const baseCreatedAt = new Date(baseVersion.createdAt).getTime();
        baselineSourceIds = sources
          .filter(row => new Date(row.createdAt).getTime() <= baseCreatedAt)
          .map(row => Number(row.id));
        pendingIds = sources
          .filter(row => new Date(row.createdAt).getTime() > baseCreatedAt)
          .map(row => Number(row.id));
      }
      const activeSourceSet = new Set(sources.map(row => Number(row.id)));
      removedSourceIds = baselineSourceIds.filter(
        sourceId => !activeSourceSet.has(sourceId)
      );
      if (!pendingIds.length && !removedSourceIds.length)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "当前SOP已经包含全部有效资料，无需重复更新",
        });
    }

    const pendingSet = new Set(pendingIds);
    const prioritizedSources =
      mode === "incremental"
        ? [
            ...sources.filter(row => pendingSet.has(Number(row.id))),
            ...sources.filter(row => !pendingSet.has(Number(row.id))),
          ]
        : sources;
    const sourceInput = buildSopSourceInput(prioritizedSources);
    const allowedIds = sourceInput.sourceIds;
    const includedSourceIds = [...allowedIds].sort((a, b) => a - b);
    const includedPendingIds = pendingIds.filter(sourceId =>
      includedSourceIds.includes(sourceId)
    );
    if (
      mode === "incremental" &&
      includedPendingIds.length !== pendingIds.length
    )
      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message:
          "新增资料内容过多，无法在一次更新中完整纳入，请拆分项目或排除无关资料",
      });

    const baseContent = baseVersion
      ? stripSopGenerationMetadata(parseJson(baseVersion.structuredContent, {}))
      : null;
    const incrementalContext = baseVersion
      ? `\n\n更新模式：补充更新现有SOP v${baseVersion.version}。必须保留仍被来源支持的原有内容，并将新增资料${includedPendingIds.length ? `S${includedPendingIds.join("、S")}` : "（无）"}整合到正确章节；已排除来源${removedSourceIds.length ? `S${removedSourceIds.join("、S")}` : "（无）"}不得继续作为事实依据。若新资料与旧内容冲突，以新资料为准并在风险或未解决问题中说明。基础SOP JSON：\n${JSON.stringify(baseContent).slice(0, 80_000)}`
      : "";
    const prompt = `项目：${project.name}\n类型：${project.projectType}\n目标：${project.objective || "未填写"}\n范围：${project.scope || "未填写"}\n阶段：${project.currentPhase || "未填写"}${incrementalContext}\n\n可引用来源：\n${sourceInput.text}`;
    const models = ["gemini-3.1-pro-preview", "gpt-5-mini"];
    let parsed: any = null;
    let usedModel = "";
    let lastError: unknown;
    for (const model of models) {
      try {
        const result = await invokeLLM({
          model,
          responseFormat: {
            type: "json_schema",
            json_schema: LCJ_BRAIN_SOP_JSON_SCHEMA as any,
          },
          messages: [
            {
              role: "system",
              content:
                mode === "incremental"
                  ? "你是LCJ项目SOP编制专家。请基于基础SOP和全部可引用来源生成完整的新版本，不是只写补丁。必须优先处理所有新增来源，保留仍有来源支持的旧内容；每个有事实含义的章节、角色、步骤、风险和经验必须填写sourceRefs，且只能使用输入中的S编号。资料冲突或无法支持的内容必须放入gaps或unresolvedQuestions，不得以行业常识补写。sourceIndex必须列出本次提供的每个来源。输出严格JSON。"
                  : "你是LCJ项目SOP编制专家。只能依据提供的来源写项目事实。每个有事实含义的章节、角色、步骤、风险和经验必须填写sourceRefs，且只能使用输入中的S编号。资料不能支持的内容必须放入gaps或unresolvedQuestions，不得以行业常识补写。sourceIndex必须列出本次提供的每个来源。输出严格JSON。",
            },
            { role: "user", content: prompt },
          ],
        });
        const raw = result.choices?.[0]?.message?.content;
        if (typeof raw !== "string") throw new Error("SOP_EMPTY_RESPONSE");
        parsed = JSON.parse(raw);
        if (hasUnknownSourceRefs(parsed, allowedIds))
          throw new Error("SOP_UNKNOWN_SOURCE_REFERENCE");
        if (
          !Array.isArray(parsed.sourceIndex) ||
          parsed.sourceIndex.some(
            (entry: any) =>
              !Number.isInteger(entry?.sourceId) ||
              !allowedIds.includes(Number(entry.sourceId))
          )
        ) {
          throw new Error("SOP_UNKNOWN_SOURCE_INDEX");
        }
        const indexedSourceIds = new Set(
          parsed.sourceIndex.map((entry: any) => Number(entry.sourceId))
        );
        if (
          mode === "incremental" &&
          includedPendingIds.some(sourceId => !indexedSourceIds.has(sourceId))
        ) {
          throw new Error("SOP_NEW_SOURCE_NOT_INDEXED");
        }
        usedModel = result.model || model;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!parsed)
      throw lastError instanceof Error
        ? lastError
        : new Error("SOP_GENERATION_FAILED");
    const markdown = sopContentToMarkdown(parsed);
    const sourceIds = collectValidSourceRefs(parsed, allowedIds);
    const generationMetadata = {
      mode,
      baseVersionId: baseVersion ? Number(baseVersion.id) : null,
      includedSourceIds,
      newSourceIds:
        mode === "incremental" ? includedPendingIds : includedSourceIds,
      removedSourceIds,
      generatedAt: new Date().toISOString(),
    } as const;
    const structuredContent = attachSopGenerationMetadata(
      parsed,
      generationMetadata
    );
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      let version: number;
      if (baseVersion) {
        const [latestRows] = await connection.query<RowDataPacket[]>(
          "SELECT id,version FROM lcj_brain_project_sop_versions WHERE projectId=? ORDER BY version DESC LIMIT 1 FOR UPDATE",
          [project.id]
        );
        if (Number(latestRows[0]?.id) !== Number(baseVersion.id))
          throw new TRPCError({
            code: "CONFLICT",
            message: "SOP已由其他成员更新，请刷新后重新补充",
          });
        version = Number(latestRows[0].version) + 1;
      } else {
        const [versionRows] = await connection.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(version), 0) + 1 AS nextVersion FROM lcj_brain_project_sop_versions WHERE projectId = ? FOR UPDATE",
          [project.id]
        );
        version = Number(versionRows[0]?.nextVersion || 1);
      }
      const [inserted] = await connection.query<ResultSetHeader>(
        `INSERT INTO lcj_brain_project_sop_versions
        (projectId, version, status, title, structuredContent, markdown, sourceIds, model, promptVersion, generatedBy, generatedByName, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id,
          version,
          status,
          cleanText(parsed.title || `${project.name} SOP`, 500),
          JSON.stringify(structuredContent),
          markdown,
          JSON.stringify(sourceIds),
          usedModel,
          LCJ_BRAIN_SOP_PROMPT_VERSION,
          actor.id,
          actor.name,
          reason ||
            (mode === "incremental"
              ? `基于SOP v${baseVersion?.version}补充${includedPendingIds.length}份新增资料${removedSourceIds.length ? `，移除${removedSourceIds.length}份无效来源` : ""}`
              : null),
        ]
      );
      await writeAudit(
        {
          projectId: project.id,
          entityType: "sop",
          entityId: inserted.insertId,
          action:
            mode === "incremental"
              ? "sop_incremental_updated"
              : status === "final"
                ? "sop_final_generated"
                : "sop_draft_generated",
          actor,
          after: {
            version,
            status,
            sourceIds,
            model: usedModel,
            mode,
            baseVersionId: baseVersion ? Number(baseVersion.id) : null,
            includedSourceIds,
            newSourceIds: includedPendingIds,
            removedSourceIds,
          },
          reason,
        },
        connection
      );
      await connection.commit();
      await db.query(
        "UPDATE lcj_brain_project_runs SET status='success',sourceCount=?,outputId=?,model=?,durationMs=?,finishedAt=CURRENT_TIMESTAMP WHERE id=?",
        [
          includedSourceIds.length,
          inserted.insertId,
          usedModel,
          Date.now() - started,
          runId,
        ]
      );
      return {
        id: inserted.insertId,
        version,
        status,
        title: parsed.title,
        markdown,
        structuredContent,
        sourceIds,
        model: usedModel,
        mode,
        baseVersionId: baseVersion ? Number(baseVersion.id) : null,
        newSourceIds: includedPendingIds,
        removedSourceIds,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    await db
      .query(
        "UPDATE lcj_brain_project_runs SET status='failed',errorCode=?,errorMessage=?,durationMs=?,finishedAt=CURRENT_TIMESTAMP WHERE id=?",
        [
          String(error?.message || "SOP_GENERATION_FAILED").slice(0, 100),
          String(error?.message || error).slice(0, 4000),
          Date.now() - started,
          runId,
        ]
      )
      .catch(() => undefined);
    throw error;
  }
}

const projectInput = z.object({
  name: z.string().trim().min(2).max(255),
  projectType: z
    .enum(["event", "project", "campaign", "other"])
    .default("project"),
  description: z.string().max(10_000).optional().nullable(),
  objective: z.string().max(10_000).optional().nullable(),
  scope: z.string().max(10_000).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  ownerUserId: z.number().int().positive().optional(),
  memberUserIds: z.array(z.number().int().positive()).max(200).default([]),
  memberStaffIds: z.array(z.number().int().positive()).max(200).default([]),
  keywords: z.array(z.string().max(100)).max(30).default([]),
  currentPhase: z.string().max(255).optional().nullable(),
  milestones: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(255),
        dueDate: z.string().optional(),
        completedAt: z.string().optional(),
        status: z.enum(["pending", "completed"]),
      })
    )
    .max(100)
    .default([]),
  autoCollectEnabled: z.boolean().default(true),
  autoCollectMode: z.enum(["strict", "member_only"]).default("strict"),
});

export const lcjBrainProjectRouter = router({
  staffDirectory: protectedProcedure.query(async ({ ctx }) => {
    await ensureLcjBrainProjectUpgrade();
    const actor = await getActor(ctx.user);
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT s.id AS staffId, s.name, s.email, s.department, s.position, u.id AS userId
       FROM staff s LEFT JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(s.email))
       WHERE s.archivedAt IS NULL AND s.mergedIntoStaffId IS NULL AND s.isActive = 'active'
       ORDER BY s.department, s.name`
    );
    return { staff: rows, canViewAll: actor.isSuperAdmin };
  }),

  list: protectedProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }))
    .query(async ({ input, ctx }) => {
      await ensureLcjBrainProjectUpgrade();
      const actor = await getActor(ctx.user);
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT p.*,
        (SELECT COUNT(*) FROM lcj_brain_project_sources s WHERE s.projectId=p.id AND s.excluded=0) AS sourceCount,
        (SELECT COUNT(*) FROM lcj_brain_project_daily_summaries d WHERE d.projectId=p.id) AS dailySummaryCount,
        (SELECT MAX(v.version) FROM lcj_brain_project_sop_versions v WHERE v.projectId=p.id) AS latestSopVersion
       FROM lcj_brain_projects p ${input.includeArchived ? "" : "WHERE p.status <> 'archived'"}
       ORDER BY FIELD(p.status,'active','draft','completed','archived'), p.updatedAt DESC`
      );
      return rows
        .map(asProject)
        .filter(project => projectAccess(project, actor).canView)
        .map(project => ({
          ...project,
          access: projectAccess(project, actor),
        }));
    }),

  get: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      const { project, access } = await requireProject(input.projectId, actor);
      const db = getPool();
      const [
        [sourceCountRows],
        [activeSourceRows],
        [summaryRows],
        [sopRows],
        [latestSopRows],
        [runRows],
        [auditRows],
      ] = await Promise.all([
        db.query<RowDataPacket[]>(
          "SELECT sourceType, COUNT(*) AS count FROM lcj_brain_project_sources WHERE projectId=? AND excluded=0 GROUP BY sourceType",
          [input.projectId]
        ),
        db.query<RowDataPacket[]>(
          "SELECT id,sourceType,title,occurredAt,createdAt FROM lcj_brain_project_sources WHERE projectId=? AND excluded=0 ORDER BY createdAt ASC,id ASC",
          [input.projectId]
        ),
        db.query<RowDataPacket[]>(
          "SELECT * FROM lcj_brain_project_daily_summaries WHERE projectId=? ORDER BY summaryDate DESC LIMIT 60",
          [input.projectId]
        ),
        db.query<RowDataPacket[]>(
          "SELECT id, projectId, version, status, title, sourceIds, model, promptVersion, generatedBy, generatedByName, reason, createdAt FROM lcj_brain_project_sop_versions WHERE projectId=? ORDER BY version DESC LIMIT 50",
          [input.projectId]
        ),
        db.query<RowDataPacket[]>(
          "SELECT id,version,structuredContent,createdAt FROM lcj_brain_project_sop_versions WHERE projectId=? ORDER BY version DESC LIMIT 1",
          [input.projectId]
        ),
        db.query<RowDataPacket[]>(
          "SELECT * FROM lcj_brain_project_runs WHERE projectId=? ORDER BY startedAt DESC LIMIT 30",
          [input.projectId]
        ),
        db.query<RowDataPacket[]>(
          "SELECT * FROM lcj_brain_project_audit_logs WHERE projectId=? ORDER BY createdAt DESC LIMIT 50",
          [input.projectId]
        ),
      ]);
      const latestSop = latestSopRows[0] || null;
      const latestGeneration = latestSop
        ? readSopGenerationMetadata(parseJson(latestSop.structuredContent, {}))
        : null;
      const baselineSourceIds = latestGeneration?.includedSourceIds.length
        ? latestGeneration.includedSourceIds
        : latestSop
          ? activeSourceRows
              .filter(
                row =>
                  new Date(row.createdAt).getTime() <=
                  new Date(latestSop.createdAt).getTime()
              )
              .map(row => Number(row.id))
          : [];
      const activeSourceIds = activeSourceRows.map(row => Number(row.id));
      const pendingIds = latestSop
        ? pendingSopSourceIds(activeSourceIds, baselineSourceIds)
        : [];
      const activeSourceSet = new Set(activeSourceIds);
      const removedSourceIds = latestSop
        ? baselineSourceIds.filter(sourceId => !activeSourceSet.has(sourceId))
        : [];
      const pendingSet = new Set(pendingIds);
      return {
        project,
        access,
        sourceCounts: sourceCountRows,
        sopCoverage: {
          latestVersionId: latestSop ? Number(latestSop.id) : null,
          latestVersion: latestSop ? Number(latestSop.version) : null,
          latestGeneratedAt: latestSop?.createdAt || null,
          includedSourceCount: baselineSourceIds.length,
          pendingSourceCount: pendingIds.length,
          removedSourceCount: removedSourceIds.length,
          removedSourceIds,
          pendingSources: activeSourceRows
            .filter(row => pendingSet.has(Number(row.id)))
            .map(row => ({
              id: Number(row.id),
              sourceType: String(row.sourceType),
              title: String(row.title),
              occurredAt: row.occurredAt,
              createdAt: row.createdAt,
            })),
        },
        dailySummaries: summaryRows.map(row => ({
          ...row,
          completedItems: parseJson(row.completedItems, []),
          decisions: parseJson(row.decisions, []),
          issues: parseJson(row.issues, []),
          risks: parseJson(row.risks, []),
          nextActions: parseJson(row.nextActions, []),
          gaps: parseJson(row.gaps, []),
          sourceIds: parseJson(row.sourceIds, []),
        })),
        sopVersions: sopRows.map(row => ({
          id: Number(row.id),
          projectId: Number(row.projectId),
          version: Number(row.version),
          status: row.status,
          title: row.title,
          sourceIds: parseJson(row.sourceIds, []),
          model: row.model,
          promptVersion: row.promptVersion,
          generatedBy: row.generatedBy,
          generatedByName: row.generatedByName,
          reason: row.reason,
          createdAt: row.createdAt,
        })),
        runs: runRows,
        audits: auditRows,
      };
    }),

  create: protectedProcedure
    .input(projectInput)
    .mutation(async ({ input, ctx }) => {
      await ensureLcjBrainProjectUpgrade();
      const actor = await getActor(ctx.user);
      const ownerUserId = input.ownerUserId || actor.id;
      if (ownerUserId !== actor.id && !actor.isSuperAdmin)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "只有超级管理员可以指定其他负责人",
        });
      const memberStaffIds = normalizeNumericIds(input.memberStaffIds);
      const linkedUserIds = await userIdsForStaffIds(memberStaffIds);
      const memberUserIds = normalizeNumericIds([
        ownerUserId,
        ...input.memberUserIds,
        ...linkedUserIds,
      ]);
      const keywords = normalizeProjectKeywords(input.keywords);
      if (input.endDate && input.endDate < input.startDate)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "结束日期不能早于开始日期",
        });
      if (
        input.autoCollectEnabled &&
        (!keywords.length || (!memberUserIds.length && !memberStaffIds.length))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "启用自动归集时必须设置成员和至少一个关键词",
        });
      }
      const [ownerRows] = await getPool().query<RowDataPacket[]>(
        "SELECT COALESCE(name,email) AS name FROM users WHERE id=? LIMIT 1",
        [ownerUserId]
      );
      const ownerName = cleanText(ownerRows[0]?.name || actor.name, 255);
      const [result] = await getPool().query<ResultSetHeader>(
        `INSERT INTO lcj_brain_projects
        (projectCode,name,projectType,description,objective,scope,startDate,endDate,ownerUserId,ownerName,memberUserIds,memberStaffIds,keywords,currentPhase,milestones,autoCollectEnabled,autoCollectMode,createdBy,createdByName)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          projectCode(),
          input.name,
          input.projectType,
          input.description || null,
          input.objective || null,
          input.scope || null,
          input.startDate,
          input.endDate || null,
          ownerUserId,
          ownerName,
          JSON.stringify(memberUserIds),
          JSON.stringify(memberStaffIds),
          JSON.stringify(keywords),
          input.currentPhase || null,
          JSON.stringify(input.milestones),
          input.autoCollectEnabled ? 1 : 0,
          input.autoCollectMode,
          actor.id,
          actor.name,
        ]
      );
      await writeAudit({
        projectId: result.insertId,
        entityType: "project",
        entityId: result.insertId,
        action: "project_created",
        actor,
        after: {
          name: input.name,
          status: "draft",
          ownerUserId,
          memberUserIds,
          memberStaffIds,
          keywords,
        },
      });
      return { projectId: result.insertId };
    }),

  update: protectedProcedure
    .input(
      projectInput.partial().extend({
        projectId: z.number().int().positive(),
        expectedVersion: z.number().int().positive(),
        status: z.enum(["draft", "active", "completed", "archived"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      const { project } = await requireProject(
        input.projectId,
        actor,
        "manage"
      );
      if (project.version !== input.expectedVersion)
        throw new TRPCError({
          code: "CONFLICT",
          message: "项目已被其他人更新，请刷新后重试",
        });
      const next = { ...project, ...input };
      if (
        input.ownerUserId &&
        input.ownerUserId !== project.ownerUserId &&
        !actor.isSuperAdmin
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "只有超级管理员可以变更项目负责人",
        });
      }
      if (input.ownerUserId && input.ownerUserId !== project.ownerUserId) {
        const [ownerRows] = await getPool().query<RowDataPacket[]>(
          "SELECT COALESCE(name,email) AS name FROM users WHERE id=? LIMIT 1",
          [input.ownerUserId]
        );
        if (!ownerRows[0])
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "负责人账号不存在",
          });
        next.ownerName = cleanText(ownerRows[0].name, 255);
      }
      const nextStatus = (input.status ||
        project.status) as LcjBrainProjectStatus;
      if (!canTransitionProjectStatus(project.status, nextStatus))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `不允许从${project.status}切换到${nextStatus}`,
        });
      const memberStaffIds = input.memberStaffIds
        ? normalizeNumericIds(input.memberStaffIds)
        : project.memberStaffIds;
      const linkedUserIds = await userIdsForStaffIds(memberStaffIds);
      const retainedDirectUserIds =
        input.memberUserIds ??
        (input.memberStaffIds ? [] : project.memberUserIds);
      const memberUserIds = normalizeNumericIds([
        Number(next.ownerUserId),
        ...retainedDirectUserIds,
        ...linkedUserIds,
      ]);
      const keywords = input.keywords
        ? normalizeProjectKeywords(input.keywords)
        : project.keywords;
      if (next.endDate && next.endDate < next.startDate)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "结束日期不能早于开始日期",
        });
      if (
        next.autoCollectEnabled &&
        (!keywords.length || (!memberUserIds.length && !memberStaffIds.length))
      )
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "启用自动归集时必须设置成员和至少一个关键词",
        });
      const completedAt =
        nextStatus === "completed"
          ? new Date()
          : nextStatus === "active"
            ? null
            : project.completedAt;
      const [result] = await getPool().query<ResultSetHeader>(
        `UPDATE lcj_brain_projects SET name=?, projectType=?, description=?, objective=?, scope=?, status=?, startDate=?, endDate=?, ownerUserId=?, ownerName=?, memberUserIds=?, memberStaffIds=?, keywords=?, currentPhase=?, milestones=?, autoCollectEnabled=?, autoCollectMode=?, completedAt=?, version=version+1
       WHERE id=? AND version=?`,
        [
          next.name,
          next.projectType,
          next.description || null,
          next.objective || null,
          next.scope || null,
          nextStatus,
          next.startDate,
          next.endDate || null,
          Number(next.ownerUserId),
          next.ownerName,
          JSON.stringify(memberUserIds),
          JSON.stringify(memberStaffIds),
          JSON.stringify(keywords),
          next.currentPhase || null,
          JSON.stringify(next.milestones || []),
          next.autoCollectEnabled ? 1 : 0,
          next.autoCollectMode,
          completedAt ? toSqlDateTime(completedAt) : null,
          input.projectId,
          input.expectedVersion,
        ]
      );
      if (result.affectedRows !== 1)
        throw new TRPCError({
          code: "CONFLICT",
          message: "项目已被其他人更新，请刷新后重试",
        });
      const updated = await getProjectRow(input.projectId);
      await writeAudit({
        projectId: input.projectId,
        entityType: "project",
        entityId: input.projectId,
        action:
          project.status === nextStatus
            ? "project_updated"
            : `status_${project.status}_to_${nextStatus}`,
        actor,
        before: project,
        after: updated,
      });
      return { project: updated };
    }),

  sources: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        includeExcluded: z.boolean().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      await requireProject(input.projectId, actor);
      const [rows] = await getPool().query<RowDataPacket[]>(
        `SELECT * FROM lcj_brain_project_sources WHERE projectId=? ${input.includeExcluded ? "" : "AND excluded=0"} ORDER BY occurredAt DESC, id DESC`,
        [input.projectId]
      );
      return rows.map(asSource);
    }),

  addManualSource: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        sourceType: z.enum(["note", "decision"]),
        title: z.string().min(1).max(500),
        content: z.string().min(1).max(60_000),
        occurredAt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      await requireProject(input.projectId, actor, "add");
      const id = crypto.randomUUID();
      return insertSourceSnapshot({
        projectId: input.projectId,
        sourceType: input.sourceType,
        sourceId: id,
        sourceKey: buildProjectSourceKey(input.sourceType, id),
        title: input.title,
        summary: cleanText(input.content, 500),
        content: input.content,
        occurredAt: input.occurredAt || new Date(),
        contributorUserId: actor.id,
        contributorName: actor.name,
        matchedBy: "direct_link",
        matchReason: "项目成员直接记录",
        actor,
      });
    }),

  addExistingSource: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        sourceType: z.enum([
          "meeting",
          "daily_report",
          "task",
          "issue",
          "knowledge",
        ]),
        sourceId: z.number().int().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      await requireProject(input.projectId, actor, "add");
      const source = await fetchExistingSource(
        input.sourceType,
        input.sourceId,
        actor
      );
      return insertSourceSnapshot({
        projectId: input.projectId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceKey: buildProjectSourceKey(input.sourceType, input.sourceId),
        ...source,
        matchedBy: "direct_link",
        matchReason: "项目成员手动导入",
        actor,
      });
    }),

  excludeSource: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        sourceId: z.number().int().positive(),
        excluded: z.boolean(),
        reason: z.string().max(1_000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      await requireProject(input.projectId, actor, "manage");
      const [rows] = await getPool().query<RowDataPacket[]>(
        "SELECT * FROM lcj_brain_project_sources WHERE id=? AND projectId=? LIMIT 1",
        [input.sourceId, input.projectId]
      );
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "来源不存在" });
      await getPool().query(
        "UPDATE lcj_brain_project_sources SET excluded=?, excludedAt=? WHERE id=? AND projectId=?",
        [
          input.excluded ? 1 : 0,
          input.excluded ? toSqlDateTime(new Date()) : null,
          input.sourceId,
          input.projectId,
        ]
      );
      await writeAudit({
        projectId: input.projectId,
        entityType: "source",
        entityId: input.sourceId,
        action: input.excluded ? "source_excluded" : "source_restored",
        actor,
        before: asSource(rows[0]),
        after: { excluded: input.excluded },
        reason: input.reason,
      });
      return { success: true };
    }),

  candidates: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        sourceType: z.enum([
          "meeting",
          "daily_report",
          "task",
          "issue",
          "knowledge",
        ]),
        search: z.string().max(100).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      const { project } = await requireProject(input.projectId, actor);
      const db = getPool();
      const start = `${project.startDate} 00:00:00`;
      const end = `${project.endDate || todayInTokyo()} 23:59:59`;
      const search = `%${cleanText(input.search, 100)}%`;
      let rows: any[] = [];
      if (input.sourceType === "meeting") {
        [rows] = await db.query<RowDataPacket[]>(
          "SELECT id, date AS occurredAt, CONCAT(date, ' 早会') AS title, transcript AS content, participantSnapshot FROM morning_meetings WHERE date BETWEEN ? AND ? AND (?='%%' OR transcript LIKE ?) ORDER BY date DESC LIMIT 80",
          [project.startDate, project.endDate || todayInTokyo(), search, search]
        );
      } else if (input.sourceType === "daily_report") {
        const visibility = await resolveReportVisibilityScope({
          id: actor.id,
          email: actor.email,
          name: actor.name,
        });
        const [allRows] = await db.query<RowDataPacket[]>(
          "SELECT r.id,r.reportDate AS occurredAt,CONCAT(rs.name,' · ',DATE(r.reportDate),' 日报') AS title,CONCAT_WS('\n',r.workContent,r.issues,r.remarks) AS content,r.reportStaffId,r.createdBy,rs.linkedStaffId,rs.name AS contributorName FROM reports r JOIN report_staff rs ON rs.id=r.reportStaffId WHERE r.reportDate BETWEEN ? AND ? AND (?='%%' OR CONCAT_WS(' ',r.workContent,r.issues,r.remarks) LIKE ?) ORDER BY r.reportDate DESC LIMIT 200",
          [start, end, search, search]
        );
        rows = allRows
          .filter(row =>
            canReadReport(visibility, {
              reportStaffId: Number(row.reportStaffId),
              createdBy: Number(row.createdBy),
            })
          )
          .slice(0, 80);
      } else if (input.sourceType === "task") {
        [rows] = await db.query<RowDataPacket[]>(
          "SELECT t.id,t.createdAt AS occurredAt,LEFT(t.taskDetail,160) AS title,CONCAT_WS('\n',t.taskDetail,t.extractedContext,t.notes) AS content,t.staffId,t.createdBy,s.name AS contributorName FROM tasks t LEFT JOIN staff s ON s.id=t.staffId WHERE t.createdAt BETWEEN ? AND ? AND (?='%%' OR CONCAT_WS(' ',t.taskDetail,t.extractedContext,t.notes) LIKE ?) ORDER BY t.createdAt DESC LIMIT 80",
          [start, end, search, search]
        );
      } else if (input.sourceType === "issue") {
        const privacy = actor.isSuperAdmin
          ? "1=1"
          : "((isPrivate=0 OR isPrivate IS NULL) OR creatorId=? OR assigneeId=? OR helperId=? OR creatorName=?)";
        const params = actor.isSuperAdmin
          ? [start, end, search, search]
          : [
              actor.id,
              actor.id,
              actor.id,
              actor.name,
              start,
              end,
              search,
              search,
            ];
        [rows] = await db
          .query<
            RowDataPacket[]
          >(`SELECT id,createdAt AS occurredAt,title,CONCAT_WS('\n',description,solution) AS content,creatorId AS createdBy,creatorName AS contributorName FROM issues WHERE ${privacy} AND createdAt BETWEEN ? AND ? AND (?='%%' OR CONCAT_WS(' ',title,description,solution) LIKE ?) ORDER BY createdAt DESC LIMIT 80`, params)
          .catch(() => [[] as RowDataPacket[], []] as any);
      } else {
        [rows] = await db.query<RowDataPacket[]>(
          "SELECT id,COALESCE(meetingDate,createdAt) AS occurredAt,title,CONCAT_WS('\n',summary,content) AS content,uploadedBy AS createdBy,uploadedByName AS contributorName FROM lcj_brain_knowledge WHERE COALESCE(meetingDate,createdAt) BETWEEN ? AND ? AND (?='%%' OR CONCAT_WS(' ',title,summary,content) LIKE ?) ORDER BY COALESCE(meetingDate,createdAt) DESC LIMIT 80",
          [start, end, search, search]
        );
      }
      const [existingRows] = await db.query<RowDataPacket[]>(
        "SELECT sourceKey,excluded FROM lcj_brain_project_sources WHERE projectId=?",
        [input.projectId]
      );
      const existing = new Map(
        existingRows.map(row => [String(row.sourceKey), Boolean(row.excluded)])
      );
      return rows.map(row => {
        const meetingParticipants = parseJson<any[]>(
          row.participantSnapshot,
          []
        );
        const personIds = [
          row.createdBy,
          row.staffId,
          row.linkedStaffId,
          ...meetingParticipants.flatMap(participant => [
            participant.userId,
            participant.staffId,
          ]),
        ]
          .map(Number)
          .filter(Number.isInteger);
        const personNames = [
          row.contributorName,
          ...meetingParticipants.map(participant => participant.name),
        ].filter(Boolean);
        const match = matchAutoCollectCandidate(
          {
            startDate: project.startDate,
            endDate: project.endDate,
            keywords: project.keywords,
            memberUserIds: project.memberUserIds,
            memberStaffIds: project.memberStaffIds,
            mode: project.autoCollectMode,
          },
          {
            occurredDate: new Date(row.occurredAt).toISOString().slice(0, 10),
            text: `${row.title}\n${row.content}`,
            personIds,
            personNames,
          }
        );
        const key = buildProjectSourceKey(input.sourceType, Number(row.id));
        return {
          id: Number(row.id),
          title: cleanText(row.title, 500),
          preview: cleanText(row.content, 500),
          occurredAt: row.occurredAt,
          contributorName: row.contributorName || null,
          autoMatch: match,
          linked: existing.has(key),
          excluded: existing.get(key) || false,
        };
      });
    }),

  runDailyNow: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      await requireProject(input.projectId, actor, "manage");
      return runProjectDailyCollection(input.projectId, new Date(), {
        force: true,
        actorUserId: actor.id,
      });
    }),

  generateSop: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        status: z.enum(["draft", "final"]).default("draft"),
        mode: z.enum(["full", "incremental"]).default("full"),
        baseVersionId: z.number().int().positive().optional(),
        reason: z.string().max(2_000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      const { project } = await requireProject(
        input.projectId,
        actor,
        "manage"
      );
      if (input.status === "final" && project.status !== "completed")
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "请先将项目标记为已完成，再生成终版SOP",
        });
      return generateSopVersion(project, actor, input.status, input.reason, {
        mode: input.mode,
        baseVersionId: input.baseVersionId,
      });
    }),

  getSopVersion: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        versionId: z.number().int().positive(),
      })
    )
    .query(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      await requireProject(input.projectId, actor);
      const [rows] = await getPool().query<RowDataPacket[]>(
        "SELECT * FROM lcj_brain_project_sop_versions WHERE id=? AND projectId=? LIMIT 1",
        [input.versionId, input.projectId]
      );
      if (!rows[0])
        throw new TRPCError({ code: "NOT_FOUND", message: "SOP版本不存在" });
      const row: any = rows[0];
      return {
        id: Number(row.id),
        projectId: Number(row.projectId),
        version: Number(row.version),
        status: row.status as "draft" | "final",
        title: String(row.title),
        structuredContent: parseJson<Record<string, unknown>>(
          row.structuredContent,
          {}
        ),
        markdown: String(row.markdown || ""),
        sourceIds: parseJson<number[]>(row.sourceIds, []),
        model: row.model ? String(row.model) : null,
        promptVersion: String(row.promptVersion),
        generatedBy: Number(row.generatedBy),
        generatedByName: String(row.generatedByName),
        reason: row.reason ? String(row.reason) : null,
        createdAt: row.createdAt,
      };
    }),

  saveSopRevision: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        baseVersionId: z.number().int().positive(),
        markdown: z.string().min(1).max(300_000),
        title: z.string().min(1).max(500),
        status: z.enum(["draft", "final"]),
        reason: z.string().min(1).max(2_000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      const { project } = await requireProject(
        input.projectId,
        actor,
        "manage"
      );
      if (input.status === "final" && project.status !== "completed") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "项目完成后才能保存终版SOP",
        });
      }
      const [baseRows] = await getPool().query<RowDataPacket[]>(
        "SELECT * FROM lcj_brain_project_sop_versions WHERE id=? AND projectId=? LIMIT 1",
        [input.baseVersionId, input.projectId]
      );
      if (!baseRows[0])
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "基础SOP版本不存在",
        });
      const connection = await getPool().getConnection();
      try {
        await connection.beginTransaction();
        const [versionRows] = await connection.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(version),0)+1 AS nextVersion FROM lcj_brain_project_sop_versions WHERE projectId=? FOR UPDATE",
          [input.projectId]
        );
        const version = Number(versionRows[0].nextVersion);
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO lcj_brain_project_sop_versions (projectId,version,status,title,structuredContent,markdown,sourceIds,model,promptVersion,generatedBy,generatedByName,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            input.projectId,
            version,
            input.status,
            input.title,
            baseRows[0].structuredContent,
            input.markdown,
            baseRows[0].sourceIds,
            "human_revision",
            LCJ_BRAIN_SOP_PROMPT_VERSION,
            actor.id,
            actor.name,
            input.reason,
          ]
        );
        await writeAudit(
          {
            projectId: input.projectId,
            entityType: "sop",
            entityId: result.insertId,
            action: "sop_manual_revision",
            actor,
            after: {
              version,
              status: input.status,
              baseVersionId: input.baseVersionId,
            },
            reason: input.reason,
          },
          connection
        );
        await connection.commit();
        return { id: result.insertId, version };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  restoreSopVersion: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int().positive(),
        versionId: z.number().int().positive(),
        reason: z.string().min(1).max(2_000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const actor = await getActor(ctx.user);
      await requireProject(input.projectId, actor, "manage");
      const db = getPool();
      const [baseRows] = await db.query<RowDataPacket[]>(
        "SELECT * FROM lcj_brain_project_sop_versions WHERE id=? AND projectId=? LIMIT 1",
        [input.versionId, input.projectId]
      );
      const base = baseRows[0];
      if (!base)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "待恢复的SOP版本不存在",
        });
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [versionRows] = await connection.query<RowDataPacket[]>(
          "SELECT COALESCE(MAX(version),0)+1 AS nextVersion FROM lcj_brain_project_sop_versions WHERE projectId=? FOR UPDATE",
          [input.projectId]
        );
        const version = Number(versionRows[0].nextVersion);
        const [result] = await connection.query<ResultSetHeader>(
          `INSERT INTO lcj_brain_project_sop_versions (projectId,version,status,title,structuredContent,markdown,sourceIds,model,promptVersion,generatedBy,generatedByName,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            input.projectId,
            version,
            "draft",
            base.title,
            base.structuredContent,
            base.markdown,
            base.sourceIds,
            "version_restore",
            LCJ_BRAIN_SOP_PROMPT_VERSION,
            actor.id,
            actor.name,
            input.reason,
          ]
        );
        await writeAudit(
          {
            projectId: input.projectId,
            entityType: "sop",
            entityId: result.insertId,
            action: "sop_version_restored",
            actor,
            after: { version, restoredFromVersion: Number(base.version) },
            reason: input.reason,
          },
          connection
        );
        await connection.commit();
        return { id: result.insertId, version };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),
});
