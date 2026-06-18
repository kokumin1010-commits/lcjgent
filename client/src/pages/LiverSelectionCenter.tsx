import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Search, ShoppingBag, TrendingUp, Check } from "lucide-react";
import { toast } from "sonner";

export default function LiverSelectionCenter() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("browse");

  // Get liver ID from localStorage (set during liver login)
  const liverData = JSON.parse(localStorage.getItem("liver_auth") || "{}");
  const anchorId = liverData?.liverId;

  const productsQuery = trpc.selectionCenter.getLiverAvailableProducts.useQuery({
    search: search || undefined,
  });
  const mySelectionsQuery = trpc.selectionCenter.getLiverMySelections.useQuery({ anchorId });
  const myPerformanceQuery = trpc.selectionCenter.getLiverMyPerformance.useQuery({ anchorId });

  const selectMutation = trpc.selectionCenter.liverSelectProduct.useMutation({
    onSuccess: () => {
      mySelectionsQuery.refetch();
      toast.success("選品しました！");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const selectedProductIds = new Set(mySelectionsQuery.data?.map((s: any) => s.productId) || []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShoppingBag className="h-6 w-6" />
        選品センター
      </h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="browse"><Package className="h-4 w-4 mr-1" />商品一覧</TabsTrigger>
          <TabsTrigger value="my-selections"><ShoppingBag className="h-4 w-4 mr-1" />マイ選品</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="h-4 w-4 mr-1" />帯貨実績</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="商品名・ブランド名で検索..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productsQuery.data?.map((product: any) => (
              <Card key={product.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{product.productName}</h3>
                      <p className="text-sm text-muted-foreground">{product.brandName}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="font-medium text-orange-600">¥{Number(product.price || 0).toLocaleString()}</span>
                        <Badge variant="outline">
                          佣金: {product.commissionType === "percentage" ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                        </Badge>
                      </div>
                      {product.sellingPoints && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.sellingPoints}</p>
                      )}
                    </div>
                    <div>
                      {selectedProductIds.has(product.id) ? (
                        <Button size="sm" variant="secondary" disabled><Check className="h-4 w-4 mr-1" />選品済</Button>
                      ) : (
                        <Button size="sm" onClick={() => selectMutation.mutate({ productId: product.id, anchorId })} disabled={selectMutation.isPending}>
                          選品する
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!productsQuery.data || productsQuery.data.length === 0) && (
              <div className="col-span-2 text-center py-12 text-muted-foreground">公開中の商品がありません</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="my-selections" className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">商品名</th>
                  <th className="text-left p-3">ブランド</th>
                  <th className="text-center p-3">佣金</th>
                  <th className="text-center p-3">配信予定日</th>
                  <th className="text-center p-3">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {mySelectionsQuery.data?.map((s: any) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-3 font-medium">{s.productName}</td>
                    <td className="p-3 text-muted-foreground">{s.brandName}</td>
                    <td className="p-3 text-center">
                      {s.commissionType === "percentage" ? `${s.commissionValue}%` : `¥${s.commissionValue}`}
                    </td>
                    <td className="p-3 text-center">{s.scheduledDate || "未定"}</td>
                    <td className="p-3 text-center">
                      <Badge variant={s.status === "completed" ? "default" : s.status === "scheduled" ? "secondary" : "outline"}>
                        {s.status === "selected" ? "選品済" : s.status === "scheduled" ? "排期済" : "完了"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(!mySelectionsQuery.data || mySelectionsQuery.data.length === 0) && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">まだ選品していません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">配信日</th>
                  <th className="text-left p-3">商品</th>
                  <th className="text-right p-3">GMV</th>
                  <th className="text-right p-3">販売数</th>
                  <th className="text-right p-3">佣金</th>
                </tr>
              </thead>
              <tbody>
                {myPerformanceQuery.data?.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3">{p.liveDate}</td>
                    <td className="p-3">{p.productName}</td>
                    <td className="p-3 text-right">¥{Number(p.gmv || 0).toLocaleString()}</td>
                    <td className="p-3 text-right">{p.salesCount || 0}</td>
                    <td className="p-3 text-right font-medium text-green-600">¥{Number(p.commissionAmount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {(!myPerformanceQuery.data || myPerformanceQuery.data.length === 0) && (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">帯貨実績がありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
