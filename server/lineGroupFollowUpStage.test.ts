import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyLineGroupFollowUpStage } from "./lineGroupFollowUpStage";

const managerSource = readFileSync(resolve(process.cwd(), "server/lineAiManager.ts"), "utf8");

describe("LINE group follow-up stage", () => {
  it("moves a recently decided livestream into post-decision support", () => {
    expect(classifyLineGroupFollowUpStage([
      "参加者1: 10月2日にライブ配信します。",
      "LCJ公式LINE: 承知しました。日程は決定で進めます。",
    ].join("\n"))).toBe("post_decision_support");
  });

  it("does not treat an unresolved plan as decided", () => {
    expect(classifyLineGroupFollowUpStage([
      "参加者1: ライブ配信を検討しています。",
      "参加者1: 日程はまだ決まっていません。",
    ].join("\n"))).toBe("planning");
  });

  it("recognizes an affirmative confirmed state", () => {
    expect(classifyLineGroupFollowUpStage("参加者1: 配信条件は確定しています。"))
      .toBe("post_decision_support");
  });

  it("uses a newer explicit decision after an earlier pending state", () => {
    expect(classifyLineGroupFollowUpStage([
      "参加者1: 日程はまだ確認中です。",
      "参加者1: 確認が取れ、ライブ日程は10月2日に決定しました。",
    ].join("\n"))).toBe("post_decision_support");
  });

  it("does not offer delivery support after a cancellation or postponement", () => {
    expect(classifyLineGroupFollowUpStage([
      "参加者1: 配信日は10月2日に決定しました。",
      "参加者1: ただし今回は配信を中止します。",
    ].join("\n"))).toBe("planning");
  });

  it("does not treat a confirmation question as a final decision", () => {
    expect(classifyLineGroupFollowUpStage("参加者1: 次回のライブ日程は決定でしょうか？"))
      .toBe("planning");
    expect(classifyLineGroupFollowUpStage("参加者1: 直播日程确定了吗？"))
      .toBe("planning");
  });

  it("fails closed for ordinary Japanese and Chinese proposals", () => {
    expect(classifyLineGroupFollowUpStage("参加者1: 10月2日にライブ配信しますか？"))
      .toBe("planning");
    expect(classifyLineGroupFollowUpStage("参加者1: この条件で進めますか？"))
      .toBe("planning");
    expect(classifyLineGroupFollowUpStage("参加者1: 10月2日直播可以吗？"))
      .toBe("planning");
    expect(classifyLineGroupFollowUpStage("参加者1: 如果库存足够，就决定10月2日直播。"))
      .toBe("planning");
  });

  it.each([
    "在庫が十分なら、この条件で進めます。",
    "確認が取れたら、10月2日にライブ配信します。",
    "在庫が足りれば、この条件で進めます。",
    "実施する場合、10月2日にライブ配信します。",
  ])("fails closed for a Japanese conditional statement: %s", message => {
    expect(classifyLineGroupFollowUpStage(`参加者1: ${message}`)).toBe("planning");
  });

  it("does not combine separate topic and proposal messages into a decision", () => {
    expect(classifyLineGroupFollowUpStage([
      "参加者1: 次回のライブ配信について相談です。",
      "参加者2: この内容で進めますか？",
    ].join("\n"))).toBe("planning");
  });

  it("uses only the recent conversation slice so an old decision cannot override a new pending state", () => {
    const transcript = [
      "参加者1: 以前のライブ日程は決定しました。",
      ...Array.from({ length: 8 }, (_, index) => `参加者${index + 1}: 確認事項${index + 1}`),
      "参加者1: 次のライブ日程はまだ確認中です。",
    ].join("\n");
    expect(classifyLineGroupFollowUpStage(transcript)).toBe("planning");
  });

  it("keeps general relationship conversations in discovery", () => {
    expect(classifyLineGroupFollowUpStage("参加者1: ありがとうございます。よろしくお願いします。"))
      .toBe("discovery");
  });

  it("uses the stage in persisted AI insight and post-decision support copy", () => {
    expect(managerSource).toContain("classifyLineGroupFollowUpStage(groupContext.followUpStageTranscript)");
    expect(managerSource).toContain("lastAutoFollowUpAt");
    expect(managerSource).toContain('startsWith("auto_followup_")');
    expect(managerSource).toContain('ne(lineMessages.direction, "outgoing")');
    expect(managerSource).toContain('eq(lineMessages.responseStatus, "responded")');
    expect(managerSource).toContain("getConversationMessageAt(message)");
    expect(managerSource).toContain('followUpStage === "post_decision_support"');
    expect(managerSource).toContain('insight.followUpStage !== "post_decision_support"');
    expect(managerSource).toContain("決まった内容での配信準備はいかがでしょうか");
    expect(managerSource).toContain("followUpStage,");
  });
});
