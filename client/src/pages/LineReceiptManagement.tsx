import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Receipt, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  Edit,
  MessageCircle,
  User,
  Calendar,
  DollarSign,
  Store,
  Image as ImageIcon,
} from "lucide-react";

type ReceiptStatus = "pending" | "approved" | "rejected" | "on_hold";

export default function LineReceiptManagement() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<ReceiptStatus>("pending");
  const [selectedReceipt, setSelectedReceipt] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ type: "approve" | "reject" | "hold"; id: number } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [pointsOverride, setPointsOverride] = useState<number | undefined>();
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    storeName: "",
    purchaseDate: "",
    totalAmount: 0,
    currency: "JPY",
  });
  
  const utils = trpc.useUtils();
  
  // Fetch receipts
  const { data: receipts, isLoading } = trpc.point.adminGetLineReceipts.useQuery({
    status: activeTab,
    limit: 100,
  });
  
  // Fetch statistics
  const { data: stats } = trpc.point.adminGetLineStatistics.useQuery();
  
  // Fetch receipt details
  const { data: receiptDetails } = trpc.point.adminGetLineReceipt.useQuery(
    { id: selectedReceipt! },
    { enabled: !!selectedReceipt }
  );
  
  // Mutations
  const updateOcrMutation = trpc.point.adminUpdateLineReceiptOcr.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineReceipt.invalidate();
      setEditMode(false);
    },
  });
  
  const approveMutation = trpc.point.adminApproveLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      setActionDialog(null);
      setActionNote("");
      setPointsOverride(undefined);
    },
  });
  
  const rejectMutation = trpc.point.adminRejectLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      setActionDialog(null);
      setActionNote("");
    },
  });
  
  const holdMutation = trpc.point.adminHoldLineReceipt.useMutation({
    onSuccess: () => {
      utils.point.adminGetLineReceipts.invalidate();
      utils.point.adminGetLineStatistics.invalidate();
      setActionDialog(null);
      setActionNote("");
    },
  });
  
  const handleAction = () => {
    if (!actionDialog) return;
    
    switch (actionDialog.type) {
      case "approve":
        approveMutation.mutate({
          id: actionDialog.id,
          pointsOverride,
          note: actionNote || undefined,
        });
        break;
      case "reject":
        rejectMutation.mutate({
          id: actionDialog.id,
          note: actionNote,
        });
        break;
      case "hold":
        holdMutation.mutate({
          id: actionDialog.id,
          note: actionNote,
        });
        break;
    }
  };
  
  const handleEditSave = () => {
    if (!selectedReceipt) return;
    updateOcrMutation.mutate({
      id: selectedReceipt,
      ...editForm,
    });
  };
  
  const openReceiptDetails = (id: number) => {
    setSelectedReceipt(id);
    setEditMode(false);
  };
  
  const startEdit = () => {
    if (receiptDetails?.receipt) {
      const r = receiptDetails.receipt;
      setEditForm({
        storeName: r.storeName || "",
        purchaseDate: r.purchaseDate ? new Date(r.purchaseDate).toISOString().split("T")[0] : "",
        totalAmount: r.totalAmount || 0,
        currency: r.currency || "JPY",
      });
      setEditMode(true);
    }
  };
  
  const getStatusBadge = (status: ReceiptStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />{t("receiptStatusPending")}</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />{t("receiptStatusApproved")}</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />{t("receiptStatusRejected")}</Badge>;
      case "on_hold":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300"><AlertTriangle className="w-3 h-3 mr-1" />{t("receiptStatusOnHold")}</Badge>;
    }
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  
  const formatCurrency = (amount: number | null, currency: string = "JPY") => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-500" />
            {t("lineReceiptManagement")}
          </h1>
          <p className="text-muted-foreground mt-1">
            LINEから送信されたレシートの審査・ポイント付与管理
          </p>
        </div>
      </div>
      
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusPending")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusApproved")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.approved || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusRejected")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.rejected || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">{t("receiptStatusOnHold")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.onHold || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">{t("totalPointsAwarded")}</span>
            </div>
            <p className="text-2xl font-bold mt-1">{(stats?.totalPointsAwarded || 0).toLocaleString()} pt</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReceiptStatus)}>
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {t("receiptStatusPending")}
            {stats?.pending ? <Badge variant="secondary" className="ml-1">{stats.pending}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="on_hold" className="flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            {t("receiptStatusOnHold")}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            {t("receiptStatusApproved")}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-1">
            <XCircle className="w-4 h-4" />
            {t("receiptStatusRejected")}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : receipts?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>該当するレシートはありません</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {receipts?.map(({ receipt, lineUser }) => (
                <Card key={receipt.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                          {receipt.imageUrl ? (
                            <img 
                              src={receipt.imageUrl} 
                              alt="レシート" 
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => openReceiptDetails(receipt.id)}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        
                        {/* Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{lineUser?.displayName || "不明"}</span>
                            {getStatusBadge(receipt.status as ReceiptStatus)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Store className="w-3 h-3" />
                              {receipt.storeName || "店舗不明"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(receipt.purchaseDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(receipt.totalAmount, receipt.currency || "JPY")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">計算ポイント:</span>
                            <span className="font-medium text-blue-600">{receipt.pointsCalculated || 0} pt</span>
                            {receipt.fraudFlags && receipt.fraudFlags.length > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                不正フラグ
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            申請日時: {formatDate(receipt.submittedAt)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openReceiptDetails(receipt.id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          詳細
                        </Button>
                        {receipt.status === "pending" || receipt.status === "on_hold" ? (
                          <>
                            <Button 
                              variant="default" 
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => setActionDialog({ type: "approve", id: receipt.id })}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              承認
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => setActionDialog({ type: "reject", id: receipt.id })}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              却下
                            </Button>
                            {receipt.status === "pending" && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                                onClick={() => setActionDialog({ type: "hold", id: receipt.id })}
                              >
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                保留
                              </Button>
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Receipt Detail Dialog */}
      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              レシート詳細
            </DialogTitle>
          </DialogHeader>
          
          {receiptDetails && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Image */}
              <div>
                <div className="bg-muted rounded-lg overflow-hidden">
                  {receiptDetails.receipt.imageUrl ? (
                    <img 
                      src={receiptDetails.receipt.imageUrl} 
                      alt="レシート" 
                      className="w-full object-contain max-h-[500px]"
                    />
                  ) : (
                    <div className="h-64 flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Details */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(receiptDetails.receipt.status as ReceiptStatus)}
                  {!editMode && (receiptDetails.receipt.status === "pending" || receiptDetails.receipt.status === "on_hold") && (
                    <Button variant="outline" size="sm" onClick={startEdit}>
                      <Edit className="w-4 h-4 mr-1" />
                      編集
                    </Button>
                  )}
                </div>
                
                {editMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label>店舗名</Label>
                      <Input 
                        value={editForm.storeName}
                        onChange={(e) => setEditForm({ ...editForm, storeName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>購入日</Label>
                      <Input 
                        type="date"
                        value={editForm.purchaseDate}
                        onChange={(e) => setEditForm({ ...editForm, purchaseDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>金額</Label>
                      <Input 
                        type="number"
                        value={editForm.totalAmount}
                        onChange={(e) => setEditForm({ ...editForm, totalAmount: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>通貨</Label>
                      <Input 
                        value={editForm.currency}
                        onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleEditSave} disabled={updateOcrMutation.isPending}>
                        保存
                      </Button>
                      <Button variant="outline" onClick={() => setEditMode(false)}>
                        キャンセル
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">店舗名</span>
                      <span className="font-medium">{receiptDetails.receipt.storeName || "-"}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">購入日時</span>
                      <span className="font-medium">{formatDate(receiptDetails.receipt.purchaseDate)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">金額</span>
                      <span className="font-medium">{formatCurrency(receiptDetails.receipt.totalAmount, receiptDetails.receipt.currency || "JPY")}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">計算ポイント</span>
                      <span className="font-medium text-blue-600">{receiptDetails.receipt.pointsCalculated || 0} pt</span>
                    </div>
                    {receiptDetails.receipt.pointsAwarded !== null && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">付与ポイント</span>
                        <span className="font-medium text-green-600">{receiptDetails.receipt.pointsAwarded} pt</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">申請日時</span>
                      <span className="font-medium">{formatDate(receiptDetails.receipt.submittedAt)}</span>
                    </div>
                    {receiptDetails.receipt.reviewedAt && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-muted-foreground">審査日時</span>
                        <span className="font-medium">{formatDate(receiptDetails.receipt.reviewedAt)}</span>
                      </div>
                    )}
                    {receiptDetails.receipt.reviewNote && (
                      <div className="py-2 border-b">
                        <span className="text-muted-foreground block mb-1">審査メモ</span>
                        <span className="font-medium">{receiptDetails.receipt.reviewNote}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Fraud Detection */}
                {receiptDetails.fraudLogs && receiptDetails.fraudLogs.length > 0 && (
                  <Card className="border-orange-200 bg-orange-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                        <AlertTriangle className="w-4 h-4" />
                        不正検知ログ
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {receiptDetails.fraudLogs.map((log, i) => (
                        <div key={i} className="text-sm">
                          <Badge variant="outline" className="mr-2">
                            {log.checkType}
                          </Badge>
                          <span className="text-muted-foreground">{log.details}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.type === "approve" && "レシートを承認"}
              {actionDialog?.type === "reject" && "レシートを却下"}
              {actionDialog?.type === "hold" && "レシートを保留"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.type === "approve" && "このレシートを承認してポイントを付与しますか？"}
              {actionDialog?.type === "reject" && "このレシートを却下しますか？理由を入力してください。"}
              {actionDialog?.type === "hold" && "このレシートを保留にしますか？理由を入力してください。"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {actionDialog?.type === "approve" && (
              <div>
                <Label>ポイント数（オーバーライド）</Label>
                <Input 
                  type="number"
                  placeholder="空欄の場合は計算値を使用"
                  value={pointsOverride || ""}
                  onChange={(e) => setPointsOverride(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            )}
            <div>
              <Label>{actionDialog?.type === "approve" ? "メモ（任意）" : "理由"}</Label>
              <Textarea 
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={actionDialog?.type === "approve" ? "任意でメモを入力" : "理由を入力してください"}
                required={actionDialog?.type !== "approve"}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleAction}
              disabled={
                (actionDialog?.type !== "approve" && !actionNote) ||
                approveMutation.isPending ||
                rejectMutation.isPending ||
                holdMutation.isPending
              }
              variant={actionDialog?.type === "reject" ? "destructive" : "default"}
              className={actionDialog?.type === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {actionDialog?.type === "approve" && "承認する"}
              {actionDialog?.type === "reject" && "却下する"}
              {actionDialog?.type === "hold" && "保留にする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
