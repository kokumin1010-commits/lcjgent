import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Search,
  Building2,
  Mail,
  Phone,
  Package,
  Link as LinkIcon,
  Star,
  BarChart3,
  ArrowLeft,
  Filter,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Link } from "wouter";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "未対応", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Clock className="h-3 w-3" /> },
  reviewing: { label: "審査中", color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Eye className="h-3 w-3" /> },
  approved: { label: "承認済", color: "bg-green-100 text-green-800 border-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "却下", color: "bg-red-100 text-red-800 border-red-300", icon: <XCircle className="h-3 w-3" /> },
};

const planNames: Record<string, string> = {
  light: "ライト検証プラン（30個）",
  algorithm: "アルゴリズム攻略プラン（50個）",
  market_jack: "市場ジャックプラン（100個）",
};

export default function BrandApplications() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionType, setActionType] = useState<"approved" | "rejected" | "reviewing" | null>(null);

  const { data: apps, isLoading, refetch } = trpc.brandSample.list.useQuery(
    statusFilter ? { status: statusFilter } : {}
  );
  const { data: stats } = trpc.brandSample.stats.useQuery();

  const updateStatusMutation = trpc.brandSample.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetch();
      setSelectedApp(null);
      setActionType(null);
      setReviewNote("");
    },
    onError: (err) => {
      toast.error("更新に失敗しました: " + err.message);
    },
  });

  const handleStatusUpdate = (status: "approved" | "rejected" | "reviewing") => {
    if (!selectedApp) return;
    updateStatusMutation.mutate({
      id: selectedApp.id,
      status,
      reviewNote: reviewNote || undefined,
    });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/master/brands">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ブランド申込フォーム一覧</h1>
            <p className="text-sm text-gray-500 mt-1">
              LP（/brand-sample）からの申込を管理します
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          更新
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter("")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats?.total ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">全件</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "pending" ? "ring-2 ring-yellow-500" : ""}`}
          onClick={() => setStatusFilter("pending")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" /> 未対応
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "reviewing" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => setStatusFilter("reviewing")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats?.reviewing ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <Eye className="h-3 w-3" /> 審査中
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "approved" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setStatusFilter("approved")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats?.approved ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> 承認済
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "rejected" ? "ring-2 ring-red-500" : ""}`}
          onClick={() => setStatusFilter("rejected")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats?.rejected ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <XCircle className="h-3 w-3" /> 却下
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              申込一覧
              {statusFilter && (
                <Badge variant="secondary" className="ml-2">
                  <Filter className="h-3 w-3 mr-1" />
                  {statusConfig[statusFilter]?.label}
                </Badge>
              )}
            </CardTitle>
            <span className="text-sm text-gray-500">{apps?.length ?? 0} 件</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">読み込み中...</p>
            </div>
          ) : !apps || apps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>まだ申込がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apps.map((app: any) => {
                const status = statusConfig[app.status] || statusConfig.pending;
                return (
                  <div
                    key={app.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedApp(app)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900 truncate">
                            {app.brandName}
                          </span>
                          <Badge variant="outline" className={`text-xs ${status.color} border`}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {planNames[app.plan] || app.plan}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {app.companyName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {app.email}
                          </span>
                          {app.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {app.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 whitespace-nowrap ml-4">
                        {formatDate(app.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedApp} onOpenChange={(open) => { if (!open) { setSelectedApp(null); setActionType(null); setReviewNote(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {selectedApp.brandName}
                  <Badge variant="outline" className={`text-xs ${statusConfig[selectedApp.status]?.color} border`}>
                    {statusConfig[selectedApp.status]?.icon}
                    <span className="ml-1">{statusConfig[selectedApp.status]?.label}</span>
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Company Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> 会社名
                    </label>
                    <p className="text-sm font-medium mt-1">{selectedApp.companyName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">担当者名</label>
                    <p className="text-sm font-medium mt-1">{selectedApp.contactPerson}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> メール
                    </label>
                    <p className="text-sm font-medium mt-1">
                      <a href={`mailto:${selectedApp.email}`} className="text-blue-600 hover:underline">
                        {selectedApp.email}
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> 電話
                    </label>
                    <p className="text-sm font-medium mt-1">{selectedApp.phone || "-"}</p>
                  </div>
                </div>

                <hr />

                {/* Product Info */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Package className="h-3 w-3" /> ブランド名
                    </label>
                    <p className="text-sm font-medium mt-1">{selectedApp.brandName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" /> 商品URL
                    </label>
                    <p className="text-sm mt-1">
                      <a href={selectedApp.productUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                        {selectedApp.productUrl}
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Star className="h-3 w-3" /> 差別化ポイント
                    </label>
                    <p className="text-sm mt-1 bg-gray-50 p-3 rounded-lg">{selectedApp.productStrength}</p>
                  </div>
                  {selectedApp.pastSalesRecord && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" /> 過去の販売実績
                      </label>
                      <p className="text-sm mt-1 bg-gray-50 p-3 rounded-lg">{selectedApp.pastSalesRecord}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">選択プラン</label>
                      <p className="text-sm font-medium mt-1">{planNames[selectedApp.plan] || selectedApp.plan}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">サンプル数</label>
                      <p className="text-sm font-medium mt-1">{selectedApp.sampleCount}個</p>
                    </div>
                  </div>
                </div>

                <hr />

                {/* Timestamps */}
                <div className="flex items-center gap-6 text-xs text-gray-400">
                  <span>申込日: {formatDate(selectedApp.createdAt)}</span>
                  {selectedApp.reviewedAt && (
                    <span>審査日: {formatDate(selectedApp.reviewedAt)}</span>
                  )}
                </div>

                {selectedApp.reviewNote && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <label className="text-xs font-medium text-amber-700">審査メモ</label>
                    <p className="text-sm mt-1 text-amber-900">{selectedApp.reviewNote}</p>
                  </div>
                )}

                {/* Action Buttons */}
                {selectedApp.status === "pending" || selectedApp.status === "reviewing" ? (
                  <div className="space-y-3">
                    {actionType ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          {actionType === "approved" ? "承認メモ（任意）" : actionType === "rejected" ? "却下理由" : "審査メモ（任意）"}
                        </label>
                        <Textarea
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                          placeholder={actionType === "rejected" ? "却下理由を入力してください..." : "メモを入力（任意）..."}
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleStatusUpdate(actionType)}
                            disabled={updateStatusMutation.isPending}
                            className={
                              actionType === "approved"
                                ? "bg-green-600 hover:bg-green-700"
                                : actionType === "rejected"
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            }
                          >
                            {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            確定
                          </Button>
                          <Button variant="outline" onClick={() => { setActionType(null); setReviewNote(""); }}>
                            キャンセル
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {selectedApp.status === "pending" && (
                          <Button
                            variant="outline"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => setActionType("reviewing")}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            審査開始
                          </Button>
                        )}
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setActionType("approved")}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          承認
                        </Button>
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={() => setActionType("rejected")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          却下
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
