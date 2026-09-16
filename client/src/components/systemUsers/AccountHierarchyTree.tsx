import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Crown,
  GitBranch,
  History,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type Level = "employee" | "department_manager" | "super_admin";

type Account = {
  userId: number;
  name: string | null;
  email: string;
  department: string | null;
  position: string | null;
  status: "active" | "disabled";
  managementLevel: Level;
  managedDepartment: string | null;
  roleId: number | null;
  roleName: string | null;
  roleColor: string | null;
};

type Role = {
  id: number;
  name: string;
  description: string | null;
  color: string;
  isSystem: boolean;
  userCount: number;
  viewPermissionCount: number;
  editPermissionCount: number;
};

type RoleBranchData = {
  roleId: number | null;
  roleName: string;
  roleColor: string;
  accounts: Account[];
};

type DepartmentNode = {
  name: string;
  managers: Account[];
  roles: RoleBranchData[];
  accounts: Account[];
};

type HierarchyPayload = {
  summary: {
    accountCount: number;
    superAdminCount: number;
    departmentManagerCount: number;
    departmentCount: number;
    missingManagerCount: number;
  };
  superAdmins: Account[];
  departments: DepartmentNode[];
  roles: Role[];
};

type AuditLog = {
  id: number;
  actorName: string | null;
  targetType: "account" | "role" | "permission";
  targetId: string;
  targetName: string | null;
  action: string;
  beforeState: unknown;
  afterState: unknown;
  createdAt: string | Date;
};

type ManagementAccess = {
  userId: number;
  level: Level;
  managedDepartment: string | null;
  canManageAccounts: boolean;
  isSuperAdmin: boolean;
};

type Props = {
  isZh: boolean;
  access: ManagementAccess;
  onOpenRolePermissions: (roleId: number) => void;
};

const levelText = (level: Level, isZh: boolean) => {
  if (level === "super_admin") return isZh ? "超级管理员" : "スーパー管理者";
  if (level === "department_manager") return isZh ? "部门负责人" : "部門責任者";
  return isZh ? "员工" : "スタッフ";
};

function AccountButton({ account, onClick, isZh }: { account: Account; onClick: () => void; isZh: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-lg border bg-background px-3 py-2 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label={`${account.name || account.email} ${isZh ? "账号详情" : "アカウント詳細"}`}
      data-testid={`hierarchy-account-${account.userId}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{account.name || account.email}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{account.position || account.email}</span>
        </span>
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${account.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="text-[10px]">{levelText(account.managementLevel, isZh)}</Badge>
        {account.roleName && (
          <Badge className="text-[10px] text-white" style={{ backgroundColor: account.roleColor || "#64748b" }}>
            {account.roleName}
          </Badge>
        )}
      </span>
    </button>
  );
}

function RoleBranch({
  role,
  accounts,
  onAccount,
  onRole,
  isZh,
}: {
  role: RoleBranchData;
  accounts: Account[];
  onAccount: (account: Account) => void;
  onRole: (roleId: number) => void;
  isZh: boolean;
}) {
  return (
    <div className="relative border-l-2 border-slate-200 pl-4">
      <button
        type="button"
        onClick={() => role.roleId && onRole(role.roleId)}
        disabled={!role.roleId}
        className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-left transition hover:border-slate-400 disabled:cursor-default"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Shield className="h-4 w-4 shrink-0" style={{ color: role.roleColor }} />
          <span className="truncate text-sm font-medium">{role.roleName}</span>
        </span>
        <Badge variant="secondary" className="text-[10px]">{accounts.length}{isZh ? "人" : "名"}</Badge>
      </button>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map(account => (
          <AccountButton key={account.userId} account={account} onClick={() => onAccount(account)} isZh={isZh} />
        ))}
      </div>
    </div>
  );
}

export default function AccountHierarchyTree({ isZh, access, onOpenRolePermissions }: Props) {
  const [zoom, setZoom] = useState(1);
  const [collapsedDepartments, setCollapsedDepartments] = useState<Set<string>>(new Set());
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [draftLevel, setDraftLevel] = useState<Level>("employee");
  const [draftRole, setDraftRole] = useState("none");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const utils = trpc.useUtils();
  const hierarchyQuery = trpc.userManagement.hierarchy.useQuery();
  const auditQuery = trpc.userManagement.hierarchyAuditLogs.useQuery(
    { limit: 20 },
    { enabled: access.isSuperAdmin },
  );
  const updateMutation = trpc.userManagement.updateHierarchyAssignment.useMutation({
    onSuccess: () => {
      toast.success(isZh ? "账号层级与权限已更新" : "アカウント階層と権限を更新しました");
      utils.userManagement.hierarchy.invalidate();
      utils.userManagement.list.invalidate();
      utils.userManagement.hierarchyAuditLogs.invalidate();
      utils.rbac.myPermissions.invalidate();
      setConfirmOpen(false);
      setSelectedAccount(null);
    },
    onError: error => toast.error(error.message),
  });

  const data = hierarchyQuery.data as HierarchyPayload | undefined;
  const auditLogs = (auditQuery.data || []) as AuditLog[];
  const roles = useMemo<Role[]>(() => (data?.roles || []).filter(role => !role.isSystem), [data?.roles]);

  const openAccount = (account: Account) => {
    setSelectedAccount(account);
    setDraftLevel(account.managementLevel);
    setDraftRole(account.managementLevel === "super_admin" ? "none" : account.roleId ? String(account.roleId) : "none");
  };

  const setManagerForDepartment = (department: DepartmentNode) => {
    const candidate = department.accounts.find((account: Account) => account.managementLevel === "employee" && account.status === "active");
    if (!candidate) {
      toast.error(isZh ? "该部门没有可设置为负责人的有效员工账号" : "責任者に設定できる有効なスタッフがいません");
      return;
    }
    openAccount(candidate);
    setDraftLevel("department_manager");
  };

  const submitChange = () => {
    if (!selectedAccount) return;
    updateMutation.mutate({
      userId: selectedAccount.userId,
      managementLevel: draftLevel,
      roleId: draftLevel === "super_admin" || draftRole === "none" ? null : Number(draftRole),
      requestId: crypto.randomUUID(),
    });
  };

  if (hierarchyQuery.isLoading) {
    return <div className="flex justify-center py-20"><RefreshCw className="h-7 w-7 animate-spin text-muted-foreground" /></div>;
  }
  if (hierarchyQuery.error || !data) {
    return (
      <Card className="mt-4 border-red-200 bg-red-50/50"><CardContent className="p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-red-500" />
        <p className="font-medium">{isZh ? "无法加载账号层级" : "アカウント階層を読み込めません"}</p>
        <Button className="mt-3" variant="outline" onClick={() => hierarchyQuery.refetch()}>{isZh ? "重试" : "再試行"}</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="mt-4 space-y-4" data-testid="account-hierarchy-tree">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data.summary.accountCount}</p><p className="text-xs text-muted-foreground">{isZh ? "账号" : "アカウント"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-rose-600">{data.summary.superAdminCount}</p><p className="text-xs text-muted-foreground">{isZh ? "超级管理员" : "スーパー管理者"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-violet-600">{data.summary.departmentManagerCount}</p><p className="text-xs text-muted-foreground">{isZh ? "部门负责人" : "部門責任者"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data.summary.departmentCount}</p><p className="text-xs text-muted-foreground">{isZh ? "部门" : "部署"}</p></CardContent></Card>
        <Card className={data.summary.missingManagerCount ? "border-amber-300 bg-amber-50/60" : ""}><CardContent className="p-4"><p className="text-2xl font-bold text-amber-600">{data.summary.missingManagerCount}</p><p className="text-xs text-muted-foreground">{isZh ? "未配置负责人" : "責任者未設定"}</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><GitBranch className="h-5 w-5 text-blue-600" />{isZh ? "账号层级・权限树" : "アカウント階層・権限ツリー"}</h2>
          <p className="text-xs text-muted-foreground">{isZh ? "层级决定管理范围，功能角色决定页面访问。点击任意节点查看或调整。" : "階層は管理範囲、機能ロールはページアクセスを決定します。"}</p>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <Button size="icon" variant="outline" aria-label={isZh ? "缩小" : "縮小"} onClick={() => setZoom(value => Math.max(0.7, Number((value - 0.1).toFixed(1))))}><Minus className="h-4 w-4" /></Button>
          <Badge variant="outline">{Math.round(zoom * 100)}%</Badge>
          <Button size="icon" variant="outline" aria-label={isZh ? "放大" : "拡大"} onClick={() => setZoom(value => Math.min(1.3, Number((value + 0.1).toFixed(1))))}><Plus className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setZoom(1)}>{isZh ? "适配" : "フィット"}</Button>
        </div>
      </div>

      {access.isSuperAdmin && (
        <details className="rounded-xl border bg-white" data-testid="hierarchy-audit-history">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <span className="flex items-center gap-2"><History className="h-4 w-4 text-slate-600" />{isZh ? "最近权限变更（不可变审计）" : "最近の権限変更（改ざん不可監査）"}</span>
            <Badge variant="secondary">{auditLogs.length}</Badge>
          </summary>
          <div className="border-t px-4 py-3">
            {auditQuery.isLoading ? (
              <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : auditLogs.length ? (
              <div className="space-y-2">
                {auditLogs.map(log => (
                  <div key={log.id} className="grid gap-1 rounded-lg border bg-slate-50/70 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {log.action === "update_hierarchy_assignment"
                          ? (isZh ? "账号层级/角色变更" : "アカウント階層・ロール変更")
                          : log.action === "update_role_permissions"
                            ? (isZh ? "页面权限变更" : "ページ権限変更")
                            : (isZh ? "账号权限相关变更" : "アカウント権限関連変更")}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {(log.targetName || (log.targetType === "permission" ? `${isZh ? "功能角色" : "機能ロール"} #${log.targetId}` : `${isZh ? "账号" : "アカウント"} #${log.targetId}`))}
                        {log.actorName ? ` · ${isZh ? "操作人" : "実行者"}: ${log.actorName}` : ""}
                      </p>
                    </div>
                    <time className="text-muted-foreground">{new Date(log.createdAt).toLocaleString(isZh ? "zh-CN" : "ja-JP")}</time>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">{isZh ? "暂无权限变更记录" : "権限変更履歴はありません"}</p>
            )}
          </div>
        </details>
      )}

      <div className="overflow-x-auto rounded-xl border bg-white p-4 lg:p-6">
        <div className="min-w-0 lg:min-w-[980px]" style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
          <div className="mx-auto mb-5 max-w-md rounded-xl border-2 border-slate-300 bg-slate-950 px-5 py-4 text-center text-white shadow-lg">
            <GitBranch className="mx-auto mb-1 h-5 w-5" />
            <p className="font-semibold">LCJ MALL {isZh ? "账号权限体系" : "アカウント権限体系"}</p>
          </div>

          <div className="mb-6 border-t-2 border-slate-200 pt-5">
            <div className="mx-auto max-w-4xl rounded-xl border-2 border-rose-200 bg-rose-50/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-rose-600" /><span className="font-semibold">{isZh ? "超级管理员" : "スーパー管理者"}</span></div>
                <Badge className="bg-rose-600">{data.superAdmins.length}{isZh ? "人" : "名"}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.superAdmins.map((account: Account) => <AccountButton key={account.userId} account={account} onClick={() => openAccount(account)} isZh={isZh} />)}
              </div>
            </div>
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-2">
            {data.departments.map(department => {
              const collapsed = collapsedDepartments.has(department.name);
              return (
                <Card key={department.name} className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <button
                      type="button"
                      className="mb-3 flex w-full items-center justify-between gap-3 text-left"
                      onClick={() => setCollapsedDepartments(previous => {
                        const next = new Set(previous);
                        next.has(department.name) ? next.delete(department.name) : next.add(department.name);
                        return next;
                      })}
                    >
                      <span className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" /><span className="font-semibold">{department.name}</span><Badge variant="secondary">{department.accounts.length}{isZh ? "人" : "名"}</Badge></span>
                      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {!collapsed && (
                      <div className="space-y-4">
                        <div className={`rounded-lg border p-3 ${department.managers.length ? "border-violet-200 bg-violet-50/50" : "border-amber-300 bg-amber-50/70"}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-sm font-semibold"><UserCheck className="h-4 w-4 text-violet-600" />{isZh ? "部门负责人" : "部門責任者"}</span>
                            {!department.managers.length && access.isSuperAdmin && <Button size="sm" variant="outline" onClick={() => setManagerForDepartment(department)}>{isZh ? "设置负责人" : "責任者を設定"}</Button>}
                          </div>
                          {department.managers.length ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {department.managers.map((account: Account) => <AccountButton key={account.userId} account={account} onClick={() => openAccount(account)} isZh={isZh} />)}
                            </div>
                          ) : <p className="text-xs text-amber-700">{isZh ? "当前部门尚未配置负责人" : "この部署には責任者が設定されていません"}</p>}
                        </div>
                        <div className="space-y-3">
                          {department.roles.map(role => {
                            const employeeAccounts = role.accounts.filter(account => account.managementLevel !== "department_manager");
                            return employeeAccounts.length ? (
                              <RoleBranch key={role.roleId || "unassigned"} role={role} accounts={employeeAccounts} onAccount={openAccount} onRole={onOpenRolePermissions} isZh={isZh} />
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedAccount} onOpenChange={open => { if (!open && !confirmOpen) setSelectedAccount(null); }}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-lg">
          <DialogHeader>
            <DialogTitle>{isZh ? "账号层级与权限" : "アカウント階層と権限"}</DialogTitle>
            <DialogDescription>{selectedAccount?.name || selectedAccount?.email}</DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-5 py-2">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                <div><p className="text-xs text-muted-foreground">{isZh ? "HR部门" : "HR部署"}</p><p className="font-medium">{selectedAccount.department || "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">{isZh ? "账号状态" : "状態"}</p><p className="font-medium">{selectedAccount.status === "active" ? (isZh ? "有效" : "有効") : (isZh ? "已禁用" : "無効")}</p></div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{isZh ? "账号层级" : "アカウント階層"}</label>
                <Select value={draftLevel} onValueChange={value => setDraftLevel(value as Level)} disabled={!access.isSuperAdmin || (selectedAccount.userId === access.userId && selectedAccount.managementLevel === "super_admin")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">{isZh ? "员工" : "スタッフ"}</SelectItem>
                    <SelectItem value="department_manager" disabled={!selectedAccount.department}>{isZh ? "部门负责人（仅管理本人HR部门）" : "部門責任者（本人のHR部署のみ）"}</SelectItem>
                    <SelectItem value="super_admin">{isZh ? "超级管理员（全公司权限）" : "スーパー管理者（全社権限）"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{isZh ? "功能角色" : "機能ロール"}</label>
                <Select value={draftRole} onValueChange={setDraftRole} disabled={!access.isSuperAdmin || draftLevel === "super_admin"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{isZh ? "未分配角色" : "ロール未割当"}</SelectItem>
                    {roles.map(role => <SelectItem key={role.id} value={String(role.id)}>{role.name} · {role.viewPermissionCount}{isZh ? "项可见" : "件表示"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">{isZh ? "账号层级决定管理范围；功能角色决定可以查看或编辑哪些页面。" : "階層は管理範囲、機能ロールはページアクセスを決定します。"}</p>
              </div>
              {draftLevel === "department_manager" && (
                <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800"><Building2 className="mr-2 inline h-4 w-4" />{isZh ? `将负责 ${selectedAccount.department}，不能管理其他部门。` : `${selectedAccount.department} のみ管理します。`}</div>
              )}
              {draftLevel === "super_admin" && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><Crown className="mr-2 inline h-4 w-4" />{isZh ? "将获得全公司账号、角色和权限管理能力。" : "全社のアカウント・ロール・権限管理が可能になります。"}</div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAccount(null)}>{isZh ? "取消" : "キャンセル"}</Button>
            {access.isSuperAdmin && <Button onClick={() => setConfirmOpen(true)} disabled={updateMutation.isPending}><Lock className="mr-1 h-4 w-4" />{isZh ? "确认调整" : "変更確認"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />{isZh ? "确认权限变更" : "権限変更の確認"}</DialogTitle>
            <DialogDescription>{isZh ? "请确认变更前后差异。保存后会立即生效并写入审计记录。" : "変更差分を確認してください。保存後すぐに反映され、監査記録に保存されます。"}</DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-3 rounded-lg border p-4 text-sm">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="rounded bg-slate-50 p-3"><p className="text-xs text-muted-foreground">{isZh ? "变更前" : "変更前"}</p><p className="font-semibold">{levelText(selectedAccount.managementLevel, isZh)}</p><p>{selectedAccount.roleName || (isZh ? "未分配角色" : "ロール未割当")}</p></div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                <div className="rounded bg-blue-50 p-3"><p className="text-xs text-muted-foreground">{isZh ? "变更后" : "変更後"}</p><p className="font-semibold">{levelText(draftLevel, isZh)}</p><p>{draftLevel === "super_admin" ? (isZh ? "系统超级管理员" : "システムスーパー管理者") : roles.find(role => String(role.id) === draftRole)?.name || (isZh ? "未分配角色" : "ロール未割当")}</p></div>
              </div>
              <p className="flex items-center gap-2 text-xs text-emerald-700"><Check className="h-4 w-4" />{isZh ? "系统会验证最后一名超级管理员、部门范围与角色有效性。" : "最後のスーパー管理者、部署範囲、ロール有効性を検証します。"}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={updateMutation.isPending}>{isZh ? "返回" : "戻る"}</Button>
            <Button onClick={submitChange} disabled={updateMutation.isPending}>{updateMutation.isPending && <RefreshCw className="mr-1 h-4 w-4 animate-spin" />}{isZh ? "保存并记录审计" : "保存して監査記録"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
