/**
 * LCM public design: bright Japanese B2B marketplace, editorial product imagery,
 * sharp ink borders and warm yellow actions. Dense commerce information stays scannable.
 */
import type { ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { BadgePercent, LayoutDashboard, LogIn, PackageSearch, ShoppingCart, Users } from "lucide-react";
import { FestivalWorkspaceNav } from "@/components/lcf/FestivalWorkspaceNav";
import { buildFestivalLoginUrl, getRequestedFestivalWorkspace } from "@/lib/festivalPortal";
import { trpc } from "@/lib/trpc";

export function LcmPublicLayout({ children }: { children: ReactNode }) {
  const [pathname] = useLocation();
  const search = useSearch();
  const me = trpc.festivalAuth.me.useQuery(undefined, { retry: false });
  const access = trpc.lcm.getMyAccess.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const engagement = trpc.lcm.getMyEngagementSummary.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const requestedWorkspace = getRequestedFestivalWorkspace(new URLSearchParams(search).get("workspace"));
  const loginReturn = requestedWorkspace ? `/lcm/manage?workspace=${requestedWorkspace}` : "/lcm/manage";
  const loginUrl = buildFestivalLoginUrl(loginReturn);
  const activeWorkspace = pathname === "/lcm/manage" ? requestedWorkspace || (access.data?.membership?.memberType === "liver" ? "creator" : "brand") : undefined;
  const roles = access.data?.roles || { event: true, brand: false, creator: false };

  return (
    <div className="min-h-screen bg-[#f6f4ee] text-[#171714]">
      <div className="bg-[#171714] px-4 py-2 text-center text-[11px] font-bold tracking-[0.18em] text-white">
        LIVE COMMERCE MARKET BY LCF
      </div>
      <header className="sticky top-0 z-40 border-b border-black/15 bg-[#fffdf8]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 md:px-8">
          <Link href="/lcm" className="flex shrink-0 items-center gap-3" aria-label="LCMトップ">
            <span className="grid h-11 w-11 place-items-center bg-[#f7cc35] text-sm font-black tracking-tight text-black">LCM</span>
            <span className="hidden leading-tight sm:block">
              <span className="block text-sm font-black tracking-tight">ライブコマースマーケット</span>
              <span className="block text-[9px] font-semibold tracking-[0.16em] text-black/45">BRAND × CREATOR × COMMERCE</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-1.5 text-xs font-bold md:gap-2 md:text-sm" aria-label="LCMナビゲーション">
            <Link href="/lcm" className="hidden px-3 py-2 hover:bg-black/5 sm:inline-flex">
              <PackageSearch className="mr-1.5 h-4 w-4" />商品を探す
            </Link>
            <Link href="/lcm/campaigns" className="hidden px-3 py-2 hover:bg-black/5 sm:inline-flex">
              <BadgePercent className="mr-1.5 h-4 w-4" />キャンペーン
            </Link>
            <Link href="/lcm/creators" className="hidden px-3 py-2 hover:bg-black/5 md:inline-flex">
              <Users className="mr-1.5 h-4 w-4" />ライブコマーサーを探す
            </Link>
            <Link href="/livecommercefestival/2026/exhibitors" className="hidden px-3 py-2 hover:bg-black/5 lg:inline-flex">
              出展アーカイブ
            </Link>
            {me.data && <Link href="/lcm/sample-cart" className="relative inline-flex items-center px-2.5 py-2 hover:bg-black/5" aria-label={`サンプルカート ${engagement.data?.sampleCartCount || 0}商品`}><ShoppingCart className="h-5 w-5" /><span className="ml-1 hidden sm:inline">サンプル</span>{(engagement.data?.sampleCartCount || 0) > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#d45b16] px-1 text-[9px] font-black text-white">{engagement.data?.sampleCartCount}</span>}</Link>}
            {me.isLoading ? <span className="h-10 w-24 animate-pulse bg-black/10" aria-label="ログイン状態を確認中" /> : me.data ? (
              <Link href={me.data.portal?.defaultPath || "/lcf/mypage"} className="inline-flex items-center bg-[#171714] px-3 py-2.5 text-white hover:bg-black/80"><LayoutDashboard className="mr-1.5 h-4 w-4" />マイページ</Link>
            ) : (
              <Link href={loginUrl} className="inline-flex items-center bg-[#171714] px-3 py-2.5 text-white hover:bg-black/80">
                <LogIn className="mr-1.5 h-4 w-4" />ログイン
              </Link>
            )}
          </nav>
        </div>
      </header>
      {me.data && <div className="mx-auto max-w-[1440px] px-4 pt-5 md:px-8"><FestivalWorkspaceNav roles={roles} active={activeWorkspace} /></div>}
      {children}
      <footer className="border-t border-black/15 bg-[#171714] px-5 py-12 text-white">
        <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-2xl font-black tracking-tight">LCM</p>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/65">ブランドとライブコマースの担い手が、商品を知り、条件を確かめ、次の商談へ進むためのB2Bマーケットです。</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-white/70">
            <Link href="/livecommercefestival">LCF公式サイト</Link>
            <Link href="/livecommercefestival/2026/report">第1回開催レポート</Link>
            <Link href={me.data?.portal?.defaultPath || (me.data ? "/lcf/mypage" : loginUrl)}>{me.data ? "マイページ" : "ログイン"}</Link>
            <Link href="/lcm/campaigns">キャンペーンを探す</Link>
            <Link href="/lcm/creators">ライブコマーサーを探す</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LcmArchiveBadge() {
  return <span className="inline-flex bg-[#171714] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-white">LCF 2026 出展アーカイブ</span>;
}
