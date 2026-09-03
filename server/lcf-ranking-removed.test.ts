import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

describe("LCF GMV ranking is permanently removed", () => {
  it("does not retain the public page or any ranking server router", () => {
    expect(exists("client/src/pages/LcfRanking.tsx")).toBe(false);
    expect(exists("server/rankingRouter.ts")).toBe(false);
    expect(exists("server/rankingRetirementRouter.ts")).toBe(false);
  });

  it("does not expose the route, upload panel, admin tab, or temporary maintenance API", () => {
    const sources = [
      read("client/src/App.tsx"),
      read("client/src/pages/LiveCommerceFestival.tsx"),
      read("client/src/pages/LcfMypage.tsx"),
      read("client/src/pages/LcfAdmin.tsx"),
      read("server/routers.ts"),
    ].join("\n");

    expect(sources).not.toContain("/lcf/ranking");
    expect(sources).not.toContain("LcfRanking");
    expect(sources).not.toContain("GMV AWARD");
    expect(sources).not.toContain("GMV RANKING");
    expect(sources).not.toContain("rankingRetirement");
    expect(sources).not.toContain("rankingRouter");
    expect(sources).not.toContain("trpc.ranking");
  });

  it("removes the temporary screenshot-prefix enumeration helper", () => {
    const storage = read("server/storage.ts");
    expect(storage).not.toContain("storageListKeys");
    expect(storage).not.toContain("ListObjectsV2Command");
  });
});
