import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, FlipHorizontal2, Image as ImageIcon, Loader2, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EMPTY_STORE_PRODUCT_HANDCARD,
  getStoreProductHandcardMissingFields,
  type StoreProductHandcardContent,
} from "@shared/storeProductHandcard";

type IngredientRow = StoreProductHandcardContent["ingredients"][number];
type FaqRow = StoreProductHandcardContent["faqs"][number];
type EvidenceRow = StoreProductHandcardContent["evidenceItems"][number];

function createDraft(value?: Partial<StoreProductHandcardContent>): StoreProductHandcardContent {
  return {
    ...EMPTY_STORE_PRODUCT_HANDCARD,
    ...value,
    sellingPoints: [...(value?.sellingPoints || [])],
    ingredients: (value?.ingredients || []).map((item) => ({ ...item })),
    faqs: (value?.faqs || []).map((item) => ({ ...item })),
    evidenceItems: (value?.evidenceItems || []).map((item) => ({ ...item })),
  };
}

function formatPrice(value: unknown, currency = "JPY"): string {
  if (value === null || value === undefined || value === "") return "未登録";
  const number = Number(value);
  if (!Number.isFinite(number)) return "未登録";
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency, maximumFractionDigits: 0 }).format(number);
}

function splitLines(value: string, limit: number): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, limit);
}

function EmptyField({ children = "未登録／内容を補足してください" }: { children?: string }) {
  return <span className="text-sm font-medium text-amber-700">{children}</span>;
}

function HandcardPage({ children, mirrored, className = "" }: { children: React.ReactNode; mirrored: boolean; className?: string }) {
  return (
    <section className={`store-handcard-page relative min-h-[297mm] w-[210mm] overflow-hidden bg-white text-[#083746] [print-color-adjust:exact] ${className}`}>
      <div className={mirrored ? "min-h-[297mm] [transform:scaleX(-1)]" : "min-h-[297mm]"}>{children}</div>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#53b8c7]">{children}</div>;
}

export function StoreProductHandcardDialog({ productId, onClose }: { productId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const query = trpc.storeProducts.handcard.useQuery({ productId });
  const [form, setForm] = useState<StoreProductHandcardContent>(() => createDraft());
  const [mirrored, setMirrored] = useState(false);
  const saveMutation = trpc.storeProducts.saveHandcard.useMutation({
    onSuccess: async (result) => {
      await utils.storeProducts.handcard.invalidate({ productId });
      toast.success(`A4商品手カードを保存しました（第${result.revision}版）`);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!query.data?.handcard) return;
    setForm(createDraft(query.data.handcard));
  }, [query.data?.handcard]);

  const data = query.data;
  const product: any = data?.product || {};
  const images: any[] = data?.images || [];
  const skus: any[] = data?.skus || [];
  const primaryImage = images.find((image) => image.isPrimary)?.imageUrl || product.mainImageUrl || images[0]?.imageUrl || "";
  const imageById = useMemo(() => new Map(images.map((image) => [Number(image.id), image])), [images]);
  const missing = data ? getStoreProductHandcardMissingFields({ product, handcard: form, imageCount: images.length }) : [];
  const productCode = product.spuCode || product.platformProductId || `#${productId}`;

  const save = () => {
    if (form.ingredients.some((item) => !item.name.trim())) {
      toast.error("成分／特徴名が空欄の行があります");
      return;
    }
    if (form.faqs.some((item) => !item.question.trim())) {
      toast.error("質問が空欄のFAQがあります");
      return;
    }
    if (form.evidenceItems.some((item) => !item.title.trim())) {
      toast.error("資料名が空欄の根拠資料があります");
      return;
    }
    saveMutation.mutate({ productId, ...form });
  };
  const print = () => {
    window.requestAnimationFrame(() => window.print());
  };

  const updateIngredient = (index: number, patch: Partial<IngredientRow>) => setForm((current) => ({
    ...current,
    ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));
  const updateFaq = (index: number, patch: Partial<FaqRow>) => setForm((current) => ({
    ...current,
    faqs: current.faqs.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));
  const updateEvidence = (index: number, patch: Partial<EvidenceRow>) => setForm((current) => ({
    ...current,
    evidenceItems: current.evidenceItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));

  if (query.isLoading) {
    return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60"><div className="rounded-xl bg-white p-8"><Loader2 className="h-7 w-7 animate-spin text-cyan-600" /></div></div>;
  }
  if (query.error || !data) {
    return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6"><div className="max-w-lg rounded-xl bg-white p-6"><p className="font-bold text-red-700">商品手カードを読み込めません</p><p className="mt-2 text-sm text-gray-600">{query.error?.message || "商品データがありません"}</p><Button className="mt-4" onClick={onClose}>閉じる</Button></div></div>;
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#eef3f4]">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body * { visibility: hidden !important; }
          #store-product-handcard-print-root, #store-product-handcard-print-root * { visibility: visible !important; }
          #store-product-handcard-print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 210mm !important; }
          .store-handcard-page { width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; break-after: page; page-break-after: always; }
          .store-handcard-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>
      <header className="store-handcard-controls flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-white px-5 py-3 shadow-sm">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><FileText className="h-5 w-5 text-cyan-700" />A4商品手カード</h2>
          <p className="truncate text-xs text-gray-500">{product.productName} · 普通版／ミラー版は同じ保存内容を使用</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant={mirrored ? "default" : "outline"} onClick={() => setMirrored((value) => !value)} className={mirrored ? "bg-cyan-700 hover:bg-cyan-800" : ""}><FlipHorizontal2 className="mr-1 h-4 w-4" />{mirrored ? "ミラー版" : "通常版"}</Button>
          <Button type="button" variant="outline" onClick={print}><Printer className="mr-1 h-4 w-4" />印刷／PDF保存</Button>
          <Button type="button" onClick={save} disabled={saveMutation.isPending} className="bg-cyan-700 hover:bg-cyan-800">{saveMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}保存</Button>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="閉じる"><X className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="store-handcard-controls max-h-[38vh] overflow-y-auto border-b bg-white p-4 lg:max-h-none lg:border-b-0 lg:border-r">
          {missing.length > 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />不足資料 {missing.length}件</div><p className="mt-1">{missing.join("、")}。未登録項目は印刷上でも明示され、内容は自動生成されません。</p></div>}
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="font-bold text-gray-900">基本説明</h3>
              <label className="block text-xs font-medium text-gray-600">シリーズ／セクション名<Input value={form.seriesLabel} onChange={(event) => setForm({ ...form, seriesLabel: event.target.value })} placeholder="例：DERMA PROGRAM No.1" className="mt-1" /></label>
              <label className="block text-xs font-medium text-gray-600">副タイトル・容量<Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} placeholder="例：美容液／10mL" className="mt-1" /></label>
              <label className="block text-xs font-medium text-gray-600">商品紹介<Textarea maxLength={800} value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} rows={4} className="mt-1" /></label>
              <label className="block text-xs font-medium text-gray-600">核心ポイント（1行1項目・最大6件）<Textarea value={form.sellingPoints.join("\n")} onChange={(event) => setForm({ ...form, sellingPoints: splitLines(event.target.value, 6) })} rows={5} className="mt-1" /></label>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-bold text-gray-900">成分／特徴</h3><Button type="button" variant="outline" size="sm" disabled={form.ingredients.length >= 8} onClick={() => setForm((current) => ({ ...current, ingredients: [...current.ingredients, { name: "", function: "", benefit: "" }] }))}><Plus className="mr-1 h-3 w-3" />追加</Button></div>
              {form.ingredients.map((item, index) => <div key={index} className="space-y-2 rounded-lg border bg-gray-50 p-3"><div className="flex gap-2"><Input value={item.name} onChange={(event) => updateIngredient(index, { name: event.target.value })} placeholder="成分／特徴名" /><Button type="button" variant="ghost" size="icon" onClick={() => setForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4 text-red-500" /></Button></div><Input value={item.function} onChange={(event) => updateIngredient(index, { function: event.target.value })} placeholder="主な働き" /><Input value={item.benefit} onChange={(event) => updateIngredient(index, { benefit: event.target.value })} placeholder="お客様へのメリット" /></div>)}
              {form.ingredients.length === 0 && <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">未登録。化粧品以外は「特徴／機能／メリット」として入力できます。</p>}
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-gray-900">接客・使用情報</h3>
              <label className="block text-xs font-medium text-gray-600">使用方法<Textarea maxLength={1000} value={form.usage} onChange={(event) => setForm({ ...form, usage: event.target.value })} rows={3} className="mt-1" /></label>
              <label className="block text-xs font-medium text-gray-600">おすすめ対象<Textarea maxLength={800} value={form.targetAudience} onChange={(event) => setForm({ ...form, targetAudience: event.target.value })} rows={3} className="mt-1" /></label>
              <label className="block text-xs font-medium text-gray-600">注意事項<Textarea maxLength={1200} value={form.precautions} onChange={(event) => setForm({ ...form, precautions: event.target.value })} rows={3} className="mt-1" /></label>
              <label className="block text-xs font-medium text-gray-600">スタッフ／配信者用トーク<Textarea maxLength={1200} value={form.liveScript} onChange={(event) => setForm({ ...form, liveScript: event.target.value })} rows={5} className="mt-1" /></label>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-bold text-gray-900">よくある質問</h3><Button type="button" variant="outline" size="sm" disabled={form.faqs.length >= 4} onClick={() => setForm((current) => ({ ...current, faqs: [...current.faqs, { question: "", answer: "" }] }))}><Plus className="mr-1 h-3 w-3" />追加</Button></div>
              {form.faqs.map((item, index) => <div key={index} className="space-y-2 rounded-lg border bg-gray-50 p-3"><div className="flex gap-2"><Input value={item.question} onChange={(event) => updateFaq(index, { question: event.target.value })} placeholder="質問" /><Button type="button" variant="ghost" size="icon" onClick={() => setForm((current) => ({ ...current, faqs: current.faqs.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4 text-red-500" /></Button></div><Textarea value={item.answer} onChange={(event) => updateFaq(index, { answer: event.target.value })} placeholder="回答" rows={2} /></div>)}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><h3 className="font-bold text-gray-900">試験・特許・証明資料</h3><Button type="button" variant="outline" size="sm" disabled={form.evidenceItems.length >= 4} onClick={() => setForm((current) => ({ ...current, evidenceItems: [...current.evidenceItems, { title: "", description: "", metric: "", imageId: null }] }))}><Plus className="mr-1 h-3 w-3" />追加</Button></div>
              {form.evidenceItems.map((item, index) => <div key={index} className="space-y-2 rounded-lg border bg-gray-50 p-3"><div className="flex gap-2"><Input value={item.title} onChange={(event) => updateEvidence(index, { title: event.target.value })} placeholder="資料名" /><Button type="button" variant="ghost" size="icon" onClick={() => setForm((current) => ({ ...current, evidenceItems: current.evidenceItems.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 className="h-4 w-4 text-red-500" /></Button></div><Input value={item.metric} onChange={(event) => updateEvidence(index, { metric: event.target.value })} placeholder="数値・特許番号（任意）" /><Textarea value={item.description} onChange={(event) => updateEvidence(index, { description: event.target.value })} placeholder="説明" rows={2} /><select value={item.imageId ?? ""} onChange={(event) => updateEvidence(index, { imageId: event.target.value ? Number(event.target.value) : null })} className="w-full rounded-md border bg-white px-3 py-2 text-sm"><option value="">画像なし</option>{images.map((image) => <option key={image.id} value={image.id}>商品画像 #{image.id}{image.isPrimary ? "（主画像）" : ""}</option>)}</select></div>)}
              <p className="text-[11px] text-gray-500">この商品に既に登録されている画像だけを選択できます。試験・特許・証明を裏付ける資料がない場合は追加しないでください。</p>
            </section>
          </div>
        </div>

      <main className="min-h-0 overflow-auto p-5">
        <div id="store-product-handcard-print-root" className="mx-auto flex w-fit flex-col gap-5">
          <HandcardPage mirrored={mirrored} className="bg-[#edfafa]">
            <div className="flex min-h-[297mm] flex-col px-[14mm] py-[12mm]">
              <div className="flex items-start justify-between text-[12px] font-bold"><span>{product.brandName || "ブランド未登録"}</span><span>01</span></div>
              <div className="mt-[12mm] grid grid-cols-[1.15fr_0.85fr] gap-[10mm]">
                <div>
                  <SectionLabel>{form.seriesLabel || "PRODUCT HAND CARD"}</SectionLabel>
                  <h1 className="mt-4 text-[31px] font-black leading-tight">{product.productName || "商品名未登録"}</h1>
                  <div className="mt-5 border-b-2 border-[#53b8c7] pb-4 text-[15px] font-semibold">{form.subtitle || product.category || "副タイトル／容量 未登録"}</div>
                  <div className="mt-5 whitespace-pre-wrap text-[13px] leading-7 text-[#335d68]">{form.shortDescription || <EmptyField />}</div>
                </div>
                <div className="flex h-[70mm] items-center justify-center overflow-hidden rounded-[10mm] bg-white/80">
                  {primaryImage ? <img src={primaryImage} alt="" className="h-full w-full object-contain" /> : <div className="text-center text-[#7da4ad]"><ImageIcon className="mx-auto mb-2 h-10 w-10" /><EmptyField>商品画像 未登録</EmptyField></div>}
                </div>
              </div>
              <div className="mt-[12mm] grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/80 p-4"><div className="text-[10px] text-[#67939e]">通常価格</div><div className="mt-2 text-[21px] font-black">{formatPrice(product.basePrice, product.currency || "JPY")}</div></div>
                <div className="rounded-xl bg-white/80 p-4"><div className="text-[10px] text-[#67939e]">商品コード</div><div className="mt-2 break-all text-[13px] font-bold">{productCode}</div></div>
                <div className="rounded-xl bg-white/80 p-4"><div className="text-[10px] text-[#67939e]">SKU</div><div className="mt-2 text-[21px] font-black">{skus.length}件</div></div>
              </div>
              <div className="mt-[11mm] flex-1">
                <h2 className="text-[19px] font-black">商品のポイント</h2>
                {form.sellingPoints.length > 0 ? <div className="mt-5 grid grid-cols-2 gap-4">{form.sellingPoints.map((point, index) => <div key={index} className="rounded-xl border border-[#b8e3e8] bg-white/80 p-5"><div className="text-[11px] font-bold text-[#53b8c7]">POINT {String(index + 1).padStart(2, "0")}</div><p className="mt-2 text-[15px] font-bold leading-7">{point}</p></div>)}</div> : <div className="mt-5 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6"><EmptyField>核心ポイント 未登録</EmptyField></div>}
              </div>
              <div className="mt-6 rounded-2xl bg-[#083746] px-6 py-5 text-white"><div className="text-[10px] text-[#68c6d3]">PRODUCT SUMMARY</div><p className="mt-2 text-[15px] font-bold leading-7">{form.shortDescription || "商品紹介を登録すると、ここに要約として表示されます。"}</p></div>
            </div>
          </HandcardPage>

          <HandcardPage mirrored={mirrored} className="bg-[#073442] text-white">
            <div className="flex min-h-[297mm] flex-col px-[14mm] py-[12mm]">
              <div className="flex items-start justify-between text-[12px] font-bold"><span>{product.brandName || "ブランド未登録"}</span><span>02</span></div>
              <div className="mt-[10mm] grid grid-cols-[1.2fr_0.8fr] gap-[10mm]">
                <div><SectionLabel>{form.seriesLabel || "FEATURES / INGREDIENTS"}</SectionLabel><h1 className="mt-4 text-[30px] font-black leading-tight">成分・特徴とお客様へのメリット</h1><p className="mt-5 whitespace-pre-wrap text-[13px] leading-7 text-[#c1dce1]">{form.usage || "使用方法 未登録"}</p></div>
                <div className="flex h-[58mm] items-center justify-center overflow-hidden rounded-[8mm] bg-white/10">{primaryImage ? <img src={primaryImage} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="h-10 w-10 text-white/40" />}</div>
              </div>
              <div className="mt-[10mm] flex-1">
                <div className="grid grid-cols-[0.8fr_1fr_1.1fr] border-y border-[#2a6673] bg-[#0b4958] px-4 py-3 text-[11px] font-bold text-[#70d0dc]"><span>成分／特徴</span><span>主な働き</span><span>お客様へのメリット</span></div>
                {form.ingredients.length > 0 ? form.ingredients.map((item, index) => <div key={index} className="grid grid-cols-[0.8fr_1fr_1.1fr] gap-5 border-b border-[#2a6673] px-4 py-5 text-[12px] leading-6"><strong>{item.name}</strong><span className="text-[#c1dce1]">{item.function || "未登録"}</span><strong>{item.benefit || "未登録"}</strong></div>) : <div className="border-b border-[#2a6673] px-4 py-10 text-center text-amber-200">成分／特徴が未登録です</div>}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/10 p-5"><div className="text-[10px] font-bold text-[#70d0dc]">おすすめ対象</div><p className="mt-2 whitespace-pre-wrap text-[13px] leading-6">{form.targetAudience || "未登録"}</p></div>
                <div className="rounded-2xl bg-[#eaf9fa] p-5 text-[#083746]"><div className="text-[10px] font-bold text-[#53b8c7]">使用方法</div><p className="mt-2 whitespace-pre-wrap text-[13px] font-semibold leading-6">{form.usage || "未登録"}</p></div>
              </div>
            </div>
          </HandcardPage>

          <HandcardPage mirrored={mirrored} className="bg-[#edfafa]">
            <div className="flex min-h-[297mm] flex-col px-[14mm] py-[12mm]">
              <div className="flex items-start justify-between text-[12px] font-bold"><span>{product.brandName || "ブランド未登録"}</span><span>03</span></div>
              <div className="mt-[10mm]"><SectionLabel>SALES TALK / FAQ / EVIDENCE</SectionLabel><h1 className="mt-4 text-[29px] font-black">接客トーク・よくある質問・根拠資料</h1></div>
              <div className="mt-[9mm] grid grid-cols-[1.1fr_0.9fr] gap-5">
                <div className="rounded-2xl bg-[#083746] p-6 text-white"><div className="text-[10px] font-bold text-[#70d0dc]">スタッフ／配信者用トーク</div><p className="mt-3 whitespace-pre-wrap text-[14px] font-semibold leading-7">{form.liveScript || "接客トーク 未登録"}</p></div>
                <div className="rounded-2xl border border-[#b8e3e8] bg-white/80 p-6"><div className="text-[10px] font-bold text-[#53b8c7]">注意事項</div><p className="mt-3 whitespace-pre-wrap text-[12px] leading-6">{form.precautions || "注意事項 未登録"}</p></div>
              </div>
              <div className="mt-[8mm]">
                <h2 className="text-[18px] font-black">よくある質問</h2>
                {form.faqs.length > 0 ? <div className="mt-3 grid grid-cols-2 gap-3">{form.faqs.map((item, index) => <div key={index} className="rounded-xl bg-white/90 p-4"><div className="text-[12px] font-bold">Q. {item.question}</div><div className="mt-2 text-[11px] leading-5 text-[#456c76]">A. {item.answer || "回答未登録"}</div></div>)}</div> : <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4"><EmptyField>FAQ 未登録</EmptyField></div>}
              </div>
              <div className="mt-[8mm] flex-1">
                <h2 className="text-[18px] font-black">試験・特許・証明資料</h2>
                {form.evidenceItems.length > 0 ? <div className="mt-4 grid grid-cols-4 gap-3">{form.evidenceItems.map((item, index) => { const image = item.imageId ? imageById.get(Number(item.imageId)) : null; return <div key={index} className="rounded-xl bg-white/90 p-3 text-center">{image?.imageUrl ? <img src={image.imageUrl} alt="" className="mx-auto h-[34mm] w-full object-contain" /> : <div className="flex h-[34mm] items-center justify-center rounded-lg bg-[#e5f2f4]"><ImageIcon className="h-8 w-8 text-[#8bb2bb]" /></div>}<div className="mt-3 text-[11px] font-bold">{item.title}</div>{item.metric && <div className="mt-1 text-[13px] font-black text-[#53b8c7]">{item.metric}</div>}<div className="mt-1 text-[9px] leading-4 text-[#5b7780]">{item.description || "説明未登録"}</div></div>; })}</div> : <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-6"><EmptyField>試験・特許・証明資料 未登録</EmptyField></div>}
              </div>
              <div className="mt-5 border-t border-[#b8e3e8] pt-4 text-[9px] leading-4 text-[#567781]">本手カードはLCJ MALLに登録された商品資料から作成しています。未登録項目は補完・推測していません。法令上必要な表示、最終的な効能表現、販売条件は商品責任者が確認してください。</div>
            </div>
          </HandcardPage>
        </div>
      </main>
      </div>
    </div>
  );
}
