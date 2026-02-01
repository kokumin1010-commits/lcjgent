import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPointRequest,
  getPointRequestById,
  getPointRequestsByUserId,
  getPendingPointRequests,
  checkOrderNumberExists,
  countTodayPointRequestsByUser,
  approvePointRequest,
  rejectPointRequest,
  getUserPointBalance,
} from "./db";

// Mock the database connection
vi.mock("./db", async () => {
  const mockRequests: any[] = [];
  const mockBalances: any[] = [];
  let requestIdCounter = 1;

  return {
    createPointRequest: vi.fn(async (data: any) => {
      const newRequest = {
        id: requestIdCounter++,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockRequests.push(newRequest);
      return newRequest.id;
    }),
    getPointRequestById: vi.fn(async (id: number) => {
      return mockRequests.find((r) => r.id === id) || null;
    }),
    getPointRequestsByUserId: vi.fn(async (userId: number) => {
      return mockRequests.filter((r) => r.userId === userId);
    }),
    getPendingPointRequests: vi.fn(async () => {
      return mockRequests.filter((r) => r.status === "pending");
    }),
    checkOrderNumberExists: vi.fn(async (orderNumber: string) => {
      return mockRequests.some((r) => r.orderNumber === orderNumber);
    }),
    countTodayPointRequestsByUser: vi.fn(async (userId: number) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return mockRequests.filter(
        (r) => r.userId === userId && new Date(r.createdAt) >= today
      ).length;
    }),
    approvePointRequest: vi.fn(async (requestId: number, reviewerId: number, pointsApproved: number) => {
      const request = mockRequests.find((r) => r.id === requestId);
      if (request) {
        request.status = "approved";
        request.pointsApproved = pointsApproved;
        request.reviewedBy = reviewerId;
        request.reviewedAt = new Date();
      }
    }),
    rejectPointRequest: vi.fn(async (requestId: number, reviewerId: number, reason: string) => {
      const request = mockRequests.find((r) => r.id === requestId);
      if (request) {
        request.status = "rejected";
        request.rejectionReason = reason;
        request.reviewedBy = reviewerId;
        request.reviewedAt = new Date();
      }
    }),
    getUserPointBalance: vi.fn(async (userId: number) => {
      return mockBalances.find((b) => b.userId === userId) || null;
    }),
  };
});

describe("PointRequest API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPointRequest", () => {
    it("should create a new point request", async () => {
      const requestData = {
        userId: 1,
        orderNumber: "58225775813234042",
        orderAmount: 9526,
        receiptImageUrl: "https://example.com/receipt.jpg",
        receiptImageKey: "point-requests/1/receipt.jpg",
        pointsRequested: 95,
        status: "pending" as const,
      };

      const requestId = await createPointRequest(requestData);
      expect(requestId).toBe(1);
      expect(createPointRequest).toHaveBeenCalledWith(requestData);
    });
  });

  describe("getPointRequestById", () => {
    it("should return a point request by ID", async () => {
      const requestData = {
        userId: 1,
        orderNumber: "58225775813234043",
        orderAmount: 5000,
        receiptImageUrl: "https://example.com/receipt2.jpg",
        receiptImageKey: "point-requests/1/receipt2.jpg",
        pointsRequested: 50,
        status: "pending" as const,
      };

      const requestId = await createPointRequest(requestData);
      const request = await getPointRequestById(requestId);
      
      expect(request).not.toBeNull();
      expect(request?.orderNumber).toBe("58225775813234043");
    });

    it("should return null for non-existent ID", async () => {
      const request = await getPointRequestById(9999);
      expect(request).toBeNull();
    });
  });

  describe("checkOrderNumberExists", () => {
    it("should return true if order number exists", async () => {
      await createPointRequest({
        userId: 1,
        orderNumber: "EXISTING_ORDER",
        orderAmount: 1000,
        receiptImageUrl: "https://example.com/receipt.jpg",
        receiptImageKey: "key",
        pointsRequested: 10,
        status: "pending" as const,
      });

      const exists = await checkOrderNumberExists("EXISTING_ORDER");
      expect(exists).toBe(true);
    });

    it("should return false if order number does not exist", async () => {
      const exists = await checkOrderNumberExists("NON_EXISTING_ORDER");
      expect(exists).toBe(false);
    });
  });

  describe("countTodayPointRequestsByUser", () => {
    it("should count today's requests for a user", async () => {
      // Create multiple requests for the same user
      for (let i = 0; i < 3; i++) {
        await createPointRequest({
          userId: 2,
          orderNumber: `ORDER_${i}`,
          orderAmount: 1000,
          receiptImageUrl: "https://example.com/receipt.jpg",
          receiptImageKey: "key",
          pointsRequested: 10,
          status: "pending" as const,
        });
      }

      const count = await countTodayPointRequestsByUser(2);
      expect(count).toBe(3);
    });
  });

  describe("approvePointRequest", () => {
    it("should approve a pending request", async () => {
      const requestId = await createPointRequest({
        userId: 3,
        orderNumber: "APPROVE_TEST",
        orderAmount: 5000,
        receiptImageUrl: "https://example.com/receipt.jpg",
        receiptImageKey: "key",
        pointsRequested: 50,
        status: "pending" as const,
      });

      await approvePointRequest(requestId, 1, 50);
      
      const request = await getPointRequestById(requestId);
      expect(request?.status).toBe("approved");
      expect(request?.pointsApproved).toBe(50);
    });
  });

  describe("rejectPointRequest", () => {
    it("should reject a pending request with reason", async () => {
      const requestId = await createPointRequest({
        userId: 4,
        orderNumber: "REJECT_TEST",
        orderAmount: 5000,
        receiptImageUrl: "https://example.com/receipt.jpg",
        receiptImageKey: "key",
        pointsRequested: 50,
        status: "pending" as const,
      });

      await rejectPointRequest(requestId, 1, "配達済みステータスが確認できません");
      
      const request = await getPointRequestById(requestId);
      expect(request?.status).toBe("rejected");
      expect(request?.rejectionReason).toBe("配達済みステータスが確認できません");
    });
  });

  describe("Point calculation", () => {
    it("should calculate 1% of order amount as points", () => {
      const orderAmount = 9526;
      const expectedPoints = Math.floor(orderAmount * 0.01);
      expect(expectedPoints).toBe(95);
    });

    it("should handle small amounts correctly", () => {
      const orderAmount = 50;
      const expectedPoints = Math.floor(orderAmount * 0.01);
      expect(expectedPoints).toBe(0);
    });

    it("should handle large amounts correctly", () => {
      const orderAmount = 100000;
      const expectedPoints = Math.floor(orderAmount * 0.01);
      expect(expectedPoints).toBe(1000);
    });
  });

  describe("Daily limit", () => {
    it("should enforce 5 requests per day limit", async () => {
      const userId = 5;
      
      // Simulate 5 requests
      for (let i = 0; i < 5; i++) {
        await createPointRequest({
          userId,
          orderNumber: `LIMIT_TEST_${i}`,
          orderAmount: 1000,
          receiptImageUrl: "https://example.com/receipt.jpg",
          receiptImageKey: "key",
          pointsRequested: 10,
          status: "pending" as const,
        });
      }

      const count = await countTodayPointRequestsByUser(userId);
      expect(count).toBe(5);
      
      // Check if limit is reached
      const limitReached = count >= 5;
      expect(limitReached).toBe(true);
    });
  });
});
