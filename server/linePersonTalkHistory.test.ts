import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
}));

import {
  __linePersonTalkHistoryTestUtils,
  getLinePersonTalkHistory,
  getLinePersonTalkHistoryUsingDb,
} from "./linePersonTalkHistory";

const LINE_USER_ID = "U1234567890123456789012345678901";

function tuple<T>(rows: T[]) {
  return [rows, []] as unknown;
}

describe("LINE person talk history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unlinked participant history across DM and every group with keyset pagination", async () => {
    let call = 0;
    const execute = vi.fn(async () => {
      call += 1;
      if (call === 1) {
        return tuple([{
          lineUserId: LINE_USER_ID,
          displayName: "Cindy",
          pictureUrl: "https://example.com/cindy.jpg",
          userType: "unknown",
          isBlocked: 0,
          liverId: null,
          createdAt: new Date("2026-09-20T00:00:00Z"),
          lastMessageAt: new Date("2026-09-22T00:00:00Z"),
        }]);
      }
      if (call === 2) {
        return tuple([{
          total: "3",
          incomingCount: "2",
          outgoingCount: "1",
          groupCount: "2",
          firstMessageAt: "1790000000000",
          lastMessageAt: "1790000300000",
        }]);
      }
      if (call === 3) {
        return tuple([
          {
            id: 10,
            messageId: "m-10",
            sourceType: "group",
            lineUserId: LINE_USER_ID,
            lineGroupId: "C-group-2",
            senderName: "Cindy",
            messageType: "text",
            content: "サンプルを送っていただけますか？",
            direction: "incoming",
            responseStatus: "responded",
            responseSummary: null,
            lineTimestamp: "1790000300000",
            createdAt: new Date("2026-09-22T00:05:00Z"),
          },
          {
            id: 9,
            messageId: "m-9",
            sourceType: "group",
            lineUserId: LINE_USER_ID,
            lineGroupId: "C-group-2",
            senderName: "高橋 悠真",
            messageType: "text",
            content: "アカウントの共有ありがとうございます。提供可否を確認します。",
            direction: "outgoing",
            responseStatus: "responded",
            responseSummary: "明示質問への定型回答",
            lineTimestamp: "1790000200000",
            createdAt: new Date("2026-09-22T00:03:00Z"),
          },
          {
            id: 8,
            messageId: "m-8",
            sourceType: "user",
            lineUserId: LINE_USER_ID,
            lineGroupId: null,
            senderName: "Cindy",
            messageType: "text",
            content: "DMの古い会話",
            direction: "incoming",
            responseStatus: "none",
            responseSummary: null,
            lineTimestamp: "1790000000000",
            createdAt: new Date("2026-09-22T00:00:00Z"),
          },
        ]);
      }
      return tuple([
        { lineGroupId: "C-group-2", groupName: "dr kozu cindy 様 LCJ" },
      ]);
    });

    const result = await getLinePersonTalkHistoryUsingDb({ execute } as never, {
      lineUserId: LINE_USER_ID,
      limit: 2,
    });

    expect(result.person).toMatchObject({
      displayName: "Cindy",
      liverId: null,
      userType: "unknown",
    });
    expect(result.items.map((item) => item.id)).toEqual([10, 9]);
    expect(result.nextCursor).toBe(9);
    expect(result.stats).toEqual({
      total: 3,
      incomingCount: 2,
      outgoingCount: 1,
      groupCount: 2,
      firstMessageAt: 1790000000000,
      lastMessageAt: 1790000300000,
    });
    expect(result.groupNames).toEqual({ "C-group-2": "dr kozu cindy 様 LCJ" });
    expect(execute).toHaveBeenCalledTimes(4);
  });

  it("falls back to the saved sender name when enrichment has not created a profile row", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(tuple([]))
      .mockResolvedValueOnce(tuple([{
        total: 1,
        incomingCount: 1,
        outgoingCount: 0,
        groupCount: 1,
        firstMessageAt: 1790000000000,
        lastMessageAt: 1790000000000,
      }]))
      .mockResolvedValueOnce(tuple([{
        id: 1,
        messageId: "m-1",
        sourceType: "group",
        lineUserId: LINE_USER_ID,
        lineGroupId: "C-group",
        senderName: "未連携の参加者",
        messageType: "text",
        content: "質問です",
        direction: "incoming",
        responseStatus: "none",
        responseSummary: null,
        lineTimestamp: 1790000000000,
        createdAt: new Date("2026-09-22T00:00:00Z"),
      }]))
      .mockResolvedValueOnce(tuple([{ lineGroupId: "C-group", groupName: null }]));

    const result = await getLinePersonTalkHistoryUsingDb({ execute } as never, {
      lineUserId: LINE_USER_ID,
    });

    expect(result.person.displayName).toBe("未連携の参加者");
    expect(result.person.liverId).toBeNull();
    expect(result.nextCursor).toBeNull();
  });

  it("loads sequential cursor pages without duplicate message IDs", async () => {
    const profile = [{
      lineUserId: LINE_USER_ID,
      displayName: "Cindy",
      pictureUrl: null,
      userType: "unknown",
      isBlocked: 0,
      liverId: null,
      createdAt: new Date("2026-09-20T00:00:00Z"),
      lastMessageAt: new Date("2026-09-22T00:00:00Z"),
    }];
    const stats = [{ total: 3, incomingCount: 3, outgoingCount: 0, groupCount: 0 }];
    const message = (id: number) => ({
      id,
      messageId: `m-${id}`,
      sourceType: "user" as const,
      lineUserId: LINE_USER_ID,
      lineGroupId: null,
      senderName: "Cindy",
      messageType: "text",
      content: `message-${id}`,
      direction: "incoming" as const,
      responseStatus: "none" as const,
      responseSummary: null,
      lineTimestamp: 1790000000000 + id,
      createdAt: new Date("2026-09-22T00:00:00Z"),
    });
    const execute = vi.fn()
      .mockResolvedValueOnce(tuple(profile))
      .mockResolvedValueOnce(tuple(stats))
      .mockResolvedValueOnce(tuple([message(3), message(2), message(1)]))
      .mockResolvedValueOnce(tuple(profile))
      .mockResolvedValueOnce(tuple(stats))
      .mockResolvedValueOnce(tuple([message(1)]));

    const first = await getLinePersonTalkHistoryUsingDb({ execute } as never, {
      lineUserId: LINE_USER_ID,
      limit: 2,
    });
    const second = await getLinePersonTalkHistoryUsingDb({ execute } as never, {
      lineUserId: LINE_USER_ID,
      cursor: first.nextCursor || undefined,
      limit: 2,
    });

    expect(first.items.map((item) => item.id)).toEqual([3, 2]);
    expect(first.nextCursor).toBe(2);
    expect(second.items.map((item) => item.id)).toEqual([1]);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);
  });

  it("rejects an invalid cursor before querying the database", async () => {
    const execute = vi.fn();
    await expect(getLinePersonTalkHistoryUsingDb({ execute } as never, {
      lineUserId: LINE_USER_ID,
      cursor: 0,
    })).rejects.toThrow("履歴カーソルが不正です");
    expect(execute).not.toHaveBeenCalled();
  });

  it("loads the configured database in the public wrapper", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(tuple([]))
      .mockResolvedValueOnce(tuple([{ total: 0 }]))
      .mockResolvedValueOnce(tuple([]));
    mocks.getDb.mockResolvedValue({ execute });

    const result = await getLinePersonTalkHistory({ lineUserId: LINE_USER_ID, limit: 20 });
    expect(result.stats.total).toBe(0);
    expect(result.limit).toBe(20);
  });

  it("normalizes execute tuples and bounded numeric inputs", () => {
    expect(__linePersonTalkHistoryTestUtils.firstExecuteRows(tuple([{ id: 1 }]))).toEqual([{ id: 1 }]);
    expect(__linePersonTalkHistoryTestUtils.firstExecuteRows([{ id: 2 }])).toEqual([{ id: 2 }]);
    expect(__linePersonTalkHistoryTestUtils.positiveInteger(500, 100, 100)).toBe(100);
    expect(__linePersonTalkHistoryTestUtils.nullableTimestamp("1790000000000")).toBe(1790000000000);
  });
});
