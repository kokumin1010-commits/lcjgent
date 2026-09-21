import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BadgePercent, CalendarDays, LockKeyhole, PackageSearch, Search, Sparkles } from "lucide-react";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { LcmProductImage } from "@/components/lcm/LcmProductImage";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

type PeriodFilter = "current" | "upcoming" | "ended" | "all";

const periodLabels: Record<string, string> = {
  active: "実施中",
  upcoming: "開始前",
  ended: "終了",
  undated: "期間確認中",
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "未設定";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("ja-JP") : "未設定";
}

export default function LcmCampaigns() {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<PeriodFilter>("current");
  const campaigns = trpc.lcm.listPublicCampaigns.useQuery({ limit: 100 }, { retry: false });

  useEffect(() => applyPageSeo({
    title: "キャンペーンを探す｜LCM ライブコマースマーケット",
    description: "ブランド公式のライブコマースキャンペーンから期間と対象商品を比較。成果報酬率・購入者向け割引率・サンプル条件はLCM会員ログイン後に確認できます。",
    canonicalPath: "/lcm/campaigns",
    image: campaigns.data?.[0]?.heroImageUrl || "https://www.livecommercefestival.com/favicon.ico",
    jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", name: "LCM キャンペーン", url: "https://www.livecommercefestival.com/lcm/campaigns" },
  }), [campaigns.data]);

  const filtered = useMemo(() => {
    const normalized = query.normalize("NFKC").toLowerCase();
    return (campaigns.data || []).filter((campaign) => {
      const queryMatch = !normalized || [campaign.title, campaign.summary, campaign.description, campaign.brandName].join(" ").normalize("NFKC").toLowerCase().includes(normalized);
      const periodMatch = period === "all" || (period === "current" ? ["active", "upcoming"].includes(campaign.periodState) : campaign.periodState === period);
      return queryMatch && periodMatch;
    });
  }, [campaigns.data, period, query]);

  return <LcmPublicLayout><main className="min-h-[70vh] bg-[#f4f1e9]">
    <section className="border-b border-black/15 bg-[#171714] text-white">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-12 md:px-8 md:py-16 lg:grid-cols-[1fr_440px] lg:items-end">
        <div><p className="text-xs font-black tracking-[0.22em] text-[#f7cc35]">BRAND CAMPAIGNS</p><h1 className="mt-4 text-[clamp(3rem,7vw,6.6rem)] font-black leading-[.88] tracking-[-.06em]">条件を比べて、<br />売りたい商品を選ぶ。</h1><p className="mt-6 max-w-3xl text-sm font-semibold leading-7 text-white/60 md:text-base">期間と対象商品を一覧で比較できます。成果報酬率・購入者向け割引率・計測方法などの正確な取引条件は、承認済みLCM会員だけに表示します。</p></div>
        <div className="border border-white/15 bg-white/5 p-5"><label htmlFor="campaign-search" className="text-xs font-black tracking-[0.14em] text-white/55">キャンペーン・ブランドを検索</label><div className="relative mt-3"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" /><input id="campaign-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ブランド名、商品テーマから探す" className="h-14 w-full bg-white pl-12 pr-4 text-sm font-bold text-black outline-none ring-[#f7cc35] focus:ring-4" /></div><div className="mt-4 grid grid-cols-3 gap-px bg-white/15 text-center"><div className="bg-[#171714] p-3"><p className="text-2xl font-black text-[#f7cc35]">{campaigns.data?.filter((item) => item.periodState === "active").length || 0}</p><p className="text-[10px] font-bold text-white/45">実施中</p></div><div className="bg-[#171714] p-3"><p className="text-2xl font-black">{campaigns.data?.filter((item) => item.periodState === "upcoming").length || 0}</p><p className="text-[10px] font-bold text-white/45">開始前</p></div><div className="bg-[#171714] p-3"><p className="text-2xl font-black">{campaigns.data?.length || 0}</p><p className="text-[10px] font-bold text-white/45">公開中</p></div></div></div>
      </div>
    </section>

    <section className="mx-auto max-w-[1440px] px-5 py-10 md:px-8 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-black/20 pb-5"><div><p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">SELECT A CAMPAIGN</p><h2 className="mt-2 text-3xl font-black md:text-5xl">ブランド公式の募集条件</h2></div><div className="flex flex-wrap gap-2">{([['current', '実施中・開始前'], ['upcoming', '開始前'], ['ended', '終了'], ['all', 'すべて']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`border px-3 py-2 text-xs font-black ${period === value ? "border-black bg-black text-white" : "border-black/15 bg-white"}`}>{label}</button>)}</div></div>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((campaign) => <article key={campaign.id} className="group flex min-w-0 flex-col border border-black/15 bg-white transition hover:-translate-y-0.5 hover:border-black hover:shadow-[6px_6px_0_rgba(0,0,0,.12)]"><Link href={`/lcm/campaigns/${campaign.slug}`} className="block"><div className="relative aspect-[16/9] overflow-hidden bg-[#eeeae0]"><LcmProductImage src={campaign.heroImageUrl} alt={`${campaign.title}のキャンペーン画像`} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" /><span className={`absolute left-3 top-3 px-2.5 py-1 text-[10px] font-black ${campaign.periodState === "active" ? "bg-[#16805b] text-white" : campaign.periodState === "upcoming" ? "bg-[#f7cc35] text-black" : "bg-black/75 text-white"}`}>{periodLabels[campaign.periodState] || campaign.periodState}</span></div><div className="p-5"><p className="text-[11px] font-black text-[#9b6200]">{campaign.brandName}</p><h3 className="mt-2 text-2xl font-black leading-tight">{campaign.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-7 text-black/55">{campaign.summary || campaign.description || "キャンペーン詳細を見る"}</p><div className="mt-5 grid grid-cols-2 gap-px bg-black/10 text-xs"><div className="bg-[#f8f6f0] p-3"><CalendarDays className="mb-2 h-4 w-4 text-[#d45b16]" /><p className="font-black">{formatDate(campaign.startsAt)}</p><p className="mt-1 text-[10px] text-black/45">〜 {formatDate(campaign.endsAt)}</p></div><div className="bg-[#f8f6f0] p-3"><PackageSearch className="mb-2 h-4 w-4 text-[#16805b]" /><p className="font-black">対象 {campaign.productCount}商品</p><p className="mt-1 text-[10px] text-black/45">商品から選品</p></div></div></div></Link><div className="mt-auto border-t border-black/10 p-4"><div className="flex items-center justify-between gap-3"><span className="inline-flex items-center text-xs font-black"><LockKeyhole className="mr-1.5 h-4 w-4" />報酬・割引率は会員限定</span><Link href={`/lcm/campaigns/${campaign.slug}`} className="inline-flex items-center bg-[#171714] px-3 py-2 text-xs font-black text-white">詳細<ArrowRight className="ml-1 h-4 w-4" /></Link></div></div></article>)}
      </div>
      {!campaigns.isLoading && filtered.length === 0 && <div className="mt-8 border border-dashed border-black/25 bg-white p-12 text-center"><Sparkles className="mx-auto h-9 w-9 text-black/20" /><p className="mt-3 font-black">条件に合うキャンペーンはありません</p><p className="mt-2 text-xs leading-6 text-black/45">期間または検索語を変更してください。</p></div>}
      <div className="mt-10 border border-[#f7cc35] bg-[#fff7d8] p-5 md:p-7"><div className="flex items-start gap-4"><BadgePercent className="mt-1 h-7 w-7 shrink-0 text-[#9b6200]" /><div><h2 className="text-xl font-black">表示される率は、ブランドが登録した募集条件です</h2><p className="mt-2 text-sm leading-7 text-black/60">LCMが成果報酬・値引きを自動計算、支払、保証する機能ではありません。対象売上、計測方法、取消・返品、税込・税抜、支払時期などはキャンペーン詳細とブランドとの最終合意を確認してください。</p></div></div></div>
    </section>
  </main></LcmPublicLayout>;
}
