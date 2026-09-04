import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: getDbMock,
}));

import { executeToolCall } from "./lcjBrainTools";

function createSelectDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select }, select, from, where, orderBy, limit };
}

describe("LCJ Brain livestream review tool", () => {
  beforeEach(() => {
    getDbMock.mockReset();
  });

  it("returns saved review text as a real-time livestream source", async () => {
    const review = {
      id: 750026,
      livestreamDate: new Date("2026-09-04T11:00:00Z"),
      streamerName: "test-streamer",
      liverId: 24,
      brandId: 7,
      salesAmount: 131089,
      gmv: 131089,
      duration: 215,
      viewerCount: 2650,
      orderCount: 30,
      result: null,
      impactFactor: null,
      resultReason: null,
      livestreamReview: "转化率偏低，下场调整前30分钟商品顺序。",
      updatedAt: new Date("2026-09-04T12:00:00Z"),
    };
    const chain = createSelectDb([review]);
    getDbMock.mockResolvedValue(chain.db);

    const raw = await executeToolCall({
      id: "review-search-1",
      type: "function",
      function: {
        name: "search_livestream_reviews",
        arguments: JSON.stringify({ query: "转化率", liverId: 24, limit: 5 }),
      },
    });
    const result = JSON.parse(raw);

    expect(result.source).toBe("brand_livestreams.livestreamReview");
    expect(result.total).toBe(1);
    expect(result.reviews[0].livestreamReview).toContain("调整前30分钟");
    expect(chain.limit).toHaveBeenCalledWith(5);
  });

  it("caps result size and returns an explicit database error when unavailable", async () => {
    const chain = createSelectDb([]);
    getDbMock.mockResolvedValueOnce(chain.db);
    const capped = JSON.parse(
      await executeToolCall({
        id: "review-search-2",
        type: "function",
        function: {
          name: "search_livestream_reviews",
          arguments: JSON.stringify({ limit: 999 }),
        },
      })
    );
    expect(capped.total).toBe(0);
    expect(chain.limit).toHaveBeenCalledWith(30);

    getDbMock.mockResolvedValueOnce(null);
    const unavailable = JSON.parse(
      await executeToolCall({
        id: "review-search-3",
        type: "function",
        function: {
          name: "search_livestream_reviews",
          arguments: "{}",
        },
      })
    );
    expect(unavailable).toEqual({ error: "DB unavailable" });
  });
});
