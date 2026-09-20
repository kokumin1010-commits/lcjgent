import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RUNDOWN_PRODUCT_ATTRIBUTE_LABELS,
  calculateRundownLiveDiscountRate,
  isValidRundownTimeRange,
  normalizeRundownProductAttribute,
  normalizeRundownTime,
  parseRundownDiscountRate,
  resolveRundownLiveDiscountRate,
  rundownDurationMinutes,
} from "../shared/rundown";
import { RUNDOWN_CLIPBOARD_COLUMN_KEYS } from "../shared/rundownClipboard";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Rundown schedule and product rules", () => {
  it("accepts only valid 24-hour HH:mm values", () => {
    expect(normalizeRundownTime("20:30")).toBe("20:30");
    expect(normalizeRundownTime(" 09:05 ")).toBe("09:05");
    expect(normalizeRundownTime("24:00")).toBeNull();
    expect(normalizeRundownTime("9:05")).toBeNull();
  });

  it("supports overnight streams while rejecting zero or implausibly long ranges", () => {
    expect(rundownDurationMinutes("23:30", "01:00")).toBe(90);
    expect(isValidRundownTimeRange("23:30", "01:00")).toBe(true);
    expect(isValidRundownTimeRange("20:30", "20:30")).toBe(false);
    expect(isValidRundownTimeRange("20:30", "19:30")).toBe(false);
  });

  it("keeps product attributes constrained to required or optional", () => {
    expect(normalizeRundownProductAttribute("required")).toBe("required");
    expect(normalizeRundownProductAttribute("optional")).toBe("optional");
    expect(normalizeRundownProductAttribute("other")).toBeNull();
    expect(RUNDOWN_PRODUCT_ATTRIBUTE_LABELS.required).toBe("必播品");
    expect(RUNDOWN_PRODUCT_ATTRIBUTE_LABELS.optional).toBe("可选品");
  });

  it("calculates percent-off from list and live prices without guessing invalid prices", () => {
    expect(calculateRundownLiveDiscountRate(19_800, 5_980)).toBe(69.8);
    expect(calculateRundownLiveDiscountRate(10_000, 10_000)).toBe(0);
    expect(calculateRundownLiveDiscountRate(0, 1_000)).toBeNull();
    expect(calculateRundownLiveDiscountRate(5_000, 6_000)).toBeNull();
  });

  it("uses an explicit 0-100 discount rate before a derived rate", () => {
    expect(parseRundownDiscountRate(100)).toBe(100);
    expect(parseRundownDiscountRate(100.01)).toBeNull();
    expect(parseRundownDiscountRate("   ")).toBeNull();
    expect(resolveRundownLiveDiscountRate(0, 10_000, 5_000)).toBe(0);
    expect(resolveRundownLiveDiscountRate(null, 10_000, 5_000)).toBe(50);
  });
});

describe("Rundown persistence and UI wiring", () => {
  const page = read("client/src/pages/RundownManager.tsx");
  const router = read("server/rundownRouter.ts");

  it("renders an editable broadcast date and start/end time control", () => {
    expect(page).toContain("setEditingSchedule(true)");
    expect(page).toContain('type="date" value={scheduleDraft.liveDate}');
    expect(page).toContain('type="time" value={scheduleDraft.startTime}');
    expect(page).toContain('type="time" value={scheduleDraft.endTime}');
    expect(page).toContain("结束时间按次日计算");
    expect(router).toContain("rundownTimeSchema");
    expect(router).toContain("时间必须为 HH:mm");
    expect(router).toContain("isValidRundownTimeRange");
  });

  it("places attribute directly between brand and theme and keeps the quick-add row aligned", () => {
    const brandColumn = RUNDOWN_CLIPBOARD_COLUMN_KEYS.indexOf("brandName");
    const attributeColumn = RUNDOWN_CLIPBOARD_COLUMN_KEYS.indexOf("productAttribute");
    const themeColumn = RUNDOWN_CLIPBOARD_COLUMN_KEYS.indexOf("theme");
    expect(brandColumn).toBeGreaterThan(-1);
    expect(attributeColumn).toBe(brandColumn + 1);
    expect(themeColumn).toBe(attributeColumn + 1);
    expect(page).toContain("RUNDOWN_CLIPBOARD_COLUMNS.map");
    expect(page).toContain('placeholder="商品名称"');
    expect(page).toContain('placeholder="板块"');
    expect(page).toContain("cleanData.deliveryTime = itemForm.deliveryTime");
    expect(page).toContain('<option value="required">必播品</option>');
    expect(page).toContain('<option value="optional">可选品</option>');
    expect(page).toContain('field="section"');
    expect(page).toContain("colSpan={25}");
  });

  it("keeps live discount separate from commission and persists all new fields through copies", () => {
    expect(RUNDOWN_CLIPBOARD_COLUMN_KEYS).toContain("liveDiscountRate");
    expect(page).toContain('field="liveDiscountRate"');
    expect(page).toContain('suffix="%OFF"');
    expect(page).toContain('field="commissionRate"');
    expect(page).toContain("liveDiscountRate: null");
    expect(page).toContain("resolveRundownLiveDiscountRate(item.liveDiscountRate, item.listPrice, item.livePrice)");
    expect(page).not.toContain("liveDiscountRate: p.discountRate");
    expect(router).toContain("productAttribute ENUM('required','optional')");
    expect(router).toContain("liveDiscountRate DECIMAL(5,2)");
    expect(router).toContain("ensureRundownItemColumn(p, 'productAttribute'");
    expect(router).toContain("ensureRundownItemColumn(p, 'liveDiscountRate'");
    expect(router).toContain("ensureRundownTablesReady");
    expect(router).toContain("await ensureRundownTablesReady()");
    expect(router).toContain("item.productAttribute");
    expect(router).toContain("item.liveDiscountRate");
  });
});
