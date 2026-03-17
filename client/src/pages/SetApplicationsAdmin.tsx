import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Calendar,
  DollarSign,
  User,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCheck,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";

// Types
interface SetApplicationItem {
  id: number;
  applicationId: number;
  productMasterId: number | null;
  productName: string;
  originalPrice: number;
  quantity: number;
  sortOrder: number | null;
  createdAt: string;
}

interface SetApplication {
  id: number;
  liverId: number;
  liverName: string;
  scheduledDate: string | null;
  livestreamId: number | null;
  setName: string;
  setPrice: number;
  totalOriginalPrice: number;
  discountRate: number;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  adminComment: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  items: SetApplicationItem[];
}

// Status config
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; badgeVariant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "審査待ち", color: "text-yellow-600", icon: Clock, badgeVariant: "secondary" },
  approved: { label: "承認済み", color: "text-green-600", icon: CheckCircle, badgeVariant: "default" },
  rejected: { label: "却下", color: "text-red-600", icon: XCircle, badgeVariant: "destructive" },
  revision_requested: { label: "修正依頼", color: "text-orange-600", icon: AlertTriangle, badgeVariant: "outline" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`;
}

export default function SetApplicationsAdmin() {
  // State
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailApp, setDetailApp] = useState<SetApplication | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject" | "revision"; app: SetApplication } | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // API Queries
  const { data: applications, isLoading, refetch } = trpc.setApplication.adminList.useQuery({
    status: statusFilter as any,
  }, {
    refetchOnWindowFocus: false,
  });

  const { data: stats } = trpc.setApplication.stats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Mutations
  const approveMutation = trpc.setApplication.approve.useMutation({
    onSuccess: () => {
      toast.success("申請を承認しました");
      refetch();
      setActionDialog(null);
      setAdminComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectMutation = trpc.setApplication.reject.useMutation({
    onSuccess: () => {
      toast.success("申請を却下しました");
      refetch();
      setActionDialog(null);
      setAdminComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const revisionMutation = trpc.setApplication.requestRevision.useMutation({
    onSuccess: () => {
      toast.success("修正依頼を送信しました");
      refetch();
      setActionDialog(null);
      setAdminComment("");
    },
    onError: (err) => toast.error(err.message),
  });

  const bulkApproveMutation = trpc.setApplication.bulkApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count}件の申請を一括承認しました`);
      refetch();
      setSelectedIds(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  // Filtered applications
  const filteredApps = useMemo(() => {
    if (!applications) return [];
    if (!searchKeyword.trim()) return applications;
    const kw = searchKeyword.toLowerCase();
    return applications.filter((app: SetApplication) =>
      app.liverName.toLowerCase().includes(kw) ||
      app.setName.toLowerCase().includes(kw) ||
      app.items.some((item: SetApplicationItem) => item.productName.toLowerCase().includes(kw))
    );
  }, [applications, searchKeyword]);

  // Handlers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pendingApps = filteredApps.filter((a: SetApplication) => a.status === "pending");
    if (selectedIds.size === pendingApps.length && pendingApps.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingApps.map((a: SetApplication) => a.id)));
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAction = (type: "approve" | "reject" | "revision", app: SetApplication) => {
    setAdminComment("");
    setActionDialog({ type, app });
  };

  const submitAction = () => {
    if (!actionDialog) return;
    const { type, app } = actionDialog;

    if (type === "approve") {
      approveMutation.mutate({ applicationId: app.id, adminComment: adminComment || undefined });
    } else if (type === "reject") {
      if (!adminComment.trim()) {
        toast.error("却下理由を入力してください");
        return;
      }
      rejectMutation.mutate({ applicationId: app.id, adminComment });
    } else if (type === "revision") {
      if (!adminComment.trim()) {
        toast.error("修正内容を入力してください");
        return;
      }
      revisionMutation.mutate({ applicationId: app.id, adminComment });
    }
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の申請を一括承認しますか？`)) return;
    bulkApproveMutation.mutate({ applicationIds: Array.from(selectedIds) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            セット申請管理
          </h1>
          <p className="text-muted-foreground mt-1">
            ライバーからのセット申請を確認・承認・却下できます
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          更新
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "all" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
          onClick={() => setStatusFilter("all")}
        >
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">全件</div>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "pending" ? "ring-2 ring-yellow-500" : "hover:shadow-md"}`}
          onClick={() => setStatusFilter("pending")}
        >
          <CardContent className="p-4">
            <div className="text-sm text-yellow-600 flex items-center gap-1">
              <Clock className="h-3 w-3" /> 審査待ち
            </div>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending ?? 0}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "approved" ? "ring-2 ring-green-500" : "hover:shadow-md"}`}
          onClick={() => setStatusFilter("approved")}
        >
          <CardContent className="p-4">
            <div className="text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> 承認済み
            </div>
            <div className="text-2xl font-bold text-green-600">{stats?.approved ?? 0}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "rejected" ? "ring-2 ring-red-500" : "hover:shadow-md"}`}
          onClick={() => setStatusFilter("rejected")}
        >
          <CardContent className="p-4">
            <div className="text-sm text-red-600 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> 却下
            </div>
            <div className="text-2xl font-bold text-red-600">{stats?.rejected ?? 0}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "revision_requested" ? "ring-2 ring-orange-500" : "hover:shadow-md"}`}
          onClick={() => setStatusFilter("revision_requested")}
        >
          <CardContent className="p-4">
            <div className="text-sm text-orange-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> 修正依頼
            </div>
            <div className="text-2xl font-bold text-orange-600">{stats?.revisionRequested ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Bulk Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ライバー名・セット名・商品名で検索..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
        {statusFilter === "pending" && selectedIds.size > 0 && (
          <Button onClick={handleBulkApprove} className="bg-green-600 hover:bg-green-700">
            <CheckCheck className="h-4 w-4 mr-1" />
            {selectedIds.size}件を一括承認
          </Button>
        )}
      </div>

      {/* Applications List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">読み込み中...</div>
          ) : filteredApps.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>該当する申請はありません</p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Select All (only for pending) */}
              {statusFilter === "pending" && filteredApps.some((a: SetApplication) => a.status === "pending") && (
                <div className="px-4 py-2 bg-muted/50 flex items-center gap-2">
                  <Checkbox
                    checked={
                      filteredApps.filter((a: SetApplication) => a.status === "pending").length > 0 &&
                      selectedIds.size === filteredApps.filter((a: SetApplication) => a.status === "pending").length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">全て選択</span>
                </div>
              )}

              {filteredApps.map((app: SetApplication) => {
                const statusConf = STATUS_CONFIG[app.status];
                const StatusIcon = statusConf.icon;
                const isExpanded = expandedRows.has(app.id);

                return (
                  <div key={app.id} className="hover:bg-muted/30 transition-colors">
                    {/* Main Row */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Checkbox (pending only) */}
                      {app.status === "pending" && (
                        <Checkbox
                          checked={selectedIds.has(app.id)}
                          onCheckedChange={() => toggleSelect(app.id)}
                        />
                      )}
                      {app.status !== "pending" && <div className="w-4" />}

                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpand(app.id)}
                        className="p-1 rounded hover:bg-muted"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>

                      {/* Status Badge */}
                      <Badge variant={statusConf.badgeVariant} className="min-w-[80px] justify-center">
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConf.label}
                      </Badge>

                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{app.setName}</span>
                          <span className="text-sm text-muted-foreground">
                            ({app.items.length}商品)
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {app.liverName}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatPrice(app.setPrice)}
                            <span className="text-xs">
                              (定価{formatPrice(app.totalOriginalPrice)} / {app.discountRate}%OFF)
                            </span>
                          </span>
                          {app.scheduledDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(app.scheduledDate)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="text-xs text-muted-foreground text-right hidden md:block">
                        <div>申請日</div>
                        <div>{formatDate(app.createdAt)}</div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailApp(app)}
                          title="詳細表示"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(app.status === "pending" || app.status === "revision_requested") && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleAction("approve", app)}
                              title="承認"
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              onClick={() => handleAction("revision", app)}
                              title="修正依頼"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleAction("reject", app)}
                              title="却下"
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <div className="px-4 pb-3 ml-12">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-muted-foreground border-b">
                                <th className="text-left py-1 font-medium">#</th>
                                <th className="text-left py-1 font-medium">商品名</th>
                                <th className="text-right py-1 font-medium">定価</th>
                                <th className="text-right py-1 font-medium">数量</th>
                                <th className="text-right py-1 font-medium">小計</th>
                              </tr>
                            </thead>
                            <tbody>
                              {app.items.map((item: SetApplicationItem, idx: number) => (
                                <tr key={item.id} className="border-b border-muted last:border-0">
                                  <td className="py-1.5">{idx + 1}</td>
                                  <td className="py-1.5">{item.productName}</td>
                                  <td className="py-1.5 text-right">{formatPrice(item.originalPrice)}</td>
                                  <td className="py-1.5 text-right">{item.quantity}</td>
                                  <td className="py-1.5 text-right font-medium">{formatPrice(item.originalPrice * item.quantity)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2">
                                <td colSpan={4} className="py-1.5 text-right font-medium">定価合計:</td>
                                <td className="py-1.5 text-right font-bold">{formatPrice(app.totalOriginalPrice)}</td>
                              </tr>
                              <tr>
                                <td colSpan={4} className="py-1.5 text-right font-medium text-primary">セット価格:</td>
                                <td className="py-1.5 text-right font-bold text-primary">{formatPrice(app.setPrice)}</td>
                              </tr>
                            </tfoot>
                          </table>
                          {app.memo && (
                            <div className="mt-2 pt-2 border-t text-sm">
                              <span className="text-muted-foreground">ライバーメモ: </span>
                              <span>{app.memo}</span>
                            </div>
                          )}
                          {app.adminComment && (
                            <div className="mt-2 pt-2 border-t text-sm">
                              <span className="text-muted-foreground">運営コメント: </span>
                              <span className="font-medium">{app.adminComment}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailApp} onOpenChange={(open) => !open && setDetailApp(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailApp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  セット申請詳細
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status & Basic Info */}
                <div className="flex items-center justify-between">
                  <Badge variant={STATUS_CONFIG[detailApp.status].badgeVariant} className="text-sm px-3 py-1">
                    {(() => { const Icon = STATUS_CONFIG[detailApp.status].icon; return <Icon className="h-4 w-4 mr-1" />; })()}
                    {STATUS_CONFIG[detailApp.status].label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">ID: {detailApp.id}</span>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">セット名</Label>
                    <div className="font-semibold">{detailApp.setName}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">ライバー</Label>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {detailApp.liverName}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">セット価格</Label>
                    <div className="font-bold text-lg text-primary">{formatPrice(detailApp.setPrice)}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">定価合計 / 割引率</Label>
                    <div>
                      {formatPrice(detailApp.totalOriginalPrice)}
                      <span className="ml-2 text-sm text-red-500 font-medium">{detailApp.discountRate}%OFF</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">配信予定日時</Label>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(detailApp.scheduledDate)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs">申請日時</Label>
                    <div>{formatDate(detailApp.createdAt)}</div>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <Label className="text-muted-foreground text-xs mb-2 block">セット内商品</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">#</th>
                          <th className="text-left px-3 py-2 font-medium">商品名</th>
                          <th className="text-right px-3 py-2 font-medium">定価</th>
                          <th className="text-right px-3 py-2 font-medium">数量</th>
                          <th className="text-right px-3 py-2 font-medium">小計</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailApp.items.map((item: SetApplicationItem, idx: number) => (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2">{item.productName}</td>
                            <td className="px-3 py-2 text-right">{formatPrice(item.originalPrice)}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatPrice(item.originalPrice * item.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/50">
                        <tr className="border-t-2">
                          <td colSpan={4} className="px-3 py-2 text-right font-medium">定価合計:</td>
                          <td className="px-3 py-2 text-right font-bold">{formatPrice(detailApp.totalOriginalPrice)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right font-medium text-primary">セット価格:</td>
                          <td className="px-3 py-2 text-right font-bold text-primary text-lg">{formatPrice(detailApp.setPrice)}</td>
                        </tr>
                        <tr>
                          <td colSpan={4} className="px-3 py-2 text-right font-medium text-red-500">割引額:</td>
                          <td className="px-3 py-2 text-right font-bold text-red-500">
                            -{formatPrice(detailApp.totalOriginalPrice - detailApp.setPrice)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Memo */}
                {detailApp.memo && (
                  <div>
                    <Label className="text-muted-foreground text-xs mb-1 block">ライバーメモ</Label>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">{detailApp.memo}</div>
                  </div>
                )}

                {/* Admin Comment */}
                {detailApp.adminComment && (
                  <div>
                    <Label className="text-muted-foreground text-xs mb-1 block">運営コメント</Label>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">{detailApp.adminComment}</div>
                  </div>
                )}

                {/* Review Info */}
                {detailApp.reviewedAt && (
                  <div className="text-xs text-muted-foreground">
                    審査日時: {formatDate(detailApp.reviewedAt)}
                  </div>
                )}
              </div>

              {/* Action Buttons in Detail */}
              {(detailApp.status === "pending" || detailApp.status === "revision_requested") && (
                <DialogFooter className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    onClick={() => { setDetailApp(null); handleAction("revision", detailApp); }}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    修正依頼
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => { setDetailApp(null); handleAction("reject", detailApp); }}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    却下
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => { setDetailApp(null); handleAction("approve", detailApp); }}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    承認
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Approve/Reject/Revision) */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-md">
          {actionDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {actionDialog.type === "approve" && <><ThumbsUp className="h-5 w-5 text-green-600" /> 申請を承認</>}
                  {actionDialog.type === "reject" && <><ThumbsDown className="h-5 w-5 text-red-600" /> 申請を却下</>}
                  {actionDialog.type === "revision" && <><RotateCcw className="h-5 w-5 text-orange-600" /> 修正依頼</>}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Application Summary */}
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="font-semibold">{actionDialog.app.setName}</div>
                  <div className="text-sm text-muted-foreground">
                    ライバー: {actionDialog.app.liverName} / セット価格: {formatPrice(actionDialog.app.setPrice)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    商品数: {actionDialog.app.items.length}点 / 割引率: {actionDialog.app.discountRate}%OFF
                  </div>
                </div>

                {/* Comment Input */}
                <div className="space-y-2">
                  <Label>
                    {actionDialog.type === "approve" ? "コメント（任意）" : 
                     actionDialog.type === "reject" ? "却下理由（必須）" : "修正内容（必須）"}
                  </Label>
                  <Textarea
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    placeholder={
                      actionDialog.type === "approve" ? "承認コメントがあれば入力..." :
                      actionDialog.type === "reject" ? "却下理由を入力してください..." :
                      "修正してほしい内容を入力してください..."
                    }
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setActionDialog(null)}>
                  キャンセル
                </Button>
                {actionDialog.type === "approve" && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={submitAction}
                    disabled={approveMutation.isPending}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    承認する
                  </Button>
                )}
                {actionDialog.type === "reject" && (
                  <Button
                    variant="destructive"
                    onClick={submitAction}
                    disabled={rejectMutation.isPending || !adminComment.trim()}
                  >
                    <ThumbsDown className="h-4 w-4 mr-1" />
                    却下する
                  </Button>
                )}
                {actionDialog.type === "revision" && (
                  <Button
                    className="bg-orange-600 hover:bg-orange-700"
                    onClick={submitAction}
                    disabled={revisionMutation.isPending || !adminComment.trim()}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    修正依頼を送信
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
