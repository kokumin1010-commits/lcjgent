import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { getStaffIdentityUpgradeHealth } from "./migrations/upgradeStaffIdentityConsistency";
import {
  ensureReportProfileForStaff,
  mergeStaffIdentity,
  previewStaffIdentityMerge,
  STAFF_IDENTITY_MERGE_CONFIRMATION,
} from "./staffIdentityConsistency";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { getDatabaseBackupHealth, runDatabaseBackup } from "./databaseBackupScheduler";

function actorName(user: { id: number; name?: string | null; email?: string | null }): string {
  return String(user.name || user.email || `user:${user.id}`).slice(0, 255);
}

export const staffIdentityRouter = router({
  health: adminProcedure.query(async () => getStaffIdentityUpgradeHealth()),

  createBackup: adminProcedure
    .input(z.object({ phase: z.enum(["pre", "post"]) }))
    .mutation(async ({ input }) => {
      const reason = input.phase === "pre" ? "pre-staff-identity-merge" : "post-staff-identity-merge";
      await runDatabaseBackup(reason, { force: true, waitForActive: true });
      const health = await getDatabaseBackupHealth();
      if (!health.latestSuccess || health.latestSuccess.reason !== reason) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `required ${input.phase}-merge backup did not complete` });
      }
      return {
        backupId: health.latestSuccess.id,
        reason: health.latestSuccess.reason,
        completedAt: health.latestSuccess.completedAt,
        tableCount: health.latestSuccess.tableCount,
        rowCount: health.latestSuccess.rowCount,
        checksum: health.latestSuccess.checksum,
      };
    }),

  previewMerge: adminProcedure
    .input(z.object({ canonicalStaffId: z.number().int().positive(), duplicateStaffId: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        return await previewStaffIdentityMerge(input.canonicalStaffId, input.duplicateStaffId);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),

  merge: adminProcedure
    .input(z.object({
      canonicalStaffId: z.number().int().positive(),
      duplicateStaffId: z.number().int().positive(),
      expectedIdentityKey: z.string().min(8).max(384),
      backupId: z.number().int().positive(),
      confirmation: z.literal(STAFF_IDENTITY_MERGE_CONFIRMATION),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await mergeStaffIdentity({
          canonicalStaffId: input.canonicalStaffId,
          duplicateStaffId: input.duplicateStaffId,
          expectedIdentityKey: input.expectedIdentityKey,
          backupId: input.backupId,
          actor: { id: ctx.user.id, name: actorName(ctx.user) },
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),

  ensureReportProfile: adminProcedure
    .input(z.object({ staffId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await ensureReportProfileForStaff({
          staffId: input.staffId,
          actor: { id: ctx.user.id, name: actorName(ctx.user) },
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }),

  audit: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).default({ limit: 30 }))
    .query(async ({ input }) => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DATABASE_URL is required" });
      const pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2, waitForConnections: true });
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id,canonicalStaffId,duplicateStaffId,identityKey,backupId,actorId,actorName,status,
                  referenceCountsBefore,movedCounts,details,startedAt,completedAt,errorMessage
             FROM staff_identity_merge_events ORDER BY id DESC LIMIT ?`,
          [input.limit],
        );
        return rows;
      } finally {
        await pool.end();
      }
    }),
});
