import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({ execute: state.execute })),
  getLineMessages: vi.fn(async () => []),
  getLiverInteractionSummary: vi.fn(async () => null),
  saveLineMessage: vi.fn(),
}));
vi.mock("./line", () => ({
  pushMessage: vi.fn(),
}));
vi.mock("./_core/dataApi", () => ({ callDataApi: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));

import { getLineGroupAiInsight } from "./lineAiManager";

describe("LINE group AI settings failure policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    state.execute.mockReset();
  });

  it("propagates a settings query failure instead of returning synthetic disabled settings", async () => {
    state.execute.mockRejectedValueOnce(new Error("temporary database failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(getLineGroupAiInsight("C00000000000000000000000000000001"))
      .rejects.toThrow("LINE_GROUP_AI_SETTINGS_UNAVAILABLE");
    expect(log).toHaveBeenCalledWith(
      "[LINE AI Manager] Group AI settings unavailable",
      expect.objectContaining({ code: "LINE_GROUP_AI_SETTINGS_UNAVAILABLE" }),
    );
  });
});
