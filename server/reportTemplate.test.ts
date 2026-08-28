import { describe, expect, it } from "vitest";
import {
  DAILY_REPORT_TEMPLATE,
  hasUnfilledDailyReportPlaceholder,
  isDefaultDailyReportTemplate,
} from "../client/src/pages/reportTemplate";

describe("daily report template", () => {
  it("contains every required report section", () => {
    expect(DAILY_REPORT_TEMPLATE.workContent).toContain("今日已完成");
    expect(DAILY_REPORT_TEMPLATE.issues).toContain("待跟进事项");
    expect(DAILY_REPORT_TEMPLATE.issues).toContain("问题/备注");
    expect(DAILY_REPORT_TEMPLATE.remarks).toContain("明日优先工作");
    expect(DAILY_REPORT_TEMPLATE.remarks).toContain("附件");
  });

  it("detects template examples that were not replaced", () => {
    expect(
      hasUnfilledDailyReportPlaceholder(
        `${DAILY_REPORT_TEMPLATE.workContent}\n${DAILY_REPORT_TEMPLATE.issues}\n${DAILY_REPORT_TEMPLATE.remarks}`
      )
    ).toBe(true);
  });

  it("accepts completed report content", () => {
    const completedReport = `【✅ 今日已完成】\n1. 【咖啡店铺｜商品上架】完成3个套组上架。\n\n【⏳ 待跟进事项】\n1. 跟进新品曝光与出单。\n\n【📝 问题/备注（需要协调）】\n无\n\n【🎯 明日优先工作】\n1. 跟进达人回复。`;

    expect(hasUnfilledDailyReportPlaceholder(completedReport)).toBe(false);
  });

  it("recognizes untouched template fields", () => {
    expect(
      isDefaultDailyReportTemplate(
        "workContent",
        DAILY_REPORT_TEMPLATE.workContent
      )
    ).toBe(true);
    expect(isDefaultDailyReportTemplate("issues", "已填写实际内容")).toBe(
      false
    );
  });
});
