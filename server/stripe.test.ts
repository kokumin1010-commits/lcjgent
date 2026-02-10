import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Stripe
vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: "cs_test_123",
            url: "https://checkout.stripe.com/test_session",
            payment_intent: "pi_test_123",
          }),
        },
      },
      webhooks: {
        constructEvent: vi.fn().mockImplementation((body, sig, secret) => {
          const event = JSON.parse(body.toString());
          return event;
        }),
      },
    })),
  };
});

describe("Stripe Integration", () => {
  describe("Webhook Handler", () => {
    it("should handle test events correctly", async () => {
      const { handleStripeWebhook } = await import("./stripeWebhook");

      const testEvent = {
        id: "evt_test_123",
        type: "checkout.session.completed",
        data: { object: {} },
      };

      const req = {
        body: Buffer.from(JSON.stringify(testEvent)),
        headers: { "stripe-signature": "test_sig" },
      };

      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };

      await handleStripeWebhook(req, res);

      // Test events should return verified: true
      expect(res.json).toHaveBeenCalledWith({ verified: true });
    });

    it("should handle checkout.session.completed events", async () => {
      const { handleStripeWebhook } = await import("./stripeWebhook");

      const event = {
        id: "evt_live_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_live_123",
            payment_intent: "pi_live_123",
            metadata: {
              user_id: "1",
              order_number: "ORD-20260210-001",
            },
          },
        },
      };

      const req = {
        body: Buffer.from(JSON.stringify(event)),
        headers: { "stripe-signature": "live_sig" },
      };

      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };

      await handleStripeWebhook(req, res);

      // Should return received: true for live events
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it("should handle payment_intent.succeeded events", async () => {
      const { handleStripeWebhook } = await import("./stripeWebhook");

      const event = {
        id: "evt_live_456",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_live_456",
            amount: 5000,
            currency: "jpy",
          },
        },
      };

      const req = {
        body: Buffer.from(JSON.stringify(event)),
        headers: { "stripe-signature": "live_sig" },
      };

      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };

      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    it("should handle unrecognized event types gracefully", async () => {
      const { handleStripeWebhook } = await import("./stripeWebhook");

      const event = {
        id: "evt_live_789",
        type: "customer.created",
        data: {
          object: {
            id: "cus_live_789",
          },
        },
      };

      const req = {
        body: Buffer.from(JSON.stringify(event)),
        headers: { "stripe-signature": "live_sig" },
      };

      const res = {
        json: vi.fn().mockReturnThis(),
        status: vi.fn().mockReturnThis(),
      };

      await handleStripeWebhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });
});
