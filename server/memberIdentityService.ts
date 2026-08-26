export type MemberIdentityClass =
  | 'line_profiled'
  | 'line_claimable_recovery'
  | 'email_loginable'
  | 'email_claimable_reset'
  | 'pseudo_email_reference'
  | 'numeric_reference_only'
  | 'legacy_key_recovery'
  | 'legacy_key_review';

export type ReceiptIdentityClass =
  | 'verified_member'
  | 'line_claimable_recovery'
  | 'email_claimable_reset'
  | 'reference_only'
  | 'unmatched';

export type IdentityMemberLike = {
  id: number;
  lineUserId?: string | null;
  displayName?: string | null;
  email?: string | null;
  password?: string | null;
  hasPassword?: boolean | number | null;
};

export const isRealLineUserId = (value?: string | null): boolean => /^U[0-9A-Fa-f]{32}$/.test(value || '');

export function classifyMemberIdentity(member: IdentityMemberLike): MemberIdentityClass {
  const hasEmail = Boolean(member.email?.trim());
  const hasPassword = Boolean(member.hasPassword ?? member.password);
  if (isRealLineUserId(member.lineUserId) && member.displayName === 'LINE復旧会員') return 'line_claimable_recovery';
  if (isRealLineUserId(member.lineUserId)) return 'line_profiled';
  if (hasEmail && hasPassword) return 'email_loginable';
  if (hasEmail) return 'email_claimable_reset';
  if (member.lineUserId?.startsWith('email_')) return 'pseudo_email_reference';
  if (!member.lineUserId) return 'numeric_reference_only';
  if (member.displayName === 'LINE復旧会員' || member.displayName?.startsWith('復旧会員 #')) return 'legacy_key_recovery';
  return 'legacy_key_review';
}

export function identityPresentation(identityClass: MemberIdentityClass) {
  const map: Record<MemberIdentityClass, { group: 'verified' | 'claimable' | 'reference'; label: string; description: string; loginMethod: 'line' | 'email' | 'none' }> = {
    line_profiled: { group: 'verified', label: 'LINE確認済み', description: 'LINEプロフィール確認済み。LINEログインを利用できます。', loginMethod: 'line' },
    line_claimable_recovery: { group: 'claimable', label: 'LINE認領待ち', description: '実LINE IDを保存済み。本人がLINEログインすると過去データを同じIDのまま認領できます。', loginMethod: 'line' },
    email_loginable: { group: 'verified', label: 'メール確認済み', description: 'メールとパスワード設定済み。メールログインを利用できます。', loginMethod: 'email' },
    email_claimable_reset: { group: 'claimable', label: 'メール再設定待ち', description: '登録メールへのパスワード再設定で本人認領できます。', loginMethod: 'email' },
    pseudo_email_reference: { group: 'reference', label: '復旧参照専用', description: '復旧用email_キーだけを保持する参照行です。通常ログインには使えません。', loginMethod: 'none' },
    numeric_reference_only: { group: 'reference', label: '履歴参照専用', description: '注文・レシート・ポイントの参照整合性を保つ最小行です。本人情報は推定していません。', loginMethod: 'none' },
    legacy_key_recovery: { group: 'reference', label: '旧キー要確認', description: '旧形式キーを保持する復旧行です。自動統合せずスタッフ確認が必要です。', loginMethod: 'none' },
    legacy_key_review: { group: 'reference', label: '旧会員要確認', description: '標準LINE／メール認証へ未分類の旧会員です。スタッフ確認が必要です。', loginMethod: 'none' },
  };
  return map[identityClass];
}

export function classifyReceiptIdentity(receiptLineUserId: string, member?: IdentityMemberLike | null): { identityClass: ReceiptIdentityClass; label: string; description: string; linkageBasis: string } {
  if (!member) return { identityClass: 'unmatched', label: '会員未一致', description: '保存キーに対応する会員行が見つかりません。自動承認せず確認してください。', linkageBasis: 'unmatched_key' };
  const memberClass = classifyMemberIdentity(member);
  if (memberClass === 'line_profiled' || memberClass === 'email_loginable') {
    return { identityClass: 'verified_member', label: '本人確認済み', description: 'ログイン可能な会員へ関連付いています。', linkageBasis: receiptLineUserId.startsWith('email_') ? 'email_member_id' : 'same_line_user_id' };
  }
  if (memberClass === 'line_claimable_recovery') {
    return { identityClass: 'line_claimable_recovery', label: 'LINE認領可能', description: '同じ実LINE IDで本人がログインすると、過去レシートとポイントをそのまま認領できます。', linkageBasis: 'same_line_user_id' };
  }
  if (memberClass === 'email_claimable_reset') {
    return { identityClass: 'email_claimable_reset', label: 'メール認領可能', description: '登録メールへのパスワード再設定で本人認領できます。', linkageBasis: 'email_member_id' };
  }
  return { identityClass: 'reference_only', label: '履歴参照専用', description: '復旧時に作成した参照行です。ログイン会員として扱わず、自動統合しません。', linkageBasis: receiptLineUserId.startsWith('email_') ? 'recovery_email_key' : 'legacy_reference_key' };
}

let poolInstance: any = null;
async function getPool() {
  if (poolInstance) return poolInstance;
  const mysql = await import('mysql2/promise');
  poolInstance = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 5 });
  return poolInstance;
}

export async function getMemberIdentityDirectory() {
  const pool = await getPool();
  const [rows] = await pool.query(`
    SELECT id,lineUserId,displayName,pictureUrl,email,phone,userType,isBlocked,lastMessageAt,createdAt,updatedAt,
           CASE WHEN password IS NOT NULL AND password<>'' THEN 1 ELSE 0 END AS hasPassword
      FROM line_users ORDER BY createdAt DESC,id DESC`);
  const members = (rows as any[]).map(member => {
    const identityClass = classifyMemberIdentity(member);
    return { ...member, identityClass, identity: identityPresentation(identityClass) };
  });
  const counts = {
    databaseRows: members.length,
    verified: members.filter(member => member.identity.group === 'verified').length,
    claimable: members.filter(member => member.identity.group === 'claimable').length,
    usableOrClaimable: members.filter(member => member.identity.group !== 'reference').length,
    reference: members.filter(member => member.identity.group === 'reference').length,
    lineProfiled: members.filter(member => member.identityClass === 'line_profiled').length,
    lineClaimable: members.filter(member => member.identityClass === 'line_claimable_recovery').length,
    emailLoginable: members.filter(member => member.identityClass === 'email_loginable').length,
    emailClaimable: members.filter(member => member.identityClass === 'email_claimable_reset').length,
  };
  return { counts, members };
}

export async function getMemberIdentityStatistics() {
  const directory = await getMemberIdentityDirectory();
  return directory.counts;
}

export async function getMemberIdentityById(memberId: number) {
  const pool = await getPool();
  const [rows] = await pool.query(`
    SELECT id,lineUserId,displayName,pictureUrl,email,phone,userType,isBlocked,lastMessageAt,createdAt,updatedAt,
           CASE WHEN password IS NOT NULL AND password<>'' THEN 1 ELSE 0 END AS hasPassword
      FROM line_users WHERE id=? LIMIT 1`, [memberId]);
  const member = (rows as any[])[0];
  if (!member) return null;
  const identityClass = classifyMemberIdentity(member);
  return { ...member, identityClass, identity: identityPresentation(identityClass) };
}

export async function recordMemberIdentityAction(input: {
  memberId: number;
  action: 'line_profile_claimed' | 'email_password_claimed' | 'admin_linked';
  beforeClass: MemberIdentityClass;
  afterClass: MemberIdentityClass;
  verificationMethod: 'line_oauth' | 'line_profile_api' | 'email_reset_token' | 'admin_evidence';
  evidence?: Record<string, unknown>;
  actorType: 'member' | 'admin' | 'system';
  actorId?: number | null;
}) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO member_identity_action_logs
      (memberId,action,beforeClass,afterClass,verificationMethod,evidenceJson,actorType,actorId,createdAt)
     VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
    [input.memberId,input.action,input.beforeClass,input.afterClass,input.verificationMethod,JSON.stringify(input.evidence || {}),input.actorType,input.actorId || null],
  );
}

export async function getMemberIdentityActionLogs(memberId: number) {
  const pool = await getPool();
  const [rows] = await pool.query(
    `SELECT id,memberId,action,beforeClass,afterClass,verificationMethod,evidenceJson,actorType,actorId,createdAt
       FROM member_identity_action_logs WHERE memberId=? ORDER BY createdAt DESC,id DESC LIMIT 100`,
    [memberId],
  );
  return rows as any[];
}
