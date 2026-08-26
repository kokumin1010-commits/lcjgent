import { TRPCError } from '@trpc/server';

export type MemberRestrictionScope = 'order' | 'receipt' | 'points';
export type RestrictionActor = { id: number; name?: string | null; email?: string | null };

let poolInstance: any = null;
async function getPool() {
  if (poolInstance) return poolInstance;
  const mysql = await import('mysql2/promise');
  poolInstance = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
  });
  return poolInstance;
}

function actorName(actor: RestrictionActor): string | null {
  return actor.name || actor.email || null;
}

async function expireElapsedRestrictions(connection: any, memberId?: number): Promise<void> {
  const params: unknown[] = [];
  let memberSql = '';
  if (memberId) {
    memberSql = ' AND memberId = ?';
    params.push(memberId);
  }
  await connection.query(
    `UPDATE member_risk_restrictions
        SET status='expired', updatedAt=CURRENT_TIMESTAMP
      WHERE status='active' AND expiresAt <= UTC_TIMESTAMP()${memberSql}`,
    params,
  );
}

export async function resolveMemberIdFromPointKey(lineUserId: string): Promise<number | null> {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT id FROM line_users
      WHERE lineUserId = ? OR CONCAT('email_', id) = ?
      LIMIT 1`,
    [lineUserId, lineUserId],
  );
  return (rows as any[])[0] ? Number((rows as any[])[0].id) : null;
}

export async function getActiveMemberRestrictions(memberId: number, scopes?: MemberRestrictionScope[]) {
  const pool = await getPool();
  await expireElapsedRestrictions(pool, memberId);
  const params: unknown[] = [memberId];
  const scopeSql = scopes?.length ? ` AND scope IN (${scopes.map(() => '?').join(',')})` : '';
  if (scopes?.length) params.push(...scopes);
  const [rows] = await pool.query(
    `SELECT id, memberId, scope, status, reason, evidenceJson, startedAt, expiresAt,
            createdBy, createdByName, approvedBy, approvedByName, createdAt, updatedAt
       FROM member_risk_restrictions
      WHERE memberId = ? AND status='active' AND expiresAt > UTC_TIMESTAMP()${scopeSql}
      ORDER BY expiresAt DESC, id DESC`,
    params,
  );
  return rows as any[];
}

export async function listActiveMemberRestrictions() {
  const pool = await getPool();
  await expireElapsedRestrictions(pool);
  const [rows] = await pool.query(
    `SELECT id, memberId, scope, status, reason, evidenceJson, startedAt, expiresAt,
            createdBy, createdByName, approvedBy, approvedByName, createdAt, updatedAt
       FROM member_risk_restrictions
      WHERE status='active' AND expiresAt > UTC_TIMESTAMP()
      ORDER BY memberId, scope`,
  );
  return rows as any[];
}

export async function assertMemberActionAllowed(memberId: number, scopes: MemberRestrictionScope[]): Promise<void> {
  const restrictions = await getActiveMemberRestrictions(memberId, scopes);
  if (restrictions.length === 0) return;
  const labels: Record<MemberRestrictionScope, string> = { order: '注文', receipt: 'レシート申請', points: 'ポイント利用' };
  const until = new Date(restrictions[0].expiresAt).toLocaleDateString('ja-JP');
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `${restrictions.map(row => labels[row.scope as MemberRestrictionScope]).join('・')}は管理者により${until}まで制限されています。お問い合わせください。`,
  });
}

export async function createMemberRestrictions(input: {
  memberId: number;
  scopes: MemberRestrictionScope[];
  reason: string;
  evidence: { relatedOrderIds: number[]; note: string };
  expiresAt: Date;
  actor: RestrictionActor;
}) {
  if (input.expiresAt.getTime() <= Date.now()) throw new TRPCError({ code: 'BAD_REQUEST', message: '期限は現在より後にしてください' });
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [memberRows] = await connection.query('SELECT id FROM line_users WHERE id=? LIMIT 1 FOR UPDATE', [input.memberId]);
    if (!(memberRows as any[])[0]) throw new TRPCError({ code: 'NOT_FOUND', message: '会員が見つかりません' });
    await expireElapsedRestrictions(connection, input.memberId);
    const created: any[] = [];
    for (const scope of [...new Set(input.scopes)]) {
      const [activeRows] = await connection.query(
        `SELECT * FROM member_risk_restrictions
          WHERE memberId=? AND scope=? AND status='active' AND expiresAt>UTC_TIMESTAMP()
          LIMIT 1 FOR UPDATE`,
        [input.memberId, scope],
      );
      if ((activeRows as any[])[0]) throw new TRPCError({ code: 'CONFLICT', message: `${scope}は既に制限中です` });
      const evidenceJson = JSON.stringify(input.evidence);
      const name = actorName(input.actor);
      const [result] = await connection.query(
        `INSERT INTO member_risk_restrictions
          (memberId,scope,status,reason,evidenceJson,startedAt,expiresAt,createdBy,createdByName,approvedBy,approvedByName)
         VALUES (?,?,'active',?,?,CURRENT_TIMESTAMP,?,?,?,?,?)`,
        [input.memberId, scope, input.reason, evidenceJson, input.expiresAt, input.actor.id, name, input.actor.id, name],
      );
      const restrictionId = Number((result as any).insertId);
      const after = { id: restrictionId, memberId: input.memberId, scope, status: 'active', reason: input.reason, evidence: input.evidence, expiresAt: input.expiresAt.toISOString(), approvedBy: input.actor.id };
      await connection.query(
        `INSERT INTO member_risk_action_logs
          (restrictionId,memberId,scope,action,beforeJson,afterJson,reason,evidenceJson,actorId,actorName)
         VALUES (?,?,?,'restriction_created',NULL,?,?,?,?,?)`,
        [restrictionId, input.memberId, scope, JSON.stringify(after), input.reason, evidenceJson, input.actor.id, name],
      );
      created.push(after);
    }
    await connection.commit();
    return created;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function releaseMemberRestriction(input: { restrictionId: number; reason: string; actor: RestrictionActor }) {
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM member_risk_restrictions WHERE id=? LIMIT 1 FOR UPDATE', [input.restrictionId]);
    const before = (rows as any[])[0];
    if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: '制限が見つかりません' });
    if (before.status !== 'active') throw new TRPCError({ code: 'CONFLICT', message: 'この制限は既に終了しています' });
    const name = actorName(input.actor);
    await connection.query(
      `UPDATE member_risk_restrictions
          SET status='released',releasedAt=CURRENT_TIMESTAMP,releasedBy=?,releasedByName=?,releaseReason=?,updatedAt=CURRENT_TIMESTAMP
        WHERE id=?`,
      [input.actor.id, name, input.reason, input.restrictionId],
    );
    const after = { ...before, status: 'released', releasedBy: input.actor.id, releaseReason: input.reason };
    await connection.query(
      `INSERT INTO member_risk_action_logs
        (restrictionId,memberId,scope,action,beforeJson,afterJson,reason,evidenceJson,actorId,actorName)
       VALUES (?,?,?,'restriction_released',?,?,?,?,?,?)`,
      [input.restrictionId, before.memberId, before.scope, JSON.stringify(before), JSON.stringify(after), input.reason, before.evidenceJson, input.actor.id, name],
    );
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function extendMemberRestriction(input: { restrictionId: number; expiresAt: Date; reason: string; actor: RestrictionActor }) {
  if (input.expiresAt.getTime() <= Date.now()) throw new TRPCError({ code: 'BAD_REQUEST', message: '延長期限は現在より後にしてください' });
  const pool = await getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM member_risk_restrictions WHERE id=? LIMIT 1 FOR UPDATE', [input.restrictionId]);
    const before = (rows as any[])[0];
    if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: '制限が見つかりません' });
    if (before.status !== 'active' || new Date(before.expiresAt).getTime() <= Date.now()) throw new TRPCError({ code: 'CONFLICT', message: '終了済み制限は延長できません' });
    if (input.expiresAt.getTime() <= new Date(before.expiresAt).getTime()) throw new TRPCError({ code: 'BAD_REQUEST', message: '現在の期限より後を指定してください' });
    await connection.query('UPDATE member_risk_restrictions SET expiresAt=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?', [input.expiresAt, input.restrictionId]);
    const after = { ...before, expiresAt: input.expiresAt.toISOString() };
    const name = actorName(input.actor);
    await connection.query(
      `INSERT INTO member_risk_action_logs
        (restrictionId,memberId,scope,action,beforeJson,afterJson,reason,evidenceJson,actorId,actorName)
       VALUES (?,?,?,'restriction_extended',?,?,?,?,?,?)`,
      [input.restrictionId, before.memberId, before.scope, JSON.stringify(before), JSON.stringify(after), input.reason, before.evidenceJson, input.actor.id, name],
    );
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getMemberRestrictionHistory(memberId: number) {
  const pool = await getPool();
  await expireElapsedRestrictions(pool, memberId);
  const [restrictions] = await pool.query(
    `SELECT * FROM member_risk_restrictions WHERE memberId=? ORDER BY createdAt DESC,id DESC`,
    [memberId],
  );
  const [logs] = await pool.query(
    `SELECT * FROM member_risk_action_logs WHERE memberId=? ORDER BY createdAt DESC,id DESC LIMIT 200`,
    [memberId],
  );
  return { restrictions: restrictions as any[], logs: logs as any[] };
}
