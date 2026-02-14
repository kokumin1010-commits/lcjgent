import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle, Clock, XCircle, Eye, Image, ExternalLink } from "lucide-react";

const REJECTION_CATEGORIES = [
  { value: "blurry_image", label: "画像が不鮮明" },
  { value: "missing_order_number", label: "注文番号がない" },
  { value: "missing_amount", label: "金額が不明" },
  { value: "not_delivered", label: "配達未完了" },
  { value: "duplicate", label: "重複申請" },
  { value: "wrong_store", label: "対象外の店舗" },
  { value: "suspicious", label: "不正の疑い" },
  { value: "incomplete_info", label: "情報不足" },
  { value: "other", label: "その他" },
] as const;

type PointRequest = {
  id: number;
  userId: number;
  orderNumber: string;
  orderAmount: number;
  deliveryDate: Date | null;
  receiptImageUrl: string;
  deliveryImageUrl: string | null;
  pointsRequested: number;
  pointsApproved: number | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export default function PointRequestAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<PointRequest | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectionCategory, setRejectionCategory] = useState<string>("other");
  const [approvePoints, setApprovePoints] = useState<number>(0);

  const utils = trpc.useUtils();

  const { data: pendingRequests, isLoading: pendingLoading } = trpc.pointRequest.pendingRequests.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const { data: allRequests, isLoading: allLoading } = trpc.pointRequest.allRequests.useQuery({ limit: 100 }, {
    enabled: !!user && user.role === "admin",
  });

  const approveMutation = trpc.pointRequest.approve.useMutation({
    onSuccess: () => {
      toast.success("申請を承認しました");
      setSelectedRequest(null);
      utils.pointRequest.pendingRequests.invalidate();
      utils.pointRequest.allRequests.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.pointRequest.reject.useMutation({
    onSuccess: () => {
      toast.success("申請を却下しました");
      setSelectedRequest(null);
      setRejectDialogOpen(false);
      setRejectReason("");
      utils.pointRequest.pendingRequests.invalidate();
      utils.pointRequest.allRequests.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = (request: PointRequest) => {
    approveMutation.mutate({
      requestId: request.id,
      pointsApproved: approvePoints || request.pointsRequested,
    });
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      toast.error("却下理由を入力してください");
      return;
    }
    rejectMutation.mutate({
      requestId: selectedRequest.id,
      reason: rejectReason,
      rejectionCategory: rejectionCategory as any,
    });
  };

  const openRejectDialog = (request: PointRequest) => {
    setSelectedRequest(request);
    setRejectReason("");
    setRejectionCategory("other");
    setRejectDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />審査中</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />承認済み</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />却下</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const RequestCard = ({ request, showActions = false }: { request: PointRequest; showActions?: boolean }) => (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* 画像プレビュー */}
          <div className="flex gap-2">
            <div 
              className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setViewImageUrl(request.receiptImageUrl)}
            >
              <img 
                src={request.receiptImageUrl} 
                alt="レシート" 
                className="w-full h-full object-cover"
              />
            </div>
            {request.deliveryImageUrl && (
              <div 
                className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setViewImageUrl(request.deliveryImageUrl!)}
              >
                <img 
                  src={request.deliveryImageUrl} 
                  alt="配達済み" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* 申請情報 */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">注文番号: {request.orderNumber}</h3>
              {getStatusBadge(request.status)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">注文金額:</span>
                <span className="ml-2 font-medium">{request.orderAmount.toLocaleString()}円</span>
              </div>
              <div>
                <span className="text-gray-500">申請ポイント:</span>
                <span className="ml-2 font-medium text-pink-500">{request.pointsRequested}pt</span>
              </div>
              <div>
                <span className="text-gray-500">申請日時:</span>
                <span className="ml-2">{new Date(request.createdAt).toLocaleString("ja-JP")}</span>
              </div>
              <div>
                <span className="text-gray-500">ユーザーID:</span>
                <span className="ml-2">{request.userId}</span>
              </div>
            </div>
            {request.deliveryDate && (
              <div className="text-sm">
                <span className="text-gray-500">配達日:</span>
                <span className="ml-2">{new Date(request.deliveryDate).toLocaleDateString("ja-JP")}</span>
              </div>
            )}
            {request.status === "rejected" && request.rejectionReason && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                却下理由: {request.rejectionReason}
              </div>
            )}
            {request.status === "approved" && request.pointsApproved && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                承認ポイント: {request.pointsApproved}pt
              </div>
            )}
          </div>

          {/* アクションボタン */}
          {showActions && request.status === "pending" && (
            <div className="flex flex-col gap-2 justify-center">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder={String(request.pointsRequested)}
                  value={approvePoints || ""}
                  onChange={(e) => setApprovePoints(parseInt(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">pt</span>
              </div>
              <Button 
                size="sm" 
                className="bg-green-500 hover:bg-green-600"
                onClick={() => handleApprove(request)}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                承認
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => openRejectDialog(request)}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-1" />
                却下
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(request.receiptImageUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                画像を開く
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>アクセス権限がありません</CardTitle>
            <CardDescription>この画面は管理者のみアクセスできます</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ポイント申請管理</h1>
        <p className="text-gray-500">TikTok Shopレシートによるポイント申請の承認・却下</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            審査待ち
            {pendingRequests && pendingRequests.length > 0 && (
              <Badge className="ml-2 bg-pink-500">{pendingRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">全ての申請</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            </div>
          ) : pendingRequests && pendingRequests.length > 0 ? (
            <div>
              {pendingRequests.map((request) => (
                <RequestCard key={request.id} request={request as PointRequest} showActions />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>審査待ちの申請はありません</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          {allLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            </div>
          ) : allRequests && allRequests.length > 0 ? (
            <div>
              {allRequests.map((request) => (
                <RequestCard key={request.id} request={request as PointRequest} showActions={request.status === "pending"} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <p>申請履歴がありません</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* 画像プレビューダイアログ */}
      <Dialog open={!!viewImageUrl} onOpenChange={() => setViewImageUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>画像プレビュー</DialogTitle>
          </DialogHeader>
          {viewImageUrl && (
            <div className="flex justify-center">
              <img 
                src={viewImageUrl} 
                alt="プレビュー" 
                className="max-h-[70vh] object-contain"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => window.open(viewImageUrl!, "_blank")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              新しいタブで開く
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 却下理由入力ダイアログ */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>申請を却下</DialogTitle>
            <DialogDescription>
              却下理由を入力してください。この理由はユーザーに表示されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>却下理由カテゴリ</Label>
              <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="カテゴリを選択" />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>却下理由（詳細）</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="例: 配達済みステータスが確認できません"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              キャンセル
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "処理中..." : "却下する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
