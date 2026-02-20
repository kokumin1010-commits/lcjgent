import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  Eye,
  Tag,
  FolderOpen,
  Share2,
  Clock,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

// Render product card embeds from HTML
function renderContentWithProductCards(html: string, products?: any[]) {
  // Replace product-card-embed divs with styled versions
  return html;
}

export default function BlogArticlePage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug || "";

  const { data: article, isLoading, error } = trpc.blog.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );
  const { data: categories } = trpc.blog.listCategories.useQuery();
  const { data: tags } = trpc.blog.listTags.useQuery();

  // Set page title and meta for SEO
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

      // Set JSON-LD structured data
      const existingLd = document.querySelector('script[type="application/ld+json"][data-blog]');
      if (existingLd) existingLd.remove();
      const ldScript = document.createElement("script");
      ldScript.type = "application/ld+json";
      ldScript.setAttribute("data-blog", "true");
      ldScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.seoTitle || article.title,
        description: article.seoDescription || article.excerpt || "",
        image: article.ogImageUrl || article.coverImageUrl || "",
        datePublished: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
        dateModified: new Date(article.updatedAt).toISOString(),
        publisher: {
          "@type": "Organization",
          name: "LCJ MALL",
        },
      });
      document.head.appendChild(ldScript);

      return () => {
        document.title = "LCJ MALL";
        ldScript.remove();
      };
    }
  }, [article]);

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
        await navigator.share({
          title: article?.title,
          url: window.location.href,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("URLをコピーしました");
    }
  };

  // Estimate reading time
  const readingTime = article?.contentHtml
    ? Math.max(1, Math.ceil(article.contentHtml.replace(/<[^>]*>/g, "").length / 400))
    : 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
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

  // Only show published articles
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/blog")}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            ブログ一覧
          </Button>
          <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1">
            <Share2 className="h-4 w-4" />
            シェア
          </Button>
        </div>
      </header>

      {/* Article */}
      <article className="max-w-3xl mx-auto px-4 py-8">
        {/* Category & Tags */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {categoryName && (
            <Badge variant="secondary" className="gap-1">
              <FolderOpen className="h-3 w-3" />
              {categoryName}
            </Badge>
          )}
          {articleTags.map((tag) => (
            <Badge key={tag.id} variant="outline" className="gap-1 text-xs">
              <Tag className="h-3 w-3" />
              {tag.name}
            </Badge>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {article.publishedAt
              ? new Date(article.publishedAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : new Date(article.createdAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
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
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className="w-full object-cover"
            />
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

        {/* Share CTA */}
        <div className="mt-12 pt-8 border-t text-center">
          <p className="text-muted-foreground mb-3">この記事が役に立ったらシェアしてください</p>
          <Button onClick={handleShare} variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            記事をシェア
          </Button>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 mt-12">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Button
            variant="link"
            onClick={() => navigate("/blog")}
            className="text-pink-600"
          >
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
