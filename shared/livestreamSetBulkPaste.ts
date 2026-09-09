export type LivestreamSetBulkPasteItem = {
  productName: string;
  originalPrice: string;
  quantity: string;
};

export type LivestreamSetBulkPasteResult = {
  items: LivestreamSetBulkPasteItem[];
  ignoredLineCount: number;
  sourceLineCount: number;
};

const HEADER_NAME = /^(商品名|商品名称|商品名稱|product\s*name|name)$/iu;
const HEADER_QTY = /^(数量|數量|個数|qty|quantity)$/iu;
const HEADER_PRICE = /^(価格|单价|單價|原价|原價|元値|price|original\s*price)$/iu;

function normalizeIntegerToken(value: string, fallback: number, minimum: number): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/[¥￥円\s,_，]/gu, "")
    .replace(/[^0-9.-]/gu, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return String(fallback);
  return String(Math.max(minimum, Math.trunc(parsed)));
}

function isHeader(parts: string[]): boolean {
  if (parts.length < 2) return false;
  return HEADER_NAME.test(parts[0] || "")
    && parts.some(part => HEADER_QTY.test(part) || HEADER_PRICE.test(part));
}

function splitColumns(line: string): string[] {
  const normalized = line.normalize("NFKC").trim();
  if (!normalized) return [];
  if (normalized.includes("\t")) {
    return normalized.split(/\t+/u).map(value => value.trim()).filter(Boolean);
  }
  if (/\s{2,}/u.test(normalized)) {
    return normalized.split(/\s{2,}/u).map(value => value.trim()).filter(Boolean);
  }
  if (normalized.includes(",")) {
    const commaParts = normalized.split(/,+/u).map(value => value.trim()).filter(Boolean);
    if (commaParts.length >= 4) {
      return [commaParts[0] || "", commaParts[1] || "", commaParts.slice(2).join("")];
    }
    return commaParts;
  }
  return [normalized];
}

export function parseLivestreamSetBulkPaste(text: string): LivestreamSetBulkPasteResult {
  const lines = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  const items: LivestreamSetBulkPasteItem[] = [];
  let ignoredLineCount = 0;

  for (const line of lines) {
    const parts = splitColumns(line);
    if (parts.length === 0 || isHeader(parts)) continue;

    const productName = (parts[0] || "").trim();
    if (!productName) {
      ignoredLineCount += 1;
      continue;
    }

    if (parts.length >= 3) {
      items.push({
        productName,
        quantity: normalizeIntegerToken(parts[1] || "", 1, 1),
        originalPrice: normalizeIntegerToken(parts[2] || "", 0, 0),
      });
      continue;
    }

    if (parts.length === 2) {
      const secondNumber = Number((parts[1] || "").normalize("NFKC").replace(/[¥￥円\s,_，]/gu, ""));
      if (Number.isFinite(secondNumber) && secondNumber > 100) {
        items.push({
          productName,
          quantity: "1",
          originalPrice: normalizeIntegerToken(parts[1] || "", 0, 0),
        });
      } else {
        items.push({
          productName,
          quantity: normalizeIntegerToken(parts[1] || "", 1, 1),
          originalPrice: "0",
        });
      }
      continue;
    }

    items.push({ productName, quantity: "1", originalPrice: "0" });
  }

  return { items, ignoredLineCount, sourceLineCount: lines.length };
}

export function mergeLivestreamSetBulkPasteItems(
  currentItems: LivestreamSetBulkPasteItem[],
  pastedItems: LivestreamSetBulkPasteItem[],
): LivestreamSetBulkPasteItem[] {
  const hasOnlyEmptyDefault = currentItems.length === 1
    && !currentItems[0]?.productName.trim()
    && !currentItems[0]?.originalPrice.trim();
  return hasOnlyEmptyDefault ? pastedItems : [...currentItems, ...pastedItems];
}
