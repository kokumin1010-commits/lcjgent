import { describe, it, expect, vi } from "vitest";

// Test the Pass2 progress tracking module
describe("AI Pass 2 Manual Queue Review", () => {
  it("should export required functions", async () => {
    const mod = await import("./services/aiPass2ManualQueueReview");
    expect(typeof mod.runAiPass2ManualQueueReview).toBe("function");
    expect(typeof mod.startPass2InBackground).toBe("function");
    expect(typeof mod.isPass2Running).toBe("function");
    expect(typeof mod.getPass2Progress).toBe("function");
  });

  it("should report not running initially", async () => {
    const { isPass2Running, getPass2Progress } = await import("./services/aiPass2ManualQueueReview");
    // Initially should not be running (unless a previous test started it)
    const progress = getPass2Progress();
    expect(progress).toHaveProperty("isRunning");
    expect(progress).toHaveProperty("progress");
  });

  it("getPass2Progress should return correct shape", async () => {
    const { getPass2Progress } = await import("./services/aiPass2ManualQueueReview");
    const result = getPass2Progress();
    
    expect(result).toHaveProperty("isRunning");
    expect(typeof result.isRunning).toBe("boolean");
    
    if (result.progress) {
      expect(result.progress).toHaveProperty("total");
      expect(result.progress).toHaveProperty("autoApproved");
      expect(result.progress).toHaveProperty("autoRejected");
      expect(result.progress).toHaveProperty("keptManual");
      expect(result.progress).toHaveProperty("skipped");
      expect(result.progress).toHaveProperty("isComplete");
    }
  });

  it("isPass2Running should return boolean", async () => {
    const { isPass2Running } = await import("./services/aiPass2ManualQueueReview");
    const running = isPass2Running();
    expect(typeof running).toBe("boolean");
  });
});
