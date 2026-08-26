import crypto from "node:crypto";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import mysql, { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { runDatabaseBackup } from "./databaseBackupScheduler";
import { restoreOrderEmailChunk } from "./orderEmailDataRecovery";
import { restoreReceiptS3Chunk } from "./receiptS3DataRecovery";

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

type ExtractedOrderItem = {
  productName: string;
  quantity: number;
  subtotal: number | null;
};

type ExtractedOrderMail = {
  uid: number;
  category: "confirmation" | "shipped" | "delivered" | "cancelled";
  orderNumber: string;
  sentAt: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  paymentMethod: "stripe" | "points" | "cod" | null;
  totalAmount: number | null;
  pointsUsed: number;
  shippingFee: number;
  shippingName: string | null;
  shippingPostalCode: string | null;
  shippingAddress: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  cancelReason: string | null;
  items: ExtractedOrderItem[];
  debugText?: string;
  debugHtml?: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&yen;|&#165;|&#xa5;/gi, "¥")
    .replace(/&times;|&#215;|&#xd7;/gi, "×")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function capture(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function parseOrderMailSubject(subject: string): {
  category: ExtractedOrderMail["category"];
  orderNumber: string;
} | null {
  let category: ExtractedOrderMail["category"] | null = null;
  if (/商品発送|発送のお知らせ/.test(subject)) category = "shipped";
  else if (/配達完了|お届け完了/.test(subject)) category = "delivered";
  else if (/キャンセル|取消/.test(subject)) category = "cancelled";
  else if (/ご注文|注文確認|注文受付/.test(subject)) category = "confirmation";
  if (!category) return null;

  const separatorMatch = subject.match(/\s+-\s+([^\s].*)$/);
  const labelledMatch = subject.match(
    /(?:注文番号|注文No\.?)[：:#\s-]*([A-Z0-9][A-Z0-9-]{4,63})/i
  );
  const orderNumber = (separatorMatch?.[1] || labelledMatch?.[1] || "").trim();
  return orderNumber ? { category, orderNumber } : null;
}

function parseOrderItems(
  html: string,
  plainText: string
): ExtractedOrderItem[] {
  const items: ExtractedOrderItem[] = [];
  const htmlPattern =
    /<td[^>]*>\s*([^<][\s\S]*?)\s*<span[^>]*>\s*(?:&times;|×)\s*(\d+)\s*<\/span>\s*<\/td>(?:\s*<td[^>]*>\s*(?:&yen;|¥)\s*([\d,]+)\s*<\/td>)?/gi;
  for (const match of html.matchAll(htmlPattern)) {
    const productName = decodeHtml(match[1] || "");
    const quantity = Number(match[2] || 0);
    if (!productName || !Number.isFinite(quantity) || quantity < 1) continue;
    items.push({ productName, quantity, subtotal: parseNumber(match[3]) });
  }
  if (items.length > 0) return items;

  const textPattern =
    /^\s*[・•]\s*(.+?)\s*[×x]\s*(\d+)(?:\s*[￥¥]\s*([\d,]+))?\s*$/gim;
  for (const match of plainText.matchAll(textPattern)) {
    const productName = (match[1] || "").trim();
    const quantity = Number(match[2] || 0);
    if (!productName || !Number.isFinite(quantity) || quantity < 1) continue;
    items.push({ productName, quantity, subtotal: parseNumber(match[3]) });
  }
  if (items.length > 0) return items;

  const inlineProduct = plainText.match(/^■\s*商品:\s*(.+)$/m)?.[1]?.trim();
  const separateQuantity = Number(
    plainText.match(/^■\s*数量:\s*(\d+)$/m)?.[1] || 0
  );
  const multilineProduct = plainText.match(
    /^■\s*商品:\s*\n\s*(.+?)\s*[×x]\s*(\d+)\s*$/m
  );
  const legacyProduct = inlineProduct || multilineProduct?.[1]?.trim();
  const legacyQuantity = separateQuantity || Number(multilineProduct?.[2] || 0);
  const legacyPoints = parseNumber(
    plainText.match(/^■\s*(?:ポイント|小計):\s*([\d,]+)\s*pt$/im)?.[1]
  );
  if (legacyProduct && Number.isFinite(legacyQuantity) && legacyQuantity > 0) {
    items.push({
      productName: legacyProduct,
      quantity: legacyQuantity,
      subtotal: legacyPoints,
    });
  }
  return items;
}

function parseOrderMail(
  uid: number,
  subject: string,
  html: string,
  plainText: string,
  recipientEmail: string | null,
  sentAt: Date | null
): ExtractedOrderMail | null {
  const parsedSubject = parseOrderMailSubject(subject);
  if (!parsedSubject) return null;

  const paymentLabel = capture(
    html,
    /お支払い方法<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i
  );
  const paymentText = paymentLabel || plainText;
  const paymentMethod = paymentText.includes("クレジット")
    ? "stripe"
    : paymentText.includes("ポイント決済") ||
        paymentText.includes("ご利用ポイントは返還") ||
        /^■\s*(?:ポイント|小計|合計):/m.test(plainText)
      ? "points"
      : paymentText.includes("代引")
        ? "cod"
        : null;
  const totalAmount = parseNumber(
    capture(html, />合計<\/td>[\s\S]*?<td[^>]*>\s*(?:&yen;|¥)\s*([\d,]+)/i) ||
      capture(html, /返金額:[\s\S]*?(?:&yen;|¥)\s*([\d,]+)/i) ||
      capture(html, /返還ポイント:[\s\S]*?([\d,]+)\s*pt/i) ||
      plainText.match(/お支払い金額:\s*[￥¥]\s*([\d,]+)/)?.[1] ||
      plainText.match(/返金額:\s*[￥¥]\s*([\d,]+)/)?.[1] ||
      plainText.match(/^■\s*合計:\s*([\d,]+)\s*pt$/im)?.[1] ||
      plainText.match(/^■\s*ポイント:\s*([\d,]+)\s*pt$/im)?.[1] ||
      undefined
  );
  const pointsUsed =
    parseNumber(
      capture(
        html,
        />ポイント利用<\/td>[\s\S]*?<td[^>]*>\s*-?(?:&yen;|¥)\s*([\d,]+)/i
      ) ||
        plainText.match(/ポイント利用:\s*([\d,]+)\s*pt/i)?.[1] ||
        plainText.match(/^■\s*合計:\s*([\d,]+)\s*pt$/im)?.[1] ||
        plainText.match(/^■\s*ポイント:\s*([\d,]+)\s*pt$/im)?.[1] ||
        undefined
    ) || 0;
  const shippingFee =
    parseNumber(
      capture(html, />送料<\/td>[\s\S]*?<td[^>]*>\s*(?:&yen;|¥)\s*([\d,]+)/i) ||
        plainText.match(/送料:\s*[￥¥]\s*([\d,]+)/)?.[1] ||
        plainText.match(/^■\s*送料:\s*([\d,]+)\s*pt$/im)?.[1] ||
        undefined
    ) || 0;
  const shippingMatch = html.match(
    /配送先<\/p>[\s\S]*?<p[^>]*>([\s\S]*?)\s*様<\/p>\s*<p[^>]*>〒([\s\S]*?)<br\s*\/?>([\s\S]*?)<\/p>/i
  );
  const textShippingMatch = plainText.match(
    /配送先:\s*\n\s*(.+?)\s*様\s*\n\s*〒([^\n]+)\s*\n\s*([^\n]+)/i
  );
  const recipientName =
    capture(
      html,
      /<p[^>]*>([\s\S]*?)\s*様[、,](?:ご注文|以下の注文|ご注文の商品)/i
    ) ||
    plainText.match(/^(.+?)\s*様\s*$/m)?.[1]?.trim() ||
    null;

  return {
    uid,
    category: parsedSubject.category,
    orderNumber: parsedSubject.orderNumber,
    sentAt: isoOrNull(sentAt),
    recipientEmail,
    recipientName,
    paymentMethod,
    totalAmount,
    pointsUsed,
    shippingFee,
    shippingName: shippingMatch?.[1]
      ? decodeHtml(shippingMatch[1])
      : textShippingMatch?.[1]?.trim() || null,
    shippingPostalCode: shippingMatch?.[2]
      ? decodeHtml(shippingMatch[2])
      : textShippingMatch?.[2]?.trim() || null,
    shippingAddress: shippingMatch?.[3]
      ? decodeHtml(shippingMatch[3])
      : textShippingMatch?.[3]?.trim() || null,
    shippingCarrier:
      capture(html, /<strong>配送業者:<\/strong>\s*([\s\S]*?)<\/p>/i) ||
      plainText.match(/配送業者:\s*([^\n]+)/)?.[1]?.trim() ||
      null,
    trackingNumber:
      capture(
        html,
        /<strong>追跡番号:<\/strong>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i
      ) ||
      plainText.match(/追跡番号:\s*([^\n]+)/)?.[1]?.trim() ||
      null,
    cancelReason:
      capture(html, /キャンセル理由<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i) ||
      plainText.match(/キャンセル理由:\s*([^\n]+)/)?.[1]?.trim() ||
      null,
    items: parseOrderItems(html, plainText),
  };
}

async function getOrderMailExtractionPage(
  page: number,
  pageSize: number,
  includeRaw: boolean = false
) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("SMTP_USER/SMTP_PASS not configured");

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 120_000,
  });

  try {
    await client.connect();
    const mailboxes = await client.list();
    const sentMailbox = mailboxes.find(
      mailbox =>
        mailbox.specialUse === "\\Sent" ||
        /(^|\/)(sent mail|sent|送信済みメール)$/i.test(mailbox.path)
    );
    if (!sentMailbox) throw new Error("Sent mailbox not found");

    const lock = await client.getMailboxLock(sentMailbox.path);
    try {
      const since = new Date("2020-01-01T00:00:00Z");
      const terms = [
        "ご注文",
        "注文確認",
        "注文受付",
        "商品発送",
        "配達完了",
        "お届け完了",
        "キャンセル",
      ];
      const uidSet = new Set<number>();
      for (const term of terms) {
        const result = await client.search(
          { since, subject: term },
          { uid: true }
        );
        if (Array.isArray(result)) for (const uid of result) uidSet.add(uid);
      }
      const allUids = [...uidSet].sort((a, b) => a - b);
      const start = page * pageSize;
      const pageUids = allUids.slice(start, start + pageSize);
      const records: ExtractedOrderMail[] = [];

      if (pageUids.length > 0) {
        for await (const message of client.fetch(
          pageUids,
          { envelope: true, internalDate: true, source: true },
          { uid: true }
        )) {
          if (!message.source) continue;
          const parsed = await simpleParser(message.source);
          const subject = parsed.subject || message.envelope?.subject || "";
          const html = typeof parsed.html === "string" ? parsed.html : "";
          const plainText = parsed.text || "";
          const recipientEmail =
            parsed.to?.value.find(value => value.address)?.address || null;
          const sentAt =
            message.internalDate ||
            parsed.date ||
            message.envelope?.date ||
            null;
          const record = parseOrderMail(
            message.uid,
            subject,
            html,
            plainText,
            recipientEmail,
            sentAt
          );
          if (record) {
            if (includeRaw) {
              record.debugText = plainText;
              record.debugHtml = html;
            }
            records.push(record);
          }
        }
      }

      records.sort((a, b) => a.uid - b.uid);
      return {
        totalCandidateMessages: allUids.length,
        page,
        pageSize,
        pageCount: Math.ceil(allUids.length / pageSize),
        hasMore: start + pageSize < allUids.length,
        records,
        containsPersonalData: true,
      };
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // Ignore disconnect errors after a failed connection.
    }
  }
}

async function getReceiptDatabaseRecoveryData() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not configured");

  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 });
  try {
    const tableNames = [
      "line_users",
      "mall_orders",
      "mall_order_items",
      "mall_products",
      "mall_product_variants",
      "user_addresses",
      "db_backup_runs",
      "line_receipts",
      "receipt_review_logs",
      "ai_review_feedback",
      "ai_auto_review_logs",
      "line_fraud_detection_logs",
      "receipt_products",
      "ai_receipt_learning_examples",
    ] as const;
    const tables: Record<string, RowDataPacket[]> = {};
    for (const tableName of tableNames) {
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT * FROM \`${tableName}\` ORDER BY id ASC`
        );
        tables[tableName] = rows;
      } catch {
        tables[tableName] = [];
      }
    }

    return {
      capturedAt: new Date().toISOString(),
      tables,
      rowCounts: Object.fromEntries(
        Object.entries(tables).map(([tableName, rows]) => [
          tableName,
          rows.length,
        ])
      ),
      containsPersonalData: true,
    };
  } finally {
    await pool.end();
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

async function getStorageObjectPage(
  prefix: "receipts/" | "web-receipts/" | "masked-receipts/",
  continuationToken: string | undefined,
  maxKeys: number
) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const region = process.env.AWS_S3_REGION || "auto";
  if (!accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("S3 credentials or bucket not configured");
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: { accessKeyId, secretAccessKey },
  });
  const page = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
      MaxKeys: maxKeys,
    })
  );

  return {
    prefix,
    continuationToken: page.NextContinuationToken || null,
    isTruncated: Boolean(page.IsTruncated),
    keyCount: page.KeyCount || 0,
    objects: (page.Contents || [])
      .filter(object => Boolean(object.Key))
      .map(object => ({
        key: object.Key!,
        size: asNumber(object.Size),
        etag: object.ETag?.replace(/^"|"$/g, "") || null,
        lastModified: isoOrNull(object.LastModified || null),
        storageClass: object.StorageClass || null,
      })),
    containsPersonalData: true,
  };
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
  restoreReceiptChunk: publicProcedure
    .input(
      z.object({
        key: z.string().min(32).max(128),
        batchId: z.string().min(8).max(64),
        receipts: z
          .array(
            z.object({
              lineUserId: z.string().min(1).max(64),
              submittedAt: z.string().min(10).max(64),
              imageKeys: z.array(z.string().min(1).max(512)).min(1).max(5),
              etags: z.array(z.string().max(100).nullable()).min(1).max(5),
              fraudFlags: z.array(z.string().min(1).max(64)).max(10).optional(),
            })
          )
          .min(1)
          .max(200),
      })
    )
    .mutation(async ({ input }) => {
      verifyAuditKey(input.key);
      return await restoreReceiptS3Chunk({
        batchId: input.batchId,
        receipts: input.receipts,
      });
    }),
  restoreOrderChunk: publicProcedure
    .input(
      z.object({
        key: z.string().min(32).max(128),
        batchId: z.string().min(8).max(64),
        members: z
          .array(
            z.object({
              email: z.string().email(),
              displayName: z.string().max(255).nullable().optional(),
            })
          )
          .max(100),
        orders: z
          .array(
            z.object({
              orderNumber: z.string().min(1).max(64),
              recipientEmail: z.string().email(),
              recipientName: z.string().max(255).nullable().optional(),
              status: z.enum([
                "confirmed",
                "shipped",
                "delivered",
                "cancelled",
              ]),
              paymentMethod: z.enum(["stripe", "points", "cod"]),
              sourceTotalAmount: z.number().int().min(0),
              sourcePointsUsed: z.number().int().min(0).optional(),
              shippingName: z.string().max(255).nullable().optional(),
              shippingPostalCode: z.string().max(20).nullable().optional(),
              shippingAddress: z.string().nullable().optional(),
              shippingCarrier: z.string().max(100).nullable().optional(),
              trackingNumber: z.string().max(255).nullable().optional(),
              cancelReason: z.string().nullable().optional(),
              createdAt: z.string().nullable().optional(),
              shippedAt: z.string().nullable().optional(),
              deliveredAt: z.string().nullable().optional(),
              cancelledAt: z.string().nullable().optional(),
              items: z.array(
                z.object({
                  productName: z.string().min(1).max(255),
                  quantity: z.number().int().min(1).max(1000),
                  subtotal: z.number().int().min(0).nullable(),
                  existingProductId: z
                    .number()
                    .int()
                    .positive()
                    .nullable()
                    .optional(),
                })
              ),
              mailEvidenceUids: z.array(z.number().int().positive()).min(1),
              mailCategories: z.array(z.string().min(1).max(32)).min(1),
            })
          )
          .min(1)
          .max(50),
      })
    )
    .mutation(async ({ input }) => {
      verifyAuditKey(input.key);
      return await restoreOrderEmailChunk({
        batchId: input.batchId,
        members: input.members,
        orders: input.orders,
      });
    }),
  backup: publicProcedure
    .input(
      z.object({
        key: z.string().min(32).max(128),
        reason: z.enum(["order_receipt_pre", "order_receipt_post"]),
      })
    )
    .mutation(async ({ input }) => {
      verifyAuditKey(input.key);
      return await runDatabaseBackup(input.reason);
    }),
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
  orderMailPage: publicProcedure
    .input(
      z.object({
        key: z.string().min(32).max(128),
        page: z.number().int().min(0),
        pageSize: z.number().int().min(1).max(50).default(50),
        includeRaw: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      verifyAuditKey(input.key);
      return await getOrderMailExtractionPage(
        input.page,
        input.pageSize,
        input.includeRaw
      );
    }),
  receiptDbData: publicProcedure
    .input(z.object({ key: z.string().min(32).max(128) }))
    .query(async ({ input }) => {
      verifyAuditKey(input.key);
      return await getReceiptDatabaseRecoveryData();
    }),
  storagePage: publicProcedure
    .input(
      z.object({
        key: z.string().min(32).max(128),
        prefix: z.enum(["receipts/", "web-receipts/", "masked-receipts/"]),
        continuationToken: z.string().min(1).optional(),
        maxKeys: z.number().int().min(1).max(1000).default(1000),
      })
    )
    .query(async ({ input }) => {
      verifyAuditKey(input.key);
      return await getStorageObjectPage(
        input.prefix,
        input.continuationToken,
        input.maxKeys
      );
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
