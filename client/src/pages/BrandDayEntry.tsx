import { useState } from "react";
import { Link, useParams } from "wouter";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDrKozuBrandDaySeo } from "@/lib/drKozuBrandDaySeo";
import { PortalError, PortalLoading } from "./BrandDayPortal";
import { DRKOZU_BRAND_DAY_PROFILE, DRKOZU_BRAND_DAY_SLUG } from "@shared/brandDayCampaign";

const initial = {
  registrationName: "",
  tiktokId: "",
  tiktokName: "",
  lineId: "",
  phone: "",
  email: "",
  password: "",
  passwordConfirmation: "",
};

export default function BrandDayEntry() {
  const { slug = "" } = useParams<{ slug: string }>();
  const isDrKozu = slug === DRKOZU_BRAND_DAY_SLUG;
  useDrKozuBrandDaySeo(isDrKozu);
  const [form, setForm] = useState(initial);
  const [complete, setComplete] = useState(false);
  const event = trpc.brandDay.publicPortal.event.useQuery({ slug }, { enabled: Boolean(slug) });
  const enter = trpc.brandDay.publicPortal.enter.useMutation({
    onSuccess: () => setComplete(true),
    onError: error => toast.error(error.message),
  });

  if (event.isLoading) return <PortalLoading />;
  if (!event.data) return <PortalError message={event.error?.message || "ブランドデーが見つかりません"} />;
  if (complete) {
    return (
      <Shell isDrKozu={isDrKozu}>
        <Card className={isDrKozu ? "drkozu-form-card max-w-xl" : "max-w-xl border-white/10 bg-white/[.06] text-white"}>
          <CardContent className="p-8 text-center">
            <ShieldCheck className={`mx-auto h-10 w-10 ${isDrKozu ? "text-[#a20d21]" : "text-emerald-300"}`} />
            <h1 className="mt-4 text-2xl font-bold">エントリー完了</h1>
            <p className={`mt-3 leading-7 ${isDrKozu ? "text-[#6d5155]" : "text-slate-300"}`}>
              {isDrKozu
                ? "登録したTikTok IDとパスワードで、Dr.Kozu BRAND DAY専用の出場者ページへログインできます。一般の管理者・スタッフアカウントとは別の独立ログインです。"
                : "登録したTikTok IDとパスワードで、Brand Day専用の出場者ページへログインできます。LCJ MALLの管理者・スタッフアカウントではありません。"}
            </p>
            <Link href={`/brand-day/${slug}/creator/login`}>
              <Button className={isDrKozu ? "mt-6 bg-[#a20d21] text-white hover:bg-[#bf1028]" : "mt-6 bg-amber-400 text-slate-950"}>独立した出場者ログインへ</Button>
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const fields: Array<[keyof typeof form, string, string]> = [
    ["registrationName", "お名前", "text"],
    ["tiktokId", "TikTok ID", "text"],
    ["tiktokName", "TikTok表示名", "text"],
    ["lineId", "LINE ID", "text"],
    ["phone", "電話番号", "tel"],
    ["email", "メールアドレス", "email"],
    ["password", "パスワード（8文字以上）", "password"],
    ["passwordConfirmation", "パスワード確認", "password"],
  ];

  return (
    <Shell isDrKozu={isDrKozu}>
      <Card className={isDrKozu ? "drkozu-form-card w-full max-w-2xl" : "w-full max-w-2xl border-white/10 bg-white/[.06] text-white"}>
        <CardHeader>
          <p className={`text-xs font-bold tracking-[.2em] ${isDrKozu ? "text-[#a20d21]" : "text-amber-300"}`}>{isDrKozu ? DRKOZU_BRAND_DAY_PROFILE.shortName : event.data.shortName}</p>
          <CardTitle className="text-2xl">{isDrKozu ? "Dr.Kozu BRAND DAY エントリー" : "ブランドデー エントリー"}</CardTitle>
          <div className={`mt-3 rounded-xl p-4 ${isDrKozu ? "border border-[#a20d21]/20 bg-[#a20d21]/5" : "border border-emerald-300/20 bg-emerald-400/10"}`} data-testid="brand-day-public-account-notice">
            <p className={`flex items-center gap-2 font-bold ${isDrKozu ? "text-[#8f0a1d]" : "text-emerald-200"}`}><ShieldCheck className="h-4 w-4" />外部参加者専用 / 外部报名者专用</p>
            <p className={`mt-2 text-sm leading-6 ${isDrKozu ? "text-[#6d5155]" : "text-emerald-50"}`}>
              {isDrKozu
                ? "一般の管理者・スタッフアカウントは不要です。ここで設定するTikTok IDとパスワードは、Dr.Kozu BRAND DAYの出場者ページだけで使用します。"
                : "LCJ MALLの管理者・スタッフアカウントは不要です。ここで設定するTikTok IDとパスワードは、このBrand Dayの出場者ページだけで使用します。"}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={submitEvent => {
              submitEvent.preventDefault();
              enter.mutate({ slug, ...form, website: "" });
            }}
          >
            {fields.map(([key, label, type]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  type={type}
                  value={form[key]}
                  onChange={inputEvent => setForm(current => ({ ...current, [key]: inputEvent.target.value }))}
                  className={isDrKozu ? "border-[#a20d21]/20 bg-white" : "border-white/15 bg-black/20"}
                  required
                />
              </div>
            ))}
            <Button type="submit" disabled={enter.isPending} className={isDrKozu ? "mt-2 bg-[#a20d21] text-white hover:bg-[#bf1028] sm:col-span-2" : "mt-2 bg-amber-400 text-slate-950 sm:col-span-2"}>
              {enter.isPending ? "登録中…" : "エントリーする"}
            </Button>
          </form>
          <Link href={`/brand-day/${slug}/creator/login`}>
            <Button variant="outline" className={isDrKozu ? "mt-3 w-full border-[#a20d21]/25 text-[#8f0a1d]" : "mt-3 w-full border-white/20 text-white"}>登録済みの方：出場者ログイン</Button>
          </Link>
          <Link href={`/brand-day/${slug}`}>
            <Button variant="ghost" className={isDrKozu ? "mt-2 w-full text-[#765e62]" : "mt-2 w-full text-slate-300"}>活動ページへ戻る</Button>
          </Link>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children, isDrKozu = false }: { children: React.ReactNode; isDrKozu?: boolean }) {
  return <main className={isDrKozu ? "drkozu-form-shell flex min-h-screen items-center justify-center p-5" : "flex min-h-screen items-center justify-center bg-[#090313] bg-[radial-gradient(circle_at_top,rgba(124,58,237,.2),transparent_35%)] p-5"}>{children}</main>;
}
