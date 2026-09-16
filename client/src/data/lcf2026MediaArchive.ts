/**
 * Verified LCF 2026 media archive.
 * Sources were checked on 2026-09-16; preview images are locally preserved first-view snapshots.
 * Full copyrighted article text is not stored. Original links remain the authoritative source.
 */
import archive from "./lcf2026MediaArchive.generated.json";

export type LcfMediaPageStatus = "verified" | "unavailable";
export type LcfMediaSourceType = "official" | "original" | "syndicated";
export type LcfMediaPage = {
  id: string;
  groupId: string;
  outlet: string;
  date: string;
  title: string;
  url: string;
  sourceType: LcfMediaSourceType;
  status: LcfMediaPageStatus;
  checkedAt: string;
  archivedAt: string;
  previewSrc: string;
  assetName: string;
  previewStatus: "captured" | "representative";
};
export type LcfMediaArchiveGroup = {
  id: string;
  category: string;
  title: string;
  summary: string;
  featured: boolean;
  date: string;
  primaryPageId: string;
  pages: LcfMediaPage[];
};

export const lcf2026MediaArchive = archive as {
  checkedAt: string;
  articleGroupCount: number;
  publicationPageCount: number;
  outletCount: number;
  outlets: string[];
  groups: LcfMediaArchiveGroup[];
};
