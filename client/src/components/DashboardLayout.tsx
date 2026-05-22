import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLanguage, Language } from "@/contexts/LanguageContext";

import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users, ClipboardList, Settings, FileText, UserCog, Globe, Brain, Building2, CreditCard, MessageSquare, Bell, AlertCircle, Calendar, Video, MessageCircle, Package, ShoppingCart, UserCheck, Zap, Wallet, Calculator, UserRoundCog, Megaphone, Store, GraduationCap, Receipt, BarChart3, Heart, Newspaper, Bot, Tag, Gift, Handshake, Mail, History, TrendingUp, ClipboardCheck, Inbox, Coins, Sparkles, Crown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

// スタッフ（admin以外）がアクセス可能なパス
const STAFF_ALLOWED_PATHS = ['/master/finance'];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    return null;
  }

  // セキュリティ: admin以外のユーザーはファイナンス管理ページのみアクセス可能
  const currentPathname = window.location.pathname;
  if (user.role !== 'admin' && !STAFF_ALLOWED_PATHS.some(p => currentPathname.startsWith(p))) {
    window.location.href = "/";
    return null;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { language, setLanguage, t } = useLanguage();

  const menuItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/master" },
    { icon: ClipboardList, label: t("nav.tasks"), path: "/master/tasks" },
    { icon: FileText, label: t("nav.reports"), path: "/master/reports" },
    { icon: Brain, label: t("nav.reportAnalysis"), path: "/master/report-analysis" },
    { icon: UserCog, label: t("nav.reportStaff"), path: "/master/report-staff" },
    { icon: UserRoundCog, label: "人事管理（HR）", path: "/master/hr" },
    { icon: Building2, label: t("nav.brands"), path: "/master/brands" },
    { icon: Tag, label: "ブランド追加ログ", path: "/master/brand-addition-logs" },
    { icon: Handshake, label: "招商管理", path: "/master/recruitment" },
    { icon: Inbox, label: "ブランド申込フォーム一覧", path: "/master/brand-applications", hasBadge: true, badgeType: "brand" as const },
    { icon: Megaphone, label: "広告申込フォーム一覧", path: "/master/ad-form-submissions", hasBadge: true, badgeType: "adForm" as const },
    { icon: CreditCard, label: t("nav.businessCards"), path: "/master/business-cards" },
    { icon: MessageSquare, label: t("nav.line"), path: "/master/line" },
    { icon: Calendar, label: t("nav.calendar"), path: "/s" },
    { icon: Video, label: t("nav.livers"), path: "/master/livers" },
    { icon: Zap, label: t("nav.liverCommand") || "ライバー司令塔", path: "/master/livers-dashboard" },
    { icon: Bot, label: "ライバー成長ダッシュボード", path: "/master/ai-coach" },
    { icon: Crown, label: "メガチャンネル管理", path: "/master/mega-channel" },
    { icon: BarChart3, label: "広告司令塔", path: "/master/ad-dashboard" },
    { icon: Video, label: "短動画マトリックス", path: "/master/short-video" },
    { icon: Building2, label: "事務所管理", path: "/master/agencies" },
    { icon: Globe, label: "ブランドポータル", path: "/master/brand-portal" },
    { icon: ClipboardCheck, label: "売上チェック", path: "/master/sales-check" },
    { icon: Calculator, label: "配信シミュレーター", path: "/master/simulator" },
    { icon: Sparkles, label: "AI配信提案", path: "/master/live-suggestions" },
    { icon: Package, label: "セット申請管理", path: "/master/set-applications" },
    { icon: Sparkles, label: "セット提案管理", path: "/master/set-suggestions" },
    { icon: Gift, label: "サンプル管理", path: "/master/sample-requests" },
    { icon: Store, label: "LCJ MALL", path: "/master/mall" },
    { icon: Newspaper, label: "ブログ管理", path: "/master/blog" },
    { icon: Megaphone, label: "紹介コード管理", path: "/master/referral", adminOnly: true },
    { icon: Receipt, label: "レシート管理", path: "/master/receipts" },
    { icon: Mail, label: "ステップメール", path: "/master/step-email" },
    { icon: History, label: "送信履歴", path: "/master/step-email/logs" },
    { icon: TrendingUp, label: "メールアナリティクス", path: "/master/step-email/analytics" },
    { icon: BarChart3, label: "レシート分析", path: "/master/receipt-analytics" },
    { icon: Heart, label: "入荷リクエスト", path: "/master/product-requests" },
    { icon: Users, label: t("nav.staff"), path: "/master/staff" },
    { icon: Wallet, label: t("nav.finance") || "ファイナンス管理", path: "/master/finance" },
    { icon: Coins, label: "LCJコイン", path: "/master/lcj-coin" },
    { icon: Settings, label: t("nav.masterControl"), path: "/master/control" },
  ];

  const activeMenuItem = menuItems.find(item => item.path === location);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Navigation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems
                .filter(item => {
                  // admin以外はファイナンス管理のみ表示
                  if (user?.role !== 'admin') {
                    return STAFF_ALLOWED_PATHS.some(p => item.path.startsWith(p));
                  }
                  return !item.adminOnly || user?.role === "admin";
                })
                .map(item => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className={`h-10 transition-all font-normal`}
                      >
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                        />
                        <span>{item.label}</span>
                        {(item as any).hasBadge && (item as any).badgeType === "adForm" ? <AdFormBadge /> : (item as any).hasBadge ? <BrandAppBadge /> : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>

            {/* Language Switcher */}
            <div className="px-2 py-2 mt-4 border-t">
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      tooltip={t("common.language")}
                      className="h-10 transition-all font-normal"
                    >
                      <Globe className="h-4 w-4" />
                      <span>{language === "ja" ? "日本語" : "中文"}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-32">
                    <DropdownMenuItem
                      onClick={() => handleLanguageChange("ja")}
                      className={`cursor-pointer ${language === "ja" ? "bg-accent" : ""}`}
                    >
                      🇯🇵 日本語
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleLanguageChange("zh")}
                      className={`cursor-pointer ${language === "zh" ? "bg-accent" : ""}`}
                    >
                      🇨🇳 中文
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t("nav.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
            {/* Mobile Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-9 w-9 flex items-center justify-center rounded-lg bg-background hover:bg-accent transition-colors">
                  <Globe className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem
                  onClick={() => handleLanguageChange("ja")}
                  className={`cursor-pointer ${language === "ja" ? "bg-accent" : ""}`}
                >
                  🇯🇵 日本語
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleLanguageChange("zh")}
                  className={`cursor-pointer ${language === "zh" ? "bg-accent" : ""}`}
                >
                  🇨🇳 中文
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}

function AdFormBadge() {
  const { data: stats } = trpc.adForm.stats.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const pendingCount = stats?.pending ?? 0;
  if (pendingCount === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1.5 text-[10px] font-bold text-white leading-none animate-pulse">
      {pendingCount}
    </span>
  );
}

function BrandAppBadge() {
  const { data: stats } = trpc.brandSample.stats.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const pendingCount = (stats?.pending ?? 0) + (stats?.reviewing ?? 0);
  if (pendingCount === 0) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white leading-none animate-pulse">
      {pendingCount}
    </span>
  );
}
