import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("public schedule optional brand contract", () => {
  const page = read("client/src/pages/PublicSchedule.tsx");
  const router = read("server/routers.ts");
  const schema = read("drizzle/schema.ts");

  it("allows creating a schedule without selecting a brand", () => {
    const createStart = page.indexOf("const handleAddSchedule = async () =>");
    const createEnd = page.indexOf(
      "// Open add modal with today's date",
      createStart
    );
    const createBlock = page.slice(createStart, createEnd);

    expect(createBlock).not.toContain("newSchedule.brandIds.length === 0");
    expect(createBlock).not.toContain("ブランドを選択してください");
    expect(createBlock).toContain("brandIds: newSchedule.brandIds");
    expect(page).toContain("ブランドを選択（任意）");
    expect(page).not.toContain('"ブランドを選択 *"');
  });

  it("keeps the backend and database compatible with an empty brand list", () => {
    const createStart = router.indexOf("publicCreate: publicProcedure");
    const updateStart = router.indexOf(
      "publicUpdate: publicProcedure",
      createStart
    );
    const createBlock = router.slice(createStart, updateStart);

    expect(createBlock).toContain("brandIds: z.array(z.number()).optional()");
    expect(createBlock).toContain(
      "brandId: input.brandIds?.[0] ?? input.brandId"
    );
    expect(createBlock).toContain("brandIds: input.brandIds");
    expect(schema).toContain('brandId: int("brandId")');
    expect(schema).toContain('brandIds: json("brandIds").$type<number[]>()');
  });

  it("shows an explicit unassigned state and allows adding or clearing brands later", () => {
    expect(page).toContain("ブランド未設定");
    expect(page).toContain("ブランド未設定（後で選択できます）");
    expect(page).toContain("brandIds: editSchedule.brandIds");
    expect(page).toContain("brandIds: schedule.brandIds?.length");
    expect(page).toContain("prev.brandIds.filter(id => id !== brand.id)");

    const updateStart = router.indexOf("publicUpdate: publicProcedure");
    const deleteStart = router.indexOf(
      "publicDelete: publicProcedure",
      updateStart
    );
    const updateBlock = router.slice(updateStart, deleteStart);
    expect(updateBlock).toContain(
      "brandIds: z.array(z.number()).nullable().optional()"
    );
    expect(updateBlock).toContain(
      "updateData.brandId = input.brandIds?.[0] ?? null"
    );
    expect(updateBlock).toContain(
      "recurringUpdateData.brandId = input.brandIds?.[0] ?? null"
    );
  });

  it("preserves brand-specific filtering while leaving unbranded schedules visible in the default view", () => {
    expect(page).toContain("if (selectedBrandId)");
    expect(page).toContain(
      "s.brandIds?.includes(selectedBrandId!) || s.brandId === selectedBrandId"
    );
    expect(page).toContain(
      "selectedBrandId, selectedLiverName, selectedLocationId"
    );
  });
});
