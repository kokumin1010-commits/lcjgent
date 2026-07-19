/**
 * Live Commerce Festival - マイページ（充実版）
 * 申し込み内容表示・イベント情報・カウントダウン・準備チェックリスト
 */
import { useState, useEffect } from 'react';
import { LogOut, User, Building2, Mic2, Users, Key, Loader2, CheckCircle2, Calendar, MapPin, ExternalLink, ChevronDown, ChevronUp, PartyPopper, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'wouter';
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
  const logoutMutation = trpc.festivalAuth.logout.useMutation({
    onSuccess: () => setLocation('/lcf/login'),
  });

  // Password change
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const changePwMutation = trpc.festivalAuth.changePassword.useMutation({
    onSuccess: () => {
      setPwMsg('パスワードを変更しました');
      setCurrentPw('');
      setNewPw('');
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
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <Calendar className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Day 1: 2026年9月8日（火）</p>
                <p className="text-gray-400">13:00〜20:30（アフターパーティー含む）</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
              <Calendar className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Day 2: 2026年9月9日（水）</p>
                <p className="text-gray-400">10:00〜18:00</p>
              </div>
            </div>
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
                placeholder="新しいパスワード（6文字以上）"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              {pwMsg && <p className="text-sm text-amber-400">{pwMsg}</p>}
              <button
                onClick={() => changePwMutation.mutate({ currentPassword: currentPw, newPassword: newPw })}
                disabled={!currentPw || newPw.length < 6 || changePwMutation.isPending}
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
        <DetailRow label="参加日程" value={scheduleLabels[app.attendanceSchedule || app.attendance_schedule] || '-'} />
        <DetailRow label="マッチング希望" value={(app.matchingPreference || app.matching_preference) === 'yes' ? 'あり' : 'なし'} />
      </DetailSection>
    </div>
  );
}

/* ─── General Application Details ─── */
function GeneralDetails({ app }: { app: any }) {
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
        <DetailRow label="参加日程" value={scheduleLabels[app.attendanceSchedule || app.attendance_schedule] || '-'} />
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
