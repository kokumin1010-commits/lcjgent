import { z } from "zod";

export const STORE_PRODUCT_HANDCARD_THEMES = ["aqua_light", "navy"] as const;

const trimmedText = (max: number) => z.string().trim().max(max).default("");
const optionalImageId = z.number().int().positive().nullable().default(null);

export const storeProductHandcardPdfSchema = z.object({
  storageKey: z.string().trim().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().min(1).max(20).nullable().default(null),
  isA4: z.boolean().nullable().default(null),
  uploadedAt: z.string().trim().min(1).max(64),
  uploadedByName: z.string().trim().max(255).nullable().default(null),
});

export type StoreProductHandcardPdf = z.infer<typeof storeProductHandcardPdfSchema>;

export const storeProductHandcardInputSchema = z.object({
  productId: z.number().int().positive(),
  theme: z.enum(STORE_PRODUCT_HANDCARD_THEMES).default("aqua_light"),
  seriesLabel: trimmedText(255),
  subtitle: trimmedText(255),
  shortDescription: trimmedText(800),
  sellingPoints: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  ingredients: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    function: z.string().trim().max(160).default(""),
    benefit: z.string().trim().max(160).default(""),
  })).max(8).default([]),
  usage: trimmedText(1_000),
  targetAudience: trimmedText(800),
  precautions: trimmedText(1_200),
  liveScript: trimmedText(1_200),
  faqs: z.array(z.object({
    question: z.string().trim().min(1).max(240),
    answer: z.string().trim().max(300).default(""),
  })).max(4).default([]),
  evidenceItems: z.array(z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(240).default(""),
    metric: z.string().trim().max(100).default(""),
    imageId: optionalImageId,
  })).max(4).default([]),
  normalPdf: storeProductHandcardPdfSchema.nullable().default(null),
  mirrorPdf: storeProductHandcardPdfSchema.nullable().default(null),
});

export type StoreProductHandcardInput = z.infer<typeof storeProductHandcardInputSchema>;
export type StoreProductHandcardContent = Omit<StoreProductHandcardInput, "productId">;

export const EMPTY_STORE_PRODUCT_HANDCARD: StoreProductHandcardContent = {
  theme: "aqua_light",
  seriesLabel: "",
  subtitle: "",
  shortDescription: "",
  sellingPoints: [],
  ingredients: [],
  usage: "",
  targetAudience: "",
  precautions: "",
  liveScript: "",
  faqs: [],
  evidenceItems: [],
  normalPdf: null,
  mirrorPdf: null,
};

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapStoreProductHandcardRow(row: any): StoreProductHandcardContent & {
  exists: boolean;
  revision: number;
  updatedAt: string | null;
  updatedByName: string | null;
} {
  if (!row) {
    return {
      ...EMPTY_STORE_PRODUCT_HANDCARD,
      sellingPoints: [],
      ingredients: [],
      faqs: [],
      evidenceItems: [],
      exists: false,
      revision: 0,
      updatedAt: null,
      updatedByName: null,
    };
  }
  const parsed = storeProductHandcardInputSchema.omit({ productId: true }).safeParse({
    theme: row.theme,
    seriesLabel: row.seriesLabel ?? "",
    subtitle: row.subtitle ?? "",
    shortDescription: row.shortDescription ?? "",
    sellingPoints: parseJsonArray(row.sellingPoints),
    ingredients: parseJsonArray(row.ingredients),
    usage: row.usage ?? "",
    targetAudience: row.targetAudience ?? "",
    precautions: row.precautions ?? "",
    liveScript: row.liveScript ?? "",
    faqs: parseJsonArray(row.faqs),
    evidenceItems: parseJsonArray(row.evidenceItems),
    normalPdf: row.normalPdf ?? null,
    mirrorPdf: row.mirrorPdf ?? null,
  });
  const content = parsed.success ? parsed.data : EMPTY_STORE_PRODUCT_HANDCARD;
  return {
    ...content,
    sellingPoints: [...content.sellingPoints],
    ingredients: content.ingredients.map((item) => ({ ...item })),
    faqs: content.faqs.map((item) => ({ ...item })),
    evidenceItems: content.evidenceItems.map((item) => ({ ...item })),
    exists: true,
    revision: Number(row.revision || 1),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    updatedByName: row.updatedByName ? String(row.updatedByName) : null,
  };
}

export function validateStoreProductHandcardEvidence(
  handcard: StoreProductHandcardContent,
  productImageIds: Iterable<number>,
): void {
  const allowed = new Set(Array.from(productImageIds, Number));
  const invalid = handcard.evidenceItems.find((item) => item.imageId !== null && !allowed.has(Number(item.imageId)));
  if (invalid) throw new Error(`依据图片不属于该商品：${invalid.title}`);
}

export function getStoreProductHandcardMissingFields(input: {
  product: { productName?: unknown; brandName?: unknown; basePrice?: unknown; mainImageUrl?: unknown };
  handcard: StoreProductHandcardContent;
  imageCount: number;
}): string[] {
  const missing: string[] = [];
  if (!String(input.product.productName ?? "").trim()) missing.push("商品名");
  if (!String(input.product.brandName ?? "").trim()) missing.push("品牌");
  if (Number(input.imageCount || 0) === 0 && !String(input.product.mainImageUrl ?? "").trim()) missing.push("商品图片");
  if (input.product.basePrice === null || input.product.basePrice === undefined || input.product.basePrice === "") missing.push("价格");
  if (!input.handcard.shortDescription.trim()) missing.push("商品简介");
  if (input.handcard.sellingPoints.length === 0) missing.push("核心卖点");
  if (!input.handcard.ingredients.some((item) => item.name.trim())) missing.push("成分／特点");
  if (!input.handcard.usage.trim()) missing.push("使用方法");
  if (!input.handcard.precautions.trim()) missing.push("注意事项");
  return missing;
}
