import { Link, useParams } from "wouter";
import { CalendarDays, Camera, ShieldCheck, Trophy, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function BrandDayPortal() {
  const { slug = "" } = useParams<{ slug: string }>();
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  if (event.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;
  const info = event.data;
  return <main className="min-h-screen bg-[#090313] text-white">
    <div className="fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(236,72,153,.16),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(124,58,237,.18),transparent_30%),linear-gradient(#090313,#12051d)]" />
    <div className="relative mx-auto max-w-6xl px-5 py-8 sm:py-14">
      <nav className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold tracking-[.28em] text-amber-300">LCJ BRAND DAY</p><div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto"><Link href={`/brand-day/${slug}/ranking`}><Button variant="outline" className="w-full border-white/20 px-3 text-white sm:w-auto">ランキング</Button></Link><Link href={`/brand-day/${slug}/creator/login`}><Button className="w-full bg-amber-400 px-3 text-slate-950 hover:bg-amber-300 sm:w-auto">出場者ログイン</Button></Link></div></nav>
      <section className="grid min-h-[68vh] items-center gap-10 py-16 lg:grid-cols-[1.2fr_.8fr]">
        <div><p className="text-sm font-semibold text-fuchsia-300">{info.challenge}</p><h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">{info.title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{info.subtitle}</p><div className="mt-8 flex flex-wrap gap-3"><Link href={`/brand-day/${slug}/entry`}><Button size="lg" className="bg-gradient-to-r from-amber-300 to-yellow-500 px-8 font-bold text-slate-950">エントリーする</Button></Link><Link href={`/brand-day/${slug}/creator/login`}><Button size="lg" variant="outline" className="border-white/20 text-white">大画面を提出</Button></Link></div></div>
        <Card className="border-white/10 bg-white/[.06] text-white backdrop-blur"><CardContent className="space-y-5 p-6"><div className="flex items-center gap-3"><CalendarDays className="text-amber-300" /><div><p className="text-xs text-slate-400">開催期間</p><p className="font-semibold">{new Date(info.eventStartAt).toLocaleString("ja-JP", { timeZone: info.timezone })} 〜</p><p className="font-semibold">{new Date(info.eventEndAt).toLocaleString("ja-JP", { timeZone: info.timezone })}</p></div></div><div className="grid grid-cols-3 gap-3">{info.days.map(day => <div key={day.dayNumber} className="rounded-xl bg-white/[.06] p-3 text-center"><p className="text-xs text-slate-400">{day.label}</p><p className="mt-1 font-bold text-amber-300">{new Date(day.startAt).toLocaleDateString("ja-JP", { timeZone: info.timezone, month: "numeric", day: "numeric" })}</p></div>)}</div></CardContent></Card>
      </section>
      <section className="grid gap-4 pb-16 sm:grid-cols-3">{[
        { Icon: Camera, title: "ライブ大画面を提出", text: "配信ごとに画像を登録し、AIが時間・GMV・商品を読み取ります。" },
        { Icon: ShieldCheck, title: "異常データは管理者確認", text: "日時不明・対象期間外は確認後にランキングへ反映します。" },
        { Icon: Trophy, title: "即時ランキング", text: "有効な配信は確認後すぐに売上・配信時間へ反映します。" },
      ].map(({ Icon, title, text }) => <Card key={title} className="border-white/10 bg-white/[.04] text-white"><CardContent className="p-5"><Icon className="h-6 w-6 text-fuchsia-300" /><h2 className="mt-4 font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></CardContent></Card>)}</section>
      <footer className="flex items-center justify-between border-t border-white/10 py-6 text-xs text-slate-500"><span>Powered by LCJ</span><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Multi Brand Day Platform</span></footer>
    </div>
  </main>;
}

export function PortalLoading() { return <div className="flex min-h-screen items-center justify-center bg-[#090313] text-sm text-white">読み込み中…</div>; }
export function PortalError({ message }: { message: string }) { return <div className="flex min-h-screen items-center justify-center bg-[#090313] p-6 text-center text-sm text-rose-300">{message}</div>; }
