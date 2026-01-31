import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingBag, Coins, Receipt, LogOut, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function LineMypage() {
  const [, setLocation] = useLocation();
  
  const { data: user, isLoading: userLoading } = trpc.lineLogin.me.useQuery();
  const { data: pointsData, isLoading: pointsLoading } = trpc.lineLogin.getMyPoints.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: receipts, isLoading: receiptsLoading } = trpc.lineLogin.getMyReceipts.useQuery(undefined, {
    enabled: !!user,
  });

  const logoutMutation = trpc.lineLogin.logout.useMutation({
    onSuccess: () => {
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
            マイページを表示するにはLINEでログインしてください。
          </p>
          <Button
            size="lg"
            className="w-full bg-[#06C755] hover:bg-[#05b04c] text-white gap-2"
            onClick={() => setLocation("/line-login")}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
            </svg>
            LINEでログイン
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
        {/* Points Summary */}
        <Card className="mb-8 border-rose-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-rose-500" />
              ポイント残高
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pointsLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-rose-500">
                  {pointsData?.balance.toLocaleString() || 0}
                </span>
                <span className="text-lg text-muted-foreground">ポイント</span>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">累計獲得</p>
                <p className="font-medium">{pointsData?.lifetimeEarned.toLocaleString() || 0} pt</p>
              </div>
              <div>
                <p className="text-muted-foreground">累計利用</p>
                <p className="font-medium">{pointsData?.lifetimeUsed.toLocaleString() || 0} pt</p>
              </div>
            </div>
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
                <CardTitle className="text-lg">ポイント履歴</CardTitle>
                <CardDescription>ポイントの獲得・利用履歴</CardDescription>
              </CardHeader>
              <CardContent>
                {pointsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : pointsData?.transactions && pointsData.transactions.length > 0 ? (
                  <div className="space-y-3">
                    {pointsData.transactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0">
                        <div>
                          <p className="font-medium">{tx.description || (tx.type === "earn" ? "ポイント獲得" : "ポイント利用")}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(tx.createdAt), "yyyy/MM/dd HH:mm", { locale: ja })}
                          </p>
                        </div>
                        <div className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} pt
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>ポイント履歴がありません</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipts">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">レシート申請履歴</CardTitle>
                <CardDescription>LINEで送信したレシートの申請状況</CardDescription>
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
                    <p className="text-sm mt-2">LINEでレシート画像を送信してポイントを獲得しましょう</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
