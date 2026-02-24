import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import {
  Star,
  Package,
  ChevronRight,
  BookOpen,
  MessageSquare,
  ShoppingCart,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BrandDetailPage() {
  const params = useParams<{ brandId: string }>();
  const brandId = Number(params.brandId);

  const { data, isLoading } = trpc.blog.brandDetail.useQuery(
    { brandId },
    { enabled: !!brandId && !isNaN(brandId) }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="container max-w-6xl py-10">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">ブランドが見つかりません</h1>
          <Link href="/brands">
            <Button variant="outline">ブランド一覧に戻る</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { brand, products, articles, reviews } = data;

  // 構造化データ
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: brand.name,
    ...(brand.logoUrl && { logo: brand.logoUrl }),
    ...(brand.description && { description: brand.description }),
    url: `${window.location.origin}/brands/${brand.id}`,
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ホーム", item: window.location.origin },
      { "@type": "ListItem", position: 2, name: "ブランド一覧", item: `${window.location.origin}/brands` },
      { "@type": "ListItem", position: 3, name: brand.name, item: `${window.location.origin}/brands/${brand.id}` },
    ],
  };

  const productListData = products.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${brand.name} 商品一覧`,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p: any, i: number) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.name,
        ...(p.imageUrl && { image: p.imageUrl }),
        offers: {
          "@type": "Offer",
          price: p.price,
          priceCurrency: "JPY",
          availability: "https://schema.org/InStock",
        },
      },
    })),
  } : null;

  // レビュー平均を計算
  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      {productListData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productListData) }} />
      )}

      {/* ブランドヘッダー */}
      <div className="bg-white border-b">
        <div className="container max-w-6xl py-8">
          <nav className="text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary">ホーム</Link>
            <ChevronRight className="inline w-3 h-3 mx-1" />
            <Link href="/brands" className="hover:text-primary">ブランド一覧</Link>
            <ChevronRight className="inline w-3 h-3 mx-1" />
            <span className="text-foreground font-medium">{brand.name}</span>
          </nav>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* ロゴ */}
            {brand.logoUrl ? (
              <div className="bg-white border rounded-xl p-4 flex items-center justify-center w-32 h-32 shrink-0">
                <img src={brand.logoUrl} alt={brand.name} className="max-h-20 max-w-[100px] object-contain" />
              </div>
            ) : (
              <div className="bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl p-4 flex items-center justify-center w-32 h-32 shrink-0">
                <span className="text-2xl font-bold text-primary">{brand.name.slice(0, 2)}</span>
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">{brand.name}</h1>
              {brand.nameEn && brand.nameEn !== "Test Brand" && (
                <p className="text-muted-foreground mt-1">{brand.nameEn}</p>
              )}
              {brand.description && (
                <p className="text-muted-foreground mt-2 max-w-2xl">{brand.description}</p>
              )}

              {/* 統計バッジ */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Badge variant="secondary" className="gap-1">
                  <Package className="w-3 h-3" />
                  {products.length}商品
                </Badge>
                {reviews.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {avgRating} ({reviews.length}件のレビュー)
                  </Badge>
                )}
                {articles.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="w-3 h-3" />
                    {articles.length}件の関連記事
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="container max-w-6xl py-10">
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="mb-8">
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="w-4 h-4" />
              商品一覧 ({products.length})
            </TabsTrigger>
            {articles.length > 0 && (
              <TabsTrigger value="articles" className="gap-1.5">
                <BookOpen className="w-4 h-4" />
                関連記事 ({articles.length})
              </TabsTrigger>
            )}
            {reviews.length > 0 && (
              <TabsTrigger value="reviews" className="gap-1.5">
                <MessageSquare className="w-4 h-4" />
                レビュー ({reviews.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* 商品タブ */}
          <TabsContent value="products">
            {products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product: any) => (
                  <Link key={product.id} href={`/mall/product/${product.id}`}>
                    <Card className="group hover:shadow-md transition-all cursor-pointer overflow-hidden h-full border-0 shadow-sm">
                      <div className="aspect-square bg-gray-50 overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Package className="w-12 h-12 opacity-20" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-lg font-bold text-primary">
                            ¥{product.price?.toLocaleString()}
                          </span>
                          {product.orderCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {product.orderCount}件販売
                            </span>
                          )}
                        </div>
                        {product.categoryName && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {product.categoryName}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>現在このブランドの商品はありません</p>
              </div>
            )}
          </TabsContent>

          {/* 関連記事タブ */}
          <TabsContent value="articles">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {articles.map((article: any) => (
                <Link key={article.id} href={`/blog/${article.slug}`}>
                  <Card className="group hover:shadow-md transition-all cursor-pointer overflow-hidden h-full border-0 shadow-sm">
                    <div className="flex gap-4 p-4">
                      {article.coverImageUrl && (
                        <div className="w-32 h-24 rounded-lg overflow-hidden shrink-0 bg-gray-50">
                          <img
                            src={article.coverImageUrl}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {article.excerpt}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {article.publishedAt && (
                            <span>{new Date(article.publishedAt).toLocaleDateString("ja-JP")}</span>
                          )}
                          {article.viewCount > 0 && <span>{article.viewCount}回閲覧</span>}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </TabsContent>

          {/* レビュータブ */}
          <TabsContent value="reviews">
            <div className="space-y-4">
              {/* レビューサマリー */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-primary">{avgRating}</div>
                    <div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i < Math.round(avgRating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{reviews.length}件のレビュー</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* レビュー一覧 */}
              {reviews.map((review: any) => (
                <Card key={review.id} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {review.productImageUrl && (
                        <Link href={`/mall/product/${review.productId}`}>
                          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-50">
                            <img
                              src={review.productImageUrl}
                              alt={review.productName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        </Link>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3.5 h-3.5 ${
                                  i < review.rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-200"
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {review.createdAt && new Date(review.createdAt).toLocaleDateString("ja-JP")}
                          </span>
                        </div>
                        <Link href={`/mall/product/${review.productId}`}>
                          <span className="text-sm font-medium text-primary hover:underline">
                            {review.productName}
                          </span>
                        </Link>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                        )}
                        {review.imageUrl && (
                          <div className="mt-3">
                            <img
                              src={review.imageUrl}
                              alt="レビュー画像"
                              className="max-h-40 rounded-lg object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
