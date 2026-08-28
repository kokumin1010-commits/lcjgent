export type SnapshotProductValue = {
  productRank: number;
  externalProductId: string | null;
  productName: string | null;
  originalPrice: number | null;
  livePrice: number | null;
  discountRate: number | null;
  unitsSold: number | null;
  gmv: number | null;
  clickRate: number | null;
  conversionRate: number | null;
};

export type SnapshotShopValue = {
  rankingPosition: number;
  externalShopId: string | null;
  shopName: string;
  unitsSold: number | null;
  gmv: number | null;
  products: SnapshotProductValue[];
};

export type SnapshotBatchValue = {
  id: number;
  snapshotDate: string;
  sourceFileName: string | null;
  importedAt: unknown;
  isCurrent: boolean;
  shops: SnapshotShopValue[];
};

function normalizedIdentity(value: unknown) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function shopKey(shop: SnapshotShopValue) {
  return shop.externalShopId?.trim()
    ? `id:${normalizedIdentity(shop.externalShopId)}`
    : `name:${normalizedIdentity(shop.shopName)}`;
}

function productKey(shopIdentity: string, product: SnapshotProductValue) {
  return product.externalProductId?.trim()
    ? `id:${normalizedIdentity(product.externalProductId)}`
    : `${shopIdentity}|name:${normalizedIdentity(product.productName)}`;
}

function delta(first: number | null | undefined, last: number | null | undefined) {
  return first === null || first === undefined || last === null || last === undefined ? null : last - first;
}

export function buildRankingBatchComparison(inputBatches: SnapshotBatchValue[]) {
  const batches = [...inputBatches].sort((a, b) => a.id - b.id);
  if (batches.length < 2 || batches.length > 4) {
    throw new Error('请选择2至4个导入批次进行对比');
  }
  const date = batches[0].snapshotDate;
  if (batches.some((batch) => batch.snapshotDate !== date)) {
    throw new Error('只能对比同一天的导入批次');
  }

  const batchIds = batches.map((batch) => String(batch.id));
  const shopRows = new Map<string, {
    key: string;
    shopName: string;
    values: Record<string, Omit<SnapshotShopValue, 'products'> | null>;
  }>();
  const productRows = new Map<string, {
    key: string;
    shopKey: string;
    shopName: string;
    productName: string | null;
    values: Record<string, SnapshotProductValue | null>;
  }>();

  for (const batch of batches) {
    const batchId = String(batch.id);
    for (const shop of batch.shops) {
      const currentShopKey = shopKey(shop);
      const existingShop = shopRows.get(currentShopKey) || {
        key: currentShopKey,
        shopName: shop.shopName,
        values: Object.fromEntries(batchIds.map((id) => [id, null])),
      };
      existingShop.shopName ||= shop.shopName;
      existingShop.values[batchId] = {
        rankingPosition: shop.rankingPosition,
        externalShopId: shop.externalShopId,
        shopName: shop.shopName,
        unitsSold: shop.unitsSold,
        gmv: shop.gmv,
      };
      shopRows.set(currentShopKey, existingShop);

      for (const product of shop.products) {
        const currentProductKey = productKey(currentShopKey, product);
        const existingProduct = productRows.get(currentProductKey) || {
          key: currentProductKey,
          shopKey: currentShopKey,
          shopName: shop.shopName,
          productName: product.productName,
          values: Object.fromEntries(batchIds.map((id) => [id, null])),
        };
        existingProduct.productName ||= product.productName;
        existingProduct.values[batchId] = product;
        productRows.set(currentProductKey, existingProduct);
      }
    }
  }

  const firstBatchId = batchIds[0];
  const lastBatchId = batchIds[batchIds.length - 1];
  const shops = Array.from(shopRows.values())
    .map((shop) => ({
      ...shop,
      changes: {
        rankingPosition: delta(shop.values[firstBatchId]?.rankingPosition, shop.values[lastBatchId]?.rankingPosition),
        unitsSold: delta(shop.values[firstBatchId]?.unitsSold, shop.values[lastBatchId]?.unitsSold),
        gmv: delta(shop.values[firstBatchId]?.gmv, shop.values[lastBatchId]?.gmv),
      },
    }))
    .sort((a, b) => {
      const aRank = a.values[lastBatchId]?.rankingPosition ?? Number.MAX_SAFE_INTEGER;
      const bRank = b.values[lastBatchId]?.rankingPosition ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.shopName.localeCompare(b.shopName);
    });
  const products = Array.from(productRows.values())
    .map((product) => ({
      ...product,
      changes: {
        productRank: delta(product.values[firstBatchId]?.productRank, product.values[lastBatchId]?.productRank),
        originalPrice: delta(product.values[firstBatchId]?.originalPrice, product.values[lastBatchId]?.originalPrice),
        livePrice: delta(product.values[firstBatchId]?.livePrice, product.values[lastBatchId]?.livePrice),
        unitsSold: delta(product.values[firstBatchId]?.unitsSold, product.values[lastBatchId]?.unitsSold),
        gmv: delta(product.values[firstBatchId]?.gmv, product.values[lastBatchId]?.gmv),
        clickRate: delta(product.values[firstBatchId]?.clickRate, product.values[lastBatchId]?.clickRate),
        conversionRate: delta(product.values[firstBatchId]?.conversionRate, product.values[lastBatchId]?.conversionRate),
      },
    }))
    .sort((a, b) => a.shopName.localeCompare(b.shopName) || (a.values[lastBatchId]?.productRank ?? 999) - (b.values[lastBatchId]?.productRank ?? 999));

  return {
    snapshotDate: date,
    batches: batches.map(({ shops: _shops, ...batch }) => batch),
    firstBatchId: Number(firstBatchId),
    lastBatchId: Number(lastBatchId),
    shops,
    products,
  };
}
