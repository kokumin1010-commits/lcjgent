import Stripe from "stripe";
import { ENV } from "./_core/env";
import {
  getMallOrderByStripeSessionId,
  updateMallOrderStripeInfo,
} from "./db";

const stripe = new Stripe(ENV.stripeSecretKey, {
  apiVersion: "2025-01-27.acacia" as any,
});

export async function handleStripeWebhook(req: any, res: any) {
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    if (ENV.stripeWebhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
    } else {
      // Fallback: parse without signature verification (dev only)
      event = JSON.parse(req.body.toString());
      console.warn("[Stripe Webhook] No webhook secret configured, skipping signature verification");
    }
  } catch (err: any) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return res.json({ verified: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`[Stripe Webhook] Checkout session completed: ${session.id}`);

        // Find order by stripe session ID
        const order = await getMallOrderByStripeSessionId(session.id);
        if (order) {
          await updateMallOrderStripeInfo(order.id, {
            status: "paid",
            stripePaymentIntentId: session.payment_intent as string,
          });
          console.log(`[Stripe Webhook] Order ${order.orderNumber} marked as paid`);
        } else {
          console.warn(`[Stripe Webhook] No order found for session ${session.id}`);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`[Stripe Webhook] Payment intent succeeded: ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error processing ${event.type}:`, error);
  }

  // Always return 200 to acknowledge receipt
  res.json({ received: true });
}
