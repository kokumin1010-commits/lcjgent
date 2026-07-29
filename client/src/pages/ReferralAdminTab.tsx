import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Gift,
  TrendingUp,
  Crown,
  Copy,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ArrowRight,
  Megaphone,
  Trophy,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

const TITLE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  platinum: { label: "プラチナ", color: "text-purple-600 bg-purple-50", emoji: "👑" },
  gold: { label: "ゴールド", color: "text-yellow-600 bg-yellow-50", emoji: "⭐" },
  silver: { label: "シルバー", color: "text-gray-600 bg-gray-100", emoji: "🥈" },
  bronze: { label: "ブロンズ", color: "text-amber-700 bg-amber-50", emoji: "🥉" },
  none: { label: "-", color: "text-gray-400 bg-gray-50", emoji: "" },
};

export default function ReferralAdminTab() {
  const [historyPage, setHistoryPage] = useState(0);
  const [activeSection, setActiveSection] = useState<"friend" | "liver">("friend");
  const PAGE_SIZE = 30;

  // 友達招待チャレンジ data
  const { data: stats, isLoading: statsLoading } = trpc.friendReferral.adminStats.useQuery();
  const { data: leaderboard, isLoading: leaderboardLoading } = trpc.friendReferral.adminLeaderboard.useQuery();
  const { data: history, isLoading: historyLoading } = trpc.friendReferral.adminHistory.useQuery({
    limit: PAGE_SIZE,
    offset: historyPage * PAGE_SIZE,
  });

  // ライバー紹介コード data
  const { data: referralCodes, isLoading: codesLoading } = trpc.referral.getAll.useQuery();

  const liverTotalReferrals = referralCodes?.reduce((sum, r) => sum + (r.totalReferrals ?? 0), 0) ?? 0;
  const liverTotalPoints = referralCodes?.reduce((sum, r) => sum + (r.totalPointsEarned ?? 0), 0) ?? 0;
  const liverActiveCodesCount = referralCodes?.filter(r => r.isActive).length ?? 0;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`コード ${code} をコピーしました`);
  };

  return (
    <div className="space-y-6">
      {/* セクション切替 */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeSection === "friend" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSection("friend")}
          className="gap-1.5"
        >
          <UserPlus className="h-4 w-4" />
          友達招待チャレンジ
        </Button>
        <Button
          variant={activeSection === "liver" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSection("liver")}
          className="gap-1.5"
        >
          <Megaphone className="h-4 w-4" />
          ライバー紹介コード
        </Button>
      </div>

      {/* ===== 友達招待チャレンジ ===== */}
      {activeSection === "friend" && (
        <div className="space-y-6">
          {/* 統計カード */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">参加者数</span>
                </div>
                <p className="text-xl font-bold">{statsLoading ? "..." : stats?.totalParticipants ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">総招待数</span>
                </div>
                <p className="text-xl font-bold">{statsLoading ? "..." : stats?.totalReferrals ?? 0}人</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-pink-500" />
                  <span className="text-xs text-muted-foreground">総付与pt</span>
                </div>
                <p className="text-xl font-bold">{statsLoading ? "..." : (stats?.totalPointsAwarded ?? 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">今日の招待</span>
                </div>
                <p className="text-xl font-bold">{statsLoading ? "..." : stats?.todayReferrals ?? 0}人</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">アクティブ紹介者</span>
                </div>
                <p className="text-xl font-bold">{statsLoading ? "..." : stats?.activeReferrers ?? 0}人</p>
              </CardContent>
            </Card>
          </div>

          {/* ランキング */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                招待ランキング（完全版）
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : leaderboard && leaderboard.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>ユーザー</TableHead>
                        <TableHead className="text-center">称号</TableHead>
                        <TableHead className="text-center">紹介コード</TableHead>
                        <TableHead className="text-center">招待人数</TableHead>
                        <TableHead className="text-center">獲得pt</TableHead>
                        <TableHead className="text-center">ステージ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((item, index) => {
                        const title = TITLE_LABELS[item.titleLevel || "none"] || TITLE_LABELS.none;
                        return (
                          <TableRow key={item.lineUserId}>
                            <TableCell>
                              {index < 3 ? (
                                <Crown className={`h-5 w-5 ${
                                  index === 0 ? "text-yellow-500" :
                                  index === 1 ? "text-gray-400" :
                                  "text-amber-700"
                                }`} />
                              ) : (
                                <span className="text-sm text-muted-foreground font-medium">{index + 1}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={item.pictureUrl || undefined} />
                                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                    {item.displayName?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm">{item.displayName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {title.emoji && (
                                <Badge variant="outline" className={`text-xs ${title.color}`}>
                                  {title.emoji} {title.label}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() => copyCode(item.referralCode || "")}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 font-mono text-xs cursor-pointer"
                              >
                                {item.referralCode}
                                <Copy className="h-3 w-3 text-gray-400" />
                              </button>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold text-blue-600">{item.totalReferrals}</span>
                              <span className="text-xs text-muted-foreground ml-0.5">人</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="font-semibold text-pink-600">{(item.totalPointsEarned ?? 0).toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground ml-0.5">pt</span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                Stage {item.currentStage}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">まだ招待実績がありません</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 招待履歴テーブル */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-500" />
                  招待履歴
                  {history && <span className="text-sm font-normal text-muted-foreground ml-2">{history.total}件</span>}
                </CardTitle>
                {history && history.total > PAGE_SIZE && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage === 0}
                      onClick={() => setHistoryPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {historyPage + 1} / {Math.ceil(history.total / PAGE_SIZE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(historyPage + 1) * PAGE_SIZE >= history.total}
                      onClick={() => setHistoryPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : history && history.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>招待者</TableHead>
                        <TableHead className="text-center w-10"></TableHead>
                        <TableHead>被招待者</TableHead>
                        <TableHead className="text-center">招待者pt</TableHead>
                        <TableHead className="text-center">被招待者pt</TableHead>
                        <TableHead className="text-center">日時</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={item.referrerPictureUrl || undefined} />
                                <AvatarFallback className="bg-blue-100 text-blue-700 text-[10px]">
                                  {item.referrerName?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{item.referrerName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={item.inviteePictureUrl || undefined} />
                                <AvatarFallback className="bg-green-100 text-green-700 text-[10px]">
                                  {item.inviteeName?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{item.inviteeName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium text-blue-600">+{item.referrerPointsAwarded}pt</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium text-green-600">+{item.inviteePointsAwarded}pt</span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">招待履歴はまだありません</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== ライバー紹介コード ===== */}
      {activeSection === "liver" && (
        <div className="space-y-6">
          {/* 統計カード */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Megaphone className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">発行コード数</span>
                </div>
                <p className="text-xl font-bold">{codesLoading ? "..." : liverActiveCodesCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">総紹介人数</span>
                </div>
                <p className="text-xl font-bold">{codesLoading ? "..." : liverTotalReferrals}人</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Gift className="h-4 w-4 text-pink-500" />
                  <span className="text-xs text-muted-foreground">総付与ポイント</span>
                </div>
                <p className="text-xl font-bold">{codesLoading ? "..." : liverTotalPoints.toLocaleString()}pt</p>
              </CardContent>
            </Card>
          </div>

          {/* ライバー紹介コード一覧テーブル */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ライバー紹介コード一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {codesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : referralCodes && referralCodes.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>ライバー</TableHead>
                        <TableHead className="text-center">紹介コード</TableHead>
                        <TableHead className="text-center">紹介人数</TableHead>
                        <TableHead className="text-center">獲得pt</TableHead>
                        <TableHead className="text-center">ステータス</TableHead>
                        <TableHead className="text-center">作成日</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referralCodes.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {index < 3 ? (
                              <Crown className={`h-5 w-5 ${
                                index === 0 ? "text-yellow-500" :
                                index === 1 ? "text-gray-400" :
                                "text-amber-700"
                              }`} />
                            ) : (
                              <span className="text-sm text-muted-foreground">{index + 1}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={item.liverAvatarUrl || undefined} />
                                <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                                  {item.liverName?.charAt(0) || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{item.liverName || "不明"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => copyCode(item.code)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 font-mono text-sm font-bold tracking-wider text-purple-700 cursor-pointer"
                            >
                              {item.code}
                              <Copy className="h-3 w-3 text-purple-400" />
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold text-blue-600">{item.totalReferrals ?? 0}</span>
                            <span className="text-xs text-muted-foreground ml-0.5">人</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold text-pink-600">{(item.totalPointsEarned ?? 0).toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground ml-0.5">pt</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={item.isActive ? "default" : "secondary"} className={item.isActive ? "bg-green-100 text-green-700 hover:bg-green-100 text-xs" : "text-xs"}>
                              {item.isActive ? "有効" : "無効"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("ja-JP") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">紹介コードはまだ発行されていません</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
