import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import sharp from "sharp";
import { router } from "./_core/trpc";
import { decodeValidatedImage } from "./uploadValidation";
import { storageDelete, storageGetPrivate, storagePutPrivate } from "./storage";
import {
  exhibitionPortalProcedure,
  findActiveExhibitionEvent,
  findProfileForAccount,
  getExhibitionPool,
  sanitizeDownloadFileName,
  writeExhibitionAudit,
} from "./exhibitionBoothService";

const BASE64_LIMIT = 28_000_000;
const BACKDROP_LIMIT = 20 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable();
const profileInput = z.object({
  brandName: z.string().trim().min(1).max(255),
  companyName: z.string().trim().min(1).max(255),
  contactName: z.string().trim().min(1).max(255),
  contactPhone: optionalText(80),
  websiteUrl: z
    .union([z.string().trim().url().max(1000), z.literal(""), z.null()])
    .optional(),
  category: optionalText(255),
  brandIntro: optionalText(5000),
  mainProducts: optionalText(5000),
  socialUrl: z
    .union([z.string().trim().url().max(1000), z.literal(""), z.null()])
    .optional(),
  tiktokUrl: z
    .union([z.string().trim().url().max(1000), z.literal(""), z.null()])
    .optional(),
  notes: optionalText(5000),
});

function cleanNullable(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function safeFileName(value: string) {
  return sanitizeDownloadFileName(value).replace(/[^\p{L}\p{N}._()\- ]/gu, "_");
}

function decodeBase64Strict(value: string) {
  const normalized = value
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s/g, "");
  if (
    !normalized ||
    normalized.length > BASE64_LIMIT ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "ファイル形式が正しくありません",
    });
  }
  return Buffer.from(normalized, "base64");
}

async function normalizeAsset(input: {
  assetType: "logo" | "backdrop" | "other";
  mimeType: string;
  base64Data: string;
}) {
  const mimeType = input.mimeType.toLowerCase();
  if (IMAGE_MIMES.has(mimeType)) {
    if (input.assetType === "logo") {
      return decodeValidatedImage(
        input.base64Data.replace(/^data:[^;]+;base64,/, ""),
        mimeType
      );
    }
    const buffer = decodeBase64Strict(input.base64Data);
    if (!buffer.length || buffer.length > BACKDROP_LIMIT)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "背景板画像は20MB以内にしてください",
      });
    const formats: Record<string, { format: string; ext: string }> = {
      "image/jpeg": { format: "jpeg", ext: "jpg" },
      "image/png": { format: "png", ext: "png" },
      "image/webp": { format: "webp", ext: "webp" },
    };
    const expected = formats[mimeType];
    try {
      const decoder = sharp(buffer, {
        failOn: "error",
        animated: true,
        limitInputPixels: 60_000_000,
      });
      const metadata = await decoder.metadata();
      if (
        metadata.format !== expected.format ||
        !metadata.width ||
        !metadata.height ||
        (metadata.pages || 1) !== 1
      )
        throw new Error("MIME mismatch");
      if (
        metadata.width > 14_000 ||
        metadata.height > 14_000 ||
        metadata.width * metadata.height > 60_000_000
      )
        throw new Error("Image dimensions exceed policy");
      const normalized = sharp(buffer, {
        failOn: "error",
        limitInputPixels: 60_000_000,
      }).rotate();
      const normalizedBuffer =
        expected.format === "jpeg"
          ? await normalized.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
          : expected.format === "png"
            ? await normalized.png({ compressionLevel: 9 }).toBuffer()
            : await normalized.webp({ quality: 92 }).toBuffer();
      if (!normalizedBuffer.length || normalizedBuffer.length > BACKDROP_LIMIT)
        throw new Error("Normalized image exceeds size policy");
      return { buffer: normalizedBuffer, ext: expected.ext, mimeType };
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "背景板画像を安全に読み込めません。形式・サイズ・解像度を確認してください",
      });
    }
  }
  if (input.assetType !== "logo" && mimeType === PDF_MIME) {
    const buffer = decodeBase64Strict(input.base64Data);
    if (
      !buffer.length ||
      buffer.length > BACKDROP_LIMIT ||
      buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "20MB以内の有効なPDFをアップロードしてください",
      });
    }
    return { buffer, ext: "pdf", mimeType: PDF_MIME };
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message:
      input.assetType === "logo"
        ? "LogoはJPEG・PNG・WEBPに対応しています"
        : "JPEG・PNG・WEBP・PDFに対応しています",
  });
}

function accountFrom(ctx: any) {
  return ctx.exhibitionAccount as {
    id: number;
    email: string;
    displayName: string;
    companyName: string;
  };
}

async function overviewForAccount(accountId: number) {
  const pool = getExhibitionPool();
  const { event, profile } = await findProfileForAccount(accountId, pool);
  const [assignmentRows] = await pool.query<RowDataPacket[]>(
    `SELECT assignment.id,assignment.status,assignment.selectedAt,assignment.confirmedAt,
            booth.id AS boothId,booth.boothCode,booth.boothType
       FROM exhibition_booth_assignments assignment
       JOIN exhibition_booths booth ON booth.id=assignment.boothId
      WHERE assignment.eventId=? AND assignment.profileId=? LIMIT 1`,
    [event.id, profile.id]
  );
  const [assetRows] = await pool.query<RowDataPacket[]>(
    `SELECT id,assetType,originalFileName,mimeType,fileSize,fileSha256,versionNumber,isCurrent,reviewStatus,reviewNote,createdAt
       FROM exhibition_brand_assets WHERE profileId=? ORDER BY assetType,versionNumber DESC`,
    [profile.id]
  );
  return {
    event,
    profile,
    assignment: assignmentRows[0] || null,
    assets: assetRows,
  };
}

export const exhibitionPortalRouter = router({
  overview: exhibitionPortalProcedure.query(async ({ ctx }) => {
    return overviewForAccount(accountFrom(ctx).id);
  }),

  map: exhibitionPortalProcedure.query(async ({ ctx }) => {
    const account = accountFrom(ctx);
    const pool = getExhibitionPool();
    const { event, profile } = await findProfileForAccount(account.id, pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT booth.id,booth.boothCode,booth.boothType,booth.x,booth.y,booth.width,booth.height,
              booth.userSelectable,booth.status,booth.label,booth.displayOrder,
              assignment.id AS assignmentId,assignment.profileId,assignment.status AS assignmentStatus,
              occupant.brandName AS occupantBrandName,occupant.category AS occupantCategory,
              occupant.brandIntro AS occupantBrandIntro,occupant.reviewStatus AS occupantReviewStatus,
              occupant.isPublic AS occupantIsPublic,
              logo.objectKey AS occupantLogoKey
         FROM exhibition_booths booth
         LEFT JOIN exhibition_booth_assignments assignment ON assignment.eventId=booth.eventId AND assignment.boothId=booth.id
         LEFT JOIN exhibition_brand_profiles occupant ON occupant.id=assignment.profileId
         LEFT JOIN exhibition_brand_assets logo ON logo.profileId=occupant.id AND logo.assetType='logo' AND logo.isCurrent=1
        WHERE booth.eventId=? ORDER BY booth.displayOrder,booth.id`,
      [event.id]
    );
    const booths = await Promise.all(
      rows.map(async row => {
        const isMine = Number(row.profileId || 0) === Number(profile.id);
        const publicOccupant =
          enabled(row.occupantIsPublic) &&
          row.occupantReviewStatus === "approved";
        let occupantLogoUrl: string | null = null;
        if ((isMine || publicOccupant) && row.occupantLogoKey) {
          occupantLogoUrl = (
            await storageGetPrivate(String(row.occupantLogoKey))
          ).url;
        }
        return {
          id: Number(row.id),
          boothCode: String(row.boothCode),
          boothType: row.boothType,
          x: Number(row.x),
          y: Number(row.y),
          width: Number(row.width),
          height: Number(row.height),
          userSelectable: enabled(row.userSelectable),
          status: row.status,
          label: row.label,
          displayOrder: Number(row.displayOrder),
          occupancy: row.assignmentId
            ? isMine
              ? "mine"
              : "occupied"
            : "available",
          assignmentStatus: row.assignmentStatus || null,
          occupant:
            isMine || publicOccupant
              ? {
                  brandName: row.occupantBrandName,
                  category: row.occupantCategory,
                  brandIntro: row.occupantBrandIntro,
                  logoUrl: occupantLogoUrl,
                }
              : null,
        };
      })
    );
    return { event, profileId: Number(profile.id), booths };
  }),

  saveProfile: exhibitionPortalProcedure
    .input(profileInput)
    .mutation(async ({ input, ctx }) => {
      const account = accountFrom(ctx);
      const pool = getExhibitionPool();
      const { event, profile } = await findProfileForAccount(account.id, pool);
      const before = { ...profile };
      const nextStatus =
        profile.reviewStatus === "approved"
          ? "revision_required"
          : profile.reviewStatus;
      await pool.query(
        `UPDATE exhibition_brand_profiles SET
          brandName=?,companyName=?,contactName=?,contactPhone=?,websiteUrl=?,category=?,brandIntro=?,mainProducts=?,socialUrl=?,tiktokUrl=?,notes=?,
          reviewStatus=?,reviewNote=CASE WHEN ?='revision_required' THEN 'ブランド側で情報が更新されました' ELSE reviewNote END
         WHERE id=? AND accountId=?`,
        [
          input.brandName,
          input.companyName,
          input.contactName,
          cleanNullable(input.contactPhone),
          cleanNullable(input.websiteUrl),
          cleanNullable(input.category),
          cleanNullable(input.brandIntro),
          cleanNullable(input.mainProducts),
          cleanNullable(input.socialUrl),
          cleanNullable(input.tiktokUrl),
          cleanNullable(input.notes),
          nextStatus,
          nextStatus,
          profile.id,
          account.id,
        ]
      );
      await writeExhibitionAudit({
        eventId: Number(event.id),
        accountId: account.id,
        profileId: Number(profile.id),
        actorType: "brand",
        actorId: account.id,
        action: "profile_updated",
        before,
        after: input,
      });
      return overviewForAccount(account.id);
    }),

  submitProfile: exhibitionPortalProcedure.mutation(async ({ ctx }) => {
    const account = accountFrom(ctx);
    const pool = getExhibitionPool();
    const { event, profile } = await findProfileForAccount(account.id, pool);
    if (
      !String(profile.brandName || "").trim() ||
      !String(profile.companyName || "").trim() ||
      !String(profile.contactName || "").trim() ||
      !String(profile.brandIntro || "").trim()
    ) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "ブランド名・会社名・担当者名・ブランド紹介を入力してください",
      });
    }
    const [assetRows] = await pool.query<RowDataPacket[]>(
      `SELECT assetType FROM exhibition_brand_assets WHERE profileId=? AND isCurrent=1`,
      [profile.id]
    );
    const types = new Set(assetRows.map(row => String(row.assetType)));
    if (!types.has("logo") || !types.has("backdrop")) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Logoとブランド背景板の両方をアップロードしてください",
      });
    }
    await pool.query(
      `UPDATE exhibition_brand_profiles SET reviewStatus='submitted',reviewNote=NULL WHERE id=?`,
      [profile.id]
    );
    await writeExhibitionAudit({
      eventId: Number(event.id),
      accountId: account.id,
      profileId: Number(profile.id),
      actorType: "brand",
      actorId: account.id,
      action: "profile_submitted",
      before: { reviewStatus: profile.reviewStatus },
      after: { reviewStatus: "submitted" },
    });
    return { success: true };
  }),

  selectBooth: exhibitionPortalProcedure
    .input(z.object({ boothId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const account = accountFrom(ctx);
      const pool = getExhibitionPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const { event, profile } = await findProfileForAccount(
          account.id,
          connection
        );
        const [boothRows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM exhibition_booths WHERE id=? AND eventId=? LIMIT 1 FOR UPDATE`,
          [input.boothId, event.id]
        );
        const booth = boothRows[0];
        if (
          !booth ||
          booth.status !== "available" ||
          !enabled(booth.userSelectable)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "この展位は選択できません",
          });
        }
        const [occupiedRows] = await connection.query<RowDataPacket[]>(
          `SELECT id,profileId,status FROM exhibition_booth_assignments WHERE eventId=? AND boothId=? LIMIT 1 FOR UPDATE`,
          [event.id, booth.id]
        );
        const occupied = occupiedRows[0];
        if (occupied && Number(occupied.profileId) !== Number(profile.id)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "この展位は他のブランドにより選択済みです",
          });
        }
        const [ownRows] = await connection.query<RowDataPacket[]>(
          `SELECT assignment.*,oldBooth.boothCode FROM exhibition_booth_assignments assignment
             JOIN exhibition_booths oldBooth ON oldBooth.id=assignment.boothId
            WHERE assignment.eventId=? AND assignment.profileId=? LIMIT 1 FOR UPDATE`,
          [event.id, profile.id]
        );
        const own = ownRows[0];
        if (
          own &&
          own.status === "confirmed" &&
          Number(own.boothId) !== Number(booth.id)
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "確定済みの展位を変更するには管理者へ連絡してください",
          });
        }
        if (own && Number(own.boothId) === Number(booth.id)) {
          await connection.commit();
          return { success: true, boothCode: booth.boothCode, unchanged: true };
        }
        if (own)
          await connection.query(
            `DELETE FROM exhibition_booth_assignments WHERE id=?`,
            [own.id]
          );
        const [result] = await connection.query(
          `INSERT INTO exhibition_booth_assignments (eventId,boothId,profileId,status) VALUES (?,?,?,'selected')`,
          [event.id, booth.id, profile.id]
        );
        await writeExhibitionAudit({
          connection,
          eventId: Number(event.id),
          accountId: account.id,
          profileId: Number(profile.id),
          boothId: Number(booth.id),
          actorType: "brand",
          actorId: account.id,
          action: own ? "booth_changed" : "booth_selected",
          before: own || null,
          after: {
            assignmentId: Number((result as any).insertId),
            boothCode: booth.boothCode,
          },
        });
        await connection.commit();
        return { success: true, boothCode: booth.boothCode, unchanged: false };
      } catch (error: any) {
        await connection.rollback();
        if (error?.code === "ER_DUP_ENTRY")
          throw new TRPCError({
            code: "CONFLICT",
            message: "この展位は他のブランドにより選択済みです",
          });
        throw error;
      } finally {
        connection.release();
      }
    }),

  releaseBooth: exhibitionPortalProcedure
    .input(z.object({ reason: z.string().trim().min(2).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const account = accountFrom(ctx);
      const pool = getExhibitionPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const { event, profile } = await findProfileForAccount(
          account.id,
          connection
        );
        const [rows] = await connection.query<RowDataPacket[]>(
          `SELECT assignment.*,booth.boothCode FROM exhibition_booth_assignments assignment
             JOIN exhibition_booths booth ON booth.id=assignment.boothId
            WHERE assignment.eventId=? AND assignment.profileId=? LIMIT 1 FOR UPDATE`,
          [event.id, profile.id]
        );
        const assignment = rows[0];
        if (!assignment)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "選択中の展位がありません",
          });
        if (assignment.status === "confirmed")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "確定済みの展位を解除するには管理者へ連絡してください",
          });
        await connection.query(
          `DELETE FROM exhibition_booth_assignments WHERE id=?`,
          [assignment.id]
        );
        await writeExhibitionAudit({
          connection,
          eventId: Number(event.id),
          accountId: account.id,
          profileId: Number(profile.id),
          boothId: Number(assignment.boothId),
          actorType: "brand",
          actorId: account.id,
          action: "booth_released",
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

  uploadAsset: exhibitionPortalProcedure
    .input(
      z.object({
        assetType: z.enum(["logo", "backdrop", "other"]),
        fileName: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().min(1).max(120),
        base64Data: z.string().min(4).max(BASE64_LIMIT),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const account = accountFrom(ctx);
      const pool = getExhibitionPool();
      const { event, profile } = await findProfileForAccount(account.id, pool);
      const decoded = await normalizeAsset(input);
      const sha = createHash("sha256").update(decoded.buffer).digest("hex");
      const [duplicates] = await pool.query<RowDataPacket[]>(
        `SELECT id,versionNumber FROM exhibition_brand_assets WHERE profileId=? AND assetType=? AND fileSha256=? LIMIT 1`,
        [profile.id, input.assetType, sha]
      );
      if (duplicates[0])
        throw new TRPCError({
          code: "CONFLICT",
          message: `同じファイルは既にアップロード済みです（v${duplicates[0].versionNumber}）`,
        });
      const [versionRows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(versionNumber),0) AS maxVersion FROM exhibition_brand_assets WHERE profileId=? AND assetType=?`,
        [profile.id, input.assetType]
      );
      const versionNumber = Number(versionRows[0]?.maxVersion || 0) + 1;
      const objectKey = `private/exhibition/${event.slug}/${profile.id}/${input.assetType}/${Date.now()}-${sha.slice(0, 16)}.${decoded.ext}`;
      await storagePutPrivate(objectKey, decoded.buffer, decoded.mimeType);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `UPDATE exhibition_brand_assets SET isCurrent=0 WHERE profileId=? AND assetType=?`,
          [profile.id, input.assetType]
        );
        const [result] = await connection.query(
          `INSERT INTO exhibition_brand_assets
            (profileId,assetType,objectKey,originalFileName,mimeType,fileSize,fileSha256,versionNumber,isCurrent,reviewStatus,uploadedByAccountId)
           VALUES (?,?,?,?,?,?,?,?,1,'pending',?)`,
          [
            profile.id,
            input.assetType,
            objectKey,
            safeFileName(input.fileName),
            decoded.mimeType,
            decoded.buffer.length,
            sha,
            versionNumber,
            account.id,
          ]
        );
        const assetId = Number((result as any).insertId);
        if (profile.reviewStatus === "approved") {
          await connection.query(
            `UPDATE exhibition_brand_profiles SET reviewStatus='revision_required',reviewNote='ブランド側で素材が更新されました' WHERE id=?`,
            [profile.id]
          );
        }
        await writeExhibitionAudit({
          connection,
          eventId: Number(event.id),
          accountId: account.id,
          profileId: Number(profile.id),
          assetId,
          actorType: "brand",
          actorId: account.id,
          action: "asset_uploaded",
          after: {
            assetType: input.assetType,
            fileName: safeFileName(input.fileName),
            mimeType: decoded.mimeType,
            fileSize: decoded.buffer.length,
            fileSha256: sha,
            versionNumber,
          },
        });
        await connection.commit();
        return {
          success: true,
          assetId,
          versionNumber,
          fileSize: decoded.buffer.length,
          fileSha256: sha,
        };
      } catch (error) {
        await connection.rollback();
        await storageDelete(objectKey).catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    }),

  getAssetDownload: exhibitionPortalProcedure
    .input(z.object({ assetId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const account = accountFrom(ctx);
      const pool = getExhibitionPool();
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT asset.objectKey,asset.originalFileName
           FROM exhibition_brand_assets asset
           JOIN exhibition_brand_profiles profile ON profile.id=asset.profileId
          WHERE asset.id=? AND profile.accountId=? LIMIT 1`,
        [input.assetId, account.id]
      );
      const row = rows[0];
      if (!row)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "ファイルが見つかりません",
        });
      const signed = await storageGetPrivate(String(row.objectKey));
      await writeExhibitionAudit({
        accountId: account.id,
        actorType: "brand",
        actorId: account.id,
        assetId: input.assetId,
        action: "asset_downloaded",
      }).catch(() => undefined);
      return {
        url: signed.url,
        fileName: sanitizeDownloadFileName(String(row.originalFileName)),
      };
    }),
});

function enabled(value: unknown) {
  return value === true || value === 1 || value === "1";
}
