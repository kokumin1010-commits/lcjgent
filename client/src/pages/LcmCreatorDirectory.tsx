/**
 * LCM creator directory: bright trade-show discovery with factual, consented profiles only.
 * Search hierarchy prioritizes category, content format and current offer availability.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Search, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

const categories = ["すべて", "美容・コスメ", "食品", "健康", "ファッション", "生活用品", "家電"];
const ogImage = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/BLOPdduPHOZbYSVM.jpg";
const followerLabels: Record<string, string> = { not_disclosed: "非公開", under_1k: "1,000未満", "1k_10k": "1,000〜1万", "10k_50k": "1万〜5万", "50k_100k": "5万〜10万", "100k_500k": "10万〜50万", "500k_plus": "50万以上" };

export default function LcmCreatorDirectory() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("すべて");
  const [contentType, setContentType] = useState<"all" | "live" | "short_video">("all");
  const [agencyType, setAgencyType] = useState<"all" | "agency" | "independent">("all");
  const [acceptingOnly, setAcceptingOnly] = useState(false);
  const creators = trpc.lcm.listPublicCreators.useQuery({
    query: query.trim() || undefined,
    category: category === "すべて" ? undefined : category,
    contentType: contentType === "all" ? undefined : contentType,
    agencyType: agencyType === "all" ? undefined : agencyType,
    acceptingOffers: acceptingOnly ? true : undefined,
    limit: 100,
  }, { retry: false });

  useEffect(() => applyPageSeo({
    title: "ライバーを探す｜LCM ライブコマースマーケット",
    description: "本人の公開同意とLCM運営確認を経たライバー公式プロフィールを、得意カテゴリ・配信形式・所属から検索できます。",
    canonicalPath: "/lcm/creators",
    image: ogImage,
    jsonLd: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "LCM ライバーディレクトリ", url: "https://www.livecommercefestival.com/lcm/creators", description: "公開同意・運営確認済みライバーの公式プロフィール一覧" }],
  }), []);

  const count = creators.data?.length ?? 0;
  const itemList = useMemo(() => creators.data?.map((creator, index) => ({ "@type": "ListItem", position: index + 1, url: `https://www.livecommercefestival.com/lcm/creators/${creator.slug}`, name: creator.displayName })) || [], [creators.data]);
  useEffect(() => {
    if (!itemList.length) return;
    return applyPageSeo({ title: "ライバーを探す｜LCM ライブコマースマーケット", description: "本人の公開同意とLCM運営確認を経たライバー公式プロフィールを検索できます。", canonicalPath: "/lcm/creators", image: ogImage, jsonLd: [{ "@context": "https://schema.org", "@type": "ItemList", itemListElement: itemList }] });
  }, [itemList]);

  return <LcmPublicLayout><main>
    <section className="border-b border-black/15 bg-[#171714] px-5 py-14 text-white md:px-8 md:py-20"><div className="mx-auto max-w-[1440px]"><p className="text-xs font-black tracking-[0.22em] text-[#f7cc35]">CREATOR DIRECTORY</p><div className="mt-4 grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end"><div><h1 className="max-w-5xl text-5xl font-black leading-[0.96] tracking-[-0.05em] md:text-7xl">商品を売る力と、<br />出会う。</h1><p className="mt-6 max-w-2xl text-sm leading-7 text-white/65 md:text-base">本人が管理し、公開に同意したプロフィールだけを掲載。得意カテゴリ、LIVE・ショート動画、事務所所属から商談候補を探せます。</p></div><div className="border border-white/15 bg-white/5 p-5"><div className="flex items-center gap-3"><ShieldMark /><div><p className="text-xs font-black tracking-[0.12em] text-white/45">PUBLICATION POLICY</p><p className="mt-1 text-sm font-bold">本人同意＋運営確認後に公開</p></div></div><p className="mt-4 text-xs leading-6 text-white/55">メール、電話、住所、申込原文は公開しません。実績は本人申告と確認済みを区別します。</p></div></div></div></section>

    <section className="px-5 py-8 md:px-8"><div className="mx-auto max-w-[1440px]"><div className="border border-black/15 bg-white p-4 md:p-5"><div className="grid gap-3 lg:grid-cols-[1fr_repeat(3,180px)_auto]"><label className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-black/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="活動名・自己紹介・事務所を検索" className="h-12 w-full border border-black/20 pl-12 pr-4 text-sm outline-none focus:border-black" /></label><select value={contentType} onChange={(event) => setContentType(event.target.value as typeof contentType)} className="h-12 border border-black/20 bg-white px-3 text-sm font-bold"><option value="all">すべての形式</option><option value="live">LIVE配信</option><option value="short_video">ショート動画</option></select><select value={agencyType} onChange={(event) => setAgencyType(event.target.value as typeof agencyType)} className="h-12 border border-black/20 bg-white px-3 text-sm font-bold"><option value="all">所属を問わない</option><option value="agency">事務所所属</option><option value="independent">フリー</option></select><label className="flex h-12 items-center gap-2 border border-black/20 px-3 text-sm font-bold"><input type="checkbox" checked={acceptingOnly} onChange={(event) => setAcceptingOnly(event.target.checked)} />相談受付中のみ</label><div className="flex items-center justify-center bg-[#f7cc35] px-4 text-sm font-black"><SlidersHorizontal className="mr-2 h-4 w-4" />{count}名</div></div><div className="mt-4 flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`px-3 py-2 text-xs font-black ${category === item ? "bg-[#171714] text-white" : "border border-black/15 bg-white"}`}>{item}</button>)}</div></div></div></section>

    <section className="px-5 pb-20 md:px-8"><div className="mx-auto max-w-[1440px]">{creators.isLoading ? <div className="grid min-h-80 place-items-center text-sm font-black">読み込み中...</div> : creators.isError ? <div className="grid min-h-[420px] place-items-center border border-red-200 bg-red-50 p-8 text-center"><div><Users className="mx-auto h-12 w-12 text-red-300" /><h2 className="mt-5 text-2xl font-black">プロフィールを読み込めませんでした</h2><p className="mt-3 max-w-lg text-sm leading-7 text-black/55">通信状態を確認して、もう一度お試しください。公開プロフィールが0件という意味ではありません。</p><button type="button" onClick={() => creators.refetch()} className="mt-6 bg-[#171714] px-5 py-3 text-sm font-black text-white">再読み込み</button></div></div> : count > 0 ? <div className="grid gap-px bg-black/15 sm:grid-cols-2 xl:grid-cols-3">{creators.data?.map((creator) => <CreatorCard key={creator.id} creator={creator} />)}</div> : <div className="grid min-h-[420px] place-items-center border border-dashed border-black/25 bg-white p-8 text-center"><div><Users className="mx-auto h-12 w-12 text-black/20" /><h2 className="mt-5 text-2xl font-black">条件に合う公開プロフィールはまだありません</h2><p className="mt-3 max-w-lg text-sm leading-7 text-black/55">公開同意と運営確認が完了したライバーから順次掲載します。既存LCFライバーは同じアカウントで公式ページを作成できます。</p><Link href="/lcm/manage?creator=profile" className="mt-6 inline-flex items-center bg-[#171714] px-5 py-3 text-sm font-black text-white">公式ページを作成する<ArrowRight className="ml-2 h-4 w-4" /></Link></div></div>}</div></section>
  </main></LcmPublicLayout>;
}

function CreatorCard({ creator }: { creator: any }) {
  const categories = Array.isArray(creator.categories) ? creator.categories : [];
  return <article className="group bg-white"><Link href={`/lcm/creators/${creator.slug}`} className="block"><div className="relative aspect-[4/3] overflow-hidden bg-[#e9e4d8]">{creator.profileImageUrl ? <img src={creator.profileImageUrl} alt={creator.displayName} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" loading="lazy" /> : <div className="grid h-full place-items-center text-6xl font-black text-black/15">{String(creator.displayName).slice(0, 1)}</div>}<div className="absolute left-3 top-3 flex gap-2">{creator.acceptingOffers && <span className="bg-[#f7cc35] px-2.5 py-1 text-[10px] font-black">商談相談受付中</span>}</div></div><div className="p-5"><div className="flex flex-wrap gap-2 text-[10px] font-black tracking-[0.08em] text-black/45">{creator.supportsLive && <span>LIVE</span>}{creator.supportsShortVideo && <span>SHORT VIDEO</span>}{creator.agencyName && <span>AGENCY</span>}</div><h2 className="mt-2 text-2xl font-black tracking-tight">{creator.displayName}</h2>{creator.agencyName && <p className="mt-1 text-xs font-bold text-black/45">{creator.agencyName}</p>}<p className="mt-3 line-clamp-3 text-sm leading-6 text-black/55">{creator.bio || "プロフィール準備中"}</p><div className="mt-4 flex flex-wrap gap-2">{categories.slice(0, 4).map((item: string) => <span key={item} className="bg-[#f0ede5] px-2 py-1 text-[10px] font-black">{item}</span>)}</div><div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4 text-xs"><span className="font-bold text-black/50">フォロワー {followerLabels[creator.followerRange] || "非公開"}</span><span className="inline-flex items-center font-black">詳細を見る<ArrowRight className="ml-1 h-4 w-4" /></span></div></div></Link></article>;
}

function ShieldMark() {
  return <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#f7cc35] text-black"><CheckIcon /></span>;
}

function CheckIcon() {
  return <CheckCircleIcon />;
}

function CheckCircleIcon() {
  return <Sparkles className="h-5 w-5" />;
}
