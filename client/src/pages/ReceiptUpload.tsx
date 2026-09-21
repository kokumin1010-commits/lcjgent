import { ArrowLeft, History, ShieldCheck, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReceiptUpload() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-sky-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Button variant="ghost" onClick={() => setLocation("/mypage")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          マイページへ戻る
        </Button>

        <Card className="overflow-hidden border-sky-100 shadow-xl shadow-sky-100/60">
          <CardHeader className="bg-slate-950 text-white">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle>新規ポイント申請は現在停止中です</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <p className="text-sm leading-6 text-slate-600">
              Beauty Walletを唯一のリアルタイム主台帳へ移行しています。二重付与を防ぐため、LCJ側でのレシートポイント付与・抽選は行いません。
            </p>

            <div className="flex gap-3 rounded-2xl bg-sky-50 p-4 text-sky-900">
              <History className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">
                これまでのレシート申請とポイント履歴は削除せず、マイページで照合用の監査記録として確認できます。
              </p>
            </div>

            <Button
              onClick={() => setLocation("/beauty-wallet")}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white"
            >
              <WalletCards className="mr-2 h-4 w-4" />
              Beauty Walletを確認・連携
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
