/**
 * LCM creator workspace: editorial profile building with strict public/private separation.
 * The visual system follows LCM's bright trade-market palette and square, print-like panels.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Camera, CheckCircle2, Eye, Loader2, Save, Send, ShieldCheck, Video } from "lucide-react";
import { toast } from "sonner";
import { LcmPublicLayout } from "./LcmPublicLayout";

export type CreatorProfilePayload = {
  displayName: string;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  bio?: string | null;
  categories: string[];
  supportsLive: boolean;
  supportsShortVideo: boolean;
  languages: string[];
  activityRegions: string[];
  agencyName?: string | null;
  tiktokUrl?: string | null;
  instagramUrl?: string | null;
  youtubeUrl?: string | null;
  portfolioUrls: string[];
  followerRange: "not_disclosed" | "under_1k" | "1k_10k" | "10k_50k" | "50k_100k" | "100k_500k" | "500k_plus";
  averageViewRange: "not_disclosed" | "under_50" | "50_200" | "200_500" | "500_1000" | "1000_plus";
  performanceSummary?: string | null;
  metricsAsOf?: Date | null;
  availabilityNote?: string | null;
  acceptingOffers: boolean;
};

type CreatorWorkspaceProps = {
  membership: { displayName: string; businessName?: string | null };
  profile: any;
  defaults?: { displayName: string; agencyName: string | null; categories: string[] } | null;
  pending: boolean;
  onSave: (payload: CreatorProfilePayload) => void;
  onSubmit: () => void;
  onUpload: (file: File) => Promise<string>;
};

const statusLabels: Record<string, string> = {
  draft: "下書き",
  submitted: "運営確認中",
  published: "公開中",
  rejected: "要修正",
  suspended: "公開停止",
  archived: "非公開",
};

const followerLabels: Record<string, string> = {
  not_disclosed: "非公開",
  under_1k: "1,000未満",
  "1k_10k": "1,000〜1万",
  "10k_50k": "1万〜5万",
  "50k_100k": "5万〜10万",
  "100k_500k": "10万〜50万",
  "500k_plus": "50万以上",
};

const viewLabels: Record<string, string> = {
  not_disclosed: "非公開",
  under_50: "50未満",
  "50_200": "50〜200",
  "200_500": "200〜500",
  "500_1000": "500〜1,000",
  "1000_plus": "1,000以上",
};

const splitList = (value: string, max = 8) => [...new Set(value.split(/[、,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, max);
const joinList = (value: unknown) => Array.isArray(value) ? value.join("、") : "";
const isoDate = (value: unknown) => value ? new Date(String(value)).toISOString().slice(0, 10) : "";

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black tracking-[0.08em] text-black/60">{label}</span>{children}{note && <span className="mt-1 block text-[11px] leading-5 text-black/45">{note}</span>}</label>;
}

const inputClass = "h-12 w-full border border-black/20 bg-white px-3 text-sm outline-none focus:border-black";
const textareaClass = "min-h-28 w-full border border-black/20 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-black";

export function LcmCreatorWorkspace({ membership, profile, defaults, pending, onSave, onSubmit, onUpload }: CreatorWorkspaceProps) {
  const [displayName, setDisplayName] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [bio, setBio] = useState("");
  const [categories, setCategories] = useState("");
  const [supportsLive, setSupportsLive] = useState(false);
  const [supportsShortVideo, setSupportsShortVideo] = useState(false);
  const [languages, setLanguages] = useState("日本語");
  const [activityRegions, setActivityRegions] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [portfolioUrls, setPortfolioUrls] = useState("");
  const [followerRange, setFollowerRange] = useState<CreatorProfilePayload["followerRange"]>("not_disclosed");
  const [averageViewRange, setAverageViewRange] = useState<CreatorProfilePayload["averageViewRange"]>("not_disclosed");
  const [performanceSummary, setPerformanceSummary] = useState("");
  const [metricsAsOf, setMetricsAsOf] = useState("");
  const [availabilityNote, setAvailabilityNote] = useState("");
  const [acceptingOffers, setAcceptingOffers] = useState(true);
  const [publicConsent, setPublicConsent] = useState(false);
  const [uploading, setUploading] = useState<"profile" | "cover" | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName || defaults?.displayName || membership.displayName || "");
    setProfileImageUrl(profile?.profileImageUrl || "");
    setCoverImageUrl(profile?.coverImageUrl || "");
    setBio(profile?.bio || "");
    setCategories(joinList(profile?.categories) || joinList(defaults?.categories));
    setSupportsLive(Boolean(profile?.supportsLive));
    setSupportsShortVideo(Boolean(profile?.supportsShortVideo));
    setLanguages(joinList(profile?.languages) || "日本語");
    setActivityRegions(joinList(profile?.activityRegions));
    setAgencyName(profile?.agencyName || defaults?.agencyName || membership.businessName || "");
    setTiktokUrl(profile?.tiktokUrl || "");
    setInstagramUrl(profile?.instagramUrl || "");
    setYoutubeUrl(profile?.youtubeUrl || "");
    setPortfolioUrls(Array.isArray(profile?.portfolioUrls) ? profile.portfolioUrls.join("\n") : "");
    setFollowerRange(profile?.followerRange || "not_disclosed");
    setAverageViewRange(profile?.averageViewRange || "not_disclosed");
    setPerformanceSummary(profile?.performanceSummary || "");
    setMetricsAsOf(isoDate(profile?.metricsAsOf));
    setAvailabilityNote(profile?.availabilityNote || "");
    setAcceptingOffers(profile?.acceptingOffers ?? true);
  }, [defaults, membership.businessName, membership.displayName, profile]);

  const payload = (): CreatorProfilePayload => ({
    displayName,
    profileImageUrl: profileImageUrl || null,
    coverImageUrl: coverImageUrl || null,
    bio: bio || null,
    categories: splitList(categories),
    supportsLive,
    supportsShortVideo,
    languages: splitList(languages),
    activityRegions: splitList(activityRegions, 12),
    agencyName: agencyName || null,
    tiktokUrl: tiktokUrl || null,
    instagramUrl: instagramUrl || null,
    youtubeUrl: youtubeUrl || null,
    portfolioUrls: splitList(portfolioUrls),
    followerRange,
    averageViewRange,
    performanceSummary: performanceSummary || null,
    metricsAsOf: metricsAsOf ? new Date(`${metricsAsOf}T00:00:00+09:00`) : null,
    availabilityNote: availabilityNote || null,
    acceptingOffers,
  });

  const upload = async (file: File, kind: "profile" | "cover") => {
    setUploading(kind);
    try {
      const url = await onUpload(file);
      if (kind === "profile") setProfileImageUrl(url); else setCoverImageUrl(url);
      toast.success("画像をアップロードしました。保存すると反映されます");
    } finally {
      setUploading(null);
    }
  };

  const submit = () => {
    if (!publicConsent) return toast.error("公開同意を確認してください");
    onSubmit();
  };

  return <LcmPublicLayout><main className="mx-auto max-w-[1280px] px-5 py-10 md:px-8 md:py-16">
    <div className="flex flex-wrap items-end justify-between gap-5 border-b border-black/20 pb-6">
      <div><p className="text-xs font-black tracking-[0.18em] text-[#9b6200]">CREATOR PROFILE</p><h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">公式ページを育てる。</h1><p className="mt-3 text-sm font-medium text-black/55">{membership.displayName}｜公開する内容だけを本人が管理します</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/lcm/manage?requests=1" className="border border-black bg-white px-4 py-3 text-sm font-black">申請履歴</Link><Link href="/lcm/creators" className="inline-flex border border-black px-4 py-3 text-sm font-black">ライバーを探す<Eye className="ml-2 h-4 w-4" /></Link></div>
    </div>

    <section className="mt-8 grid gap-8 lg:grid-cols-[340px_1fr]">
      <aside className="self-start border border-black/15 bg-[#171714] p-5 text-white lg:sticky lg:top-24">
        <div className="overflow-hidden bg-[#2c2b27]">{coverImageUrl ? <img src={coverImageUrl} alt="" className="aspect-[16/7] w-full object-cover" /> : <div className="aspect-[16/7] bg-[linear-gradient(135deg,#f7cc35,#d45b16)]" />}</div>
        <div className="-mt-10 ml-4 h-24 w-24 overflow-hidden border-4 border-[#171714] bg-white">{profileImageUrl ? <img src={profileImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-black/25"><Camera className="h-8 w-8" /></div>}</div>
        <span className="mt-5 inline-flex bg-white/10 px-2.5 py-1 text-[11px] font-black">{statusLabels[profile?.status || "draft"]}</span>
        <h2 className="mt-3 text-2xl font-black">{displayName || "活動名"}</h2>
        <p className="mt-3 text-sm leading-7 text-white/60">{bio || "自己紹介を入力すると、公開ページのイメージを確認できます。"}</p>
        <div className="mt-5 flex flex-wrap gap-2">{splitList(categories).map((item) => <span key={item} className="border border-white/20 px-2 py-1 text-[11px] font-bold">{item}</span>)}</div>
        {profile?.status === "published" && <Link href={`/lcm/creators/${profile.slug}`} className="mt-6 inline-flex w-full items-center justify-center bg-[#f7cc35] px-4 py-3 text-sm font-black text-black">公開ページを見る<Eye className="ml-2 h-4 w-4" /></Link>}
      </aside>

      <form onSubmit={(event) => { event.preventDefault(); onSave(payload()); }} className="grid gap-7">
        {profile?.rejectionReason && <div className="border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800">要修正：{profile.rejectionReason}</div>}
        <div className="border border-black/15 bg-white p-5 md:p-7"><p className="text-xs font-black tracking-[0.16em] text-black/45">PROFILE</p><h2 className="mt-1 text-2xl font-black">基本プロフィール</h2><div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="活動名"><input required maxLength={255} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} /></Field>
          <Field label="所属事務所（任意）"><input maxLength={255} value={agencyName} onChange={(event) => setAgencyName(event.target.value)} className={inputClass} /></Field>
          <div className="md:col-span-2"><Field label="自己紹介"><textarea required maxLength={10000} value={bio} onChange={(event) => setBio(event.target.value)} className={textareaClass} /></Field></div>
          <Field label="得意カテゴリ" note="美容、食品、健康などを「、」区切りで最大8件"><input value={categories} onChange={(event) => setCategories(event.target.value)} className={inputClass} /></Field>
          <Field label="対応言語" note="日本語、中国語など"><input value={languages} onChange={(event) => setLanguages(event.target.value)} className={inputClass} /></Field>
          <Field label="活動地域"><input value={activityRegions} onChange={(event) => setActivityRegions(event.target.value)} placeholder="全国、東京、オンライン" className={inputClass} /></Field>
          <div className="grid content-end gap-3 border border-black/15 p-4"><span className="text-xs font-black text-black/60">対応形式</span><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={supportsLive} onChange={(event) => setSupportsLive(event.target.checked)} />LIVE配信</label><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={supportsShortVideo} onChange={(event) => setSupportsShortVideo(event.target.checked)} />ショート動画</label></div>
        </div></div>

        <div className="border border-black/15 bg-white p-5 md:p-7"><p className="text-xs font-black tracking-[0.16em] text-black/45">VISUALS</p><h2 className="mt-1 text-2xl font-black">プロフィール画像</h2><div className="mt-6 grid gap-5 md:grid-cols-2">
          <ImageUpload label="プロフィール写真" value={profileImageUrl} busy={uploading === "profile"} aspect="square" onUpload={(file) => upload(file, "profile")} />
          <ImageUpload label="カバー画像" value={coverImageUrl} busy={uploading === "cover"} aspect="wide" onUpload={(file) => upload(file, "cover")} />
        </div></div>

        <div className="border border-black/15 bg-white p-5 md:p-7"><p className="text-xs font-black tracking-[0.16em] text-black/45">CHANNELS</p><h2 className="mt-1 text-2xl font-black">公式SNS・実績</h2><div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="TikTok URL"><input required type="url" value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} placeholder="https://www.tiktok.com/@..." className={inputClass} /></Field>
          <Field label="Instagram URL（任意）"><input type="url" value={instagramUrl} onChange={(event) => setInstagramUrl(event.target.value)} className={inputClass} /></Field>
          <Field label="YouTube URL（任意）"><input type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} className={inputClass} /></Field>
          <Field label="実績・作品URL（任意）" note="1行または「、」区切りで最大8件"><textarea value={portfolioUrls} onChange={(event) => setPortfolioUrls(event.target.value)} className={textareaClass} /></Field>
          <Field label="フォロワー帯"><select value={followerRange} onChange={(event) => setFollowerRange(event.target.value as CreatorProfilePayload["followerRange"])} className={inputClass}>{Object.entries(followerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="平均LIVE視聴帯"><select value={averageViewRange} onChange={(event) => setAverageViewRange(event.target.value as CreatorProfilePayload["averageViewRange"])} className={inputClass}>{Object.entries(viewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <div className="md:col-span-2"><Field label="配信・販売実績（任意）" note="本人申告として表示され、運営確認後のみ確認済み表示になります"><textarea value={performanceSummary} onChange={(event) => setPerformanceSummary(event.target.value)} className={textareaClass} /></Field></div>
          <Field label="実績情報の基準日（任意）"><input type="date" value={metricsAsOf} onChange={(event) => setMetricsAsOf(event.target.value)} className={inputClass} /></Field>
          <Field label="対応可能時期・条件（任意）"><textarea value={availabilityNote} onChange={(event) => setAvailabilityNote(event.target.value)} className={textareaClass} /></Field>
        </div></div>

        <div className="border border-black/15 bg-white p-5 md:p-7"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#126445]" /><div><h2 className="text-xl font-black">公開・商談設定</h2><p className="mt-2 text-xs leading-6 text-black/55">本名、メール、電話、住所、申込原文は公開されません。公開ページには上のフォームで入力した情報だけが掲載されます。</p></div></div><label className="mt-5 flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={acceptingOffers} onChange={(event) => setAcceptingOffers(event.target.checked)} />企業からの商談相談を受け付ける</label><label className="mt-5 flex items-start gap-3 border-t border-black/10 pt-5 text-xs leading-6"><input type="checkbox" checked={publicConsent} onChange={(event) => setPublicConsent(event.target.checked)} className="mt-1" /><span>入力した公開用プロフィールを一般公開し、LCM内の検索・検索エンジンへ掲載することに同意します。提出後、運営確認を経て公開されます。</span></label></div>

        <div className="flex flex-wrap justify-end gap-3"><button type="submit" disabled={pending || Boolean(uploading)} className="inline-flex items-center border border-black bg-white px-6 py-4 text-sm font-black disabled:opacity-40">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}下書きを保存</button>{profile && ["draft", "rejected"].includes(profile.status) && <button type="button" disabled={pending || !publicConsent} onClick={submit} className="inline-flex items-center bg-[#171714] px-6 py-4 text-sm font-black text-white disabled:opacity-40"><Send className="mr-2 h-4 w-4" />公開審査へ提出</button>}</div>
      </form>
    </section>
  </main></LcmPublicLayout>;
}

function ImageUpload({ label, value, busy, aspect, onUpload }: { label: string; value: string; busy: boolean; aspect: "square" | "wide"; onUpload: (file: File) => void }) {
  return <div><p className="mb-2 text-xs font-black tracking-[0.08em] text-black/60">{label}</p><label className="group block cursor-pointer border border-dashed border-black/25 bg-[#f6f4ee] p-3"><div className={`${aspect === "square" ? "aspect-square max-w-56" : "aspect-[16/7]"} mx-auto overflow-hidden bg-white`}>{value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-black/25"><Camera className="h-8 w-8" /></div>}</div><span className="mt-3 flex items-center justify-center text-xs font-black">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}JPEG・PNG・WebP／5MB以下</span><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} /></label></div>;
}
