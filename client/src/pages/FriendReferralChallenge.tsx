import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Copy, Share2, Trophy, Sparkles, Gift, Users, Crown, Star } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import SpinWheel from "@/components/SpinWheel";

const TITLE_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  none: { label: "ビギナー", emoji: "🌱", color: "text-gray-500", bg: "bg-gray-100" },
  bronze: { label: "ブロンズ", emoji: "🥉", color: "text-amber-700", bg: "bg-amber-50" },
  silver: { label: "シルバー", emoji: "🥈", color: "text-gray-500", bg: "bg-gray-100" },
  gold: { label: "ゴールド", emoji: "⭐", color: "text-yellow-600", bg: "bg-yellow-50" },
  platinum: { label: "プラチナ", emoji: "👑", color: "text-purple-600", bg: "bg-purple-50" },
  diamond: { label: "ダイヤモンド", emoji: "💎", color: "text-pink-600", bg: "bg-pink-50" },
};

export default function FriendReferralChallenge() {
  const [, setLocation] = useLocation();
  const [showSpinDialog, setShowSpinDialog] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<{ emoji: string; points: number; label: string } | null>(null);
  const [isSpecialSpin, setIsSpecialSpin] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("challenge");

  const { data: campaignData } = trpc.friendReferral.getCampaign.useQuery();
  const { data: myProgress, refetch: refetchProgress, isLoading: isProgressLoading, error: progressError } = trpc.friendReferral.getMyProgress.useQuery(undefined, {
    retry: 1,
  });
  const { data: leaderboard } = trpc.friendReferral.getLeaderboard.useQuery();
  const { data: activityFeed } = trpc.friendReferral.getActivityFeed.useQuery();
  const { data: spinItems } = trpc.friendReferral.getSpinItems.useQuery({ isSpecial: isSpecialSpin });

  const spinMutation = trpc.friendReferral.spin.useMutation({
    onSuccess: (data) => {
      setSpinResult({ emoji: data.rewardItem.emoji, points: data.pointsWon, label: data.rewardItem.label });
      setTimeout(() => {
        setShowSpinDialog(false);
        setShowResultDialog(true);
        refetchProgress();
      }, 500);
    },
    onError: (err) => toast.error(err.message),
  });

  const stages = useMemo(() => campaignData?.stages || [], [campaignData]);
  const progress = myProgress?.progress;
  const campaign = myProgress?.campaign || campaignData?.campaign;

  const currentStageIndex = stages.findIndex(s => s.stageNumber === (progress?.currentStage || 0));
  const nextStage = stages[currentStageIndex + 1] || stages[0];
  const progressPercent = nextStage
    ? Math.min(100, ((progress?.totalReferrals || 0) / nextStage.requiredReferrals) * 100)
    : 100;

  const titleInfo = TITLE_CONFIG[progress?.titleLevel || "none"] || TITLE_CONFIG.none;

  const handleCopyCode = () => {
    if (!progress?.referralCode) return;
    navigator.clipboard.writeText(progress.referralCode);
    toast.success("招待コードをコピーしました！", { icon: "📋" });
  };

  const handleShare = () => {
    if (!progress?.referralCode) return;
    const shareText = `LCJ MALLで一緒にお買い物しよう！🛍️✨\n私の招待コード: ${progress.referralCode}\n登録するだけで${campaign?.inviteeBonus || 50}ptもらえるよ！`;
    if (navigator.share) {
      navigator.share({ title: "LCJ MALL 友達招待", text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success("共有テキストをコピーしました！", { icon: "📤" });
    }
  };

  const handleSpin = () => {
    if (isSpinning) return;
    spinMutation.mutate({ isSpecial: isSpecialSpin });
  };

  const openSpinDialog = (special: boolean) => {
    setIsSpecialSpin(special);
    setSpinResult(null);
    setShowSpinDialog(true);
  };

  const hasSessionToken = !!localStorage.getItem('lcj_session_token');
  const isLoggedIn = !!progress;
  const isCheckingAuth = isProgressLoading && hasSessionToken;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/mypage")} className="p-2 rounded-full hover:bg-pink-50 transition">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              友達招待チャレンジ
            </h1>
          </div>
          {isLoggedIn && (
            <Badge className={`${titleInfo.bg} ${titleInfo.color} border-0 font-semibold`}>
              {titleInfo.emoji} {titleInfo.label}
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-24">
        {/* Hero Banner */}
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-purple-600 p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-6 -translate-x-6" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium text-pink-100">期間限定キャンペーン</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">友達を招待して</h2>
            <h2 className="text-2xl font-bold mb-3">ポイントをGET！🎁</h2>
            <p className="text-pink-100 text-sm leading-relaxed">
              友達を招待するたびにステージが進み、確定ポイント＋ルーレットでボーナスチャンス！
              招待された友達にも{campaign?.inviteeBonus || 50}ptプレゼント✨
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="w-full bg-pink-50 border border-pink-100">
            <TabsTrigger value="challenge" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm text-sm">
              🎯 チャレンジ
            </TabsTrigger>
            <TabsTrigger value="ranking" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm text-sm">
              🏆 ランキング
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 data-[state=active]:bg-white data-[state=active]:text-pink-600 data-[state=active]:shadow-sm text-sm">
              📋 履歴
            </TabsTrigger>
          </TabsList>

          {/* Challenge Tab */}
          <TabsContent value="challenge" className="mt-4 space-y-4">
            {isCheckingAuth ? (
              <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="h-16 w-16 mx-auto bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center animate-pulse">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">読み込み中...</h3>
                  <p className="text-sm text-gray-500">あなたのチャレンジ情報を取得しています</p>
                </CardContent>
              </Card>
            ) : !isLoggedIn ? (
              <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white">
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="h-16 w-16 mx-auto bg-gradient-to-br from-pink-400 to-purple-400 rounded-full flex items-center justify-center">
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">ログインして参加しよう！</h3>
                  <p className="text-sm text-gray-500">友達招待チャレンジに参加するにはログインが必要です</p>
                  <div className="flex flex-col gap-2 w-full max-w-xs mx-auto">
                    <Button onClick={() => setLocation("/line-login?redirect=/friend-challenge")} className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white w-full">
                      ✉️ メールでログイン / 新規登録
                    </Button>
                    <Button onClick={() => setLocation("/line-login?redirect=/friend-challenge")} variant="outline" className="border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10 w-full">
                      <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 5.93 2 10.74c0 3.16 2.08 5.93 5.18 7.49l-.85 3.13c-.07.26.2.47.44.34l3.68-2.07c.51.07 1.03.11 1.55.11 5.52 0 10-3.93 10-8.74S17.52 2 12 2z"/></svg>
                      LINEでログイン
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* My Referral Code */}
                <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-pink-700">
                      <Gift className="h-5 w-5" />
                      あなたの招待コード
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 bg-white border-2 border-dashed border-pink-300 rounded-xl px-4 py-3 text-center">
                        <span className="text-2xl font-bold tracking-[0.3em] text-pink-600">
                          {progress?.referralCode || "------"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCopyCode} variant="outline" className="flex-1 border-pink-200 text-pink-600 hover:bg-pink-50">
                        <Copy className="h-4 w-4 mr-1" /> コピー
                      </Button>
                      <Button onClick={handleShare} className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600">
                        <Share2 className="h-4 w-4 mr-1" /> 友達に共有
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Progress Summary */}
                <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white rounded-xl p-3 border border-purple-100">
                        <p className="text-2xl font-bold text-purple-600">{progress?.totalReferrals || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">招待人数</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-pink-100">
                        <p className="text-2xl font-bold text-pink-600">{progress?.totalPointsEarned || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">獲得pt</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-amber-100">
                        <p className="text-2xl font-bold text-amber-600">
                          {(progress?.pendingSpins || 0) + (progress?.pendingSpecialSpins || 0)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">スピン残</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Spin Buttons */}
                {((progress?.pendingSpins || 0) > 0 || (progress?.pendingSpecialSpins || 0) > 0) && (
                  <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 shadow-lg">
                    <CardContent className="pt-5 space-y-3">
                      <div className="text-center mb-2">
                        <span className="text-2xl">🎰</span>
                        <h3 className="text-lg font-bold text-amber-800">ルーレットを回そう！</h3>
                        <p className="text-sm text-amber-600">ボーナスポイントをGETするチャンス✨</p>
                      </div>
                      {(progress?.pendingSpins || 0) > 0 && (
                        <Button onClick={() => openSpinDialog(false)}
                          className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-6 text-base rounded-xl shadow-md">
                          <Sparkles className="h-5 w-5 mr-2" />
                          通常ルーレット（残り{progress?.pendingSpins}回）
                        </Button>
                      )}
                      {(progress?.pendingSpecialSpins || 0) > 0 && (
                        <Button onClick={() => openSpinDialog(true)}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-6 text-base rounded-xl shadow-md">
                          <Crown className="h-5 w-5 mr-2" />
                          プレミアムルーレット（残り{progress?.pendingSpecialSpins}回）
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Stage Progress */}
                <Card className="border-pink-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-pink-700">
                      <Star className="h-5 w-5" />
                      ステージ進捗
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {nextStage && (
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">
                            次のステージまで: あと{Math.max(0, nextStage.requiredReferrals - (progress?.totalReferrals || 0))}人
                          </span>
                          <span className="text-pink-600 font-semibold">{Math.round(progressPercent)}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-3 bg-pink-100 [&>div]:bg-gradient-to-r [&>div]:from-pink-500 [&>div]:to-rose-500" />
                      </div>
                    )}

                    <div className="space-y-3">
                      {stages.map((stage) => {
                        const isCompleted = (progress?.currentStage || 0) >= stage.stageNumber;
                        const isCurrent = nextStage?.stageNumber === stage.stageNumber;
                        return (
                          <div key={stage.id}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                              ${isCompleted ? "bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200" :
                                isCurrent ? "bg-white border-pink-300 shadow-sm ring-1 ring-pink-200" :
                                "bg-gray-50 border-gray-100 opacity-60"}`}>
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0
                              ${isCompleted ? "bg-gradient-to-br from-pink-400 to-rose-500" :
                                isCurrent ? "bg-pink-100" : "bg-gray-200"}`}>
                              {isCompleted ? "✅" : stage.stageEmoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-800">{stage.stageName}</span>
                                {isCurrent && <Badge className="bg-pink-100 text-pink-600 border-0 text-[10px]">NOW</Badge>}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {stage.requiredReferrals}人招待 → {stage.fixedReward}pt + ルーレット{stage.spinCount}回
                                {stage.isSpecialSpin && " ⭐プレミアム"}
                              </p>
                            </div>
                            {isCompleted && (
                              <Badge className="bg-green-100 text-green-700 border-0 text-xs shrink-0">達成！</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                      <p className="text-xs text-purple-700 font-medium">
                        🔄 ステージ5達成後も、10人招待ごとに500pt + ルーレット2回がもらえます！
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Activity Feed */}
            {activityFeed && activityFeed.length > 0 && (
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-gray-700">
                    <Sparkles className="h-5 w-5 text-pink-500" />
                    みんなの活動
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {activityFeed.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-lg shrink-0">
                          {activity.activityType === "stage_clear" ? "🎉" :
                           activity.activityType === "big_win" ? "🎰" : "✨"}
                        </span>
                        <span className="text-gray-600 flex-1 min-w-0 truncate">{activity.message}</span>
                        <span className="text-xs text-gray-400 shrink-0">
                          {new Date(activity.createdAt).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Ranking Tab */}
          <TabsContent value="ranking" className="mt-4 space-y-4">
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <Trophy className="h-5 w-5" />
                  招待ランキング TOP20
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!leaderboard || leaderboard.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="text-4xl">🏆</span>
                    <p className="text-gray-500 mt-2">まだランキングデータがありません</p>
                    <p className="text-sm text-gray-400">最初のランカーになろう！</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => {
                      const entryTitle = TITLE_CONFIG[entry.titleLevel || "none"] || TITLE_CONFIG.none;
                      return (
                        <div key={index}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                            ${index === 0 ? "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 shadow-sm" :
                              index === 1 ? "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200" :
                              index === 2 ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200" :
                              "bg-white border-gray-100"}`}>
                          <div className="w-8 h-8 flex items-center justify-center shrink-0">
                            {index === 0 ? <span className="text-xl">🥇</span> :
                             index === 1 ? <span className="text-xl">🥈</span> :
                             index === 2 ? <span className="text-xl">🥉</span> :
                             <span className="text-sm font-bold text-gray-400">{index + 1}</span>}
                          </div>
                          {entry.pictureUrl ? (
                            <img src={entry.pictureUrl} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                              <Users className="h-4 w-4 text-pink-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800 truncate">{entry.displayName}</p>
                            <Badge className={`${entryTitle.bg} ${entryTitle.color} border-0 text-[10px] px-1.5`}>
                              {entryTitle.emoji} {entryTitle.label}
                            </Badge>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-pink-600 text-sm">{entry.totalReferrals}人</p>
                            <p className="text-xs text-gray-400">{entry.totalPointsEarned}pt</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4 space-y-4">
            {isCheckingAuth ? (
              <Card className="border-pink-200">
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-500 animate-pulse">読み込み中...</p>
                </CardContent>
              </Card>
            ) : !isLoggedIn ? (
              <Card className="border-pink-200">
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-500">ログインすると招待履歴が確認できます</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="border-pink-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-pink-700">
                      <Users className="h-5 w-5" />
                      招待した友達
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!myProgress?.history || myProgress.history.length === 0 ? (
                      <div className="text-center py-6">
                        <span className="text-3xl">👥</span>
                        <p className="text-gray-500 mt-2 text-sm">まだ招待した友達がいません</p>
                        <p className="text-xs text-gray-400">招待コードを共有して友達を招待しよう！</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {myProgress.history.map((ref) => (
                          <div key={ref.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-pink-50/50 border border-pink-100">
                            {ref.inviteePictureUrl ? (
                              <img src={ref.inviteePictureUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-pink-200 flex items-center justify-center">
                                <Users className="h-4 w-4 text-pink-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{ref.inviteeDisplayName}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(ref.createdAt).toLocaleDateString("ja-JP")}
                              </p>
                            </div>
                            <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                              +{ref.referrerPointsAwarded}pt
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-purple-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2 text-purple-700">
                      <Sparkles className="h-5 w-5" />
                      ルーレット履歴
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!myProgress?.spinHistory || myProgress.spinHistory.length === 0 ? (
                      <div className="text-center py-6">
                        <span className="text-3xl">🎰</span>
                        <p className="text-gray-500 mt-2 text-sm">まだルーレットを回していません</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {myProgress.spinHistory.map((spin) => (
                          <div key={spin.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-purple-50/50 border border-purple-100">
                            <span className="text-xl">{spin.isSpecialSpin ? "👑" : "🎰"}</span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">
                                {spin.isSpecialSpin ? "プレミアム" : "通常"}ルーレット
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(spin.createdAt).toLocaleDateString("ja-JP")}
                              </p>
                            </div>
                            <Badge className="bg-purple-100 text-purple-700 border-0 text-xs font-bold">
                              +{spin.pointsWon}pt
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* How it works */}
        <Card className="mt-6 border-gray-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-700">📖 遊び方</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: "1", emoji: "📤", title: "招待コードを共有", desc: "あなたの招待コードを友達にシェア" },
                { step: "2", emoji: "👥", title: "友達が登録", desc: "友達がコードを使って新規登録" },
                { step: "3", emoji: "🎁", title: "ポイントGET", desc: "ステージ達成で確定ポイント獲得" },
                { step: "4", emoji: "🎰", title: "ルーレット", desc: "ボーナスルーレットでさらにポイント" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="h-8 w-8 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{item.emoji} {item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rules */}
        <div className="mt-4 mb-8 p-4 bg-gray-50 rounded-xl">
          <h4 className="text-xs font-semibold text-gray-500 mb-2">注意事項</h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>・1日の招待上限: {campaign?.maxDailyReferrals || 5}人</li>
            <li>・月間ポイント上限: {campaign?.monthlyPointCap?.toLocaleString() || "5,000"}pt</li>
            <li>・招待された方にも{campaign?.inviteeBonus || 50}ptプレゼント</li>
            <li>・不正な招待はポイント取消の対象となります</li>
            <li>・キャンペーン内容は予告なく変更される場合があります</li>
          </ul>
        </div>
      </div>

      {/* Spin Dialog */}
      <Dialog open={showSpinDialog} onOpenChange={(open) => { if (!isSpinning) setShowSpinDialog(open); }}>
        <DialogContent className="max-w-sm mx-auto bg-gradient-to-b from-white to-pink-50 border-pink-200">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              {isSpecialSpin ? "👑 プレミアムルーレット" : "🎰 ルーレット"}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-500">
              タップしてルーレットを回そう！
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {spinItems && spinItems.length > 0 && (
              <SpinWheel
                items={spinItems}
                onSpinComplete={handleSpin}
                isSpinning={isSpinning}
                setIsSpinning={setIsSpinning}
                isSpecial={isSpecialSpin}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-sm mx-auto bg-gradient-to-b from-yellow-50 to-white border-yellow-200">
          <DialogHeader>
            <DialogTitle className="sr-only">ルーレット結果</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4 space-y-4">
            <div className="text-6xl animate-bounce">{spinResult?.emoji || "🎉"}</div>
            <h3 className="text-xl font-bold text-gray-800">おめでとう！🎊</h3>
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl py-3 px-6 inline-block">
              <span className="text-3xl font-bold">{spinResult?.points || 0}</span>
              <span className="text-lg ml-1">pt GET！</span>
            </div>
            <p className="text-sm text-gray-500">ポイントが付与されました✨</p>
            <Button onClick={() => setShowResultDialog(false)} className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white">
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
