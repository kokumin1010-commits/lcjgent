import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  Eye,
  Newspaper,
  X,
} from "lucide-react";
import {
  lcf2026MediaArchive,
  type LcfMediaArchiveGroup,
  type LcfMediaPage,
} from "@/data/lcf2026MediaArchive";

type MediaFilter = "all" | "coverage" | "official";

type VisibleMediaPage = {
  group: LcfMediaArchiveGroup;
  page: LcfMediaPage;
};

const filters: Array<{ id: MediaFilter; label: string }> = [
  { id: "all", label: "すべての掲載ページ" },
  { id: "coverage", label: "独自取材・インタビュー" },
  { id: "official", label: "公式発表・開催レポート" },
];

function groupKind(group: LcfMediaArchiveGroup): Exclude<MediaFilter, "all"> {
  return group.id.startsWith("nac-") ||
    group.id === "event-announcement" ||
    group.id === "event-result" ||
    group.id === "lcj-official-report" ||
    group.id.startsWith("sponsor-")
    ? "official"
    : "coverage";
}

function sourceLabel(sourceType: LcfMediaPage["sourceType"]) {
  if (sourceType === "official") return "公式";
  if (sourceType === "original") return "独自記事";
  return "配信・転載";
}

function MediaPreviewDialog({
  page,
  onClose,
}: {
  page: LcfMediaPage;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/95 p-3 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${page.outlet}の保存プレビュー`}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-12 w-12 place-items-center border border-white/30 bg-black/60 text-white"
        aria-label="閉じる"
      >
        <X size={22} />
      </button>
      <div
        className="w-full max-w-6xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="overflow-hidden border border-white/15 bg-white">
          <img
            src={page.previewSrc}
            alt={`${page.outlet}掲載ページの2026年9月16日時点保存プレビュー`}
            width={1200}
            height={675}
            className="aspect-video h-auto w-full object-cover object-top"
          />
        </div>
        <div className="mt-4 flex flex-col gap-4 text-white md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-[0.14em] text-[#f2cb3c]">
              <span>{page.outlet}</span>
              <span className="text-white/25">/</span>
              <span className="text-white/55">
                {sourceLabel(page.sourceType)}
              </span>
              <span className="text-white/25">/</span>
              <span className="text-white/55">保存日 {page.archivedAt}</span>
            </div>
            <h3 className="mt-3 max-w-4xl text-xl font-black leading-8 md:text-2xl">
              {page.title}
            </h3>
            <p className="mt-2 text-xs leading-6 text-white/45">
              {page.previewStatus === "representative"
                ? "この配信先は自動取得を制限しているため、同一記事の代表プレビューを表示しています。"
                : "原文が将来非公開になった場合に備え、掲載確認時の首画面を低解像度で保存しています。"}
            </p>
          </div>
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#f2cb3c] px-5 py-3 text-xs font-black text-[#f2cb3c] transition-colors hover:bg-[#f2cb3c] hover:text-black"
          >
            原文を開く <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}

function MediaPageCard({
  item,
  onPreview,
}: {
  item: VisibleMediaPage;
  onPreview: (page: LcfMediaPage) => void;
}) {
  const { group, page } = item;
  const sameStoryCount = group.pages.length;

  return (
    <article className="flex h-full flex-col overflow-hidden border border-white/18 bg-white/[0.025]">
      <button
        type="button"
        onClick={() => onPreview(page)}
        className="group relative block aspect-[16/9] w-full overflow-hidden border-b border-white/15 bg-white/[0.04] text-left"
        aria-label={`${page.outlet}の保存プレビューを見る`}
      >
        <img
          src={page.previewSrc}
          alt={`${page.outlet}掲載ページの保存プレビュー`}
          width={1200}
          height={675}
          loading="lazy"
          className="h-full w-full object-cover object-top opacity-82 transition duration-500 group-hover:scale-[1.015] group-hover:opacity-100"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-2 bg-black/78 px-3 py-2 text-[10px] font-black tracking-[0.1em] text-white backdrop-blur">
          <Eye size={14} /> 保存プレビュー
        </span>
        <span className="absolute right-3 top-3 border border-white/20 bg-black/75 px-2.5 py-1.5 text-[9px] font-black tracking-[0.08em] text-white/70 backdrop-blur">
          {sourceLabel(page.sourceType)}
        </span>
      </button>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2 text-[10px] font-black tracking-[0.11em]">
          <span className="text-[#f2cb3c]">{page.outlet}</span>
          <span className="text-white/35">{page.date || group.date}</span>
        </div>
        <h3 className="mt-4 text-lg font-black leading-7 text-white/92">
          {page.title}
        </h3>
        <div className="mt-4 border-l-2 border-[#f2cb3c]/45 pl-3">
          <p className="text-[10px] font-black tracking-[0.08em] text-white/35">
            同一記事グループ
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-white/58">
            {group.title}
          </p>
          {sameStoryCount > 1 && (
            <p className="mt-1 text-[10px] text-white/30">
              同内容を{sameStoryCount}媒体・掲載ページで確認
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-black">
          <span className="inline-flex items-center gap-1.5 border border-emerald-400/25 bg-emerald-400/8 px-2.5 py-1.5 text-emerald-300">
            <CheckCircle2 size={13} /> {page.checkedAt} 原文確認
          </span>
          <span className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1.5 text-white/55">
            <Archive size={13} />
            {page.previewStatus === "representative"
              ? "代表画面保存"
              : "画面保存済み"}
          </span>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={() => onPreview(page)}
            className="inline-flex items-center justify-center gap-2 border border-white/20 px-3 py-3 text-xs font-black text-white/70 transition-colors hover:border-white hover:text-white"
          >
            保存画面 <Eye size={15} />
          </button>
          <a
            href={page.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 border border-[#f2cb3c]/55 px-3 py-3 text-xs font-black text-[#f2cb3c] transition-colors hover:bg-[#f2cb3c] hover:text-black"
          >
            原文 <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </article>
  );
}

export default function LcfMediaArchiveSection() {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [activePage, setActivePage] = useState<LcfMediaPage | null>(null);

  const allPages = useMemo<VisibleMediaPage[]>(
    () =>
      lcf2026MediaArchive.groups.flatMap(group =>
        group.pages.map(page => ({ group, page }))
      ),
    []
  );

  const visiblePages = useMemo(
    () =>
      filter === "all"
        ? allPages
        : allPages.filter(item => groupKind(item.group) === filter),
    [allPages, filter]
  );

  const closePreview = () => setActivePage(null);

  useEffect(() => {
    if (!activePage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePreview();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activePage]);

  return (
    <section
      id="media-archive"
      className="bg-[#111] px-5 py-24 text-white md:px-10 md:py-32"
    >
      <div className="mx-auto max-w-[1500px]">
        <div className="grid gap-10 border-t border-white/20 pt-7 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="text-xs font-black tracking-[0.22em] text-[#f2cb3c]">
              MEDIA ARCHIVE / VERIFIED 2026.09.16
            </p>
            <h2 className="mt-5 text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">
              メディアが捉えた、
              <br />
              第1回LCF。
            </h2>
          </div>
          <div className="lg:pt-2">
            <p className="max-w-4xl text-base leading-8 text-white/62">
              独自取材、インタビュー、運営発表、各ニュース媒体への配信まで、確認できた掲載ページを折りたたまず全件表示しています。元記事が将来非公開になっても、掲載確認時の画面と出典情報をこのページで振り返れます。
            </p>
            <div className="mt-7 grid grid-cols-3 border-y border-white/15 py-5">
              <div>
                <p className="text-3xl font-black text-[#f2cb3c] md:text-4xl">
                  {lcf2026MediaArchive.outletCount}
                </p>
                <p className="mt-1 text-[10px] font-black tracking-[0.1em] text-white/38">
                  MEDIA
                </p>
              </div>
              <div className="border-l border-white/15 pl-4 md:pl-6">
                <p className="text-3xl font-black text-[#f2cb3c] md:text-4xl">
                  {lcf2026MediaArchive.publicationPageCount}
                </p>
                <p className="mt-1 text-[10px] font-black tracking-[0.1em] text-white/38">
                  PAGES
                </p>
              </div>
              <div className="border-l border-white/15 pl-4 md:pl-6">
                <p className="text-3xl font-black text-[#f2cb3c] md:text-4xl">
                  {lcf2026MediaArchive.publicationPageCount}
                </p>
                <p className="mt-1 text-[10px] font-black tracking-[0.1em] text-white/38">
                  ALL LISTED
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-10 flex flex-wrap gap-2"
          aria-label="メディア掲載ページカテゴリー"
        >
          {filters.map(item => {
            const selected = filter === item.id;
            const count =
              item.id === "all"
                ? allPages.length
                : allPages.filter(page => groupKind(page.group) === item.id)
                    .length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={selected}
                className={`border px-4 py-3 text-xs font-black transition-colors ${selected ? "border-[#f2cb3c] bg-[#f2cb3c] text-black" : "border-white/20 text-white/60 hover:border-white hover:text-white"}`}
              >
                {item.label}{" "}
                <span className={selected ? "text-black/50" : "text-white/30"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-xs font-bold tracking-[0.06em] text-white/38">
          表示中 {visiblePages.length} / {allPages.length} 掲載ページ
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visiblePages.map(item => (
            <MediaPageCard
              key={`${item.group.id}-${item.page.id}`}
              item={item}
              onPreview={setActivePage}
            />
          ))}
        </div>

        <div className="mt-10 grid gap-6 border border-white/15 p-6 md:grid-cols-[auto_1fr] md:items-start md:p-8">
          <Newspaper className="text-[#f2cb3c]" size={26} />
          <div>
            <p className="text-sm font-black">掲載記録の見方</p>
            <p className="mt-3 max-w-5xl text-xs leading-6 text-white/42">
              同じ記事が複数媒体へ配信された場合も、媒体実績として各掲載ページを一枚ずつ表示し、「同一記事グループ」で関係を明示しています。保存プレビューは掲載確認時の低解像度首画面であり、記事本文や写真の転載ではありません。原文の著作権は各媒体・提供元に帰属し、公開状況は確認日以降に変わる場合があります。
            </p>
          </div>
        </div>
      </div>

      {activePage && (
        <MediaPreviewDialog page={activePage} onClose={closePreview} />
      )}
    </section>
  );
}
