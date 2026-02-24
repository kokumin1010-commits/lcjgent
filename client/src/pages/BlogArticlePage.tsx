import { useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  Eye,
  Tag,
  FolderOpen,
  Share2,
  Clock,
  Star,
  ShoppingBag,
  Users,
  ChevronRight,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { useLocation, useRoute, Link } from "wouter";
import { toast } from "sonner";

// Star rating display
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-${size === 14 ? 3.5 : 4} w-${size === 14 ? 3.5 : 4}`}
          style={{ width: size, height: size }}
          fill={i <= Math.round(rating) ? "#f59e0b" : "none"}
          stroke={i <= Math.round(rating) ? "#f59e0b" : "#d1d5db"}
        />
      ))}
    </div>
  );
}

// Product card component for blog articles
function ProductCard({ product }: { product: any }) {
  const [, navigate] = useLocation();
  return (
    <Card
      className="flex flex-row items-center gap-3 p-3 hover:shadow-md transition-shadow cursor-pointer border-pink-100"
      onClick={() => navigate(`/mall/product/${product.id}`)}
    >
      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm line-clamp-2 mb-1">{product.name}</p>
        {product.brandName && (
          <p className="text-xs text-muted-foreground mb-1">{product.brandName}</p>
        )}
        <div className="flex items-center gap-2 mb-1">
          {product.totalReviews > 0 && (
            <div className="flex items-center gap-1">
              <StarRating rating={product.avgRating} size={12} />
              <span className="text-xs text-muted-foreground">({product.totalReviews})</span>
            </div>
          )}
          {product.buyerCount > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Users className="h-3 w-3" />
              {product.buyerCount}人が購入
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-pink-600 font-bold text-sm">¥{product.price?.toLocaleString()}</span>
          {product.pointPrice && (
            <span className="text-xs text-amber-600">{product.pointPrice.toLocaleString()}pt</span>
          )}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </Card>
  );
}

// Related article card
function RelatedArticleCard({ article }: { article: any }) {
  return (
    <Link href={`/blog/${article.slug}`}>
      <div className="group flex gap-3 p-2 rounded-lg hover:bg-pink-50 transition-colors cursor-pointer">
        <div className="w-20 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          {article.coverImageUrl ? (
            <img src={article.coverImageUrl} alt={article.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center text-lg">📝</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-2 group-hover:text-pink-600 transition-colors">
            {article.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString("ja-JP")
              : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

// Sales ranking sidebar widget
function SalesRankingWidget({ products }: { products: any[] }) {
  const [, navigate] = useLocation();
  if (!products || products.length === 0) return null;

  return (
    <div className="bg-gradient-to-b from-amber-50 to-white border border-amber-200 rounded-xl p-4">
      <h3 className="font-bold text-sm flex items-center gap-1.5 mb-3 text-amber-800">
        <TrendingUp className="h-4 w-4" />
        売れ筋ランキング
      </h3>
      <div className="space-y-2.5">
        {products.map((p: any, idx: number) => (
          <div
            key={p.id}
            className="flex items-center gap-2.5 cursor-pointer hover:bg-amber-50 rounded-lg p-1.5 transition-colors"
            onClick={() => navigate(`/mall/product/${p.id}`)}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              idx === 0 ? "bg-amber-400 text-white" :
              idx === 1 ? "bg-gray-300 text-white" :
              idx === 2 ? "bg-amber-700 text-white" :
              "bg-gray-100 text-gray-500"
            }`}>
              {idx + 1}
            </span>
            <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-100">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm">📦</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium line-clamp-1">{p.name}</p>
              <p className="text-xs text-pink-600 font-semibold">¥{p.price?.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BlogArticlePage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";

  // Use enriched endpoint that returns related products, articles, and ranking
  const { data: article, isLoading, error } = trpc.blog.getBySlugEnriched.useQuery(
    { slug },
    { enabled: !!slug }
  );
  const { data: categories } = trpc.blog.listCategories.useQuery();
  const { data: tags } = trpc.blog.listTags.useQuery();
  const { data: categoryHub } = trpc.blog.categoryHub.useQuery();
  const { data: tagHub } = trpc.blog.tagHub.useQuery();

  // Set page title, meta, and structured data for SEO
  useEffect(() => {
    if (article) {
      document.title = article.seoTitle || article.title + " | LCJ MALL ブログ";

      // Set meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute("content", article.seoDescription || article.excerpt || "");
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = article.seoDescription || article.excerpt || "";
        document.head.appendChild(meta);
      }

      // Set OGP tags
      setMetaTag("og:title", article.seoTitle || article.title);
      setMetaTag("og:description", article.seoDescription || article.excerpt || "");
      setMetaTag("og:type", "article");
      setMetaTag("og:url", window.location.href);
      if (article.ogImageUrl || article.coverImageUrl) {
        setMetaTag("og:image", article.ogImageUrl || article.coverImageUrl || "");
      }
      setMetaTag("article:published_time", article.publishedAt ? new Date(article.publishedAt).toISOString() : "");
      setMetaTag("article:modified_time", new Date(article.updatedAt).toISOString());

      // Set Twitter Card tags
      setMetaTag("twitter:card", "summary_large_image");
      setMetaTag("twitter:title", article.seoTitle || article.title);
      setMetaTag("twitter:description", article.seoDescription || article.excerpt || "");
      if (article.ogImageUrl || article.coverImageUrl) {
        setMetaTag("twitter:image", article.ogImageUrl || article.coverImageUrl || "");
      }

      // Set canonical URL
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement("link");
        canonicalLink.rel = "canonical";
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.href = window.location.href;

      // Remove existing LD+JSON
      const existingLd = document.querySelectorAll('script[type="application/ld+json"][data-blog]');
      existingLd.forEach(el => el.remove());

      const categoryName = categories?.find((c: any) => c.id === article.categoryId)?.name;
      const articleUrl = window.location.href;
      const siteUrl = window.location.origin;

      // Article schema
      const articleLd = document.createElement("script");
      articleLd.type = "application/ld+json";
      articleLd.setAttribute("data-blog", "true");
      articleLd.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.seoTitle || article.title,
        description: article.seoDescription || article.excerpt || "",
        image: article.ogImageUrl || article.coverImageUrl || undefined,
        datePublished: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
        dateModified: new Date(article.updatedAt).toISOString(),
        mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
        author: { "@type": "Organization", name: "LCJ MALL", url: siteUrl },
        publisher: {
          "@type": "Organization",
          name: "LCJ MALL",
          url: siteUrl,
          logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
        },
        ...(article.tagIds && article.tagIds.length > 0 && tags ? {
          keywords: tags.filter((t: any) => article.tagIds?.includes(t.id)).map((t: any) => t.name).join(", "),
        } : {}),
        ...(categoryName ? { articleSection: categoryName } : {}),
        wordCount: article.contentHtml ? article.contentHtml.replace(/<[^>]*>/g, "").length : undefined,
      });
      document.head.appendChild(articleLd);

      // BreadcrumbList schema
      const breadcrumbLd = document.createElement("script");
      breadcrumbLd.type = "application/ld+json";
      breadcrumbLd.setAttribute("data-blog", "true");
      const breadcrumbItems: any[] = [
        { "@type": "ListItem", position: 1, name: "ホーム", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "ブログ", item: `${siteUrl}/blog` },
      ];
      if (categoryName) {
        breadcrumbItems.push({ "@type": "ListItem", position: 3, name: categoryName, item: `${siteUrl}/blog?category=${article.categoryId}` });
        breadcrumbItems.push({ "@type": "ListItem", position: 4, name: article.title });
      } else {
        breadcrumbItems.push({ "@type": "ListItem", position: 3, name: article.title });
      }
      breadcrumbLd.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      });
      document.head.appendChild(breadcrumbLd);

      // Product structured data (for related products)
      if (article.relatedProducts && article.relatedProducts.length > 0) {
        const productLd = document.createElement("script");
        productLd.type = "application/ld+json";
        productLd.setAttribute("data-blog", "true");
        productLd.textContent = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${article.title} - おすすめ商品`,
          itemListElement: article.relatedProducts.slice(0, 6).map((p: any, idx: number) => ({
            "@type": "ListItem",
            position: idx + 1,
            item: {
              "@type": "Product",
              name: p.name,
              image: p.imageUrl || undefined,
              brand: p.brandName ? { "@type": "Brand", name: p.brandName } : undefined,
              offers: {
                "@type": "Offer",
                priceCurrency: "JPY",
                price: p.price,
                availability: "https://schema.org/InStock",
                url: `${siteUrl}/mall/product/${p.id}`,
              },
              ...(p.totalReviews > 0 ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: p.avgRating?.toFixed(1),
                  reviewCount: p.totalReviews,
                },
              } : {}),
            },
          })),
        });
        document.head.appendChild(productLd);
      }

      // FAQ schema (extract from article content if FAQ section exists)
      const contentText = article.contentHtml || "";
      const faqMatch = contentText.match(/<h[23][^>]*>.*?(?:FAQ|よくある質問|Q&A).*?<\/h[23]>([\s\S]*?)(?=<h[23]|$)/i);
      if (faqMatch) {
        const faqSection = faqMatch[1];
        const qaRegex = /<(?:strong|b|h4)[^>]*>(.*?)<\/(?:strong|b|h4)>\s*(?:<br\s*\/?>)?\s*<p[^>]*>(.*?)<\/p>/gi;
        const faqs: { question: string; answer: string }[] = [];
        let match;
        while ((match = qaRegex.exec(faqSection)) !== null) {
          const q = match[1].replace(/<[^>]*>/g, "").trim();
          const a = match[2].replace(/<[^>]*>/g, "").trim();
          if (q && a) faqs.push({ question: q, answer: a });
        }
        if (faqs.length > 0) {
          const faqLd = document.createElement("script");
          faqLd.type = "application/ld+json";
          faqLd.setAttribute("data-blog", "true");
          faqLd.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map(f => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          });
          document.head.appendChild(faqLd);
        }
      }

      return () => {
        document.title = "LCJ MALL";
        const ldElements = document.querySelectorAll('script[type="application/ld+json"][data-blog]');
        ldElements.forEach(el => el.remove());
        canonicalLink?.remove();
      };
    }
  }, [article, categories, tags]);

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId || !categories) return null;
    return categories.find((c) => c.id === categoryId)?.name;
  };

  const getTagNames = (tagIds: number[]) => {
    if (!tags || tagIds.length === 0) return [];
    return tags.filter((t) => tagIds.includes(t.id));
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: article?.title, url: window.location.href });
      } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("URLをコピーしました");
    }
  };

  const readingTime = article?.contentHtml
    ? Math.max(1, Math.ceil(article.contentHtml.replace(/<[^>]*>/g, "").length / 400))
    : 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">📝</p>
          <h1 className="text-2xl font-bold mb-2">記事が見つかりません</h1>
          <p className="text-muted-foreground mb-4">
            お探しの記事は存在しないか、非公開になっています。
          </p>
          <Button onClick={() => navigate("/blog")}>ブログ一覧に戻る</Button>
        </div>
      </div>
    );
  }

  if (article.status !== "published") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">🔒</p>
          <h1 className="text-2xl font-bold mb-2">この記事は非公開です</h1>
          <Button onClick={() => navigate("/blog")}>ブログ一覧に戻る</Button>
        </div>
      </div>
    );
  }

  const categoryName = getCategoryName(article.categoryId);
  const articleTags = getTagNames(article.tagIds || []);
  const relatedProducts = article.relatedProducts || [];
  const relatedArticles = article.relatedArticles || [];
  const salesRanking = article.salesRanking || [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/blog")} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            ブログ一覧
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1">
            <Share2 className="h-4 w-4" />
            シェア
          </Button>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="max-w-5xl mx-auto px-4 pt-4 pb-2" aria-label="パンくずリスト">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
          <li>
            <Link href="/" className="hover:text-pink-600 transition-colors">ホーム</Link>
          </li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li>
            <Link href="/blog" className="hover:text-pink-600 transition-colors">ブログ</Link>
          </li>
          {categoryName && (
            <>
              <li><ChevronRight className="h-3 w-3" /></li>
              <li>
                <Link href={`/blog?category=${article.categoryId}`} className="hover:text-pink-600 transition-colors">
                  {categoryName}
                </Link>
              </li>
            </>
          )}
          <li><ChevronRight className="h-3 w-3" /></li>
          <li className="text-gray-900 font-medium line-clamp-1 max-w-[200px]">{article.title}</li>
        </ol>
      </nav>

      {/* Main content with sidebar */}
      <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col lg:flex-row gap-8">
        {/* Article main column */}
        <article className="flex-1 min-w-0">
          {/* Category & Tags */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {categoryName && (
              <Link href={`/blog?category=${article.categoryId}`}>
                <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-pink-100">
                  <FolderOpen className="h-3 w-3" />
                  {categoryName}
                </Badge>
              </Link>
            )}
            {articleTags.map((tag) => (
              <Link key={tag.id} href={`/blog/tag/${tag.id}`}>
                <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:border-pink-300">
                  <Tag className="h-3 w-3" />
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight">{article.title}</h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {article.publishedAt
                ? new Date(article.publishedAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
                : new Date(article.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              約{readingTime}分で読めます
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {article.viewCount}回閲覧
            </span>
          </div>

          {/* Cover Image */}
          {article.coverImageUrl && (
            <div className="mb-8 rounded-xl overflow-hidden">
              <img src={article.coverImageUrl} alt={article.title} className="w-full object-cover" />
            </div>
          )}

          {/* Excerpt */}
          {article.excerpt && (
            <div className="bg-pink-50 border-l-4 border-pink-500 p-4 rounded-r-lg mb-8">
              <p className="text-gray-700 italic">{article.excerpt}</p>
            </div>
          )}

          {/* Content */}
          <div
            className="blog-article-content prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: article.contentHtml || "" }}
          />

          {/* Related Products Section (inline) */}
          {relatedProducts.length > 0 && (
            <section className="mt-10 pt-8 border-t">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-pink-500" />
                この記事に関連する商品
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedProducts.map((p: any) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={() => navigate("/mall")} className="gap-1">
                  <ShoppingBag className="h-4 w-4" />
                  ショップで全商品を見る
                </Button>
              </div>
            </section>
          )}

          {/* Related Articles Section */}
          {relatedArticles.length > 0 && (
            <section className="mt-10 pt-8 border-t">
              <h2 className="text-xl font-bold mb-4">関連記事</h2>
              <div className="space-y-1">
                {relatedArticles.map((a: any) => (
                  <RelatedArticleCard key={a.id} article={a} />
                ))}
              </div>
            </section>
          )}

          {/* Share CTA */}
          <div className="mt-10 pt-8 border-t text-center">
            <p className="text-muted-foreground mb-3">この記事が役に立ったらシェアしてください</p>
            <Button onClick={handleShare} variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" />
              記事をシェア
            </Button>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
          {/* Sales Ranking */}
          <SalesRankingWidget products={salesRanking} />

          {/* Category Hub */}
          {categoryHub && categoryHub.length > 0 && (
            <div className="border rounded-xl p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4 text-pink-500" />
                カテゴリ
              </h3>
              <div className="space-y-1.5">
                {categoryHub.filter((c: any) => c.articleCount > 0).map((cat: any) => (
                  <Link key={cat.id} href={`/blog?category=${cat.id}`}>
                    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-pink-50 transition-colors cursor-pointer text-sm">
                      <span>{cat.name}</span>
                      <Badge variant="secondary" className="text-xs">{cat.articleCount}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tag Hub */}
          {tagHub && tagHub.length > 0 && (
            <div className="border rounded-xl p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-pink-500" />
                タグ
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tagHub.filter((t: any) => t.articleCount > 0).map((tag: any) => (
                  <Link key={tag.id} href={`/blog/tag/${tag.id}`}>
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:border-pink-300 hover:bg-pink-50"
                    >
                      {tag.name} ({tag.articleCount})
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA: Shop */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl p-4 text-white text-center">
            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-90" />
            <p className="font-bold text-sm mb-1">LCJ MALL</p>
            <p className="text-xs text-pink-100 mb-3">TikTok Shopの人気商品をチェック</p>
            <Button
              size="sm"
              variant="secondary"
              className="w-full bg-white text-pink-600 hover:bg-pink-50"
              onClick={() => navigate("/mall")}
            >
              ショップを見る
            </Button>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <Button variant="link" onClick={() => navigate("/blog")} className="text-pink-600">
            他の記事を読む
          </Button>
          <p className="text-sm text-muted-foreground mt-2">
            LCJ MALL メディア - TikTok Shopで買う。そのすべてが、価値になる。
          </p>
        </div>
      </footer>

      {/* Article Content Styles */}
      <style>{`
        .blog-article-content h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          border-bottom: 2px solid #ec4899;
          padding-bottom: 0.5rem;
          color: #111827;
        }
        .blog-article-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #111827;
        }
        .blog-article-content p {
          margin-bottom: 1rem;
          line-height: 1.8;
          color: #374151;
        }
        .blog-article-content blockquote {
          border-left: 3px solid #ec4899;
          padding-left: 1rem;
          margin: 1.5rem 0;
          color: #6b7280;
          font-style: italic;
        }
        .blog-article-content ul,
        .blog-article-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        .blog-article-content li {
          margin: 0.5rem 0;
          line-height: 1.7;
        }
        .blog-article-content pre {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 1rem;
          border-radius: 0.75rem;
          overflow-x: auto;
          margin: 1.5rem 0;
        }
        .blog-article-content img {
          max-width: 100%;
          border-radius: 0.75rem;
          margin: 1.5rem 0;
        }
        .blog-article-content a {
          color: #ec4899;
          text-decoration: underline;
        }
        .blog-article-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
        }
        .blog-article-content th,
        .blog-article-content td {
          border: 1px solid #e5e7eb;
          padding: 0.75rem;
          text-align: left;
        }
        .blog-article-content th {
          background: #f9fafb;
          font-weight: 600;
        }
        .blog-article-content .product-card-embed {
          margin: 1.5rem 0;
        }
        .blog-article-content .product-card-embed > div {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #fafafa;
        }
      `}</style>
    </div>
  );
}

function setMetaTag(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}
