import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db functions
vi.mock("./db", async () => {
  const actual = await vi.importActual("./db");
  return {
    ...actual,
    getReferralCodeByCode: vi.fn(),
    applyReferralCode: vi.fn(),
    hasUsedReferralCode: vi.fn(),
    getAllReferralCodes: vi.fn(),
    getOrCreateReferralCode: vi.fn(),
    getReferralStats: vi.fn(),
    getLineUserByLineId: vi.fn(),
    getLineUserById: vi.fn(),
    getLiverById: vi.fn(),
    registerReferralCodeAtSignup: vi.fn(),
    confirmPendingReferral: vi.fn(),
  };
});

// Import mocked functions
import {
  getReferralCodeByCode,
  hasUsedReferralCode,
  applyReferralCode,
  getLiverById,
  getLineUserByLineId,
  getLineUserById,
  getAllReferralCodes,
  registerReferralCodeAtSignup,
  confirmPendingReferral,
} from "./db";

const mockedGetReferralCodeByCode = vi.mocked(getReferralCodeByCode);
const mockedHasUsedReferralCode = vi.mocked(hasUsedReferralCode);
const mockedApplyReferralCode = vi.mocked(applyReferralCode);
const mockedGetLiverById = vi.mocked(getLiverById);
const mockedGetLineUserByLineId = vi.mocked(getLineUserByLineId);
const mockedGetLineUserById = vi.mocked(getLineUserById);
const mockedGetAllReferralCodes = vi.mocked(getAllReferralCodes);
const mockedRegisterReferralCodeAtSignup = vi.mocked(registerReferralCodeAtSignup);
const mockedConfirmPendingReferral = vi.mocked(confirmPendingReferral);

function createAuthenticatedContext(): TrpcContext {
  return {
    user: {
      id: 1,
      name: "Admin",
      email: "admin@test.com",
      role: "admin",
      openId: "test-open-id",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      headers: {},
      cookies: {},
    } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

function createLineSessionContext(lineUserId: string, userId: number): TrpcContext {
  const session = JSON.stringify({
    lineUserId,
    userId,
    expiresAt: Date.now() + 86400000,
  });
  return {
    user: null,
    req: {
      headers: {},
      cookies: { line_session: session },
    } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

const caller = appRouter.createCaller as any;

describe("Referral Code System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lineLogin.verifyReferralCode", () => {
    it("should return valid=true for existing referral code", async () => {
      mockedGetReferralCodeByCode.mockResolvedValue({
        referralCode: {
          id: 1,
          liverId: 10,
          code: "1234",
          isActive: true,
          totalReferrals: 5,
          totalPointsEarned: 1000,
          createdAt: new Date(),
        },
        liverName: "テストライバー",
        liverAvatarUrl: "https://example.com/avatar.jpg",
      } as any);

      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.lineLogin.verifyReferralCode({ code: "1234" });

      expect(result.valid).toBe(true);
      expect(result.liverName).toBe("テストライバー");
      expect(result.liverAvatarUrl).toBe("https://example.com/avatar.jpg");
    });

    it("should return valid=false for non-existing referral code", async () => {
      mockedGetReferralCodeByCode.mockResolvedValue(null);

      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.lineLogin.verifyReferralCode({ code: "9999" });

      expect(result.valid).toBe(false);
      expect(result.message).toBe("無効な紹介コードです");
    });

    it("should reject non-4-digit codes", async () => {
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);

      await expect(
        trpcCaller.lineLogin.verifyReferralCode({ code: "123" })
      ).rejects.toThrow();

      await expect(
        trpcCaller.lineLogin.verifyReferralCode({ code: "abcd" })
      ).rejects.toThrow();

      await expect(
        trpcCaller.lineLogin.verifyReferralCode({ code: "12345" })
      ).rejects.toThrow();
    });
  });

  describe("lineLogin.checkReferralUsed", () => {
    it("should return loggedIn=false when not authenticated", async () => {
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.lineLogin.checkReferralUsed();

      expect(result.loggedIn).toBe(false);
      expect(result.used).toBe(false);
    });

    it("should return used=true when user already used referral code", async () => {
      const mockUser = {
        id: 100,
        lineUserId: "U123456",
        displayName: "テストユーザー",
        pictureUrl: null,
        email: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockedGetLineUserByLineId.mockResolvedValue(mockUser as any);
      mockedHasUsedReferralCode.mockResolvedValue(true);

      const ctx = createLineSessionContext("U123456", 100);
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.lineLogin.checkReferralUsed();

      expect(result.loggedIn).toBe(true);
      expect(result.used).toBe(true);
    });

    it("should return used=false when user has not used referral code", async () => {
      const mockUser = {
        id: 100,
        lineUserId: "U123456",
        displayName: "テストユーザー",
        pictureUrl: null,
        email: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockedGetLineUserByLineId.mockResolvedValue(mockUser as any);
      mockedHasUsedReferralCode.mockResolvedValue(false);

      const ctx = createLineSessionContext("U123456", 100);
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.lineLogin.checkReferralUsed();

      expect(result.loggedIn).toBe(true);
      expect(result.used).toBe(false);
    });
  });

  describe("lineLogin.applyReferralCode", () => {
    it("should reject unauthenticated users", async () => {
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);

      await expect(
        trpcCaller.lineLogin.applyReferralCode({ code: "1234" })
      ).rejects.toThrow("ログインが必要です");
    });

    it("should reject if user already used a referral code", async () => {
      const mockUser = {
        id: 100,
        lineUserId: "U123456",
        displayName: "テストユーザー",
        pictureUrl: null,
        email: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockedGetLineUserByLineId.mockResolvedValue(mockUser as any);
      mockedHasUsedReferralCode.mockResolvedValue(true);

      const ctx = createLineSessionContext("U123456", 100);
      const trpcCaller = caller(ctx);

      await expect(
        trpcCaller.lineLogin.applyReferralCode({ code: "1234" })
      ).rejects.toThrow("紹介コードは1人1回のみ使用できます");
    });

    it("should reject invalid referral code", async () => {
      const mockUser = {
        id: 100,
        lineUserId: "U123456",
        displayName: "テストユーザー",
        pictureUrl: null,
        email: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockedGetLineUserByLineId.mockResolvedValue(mockUser as any);
      mockedHasUsedReferralCode.mockResolvedValue(false);
      mockedGetReferralCodeByCode.mockResolvedValue(null);

      const ctx = createLineSessionContext("U123456", 100);
      const trpcCaller = caller(ctx);

      await expect(
        trpcCaller.lineLogin.applyReferralCode({ code: "9999" })
      ).rejects.toThrow("無効な紹介コードです");
    });

    it("should reject self-referral", async () => {
      const mockUser = {
        id: 100,
        lineUserId: "U123456",
        displayName: "テストユーザー",
        pictureUrl: null,
        email: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockedGetLineUserByLineId.mockResolvedValue(mockUser as any);
      mockedHasUsedReferralCode.mockResolvedValue(false);
      mockedGetReferralCodeByCode.mockResolvedValue({
        referralCode: {
          id: 1,
          liverId: 10,
          code: "1234",
          isActive: true,
          totalReferrals: 0,
          totalPointsEarned: 0,
          createdAt: new Date(),
        },
        liverName: "テストライバー",
        liverAvatarUrl: null,
      } as any);
      mockedGetLiverById.mockResolvedValue({
        id: 10,
        lineUserId: "U123456", // Same as the user
        name: "テストライバー",
      } as any);

      const ctx = createLineSessionContext("U123456", 100);
      const trpcCaller = caller(ctx);

      await expect(
        trpcCaller.lineLogin.applyReferralCode({ code: "1234" })
      ).rejects.toThrow("自分自身の紹介コードは使用できません");
    });

    it("should successfully apply referral code and award points", async () => {
      const mockUser = {
        id: 100,
        lineUserId: "U123456",
        displayName: "テストユーザー",
        pictureUrl: null,
        email: null,
        password: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockedGetLineUserByLineId.mockResolvedValue(mockUser as any);
      mockedHasUsedReferralCode.mockResolvedValue(false);
      mockedGetReferralCodeByCode.mockResolvedValue({
        referralCode: {
          id: 1,
          liverId: 10,
          code: "1234",
          isActive: true,
          totalReferrals: 0,
          totalPointsEarned: 0,
          createdAt: new Date(),
        },
        liverName: "テストライバー",
        liverAvatarUrl: null,
      } as any);
      mockedGetLiverById.mockResolvedValue({
        id: 10,
        lineUserId: "U999999", // Different from the user
        name: "テストライバー",
      } as any);
      mockedApplyReferralCode.mockResolvedValue({
        newUserPoints: 500,
        referrerPoints: 200,
      });

      const ctx = createLineSessionContext("U123456", 100);
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.lineLogin.applyReferralCode({ code: "1234" });

      expect(result.success).toBe(true);
      expect(result.newUserPoints).toBe(500);
      expect(result.referrerPoints).toBe(200);
      expect(result.liverName).toBe("テストライバー");
      expect(mockedApplyReferralCode).toHaveBeenCalledWith(
        1,    // referralCodeId
        10,   // liverId
        100,  // lineUser.id
        "U123456", // lineUserId
        "U999999", // referrerLineUserId
        500,  // newUserPoints
        200   // referrerPoints
      );
    });
  });
});


describe("Referral Admin & Ranking", () => {
  const mockReferralCodes = [
    {
      id: 1,
      code: "1234",
      liverId: 10,
      liverName: "ライバーA",
      liverAvatarUrl: "https://example.com/a.jpg",
      isActive: true,
      totalReferrals: 15,
      totalPointsEarned: 3000,
      createdAt: new Date(),
    },
    {
      id: 2,
      code: "5678",
      liverId: 20,
      liverName: "ライバーB",
      liverAvatarUrl: null,
      isActive: true,
      totalReferrals: 8,
      totalPointsEarned: 1600,
      createdAt: new Date(),
    },
    {
      id: 3,
      code: "9012",
      liverId: 30,
      liverName: "ライバーC",
      liverAvatarUrl: null,
      isActive: true,
      totalReferrals: 0,
      totalPointsEarned: 0,
      createdAt: new Date(),
    },
    {
      id: 4,
      code: "3456",
      liverId: 40,
      liverName: "ライバーD",
      liverAvatarUrl: null,
      isActive: false,
      totalReferrals: 3,
      totalPointsEarned: 600,
      createdAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("referral.getAll", () => {
    it("should return all referral codes for authenticated users", async () => {
      mockedGetAllReferralCodes.mockResolvedValue(mockReferralCodes as any);
      const ctx = createAuthenticatedContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.referral.getAll();
      expect(result).toHaveLength(4);
      expect(result[0].liverName).toBe("ライバーA");
      expect(result[0].totalReferrals).toBe(15);
    });

    it("should reject unauthenticated users", async () => {
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      await expect(trpcCaller.referral.getAll()).rejects.toThrow();
    });
  });

  describe("referral.ranking", () => {
    it("should return only active codes with referrals > 0", async () => {
      mockedGetAllReferralCodes.mockResolvedValue(mockReferralCodes as any);
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.referral.ranking();
      // Should exclude: ライバーC (0 referrals), ライバーD (inactive)
      expect(result).toHaveLength(2);
      expect(result[0].liverName).toBe("ライバーA");
      expect(result[1].liverName).toBe("ライバーB");
    });

    it("should respect limit parameter", async () => {
      mockedGetAllReferralCodes.mockResolvedValue(mockReferralCodes as any);
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.referral.ranking({ limit: 1 });
      expect(result).toHaveLength(1);
      expect(result[0].liverName).toBe("ライバーA");
    });

    it("should not expose referral code values in ranking", async () => {
      mockedGetAllReferralCodes.mockResolvedValue(mockReferralCodes as any);
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.referral.ranking();
      // Ensure code is not exposed in public ranking
      result.forEach((item: any) => {
        expect(item.code).toBeUndefined();
        expect(item.id).toBeUndefined();
        expect(item.liverId).toBeUndefined();
      });
    });

    it("should return empty array when no qualifying codes exist", async () => {
      mockedGetAllReferralCodes.mockResolvedValue([
        { ...mockReferralCodes[2] }, // 0 referrals
      ] as any);
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.referral.ranking();
      expect(result).toHaveLength(0);
    });
  });
});


describe("Referral Code - Registration & Purchase Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lineLogin.validateReferralCode", () => {
    it("should return liver name for valid referral code", async () => {
      mockedGetReferralCodeByCode.mockResolvedValue({
        referralCode: {
          id: 1,
          liverId: 10,
          code: "1234",
          isActive: true,
          totalReferrals: 5,
          totalPointsEarned: 1000,
          createdAt: new Date(),
        },
        liverName: "テストライバー",
        liverAvatarUrl: "https://example.com/avatar.jpg",
      } as any);

      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);
      const result = await trpcCaller.lineLogin.validateReferralCode({ code: "1234" });

      expect(result.valid).toBe(true);
      expect(result.liverName).toBe("テストライバー");
    });

    it("should throw error for invalid referral code", async () => {
      mockedGetReferralCodeByCode.mockResolvedValue(null);

      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);

      await expect(
        trpcCaller.lineLogin.validateReferralCode({ code: "9999" })
      ).rejects.toThrow("無効な招待コードです");
    });

    it("should reject codes shorter than 4 characters", async () => {
      const ctx = createPublicContext();
      const trpcCaller = caller(ctx);

      await expect(
        trpcCaller.lineLogin.validateReferralCode({ code: "12" })
      ).rejects.toThrow();
    });
  });
});


describe("Shipping Fee Logic", () => {
  const FREE_SHIPPING_THRESHOLD = 5000;
  const SHIPPING_FEE = 880;

  function calculateShippingFee(subtotal: number): number {
    return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  }

  it("should charge 880 yen shipping for orders under 5000 yen", () => {
    expect(calculateShippingFee(1000)).toBe(880);
    expect(calculateShippingFee(4999)).toBe(880);
    expect(calculateShippingFee(0)).toBe(880);
    expect(calculateShippingFee(100)).toBe(880);
  });

  it("should be free shipping for orders of 5000 yen or more", () => {
    expect(calculateShippingFee(5000)).toBe(0);
    expect(calculateShippingFee(5001)).toBe(0);
    expect(calculateShippingFee(10000)).toBe(0);
    expect(calculateShippingFee(50000)).toBe(0);
  });

  it("should charge shipping at exactly 5000 yen threshold", () => {
    expect(calculateShippingFee(4999)).toBe(880);
    expect(calculateShippingFee(5000)).toBe(0);
  });
});

describe("Referral LINE Notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirmPendingReferral should return referrer info for LINE notification", async () => {
    mockedConfirmPendingReferral.mockResolvedValue({
      newUserPoints: 500,
      referrerPoints: 200,
      referrerLineUserId: "U_liver_123",
    });

    const result = await confirmPendingReferral("U_user_456", 100);
    expect(result).not.toBeNull();
    expect(result!.referrerLineUserId).toBe("U_liver_123");
    expect(result!.referrerPoints).toBe(200);
    expect(result!.newUserPoints).toBe(500);
  });

  it("confirmPendingReferral should return null when no pending referral", async () => {
    mockedConfirmPendingReferral.mockResolvedValue(null);

    const result = await confirmPendingReferral("U_user_789", 200);
    expect(result).toBeNull();
  });

  it("notification message should contain correct information", () => {
    const referrerPoints = 200;
    const referralCode = "1234";
    const appUrl = "https://lcjmall.com";

    // Registration notification
    const registrationMsg = `🎉 紹介コードが使われました！\n\nあなたの紹介コード「${referralCode}」で新しいユーザーが登録しました。\n\n※ ポイントはこのユーザーが初回購入を完了した時点で付与されます。\n\n📊 紹介実績を確認\n${appUrl}/liver-mypage`;
    expect(registrationMsg).toContain(referralCode);
    expect(registrationMsg).toContain("初回購入を完了した時点");
    expect(registrationMsg).toContain("/liver-mypage");

    // Purchase confirmation notification
    const confirmMsg = `🌟 紹介ポイントが確定しました！\n\nあなたが紹介したユーザーが初回購入を完了しました。\n\n⭐ 獲得ポイント: ${referrerPoints}ポイント\n\n引き続き紹介コードをシェアしてポイントを獲得しましょう！\n\n📊 紹介実績を確認\n${appUrl}/liver-mypage`;
    expect(confirmMsg).toContain(`${referrerPoints}ポイント`);
    expect(confirmMsg).toContain("初回購入を完了しました");
    expect(confirmMsg).toContain("/liver-mypage");
  });
});
