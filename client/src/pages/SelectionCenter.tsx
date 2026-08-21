import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, ChevronDown, Pencil, RefreshCw, Search, TrendingUp, Calendar, DollarSign, BarChart3, Edit, Trash2, Eye, CheckCircle, ShoppingBag, Check, X, ImagePlus, Loader2, ScanBarcode, ClipboardList, Zap, Vote, Link2, Copy, ExternalLink, Download, Sparkles, ShoppingCart, Building2, Lock, HelpCircle, Layers, Gift, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== Product Bundle Badge ====================
function ProductBundleBadge({ productId }: { productId: number }) {
  const [enabled, setEnabled] = useState(false);
  const bundlesQuery = trpc.selectionCenter.getBundlesForProduct.useQuery({ productId }, { enabled });
  const bundles = bundlesQuery.data || [];
  if (!enabled) return <span className="text-muted-foreground text-xs cursor-pointer hover:text-purple-500" onMouseEnter={() => setEnabled(true)}>...</span>;
  if (bundlesQuery.isLoading) return <span className="text-muted-foreground text-xs">...</span>;
  if (bundles.length === 0) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {bundles.map((b: any) => (
        <span key={b.id} className="inline-flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
          <Layers className="h-2.5 w-2.5" />{b.bundleName}
        </span>
      ))}
    </div>
  );
}

// ==================== Products Tab ====================
function ProductsTab() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<number>>(new Set());
  const toggleParentExpand = (id: number) => {
    setExpandedParentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);

  const productsQuery = trpc.selectionCenter.getProducts.useQuery({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter as any,
    page: currentPage,
    pageSize: pageSize,
  });

  const protectionQuery = trpc.selectionCenter.getPriceProtectionStatus.useQuery(undefined, { enabled: !!productsQuery.data });
  const protectionMap = React.useMemo(() => {
    const map: Record<number, { lastPrice: number; lastChangedAt: string; daysSinceChange: number; protectionDaysLeft: number; status: 'safe' | 'caution' | 'danger' }> = {};
    (protectionQuery.data || []).forEach((p: any) => { map[p.productId] = p; });
    return map;
  }, [protectionQuery.data]);
  const categoriesQuery = trpc.selectionCenter.getCategories.useQuery();
  const liversQuery2 = trpc.selectionCenter.getLivers.useQuery();
  const liversData = liversQuery2.data || [];
  const createMutation = trpc.selectionCenter.createProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); setShowCreateDialog(false); toast.success(t("sc.productAdded")); },
    onError: (err) => { toast.error(err.message || '保存失敗'); console.error('[createProduct]', err); },
  });
  const updateMutation = trpc.selectionCenter.updateProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); setEditProduct(null); toast.success(t("sc.productUpdated")); },
    onError: (err) => { toast.error(err.message || '更新失敗'); console.error('[updateProduct]', err); },
  });
  const statusMutation = trpc.selectionCenter.updateProductStatus.useMutation({
    onSuccess: () => { productsQuery.refetch(); toast.success(t("sc.statusUpdated")); },
  });
  const deleteProductMutation = trpc.selectionCenter.deleteProduct.useMutation({
    onSuccess: () => { productsQuery.refetch(); toast.success(t("sc.productDeleted")); },
  });
  const bulkBrandStatusMutation = trpc.selectionCenter.bulkUpdateBrandStatus.useMutation({
    onSuccess: (data) => { productsQuery.refetch(); toast.success(`${data.affectedCount}件の商品を更新しました`); },
    onError: (err) => { toast.error(err.message || '一括更新失敗'); },
  });

  const createPollMutation = trpc.poll.create.useMutation({
    onSuccess: (data) => {
      const url = `${window.location.origin}/vote/${data.id}`;
      navigator.clipboard.writeText(url);
      toast.success(t("sc.polls.created") + " - " + t("sc.polls.linkCopied"));
    },
  });

  function createPollFromProduct(product: any) {
    createPollMutation.mutate({
      productId: product.id,
      productName: product.productName,
      brandName: product.brandName || undefined,
      imageUrl: product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images)?.[0] : undefined,
      description: product.sellingPoints || undefined,
      originalPrice: product.price ? Number(product.price) : undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("sc.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sc.all")}</SelectItem>
            <SelectItem value="draft">{t("sc.draft")}</SelectItem>
            <SelectItem value="online">{t("sc.online")}</SelectItem>
            <SelectItem value="offline">{t("sc.offline")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="ブランド" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ブランド</SelectItem>
            {(() => {
              const brands = Array.from(new Set((productsQuery.data?.items || []).map((p: any) => p.brandName).filter(Boolean))).sort();
              return brands.map((b: any) => <SelectItem key={b} value={b}>{b}</SelectItem>);
            })()}
          </SelectContent>
        </Select>
        {brandFilter !== 'all' && (
          <>
            <Button
              variant="default"
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={bulkBrandStatusMutation.isPending}
              onClick={() => {
                if (confirm(`「${brandFilter}」の全商品を一括上架しますか？`)) {
                  bulkBrandStatusMutation.mutate({ brandName: brandFilter, status: 'online' });
                }
              }}
            >
              <CheckCircle className="h-4 w-4 mr-1" />一括上架
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkBrandStatusMutation.isPending}
              onClick={() => {
                if (confirm(`「${brandFilter}」の全商品を一括下架しますか？`)) {
                  bulkBrandStatusMutation.mutate({ brandName: brandFilter, status: 'offline' });
                }
              }}
            >
              <X className="h-4 w-4 mr-1" />一括下架
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => {
          const products = (productsQuery.data?.items || []).filter((p: any) => {
            if (brandFilter !== 'all' && p.brandName !== brandFilter) return false;
            return true;
          });
          const headers = ['商品名', 'バーコード', 'ブランド', 'カテゴリ', '価格', '佣金', '在庫', 'ステータス'];
          const rows = products.map((p: any) => [
            p.productName || '', p.barcode || '', p.brandName || '', p.category || '',
            p.price || 0, p.commission || 0, p.stock || 0, p.status || ''
          ]);
          const csv = '\uFEFF' + [headers.join(','), ...rows.map((r: any[]) => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `商品一覧_${brandFilter === 'all' ? '全ブランド' : brandFilter}.csv`; a.click();
          URL.revokeObjectURL(url);
          toast.success('CSVエクスポート完了');
        }}><Download className="h-4 w-4 mr-1" />CSV出力</Button>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-1" />{t("sc.addProduct")}</Button>
        <AiRecognitionButton onResult={(data) => { setEditProduct(null); setShowCreateDialog(true); setTimeout(() => { window.__aiProductData = data; window.dispatchEvent(new Event('ai-product-data')); }, 100); }} />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium w-12">{t("sc.image")}</th>
              <th className="text-left p-3 font-medium">{t("sc.productName")}</th>
              <th className="text-left p-3 font-medium">{t("sc.barcode")}</th>
              <th className="text-left p-3 font-medium">{t("sc.brand")}</th>
              <th className="text-left p-3 font-medium">{t("sc.category")}</th>
              <th className="text-right p-3 font-medium">{t("sc.price")}</th>
              <th className="text-right p-3 font-medium text-red-600">历史最低</th>
              <th className="text-center p-3 font-medium text-blue-600">保護期</th>
              <th className="text-right p-3 font-medium">{t("sc.commission")}</th>
              <th className="text-center p-3 font-medium">{t("sc.stock")}</th>
              <th className="text-center p-3 font-medium">{t("sc.status")}</th>
              <th className="text-center p-3 font-medium">套组</th>
              <th className="text-center p-3 font-medium">{t("sc.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {productsQuery.data?.items?.filter((product: any) => (brandFilter === 'all' || product.brandName === brandFilter) && !product.parentProductId).map((product: any) => {
              const category = categoriesQuery.data?.find((c: any) => c.id === product.categoryId);
              return (
                <tr key={product.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    {(() => {
                      const imgs = product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [];
                      return imgs.length > 0 ? (
                        <img src={imgs[0]} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-3 font-medium max-w-[200px]">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="truncate">{product.productName}</span>
                      {!!product.talentExclusive && <span className="inline-block text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium whitespace-nowrap">{t("sc.talentExclusive")}</span>}
                    </div>
                    {product.productNameCn && <span className="text-xs text-blue-400 block">{product.productNameCn}</span>}
                    {product.productId && <span className="text-xs text-muted-foreground block">ID: {product.productId}</span>}
                    {(() => {
                      const tags: string[] = product.tags ? (typeof product.tags === 'string' ? JSON.parse(product.tags) : product.tags) : [];
                      if (tags.length === 0) return null;
                      return <div className="flex flex-wrap gap-0.5 mt-0.5">{tags.map((t: string) => <span key={t} className="text-[10px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-medium">{t}</span>)}</div>;
                    })()}
                    {!!product.talentExclusive && product.exclusiveLiverIds && (() => {
                      const ids = typeof product.exclusiveLiverIds === 'string' ? JSON.parse(product.exclusiveLiverIds) : product.exclusiveLiverIds;
                      if (!ids || ids.length === 0) return null;
                      return <div className="flex flex-wrap gap-0.5 mt-0.5">{ids.map((id: number) => {
                        const liver = (liversData || []).find((l: any) => l.id === id);
                        return liver ? <span key={id} className="text-[10px] bg-purple-50 text-purple-600 px-1 rounded">{liver.name}</span> : null;
                      })}</div>;
                    })()}
                  </td>
                  <td className="p-3 text-muted-foreground text-xs font-mono">{product.barcode || "-"}</td>
                  <td className="p-3 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {product.brandName}
                      {!!product.hasTikTokBackend && <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium whitespace-nowrap cursor-pointer hover:bg-emerald-200 transition-colors" onClick={(e) => { e.stopPropagation(); window.open(`/master/brands/${product.brandId}`, '_blank'); }} title="TikTok Shop後台操作権限あり - クリックでブランド詳細を開く">{t("sc.tiktokBackend")}<HelpCircle className="h-2.5 w-2.5 opacity-60" /></span>}
                    </span>
                  </td>
                  <td className="p-3">{category ? (() => { const parent = categoriesQuery.data?.find((p: any) => p.id === category.parentId); const parentStr = parent ? (parent.nameCn ? `${parent.name}(${parent.nameCn})` : parent.name) + " / " : ""; const catStr = category.nameCn ? `${category.name}(${category.nameCn})` : category.name; return parentStr + catStr; })() : "-"}</td>
                  <td className="p-3 text-right"><div>¥{Number(product.price || 0).toLocaleString()}</div>{product.promotionType && <span className="text-[10px] bg-orange-100 text-orange-700 px-1 rounded font-bold">{product.promotionType}</span>}{product.actualUnitPrice && <div className="text-[10px] text-orange-600">実質¥{Number(product.actualUnitPrice).toLocaleString()}</div>}</td>
                  <td className="p-3 text-right">
                    {(() => {
                      const lowestPrice = product.historicalLowestPrice ? Number(product.historicalLowestPrice) : 0;
                      const discountRate = product.discountRate ? Number(product.discountRate) : 0;
                      const currentPrice = Number(product.price || 0);
                      // 折扣后价格 = 当前价格 × (1 - 折扣率/100)
                      const discountedPrice = (discountRate > 0 && currentPrice > 0) ? Math.round(currentPrice * (1 - discountRate / 100)) : 0;
                      
                      // 两个都有值，对比展示更低的
                      if (lowestPrice > 0 && discountedPrice > 0) {
                        if (lowestPrice <= discountedPrice) {
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-red-600 font-bold hover:underline cursor-pointer">{discountRate > 0 && <span className="text-orange-600">{discountRate}%OFF </span>}¥{lowestPrice.toLocaleString()}</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-0" align="end">
                                <PriceHistoryPopover productId={product.id} />
                              </PopoverContent>
                            </Popover>
                          );
                        } else {
                          return (
                            <>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-orange-600 font-bold hover:underline cursor-pointer">{discountRate}%OFF (¥{discountedPrice.toLocaleString()})</button>
                              </PopoverTrigger>
                              <PopoverContent className="w-72 p-0" align="end">
                                <DiscountHistoryPopover productId={product.id} />
                              </PopoverContent>
                            </Popover>
                            {product.skuDiscountRate && Number(product.skuDiscountRate) > 0 && (
                              <div className="text-[10px] text-teal-600 mt-0.5">📦SKU: {Number(product.skuDiscountRate)}%OFF</div>
                            )}
                            </>
                          );












                        }
                      } else if (lowestPrice > 0) {
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-red-600 font-bold hover:underline cursor-pointer">{discountRate > 0 && <span className="text-orange-600">{discountRate}%OFF </span>}¥{lowestPrice.toLocaleString()}</button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="end">
                              <PriceHistoryPopover productId={product.id} />
                            </PopoverContent>
                          </Popover>
                        );
                      } else if (discountRate > 0) {
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-orange-600 font-bold hover:underline cursor-pointer">{discountRate}%OFF</button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-0" align="end">
                              <DiscountHistoryPopover productId={product.id} />
                            </PopoverContent>
                          </Popover>
                        );
                      }
                      return <span className="text-muted-foreground">-</span>;
                    })()}
                  </td>
                  <td className="p-3 text-center">
                    {(() => {
                      const prot = protectionMap[product.id];
                      if (!prot) return <span className="text-gray-400 text-xs">-</span>;
                      if (prot.status === 'danger') return (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700" title={`最終変更: ${new Date(prot.lastChangedAt).toLocaleDateString('ja-JP')}`}>
                          🔴 残{prot.protectionDaysLeft}日
                        </span>
                      );
                      if (prot.status === 'caution') return (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-700" title={`最終変更: ${new Date(prot.lastChangedAt).toLocaleDateString('ja-JP')}`}>
                          🟡 残{prot.protectionDaysLeft}日
                        </span>
                      );
                      return (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700" title={`最終変更: ${new Date(prot.lastChangedAt).toLocaleDateString('ja-JP')}`}>
                          🟢 変更可
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-right">
                    {product.commissionValue ? (product.commissionType === "percentage" ? `${product.commissionValue}%` : `¥${product.commissionValue}`) : "-"}
                  </td>
                  <td className="p-3 text-center">{product.stock ?? "-"}</td>
                  <td className="p-3 text-center"><ProductBundleBadge productId={product.id} /></td>
                  <td className="p-3 text-center">
                    <Badge variant={product.status === "online" ? "default" : product.status === "draft" ? "secondary" : "outline"}>
                      {product.status === "online" ? t("sc.online") : product.status === "draft" ? t("sc.draft") : t("sc.offline")}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditProduct(product)}><Edit className="h-3.5 w-3.5" /></Button>
                      {product.status !== "online" && (
                        <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: product.id, status: "online" })}>
                          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                      )}
                      {product.status === "online" && (
                        <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: product.id, status: "offline" })}>
                          <Eye className="h-3.5 w-3.5 text-orange-600" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm(t("sc.deleteConfirm"))) deleteProductMutation.mutate({ id: product.id }); }}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                      <Button variant="ghost" size="sm" title={t("sc.polls.fromProduct")} onClick={() => {
                        createPollFromProduct(product);
                      }}>
                        <Vote className="h-3.5 w-3.5 text-blue-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* SKU variants inline display */}
            {productsQuery.data?.items?.filter((product: any) => (brandFilter === 'all' || product.brandName === brandFilter) && !product.parentProductId).map((product: any) => {
              const skus = product.skuVariants ? (typeof product.skuVariants === 'string' ? JSON.parse(product.skuVariants) : product.skuVariants) : [];
              if (skus.length === 0 && !product.skuName) return null;
              const skuList = skus.length > 0 ? skus : [{ name: product.skuName, price: product.skuPrice, lowestPrice: product.skuLowestPrice, discountRate: product.skuDiscountRate }];
              return (
                <tr key={`sku-${product.id}`} className="border-t bg-teal-50/20">
                  <td colSpan={13} className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-3 pl-12">
                      {skuList.map((s: any, i: number) => (
                        <div key={i} className="text-xs border border-teal-200 rounded px-2 py-1 bg-white">
                          <span className="text-teal-700 font-medium">{s.name}</span>
                          <span className="text-gray-500 ml-1">¥{Number(s.price || 0).toLocaleString()}</span>
                          {s.lowestPrice && Number(s.lowestPrice) > 0 && <span className="text-red-500 ml-1 font-bold">→¥{Number(s.lowestPrice).toLocaleString()}</span>}
                          {s.discountRate && Number(s.discountRate) > 0 && <span className="text-orange-500 ml-1">({s.discountRate}%OFF)</span>}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* 子SKU展開行 */}
            {productsQuery.data?.items?.filter((p: any) => !p.parentProductId).map((parent: any) => {
              // Always show children if they exist (auto-expand)
              const children = productsQuery.data?.items?.filter((c: any) => c.parentProductId === parent.id) || [];
              if (children.length === 0) return <tr key={`children-empty-${parent.id}`}><td colSpan={11} className="p-2 pl-16 text-xs text-muted-foreground bg-muted/20">子SKUなし（商品編集で親SKUを設定してください）</td></tr>;
              return children.map((child: any) => (
                <tr key={`child-${child.id}`} className="border-t bg-blue-50/30 dark:bg-blue-950/20">
                  <td className="p-2 pl-6">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">└</span>
                      {(() => { const imgs = child.images ? (typeof child.images === 'string' ? JSON.parse(child.images) : child.images) : []; return imgs.length > 0 ? <img src={imgs[0]} alt="" className="w-8 h-8 rounded object-cover" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Package className="w-3 h-3" /></div>; })()}
                    </div>
                  </td>
                  <td className="p-2">
                    <span className="text-sm">{child.productName}</span>
                    <span className="text-xs text-blue-500 ml-1">[子SKU]</span>
                  </td>
                  <td className="p-2 text-sm">{child.brandName || '-'}</td>
                  <td className="p-2 text-sm">¥{child.price?.toLocaleString() || '-'}</td>
                  <td className="p-2 text-sm font-bold text-red-500">¥{child.historicalLowestPrice?.toLocaleString() || '-'}</td>
                  <td className="p-2 text-sm">{child.discountRate ? `${child.discountRate}%OFF` : '-'}</td>
                  <td className="p-2 text-sm text-muted-foreground">-</td>
                  <td className="p-2 text-sm text-muted-foreground">-</td>
                  <td className="p-2 text-sm text-muted-foreground">-</td>
                  <td className="p-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditProduct(child); setShowProductForm(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("子SKUの親設定を解除しますか？")) { fetch("/api/trpc/selectionCenter.removeParentProduct", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ json: { childId: child.id } }) }).then(() => window.location.reload()); } }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ));
            })}
            {(!productsQuery.data?.items || productsQuery.data.items.length === 0) && (
              <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">{t("sc.noProducts")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-sm text-muted-foreground">{t("sc.totalItems").replace("{count}", String(productsQuery.data?.total || 0))}</p>
        <div className="flex items-center gap-2">
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border rounded px-2 py-1 text-sm">
            <option value={20}>20u4ef6</option>
            <option value={50}>50u4ef6</option>
            <option value={100}>100u4ef6</option>
            <option value={200}>200u4ef6</option>
          </select>
          <button disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} className="px-2 py-1 border rounded text-sm disabled:opacity-30">u2190</button>
          <span className="text-sm">{currentPage} / {Math.max(1, Math.ceil((productsQuery.data?.total || 0) / pageSize))}</span>
          <button disabled={currentPage >= Math.ceil((productsQuery.data?.total || 0) / pageSize)} onClick={() => setCurrentPage(p => p + 1)} className="px-2 py-1 border rounded text-sm disabled:opacity-30">u2192</button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <ProductFormDialog
        open={showCreateDialog || !!editProduct}
        onClose={() => { setShowCreateDialog(false); setEditProduct(null); }}
        product={editProduct}
        protectionMap={protectionMap}
        categories={categoriesQuery.data || []}
        onSubmit={(data) => {
          if (editProduct) {
            updateMutation.mutate({ id: editProduct.id, ...data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function ProductFormDialog({ open, onClose, product, protectionMap, categories, onSubmit, loading }: any) {
  const { t } = useLanguage();
  const [form, setForm] = useState<any>(product || {});
  const [uploading, setUploading] = useState(false);
  const isEdit = !!product;
  const brandsQuery = trpc.brand.list.useQuery();

  // Listen for AI product data
  useEffect(() => {
    const handler = () => {
      const data = (window as any).__aiProductData;
      if (data) {
        setForm((prev: any) => ({
          ...prev,
          productName: data.productName || prev.productName || '',
          productNameCn: data.productNameCn || prev.productNameCn || '',
          brandName: data.brandName || prev.brandName || '',
          price: data.price ? String(data.price) : prev.price || '',
          marketPrice: data.marketPrice ? String(data.marketPrice) : prev.marketPrice || '',
          costPrice: data.costPrice ? String(data.costPrice) : prev.costPrice || '',
          stock: data.stock || prev.stock || '',
          sellingPoints: data.sellingPoints || prev.sellingPoints || '',
          description: data.description || prev.description || '',
          barcode: data.barcode || prev.barcode || '',
          productLink: data.productLink || prev.productLink || '',
          supplierContact: prev.supplierContact || '',
        }));
        delete (window as any).__aiProductData;
        toast.success(t('sc.form.aiRecognitionSuccess') || 'AI识别完成，已自动填充');
      }
    };
    window.addEventListener('ai-product-data', handler);
    return () => window.removeEventListener('ai-product-data', handler);
  }, []);
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();

  useEffect(() => {
    if (open) {
      const p = product ? { ...product } : {};
      // Parse exclusiveLiverIds from JSON string if needed
      if (p.exclusiveLiverIds && typeof p.exclusiveLiverIds === 'string') {
        try { p.exclusiveLiverIds = JSON.parse(p.exclusiveLiverIds); } catch { p.exclusiveLiverIds = []; }
      }
      if (!p.exclusiveLiverIds) p.exclusiveLiverIds = [];
      setForm(p);
    }
  }, [open, product]);

  const uploadMutation = trpc.selectionCenter.uploadProductImage.useMutation();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const currentImages: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];
      for (const file of files) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        // Extract base64 data and mimeType from data URL (format: data:image/png;base64,xxxxx)
        const [header, base64Data] = dataUrl.split(',');
        const mimeType = header.match(/data:(.*?);/)?.[1] || file.type || 'image/jpeg';
        const result = await uploadMutation.mutateAsync({ base64Data, fileName: file.name, mimeType });
        currentImages.push(result.url);
      }
      setForm({ ...form, images: currentImages });
      toast.success(`${files.length}${t("sc.form.imageUploaded")}`);
    } catch (err: any) {
      toast.error(err?.message || t("sc.form.imageUploadFailed"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // 粘贴上传处理（Ctrl+V / Cmd+V）
  const handlePasteUpload = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (!imageItems.length) return;
    e.preventDefault();
    setUploading(true);
    try {
      const currentImages: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];
      for (const item of imageItems) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const [header, base64Data] = dataUrl.split(',');
        const mimeType = header.match(/data:(.*?);/)?.[1] || file.type || 'image/png';
        const fileName = `pasted-${Date.now()}.${mimeType.split('/')[1] || 'png'}`;
        const result = await uploadMutation.mutateAsync({ base64Data, fileName, mimeType });
        currentImages.push(result.url);
      }
      setForm({ ...form, images: currentImages });
      toast.success(`${imageItems.length}${t("sc.form.imageUploaded")}`);
    } catch (err: any) {
      toast.error(err?.message || t("sc.form.imageUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    const currentImages: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];
    currentImages.splice(index, 1);
    setForm({ ...form, images: [...currentImages] });
  };

  const imageList: string[] = form.images ? (typeof form.images === 'string' ? JSON.parse(form.images) : form.images) : [];
  const detailImageList: string[] = form.detailImages ? (typeof form.detailImages === 'string' ? JSON.parse(form.detailImages) : form.detailImages) : [];

  // Only submit relevant fields (exclude DB metadata like createdAt, updatedAt, status, etc.)
  const handleSubmit = () => {
    const submitData: any = {
      productName: form.productName,
      productNameCn: form.productNameCn || undefined,
      productId: form.productId || undefined,
      barcode: form.barcode || undefined,
      brandName: form.brandName || undefined,
      brandId: form.brandId || undefined,
      categoryId: form.categoryId || undefined,
      price: form.price ? String(form.price) : undefined,
      marketPrice: form.marketPrice ? String(form.marketPrice) : undefined,
      costPrice: form.costPrice ? String(form.costPrice) : undefined,
      commissionType: form.commissionType || undefined,
      commissionValue: form.commissionValue ? String(form.commissionValue) : undefined,
      images: form.images || undefined,
      detailImages: form.detailImages && form.detailImages.length > 0 ? form.detailImages : undefined,
      videos: form.videos || undefined,
      productLink: form.productLink || undefined,
      sellingPoints: form.sellingPoints || undefined,
      description: form.description || undefined,
      stock: form.stock != null && form.stock !== "" ? Number(form.stock) : undefined,
      supplierContact: form.supplierContact || undefined,
      talentExclusive: form.talentExclusive ? 1 : 0,
      exclusiveLiverIds: form.talentExclusive ? (form.exclusiveLiverIds || []) : [],
      tags: form.tags && form.tags.length > 0 ? form.tags : [],
      selfOperated: form.selfOperated ? 1 : 0,
      purchasePrice: form.purchasePrice ? String(form.purchasePrice) : undefined,
      shippingFee: form.selfOperated && form.shippingFee ? String(form.shippingFee) : undefined,
      platformFee: form.selfOperated && form.platformFee ? String(form.platformFee) : undefined,
      deliveryTime: form.selfOperated && form.deliveryTime ? String(form.deliveryTime) : undefined,
      suggestedPrice: form.selfOperated && form.suggestedPrice ? String(form.suggestedPrice) : undefined,
      mechanism: form.mechanism || undefined,
      historicalLowestPrice: form.historicalLowestPrice ? String(form.historicalLowestPrice) : undefined,
      discountRate: form.discountRate ? String(form.discountRate) : undefined,
      skuLowestPrice: form.skuLowestPrice ? String(form.skuLowestPrice) : undefined,
      skuDiscountRate: form.skuDiscountRate ? String(form.skuDiscountRate) : undefined,
      skuLowestPriceDate: form.skuLowestPriceDate || undefined,
      secondLowestPrice: form.secondLowestPrice ? String(form.secondLowestPrice) : undefined,
      thirdLowestPrice: form.thirdLowestPrice ? String(form.thirdLowestPrice) : undefined,
      secondDiscountRate: form.secondDiscountRate ? String(form.secondDiscountRate) : undefined,
      thirdDiscountRate: form.thirdDiscountRate ? String(form.thirdDiscountRate) : undefined,
      lowestPriceDate: form.lowestPriceDate || undefined,
      secondLowestPriceDate: form.secondLowestPriceDate || undefined,
      thirdLowestPriceDate: form.thirdLowestPriceDate || undefined,
      lowestPriceLiver: form.lowestPriceLiver || undefined,
      promotionType: form.promotionType || undefined,
      actualUnitPrice: form.actualUnitPrice ? Number(form.actualUnitPrice) : undefined,
      skuName: form.skuName || undefined,
      skuVariants: form.skuVariants && form.skuVariants.length > 0 ? form.skuVariants : undefined,
      skuPrice: form.skuPrice ? Number(form.skuPrice) : undefined,
      parentProductId: form.parentProductId ? Number(form.parentProductId) : undefined,
    };
    // Remove undefined values for cleaner payload
    Object.keys(submitData).forEach(k => { if (submitData[k] === undefined) delete submitData[k]; });
    onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onPaste={handlePasteUpload}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEdit ? t("sc.form.editTitle") : t("sc.form.addTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2">
        <div className="space-y-4">
          {/* Image Upload Section - 支持粘贴上传 */}
          <div>
            <Label>{t("sc.form.productImage")}</Label>
            <div className="mt-2 flex flex-wrap gap-3" tabIndex={0} title="可以粘贴图片 (Ctrl+V)">
              {imageList.map((url: string, idx: number) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg border overflow-hidden">
                  <img src={url} alt={`${t("sc.form.imageAlt")} ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">{t("sc.form.addImage")}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>

            </div>
          </div>

          {/* Detail Images Section - 详情图片 */}
          <div>
            <Label>详情图片（多张）</Label>
            <p className="text-xs text-muted-foreground mb-2">主播选品详情页展示的图片（类似TikTok商品详情）</p>
            <div className="mt-2 flex flex-wrap gap-3" tabIndex={0}>
              {detailImageList.map((url: string, idx: number) => (
                <div key={idx} className="relative group w-20 h-20 rounded-lg border overflow-hidden">
                  <img src={url} alt={`详情图 ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { const imgs = [...detailImageList]; imgs.splice(idx, 1); setForm({ ...form, detailImages: imgs }); }}
                    className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">追加</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;
                    try {
                      const currentImgs = [...detailImageList];
                      for (const file of files) {
                        const reader = new FileReader();
                        const dataUrl = await new Promise<string>((resolve) => { reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(file); });
                        const [header, base64Data] = dataUrl.split(',');
                        const mimeType = header.match(/data:(.*?);/)?.[1] || file.type || 'image/jpeg';
                        const result = await uploadMutation.mutateAsync({ base64Data, fileName: file.name, mimeType });
                        currentImgs.push(result.url);
                      }
                      setForm({ ...form, detailImages: currentImgs });
                      toast.success(`${files.length}枚の詳細画像をアップロードしました`);
                    } catch (err: any) { toast.error(err?.message || "アップロード失敗"); }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>
          {/* 商品名 - full width */}
          <div>
            <Label>{t("sc.form.productNameLabel")}</Label>
            <Input value={form.productName || ""} onChange={e => setForm({ ...form, productName: e.target.value })} />
          </div>

          {/* 中文商品名 - full width */}
          <div>
            <Label>{t("sc.form.productNameCnLabel")}</Label>
            <Input value={form.productNameCn || ""} onChange={e => setForm({ ...form, productNameCn: e.target.value })} placeholder={t("sc.form.productNameCnPlaceholder")} />
          </div>

          {/* 商品ID + バーコード - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.productId")}</Label>
              <Input value={form.productId || ""} onChange={e => setForm({ ...form, productId: e.target.value })} placeholder={t("sc.form.productIdPlaceholder")} />
            </div>
            <div>
              <Label>{t("sc.form.barcode")}</Label>
              <Input value={form.barcode || ""} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder={t("sc.form.barcodePlaceholder")} />
            </div>
          </div>

          {/* ブランド + カテゴリ - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.brandName")}</Label>
              <BrandSearchSelect
                brands={brandsQuery.data || []}
                value={form.brandId}
                onChange={(brandId, brandName) => setForm({ ...form, brandId, brandName })}
                placeholder={t("sc.form.brandPlaceholder")}
              />
            </div>
            <div>
              <Label>{t("sc.form.category")}</Label>
              <Select value={String(form.categoryId || "")} onValueChange={v => setForm({ ...form, categoryId: Number(v) })}>
                <SelectTrigger><SelectValue placeholder={t("sc.form.categoryPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => { const parent = c.parentId ? categories.find((p: any) => p.id === c.parentId) : null; const parentLabel = parent ? (parent.nameCn ? `${parent.name}(${parent.nameCn})` : parent.name) + " / " : ""; const label = c.nameCn ? `${c.name}(${c.nameCn})` : c.name; return <SelectItem key={c.id} value={String(c.id)}>{parentLabel}{label}</SelectItem>; })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 品類タグ */}
          <div>
            <Label>{t("sc.form.tags")}</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {["引流款","福利款","爆品款","KG品牌款","利润款","惊喜款","预告款"].map(tag => {
                const tags: string[] = form.tags ? (typeof form.tags === 'string' ? JSON.parse(form.tags) : form.tags) : [];
                const isSelected = tags.includes(tag);
                return (
                  <button key={tag} type="button" onClick={() => {
                    const newTags = isSelected ? tags.filter((t: string) => t !== tag) : [...tags, tag];
                    setForm({ ...form, tags: newTags });
                  }} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

                    {/* 販売価格 + 市場価格 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("sc.form.sellingPrice")}</Label>
                <Input type="number" value={form.price || ""} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>{t("sc.form.marketPrice")}</Label>
                <Input type="number" value={form.marketPrice || ""} onChange={e => setForm({ ...form, marketPrice: e.target.value })} />
              </div>
            </div>
          {/* 历史最低价 */}
            <div>
              <Label className="text-red-600 font-bold">历史最低价 {form.lowestPriceDate && <span className="text-xs text-gray-500 font-normal ml-2">({form.lowestPriceDate})</span>}</Label>
              <Input type="number" value={form.historicalLowestPrice || ""} onChange={e => { const today = new Date().toISOString().slice(0,10); const newPrice = Number(e.target.value); const originalPrice = Number(form.price || form.marketPrice || 0); const autoDiscount = originalPrice > 0 && newPrice > 0 ? Math.round((1 - newPrice / originalPrice) * 100) : undefined; setForm({ ...form, historicalLowestPrice: e.target.value, lowestPriceDate: today, ...(autoDiscount !== undefined && autoDiscount > 0 ? { discountRate: String(autoDiscount) } : {}) }); }} placeholder="例: 1980" className="border-red-200 focus:border-red-400" />
              <p className="text-xs text-muted-foreground mt-1">每次保存会记录历史，展示所有记录中最低的值</p>
              <div className="mt-2">
                <Label className="text-red-600 text-xs">→ この価格のライバー</Label>
                <select className="w-full p-1.5 border rounded text-sm bg-background mt-1" value={form.lowestPriceLiver || ""} onChange={e => setForm({ ...form, lowestPriceLiver: e.target.value || null })}>
                  <option value="">未設定</option>
                  <option value="Ryu">Ryu</option>
                  <option value="Choco">Choco</option>
                  <option value="Ali">Ali</option>
                  <option value="KANA">KANA</option>
                  <option value="きゃべつ">きゃべつ</option>
                  <option value="えみな">えみな</option>
                  <option value="もえ">もえ</option>
                  <option value="プリンスこうや">プリンスこうや</option>
                  <option value="other">その他</option>
                </select>
              </div>
              {product && protectionMap && protectionMap[product.id] && protectionMap[product.id].protectionDaysLeft > 0 && (
                <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
                  <p className="text-xs font-bold text-red-700">{`⚠️ 破価保護期間中（残り${protectionMap[product.id].protectionDaysLeft}日）`}</p>
                  <p className="text-xs text-red-600">TikTok退款期限30日以内の値下げは退款リスクあり</p>
                  <p className="text-xs text-gray-500">{`最終変更: ${new Date(protectionMap[product.id].lastChangedAt).toLocaleDateString("ja-JP")} / ¥${protectionMap[product.id].lastPrice.toLocaleString()}`}</p>
                </div>
              )}
            </div>

          {/* 折扣率 */}
            <div>
              <Label className="text-orange-600 font-bold">历史最低折扣率 (%OFF)</Label>
              <Input type="number" step="0.1" min="0" max="100" value={form.discountRate || ""} onChange={e => setForm({ ...form, discountRate: e.target.value })} placeholder="例: 50 (表示50%OFF)" className="border-orange-200 focus:border-orange-400" />
              <p className="text-xs text-muted-foreground mt-1">每次保存会记录历史，展示所有记录中最低的值</p>
            </div>

          {/* 历史第2低价 + 第2折扣率 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-blue-600 font-bold">历史第2低价 {form.secondLowestPriceDate && <span className="text-xs text-gray-500 font-normal ml-1">({form.secondLowestPriceDate})</span>}</Label>
              <Input type="number" value={form.secondLowestPrice || ""} onChange={e => { const today = new Date().toISOString().slice(0,10); setForm({ ...form, secondLowestPrice: e.target.value, secondLowestPriceDate: today }); }} placeholder="例: 2480" className="border-blue-200 focus:border-blue-400" />
            </div>
            <div>
              <Label className="text-blue-600 font-bold">第2低折扣率 (%OFF)</Label>
              <Input type="number" step="0.1" min="0" max="100" value={form.secondDiscountRate || ""} onChange={e => setForm({ ...form, secondDiscountRate: e.target.value })} placeholder="例: 40" className="border-blue-200 focus:border-blue-400" />
            </div>
          </div>
          {/* 历史第3低价 + 第3折扣率 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-purple-600 font-bold">历史第3低价 {form.thirdLowestPriceDate && <span className="text-xs text-gray-500 font-normal ml-1">({form.thirdLowestPriceDate})</span>}</Label>
              <Input type="number" value={form.thirdLowestPrice || ""} onChange={e => { const today = new Date().toISOString().slice(0,10); setForm({ ...form, thirdLowestPrice: e.target.value, thirdLowestPriceDate: today }); }} placeholder="例: 2980" className="border-purple-200 focus:border-purple-400" />
            </div>
            <div>
              <Label className="text-purple-600 font-bold">第3低折扣率 (%OFF)</Label>
              <Input type="number" step="0.1" min="0" max="100" value={form.thirdDiscountRate || ""} onChange={e => setForm({ ...form, thirdDiscountRate: e.target.value })} placeholder="例: 35" className="border-purple-200 focus:border-purple-400" />
            </div>
          </div>
          
          {/* SKU最低价 + SKU折扣率 */}
          {/* SKU（多個対応） */}
          <div className="border-t border-dashed border-teal-200 pt-3 mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-teal-700 font-bold">📦 SKU（套组/变体）価格</p>
              <button type="button" className="text-xs bg-teal-500 text-white px-2 py-0.5 rounded hover:bg-teal-600" onClick={() => { const skus = form.skuVariants ? [...form.skuVariants] : []; skus.push({ name: "", price: "", lowestPrice: "", discountRate: "" }); setForm({ ...form, skuVariants: skus }); }}>+ SKU追加</button>
            </div>
            {(form.skuVariants && form.skuVariants.length > 0 ? form.skuVariants : (form.skuName ? [{ name: form.skuName || "", price: form.skuPrice || "", lowestPrice: form.skuLowestPrice || "", discountRate: form.skuDiscountRate || "" }] : [])).map((sku: any, idx: number) => (
              <div key={idx} className="border border-teal-100 rounded p-2 mb-2 bg-teal-50/30 relative">
                {(form.skuVariants?.length || 0) > 1 && <button type="button" className="absolute top-1 right-1 text-red-400 hover:text-red-600 text-xs" onClick={() => { const skus = [...(form.skuVariants || [])]; skus.splice(idx, 1); setForm({ ...form, skuVariants: skus }); }}>✕</button>}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <Label className="text-teal-600 text-xs font-bold">名称</Label>
                    <Input value={sku.name || ""} onChange={e => { const skus = form.skuVariants ? [...form.skuVariants] : [{ name: form.skuName || "", price: form.skuPrice || "", lowestPrice: form.skuLowestPrice || "", discountRate: form.skuDiscountRate || "" }]; skus[idx] = { ...skus[idx], name: e.target.value }; setForm({ ...form, skuVariants: skus }); }} placeholder="10個セット" className="border-teal-200 text-sm h-8" />
                  </div>
                  <div>
                    <Label className="text-teal-600 text-xs font-bold">定価 (¥)</Label>
                    <Input type="number" value={sku.price || ""} onChange={e => { const skus = form.skuVariants ? [...form.skuVariants] : [{ name: form.skuName || "", price: form.skuPrice || "", lowestPrice: form.skuLowestPrice || "", discountRate: form.skuDiscountRate || "" }]; skus[idx] = { ...skus[idx], price: e.target.value }; setForm({ ...form, skuVariants: skus }); }} placeholder="17500" className="border-teal-200 text-sm h-8" />
                  </div>
                  <div>
                    <Label className="text-teal-600 text-xs font-bold">最低価 (¥)</Label>
                    <Input type="number" value={sku.lowestPrice || ""} onChange={e => { const skus = form.skuVariants ? [...form.skuVariants] : [{ name: form.skuName || "", price: form.skuPrice || "", lowestPrice: form.skuLowestPrice || "", discountRate: form.skuDiscountRate || "" }]; const p = Number(skus[idx].price || 0); const v = Number(e.target.value); const d = p > 0 && v > 0 ? Math.round((1 - v / p) * 100) : 0; skus[idx] = { ...skus[idx], lowestPrice: e.target.value, discountRate: d > 0 ? String(d) : "" }; setForm({ ...form, skuVariants: skus }); }} placeholder="2826" className="border-teal-200 text-sm h-8" />
                  </div>
                  <div>
                    <Label className="text-teal-600 text-xs font-bold">折扣率</Label>
                    <Input type="number" value={sku.discountRate || ""} onChange={e => { const skus = form.skuVariants ? [...form.skuVariants] : [{ name: form.skuName || "", price: form.skuPrice || "", lowestPrice: form.skuLowestPrice || "", discountRate: form.skuDiscountRate || "" }]; skus[idx] = { ...skus[idx], discountRate: e.target.value }; setForm({ ...form, skuVariants: skus }); }} placeholder="65" className="border-teal-200 text-sm h-8" />
                  </div>
                </div>
              </div>
            ))}
            {(!form.skuVariants || form.skuVariants.length === 0) && !form.skuName && <p className="text-xs text-muted-foreground text-center py-2">「+ SKU追加」でSKUを登録</p>}
            <p className="text-xs text-muted-foreground">SKU/套组的最低価可以比単品更低（折扣率自動計算）</p>
          </div>
          {/* 促销方式 */}
          <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-xs text-orange-700 font-bold mb-2">🎁 促销組合（双層割引）</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-orange-600 font-bold">促销方式</Label>
                <select className="w-full p-2 border rounded text-sm bg-background mt-1" value={form.promotionType || ""} onChange={e => setForm({ ...form, promotionType: e.target.value || null })}>
                  <option value="">なし（通常割引）</option>
                  <option value="1+1">1+1（買一送一）</option>
                  <option value="1+2">1+2（買一送二）</option>
                  <option value="1+3">1+3（買一送三）</option>
                  <option value="2+1">2+1（買二送一）</option>
                  <option value="2+2">2+2（買二送二）</option>
                  <option value="3+1">3+1（買三送一）</option>
                  <option value="3+2">3+2（買三送二）</option>
                  <option value="5+1">5+1（買五送一）</option>
                  <option value="10+1">10+1（買十送一）</option>
                </select>
              </div>
              <div>
                <Label className="text-orange-600 font-bold">実際単価 (¥)</Label>
                <Input type="number" step="0.01" value={form.actualUnitPrice || ""} onChange={e => setForm({ ...form, actualUnitPrice: e.target.value ? Number(e.target.value) : null })} placeholder="自動計算 or 手動入力" className="mt-1" />
              </div>
            </div>
            {form.promotionType && form.historicalLowestPrice && (
              <p className="text-xs text-orange-600 mt-2">💡 {form.promotionType} × ¥{form.historicalLowestPrice?.toLocaleString()} → 実際単価: ¥{form.actualUnitPrice?.toLocaleString() || "未設定"}</p>
            )}
          </div>
          {/* 佣金タイプ + 佣金値 - 2 columns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("sc.form.commissionType")}</Label>
                <Select value={form.commissionType || "percentage"} onValueChange={v => setForm({ ...form, commissionType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">{t("sc.form.commissionPercentage")}</SelectItem>
                    <SelectItem value="fixed">{t("sc.form.commissionFixed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("sc.form.commissionValue")}</Label>
                <Input type="number" value={form.commissionValue || ""} onChange={e => setForm({ ...form, commissionValue: e.target.value })} />
              </div>
            </div>

          {/* 在庫数 + 商品リンク - 2 columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("sc.form.stock")}</Label>
              <Input type="number" value={form.stock || ""} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{t("sc.form.productLink")}</Label>
              <Input value={form.productLink || ""} onChange={e => setForm({ ...form, productLink: e.target.value })} />
            </div>
          </div>

          {/* セールスポイント - full width */}
          <div>
            <Label>{t("sc.form.sellingPoints")}</Label>
            <Textarea value={form.sellingPoints || ""} onChange={e => setForm({ ...form, sellingPoints: e.target.value })} rows={3} />
          </div>

          {/* 机制 - full width */}
          <div>
            <Label>{'机制'}</Label>
            <Textarea value={form.mechanism || ""} onChange={e => setForm({ ...form, mechanism: e.target.value })} rows={2} placeholder="例: 买一送一、满减、限时折扣等" />
          </div>

          {/* サプライヤー連絡先 - full width */}
          <div>
            <Label>{t("sc.form.supplierContact")}</Label>
            <Input value={form.supplierContact || ""} onChange={e => setForm({ ...form, supplierContact: e.target.value })} />
          </div>

          {/* 自営 section - bordered card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="selfOperated"
                checked={!!form.selfOperated}
                onChange={e => {
                  setForm({ ...form, selfOperated: e.target.checked ? 1 : 0 });
                }}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="selfOperated" className="cursor-pointer font-medium">{t("sc.form.selfOperated") || '自営'}</Label>
            </div>
            {!!form.selfOperated && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("sc.form.purchasePrice") || '进货价'}</Label>
                    <Input type="number" value={form.purchasePrice || ""} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} placeholder="例: 5000" />
                  </div>
                  <div>
                    <Label>{t("sc.form.shippingFee") || '运费'}</Label>
                    <Input type="number" value={form.shippingFee || ""} onChange={e => setForm({ ...form, shippingFee: e.target.value })} placeholder="例: 500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("sc.form.platformFee") || '平台手续费'}</Label>
                    <Input type="number" value={form.platformFee || ""} onChange={e => setForm({ ...form, platformFee: e.target.value })} placeholder="例: 300" />
                  </div>
                  <div>
                    <Label>{t("sc.form.totalCost") || '成本价'}</Label>
                    <Input
                      type="number"
                      value={(() => {
                        const p = Number(form.purchasePrice) || 0;
                        const s = Number(form.shippingFee) || 0;
                        const f = Number(form.platformFee) || 0;
                        return p + s + f > 0 ? String(p + s + f) : '';
                      })()}
                      readOnly
                      className="bg-muted"
                      placeholder="自动计算"
                    />
                  </div>
                </div>
                <div>
                  <Label>{t("sc.form.deliveryTime") || '发货时效'}</Label>
                  <Input value={form.deliveryTime || ""} onChange={e => setForm({ ...form, deliveryTime: e.target.value })} placeholder="例: 3-5工作日" />
                </div>
                <div>
                  <Label>{'配信価格'}</Label>
                  <Input type="number" value={form.suggestedPrice || ""} onChange={e => setForm({ ...form, suggestedPrice: e.target.value })} placeholder="例: 8000" />
                </div>
              </div>
            )}
          </div>

          {/* 達人限定 section - bordered card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="talentExclusive"
                checked={!!form.talentExclusive}
                onChange={e => {
                  const checked = e.target.checked;
                  setForm({ ...form, talentExclusive: checked ? 1 : 0, exclusiveLiverIds: checked ? (form.exclusiveLiverIds || []) : [] });
                }}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="talentExclusive" className="cursor-pointer font-medium">{t("sc.form.talentExclusive")}</Label>
            </div>
            {!!form.talentExclusive && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("sc.liver.selectPlaceholder")}</Label>
                {/* Selected livers display */}
                {(form.exclusiveLiverIds || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(form.exclusiveLiverIds || []).map((liverId: number) => {
                      const liver = (liversQuery.data || []).find((l: any) => l.id === liverId);
                      return liver ? (
                        <span key={liverId} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {liver.name}
                          <button type="button" onClick={() => setForm({ ...form, exclusiveLiverIds: (form.exclusiveLiverIds || []).filter((id: number) => id !== liverId) })} className="hover:text-purple-900">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {/* Liver picker dropdown */}
                <Select key={`liver-picker-${(form.exclusiveLiverIds || []).length}`} onValueChange={v => {
                  const id = Number(v);
                  if (!form.exclusiveLiverIds?.includes(id)) {
                    setForm({ ...form, exclusiveLiverIds: [...(form.exclusiveLiverIds || []), id] });
                  }
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("sc.liver.selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(liversQuery.data || []).filter((l: any) => !(form.exclusiveLiverIds || []).includes(l.id)).map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        </div>
        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
          <Button variant="outline" onClick={onClose}>{t("sc.form.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading || uploading || !form.productName || !form.brandId}>
            {loading ? t("sc.form.saving") : isEdit ? t("sc.form.update") : t("sc.form.addImage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ==================== AI識別ボタン ====================
function AiRecognitionButton({ onResult }: { onResult: (data: any) => void }) {
  const { t } = useLanguage();
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeMutation = trpc.selectionCenter.analyzeProductImage.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.match(/data:(.*?);/)?.[1] || file.type || 'image/jpeg';
      const result = await analyzeMutation.mutateAsync({ base64Data, mimeType });
      if (result.success && result.data) {
        onResult(result.data);
      } else {
        toast.error(t('sc.form.aiRecognitionFailed') || 'AI识别失败');
      }
    } catch (err: any) {
      toast.error(err?.message || t('sc.form.aiRecognitionFailed') || 'AI识别失败');
    } finally {
      setAnalyzing(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={analyzing}
        className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"
      >
        {analyzing ? (
          <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t('sc.form.aiAnalyzing') || 'AI识别中...'}</>
        ) : (
          <><Sparkles className="h-4 w-4 mr-1" />{t('sc.form.aiRecognition') || 'AI识别'}</>
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </>
  );
}

// AI識別ボタン（ダイアログ内インライン版）
function AiRecognitionInlineButton({ onResult }: { onResult: (data: any) => void }) {
  const { t } = useLanguage();
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeMutation = trpc.selectionCenter.analyzeProductImage.useMutation();

  const processFile = async (file: File) => {
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const [header, base64Data] = dataUrl.split(',');
      const mimeType = header.match(/data:(.*?);/)?.[1] || file.type || 'image/jpeg';

      const result = await analyzeMutation.mutateAsync({ base64Data, mimeType });
      if (result.success && result.data) {
        onResult(result.data);
      } else {
        toast.error(t('sc.form.aiRecognitionFailed') || 'AI识别失败');
      }
    } catch (err: any) {
      toast.error(err?.message || t('sc.form.aiRecognitionFailed') || 'AI识别失败');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  // Listen for paste events on the document when this component is mounted
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (analyzing) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            toast.info(t('sc.form.aiAnalyzing') || 'AI识别中...');
            await processFile(file);
          }
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [analyzing]);

  return (
    <>
      <div
        onClick={() => !analyzing && fileInputRef.current?.click()}
        className="w-20 h-20 rounded-lg border-2 border-dashed border-purple-300 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-colors"
      >
        {analyzing ? (
          <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
        ) : (
          <>
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span className="text-[10px] text-purple-600 mt-1 font-medium">{t('sc.form.aiRecognition') || 'AI识别'}</span>
            <span className="text-[8px] text-purple-400 mt-0.5">可粘贴</span>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
    </>
  );
}

// ==================== 主播選品 Tab ====================
function LiverSelectionTab() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedLiverId, setSelectedLiverId] = useState<string>("");
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [tagFilter, setTagFilter] = useState<string>("");

  const productsQuery = trpc.selectionCenter.getLiverAvailableProducts.useQuery({
    search: search || undefined,
  });
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();
  const selectionsQuery = trpc.selectionCenter.getSelections.useQuery();

  const selectMutation = trpc.selectionCenter.liverSelectProduct.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success(t("sc.liver.selectionSuccess"));
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = trpc.selectionCenter.deleteSelection.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success(t("sc.liver.selectionCancelled"));
    },
  });

  // Get product IDs already selected by the current liver
  const selectedProductIds = useMemo(() => {
    if (!selectedLiverId || !selectionsQuery.data) return new Set<number>();
    return new Set(
      selectionsQuery.data
        .filter((s: any) => s.liverId === Number(selectedLiverId))
        .map((s: any) => s.productId)
    );
  }, [selectedLiverId, selectionsQuery.data]);

  return (
    <div className="space-y-6">
      {/* Liver selector and search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap font-medium">{t("sc.liver.label")}</Label>
          <Select value={selectedLiverId} onValueChange={setSelectedLiverId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder={t("sc.liver.selectPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {(liversQuery.data || []).map((liver: any) => (
                <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
              ))}
              {(!liversQuery.data || liversQuery.data.length === 0) && (
                <SelectItem value="__none" disabled>{t("sc.liver.noLivers")}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("sc.liver.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTagFilter("")} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${!tagFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>{t("sc.all")}</button>
        {["引流款","福利款","爆品款","KG品牌款","利润款","惊喜款","预告款"].map(tag => (
          <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${tagFilter === tag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>{tag}</button>
        ))}
      </div>

      {/* Available products grid */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-3">{t("sc.liver.onlineProducts").replace("{count}", String(productsQuery.data?.filter((p: any) => {
          if (!tagFilter) return true;
          const tags: string[] = p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : [];
          return tags.includes(tagFilter);
        }).length || 0))}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productsQuery.data?.filter((p: any) => {
            if (!tagFilter) return true;
            const tags: string[] = p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : [];
            return tags.includes(tagFilter);
          }).map((product: any) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailProduct(product)}>
              {/* Product Image - full display, click to enlarge */}
              {(() => {
                try {
                  const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
                  if (Array.isArray(imgs) && imgs.length > 0) {
                    return (
                      <div className="w-full bg-white border-b flex items-center justify-center p-2">
                        <img
                          src={imgs[0]}
                          alt={product.productName}
                          className="max-w-full max-h-[400px] object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                          style={{ imageRendering: 'auto' }}
                          loading="lazy"
                          onClick={(e) => { e.stopPropagation(); window.open(imgs[0], '_blank'); }}
                        />
                      </div>
                    );
                  }
                  return null;
                } catch { return null; }
              })()}
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{product.productName}</h3>
                    {product.productNameCn && <p className="text-xs text-blue-400 truncate">{product.productNameCn}</p>}
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {product.brandName}
                      {!!product.hasTikTokBackend && <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded font-medium cursor-pointer hover:bg-emerald-200 transition-colors" onClick={(e) => { e.stopPropagation(); window.open(`/master/brands/${product.brandId}`, '_blank'); }} title="TikTok Shop後台操作権限あり - クリックでブランド詳細を開く">{t("sc.tiktokBackend")}<HelpCircle className="h-2.5 w-2.5 opacity-60" /></span>}
                    </p>
                    {product.selfOperated ? (
                      <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                        {product.totalCost && <span className="font-bold text-green-700 text-base">成本价: ¥{Number(product.totalCost).toLocaleString()}</span>}
                        {product.suggestedPrice && <span className="font-bold text-orange-600 text-base">配信価格: ¥{Number(product.suggestedPrice).toLocaleString()}</span>}
                        <span className="inline-block text-[10px] font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded">自营</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                          <span className="font-bold text-orange-600 text-base">¥{Number(product.price || 0).toLocaleString()}</span>
                          {product.marketPrice && Number(product.marketPrice) > 0 && Number(product.marketPrice) !== Number(product.price || 0) && (
                            <span className="text-muted-foreground line-through text-xs">¥{Number(product.marketPrice).toLocaleString()}</span>
                          )}
                          {(() => {
                            const discountPct = product.discountRate ? Number(product.discountRate) : 0;
                            if (discountPct > 0) {
                              return (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 shrink-0">
                                  {`${discountPct}%OFF`}
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {t("sc.commission")}: {product.commissionType === "percentage" ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                            {product.commissionType === "percentage" && product.price && product.commissionValue && (
                              <span className="ml-1 text-orange-600 font-medium">
                                (¥{Math.round(Number(product.price) * Number(product.commissionValue) / 100).toLocaleString()})
                              </span>
                            )}
                          </Badge>
                          {(() => {
                            const lowestPrice = product.historicalLowestPrice ? Number(product.historicalLowestPrice) : 0;
                            if (lowestPrice > 0) {
                              return (
                                <Badge className="bg-red-100 text-red-700 border-red-300 text-xs font-bold">
                                  🔥 历史最低价: ¥{lowestPrice.toLocaleString()}
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </>
                    )}
                    {/* Tag badges */}
                    {(() => {
                      const tags: string[] = product.tags ? (typeof product.tags === 'string' ? JSON.parse(product.tags) : product.tags) : [];
                      if (tags.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {tags.map((tag: string) => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">{tag}</span>
                          ))}
                        </div>
                      );
                    })()}
                    {product.sellingPoints && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{product.sellingPoints}</p>
                    )}
                    {product.mechanism && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">⚡ 机制: {product.mechanism}</p>
                    )}
                    {/* Self-operated info */}
                    {product.selfOperated ? (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[10px] font-bold text-green-700 bg-green-200 px-1.5 py-0.5 rounded">自营</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-600">
                          {product.purchasePrice && <span>进货价: ¥{Number(product.purchasePrice).toLocaleString()}</span>}
                          {product.shippingFee && <span>运费: ¥{Number(product.shippingFee).toLocaleString()}</span>}
                          {product.platformFee && <span>平台费: ¥{Number(product.platformFee).toLocaleString()}</span>}
                          {product.totalCost && <span className="font-medium text-green-700">成本价: ¥{Number(product.totalCost).toLocaleString()}</span>}
                          {product.deliveryTime && <span>发货: {product.deliveryTime}</span>}
                          {product.suggestedPrice && <span className="font-medium text-orange-600">配信価格: ¥{Number(product.suggestedPrice).toLocaleString()}</span>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {!selectedLiverId ? (
                      <Button size="sm" variant="outline" disabled className="text-xs">{t("sc.liver.selectLiver")}</Button>
                    ) : selectedProductIds.has(product.id) ? (
                      <Button size="sm" variant="secondary" disabled><Check className="h-4 w-4 mr-1" />{t("sc.liver.selected")}</Button>
                    ) : (
                      <Button size="sm" onClick={() => selectMutation.mutate({ productId: product.id, liverId: Number(selectedLiverId) })} disabled={selectMutation.isPending}>
                        {t("sc.liver.select")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!productsQuery.data || productsQuery.data.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {t("sc.liver.noOnlineProducts")}
            </div>
          )}
        </div>
      </div>

      {/* Online Bundles Section */}
      <OnlineBundlesSection selectedLiverId={selectedLiverId} />

      {/* Product Detail Dialog */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => { if (!open) setDetailProduct(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailProduct?.productName}{detailProduct?.productNameCn && <span className="text-sm font-normal text-blue-400 ml-2">({detailProduct.productNameCn})</span>}</DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <div className="space-y-4">
              {/* Images */}
              {(() => {
                try {
                  const imgs = typeof detailProduct.images === 'string' ? JSON.parse(detailProduct.images) : detailProduct.images;
                  if (Array.isArray(imgs) && imgs.length > 0) {
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {imgs.map((img: string, idx: number) => (
                          <div key={idx} className="overflow-hidden rounded-lg bg-white border">
                            <img src={img} alt={`${detailProduct.productName} ${idx + 1}`} className="w-full h-auto object-contain cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => window.open(img, '_blank')} />
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                } catch { return null; }
              })()}

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.brandLabel")}</Label>
                  <p className="font-medium">{detailProduct.brandName || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.barcodeLabel")}</Label>
                  <p className="font-medium">{detailProduct.barcode || '-'}</p>
                </div>
              </div>

              {/* Price Info */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2">{t("sc.liver.priceInfo")}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t("sc.liver.sellingPrice")}</Label>
                    <p className="font-bold text-orange-600 text-lg">¥{Number(detailProduct.price || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t("sc.liver.marketPrice")}</Label>
                    <p className="font-medium text-muted-foreground line-through">¥{Number(detailProduct.marketPrice || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">历史最低折扣率</Label>
                    <p className="font-bold text-orange-600">
                      {detailProduct.discountRate && Number(detailProduct.discountRate) > 0
                        ? `${Number(detailProduct.discountRate)}%OFF`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">历史最低价</Label>
                    <p className="font-bold text-red-600">
                      {detailProduct.historicalLowestPrice && Number(detailProduct.historicalLowestPrice) > 0
                        ? `🔥 ¥${Number(detailProduct.historicalLowestPrice).toLocaleString()}`
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Price History */}
              {detailProduct.id && (
                <PriceHistoryPanel productId={detailProduct.id} />
              )}

              {/* Discount History */}
              {detailProduct.id && (
                <DiscountHistoryPanel productId={detailProduct.id} />
              )}

              {/* Commission */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.commission")}</Label>
                  <p className="font-medium">
                    {detailProduct.commissionType === 'percentage' ? `${detailProduct.commissionValue}%` : `¥${detailProduct.commissionValue}`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.stock")}</Label>
                  <p className="font-medium">{detailProduct.stock || 0}</p>
                </div>
              </div>

              {/* Selling Points */}
              {detailProduct.sellingPoints && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.sellingPoints")}</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detailProduct.sellingPoints}</p>
                </div>
              )}

              {/* Mechanism */}
              {detailProduct.mechanism && (
                <div>
                  <Label className="text-muted-foreground text-xs">{'机制'}</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap text-blue-600 font-medium">{detailProduct.mechanism}</p>
                </div>
              )}

              {/* Description */}
              {detailProduct.description && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.description")}</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{detailProduct.description}</p>
                </div>
              )}

              {/* Product Link */}
              {detailProduct.productLink && (
                <div>
                  <Label className="text-muted-foreground text-xs">{t("sc.liver.productLink")}</Label>
                  <a href={detailProduct.productLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{detailProduct.productLink}</a>
                </div>
              )}

              {/* Brand Performance History */}
              {detailProduct.brandName && (
                <BrandPerformancePanel brandName={detailProduct.brandName} productName={detailProduct.productName} />
              )}
              {/* 品牌管理の商品パフォーマンスデータ連携 */}
              {detailProduct.brandId && (
                <BrandProductsPanel brandId={detailProduct.brandId} />
              )}

              {/* Select button */}
              <div className="flex justify-end pt-2">
                {!selectedLiverId ? (
                  <Button variant="outline" disabled>{t("sc.liver.selectLiverFirst")}</Button>
                ) : selectedProductIds.has(detailProduct.id) ? (
                  <Button variant="secondary" disabled><Check className="h-4 w-4 mr-1" />{t("sc.liver.selected")}</Button>
                ) : (
                  <Button onClick={() => { selectMutation.mutate({ productId: detailProduct.id, liverId: Number(selectedLiverId) }); setDetailProduct(null); }} disabled={selectMutation.isPending}>
                    {t("sc.liver.select")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
}

// ==================== Online Bundles Section (for LiverSelection) ====================
function OnlineBundlesSection({ selectedLiverId }: { selectedLiverId: string }) {
  const bundlesQuery = trpc.selectionCenter.getOnlineBundles.useQuery();
  const bundles = bundlesQuery.data || [];

  if (bundles.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Layers className="h-4 w-4" />
        套组商品 ({bundles.length})
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bundles.map((bundle: any) => (
          <Card key={bundle.id} className="overflow-hidden hover:shadow-md transition-shadow border-2 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">套组</Badge>
                <h3 className="font-semibold">{bundle.bundleName}</h3>
              </div>
              {bundle.bundleNameCn && <p className="text-xs text-muted-foreground mb-2">{bundle.bundleNameCn}</p>}
              {bundle.description && <p className="text-xs text-muted-foreground mb-2">{bundle.description}</p>}
              <div className="flex items-center gap-3 mb-3">
                <span className="font-bold text-orange-600 text-lg">¥{Number(bundle.price || 0).toLocaleString()}</span>
                {bundle.marketPrice && Number(bundle.marketPrice) > Number(bundle.price || 0) && (
                  <>
                    <span className="text-muted-foreground line-through text-sm">¥{Number(bundle.marketPrice).toLocaleString()}</span>
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                      {Math.round((1 - Number(bundle.price || 0) / Number(bundle.marketPrice)) * 100)}%OFF
                    </Badge>
                  </>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">包含商品:</p>
                {bundle.items?.map((item: any) => {
                  const imgs = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
                  return (
                    <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded px-2 py-1.5 text-xs">
                      {imgs.length > 0 ? <img src={imgs[0]} className="w-6 h-6 rounded object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />}
                      <span className="flex-1 truncate">{item.productName}</span>
                      <span className="text-muted-foreground">×{item.quantity || 1}</span>
                      <span className="text-muted-foreground">¥{Number(item.price || 0).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t">
                <span className="text-xs text-muted-foreground">库存: {bundle.stock}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==================== Selections Tab ====================
function SelectionsTab() {
  const { t } = useLanguage();
  const selectionsQuery = trpc.selectionCenter.getSelections.useQuery();
  const deleteMutation = trpc.selectionCenter.deleteSelection.useMutation({
    onSuccess: () => {
      selectionsQuery.refetch();
      toast.success(t("sc.selections.cancelled"));
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("sc.selections.title").replace("{count}", String(selectionsQuery.data?.length || 0))}</h3>
      </div>
      {selectionsQuery.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !selectionsQuery.data || selectionsQuery.data.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t("sc.selections.noData")}</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t("sc.perf.liverCol")}</th>
                <th className="text-left p-3 font-medium">{t("sc.selections.productName")}</th>
                <th className="text-left p-3 font-medium">{t("sc.selections.brand")}</th>
                <th className="text-center p-3 font-medium">{t("sc.selections.price")}</th>
                <th className="text-center p-3 font-medium">{t("sc.selections.commission")}</th>
                <th className="text-center p-3 font-medium">{t("sc.status")}</th>
                <th className="text-center p-3 font-medium">{t("sc.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {selectionsQuery.data.map((s: any) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{s.liverName}</td>
                  <td className="p-3">{s.productName || "-"}</td>
                  <td className="p-3 text-muted-foreground">{s.brandName || "-"}</td>
                  <td className="p-3 text-center text-orange-600 font-medium">
                    {s.price ? `¥${Number(s.price).toLocaleString()}` : "-"}
                  </td>
                  <td className="p-3 text-center">
                    {s.commissionType === "percentage"
                      ? <span>{s.commissionValue}% <span className="text-orange-600">(¥{Math.round(Number(s.price || 0) * Number(s.commissionValue || 0) / 100).toLocaleString()})</span></span>
                      : `¥${s.commissionValue}`}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>
                      {s.status === "approved" ? t("sc.selections.approved") : s.status === "rejected" ? t("sc.selections.rejected") : t("sc.selections.pending")}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ id: s.id })}>
                      <X className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== Schedules Tab ====================
function SchedulesTab() {
  const { t } = useLanguage();
  const schedulesQuery = trpc.selectionCenter.getSchedules.useQuery();
  const productsQuery = trpc.selectionCenter.getProducts.useQuery({ page: 1, pageSize: 200 });
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();
  const updateMutation = trpc.selectionCenter.updateSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success(t("sc.schedules.updated")); },
  });
  const createMutation = trpc.selectionCenter.createSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success(t("sc.schedules.created")); setShowCreateDialog(false); resetForm(); },
  });
  const deleteMutation = trpc.selectionCenter.deleteSchedule.useMutation({
    onSuccess: () => { schedulesQuery.refetch(); toast.success(t("sc.schedules.updated")); },
  });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formAnchorId, setFormAnchorId] = useState<string>("");
  const [formProductId, setFormProductId] = useState<string>("");
  const [formLiveDate, setFormLiveDate] = useState<string>("");
  const [formStartTime, setFormStartTime] = useState<string>("");
  const [formEndTime, setFormEndTime] = useState<string>("");
  const [formSlotOrder, setFormSlotOrder] = useState<string>("");

  // Inline time edit state
  const [editingTimeId, setEditingTimeId] = useState<number | null>(null);
  const [editStartTime, setEditStartTime] = useState<string>("");
  const [editEndTime, setEditEndTime] = useState<string>("");

  // Inline date edit state
  const [editingDateId, setEditingDateId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState<string>("");

  // Batch generation state
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchLiverId, setBatchLiverId] = useState<string>("");
  const [batchLiveDate, setBatchLiveDate] = useState<string>("");
  const [batchStartTime, setBatchStartTime] = useState<string>("");
  const [batchEndTime, setBatchEndTime] = useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [brandTimes, setBrandTimes] = useState<Record<string, { startTime: string; endTime: string }>>({}); // per-brand time overrides

  const liverProductsQuery = trpc.selectionCenter.getLiverProductsByBrand.useQuery(
    { liverId: Number(batchLiverId) },
    { enabled: !!batchLiverId }
  );
  const batchMutation = trpc.selectionCenter.batchCreateSchedules.useMutation({
    onSuccess: (data) => {
      schedulesQuery.refetch();
      toast.success(t("sc.schedules.batchSuccess").replace("{count}", String(data.count)));
      setShowBatchDialog(false);
      resetBatchForm();
    },
    onError: (err) => { toast.error(t("sc.schedules.batchError") + ": " + err.message); },
  });

  const resetBatchForm = () => {
    setBatchLiverId(""); setBatchLiveDate(""); setBatchStartTime(""); setBatchEndTime(""); setSelectedProductIds([]); setBrandTimes({});
  };

  // When liver changes, auto-select all products
  useEffect(() => {
    if (liverProductsQuery.data && liverProductsQuery.data.length > 0) {
      const allIds = liverProductsQuery.data.flatMap((g: any) => g.products.map((p: any) => p.id));
      setSelectedProductIds(allIds);
    } else {
      setSelectedProductIds([]);
    }
  }, [liverProductsQuery.data]);

  const handleBatchGenerate = () => {
    if (!batchLiverId || !batchLiveDate) {
      toast.error(t("sc.schedules.validationError")); return;
    }
    if (selectedProductIds.length === 0) {
      toast.error(t("sc.schedules.noProducts")); return;
    }
    // Build brandTimes payload - only include brands that have custom times set
    const brandTimesPayload: Record<string, { startTime?: string; endTime?: string }> = {};
    for (const [brand, times] of Object.entries(brandTimes)) {
      if (times.startTime || times.endTime) {
        brandTimesPayload[brand] = { startTime: times.startTime || undefined, endTime: times.endTime || undefined };
      }
    }
    batchMutation.mutate({
      anchorId: Number(batchLiverId),
      liveDate: batchLiveDate,
      startTime: batchStartTime || undefined,
      endTime: batchEndTime || undefined,
      productIds: selectedProductIds,
      brandTimes: Object.keys(brandTimesPayload).length > 0 ? brandTimesPayload : undefined,
    });
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const allProductIds = useMemo(() => {
    if (!liverProductsQuery.data) return [];
    return liverProductsQuery.data.flatMap((g: any) => g.products.map((p: any) => p.id));
  }, [liverProductsQuery.data]);

  const toggleAll = () => {
    if (selectedProductIds.length === allProductIds.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(allProductIds);
    }
  };

  // Filters
  const [filterLiver, setFilterLiver] = useState<string>("all");
  const [filterBrand, setFilterBrand] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  const resetForm = () => {
    setFormAnchorId(""); setFormProductId(""); setFormLiveDate(""); setFormStartTime(""); setFormEndTime(""); setFormSlotOrder("");
  };

  const handleCreate = () => {
    if (!formAnchorId || !formProductId || !formLiveDate) {
      toast.error(t("sc.schedules.validationError")); return;
    }
    createMutation.mutate({
      anchorId: Number(formAnchorId),
      productId: Number(formProductId),
      liveDate: formLiveDate,
      startTime: formStartTime || undefined,
      endTime: formEndTime || undefined,
      slotOrder: formSlotOrder ? Number(formSlotOrder) : undefined,
    });
  };

  const getLiverName = (anchorId: number) => {
    const liver = liversQuery.data?.find((l: any) => l.id === anchorId);
    return liver?.name || `ID: ${anchorId}`;
  };

  // Get unique brands from schedules data
  const uniqueBrands = useMemo(() => {
    if (!schedulesQuery.data) return [];
    const brands = new Set<string>();
    schedulesQuery.data.forEach((s: any) => {
      if (s.product?.brandName) brands.add(s.product.brandName);
    });
    return Array.from(brands).sort();
  }, [schedulesQuery.data]);

  // Filter and group schedules by liver
  const groupedByLiver = useMemo(() => {
    if (!schedulesQuery.data) return {};
    let filtered = schedulesQuery.data.filter((s: any) => s.status !== 'cancelled');

    // Apply filters
    if (filterLiver !== "all") {
      filtered = filtered.filter((s: any) => String(s.anchorId) === filterLiver);
    }
    if (filterBrand !== "all") {
      filtered = filtered.filter((s: any) => s.product?.brandName === filterBrand);
    }
    if (filterDate) {
      filtered = filtered.filter((s: any) => {
        const rawDate = s.liveDate instanceof Date ? s.liveDate.toISOString() : String(s.liveDate || '');
        return rawDate.split('T')[0] === filterDate;
      });
    }

    // Group by liver
    const groups: Record<string, { liverName: string; items: any[] }> = {};
    filtered.forEach((s: any) => {
      const key = String(s.anchorId);
      if (!groups[key]) {
        groups[key] = { liverName: getLiverName(s.anchorId), items: [] };
      }
      groups[key].items.push(s);
    });

    // Sort items within each group by date then slotOrder
    Object.values(groups).forEach(g => {
      g.items.sort((a: any, b: any) => {
        const dateA = (a.liveDate instanceof Date ? a.liveDate.toISOString() : String(a.liveDate || '')).split('T')[0];
        const dateB = (b.liveDate instanceof Date ? b.liveDate.toISOString() : String(b.liveDate || '')).split('T')[0];
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (a.slotOrder || 99) - (b.slotOrder || 99);
      });
    });

    return groups;
  }, [schedulesQuery.data, filterLiver, filterBrand, filterDate, liversQuery.data]);

  // Stats
  const totalSchedules = schedulesQuery.data?.filter((s: any) => s.status !== 'cancelled').length || 0;
  const confirmedCount = schedulesQuery.data?.filter((s: any) => s.status === 'confirmed').length || 0;
  const pendingCount = schedulesQuery.data?.filter((s: any) => s.status === 'pending').length || 0;

  // 一键导出CSV
  const handleExportCSV = () => {
    // Flatten all grouped schedules for export
    const allItems: any[] = [];
    Object.entries(groupedByLiver).forEach(([, group]) => {
      group.items.forEach((s: any) => allItems.push({ ...s, liverName: group.liverName }));
    });
    if (allItems.length === 0) {
      toast.error('导出するデータがありません');
      return;
    }
    const headers = ['主播', '直播日期', '开始时间', '结束时间', '品牌', '商品', '顺序', '状态'];
    const rows = allItems.map(s => {
      const rawDate = s.liveDate instanceof Date ? s.liveDate.toISOString() : String(s.liveDate || '');
      const dateStr = rawDate.split('T')[0];
      const statusLabel = s.status === 'confirmed' ? '已确认' : s.status === 'done' ? '已完成' : s.status === 'cancelled' ? '已取消' : '未确认';
      return [
        s.liverName || '-',
        dateStr,
        s.startTime || '-',
        s.endTime || '-',
        s.product?.brandName || '-',
        s.product?.productName || '-',
        s.slotOrder || '-',
        statusLabel,
      ];
    });
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(row => row.map((cell: any) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `排期一览_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${allItems.length}件のデータを导出しました`);
  };

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">{t("sc.schedules.totalSchedules")}</div>
          <div className="text-xl font-bold">{totalSchedules}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">{t("sc.schedules.confirmed")}</div>
          <div className="text-xl font-bold text-green-600">{confirmedCount}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="text-xs text-muted-foreground">{t("sc.schedules.pending")}</div>
          <div className="text-xl font-bold text-orange-500">{pendingCount}</div>
        </div>
      </div>

      {/* Toolbar: filters + add button */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterLiver} onValueChange={setFilterLiver}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("sc.schedules.liverCol")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sc.schedules.allLivers")}</SelectItem>
            {liversQuery.data?.map((liver: any) => (
              <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("sc.schedules.brandCol")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("sc.schedules.allBrands")}</SelectItem>
            {uniqueBrands.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="w-[160px]"
        />
        {filterDate && (
          <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" />一键导出
          </Button>
          <Dialog open={showBatchDialog} onOpenChange={(open) => { setShowBatchDialog(open); if (!open) resetBatchForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default" className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
                <Zap className="h-4 w-4 mr-1" />{t("sc.schedules.batchGenerate")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("sc.schedules.batchTitle")}</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{t("sc.schedules.batchDesc")}</p>
              </DialogHeader>
              <div className="space-y-4">
                {/* Liver selector */}
                <div>
                  <Label>{t("sc.schedules.liver")}</Label>
                  <Select value={batchLiverId} onValueChange={(v) => { setBatchLiverId(v); setSelectedProductIds([]); }}>
                    <SelectTrigger><SelectValue placeholder={t("sc.schedules.selectLiver")} /></SelectTrigger>
                    <SelectContent>
                      {liversQuery.data?.map((liver: any) => (
                        <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Date and time */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>{t("sc.schedules.liveDate")} *</Label>
                    <Input type="date" value={batchLiveDate} onChange={(e) => setBatchLiveDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("sc.schedules.startTime")}</Label>
                    <Input type="time" value={batchStartTime} onChange={(e) => setBatchStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("sc.schedules.endTime")}</Label>
                    <Input type="time" value={batchEndTime} onChange={(e) => setBatchEndTime(e.target.value)} />
                  </div>
                </div>
                {/* Products preview */}
                {batchLiverId && (
                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{t("sc.schedules.productsPreview")}</h4>
                      <div className="flex items-center gap-2">
                        {allProductIds.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {t("sc.schedules.totalProducts").replace("{count}", String(allProductIds.length))}
                            {" ("}{selectedProductIds.length}/{allProductIds.length}{" selected)"}
                          </span>
                        )}
                        <Button size="sm" variant="ghost" onClick={toggleAll}>
                          {selectedProductIds.length === allProductIds.length ? t("sc.schedules.deselectAll") : t("sc.schedules.selectAll")}
                        </Button>
                      </div>
                    </div>
                    {liverProductsQuery.isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : liverProductsQuery.data && liverProductsQuery.data.length > 0 ? (
                      <div className="space-y-3">
                        {liverProductsQuery.data.map((group: any) => (
                          <div key={group.brand} className="border rounded p-2">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant="secondary" className="font-medium">{group.brand}</Badge>
                              <span className="text-xs text-muted-foreground">{group.products.length} items</span>
                              <div className="flex items-center gap-1 ml-auto">
                                <input
                                  type="time"
                                  className="w-[90px] text-xs border rounded px-1.5 py-1 bg-background"
                                  placeholder={t("sc.schedules.startTime")}
                                  value={brandTimes[group.brand]?.startTime || ""}
                                  onChange={(e) => setBrandTimes(prev => ({ ...prev, [group.brand]: { ...prev[group.brand], startTime: e.target.value, endTime: prev[group.brand]?.endTime || "" } }))}
                                />
                                <span className="text-xs">~</span>
                                <input
                                  type="time"
                                  className="w-[90px] text-xs border rounded px-1.5 py-1 bg-background"
                                  placeholder={t("sc.schedules.endTime")}
                                  value={brandTimes[group.brand]?.endTime || ""}
                                  onChange={(e) => setBrandTimes(prev => ({ ...prev, [group.brand]: { ...prev[group.brand], endTime: e.target.value, startTime: prev[group.brand]?.startTime || "" } }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              {group.products.map((product: any) => (
                                <label key={product.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer">
                                  <Checkbox
                                    checked={selectedProductIds.includes(product.id)}
                                    onCheckedChange={() => toggleProductSelection(product.id)}
                                  />
                                  <span className="text-sm flex-1">{product.productName}</span>
                                  {product.price && <span className="text-xs text-muted-foreground">¥{product.price}</span>}
                                  {product.commissionValue && (
                                    <span className="text-xs text-orange-600">
                                      {product.commissionType === 'percentage' ? `${product.commissionValue}%` : `¥${product.commissionValue}`}
                                    </span>
                                  )}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">{t("sc.schedules.noProducts")}</p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowBatchDialog(false); resetBatchForm(); }}>{t("sc.schedules.cancel")}</Button>
                <Button
                  onClick={handleBatchGenerate}
                  disabled={batchMutation.isPending || !batchLiverId || !batchLiveDate || selectedProductIds.length === 0}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                >
                  {batchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
                  {batchMutation.isPending ? t("sc.schedules.generating") : `${t("sc.schedules.generateBtn")} (${selectedProductIds.length})`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{t("sc.schedules.add")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{t("sc.schedules.addTitle")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("sc.schedules.liver")}</Label>
                  <Select value={formAnchorId} onValueChange={setFormAnchorId}>
                    <SelectTrigger><SelectValue placeholder={t("sc.schedules.selectLiver")} /></SelectTrigger>
                    <SelectContent>
                      {liversQuery.data?.map((liver: any) => (
                        <SelectItem key={liver.id} value={String(liver.id)}>{liver.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("sc.schedules.product")}</Label>
                  <Select value={formProductId} onValueChange={setFormProductId}>
                    <SelectTrigger><SelectValue placeholder={t("sc.schedules.selectProduct")} /></SelectTrigger>
                    <SelectContent>
                      {productsQuery.data?.items?.map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.productName} {p.brandName ? `(${p.brandName})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("sc.schedules.streamDate")}</Label>
                  <Input type="date" value={formLiveDate} onChange={(e) => setFormLiveDate(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("sc.schedules.startTime")}</Label>
                    <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>{t("sc.schedules.endTime")}</Label>
                    <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>{t("sc.schedules.order")}</Label>
                  <Input type="number" placeholder="1, 2, 3..." value={formSlotOrder} onChange={(e) => setFormSlotOrder(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>{t("sc.schedules.cancel")}</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {t("sc.schedules.create")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main table grouped by liver */}
      {Object.keys(groupedByLiver).length > 0 ? (
        Object.entries(groupedByLiver).sort(([, a], [, b]) => a.liverName.localeCompare(b.liverName)).map(([anchorId, group]) => (
          <div key={anchorId} className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 font-semibold flex items-center gap-2 border-b">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-bold">
                {group.liverName.charAt(0)}
              </div>
              {group.liverName}
              <Badge variant="outline" className="ml-auto">{group.items.length}{t("sc.schedules.items")}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-3 font-medium w-[110px]">{t("sc.schedules.streamDate")}</th>
                    <th className="text-center p-3 font-medium w-[120px]">{t("sc.schedules.timeSlot")}</th>
                    <th className="text-left p-3 font-medium">{t("sc.schedules.brandCol")}</th>
                    <th className="text-left p-3 font-medium">{t("sc.schedules.productCol")}</th>
                    <th className="text-center p-3 font-medium w-[60px]">{t("sc.schedules.orderCol")}</th>
                    <th className="text-center p-3 font-medium w-[80px]">{t("sc.status")}</th>
                    <th className="text-center p-3 font-medium w-[100px]">{t("sc.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((schedule: any, idx: number) => {
                    const rawDate = schedule.liveDate instanceof Date ? schedule.liveDate.toISOString() : String(schedule.liveDate || '');
                    const dateStr = rawDate.split('T')[0];
                    const prevDate = idx > 0 ? ((group.items[idx-1].liveDate instanceof Date ? group.items[idx-1].liveDate.toISOString() : String(group.items[idx-1].liveDate || '')).split('T')[0]) : null;
                    const showDateDivider = idx === 0 || dateStr !== prevDate;

                    return (
                      <tr key={schedule.id} className={`border-t hover:bg-muted/30 ${showDateDivider && idx > 0 ? 'border-t-2 border-t-blue-200 dark:border-t-blue-800' : ''}`}>
                        <td className="p-3 text-sm">
                          {editingDateId === schedule.id ? (
                            <div className="flex items-center gap-1">
                              <input type="date" className="w-[120px] text-xs border rounded px-1 py-0.5 bg-background" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { updateMutation.mutate({ id: schedule.id, liveDate: editDate }); setEditingDateId(null); }}>
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingDateId(null)}>
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <span className="cursor-pointer hover:text-primary hover:underline flex items-center gap-1" onClick={() => { setEditingDateId(schedule.id); setEditDate(dateStr); }}>
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              {dateStr || '-'}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center text-sm">
                          {editingTimeId === schedule.id ? (
                            <div className="flex items-center gap-1">
                              <input type="time" className="w-[75px] text-xs border rounded px-1 py-0.5 bg-background" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                              <span>~</span>
                              <input type="time" className="w-[75px] text-xs border rounded px-1 py-0.5 bg-background" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { updateMutation.mutate({ id: schedule.id, startTime: editStartTime || undefined, endTime: editEndTime || undefined }); setEditingTimeId(null); }}>
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingTimeId(null)}>
                                <X className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <span className="cursor-pointer hover:text-primary hover:underline" onClick={() => { setEditingTimeId(schedule.id); setEditStartTime(schedule.startTime || ""); setEditEndTime(schedule.endTime || ""); }}>
                              {schedule.startTime || "-"} ~ {schedule.endTime || "-"}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {schedule.product?.brandName ? (
                            <Badge variant="secondary" className="font-medium">{schedule.product.brandName}</Badge>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="p-3 font-medium">{schedule.product?.productName || "-"}</td>
                        <td className="p-3 text-center">{schedule.slotOrder || "-"}</td>
                        <td className="p-3 text-center">
                          <Badge variant={schedule.status === "confirmed" ? "default" : schedule.status === "done" ? "secondary" : "outline"}
                            className={schedule.status === "confirmed" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : schedule.status === "done" ? "bg-gray-100 text-gray-800" : ""}
                          >
                            {schedule.status === "pending" ? t("sc.schedules.pending") : schedule.status === "confirmed" ? t("sc.schedules.confirmed") : schedule.status === "done" ? t("sc.schedules.done") : t("sc.schedules.cancelled")}
                          </Badge>
                        </td>
                        <td className="p-3 text-center space-x-1">
                          {schedule.status === "pending" && (
                            <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: schedule.id, status: "confirmed" })}>
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          {schedule.status === "confirmed" && (
                            <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: schedule.id, status: "done" })}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {(schedule.status === "pending" || schedule.status === "confirmed") && (
                            <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: schedule.id, status: "cancelled" })}>
                              <X className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("sc.schedules.confirmDelete") || '确定要删除这条排期吗？')) deleteMutation.mutate({ id: schedule.id }); }}>
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          {t("sc.schedules.noData")}
        </div>
      )}
    </div>
  );
}

// ==================== Performances Tab ====================
function PerformancesTab() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<"products" | "daily" | "imports">("products");
  const [expandedLivestream, setExpandedLivestream] = useState<number | null>(null);
  const [selectedStreamer, setSelectedStreamer] = useState<string>("Ryu kyogoku");
  const [sortMode, setSortMode] = useState<"potential" | "gmv" | "impressions">("potential");
  const [editingLowestPrice, setEditingLowestPrice] = useState<string | null>(null);
  const [lowestPriceInput, setLowestPriceInput] = useState("");
  const updateLowestPriceMutation = trpc.selectionCenter.updateProduct.useMutation({
    onSuccess: () => { performanceQuery.refetch(); setEditingLowestPrice(null); toast.success('历史最低价已更新'); },
    onError: (err: any) => { toast.error(err.message || '更新失败'); },
  });
  const streamerNamesQuery = trpc.selectionCenter.getStreamerNames.useQuery();
  const streamerFilter = selectedStreamer && selectedStreamer !== '__all__' ? selectedStreamer : undefined;
  const performanceQuery = trpc.selectionCenter.getProductPerformanceHistory.useQuery({
    search: search || undefined,
    streamerName: streamerFilter,
  });
  const importHistoryQuery = trpc.selectionCenter.getAllImportHistory.useQuery({});
  const dailyViewQuery = trpc.selectionCenter.getDailyPerformanceView.useQuery({
    streamerName: streamerFilter,
  });
  const dailyProductsQuery = trpc.selectionCenter.getDailyViewProducts.useQuery(
    { livestreamId: expandedLivestream! },
    { enabled: !!expandedLivestream }
  );

  const rawProducts = performanceQuery.data || [];
  const importHistory = importHistoryQuery.data || [];
  const dailyData = dailyViewQuery.data || [];
  const streamerNames = streamerNamesQuery.data || [];

  // Sort products based on selected mode
  const products = [...rawProducts].sort((a, b) => {
    if (sortMode === 'potential') {
      // Potential score: (impressions * clicks) / (gmv + 1) - higher = more potential
      const scoreA = (a.totalImpressions * a.totalClicks) / (a.totalGmv + 1);
      const scoreB = (b.totalImpressions * b.totalClicks) / (b.totalGmv + 1);
      return scoreB - scoreA;
    } else if (sortMode === 'gmv') {
      return b.totalGmv - a.totalGmv;
    } else {
      return b.totalImpressions - a.totalImpressions;
    }
  });
  // Top 3 potential products get badge
  const potentialTop3 = sortMode === 'potential' ? products.slice(0, 3).map(p => p.productName) : [];

  return (
    <div className="space-y-4">
      {/* Header with streamer filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">{t("sc.perf.title")}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("sc.perf.streamer")}</span>
          <Select value={selectedStreamer} onValueChange={(v) => { setSelectedStreamer(v); setExpandedProduct(null); setExpandedLivestream(null); }}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder={t("sc.perf.allStreamers")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("sc.perf.allStreamersCount").replace("{count}", String(streamerNames.reduce((s: number, n: any) => s + n.count, 0)))}</SelectItem>
              {streamerNames.map((s) => (
                <SelectItem key={s.name} value={s.name}>{s.name}{t("sc.perf.streamerCount").replace("{count}", String(s.count))}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={activeSubTab === "products" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("products")}
        >
          <BarChart3 className="h-4 w-4 mr-1" />{t("sc.perf.productPerf")}
        </Button>
        <Button 
          variant={activeSubTab === "daily" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("daily")}
        >
          <Calendar className="h-4 w-4 mr-1" />{t("sc.perf.dailyView")}
        </Button>
        <Button 
          variant={activeSubTab === "imports" ? "default" : "ghost"} 
          size="sm"
          onClick={() => setActiveSubTab("imports")}
        >
          <ClipboardList className="h-4 w-4 mr-1" />{t("sc.perf.importHistory")}
        </Button>
      </div>

      {activeSubTab === "products" && (
        <>
          {/* Search + Sort */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t("sc.perf.searchProduct")} 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              <Button
                variant={sortMode === 'potential' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('potential')}
                className="text-xs"
              >
                {t("sc.perf.potential")}
              </Button>
              <Button
                variant={sortMode === 'gmv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('gmv')}
                className="text-xs"
              >
                {t("sc.perf.gmvOrder")}
              </Button>
              <Button
                variant={sortMode === 'impressions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortMode('impressions')}
                className="text-xs"
              >
                {t("sc.perf.impressionOrder")}
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          {products.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalProductCount")}</p>
                  <p className="text-xl font-bold">{products.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.totalGmv")}</p>
                  <p className="text-xl font-bold text-yellow-500">¥{products.reduce((s, p) => s + p.totalGmv, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalSales")}</p>
                  <p className="text-xl font-bold">{products.reduce((s, p) => s + p.totalItemsSold, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalImpressions")}</p>
                  <p className="text-xl font-bold">{products.reduce((s, p) => s + p.totalImpressions, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Product list */}
          <div className="space-y-2">
            {products.map((product) => {
              const isExpanded = expandedProduct === product.productName;
              return (
                <div key={product.productName} className="border rounded-lg overflow-hidden">
                  {/* Product summary row */}
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedProduct(isExpanded ? null : product.productName)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{product.productName}</p>
                        {potentialTop3.includes(product.productName) && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-emerald-600 text-white">
                            {t("sc.perf.liveRecommend")}
                          </Badge>
                        )}
                        {(product as any).impressionSpike && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                            {t("sc.perf.impressionSurge")}
                          </Badge>
                        )}
                        {(product as any).clickSpike && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-orange-500">
                            {t("sc.perf.clickSurge")}
                          </Badge>
                        )}
                        {(product as any).highImpLowSales && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 border-yellow-500 text-yellow-500">
                            {t("sc.perf.highImpLowSales")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("sc.perf.streamCount").replace("{count}", String(product.livestreamCount))} ・ {t("sc.perf.avgPrice")} ¥{product.totalItemsSold > 0 ? Math.round(product.totalGmv / product.totalItemsSold).toLocaleString() : '0'}
                        {(() => {
                          const manualPrice = (product as any).manualLowestPrice;
                          const prices = product.history
                            .map((h: any) => h.itemsSold > 0 ? Math.round(h.gmv / h.itemsSold) : (h.unitPrice || 0))
                            .filter((p: number) => p > 0);
                          const systemMinPrice = prices.length > 0 ? Math.min(...prices) : 0;
                          const displayPrice = manualPrice || systemMinPrice;
                          const isEditing = editingLowestPrice === product.productName;
                          if (isEditing) {
                            return (
                              <span className="ml-2 inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <span className="text-red-500">・ 历史最低价</span>
                                <input
                                  type="number"
                                  className="w-20 h-5 text-xs border rounded px-1"
                                  value={lowestPriceInput}
                                  onChange={(e) => setLowestPriceInput(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      // Find product ID from selection_products by name
                                      const val = lowestPriceInput ? String(lowestPriceInput) : null;
                                      // We need product ID - search in getProducts
                                      updateLowestPriceMutation.mutate({ id: (product as any).selectionProductId || 0, historicalLowestPrice: val });
                                    } else if (e.key === 'Escape') {
                                      setEditingLowestPrice(null);
                                    }
                                  }}
                                />
                                <button className="text-[10px] text-green-600 hover:underline" onClick={() => {
                                  const val = lowestPriceInput ? String(lowestPriceInput) : null;
                                  updateLowestPriceMutation.mutate({ id: (product as any).selectionProductId || 0, historicalLowestPrice: val });
                                }}>✓</button>
                                <button className="text-[10px] text-gray-400 hover:underline" onClick={() => setEditingLowestPrice(null)}>✗</button>
                              </span>
                            );
                          }
                          return (
                            <span className="ml-2 font-medium inline-flex items-center gap-1">
                              <span className="text-red-500">・ 历史最低价 ¥{displayPrice > 0 ? displayPrice.toLocaleString() : '--'}</span>
                              {manualPrice ? <span className="text-[10px] text-blue-500">(手動)</span> : displayPrice > 0 ? <span className="text-[10px] text-gray-400">(系统)</span> : null}
                              <button className="text-[10px] text-blue-500 hover:underline ml-1" onClick={(e) => { e.stopPropagation(); setEditingLowestPrice(product.productName); setLowestPriceInput(manualPrice ? String(manualPrice) : ''); }}>编辑</button>
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right text-xs">
                      <div>
                        <p className="text-muted-foreground">GMV</p>
                        <p className="font-semibold text-yellow-500">¥{product.totalGmv.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.salesCount")}</p>
                        <p className="font-semibold">{product.totalItemsSold.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.impressions")}</p>
                        <p className="font-semibold">{product.totalImpressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.clicks")}</p>
                        <p className="font-semibold">{product.totalClicks.toLocaleString()}</p>
                      </div>
                      <div className="w-5">
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded: daily breakdown */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left p-2 font-medium">{t("sc.perf.streamDate")}</th>
                              <th className="text-left p-2 font-medium">{t("sc.perf.liverCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.unitPrice")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.gmv")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.salesCountCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.impressionsCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.clicksCol")}</th>
                              <th className="text-right p-2 font-medium">CTR</th>
                              <th className="text-right p-2 font-medium">CTOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.history.map((h, idx) => {
                              const calcPrice = h.itemsSold > 0 ? Math.round(h.gmv / h.itemsSold) : (h.unitPrice || 0);
                              const prevH = idx < product.history.length - 1 ? product.history[idx + 1] : null;
                              const prevPrice = prevH ? (prevH.itemsSold > 0 ? Math.round(prevH.gmv / prevH.itemsSold) : (prevH.unitPrice || 0)) : null;
                              const priceChange = prevPrice && calcPrice ? calcPrice - prevPrice : null;
                              return (
                                <tr key={`${h.livestreamId}-${idx}`} className="border-t hover:bg-muted/30">
                                  <td className="p-2">{h.date ? new Date(h.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '-'}</td>
                                  <td className="p-2">{h.streamerName || '-'}</td>
                                  <td className="p-2 text-right font-medium">
                                    ¥{calcPrice.toLocaleString()}
                                    {priceChange !== null && priceChange !== 0 && (
                                      <span className={`ml-1 text-[10px] ${priceChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {priceChange > 0 ? '↑' : '↓'}{Math.abs(priceChange).toLocaleString()}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right text-yellow-500 font-medium">¥{h.gmv.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.itemsSold.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.impressions.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.clicks.toLocaleString()}</td>
                                  <td className="p-2 text-right">{h.ctr ? `${(parseFloat(h.ctr) * 100).toFixed(1)}%` : '-'}</td>
                                  <td className="p-2 text-right">{h.ctor ? `${(parseFloat(h.ctor) * 100).toFixed(1)}%` : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {products.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {performanceQuery.isLoading ? t("sc.perf.loading") : t("sc.perf.noData")}
              </div>
            )}
          </div>
        </>
      )}

      {activeSubTab === "daily" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("sc.perf.dailyDesc")}</p>
          
          {/* Daily summary cards */}
          {dailyData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.streamCountStat")}</p>
                  <p className="text-xl font-bold">{dailyData.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalGmvStat")}</p>
                  <p className="text-xl font-bold text-yellow-500">¥{dailyData.reduce((s, d) => s + d.totalGmv, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.totalImpStat")}</p>
                  <p className="text-xl font-bold">{dailyData.reduce((s, d) => s + d.totalImpressions, 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{t("sc.perf.avgProductsPerStream")}</p>
                  <p className="text-xl font-bold">{dailyData.length > 0 ? Math.round(dailyData.reduce((s, d) => s + d.productCount, 0) / dailyData.length) : 0}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Daily list */}
          <div className="space-y-2">
            {dailyData.map((day) => {
              const isExpanded = expandedLivestream === day.livestreamId;
              return (
                <div key={day.livestreamId} className="border rounded-lg overflow-hidden">
                  <div 
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedLivestream(isExpanded ? null : day.livestreamId)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {day.date ? new Date(day.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }) : '-'}
                        </p>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {day.streamerName || t("sc.perf.unknown")}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {day.productCount}{t("sc.perf.productsCount").replace("{count}", "")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right text-xs">
                      <div>
                        <p className="text-muted-foreground">GMV</p>
                        <p className="font-semibold text-yellow-500">¥{day.totalGmv.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.salesCount")}</p>
                        <p className="font-semibold">{day.totalItems.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.impressions")}</p>
                        <p className="font-semibold">{day.totalImpressions.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t("sc.perf.clicks")}</p>
                        <p className="font-semibold">{day.totalClicks.toLocaleString()}</p>
                      </div>
                      <div className="w-5">
                        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded: products for this day */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40">
                            <tr>
                              <th className="text-left p-2 font-medium">{t("sc.perf.productNameCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.unitPriceCol")}</th>
                              <th className="text-right p-2 font-medium">GMV</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.salesCountCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.impressionsCol")}</th>
                              <th className="text-right p-2 font-medium">{t("sc.perf.clicksCol")}</th>
                              <th className="text-right p-2 font-medium">CTR</th>
                              <th className="text-right p-2 font-medium">CTOR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyProductsQuery.isLoading ? (
                              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{t("sc.perf.loading")}</td></tr>
                            ) : (dailyProductsQuery.data || []).map((p, idx) => {
                              const calcPrice = p.itemsSold > 0 ? Math.round(p.gmv / p.itemsSold) : (p.unitPrice || 0);
                              return (
                                <tr key={idx} className="border-t hover:bg-muted/30">
                                  <td className="p-2 max-w-[200px] truncate">{p.productName}</td>
                                  <td className="p-2 text-right">¥{calcPrice.toLocaleString()}</td>
                                  <td className="p-2 text-right text-yellow-500 font-medium">¥{p.gmv.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.itemsSold.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.impressions.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.clicks.toLocaleString()}</td>
                                  <td className="p-2 text-right">{p.ctr ? `${(parseFloat(p.ctr) * 100).toFixed(1)}%` : '-'}</td>
                                  <td className="p-2 text-right">{p.ctor ? `${(parseFloat(p.ctor) * 100).toFixed(1)}%` : '-'}</td>
                                </tr>
                              );
                            })}
                            {!dailyProductsQuery.isLoading && (dailyProductsQuery.data || []).length === 0 && (
                              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">{t("sc.perf.noData")}</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {dailyData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {dailyViewQuery.isLoading ? t("sc.perf.loading") : t("sc.perf.noData")}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === "imports" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("sc.perf.importHistory")}</p>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">{t("sc.perf.productNameCol")}</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importDate")}</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importLiver")}</th>
                  <th className="text-right p-3 font-medium">{t("sc.perf.importProductCount")}</th>
                  <th className="text-right p-3 font-medium">GMV</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importedBy")}</th>
                  <th className="text-left p-3 font-medium">{t("sc.perf.importDateTime")}</th>
                  <th className="text-center p-3 font-medium">DL</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((h: any) => (
                  <tr key={h.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-xs max-w-[200px] truncate">{h.fileName}</td>
                    <td className="p-3 text-xs">{h.livestreamDate ? new Date(h.livestreamDate).toLocaleDateString('ja-JP') : '-'}</td>
                    <td className="p-3 text-xs">{h.streamerName || '-'}</td>
                    <td className="p-3 text-right">{h.productCount}</td>
                    <td className="p-3 text-right text-yellow-500">¥{Number(h.totalGmv || 0).toLocaleString()}</td>
                    <td className="p-3 text-xs">{h.importedByName}</td>
                    <td className="p-3 text-xs">{new Date(h.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
                    <td className="p-3 text-center">
                      {h.fileUrl ? (
                        <a href={h.fileUrl} download className="text-blue-400 hover:text-blue-300 underline text-xs">DL</a>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {importHistory.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{t("sc.perf.noImportHistory")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Settlements Tab ====================
function SettlementsTab() {
  const { t } = useLanguage();
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ anchorId: "", periodStart: "", periodEnd: "" });

  const settlementsQuery = trpc.selectionCenter.getSettlements.useQuery();
  const generateMutation = trpc.selectionCenter.generateSettlement.useMutation({
    onSuccess: (data) => {
      settlementsQuery.refetch();
      setShowGenerate(false);
      toast.success(t("sc.settle.generated").replace("{gmv}", Number(data.totalGmv).toLocaleString()).replace("{commission}", Number(data.totalCommission).toLocaleString()));
    },
  });
  const statusMutation = trpc.selectionCenter.updateSettlementStatus.useMutation({
    onSuccess: () => { settlementsQuery.refetch(); toast.success(t("sc.statusUpdated")); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("sc.settle.title")}</h3>
        <Button onClick={() => setShowGenerate(true)}><Plus className="h-4 w-4 mr-1" />{t("sc.settle.generate")}</Button>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">{t("sc.settle.liverId")}</th>
              <th className="text-left p-3 font-medium">{t("sc.settle.period")}</th>
              <th className="text-right p-3 font-medium">{t("sc.settle.totalGmv")}</th>
              <th className="text-right p-3 font-medium">{t("sc.settle.totalCommission")}</th>
              <th className="text-center p-3 font-medium">{t("sc.status")}</th>
              <th className="text-center p-3 font-medium">{t("sc.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {settlementsQuery.data?.map((s: any) => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{s.liverId}</td>
                <td className="p-3">{s.periodStart} ~ {s.periodEnd}</td>
                <td className="p-3 text-right">¥{Number(s.totalGmv || 0).toLocaleString()}</td>
                <td className="p-3 text-right">¥{Number(s.totalCommission || 0).toLocaleString()}</td>
                <td className="p-3 text-center">
                  <Badge variant={s.status === "paid" ? "default" : s.status === "confirmed" ? "secondary" : "outline"}>
                    {s.status === "pending" ? t("sc.settle.pending") : s.status === "confirmed" ? t("sc.settle.confirmed") : t("sc.settle.paid")}
                  </Badge>
                </td>
                <td className="p-3 text-center">
                  {s.status === "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: s.id, status: "confirmed" })}>{t("sc.settle.confirm")}</Button>
                  )}
                  {s.status === "confirmed" && (
                    <Button size="sm" variant="ghost" onClick={() => statusMutation.mutate({ id: s.id, status: "paid" })}>{t("sc.settle.markPaid")}</Button>
                  )}
                </td>
              </tr>
            ))}
            {(!settlementsQuery.data || settlementsQuery.data.length === 0) && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("sc.settle.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("sc.settle.generateTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("sc.settle.liverId")}</Label><Input type="number" value={genForm.anchorId} onChange={e => setGenForm({ ...genForm, anchorId: e.target.value })} /></div>
            <div><Label>{t("sc.settle.startDate")}</Label><Input type="date" value={genForm.periodStart} onChange={e => setGenForm({ ...genForm, periodStart: e.target.value })} /></div>
            <div><Label>{t("sc.settle.endDate")}</Label><Input type="date" value={genForm.periodEnd} onChange={e => setGenForm({ ...genForm, periodEnd: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>{t("sc.settle.cancel")}</Button>
            <Button onClick={() => generateMutation.mutate({ liverId: Number(genForm.anchorId), periodStart: genForm.periodStart, periodEnd: genForm.periodEnd })} disabled={generateMutation.isPending || !genForm.anchorId || !genForm.periodStart || !genForm.periodEnd}>
              {generateMutation.isPending ? t("sc.settle.generating") : t("sc.settle.generateBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== Price History Panel ====================
function PriceHistoryPanel({ productId }: { productId: number }) {
  const historyQuery = trpc.selectionCenter.getPriceHistory.useQuery(
    { productId },
    { enabled: productId > 0 }
  );
  const rows = historyQuery.data || [];
  if (rows.length === 0) return null;
  return (
    <div className="border rounded-lg p-3 bg-red-50/50">
      <p className="text-xs font-bold text-red-700 mb-2">📊 历史最低价记录</p>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {rows.map((row: any) => (
          <div key={row.id} className="flex items-center justify-between text-xs">
            <span className="font-medium text-red-600">¥{Number(row.price).toLocaleString()}</span>
            <span className="text-muted-foreground">
              {row.source === 'manual' ? '手動' : 'システム'}
              {row.note && ` - ${row.note}`}
            </span>
            <span className="text-muted-foreground">
              {new Date(row.createdAt).toLocaleDateString('ja-JP')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiscountHistoryPanel({ productId }: { productId: number }) {
  const historyQuery = trpc.selectionCenter.getDiscountHistory.useQuery(
    { productId },
    { enabled: productId > 0 }
  );
  const rows = historyQuery.data || [];
  if (rows.length === 0) return null;
  return (
    <div className="border rounded-lg p-3 bg-orange-50/50">
      <p className="text-xs font-bold text-orange-700 mb-2">📊 历史最低折扣率记录</p>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {rows.map((row: any) => (
          <div key={row.id} className="flex items-center justify-between text-xs">
            <span className="font-medium text-orange-600">{Number(row.discountRate)}%OFF</span>
            <span className="text-muted-foreground">
              {row.source === 'manual' ? '手動' : 'システム'}
              {row.note && ` - ${row.note}`}
            </span>
            <span className="text-muted-foreground">
              {new Date(row.createdAt).toLocaleDateString('ja-JP')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Popover versions for list page ====================
function PriceHistoryPopover({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const deleteMut = trpc.selectionCenter.deletePriceHistory.useMutation({
    onSuccess: () => { utils.selectionCenter.getPriceHistory.invalidate({ productId }); utils.selectionCenter.listProducts.invalidate(); }
  });
  const historyQuery = trpc.selectionCenter.getPriceHistory.useQuery(
    { productId },
    { enabled: productId > 0 }
  );
  const rows = historyQuery.data || [];
  return (
    <div className="p-3">
      <p className="text-xs font-bold text-red-700 mb-2">📊 历史最低价记录</p>
      {historyQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">读取中...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无记录</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {rows.map((row: any, idx: number) => (
            <div key={row.id} className={`flex items-center justify-between text-xs ${idx === 0 ? 'bg-red-50 rounded px-1.5 py-1 font-bold' : ''}`}>
              <span className="text-red-600">{idx === 0 ? '🏆 ' : ''}¥{Number(row.price).toLocaleString()}</span>
              <button onClick={(e) => { e.stopPropagation(); if(confirm('削除しますか？')) deleteMut.mutate({ id: row.id }); }} className="text-gray-300 hover:text-red-500 ml-1 text-[10px]">✕</button>
              <span className="text-muted-foreground text-[10px]">
                {new Date(row.createdAt).toLocaleDateString('ja-JP')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiscountHistoryPopover({ productId }: { productId: number }) {
  const utils = trpc.useUtils();
  const deleteMut = trpc.selectionCenter.deleteDiscountHistory.useMutation({
    onSuccess: () => { utils.selectionCenter.getDiscountHistory.invalidate({ productId }); utils.selectionCenter.listProducts.invalidate(); }
  });
  const historyQuery = trpc.selectionCenter.getDiscountHistory.useQuery(
    { productId },
    { enabled: productId > 0 }
  );
  const rows = historyQuery.data || [];
  return (
    <div className="p-3">
      <p className="text-xs font-bold text-orange-700 mb-2">📊 历史最低折扣率记录</p>
      {historyQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">读取中...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无记录</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {rows.map((row: any, idx: number) => (
            <div key={row.id} className={`flex items-center justify-between text-xs ${idx === 0 ? 'bg-orange-50 rounded px-1.5 py-1 font-bold' : ''}`}>
              <span className="text-orange-600">{idx === 0 ? '🏆 ' : ''}{Number(row.discountRate)}%OFF</span>
              <button onClick={(e) => { e.stopPropagation(); if(confirm('削除しますか？')) deleteMut.mutate({ id: row.id }); }} className="text-gray-300 hover:text-red-500 ml-1 text-[10px]">✕</button>
              <span className="text-muted-foreground text-[10px]">
                {new Date(row.createdAt).toLocaleDateString('ja-JP')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Brand Products Panel (品牌管理の商品パフォーマンスデータ) ====================
function BrandProductsPanel({ brandId }: { brandId: number }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const productsQuery = trpc.selectionCenter.getBrandProductsForSelection.useQuery(
    { brandId },
    { enabled: expanded }
  );
  const livePerformanceQuery = trpc.selectionCenter.getBrandLivePerformanceForSelection.useQuery(
    { brandId },
    { enabled: expanded }
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-green-600" />
          <span className="text-sm font-semibold text-green-900">品牌管理 商品データ</span>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? '閉じる' : '展開'}</span>
      </button>
      {expanded && (
        <div className="p-3 space-y-3">
          {productsQuery.isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
              <span className="ml-2 text-sm text-muted-foreground">読み込み中...</span>
            </div>
          )}
          {/* ライブ配信実績サマリー */}
          {livePerformanceQuery.data && livePerformanceQuery.data.summary.productCount > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground mb-2">ライブ配信実績</h5>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="bg-orange-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">GMV</p>
                  <p className="text-sm font-bold text-orange-600">¥{livePerformanceQuery.data.summary.totalGmv.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">販売数</p>
                  <p className="text-sm font-bold text-blue-600">{livePerformanceQuery.data.summary.totalSales.toLocaleString()}</p>
                </div>
                <div className="bg-purple-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">商品数</p>
                  <p className="text-sm font-bold text-purple-600">{livePerformanceQuery.data.summary.productCount}</p>
                </div>
              </div>
              {/* トップ商品 */}
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {livePerformanceQuery.data.products.slice(0, 8).map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50">
                    <span className="truncate flex-1 mr-2">{p.productName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-orange-600 font-medium">¥{p.totalGmv.toLocaleString()}</span>
                      <span className="text-muted-foreground">{p.streamCount}回</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* 品牌管理登録商品一覧 */}
          {productsQuery.data && productsQuery.data.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold text-muted-foreground mb-2">品牌管理登録商品 ({productsQuery.data.length}件)</h5>
              <div className="space-y-1 max-h-[150px] overflow-y-auto">
                {productsQuery.data.map((bp: any) => (
                  <div key={bp.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
                    {bp.imageUrls && bp.imageUrls.length > 0 ? (
                      <img src={bp.imageUrls[0]} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                        <Package className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                    <span className="truncate flex-1">{bp.productName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {bp.listPrice && <span className="text-muted-foreground">¥{Number(bp.listPrice).toLocaleString()}</span>}
                      {bp.commissionRate && <span className="text-green-600">{bp.commissionRate}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {productsQuery.data && productsQuery.data.length === 0 && !livePerformanceQuery.data?.summary?.productCount && (
            <p className="text-sm text-muted-foreground text-center py-3">品牌管理にデータがありません</p>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Brand Performance Panel (for detail dialog) ====================
function BrandPerformancePanel({ brandName, productName }: { brandName: string; productName: string }) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const perfQuery = trpc.selectionCenter.getBrandPerformanceSummary.useQuery(
    { brandName },
    { enabled: expanded }
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">{t("sc.brand.historyData")}</span>
          <Badge variant="outline" className="text-[10px]">{brandName}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? t("sc.brand.collapse") : t("sc.brand.expand")}</span>
      </button>
      {expanded && (
        <div className="p-3 space-y-3">
          {perfQuery.isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-muted-foreground">{t("sc.brand.loading")}</span>
            </div>
          )}
          {perfQuery.data && !perfQuery.data.found && (
            <p className="text-sm text-muted-foreground text-center py-3">{t("sc.brand.noData")}</p>
          )}
          {perfQuery.data?.found && perfQuery.data.summary && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-orange-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">GMV</p>
                  <p className="text-sm font-bold text-orange-600">¥{perfQuery.data.summary.totalGmv.toLocaleString()}</p>
                </div>
                <div className="bg-blue-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.impressions")}</p>
                  <p className="text-sm font-bold text-blue-600">{perfQuery.data.summary.totalImpressions.toLocaleString()}</p>
                </div>
                <div className="bg-green-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">CTR</p>
                  <p className="text-sm font-bold text-green-600">{perfQuery.data.summary.avgCtr}%</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-purple-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.salesCount")}</p>
                  <p className="text-sm font-bold text-purple-600">{perfQuery.data.summary.totalSales.toLocaleString()}</p>
                </div>
                <div className="bg-pink-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.clicks")}</p>
                  <p className="text-sm font-bold text-pink-600">{perfQuery.data.summary.totalClicks.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{t("sc.brand.streamCount")}</p>
                  <p className="text-sm font-bold">{perfQuery.data.summary.totalStreams}</p>
                </div>
              </div>
              {/* Top products */}
              {perfQuery.data.products.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-muted-foreground mb-1">{t("sc.brand.topProducts").replace("{count}", String(Math.min(perfQuery.data.products.length, 10)))}</h5>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {perfQuery.data.products.slice(0, 10).map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/50">
                        <span className="truncate flex-1 mr-2">{p.productName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-orange-600 font-medium">¥{p.totalGmv.toLocaleString()}</span>
                          <span className="text-muted-foreground">{p.streamCount}{t("sc.brand.times").replace("{count}", "")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Polls Tab ====================
function PollsTab() {
  const { t } = useLanguage();
  const pollsQuery = trpc.poll.list.useQuery();
  const productsQuery = trpc.selectionCenter.getProducts.useQuery({ page: 1, pageSize: 200 });
  const deleteMutation = trpc.poll.delete.useMutation({
    onSuccess: () => { pollsQuery.refetch(); toast.success(t("sc.polls.delete")); },
  });
  const statusMutation = trpc.poll.updateStatus.useMutation({
    onSuccess: () => { pollsQuery.refetch(); },
  });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [newPoll, setNewPoll] = useState({ productName: "", brandName: "", description: "", originalPrice: "", imageUrl: "" });
  const createMutation = trpc.poll.create.useMutation({
    onSuccess: (data) => {
      pollsQuery.refetch();
      setShowCreate(false);
      setSelectedProductId("");
      setNewPoll({ productName: "", brandName: "", description: "", originalPrice: "", imageUrl: "" });
      const url = `${window.location.origin}/vote/${data.id}`;
      navigator.clipboard.writeText(url);
      toast.success(t("sc.polls.created") + " - " + t("sc.polls.linkCopied"));
    },
  });

  const polls = pollsQuery.data || [];
  const products = productsQuery.data?.items || [];

  function handleProductSelect(productId: string) {
    setSelectedProductId(productId);
    if (productId) {
      const product = products.find((p: any) => String(p.id) === productId);
      if (product) {
        const images = product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [];
        setNewPoll({
          productName: product.productName || "",
          brandName: product.brandName || "",
          originalPrice: product.price ? String(product.price) : "",
          imageUrl: images?.[0] || "",
          description: product.sellingPoints || "",
        });
      }
    } else {
      setNewPoll({ productName: "", brandName: "", description: "", originalPrice: "", imageUrl: "" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("sc.polls.title")}</h3>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" />{t("sc.polls.create")}</Button>
      </div>

      {/* Create Poll Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("sc.polls.create")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("sc.polls.selectProduct")}</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm mt-1"
                value={selectedProductId}
                onChange={e => handleProductSelect(e.target.value)}
              >
                <option value="">{t("sc.polls.selectProductPlaceholder")}</option>
                {products.map((p: any) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.productName} ({p.brandName || '-'}) - ¥{Number(p.price || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            <div><Label>{t("sc.polls.productName")} *</Label><Input value={newPoll.productName} onChange={e => setNewPoll(p => ({...p, productName: e.target.value}))} /></div>
            <div><Label>{t("sc.polls.brandName")}</Label><Input value={newPoll.brandName} onChange={e => setNewPoll(p => ({...p, brandName: e.target.value}))} /></div>
            <div><Label>{t("sc.polls.originalPrice")}</Label><Input type="number" value={newPoll.originalPrice} onChange={e => setNewPoll(p => ({...p, originalPrice: e.target.value}))} /></div>
            <div><Label>{t("sc.polls.imageUrl")}</Label><Input value={newPoll.imageUrl} onChange={e => setNewPoll(p => ({...p, imageUrl: e.target.value}))} placeholder="https://..." /></div>
            <div><Label>{t("sc.polls.description")}</Label><Textarea value={newPoll.description} onChange={e => setNewPoll(p => ({...p, description: e.target.value}))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("sc.form.cancel")}</Button>
            <Button onClick={() => createMutation.mutate({
              productId: selectedProductId ? Number(selectedProductId) : undefined,
              productName: newPoll.productName,
              brandName: newPoll.brandName || undefined,
              originalPrice: newPoll.originalPrice ? Number(newPoll.originalPrice) : undefined,
              imageUrl: newPoll.imageUrl || undefined,
              description: newPoll.description || undefined,
            })} disabled={!newPoll.productName || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("sc.polls.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Polls List */}
      {polls.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("sc.polls.noPolls")}</div>
      ) : (
        <div className="space-y-3">
          {polls.map((poll: any) => (
            <Card key={poll.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {poll.imageUrl && (
                    <img src={poll.imageUrl} alt={poll.productName} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{poll.productName}</span>
                      {poll.brandName && <Badge variant="outline" className="text-xs">{poll.brandName}</Badge>}
                      <Badge variant={poll.status === 'active' ? 'default' : 'secondary'}>
                        {poll.status === 'active' ? t("sc.polls.active") : t("sc.polls.closed")}
                      </Badge>
                    </div>
                    {poll.originalPrice && <p className="text-sm text-muted-foreground">{t("sc.polls.originalPrice")}: ¥{Number(poll.originalPrice).toLocaleString()}</p>}
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="font-medium">{t("sc.polls.voteCount")}: <span className="text-blue-600">{poll.voteCount || 0}</span></span>
                      {poll.avgPrice && <span className="font-medium">{t("sc.polls.avgPrice")}: <span className="text-green-600">¥{Math.round(Number(poll.avgPrice)).toLocaleString()}</span></span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" title={t("sc.polls.copyLink")} onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/vote/${poll.id}`);
                      toast.success(t("sc.polls.linkCopied"));
                    }}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => window.open(`/vote/${poll.id}`, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {poll.status === 'active' ? (
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(t("sc.polls.confirmClose"))) statusMutation.mutate({ id: poll.id, status: 'closed' });
                      }}><X className="h-4 w-4 text-orange-500" /></Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: poll.id, status: 'active' })}>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (confirm(t("sc.polls.confirmDelete"))) deleteMutation.mutate({ id: poll.id });
                    }}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Main Page ====================
// 無条件アクセス許可アカウント
const SUPER_ADMIN_EMAILS = ['ryuhairartist@gmail.com'];

export default function SelectionCenter() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const isSuperAdmin = user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase());
  // RBAC: Check if user only has limited access (e.g., ライバー role = only liver-selection tab)
  const myPermsQuery = trpc.rbac.myPermissions.useQuery(undefined, { enabled: !!user });
  const isLiverOnly = (() => {
    const permsData = myPermsQuery.data;
    if (!permsData) return false;
    if (permsData.permissions === null) return false; // super admin
    if (permsData.isAdmin && !permsData.permissions) return false; // legacy admin
    // Check if role name contains ライバー or 主播
    if (permsData.roleName && (permsData.roleName.includes("ライバー") || permsData.roleName.includes("主播") || permsData.roleName.includes("liver"))) return true;
    return false;
  })();
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem('sc_access') === 'granted';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // スーパーアドミンはパスワード不要
  useEffect(() => {
    if ((isSuperAdmin || isLiverOnly) && !isUnlocked) {
      setIsUnlocked(true);
    }
  }, [isSuperAdmin, isLiverOnly]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'lcj') {
      sessionStorage.setItem('sc_access', 'granted');
      setIsUnlocked(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || (isLiverOnly ? 'liver-selection' : 'products');
  });
  // Force liver-selection tab for liver-only users
  useEffect(() => {
    if (isLiverOnly && activeTab !== 'liver-selection') {
      setActiveTab('liver-selection');
      const params = new URLSearchParams(window.location.search);
      params.set('tab', 'liver-selection');
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, [isLiverOnly]);
  const dashboardQuery = trpc.selectionCenter.getDashboard.useQuery(undefined, { enabled: isUnlocked });
  const d = dashboardQuery.data;

  if (!isUnlocked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Package className="h-5 w-5" />
              {isLiverOnly ? (language === "zh" ? "主播选品" : "主播選品") : t("sc.title")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">アクセスにはパスワードが必要です</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="パスワードを入力"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                autoFocus
              />
              {passwordError && <p className="text-sm text-red-500">パスワードが正しくありません</p>}
              <Button type="submit" className="w-full">ログイン</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" />
          {isLiverOnly ? (language === "zh" ? "主播选品" : "主播選品") : t("sc.title")}
        </h1>
        {!isLiverOnly && <a href="/barcode-scanner" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            <ScanBarcode className="h-4 w-4 mr-1" />
            {t("sc.barcodeSearch")}
          </Button>
        </a>}
      </div>

      {/* Dashboard Cards - hidden for liver-only */}
      {!isLiverOnly && <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.totalProducts")}</p>
            <p className="text-2xl font-bold">{d?.totalProducts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.online")}</p>
            <p className="text-2xl font-bold text-green-600">{d?.onlineProducts || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.selectionCount")}</p>
            <p className="text-2xl font-bold text-blue-600">{d?.totalSelections || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.confirmedSchedules")}</p>
            <p className="text-2xl font-bold text-purple-600">{d?.confirmedSchedules || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("sc.perf.totalGmv")}</p>
            <p className="text-2xl font-bold text-orange-600">¥{Number(d?.totalGmv || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>
      </>}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', val);
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      }} className="space-y-4">
       <TabsList>
          {!isLiverOnly && <TabsTrigger value="auction"><span className="mr-1">🔨</span>拍卖記録</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="products"><Package className="h-4 w-4 mr-1" />{t("sc.tab.products")}</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="bundles"><Layers className="h-4 w-4 mr-1" />套组管理</TabsTrigger>}
         <TabsTrigger value="liver-selection"><ShoppingBag className="h-4 w-4 mr-1" />{t("sc.tab.liverSelection")}</TabsTrigger>
          {!isLiverOnly && <TabsTrigger value="schedules"><Calendar className="h-4 w-4 mr-1" />{t("sc.tab.schedules")}</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="performances"><TrendingUp className="h-4 w-4 mr-1" />{t("sc.tab.performances")}</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="settlements"><DollarSign className="h-4 w-4 mr-1" />{t("sc.tab.settlements")}</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="selections"><ClipboardList className="h-4 w-4 mr-1" />{t("sc.tab.selections")}</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="polls"><Vote className="h-4 w-4 mr-1" />{t("sc.tab.polls")}</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="lp-links"><Link2 className="h-4 w-4 mr-1" />LPリンク</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="procurement"><ShoppingCart className="h-4 w-4 mr-1" />订单需求</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="cost-management"><Lock className="h-4 w-4 mr-1" />成本管理</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="catalog" onClick={() => { window.open('/master/set-image-generator', '_blank'); }}><ExternalLink className="h-4 w-4 mr-1" />カタログ</TabsTrigger>}
          {!isLiverOnly && <TabsTrigger value="brands" onClick={() => { window.location.href = '/master/brands'; }}><Building2 className="h-4 w-4 mr-1" />ブランド管理</TabsTrigger>}
       </TabsList>
        <TabsContent value="auction" forceMount={undefined}>{activeTab === "auction" && <AuctionTab />}</TabsContent>
        <TabsContent value="products" forceMount={undefined}>{activeTab === "products" && <ProductsTab />}</TabsContent>
        <TabsContent value="bundles" forceMount={undefined}>{activeTab === "bundles" && <BundlesTab />}</TabsContent>
        <TabsContent value="liver-selection" forceMount={undefined}>{activeTab === "liver-selection" && <LiverSelectionTab />}</TabsContent>
        <TabsContent value="schedules" forceMount={undefined}>{activeTab === "schedules" && <SchedulesTab />}</TabsContent>
        <TabsContent value="performances" forceMount={undefined}>{activeTab === "performances" && <PerformancesTab />}</TabsContent>
        <TabsContent value="settlements" forceMount={undefined}>{activeTab === "settlements" && <SettlementsTab />}</TabsContent>
        <TabsContent value="selections" forceMount={undefined}>{activeTab === "selections" && <SelectionsTab />}</TabsContent>
        <TabsContent value="polls" forceMount={undefined}>{activeTab === "polls" && <PollsTab />}</TabsContent>
        <TabsContent value="lp-links" forceMount={undefined}>{activeTab === "lp-links" && <LPLinksTab />}</TabsContent>
        <TabsContent value="procurement" forceMount={undefined}>{activeTab === "procurement" && <ProcurementTab />}</TabsContent>
        <TabsContent value="cost-management" forceMount={undefined}>{activeTab === "cost-management" && <CostManagementTab />}</TabsContent>
        <TabsContent value="brands"><div className="p-8 text-center text-muted-foreground">ブランド管理ページに移動しています...</div></TabsContent>
      </Tabs>
    </div>
  );
}

// ==================== LP Links Tab ====================
function LPLinksTab() {
  const lpPages = [
    {
      id: 1,
      name: "グランエンザイム PRO",
      brand: "ESTHE PRO LABO",
      path: "/products/granenzyme",
      status: "active",
      description: "ファスティング酵素ドリンク LP・ヒノキ樽3年半熟成・パリコレスポンサー",
      price: "¥9,350",
      updatedAt: "2025-07-11",
    },
  ];

  const copyUrl = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    toast.success("リンクをコピーしました");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">商品LPページ一覧</h3>
          <p className="text-sm text-muted-foreground">ライブ配信で使用するLPページのリンク管理</p>
        </div>
      </div>

      <div className="grid gap-4">
        {lpPages.map((lp) => (
          <Card key={lp.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center gap-4 p-4">
                <div className="shrink-0 w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <ExternalLink className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-base">{lp.name}</h4>
                    <Badge variant="default" className="bg-green-500">{lp.status === "active" ? "公開中" : "下書き"}</Badge>
                    <Badge variant="outline">{lp.price}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{lp.brand} ・ {lp.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">最終更新: {lp.updatedAt}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => copyUrl(lp.path)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />コピー
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(lp.path, '_blank')}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />開く
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-muted-foreground">
          <p className="text-sm">新しい商品LPは開発チームに依頼して追加します</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== Brand Search Select Component ====================
function BrandSearchSelect({ brands, value, onChange, placeholder }: {
  brands: any[];
  value: number | undefined;
  onChange: (brandId: number, brandName: string, allIds?: number[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ブランド合併ロジック（重複排除）- 合併ブランドの全IDを保持
  const mergedBrands = useMemo(() => {
    const normalizeKey = (name: string): string => {
      const n = name.toLowerCase().replace(/[\s\(\)（）/／・]+/g, '');
      if (n.includes('florasis') || n.includes('花西子') || n.includes('玉容花養')) return 'florasis';
      if (n.includes('栄進') || n.includes('dietmaru') || n.includes('ellecime') || n.includes('荣进')) return 'eishin';
      if (n.includes('kyogoku') || n.includes('京極')) return 'kyogoku';
      if (n.includes('方里') || n.includes('funny') || n.includes('ファンリー') || n.includes('siinono')) return 'funli';
      if (n.includes('mistine')) return 'mistine';
      if (n.includes('ibiza') || n.includes('イビサ')) return 'ibiza';
      if (n.includes('リコアセラム') || n.includes('ricoa') || n.includes('星睿肌') || n.includes('rikareal') || n.includes('リカリアル')) return 'rikareal';
      return n;
    };
    const merged: Record<string, { id: number; name: string; allIds: number[] }> = {};
    for (const b of brands) {
      const key = normalizeKey(b.name || '');
      if (!merged[key]) {
        merged[key] = { id: b.id, name: b.name, allIds: [b.id] };
      } else {
        merged[key].allIds.push(b.id);
      }
    }
    return Object.values(merged);
  }, [brands]);

  const selectedBrand = mergedBrands.find((b) => b.id === value) || brands.find((b: any) => b.id === value);

  const filteredBrands = useMemo(() => {
    if (!searchTerm) return mergedBrands;
    const lower = searchTerm.toLowerCase();
    return mergedBrands.filter((b) => b.name.toLowerCase().includes(lower));
  }, [mergedBrands, searchTerm]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedBrand ? "" : "text-muted-foreground"}>
          {selectedBrand ? selectedBrand.name : (placeholder || "ブランドを選択...")}
        </span>
        <Search className="h-4 w-4 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2 border-b">
            <Input
              placeholder="ブランド名で検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filteredBrands.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">ブランドが見つかりません</div>
            ) : (
              filteredBrands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center gap-2 ${b.id === value ? 'bg-accent' : ''}`}
                  onClick={() => {
                    onChange(b.id, b.name, b.allIds || [b.id]);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {b.id === value && <Check className="h-3 w-3" />}
                  <span>{b.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Procurement Tab (仕入れ管理) ====================
function ProcurementTab() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [filterBrandId, setFilterBrandId] = useState<number | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editingQtyOrderId, setEditingQtyOrderId] = useState<number | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>("");
  const [fukubukuroDetailOrder, setFukubukuroDetailOrder] = useState<any>(null);
  const [showFukubukuroCreate, setShowFukubukuroCreate] = useState(false);

  const brandsQuery = trpc.brand.list.useQuery();

  const ordersQuery = trpc.selectionCenter.getProcurementOrders.useQuery({
    brandId: filterBrandId,
    status: filterStatus === "all" ? undefined : filterStatus as any,
    year: selectedYear,
    month: selectedMonth,
    limit: 500,
    offset: 0,
  });

  const summaryQuery = trpc.selectionCenter.getProcurementSummary.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const createMutation = trpc.selectionCenter.createProcurementOrder.useMutation({
    onSuccess: () => {
      toast.success("発注を作成しました");
      ordersQuery.refetch();
      summaryQuery.refetch();
      setShowCreateDialog(false);
    },
    onError: (e) => toast.error("エラー: " + e.message),
  });

  const updateMutation = trpc.selectionCenter.updateProcurementOrder.useMutation({
    onSuccess: () => {
      toast.success("更新しました");
      ordersQuery.refetch();
      summaryQuery.refetch();
      setEditingOrder(null);
    },
    onError: (e) => toast.error("エラー: " + e.message),
  });

  const deleteMutation = trpc.selectionCenter.deleteProcurementOrder.useMutation({
    onSuccess: () => {
      toast.success("削除しました");
      ordersQuery.refetch();
      summaryQuery.refetch();
    },
    onError: (e) => toast.error("エラー: " + e.message),
  });

  const registerCostMutation = trpc.selectionCenter.registerProductCost.useMutation({
    onSuccess: () => {
      toast.success("原価を登録しました");
    },
    onError: (e) => console.error("原価登録エラー:", e.message),
  });

  const batchCreateMutation = trpc.selectionCenter.createBatchProcurementOrders.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count}件の発注を作成しました`);
      ordersQuery.refetch();
      summaryQuery.refetch();
      setShowCreateDialog(false);
    },
    onError: (e) => toast.error("エラー: " + e.message),
  });

  const fukubukuroCreateMutation = trpc.selectionCenter.createFukubukuroOrder.useMutation({
    onSuccess: (result) => {
      toast.success(`福袋発注を作成しました (${result.itemCount}品)`);
      ordersQuery.refetch();
      summaryQuery.refetch();
      setShowFukubukuroCreate(false);
    },
    onError: (e) => toast.error("福袋作成エラー: " + e.message),
  });

  const [fukubukuroEditOrder, setFukubukuroEditOrder] = useState<any>(null);

  const fukubukuroUpdateMutation = trpc.selectionCenter.updateFukubukuroOrder.useMutation({
    onSuccess: (result) => {
      toast.success(`福袋を更新しました (${result.itemCount}品)`);
      ordersQuery.refetch();
      summaryQuery.refetch();
      setFukubukuroEditOrder(null);
    },
    onError: (e) => toast.error("福袋更新エラー: " + e.message),
  });

  const orders = ordersQuery.data?.orders || [];
  const summary = summaryQuery.data;
  const brands = brandsQuery.data || [];

  const statusLabels: Record<string, string> = {
    pending: "発注待ち",
    ordered: "発注済み",
    received: "入荷済み",
    completed: "処理完成",
    cancelled: "キャンセル",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    ordered: "bg-blue-100 text-blue-800",
    received: "bg-green-100 text-green-800",
    completed: "bg-purple-100 text-purple-800",
    cancelled: "bg-red-100 text-red-800",
  };

  // Month navigation
  const goToPrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(selectedYear - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };
  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(selectedYear + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToPrevMonth}>&lt;</Button>
          <span className="text-lg font-semibold">{selectedYear}年{selectedMonth}月</span>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>&gt;</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />新規発注
          </Button>
          <Button variant="outline" onClick={() => setShowFukubukuroCreate(true)} className="border-purple-300 text-purple-700 hover:bg-purple-50">
            <Gift className="h-4 w-4 mr-1" />福袋発注
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">月間订单数 / 採購数</p>
              <p className="text-2xl font-bold text-blue-600">
                {orders.reduce((sum: number, o: any) => sum + Number(o.pendingPaymentQty || 0) + Number(o.pendingShipQty || 0), 0)}单
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                採購数: <span className="font-bold text-foreground">{Number(summary.grandTotal?.totalQuantity || 0).toLocaleString()}件</span>
              </p>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-orange-600">待支付: {orders.reduce((sum: number, o: any) => sum + Number(o.pendingPaymentQty || 0), 0)}单</span>
                <span className="text-xs text-blue-600">待发货: {orders.reduce((sum: number, o: any) => sum + Number(o.pendingShipQty || 0), 0)}单</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">ブランド数</p>
              <p className="text-2xl font-bold text-purple-600">
                {summary.brandSummary?.length || 0}社
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">確認済排期</p>
              <p className="text-2xl font-bold text-green-600">
                {orders.filter((o: any) => o.status === 'received').length}件
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Brand Summary */}
      {summary?.brandSummary && summary.brandSummary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ブランド別仕入れ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.brandSummary.map((b: any) => (
                <div key={b.brandId} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{b.brandName || `Brand #${b.brandId}`}</p>
                    <p className="text-xs text-muted-foreground">{b.orderCount}件 / {Number(b.totalQuantity).toLocaleString()}個</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="pending">発注待ち</SelectItem>
            <SelectItem value="ordered">発注済み</SelectItem>
            <SelectItem value="received">入荷済み</SelectItem>
            <SelectItem value="completed">処理完成</SelectItem>
            <SelectItem value="cancelled">キャンセル</SelectItem>
          </SelectContent>
        </Select>
        <BrandSearchSelect
          brands={[{ id: 0, name: "全ブランド" }, ...brands]}
          value={filterBrandId || 0}
          onChange={(id, _name) => setFilterBrandId(id === 0 ? undefined : id)}
          placeholder="ブランドで絞り込み..."
        />
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">発注日</th>
                  <th className="text-left p-3 font-medium">ブランド</th>
                  <th className="text-left p-3 font-medium">商品名</th>
                  <th className="text-center p-3 font-medium">待支付</th>
                  <th className="text-center p-3 font-medium">待发货</th>
                  <th className="text-center p-3 font-medium">订单数</th>
                  <th className="text-right p-3 font-medium">採購数</th>
                  <th className="text-center p-3 font-medium">ステータス</th>
                  <th className="text-center p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      {ordersQuery.isLoading ? "読み込み中..." : "この月の仕入れデータはありません"}
                    </td>
                  </tr>
                ) : (
                  orders.map((order: any) => (
                    <tr key={order.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">{order.orderDate ? new Date(order.orderDate).toLocaleDateString('ja-JP') : '-'}</td>
                      <td className="p-3">{order.brandName}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {order.bundleId && <Gift className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />}
                          <span className={order.bundleId ? 'text-purple-700 font-medium' : ''}>{order.productName}</span>
                          {order.bundleId && (
                            <Button variant="ghost" size="sm" className="h-5 px-1 text-purple-500 hover:text-purple-700" onClick={() => setFukubukuroDetailOrder(order)} title="福袋詳細">
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center"><span className="text-orange-600 font-medium">{Number(order.pendingPaymentQty || 0)}</span></td>
                      <td className="p-3 text-center"><span className="text-blue-600 font-medium">{Number(order.pendingShipQty || 0)}</span></td>
                      <td className="p-3 text-center">
                        {editingQtyOrderId === order.id ? (
                          <input
                            type="number"
                            min={1}
                            className="w-16 text-center border rounded px-1 py-0.5 text-sm"
                            value={editingQtyValue}
                            onChange={(e) => setEditingQtyValue(e.target.value)}
                            onBlur={() => {
                              const val = parseInt(editingQtyValue);
                              if (val && val >= 1 && val !== Number(order.qtyPerOrder || 1)) {
                                updateMutation.mutate({ id: order.id, qtyPerOrder: val });
                              }
                              setEditingQtyOrderId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                              } else if (e.key === 'Escape') {
                                setEditingQtyOrderId(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            className="cursor-pointer hover:bg-blue-50 hover:text-blue-600 px-2 py-0.5 rounded transition-colors"
                            onClick={() => {
                              setEditingQtyOrderId(order.id);
                              setEditingQtyValue(String(Number(order.qtyPerOrder || 1)));
                            }}
                          >
                            {Number(order.qtyPerOrder || 1)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium">{Number(order.quantity).toLocaleString()}</td>
                      <td className="p-3 text-center">
                        <Badge className={statusColors[order.status] || "bg-gray-100 text-gray-800"}>
                          {statusLabels[order.status] || order.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {order.status === 'pending' && (
                            <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: order.id, status: 'ordered' })} title="発注済みにする">
                              <CheckCircle className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {order.status === 'ordered' && (
                            <Button variant="ghost" size="sm" onClick={() => updateMutation.mutate({ id: order.id, status: 'received' })} title="入荷済みにする">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (order.bundleId) {
                              setFukubukuroEditOrder(order);
                            } else {
                              setEditingOrder(order);
                            }
                          }} title="編集">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (confirm("この発注を削除しますか？")) {
                              deleteMutation.mutate({ id: order.id });
                            }
                          }} title="削除">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <ProcurementCreateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        brands={brands}
        onSubmit={(data) => {
          batchCreateMutation.mutate(data);
        }}
        isLoading={batchCreateMutation.isPending}
      />

      {/* Edit Dialog */}
      {editingOrder && (
        <ProcurementEditDialog
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSubmit={(data) => updateMutation.mutate(data)}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Fukubukuro Create Dialog */}
      {showFukubukuroCreate && (
        <FukubukuroCreateDialog
          open={showFukubukuroCreate}
          onClose={() => setShowFukubukuroCreate(false)}
          onSubmit={(data) => fukubukuroCreateMutation.mutate(data)}
          isLoading={fukubukuroCreateMutation.isPending}
        />
      )}

      {/* Fukubukuro Detail Dialog */}
      {fukubukuroDetailOrder && (
        <FukubukuroDetailDialog
          order={fukubukuroDetailOrder}
          onClose={() => setFukubukuroDetailOrder(null)}
        />
      )}

      {/* Fukubukuro Edit Dialog */}
      {fukubukuroEditOrder && (
        <FukubukuroEditDialog
          order={fukubukuroEditOrder}
          onClose={() => setFukubukuroEditOrder(null)}
          onSubmit={(data) => fukubukuroUpdateMutation.mutate(data)}
          isLoading={fukubukuroUpdateMutation.isPending}
        />
      )}
    </div>
  );
}

// ==================== Procurement Create Dialog (複数商品選択対応・原価非表示) ====================
function ProcurementCreateDialog({ open, onClose, brands, onSubmit, isLoading }: {
  open: boolean;
  onClose: () => void;
  brands: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [brandId, setBrandId] = useState(0);
  const [brandName, setBrandName] = useState("");
  const [brandIds, setBrandIds] = useState<number[]>([]);
  const [selectedItems, setSelectedItems] = useState<Array<{ productId?: number; productName: string; pendingPaymentQty: number; pendingShipQty: number; qtyPerOrder: number; brandId?: number; brandName?: string }>>([])
  // 套組の訂単数管理（bundleId → orderCount）
  const [bundleOrderCounts, setBundleOrderCounts] = useState<Record<number, number>>({});
  // 套組の待支付・待发货管理
  const [bundlePendingPay, setBundlePendingPay] = useState<Record<number, number>>({});
  const [bundlePendingShip, setBundlePendingShip] = useState<Record<number, number>>({});
  // 订单数 = 待支付 + 待发货 (単品の場合)
  const getOrderCount = (item: any) => {
    if (item.bundleId) {
      // 套組の場合は套組の訂単数を使用
      return (bundlePendingPay[item.bundleId] || 0) + (bundlePendingShip[item.bundleId] || 0);
    }
    return item.pendingPaymentQty + item.pendingShipQty;
  };
  // 採購数 = 订单数 × 每单数量 (単品) or 套組訂単数 × 套組内数量 (套組)
  const getProcurementQty = (item: any) => {
    if (item.bundleId) {
      const bundleCount = (bundlePendingPay[item.bundleId] || 0) + (bundlePendingShip[item.bundleId] || 0);
      return bundleCount * (item.bundleItemQty || 1);
    }
    return (item.pendingPaymentQty + item.pendingShipQty) * item.qtyPerOrder;
  };
  // 商品あいまい検索（全商品横断）
  const [productSearch, setProductSearch] = useState("");
  const [productSearchDebounced, setProductSearchDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setProductSearchDebounced(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch]);
  const [manualProductName, setManualProductName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState("pending");
  const [memo, setMemo] = useState("");
  const [liveRoom, setLiveRoom] = useState("");
  const [shopName, setShopName] = useState("LCJ店铺");
  const [productLink, setProductLink] = useState("");
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();

  // ブランド合併ロジック（カタログと同じ）
  const mergedBrands = useMemo(() => {
    const normalizeKey = (name: string): string => {
      const n = name.toLowerCase().replace(/[\s\(\)（）/／・]+/g, '');
      if (n.includes('florasis') || n.includes('花西子') || n.includes('玉容花養')) return 'florasis';
      if (n.includes('栄進') || n.includes('dietmaru') || n.includes('ellecime') || n.includes('荣进')) return 'eishin';
      if (n.includes('kyogoku') || n.includes('京極')) return 'kyogoku';
      if (n.includes('方里') || n.includes('funny') || n.includes('ファンリー') || n.includes('siinono')) return 'funli';
      if (n.includes('mistine')) return 'mistine';
      if (n.includes('ibiza') || n.includes('イビサ')) return 'ibiza';
      if (n.includes('リコアセラム') || n.includes('ricoa') || n.includes('星睿肌') || n.includes('rikareal') || n.includes('リカリアル')) return 'rikareal';
      return n;
    };
    const merged: Record<string, { ids: number[]; name: string; count: number }> = {};
    for (const b of brands) {
      const key = normalizeKey(b.name || '');
      if (merged[key]) {
        merged[key].ids.push(b.id);
        merged[key].count++;
      } else {
        merged[key] = { ids: [b.id], name: b.name, count: 1 };
      }
    }
    return Object.values(merged).sort((a, b) => a.name.localeCompare(b.name));
  }, [brands]);

  // ブランド検索
  const [brandSearch, setBrandSearch] = useState("");
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const filteredBrands = useMemo(() => {
    if (!brandSearch) return mergedBrands;
    const lower = brandSearch.toLowerCase();
    return mergedBrands.filter((b) => b.name.toLowerCase().includes(lower));
  }, [mergedBrands, brandSearch]);

  // ブランド選択後に商品を自動取得
  const brandProductsQuery = trpc.selectionCenter.searchProductsForProcurement.useQuery(
    { brandIds: brandIds.length > 0 ? brandIds : undefined, limit: 50 },
    { enabled: brandIds.length > 0 }
  );
  const brandProducts = (brandProductsQuery.data as any)?.products || (Array.isArray(brandProductsQuery.data) ? brandProductsQuery.data : []);

  // 全商品横断あいまい検索
  const globalSearchQuery = trpc.selectionCenter.searchProductsForProcurement.useQuery(
    { search: productSearchDebounced, limit: 30 },
    { enabled: productSearchDebounced.length >= 1 }
  );
  const globalSearchResults = (globalSearchQuery.data as any)?.products || (Array.isArray(globalSearchQuery.data) ? globalSearchQuery.data : []);
  const globalSearchBundles: any[] = (globalSearchQuery.data as any)?.bundles || [];

  // 商品をトグル選択
  const toggleProduct = (product: any) => {
    const exists = selectedItems.find(i => i.productId === product.id);
    if (exists) {
      setSelectedItems(selectedItems.filter(i => i.productId !== product.id));
    } else {
      setSelectedItems([...selectedItems, { productId: product.id, productName: product.productName, pendingPaymentQty: 0, pendingShipQty: 1, qtyPerOrder: 1, brandId: product.brandId, brandName: product.brandName }]);
    }
  };

  // 手入力商品を追加
  const addManualProduct = () => {
    if (!manualProductName.trim()) return;
    setSelectedItems([...selectedItems, { productName: manualProductName.trim(), pendingPaymentQty: 0, pendingShipQty: 1, qtyPerOrder: 1 }]);
    setManualProductName("");
  };

  // 待支付数量変更
  const updatePendingPaymentQty = (index: number, qty: number) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], pendingPaymentQty: Math.max(0, qty) };
    setSelectedItems(updated);
  };

  // 待发货数量変更
  const updatePendingShipQty = (index: number, qty: number) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], pendingShipQty: Math.max(0, qty) };
    setSelectedItems(updated);
  };

  // 每单数量変更
  const updateQtyPerOrder = (index: number, qty: number) => {
    const updated = [...selectedItems];
    updated[index] = { ...updated[index], qtyPerOrder: Math.max(1, qty) };
    setSelectedItems(updated);
  };

  // 商品削除
  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (selectedItems.length === 0) {
      toast.error("商品を少なくとも1つ選択してください");
      return;
    }
    // ブランドが選択されていない場合、最初の商品のブランドを使用
    const effectiveBrandId = brandId || selectedItems[0]?.brandId || 0;
    const effectiveBrandName = brandName || selectedItems[0]?.brandName || "未指定";
    onSubmit({
      brandId: effectiveBrandId,
      brandName: effectiveBrandName,
      orderDate,
      status,
      memo: memo || undefined,
      liveRoom: liveRoom || undefined,
      shopName: shopName || undefined,
      productLink: productLink || undefined,
      items: selectedItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: getProcurementQty(item),
        unitCost: 0, // 原価は原価管理タブで別途管理
        pendingPaymentQty: item.pendingPaymentQty,
        pendingShipQty: item.pendingShipQty,
        qtyPerOrder: item.qtyPerOrder,
      })),
    });
  };

  // リセット
  useEffect(() => {
    if (open) {
      setBrandId(0);
      setBrandName("");
      setBrandIds([]);
      setSelectedItems([]);
      setBundleOrderCounts({});
      setBundlePendingPay({});
      setBundlePendingShip({});
      setManualProductName("");
      setProductSearch("");
      setProductSearchDebounced("");
      setOrderDate(new Date().toISOString().split('T')[0]);
      setStatus("pending");
      setMemo("");
      setLiveRoom("");
      setShopName("LCJ店铺");
      setProductLink("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新規仕入れ発注</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* 全商品横断検索（ID・商品名あいまい検索） */}
          <div>
            <Label>搜索商品（ID・商品名・バーコード）</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="商品ID、商品名、バーコードで検索..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            {productSearchDebounced.length >= 1 && (
              <div className="mt-1 border rounded-md max-h-[200px] overflow-y-auto">
                {globalSearchQuery.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs text-muted-foreground">検索中...</span>
                  </div>
                ) : globalSearchResults.length === 0 && globalSearchBundles.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">該当商品が見つかりません</div>
                ) : (
                  <>
                    {/* 套組結果 */}
                    {globalSearchBundles.length > 0 && (
                      <div className="border-b-2 border-purple-200">
                        <div className="px-3 py-1.5 bg-purple-50 text-xs font-medium text-purple-700 flex items-center gap-1">
                          <Layers className="h-3 w-3" />套組 ({globalSearchBundles.length}件)
                        </div>
                        {globalSearchBundles.map((bundle: any) => {
                          const isSelected = selectedItems.some(i => (i as any).bundleId === bundle.id);
                          return (
                            <button
                              key={`bundle-${bundle.id}`}
                              type="button"
                              className={`w-full text-left px-3 py-2 flex items-center gap-3 border-b last:border-b-0 hover:bg-purple-50/50 transition-colors ${isSelected ? 'bg-purple-50 border-purple-200' : ''}`}
                              onClick={() => {
                                // Add all items from the bundle to selectedItems
                                const bundleItems = (bundle.items || []).map((item: any) => ({
                                  productId: item.productId || undefined,
                                  productName: item.productName || `套組商品`,
                                  pendingPaymentQty: 0,
                                  pendingShipQty: 1,
                                  qtyPerOrder: item.quantity || 1,
                                  brandId: item.brandId || undefined,
                                  brandName: item.brandName || bundle.bundleName,
                                  bundleId: bundle.id,
                                  bundleName: bundle.bundleName,
                                  bundleItemQty: item.quantity || 1,
                                }));
                                if (isSelected) {
                                  // Remove all bundle items
                                  setSelectedItems(prev => prev.filter(i => (i as any).bundleId !== bundle.id));
                                  setBundleOrderCounts(prev => { const n = {...prev}; delete n[bundle.id]; return n; });
                                  setBundlePendingPay(prev => { const n = {...prev}; delete n[bundle.id]; return n; });
                                  setBundlePendingShip(prev => { const n = {...prev}; delete n[bundle.id]; return n; });
                                } else {
                                  setSelectedItems(prev => [...prev, ...bundleItems]);
                                  setBundleOrderCounts(prev => ({...prev, [bundle.id]: 1}));
                                  setBundlePendingPay(prev => ({...prev, [bundle.id]: 0}));
                                  setBundlePendingShip(prev => ({...prev, [bundle.id]: 1}));
                                }
                              }}
                            >
                              <Checkbox checked={isSelected} className="flex-shrink-0" />
                              <div className="w-10 h-10 rounded bg-purple-100 flex items-center justify-center flex-shrink-0 border border-purple-200">
                                <Layers className="w-5 h-5 text-purple-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm break-words ${isSelected ? 'font-bold text-purple-700' : 'font-medium'}`}>
                                  <span className="inline-flex items-center gap-1">
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 border-purple-300 text-purple-600">套組</Badge>
                                    {bundle.bundleName}
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {bundle.items?.length || 0}品含む
                                  {bundle.price ? ` | 套組価格: ¥${Number(bundle.price).toLocaleString()}` : ''}
                                  {bundle.status === 'online' ? ' | 已上架' : ''}
                                </p>
                                {bundle.items && bundle.items.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    内容: {bundle.items.map((i: any) => i.productName).filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* 商品結果 */}
                    {globalSearchResults.length > 0 && globalSearchBundles.length > 0 && (
                      <div className="px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />商品 ({globalSearchResults.length}件)
                      </div>
                    )}
                    {globalSearchResults.map((p: any) => {
                      let imgUrl = '';
                      try { const imgs = JSON.parse(p.images || '[]'); imgUrl = imgs[0] || ''; } catch {}
                      const isSelected = selectedItems.some(i => i.productId === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 flex items-center gap-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}
                          onClick={() => toggleProduct(p)}
                        >
                          <Checkbox checked={isSelected} className="flex-shrink-0" />
                          {imgUrl ? (
                            <img src={imgUrl} className="w-10 h-10 rounded object-cover flex-shrink-0 border" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 border">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm break-words ${isSelected ? 'font-bold text-blue-700' : 'font-medium'}`}>{p.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              ID: {p.id} | {p.brandName || ''}
                              {p.price ? ` | ¥${Number(p.price).toLocaleString()}` : ''}
                              {p.barcode ? ` | ${p.barcode}` : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 手入力オプション */}
          <div className="flex gap-2">
            <Input
              placeholder="商品名を手入力で追加..."
              value={manualProductName}
              onChange={e => setManualProductName(e.target.value)}
              className="text-sm flex-1"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualProduct(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addManualProduct} disabled={!manualProductName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* ブランド検索付きセレクト（合併済み）- 任意 */}
          <div>
            <Label>ブランド（任意・ブランド別絞り込み）</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setBrandDropdownOpen(!brandDropdownOpen)}
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <span className={brandName ? "" : "text-muted-foreground"}>
                  {brandName || "ブランドを検索..."}
                </span>
                <Search className="h-4 w-4 opacity-50" />
              </button>
              {brandDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="ブランド名で検索..."
                      value={brandSearch}
                      onChange={e => setBrandSearch(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    {filteredBrands.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">ブランドが見つかりません</div>
                    ) : (
                      filteredBrands.map((b, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent hover:text-accent-foreground cursor-pointer flex items-center gap-2 ${b.ids[0] === brandId ? 'bg-accent' : ''}`}
                          onClick={() => {
                            setBrandId(b.ids[0]);
                            setBrandName(b.name);
                            setBrandIds(b.ids);
                            setSelectedItems([]);
                            setBrandDropdownOpen(false);
                            setBrandSearch("");
                          }}
                        >
                          {b.ids[0] === brandId && <Check className="h-3 w-3" />}
                          <span>{b.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ブランド選択後に商品一覧を画像付きで表示（複数選択可能） */}
          {brandIds.length > 0 && (
            <div>
              <Label>ブランド内商品（複数選択可）</Label>
              {brandProductsQuery.isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">商品を読み込み中...</span>
                </div>
              ) : brandProducts.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground border rounded-md">
                  このブランドに登録された商品がありません
                </div>
              ) : (
                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                  {brandProducts.map((p: any) => {
                    let imgUrl = '';
                    try { const imgs = JSON.parse(p.images || '[]'); imgUrl = imgs[0] || ''; } catch {}
                    const isSelected = selectedItems.some(i => i.productId === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`w-full text-left px-3 py-2 flex items-center gap-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}
                        onClick={() => toggleProduct(p)}
                      >
                        <Checkbox checked={isSelected} className="flex-shrink-0" />
                        {imgUrl ? (
                          <img src={imgUrl} className="w-10 h-10 rounded object-cover flex-shrink-0 border" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 border">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm break-words ${isSelected ? 'font-bold text-blue-700' : 'font-medium'}`}>{p.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.price ? `売価: ¥${Number(p.price).toLocaleString()}` : ''}
                            {p.barcode ? `${p.price ? ' | ' : ''}${p.barcode}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* 選択済み商品一覧 */}
          {selectedItems.length > 0 && (
            <div>
              <Label>選択済み商品 ({selectedItems.length}件・総採購数: {selectedItems.reduce((sum, i) => sum + getProcurementQty(i), 0)}個)</Label>
              <div className="border rounded-md divide-y mt-1 max-h-[40vh] overflow-y-auto">
                {/* 套組をグループ表示 */}
                {(() => {
                  const bundleGroups: Record<number, { bundleName: string; items: Array<any & { _idx: number }> }> = {};
                  const standaloneItems: Array<any & { _idx: number }> = [];
                  selectedItems.forEach((item, idx) => {
                    const it = item as any;
                    if (it.bundleId) {
                      if (!bundleGroups[it.bundleId]) {
                        bundleGroups[it.bundleId] = { bundleName: it.bundleName || '套組', items: [] };
                      }
                      bundleGroups[it.bundleId].items.push({ ...it, _idx: idx });
                    } else {
                      standaloneItems.push({ ...item, _idx: idx });
                    }
                  });
                  return (
                    <>
                      {/* 套組グループ */}
                      {Object.entries(bundleGroups).map(([bundleIdStr, group]) => {
                        const bundleId = Number(bundleIdStr);
                        const bundleCount = (bundlePendingPay[bundleId] || 0) + (bundlePendingShip[bundleId] || 0);
                        const totalProcurement = group.items.reduce((sum, it) => sum + bundleCount * (it.bundleItemQty || 1), 0);
                        return (
                          <div key={`bundle-group-${bundleId}`} className="bg-purple-50/50">
                            {/* 套組ヘッダー：ここで訂単数を設定 */}
                            <div className="flex flex-col gap-2 px-3 py-2 border-b border-purple-200">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-purple-300 text-purple-600 bg-purple-100 flex-shrink-0">套組</Badge>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-purple-700 break-words">{group.bundleName}</p>
                                <p className="text-[10px] text-muted-foreground">{group.items.length}品 → 合計採購: {totalProcurement}個</p>
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => {
                                setSelectedItems(prev => prev.filter(i => (i as any).bundleId !== bundleId));
                                setBundleOrderCounts(prev => { const n = {...prev}; delete n[bundleId]; return n; });
                                setBundlePendingPay(prev => { const n = {...prev}; delete n[bundleId]; return n; });
                                setBundlePendingShip(prev => { const n = {...prev}; delete n[bundleId]; return n; });
                              }} className="h-7 w-7 p-0 flex-shrink-0">
                                <X className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Label className="text-xs text-orange-600 whitespace-nowrap">待支付:</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={bundlePendingPay[bundleId] || 0}
                                  onChange={e => setBundlePendingPay(prev => ({...prev, [bundleId]: Math.max(0, Number(e.target.value))}))}
                                  className="w-14 h-7 text-sm text-center"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Label className="text-xs text-blue-600 whitespace-nowrap">待发货:</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={bundlePendingShip[bundleId] || 0}
                                  onChange={e => setBundlePendingShip(prev => ({...prev, [bundleId]: Math.max(0, Number(e.target.value))}))}
                                  className="w-14 h-7 text-sm text-center"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Label className="text-xs text-green-600 whitespace-nowrap font-bold">订单数:</Label>
                                <span className="text-sm font-bold text-green-700">{(bundlePendingPay[bundleId] || 0) + (bundlePendingShip[bundleId] || 0)}</span>
                              </div>
                            </div>
                            </div>
                            {/* 套組内の商品（自動計算、編集不可） */}
                            {group.items.map((it) => (
                              <div key={it._idx} className="flex items-center gap-2 px-3 py-1.5 pl-8 text-xs">
                                <span className="text-muted-foreground">└</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm break-words">{it.productName}</p>
                                </div>
                                <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                                  每套 {it.bundleItemQty || 1}個 × {bundleCount}套 = <span className="font-medium text-foreground">{(it.bundleItemQty || 1) * bundleCount}個</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                      {/* 単品 */}
                      {standaloneItems.map((item) => (
                        <div key={item._idx} className="flex flex-col gap-1.5 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium break-words">{item.productName}</p>
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">订单: {getOrderCount(item)} × {item.qtyPerOrder} = <span className="font-medium text-foreground">{getProcurementQty(item)}件</span></span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item._idx)} className="h-7 w-7 p-0 flex-shrink-0">
                              <X className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-orange-600 whitespace-nowrap">待支付:</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.pendingPaymentQty}
                                onChange={e => updatePendingPaymentQty(item._idx, Number(e.target.value))}
                                className="w-14 h-7 text-sm text-center"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-blue-600 whitespace-nowrap">待发货:</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.pendingShipQty}
                                onChange={e => updatePendingShipQty(item._idx, Number(e.target.value))}
                                className="w-14 h-7 text-sm text-center"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-green-600 whitespace-nowrap">订单数:</Label>
                              <Input
                                type="number"
                                min={1}
                                value={item.qtyPerOrder}
                                onChange={e => updateQtyPerOrder(item._idx, Number(e.target.value))}
                                className="w-14 h-7 text-sm text-center"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>日期</Label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>
            <div>
              <Label>直播间</Label>
              <Select value={liveRoom} onValueChange={v => setLiveRoom(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {(liversQuery.data || []).map((liver: any) => (
                    <SelectItem key={liver.id} value={liver.name}>{liver.name}</SelectItem>
                  ))}
                  <SelectItem value="商品カード">商品カード</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>店铺名称</Label>
              <Input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="LCJ店铺" />
            </div>
            <div>
              <Label>ステータス</Label>
              <Select value={status} onValueChange={v => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">発注待ち</SelectItem>
                  <SelectItem value="ordered">発注済み</SelectItem>
                  <SelectItem value="received">入荷済み</SelectItem>
                  <SelectItem value="completed">処理完成</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>商品链接或ID</Label>
              <Input value={productLink} onChange={e => setProductLink(e.target.value)} placeholder="允许复制粘贴即可" />
            </div>
            <div>
              <Label>メモ</Label>
              <Input value={memo} onChange={e => setMemo(e.target.value)} placeholder="備考を入力..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={isLoading || selectedItems.length === 0}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {selectedItems.length > 0 ? `${selectedItems.length}件発注作成` : '発注作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Procurement Edit Dialog ====================
function ProcurementEditDialog({ order, onClose, onSubmit, isLoading }: {
  order: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [form, setForm] = useState({
    quantity: Number(order.quantity),
    unitCost: Number(order.unitCost),
    status: order.status,
    memo: order.memo || "",
    orderDate: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : "",
  });

  const handleSubmit = () => {
    onSubmit({
      id: order.id,
      quantity: form.quantity,
      unitCost: form.unitCost,
      status: form.status,
      memo: form.memo,
      orderDate: form.orderDate,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>発注編集: {order.productName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            ブランド: {order.brandName}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>数量</Label>
              <Input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label>単価 (円)</Label>
              <Input type="number" min={0} value={form.unitCost} onChange={e => setForm({ ...form, unitCost: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>発注日</Label>
              <Input type="date" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} />
            </div>
            <div>
              <Label>ステータス</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">発注待ち</SelectItem>
                  <SelectItem value="ordered">発注済み</SelectItem>
                  <SelectItem value="received">入荷済み</SelectItem>
                  <SelectItem value="completed">処理完成</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>合計金額</Label>
            <p className="text-lg font-bold text-blue-600">¥{(form.quantity * form.unitCost).toLocaleString()}</p>
          </div>
          <div>
            <Label>メモ</Label>
            <Textarea value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Fukubukuro Create Dialog ====================
function FukubukuroCreateDialog({ open, onClose, onSubmit, isLoading }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [text, setText] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState("pending");
  const [memo, setMemo] = useState("");
  const [liveRoom, setLiveRoom] = useState("");
  const [shopName, setShopName] = useState("LCJ店铺");
  const [parsedItems, setParsedItems] = useState<Array<{ inputName: string; matched: boolean; product?: any; quantity?: number }>>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [orderCount, setOrderCount] = useState(1);
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();

  const parseMutation = trpc.selectionCenter.parseFukubukuroText.useMutation({
    onSuccess: (data) => {
      setParsedItems(data.items);
      setIsParsing(false);
      const matchedCount = data.items.filter(i => i.matched).length;
      toast.success(`${data.totalLines}行解析: ${matchedCount}件マッチ, ${data.totalLines - matchedCount}件未マッチ`);
    },
    onError: (e) => { setIsParsing(false); toast.error("解析エラー: " + e.message); },
  });

  const handleParse = () => {
    if (!text.trim()) { toast.error("テキストを入力してください"); return; }
    setIsParsing(true);
    parseMutation.mutate({ text: text.trim() });
  };

  const handleSubmit = () => {
    if (parsedItems.length === 0) { toast.error("先にテキストを解析してください"); return; }
    if (!bundleName.trim()) { toast.error("福袋名を入力してください"); return; }
    if (orderCount < 1) { toast.error("订单数を1以上に設定してください"); return; }
    onSubmit({
      bundleName: bundleName.trim(),
      items: parsedItems.map(item => ({
        productId: item.product?.id,
        productName: item.product?.productName || item.inputName,
        quantity: (item.quantity || 1) * orderCount,
      })),
      orderDate,
      status,
      memo: memo || undefined,
      liveRoom: liveRoom || undefined,
      shopName: shopName || undefined,
      brandId: parsedItems.find(i => i.product?.brandId)?.product?.brandId,
      brandName: parsedItems.find(i => i.product?.brandName)?.product?.brandName,
      orderCount,
    });
  };

  useEffect(() => {
    if (open) {
      setText(""); setBundleName(""); setParsedItems([]);
      setOrderDate(new Date().toISOString().split('T')[0]);
      setStatus("pending"); setMemo(""); setLiveRoom(""); setShopName("LCJ店铺"); setOrderCount(1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-500" />
            福袋発注作成
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Step 1: Paste text */}
          <div>
            <Label className="text-sm font-medium">① 福袋内容を貼り付け（商品名を改行区切り）</Label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="例:
福袋 A
商品名1
商品名2
商品名3"
              rows={6}
              className="mt-1 font-mono text-sm"
            />
            <Button onClick={handleParse} disabled={isParsing || !text.trim()} className="mt-2" variant="secondary">
              {isParsing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
              商品マッチング実行
            </Button>
          </div>

          {/* Step 2: Show parsed results */}
          {parsedItems.length > 0 && (
            <div>
              <Label className="text-sm font-medium">② マッチング結果 ({parsedItems.filter(i => i.matched).length}/{parsedItems.length}件)</Label>
              <div className="border rounded-md divide-y mt-1 max-h-[250px] overflow-y-auto">
                {parsedItems.map((item, idx) => (
                  <div key={idx} className={`flex items-center gap-3 px-3 py-2 ${item.matched ? 'bg-green-50' : 'bg-red-50'}`}>
                    {item.matched ? (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="text-muted-foreground">入力:</span> {item.inputName}
                      </p>
                      {item.matched && item.product && (
                        <p className="text-xs text-green-700">
                          → {item.product.productName} ({item.product.brandName || 'ブランド未設定'})
                        </p>
                      )}
                      {!item.matched && (
                        <p className="text-xs text-red-600">※ 未登録商品（発注時に自動登録されます）</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs text-muted-foreground">每份:</span>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity || 1}
                        onChange={e => {
                          const newItems = [...parsedItems];
                          newItems[idx] = { ...newItems[idx], quantity: Math.max(1, parseInt(e.target.value) || 1) };
                          setParsedItems(newItems);
                        }}
                        className="w-16 h-7 text-center text-sm"
                      />
                      {orderCount > 1 && (
                        <span className="text-xs font-medium text-purple-600 ml-1">
                          采购: {(item.quantity || 1) * orderCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Bundle name and order details */}
          {parsedItems.length > 0 && (
            <>
              <div>
                <Label className="text-sm font-medium">③ 福袋名</Label>
                <Input value={bundleName} onChange={e => setBundleName(e.target.value)} placeholder="例: 福袋 Aセット" className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">④ 订单数（福袋份数）</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min={1}
                    value={orderCount}
                    onChange={e => setOrderCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24"
                    placeholder="1"
                  />
                  <span className="text-xs text-muted-foreground">
                    份 → 每个商品采购总量 = 每份数量 × {orderCount}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>日付</Label>
                  <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
                </div>
                <div>
                  <Label>直播间</Label>
                  <Select value={liveRoom} onValueChange={v => setLiveRoom(v)}>
                    <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      {(liversQuery.data || []).map((liver: any) => (
                        <SelectItem key={liver.id} value={liver.name}>{liver.name}</SelectItem>
                      ))}
                      <SelectItem value="商品カード">商品カード</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>店铺名称</Label>
                  <Input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="LCJ店铺" />
                </div>
                <div>
                  <Label>ステータス</Label>
                  <Select value={status} onValueChange={v => setStatus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">発注待ち</SelectItem>
                      <SelectItem value="ordered">発注済み</SelectItem>
                      <SelectItem value="received">入荷済み</SelectItem>
                      <SelectItem value="completed">処理完成</SelectItem>
                      <SelectItem value="cancelled">キャンセル</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>メモ</Label>
                <Textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="備考を入力..." rows={2} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={isLoading || parsedItems.length === 0 || !bundleName.trim()} className="bg-purple-600 hover:bg-purple-700">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
            福袋発注作成 ({parsedItems.length}品)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Fukubukuro Detail Dialog ====================
function FukubukuroDetailDialog({ order, onClose }: { order: any; onClose: () => void }) {
  const bundleQuery = trpc.selectionCenter.getBundleById.useQuery(
    { id: order.bundleId },
    { enabled: !!order.bundleId }
  );
  const bundle = bundleQuery.data;

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate">
            <Gift className="h-5 w-5 text-purple-500" />
            福袋詳細: {order.productName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {bundleQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
              <span className="ml-2 text-muted-foreground">読み込み中...</span>
            </div>
          ) : bundle ? (
            <>
              <div className="text-sm text-muted-foreground">
                バンドル名: <span className="font-medium text-foreground">{bundle.bundleName}</span>
                {bundle.description && <span className="ml-2">({bundle.description})</span>}
              </div>
              <div className="border rounded-md divide-y overflow-hidden">
                {bundle.items?.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2">
                    {(() => {
                      const imgs = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
                      return imgs.length > 0 ? (
                        <img src={imgs[0]} className="w-8 h-8 rounded object-cover flex-shrink-0 border" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0 border">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      );
                    })()}
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-sm font-medium truncate max-w-full">{item.productName || '(未登録)'}</p>
                      {item.brandName && <p className="text-xs text-muted-foreground">{item.brandName}</p>}
                      {(!item.productId || item.productId === 0) && <p className="text-xs text-orange-500">未マッチング</p>}
                    </div>
                    <Badge variant="secondary" className="whitespace-nowrap">×{item.quantity || 1}</Badge>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground text-right">
                合計 {bundle.items?.length || 0} 商品
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p>バンドル情報が見つかりません</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>閉じる</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Fukubukuro Edit Dialog ====================
function FukubukuroEditDialog({ order, onClose, onSubmit, isLoading }: {
  order: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const bundleQuery = trpc.selectionCenter.getBundleById.useQuery(
    { id: order.bundleId },
    { enabled: !!order.bundleId }
  );
  const bundle = bundleQuery.data;

  // Items state: each item has { productId, productName, quantity }
  const [items, setItems] = useState<Array<{ productId?: number; productName: string; quantity: number }>>([]);
  const [bundleName, setBundleName] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [status, setStatus] = useState("pending");
  const [memo, setMemo] = useState("");
  const [liveRoom, setLiveRoom] = useState("");
  const [shopName, setShopName] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const liversQuery = trpc.selectionCenter.getLivers.useQuery();

  // Initialize from bundle data
  useEffect(() => {
    if (bundle) {
      setBundleName(bundle.bundleName || "");
      setItems((bundle.items || []).map((item: any) => ({
        productId: item.productId && item.productId > 0 ? item.productId : undefined,
        productName: item.productName || '(未登録)',
        quantity: item.quantity || 1,
      })));
    }
    setOrderDate(order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : "");
    setStatus(order.status || "pending");
    setMemo(order.memo || "");
    setLiveRoom(order.liveRoom || "");
    setShopName(order.shopName || "");
  }, [bundle, order]);

  const searchMutation = trpc.selectionCenter.searchProductsForProcurement.useMutation({
    onSuccess: (data: any) => { setSearchResults(data?.products || (Array.isArray(data) ? data : [])); setIsSearching(false); },
    onError: () => { setSearchResults([]); setIsSearching(false); },
  });

  const handleSearch = () => {
    if (!newItemText.trim()) return;
    setIsSearching(true);
    searchMutation.mutate({ keyword: newItemText.trim() });
  };

  const addItem = (product?: any) => {
    if (product) {
      // Check if already in list
      if (items.some(i => i.productId === product.id)) {
        toast.error("この商品は既に追加されています");
        return;
      }
      setItems([...items, { productId: product.id, productName: product.productName, quantity: 1 }]);
    } else if (newItemText.trim()) {
      setItems([...items, { productName: newItemText.trim(), quantity: 1 }]);
    }
    setNewItemText("");
    setSearchResults([]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (items.length === 0) { toast.error("商品を追加してください"); return; }
    if (!bundleName.trim()) { toast.error("福袋名を入力してください"); return; }
    onSubmit({
      orderId: order.id,
      bundleId: order.bundleId,
      bundleName: bundleName.trim(),
      items: items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      })),
      orderDate,
      status,
      memo,
      liveRoom,
      shopName,
      brandName: order.brandName,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-500" />
            福袋編集: {order.productName}
          </DialogTitle>
        </DialogHeader>

        {bundleQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bundle name */}
            <div>
              <Label>福袋名</Label>
              <Input value={bundleName} onChange={e => setBundleName(e.target.value)} />
            </div>

            {/* Items list */}
            <div>
              <Label className="text-sm font-medium">商品リスト ({items.length}品)</Label>
              <div className="border rounded-md divide-y mt-1 max-h-[400px] overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-words">{item.productName}</p>
                      {!item.productId && <span className="text-xs text-orange-500">未マッチング</span>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[idx] = { ...newItems[idx], quantity: Math.max(1, parseInt(e.target.value) || 1) };
                          setItems(newItems);
                        }}
                        className="w-16 h-7 text-center text-sm"
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-red-500 h-6 w-6 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">商品がありません</div>
                )}
              </div>
            </div>

            {/* Add item */}
            <div>
              <Label className="text-sm font-medium">商品を追加</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  placeholder="商品名を検索..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                />
                <Button variant="secondary" size="sm" onClick={handleSearch} disabled={isSearching || !newItemText.trim()}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => addItem()} disabled={!newItemText.trim()} title="未登録商品として追加">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="border rounded-md mt-1 max-h-[150px] overflow-y-auto divide-y">
                  {searchResults.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer" onClick={() => addItem(p)}>
                      <Plus className="h-3 w-3 text-green-600" />
                      <span className="text-sm truncate">{p.productName}</span>
                      {p.brandName && <span className="text-xs text-muted-foreground">({p.brandName})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>日付</Label>
                <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
              <div>
                <Label>直播间</Label>
                <Select value={liveRoom} onValueChange={v => setLiveRoom(v)}>
                  <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                  <SelectContent>
                    {(liversQuery.data || []).map((liver: any) => (
                      <SelectItem key={liver.id} value={liver.name}>{liver.name}</SelectItem>
                    ))}
                    <SelectItem value="商品カード">商品カード</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>店舗名称</Label>
                <Select value={shopName} onValueChange={v => setShopName(v)}>
                  <SelectTrigger><SelectValue placeholder="店舗を選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LCJ店舗">LCJ店舗</SelectItem>
                    <SelectItem value="KG店舗">KG店舗</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ステータス</Label>
                <Select value={status} onValueChange={v => setStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">発注待ち</SelectItem>
                    <SelectItem value="ordered">発注済み</SelectItem>
                    <SelectItem value="received">入荷済み</SelectItem>
                    <SelectItem value="completed">処理完成</SelectItem>
                    <SelectItem value="cancelled">キャンセル</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>メモ</Label>
              <Textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={isLoading || items.length === 0} className="bg-purple-600 hover:bg-purple-700">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Gift className="h-4 w-4 mr-1" />}
            福袋更新 ({items.length}品)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Cost Management Tab (原価管理・パスワード保護) ====================
function CostManagementTab() {
  const [authenticated, setAuthenticated] = useState(() => {
    return sessionStorage.getItem('cost_management_auth') === 'authenticated';
  });
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const COST_PASSWORD = "lcj59";

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (password === COST_PASSWORD) {
      setAuthenticated(true);
      sessionStorage.setItem('cost_management_auth', 'authenticated');
      setPasswordError("");
    } else {
      setPasswordError("密码不正确");
    }
  };

  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle className="text-lg">成本管理</CardTitle>
            <p className="text-sm text-muted-foreground">访问需要密码</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="请输入密码..."
                  value={password}
                  onChange={e => { setPassword(e.target.value); setPasswordError(""); }}
                  autoFocus
                />
                {passwordError && <p className="text-xs text-red-500 mt-1">{passwordError}</p>}
              </div>
              <Button type="submit" className="w-full">验证</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <CostManagementContent />;
}

function CostManagementContent() {
  const [filterBrandId, setFilterBrandId] = useState<number | undefined>(undefined);
  const [editingCost, setEditingCost] = useState<any>(null);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [costHistorySearch, setCostHistorySearch] = useState('');

  const brandsQuery = trpc.brand.list.useQuery();
  const brands = brandsQuery.data || [];

  // 原価履歴取得
  const costHistoryQuery = trpc.selectionCenter.getProductCostHistory.useQuery({
    brandId: filterBrandId,
    search: costHistorySearch || undefined,
    limit: 100,
  });
  const costHistory = costHistoryQuery.data || [];

  // 原価登録ミューテーション
  const registerCostMutation = trpc.selectionCenter.registerProductCost.useMutation({
    onSuccess: () => {
      toast.success("原価を更新しました");
      costHistoryQuery.refetch();
      setEditingCost(null);
    },
    onError: (e) => toast.error("エラー: " + e.message),
  });

  // 原価履歴削除
  const deleteCostHistoryMutation = trpc.selectionCenter.deleteProductCostHistory.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      costHistoryQuery.refetch();
    },
    onError: (e) => toast.error("删除失败: " + e.message),
  });

  // 原価履歴更新
  const [editingCostRecord, setEditingCostRecord] = useState<any>(null);
  const [editCostValue, setEditCostValue] = useState("");
  const [editEffectiveDate, setEditEffectiveDate] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [editBrandId, setEditBrandId] = useState<number | undefined>(undefined);

  const updateCostHistoryMutation = trpc.selectionCenter.updateProductCostHistory.useMutation({
    onSuccess: () => {
      toast.success("更新しました");
      costHistoryQuery.refetch();
      setEditingCostRecord(null);
    },
    onError: (e) => toast.error("更新失败: " + e.message),
  });

  // 発注の原価を更新

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-amber-600" />
          成本管理
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowSyncDialog(true)} className="gap-1">
            <RefreshCw className="h-4 w-4" />
            同步商品
          </Button>
          <Button onClick={() => setShowRegisterDialog(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            登记成本
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-[280px]">
          <BrandSearchSelect
            brands={[{ id: 0, name: "全部品牌" }, ...brands]}
            value={filterBrandId || 0}
            onChange={(id, _name) => setFilterBrandId(id === 0 ? undefined : id)}
            placeholder="按品牌筛选..."
          />
        </div>
      </div>


      {/* 成本变更历史 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">成本变更历史</CardTitle>
            <div className="relative w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="搜索商品名/品牌..."
                value={costHistorySearch}
                onChange={(e) => setCostHistorySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">图片</th>
                  <th className="text-left p-3 font-medium">生效日</th>
                  <th className="text-left p-3 font-medium">品牌</th>
                  <th className="text-left p-3 font-medium">商品名</th>
                  <th className="text-right p-3 font-medium">成本（税前）</th>
                  <th className="text-left p-3 font-medium">备注</th>
                  <th className="text-center p-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {costHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-muted-foreground">暂无成本历史</td>
                  </tr>
                ) : (
                  costHistory.map((c: any) => (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="p-3">
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt={c.productName}
                            className="w-10 h-10 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setEnlargedImage(c.imageUrl)}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </td>
                      <td className="p-3">{c.effectiveDate ? new Date(c.effectiveDate).toLocaleDateString('ja-JP') : '-'}</td>
                      <td className="p-3">{c.brandName}</td>
                      <td className="p-3">{c.productName}</td>
                      <td className="p-3 text-right font-bold text-amber-600">¥{Number(c.unitCost).toLocaleString()}</td>
                      <td className="p-3 text-xs text-muted-foreground">{c.memo || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              setEditingCostRecord(c);
                              setEditCostValue(String(Number(c.unitCost)));
                              setEditEffectiveDate(c.effectiveDate ? new Date(c.effectiveDate).toISOString().split('T')[0] : '');
                              setEditMemo(c.memo || '');
                              setEditBrandId(c.brandId || undefined);
                            }}
                            title="编辑"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              if (confirm('确定要删除这条成本记录吗？')) {
                                deleteCostHistoryMutation.mutate({ id: c.id });
                              }
                            }}
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 原価登録ダイアログ */}
      <CostRegisterDialog
        open={showRegisterDialog}
        onClose={() => setShowRegisterDialog(false)}
        brands={brands}
        onSuccess={() => {
          costHistoryQuery.refetch();
        }}
      />

      {/* 原価履歴編集ダイアログ */}
      {editingCostRecord && (
        <Dialog open={!!editingCostRecord} onOpenChange={(v) => !v && setEditingCostRecord(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>編集: {editingCostRecord.productName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium">ブランド</label>
                <select
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  value={editBrandId || ''}
                  onChange={(e) => setEditBrandId(e.target.value ? Number(e.target.value) : undefined)}
                >
                  <option value="">選択してください</option>
                  {brands.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">成本（税前）</label>
                <input
                  type="number"
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  value={editCostValue}
                  onChange={(e) => setEditCostValue(e.target.value)}
                  placeholder="例: 2500"
                />
              </div>
              <div>
                <label className="text-sm font-medium">生效日</label>
                <input
                  type="date"
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  value={editEffectiveDate}
                  onChange={(e) => setEditEffectiveDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">备注</label>
                <input
                  type="text"
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  value={editMemo}
                  onChange={(e) => setEditMemo(e.target.value)}
                  placeholder="备注信息"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingCostRecord(null)}>取消</Button>
              <Button
                onClick={() => {
                  const selectedBrand = brands.find((b: any) => b.id === editBrandId);
                  updateCostHistoryMutation.mutate({
                    id: editingCostRecord.id,
                    unitCost: editCostValue ? Number(editCostValue) : undefined,
                    effectiveDate: editEffectiveDate || undefined,
                    memo: editMemo,
                    brandId: editBrandId,
                    brandName: selectedBrand?.name,
                  });
                }}
                disabled={updateCostHistoryMutation.isPending}
              >
                {updateCostHistoryMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 同步商品ダイアログ */}
      {showSyncDialog && (
        <ProductSyncDialog
          open={showSyncDialog}
          onClose={() => setShowSyncDialog(false)}
          brands={brands}
          onSuccess={() => {
            costHistoryQuery.refetch();
          }}
        />
      )}
      {/* 画像拡大モーダル */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={enlargedImage}
              alt="商品画像"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-gray-100 text-gray-700 font-bold"
            >
              ×
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// 原価編集フォーム
function CostEditForm({ order, onSubmit, onClose, isLoading }: {
  order: any;
  onSubmit: (unitCost: number) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [unitCost, setUnitCost] = useState(Number(order.unitCost) || 0);

  return (
    <div className="space-y-4">
      <div>
        <Label>商品名</Label>
        <p className="text-sm font-medium">{order.productName}</p>
      </div>
      <div>
        <Label>品牌</Label>
        <p className="text-sm text-muted-foreground">{order.brandName}</p>
      </div>
      <div>
        <Label>数量</Label>
        <p className="text-sm">{Number(order.quantity).toLocaleString()}个</p>
      </div>
      <div>
        <Label>成本/单价 (圆)</Label>
        <Input
          type="number"
          min={0}
          value={unitCost}
          onChange={e => setUnitCost(Number(e.target.value))}
          autoFocus
        />
      </div>
      <div>
        <Label>合计成本</Label>
        <p className="text-lg font-bold text-amber-600">¥{(Number(order.quantity) * unitCost).toLocaleString()}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button onClick={() => onSubmit(unitCost)} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          更新
        </Button>
      </DialogFooter>
    </div>
  );
}

// 原価未設定の発注一覧
function PendingCostOrders({ filterBrandId, onUpdate }: { filterBrandId?: number; onUpdate: () => void }) {
  const ordersQuery = trpc.selectionCenter.getProcurementOrders.useQuery({
    brandId: filterBrandId,
    limit: 500,
    offset: 0,
  });
  const pendingOrders = (ordersQuery.data?.orders || []).filter((o: any) => !o.unitCost || Number(o.unitCost) === 0);

  const updateOrderMutation = trpc.selectionCenter.updateProcurementOrder.useMutation({
    onSuccess: () => {
      toast.success("已设定成本");
      ordersQuery.refetch();
      onUpdate();
    },
    onError: (e) => toast.error("错误: " + e.message),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCost, setEditCost] = useState(0);

  if (pendingOrders.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">暂无未设定成本的订单</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium">下单日</th>
            <th className="text-left p-3 font-medium">品牌</th>
            <th className="text-left p-3 font-medium">商品名</th>
            <th className="text-right p-3 font-medium">数量</th>
            <th className="text-right p-3 font-medium">设定成本</th>
          </tr>
        </thead>
        <tbody>
          {pendingOrders.map((order: any) => (
            <tr key={order.id} className="border-b hover:bg-muted/30">
              <td className="p-3">{order.orderDate ? new Date(order.orderDate).toLocaleDateString('ja-JP') : '-'}</td>
              <td className="p-3">{order.brandName}</td>
              <td className="p-3">{order.productName}</td>
              <td className="p-3 text-right">{Number(order.quantity).toLocaleString()}</td>
              <td className="p-3 text-right">
                {editingId === order.id ? (
                  <div className="flex items-center gap-1 justify-end">
                    <Input
                      type="number"
                      min={0}
                      value={editCost}
                      onChange={e => setEditCost(Number(e.target.value))}
                      className="w-20 h-7 text-sm text-right"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => {
                        updateOrderMutation.mutate({ id: order.id, unitCost: editCost });
                        setEditingId(null);
                      }}
                      disabled={updateOrderMutation.isPending}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => { setEditingId(order.id); setEditCost(0); }}
                  >
                    设定成本
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// 原価登録ダイアログ
function CostRegisterDialog({ open, onClose, brands, onSuccess }: {
  open: boolean;
  onClose: () => void;
  brands: any[];
  onSuccess: () => void;
}) {
  const [selectedBrandId, setSelectedBrandId] = useState<number | undefined>(undefined);
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [manualProductName, setManualProductName] = useState("");
  const [unitCost, setUnitCost] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState("");
  const [isManualInput, setIsManualInput] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce product search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // 商品検索（ブランド選択 or 商品名検索で絞り込み）
  const productsQuery = trpc.selectionCenter.searchProductsForProcurement.useQuery(
    {
      brandIds: selectedBrandIds.length > 0 ? selectedBrandIds : undefined,
      brandId: selectedBrandId,
      search: debouncedSearch || undefined,
      limit: 100,
    },
    { enabled: !!selectedBrandId || debouncedSearch.length >= 2 }
  );
  const products = (productsQuery.data as any)?.products || (Array.isArray(productsQuery.data) ? productsQuery.data : []);

  // 原価登録ミューテーション
  const registerCostMutation = trpc.selectionCenter.registerProductCost.useMutation({
    onSuccess: () => {
      toast.success("已登记成本");
      onSuccess();
      handleReset();
      onClose();
    },
    onError: (e) => toast.error("エラー: " + e.message),
  });

  const handleReset = () => {
    setSelectedBrandId(undefined);
    setSelectedBrandIds([]);
    setSelectedProduct(null);
    setManualProductName("");
    setUnitCost(0);
    setQuantity(1);
    setEffectiveDate(new Date().toISOString().split('T')[0]);
    setMemo("");
    setIsManualInput(false);
    setProductSearch("");
    setDebouncedSearch("");
  };

  const handleSubmit = () => {
    const productName = isManualInput ? manualProductName : (selectedProduct?.productName || "");
    const productId = isManualInput ? 0 : (selectedProduct?.id || 0);
    // Use brand from selected product if no brand was explicitly chosen
    const effectiveBrandId = selectedBrandId || selectedProduct?.brandId;
    const brandName = brands.find(b => b.id === effectiveBrandId)?.name || selectedProduct?.brandName || "";

    if (!effectiveBrandId || !productName || unitCost <= 0) {
      toast.error("请选择商品并输入成本");
      return;
    }

    registerCostMutation.mutate({
      productId,
      productName,
      brandId: effectiveBrandId,
      brandName,
      unitCost,
      effectiveDate,
      memo: memo || `原価登録 (数量: ${quantity})`,
    });
  };

  const selectedBrandName = brands.find(b => b.id === selectedBrandId)?.name || "";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { handleReset(); onClose(); } }}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-6 w-6 text-amber-600" />
            原価登録
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* ブランド選択 + 商品検索 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">品牌</Label>
              <div className="mt-1">
                <BrandSearchSelect
                  brands={brands}
                  value={selectedBrandId || 0}
                  onChange={(id, _name, allIds) => {
                    setSelectedBrandId(id === 0 ? undefined : id);
                    setSelectedBrandIds(allIds || [id]);
                    setSelectedProduct(null);
                    setIsManualInput(false);
                  }}
                  placeholder="选择品牌..."
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">商品検索</Label>
              <div className="mt-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="商品名で検索..."
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setSelectedProduct(null);
                    setIsManualInput(false);
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">品牌を選択せずに商品名だけで検索も可能です</p>
            </div>
          </div>

          {/* 商品選択 */}
          {(selectedBrandId || debouncedSearch.length >= 2) && (
            <div>
              <Label className="text-sm font-medium">选择商品 *</Label>
              {productsQuery.isLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载商品中...
                </div>
              ) : products.length > 0 && !isManualInput ? (
                <div className="mt-1 space-y-2">
                  <div className="text-xs text-muted-foreground mb-1">{products.length}件の商品が見つかりました</div>
                <div className="max-h-[450px] overflow-y-auto border rounded-md">
                    {products.map((p: any) => {
                      const images = (() => { try { return JSON.parse(p.images || '[]'); } catch { return []; } })();
                      const thumb = images[0] || '';
                      const isSelected = selectedProduct?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${isSelected ? 'bg-amber-50 border-amber-200' : ''}`}
                          onClick={() => {
                            setSelectedProduct(p);
                            if (p.purchasePrice && Number(p.purchasePrice) > 0) {
                              setUnitCost(Number(p.purchasePrice));
                            }
                          }}
                        >
                          {thumb ? (
                            <img src={thumb} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-14 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium break-words">{p.productName}</p>
                            {p.brandName && <p className="text-xs text-muted-foreground">品牌: {p.brandName}</p>}
                            <p className="text-xs text-muted-foreground">
                              售价: ¥{Number(p.price || 0).toLocaleString()}
                              {p.purchasePrice && Number(p.purchasePrice) > 0 && (
                                <span className="ml-2 text-amber-600">当前成本: ¥{Number(p.purchasePrice).toLocaleString()}</span>
                              )}
                            </p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-amber-600 flex-shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setIsManualInput(true)}
                  >
                    找不到商品？手动输入 →
                  </button>
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <Input
                    placeholder="手动输入商品名..."
                    value={manualProductName}
                    onChange={e => setManualProductName(e.target.value)}
                  />
                  {products.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setIsManualInput(false)}
                    >
                      ← 从商品列表选择
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 選択された商品の表示 */}
          {(selectedProduct || (isManualInput && manualProductName)) && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">成本/单价 (圆) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={unitCost}
                    onChange={e => setUnitCost(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">数量</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">生效日</Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">合计成本</Label>
                  <p className="text-lg font-bold text-amber-600 mt-1">
                    ¥{(unitCost * quantity).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">备注</Label>
                <Input
                  placeholder="输入备注..."
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => { handleReset(); onClose(); }}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={registerCostMutation.isPending || (!selectedBrandId && !selectedProduct?.brandId) || (!selectedProduct && !manualProductName) || unitCost <= 0}
          >
            {registerCostMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            登记
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Product Sync Dialog ====================
function ProductSyncDialog({ open, onClose, brands, onSuccess }: {
  open: boolean;
  onClose: () => void;
  brands: any[];
  onSuccess: () => void;
}) {
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
  const [syncSearch, setSyncSearch] = useState('');
  const [syncBrandId, setSyncBrandId] = useState<number | undefined>(undefined);
  const [costInputs, setCostInputs] = useState<Record<number, string>>({});

  const productsQuery = trpc.selectionCenter.getProductsNotInCostHistory.useQuery({
    search: syncSearch || undefined,
    brandId: syncBrandId,
    limit: 100,
  });
  const products = productsQuery.data || [];

  const syncMutation = trpc.selectionCenter.syncProductsToCost.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.synced}件の商品を成本管理に同期しました`);
      onSuccess();
      onClose();
      setSelectedProducts(new Set());
      setCostInputs({});
    },
    onError: (e) => toast.error('同期失敗: ' + e.message),
  });

  const toggleSelect = (id: number) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map((p: any) => p.id)));
    }
  };

  const handleSync = () => {
    const toSync = products
      .filter((p: any) => selectedProducts.has(p.id))
      .map((p: any) => ({
        productId: p.id,
        productName: p.productName,
        brandId: p.brandId || 0,
        brandName: p.brandName || '',
        unitCost: Number(costInputs[p.id]) || Number(p.purchasePrice) || 0,
      }));
    if (toSync.length === 0) {
      toast.error('请选择至少一个商品');
      return;
    }
    if (toSync.some(p => p.unitCost <= 0)) {
      toast.error('请为所有选中商品填写成本');
      return;
    }
    syncMutation.mutate({ products: toSync });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>同步商品到成本管理</DialogTitle>
          <p className="text-sm text-muted-foreground">选择商品管理中尚未登记成本的商品，同步到成本管理模块。</p>
        </DialogHeader>
        <div className="flex items-center gap-2 py-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索商品名/品牌..."
              value={syncSearch}
              onChange={(e) => setSyncSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex items-center justify-between py-1 border-b">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={products.length > 0 && selectedProducts.size === products.length}
              onChange={selectAll}
              className="rounded"
            />
            全选 ({selectedProducts.size}/{products.length})
          </label>
          <span className="text-xs text-muted-foreground">
            {products.length}件の未登記商品
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 py-2 min-h-0">
          {productsQuery.isLoading ? (
            <p className="text-center py-8 text-muted-foreground text-sm">加载中...</p>
          ) : products.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">所有商品已同步到成本管理</p>
          ) : (
            products.map((p: any) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-2 rounded-md border transition-colors ${selectedProducts.has(p.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-muted/50 border-transparent'}`}
              >
                <input
                  type="checkbox"
                  checked={selectedProducts.has(p.id)}
                  onChange={() => toggleSelect(p.id)}
                  className="rounded shrink-0"
                />
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.productName}</p>
                  <p className="text-xs text-muted-foreground">{p.brandName}</p>
                </div>
                <div className="shrink-0 w-[120px]">
                  <input
                    type="number"
                    placeholder={p.purchasePrice ? `¥${p.purchasePrice}` : "成本"}
                    value={costInputs[p.id] || ''}
                    onChange={(e) => setCostInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="w-full px-2 py-1 text-sm border rounded text-right"
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={handleSync}
            disabled={selectedProducts.size === 0 || syncMutation.isPending}
            className="gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {syncMutation.isPending ? '同步中...' : `同步 (${selectedProducts.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Bundles (套组) Tab ====================
function BundlesTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editBundle, setEditBundle] = useState<any>(null);

  const bundlesQuery = trpc.selectionCenter.getBundles.useQuery({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const productsQuery = trpc.selectionCenter.getProducts.useQuery({ page: 1, pageSize: 200 });

  const createMutation = trpc.selectionCenter.createBundle.useMutation({
    onSuccess: () => { bundlesQuery.refetch(); setShowCreateDialog(false); toast.success("套组创建成功"); },
    onError: (err) => { toast.error(err.message || "创建失败"); },
  });
  const updateMutation = trpc.selectionCenter.updateBundle.useMutation({
    onSuccess: () => { bundlesQuery.refetch(); setEditBundle(null); toast.success("套组更新成功"); },
    onError: (err) => { toast.error(err.message || "更新失败"); },
  });
  const deleteMutation = trpc.selectionCenter.deleteBundle.useMutation({
    onSuccess: () => { bundlesQuery.refetch(); toast.success("套组已删除"); },
  });
  const statusMutation = trpc.selectionCenter.updateBundle.useMutation({
    onSuccess: () => { bundlesQuery.refetch(); toast.success("状态已更新"); },
  });

  const bundles = bundlesQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索套组名称..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="online">已上架</SelectItem>
            <SelectItem value="offline">已下架</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-1" />创建套组</Button>
      </div>

      {/* Bundles List */}
      <div className="grid gap-4">
        {bundles.map((bundle: any) => (
          <Card key={bundle.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{bundle.bundleName}</h3>
                    {bundle.bundleNameCn && <span className="text-sm text-muted-foreground">({bundle.bundleNameCn})</span>}
                    <Badge variant={bundle.status === "online" ? "default" : bundle.status === "draft" ? "secondary" : "outline"}>
                      {bundle.status === "online" ? "已上架" : bundle.status === "draft" ? "草稿" : "已下架"}
                    </Badge>
                  </div>
                  {bundle.description && <p className="text-sm text-muted-foreground mb-2">{bundle.description}</p>}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-orange-600">套组价: ¥{Number(bundle.price || 0).toLocaleString()}</span>
                    {bundle.marketPrice && <span className="text-muted-foreground line-through">¥{Number(bundle.marketPrice).toLocaleString()}</span>}
                    <span>库存: {bundle.stock}</span>
                    <span>包含 {bundle.items?.length || 0} 个商品</span>
                  </div>
                  {/* Items preview */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bundle.items?.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1 text-xs">
                        {(() => {
                          const imgs = item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : [];
                          return imgs.length > 0 ? <img src={imgs[0]} className="w-5 h-5 rounded object-cover" /> : <Package className="w-4 h-4 text-muted-foreground" />;
                        })()}
                        <span className="max-w-[120px] truncate">{item.productName}</span>
                        {item.quantity > 1 && <span className="text-muted-foreground">×{item.quantity}</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  {bundle.status !== "online" && (
                    <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: bundle.id, status: "online" })} title="上架">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  {bundle.status === "online" && (
                    <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: bundle.id, status: "offline" })} title="下架">
                      <Eye className="h-4 w-4 text-orange-600" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditBundle(bundle)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("确定要删除此套组吗？")) deleteMutation.mutate({ id: bundle.id }); }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {bundles.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>暂无套组</p>
            <p className="text-xs mt-1">点击「创建套组」开始组合商品</p>
          </div>
        )}
      </div>

      {/* Create/Edit Bundle Dialog */}
      <BundleFormDialog
        open={showCreateDialog || !!editBundle}
        onClose={() => { setShowCreateDialog(false); setEditBundle(null); }}
        bundle={editBundle}
        products={productsQuery.data?.items || []}
        onSubmit={(data: any) => {
          if (editBundle) {
            updateMutation.mutate({ id: editBundle.id, ...data });
          } else {
            createMutation.mutate(data);
          }
        }}
        loading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function BundleFormDialog({ open, onClose, bundle, products, onSubmit, loading }: any) {
  const [form, setForm] = useState<any>({});
  const [selectedItems, setSelectedItems] = useState<{ productId: number; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (open) {
      if (bundle) {
        setForm({
          bundleName: bundle.bundleName || "",
          bundleNameCn: bundle.bundleNameCn || "",
          description: bundle.description || "",
          price: bundle.price ? Number(bundle.price) : "",
          marketPrice: bundle.marketPrice ? Number(bundle.marketPrice) : "",
          stock: bundle.stock || 0,
          status: bundle.status || "draft",
        });
        setSelectedItems(bundle.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity || 1 })) || []);
      } else {
        setForm({ bundleName: "", bundleNameCn: "", description: "", price: "", marketPrice: "", stock: 0, status: "draft" });
        setSelectedItems([]);
      }
      setProductSearch("");
    }
  }, [open, bundle]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 20);
    return products.filter((p: any) =>
      p.productName?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.productNameCn?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brandName?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 20);
  }, [products, productSearch]);

  const handleSubmit = () => {
    if (!form.bundleName) { toast.error("请输入套组名称"); return; }
    if (selectedItems.length === 0) { toast.error("请至少选择一个商品"); return; }
    onSubmit({
      ...form,
      price: form.price ? Number(form.price) : undefined,
      marketPrice: form.marketPrice ? Number(form.marketPrice) : undefined,
      stock: Number(form.stock) || 0,
      items: selectedItems,
    });
  };

  const toggleProduct = (productId: number) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.productId === productId);
      if (exists) return prev.filter(i => i.productId !== productId);
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    setSelectedItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bundle ? "编辑套组" : "创建套组"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            <div>
              <Label>套组名称 *</Label>
              <Input value={form.bundleName} onChange={e => setForm({ ...form, bundleName: e.target.value })} placeholder="例: 美容护肤3件套" />
            </div>
            <div>
              <Label>中文名称</Label>
              <Input value={form.bundleNameCn} onChange={e => setForm({ ...form, bundleNameCn: e.target.value })} placeholder="中文别名（可选）" />
            </div>
            <div>
              <Label>套组描述</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="套组说明..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>套组价格 (¥)</Label>
                <Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0" />
              </div>
              <div>
                <Label>市场价 (¥)</Label>
                <Input type="number" value={form.marketPrice} onChange={e => setForm({ ...form, marketPrice: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>库存</Label>
                <Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div>
                <Label>状态</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="online">上架</SelectItem>
                    <SelectItem value="offline">下架</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected Items Summary */}
            {selectedItems.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">已选商品 ({selectedItems.length})</p>
                {selectedItems.map(item => {
                  const product = products.find((p: any) => p.id === item.productId);
                  return (
                    <div key={item.productId} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1.5">
                      <span className="truncate flex-1 mr-2">{product?.productName || `ID:${item.productId}`}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">×</span>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                          className="w-16 h-7 text-center text-xs"
                          min={1}
                        />
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleProduct(item.productId)}>
                          <X className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {form.price && (
                  <div className="text-xs text-muted-foreground pt-1 border-t">
                    单品总价: ¥{selectedItems.reduce((sum, item) => {
                      const product = products.find((p: any) => p.id === item.productId);
                      return sum + (Number(product?.price || 0) * item.quantity);
                    }, 0).toLocaleString()}
                    {" → "}套组价: ¥{Number(form.price).toLocaleString()}
                    {" ("}节省 ¥{(selectedItems.reduce((sum, item) => {
                      const product = products.find((p: any) => p.id === item.productId);
                      return sum + (Number(product?.price || 0) * item.quantity);
                    }, 0) - Number(form.price)).toLocaleString()}{")"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Product Selection */}
          <div className="space-y-3">
            <div>
              <Label>选择商品</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜索商品名/品牌..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="border rounded-lg max-h-[400px] overflow-y-auto">
              {filteredProducts.map((product: any) => {
                const isSelected = selectedItems.some(i => i.productId === product.id);
                const imgs = product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : [];
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-3 p-2.5 border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleProduct(product.id)}
                  >
                    <Checkbox checked={isSelected} />
                    {imgs.length > 0 ? (
                      <img src={imgs[0]} className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.productName}</p>
                      <p className="text-xs text-muted-foreground">{product.brandName} · ¥{Number(product.price || 0).toLocaleString()}</p>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">没有找到商品</div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {bundle ? "保存修改" : "创建套组"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuctionTab() {
  const [expandedAuctionId, setExpandedAuctionId] = useState<number | null>(null);
  const auctionFormRef = useRef<HTMLDivElement>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productId: "", productName: "", startPrice: "", finalPrice: "", liverName: "", auctionDate: new Date().toISOString().split("T")[0], note: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [auctionSearch, setAuctionSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importLiver, setImportLiver] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [filterLiver, setFilterLiver] = useState("");
  const listQuery = trpc.auction.list.useQuery();
  const createMut = trpc.auction.create.useMutation({ onSuccess: () => { listQuery.refetch(); setShowForm(false); resetForm(); } });
  const updateMut = trpc.auction.update.useMutation({ onSuccess: () => { listQuery.refetch(); setEditId(null); resetForm(); } });
  const deleteMut = trpc.auction.delete.useMutation({ onSuccess: () => listQuery.refetch() });

  function resetForm() { setForm({ productId: "", productName: "", startPrice: "", finalPrice: "", liverName: "", auctionDate: new Date().toISOString().split("T")[0], note: "" }); }

  async function handleAuctionImport() {
    if (!importFile) { toast.error("ファイルを選択してください"); return; }
    if (!importLiver.trim()) { toast.error("主播を選択してください"); return; }
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = await importFile.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) { toast.error("データがありません"); setImporting(false); return; }
      // Group by productId (col 0)
      const groups = new Map<string, { name: string, stock: number, salesCount: number, gmv: number, rounds: any[] }>();
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[0]) continue;
        const pid = String(r[0]);
        const pname = String(r[1] || "");
        const salePrice = Number(r[9]) || 0;
        const startPrice = Number(r[8]) || 0;
        if (salePrice === 0 && String(r[5]) === "-") continue; // skip no-sale rows
        if (!groups.has(pid)) {
          groups.set(pid, { name: pname, stock: Number(r[2]) || 0, salesCount: Number(r[3]) || 0, gmv: Number(String(r[4]).replace(/[^0-9.]/g, "")) || 0, rounds: [] });
        }
        const g = groups.get(pid)!;
        g.rounds.push({
          roundNumber: g.rounds.length + 1,
          startPrice, salePrice, bidderCount: Number(r[11]) || 0, winner: String(r[10] || ""),
          skuName: String(r[5] || ""), startTime: String(r[12] || ""), duration: Number(r[13]) || 0
        });
      }
      // Create auction records
      let created = 0;
      for (const [pid, g] of groups) {
        if (g.rounds.length === 0) continue;
        const avgPrice = g.rounds.reduce((s, r) => s + r.salePrice, 0) / g.rounds.length;
        const maxPrice = Math.max(...g.rounds.map(r => r.salePrice));
        const minPrice = Math.min(...g.rounds.map(r => r.salePrice));
        const dateStr = g.rounds[0].startTime ? g.rounds[0].startTime.split(" ")[0] : new Date().toISOString().split("T")[0];
        await createMut.mutateAsync({
          productId: pid, productName: g.name, startPrice: g.rounds[0].startPrice,
          finalPrice: Math.round(avgPrice), totalGmv: g.gmv, totalOrders: g.salesCount,
          auctionCount: g.rounds.length, liverName: importLiver.trim(), auctionDate: dateStr,
          note: "Excelインポート",
          roundsJson: JSON.stringify(g.rounds),
        });
        created++;
      }
      toast.success(created + "件の拍売記録をインポートしました");
      setShowImport(false); setImportFile(null); setImportLiver("");
      listQuery.refetch();
    } catch (e: any) { toast.error("インポートエラー: " + (e.message || "")); }
    setImporting(false);
  }

  const grouped = useMemo(() => {
    if (!listQuery.data) return {};
    const g: Record<string, any[]> = {};
    const searchLower = auctionSearch.toLowerCase();
    const searchPattern = auctionSearch.split("").join(".*");
    // Filter by liver first
    if (filterLiver) {
      filtered = filtered.filter((r: any) => r.liverName === filterLiver);
    }
    const searchRegex = new RegExp(searchPattern, "i");
    listQuery.data.forEach((r: any) => {
      if (auctionSearch) {
        const matchFields = [r.productId, r.productName, r.liverName, r.note, r.chineseName].filter(Boolean).join(" ").toLowerCase();
        if (!matchFields.includes(searchLower) && !searchRegex.test(matchFields)) return;
      }
      const key = r.productId || r.productName || "未分類";
      if (!g[key]) g[key] = [];
      g[key].push(r);
    });
    return g;
  }, [listQuery.data, auctionSearch]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">🔨 拍卖記録</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(!showImport)} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm font-medium">📤 Excel導入</button>
          <button onClick={() => { setShowForm(true); setEditId(null); resetForm(); }} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm font-medium">+ 追加</button>
        </div>
      </div>
      {showImport && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <h4 className="font-bold text-sm text-blue-800">📤 TikTok拍卖データExcel導入</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600 block mb-1">主播を選択 *</label>
              <input className="w-full border rounded px-3 py-2 text-sm" placeholder="主播名を入力..." value={importLiver} onChange={e => setImportLiver(e.target.value)} list="liver-list-import" />
              <datalist id="liver-list-import">
                {(listQuery.data || []).map((r: any) => r.liverName).filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i).map((name: string) => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Excelファイル (.xlsx) *</label>
              <input type="file" accept=".xlsx,.xls,.csv" className="w-full border rounded px-3 py-1.5 text-sm bg-white" onChange={e => setImportFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAuctionImport} disabled={importing || !importFile || !importLiver.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{importing ? "導入中..." : "導入実行"}</button>
              <button onClick={() => { setShowImport(false); setImportFile(null); setImportLiver(""); }} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">キャンセル</button>
            </div>
          </div>
          <p className="text-xs text-gray-500">TikTok Shop拍卖データExcelをアップロードすると、商品ごとにグループ化して拍卖記録を自動作成します。</p>
        </div>
      )}
      <div className="relative">
        <input className="w-full border rounded-lg px-4 py-2.5 pl-10 text-sm" placeholder="商品名・商品ID・主播名・中文名で検索..." value={auctionSearch} onChange={e => setAuctionSearch(e.target.value)} />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        {auctionSearch && <button onClick={() => setAuctionSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>}
      </div>
      {/* Liver filter buttons */}
      {(() => {
        const liverNames = (listQuery.data || []).map((r: any) => r.liverName).filter((v: string) => v && v !== "-");
        const unique = [...new Set(liverNames)] as string[];
        const counts = new Map<string, number>();
        liverNames.forEach((n: string) => counts.set(n, (counts.get(n) || 0) + 1));
        if (unique.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setFilterLiver("")} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${!filterLiver ? "bg-orange-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              全部 ({(listQuery.data || []).length})
            </button>
            {unique.sort().map(name => (
              <button key={name} onClick={() => setFilterLiver(filterLiver === name ? "" : name)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterLiver === name ? "bg-blue-500 text-white shadow" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {name} ({counts.get(name) || 0})
              </button>
            ))}
          </div>
        );
      })()}

      {showForm && (
        <div ref={auctionFormRef} className={`${editId ? "fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" : ""}`}>
        <div className={`bg-white border rounded-lg p-4 space-y-3 ${editId ? "max-w-2xl w-full shadow-xl" : ""}`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500">TikTok商品ID</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.productId} onChange={e => setForm({...form, productId: e.target.value})} placeholder="商品ID" />
            </div>
            <div>
              <label className="text-xs text-gray-500">商品名</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.productName} onChange={e => setForm({...form, productName: e.target.value})} placeholder="商品名" />
            </div>
            <div>
              <label className="text-xs text-gray-500">起拍価 (¥)</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" type="number" value={form.startPrice} onChange={e => setForm({...form, startPrice: e.target.value})} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500">最終成交価 (¥)</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" type="number" value={form.finalPrice} onChange={e => setForm({...form, finalPrice: e.target.value})} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500">主播</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.liverName} onChange={e => setForm({...form, liverName: e.target.value})} placeholder="誰が播いた" />
            </div>
            <div>
              <label className="text-xs text-gray-500">日付</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" type="date" value={form.auctionDate} onChange={e => setForm({...form, auctionDate: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500">備考</label>
              <input className="w-full border rounded px-2 py-1.5 text-sm" value={form.note} onChange={e => setForm({...form, note: e.target.value})} placeholder="メモ..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              if (editId) {
                updateMut.mutate({ id: editId, ...form, startPrice: form.startPrice ? Number(form.startPrice) : undefined, finalPrice: form.finalPrice ? Number(form.finalPrice) : undefined });
              } else {
                createMut.mutate({ ...form, startPrice: form.startPrice ? Number(form.startPrice) : undefined, finalPrice: form.finalPrice ? Number(form.finalPrice) : undefined });
              }
            }} className="bg-blue-500 text-white px-4 py-1.5 rounded text-sm">{editId ? "更新" : "保存"}</button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="bg-gray-200 px-4 py-1.5 rounded text-sm">キャンセル</button>
          </div>
        </div>
        </div>
      )}

      {listQuery.isLoading && <p className="text-gray-500 text-center py-8">読み込み中...</p>}

      {!listQuery.isLoading && Object.keys(grouped).length === 0 && (
        <p className="text-gray-400 text-center py-12">拍卖記録がありません</p>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([key, records]) => (
          <div key={key} className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
              <span className="font-medium text-sm">{records[0]?.productName || key}</span>
              <span className="text-xs text-gray-500">ID: {records[0]?.productId || "-"} | {records.length}回拍卖</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">日付</th>
                  <th className="px-3 py-2 text-left">主播</th>
                  <th className="px-3 py-2 text-right">起拍価</th>
                  <th className="px-3 py-2 text-right">平均価格</th>
                  <th className="px-3 py-2 text-right text-green-600">最高価</th>
                  <th className="px-3 py-2 text-right text-blue-600">最低価</th>
                  <th className="px-3 py-2 text-center">詳細</th>
                  <th className="px-3 py-2 text-left">備考</th>
                  <th className="px-3 py-2 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => (<React.Fragment key={r.id}>
                  <tr className="border-t hover:bg-gray-50">
                    <td className="px-3 py-2">{r.auctionDate ? new Date(r.auctionDate).toLocaleDateString() : "-"}</td>
                    <td className="px-3 py-2">{r.liverName || "-"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">¥{r.startPrice?.toLocaleString() || "-"}</td>
                    <td className="px-3 py-2 text-right font-bold text-red-600">{(() => { try { const rounds = JSON.parse(r.roundsJson || "[]"); if (rounds.length) { const prices = rounds.map((rd: any) => rd.finalPrice || rd.salesPrice || rd.salePrice || 0).filter((p: number) => p > 0); if (prices.length) return "¥" + Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toLocaleString(); } return r.finalPrice ? "¥" + r.finalPrice.toLocaleString() : "-"; } catch { return r.finalPrice ? "¥" + r.finalPrice.toLocaleString() : "-"; } })()}</td>
                    <td className="px-3 py-2 text-right text-green-600 text-xs font-bold">{(() => { try { const rounds = JSON.parse(r.roundsJson || "[]"); if (!rounds.length) return "-"; return "¥" + Math.max(...rounds.map((rd: any) => rd.finalPrice || rd.salesPrice || rd.salePrice || 0)).toLocaleString(); } catch { return "-"; } })()}</td>
                    <td className="px-3 py-2 text-right text-blue-600 text-xs font-bold">{(() => { try { const rounds = JSON.parse(r.roundsJson || "[]"); if (!rounds.length) return "-"; const prices = rounds.map((rd: any) => rd.finalPrice || rd.salesPrice || rd.salePrice || 0).filter((p: number) => p > 0); return prices.length ? "¥" + Math.min(...prices).toLocaleString() : "-"; } catch { return "-"; } })()}</td>
                    <td className="px-3 py-2 text-center">{r.roundsJson && JSON.parse(r.roundsJson || "[]").length > 0 ? <button onClick={() => setExpandedAuctionId(expandedAuctionId === r.id ? null : r.id)} className="text-purple-500 text-xs underline">{expandedAuctionId === r.id ? "閉じる" : `${JSON.parse(r.roundsJson).length}回`}</button> : <span className="text-gray-400 text-xs">-</span>}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.note || "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => { setEditId(r.id); setForm({ productId: r.productId || "", productName: r.productName || "", startPrice: r.startPrice?.toString() || "", finalPrice: r.finalPrice?.toString() || "", liverName: r.liverName || "", auctionDate: r.auctionDate?.split("T")[0] || "", note: r.note || "" }); setShowForm(true);  }} className="text-blue-500 text-xs mr-2">編集</button>
                      <button onClick={() => { if(confirm("削除しますか？")) deleteMut.mutate({ id: r.id }); }} className="text-red-500 text-xs">削除</button>
                    </td>
                  </tr>
                  {expandedAuctionId === r.id && r.roundsJson && (() => { try { const rounds = JSON.parse(r.roundsJson); if (!rounds.length) return null; return (<tr><td colSpan={8} className="p-0"><div className="bg-purple-50 border-t border-purple-200 p-3"><table className="w-full text-xs"><thead className="text-purple-600"><tr><th className="px-2 py-1 text-left">発品編号</th><th className="px-2 py-1 text-right">起拍価</th><th className="px-2 py-1 text-right">販売価</th><th className="px-2 py-1 text-center">竞拍人数</th><th className="px-2 py-1 text-left">获胜者</th></tr></thead><tbody>{rounds.map((rd: any, i: number) => (<tr key={i} className="border-t border-purple-100"><td className="px-2 py-1">#{rd.roundNumber || i+1}</td><td className="px-2 py-1 text-right">¥{(rd.startPrice || 0).toLocaleString()}</td><td className="px-2 py-1 text-right font-bold text-red-600">¥{(rd.finalPrice || rd.salesPrice || rd.salePrice || 0).toLocaleString()}</td><td className="px-2 py-1 text-center text-orange-500">{rd.bidders || rd.bidderCount || "-"}</td><td className="px-2 py-1">{rd.winner || "-"}</td></tr>))}</tbody></table></div></td></tr>); } catch { return null; } })()}
                </React.Fragment>))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
