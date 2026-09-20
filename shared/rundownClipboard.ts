import {
  parseRundownDiscountRate,
  resolveRundownLiveDiscountRate,
  type RundownProductAttribute,
} from "./rundown";

export const RUNDOWN_CLIPBOARD_COLUMN_KEYS = [
  "productName",
  "timeSlot",
  "section",
  "imageUrl",
  "productLink",
  "brandName",
  "productAttribute",
  "theme",
  "productNameCn",
  "deliveryTime",
  "selfSiteLink",
  "listPrice",
  "livePrice",
  "liveDiscountRate",
  "costPrice",
  "commissionRate",
  "bundlePrice",
  "shopAndFormat",
  "estimatedGmv",
  "playStrategy",
  "recommendReason",
  "notes",
  "purchasePrice",
] as const;

export type RundownClipboardColumnKey = (typeof RUNDOWN_CLIPBOARD_COLUMN_KEYS)[number];
export type RundownClipboardSelection =
  | { type: "row"; rowIndex: number }
  | { type: "column"; columnKey: RundownClipboardColumnKey };

export type RundownClipboardItem = {
  id: number;
  [key: string]: unknown;
};

export type RundownClipboardChanges = {
  productName?: string | null;
  timeSlot?: string | null;
  section?: string | null;
  imageUrl?: string | null;
  productLink?: string | null;
  brandName?: string | null;
  productAttribute?: RundownProductAttribute | null;
  theme?: string | null;
  productNameCn?: string | null;
  deliveryTime?: string | null;
  selfSiteLink?: string | null;
  listPrice?: number | null;
  livePrice?: number | null;
  liveDiscountRate?: number | null;
  costPrice?: number | null;
  commissionRate?: number | null;
  bundlePrice?: string | null;
  shopAndFormat?: string | null;
  estimatedGmv?: number | null;
  playStrategy?: string | null;
  recommendReason?: string | null;
  notes?: string | null;
  purchasePrice?: number | null;
};

export type RundownClipboardUpdate = {
  id: number;
  changes: RundownClipboardChanges;
};

export type RundownPastePlan = {
  updates: RundownClipboardUpdate[];
  changedCells: number;
  sourceRows: number;
  sourceColumns: number;
  targetRows: number;
  truncatedRows: number;
  trailingBlankRows: number;
};

type ColumnDefinition = {
  key: RundownClipboardColumnKey;
  label: string;
  kind: "text" | "number" | "attribute";
  maxLength?: number;
  min?: number;
  max?: number;
};

export const RUNDOWN_CLIPBOARD_COLUMNS: readonly ColumnDefinition[] = [
  { key: "productName", label: "产品名称", kind: "text", maxLength: 500 },
  { key: "timeSlot", label: "时段", kind: "text", maxLength: 50 },
  { key: "section", label: "板块", kind: "text", maxLength: 255 },
  { key: "imageUrl", label: "图片URL", kind: "text", maxLength: 20_000 },
  { key: "productLink", label: "链接", kind: "text", maxLength: 1_000 },
  { key: "brandName", label: "品牌", kind: "text", maxLength: 255 },
  { key: "productAttribute", label: "属性", kind: "attribute" },
  { key: "theme", label: "主题/痛点", kind: "text", maxLength: 500 },
  { key: "productNameCn", label: "中文名", kind: "text", maxLength: 500 },
  { key: "deliveryTime", label: "发货时间", kind: "text", maxLength: 255 },
  { key: "selfSiteLink", label: "自制网站", kind: "text", maxLength: 1_000 },
  { key: "listPrice", label: "定价", kind: "number", min: 0, max: 99_999_999_999.99 },
  { key: "livePrice", label: "直播价格", kind: "number", min: 0, max: 99_999_999_999.99 },
  { key: "liveDiscountRate", label: "直播折扣率", kind: "number", min: 0, max: 100 },
  { key: "costPrice", label: "成本价(含运费)", kind: "number", min: 0, max: 99_999_999_999.99 },
  { key: "commissionRate", label: "佣金比例", kind: "number", min: 0, max: 100 },
  { key: "bundlePrice", label: "福袋价格/历史机制", kind: "text", maxLength: 500 },
  { key: "shopAndFormat", label: "上架店铺及形式", kind: "text", maxLength: 500 },
  { key: "estimatedGmv", label: "预估GMV", kind: "number", min: 0, max: 99_999_999_999.99 },
  { key: "playStrategy", label: "节奏/玩法", kind: "text", maxLength: 20_000 },
  { key: "recommendReason", label: "建议话术", kind: "text", maxLength: 20_000 },
  { key: "notes", label: "备注", kind: "text", maxLength: 20_000 },
  { key: "purchasePrice", label: "拿货价", kind: "number", min: 0, max: 99_999_999_999.99 },
] as const;

const columnByKey = new Map(
  RUNDOWN_CLIPBOARD_COLUMNS.map((column) => [column.key, column]),
);

function escapeTsvCell(value: string): string {
  if (value === "") return '""';
  if (!/[\t\r\n"]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function valueForClipboard(item: RundownClipboardItem, key: RundownClipboardColumnKey): string {
  if (key === "liveDiscountRate") {
    const displayedRate = resolveRundownLiveDiscountRate(
      item.liveDiscountRate,
      item.listPrice,
      item.livePrice,
    );
    return displayedRate === null ? "" : String(displayedRate);
  }
  const value = item[key];
  if (value === null || value === undefined) return "";
  if (key === "productAttribute") {
    if (value === "required") return "必播品";
    if (value === "optional") return "可选品";
  }
  return String(value);
}

export function parseRundownTsv(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (normalized === "") return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (quoted) {
      if (char === '"' && normalized[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell.length === 0) {
      quoted = true;
    } else if (char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error("粘贴内容包含未闭合的引号");
  row.push(cell);
  rows.push(row);

  if (normalized.endsWith("\n") && rows.length > 1 && rows[rows.length - 1].every((value) => value === "")) {
    rows.pop();
  }
  return rows;
}

export function serializeRundownSelection(
  items: RundownClipboardItem[],
  selection: RundownClipboardSelection,
): string {
  if (selection.type === "row") {
    const item = items[selection.rowIndex];
    if (!item) throw new Error("选择的行不存在");
    return RUNDOWN_CLIPBOARD_COLUMN_KEYS.map((key) => escapeTsvCell(valueForClipboard(item, key))).join("\t");
  }
  if (!columnByKey.has(selection.columnKey)) throw new Error("选择的列不存在");
  return items
    .map((item) => escapeTsvCell(valueForClipboard(item, selection.columnKey)))
    .join("\n");
}

function parseAttribute(value: string): RundownProductAttribute | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "未设置" || normalized === "なし" || normalized === "unset") return null;
  if (["required", "必播品", "必須", "必須品"].includes(normalized)) return "required";
  if (["optional", "可选品", "可選品", "任意"].includes(normalized)) return "optional";
  throw new Error("属性只允许填写必播品或可选品");
}

function parseNumber(value: string, column: ColumnDefinition): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/[¥￥,，\s]/g, "")
    .replace(/%?\s*OFF$/i, "")
    .replace(/[％%]/g, "");
  const number = Number(cleaned);
  if (!Number.isFinite(number)) throw new Error(`${column.label}必须是数字`);
  if (column.min !== undefined && number < column.min) throw new Error(`${column.label}不能小于${column.min}`);
  if (column.max !== undefined && number > column.max) throw new Error(`${column.label}不能大于${column.max}`);
  if (column.key === "liveDiscountRate" && parseRundownDiscountRate(number) === null) {
    throw new Error("直播折扣率必须在0–100之间");
  }
  return number;
}

function parseClipboardValue(value: string, column: ColumnDefinition): string | number | null {
  if (column.kind === "number") return parseNumber(value, column);
  if (column.kind === "attribute") return parseAttribute(value);
  const normalized = value.trim();
  if (!normalized) return null;
  if (column.maxLength !== undefined && normalized.length > column.maxLength) {
    throw new Error(`${column.label}不能超过${column.maxLength}个字符`);
  }
  return normalized;
}

function comparable(value: unknown, column: ColumnDefinition): string | number | null {
  if (value === undefined || value === null || value === "") return null;
  if (column.kind === "number") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return String(value).trim() || null;
}

export function buildRundownPastePlan(input: {
  items: RundownClipboardItem[];
  selection: RundownClipboardSelection;
  text: string;
}): RundownPastePlan {
  const matrix = parseRundownTsv(input.text);
  if (matrix.length === 0) throw new Error("剪贴板没有可粘贴的内容");
  if (matrix.length > 200) throw new Error("一次最多粘贴200行");

  const pending = new Map<number, RundownClipboardUpdate>();
  let trailingBlankRows = 0;
  for (let index = matrix.length - 1; index >= 0 && matrix[index].every((value) => value === ""); index -= 1) {
    trailingBlankRows += 1;
  }
  let changedCells = 0;
  let truncatedRows = 0;
  let sourceColumns = 0;

  const applyCell = (rowIndex: number, columnKey: RundownClipboardColumnKey, rawValue: string) => {
    const item = input.items[rowIndex];
    if (!item) return;
    const column = columnByKey.get(columnKey);
    if (!column) throw new Error("目标列不存在");
    let parsed: string | number | null;
    try {
      parsed = parseClipboardValue(rawValue, column);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`第${rowIndex + 1}行「${column.label}」：${message}`);
    }
    if (comparable(item[columnKey], column) === parsed) return;
    const existing = pending.get(item.id) || { id: item.id, changes: {} };
    (existing.changes as Record<RundownClipboardColumnKey, string | number | null>)[columnKey] = parsed;
    pending.set(item.id, existing);
    changedCells += 1;
  };

  const selection = input.selection;
  if (selection.type === "row") {
    sourceColumns = Math.max(...matrix.map((row) => row.length));
    if (sourceColumns > RUNDOWN_CLIPBOARD_COLUMN_KEYS.length) {
      throw new Error(`一行最多可粘贴${RUNDOWN_CLIPBOARD_COLUMN_KEYS.length}列`);
    }
    matrix.forEach((row, rowOffset) => {
      if (!input.items[selection.rowIndex + rowOffset]) {
        truncatedRows += 1;
        return;
      }
      row.forEach((value, columnIndex) => {
        applyCell(
          selection.rowIndex + rowOffset,
          RUNDOWN_CLIPBOARD_COLUMN_KEYS[columnIndex],
          value,
        );
      });
    });
  } else {
    if (matrix.some((row) => row.length > 1)) {
      throw new Error("选择整列时，请粘贴单列数据；多列数据请先选择目标行");
    }
    sourceColumns = 1;
    matrix.forEach((row, rowIndex) => {
      if (!input.items[rowIndex]) {
        truncatedRows += 1;
        return;
      }
      applyCell(rowIndex, selection.columnKey, row[0] || "");
    });
  }

  return {
    updates: [...pending.values()],
    changedCells,
    sourceRows: matrix.length,
    sourceColumns,
    targetRows: pending.size,
    truncatedRows,
    trailingBlankRows,
  };
}
