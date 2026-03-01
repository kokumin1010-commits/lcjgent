import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import haptic from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  ArrowLeft,
  Wallet,
  ArrowRightLeft,
  Link2,
  Link2Off,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Coins,
  Sparkles,
  ExternalLink,
  History,
  ChevronRight,
  Info,
} from "lucide-react";

export default function BeautyWallet() {
  const [, setLocation] = useLocation();
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);

  // ユーザー情報
  const { data: user, isLoading: userLoading } = trpc.lineLogin.me.useQuery();

  // ポイント残高
  const { data: pointsData, isLoading: pointsLoading } = trpc.lineLogin.getMyPoints.useQuery(undefined, {
    enabled: !!user,
  });

  // BW連携状態
  const { data: linkStatus, isLoading: linkLoading, refetch: refetchLinkStatus } = trpc.beautyWallet.getLinkStatus.useQuery(
    { lineUserId: user?.id ?? 0 },
    { enabled: !!user?.id }
  );

  // 交換レート
  const { data: rateInfo } = trpc.beautyWallet.getExchangeRate.useQuery();

  // 交換履歴
  const { data: exchangeHistory, isLoading: historyLoading, refetch: refetchHistory } = trpc.beautyWallet.getExchangeHistory.useQuery(
    { lineUserId: user?.id ?? 0 },
    { enabled: !!user?.id }
  );

  // BW連携開始
  const startLinkMutation = trpc.beautyWallet.startLink.useMutation({
    onSuccess: (data) => {
      haptic.doubleTap();
      window.open(data.linkUrl, "_blank");
      toast.info("Beauty Walletの連携ページを開きました");
    },
    onError: (error) => {
      toast.error(`連携に失敗しました: ${error.message}`);
    },
  });

  // BW連携解除
  const unlinkMutation = trpc.beautyWallet.unlink.useMutation({
    onSuccess: () => {
      haptic.warning();
      toast.success("Beauty Walletの連携を解除しました");
      setShowUnlinkDialog(false);
      refetchLinkStatus();
    },
    onError: (error) => {
      toast.error(`連携解除に失敗しました: ${error.message}`);
    },
  });

  // ポイント交換
  const exchangeMutation = trpc.beautyWallet.exchange.useMutation({
    onSuccess: (data) => {
      haptic.celebration();
      toast.success(
        `${data.lcjPointsUsed.toLocaleString()}pt → ${data.bwTokensReceived.toLocaleString()}BT に交換しました！`
      );
      setShowConfirmDialog(false);
      setExchangeAmount("");
      refetchHistory();
    },
    onError: (error) => {
      toast.error(`交換に失敗しました: ${error.message}`);
    },
  });

  // 計算値
  const lcjPoints = parseInt(exchangeAmount) || 0;
  const bwTokens = useMemo(() => {
    if (!rateInfo || lcjPoints < rateInfo.minPoints) return 0;
    return Math.floor(lcjPoints * rateInfo.rate);
  }, [lcjPoints, rateInfo]);

  const balance = pointsData?.balance ?? 0;
  const canExchange = lcjPoints >= (rateInfo?.minPoints ?? 100) && lcjPoints <= balance && lcjPoints % 100 === 0;

  // ローディング
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  // 未ログイン
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-violet-500" />
            <h2 className="text-xl font-bold mb-2">ログインが必要です</h2>
            <p className="text-muted-foreground mb-4">
              Beauty Wallet連携にはLCJ MALLへのログインが必要です
            </p>
            <Button onClick={() => setLocation("/line-login")} className="bg-violet-600 hover:bg-violet-700">
              ログインする
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-pink-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/mypage")} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold">Beauty Wallet</h1>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* BW連携カード */}
        <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 shadow-lg overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-violet-200/30 to-transparent rounded-bl-full" />
          <CardHeader className="relative">
            <CardTitle className="flex items-center gap-2 text-violet-700">
              <Link2 className="h-5 w-5" />
              アカウント連携
            </CardTitle>
            <CardDescription>
              LCJポイントをBeauty Tokenに交換するには、Beauty Walletアカウントとの連携が必要です
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            {linkLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              </div>
            ) : linkStatus?.isLinked ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                  <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-green-700">連携済み</p>
                    {linkStatus.account?.bwDisplayName && (
                      <p className="text-sm text-muted-foreground truncate">
                        {linkStatus.account.bwDisplayName}
                      </p>
                    )}
                    {linkStatus.account?.bwEmail && (
                      <p className="text-xs text-muted-foreground truncate">
                        {linkStatus.account.bwEmail}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setShowUnlinkDialog(true)}
                  >
                    <Link2Off className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-white/60 rounded-lg p-3">
                  <AlertCircle className="h-5 w-5 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">まだ連携されていません</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Beauty Walletアカウントを連携して、LCJポイントをBeauty Tokenに交換しましょう
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 gap-2"
                  onClick={() => {
                    haptic.doubleTap();
                    if (user?.id) {
                      startLinkMutation.mutate({ lineUserId: user.id });
                    }
                  }}
                  disabled={startLinkMutation.isPending}
                >
                  {startLinkMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Beauty Walletと連携する
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 交換レート情報 */}
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="h-12 w-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Coins className="h-6 w-6 text-rose-500" />
                </div>
                <p className="text-sm font-medium">LCJポイント</p>
                <p className="text-2xl font-bold text-rose-600">100</p>
              </div>
              <div className="flex flex-col items-center">
                <ArrowRightLeft className="h-6 w-6 text-amber-600" />
                <p className="text-xs text-muted-foreground mt-1">交換</p>
              </div>
              <div className="text-center">
                <div className="h-12 w-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-1">
                  <Sparkles className="h-6 w-6 text-violet-500" />
                </div>
                <p className="text-sm font-medium">Beauty Token</p>
                <p className="text-2xl font-bold text-violet-600">40</p>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">
              ※ 100ポイント単位で交換可能 ・ 最低100ポイントから
            </p>
          </CardContent>
        </Card>

        {/* ポイント交換セクション */}
        {linkStatus?.isLinked && (
          <Card className="border-rose-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-700">
                <ArrowRightLeft className="h-5 w-5" />
                ポイント交換
              </CardTitle>
              <CardDescription>
                保有ポイント: <span className="font-bold text-rose-600">{balance.toLocaleString()}</span> pt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 交換額入力 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">交換するLCJポイント</label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="100"
                    value={exchangeAmount}
                    onChange={(e) => setExchangeAmount(e.target.value)}
                    min={100}
                    step={100}
                    className="pr-8 text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">pt</span>
                </div>
                {/* クイック選択ボタン */}
                <div className="flex gap-2 flex-wrap">
                  {[100, 500, 1000, 5000].map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setExchangeAmount(String(amount))}
                      disabled={amount > balance}
                    >
                      {amount.toLocaleString()}pt
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const max = Math.floor(balance / 100) * 100;
                      setExchangeAmount(String(max));
                    }}
                    disabled={balance < 100}
                  >
                    全額
                  </Button>
                </div>
              </div>

              {/* 交換プレビュー */}
              {lcjPoints > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">使用ポイント</span>
                    <span className="font-bold text-rose-600">-{lcjPoints.toLocaleString()} pt</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">受取トークン</span>
                    <span className="font-bold text-violet-600">+{bwTokens.toLocaleString()} BT</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">交換後残高</span>
                    <span className="font-medium">{(balance - lcjPoints).toLocaleString()} pt</span>
                  </div>
                </div>
              )}

              {/* バリデーションメッセージ */}
              {lcjPoints > 0 && !canExchange && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {lcjPoints > balance
                    ? "ポイント残高が不足しています"
                    : lcjPoints % 100 !== 0
                    ? "100ポイント単位で入力してください"
                    : "最低100ポイントから交換可能です"}
                </div>
              )}

              {/* 交換ボタン */}
              <Button
                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 gap-2 text-lg py-6"
                disabled={!canExchange || exchangeMutation.isPending}
                onClick={() => setShowConfirmDialog(true)}
              >
                <ArrowRightLeft className="h-5 w-5" />
                交換する
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 交換履歴 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-700">
              <History className="h-5 w-5" />
              交換履歴
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : exchangeHistory && exchangeHistory.length > 0 ? (
              <div className="space-y-3">
                {exchangeHistory.map((ex: any) => (
                  <div key={ex.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-violet-100">
                        <ArrowRightLeft className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {Number(ex.lcjPointsUsed).toLocaleString()}pt → {Number(ex.bwTokensReceived).toLocaleString()}BT
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(ex.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                        </p>
                      </div>
                    </div>
                    <div>
                      {ex.bwTransferStatus === "completed" ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          完了
                        </Badge>
                      ) : ex.bwTransferStatus === "pending" ? (
                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                          <Clock className="h-3 w-3 mr-1" />
                          処理中
                        </Badge>
                      ) : ex.bwTransferStatus === "failed" ? (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                          <XCircle className="h-3 w-3 mr-1" />
                          失敗
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {ex.bwTransferStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>交換履歴がありません</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Beauty Walletとは？ */}
        <Card className="border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-violet-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <h3 className="font-bold text-sm">Beauty Walletとは？</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Beauty Walletは、美容サロンで使えるデジタルウォレットです。
                  LCJポイントをBeauty Tokenに交換して、提携サロンでのお支払いにご利用いただけます。
                </p>
                <a
                  href="https://beautypass.ai/guide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  詳しくはこちら
                  <ChevronRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* 交換確認ダイアログ */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ポイント交換の確認</DialogTitle>
            <DialogDescription>
              以下の内容で交換しますか？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">使用ポイント</span>
                <span className="font-bold text-rose-600">-{lcjPoints.toLocaleString()} pt</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">受取トークン</span>
                <span className="font-bold text-violet-600">+{bwTokens.toLocaleString()} BT</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ※ 交換後のポイントの返還はできません
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowConfirmDialog(false)}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700"
              disabled={exchangeMutation.isPending}
              onClick={() => {
                if (user?.id && user?.lineUserId) {
                  exchangeMutation.mutate({
                    lineUserId: user.id,
                    lineUserIdStr: user.lineUserId,
                    lcjPoints,
                  });
                }
              }}
            >
              {exchangeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "交換する"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 連携解除確認ダイアログ */}
      <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>連携解除の確認</DialogTitle>
            <DialogDescription>
              Beauty Walletとの連携を解除しますか？解除後もBeauty Wallet側の残高は保持されます。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowUnlinkDialog(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={unlinkMutation.isPending}
              onClick={() => {
                if (user?.id) {
                  unlinkMutation.mutate({ lineUserId: user.id });
                }
              }}
            >
              {unlinkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "連携解除"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
