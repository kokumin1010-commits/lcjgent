import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  DollarSign,
  User,
  ChevronDown,
  ChevronUp,
  Search,
  CreditCard,
  Truck,
  ShoppingBag,
  TrendingUp,
  Award,
  Star,
  History,
  AlertTriangle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tabs
type AdminTab = "requests" | "credits";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "審査待ち", color: "bg-yellow-600", icon: Clock },
  approved: { label: "承認済み", color: "bg-green-600", icon: CheckCircle },
  rejected: { label: "却下", color: "bg-red-600", icon: XCircle },
  shipped: { label: "発送済み", color: "bg-blue-600", icon: Truck },
  cancelled: { label: "キャンセル", color: "bg-gray-600", icon: XCircle },
};

const RANK_CONFIG: Record<string, { label: string; color: string; badge: string }> = {
  none: { label: "ランクなし", color: "text-gray-400", badge: "bg-gray-700" },
  silver: { label: "SILVER", color: "text-gray-300", badge: "bg-gradient-to-r from-gray-400 to-gray-300 text-gray-900" },
  gold: { label: "GOLD", color: "text-yellow-400", badge: "bg-gradient-to-r from-yellow-500 to-amber-400 text-gray-900" },
  black: { label: "BLACK", color: "text-purple-400", badge: "bg-gradient-to-r from-gray-900 to-black border border-purple-500 text-purple-300" },
};

export default function SampleRequestsAdmin() {
  const [activeTab, setActiveTab] = useState<AdminTab>("requests");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Action dialogs
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [actionComment, setActionComment] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);

  // Credit management
  const now = new Date();
  const [creditMonth, setCreditMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [editCreditOpen, setEditCreditOpen] = useState(false);
  const [editLiver, setEditLiver] = useState<any>(null);
  const [editStreamingHours, setEditStreamingHours] = useState("");
  const [editMonthlySales, setEditMonthlySales] = useState("");
  const [editIsFirstMonth, setEditIsFirstMonth] = useState(false);

  // Liver detail dialog
  const [liverDetailOpen, setLiverDetailOpen] = useState(false);
  const [selectedLiverId, setSelectedLiverId] = useState<number | null>(null);
  const [selectedLiverName, setSelectedLiverName] = useState("");

  // API calls
  const requestsQuery = trpc.sampleRequest.listAll.useQuery(
    { status: statusFilter || undefined },
    { enabled: activeTab === "requests" }
  );

  const creditsQuery = trpc.sampleRequest.listCredits.useQuery(
    { month: creditMonth },
    { enabled: activeTab === "credits" }
  );

  const approveMutation = trpc.sampleRequest.approve.useMutation({
    onSuccess: () => { toast.success("承認しました"); requestsQuery.refetch(); setApproveOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.sampleRequest.reject.useMutation({
    onSuccess: () => { toast.success("却下しました"); requestsQuery.refetch(); setRejectOpen(false); },
    onError: (e) => toast.error(e.message),
  });

  const shippedMutation = trpc.sampleRequest.markShipped.useMutation({
    onSuccess: () => { toast.success("発送済みにしました"); requestsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const fixNegativeMutation = trpc.sampleRequest.fixNegativeCredits.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      requestsQuery.refetch();
      creditsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const setCreditMutation = trpc.sampleRequest.setCredit.useMutation({
    onSuccess: (data) => {
      toast.success(`クレジット設定完了（ランク: ${data.rank.toUpperCase()}、合計: ¥${data.totalCredit.toLocaleString()}）`);
      creditsQuery.refetch();
      setEditCreditOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // Liver detail queries
  const liverCreditHistoryQuery = trpc.sampleRequest.getLiverCreditHistory.useQuery(
    { liverId: selectedLiverId! },
    { enabled: liverDetailOpen && selectedLiverId !== null }
  );
  const liverRequestsQuery = trpc.sampleRequest.getLiverRequests.useQuery(
    { liverId: selectedLiverId! },
    { enabled: liverDetailOpen && selectedLiverId !== null }
  );

  const requests = requestsQuery.data || [];
  const credits = creditsQuery.data || [];

  // Filter requests by search
  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter((r: any) =>
      r.liverName?.toLowerCase().includes(q) ||
      (r.items || []).some((i: any) => i.productName?.toLowerCase().includes(q))
    );
  }, [requests, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const all = requestsQuery.data || [];
    return {
      total: all.length,
      pending: all.filter((r: any) => r.status === "pending").length,
      approved: all.filter((r: any) => r.status === "approved").length,
      shipped: all.filter((r: any) => r.status === "shipped").length,
    };
  }, [requestsQuery.data]);

  function openApprove(id: number) {
    setActionId(id);
    setActionComment("");
    setApproveOpen(true);
  }

  function openReject(id: number) {
    setActionId(id);
    setActionComment("");
    setRejectOpen(true);
  }

  function openEditCredit(liver: any) {
    setEditLiver(liver);
    setEditStreamingHours(liver.credit ? String(Number(liver.credit.streamingHours)) : "0");
    setEditMonthlySales(liver.credit ? String(liver.credit.monthlySales) : "0");
    setEditIsFirstMonth(liver.credit?.isFirstMonth || false);
    setEditCreditOpen(true);
  }

  function openLiverDetail(liverId: number, liverName: string) {
    setSelectedLiverId(liverId);
    setSelectedLiverName(liverName);
    setLiverDetailOpen(true);
  }

  function handleSetCredit() {
    if (!editLiver) return;
    setCreditMutation.mutate({
      liverId: editLiver.liverId,
      month: creditMonth,
      streamingHours: parseFloat(editStreamingHours) || 0,
      monthlySales: parseInt(editMonthlySales) || 0,
      isFirstMonth: editIsFirstMonth,
    });
  }

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "requests" ? "default" : "outline"}
          onClick={() => setActiveTab("requests")}
          className={activeTab === "requests" ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          <ShoppingBag className="h-4 w-4 mr-2" />
          サンプル請求管理
        </Button>
        <Button
          variant={activeTab === "credits" ? "default" : "outline"}
          onClick={() => setActiveTab("credits")}
          className={activeTab === "credits" ? "bg-purple-600 hover:bg-purple-700" : ""}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          クレジット管理
        </Button>
      </div>

      {/* ============ REQUESTS TAB ============ */}
      {activeTab === "requests" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "全件", value: stats.total, filter: "", color: "text-white", icon: Package },
              { label: "審査待ち", value: stats.pending, filter: "pending", color: "text-yellow-400", icon: Clock },
              { label: "承認済み", value: stats.approved, filter: "approved", color: "text-green-400", icon: CheckCircle },
              { label: "発送済み", value: stats.shipped, filter: "shipped", color: "text-blue-400", icon: Truck },
            ].map(s => (
              <Card
                key={s.label}
                className={`cursor-pointer transition-all ${statusFilter === s.filter ? "border-purple-500 bg-purple-900/20" : "bg-gray-900 border-gray-800 hover:border-gray-600"}`}
                onClick={() => setStatusFilter(s.filter)}
              >
                <CardContent className="p-3 text-center">
                  <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search + Fix Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ライバー名・商品名で検索"
                className="pl-10 bg-gray-900 border-gray-700 text-white"
              />
            </div>
            {filteredRequests.some((r: any) => r.liverCredit && Number(r.liverCredit.remainingCredit) < 0) && (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-xs shrink-0"
                onClick={() => {
                  fixNegativeMutation.mutate();
                }}
                disabled={fixNegativeMutation.isPending}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                マイナス修正
              </Button>
            )}
          </div>

          {/* Request List */}
          <div className="space-y-2">
            {filteredRequests.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-8 text-center text-gray-500">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>該当する請求がありません</p>
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((req: any) => {
                const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = sc.icon;
                const isExpanded = expandedId === req.id;

                return (
                  <Card key={req.id} className="bg-gray-900 border-gray-800">
                    <CardContent className="p-0">
                      {/* Header Row */}
                      <div
                        className="p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={`${sc.color} text-white text-xs`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {sc.label}
                            </Badge>
                            <div>
                              <span
                                className="text-sm font-semibold text-white hover:text-purple-400 cursor-pointer underline-offset-2 hover:underline transition-colors"
                                onClick={(e) => { e.stopPropagation(); openLiverDetail(req.liverId, req.liverName); }}
                              >
                                {req.liverName}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">#{req.id}</span>
                              {(req as any).liverCredit ? (
                                <span className={`text-xs ml-2 ${Number((req as any).liverCredit.remainingCredit) < 0 ? "text-red-400" : "text-purple-400"}`}>
                                  {Number((req as any).liverCredit.remainingCredit) < 0 && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                  残クレジット: ¥{Number((req as any).liverCredit.remainingCredit).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500 ml-2">クレジット未設定</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-white">¥{Number(req.totalAmount).toLocaleString()}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(req.createdAt).toLocaleDateString("ja-JP")}
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-gray-800 p-3 space-y-3">
                          {/* Items */}
                          <div className="space-y-1">
                            {(req.items || []).map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between bg-gray-800 rounded p-2 text-sm">
                                <span className="text-white">{item.productName} × {item.quantity}</span>
                                <span className="text-gray-400">¥{(Number(item.price) * item.quantity).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>

                          {/* Price Info */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-gray-800 rounded p-2 text-center">
                              <div className="text-gray-500">定価合計</div>
                              <div className="text-white font-semibold">¥{Number(req.totalAmount).toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-800 rounded p-2 text-center">
                              <div className="text-purple-400">クレジット使用</div>
                              <div className="text-purple-400 font-semibold">¥{Number(req.creditUsed).toLocaleString()}</div>
                            </div>
                            <div className="bg-gray-800 rounded p-2 text-center">
                              <div className="text-orange-400">実費</div>
                              <div className="text-orange-400 font-semibold">¥{Number(req.outOfPocketAmount).toLocaleString()}</div>
                            </div>
                          </div>

                          {/* Schedule & Memo */}
                          <div className="text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              配信予定: {new Date(req.scheduledDate).toLocaleDateString("ja-JP")}
                            </div>
                            {req.memo && (
                              <div className="mt-1 bg-gray-800 rounded p-2 text-gray-300">{req.memo}</div>
                            )}
                          </div>

                          {/* Shipping Address */}
                          {req.address && (
                            <div className="text-xs bg-gray-800 rounded p-2">
                              <div className="text-gray-500 mb-1">配送先</div>
                              {(req as any).recipientName && (
                                <div className="text-white font-semibold mb-1">{(req as any).recipientName}</div>
                              )}
                              <div className="text-white">
                                {req.postalCode && <span>〒{req.postalCode} </span>}
                                {req.address}
                              </div>
                              {req.phone && <div className="text-gray-400 mt-1">TEL: {req.phone}</div>}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {req.status === "pending" && (
                              <>
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 flex-1" onClick={() => openApprove(req.id)}>
                                  <ThumbsUp className="h-3 w-3 mr-1" /> 承認
                                </Button>
                                <Button size="sm" className="bg-red-600 hover:bg-red-700 flex-1" onClick={() => openReject(req.id)}>
                                  <ThumbsDown className="h-3 w-3 mr-1" /> 却下
                                </Button>
                              </>
                            )}
                            {req.status === "approved" && (
                              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 flex-1" onClick={() => shippedMutation.mutate({ id: req.id })}>
                                <Truck className="h-3 w-3 mr-1" /> 発送済みにする
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ============ CREDITS TAB ============ */}
      {activeTab === "credits" && (
        <>
          {/* Month Selector */}
          <div className="flex items-center gap-3">
            <Label className="text-gray-400 text-sm">対象月:</Label>
            <Input
              type="month"
              value={creditMonth}
              onChange={e => setCreditMonth(e.target.value)}
              className="bg-gray-900 border-gray-700 text-white w-48"
            />
          </div>

          {/* Credit Summary */}
          <div className="grid grid-cols-4 gap-3">
            {["silver", "gold", "black", "none"].map(rank => {
              const count = credits.filter((c: any) => (c.credit?.rank || "none") === rank).length;
              const rc = RANK_CONFIG[rank];
              return (
                <Card key={rank} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-3 text-center">
                    <div className={`text-2xl font-bold ${rc.color}`}>{count}</div>
                    <div className="text-xs text-gray-500">{rc.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Liver Credit List */}
          <div className="space-y-2">
            {credits.map((item: any) => {
              const credit = item.credit;
              const rank = credit?.rank || "none";
              const rc = RANK_CONFIG[rank];

              return (
                <Card key={item.liverId} className="bg-gray-900 border-gray-800">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{item.liverName}</span>
                            {rank !== "none" && (
                              <Badge className={`${rc.badge} text-xs px-2`}>{rc.label}</Badge>
                            )}
                          </div>
                          {credit ? (
                            <div className="text-xs text-gray-500 mt-1">
                              配信: {Number(credit.streamingHours)}h / 売上: ¥{Number(credit.monthlySales).toLocaleString()}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 mt-1">未設定</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {credit && (
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">¥{Number(credit.remainingCredit).toLocaleString()}</div>
                            <div className="text-xs text-gray-500">/ ¥{Number(credit.totalCredit).toLocaleString()}</div>
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="border-gray-600 text-xs" onClick={() => openEditCredit(item)}>
                          設定
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ============ APPROVE DIALOG ============ */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>サンプル請求を承認</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-400 text-sm">コメント（任意）</Label>
              <Textarea
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder="承認コメント"
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>キャンセル</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => actionId && approveMutation.mutate({ id: actionId, comment: actionComment || undefined })}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              承認する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ REJECT DIALOG ============ */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>サンプル請求を却下</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-400 text-sm">却下理由 *</Label>
              <Textarea
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder="却下理由を入力してください"
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>キャンセル</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => actionId && actionComment && rejectMutation.mutate({ id: actionId, comment: actionComment })}
              disabled={rejectMutation.isPending || !actionComment}
            >
              <XCircle className="h-4 w-4 mr-2" />
              却下する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ EDIT CREDIT DIALOG ============ */}
      <Dialog open={editCreditOpen} onOpenChange={setEditCreditOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>
              クレジット設定 - {editLiver?.liverName}（{creditMonth}）
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400 text-sm">配信時間（時間）</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={editStreamingHours}
                onChange={e => setEditStreamingHours(e.target.value.replace(/[^0-9.]/g, ""))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
              <div className="text-xs text-gray-500 mt-1">
                クレジット: ¥{(Math.round(parseFloat(editStreamingHours || "0") * 500)).toLocaleString()}（×500円）
              </div>
            </div>
            <div>
              <Label className="text-gray-400 text-sm">月間売上（円）</Label>
              <Input
                type="text"
                inputMode="numeric"
                value={editMonthlySales}
                onChange={e => setEditMonthlySales(e.target.value.replace(/[^0-9]/g, ""))}
                className="bg-gray-800 border-gray-700 text-white mt-1"
              />
              <div className="text-xs text-gray-500 mt-1">
                クレジット: ¥{(Math.round(parseInt(editMonthlySales || "0") * 0.03)).toLocaleString()}（×3%）
              </div>
            </div>

            {/* Auto-calculated preview */}
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-3 space-y-2">
                <div className="text-xs text-gray-400 font-semibold">自動計算プレビュー</div>
                {(() => {
                  const hours = parseFloat(editStreamingHours || "0");
                  const sales = parseInt(editMonthlySales || "0");
                  const streamC = Math.round(hours * 500);
                  const salesC = Math.round(sales * 0.03);
                  let rank = "none";
                  if (hours >= 60 && sales >= 3000000) rank = "black";
                  else if (hours >= 30 && sales >= 1000000) rank = "gold";
                  else if (hours >= 10 && sales >= 500000) rank = "silver";
                  const bonus = rank === "black" ? 50000 : rank === "gold" ? 15000 : rank === "silver" ? 5000 : 0;
                  const total = streamC + salesC + bonus;
                  const rc = RANK_CONFIG[rank];

                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">ランク</span>
                        <Badge className={`${rc.badge} text-xs`}>{rc.label}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">配信クレジット</span>
                        <span className="text-white">¥{streamC.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">売上クレジット</span>
                        <span className="text-white">¥{salesC.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ランクボーナス</span>
                        <span className={rc.color}>¥{bonus.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-gray-700 pt-1 flex justify-between font-semibold">
                        <span className="text-gray-300">合計クレジット</span>
                        <span className="text-white">¥{total.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={editIsFirstMonth}
                onCheckedChange={(v) => setEditIsFirstMonth(!!v)}
                id="firstMonth"
              />
              <Label htmlFor="firstMonth" className="text-gray-400 text-sm">初月（10万円枠）</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCreditOpen(false)}>キャンセル</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleSetCredit}
              disabled={setCreditMutation.isPending}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              設定する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ LIVER DETAIL DIALOG ============ */}
      <Dialog open={liverDetailOpen} onOpenChange={setLiverDetailOpen}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-400" />
              {selectedLiverName} - 詳細
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="credit-history" className="w-full">
            <TabsList className="w-full bg-gray-800">
              <TabsTrigger value="credit-history" className="flex-1 text-xs">
                <CreditCard className="h-3 w-3 mr-1" />
                クレジット履歴
              </TabsTrigger>
              <TabsTrigger value="request-history" className="flex-1 text-xs">
                <History className="h-3 w-3 mr-1" />
                申請履歴
              </TabsTrigger>
            </TabsList>

            {/* Credit History Tab */}
            <TabsContent value="credit-history">
              <ScrollArea className="h-[55vh]">
                <div className="space-y-2 pr-2">
                  {liverCreditHistoryQuery.isLoading ? (
                    <div className="text-center text-gray-500 py-8">読み込み中...</div>
                  ) : (liverCreditHistoryQuery.data || []).length === 0 ? (
                    <div className="text-center text-gray-500 py-8">クレジット履歴がありません</div>
                  ) : (
                    (liverCreditHistoryQuery.data || []).map((c: any) => {
                      const rc = RANK_CONFIG[c.rank] || RANK_CONFIG.none;
                      return (
                        <Card key={c.month} className="bg-gray-800 border-gray-700">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">{c.month}</span>
                                {c.rank !== "none" && (
                                  <Badge className={`${rc.badge} text-xs px-2`}>{rc.label}</Badge>
                                )}
                              </div>
                              <div className="text-right">
                                <div className={`text-sm font-bold ${Number(c.remainingCredit) < 0 ? "text-red-400" : "text-white"}`}>
                                  残: ¥{Number(c.remainingCredit).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">/ ¥{Number(c.totalCredit).toLocaleString()}</div>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-xs">
                              <div className="bg-gray-900 rounded p-1.5 text-center">
                                <div className="text-gray-500">配信</div>
                                <div className="text-white">{Number(c.streamingHours)}h</div>
                              </div>
                              <div className="bg-gray-900 rounded p-1.5 text-center">
                                <div className="text-gray-500">売上</div>
                                <div className="text-white">¥{Number(c.monthlySales).toLocaleString()}</div>
                              </div>
                              <div className="bg-gray-900 rounded p-1.5 text-center">
                                <div className="text-gray-500">使用済</div>
                                <div className="text-orange-400">¥{Number(c.usedCredit).toLocaleString()}</div>
                              </div>
                              <div className="bg-gray-900 rounded p-1.5 text-center">
                                <div className="text-gray-500">繰越</div>
                                <div className="text-blue-400">¥{Number(c.carryoverCredit).toLocaleString()}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Request History Tab */}
            <TabsContent value="request-history">
              <ScrollArea className="h-[55vh]">
                <div className="space-y-2 pr-2">
                  {liverRequestsQuery.isLoading ? (
                    <div className="text-center text-gray-500 py-8">読み込み中...</div>
                  ) : (liverRequestsQuery.data || []).length === 0 ? (
                    <div className="text-center text-gray-500 py-8">申請履歴がありません</div>
                  ) : (
                    (liverRequestsQuery.data || []).map((req: any) => {
                      const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                      const StatusIcon = sc.icon;
                      return (
                        <Card key={req.id} className="bg-gray-800 border-gray-700">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge className={`${sc.color} text-white text-xs`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {sc.label}
                                </Badge>
                                <span className="text-xs text-gray-500">#{req.id}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(req.createdAt).toLocaleDateString("ja-JP")}
                                </span>
                              </div>
                              <div className="text-sm font-semibold text-white">
                                ¥{Number(req.totalAmount).toLocaleString()}
                              </div>
                            </div>
                            {/* Items */}
                            <div className="space-y-1 mb-2">
                              {(req.items || []).map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-xs bg-gray-900 rounded px-2 py-1">
                                  <span className="text-gray-300 truncate mr-2">{item.productName} × {item.quantity}</span>
                                  <span className="text-gray-500 shrink-0">¥{(Number(item.price) * item.quantity).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                            {/* Price breakdown */}
                            <div className="grid grid-cols-3 gap-1 text-xs">
                              <div className="bg-gray-900 rounded p-1.5 text-center">
                                <div className="text-gray-500">定価</div>
                                <div className="text-white">¥{Number(req.totalAmount).toLocaleString()}</div>
                              </div>
                              <div className="bg-gray-900 rounded p-1.5 text-center">
                                <div className="text-purple-400">クレジット</div>
                                <div className="text-purple-400">¥{Number(req.creditUsed).toLocaleString()}</div>
                              </div>
                              <div className="bg-gray-900 rounded p-1.5 text-center">
                                <div className="text-orange-400">実費</div>
                                <div className="text-orange-400">¥{Number(req.outOfPocketAmount).toLocaleString()}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
