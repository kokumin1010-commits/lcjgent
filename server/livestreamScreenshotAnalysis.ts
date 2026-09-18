import {
  DEFAULT_LIVESTREAM_PLATFORM,
  LIVESTREAM_PLATFORM_VALUES,
  type LivestreamPlatform,
} from "../shared/livestreamPlatforms";

const DETECTED_PLATFORM_VALUES = [
  ...LIVESTREAM_PLATFORM_VALUES,
  "Unknown",
] as const;
type DetectedLivestreamPlatform = (typeof DETECTED_PLATFORM_VALUES)[number];

const nullableNumberSchema = { type: ["number", "null"] } as const;
const nullableStringSchema = { type: ["string", "null"] } as const;

export const LIVESTREAM_SCREENSHOT_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "livestream_screenshot_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        detectedPlatform: { type: "string", enum: DETECTED_PLATFORM_VALUES },
        salesAmount: nullableNumberSchema,
        currency: nullableStringSchema,
        viewerCount: nullableNumberSchema,
        peakViewerCount: nullableNumberSchema,
        durationMinutes: nullableNumberSchema,
        productClicks: nullableNumberSchema,
        orderCount: nullableNumberSchema,
        impressions: nullableNumberSchema,
        salesCount: nullableNumberSchema,
        cartAddCount: nullableNumberSchema,
        avgViewDuration: nullableNumberSchema,
        likes: nullableNumberSchema,
        comments: nullableNumberSchema,
        shares: nullableNumberSchema,
        avgPrice: nullableNumberSchema,
        livestreamStartTime: nullableStringSchema,
        livestreamEndTime: nullableStringSchema,
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
        productList: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              productName: { type: "string" },
              quantity: nullableNumberSchema,
              revenue: nullableNumberSchema,
            },
            required: ["productName", "quantity", "revenue"],
          },
        },
      },
      required: [
        "detectedPlatform",
        "salesAmount",
        "currency",
        "viewerCount",
        "peakViewerCount",
        "durationMinutes",
        "productClicks",
        "orderCount",
        "impressions",
        "salesCount",
        "cartAddCount",
        "avgViewDuration",
        "likes",
        "comments",
        "shares",
        "avgPrice",
        "livestreamStartTime",
        "livestreamEndTime",
        "confidence",
        "warnings",
        "productList",
      ],
    },
  },
};

const platformInstructions: Record<LivestreamPlatform, string> = {
  TikTok:
    "TikTok LIVE / TikTok Shop画面として、GMV・売上、視聴者数、ピーク同時視聴者数、配信時間、商品クリック数、注文数、インプレッション、販売点数、いいね、コメント、シェア、平均視聴時間、商品別データを探してください。",
  Shopee:
    "Shopee Live（虾皮直播／蝦皮直播）の配信結果画面として、销售额／銷售額、参与的观众数／參與的觀眾數、评论／評論、加入购物车／加入購物車、总观看次数／總觀看次數、平均观看时间／平均觀看時間、已下订单／已下訂單、直播时长／直播時長を重点的に探してください。",
  Instagram:
    "Instagram Live画面として、リーチ、視聴者、ピーク視聴者、再生数、いいね、コメント、シェア、配信時間を探してください。",
  YouTube:
    "YouTube Live画面として、視聴回数、ユニーク視聴者、ピーク同時視聴者、平均視聴時間、いいね、コメント、配信時間を探してください。",
  "Amazon Live":
    "Amazon Live画面として、売上、注文、商品クリック、視聴者、インプレッション、配信時間、商品別データを探してください。",
  淘宝直播:
    "淘宝直播画面として、成交金额、观看人数、观看次数、商品点击、加购、订单、互动、平均观看时长、直播时长を探してください。",
  京东直播:
    "京东直播画面として、成交金额、观看人数、观看次数、商品点击、加购、订单、互动、平均观看时长、直播时长を探してください。",
  快手直播:
    "快手直播画面として、成交金额、观看人数、观看次数、商品点击、加购、订单、互动、平均观看时长、直播时长を探してください。",
  楽天ライブ:
    "楽天ライブ画面として、売上、注文、商品クリック、視聴者、再生数、コメント、配信時間、商品別データを探してください。",
  Other:
    "特定プラットフォームに決めつけず、画面のラベルと数値を読み、共通指標へ慎重に対応付けてください。",
};

export function buildLivestreamScreenshotPrompt(
  platform: LivestreamPlatform,
  referenceDate: Date = new Date(),
): string {
  const referenceDateText = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
  return `あなたはライブコマース管理画面のOCR・指標抽出専門家です。ユーザーが選択した分析対象プラットフォームは「${platform}」です。

解析基準日の日本時間は${referenceDateText}です。画像内に年が表示されず月日だけが表示される場合は、この基準日と同じ年を使ってください。画像上部の「配信時間／時長」と開始・終了日時の行を最優先で読み、グラフ軸・商品番号・GMVを日付や時刻として扱わないでください。

${platformInstructions[platform]}

画面上のロゴ、名称、UIから実際のプラットフォームも独立して判定し、detectedPlatformに返してください。判定できなければUnknownです。選択先と実画面が異なっても、実画面を正直に判定し、見えているラベルに基づいて共通指標を抽出してください。

必須ルール:
1. 画像に表示されていない値、読めない値、対応が曖昧な値は必ずnullにしてください。0を代用したり推測したりしないでください。
2. salesAmountは画面に表示された数値そのものです。通貨記号または通貨コードが明瞭な場合だけcurrencyへISO 4217コードを返し、言語・国・プラットフォームだけから通貨を推測しないでください。
3. viewerCountは参加・到達した視聴者、peakViewerCountはピーク同時視聴者です。総視聴回数／再生数はimpressionsへ入れ、viewerCountと混同しないでください。
4. cartAddCountはカート追加数、orderCountは注文数、salesCountは販売点数です。異なる指標を相互に代用しないでください。
5. durationMinutesはライブ全体の配信時間を分へ換算した整数です。例: 02:00:08は120、2小时14分钟26秒は134です。avgViewDurationは平均視聴時間を秒へ換算した整数です。例: 00:00:23は23。開始・終了日時の差と表示時長が矛盾する場合はwarningsへ記載してください。
6. 日時が明瞭な場合だけlivestreamStartTime／livestreamEndTimeへISO 8601形式で返し、更新日時をライブ終了日時と決めつけないでください。未来の日付を推測してはいけません。
7. productListは商品名が読める行だけを返してください。商品名をIDや省略文字から推測しないでください。
8. OCRの曖昧さ、選択プラットフォームとの不一致、通貨不明など、保存前に利用者へ知らせるべき内容はwarningsへ短く記載してください。`;
}

export interface NormalizedLivestreamScreenshotAnalysis {
  platform: LivestreamPlatform;
  detectedPlatform: DetectedLivestreamPlatform;
  platformMismatch: boolean;
  salesAmount: number | null;
  currency: string | null;
  viewerCount: number | null;
  peakViewerCount: number | null;
  durationMinutes: number | null;
  productClicks: number | null;
  orderCount: number | null;
  startDateTime: string | null;
  endDateTime: string | null;
  confidence: "high" | "medium" | "low";
  warnings: string[];
  productList: Array<{
    productName: string;
    quantity: number | null;
    revenue: number | null;
  }>;
  rawData: {
    impressions: number | null;
    salesCount: number | null;
    cartAddCount: number | null;
    avgViewDuration: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    avgPrice: number | null;
  };
}

const metricLimits = {
  money: 1_000_000_000_000,
  count: 1_000_000_000_000,
  durationMinutes: 10_080,
  durationSeconds: 604_800,
};

function finiteNonNegative(
  value: unknown,
  max: number,
  integer = true
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    return null;
  return integer ? Math.round(value) : value;
}

function nullableText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizedDetectedPlatform(
  value: unknown
): DetectedLivestreamPlatform {
  return (DETECTED_PLATFORM_VALUES as readonly unknown[]).includes(value)
    ? (value as DetectedLivestreamPlatform)
    : "Unknown";
}

export function normalizeLivestreamScreenshotAnalysis(
  value: unknown,
  platform: LivestreamPlatform = DEFAULT_LIVESTREAM_PLATFORM,
  referenceDate: Date = new Date(),
): NormalizedLivestreamScreenshotAnalysis {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const detectedPlatform = normalizedDetectedPlatform(source.detectedPlatform);
  const platformMismatch =
    detectedPlatform !== "Unknown" && detectedPlatform !== platform;
  const salesAmount = finiteNonNegative(
    source.salesAmount,
    metricLimits.money,
    false
  );
  const currencyCandidate =
    nullableText(source.currency, 12)?.toUpperCase() ?? null;
  const currency =
    currencyCandidate && /^[A-Z]{3}$/.test(currencyCandidate)
      ? currencyCandidate
      : null;
  const warnings = Array.isArray(source.warnings)
    ? source.warnings
        .filter((item): item is string => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 10)
    : [];

  if (platformMismatch) {
    warnings.unshift(
      `選択した${platform}と画像から検出した${detectedPlatform}が一致しません。`
    );
  }
  let rejectedFutureDate = false;
  const normalizeDateTime = (raw: unknown, label: string): string | null => {
    const text = nullableText(raw, 80);
    if (!text) return null;
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      warnings.push(`${label}を日時として確認できませんでした。保存前に確認してください。`);
      return null;
    }
    if (parsed.getTime() > referenceDate.getTime() + 24 * 60 * 60 * 1000) {
      rejectedFutureDate = true;
      warnings.push(`${label}が未来日になっているため自動入力しませんでした。`);
      return null;
    }
    return text;
  };
  const startDateTime = normalizeDateTime(source.livestreamStartTime, "配信開始日時");
  const endDateTime = normalizeDateTime(source.livestreamEndTime, "配信終了日時");
  let durationMinutes = finiteNonNegative(
    source.durationMinutes,
    metricLimits.durationMinutes
  );
  if (rejectedFutureDate) durationMinutes = null;
  if (startDateTime && endDateTime) {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const derivedMinutes = Math.floor((end.getTime() - start.getTime()) / 60_000);
    if (derivedMinutes > 0 && derivedMinutes <= metricLimits.durationMinutes) {
      if (
        durationMinutes !== null &&
        Math.abs(durationMinutes - derivedMinutes) > Math.max(5, derivedMinutes * 0.2)
      ) {
        warnings.push("表示時長と開始・終了日時が一致しないため、日時差を使用しました。");
      }
      durationMinutes = derivedMinutes;
    }
  }
  const productList = Array.isArray(source.productList)
    ? source.productList
        .map(item => {
          const product =
            item && typeof item === "object"
              ? (item as Record<string, unknown>)
              : {};
          return {
            productName: nullableText(product.productName, 300) ?? "",
            quantity: finiteNonNegative(product.quantity, metricLimits.count),
            revenue: finiteNonNegative(
              product.revenue,
              metricLimits.money,
              false
            ),
          };
        })
        .filter(item => item.productName.length > 0)
        .slice(0, 200)
    : [];

  return {
    platform,
    detectedPlatform,
    platformMismatch,
    salesAmount,
    currency,
    viewerCount: finiteNonNegative(source.viewerCount, metricLimits.count),
    peakViewerCount: finiteNonNegative(
      source.peakViewerCount,
      metricLimits.count
    ),
    durationMinutes,
    productClicks: finiteNonNegative(source.productClicks, metricLimits.count),
    orderCount: finiteNonNegative(source.orderCount, metricLimits.count),
    startDateTime,
    endDateTime,
    confidence: ["high", "medium", "low"].includes(String(source.confidence))
      ? (source.confidence as "high" | "medium" | "low")
      : "low",
    warnings: [...new Set(warnings)].slice(0, 10),
    productList,
    rawData: {
      impressions: finiteNonNegative(source.impressions, metricLimits.count),
      salesCount: finiteNonNegative(source.salesCount, metricLimits.count),
      cartAddCount: finiteNonNegative(source.cartAddCount, metricLimits.count),
      avgViewDuration: finiteNonNegative(
        source.avgViewDuration,
        metricLimits.durationSeconds
      ),
      likes: finiteNonNegative(source.likes, metricLimits.count),
      comments: finiteNonNegative(source.comments, metricLimits.count),
      shares: finiteNonNegative(source.shares, metricLimits.count),
      avgPrice: finiteNonNegative(source.avgPrice, metricLimits.money, false),
    },
  };
}
