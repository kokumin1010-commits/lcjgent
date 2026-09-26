import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXHIBITION_BOOTH_DEFINITIONS,
  EXHIBITION_FLOOR_MAP_URL,
  EXHIBITION_MAP_HEIGHT,
  EXHIBITION_MAP_WIDTH,
} from "../shared/exhibitionBoothMap";
import {
  createExhibitionAssetAccessToken,
  hashExhibitionPassword,
  verifyExhibitionAssetAccessToken,
  verifyExhibitionPassword,
} from "./exhibitionBoothService";
import {
  decryptExhibitionPrivateObject,
  encryptExhibitionPrivateObject,
} from "./storage";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("exhibition booth map", () => {
  it("contains every requested T and L booth exactly once", () => {
    const codes = EXHIBITION_BOOTH_DEFINITIONS.map(item => item.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toHaveLength(81);
    for (let id = 1; id <= 63; id += 1) expect(codes).toContain(`T-${id}`);
    for (let id = 1; id <= 18; id += 1) expect(codes).toContain(`L-${id}`);
  });

  it("keeps all hotspots inside the original floor-map dimensions", () => {
    for (const item of EXHIBITION_BOOTH_DEFINITIONS) {
      expect(item.x).toBeGreaterThanOrEqual(0);
      expect(item.y).toBeGreaterThanOrEqual(0);
      expect(item.x + item.width).toBeLessThanOrEqual(
        EXHIBITION_MAP_WIDTH + 0.01
      );
      expect(item.y + item.height).toBeLessThanOrEqual(
        EXHIBITION_MAP_HEIGHT + 0.01
      );
    }
  });

  it("keeps stage and sponsor booths out of user self-selection", () => {
    const locked = EXHIBITION_BOOTH_DEFINITIONS.filter(
      item => !item.userSelectable
    ).map(item => item.code);
    expect(locked).toEqual(["T-60", "T-61", "T-62", "T-63"]);
    expect(
      EXHIBITION_BOOTH_DEFINITIONS.filter(item => item.userSelectable)
    ).toHaveLength(77);
  });

  it("serves the uploaded floor map from the LCJ origin instead of a temporary CDN URL", () => {
    const index = source("server/_core/index.ts");
    const assetPath = resolve(
      process.cwd(),
      "server/assets/exhibition-brand-booth-map.png"
    );
    expect(EXHIBITION_FLOOR_MAP_URL).toBe("/api/exhibition/floor-map");
    expect(index).toContain('app.get("/api/exhibition/floor-map"');
    expect(index).toContain("server/assets/exhibition-brand-booth-map.png");
    expect(statSync(assetPath).size).toBeGreaterThan(70_000);
  });
});

describe("independent exhibition authentication", () => {
  it("uses salted PBKDF2 hashes and constant-time verification", () => {
    const first = hashExhibitionPassword("StrongBrandPass2026");
    const second = hashExhibitionPassword("StrongBrandPass2026");
    expect(first).not.toBe(second);
    expect(first.startsWith("v1:")).toBe(true);
    expect(verifyExhibitionPassword("StrongBrandPass2026", first)).toBe(true);
    expect(verifyExhibitionPassword("WrongBrandPass2026", first)).toBe(false);
  });

  it("uses an isolated HttpOnly cookie and non-master portal routes", () => {
    const auth = source("server/exhibitionBoothService.ts");
    const app = source("client/src/App.tsx");
    expect(auth).toContain('EXHIBITION_SESSION_COOKIE = "exhibition_session"');
    expect(auth).toContain("httpOnly: true");
    expect(auth).toContain('scope: "exhibition-brand"');
    expect(app).toContain('<Route path="/booth-portal/login"');
    expect(app).toContain(
      '<Route path="/booth-portal" component={ExhibitionPortal}'
    );
    expect(app).not.toContain('<Route path="/master/booth-portal"');
  });

  it("issues isolated five-minute asset access tokens", async () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "unit-test-exhibition-asset-access-secret";
    try {
      const token = await createExhibitionAssetAccessToken({
        assetId: 42,
        principalType: "brand",
        principalId: 7,
      });
      await expect(verifyExhibitionAssetAccessToken(token)).resolves.toEqual({
        assetId: 42,
        principalType: "brand",
        principalId: 7,
      });
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
  });
});

describe("data and reservation isolation", () => {
  it("creates dedicated tables and never mutates the existing LCF live-booth tables", () => {
    const upgrade = source("server/exhibitionBoothUpgrade.ts");
    expect(upgrade).toContain("CREATE TABLE IF NOT EXISTS exhibition_booths");
    expect(upgrade).toContain(
      "CREATE TABLE IF NOT EXISTS exhibition_booth_assignments"
    );
    expect(upgrade).toContain("lcf_booth_reservations");
    expect(upgrade).not.toMatch(/UPDATE\s+lcf_booth_reservations/i);
    expect(upgrade).not.toMatch(/INSERT\s+INTO\s+lcf_booth_reservations/i);
    expect(upgrade).not.toMatch(/DELETE\s+FROM\s+lcf_booth_reservations/i);
  });

  it("performs no exhibition DDL before the verified pre-backup and never overwrites admin booth status on restart", () => {
    const upgrade = source("server/exhibitionBoothUpgrade.ts");
    const health = upgrade.slice(
      upgrade.indexOf("export async function getExhibitionBoothUpgradeHealth"),
      upgrade.indexOf("export async function runExhibitionBoothUpgradeSetup")
    );
    const setup = upgrade.slice(
      upgrade.indexOf("export async function runExhibitionBoothUpgradeSetup")
    );
    expect(health).not.toContain("ensureRunTable(pool)");
    expect(
      setup.indexOf("verifiedBackup(pool, PRE_BACKUP_REASON)")
    ).toBeLessThan(setup.indexOf("ensureRunTable(pool)"));
    expect(upgrade).toContain("SELECT GET_LOCK(?,60)");
    expect(upgrade).toContain("SELECT RELEASE_LOCK(?)");
    expect(upgrade).toContain("INSERT IGNORE INTO exhibition_booths");
    expect(upgrade).not.toContain(
      "ON DUPLICATE KEY UPDATE boothType=VALUES(boothType)"
    );
    expect(upgrade).toContain("verifyPrivateAssetStorage");
    expect(upgrade).toContain("storageReadPrivateBuffer");
    expect(upgrade).toContain("privateStorageVerified");
    expect(upgrade).toContain("PRIVATE_STORAGE_PROBE_FAILED");
    expect(upgrade).toContain("VERIFIED_BACKUP_FAILED");
    expect(upgrade).toContain("fk_exhibition_assignment_booth");
    expect(upgrade).toContain("fk_exhibition_assignment_profile");
  });

  it("enforces database uniqueness for concurrent booth selection", () => {
    const upgrade = source("server/exhibitionBoothUpgrade.ts");
    const portal = source("server/exhibitionPortalRouter.ts");
    expect(upgrade).toContain(
      "UNIQUE KEY uq_exhibition_assignment_booth (eventId,boothId)"
    );
    expect(upgrade).toContain(
      "UNIQUE KEY uq_exhibition_assignment_profile (eventId,profileId)"
    );
    expect(portal).toContain("FOR UPDATE");
    expect(portal).toContain("ER_DUP_ENTRY");
  });

  it("stores brand assets as authenticated ciphertext and decrypts only through an authorized app route", () => {
    const portal = source("server/exhibitionPortalRouter.ts");
    const admin = source("server/exhibitionAdminRouter.ts");
    const storage = source("server/storage.ts");
    const index = source("server/_core/index.ts");
    expect(portal).toContain("private/exhibition/");
    expect(portal).toContain("exhibitionPortalProcedure");
    expect(portal).toContain("storagePutPrivate");
    expect(portal).toContain("createExhibitionAssetAccessToken");
    expect(admin).toContain("exhibitionAdminViewProcedure");
    expect(admin).toContain("createExhibitionAssetAccessToken");
    expect(storage).toContain("aes-256-gcm");
    expect(storage).toContain("assertAnonymousObjectIsEncrypted");
    expect(storage).toContain('CacheControl: "private, no-store, max-age=0"');
    expect(index).toContain('app.get("/api/exhibition/assets/:token"');
    expect(index).toContain("verifyExhibitionAssetAccessToken");
    expect(index).toContain("storageReadPrivateBuffer");
    expect(
      index.match(/startsWith\('\/master\/exhibition-booths'\)/g)
    ).toHaveLength(2);
  });

  it("round-trips exhibition assets with AES-GCM and binds ciphertext to its object key", () => {
    const previous = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "unit-test-exhibition-encryption-secret";
    try {
      const key = "private/exhibition/event/1/logo/file.png";
      const original = Buffer.from("private-logo-binary-content");
      const encrypted = encryptExhibitionPrivateObject(key, original);
      expect(encrypted.includes(original)).toBe(false);
      expect(decryptExhibitionPrivateObject(key, encrypted)).toEqual(original);
      expect(() =>
        decryptExhibitionPrivateObject(`${key}.moved`, encrypted)
      ).toThrow();
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
  });

  it("does not block the whole Railway service while the backup-gated upgrade runs", () => {
    const index = source("server/_core/index.ts");
    const upgrade = source("server/exhibitionBoothUpgrade.ts");
    const service = source("server/exhibitionBoothService.ts");
    const auth = source("server/exhibitionAuthRouter.ts");
    const serverListenIndex = index.indexOf("server.listen(port");
    const upgradeStartIndex = index.indexOf(
      "startExhibitionBoothUpgradeSetup().catch"
    );

    expect(serverListenIndex).toBeGreaterThan(-1);
    expect(upgradeStartIndex).toBeGreaterThan(serverListenIndex);
    expect(index).not.toContain("await runExhibitionBoothUpgradeSetup");
    expect(upgrade).toContain("exhibitionBoothUpgradeReady = true");
    expect(upgrade).toContain("isExhibitionBoothUpgradeReady");
    expect(service).toContain("assertExhibitionBoothReady");
    expect(service).toContain('code: "PRECONDITION_FAILED"');
    expect(auth).toContain("exhibitionPublicProcedure");
    expect(auth).not.toContain("publicProcedure");
  });

  it("serializes booth disable checks with user selection", () => {
    const admin = source("server/exhibitionAdminRouter.ts");
    const block = admin.slice(
      admin.indexOf("updateBoothStatus:"),
      admin.indexOf("reviewProfile:")
    );
    expect(block).toContain("beginTransaction");
    expect(block).toContain(
      "exhibition_booths WHERE id=? AND eventId=? LIMIT 1 FOR UPDATE"
    );
    expect(block).toContain(
      "exhibition_booth_assignments WHERE eventId=? AND boothId=? LIMIT 1 FOR UPDATE"
    );
    expect(block).toContain("connection.commit");
  });

  it("protects admin data on both client and server", () => {
    const app = source("client/src/App.tsx");
    const service = source("server/exhibitionBoothService.ts");
    expect(app).toContain('pageKey="/master/exhibition-booths"');
    expect(service).toContain(
      'EXHIBITION_ADMIN_PAGE_KEY = "/master/exhibition-booths"'
    );
    expect(service).toContain("requireExhibitionAdminAccess");
    expect(service).toContain('mode === "edit"');
  });
});
