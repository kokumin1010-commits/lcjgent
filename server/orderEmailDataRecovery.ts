import crypto from "node:crypto";
import mysql, { ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type OrderRecoveryMemberInput = {
  email: string;
  displayName?: string | null;
};

export type OrderRecoveryItemInput = {
  productName: string;
  quantity: number;
  subtotal: number | null;
  existingProductId?: number | null;
};

export type OrderRecoveryInput = {
  orderNumber: string;
  recipientEmail: string;
  recipientName?: string | null;
  status: "confirmed" | "shipped" | "delivered" | "cancelled";
  paymentMethod: "stripe" | "points" | "cod";
  sourceTotalAmount: number;
  sourcePointsUsed?: number;
  shippingName?: string | null;
  shippingPostalCode?: string | null;
  shippingAddress?: string | null;
  shippingCarrier?: string | null;
  trackingNumber?: string | null;
  cancelReason?: string | null;
  createdAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  items: OrderRecoveryItemInput[];
  mailEvidenceUids: number[];
  mailCategories: string[];
};

export type OrderRecoveryChunkInput = {
  batchId: string;
  members: OrderRecoveryMemberInput[];
  orders: OrderRecoveryInput[];
};

type RecoverySummary = {
  membersCreated: number;
  membersReused: number;
  memberEmailsAdded: number;
  productsCreated: number;
  productsReused: number;
  ordersCreated: number;
  ordersReused: number;
  ordersUpdatedFromEvidence: number;
  orderItemsCreated: number;
  auditRowsCreated: number;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeProductName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　・･★☆【】\[\]（）()\-ー_]+/g, "")
    .trim();
}

function recoveredLineUserId(email: string): string {
  return `recovery_email_${crypto.createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
}

function toSqlTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampText(
  value: string | null | undefined,
  max: number
): string | null {
  if (!value) return null;
  return value.slice(0, max);
}

async function ensureRecoveryAuditTable(
  connection: mysql.PoolConnection
): Promise<void> {
  await connection.execute(`CREATE TABLE IF NOT EXISTS \`order_email_recovery_audit\` (
    \`id\` bigint NOT NULL AUTO_INCREMENT,
    \`batchId\` varchar(64) NOT NULL,
    \`orderNumber\` varchar(64) NOT NULL,
    \`memberId\` int DEFAULT NULL,
    \`action\` varchar(32) NOT NULL,
    \`sourceMailUids\` json NOT NULL,
    \`sourceCategories\` json NOT NULL,
    \`payloadSha256\` char(64) NOT NULL,
    \`recoveredAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`order_email_recovery_order_unique\` (\`orderNumber\`),
    KEY \`order_email_recovery_batch_idx\` (\`batchId\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

export async function restoreOrderEmailChunk(
  input: OrderRecoveryChunkInput
): Promise<RecoverySummary> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not configured");

  const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2 });
  const connection = await pool.getConnection();
  const summary: RecoverySummary = {
    membersCreated: 0,
    membersReused: 0,
    memberEmailsAdded: 0,
    productsCreated: 0,
    productsReused: 0,
    ordersCreated: 0,
    ordersReused: 0,
    ordersUpdatedFromEvidence: 0,
    orderItemsCreated: 0,
    auditRowsCreated: 0,
  };

  try {
    await connection.beginTransaction();
    await ensureRecoveryAuditTable(connection);

    const memberCache = new Map<string, number>();
    const memberNameByEmail = new Map<string, string | null>();
    for (const member of input.members) {
      const email = normalizeEmail(member.email);
      memberNameByEmail.set(email, clampText(member.displayName, 255));
    }

    const getOrCreateMember = async (
      rawEmail: string,
      displayName?: string | null
    ): Promise<number> => {
      const email = normalizeEmail(rawEmail);
      const cached = memberCache.get(email);
      if (cached) return cached;

      const [existingRows] = await connection.query<RowDataPacket[]>(
        "SELECT `id`, `email`, `displayName` FROM `line_users` WHERE LOWER(`email`) = ? ORDER BY `id` ASC LIMIT 1",
        [email]
      );
      if (existingRows.length > 0) {
        const memberId = Number(existingRows[0].id);
        memberCache.set(email, memberId);
        summary.membersReused += 1;
        if (!existingRows[0].displayName && displayName) {
          await connection.execute(
            "UPDATE `line_users` SET `displayName` = ?, `updatedAt` = CURRENT_TIMESTAMP WHERE `id` = ?",
            [clampText(displayName, 255), memberId]
          );
        }
        return memberId;
      }

      const lineUserId = recoveredLineUserId(email);
      const [lineRows] = await connection.query<RowDataPacket[]>(
        "SELECT `id`, `email` FROM `line_users` WHERE `lineUserId` = ? LIMIT 1",
        [lineUserId]
      );
      if (lineRows.length > 0) {
        const memberId = Number(lineRows[0].id);
        if (!lineRows[0].email) {
          await connection.execute(
            "UPDATE `line_users` SET `email` = ?, `displayName` = COALESCE(`displayName`, ?), `updatedAt` = CURRENT_TIMESTAMP WHERE `id` = ?",
            [email, clampText(displayName, 255), memberId]
          );
          summary.memberEmailsAdded += 1;
        }
        memberCache.set(email, memberId);
        summary.membersReused += 1;
        return memberId;
      }

      const [insertResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO \`line_users\`
          (\`lineUserId\`, \`displayName\`, \`email\`, \`statusMessage\`, \`createdAt\`, \`updatedAt\`)
         VALUES (?, ?, ?, '注文メール証拠から復旧・パスワード未設定', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [lineUserId, clampText(displayName, 255) || "復旧会員", email]
      );
      const memberId = Number(insertResult.insertId);
      memberCache.set(email, memberId);
      summary.membersCreated += 1;
      return memberId;
    };

    for (const member of input.members) {
      await getOrCreateMember(member.email, member.displayName);
    }

    const [productRows] = await connection.query<RowDataPacket[]>(
      "SELECT `id`, `name` FROM `mall_products` ORDER BY `id` ASC"
    );
    const productCache = new Map<string, number>();
    for (const row of productRows) {
      const normalized = normalizeProductName(String(row.name || ""));
      if (normalized && !productCache.has(normalized)) {
        productCache.set(normalized, Number(row.id));
      }
    }

    const getOrCreateProduct = async (
      item: OrderRecoveryItemInput,
      paymentMethod: OrderRecoveryInput["paymentMethod"]
    ): Promise<number> => {
      if (item.existingProductId && item.existingProductId > 0) {
        const [rows] = await connection.query<RowDataPacket[]>(
          "SELECT `id` FROM `mall_products` WHERE `id` = ? LIMIT 1",
          [item.existingProductId]
        );
        if (rows.length > 0) {
          summary.productsReused += 1;
          return Number(rows[0].id);
        }
      }

      const productName = clampText(item.productName, 255) || "復旧商品";
      const normalized = normalizeProductName(productName);
      const cached = productCache.get(normalized);
      if (cached) {
        summary.productsReused += 1;
        return cached;
      }

      const quantity = Math.max(1, Math.floor(item.quantity || 1));
      const evidenceSubtotal = Math.max(0, Math.round(item.subtotal || 0));
      const unit = Math.max(0, Math.round(evidenceSubtotal / quantity));
      const isPointOrder = paymentMethod === "points";
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO \`mall_products\`
          (\`name\`, \`description\`, \`price\`, \`pointPrice\`, \`stock\`, \`status\`, \`sortOrder\`, \`createdAt\`, \`updatedAt\`)
         VALUES (?, '送信済み注文メールの実績明細から復旧した非公開履歴商品', ?, ?, 0, 'archived', 9999, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [productName, isPointOrder ? 0 : unit, isPointOrder ? unit : null]
      );
      const productId = Number(result.insertId);
      productCache.set(normalized, productId);
      summary.productsCreated += 1;
      return productId;
    };

    for (const order of input.orders) {
      const memberId = await getOrCreateMember(
        order.recipientEmail,
        order.recipientName ||
          memberNameByEmail.get(normalizeEmail(order.recipientEmail))
      );
      const sourceTotal = Math.max(0, Math.round(order.sourceTotalAmount || 0));
      const pointsUsed =
        order.paymentMethod === "points"
          ? sourceTotal
          : Math.max(0, Math.round(order.sourcePointsUsed || 0));
      const totalAmount = order.paymentMethod === "points" ? 0 : sourceTotal;
      const cashAmount = Math.max(0, totalAmount - pointsUsed);
      const recoveryNote = `Gmail送信済みメールから復旧 batch=${input.batchId} evidence=${order.mailEvidenceUids.join(",")}`;

      const [existingOrders] = await connection.query<RowDataPacket[]>(
        "SELECT `id` FROM `mall_orders` WHERE `orderNumber` = ? LIMIT 1",
        [order.orderNumber]
      );
      let orderId: number;
      let action: "created" | "reused";
      if (existingOrders.length > 0) {
        orderId = Number(existingOrders[0].id);
        action = "reused";
        summary.ordersReused += 1;
        const [updateResult] = await connection.execute<ResultSetHeader>(
          `UPDATE \`mall_orders\` SET
            \`shippingName\` = COALESCE(\`shippingName\`, ?),
            \`shippingPostalCode\` = COALESCE(\`shippingPostalCode\`, ?),
            \`shippingAddress\` = COALESCE(\`shippingAddress\`, ?),
            \`shippingCarrier\` = COALESCE(\`shippingCarrier\`, ?),
            \`trackingNumber\` = COALESCE(\`trackingNumber\`, ?),
            \`shippedAt\` = COALESCE(\`shippedAt\`, ?),
            \`deliveredAt\` = COALESCE(\`deliveredAt\`, ?),
            \`cancelledAt\` = COALESCE(\`cancelledAt\`, ?),
            \`cancelReason\` = COALESCE(\`cancelReason\`, ?),
            \`adminNotes\` = CASE WHEN \`adminNotes\` IS NULL OR \`adminNotes\` = '' THEN ? ELSE \`adminNotes\` END,
            \`updatedAt\` = CURRENT_TIMESTAMP
           WHERE \`id\` = ?`,
          [
            clampText(order.shippingName || order.recipientName, 255),
            clampText(order.shippingPostalCode, 20),
            order.shippingAddress || null,
            clampText(order.shippingCarrier, 100),
            clampText(order.trackingNumber, 255),
            toSqlTimestamp(order.shippedAt),
            toSqlTimestamp(order.deliveredAt),
            toSqlTimestamp(order.cancelledAt),
            order.cancelReason || null,
            recoveryNote,
            orderId,
          ]
        );
        if (updateResult.affectedRows > 0)
          summary.ordersUpdatedFromEvidence += 1;
      } else {
        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO \`mall_orders\`
            (\`orderNumber\`, \`lineUserId\`, \`status\`, \`paymentMethod\`, \`totalAmount\`, \`pointsUsed\`, \`cashAmount\`,
             \`shippingName\`, \`shippingPostalCode\`, \`shippingAddress\`, \`shippingCarrier\`, \`trackingNumber\`,
             \`notes\`, \`adminNotes\`, \`createdAt\`, \`updatedAt\`, \`shippedAt\`, \`deliveredAt\`, \`cancelledAt\`, \`cancelReason\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '送信済みメール証拠から復旧', ?, COALESCE(?, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP, ?, ?, ?, ?)`,
          [
            order.orderNumber,
            memberId,
            order.status,
            order.paymentMethod,
            totalAmount,
            pointsUsed,
            cashAmount,
            clampText(order.shippingName || order.recipientName, 255),
            clampText(order.shippingPostalCode, 20),
            order.shippingAddress || null,
            clampText(order.shippingCarrier, 100),
            clampText(order.trackingNumber, 255),
            recoveryNote,
            toSqlTimestamp(order.createdAt),
            toSqlTimestamp(order.shippedAt),
            toSqlTimestamp(order.deliveredAt),
            toSqlTimestamp(order.cancelledAt),
            order.cancelReason || null,
          ]
        );
        orderId = Number(insertResult.insertId);
        action = "created";
        summary.ordersCreated += 1;
      }

      const [itemCountRows] = await connection.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS rowCount FROM `mall_order_items` WHERE `orderId` = ?",
        [orderId]
      );
      if (Number(itemCountRows[0]?.rowCount || 0) === 0) {
        for (const item of order.items) {
          const productId = await getOrCreateProduct(item, order.paymentMethod);
          const quantity = Math.max(1, Math.floor(item.quantity || 1));
          const evidenceSubtotal = Math.max(0, Math.round(item.subtotal || 0));
          const unit = Math.max(0, Math.round(evidenceSubtotal / quantity));
          const isPointOrder = order.paymentMethod === "points";
          await connection.execute(
            `INSERT INTO \`mall_order_items\`
              (\`orderId\`, \`productId\`, \`productName\`, \`productPrice\`, \`productPointPrice\`, \`quantity\`, \`subtotal\`, \`pointSubtotal\`, \`createdAt\`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
            [
              orderId,
              productId,
              clampText(item.productName, 255) || "復旧商品",
              isPointOrder ? 0 : unit,
              isPointOrder ? unit : null,
              quantity,
              isPointOrder ? 0 : evidenceSubtotal,
              isPointOrder ? evidenceSubtotal : 0,
              toSqlTimestamp(order.createdAt),
            ]
          );
          summary.orderItemsCreated += 1;
        }
      }

      const payloadHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(order))
        .digest("hex");
      const [auditResult] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO \`order_email_recovery_audit\`
          (\`batchId\`, \`orderNumber\`, \`memberId\`, \`action\`, \`sourceMailUids\`, \`sourceCategories\`, \`payloadSha256\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.batchId,
          order.orderNumber,
          memberId,
          action,
          JSON.stringify(order.mailEvidenceUids),
          JSON.stringify(order.mailCategories),
          payloadHash,
        ]
      );
      if (auditResult.affectedRows > 0) summary.auditRowsCreated += 1;
    }

    await connection.commit();
    return summary;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}
