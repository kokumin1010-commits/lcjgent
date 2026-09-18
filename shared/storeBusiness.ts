export const STORE_DAILY_REPORT_STATUSES = [
  "draft",
  "submitted",
  "confirmed",
  "reopened",
] as const;

export type StoreDailyReportStatus =
  (typeof STORE_DAILY_REPORT_STATUSES)[number];

export type MetricStatus = "actual" | "manual" | "adjusted" | "missing";

/**
 * Daily-report free-text fields are stored inside MySQL JSON columns. Keep one
 * shared safety ceiling so the browser and tRPC validation never disagree.
 */
export const STORE_DAILY_REPORT_LONG_TEXT_LIMIT = 100_000;
export const STORE_DAILY_REPORT_LIST_ITEM_LIMIT = 1_000;

export type MetricMeta = {
  status: MetricStatus;
  source: string;
  sourceLabel: string;
  sourceUpdatedAt: string | null;
  originalValue: number | null;
  adjustmentReason: string;
};

export type StoreDailyCoreData = {
  totalGmv: number | null;
  actualSales: number | null;
  refundAmount: number | null;
  adSpend: number | null;
  creatorOutreach: number | null;
  creatorContactCount: number | null;
  creatorReplies: number | null;
  creatorCollaborations: number | null;
};

export type BusinessAttributedSalesEntry = {
  attributionId: number;
  staffId: number;
  staffName: string;
  amount: number;
  currency: string;
  entryType: "credit" | "reversal";
  sourceType: string;
  sourceId: string;
  reliability: string;
};

export type BusinessAttributedSalesSummary = {
  entries: BusinessAttributedSalesEntry[];
  totalsByCurrency: Array<{ currency: string; amount: number; entryCount: number }>;
  confirmedCount: number;
  unattributedContractCount: number;
  attributionRule: string;
  totalGmvAllocated: false;
  livestreamGmvAllocated: false;
  readOnly: true;
};

export type StoreDailyReportPayload = {
  cutoffTime: string;
  core: StoreDailyCoreData;
  metricMeta: Partial<Record<keyof StoreDailyCoreData, MetricMeta>>;
  businessAttributedSales: BusinessAttributedSalesSummary;
  content: {
    liveSessions: number;
    liveMinutes: number;
    liveGmv: number;
    shortVideos: number;
    shortVideoGmv: number;
  };
  products: {
    linkOptimizations: number;
    newLinks: number;
    links: Array<{ name: string; url: string; readyToSell: boolean }>;
    inventoryChanges: number;
    priceChanges: Array<{ sku: string; reason: string }>;
    negativeReviews: number;
    negativeReviewHandled: boolean;
    customerQuestions: string;
  };
  supply: {
    replenishments: Array<{
      sku: string;
      quantity: number;
      ownerStaffId: number | null;
      ownerName: string;
    }>;
    riskSkus: Array<{
      sku: string;
      reason: string;
      ownerStaffId: number | null;
      ownerName: string;
    }>;
    samplesReceived: number;
    samplesSent: number;
  };
  execution: {
    completedItems: string[];
    issuesRisks: string;
    actionsTaken: string;
    tomorrowItems: Array<{
      title: string;
      ownerStaffId: number | null;
      ownerName: string;
      dueDate: string | null;
      priority: "low" | "medium" | "high" | "critical";
    }>;
    supportItems: Array<{
      title: string;
      ownerStaffId: number | null;
      ownerName: string;
      dueDate: string | null;
      priority: "low" | "medium" | "high" | "critical";
    }>;
  };
};

export type StoreDailyOwnerItem =
  StoreDailyReportPayload["execution"]["tomorrowItems"][number];

export function parseStoreDailyOwnerItemsText(
  value: string
): StoreDailyOwnerItem[] {
  return value
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [title = "", ownerName = "", dueDate = "", priority = "medium"] =
        line.split("|").map(item => item.trim());
      return {
        title,
        ownerStaffId: null,
        ownerName,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
        priority: (["low", "medium", "high", "critical"] as const).includes(
          priority as StoreDailyOwnerItem["priority"]
        )
          ? (priority as StoreDailyOwnerItem["priority"])
          : "medium",
      };
    });
}

export function formatStoreDailyOwnerItemsText(items: StoreDailyOwnerItem[]) {
  return items
    .map(item => {
      const fields = [item.title, item.ownerName, item.dueDate || ""];
      if (item.priority !== "medium") fields.push(item.priority);
      while (fields.length > 1 && !fields.at(-1)) fields.pop();
      return fields.join("|");
    })
    .join("\n");
}

export const REQUIRED_STORE_DAILY_CORE_FIELDS: Array<keyof StoreDailyCoreData> =
  [
    "totalGmv",
    "actualSales",
    "refundAmount",
    "adSpend",
    "creatorOutreach",
    "creatorContactCount",
    "creatorReplies",
    "creatorCollaborations",
  ];

export function calculateActualSales(
  totalGmv: number | null,
  refundAmount: number | null
) {
  if (totalGmv === null || refundAmount === null) return null;
  return Math.max(0, totalGmv - refundAmount);
}

export function createEmptyStoreDailyReportPayload(): StoreDailyReportPayload {
  return {
    cutoffTime: "18:00",
    core: {
      totalGmv: null,
      actualSales: null,
      refundAmount: null,
      adSpend: null,
      creatorOutreach: null,
      creatorContactCount: null,
      creatorReplies: null,
      creatorCollaborations: null,
    },
    metricMeta: {},
    businessAttributedSales: {
      entries: [],
      totalsByCurrency: [],
      confirmedCount: 0,
      unattributedContractCount: 0,
      attributionRule: "仅统计管理员确认且具备员工、金额、业务日期与证据的销售；不分摊店铺或直播GMV。",
      totalGmvAllocated: false,
      livestreamGmvAllocated: false,
      readOnly: true,
    },
    content: {
      liveSessions: 0,
      liveMinutes: 0,
      liveGmv: 0,
      shortVideos: 0,
      shortVideoGmv: 0,
    },
    products: {
      linkOptimizations: 0,
      newLinks: 0,
      links: [],
      inventoryChanges: 0,
      priceChanges: [],
      negativeReviews: 0,
      negativeReviewHandled: true,
      customerQuestions: "",
    },
    supply: {
      replenishments: [],
      riskSkus: [],
      samplesReceived: 0,
      samplesSent: 0,
    },
    execution: {
      completedItems: [],
      issuesRisks: "",
      actionsTaken: "",
      tomorrowItems: [],
      supportItems: [],
    },
  };
}

export function missingStoreDailyCoreFields(payload: StoreDailyReportPayload) {
  return REQUIRED_STORE_DAILY_CORE_FIELDS.filter(field => {
    const value = payload.core[field];
    return (
      value === null ||
      value === undefined ||
      !Number.isFinite(value) ||
      value < 0
    );
  });
}

export function normalizeStoreDailyReportPayload(
  input: Partial<StoreDailyReportPayload> | null | undefined
): StoreDailyReportPayload {
  const empty = createEmptyStoreDailyReportPayload();
  const core = { ...empty.core, ...(input?.core || {}) };
  if (
    core.actualSales === null &&
    core.totalGmv !== null &&
    core.refundAmount !== null
  ) {
    core.actualSales = calculateActualSales(core.totalGmv, core.refundAmount);
  }
  return {
    ...empty,
    ...(input || {}),
    cutoffTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(input?.cutoffTime || "")
      ? String(input?.cutoffTime)
      : empty.cutoffTime,
    core,
    metricMeta: { ...empty.metricMeta, ...(input?.metricMeta || {}) },
    businessAttributedSales: {
      ...empty.businessAttributedSales,
      ...(input?.businessAttributedSales || {}),
      entries: Array.isArray(input?.businessAttributedSales?.entries)
        ? input.businessAttributedSales.entries
        : empty.businessAttributedSales.entries,
      totalsByCurrency: Array.isArray(input?.businessAttributedSales?.totalsByCurrency)
        ? input.businessAttributedSales.totalsByCurrency
        : empty.businessAttributedSales.totalsByCurrency,
      totalGmvAllocated: false,
      livestreamGmvAllocated: false,
      readOnly: true,
    },
    content: { ...empty.content, ...(input?.content || {}) },
    products: { ...empty.products, ...(input?.products || {}) },
    supply: { ...empty.supply, ...(input?.supply || {}) },
    execution: { ...empty.execution, ...(input?.execution || {}) },
  };
}

function comparable(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value);
}

export function diffStoreDailyReportPayload(
  before: StoreDailyReportPayload | null,
  after: StoreDailyReportPayload
) {
  const changes: Array<{ fieldPath: string; before: unknown; after: unknown }> =
    [];
  const visit = (previous: unknown, next: unknown, path: string) => {
    const previousObject =
      previous !== null &&
      typeof previous === "object" &&
      !Array.isArray(previous);
    const nextObject =
      next !== null && typeof next === "object" && !Array.isArray(next);
    if (previousObject && nextObject) {
      const keys = new Set([
        ...Object.keys(previous as Record<string, unknown>),
        ...Object.keys(next as Record<string, unknown>),
      ]);
      for (const key of keys) {
        visit(
          (previous as Record<string, unknown>)[key],
          (next as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key
        );
      }
      return;
    }
    if (comparable(previous) !== comparable(next)) {
      changes.push({
        fieldPath: path,
        before: previous ?? null,
        after: next ?? null,
      });
    }
  };
  visit(before, after, "");
  return changes.filter(change => change.fieldPath);
}

export function monthDateRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must use YYYY-MM");
  const [year, monthNumber] = month.split("-").map(Number);
  const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(endDay).padStart(2, "0")}`,
  };
}
