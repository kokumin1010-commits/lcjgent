import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function ChatRegister() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    sessionStorage.removeItem("lcj_from_roulette");
    localStorage.removeItem("lcj_spin_referral_code");
    localStorage.removeItem("lcj_spin_won_points");
    localStorage.removeItem("lcj_spin_won_label");
    setLocation("/line-login");
  }, [setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-rose-50 to-white">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-rose-500" />
        <p className="mt-3 text-sm text-slate-500">安全なログイン画面へ移動しています</p>
      </div>
    </div>
  );
}
