/**
 * Blog & Auto Post Router
 *
 * ブログ管理・自動投稿スケジューラーのルーター。
 * routers.tsから分離して独立管理。
 *
 * 【重要】このファイルはrouters.tsから分離されたルーターです。
 * routers.tsでは `blog: blogRouter` と `autoPost: autoPostRouter` として参照されます。
 */
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { generateCoverImagePrompt, detectArticleType, getArticleTypeLabel } from "./coverImageStyles";
import { detectCategoryForKeyword, insertBrandLinks } from "./autoPostScheduler";
import { buildProductDataForLLMPrompt, postProcessArticleHtml, type ProductCardData } from "./productCardRenderer";
import { TRPCError } from "@trpc/server";
import {
  createBlogCategory,
  getAllBlogCategories,
  updateBlogCategory,
  deleteBlogCategory,
  createBlogTag,
  getAllBlogTags,
  deleteBlogTag,
  createBlogArticle,
  getBlogArticleById,
  getBlogArticleBySlug,
  listBlogArticles,
  updateBlogArticle,
  deleteBlogArticle,
  setBlogArticleTags,
  getBlogArticleTagIds,
  searchMallProductsForBlog,
  findRelatedProductsForArticle,
  getRelatedBlogArticles,
  getMallProductSalesRanking,
  getMallProductRankingByCategory,
  getMallProductsByBrand,
  getBlogCategoryArticleCounts,
  getBlogTagArticleCounts,
  getProductDataForBlogArticle,
  getAllMallProductBuyerCounts,
  getAllProductReviewStats,
  getAllMallBrands,
  listAutoPostSchedules,
  getAutoPostScheduleById,
  createAutoPostSchedule,
  updateAutoPostSchedule,
  deleteAutoPostSchedule,
  incrementScheduleGenerated,
  listPresetKeywordsDb,
  getNextUnusedKeyword,
  markKeywordUsed,
  createPresetKeywordDb,
  deletePresetKeywordDb,
  resetAllKeywordsUsage,
  listAutoPostLogs,
  createAutoPostLog,
  updateAutoPostLog,
  getStuckAutoPostLogs,
} from "./db";

export const blogRouter = router({
  // --- Categories ---
  listCategories: publicProcedure.query(async () => {
    return await getAllBlogCategories();
  }),

  createCategory: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return await createBlogCategory(input);
    }),

  updateCategory: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateBlogCategory(id, data);
      return { success: true };
    }),

  deleteCategory: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteBlogCategory(input.id);
      return { success: true };
    }),

  // --- Tags ---
  listTags: publicProcedure.query(async () => {
    return await getAllBlogTags();
  }),

  createTag: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      return await createBlogTag(input);
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteBlogTag(input.id);
      return { success: true };
    }),

  // --- Articles ---
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "published", "scheduled"]).optional(),
      categoryId: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await listBlogArticles(input || {});
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const article = await getBlogArticleById(input.id);
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "Article not found" });
      const tagIds = await getBlogArticleTagIds(input.id);
      return { ...article, tagIds };
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const article = await getBlogArticleBySlug(input.slug);
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "Article not found" });
      // Increment view count
      await updateBlogArticle(article.id, { viewCount: article.viewCount + 1 });
      const tagIds = await getBlogArticleTagIds(article.id);
      return { ...article, tagIds };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      slug: z.string().min(1),
      excerpt: z.string().optional(),
      content: z.any().optional(), // Tiptap JSON
      contentHtml: z.string().optional(),
      coverImageUrl: z.string().optional(),
      coverImageKey: z.string().optional(),
      categoryId: z.number().optional(),
      status: z.enum(["draft", "published", "scheduled"]).optional(),
      publishedAt: z.string().optional(), // ISO date string
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      ogImageUrl: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { tagIds, publishedAt, ...data } = input;
      const article = await createBlogArticle({
        ...data,
        authorId: ctx.user.id,
        publishedAt: publishedAt ? new Date(publishedAt) : (data.status === "published" ? new Date() : undefined),
      });
      if (tagIds && tagIds.length > 0) {
        await setBlogArticleTags(article.id, tagIds);
      }
      // Auto-trigger IndexNow when article is created as published
      if (data.status === "published" && article.slug) {
        const baseUrl = process.env.APP_URL || "";
        if (baseUrl) {
          const articleUrl = `${baseUrl}/blog/${article.slug}`;
          try {
            await fetch(`${baseUrl}/api/indexnow/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls: [articleUrl], trigger: "auto_create" }),
            });
            console.log(`[SEO] IndexNow auto-triggered on create for: ${articleUrl}`);
          } catch (e) {
            console.warn("[SEO] IndexNow auto-trigger failed on create:", e);
          }
        }
      }
      return article;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      excerpt: z.string().optional(),
      content: z.any().optional(),
      contentHtml: z.string().optional(),
      coverImageUrl: z.string().optional(),
      coverImageKey: z.string().optional(),
      categoryId: z.number().nullable().optional(),
      status: z.enum(["draft", "published", "scheduled"]).optional(),
      publishedAt: z.string().nullable().optional(),
      seoTitle: z.string().optional(),
      seoDescription: z.string().optional(),
      ogImageUrl: z.string().optional(),
      tagIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, tagIds, publishedAt, ...data } = input;
      const updateData: any = { ...data };
      if (publishedAt !== undefined) {
        updateData.publishedAt = publishedAt ? new Date(publishedAt) : null;
      }
      // If publishing for the first time, set publishedAt
      if (data.status === "published" && !publishedAt) {
        const existing = await getBlogArticleById(id);
        if (existing && !existing.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }
      await updateBlogArticle(id, updateData);
      if (tagIds !== undefined) {
        await setBlogArticleTags(id, tagIds);
      }
      // Auto-trigger IndexNow when article status changes to published
      if (data.status === "published") {
        const article = await getBlogArticleById(id);
        if (article?.slug) {
          const baseUrl = process.env.APP_URL || "";
          if (baseUrl) {
            const articleUrl = `${baseUrl}/blog/${article.slug}`;
            try {
              await fetch(`${baseUrl}/api/indexnow/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: [articleUrl], trigger: "auto_update" }),
              });
              console.log(`[SEO] IndexNow auto-triggered on update for: ${articleUrl}`);
            } catch (e) {
              console.warn("[SEO] IndexNow auto-trigger failed on update:", e);
            }
          }
        }
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteBlogArticle(input.id);
      return { success: true };
    }),

  // --- Publish/Unpublish ---
  togglePublish: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const article = await getBlogArticleById(input.id);
      if (!article) throw new TRPCError({ code: "NOT_FOUND" });
      const newStatus = article.status === "published" ? "draft" : "published";
      const updateData: any = { status: newStatus };
      if (newStatus === "published" && !article.publishedAt) {
        updateData.publishedAt = new Date();
      }
      await updateBlogArticle(input.id, updateData);

      // Notify search engines when article is published
      if (newStatus === "published" && article.slug) {
        const baseUrl = process.env.APP_URL || "";
        if (baseUrl) {
          const articleUrl = `${baseUrl}/blog/${article.slug}`;
          try {
            await fetch(`${baseUrl}/api/indexnow/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ urls: [articleUrl], trigger: "auto_publish" }),
            });
            console.log(`[SEO] IndexNow notification sent for: ${articleUrl}`);
          } catch (e) {
            console.warn("[SEO] IndexNow notification failed:", e);
          }
        }
      }

      return { status: newStatus };
    }),

  // --- Product search for embedding ---
  searchProducts: protectedProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return await searchMallProductsForBlog(input.query, input.limit || 10);
    }),

  // --- Cover image upload ---
  uploadCoverImage: protectedProcedure
    .input(z.object({
      fileName: z.string(),
      mimeType: z.string(),
      base64Data: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const ext = input.fileName.split(".").pop() || "jpg";
      const fileKey = `blog-covers/${Date.now()}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      return { url, key: fileKey };
    }),

  // --- Public: list published articles (for blog front page) ---
  listPublished: publicProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await listBlogArticles({ status: "published", ...input });
    }),

  // --- EC統合型SEOブログ API ---

  // 商品売上ランキング（記事内埋め込み用）
  productRanking: publicProcedure
    .input(z.object({
      categoryId: z.number().optional(),
      limit: z.number().default(10),
    }).optional())
    .query(async ({ input }) => {
      if (input?.categoryId) {
        return await getMallProductRankingByCategory(input.categoryId, input?.limit || 10);
      }
      return await getMallProductSalesRanking(input?.limit || 10);
    }),

  // ブランド別商品一覧
  productsByBrand: publicProcedure
    .input(z.object({ brandId: z.number(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return await getMallProductsByBrand(input.brandId, input.limit);
    }),

  // 記事に関連する商品を自動検索
  relatedProducts: publicProcedure
    .input(z.object({ articleId: z.number() }))
    .query(async ({ input }) => {
      const article = await getBlogArticleById(input.articleId);
      if (!article) return [];
      return await findRelatedProductsForArticle(
        article.title,
        article.contentHtml || '',
        6
      );
    }),

  // 関連記事を取得
  relatedArticles: publicProcedure
    .input(z.object({ articleId: z.number(), slug: z.string().optional() }))
    .query(async ({ input }) => {
      const article = await getBlogArticleById(input.articleId);
      if (!article) return [];
      const tagIds = await getBlogArticleTagIds(input.articleId);
      return await getRelatedBlogArticles(input.articleId, article.categoryId, tagIds, 5);
    }),

  // カテゴリハブ（カテゴリ一覧 + 記事数）
  categoryHub: publicProcedure.query(async () => {
    const categories = await getAllBlogCategories();
    const counts = await getBlogCategoryArticleCounts();
    return categories.map(c => ({
      ...c,
      articleCount: counts[c.id] || 0,
    }));
  }),

  // タグハブ（タグ一覧 + 記事数）
  tagHub: publicProcedure.query(async () => {
    const tags = await getAllBlogTags();
    const counts = await getBlogTagArticleCounts();
    return tags.map(t => ({
      ...t,
      articleCount: counts[t.id] || 0,
    }));
  }),

  // 商品データ一括取得（記事内商品カード用：レビュー統計 + 購入者数付き）
  productCards: publicProcedure
    .input(z.object({ productIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      return await getProductDataForBlogArticle(input.productIds);
    }),

  // 記事詳細拡張版（関連商品・関連記事・構造化データ付き）
  getBySlugEnriched: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const article = await getBlogArticleBySlug(input.slug);
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "Article not found" });
      
      // Increment view count
      await updateBlogArticle(article.id, { viewCount: article.viewCount + 1 });
      const tagIds = await getBlogArticleTagIds(article.id);
      
      // 関連商品を自動検索
      const relatedProducts = await findRelatedProductsForArticle(
        article.title,
        article.contentHtml || '',
        6
      );
      
      // 関連商品のレビュー統計と購入者数
      const productIds = relatedProducts.map((p: any) => p.id);
      let productReviewStats: Record<number, { avgRating: number; totalReviews: number }> = {};
      let buyerCounts: Record<number, number> = {};
      if (productIds.length > 0) {
        productReviewStats = await getAllProductReviewStats();
        buyerCounts = await getAllMallProductBuyerCounts();
      }
      
      const enrichedProducts = relatedProducts.map((p: any) => ({
        ...p,
        avgRating: productReviewStats[p.id]?.avgRating || 0,
        totalReviews: productReviewStats[p.id]?.totalReviews || 0,
        buyerCount: buyerCounts[p.id] || 0,
      }));
      
      // 関連記事
      const relatedArticles = await getRelatedBlogArticles(article.id, article.categoryId, tagIds, 5);
      
      // 売上ランキング（トップ5）
      const salesRanking = await getMallProductSalesRanking(5);
      
      return {
        ...article,
        tagIds,
        relatedProducts: enrichedProducts,
        relatedArticles,
        salesRanking,
      };
    }),

  // タグ別記事一覧
  listByTag: publicProcedure
    .input(z.object({
      tagId: z.number(),
      limit: z.number().default(12),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await import('./db').then(m => m.getDb());
      if (!db) return { articles: [], total: 0 };
      const { blogArticles, blogArticleTags } = await import('../drizzle/schema');
      const { eq, and, desc, sql, inArray } = await import('drizzle-orm');
      
      // 該当タグの記事IDを取得
      const tagArticles = await db
        .select({ articleId: blogArticleTags.articleId })
        .from(blogArticleTags)
        .where(eq(blogArticleTags.tagId, input.tagId));
      
      const articleIds = tagArticles.map(a => a.articleId);
      if (articleIds.length === 0) return { articles: [], total: 0 };
      
      const articles = await db
        .select()
        .from(blogArticles)
        .where(and(
          eq(blogArticles.status, 'published'),
          inArray(blogArticles.id, articleIds)
        ))
        .orderBy(desc(blogArticles.publishedAt))
        .limit(input.limit)
        .offset(input.offset);
      
      return { articles, total: articleIds.length };
    }),

  // --- Brand Page Endpoints ---
  brandList: publicProcedure
    .query(async () => {
      const { getActiveMallBrandsWithStats } = await import('./db');
      return await getActiveMallBrandsWithStats();
    }),

  brandDetail: publicProcedure
    .input(z.object({ brandId: z.number() }))
    .query(async ({ input }) => {
      const { getMallBrandById, getMallProductsByBrand, getBlogArticlesByBrand, getMallBrandReviews } = await import('./db');
      const brand = await getMallBrandById(input.brandId);
      if (!brand) return null;
      const [products, articles, reviews] = await Promise.all([
        getMallProductsByBrand(input.brandId, 50),
        getBlogArticlesByBrand(input.brandId, 10),
        getMallBrandReviews(input.brandId, 20),
      ]);
      return { brand, products, articles, reviews };
    }),

  // --- AI Article Generation (SEO/GEO Optimized) ---
  generateArticle: protectedProcedure
    .input(z.object({
      topic: z.string().min(1).describe("記事のテーマ・トピック"),
      keywords: z.array(z.string()).min(1).describe("ターゲットキーワード"),
      language: z.enum(["ja", "en", "zh"]).default("ja"),
      tone: z.enum(["professional", "casual", "friendly", "authoritative"]).default("professional"),
      articleType: z.enum(["guide", "review", "comparison", "news", "howto", "listicle"]).default("guide"),
      includeProductRecommendations: z.boolean().default(false),
      targetLength: z.enum(["short", "medium", "long"]).default("medium"),
    }))
    .mutation(async ({ input }) => {
      const lengthGuide = {
        short: "1500-2000文字",
        medium: "3000-4000文字",
        long: "5000-7000文字",
      };

      const articleTypeGuide: Record<string, string> = {
        guide: "包括的なガイド記事。読者が知りたいことを網羅的にカバーし、ステップバイステップで説明する",
        review: "レビュー記事。実際の使用感や評価を詳しく伝え、メリット・デメリットを公平に紹介する",
        comparison: "比較記事。複数の選択肢を表形式で比較し、読者が最適な選択をできるよう支援する",
        news: "ニュース・トレンド記事。最新の動向を伝え、業界への影響を分析する",
        howto: "ハウツー記事。具体的な手順を番号付きで示し、初心者でも実践できるよう丁寧に解説する",
        listicle: "リスト記事。おすすめアイテムやポイントを番号付きで紹介し、各項目を詳しく解説する",
      };

      const langInstruction = input.language === "ja" 
        ? "日本語で記事を書いてください。" 
        : input.language === "zh" 
          ? "请用中文撰写文章。" 
          : "Write the article in English.";

      // Fetch real EC data for enrichment
      let realDataSection = '';
      try {
        const salesRanking = await getMallProductSalesRanking(10);
        const buyerCounts = await getAllMallProductBuyerCounts();
        const reviewStats = await getAllProductReviewStats();
        const relatedProducts = await findRelatedProductsForArticle(
          input.topic,
          input.keywords.join(' '),
          8
        );

        if (salesRanking.length > 0) {
          realDataSection += `\n\n## LCJ MALL 売上ランキング（実データ）\n`;
          salesRanking.forEach((p: any, i: number) => {
            const buyers = buyerCounts[p.id] || 0;
            const review = reviewStats[p.id];
            const rating = review ? `★${review.avgRating.toFixed(1)}（${review.totalReviews}件）` : '未レビュー';
            realDataSection += `${i + 1}. ${p.name}（¥${p.price}）- 購入者${buyers}人 - ${rating} [ID:${p.id}]\n`;
          });
        }

        if (relatedProducts.length > 0) {
          realDataSection += `\n## キーワードに関連する商品\n`;
          relatedProducts.forEach((p: any) => {
            const buyers = buyerCounts[p.id] || 0;
            const review = reviewStats[p.id];
            const rating = review ? `★${review.avgRating.toFixed(1)}（${review.totalReviews}件）` : '';
            realDataSection += `- ${p.name}（¥${p.price}）${rating} ${buyers > 0 ? `購入者${buyers}人` : ''} [ID:${p.id}]\n`;
          });
        }
      } catch (dataErr: any) {
        console.warn('[triggerNow] Failed to fetch EC data:', dataErr);
      }

      const currentYear = new Date().getFullYear();
      const systemPrompt = `あなたはSEO/GEO（Generative Engine Optimization）に精通したプロのコンテンツライターです。
LCJ MALL（TikTok Shop連携ECモール。ポイ活・レシート副業・ライブコマース情報も発信。ドメイン: lcjmall.com）の専属ライターとして、検索エンジンとAI検索エンジン（ChatGPT、Perplexity、Google AI Overview）の両方で上位表示・引用される記事を生成してください。

## SEO/GEO最適化ルール
1. **見出し階層**: H2→H3→H4の論理的な階層構造を使用。各H2セクションは独立した回答として機能
2. **冒頭の直接回答**: 記事冒頭で検索意図に対する直接的な回答を提供
3. **リアルデータ活用**: LCJ MALLの実売データ（購入者数・レビュー評価・売上ランキング）を自然に組み込む
4. **FAQ形式**: 記事末尾に関連FAQを3-5個含める
5. **比較表**: HTML表形式で商品を比較
6. **引用可能な文章**: 定義文や要約文は簡潔で正確に
7. **E-E-A-T**: 美容師監修・専門家の視点を含める
8. **商品カード**: 商品紹介箇所に <div data-type="product-card" data-product-id="PRODUCT_ID"></div> を配置（[ID:XX]のXXを使用）
9. **内部リンク**: /mall/products/ID 形式のリンクを含める
10. **最新情報**: ${currentYear}年の最新トレンドを反映。年号は必ず${currentYear}年を使用すること（過去の年号は絶対に使わない）
11. **リンクルール**: LCJ MALLへのリンクは必ず https://lcjmall.com を使用（www.は付けない）。外部リンクは最小限に抑える

## 出力形式
記事本文をTiptap互換のHTML形式で出力。以下のタグを使用：
- <h2>, <h3>, <h4> — 見出し
- <p> — 段落
- <ul><li>, <ol><li> — リスト
- <strong>, <em> — 強調
- <blockquote> — 引用
- <table><thead><tr><th>...<tbody><tr><td>... — 表
- <a href=""> — リンク
- <div data-type="product-card" data-product-id="ID"></div> — 商品カード

${langInstruction}`;

      const userPrompt = `## 記事生成リクエスト

**テーマ**: ${input.topic}
**ターゲットキーワード**: ${input.keywords.join(", ")}
**記事タイプ**: ${articleTypeGuide[input.articleType]}
**トーン**: ${input.tone}
**目標文字数**: ${lengthGuide[input.targetLength]}
**商品紹介を含める**: ${input.includeProductRecommendations ? "はい（適切な箇所に商品カードプレースホルダーを配置）" : "いいえ"}
${realDataSection}

以下の構造で記事を生成してください：
1. 導入文（検索意図への直接回答を含む）
2. 本文（H2/H3で構造化、各セクション300-500文字）
3. 商品ランキング・比較セクション（実データを活用）
4. FAQ（3-5個のQ&A）
5. まとめ

記事本文のHTMLのみを出力してください。メタ情報は含めないでください。`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const generatedHtml = String(response.choices?.[0]?.message?.content || "");

      // Clean up the response - remove markdown code fences if present
      const cleanHtml = generatedHtml
        .replace(/^```html\n?/i, "")
        .replace(/^```\n?/, "")
        .replace(/\n?```$/,  "")
        .trim();

      // Step 2: Generate title + SEO meta + category/tag suggestions in one LLM call
      const allCategories = await getAllBlogCategories();
      const allTags = await getAllBlogTags();
      const categoryList = allCategories.map((c: any) => `${c.id}:${c.name}`).join(", ");
      const tagList = allTags.map((t: any) => `${t.id}:${t.name}`).join(", ");

      const metaResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `あなたはSEO/GEO最適化の専門家です。記事のトピックと本文から、以下の全メタ情報を一括で生成してください。

既存カテゴリ一覧: [${categoryList || "なし"}]
既存タグ一覧: [${tagList || "なし"}]

出力はJSON形式で以下のフィールドを含めてください：
- title: 記事タイトル（魅力的でSEO最適化、40-60文字）
- seoTitle: SEO最適化されたtitleタグ（60文字以内、主要キーワード含む）
- seoDescription: メタディスクリプション（120文字以内、検索意図への回答含む）
- slug: URL用スラッグ（英数字とハイフンのみ、キーワード含む）
- excerpt: 記事の要約（200文字以内、一覧表示用）
- suggestedCategoryId: 既存カテゴリから最適なもののID（数値）。該当なしなら0
- suggestedCategoryName: 既存カテゴリに該当がない場合の新規カテゴリ名提案（該当ありなら空文字）
- suggestedTagIds: 既存タグから関連するもののID配列（数値の配列）
- suggestedNewTags: 既存タグにない場合の新規タグ名提案（文字列の配列、最大3個）`,
          },
          {
            role: "user",
            content: `トピック: ${input.topic}\nキーワード: ${input.keywords.join(", ")}\n記事タイプ: ${input.articleType}\n\n記事本文（冒頭3000文字）:\n${cleanHtml.substring(0, 3000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "article_full_meta",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "記事タイトル" },
                seoTitle: { type: "string", description: "SEOタイトル" },
                seoDescription: { type: "string", description: "メタディスクリプション" },
                slug: { type: "string", description: "URLスラッグ" },
                excerpt: { type: "string", description: "記事要約" },
                suggestedCategoryId: { type: "number", description: "既存カテゴリID（0=該当なし）" },
                suggestedCategoryName: { type: "string", description: "新規カテゴリ名提案" },
                suggestedTagIds: { type: "array", items: { type: "number" }, description: "既存タグID配列" },
                suggestedNewTags: { type: "array", items: { type: "string" }, description: "新規タグ名提案" },
              },
              required: ["title", "seoTitle", "seoDescription", "slug", "excerpt", "suggestedCategoryId", "suggestedCategoryName", "suggestedTagIds", "suggestedNewTags"],
              additionalProperties: false,
            },
          },
        },
      });

      let meta = {
        title: input.topic,
        seoTitle: input.topic,
        seoDescription: "",
        slug: input.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        excerpt: "",
        suggestedCategoryId: 0,
        suggestedCategoryName: "",
        suggestedTagIds: [] as number[],
        suggestedNewTags: [] as string[],
      };
      try {
        const metaContent = String(metaResponse.choices?.[0]?.message?.content || "{}");
        meta = { ...meta, ...JSON.parse(metaContent) };
      } catch {
        // Use defaults if parsing fails
      }

      return {
        html: cleanHtml,
        keywords: input.keywords,
        topic: input.topic,
        ...meta,
      };
    }),

  // --- AI SEO Meta Generation ---
  generateSeoMeta: protectedProcedure
    .input(z.object({
      title: z.string(),
      content: z.string().describe("記事本文（HTMLまたはプレーンテキスト）"),
      keywords: z.array(z.string()).optional(),
      language: z.enum(["ja", "en", "zh"]).default("ja"),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `あなたはSEO/GEO最適化の専門家です。記事のタイトルと本文から、検索エンジンとAI検索エンジンの両方に最適化されたメタ情報を生成してください。

出力はJSON形式で、以下のフィールドを含めてください：
- seoTitle: SEO最適化されたタイトル（60文字以内、主要キーワード含む）
- seoDescription: メタディスクリプション（120文字以内、検索意図への回答を含む）
- slug: URL用スラッグ（英数字とハイフンのみ、キーワード含む）
- excerpt: 記事の要約（200文字以内）
- faqItems: FAQ構造化データ用のQ&Aペア（3-5個）。各項目は{question, answer}形式
- suggestedTags: 推奨タグ（3-5個）`,
          },
          {
            role: "user",
            content: `記事タイトル: ${input.title}\n\nターゲットキーワード: ${input.keywords?.join(", ") || "なし"}\n\n記事本文:\n${input.content.substring(0, 3000)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "seo_meta",
            strict: true,
            schema: {
              type: "object",
              properties: {
                seoTitle: { type: "string", description: "SEO最適化タイトル" },
                seoDescription: { type: "string", description: "メタディスクリプション" },
                slug: { type: "string", description: "URL用スラッグ" },
                excerpt: { type: "string", description: "記事要約" },
                faqItems: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      answer: { type: "string" },
                    },
                    required: ["question", "answer"],
                    additionalProperties: false,
                  },
                  description: "FAQ項目",
                },
                suggestedTags: {
                  type: "array",
                  items: { type: "string" },
                  description: "推奨タグ",
                },
              },
              required: ["seoTitle", "seoDescription", "slug", "excerpt", "faqItems", "suggestedTags"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = String(response.choices?.[0]?.message?.content || "{}");
      try {
        return JSON.parse(content);
      } catch {
        return {
          seoTitle: input.title,
          seoDescription: "",
          slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          excerpt: "",
          faqItems: [],
          suggestedTags: [],
        };
      }
    }),

  // --- AI Keyword Suggestions ---
  suggestKeywords: protectedProcedure
    .input(z.object({
      topic: z.string().min(1),
      language: z.enum(["ja", "en", "zh"]).default("ja"),
    }))
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `あなたはSEOキーワードリサーチの専門家です。指定されたトピックに関連する、検索ボリュームが高く競合が少ないキーワードを提案してください。

TikTok Shop、ECモール、ライブコマース関連のキーワードに特に精通しています。

出力はJSON形式で、以下のフィールドを含めてください：
- keywords: キーワードの配列。各項目は{keyword, searchIntent, difficulty, category}形式
  - keyword: キーワード文字列
  - searchIntent: 検索意図（informational, transactional, navigational, commercial）
  - difficulty: 競合度（low, medium, high）
  - category: カテゴリ（primary, secondary, longtail）`,
          },
          {
            role: "user",
            content: `トピック: ${input.topic}\n言語: ${input.language === "ja" ? "日本語" : input.language === "zh" ? "中国語" : "英語"}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "keyword_suggestions",
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
                      searchIntent: { type: "string" },
                      difficulty: { type: "string" },
                      category: { type: "string" },
                    },
                    required: ["keyword", "searchIntent", "difficulty", "category"],
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

      const content = String(response.choices?.[0]?.message?.content || '{"keywords":[]}');
      try {
        return JSON.parse(content);
      } catch {
        return { keywords: [] };
      }
    }),

  // --- AI Cover Image Generation ---
  generateCoverImage: protectedProcedure
    .input(z.object({
      title: z.string().min(1).describe("記事タイトル"),
      keywords: z.array(z.string()).optional(),
      style: z.enum(["modern", "minimal", "vibrant", "professional", "creative"]).default("modern"),
      articleType: z.enum(["guide", "review", "comparison", "news", "howto", "listicle", "ranking", "ingredient_analysis", "auto"]).default("auto").describe("記事タイプ（autoで自動検出）"),
      articleId: z.number().optional().describe("既存記事IDに紐付ける場合"),
    }))
    .mutation(async ({ input }) => {
      // Use article-type-specific prompt if articleType is set, otherwise fall back to style-based
      let imagePrompt: string;
      if (input.articleType && input.articleType !== 'auto') {
        imagePrompt = generateCoverImagePrompt(input.title, input.articleType, input.keywords?.[0]);
      } else {
        // Auto-detect from title and keywords
        const autoType = detectArticleType(input.keywords?.[0] || '', input.title);
        imagePrompt = generateCoverImagePrompt(input.title, autoType, input.keywords?.[0]);
        console.log(`[generateCoverImage] Auto-detected type: ${getArticleTypeLabel(autoType)}`);
      }

      try {
        const { url: imageUrl } = await generateImage({ prompt: imagePrompt });
        if (!imageUrl) {
          throw new Error("Image generation returned no URL");
        }

        // Download and re-upload to S3 with proper key
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const imageKey = `blog-covers/ai-${nanoid(12)}.png`;
        const { url: s3Url } = await storagePut(imageKey, imageBuffer, "image/png");

        // If articleId provided, update the article directly
        if (input.articleId) {
          await updateBlogArticle(input.articleId, {
            coverImageUrl: s3Url,
            coverImageKey: imageKey,
          });
        }

        return {
          success: true,
          url: s3Url,
          key: imageKey,
          prompt: imagePrompt,
        };
      } catch (error: any) {
        console.error("Cover image generation failed:", error.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `画像生成に失敗しました: ${error.message}`,
        });
      }
    }),

  // --- Generate Inline Images for Article Body ---
  generateInlineImages: protectedProcedure
    .input(z.object({
      contentHtml: z.string().min(1).describe("記事本文HTML"),
      title: z.string().min(1).describe("記事タイトル"),
      keywords: z.array(z.string()).optional(),
      maxImages: z.number().min(1).max(10).default(3),
      style: z.enum(["modern", "minimal", "vibrant", "professional", "creative"]).default("modern"),
      articleId: z.number().optional().describe("既存記事IDに紐付ける場合"),
    }))
    .mutation(async ({ input }) => {
      const styleGuide: Record<string, string> = {
        modern: "Modern, clean digital illustration with subtle gradients",
        minimal: "Minimalist illustration with simple shapes and muted colors",
        vibrant: "Vibrant, colorful illustration with bold dynamic composition",
        professional: "Professional, polished illustration with corporate feel",
        creative: "Creative, artistic illustration with unique textures",
      };

      // Step 1: Use LLM to analyze article and suggest image insertion points
      const analysisResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert content editor. Analyze the given HTML article and identify the best locations to insert illustrative images.
For each location, provide:
- The H2 or H3 heading text AFTER which the image should be inserted
- A detailed image description suitable for AI image generation
- An alt text for SEO

Return JSON only.`,
          },
          {
            role: "user",
            content: `Article title: ${input.title}
Keywords: ${(input.keywords || []).join(", ")}
Max images to insert: ${input.maxImages}

Article HTML:
${input.contentHtml.substring(0, 8000)}

Identify up to ${input.maxImages} optimal image insertion points. For each, provide a heading_text (the heading after which to insert), image_description (detailed prompt for AI image generation, related to that section's content), and alt_text (SEO-friendly alt text in the article's language).`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "inline_image_plan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                images: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      heading_text: { type: "string", description: "The heading text after which to insert the image" },
                      image_description: { type: "string", description: "Detailed prompt for AI image generation" },
                      alt_text: { type: "string", description: "SEO-friendly alt text" },
                    },
                    required: ["heading_text", "image_description", "alt_text"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["images"],
              additionalProperties: false,
            },
          },
        },
      });

      const planRaw = analysisResponse.choices[0].message.content;
      const plan = JSON.parse((typeof planRaw === 'string' ? planRaw : '') || '{"images":[]}');
      if (!plan.images || plan.images.length === 0) {
        return { success: true, html: input.contentHtml, imagesInserted: 0, images: [] };
      }

      // Step 2: Generate images in parallel (limit to maxImages)
      const imagesToGenerate = plan.images.slice(0, input.maxImages);
      const generatedImages: Array<{
        headingText: string;
        url: string;
        key: string;
        altText: string;
        prompt: string;
      }> = [];

      // Generate images sequentially to avoid rate limits
      for (const imgPlan of imagesToGenerate) {
        try {
          const imagePrompt = `${imgPlan.image_description}. ${styleGuide[input.style]}. E-commerce and TikTok Shop context. High quality illustration. No text overlay on the image.`;
          const { url: imageUrl } = await generateImage({ prompt: imagePrompt });
          if (imageUrl) {
            // Re-upload to S3 with proper key
            const imgResponse = await fetch(imageUrl);
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
            const imgKey = `blog-inline/ai-${nanoid(12)}.png`;
            const { url: s3Url } = await storagePut(imgKey, imgBuffer, "image/png");
            generatedImages.push({
              headingText: imgPlan.heading_text,
              url: s3Url,
              key: imgKey,
              altText: imgPlan.alt_text,
              prompt: imagePrompt,
            });
          }
        } catch (err: any) {
          console.error(`Inline image generation failed for "${imgPlan.heading_text}":`, err.message);
          // Continue with other images
        }
      }

      if (generatedImages.length === 0) {
        return { success: true, html: input.contentHtml, imagesInserted: 0, images: [] };
      }

      // Step 3: Insert images into HTML after matching headings
      let modifiedHtml = input.contentHtml;
      for (const img of generatedImages) {
        // Find the heading in the HTML and insert image after the closing tag
        const escapedHeading = img.headingText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match h2 or h3 tags containing this heading text
        const headingRegex = new RegExp(
          `(<h[23][^>]*>[^<]*${escapedHeading}[^<]*</h[23]>)`,
          'i'
        );
        const match = modifiedHtml.match(headingRegex);
        if (match) {
          const imgTag = `\n<figure class="inline-ai-image" style="margin: 1.5rem 0; text-align: center;"><img src="${img.url}" alt="${img.altText}" style="max-width: 100%; height: auto; border-radius: 8px;" /><figcaption style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">${img.altText}</figcaption></figure>\n`;
          modifiedHtml = modifiedHtml.replace(match[0], match[0] + imgTag);
        } else {
          // Fallback: try to find the first <p> after any heading containing similar text
          const fallbackRegex = new RegExp(
            `(<h[23][^>]*>[\\s\\S]*?</h[23]>)(\\s*<p>)`,
            'i'
          );
          const fallbackMatch = modifiedHtml.match(fallbackRegex);
          if (fallbackMatch) {
            const imgTag = `\n<figure class="inline-ai-image" style="margin: 1.5rem 0; text-align: center;"><img src="${img.url}" alt="${img.altText}" style="max-width: 100%; height: auto; border-radius: 8px;" /><figcaption style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">${img.altText}</figcaption></figure>\n`;
            modifiedHtml = modifiedHtml.replace(fallbackMatch[0], fallbackMatch[1] + imgTag + fallbackMatch[2]);
          }
        }
      }

      // Step 4: If articleId provided, update the article
      if (input.articleId) {
        await updateBlogArticle(input.articleId, {
          contentHtml: modifiedHtml,
        });
      }

      return {
        success: true,
        html: modifiedHtml,
        imagesInserted: generatedImages.length,
        images: generatedImages.map(img => ({
          url: img.url,
          key: img.key,
          altText: img.altText,
          headingText: img.headingText,
        })),
      };
    }),

  // --- Sitemap data ---
  sitemapData: publicProcedure.query(async () => {
    const { articles } = await listBlogArticles({ status: "published", limit: 1000 });
    return articles.map(a => ({
      slug: a.slug,
      updatedAt: a.updatedAt,
      title: a.title,
    }));
  }),

  // Submit URLs to search engines via IndexNow
  submitToSearchEngines: protectedProcedure
    .input(z.object({
      urls: z.array(z.string()).min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const baseUrl = process.env.APP_URL || "";
      if (!baseUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "APP_URL not configured" });
      const fullUrls = input.urls.map(u => u.startsWith("http") ? u : `${baseUrl}${u}`);
      try {
        const resp = await fetch(`${baseUrl}/api/indexnow/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: fullUrls, trigger: "manual" }),
        });
        const result = await resp.json();
        return { success: true, ...result };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),

  // Submit all published articles to search engines
  submitAllToSearchEngines: protectedProcedure
    .mutation(async ({ ctx }) => {
      const baseUrl = process.env.APP_URL || "";
      if (!baseUrl) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "APP_URL not configured" });
      const { articles } = await listBlogArticles({ status: "published", limit: 1000 });
      const urls = articles.map((a: any) => `/blog/${a.slug}`);
      if (urls.length === 0) return { success: true, submittedUrls: 0 };
      try {
        const resp = await fetch(`${baseUrl}/api/indexnow/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls, trigger: "bulk" }),
        });
        const result = await resp.json();
        return { success: true, ...result, totalArticles: articles.length };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message });
      }
    }),
  // Get IndexNow submission logs
  getIndexNowLogs: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(20) }).optional())
    .query(async ({ input }) => {
      const { indexNowLogs } = await import("../drizzle/schema");
      const { desc } = await import("drizzle-orm");
      const { getDb } = await import("./db");
      const dbConn = await getDb();
      const limit = input?.limit || 20;
      const logs = await dbConn.select().from(indexNowLogs).orderBy(desc(indexNowLogs.createdAt)).limit(limit);
      return logs;
    }),
});
export const autoPostRouter = router({{
  // --- Schedule CRUD ---
  listSchedules: protectedProcedure.query(async () => {
    return await listAutoPostSchedules();
  }),

  createSchedule: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      intervalDays: z.number().min(1).max(30).default(1),
      preferredHour: z.number().min(0).max(23).default(10),
      keywordStrategy: z.enum(["preset", "custom", "ai_suggest"]).default("preset"),
      articleType: z.enum(["guide", "review", "comparison", "news", "howto", "listicle"]).default("guide"),
      tone: z.enum(["professional", "casual", "friendly", "authoritative"]).default("professional"),
      articleLength: z.enum(["short", "standard", "long"]).default("standard"),
      language: z.enum(["ja", "en", "zh", "ko", "th"]).default("ja"),
      generateImages: z.boolean().default(true),
      autoPublish: z.enum(["draft", "publish", "scheduled"]).default("draft"),
      categoryId: z.number().nullable().default(null),
    }))
    .mutation(async ({ input }) => {
      return await createAutoPostSchedule({
        ...input,
        enabled: false,
        nextRunAt: new Date(),
      });
    }),

  updateSchedule: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      intervalDays: z.number().min(1).max(30).optional(),
      preferredHour: z.number().min(0).max(23).optional(),
      keywordStrategy: z.enum(["preset", "custom", "ai_suggest"]).optional(),
      articleType: z.enum(["guide", "review", "comparison", "news", "howto", "listicle"]).optional(),
      tone: z.enum(["professional", "casual", "friendly", "authoritative"]).optional(),
      articleLength: z.enum(["short", "standard", "long"]).optional(),
      language: z.enum(["ja", "en", "zh", "ko", "th"]).optional(),
      generateImages: z.boolean().optional(),
      autoPublish: z.enum(["draft", "publish", "scheduled"]).optional(),
      categoryId: z.number().nullable().optional(),
      enabled: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await updateAutoPostSchedule(id, data);
    }),

  deleteSchedule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await deleteAutoPostSchedule(input.id);
    }),

  toggleSchedule: protectedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const updateData: any = { enabled: input.enabled };
      if (input.enabled) {
        updateData.nextRunAt = new Date();
      }
      return await updateAutoPostSchedule(input.id, updateData);
    }),

  // --- Execution Logs ---
  listLogs: protectedProcedure
    .input(z.object({
      scheduleId: z.number().optional(),
      status: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      return await listAutoPostLogs(input || {});
    }),

  // --- Preset Keywords ---
  listKeywords: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      enabled: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await listPresetKeywordsDb(input || {});
    }),

  addKeyword: protectedProcedure
    .input(z.object({
      keyword: z.string().min(1),
      category: z.string().default("custom"),
      priority: z.number().default(5),
    }))
    .mutation(async ({ input }) => {
      return await createPresetKeywordDb(input);
    }),

  deleteKeyword: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await deletePresetKeywordDb(input.id);
    }),

  resetKeywords: protectedProcedure
    .mutation(async () => {
      return await resetAllKeywordsUsage();
    }),

  // --- AI Keyword Generation ---
  generateKeywords: protectedProcedure
    .input(z.object({
      count: z.number().min(1).max(50).default(20),
      categories: z.array(z.string()).optional(),
    }).optional())
    .mutation(async ({ input }) => {
      const count = input?.count || 20;
      const existingKeywords = await listPresetKeywordsDb();
      const existingList = existingKeywords.map(k => k.keyword);

      const categoryDescriptions: Record<string, string> = {
        "tiktok-shop": "TikTok Shopでの購入方法、お得な使い方、商品レビュー、セール情報、TikTok Shop始め方、出品方法、売れ筋商品",
        "receipt-side-job": "レシートで副業、レシート買取アプリ、レシートポイ活、レシートスキャンで稼ぐ、家計簿アプリ連携",
        "point-katsu": "ポイ活、ポイント活動、ポイントサイト、キャッシュバック、ポイント二重取り、クレカポイント、マイル貯め方",
        "live-commerce": "ライブコマース、ライブ配信販売、ライブコマーサー、ライブ配信で稼ぐ、ライブショッピング、インフルエンサーコマース",
        "lcj-mall": "LCJ MALL、越境EC、海外商品購入、個人輸入、海外通販、お得な買い物術",
        "ec-trends": "EC最新トレンド、ソーシャルコマース、D2C、サブスクリプションEC、AI×EC、パーソナライズ",
        "money-saving": "節約術、お得情報、クーポン活用、セール攻略、コスパ最強、賢い買い物",
      };

      const targetCategories = input?.categories || Object.keys(categoryDescriptions);
      const perCategory = Math.ceil(count / targetCategories.length);

      const allGenerated: Array<{ keyword: string; category: string; priority: number }> = [];

      for (const cat of targetCategories) {
        const desc = categoryDescriptions[cat] || cat;
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `あなたはSEOキーワードリサーチの専門家です。日本語のロングテールSEOキーワードを生成してください。

対象サイト: LCJ MALL（https://lcjmall.com）- TikTok Shopと連携した越境ECモール。レシート副業、ポイ活、ライブコマースなどの情報も発信。

ルール:
- 検索ボリュームが見込める実用的なキーワードを生成
- 3〜6語のロングテールキーワードを優先
- ユーザーの検索意図（情報収集・比較検討・購入）を意識
- 重複を避ける
- 季節性のあるキーワードも含める
- 「〜とは」「〜やり方」「〜おすすめ」「〜比較」などの検索パターンを活用
- 年号を使う場合は必ず${new Date().getFullYear()}年を使用すること（過去の年号は使わない）`,
            },
            {
              role: "user",
              content: `カテゴリ「${cat}」（${desc}）に関連するSEOキーワードを${perCategory}個生成してください。

以下の既存キーワードとは重複しないようにしてください:
${existingList.slice(0, 100).join("、")}

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
                        keyword: { type: "string", description: "SEOキーワード" },
                        priority: { type: "integer", description: "優先度 1-10（10が最高）" },
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

        try {
          const kwRaw = response.choices[0].message.content;
          const parsed = JSON.parse((typeof kwRaw === 'string' ? kwRaw : '') || "{ \"keywords\": [] }");
          for (const kw of parsed.keywords) {
            if (kw.keyword && !existingList.includes(kw.keyword) && !allGenerated.some(g => g.keyword === kw.keyword)) {
              allGenerated.push({
                keyword: kw.keyword,
                category: cat,
                priority: Math.min(10, Math.max(1, kw.priority || 5)),
              });
              existingList.push(kw.keyword);
            }
          }
        } catch (e) {
          console.error(`[AutoPost] Failed to parse keywords for category ${cat}:`, e);
        }
      }

      // Bulk insert
      const inserted: any[] = [];
      for (const kw of allGenerated) {
        try {
          const result = await createPresetKeywordDb(kw);
          inserted.push(result);
        } catch (e) {
          console.error(`[AutoPost] Failed to insert keyword "${kw.keyword}":`, e);
        }
      }

      return { generated: allGenerated.length, inserted: inserted.length, keywords: inserted };
    }),

  // --- Manual Trigger: Execute one auto-post cycle ---
  executeNow: protectedProcedure
    .input(z.object({
      scheduleId: z.number(),
      keyword: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const schedule = await getAutoPostScheduleById(input.scheduleId);
      if (!schedule) throw new TRPCError({ code: 'NOT_FOUND', message: 'Schedule not found' });

      // Create log entry
      const log = await createAutoPostLog({
        scheduleId: schedule.id,
        status: 'pending',
        keyword: input.keyword || null,
      });

      // Step 1: Select keyword
      let keyword = input.keyword;
      let keywordId: number | null = null;
      if (!keyword) {
        const nextKw = await getNextUnusedKeyword();
        if (nextKw) {
          keyword = nextKw.keyword;
          keywordId = nextKw.id;
        } else {
          await updateAutoPostLog(log.id, { status: 'failed', errorMessage: 'No keywords available' });
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'No keywords available' });
        }
      }

      await updateAutoPostLog(log.id, { status: 'generating', keyword });

      try {
        // Step 2: Generate article with LLM
        const lengthGuide = schedule.articleLength === 'short' ? '1500-2000' : schedule.articleLength === 'long' ? '5000-6000' : '3000-4000';
        const currentYear = new Date().getFullYear();
        const articlePrompt = `あなたはSEO/GEO最適化のプロフェッショナルライターです。
以下の条件で、検索エンジンとAI検索エンジン（ChatGPT、Perplexity、Google AI Overview）の両方で上位表示される記事を生成してください。

メインキーワード: ${keyword}
サイト: LCJ MALL（TikTok Shop連携ECモール。ポイ活・レシート副業・ライブコマース情報も発信。ドメイン: lcjmall.com）
記事タイプ: ${schedule.articleType}
トーン: ${schedule.tone}
言語: ${schedule.language === 'ja' ? '日本語' : schedule.language === 'en' ? 'English' : schedule.language}
文字数: ${lengthGuide}字
現在の年: ${currentYear}年

JSON形式で以下を出力してください:
{
  "title": "記事タイトル（年号を使う場合は${currentYear}年のみ）",
  "slug": "url-friendly-slug",
  "excerpt": "120字以内の抽出",
  "contentHtml": "HTML形式の記事本文（h2, h3, p, ul, ol, blockquoteタグ使用）",
  "seoTitle": "SEO用タイトル（60字以内）",
  "seoDescription": "SEO用ディスクリプション（155字以内）",
  "tags": ["推奨タグ名1", "推奨タグ名2"]
}

SEO/GEO最適化要件:
- メインキーワードをタイトル、最初の段落、h2見出しに自然に含める
- 統計データや具体的な数字を含める（AI検索が引用しやすい）
- FAQセクションを含める（「よくある質問」形式）
- 内部リンクとしてLCJ MALLの商品ページへの参照を含める
- 構造化された見出し階層（h2 > h3）を使用
- 専門的で信頼性の高い記述を心がける
- 年号は必ず${currentYear}年を使用すること（過去の年号は絶対に使わない）
- LCJ MALLへのリンクは必ず https://lcjmall.com を使用（www.は付けない）`;

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

        const rawContent = response.choices[0].message.content;
        const articleData = JSON.parse((typeof rawContent === 'string' ? rawContent : '') || '{}');
        if (!articleData.title || !articleData.contentHtml) {
          throw new Error('Invalid article data from LLM');
        }

        // Sanitize links - fix www.lcjmall.com to lcjmall.com
        const sanitizedHtml = articleData.contentHtml
          .replace(/https?:\/\/www\.lcjmall\.com/gi, 'https://lcjmall.com');

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
          contentHtml: sanitizedHtml,
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
            const detectedType = detectArticleType(keyword, articleData.title);
            const resolvedType = schedule.articleType || detectedType;
            const imagePrompt = generateCoverImagePrompt(articleData.title, resolvedType, keyword);
            console.log(`[autoPost] Cover image style: ${getArticleTypeLabel(detectedType)} (${resolvedType})`);
            const { url: imageUrl } = await generateImage({ prompt: imagePrompt });
            if (imageUrl) {
              const imageResponse = await fetch(imageUrl);
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              const imageKey = `blog-covers/${finalSlug}-${nanoid(8)}.png`;
              const { url: s3Url } = await storagePut(imageKey, imageBuffer, 'image/png');
              await updateBlogArticle(articleId, { coverImageUrl: s3Url, coverImageKey: imageKey });
            }
          } catch (imgError: any) {
            console.error('Image generation failed:', imgError.message);
            // Continue without image
          }
        }

        // Step 5: Generate inline images if enabled
        if (schedule.generateImages && articleId) {
          try {
            await updateAutoPostLog(log.id, { status: 'image_generating' });
            const inlineStyleGuide: Record<string, string> = {
              modern: "Modern, clean digital illustration with subtle gradients",
              minimal: "Minimalist illustration with simple shapes and muted colors",
              vibrant: "Vibrant, colorful illustration with bold dynamic composition",
              professional: "Professional, polished illustration with corporate feel",
              creative: "Creative, artistic illustration with unique textures",
            };
            // Analyze article for image insertion points
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
            const inlineRaw = inlineAnalysis.choices[0].message.content;
            const inlinePlan = JSON.parse((typeof inlineRaw === 'string' ? inlineRaw : '') || '{"images":[]}');
            if (inlinePlan.images && inlinePlan.images.length > 0) {
              let updatedHtml = articleData.contentHtml
                .replace(/https?:\/\/www\.lcjmall\.com/gi, 'https://lcjmall.com');
              for (const imgPlan of inlinePlan.images.slice(0, 2)) {
                try {
                  const imgPrompt = `${imgPlan.image_description}. ${inlineStyleGuide['modern']}. E-commerce and TikTok Shop context. High quality illustration. No text overlay.`;
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
                  console.error('Inline image generation failed:', inlineErr.message);
                }
              }
              // Update article with inline images
              if (updatedHtml !== articleData.contentHtml) {
                await updateBlogArticle(articleId, { contentHtml: updatedHtml });
              }
            }
          } catch (inlineError: any) {
            console.error('Inline image analysis failed:', inlineError.message);
            // Continue without inline images
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
                body: JSON.stringify({ urls: [`/blog/${finalSlug}`], trigger: "auto_post" }),
              });
              console.log(`[AutoPost][SEO] IndexNow notification sent for: /blog/${finalSlug}`);
            } catch (e) {
              console.warn("[AutoPost][SEO] IndexNow notification failed:", e);
            }
          }
        }

        // Update log
        await updateAutoPostLog(log.id, {
          status: 'completed',
          articleId,
          completedAt: new Date(),
        });

        return {
          success: true,
          articleId,
          title: articleData.title,
          keyword,
          status: publishStatus,
        };

      } catch (error: any) {
        await updateAutoPostLog(log.id, {
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
        });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
    }),

  // --- Stuck Recovery ---
  recoverStuck: protectedProcedure
    .mutation(async () => {
      const stuckLogs = await getStuckAutoPostLogs();
      let recovered = 0;
      for (const log of stuckLogs) {
        if (log.articleId) {
          try {
            const article = await getBlogArticleById(log.articleId);
            if (article && !article.coverImageUrl) {
              const imagePrompt = generateCoverImagePrompt(article.title, detectArticleType('', article.title));
              const { url: imageUrl } = await generateImage({ prompt: imagePrompt });
              if (imageUrl) {
                const imageResponse = await fetch(imageUrl);
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                const imageKey = `blog-covers/${article.slug}-${nanoid(8)}.png`;
                const { url: s3Url } = await storagePut(imageKey, imageBuffer, 'image/png');
                await updateBlogArticle(log.articleId, { coverImageUrl: s3Url, coverImageKey: imageKey });
              }
            }
            await updateAutoPostLog(log.id, { status: 'completed', completedAt: new Date() });
            recovered++;
          } catch {
            await updateAutoPostLog(log.id, { status: 'failed', errorMessage: 'Recovery failed' });
          }
        } else {
          await updateAutoPostLog(log.id, { status: 'failed', errorMessage: 'No article ID, cannot recover' });
        }
      }
      return { recovered, total: stuckLogs.length };
    }),

  // --- Quick Trigger: Generate article without schedule ---
  triggerNow: protectedProcedure
    .input(z.object({
      keyword: z.string().optional(),
      articleType: z.enum(["guide", "review", "comparison", "news", "howto", "listicle"]).default("guide"),
      tone: z.enum(["professional", "casual", "friendly", "authoritative"]).default("professional"),
      articleLength: z.enum(["short", "standard", "long"]).default("standard"),
      language: z.enum(["ja", "en", "zh", "ko", "th"]).default("ja"),
      generateImages: z.boolean().default(true),
      autoPublish: z.enum(["draft", "publish"]).default("publish"),
    }))
    .mutation(async ({ input }) => {
      const opts = input;
      
      // Step 1: Select keyword
      let keyword = opts.keyword;
      let keywordId: number | null = null;
      if (!keyword) {
        const nextKw = await getNextUnusedKeyword();
        if (nextKw) {
          keyword = nextKw.keyword;
          keywordId = nextKw.id;
        } else {
          return { success: false, message: 'キーワードがありません。先にキーワードを追加してください。' };
        }
      }

      // Create a temporary log entry (scheduleId=0 for manual trigger)
      const log = await createAutoPostLog({
        scheduleId: 0,
        status: 'generating',
        keyword,
      });

      try {
        // Step 2: Auto-detect category from keyword
        const blogCategories = await getAllBlogCategories();
        let categoryId = detectCategoryForKeyword(keyword, blogCategories);
        console.log(`[triggerNow] Auto-detected category: ${categoryId ? blogCategories.find(c => c.id === categoryId)?.name : 'none'}`);

        // Step 3: Fetch real EC data with product images for enriched article
        let realDataContext = '';
        let productSalesRanking: ProductCardData[] = [];
        let productRelated: ProductCardData[] = [];
        try {
          const productData = await buildProductDataForLLMPrompt(keyword, 10);
          realDataContext = productData.context;
          productSalesRanking = productData.salesRanking;
          productRelated = productData.relatedProducts;
          console.log(`[triggerNow] Fetched ${productSalesRanking.length} ranking products, ${productRelated.length} related products with images`);
        } catch (dataErr: any) {
          console.warn('[triggerNow] Failed to fetch EC data:', dataErr.message);
        }

        // Step 4: Generate article with LLM (enhanced with real data + GEO)
        const currentYear = new Date().getFullYear();
        const lengthGuide = opts.articleLength === 'short' ? '1500-2000' : opts.articleLength === 'long' ? '5000-6000' : '3000-4000';
        const categoryName = categoryId ? blogCategories.find(c => c.id === categoryId)?.name || '' : '';

        const articlePrompt = `あなたはSEO/GEO最適化のプロフェッショナルライターです。
以下の条件で、検索エンジンとAI検索エンジン（ChatGPT、Perplexity、Google AI Overview）の両方で上位表示される記事を生成してください。

メインキーワード: ${keyword}
サイト: LCJ MALL（TikTok Shop連携ECモール。ポイ活・レシート副業・ライブコマース情報も発信。ドメイン: lcjmall.com）
記事カテゴリ: ${categoryName || '自動判定'}
記事タイプ: ${opts.articleType || 'guide'}
トーン: ${opts.tone || 'professional'}
言語: ${(opts.language || 'ja') === 'ja' ? '日本語' : (opts.language || 'ja') === 'en' ? 'English' : opts.language}
文字数: ${lengthGuide}字
現在の年: ${currentYear}年
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
  "suggestedCategory": "最適なカテゴリ名（TikTok Shop/ポイ活・ポイント/レシート副業/ライブコマース/LCJ MALL/シャンプー・トリートメント/カラーケア/ダメージケア/成分解析/美容師監修ケア/スキンケア/美容家電/ランキング・比較/美容トレンド/Eコマース/節約・お得情報）"
}

SEO/GEO最適化要件:
- メインキーワードをタイトル、最初の段落、h2見出しに自然に含める
- 上記の実売データ（売上ランキング・購入者数・レビュー評価）を記事内に自然に組み込む
- 「LCJ MALLで○○人が購入」「★4.5の高評価」など具体的な数字を活用
- 商品紹介セクションでは <div data-type="product-card" data-product-id="商品ID"></div> プレースホルダーを配置（後で実商品写真・価格・評価カードに自動変換される）
- 商品ランキングセクションでは各商品に上記プレースホルダーを配置
- 統計データや具体的な数字を含める（AI検索が引用しやすい）
- FAQセクションを含める（「よくある質問」形式、3-5個）
- HowToセクションを含める（具体的な手順を番号付きで）
- 比較表を含める（<table>タグで商品を比較）
- 構造化された見出し階層（h2 > h3）を使用
- E-E-A-T: 美容師監修・専門家の視点を含める
- 専門的で信頼性の高い記述を心がける
- 日本語SEO: 自然な日本語表現、共起語を含める
- GEO最適化: AI検索エンジンが引用しやすい明確な回答文を含める
- 年号は必ず${currentYear}年を使用すること（過去の年号は絶対に使わない）

内部リンクルール（重要）:
- LCJ MALLへのリンクは必ず https://lcjmall.com を使用（www.は付けない）
- 商品ページへのリンク: https://lcjmall.com/products
- ブランドページへのリンク: /brands/ブランドID（相対パス）
- 外部リンクは最小限に抑え、内部リンクを優先する`;

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

        const rawContent = response.choices[0].message.content;
        const articleData = JSON.parse((typeof rawContent === 'string' ? rawContent : '') || '{}');
        if (!articleData.title || !articleData.contentHtml) {
          throw new Error('LLMから有効な記事データを取得できませんでした');
        }

        // Step 5: Resolve category (use LLM suggestion if not already set)
        if (!categoryId && articleData.suggestedCategory) {
          const suggestedCat = blogCategories.find(c => c.name === articleData.suggestedCategory);
          if (suggestedCat) {
            categoryId = suggestedCat.id;
            console.log(`[triggerNow] LLM suggested category: ${suggestedCat.name}`);
          }
        }

        // Step 5.5: Sanitize links - fix www.lcjmall.com to lcjmall.com
        let processedHtml = articleData.contentHtml
          .replace(/https?:\/\/www\.lcjmall\.com/gi, 'https://lcjmall.com');

        // Step 6: Insert brand internal links
        try {
          const mallBrands = await getAllMallBrands();
          if (mallBrands.length > 0) {
            processedHtml = insertBrandLinks(processedHtml, mallBrands);
            console.log(`[triggerNow] Brand links inserted for ${mallBrands.length} brands`);
          }
        } catch (brandErr: any) {
          console.warn('[triggerNow] Brand link insertion failed:', brandErr.message);
        }

        // Step 6.5: Replace product-card placeholders with rich product cards (real photos, prices, reviews)
        try {
          processedHtml = await postProcessArticleHtml(processedHtml, productSalesRanking, productRelated);
          console.log(`[triggerNow] Product cards rendered with real product images and data`);
        } catch (cardErr: any) {
          console.warn('[triggerNow] Product card rendering failed:', cardErr.message);
        }

        // Ensure unique slug
        const baseSlug = articleData.slug || nanoid(12);
        const existingArticle = await getBlogArticleBySlug(baseSlug);
        const finalSlug = existingArticle ? `${baseSlug}-${nanoid(6)}` : baseSlug;

        // Step 7: Create blog article with auto-assigned category
        const publishStatus = (opts.autoPublish || 'publish') === 'publish' ? 'published' : 'draft';
        const articleResult = await createBlogArticle({
          title: articleData.title,
          slug: finalSlug,
          excerpt: articleData.excerpt,
          contentHtml: processedHtml,
          seoTitle: articleData.seoTitle,
          seoDescription: articleData.seoDescription,
          status: publishStatus as any,
          publishedAt: publishStatus === 'published' ? new Date() : null,
          authorId: 1,
          categoryId: categoryId,
        });

        const articleId = (articleResult as any).id;

        // Step 8: Generate cover image if enabled
        if ((opts.generateImages !== false) && articleId) {
          await updateAutoPostLog(log.id, { status: 'image_generating' });
          try {
            const triggerDetectedType = detectArticleType(keyword, articleData.title);
            const triggerResolvedType = opts.articleType || triggerDetectedType;
            const imagePrompt = generateCoverImagePrompt(articleData.title, triggerResolvedType, keyword);
            console.log(`[triggerNow] Cover image style: ${getArticleTypeLabel(triggerDetectedType)} (${triggerResolvedType})`);
            const { url: imageUrl } = await generateImage({ prompt: imagePrompt });
            if (imageUrl) {
              const imageResponse = await fetch(imageUrl);
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              const imageKey = `blog-covers/${finalSlug}-${nanoid(8)}.png`;
              const { url: s3Url } = await storagePut(imageKey, imageBuffer, 'image/png');
              await updateBlogArticle(articleId, { coverImageUrl: s3Url, coverImageKey: imageKey });
            }
          } catch (imgError: any) {
            console.error('[triggerNow] Image generation failed:', imgError.message);
          }
        }

        // Mark keyword as used
        if (keywordId) {
          await markKeywordUsed(keywordId);
        }

        // Notify search engines if published
        if (publishStatus === 'published') {
          const baseUrl = process.env.APP_URL || "";
          if (baseUrl) {
            try {
              await fetch(`${baseUrl}/api/indexnow/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: [`/blog/${finalSlug}`], trigger: "auto_post" }),
              });
            } catch (e) {
              console.warn("[triggerNow] IndexNow notification failed:", e);
            }
          }
        }

        // Update log
        await updateAutoPostLog(log.id, {
          status: 'completed',
          articleId,
          completedAt: new Date(),
        });

        return {
          success: true,
          articleId,
          title: articleData.title,
          keyword,
          category: categoryId ? blogCategories.find(c => c.id === categoryId)?.name : null,
          status: publishStatus,
        };

      } catch (error: any) {
        await updateAutoPostLog(log.id, {
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
        });
        return { success: false, message: error.message || '記事生成に失敗しました' };
      }
    }),

  // --- Dashboard Stats ---
  stats: protectedProcedure.query(async () => {
    const allSchedules = await listAutoPostSchedules();
    const keywords = await listPresetKeywordsDb();
    const enabledSchedules = allSchedules.filter(s => s.enabled);
    const unusedKeywords = keywords.filter(k => k.usedCount === 0);

    return {
      totalSchedules: allSchedules.length,
      activeSchedules: enabledSchedules.length,
      totalKeywords: keywords.length,
      unusedKeywords: unusedKeywords.length,
      totalPostsGenerated: allSchedules.reduce((sum, s) => sum + (s.totalGenerated || 0), 0),
    };
  }),
});

