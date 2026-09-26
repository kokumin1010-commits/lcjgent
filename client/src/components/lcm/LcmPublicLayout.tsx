/**
 * LCM public design: bright Japanese B2B marketplace, editorial product imagery,
 * sharp ink borders and warm yellow actions. Dense commerce information stays scannable.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { PackageSearch, Users } from "lucide-react";
import { buildFestivalLoginUrl } from "@/lib/festivalPortal";
import { trpc } from "@/lib/trpc";

export function LcmPublicLayout({ children }: { children: ReactNode }) {
  const me = trpc.festivalAuth.me.useQuery(undefined, { retry: false });
  const loginReturn = "/lcm/manage";
  const loginUrl = buildFestivalLoginUrl(loginReturn);

  return (
    <div className="min-h-screen bg-[#f6f4ee] text-[#171714]">
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#fffdf8]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center md:px-8 md:py-4">
          <div className="flex w-full items-center justify-between sm:w-auto">
            <Link href="/lcm" className="flex shrink-0 items-center gap-3" aria-label="LCMトップ">
              <span className="grid h-12 w-12 place-items-center rounded-md bg-[#f7cc35] text-base font-black tracking-tight text-black">LCM</span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-base font-black tracking-tight">ライブコマースマーケット</span>
                <span className="block text-[9px] font-semibold tracking-[0.2em] text-black/45">LIVE COMMERCE MARKET</span>
              </span>
            </Link>
            <Link href={me.data?.portal?.defaultPath || (me.data ? "/lcf/mypage" : loginUrl)} className="inline-flex min-h-11 items-center border border-black px-4 text-xs font-black sm:hidden">
              {me.data ? "マイページ" : "ログイン"}
            </Link>
          </div>
          <nav className="grid w-full grid-cols-[2fr_3fr] gap-1.5 text-[11px] font-bold sm:ml-auto sm:w-auto sm:flex sm:items-center sm:text-xs md:gap-2 md:text-sm" aria-label="LCMナビゲーション">
            <Link href="/lcm" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap px-2 py-2 hover:bg-black/5 sm:px-3">
              <PackageSearch className="mr-1.5 h-4 w-4" />商品を探す
            </Link>
            <Link href="/lcm/creators" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap px-2 py-2 hover:bg-black/5 sm:px-3">
              <Users className="mr-1.5 h-4 w-4" />ライブコマーサーを探す
            </Link>
          </nav>
          <Link href={me.data?.portal?.defaultPath || (me.data ? "/lcf/mypage" : loginUrl)} className="hidden min-h-11 items-center border border-black px-5 text-xs font-black transition hover:bg-black hover:text-white sm:inline-flex md:text-sm">
            {me.data ? "マイページ" : "ログイン"}
          </Link>
        </div>
      </header>
      {children}
      <footer className="border-t border-black/10 bg-[#fffdf8] px-5 py-10">
        <div className="mx-auto grid max-w-[1440px] gap-7 md:grid-cols-[1fr_auto] md:items-end">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#f7cc35] text-sm font-black">LCM</span>
            <p className="text-sm font-black tracking-tight">ライブコマースマーケット</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold text-black/60">
            <Link href="/livecommercefestival">LCF公式サイト</Link>
            <Link href="/livecommercefestival/2026/report">第1回開催レポート</Link>
            <Link href={me.data?.portal?.defaultPath || (me.data ? "/lcf/mypage" : loginUrl)}>{me.data ? "マイページ" : "ログイン"}</Link>
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
