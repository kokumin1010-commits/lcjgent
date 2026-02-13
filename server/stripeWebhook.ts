import Stripe from "stripe";
import { ENV } from "./_core/env";
import {
  getMallOrderByStripeSessionId,
  getMallOrderById,
  updateMallOrderStripeInfo,
} from "./db";
import { pushMessage } from "./line";
import { sendOrderConfirmationNotification } from "./orderNotifications";

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

          // LINE/メール通知を送信
          await sendOrderConfirmationNotification(order.id);
          
          // Check and confirm pending referral (award points on first purchase)
          try {
            const { confirmPendingReferral, getMallOrderById } = await import("./db");
            const orderDetail = await getMallOrderById(order.id);
            if (orderDetail?.lineUser) {
              const lineUserId = orderDetail.lineUser.lineUserId || `email_${orderDetail.lineUser.id}`;
              const result = await confirmPendingReferral(lineUserId, orderDetail.lineUser.id);
              if (result) {
                console.log(`[Referral] Confirmed referral for user ${orderDetail.lineUser.id}: new user +${result.newUserPoints}pt, referrer +${result.referrerPoints}pt`);
              }
            }
          } catch (refErr: any) {
            console.error(`[Referral] Error confirming referral on Stripe payment:`, refErr.message);
          }
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

/**
 * 決済完了時にLINEメッセージで注文確認を送信
 */
export async function sendOrderConfirmationLine(orderId: number) {
  try {
    const orderDetail = await getMallOrderById(orderId);
    if (!orderDetail) {
      console.warn(`[LINE Notify] Order ${orderId} not found`);
      return;
    }

    const { order, lineUser, items } = orderDetail;
    if (!lineUser || !lineUser.lineUserId) {
      console.warn(`[LINE Notify] No LINE user ID for order ${order.orderNumber}`);
      return;
    }

    // 商品名リストを作成
    const itemLines = items.map((item: any) => 
      `  ・${item.productName} ×${item.quantity} ￥${(item.subtotal).toLocaleString()}`
    ).join("\n");

    const pointsInfo = order.pointsUsed > 0 
      ? `\n🏅 ポイント利用: ${order.pointsUsed.toLocaleString()}pt` 
      : "";

    const message = [
      `✅ ご注文ありがとうございます！`,
      ``,
      `📦 注文番号: ${order.orderNumber}`,
      ``,
      `【ご注文内容】`,
      itemLines,
      ``,
      `💰 お支払い金額: ￥${order.totalAmount.toLocaleString()}${pointsInfo}`,
      ``,
      `配送の準備ができ次第、発送いたします。`,
      `ご不明な点がございましたら、お気軽にお問い合わせください。`,
    ].join("\n");

    const success = await pushMessage(lineUser.lineUserId, [
      { type: "text", text: message },
    ]);

    if (success) {
      console.log(`[LINE Notify] Order confirmation sent to ${lineUser.displayName || lineUser.lineUserId} for order ${order.orderNumber}`);
    } else {
      console.error(`[LINE Notify] Failed to send order confirmation for order ${order.orderNumber}`);
    }
  } catch (error) {
    console.error(`[LINE Notify] Error sending order confirmation for order ${orderId}:`, error);
  }
}
