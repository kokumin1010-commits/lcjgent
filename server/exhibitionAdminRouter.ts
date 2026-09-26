import { TRPCError } from "@trpc/server";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { router } from "./_core/trpc";
import { issueExhibitionPasswordToken } from "./exhibitionAuthRouter";
import {
  exhibitionAdminEditProcedure,
  exhibitionAdminViewProcedure,
  findActiveExhibitionEvent,
  getExhibitionPool,
  normalizeExhibitionEmail,
  sanitizeDownloadFileName,
  writeExhibitionAudit,
} from "./exhibitionBoothService";
import { storageGetPrivate } from "./storage";

const statusValue = z.enum(["invited", "active", "suspended"]);
const reviewStatusValue = z.enum([
  "draft",
  "submitted",
  "revision_required",
  "approved",
]);
const assetReviewValue = z.enum(["pending", "approved", "revision_required"]);

function actorId(ctx: any) {
  return Number(ctx.user?.id || 0) || null;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export const exhibitionAdminRouter = router({
  dashboard: exhibitionAdminViewProcedure.query(async () => {
    const pool = getExhibitionPool();
    const event = await findActiveExhibitionEvent(pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        (SELECT COUNT(*) FROM exhibition_accounts) AS accountCount,
        (SELECT COUNT(*) FROM exhibition_accounts WHERE status='active') AS activeAccountCount,
        (SELECT COUNT(*) FROM exhibition_brand_profiles WHERE eventId=?) AS profileCount,
        (SELECT COUNT(*) FROM exhibition_brand_profiles WHERE eventId=? AND reviewStatus='submitted') AS submittedCount,
        (SELECT COUNT(*) FROM exhibition_booth_assignments WHERE eventId=?) AS selectedCount,
        (SELECT COUNT(*) FROM exhibition_booth_assignments WHERE eventId=? AND status='confirmed') AS confirmedCount,
        (SELECT COUNT(*) FROM exhibition_booths WHERE eventId=? AND userSelectable=1 AND status='available') AS selectableCount,
        (SELECT COUNT(*) FROM exhibition_brand_assets asset JOIN exhibition_brand_profiles profile ON profile.id=asset.profileId WHERE profile.eventId=? AND asset.isCurrent=1 AND asset.reviewStatus='pending') AS pendingAssetCount`,
      [event.id, event.id, event.id, event.id, event.id, event.id]
    );
    return { event, counts: rows[0] || {} };
  }),

  listAccounts: exhibitionAdminViewProcedure
    .input(
      z.object({
        search: z.string().trim().max(120).optional(),
        status: statusValue.optional(),
        reviewStatus: reviewStatusValue.optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
    )
    .query(async ({ input }) => {
      const pool = getExhibitionPool();
      const event = await findActiveExhibitionEvent(pool);
      const where = ["profile.eventId=?"];
      const params: unknown[] = [event.id];
      if (input.search) {
        where.push(
          "(account.email LIKE ? OR account.displayName LIKE ? OR account.companyName LIKE ? OR profile.brandName LIKE ? OR booth.boothCode LIKE ?)"
        );
        const pattern = `%${input.search}%`;
        params.push(pattern, pattern, pattern, pattern, pattern);
      }
      if (input.status) {
        where.push("account.status=?");
        params.push(input.status);
      }
      if (input.reviewStatus) {
        where.push("profile.reviewStatus=?");
        params.push(input.reviewStatus);
      }
      params.push(input.limit);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT account.id,account.email,account.displayName,account.companyName,account.phone,account.status,account.lastLoginAt,account.createdAt,
                profile.id AS profileId,profile.brandId,profile.brandName,profile.contactName,profile.contactPhone,profile.category,profile.reviewStatus,profile.isPublic,profile.updatedAt,
                assignment.id AS assignmentId,assignment.status AS assignmentStatus,booth.id AS boothId,booth.boothCode,
                (SELECT COUNT(*) FROM exhibition_brand_assets asset WHERE asset.profileId=profile.id AND asset.isCurrent=1) AS currentAssetCount,
                (SELECT COUNT(*) FROM exhibition_brand_assets asset WHERE asset.profileId=profile.id AND asset.isCurrent=1 AND asset.reviewStatus='pending') AS pendingAssetCount
           FROM exhibition_accounts account
           JOIN exhibition_brand_profiles profile ON profile.accountId=account.id
           LEFT JOIN exhibition_booth_assignments assignment ON assignment.profileId=profile.id AND assignment.eventId=profile.eventId
           LEFT JOIN exhibition_booths booth ON booth.id=assignment.boothId
          WHERE ${where.join(" AND ")}
          ORDER BY profile.updatedAt DESC,account.id DESC LIMIT ?`,
        params
      );
      return { event, accounts: rows };
    }),

  getAccountDetail: exhibitionAdminViewProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const pool = getExhibitionPool();
      const [accountRows] = await pool.query<RowDataPacket[]>(
        `SELECT account.id AS accountId,account.email,account.displayName,account.companyName,account.phone,account.status,account.lastLoginAt,account.createdAt AS accountCreatedAt,account.updatedAt AS accountUpdatedAt,
                profile.id AS profileId,profile.eventId,profile.brandId,profile.brandName,profile.companyName AS profileCompanyName,
                profile.contactName,profile.contactEmail,profile.contactPhone,profile.websiteUrl,profile.category,profile.brandIntro,
                profile.mainProducts,profile.socialUrl,profile.tiktokUrl,profile.notes,profile.reviewStatus,profile.reviewNote,
                profile.isPublic,profile.reviewedByUserId,profile.reviewedAt,profile.createdAt AS profileCreatedAt,profile.updatedAt AS profileUpdatedAt
           FROM exhibition_accounts account
           LEFT JOIN exhibition_brand_profiles profile ON profile.accountId=account.id
          WHERE account.id=? ORDER BY profile.id DESC LIMIT 1`,
        [input.accountId]
      );
      const account = accountRows[0];
      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      const [assignmentRows, assetRows, auditRows] = await Promise.all([
        pool.query<RowDataPacket[]>(
          `SELECT assignment.*,booth.boothCode,booth.boothType FROM exhibition_booth_assignments assignment
             JOIN exhibition_booths booth ON booth.id=assignment.boothId
            WHERE assignment.profileId=? LIMIT 1`,
          [account.profileId]
        ),
        pool.query<RowDataPacket[]>(
          `SELECT id,assetType,originalFileName,mimeType,fileSize,fileSha256,versionNumber,isCurrent,reviewStatus,reviewNote,reviewedAt,createdAt
             FROM exhibition_brand_assets WHERE profileId=? ORDER BY assetType,versionNumber DESC`,
          [account.profileId]
        ),
        pool.query<RowDataPacket[]>(
          `SELECT id,actorType,actorId,action,beforeJson,afterJson,reason,createdAt
             FROM exhibition_audit_logs WHERE accountId=? OR profileId=? ORDER BY id DESC LIMIT 200`,
          [input.accountId, account.profileId]
        ),
      ]);
      return {
        account,
        assignment: assignmentRows[0][0] || null,
        assets: assetRows[0],
        audits: auditRows[0],
      };
    }),

  createAccount: exhibitionAdminEditProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email().max(320),
        displayName: z.string().trim().min(1).max(255),
        companyName: z.string().trim().min(1).max(255),
        phone: z.string().trim().max(80).optional(),
        brandName: z.string().trim().min(1).max(255),
        brandId: z.number().int().positive().optional(),
        sendInvite: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const event = await findActiveExhibitionEvent(pool);
      const email = normalizeExhibitionEmail(input.email);
      const connection = await pool.getConnection();
      let accountId = 0;
      let profileId = 0;
      try {
        await connection.beginTransaction();
        const [result] = await connection.query(
          `INSERT INTO exhibition_accounts
            (email,passwordHash,displayName,companyName,phone,status,createdByUserId)
           VALUES (?,NULL,?,?,?,'invited',?)`,
          [
            email,
            input.displayName,
            input.companyName,
            input.phone || null,
            actorId(ctx),
          ]
        );
        accountId = Number((result as any).insertId);
        const [profileResult] = await connection.query(
          `INSERT INTO exhibition_brand_profiles
            (eventId,accountId,brandId,brandName,companyName,contactName,contactEmail,contactPhone,reviewStatus)
           VALUES (?,?,?,?,?,?,?,?,'draft')`,
          [
            event.id,
            accountId,
            input.brandId || null,
            input.brandName,
            input.companyName,
            input.displayName,
            email,
            input.phone || null,
          ]
        );
        profileId = Number((profileResult as any).insertId);
        await writeExhibitionAudit({
          connection,
          eventId: Number(event.id),
          accountId,
          profileId,
          actorType: "admin",
          actorId: actorId(ctx),
          action: "account_created",
          after: {
            email,
            displayName: input.displayName,
            companyName: input.companyName,
            brandName: input.brandName,
          },
        });
        await connection.commit();
      } catch (error: any) {
        await connection.rollback();
        if (error?.code === "ER_DUP_ENTRY")
          throw new TRPCError({ code: "CONFLICT", message: "该邮箱已存在" });
        throw error;
      } finally {
        connection.release();
      }
      let invite: any = null;
      if (input.sendInvite) {
        invite = await issueExhibitionPasswordToken({
          accountId,
          email,
          displayName: input.displayName,
          purpose: "set_password",
          createdByUserId: actorId(ctx),
          req: ctx.req,
        });
      }
      return {
        success: true,
        accountId,
        profileId,
        inviteSent: Boolean(invite?.delivery?.success),
        inviteErrorCode: invite?.delivery?.errorCode || null,
      };
    }),

  resendInvite: exhibitionAdminEditProcedure
    .input(z.object({ accountId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id,email,displayName,status FROM exhibition_accounts WHERE id=? LIMIT 1`,
        [input.accountId]
      );
      const account = rows[0];
      if (!account)
        throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      if (account.status === "suspended")
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "停用账号不能发送邀请",
        });
      const invite = await issueExhibitionPasswordToken({
        accountId: Number(account.id),
        email: String(account.email),
        displayName: String(account.displayName),
        purpose:
          account.status === "invited" ? "set_password" : "reset_password",
        createdByUserId: actorId(ctx),
        req: ctx.req,
      });
      return {
        success: invite.delivery.success,
        errorCode: invite.delivery.errorCode || null,
      };
    }),

  updateAccountStatus: exhibitionAdminEditProcedure
    .input(
      z.object({
        accountId: z.number().int().positive(),
        status: statusValue,
        reason: z.string().trim().min(2).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT id,email,status,authVersion FROM exhibition_accounts WHERE id=? LIMIT 1 FOR UPDATE`,
          [input.accountId]
        );
        const account = rows[0];
        if (!account)
          throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
        await connection.query(
          `UPDATE exhibition_accounts SET status=?,authVersion=authVersion+1 WHERE id=?`,
          [input.status, input.accountId]
        );
        await writeExhibitionAudit({
          connection,
          accountId: input.accountId,
          actorType: "admin",
          actorId: actorId(ctx),
          action: "account_status_changed",
          before: { status: account.status },
          after: { status: input.status },
          reason: input.reason,
        });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  listBooths: exhibitionAdminViewProcedure.query(async () => {
    const pool = getExhibitionPool();
    const event = await findActiveExhibitionEvent(pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT booth.*,assignment.id AS assignmentId,assignment.profileId,assignment.status AS assignmentStatus,
              profile.brandName,profile.companyName,profile.reviewStatus,account.email
         FROM exhibition_booths booth
         LEFT JOIN exhibition_booth_assignments assignment ON assignment.eventId=booth.eventId AND assignment.boothId=booth.id
         LEFT JOIN exhibition_brand_profiles profile ON profile.id=assignment.profileId
         LEFT JOIN exhibition_accounts account ON account.id=profile.accountId
        WHERE booth.eventId=? ORDER BY booth.displayOrder,booth.id`,
      [event.id]
    );
    return { event, booths: rows };
  }),

  assignBooth: exhibitionAdminEditProcedure
    .input(
      z.object({
        profileId: z.number().int().positive(),
        boothId: z.number().int().positive(),
        status: z.enum(["selected", "confirmed"]).default("confirmed"),
        reason: z.string().trim().min(2).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const event = await findActiveExhibitionEvent(connection);
        const [profileRows] = await connection.query<RowDataPacket[]>(
          `SELECT id,accountId FROM exhibition_brand_profiles WHERE id=? AND eventId=? LIMIT 1 FOR UPDATE`,
          [input.profileId, event.id]
        );
        const profile = profileRows[0];
        if (!profile)
          throw new TRPCError({ code: "NOT_FOUND", message: "品牌资料不存在" });
        const [boothRows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM exhibition_booths WHERE id=? AND eventId=? LIMIT 1 FOR UPDATE`,
          [input.boothId, event.id]
        );
        const booth = boothRows[0];
        if (!booth || booth.boothType === "stage")
          throw new TRPCError({ code: "FORBIDDEN", message: "该区域不能分配" });
        const [occupiedRows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM exhibition_booth_assignments WHERE eventId=? AND boothId=? LIMIT 1 FOR UPDATE`,
          [event.id, input.boothId]
        );
        const occupied = occupiedRows[0];
        if (occupied && Number(occupied.profileId) !== input.profileId)
          throw new TRPCError({
            code: "CONFLICT",
            message: "该展位已被其他品牌占用",
          });
        const [ownRows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM exhibition_booth_assignments WHERE eventId=? AND profileId=? LIMIT 1 FOR UPDATE`,
          [event.id, input.profileId]
        );
        const own = ownRows[0];
        if (own && Number(own.boothId) !== input.boothId)
          await connection.query(
            `DELETE FROM exhibition_booth_assignments WHERE id=?`,
            [own.id]
          );
        if (occupied) {
          await connection.query(
            `UPDATE exhibition_booth_assignments SET status=?,confirmedAt=?,confirmedByUserId=? WHERE id=?`,
            [
              input.status,
              input.status === "confirmed" ? new Date() : null,
              input.status === "confirmed" ? actorId(ctx) : null,
              occupied.id,
            ]
          );
        } else {
          await connection.query(
            `INSERT INTO exhibition_booth_assignments (eventId,boothId,profileId,status,confirmedAt,confirmedByUserId) VALUES (?,?,?,?,?,?)`,
            [
              event.id,
              input.boothId,
              input.profileId,
              input.status,
              input.status === "confirmed" ? new Date() : null,
              input.status === "confirmed" ? actorId(ctx) : null,
            ]
          );
        }
        await writeExhibitionAudit({
          connection,
          eventId: Number(event.id),
          accountId: Number(profile.accountId),
          profileId: input.profileId,
          boothId: input.boothId,
          actorType: "admin",
          actorId: actorId(ctx),
          action: own ? "booth_reassigned_by_admin" : "booth_assigned_by_admin",
          before: own || null,
          after: { boothCode: booth.boothCode, status: input.status },
          reason: input.reason,
        });
        await connection.commit();
        return { success: true, boothCode: booth.boothCode };
      } catch (error: any) {
        await connection.rollback();
        if (error?.code === "ER_DUP_ENTRY")
          throw new TRPCError({
            code: "CONFLICT",
            message: "展位分配冲突，请刷新后重试",
          });
        throw error;
      } finally {
        connection.release();
      }
    }),

  releaseBooth: exhibitionAdminEditProcedure
    .input(
      z.object({
        profileId: z.number().int().positive(),
        reason: z.string().trim().min(2).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const event = await findActiveExhibitionEvent(connection);
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT assignment.*,profile.accountId FROM exhibition_booth_assignments assignment JOIN exhibition_brand_profiles profile ON profile.id=assignment.profileId WHERE assignment.profileId=? AND assignment.eventId=? LIMIT 1 FOR UPDATE`,
          [input.profileId, event.id]
        );
        const assignment = rows[0];
        if (!assignment)
          throw new TRPCError({ code: "NOT_FOUND", message: "该品牌没有展位" });
        await connection.query(
          `DELETE FROM exhibition_booth_assignments WHERE id=?`,
          [assignment.id]
        );
        await writeExhibitionAudit({
          connection,
          eventId: Number(assignment.eventId),
          accountId: Number(assignment.accountId),
          profileId: input.profileId,
          boothId: Number(assignment.boothId),
          actorType: "admin",
          actorId: actorId(ctx),
          action: "booth_released_by_admin",
          before: assignment,
          after: null,
          reason: input.reason,
        });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  updateBoothStatus: exhibitionAdminEditProcedure
    .input(
      z.object({
        boothId: z.number().int().positive(),
        status: z.enum(["available", "disabled"]),
        reason: z.string().trim().min(2).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const event = await findActiveExhibitionEvent(connection);
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM exhibition_booths WHERE id=? AND eventId=? LIMIT 1 FOR UPDATE`,
          [input.boothId, event.id]
        );
        const booth = rows[0];
        if (!booth)
          throw new TRPCError({ code: "NOT_FOUND", message: "展位不存在" });
        const [assignments] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM exhibition_booth_assignments WHERE eventId=? AND boothId=? LIMIT 1 FOR UPDATE`,
          [event.id, input.boothId]
        );
        if (input.status === "disabled" && assignments[0]) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "已分配的展位不能直接停用",
          });
        }
        await connection.query(
          `UPDATE exhibition_booths SET status=? WHERE id=? AND eventId=?`,
          [input.status, input.boothId, event.id]
        );
        await writeExhibitionAudit({
          connection,
          eventId: Number(event.id),
          boothId: input.boothId,
          actorType: "admin",
          actorId: actorId(ctx),
          action: "booth_status_changed",
          before: { status: booth.status },
          after: { status: input.status },
          reason: input.reason,
        });
        await connection.commit();
        return { success: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }),

  reviewProfile: exhibitionAdminEditProcedure
    .input(
      z.object({
        profileId: z.number().int().positive(),
        reviewStatus: reviewStatusValue,
        reviewNote: z.string().trim().max(5000).optional(),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM exhibition_brand_profiles WHERE id=? LIMIT 1`,
        [input.profileId]
      );
      const profile = rows[0];
      if (!profile)
        throw new TRPCError({ code: "NOT_FOUND", message: "品牌资料不存在" });
      if (input.reviewStatus === "revision_required" && !input.reviewNote)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退回修改时必须填写说明",
        });
      await pool.query(
        `UPDATE exhibition_brand_profiles SET reviewStatus=?,reviewNote=?,isPublic=?,reviewedByUserId=?,reviewedAt=CURRENT_TIMESTAMP WHERE id=?`,
        [
          input.reviewStatus,
          input.reviewNote || null,
          input.isPublic ? 1 : 0,
          actorId(ctx),
          input.profileId,
        ]
      );
      await writeExhibitionAudit({
        eventId: Number(profile.eventId),
        accountId: Number(profile.accountId),
        profileId: input.profileId,
        actorType: "admin",
        actorId: actorId(ctx),
        action: "profile_reviewed",
        before: {
          reviewStatus: profile.reviewStatus,
          reviewNote: profile.reviewNote,
          isPublic: profile.isPublic,
        },
        after: input,
      });
      return { success: true };
    }),

  reviewAsset: exhibitionAdminEditProcedure
    .input(
      z.object({
        assetId: z.number().int().positive(),
        reviewStatus: assetReviewValue,
        reviewNote: z.string().trim().max(5000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT asset.*,profile.eventId,profile.accountId FROM exhibition_brand_assets asset JOIN exhibition_brand_profiles profile ON profile.id=asset.profileId WHERE asset.id=? LIMIT 1`,
        [input.assetId]
      );
      const asset = rows[0];
      if (!asset)
        throw new TRPCError({ code: "NOT_FOUND", message: "素材不存在" });
      if (input.reviewStatus === "revision_required" && !input.reviewNote)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "退回修改时必须填写说明",
        });
      await pool.query(
        `UPDATE exhibition_brand_assets SET reviewStatus=?,reviewNote=?,reviewedByUserId=?,reviewedAt=CURRENT_TIMESTAMP WHERE id=?`,
        [
          input.reviewStatus,
          input.reviewNote || null,
          actorId(ctx),
          input.assetId,
        ]
      );
      await writeExhibitionAudit({
        eventId: Number(asset.eventId),
        accountId: Number(asset.accountId),
        profileId: Number(asset.profileId),
        assetId: input.assetId,
        actorType: "admin",
        actorId: actorId(ctx),
        action: "asset_reviewed",
        before: {
          reviewStatus: asset.reviewStatus,
          reviewNote: asset.reviewNote,
        },
        after: input,
      });
      return { success: true };
    }),

  getAssetDownload: exhibitionAdminViewProcedure
    .input(z.object({ assetId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT objectKey,originalFileName,profileId FROM exhibition_brand_assets WHERE id=? LIMIT 1`,
        [input.assetId]
      );
      const asset = rows[0];
      if (!asset)
        throw new TRPCError({ code: "NOT_FOUND", message: "素材不存在" });
      const signed = await storageGetPrivate(String(asset.objectKey));
      await writeExhibitionAudit({
        profileId: Number(asset.profileId),
        assetId: input.assetId,
        actorType: "admin",
        actorId: actorId(ctx),
        action: "asset_downloaded_by_admin",
      }).catch(() => undefined);
      return {
        url: signed.url,
        fileName: sanitizeDownloadFileName(String(asset.originalFileName)),
      };
    }),

  updateEvent: exhibitionAdminEditProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(255),
        venue: z.string().trim().max(255).optional(),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const pool = getExhibitionPool();
      const event = await findActiveExhibitionEvent(pool);
      await pool.query(
        `UPDATE exhibition_events SET name=?,venue=?,startDate=?,endDate=? WHERE id=?`,
        [
          input.name,
          input.venue || null,
          input.startDate || null,
          input.endDate || null,
          event.id,
        ]
      );
      await writeExhibitionAudit({
        eventId: Number(event.id),
        actorType: "admin",
        actorId: actorId(ctx),
        action: "event_updated",
        before: event,
        after: input,
      });
      return { success: true };
    }),

  exportAccountsCsv: exhibitionAdminViewProcedure.query(async () => {
    const pool = getExhibitionPool();
    const event = await findActiveExhibitionEvent(pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT account.email,account.displayName,account.companyName,account.phone,account.status,account.lastLoginAt,
              profile.brandName,profile.contactName,profile.contactPhone,profile.websiteUrl,profile.category,profile.reviewStatus,
              booth.boothCode,assignment.status AS assignmentStatus
         FROM exhibition_brand_profiles profile
         JOIN exhibition_accounts account ON account.id=profile.accountId
         LEFT JOIN exhibition_booth_assignments assignment ON assignment.profileId=profile.id AND assignment.eventId=profile.eventId
         LEFT JOIN exhibition_booths booth ON booth.id=assignment.boothId
        WHERE profile.eventId=? ORDER BY booth.displayOrder,profile.brandName`,
      [event.id]
    );
    const headers = [
      "メール",
      "表示名",
      "会社名",
      "電話",
      "アカウント状態",
      "最終ログイン",
      "ブランド名",
      "担当者",
      "担当者電話",
      "Webサイト",
      "カテゴリ",
      "審査状態",
      "展位",
      "展位状態",
    ];
    const fields = [
      "email",
      "displayName",
      "companyName",
      "phone",
      "status",
      "lastLoginAt",
      "brandName",
      "contactName",
      "contactPhone",
      "websiteUrl",
      "category",
      "reviewStatus",
      "boothCode",
      "assignmentStatus",
    ];
    const csv = `\uFEFF${[headers.map(csvCell).join(","), ...rows.map(row => fields.map(field => csvCell(row[field])).join(","))].join("\r\n")}`;
    return { fileName: `brand-booths-${event.slug}.csv`, csv };
  }),
});
