import crypto from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  brandHistoricalGmvAuditLogs,
  brandHistoricalGmvRecords,
  brands,
} from "../drizzle/schema";
import { ensureBrandDataIntegrityReady } from "./brandDataIntegrityUpgrade";
import { getDb } from "./db";

export type HistoricalGmvActor = { id: number | null; name: string | null };
export type ManualHistoricalGmvInput = {
  brandId: number;
  amount: number;
  sourceLabel: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  notes?: string | null;
};

function cleanText(value: unknown, maxLength: number): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("invalid historical GMV date");
  return value;
}

function validateAmount(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 9_000_000_000_000) {
    throw new Error("historical GMV amount must be greater than zero");
  }
  return Math.round(value * 100) / 100;
}

function publicRecord(row: any) {
  return {
    id: Number(row.id),
    brandId: Number(row.brandId),
    sourceType: String(row.sourceType),
    sourceReference: row.sourceReference ? String(row.sourceReference) : null,
    sourceLabel: String(row.sourceLabel),
    amount: Number(row.amount || 0),
    currency: String(row.currency || "JPY"),
    periodStart: row.periodStart ? String(row.periodStart).slice(0, 10) : null,
    periodEnd: row.periodEnd ? String(row.periodEnd).slice(0, 10) : null,
    status: String(row.status),
    isLocked: Boolean(row.isLocked),
    sourceHash: row.sourceHash ? String(row.sourceHash) : null,
    evidence: row.evidence || null,
    notes: row.notes ? String(row.notes) : null,
    createdBy: row.createdBy == null ? null : Number(row.createdBy),
    updatedBy: row.updatedBy == null ? null : Number(row.updatedBy),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

async function assertActiveBrand(db: any, brandId: number) {
  const rows = await db.select({ id: brands.id }).from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.deletedAt)))
    .limit(1);
  if (!rows[0]) throw new Error("brand not found");
}

async function assertNoManualOverlap(
  db: any,
  brandId: number,
  periodStart: string | null,
  periodEnd: string | null,
  excludeId?: number,
) {
  if (Boolean(periodStart) !== Boolean(periodEnd)) throw new Error("both historical GMV period dates are required");
  if (periodStart && periodEnd && periodStart > periodEnd) throw new Error("historical GMV period start must not be after its end");
  const rows = await db.select().from(brandHistoricalGmvRecords)
    .where(and(
      eq(brandHistoricalGmvRecords.brandId, brandId),
      eq(brandHistoricalGmvRecords.sourceType, "manual"),
      eq(brandHistoricalGmvRecords.status, "active"),
      isNull(brandHistoricalGmvRecords.deletedAt),
    ));
  const existing = rows.filter((row: any) => Number(row.id) !== Number(excludeId || 0));
  if (!periodStart || !periodEnd) {
    if (existing.length > 0) throw new Error("an undated historical GMV baseline must be the only manual record");
    return;
  }
  const conflicts = existing.some((row: any) => {
    const start = row.periodStart ? String(row.periodStart).slice(0, 10) : null;
    const end = row.periodEnd ? String(row.periodEnd).slice(0, 10) : null;
    if (!start || !end) return true;
    return periodStart <= end && periodEnd >= start;
  });
  if (conflicts) throw new Error("historical GMV periods cannot overlap");
}

async function writeAudit(tx: any, input: {
  recordId: number | null;
  brandId: number;
  action: string;
  before: unknown;
  after: unknown;
  actor: HistoricalGmvActor;
}) {
  await tx.insert(brandHistoricalGmvAuditLogs).values({
    recordId: input.recordId,
    brandId: input.brandId,
    action: input.action,
    beforeJson: input.before ?? null,
    afterJson: input.after ?? null,
    actorId: input.actor.id,
    actorName: cleanText(input.actor.name, 255),
  });
}

export async function listBrandHistoricalGmv(brandId: number) {
  await ensureBrandDataIntegrityReady();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await assertActiveBrand(db, brandId);
  const rows = await db.select().from(brandHistoricalGmvRecords)
    .where(and(
      eq(brandHistoricalGmvRecords.brandId, brandId),
      eq(brandHistoricalGmvRecords.status, "active"),
      isNull(brandHistoricalGmvRecords.deletedAt),
    ))
    .orderBy(desc(brandHistoricalGmvRecords.periodEnd), desc(brandHistoricalGmvRecords.updatedAt));
  const records = rows.map(publicRecord);
  const larkRecords = records.filter(record => record.sourceType === "lark_reported_gmv");
  const manualRecords = records.filter(record => record.sourceType === "manual");
  const larkTotal = larkRecords.reduce((sum, record) => sum + record.amount, 0);
  const manualTotal = manualRecords.reduce((sum, record) => sum + record.amount, 0);
  return {
    records,
    // Lark is the authoritative baseline when present. Manual records remain
    // visible for review but are not added to it, preventing cross-source duplicates.
    total: larkRecords.length > 0 ? larkTotal : manualTotal,
    larkTotal,
    manualTotal,
    hasSourceConflict: larkRecords.length > 0 && manualRecords.length > 0,
  };
}

export async function createManualBrandHistoricalGmv(input: ManualHistoricalGmvInput, actor: HistoricalGmvActor) {
  await ensureBrandDataIntegrityReady();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const amount = validateAmount(input.amount);
  const sourceLabel = cleanText(input.sourceLabel, 255);
  if (!sourceLabel) throw new Error("historical GMV source is required");
  const periodStart = normalizeDate(input.periodStart);
  const periodEnd = normalizeDate(input.periodEnd);
  if (periodStart && periodEnd && periodStart > periodEnd) throw new Error("historical GMV period is invalid");

  return db.transaction(async (tx: any) => {
    await assertActiveBrand(tx, input.brandId);
    await tx.execute(sql`SELECT id FROM brands WHERE id=${input.brandId} AND deletedAt IS NULL FOR UPDATE`);
    await assertNoManualOverlap(tx, input.brandId, periodStart, periodEnd);
    const sourceReference = `manual:${crypto.randomUUID()}`;
    const [{ id }] = await tx.insert(brandHistoricalGmvRecords).values({
      brandId: input.brandId,
      sourceType: "manual",
      sourceReference,
      sourceLabel,
      amount: String(amount),
      currency: "JPY",
      periodStart,
      periodEnd,
      status: "active",
      isLocked: false,
      evidence: { enteredByUser: true },
      notes: cleanText(input.notes, 10000),
      createdBy: actor.id,
      updatedBy: actor.id,
    }).$returningId();
    const rows = await tx.select().from(brandHistoricalGmvRecords).where(eq(brandHistoricalGmvRecords.id, id)).limit(1);
    const after = publicRecord(rows[0]);
    await writeAudit(tx, { recordId: id, brandId: input.brandId, action: "manual_created", before: null, after, actor });
    return after;
  });
}

export async function updateManualBrandHistoricalGmv(
  id: number,
  input: Omit<ManualHistoricalGmvInput, "brandId">,
  actor: HistoricalGmvActor,
) {
  await ensureBrandDataIntegrityReady();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const amount = validateAmount(input.amount);
  const sourceLabel = cleanText(input.sourceLabel, 255);
  if (!sourceLabel) throw new Error("historical GMV source is required");
  const periodStart = normalizeDate(input.periodStart);
  const periodEnd = normalizeDate(input.periodEnd);
  if (periodStart && periodEnd && periodStart > periodEnd) throw new Error("historical GMV period is invalid");

  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM brand_historical_gmv_records WHERE id=${id} FOR UPDATE`);
    const beforeRows = await tx.select().from(brandHistoricalGmvRecords)
      .where(and(eq(brandHistoricalGmvRecords.id, id), isNull(brandHistoricalGmvRecords.deletedAt)))
      .limit(1);
    const beforeRow = beforeRows[0];
    if (!beforeRow) throw new Error("historical GMV record not found");
    if (beforeRow.isLocked || beforeRow.sourceType !== "manual") throw new Error("source-controlled historical GMV cannot be edited manually");
    await tx.execute(sql`SELECT id FROM brands WHERE id=${Number(beforeRow.brandId)} AND deletedAt IS NULL FOR UPDATE`);
    await assertNoManualOverlap(tx, Number(beforeRow.brandId), periodStart, periodEnd, id);
    await tx.update(brandHistoricalGmvRecords).set({
      sourceLabel,
      amount: String(amount),
      periodStart,
      periodEnd,
      notes: cleanText(input.notes, 10000),
      updatedBy: actor.id,
    }).where(eq(brandHistoricalGmvRecords.id, id));
    const afterRows = await tx.select().from(brandHistoricalGmvRecords).where(eq(brandHistoricalGmvRecords.id, id)).limit(1);
    const before = publicRecord(beforeRow);
    const after = publicRecord(afterRows[0]);
    await writeAudit(tx, { recordId: id, brandId: before.brandId, action: "manual_updated", before, after, actor });
    return after;
  });
}

export async function deleteManualBrandHistoricalGmv(id: number, actor: HistoricalGmvActor) {
  await ensureBrandDataIntegrityReady();
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM brand_historical_gmv_records WHERE id=${id} FOR UPDATE`);
    const rows = await tx.select().from(brandHistoricalGmvRecords)
      .where(and(eq(brandHistoricalGmvRecords.id, id), isNull(brandHistoricalGmvRecords.deletedAt)))
      .limit(1);
    const beforeRow = rows[0];
    if (!beforeRow) throw new Error("historical GMV record not found");
    if (beforeRow.isLocked || beforeRow.sourceType !== "manual") throw new Error("source-controlled historical GMV cannot be deleted manually");
    await tx.update(brandHistoricalGmvRecords).set({
      status: "deleted",
      deletedAt: new Date(),
      updatedBy: actor.id,
    }).where(eq(brandHistoricalGmvRecords.id, id));
    const before = publicRecord(beforeRow);
    await writeAudit(tx, { recordId: id, brandId: before.brandId, action: "manual_deleted", before, after: null, actor });
    return { success: true };
  });
}

export async function upsertLarkHistoricalGmv(input: {
  db: any;
  brandId: number;
  recordId: string;
  amount: number | null;
  sourceHash: string;
  sourceField: string | null;
  syncRunId: number;
}) {
  if (input.amount == null || !Number.isFinite(input.amount) || input.amount < 0) return { changed: false, skipped: true };
  // One current Lark baseline per brand. The source record ID lives in evidence/audit;
  // keeping it out of the unique key prevents a source-record replacement from double-counting.
  const sourceReference = "reported_gmv";
  return input.db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT id FROM brands WHERE id=${input.brandId} AND deletedAt IS NULL FOR UPDATE`);
    const rows = await tx.select().from(brandHistoricalGmvRecords)
      .where(and(
        eq(brandHistoricalGmvRecords.brandId, input.brandId),
        eq(brandHistoricalGmvRecords.sourceType, "lark_reported_gmv"),
        eq(brandHistoricalGmvRecords.sourceReference, sourceReference),
      )).limit(1);
    const before = rows[0] ? publicRecord(rows[0]) : null;
    const nextAmount = Math.round(input.amount! * 100) / 100;
    const unchanged = before
      && before.amount === nextAmount
      && before.sourceHash === input.sourceHash
      && before.status === "active";
    if (unchanged) return { changed: false, skipped: false };

    await tx.insert(brandHistoricalGmvRecords).values({
      brandId: input.brandId,
      sourceType: "lark_reported_gmv",
      sourceReference,
      sourceLabel: input.sourceField ? `Lark: ${input.sourceField}` : "Lark: GMV",
      amount: String(nextAmount),
      currency: "JPY",
      status: "active",
      isLocked: true,
      sourceHash: input.sourceHash,
      evidence: { recordId: input.recordId, sourceField: input.sourceField, syncRunId: input.syncRunId },
      deletedAt: null,
    }).onDuplicateKeyUpdate({ set: {
      sourceLabel: input.sourceField ? `Lark: ${input.sourceField}` : "Lark: GMV",
      amount: String(nextAmount),
      status: "active",
      isLocked: true,
      sourceHash: input.sourceHash,
      evidence: { recordId: input.recordId, sourceField: input.sourceField, syncRunId: input.syncRunId },
      deletedAt: null,
    }});
    const afterRows = await tx.select().from(brandHistoricalGmvRecords)
      .where(and(
        eq(brandHistoricalGmvRecords.brandId, input.brandId),
        eq(brandHistoricalGmvRecords.sourceType, "lark_reported_gmv"),
        eq(brandHistoricalGmvRecords.sourceReference, sourceReference),
      )).limit(1);
    const after = publicRecord(afterRows[0]);
    await writeAudit(tx, {
      recordId: after.id,
      brandId: input.brandId,
      action: before ? "lark_updated" : "lark_created",
      before,
      after,
      actor: { id: null, name: "system:lark-sync" },
    });
    return { changed: true, skipped: false };
  });
}
