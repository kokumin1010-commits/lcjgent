import { ArrowLeft, History, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PointRequest() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-sky-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link href="/mypage">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            マイページへ戻る
          </Button>
        </Link>

        <Card className="overflow-hidden border-pink-100 shadow-xl shadow-pink-100/60">
          <CardHeader className="bg-slate-950 text-white">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle>新規LCJポイント申請は停止中です</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <p className="text-sm leading-6 text-slate-600">
              Beauty Walletを唯一のリアルタイム主台帳へ移行しています。二重付与を防ぐため、この画面から新しいLCJポイント申請は受け付けていません。
            </p>

            <div className="flex gap-3 rounded-2xl bg-sky-50 p-4 text-sky-900">
              <History className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">
                既存のLCJ申請・残高・取引履歴は削除せず、監査と照合のための過去記録として保持します。自動合算や自動移行は行いません。
              </p>
            </div>

            <Link href="/beauty-wallet">
              <Button className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white">
                <WalletCards className="mr-2 h-4 w-4" />
                Beauty Walletを確認・連携
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
