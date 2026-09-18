import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalError, PortalLoading } from "./BrandDayPortal";
import { DRKOZU_BRAND_DAY_PROFILE, DRKOZU_BRAND_DAY_SLUG } from "@shared/brandDayCampaign";

export default function BrandDayCreatorLogin() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [tiktokId, setTiktokId] = useState("");
  const [password, setPassword] = useState("");
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  const login = trpc.brandDay.creatorPortal.login.useMutation({
    onSuccess: () => navigate(`/brand-day/${slug}/creator`),
  });

  if (event.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;
  const isDrKozu = slug === DRKOZU_BRAND_DAY_SLUG;

  return (
    <main className={isDrKozu ? "drkozu-form-shell flex min-h-screen items-center justify-center p-5" : "flex min-h-screen items-center justify-center bg-[#090313] bg-[radial-gradient(circle_at_top,rgba(236,72,153,.16),transparent_35%)] p-5"}>
      <Card className={isDrKozu ? "drkozu-form-card w-full max-w-md" : "w-full max-w-md border-white/10 bg-white/[.06] text-white"}>
        <CardHeader>
          <p className={`text-xs font-bold tracking-[.2em] ${isDrKozu ? "text-[#a20d21]" : "text-amber-300"}`}>{isDrKozu ? DRKOZU_BRAND_DAY_PROFILE.shortName : event.data.shortName}</p>
          <CardTitle className="text-2xl">出場者ログイン</CardTitle>
          <div className={`mt-3 rounded-xl p-4 ${isDrKozu ? "border border-[#a20d21]/20 bg-[#a20d21]/5" : "border border-emerald-300/20 bg-emerald-400/10"}`} data-testid="brand-day-creator-login-notice">
            <p className={`flex items-center gap-2 font-bold ${isDrKozu ? "text-[#8f0a1d]" : "text-emerald-200"}`}><ShieldCheck className="h-4 w-4" />独立した外部参加者ログイン</p>
            <p className={`mt-2 text-sm leading-6 ${isDrKozu ? "text-[#6d5155]" : "text-emerald-50"}`}>
              LCJ MALLの管理者・スタッフログインは不要です。エントリー時に登録したTikTok IDとパスワードを入力してください。
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={submitEvent => {
              submitEvent.preventDefault();
              login.mutate({ slug, tiktokId, password });
            }}
          >
            <div className="space-y-2">
              <Label>TikTok ID</Label>
              <Input value={tiktokId} onChange={inputEvent => { setTiktokId(inputEvent.target.value); login.reset(); }} className={isDrKozu ? "border-[#a20d21]/20 bg-white" : "border-white/15 bg-black/20"} required />
            </div>
            <div className="space-y-2">
              <Label>パスワード</Label>
              <Input type="password" value={password} onChange={inputEvent => { setPassword(inputEvent.target.value); login.reset(); }} className={isDrKozu ? "border-[#a20d21]/20 bg-white" : "border-white/15 bg-black/20"} required />
            </div>
            {login.error && (
              <p role="alert" className="rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100" data-testid="brand-day-creator-login-error">
                {login.error.message}
              </p>
            )}
            <Button type="submit" disabled={login.isPending} className={isDrKozu ? "w-full bg-[#a20d21] text-white hover:bg-[#bf1028]" : "w-full bg-amber-400 text-slate-950"}>
              {login.isPending ? "ログイン中…" : "出場者ページへログイン"}
            </Button>
          </form>
          <Link href={`/brand-day/${slug}/entry`}>
            <Button variant="outline" className={isDrKozu ? "mt-3 w-full border-[#a20d21]/25 text-[#8f0a1d]" : "mt-3 w-full border-white/20 text-white"}>まだ登録していない方：エントリー</Button>
          </Link>
          <Link href={`/brand-day/${slug}`}>
            <Button variant="ghost" className={isDrKozu ? "mt-2 w-full text-[#765e62]" : "mt-2 w-full text-slate-300"}>活動ページへ戻る</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
