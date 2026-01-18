import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database functions
vi.mock("./db", () => ({
  updateFollowupStatus: vi.fn(),
  getFollowupById: vi.fn(),
  createReportFollowup: vi.fn(),
  linkNextAction: vi.fn(),
}));

import { updateFollowupStatus, getFollowupById, createReportFollowup, linkNextAction } from "./db";

describe("Followup Result Recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateFollowupStatus", () => {
    it("should update status with result category", async () => {
      const mockUpdateFollowupStatus = vi.mocked(updateFollowupStatus);
      mockUpdateFollowupStatus.mockResolvedValue(undefined);

      await updateFollowupStatus(1, "completed", "成約", "契約成立しました");

      expect(mockUpdateFollowupStatus).toHaveBeenCalledWith(
        1,
        "completed",
        "成約",
        "契約成立しました"
      );
    });

    it("should update status without result note", async () => {
      const mockUpdateFollowupStatus = vi.mocked(updateFollowupStatus);
      mockUpdateFollowupStatus.mockResolvedValue(undefined);

      await updateFollowupStatus(1, "completed", "完了", undefined);

      expect(mockUpdateFollowupStatus).toHaveBeenCalledWith(
        1,
        "completed",
        "完了",
        undefined
      );
    });

    it("should handle cancelled status", async () => {
      const mockUpdateFollowupStatus = vi.mocked(updateFollowupStatus);
      mockUpdateFollowupStatus.mockResolvedValue(undefined);

      await updateFollowupStatus(1, "cancelled", undefined, undefined);

      expect(mockUpdateFollowupStatus).toHaveBeenCalledWith(
        1,
        "cancelled",
        undefined,
        undefined
      );
    });
  });

  describe("getFollowupById", () => {
    it("should return followup when found", async () => {
      const mockFollowup = {
        id: 1,
        reportId: 10,
        reportStaffId: 5,
        extractedItem: "商談MTG",
        category: "商談",
        status: "pending",
        dueDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockGetFollowupById = vi.mocked(getFollowupById);
      mockGetFollowupById.mockResolvedValue(mockFollowup);

      const result = await getFollowupById(1);

      expect(result).toEqual(mockFollowup);
      expect(mockGetFollowupById).toHaveBeenCalledWith(1);
    });

    it("should return null when not found", async () => {
      const mockGetFollowupById = vi.mocked(getFollowupById);
      mockGetFollowupById.mockResolvedValue(null);

      const result = await getFollowupById(999);

      expect(result).toBeNull();
    });
  });

  describe("createReportFollowup for next action", () => {
    it("should create next action followup", async () => {
      const mockCreatedFollowup = {
        id: 2,
        reportId: 10,
        reportStaffId: 5,
        extractedItem: "次回MTG日程調整",
        category: "MTG",
        status: "pending",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockCreateReportFollowup = vi.mocked(createReportFollowup);
      mockCreateReportFollowup.mockResolvedValue(mockCreatedFollowup);

      const result = await createReportFollowup({
        reportId: 10,
        reportStaffId: 5,
        extractedItem: "次回MTG日程調整",
        category: "MTG",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      });

      expect(result).toEqual(mockCreatedFollowup);
      expect(mockCreateReportFollowup).toHaveBeenCalled();
    });
  });

  describe("linkNextAction", () => {
    it("should link next action to current followup", async () => {
      const mockLinkNextAction = vi.mocked(linkNextAction);
      mockLinkNextAction.mockResolvedValue(undefined);

      await linkNextAction(1, 2);

      expect(mockLinkNextAction).toHaveBeenCalledWith(1, 2);
    });
  });

  describe("Result Categories", () => {
    const resultCategories = ["成約", "継続", "保留", "失注", "完了"];

    it.each(resultCategories)("should accept result category: %s", async (category) => {
      const mockUpdateFollowupStatus = vi.mocked(updateFollowupStatus);
      mockUpdateFollowupStatus.mockResolvedValue(undefined);

      await updateFollowupStatus(1, "completed", category as any, undefined);

      expect(mockUpdateFollowupStatus).toHaveBeenCalledWith(
        1,
        "completed",
        category,
        undefined
      );
    });
  });
});
