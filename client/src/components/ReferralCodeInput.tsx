import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Gift, Sparkles, CheckCircle, Loader2, PartyPopper } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface ReferralCodeInputProps {
  /** コンパクト表示（マイページ内埋め込み用） */
  compact?: boolean;
  /** 適用成功時のコールバック */
  onSuccess?: () => void;
}

export default function ReferralCodeInput({ compact = false, onSuccess }: ReferralCodeInputProps) {
  const [code, setCode] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [successData, setSuccessData] = useState<{ points: number; liverName: string } | null>(null);

  // 紹介コード使用済みチェック
  const { data: referralStatus, refetch: refetchStatus } = trpc.lineLogin.checkReferralUsed.useQuery();

  // 紹介コード検証（4桁入力時に自動検証）
  const { data: verifyResult, isFetching: isVerifying } = trpc.lineLogin.verifyReferralCode.useQuery(
    { code },
    { enabled: code.length === 4 }
  );

  // 紹介コード適用
  const applyMutation = trpc.lineLogin.applyReferralCode.useMutation({
    onSuccess: (data) => {
      setSuccessData({ points: data.newUserPoints, liverName: data.liverName || "" });
      setShowSuccessDialog(true);
      setCode("");
      refetchStatus();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "紹介コードの適用に失敗しました");
    },
  });

  const handleCodeChange = useCallback((value: string) => {
    // 数字のみ、4桁まで
    const cleaned = value.replace(/\D/g, "").slice(0, 4);
    setCode(cleaned);
  }, []);

  const handleApply = useCallback(() => {
    if (code.length !== 4 || !verifyResult?.valid) return;
    applyMutation.mutate({ code });
  }, [code, verifyResult, applyMutation]);

  // 既に使用済みの場合は非表示
  if (referralStatus?.used) {
    return null;
  }

  // 未ログインの場合はログイン促進
  if (referralStatus && !referralStatus.loggedIn) {
    if (compact) return null;
    return (
      <Card className="border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardContent className="p-4 text-center">
          <Gift className="h-8 w-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-amber-800">
            紹介コードをお持ちですか？
          </p>
          <p className="text-xs text-amber-600 mt-1">
            ログインすると紹介コードを入力して<strong>500ポイント</strong>もらえます
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`border-2 ${compact ? 'border-purple-200' : 'border-purple-300'} bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 overflow-hidden`}>
        <CardContent className={compact ? "p-4" : "p-5"}>
          {/* ヘッダー */}
          <div className="flex items-center gap-3 mb-3">
            <div className={`${compact ? 'h-9 w-9' : 'h-10 w-10'} bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg`}>
              <Gift className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
            </div>
            <div>
              <h3 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-purple-800`}>
                紹介コードで500pt GET!
              </h3>
              <p className="text-xs text-purple-600">
                ライバーの紹介コードを入力してポイントをもらおう
              </p>
            </div>
          </div>

          {/* コード入力エリア */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="4桁の数字を入力"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="text-center text-2xl font-mono font-bold tracking-[0.3em] h-12 border-2 border-purple-200 focus:border-purple-500 bg-white"
              />
              {isVerifying && code.length === 4 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                </div>
              )}
            </div>
            <Button
              onClick={handleApply}
              disabled={code.length !== 4 || !verifyResult?.valid || applyMutation.isPending}
              className="h-12 px-5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold shadow-lg"
            >
              {applyMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* 検証結果表示 */}
          {code.length === 4 && verifyResult && (
            <div className={`mt-3 rounded-lg p-3 ${verifyResult.valid ? 'bg-white/80 border border-purple-200' : 'bg-red-50 border border-red-200'}`}>
              {verifyResult.valid ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 border-2 border-purple-300">
                    <AvatarImage src={verifyResult.liverAvatarUrl || undefined} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                      {verifyResult.liverName?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-800">
                      <strong>{verifyResult.liverName}</strong> さんの紹介コード
                    </p>
                    <p className="text-xs text-purple-600">
                      適用すると <strong className="text-pink-600">500ポイント</strong> もらえます！
                    </p>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                </div>
              ) : (
                <p className="text-sm text-red-600 text-center">
                  {verifyResult.message || "無効なコードです"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 成功ダイアログ */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3">
              <div className="h-16 w-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-bounce">
                <PartyPopper className="h-8 w-8 text-white" />
              </div>
              <span className="text-xl">ポイント獲得！</span>
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4">
                <p className="text-3xl font-bold text-purple-700">
                  +{successData?.points?.toLocaleString()} pt
                </p>
              </div>
              {successData?.liverName && (
                <p className="text-sm text-muted-foreground">
                  <strong>{successData.liverName}</strong> さんの紹介で獲得しました
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                ポイントはLCJ MALLでのお買い物にご利用いただけます
              </p>
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setShowSuccessDialog(false)}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            OK
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
