import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Calendar,
  Eye,
  Search,
  Tag,
  FolderOpen,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

export default function BlogListPage() {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const LIMIT = 12;

  const queryInput = useMemo(() => ({
    categoryId: selectedCategory || undefined,
    limit: LIMIT,
    offset: page * LIMIT,
  }), [selectedCategory, page]);

  const { data, isLoading } = trpc.blog.listPublished.useQuery(queryInput);
  const { data: categories } = trpc.blog.listCategories.useQuery();

  const articles = data?.articles || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              LCJ MALL
            </Button>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-lg font-bold text-pink-600">ブログ</h1>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-pink-500 to-rose-500 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            LCJ MALL メディア
          </h2>
          <p className="text-pink-100 text-lg max-w-2xl mx-auto">
            TikTok Shopの最新トレンド、商品レビュー、お得情報をお届けします
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Category Filter */}
        {categories && categories.length > 0 && (
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCategory(null);
                setPage(0);
              }}
              className="flex-shrink-0"
            >
              すべて
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setPage(0);
                }}
                className="flex-shrink-0"
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {/* Articles Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
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
                    <div className="aspect-video bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center">
                      <span className="text-4xl">📝</span>
                    </div>
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
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  前へ
                </Button>
                <span className="flex items-center px-3 text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  次へ
                </Button>
              </div>
            )}
          </>
        )}
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
