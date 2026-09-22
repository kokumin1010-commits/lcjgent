import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DRKOZU_BRAND_BOOK_IMPORT } from "./drKozuBrandBookImport";

const importSource = readFileSync(new URL("./drKozuBrandBookImport.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./storeManagementRouter.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("./storage.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/StoreManagement.tsx", import.meta.url), "utf8");
const dockerIgnore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
const pdfPath = new URL("./recoveryData/Dr.Kozu_Brand_Book_JP_2026_v5.pdf", import.meta.url);

describe("Dr.Kozu brand-book import", () => {
  it("ships the exact user-provided complete PDF into the Docker build context", () => {
    const pdf = readFileSync(pdfPath);
    expect(pdf.length).toBe(DRKOZU_BRAND_BOOK_IMPORT.fileSize);
    expect(createHash("sha256").update(pdf).digest("hex")).toBe(DRKOZU_BRAND_BOOK_IMPORT.sha256);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.subarray(-2048).toString("latin1")).toContain("%%EOF");
    expect(dockerIgnore).toContain("*.pdf");
    expect(dockerIgnore).toContain("!server/recoveryData/Dr.Kozu_Brand_Book_JP_2026_v5.pdf");
  });

  it("fails closed unless one active BUZZDROP store is already linked to one Dr.Kozu brand", () => {
    expect(importSource).toContain("DRKOZU_BRAND_TARGET_NOT_UNIQUE");
    expect(importSource).toContain("BUZZDROP_STORE_TARGET_NOT_UNIQUE");
    expect(importSource).toContain("BUZZDROP_DRKOZU_RELATION_MISSING");
    expect(importSource).toContain("FROM managed_store_brands");
    expect(importSource).not.toContain("INSERT INTO managed_store_brands");
    expect(importSource.indexOf("await resolveTarget(targetCheck)")).toBeLessThan(importSource.indexOf("await storagePutFile"));
  });

  it("uses owner fencing, lease renewal and affected-row checks for multi-instance recovery", () => {
    expect(importSource).toContain("claimToken VARCHAR(64)");
    expect(importSource).toContain("claimVersion BIGINT");
    expect(importSource).toContain("const claimToken = randomUUID()");
    expect(importSource).toContain("AND claimToken=?");
    expect(importSource).toContain("AND claimVersion=?");
    expect(importSource).toContain("startLeaseHeartbeat");
    expect(importSource).toContain("DRKOZU_BRAND_BOOK_IMPORT_CLAIM_LOST");
    expect(importSource).toContain("failurePersisted");
    expect(serverSource).toContain('result.status === "busy"');
    expect(serverSource).toContain("initializeDrKozuBrandBook(attempt + 1)");
    expect(serverSource).not.toContain("attempt >= 6");
  });

  it("uses deterministic key plus verified stored digest and rejects same-name collisions", () => {
    expect(importSource).toContain("verifyStoredObject");
    expect(importSource).toContain("DRKOZU_BRAND_BOOK_STORED_HASH_MISMATCH");
    expect(importSource).toContain("WHERE brandId=? AND deletedAt IS NULL AND fileKey=?");
    expect(importSource).toContain("DRKOZU_BRAND_BOOK_NAME_COLLISION");
    expect(importSource).not.toContain("fileName=? AND fileSize=?");
    expect(importSource).toContain("COMPLETED_STATE_INVALID");
    expect(importSource).toContain("UPDATE brand_files");
    expect(importSource).toContain("verified-metadata-repair");
    expect(importSource).toContain("INSERT INTO brand_edit_logs");
  });

  it("never returns or redirects to a storage URL for brand material downloads", () => {
    const materialsBlock = routerSource.slice(
      routerSource.indexOf("brandMaterials: protectedProcedure"),
      routerSource.indexOf("brandBookImportHealth: publicProcedure"),
    );
    expect(materialsBlock).toContain("INNER JOIN managed_store_brands");
    expect(materialsBlock).toContain("`/api/brand-files/${input.fileId}`");
    expect(materialsBlock).not.toContain("storageGet(String(file.fileKey))");
    expect(materialsBlock).not.toContain("file.fileUrl");
    expect(serverSource).toContain('app.get("/api/brand-files/:fileId"');
    expect(serverSource).toContain("requireBrandBdCommandAccess");
    expect(serverSource).toContain("storageReadBuffer");
    expect(serverSource).toContain('res.setHeader("Cache-Control", "private, no-store")');
    const endpointBlock = serverSource.slice(serverSource.indexOf('app.get("/api/brand-files/:fileId"'), serverSource.indexOf("// Recruitment image upload endpoint"));
    expect(endpointBlock).not.toContain("res.redirect");
    expect(endpointBlock).not.toContain("signed.url");
    expect(storageSource).toContain("export async function storageReadBuffer");
  });

  it("keeps the public health probe read-only and renders linked files without popup-dependent downloads", () => {
    const healthBlock = importSource.slice(importSource.indexOf("export async function getDrKozuBrandBookImportHealth"), importSource.indexOf("export const DRKOZU_BRAND_BOOK_IMPORT"));
    expect(healthBlock).not.toContain("ensureMarkerTable");
    expect(healthBlock).not.toContain("CREATE TABLE");
    expect(serverSource).toContain("initializeDrKozuBrandBook");
    expect(pageSource).toContain("trpc.storeManagement.brandMaterials.useQuery");
    expect(pageSource).toContain("服务品牌资料");
    expect(pageSource).toContain("getBrandMaterialFile.useMutation");
    const brandDownloadBlock = pageSource.slice(
      pageSource.indexOf("const brandMaterialFileMutation"),
      pageSource.indexOf("const shopStats"),
    );
    expect(brandDownloadBlock).toContain("window.location.assign(result.url)");
    expect(brandDownloadBlock).not.toContain("window.open");
  });
});
