import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Gift, Users, TrendingUp, Loader2, Share2, Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function LiverReferralCard() {
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 紹介コード取得
  const { data: referralCode, isLoading: codeLoading } = trpc.liver.getMyReferralCode.useQuery();

  // 紹介統計
  const { data: stats, isLoading: statsLoading } = trpc.liver.getReferralStats.useQuery();

  const copyCode = () => {
    if (!referralCode?.code) return;
    navigator.clipboard.writeText(referralCode.code);
    toast.success("紹介コードをコピーしました");
  };

  const shareCode = () => {
    if (!referralCode?.code) return;
    const shareUrl = `https://lcjmall.com/line-login?ref=${referralCode.code}&mode=register`;
    const text = `LCJ MALLで使える紹介コード: ${referralCode.code}\n新規登録で500ポイントもらえます！\n${shareUrl}`;
    if (navigator.share) {
      navigator.share({ title: "LCJ MALL 紹介コード", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success("紹介テキストをコピーしました");
    }
  };

  if (codeLoading) {
    return (
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardContent className="p-3 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 overflow-hidden">
        <CardContent className="p-3">
          {/* コンパクトヘッダー + コード + ボタン */}
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-purple-500 leading-tight">紹介コード</p>
              <p className="text-xl font-mono font-black tracking-[0.3em] text-purple-700 leading-tight">
                {referralCode?.code || "----"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-purple-300 text-purple-700 hover:bg-purple-100"
                onClick={copyCode}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                className="h-8 w-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                onClick={shareCode}
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 簡易統計（1行） */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-100">
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-purple-500">
                紹介 <strong className="text-purple-700">{referralCode?.totalReferrals || 0}</strong>人
              </span>
              <span className="text-[11px] text-purple-500">
                獲得 <strong className="text-purple-700">{(referralCode?.totalPointsEarned || 0).toLocaleString()}</strong>pt
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="text-[11px] text-purple-600 hover:text-purple-800 flex items-center gap-0.5"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "閉じる" : "詳細"}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <span className="text-purple-300 mx-0.5">|</span>
              <button
                className="text-[11px] text-purple-600 hover:text-purple-800 flex items-center gap-0.5"
                onClick={() => setShowStatsDialog(true)}
              >
                <TrendingUp className="h-3 w-3" />
                統計
              </button>
            </div>
          </div>

          {/* 展開時の詳細 */}
          {expanded && (
            <div className="mt-2 bg-white/60 rounded-lg p-2.5 border border-purple-100">
              <p className="text-[11px] font-medium text-purple-700 mb-0.5">配信中の宣伝例:</p>
              <p className="text-[11px] text-purple-600 italic leading-relaxed">
                「LCJ MALLで紹介コード <strong>{referralCode?.code || "XXXX"}</strong> を入力すると500ポイントもらえるよ！」
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 統計ダイアログ */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              紹介コード統計
            </DialogTitle>
            <DialogDescription>
              あなたの紹介コードの利用状況
            </DialogDescription>
          </DialogHeader>

          {statsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : stats ? (
            <div className="space-y-4">
              {/* サマリー */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <Users className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-700">
                    {stats.code?.totalReferrals || 0}
                  </p>
                  <p className="text-xs text-purple-500">紹介人数</p>
                </div>
                <div className="bg-pink-50 rounded-lg p-3 text-center">
                  <Gift className="h-5 w-5 text-pink-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-pink-700">
                    {(stats.code?.totalPointsEarned || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-pink-500">獲得ポイント</p>
                </div>
              </div>

              {/* 紹介履歴 */}
              {stats.history && stats.history.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">最近の紹介</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {stats.history.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={item.userPicture || undefined} />
                          <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                            {item.userName?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.userName || "ユーザー"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString("ja-JP")}
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          +{item.referrerPoints}pt
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">まだ紹介実績がありません</p>
                  <p className="text-xs mt-1">配信中に紹介コードを宣伝しましょう！</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">統計情報を取得できませんでした</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
