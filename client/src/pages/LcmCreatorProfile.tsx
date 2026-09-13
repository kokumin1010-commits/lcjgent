/**
 * LCM creator public profile: editorial biography with verified-state transparency.
 * Public presentation never includes private application or account contact fields.
 */
import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, Globe2, Radio, ShieldCheck, Video } from "lucide-react";
import { LcmPublicLayout } from "@/components/lcm/LcmPublicLayout";
import { applyPageSeo } from "@/lib/pageSeo";
import { trpc } from "@/lib/trpc";

const followerLabels: Record<string, string> = { not_disclosed: "非公開", under_1k: "1,000未満", "1k_10k": "1,000〜1万", "10k_50k": "1万〜5万", "50k_100k": "5万〜10万", "100k_500k": "10万〜50万", "500k_plus": "50万以上" };
const viewLabels: Record<string, string> = { not_disclosed: "非公開", under_50: "50未満", "50_200": "50〜200", "200_500": "200〜500", "500_1000": "500〜1,000", "1000_plus": "1,000以上" };

export default function LcmCreatorProfile() {
  const { slug } = useParams<{ slug: string }>();
  const profile = trpc.lcm.getPublicCreator.useQuery({ slug }, { retry: false });
  const creator = profile.data;

  useEffect(() => {
    if (!creator) return;
    const sameAs = [creator.tiktokUrl, creator.instagramUrl, creator.youtubeUrl].filter(Boolean);
    return applyPageSeo({
      title: `${creator.displayName}｜LCM ライバー公式ページ`,
      description: creator.bio || `${creator.displayName}の得意カテゴリ、配信形式、公開実績を確認できます。`,
      canonicalPath: `/lcm/creators/${creator.slug}`,
      image: creator.profileImageUrl || creator.coverImageUrl || "https://www.livecommercefestival.com/favicon.ico",
      jsonLd: [{ "@context": "https://schema.org", "@type": "Person", name: creator.displayName, description: creator.bio || undefined, image: creator.profileImageUrl || undefined, url: `https://www.livecommercefestival.com/lcm/creators/${creator.slug}`, sameAs, knowsAbout: creator.categories }],
    });
  }, [creator]);

  if (profile.isLoading) return <LcmPublicLayout><main className="grid min-h-[70vh] place-items-center text-sm font-black">読み込み中...</main></LcmPublicLayout>;
  if (!creator) return <LcmPublicLayout><main className="grid min-h-[70vh] place-items-center px-5 text-center"><div><h1 className="text-3xl font-black">公開プロフィールが見つかりません</h1><p className="mt-3 text-sm text-black/55">公開停止中、または運営確認前の可能性があります。</p><Link href="/lcm/creators" className="mt-6 inline-flex border-b border-black pb-1 text-sm font-black">ライバー一覧へ戻る</Link></div></main></LcmPublicLayout>;

  const categories = Array.isArray(creator.categories) ? creator.categories : [];
  const languages = Array.isArray(creator.languages) ? creator.languages : [];
  const regions = Array.isArray(creator.activityRegions) ? creator.activityRegions : [];
  const portfolios = Array.isArray(creator.portfolioUrls) ? creator.portfolioUrls : [];
  const socialLinks = [{ label: "TikTok", url: creator.tiktokUrl }, { label: "Instagram", url: creator.instagramUrl }, { label: "YouTube", url: creator.youtubeUrl }].filter((item) => item.url);

  return <LcmPublicLayout><main>
    <section className="relative overflow-hidden border-b border-black/15 bg-[#171714] text-white"><div className="absolute inset-0 opacity-40">{creator.coverImageUrl && <img src={creator.coverImageUrl} alt="" className="h-full w-full object-cover" />}</div><div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/25" /><div className="relative mx-auto grid max-w-[1440px] gap-8 px-5 py-12 md:px-8 md:py-20 lg:grid-cols-[380px_1fr] lg:items-end"><div className="aspect-[4/5] overflow-hidden border border-white/20 bg-white/10">{creator.profileImageUrl ? <img src={creator.profileImageUrl} alt={creator.displayName} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-8xl font-black text-white/20">{String(creator.displayName).slice(0, 1)}</div>}</div><div><Link href="/lcm/creators" className="inline-flex items-center text-xs font-black text-white/65"><ArrowLeft className="mr-2 h-4 w-4" />ライバー一覧へ</Link><div className="mt-8 flex flex-wrap gap-2">{creator.acceptingOffers && <span className="bg-[#f7cc35] px-3 py-1.5 text-[11px] font-black text-black">商談相談受付中</span>}<span className="border border-white/25 px-3 py-1.5 text-[11px] font-black">本人公開同意済み</span></div><h1 className="mt-5 text-5xl font-black tracking-[-0.05em] md:text-7xl">{creator.displayName}</h1>{creator.agencyName && <p className="mt-3 text-sm font-bold text-white/55">{creator.agencyName}</p>}<p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-8 text-white/70 md:text-base">{creator.bio}</p><div className="mt-6 flex flex-wrap gap-2">{categories.map((item: string) => <span key={item} className="border border-white/20 px-3 py-1.5 text-xs font-black">{item}</span>)}</div></div></div></section>

    <section className="px-5 py-10 md:px-8 md:py-16"><div className="mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[1fr_360px]"><div className="grid gap-8"><section className="border border-black/15 bg-white p-6 md:p-8"><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">LIVE COMMERCE STYLE</p><h2 className="mt-2 text-3xl font-black">対応スタイル</h2><div className="mt-6 grid gap-px bg-black/15 sm:grid-cols-2">{creator.supportsLive && <InfoPanel icon={<Radio />} label="LIVE配信" value="対応可能" />}{creator.supportsShortVideo && <InfoPanel icon={<Video />} label="ショート動画" value="対応可能" />}<InfoPanel icon={<Globe2 />} label="対応言語" value={languages.length ? languages.join("・") : "未設定"} /><InfoPanel icon={<CalendarDays />} label="活動地域" value={regions.length ? regions.join("・") : "オンライン相談"} /></div>{creator.availabilityNote && <div className="mt-6 border-l-4 border-[#f7cc35] bg-[#f6f4ee] p-4"><p className="text-xs font-black text-black/45">対応可能時期・条件</p><p className="mt-2 whitespace-pre-line text-sm leading-7">{creator.availabilityNote}</p></div>}</section>

      {(creator.performanceSummary || creator.followerRange !== "not_disclosed" || creator.averageViewRange !== "not_disclosed") && <section className="border border-black/15 bg-white p-6 md:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">PERFORMANCE</p><h2 className="mt-2 text-3xl font-black">公開実績</h2></div><span className={`inline-flex items-center px-3 py-1.5 text-[11px] font-black ${creator.metricsVerification === "verified" ? "bg-[#dff5ea] text-[#126445]" : "bg-[#eeeae0] text-black/60"}`}><ShieldCheck className="mr-1.5 h-4 w-4" />{creator.metricsVerification === "verified" ? "運営確認済み" : "本人申告"}</span></div><div className="mt-6 grid gap-px bg-black/15 sm:grid-cols-2"><InfoPanel label="フォロワー帯" value={followerLabels[creator.followerRange] || "非公開"} /><InfoPanel label="平均LIVE視聴帯" value={viewLabels[creator.averageViewRange] || "非公開"} /></div>{creator.performanceSummary && <p className="mt-6 whitespace-pre-line text-sm leading-8 text-black/65">{creator.performanceSummary}</p>}{creator.metricsAsOf && <p className="mt-4 text-[11px] font-bold text-black/40">情報基準日：{new Date(creator.metricsAsOf).toLocaleDateString("ja-JP")}</p>}</section>}

      {portfolios.length > 0 && <section className="border border-black/15 bg-white p-6 md:p-8"><p className="text-xs font-black tracking-[0.16em] text-[#9b6200]">PORTFOLIO</p><h2 className="mt-2 text-3xl font-black">公開事例</h2><div className="mt-6 grid gap-3">{portfolios.map((url: string, index: number) => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center justify-between border border-black/15 px-4 py-4 text-sm font-black hover:border-black"><span>実績・作品 {index + 1}</span><ExternalLink className="h-4 w-4" /></a>)}</div></section>}
    </div>

    <aside className="self-start lg:sticky lg:top-24"><div className="border border-black/15 bg-[#f7cc35] p-6"><p className="text-xs font-black tracking-[0.16em]">CONTACT</p><h2 className="mt-2 text-2xl font-black">商品を見つける。</h2><p className="mt-3 text-sm leading-7 text-black/65">LCMでは商品検索とサンプル申請ができます。企業からの直接オファー機能は次段階で追加します。</p><Link href="/lcm" className="mt-5 inline-flex items-center bg-[#171714] px-5 py-3 text-sm font-black text-white">商品を探す<ArrowRight className="ml-2 h-4 w-4" /></Link></div>{socialLinks.length > 0 && <div className="mt-4 border border-black/15 bg-white p-5"><p className="text-xs font-black tracking-[0.12em] text-black/45">OFFICIAL CHANNELS</p><div className="mt-4 grid gap-2">{socialLinks.map((item) => <a key={item.label} href={String(item.url)} target="_blank" rel="noreferrer" className="flex items-center justify-between border-b border-black/10 py-3 text-sm font-black">{item.label}<ExternalLink className="h-4 w-4" /></a>)}</div></div>}</aside></div></section>
  </main></LcmPublicLayout>;
}

function InfoPanel({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return <div className="bg-[#f6f4ee] p-5"><div className="flex items-center gap-2 text-[#d45b16]">{icon && <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>}<span className="text-[11px] font-black tracking-[0.1em] text-black/45">{label}</span></div><p className="mt-2 text-lg font-black">{value}</p></div>;
}
