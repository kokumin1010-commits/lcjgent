import { useState, useEffect, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { generateBulkInvoicePdf, convertOrderToInvoiceData, type DocumentType } from "@/lib/invoicePdf";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Printer, ArrowLeft, FileText } from "lucide-react";
import { useSearch } from "wouter";

export default function BulkInvoicePrint() {
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);

  const orderIds = useMemo(() => {
    const idsStr = params.get("ids") || "";
    return idsStr
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }, [params]);

  const initialType = (params.get("type") as DocumentType) || "delivery";
  const [docType, setDocType] = useState<DocumentType>(initialType);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 各注文の詳細を取得
  const orderQueries = orderIds.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    trpc.mall.getOrderById.useQuery({ id }, { enabled: id > 0 })
  );

  const allLoaded = orderQueries.every((q) => !q.isLoading);
  const allData = orderQueries
    .map((q) => q.data)
    .filter((d): d is NonNullable<typeof d> => !!d);

  // PDF生成
  const generatePdf = useCallback(() => {
    if (allData.length === 0) return;
    setIsGenerating(true);
    try {
      const allInvoices = allData.map((d) => convertOrderToInvoiceData(d as any));
      const doc = generateBulkInvoicePdf(docType, allInvoices);
      const blobUrl = doc.output("bloburl");
      setPdfUrl(typeof blobUrl === "string" ? blobUrl : blobUrl.toString());
    } catch (err) {
      console.error("PDF生成エラー:", err);
      setPdfUrl(null);
    } finally {
      setIsGenerating(false);
    }
  }, [allData, docType]);

  // allDataが揃ったらPDF生成
  const [hasGenerated, setHasGenerated] = useState(false);
  useEffect(() => {
    if (allLoaded && allData.length > 0 && !hasGenerated) {
      generatePdf();
      setHasGenerated(true);
    }
  }, [allLoaded, allData.length, hasGenerated, generatePdf]);

  // docType変更時に再生成
  useEffect(() => {
    if (allLoaded && allData.length > 0) {
      generatePdf();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docType]);

  if (orderIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">注文が選択されていません</p>
        <Button variant="outline" onClick={() => window.close()}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ツールバー（印刷時は非表示） */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => window.close()}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              閉じる
            </Button>
            <span className="text-sm text-muted-foreground">
              {allData.length}件の注文
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">納品書</SelectItem>
                <SelectItem value="invoice">請求書</SelectItem>
                <SelectItem value="receipt">領収書</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => window.print()}
              disabled={!pdfUrl}
            >
              <Printer className="h-4 w-4 mr-1" />
              プリント
            </Button>
          </div>
        </div>
      </div>

      {/* コンテンツ */}
      {!allLoaded || isGenerating ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-muted-foreground">
            {!allLoaded ? "注文データを読み込み中..." : "PDF を生成中..."}
          </p>
        </div>
      ) : pdfUrl ? (
        <div className="print:m-0 print:p-0">
          <iframe
            src={pdfUrl}
            className="w-full border-0"
            style={{ height: "calc(100vh - 60px)" }}
            title="印刷プレビュー"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground">PDF の生成に失敗しました</p>
        </div>
      )}
    </div>
  );
}
