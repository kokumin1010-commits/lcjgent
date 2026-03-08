/**
 * Article Rewriter
 * 弱い記事を自動リライトするエンジン
 * 
 * Phase 3: 自動改善エンジン
 * - 弱い記事の抽出（seoMonitor.tsから）
 * - タイトル差し替え（より強いパターンに変更）
 * - 導入部変更
 * - 内部リンク増強
 * - 商品レコメンド修正
 * - リライト後の品質チェック
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { blogArticles, blogArticleStats } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { extractWeakArticles, upsertArticleStats, detectTitlePattern } from "./seoMonitor";
import { getRelatedBlogArticles } from "./db";

// =============================================
// 定数
// =============================================

/** 1回のリライトバッチで処理する最大記事数 */
const MAX_REWRITE_PER_BATCH = 3;

/** リライト後の最低品質基準 */
const MIN_REWRITE_WORD_COUNT = 1500;

/** 強いタイトルパターンの候補 */
const STRONG_TITLE_PATTERNS = [
  // pattern_a: 年号+最新版
  (keyword: string, year: number) => `${year}年最新版 ${keyword}おすすめ7選【TikTok人気】`,
  (keyword: string, year: number) => `【${year}年】${keyword}ランキングTOP7｜TikTokで話題`,
  // pattern_b: TikTokライブ
  (keyword: string, _year: number) => `TikTokライブで売れている${keyword}7選【プロ厳選】`,
  (keyword: string, _year: number) => `TikTok配信者が選ぶ${keyword}おすすめランキング`,
  // pattern_c: 悩み解決
  (keyword: string, _year: number) => `${keyword}で悩む人必見！美容師が教える正しい選び方`,
  (keyword: string, _year: number) => `${keyword}の選び方完全ガイド｜失敗しないポイント7つ`,
];

// =============================================
// タイトル最適化
// =============================================

/**
 * 弱い記事のタイトルをより強いパターンに変更する
 */
async function rewriteTitle(
  originalTitle: string,
  keyword: string,
  articleType: string,
  weakReasons: string[],
): Promise<{ newTitle: string; titlePattern: string }> {
  const currentYear = new Date().getFullYear();

  // CTR低い場合はより魅力的なタイトルに変更
  const isCtrWeak = weakReasons.some(r => r.includes("CTR低"));
  const isNotIndexed = weakReasons.some(r => r.includes("未indexed"));

  const patternInstruction = isCtrWeak
    ? "CTRを上げるため、数字・具体性・感情訴求を強化したタイトルにしてください"
    : isNotIndexed
    ? "検索エンジンにインデックスされやすいよう、ロングテールキーワードを含む具体的なタイトルにしてください"
    : "より検索意図に合ったタイトルにしてください";

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSEOタイトル最適化の専門家です。LCJ MALL（美容・ヘアケアECサイト）のブログ記事タイトルを改善してください。
ルール:
- 年号は必ず${currentYear}年を使用
- 数字を含める（7選、TOP5、3つのポイントなど）
- 検索意図に合致させる
- 30文字以内が理想
- ${patternInstruction}`,
      },
      {
        role: "user",
        content: `元のタイトル: ${originalTitle}
キーワード: ${keyword}
記事タイプ: ${articleType}
弱い理由: ${weakReasons.join("、")}

改善されたタイトルを3案提案してください。`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "title_suggestions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  reason: { type: "string" },
                  pattern: { type: "string" },
                },
                required: ["title", "reason", "pattern"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(typeof content === "string" ? content : "{}");
  const suggestions = parsed.suggestions || [];

  if (suggestions.length === 0) {
    return { newTitle: originalTitle, titlePattern: "pattern_other" };
  }

  // 最初の提案を採用
  const best = suggestions[0];
  return {
    newTitle: best.title,
    titlePattern: detectTitlePattern(best.title),
  };
}

// =============================================
// 導入部・内部リンク・商品レコメンド改善
// =============================================

/**
 * 記事の導入部を改善する
 */
async function rewriteIntroduction(
  originalContent: string,
  newTitle: string,
  keyword: string,
  weakReasons: string[],
): Promise<string> {
  const currentYear = new Date().getFullYear();

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `あなたはSEOコンテンツライターです。ブログ記事の導入部（最初の300〜500文字）を改善してください。
ルール:
- 検索意図に直接応える書き出し
- 読者の悩みに共感する
- 記事で解決できることを明示
- ${currentYear}年の最新情報として書く
- 「この記事では〜」という表現で記事の価値を伝える`,
      },
      {
        role: "user",
        content: `タイトル: ${newTitle}
キーワード: ${keyword}
弱い理由: ${weakReasons.join("、")}

元の記事の最初の部分:
${originalContent.substring(0, 1000)}

改善された導入部（HTML形式）を書いてください。`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "intro_rewrite",
        strict: true,
        schema: {
          type: "object",
          properties: {
            introduction: { type: "string" },
          },
          required: ["introduction"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(typeof content === "string" ? content : "{}");
  return parsed.introduction || "";
}

/**
 * 内部リンクを増強する
 * 同カテゴリ記事2本・同悩み記事1本・商品一覧1本・LCJ Mall案内1本
 */
async function enhanceInternalLinks(
  content: string,
  articleId: number,
  categoryId: number | null,
  tagIds: number[],
): Promise<string> {
  // 関連記事を取得
  const relatedArticles = await getRelatedBlogArticles(articleId, categoryId, tagIds, 5);

  if (relatedArticles.length === 0) {
    return content;
  }

  // 内部リンクセクションを生成
  const internalLinksHtml = `
<div class="internal-links-section" style="background:#f8f9fa;padding:20px;border-radius:8px;margin:24px 0;">
  <h3 style="font-size:1.1rem;margin-bottom:12px;">📚 関連記事もチェック</h3>
  <ul style="list-style:none;padding:0;margin:0;">
    ${relatedArticles.slice(0, 3).map(a => `
    <li style="margin-bottom:8px;">
      <a href="/blog/${a.slug}" style="color:#2563eb;text-decoration:none;">
        ▶ ${a.title}
      </a>
    </li>`).join("")}
    <li style="margin-bottom:8px;">
      <a href="/mall" style="color:#2563eb;text-decoration:none;">
        ▶ LCJ Mall 商品一覧を見る
      </a>
    </li>
    <li style="margin-bottom:8px;">
      <a href="/mall/about" style="color:#2563eb;text-decoration:none;">
        ▶ LCJ Mallとは？TikTok Shopで買えるコスメ・美容品
      </a>
    </li>
  </ul>
</div>`;

  // まとめセクションの前に内部リンクを挿入
  if (content.includes('<h2') && content.includes('まとめ')) {
    return content.replace(
      /(<h2[^>]*>.*?まとめ.*?<\/h2>)/i,
      `${internalLinksHtml}\n$1`
    );
  }

  // まとめがなければ末尾に追加
  return content + internalLinksHtml;
}

// =============================================
// メインリライト処理
// =============================================

/**
 * 単一記事をリライトする
 */
async function rewriteArticle(article: {
  id: number;
  title: string;
  slug: string;
  categoryId: number | null;
  weakReason: string[];
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    console.log(`[Article Rewriter] Rewriting article ${article.id}: ${article.title}`);

    // 記事の全コンテンツを取得
    const fullArticle = await db.select()
      .from(blogArticles)
      .where(eq(blogArticles.id, article.id))
      .limit(1);

    if (fullArticle.length === 0) return false;
    const articleData = fullArticle[0];

    // キーワードを推定（タイトルから）
    const keyword = articleData.title
      .replace(/【.*?】/g, "")
      .replace(/\d{4}年.*?版/g, "")
      .replace(/おすすめ.*選|ランキング.*選/g, "")
      .trim()
      .substring(0, 30);

    // タイトルを改善
    const { newTitle, titlePattern } = await rewriteTitle(
      articleData.title,
      keyword,
      "trend",
      article.weakReason,
    );

    // 導入部を改善
    const newIntroduction = await rewriteIntroduction(
      articleData.content || "",
      newTitle,
      keyword,
      article.weakReason,
    );

    // 内部リンクを増強
    let newContent = articleData.content || "";
    if (newIntroduction) {
      // 最初のh2タグの前に新しい導入部を挿入
      if (newContent.includes("<h2")) {
        newContent = newContent.replace(
          /^([\s\S]*?)(<h2)/,
          `${newIntroduction}\n$2`
        );
      } else {
        newContent = newIntroduction + "\n" + newContent;
      }
    }

    // タグIDを取得
    const { getBlogArticleTagIds } = await import("./db");
    const tagIds = await getBlogArticleTagIds(article.id);

    newContent = await enhanceInternalLinks(newContent, article.id, article.categoryId, tagIds);

    // 記事を更新
    const now = new Date();
    await db.update(blogArticles)
      .set({
        title: newTitle,
        content: newContent,
        updatedAt: now,
      })
      .where(eq(blogArticles.id, article.id));

    // リライト統計を更新
    const existingStats = await db.select()
      .from(blogArticleStats)
      .where(eq(blogArticleStats.articleId, article.id))
      .limit(1);

    const rewriteCount = (existingStats[0]?.rewriteCount || 0) + 1;

    await upsertArticleStats(article.id, {
      titlePattern,
      rewriteCount,
      lastRewriteAt: now,
      rewriteReason: article.weakReason.join("、"),
    } as any);

    console.log(`[Article Rewriter] Successfully rewrote article ${article.id}: "${articleData.title}" → "${newTitle}"`);
    return true;
  } catch (error: any) {
    console.error(`[Article Rewriter] Error rewriting article ${article.id}:`, error.message);
    return false;
  }
}

// =============================================
// リライトバッチ
// =============================================

/**
 * 弱い記事を自動リライトするバッチ処理
 * 毎日1回（深夜バッチと同時）実行
 */
export async function runRewriteBatch() {
  console.log("[Article Rewriter] Starting rewrite batch...");

  try {
    // 弱い記事を抽出
    const weakArticles = await extractWeakArticles();

    if (weakArticles.length === 0) {
      console.log("[Article Rewriter] No weak articles found");
      return;
    }

    console.log(`[Article Rewriter] Found ${weakArticles.length} weak articles, processing up to ${MAX_REWRITE_PER_BATCH}`);

    // リライト済みでない記事を優先（rewriteCountが少ない順）
    const db = await getDb();
    if (!db) return;

    const articlesToRewrite = weakArticles.slice(0, MAX_REWRITE_PER_BATCH);
    let rewrittenCount = 0;

    for (const article of articlesToRewrite) {
      // リライト回数を確認（最大3回まで）
      const stats = await db.select()
        .from(blogArticleStats)
        .where(eq(blogArticleStats.articleId, article.id))
        .limit(1);

      const rewriteCount = stats[0]?.rewriteCount || 0;
      if (rewriteCount >= 3) {
        console.log(`[Article Rewriter] Skipping article ${article.id}: already rewritten ${rewriteCount} times`);
        continue;
      }

      const success = await rewriteArticle(article);
      if (success) rewrittenCount++;

      // API制限対策: 2秒待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[Article Rewriter] Batch complete: ${rewrittenCount}/${articlesToRewrite.length} articles rewritten`);
  } catch (error: any) {
    console.error("[Article Rewriter] Batch error:", error.message);
  }
}

// =============================================
// スケジューラー起動
// =============================================

let rewriterIntervalId: ReturnType<typeof setInterval> | null = null;

/** リライトバッチの実行間隔（週1回 = 7日） */
const REWRITE_INTERVAL_DAYS = 7;

export function startArticleRewriter() {
  if (rewriterIntervalId) {
    console.log("[Article Rewriter] Already running");
    return;
  }

  console.log(`[Article Rewriter] Starting rewriter (runs every ${REWRITE_INTERVAL_DAYS} days)`);

  rewriterIntervalId = setInterval(() => {
    runRewriteBatch().catch((error) => {
      console.error("[Article Rewriter] Error during scheduled run:", error);
    });
  }, REWRITE_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
}

export function stopArticleRewriter() {
  if (rewriterIntervalId) {
    clearInterval(rewriterIntervalId);
    rewriterIntervalId = null;
    console.log("[Article Rewriter] Stopped");
  }
}
