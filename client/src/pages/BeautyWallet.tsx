import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import haptic from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Info,
  Link2,
  Loader2,
  LockKeyhole,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const BEAUTY_WALLET_REGISTER_URL = "https://www.beautypass.ai/register";
const BEAUTY_WALLET_URL = "https://www.beautypass.ai/wallet";

export default function BeautyWallet() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");

  const { data: user, isLoading: userLoading } = trpc.lineLogin.me.useQuery();
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user?.email, email]);

  const { data: localPoints } = trpc.lineLogin.getMyPoints.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const {
    data: linkStatus,
    isLoading: linkLoading,
    error: linkError,
  } = trpc.beautyWalletMember.status.useQuery(undefined, {
    enabled: Boolean(user),
  });
  const {
    data: ledger,
    isLoading: ledgerLoading,
    refetch: refetchLedger,
  } = trpc.beautyWalletMember.centralLedger.useQuery(undefined, {
    enabled: Boolean(user && linkStatus?.linked),
    staleTime: 60_000,
  });

  const requestCode = trpc.beautyWalletMember.requestLinkCode.useMutation({
    onSuccess: result => {
      haptic.doubleTap();
      setChallengeToken(result.challengeToken);
      setMaskedEmail(result.maskedEmail);
      setCode("");
      toast.success("確認コードを送信しました");
    },
    onError: error => toast.error(error.message),
  });

  const confirmLink = trpc.beautyWalletMember.confirmLink.useMutation({
    onSuccess: async result => {
      haptic.celebration();
      setChallengeToken("");
      setCode("");
      await Promise.all([
        utils.beautyWalletMember.status.invalidate(),
        utils.beautyWalletMember.centralLedger.invalidate(),
      ]);
      toast.success("Beauty Walletと安全に連携しました", {
        description:
          result.unifiedTotal === null
            ? "残高はBeauty Walletで確認できます"
            : `統合残高 ${result.unifiedTotal.toLocaleString()} pt`,
      });
    },
    onError: error => toast.error(error.message),
  });

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-violet-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-violet-600" />
            <h2 className="text-xl font-bold mb-2">ログインが必要です</h2>
            <p className="text-muted-foreground mb-4">
              Beauty Wallet連携にはLCJ MALLへのログインが必要です
            </p>
            <Button
              onClick={() => setLocation("/line-login")}
              className="bg-violet-600 hover:bg-violet-700"
            >
              ログインする
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const centralBalance = ledger?.centralLedgerAvailable
    ? ledger.unifiedTotal
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b">
        <div className="container max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLocation("/mypage")}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="マイページに戻る"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gradient-to-br from-violet-600 to-fuchsia-500 rounded-lg flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Beauty Wallet</h1>
              <p className="text-[11px] text-muted-foreground">
                すべてのポイントの唯一のリアルタイム主台帳
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-6 space-y-6">
        <Card className="border-violet-200 bg-gradient-to-br from-violet-700 to-fuchsia-600 text-white shadow-xl overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-violet-100 text-sm font-medium">
              <ShieldCheck className="h-4 w-4" />
              Beauty Wallet 統合残高
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              {linkStatus?.linked && ledgerLoading ? (
                <Loader2 className="h-9 w-9 animate-spin" />
              ) : centralBalance !== null && centralBalance !== undefined ? (
                <>
                  <span className="text-5xl font-bold tracking-tight">
                    {centralBalance.toLocaleString()}
                  </span>
                  <span className="text-lg font-semibold">pt</span>
                </>
              ) : (
                <span className="text-2xl font-bold">
                  {linkStatus?.linked ? "確認できません" : "未連携"}
                </span>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-violet-100">
              ブランド別・LINE・メールの表示を合算するのではなく、Beauty
              Walletの統合残高だけを正式残高として表示します。
            </p>
          </CardContent>
        </Card>

        <Card className="border-violet-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-violet-800">
              <Link2 className="h-5 w-5" />
              アカウント連携
            </CardTitle>
            <CardDescription>
              ご本人のメール確認後、同じメールのBeauty
              Walletを安全に連携します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
              </div>
            ) : linkError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                連携状態を確認できません。再読み込みしてお試しください。
              </div>
            ) : linkStatus?.linked ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-emerald-800">連携済み</p>
                    {linkStatus.displayName && (
                      <p className="text-sm text-emerald-800 truncate">
                        {linkStatus.displayName}
                      </p>
                    )}
                    <p className="text-xs text-emerald-700 truncate">
                      {linkStatus.maskedEmail}
                    </p>
                  </div>
                </div>
                {ledger && !ledger.centralLedgerAvailable && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Beauty
                    Walletの履歴を完全照合できなかったため、残高は表示していません。ポイントは変更されていません。
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => refetchLedger()}
                    disabled={ledgerLoading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${ledgerLoading ? "animate-spin" : ""}`}
                    />
                    残高を再確認
                  </Button>
                  <Button
                    className="bg-violet-600 hover:bg-violet-700 gap-2"
                    onClick={() =>
                      window.open(
                        BEAUTY_WALLET_URL,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                    Walletを開く
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  誤連携防止のため、ご本人による連携解除・別アカウントへの変更はサポート確認が必要です。
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex items-start gap-3">
                    <LockKeyhole className="h-5 w-5 text-violet-700 mt-0.5" />
                    <div>
                      <p className="font-bold text-violet-900">
                        安全な本人確認
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-violet-800">
                        Beauty
                        Walletに登録したメールアドレスへ6桁コードを送ります。メールアドレスだけでは連携されません。
                      </p>
                    </div>
                  </div>
                </div>

                {!challengeToken ? (
                  <>
                    <div className="space-y-2">
                      <label
                        htmlFor="bw-link-email"
                        className="text-sm font-medium"
                      >
                        Beauty Walletのメールアドレス
                      </label>
                      <Input
                        id="bw-link-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        value={email}
                        onChange={event => setEmail(event.target.value)}
                        placeholder="name@example.com"
                      />
                    </div>
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                      disabled={!email.trim() || requestCode.isPending}
                      onClick={() =>
                        requestCode.mutate({ email: email.trim() })
                      }
                    >
                      {requestCode.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MailCheck className="h-4 w-4" />
                      )}
                      確認コードを送る
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>{maskedEmail}</strong>{" "}
                      に送信した6桁コードを入力してください。
                    </p>
                    <div className="space-y-2">
                      <label
                        htmlFor="bw-link-code"
                        className="text-sm font-medium"
                      >
                        確認コード
                      </label>
                      <Input
                        id="bw-link-code"
                        value={code}
                        onChange={event =>
                          setCode(
                            event.target.value.replace(/\D/g, "").slice(0, 6)
                          )
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        className="text-center text-2xl tracking-[0.35em]"
                      />
                    </div>
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700 gap-2"
                      disabled={code.length !== 6 || confirmLink.isPending}
                      onClick={() =>
                        confirmLink.mutate({ challengeToken, code })
                      }
                    >
                      {confirmLink.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      本人確認して連携する
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => {
                        setChallengeToken("");
                        setCode("");
                      }}
                    >
                      メールアドレスを変更する
                    </Button>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Beauty Walletをまだお持ちでない方
                  </p>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() =>
                      window.open(
                        BEAUTY_WALLET_REGISTER_URL,
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                    Beauty Walletを新規登録
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-slate-600 mt-0.5" />
              <div className="space-y-2">
                <h2 className="font-bold text-sm">LCJ旧ポイント記録について</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  現在のLCJ側参考残高は
                  <strong className="mx-1 text-slate-800">
                    {(localPoints?.balance ?? 0).toLocaleString()} pt
                  </strong>
                  です。これは監査・移行確認用の参考記録で、Beauty
                  Wallet残高へ自動加算しません。
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  過去に移行済みのポイントを二重加算しないため、差額は履歴を照合してから反映します。
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
