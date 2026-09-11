import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

describe("LINE general AI auto-reply disabled contract", () => {
  const agent = read("server/lineAgent.ts");
  const db = read("server/db.ts");
  const router = read("server/routers.ts");
  const pendingPage = read("client/src/pages/PendingResponses.tsx");

  const processStart = agent.indexOf(
    "export async function processLineMessage(event: LineWebhookEvent)"
  );
  const processEnd = agent.indexOf(
    "// Process video message from LINE",
    processStart
  );
  const processBlock = agent.slice(processStart, processEnd);

  it("keeps general customer conversation auto-replies switched off", () => {
    expect(agent).toContain("LINE_GENERAL_AI_AUTO_REPLY_ENABLED = false");
    expect(processBlock).not.toContain("const response = await invokeLLM");
    expect(processBlock).not.toContain("replyText");
    expect(processBlock).not.toContain("処理中にエラーが発生しました");
    expect(processBlock).toContain("await queueMessageForHumanResponse(event");
  });

  it("queues ordinary messages for staff without sending a customer response", () => {
    const queueStart = agent.indexOf(
      "async function queueMessageForHumanResponse"
    );
    const queueEnd = agent.indexOf(
      "// Types for LINE webhook events",
      queueStart
    );
    const queueBlock = agent.slice(queueStart, queueEnd);

    expect(queueBlock).toContain("await saveLineMessage({");
    expect(queueBlock).toContain('direction: "incoming"');
    expect(queueBlock).toContain("needsResponse: true");
    expect(queueBlock).toContain('responseStatus: "pending"');
    expect(queueBlock).not.toContain("replyMessage(");
  });

  it("preserves explicit point-history and reminder business commands", () => {
    const pointIndex = processBlock.indexOf("containsPointsHistoryKeyword");
    const reminderIndex = processBlock.indexOf("containsReminderKeyword");
    const disabledIndex = processBlock.indexOf(
      "if (!LINE_GENERAL_AI_AUTO_REPLY_ENABLED)"
    );

    expect(pointIndex).toBeGreaterThan(0);
    expect(reminderIndex).toBeGreaterThan(pointIndex);
    expect(disabledIndex).toBeGreaterThan(reminderIndex);
    expect(processBlock.slice(0, disabledIndex)).toContain("replyMessage(");
  });

  it("handles duplicate webhook deliveries without creating error replies", () => {
    const saveStart = db.indexOf("export async function saveLineMessage");
    const saveEnd = db.indexOf(
      "// Get LINE messages for a user or group",
      saveStart
    );
    const saveBlock = db.slice(saveStart, saveEnd);

    expect(saveBlock).toContain('errorCode === "ER_DUP_ENTRY"');
    expect(saveBlock).toContain("return null");
  });

  it("keeps staff replies available for direct users and groups", () => {
    const sendStart = router.indexOf("sendMessage: protectedProcedure");
    const sendEnd = router.indexOf("// Link LINE user", sendStart);
    const sendBlock = router.slice(sendStart, sendEnd);

    expect(sendBlock).toContain("await pushMessage(input.to");
    expect(sendBlock).toContain("await markMessageResponded(input.to");
    expect(router).toContain("z.object({ targetId: z.string() })");
    expect(pendingPage).toContain(
      "markAsRespondedMutation.mutate({ targetId: confirmDialog.targetId })"
    );
    expect(pendingPage).toContain("item.targetId && handleMarkAsResponded");
  });
});
