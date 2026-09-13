/**
 * LCM public design: bright Japanese B2B marketplace, editorial product imagery,
 * sharp ink borders and warm yellow actions. Dense commerce information stays scannable.
 */
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Building2, LogIn, PackageSearch } from "lucide-react";

export function LcmPublicLayout({ children }: { children: ReactNode }) {
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
            <Link href="/livecommercefestival/2026/exhibitors" className="hidden px-3 py-2 hover:bg-black/5 lg:inline-flex">
              出展アーカイブ
            </Link>
            <Link href="/lcm/manage" className="inline-flex items-center border border-black/20 bg-white px-3 py-2.5 hover:border-black">
              <Building2 className="mr-1.5 h-4 w-4" />ブランド管理
            </Link>
            <Link href="/lcf/login?return=%2Flcm%2Fmanage" className="inline-flex items-center bg-[#171714] px-3 py-2.5 text-white hover:bg-black/80">
              <LogIn className="mr-1.5 h-4 w-4" />ログイン
            </Link>
          </nav>
        </div>
      </header>
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
            <Link href="/lcf/mypage">マイページ</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LcmArchiveBadge() {
  return <span className="inline-flex bg-[#171714] px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-white">LCF 2026 出展アーカイブ</span>;
}
