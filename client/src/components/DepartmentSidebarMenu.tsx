import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  ADMIN_MENU_GROUPS,
  canViewDepartmentMenuItem,
  getActiveAdminMenuItem,
  getAdminMenuGroupId,
  getAdminMenuGroupLabel,
  getAdminMenuItemLabel,
  type AdminMenuBadgeType,
  type AdminMenuGroupId,
  type AdminMenuItem,
  type AdminMenuLanguage,
  type AdminMenuPermissionsData,
} from "@/lib/adminMenuConfig";
import { trpc } from "@/lib/trpc";
import { Brain, ChevronDown, ChevronsUpDown, Loader2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LCF_REQUIRED_ROLE_QUESTIONS } from "../../../shared/lcfRequiredUsage";

const OPEN_GROUPS_KEY = "lcj-admin-menu-open-groups-v1";
const DEFAULT_LCF_REQUIRED_QUESTION = LCF_REQUIRED_ROLE_QUESTIONS[0];

type DepartmentSidebarMenuProps = {
  language: AdminMenuLanguage;
  location: string;
  userRole?: string | null;
  permissionsData: AdminMenuPermissionsData;
  permissionsLoading: boolean;
  onNavigate: (path: string) => void;
};

function readSavedOpenGroups(
  activeGroupId: AdminMenuGroupId | undefined
): Record<string, boolean> {
  const defaults: Record<string, boolean> = { "my-work": true };
  if (activeGroupId) defaults[activeGroupId] = true;
  try {
    const saved = localStorage.getItem(OPEN_GROUPS_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Record<string, boolean>;
    return {
      ...defaults,
      ...parsed,
      ...(activeGroupId ? { [activeGroupId]: true } : {}),
    };
  } catch {
    return defaults;
  }
}

export function DepartmentSidebarMenu({
  language,
  location,
  userRole,
  permissionsData,
  permissionsLoading,
  onNavigate,
}: DepartmentSidebarMenuProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const activeGroupId = getAdminMenuGroupId(location);
  const activeMenuPath = getActiveAdminMenuItem(location)?.path;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    readSavedOpenGroups(activeGroupId)
  );
  const topUsage = trpc.userNavigationUsage.top.useQuery(undefined, {
    enabled: !permissionsLoading,
    staleTime: 30_000,
  });
  const recordUsage = trpc.userNavigationUsage.record.useMutation({
    onSuccess: () => void topUsage.refetch(),
  });
  const requiredBrainUsage =
    trpc.lcjBrain.getLcfRequiredUsageStatus.useQuery(undefined, {
      enabled: !permissionsLoading,
      staleTime: 15_000,
    });

  const visibleGroups = useMemo(
    () =>
      ADMIN_MENU_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item =>
          canViewDepartmentMenuItem({
            path: item.path,
            adminOnly: item.adminOnly,
            userRole,
            permissionsData,
            permissionsLoading,
          })
        ),
      })).filter(group => group.items.length > 0),
    [permissionsData, permissionsLoading, userRole]
  );
  const visibleItemMap = useMemo(
    () =>
      new Map<string, AdminMenuItem>(
        visibleGroups
          .flatMap(group => group.items)
          .map(item => [item.path, item])
      ),
    [visibleGroups]
  );
  const frequentItems = useMemo(
    () =>
      (topUsage.data || [])
        .map(usage => {
          const item = visibleItemMap.get(usage.path);
          return item ? { item, clickCount: usage.clickCount } : null;
        })
        .filter(
          (entry): entry is { item: AdminMenuItem; clickCount: number } =>
            entry !== null
        )
        .slice(0, 5),
    [topUsage.data, visibleItemMap]
  );
  const navigateAndRecord = (path: string) => {
    recordUsage.mutate({ path });
    onNavigate(path);
  };

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups(current => ({ ...current, [activeGroupId]: true }));
  }, [activeGroupId]);

  useEffect(() => {
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  if (permissionsLoading && userRole !== "admin") {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {!isCollapsed
          ? language === "zh"
            ? "正在读取菜单权限"
            : "メニュー権限を確認中"
          : null}
      </div>
    );
  }

  const allExpanded =
    visibleGroups.length > 0 &&
    visibleGroups.every(group => openGroups[group.id]);
  const toggleAll = () => {
    setOpenGroups(
      Object.fromEntries(visibleGroups.map(group => [group.id, !allExpanded]))
    );
  };

  return (
    <div className="px-2 py-2">
      <SidebarMenu className="gap-1">
        <li className="sticky top-0 z-20 mb-2 space-y-1 rounded-xl border border-amber-200/70 bg-amber-50/95 p-1.5 shadow-sm backdrop-blur group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-sidebar group-data-[collapsible=icon]:p-0">
          {!requiredBrainUsage.isLoading &&
          !requiredBrainUsage.data?.completed ? (
            <ul className="space-y-1">
              <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                onClick={() =>
                  onNavigate(
                    `/master/lcj-brain?tab=chat&required=1&roleId=${DEFAULT_LCF_REQUIRED_QUESTION.id}&prompt=${encodeURIComponent(DEFAULT_LCF_REQUIRED_QUESTION.question)}`
                  )
                }
                tooltip={
                  language === "zh"
                    ? "必做：完成一次LCJ Brain负责人提问"
                    : "必須：LCJ Brainで責任者質問を1回完了"
                }
                className="h-auto min-h-10 rounded-lg border border-violet-300/70 bg-violet-100/90 py-2 text-violet-950 hover:bg-violet-200"
                data-testid="required-lcj-brain-question"
              >
                <Brain className="h-4 w-4 shrink-0 text-violet-700" />
                {!isCollapsed ? (
                  <span className="leading-4">
                    {language === "zh"
                      ? "必做：向LCJ Brain提问"
                      : "必須：LCJ Brainに質問"}
                  </span>
                ) : null}
              </SidebarMenuButton>
              </SidebarMenuItem>
            </ul>
          ) : null}
          <div className="flex h-8 items-center gap-2 px-2 text-xs font-semibold text-amber-700 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Zap className="h-3.5 w-3.5 shrink-0" />
            {!isCollapsed ? (
              <span>
                {language === "zh"
                  ? "我的常用 · 前5项"
                  : "よく使う項目 · TOP 5"}
              </span>
            ) : null}
          </div>
          <ul className="space-y-1">
            {frequentItems.length ? (
              frequentItems.map(({ item, clickCount }) => {
                const ItemIcon = item.icon;
                const isActive = activeMenuPath === item.path;
                const label = getAdminMenuItemLabel(item, language);
                return (
                  <SidebarMenuItem key={`frequent-${item.path}`}>
                    <SidebarMenuButton
                      type="button"
                      isActive={isActive}
                      onClick={() => navigateAndRecord(item.path)}
                      tooltip={label}
                      className="h-8 rounded-md text-[13px] font-medium"
                    >
                      <ItemIcon
                        className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-amber-600"}`}
                      />
                      <span>{label}</span>
                      {!isCollapsed ? (
                        <span className="ml-auto text-[10px] tabular-nums text-amber-700/60">
                          {clickCount}
                        </span>
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })
            ) : !isCollapsed ? (
              <p className="px-2 pb-1 text-[11px] leading-4 text-amber-700/55">
                {topUsage.isLoading
                  ? language === "zh"
                    ? "正在读取个人常用项…"
                    : "個人の利用履歴を読込中…"
                  : topUsage.error
                    ? language === "zh"
                      ? "个人常用项暂时无法读取"
                      : "よく使う項目を取得できません"
                    : language === "zh"
                      ? "点击菜单后，会自动显示最常用的5项"
                      : "メニューを使うと、よく使う5項目が表示されます"}
              </p>
            ) : null}
          </ul>
        </li>
        {visibleGroups.map(group => {
          const GroupIcon = group.icon;
          const isOpen = openGroups[group.id] === true;
          const groupIsActive = group.id === activeGroupId;
          return (
            <div key={group.id} className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  onClick={() =>
                    setOpenGroups(current => ({
                      ...current,
                      [group.id]: !isOpen,
                    }))
                  }
                  tooltip={getAdminMenuGroupLabel(group.id, language)}
                  aria-expanded={isOpen}
                  className={`h-9 rounded-lg font-medium transition-colors ${
                    groupIsActive
                      ? group.activeClassName
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span>{getAdminMenuGroupLabel(group.id, language)}</span>
                  <ChevronDown
                    className={`ml-auto h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isOpen ? (
                <div
                  className={
                    isCollapsed
                      ? "space-y-1"
                      : "ml-3 border-l border-border/70 pl-2 space-y-1"
                  }
                >
                  {group.items.map(item => {
                    const ItemIcon = item.icon;
                    const isActive = activeMenuPath === item.path;
                    const label = getAdminMenuItemLabel(item, language);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          type="button"
                          isActive={isActive}
                          onClick={() => navigateAndRecord(item.path)}
                          tooltip={label}
                          className="h-8 rounded-md text-[13px] font-normal"
                        >
                          <ItemIcon
                            className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : ""}`}
                          />
                          <span>{label}</span>
                          {item.badgeType ? (
                            <MenuBadge type={item.badgeType} />
                          ) : null}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </SidebarMenu>

      {visibleGroups.length > 1 ? (
        <button
          type="button"
          onClick={toggleAll}
          className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-lg text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-data-[collapsible=icon]:px-0"
          title={
            allExpanded
              ? language === "zh"
                ? "全部收起"
                : "すべて閉じる"
              : language === "zh"
                ? "展开全部"
                : "すべて展開"
          }
        >
          <ChevronsUpDown className="h-3.5 w-3.5" />
          {!isCollapsed ? (
            <span>
              {allExpanded
                ? language === "zh"
                  ? "全部收起"
                  : "すべて閉じる"
                : language === "zh"
                  ? "展开全部"
                  : "すべて展開"}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

function MenuBadge({ type }: { type: AdminMenuBadgeType }) {
  if (type === "adForm") return <AdFormBadge />;
  if (type === "chat") return <ChatBadge />;
  return <BrandAppBadge />;
}

function AdFormBadge() {
  const { data: stats } = trpc.adForm.stats.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const pendingCount = stats?.pending ?? 0;
  if (pendingCount === 0) return null;
  return <CountBadge count={pendingCount} className="bg-pink-500" />;
}

function ChatBadge() {
  const { data } = trpc.chat.getUnreadCount.useQuery(undefined, {
    refetchInterval: 10_000,
  });
  const unreadCount = data?.unreadCount ?? 0;
  if (unreadCount === 0) return null;
  return <CountBadge count={unreadCount} className="bg-emerald-500" />;
}

function BrandAppBadge() {
  const { data: stats } = trpc.brandSample.stats.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const pendingCount = (stats?.pending ?? 0) + (stats?.reviewing ?? 0);
  if (pendingCount === 0) return null;
  return <CountBadge count={pendingCount} className="bg-red-500" />;
}

function CountBadge({
  count,
  className,
}: {
  count: number;
  className: string;
}) {
  return (
    <span
      className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white ${className}`}
    >
      {count}
    </span>
  );
}
