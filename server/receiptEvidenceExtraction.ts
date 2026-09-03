import { invokeLLM } from "./_core/llm";
import { normalizeReceiptOrderNumber } from "./receiptOrderNumberPolicy";

export type ReceiptEvidence = {
  isTikTokShop: boolean | null;
  isDelivered: boolean | null;
  orderNumber: string | null;
  allOrderNumbers: string[];
  totalAmount: number | null;
  orderDate: string | null;
  shopName: string | null;
  productName: string | null;
  orderNumberSource: string | null;
  items: Array<{
    productName: string | null;
    unitPrice: number | null;
    quantity: number | null;
    variant: string | null;
  }>;
  deliveryInfo: {
    recipientName: string | null;
    phoneNumber: string | null;
    postalCode: string | null;
    address: string | null;
    deliveryStatus: string | null;
    deliveryDate: string | null;
    returnDeadline: string | null;
  } | null;
  paymentInfo: {
    subtotal: number | null;
    shippingFee: number | null;
    discount: number | null;
    totalAmount: number | null;
    paymentMethod: string | null;
  } | null;
  confidence: number;
};

export type ReceiptEvidenceExtractionResult = {
  evidence: ReceiptEvidence;
  attempts: number;
  technicalErrors: string[];
  hasRequiredEvidence: boolean;
};

type InvokeReceiptLlm = typeof invokeLLM;

const receiptEvidenceSchema = {
  type: "object",
  properties: {
    isTikTokShop: { type: ["boolean", "null"] },
    isDelivered: { type: ["boolean", "null"] },
    orderNumber: { type: ["string", "null"] },
    allOrderNumbers: { type: "array", items: { type: "string" } },
    totalAmount: { type: ["number", "null"] },
    orderDate: { type: ["string", "null"] },
    shopName: { type: ["string", "null"] },
    productName: { type: ["string", "null"] },
    orderNumberSource: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          productName: { type: ["string", "null"] },
          unitPrice: { type: ["number", "null"] },
          quantity: { type: ["number", "null"] },
          variant: { type: ["string", "null"] },
        },
        required: ["productName", "unitPrice", "quantity", "variant"],
        additionalProperties: false,
      },
    },
    deliveryInfo: {
      type: ["object", "null"],
      properties: {
        recipientName: { type: ["string", "null"] },
        phoneNumber: { type: ["string", "null"] },
        postalCode: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        deliveryStatus: { type: ["string", "null"] },
        deliveryDate: { type: ["string", "null"] },
        returnDeadline: { type: ["string", "null"] },
      },
      required: [
        "recipientName",
        "phoneNumber",
        "postalCode",
        "address",
        "deliveryStatus",
        "deliveryDate",
        "returnDeadline",
      ],
      additionalProperties: false,
    },
    paymentInfo: {
      type: ["object", "null"],
      properties: {
        subtotal: { type: ["number", "null"] },
        shippingFee: { type: ["number", "null"] },
        discount: { type: ["number", "null"] },
        totalAmount: { type: ["number", "null"] },
        paymentMethod: { type: ["string", "null"] },
      },
      required: [
        "subtotal",
        "shippingFee",
        "discount",
        "totalAmount",
        "paymentMethod",
      ],
      additionalProperties: false,
    },
    confidence: { type: "number" },
  },
  required: [
    "isTikTokShop",
    "isDelivered",
    "orderNumber",
    "allOrderNumbers",
    "totalAmount",
    "orderDate",
    "shopName",
    "productName",
    "orderNumberSource",
    "items",
    "deliveryInfo",
    "paymentInfo",
    "confidence",
  ],
  additionalProperties: false,
} as const;

function emptyEvidence(): ReceiptEvidence {
  return {
    isTikTokShop: null,
    isDelivered: null,
    orderNumber: null,
    allOrderNumbers: [],
    totalAmount: null,
    orderDate: null,
    shopName: null,
    productName: null,
    orderNumberSource: null,
    items: [],
    deliveryInfo: null,
    paymentInfo: null,
    confidence: 0,
  };
}

function normalizeEvidence(raw: unknown): ReceiptEvidence {
  const value = raw && typeof raw === "object" ? (raw as Record<string, any>) : {};
  const items = Array.isArray(value.items) ? value.items : [];
  const paymentTotal = Number(value.paymentInfo?.totalAmount || 0);
  const itemTotal = items.reduce((sum: number, item: any) => {
    const price = Number(item?.unitPrice || 0);
    const quantity = Number(item?.quantity || 1);
    return sum + (price > 0 ? price * Math.max(quantity, 1) : 0);
  }, 0);
  const totalCandidate = Number(value.totalAmount || paymentTotal || itemTotal || 0);
  const orderNumber = normalizeReceiptOrderNumber(value.orderNumber);
  const allOrderNumbers = Array.isArray(value.allOrderNumbers)
    ? [...new Set(value.allOrderNumbers.map(normalizeReceiptOrderNumber).filter(Boolean))] as string[]
    : orderNumber
      ? [orderNumber]
      : [];

  return {
    ...emptyEvidence(),
    ...value,
    isTikTokShop: typeof value.isTikTokShop === "boolean" ? value.isTikTokShop : null,
    isDelivered: typeof value.isDelivered === "boolean" ? value.isDelivered : null,
    orderNumber,
    allOrderNumbers,
    totalAmount: totalCandidate > 0 ? totalCandidate : null,
    items,
    confidence: Number.isFinite(Number(value.confidence))
      ? Math.max(0, Math.min(100, Number(value.confidence)))
      : 0,
  };
}

export function mergeReceiptEvidence(
  primary: Partial<ReceiptEvidence> | null | undefined,
  retry: ReceiptEvidence
): ReceiptEvidence {
  const base = normalizeEvidence(primary || {});
  return {
    ...base,
    isTikTokShop: retry.isTikTokShop ?? base.isTikTokShop,
    isDelivered: retry.isDelivered ?? base.isDelivered,
    orderNumber: retry.orderNumber || base.orderNumber,
    allOrderNumbers:
      retry.allOrderNumbers.length > 0
        ? retry.allOrderNumbers
        : base.allOrderNumbers,
    totalAmount: retry.totalAmount || base.totalAmount,
    orderDate: retry.orderDate || base.orderDate,
    shopName: retry.shopName || base.shopName,
    productName: retry.productName || base.productName,
    orderNumberSource: retry.orderNumberSource || base.orderNumberSource,
    items: retry.items.length > 0 ? retry.items : base.items,
    deliveryInfo: retry.deliveryInfo || base.deliveryInfo,
    paymentInfo: retry.paymentInfo || base.paymentInfo,
    confidence: Math.max(base.confidence, retry.confidence),
  };
}

export function hasRequiredReceiptEvidence(evidence: ReceiptEvidence): boolean {
  return (
    evidence.isTikTokShop === true &&
    evidence.isDelivered === true &&
    Boolean(evidence.orderNumber) &&
    Boolean(evidence.totalAmount && evidence.totalAmount > 0)
  );
}

function shouldRetryEvidence(evidence: ReceiptEvidence): boolean {
  if (evidence.isTikTokShop === false || evidence.isDelivered === false) return false;
  return !hasRequiredReceiptEvidence(evidence);
}

export async function extractReceiptEvidenceWithRetry(
  imageUrls: string[],
  invoke: InvokeReceiptLlm = invokeLLM,
  maxAttempts: 1 | 2 = 2
): Promise<ReceiptEvidenceExtractionResult> {
  if (imageUrls.length < 1) throw new Error("At least one receipt image is required");

  const technicalErrors: string[] = [];
  let evidence = emptyEvidence();
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const response = await invoke({
        messages: [
          {
            role: "system",
            content: `あなたはTikTok Shop注文詳細の証拠確認AIです。全画像を一つの申請として統合し、画像に明示された情報だけを抽出してください。

必須確認項目は、TikTok Shop注文詳細であること、配達済みまたは已签收/已完成/配送完了であること、16〜19桁の注文番号、合計金額です。商品単価を合計金額として扱わないでください。電話番号・郵便番号を注文番号として扱わないでください。情報が別画像に分かれていても統合してください。不明な値は推測せずnullにしてください。`,
          },
          {
            role: "user",
            content: [
              ...imageUrls.map(url => ({
                type: "image_url" as const,
                image_url: { url, detail: "high" as const },
              })),
              {
                type: "text" as const,
                text:
                  attempt === 1
                    ? `全${imageUrls.length}枚を統合し、必須項目と商品・配送・支払情報を抽出してください。`
                    : "前回は主要情報が不足または解析に失敗しました。全画像を再確認し、注文番号、合計金額、配達状態を特に慎重に読み取ってください。",
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt_evidence_v2",
            strict: true,
            schema: receiptEvidenceSchema,
          },
        },
      });
      const content = response.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new Error("AI returned an empty receipt response");
      }
      evidence = normalizeEvidence(JSON.parse(content));
      if (!shouldRetryEvidence(evidence)) break;
    } catch (error: any) {
      technicalErrors.push(String(error?.message || error));
      if (attempt === maxAttempts) break;
    }
  }

  return {
    evidence,
    attempts,
    technicalErrors,
    hasRequiredEvidence: hasRequiredReceiptEvidence(evidence),
  };
}
