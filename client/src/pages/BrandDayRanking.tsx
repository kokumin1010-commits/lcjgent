import { Link, useParams } from "wouter";
import { Clock3, Sparkles, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDrKozuBrandDaySeo } from "@/lib/drKozuBrandDaySeo";
import { PortalError, PortalLoading } from "./BrandDayPortal";
import { DRKOZU_BRAND_DAY_PROFILE, DRKOZU_BRAND_DAY_SLUG, resolveBrandDayPrizeAwards } from "@shared/brandDayCampaign";
import "./brand-day-portal.css";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });

export default function BrandDayRanking() {
  const { slug = "" } = useParams<{ slug: string }>();
  useDrKozuBrandDaySeo(slug === DRKOZU_BRAND_DAY_SLUG);
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  const ranking = trpc.brandDay.publicPortal.leaderboard.useQuery({ slug, dayNumber: 0 }, { enabled: Boolean(slug) });
  if (event.isLoading || ranking.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;
  if (slug === DRKOZU_BRAND_DAY_SLUG) return <DrKozuRanking slug={slug} ranking={ranking.data} />;
  return <GenericRanking slug={slug} shortName={event.data.shortName} ranking={ranking.data} />;
}

function DrKozuRanking({ slug, ranking }: { slug: string; ranking: any }) {
  return (
    <main className="drkozu-ranking-page min-h-screen">
      <div className="drkozu-ranking-hero">
        <div>
          <p>DR.KOZU BRAND DAY · 2026.10.05—10.12</p>
          <h1>LIVE RANKING</h1>
          <span>確認済みの配信実績をリアルタイム集計</span>
        </div>
        <div className="drkozu-ranking-actions">
          <Link href={`/brand-day/${slug}`}><Button variant="outline">活動ページ</Button></Link>
          <Link href={`/brand-day/${slug}/entry`}><Button className="bg-[#a20d21] text-white hover:bg-[#bf1028]"><Sparkles className="mr-2 h-4 w-4" />エントリー</Button></Link>
        </div>
      </div>
      <div className="drkozu-ranking-body">
        <p className="drkozu-ranking-brand">{DRKOZU_BRAND_DAY_PROFILE.shortName}</p>
        <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <RankingCard icon={Trophy} title="Dr.Kozu商品 売上ランキング" rows={ranking?.sales || []} value={row => yen.format(row.brandGmv)} slug={slug} showPrize />
          <RankingCard icon={Clock3} title="参考：有効ライブ時間" rows={ranking?.streaming || []} value={row => `${Math.floor(row.streamMinutes / 60)}時間${row.streamMinutes % 60}分`} slug={slug} />
        </div>
        <p className="drkozu-ranking-note">主順位は累計有効GMVで決定し、GMV同額時のみ累計有効ライブ時間、同額GMVへの到達時刻の順で判定します。賞金はGMV順位の上位者から達成済みの最高の空き枠へ割り当てます。管理者確認後も、対象期間内・1回60分以上・Dr.Kozu販売実績ありの全条件を満たす配信だけをランキングへ反映します。</p>
      </div>
    </main>
  );
}

function GenericRanking({ slug, shortName, ranking }: { slug: string; shortName: string; ranking: any }) {
  return <main className="min-h-screen bg-[#090313] p-5 text-white"><div className="mx-auto max-w-5xl py-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[.2em] text-amber-300">{shortName}</p><h1 className="mt-2 text-3xl font-black">公開ランキング</h1></div><Link href={`/brand-day/${slug}`}><Button variant="outline" className="border-white/20 text-white">活動ページ</Button></Link></div><div className="mt-8 grid gap-5 lg:grid-cols-2"><RankingCard icon={Trophy} title="ブランド商品売上" rows={ranking?.sales || []} value={row => yen.format(row.brandGmv)} slug={slug} /><RankingCard icon={Clock3} title="配信時間" rows={ranking?.streaming || []} value={row => `${Math.floor(row.streamMinutes / 60)}時間${row.streamMinutes % 60}分`} slug={slug} /></div></div></main>;
}

function RankingCard({ icon: Icon, title, rows, value, slug, showPrize = false }: { icon: any; title: string; rows: any[]; value: (row: any) => string; slug: string; showPrize?: boolean }) {
  const isDrKozu = slug === DRKOZU_BRAND_DAY_SLUG;
  const prizes = showPrize ? resolveBrandDayPrizeAwards(slug, rows) : [];
  return (
    <Card className={isDrKozu ? "drkozu-ranking-card border-0" : "border-white/10 bg-white/[.06] text-white"}>
      <CardHeader><CardTitle className="flex items-center gap-2"><Icon className={isDrKozu ? "text-[#a20d21]" : "text-amber-300"} />{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row,index) => {
          const prize = prizes[index] ?? null;
          return <div key={row.creatorAccountId} className={isDrKozu ? "drkozu-ranking-row" : "flex items-center gap-3 rounded-xl bg-white/[.05] p-3"}><div className={isDrKozu ? `drkozu-rank-number drkozu-rank-number-${index + 1}` : `flex h-9 w-9 items-center justify-center rounded-full font-bold ${index<3?"bg-amber-300 text-slate-950":"bg-white/10"}`}>{index+1}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{row.tiktokName}</p><p className={isDrKozu ? "text-xs text-[#967f83]" : "text-xs text-slate-400"}>{row.tiktokId} · {row.performanceCount}配信</p></div><div className="text-right"><p className={isDrKozu ? "font-bold text-[#a20d21]" : "font-bold text-amber-300"}>{value(row)}</p>{prize !== null && <span className="drkozu-prize-chip">賞金 {yen.format(prize)}</span>}</div></div>;
        })}
        {!rows.length && <p className={isDrKozu ? "py-12 text-center text-sm text-[#967f83]" : "py-12 text-center text-sm text-slate-500"}>ランキングデータはまだありません。</p>}
      </CardContent>
    </Card>
  );
}
