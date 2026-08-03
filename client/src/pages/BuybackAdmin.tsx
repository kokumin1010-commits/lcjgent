/**
 * BuybackAdmin - 管理者/パートナー向け買取管理ページ
 * DashboardLayout内で表示される管理画面
 * 
 * 改善点:
 * - パートナー選択ドロップダウン（査定時）
 * - 画像ギャラリー（クリックで拡大表示）
 * - CSVエクスポート機能
 * - AI査定の詳細表示（真贋チェック・市場トレンド）
 * - 統計タブの改善
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { 
  Package, DollarSign, Truck, Check, X,
  ChevronDown, Send, Image as ImageIcon,
  Users, TrendingUp, Sparkles, Download, ZoomIn
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: "査定待ち", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  ai_assessed: { label: "AI査定完了", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  partner_assessed: { label: "査定済", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
  accepted: { label: "承認済", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  shipped: { label: "発送済", color: "text-indigo-700", bgColor: "bg-indigo-50 border-indigo-200" },
  received: { label: "受取確認", color: "text-teal-700", bgColor: "bg-teal-50 border-teal-200" },
  inspecting: { label: "鑑定中", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
  completed: { label: "完了", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
  cancelled: { label: "キャンセル", color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" },
  rejected: { label: "拒否", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
};

// CSV Export utility
function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;
  const headers = ["ID", "ステータス", "ブランド", "モデル", "カテゴリ", "AI最低", "AI最高", "最終金額", "ユーザー", "作成日"];
  const rows = data.map(r => [
    r.id,
    STATUS_LABELS[r.status]?.label || r.status,
    r.aiBrand || r.brandName || "",
    r.aiModel || r.productName || "",
    r.category,
    r.aiEstimatedMin || "",
    r.aiEstimatedMax || "",
    r.finalAmount || "",
    r.displayName || "",
    new Date(r.createdAt).toLocaleDateString("ja-JP"),
  ]);
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BuybackAdmin() {
  const [activeTab, setActiveTab] = useState<"requests" | "partners" | "stats">("requests");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">買取管理</h1>
          <p className="text-sm text-gray-500">中古ブランド品買取・オークション連携</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === "requests" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Package className="inline w-4 h-4 mr-1" /> 買取依頼
        </button>
        <button
          onClick={() => setActiveTab("partners")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === "partners" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <Users className="inline w-4 h-4 mr-1" /> パートナー
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
            activeTab === "stats" ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <TrendingUp className="inline w-4 h-4 mr-1" /> 統計
        </button>
      </div>

      {activeTab === "requests" && (
        <RequestsTab 
          statusFilter={statusFilter} 
          setStatusFilter={setStatusFilter}
          selectedRequest={selectedRequest}
          setSelectedRequest={setSelectedRequest}
        />
      )}
      {activeTab === "partners" && <PartnersTab />}
      {activeTab === "stats" && <StatsTab />}
    </div>
  );
}

function RequestsTab({ 
  statusFilter, setStatusFilter, selectedRequest, setSelectedRequest 
}: { 
  statusFilter: string; 
  setStatusFilter: (s: string) => void;
  selectedRequest: number | null;
  setSelectedRequest: (id: number | null) => void;
}) {
  const requests = trpc.buyback.getAllRequests.useQuery({ 
    status: statusFilter === "all" ? undefined : statusFilter as any,
    limit: 50 
  });

  const handleExportCSV = () => {
    if (requests.data?.requests) {
      exportToCSV(requests.data.requests, "buyback_requests");
    }
  };

  return (
    <div>
      {/* Status Filter + Export */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
              statusFilter === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            すべて
          </button>
          {Object.entries(STATUS_LABELS).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                statusFilter === key ? `${val.bgColor} ${val.color} border-current` : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {val.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleExportCSV}
          disabled={!requests.data?.requests?.length}
          className="ml-3 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>

      {/* Total count */}
      {requests.data && (
        <p className="text-xs text-gray-500 mb-3">{requests.data.total}件の依頼</p>
      )}

      {/* Request List */}
      {requests.isLoading ? (
        <div className="text-center py-12 text-gray-400">読み込み中...</div>
      ) : requests.data?.requests?.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>該当する依頼がありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.data?.requests?.map((req: any) => (
            <div key={req.id}>
              <div
                onClick={() => setSelectedRequest(selectedRequest === req.id ? null : req.id)}
                className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-200 cursor-pointer transition-all"
              >
                <div className="flex items-start gap-3">
                  {req.imageUrls?.[0] ? (
                    <img src={req.imageUrls[0]} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_LABELS[req.status]?.bgColor} ${STATUS_LABELS[req.status]?.color}`}>
                        {STATUS_LABELS[req.status]?.label}
                      </span>
                      <span className="text-xs text-gray-400">#{req.id}</span>
                    </div>
                    <p className="font-medium text-sm text-gray-900">
                      {req.aiBrand || req.brandName || "ブランド不明"} - {req.aiModel || req.productName || req.category}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {req.displayName} • {new Date(req.createdAt).toLocaleDateString("ja-JP")}
                    </p>
                    {req.aiEstimatedMin && (
                      <p className="text-sm font-medium text-blue-600 mt-1">
                        AI査定: ¥{Number(req.aiEstimatedMin).toLocaleString()}〜¥{Number(req.aiEstimatedMax).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${selectedRequest === req.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded Detail */}
              {selectedRequest === req.id && (
                <RequestDetailPanel requestId={req.id} onClose={() => setSelectedRequest(null)} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Image gallery with lightbox
function ImageGallery({ imageUrls }: { imageUrls: string[] }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {imageUrls?.map((url: string, i: number) => (
          <div 
            key={i} 
            className="relative group cursor-pointer"
            onClick={() => setLightboxUrl(url)}
          >
            <img src={url} alt="" className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-all flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
      {/* Lightbox */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxUrl} 
            alt="" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function RequestDetailPanel({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const [assessAmount, setAssessAmount] = useState("");
  const [assessNote, setAssessNote] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [message, setMessage] = useState("");

  const detail = trpc.buyback.getRequestDetailAdmin.useQuery({ requestId });
  const partners = trpc.buyback.getPartners.useQuery();
  const assessMutation = trpc.buyback.submitAssessment.useMutation();
  const confirmReceiveMutation = trpc.buyback.confirmReceived.useMutation();
  const completeMutation = trpc.buyback.completeTransaction.useMutation();
  const rejectFakeMutation = trpc.buyback.rejectFake.useMutation();
  const sendMessageMutation = trpc.buyback.sendAdminMessage.useMutation();

  if (detail.isLoading) return <div className="p-4 text-center text-gray-400">読み込み中...</div>;
  if (!detail.data) return null;

  const req = detail.data;
  const activePartners = partners.data?.filter((p: any) => p.status === "active") || [];

  const handleAssess = async () => {
    if (!assessAmount) return;
    await assessMutation.mutateAsync({
      requestId,
      partnerId: selectedPartnerId ? Number(selectedPartnerId) : undefined,
      amount: Number(assessAmount),
      note: assessNote || undefined,
    });
    setAssessAmount("");
    setAssessNote("");
    setSelectedPartnerId("");
    detail.refetch();
  };

  const handleConfirmReceive = async () => {
    if (!confirm("商品の受取を確認し、鑑定を開始しますか？")) return;
    await confirmReceiveMutation.mutateAsync({ requestId, partnerId: 1 });
    detail.refetch();
  };

  const handleComplete = async () => {
    const amount = prompt("最終確定金額を入力してください（円）:");
    if (!amount) return;
    await completeMutation.mutateAsync({ requestId, partnerId: 1, finalAmount: Number(amount) });
    detail.refetch();
  };

  const handleRejectFake = async () => {
    const reason = prompt("鑑定不合格の理由を入力してください:");
    if (!reason) return;
    if (!confirm(`この商品を偽物として退回しますか？\n理由: ${reason}`)) return;
    await rejectFakeMutation.mutateAsync({ requestId, partnerId: 1, reason });
    detail.refetch();
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    await sendMessageMutation.mutateAsync({ requestId, message: message.trim() });
    setMessage("");
    detail.refetch();
  };

  return (
    <div className="bg-gray-50 rounded-b-xl p-4 border border-t-0 border-gray-100 space-y-4">
      {/* Images with lightbox */}
      <ImageGallery imageUrls={req.imageUrls || []} />

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-white rounded-lg p-3">
          <p className="text-gray-500 text-xs">カテゴリ</p>
          <p className="font-medium">{req.category}</p>
        </div>
        <div className="bg-white rounded-lg p-3">
          <p className="text-gray-500 text-xs">状態</p>
          <p className="font-medium">{req.condition || "未指定"}</p>
        </div>
        <div className="bg-white rounded-lg p-3">
          <p className="text-gray-500 text-xs">ブランド (AI)</p>
          <p className="font-medium">{req.aiBrand || "-"}</p>
        </div>
        <div className="bg-white rounded-lg p-3">
          <p className="text-gray-500 text-xs">モデル (AI)</p>
          <p className="font-medium">{req.aiModel || "-"}</p>
        </div>
      </div>

      {req.description && (
        <div className="bg-white rounded-lg p-3 text-sm">
          <p className="text-gray-500 text-xs mb-1">補足説明</p>
          <p>{req.description}</p>
        </div>
      )}

      {/* AI Assessment with enhanced details */}
      {req.aiEstimatedMin && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI概算査定
          </p>
          <p className="text-lg font-bold text-blue-700">
            ¥{Number(req.aiEstimatedMin).toLocaleString()} 〜 ¥{Number(req.aiEstimatedMax).toLocaleString()}
          </p>
          <p className="text-xs text-blue-500">信頼度: {Math.round((Number(req.aiConfidence) || 0) * 100)}%</p>
          {/* Enhanced AI details */}
          {req.aiRawResponse && (
            <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
              {req.aiRawResponse.authenticityNotes && (
                <p className="text-xs text-blue-700">
                  <span className="font-medium">真贋:</span> {req.aiRawResponse.authenticityNotes}
                </p>
              )}
              {req.aiRawResponse.marketTrend && (
                <p className="text-xs text-blue-700">
                  <span className="font-medium">市場:</span> {req.aiRawResponse.marketTrend}
                </p>
              )}
              {req.aiRawResponse.reasoning && (
                <p className="text-xs text-blue-600 mt-1">{req.aiRawResponse.reasoning}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Partner Assessment Form with partner selection */}
      {(req.status === "pending" || req.status === "ai_assessed") && (
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="font-bold text-sm mb-3 flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-green-600" /> 査定金額を入力
          </h4>
          {/* Partner Selection */}
          {activePartners.length > 0 && (
            <div className="mb-3">
              <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="パートナーを選択（任意）" />
                </SelectTrigger>
                <SelectContent>
                  {activePartners.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              value={assessAmount}
              onChange={(e) => setAssessAmount(e.target.value)}
              placeholder="査定金額（円）"
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
            />
            <button
              onClick={handleAssess}
              disabled={!assessAmount || assessMutation.isPending}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {assessMutation.isPending ? "..." : "送信"}
            </button>
          </div>
          <input
            type="text"
            value={assessNote}
            onChange={(e) => setAssessNote(e.target.value)}
            placeholder="備考（任意）"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      )}

      {/* Existing Assessments */}
      {req.assessments && req.assessments.length > 0 && (
        <div className="bg-white rounded-lg p-4 border">
          <h4 className="font-bold text-sm mb-2">査定履歴</h4>
          {req.assessments.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">¥{Number(a.amount).toLocaleString()}</p>
                <p className="text-xs text-gray-500">{a.companyName || `パートナー#${a.partnerId}`}</p>
                {a.note && <p className="text-xs text-gray-400">{a.note}</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                a.status === "accepted" ? "bg-green-100 text-green-700" : 
                a.status === "rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
              }`}>
                {a.status === "accepted" ? "承認" : a.status === "rejected" ? "拒否" : "保留"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Shipping Info */}
      {req.shippingTrackingNumber && (
        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
          <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
            <Truck className="w-3 h-3" /> 配送情報
          </p>
          <p className="text-sm font-medium">{req.shippingCarrier}: {req.shippingTrackingNumber}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {req.status === "shipped" && (
          <button
            onClick={handleConfirmReceive}
            disabled={confirmReceiveMutation.isPending}
            className="flex-1 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <Check className="w-4 h-4" /> 受取確認・鑑定開始
          </button>
        )}
        {req.status === "inspecting" && (
          <>
            <button
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              className="flex-1 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Check className="w-4 h-4" /> 鑑定通過・打款
            </button>
            <button
              onClick={handleRejectFake}
              disabled={rejectFakeMutation.isPending}
              className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <X className="w-4 h-4" /> 偽物・退回
            </button>
          </>
        )}
      </div>

      {/* Transaction Logs */}
      {req.logs && req.logs.length > 0 && (
        <details className="bg-white rounded-lg p-4 border">
          <summary className="font-bold text-sm cursor-pointer text-gray-700">取引ログ ({req.logs.length})</summary>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {req.logs.map((log: any) => (
              <div key={log.id} className="text-xs text-gray-600 py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-400">{new Date(log.createdAt).toLocaleString("ja-JP")}</span>
                {" • "}
                <span className="font-medium">{log.action}</span>
                {" • "}
                <span>{log.actorType}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Messages */}
      <div className="bg-white rounded-lg p-4 border">
        <h4 className="font-bold text-sm mb-2">メッセージ</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
          {req.messages?.length === 0 && <p className="text-xs text-gray-400">メッセージなし</p>}
          {req.messages?.map((msg: any) => (
            <div key={msg.id} className={`text-sm p-2 rounded-lg ${
              msg.senderType === "admin" || msg.senderType === "partner" ? "bg-amber-50 mr-8" : "bg-gray-50 ml-8"
            }`}>
              <p className="text-xs text-gray-500 mb-0.5">{msg.senderName} ({msg.senderType})</p>
              <p>{msg.message}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="メッセージを送信"
            className="flex-1 px-3 py-2 border rounded-lg text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button 
            onClick={handleSendMessage} 
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="p-2 bg-amber-500 text-white rounded-lg disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnersTab() {
  const partners = trpc.buyback.getPartners.useQuery();
  const [showAddForm, setShowAddForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [specialties, setSpecialties] = useState("");

  const addPartnerMutation = trpc.buyback.createPartner.useMutation();

  const handleAddPartner = async () => {
    if (!companyName || !licenseNumber) return;
    await addPartnerMutation.mutateAsync({
      companyName,
      contactName: contactName || companyName,
      email: email || `${companyName.replace(/\s/g, '')}@partner.lcj`,
      phone: phone || undefined,
      licenseNumber,
      lineUserId: lineUserId || undefined,
      specialties: specialties ? specialties.split(",").map(s => s.trim()).filter(Boolean) : undefined,
    });
    setShowAddForm(false);
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setLicenseNumber("");
    setLineUserId("");
    setSpecialties("");
    partners.refetch();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold text-lg">パートナー一覧</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium"
        >
          + 追加
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl p-4 border mb-4 space-y-3">
          <h3 className="font-bold text-sm">新規パートナー登録</h3>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="会社名 *"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            type="text"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="古物商許可番号 *"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="担当者名"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="電話番号"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            type="text"
            value={lineUserId}
            onChange={(e) => setLineUserId(e.target.value)}
            placeholder="LINE User ID（通知用）"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            type="text"
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="専門分野（カンマ区切り: bag,watch,jewelry）"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border rounded-lg text-sm">
              キャンセル
            </button>
            <button
              onClick={handleAddPartner}
              disabled={!companyName || !licenseNumber || addPartnerMutation.isPending}
              className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {addPartnerMutation.isPending ? "登録中..." : "登録"}
            </button>
          </div>
        </div>
      )}

      {partners.isLoading ? (
        <div className="text-center py-8 text-gray-400">読み込み中...</div>
      ) : partners.data?.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>パートナーが登録されていません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.data?.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl p-4 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.companyName}</p>
                  <p className="text-xs text-gray-500">許可番号: {p.licenseNumber}</p>
                  {p.contactName && <p className="text-xs text-gray-500">担当: {p.contactName}</p>}
                  {p.totalAssessments > 0 && (
                    <p className="text-xs text-gray-400 mt-1">査定数: {p.totalAssessments}件</p>
                  )}
                  {p.specialties && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(typeof p.specialties === 'string' ? JSON.parse(p.specialties) : p.specialties)?.map((s: string, i: number) => (
                        <span key={i} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {p.status === "active" ? "有効" : "無効"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsTab() {
  const stats = trpc.buyback.getDashboardStats.useQuery();

  if (stats.isLoading) {
    return <div className="text-center py-12 text-gray-400">読み込み中...</div>;
  }

  const data = stats.data || { totalRequests: 0, pendingRequests: 0, completedRequests: 0, activePartners: 0, totalRevenue: 0, avgTransactionAmount: 0 };
  
  // Compute completion rate
  const completionRate = data.totalRequests > 0 
    ? Math.round((data.completedRequests / data.totalRequests) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border">
          <p className="text-xs text-gray-500">総依頼数</p>
          <p className="text-2xl font-bold text-gray-900">{data.totalRequests}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <p className="text-xs text-gray-500">査定待ち</p>
          <p className="text-2xl font-bold text-yellow-600">{data.pendingRequests}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <p className="text-xs text-gray-500">完了</p>
          <p className="text-2xl font-bold text-green-600">{data.completedRequests}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border">
          <p className="text-xs text-gray-500">アクティブパートナー</p>
          <p className="text-2xl font-bold text-blue-600">{data.activePartners}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-100">
          <p className="text-sm text-amber-700">総取引額</p>
          <p className="text-xl font-bold text-amber-800">¥{Number(data.totalRevenue || 0).toLocaleString()}</p>
        </div>
        {Number(data.avgTransactionAmount) > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-700">平均取引額</p>
            <p className="text-xl font-bold text-blue-800">¥{Number(data.avgTransactionAmount).toLocaleString()}</p>
          </div>
        )}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
          <p className="text-sm text-green-700">完了率</p>
          <p className="text-xl font-bold text-green-800">{completionRate}%</p>
        </div>
      </div>
    </div>
  );
}
