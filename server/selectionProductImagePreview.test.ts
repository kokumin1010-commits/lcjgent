import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve("client/src/pages/SelectionCenter.tsx"), "utf8");

describe("selection product image preview", () => {
  it("opens both product images and detail cards from their thumbnails", () => {
    expect(page).toContain('onDoubleClick={() => setPreviewImage({ url, label: `${t("sc.form.productImage")} ${idx + 1}` })}');
    expect(page).toContain('onDoubleClick={() => setPreviewImage({ url, label: `详情图片 / 商品手卡 ${idx + 1}` })}');
    expect(page.match(/title="双击查看高清/g)?.length).toBe(2);
    expect(page.match(/role="button"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("provides a viewport-sized scrollable preview for long product cards", () => {
    expect(page).toContain("function ProductImagePreviewDialog");
    expect(page).toContain('h-[96vh] w-[96vw] max-w-[96vw]');
    expect(page).toContain('min-h-0 flex-1 overflow-auto');
    expect(page).toContain('style={{ width: `${zoom * 100}%`, maxWidth: "none" }}');
  });

  it("supports zoom, reset, double-click enlargement, and original-image access", () => {
    expect(page).toContain('Math.min(4, current + 0.25)');
    expect(page).toContain('Math.min(4, current + 0.5)');
    expect(page).toContain('onClick={() => setZoom(1)}');
    expect(page).toContain('target="_blank" rel="noreferrer"');
    expect(page).toContain('<ProductImagePreviewDialog image={previewImage} onClose={() => setPreviewImage(null)} />');
  });
});
