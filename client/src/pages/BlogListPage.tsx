import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  Eye,
  Tag,
  FolderOpen,
  ChevronRight,
  TrendingUp,
  ShoppingBag,
  Star,
  Users,
  BookOpen,
  Sparkles,
  Lightbulb,
  Heart,
  Zap,
} from "lucide-react";
import { useLocation, Link } from "wouter";

// Category-based gradient & icon fallback for articles without cover images
const CATEGORY_THEMES: Record<number, { gradient: string; icon: React.ReactNode }> = {};
const DEFAULT_GRADIENTS = [
  { gradient: "from-rose-400 to-pink-600", icon: <Heart className="h-10 w-10 text-white/60" /> },
  { gradient: "from-violet-400 to-purple-600", icon: <Sparkles className="h-10 w-10 text-white/60" /> },
  { gradient: "from-sky-400 to-blue-600", icon: <BookOpen className="h-10 w-10 text-white/60" /> },
  { gradient: "from-emerald-400 to-teal-600", icon: <Lightbulb className="h-10 w-10 text-white/60" /> },
  { gradient: "from-amber-400 to-orange-600", icon: <Zap className="h-10 w-10 text-white/60" /> },
  { gradient: "from-fuchsia-400 to-pink-600", icon: <Star className="h-10 w-10 text-white/60" /> },
];

function getArticleFallback(categoryId: number | null, articleId: number) {
  const idx = categoryId ? (categoryId % DEFAULT_GRADIENTS.length) : (articleId % DEFAULT_GRADIENTS.length);
  return DEFAULT_GRADIENTS[idx];
}

export default function BlogListPage() {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  usePageSEO({
    title: "ブログ - LCJ MALLメディア",
    description: "LCJ MALLのブログ記事一覧。ポイ活・レシート副業・TikTok Shop・ライブコマース・美容・ヘアケアなどの最新情報をお届けします。",
    canonical: `${window.location.origin}/blog`,
    ogType: "website",
    keywords: "LCJ MALL, ブログ, ポイ活, レシート副業, TikTok Shop, ライブコマース, 美容, ヘアケア",
  });
  const [page, setPage] = useState(0);
  const LIMIT = 12;

  const queryInput = useMemo(
    () => ({
      categoryId: selectedCategory || undefined,
      limit: LIMIT,
      offset: page * LIMIT,
    }),
    [selectedCategory, page]
  );

  const { data, isLoading } = trpc.blog.listPublished.useQuery(queryInput);
  const { data: categoryHub } = trpc.blog.categoryHub.useQuery();
  const { data: tagHub } = trpc.blog.tagHub.useQuery();
  const { data: salesRanking } = trpc.blog.productRanking.useQuery({ limit: 5 });

  const articles = data?.articles || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              LCJ MALL
            </Button>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-bold text-pink-600">ブログ</h1>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="max-w-6xl mx-auto px-4 pt-3 pb-1" aria-label="パンくずリスト">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground">
          <li><Link href="/" className="hover:text-pink-600 transition-colors">ホーム</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li className="text-gray-900 font-medium">ブログ</li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-r from-pink-500 to-rose-500 text-white py-10 px-4 mt-2">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">LCJ MALL メディア</h2>
          <p className="text-pink-100 text-lg max-w-2xl mx-auto">
            美容・ヘアケアの専門知識、商品比較、購入ガイドをお届けします
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Category Filter */}
          {categoryHub && categoryHub.length > 0 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="sm"
                onClick={() => { setSelectedCategory(null); setPage(0); }}
                className="flex-shrink-0"
              >
                すべて
              </Button>
              {categoryHub.map((cat: any) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setSelectedCategory(cat.id); setPage(0); }}
                  className="flex-shrink-0 gap-1"
                >
                  {cat.name}
                  {cat.articleCount > 0 && (
                    <span className="text-xs opacity-70">({cat.articleCount})</span>
                  )}
                </Button>
              ))}
            </div>
          )}

          {/* Articles Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-48 w-full rounded-xl" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg">記事がまだありません</p>
              <p className="text-sm mt-1">近日公開予定です。お楽しみに！</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {articles.map((article: any) => (
                  <article
                    key={article.id}
                    className="group bg-white rounded-xl shadow-sm border hover:shadow-md transition-all cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/blog/${article.slug}`)}
                  >
                    {article.coverImageUrl ? (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={article.coverImageUrl}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      (() => {
                        const fb = getArticleFallback(article.categoryId, article.id);
                        return (
                          <div className={`aspect-video bg-gradient-to-br ${fb.gradient} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
                            <div className="absolute inset-0 opacity-10">
                              <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
                              <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full bg-white/20 blur-xl" />
                            </div>
                            {fb.icon}
                            <p className="text-white/90 text-sm font-medium mt-3 line-clamp-2 text-center px-4 relative z-10">
                              {article.title}
                            </p>
                          </div>
                        );
                      })()
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-pink-600 transition-colors">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {article.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {article.publishedAt
                            ? new Date(article.publishedAt).toLocaleDateString("ja-JP")
                            : new Date(article.createdAt).toLocaleDateString("ja-JP")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.viewCount}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    前へ
                  </Button>
                  <span className="flex items-center px-3 text-sm text-muted-foreground">
                    {page + 1} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                    次へ
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
          {/* Sales Ranking */}
          {salesRanking && salesRanking.length > 0 && (
            <div className="bg-gradient-to-b from-amber-50 to-white border border-amber-200 rounded-xl p-4">
              <h3 className="font-bold text-sm flex items-center gap-1.5 mb-3 text-amber-800">
                <TrendingUp className="h-4 w-4" />
                売れ筋ランキング
              </h3>
              <div className="space-y-2.5">
                {salesRanking.map((p: any, idx: number) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5 cursor-pointer hover:bg-amber-50 rounded-lg p-1.5 transition-colors"
                    onClick={() => navigate(`/mall/products/${p.id}`)}
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
          )}

          {/* Category Hub */}
          {categoryHub && categoryHub.length > 0 && (
            <div className="border rounded-xl p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4 text-pink-500" />
                カテゴリ
              </h3>
              <div className="space-y-1.5">
                {categoryHub.filter((c: any) => c.articleCount > 0).map((cat: any) => (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-pink-50 transition-colors cursor-pointer text-sm ${
                      selectedCategory === cat.id ? "bg-pink-50 text-pink-600 font-medium" : ""
                    }`}
                    onClick={() => { setSelectedCategory(cat.id); setPage(0); }}
                  >
                    <span>{cat.name}</span>
                    <Badge variant="secondary" className="text-xs">{cat.articleCount}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tag Hub */}
          {tagHub && tagHub.length > 0 && (
            <div className="border rounded-xl p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-pink-500" />
                人気タグ
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tagHub.filter((t: any) => t.articleCount > 0).slice(0, 20).map((tag: any) => (
                  <Link key={tag.id} href={`/blog/tag/${tag.id}`}>
                    <Badge variant="outline" className="text-xs cursor-pointer hover:border-pink-300 hover:bg-pink-50">
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
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>LCJ MALL メディア - TikTok Shopで買う。そのすべてが、価値になる。</p>
        </div>
      </footer>
    </div>
  );
}
