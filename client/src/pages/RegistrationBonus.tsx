import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, History, ShieldCheck, WalletCards } from "lucide-react";

export default function RegistrationBonus() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fromRegistration = sessionStorage.getItem("lcj_from_registration");
    if (!fromRegistration) {
      setLocation("/");
    }
  }, [setLocation]);

  const finishRegistration = (destination: string) => {
    sessionStorage.removeItem("lcj_from_registration");
    setLocation(destination);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-amber-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-xl shadow-rose-100/60 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-200">
              <WalletCards className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-500">
                Registration complete
              </p>
              <h1 className="text-xl font-black text-slate-900">会員登録が完了しました</h1>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950 px-5 py-6 text-white">
            <p className="text-sm font-bold text-amber-300">公式ポイント残高</p>
            <h2 className="mt-1 text-2xl font-black">Beauty Walletで一元管理</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              LCJのポイントはBeauty Walletを唯一のリアルタイム主台帳として表示します。メール認証で安全に連携すると、統合残高と履歴を確認できます。
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex gap-3 rounded-2xl border border-slate-100 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold text-slate-900">本人確認後に連携</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  ログイン中の会員情報とメール認証コードを使います。会員番号の入力は不要です。
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-slate-100 p-4">
              <History className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="font-bold text-slate-900">旧LCJ記録は照合用</p>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  過去のLINE・メール側記録は自動合算・自動移行せず、監査用の参考履歴として保持します。
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => finishRegistration("/beauty-wallet")}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-pink-200 transition hover:brightness-105 active:scale-[0.99]"
          >
            Beauty Walletを確認・連携
            <ArrowRight className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => finishRegistration("/mypage")}
            className="mt-3 w-full rounded-2xl px-5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            あとでマイページから連携する
          </button>

          <p className="mt-5 text-center text-xs leading-5 text-slate-400">
            現在、LCJ側で新たなポイント付与・利用は行いません。
            Beauty Walletの残高が公式残高です。
          </p>
        </div>
      </div>
    </div>
  );
}
