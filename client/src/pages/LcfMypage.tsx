/**
 * Live Commerce Festival - マイページ（充実版）
 * 申し込み内容表示・イベント情報・カウントダウン・準備チェックリスト
 */
import { useState, useEffect } from 'react';
import { LogOut, User, Building2, Mic2, Users, Key, Loader2, CheckCircle2, Calendar, MapPin, ExternalLink, ChevronDown, ChevronUp, PartyPopper, Sparkles, Trophy, Upload, Image as ImageIcon, Pencil, Trash2, X, Save } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { QRCodeSVG } from "qrcode.react";
import { trpc } from '@/lib/trpc';

// イベント日時
const EVENT_DATE = new Date('2026-09-08T13:00:00+09:00');

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const diff = EVENT_DATE.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { value: timeLeft.days, label: '日' },
        { value: timeLeft.hours, label: '時間' },
        { value: timeLeft.minutes, label: '分' },
        { value: timeLeft.seconds, label: '秒' },
      ].map((item) => (
        <div key={item.label} className="text-center">
          <div className="bg-gradient-to-b from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl py-3 px-2">
            <span className="text-2xl md:text-3xl font-bold text-amber-400 font-mono">{String(item.value).padStart(2, '0')}</span>
          </div>
          <span className="text-xs text-gray-400 mt-1 block">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    new: { label: '参加確定', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    confirmed: { label: '参加確定', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    rejected: { label: '無効', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    cancelled: { label: 'キャンセル', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  };
  const c = config[status] || config.new;
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${c.className}`}>
      {(status === 'confirmed' || status === 'new') && <CheckCircle2 className="w-3 h-3" />}
      {c.label}
    </span>
  );
}

export default function LcfMypage() {
  const [, setLocation] = useLocation();
  const { data: me, isLoading: meLoading } = trpc.festivalAuth.me.useQuery();
  const { data: myApp, isLoading: appLoading } = trpc.festival.getMyApplication.useQuery();
  const myTickets = trpc.festival.getMyTickets.useQuery(undefined, { enabled: !!me });
  const logoutMutation = trpc.festivalAuth.logout.useMutation({
    onSuccess: () => {
      localStorage.removeItem('lcf_token');
      window.location.replace('/lcf/login');
    },
  });

  // Password change
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const changePwMutation = trpc.festivalAuth.changePassword.useMutation({
    onSuccess: () => {
      setPwMsg('パスワードを変更しました');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setShowPwChange(false);
    },
    onError: (err: any) => setPwMsg(err.message),
  });

  // Application details toggle
  const [showDetails, setShowDetails] = useState(false);

  const isLoading = meLoading || appLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">ログインが必要です</p>
          <Link href="/lcf/login" className="text-amber-400 hover:text-amber-300">
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  const typeLabel = me.accountType === 'company' ? '企業出展' : me.accountType === 'liver' ? 'ライバー' : '一般参加';
  const TypeIcon = me.accountType === 'company' ? Building2 : me.accountType === 'liver' ? Mic2 : Users;
  const app = myApp?.application;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 py-4 px-4 bg-gradient-to-r from-amber-900/20 to-transparent">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <TypeIcon className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="font-bold">マイページ</h1>
              <p className="text-xs text-gray-400">{typeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/livecommercefestival/2026" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> イベントページ
            </Link>
            <button
              onClick={() => logoutMutation.mutate()}
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Countdown */}
        <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 border border-amber-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <PartyPopper className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-lg">イベント開催まで</h2>
          </div>
          <CountdownTimer />
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-300 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4 text-amber-400" /> 2026年9月8日-9日</span>
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-amber-400" /> 八芳園（白金台）</span>
          </div>
        </div>


        {/* 入場QRコード */}
        {myTickets.data && myTickets.data.length > 0 && (
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 border border-green-500/30 rounded-2xl p-6 text-center">
            <h2 className="font-bold text-lg mb-2 flex items-center justify-center gap-2">
              🎫 入場チケット
              {myTickets.data.length > 1 && <span className="text-xs text-green-300">{myTickets.data.length}枚</span>}
            </h2>
            <p className="text-sm text-gray-300 mb-4">当日会場で該当するQRコードをご提示ください</p>
            <div className={myTickets.data.length > 1 ? "grid gap-4 md:grid-cols-2" : ""}>
              {myTickets.data.map((ticket) => {
                const label = ticket.applicantType === 'company' ? '企業出展' : ticket.applicantType === 'liver' ? 'ライバー' : '一般参加';
                return (
                  <div key={ticket.ticketId} className={myTickets.data.length > 1 ? "rounded-xl border border-white/10 bg-black/20 p-4" : ""}>
                    {myTickets.data.length > 1 && <p className="mb-3 text-sm font-bold text-green-300">{label}</p>}
                    <div className="bg-white rounded-xl p-4 inline-block mb-3">
                      <QRCodeSVG value={ticket.ticketId} size={myTickets.data.length > 1 ? 150 : 180} level="H" />
                    </div>
                    <p className="text-sm font-mono text-amber-400 break-all">{ticket.ticketId}</p>
                    {ticket.checkedIn ? (
                      <p className="text-green-400 text-sm mt-2">✓ 受付済み</p>
                    ) : (
                      <p className="text-gray-400 text-xs mt-2">※ スクリーンショットを保存してください</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Status Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{me.displayName}</h2>
                <p className="text-gray-400 text-sm">{me.email}</p>
              </div>
            </div>
            {app && <StatusBadge status={(app as any).status || 'new'} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-gray-400">参加タイプ</p>
              <p className="font-bold text-sm">{typeLabel}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-gray-400">申込日</p>
              <p className="font-bold text-sm">{app ? new Date((app as any).created_at || (app as any).createdAt).toLocaleDateString('ja-JP') : '-'}</p>
            </div>
          </div>
        </div>

        {/* Application Details */}
        {app && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
            >
              <h3 className="font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> 申し込み内容
              </h3>
              {showDetails ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>
            {showDetails && (
              <div className="px-5 pb-5 border-t border-white/5">
                {myApp?.accountType === 'company' && (
                  <CompanyDetails app={app as any} />
                )}
                {myApp?.accountType === 'liver' && (
                  <LiverDetails app={app as any} />
                )}
                {myApp?.accountType === 'general' && (
                  <GeneralDetails app={app as any} />
                )}
                {myApp?.accountType && (
                  <ApplicationProfileEditor accountType={myApp.accountType as 'company' | 'liver' | 'general'} app={app as any} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Event Info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" /> イベント詳細
          </h3>
          <div className="space-y-3 text-sm">
            {(() => {
              const schedule = app?.attendanceSchedule || app?.attendance_schedule || 'both_days';
              const isDay1 = schedule === 'day1_only' || schedule === 'both_days';
              const isDay2 = schedule === 'day2_only' || schedule === 'both_days';
              return (<>
                <div className={`flex items-start gap-3 p-3 rounded-lg ${isDay1 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5 opacity-40'}`}>
                  <Calendar className={`w-4 h-4 mt-0.5 shrink-0 ${isDay1 ? 'text-amber-400' : 'text-gray-500'}`} />
                  <div>
                    <p className="font-bold">Day 1: 2026年9月8日（火）</p>
                    <p className="text-gray-400">13:00〜20:30（アフターパーティー含む）</p>
                    {isDay1 && <span className="text-xs text-amber-400 font-bold">✓ 参加予定</span>}
                  </div>
                </div>
                <div className={`flex items-start gap-3 p-3 rounded-lg ${isDay2 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-white/5 opacity-40'}`}>
                  <Calendar className={`w-4 h-4 mt-0.5 shrink-0 ${isDay2 ? 'text-amber-400' : 'text-gray-500'}`} />
                  <div>
                    <p className="font-bold">Day 2: 2026年9月9日（水）</p>
                    <p className="text-gray-400">10:00〜18:00</p>
                    {isDay2 && <span className="text-xs text-amber-400 font-bold">✓ 参加予定</span>}
                  </div>
                </div>
              </>);
            })()}
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <MapPin className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">八芳園</p>
                <p className="text-gray-400">東京都港区白金台1-1-1（白金台駅 徒歩1分）</p>
                <p className="text-gray-400">5F STUDIO KOKU / 6F HALL HAKU</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preparation Checklist (Company only) */}
        {myApp?.accountType === 'company' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" /> 出展準備チェックリスト
            </h3>
            <div className="space-y-2">
              {[
                { label: '申し込み完了', done: true },
                { label: '参加確定', done: true },
                { label: 'TikTok Shopセラーアカウント連携', done: false },
                { label: '商材情報の登録（最大3SKU）', done: false },
                { label: 'ライバーマッチング確定', done: false },
                { label: 'サンプル発送', done: false },
                { label: '当日ブース設営', done: false },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${item.done ? 'bg-green-500/10' : 'bg-white/5'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? 'border-green-400 bg-green-400' : 'border-gray-500'}`}>
                    {item.done && <CheckCircle2 className="w-3 h-3 text-black" />}
                  </div>
                  <span className={`text-sm ${item.done ? 'text-green-300' : 'text-gray-300'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Liver Checklist */}
        {myApp?.accountType === 'liver' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" /> 参加準備チェックリスト
            </h3>
            <div className="space-y-2">
              {[
                { label: '申し込み完了', done: true },
                { label: '参加確定', done: true },
                { label: '希望商材エントリー', done: false },
                { label: 'マッチング確定', done: false },
                { label: 'TikTok Shop TAP連携', done: false },
                { label: '当日配信準備', done: false },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${item.done ? 'bg-green-500/10' : 'bg-white/5'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? 'border-green-400 bg-green-400' : 'border-gray-500'}`}>
                    {item.done && <CheckCircle2 className="w-3 h-3 text-black" />}
                  </div>
                  <span className={`text-sm ${item.done ? 'text-green-300' : 'text-gray-300'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIVE BOOTH 予約 - ライバーのみ */}
        {me.accountType === "liver" && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <span style={{ color: "#C9A96E" }}>LIVE配信ブース 予約</span>
          </h3>
          <BoothReservationSection />
        </div>
        )}

        {/* GMV AWARD 提出 */}
        <GmvAwardSection />

        {/* Password Change */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" /> パスワード変更
            </h3>
            <button
              onClick={() => setShowPwChange(!showPwChange)}
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              {showPwChange ? '閉じる' : '変更する'}
            </button>
          </div>
          {showPwChange && (
            <div className="space-y-3 mt-4">
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="現在のパスワード"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="新しいパスワード（12文字以上）"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="新しいパスワード（確認）"
                autoComplete="new-password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              {confirmPw && newPw !== confirmPw && <p className="text-sm text-red-400">確認用パスワードが一致しません</p>}
              {pwMsg && <p className="text-sm text-amber-400">{pwMsg}</p>}
              <button
                onClick={() => changePwMutation.mutate({ currentPassword: currentPw, newPassword: newPw })}
                disabled={!currentPw || newPw.length < 12 || newPw !== confirmPw || changePwMutation.isPending}
                className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg hover:bg-amber-400 disabled:opacity-50 text-sm"
              >
                {changePwMutation.isPending ? '変更中...' : 'パスワードを変更'}
              </button>
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-gray-400 text-sm mb-2">ご質問・お問い合わせ</p>
          <a href="mailto:info@livecommercejapan.jp" className="text-amber-400 hover:text-amber-300 text-sm font-medium">
            info@livecommercejapan.jp
          </a>
        </div>
      </div>
    </div>
  );
}


/* ─── BOOTH Reservation Section ─── */
function BoothReservationSection() {
  const [showBooking, setShowBooking] = useState(false);
  const [selDate, setSelDate] = useState("2026-09-08");
  const [selBooth, setSelBooth] = useState<string | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);

  const reservationsQuery = trpc.boothReservation.getMyReservations.useQuery();
  const availQuery = trpc.boothReservation.getAllAvailability.useQuery();
  const createMut = trpc.boothReservation.createReservation.useMutation({
    onSuccess: () => {
      reservationsQuery.refetch();
      availQuery.refetch();
      setShowBooking(false);
      setSelBooth(null);
      setSelTime(null);
      alert("予約が完了しました！");
    },
    onError: (err) => alert(err.message),
  });
  const cancelMut = trpc.boothReservation.cancelReservation.useMutation({
    onSuccess: () => { reservationsQuery.refetch(); availQuery.refetch(); },
    onError: (err) => alert(err.message),
  });

  const reservations = reservationsQuery.data || [];
  const reserved = availQuery.data?.reserved || {};
  const BOOTHS = ["T1","T2","T3","T4","T13","T14","T15","T16","T17","T18","T19","T20","T21","T22","T23","T24"];
  const SLOTS: Record<string,string[]> = {
    "2026-09-08": ["13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00","17:00-18:00"],
    "2026-09-09": ["11:00-12:00","12:00-13:00","13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00","17:00-18:00","18:00-19:00"],
  };
  const timeSlots = SLOTS[selDate] || [];

  const handleReserve = () => {
    if (!selBooth || !selTime) return;
    if (!confirm(`${selDate.slice(5)} ${selTime} ブース ${selBooth} を予約しますか？`)) return;
    createMut.mutate({ boothId: selBooth, date: selDate, timeSlot: selTime });
  };

  return (
    <div>
      {/* 予約済みリスト */}
      {reservations.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-gray-400 mb-1">予約済み</p>
          {reservations.map((r: any) => (
            <div key={r.reservationId} className="bg-gray-800 p-3 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-center px-2 py-1 rounded" style={{ background: "rgba(201,169,110,0.15)" }}>
                  <p className="text-sm font-light text-white">{r.date?.slice(5)}</p>
                  <p className="text-[10px]" style={{ color: "#C9A96E" }}>{r.date === "2026-09-08" ? "DAY1" : "DAY2"}</p>
                </div>
                <div>
                  <p className="text-sm text-white">{r.timeSlot}</p>
                  <p className="text-xs" style={{ color: "#C9A96E" }}>ブース {r.boothId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500">{r.reservationId}</span>
                <button onClick={() => { if (confirm("この予約をキャンセルしますか？")) cancelMut.mutate({ reservationId: r.reservationId }); }} className="text-xs px-2 py-1 bg-red-900/50 text-red-400 rounded hover:bg-red-900 transition-colors">取消</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新規予約ボタン */}
      {!showBooking ? (
        <button onClick={() => setShowBooking(true)} className="w-full py-3 text-sm tracking-wider rounded transition-all hover:opacity-90" style={{ background: "#C9A96E", color: "#0a0a0a" }}>
          {reservations.length > 0 ? "別の時間帯を予約する" : "LIVE配信ブースを予約する"}
        </button>
      ) : (
        <div className="space-y-4">
          {/* 日付選択 */}
          <div className="flex gap-2">
            {[{v:"2026-09-08",l:"09.08 (Day1)"},{v:"2026-09-09",l:"09.09 (Day2)"}].map(d => (
              <button key={d.v} onClick={() => { setSelDate(d.v); setSelBooth(null); setSelTime(null); }}
                className="flex-1 py-2 text-sm border rounded transition-all"
                style={{ borderColor: selDate === d.v ? "#C9A96E" : "#444", color: selDate === d.v ? "#C9A96E" : "#888", background: selDate === d.v ? "rgba(201,169,110,0.1)" : "transparent" }}>
                {d.l}
              </button>
            ))}
          </div>

          {/* 時間×ブース表 */}
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[600px]">
              <div className="grid gap-px" style={{ gridTemplateColumns: "60px repeat(16, 1fr)" }}>
                <div className="p-1 text-[10px] text-gray-500 text-center">TIME</div>
                {BOOTHS.map(b => <div key={b} className="p-1 text-[10px] text-center" style={{ color: "#C9A96E" }}>{b}</div>)}
              </div>
              {timeSlots.map(time => (
                <div key={time} className="grid gap-px" style={{ gridTemplateColumns: "60px repeat(16, 1fr)" }}>
                  <div className="p-1 text-[10px] text-gray-400 text-center flex items-center justify-center">{time.split("-")[0]}</div>
                  {BOOTHS.map(booth => {
                    const key = selDate + "_" + booth + "_" + time;
                    const isRes = reserved[key];
                    const isSel = selBooth === booth && selTime === time;
                    return (
                      <button key={booth} onClick={() => { if (!isRes) { setSelBooth(booth); setSelTime(time); } }}
                        disabled={isRes} className="p-1 text-[10px] border transition-all"
                        style={{ borderColor: isSel ? "#C9A96E" : isRes ? "#222" : "#333", background: isSel ? "rgba(201,169,110,0.2)" : isRes ? "#1a1a1a" : "transparent", color: isRes ? "#444" : isSel ? "#C9A96E" : "#777", cursor: isRes ? "not-allowed" : "pointer" }}>
                        {isRes ? "×" : isSel ? "●" : "○"}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 選択サマリー + 予約ボタン */}
          {selBooth && selTime && (
            <div className="p-4 border rounded-lg text-center" style={{ borderColor: "#C9A96E", background: "rgba(201,169,110,0.05)" }}>
              <p className="text-sm text-gray-400">{selDate.slice(5)} | {selTime} | <span style={{ color: "#C9A96E" }}>ブース {selBooth}</span></p>
              <button onClick={handleReserve} disabled={createMut.isPending}
                className="mt-3 w-full py-2.5 text-sm tracking-wider rounded transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "#C9A96E", color: "#0a0a0a" }}>
                {createMut.isPending ? "処理中..." : "予約を確定する"}
              </button>
            </div>
          )}

          <button onClick={() => { setShowBooking(false); setSelBooth(null); setSelTime(null); }} className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors">
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── GMV AWARD Section ─── */
function GmvAwardSection() {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [viewImage, setViewImage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    gmv: '', auctionGmv: '', fixedPriceGmv: '', duration: '', livestreamDate: '', tiktokUsername: '',
  });
  const mySubmissions = trpc.ranking.mySubmissions.useQuery();
  const submitMutation = trpc.ranking.submit.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setPreviewUrl(null);
      setUploading(false);
      mySubmissions.refetch();
    },
    onError: (err) => {
      setUploading(false);
      alert(`エラー: ${err.message}`);
    },
  });
  const updateMutation = trpc.ranking.myUpdate.useMutation({
    onSuccess: () => {
      setEditingId(null);
      mySubmissions.refetch();
      alert('ランキングデータを更新しました。');
    },
    onError: (err) => alert(`更新エラー: ${err.message}`),
  });
  const deleteMutation = trpc.ranking.myDelete.useMutation({
    onSuccess: () => {
      setEditingId(null);
      mySubmissions.refetch();
    },
    onError: (err) => alert(`削除エラー: ${err.message}`),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 10 * 1024 * 1024) {
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('JPEG・PNG・WebP形式の画像を選択してください');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!previewUrl) return;
    setUploading(true);
    setResult(null);
    const base64 = previewUrl.split(',')[1];
    const mimeType = previewUrl.split(';')[0].split(':')[1];
    submitMutation.mutate({
      screenshotBase64: base64,
      fileName: 'screenshot.jpg',
      mimeType: mimeType || 'image/jpeg',
    });
  };

  const startEdit = (sub: any) => {
    setEditingId(sub.id);
    setEditForm({
      gmv: String(sub.gmv ?? 0),
      auctionGmv: String(sub.auctionGmv ?? 0),
      fixedPriceGmv: String(sub.fixedPriceGmv ?? 0),
      duration: sub.duration || '',
      livestreamDate: sub.livestreamDate || '',
      tiktokUsername: sub.tiktokUsername || '',
    });
  };

  const saveEdit = () => {
    if (editingId == null) return;
    updateMutation.mutate({
      id: editingId,
      gmv: Number(editForm.gmv) || 0,
      auctionGmv: Number(editForm.auctionGmv) || 0,
      fixedPriceGmv: Number(editForm.fixedPriceGmv) || 0,
      duration: editForm.duration.trim() || null,
      livestreamDate: editForm.livestreamDate.trim() || null,
      tiktokUsername: editForm.tiktokUsername.trim() || null,
    });
  };

  const statusLabel = (s: string) => {
    if (s === 'approved') return <span className="text-green-400 text-xs font-bold">✓ ランキング反映中</span>;
    return <span className="text-amber-400 text-xs font-bold">旧ステータス</span>;
  };

  return (
    <div className="bg-gradient-to-br from-yellow-900/30 to-amber-900/20 border border-yellow-500/30 rounded-2xl p-6">
      <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <span className="bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">GMV AWARD</span>
      </h3>
      <p className="text-sm text-gray-300 mb-4">
        TikTok LIVEダッシュボードのスクリーンショットをアップロードすると、AI分析後すぐにランキングへ反映されます。
      </p>

      <div className="space-y-3">
        {previewUrl ? (
          <div className="relative">
            <img src={previewUrl} alt="アップロードプレビュー" className="w-full rounded-lg border border-white/10 max-h-48 object-contain bg-black" />
            <button onClick={() => { setPreviewUrl(null); setResult(null); }} className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1" aria-label="選択画像を削除">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-yellow-500/30 rounded-xl cursor-pointer hover:border-yellow-500/60 hover:bg-yellow-500/5 transition-colors">
            <Upload className="w-8 h-8 text-yellow-400 mb-2" />
            <span className="text-sm text-gray-300">LIVEダッシュボードスクリーンショットをアップロード</span>
            <span className="text-xs text-gray-500 mt-1">PNG / JPG / WebP（10MB以下）</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
          </label>
        )}

        {previewUrl && !result && (
          <button onClick={handleSubmit} disabled={uploading} className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold py-3 rounded-xl hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? <><Loader2 className="w-5 h-5 animate-spin" /> AI分析中...</> : <><Trophy className="w-5 h-5" /> データを提出する</>}
          </button>
        )}

        {result && (
          <div className="bg-black/30 border border-green-500/30 rounded-xl p-4 space-y-2">
            <p className="text-green-400 font-bold text-sm">✓ AI分析完了！ランキングに反映されました。</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-white/5 rounded-lg p-2"><p className="text-xs text-gray-400">GMV</p><p className="font-bold text-yellow-400">¥{(result.recognizedData?.gmv || 0).toLocaleString()}</p></div>
              <div className="bg-white/5 rounded-lg p-2"><p className="text-xs text-gray-400">拍卖GMV</p><p className="font-bold text-amber-300">¥{(result.recognizedData?.auctionGmv || 0).toLocaleString()}</p></div>
              <div className="bg-white/5 rounded-lg p-2"><p className="text-xs text-gray-400">一口价GMV</p><p className="font-bold text-amber-300">¥{(result.recognizedData?.fixedPriceGmv || 0).toLocaleString()}</p></div>
              <div className="bg-white/5 rounded-lg p-2"><p className="text-xs text-gray-400">直播時長</p><p className="font-bold text-gray-200">{result.recognizedData?.duration || '-'}</p></div>
            </div>
          </div>
        )}
      </div>

      {mySubmissions.data && mySubmissions.data.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h4 className="text-sm font-bold text-amber-400 mb-3">📊 累計データ</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-amber-900/40 to-yellow-900/20 border border-amber-600/30 rounded-lg p-3 text-center"><p className="text-xs text-amber-300/70">累計GMV</p><p className="text-lg font-bold text-amber-400">¥{mySubmissions.data.reduce((sum: number, s: any) => sum + Number(s.gmv || 0), 0).toLocaleString()}</p></div>
            <div className="bg-gradient-to-br from-amber-900/40 to-yellow-900/20 border border-amber-600/30 rounded-lg p-3 text-center"><p className="text-xs text-amber-300/70">提出回数</p><p className="text-lg font-bold text-amber-400">{mySubmissions.data.length}回</p></div>
            <div className="bg-gradient-to-br from-amber-900/40 to-yellow-900/20 border border-amber-600/30 rounded-lg p-3 text-center"><p className="text-xs text-amber-300/70">累計拍卖GMV</p><p className="text-lg font-bold text-green-400">¥{mySubmissions.data.reduce((sum: number, s: any) => sum + Number(s.auctionGmv || 0), 0).toLocaleString()}</p></div>
            <div className="bg-gradient-to-br from-amber-900/40 to-yellow-900/20 border border-amber-600/30 rounded-lg p-3 text-center"><p className="text-xs text-amber-300/70">累計一口价GMV</p><p className="text-lg font-bold text-blue-400">¥{mySubmissions.data.reduce((sum: number, s: any) => sum + Number(s.fixedPriceGmv || 0), 0).toLocaleString()}</p></div>
          </div>
        </div>
      )}

      {mySubmissions.data && mySubmissions.data.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h4 className="text-sm font-bold text-gray-300 mb-3">提出履歴</h4>
          <div className="space-y-3 max-h-[38rem] overflow-y-auto pr-1">
            {mySubmissions.data.map((sub: any) => (
              <div key={sub.id} className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-3">
                  {sub.screenshotUrl ? (
                    <button type="button" onClick={() => setViewImage(sub.screenshotUrl)} className="group relative h-28 sm:h-full min-h-24 rounded-lg overflow-hidden bg-black border border-white/10" aria-label="スクリーンショットを拡大表示">
                      <img src={sub.screenshotUrl} alt="提出スクリーンショット" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <span className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[11px] py-1">クリックして拡大</span>
                    </button>
                  ) : (
                    <div className="h-24 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center text-xs text-gray-500">画像なし</div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xl font-bold text-yellow-400">¥{Number(sub.gmv).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{sub.livestreamDate || new Date(sub.submittedAt).toLocaleDateString('ja-JP')}</p>
                      </div>
                      {statusLabel(sub.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-300">
                      <span>拍卖 ¥{Number(sub.auctionGmv || 0).toLocaleString()}</span>
                      <span>一口价 ¥{Number(sub.fixedPriceGmv || 0).toLocaleString()}</span>
                      <span>時長 {sub.duration || '-'}</span>
                      <span className="truncate">TikTok {sub.tiktokUsername || '-'}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button type="button" onClick={() => startEdit(sub)} className="flex items-center gap-1 px-3 py-1.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold"><Pencil className="w-3 h-3" />修正</button>
                      <button type="button" onClick={() => { if (confirm('この投稿とスクリーンショットを削除しますか？この操作は元に戻せません。')) deleteMutation.mutate({ id: sub.id }); }} disabled={deleteMutation.isPending} className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-500/15 text-red-300 hover:bg-red-500/25 text-xs font-bold disabled:opacity-50"><Trash2 className="w-3 h-3" />削除</button>
                    </div>
                  </div>
                </div>

                {editingId === sub.id && (
                  <div className="border-t border-white/10 pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="text-xs text-gray-400">GMV<input type="number" min="0" value={editForm.gmv} onChange={(e) => setEditForm({...editForm, gmv: e.target.value})} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white" /></label>
                      <label className="text-xs text-gray-400">拍卖GMV<input type="number" min="0" value={editForm.auctionGmv} onChange={(e) => setEditForm({...editForm, auctionGmv: e.target.value})} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white" /></label>
                      <label className="text-xs text-gray-400">一口价GMV<input type="number" min="0" value={editForm.fixedPriceGmv} onChange={(e) => setEditForm({...editForm, fixedPriceGmv: e.target.value})} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white" /></label>
                      <label className="text-xs text-gray-400">直播時長<input value={editForm.duration} onChange={(e) => setEditForm({...editForm, duration: e.target.value})} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white" /></label>
                      <label className="text-xs text-gray-400">直播日<input type="date" value={editForm.livestreamDate} onChange={(e) => setEditForm({...editForm, livestreamDate: e.target.value})} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white" /></label>
                      <label className="text-xs text-gray-400">TikTokユーザー名<input value={editForm.tiktokUsername} onChange={(e) => setEditForm({...editForm, tiktokUsername: e.target.value})} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-2 text-white" /></label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setEditingId(null)} className="px-3 py-2 text-xs text-gray-300 hover:text-white">キャンセル</button>
                      <button type="button" onClick={saveEdit} disabled={updateMutation.isPending} className="flex items-center gap-1 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-500 text-xs font-bold disabled:opacity-50"><Save className="w-3 h-3" />{updateMutation.isPending ? '保存中...' : '保存する'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-center">
        <Link href="/lcf/ranking" className="text-amber-400 hover:text-amber-300 text-sm font-bold inline-flex items-center gap-1">🏆 ランキングを見る →</Link>
      </div>

      {viewImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 p-4 flex items-center justify-center" role="dialog" aria-modal="true" onClick={() => setViewImage(null)}>
          <button type="button" onClick={() => setViewImage(null)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2" aria-label="閉じる"><X className="w-6 h-6" /></button>
          <img src={viewImage} alt="提出スクリーンショット拡大" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

/* ─── Application Profile Editor ─── */
type EditableField = {
  key: string;
  label: string;
  multiline?: boolean;
  isStringArray?: boolean;
  type?: 'text' | 'tel' | 'url' | 'select';
  options?: { value: string; label: string }[];
};

const EDITABLE_FIELDS: Record<'company' | 'liver' | 'general', EditableField[]> = {
  company: [
    { key: 'companyName', label: '会社名' },
    { key: 'contactName', label: '担当者名' },
    { key: 'contactNameKana', label: '担当者名（フリガナ）' },
    { key: 'contactDepartment', label: '部署' },
    { key: 'postalCode', label: '郵便番号' },
    { key: 'address', label: '所在地', multiline: true },
    { key: 'phone', label: '電話番号', type: 'tel' },
    { key: 'websiteUrl', label: 'ウェブサイト', type: 'url' },
    { key: 'lineOrLark', label: 'LINE / Lark' },
    { key: 'tiktokShopSellerName', label: 'TikTok Shop セラーアカウント名' },
    { key: 'brandIntro', label: 'ブランド紹介', multiline: true },
    { key: 'tiktokShopUrl', label: 'TikTok Shop URL', type: 'url' },
    { key: 'matchingProducts', label: 'マッチング希望商品', multiline: true },
    { key: 'targetAudience', label: 'ターゲット層', multiline: true },
    { key: 'salesLicense', label: '販売資格', multiline: true },
  ],
  liver: [
    { key: 'name', label: '氏名' },
    { key: 'nameKana', label: '氏名（フリガナ）' },
    { key: 'liverName', label: 'ライバー名' },
    { key: 'agency', label: '所属事務所' },
    { key: 'accountInfo', label: 'TikTok / SNS アカウント情報', multiline: true },
    { key: 'genre', label: '配信ジャンル' },
    { key: 'phone', label: '電話番号', type: 'tel' },
    { key: 'lineOrLark', label: 'LINE / Lark' },
  ],
  general: [
    { key: 'participationType', label: '参加区分', type: 'select', options: [
      { value: 'individual', label: '個人' },
      { value: 'corporate', label: '法人' },
    ] },
    { key: 'companyName', label: '会社名' },
    { key: 'department', label: '部署' },
    { key: 'name', label: '氏名' },
    { key: 'nameKana', label: '氏名（フリガナ）' },
    { key: 'phone', label: '電話番号', type: 'tel' },
    { key: 'visitPurposes', label: '来場目的（複数可・1行ずつ入力）', multiline: true, isStringArray: true },
  ],
};

function missingProfileValue(value: unknown) {
  if (value === null || value === undefined) return true;
  const text = String(value).trim();
  return !text || text === '-' || text === '未復旧' || text.includes('未復旧') || text === 'https://example.invalid';
}

function ApplicationProfileEditor({ accountType, app }: { accountType: 'company' | 'liver' | 'general'; app: any }) {
  const fields = EDITABLE_FIELDS[accountType];
  const fieldValueAsText = (field: EditableField) => {
    const value = app?.[field.key];
    if (missingProfileValue(value)) return '';
    if (field.isStringArray && Array.isArray(value)) return value.join('\n');
    return String(value ?? '');
  };
  const initialValues = Object.fromEntries(fields.map(field => [field.key, fieldValueAsText(field)]));
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [message, setMessage] = useState('');
  const utils = trpc.useUtils();
  const missingCount = fields.filter(field => missingProfileValue(app?.[field.key])).length;
  const mutation = trpc.festival.updateMyApplicationDetails.useMutation({
    onSuccess: async () => {
      await utils.festival.getMyApplication.invalidate();
      setMessage('申込み情報を更新しました');
      setIsOpen(false);
    },
    onError: (error: any) => setMessage(error.message || '更新に失敗しました'),
  });

  useEffect(() => {
    setValues(Object.fromEntries(fields.map(field => {
      const value = app?.[field.key];
      if (missingProfileValue(value)) return [field.key, ''];
      if (field.isStringArray && Array.isArray(value)) return [field.key, value.join('\n')];
      return [field.key, String(value ?? '')];
    })));
  }, [app, accountType]);

  const save = () => {
    const changed: Record<string, any> = {};
    for (const field of fields) {
      const currentValue = app?.[field.key];
      const original = missingProfileValue(currentValue)
        ? ''
        : field.isStringArray && Array.isArray(currentValue)
          ? currentValue.join('\n')
          : String(currentValue ?? '');
      const next = (values[field.key] ?? '').trim();
      if (next !== original && next !== '') {
        changed[field.key] = field.isStringArray
          ? next.split(/[\n,、]+/).map(value => value.trim()).filter(Boolean)
          : next;
      }
    }
    if (Object.keys(changed).length === 0) {
      setMessage('変更内容を入力してください');
      return;
    }
    mutation.mutate({ accountType, data: changed } as any);
  };

  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-amber-300">申込み情報の確認・補完</p>
            <p className="mt-1 text-xs text-gray-300">
              {missingCount > 0
                ? `復旧できなかった項目が ${missingCount} 件あります。ご本人の正しい情報を入力してください。`
                : '登録内容に変更がある場合はこちらから更新できます。'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setIsOpen(!isOpen); setMessage(''); }}
            className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400"
          >
            {isOpen ? '閉じる' : missingCount > 0 ? '不足情報を入力する' : '登録内容を編集する'}
          </button>
        </div>

        {isOpen && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map(field => {
              const isMissing = missingProfileValue(app?.[field.key]);
              const sharedClass = `w-full rounded-lg border px-3 py-2 text-sm text-white outline-none transition-colors ${isMissing ? 'border-amber-500/50 bg-amber-950/30 focus:border-amber-400' : 'border-white/10 bg-black/30 focus:border-white/30'}`;
              return (
                <label key={field.key} className={field.multiline ? 'sm:col-span-2' : ''}>
                  <span className="mb-1 flex items-center gap-2 text-xs text-gray-300">
                    {field.label}
                    {isMissing && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">未復旧</span>}
                  </span>
                  {field.type === 'select' ? (
                    <select
                      value={values[field.key] ?? ''}
                      onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
                      className={sharedClass}
                    >
                      <option value="">選択してください</option>
                      {field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.multiline ? (
                    <textarea
                      rows={3}
                      value={values[field.key] ?? ''}
                      onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
                      placeholder={isMissing ? '正しい情報を入力してください' : ''}
                      className={sharedClass}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={values[field.key] ?? ''}
                      onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
                      placeholder={isMissing ? '正しい情報を入力してください' : ''}
                      className={sharedClass}
                    />
                  )}
                </label>
              );
            })}
            <div className="sm:col-span-2 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-400">メールアドレス、参加状態、Ticket IDは安全のためこの画面では変更できません。</p>
              <button
                type="button"
                onClick={save}
                disabled={mutation.isPending}
                className="rounded-lg bg-green-500 px-5 py-2 text-sm font-bold text-black hover:bg-green-400 disabled:opacity-50"
              >
                {mutation.isPending ? '保存中...' : '入力内容を保存する'}
              </button>
            </div>
            {message && <p className="sm:col-span-2 text-sm text-amber-300">{message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Company Application Details ─── */
function CompanyDetails({ app }: { app: any }) {
  return (
    <div className="space-y-4 pt-4">
      <DetailSection title="基本情報">
        <DetailRow label="会社名" value={app.companyName || app.company_name} />
        <DetailRow label="担当者" value={app.contactName || app.contact_name} />
        <DetailRow label="部署" value={app.contactDepartment || app.contact_department} />
        <DetailRow label="フリガナ" value={app.contactNameKana || app.contact_name_kana} />
        <DetailRow label="郵便番号" value={app.postalCode || app.postal_code} />
        <DetailRow label="所在地" value={app.address} />
        <DetailRow label="電話番号" value={app.phone} />
        <DetailRow label="メール" value={app.email} />
        <DetailRow label="ウェブサイト" value={app.websiteUrl || app.website_url} isLink />
        <DetailRow label="LINE/Lark" value={app.lineOrLark || app.line_or_lark} />
      </DetailSection>
      <DetailSection title="TikTok Shop情報">
        <DetailRow label="セラーアカウント名" value={app.tiktokShopSellerName || app.tiktok_shop_seller_name} />
        <DetailRow label="ブランド紹介" value={app.brandIntro || app.brand_intro} />
        <DetailRow label="TikTok Shop URL" value={app.tiktokShopUrl || app.tiktok_shop_url} isLink />
        <DetailRow label="マッチング希望商品" value={app.matchingProducts || app.matching_products} />
        <DetailRow label="ターゲット層" value={app.targetAudience || app.target_audience} />
        <DetailRow label="販売資格" value={app.salesLicense || app.sales_license} />
      </DetailSection>
    </div>
  );
}

/* ─── Liver Application Details ─── */
function LiverDetails({ app }: { app: any }) {
  const updateSchedule = trpc.festival.updateAttendanceSchedule.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  const scheduleLabels: Record<string, string> = {
    day1_only: 'Day1のみ',
    day2_only: 'Day2のみ',
    both_days: '両日',
  };
  return (
    <div className="space-y-4 pt-4">
      <DetailSection title="基本情報">
        <DetailRow label="氏名" value={app.name} />
        <DetailRow label="フリガナ" value={app.nameKana || app.name_kana} />
        <DetailRow label="ライバー名" value={app.liverName || app.liver_name} />
        <DetailRow label="所属事務所" value={app.agency} />
        <DetailRow label="アカウント情報" value={app.accountInfo || app.account_info} />
        <DetailRow label="ジャンル" value={app.genre} />
        <DetailRow label="メール" value={app.email} />
        <DetailRow label="電話番号" value={app.phone} />
        <DetailRow label="LINE/Lark" value={app.lineOrLark || app.line_or_lark} />
      </DetailSection>
      <DetailSection title="参加情報">
        <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
          <span className="text-gray-400 text-sm">参加日程</span>
          <div className="flex items-center gap-2">
            <select
              value={app.attendanceSchedule || app.attendance_schedule || ''}
              onChange={(e) => updateSchedule.mutate({ attendanceSchedule: e.target.value as any })}
              className="bg-gray-800 border border-amber-500/30 text-amber-200 text-sm rounded px-2 py-1 cursor-pointer"
            >
              <option value="day1_only">Day1のみ (9/8)</option>
              <option value="day2_only">Day2のみ (9/9)</option>
              <option value="both_days">両日参加</option>
            </select>
            {updateSchedule.isPending && <span className="text-xs text-amber-400">保存中...</span>}
          </div>
        </div>
        <DetailRow label="マッチング希望" value={(app.matchingPreference || app.matching_preference) === 'yes' ? 'あり' : 'なし'} />
      </DetailSection>
    </div>
  );
}

/* ─── General Application Details ─── */
function GeneralDetails({ app }: { app: any }) {
  const updateSchedule = trpc.festival.updateAttendanceSchedule.useMutation({
    onSuccess: () => { window.location.reload(); },
  });
  const scheduleLabels: Record<string, string> = {
    day1_only: 'Day1のみ',
    day2_only: 'Day2のみ',
    both_days: '両日',
  };
  return (
    <div className="space-y-4 pt-4">
      <DetailSection title="基本情報">
        <DetailRow label="参加形態" value={(app.participationType || app.participation_type) === 'corporate' ? '法人' : '個人'} />
        <DetailRow label="会社名" value={app.companyName || app.company_name} />
        <DetailRow label="部署" value={app.department} />
        <DetailRow label="氏名" value={app.name} />
        <DetailRow label="フリガナ" value={app.nameKana || app.name_kana} />
        <DetailRow label="メール" value={app.email} />
        <DetailRow label="電話番号" value={app.phone} />
      </DetailSection>
      <DetailSection title="参加情報">
        <div className="flex items-center justify-between py-2 border-b border-gray-700/30">
          <span className="text-gray-400 text-sm">参加日程</span>
          <div className="flex items-center gap-2">
            <select
              value={app.attendanceSchedule || app.attendance_schedule || ''}
              onChange={(e) => updateSchedule.mutate({ attendanceSchedule: e.target.value as any })}
              className="bg-gray-800 border border-amber-500/30 text-amber-200 text-sm rounded px-2 py-1 cursor-pointer"
            >
              <option value="day1_only">Day1のみ (9/8)</option>
              <option value="day2_only">Day2のみ (9/9)</option>
              <option value="both_days">両日参加</option>
            </select>
            {updateSchedule.isPending && <span className="text-xs text-amber-400">保存中...</span>}
          </div>
        </div>
        <DetailRow label="来場目的" value={Array.isArray(app.visitPurposes || app.visit_purposes) ? (app.visitPurposes || app.visit_purposes).join('、') : '-'} />
      </DetailSection>
    </div>
  );
}

/* ─── Helper Components ─── */
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-amber-400 mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, isLink }: { label: string; value?: string | null; isLink?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-400 w-28 shrink-0 pt-0.5">{label}</span>
      {isLink ? (
        <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-sm text-amber-400 hover:text-amber-300 break-all">
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-200 break-all">{value}</span>
      )}
    </div>
  );
}
