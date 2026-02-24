/**
 * Product Card Renderer
 * 
 * Converts product-card placeholders in article HTML into rich product cards
 * with real product data (images, prices, reviews, purchase links).
 * 
 * Placeholder format: <div data-type="product-card" data-product-id="123"></div>
 * 
 * Also provides functions to:
 * - Generate product comparison tables with real data
 * - Build product ranking sections with images
 * - Create product recommendation grids
 */

import { getMallProductById, getAllProductReviewStats, getAllMallProductBuyerCounts, getMallProductSalesRanking, findRelatedProductsForArticle } from "./db";

export interface ProductCardData {
  id: number;
  name: string;
  price: number;
  pointPrice?: number | null;
  imageUrl?: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  avgRating?: number;
  totalReviews?: number;
  buyerCount?: number;
  orderCount?: number;
}

/**
 * Generate a rich HTML product card from product data
 */
function renderProductCardHtml(product: ProductCardData): string {
  const imageHtml = product.imageUrl
    ? `<img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" style="width:100%;height:200px;object-fit:cover;border-radius:8px 8px 0 0;" loading="lazy" />`
    : `<div style="width:100%;height:200px;background:linear-gradient(135deg,#f0f0f0,#e0e0e0);border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;">商品画像</div>`;

  const ratingHtml = product.avgRating
    ? `<div style="display:flex;align-items:center;gap:4px;margin:4px 0;">
        <span style="color:#f59e0b;font-size:14px;">${'★'.repeat(Math.round(product.avgRating))}${'☆'.repeat(5 - Math.round(product.avgRating))}</span>
        <span style="font-size:12px;color:#666;">${product.avgRating.toFixed(1)} (${product.totalReviews || 0}件)</span>
      </div>`
    : '';

  const buyerHtml = product.buyerCount && product.buyerCount > 0
    ? `<span style="font-size:11px;color:#059669;font-weight:500;">${product.buyerCount}人が購入</span>`
    : '';

  const brandHtml = product.brandName
    ? `<span style="font-size:11px;color:#6366f1;background:#eef2ff;padding:2px 8px;border-radius:4px;">${escapeHtml(product.brandName)}</span>`
    : '';

  const priceDisplay = product.pointPrice
    ? `<div style="display:flex;align-items:baseline;gap:8px;">
        <span style="font-size:20px;font-weight:700;color:#dc2626;">¥${product.price.toLocaleString()}</span>
        <span style="font-size:13px;color:#666;">/ ${product.pointPrice.toLocaleString()}pt</span>
      </div>`
    : `<span style="font-size:20px;font-weight:700;color:#dc2626;">¥${product.price.toLocaleString()}</span>`;

  return `<div class="product-card" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;max-width:320px;display:inline-block;vertical-align:top;margin:8px;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'">
    <a href="/mall/products/${product.id}" style="text-decoration:none;color:inherit;" target="_blank">
      ${imageHtml}
      <div style="padding:12px 16px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          ${brandHtml}
          ${buyerHtml}
        </div>
        <h4 style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 8px 0;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(product.name)}</h4>
        ${ratingHtml}
        <div style="margin-top:8px;">
          ${priceDisplay}
        </div>
        <div style="margin-top:10px;text-align:center;">
          <span style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:600;">商品を見る →</span>
        </div>
      </div>
    </a>
  </div>`;
}

/**
 * Generate a product ranking HTML section with real data
 */
export function renderProductRankingHtml(products: ProductCardData[], title?: string): string {
  if (products.length === 0) return '';

  const rankingItems = products.map((p, i) => {
    const rankBadge = i < 3
      ? `<div style="position:absolute;top:-4px;left:-4px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;background:${i === 0 ? 'linear-gradient(135deg,#f59e0b,#d97706)' : i === 1 ? 'linear-gradient(135deg,#9ca3af,#6b7280)' : 'linear-gradient(135deg,#d97706,#92400e)'};">${i + 1}</div>`
      : `<div style="position:absolute;top:-4px;left:-4px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;background:#6b7280;">${i + 1}</div>`;

    const imageHtml = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0;" loading="lazy" />`
      : `<div style="width:80px;height:80px;background:#f3f4f6;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10px;">No Image</div>`;

    const ratingHtml = p.avgRating
      ? `<span style="color:#f59e0b;font-size:12px;">★${p.avgRating.toFixed(1)}</span><span style="font-size:11px;color:#666;">(${p.totalReviews || 0}件)</span>`
      : '';

    return `<div style="position:relative;display:flex;gap:12px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;margin-bottom:12px;">
      ${rankBadge}
      <a href="/mall/products/${p.id}" style="text-decoration:none;color:inherit;display:flex;gap:12px;width:100%;" target="_blank">
        ${imageHtml}
        <div style="flex:1;min-width:0;">
          <h4 style="font-size:14px;font-weight:600;color:#1f2937;margin:0 0 4px 0;line-height:1.4;">${escapeHtml(p.name)}</h4>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            ${p.brandName ? `<span style="font-size:11px;color:#6366f1;background:#eef2ff;padding:1px 6px;border-radius:3px;">${escapeHtml(p.brandName)}</span>` : ''}
            ${p.buyerCount && p.buyerCount > 0 ? `<span style="font-size:11px;color:#059669;">${p.buyerCount}人が購入</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;">${ratingHtml}</div>
          <div style="margin-top:4px;">
            <span style="font-size:18px;font-weight:700;color:#dc2626;">¥${p.price.toLocaleString()}</span>
            ${p.pointPrice ? `<span style="font-size:12px;color:#666;margin-left:6px;">/ ${p.pointPrice.toLocaleString()}pt</span>` : ''}
          </div>
        </div>
      </a>
    </div>`;
  }).join('\n');

  return `<div class="product-ranking" style="margin:24px 0;">
    ${title ? `<h3 style="font-size:18px;font-weight:700;margin-bottom:16px;color:#1f2937;">${escapeHtml(title)}</h3>` : ''}
    ${rankingItems}
  </div>`;
}

/**
 * Generate a product comparison table HTML with real data
 */
export function renderProductComparisonTable(products: ProductCardData[]): string {
  if (products.length === 0) return '';

  const headerCells = products.map(p => {
    const img = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;margin-bottom:4px;" loading="lazy" />`
      : '';
    return `<th style="padding:12px 8px;text-align:center;background:#f9fafb;border-bottom:2px solid #e5e7eb;min-width:120px;">
      ${img}
      <div style="font-size:12px;font-weight:600;line-height:1.3;">${escapeHtml(p.name)}</div>
    </th>`;
  }).join('');

  const priceRow = products.map(p =>
    `<td style="padding:8px;text-align:center;border-bottom:1px solid #f3f4f6;"><span style="font-weight:700;color:#dc2626;">¥${p.price.toLocaleString()}</span></td>`
  ).join('');

  const ratingRow = products.map(p => {
    const rating = p.avgRating ? `★${p.avgRating.toFixed(1)} (${p.totalReviews || 0}件)` : '—';
    return `<td style="padding:8px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;">${rating}</td>`;
  }).join('');

  const buyerRow = products.map(p => {
    const count = p.buyerCount && p.buyerCount > 0 ? `${p.buyerCount}人` : '—';
    return `<td style="padding:8px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;">${count}</td>`;
  }).join('');

  const brandRow = products.map(p =>
    `<td style="padding:8px;text-align:center;border-bottom:1px solid #f3f4f6;font-size:13px;">${p.brandName ? escapeHtml(p.brandName) : '—'}</td>`
  ).join('');

  const linkRow = products.map(p =>
    `<td style="padding:8px;text-align:center;"><a href="/mall/products/${p.id}" style="display:inline-block;background:#6366f1;color:#fff;padding:6px 16px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;" target="_blank">詳細を見る</a></td>`
  ).join('');

  return `<div style="overflow-x:auto;margin:24px 0;">
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <thead>
        <tr><th style="padding:12px 8px;text-align:left;background:#f9fafb;border-bottom:2px solid #e5e7eb;min-width:80px;">項目</th>${headerCells}</tr>
      </thead>
      <tbody>
        <tr><td style="padding:8px;font-weight:600;background:#fafafa;border-bottom:1px solid #f3f4f6;">価格</td>${priceRow}</tr>
        <tr><td style="padding:8px;font-weight:600;background:#fafafa;border-bottom:1px solid #f3f4f6;">評価</td>${ratingRow}</tr>
        <tr><td style="padding:8px;font-weight:600;background:#fafafa;border-bottom:1px solid #f3f4f6;">購入者数</td>${buyerRow}</tr>
        <tr><td style="padding:8px;font-weight:600;background:#fafafa;border-bottom:1px solid #f3f4f6;">ブランド</td>${brandRow}</tr>
        <tr><td style="padding:8px;font-weight:600;background:#fafafa;">購入リンク</td>${linkRow}</tr>
      </tbody>
    </table>
  </div>`;
}

/**
 * Generate a product grid HTML (for recommendation sections)
 */
export function renderProductGrid(products: ProductCardData[]): string {
  if (products.length === 0) return '';

  const cards = products.map(p => renderProductCardHtml(p)).join('\n');

  return `<div class="product-grid" style="display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin:24px 0;">
    ${cards}
  </div>`;
}

/**
 * Fetch enriched product data for a list of product IDs
 */
export async function fetchEnrichedProductData(productIds: number[]): Promise<ProductCardData[]> {
  const reviewStats = await getAllProductReviewStats();
  const buyerCounts = await getAllMallProductBuyerCounts();

  const results: ProductCardData[] = [];
  for (const id of productIds) {
    const product = await getMallProductById(id);
    if (!product) continue;

    results.push({
      id: product.id,
      name: product.name,
      price: product.price,
      pointPrice: product.pointPrice,
      imageUrl: product.imageUrl,
      brandName: null, // Will be enriched if needed
      categoryName: null,
      avgRating: reviewStats[product.id]?.avgRating,
      totalReviews: reviewStats[product.id]?.totalReviews,
      buyerCount: buyerCounts[product.id] || 0,
    });
  }
  return results;
}

/**
 * Replace all product-card placeholders in HTML with rich product cards
 * Placeholder format: <div data-type="product-card" data-product-id="123"></div>
 */
export async function replaceProductCardPlaceholders(html: string): Promise<string> {
  // Find all product-card placeholders
  const placeholderRegex = /<div\s+data-type="product-card"\s+data-product-id="(\d+)"[^>]*><\/div>/gi;
  const matches = [...html.matchAll(placeholderRegex)];

  if (matches.length === 0) return html;

  const productIds = matches.map(m => parseInt(m[1], 10));
  const enrichedProducts = await fetchEnrichedProductData(productIds);

  let result = html;
  for (const match of matches) {
    const productId = parseInt(match[1], 10);
    const product = enrichedProducts.find(p => p.id === productId);
    if (product) {
      result = result.replace(match[0], renderProductCardHtml(product));
    }
  }

  return result;
}

/**
 * Build enriched product data context for LLM prompt
 * Includes image URLs so LLM can reference them in article
 */
export async function buildProductDataForLLMPrompt(keyword: string, limit: number = 10): Promise<{
  context: string;
  salesRanking: ProductCardData[];
  relatedProducts: ProductCardData[];
}> {
  const salesRanking = await getMallProductSalesRanking(limit);
  const buyerCounts = await getAllMallProductBuyerCounts();
  const reviewStats = await getAllProductReviewStats();
  const relatedProducts = await findRelatedProductsForArticle(keyword, keyword, 8);

  const enrichSalesRanking: ProductCardData[] = salesRanking.map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    pointPrice: p.pointPrice,
    imageUrl: p.imageUrl,
    brandName: p.brandName,
    categoryName: p.categoryName,
    avgRating: reviewStats[p.id]?.avgRating,
    totalReviews: reviewStats[p.id]?.totalReviews,
    buyerCount: buyerCounts[p.id] || 0,
    orderCount: p.orderCount,
  }));

  const enrichRelated: ProductCardData[] = relatedProducts.map((p: any) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    pointPrice: p.pointPrice,
    imageUrl: p.imageUrl,
    brandName: p.brandName,
    categoryName: p.categoryName,
    avgRating: reviewStats[p.id]?.avgRating,
    totalReviews: reviewStats[p.id]?.totalReviews,
    buyerCount: buyerCounts[p.id] || 0,
  }));

  let context = '';

  if (enrichSalesRanking.length > 0) {
    context += `\n\n## LCJ MALL 売上ランキング（実データ・商品写真あり）\n`;
    context += `以下の商品データには実際の商品写真URL、価格、レビュー評価が含まれています。記事内で商品を紹介する際は、必ず <div data-type="product-card" data-product-id="商品ID"></div> プレースホルダーを配置してください。\n\n`;
    enrichSalesRanking.forEach((p, i) => {
      const rating = p.avgRating ? `★${p.avgRating.toFixed(1)}（${p.totalReviews}件）` : '未レビュー';
      context += `${i + 1}. **${p.name}**\n`;
      context += `   - 商品ID: ${p.id}\n`;
      context += `   - 価格: ¥${p.price.toLocaleString()}${p.pointPrice ? ` / ${p.pointPrice}pt` : ''}\n`;
      context += `   - 評価: ${rating}\n`;
      context += `   - 購入者数: ${p.buyerCount}人\n`;
      context += `   - ブランド: ${p.brandName || '不明'}\n`;
      context += `   - 商品写真: ${p.imageUrl || 'なし'}\n`;
      context += `   → 記事内プレースホルダー: <div data-type="product-card" data-product-id="${p.id}"></div>\n\n`;
    });
  }

  if (enrichRelated.length > 0) {
    context += `\n## キーワード「${keyword}」に関連する商品\n`;
    enrichRelated.forEach((p) => {
      const rating = p.avgRating ? `★${p.avgRating.toFixed(1)}（${p.totalReviews}件）` : '';
      context += `- **${p.name}**（¥${p.price.toLocaleString()}）${rating} ${p.buyerCount && p.buyerCount > 0 ? `購入者${p.buyerCount}人` : ''}\n`;
      context += `  商品ID: ${p.id} | 写真: ${p.imageUrl || 'なし'}\n`;
      context += `  → <div data-type="product-card" data-product-id="${p.id}"></div>\n`;
    });
  }

  return { context, salesRanking: enrichSalesRanking, relatedProducts: enrichRelated };
}

/**
 * Post-process article HTML: replace placeholders + add ranking/comparison sections
 */
export async function postProcessArticleHtml(
  html: string,
  salesRanking: ProductCardData[],
  relatedProducts: ProductCardData[]
): Promise<string> {
  // Step 1: Replace product-card placeholders with rich cards
  let processed = await replaceProductCardPlaceholders(html);

  // Step 2: If no product cards were found in the article but we have ranking data,
  // append a product ranking section at the end (before closing)
  const hasProductCards = /<div class="product-card"/.test(processed);
  
  if (!hasProductCards && salesRanking.length > 0) {
    // Add a ranking section with top products
    const topProducts = salesRanking.slice(0, 5);
    const rankingHtml = renderProductRankingHtml(topProducts, '🏆 LCJ MALL 売れ筋ランキング');
    
    // Also add comparison table if we have enough products
    const comparisonHtml = topProducts.length >= 3
      ? renderProductComparisonTable(topProducts.slice(0, 5))
      : '';

    processed += `\n${rankingHtml}\n${comparisonHtml}`;
  }

  // Step 3: If we have related products and no grid, add recommendation grid
  if (relatedProducts.length > 0 && !/<div class="product-grid"/.test(processed)) {
    const gridProducts = relatedProducts.slice(0, 4);
    if (gridProducts.length > 0) {
      const gridHtml = renderProductGrid(gridProducts);
      processed += `\n<div style="margin-top:32px;padding-top:24px;border-top:2px solid #e5e7eb;">
        <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;color:#1f2937;">📦 関連するおすすめ商品</h3>
        ${gridHtml}
      </div>`;
    }
  }

  return processed;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
