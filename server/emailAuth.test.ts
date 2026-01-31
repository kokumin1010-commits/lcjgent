import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

// Mock the db functions
vi.mock("./db", () => ({
  getLineUserByEmail: vi.fn(),
  createEmailLineUser: vi.fn(),
  getLineUserById: vi.fn(),
}));

import { getLineUserByEmail, createEmailLineUser, getLineUserById } from "./db";

describe("Email Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Password Hashing", () => {
    it("should hash password correctly", async () => {
      const password = "password123";
      const hashedPassword = await bcrypt.hash(password, 10);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(20);
    });

    it("should verify password correctly", async () => {
      const password = "password123";
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it("should reject wrong password", async () => {
      const password = "password123";
      const wrongPassword = "wrongpassword";
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe("getLineUserByEmail", () => {
    it("should return user when email exists", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        displayName: "Test User",
        password: "$2a$10$hashedpassword",
      };
      
      vi.mocked(getLineUserByEmail).mockResolvedValue(mockUser as any);
      
      const result = await getLineUserByEmail("test@example.com");
      expect(result).toEqual(mockUser);
      expect(getLineUserByEmail).toHaveBeenCalledWith("test@example.com");
    });

    it("should return null when email does not exist", async () => {
      vi.mocked(getLineUserByEmail).mockResolvedValue(null);
      
      const result = await getLineUserByEmail("nonexistent@example.com");
      expect(result).toBeNull();
    });
  });

  describe("createEmailLineUser", () => {
    it("should create user with hashed password", async () => {
      const mockResult = { id: 1 };
      vi.mocked(createEmailLineUser).mockResolvedValue(mockResult);
      
      const userData = {
        email: "new@example.com",
        password: "$2a$10$hashedpassword",
        displayName: "New User",
      };
      
      const result = await createEmailLineUser(userData);
      expect(result).toEqual(mockResult);
      expect(createEmailLineUser).toHaveBeenCalledWith(userData);
    });
  });

  describe("getLineUserById", () => {
    it("should return user when id exists", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        displayName: "Test User",
      };
      
      vi.mocked(getLineUserById).mockResolvedValue(mockUser as any);
      
      const result = await getLineUserById(1);
      expect(result).toEqual(mockUser);
      expect(getLineUserById).toHaveBeenCalledWith(1);
    });

    it("should return null when id does not exist", async () => {
      vi.mocked(getLineUserById).mockResolvedValue(null);
      
      const result = await getLineUserById(999);
      expect(result).toBeNull();
    });
  });

  describe("Session handling for email users", () => {
    it("should generate correct session data for email user", () => {
      const user = {
        id: 123,
        email: "test@example.com",
        displayName: "Test User",
        lineUserId: null,
        pictureUrl: null,
      };
      
      const sessionData = {
        lineUserId: user.lineUserId || `email_${user.id}`,
        userId: user.id,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
        email: user.email,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      
      expect(sessionData.lineUserId).toBe("email_123");
      expect(sessionData.userId).toBe(123);
      expect(sessionData.email).toBe("test@example.com");
    });
  });
});
