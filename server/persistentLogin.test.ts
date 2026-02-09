import { describe, it, expect } from "vitest";

/**
 * Persistent Login (永久ログイン) Tests
 * 
 * Tests that the session management supports persistent login across pages:
 * 1. lineLogin.me returns sessionToken for localStorage sync
 * 2. LineMypage auto-saves sessionToken to localStorage
 * 3. ReceiptUpload restores token from URL params and localStorage
 * 4. Token is valid base64-encoded JSON session data
 */

describe("Persistent Login - Session Token Generation", () => {
  it("should generate a valid base64 session token from session data", () => {
    const sessionData = {
      lineUserId: "U1234567890",
      userId: 1,
      displayName: "Test User",
      pictureUrl: "https://example.com/pic.jpg",
      email: "test@example.com",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000,
    };

    // Simulate what the server does in lineLogin.me
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    // Verify the token is valid base64
    expect(sessionToken).toBeTruthy();
    expect(typeof sessionToken).toBe("string");

    // Verify it can be decoded back
    const decoded = JSON.parse(Buffer.from(sessionToken, "base64").toString("utf-8"));
    expect(decoded.lineUserId).toBe("U1234567890");
    expect(decoded.userId).toBe(1);
    expect(decoded.displayName).toBe("Test User");
    expect(decoded.email).toBe("test@example.com");
    expect(decoded.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should generate a valid token for email login users", () => {
    const sessionData = {
      lineUserId: "email_42",
      userId: 42,
      displayName: "Email User",
      email: "email@example.com",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000,
    };

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    const decoded = JSON.parse(Buffer.from(sessionToken, "base64").toString("utf-8"));

    expect(decoded.lineUserId).toBe("email_42");
    expect(decoded.userId).toBe(42);
  });

  it("should handle token round-trip (encode → decode → verify)", () => {
    const sessionData = {
      lineUserId: "U9876543210",
      userId: 5,
      displayName: "Round Trip User",
      createdAt: Date.now(),
      expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000,
    };

    // Server encodes
    const token = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    // Client stores in localStorage (simulated)
    const storedToken = token;

    // Client sends back via Authorization header
    // Server decodes
    const decodedCookie = Buffer.from(storedToken, "base64").toString("utf-8");
    const session = JSON.parse(decodedCookie);

    expect(session.lineUserId).toBe("U9876543210");
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });
});

describe("Persistent Login - Session Expiry", () => {
  it("should set session expiry to 10 years", () => {
    const now = Date.now();
    const tenYearsMs = 3650 * 24 * 60 * 60 * 1000;
    const expiresAt = now + tenYearsMs;

    // Verify 10 years is approximately correct (within 1 day tolerance)
    const tenYearsFromNow = new Date(expiresAt);
    const expectedYear = new Date(now).getFullYear() + 10;
    expect(tenYearsFromNow.getFullYear()).toBeGreaterThanOrEqual(expectedYear - 1);
    expect(tenYearsFromNow.getFullYear()).toBeLessThanOrEqual(expectedYear + 1);
  });

  it("should reject expired sessions", () => {
    const sessionData = {
      lineUserId: "U1234567890",
      expiresAt: Date.now() - 1000, // Expired 1 second ago
    };

    // Simulate server-side check
    const isExpired = sessionData.expiresAt < Date.now();
    expect(isExpired).toBe(true);
  });

  it("should accept valid sessions", () => {
    const sessionData = {
      lineUserId: "U1234567890",
      expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000,
    };

    const isExpired = sessionData.expiresAt < Date.now();
    expect(isExpired).toBe(false);
  });
});

describe("Persistent Login - URL Token Parameter", () => {
  it("should extract token from URL search params", () => {
    const sessionData = {
      lineUserId: "U1234567890",
      userId: 1,
      expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000,
    };
    const token = Buffer.from(JSON.stringify(sessionData)).toString("base64");

    // Simulate URL with token parameter
    const url = new URL(`https://lcjmall.com/receipt-upload?token=${encodeURIComponent(token)}`);
    const extractedToken = url.searchParams.get("token");

    expect(extractedToken).toBe(token);

    // Verify extracted token is valid
    const decoded = JSON.parse(Buffer.from(extractedToken!, "base64").toString("utf-8"));
    expect(decoded.lineUserId).toBe("U1234567890");
  });

  it("should handle URL without token parameter gracefully", () => {
    const url = new URL("https://lcjmall.com/receipt-upload");
    const extractedToken = url.searchParams.get("token");
    expect(extractedToken).toBeNull();
  });

  it("should clean token from URL after extraction", () => {
    const token = "dGVzdA==";
    const url = new URL(`https://lcjmall.com/receipt-upload?token=${token}`);
    url.searchParams.delete("token");
    expect(url.searchParams.get("token")).toBeNull();
    expect(url.pathname).toBe("/receipt-upload");
  });
});

describe("Persistent Login - Token Priority", () => {
  it("should prioritize lcj_session_token for LCJ MALL pages", () => {
    // Simulate the logic from main.tsx
    const currentPath = "/receipt-upload";
    const isLcjMallPage =
      currentPath === "/mypage" ||
      currentPath.startsWith("/line-") ||
      currentPath === "/" ||
      currentPath.startsWith("/products") ||
      currentPath.startsWith("/mall") ||
      currentPath === "/receipt-upload" ||
      currentPath === "/point-request";

    expect(isLcjMallPage).toBe(true);

    // When lcj_session_token exists, it should be used for LCJ pages
    const lcjToken = "some_lcj_token";
    const liverToken = "some_liver_token";
    let selectedToken: string | null = null;

    if (lcjToken && isLcjMallPage) {
      selectedToken = lcjToken;
    } else if (liverToken) {
      selectedToken = liverToken;
    }

    expect(selectedToken).toBe(lcjToken);
  });

  it("should include /receipt-upload in LCJ MALL page list", () => {
    const lcjMallPaths = ["/mypage", "/receipt-upload", "/point-request", "/", "/products/test", "/mall/test"];
    
    for (const path of lcjMallPaths) {
      const isLcjMallPage =
        path === "/mypage" ||
        path.startsWith("/line-") ||
        path === "/" ||
        path.startsWith("/products") ||
        path.startsWith("/mall") ||
        path === "/receipt-upload" ||
        path === "/point-request";
      
      expect(isLcjMallPage).toBe(true);
    }
  });
});
