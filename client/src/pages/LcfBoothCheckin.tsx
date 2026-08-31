import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, LogIn, MapPin, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const EVENT_SLOTS: Record<string, string[]> = {
  "2026-09-08": ["13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "17:00-18:00"],
  "2026-09-09": ["11:00-12:00", "12:00-13:00", "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "17:00-18:00", "18:00-19:00"],
};

export default function LcfBoothCheckin() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const boothId = params.get("booth") || "";
  const rawToken = params.get("token") || "";
  const [token, embeddedTestToken = ""] = rawToken.split(".", 2);
  const testToken = params.get("test") || embeddedTestToken;
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; timeSlot: string } | null>(null);
  const [checkinResult, setCheckinResult] = useState<any>(null);

  const meQuery = trpc.festivalAuth.me.useQuery();
  const enabled = Boolean(boothId && token && meQuery.data?.accountType === "liver");
  const contextQuery = trpc.boothReservation.getBoothQrContext.useQuery(
    { boothId: boothId as any, token, testToken: testToken || undefined },
    { enabled, refetchInterval: 15_000, retry: false },
  );
  const availabilityQuery = trpc.boothReservation.getAllAvailability.useQuery(undefined, {
    enabled,
    refetchInterval: 15_000,
  });

  const createMutation = trpc.boothReservation.createReservation.useMutation({
    onSuccess: async () => {
      setSelectedSlot(null);
      await Promise.all([contextQuery.refetch(), availabilityQuery.refetch()]);
      alert("当日枠を予約しました。続けてチェックインしてください。");
    },
    onError: (error) => alert(error.message),
  });
  const checkinMutation = trpc.boothReservation.performCheckin.useMutation({
    onSuccess: async (result) => {
      setCheckinResult(result);
      await contextQuery.refetch();
    },
    onError: (error) => alert(error.message),
  });

  const sameDayOpenSlots = useMemo(() => {
    const windows = testToken
      ? contextQuery.data?.bookingWindows || {}
      : availabilityQuery.data?.bookingWindows || {};
    const reserved = testToken
      ? contextQuery.data?.reservedForBooth || {}
      : availabilityQuery.data?.reserved || {};
    const options: Array<{ date: string; timeSlot: string }> = [];
    for (const [date, slots] of Object.entries(EVENT_SLOTS)) {
      for (const timeSlot of slots) {
        const windowInfo = windows[`${date}_${timeSlot}`] as any;
        if (windowInfo?.mode !== "same_day") continue;
        if (reserved[`${date}_${boothId}_${timeSlot}`]) continue;
        options.push({ date, timeSlot });
      }
    }
    return options;
  }, [availabilityQuery.data, boothId, contextQuery.data, testToken]);

  if (meQuery.isLoading) {
    return <PageShell><p className="text-sm text-gray-400">読み込み中...</p></PageShell>;
  }

  if (!boothId || !token) {
    return (
      <PageShell>
        <h1 className="text-2xl font-light text-white">無効なQRコードです</h1>
        <p className="mt-3 text-sm text-gray-400">ブース前に設置されたQRコードをもう一度読み取ってください。</p>
      </PageShell>
    );
  }

  if (!meQuery.data) {
    return (
      <PageShell>
        <LogIn className="mx-auto h-10 w-10 text-amber-300" />
        <h1 className="mt-4 text-2xl font-light text-white">ログインが必要です</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">LCFライバーアカウントでログインした後、このブースのQRコードをもう一度読み取ってください。</p>
        <a href="/lcf/login" className="mt-6 inline-block rounded px-8 py-3 text-sm font-medium" style={{ background: "#C9A96E", color: "#0a0a0a" }}>ログインする</a>
      </PageShell>
    );
  }

  if (meQuery.data.accountType !== "liver") {
    return (
      <PageShell>
        <ShieldCheck className="mx-auto h-10 w-10 text-amber-300" />
        <h1 className="mt-4 text-2xl font-light text-white">ライバー参加者限定です</h1>
        <p className="mt-3 text-sm text-gray-400">LIVE配信ブースの予約とチェックインは、ライバー申込アカウントのみ利用できます。</p>
      </PageShell>
    );
  }

  if (contextQuery.isError) {
    return (
      <PageShell>
        <h1 className="text-2xl font-light text-white">QRコードを確認できません</h1>
        <p className="mt-3 text-sm text-red-300">{contextQuery.error.message}</p>
        <p className="mt-2 text-xs text-gray-500">対象ブース前の最新QRコードを読み取ってください。</p>
      </PageShell>
    );
  }

  const reservation = contextQuery.data?.checkinReservation;

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "linear-gradient(145deg, #080808, #171717)", color: "white" }}>
      <div className="mx-auto max-w-lg space-y-5">
        <div className="text-center">
          <p className="text-xs tracking-[0.3em]" style={{ color: "#C9A96E" }}>LCF 2026 LIVE STREAMING</p>
          <h1 className="mt-3 text-3xl font-light">ブース {boothId}</h1>
          <p className="mt-2 text-sm text-gray-400">セルフチェックイン・当日枠予約</p>
          {contextQuery.data?.testMode && (
            <p className="mt-2 text-xs font-medium text-amber-300">管理者承認済みテストモード</p>
          )}
        </div>

        {checkinResult ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h2 className="mt-3 text-xl font-bold text-emerald-300">チェックイン完了</h2>
            <p className="mt-2 text-sm text-gray-300">{checkinResult.date?.slice(5)}　{checkinResult.timeSlot}　ブース {checkinResult.boothId}</p>
            <p className="mt-3 text-xs text-gray-400">準備・配信・撤収を含め、終了時刻までに完全撤収してください。</p>
          </div>
        ) : reservation ? (
          <div className="rounded-xl border p-6" style={{ borderColor: "#C9A96E", background: "rgba(201,169,110,0.07)" }}>
            <div className="flex items-center gap-3">
              <MapPin className="h-6 w-6 text-amber-300" />
              <div>
                <p className="text-xs text-gray-400">チェックイン対象</p>
                <p className="text-lg text-white">{reservation.date?.slice(5)}　{reservation.timeSlot}</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-gray-400">開始15分後までにチェックインがない場合、この予約と以後の事前予約は自動的に無効になります。</p>
            <button
              onClick={() => checkinMutation.mutate({ boothId: boothId as any, token, testToken: testToken || undefined })}
              disabled={checkinMutation.isPending || reservation.status === "checked_in"}
              className="mt-5 w-full rounded py-3 text-sm font-bold disabled:opacity-50"
              style={{ background: "#C9A96E", color: "#0a0a0a" }}
            >
              {reservation.status === "checked_in" ? "チェックイン済み" : checkinMutation.isPending ? "チェックイン中..." : "このブースにチェックインする"}
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
            <Clock3 className="mx-auto h-9 w-9 text-gray-400" />
            <h2 className="mt-3 text-lg font-medium">現在チェックインできる予約はありません</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">チェックインは予約時間の15分前から可能です。予約したブース番号と時刻をご確認ください。</p>
          </div>
        )}

        {!reservation && sameDayOpenSlots.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-medium">ブース {boothId} の当日空き枠</h2>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">各時間帯の開始15分前から予約できます。当日枠は事前予約2枠に含まれませんが、連続利用はできません。</p>
            <div className="mt-4 space-y-2">
              {sameDayOpenSlots.map((slot) => {
                const selected = selectedSlot?.date === slot.date && selectedSlot?.timeSlot === slot.timeSlot;
                return (
                  <button
                    key={`${slot.date}_${slot.timeSlot}`}
                    onClick={() => setSelectedSlot(slot)}
                    className="w-full rounded border px-4 py-3 text-left text-sm transition-colors"
                    style={{ borderColor: selected ? "#C9A96E" : "#333", background: selected ? "rgba(201,169,110,0.12)" : "transparent", color: selected ? "#E7D2A8" : "#d1d5db" }}
                  >
                    {slot.date.slice(5)}　{slot.timeSlot}
                  </button>
                );
              })}
            </div>
            {selectedSlot && (
              <button
                onClick={() => createMutation.mutate({
                  boothId: boothId as any,
                  date: selectedSlot.date as any,
                  timeSlot: selectedSlot.timeSlot,
                  boothQrToken: token,
                  testToken: testToken || undefined,
                })}
                disabled={createMutation.isPending}
                className="mt-4 w-full rounded py-3 text-sm font-bold disabled:opacity-50"
                style={{ background: "#C9A96E", color: "#0a0a0a" }}
              >
                {createMutation.isPending ? "予約中..." : "この当日枠を予約する"}
              </button>
            )}
          </div>
        )}

        <div className="rounded-lg bg-black/30 p-4 text-xs leading-relaxed text-gray-400">
          <p>ブースには電源、充電器、照明、三脚、配信機材の用意はありません。</p>
          <p className="mt-1">終了時刻になりましたら、次の方のために速やかに完全撤収してください。</p>
        </div>

        <a href="/lcf/mypage" className="block py-3 text-center text-sm text-gray-400 hover:text-white">マイページへ戻る</a>
      </div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center" style={{ background: "#0a0a0a" }}>
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-8">{children}</div>
    </div>
  );
}
