/**
 * Live Commerce Festival - マイページ（充実版）
 * 申し込み内容表示・イベント情報・カウントダウン・準備チェックリスト
 */
import { useState, useEffect } from 'react';
import { LogOut, User, Building2, Mic2, Users, Key, Loader2, CheckCircle2, Calendar, MapPin, ExternalLink, ChevronDown, ChevronUp, PartyPopper, Sparkles, Pencil, Trash2, X, Save } from 'lucide-react';
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
    onSuccess: (data) => {
      setPwMsg(data.message);
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

  const typeLabel = me.accountType === 'company'
    ? (me.canReserveBooth ? '企業出展・ライバー' : '企業出展')
    : me.accountType === 'liver'
      ? 'ライバー'
      : (me.canReserveBooth ? '一般参加・ライバー' : '一般参加');
  const TypeIcon = me.canReserveBooth ? Mic2 : me.accountType === 'company' ? Building2 : Users;
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
            <p className="text-sm text-gray-300 mb-1">当日会場で該当するQRコードをご提示ください</p>
            <p className="text-xs text-green-200 mb-4">同行者がいる場合も同じQRコードを1名ずつ受付で提示できます</p>
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
                    {Number(ticket.admissionCount || 0) > 0 ? (
                      <p className="text-green-400 text-sm mt-2">✓ {Number(ticket.admissionCount || 0)}名受付済み</p>
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

        {/* LIVE配信ブース予約 - ライバーのみ */}
        {me.canReserveBooth && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <span style={{ color: "#C9A96E" }}>LIVE配信ブース 予約</span>
          </h3>
          {me.accountType !== "liver" && (
            <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
              同じメールアドレスのライバー申込みが確認済みのため、LIVE配信ブースをご予約いただけます。
            </p>
          )}
          <BoothReservationSection />
        </div>
        )}


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
                placeholder="新しいパスワード（12文字以上・英字と数字を含む）"
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
              <p className="text-xs text-gray-500">12文字以上で、英字と数字をそれぞれ1文字以上含めてください。</p>
              {newPw && (!/[A-Za-z]/.test(newPw) || !/[0-9]/.test(newPw)) && <p className="text-sm text-red-400">英字と数字をそれぞれ1文字以上含めてください</p>}
              {confirmPw && newPw !== confirmPw && <p className="text-sm text-red-400">確認用パスワードが一致しません</p>}
              {pwMsg && <p className="text-sm text-amber-400">{pwMsg}</p>}
              <button
                onClick={() => changePwMutation.mutate({ currentPassword: currentPw, newPassword: newPw })}
                disabled={!currentPw || newPw.length < 12 || !/[A-Za-z]/.test(newPw) || !/[0-9]/.test(newPw) || newPw !== confirmPw || changePwMutation.isPending}
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


/* ─── LIVE配信ブース Reservation Section ─── */
function BoothReservationSection() {
  const [showBooking, setShowBooking] = useState(false);
  const [selDate, setSelDate] = useState("2026-09-08");
  const [selBooth, setSelBooth] = useState<string | null>(null);
  const [selTime, setSelTime] = useState<string | null>(null);
  const [clientNow, setClientNow] = useState(() => Date.now());

  const reservationsQuery = trpc.boothReservation.getMyReservations.useQuery();
  const availQuery = trpc.boothReservation.getAllAvailability.useQuery(undefined, { refetchInterval: 30_000 });
  const createMut = trpc.boothReservation.createReservation.useMutation({
    onSuccess: (data) => {
      reservationsQuery.refetch();
      availQuery.refetch();
      setShowBooking(false);
      setSelBooth(null);
      setSelTime(null);
      alert(data.bookingType === "same_day" ? "当日枠の予約が完了しました。ブース前のQRコードからチェックインしてください。" : "事前予約が完了しました！");
    },
    onError: (err) => alert(err.message),
  });
  const cancelMut = trpc.boothReservation.cancelReservation.useMutation({
    onSuccess: () => { reservationsQuery.refetch(); availQuery.refetch(); },
    onError: (err) => alert(err.message),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClientNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const reservations = reservationsQuery.data || [];
  const activeReservations = reservations.filter((r: any) => r.status === "confirmed" || r.status === "checked_in");
  const advanceReservations = activeReservations.filter((r: any) => r.bookingType === "advance");
  const reserved = availQuery.data?.reserved || {};
  const bookingWindows = availQuery.data?.bookingWindows || {};
  const bookingOpensAt = Number(availQuery.data?.bookingOpensAt || Date.parse("2026-08-28T21:00:00+09:00"));
  const serverNowAtFetch = Number(availQuery.data?.serverNow || clientNow);
  const effectiveNow = serverNowAtFetch + Math.max(0, clientNow - (availQuery.dataUpdatedAt || clientNow));
  const isBookingOpen = effectiveNow >= bookingOpensAt;
  const BOOTHS = ["T13","T14","T15","T16","T17","T18","T19","T20","T21","T22","T23","T24"];
  const SLOTS: Record<string,string[]> = {
    "2026-09-08": ["13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00","17:00-18:00"],
    "2026-09-09": ["11:00-12:00","12:00-13:00","13:00-14:00","14:00-15:00","15:00-16:00","16:00-17:00","17:00-18:00","18:00-19:00"],
  };
  const timeSlots = SLOTS[selDate] || [];

  const statusStyle = (status: string) => {
    if (status === "checked_in") return "bg-blue-900/50 text-blue-300";
    if (status === "completed") return "bg-emerald-900/50 text-emerald-300";
    if (status === "confirmed") return "bg-green-900/50 text-green-300";
    return "bg-gray-800 text-gray-400";
  };

  const handleReserve = () => {
    if (!selBooth || !selTime || !isBookingOpen) return;
    const windowInfo = bookingWindows[`${selDate}_${selTime}`] as any;
    if (windowInfo?.mode !== "advance") {
      alert("当日枠は各ブース前のQRコードから予約してください。");
      return;
    }
    if (!confirm(`${selDate.slice(5)} ${selTime} ブース ${selBooth} を事前予約しますか？`)) return;
    createMut.mutate({ boothId: selBooth as any, date: selDate as any, timeSlot: selTime });
  };

  return (
    <div className="space-y-4">
      {!isBookingOpen && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-center">
          <p className="font-bold text-amber-300">予約受付は日本時間2026年8月28日21:00から開始します</p>
          <p className="mt-1 text-xs text-gray-400">21:00より前は予約操作を行うことができません。開始時刻になると自動的に予約可能になります。</p>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-gray-300">
        <p className="font-bold text-amber-300">予約・利用ルール</p>
        <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-red-200">T1～T4はLIVE配信専用設備ではないため予約対象外です。既存予約はキャンセルされましたので、T13～T24から再予約してください。</p>
        <p className="mt-2">事前予約は9月8日・9日の合計でお一人様2枠までです。連続利用はできないため、予約の間を1枠分（1時間）空けてください。</p>
        <p className="mt-1">当日枠は各時間帯の開始15分前から、空いているブース前のQRコードで予約できます。当日枠は事前予約2枠に含まれません。</p>
        <p className="mt-1">利用時はブース前のQRコードからチェックインしてください。開始15分後までにチェックインがない場合、この予約と以後の事前予約は自動的に無効になります。</p>
        <p className="mt-1 text-gray-400">ブースには電源・充電器・照明・三脚・配信機材の用意はありません。準備・配信・撤収を含めて1時間です。</p>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
        <span className="text-xs text-gray-400">事前予約の利用枠</span>
        <span className="text-sm font-bold text-amber-300">{advanceReservations.length} / 2枠</span>
      </div>

      {reservations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">予約履歴</p>
          {reservations.map((r: any) => (
            <div key={r.reservationId} className="flex flex-col gap-3 rounded-lg bg-gray-800 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded px-2 py-1 text-center" style={{ background: "rgba(201,169,110,0.15)" }}>
                  <p className="text-sm font-light text-white">{r.date?.slice(5)}</p>
                  <p className="text-[10px]" style={{ color: "#C9A96E" }}>{r.date === "2026-09-08" ? "DAY1" : "DAY2"}</p>
                </div>
                <div>
                  <p className="text-sm text-white">{r.timeSlot}</p>
                  <p className="text-xs" style={{ color: "#C9A96E" }}>ブース {r.boothId}</p>
                  <p className="mt-1 text-[10px] text-gray-500">{r.bookingType === "same_day" ? "当日枠" : "事前予約"} · {r.reservationId}</p>
                  {r.cancellationReason === "booth_t1_t4_retired" && <p className="mt-1 text-[10px] text-red-300">T1～T4仕様変更によりキャンセル</p>}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className={`rounded px-2 py-1 text-[10px] ${statusStyle(r.status)}`}>{r.statusLabel || r.status}</span>
                {r.status === "confirmed" && (
                  <button onClick={() => { if (confirm("この予約をキャンセルしますか？")) cancelMut.mutate({ reservationId: r.reservationId }); }} className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-900">キャンセル</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showBooking ? (
        <button
          onClick={() => isBookingOpen && setShowBooking(true)}
          disabled={!isBookingOpen || advanceReservations.length >= 2}
          className="w-full rounded py-3 text-sm tracking-wider transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "#C9A96E", color: "#0a0a0a" }}
        >
          {!isBookingOpen ? "日本時間21:00から予約できます" : advanceReservations.length >= 2 ? "事前予約は2枠までです" : activeReservations.length > 0 ? "別の時間帯を事前予約する" : "LIVE配信ブースを事前予約する"}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[{v:"2026-09-08",l:"09.08 (Day1)"},{v:"2026-09-09",l:"09.09 (Day2)"}].map(d => (
              <button key={d.v} onClick={() => { setSelDate(d.v); setSelBooth(null); setSelTime(null); }}
                className="flex-1 rounded border py-2 text-sm transition-all"
                style={{ borderColor: selDate === d.v ? "#C9A96E" : "#444", color: selDate === d.v ? "#C9A96E" : "#888", background: selDate === d.v ? "rgba(201,169,110,0.1)" : "transparent" }}>
                {d.l}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto -mx-2 px-2">
            <div className="min-w-[600px]">
              <div className="grid gap-px" style={{ gridTemplateColumns: `60px repeat(${BOOTHS.length}, 1fr)` }}>
                <div className="p-1 text-center text-[10px] text-gray-500">TIME</div>
                {BOOTHS.map(b => <div key={b} className="p-1 text-center text-[10px]" style={{ color: "#C9A96E" }}>{b}</div>)}
              </div>
              {timeSlots.map(time => {
                const windowInfo = bookingWindows[`${selDate}_${time}`] as any;
                const isAdvanceWindow = windowInfo?.mode === "advance";
                return (
                  <div key={time} className="grid gap-px" style={{ gridTemplateColumns: `60px repeat(${BOOTHS.length}, 1fr)` }}>
                    <div className="flex items-center justify-center p-1 text-center text-[10px] text-gray-400">{time.split("-")[0]}</div>
                    {BOOTHS.map(booth => {
                      const key = `${selDate}_${booth}_${time}`;
                      const isRes = Boolean(reserved[key]);
                      const isSel = selBooth === booth && selTime === time;
                      const disabled = isRes || !isAdvanceWindow || !isBookingOpen;
                      return (
                        <button key={booth} onClick={() => { if (!disabled) { setSelBooth(booth); setSelTime(time); } }}
                          disabled={disabled} className="border p-1 text-[10px] transition-all"
                          title={!isAdvanceWindow ? "当日枠はブース前のQRコードから予約してください" : isRes ? "予約済み" : "予約可能"}
                          style={{ borderColor: isSel ? "#C9A96E" : disabled ? "#222" : "#333", background: isSel ? "rgba(201,169,110,0.2)" : disabled ? "#1a1a1a" : "transparent", color: disabled ? "#444" : isSel ? "#C9A96E" : "#777", cursor: disabled ? "not-allowed" : "pointer" }}>
                          {isRes ? "×" : isSel ? "●" : isAdvanceWindow ? "○" : "-"}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {selBooth && selTime && (
            <div className="rounded-lg border p-4 text-center" style={{ borderColor: "#C9A96E", background: "rgba(201,169,110,0.05)" }}>
              <p className="text-sm text-gray-400">{selDate.slice(5)} | {selTime} | <span style={{ color: "#C9A96E" }}>ブース {selBooth}</span></p>
              <button onClick={handleReserve} disabled={createMut.isPending || !isBookingOpen}
                className="mt-3 w-full rounded py-2.5 text-sm tracking-wider transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "#C9A96E", color: "#0a0a0a" }}>
                {createMut.isPending ? "処理中..." : "事前予約を確定する"}
              </button>
            </div>
          )}

          <button onClick={() => { setShowBooking(false); setSelBooth(null); setSelTime(null); }} className="w-full text-sm text-gray-500 transition-colors hover:text-gray-300">閉じる</button>
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
