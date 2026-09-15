import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalError, PortalLoading } from "./BrandDayPortal";

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090313] bg-[radial-gradient(circle_at_top,rgba(236,72,153,.16),transparent_35%)] p-5">
      <Card className="w-full max-w-md border-white/10 bg-white/[.06] text-white">
        <CardHeader>
          <p className="text-xs font-bold tracking-[.2em] text-amber-300">{event.data.shortName}</p>
          <CardTitle className="text-2xl">出場者ログイン</CardTitle>
          <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4" data-testid="brand-day-creator-login-notice">
            <p className="flex items-center gap-2 font-bold text-emerald-200"><ShieldCheck className="h-4 w-4" />独立した外部参加者ログイン</p>
            <p className="mt-2 text-sm leading-6 text-emerald-50">
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
              <Input value={tiktokId} onChange={inputEvent => { setTiktokId(inputEvent.target.value); login.reset(); }} className="border-white/15 bg-black/20" required />
            </div>
            <div className="space-y-2">
              <Label>パスワード</Label>
              <Input type="password" value={password} onChange={inputEvent => { setPassword(inputEvent.target.value); login.reset(); }} className="border-white/15 bg-black/20" required />
            </div>
            {login.error && (
              <p role="alert" className="rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-100" data-testid="brand-day-creator-login-error">
                {login.error.message}
              </p>
            )}
            <Button type="submit" disabled={login.isPending} className="w-full bg-amber-400 text-slate-950">
              {login.isPending ? "ログイン中…" : "出場者ページへログイン"}
            </Button>
          </form>
          <Link href={`/brand-day/${slug}/entry`}>
            <Button variant="outline" className="mt-3 w-full border-white/20 text-white">まだ登録していない方：エントリー</Button>
          </Link>
          <Link href={`/brand-day/${slug}`}>
            <Button variant="ghost" className="mt-2 w-full text-slate-300">活動ページへ戻る</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
