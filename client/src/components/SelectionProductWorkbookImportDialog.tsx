import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { arrayBufferToBase64 } from "@/lib/auctionExcelImport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PAGE_SIZE = 50;

type WorkbookPreview = {
  fileSha256: string;
  sheetName: string;
  sourceRowCount: number;
  warnings: string[];
  capabilities: { hasBrand: boolean; hasSku: boolean; hasBarcode: boolean; hasStock: boolean };
  rows: Array<{
    rowKey: string;
    sourceRow: number;
    sourceRows: number[];
    productName: string;
    productId: string | null;
    brandName: string | null;
    imageUrl: string | null;
    sourceCategory: string | null;
    categoryName: string | null;
    price: string | null;
    priceRaw: string | null;
    priceIsRange: boolean;
    commissionValue: string | null;
    sales: number | null;
    gmv: string | null;
    rating: string | null;
    skuVariants: Array<{ name: string; skuCode?: string }>;
    warnings: string[];
    invalidReasons: string[];
    existingProduct: { id: number; productName: string; match: "productId" | "nameBrand" } | null;
    possibleNameMatchCount: number;
  }>;
};

export default function SelectionProductWorkbookImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [base64Data, setBase64Data] = useState("");
  const [preview, setPreview] = useState<WorkbookPreview | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [rowBrands, setRowBrands] = useState<Record<string, string>>({});
  const [defaultBrand, setDefaultBrand] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const previewMutation = trpc.selectionCenter.previewProductWorkbook.useMutation();
  const commitMutation = trpc.selectionCenter.commitProductWorkbook.useMutation();

  const reset = () => {
    setFileName("");
    setBase64Data("");
    setPreview(null);
    setSelectedKeys(new Set());
    setRowBrands({});
    setDefaultBrand("");
    setSearch("");
    setPage(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen && (previewMutation.isPending || commitMutation.isPending)) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleFile = async (file: File) => {
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      toast.error("文件必须为10MB以下 / ファイルは10MB以下にしてください");
      return;
    }
    const extension = file.name.toLocaleLowerCase("en-US").split(".").pop();
    if (extension !== "xlsx" && extension !== "xls" && extension !== "csv") {
      toast.error("仅支持CSV、XLSX或XLS / CSV・XLSX・XLSのみ対応しています");
      return;
    }
    try {
      const data = arrayBufferToBase64(await file.arrayBuffer());
      const result = await previewMutation.mutateAsync({ fileName: file.name, base64Data: data }) as WorkbookPreview;
      const nextSelected = new Set<string>();
      const nextBrands: Record<string, string> = {};
      for (const row of result.rows) {
        if (row.brandName) nextBrands[row.rowKey] = row.brandName;
        if (!row.existingProduct && row.invalidReasons.length === 0) nextSelected.add(row.rowKey);
      }
      setFileName(file.name);
      setBase64Data(data);
      setPreview(result);
      setSelectedKeys(nextSelected);
      setRowBrands(nextBrands);
      setSearch("");
      setPage(1);
      toast.success(`${result.rows.length}件の商品候補を認識しました`);
    } catch (error: any) {
      toast.error(error?.message || "表格识别失败 / 表の認識に失敗しました");
    }
  };

  const eligibleRows = useMemo(
    () => preview?.rows.filter((row) => !row.existingProduct && row.invalidReasons.length === 0) || [],
    [preview],
  );
  const filteredRows = useMemo(() => {
    if (!preview) return [];
    const needle = search.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
    if (!needle) return preview.rows;
    return preview.rows.filter((row) => [row.productName, row.productId, row.brandName, row.sourceCategory]
      .filter(Boolean)
      .some((value) => String(value).normalize("NFKC").toLocaleLowerCase("ja-JP").includes(needle)));
  }, [preview, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedRows = eligibleRows.filter((row) => selectedKeys.has(row.rowKey));
  const missingBrandCount = selectedRows.filter((row) => !String(rowBrands[row.rowKey] || row.brandName || "").trim()).length;
  const existingCount = preview?.rows.filter((row) => !!row.existingProduct).length || 0;
  const invalidCount = preview?.rows.filter((row) => row.invalidReasons.length > 0).length || 0;

  const toggleRow = (rowKey: string, checked: boolean) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(rowKey); else next.delete(rowKey);
      return next;
    });
  };

  const applyBrand = () => {
    const brand = defaultBrand.trim();
    if (!brand) {
      toast.error("请输入品牌 / ブランドを入力してください");
      return;
    }
    setRowBrands((current) => {
      const next = { ...current };
      for (const row of selectedRows) next[row.rowKey] = brand;
      return next;
    });
    toast.success(`已为${selectedRows.length}件选中商品设置品牌 / ブランドを設定しました`);
  };

  const commit = async () => {
    if (!preview || !base64Data || selectedRows.length === 0 || missingBrandCount > 0) return;
    try {
      const result = await commitMutation.mutateAsync({
        fileName,
        base64Data,
        fileSha256: preview.fileSha256,
        selections: selectedRows.map((row) => ({
          rowKey: row.rowKey,
          brandName: String(rowBrands[row.rowKey] || row.brandName || "").trim(),
        })),
      });
      await onImported();
      toast.success(`${result.insertedCount}件の商品を草稿として登録しました${result.skippedDuplicates.length ? `（重複${result.skippedDuplicates.length}件は除外）` : ""}`);
      changeOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "导入失败 / 取込に失敗しました");
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="w-[96vw] max-w-[1320px] min-w-0 max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-violet-600" />
            商品表格智能识别 / 商品表のスマート認識
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto space-y-4 pr-1">
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
            <p className="font-medium">确定性表头识别，不调用付费AI / 表ヘッダーを自動対応・有料AI不使用</p>
            <p className="mt-1 text-xs text-violet-800">先预览、补齐品牌并选择商品，确认后才保存。不会覆盖现有商品，不会从名称猜测品牌、SKU或库存。</p>
          </div>

          {!preview ? (
            <div className="rounded-xl border-2 border-dashed p-10 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">选择Kalodata或其他商品表 / 商品ファイルを選択</p>
              <p className="mt-1 text-xs text-muted-foreground">CSV・XLSX・XLS、10MB以下、最大2000行</p>
              <Button className="mt-4" onClick={() => fileInputRef.current?.click()} disabled={previewMutation.isPending}>
                {previewMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />识别中...</> : "选择表格 / ファイルを選択"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">{fileName}</Badge>
                <Badge variant="secondary">{preview.sheetName}</Badge>
                <Badge>{preview.rows.length}件候補</Badge>
                <Badge variant="outline">原始{preview.sourceRowCount}行</Badge>
                {existingCount > 0 && <Badge variant="outline" className="border-amber-300 text-amber-700">重複{existingCount}件</Badge>}
                {invalidCount > 0 && <Badge variant="destructive">無効{invalidCount}件</Badge>}
                <Button variant="outline" size="sm" onClick={() => { reset(); setTimeout(() => fileInputRef.current?.click(), 0); }}>重新选择 / 選び直す</Button>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <div className="space-y-1">
                    {preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[240px] flex-1">
                    <Label>选中商品的统一品牌 / 選択商品の共通ブランド</Label>
                    <Input value={defaultBrand} onChange={(event) => setDefaultBrand(event.target.value)} placeholder="例：KYOGOKU JAPAN" maxLength={255} />
                  </div>
                  <Button variant="outline" onClick={applyBrand} disabled={!selectedRows.length}>应用到已选{selectedRows.length}件 / 適用</Button>
                  <Button variant="outline" onClick={() => setSelectedKeys(new Set(eligibleRows.map((row) => row.rowKey)))}>全选可导入</Button>
                  <Button variant="ghost" onClick={() => setSelectedKeys(new Set())}>全部取消</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary">已选{selectedRows.length}件</Badge>
                  {missingBrandCount > 0 ? <Badge variant="destructive">{missingBrandCount}件缺少品牌</Badge> : selectedRows.length > 0 ? <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />品牌已补齐</Badge> : null}
                  {!preview.capabilities.hasSku && <span className="text-muted-foreground">源文件无SKU，不会生成SKU</span>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="pl-9" placeholder="搜索商品名、商品ID、品牌、类目..." />
                </div>
                <span className="text-xs text-muted-foreground">{filteredRows.length}件</span>
              </div>

              <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[1180px] text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-center">选择</th>
                      <th className="p-2 text-left">行</th>
                      <th className="p-2 text-left">商品</th>
                      <th className="p-2 text-left">商品ID</th>
                      <th className="p-2 text-left min-w-[190px]">品牌</th>
                      <th className="p-2 text-left">类目</th>
                      <th className="p-2 text-right">价格</th>
                      <th className="p-2 text-right">佣金</th>
                      <th className="p-2 text-right">销量 / GMV</th>
                      <th className="p-2 text-left">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const disabled = !!row.existingProduct || row.invalidReasons.length > 0;
                      const selected = selectedKeys.has(row.rowKey);
                      return (
                        <tr key={row.rowKey} className={`border-t align-top ${disabled ? "bg-muted/30 text-muted-foreground" : ""}`}>
                          <td className="p-2 text-center"><Checkbox checked={selected} disabled={disabled} onCheckedChange={(checked) => toggleRow(row.rowKey, checked === true)} /></td>
                          <td className="p-2 font-mono">{row.sourceRows.join(",")}</td>
                          <td className="p-2 max-w-[310px]">
                            <div className="flex gap-2">
                              {row.imageUrl ? <img src={row.imageUrl} alt="" className="h-10 w-10 rounded border object-cover" loading="lazy" /> : <div className="h-10 w-10 rounded bg-muted" />}
                              <div><p className="font-medium line-clamp-2">{row.productName || "-"}</p>{row.skuVariants.length > 0 && <p className="mt-1 text-[10px] text-blue-600">SKU {row.skuVariants.length}件</p>}</div>
                            </div>
                          </td>
                          <td className="p-2 font-mono break-all">{row.productId || "-"}</td>
                          <td className="p-2">
                            <Input value={rowBrands[row.rowKey] ?? row.brandName ?? ""} onChange={(event) => setRowBrands((current) => ({ ...current, [row.rowKey]: event.target.value }))} disabled={disabled} className="h-8 text-xs" maxLength={255} placeholder="必填 / 必須" />
                            {row.possibleNameMatchCount > 0 && !row.existingProduct && <p className="mt-1 text-[10px] text-amber-700">同名候補{row.possibleNameMatchCount}件。ブランド確認</p>}
                          </td>
                          <td className="p-2 max-w-[170px]"><p className="line-clamp-2">{row.categoryName || row.sourceCategory || "-"}</p>{row.sourceCategory && !row.categoryName && <p className="text-[10px] text-amber-700">分类未匹配</p>}</td>
                          <td className="p-2 text-right whitespace-nowrap">{row.price ? `¥${Number(row.price).toLocaleString()}` : row.priceIsRange ? <span className="text-amber-700">{row.priceRaw}<br />不导入</span> : "-"}</td>
                          <td className="p-2 text-right">{row.commissionValue ? `${row.commissionValue}%` : "-"}</td>
                          <td className="p-2 text-right whitespace-nowrap">{row.sales !== null ? `${row.sales.toLocaleString()}件` : "-"}<br />{row.gmv ? `¥${Number(row.gmv).toLocaleString()}` : "-"}</td>
                          <td className="p-2 min-w-[180px]">
                            {row.existingProduct ? <Badge variant="outline" className="border-amber-300 text-amber-700">已存在 ID:{row.existingProduct.id}</Badge> : row.invalidReasons.length > 0 ? <Badge variant="destructive">不可导入</Badge> : <Badge variant="secondary">草稿导入</Badge>}
                            {[...row.invalidReasons, ...row.warnings].slice(0, 2).map((message) => <p key={message} className="mt-1 text-[10px] leading-tight">{message}</p>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-xs">{page} / {pageCount}</span>
                <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.target.value = ""; }} />

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => changeOpen(false)} disabled={previewMutation.isPending || commitMutation.isPending}>取消 / キャンセル</Button>
          {preview && <Button onClick={() => void commit()} disabled={commitMutation.isPending || selectedRows.length === 0 || missingBrandCount > 0}>
            {commitMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</> : `确认导入${selectedRows.length}件 / ${selectedRows.length}件を登録`}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
