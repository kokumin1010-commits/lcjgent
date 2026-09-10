import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${here}/../client/src/pages/ProductManagement.tsx`, "utf8");

describe("MALL product dialog responsive layout", () => {
  it("overrides the shared 512px dialog cap at every desktop breakpoint", () => {
    expect(source).toContain("sm:max-w-[92vw]");
    expect(source).toContain("lg:max-w-5xl");
    expect(source).toContain("xl:max-w-6xl");
    expect(source).toContain("max-h-[94dvh]");
    expect(source).toContain("overflow-x-hidden");
  });

  it("uses one form column on phones and two columns from sm upward", () => {
    expect(source).toContain("grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2");
    expect(source).not.toContain('className="col-span-2');
    expect(source.match(/col-span-full min-w-0/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("adapts media from two to five columns without fixed card widths", () => {
    expect(source).toContain("grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-4 xl:grid-cols-5");
    expect(source).not.toContain("grid grid-cols-4 sm:grid-cols-5 gap-3");
    expect(source).toContain("relative group min-w-0 rounded-lg border-2");
  });

  it("shows complete image and video proportions while preserving drag sorting", () => {
    expect(source.match(/object-contain pointer-events-none/g)?.length).toBe(2);
    expect(source).toContain("aspect-square min-w-0 overflow-hidden");
    expect(source).toContain("useSortable({ id })");
    expect(source).toContain("strategy={rectSortingStrategy}");
    expect(source).toContain("onDragEnd={handleDragEnd}");
  });
});
