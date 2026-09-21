import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Array<{ isActive: boolean | number; lifecycleIsActive: boolean | number | null }>,
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => state.rows),
          })),
        })),
      })),
    })),
  })),
}));

import { canDeliverLineGroupPush } from "./lineGroupDeliveryGuard";

const GROUP_ID = "C00000000000000000000000000000001";

describe("LINE group delivery lifecycle guard", () => {
  beforeEach(() => {
    state.rows = [];
  });

  it("allows an active current lifecycle", async () => {
    state.rows = [{ isActive: true, lifecycleIsActive: true }];
    await expect(canDeliverLineGroupPush(GROUP_ID)).resolves.toBe(true);
  });

  it("allows a legacy active row with no lifecycle record", async () => {
    state.rows = [{ isActive: true, lifecycleIsActive: null }];
    await expect(canDeliverLineGroupPush(GROUP_ID)).resolves.toBe(true);
  });

  it("rejects inactive groups and lifecycle leave tombstones", async () => {
    state.rows = [{ isActive: false, lifecycleIsActive: true }];
    await expect(canDeliverLineGroupPush(GROUP_ID)).resolves.toBe(false);

    state.rows = [{ isActive: true, lifecycleIsActive: false }];
    await expect(canDeliverLineGroupPush(GROUP_ID)).resolves.toBe(false);
  });

  it("rejects missing groups", async () => {
    await expect(canDeliverLineGroupPush(GROUP_ID)).resolves.toBe(false);
  });
});
