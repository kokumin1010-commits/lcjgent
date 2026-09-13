import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalError, PortalLoading } from "./BrandDayPortal";

const initial = { registrationName: "", tiktokId: "", tiktokName: "", lineId: "", phone: "", email: "", password: "", passwordConfirmation: "" };
export default function BrandDayEntry() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [form, setForm] = useState(initial);
  const [complete, setComplete] = useState(false);
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  const enter = trpc.brandDay.publicPortal.enter.useMutation({ onSuccess: () => setComplete(true), onError: error => toast.error(error.message) });
  if (event.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;
  if (complete) return <Shell><Card className="max-w-xl border-white/10 bg-white/[.06] text-white"><CardContent className="p-8 text-center"><h1 className="text-2xl font-bold">エントリー完了</h1><p className="mt-3 text-slate-300">登録したTikTok IDとパスワードでログインできます。</p><Link href={`/brand-day/${slug}/creator/login`}><Button className="mt-6 bg-amber-400 text-slate-950">出場者ログインへ</Button></Link></CardContent></Card></Shell>;
  const fields: Array<[keyof typeof form,string,string]> = [["registrationName","お名前","text"],["tiktokId","TikTok ID","text"],["tiktokName","TikTok表示名","text"],["lineId","LINE ID","text"],["phone","電話番号","tel"],["email","メールアドレス","email"],["password","パスワード（8文字以上）","password"],["passwordConfirmation","パスワード確認","password"]];
  return <Shell><Card className="w-full max-w-2xl border-white/10 bg-white/[.06] text-white"><CardHeader><p className="text-xs font-bold tracking-[.2em] text-amber-300">{event.data.shortName}</p><CardTitle className="text-2xl">ブランドデー エントリー</CardTitle></CardHeader><CardContent><form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); enter.mutate({ slug, ...form, website: "" }); }}>{fields.map(([key,label,type]) => <div key={key} className="space-y-2"><Label>{label}</Label><Input type={type} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} className="border-white/15 bg-black/20" required /></div>)}<Button type="submit" disabled={enter.isPending} className="mt-2 bg-amber-400 text-slate-950 sm:col-span-2">{enter.isPending ? "登録中…" : "エントリーする"}</Button></form><Link href={`/brand-day/${slug}`}><Button variant="ghost" className="mt-3 w-full text-slate-300">活動ページへ戻る</Button></Link></CardContent></Card></Shell>;
}
function Shell({ children }: { children: React.ReactNode }) { return <main className="flex min-h-screen items-center justify-center bg-[#090313] bg-[radial-gradient(circle_at_top,rgba(124,58,237,.2),transparent_35%)] p-5">{children}</main>; }
