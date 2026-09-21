import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { PerformanceAccess } from "./performanceAccess";
import { requirePerformanceAdmin } from "./performanceAccess";
import { ensurePerformanceInitialized } from "./performanceReconciliationService";
import type { PerformanceDatabase } from "./performanceUpgrade";

function rowsOf<T>(result: unknown): T[] {
  const rows = (result as any)?.[0];
  return Array.isArray(rows) ? rows as T[] : [];
}

function normalizeYearMonth(value: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "月份格式必须为YYYY-MM" });
  }
  return value;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

async function appendAudit(
  executor: Pick<PerformanceDatabase, "execute">,
  access: PerformanceAccess,
  input: {
    requestId: string;
    entityId: string;
    action: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
  },
) {
  await executor.execute(sql`
    INSERT INTO performance_audit_logs (
      requestId, actorUserId, actorStaffId, entityType, entityId,
      action, beforeState, afterState
    ) VALUES (
      ${input.requestId}, ${access.userId}, ${access.staffId}, 'business_sales_attribution',
      ${input.entityId}, ${input.action}, ${JSON.stringify(input.beforeState || null)},
      ${JSON.stringify(input.afterState || null)}
    )
  `);
}

export async function getBusinessSalesConfiguration(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  yearMonthInput: string,
) {
  requirePerformanceAdmin(access);
  await ensurePerformanceInitialized(db, access.userId);
  const yearMonth = normalizeYearMonth(yearMonthInput);
  const [attributionResult, staffResult, storeResult, contractResult, activeContractAttributionResult] = await Promise.all([
    db.execute(sql`
      SELECT attribution.*, member.name AS staffName, store.name AS storeName,
        brand.name AS brandName, confirmer.name AS confirmedByName
      FROM performance_business_sales_attributions attribution
      INNER JOIN staff member ON member.id = attribution.staffId
      LEFT JOIN managed_stores store ON store.id = attribution.storeId
      LEFT JOIN brands brand ON brand.id = attribution.brandId
      LEFT JOIN staff confirmer ON confirmer.id = attribution.confirmedByStaffId
      WHERE DATE_FORMAT(attribution.businessDate, '%Y-%m') = ${yearMonth}
      ORDER BY attribution.businessDate DESC, attribution.id DESC
      LIMIT 500
    `),
    db.execute(sql`
      SELECT id, name, department, position
      FROM staff
      WHERE isActive = 'active' AND archivedAt IS NULL AND mergedIntoStaffId IS NULL
      ORDER BY department, name
    `),
    db.execute(sql`
      SELECT store.id, store.name, store.brandId,
        GROUP_CONCAT(relation.brandId ORDER BY relation.isPrimary DESC, relation.brandId) AS brandIdsCsv,
        GROUP_CONCAT(COALESCE(NULLIF(brand.nameJa, ''), brand.name) ORDER BY relation.isPrimary DESC, relation.brandId SEPARATOR ' / ') AS brandName
      FROM managed_stores store
      LEFT JOIN managed_store_brands relation ON relation.storeId = store.id
      LEFT JOIN brands brand ON brand.id = relation.brandId AND brand.deletedAt IS NULL
      WHERE store.isActive = 1
      GROUP BY store.id, store.name, store.brandId
      ORDER BY brandName, store.name
    `),
    db.execute(sql`
      SELECT contract.id, contract.brandId, brand.name AS brandName,
        contract.fixedFee, contract.currency, contract.startDate, contract.status
      FROM brand_contracts contract
      INNER JOIN brands brand ON brand.id = contract.brandId
      WHERE contract.deletedAt IS NULL AND contract.fixedFee IS NOT NULL
        AND contract.fixedFee > 0
        AND DATE_FORMAT(COALESCE(contract.startDate, contract.createdAt), '%Y-%m') = ${yearMonth}
      ORDER BY COALESCE(contract.startDate, contract.createdAt) DESC, contract.id DESC
      LIMIT 200
    `),
    db.execute(sql`
      SELECT credit.sourceId
      FROM performance_business_sales_attributions credit
      LEFT JOIN performance_business_sales_attributions reversal
        ON reversal.reversesAttributionId = credit.id
        AND reversal.entryType = 'reversal' AND reversal.status = 'confirmed'
      WHERE credit.sourceType = 'brand_contract'
        AND credit.entryType = 'credit' AND credit.status = 'confirmed'
        AND reversal.id IS NULL
      GROUP BY credit.sourceId
    `),
  ]);
  const activeContractSourceIds = new Set(
    rowsOf<any>(activeContractAttributionResult).map(row => String(row.sourceId)),
  );
  return {
    yearMonth,
    rows: rowsOf<any>(attributionResult).map(row => ({
      ...row,
      id: Number(row.id),
      staffId: Number(row.staffId),
      storeId: row.storeId ? Number(row.storeId) : null,
      brandId: row.brandId ? Number(row.brandId) : null,
      amount: Number(row.amount || 0),
      evidence: parseJson(row.evidenceJson, {}),
      reversesAttributionId: row.reversesAttributionId ? Number(row.reversesAttributionId) : null,
    })),
    staff: rowsOf<any>(staffResult).map(row => ({ ...row, id: Number(row.id) })),
    stores: rowsOf<any>(storeResult).map(row => ({
      ...row,
      id: Number(row.id),
      brandId: row.brandId ? Number(row.brandId) : null,
      brandIds: String(row.brandIdsCsv || row.brandId || "")
        .split(",")
        .map(Number)
        .filter(value => Number.isSafeInteger(value) && value > 0),
      brandNames: String(row.brandName || "")
        .split(" / ")
        .map(value => value.trim())
        .filter(Boolean),
    })),
    unattributedContracts: rowsOf<any>(contractResult)
      .filter(row => !activeContractSourceIds.has(String(row.id)))
      .map(row => ({
        ...row,
        id: Number(row.id),
        brandId: Number(row.brandId),
        fixedFee: Number(row.fixedFee || 0),
        currency: String(row.currency || "JPY").toUpperCase(),
      })),
    safety: {
      createdByIsNotOwner: true,
      storeGmvIsNeverAllocated: true,
      livestreamGmvIsNeverAllocated: true,
      confirmedStaffIdRequired: true,
      immutableReversalOnly: true,
    },
  };
}

export async function createBusinessSalesAttribution(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: {
    staffId: number;
    storeId: number;
    brandId?: number | null;
    sourceType: "brand_contract" | "manual_confirmed" | "order";
    sourceId: string;
    businessDate?: string | null;
    currency?: string | null;
    amount?: number | null;
    evidenceReference?: string | null;
    note?: string | null;
    requestId: string;
  },
) {
  requirePerformanceAdmin(access);
  await ensurePerformanceInitialized(db, access.userId);
  const member = rowsOf<any>(await db.execute(sql`
    SELECT id, name FROM staff
    WHERE id = ${input.staffId} AND isActive = 'active'
      AND archivedAt IS NULL AND mergedIntoStaffId IS NULL LIMIT 1
  `))[0];
  if (!member) throw new TRPCError({ code: "BAD_REQUEST", message: "归属员工不存在或已归档" });
  const store = rowsOf<any>(await db.execute(sql`
    SELECT store.id, store.name, store.brandId,
      GROUP_CONCAT(relation.brandId ORDER BY relation.isPrimary DESC, relation.brandId) AS brandIdsCsv
    FROM managed_stores store
    LEFT JOIN managed_store_brands relation ON relation.storeId = store.id
    WHERE store.id = ${input.storeId} AND store.isActive = 1
    GROUP BY store.id, store.name, store.brandId
    LIMIT 1
  `))[0];
  if (!store) throw new TRPCError({ code: "BAD_REQUEST", message: "店铺不存在或已归档" });

  let sourceId = input.sourceId.trim();
  let businessDate = String(input.businessDate || "");
  let currency = String(input.currency || "JPY").trim().toUpperCase();
  let amount = Number(input.amount || 0);
  const storeBrandIds = String(store.brandIdsCsv || store.brandId || "")
    .split(",")
    .map(Number)
    .filter(value => Number.isSafeInteger(value) && value > 0);
  let brandId = input.brandId ? Number(input.brandId) : null;
  if (brandId && !storeBrandIds.includes(brandId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "所选品牌不属于该店铺" });
  }
  let evidence: Record<string, unknown>;

  if (!sourceId) throw new TRPCError({ code: "BAD_REQUEST", message: "必须填写可追溯业务证据编号" });
  if (input.sourceType === "brand_contract") {
    const contractId = Number(sourceId);
    if (!Number.isInteger(contractId) || contractId <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "合同证据编号无效" });
    }
    const contract = rowsOf<any>(await db.execute(sql`
      SELECT id, brandId, fixedFee, currency,
        DATE_FORMAT(COALESCE(startDate, createdAt), '%Y-%m-%d') AS businessDate,
        status
      FROM brand_contracts
      WHERE id = ${contractId} AND deletedAt IS NULL AND fixedFee IS NOT NULL
      LIMIT 1
    `))[0];
    if (!contract || Number(contract.fixedFee || 0) <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "合同不存在或没有可确认金额" });
    }
    brandId = Number(contract.brandId);
    if (!storeBrandIds.includes(brandId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "所选店铺与合同品牌不一致，系统不会自动猜测店铺" });
    }
    amount = Number(contract.fixedFee);
    currency = String(contract.currency || "JPY").toUpperCase();
    businessDate = String(contract.businessDate);
    sourceId = String(contract.id);
    evidence = {
      sourceType: "brand_contract",
      contractId: Number(contract.id),
      contractStatus: String(contract.status),
      staffSelectedByAdmin: true,
      createdByIgnoredForAttribution: true,
      note: String(input.note || "").trim() || null,
    };
  } else {
    if (!brandId && storeBrandIds.length > 1) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "该店铺关联多个品牌，请明确选择本次销售所属品牌" });
    }
    brandId = brandId || storeBrandIds[0] || null;
    if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(businessDate)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "业务日期必须为YYYY-MM-DD" });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "销售金额必须大于0" });
    }
    if (!/^[A-Z]{3,10}$/.test(currency)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "币种格式无效" });
    }
    const evidenceReference = String(input.evidenceReference || "").trim();
    if (evidenceReference.length < 5) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "必须填写至少5个字符的成交/订单证据" });
    }
    evidence = {
      sourceType: input.sourceType,
      reference: evidenceReference,
      staffSelectedByAdmin: true,
      note: String(input.note || "").trim() || null,
    };
  }

  const sourceIdentity = `${input.sourceType}:${sourceId}`;
  return db.transaction(async tx => {
    const duplicateRequest = rowsOf<any>(await tx.execute(sql`
      SELECT id FROM performance_business_sales_attributions WHERE requestId = ${input.requestId} LIMIT 1
    `))[0];
    if (duplicateRequest) return { id: Number(duplicateRequest.id), duplicate: true };
    const sourceCredits = rowsOf<any>(await tx.execute(sql`
      SELECT credit.id, credit.staffId,
        EXISTS(
          SELECT 1 FROM performance_business_sales_attributions reversal
          WHERE reversal.reversesAttributionId = credit.id
            AND reversal.entryType = 'reversal' AND reversal.status = 'confirmed'
        ) AS hasReversal
      FROM performance_business_sales_attributions credit
      WHERE credit.sourceType = ${input.sourceType} AND credit.sourceId = ${sourceId}
        AND credit.entryType = 'credit' AND credit.status = 'confirmed'
      ORDER BY credit.id FOR UPDATE
    `));
    if (sourceCredits.some(row => !Boolean(Number(row.hasReversal)))) {
      throw new TRPCError({ code: "CONFLICT", message: "该成交/合同证据已经归属，不能重复或拆给其他员工" });
    }
    const attributionRevision = sourceCredits.length + 1;
    const attributionKey = createHash("sha256")
      .update(`${sourceIdentity}:credit:v${attributionRevision}`)
      .digest("hex");
    const inserted = await tx.execute(sql`
      INSERT INTO performance_business_sales_attributions (
        attributionKey, staffId, storeId, brandId, sourceType, sourceId,
        businessDate, currency, amount, entryType, status, reliability,
        evidenceJson, confirmedByUserId, confirmedByStaffId, requestId
      ) VALUES (
        ${attributionKey}, ${input.staffId}, ${input.storeId}, ${brandId},
        ${input.sourceType}, ${sourceId}, ${businessDate}, ${currency}, ${amount},
        'credit', 'confirmed', 'admin_confirmed', ${JSON.stringify(evidence)},
        ${access.userId}, ${access.staffId}, ${input.requestId}
      )
    `);
    const id = Number((inserted as any)?.[0]?.insertId || 0);
    const afterState = {
      id,
      staffId: input.staffId,
      storeId: input.storeId,
      brandId,
      sourceType: input.sourceType,
      sourceId,
      businessDate,
      currency,
      amount,
      entryType: "credit",
      status: "confirmed",
      reliability: "admin_confirmed",
      attributionRevision,
    };
    await appendAudit(tx as any, access, {
      requestId: input.requestId,
      entityId: String(id),
      action: "confirm_attribution",
      afterState,
    });
    return { ...afterState, duplicate: false };
  });
}

export async function reverseBusinessSalesAttribution(
  db: PerformanceDatabase,
  access: PerformanceAccess,
  input: { attributionId: number; businessDate: string; reason: string; requestId: string },
) {
  requirePerformanceAdmin(access);
  await ensurePerformanceInitialized(db, access.userId);
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(input.businessDate)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "冲销日期必须为YYYY-MM-DD" });
  }
  const reason = input.reason.trim();
  if (reason.length < 5) throw new TRPCError({ code: "BAD_REQUEST", message: "冲销理由至少5个字符" });
  return db.transaction(async tx => {
    const original = rowsOf<any>(await tx.execute(sql`
      SELECT * FROM performance_business_sales_attributions
      WHERE id = ${input.attributionId} AND entryType = 'credit' AND status = 'confirmed'
      LIMIT 1 FOR UPDATE
    `))[0];
    if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "原销售归属不存在或不可冲销" });
    const existingReversal = rowsOf<any>(await tx.execute(sql`
      SELECT id FROM performance_business_sales_attributions
      WHERE reversesAttributionId = ${input.attributionId} AND entryType = 'reversal' LIMIT 1
    `))[0];
    if (existingReversal) return { id: Number(existingReversal.id), duplicate: true };
    const attributionKey = createHash("sha256").update(`reversal:${input.attributionId}`).digest("hex");
    const evidence = {
      sourceType: "reversal",
      reversesAttributionId: input.attributionId,
      reason,
      originalEvidence: parseJson(original.evidenceJson, {}),
    };
    const inserted = await tx.execute(sql`
      INSERT INTO performance_business_sales_attributions (
        attributionKey, staffId, storeId, brandId, sourceType, sourceId,
        businessDate, currency, amount, entryType, reversesAttributionId,
        status, reliability, evidenceJson, confirmedByUserId,
        confirmedByStaffId, requestId
      ) VALUES (
        ${attributionKey}, ${Number(original.staffId)}, ${original.storeId ? Number(original.storeId) : null},
        ${original.brandId ? Number(original.brandId) : null}, 'reversal', ${String(input.attributionId)},
        ${input.businessDate}, ${String(original.currency)}, ${Number(original.amount)},
        'reversal', ${input.attributionId}, 'confirmed', 'admin_confirmed',
        ${JSON.stringify(evidence)}, ${access.userId}, ${access.staffId}, ${input.requestId}
      )
    `);
    const id = Number((inserted as any)?.[0]?.insertId || 0);
    await appendAudit(tx as any, access, {
      requestId: input.requestId,
      entityId: String(id),
      action: "reverse_attribution",
      beforeState: {
        attributionId: Number(original.id),
        staffId: Number(original.staffId),
        storeId: original.storeId ? Number(original.storeId) : null,
        businessDate: String(original.businessDate),
        currency: String(original.currency),
        amount: Number(original.amount),
      },
      afterState: { id, reversesAttributionId: input.attributionId, businessDate: input.businessDate, reason },
    });
    return { id, duplicate: false };
  });
}
