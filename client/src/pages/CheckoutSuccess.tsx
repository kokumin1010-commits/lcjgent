import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import haptic from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Package, ArrowLeft, ShoppingBag, Loader2, AlertCircle } from "lucide-react";
import { Link, useSearch } from "wouter";

export default function CheckoutSuccess() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const orderNumber = params.get("order") || "";

  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const startTimeRef = useRef(Date.now());

  const { data: orderStatus, isLoading } = trpc.mall.checkOrderPaymentStatus.useQuery(
    { orderNumber },
    { 
      enabled: !!orderNumber && pollingEnabled, 
      refetchInterval: pollingEnabled ? 3000 : false,
    }
  );

  // 決済完了後はポーリング停止
  const isPaid = orderStatus?.status === "paid" || orderStatus?.status === "confirmed";

  useEffect(() => {
    if (isPaid) {
      setPollingEnabled(false);
    }
  }, [isPaid]);

  // 60秒後にタイムアウト（ポーリングを停止し、メッセージを変更）
  useEffect(() => {
    if (isPaid) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
      setPollingEnabled(false);
    }, 60000);
    return () => clearTimeout(timer);
  }, [isPaid]);

  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isPaid) {
      setShowConfetti(true);
      haptic.celebration();
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isPaid]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-500 mx-auto mb-4" />
          <p className="text-muted-foreground">注文情報を確認中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* 紙吹雪アニメーション */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
                fontSize: `${12 + Math.random() * 16}px`,
              }}
            >
              {["🎉", "🎊", "✨", "💫", "🌟"][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <div className="container max-w-lg mx-auto px-4 py-12">
        <Card className="border-green-200 shadow-xl">
          <CardContent className="p-8 text-center">
            {isPaid ? (
              <>
                <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <h1 className="text-2xl font-bold text-green-800 mb-2">
                  ご注文ありがとうございます！
                </h1>
                <p className="text-muted-foreground mb-6">
                  お支払いが正常に完了しました。
                </p>
              </>
            ) : timedOut ? (
              <>
                <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="h-12 w-12 text-blue-600" />
                </div>
                <h1 className="text-2xl font-bold text-blue-800 mb-2">
                  注文を受け付けました
                </h1>
                <p className="text-muted-foreground mb-4">
                  決済の確認に時間がかかっています。カード会社での処理が完了次第、注文ステータスが更新されます。
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  注文履歴ページで最新のステータスをご確認いただけます。
                </p>
              </>
            ) : (
              <>
                <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Loader2 className="h-12 w-12 text-yellow-600 animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-yellow-800 mb-2">
                  決済を確認中です...
                </h1>
                <p className="text-muted-foreground mb-6">
                  決済の確認に少しお時間がかかる場合があります。
                </p>
              </>
            )}

            {orderNumber && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-1">注文番号</p>
                <p className="text-lg font-mono font-bold text-gray-800">{orderNumber}</p>
                {orderStatus && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      お支払い金額: <span className="font-bold text-pink-600">¥{orderStatus.totalAmount.toLocaleString()}</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Link href="/mypage">
                <Button className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600">
                  <Package className="h-4 w-4 mr-2" />
                  注文履歴を確認する
                </Button>
              </Link>
              <Link href="/mall/products">
                <Button variant="outline" className="w-full">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  お買い物を続ける
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  トップページに戻る
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
