import { Link, useParams } from "wouter";
import { Clock3, Trophy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalError, PortalLoading } from "./BrandDayPortal";

const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
export default function BrandDayRanking() {
  const { slug = "" } = useParams<{ slug: string }>();
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  const ranking = trpc.brandDay.publicPortal.leaderboard.useQuery({ slug, dayNumber: 0 }, { enabled: Boolean(slug) });
  if (event.isLoading || ranking.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;
  return <main className="min-h-screen bg-[#090313] p-5 text-white"><div className="mx-auto max-w-5xl py-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold tracking-[.2em] text-amber-300">{event.data.shortName}</p><h1 className="mt-2 text-3xl font-black">公開ランキング</h1></div><Link href={`/brand-day/${slug}`}><Button variant="outline" className="border-white/20 text-white">活動ページ</Button></Link></div><div className="mt-8 grid gap-5 lg:grid-cols-2"><RankingCard icon={Trophy} title="ブランド商品売上" rows={ranking.data?.sales || []} value={row => yen.format(row.brandGmv)} /><RankingCard icon={Clock3} title="配信時間" rows={ranking.data?.streaming || []} value={row => `${Math.floor(row.streamMinutes/60)}時間${row.streamMinutes%60}分`} /></div></div></main>;
}
function RankingCard({ icon: Icon, title, rows, value }: { icon: any; title: string; rows: any[]; value: (row: any) => string }) { return <Card className="border-white/10 bg-white/[.06] text-white"><CardHeader><CardTitle className="flex items-center gap-2"><Icon className="text-amber-300" />{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.map((row,index) => <div key={row.creatorAccountId} className="flex items-center gap-3 rounded-xl bg-white/[.05] p-3"><div className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${index<3?"bg-amber-300 text-slate-950":"bg-white/10"}`}>{index+1}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{row.tiktokName}</p><p className="text-xs text-slate-400">{row.tiktokId} · {row.performanceCount}配信</p></div><p className="font-bold text-amber-300">{value(row)}</p></div>)}{!rows.length && <p className="py-12 text-center text-sm text-slate-500">ランキングデータはまだありません。</p>}</CardContent></Card>; }
