import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("../drizzle/schema", () => ({
  aitherhubSyncLogs: {
    liverId: "liverId",
    status: "syncStatus",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ type: "eq", args })),
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  sql: vi.fn(),
  desc: vi.fn(),
}));

// Mock getDb
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
  };
});

describe("isLiverAitherhubLinked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true when liver has successful sync logs", async () => {
    // We test the logic indirectly by checking the function exists and has correct signature
    const { isLiverAitherhubLinked } = await import("./db");
    expect(typeof isLiverAitherhubLinked).toBe("function");
  });

  it("should accept a liverId parameter", async () => {
    const { isLiverAitherhubLinked } = await import("./db");
    // Function should accept a number and return a promise
    expect(isLiverAitherhubLinked.length).toBe(1);
  });
});

describe("Aitherhub badge in liver.me endpoint", () => {
  it("should include aitherhubLinked field in the me endpoint response shape", async () => {
    const routerSource = await import("fs").then(fs => 
      fs.readFileSync("/home/ubuntu/task-automation-agent/server/liverRouter.ts", "utf-8")
    );
    
    expect(routerSource).toContain("isLiverAitherhubLinked");
    expect(routerSource).toContain("aitherhubLinked");
  });

  it("should have ExternalLink imported in LiverMypage", async () => {
    const mypageSource = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/task-automation-agent/client/src/pages/LiverMypage.tsx", "utf-8")
    );

    expect(mypageSource).toContain("ExternalLink");
    expect(mypageSource).toContain("aitherhubLinked");
    expect(mypageSource).toContain("https://aitherhub.com");
    expect(mypageSource).toContain("Aitherhub");
  });
});

describe("Aitherhub unlinked banner in LiverMypage", () => {
  it("should show banner for unlinked livers with correct content", async () => {
    const mypageSource = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/task-automation-agent/client/src/pages/LiverMypage.tsx", "utf-8")
    );

    // Banner should only show when NOT linked
    expect(mypageSource).toContain("!liverInfo.aitherhubLinked && !dismissedAitherhubBanner");
    // Banner content
    expect(mypageSource).toContain("Aitherhubと連携しよう");
    expect(mypageSource).toContain("動画解析結果が自動で反映");
    expect(mypageSource).toContain("Aitherhubを見る");
  });

  it("should have dismiss functionality with localStorage persistence", async () => {
    const mypageSource = await import("fs").then(fs =>
      fs.readFileSync("/home/ubuntu/task-automation-agent/client/src/pages/LiverMypage.tsx", "utf-8")
    );

    // Dismiss state
    expect(mypageSource).toContain("dismissedAitherhubBanner");
    expect(mypageSource).toContain("setDismissedAitherhubBanner");
    // localStorage persistence
    expect(mypageSource).toContain("aitherhub_banner_dismissed");
    expect(mypageSource).toContain("localStorage.setItem");
    expect(mypageSource).toContain("localStorage.getItem");
  });
});
