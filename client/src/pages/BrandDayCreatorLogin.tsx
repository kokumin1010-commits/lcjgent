import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";
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
  const login = trpc.brandDay.creatorPortal.login.useMutation({ onSuccess: () => navigate(`/brand-day/${slug}/creator`), onError: error => toast.error(error.message) });
  if (event.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;
  return <main className="flex min-h-screen items-center justify-center bg-[#090313] bg-[radial-gradient(circle_at_top,rgba(236,72,153,.16),transparent_35%)] p-5"><Card className="w-full max-w-md border-white/10 bg-white/[.06] text-white"><CardHeader><p className="text-xs font-bold tracking-[.2em] text-amber-300">{event.data.shortName}</p><CardTitle className="text-2xl">出場者ログイン</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={e => { e.preventDefault(); login.mutate({ slug, tiktokId, password }); }}><div className="space-y-2"><Label>TikTok ID</Label><Input value={tiktokId} onChange={e => setTiktokId(e.target.value)} className="border-white/15 bg-black/20" required /></div><div className="space-y-2"><Label>パスワード</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="border-white/15 bg-black/20" required /></div><Button type="submit" disabled={login.isPending} className="w-full bg-amber-400 text-slate-950">{login.isPending ? "ログイン中…" : "ログイン"}</Button></form><Link href={`/brand-day/${slug}`}><Button variant="ghost" className="mt-3 w-full text-slate-300">活動ページへ戻る</Button></Link></CardContent></Card></main>;
}
