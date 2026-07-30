/**
 * System User Management Page - 后台员工账号管理
 * 
 * Admin-only page for managing staff/employee login accounts:
 * - Only shows users whose email matches staff table (employees)
 * - View with department/position info
 * - Change user roles (admin/user)
 * - Disable/enable accounts
 * - Delete accounts
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Users,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  UserCog,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const i18n = {
  ja: {
    title: "スタッフアカウント管理",
    subtitle: "バックエンドを使用するスタッフのログインアカウントを管理",
    search: "メール・名前・部署で検索...",
    roleFilter: "ロールフィルター",
    statusFilter: "ステータスフィルター",
    all: "すべて",
    admin: "管理者",
    user: "一般ユーザー",
    active: "アクティブ",
    disabled: "無効",
    email: "メールアドレス",
    name: "名前",
    department: "部署",
    position: "役職",
    role: "ロール",
    status: "ステータス",
    lastSignedIn: "最終ログイン",
    actions: "操作",
    promoteToAdmin: "管理者に昇格",
    demoteToUser: "一般ユーザーに降格",
    disableAccount: "アカウント無効化",
    enableAccount: "アカウント有効化",
    deleteAccount: "アカウント削除",
    confirmDelete: "本当にこのアカウントを削除しますか？この操作は取り消せません。",
    confirmDisable: "このアカウントを無効化しますか？ユーザーはログインできなくなります。",
    confirmEnable: "このアカウントを有効化しますか？",
    confirmRoleChange: "ロールを変更しますか？",
    cancel: "キャンセル",
    confirm: "確認",
    success: "操作が完了しました",
    error: "エラーが発生しました",
    totalStaff: "スタッフ数",
    adminCount: "管理者数",
    activeCount: "アクティブ",
    disabledCount: "無効アカウント",
    noUsers: "スタッフアカウントが見つかりません",
    refresh: "更新",
    resignedNote: "（退職済み）",
    disabledNote: "（手動無効化）",
    changeRole: "ロール変更",
  },
  zh: {
    title: "员工账号管理",
    subtitle: "管理使用后台的员工登录账号",
    search: "按邮箱、姓名或部门搜索...",
    roleFilter: "角色筛选",
    statusFilter: "状态筛选",
    all: "全部",
    admin: "管理员",
    user: "普通用户",
    active: "活跃",
    disabled: "已禁用",
    email: "邮箱地址",
    name: "姓名",
    department: "部门",
    position: "职位",
    role: "角色",
    status: "状态",
    lastSignedIn: "最后登录",
    actions: "操作",
    promoteToAdmin: "升级为管理员",
    demoteToUser: "降级为普通用户",
    disableAccount: "禁用账号",
    enableAccount: "启用账号",
    deleteAccount: "删除账号",
    confirmDelete: "确定要删除此账号吗？此操作不可撤销。",
    confirmDisable: "确定要禁用此账号吗？用户将无法登录。",
    confirmEnable: "确定要启用此账号吗？",
    confirmRoleChange: "确定要更改角色吗？",
    cancel: "取消",
    confirm: "确认",
    success: "操作成功",
    error: "操作失败",
    totalStaff: "员工数",
    adminCount: "管理员数",
    activeCount: "活跃账号",
    disabledCount: "已禁用",
    noUsers: "未找到员工账号",
    refresh: "刷新",
    resignedNote: "（已离职）",
    disabledNote: "（手动禁用）",
    changeRole: "更改角色",
  },
};

type ConfirmAction = {
  type: "delete" | "disable" | "enable" | "roleChange";
  userId: number;
  userName?: string;
  newRole?: "admin" | "user";
};

export default function SystemUserManagement() {
  const { language } = useLanguage();
  const { user: currentUser } = useAuth();
  const t = language === "zh" ? i18n.zh : i18n.ja;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.userManagement.list.useQuery({
    search: search || undefined,
    roleFilter,
    statusFilter,
  });

  const updateRoleMutation = trpc.userManagement.updateRole.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      utils.userManagement.list.invalidate();
      setConfirmAction(null);
    },
    onError: (err) => {
      toast.error(err.message || t.error);
    },
  });

  const disableMutation = trpc.userManagement.disable.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      utils.userManagement.list.invalidate();
      setConfirmAction(null);
    },
    onError: (err) => {
      toast.error(err.message || t.error);
    },
  });

  const enableMutation = trpc.userManagement.enable.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      utils.userManagement.list.invalidate();
      setConfirmAction(null);
    },
    onError: (err) => {
      toast.error(err.message || t.error);
    },
  });

  const deleteMutation = trpc.userManagement.delete.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      utils.userManagement.list.invalidate();
      setConfirmAction(null);
    },
    onError: (err) => {
      toast.error(err.message || t.error);
    },
  });

  const syncNamesMutation = trpc.userManagement.syncNames.useMutation({
    onSuccess: (data) => {
      toast.success(language === "zh" ? `名前同歩完成，更新了 ${data.updatedCount} 个账号` : `名前同期完了、${data.updatedCount}件更新`);
      utils.userManagement.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || t.error);
    },
  });

  const handleConfirm = () => {
    if (!confirmAction) return;
    switch (confirmAction.type) {
      case "delete":
        deleteMutation.mutate({ userId: confirmAction.userId });
        break;
      case "disable":
        disableMutation.mutate({ userId: confirmAction.userId });
        break;
      case "enable":
        enableMutation.mutate({ userId: confirmAction.userId });
        break;
      case "roleChange":
        if (confirmAction.newRole) {
          updateRoleMutation.mutate({ userId: confirmAction.userId, newRole: confirmAction.newRole });
        }
        break;
    }
  };

  const getConfirmMessage = () => {
    if (!confirmAction) return "";
    switch (confirmAction.type) {
      case "delete": return t.confirmDelete;
      case "disable": return t.confirmDisable;
      case "enable": return t.confirmEnable;
      case "roleChange": return t.confirmRoleChange;
    }
  };

  const isActionLoading = updateRoleMutation.isPending || disableMutation.isPending || enableMutation.isPending || deleteMutation.isPending;

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => syncNamesMutation.mutate()} disabled={syncNamesMutation.isPending}>
            <UserCheck className="h-4 w-4 mr-1" />
            {language === "zh" ? "同步HR姓名" : "HR名前同期"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {t.refresh}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.totalStaff}</p>
                <p className="text-xs text-muted-foreground">{t.totalStaff}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Shield className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.adminCount}</p>
                <p className="text-xs text-muted-foreground">{t.adminCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.activeCount}</p>
                <p className="text-xs text-muted-foreground">{t.activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.stats.disabledCount}</p>
                <p className="text-xs text-muted-foreground">{t.disabledCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t.roleFilter} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="admin">{t.admin}</SelectItem>
            <SelectItem value="user">{t.user}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t.statusFilter} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="active">{t.active}</SelectItem>
            <SelectItem value="disabled">{t.disabled}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.users.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-2 opacity-50" />
              <p>{t.noUsers}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.email}</TableHead>
                    <TableHead>{t.name}</TableHead>
                    <TableHead>{t.department}</TableHead>
                    <TableHead>{t.position}</TableHead>
                    <TableHead className="w-[100px]">{t.role}</TableHead>
                    <TableHead className="w-[100px]">{t.status}</TableHead>
                    <TableHead className="w-[150px]">{t.lastSignedIn}</TableHead>
                    <TableHead className="w-[80px] text-right">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.users.map((u) => (
                    <TableRow key={u.id} className={u.status === "disabled" ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{u.displayEmail}</span>
                          {u.email.startsWith("resigned_") && (
                            <span className="text-xs text-orange-500">{t.resignedNote}</span>
                          )}
                          {u.email.startsWith("disabled_") && (
                            <span className="text-xs text-red-500">{t.disabledNote}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{u.name || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.department || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.position || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-xs">
                          {u.role === "admin" ? (
                            <><Shield className="h-3 w-3 mr-1" />{t.admin}</>
                          ) : (
                            t.user
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.status === "active" ? "outline" : "destructive"}
                          className="text-xs"
                        >
                          {u.status === "active" ? t.active : t.disabled}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(u.lastSignedIn)}
                      </TableCell>
                      <TableCell className="text-right">
                        {currentUser?.id !== u.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {/* Role change */}
                              {u.role === "user" ? (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ type: "roleChange", userId: u.id, userName: u.name || u.displayEmail, newRole: "admin" })}
                                >
                                  <Shield className="h-4 w-4 mr-2 text-purple-500" />
                                  {t.promoteToAdmin}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ type: "roleChange", userId: u.id, userName: u.name || u.displayEmail, newRole: "user" })}
                                >
                                  <ShieldOff className="h-4 w-4 mr-2 text-orange-500" />
                                  {t.demoteToUser}
                                </DropdownMenuItem>
                              )}
                              {/* Enable/Disable */}
                              {u.status === "active" ? (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ type: "disable", userId: u.id, userName: u.name || u.displayEmail })}
                                >
                                  <UserX className="h-4 w-4 mr-2 text-red-500" />
                                  {t.disableAccount}
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => setConfirmAction({ type: "enable", userId: u.id, userName: u.name || u.displayEmail })}
                                >
                                  <UserCheck className="h-4 w-4 mr-2 text-green-500" />
                                  {t.enableAccount}
                                </DropdownMenuItem>
                              )}
                              {/* Delete */}
                              <DropdownMenuItem
                                onClick={() => setConfirmAction({ type: "delete", userId: u.id, userName: u.name || u.displayEmail })}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t.deleteAccount}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {confirmAction?.type === "delete" ? t.deleteAccount :
               confirmAction?.type === "disable" ? t.disableAccount :
               confirmAction?.type === "enable" ? t.enableAccount :
               t.changeRole}
            </DialogTitle>
            <DialogDescription>
              {getConfirmMessage()}
              {confirmAction?.userName && (
                <span className="block mt-2 font-medium text-foreground">
                  {confirmAction.userName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isActionLoading}>
              {t.cancel}
            </Button>
            <Button
              variant={confirmAction?.type === "delete" || confirmAction?.type === "disable" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={isActionLoading}
            >
              {isActionLoading && <RefreshCw className="h-4 w-4 mr-1 animate-spin" />}
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
