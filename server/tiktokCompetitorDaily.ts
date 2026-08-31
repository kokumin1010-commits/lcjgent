export type RawRankingRow = Record<string, unknown>;

export type ParsedProduct = {
  externalProductId: string | null;
  productName: string | null;
  productUrl: string | null;
  productRank: number | null;
  originalPrice: number | null;
  livePrice: number | null;
  unitsSold: number | null;
  gmv: number | null;
  clickRate: number | null;
  conversionRate: number | null;
  heatEvidence: string | null;
  raw: RawRankingRow;
};

export type ParsedShop = {
  externalShopId: string | null;
  shopName: string;
  shopUrl: string | null;
  rankingPosition: number;
  unitsSold: number | null;
  gmv: number | null;
  revenueGrowthRate: number | null;
  products: ParsedProduct[];
  raw: RawRankingRow;
};

export type ParsedImportRow = {
  sheetName: string | null;
  sourceShopRank: string | null;
  shopRank: number | null;
  externalShopId: string | null;
  shopName: string;
  shopUrl: string | null;
  productRank: number | null;
  externalProductId: string | null;
  productName: string | null;
  productUrl: string | null;
  originalPrice: number | null;
  livePrice: number | null;
  unitsSold: number | null;
  gmv: number | null;
  heatEvidence: string | null;
};

export type ImportParseResult = {
  shops: ParsedShop[];
  top5: ParsedShop[];
  rows: ParsedImportRow[];
  excludedRows: number;
  recognizedRows: number;
  warnings: string[];
};

export function canImportCompetitorRanking(isAdmin:boolean,actorStaffId:number|null,morningOperatorIds:number[]){
  return isAdmin || (actorStaffId !== null && morningOperatorIds.includes(actorStaffId));
}

export function canAccessCompetitorReport(isAdmin:boolean,actorStaffId:number|null,assignedStaffId:number){
  return isAdmin || (actorStaffId !== null && actorStaffId === assignedStaffId);
}

const ALIASES = {
  shopName: ['店铺名称','店铺名','店铺','商店名称','ショップ名','ショップ','Shop Name','shop_name','shopName','seller_name','Seller'],
  shopId: ['店铺ID','店铺 Id','ショップID','Shop ID','shop_id','shopId','seller_id'],
  shopUrl: ['店铺链接','店铺URL','ショップURL','Shop URL','shop_url','shopUrl'],
  shopRank: ['店铺排名','排名','順位','ショップ順位','Shop Rank','shop_rank','ranking','Rank'],
  productName: ['商品名称','商品名','商品','製品名','Product Name','product_name','productName','title'],
  productId: ['商品ID','商品 Id','製品ID','Product ID','product_id','productId'],
  productUrl: ['商品链接','商品URL','製品URL','Product URL','product_url','productUrl'],
  productRank: ['商品排名','店内排名','商品順位','Product Rank','product_rank'],
  unitsSold: ['销量','销售量','已售数量','售出件数','販売数','販売数量','Item Sold','item_sold','units_sold','Sales Volume'],
  gmv: ['销售额','成交额','GMV','売上','売上高','Revenue','revenue','gmv'],
  growth: ['销售额增长率','收入增长率','GMV增长率','売上成長率','Revenue Growth Rate','growth_rate'],
  originalPrice: ['原价','原價格','通常価格','定価','Original Price','original_price','list_price'],
  livePrice: ['直播价','直播成交价','成交价格','成交价','ライブ価格','実売価格','Live Price','sale_price','live_price','Avg. Unit Price'],
  clickRate: ['点击率','商品点击率','點擊率','クリック率','Click Rate','click_rate','CTR'],
  conversionRate: ['转化率','成交转化率','轉換率','コンバージョン率','Conversion Rate','conversion_rate','CTOR（SKU 订单）'],
  heat: ['销量/热度','热度表现','熱度','Heat Evidence','heat_evidence','备注','備考'],
} as const;

function normalizedKey(value: string) {
  return value.normalize('NFKC').replace(/[\s_\-()（）/%]/g, '').toLowerCase();
}

function pick(row: RawRankingRow, aliases: readonly string[]): unknown {
  const byKey = new Map(Object.entries(row).map(([key, value]) => [normalizedKey(key), value]));
  for (const alias of aliases) {
    const value = byKey.get(normalizedKey(alias));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
}

function text(value: unknown): string | null {
  const result = String(value ?? '').trim();
  return result ? result.slice(0, 1500) : null;
}

function httpUrl(value: unknown): string | null {
  const result=text(value);
  if(!result)return null;
  try{
    const parsed=new URL(result);
    return parsed.protocol==='https:'||parsed.protocol==='http:'?result:null;
  }catch{return null;}
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-' || raw === '--') return null;
  const multiplier = /亿|億/.test(raw) ? 100_000_000 : /万|萬/.test(raw) ? 10_000 : /[kK]/.test(raw) ? 1_000 : 1;
  const cleaned = raw.replace(/[^0-9.+-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed * multiplier : null;
}

function rateValue(value: unknown): number | null {
  const numeric = numberValue(value);
  if (numeric === null) return null;
  const raw = String(value ?? '');
  if (raw.includes('%') || Math.abs(numeric) > 1) return numeric / 100;
  return numeric;
}

function firstDefined(left: number | null, right: number | null) {
  return left ?? right;
}

function exactExternalId(value: unknown, url: string | null): string | null {
  if (url) {
    try {
      const id = new URL(url).searchParams.get('id')?.trim();
      if (id) return id.slice(0, 255);
    } catch {
      // URL validity is handled separately; retain the explicit ID when available.
    }
  }
  return text(value)?.slice(0, 255) ?? null;
}

export function calculateDiscountRate(originalPrice: number | null, livePrice: number | null): number | null {
  if (originalPrice === null || livePrice === null || originalPrice <= 0 || livePrice < 0) return null;
  return Math.max(0, Math.min(1, (originalPrice - livePrice) / originalPrice));
}

export function parseKalodataRows(rows: RawRankingRow[]): ImportParseResult {
  const shopMap = new Map<string, Omit<ParsedShop, 'rankingPosition'>>();
  const parsedRows: ParsedImportRow[] = [];
  let excludedRows = 0;
  let recognizedRows = 0;

  for (const row of rows) {
    const shopName = text(pick(row, ALIASES.shopName));
    if (!shopName) {
      excludedRows += 1;
      continue;
    }

    const sourceShopRank = text(pick(row, ALIASES.shopRank));
    const explicitRank = numberValue(pick(row, ALIASES.shopRank));
    const shopUrl = httpUrl(pick(row, ALIASES.shopUrl));
    const externalShopId = exactExternalId(pick(row, ALIASES.shopId), shopUrl);
    const productUrl = httpUrl(pick(row, ALIASES.productUrl));
    const externalProductId = exactExternalId(pick(row, ALIASES.productId), productUrl);
    const productName = text(pick(row, ALIASES.productName));
    const productRank = numberValue(pick(row, ALIASES.productRank));
    const originalPrice = numberValue(pick(row, ALIASES.originalPrice));
    const livePrice = numberValue(pick(row, ALIASES.livePrice));
    const unitsSold = numberValue(pick(row, ALIASES.unitsSold));
    const gmv = numberValue(pick(row, ALIASES.gmv));
    const heatEvidence = text(pick(row, ALIASES.heat));

    recognizedRows += 1;
    parsedRows.push({
      sheetName: text(row.__sheetName), sourceShopRank, shopRank: explicitRank,
      externalShopId, shopName, shopUrl, productRank, externalProductId,
      productName, productUrl, originalPrice, livePrice, unitsSold, gmv, heatEvidence,
    });

    const key = normalizedKey(shopName);
    const existing = shopMap.get(key);
    const shop: Omit<ParsedShop, 'rankingPosition'> = existing || {
      externalShopId,
      shopName,
      shopUrl,
      unitsSold,
      gmv,
      revenueGrowthRate: rateValue(pick(row, ALIASES.growth)),
      products: [],
      raw: { ...row, __explicitShopRank: explicitRank },
    };
    if (existing) {
      shop.externalShopId ||= externalShopId;
      shop.shopUrl ||= shopUrl;
      shop.unitsSold = Math.max(shop.unitsSold ?? -Infinity, unitsSold ?? -Infinity);
      if (shop.unitsSold === -Infinity) shop.unitsSold = null;
      shop.gmv = Math.max(shop.gmv ?? -Infinity, gmv ?? -Infinity);
      if (shop.gmv === -Infinity) shop.gmv = null;
      const priorRank = numberValue(shop.raw.__explicitShopRank);
      shop.raw.__explicitShopRank = priorRank === null ? explicitRank : explicitRank === null ? priorRank : Math.min(priorRank, explicitRank);
    }

    if (productName) {
      shop.products.push({
        externalProductId, productName, productUrl, productRank,
        originalPrice, livePrice, unitsSold, gmv,
        clickRate: rateValue(pick(row, ALIASES.clickRate)),
        conversionRate: rateValue(pick(row, ALIASES.conversionRate)),
        heatEvidence,
        raw: row,
      });
    }
    shopMap.set(key, shop);
  }

  const shops = Array.from(shopMap.values())
    .sort((a, b) => {
      const rankA = numberValue(a.raw.__explicitShopRank);
      const rankB = numberValue(b.raw.__explicitShopRank);
      if (rankA !== null || rankB !== null) return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
      if ((b.unitsSold ?? -1) !== (a.unitsSold ?? -1)) return (b.unitsSold ?? -1) - (a.unitsSold ?? -1);
      return (b.gmv ?? -1) - (a.gmv ?? -1);
    })
    .map((shop, index) => ({
      ...shop,
      rankingPosition: index + 1,
      products: shop.products
        .sort((a, b) => {
          if (a.productRank !== null || b.productRank !== null) return (a.productRank ?? Number.MAX_SAFE_INTEGER) - (b.productRank ?? Number.MAX_SAFE_INTEGER);
          if ((b.unitsSold ?? -1) !== (a.unitsSold ?? -1)) return (b.unitsSold ?? -1) - (a.unitsSold ?? -1);
          return (b.gmv ?? -1) - (a.gmv ?? -1);
        })
        .slice(0, 3),
    }));

  const top5 = shops.slice(0, 5);
  const warnings: string[] = [];
  if (top5.length < 5) warnings.push(`仅识别到${top5.length}家店铺，提交日报前需要补足5家`);
  for (const shop of top5) if (shop.products.length < 3) warnings.push(`${shop.shopName}仅识别到${shop.products.length}个商品，需要补足3个`);
  if (excludedRows) warnings.push(`${excludedRows}行因缺少店铺名称未导入`);
  return { shops, top5, rows: parsedRows, excludedRows, recognizedRows, warnings };
}

export type ReportProductForSummary = {
  productName?: string | null;
  originalPrice?: number | null;
  livePrice?: number | null;
  unitsSold?: number | null;
  gmv?: number | null;
  clickRate?: number | null;
  conversionRate?: number | null;
  heatEvidence?: string | null;
  productUrl?: string | null;
  screenshotUrls?: string[];
  shopName?: string;
  previous?: {
    reportDate?: string;
    livePrice?: number | null;
    unitsSold?: number | null;
    gmv?: number | null;
    clickRate?: number | null;
    conversionRate?: number | null;
  } | null;
};

export function validateReportForSubmission(shops: Array<{ isPrimary?: boolean; products: ReportProductForSummary[] }>) {
  const primaryShops = shops.filter((shop) => shop.isPrimary !== false);
  const errors: string[] = [];
  if (primaryShops.length !== 5) errors.push(`主竞争店铺必须为5家，当前${primaryShops.length}家`);
  for (const [shopIndex, shop] of primaryShops.entries()) {
    if (shop.products.length !== 3) errors.push(`第${shopIndex + 1}家店铺必须有3个主商品`);
    for (const [productIndex, product] of shop.products.entries()) {
      const label = `第${shopIndex + 1}家第${productIndex + 1}个商品`;
      if (!product.productName?.trim()) errors.push(`${label}缺少商品名称`);
      if (product.livePrice === null || product.livePrice === undefined) errors.push(`${label}缺少直播成交价`);
      if ((product.unitsSold === null || product.unitsSold === undefined) && !product.heatEvidence?.trim()) errors.push(`${label}缺少销量或热度表现`);
      if (!product.productUrl?.trim()) errors.push(`${label}缺少商品链接`);
      if (!product.screenshotUrls?.length) errors.push(`${label}缺少价格截图`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function buildDeterministicSummary(products: ReportProductForSummary[]) {
  const completeProducts = products.filter((product) => product.productName?.trim());
  const prices = completeProducts.map((product) => product.livePrice).filter((value): value is number => value !== null && value !== undefined);
  const discounts = completeProducts
    .map((product) => calculateDiscountRate(product.originalPrice ?? null, product.livePrice ?? null))
    .filter((value): value is number => value !== null);
  const topByUnits = completeProducts.filter((product) => product.unitsSold !== null && product.unitsSold !== undefined).sort((a, b) => Number(b.unitsSold) - Number(a.unitsSold))[0] || null;
  const topByGmv = completeProducts.filter((product) => product.gmv !== null && product.gmv !== undefined).sort((a, b) => Number(b.gmv) - Number(a.gmv))[0] || null;
  const topByCtr = completeProducts.filter((product) => product.clickRate !== null && product.clickRate !== undefined).sort((a, b) => Number(b.clickRate) - Number(a.clickRate))[0] || null;
  const topByConversion = completeProducts.filter((product) => product.conversionRate !== null && product.conversionRate !== undefined).sort((a, b) => Number(b.conversionRate) - Number(a.conversionRate))[0] || null;
  const missingCtr = completeProducts.filter((product) => product.clickRate === null || product.clickRate === undefined).length;
  const missingGmv = completeProducts.filter((product) => product.gmv === null || product.gmv === undefined).length;
  const clickRates = completeProducts.map((product) => product.clickRate).filter((value): value is number => value !== null && value !== undefined);
  const conversionRates = completeProducts.map((product) => product.conversionRate).filter((value): value is number => value !== null && value !== undefined);
  const comparedProducts = completeProducts.filter((product) => product.previous?.livePrice !== null && product.previous?.livePrice !== undefined && product.livePrice !== null && product.livePrice !== undefined);
  const priceDrops = comparedProducts.filter((product) => Number(product.livePrice) < Number(product.previous?.livePrice));
  const priceIncreases = comparedProducts.filter((product) => Number(product.livePrice) > Number(product.previous?.livePrice));
  const opportunities: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];
  if (topByUnits?.productName) opportunities.push(`销量最高为${topByUnits.shopName || '未标注店铺'}的「${topByUnits.productName}」，应复盘其价格与直播主推方式。`);
  if (topByCtr?.productName) opportunities.push(`点击率最高为「${topByCtr.productName}」${topByCtr.clickRate === null || topByCtr.clickRate === undefined ? '' : `（${(Number(topByCtr.clickRate) * 100).toFixed(2)}%）`}，可作为选品和素材参考。`);
  if (priceDrops.length) actions.push(`优先复查${priceDrops.length}个降价商品，判断是否需要跟价、差异化赠品或调整直播话术。`);
  if (topByConversion?.productName) actions.push(`拆解转化率最高商品「${topByConversion.productName}」的价格、卖点和直播节奏。`);
  if (missingCtr) risks.push(`${missingCtr}个商品缺少点击率，无法完整判断流量效率。`);
  if (missingGmv) risks.push(`${missingGmv}个商品缺少销售额，销售机会排序可信度受限。`);
  if (!comparedProducts.length) risks.push('没有可匹配的上一期同商品价格，暂时无法判断价格变化。');
  if (!actions.length) actions.push('下一班次继续检查价格、直播主推频率与购买提示，并补齐缺失指标。');
  const headlineParts = [`已完成${completeProducts.length}/15品`];
  if (topByUnits?.productName) headlineParts.push(`销量冠军「${topByUnits.productName}」`);
  if (priceDrops.length || priceIncreases.length) headlineParts.push(`降价${priceDrops.length}品、涨价${priceIncreases.length}品`);
  return {
    productCount: completeProducts.length,
    completionRate: completeProducts.length / 15,
    averageLivePrice: prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null,
    averageDiscountRate: discounts.length ? discounts.reduce((sum, value) => sum + value, 0) / discounts.length : null,
    topByUnits,
    topByGmv,
    topByCtr,
    topByConversion,
    averageClickRate: clickRates.length ? clickRates.reduce((sum, value) => sum + value, 0) / clickRates.length : null,
    averageConversionRate: conversionRates.length ? conversionRates.reduce((sum, value) => sum + value, 0) / conversionRates.length : null,
    priceChanges: {
      compared: comparedProducts.length,
      decreases: priceDrops.length,
      increases: priceIncreases.length,
      unchanged: comparedProducts.length - priceDrops.length - priceIncreases.length,
      decreasesDetail: priceDrops.map((product) => ({ shopName:product.shopName,productName:product.productName,previousPrice:product.previous?.livePrice,currentPrice:product.livePrice })),
    },
    missingMetrics: { clickRate: missingCtr, gmv: missingGmv },
    headline: headlineParts.join('；'),
    opportunities,
    risks,
    actions,
    generatedAt: new Date().toISOString(),
    methodology: 'deterministic-v2',
  };
}
