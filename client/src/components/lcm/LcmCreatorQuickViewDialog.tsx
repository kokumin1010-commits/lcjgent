/**
 * LCM creator quick view: industrial editorial dialog for comparing only
 * consented, published profile fields without leaving the current page.
 */
import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ExternalLink,
  Globe2,
  Loader2,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type PublicCreator = RouterOutputs["lcm"]["listPublicCreators"][number];

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSlug?: string | null;
  creators?: PublicCreator[];
};

export function LcmCreatorQuickViewDialog({
  open,
  onOpenChange,
  initialSlug = null,
  creators,
}: Props) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug);
  const directory = trpc.lcm.listPublicCreators.useQuery(
    { limit: 24 },
    { enabled: open && !creators, retry: false }
  );

  useEffect(() => {
    if (open) setSelectedSlug(initialSlug);
  }, [initialSlug, open]);

  const availableCreators = creators ?? directory.data ?? [];
  const selectedIndex = useMemo(
    () => availableCreators.findIndex(creator => creator.slug === selectedSlug),
    [availableCreators, selectedSlug]
  );
  const profile = trpc.lcm.getPublicCreator.useQuery(
    { slug: selectedSlug || "" },
    { enabled: open && Boolean(selectedSlug), retry: false }
  );

  const showPrevious = selectedIndex > 0;
  const showNext =
    selectedIndex >= 0 && selectedIndex < availableCreators.length - 1;
  const move = (direction: -1 | 1) => {
    const next = availableCreators[selectedIndex + direction];
    if (next) setSelectedSlug(next.slug);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onEscapeKeyDown={() => onOpenChange(false)} className="max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden border-black/20 bg-[#fffdf8] p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-black/15 px-5 py-4 pr-14 text-left md:px-7">
          <p className="text-[10px] font-black tracking-[0.18em] text-[#9b6200]">
            LCM CREATOR QUICK VIEW
          </p>
          <DialogTitle className="text-xl font-black md:text-2xl">
            {selectedSlug
              ? "ライブコマーサー公式プロフィール"
              : "ライブコマーサーを選ぶ"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-5 text-black/50">
            本人の公開同意とLCM運営確認が完了した情報だけを表示します。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(100dvh-8.5rem)] overflow-y-auto">
          {selectedSlug ? (
            <CreatorDetail
              creator={profile.data}
              loading={profile.isLoading}
              error={profile.isError}
              showPrevious={showPrevious}
              showNext={showNext}
              onPrevious={() => move(-1)}
              onNext={() => move(1)}
              onBack={() => setSelectedSlug(null)}
            />
          ) : (
            <CreatorChooser
              creators={availableCreators}
              loading={directory.isLoading && !creators}
              error={directory.isError && !creators}
              onSelect={setSelectedSlug}
              onRetry={() => directory.refetch()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreatorChooser({
  creators,
  loading,
  error,
  onSelect,
  onRetry,
}: {
  creators: PublicCreator[];
  loading: boolean;
  error: boolean;
  onSelect: (slug: string) => void;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <div className="grid min-h-80 place-items-center">
        <Loader2
          className="h-8 w-8 animate-spin text-[#d45b16]"
          aria-label="読み込み中"
        />
      </div>
    );
  if (error)
    return (
      <div className="grid min-h-80 place-items-center px-6 text-center">
        <div>
          <Users className="mx-auto h-10 w-10 text-black/20" />
          <p className="mt-4 font-black">
            公開プロフィールを読み込めませんでした
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 bg-[#171714] px-5 py-3 text-sm font-black text-white"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  if (!creators.length)
    return (
      <div className="grid min-h-80 place-items-center px-6 text-center">
        <div>
          <Users className="mx-auto h-10 w-10 text-black/20" />
          <p className="mt-4 font-black">
            公開中のプロフィールはまだありません
          </p>
          <p className="mt-2 text-xs leading-6 text-black/50">
            本人の提出と運営確認が完了した方から表示します。
          </p>
        </div>
      </div>
    );

  return (
    <div className="grid gap-px bg-black/15 sm:grid-cols-2 lg:grid-cols-3">
      {creators.map(creator => {
        const categories = Array.isArray(creator.categories)
          ? creator.categories
          : [];
        return (
          <button
            key={creator.id}
            type="button"
            onClick={() => onSelect(creator.slug)}
            className="group bg-white text-left focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f7cc35]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-[#e9e4d8]">
              {creator.profileImageUrl ? (
                <img
                  src={creator.profileImageUrl}
                  alt={creator.displayName}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]"
                  loading="lazy"
                />
              ) : (
                <div className="grid h-full place-items-center text-6xl font-black text-black/15">
                  {String(creator.displayName).slice(0, 1)}
                </div>
              )}
              {creator.acceptingOffers && (
                <span className="absolute left-3 top-3 bg-[#f7cc35] px-2.5 py-1 text-[10px] font-black">
                  商談相談受付中
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-[10px] font-black tracking-[0.1em] text-black/40">
                {[
                  creator.supportsLive && "LIVE",
                  creator.supportsShortVideo && "SHORT VIDEO",
                ]
                  .filter(Boolean)
                  .join(" / ") || "CREATOR"}
              </p>
              <h3 className="mt-2 text-xl font-black">{creator.displayName}</h3>
              {creator.agencyName && (
                <p className="mt-1 text-xs font-bold text-black/45">
                  {creator.agencyName}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {categories.slice(0, 3).map((item: string) => (
                  <span
                    key={item}
                    className="bg-[#f0ede5] px-2 py-1 text-[10px] font-black"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-black">
                ポップアップで見る
                <ArrowRight className="ml-1 h-4 w-4" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CreatorDetail({
  creator,
  loading,
  error,
  showPrevious,
  showNext,
  onPrevious,
  onNext,
  onBack,
}: {
  creator: RouterOutputs["lcm"]["getPublicCreator"] | undefined;
  loading: boolean;
  error: boolean;
  showPrevious: boolean;
  showNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  if (loading)
    return (
      <div className="grid min-h-[480px] place-items-center">
        <Loader2
          className="h-8 w-8 animate-spin text-[#d45b16]"
          aria-label="読み込み中"
        />
      </div>
    );
  if (error || !creator)
    return (
      <div className="grid min-h-80 place-items-center px-6 text-center">
        <div>
          <p className="font-black">プロフィールを表示できませんでした</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-5 border-b border-black pb-1 text-sm font-black"
          >
            一覧へ戻る
          </button>
        </div>
      </div>
    );

  const categories = Array.isArray(creator.categories)
    ? creator.categories
    : [];
  const languages = Array.isArray(creator.languages) ? creator.languages : [];
  const regions = Array.isArray(creator.activityRegions)
    ? creator.activityRegions
    : [];
  const socialLinks = [
    { label: "TikTok", url: creator.tiktokUrl },
    { label: "Instagram", url: creator.instagramUrl },
    { label: "YouTube", url: creator.youtubeUrl },
  ].filter((item): item is { label: string; url: string } => Boolean(item.url));

  return (
    <div>
      <div className="grid bg-[#171714] text-white md:grid-cols-[300px_1fr]">
        <div className="aspect-[4/3] overflow-hidden bg-white/10 md:aspect-auto md:min-h-[420px]">
          {creator.profileImageUrl ? (
            <img
              src={creator.profileImageUrl}
              alt={creator.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full min-h-72 place-items-center text-8xl font-black text-white/15">
              {String(creator.displayName).slice(0, 1)}
            </div>
          )}
        </div>
        <div className="p-5 md:p-8">
          <div className="flex flex-wrap gap-2">
            {creator.acceptingOffers && (
              <span className="bg-[#f7cc35] px-3 py-1.5 text-[10px] font-black text-black">
                商談相談受付中
              </span>
            )}
            <span className="border border-white/25 px-3 py-1.5 text-[10px] font-black">
              本人公開同意・運営確認済み
            </span>
          </div>
          <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] md:text-5xl">
            {creator.displayName}
          </h2>
          {creator.agencyName && (
            <p className="mt-2 text-sm font-bold text-white/50">
              {creator.agencyName}
            </p>
          )}
          <p className="mt-5 whitespace-pre-line text-sm leading-7 text-white/70">
            {creator.bio || "プロフィール情報を準備しています。"}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((item: string) => (
              <span
                key={item}
                className="border border-white/20 px-2.5 py-1 text-[11px] font-black"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-7 grid gap-px bg-white/15 sm:grid-cols-2">
            <QuickInfo
              icon={<Radio />}
              label="配信形式"
              value={
                [
                  creator.supportsLive && "LIVE",
                  creator.supportsShortVideo && "ショート動画",
                ]
                  .filter(Boolean)
                  .join("・") || "未設定"
              }
            />
            <QuickInfo
              icon={<Globe2 />}
              label="対応言語"
              value={languages.length ? languages.join("・") : "未設定"}
            />
            <QuickInfo
              icon={<CalendarDays />}
              label="活動地域"
              value={regions.length ? regions.join("・") : "オンライン相談"}
            />
            <QuickInfo
              icon={<Users />}
              label="フォロワー帯"
              value={followerLabels[creator.followerRange] || "非公開"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-black/15 md:grid-cols-[1fr_280px]">
        <div className="bg-[#fffdf8] p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-[0.16em] text-[#9b6200]">
                PUBLIC PERFORMANCE
              </p>
              <h3 className="mt-1 text-2xl font-black">公開実績・対応条件</h3>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1.5 text-[10px] font-black ${creator.metricsVerification === "verified" ? "bg-[#dff5ea] text-[#126445]" : "bg-[#eeeae0] text-black/60"}`}
            >
              <ShieldCheck className="mr-1.5 h-4 w-4" />
              {creator.metricsVerification === "verified"
                ? "運営確認済み"
                : "本人申告"}
            </span>
          </div>
          <div className="mt-5 grid gap-px bg-black/15 sm:grid-cols-2">
            <InfoBlock
              label="フォロワー帯"
              value={followerLabels[creator.followerRange] || "非公開"}
            />
            <InfoBlock
              label="平均LIVE視聴帯"
              value={viewLabels[creator.averageViewRange] || "非公開"}
            />
          </div>
          {creator.performanceSummary && (
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-black/65">
              {creator.performanceSummary}
            </p>
          )}
          {creator.availabilityNote && (
            <div className="mt-5 border-l-4 border-[#f7cc35] bg-[#f4f1e9] p-4">
              <p className="text-[10px] font-black tracking-[0.1em] text-black/45">
                対応可能時期・条件
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-7">
                {creator.availabilityNote}
              </p>
            </div>
          )}
        </div>
        <aside className="bg-white p-5 md:p-7">
          <p className="text-[10px] font-black tracking-[0.16em] text-black/40">
            OFFICIAL CHANNELS
          </p>
          {socialLinks.length ? (
            <div className="mt-3 grid gap-2">
              {socialLinks.map(item => (
                <a
                  key={item.label}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between border-b border-black/10 py-3 text-sm font-black"
                >
                  {item.label}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-6 text-black/45">
              公開中の外部チャンネルはありません。
            </p>
          )}
          <a
            href={`/lcm/creators/${creator.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center bg-[#171714] px-4 py-3 text-xs font-black text-white"
          >
            個別URLを新しいタブで開く
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/15 bg-[#f4f1e9] p-4 md:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center border-b border-black pb-1 text-xs font-black"
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          一覧に戻る
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!showPrevious}
            className="inline-flex items-center border border-black bg-white px-4 py-2.5 text-xs font-black disabled:opacity-30"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            前の人
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!showNext}
            className="inline-flex items-center bg-[#f7cc35] px-4 py-2.5 text-xs font-black disabled:opacity-30"
          >
            次の人
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/5 p-4">
      <div className="flex items-center gap-2 text-[#f7cc35]">
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <span className="text-[10px] font-black tracking-[0.1em] text-white/45">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-black">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-[10px] font-black tracking-[0.1em] text-black/40">
        {label}
      </p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}
