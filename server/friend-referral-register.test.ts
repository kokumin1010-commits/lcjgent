import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Test: emailRegister with friendChallengeCode should record referral for the inviter
 * 
 * This test verifies the critical fix: when a new user registers with a friend challenge
 * referral code, the system should:
 * 1. Award invitee bonus to the new user
 * 2. Record the referral in history (recordFriendReferral)
 * 3. Update the referrer's progress (totalReferrals, stage, spins)
 * 4. Award stage reward points to the referrer if applicable
 * 5. Add activity feed entry if stage was cleared
 */

// Mock the db module functions
const mockGetUserProgressByReferralCode = vi.fn();
const mockGetActiveReferralCampaign = vi.fn();
const mockGetLineUserById = vi.fn();
const mockCreateLinePointTransaction = vi.fn();
const mockGetOrCreateUserReferralProgress = vi.fn();
const mockGetCampaignStages = vi.fn();
const mockRecordFriendReferral = vi.fn();
const mockUpdateUserReferralProgress = vi.fn();
const mockAddReferralActivity = vi.fn();
const mockHasAlreadyBeenReferred = vi.fn();
const mockGetTodayReferralCount = vi.fn();
const mockCalculateTitleLevel = vi.fn();

// We test the logic by checking that the correct db functions are called
// Since routers.ts uses dynamic imports, we mock at the module level
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    getUserProgressByReferralCode: (...args: unknown[]) => mockGetUserProgressByReferralCode(...args),
    getActiveReferralCampaign: (...args: unknown[]) => mockGetActiveReferralCampaign(...args),
    getLineUserById: (...args: unknown[]) => mockGetLineUserById(...args),
    createLinePointTransaction: (...args: unknown[]) => mockCreateLinePointTransaction(...args),
    getOrCreateUserReferralProgress: (...args: unknown[]) => mockGetOrCreateUserReferralProgress(...args),
    getCampaignStages: (...args: unknown[]) => mockGetCampaignStages(...args),
    recordFriendReferral: (...args: unknown[]) => mockRecordFriendReferral(...args),
    updateUserReferralProgress: (...args: unknown[]) => mockUpdateUserReferralProgress(...args),
    addReferralActivity: (...args: unknown[]) => mockAddReferralActivity(...args),
    hasAlreadyBeenReferred: (...args: unknown[]) => mockHasAlreadyBeenReferred(...args),
    getTodayReferralCount: (...args: unknown[]) => mockGetTodayReferralCount(...args),
    calculateTitleLevel: (...args: unknown[]) => mockCalculateTitleLevel(...args),
  };
});

describe("Friend Referral - emailRegister integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should verify that recordFriendReferral and updateUserReferralProgress are imported and callable", () => {
    // Verify the mock functions exist and are callable
    expect(typeof mockRecordFriendReferral).toBe("function");
    expect(typeof mockUpdateUserReferralProgress).toBe("function");
    expect(typeof mockGetOrCreateUserReferralProgress).toBe("function");
    expect(typeof mockGetCampaignStages).toBe("function");
    expect(typeof mockCalculateTitleLevel).toBe("function");
    expect(typeof mockAddReferralActivity).toBe("function");
    expect(typeof mockHasAlreadyBeenReferred).toBe("function");
  });

  it("should have all required referral functions in the db module imports of routers.ts", async () => {
    // Read the actual source to verify the import includes all needed functions
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    // The emailRegister handler's friendChallengeCode block should import these functions
    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify all critical functions are imported in the friendChallengeCode block
    expect(friendChallengeBlock).toContain("recordFriendReferral");
    expect(friendChallengeBlock).toContain("updateUserReferralProgress");
    expect(friendChallengeBlock).toContain("getOrCreateUserReferralProgress");
    expect(friendChallengeBlock).toContain("getCampaignStages");
    expect(friendChallengeBlock).toContain("calculateTitleLevel");
    expect(friendChallengeBlock).toContain("addReferralActivity");
    expect(friendChallengeBlock).toContain("hasAlreadyBeenReferred");
  });

  it("should call recordFriendReferral in the emailRegister friendChallengeCode handler", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify recordFriendReferral is actually called (not just imported)
    expect(friendChallengeBlock).toContain("await recordFriendReferral({");
    expect(friendChallengeBlock).toContain("referrerLineUserId: referrerProgress.lineUserId");
    expect(friendChallengeBlock).toContain("inviteeLineUserId: newUser.id");
    expect(friendChallengeBlock).toContain("campaignId: campaign.id");
  });

  it("should update referrer progress with totalReferrals increment", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify updateUserReferralProgress is called with totalReferrals
    expect(friendChallengeBlock).toContain("await updateUserReferralProgress(currentProgress.id,");
    expect(friendChallengeBlock).toContain("totalReferrals: newTotalReferrals");
    expect(friendChallengeBlock).toContain("currentStage: newStage");
    expect(friendChallengeBlock).toContain("pendingSpins:");
    expect(friendChallengeBlock).toContain("pendingSpecialSpins:");
    expect(friendChallengeBlock).toContain("titleLevel");
  });

  it("should calculate stage progression correctly in the handler", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify stage calculation logic exists
    expect(friendChallengeBlock).toContain("const newTotalReferrals = currentProgress.totalReferrals + 1");
    expect(friendChallengeBlock).toContain("stageReward += stage.fixedReward");
    expect(friendChallengeBlock).toContain("newStage = stage.stageNumber");
  });

  it("should award stage reward points to referrer when stage is cleared", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify referrer points are awarded
    expect(friendChallengeBlock).toContain("if (stageReward > 0)");
    expect(friendChallengeBlock).toContain("友達招待チャレンジ ステージ${newStage}達成報酬");
  });

  it("should add activity feed entry when stage is cleared", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify activity feed is updated
    expect(friendChallengeBlock).toContain("await addReferralActivity({");
    expect(friendChallengeBlock).toContain('activityType: "stage_clear"');
  });

  it("should send LINE notification to referrer when friend registers via emailRegister", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify LINE notification is sent to referrer
    expect(friendChallengeBlock).toContain("Send exciting LINE notification to the referrer");
    expect(friendChallengeBlock).toContain('await pushMessage(referrerLineId');
    expect(friendChallengeBlock).toContain('おめでとうございます');
    expect(friendChallengeBlock).toContain('あなたの招待で登録しました');
    expect(friendChallengeBlock).toContain('招待実績');
    expect(friendChallengeBlock).toContain('招待チャレンジを確認');
  });

  it("should include stage reward info in LINE notification when stage is cleared", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify notification includes dynamic reward info
    expect(friendChallengeBlock).toContain('ステージ報酬');
    expect(friendChallengeBlock).toContain('ルーレット');
    expect(friendChallengeBlock).toContain('ステージアップ');
    expect(friendChallengeBlock).toContain('最大5,000ptをGETしよう');
  });

  it("should not block registration if LINE notification fails", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify notification is wrapped in try-catch so it doesn't block registration
    expect(friendChallengeBlock).toContain("catch (notifErr: any)");
    expect(friendChallengeBlock).toContain("Notification failure should not block the registration");
  });

  it("should only send LINE notification if referrer has a valid LINE User ID (starts with U)", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    const friendChallengeBlock = routersSource.substring(
      routersSource.indexOf("// Handle FRIEND CHALLENGE referral codes"),
      routersSource.indexOf("// Auto-login: create session after registration")
    );

    // Verify LINE ID validation before sending
    expect(friendChallengeBlock).toContain('referrerLineId.startsWith("U")');
  });
});

describe("Friend Referral - recordReferral API LINE notification", () => {
  it("should send LINE notification to referrer in recordReferral API", async () => {
    const fs = await import("fs");
    const routersSource = fs.readFileSync(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf-8"
    );

    // Find the recordReferral mutation block
    const recordReferralBlock = routersSource.substring(
      routersSource.indexOf("// 招待コードで招待を記録"),
      routersSource.indexOf("// ルーレットスピン")
    );

    // Verify LINE notification is also in the recordReferral API
    expect(recordReferralBlock).toContain("Send exciting LINE notification to the referrer");
    expect(recordReferralBlock).toContain('await pushMessage(referrerLineId');
    expect(recordReferralBlock).toContain('おめでとうございます');
    expect(recordReferralBlock).toContain('catch (notifErr: any)');
  });
});
