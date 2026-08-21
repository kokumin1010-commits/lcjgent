/**
 * CREATOR LIVE BOOTH Reservation Page
 * Premium luxury design: ivory white / black / champagne gold
 * 8 sections: Hero, Experience, Map, Reservation, Info Form, Confirmation, Success, FAQ
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";

const FLOOR_PLAN_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/dIlcmnBnxsCykIYd.png";
const RENDER_3D_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663320462236/zDJuEiEtpmhBNkUi.png";

const BOOTHS = ["T1","T2","T3","T4","T13","T14","T15","T16","T17","T18","T19","T20","T21","T22","T23","T24"];
const DATES = [
  { value: "2026-09-08", label: "09.08", day: "MON", full: "2026年9月8日" },
  { value: "2026-09-09", label: "09.09", day: "TUE", full: "2026年9月9日" },
];
const TIME_SLOTS_MAP: Record<string, string[]> = {
  "2026-09-08": ["13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00","17:00-18:00"],
  "2026-09-09": ["11:00-12:00","12:00-13:00","13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00","17:00-18:00","18:00-19:00"],
};

type Step = "browse" | "select" | "confirm" | "success";

export default function LcfBoothReservation() {
  const { data: me, isLoading: meLoading } = trpc.festivalAuth.me.useQuery();
  const myReservationsQuery = trpc.boothReservation.getMyReservations.useQuery(
    { email: me?.email || "" },
    { enabled: !!me?.email }
  );
  const myReservations = myReservationsQuery.data || [];

  // Redirect to login if not authenticated
  if (!meLoading && !me) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <div className="text-center p-8 max-w-md">
          <p className="text-xs tracking-[0.3em] mb-4" style={{ color: "#C9A96E" }}>CREATOR LIVE BOOTH</p>
          <h2 className="text-2xl text-white font-light mb-4">ログインが必要です</h2>
          <p className="text-sm text-gray-400 mb-8">LIVE BOOTHの予約にはLCFアカウントが必要です。</p>
          <a href="/lcf/login" className="inline-block px-8 py-3 text-sm tracking-wider transition-all hover:opacity-90" style={{ background: "#C9A96E", color: "#0a0a0a" }}>
            ログインする →
          </a>
          <p className="text-xs text-gray-500 mt-4">アカウントをお持ちでない方は、まず<a href="/livecommercefestival/2026/apply/liver" className="underline" style={{ color: "#C9A96E" }}>ライバー申し込み</a>からご登録ください。</p>
        </div>
      </div>
    );
  }

  if (meLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  const [step, setStep] = useState<Step>("browse");
  const [selectedDate, setSelectedDate] = useState(DATES[0].value);
  const [selectedBooth, setSelectedBooth] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [plannedProduct, setPlannedProduct] = useState("");
  const [reservationResult, setReservationResult] = useState<any>(null);

  const availabilityQuery = trpc.boothReservation.getAllAvailability.useQuery();
  const createMut = trpc.boothReservation.createReservation.useMutation({
    onSuccess: (data) => {
      setReservationResult(data);
      setStep("success");
    },
    onError: (err) => {
      alert(err.message);
    },
  });

  const reserved = availabilityQuery.data?.reserved || {};
  const dateInfo = DATES.find(d => d.value === selectedDate) || DATES[0];

  const handleSlotClick = (booth: string, time: string) => {
    const key = `${selectedDate}_${booth}_${time}`;
    if (reserved[key]) return;
    setSelectedBooth(booth);
    setSelectedTime(time);
    setStep("select");
    // Scroll to reservation summary
    setTimeout(() => {
      document.getElementById("reservation-summary")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSubmit = () => {
    if (!selectedBooth || !selectedTime || !me) return;
    createMut.mutate({
      boothId: selectedBooth,
      date: selectedDate,
      timeSlot: selectedTime,
      creatorName: me.displayName,
      tiktokId: undefined,
      email: me.email,
      phone: undefined,
      plannedProduct: plannedProduct || undefined,
    });
  };

  const resetAll = () => {
    setStep("browse");
    setSelectedBooth(null);
    setSelectedTime(null);
    setPlannedProduct("");
    setReservationResult(null);
    availabilityQuery.refetch();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF7", color: "#1a1a1a" }}>
      {/* ===== SECTION 01: HERO ===== */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)" }}>
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs tracking-[0.3em] mb-4" style={{ color: "#C9A96E" }}>CREATOR LIVE BOOTH RESERVATION</p>
            <h1 className="text-4xl md:text-5xl font-light text-white leading-tight mb-4" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              会場から、<br />そのまま<span style={{ color: "#C9A96E" }}>LIVE</span>。
            </h1>
            <p className="text-lg text-gray-300 mb-2">LIVE配信ブース 事前予約受付中</p>
            <p className="text-sm text-gray-400 leading-relaxed mb-8 max-w-md">
              9月8日・9日、八芳園「LIVE COMMERCE FESTIVAL 2026」会場内に、クリエイター向けLIVE配信ブースをご用意しています。
              ご希望のブースと時間帯を事前に予約し、会場からライブ配信をお楽しみいただけます。
            </p>
            <a href="#reservation" className="inline-block px-8 py-3 text-sm tracking-wider border transition-all hover:scale-105" style={{ borderColor: "#C9A96E", color: "#C9A96E" }}>
              LIVE配信ブースを予約する →
            </a>
            <div className="grid grid-cols-3 gap-6 mt-12">
              <div>
                <p className="text-2xl font-light text-white">16</p>
                <p className="text-[10px] tracking-[0.2em] text-gray-400 mt-1">LIVE BOOTHS</p>
                <p className="text-[10px] text-gray-500">T1–T4 / T13–T24</p>
              </div>
              <div>
                <p className="text-2xl font-light text-white">2</p>
                <p className="text-[10px] tracking-[0.2em] text-gray-400 mt-1">DAYS</p>
                <p className="text-[10px] text-gray-500">SEP.08 — SEP.09</p>
              </div>
              <div>
                <p className="text-2xl font-light text-white">事前</p>
                <p className="text-[10px] tracking-[0.2em] text-gray-400 mt-1">ADVANCE BOOKING</p>
                <p className="text-[10px] text-gray-500">事前予約制</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <img src={RENDER_3D_URL} alt="LIVE BOOTH 3D" className="w-full rounded-lg shadow-2xl" />
            <div className="absolute -bottom-4 -right-4 w-24 h-24 border opacity-20" style={{ borderColor: "#C9A96E" }} />
          </div>
        </div>
      </section>

      {/* ===== SECTION 02: EXPERIENCE ===== */}
      <section className="py-20 px-6" style={{ background: "#FAFAF7" }}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs tracking-[0.3em] mb-3" style={{ color: "#C9A96E" }}>LIVE FROM THE FESTIVAL</p>
          <h2 className="text-2xl md:text-3xl font-light mb-4" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            イベントの熱気を、そのまま配信へ。
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto mb-12">
            ブランド、クリエイター、ライブコマース関係者が集まる会場からリアルタイム配信。
            通常の配信とは違う、イベント会場ならではの特別なコンテンツづくりにご活用いただけます。
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "会場LIVE", desc: "イベント会場からリアルタイム配信", icon: "📡" },
              { title: "ブランドとの接点", desc: "気になる商品・ブランドとの出会い", icon: "🤝" },
              { title: "限定コンテンツ", desc: "会場ならではの撮影・配信体験", icon: "✨" },
            ].map((item, i) => (
              <div key={i} className="p-8 bg-white rounded-lg shadow-sm border border-gray-100">
                <p className="text-3xl mb-4">{item.icon}</p>
                <h3 className="text-base font-medium mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SECTION 03: BOOTH MAP ===== */}
      <section className="py-20 px-6" style={{ background: "#f5f5f0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs tracking-[0.3em] mb-3" style={{ color: "#C9A96E" }}>LIVE BOOTH MAP</p>
            <h2 className="text-2xl md:text-3xl font-light" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              ライブ配信ブースを選ぶ
            </h2>
            <p className="text-sm text-gray-500 mt-3">八芳園5F LIVE AREA内、T1–T4・T13–T24が予約対象ブースです。</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 items-start">
            <div className="md:col-span-2 bg-white p-4 rounded-lg shadow-sm">
              <img src={FLOOR_PLAN_URL} alt="5F Floor Plan" className="w-full rounded" />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <p className="text-xs tracking-[0.2em] text-gray-400 mb-2">LIVE STREAMING AREA</p>
              <div className="border-t pt-4 mt-2" style={{ borderColor: "#C9A96E" }}>
                <p className="text-sm font-medium mb-1">T1–T4</p>
                <p className="text-sm font-medium mb-3">T13–T24</p>
                <p className="text-2xl font-light mb-1">全16ブース</p>
                <p className="text-xs text-gray-400">八芳園 5F</p>
              </div>
              <div className="mt-6 flex gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#4A90D9" }} />
                  <span className="text-xs text-gray-500">LIVE AREA</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: "#9B7DB8" }} />
                  <span className="text-xs text-gray-500">VIP</span>
                </div>
              </div>
              <a href="#reservation" className="block mt-6 text-center py-2.5 text-sm tracking-wider border transition-all hover:opacity-80" style={{ borderColor: "#C9A96E", color: "#C9A96E" }}>
                空き状況を見る →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 04: RESERVATION ===== */}
      <section id="reservation" className="py-20 px-6" style={{ background: "#0a0a0a" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs tracking-[0.3em] mb-3" style={{ color: "#C9A96E" }}>RESERVATION</p>
            <h2 className="text-2xl md:text-3xl font-light text-white" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              日時とブースを選択
            </h2>
          </div>

          {/* Date Tabs */}
          <div className="flex justify-center gap-4 mb-8">
            {DATES.map(d => (
              <button
                key={d.value}
                onClick={() => { setSelectedDate(d.value); setSelectedBooth(null); setSelectedTime(null); setStep("browse"); }}
                className="px-8 py-4 border transition-all text-center min-w-[140px]"
                style={{
                  borderColor: selectedDate === d.value ? "#C9A96E" : "#333",
                  background: selectedDate === d.value ? "rgba(201,169,110,0.1)" : "transparent",
                  color: selectedDate === d.value ? "#C9A96E" : "#888",
                }}
              >
                <p className="text-2xl font-light">{d.label}</p>
                <p className="text-xs tracking-wider mt-1">{d.day}</p>
              </button>
            ))}
          </div>

          {/* Availability Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header Row */}
              <div className="grid gap-0.5" style={{ gridTemplateColumns: `100px repeat(${BOOTHS.length}, 1fr)` }}>
                <div className="p-2 text-xs text-gray-500 text-center">TIME</div>
                {BOOTHS.map(b => (
                  <div key={b} className="p-2 text-xs text-center font-medium" style={{ color: "#C9A96E" }}>{b}</div>
                ))}
              </div>
              {/* Time Rows */}
              {(TIME_SLOTS_MAP[selectedDate] || []).map(time => (
                <div key={time} className="grid gap-0.5" style={{ gridTemplateColumns: `100px repeat(${BOOTHS.length}, 1fr)` }}>
                  <div className="p-2 text-xs text-gray-400 text-center flex items-center justify-center">{time.split("-")[0]}</div>
                  {BOOTHS.map(booth => {
                    const key = `${selectedDate}_${booth}_${time}`;
                    const isReserved = reserved[key];
                    const isSelected = selectedBooth === booth && selectedTime === time;
                    return (
                      <button
                        key={booth}
                        onClick={() => !isReserved && handleSlotClick(booth, time)}
                        disabled={isReserved}
                        className="p-1.5 text-center text-xs border transition-all"
                        style={{
                          borderColor: isSelected ? "#C9A96E" : isReserved ? "#2a2a2a" : "#333",
                          background: isSelected ? "rgba(201,169,110,0.2)" : isReserved ? "#1a1a1a" : "rgba(255,255,255,0.03)",
                          color: isReserved ? "#555" : isSelected ? "#C9A96E" : "#aaa",
                          cursor: isReserved ? "not-allowed" : "pointer",
                        }}
                      >
                        {isReserved ? "×" : isSelected ? "●" : "○"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2"><span className="text-sm text-gray-400">○</span><span className="text-xs text-gray-500">予約可能</span></div>
            <div className="flex items-center gap-2"><span className="text-sm" style={{ color: "#C9A96E" }}>●</span><span className="text-xs text-gray-500">選択中</span></div>
            <div className="flex items-center gap-2"><span className="text-sm text-gray-600">×</span><span className="text-xs text-gray-500">予約済み</span></div>
          </div>

          {/* Selection Summary */}
          {step !== "browse" && selectedBooth && selectedTime && (
            <div id="reservation-summary" className="mt-10 max-w-md mx-auto p-6 border text-center" style={{ borderColor: "#C9A96E", background: "rgba(201,169,110,0.05)" }}>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <p className="text-[10px] tracking-wider text-gray-500">DATE</p>
                  <p className="text-lg font-light text-white mt-1">{dateInfo.label}</p>
                  <p className="text-xs text-gray-400">{dateInfo.day}</p>
                </div>
                <div>
                  <p className="text-[10px] tracking-wider text-gray-500">TIME</p>
                  <p className="text-lg font-light text-white mt-1">{selectedTime.split("-")[0]}</p>
                  <p className="text-xs text-gray-400">{selectedTime}</p>
                </div>
                <div>
                  <p className="text-[10px] tracking-wider text-gray-500">BOOTH</p>
                  <p className="text-lg font-light mt-1" style={{ color: "#C9A96E" }}>{selectedBooth}</p>
                </div>
              </div>
              {step === "select" && (
                <button
                  onClick={() => setStep("confirm")}
                  className="w-full py-3 text-sm tracking-wider transition-all hover:opacity-90"
                  style={{ background: "#C9A96E", color: "#0a0a0a" }}
                >
                  この時間を予約する
                </button>
              )}
            </div>
          )}
        </div>
      </section>



      {/* ===== SECTION 06: CONFIRMATION ===== */}
      {step === "confirm" && (
        <section className="py-20 px-6" style={{ background: "#0a0a0a" }}>
          <div className="max-w-md mx-auto">
            <p className="text-xs tracking-[0.3em] mb-3 text-center" style={{ color: "#C9A96E" }}>BOOKING CONFIRMATION</p>
            <h2 className="text-2xl font-light text-white text-center mb-8" style={{ fontFamily: "'Noto Serif JP', serif" }}>
              予約内容の確認
            </h2>
            <div className="border p-8" style={{ borderColor: "#C9A96E" }}>
              <div className="grid grid-cols-3 gap-6 mb-6 text-center">
                <div>
                  <p className="text-[10px] tracking-wider text-gray-500">DATE</p>
                  <p className="text-xl font-light text-white mt-1">{dateInfo.label}</p>
                </div>
                <div>
                  <p className="text-[10px] tracking-wider text-gray-500">TIME</p>
                  <p className="text-xl font-light text-white mt-1">{selectedTime?.split("-")[0]}</p>
                  <p className="text-xs text-gray-400">{selectedTime}</p>
                </div>
                <div>
                  <p className="text-[10px] tracking-wider text-gray-500">LIVE BOOTH</p>
                  <p className="text-xl font-light mt-1" style={{ color: "#C9A96E" }}>{selectedBooth}</p>
                </div>
              </div>
              <div className="border-t pt-4 space-y-2" style={{ borderColor: "#333" }}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">CREATOR</span>
                  <span className="text-white">{me?.displayName || ""}</span>
                </div>
                {"" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">TikTok</span>
                    <span className="text-white">@{"".replace("@","")}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">EMAIL</span>
                  <span className="text-white">{me?.email || ""}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={createMut.isPending}
              className="w-full mt-6 py-3 text-sm tracking-wider transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#C9A96E", color: "#0a0a0a" }}
            >
              {createMut.isPending ? "処理中..." : "予約を確定する"}
            </button>
            <button onClick={() => setStep("select")} className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
              変更する
            </button>
          </div>
        </section>
      )}

      {/* ===== SECTION 07: SUCCESS ===== */}
      {step === "success" && reservationResult && (
        <section className="py-20 px-6" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)" }}>
          <div className="max-w-md mx-auto">
            <div className="border p-8 text-center" style={{ borderColor: "#C9A96E", background: "rgba(201,169,110,0.03)" }}>
              <p className="text-xs tracking-[0.3em] mb-2" style={{ color: "#C9A96E" }}>LIVE BOOTH RESERVED</p>
              <p className="text-sm text-gray-400 mb-6">YOUR LIVE SESSION</p>
              <div className="border-t border-b py-6 my-4" style={{ borderColor: "#333" }}>
                <p className="text-3xl font-light text-white">{dateInfo.label} <span className="text-lg text-gray-400">{dateInfo.day}</span></p>
                <p className="text-xl text-white mt-2">{selectedTime}</p>
                <p className="text-2xl font-light mt-3" style={{ color: "#C9A96E" }}>BOOTH {selectedBooth}</p>
              </div>
              <p className="text-xs text-gray-400 mt-4 mb-2">RESERVATION ID</p>
              <p className="text-sm text-white font-mono tracking-wider">{reservationResult.reservationId}</p>
              <p className="text-xs text-gray-500 mt-6 leading-relaxed">
                当日は予約時間の10分前までに<br />LIVE AREA受付へお越しください。
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <a href="#map" className="block w-full py-3 text-center text-sm tracking-wider border transition-all hover:opacity-80" style={{ borderColor: "#C9A96E", color: "#C9A96E" }}>
                会場MAPを確認する
              </a>
              <button onClick={resetAll} className="block w-full py-3 text-center text-sm text-gray-400 hover:text-gray-300 transition-colors">
                別の時間帯を予約する
              </button>
              <a href="/lcf/mypage" className="block w-full py-2 text-center text-sm text-gray-500 hover:text-gray-400 transition-colors">
                マイページへ戻る
              </a>
            </div>
          </div>
        </section>
      )}


      {/* ===== MY RESERVATIONS ===== */}
      {myReservations.length > 0 && (
        <section className="py-12 px-6" style={{ background: "#f5f5f0" }}>
          <div className="max-w-2xl mx-auto">
            <p className="text-xs tracking-[0.3em] mb-3 text-center" style={{ color: "#C9A96E" }}>MY RESERVATIONS</p>
            <h2 className="text-xl font-light text-center mb-6" style={{ fontFamily: "'Noto Serif JP', serif" }}>予約済みブース</h2>
            <div className="space-y-3">
              {myReservations.map((r: any) => (
                <div key={r.id} className="bg-white p-4 rounded-lg border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-light">{r.date?.slice(5)}</p>
                      <p className="text-xs text-gray-400">{r.date === "2026-09-08" ? "MON" : "TUE"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.timeSlot}</p>
                      <p className="text-xs text-gray-500">BOOTH {r.boothId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono" style={{ color: "#C9A96E" }}>{r.reservationId}</p>
                    <p className="text-xs text-green-600 mt-1">確定</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* ===== SECTION 08: FAQ ===== */}
      <section className="py-20 px-6" style={{ background: "#FAFAF7" }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-xs tracking-[0.3em] mb-3 text-center" style={{ color: "#C9A96E" }}>INFORMATION</p>
          <h2 className="text-2xl font-light text-center mb-8" style={{ fontFamily: "'Noto Serif JP', serif" }}>
            ご予約前にご確認ください
          </h2>
          <div className="space-y-3">
            {[
              { q: "受付時間", a: "各ブースの受付は予約時間の10分前から開始します。" },
              { q: "予約可能回数", a: "お一人様、1日あたり最大2枠までご予約いただけます。" },
              { q: "1枠あたりの配信時間", a: "1枠60分です。準備・撤収時間を含みます。" },
              { q: "遅刻時の対応", a: "予約時間から15分以上遅れた場合、予約は自動キャンセルとなります。" },
              { q: "キャンセルについて", a: "キャンセルはマイページから前日まで可能です。" },
              { q: "機材について", a: "ブースにはWi-Fi、電源、照明を完備。配信機材はご自身でご用意ください。" },
              { q: "ブース利用ルール", a: "他の参加者への配慮をお願いします。大音量での配信はご遠慮ください。" },
            ].map((item, i) => (
              <details key={i} className="group bg-white border border-gray-100 rounded-lg">
                <summary className="px-6 py-4 cursor-pointer text-sm font-medium flex justify-between items-center">
                  {item.q}
                  <span className="text-gray-300 group-open:rotate-45 transition-transform text-lg">+</span>
                </summary>
                <div className="px-6 pb-4 text-sm text-gray-500">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="py-8 text-center" style={{ background: "#0a0a0a" }}>
        <p className="text-xs text-gray-500">LIVE COMMERCE FESTIVAL 2026 — 八芳園 5F</p>
        <a href="/" className="text-xs mt-2 inline-block transition-colors hover:opacity-80" style={{ color: "#C9A96E" }}>
          ← イベントページに戻る
        </a>
      </div>
    </div>
  );
}
