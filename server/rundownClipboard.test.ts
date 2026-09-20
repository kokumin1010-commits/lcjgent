import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRundownPastePlan,
  parseRundownTsv,
  RUNDOWN_CLIPBOARD_COLUMN_KEYS,
  serializeRundownSelection,
} from "../shared/rundownClipboard";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Rundown TSV clipboard core", () => {
  it("parses Excel-compatible tabs, CRLF, quotes and embedded newlines", () => {
    expect(parseRundownTsv('"A\tB"\t"C""D"\r\n"line\n2"\t3\r\n')).toEqual([
      ["A\tB", 'C"D'],
      ["line\n2", "3"],
    ]);
  });

  it("copies an entire row in the visible editable-column order", () => {
    const item = {
      id: 1,
      productName: "商品A",
      timeSlot: "20:00-20:05",
      productAttribute: "required",
      listPrice: 19_800,
      livePrice: 5_980,
      notes: "第一行\n第二行",
    };
    const copied = serializeRundownSelection([item], { type: "row", rowIndex: 0 });
    const cells = parseRundownTsv(copied)[0];
    expect(cells).toHaveLength(RUNDOWN_CLIPBOARD_COLUMN_KEYS.length);
    expect(cells[0]).toBe("商品A");
    expect(cells[1]).toBe("20:00-20:05");
    expect(cells[6]).toBe("必播品");
    expect(cells[13]).toBe("69.8");
    expect(cells[21]).toBe("第一行\n第二行");
  });

  it("copies a complete column and pastes values downward", () => {
    const items = [
      { id: 1, listPrice: 1_000 },
      { id: 2, listPrice: 2_000 },
    ];
    expect(serializeRundownSelection(items, { type: "column", columnKey: "listPrice" }))
      .toBe("1000\n2000");
    const plan = buildRundownPastePlan({
      items,
      selection: { type: "column", columnKey: "listPrice" },
      text: "¥19,800\n12,800",
    });
    expect(plan).toMatchObject({ changedCells: 2, targetRows: 2, truncatedRows: 0 });
    expect(plan.updates).toEqual([
      { id: 1, changes: { listPrice: 19_800 } },
      { id: 2, changes: { listPrice: 12_800 } },
    ]);
  });

  it("preserves an explicit blank at the end of a copied column so the last target is cleared", () => {
    const copied = serializeRundownSelection([
      { id: 1, productName: "商品A" },
      { id: 2, productName: null },
    ], { type: "column", columnKey: "productName" });
    expect(copied).toBe('商品A\n""');
    expect(parseRundownTsv(copied)).toEqual([["商品A"], [""]]);

    const plan = buildRundownPastePlan({
      items: [
        { id: 11, productName: "旧1" },
        { id: 12, productName: "旧2" },
      ],
      selection: { type: "column", columnKey: "productName" },
      text: copied,
    });
    expect(plan.trailingBlankRows).toBe(1);
    expect(plan.updates).toEqual([
      { id: 11, changes: { productName: "商品A" } },
      { id: 12, changes: { productName: null } },
    ]);
  });

  it("pastes a multi-row range from the selected row and normalizes constrained cells", () => {
    const plan = buildRundownPastePlan({
      items: [
        { id: 11, productName: "旧1" },
        { id: 12, productName: "旧2" },
        { id: 13, productName: "旧3" },
      ],
      selection: { type: "row", rowIndex: 1 },
      text: "新2\t20:00-20:05\t主推\t\thttps://example.com/p\t品牌A\t必播品\n新3\t20:05-20:10\t返场\t\t\t品牌B\t可选品",
    });
    expect(plan).toMatchObject({ sourceRows: 2, sourceColumns: 7, targetRows: 2, truncatedRows: 0 });
    expect(plan.updates[0]).toMatchObject({
      id: 12,
      changes: { productName: "新2", timeSlot: "20:00-20:05", productAttribute: "required" },
    });
    expect(plan.updates[1]).toMatchObject({
      id: 13,
      changes: { productName: "新3", productAttribute: "optional" },
    });
  });

  it("rejects malformed column pastes and reports rows beyond the current table", () => {
    expect(() => buildRundownPastePlan({
      items: [{ id: 1, listPrice: null }],
      selection: { type: "column", columnKey: "listPrice" },
      text: "100\t200",
    })).toThrow("选择整列时");
    expect(() => buildRundownPastePlan({
      items: [{ id: 1, liveDiscountRate: null }],
      selection: { type: "column", columnKey: "liveDiscountRate" },
      text: "101%",
    })).toThrow("不能大于100");
    expect(buildRundownPastePlan({
      items: [{ id: 1, productName: "旧" }],
      selection: { type: "column", columnKey: "productName" },
      text: "新1\n新2\n新3",
    }).truncatedRows).toBe(2);
  });
});

describe("Rundown clipboard persistence and UI contract", () => {
  const router = read("server/rundownRouter.ts");
  const page = read("client/src/pages/RundownManager.tsx");

  it("validates a strict whitelist and commits all pasted rows in one transaction", () => {
    expect(router).toContain("rundownClipboardChangesSchema");
    expect(router).toContain("}).strict().refine");
    expect(router).toContain("batchUpdateItems: protectedProcedure");
    expect(router).toContain("updates: z.array");
    expect(router).toContain(".min(1).max(200)");
    expect(router).toContain("await connection.beginTransaction()");
    expect(router).toContain("WHERE sessionId = ? AND id IN");
    expect(router).toContain("await connection.commit()");
    expect(router).toContain("await connection.rollback()");
  });

  it("provides accessible row/column selection, keyboard copy and paste preview", () => {
    expect(page).toContain("表格式复制 / 粘贴");
    expect(page).toContain("点击左侧序号选择整行，点击蓝色表头选择整列");
    expect(page).toContain("aria-pressed={selectedColumnIndex === index}");
    expect(page).toContain('type: "row", rowIndex: idx');
    expect(page).toContain("onPaste={handleGridPaste}");
    expect(page).toContain("event.key.toLowerCase() === \"c\"");
    expect(page).toContain("粘贴到选择");
    expect(page).toContain("确认保存");
    expect(page).toContain("batchUpdateMutation.mutate({ sessionId, updates: plan.updates })");
  });
});
