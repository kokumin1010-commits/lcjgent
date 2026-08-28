import { describe, expect, it, vi } from "vitest";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  getLiverAdEffectDashboard,
  LiverAdEffectPersistenceError,
  type LiverAdEffectPool,
  updateOwnLivestreamAdCost,
} from "./liverAdEffect";

function makeConnection(selectRows: RowDataPacket[], affectedRows = 1) {
  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockResolvedValue([selectRows, []]),
    execute: vi.fn().mockResolvedValue([{ affectedRows } as ResultSetHeader, []]),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
  return connection;
}

describe("getLiverAdEffectDashboard", () => {
  it("reads only the requested liver/month inputs and combines linked ads and product units", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([[
        {
          id: 11,
          livestreamDate: new Date("2026-08-04T00:00:00.000Z"),
          brandName: "KG",
          adCost: null,
          salesAmount: 10000,
          manualSalesAmount: null,
          gmv: null,
          orderCount: 5,
          itemsSold: null,
          viewerCount: 100,
          duration: 60,
        },
        {
          id: 12,
          livestreamDate: new Date("2026-08-05T00:00:00.000Z"),
          brandName: "LCJ",
          adCost: 0,
          salesAmount: 5000,
          manualSalesAmount: null,
          gmv: null,
          orderCount: 2,
          itemsSold: 3,
          viewerCount: 50,
          duration: 60,
        },
      ], []])
      .mockResolvedValueOnce([[
        { livestreamId: 11, productItemsSold: 7, evidenceCount: 2 },
      ], []])
      .mockResolvedValueOnce([[
        { livestreamId: 11, adType: "live", totalBudget: 2000, liveBudget: 0 },
      ], []]);
    const pool = { query } as unknown as LiverAdEffectPool;

    const result = await getLiverAdEffectDashboard(7, "2026-08", pool);

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][1][0]).toBe(7);
    expect(result.records).toHaveLength(2);
    expect(result.records.find((row) => row.id === 11)).toMatchObject({
      adStatus: "paid",
      adCost: 2000,
      adCostSource: "linked",
      itemsSold: 7,
      roas: 5,
    });
    expect(result.records.find((row) => row.id === 12)).toMatchObject({
      adStatus: "none",
      adCost: 0,
      itemsSold: 3,
    });
  });

  it("does not issue IN queries when the liver has no records", async () => {
    const query = vi.fn().mockResolvedValueOnce([[], []]);
    const result = await getLiverAdEffectDashboard(7, "2026-08", { query } as unknown as LiverAdEffectPool);
    expect(query).toHaveBeenCalledTimes(1);
    expect(result.records).toEqual([]);
  });
});

describe("updateOwnLivestreamAdCost", () => {
  it("updates the authenticated liver's own record atomically", async () => {
    const connection = makeConnection([{ id: 9, liverId: 7, deletedAt: null } as RowDataPacket]);
    const pool = { getConnection: vi.fn().mockResolvedValue(connection) } as unknown as LiverAdEffectPool;

    await expect(updateOwnLivestreamAdCost(7, 9, 3800, pool)).resolves.toEqual({ success: true });
    expect(connection.beginTransaction).toHaveBeenCalledOnce();
    expect(connection.execute).toHaveBeenCalledWith(expect.stringContaining("SET adCost = ?"), [3800, 9, 7]);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("supports a second update and explicit no-ad zero without changing ownership", async () => {
    const first = makeConnection([{ id: 9, liverId: 7, deletedAt: null } as RowDataPacket]);
    const second = makeConnection([{ id: 9, liverId: 7, deletedAt: null } as RowDataPacket]);
    const pool = {
      getConnection: vi.fn()
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second),
    } as unknown as LiverAdEffectPool;

    await updateOwnLivestreamAdCost(7, 9, 2000, pool);
    await updateOwnLivestreamAdCost(7, 9, 0, pool);

    expect(first.execute).toHaveBeenCalledWith(expect.any(String), [2000, 9, 7]);
    expect(second.execute).toHaveBeenCalledWith(expect.any(String), [0, 9, 7]);
  });

  it("rolls back and rejects another liver's record", async () => {
    const connection = makeConnection([{ id: 9, liverId: 8, deletedAt: null } as RowDataPacket]);
    const pool = { getConnection: vi.fn().mockResolvedValue(connection) } as unknown as LiverAdEffectPool;

    await expect(updateOwnLivestreamAdCost(7, 9, 1000, pool)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it("rolls back when the record is missing or deleted", async () => {
    for (const rows of [[], [{ id: 9, liverId: 7, deletedAt: new Date() } as RowDataPacket]]) {
      const connection = makeConnection(rows);
      const pool = { getConnection: vi.fn().mockResolvedValue(connection) } as unknown as LiverAdEffectPool;
      await expect(updateOwnLivestreamAdCost(7, 9, null, pool)).rejects.toBeInstanceOf(LiverAdEffectPersistenceError);
      expect(connection.rollback).toHaveBeenCalledOnce();
    }
  });

  it("rolls back if exactly one row was not updated", async () => {
    const connection = makeConnection([{ id: 9, liverId: 7, deletedAt: null } as RowDataPacket], 0);
    const pool = { getConnection: vi.fn().mockResolvedValue(connection) } as unknown as LiverAdEffectPool;

    await expect(updateOwnLivestreamAdCost(7, 9, 1000, pool)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });
});
