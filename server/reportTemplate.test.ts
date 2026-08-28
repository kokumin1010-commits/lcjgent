import { describe, expect, it } from "vitest";
import { DAILY_REPORT_PLACEHOLDERS } from "../client/src/pages/reportTemplate";

describe("daily report placeholders", () => {
  it("contains every required report section", () => {
    expect(DAILY_REPORT_PLACEHOLDERS.workContent).toContain("今日已完成");
    expect(DAILY_REPORT_PLACEHOLDERS.issues).toContain("待跟进事项");
    expect(DAILY_REPORT_PLACEHOLDERS.issues).toContain("问题/备注");
    expect(DAILY_REPORT_PLACEHOLDERS.remarks).toContain("明日优先工作");
    expect(DAILY_REPORT_PLACEHOLDERS.remarks).toContain("附件");
  });

  it("provides actionable examples for each field", () => {
    expect(DAILY_REPORT_PLACEHOLDERS.workContent).toContain("写明结果或数据");
    expect(DAILY_REPORT_PLACEHOLDERS.issues).toContain("下一步具体动作");
    expect(DAILY_REPORT_PLACEHOLDERS.issues).toContain("需要谁协助");
    expect(DAILY_REPORT_PLACEHOLDERS.remarks).toContain("优先事项");
  });
});
