import { useMemo } from "react";
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
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { useLocation, useRoute, Link } from "wouter";

export default function BlogTagPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/blog/tag/:tagId");
  const tagId = params?.tagId ? parseInt(params.tagId) : 0;

  const { data: tags } = trpc.blog.listTags.useQuery();
  const tag = tags?.find((t: any) => t.id === tagId);

  usePageSEO({
    title: tag ? `${tag.name} - ブログタグ` : `タグ #${tagId}`,
    description: tag ? `LCJ MALLブログの「${tag.name}」タグが付いた記事一覧です。` : undefined,
    canonical: `${window.location.origin}/blog/tag/${tagId}`,
    ogType: "website",
  });

  const queryInput = useMemo(() => ({ tagId, limit: 20, offset: 0 }), [tagId]);
  const { data, isLoading } = trpc.blog.listByTag.useQuery(queryInput, { enabled: tagId > 0 });

  const articles = data?.articles || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50/50 to-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/blog")} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            ブログ一覧
          </Button>
        </div>
      </header>

      {/* Breadcrumb */}
      <nav className="max-w-5xl mx-auto px-4 pt-3 pb-1" aria-label="パンくずリスト">
        <ol className="flex items-center gap-1 text-xs text-muted-foreground">
          <li><Link href="/" className="hover:text-pink-600 transition-colors">ホーム</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li><Link href="/blog" className="hover:text-pink-600 transition-colors">ブログ</Link></li>
          <li><ChevronRight className="h-3 w-3" /></li>
          <li className="text-gray-900 font-medium">
            <Tag className="h-3 w-3 inline mr-1" />
            {tag?.name || `タグ #${tagId}`}
          </li>
        </ol>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="h-6 w-6 text-pink-500" />
            {tag?.name || `タグ #${tagId}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {articles.length}件の記事
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
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
            <p className="text-lg">このタグの記事はまだありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        )}
      </div>

      <footer className="border-t bg-gray-50 py-8 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>LCJ MALL メディア - TikTok Shopで買う。そのすべてが、価値になる。</p>
        </div>
      </footer>
    </div>
  );
}
