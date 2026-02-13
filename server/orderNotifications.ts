/**
 * 注文関連の通知ヘルパー
 * 注文確定時・発送時・配達完了時にLINE通知 + HTML形式メール通知を送信する
 */
import { getMallOrderById } from "./db";
import { pushMessage } from "./line";
import {
  buildOrderConfirmationHtml,
  buildShippedHtml,
  buildDeliveredHtml,
  buildCancelledHtml,
} from "./orderEmailTemplates";

// 配送業者の追跡URLを生成
function getTrackingUrl(carrier: string, trackingNumber: string): string | null {
  const c = carrier.toLowerCase();
  if (c.includes("ヤマト") || c.includes("yamato") || c.includes("クロネコ"))
    return `https://toi.kuronekoyamato.co.jp/cgi-bin/tneko?number=${trackingNumber}`;
  if (c.includes("佐川") || c.includes("sagawa"))
    return `https://k2k.sagawa-exp.co.jp/p/web/okurijosearch.do?okurijoNo=${trackingNumber}`;
  if (c.includes("日本郵便") || c.includes("ユーパック") || c.includes("japan post"))
    return `https://trackings.post.japanpost.jp/services/srv/search/?requestNo1=${trackingNumber}`;
  if (c.includes("西濃") || c.includes("seino"))
    return `https://track.seino.co.jp/cgi-bin/gnpquery.pgm?GNPNO1=${trackingNumber}`;
  return null;
}

/**
 * 注文確定時のLINE/メール通知を送信
 */
export async function sendOrderConfirmationNotification(orderId: number) {
  try {
    const orderDetail = await getMallOrderById(orderId);
    if (!orderDetail) {
      console.warn(`[OrderNotify] Order ${orderId} not found`);
      return;
    }
    const { order, lineUser, items } = orderDetail;
    if (!lineUser) {
      console.warn(`[OrderNotify] No user for order ${order.orderNumber}`);
      return;
    }

    const itemLines = items.map((item: any) =>
      `  ・${item.productName} ×${item.quantity} ￥${(item.subtotal || 0).toLocaleString()}`
    ).join("\n");

    const pointsInfo = order.pointsUsed > 0
      ? `\n🏅 ポイント利用: ${order.pointsUsed.toLocaleString()} pt`
      : "";

    const shippingInfo = order.shippingName
      ? `\n\n📍 配送先:\n  ${order.shippingName} 様\n  〒${order.shippingPostalCode}\n  ${order.shippingAddress}`
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
      shippingInfo,
      ``,
      `配送の準備ができ次第、発送いたします。`,
      `発送時に追跡番号をお知らせいたします。`,
    ].join("\n");

    // LINE通知
    if (lineUser.lineUserId && !lineUser.lineUserId.startsWith("email_")) {
      const success = await pushMessage(lineUser.lineUserId, [
        { type: "text", text: message },
      ]);
      if (success) {
        console.log(`[OrderNotify] 注文確定通知送信成功: ${order.orderNumber} → ${lineUser.displayName || lineUser.lineUserId}`);
      } else {
        console.error(`[OrderNotify] 注文確定通知送信失敗: ${order.orderNumber}`);
      }
    }

    // HTML形式メール通知
    if (lineUser.email) {
      try {
        const { sendEmail } = await import("./emailService");
        const customerName = lineUser.displayName || lineUser.email;
        const html = buildOrderConfirmationHtml(customerName, {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          pointsUsed: order.pointsUsed || 0,
          shippingFee: (order as any).shippingFee || 0,
          paymentMethod: order.paymentMethod,
          shippingName: order.shippingName || undefined,
          shippingPostalCode: order.shippingPostalCode || undefined,
          shippingAddress: order.shippingAddress || undefined,
        }, items.map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          subtotal: item.subtotal || 0,
        })));

        await sendEmail({
          to: [lineUser.email],
          subject: `【LCJ MALL】ご注文確認 - ${order.orderNumber}`,
          content: `${customerName} 様\n\n${message}\n\n---\nLCJ MALL`,
          html,
        });
        console.log(`[OrderNotify] 注文確定HTMLメール送信成功: ${order.orderNumber} → ${lineUser.email}`);
      } catch (emailErr) {
        console.error(`[OrderNotify] 注文確定メール送信失敗:`, emailErr);
      }
    }
  } catch (error) {
    console.error(`[OrderNotify] 注文確定通知エラー (orderId: ${orderId}):`, error);
  }
}

/**
 * 発送時のLINE/メール通知を送信
 */
export async function sendShippedNotification(
  orderId: number,
  shippingCarrier?: string,
  trackingNumber?: string
) {
  try {
    const orderDetail = await getMallOrderById(orderId);
    if (!orderDetail) {
      console.warn(`[OrderNotify] Order ${orderId} not found`);
      return;
    }
    const { order, lineUser, items } = orderDetail;
    if (!lineUser) {
      console.warn(`[OrderNotify] No user for order ${order.orderNumber}`);
      return;
    }

    const carrier = shippingCarrier || order.shippingCarrier;
    const tracking = trackingNumber || order.trackingNumber;

    const itemLines = items.map((item: any) =>
      `  ・${item.productName} ×${item.quantity}`
    ).join("\n");

    let trackingInfo = "";
    if (carrier && tracking) {
      const trackingUrl = getTrackingUrl(carrier, tracking);
      trackingInfo = `\n🚚 配送業者: ${carrier}\n📋 追跡番号: ${tracking}`;
      if (trackingUrl) {
        trackingInfo += `\n🔗 追跡URL:\n${trackingUrl}`;
      }
    } else if (tracking) {
      trackingInfo = `\n📋 追跡番号: ${tracking}`;
    }

    const shippingAddr = order.shippingName
      ? `\n\n📍 配送先:\n  ${order.shippingName} 様\n  〒${order.shippingPostalCode}\n  ${order.shippingAddress}`
      : "";

    const message = [
      `🚀 商品を発送しました！`,
      ``,
      `📦 注文番号: ${order.orderNumber}`,
      ``,
      `【発送商品】`,
      itemLines,
      trackingInfo,
      shippingAddr,
      ``,
      `お届けまでしばらくお待ちください。`,
      `配達完了時に再度お知らせいたします。`,
    ].join("\n");

    // LINE通知
    if (lineUser.lineUserId && !lineUser.lineUserId.startsWith("email_")) {
      const success = await pushMessage(lineUser.lineUserId, [
        { type: "text", text: message },
      ]);
      if (success) {
        console.log(`[OrderNotify] 発送通知送信成功: ${order.orderNumber} → ${lineUser.displayName || lineUser.lineUserId}`);
      } else {
        console.error(`[OrderNotify] 発送通知送信失敗: ${order.orderNumber}`);
      }
    }

    // HTML形式メール通知
    if (lineUser.email) {
      try {
        const { sendEmail } = await import("./emailService");
        const customerName = lineUser.displayName || lineUser.email;
        const html = buildShippedHtml(customerName, {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          shippingName: order.shippingName || undefined,
          shippingPostalCode: order.shippingPostalCode || undefined,
          shippingAddress: order.shippingAddress || undefined,
          shippingCarrier: carrier || undefined,
          trackingNumber: tracking || undefined,
        }, items.map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
        })), carrier || undefined, tracking || undefined);

        await sendEmail({
          to: [lineUser.email],
          subject: `【LCJ MALL】商品発送のお知らせ - ${order.orderNumber}`,
          content: `${customerName} 様\n\n${message}\n\n---\nLCJ MALL`,
          html,
        });
        console.log(`[OrderNotify] 発送HTMLメール送信成功: ${order.orderNumber} → ${lineUser.email}`);
      } catch (emailErr) {
        console.error(`[OrderNotify] 発送メール送信失敗:`, emailErr);
      }
    }
  } catch (error) {
    console.error(`[OrderNotify] 発送通知エラー (orderId: ${orderId}):`, error);
  }
}

/**
 * 配達完了時のLINE/メール通知を送信
 */
export async function sendDeliveredNotification(orderId: number) {
  try {
    const orderDetail = await getMallOrderById(orderId);
    if (!orderDetail) {
      console.warn(`[OrderNotify] Order ${orderId} not found`);
      return;
    }
    const { order, lineUser, items } = orderDetail;
    if (!lineUser) {
      console.warn(`[OrderNotify] No user for order ${order.orderNumber}`);
      return;
    }

    const itemLines = items.map((item: any) =>
      `  ・${item.productName} ×${item.quantity}`
    ).join("\n");

    const message = [
      `🎉 商品が配達されました！`,
      ``,
      `📦 注文番号: ${order.orderNumber}`,
      ``,
      `【配達商品】`,
      itemLines,
      ``,
      `お届けが完了いたしました。`,
      `商品に問題がございましたら、お気軽にお問い合わせください。`,
      ``,
      `ご利用ありがとうございました！`,
      `またのご利用をお待ちしております 🙏`,
    ].join("\n");

    // LINE通知
    if (lineUser.lineUserId && !lineUser.lineUserId.startsWith("email_")) {
      const success = await pushMessage(lineUser.lineUserId, [
        { type: "text", text: message },
      ]);
      if (success) {
        console.log(`[OrderNotify] 配達完了通知送信成功: ${order.orderNumber} → ${lineUser.displayName || lineUser.lineUserId}`);
      } else {
        console.error(`[OrderNotify] 配達完了通知送信失敗: ${order.orderNumber}`);
      }
    }

    // HTML形式メール通知
    if (lineUser.email) {
      try {
        const { sendEmail } = await import("./emailService");
        const customerName = lineUser.displayName || lineUser.email;
        const html = buildDeliveredHtml(customerName, {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
        }, items.map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
        })));

        await sendEmail({
          to: [lineUser.email],
          subject: `【LCJ MALL】配達完了のお知らせ - ${order.orderNumber}`,
          content: `${customerName} 様\n\n${message}\n\n---\nLCJ MALL`,
          html,
        });
        console.log(`[OrderNotify] 配達完了HTMLメール送信成功: ${order.orderNumber} → ${lineUser.email}`);
      } catch (emailErr) {
        console.error(`[OrderNotify] 配達完了メール送信失敗:`, emailErr);
      }
    }
  } catch (error) {
    console.error(`[OrderNotify] 配達完了通知エラー (orderId: ${orderId}):`, error);
  }
}

/**
 * 注文キャンセル時のLINE/メール通知を送信
 */
export async function sendCancelledNotification(orderId: number, reason?: string) {
  try {
    const orderDetail = await getMallOrderById(orderId);
    if (!orderDetail) {
      console.warn(`[OrderNotify] Order ${orderId} not found`);
      return;
    }
    const { order, lineUser, items } = orderDetail;
    if (!lineUser) {
      console.warn(`[OrderNotify] No user for order ${order.orderNumber}`);
      return;
    }

    const itemLines = items.map((item: any) =>
      `  ・${item.productName} ×${item.quantity}`
    ).join("\n");

    const reasonText = reason ? `\n📝 キャンセル理由: ${reason}` : "";

    const refundInfo = order.paymentMethod === "stripe"
      ? "\n\n💳 クレジットカードでお支払いの場合、返金処理は数営業日以内に完了いたします。"
      : order.paymentMethod === "points"
      ? "\n\n🏅 ご利用ポイントは返還されます。"
      : "";

    const message = [
      `❌ 注文がキャンセルされました`,
      ``,
      `📦 注文番号: ${order.orderNumber}`,
      reasonText,
      ``,
      `【キャンセル商品】`,
      itemLines,
      refundInfo,
      ``,
      `ご不明な点がございましたら、お気軽にお問い合わせください。`,
    ].join("\n");

    // LINE通知
    if (lineUser.lineUserId && !lineUser.lineUserId.startsWith("email_")) {
      const success = await pushMessage(lineUser.lineUserId, [
        { type: "text", text: message },
      ]);
      if (success) {
        console.log(`[OrderNotify] キャンセル通知送信成功: ${order.orderNumber}`);
      }
    }

    // HTML形式メール通知
    if (lineUser.email) {
      try {
        const { sendEmail } = await import("./emailService");
        const customerName = lineUser.displayName || lineUser.email;
        const html = buildCancelledHtml(customerName, {
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
        }, items.map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
        })), reason);

        await sendEmail({
          to: [lineUser.email],
          subject: `【LCJ MALL】注文キャンセルのお知らせ - ${order.orderNumber}`,
          content: `${customerName} 様\n\n${message}\n\n---\nLCJ MALL`,
          html,
        });
        console.log(`[OrderNotify] キャンセルHTMLメール送信成功: ${order.orderNumber} → ${lineUser.email}`);
      } catch (emailErr) {
        console.error(`[OrderNotify] キャンセルメール送信失敗:`, emailErr);
      }
    }
  } catch (error) {
    console.error(`[OrderNotify] キャンセル通知エラー (orderId: ${orderId}):`, error);
  }
}
