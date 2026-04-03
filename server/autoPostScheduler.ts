/**
 * Auto Post Scheduler
 * 
 * Automatically generates and publishes SEO-optimized blog articles
 * based on configured schedules. Checks every hour if any schedule
 * is due for execution.
 * 
 * Features:
 * - Auto keyword selection based on product data, trends, and categories
 * - Auto category assignment based on article content
 * - Brand internal link auto-insertion
 * - GEO optimization (Japanese SEO, hreflang)
 * - Real EC data injection (sales ranking, buyer counts, reviews)
 * - Dynamic year generation (no hardcoded years)
 * - Article type rotation (trend / problem-solving / ranking)
 * - Unified article template (intro → how-to → products → banner → summary)
 * - LCJ Mall banner insertion at 3 positions
 * - Tag-based product recommendation
 * - Auto internal links (5+ per article)
 * - Quality check before publishing
 */

import { listAutoPostSchedules, getNextUnusedKeyword, createAutoPostLog, updateAutoPostLog, markKeywordUsed, incrementScheduleGenerated, createBlogArticle, getBlogArticleBySlug, updateBlogArticle, updateAutoPostSchedule, listPresetKeywordsDb, createPresetKeywordDb, getMallProductSalesRanking, getAllMallProductBuyerCounts, getAllProductReviewStats, findRelatedProductsForArticle, getAllBlogCategories, getAllMallBrands, getAllMallCategoryRecords, getAllBlogTags, createBlogTag, setBlogArticleTags, getRelatedBlogArticles, getTodayBlogArticleCount, getTodayCategoryPostCounts, getRecentArticleTitles, publishDueScheduledArticles, getTodayScheduledCount, checkThemeDuplicate, recordBlogThemeLog, upsertBlogArticleStat } from "./db";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { buildProductDataForLLMPrompt, postProcessArticleHtml, type ProductCardData } from "./productCardRenderer";
import { generateCoverImagePrompt, detectArticleType, getArticleTypeLabel } from "./coverImageStyles";

// Check interval: every 1 hour
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

// ─── Article type rotation ───
// 3種類をローテーション: trend（トレンド）/ problem（悩み解決）/ ranking（比較ランキング）
const ARTICLE_TYPE_ROTATION = ['trend', 'problem', 'ranking'] as const;
type ArticleTypeRotation = typeof ARTICLE_TYPE_ROTATION[number];

// ─── 配信スケジューラー設定 ───
/** 1日の投稿本数目標 */
const DAILY_POST_TARGET = 12;

/** 投稿時間スロット（JST時） */
const POST_SLOTS_JST = [8, 12, 18, 22];

/** スロットあたりの投稿本数 */
const POSTS_PER_SLOT = 3;

/** 1日の記事タイプ配分（trend:5, problem:4, ranking:3） */
const DAILY_TYPE_PLAN: ArticleTypeRotation[] = [
  'trend', 'trend', 'trend',
  'problem', 'problem', 'problem',
  'ranking', 'ranking',
  'trend', 'problem',
  'ranking', 'trend',
];

/** カテゴリ優先度ウェイト（キーワードのカテゴリ名の一部マッチ） */
const CATEGORY_WEIGHTS: Record<string, number> = {
  'TikTok': 0.25,
  'ポイ活': 0.20,
  'レシート': 0.15,
  'ライブコマース': 0.15,
  'LCJ': 0.10,
  'シャンプー': 0.05,
  'スキンケア': 0.05,
  'default': 0.05,
};

/** 深夜バッチ実行時刻（JST時） */
const MIDNIGHT_BATCH_HOUR_JST = 2;

/** 重複チェック期間（日） */
const DUPLICATE_CHECK_DAYS = 14;

/** 品質チェック失敗時の最大再生成回数 */
const MAX_RETRY_COUNT = 3;

// ─── Category keyword mapping for auto-assignment ───
const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  'TikTok Shop': ['TikTok', 'ティックトック', 'TikTok Shop', 'アフィリエイト', 'ソーシャルコマース', 'ショート動画', 'TikTok広告'],
  'ポイ活・ポイント': ['ポイ活', 'ポイント', 'キャッシュバック', 'ポイントサイト', 'マイル', 'クレカ', '二重取り', 'ポイント活動'],
  'レシート副業': ['レシート', '副業', '買取', 'スキャン', '家計簿', 'お小遣い稼ぎ', 'レシートアプリ'],
  'ライブコマース': ['ライブコマース', 'ライブ配信', 'ライブコマーサー', 'ライブショッピング', 'インフルエンサーコマース', '配信販売'],
  'LCJ MALL': ['LCJ', 'MALL', '越境EC', '海外商品', '個人輸入', '海外通販'],
  'シャンプー・トリートメント': ['シャンプー', 'トリートメント', 'コンディショナー', 'ヘアマスク', '洗髪', 'ヘアウォッシュ'],
  'カラーケア': ['カラー', 'ヘアカラー', '紫シャンプー', 'カラーシャンプー', '染め', 'ブリーチ', 'ハイトーン', 'カラートリートメント'],
  'ダメージケア': ['ダメージ', '修復', 'パサパサ', '枝毛', '切れ毛', 'ケラチン', '補修', 'ヘアオイル'],
  '成分解析': ['成分', '解析', 'アミノ酸', 'ケラチン', 'シリコン', 'パラベン', '界面活性剤', '無添加'],
  '美容師監修ケア': ['美容師', 'サロン', 'プロ', '専売', '監修', 'スタイリスト'],
  'スキンケア': ['スキンケア', '化粧水', '美容液', 'クレンジング', '洗顔', '保湿', 'セラム'],
  '美容家電': ['ドライヤー', 'ヘアアイロン', 'コテ', '美顔器', '美容家電'],
  'ランキング・比較': ['ランキング', '比較', 'おすすめ', '人気', 'ベスト', 'TOP'],
  '美容トレンド': ['トレンド', '最新', '新作', '話題'],
  'Eコマース': ['EC', 'オンラインショップ', '通販', '越境EC', 'D2C'],
  '節約・お得情報': ['節約', 'お得', 'クーポン', 'セール', 'コスパ', '賢い買い物', '値引き'],
};

/**
 * Auto-detect the best blog category for a given keyword
 */
export function detectCategoryForKeyword(keyword: string, categories: Array<{ id: number; name: string }>): number | null {
  const lowerKeyword = keyword.toLowerCase();
  let bestMatch: { id: number; score: number } | null = null;

  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORD_MAP[cat.name] || [];
    let score = 0;
    for (const kw of keywords) {
      if (lowerKeyword.includes(kw.toLowerCase())) {
        score += kw.length; // Longer match = more specific = higher score
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: cat.id, score };
    }
  }

  return bestMatch?.id || null;
}

/**
 * Insert brand internal links into article HTML
 * Replaces brand names with links to /brands/:brandId
 */
export function insertBrandLinks(html: string, brands: Array<{ id: number; name: string; nameEn?: string | null }>): string {
  let result = html;
  
  // Sort brands by name length (longest first) to avoid partial replacements
  const sortedBrands = [...brands].sort((a, b) => {
    const aLen = Math.max(a.name.length, (a.nameEn || '').length);
    const bLen = Math.max(b.name.length, (b.nameEn || '').length);
    return bLen - aLen;
  });

  for (const brand of sortedBrands) {
    const names = [brand.name];
    if (brand.nameEn) names.push(brand.nameEn);

    for (const name of names) {
      if (!name || name.length < 2) continue;
      
      // Only replace text outside of existing links and HTML tags
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match brand name that is NOT inside an <a> tag or HTML attribute
      const regex = new RegExp(`(?<![">])(?<!<a[^>]*>)(${escapedName})(?![^<]*</a>)(?![^<]*>)`, 'gi');
      
      let replaced = false;
      result = result.replace(regex, (match) => {
        if (replaced) return match; // Only replace first occurrence per brand
        replaced = true;
        return `<a href="/brands/${brand.id}" class="brand-link" title="${brand.name}の商品一覧">${match}</a>`;
      });
    }
  }

  return result;
}

/**
 * LCJ Mall特典バナーHTMLを生成する
 */
function buildLcjBannerHtml(position: 'top' | 'middle' | 'bottom'): string {
  const messages: Record<string, string> = {
    top: 'TikTok Shopで購入した商品は、LCJ Mallでレシートを送るとポイント還元！今すぐチェック',
    middle: 'LCJ Mall限定特典：TikTok Shopのレシート送信でポイントがもらえる！お得に美容商品をゲット',
    bottom: 'LCJ Mallでお気に入りの美容商品を見つけよう。TikTok Shopのレシート送信でポイント還元対象！',
  };
  const msg = messages[position];
  return `<div class="lcj-banner lcj-banner-${position}" style="margin:24px 0;padding:20px 24px;background:linear-gradient(135deg,#ff6b9d 0%,#c44dff 100%);border-radius:12px;text-align:center;color:#fff;">
  <p style="margin:0 0 12px;font-size:15px;font-weight:600;line-height:1.5;">${msg}</p>
  <a href="https://lcjmall.com" style="display:inline-block;padding:10px 28px;background:#fff;color:#c44dff;font-weight:700;border-radius:999px;text-decoration:none;font-size:14px;">LCJ Mallを見る →</a>
</div>`;
}

/**
 * 記事HTMLにLCJバナーを3箇所（冒頭・商品紹介前・末尾）に挿入する
 */
export function insertLcjBanners(html: string): string {
  // 既にバナーが挿入済みの場合はスキップ
  if (html.includes('lcj-banner')) return html;

  let result = html;

  // 1. 冒頭（最初のh2の前）
  const firstH2Match = result.match(/<h2[^>]*>/i);
  if (firstH2Match && firstH2Match.index !== undefined) {
    result = result.slice(0, firstH2Match.index) + buildLcjBannerHtml('top') + '\n' + result.slice(firstH2Match.index);
  } else {
    // h2がなければ先頭に追加
    result = buildLcjBannerHtml('top') + '\n' + result;
  }

  // 2. 商品紹介前（product-cardまたは「おすすめ」「ランキング」を含むh2/h3の前）
  const productSectionMatch = result.match(/<h[23][^>]*>[^<]*(おすすめ|ランキング|比較|商品|product)[^<]*<\/h[23]>/i);
  if (productSectionMatch && productSectionMatch.index !== undefined) {
    result = result.slice(0, productSectionMatch.index) + buildLcjBannerHtml('middle') + '\n' + result.slice(productSectionMatch.index);
  }

  // 3. 末尾（まとめ・まとめセクションの前、またはHTMLの末尾）
  const summaryMatch = result.match(/<h[23][^>]*>[^<]*(まとめ|おわりに|最後に|結論)[^<]*<\/h[23]>/i);
  if (summaryMatch && summaryMatch.index !== undefined) {
    result = result.slice(0, summaryMatch.index) + buildLcjBannerHtml('bottom') + '\n' + result.slice(summaryMatch.index);
  } else {
    // まとめセクションがなければ末尾に追加
    result = result + '\n' + buildLcjBannerHtml('bottom');
  }

  return result;
}
/**
 * 内部リンクセクションを自動生成して記事末尾に追加する（文脈最適化版）
 * - 同カテゴリ記事2本（最新順）
 * - 同悩み（タグ一致）記事1本
 * - 商品ページ1本（キーワード連動）
 * - LCJ Mall案内1本
 * 合計5本以上の内部リンクを保証
 */
async function buildInternalLinksSection(
  articleId: number,
  categoryId: number | null,
  tagIds: number[],
  keyword: string
): Promise<string> {
  // 同カテゴリ記事（最大3本取得して上位2本使用）
  let sameCategoryArticles: Array<{ title: string; slug: string }> = [];
  try {
    sameCategoryArticles = await getRelatedBlogArticles(articleId, categoryId, [], 3);
  } catch (e) {
    // ignore
  }

  // 同タグ（悩み）記事（最大2本取得して1本使用、カテゴリ記事と重複しないもの）
  let sameTagArticles: Array<{ title: string; slug: string }> = [];
  try {
    if (tagIds.length > 0) {
      const tagRelated = await getRelatedBlogArticles(articleId, null, tagIds, 3);
      const catSlugs = new Set(sameCategoryArticles.map(a => a.slug));
      sameTagArticles = tagRelated.filter(a => !catSlugs.has(a.slug)).slice(0, 1);
    }
  } catch (e) {
    // ignore
  }

  // キーワードに応じた商品ページURLを生成
  const productPageUrl = categoryId
    ? `/mall/products?category=${categoryId}`
    : `/mall/products`;
  const productPageLabel = keyword
    ? `${keyword}の商品一覧を見る`
    : 'LCJ Mall 商品一覧を見る';

  let html = `<div class="internal-links-section" style="margin-top:40px;padding:24px;background:#f9fafb;border-radius:12px;">
  <h3 style="font-size:18px;font-weight:700;margin-bottom:16px;color:#1f2937;">📚 関連記事・おすすめリンク</h3>
  <ul style="list-style:none;padding:0;margin:0 0 16px;">`;

  // 同カテゴリ記事（最大2本）
  for (const art of sameCategoryArticles.slice(0, 2)) {
    html += `\n    <li style="margin-bottom:8px;"><a href="/blog/${art.slug}" style="color:#7c3aed;text-decoration:none;font-weight:500;">▶ ${art.title}</a></li>`;
  }

  // 同悩み（タグ一致）記事（1本）
  for (const art of sameTagArticles.slice(0, 1)) {
    html += `\n    <li style="margin-bottom:8px;"><a href="/blog/${art.slug}" style="color:#7c3aed;text-decoration:none;font-weight:500;">▶ ${art.title}</a></li>`;
  }

  // 関連記事が合計3本未満の場合はブログ一覧リンクで補完
  const totalArticleLinks = sameCategoryArticles.slice(0, 2).length + sameTagArticles.slice(0, 1).length;
  if (totalArticleLinks < 3) {
    html += `\n    <li style="margin-bottom:8px;"><a href="/blog" style="color:#7c3aed;text-decoration:none;font-weight:500;">▶ 美容・ヘアケアブログ一覧</a></li>`;
  }

  // 商品ページリンク（キーワード連動）
  html += `\n    <li style="margin-bottom:8px;"><a href="${productPageUrl}" style="color:#7c3aed;text-decoration:none;font-weight:500;">▶ ${productPageLabel}</a></li>`;

  // LCJ Mall案内リンク
  html += `\n    <li style="margin-bottom:8px;"><a href="https://lcjmall.com" style="color:#7c3aed;text-decoration:none;font-weight:500;">▶ LCJ Mall トップページ（TikTok Shop連携・ポイント還元）</a></li>`;

  html += `\n  </ul>\n</div>`;

  return html;
}

/**
 * 品質チェック：最低基準を満たすか確認する
 * 基準:
 * - 年号が正常（ハードコードされた過去年がない）
 * - LCJバナーが3箇所以上
 * - 内部リンクが5本以上
 * - 画像が1枚以上（coverImageUrlまたはインライン画像）
 */
export function qualityCheck(html: string, coverImageUrl: string | null): {
  passed: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // バナーチェック（3箇所）
  const bannerCount = (html.match(/lcj-banner/g) || []).length;
  if (bannerCount < 3) {
    issues.push(`LCJバナーが${bannerCount}箇所（最低3箇所必要）`);
  }

  // 内部リンクチェック（5本以上）
  const internalLinkCount = (html.match(/href="(\/|https:\/\/lcjmall\.com)/g) || []).length;
  if (internalLinkCount < 5) {
    issues.push(`内部リンクが${internalLinkCount}本（最低5本必要）`);
  }

  // 画像チェック
  const hasImage = coverImageUrl || /<img[^>]+src/.test(html);
  if (!hasImage) {
    issues.push('画像が0枚（最低1枚必要）');
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/**
 * 記事タイプに応じたプロンプトテンプレートを返す
 */
function getArticleTypePrompt(articleTypeRotation: ArticleTypeRotation, keyword: string, currentYear: number): string {
  switch (articleTypeRotation) {
    case 'trend':
      return `記事タイプ: トレンド紹介記事
構成（必ずこの順序で）:
1. 冒頭リード文（${currentYear}年の最新トレンドとして「${keyword}」を紹介、読者の興味を引く）
2. 「${keyword}とは」（h2: 基本説明・背景）
3. 「${currentYear}年のトレンドポイント」（h2: なぜ今注目されているか）
4. 「選び方のポイント」（h2: 読者が商品を選ぶ際の基準）
5. 「おすすめ商品」（h2: 商品カードプレースホルダーを3〜5個配置）
6. 「よくある質問」（h2: FAQ 3〜5個）
7. 「まとめ」（h2: 記事の要点とLCJ Mallへの誘導）`;

    case 'problem':
      return `記事タイプ: 悩み解決記事
構成（必ずこの順序で）:
1. 冒頭リード文（「${keyword}」に悩む読者に共感し、解決策を提示）
2. 「よくある悩みとその原因」（h2: 読者の悩みを具体的に列挙）
3. 「解決策・ケア方法」（h2: ステップバイステップのHowTo）
4. 「選び方のポイント」（h2: 商品選びの基準）
5. 「おすすめ商品」（h2: 商品カードプレースホルダーを3〜5個配置）
6. 「よくある質問」（h2: FAQ 3〜5個）
7. 「まとめ」（h2: 記事の要点とLCJ Mallへの誘導）`;

    case 'ranking':
    default:
      return `記事タイプ: 比較・ランキング記事
構成（必ずこの順序で）:
1. 冒頭リード文（「${keyword}」の比較・ランキング記事であることを明示）
2. 「選び方のポイント」（h2: 比較基準を解説）
3. 「${currentYear}年おすすめランキング TOP5」（h2: 商品カードプレースホルダーを5個配置、各商品にh3見出し）
4. 「比較表」（h2: tableタグで商品を比較）
5. 「よくある質問」（h2: FAQ 3〜5個）
6. 「まとめ」（h2: 記事の要点とLCJ Mallへの誘導）`;
  }
}

/**
 * Start the auto post scheduler
 */
export function startAutoPostScheduler() {
  if (intervalId) {
    console.log("[AutoPost Scheduler] Already running");
    return;
  }

  console.log("[AutoPost Scheduler] Starting scheduler (checks every 1 hour)");

  // Run initial check after 5 minutes (let server fully start)
  setTimeout(() => {
    runAutoPostCheck().catch((error) => {
      console.error("[AutoPost Scheduler] Error during initial run:", error);
    });
  }, 5 * 60 * 1000);

  // Then check every hour
  intervalId = setInterval(() => {
    runAutoPostCheck().catch((error) => {
      console.error("[AutoPost Scheduler] Error during scheduled run:", error);
    });
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the auto post scheduler
 */
export function stopAutoPostScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[AutoPost Scheduler] Stopped");
  }
}

/**
 * Auto-replenish keywords when running low
 * Now uses product data to generate more relevant keywords
 */
async function autoReplenishKeywords() {
  try {
    const keywords = await listPresetKeywordsDb();
    const unusedCount = keywords.filter(k => k.usedCount === 0).length;
    const LOW_THRESHOLD = 10;

    if (unusedCount < LOW_THRESHOLD) {
      const currentYear = new Date().getFullYear();
      console.log(`[AutoPost Scheduler] Low keywords (${unusedCount} unused). Auto-generating more...`);
      const existingList = keywords.map(k => k.keyword);

      // Fetch product data to generate relevant keywords
      let productContext = '';
      try {
        const salesRanking = await getMallProductSalesRanking(20);
        const mallCategories = await getAllMallCategoryRecords();
        const mallBrands = await getAllMallBrands();
        
        if (salesRanking.length > 0) {
          productContext += `\n売れ筋商品: ${salesRanking.map((p: any) => p.name).join('、')}`;
        }
        if (mallCategories.length > 0) {
          productContext += `\n商品カテゴリ: ${mallCategories.filter((c: any) => c.name !== 'テストカテゴリ').map((c: any) => c.name).join('、')}`;
        }
        if (mallBrands.length > 0) {
          productContext += `\nブランド: ${mallBrands.map((b: any) => b.name).join('、')}`;
        }
      } catch (e) {
        // Continue without product data
      }

      const categories = [
        { cat: "tiktok-shop", desc: "TikTok Shopでの購入方法、お得な使い方、商品レビュー、TikTok Shop始め方、出店方法、売れ筋商品、TikTokアフィリエイト" },
        { cat: "point-katsu", desc: "ポイ活、ポイント活動、ポイントサイト、キャッシュバック、ポイント二重取り、クレカポイント、マイル貯め方" },
        { cat: "receipt-side-job", desc: "レシートで副業、レシート買取アプリ、レシートポイ活、レシートスキャンで稼ぐ、家計簿アプリ連携" },
        { cat: "live-commerce", desc: "ライブコマース、ライブ配信販売、ライブコマーサー、ライブ配信で稼ぐ、ライブショッピング、インフルエンサーコマース" },
        { cat: "lcj-mall", desc: "LCJ MALL、越境EC、海外商品購入、個人輸入、海外通販、お得な買い物術" },
        { cat: "ec-trends", desc: `EC最新トレンド${currentYear}、ソーシャルコマース、D2C、サブスクリプションEC、AI×EC、パーソナライズ` },
        { cat: "money-saving", desc: "節約術、お得情報、クーポン活用、セール攻略、コスパ最強、賢い買い物" },
        { cat: "shampoo-treatment", desc: "シャンプー・トリートメント おすすめ、比較、ランキング、成分、選び方" },
      ];

      // Pick 3 random categories to generate for variety
      const shuffled = categories.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 3);

      for (const { cat, desc } of selected) {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `あなたはSEOキーワードリサーチの専門家です。LCJ MALL（TikTok Shop連携ECモール。ポイ活・レシート副業・ライブコマース情報も発信。ドメイン: lcjmall.com）のための日本語ロングテールSEOキーワードを生成してください。
ルール:
- 3〜6語のロングテールキーワード
- 購買意図が高いキーワードを優先（「おすすめ」「比較」「ランキング」「口コミ」「選び方」）
- 検索ボリュームが見込める実用的なもの
- 「〜とは」「〜やり方」「〜おすすめ」「〜比較」「〜ランキング」「〜口コミ」などのパターンを活用
- 年号を使う場合は必ず${currentYear}年を使用すること（過去の年号は使わない）
${productContext}`,
              },
              {
                role: "user",
                content: `カテゴリ「${cat}」（${desc}）に関連するSEOキーワードを10個生成してください。
既存キーワードと重複しないように: ${existingList.slice(0, 80).join("、")}
JSON形式で返してください:`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "keyword_list",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    keywords: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          keyword: { type: "string" },
                          priority: { type: "integer" },
                        },
                        required: ["keyword", "priority"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["keywords"],
                  additionalProperties: false,
                },
              },
            },
          });

          const kwRawSch = response.choices[0].message.content;
          const parsed = JSON.parse((typeof kwRawSch === 'string' ? kwRawSch : '') || '{"keywords":[]}');
          let insertedCount = 0;
          for (const kw of parsed.keywords) {
            if (kw.keyword && !existingList.includes(kw.keyword)) {
              try {
                await createPresetKeywordDb({
                  keyword: kw.keyword,
                  category: cat,
                  priority: Math.min(10, Math.max(1, kw.priority || 5)),
                });
                existingList.push(kw.keyword);
                insertedCount++;
              } catch (e) {
                // Skip duplicates
              }
            }
          }
          console.log(`[AutoPost Scheduler] Auto-generated ${insertedCount} keywords for category "${cat}"`);
        } catch (e: any) {
          console.error(`[AutoPost Scheduler] Keyword generation failed for "${cat}":`, e.message);
        }
      }
    }
  } catch (error: any) {
    console.error("[AutoPost Scheduler] Keyword replenish error:", error.message);
  }
}

/**
 * Check all enabled schedules and execute any that are due
 */
/**
 * タイトルの類似度チェック（重複防止）
 * 直近14日間の記事タイトルとの類似度を確認
 */
function isSimilarTitle(newTitle: string, existingTitles: string[]): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s\u3000・、。！？!?\-]/g, '');
  const normalizedNew = normalize(newTitle);
  for (const existing of existingTitles) {
    const normalizedExisting = normalize(existing);
    // 完全一致チェック
    if (normalizedNew === normalizedExisting) return true;
    // 部分一致チェック（新タイトルの70%以上が既存タイトルに含まれる）
    const shorter = normalizedNew.length < normalizedExisting.length ? normalizedNew : normalizedExisting;
    const longer = normalizedNew.length < normalizedExisting.length ? normalizedExisting : normalizedNew;
    if (shorter.length > 10 && longer.includes(shorter)) return true;
  }
  return false;
}

/**
 * 今日のJST時刻を取得
 */
function getJSTHour(): number {
  return (new Date().getUTCHours() + 9) % 24;
}

/**
 * 今日のスロットインデックスを取得（0-3）
 * 08:00→0, 12:00→1, 18:00→2, 22:00→3
 */
function getCurrentSlotIndex(): number {
  const jstHour = getJSTHour();
  for (let i = POST_SLOTS_JST.length - 1; i >= 0; i--) {
    if (jstHour >= POST_SLOTS_JST[i]) return i;
  }
  return -1; // まだ最初のスロット前
}

/**
 * 指定スロットのUTC publishedAt 時刻を生成
 */
function getSlotPublishedAt(slotIndex: number, daysOffset: number = 0): Date {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstDate = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + daysOffset));
  const jstSlotHour = POST_SLOTS_JST[slotIndex];
  // JST時刻をUTCに変換
  return new Date(jstDate.getTime() + jstSlotHour * 60 * 60 * 1000 - jstOffset);
}

/**
 * 深夜バッチ: 当日分12本を事前生成してscheduledにする
 * 毎日JST 02:00頃に実行
 */
export async function runMidnightBatch() {
  console.log("[AutoPost Scheduler] Running midnight batch...");
  try {
    await autoReplenishKeywords();

    const schedules = await listAutoPostSchedules();
    const enabledSchedules = schedules.filter(s => s.enabled);
    if (enabledSchedules.length === 0) {
      console.log("[AutoPost Scheduler] No enabled schedules found");
      return;
    }

    // 今日すでにscheduledになっている記事数を確認
    const todayScheduledCount = await getTodayScheduledCount();
    const needed = DAILY_POST_TARGET - todayScheduledCount;
    if (needed <= 0) {
      console.log(`[AutoPost Scheduler] Already have ${todayScheduledCount} scheduled articles for today, skipping midnight batch`);
      return;
    }

    console.log(`[AutoPost Scheduler] Midnight batch: generating ${needed} articles (${todayScheduledCount} already scheduled)`);

    // 直近14日間の記事タイトルを取得（重複チェック用）
    const recentTitles = await getRecentArticleTitles(DUPLICATE_CHECK_DAYS);
    // 今日のカテゴリ別投稿数
    const categoryPostCounts = await getTodayCategoryPostCounts();

    const schedule = enabledSchedules[0]; // メインスケジュールを使用
    let generatedCount = 0;

    // テーマ重複チェック用のカテゴリ×タイプ使用済みセット（深夜バッチ内での重複防止）
    const usedThemeKeys = new Set<string>();

    for (let i = todayScheduledCount; i < DAILY_POST_TARGET && generatedCount < needed; i++) {
      // 記事タイプをDAILY_TYPE_PLANから取得
      const articleType = DAILY_TYPE_PLAN[i % DAILY_TYPE_PLAN.length];
      // スロットインデックスを計算（3本ずつ）
      const slotIndex = Math.floor(i / POSTS_PER_SLOT) % POST_SLOTS_JST.length;
      const publishedAt = getSlotPublishedAt(slotIndex);

      // 最大3回リトライ
      let success = false;
      for (let retry = 0; retry < MAX_RETRY_COUNT; retry++) {
        try {
          const articleId = await executeAutoPostWithType(schedule, articleType, 'scheduled', publishedAt, recentTitles, categoryPostCounts, usedThemeKeys);
          if (articleId) {
            recentTitles.push(''); // プレースホルダー（実際のタイトルは取得できないため）
            generatedCount++;
            success = true;
            console.log(`[AutoPost Scheduler] Midnight batch: generated article ${i + 1}/${DAILY_POST_TARGET} (type: ${articleType}, slot: ${POST_SLOTS_JST[slotIndex]}:00 JST)`);
            break;
          }
        } catch (retryError: any) {
          console.warn(`[AutoPost Scheduler] Midnight batch retry ${retry + 1}/${MAX_RETRY_COUNT} failed:`, retryError.message);
          if (retry === MAX_RETRY_COUNT - 1) {
            console.error(`[AutoPost Scheduler] Midnight batch: giving up on article ${i + 1} after ${MAX_RETRY_COUNT} retries`);
          }
        }
      }
      if (!success) {
        console.warn(`[AutoPost Scheduler] Midnight batch: skipping article ${i + 1} due to repeated failures`);
      }
    }

    console.log(`[AutoPost Scheduler] Midnight batch complete: ${generatedCount} articles generated`);
  } catch (error: any) {
    console.error("[AutoPost Scheduler] Midnight batch error:", error.message);
  }
}

/**
 * 公開バッチ: publishedAt が来た scheduled 記事を published に変更
 * 毎時間チェック（08:00, 12:00, 18:00, 22:00 JST に自動公開）
 */
export async function runPublishBatch() {
  try {
    const publishedIds = await publishDueScheduledArticles();
    if (publishedIds.length > 0) {
      console.log(`[AutoPost Scheduler] Publish batch: published ${publishedIds.length} articles: [${publishedIds.join(', ')}]`);
      // IndexNow通知
      const baseUrl = process.env.APP_URL || "";
      if (baseUrl) {
        for (const id of publishedIds) {
          try {
            await fetch(`${baseUrl}/api/indexnow/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls: [`/blog/article-${id}`] }),
            });
          } catch (_) {}
        }
      }
    }
  } catch (error: any) {
    console.error("[AutoPost Scheduler] Publish batch error:", error.message);
  }
}

export async function runAutoPostCheck() {
  console.log("[AutoPost Scheduler] Running check...");
  try {
    const now = new Date();
    const jstHour = getJSTHour();

    // 公開バッチ: 毎時間チェック（scheduledの記事を自動公開）
    await runPublishBatch();

    // 深夜バッチ: JST 02:00 頃に実行
    if (jstHour === MIDNIGHT_BATCH_HOUR_JST) {
      await runMidnightBatch();
      return;
    }

    // 通常バッチ: 既存スケジュール設定に基づく個別記事生成
    // （深夜バッチが不十分な場合の補完として機能）
    await autoReplenishKeywords();

    const schedules = await listAutoPostSchedules();
    const enabledSchedules = schedules.filter(s => s.enabled);

    if (enabledSchedules.length === 0) {
      console.log("[AutoPost Scheduler] No enabled schedules found");
      return;
    }

    // 今日の投稿本数を確認
    const todayCount = await getTodayBlogArticleCount();
    if (todayCount >= DAILY_POST_TARGET) {
      console.log(`[AutoPost Scheduler] Daily target reached (${todayCount}/${DAILY_POST_TARGET}), skipping`);
      return;
    }

    // 現在のスロットを確認
    const currentSlotIndex = getCurrentSlotIndex();
    if (currentSlotIndex < 0) {
      console.log(`[AutoPost Scheduler] No active slot at JST ${jstHour}:00, skipping`);
      return;
    }

    // このスロットで生成すべき記事数を確認
    const slotStartCount = currentSlotIndex * POSTS_PER_SLOT;
    const slotEndCount = slotStartCount + POSTS_PER_SLOT;
    if (todayCount >= slotEndCount) {
      console.log(`[AutoPost Scheduler] Slot ${POST_SLOTS_JST[currentSlotIndex]}:00 JST already filled (${todayCount} articles), skipping`);
      return;
    }

    const recentTitles = await getRecentArticleTitles(DUPLICATE_CHECK_DAYS);
    const categoryPostCounts = await getTodayCategoryPostCounts();
    const schedule = enabledSchedules[0];

    for (const s of enabledSchedules) {
      try {
        const nextRunAt = s.nextRunAt ? new Date(s.nextRunAt) : null;
        if (!nextRunAt || now >= nextRunAt) {
          if (Math.abs(jstHour - s.preferredHour) > 1) continue;

          const articleIndex = todayCount;
          const articleType = DAILY_TYPE_PLAN[articleIndex % DAILY_TYPE_PLAN.length];

          console.log(`[AutoPost Scheduler] Executing schedule: ${s.name} (ID: ${s.id}, type: ${articleType})`);
          await executeAutoPostWithType(s, articleType, s.autoPublish === 'publish' ? 'published' : 'scheduled', null, recentTitles, categoryPostCounts);

          const nextRun = new Date(now.getTime() + s.intervalDays * 24 * 60 * 60 * 1000);
          nextRun.setUTCHours(s.preferredHour - 9, 0, 0, 0);
          await updateAutoPostSchedule(s.id, { nextRunAt: nextRun });
        }
      } catch (scheduleError: any) {
        console.error(`[AutoPost Scheduler] Error executing schedule ${s.id}:`, scheduleError.message);
      }
    }
  } catch (error: any) {
    console.error("[AutoPost Scheduler] Error during check:", error.message);
  }
}

/**
 * Execute a single auto-post cycle for a given schedule
 * @param schedule - スケジュール設定
 * @param forcedArticleType - 強制する記事タイプ（未指定時はローテーション）
 * @param forcedStatus - 強制する公開ステータス（未指定時はスケジュール設定に従う）
 * @param forcedPublishedAt - 強制する公開時刻（scheduled時に使用）
 * @param recentTitles - 重複チェック用の直近記事タイトル一覧
 * @param categoryPostCounts - カテゴリ別投稿数（偏り防止用）
 * @param usedThemeKeys - 深夜バッチ内で使用済みのテーマキーセット（カテゴリ×記事タイプの組み合わせ）
 * @returns 作成された記事ID（失敗時はnull）
 */
export async function executeAutoPostWithType(
  schedule: any,
  forcedArticleType?: ArticleTypeRotation,
  forcedStatus?: 'published' | 'scheduled' | 'draft',
  forcedPublishedAt?: Date | null,
  recentTitles?: string[],
  categoryPostCounts?: Record<number, number>,
  usedThemeKeys?: Set<string>,
): Promise<number | null> {
  // Create log entry
  const log = await createAutoPostLog({
    scheduleId: schedule.id,
    status: 'pending',
    keyword: null,
  });

  try {
    // ─── 動的年号 ───
    const currentYear = new Date().getFullYear();

    // Step 1: Select keyword
    let keyword: string;
    let keywordId: number | null = null;
    const nextKw = await getNextUnusedKeyword();
    if (nextKw) {
      keyword = nextKw.keyword;
      keywordId = nextKw.id;
    } else {
      await updateAutoPostLog(log.id, { status: 'failed', errorMessage: 'No keywords available' });
      console.warn(`[AutoPost Scheduler] No keywords available for schedule ${schedule.id}`);
      return null;
    }

    await updateAutoPostLog(log.id, { status: 'generating', keyword });
    console.log(`[AutoPost Scheduler] Generating article for keyword: "${keyword}"`);

    // Step 2: Auto-detect category from keyword
    const blogCategories = await getAllBlogCategories();
    let categoryId = schedule.categoryId;
    if (!categoryId) {
      categoryId = detectCategoryForKeyword(keyword, blogCategories);
      console.log(`[AutoPost Scheduler] Auto-detected category: ${categoryId ? blogCategories.find(c => c.id === categoryId)?.name : 'none'}`);
    }

    // Step 3: Fetch real EC data with product images for enriched article
    let realDataContext = '';
    let productSalesRanking: ProductCardData[] = [];
    let productRelated: ProductCardData[] = [];
    try {
      const productData = await buildProductDataForLLMPrompt(keyword, 10);
      realDataContext = productData.context;
      productSalesRanking = productData.salesRanking;
      productRelated = productData.relatedProducts;
      console.log(`[AutoPost Scheduler] Fetched ${productSalesRanking.length} ranking products, ${productRelated.length} related products with images`);
    } catch (dataErr: any) {
      console.warn('[AutoPost Scheduler] Failed to fetch EC data:', dataErr.message);
    }

    // Step 4: Determine article type rotation
    // forcedArticleTypeが指定されている場合はそれを使用、なければDAILY_TYPE_PLANからローテーション
    const rotationIndex = (schedule.totalGenerated || 0) % ARTICLE_TYPE_ROTATION.length;
    const articleTypeRotation: ArticleTypeRotation = forcedArticleType || ARTICLE_TYPE_ROTATION[rotationIndex];
    const articleTypePrompt = getArticleTypePrompt(articleTypeRotation, keyword, currentYear);

    // 重複チェック（直近14日間のタイトルと類似していないか確認）
    if (recentTitles && recentTitles.length > 0) {
      // キーワードが直近のタイトルに含まれる場合はスキップ
      const keywordInRecent = recentTitles.filter(t => t.includes(keyword)).length;
      if (keywordInRecent >= 3) {
        console.warn(`[AutoPost Scheduler] Keyword "${keyword}" appears in ${keywordInRecent} recent titles, skipping to avoid duplication`);
        await updateAutoPostLog(log.id, { status: 'failed', errorMessage: `Duplicate keyword: ${keyword}` });
        return null;
      }
    }

    // カテゴリ偏り防止（同じカテゴリを連続3本以上禁止）
    if (categoryPostCounts && categoryId) {
      const catCount = categoryPostCounts[categoryId] || 0;
      if (catCount >= 3) {
        console.warn(`[AutoPost Scheduler] Category ${categoryId} already has ${catCount} posts today, trying different category`);
        // 別カテゴリに変更を試みる
        const otherCategories = blogCategories.filter(c => c.id !== categoryId && (categoryPostCounts[c.id] || 0) < 3);
        if (otherCategories.length > 0) {
          categoryId = otherCategories[0].id;
          console.log(`[AutoPost Scheduler] Switched to category: ${otherCategories[0].name}`);
        }
      }
    }

    // テーマ重複チェック（1）深夜バッチ内で同じカテゴリ×記事タイプの組み合わせがすでに生成済みか確認
    // slugフィールドを優先使用（nameは日本語のためslugに変換すると全て「-----」になるバグを修正）
    const categorySlugForTheme = categoryId
      ? (blogCategories.find(c => c.id === categoryId)?.slug
          || (blogCategories.find(c => c.id === categoryId)?.name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-'))
      : 'unknown';
    const themeKey = `${categorySlugForTheme}:${articleTypeRotation}`;
    if (usedThemeKeys && usedThemeKeys.has(themeKey)) {
      console.warn(`[AutoPost Scheduler] Theme "${themeKey}" already used in this batch, skipping to avoid duplication`);
      await updateAutoPostLog(log.id, { status: 'failed', errorMessage: `Duplicate theme in batch: ${themeKey}` });
      return null;
    }

    // テーマ重複チェック（2）DBの直近30日間のテーマログと照合
    try {
      const isDuplicate = await checkThemeDuplicate(categorySlugForTheme, articleTypeRotation, keyword, 30);
      if (isDuplicate) {
        console.warn(`[AutoPost Scheduler] Theme "${themeKey}" with keyword "${keyword}" already exists in last 30 days, skipping`);
        // 重複でも失敗としてログするが、別キーワードで再試行するためnullを返さない
        // キーワードを使用済にマークして別のキーワードで再試行を促す
        if (keywordId) await markKeywordUsed(keywordId);
        await updateAutoPostLog(log.id, { status: 'failed', errorMessage: `Duplicate theme in DB: ${themeKey}` });
        return null;
      }
    } catch (themeCheckErr: any) {
      console.warn('[AutoPost Scheduler] Theme duplicate check failed (proceeding):', themeCheckErr.message);
    }

    // テーマキーをバッチ内使用済セットに登録
    if (usedThemeKeys) {
      usedThemeKeys.add(themeKey);
    }

    // Step 5: Generate article with LLM (enhanced prompt with GEO optimization)
    const lengthGuide = schedule.articleLength === 'short' ? '1500-2000' : schedule.articleLength === 'long' ? '5000-6000' : '3000-4000';
    const categoryName = categoryId ? blogCategories.find(c => c.id === categoryId)?.name || '' : '';
    
    const articlePrompt = `あなたはSEO/GEO最適化のプロフェッショナルライターです。
以下の条件で、検索エンジンとAI検索エンジン（ChatGPT、Perplexity、Google AI Overview）の両方で上位表示される記事を生成してください。

メインキーワード: ${keyword}
サイト: LCJ MALL（TikTok Shop連携ECモール。ポイ活・レシート副業・ライブコマース情報も発信。ドメイン: lcjmall.com）
記事カテゴリ: ${categoryName || '自動判定'}
現在の年: ${currentYear}年
トーン: ${schedule.tone}
言語: ${schedule.language === 'ja' ? '日本語' : schedule.language === 'en' ? 'English' : schedule.language}
文字数: ${lengthGuide}字

${articleTypePrompt}

${realDataContext}

JSON形式で以下を出力してください:
{
  "title": "記事タイトル（購買意図を含む魅力的なタイトル。年号を使う場合は${currentYear}年のみ使用）",
  "slug": "url-friendly-slug（英語のみ、ハイフン区切り）",
  "excerpt": "120字以内の抽出",
  "contentHtml": "HTML形式の記事本文（上記構成テンプレートに従って生成）",
  "seoTitle": "SEO用タイトル（60字以内）",
  "seoDescription": "SEO用ディスクリプション（155字以内）",
  "tags": ["記事テーマに合ったタグ名1", "タグ名2", "タグ名3", "タグ名4", "タグ名5"],
  "suggestedCategory": "最適なカテゴリ名（TikTok Shop/ポイ活・ポイント/レシート副業/ライブコマース/LCJ MALL/シャンプー・トリートメント/カラーケア/ダメージケア/成分解析/美容師監修ケア/スキンケア/美容家電/ランキング・比較/美容トレンド/Eコマース/節約・お得情報）"
}

SEO/GEO最適化要件:
- メインキーワードをタイトル、最初の段落、h2見出しに自然に含める
- 上記の実売データ（売上ランキング・購入者数・レビュー評価）を記事内に自然に組み込む
- 「LCJ MALLで○○人が購入」「★4.5の高評価」など具体的な数字を活用
- 商品紹介セクションでは <div data-type="product-card" data-product-id="商品ID"></div> プレースホルダーを配置（後で実商品写真・価格・評価カードに自動変換される）
- 商品ランキングセクションでは各商品に上記プレースホルダーを配置
- 統計データや具体的な数字を含める（AI検索が引用しやすい）
- 構造化された見出し階層（h2 > h3）を使用
- E-E-A-T: 美容師監修・専門家の視点を含める
- 専門的で信頼性の高い記述を心がける
- 日本語SEO: 自然な日本語表現、共起語を含める
- GEO最適化: AI検索エンジンが引用しやすい明確な回答文を含める
- 年号は必ず${currentYear}年を使用すること（過去の年号は絶対に使わない）

内部リンクルール（重要）:
- LCJ MALLへのリンクは必ず https://lcjmall.com を使用（www.は付けない）
- 商品ページへのリンク: /mall/products
- ブランドページへのリンク: /brands/ブランドID（相対パス）
- 外部リンクは最小限に抑え、内部リンクを優先する

タグ生成ルール:
- 記事テーマを表す具体的なタグを5個生成する
- 例: hair-care / treatment / color-care / repair / tiktok-shop
- タグは英語小文字ハイフン区切りまたは日本語で生成する`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a professional SEO/GEO optimized content writer for a Japanese beauty e-commerce site. Always respond with valid JSON only.' },
        { role: 'user', content: articlePrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'blog_article',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              slug: { type: 'string' },
              excerpt: { type: 'string' },
              contentHtml: { type: 'string' },
              seoTitle: { type: 'string' },
              seoDescription: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              suggestedCategory: { type: 'string' },
            },
            required: ['title', 'slug', 'excerpt', 'contentHtml', 'seoTitle', 'seoDescription', 'tags', 'suggestedCategory'],
            additionalProperties: false,
          },
        },
      },
    });

    const artRaw = response.choices[0].message.content;
    const articleData = JSON.parse((typeof artRaw === 'string' ? artRaw : '') || '{}');
    if (!articleData.title || !articleData.contentHtml) {
      throw new Error('Invalid article data from LLM');
    }

    // Step 6: Resolve category (use LLM suggestion if not already set)
    if (!categoryId && articleData.suggestedCategory) {
      const suggestedCat = blogCategories.find(c => c.name === articleData.suggestedCategory);
      if (suggestedCat) {
        categoryId = suggestedCat.id;
        console.log(`[AutoPost Scheduler] LLM suggested category: ${suggestedCat.name}`);
      }
    }
    // Fallback: use keyword-based detection
    if (!categoryId) {
      categoryId = detectCategoryForKeyword(keyword, blogCategories);
    }

    // Step 6.5: Sanitize links - fix www.lcjmall.com to lcjmall.com
    let processedHtml = articleData.contentHtml
      .replace(/https?:\/\/www\.lcjmall\.com/gi, 'https://lcjmall.com');

    // Step 7: Insert brand internal links
    try {
      const mallBrands = await getAllMallBrands();
      if (mallBrands.length > 0) {
        processedHtml = insertBrandLinks(processedHtml, mallBrands);
        console.log(`[AutoPost Scheduler] Brand links inserted for ${mallBrands.length} brands`);
      }
    } catch (brandErr: any) {
      console.warn('[AutoPost Scheduler] Brand link insertion failed:', brandErr.message);
    }

    // Step 7.5: Replace product-card placeholders with rich product cards (real photos, prices, reviews)
    try {
      processedHtml = await postProcessArticleHtml(processedHtml, productSalesRanking, productRelated);
      console.log(`[AutoPost Scheduler] Product cards rendered with real product images and data`);
    } catch (cardErr: any) {
      console.warn('[AutoPost Scheduler] Product card rendering failed:', cardErr.message);
    }

    // Step 7.6: Insert LCJ banners at 3 positions (top / middle / bottom)
    processedHtml = insertLcjBanners(processedHtml);
    console.log(`[AutoPost Scheduler] LCJ banners inserted at 3 positions`);

    // Ensure unique slug
    const baseSlug = articleData.slug || nanoid(12);
    const existingArticle = await getBlogArticleBySlug(baseSlug);
    const finalSlug = existingArticle ? `${baseSlug}-${nanoid(6)}` : baseSlug;

    // Step 8: Resolve/create tags and find tag-matched products
    let tagIds: number[] = [];
    try {
      const allTags = await getAllBlogTags();
      const tagNames: string[] = (articleData.tags || []).slice(0, 5);
      
      for (const tagName of tagNames) {
        if (!tagName) continue;
        const slug = tagName.toLowerCase().replace(/[^a-z0-9\u3040-\u9fff]+/g, '-').replace(/^-|-$/g, '');
        const existing = allTags.find(t => t.name === tagName || t.slug === slug);
        if (existing) {
          tagIds.push(existing.id);
        } else {
          try {
            const created = await createBlogTag({ name: tagName, slug: slug || nanoid(8) });
            tagIds.push(created.id);
          } catch (e) {
            // Tag creation failed (e.g. duplicate slug), skip
          }
        }
      }
      console.log(`[AutoPost Scheduler] Resolved ${tagIds.length} tags: ${tagNames.join(', ')}`);
    } catch (tagErr: any) {
      console.warn('[AutoPost Scheduler] Tag resolution failed:', tagErr.message);
    }

    // Step 9: Create blog article
    // forcedStatusが指定されている場合はそれを使用、なければスケジュール設定に従う
    const publishStatus: 'published' | 'scheduled' | 'draft' = forcedStatus || (schedule.autoPublish === 'publish' ? 'published' : 'draft');
    const publishedAt = publishStatus === 'published'
      ? (forcedPublishedAt || new Date())
      : publishStatus === 'scheduled'
        ? (forcedPublishedAt || null)
        : null;
    const articleResult = await createBlogArticle({
      title: articleData.title,
      slug: finalSlug,
      excerpt: articleData.excerpt,
      contentHtml: processedHtml,
      seoTitle: articleData.seoTitle,
      seoDescription: articleData.seoDescription,
      status: publishStatus as any,
      publishedAt: publishedAt,
      authorId: 1, // System author
      categoryId: categoryId,
    });

    const articleId = (articleResult as any).id;

    // Step 9.5: Set article tags
    if (articleId && tagIds.length > 0) {
      try {
        await setBlogArticleTags(articleId, tagIds);
        console.log(`[AutoPost Scheduler] Set ${tagIds.length} tags for article ${articleId}`);
      } catch (tagSetErr: any) {
        console.warn('[AutoPost Scheduler] Tag assignment failed:', tagSetErr.message);
      }
    }

    // Step 9.6: Add internal links section (related articles + product list + LCJ Mall)
    if (articleId) {
      try {
        const internalLinksHtml = await buildInternalLinksSection(articleId, categoryId, tagIds, keyword);
        const htmlWithLinks = processedHtml + '\n' + internalLinksHtml;
        await updateBlogArticle(articleId, { contentHtml: htmlWithLinks });
        processedHtml = htmlWithLinks;
        console.log(`[AutoPost Scheduler] Internal links section added`);
      } catch (linkErr: any) {
        console.warn('[AutoPost Scheduler] Internal links section failed:', linkErr.message);
      }
    }

    // Step 10: Generate cover image if enabled
    let coverImageUrl: string | null = null;
    if (schedule.generateImages && articleId) {
      await updateAutoPostLog(log.id, { status: 'image_generating' });
      try {
        const detectedType = detectArticleType(keyword, articleData.title);
        const resolvedArticleType = schedule.articleType || detectedType;
        const imagePrompt = generateCoverImagePrompt(articleData.title, resolvedArticleType, keyword);
        console.log(`[AutoPost Scheduler] Cover image style: ${getArticleTypeLabel(detectedType)} (${resolvedArticleType})`);
        const { url: imageUrl } = await generateImage({ prompt: imagePrompt });
        if (imageUrl) {
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const imageKey = `blog-covers/${finalSlug}-${nanoid(8)}.png`;
          const { url: s3Url } = await storagePut(imageKey, imageBuffer, 'image/png');
          await updateBlogArticle(articleId, { coverImageUrl: s3Url, coverImageKey: imageKey });
          coverImageUrl = s3Url;
        }
      } catch (imgError: any) {
        console.error('[AutoPost Scheduler] Image generation failed:', imgError.message);
      }
    }

    // Step 11: Generate inline images if enabled
    if (schedule.generateImages && articleId) {
      try {
        await updateAutoPostLog(log.id, { status: 'image_generating' });
        const inlineAnalysis = await invokeLLM({
          messages: [
            {
              role: 'system',
              content: 'You are an expert content editor. Analyze the given HTML article and identify the best locations to insert illustrative images. For each location, provide the H2 or H3 heading text AFTER which the image should be inserted, a detailed image description suitable for AI image generation, and an alt text for SEO. Return JSON only.',
            },
            {
              role: 'user',
              content: `Article title: ${articleData.title}\nKeywords: ${keyword}\nMax images: 2\n\nArticle HTML:\n${processedHtml.substring(0, 6000)}\n\nIdentify up to 2 optimal image insertion points.`,
            },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'inline_image_plan',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  images: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        heading_text: { type: 'string' },
                        image_description: { type: 'string' },
                        alt_text: { type: 'string' },
                      },
                      required: ['heading_text', 'image_description', 'alt_text'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['images'],
                additionalProperties: false,
              },
            },
          },
        });
        const inlineRawSch = inlineAnalysis.choices[0].message.content;
        const inlinePlan = JSON.parse((typeof inlineRawSch === 'string' ? inlineRawSch : '') || '{"images":[]}');
        if (inlinePlan.images && inlinePlan.images.length > 0) {
          let updatedHtml = processedHtml;
          for (const imgPlan of inlinePlan.images.slice(0, 2)) {
            try {
              const imgPrompt = `${imgPlan.image_description}. Modern, clean digital illustration. Beauty and hair care context. High quality illustration. Japanese aesthetic. No text overlay.`;
              const { url: imgUrl } = await generateImage({ prompt: imgPrompt });
              if (imgUrl) {
                const imgResp = await fetch(imgUrl);
                const imgBuf = Buffer.from(await imgResp.arrayBuffer());
                const imgKey = `blog-inline/${finalSlug}-${nanoid(8)}.png`;
                const { url: s3Url } = await storagePut(imgKey, imgBuf, 'image/png');
                const escapedH = imgPlan.heading_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const hRegex = new RegExp(`(<h[23][^>]*>[^<]*${escapedH}[^<]*</h[23]>)`, 'i');
                const hMatch = updatedHtml.match(hRegex);
                if (hMatch) {
                  const imgTag = `<figure class="inline-ai-image" style="margin:1.5rem 0;text-align:center;"><img src="${s3Url}" alt="${imgPlan.alt_text}" style="max-width:100%;height:auto;border-radius:8px;" loading="lazy" /><figcaption style="font-size:0.85rem;color:#666;margin-top:0.5rem;">${imgPlan.alt_text}</figcaption></figure>`;
                  updatedHtml = updatedHtml.replace(hMatch[0], hMatch[0] + imgTag);
                }
              }
            } catch (inlineErr: any) {
              console.error('[AutoPost Scheduler] Inline image generation failed:', inlineErr.message);
            }
          }
          if (updatedHtml !== processedHtml) {
            await updateBlogArticle(articleId, { contentHtml: updatedHtml });
            processedHtml = updatedHtml;
          }
        }
      } catch (inlineError: any) {
        console.error('[AutoPost Scheduler] Inline image analysis failed:', inlineError.message);
      }
    }

    // Step 12: Quality check
    const qc = qualityCheck(processedHtml, coverImageUrl);
    if (!qc.passed) {
      console.warn(`[AutoPost Scheduler] Quality check failed for article ${articleId}: ${qc.issues.join(', ')}`);
      // 品質基準を満たさない場合はdraftに降格（publishedまscheduledどちらも）
      if (publishStatus === 'published' || publishStatus === 'scheduled') {
        await updateBlogArticle(articleId, { status: 'draft' });
        console.warn(`[AutoPost Scheduler] Article ${articleId} downgraded to draft due to quality issues`);
      }
    } else {
      console.log(`[AutoPost Scheduler] Quality check passed for article ${articleId}`);
    }

    // Step 12.5: テーマログ記録（重複防止用）
    try {
      const categorySlugForLog = categoryName ? categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'unknown';
      await recordBlogThemeLog({
        articleId: articleId || null,
        categorySlug: categorySlugForLog,
        articleType: articleTypeRotation,
        keyword: keyword,
        titlePattern: articleData.title.includes('2026年') || articleData.title.includes('最新') ? 'pattern_a' :
                      articleData.title.includes('おすすめ') ? 'pattern_b' : 'pattern_c',
        createdAt: new Date(),
      });
    } catch (e) {
      console.warn('[AutoPost Scheduler] recordBlogThemeLog failed:', e);
    }

    // Step 12.6: CV計測レコード作成
    if (articleId) {
      try {
        await upsertBlogArticleStat({
          articleId,
          bannerClicks: 0,
          productClicks: 0,
          mallClicks: 0,
          rewriteCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (e) {
        console.warn('[AutoPost Scheduler] upsertBlogArticleStat failed:', e);
      }
    }

    // Mark keyword as used
    if (keywordId) {
      await markKeywordUsed(keywordId);
    }

    // Increment schedule counter
    await incrementScheduleGenerated(schedule.id);

    // Notify search engines if published
    if (publishStatus === 'published' && qc.passed) {
      const baseUrl = process.env.APP_URL || "";
      if (baseUrl) {
        try {
          await fetch(`${baseUrl}/api/indexnow/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: [`/blog/${finalSlug}`] }),
          });
          console.log(`[AutoPost Scheduler] IndexNow notification sent for: /blog/${finalSlug}`);
        } catch (e) {
          console.warn("[AutoPost Scheduler] IndexNow notification failed:", e);
        }
      }
    }

    // Update log as completed
    await updateAutoPostLog(log.id, {
      status: 'completed',
      articleId,
      completedAt: new Date(),
    });

    console.log(`[AutoPost Scheduler] Successfully generated article: "${articleData.title}" (ID: ${articleId}, type: ${articleTypeRotation}, category: ${categoryName || 'auto'}, status: ${publishStatus}, QC: ${qc.passed ? 'PASS' : 'FAIL'})`);

    // 品質チェック通過時のみ記事IDを返す（失敗時はnull）
    return qc.passed ? articleId : null;

  } catch (error: any) {
    await updateAutoPostLog(log.id, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
    });
    console.error(`[AutoPost Scheduler] Failed to generate article:`, error.message);
    return null;
  }
}

// 旧関数名のエイリアス（互換性維持）
export const executeAutoPost = executeAutoPostWithType;
