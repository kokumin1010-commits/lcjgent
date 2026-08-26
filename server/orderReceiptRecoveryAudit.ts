import crypto from "node:crypto";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { ImapFlow } from "imapflow";
import mysql, { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";

const AUDIT_KEY_SHA256 =
  "aac7ce83708b4804be3bc018fd0e162cadef9f13967dd233bc8f697377e343ff";

const TABLES = [
  "line_users",
  "mall_orders",
  "mall_order_items",
  "user_addresses",
  "receipts",
  "line_receipts",
  "point_transactions",
  "line_point_transactions",
  "receipt_review_logs",
  "ai_review_feedback",
  "ai_auto_review_logs",
  "fraud_detection_logs",
  "line_fraud_detection_logs",
  "receipt_products",
  "receipt_kakuhen_results",
  "receipt_reviews",
  "email_tracking",
  "step_email_logs",
  "sales_email_logs",
] as const;

function verifyAuditKey(key: string): void {
  const actual = crypto.createHash("sha256").update(key).digest("hex");
  const expectedBuffer = Buffer.from(AUDIT_KEY_SHA256, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error("Unauthorized");
  }
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function getDatabaseAudit() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    return {
      configured: false,
      connected: false,
      error: "DATABASE_URL not configured",
    };

  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 });
  try {
    const tableCounts: Record<string, number | null> = {};
    for (const table of TABLES) {
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS rowCount FROM \`${table}\``
        );
        tableCounts[table] = asNumber(rows[0]?.rowCount);
      } catch {
        tableCounts[table] = null;
      }
    }

    const [orderStatusRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, COUNT(*) AS rowCount FROM mall_orders GROUP BY status ORDER BY status"
    );
    const [lineReceiptStatusRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, COUNT(*) AS rowCount FROM line_receipts GROUP BY status ORDER BY status"
    );
    const [webReceiptStatusRows] = await pool.query<RowDataPacket[]>(
      "SELECT status, COUNT(*) AS rowCount FROM receipts GROUP BY status ORDER BY status"
    );
    const [integrityRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM mall_orders mo LEFT JOIN line_users lu ON lu.id = mo.lineUserId WHERE lu.id IS NULL) AS orphanOrderMembers,
        (SELECT COUNT(*) FROM mall_order_items moi LEFT JOIN mall_orders mo ON mo.id = moi.orderId WHERE mo.id IS NULL) AS orphanOrderItems,
        (SELECT COUNT(*) FROM mall_orders mo LEFT JOIN mall_order_items moi ON moi.orderId = mo.id WHERE moi.id IS NULL) AS ordersWithoutItems,
        (SELECT COUNT(*) FROM receipt_review_logs rrl
          LEFT JOIN line_receipts lr ON rrl.receiptType = 'line_receipt' AND lr.id = rrl.receiptId
          LEFT JOIN receipts wr ON rrl.receiptType = 'web_receipt' AND wr.id = rrl.receiptId
          WHERE (rrl.receiptType = 'line_receipt' AND lr.id IS NULL)
             OR (rrl.receiptType = 'web_receipt' AND wr.id IS NULL)) AS orphanReviewLogs,
        (SELECT COUNT(*) FROM ai_review_feedback arf
          LEFT JOIN line_receipts lr ON arf.feedbackReceiptType = 'line_receipt' AND lr.id = arf.receiptId
          LEFT JOIN receipts wr ON arf.feedbackReceiptType = 'web_receipt' AND wr.id = arf.receiptId
          WHERE (arf.feedbackReceiptType = 'line_receipt' AND lr.id IS NULL)
             OR (arf.feedbackReceiptType = 'web_receipt' AND wr.id IS NULL)) AS orphanAiFeedback
    `);
    const integrity = integrityRows[0] || {};

    const referencedKeys = new Set<string>();
    try {
      const [receiptRows] = await pool.query<RowDataPacket[]>(
        "SELECT imageKey FROM receipts"
      );
      for (const row of receiptRows)
        if (row.imageKey) referencedKeys.add(String(row.imageKey));
    } catch {
      // Optional legacy table.
    }
    try {
      const [lineReceiptRows] = await pool.query<RowDataPacket[]>(
        "SELECT imageKey, imageKeys FROM line_receipts"
      );
      for (const row of lineReceiptRows) {
        if (row.imageKey) referencedKeys.add(String(row.imageKey));
        if (row.imageKeys) {
          try {
            const values =
              typeof row.imageKeys === "string"
                ? JSON.parse(row.imageKeys)
                : row.imageKeys;
            if (Array.isArray(values))
              for (const key of values)
                if (key) referencedKeys.add(String(key));
          } catch {
            // Malformed historical JSON is counted by DB rows but not emitted.
          }
        }
      }
    } catch {
      // Optional table.
    }

    return {
      configured: true,
      connected: true,
      tableCounts,
      orderStatuses: Object.fromEntries(
        orderStatusRows.map(row => [String(row.status), asNumber(row.rowCount)])
      ),
      lineReceiptStatuses: Object.fromEntries(
        lineReceiptStatusRows.map(row => [
          String(row.status),
          asNumber(row.rowCount),
        ])
      ),
      webReceiptStatuses: Object.fromEntries(
        webReceiptStatusRows.map(row => [
          String(row.status),
          asNumber(row.rowCount),
        ])
      ),
      integrity: {
        orphanOrderMembers: asNumber(integrity.orphanOrderMembers),
        orphanOrderItems: asNumber(integrity.orphanOrderItems),
        ordersWithoutItems: asNumber(integrity.ordersWithoutItems),
        orphanReviewLogs: asNumber(integrity.orphanReviewLogs),
        orphanAiFeedback: asNumber(integrity.orphanAiFeedback),
      },
      referencedReceiptKeys: [...referencedKeys],
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await pool.end();
  }
}

function classifySentSubject(subject: string): string {
  const normalized = subject.toLowerCase();
  if (/注文.*(確認|受付|完了)|ご注文|order.*(confirm|received)/i.test(subject))
    return "order_confirmation";
  if (/発送|出荷|shipped/i.test(subject)) return "order_shipped";
  if (/配達完了|お届け完了|delivered/i.test(subject)) return "order_delivered";
  if (/キャンセル|取消|cancel/i.test(subject)) return "order_cancelled";
  if (/レシート|ポイント申請|receipt/i.test(subject)) {
    if (/承認|approved/i.test(subject)) return "receipt_approved";
    if (/却下|否認|rejected/i.test(subject)) return "receipt_rejected";
    return "receipt_other";
  }
  if (/会員登録|登録完了|アカウント.*作成|welcome/i.test(subject))
    return "member_registration";
  if (/パスワード.*(再設定|リセット)|password.*reset/i.test(subject))
    return "password_reset";
  if (normalized.includes("lcj")) return "other_lcj";
  return "other";
}

async function getSentMailAudit() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    return {
      configured: false,
      connected: false,
      error: "SMTP_USER/SMTP_PASS not configured",
    };
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });

  try {
    await client.connect();
    const mailboxes = await client.list();
    const sentMailbox = mailboxes.find(
      mailbox =>
        mailbox.specialUse === "\\Sent" ||
        /(^|\/)(sent mail|sent|送信済みメール)$/i.test(mailbox.path)
    );
    if (!sentMailbox) {
      return {
        configured: true,
        connected: true,
        sentMailboxFound: false,
        mailboxCount: mailboxes.length,
      };
    }

    const lock = await client.getMailboxLock(sentMailbox.path);
    try {
      const since = new Date("2020-01-01T00:00:00Z");
      const categoryTerms: Record<string, string[]> = {
        order_confirmation: ["ご注文", "注文確認", "注文受付"],
        order_shipped: ["発送"],
        order_delivered: ["配達完了", "お届け完了"],
        order_cancelled: ["キャンセル"],
        receipt_related: ["レシート", "ポイント申請"],
        member_registration: ["会員登録", "登録完了"],
        password_reset: ["パスワード"],
      };
      const categoryCounts: Record<string, number> = {};
      const recoverableUids = new Set<number>();

      for (const [category, terms] of Object.entries(categoryTerms)) {
        const categoryUids = new Set<number>();
        for (const term of terms) {
          const result = await client.search(
            { since, subject: term },
            { uid: true }
          );
          if (Array.isArray(result)) {
            for (const uid of result) {
              categoryUids.add(uid);
              recoverableUids.add(uid);
            }
          }
        }
        categoryCounts[category] = categoryUids.size;
      }

      return {
        configured: true,
        connected: true,
        sentMailboxFound: true,
        sentMailboxMessageCountAll:
          client.mailbox && typeof client.mailbox !== "boolean"
            ? client.mailbox.exists
            : null,
        categoryCounts,
        recoverableMessageCount: recoverableUids.size,
        searchSince: since.toISOString(),
        containsRecipientAddresses: false,
        containsSubjects: false,
      };
    } finally {
      lock.release();
    }
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore disconnect errors after a failed connection.
    }
  }
}

async function getStorageAudit(referencedReceiptKeys: string[]) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const region = process.env.AWS_S3_REGION || "auto";
  if (!accessKeyId || !secretAccessKey || !bucket) {
    return {
      configured: false,
      connected: false,
      error: "S3 credentials or bucket not configured",
    };
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    const prefixes = [
      "receipts/",
      "web-receipts/",
      "masked-receipts/",
    ] as const;
    const allKeys = new Set<string>();
    const originalReceiptKeys = new Set<string>();
    const maskedReceiptKeys = new Set<string>();
    const prefixCounts: Record<string, number> = {};
    let totalSizeBytes = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const prefix of prefixes) {
      let continuationToken: string | undefined;
      let prefixCount = 0;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );
        for (const object of page.Contents || []) {
          if (!object.Key) continue;
          allKeys.add(object.Key);
          prefixCount += 1;
          totalSizeBytes += asNumber(object.Size);
          if (prefix === "masked-receipts/") maskedReceiptKeys.add(object.Key);
          else originalReceiptKeys.add(object.Key);
          if (object.LastModified) {
            if (!earliest || object.LastModified < earliest)
              earliest = object.LastModified;
            if (!latest || object.LastModified > latest)
              latest = object.LastModified;
          }
        }
        continuationToken = page.IsTruncated
          ? page.NextContinuationToken
          : undefined;
      } while (continuationToken);
      prefixCounts[prefix] = prefixCount;
    }

    const referenced = new Set(
      referencedReceiptKeys.map(key => key.replace(/^\/+/, ""))
    );
    let referencedPresent = 0;
    for (const key of referenced) if (allKeys.has(key)) referencedPresent += 1;
    let unreferencedReceiptObjects = 0;
    for (const key of originalReceiptKeys)
      if (!referenced.has(key)) unreferencedReceiptObjects += 1;

    return {
      configured: true,
      connected: true,
      searchedPrefixes: prefixes,
      prefixCounts,
      objectCount: allKeys.size,
      totalSizeBytes,
      receiptObjectCount: originalReceiptKeys.size,
      maskedReceiptObjectCount: maskedReceiptKeys.size,
      dbReferencedReceiptKeyCount: referenced.size,
      dbReferencedKeysPresentInStorage: referencedPresent,
      dbReferencedKeysMissingFromStorage: referenced.size - referencedPresent,
      unreferencedReceiptObjectCount: unreferencedReceiptObjects,
      earliestObjectAt: isoOrNull(earliest),
      latestObjectAt: isoOrNull(latest),
      containsObjectKeys: false,
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getIntegrations() {
  return {
    gmailSmtpConfigured: Boolean(
      process.env.SMTP_USER && process.env.SMTP_PASS
    ),
    sesConfigured: Boolean(
      process.env.AWS_SES_REGION &&
        process.env.AWS_SES_ACCESS_KEY_ID &&
        process.env.AWS_SES_SECRET_ACCESS_KEY
    ),
    s3Configured: Boolean(
      process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_S3_BUCKET
    ),
  };
}

function sanitizeDatabase(
  database: Awaited<ReturnType<typeof getDatabaseAudit>>
) {
  const sanitized = { ...database } as Record<string, unknown>;
  delete sanitized.referencedReceiptKeys;
  return sanitized;
}

async function getSnapshot() {
  const database = await getDatabaseAudit();
  const referencedReceiptKeys =
    "referencedReceiptKeys" in database &&
    Array.isArray(database.referencedReceiptKeys)
      ? database.referencedReceiptKeys
      : [];
  const [sentMail, storage] = await Promise.all([
    getSentMailAudit(),
    getStorageAudit(referencedReceiptKeys),
  ]);

  return {
    capturedAt: new Date().toISOString(),
    database: sanitizeDatabase(database),
    sentMail,
    storage,
    integrations: getIntegrations(),
    containsPersonalData: false,
  };
}

export const orderReceiptRecoveryAuditRouter = router({
  database: publicProcedure
    .input(z.object({ key: z.string().min(32).max(128) }))
    .query(async ({ input }) => {
      verifyAuditKey(input.key);
      const database = await getDatabaseAudit();
      return {
        capturedAt: new Date().toISOString(),
        database: sanitizeDatabase(database),
        integrations: getIntegrations(),
        containsPersonalData: false,
      };
    }),
  sentMail: publicProcedure
    .input(z.object({ key: z.string().min(32).max(128) }))
    .query(async ({ input }) => {
      verifyAuditKey(input.key);
      return {
        capturedAt: new Date().toISOString(),
        sentMail: await getSentMailAudit(),
        containsPersonalData: false,
      };
    }),
  storage: publicProcedure
    .input(z.object({ key: z.string().min(32).max(128) }))
    .query(async ({ input }) => {
      verifyAuditKey(input.key);
      const database = await getDatabaseAudit();
      const referencedReceiptKeys =
        "referencedReceiptKeys" in database &&
        Array.isArray(database.referencedReceiptKeys)
          ? database.referencedReceiptKeys
          : [];
      return {
        capturedAt: new Date().toISOString(),
        storage: await getStorageAudit(referencedReceiptKeys),
        containsPersonalData: false,
      };
    }),
  snapshot: publicProcedure
    .input(z.object({ key: z.string().min(32).max(128) }))
    .query(async ({ input }) => {
      verifyAuditKey(input.key);
      return await getSnapshot();
    }),
});
