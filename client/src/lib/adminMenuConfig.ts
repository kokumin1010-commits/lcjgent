import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  Bot,
  Brain,
  BriefcaseBusiness,
  Building2,
  Calendar,
  Calculator,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Coins,
  CreditCard,
  Crown,
  FileSpreadsheet,
  FileText,
  Film,
  FlaskConical,
  Gift,
  Globe,
  Handshake,
  Heart,
  History,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Mic,
  Newspaper,
  Package,
  Palette,
  PartyPopper,
  Receipt,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  TrendingUp,
  UserCheck,
  UserCog,
  UserRoundCog,
  Users,
  Video,
  Wallet,
} from "lucide-react";

export type AdminMenuLanguage = "zh" | "ja";
export type AdminMenuBadgeType = "brand" | "adForm" | "chat";
export type AdminMenuGroupId =
  | "my-work"
  | "hr"
  | "finance"
  | "business"
  | "short-video"
  | "operations"
  | "procurement"
  | "influencer"
  | "it"
  | "design"
  | "ads";

export type AdminMenuItem = {
  icon: LucideIcon;
  path: string;
  labelZh: string;
  labelJa: string;
  adminOnly?: boolean;
  badgeType?: AdminMenuBadgeType;
};

export type AdminMenuGroup = {
  id: AdminMenuGroupId;
  icon: LucideIcon;
  labelZh: string;
  labelJa: string;
  activeClassName: string;
  items: AdminMenuItem[];
};

export type AdminMenuPermission = {
  pageKey: string;
  canView: boolean | number | string;
};

export type AdminMenuPermissionsData =
  | {
      isAdmin?: boolean;
      permissions?: AdminMenuPermission[] | null;
    }
  | null
  | undefined;

export const ADMIN_MENU_GROUPS: AdminMenuGroup[] = [
  {
    id: "my-work",
    icon: LayoutDashboard,
    labelZh: "我的工作",
    labelJa: "マイワーク",
    activeClassName: "bg-amber-50 text-amber-700",
    items: [
      {
        icon: ClipboardList,
        path: "/master/tasks",
        labelZh: "任务列表",
        labelJa: "タスク一覧",
      },
      {
        icon: AlertCircle,
        path: "/master/issues",
        labelZh: "问题处理",
        labelJa: "問題処理",
      },
      {
        icon: FileText,
        path: "/master/reports",
        labelZh: "日报",
        labelJa: "レポート（日報）",
      },
      {
        icon: Brain,
        path: "/master/report-analysis",
        labelZh: "日报AI分析",
        labelJa: "レポートAI分析",
      },
      {
        icon: UserCog,
        path: "/master/report-staff",
        labelZh: "日报员工",
        labelJa: "レポートスタッフ",
      },
      {
        icon: Mic,
        path: "/master/morning-meeting",
        labelZh: "晨会录音",
        labelJa: "朝会録音",
      },
      {
        icon: MessageCircle,
        path: "/master/chat",
        labelZh: "聊天",
        labelJa: "チャット",
        badgeType: "chat",
      },
      {
        icon: Sparkles,
        path: "/master/lcj-brain",
        labelZh: "LCJ Brain（BD引擎）",
        labelJa: "LCJ Brain（BDエンジン）",
      },
      { icon: Calendar, path: "/s", labelZh: "日历", labelJa: "カレンダー" },
      {
        icon: Calendar,
        path: "/staff-schedule",
        labelZh: "员工日程",
        labelJa: "スタッフスケジュール",
      },
    ],
  },
  {
    id: "operations",
    icon: Store,
    labelZh: "运营部",
    labelJa: "運営部",
    activeClassName: "bg-emerald-50 text-emerald-700",
    items: [
      {
        icon: FlaskConical,
        path: "/master/product-lab",
        labelZh: "24H爆速商品实验室",
        labelJa: "24H爆速商品ラボ",
      },
      {
        icon: Store,
        path: "/master/store-management",
        labelZh: "店铺管理",
        labelJa: "店舗管理",
      },
      {
        icon: ShoppingBag,
        path: "/master/selection-center",
        labelZh: "选品中心",
        labelJa: "選品センター",
      },
      {
        icon: Star,
        path: "/master/featured-products",
        labelZh: "重点商品管理",
        labelJa: "重点商品管理",
      },
      {
        icon: ClipboardCheck,
        path: "/master/sales-check",
        labelZh: "销售检查",
        labelJa: "売上チェック",
      },
      {
        icon: BarChart3,
        path: "/tiktok-competitor-daily",
        labelZh: "TikTok竞品日报",
        labelJa: "TikTok競合日報",
      },
      {
        icon: Package,
        path: "/master/set-applications",
        labelZh: "套组申请管理",
        labelJa: "セット申請管理",
      },
      {
        icon: Sparkles,
        path: "/master/set-suggestions",
        labelZh: "套组提案管理",
        labelJa: "セット提案管理",
      },
      {
        icon: Store,
        path: "/master/mall",
        labelZh: "LCJ MALL",
        labelJa: "LCJ MALL",
      },
    ],
  },
  {
    id: "procurement",
    icon: ShoppingBag,
    labelZh: "采购部",
    labelJa: "調達部",
    activeClassName: "bg-cyan-50 text-cyan-700",
    items: [
      {
        icon: Package,
        path: "/master/selection-center?tab=products",
        labelZh: "库存管理",
        labelJa: "在庫管理",
      },
      {
        icon: Gift,
        path: "/master/sample-requests",
        labelZh: "样品管理",
        labelJa: "サンプル管理",
      },
      {
        icon: Calculator,
        path: "/master/selection-center?tab=cost-management",
        labelZh: "成本管理",
        labelJa: "原価管理",
      },
      {
        icon: Heart,
        path: "/master/product-requests",
        labelZh: "到货需求",
        labelJa: "入荷リクエスト",
      },
    ],
  },
  {
    id: "business",
    icon: BriefcaseBusiness,
    labelZh: "商务部",
    labelJa: "商務部",
    activeClassName: "bg-violet-50 text-violet-700",
    items: [
      {
        icon: Building2,
        path: "/master/brands",
        labelZh: "品牌管理",
        labelJa: "ブランド管理",
      },
      {
        icon: Tag,
        path: "/master/brand-addition-logs",
        labelZh: "品牌添加记录",
        labelJa: "ブランド追加ログ",
      },
      {
        icon: Handshake,
        path: "/master/recruitment",
        labelZh: "招商管理",
        labelJa: "招商管理",
      },
      {
        icon: TrendingUp,
        path: "/master/influencer-bd",
        labelZh: "达人BD管理",
        labelJa: "達人BD管理",
      },
      {
        icon: Inbox,
        path: "/master/brand-applications",
        labelZh: "品牌申请",
        labelJa: "ブランド申込フォーム一覧",
        badgeType: "brand",
      },
      {
        icon: CreditCard,
        path: "/master/business-cards",
        labelZh: "名片管理",
        labelJa: "名刺管理（TO B営業）",
      },
      {
        icon: MessageSquare,
        path: "/master/line",
        labelZh: "LINE管理",
        labelJa: "LINE管理",
      },
      {
        icon: PartyPopper,
        path: "/master/festival",
        labelZh: "LCF活动管理",
        labelJa: "LCFイベント申込管理",
      },
      {
        icon: Globe,
        path: "/master/brand-portal",
        labelZh: "品牌门户",
        labelJa: "ブランドポータル",
      },
      {
        icon: Newspaper,
        path: "/master/blog",
        labelZh: "博客管理",
        labelJa: "ブログ管理",
      },
      {
        icon: Megaphone,
        path: "/master/referral",
        labelZh: "推荐码管理",
        labelJa: "紹介コード管理",
        adminOnly: true,
      },
      {
        icon: Mail,
        path: "/master/step-email",
        labelZh: "步骤邮件",
        labelJa: "ステップメール",
      },
      {
        icon: History,
        path: "/master/step-email/logs",
        labelZh: "发送记录",
        labelJa: "送信履歴",
      },
      {
        icon: TrendingUp,
        path: "/master/step-email/analytics",
        labelZh: "邮件分析",
        labelJa: "メールアナリティクス",
      },
    ],
  },
  {
    id: "influencer",
    icon: UserCheck,
    labelZh: "达人部",
    labelJa: "達人部",
    activeClassName: "bg-pink-50 text-pink-700",
    items: [
      {
        icon: Video,
        path: "/master/livers",
        labelZh: "主播管理",
        labelJa: "ライバー管理",
      },
      {
        icon: UserCheck,
        path: "/master/livers-dashboard",
        labelZh: "主播司令塔",
        labelJa: "ライバー司令塔",
      },
      {
        icon: Bot,
        path: "/master/ai-coach",
        labelZh: "主播成长面板",
        labelJa: "ライバー成長ダッシュボード",
      },
      {
        icon: Crown,
        path: "/master/mega-channel",
        labelZh: "Mega Channel管理",
        labelJa: "メガチャンネル管理",
      },
      {
        icon: Building2,
        path: "/master/agencies",
        labelZh: "机构管理",
        labelJa: "事務所管理",
      },
      {
        icon: Calculator,
        path: "/master/simulator",
        labelZh: "直播模拟器",
        labelJa: "配信シミュレーター",
      },
      {
        icon: Sparkles,
        path: "/master/live-suggestions",
        labelZh: "AI直播建议",
        labelJa: "AI配信提案",
      },
      {
        icon: FileSpreadsheet,
        path: "/master/rundown",
        labelZh: "直播Rundown",
        labelJa: "配信Rundown",
      },
    ],
  },
  {
    id: "ads",
    icon: Megaphone,
    labelZh: "广告投流部",
    labelJa: "広告運用部",
    activeClassName: "bg-indigo-50 text-indigo-700",
    items: [
      {
        icon: Megaphone,
        path: "/master/ad-form-submissions",
        labelZh: "广告申请",
        labelJa: "広告申込フォーム一覧",
        badgeType: "adForm",
      },
      {
        icon: BarChart3,
        path: "/master/ad-dashboard",
        labelZh: "广告司令塔",
        labelJa: "広告司令塔",
      },
    ],
  },
  {
    id: "it",
    icon: Settings,
    labelZh: "IT部",
    labelJa: "IT部",
    activeClassName: "bg-slate-100 text-slate-700",
    items: [
      {
        icon: KeyRound,
        path: "/master/account-management",
        labelZh: "账号管理",
        labelJa: "アカウント管理",
      },
      {
        icon: Users,
        path: "/master/system-users",
        labelZh: "员工账号管理",
        labelJa: "スタッフアカウント",
        adminOnly: true,
      },
      {
        icon: Settings,
        path: "/master/control",
        labelZh: "系统控制",
        labelJa: "マスターコントロール",
      },
    ],
  },
  {
    id: "design",
    icon: Palette,
    labelZh: "设计部",
    labelJa: "デザイン部",
    activeClassName: "bg-fuchsia-50 text-fuchsia-700",
    items: [
      {
        icon: Palette,
        path: "/master/set-image-generator",
        labelZh: "套组图片生成",
        labelJa: "セット画像生成",
      },
    ],
  },
  {
    id: "finance",
    icon: CircleDollarSign,
    labelZh: "财务部",
    labelJa: "財務部",
    activeClassName: "bg-blue-50 text-blue-700",
    items: [
      {
        icon: Wallet,
        path: "/master/finance",
        labelZh: "财务管理",
        labelJa: "ファイナンス管理",
      },
      {
        icon: Receipt,
        path: "/master/receipts",
        labelZh: "收据管理",
        labelJa: "レシート管理",
      },
      {
        icon: BarChart3,
        path: "/master/receipt-analytics",
        labelZh: "收据分析",
        labelJa: "レシート分析",
      },
      {
        icon: Coins,
        path: "/master/lcj-coin",
        labelZh: "LCJ Coin",
        labelJa: "LCJコイン",
      },
      {
        icon: ShoppingBag,
        path: "/master/buyback",
        labelZh: "回购管理",
        labelJa: "買取管理",
      },
    ],
  },
  {
    id: "hr",
    icon: Users,
    labelZh: "人事部",
    labelJa: "人事部",
    activeClassName: "bg-orange-50 text-orange-700",
    items: [
      {
        icon: UserRoundCog,
        path: "/master/hr",
        labelZh: "人事管理（HR）",
        labelJa: "人事管理（HR）",
      },
      {
        icon: Users,
        path: "/master/staff",
        labelZh: "员工名册",
        labelJa: "担当者名簿",
      },
    ],
  },
  {
    id: "short-video",
    icon: Film,
    labelZh: "短视频运营部",
    labelJa: "短動画運営部",
    activeClassName: "bg-rose-50 text-rose-700",
    items: [
      {
        icon: Video,
        path: "/master/short-video",
        labelZh: "短视频矩阵",
        labelJa: "短動画マトリックス",
      },
      {
        icon: ClipboardList,
        path: "/master/short-video?tab=daily",
        labelZh: "短视频日报",
        labelJa: "短動画日報",
      },
    ],
  },
];

export const ADMIN_MENU_GROUP_IDS = ADMIN_MENU_GROUPS.map(group => group.id);
export const ADMIN_MENU_ITEMS = ADMIN_MENU_GROUPS.flatMap(group => group.items);

export function normalizeAdminMenuPath(path: string): string {
  return path.split(/[?#]/, 1)[0] || "/";
}

function adminMenuQueryMatches(
  locationPath: string,
  menuPath: string
): boolean {
  const menuQuery = menuPath.split("?", 2)[1]?.split("#", 1)[0];
  if (!menuQuery) return true;
  const locationQuery = locationPath.split("?", 2)[1]?.split("#", 1)[0] || "";
  const locationParams = new URLSearchParams(locationQuery);
  const menuParams = new URLSearchParams(menuQuery);
  return [...menuParams.entries()].every(
    ([key, value]) => locationParams.get(key) === value
  );
}

export function getActiveAdminMenuItem(
  path: string
): AdminMenuItem | undefined {
  const normalizedPath = normalizeAdminMenuPath(path);
  return [...ADMIN_MENU_ITEMS]
    .sort((left, right) => right.path.length - left.path.length)
    .find(item => {
      const normalizedItemPath = normalizeAdminMenuPath(item.path);
      const pathMatches =
        normalizedPath === normalizedItemPath ||
        normalizedPath.startsWith(`${normalizedItemPath}/`);
      return pathMatches && adminMenuQueryMatches(path, item.path);
    });
}

export function getAdminMenuGroupId(
  path: string
): AdminMenuGroupId | undefined {
  if (normalizeAdminMenuPath(path) === "/master") return "my-work";
  const activeItem = getActiveAdminMenuItem(path);
  return ADMIN_MENU_GROUPS.find(group =>
    group.items.some(item => item.path === activeItem?.path)
  )?.id;
}

export function getAdminMenuGroupLabel(
  groupId: string,
  language: AdminMenuLanguage
): string {
  const group = ADMIN_MENU_GROUPS.find(candidate => candidate.id === groupId);
  if (!group) return groupId;
  return language === "zh" ? group.labelZh : group.labelJa;
}

export function getAdminMenuItemLabel(
  item: AdminMenuItem,
  language: AdminMenuLanguage
): string {
  return language === "zh" ? item.labelZh : item.labelJa;
}

export function permissionMatchesMenuPath(
  permissionPath: string,
  menuPath: string
): boolean {
  const normalizedPermissionPath = normalizeAdminMenuPath(permissionPath);
  const normalizedMenuPath = normalizeAdminMenuPath(menuPath);
  if (normalizedPermissionPath === normalizedMenuPath) {
    const permissionHasQuery = permissionPath.includes("?");
    return !permissionHasQuery || adminMenuQueryMatches(menuPath, permissionPath);
  }
  if (normalizedPermissionPath === "/master") return false;
  return normalizedMenuPath.startsWith(`${normalizedPermissionPath}/`);
}

export function canViewDepartmentMenuItem(options: {
  path: string;
  adminOnly?: boolean;
  userRole?: string | null;
  permissionsData: AdminMenuPermissionsData;
  permissionsLoading: boolean;
}): boolean {
  const { path, adminOnly, userRole, permissionsData, permissionsLoading } =
    options;
  const isAdmin = userRole === "admin" || permissionsData?.isAdmin === true;
  if (isAdmin) return true;
  if (adminOnly) return false;
  if (permissionsLoading || !permissionsData) return false;
  if (
    permissionsData.permissions === null ||
    permissionsData.permissions === undefined
  )
    return true;
  return permissionsData.permissions.some(
    permission =>
      (permission.canView === true ||
        permission.canView === 1 ||
        permission.canView === "1") &&
      permissionMatchesMenuPath(permission.pageKey, path)
  );
}
