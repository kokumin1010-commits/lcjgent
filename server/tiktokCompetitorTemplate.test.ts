import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { TIKTOK_COMPETITOR_TEMPLATE_HEADERS } from "../shared/tiktokCompetitorTemplate";
import { parseKalodataRows } from "./tiktokCompetitorDaily";

describe("TikTok competitor blank template", () => {
  it("writes exactly 13 headers without click or conversion rates", () => {
    expect(TIKTOK_COMPETITOR_TEMPLATE_HEADERS).toEqual([
      "店铺排名",
      "店铺ID",
      "店铺名称",
      "店铺链接",
      "商品排名",
      "商品ID",
      "商品名称",
      "商品链接",
      "原价",
      "直播成交价",
      "销量",
      "销售额",
      "热度表现",
    ]);
    expect(TIKTOK_COMPETITOR_TEMPLATE_HEADERS).not.toContain("点击率");
    expect(TIKTOK_COMPETITOR_TEMPLATE_HEADERS).not.toContain("转化率");

    const sheet = XLSX.utils.json_to_sheet([], {
      header: [...TIKTOK_COMPETITOR_TEMPLATE_HEADERS],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Kalodata排名");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const downloaded = XLSX.read(bytes, { type: "buffer" });

    expect(downloaded.SheetNames).toEqual(["Kalodata排名"]);
    expect(
      XLSX.utils.sheet_to_json(downloaded.Sheets["Kalodata排名"], {
        header: 1,
      })[0]
    ).toEqual([...TIKTOK_COMPETITOR_TEMPLATE_HEADERS]);
  });

  it("accepts the new template shape and keeps omitted rates unknown", () => {
    const result = parseKalodataRows([
      {
        店铺排名: 1,
        店铺名称: "新模板店铺",
        商品排名: 1,
        商品名称: "新模板商品",
        商品链接: "https://example.com/new-template-product",
        销量: 12,
        销售额: 24000,
        热度表现: "直播间反复主推",
      },
    ]);

    expect(result.recognizedRows).toBe(1);
    expect(result.top5[0].products[0].clickRate).toBeNull();
    expect(result.top5[0].products[0].conversionRate).toBeNull();
  });

  it("continues to parse legacy files that contain the removed columns", () => {
    const result = parseKalodataRows([
      {
        店铺排名: 1,
        店铺名称: "旧模板店铺",
        商品排名: 1,
        商品名称: "旧模板商品",
        点击率: "12.5%",
        转化率: "4%",
      },
    ]);

    expect(result.top5[0].products[0].clickRate).toBeCloseTo(0.125);
    expect(result.top5[0].products[0].conversionRate).toBeCloseTo(0.04);
  });
});
