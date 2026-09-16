import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileText, Loader2, Printer, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type PdfVariant = "normal" | "mirror";
type UploadedPdf = {
  storageKey: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  pageCount: number | null;
  isA4: boolean | null;
  uploadedAt: string;
  uploadedByName: string | null;
  url: string;
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function PdfUploadPanel({
  variant,
  pdf,
  uploading,
  onSelect,
  onRemove,
}: {
  variant: PdfVariant;
  pdf: UploadedPdf | null;
  uploading: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = variant === "normal" ? "普通版" : "ミラー版";
  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">{label}PDF</h3>
          <p className="mt-1 text-xs text-gray-500">A4・PDF・20MB以内</p>
        </div>
        {pdf ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />登録済み</span> : <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">未登録</span>}
      </div>

      {pdf ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            <div className="break-all font-semibold text-gray-900">{pdf.fileName}</div>
            <div className="mt-1">{formatBytes(pdf.fileSize)} ・ {pdf.pageCount ? `${pdf.pageCount}ページ` : "ページ数未確認"}</div>
            <div className="mt-1">{pdf.isA4 === true ? "A4確認済み" : pdf.isA4 === false ? "A4以外の可能性があります" : "A4サイズを自動判定できませんでした"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}差し替え
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRemove} disabled={uploading}><Trash2 className="mr-1 h-4 w-4 text-red-600" />削除</Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-4 flex min-h-[112px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/50 px-4 text-center hover:bg-cyan-50 disabled:opacity-60">
          {uploading ? <Loader2 className="h-7 w-7 animate-spin text-cyan-700" /> : <Upload className="h-7 w-7 text-cyan-700" />}
          <span className="mt-2 text-sm font-bold text-cyan-900">{uploading ? "アップロード中" : `${label}PDFを選択`}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onSelect(file);
        }}
      />
    </section>
  );
}

export function StoreProductHandcardDialog({ productId, onClose }: { productId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const query = trpc.storeProducts.handcard.useQuery({ productId });
  const [variant, setVariant] = useState<PdfVariant>("normal");
  const [uploading, setUploading] = useState<PdfVariant | null>(null);
  const removeMutation = trpc.storeProducts.removeHandcardPdf.useMutation({
    onSuccess: async () => {
      await utils.storeProducts.handcard.invalidate({ productId });
      await query.refetch();
      toast.success("A4手カードPDFを削除しました");
    },
    onError: (error) => toast.error(error.message),
  });

  const uploadPdf = async (selectedVariant: PdfVariant, file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("PDFファイルだけアップロードできます");
      return;
    }
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
      toast.error("PDFは20MB以内にしてください");
      return;
    }
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (new TextDecoder("ascii").decode(signature) !== "%PDF-") {
      toast.error("ファイル内容がPDFではありません");
      return;
    }
    setUploading(selectedVariant);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", String(productId));
      formData.append("variant", selectedVariant);
      const response = await fetch("/api/store-product-handcard-pdf-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "PDFアップロードに失敗しました");
      setVariant(selectedVariant);
      await utils.storeProducts.handcard.invalidate({ productId });
      await query.refetch();
      toast.success(`${selectedVariant === "normal" ? "普通版" : "ミラー版"}PDFを登録しました`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDFアップロードに失敗しました");
    } finally {
      setUploading(null);
    }
  };

  if (query.isLoading) {
    return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"><div className="rounded-xl bg-white p-8"><Loader2 className="h-7 w-7 animate-spin text-cyan-600" /></div></div>;
  }
  if (query.error || !query.data) {
    return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6"><div className="max-w-lg rounded-xl bg-white p-6"><p className="font-bold text-red-700">商品手カードを読み込めません</p><p className="mt-2 text-sm text-gray-600">{query.error?.message || "商品データがありません"}</p><Button className="mt-4" onClick={onClose}>閉じる</Button></div></div>;
  }

  const product: any = query.data.product;
  const handcard: any = query.data.handcard;
  const normalPdf = (handcard.normalPdf || null) as UploadedPdf | null;
  const mirrorPdf = (handcard.mirrorPdf || null) as UploadedPdf | null;
  const activePdf = variant === "normal" ? normalPdf : mirrorPdf;
  const anyPdf = Boolean(normalPdf || mirrorPdf);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#eef3f4]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3 shadow-sm">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><FileText className="h-5 w-5 text-cyan-700" />A4商品手カードPDF</h2>
          <p className="truncate text-xs text-gray-500">{product.productName} ・ 普通版とミラー版を商品ごとに登録</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activePdf && <>
            <Button type="button" variant="outline" onClick={() => window.open(activePdf.url, "_blank", "noopener,noreferrer")}><Printer className="mr-1 h-4 w-4" />開く・印刷</Button>
            <Button type="button" variant="outline" asChild><a href={activePdf.url} target="_blank" rel="noreferrer" download={activePdf.fileName}><Download className="mr-1 h-4 w-4" />ダウンロード</a></Button>
          </>}
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="閉じる"><X className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-b bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-cyan-950">
            <p className="font-bold">完成済みPDFをそのまま登録</p>
            <p className="mt-1 text-xs leading-5">内容を入力し直す必要はありません。普通版とミラー版を別々にアップロードすると、そのままプレビュー・印刷・ダウンロードできます。</p>
          </div>
          {!anyPdf && <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="font-bold">PDF未登録</div><p className="mt-1 text-xs">普通版またはミラー版のPDFをアップロードしてください。</p></div></div>}
          <div className="mt-4 space-y-4">
            <PdfUploadPanel variant="normal" pdf={normalPdf} uploading={uploading === "normal"} onSelect={(file) => uploadPdf("normal", file)} onRemove={() => {
              if (window.confirm("普通版PDFを削除しますか？")) removeMutation.mutate({ productId, variant: "normal" });
            }} />
            <PdfUploadPanel variant="mirror" pdf={mirrorPdf} uploading={uploading === "mirror"} onSelect={(file) => uploadPdf("mirror", file)} onRemove={() => {
              if (window.confirm("ミラー版PDFを削除しますか？")) removeMutation.mutate({ productId, variant: "mirror" });
            }} />
          </div>
          <p className="mt-4 text-[11px] leading-5 text-gray-500">PDFの原内容は変更しません。差し替え・削除は明示操作時だけ行われ、商品・SKU・在庫・推广数据には影響しません。</p>
        </aside>

        <main className="flex min-h-0 flex-col overflow-hidden p-4">
          <div className="mb-3 flex shrink-0 items-center gap-2">
            <Button type="button" variant={variant === "normal" ? "default" : "outline"} onClick={() => setVariant("normal")} className={variant === "normal" ? "bg-cyan-700 hover:bg-cyan-800" : ""}>普通版</Button>
            <Button type="button" variant={variant === "mirror" ? "default" : "outline"} onClick={() => setVariant("mirror")} className={variant === "mirror" ? "bg-cyan-700 hover:bg-cyan-800" : ""}>ミラー版</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-white shadow-sm">
            {activePdf ? (
              <iframe title={`${variant === "normal" ? "普通版" : "ミラー版"}A4商品手カード`} src={`${activePdf.url}#view=FitH`} className="h-full min-h-[720px] w-full" />
            ) : (
              <div className="flex h-full min-h-[620px] flex-col items-center justify-center p-8 text-center text-gray-500">
                <FileText className="h-16 w-16 text-gray-300" />
                <p className="mt-4 font-bold text-gray-700">{variant === "normal" ? "普通版" : "ミラー版"}PDFは未登録です</p>
                <p className="mt-2 text-sm">左側からPDFをアップロードしてください。</p>
              </div>
            )}
          </div>
          {activePdf && <div className="mt-2 flex shrink-0 items-center gap-2 text-xs text-gray-500"><ExternalLink className="h-3.5 w-3.5" />ブラウザ内で表示できない場合は「開く・印刷」を使用してください。</div>}
        </main>
      </div>
    </div>
  );
}
