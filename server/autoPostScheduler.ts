/**
 * Auto Post Scheduler
 * 
 * Automatically generates and publishes SEO-optimized blog articles
 * based on configured schedules. Checks every hour if any schedule
 * is due for execution.
 */

import { listAutoPostSchedules, getNextUnusedKeyword, createAutoPostLog, updateAutoPostLog, markKeywordUsed, incrementScheduleGenerated, createBlogArticle, getBlogArticleBySlug, updateBlogArticle, updateAutoPostSchedule, listPresetKeywordsDb, createPresetKeywordDb, getMallProductSalesRanking, getAllMallProductBuyerCounts, getAllProductReviewStats, findRelatedProductsForArticle } from "./db";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// Check interval: every 1 hour
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

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
 */
async function autoReplenishKeywords() {
  try {
    const keywords = await listPresetKeywordsDb();
    const unusedCount = keywords.filter(k => k.usedCount === 0).length;
    const LOW_THRESHOLD = 10;

    if (unusedCount < LOW_THRESHOLD) {
      console.log(`[AutoPost Scheduler] Low keywords (${unusedCount} unused). Auto-generating more...`);
      const existingList = keywords.map(k => k.keyword);

      const categories = [
        { cat: "tiktok-shop", desc: "TikTok Shopでの購入方法、お得な使い方、商品レビュー、TikTok Shop始め方、出品方法、売れ筋商品" },
        { cat: "receipt-side-job", desc: "レシートで副業、レシート買取アプリ、レシートポイ活" },
        { cat: "point-katsu", desc: "ポイ活、ポイント活動、キャッシュバック、ポイント二重取り" },
        { cat: "live-commerce", desc: "ライブコマース、ライブコマーサー、ライブ配信販売" },
        { cat: "lcj-mall", desc: "LCJ MALL、越境EC、海外商品購入、個人輸入" },
        { cat: "money-saving", desc: "節約術、お得情報、クーポン活用、セール攻略" },
      ];

      // Pick 2 random categories to generate for variety
      const shuffled = categories.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 2);

      for (const { cat, desc } of selected) {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `あなたはSEOキーワードリサーチの専門家です。LCJ MALL（TikTok Shopと連携した越境ECモール）のための日本語ロングテールSEOキーワードを生成してください。
ルール: 3〜6語のロングテールキーワード、検索ボリュームが見込める実用的なもの、「〜とは」「〜やり方」「〜おすすめ」「〜比較」などのパターンを活用。`,
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

    // Step 2: Fetch real EC data to enrich article
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
          realDataContext += `- ${p.name}（¥${p.price}）${rating} ${buyers > 0 ? `購入者${buyers}人` : ''}\n`;
        });
      }
    } catch (dataErr: any) {
      console.warn('[AutoPost Scheduler] Failed to fetch EC data:', dataErr.message);
    }

    // Generate article with LLM
    const lengthGuide = schedule.articleLength === 'short' ? '1500-2000' : schedule.articleLength === 'long' ? '5000-6000' : '3000-4000';
    const articlePrompt = `あなたはSEO/GEO最適化のプロフェッショナルライターです。
以下の条件で、検索エンジンとAI検索エンジン（ChatGPT、Perplexity、Google AI Overview）の両方で上位表示される記事を生成してください。

メインキーワード: ${keyword}
サイト: LCJ MALL（美容・ヘアケア商品を扱うECサイト。TikTok Shop連携あり）
記事タイプ: ${schedule.articleType}
トーン: ${schedule.tone}
言語: ${schedule.language === 'ja' ? '日本語' : schedule.language === 'en' ? 'English' : schedule.language}
文字数: ${lengthGuide}字
${realDataContext}

JSON形式で以下を出力してください:
{
  "title": "記事タイトル（購買意図を含む魅力的なタイトル）",
  "slug": "url-friendly-slug",
  "excerpt": "120字以内の抽出",
  "contentHtml": "HTML形式の記事本文（h2, h3, p, ul, ol, blockquoteタグ使用）",
  "seoTitle": "SEO用タイトル（60字以内）",
  "seoDescription": "SEO用ディスクリプション（155字以内）",
  "tags": ["推奨タグ名1", "推奨タグ名2"]
}

SEO/GEO最適化要件:
- メインキーワードをタイトル、最初の段落、h2見出しに自然に含める
- 上記の実売データ（売上ランキング・購入者数・レビュー評価）を記事内に自然に組み込む
- 「LCJ MALLで○○人が購入」「★4.5の高評価」など具体的な数字を活用
- 商品紹介セクションでは <div data-type="product-card" data-product-id="PRODUCT_ID"></div> プレースホルダーを配置
- 統計データや具体的な数字を含める（AI検索が引用しやすい）
- FAQセクションを含める（「よくある質問」形式、3-5個）
- HowToセクションを含める（具体的な手順を番号付きで）
- 比較表を含める（Markdown表形式で商品を比較）
- 内部リンクとして /mall/products/ID 形式のリンクを含める
- 構造化された見出し階層（h2 > h3）を使用
- E-E-A-T: 美容師監修・専門家の視点を含める
- 専門的で信頼性の高い記述を心がける`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a professional SEO/GEO optimized content writer. Always respond with valid JSON only.' },
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
            },
            required: ['title', 'slug', 'excerpt', 'contentHtml', 'seoTitle', 'seoDescription', 'tags'],
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

    // Ensure unique slug
    const baseSlug = articleData.slug || nanoid(12);
    const existingArticle = await getBlogArticleBySlug(baseSlug);
    const finalSlug = existingArticle ? `${baseSlug}-${nanoid(6)}` : baseSlug;

    // Step 3: Create blog article
    const publishStatus = schedule.autoPublish === 'publish' ? 'published' : 'draft';
    const articleResult = await createBlogArticle({
      title: articleData.title,
      slug: finalSlug,
      excerpt: articleData.excerpt,
      contentHtml: articleData.contentHtml,
      seoTitle: articleData.seoTitle,
      seoDescription: articleData.seoDescription,
      status: publishStatus as any,
      publishedAt: publishStatus === 'published' ? new Date() : null,
      authorId: 1, // System author
      categoryId: schedule.categoryId,
    });

    const articleId = (articleResult as any).id || (articleResult as any)[0]?.insertId || (articleResult as any).insertId;

    // Step 4: Generate cover image if enabled
    if (schedule.generateImages && articleId) {
      await updateAutoPostLog(log.id, { status: 'image_generating' });
      try {
        const imagePrompt = `Professional blog cover image for "${articleData.title}". Modern, clean design with TikTok Shop and e-commerce theme. High quality, vibrant colors. No text overlay.`;
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

    // Step 5: Generate inline images if enabled
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
              content: `Article title: ${articleData.title}\nKeywords: ${keyword}\nMax images: 2\n\nArticle HTML:\n${articleData.contentHtml.substring(0, 6000)}\n\nIdentify up to 2 optimal image insertion points.`,
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
          let updatedHtml = articleData.contentHtml;
          for (const imgPlan of inlinePlan.images.slice(0, 2)) {
            try {
              const imgPrompt = `${imgPlan.image_description}. Modern, clean digital illustration with subtle gradients. E-commerce and TikTok Shop context. High quality illustration. No text overlay.`;
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
                  const imgTag = `<figure class="inline-ai-image" style="margin:1.5rem 0;text-align:center;"><img src="${s3Url}" alt="${imgPlan.alt_text}" style="max-width:100%;height:auto;border-radius:8px;" /><figcaption style="font-size:0.85rem;color:#666;margin-top:0.5rem;">${imgPlan.alt_text}</figcaption></figure>`;
                  updatedHtml = updatedHtml.replace(hMatch[0], hMatch[0] + imgTag);
                }
              }
            } catch (inlineErr: any) {
              console.error('[AutoPost Scheduler] Inline image generation failed:', inlineErr.message);
            }
          }
          if (updatedHtml !== articleData.contentHtml) {
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

    console.log(`[AutoPost Scheduler] Successfully generated article: "${articleData.title}" (ID: ${articleId}, status: ${publishStatus})`);

  } catch (error: any) {
    await updateAutoPostLog(log.id, {
      status: 'failed',
      errorMessage: error.message || 'Unknown error',
    });
    console.error(`[AutoPost Scheduler] Failed to generate article:`, error.message);
  }
}
