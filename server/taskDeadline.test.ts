import { describe, expect, it } from "vitest";
import { parseTaskDeadlineJst, taskDeadlineInputToJstRfc3339 } from "../shared/taskDeadline";

describe("task deadline JST semantics", () => {
  it("treats datetime-local as JST regardless of server timezone", () => {
    expect(parseTaskDeadlineJst("2026-09-22T18:00").toISOString()).toBe("2026-09-22T09:00:00.000Z");
    expect(taskDeadlineInputToJstRfc3339("2026-09-22T18:00")).toBe("2026-09-22T18:00:00+09:00");
  });

  it("treats date-only AI deadlines as JST end of day", () => {
    expect(parseTaskDeadlineJst("2026-09-22").toISOString()).toBe("2026-09-22T14:59:59.000Z");
  });

  it("preserves explicit offsets and rejects invalid dates", () => {
    expect(parseTaskDeadlineJst("2026-09-22T18:00:00+09:00").toISOString()).toBe("2026-09-22T09:00:00.000Z");
    expect(() => parseTaskDeadlineJst("not-a-date")).toThrow();
    expect(() => parseTaskDeadlineJst("2026-02-30T12:00")).toThrow();
  });
});
