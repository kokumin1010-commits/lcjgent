import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { usePageSEO } from "@/hooks/usePageSEO";
import { Star, Package, ShoppingCart, ChevronRight, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function BrandListPage() {
  usePageSEO({
    title: "ブランド一覧 - LCJ MALL",
    description: "LCJ MALL取り扱いブランド一覧。美容・ヘアケア・スキンケアの人気ブランドをご紹介。",
    canonical: `${window.location.origin}/brands`,
    ogType: "website",
    keywords: "LCJ MALL, ブランド, 美容, ヘアケア, KYOGOKU",
  });
  const { data: brands, isLoading } = trpc.blog.brandList.useQuery();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* パンくず + 構造化データ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "ホーム", item: window.location.origin },
              { "@type": "ListItem", position: 2, name: "ブランド一覧", item: `${window.location.origin}/brands` },
            ],
          }),
        }}
      />

      {/* ヘッダー */}
      <div className="bg-white border-b">
        <div className="container max-w-6xl py-8">
          <nav className="text-sm text-muted-foreground mb-4">
            <Link href="/" className="hover:text-primary">ホーム</Link>
            <ChevronRight className="inline w-3 h-3 mx-1" />
            <span className="text-foreground font-medium">ブランド一覧</span>
          </nav>
          <div className="flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">取り扱いブランド</h1>
              <p className="text-muted-foreground mt-1">
                LCJ MALLで取り扱っている美容・ヘアケアブランドの一覧です
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ブランドグリッド */}
      <div className="container max-w-6xl py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : brands && brands.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <Link key={brand.id} href={`/brands/${brand.id}`}>
                <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-sm overflow-hidden h-full">
                  {/* ブランドロゴ/ヘッダー */}
                  <div className="bg-gradient-to-br from-primary/5 to-primary/10 p-6 flex items-center justify-center min-h-[120px]">
                    {brand.logoUrl ? (
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="max-h-16 max-w-[200px] object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="text-2xl font-bold text-primary/80 group-hover:text-primary transition-colors">
                        {brand.name}
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5">
                    <h2 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                      {brand.name}
                    </h2>
                    {brand.nameEn && brand.nameEn !== "Test Brand" && (
                      <p className="text-xs text-muted-foreground mb-3">{brand.nameEn}</p>
                    )}

                    {brand.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {brand.description}
                      </p>
                    )}

                    {/* 統計 */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Package className="w-4 h-4" />
                        <span>{brand.productCount}商品</span>
                      </div>
                      {brand.orderCount > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ShoppingCart className="w-4 h-4" />
                          <span>{brand.orderCount}件販売</span>
                        </div>
                      )}
                      {brand.avgRating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{brand.avgRating}</span>
                          <span className="text-muted-foreground">({brand.reviewCount})</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>現在登録されているブランドはありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
