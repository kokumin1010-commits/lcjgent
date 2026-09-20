import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve("client/src/pages/SelectionCenter.tsx"), "utf8");

describe("selection schedule modal layout", () => {
  it("keeps the add-schedule dialog inside the viewport", () => {
    expect(page).toContain('DialogContent className="w-[calc(100vw-2rem)] max-w-md overflow-x-hidden"');
    expect(page).toContain('<div className="min-w-0 space-y-4">');
  });

  it("contains long selected product labels inside the trigger", () => {
    expect(page).toContain('SelectTrigger className="w-full min-w-0 max-w-full overflow-hidden');
    expect(page).toContain('[&_[data-slot=select-value]]:text-ellipsis');
  });

  it("caps the product menu width and wraps complete option labels", () => {
    expect(page).toContain('SelectContent className="w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] overflow-x-hidden"');
    expect(page).toContain('[&>span:last-child]:break-words');
    expect(page).toContain('title={`${p.productName}${p.brandName ? ` (${p.brandName})` : \'\'}`}');
  });
});
