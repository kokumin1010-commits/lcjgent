import { ArrowLeft, ShieldCheck, WalletCards } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FriendReferralChallenge() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50 px-4 py-10">
      <div className="mx-auto max-w-md">
        <Button variant="ghost" onClick={() => setLocation("/mypage")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          マイページへ戻る
        </Button>

        <Card className="overflow-hidden border-rose-100 shadow-xl shadow-rose-100/60">
          <CardHeader className="bg-slate-950 text-white">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500">
              <WalletCards className="h-6 w-6" />
            </div>
            <CardTitle>友達紹介ポイントは現在停止中です</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="flex gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">
                Beauty Walletを唯一のリアルタイム主台帳へ移行しています。二重付与を防ぐため、LCJ側の抽選・友達紹介による新規ポイント付与は行いません。
              </p>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              過去の紹介・ポイント記録は照合用として保持されます。自動合算や自動移行は行われません。
            </p>

            <Button
              onClick={() => setLocation("/beauty-wallet")}
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white"
            >
              Beauty Walletを確認・連携
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
