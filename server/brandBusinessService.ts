import mysql, { type PoolConnection, type RowDataPacket } from "mysql2/promise";
import {
  BRAND_BD_STAGE_VALUES,
  BRAND_DEAL_MODEL_VALUES,
  businessMonthUtcRange,
  canTransitionBrandBdStage,
  defaultBrandFollowUpAt,
  normalizeBrandDealTerms,
  type BrandBdStage,
  type BrandDealModel,
} from "../shared/brandBusiness";
import { ensureBrandBusinessUpgradeReady } from "./brandBusinessUpgrade";

let poolInstance: ReturnType<typeof mysql.createPool> | null = null;
function getPool() {
  if (!poolInstance) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    poolInstance = mysql.createPool({ uri: process.env.DATABASE_URL, waitForConnections: true, connectionLimit: 5, timezone: "Z" });
  }
  return poolInstance;
}

export type BrandBusinessActor = { id: number; name?: string | null };

export type SaveBrandDealInput = {
  brandId: number;
  stage: BrandBdStage;
  dealModel?: BrandDealModel | null;
  slotFeeAmount?: number | null;
  guaranteedRoi?: number | null;
  pureCommissionRate?: number | null;
  lastContactAt?: string | null;
  nextFollowUpAt?: string | null;
  nextAction?: string | null;
  negotiationNotes?: string | null;
};

export type SaveMonthlyTargetInput = {
  year: number;
  month: number;
  newBrandTarget: number;
  contactTarget: number;
  negotiationTarget: number;
  contractTarget: number;
  slotFeeContractTarget: number;
  slotFeeRevenueTarget: number;
  goalNote?: string | null;
};

function cleanText(value: string | null | undefined, maxLength: number): string | null {
  const cleaned = String(value || "").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function toSqlDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("invalid business date");
  return date;
}

function publicDeal(row: any) {
  return {
    id: Number(row.id),
    brandId: Number(row.brandId),
    brandName: String(row.brandName || ""),
    stage: String(row.stage) as BrandBdStage,
    dealModel: row.dealModel ? String(row.dealModel) as BrandDealModel : null,
    slotFeeAmount: row.slotFeeAmount == null ? null : Number(row.slotFeeAmount),
    guaranteedRoi: row.guaranteedRoi == null ? null : Number(row.guaranteedRoi),
    pureCommissionRate: row.pureCommissionRate == null ? null : Number(row.pureCommissionRate),
    lastContactAt: row.lastContactAt ? new Date(row.lastContactAt).toISOString() : null,
    nextFollowUpAt: row.nextFollowUpAt ? new Date(row.nextFollowUpAt).toISOString() : null,
    nextAction: row.nextAction ? String(row.nextAction) : null,
    negotiationNotes: row.negotiationNotes ? String(row.negotiationNotes) : null,
    agreedAt: row.agreedAt ? new Date(row.agreedAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function insertAudit(
  connection: PoolConnection,
  input: { entityType: string; entityId?: number | null; brandId?: number | null; action: string; before: unknown; after: unknown },
  actor: BrandBusinessActor,
) {
  await connection.query(
    `INSERT INTO brand_business_audit_logs
       (entityType,entityId,brandId,action,beforeJson,afterJson,actorId,actorName)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      input.entityType,
      input.entityId ?? null,
      input.brandId ?? null,
      input.action,
      JSON.stringify(input.before ?? null),
      JSON.stringify(input.after ?? null),
      actor.id,
      cleanText(actor.name, 255),
    ],
  );
}

async function insertBusinessEvent(
  connection: PoolConnection,
  event: {
    brandId: number;
    eventType: "contacted" | "entered_negotiation" | "contract_signed";
    fromStage: BrandBdStage | null;
    toStage: BrandBdStage;
    dealModel?: BrandDealModel | null;
    slotFeeAmount?: number | null;
    guaranteedRoi?: number | null;
    pureCommissionRate?: number | null;
    occurredAt: Date;
  },
  actor: BrandBusinessActor,
) {
  await connection.query(
    `INSERT INTO brand_business_events
       (brandId,eventType,fromStage,toStage,dealModel,slotFeeAmount,guaranteedRoi,pureCommissionRate,occurredAt,actorId,actorName)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [event.brandId, event.eventType, event.fromStage, event.toStage, event.dealModel || null,
      event.slotFeeAmount ?? null, event.guaranteedRoi ?? null, event.pureCommissionRate ?? null,
      event.occurredAt, actor.id, cleanText(actor.name, 255)],
  );
}

export async function getBrandBusinessOverview(year: number, month: number) {
  await ensureBrandBusinessUpgradeReady();
  const pool = getPool();
  const { start, end } = businessMonthUtcRange(year, month);
  const [dealRows] = await pool.query<RowDataPacket[]>(
    `SELECT d.*,b.name AS brandName
       FROM brand_business_deals d
       JOIN brands b ON b.id=d.brandId
      WHERE b.deletedAt IS NULL
      ORDER BY d.updatedAt DESC`,
  );
  const [targetRows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM brand_business_monthly_targets WHERE year=? AND month=? LIMIT 1",
    [year, month],
  );
  const [newRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM brands WHERE deletedAt IS NULL AND createdAt>=? AND createdAt<?",
    [start, end],
  );
  const [activeBrandRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM brands WHERE deletedAt IS NULL",
  );
  const [contactRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT e.brandId) AS count
       FROM brand_business_events e
       JOIN brands b ON b.id=e.brandId AND b.deletedAt IS NULL
      WHERE e.eventType='contacted' AND e.occurredAt>=? AND e.occurredAt<?`,
    [start, end],
  );
  const [negotiationRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT brandId) AS count
       FROM brand_business_events e
       JOIN brands b ON b.id=e.brandId AND b.deletedAt IS NULL
      WHERE e.eventType='entered_negotiation' AND e.occurredAt>=? AND e.occurredAt<?`,
    [start, end],
  );
  const [contractRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count,
            SUM(CASE WHEN dealModel='slot_fee' THEN 1 ELSE 0 END) AS slotFeeCount,
            SUM(CASE WHEN dealModel='slot_fee' THEN COALESCE(slotFeeAmount,0) ELSE 0 END) AS slotFeeRevenue
       FROM brand_business_events e
       JOIN brands b ON b.id=e.brandId AND b.deletedAt IS NULL
      WHERE e.eventType='contract_signed' AND e.occurredAt>=? AND e.occurredAt<?`,
    [start, end],
  );
  const [overdueRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM brand_business_deals d
       JOIN brands b ON b.id=d.brandId AND b.deletedAt IS NULL
      WHERE d.stage NOT IN ('contracted','lost') AND d.nextFollowUpAt IS NOT NULL AND d.nextFollowUpAt<CURRENT_TIMESTAMP`,
  );
  const [noActionRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count
       FROM brands b
       LEFT JOIN brand_business_deals d ON d.brandId=b.id
      WHERE b.deletedAt IS NULL
        AND (d.id IS NULL OR (d.stage NOT IN ('contracted','lost') AND (d.nextAction IS NULL OR TRIM(d.nextAction)='')))`,
  );

  const target = targetRows[0] ? {
    id: Number(targetRows[0].id),
    year: Number(targetRows[0].year),
    month: Number(targetRows[0].month),
    newBrandTarget: Number(targetRows[0].newBrandTarget || 0),
    contactTarget: Number(targetRows[0].contactTarget || 0),
    negotiationTarget: Number(targetRows[0].negotiationTarget || 0),
    contractTarget: Number(targetRows[0].contractTarget || 0),
    slotFeeContractTarget: Number(targetRows[0].slotFeeContractTarget || 0),
    slotFeeRevenueTarget: Number(targetRows[0].slotFeeRevenueTarget || 0),
    goalNote: targetRows[0].goalNote ? String(targetRows[0].goalNote) : null,
  } : {
    id: null,
    year,
    month,
    newBrandTarget: 0,
    contactTarget: 0,
    negotiationTarget: 0,
    contractTarget: 0,
    slotFeeContractTarget: 0,
    slotFeeRevenueTarget: 0,
    goalNote: null,
  };

  return {
    year,
    month,
    strategy: ["slot_fee", "guaranteed_roi", "pure_commission"] as BrandDealModel[],
    target,
    actual: {
      newBrands: Number(newRows[0]?.count || 0),
      contactedBrands: Number(contactRows[0]?.count || 0),
      negotiations: Number(negotiationRows[0]?.count || 0),
      contracts: Number(contractRows[0]?.count || 0),
      slotFeeContracts: Number(contractRows[0]?.slotFeeCount || 0),
      slotFeeRevenue: Number(contractRows[0]?.slotFeeRevenue || 0),
    },
    risks: {
      overdueFollowUps: Number(overdueRows[0]?.count || 0),
      missingNextActions: Number(noActionRows[0]?.count || 0),
    },
    pipeline: BRAND_BD_STAGE_VALUES.map(stage => ({
      stage,
      count: dealRows.filter(row => String(row.stage) === stage).length
        + (stage === "new_lead" ? Math.max(0, Number(activeBrandRows[0]?.count || 0) - dealRows.length) : 0),
    })),
    deals: dealRows.map(publicDeal),
  };
}

export async function saveBrandBusinessDeal(input: SaveBrandDealInput, actor: BrandBusinessActor) {
  await ensureBrandBusinessUpgradeReady();
  if (!BRAND_BD_STAGE_VALUES.includes(input.stage)) throw new Error("invalid BD stage");
  if (input.dealModel && !BRAND_DEAL_MODEL_VALUES.includes(input.dealModel)) throw new Error("invalid deal model");
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [brandRows] = await connection.query<RowDataPacket[]>(
      "SELECT id FROM brands WHERE id=? AND deletedAt IS NULL FOR UPDATE",
      [input.brandId],
    );
    if (!brandRows[0]) throw new Error("brand not found");
    const [beforeRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM brand_business_deals WHERE brandId=? FOR UPDATE",
      [input.brandId],
    );
    const before = beforeRows[0] || null;
    const fromStage = (before?.stage ? String(before.stage) : "new_lead") as BrandBdStage;
    if (!canTransitionBrandBdStage(fromStage, input.stage)) {
      throw new Error(`invalid BD stage transition: ${fromStage}->${input.stage}`);
    }
    const savedAt = new Date();
    const activeStage = !["contracted", "lost"].includes(input.stage);
    const nextAction = cleanText(input.nextAction, 2000);
    const requestedFollowUpAt = toSqlDate(input.nextFollowUpAt);
    const nextFollowUpAt = activeStage ? requestedFollowUpAt || defaultBrandFollowUpAt(savedAt) : null;
    const lastContactAt = savedAt;
    if (activeStage && !nextAction) {
      throw new Error("active BD stages require a next action");
    }
    if (input.stage === "slot_fee" && !(Number(input.slotFeeAmount) > 0)) {
      throw new Error("slot fee stage requires a proposed amount");
    }
    if (input.stage === "guaranteed_roi" && Number(input.guaranteedRoi) !== 2) {
      throw new Error("guaranteed ROI stage is fixed at 1:2");
    }
    if (input.stage === "pure_commission" && !(Number(input.pureCommissionRate) > 0 && Number(input.pureCommissionRate) <= 100)) {
      throw new Error("pure commission stage requires a rate between 0 and 100");
    }
    if (input.stage === "contracted") {
      const expectedModel: BrandDealModel = fromStage === "slot_fee"
        ? "slot_fee"
        : fromStage === "guaranteed_roi"
          ? "guaranteed_roi"
          : fromStage === "pure_commission"
            ? "pure_commission"
            : fromStage === "contracted" && before?.dealModel && BRAND_DEAL_MODEL_VALUES.includes(String(before.dealModel) as BrandDealModel)
              ? String(before.dealModel) as BrandDealModel
              : (() => { throw new Error("contract must follow an active negotiation stage"); })();
      if (input.dealModel !== expectedModel) throw new Error("contract model must match the completed negotiation stage");
      if (expectedModel === "slot_fee" && !(Number(input.slotFeeAmount) > 0)) throw new Error("slot fee contract requires an amount");
      if (expectedModel === "guaranteed_roi" && Number(input.guaranteedRoi) !== 2) throw new Error("ROI contract is fixed at 1:2");
      if (expectedModel === "pure_commission" && !(Number(input.pureCommissionRate) > 0 && Number(input.pureCommissionRate) <= 100)) throw new Error("commission contract requires a rate");
    }
    const agreedAt = input.stage === "contracted"
      ? before?.agreedAt || new Date()
      : before?.agreedAt || null;
    const stageDealModel: BrandDealModel | null = input.stage === "slot_fee"
      ? "slot_fee"
      : input.stage === "guaranteed_roi"
        ? "guaranteed_roi"
        : input.stage === "pure_commission"
          ? "pure_commission"
          : input.dealModel || null;
    const normalizedTerms = normalizeBrandDealTerms({
      dealModel: stageDealModel,
      slotFeeAmount: input.slotFeeAmount,
      guaranteedRoi: input.guaranteedRoi,
      pureCommissionRate: input.pureCommissionRate,
    });
    const values = {
      stage: input.stage,
      dealModel: normalizedTerms.dealModel,
      slotFeeAmount: normalizedTerms.slotFeeAmount,
      guaranteedRoi: normalizedTerms.guaranteedRoi,
      pureCommissionRate: normalizedTerms.pureCommissionRate,
      lastContactAt,
      nextFollowUpAt,
      nextAction,
      negotiationNotes: cleanText(input.negotiationNotes, 10000),
      agreedAt,
    };
    await connection.query(
      `INSERT INTO brand_business_deals
         (brandId,stage,dealModel,slotFeeAmount,guaranteedRoi,pureCommissionRate,lastContactAt,nextFollowUpAt,nextAction,negotiationNotes,agreedAt,createdBy,updatedBy)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         stage=VALUES(stage),dealModel=VALUES(dealModel),slotFeeAmount=VALUES(slotFeeAmount),
         guaranteedRoi=VALUES(guaranteedRoi),pureCommissionRate=VALUES(pureCommissionRate),
         lastContactAt=VALUES(lastContactAt),nextFollowUpAt=VALUES(nextFollowUpAt),
         nextAction=VALUES(nextAction),negotiationNotes=VALUES(negotiationNotes),agreedAt=VALUES(agreedAt),updatedBy=VALUES(updatedBy)`,
      [input.brandId, values.stage, values.dealModel, values.slotFeeAmount, values.guaranteedRoi,
        values.pureCommissionRate, values.lastContactAt, values.nextFollowUpAt, values.nextAction,
        values.negotiationNotes, values.agreedAt, actor.id, actor.id],
    );
    const [afterRows] = await connection.query<RowDataPacket[]>(
      `SELECT d.*,b.name AS brandName FROM brand_business_deals d JOIN brands b ON b.id=d.brandId WHERE d.brandId=? LIMIT 1`,
      [input.brandId],
    );
    const after = publicDeal(afterRows[0]);
    const priorContact = before?.lastContactAt ? new Date(before.lastContactAt).getTime() : null;
    if (lastContactAt && lastContactAt.getTime() !== priorContact) {
      await insertBusinessEvent(connection, {
        brandId: input.brandId, eventType: "contacted", fromStage, toStage: input.stage,
        occurredAt: lastContactAt,
      }, actor);
    }
    const negotiationStages: BrandBdStage[] = ["slot_fee", "guaranteed_roi", "pure_commission"];
    if (!negotiationStages.includes(fromStage) && negotiationStages.includes(input.stage)) {
      await insertBusinessEvent(connection, {
        brandId: input.brandId, eventType: "entered_negotiation", fromStage, toStage: input.stage,
        occurredAt: lastContactAt || new Date(),
      }, actor);
    }
    if (fromStage !== "contracted" && input.stage === "contracted") {
      await insertBusinessEvent(connection, {
        brandId: input.brandId, eventType: "contract_signed", fromStage, toStage: input.stage,
        dealModel: values.dealModel, slotFeeAmount: values.slotFeeAmount,
        guaranteedRoi: values.guaranteedRoi, pureCommissionRate: values.pureCommissionRate,
        occurredAt: agreedAt || new Date(),
      }, actor);
    }
    await insertAudit(connection, {
      entityType: "deal",
      entityId: after.id,
      brandId: input.brandId,
      action: "deal_saved",
      before: before ? publicDeal({ ...before, brandName: after.brandName }) : null,
      after,
    }, actor);
    await connection.commit();
    return after;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function saveBrandBusinessMonthlyTarget(input: SaveMonthlyTargetInput, actor: BrandBusinessActor) {
  await ensureBrandBusinessUpgradeReady();
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [beforeRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM brand_business_monthly_targets WHERE year=? AND month=? FOR UPDATE",
      [input.year, input.month],
    );
    await connection.query(
      `INSERT INTO brand_business_monthly_targets
         (year,month,newBrandTarget,contactTarget,negotiationTarget,contractTarget,slotFeeContractTarget,slotFeeRevenueTarget,goalNote,createdBy,updatedBy)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         newBrandTarget=VALUES(newBrandTarget),contactTarget=VALUES(contactTarget),
         negotiationTarget=VALUES(negotiationTarget),contractTarget=VALUES(contractTarget),
         slotFeeContractTarget=VALUES(slotFeeContractTarget),slotFeeRevenueTarget=VALUES(slotFeeRevenueTarget),
         goalNote=VALUES(goalNote),updatedBy=VALUES(updatedBy)`,
      [input.year, input.month, input.newBrandTarget, input.contactTarget, input.negotiationTarget,
        input.contractTarget, input.slotFeeContractTarget, input.slotFeeRevenueTarget,
        cleanText(input.goalNote, 5000), actor.id, actor.id],
    );
    const [afterRows] = await connection.query<RowDataPacket[]>(
      "SELECT * FROM brand_business_monthly_targets WHERE year=? AND month=? LIMIT 1",
      [input.year, input.month],
    );
    await insertAudit(connection, {
      entityType: "monthly_target",
      entityId: Number(afterRows[0].id),
      action: "monthly_target_saved",
      before: beforeRows[0] || null,
      after: afterRows[0],
    }, actor);
    await connection.commit();
    return { success: true, id: Number(afterRows[0].id) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
