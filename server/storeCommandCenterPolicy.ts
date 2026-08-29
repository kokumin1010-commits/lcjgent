import { createHash } from "node:crypto";

export const STORE_COMMAND_DATA_TYPES = [
  "sku_performance",
  "orders",
  "refunds",
  "live",
  "creators",
  "videos",
] as const;

export type StoreCommandDataType = (typeof STORE_COMMAND_DATA_TYPES)[number];

export type NormalizedGrowthRow = {
  businessKey: string;
  businessDate: string | null;
  orderId: string | null;
  orderLineId: string | null;
  refundId: string | null;
  productId: string | null;
  productName: string | null;
  skuId: string | null;
  skuName: string | null;
  quantity: number;
  deliveredQuantity: number;
  gmv: number;
  refundQuantity: number;
  refundAmount: number;
  returnReason: string | null;
  channel: string | null;
  creatorName: string | null;
  sourceContentId: string | null;
  sourceSessionId: string | null;
  impressions: number;
  clicks: number;
  orders: number;
  raw: Record<string, unknown>;
  warnings: string[];
};

export type GrowthAlertCandidate = {
  ruleKey:
    | "sku_refund_risk"
    | "high_exposure_low_ctr"
    | "high_click_low_cvr"
    | "high_cvr_low_exposure";
  fingerprint: string;
  entityType: "sku";
  entityKey: string;
  productId: string | null;
  productName: string | null;
  skuId: string | null;
  skuName: string | null;
  severity: "medium" | "high" | "critical";
  metricKey: string;
  currentValue: number;
  baselineValue: number | null;
  opportunityValue: number;
  title: string;
  explanation: string;
  steps: string[];
  targetValue: number | null;
  observationDays: number;
  confidence: number;
  guardrails: Record<string, unknown>;
  evidence: Record<string, unknown>;
};

const aliasMap: Record<
  keyof Omit<NormalizedGrowthRow, "businessKey" | "raw" | "warnings">,
  string[]
> = {
  businessDate: [
    "日期",
    "日付",
    "date",
    "统计日期",
    "集計日",
    "作成日時",
    "注文作成日時",
    "ordercreatedat",
    "refunddate",
    "退款时间",
    "返金日時",
  ],
  orderId: ["订单号", "注文id", "orderid", "order id"],
  orderLineId: [
    "子订单号",
    "サブ注文id",
    "suborderid",
    "sub order id",
    "lineid",
    "orderlineid",
  ],
  refundId: ["退款单号", "返金id", "refundid", "refund id", "returnid"],
  productId: ["商品id", "productid", "product id", "商品番号"],
  productName: ["商品名", "商品名称", "productname", "product name"],
  skuId: ["skuid", "sku id", "商品skuid", "seller sku", "规格id", "規格id"],
  skuName: [
    "sku",
    "sku名称",
    "sku名",
    "商品sku",
    "商品sku名称",
    "variation",
    "variation name",
    "规格",
    "規格",
  ],
  quantity: [
    "数量",
    "商品成交件数",
    "販売数量",
    "solditems",
    "sold items",
    "quantity",
    "注文数量",
  ],
  deliveredQuantity: [
    "送达数量",
    "已送达数量",
    "配達済数量",
    "deliveredquantity",
    "delivered quantity",
  ],
  gmv: [
    "gmv",
    "商品交易总额",
    "商品成交金额",
    "成交金额",
    "支付金额",
    "売上",
    "売上高",
    "orderamount",
    "order amount",
  ],
  refundQuantity: [
    "退款数量",
    "退货数量",
    "返金される商品の数量",
    "返品される商品の数量",
    "refundquantity",
    "returnquantity",
    "refunded items",
  ],
  refundAmount: [
    "退款金额",
    "退款金額",
    "返金額",
    "返品金額",
    "refundamount",
    "refund amount",
    "returnamount",
  ],
  returnReason: [
    "退款原因",
    "退货原因",
    "返金理由",
    "返品理由",
    "refundreason",
    "returnreason",
  ],
  channel: [
    "渠道",
    "成交渠道",
    "チャネル",
    "channel",
    "contenttype",
    "コンテンツタイプ",
  ],
  creatorName: [
    "达人",
    "达人名称",
    "クリエイター",
    "クリエイターのユーザー名",
    "creator",
    "creatorusername",
  ],
  sourceContentId: ["内容id", "コンテンツid", "contentid", "videoid", "视频id"],
  sourceSessionId: ["直播场次id", "配信id", "liveid", "sessionid", "直播id"],
  impressions: [
    "曝光",
    "曝光次数",
    "商品曝光次数",
    "impressions",
    "views",
    "播放量",
    "視聴数",
  ],
  clicks: ["点击", "点击量", "商品点击量", "clicks", "productclicks"],
  orders: ["订单", "订单数", "注文", "注文数", "sku订单数", "orders"],
};

function normalizedHeader(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_()（）・/\-]/g, "");
}

function normalizedText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).normalize("NFKC").trim();
  return text && text !== "-" ? text.slice(0, 1000) : null;
}

function numericValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim();
  const parsed = Number(normalized.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime()))
    return value.toISOString().slice(0, 10);
  const text = normalizedText(value);
  if (!text) return null;
  const compact = text.slice(0, 10).replace(/[./]/g, "-");
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(compact)) {
    const [year, month, day] = compact.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(compact)) {
    const [day, month, year] = compact.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function rowLookup(row: Record<string, unknown>, aliases: string[]): unknown {
  const entries = Object.entries(row);
  const wanted = new Set(aliases.map(normalizedHeader));
  const exact = entries.find(([key]) => wanted.has(normalizedHeader(key)));
  return exact?.[1];
}

function rowIdentity(
  dataType: StoreCommandDataType,
  row: Omit<NormalizedGrowthRow, "businessKey">,
  index: number
): string {
  const entity =
    row.skuId || row.skuName || row.productId || row.productName || "unknown";
  const candidates: Record<StoreCommandDataType, unknown[]> = {
    sku_performance: [
      row.businessDate,
      row.productId || row.productName,
      row.skuId || row.skuName,
    ],
    orders: [row.orderId, row.orderLineId || entity],
    refunds: [
      row.refundId || row.orderId,
      row.orderLineId || entity,
      row.businessDate,
      row.refundAmount,
    ],
    live: [row.sourceSessionId || row.businessDate, entity],
    creators: [
      row.creatorName,
      row.sourceContentId || row.businessDate,
      entity,
    ],
    videos: [row.sourceContentId || row.businessDate, entity],
  };
  const parts = candidates[dataType]
    .map(value => normalizedText(value) || "")
    .filter(Boolean);
  if (parts.length >= 2) return parts.join("|").slice(0, 500);
  const digest = createHash("sha256")
    .update(JSON.stringify(row.raw))
    .digest("hex");
  return `row:${index}:${digest}`;
}

export function normalizeGrowthRows(
  dataType: StoreCommandDataType,
  rows: Record<string, unknown>[]
): {
  rows: NormalizedGrowthRow[];
  rejected: Array<{ row: number; reasons: string[] }>;
} {
  const normalized: NormalizedGrowthRow[] = [];
  const rejected: Array<{ row: number; reasons: string[] }> = [];
  rows.forEach((raw, index) => {
    const rowBase = {
      businessDate: normalizedDate(rowLookup(raw, aliasMap.businessDate)),
      orderId: normalizedText(rowLookup(raw, aliasMap.orderId)),
      orderLineId: normalizedText(rowLookup(raw, aliasMap.orderLineId)),
      refundId: normalizedText(rowLookup(raw, aliasMap.refundId)),
      productId: normalizedText(rowLookup(raw, aliasMap.productId)),
      productName: normalizedText(rowLookup(raw, aliasMap.productName)),
      skuId: normalizedText(rowLookup(raw, aliasMap.skuId)),
      skuName: normalizedText(rowLookup(raw, aliasMap.skuName)),
      quantity: numericValue(rowLookup(raw, aliasMap.quantity)),
      deliveredQuantity: numericValue(
        rowLookup(raw, aliasMap.deliveredQuantity)
      ),
      gmv: numericValue(rowLookup(raw, aliasMap.gmv)),
      refundQuantity: numericValue(rowLookup(raw, aliasMap.refundQuantity)),
      refundAmount: numericValue(rowLookup(raw, aliasMap.refundAmount)),
      returnReason: normalizedText(rowLookup(raw, aliasMap.returnReason)),
      channel: normalizedText(rowLookup(raw, aliasMap.channel)),
      creatorName: normalizedText(rowLookup(raw, aliasMap.creatorName)),
      sourceContentId: normalizedText(rowLookup(raw, aliasMap.sourceContentId)),
      sourceSessionId: normalizedText(rowLookup(raw, aliasMap.sourceSessionId)),
      impressions: numericValue(rowLookup(raw, aliasMap.impressions)),
      clicks: numericValue(rowLookup(raw, aliasMap.clicks)),
      orders: numericValue(rowLookup(raw, aliasMap.orders)),
      raw,
      warnings: [] as string[],
    };
    if (!rowBase.productId && !rowBase.productName && !rowBase.orderId)
      rowBase.warnings.push("商品、SKUまたは注文を識別できません");
    if (!rowBase.businessDate) rowBase.warnings.push("日付を識別できません");
    if (
      dataType === "refunds" &&
      rowBase.refundAmount <= 0 &&
      rowBase.refundQuantity <= 0
    )
      rowBase.warnings.push("退款金额或数量为空");
    if (dataType === "orders" && !rowBase.orderId)
      rowBase.warnings.push("订单号为空");
    if (
      (dataType === "sku_performance" || dataType === "refunds") &&
      !rowBase.skuId &&
      !rowBase.skuName
    )
      rowBase.warnings.push("SKU为空，将按商品汇总");
    if (
      rowBase.warnings.some(
        message =>
          message === "商品、SKUまたは注文を識別できません" ||
          message === "订单号为空"
      )
    ) {
      rejected.push({ row: index + 2, reasons: rowBase.warnings });
      return;
    }
    const row = { ...rowBase, businessKey: "" } as NormalizedGrowthRow;
    row.businessKey = rowIdentity(dataType, row, index);
    normalized.push(row);
  });
  return { rows: normalized, rejected };
}

function median(values: number[]): number {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 0;
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2
    ? finite[middle]
    : (finite[middle - 1] + finite[middle]) / 2;
}

function entityKey(row: NormalizedGrowthRow): string {
  return [
    row.productId || row.productName || "unknown-product",
    row.skuId || row.skuName || "default-sku",
  ]
    .join("|")
    .slice(0, 500);
}

function displaySku(item: {
  productName: string | null;
  skuName: string | null;
}): string {
  return item.skuName || item.productName || "未识别SKU";
}

export function buildGrowthAlertCandidates(
  rows: NormalizedGrowthRow[]
): GrowthAlertCandidate[] {
  const aggregate = new Map<
    string,
    NormalizedGrowthRow & { refundReasons: Map<string, number> }
  >();
  for (const row of rows) {
    const key = entityKey(row);
    const current = aggregate.get(key) || {
      ...row,
      quantity: 0,
      deliveredQuantity: 0,
      gmv: 0,
      refundQuantity: 0,
      refundAmount: 0,
      impressions: 0,
      clicks: 0,
      orders: 0,
      refundReasons: new Map<string, number>(),
    };
    current.quantity += row.quantity;
    current.deliveredQuantity += row.deliveredQuantity || row.quantity;
    current.gmv += row.gmv;
    current.refundQuantity += row.refundQuantity;
    current.refundAmount += row.refundAmount;
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.orders += row.orders;
    if (row.returnReason)
      current.refundReasons.set(
        row.returnReason,
        (current.refundReasons.get(row.returnReason) || 0) +
          Math.max(row.refundAmount, row.refundQuantity, 1)
      );
    aggregate.set(key, current);
  }
  const items = [...aggregate.entries()].map(([key, row]) => {
    const delivered = Math.max(row.deliveredQuantity, row.quantity, row.orders);
    const returnRate =
      delivered > 0 ? (row.refundQuantity / delivered) * 100 : 0;
    const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    const cvr = row.clicks > 0 ? (row.orders / row.clicks) * 100 : 0;
    const aov = row.orders > 0 ? row.gmv / row.orders : 0;
    return { key, row, delivered, returnRate, ctr, cvr, aov };
  });
  const medianReturnRate = median(
    items.filter(item => item.delivered >= 5).map(item => item.returnRate)
  );
  const medianCtr = median(
    items.filter(item => item.row.impressions >= 1000).map(item => item.ctr)
  );
  const medianCvr = median(
    items.filter(item => item.row.clicks >= 30).map(item => item.cvr)
  );
  const medianImpressions = median(items.map(item => item.row.impressions));
  const alerts: GrowthAlertCandidate[] = [];

  for (const item of items) {
    const skuLabel = displaySku(item.row);
    if (
      item.delivered >= 20 &&
      item.row.refundQuantity >= 3 &&
      (item.returnRate >= Math.max(10, medianReturnRate * 2) ||
        item.row.refundAmount >= 50_000)
    ) {
      const topReasons = [...item.row.refundReasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);
      const severity =
        item.row.refundAmount >= 100_000 || item.returnRate >= 25
          ? "critical"
          : item.row.refundAmount >= 50_000 || item.returnRate >= 15
            ? "high"
            : "medium";
      alerts.push({
        ruleKey: "sku_refund_risk",
        fingerprint: `sku_refund_risk:${item.key}`,
        entityType: "sku",
        entityKey: item.key,
        productId: item.row.productId,
        productName: item.row.productName,
        skuId: item.row.skuId,
        skuName: item.row.skuName,
        severity,
        metricKey: "returnRate",
        currentValue: item.returnRate,
        baselineValue: medianReturnRate || null,
        opportunityValue: item.row.refundAmount,
        title: `${skuLabel} 退货损失异常`,
        explanation: `退货率 ${item.returnRate.toFixed(1)}%，退款损失 ¥${Math.round(item.row.refundAmount).toLocaleString()}，店铺SKU中位数 ${medianReturnRate.toFixed(1)}%。`,
        steps: [
          "检查退款原因Top 3和对应订单",
          "核对商品页承诺、规格、使用方法、包装与物流",
          "同步直播、达人和短视频话术",
          "上传修改前后证据并提交观察",
        ],
        targetValue: Math.min(10, medianReturnRate || 10),
        observationDays: 14,
        confidence: 0.85,
        guardrails: { cvrDropMaxPct: 5 },
        evidence: {
          delivered: item.delivered,
          refundQuantity: item.row.refundQuantity,
          refundAmount: item.row.refundAmount,
          topReasons,
        },
      });
    }
    if (
      item.row.impressions >= 10_000 &&
      medianCtr > 0 &&
      item.ctr < medianCtr * 0.7
    ) {
      const potentialClicks =
        (item.row.impressions * (medianCtr - item.ctr)) / 100;
      const opportunity = ((potentialClicks * item.cvr) / 100) * item.aov;
      alerts.push({
        ruleKey: "high_exposure_low_ctr",
        fingerprint: `high_exposure_low_ctr:${item.key}`,
        entityType: "sku",
        entityKey: item.key,
        productId: item.row.productId,
        productName: item.row.productName,
        skuId: item.row.skuId,
        skuName: item.row.skuName,
        severity: opportunity >= 100_000 ? "high" : "medium",
        metricKey: "ctr",
        currentValue: item.ctr,
        baselineValue: medianCtr,
        opportunityValue: opportunity,
        title: `${skuLabel} 高曝光低点击`,
        explanation: `曝光 ${Math.round(item.row.impressions).toLocaleString()}，CTR ${item.ctr.toFixed(2)}%，低于店铺中位数 ${medianCtr.toFixed(2)}%。`,
        steps: [
          "检查首图和标题前缀",
          "更换短视频前3秒钩子或直播商品卖点",
          "只改变一个变量建立对照",
          "提交观察并等待新数据验证",
        ],
        targetValue: medianCtr,
        observationDays: 7,
        confidence: 0.7,
        guardrails: { cvrDropMaxPct: 5 },
        evidence: {
          impressions: item.row.impressions,
          clicks: item.row.clicks,
          ctr: item.ctr,
        },
      });
    }
    if (item.row.clicks >= 300 && medianCvr > 0 && item.cvr < medianCvr * 0.7) {
      const opportunity =
        ((item.row.clicks * (medianCvr - item.cvr)) / 100) * item.aov;
      alerts.push({
        ruleKey: "high_click_low_cvr",
        fingerprint: `high_click_low_cvr:${item.key}`,
        entityType: "sku",
        entityKey: item.key,
        productId: item.row.productId,
        productName: item.row.productName,
        skuId: item.row.skuId,
        skuName: item.row.skuName,
        severity: opportunity >= 100_000 ? "high" : "medium",
        metricKey: "cvr",
        currentValue: item.cvr,
        baselineValue: medianCvr,
        opportunityValue: opportunity,
        title: `${skuLabel} 高点击低成交`,
        explanation: `点击 ${Math.round(item.row.clicks).toLocaleString()}，CVR ${item.cvr.toFixed(2)}%，低于店铺中位数 ${medianCvr.toFixed(2)}%。`,
        steps: [
          "检查SKU售价、折扣、库存和物流",
          "核对评价、详情页和使用说明",
          "确认直播/达人承诺与页面一致",
          "修改后提交观察",
        ],
        targetValue: medianCvr,
        observationDays: 7,
        confidence: 0.75,
        guardrails: { returnRateIncreaseMaxPct: 2 },
        evidence: {
          clicks: item.row.clicks,
          orders: item.row.orders,
          cvr: item.cvr,
        },
      });
    }
    if (
      item.row.clicks >= 50 &&
      medianCvr > 0 &&
      item.cvr >= medianCvr * 1.3 &&
      item.row.impressions < medianImpressions * 0.7
    ) {
      const opportunity =
        ((((Math.max(0, medianImpressions - item.row.impressions) * item.ctr) /
          100) *
          item.cvr) /
          100) *
        item.aov;
      alerts.push({
        ruleKey: "high_cvr_low_exposure",
        fingerprint: `high_cvr_low_exposure:${item.key}`,
        entityType: "sku",
        entityKey: item.key,
        productId: item.row.productId,
        productName: item.row.productName,
        skuId: item.row.skuId,
        skuName: item.row.skuName,
        severity: opportunity >= 100_000 ? "high" : "medium",
        metricKey: "impressions",
        currentValue: item.row.impressions,
        baselineValue: medianImpressions,
        opportunityValue: opportunity,
        title: `${skuLabel} 高转化低曝光`,
        explanation: `CVR ${item.cvr.toFixed(2)}% 高于店铺中位数 ${medianCvr.toFixed(2)}%，但曝光仅 ${Math.round(item.row.impressions).toLocaleString()}。`,
        steps: [
          "确认库存覆盖至少14天",
          "增加直播排期、达人分发或短视频复制",
          "保持原商品页和价格作为对照",
          "提交扩大动作并观察效率",
        ],
        targetValue: medianImpressions,
        observationDays: 7,
        confidence: 0.65,
        guardrails: { cvrDropMaxPct: 10, returnRateIncreaseMaxPct: 2 },
        evidence: {
          impressions: item.row.impressions,
          cvr: item.cvr,
          medianImpressions,
        },
      });
    }
  }
  return alerts.sort(
    (a, b) =>
      b.opportunityValue * b.confidence - a.opportunityValue * a.confidence
  );
}

export function evaluateMetric(input: {
  metricKey: string;
  baseline: number | null;
  target: number | null;
  current: number | null;
}): "effective" | "ineffective" | "insufficient" {
  if (input.current === null || input.target === null) return "insufficient";
  if (input.metricKey === "returnRate")
    return input.current <= input.target ? "effective" : "ineffective";
  return input.current >= input.target ? "effective" : "ineffective";
}

export type StoreSkuMetric = {
  entityKey: string;
  productId: string | null;
  productName: string | null;
  skuId: string | null;
  skuName: string | null;
  quantity: number;
  deliveredQuantity: number;
  gmv: number;
  refundQuantity: number;
  refundAmount: number;
  impressions: number;
  clicks: number;
  orders: number;
  returnRate: number;
  ctr: number;
  cvr: number;
  aov: number;
  topReasons: Array<{ reason: string; value: number }>;
};

export function buildStoreSkuMetrics(
  rows: NormalizedGrowthRow[]
): StoreSkuMetric[] {
  const aggregate = new Map<
    string,
    {
      sample: NormalizedGrowthRow;
      quantity: number;
      deliveredQuantity: number;
      gmv: number;
      refundQuantity: number;
      refundAmount: number;
      impressions: number;
      clicks: number;
      orders: number;
      reasons: Map<string, number>;
    }
  >();
  for (const row of rows) {
    const key = entityKey(row);
    const current = aggregate.get(key) || {
      sample: row,
      quantity: 0,
      deliveredQuantity: 0,
      gmv: 0,
      refundQuantity: 0,
      refundAmount: 0,
      impressions: 0,
      clicks: 0,
      orders: 0,
      reasons: new Map<string, number>(),
    };
    current.quantity += row.quantity;
    current.deliveredQuantity += row.deliveredQuantity;
    current.gmv += row.gmv;
    current.refundQuantity += row.refundQuantity;
    current.refundAmount += row.refundAmount;
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.orders += row.orders;
    if (row.returnReason)
      current.reasons.set(
        row.returnReason,
        (current.reasons.get(row.returnReason) || 0) +
          Math.max(row.refundAmount, row.refundQuantity, 1)
      );
    aggregate.set(key, current);
  }
  return [...aggregate.entries()].map(([key, item]) => {
    const deliveredQuantity = Math.max(
      item.deliveredQuantity,
      item.quantity,
      item.orders
    );
    const returnRate =
      deliveredQuantity > 0
        ? (item.refundQuantity / deliveredQuantity) * 100
        : 0;
    const ctr =
      item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
    const cvr = item.clicks > 0 ? (item.orders / item.clicks) * 100 : 0;
    const aov = item.orders > 0 ? item.gmv / item.orders : 0;
    return {
      entityKey: key,
      productId: item.sample.productId,
      productName: item.sample.productName,
      skuId: item.sample.skuId,
      skuName: item.sample.skuName,
      quantity: item.quantity,
      deliveredQuantity,
      gmv: item.gmv,
      refundQuantity: item.refundQuantity,
      refundAmount: item.refundAmount,
      impressions: item.impressions,
      clicks: item.clicks,
      orders: item.orders,
      returnRate,
      ctr,
      cvr,
      aov,
      topReasons: [...item.reasons.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason, value]) => ({ reason, value })),
    };
  });
}
