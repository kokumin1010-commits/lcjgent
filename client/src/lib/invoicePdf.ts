/**
 * 納品書・請求書・領収書 PDF生成ユーティリティ
 * 
 * 参考フォーマット: Kyogoku Professional 様の納品書レイアウト
 * 発行元: 株式会社Live Commerce Japan
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NOTO_SANS_JP_BASE64 } from "./notoSansJpBase64";

// ── 発行元情報 ──
const COMPANY = {
  name: "株式会社Live Commerce Japan",
  postalCode: "150-0001",
  address: "東京都渋谷区神宮前五丁目46番20号",
  building: "Stones Court 表参道 2階",
  url: "https://lcjmall.com",
  // 適格請求書発行事業者の登録番号（必要に応じて設定）
  registrationNumber: "",
};

// ── 型定義 ──
export type DocumentType = "delivery" | "invoice" | "receipt";

export interface OrderData {
  orderNumber: string;
  createdAt: string | Date;
  // 購入者情報
  buyerName: string;
  buyerPostalCode?: string;
  buyerAddress?: string;
  buyerPhone?: string;
  // 商品明細
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number; // 税抜単価
    subtotal: number;  // 税抜金額
  }>;
  // 金額情報
  subtotalAmount: number;     // 商品小計（税抜）
  shippingFee: number;        // 送料
  handlingFee: number;        // 手数料
  discount: number;           // 値引き
  taxRate10Amount: number;    // 10%対象金額
  taxRate8Amount: number;     // 8%対象金額（軽減税率）
  tax10: number;              // 10%消費税
  tax8: number;               // 8%消費税
  totalAmount: number;        // 合計金額（税込）
  // ポイント利用
  pointsUsed?: number;
  // 支払方法
  paymentMethod?: string;
}

const TITLE_MAP: Record<DocumentType, string> = {
  delivery: "お買上げ明細書（納品書）",
  invoice: "御請求書",
  receipt: "領収書",
};

const GREETING_MAP: Record<DocumentType, string[]> = {
  delivery: [
    "このたびはお買い上げいただきありがとうございます。",
    "下記の内容にて納品させていただきます。",
    "ご確認くださいますよう、お願いいたします。",
  ],
  invoice: [
    "下記の通りご請求申し上げます。",
    "ご確認の上、お支払いくださいますよう",
    "お願いいたします。",
  ],
  receipt: [
    "下記の金額を正に領収いたしました。",
    "",
    "",
  ],
};

/**
 * フォントを登録してjsPDFインスタンスを返す
 */
function createPdf(): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.addFileToVFS("NotoSansJP-Regular.ttf", NOTO_SANS_JP_BASE64);
  doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
  doc.setFont("NotoSansJP");
  return doc;
}

/**
 * 金額フォーマット
 */
function yen(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/**
 * 日付フォーマット
 */
function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

/**
 * PDF生成メイン関数
 */
export function generateInvoicePdf(type: DocumentType, order: OrderData): jsPDF {
  const doc = createPdf();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const rightCol = pageWidth - margin;
  let y = 20;

  // ── タイトル ──
  doc.setFontSize(18);
  const title = TITLE_MAP[type];
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, y);
  y += 3;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line((pageWidth - titleWidth) / 2 - 5, y, (pageWidth + titleWidth) / 2 + 5, y);
  y += 15;

  // ── 左側: 購入者情報 ──
  const leftStartY = y;
  doc.setFontSize(9);
  if (order.buyerPostalCode) {
    doc.text(`〒${order.buyerPostalCode}`, margin, y);
    y += 5;
  }
  if (order.buyerAddress) {
    doc.text(order.buyerAddress, margin, y);
    y += 5;
  }
  y += 2;
  doc.setFontSize(13);
  doc.text(`${order.buyerName}　様`, margin, y);
  y += 10;

  // 挨拶文
  doc.setFontSize(8);
  const greetings = GREETING_MAP[type];
  for (const line of greetings) {
    if (line) {
      doc.text(line, margin, y);
      y += 4.5;
    }
  }

  // ── 右側: 発行元情報 ──
  const companyX = pageWidth / 2 + 10;
  let companyY = leftStartY;
  doc.setFontSize(8);
  
  if (COMPANY.registrationNumber) {
    doc.text(`登録番号 ${COMPANY.registrationNumber}`, companyX, companyY);
    companyY += 5;
  }
  
  doc.setFontSize(9);
  doc.text(COMPANY.name, companyX, companyY);
  companyY += 5;
  doc.setFontSize(8);
  doc.text(`〒${COMPANY.postalCode}`, companyX, companyY);
  companyY += 4.5;
  doc.text(COMPANY.address, companyX, companyY);
  companyY += 4.5;
  doc.text(COMPANY.building, companyX, companyY);
  companyY += 6;
  doc.text(COMPANY.url, companyX, companyY);
  companyY += 8;

  // 注文日・注文番号
  doc.setFontSize(9);
  doc.text(`【ご注文日】${formatDate(order.createdAt)}`, companyX, companyY);
  companyY += 5;
  doc.text(`【注文番号】${order.orderNumber}`, companyX, companyY);

  // ── 総合計金額（大きく表示）── ポイント差し引き後の実際の支払額 ──
  y = Math.max(y, companyY) + 10;
  doc.setFontSize(13);
  const actualPayment = order.pointsUsed && order.pointsUsed > 0
    ? Math.max(0, order.totalAmount - order.pointsUsed)
    : order.totalAmount;
  const totalLabel = type === "receipt" ? "領収金額" : "総合計金額";
  doc.text(totalLabel, margin, y);
  doc.setFontSize(18);
  const totalText = yen(actualPayment);
  doc.text(totalText, margin + 50, y);
  y += 2;
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 100, y);
  y += 8;

  // ── 備考欄 ──
  if (type === "receipt") {
    doc.setFontSize(9);
    doc.text("但し、商品代金として", margin, y);
    y += 8;
  } else {
    doc.setFontSize(9);
    doc.text("＜ 備考 ＞", margin, y);
    y += 8;
  }

  // ── 商品明細テーブル ──
  y += 5;
  const tableBody: any[][] = [];

  // 商品行
  for (const item of order.items) {
    tableBody.push([
      item.productName,
      String(item.quantity),
      yen(item.unitPrice),
      yen(item.subtotal),
    ]);
  }

  // 送料行
  if (order.shippingFee > 0) {
    tableBody.push(["送料", "1", yen(order.shippingFee), yen(order.shippingFee)]);
  }

  autoTable(doc, {
    startY: y,
    head: [["商品名 / 商品コード", "数量", "単価", "金額(税抜)"]],
    body: tableBody,
    theme: "grid",
    styles: {
      font: "NotoSansJP",
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "normal",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 90, halign: "left" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  // autoTableの最終Y位置を取得
  y = (doc as any).lastAutoTable.finalY + 2;

  // ── 集計テーブル（右寄せ） ──
  const summaryData: [string, string][] = [
    ["商品小計", yen(order.subtotalAmount)],
    ["送料", yen(order.shippingFee)],
    ["手数料", yen(order.handlingFee)],
    ["値引き", order.discount > 0 ? `-${yen(order.discount)}` : yen(0)],
  ];

  // 消費税内訳
  summaryData.push(["10%対象", yen(order.taxRate10Amount)]);
  summaryData.push(["8%対象", yen(order.taxRate8Amount)]);
  summaryData.push(["10%消費税", yen(order.tax10)]);
  summaryData.push(["8%消費税", yen(order.tax8)]);
  summaryData.push(["合計", yen(order.totalAmount)]);

  // ポイント利用行
  if (order.pointsUsed && order.pointsUsed > 0) {
    summaryData.push(["ポイント利用", `-${yen(order.pointsUsed)}`]);
  }

  // 最終支払金額（ポイント差し引き後）
  const finalPayment = order.pointsUsed && order.pointsUsed > 0
    ? Math.max(0, order.totalAmount - order.pointsUsed)
    : order.totalAmount;
  const finalLabel = type === "invoice" ? "請求金額" : type === "receipt" ? "領収金額" : "お支払い金額";
  summaryData.push([finalLabel, yen(finalPayment)]);

  autoTable(doc, {
    startY: y,
    body: summaryData,
    theme: "grid",
    styles: {
      font: "NotoSansJP",
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 30, halign: "right", fillColor: [245, 245, 245] },
      1: { cellWidth: 30, halign: "right" },
    },
    margin: { left: pageWidth - margin - 60, right: margin },
    didParseCell: (data) => {
      // 最後の2行（合計・請求金額）を太字風に
      if (data.row.index >= summaryData.length - 2) {
        data.cell.styles.fontStyle = "normal";
        data.cell.styles.fontSize = 9.5;
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── 軽減税率注記 ──
  if (order.taxRate8Amount > 0) {
    doc.setFontSize(8);
    doc.text("※は軽減税率（8%）対象", margin, y);
    y += 6;
  }

  // ポイント利用情報は集計テーブルに統合済み

  return doc;
}

/**
 * PDFをダウンロード
 */
export function downloadInvoicePdf(type: DocumentType, order: OrderData): void {
  const doc = generateInvoicePdf(type, order);
  const typeLabel = type === "delivery" ? "納品書" : type === "invoice" ? "請求書" : "領収書";
  doc.save(`${typeLabel}_${order.orderNumber}.pdf`);
}

/**
 * 注文データからPDF用のOrderDataに変換するヘルパー
 */
export function convertOrderToInvoiceData(
  orderDetail: {
    order: {
      orderNumber: string;
      createdAt: string | Date;
      totalAmount: number;
      pointsUsed: number;
      cashAmount: number;
      paymentMethod: string;
      shippingName?: string | null;
      shippingPhone?: string | null;
      shippingPostalCode?: string | null;
      shippingAddress?: string | null;
    };
    lineUser: {
      displayName?: string | null;
    } | null;
    items: Array<{
      productName: string;
      productPrice: number;
      productPointPrice?: number | null;
      quantity: number;
      subtotal: number;
    }>;
  }
): OrderData {
  const order = orderDetail.order;
  const isPoints = order.paymentMethod === "points";

  // 商品明細
  const items = orderDetail.items.map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: isPoints ? (item.productPointPrice ?? item.productPrice) : item.productPrice,
    subtotal: isPoints ? (item.productPointPrice ?? item.productPrice) * item.quantity : item.subtotal,
  }));

  // 商品小計（税抜）
  const subtotalAmount = items.reduce((sum, i) => sum + i.subtotal, 0);

  // 消費税計算（10%として計算、簡易計算）
  const taxRate = 0.10;
  const taxExcluded = Math.round(subtotalAmount / (1 + taxRate));
  const tax10 = subtotalAmount - taxExcluded;

  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    buyerName: order.shippingName || orderDetail.lineUser?.displayName || "お客様",
    buyerPostalCode: order.shippingPostalCode || undefined,
    buyerAddress: order.shippingAddress || undefined,
    buyerPhone: order.shippingPhone || undefined,
    items: items.map((i) => ({
      ...i,
      unitPrice: Math.round(i.unitPrice / (1 + taxRate)),
      subtotal: Math.round(i.subtotal / (1 + taxRate)),
    })),
    subtotalAmount: taxExcluded,
    shippingFee: 0,
    handlingFee: 0,
    discount: 0,
    taxRate10Amount: taxExcluded,
    taxRate8Amount: 0,
    tax10: tax10,
    tax8: 0,
    totalAmount: order.totalAmount,
    pointsUsed: order.pointsUsed > 0 ? order.pointsUsed : undefined,
    paymentMethod: order.paymentMethod,
  };
}
