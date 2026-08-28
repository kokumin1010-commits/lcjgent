import { describe, expect, it } from "vitest";
import {
  buildPayrollEmployeeAliasClear,
  buildPayrollEmployeeAliasMap,
  buildPayrollEmployeeAliasUpdate,
  formatPayrollEmployeeDisplayName,
  formatPayrollEmployeeFilterDisplayName,
  getPayrollEmployeeAliasKey,
} from "../client/src/lib/payrollEmployeeAlias";

describe("payrollEmployeeAlias", () => {
  it("formats a WeChat display name in parentheses", () => {
    expect(formatPayrollEmployeeDisplayName("刘高荣", "小刘")).toBe("刘高荣（小刘）");
  });

  it("keeps the formal name when the WeChat name is empty or identical", () => {
    expect(formatPayrollEmployeeDisplayName("刘高荣", "")).toBe("刘高荣");
    expect(formatPayrollEmployeeDisplayName("刘高荣", "刘高荣")).toBe("刘高荣");
  });

  it("isolates Japanese and Chinese employees with the same formal name", () => {
    const aliases = buildPayrollEmployeeAliasMap([
      { entity: "japan", employeeName: "同名", wechatName: "日本微信名" },
      { entity: "china", employeeName: "同名", wechatName: "中国微信名" },
    ]);
    expect(aliases.get(getPayrollEmployeeAliasKey("japan", "同名"))?.wechatName).toBe("日本微信名");
    expect(aliases.get(getPayrollEmployeeAliasKey("china", "同名"))?.wechatName).toBe("中国微信名");
  });

  it("shows saved WeChat names in the employee filter", () => {
    const aliases = [
      { entity: "japan" as const, employeeName: "同名", wechatName: "日本微信名" },
      { entity: "china" as const, employeeName: "同名", wechatName: "中国微信名" },
      { entity: "china" as const, employeeName: "无别名", wechatName: "" },
    ];
    expect(formatPayrollEmployeeFilterDisplayName("同名", "japan", aliases)).toBe("同名（日本微信名）");
    expect(formatPayrollEmployeeFilterDisplayName("同名", "all", aliases)).toBe("同名（日本微信名 / 中国微信名）");
    expect(formatPayrollEmployeeFilterDisplayName("无别名", "all", aliases)).toBe("无别名");
  });

  it("normalizes save values and creates an explicit empty clear payload", () => {
    expect(buildPayrollEmployeeAliasUpdate("china", " 柴苏妮 ", " 小柴 ", " 微信备注 ")).toEqual({
      entity: "china",
      employeeName: "柴苏妮",
      wechatName: "小柴",
      note: "微信备注",
    });
    expect(buildPayrollEmployeeAliasClear("china", "柴苏妮")).toEqual({
      entity: "china",
      employeeName: "柴苏妮",
      wechatName: "",
      note: "",
    });
    expect(formatPayrollEmployeeDisplayName("柴苏妮", buildPayrollEmployeeAliasClear("china", "柴苏妮").wechatName)).toBe("柴苏妮");
  });
});
