import { TRPCError } from "@trpc/server";
import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";
import { storageGet } from "./storage";
import { getDb } from "./db";
import { getUserManagementAccess } from "./userManagementAccess";
import { ensureHrRoleReviewSchema, getHrRoleReviewPool } from "./hrRoleReviewUpgrade";

export type HrRoleActor = { id: number; role: string; email: string; name?: string | null };
export type ReviewStatus = "draft" | "submitted" | "approved" | "revision_requested";

const REVIEW_TEXT_FIELDS = [
  "focusGoals",
  "achievements",
  "metricsResult",
  "incompleteItems",
  "problemsAndRisks",
  "supportNeeded",
  "nextMonthPlan",
] as const;

export type ReviewDraftInput = Record<(typeof REVIEW_TEXT_FIELDS)[number], string> & {
  reviewMonth: string;
};

export type RoleDocumentCreateInput = {
  scope: "employee" | "department";
  staffId: number | null;
  department: string | null;
  title: string;
  effectiveMonth: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
  extractedText: string;
  extractedChars: number;
  textTruncated: boolean;
  extractionStatus: "extracted" | "stored_only";
  responsibilities?: string | null;
  goalsAndMetrics?: string | null;
  risks?: string | null;
  supportNeeded?: string | null;
  departmentSopContent?: string | null;
};

export function currentTokyoMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}

export function validateReviewMonth(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-MONTHLY-MONTH] 月份格式不正确" });
  return value;
}

function cleanText(value: unknown, max = 20_000): string {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function actorName(actor: HrRoleActor): string {
  return String(actor.name || actor.email || `user:${actor.id}`).slice(0, 255);
}

type HrRoleManagementScope = { isSuperAdmin: boolean; department: string | null };

function normalizeDepartment(value: unknown): string {
  return cleanText(value, 255).toLocaleLowerCase();
}

export async function requireHrRoleManagement(actor: HrRoleActor): Promise<HrRoleManagementScope> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "[HR-MONTHLY-DB] 数据库暂时不可用" });
  const access = await getUserManagementAccess(db, actor.id);
  if (access.isSuperAdmin) return { isSuperAdmin: true, department: null };
  if (access.level === "department_manager" && normalizeDepartment(access.managedDepartment)) {
    return { isSuperAdmin: false, department: cleanText(access.managedDepartment, 255) };
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "[HR-MONTHLY-MANAGER] 仅超级管理员或已配置部门的部门负责人可以管理" });
}

export function canEditMonthlyReview(status: string | null | undefined): boolean {
  return !status || status === "draft" || status === "revision_requested";
}

export function missingMonthlyReviewFields(input: Partial<Record<(typeof REVIEW_TEXT_FIELDS)[number], unknown>>): string[] {
  return REVIEW_TEXT_FIELDS.filter(field => !cleanText(input[field]));
}

async function activeStaffById(connection: PoolConnection | ReturnType<typeof getHrRoleReviewPool>, staffId: number) {
  const [rows] = await connection.query(
    "SELECT id,name,nameEn,email,department,position,country FROM staff WHERE id=? AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL LIMIT 1",
    [staffId],
  );
  const row = (rows as any[])[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "[HR-MONTHLY-STAFF] 在职员工不存在或已归档" });
  return row;
}

export async function resolveOwnActiveStaff(actor: HrRoleActor, connection: Pool | PoolConnection = getHrRoleReviewPool()) {
  const [rows] = await connection.query(
    "SELECT id,name,nameEn,email,department,position,country FROM staff WHERE LOWER(TRIM(email))=LOWER(TRIM(?)) AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL ORDER BY id LIMIT 2",
    [actor.email],
  );
  if ((rows as any[]).length !== 1) {
    throw new TRPCError({ code: "FORBIDDEN", message: "[HR-MONTHLY-IDENTITY] 登录邮箱无法唯一关联在职HR员工，请联系管理员" });
  }
  return (rows as any[])[0];
}

async function requireStaffManagement(actor: HrRoleActor, staffId: number, connection: Pool | PoolConnection = getHrRoleReviewPool()) {
  const scope = await requireHrRoleManagement(actor);
  const member = await activeStaffById(connection, staffId);
  if (!scope.isSuperAdmin && normalizeDepartment(member.department) !== normalizeDepartment(scope.department)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "[HR-MONTHLY-DEPARTMENT] 只能管理本人负责部门的员工" });
  }
  return member;
}

async function isOwnActiveRoleDocument(actor: HrRoleActor, document: any, connection: Pool | PoolConnection = getHrRoleReviewPool()) {
  if (document.scope !== "employee" || document.status !== "active") return false;
  const [rows] = await connection.query(
    "SELECT id FROM staff WHERE id=? AND LOWER(TRIM(email))=LOWER(TRIM(?)) AND isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL LIMIT 1",
    [document.staffId, actor.email],
  );
  return (rows as any[]).length === 1;
}

async function requireDocumentManagement(actor: HrRoleActor, document: any, connection: Pool | PoolConnection = getHrRoleReviewPool()) {
  const scope = await requireHrRoleManagement(actor);
  if (scope.isSuperAdmin) return;
  const targetDepartment = document.scope === "department"
    ? cleanText(document.department, 255)
    : cleanText((await activeStaffById(connection, Number(document.staffId))).department, 255);
  if (normalizeDepartment(targetDepartment) !== normalizeDepartment(scope.department)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "[HR-MONTHLY-DEPARTMENT] 只能管理本人负责部门的资料" });
  }
}

export async function requireHrRoleDocumentTarget(actor: HrRoleActor, input: { scope: "employee" | "department"; staffId: number | null; department: string | null }) {
  const pool = getHrRoleReviewPool();
  if (input.scope === "employee") {
    if (!input.staffId) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-STAFF] 请选择员工" });
    await requireStaffManagement(actor, input.staffId, pool);
    return;
  }
  const scope = await requireHrRoleManagement(actor);
  const department = cleanText(input.department, 255);
  if (!department) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-DEPARTMENT] 请选择部门" });
  if (!scope.isSuperAdmin && normalizeDepartment(department) !== normalizeDepartment(scope.department)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "[HR-MONTHLY-DEPARTMENT] 只能管理本人负责部门的资料" });
  }
}

async function writeAudit(connection: PoolConnection, input: {
  entityType: "role_document" | "monthly_review";
  entityId: number;
  staffId?: number | null;
  action: string;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  actor: HrRoleActor;
  reason?: string | null;
}) {
  await connection.query(
    "INSERT INTO hr_role_review_audit_logs (entityType,entityId,staffId,action,beforeStatus,afterStatus,actorId,actorName,reason) VALUES (?,?,?,?,?,?,?,?,?)",
    [input.entityType, input.entityId, input.staffId || null, input.action, input.beforeStatus || null, input.afterStatus || null, input.actor.id, actorName(input.actor), cleanText(input.reason, 2000) || null],
  );
}

function roleDocumentPublic(row: any) {
  if (!row) return null;
  const { storageKey: _storageKey, sha256: _sha256, extractedText: _extractedText, ...metadata } = row;
  return { ...metadata, previewText: String(row.extractedText || "").slice(0, 2000) };
}

export async function saveUploadedRoleDocument(actor: HrRoleActor, input: RoleDocumentCreateInput) {
  await requireHrRoleDocumentTarget(actor, input);
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const effectiveMonth = validateReviewMonth(input.effectiveMonth);
    const title = cleanText(input.title, 255);
    const department = cleanText(input.department, 255) || null;
    if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-TITLE] 资料标题不能为空" });
    if (input.scope === "employee") {
      if (!input.staffId) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-STAFF] 请选择员工" });
      await requireStaffManagement(actor, input.staffId, connection);
    } else if (!department) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-DEPARTMENT] 请选择部门" });
    } else {
      const managementScope = await requireHrRoleManagement(actor);
      if (!managementScope.isSuperAdmin && normalizeDepartment(department) !== normalizeDepartment(managementScope.department)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "[HR-MONTHLY-DEPARTMENT] 只能管理本人负责部门的资料" });
      }
    }
    if (!input.storageKey.startsWith(`hr-role-documents/admin-${actor.id}/`)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-STORAGE] 文件保存路径不正确" });
    }

    const [duplicateRows] = await connection.query(
      input.scope === "employee"
        ? "SELECT id FROM hr_role_documents WHERE scope='employee' AND staffId=? AND sha256=? LIMIT 1"
        : "SELECT id FROM hr_role_documents WHERE scope='department' AND department=? AND sha256=? LIMIT 1",
      input.scope === "employee" ? [input.staffId, input.sha256] : [department, input.sha256],
    );
    if ((duplicateRows as any[]).length > 0) throw new TRPCError({ code: "CONFLICT", message: "[HR-ROLE-DUPLICATE] 同一资料已经导入" });

    const [versionRows] = await connection.query(
      input.scope === "employee"
        ? "SELECT COALESCE(MAX(version),0)+1 AS nextVersion FROM hr_role_documents WHERE scope='employee' AND staffId=?"
        : "SELECT COALESCE(MAX(version),0)+1 AS nextVersion FROM hr_role_documents WHERE scope='department' AND department=?",
      [input.scope === "employee" ? input.staffId : department],
    );
    const version = Math.max(1, Number((versionRows as any[])[0]?.nextVersion || 1));
    const [inserted] = await connection.query<ResultSetHeader>(
      `INSERT INTO hr_role_documents
      (scope,staffId,department,title,effectiveMonth,version,status,fileName,storageKey,mimeType,fileSize,sha256,extractedText,extractedChars,textTruncated,extractionStatus,responsibilities,goalsAndMetrics,risks,supportNeeded,departmentSopContent,createdBy)
      VALUES (?,?,?,?,?,?,'pending_review',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [input.scope, input.staffId, department, title, effectiveMonth, version, input.fileName, input.storageKey, input.mimeType, input.fileSize, input.sha256, input.extractedText, input.extractedChars, input.textTruncated ? 1 : 0, input.extractionStatus, cleanText(input.responsibilities) || null, cleanText(input.goalsAndMetrics) || null, cleanText(input.risks) || null, cleanText(input.supportNeeded) || null, cleanText(input.departmentSopContent) || null, actor.id],
    );
    const documentId = Number(inserted.insertId);
    await writeAudit(connection, { entityType: "role_document", entityId: documentId, staffId: input.staffId, action: "document.uploaded", afterStatus: "pending_review", actor });
    await connection.commit();
    const [rows] = await pool.query("SELECT * FROM hr_role_documents WHERE id=? LIMIT 1", [documentId]);
    return roleDocumentPublic((rows as any[])[0]);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
      throw new TRPCError({ code: "CONFLICT", message: "[HR-ROLE-DUPLICATE] 同一资料已经导入" });
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function getMyOverview(actor: HrRoleActor, reviewMonth = currentTokyoMonth()) {
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const month = validateReviewMonth(reviewMonth);
  const member = await resolveOwnActiveStaff(actor, pool);
  const [documents] = await pool.query("SELECT * FROM hr_role_documents WHERE scope='employee' AND staffId=? AND status='active' ORDER BY version DESC", [member.id]);
  const [reviews] = await pool.query("SELECT * FROM hr_monthly_role_reviews WHERE staffId=? ORDER BY reviewMonth DESC LIMIT 24", [member.id]);
  const reviewList = reviews as any[];
  return { staff: member, reviewMonth: month, currentRoleDocument: roleDocumentPublic((documents as any[])[0]), documents: (documents as any[]).map(roleDocumentPublic), currentReview: reviewList.find(row => row.reviewMonth === month) || null, reviews: reviewList };
}

export async function getStaffRoleDetail(actor: HrRoleActor, staffId: number, reviewMonth = currentTokyoMonth()) {
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const member = await requireStaffManagement(actor, staffId, pool);
  const month = validateReviewMonth(reviewMonth);
  const [documents] = await pool.query("SELECT * FROM hr_role_documents WHERE scope='employee' AND staffId=? ORDER BY version DESC", [member.id]);
  const [reviews] = await pool.query("SELECT * FROM hr_monthly_role_reviews WHERE staffId=? ORDER BY reviewMonth DESC LIMIT 24", [member.id]);
  const reviewList = reviews as any[];
  return { staff: member, reviewMonth: month, documents: (documents as any[]).map(roleDocumentPublic), currentReview: reviewList.find(row => row.reviewMonth === month) || null, reviews: reviewList };
}

export async function getDepartmentRoleDocuments(actor: HrRoleActor) {
  const scope = await requireHrRoleManagement(actor);
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const [rows] = scope.isSuperAdmin
    ? await pool.query("SELECT * FROM hr_role_documents WHERE scope='department' ORDER BY department,version DESC")
    : await pool.query("SELECT * FROM hr_role_documents WHERE scope='department' AND LOWER(TRIM(department))=LOWER(TRIM(?)) ORDER BY version DESC", [scope.department]);
  return (rows as any[]).map(roleDocumentPublic);
}

export async function getAdminOverview(actor: HrRoleActor, reviewMonth = currentTokyoMonth()) {
  const scope = await requireHrRoleManagement(actor);
  await ensureHrRoleReviewSchema();
  const month = validateReviewMonth(reviewMonth);
  const pool = getHrRoleReviewPool();
  const [staffRows] = scope.isSuperAdmin
    ? await pool.query("SELECT id,name,nameEn,department,position,country FROM staff WHERE isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL ORDER BY country,department,name")
    : await pool.query("SELECT id,name,nameEn,department,position,country FROM staff WHERE isActive='active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL AND LOWER(TRIM(department))=LOWER(TRIM(?)) ORDER BY country,department,name", [scope.department]);
  const [reviewRows] = await pool.query("SELECT id,staffId,status,submittedAt,reviewedAt,updatedAt FROM hr_monthly_role_reviews WHERE reviewMonth=?", [month]);
  const [documentRows] = await pool.query("SELECT id,staffId,status,version,effectiveMonth FROM hr_role_documents WHERE scope='employee' AND status IN ('active','pending_review') ORDER BY version DESC", []);
  const reviewsByStaff = new Map((reviewRows as any[]).map(row => [Number(row.staffId), row]));
  const documentsByStaff = new Map<number, any>();
  for (const row of documentRows as any[]) if (!documentsByStaff.has(Number(row.staffId)) || row.status === "active") documentsByStaff.set(Number(row.staffId), row);
  const staffList = (staffRows as any[]).map(member => ({ ...member, review: reviewsByStaff.get(Number(member.id)) || null, roleDocument: documentsByStaff.get(Number(member.id)) || null, reviewStatus: reviewsByStaff.get(Number(member.id))?.status || "not_started" }));
  const counts = { total: staffList.length, not_started: 0, draft: 0, submitted: 0, approved: 0, revision_requested: 0 } as Record<string, number>;
  for (const member of staffList) counts[member.reviewStatus] = (counts[member.reviewStatus] || 0) + 1;
  return {
    reviewMonth: month,
    counts,
    staff: staffList,
    managementScope: { isSuperAdmin: scope.isSuperAdmin, department: scope.department },
  };
}

export async function saveReviewDraft(actor: HrRoleActor, input: ReviewDraftInput) {
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const member = await resolveOwnActiveStaff(actor, connection);
    const month = validateReviewMonth(input.reviewMonth);
    const [existingRows] = await connection.query("SELECT * FROM hr_monthly_role_reviews WHERE staffId=? AND reviewMonth=? LIMIT 1 FOR UPDATE", [member.id, month]);
    const existing = (existingRows as any[])[0];
    if (existing && !canEditMonthlyReview(String(existing.status))) {
      throw new TRPCError({ code: "CONFLICT", message: "[HR-MONTHLY-LOCKED] 提交后的月度复盘需由管理员退回后才能修改" });
    }
    const [activeDocumentRows] = await connection.query("SELECT id FROM hr_role_documents WHERE scope='employee' AND staffId=? AND status='active' ORDER BY version DESC LIMIT 1", [member.id]);
    const roleDocumentId = Number((activeDocumentRows as any[])[0]?.id || existing?.roleDocumentId || 0) || null;
    const values = REVIEW_TEXT_FIELDS.map(field => cleanText(input[field]));
    let reviewId: number;
    if (existing) {
      await connection.query(
        `UPDATE hr_monthly_role_reviews SET roleDocumentId=?,focusGoals=?,achievements=?,metricsResult=?,incompleteItems=?,problemsAndRisks=?,supportNeeded=?,nextMonthPlan=?,status='draft',reviewedBy=NULL,reviewedAt=NULL,reviewComment=NULL WHERE id=?`,
        [roleDocumentId, ...values, existing.id],
      );
      reviewId = Number(existing.id);
    } else {
      const [inserted] = await connection.query<ResultSetHeader>(
        `INSERT INTO hr_monthly_role_reviews (staffId,reviewMonth,roleDocumentId,focusGoals,achievements,metricsResult,incompleteItems,problemsAndRisks,supportNeeded,nextMonthPlan,status) VALUES (?,?,?,?,?,?,?,?,?,?,'draft')`,
        [member.id, month, roleDocumentId, ...values],
      );
      reviewId = Number(inserted.insertId);
    }
    await writeAudit(connection, { entityType: "monthly_review", entityId: reviewId, staffId: member.id, action: "review.draft_saved", beforeStatus: existing?.status || null, afterStatus: "draft", actor });
    await connection.commit();
    const [rows] = await pool.query("SELECT * FROM hr_monthly_role_reviews WHERE id=? LIMIT 1", [reviewId]);
    return (rows as any[])[0];
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function submitReview(actor: HrRoleActor, input: ReviewDraftInput) {
  await saveReviewDraft(actor, input);
  const pool = getHrRoleReviewPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const member = await resolveOwnActiveStaff(actor, connection);
    const month = validateReviewMonth(input.reviewMonth);
    const [rows] = await connection.query("SELECT * FROM hr_monthly_role_reviews WHERE staffId=? AND reviewMonth=? LIMIT 1 FOR UPDATE", [member.id, month]);
    const review = (rows as any[])[0];
    const missing = missingMonthlyReviewFields(review || {});
    if (missing.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-MONTHLY-INCOMPLETE] 所有项目都必须填写；没有内容时请填写“无”" });
    await connection.query("UPDATE hr_monthly_role_reviews SET status='submitted',submittedBy=?,submittedAt=CURRENT_TIMESTAMP,reviewedBy=NULL,reviewedAt=NULL,reviewComment=NULL WHERE id=?", [actor.id, review.id]);
    await writeAudit(connection, { entityType: "monthly_review", entityId: Number(review.id), staffId: member.id, action: "review.submitted", beforeStatus: review.status, afterStatus: "submitted", actor });
    await connection.commit();
    return { success: true, id: Number(review.id), status: "submitted" as const };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function reviewMonthlySubmission(actor: HrRoleActor, input: { id: number; decision: "approve" | "request_revision"; comment?: string }) {
  await requireHrRoleManagement(actor);
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM hr_monthly_role_reviews WHERE id=? LIMIT 1 FOR UPDATE", [input.id]);
    const review = (rows as any[])[0];
    if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "[HR-MONTHLY-NOT-FOUND] 月度复盘不存在" });
    await requireStaffManagement(actor, Number(review.staffId), connection);
    if (review.status !== "submitted") throw new TRPCError({ code: "CONFLICT", message: "[HR-MONTHLY-STATE] 只有待确认的复盘可以审核" });
    const comment = cleanText(input.comment, 4000);
    if (input.decision === "request_revision" && !comment) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-MONTHLY-COMMENT] 退回时必须填写修改说明" });
    const status = input.decision === "approve" ? "approved" : "revision_requested";
    await connection.query("UPDATE hr_monthly_role_reviews SET status=?,reviewedBy=?,reviewedAt=CURRENT_TIMESTAMP,reviewComment=? WHERE id=?", [status, actor.id, comment || null, review.id]);
    await writeAudit(connection, { entityType: "monthly_review", entityId: Number(review.id), staffId: Number(review.staffId), action: input.decision === "approve" ? "review.approved" : "review.revision_requested", beforeStatus: review.status, afterStatus: status, actor, reason: comment });
    await connection.commit();
    return { success: true, status };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateRoleDocument(actor: HrRoleActor, input: { id: number; title?: string; fileName?: string; responsibilities?: string; goalsAndMetrics?: string; risks?: string; supportNeeded?: string; departmentSopContent?: string }) {
  await requireHrRoleManagement(actor);
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM hr_role_documents WHERE id=? LIMIT 1 FOR UPDATE", [input.id]);
    const document = (rows as any[])[0];
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "[HR-ROLE-NOT-FOUND] 岗位资料不存在" });
    await requireDocumentManagement(actor, document, connection);
    const title = input.title === undefined ? document.title : cleanText(input.title, 255);
    const fileName = input.fileName === undefined ? document.fileName : cleanText(input.fileName, 255).replace(/[\\/\u0000-\u001f\u007f]+/g, "_");
    if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-TITLE] 资料标题不能为空" });
    if (!fileName) throw new TRPCError({ code: "BAD_REQUEST", message: "[HR-ROLE-FILENAME] 文件名不能为空" });
    await connection.query("UPDATE hr_role_documents SET title=?,fileName=?,responsibilities=?,goalsAndMetrics=?,risks=?,supportNeeded=?,departmentSopContent=? WHERE id=?", [title, fileName, input.responsibilities === undefined ? document.responsibilities : cleanText(input.responsibilities) || null, input.goalsAndMetrics === undefined ? document.goalsAndMetrics : cleanText(input.goalsAndMetrics) || null, input.risks === undefined ? document.risks : cleanText(input.risks) || null, input.supportNeeded === undefined ? document.supportNeeded : cleanText(input.supportNeeded) || null, input.departmentSopContent === undefined ? document.departmentSopContent : cleanText(input.departmentSopContent) || null, document.id]);
    await writeAudit(connection, { entityType: "role_document", entityId: Number(document.id), staffId: document.staffId ? Number(document.staffId) : null, action: "document.structured_fields_updated", beforeStatus: document.status, afterStatus: document.status, actor });
    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function activateRoleDocument(actor: HrRoleActor, id: number) {
  await requireHrRoleManagement(actor);
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query("SELECT * FROM hr_role_documents WHERE id=? LIMIT 1 FOR UPDATE", [id]);
    const document = (rows as any[])[0];
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "[HR-ROLE-NOT-FOUND] 岗位资料不存在" });
    await requireDocumentManagement(actor, document, connection);
    if (document.scope === "employee") await connection.query("UPDATE hr_role_documents SET status='archived',archivedAt=COALESCE(archivedAt,CURRENT_TIMESTAMP) WHERE scope='employee' AND staffId=? AND status='active' AND id<>?", [document.staffId, document.id]);
    else await connection.query("UPDATE hr_role_documents SET status='archived',archivedAt=COALESCE(archivedAt,CURRENT_TIMESTAMP) WHERE scope='department' AND department=? AND status='active' AND id<>?", [document.department, document.id]);
    await connection.query("UPDATE hr_role_documents SET status='active',approvedBy=?,approvedAt=CURRENT_TIMESTAMP,archivedAt=NULL WHERE id=?", [actor.id, document.id]);
    await writeAudit(connection, { entityType: "role_document", entityId: Number(document.id), staffId: document.staffId ? Number(document.staffId) : null, action: "document.activated", beforeStatus: document.status, afterStatus: "active", actor });
    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function getDocumentPreview(actor: HrRoleActor, id: number) {
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const [rows] = await pool.query("SELECT * FROM hr_role_documents WHERE id=? LIMIT 1", [id]);
  const document = (rows as any[])[0];
  if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "[HR-ROLE-NOT-FOUND] 岗位资料不存在" });
  if (!(await isOwnActiveRoleDocument(actor, document, pool))) {
    await requireDocumentManagement(actor, document, pool);
  }
  const { storageKey: _storageKey, sha256: _sha256, ...visible } = document;
  return visible;
}

export async function getDocumentDownload(actor: HrRoleActor, id: number) {
  await ensureHrRoleReviewSchema();
  const pool = getHrRoleReviewPool();
  const [rows] = await pool.query("SELECT id,scope,staffId,department,status,fileName,storageKey FROM hr_role_documents WHERE id=? LIMIT 1", [id]);
  const document = (rows as any[])[0];
  if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "[HR-ROLE-NOT-FOUND] 岗位资料不存在" });
  if (!(await isOwnActiveRoleDocument(actor, document, pool))) {
    await requireDocumentManagement(actor, document, pool);
  }
  const stored = await storageGet(String(document.storageKey));
  return { url: stored.url, fileName: String(document.fileName) };
}
