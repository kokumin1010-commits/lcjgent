import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "client/src/pages/LineReceiptManagement.tsx"),
  "utf8",
);

describe("restored receipt pagination", () => {
  it("requests a bounded page from the server", () => {
    expect(source).toContain("limit: receiptPageSize");
    expect(source).toContain("offset: receiptPage * receiptPageSize");
  });

  it("resets pagination when filters change", () => {
    expect(source).toContain("setReceiptPage(0)");
    expect(source).toContain(
      'activeTab, searchText, selectedStatuses.join(","), dateFrom, dateTo',
    );
  });

  it("provides previous and next page controls", () => {
    expect(source).toContain("setReceiptPage((page) => Math.max(0, page - 1))");
    expect(source).toContain("setReceiptPage((page) => page + 1)");
    expect(source).toContain("currentStatusTotal.toLocaleString()");
  });
});
