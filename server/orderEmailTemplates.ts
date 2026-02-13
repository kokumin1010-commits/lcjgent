/**
 * 注文関連のHTML形式メールテンプレート
 * レスポンシブ対応・主要メールクライアント互換
 */

// ブランドカラー
const BRAND_COLOR = "#FF2D55";
const BRAND_BG = "#FFF5F7";
const TEXT_COLOR = "#1a1a2e";
const MUTED_COLOR = "#6b7280";
const BORDER_COLOR = "#e5e7eb";
const SUCCESS_COLOR = "#10b981";
const WARNING_COLOR = "#f59e0b";
const DANGER_COLOR = "#ef4444";

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
}

interface OrderInfo {
  orderNumber: string;
  totalAmount: number;
  pointsUsed?: number;
  shippingFee?: number;
  paymentMethod?: string;
  shippingName?: string;
  shippingPostalCode?: string;
  shippingAddress?: string;
  shippingCarrier?: string;
  trackingNumber?: string;
}

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

// 共通のメールラッパー
function wrapInLayout(title: string, accentColor: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN','Hiragino Sans',Meiryo,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,${accentColor},${accentColor}dd);padding:28px 32px;text-align:center;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="text-align:center;">
<span style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LCJ MALL</span>
</td></tr>
</table>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding:32px 32px 24px;">
${content}
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:20px 32px 28px;border-top:1px solid ${BORDER_COLOR};text-align:center;">
<p style="margin:0 0 8px;font-size:12px;color:${MUTED_COLOR};">
このメールは LCJ MALL からの自動送信メールです。
</p>
<p style="margin:0 0 8px;font-size:12px;color:${MUTED_COLOR};">
ご不明な点がございましたら、お気軽にお問い合わせください。
</p>
<p style="margin:0;font-size:12px;color:${MUTED_COLOR};">
&copy; ${new Date().getFullYear()} LCJ MALL - 株式会社LIVE COMMERCE JAPAN
</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// 商品一覧テーブルを生成
function buildItemsTable(items: OrderItem[], showPrice: boolean = true): string {
  const rows = items.map(item => `
<tr>
<td style="padding:10px 0;border-bottom:1px solid ${BORDER_COLOR};font-size:14px;color:${TEXT_COLOR};">
${item.productName}
<span style="color:${MUTED_COLOR};font-size:13px;"> &times;${item.quantity}</span>
</td>
${showPrice ? `<td style="padding:10px 0;border-bottom:1px solid ${BORDER_COLOR};font-size:14px;color:${TEXT_COLOR};text-align:right;white-space:nowrap;">
&yen;${(item.subtotal || (item.unitPrice || 0) * item.quantity).toLocaleString()}
</td>` : ''}
</tr>`).join('');

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
<tr>
<td style="padding:8px 0;border-bottom:2px solid ${BORDER_COLOR};font-size:12px;font-weight:600;color:${MUTED_COLOR};text-transform:uppercase;letter-spacing:0.5px;">商品</td>
${showPrice ? `<td style="padding:8px 0;border-bottom:2px solid ${BORDER_COLOR};font-size:12px;font-weight:600;color:${MUTED_COLOR};text-align:right;text-transform:uppercase;letter-spacing:0.5px;">金額</td>` : ''}
</tr>
${rows}
</table>`;
}

// 金額サマリーを生成
function buildPriceSummary(order: OrderInfo): string {
  const subtotal = order.totalAmount - (order.shippingFee || 0) + (order.pointsUsed || 0);
  let rows = '';

  rows += `<tr>
<td style="padding:4px 0;font-size:13px;color:${MUTED_COLOR};">小計</td>
<td style="padding:4px 0;font-size:13px;color:${TEXT_COLOR};text-align:right;">&yen;${subtotal.toLocaleString()}</td>
</tr>`;

  if (order.shippingFee && order.shippingFee > 0) {
    rows += `<tr>
<td style="padding:4px 0;font-size:13px;color:${MUTED_COLOR};">送料</td>
<td style="padding:4px 0;font-size:13px;color:${TEXT_COLOR};text-align:right;">&yen;${order.shippingFee.toLocaleString()}</td>
</tr>`;
  }

  if (order.pointsUsed && order.pointsUsed > 0) {
    rows += `<tr>
<td style="padding:4px 0;font-size:13px;color:${MUTED_COLOR};">ポイント利用</td>
<td style="padding:4px 0;font-size:13px;color:${SUCCESS_COLOR};text-align:right;">-&yen;${order.pointsUsed.toLocaleString()}</td>
</tr>`;
  }

  rows += `<tr>
<td style="padding:10px 0 0;font-size:16px;font-weight:700;color:${TEXT_COLOR};border-top:2px solid ${BORDER_COLOR};">合計</td>
<td style="padding:10px 0 0;font-size:18px;font-weight:700;color:${BRAND_COLOR};text-align:right;border-top:2px solid ${BORDER_COLOR};">&yen;${order.totalAmount.toLocaleString()}</td>
</tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
${rows}
</table>`;
}

// 配送先情報ブロックを生成
function buildShippingBlock(order: OrderInfo): string {
  if (!order.shippingName) return '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:${BRAND_BG};border-radius:8px;border:1px solid #fce7f3;">
<tr><td style="padding:16px;">
<p style="margin:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_COLOR};text-transform:uppercase;letter-spacing:0.5px;">&#x1f4cd; 配送先</p>
<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${TEXT_COLOR};">${order.shippingName} 様</p>
<p style="margin:0;font-size:13px;color:${MUTED_COLOR};">〒${order.shippingPostalCode || ''}<br>${order.shippingAddress || ''}</p>
</td></tr>
</table>`;
}

/**
 * 注文確定メールのHTMLテンプレート
 */
export function buildOrderConfirmationHtml(
  customerName: string,
  order: OrderInfo,
  items: OrderItem[]
): string {
  const paymentLabel = order.paymentMethod === 'stripe' ? 'クレジットカード' :
    order.paymentMethod === 'points' ? 'ポイント決済' : order.paymentMethod || '';

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">ご注文ありがとうございます &#x2705;</h1>
<p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};">${customerName} 様、ご注文を承りました。</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f9fafb;border-radius:8px;border:1px solid ${BORDER_COLOR};">
<tr><td style="padding:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-size:12px;color:${MUTED_COLOR};padding:2px 0;">注文番号</td>
<td style="font-size:14px;font-weight:600;color:${TEXT_COLOR};text-align:right;padding:2px 0;">${order.orderNumber}</td>
</tr>
<tr>
<td style="font-size:12px;color:${MUTED_COLOR};padding:2px 0;">お支払い方法</td>
<td style="font-size:14px;color:${TEXT_COLOR};text-align:right;padding:2px 0;">${paymentLabel}</td>
</tr>
</table>
</td></tr>
</table>

${buildItemsTable(items)}
${buildPriceSummary(order)}
${buildShippingBlock(order)}

<p style="margin:20px 0 0;font-size:14px;color:${TEXT_COLOR};line-height:1.6;">
配送の準備ができ次第、発送いたします。<br>
発送時に追跡番号をメールでお知らせいたします。
</p>`;

  return wrapInLayout(`ご注文確認 - ${order.orderNumber}`, BRAND_COLOR, content);
}

/**
 * 発送完了メールのHTMLテンプレート
 */
export function buildShippedHtml(
  customerName: string,
  order: OrderInfo,
  items: OrderItem[],
  carrier?: string,
  tracking?: string
): string {
  const actualCarrier = carrier || order.shippingCarrier || '';
  const actualTracking = tracking || order.trackingNumber || '';
  const trackingUrl = actualCarrier && actualTracking ? getTrackingUrl(actualCarrier, actualTracking) : null;

  let trackingBlock = '';
  if (actualCarrier || actualTracking) {
    trackingBlock = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
<tr><td style="padding:16px;">
<p style="margin:0 0 10px;font-size:12px;font-weight:600;color:${SUCCESS_COLOR};text-transform:uppercase;letter-spacing:0.5px;">&#x1f69a; 配送情報</p>
${actualCarrier ? `<p style="margin:0 0 4px;font-size:14px;color:${TEXT_COLOR};"><strong>配送業者:</strong> ${actualCarrier}</p>` : ''}
${actualTracking ? `<p style="margin:0 0 8px;font-size:14px;color:${TEXT_COLOR};"><strong>追跡番号:</strong> <span style="font-family:monospace;background:#e5e7eb;padding:2px 6px;border-radius:4px;">${actualTracking}</span></p>` : ''}
${trackingUrl ? `<a href="${trackingUrl}" target="_blank" style="display:inline-block;padding:10px 24px;background:${SUCCESS_COLOR};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;margin-top:4px;">&#x1f50d; 配送状況を確認する</a>` : ''}
</td></tr>
</table>`;
  }

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">商品を発送しました &#x1f680;</h1>
<p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};">${customerName} 様、ご注文の商品を発送いたしました。</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f9fafb;border-radius:8px;border:1px solid ${BORDER_COLOR};">
<tr><td style="padding:16px;">
<p style="margin:0;font-size:12px;color:${MUTED_COLOR};">注文番号</p>
<p style="margin:4px 0 0;font-size:16px;font-weight:600;color:${TEXT_COLOR};">${order.orderNumber}</p>
</td></tr>
</table>

${buildItemsTable(items, false)}
${trackingBlock}
${buildShippingBlock(order)}

<p style="margin:20px 0 0;font-size:14px;color:${TEXT_COLOR};line-height:1.6;">
お届けまでしばらくお待ちください。<br>
配達完了時に再度お知らせいたします。
</p>`;

  return wrapInLayout(`商品発送のお知らせ - ${order.orderNumber}`, SUCCESS_COLOR, content);
}

/**
 * 配達完了メールのHTMLテンプレート
 */
export function buildDeliveredHtml(
  customerName: string,
  order: OrderInfo,
  items: OrderItem[]
): string {
  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">商品が配達されました &#x1f389;</h1>
<p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};">${customerName} 様、ご注文の商品のお届けが完了いたしました。</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f9fafb;border-radius:8px;border:1px solid ${BORDER_COLOR};">
<tr><td style="padding:16px;">
<p style="margin:0;font-size:12px;color:${MUTED_COLOR};">注文番号</p>
<p style="margin:4px 0 0;font-size:16px;font-weight:600;color:${TEXT_COLOR};">${order.orderNumber}</p>
</td></tr>
</table>

${buildItemsTable(items, false)}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#fffbeb;border-radius:8px;border:1px solid #fde68a;">
<tr><td style="padding:16px;text-align:center;">
<p style="margin:0 0 8px;font-size:16px;font-weight:600;color:${TEXT_COLOR};">&#x1f64f; ご利用ありがとうございました！</p>
<p style="margin:0;font-size:13px;color:${MUTED_COLOR};line-height:1.5;">
商品に問題がございましたら、お気軽にお問い合わせください。<br>
またのご利用をお待ちしております。
</p>
</td></tr>
</table>`;

  return wrapInLayout(`配達完了のお知らせ - ${order.orderNumber}`, '#8b5cf6', content);
}

/**
 * 注文キャンセルメールのHTMLテンプレート
 */
export function buildCancelledHtml(
  customerName: string,
  order: OrderInfo,
  items: OrderItem[],
  reason?: string
): string {
  let refundBlock = '';
  if (order.paymentMethod === 'stripe') {
    refundBlock = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;">
<tr><td style="padding:16px;">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${DANGER_COLOR};text-transform:uppercase;letter-spacing:0.5px;">&#x1f4b3; 返金について</p>
<p style="margin:0;font-size:14px;color:${TEXT_COLOR};line-height:1.5;">
クレジットカードでお支払いの場合、返金処理は数営業日以内に完了いたします。<br>
返金額: <strong>&yen;${order.totalAmount.toLocaleString()}</strong>
</p>
</td></tr>
</table>`;
  } else if (order.paymentMethod === 'points') {
    refundBlock = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;">
<tr><td style="padding:16px;">
<p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${SUCCESS_COLOR};text-transform:uppercase;letter-spacing:0.5px;">&#x1f3c5; ポイント返還について</p>
<p style="margin:0;font-size:14px;color:${TEXT_COLOR};line-height:1.5;">
ご利用ポイントは返還されます。<br>
返還ポイント: <strong>${order.totalAmount.toLocaleString()} pt</strong>
</p>
</td></tr>
</table>`;
  }

  const content = `
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};">注文がキャンセルされました</h1>
<p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};">${customerName} 様、以下の注文がキャンセルされました。</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f9fafb;border-radius:8px;border:1px solid ${BORDER_COLOR};">
<tr><td style="padding:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-size:12px;color:${MUTED_COLOR};padding:2px 0;">注文番号</td>
<td style="font-size:14px;font-weight:600;color:${TEXT_COLOR};text-align:right;padding:2px 0;">${order.orderNumber}</td>
</tr>
${reason ? `<tr>
<td style="font-size:12px;color:${MUTED_COLOR};padding:2px 0;">キャンセル理由</td>
<td style="font-size:14px;color:${TEXT_COLOR};text-align:right;padding:2px 0;">${reason}</td>
</tr>` : ''}
</table>
</td></tr>
</table>

${buildItemsTable(items, false)}
${refundBlock}

<p style="margin:20px 0 0;font-size:14px;color:${TEXT_COLOR};line-height:1.6;">
ご不明な点がございましたら、お気軽にお問い合わせください。
</p>`;

  return wrapInLayout(`注文キャンセルのお知らせ - ${order.orderNumber}`, DANGER_COLOR, content);
}
