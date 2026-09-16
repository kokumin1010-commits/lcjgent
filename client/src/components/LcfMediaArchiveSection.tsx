import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Files,
  Newspaper,
  X,
} from "lucide-react";
import {
  lcf2026MediaArchive,
  type LcfMediaArchiveGroup,
  type LcfMediaPage,
} from "@/data/lcf2026MediaArchive";

type MediaFilter = "all" | "coverage" | "official";

const filters: Array<{ id: MediaFilter; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "coverage", label: "独自取材・インタビュー" },
  { id: "official", label: "公式発表・開催レポート" },
];

function groupKind(group: LcfMediaArchiveGroup): Exclude<MediaFilter, "all"> {
  return group.id.startsWith("nac-") ||
    group.id === "event-result" ||
    group.id.startsWith("sponsor-")
    ? "official"
    : "coverage";
}

function primaryPage(group: LcfMediaArchiveGroup) {
  return (
    group.pages.find(page => page.id === group.primaryPageId) ?? group.pages[0]
  );
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
                ? "この配信先は自動取得を制限しているため、同一稿件の代表記事プレビューを表示しています。"
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

function MediaGroupCard({
  group,
  expanded,
  onToggle,
  onPreview,
}: {
  group: LcfMediaArchiveGroup;
  expanded: boolean;
  onToggle: () => void;
  onPreview: (page: LcfMediaPage) => void;
}) {
  const primary = primaryPage(group);
  const distributedCount = Math.max(0, group.pages.length - 1);

  return (
    <article className="overflow-hidden border border-white/18 bg-white/[0.025]">
      <button
        type="button"
        onClick={() => onPreview(primary)}
        className="group relative block aspect-[16/9] w-full overflow-hidden border-b border-white/15 bg-white/[0.04] text-left"
        aria-label={`${primary.outlet}の保存プレビューを見る`}
      >
        <img
          src={primary.previewSrc}
          alt={`${primary.outlet}掲載ページの保存プレビュー`}
          width={1200}
          height={675}
          loading="lazy"
          className="h-full w-full object-cover object-top opacity-80 transition duration-500 group-hover:scale-[1.015] group-hover:opacity-100"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 bg-black/75 px-3 py-2 text-[10px] font-black tracking-[0.1em] text-white backdrop-blur">
          <Eye size={14} /> 保存プレビュー
        </span>
      </button>

      <div className="flex min-h-[330px] flex-col p-6 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-black tracking-[0.13em]">
          <span className="text-[#f2cb3c]">{primary.outlet}</span>
          <span className="text-white/35">
            {group.category} / {group.date}
          </span>
        </div>
        <h3 className="mt-6 text-xl font-black leading-8 text-white/92 md:text-2xl">
          {group.title}
        </h3>
        <p className="mt-4 text-sm leading-7 text-white/48">{group.summary}</p>

        <div className="mt-6 flex flex-wrap gap-2 text-[10px] font-black">
          <span className="inline-flex items-center gap-1.5 border border-emerald-400/25 bg-emerald-400/8 px-2.5 py-1.5 text-emerald-300">
            <CheckCircle2 size={13} /> {lcf2026MediaArchive.checkedAt} 原文確認
          </span>
          <span className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1.5 text-white/55">
            <Archive size={13} /> 画面保存済み
          </span>
          {distributedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1.5 text-white/55">
              <Files size={13} /> 配信先 {distributedCount}件
            </span>
          )}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-white/10 pt-6">
          <button
            type="button"
            onClick={() => onPreview(primary)}
            className="inline-flex items-center justify-center gap-2 border border-white/20 px-3 py-3 text-xs font-black text-white/70 transition-colors hover:border-white hover:text-white"
          >
            保存画面を見る <Eye size={15} />
          </button>
          <a
            href={primary.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 border border-[#f2cb3c]/55 px-3 py-3 text-xs font-black text-[#f2cb3c] transition-colors hover:bg-[#f2cb3c] hover:text-black"
          >
            原文を読む <ArrowUpRight size={15} />
          </a>
        </div>
      </div>

      {group.pages.length > 1 && (
        <div className="border-t border-white/15">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left text-xs font-black text-white/60 transition-colors hover:bg-white/[0.035] hover:text-white md:px-7"
          >
            <span>
              同じ内容の掲載・配信先をすべて見る（{group.pages.length}ページ）
            </span>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {expanded && (
            <div className="border-t border-white/10 bg-black/25 p-4 md:p-5">
              <div className="grid gap-3">
                {group.pages.map(page => (
                  <div
                    key={page.id}
                    className="grid gap-3 border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center"
                  >
                    <button
                      type="button"
                      onClick={() => onPreview(page)}
                      className="group relative overflow-hidden bg-white/5"
                      aria-label={`${page.outlet}の保存プレビューを見る`}
                    >
                      <img
                        src={page.previewSrc}
                        alt=""
                        width={1200}
                        height={675}
                        loading="lazy"
                        className="aspect-video h-full w-full object-cover object-top opacity-75 group-hover:opacity-100"
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                        <Eye size={18} />
                      </span>
                    </button>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-[0.08em]">
                        <span className="text-[#f2cb3c]">{page.outlet}</span>
                        <span className="text-white/30">
                          {sourceLabel(page.sourceType)}
                        </span>
                        <span className="text-white/30">{page.date}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-white/70">
                        {page.title}
                      </p>
                      {page.previewStatus === "representative" && (
                        <p className="mt-1 text-[10px] text-white/35">
                          同一稿件の代表プレビュー
                        </p>
                      )}
                    </div>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-black text-white/55 hover:text-[#f2cb3c]"
                    >
                      原文 <ArrowUpRight size={14} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function LcfMediaArchiveSection() {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
  );
  const [activePage, setActivePage] = useState<LcfMediaPage | null>(null);

  const visibleGroups = useMemo(
    () =>
      filter === "all"
        ? lcf2026MediaArchive.groups
        : lcf2026MediaArchive.groups.filter(
            group => groupKind(group) === filter
          ),
    [filter]
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
              独自取材、インタビュー、運営発表、各ニュース媒体への配信まで、一件ずつ原文を確認して保存しました。元記事が将来非公開になっても、掲載確認時の画面と出典情報をこのページで振り返れます。
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
                  {lcf2026MediaArchive.articleGroupCount}
                </p>
                <p className="mt-1 text-[10px] font-black tracking-[0.1em] text-white/38">
                  STORIES
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          className="mt-10 flex flex-wrap gap-2"
          aria-label="メディア記事カテゴリー"
        >
          {filters.map(item => {
            const selected = filter === item.id;
            const count =
              item.id === "all"
                ? lcf2026MediaArchive.groups.length
                : lcf2026MediaArchive.groups.filter(
                    group => groupKind(group) === item.id
                  ).length;
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

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {visibleGroups.map(group => (
            <MediaGroupCard
              key={group.id}
              group={group}
              expanded={expandedGroups.has(group.id)}
              onToggle={() =>
                setExpandedGroups(current => {
                  const next = new Set(current);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                })
              }
              onPreview={setActivePage}
            />
          ))}
        </div>

        <div className="mt-10 grid gap-6 border border-white/15 p-6 md:grid-cols-[auto_1fr] md:items-start md:p-8">
          <Newspaper className="text-[#f2cb3c]" size={26} />
          <div>
            <p className="text-sm font-black">掲載記録の見方</p>
            <p className="mt-3 max-w-5xl text-xs leading-6 text-white/42">
              同じ稿件が複数媒体へ配信された場合は、一つの記事グループにまとめ、各掲載ページを展開できる形にしています。保存プレビューは掲載確認時の低解像度首画面であり、記事本文や写真の転載ではありません。原文の著作権は各媒体・提供元に帰属します。原文の公開状況は確認日以降に変わる場合があります。
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
