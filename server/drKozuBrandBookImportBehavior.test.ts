import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const pdf = readFileSync(new URL("./recoveryData/Dr.Kozu_Brand_Book_JP_2026_v5.pdf", import.meta.url));
const storageKey = "private/brand-files/drkozu/d390b78a9afa81c-Dr.Kozu_Brand_Book_JP_2026_v5.pdf";

function normalized(sql: unknown): string {
  return String(sql).replace(/\s+/g, " ").trim();
}

describe("Dr.Kozu brand-book import state convergence", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  it("CAS-resets an unhealthy completed marker, repairs canonical metadata and completes under the new claim version", async () => {
    process.env.DATABASE_URL = "mysql://unit-test.invalid/db";
    const state = {
      marker: {
        status: "completed",
        claimVersion: 3,
        claimToken: null as string | null,
        brandFileId: 7,
      },
      brandFile: {
        id: 7,
        fileName: "stale.pdf",
        fileUrl: "https://storage.invalid/private-key",
        fileKey: storageKey,
        fileSize: pdf.length,
        mimeType: "text/plain",
      },
      metadataRepairs: 0,
      auditWrites: 0,
    };

    const query = vi.fn(async (rawSql: unknown, params: unknown[] = []) => {
      const sql = normalized(rawSql);
      if (sql.startsWith("CREATE TABLE IF NOT EXISTS brand_asset_import_markers")) return [{ affectedRows: 0 }, []];
      if (sql.includes("INFORMATION_SCHEMA.COLUMNS") && sql.includes("claimToken")) return [[{ COLUMN_NAME: "claimToken" }], []];
      if (sql.includes("INFORMATION_SCHEMA.COLUMNS") && sql.includes("claimVersion")) return [[{ COLUMN_NAME: "claimVersion" }], []];
      if (sql.startsWith("SELECT marker.brandFileId,marker.claimVersion")) {
        return [[{
          brandFileId: state.marker.brandFileId,
          claimVersion: state.marker.claimVersion,
          fileSaved:
            state.brandFile.fileSize === pdf.length &&
            state.brandFile.fileName === "Dr.Kozu_Brand_Book_JP_2026_v5.pdf" &&
            state.brandFile.fileUrl === "/api/brand-files/7" &&
            state.brandFile.mimeType === "application/pdf"
              ? 1
              : 0,
          relationVerified: 1,
        }], []];
      }
      if (sql.includes("SET status='failed',errorCode='COMPLETED_STATE_INVALID'")) {
        const expectedVersion = Number(params[2]);
        const matched = state.marker.status === "completed" && state.marker.claimVersion === expectedVersion;
        if (matched) state.marker.status = "failed";
        return [{ affectedRows: matched ? 1 : 0 }, []];
      }
      if (sql.startsWith("INSERT IGNORE INTO brand_asset_import_markers")) return [{ affectedRows: 0 }, []];
      if (sql.includes("SET status='processing',claimToken=?,claimVersion=claimVersion+1")) {
        if (state.marker.status !== "failed") return [{ affectedRows: 0 }, []];
        state.marker.status = "processing";
        state.marker.claimToken = String(params[0]);
        state.marker.claimVersion += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith("SELECT claimVersion FROM brand_asset_import_markers")) {
        return [[{ claimVersion: state.marker.claimVersion }], []];
      }
      if (sql.includes("SET leaseUntil=DATE_ADD") && sql.includes("claimVersion=?")) {
        const token = String(params[3]);
        const version = Number(params[4]);
        const matched = state.marker.status === "processing" && state.marker.claimToken === token && state.marker.claimVersion === version;
        return [{ affectedRows: matched ? 1 : 0 }, []];
      }
      if (sql.startsWith("SELECT id FROM brands")) return [[{ id: 10 }], []];
      if (sql.startsWith("SELECT id FROM managed_stores")) return [[{ id: 5 }], []];
      if (sql.startsWith("SELECT 1 AS linked FROM managed_store_brands")) return [[{ linked: 1 }], []];
      if (sql.startsWith("SELECT id FROM users")) return [[{ id: 1 }], []];
      if (sql.startsWith("SELECT id,fileName,fileUrl,fileSize,mimeType FROM brand_files")) return [[{ ...state.brandFile }], []];
      if (sql.startsWith("UPDATE brand_files SET fileName=?")) {
        state.brandFile.fileName = String(params[0]);
        state.brandFile.fileUrl = String(params[1]);
        state.brandFile.fileSize = Number(params[2]);
        state.brandFile.mimeType = String(params[3]);
        state.metadataRepairs += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith("INSERT INTO brand_edit_logs")) {
        state.auditWrites += 1;
        return [{ affectedRows: 1, insertId: 90 }, []];
      }
      if (sql.includes("SET status='completed'") && sql.includes("claimVersion=?")) {
        const token = String(params[6]);
        const version = Number(params[7]);
        const matched = state.marker.status === "processing" && state.marker.claimToken === token && state.marker.claimVersion === version;
        if (matched) {
          state.marker.status = "completed";
          state.marker.claimToken = null;
        }
        return [{ affectedRows: matched ? 1 : 0 }, []];
      }
      throw new Error(`Unhandled SQL in fake connection: ${sql}`);
    });

    const connection = {
      query,
      beginTransaction: vi.fn(async () => undefined),
      commit: vi.fn(async () => undefined),
      rollback: vi.fn(async () => undefined),
      release: vi.fn(),
    };
    const pool = { query, getConnection: vi.fn(async () => connection) };
    vi.doMock("mysql2/promise", () => ({ createPool: () => pool }));
    vi.doMock("./storage.js", () => ({
      storagePutFile: vi.fn(async () => ({ key: storageKey })),
      storageReadBuffer: vi.fn(async () => ({ data: pdf, contentType: "application/pdf", contentLength: pdf.length })),
    }));

    const { importDrKozuBrandBook } = await import("./drKozuBrandBookImport");
    const result = await importDrKozuBrandBook();

    expect(result).toEqual({ status: "completed", brandFileId: 7 });
    expect(state.marker.status).toBe("completed");
    expect(state.marker.claimVersion).toBe(4);
    expect(state.metadataRepairs).toBe(1);
    expect(state.auditWrites).toBe(1);
    expect(state.brandFile).toMatchObject({
      fileName: "Dr.Kozu_Brand_Book_JP_2026_v5.pdf",
      fileUrl: "/api/brand-files/7",
      fileSize: pdf.length,
      mimeType: "application/pdf",
    });
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});
