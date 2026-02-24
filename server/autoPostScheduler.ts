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
 */

import { listAutoPostSchedules, getNextUnusedKeyword, createAutoPostLog, updateAutoPostLog, markKeywordUsed, incrementScheduleGenerated, createBlogArticle, getBlogArticleBySlug, updateBlogArticle, updateAutoPostSchedule, listPresetKeywordsDb, createPresetKeywordDb, getMallProductSalesRanking, getAllMallProductBuyerCounts, getAllProductReviewStats, findRelatedProductsForArticle, getAllBlogCategories, getAllMallBrands, getAllMallCategoryRecords } from "./db";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// Check interval: every 1 hour
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

// ─── Category keyword mapping for auto-assignment ───
const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  'シャンプー・トリートメント': ['シャンプー', 'トリートメント', 'コンディショナー', 'ヘアマスク', '洗髪', 'ヘアウォッシュ'],
  'カラーケア': ['カラー', 'ヘアカラー', '紫シャンプー', 'カラーシャンプー', '染め', 'ブリーチ', 'ハイトーン', 'カラートリートメント'],
  'ダメージケア': ['ダメージ', '修復', 'パサパサ', '枝毛', '切れ毛', 'ケラチン', '補修', 'ヘアオイル'],
  '成分解析': ['成分', '解析', 'アミノ酸', 'ケラチン', 'シリコン', 'パラベン', '界面活性剤', '無添加'],
  '美容師監修ケア': ['美容師', 'サロン', 'プロ', '専売', '監修', 'スタイリスト'],
  'スキンケア': ['スキンケア', '化粧水', '美容液', 'クレンジング', '洗顔', '保湿', 'セラム'],
  '美容家電': ['ドライヤー', 'ヘアアイロン', 'コテ', '美顔器', '美容家電'],
  'TikTok Shop': ['TikTok', 'ティックトック', 'ライブコマース', 'ライブ配信', 'ソーシャルコマース'],
  'ランキング・比較': ['ランキング', '比較', 'おすすめ', '人気', 'ベスト', 'TOP'],
  '美容トレンド': ['トレンド', '最新', '2026', '新作', '話題'],
  'Eコマース': ['EC', 'オンラインショップ', '通販', '越境EC', 'D2C'],
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
        { cat: "shampoo-treatment", desc: "シャンプー・トリートメント おすすめ、比較、ランキング、成分、選び方" },
        { cat: "color-care", desc: "カラーケア、紫シャンプー、カラーシャンプー、ブリーチ後ケア、ハイトーン維持" },
        { cat: "damage-care", desc: "ダメージケア、ケラチントリートメント、髪の修復、パサパサ改善" },
        { cat: "ingredient-analysis", desc: "成分解析、アミノ酸シャンプー、シリコンフリー、無添加" },
        { cat: "professional-care", desc: "美容師おすすめ、サロン専売品、プロ用ヘアケア" },
        { cat: "tiktok-shop", desc: "TikTok Shopでの購入方法、お得な使い方、商品レビュー、TikTok Shop始め方" },
        { cat: "ranking-comparison", desc: "商品ランキング、比較記事、市販vs専売、コスパ比較" },
        { cat: "beauty-trends", desc: "美容トレンド2026、最新ヘアケア、話題の成分、新商品" },
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
                content: `あなたはSEOキーワードリサーチの専門家です。LCJ MALL（美容・ヘアケア商品を扱うECサイト。TikTok Shop連携あり）のための日本語ロングテールSEOキーワードを生成してください。
ルール:
- 3〜6語のロングテールキーワード
- 購買意図が高いキーワードを優先（「おすすめ」「比較」「ランキング」「口コミ」「選び方」）
- 検索ボリュームが見込める実用的なもの
- 「〜とは」「〜やり方」「〜おすすめ」「〜比較」「〜ランキング」「〜口コミ」などのパターンを活用
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
async function runAutoPostCheck() {
  console.log("[AutoPost Scheduler] Running check...");

  try {
    // Auto-replenish keywords if running low
    await autoReplenishKeywords();

    const schedules = await listAutoPostSchedules();
    const enabledSchedules = schedules.filter(s => s.enabled);

    if (enabledSchedules.length === 0) {
      console.log("[AutoPost Scheduler] No enabled schedules found");
      return;
    }

    const now = new Date();

    for (const schedule of enabledSchedules) {
      try {
        // Check if it's time to run this schedule
        const nextRunAt = schedule.nextRunAt ? new Date(schedule.nextRunAt) : null;
        
        if (!nextRunAt || now >= nextRunAt) {
          // Check preferred hour (JST = UTC+9)
          const jstHour = (now.getUTCHours() + 9) % 24;
          if (Math.abs(jstHour - schedule.preferredHour) > 1) {
            // Not within the preferred hour window, skip
            continue;
          }

          console.log(`[AutoPost Scheduler] Executing schedule: ${schedule.name} (ID: ${schedule.id})`);
          await executeAutoPost(schedule);
          
          // Calculate next run time
          const nextRun = new Date(now.getTime() + schedule.intervalDays * 24 * 60 * 60 * 1000);
          nextRun.setUTCHours(schedule.preferredHour - 9, 0, 0, 0); // Set to preferred hour in JST
          if (nextRun.getTime() < 0) nextRun.setUTCHours(nextRun.getUTCHours() + 24);
          
          await updateAutoPostSchedule(schedule.id, { nextRunAt: nextRun });
          console.log(`[AutoPost Scheduler] Next run for "${schedule.name}": ${nextRun.toISOString()}`);
        }
      } catch (scheduleError: any) {
        console.error(`[AutoPost Scheduler] Error executing schedule ${schedule.id}:`, scheduleError.message);
      }
    }
  } catch (error: any) {
    console.error("[AutoPost Scheduler] Error during check:", error.message);
  }
}

/**
 * Execute a single auto-post cycle for a given schedule
 */
async function executeAutoPost(schedule: any) {
  // Create log entry
  const log = await createAutoPostLog({
    scheduleId: schedule.id,
    status: 'pending',
    keyword: null,
  });

  try {
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
      return;
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

    // Step 3: Fetch real EC data to enrich article
    let realDataContext = '';
    try {
      const salesRanking = await getMallProductSalesRanking(10);
      const buyerCounts = await getAllMallProductBuyerCounts();
      const reviewStats = await getAllProductReviewStats();
      const relatedProducts = await findRelatedProductsForArticle(keyword, keyword, 8);

      if (salesRanking.length > 0) {
        realDataContext += `\n\n## LCJ MALL 売上ランキング（実データ）\n`;
        salesRanking.forEach((p: any, i: number) => {
          const buyers = buyerCounts[p.id] || 0;
          const review = reviewStats[p.id];
          const rating = review ? `★${review.avgRating.toFixed(1)}（${review.totalReviews}件）` : '未レビュー';
          realDataContext += `${i + 1}. ${p.name}（¥${p.price}）- 購入者${buyers}人 - ${rating}\n`;
        });
      }

      if (relatedProducts.length > 0) {
        realDataContext += `\n## キーワード「${keyword}」に関連する商品\n`;
        relatedProducts.forEach((p: any) => {
          const buyers = buyerCounts[p.id] || 0;
          const review = reviewStats[p.id];
          const rating = review ? `★${review.avgRating.toFixed(1)}（${review.totalReviews}件）` : '';
          realDataContext += `- ${p.name}（¥${p.price}）${rating} ${buyers > 0 ? `購入者${buyers}人` : ''} [商品ID: ${p.id}]\n`;
        });
      }
    } catch (dataErr: any) {
      console.warn('[AutoPost Scheduler] Failed to fetch EC data:', dataErr.message);
    }

    // Step 4: Generate article with LLM (enhanced prompt with GEO optimization)
    const lengthGuide = schedule.articleLength === 'short' ? '1500-2000' : schedule.articleLength === 'long' ? '5000-6000' : '3000-4000';
    const categoryName = categoryId ? blogCategories.find(c => c.id === categoryId)?.name || '' : '';
    
    const articlePrompt = `あなたはSEO/GEO最適化のプロフェッショナルライターです。
以下の条件で、検索エンジンとAI検索エンジン（ChatGPT、Perplexity、Google AI Overview）の両方で上位表示される記事を生成してください。

メインキーワード: ${keyword}
サイト: LCJ MALL（美容・ヘアケア商品を扱うECサイト。ドメイン: lcjmall.com。TikTok Shop連携あり）
記事カテゴリ: ${categoryName || '自動判定'}
記事タイプ: ${schedule.articleType}
トーン: ${schedule.tone}
言語: ${schedule.language === 'ja' ? '日本語' : schedule.language === 'en' ? 'English' : schedule.language}
文字数: ${lengthGuide}字
${realDataContext}

JSON形式で以下を出力してください:
{
  "title": "記事タイトル（購買意図を含む魅力的なタイトル）",
  "slug": "url-friendly-slug（英語のみ、ハイフン区切り）",
  "excerpt": "120字以内の抽出",
  "contentHtml": "HTML形式の記事本文（h2, h3, p, ul, ol, blockquote, tableタグ使用）",
  "seoTitle": "SEO用タイトル（60字以内）",
  "seoDescription": "SEO用ディスクリプション（155字以内）",
  "tags": ["推奨タグ名1", "推奨タグ名2", "推奨タグ名3"],
  "suggestedCategory": "最適なカテゴリ名（シャンプー・トリートメント/カラーケア/ダメージケア/成分解析/美容師監修ケア/スキンケア/美容家電/TikTok Shop/ランキング・比較/美容トレンド/Eコマース）"
}

SEO/GEO最適化要件:
- メインキーワードをタイトル、最初の段落、h2見出しに自然に含める
- 上記の実売データ（売上ランキング・購入者数・レビュー評価）を記事内に自然に組み込む
- 「LCJ MALLで○○人が購入」「★4.5の高評価」など具体的な数字を活用
- 商品紹介セクションでは商品名と /mall/products/商品ID 形式のリンクを含める
- 統計データや具体的な数字を含める（AI検索が引用しやすい）
- FAQセクションを含める（「よくある質問」形式、3-5個）
- HowToセクションを含める（具体的な手順を番号付きで）
- 比較表を含める（<table>タグで商品を比較）
- 構造化された見出し階層（h2 > h3）を使用
- E-E-A-T: 美容師監修・専門家の視点を含める
- 専門的で信頼性の高い記述を心がける
- 日本語SEO: 自然な日本語表現、共起語を含める
- GEO最適化: AI検索エンジンが引用しやすい明確な回答文を含める`;

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

    // Step 5: Resolve category (use LLM suggestion if not already set)
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

    // Step 6: Insert brand internal links
    let processedHtml = articleData.contentHtml;
    try {
      const mallBrands = await getAllMallBrands();
      if (mallBrands.length > 0) {
        processedHtml = insertBrandLinks(processedHtml, mallBrands);
        console.log(`[AutoPost Scheduler] Brand links inserted for ${mallBrands.length} brands`);
      }
    } catch (brandErr: any) {
      console.warn('[AutoPost Scheduler] Brand link insertion failed:', brandErr.message);
    }

    // Ensure unique slug
    const baseSlug = articleData.slug || nanoid(12);
    const existingArticle = await getBlogArticleBySlug(baseSlug);
    const finalSlug = existingArticle ? `${baseSlug}-${nanoid(6)}` : baseSlug;

    // Step 7: Create blog article
    const publishStatus = schedule.autoPublish === 'publish' ? 'published' : 'draft';
    const articleResult = await createBlogArticle({
      title: articleData.title,
      slug: finalSlug,
      excerpt: articleData.excerpt,
      contentHtml: processedHtml,
      seoTitle: articleData.seoTitle,
      seoDescription: articleData.seoDescription,
      status: publishStatus as any,
      publishedAt: publishStatus === 'published' ? new Date() : null,
      authorId: 1, // System author
      categoryId: categoryId,
    });

    const articleId = (articleResult as any).id;

    // Step 8: Generate cover image if enabled
    if (schedule.generateImages && articleId) {
      await updateAutoPostLog(log.id, { status: 'image_generating' });
      try {
        const imagePrompt = `Professional blog cover image for "${articleData.title}". Modern, clean design with beauty and hair care theme. High quality, vibrant colors. Japanese aesthetic. No text overlay.`;
        const { url: imageUrl } = await generateImage({ prompt: imagePrompt });
        if (imageUrl) {
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const imageKey = `blog-covers/${finalSlug}-${nanoid(8)}.png`;
          const { url: s3Url } = await storagePut(imageKey, imageBuffer, 'image/png');
          await updateBlogArticle(articleId, { coverImageUrl: s3Url, coverImageKey: imageKey });
        }
      } catch (imgError: any) {
        console.error('[AutoPost Scheduler] Image generation failed:', imgError.message);
      }
    }

    // Step 9: Generate inline images if enabled
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
          }
        }
      } catch (inlineError: any) {
        console.error('[AutoPost Scheduler] Inline image analysis failed:', inlineError.message);
      }
    }

    // Mark keyword as used
    if (keywordId) {
      await markKeywordUsed(keywordId);
    }

    // Increment schedule counter
    await incrementScheduleGenerated(schedule.id);

    // Notify search engines if published
    if (publishStatus === 'published') {
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

    console.log(`[AutoPost Scheduler] Successfully generated article: "${articleData.title}" (ID: ${articleId}, category: ${categoryName || 'auto'}, status: ${publishStatus})`);

  } catch (error: any) {
    await updateAutoPostLog(log.id, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
    });
    console.error(`[AutoPost Scheduler] Failed to generate article:`, error.message);
  }
}
