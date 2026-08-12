/**
 * PermissionGate - Wraps page content and shows "no permission" if user lacks access
 * Shows a request button that notifies the admin (yanghao)
 */
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Send, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PermissionGateProps {
  pageKey: string;
  pageName: string;
  children: React.ReactNode;
}

export function PermissionGate({ pageKey, pageName, children }: PermissionGateProps) {
  const { language } = useLanguage();
  const isZh = language === "zh";
  const [requested, setRequested] = useState(false);

  const myPermsQuery = trpc.rbac.myPermissions.useQuery();
  const requestMutation = trpc.rbac.requestPermission.useMutation({
    onSuccess: () => {
      setRequested(true);
      toast.success(isZh ? "申请已发送，等待审核" : "申請が送信されました。承認をお待ちください");
    },
    onError: (err) => toast.error(err.message),
  });

  // Still loading permissions
  if (myPermsQuery.isLoading) return <>{children}</>;

  const permsData = myPermsQuery.data;

  // Full access cases:
  if (!permsData) return <>{children}</>;
  // permissions === null means super admin (full access)
  if (permsData.permissions === null || permsData.permissions === undefined) return <>{children}</>;
  // isAdmin with empty permissions array = admin without specific restrictions
  if (permsData.isAdmin && Array.isArray(permsData.permissions) && permsData.permissions.length === 0) return <>{children}</>;

  // Check if user has permission for this page
  if (permsData.permissions) {
    const hasAccess = (permsData.permissions as any[]).some(
      (p: any) => p.pageKey === pageKey && p.canView
    );
    if (hasAccess) return <>{children}</>;
  }

  // No permission - show gate
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">
            {isZh ? "无访问权限" : "アクセス権限がありません"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isZh
              ? `您没有访问「${pageName}」的权限。如需使用此功能，请申请权限。`
              : `「${pageName}」へのアクセス権限がありません。この機能を使用するには、権限を申請してください。`}
          </p>
          <p className="text-xs text-muted-foreground">
            {isZh
              ? `当前角色: ${permsData.roleName || "未分配"}`
              : `現在のロール: ${permsData.roleName || "未割り当て"}`}
          </p>
          {requested ? (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">
                {isZh ? "申请已发送，等待管理员审核" : "申請済み。管理者の承認をお待ちください"}
              </span>
            </div>
          ) : (
            <Button
              onClick={() => requestMutation.mutate({ pageKey, pageName })}
              disabled={requestMutation.isPending}
              className="w-full"
            >
              {requestMutation.isPending ? (
                <span className="animate-spin mr-2">⏳</span>
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {isZh ? "申请访问权限" : "アクセス権限を申請"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
