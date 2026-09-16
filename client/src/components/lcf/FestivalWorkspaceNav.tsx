/**
 * LCF / LCM shared account navigation: one identity, role-specific workspaces.
 * Only server-derived eligible roles are rendered; navigation never grants authority.
 */
import { Building2, CalendarDays, Mic2 } from "lucide-react";
import { Link } from "wouter";
import type { FestivalWorkspace } from "@/lib/festivalPortal";

export type FestivalWorkspaceRoles = {
  event: boolean;
  brand: boolean;
  creator: boolean;
};

const workspaces = [
  { key: "event" as const, label: "イベント・QR", shortLabel: "イベント", href: "/lcf/mypage", icon: CalendarDays },
  { key: "brand" as const, label: "ブランド", shortLabel: "ブランド", href: "/lcm/manage?workspace=brand", icon: Building2 },
  { key: "creator" as const, label: "ライブコマーサー", shortLabel: "ライブコマーサー", href: "/lcm/manage?workspace=creator", icon: Mic2 },
];

export function FestivalWorkspaceNav({
  roles,
  active,
  variant = "light",
}: {
  roles: FestivalWorkspaceRoles;
  active?: FestivalWorkspace;
  variant?: "light" | "dark";
}) {
  const visible = workspaces.filter((item) => roles[item.key]);
  if (!visible.length) return null;
  const dark = variant === "dark";

  return (
    <section className={dark ? "border border-white/10 bg-white/[0.035] p-4 sm:p-5" : "border border-black/15 bg-white p-4 sm:p-5"} aria-label="マイページメニュー">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={dark ? "text-[10px] font-bold tracking-[0.2em] text-amber-400" : "text-[10px] font-black tracking-[0.2em] text-[#9b6200]"}>LCF / LCM COMMON ACCOUNT</p>
          <p className={dark ? "mt-1 text-sm font-bold text-white" : "mt-1 text-sm font-black text-black"}>マイページメニュー</p>
        </div>
        <nav className="grid gap-2 sm:flex" aria-label="利用する機能">
          {visible.map((item) => {
            const Icon = item.icon;
            const current = item.key === active;
            const className = current
              ? "inline-flex min-h-11 items-center justify-center bg-amber-400 px-4 py-2 text-xs font-black text-black"
              : dark
                ? "inline-flex min-h-11 items-center justify-center border border-white/15 px-4 py-2 text-xs font-bold text-gray-200 hover:border-amber-400 hover:text-white"
                : "inline-flex min-h-11 items-center justify-center border border-black/20 px-4 py-2 text-xs font-black text-black hover:border-black";
            return <Link key={item.key} href={item.href} className={className} aria-current={current ? "page" : undefined}><Icon className="mr-2 h-4 w-4" /><span className="sm:hidden lg:inline">{item.label}</span><span className="hidden sm:inline lg:hidden">{item.shortLabel}</span></Link>;
          })}
        </nav>
      </div>
    </section>
  );
}
