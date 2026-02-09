import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Coins, Receipt, LogOut, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, TrendingDown, ShoppingCart, History, Link2, Copy, RefreshCw, ExternalLink, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function LineMypage() {
  const [, setLocation] = useLocation();
  const [historyFilter, setHistoryFilter] = useState<"all" | "earn" | "use">("all");
  
  const { data: user, isLoading: userLoading } = trpc.lineLogin.me.useQuery();
  const { data: pointsData, isLoading: pointsLoading } = trpc.lineLogin.getMyPoints.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: receipts, isLoading: receiptsLoading } = trpc.lineLogin.getMyReceipts.useQuery(undefined, {
    enabled: !!user,
  });
  
  // LINE連携状態
  const { data: linkStatus, isLoading: linkStatusLoading, refetch: refetchLinkStatus } = trpc.lineLogin.checkLineLinked.useQuery(undefined, {
    enabled: !!user,
  });
  
  // 有効な連携コード
  const { data: activeCode, refetch: refetchActiveCode } = trpc.lineLogin.getActiveLinkCode.useQuery(undefined, {
    enabled: !!user && !linkStatus?.isLinked,
  });
  
  // 連携コード生成
  const generateCodeMutation = trpc.lineLogin.generateLinkCode.useMutation({
    onSuccess: () => {
      refetchActiveCode();
      toast.success("連携コードを発行しました");
    },
    onError: (error) => {
      toast.error(error.message || "コードの発行に失敗しました");
    },
  });
  
  // コードの残り時間を計算
  const [remainingTime, setRemainingTime] = useState<string | null>(null);
  
  useEffect(() => {
    if (!activeCode?.expiresAt) {
      setRemainingTime(null);
      return;
    }
    
    const updateRemainingTime = () => {
      const expiresAt = new Date(activeCode.expiresAt).getTime();
      const now = Date.now();
      const diff = expiresAt - now;
      
      if (diff <= 0) {
        setRemainingTime(null);
        refetchActiveCode();
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemainingTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateRemainingTime();
    const interval = setInterval(updateRemainingTime, 1000);
    return () => clearInterval(interval);
  }, [activeCode?.expiresAt, refetchActiveCode]);
  
  // コードをコピー
  const copyCode = () => {
    if (activeCode?.code) {
      navigator.clipboard.writeText(activeCode.code);
      toast.success("コードをコピーしました");
    }
  };
  
  // フィルタリングされたポイント履歴
  const filteredTransactions = pointsData?.transactions?.filter((tx: any) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "earn") return tx.amount > 0;
    if (historyFilter === "use") return tx.amount < 0;
    return true;
  }) || [];

  const logoutMutation = trpc.lineLogin.logout.useMutation({
    onSuccess: () => {
      // Clear localStorage token
      localStorage.removeItem('line_session_token');
      setLocation("/");
    },
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <ShoppingBag className="h-16 w-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">ログインが必要です</h1>
          <p className="text-muted-foreground mb-6">
            マイページを表示するにはログインしてください。
          </p>
          <Button
            size="lg"
            className="w-full bg-rose-500 hover:bg-rose-600 text-white gap-2"
            onClick={() => setLocation("/line-login")}
          >
            ログイン / 新規登録
          </Button>
          <Button
            variant="ghost"
            className="mt-4 text-muted-foreground"
            onClick={() => setLocation("/")}
          >
            トップページに戻る
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="h-3 w-3 mr-1" />審査中</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />承認済み</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />却下</Badge>;
      case "on_hold":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><AlertCircle className="h-3 w-3 mr-1" />保留中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-rose-500" />
              <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                マイページ
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {user.pictureUrl && (
                <img src={user.pictureUrl} alt={user.displayName || ""} className="h-8 w-8 rounded-full" />
              )}
              <span className="text-sm font-medium hidden sm:inline">{user.displayName}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Points Summary - 改善されたデザイン */}
        <Card className="mb-8 border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-rose-700">
              <div className="h-10 w-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full flex items-center justify-center">
                <Coins className="h-5 w-5 text-white" />
              </div>
              保有ポイント
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pointsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-5xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
                    {pointsData?.balance.toLocaleString() || 0}
                  </span>
                  <span className="text-xl text-rose-600 font-medium">ポイント</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <p className="text-sm text-muted-foreground">累計獲得</p>
                    </div>
                    <p className="text-lg font-bold text-green-600">+{pointsData?.lifetimeEarned.toLocaleString() || 0} pt</p>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="h-4 w-4 text-blue-500" />
                      <p className="text-sm text-muted-foreground">累計利用</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600">-{pointsData?.lifetimeUsed.toLocaleString() || 0} pt</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-rose-200">
                  <Button 
                    className="w-full bg-rose-500 hover:bg-rose-600 gap-2"
                    onClick={() => setLocation("/mall/products")}
                  >
                    <ShoppingBag className="h-4 w-4" />
                    ポイントで商品を購入
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="history" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">ポイント履歴</TabsTrigger>
            <TabsTrigger value="receipts">レシート申請</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5 text-rose-500" />
                      ポイント履歴
                    </CardTitle>
                    <CardDescription>ポイントの獲得・利用履歴</CardDescription>
                  </div>
                  <Select value={historyFilter} onValueChange={(v) => setHistoryFilter(v as "all" | "earn" | "use")}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="earn">獲得のみ</SelectItem>
                      <SelectItem value="use">利用のみ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {pointsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : filteredTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {filteredTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div className="flex items-start gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? "bg-green-100" : "bg-red-100"}`}>
                            {tx.amount > 0 ? (
                              <TrendingUp className="h-5 w-5 text-green-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {tx.description || (tx.amount > 0 ? "ポイント獲得" : "ポイント利用")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(tx.createdAt), "yyyy年M月d日 HH:mm", { locale: ja })}
                            </p>
                            {tx.referenceType && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {tx.referenceType === "receipt" && <Receipt className="h-3 w-3 mr-1" />}
                                {tx.referenceType === "order" && <ShoppingCart className="h-3 w-3 mr-1" />}
                                {tx.referenceType === "receipt" ? "レシート承認" : tx.referenceType === "order" ? "商品購入" : tx.referenceType}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} pt
                          </div>
                          <div className="text-xs text-muted-foreground">
                            残高: {tx.balanceAfter?.toLocaleString() || "-"} pt
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{historyFilter === "all" ? "ポイント履歴がありません" : historyFilter === "earn" ? "獲得履歴がありません" : "利用履歴がありません"}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts">
            {/* Webフォームへの誘導カード */}
            <Card className="mb-4 border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-100">
                    <Upload className="h-8 w-8 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Webフォームでレシートを申請</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      高精度AI解析で確実にポイントが付与されます
                    </p>
                  </div>
                  <Button
                    className="w-full bg-rose-500 hover:bg-rose-600 text-white"
                    onClick={() => {
                      // セッショントークンをURLパラメータに付与して外部ブラウザでも認証を引き継ぐ
                      const token = localStorage.getItem('lcj_session_token');
                      if (token) {
                        setLocation(`/receipt-upload?token=${encodeURIComponent(token)}`);
                      } else {
                        setLocation('/receipt-upload');
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    レシートをアップロードする
                  </Button>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>1. レシート画像をアップロード</p>
                    <p>2. AIが自動で解析</p>
                    <p>3. 内容を確認して申請完了</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 既存の申請履歴 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">レシート申請履歴</CardTitle>
                <CardDescription>過去のレシート申請状況</CardDescription>
              </CardHeader>
              <CardContent>
                {receiptsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : receipts && receipts.length > 0 ? (
                  <div className="space-y-4">
                    {receipts.map((receipt: any) => (
                      <div key={receipt.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium">{receipt.storeName || "店舗名未確認"}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(receipt.submittedAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                            </p>
                          </div>
                          {getStatusBadge(receipt.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">購入金額: </span>
                            <span className="font-medium">¥{receipt.purchaseAmount?.toLocaleString() || "-"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">獲得ポイント: </span>
                            <span className="font-medium text-rose-500">{receipt.pointsAwarded?.toLocaleString() || "-"} pt</span>
                          </div>
                        </div>
                        {receipt.rejectionReason && (
                          <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                            却下理由: {receipt.rejectionReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>レシート申請履歴がありません</p>
                    <p className="text-sm mt-2">上のボタンからレシートをアップロードしてポイントを獲得しましょう</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* LINE連携セクション */}
        <Card className="mt-8 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
                <Link2 className="h-5 w-5 text-white" />
              </div>
              LINEアカウント連携
            </CardTitle>
            <CardDescription>
              LINEを連携すると、レシートをLINEで送信できるようになります
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkStatusLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              </div>
            ) : linkStatus?.isLinked ? (
              <div className="bg-white/60 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="font-bold text-emerald-700">LINE連携済み</p>
                    <p className="text-sm text-muted-foreground">レシートをLINEで送信できます</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeCode?.code && remainingTime ? (
                  <div className="bg-white rounded-lg p-4 border-2 border-emerald-200">
                    <p className="text-sm text-muted-foreground mb-2">モール会員用連携コード（有効期限: {remainingTime}）</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-emerald-50 rounded-lg p-3 text-center">
                        <span className="text-3xl font-mono font-bold tracking-widest text-emerald-700">
                          {activeCode.code}
                        </span>
                      </div>
                      <Button variant="outline" size="icon" onClick={copyCode}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      このコードをLCJ MALL公式LINEに送信してください
                    </p>
                    <Button
                      variant="outline"
                      className="w-full mt-3 gap-2"
                      onClick={() => generateCodeMutation.mutate()}
                      disabled={generateCodeMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 ${generateCodeMutation.isPending ? 'animate-spin' : ''}`} />
                      新しいコードを発行
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      LINEを連携すると、レシートをLINEで送信できるようになります
                    </p>
                    <Button
                      className="w-full bg-emerald-500 hover:bg-emerald-600 gap-2"
                      onClick={() => generateCodeMutation.mutate()}
                      disabled={generateCodeMutation.isPending}
                    >
                      {generateCodeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      連携コードを発行
                    </Button>
                  </div>
                )}
                
                {/* LINE連携の手順 */}
                <div className="bg-white/60 rounded-lg p-4 mt-4">
                  <p className="font-medium text-sm mb-3">連携手順</p>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span>上の「連携コードを発行」ボタンをタップ</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span>表示されたコード（M-XXXXXX）をコピー</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <span>LCJ MALL公式LINEにコードを送信</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 h-5 w-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <span>連携完了！</span>
                    </li>
                  </ol>
                  <a href="https://lin.ee/hpVjAiOe" target="_blank" rel="noopener noreferrer" className="block mt-4">
                    <Button variant="outline" className="w-full gap-2 border-[#06C755] text-[#06C755] hover:bg-[#06C755]/10">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                      </svg>
                      LCJ MALL公式LINEを開く
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* How to earn points */}
        <Card className="mt-8 border-rose-100">
          <CardHeader>
            <CardTitle className="text-lg">ポイントの貯め方</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 h-6 w-6 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center font-bold text-xs">1</span>
                <span>ライブコマースで商品を購入</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 h-6 w-6 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center font-bold text-xs">2</span>
                <span>購入後7日以内にレシート画像をLINEで送信</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 h-6 w-6 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center font-bold text-xs">3</span>
                <span>承認後、購入金額の1%がポイントとして付与</span>
              </li>
            </ol>
            <div className="mt-4 pt-4 border-t">
              <a href="https://lin.ee/hpVjAiOe" target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-[#06C755] hover:bg-[#05b04c] text-white gap-2">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  LINEでレシートを送る
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
