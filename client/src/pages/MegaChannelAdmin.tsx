import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Crown,
  Settings,
  Users,
  TrendingUp,
  Check,
  X,
  RefreshCw,
  ArrowLeft,
  Trophy,
  Zap,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLocation } from "wouter";

type TabType = "rankings" | "settings" | "history";

export default function MegaChannelAdmin() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("rankings");


  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    tierName: "Gold",
    hourlyRateThreshold: 100000,
    recentLivestreamCount: 3,
    channelName: "Ryu kyogoku",
    channelDescription: "",
    channelFollowerCount: 0,
    isActive: true,
    requireApproval: true,
    maintenanceMonths: 3,
  });

  // Fetch data
  const settingsQuery = trpc.megaChannel.getSettings.useQuery();
  const rankingsQuery = trpc.megaChannel.getAllRankings.useQuery({ recentCount: 3 });
  const qualificationsQuery = trpc.megaChannel.getAllQualifications.useQuery();

  // Mutations
  const updateSettingsMut = trpc.megaChannel.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("設定を更新しました");
      settingsQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const approveMut = trpc.megaChannel.approve.useMutation({
    onSuccess: () => {
      toast.success("承認しました");
      rankingsQuery.refetch();
      qualificationsQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const rejectMut = trpc.megaChannel.reject.useMutation({
    onSuccess: () => {
      toast.success("却下しました");
      rankingsQuery.refetch();
      qualificationsQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  const checkAllMut = trpc.megaChannel.checkAllQualifications.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated}名の資格を更新しました（全${data.total}名チェック）`);
      rankingsQuery.refetch();
      qualificationsQuery.refetch();
    },
    onError: (err) => toast.error(`エラー: ${err.message}`),
  });

  // Load settings into form
  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setSettingsForm({
        tierName: s.tierName || "Gold",
        hourlyRateThreshold: s.hourlyRateThreshold || 100000,
        recentLivestreamCount: s.recentLivestreamCount || 3,
        channelName: s.channelName || "Ryu kyogoku",
        channelDescription: s.channelDescription || "",
        channelFollowerCount: s.channelFollowerCount || 0,
        isActive: s.isActive ?? true,
        requireApproval: s.requireApproval ?? true,
        maintenanceMonths: s.maintenanceMonths || 3,
      });
    }
  }, [settingsQuery.data]);

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(num);

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600 text-white">承認済み</Badge>;
      case "qualified":
        return <Badge className="bg-yellow-500 text-black">承認待ち</Badge>;
      case "rejected":
        return <Badge className="bg-red-600 text-white">却下</Badge>;
      case "suspended":
        return <Badge className="bg-gray-500 text-white">停止中</Badge>;
      default:
        return <Badge variant="outline">未達成</Badge>;
    }
  };

  const threshold = settingsQuery.data?.hourlyRateThreshold || 100000;

  // Reject dialog state
  const [rejectLiverId, setRejectLiverId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // History expand state
  const [expandedLiverId, setExpandedLiverId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/master/livers")}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>ライバー一覧</span>
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            メガチャンネル管理
          </h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-800 pb-2">
          {[
            { id: "rankings" as TabType, label: "ランキング", icon: Trophy },
            { id: "settings" as TabType, label: "設定", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-gray-800 text-white border-b-2 border-yellow-400"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rankings Tab */}
        {activeTab === "rankings" && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-yellow-400" />
                  ライバー時間単価ランキング
                </h2>
                <Badge variant="outline" className="text-gray-300">
                  閾値: {formatCurrency(threshold)}/h
                </Badge>
              </div>
              <Button
                onClick={() => checkAllMut.mutate()}
                disabled={checkAllMut.isPending}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${checkAllMut.isPending ? "animate-spin" : ""}`} />
                全員の資格を一括チェック
              </Button>
            </div>

            {/* Rankings Table */}
            {rankingsQuery.isLoading ? (
              <div className="text-center py-10 text-gray-400">読み込み中...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="text-left py-3 px-3">#</th>
                      <th className="text-left py-3 px-3">ライバー</th>
                      <th className="text-right py-3 px-3">平均時間単価</th>
                      <th className="text-right py-3 px-3">直近配信数</th>
                      <th className="text-center py-3 px-3">資格</th>
                      <th className="text-center py-3 px-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingsQuery.data?.rankings.map((liver, idx) => {
                      const isAboveThreshold = liver.avgHourlyRate >= threshold;
                      const qualStatus = liver.qualification?.status;
                      return (
                        <tr
                          key={liver.liverId}
                          className={`border-b border-gray-800 ${
                            isAboveThreshold ? "bg-yellow-900/10" : ""
                          } hover:bg-gray-800/50 transition-colors`}
                        >
                          <td className="py-3 px-3">
                            {idx === 0 && <span className="text-2xl">🥇</span>}
                            {idx === 1 && <span className="text-2xl">🥈</span>}
                            {idx === 2 && <span className="text-2xl">🥉</span>}
                            {idx > 2 && <span className="text-gray-400">{idx + 1}</span>}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              {liver.avatarUrl ? (
                                <img
                                  src={liver.avatarUrl}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                                  {liver.liverName.charAt(0)}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-white">{liver.liverName}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span
                              className={`font-bold ${
                                isAboveThreshold ? "text-yellow-400" : "text-gray-300"
                              }`}
                            >
                              {formatCurrency(liver.avgHourlyRate)}/h
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-gray-300">
                            {liver.recentLivestreamCount}回
                          </td>
                          <td className="py-3 px-3 text-center">
                            {getStatusBadge(qualStatus)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {qualStatus === "qualified" && (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white h-7 px-2"
                                    onClick={() => approveMut.mutate({ liverId: liver.liverId })}
                                    disabled={approveMut.isPending}
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    承認
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-600 text-red-400 hover:bg-red-600/20 h-7 px-2"
                                    onClick={() => {
                                      setRejectLiverId(liver.liverId);
                                      setRejectReason("");
                                    }}
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    却下
                                  </Button>
                                </>
                              )}
                              {qualStatus === "approved" && (
                                <span className="text-green-400 text-xs flex items-center gap-1">
                                  <Crown className="w-3 h-3" />
                                  配信可能
                                </span>
                              )}
                              {!qualStatus && isAboveThreshold && (
                                <span className="text-yellow-400 text-xs">チェック待ち</span>
                              )}
                              <button
                                onClick={() =>
                                  setExpandedLiverId(
                                    expandedLiverId === liver.liverId ? null : liver.liverId
                                  )
                                }
                                className="text-gray-400 hover:text-white"
                              >
                                {expandedLiverId === liver.liverId ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            {/* Reject reason input */}
                            {rejectLiverId === liver.liverId && (
                              <div className="mt-2 flex gap-2">
                                <Input
                                  placeholder="却下理由を入力..."
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  className="h-7 text-xs bg-gray-800 border-gray-700"
                                />
                                <Button
                                  size="sm"
                                  className="bg-red-600 hover:bg-red-700 h-7 px-2 text-xs"
                                  onClick={() => {
                                    rejectMut.mutate({
                                      liverId: liver.liverId,
                                      reason: rejectReason || "理由なし",
                                    });
                                    setRejectLiverId(null);
                                  }}
                                >
                                  確定
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => setRejectLiverId(null)}
                                >
                                  キャンセル
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Expanded history */}
            {expandedLiverId && (
              <LiverHistoryPanel liverId={expandedLiverId} />
            )}

            {/* Summary Stats */}
            {rankingsQuery.data && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-4 text-center">
                    <Users className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-white">
                      {rankingsQuery.data.rankings.length}
                    </div>
                    <div className="text-xs text-gray-400">配信実績あり</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-4 text-center">
                    <Crown className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-yellow-400">
                      {rankingsQuery.data.rankings.filter((r) => r.avgHourlyRate >= threshold).length}
                    </div>
                    <div className="text-xs text-gray-400">閾値達成</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-4 text-center">
                    <Check className="w-6 h-6 text-green-400 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-green-400">
                      {rankingsQuery.data.rankings.filter((r) => r.qualification?.status === "approved").length}
                    </div>
                    <div className="text-xs text-gray-400">承認済み</div>
                  </CardContent>
                </Card>
                <Card className="bg-gray-800 border-gray-700">
                  <CardContent className="pt-4 text-center">
                    <Clock className="w-6 h-6 text-orange-400 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-orange-400">
                      {rankingsQuery.data.rankings.filter((r) => r.qualification?.status === "qualified").length}
                    </div>
                    <div className="text-xs text-gray-400">承認待ち</div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              メガチャンネル設定
            </h2>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-base">基本設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300">制度を有効にする</label>
                  <Switch
                    checked={settingsForm.isActive}
                    onCheckedChange={(v) => setSettingsForm((p) => ({ ...p, isActive: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-300">管理者承認を必要とする</label>
                  <Switch
                    checked={settingsForm.requireApproval}
                    onCheckedChange={(v) => setSettingsForm((p) => ({ ...p, requireApproval: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-base">ティア設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">ティア名</label>
                  <Input
                    value={settingsForm.tierName}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, tierName: e.target.value }))}
                    className="bg-gray-900 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">時間単価の閾値（円/h）</label>
                  <Input
                    type="number"
                    value={settingsForm.hourlyRateThreshold}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, hourlyRateThreshold: Number(e.target.value) }))
                    }
                    className="bg-gray-900 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    現在: {formatCurrency(settingsForm.hourlyRateThreshold)}/h
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">
                    直近何回のライブで判定するか
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.recentLivestreamCount}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, recentLivestreamCount: Number(e.target.value) }))
                    }
                    className="bg-gray-900 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">
                    維持条件: 基準を下回った連続月数で降格
                  </label>
                  <Input
                    type="number"
                    value={settingsForm.maintenanceMonths}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, maintenanceMonths: Number(e.target.value) }))
                    }
                    className="bg-gray-900 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {settingsForm.maintenanceMonths}ヶ月連続で基準を下回ると降格
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-base">メガチャンネル情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">チャンネル名</label>
                  <Input
                    value={settingsForm.channelName}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, channelName: e.target.value }))}
                    className="bg-gray-900 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">チャンネル説明</label>
                  <textarea
                    value={settingsForm.channelDescription}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, channelDescription: e.target.value }))
                    }
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2 text-sm min-h-[80px]"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">フォロワー数（表示用）</label>
                  <Input
                    type="number"
                    value={settingsForm.channelFollowerCount}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, channelFollowerCount: Number(e.target.value) }))
                    }
                    className="bg-gray-900 border-gray-600 text-white"
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => updateSettingsMut.mutate(settingsForm)}
              disabled={updateSettingsMut.isPending}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {updateSettingsMut.isPending ? "保存中..." : "設定を保存"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

// Liver History Panel Component
function LiverHistoryPanel({ liverId }: { liverId: number }) {
  const historyQuery = trpc.megaChannel.getHistory.useQuery({ liverId });

  if (historyQuery.isLoading) return <div className="text-gray-400 text-sm py-2">履歴を読み込み中...</div>;
  if (!historyQuery.data || historyQuery.data.length === 0)
    return <div className="text-gray-500 text-sm py-2">履歴はありません</div>;

  return (
    <Card className="bg-gray-800/50 border-gray-700 mt-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-300 flex items-center gap-2">
          <History className="w-4 h-4" />
          資格変更履歴
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {historyQuery.data.map((h) => (
            <div key={h.id} className="flex items-center gap-3 text-xs border-b border-gray-700 pb-2">
              <span className="text-gray-500 w-36 shrink-0">
                {new Date(h.createdAt).toLocaleString("ja-JP")}
              </span>
              <Badge
                className={
                  h.action === "approved"
                    ? "bg-green-600 text-white"
                    : h.action === "qualified"
                    ? "bg-yellow-500 text-black"
                    : h.action === "rejected"
                    ? "bg-red-600 text-white"
                    : "bg-gray-500 text-white"
                }
              >
                {h.action}
              </Badge>
              <span className="text-gray-300 truncate">{h.note}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
