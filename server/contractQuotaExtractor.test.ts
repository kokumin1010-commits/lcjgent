/**
 * contractQuotaExtractor.test.ts
 * 
 * LLMベースのノルマ数値＋契約期間自動抽出ロジックのテスト
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { extractQuotaFromConditions, extractQuotaBatch } from "./contractQuotaExtractor";
import { invokeLLM } from "./_core/llm";

const mockedInvokeLLM = vi.mocked(invokeLLM);

function mockLLMResponse(data: Record<string, any>) {
  mockedInvokeLLM.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(data) } }],
  } as any);
}

describe("extractQuotaFromConditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty quota when no text is provided", async () => {
    const result = await extractQuotaFromConditions({});
    expect(result.kgLiveHoursQuota).toBeNull();
    expect(result.liverLiveHoursQuota).toBeNull();
    expect(result.shortVideoCountQuota).toBeNull();
    expect(result.contractPeriodLabel).toBeNull();
    // LLM should NOT be called when no text
    expect(mockedInvokeLLM).not.toHaveBeenCalled();
  });

  it("should extract KG live quota from condition text", async () => {
    mockLLMResponse({
      kgLiveHoursQuota: 60,
      kgLiveFrequency: 1,
      kgLiveMinutesPerSession: 60,
      liverLiveHoursQuota: null,
      liverLiveAssignments: null,
      shortVideoCountQuota: null,
      shortVideoAssignments: null,
      contractPeriodLabel: null,
    });

    const result = await extractQuotaFromConditions({
      kgLiveCondition: "每月1小时专场直播",
    });

    expect(result.kgLiveHoursQuota).toBe(60);
    expect(result.kgLiveFrequency).toBe(1);
    expect(result.kgLiveMinutesPerSession).toBe(60);
    expect(mockedInvokeLLM).toHaveBeenCalledOnce();
  });

  it("should extract liver live quota with assignments", async () => {
    mockLLMResponse({
      kgLiveHoursQuota: null,
      kgLiveFrequency: null,
      kgLiveMinutesPerSession: null,
      liverLiveHoursQuota: 420,
      liverLiveAssignments: [
        { liverName: "nana", minutesPerMonth: 120 },
        { liverName: "yae", minutesPerMonth: 300 },
      ],
      shortVideoCountQuota: null,
      shortVideoAssignments: null,
      contractPeriodLabel: null,
    });

    const result = await extractQuotaFromConditions({
      liverLiveCondition: "nana每月2小时、yae每月5小时",
    });

    expect(result.liverLiveHoursQuota).toBe(420);
    expect(result.liverLiveAssignments).toHaveLength(2);
    expect(result.liverLiveAssignments![0].liverName).toBe("nana");
    expect(result.liverLiveAssignments![0].minutesPerMonth).toBe(120);
    expect(result.liverLiveAssignments![1].liverName).toBe("yae");
    expect(result.liverLiveAssignments![1].minutesPerMonth).toBe(300);
  });

  it("should extract short video quota", async () => {
    mockLLMResponse({
      kgLiveHoursQuota: null,
      kgLiveFrequency: null,
      kgLiveMinutesPerSession: null,
      liverLiveHoursQuota: null,
      liverLiveAssignments: null,
      shortVideoCountQuota: 30,
      shortVideoAssignments: null,
      contractPeriodLabel: null,
    });

    const result = await extractQuotaFromConditions({
      shortVideoCondition: "30条视频/月",
    });

    expect(result.shortVideoCountQuota).toBe(30);
  });

  it("should extract contract period label from dates", async () => {
    mockLLMResponse({
      kgLiveHoursQuota: null,
      kgLiveFrequency: null,
      kgLiveMinutesPerSession: null,
      liverLiveHoursQuota: null,
      liverLiveAssignments: null,
      shortVideoCountQuota: null,
      shortVideoAssignments: null,
      contractPeriodLabel: "半年框",
    });

    const result = await extractQuotaFromConditions({
      kgLiveCondition: "每月1小时",
      startDate: "2025-12-11",
      endDate: "2026-06-30",
    });

    expect(result.contractPeriodLabel).toBe("半年框");
  });

  it("should extract combined conditions (KG + liver + video)", async () => {
    mockLLMResponse({
      kgLiveHoursQuota: 60,
      kgLiveFrequency: 1,
      kgLiveMinutesPerSession: 60,
      liverLiveHoursQuota: 1200,
      liverLiveAssignments: [
        { liverName: "YAE", minutesPerMonth: 600 },
        { liverName: "NANA", minutesPerMonth: 300 },
        { liverName: "SHIHO", minutesPerMonth: 300 },
      ],
      shortVideoCountQuota: 30,
      shortVideoAssignments: null,
      contractPeriodLabel: "3个月",
    });

    const result = await extractQuotaFromConditions({
      kgLiveCondition: "每月1小时专场直播",
      liverLiveCondition: "腰部达人（YAE、NANA、SHIHO等）：每月直播总时长 不低于20小时\n※客户要求yae10小时",
      shortVideoCondition: "短视频要求：30条视频/月",
      startDate: "2026-04-08",
      endDate: "2026-07-08",
    });

    expect(result.kgLiveHoursQuota).toBe(60);
    expect(result.liverLiveHoursQuota).toBe(1200);
    expect(result.shortVideoCountQuota).toBe(30);
    expect(result.contractPeriodLabel).toBe("3个月");
    expect(result.liverLiveAssignments).toHaveLength(3);
  });

  it("should handle LLM error gracefully", async () => {
    mockedInvokeLLM.mockRejectedValueOnce(new Error("LLM service unavailable"));

    const result = await extractQuotaFromConditions({
      kgLiveCondition: "每月1小时",
    });

    // Should return empty quota on error, not throw
    expect(result.kgLiveHoursQuota).toBeNull();
    expect(result.liverLiveHoursQuota).toBeNull();
  });

  it("should handle empty LLM response", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: "" } }],
    } as any);

    const result = await extractQuotaFromConditions({
      kgLiveCondition: "每月1小时",
    });

    expect(result.kgLiveHoursQuota).toBeNull();
  });

  it("should include date info in prompt when dates are provided", async () => {
    mockLLMResponse({
      kgLiveHoursQuota: 60,
      kgLiveFrequency: null,
      kgLiveMinutesPerSession: null,
      liverLiveHoursQuota: null,
      liverLiveAssignments: null,
      shortVideoCountQuota: null,
      shortVideoAssignments: null,
      contractPeriodLabel: "半年矩阵",
    });

    await extractQuotaFromConditions({
      kgLiveCondition: "每月1小时",
      startDate: new Date("2026-04-13"),
      endDate: new Date("2026-10-13"),
    });

    // Verify LLM was called with date info in the prompt
    const callArgs = mockedInvokeLLM.mock.calls[0][0];
    const userMessage = callArgs.messages.find((m: any) => m.role === "user");
    expect(userMessage?.content).toContain("2026-04-13");
    expect(userMessage?.content).toContain("2026-10-13");
  });
});

describe("extractQuotaBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should process multiple contracts in sequence", async () => {
    // First contract
    mockLLMResponse({
      kgLiveHoursQuota: 60,
      kgLiveFrequency: 1,
      kgLiveMinutesPerSession: 60,
      liverLiveHoursQuota: null,
      liverLiveAssignments: null,
      shortVideoCountQuota: null,
      shortVideoAssignments: null,
      contractPeriodLabel: null,
    });
    // Second contract
    mockLLMResponse({
      kgLiveHoursQuota: null,
      kgLiveFrequency: null,
      kgLiveMinutesPerSession: null,
      liverLiveHoursQuota: 1200,
      liverLiveAssignments: null,
      shortVideoCountQuota: 30,
      shortVideoAssignments: null,
      contractPeriodLabel: "3个月",
    });

    const results = await extractQuotaBatch([
      { id: 1, kgLiveCondition: "每月1小时专场直播" },
      { id: 2, liverLiveCondition: "毎月合計 20小时", shortVideoCondition: "30条视频/月" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(1);
    expect(results[0].quota.kgLiveHoursQuota).toBe(60);
    expect(results[1].id).toBe(2);
    expect(results[1].quota.liverLiveHoursQuota).toBe(1200);
    expect(results[1].quota.shortVideoCountQuota).toBe(30);
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(2);
  });

  it("should handle individual contract errors in batch", async () => {
    // First succeeds
    mockLLMResponse({
      kgLiveHoursQuota: 60,
      kgLiveFrequency: null,
      kgLiveMinutesPerSession: null,
      liverLiveHoursQuota: null,
      liverLiveAssignments: null,
      shortVideoCountQuota: null,
      shortVideoAssignments: null,
      contractPeriodLabel: null,
    });
    // Second fails
    mockedInvokeLLM.mockRejectedValueOnce(new Error("timeout"));

    const results = await extractQuotaBatch([
      { id: 1, kgLiveCondition: "每月1小时" },
      { id: 2, liverLiveCondition: "20小时" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].quota.kgLiveHoursQuota).toBe(60);
    // Second should have empty quota (error handled)
    expect(results[1].quota.kgLiveHoursQuota).toBeNull();
    expect(results[1].quota.liverLiveHoursQuota).toBeNull();
  });
});
