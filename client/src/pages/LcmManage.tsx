/**
 * LCM member workspace: editorial commerce UI with an upfront brand-discovery decision.
 * Managed brands go directly to product creation; catalog brands retain ownership verification.
 * Sensitive wholesale terms and shipping details never appear on public cards.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { AlertCircle, ArrowLeft, ArrowRight, BadgeJapaneseYen, Building2, CheckCircle2, Clock3, Eye, Flag, FolderTree, ImagePlus, Link2, Loader2, LockKeyhole, PackageCheck, PackagePlus, Save, Search, Send, ShieldCheck, ShoppingBag, Star, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { LcmCreatorWorkspace, type CreatorProfilePayload } from "@/components/lcm/LcmCreatorWorkspace";
import { lcf2026ExhibitorCatalogPages } from "@/data/lcf2026ExhibitorCatalog";
import { buildFestivalLoginUrl, getRequestedFestivalWorkspace } from "@/lib/festivalPortal";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";
import { getLcmCatalogBrandPages, getLcmCatalogIdentity, lcmCatalogIdentities, normalizeLcmCatalogName } from "@shared/lcmCatalogDirectory";

type BrandForm = {
  displayName: string; companyName: string; category: string; tagline: string; description: string; story: string;
  logoUrl: string; coverUrl: string; officialWebsiteUrl: string; tiktokShopUrl: string; amazonUrl: string; rakutenUrl: string; otherSalesUrl: string;
};
type ProductForm = {
  name: string; sku: string; category: string; summary: string; description: string; highlightsText: string; thirtySecondPitch: string; demoInstructions: string; targetAudience: string; prohibitedClaims: string; listPrice: string; taxMode: "included" | "excluded" | "unknown";
  primaryImageUrl: string; imageUrls: string[]; officialProductUrl: string; tiktokShopUrl: string; amazonUrl: string; rakutenUrl: string;
  sampleAvailable: boolean; sampleMonthlyLimit: string; sampleInstructions: string; wholesalePrice: string; wholesaleMinQuantity: string;
  wholesaleShippingTerms: string; wholesalePaymentTerms: string; commissionRate: string; stockDisclosure: "hidden" | "range" | "exact"; stockQuantity: string;
};

const emptyBrand: BrandForm = { displayName: "", companyName: "", category: "", tagline: "", description: "", story: "", logoUrl: "", coverUrl: "", officialWebsiteUrl: "", tiktokShopUrl: "", amazonUrl: "", rakutenUrl: "", otherSalesUrl: "" };
const emptyProduct: ProductForm = { name: "", sku: "", category: "", summary: "", description: "", highlightsText: "", thirtySecondPitch: "", demoInstructions: "", targetAudience: "", prohibitedClaims: "", listPrice: "", taxMode: "included", primaryImageUrl: "", imageUrls: [], officialProductUrl: "", tiktokShopUrl: "", amazonUrl: "", rakutenUrl: "", sampleAvailable: false, sampleMonthlyLimit: "", sampleInstructions: "", wholesalePrice: "", wholesaleMinQuantity: "", wholesaleShippingTerms: "", wholesalePaymentTerms: "", commissionRate: "", stockDisclosure: "hidden", stockQuantity: "" };
const fallbackImage = lcf2026ExhibitorCatalogPages[25]?.imageUrl || lcf2026ExhibitorCatalogPages[1]?.imageUrl || "https://www.livecommercefestival.com/favicon.ico";
const LCM_BRAND_LINE_URL = "https://lin.ee/W2HjMAJ";
const LCM_BRAND_REQUEST_MESSAGE = "LCMでブランド登録を希望します。会社名、ブランド名、担当者名、公式サイトURLを確認してください。";

const statusLabels: Record<string, string> = { draft: "下書き", submitted: "運営確認中", published: "公開中", rejected: "要修正", suspended: "公開停止", pending: "確認中", approved: "利用中" };

function Field({ label, children, note, inverse = false }: { label: string; children: React.ReactNode; note?: string; inverse?: boolean }) {
  return <label className="block"><span className={`mb-2 block text-xs font-black tracking-[0.08em] ${inverse ? "text-white/70" : "text-black/60"}`}>{label}</span>{children}{note && <span className={`mt-1 block text-[11px] leading-5 ${inverse ? "text-white/50" : "text-black/45"}`}>{note}</span>}</label>;
}

function inputClass() { return "h-12 w-full border border-black/20 bg-white px-3 text-sm outline-none focus:border-black"; }
function textareaClass() { return "min-h-28 w-full border border-black/20 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-black"; }

function managePrice(value: string | number | null | undefined, taxMode?: string | null) {
  if (value == null || value === "") return "価格未登録";
  const amount = Number(value);
  const formatted = Number.isFinite(amount) ? `¥${amount.toLocaleString("ja-JP")}` : String(value);
  return taxMode === "included" ? `${formatted}（税込）` : taxMode === "excluded" ? `${formatted}（税別）` : formatted;
}

function productReadiness(item: { name?: unknown; category?: unknown; summary?: unknown; listPrice?: unknown; primaryImageUrl?: unknown }) {
  const checks = [Boolean(item.name), Boolean(item.category), Boolean(item.summary), item.listPrice !== null && item.listPrice !== undefined && item.listPrice !== "", Boolean(item.primaryImageUrl)];
  const completed = checks.filter(Boolean).length;
  return { completed, percent: Math.round((completed / checks.length) * 100), ready: completed === checks.length };
}

async function fileToBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
    reader.readAsDataURL(file);
  });
}

export default function LcmManage() {
  const utils = trpc.useUtils();
  const searchString = useSearch();
  const params = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const claimPage = Number(params.get("claim") || 0) || null;
  const sampleProductId = Number(params.get("sample") || 0) || null;
  const wholesaleProductId = Number(params.get("wholesale") || 0) || null;
  const requestedBrandId = Number(params.get("brand") || 0) || null;
  const showRequests = params.get("requests") === "1";
  const showBrandReviews = params.get("reviews") === "1";
  const requestedWorkspace = getRequestedFestivalWorkspace(params.get("workspace"));
  const showCreatorProfile = requestedWorkspace === "creator" || params.get("creator") === "profile";
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(() => Number(params.get("brand") || 0) || null);
  const [brandForm, setBrandForm] = useState<BrandForm>(emptyBrand);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
	  const [showBrandEditor, setShowBrandEditor] = useState(false);
	  const [showProductEditor, setShowProductEditor] = useState(false);
	  const [showNewBrandRequest, setShowNewBrandRequest] = useState(false);
	  const [previewProductImage, setPreviewProductImage] = useState<{ name: string; url: string } | null>(null);

  const access = trpc.lcm.getMyAccess.useQuery(undefined, { retry: false });
  const approved = access.data?.membership?.status === "approved";
  const roles = access.data?.roles || { event: true, brand: false, creator: false };
  const myBrands = trpc.lcm.listMyBrands.useQuery(undefined, { enabled: approved, retry: false });
  const selectedBrand = myBrands.data?.find((entry) => entry.brand.id === selectedBrandId)
    || myBrands.data?.find((entry) => ["pending", "active"].includes(entry.member.status));

  useEffect(() => {
    if (access.isError && access.error?.data?.code === "UNAUTHORIZED") {
      window.location.replace(buildFestivalLoginUrl(window.location.pathname + window.location.search));
    }
  }, [access.error?.data?.code, access.isError]);
  const manageBrand = trpc.lcm.getManageBrand.useQuery({ brandId: selectedBrand?.brand.id || 0 }, { enabled: Boolean(approved && selectedBrand && ["pending", "active"].includes(selectedBrand.member.status)), retry: false });
  const memberProduct = trpc.lcm.getMemberProduct.useQuery({ productId: sampleProductId || wholesaleProductId || 0 }, { enabled: Boolean(approved && (sampleProductId || wholesaleProductId)), retry: false });
  const myRequests = trpc.lcm.listMyRequests.useQuery(undefined, { enabled: Boolean(approved), retry: false });
  const brandRequests = trpc.lcm.listBrandRequests.useQuery({ brandId: requestedBrandId || selectedBrand?.brand.id || 0 }, { enabled: Boolean(approved && showRequests && requestedBrandId), retry: false });
  const brandReviews = trpc.lcm.listBrandReviews.useQuery({ brandId: requestedBrandId || selectedBrand?.brand.id || 0 }, { enabled: Boolean(approved && showBrandReviews && requestedBrandId), retry: false });

  useEffect(() => {
    const title = requestedWorkspace === "creator" ? "LCM ライブコマーサーマイページ" : requestedWorkspace === "brand" ? "LCM ブランドマイページ" : "LCM 会員マイページ";
    const description = requestedWorkspace === "creator" ? "LCM会員専用のライブコマーサー公式プロフィール・商品探索・申請管理画面です。" : "LCM会員専用のブランド・商品・申請管理画面です。";
    return applyPageSeo({ title, description, canonicalPath: "/lcm/manage", image: fallbackImage, robots: "noindex, nofollow, noarchive" });
  }, [requestedWorkspace]);

  useEffect(() => {
    if (!selectedBrandId && selectedBrand?.brand.id) setSelectedBrandId(selectedBrand.brand.id);
  }, [selectedBrand?.brand.id, selectedBrandId]);

  useEffect(() => {
    if (requestedBrandId) setSelectedBrandId(requestedBrandId);
  }, [requestedBrandId]);

  useEffect(() => {
    const brand = manageBrand.data?.brand;
    if (!brand) return;
    setBrandForm({ displayName: brand.displayName || "", companyName: brand.companyName || "", category: brand.category || "", tagline: brand.tagline || "", description: brand.description || "", story: brand.story || "", logoUrl: brand.logoUrl || "", coverUrl: brand.coverUrl || "", officialWebsiteUrl: brand.officialWebsiteUrl || "", tiktokShopUrl: brand.tiktokShopUrl || "", amazonUrl: brand.amazonUrl || "", rakutenUrl: brand.rakutenUrl || "", otherSalesUrl: brand.otherSalesUrl || "" });
  }, [manageBrand.data?.brand]);

  const refresh = async () => {
    await Promise.all([utils.lcm.getMyAccess.invalidate(), utils.lcm.listMyBrands.invalidate(), utils.lcm.getManageBrand.invalidate()]);
  };
  const membershipMutation = trpc.lcm.applyMembership.useMutation({ onSuccess: async (data) => { if (data.status === "approved") { data.notification?.success ? toast.success("無料登録が完了し、LCMを利用できます") : toast.warning("無料登録が完了しました。メール通知結果は運営へ記録されています"); } else { toast.error(data.status === "suspended" ? "このアカウントは運営により利用停止中です" : "このアカウントは現在利用できません"); } await refresh(); }, onError: (error) => toast.error(error.message) });
  const updateBrand = trpc.lcm.updateBrand.useMutation({ onSuccess: async () => { toast.success("ブランド情報を保存しました"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const submitBrand = trpc.lcm.submitBrand.useMutation({ onSuccess: async () => { toast.success("ブランドを公開しました。続けて商品ページを登録しましょう"); setEditingProductId(null); setProductForm(emptyProduct); setShowProductEditor(true); await refresh(); }, onError: (error) => toast.error(error.message) });
  const claimCatalogSelection = trpc.lcm.claimCatalogSelection.useMutation({ onSuccess: async (data) => { setSelectedBrandId(data.selectedBrandId || null); setShowBrandEditor(Boolean(data.selectedBrandId)); toast.success(data.scope === "company" ? `${data.companyName}と仮連携しました。下書き編集を開始できます` : "ブランドと仮連携しました。下書き編集を開始できます"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const createProduct = trpc.lcm.createProduct.useMutation({ onSuccess: async () => { setProductForm(emptyProduct); setShowProductEditor(false); toast.success("商品下書きを作成しました"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const updateProduct = trpc.lcm.updateProduct.useMutation({ onSuccess: async () => { setProductForm(emptyProduct); setEditingProductId(null); setShowProductEditor(false); toast.success("商品情報を保存しました"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const submitProduct = trpc.lcm.submitProduct.useMutation({ onSuccess: async () => { toast.success("商品ページを公開しました"); await refresh(); }, onError: (error) => toast.error(error.message) });
  const uploadImage = trpc.lcm.uploadImage.useMutation({ onError: (error) => toast.error(error.message) });
  const createSample = trpc.lcm.createSampleRequest.useMutation({ onSuccess: async () => { toast.success("サンプル申請を送信しました"); await myRequests.refetch(); window.location.assign("/lcm/manage?requests=1"); }, onError: (error) => toast.error(error.message) });
  const createWholesale = trpc.lcm.createWholesaleInquiry.useMutation({ onSuccess: async () => { toast.success("卸商談を申し込みました"); await myRequests.refetch(); window.location.assign("/lcm/manage?requests=1"); }, onError: (error) => toast.error(error.message) });
  const cancelSample = trpc.lcm.cancelSampleRequest.useMutation({ onSuccess: async () => { toast.success("サンプル申請を取り消しました"); await myRequests.refetch(); }, onError: (error) => toast.error(error.message) });
  const cancelWholesale = trpc.lcm.cancelWholesaleInquiry.useMutation({ onSuccess: async () => { toast.success("卸商談を取り消しました"); await myRequests.refetch(); }, onError: (error) => toast.error(error.message) });
  const updateSampleStatus = trpc.lcm.updateSampleStatus.useMutation({ onSuccess: async () => { toast.success("サンプル申請の状態を更新しました"); await brandRequests.refetch(); }, onError: (error) => toast.error(error.message) });
  const updateWholesaleStatus = trpc.lcm.updateWholesaleStatus.useMutation({ onSuccess: async () => { toast.success("卸商談の状態を更新しました"); await brandRequests.refetch(); }, onError: (error) => toast.error(error.message) });
  const reportProductReview = trpc.lcm.reportProductReview.useMutation({ onSuccess: async () => { toast.success("レビュー内容を運営へ報告しました"); await brandReviews.refetch(); }, onError: (error) => toast.error(error.message) });
  const saveCreatorProfile = trpc.lcm.saveCreatorProfile.useMutation({ onSuccess: async () => { toast.success("ライブコマーサープロフィールを保存しました"); await utils.lcm.getMyAccess.invalidate(); }, onError: (error) => toast.error(error.message) });
  const submitCreatorProfile = trpc.lcm.submitCreatorProfile.useMutation({ onSuccess: async () => { toast.success("公開プロフィールを運営確認へ提出しました"); await utils.lcm.getMyAccess.invalidate(); }, onError: (error) => toast.error(error.message) });
  const uploadCreatorImage = trpc.lcm.uploadCreatorImage.useMutation({ onError: (error) => toast.error(error.message) });

  if (access.isLoading) return <LcmPublicLayout><main className="grid min-h-[65vh] place-items-center"><Loader2 className="h-9 w-9 animate-spin" /></main></LcmPublicLayout>;
  if (access.isError || !access.data) {
    if (access.error?.data?.code === "UNAUTHORIZED" || !access.data) {
      return <LcmPublicLayout><main className="grid min-h-[65vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto h-9 w-9 animate-spin" /><p className="mt-4 text-sm font-bold text-black/55">共通ログインへ移動しています</p></div></main></LcmPublicLayout>;
    }
    return <LcmPublicLayout><main className="grid min-h-[65vh] place-items-center px-5"><div className="max-w-lg border border-red-200 bg-red-50 p-8 text-center"><AlertCircle className="mx-auto h-10 w-10 text-red-700" /><h1 className="mt-5 text-2xl font-black">マイページを読み込めません</h1><p className="mt-4 text-sm leading-7 text-black/60">時間をおいて再度お試しください。</p></div></main></LcmPublicLayout>;
  }

  const membership = access.data.membership;
  if (!membership && (access.data.companyAccountLink || access.data.liverAccountLink)) return <LinkedMembershipQuickStart email={access.data.account.email} accountType={access.data.account.accountType} preferredType={requestedWorkspace} companyAccountLink={access.data.companyAccountLink} liverAccountLink={access.data.liverAccountLink} pending={membershipMutation.isPending} onSubmit={(data) => membershipMutation.mutate(data)} />;
  if (!membership) return <MembershipApplication email={access.data.account.email} accountType={access.data.account.accountType} preferredType={requestedWorkspace} companyAccountLink={access.data.companyAccountLink} liverAccountLink={access.data.liverAccountLink} pending={membershipMutation.isPending} onSubmit={(data) => membershipMutation.mutate(data)} />;
  if (membership.status !== "approved") return <LcmPublicLayout><main className="grid min-h-[65vh] place-items-center px-5"><div className="max-w-xl border border-black/15 bg-white p-8"><Clock3 className="h-10 w-10 text-[#d45b16]" /><p className="mt-5 text-xs font-black tracking-[0.16em]">MEMBERSHIP STATUS</p><h1 className="mt-2 text-3xl font-black">{membership.status === "pending" ? "会員状態を確認しています" : membership.status === "rejected" ? "LCMを利用できません" : "LCMの利用を停止しています"}</h1><p className="mt-4 text-sm leading-7 text-black/60">状態：{statusLabels[membership.status] || membership.status}{membership.reviewNote ? `｜${membership.reviewNote}` : ""}</p><p className="mt-4 text-xs leading-6 text-black/50">再開が必要な場合は、表示された理由を添えてLCM運営へお問い合わせください。</p></div></main></LcmPublicLayout>;

  if (sampleProductId || wholesaleProductId) {
    return <RequestApplication product={memberProduct.data} isLoading={memberProduct.isLoading} mode={sampleProductId ? "sample" : "wholesale"} pending={createSample.isPending || createWholesale.isPending} onSample={(data) => createSample.mutate({ productId: sampleProductId!, ...data })} onWholesale={(data) => createWholesale.mutate({ productId: wholesaleProductId!, ...data })} />;
  }
  const activeWorkspace = requestedWorkspace || (membership.memberType === "liver" && roles.creator ? "creator" : roles.brand ? "brand" : roles.creator ? "creator" : "event");
  if (requestedWorkspace === "creator" && !roles.creator) {
    return <WorkspaceUnavailable title="ライブコマーサーマイページを利用できません" description="有効なLCFライブコマーサー申込または利用登録が確認できません。イベントマイページから登録内容をご確認ください。" />;
  }
  if (requestedWorkspace === "brand" && !roles.brand) {
    return <WorkspaceUnavailable title="ブランドマイページを利用できません" description="有効なLCF企業申込またはブランド管理権限が確認できません。" />;
  }
  if (activeWorkspace === "creator" && !showRequests) {
    return <LcmCreatorWorkspace
      membership={membership}
      profile={access.data.creatorProfile}
      defaults={access.data.liverAccountLink}
      pending={saveCreatorProfile.isPending || submitCreatorProfile.isPending || uploadCreatorImage.isPending}
      onSave={(payload: CreatorProfilePayload) => saveCreatorProfile.mutate(payload)}
      onSubmit={() => submitCreatorProfile.mutate({ publicConsent: true })}
      onUpload={async (file) => {
        const base64Data = await fileToBase64(file);
        const result = await uploadCreatorImage.mutateAsync({ fileName: file.name, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", base64Data });
        return result.url;
      }}
    />;
  }
  const canOwnBrands = roles.brand;
  if (showRequests || showBrandReviews || !canOwnBrands) {
    if (showBrandReviews && requestedBrandId) {
      return <BrandReviewInbox data={brandReviews.data} isLoading={brandReviews.isLoading} brandId={requestedBrandId} onReport={(reviewId, details) => reportProductReview.mutate({ reviewId, reason: "inaccurate", details })} />;
    }
    if (showRequests && requestedBrandId) {
      return <BrandRequestInbox data={brandRequests.data} isLoading={brandRequests.isLoading} onSampleStatus={(payload) => updateSampleStatus.mutate(payload)} onWholesaleStatus={(payload) => updateWholesaleStatus.mutate(payload)} />;
    }
    return <RequestHistory data={myRequests.data} isLoading={myRequests.isLoading} onCancelSample={(id) => cancelSample.mutate({ id })} onCancelWholesale={(id) => cancelWholesale.mutate({ id })} />;
  }

  const activeBrand = selectedBrand?.brand;
  const canDraftManage = Boolean(selectedBrand && ["pending", "active"].includes(selectedBrand.member.status));
  const canPerformApprovedOperations = selectedBrand?.member.status === "active";
	  return <LcmPublicLayout><main className="mx-auto max-w-[1440px] px-5 py-10 md:px-8 md:py-16">
	    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/20 pb-6"><div><p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">LCM WORKSPACE / FREE REGISTRATION</p><h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">ブランドを育てる。</h1><p className="mt-3 text-sm font-medium text-black/55">{membership.displayName}｜{membership.businessName || membership.memberType}｜ブランド・商品登録は当面無料</p></div><div className="flex flex-wrap gap-2"><Link href="/lcm/manage?requests=1" className="inline-flex border border-black bg-white px-4 py-3 text-sm font-black">申請履歴</Link><Link href="/lcm" className="inline-flex border border-black px-4 py-3 text-sm font-black">公開マーケットを見る<Eye className="ml-2 h-4 w-4" /></Link></div></div>

	    <BrandDiscoveryPanel
	      brands={myBrands.data || []}
	      pending={claimCatalogSelection.isPending}
	      onAddProduct={(brandId) => {
	        setSelectedBrandId(brandId);
	        setShowBrandEditor(false);
	        setEditingProductId(null);
	        setProductForm(emptyProduct);
	        setShowProductEditor(true);
	        window.requestAnimationFrame(() => document.getElementById("lcm-brand-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }));
	      }}
	      onSelectBrand={(brandId) => {
	        setSelectedBrandId(brandId);
	        setShowBrandEditor(false);
	        setShowProductEditor(false);
	        window.requestAnimationFrame(() => document.getElementById("lcm-brand-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }));
	      }}
	      onClaim={(sourceCatalogPage, scope) => claimCatalogSelection.mutate({ sourceCatalogPage, scope, message: null })}
	      onCreate={() => setShowNewBrandRequest(true)}
	    />

	    <section id="lcm-brand-workspace" className="mt-8 scroll-mt-6 grid gap-px bg-black/15 lg:grid-cols-[300px_1fr]">
      <aside className="bg-[#171714] p-5 text-white">
        <p className="text-xs font-black tracking-[0.16em] text-white/45">MY BRANDS</p><div className="mt-4 grid gap-2">{(myBrands.data || []).map((entry) => <button key={entry.brand.id} type="button" onClick={() => { setSelectedBrandId(entry.brand.id); setShowBrandEditor(false); setShowProductEditor(false); }} className={`border px-4 py-3 text-left ${activeBrand?.id === entry.brand.id ? "border-[#f7cc35] bg-[#f7cc35] text-black" : "border-white/15 hover:border-white"}`}><span className="block font-black">{entry.brand.displayName}</span><span className="mt-1 block text-[11px] opacity-60">{entry.member.status === "pending" ? "仮連携中・下書き編集可" : statusLabels[entry.brand.status] || entry.brand.status}</span></button>)}</div>
        <button type="button" onClick={() => { setSelectedBrandId(null); setShowBrandEditor(false); setShowProductEditor(false); }} className="mt-4 flex w-full items-center justify-center border border-[#f7cc35] px-4 py-3 text-sm font-black text-[#f7cc35]"><Search className="mr-2 h-4 w-4" />既存企業・ブランドを探す</button>
	        {canOwnBrands && <button type="button" onClick={() => setShowNewBrandRequest(true)} className="mt-2 w-full border border-dashed border-white/35 px-4 py-3 text-sm font-black">＋ 新しいブランドを申請</button>}
      </aside>

      <div className="bg-[#f6f4ee] p-5 md:p-8">
	        {!activeBrand && !showBrandEditor && <CatalogLinkDirectory initialPage={claimPage} pending={claimCatalogSelection.isPending} onClaim={(sourceCatalogPage, scope) => claimCatalogSelection.mutate({ sourceCatalogPage, scope, message: null })} onCreate={() => setShowNewBrandRequest(true)} />}
        {showBrandEditor && activeBrand && <BrandEditor form={brandForm} setForm={setBrandForm} isNew={false} pending={updateBrand.isPending || uploadImage.isPending} onUpload={async (file, kind) => { const base64Data = await fileToBase64(file); const result = await uploadImage.mutateAsync({ brandId: activeBrand.id, fileName: file.name, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", base64Data }); setBrandForm((current) => ({ ...current, [kind]: result.url })); toast.success("画像をアップロードしました。保存すると反映されます"); }} onSave={() => updateBrand.mutate({ brandId: activeBrand.id, data: brandForm })} />}
        {activeBrand && !showBrandEditor && <>
          {selectedBrand?.member.status === "pending" && <div className="mb-5 flex gap-3 border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><Clock3 className="mt-0.5 h-5 w-5 shrink-0" /><span><strong>既存掲載ブランドとの仮連携中です。</strong> ブランド情報と商品を非公開の下書きとして編集できます。なりすまし防止の管理権限確認後に、ご自身でブランドと商品を公開できます。</span></div>}
          <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="inline-flex bg-white px-2.5 py-1 text-[11px] font-black">{selectedBrand?.member.status === "pending" ? "既存ブランドの権限確認中" : statusLabels[activeBrand.status] || activeBrand.status}</span><h2 className="mt-3 text-3xl font-black">{activeBrand.displayName}</h2><p className="mt-2 text-sm text-black/55">{activeBrand.tagline || "ブランド情報を追加してください"}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={!canDraftManage} onClick={() => setShowBrandEditor(true)} className="border border-black bg-white px-4 py-3 text-sm font-black disabled:opacity-40">編集する</button>{activeBrand.status === "published" && <Link href={`/lcm/brands/${activeBrand.slug}`} className="inline-flex border border-black bg-white px-4 py-3 text-sm font-black">公開ページ</Link>}{activeBrand.status === "draft" && <button type="button" disabled={submitBrand.isPending || !canPerformApprovedOperations} onClick={() => submitBrand.mutate({ brandId: activeBrand.id })} className="bg-[#171714] px-4 py-3 text-sm font-black text-white disabled:opacity-40">{canPerformApprovedOperations ? "ブランドを公開する" : "権限確認後に公開可能"}</button>}</div></div>
          {activeBrand.rejectionReason && <div className="mt-5 flex gap-3 border border-red-300 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{activeBrand.rejectionReason}</div>}
          <div className="mt-10 flex flex-wrap items-end justify-between gap-3 border-b border-black/20 pb-4"><div><p className="text-xs font-black tracking-[0.16em] text-black/45">PRODUCTS</p><h3 className="mt-1 text-2xl font-black">商品管理</h3></div><div className="flex flex-wrap gap-2">{canPerformApprovedOperations && <><Link href={`/lcm/manage?brand=${activeBrand.id}&reviews=1`} className="inline-flex items-center border border-black bg-white px-4 py-3 text-sm font-black"><Star className="mr-1.5 h-4 w-4" />レビュー</Link><Link href={`/lcm/manage?brand=${activeBrand.id}&requests=1`} className="border border-black bg-white px-4 py-3 text-sm font-black">サンプル・商談</Link></>}<button type="button" disabled={!canDraftManage} onClick={() => { setEditingProductId(null); setProductForm(emptyProduct); setShowProductEditor(true); }} className="inline-flex items-center bg-[#f7cc35] px-4 py-3 text-sm font-black disabled:opacity-40"><PackagePlus className="mr-2 h-4 w-4" />商品を追加</button></div></div>
          {showProductEditor ? <ProductEditor form={productForm} setForm={setProductForm} editing={Boolean(editingProductId)} pending={createProduct.isPending || updateProduct.isPending || uploadImage.isPending} onUpload={async (file) => { const base64Data = await fileToBase64(file); const result = await uploadImage.mutateAsync({ brandId: activeBrand.id, fileName: file.name, contentType: file.type as "image/jpeg" | "image/png" | "image/webp", base64Data }); toast.success("商品画像をアップロードしました"); return result.url; }} onCancel={() => { setShowProductEditor(false); setEditingProductId(null); }} onSave={() => { const data = productPayload(productForm); editingProductId ? updateProduct.mutate({ productId: editingProductId, data }) : createProduct.mutate({ brandId: activeBrand.id, data }); }} /> : <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(manageBrand.data?.products || []).map((item) => {
            const readiness = productReadiness(item);
            return <article key={item.id} className="flex min-w-0 flex-col border border-black/15 bg-white p-3">
              <div className="relative aspect-[4/3] overflow-hidden bg-[#eeeae0]">{item.primaryImageUrl ? <button type="button" onClick={() => setPreviewProductImage({ name: item.name, url: item.primaryImageUrl! })} className="group relative h-full w-full cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b6200] focus-visible:ring-offset-2" aria-label={`${item.name}のメイン写真を拡大表示`}><LcmProductImage src={item.primaryImageUrl} alt={`${item.name}のメイン写真`} className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-[1.025]" /><span aria-hidden="true" className="absolute bottom-2 right-2 inline-flex items-center bg-black/80 px-2 py-1 text-[9px] font-black text-white"><Eye className="mr-1 h-3 w-3" />拡大</span></button> : <div className="grid h-full place-items-center text-center text-xs font-bold text-black/35"><ImagePlus className="mb-2 h-7 w-7" />メイン写真を登録</div>}</div>
              <div className="flex flex-1 flex-col p-2 pt-4"><div className="flex flex-wrap gap-1.5"><span className="bg-[#f1efe8] px-2 py-1 text-[10px] font-black">{statusLabels[item.status] || item.status}</span>{item.sampleAvailable && <span className="bg-[#dff5ea] px-2 py-1 text-[10px] font-black text-[#126445]">サンプル</span>}{item.wholesalePrice && <span className="bg-[#fff0bd] px-2 py-1 text-[10px] font-black">会員限定条件あり</span>}</div><h4 className="mt-3 line-clamp-2 text-base font-black leading-6">{item.name}</h4><p className="mt-2 text-base font-black">{managePrice(item.listPrice, item.taxMode)}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-black/50">{item.summary || "商品概要を追加してください"}</p>
                <div className="mt-4"><div className="flex items-center justify-between text-[10px] font-black"><span>{readiness.ready ? "公開必須項目が揃っています" : `公開準備 ${readiness.completed}/5`}</span><span>{readiness.percent}%</span></div><div className="mt-1.5 h-1.5 bg-black/10"><div className={`h-full ${readiness.ready ? "bg-[#16805b]" : "bg-[#f7cc35]"}`} style={{ width: `${readiness.percent}%` }} /></div></div>
                {item.rejectionReason && <p className="mt-3 text-xs font-bold text-red-700">要修正：{item.rejectionReason}</p>}
                <div className="mt-auto flex gap-2 border-t border-black/10 pt-4"><button type="button" onClick={() => { setEditingProductId(item.id); setProductForm(productFormFromItem(item)); setShowProductEditor(true); }} className="flex-1 border border-black px-3 py-2.5 text-xs font-black">編集</button>{item.status === "draft" && <button type="button" disabled={!canPerformApprovedOperations || activeBrand.status !== "published" || !readiness.ready} onClick={() => submitProduct.mutate({ productId: item.id })} className="flex-1 bg-[#171714] px-3 py-2.5 text-xs font-black text-white disabled:opacity-40">{!canPerformApprovedOperations ? "権限確認後" : activeBrand.status !== "published" ? "ブランドを先に公開" : readiness.ready ? "商品を公開する" : "入力を完成"}</button>}</div>
              </div>
            </article>;
          })}{manageBrand.data?.products.length === 0 && <div className="col-span-full border border-dashed border-black/25 bg-white p-10 text-center"><ShoppingBag className="mx-auto h-9 w-9 text-black/20" /><p className="mt-3 font-black">まだ商品がありません</p><p className="mt-2 text-xs leading-6 text-black/50">まずは商品写真と定価から登録できます。</p><button type="button" onClick={() => { setEditingProductId(null); setProductForm(emptyProduct); setShowProductEditor(true); }} className="mt-5 bg-[#f7cc35] px-5 py-3 text-sm font-black">最初の商品を登録する</button></div>}</div>}
        </>}
      </div>
	    </section>
	    <NewBrandRequestDialog open={showNewBrandRequest} onOpenChange={setShowNewBrandRequest} />
	    <ProductImagePreview product={previewProductImage} onClose={() => setPreviewProductImage(null)} />
  </main></LcmPublicLayout>;
}

function NewBrandRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(LCM_BRAND_REQUEST_MESSAGE);
      toast.success("送信用メッセージをコピーしました");
    } catch {
      toast.error("コピーできませんでした。表示された文をLINEへ入力してください");
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto border-black bg-[#f6f4ee] p-0 sm:max-w-2xl"><DialogHeader className="border-b border-black/15 bg-[#171714] p-6 text-left text-white"><p className="text-xs font-black tracking-[0.18em] text-[#f7cc35]">NEW BRAND REQUEST</p><DialogTitle className="mt-2 text-2xl font-black sm:text-3xl">新しいブランドは公式LINEから申請</DialogTitle><DialogDescription className="mt-2 text-sm leading-7 text-white/65">新規ブランドは担当者が会社・ブランド情報を確認した後、LCMへ登録します。</DialogDescription></DialogHeader><div className="p-5 sm:p-7"><div className="grid gap-3 sm:grid-cols-3">{[
    ["01", "公式LINEを追加", "下のボタンからLCJ公式LINEを開きます。"],
    ["02", "登録希望を送信", "「LCMでブランド登録希望」と担当者へ送ります。"],
    ["03", "登録後に商品追加", "ブランドがLCMへ追加されたら、同じ画面から商品登録を始めます。"],
  ].map(([number, title, description]) => <div key={number} className="border border-black/15 bg-white p-4"><span className="text-xs font-black text-[#9b6200]">{number}</span><p className="mt-2 font-black">{title}</p><p className="mt-2 text-xs leading-6 text-black/55">{description}</p></div>)}</div><div className="mt-5 border-l-4 border-[#06c755] bg-white p-4"><p className="text-xs font-black tracking-[0.12em] text-black/45">LINEへ送る内容</p><p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-7">{LCM_BRAND_REQUEST_MESSAGE}</p><button type="button" onClick={() => void copyMessage()} className="mt-3 inline-flex items-center border border-black px-3 py-2 text-xs font-black"><Link2 className="mr-1.5 h-4 w-4" />メッセージをコピー</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href={LCM_BRAND_LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center bg-[#06c755] px-5 py-3 text-sm font-black text-white"><Send className="mr-2 h-4 w-4" />LCJ公式LINEを開く</a><a href="mailto:info@livecommercejapan.jp?subject=LCM%E6%96%B0%E8%A6%8F%E3%83%96%E3%83%A9%E3%83%B3%E3%83%89%E7%99%BB%E9%8C%B2%E5%B8%8C%E6%9C%9B" className="inline-flex min-h-14 items-center justify-center border border-black bg-white px-5 py-3 text-center text-sm font-black">LINEを使えない場合はメール</a></div><p className="mt-4 text-xs leading-6 text-black/50">送信時に、会社名・ブランド名・担当者名・公式サイトURLをお知らせください。既存ブランドとの重複と管理権限を確認します。</p><DialogClose className="mt-5 w-full border border-black px-5 py-3 text-sm font-black">閉じる</DialogClose></div></DialogContent></Dialog>;
}

function BrandDiscoveryPanel({ brands, pending, onAddProduct, onSelectBrand, onClaim, onCreate }: {
  brands: Array<{ brand: { id: number; displayName: string; companyName?: string | null; status: string }; member: { status: string } }>;
  pending: boolean;
  onAddProduct: (brandId: number) => void;
  onSelectBrand: (brandId: number) => void;
  onClaim: (page: number, scope: "brand" | "company") => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeLcmCatalogName(query);
  const managedMatches = useMemo(() => brands.filter((entry) => {
    if (!normalizedQuery) return true;
    return normalizeLcmCatalogName(`${entry.brand.displayName} ${entry.brand.companyName || ""}`).includes(normalizedQuery);
  }), [brands, normalizedQuery]);
  const managedNames = useMemo(() => new Set(brands.map((entry) => normalizeLcmCatalogName(entry.brand.displayName))), [brands]);
  const catalogMatches = useMemo(() => {
    if (!normalizedQuery) return [];
    return lcmCatalogIdentities
      .filter((identity) => identity.page === identity.primaryBrandPage && !managedNames.has(normalizeLcmCatalogName(identity.brandName)))
      .filter((identity) => {
        const products = getLcmCatalogBrandPages(identity.primaryBrandPage).map((page) => lcf2026ExhibitorCatalogPages.find((item) => item.page === page)?.productTitle || "");
        return normalizeLcmCatalogName(`${identity.companyName} ${identity.brandName} ${products.join(" ")}`).includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [managedNames, normalizedQuery]);
  const hasMatches = managedMatches.length > 0 || catalogMatches.length > 0;

  return <section className="mt-8 border border-black/15 bg-white p-5 md:p-8" aria-labelledby="brand-discovery-heading">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
      <div>
        <p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">START WITH YOUR BRAND</p>
        <h2 id="brand-discovery-heading" className="mt-2 text-3xl font-black tracking-tight md:text-5xl">あなたのブランドは、<br className="hidden sm:block" />すでにLCMにありますか？</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/60">まず会社名・ブランド名・商品名で検索してください。管理中のブランドなら、そのまま商品登録へ進めます。第1回LCFで掲載済みのブランドは管理権限だけ確認し、見つからない場合は公式LINEから新規登録を申請します。</p>
      </div>
      <div className="border-l-4 border-[#f7cc35] bg-[#f6f4ee] p-4 text-xs font-bold leading-6 text-black/60"><span className="block text-sm font-black text-black">重複登録を防ぐ入口です</span>検索してから進むことで、既存のブランドページと第1回出展実績を引き継げます。</div>
    </div>
    <label className="relative mt-7 block"><span className="sr-only">会社名・ブランド名・商品名で検索</span><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例：会社名、ブランド名、商品名" className="h-16 w-full border-2 border-black bg-white pl-12 pr-4 text-base font-black outline-none focus:border-[#d19800]" /></label>

    {managedMatches.length > 0 && <div className="mt-7"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black">あなたが管理しているブランド</h3><span className="text-xs font-black text-black/40">{managedMatches.length}件</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{managedMatches.map((entry) => {
      const canAddProduct = entry.member.status === "active" && entry.brand.status !== "suspended";
      return <article key={entry.brand.id} className="border border-black/15 bg-[#faf8f2] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="inline-flex bg-white px-2 py-1 text-[10px] font-black">{entry.member.status === "pending" ? "管理権限確認中" : statusLabels[entry.brand.status] || entry.brand.status}</span><h4 className="mt-2 break-words text-xl font-black">{entry.brand.displayName}</h4>{entry.brand.companyName && <p className="mt-1 break-words text-xs text-black/50">{entry.brand.companyName}</p>}</div><CheckCircle2 className="h-5 w-5 shrink-0 text-[#16805b]" /></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => onSelectBrand(entry.brand.id)} className="border border-black bg-white px-3 py-3 text-xs font-black">ブランドを確認</button><button type="button" disabled={!canAddProduct} onClick={() => onAddProduct(entry.brand.id)} className="inline-flex items-center justify-center bg-[#f7cc35] px-3 py-3 text-xs font-black disabled:opacity-45"><PackagePlus className="mr-1.5 h-4 w-4" />{entry.member.status === "pending" ? "権限確認後に商品追加" : entry.brand.status === "suspended" ? "停止中" : "このブランドに商品を追加"}</button></div></article>;
    })}</div></div>}

    {normalizedQuery && catalogMatches.length > 0 && <div className="mt-7"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black">第1回LCFなどで掲載済み</h3><span className="text-xs font-black text-black/40">管理権限確認が必要</span></div><div className="mt-3 grid gap-3 md:grid-cols-2">{catalogMatches.map((identity) => <article key={identity.primaryBrandPage} className="border border-amber-300 bg-amber-50 p-4"><p className="text-[10px] font-black tracking-[0.14em] text-[#9b6200]">EXISTING LISTING</p><h4 className="mt-2 break-words text-lg font-black">{identity.brandName}</h4><p className="mt-1 break-words text-xs text-black/55">{identity.companyName}</p><p className="mt-3 text-xs leading-6 text-black/55">掲載実績を残したまま管理できます。第三者のなりすまし防止のため、連携時だけ運営が管理権限を確認します。</p><button type="button" disabled={pending} onClick={() => onClaim(identity.primaryBrandPage, "brand")} className="mt-4 inline-flex w-full items-center justify-center bg-[#171714] px-4 py-3 text-xs font-black text-white disabled:opacity-50"><Link2 className="mr-2 h-4 w-4" />管理権限を確認して連携</button></article>)}</div></div>}

    {normalizedQuery && !hasMatches && <div className="mt-7 border border-dashed border-black/25 bg-[#faf8f2] p-7 text-center"><Building2 className="mx-auto h-9 w-9 text-black/25" /><h3 className="mt-3 text-lg font-black">一致するブランドがありません</h3><p className="mt-2 text-xs leading-6 text-black/50">表記を変えて再検索しても見つからない場合は、公式LINEで担当者へ新規ブランド登録を申請してください。</p><button type="button" onClick={onCreate} className="mt-5 bg-[#f7cc35] px-6 py-3 text-sm font-black">公式LINEで新規登録を申請</button></div>}

    {!normalizedQuery && brands.length === 0 && <div className="mt-7 grid gap-3 md:grid-cols-3"><div className="border border-black/10 p-4"><span className="text-xs font-black text-[#9b6200]">01</span><p className="mt-2 font-black">まず検索</p><p className="mt-1 text-xs leading-5 text-black/50">会社名・ブランド名・商品名を入力します。</p></div><div className="border border-black/10 p-4"><span className="text-xs font-black text-[#9b6200]">02</span><p className="mt-2 font-black">既存なら引き継ぐ</p><p className="mt-1 text-xs leading-5 text-black/50">掲載実績とブランドページを重複させません。</p></div><div className="border border-black/10 p-4"><span className="text-xs font-black text-[#9b6200]">03</span><p className="mt-2 font-black">なければLINE申請</p><p className="mt-1 text-xs leading-5 text-black/50">担当者へ「LCMでブランド登録希望」と送ります。</p></div></div>}
  </section>;
}

function ProductImagePreview({ product, onClose }: { product: { name: string; url: string } | null; onClose: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product?.url]);

  return <Dialog open={Boolean(product)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] gap-3 overflow-hidden border-white/15 bg-[#0a0a0f] p-3 text-white sm:max-w-5xl sm:p-5"><DialogHeader className="pr-24 text-left"><DialogTitle className="text-lg font-black sm:text-xl">{product?.name || "商品メイン写真"}</DialogTitle><DialogDescription className="text-xs text-white/55">商品メイン写真の拡大プレビュー</DialogDescription></DialogHeader><DialogClose className="absolute right-3 top-3 inline-flex items-center border border-white/25 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"><X className="mr-1.5 h-4 w-4" />閉じる</DialogClose><div className="flex min-h-[240px] max-h-[calc(100dvh-8rem)] items-center justify-center overflow-auto bg-black p-2 sm:p-4">{product && !imageFailed ? <img src={product.url} alt={`${product.name}の拡大メイン写真`} onError={() => setImageFailed(true)} className="max-h-[calc(100dvh-10rem)] max-w-full object-contain" /> : <div role="status" className="px-6 py-16 text-center text-sm font-bold text-white/60">画像を読み込めませんでした。</div>}</div></DialogContent></Dialog>;
}

function MembershipApplication({ email, accountType, preferredType, companyAccountLink, liverAccountLink, pending, onSubmit }: { email: string; accountType: string; preferredType: "event" | "brand" | "creator" | null; companyAccountLink?: { eligible: true; sourceFestivalApplicationId?: number | null; displayName: string; businessName: string | null } | null; liverAccountLink?: { eligible: true; sourceFestivalApplicationId?: number | null; displayName: string; agencyName: string | null; categories: string[] } | null; pending: boolean; onSubmit: (data: { memberType: "company" | "liver" | "agency" | "buyer"; displayName: string; businessName?: string; termsAccepted: true }) => void }) {
  const initialType = preferredType === "creator" && (liverAccountLink || accountType === "liver")
    ? "liver"
    : preferredType === "brand" && (companyAccountLink || accountType === "company")
      ? "company"
      : accountType === "company"
        ? "company"
        : accountType === "liver"
          ? "liver"
          : companyAccountLink
            ? "company"
            : liverAccountLink
              ? "liver"
              : "buyer";
  const [memberType, setMemberType] = useState<"company" | "liver" | "agency" | "buyer">(initialType);
  const [displayName, setDisplayName] = useState(companyAccountLink?.displayName || liverAccountLink?.displayName || ""); const [businessName, setBusinessName] = useState(companyAccountLink?.businessName || liverAccountLink?.agencyName || ""); const [agreed, setAgreed] = useState(false);
  const linkedCompany = Boolean(companyAccountLink?.eligible || accountType === "company");
  const linkedLiver = Boolean(liverAccountLink?.eligible || accountType === "liver");
  const linkedExisting = linkedCompany || linkedLiver;
  const linkedBoth = linkedCompany && linkedLiver;
  const selectedLinked = memberType === "company" ? companyAccountLink : memberType === "liver" ? liverAccountLink : null;
  const lockedFromFestivalApplication = Boolean(selectedLinked?.sourceFestivalApplicationId);
  useEffect(() => {
    if (memberType === "company" && companyAccountLink) { setDisplayName(companyAccountLink.displayName); setBusinessName(companyAccountLink.businessName || ""); }
    if (memberType === "liver" && liverAccountLink) { setDisplayName(liverAccountLink.displayName); setBusinessName(liverAccountLink.agencyName || ""); }
  }, [companyAccountLink, liverAccountLink, memberType]);
  return <LcmPublicLayout><main className="mx-auto max-w-2xl px-5 py-14 md:py-20"><p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">LCM MEMBERSHIP / FREE</p><h1 className="mt-3 text-4xl font-black">{linkedExisting ? "同じアカウントでLCMを始める" : "無料でLCMを始める"}</h1><p className="mt-4 text-sm leading-7 text-black/60">{linkedBoth ? "企業・ブランドとライブコマーサーの両方を利用できます。今回開くマイページを選択してください。" : linkedCompany ? "企業・ブランド用の共通アカウントを確認しました。利用条件への同意後、まずブランドを検索してください。管理中なら商品登録、新規ブランドなら公式LINE申請へ進めます。" : linkedLiver ? "ライブコマーサー用の共通アカウントを確認しました。利用条件への同意後、公式プロフィールの作成とサンプル申請を始められます。" : "LCMの利用とブランド・商品登録は当面無料です。利用条件への同意後、ブランド検索または商品閲覧を始められます。"} ログイン中：{email}</p><form onSubmit={(event) => { event.preventDefault(); if (!agreed) return toast.error("利用条件への同意が必要です"); onSubmit({ memberType, displayName, businessName: businessName || undefined, termsAccepted: true }); }} className="mt-8 grid gap-5 border border-black/15 bg-white p-6">{linkedBoth ? <Field label="利用するマイページ"><select value={memberType} onChange={(event) => setMemberType(event.target.value as typeof memberType)} className={inputClass()}><option value="company">ブランドマイページ</option><option value="liver">ライブコマーサーマイページ</option></select></Field> : linkedExisting ? <div className="flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>{linkedLiver ? "ライブコマーサーアカウント連携済み。公開プロフィールは本人の提出後、運営が確認します。" : "企業・ブランドアカウント連携済み。利用開始後にまずブランドを検索し、見つからない新規ブランドは公式LINEから申請してください。"}</span></div> : <Field label="利用区分"><select value={memberType} onChange={(event) => setMemberType(event.target.value as typeof memberType)} className={inputClass()}><option value="company">企業・ブランド</option><option value="liver">ライブコマーサー</option><option value="agency">事務所・支援会社</option><option value="buyer">バイヤー・販売事業者</option></select></Field>}<Field label={memberType === "company" ? "担当者名" : "公開名・活動名"}><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={255} readOnly={lockedFromFestivalApplication} className={`${inputClass()} ${lockedFromFestivalApplication ? "bg-black/[0.04]" : ""}`} /></Field><Field label={memberType === "company" ? "会社名" : "会社・事務所名（任意）"}><input value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={255} readOnly={lockedFromFestivalApplication} className={`${inputClass()} ${lockedFromFestivalApplication ? "bg-black/[0.04]" : ""}`} /></Field><label className="flex items-start gap-3 border-t border-black/10 pt-4 text-xs leading-6"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" /><span>登録内容をLCMの{memberType === "company" ? "ブランド検索、管理権限申請、商品公開、卸商談、サンプル進行" : memberType === "liver" ? "公式プロフィール管理、商品探索、サンプル進行" : "商談、サンプル進行"}に利用することへ同意します。新規ブランドは公式LINE申請後に登録され、管理中ブランドの商品は本人の公開操作後に掲載されます。問題が確認された場合は運営が非公開または利用停止にできます。ライブコマーサー公開プロフィールは別途、本人の提出と運営確認後に公開されます。</span></label><button type="submit" disabled={pending || !displayName} className="inline-flex items-center justify-center bg-[#171714] px-6 py-4 text-sm font-black text-white disabled:opacity-50">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{linkedExisting ? "LCMを利用開始する" : "無料で登録して始める"}</button></form></main></LcmPublicLayout>;
}

function LinkedMembershipQuickStart({ email, accountType, preferredType, companyAccountLink, liverAccountLink, pending, onSubmit }: { email: string; accountType: string; preferredType: "event" | "brand" | "creator" | null; companyAccountLink?: { eligible: true; sourceFestivalApplicationId?: number | null; displayName: string; businessName: string | null } | null; liverAccountLink?: { eligible: true; sourceFestivalApplicationId?: number | null; displayName: string; agencyName: string | null; categories: string[] } | null; pending: boolean; onSubmit: (data: { memberType: "company" | "liver"; displayName: string; businessName?: string; termsAccepted: true }) => void }) {
  const hasCompany = Boolean(companyAccountLink || accountType === "company");
  const hasCreator = Boolean(liverAccountLink || accountType === "liver");
  const initialType: "company" | "liver" = preferredType === "creator" && hasCreator
    ? "liver"
    : preferredType === "brand" && hasCompany
      ? "company"
      : hasCompany
        ? "company"
        : "liver";
  const [memberType, setMemberType] = useState<"company" | "liver">(initialType);
  const [agreed, setAgreed] = useState(false);
  const link = memberType === "company" ? companyAccountLink : liverAccountLink;
  const displayName = link?.displayName || email.split("@")[0] || "LCM会員";
  const businessName = memberType === "company"
    ? companyAccountLink?.businessName || undefined
    : liverAccountLink?.agencyName || undefined;
  const workspaceName = memberType === "company" ? "ブランド" : "ライブコマーサー";
  return <LcmPublicLayout><main className="mx-auto max-w-5xl px-5 py-12 md:py-20">
    <p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">LCM WORKSPACE</p>
    <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">{memberType === "company" ? "ブランドを育てる。" : "販売する力を育てる。"}</h1>
    <p className="mt-4 text-sm leading-7 text-black/60">同じLCF・LCM共通アカウントで、{workspaceName}マイページを開始します。会社名や氏名の再入力は必要ありません。</p>
    <section className="mt-8 border border-black/15 bg-white p-5 md:p-7">
      {hasCompany && hasCreator && <Field label="利用するマイページ"><select value={memberType} onChange={(event) => setMemberType(event.target.value as "company" | "liver")} className={inputClass()}><option value="company">ブランド</option><option value="liver">ライブコマーサー</option></select></Field>}
      <div className={`${hasCompany && hasCreator ? "mt-5" : ""} flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900`}><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /><span>{displayName} 様の共通アカウントを確認しました。</span></div>
      <label className="mt-5 flex items-start gap-3 text-xs leading-6"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-1" /><span>登録情報をLCMの{memberType === "company" ? "ブランド検索・管理権限申請・商品管理" : "公式プロフィール管理、商品探索、サンプル進行"}に利用することへ同意します。新規ブランドは公式LINE申請後に登録され、商品は本人の公開操作後に掲載されます。問題が確認された場合は運営が非公開または利用停止にできます。既存掲載ブランドとの連携とライブコマーサー公開プロフィールは運営確認後に反映されます。</span></label>
      <button type="button" disabled={pending || !agreed} onClick={() => onSubmit({ memberType, displayName, businessName, termsAccepted: true })} className="mt-5 inline-flex w-full items-center justify-center bg-[#171714] px-6 py-4 text-sm font-black text-white disabled:opacity-45">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}{workspaceName}マイページを開く</button>
    </section>
  </main></LcmPublicLayout>;
}

function WorkspaceUnavailable({ title, description }: { title: string; description: string }) {
  return <LcmPublicLayout><main className="grid min-h-[55vh] place-items-center px-5"><div className="max-w-xl border border-black/15 bg-white p-8 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#d45b16]" /><h1 className="mt-5 text-3xl font-black">{title}</h1><p className="mt-4 text-sm leading-7 text-black/60">{description}</p><Link href="/lcf/mypage" className="mt-6 inline-flex bg-[#171714] px-6 py-3 text-sm font-black text-white">マイページへ</Link></div></main></LcmPublicLayout>;
}

const sampleStatusLabels: Record<string, string> = { pending: "申請中", approved: "承認済み", rejected: "見送り", preparing: "発送準備中", shipped: "発送済み", delivered: "受取済み", live_scheduled: "配信予定", completed: "完了", cancelled: "取消済み" };
const wholesaleStatusLabels: Record<string, string> = { requested: "申込済み", reviewing: "確認中", accepted: "商談承認", declined: "見送り", negotiating: "条件調整中", completed: "完了", cancelled: "取消済み" };

function RequestApplication({ product, isLoading, mode, pending, onSample, onWholesale }: { product: any; isLoading: boolean; mode: "sample" | "wholesale"; pending: boolean; onSample: (data: any) => void; onWholesale: (data: any) => void }) {
  const [purpose, setPurpose] = useState(""); const [contentType, setContentType] = useState<"live" | "short_video" | "both" | "other">("live"); const [plannedDate, setPlannedDate] = useState(""); const [message, setMessage] = useState("");
  const [recipientName, setRecipientName] = useState(""); const [postalCode, setPostalCode] = useState(""); const [address, setAddress] = useState(""); const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState(""); const [intendedUse, setIntendedUse] = useState("");
  if (isLoading) return <LcmPublicLayout><main className="grid min-h-[65vh] place-items-center"><Loader2 className="h-9 w-9 animate-spin" /></main></LcmPublicLayout>;
  if (!product) return <LcmPublicLayout><main className="mx-auto max-w-xl px-5 py-20"><div className="border border-red-200 bg-red-50 p-7"><AlertCircle className="h-8 w-8 text-red-700" /><h1 className="mt-4 text-2xl font-black">申請対象の商品を確認できません</h1><Link href="/lcm" className="mt-5 inline-flex border-b border-black pb-1 text-sm font-black">商品一覧へ戻る</Link></div></main></LcmPublicLayout>;
  const unavailable = mode === "sample" ? !product.sampleAvailable : !product.wholesalePrice;
  return <LcmPublicLayout><main className="mx-auto max-w-5xl px-5 py-10 md:py-16"><Link href={`/lcm/products/${product.slug}`} className="inline-flex items-center text-sm font-black"><ArrowLeft className="mr-2 h-4 w-4" />商品へ戻る</Link><div className="mt-7 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]"><aside className="self-start border border-black/15 bg-white p-5"><div className="aspect-square bg-[#eeeae0]">{product.primaryImageUrl && <img src={product.primaryImageUrl} alt={product.name} className="h-full w-full object-cover" />}</div><p className="mt-4 text-xs font-black tracking-[0.12em] text-black/45">{product.brandName}</p><h1 className="mt-2 text-2xl font-black">{product.name}</h1><p className="mt-3 text-sm leading-6 text-black/55">{product.summary}</p>{mode === "wholesale" && product.wholesalePrice && <div className="mt-5 border-t border-black/10 pt-4"><p className="text-xs font-black text-black/45">会員限定卸条件</p><p className="mt-1 text-3xl font-black">¥{Number(product.wholesalePrice).toLocaleString("ja-JP")}<span className="ml-1 text-xs">／点</span></p><p className="mt-2 text-xs text-black/55">最小発注数 {product.wholesaleMinQuantity}点</p><p className="mt-1 text-xs text-black/55">{product.wholesaleShippingTerms || "送料条件は商談時に確認"}</p></div>}</aside><section className="border border-black/15 bg-white p-5 md:p-8"><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">{mode === "sample" ? "SAMPLE REQUEST" : "WHOLESALE INQUIRY"}</p><h2 className="mt-2 text-3xl font-black">{mode === "sample" ? "サンプルを申請する" : "卸取引を相談する"}</h2>{unavailable ? <div className="mt-6 border border-amber-300 bg-amber-50 p-5 text-sm font-bold text-amber-900">この商品は現在{mode === "sample" ? "サンプル申請" : "卸商談"}を受け付けていません。</div> : <form onSubmit={(event) => { event.preventDefault(); if (mode === "sample") onSample({ purpose, plannedContentType: contentType, plannedDate: plannedDate || null, message: message || null, recipientName, postalCode, address, phone }); else onWholesale({ requestedQuantity: Number(quantity), intendedUse, requestedStartDate: plannedDate || null, message: message || null }); }} className="mt-7 grid gap-5">
    {mode === "sample" ? <><Field label="使用目的・紹介予定"><textarea required minLength={10} value={purpose} onChange={(event) => setPurpose(event.target.value)} className={textareaClass()} /></Field><Field label="予定コンテンツ"><select value={contentType} onChange={(event) => setContentType(event.target.value as typeof contentType)} className={inputClass()}><option value="live">LIVE</option><option value="short_video">ショート動画</option><option value="both">LIVE＋ショート動画</option><option value="other">その他</option></select></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="配信・投稿予定日（任意）"><input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} className={inputClass()} /></Field><Field label="受取人名"><input required value={recipientName} onChange={(event) => setRecipientName(event.target.value)} className={inputClass()} /></Field><Field label="郵便番号"><input required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} className={inputClass()} /></Field><Field label="電話番号"><input required value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass()} /></Field></div><Field label="配送先住所" note="承認・発送に必要なブランド担当者とLCF運営だけが確認します。"><textarea required value={address} onChange={(event) => setAddress(event.target.value)} className={textareaClass()} /></Field></> : <><Field label="希望数量"><input required type="number" min={product.wholesaleMinQuantity || 1} value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={`最小 ${product.wholesaleMinQuantity || 1}点`} className={inputClass()} /></Field><Field label="販売計画・利用目的"><textarea required minLength={10} value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)} className={textareaClass()} /></Field><Field label="取引開始希望日（任意）"><input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} className={inputClass()} /></Field></>}
    <Field label="ブランドへのメッセージ（任意）"><textarea value={message} onChange={(event) => setMessage(event.target.value)} className={textareaClass()} /></Field><button type="submit" disabled={pending} className="inline-flex items-center justify-center bg-[#d45b16] px-6 py-4 text-sm font-black text-white disabled:opacity-50">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{mode === "sample" ? "サンプルを申請する" : "卸商談を申し込む"}</button></form>}</section></div></main></LcmPublicLayout>;
}

function RequestHistory({ data, isLoading, onCancelSample, onCancelWholesale }: { data: any; isLoading: boolean; onCancelSample: (id: number) => void; onCancelWholesale: (id: number) => void }) {
  const samples = data?.samples || []; const wholesale = data?.wholesale || [];
  return <LcmPublicLayout><main className="mx-auto max-w-6xl px-5 py-10 md:py-16"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">MY REQUESTS</p><h1 className="mt-2 text-4xl font-black">申請・商談履歴</h1></div><Link href="/lcm" className="border border-black px-4 py-3 text-sm font-black">商品を探す</Link></div>{isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <div className="mt-8 grid gap-8 lg:grid-cols-2"><RequestList title="サンプル申請" icon={<PackageCheck className="h-5 w-5" />} items={samples.map((item: any) => ({ id: item.request.id, code: item.request.requestCode, product: item.productName, brand: item.brandName, status: item.request.status, statusLabel: sampleStatusLabels[item.request.status] || item.request.status, detail: item.request.trackingNumber ? `${item.request.trackingCarrier || "配送"} ${item.request.trackingNumber}` : item.request.brandReply, cancellable: item.request.status === "pending", href: `/lcm/products/${item.productSlug}` }))} onCancel={onCancelSample} /><RequestList title="卸商談" icon={<Building2 className="h-5 w-5" />} items={wholesale.map((item: any) => ({ id: item.inquiry.id, code: item.inquiry.inquiryCode, product: item.productName, brand: item.brandName, status: item.inquiry.status, statusLabel: wholesaleStatusLabels[item.inquiry.status] || item.inquiry.status, detail: item.inquiry.negotiatedTerms || item.inquiry.brandReply || `${item.inquiry.requestedQuantity}点を希望`, cancellable: ["requested", "reviewing"].includes(item.inquiry.status), href: `/lcm/products/${item.productSlug}` }))} onCancel={onCancelWholesale} /></div>}</main></LcmPublicLayout>;
}

function RequestList({ title, icon, items, onCancel }: { title: string; icon: React.ReactNode; items: any[]; onCancel: (id: number) => void }) {
  return <section><div className="flex items-center gap-2 border-b border-black/20 pb-3"><span className="text-[#d45b16]">{icon}</span><h2 className="text-xl font-black">{title}</h2><span className="ml-auto text-sm font-black text-black/40">{items.length}</span></div><div className="mt-4 grid gap-3">{items.map((item) => <article key={item.id} className="border border-black/15 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.1em] text-black/40">{item.code}</p><Link href={item.href} className="mt-1 block font-black hover:underline">{item.product}</Link><p className="mt-1 text-xs text-black/50">{item.brand}</p></div><span className="shrink-0 bg-[#eeeae0] px-2.5 py-1 text-[11px] font-black">{item.statusLabel}</span></div>{item.detail && <p className="mt-4 border-t border-black/10 pt-3 text-xs leading-6 text-black/60">{item.detail}</p>}{item.cancellable && <button type="button" onClick={() => onCancel(item.id)} className="mt-3 inline-flex items-center text-xs font-black text-red-700"><X className="mr-1 h-3.5 w-3.5" />取り消す</button>}</article>)}{items.length === 0 && <div className="border border-dashed border-black/20 bg-white p-7 text-center text-sm text-black/45">まだありません。</div>}</div></section>;
}

function BrandRequestInbox({ data, isLoading, onSampleStatus, onWholesaleStatus }: { data: any; isLoading: boolean; onSampleStatus: (payload: any) => void; onWholesaleStatus: (payload: any) => void }) {
  const samples = data?.samples || []; const wholesale = data?.wholesale || [];
  const sampleActions: Record<string, Array<[string, string]>> = { pending: [["approved", "承認"], ["rejected", "見送り"]], approved: [["preparing", "発送準備へ"]], preparing: [["shipped", "発送済みにする"]], shipped: [["delivered", "受取済みにする"]], delivered: [["live_scheduled", "配信予定へ"], ["completed", "完了"]], live_scheduled: [["completed", "完了"]] };
  const wholesaleActions: Record<string, Array<[string, string]>> = { requested: [["reviewing", "確認を開始"], ["accepted", "承認"], ["declined", "見送り"]], reviewing: [["accepted", "承認"], ["declined", "見送り"]], accepted: [["negotiating", "条件調整へ"], ["completed", "完了"]], negotiating: [["completed", "完了"], ["declined", "見送り"]] };
  const submitSampleStatus = (id: number, status: string) => { const brandReply = status === "rejected" ? window.prompt("見送り理由を入力してください") : null; if (status === "rejected" && !brandReply) return; const trackingCarrier = status === "shipped" ? window.prompt("配送会社を入力してください") : null; if (status === "shipped" && !trackingCarrier) return; const trackingNumber = status === "shipped" ? window.prompt("追跡番号を入力してください") : null; if (status === "shipped" && !trackingNumber) return; onSampleStatus({ id, status, brandReply, trackingCarrier, trackingNumber, liveUrl: null }); };
  const submitWholesaleStatus = (id: number, status: string) => { const brandReply = status === "declined" ? window.prompt("見送り理由を入力してください") : null; if (status === "declined" && !brandReply) return; const negotiatedTerms = ["negotiating", "completed"].includes(status) ? window.prompt("合意・調整中の条件を入力してください（任意）") : null; onWholesaleStatus({ id, status, brandReply, negotiatedTerms }); };
  return <LcmPublicLayout><main className="mx-auto max-w-7xl px-5 py-10 md:py-16"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">BRAND REQUESTS</p><h1 className="mt-2 text-4xl font-black">サンプル・卸商談管理</h1></div><Link href="/lcm/manage" className="border border-black px-4 py-3 text-sm font-black">ブランド管理へ</Link></div>{isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <div className="mt-8 grid gap-10"><section><h2 className="flex items-center gap-2 text-2xl font-black"><Truck className="h-6 w-6 text-[#d45b16]" />サンプル申請 <span className="text-sm text-black/35">{samples.length}</span></h2><div className="mt-4 grid gap-3">{samples.map((item: any) => <article key={item.request.id} className="grid gap-4 border border-black/15 bg-white p-5 md:grid-cols-[1fr_auto]"><div><p className="text-[10px] font-black tracking-[0.1em] text-black/40">{item.request.requestCode}｜{item.requesterType}</p><h3 className="mt-1 text-lg font-black">{item.productName}</h3><p className="mt-2 text-sm">申請者：{item.requesterName}</p><p className="mt-2 text-xs leading-6 text-black/60">{item.request.purpose}</p><p className="mt-2 text-xs text-black/45">配送先：{item.request.postalCode} {item.request.address}／{item.request.recipientName}／{item.request.phone}</p></div><div className="min-w-44"><span className="inline-flex bg-[#eeeae0] px-2.5 py-1 text-[11px] font-black">{sampleStatusLabels[item.request.status] || item.request.status}</span><div className="mt-3 grid gap-2">{(sampleActions[item.request.status] || []).map(([status, label]) => <button key={status} type="button" onClick={() => submitSampleStatus(item.request.id, status)} className={status === "rejected" ? "border border-red-300 px-3 py-2 text-xs font-black text-red-700" : "bg-[#171714] px-3 py-2 text-xs font-black text-white"}>{label}</button>)}</div></div></article>)}{samples.length === 0 && <div className="border border-dashed border-black/20 bg-white p-7 text-center text-sm text-black/45">サンプル申請はまだありません。</div>}</div></section><section><h2 className="flex items-center gap-2 text-2xl font-black"><Building2 className="h-6 w-6 text-[#d45b16]" />卸商談 <span className="text-sm text-black/35">{wholesale.length}</span></h2><div className="mt-4 grid gap-3">{wholesale.map((item: any) => <article key={item.inquiry.id} className="grid gap-4 border border-black/15 bg-white p-5 md:grid-cols-[1fr_auto]"><div><p className="text-[10px] font-black tracking-[0.1em] text-black/40">{item.inquiry.inquiryCode}｜{item.requesterType}</p><h3 className="mt-1 text-lg font-black">{item.productName}</h3><p className="mt-2 text-sm">申請者：{item.requesterName}／希望数量：{item.inquiry.requestedQuantity}点</p><p className="mt-2 text-xs leading-6 text-black/60">{item.inquiry.intendedUse}</p></div><div className="min-w-44"><span className="inline-flex bg-[#eeeae0] px-2.5 py-1 text-[11px] font-black">{wholesaleStatusLabels[item.inquiry.status] || item.inquiry.status}</span><div className="mt-3 grid gap-2">{(wholesaleActions[item.inquiry.status] || []).map(([status, label]) => <button key={status} type="button" onClick={() => submitWholesaleStatus(item.inquiry.id, status)} className={status === "declined" ? "border border-red-300 px-3 py-2 text-xs font-black text-red-700" : "bg-[#171714] px-3 py-2 text-xs font-black text-white"}>{label}</button>)}</div></div></article>)}{wholesale.length === 0 && <div className="border border-dashed border-black/20 bg-white p-7 text-center text-sm text-black/45">卸商談はまだありません。</div>}</div></section></div>}</main></LcmPublicLayout>;
}

function BrandReviewInbox({ data, isLoading, brandId, onReport }: { data: any; isLoading: boolean; brandId: number; onReport: (reviewId: number, details: string) => void }) {
  const reviews = data?.reviews || [];
  const reports = data?.reports || [];
  const reportByReview = new Map(reports.map((report: any) => [Number(report.reviewId), report]));
  return <LcmPublicLayout><main className="mx-auto max-w-6xl px-5 py-10 md:py-16"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">VERIFIED REVIEWS</p><h1 className="mt-2 text-4xl font-black">商品レビュー確認</h1><p className="mt-3 text-sm leading-7 text-black/55">ブランドはレビューを削除できません。事実誤認や個人情報がある場合は、理由を添えて運営へ報告してください。</p></div><Link href={`/lcm/manage?brand=${brandId}&workspace=brand`} className="border border-black px-4 py-3 text-sm font-black">ブランド管理へ</Link></div>{isLoading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : <div className="mt-8 grid gap-4">{reviews.map((item: any) => { const review = item.review; const report = reportByReview.get(Number(review.id)) as any; return <article key={review.id} className="border border-black/15 bg-white p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black text-black/45">{item.productName}</p><div className="mt-2 flex items-center gap-2"><span className="flex">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`h-4 w-4 ${value <= review.rating ? "fill-[#f7cc35] text-[#9b6200]" : "text-black/15"}`} />)}</span><span className="bg-[#e8f5ef] px-2 py-1 text-[9px] font-black text-[#126445]"><ShieldCheck className="mr-1 inline h-3 w-3" />{review.verificationSource === "sample_request" ? "サンプル受取確認済み" : "取引確認済み"}</span></div><h2 className="mt-3 text-xl font-black">{review.title}</h2></div><span className="bg-[#eeeae0] px-2.5 py-1 text-[10px] font-black">{statusLabels[review.status] || review.status}</span></div><p className="mt-4 whitespace-pre-line text-sm leading-7 text-black/65">{review.body}</p><p className="mt-4 text-xs font-bold text-black/45">投稿者：{item.reviewerName}・{item.reviewerType === "liver" ? "ライブコマーサー" : "LCM会員"}</p>{report ? <div className="mt-4 border-l-4 border-[#f7cc35] bg-[#fff8dd] p-4 text-xs leading-6"><p className="font-black">運営へ報告済み：{report.status === "open" ? "確認中" : report.status === "resolved" ? "対応済み" : "棄却"}</p>{report.resolutionNote && <p className="mt-1 text-black/55">{report.resolutionNote}</p>}</div> : review.status === "published" && <button type="button" onClick={() => { const details = window.prompt("事実と異なる点、個人情報、その他の問題を具体的に入力してください"); if (details?.trim()) onReport(Number(review.id), details.trim()); }} className="mt-4 inline-flex items-center border border-black px-4 py-2.5 text-xs font-black"><Flag className="mr-1.5 h-4 w-4" />運営へ報告</button>}</article>; })}{reviews.length === 0 && <div className="border border-dashed border-black/20 bg-white p-9 text-center"><Star className="mx-auto h-8 w-8 text-black/20" /><p className="mt-3 font-black">レビューはまだありません</p><p className="mt-2 text-xs text-black/45">実利用者が投稿し、運営確認を通過したレビューが表示されます。</p></div>}</div>}</main></LcmPublicLayout>;
}

function CatalogLinkDirectory({ initialPage, pending, onClaim, onCreate }: { initialPage: number | null; pending: boolean; onClaim: (page: number, scope: "brand" | "company") => void; onCreate: () => void }) {
  const initialIdentity = initialPage ? getLcmCatalogIdentity(initialPage) : undefined;
  const [query, setQuery] = useState(initialIdentity?.brandName || initialIdentity?.companyName || "");
  const companies = useMemo(() => {
    const companyMap = new Map<string, { companyName: string; brands: Array<{ identity: (typeof lcmCatalogIdentities)[number]; products: Array<{ page: number; name: string; thumbnailUrl: string }> }> }>();
    for (const identity of lcmCatalogIdentities) {
      if (identity.page !== identity.primaryBrandPage) continue;
      const products = getLcmCatalogBrandPages(identity.primaryBrandPage).flatMap((page) => {
        const record = lcf2026ExhibitorCatalogPages.find((item) => item.page === page && item.pageType === "出展企業紹介");
        return record ? [{ page, name: record.productTitle, thumbnailUrl: record.thumbnailUrl }] : [];
      });
      const key = normalizeLcmCatalogName(identity.companyName);
      const company = companyMap.get(key) || { companyName: identity.companyName, brands: [] };
      company.brands.push({ identity, products });
      companyMap.set(key, company);
    }
    return [...companyMap.values()];
  }, []);
  const normalizedQuery = normalizeLcmCatalogName(query);
  const filtered = companies.filter((company) => !normalizedQuery || normalizeLcmCatalogName([company.companyName, ...company.brands.flatMap((brand) => [brand.identity.brandName, ...brand.products.map((product) => product.name)])].join(" ")).includes(normalizedQuery));
  return <section>
    <p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">CONNECT EXISTING COMPANY / BRAND</p>
    <h2 className="mt-2 text-3xl font-black md:text-4xl">既存の会社・ブランドと連携する</h2>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-black/60">第1回LCFに掲載された会社名・ブランド名・商品名を検索できます。カードをタップすると掲載実績を確認できます。既存掲載ブランドとの連携は、第三者による権限取得を防ぐため運営が管理権限を確認します。検索しても見つからない新しいブランドは、公式LINEから登録を申請してください。</p>
    <label className="relative mt-6 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="会社名・ブランド名・商品名で検索" className="h-14 w-full border border-black/20 bg-white pl-12 pr-4 text-sm font-bold outline-none focus:border-black" /></label>
    <div className="mt-6 grid gap-4">
      {filtered.map((company) => <article key={company.companyName} role="link" tabIndex={0} onClick={() => window.location.assign(`/lcm/brands/catalog-${company.brands[0].identity.primaryBrandPage}`)} onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") window.location.assign(`/lcm/brands/catalog-${company.brands[0].identity.primaryBrandPage}`); }} className="cursor-pointer border border-black/15 bg-white p-5 transition hover:border-black md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/10 pb-4"><div><p className="text-[10px] font-black tracking-[0.15em] text-[#9b6200]">COMPANY</p><h3 className="mt-1 text-xl font-black">{company.companyName}</h3><p className="mt-1 text-xs text-black/45">{company.brands.length}ブランド｜タップして掲載実績を見る</p></div><button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); onClaim(company.brands[0].identity.primaryBrandPage, "company"); }} className="inline-flex items-center bg-[#171714] px-4 py-3 text-xs font-black text-white disabled:opacity-50"><FolderTree className="mr-2 h-4 w-4" />この会社と仮連携</button></div>
        <div className="mt-4 grid gap-3">{company.brands.map((brand) => <div key={brand.identity.primaryBrandPage} role="link" tabIndex={0} onClick={(event) => { event.stopPropagation(); window.location.assign(`/lcm/brands/catalog-${brand.identity.primaryBrandPage}`); }} onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") { event.stopPropagation(); window.location.assign(`/lcm/brands/catalog-${brand.identity.primaryBrandPage}`); } }} className="grid cursor-pointer gap-3 border border-black/10 bg-[#faf8f2] p-4 transition hover:border-black md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-[10px] font-black tracking-[0.12em] text-black/40">BRAND</p><p className="mt-1 font-black">{brand.identity.brandName}</p><p className="mt-1 text-xs leading-5 text-black/55">{brand.products.map((product) => product.name).join("／")}</p><div className="mt-2 flex flex-wrap gap-2">{brand.products.map((product) => <Link key={product.page} href={`/lcm/brands/catalog-${product.page}`} onClick={(event) => event.stopPropagation()} className="text-[11px] font-bold text-[#9b6200] underline">掲載ページ {product.page}を見る</Link>)}</div></div><button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); onClaim(brand.identity.primaryBrandPage, "brand"); }} className="inline-flex items-center justify-center border border-black bg-white px-4 py-3 text-xs font-black disabled:opacity-50"><Link2 className="mr-2 h-4 w-4" />このブランドと仮連携</button></div>)}</div>
      </article>)}
      {filtered.length === 0 && <div className="border border-dashed border-black/25 bg-white p-8 text-center"><Building2 className="mx-auto h-9 w-9 text-black/20" /><p className="mt-3 font-black">一致する会社・ブランドがありません</p><p className="mt-2 text-xs leading-6 text-black/50">表記を変えて再検索しても見つからない場合は、公式LINEで新規ブランド登録を申請してください。</p><button type="button" onClick={onCreate} className="mt-5 bg-[#f7cc35] px-5 py-3 text-sm font-black">公式LINEで新規登録を申請</button></div>}
    </div>
  </section>;
}

function BrandEditor({ form, setForm, isNew, pending, onUpload, onSave }: { form: BrandForm; setForm: React.Dispatch<React.SetStateAction<BrandForm>>; isNew: boolean; pending: boolean; onUpload: (file: File, kind: "logoUrl" | "coverUrl") => Promise<void>; onSave: () => void }) {
  const set = (key: keyof BrandForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return <section><div className="flex items-center justify-between"><div><p className="text-xs font-black tracking-[0.16em] text-black/45">BRAND EDITOR</p><h2 className="mt-1 text-3xl font-black">{isNew ? "ブランドを作成" : "ブランド情報を編集"}</h2></div></div><div className="mt-7 grid gap-5 border border-black/15 bg-white p-5 md:grid-cols-2 md:p-7"><Field label="ブランド名"><input value={form.displayName} onChange={(event) => set("displayName", event.target.value)} required className={inputClass()} /></Field><Field label="会社名"><input value={form.companyName} onChange={(event) => set("companyName", event.target.value)} className={inputClass()} /></Field><Field label="カテゴリ"><input value={form.category} onChange={(event) => set("category", event.target.value)} placeholder="美容・コスメ" className={inputClass()} /></Field><Field label="キャッチコピー"><input value={form.tagline} onChange={(event) => set("tagline", event.target.value)} className={inputClass()} /></Field><div className="md:col-span-2"><Field label="ブランド紹介"><textarea value={form.description} onChange={(event) => set("description", event.target.value)} className={textareaClass()} /></Field></div><div className="md:col-span-2"><Field label="ブランドストーリー"><textarea value={form.story} onChange={(event) => set("story", event.target.value)} className={textareaClass()} /></Field></div>{!isNew && <><ImageField label="ロゴ画像" value={form.logoUrl} onUpload={(file) => onUpload(file, "logoUrl")} /><ImageField label="カバー画像" value={form.coverUrl} onUpload={(file) => onUpload(file, "coverUrl")} /></>}<Field label="公式サイト"><input type="url" value={form.officialWebsiteUrl} onChange={(event) => set("officialWebsiteUrl", event.target.value)} className={inputClass()} /></Field><Field label="TikTok Shop"><input type="url" value={form.tiktokShopUrl} onChange={(event) => set("tiktokShopUrl", event.target.value)} className={inputClass()} /></Field><Field label="Amazon"><input type="url" value={form.amazonUrl} onChange={(event) => set("amazonUrl", event.target.value)} className={inputClass()} /></Field><Field label="楽天"><input type="url" value={form.rakutenUrl} onChange={(event) => set("rakutenUrl", event.target.value)} className={inputClass()} /></Field><div className="md:col-span-2"><button type="button" disabled={pending} onClick={onSave} className="inline-flex items-center bg-[#171714] px-6 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="mr-2 h-4 w-4" />{isNew ? "下書きを作成" : "保存する"}</button></div></div></section>;
}

function ImageField({ label, value, onUpload }: { label: string; value: string; onUpload: (file: File) => void }) {
  return <Field label={label} note="JPEG・PNG・WebP、5MB以下"><div className="flex items-center gap-3">{value ? <img src={value} alt="" className="h-16 w-16 border border-black/15 object-cover" /> : <div className="grid h-16 w-16 place-items-center bg-[#eeeae0]"><ImagePlus className="h-5 w-5 text-black/25" /></div>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); }} className="min-w-0 text-xs" /></div></Field>;
}

function ProductEditor({ form, setForm, editing, pending, onUpload, onCancel, onSave }: { form: ProductForm; setForm: React.Dispatch<React.SetStateAction<ProductForm>>; editing: boolean; pending: boolean; onUpload: (file: File) => Promise<string>; onCancel: () => void; onSave: () => void }) {
  const [step, setStep] = useState(1);
  const set = (key: keyof ProductForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const readiness = productReadiness(form);
  const steps = ["写真・基本", "商品の魅力", "販売先", "サンプル", "取引条件"];
  const uploadPrimary = async (file: File) => {
    const url = await onUpload(file);
    setForm((current) => ({ ...current, primaryImageUrl: url, imageUrls: [...new Set([url, ...current.imageUrls])] }));
  };
  const uploadGallery = async (file: File) => {
    if (form.imageUrls.length >= 10) return toast.error("商品画像は最大10枚です");
    const url = await onUpload(file);
    setForm((current) => ({ ...current, imageUrls: [...new Set([...current.imageUrls, url])].slice(0, 10) }));
  };
  return <section className="mt-6 overflow-hidden border border-black/15 bg-white">
    <div className="grid gap-5 border-b border-black/10 bg-[#171714] p-5 text-white md:grid-cols-[1fr_280px] md:items-center md:p-7"><div><p className="text-xs font-black tracking-[0.16em] text-[#f7cc35]">PRODUCT EDITOR</p><h3 className="mt-2 text-2xl font-black">{editing ? "商品を編集" : "商品を追加"}</h3><p className="mt-2 text-xs leading-6 text-white/55">途中でも下書き保存できます。商品名・カテゴリ・概要・定価・メイン写真が揃うと、事前審査なしで公開できます。</p></div><div><div className="flex items-center justify-between text-xs font-black"><span>公開準備 {readiness.completed}/5</span><span>{readiness.percent}%</span></div><div className="mt-2 h-2 bg-white/15"><div className={`h-full ${readiness.ready ? "bg-[#16805b]" : "bg-[#f7cc35]"}`} style={{ width: `${readiness.percent}%` }} /></div></div></div>
    <nav className="flex overflow-x-auto border-b border-black/10 bg-[#f6f4ee]" aria-label="商品登録ステップ">{steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index + 1)} aria-current={step === index + 1 ? "step" : undefined} className={`min-w-[132px] flex-1 border-r border-black/10 px-3 py-4 text-left text-xs font-black ${step === index + 1 ? "bg-[#f7cc35] text-black" : "text-black/50 hover:bg-white"}`}><span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full border border-current text-[10px]">{index + 1}</span>{label}</button>)}</nav>
    <div className="p-5 md:p-7">
      {step === 1 && <div className="grid gap-6 lg:grid-cols-[minmax(260px,.8fr)_1.2fr]"><div><p className="text-xs font-black tracking-[0.14em] text-[#9b6200]">MAIN VISUAL</p><div className="mt-3 aspect-square overflow-hidden border border-black/15 bg-[#eeeae0]">{form.primaryImageUrl ? <LcmProductImage src={form.primaryImageUrl} alt="登録中商品のメイン写真" loading="eager" className="h-full w-full object-contain p-3" /> : <div className="grid h-full place-items-center text-center text-sm font-black text-black/35"><ImagePlus className="mb-3 h-10 w-10" />最初に商品写真を登録</div>}</div><label className="mt-3 flex cursor-pointer items-center justify-center border border-black bg-white px-4 py-3 text-sm font-black"><ImagePlus className="mr-2 h-4 w-4" />メイン写真を選ぶ<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadPrimary(file); event.currentTarget.value = ""; }} /></label><p className="mt-2 text-[11px] leading-5 text-black/45">JPEG・PNG・WebP、5MB以下。商品全体が分かる正面写真がおすすめです。</p></div><div className="grid content-start gap-5 md:grid-cols-2"><div className="md:col-span-2"><Field label="商品名（公開必須）"><input value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="正式な商品名" className={inputClass()} /></Field></div><Field label="カテゴリ（公開必須）"><input value={form.category} onChange={(event) => set("category", event.target.value)} placeholder="美容・コスメ" className={inputClass()} /></Field><Field label="SKU・管理番号"><input value={form.sku} onChange={(event) => set("sku", event.target.value)} placeholder="社内管理用・公開されません" className={inputClass()} /></Field><Field label="定価／参考小売価格（公開必須）" note="公開マーケットへ表示されます"><div className="relative"><BadgeJapaneseYen className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" /><input type="number" min="0" value={form.listPrice} onChange={(event) => set("listPrice", event.target.value)} className={`${inputClass()} pl-10`} /></div></Field><Field label="税区分"><select value={form.taxMode} onChange={(event) => set("taxMode", event.target.value)} className={inputClass()}><option value="included">税込</option><option value="excluded">税別</option><option value="unknown">未設定</option></select></Field><div className="md:col-span-2"><p className="text-xs font-black tracking-[0.12em] text-black/55">商品ギャラリー</p><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">{form.imageUrls.map((url, index) => <div key={url} className="group relative aspect-square border border-black/15 bg-white"><LcmProductImage src={url} alt={`登録中の商品画像${index + 1}`} className="h-full w-full object-contain p-1" /><button type="button" onClick={() => setForm((current) => ({ ...current, primaryImageUrl: url }))} className="absolute bottom-1 left-1 bg-black/80 px-1.5 py-1 text-[9px] font-black text-white">{form.primaryImageUrl === url ? "メイン" : "メインにする"}</button><button type="button" onClick={() => setForm((current) => ({ ...current, imageUrls: current.imageUrls.filter((item) => item !== url), primaryImageUrl: current.primaryImageUrl === url ? current.imageUrls.find((item) => item !== url) || "" : current.primaryImageUrl }))} aria-label={`商品画像${index + 1}を削除`} className="absolute right-1 top-1 grid h-6 w-6 place-items-center bg-white text-black shadow"><X className="h-3.5 w-3.5" /></button></div>)}<label className="grid aspect-square cursor-pointer place-items-center border border-dashed border-black/30 bg-[#faf9f5] text-center text-[10px] font-black text-black/45"><ImagePlus className="mb-1 h-5 w-5" />画像追加<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadGallery(file); event.currentTarget.value = ""; }} /></label></div></div></div></div>}
      {step === 2 && <div className="grid gap-5"><div><p className="text-xs font-black tracking-[0.14em] text-[#9b6200]">PRODUCT STORY</p><h4 className="mt-1 text-xl font-black">ライブで伝わる商品情報</h4><p className="mt-2 text-xs leading-6 text-black/50">4つの配信情報は商品詳細へ固定表示されます。未入力時はLCMが内容を推測せず「準備中」と表示します。</p></div><Field label="商品概要（公開必須）" note="一覧カードと商品詳細の最初に表示されます"><textarea value={form.summary} onChange={(event) => set("summary", event.target.value)} placeholder="誰に、どんな価値がある商品かを短く入力" className={textareaClass()} /></Field><Field label="配信で伝えやすいポイント" note="1行に1つ、最大8件。特徴やおすすめの使い方など"><textarea value={form.highlightsText} onChange={(event) => set("highlightsText", event.target.value)} placeholder={"例：朝の一杯に取り入れやすい\n例：使用感を画面で伝えやすい"} className={textareaClass()} /></Field><div className="grid gap-5 md:grid-cols-2"><Field label="30秒で伝えるポイント" note="冒頭で話す短いセールスポイント"><textarea value={form.thirtySecondPitch} onChange={(event) => set("thirtySecondPitch", event.target.value)} placeholder="誰の、どんな悩みを、どう解決する商品か" className={textareaClass()} /></Field><Field label="実演方法" note="ライブ中の見せ方・使用手順"><textarea value={form.demoInstructions} onChange={(event) => set("demoInstructions", event.target.value)} placeholder="開封、使用前後、香り・質感の伝え方など" className={textareaClass()} /></Field><Field label="想定視聴者" note="年齢ではなく悩み・利用場面を具体化"><textarea value={form.targetAudience} onChange={(event) => set("targetAudience", event.target.value)} placeholder="例：忙しい朝でも手軽にケアしたい方" className={textareaClass()} /></Field><Field label="NG表現・注意事項" note="薬機法、誇大表現、禁忌、使用上の注意"><textarea value={form.prohibitedClaims} onChange={(event) => set("prohibitedClaims", event.target.value)} placeholder="使用禁止表現、必ず添える注意事項など" className={textareaClass()} /></Field></div><Field label="詳しい商品説明"><textarea value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="成分、使用方法、開発背景、ターゲットなど" className="min-h-44 w-full border border-black/20 bg-white px-3 py-3 text-sm leading-7 outline-none focus:border-black" /></Field></div>}
      {step === 3 && <div><p className="text-xs font-black tracking-[0.14em] text-[#9b6200]">SALES CHANNELS</p><h4 className="mt-1 text-xl font-black">購入先・公式ページ</h4><p className="mt-2 text-xs leading-6 text-black/50">公開商品ページから外部の正規販売先へ案内します。HTTPS URLのみ登録できます。</p><div className="mt-6 grid gap-5 md:grid-cols-2"><Field label="公式商品ページ"><input type="url" value={form.officialProductUrl} onChange={(event) => set("officialProductUrl", event.target.value)} className={inputClass()} /></Field><Field label="TikTok Shop"><input type="url" value={form.tiktokShopUrl} onChange={(event) => set("tiktokShopUrl", event.target.value)} className={inputClass()} /></Field><Field label="Amazon"><input type="url" value={form.amazonUrl} onChange={(event) => set("amazonUrl", event.target.value)} className={inputClass()} /></Field><Field label="楽天"><input type="url" value={form.rakutenUrl} onChange={(event) => set("rakutenUrl", event.target.value)} className={inputClass()} /></Field></div></div>}
      {step === 4 && <div><p className="text-xs font-black tracking-[0.14em] text-[#16805b]">SAMPLE</p><h4 className="mt-1 text-xl font-black">サンプル提供</h4><label className="mt-6 flex items-center gap-3 border border-[#16805b]/30 bg-[#eff8f3] p-5 text-sm font-black"><input type="checkbox" checked={form.sampleAvailable} onChange={(event) => set("sampleAvailable", event.target.checked)} className="h-5 w-5" />ライブコマーサーからのサンプル申請を受け付ける</label><div className="mt-5 grid gap-5 md:grid-cols-2"><Field label="月間サンプル上限" note="受付する場合は必須"><input type="number" min="1" disabled={!form.sampleAvailable} value={form.sampleMonthlyLimit} onChange={(event) => set("sampleMonthlyLimit", event.target.value)} className={inputClass()} /></Field><div className="md:col-span-2"><Field label="サンプル対象・提供条件" note="この詳細は承認済みLCM会員だけに表示されます"><textarea disabled={!form.sampleAvailable} value={form.sampleInstructions} onChange={(event) => set("sampleInstructions", event.target.value)} placeholder="対象者、予定本数、返却要否、配信期限など" className={textareaClass()} /></Field></div></div></div>}
      {step === 5 && <div className="-m-5 bg-[#171714] p-5 text-white md:-m-7 md:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[0.14em] text-[#f7cc35]">MEMBER ONLY</p><h4 className="mt-1 text-xl font-black">会員限定の取引条件</h4><p className="mt-2 max-w-2xl text-xs leading-6 text-white/55">この内容は公開カードや検索結果には表示されません。卸条件を入力する場合は、価格・数量・送料・支払の4項目をすべて設定してください。</p></div><LockKeyhole className="h-7 w-7 shrink-0 text-[#f7cc35]" /></div><div className="mt-6 grid gap-5 md:grid-cols-2"><Field inverse label="会員限定卸価格"><input type="number" min="0" value={form.wholesalePrice} onChange={(event) => set("wholesalePrice", event.target.value)} className={`${inputClass()} text-black`} /></Field><Field inverse label="最小発注数"><input type="number" min="1" value={form.wholesaleMinQuantity} onChange={(event) => set("wholesaleMinQuantity", event.target.value)} className={`${inputClass()} text-black`} /></Field><Field inverse label="送料条件"><textarea value={form.wholesaleShippingTerms} onChange={(event) => set("wholesaleShippingTerms", event.target.value)} className={`${textareaClass()} text-black`} /></Field><Field inverse label="支払条件"><textarea value={form.wholesalePaymentTerms} onChange={(event) => set("wholesalePaymentTerms", event.target.value)} className={`${textareaClass()} text-black`} /></Field><Field inverse label="参考コミッション"><input value={form.commissionRate} onChange={(event) => set("commissionRate", event.target.value)} placeholder="例：売上の20%" className={`${inputClass()} text-black`} /></Field><Field inverse label="在庫の見せ方"><select value={form.stockDisclosure} onChange={(event) => set("stockDisclosure", event.target.value)} className={`${inputClass()} text-black`}><option value="hidden">非表示</option><option value="range">数量帯で表示</option><option value="exact">正確な数量を表示</option></select></Field>{form.stockDisclosure !== "hidden" && <Field inverse label="在庫数量"><input type="number" min="0" value={form.stockQuantity} onChange={(event) => set("stockQuantity", event.target.value)} className={`${inputClass()} text-black`} /></Field>}</div></div>}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-5"><div className="flex gap-2"><button type="button" disabled={step === 1} onClick={() => setStep((current) => Math.max(1, current - 1))} className="border border-black px-4 py-3 text-xs font-black disabled:opacity-30"><ArrowLeft className="mr-1 inline h-4 w-4" />前へ</button>{step < 5 && <button type="button" onClick={() => setStep((current) => Math.min(5, current + 1))} className="bg-[#f7cc35] px-4 py-3 text-xs font-black">次へ<ArrowRight className="ml-1 inline h-4 w-4" /></button>}</div><div className="flex gap-2"><button type="button" onClick={onCancel} className="border border-black px-5 py-3 text-sm font-black">キャンセル</button><button type="button" disabled={pending || !form.name.trim()} onClick={onSave} className="inline-flex items-center bg-[#171714] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}下書きを保存</button></div></div>
    </div>
  </section>;
}

function productPayload(form: ProductForm) {
  const highlights = form.highlightsText.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8);
  const imageUrls = [...new Set([form.primaryImageUrl, ...form.imageUrls].filter(Boolean))].slice(0, 10);
  return { name: form.name, sku: form.sku || null, category: form.category || null, summary: form.summary || null, description: form.description || null, highlights, thirtySecondPitch: form.thirtySecondPitch || null, demoInstructions: form.demoInstructions || null, targetAudience: form.targetAudience || null, prohibitedClaims: form.prohibitedClaims || null, listPrice: form.listPrice ? Number(form.listPrice) : null, taxMode: form.taxMode, primaryImageUrl: form.primaryImageUrl || null, imageUrls, officialProductUrl: form.officialProductUrl || null, tiktokShopUrl: form.tiktokShopUrl || null, amazonUrl: form.amazonUrl || null, rakutenUrl: form.rakutenUrl || null, sampleAvailable: form.sampleAvailable, sampleMonthlyLimit: form.sampleAvailable && form.sampleMonthlyLimit ? Number(form.sampleMonthlyLimit) : null, sampleInstructions: form.sampleAvailable ? form.sampleInstructions || null : null, wholesalePrice: form.wholesalePrice ? Number(form.wholesalePrice) : null, wholesaleMinQuantity: form.wholesaleMinQuantity ? Number(form.wholesaleMinQuantity) : null, wholesaleShippingTerms: form.wholesaleShippingTerms || null, wholesalePaymentTerms: form.wholesalePaymentTerms || null, commissionRate: form.commissionRate || null, stockDisclosure: form.stockDisclosure, stockQuantity: form.stockDisclosure !== "hidden" && form.stockQuantity ? Number(form.stockQuantity) : null };
}

function productFormFromItem(item: any): ProductForm {
  return { name: item.name || "", sku: item.sku || "", category: item.category || "", summary: item.summary || "", description: item.description || "", highlightsText: (item.highlights || []).join("\n"), thirtySecondPitch: item.thirtySecondPitch || "", demoInstructions: item.demoInstructions || "", targetAudience: item.targetAudience || "", prohibitedClaims: item.prohibitedClaims || "", listPrice: item.listPrice || "", taxMode: item.taxMode || "unknown", primaryImageUrl: item.primaryImageUrl || "", imageUrls: [...new Set([item.primaryImageUrl, ...(item.imageUrls || [])].filter(Boolean))] as string[], officialProductUrl: item.officialProductUrl || "", tiktokShopUrl: item.tiktokShopUrl || "", amazonUrl: item.amazonUrl || "", rakutenUrl: item.rakutenUrl || "", sampleAvailable: Boolean(item.sampleAvailable), sampleMonthlyLimit: item.sampleMonthlyLimit ? String(item.sampleMonthlyLimit) : "", sampleInstructions: item.sampleInstructions || "", wholesalePrice: item.wholesalePrice || "", wholesaleMinQuantity: item.wholesaleMinQuantity ? String(item.wholesaleMinQuantity) : "", wholesaleShippingTerms: item.wholesaleShippingTerms || "", wholesalePaymentTerms: item.wholesalePaymentTerms || "", commissionRate: item.commissionRate || "", stockDisclosure: item.stockDisclosure || "hidden", stockQuantity: item.stockQuantity == null ? "" : String(item.stockQuantity) };
}
