export const LIVESTREAM_DEBRIEF_PAGE_KEY = "/master/livers-dashboard";
export const LIVESTREAM_DEBRIEF_ROUTE = "/master/livers-dashboard/reviews";

export const GOOD_POINT_SUGGESTIONS = [
  "话术清晰",
  "产品组合有效",
  "优惠机制有效",
  "现场配合顺畅",
  "节奏控制稳定",
  "主推商品选择准确",
] as const;

export const PROBLEM_SUGGESTIONS = [
  "商品卖点不清楚",
  "价格优势不足",
  "库存或链接异常",
  "主播不熟悉产品",
  "流量不足",
  "中控配合问题",
  "场控节奏问题",
  "素材不足",
  "优惠力度不足",
  "品牌配合不足",
] as const;

export type LivestreamDebriefBrand = {
  brandId: number | null;
  brandName: string;
  salesAmount: number | null;
  orderCount: number | null;
  mainProducts: string;
  performance: string;
};

export type LivestreamDebriefAssistance = {
  issue: string;
  owner: string;
  dueDate: string;
};

export type LivestreamDebriefContent = {
  version: 1;
  brands: LivestreamDebriefBrand[];
  goodPoints: string[];
  problems: string[];
  salesDrivers: string[];
  salesBarriers: string[];
  reusableLessons: string[];
  nextActions: string[];
  assistance: LivestreamDebriefAssistance;
};

export type LivestreamDebriefMetrics = {
  livestreamId: number;
  livestreamDate: string;
  livestreamEndTime: string | null;
  streamerName: string;
  durationMinutes: number | null;
  salesAmount: number;
  orderCount: number | null;
};

export type LivestreamDebriefDocument = {
  version: 1;
  metrics: LivestreamDebriefMetrics;
  content: LivestreamDebriefContent;
};

const compact = (values: string[], max = 3) =>
  values.map(value => value.trim()).filter(Boolean).slice(0, max);

export function normalizeLivestreamDebriefContent(
  input: LivestreamDebriefContent,
): LivestreamDebriefContent {
  return {
    version: 1,
    brands: input.brands.slice(0, 20).map(brand => ({
      brandId: brand.brandId == null ? null : Number(brand.brandId),
      brandName: brand.brandName.trim().slice(0, 255),
      salesAmount: brand.salesAmount == null ? null : Math.max(0, Math.round(Number(brand.salesAmount))),
      orderCount: brand.orderCount == null ? null : Math.max(0, Math.round(Number(brand.orderCount))),
      mainProducts: brand.mainProducts.trim().slice(0, 500),
      performance: brand.performance.trim().slice(0, 500),
    })),
    goodPoints: compact(input.goodPoints),
    problems: compact(input.problems),
    salesDrivers: compact(input.salesDrivers),
    salesBarriers: compact(input.salesBarriers),
    reusableLessons: compact(input.reusableLessons),
    nextActions: compact(input.nextActions),
    assistance: {
      issue: input.assistance.issue.trim().slice(0, 500),
      owner: input.assistance.owner.trim().slice(0, 120),
      dueDate: input.assistance.dueDate.trim().slice(0, 10),
    },
  };
}

function formatYen(value: number | null) {
  return value == null ? "未填写" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatCount(value: number | null) {
  return value == null ? "未填写" : `${Math.round(value).toLocaleString("ja-JP")}单`;
}

function formatJstDateTime(value: string | null) {
  if (!value) return "未填写";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未填写";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function numbered(values: string[]) {
  return values.length ? values.map((value, index) => `${index + 1}. ${value}`).join("\n") : "无";
}

export function buildLivestreamDebriefText(input: {
  metrics: LivestreamDebriefMetrics;
  content: LivestreamDebriefContent;
  recordedByName: string;
  recordedAt: string;
}) {
  const { metrics, content } = input;
  const start = formatJstDateTime(metrics.livestreamDate);
  const end = formatJstDateTime(metrics.livestreamEndTime);
  const date = start === "未填写" ? start : start.slice(0, 10);
  const duration = metrics.durationMinutes == null
    ? "未填写"
    : `${Math.floor(metrics.durationMinutes / 60)}小时${metrics.durationMinutes % 60}分`;
  const brands = content.brands.length
    ? content.brands.map((brand, index) => [
        `${index + 1}. 品牌：${brand.brandName || "未填写"}`,
        `   销售额：${formatYen(brand.salesAmount)}`,
        `   订单数：${formatCount(brand.orderCount)}`,
        `   主推产品：${brand.mainProducts || "未填写"}`,
        `   表现情况：${brand.performance || "未填写"}`,
      ].join("\n")).join("\n")
    : "无品牌信息";

  return [
    "【今日达播复盘】",
    `日期：${date}`,
    `达人/主播：${metrics.streamerName}`,
    `直播时间：${start} ～ ${end}`,
    `直播总时长：${duration}`,
    `今日总销售额：${formatYen(metrics.salesAmount)}`,
    `今日总订单数：${formatCount(metrics.orderCount)}`,
    "",
    "一、各品牌销售情况",
    brands,
    "",
    "二、今天做得比较好的地方",
    numbered(content.goodPoints),
    "",
    "三、今天现场存在的问题",
    numbered(content.problems),
    "",
    "四、促进销售额的因素",
    numbered(content.salesDrivers),
    "",
    "五、影响销售额的因素",
    numbered(content.salesBarriers),
    "",
    "六、值得学习和复制的地方",
    numbered(content.reusableLessons),
    "",
    "七、下一场具体改善方案",
    numbered(content.nextActions),
    "",
    "八、需要其他部门协助解决的问题",
    content.assistance.issue || "无",
    `负责人：${content.assistance.owner || "未指定"}`,
    `需要完成时间：${content.assistance.dueDate || "未指定"}`,
    "",
    `复盘录入：${input.recordedByName}`,
    `录入时间：${formatJstDateTime(input.recordedAt)}`,
  ].join("\n");
}
