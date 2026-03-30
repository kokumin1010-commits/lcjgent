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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Clock,
  Phone as PhoneCall,
  Loader2 as Spinner,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  Phone,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Megaphone,
  DollarSign,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { Link } from "wouter";

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "未対応", color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: <Clock className="h-3 w-3" /> },
  contacted: { label: "連絡済", color: "bg-blue-100 text-blue-800 border-blue-300", icon: <PhoneCall className="h-3 w-3" /> },
  in_progress: { label: "商談中", color: "bg-purple-100 text-purple-800 border-purple-300", icon: <Spinner className="h-3 w-3" /> },
  contracted: { label: "契約済", color: "bg-green-100 text-green-800 border-green-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { label: "見送り", color: "bg-red-100 text-red-800 border-red-300", icon: <XCircle className="h-3 w-3" /> },
};

const planNames: Record<string, string> = {
  light: "ライト検証",
  algorithm: "アルゴリズム攻略",
  market_jack: "市場ジャック",
};

const budgetLabels: Record<string, string> = {
  "10-30": "10〜30万円",
  "30-50": "30〜50万円",
  "50-100": "50〜100万円",
  "100-300": "100〜300万円",
  "300+": "300万円以上",
};

export default function AdFormSubmissions() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: apps, isLoading, refetch } = trpc.adForm.list.useQuery(
    statusFilter ? { status: statusFilter } : {}
  );
  const { data: stats } = trpc.adForm.stats.useQuery();

  const updateStatusMutation = trpc.adForm.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetch();
      setSelectedApp(null);
      setNewStatus("");
      setReviewNote("");
    },
    onError: (err: any) => {
      toast.error("更新に失敗しました: " + err.message);
    },
  });

  const handleStatusUpdate = () => {
    if (!selectedApp || !newStatus) return;
    updateStatusMutation.mutate({
      id: selectedApp.id,
      status: newStatus as any,
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
          <Link href="/master">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-pink-500" />
              広告申込フォーム一覧
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              TikTok広告LP（/tiktok-ads）からの問い合わせを管理
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
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "contacted" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => setStatusFilter("contacted")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats?.contacted ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <PhoneCall className="h-3 w-3" /> 連絡済
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "in_progress" ? "ring-2 ring-purple-500" : ""}`}
          onClick={() => setStatusFilter("in_progress")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats?.inProgress ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <Spinner className="h-3 w-3" /> 商談中
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "contracted" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setStatusFilter("contracted")}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats?.contracted ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> 契約済
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
              問い合わせ一覧
              {statusFilter && (
                <Badge variant="secondary" className="ml-2">
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
              <Megaphone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>まだ問い合わせがありません</p>
              <p className="text-xs mt-1">TikTok広告LPからの申込がここに表示されます</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apps.map((app: any) => {
                const status = statusConfig[app.status] || statusConfig.pending;
                return (
                  <div
                    key={app.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => { setSelectedApp(app); setNewStatus(app.status); setReviewNote(app.reviewNote || ""); }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-gray-900 truncate">
                            {app.companyName}
                          </span>
                          <Badge variant="outline" className={`text-xs ${status.color} border`}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                          <Badge variant="secondary" className="text-xs bg-pink-50 text-pink-700">
                            {planNames[app.plan] || app.plan}
                          </Badge>
                          {app.monthlyBudget && (
                            <Badge variant="outline" className="text-xs">
                              <DollarSign className="h-3 w-3 mr-0.5" />
                              {budgetLabels[app.monthlyBudget] || app.monthlyBudget}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {app.contactPerson}
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
      <Dialog open={!!selectedApp} onOpenChange={(open) => { if (!open) { setSelectedApp(null); setNewStatus(""); setReviewNote(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-pink-500" />
                  {selectedApp.companyName}
                  <Badge variant="outline" className={`text-xs ${statusConfig[selectedApp.status]?.color} border`}>
                    {statusConfig[selectedApp.status]?.icon}
                    <span className="ml-1">{statusConfig[selectedApp.status]?.label}</span>
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> 会社名
                    </label>
                    <p className="text-sm font-medium mt-1">{selectedApp.companyName}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">ご担当者名</label>
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

                {/* Plan & Budget */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <Megaphone className="h-3 w-3" /> 選択プラン
                    </label>
                    <p className="text-sm font-medium mt-1">
                      <Badge className="bg-pink-100 text-pink-800 border-pink-300">
                        {planNames[selectedApp.plan] || selectedApp.plan}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> 月間広告予算
                    </label>
                    <p className="text-sm font-medium mt-1">
                      {budgetLabels[selectedApp.monthlyBudget] || selectedApp.monthlyBudget || "未回答"}
                    </p>
                  </div>
                </div>

                {selectedApp.message && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> メッセージ
                    </label>
                    <p className="text-sm mt-1 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{selectedApp.message}</p>
                  </div>
                )}

                <hr />

                {/* Timestamps */}
                <div className="flex items-center gap-6 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    申込日: {formatDate(selectedApp.createdAt)}
                  </span>
                  {selectedApp.reviewedAt && (
                    <span>更新日: {formatDate(selectedApp.reviewedAt)}</span>
                  )}
                </div>

                {selectedApp.reviewNote && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <label className="text-xs font-medium text-amber-700">対応メモ</label>
                    <p className="text-sm mt-1 text-amber-900">{selectedApp.reviewNote}</p>
                  </div>
                )}

                {/* Status Update */}
                <div className="space-y-3 border-t pt-4">
                  <label className="text-sm font-medium">ステータス変更</label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="ステータスを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">未対応</SelectItem>
                      <SelectItem value="contacted">連絡済</SelectItem>
                      <SelectItem value="in_progress">商談中</SelectItem>
                      <SelectItem value="contracted">契約済</SelectItem>
                      <SelectItem value="rejected">見送り</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="対応メモを入力（任意）..."
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleStatusUpdate}
                      disabled={updateStatusMutation.isPending || newStatus === selectedApp.status}
                      className="bg-pink-600 hover:bg-pink-700 text-white"
                    >
                      {updateStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      更新
                    </Button>
                    <Button variant="outline" onClick={() => { setSelectedApp(null); setNewStatus(""); setReviewNote(""); }}>
                      閉じる
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
