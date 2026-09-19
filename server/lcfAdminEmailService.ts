import nodemailer from "nodemailer";
import { simpleParser } from "mailparser";
import { and, desc, eq, inArray } from "drizzle-orm";
import { salesEmailLogs, salesEmailReplies } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

export const LCF_FROM_ADDRESS = "LCF@livecommercejapan.jp";
const HISTORY_CACHE_TTL_MS = 5 * 60_000;
const MAX_HISTORY_PER_FOLDER = 20;
const MAX_SOURCE_BYTES = 96 * 1024;
const MAX_BODY_CHARS = 20_000;

export type LcfEmailSyncMode = "initial" | "auto" | "manual";

export type LcfEmailHistoryItem = {
  id: string;
  source: "database" | "imap";
  direction: "sent" | "received";
  folder: string | null;
  uid: number | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  subject: string;
  body: string;
  fromName: string;
  fromAddress: string;
  to: Array<{ name: string; address: string }>;
  date: string | null;
  status: string;
  hasAttachments: boolean;
};

export type LcfEmailOverviewLog = {
  id: string;
  direction: "sent" | "received";
  toEmail: string;
  toName: string | null;
  toCompany: string | null;
  subject: string;
  preview: string;
  status: string;
  sentAt: string;
};

type CachedHistory = {
  expiresAt: number;
  syncedAt: string;
  items: LcfEmailHistoryItem[];
};

export type LcfEmailSyncResult = {
  items: LcfEmailHistoryItem[];
  syncedAt: string;
  cached: boolean;
  warning: string | null;
};

const historyCache = new Map<string, CachedHistory>();
const historySyncJobs = new Map<string, Promise<LcfEmailSyncResult>>();

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBody(value: string): string {
  return stripHtml(value).replace(/\r\n/g, "\n").trim().slice(0, MAX_BODY_CHARS);
}

export function validateLcfEmailContent(subjectValue: string, bodyValue: string): {
  subject: string;
  body: string;
  errors: string[];
} {
  const subject = subjectValue.replace(/\s+/g, " ").trim().slice(0, 500);
  const body = normalizeBody(bodyValue);
  const errors: string[] = [];
  const subjectLetters = subject.match(/[\p{L}]/gu)?.length || 0;
  const bodyLetters = body.match(/[\p{L}]/gu)?.length || 0;
  const repeatedSubject = /^(.)\1{3,}$/u.test(subject.replace(/\s/g, ""));
  const placeholderBody = /ご用件をご入力|本文を入力|ここに入力|test|テストメールのみ/iu.test(body);

  if (subject.length < 6 || subjectLetters < 2 || repeatedSubject) {
    errors.push("件名は6文字以上で、イベント名や用件が分かる内容にしてください（数字だけ・同じ文字だけは不可）");
  }
  if (body.length < 40 || bodyLetters < 15 || placeholderBody) {
    errors.push("本文は宛名・用件・連絡内容が分かる40文字以上の正式な文章にしてください");
  }
  return { subject, body, errors };
}

function ensureLcfSignature(body: string): string {
  if (/LCF@livecommercejapan\.jp/i.test(body) && /LIVE COMMERCE FESTIVAL/i.test(body)) return body;
  return `${body}\n\n────────────────────\nLIVE COMMERCE FESTIVAL 運営事務局\nE-mail: ${LCF_FROM_ADDRESS}\nhttps://www.livecommercefestival.com/\n────────────────────`;
}

function buildLcfHtml(body: string): string {
  const paragraphs = escapeHtml(body)
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.8;white-space:pre-wrap">${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"></head><body style="margin:0;background:#f6f7f9;color:#171717;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif"><div style="max-width:680px;margin:0 auto;padding:32px 20px"><div style="border-top:6px solid #facc15;background:#ffffff;padding:28px 28px 20px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.06)">${paragraphs}</div></div></body></html>`;
}

function createImapClient() {
  return import("imapflow").then(({ ImapFlow }) => new ImapFlow({
    host: ENV.emailPopHost.replace("pop.", "imap."),
    port: 993,
    secure: true,
    auth: { user: ENV.emailUser, pass: ENV.emailPassword },
    logger: false,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 8_000,
  }));
}

async function withImapClient<T>(
  task: (client: Awaited<ReturnType<typeof createImapClient>>) => Promise<T>,
): Promise<T> {
  const client = await createImapClient();
  try {
    await client.connect();
    return await task(client);
  } finally {
    try { await client.logout(); } catch {}
  }
}

function createSmtpTransporter() {
  return nodemailer.createTransport({
    host: ENV.emailSmtpHost,
    port: 465,
    secure: true,
    auth: { user: ENV.emailUser, pass: ENV.emailPassword },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

async function findSentFolder(client: any): Promise<string | null> {
  const folders = await client.list();
  const candidates = ["Sent Messages", "Sent", "已发送", "INBOX.Sent"];
  const specialUse = folders.find((folder: any) => folder.specialUse === "\\Sent");
  if (specialUse?.path) return specialUse.path;
  const matched = folders.find((folder: any) => candidates.some((candidate) => String(folder.path || "").toLowerCase() === candidate.toLowerCase()));
  return matched?.path || null;
}

function safeAddress(address: any): { name: string; address: string } {
  return {
    name: String(address?.name || ""),
    address: String(address?.address || ""),
  };
}

async function fetchAddressMessages(
  client: any,
  folder: string,
  emailAddress: string,
  direction: "sent" | "received",
  scanOnEmpty = false,
): Promise<LcfEmailHistoryItem[]> {
  const lock = await client.getMailboxLock(folder, { readOnly: true });
  try {
    let matchingUids: number[] = [];
    let usedFallback = false;
    const scanRecentEnvelopes = async () => {
      const scannedUids: number[] = [];
      const total = Number((client.mailbox as any)?.exists || 0);
      const start = Math.max(1, total - 299);
      if (total > 0) {
        for await (const candidate of client.fetch(`${start}:${total}`, { envelope: true, uid: true })) {
          const addresses = direction === "received"
            ? (candidate.envelope?.from || [])
            : (candidate.envelope?.to || []);
          if (addresses.some((address: any) => normalizeEmail(String(address.address || "")) === emailAddress)) {
            scannedUids.push(candidate.uid);
          }
        }
      }
      return scannedUids.slice(-MAX_HISTORY_PER_FOLDER);
    };
    try {
      const result = await client.search(direction === "received" ? { from: emailAddress } : { to: emailAddress }, { uid: true });
      if (!Array.isArray(result)) throw new Error("IMAP address search is unavailable");
      matchingUids = result.slice(-MAX_HISTORY_PER_FOLDER);
    } catch (searchError) {
      console.warn(`[LCF Email] Address search fallback for ${folder}:`, String((searchError as Error)?.message || searchError).slice(0, 160));
      usedFallback = true;
      matchingUids = await scanRecentEnvelopes();
    }
    if (matchingUids.length === 0 && scanOnEmpty && !usedFallback) matchingUids = await scanRecentEnvelopes();
    if (matchingUids.length === 0) return [];
    const items: LcfEmailHistoryItem[] = [];
    const range = matchingUids.join(",");
    for await (const message of client.fetch(range, {
      envelope: true,
      uid: true,
      flags: true,
      bodyStructure: true,
      source: { start: 0, maxLength: MAX_SOURCE_BYTES },
    }, { uid: true })) {
      const envelope = message.envelope;
      let body = "";
      let messageId = envelope?.messageId || null;
      let inReplyTo = envelope?.inReplyTo || null;
      let references: string | null = null;
      try {
        if (message.source) {
          const parsed = await simpleParser(message.source);
          body = normalizeBody(parsed.text || (typeof parsed.html === "string" ? parsed.html : ""));
          messageId = parsed.messageId || messageId;
          inReplyTo = parsed.inReplyTo || inReplyTo;
          references = parsed.references
            ? (Array.isArray(parsed.references) ? parsed.references.join(" ") : String(parsed.references))
            : null;
        }
      } catch (error) {
        console.warn(`[LCF Email] Unable to parse ${folder} uid=${message.uid}:`, String((error as Error)?.message || error).slice(0, 160));
      }
      const from = safeAddress(envelope?.from?.[0]);
      items.push({
        id: `imap:${folder}:${message.uid}`,
        source: "imap",
        direction,
        folder,
        uid: message.uid,
        messageId,
        inReplyTo,
        references,
        subject: String(envelope?.subject || "(件名なし)"),
        body,
        fromName: from.name,
        fromAddress: from.address,
        to: (envelope?.to || []).map(safeAddress),
        date: envelope?.date ? new Date(envelope.date).toISOString() : null,
        status: direction === "sent" ? "sent" : (message.flags?.has("\\Seen") ? "read" : "unread"),
        hasAttachments: Boolean(message.bodyStructure?.childNodes?.some((node: any) => node.disposition === "attachment")),
      });
    }
    return items;
  } finally {
    lock.release();
  }
}

function dedupeAndSort(items: LcfEmailHistoryItem[]): LcfEmailHistoryItem[] {
  const sorted = [...items].sort((left, right) => {
    const leftTime = left.date ? new Date(left.date).getTime() : 0;
    const rightTime = right.date ? new Date(right.date).getTime() : 0;
    return leftTime - rightTime;
  });
  const result: LcfEmailHistoryItem[] = [];
  for (const item of sorted) {
    const duplicateIndex = result.findIndex((candidate) => {
      if (candidate.messageId && item.messageId && candidate.messageId === item.messageId) return true;
      if (candidate.direction !== item.direction || candidate.subject !== item.subject) return false;
      const candidateTime = candidate.date ? new Date(candidate.date).getTime() : 0;
      const itemTime = item.date ? new Date(item.date).getTime() : 0;
      return Math.abs(candidateTime - itemTime) < 3 * 60_000;
    });
    if (duplicateIndex === -1) {
      result.push(item);
    } else if (item.source === "imap" && result[duplicateIndex].source === "database") {
      result[duplicateIndex] = item;
    }
  }
  return result.slice(-60);
}

async function getDatabaseHistory(emailAddress: string): Promise<LcfEmailHistoryItem[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(salesEmailLogs)
    .where(and(
      eq(salesEmailLogs.toEmail, normalizeEmail(emailAddress)),
      eq(salesEmailLogs.sendType, "lcf_application"),
    ))
    .orderBy(desc(salesEmailLogs.sentAt))
    .limit(60);
  const logIds = rows.map((row) => row.id);
  const replies = logIds.length > 0
    ? await db
        .select()
        .from(salesEmailReplies)
        .where(inArray(salesEmailReplies.logId, logIds))
        .orderBy(desc(salesEmailReplies.receivedAt))
        .limit(60)
    : [];
  const sentItems = rows.map((row) => ({
    id: `database:${row.id}`,
    source: "database" as const,
    direction: "sent" as const,
    folder: null,
    uid: null,
    messageId: null,
    inReplyTo: null,
    references: null,
    subject: row.subject,
    body: row.contentPreview || "",
    fromName: "LIVE COMMERCE FESTIVAL",
    fromAddress: LCF_FROM_ADDRESS,
    to: [{ name: row.toName || "", address: row.toEmail }],
    date: row.sentAt ? new Date(row.sentAt).toISOString() : null,
    status: row.status,
    hasAttachments: Boolean(row.attachPdf),
  }));
  const receivedItems = replies.map((row) => ({
    id: `database-reply:${row.id}`,
    source: "database" as const,
    direction: "received" as const,
    folder: row.imapFolder || "INBOX",
    uid: row.imapUid,
    messageId: null,
    inReplyTo: null,
    references: null,
    subject: row.subject || "(件名なし)",
    body: row.body || "",
    fromName: row.fromName || "",
    fromAddress: row.fromAddress,
    to: [{ name: "LIVE COMMERCE FESTIVAL", address: LCF_FROM_ADDRESS }],
    date: row.receivedAt ? new Date(row.receivedAt).toISOString() : new Date(row.createdAt).toISOString(),
    status: "read",
    hasAttachments: false,
  }));
  return dedupeAndSort([...sentItems, ...receivedItems]);
}

async function persistReceivedHistory(emailAddress: string, items: LcfEmailHistoryItem[]): Promise<void> {
  const receivedItems = items.filter((item) => item.direction === "received" && item.uid && item.folder);
  if (receivedItems.length === 0) return;
  const db = await getDb();
  if (!db) return;
  const logs = await db
    .select({ id: salesEmailLogs.id })
    .from(salesEmailLogs)
    .where(and(
      eq(salesEmailLogs.toEmail, normalizeEmail(emailAddress)),
      eq(salesEmailLogs.sendType, "lcf_application"),
    ))
    .orderBy(desc(salesEmailLogs.sentAt))
    .limit(60);
  if (logs.length === 0) return;
  const logIds = logs.map((row) => row.id);
  const existingReplies = await db
    .select({ imapUid: salesEmailReplies.imapUid, imapFolder: salesEmailReplies.imapFolder })
    .from(salesEmailReplies)
    .where(inArray(salesEmailReplies.logId, logIds));
  const existingKeys = new Set(existingReplies.map((row) => `${row.imapFolder || "INBOX"}:${row.imapUid || 0}`));
  let newestReceivedAt: Date | null = null;
  for (const item of receivedItems) {
    const key = `${item.folder}:${item.uid}`;
    if (existingKeys.has(key)) continue;
    const receivedAt = item.date ? new Date(item.date) : new Date();
    await db.insert(salesEmailReplies).values({
      logId: logs[0].id,
      fromAddress: item.fromAddress || normalizeEmail(emailAddress),
      fromName: item.fromName || null,
      subject: item.subject || null,
      body: item.body || null,
      receivedAt,
      imapUid: item.uid,
      imapFolder: item.folder,
    });
    existingKeys.add(key);
    if (!newestReceivedAt || receivedAt > newestReceivedAt) newestReceivedAt = receivedAt;
  }
  if (newestReceivedAt) {
    await db.update(salesEmailLogs)
      .set({ replyReceived: true, replyReceivedAt: newestReceivedAt })
      .where(eq(salesEmailLogs.id, logs[0].id));
  }
}

export async function listRecentLcfEmailLogs(limit = 100): Promise<LcfEmailOverviewLog[]> {
  const db = await getDb();
  if (!db) return [];
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const sentRows = await db
    .select({
      id: salesEmailLogs.id,
      toEmail: salesEmailLogs.toEmail,
      toName: salesEmailLogs.toName,
      toCompany: salesEmailLogs.toCompany,
      subject: salesEmailLogs.subject,
      contentPreview: salesEmailLogs.contentPreview,
      status: salesEmailLogs.status,
      sentAt: salesEmailLogs.sentAt,
    })
    .from(salesEmailLogs)
    .where(eq(salesEmailLogs.sendType, "lcf_application"))
    .orderBy(desc(salesEmailLogs.sentAt))
    .limit(safeLimit);
  const receivedRows = await db
    .select({
      id: salesEmailReplies.id,
      toEmail: salesEmailLogs.toEmail,
      toName: salesEmailLogs.toName,
      toCompany: salesEmailLogs.toCompany,
      subject: salesEmailReplies.subject,
      body: salesEmailReplies.body,
      receivedAt: salesEmailReplies.receivedAt,
      createdAt: salesEmailReplies.createdAt,
    })
    .from(salesEmailReplies)
    .innerJoin(salesEmailLogs, eq(salesEmailReplies.logId, salesEmailLogs.id))
    .where(eq(salesEmailLogs.sendType, "lcf_application"))
    .orderBy(desc(salesEmailReplies.receivedAt))
    .limit(safeLimit);

  const sentItems = sentRows.map((row) => ({
    id: `sent:${row.id}`,
    direction: "sent" as const,
    toEmail: normalizeEmail(row.toEmail),
    toName: row.toName,
    toCompany: row.toCompany,
    subject: row.subject,
    preview: String(row.contentPreview || "").slice(0, 240),
    status: row.status,
    sentAt: new Date(row.sentAt).toISOString(),
  }));
  const receivedItems = receivedRows.map((row) => ({
    id: `received:${row.id}`,
    direction: "received" as const,
    toEmail: normalizeEmail(row.toEmail),
    toName: row.toName,
    toCompany: row.toCompany,
    subject: row.subject || "(件名なし)",
    preview: String(row.body || "").slice(0, 240),
    status: "received",
    sentAt: new Date(row.receivedAt || row.createdAt).toISOString(),
  }));
  return [...sentItems, ...receivedItems]
    .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime())
    .slice(0, safeLimit);
}

export async function getLcfEmailThreadSnapshot(emailAddress: string): Promise<{
  items: LcfEmailHistoryItem[];
  syncedAt: string | null;
  cacheFresh: boolean;
}> {
  const normalized = normalizeEmail(emailAddress);
  const cached = historyCache.get(normalized);
  const databaseItems = await getDatabaseHistory(normalized);
  return {
    items: dedupeAndSort([...(cached?.items || []), ...databaseItems]),
    syncedAt: cached?.syncedAt || null,
    cacheFresh: Boolean(cached && cached.expiresAt > Date.now()),
  };
}

async function runLcfEmailThreadSync(normalized: string, mode: LcfEmailSyncMode): Promise<LcfEmailSyncResult> {
  const scanOnEmpty = mode === "manual";
  let warning: string | null = null;
  let imapItems: LcfEmailHistoryItem[] = [];
  if (mode === "manual") {
    try {
      imapItems = await withImapClient(async (client) => {
        const received = await fetchAddressMessages(client, "INBOX", normalized, "received", scanOnEmpty);
        const sentFolder = await findSentFolder(client);
        const sent = sentFolder ? await fetchAddressMessages(client, sentFolder, normalized, "sent", scanOnEmpty) : [];
        return dedupeAndSort([...received, ...sent]);
      });
    } catch (error) {
      const reason = String((error as Error)?.message || "同期失敗").slice(0, 120);
      warning = `メールボックスへ接続できませんでした。保存済み履歴は表示中です。再度お試しください（LCF_IMAP_MANUAL_SYNC_FAILED: ${reason}）`;
      console.error("[LCF Email] Manual address sync failed:", error);
    }
  } else {
    const loadInbox = () => withImapClient((client) =>
      fetchAddressMessages(client, "INBOX", normalized, "received", false));
    const loadSent = () => withImapClient(async (client) => {
      const sentFolder = await findSentFolder(client);
      return sentFolder ? await fetchAddressMessages(client, sentFolder, normalized, "sent", false) : [];
    });
    const results = await Promise.allSettled([loadInbox(), loadSent()]);
    const fulfilledItems = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    imapItems = dedupeAndSort(fulfilledItems);
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failures.length > 0) {
      const reason = String((failures[0].reason as Error)?.message || "同期失敗").slice(0, 120);
      warning = `最新メールを一部確認できませんでした。保存済み履歴は表示中で、自動的に再試行します（LCF_IMAP_AUTO_SYNC_RETRY: ${reason}）`;
      console.error("[LCF Email] Parallel address sync failed:", failures.map((failure) => failure.reason));
    }
  }

  if (imapItems.length > 0) {
    try {
      await persistReceivedHistory(normalized, imapItems);
    } catch (error) {
      warning = "受信メールを表示しましたが、履歴への保存に失敗しました。自動的に再試行します（LCF_REPLY_HISTORY_SAVE_FAILED）";
      console.error("[LCF Email] Unable to persist received history:", error);
    }
  }
  const syncedAt = new Date().toISOString();
  if (imapItems.length > 0 || !warning) {
    historyCache.set(normalized, {
      expiresAt: Date.now() + HISTORY_CACHE_TTL_MS,
      syncedAt,
      items: imapItems,
    });
  }
  const snapshot = await getLcfEmailThreadSnapshot(normalized);
  return { items: snapshot.items, syncedAt, cached: false, warning };
}

export async function syncLcfEmailThread(emailAddress: string, mode: LcfEmailSyncMode = "initial"): Promise<LcfEmailSyncResult> {
  const normalized = normalizeEmail(emailAddress);
  if (historyCache.size > 500) {
    const now = Date.now();
    for (const [key, entry] of historyCache) {
      if (entry.expiresAt <= now) historyCache.delete(key);
    }
  }
  const current = historyCache.get(normalized);
  if (mode === "initial" && current && current.expiresAt > Date.now()) {
    const snapshot = await getLcfEmailThreadSnapshot(normalized);
    return { items: snapshot.items, syncedAt: current.syncedAt, cached: true, warning: null };
  }
  if (!ENV.emailUser || !ENV.emailPassword) {
    const snapshot = await getLcfEmailThreadSnapshot(normalized);
    return { items: snapshot.items, syncedAt: new Date().toISOString(), cached: false, warning: "メールボックス設定が未構成のため、保存済み送信履歴だけを表示しています" };
  }
  const existingJob = historySyncJobs.get(normalized);
  if (existingJob) return existingJob;
  const job = runLcfEmailThreadSync(normalized, mode);
  historySyncJobs.set(normalized, job);
  try {
    return await job;
  } finally {
    if (historySyncJobs.get(normalized) === job) historySyncJobs.delete(normalized);
  }
}

export async function sendLcfEmail(input: {
  to: string[];
  toName?: string;
  toCompany?: string;
  subject: string;
  body: string;
  cc?: string[];
  inReplyTo?: string;
  references?: string;
  attachments?: Array<{ filename: string; contentType: string; content: string }>;
  sentBy?: number;
}): Promise<{ messageId: string | null; accepted: string[]; subject: string; body: string; historySaved: boolean }> {
  if (!ENV.emailUser || !ENV.emailPassword) throw new Error("メール設定が未構成です");
  const validation = validateLcfEmailContent(input.subject, input.body);
  if (validation.errors.length > 0) {
    const error = new Error(validation.errors.join("\n"));
    (error as any).code = "LCF_EMAIL_CONTENT_REQUIRED";
    throw error;
  }
  const recipients = Array.from(new Set(input.to.map(normalizeEmail).filter(Boolean)));
  const cc = Array.from(new Set((input.cc || []).map(normalizeEmail).filter(Boolean)));
  if (recipients.length === 0) throw new Error("宛先がありません");
  const completeBody = ensureLcfSignature(validation.body);
  const transporter = createSmtpTransporter();
  let info: any;
  try {
    info = await transporter.sendMail({
      from: `"LIVE COMMERCE FESTIVAL" <${LCF_FROM_ADDRESS}>`,
      sender: ENV.emailUser,
      envelope: { from: ENV.emailUser, to: [...recipients, ...cc] },
      replyTo: LCF_FROM_ADDRESS,
      to: recipients.join(", "),
      cc: cc.length ? cc.join(", ") : undefined,
      subject: validation.subject,
      text: completeBody,
      html: buildLcfHtml(completeBody),
      inReplyTo: input.inReplyTo,
      references: input.references,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: Buffer.from(attachment.content, "base64"),
      })),
      headers: {
        "X-Mailer": "LCF Admin Mail Center",
        "X-Auto-Response-Suppress": "All",
      },
    } as any);
    const accepted = (info.accepted || []).map(String);
    if (accepted.length === 0 || (info.rejected || []).length > 0) {
      throw Object.assign(new Error("メールサーバーが宛先を受け付けませんでした"), { code: "SMTP_RECIPIENT_REJECTED" });
    }
  } catch (error) {
    const db = await getDb();
    const safeCode = String((error as any)?.code || (error as any)?.responseCode || "SMTP_ERROR").slice(0, 100);
    if (db) {
      for (const recipient of recipients) {
        await db.insert(salesEmailLogs).values({
          toEmail: recipient,
          toName: input.toName || null,
          toCompany: input.toCompany || null,
          subject: validation.subject || "(件名なし)",
          contentPreview: completeBody,
          sendType: "lcf_application",
          attachPdf: Boolean(input.attachments?.length),
          status: "failed",
          errorMessage: safeCode,
          sentBy: input.sentBy || null,
          sentAt: new Date(),
        }).catch(() => undefined);
      }
    }
    throw error;
  }

  let historySaved = true;
  try {
    const db = await getDb();
    if (!db) {
      historySaved = false;
    } else {
      for (const recipient of recipients) {
        await db.insert(salesEmailLogs).values({
          toEmail: recipient,
          toName: input.toName || null,
          toCompany: input.toCompany || null,
          subject: validation.subject,
          contentPreview: completeBody,
          sendType: "lcf_application",
          attachPdf: Boolean(input.attachments?.length),
          status: "sent",
          sentBy: input.sentBy || null,
          sentAt: new Date(),
        });
      }
    }
  } catch (historyError) {
    historySaved = false;
    console.error("[LCF Email] SMTP accepted but history save failed:", historyError);
  }
  for (const recipient of recipients) historyCache.delete(recipient);
  return {
    messageId: info.messageId ? String(info.messageId) : null,
    accepted: (info.accepted || []).map(String),
    subject: validation.subject,
    body: completeBody,
    historySaved,
  };
}
