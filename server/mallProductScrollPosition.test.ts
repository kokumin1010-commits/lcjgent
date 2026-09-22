import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../client/src/pages/ProductManagement.tsx", import.meta.url),
  "utf8",
);

describe("mall product list position preservation", () => {
  it("anchors the edited product row and prevents dialog focus from jumping to the top", () => {
    expect(source).toContain("interface ProductListPosition");
    expect(source).toContain("data-mall-product-id={product.id}");
    expect(source).toContain("productListPositionRef.current = {");
    expect(source).toContain("viewportTop: row?.getBoundingClientRect().top ?? 0");
    expect(source).toContain("onCloseAutoFocus={(event) => event.preventDefault()}");
    expect(source).toContain("data-mall-product-edit-trigger");
    expect(source).toContain("?.focus({ preventScroll: true })");
  });

  it("binds the anchor to its update request before restoring the refreshed list", () => {
    expect(source).toContain("onMutate: ({ id }) => ({");
    expect(source).toContain("productListPositionRef.current?.productId === id");
    expect(source).toContain("const savedPosition = context?.savedPosition");
    expect(source).not.toContain(
      "const savedPosition = productListPositionRef.current",
    );
    expect(source).toContain("await utils.mall.getProducts.invalidate()");
    expect(source).toContain("restoreProductListPosition(savedPosition)");
    expect(source).toContain("row.getBoundingClientRect().top - position.viewportTop");
    expect(source).toContain('window.scrollBy({ top: offset, behavior: "auto" })');
    expect(source).toContain(
      'window.scrollTo({ top: position.scrollY, behavior: "auto" })',
    );
    expect(source).not.toContain("window.scrollTo({ top: 0");
  });
});
