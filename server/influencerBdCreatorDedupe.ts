export type InfluencerCreatorDedupeRow = {
  id: number;
  displayName: string | null;
  platform: string;
  handle: string | null;
  normalizedHandle: string | null;
  profileUrl?: string | null;
  followerCount?: number | string | null;
  category?: string | null;
  country?: string | null;
  language?: string | null;
  contactInfo?: string | null;
  ownerStaffId?: number | string | null;
  ownerStaffName?: string | null;
  status?: string | null;
  notes?: string | null;
  lastContactAt?: Date | string | null;
  lastReplyAt?: Date | string | null;
  deletedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  outreachCount?: number | string | null;
  attachmentCount?: number | string | null;
};

export type InfluencerCreatorDedupeGroup = {
  key: string;
  platform: string;
  normalizedHandle: string;
  rows: InfluencerCreatorDedupeRow[];
  keeper: InfluencerCreatorDedupeRow;
  duplicates: InfluencerCreatorDedupeRow[];
};

const PLACEHOLDER_NAMES = new Set([
  "-",
  "—",
  "unknown",
  "未登録",
  "未登记",
  "不明",
  "none",
  "null",
]);

const STATUS_RANK: Record<string, number> = {
  potential: 0,
  contacting: 1,
  replied: 2,
  interested: 3,
  sample: 4,
  negotiating: 5,
  cooperating: 6,
  paused: 2,
  rejected: 1,
  archived: -1,
};

function decodePathPart(value: string | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function accountIdFromProfileUrl(text: string, platformValue?: unknown) {
  try {
    const url = new URL(text);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
    const parts = url.pathname.split("/").filter(Boolean);
    const platform = String(platformValue || "").toLocaleLowerCase();

    if ((!platform || platform === "tiktok") && (host === "tiktok.com" || host.endsWith(".tiktok.com"))) {
      return decodePathPart(parts.find(part => part.startsWith("@"))?.slice(1));
    }
    if ((!platform || platform === "instagram") && (host === "instagram.com" || host.endsWith(".instagram.com"))) {
      const candidate = decodePathPart(parts[0]);
      return candidate && !["p", "reel", "stories", "explore"].includes(candidate.toLocaleLowerCase()) ? candidate : null;
    }
    if ((!platform || platform === "x") && ["x.com", "twitter.com", "mobile.twitter.com"].includes(host)) {
      const candidate = decodePathPart(parts[0]);
      return candidate && !["home", "explore", "search", "i", "intent"].includes(candidate.toLocaleLowerCase()) ? candidate : null;
    }
    if ((!platform || platform === "youtube") && (host === "youtube.com" || host.endsWith(".youtube.com"))) {
      const atHandle = parts.find(part => part.startsWith("@"));
      if (atHandle) return decodePathPart(atHandle.slice(1));
      if (parts[0] === "channel") return decodePathPart(parts[1]);
      return null;
    }
    if ((!platform || platform === "line") && host === "page.line.me") {
      return decodePathPart(parts[0]);
    }
    if ((!platform || platform === "line") && host === "line.me") {
      return decodePathPart(parts.find(part => part.startsWith("@"))?.slice(1));
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeInfluencerCreatorAccountId(value: unknown, platformValue?: unknown) {
  const text = String(value || "")
    .normalize("NFKC")
    .trim();
  const isUrl = /^https?:\/\//i.test(text);
  const fromProfileUrl = isUrl ? accountIdFromProfileUrl(text, platformValue) : null;
  if (isUrl && !fromProfileUrl) return null;
  const normalized = String(fromProfileUrl || text)
    .replace(/^@+/, "")
    .split(/[\s/?#]/)[0]
    .trim()
    .toLocaleLowerCase();
  return normalized || null;
}

export function normalizedInfluencerCreatorRowAccountId(row: InfluencerCreatorDedupeRow) {
  return normalizeInfluencerCreatorAccountId(row.handle, row.platform)
    || normalizeInfluencerCreatorAccountId(row.normalizedHandle, row.platform);
}

function normalizedName(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/^@+/, "")
    .toLocaleLowerCase();
}

export function hasMeaningfulCreatorName(row: InfluencerCreatorDedupeRow) {
  const name = normalizedName(row.displayName);
  const handle = normalizedInfluencerCreatorRowAccountId(row);
  return Boolean(name && !PLACEHOLDER_NAMES.has(name) && (!handle || name !== handle));
}

function numeric(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function timestamp(value: unknown) {
  if (!value) return 0;
  const number = new Date(value as any).getTime();
  return Number.isFinite(number) ? number : 0;
}

function creatorScore(row: InfluencerCreatorDedupeRow) {
  const active = row.deletedAt ? 0 : 1;
  const meaningfulName = hasMeaningfulCreatorName(row) ? 1 : 0;
  const relationshipScore = numeric(row.outreachCount) * 100 + numeric(row.attachmentCount) * 10;
  const profileScore = [
    row.profileUrl,
    row.followerCount,
    row.category,
    row.country,
    row.language,
    row.contactInfo,
    row.ownerStaffId,
    row.notes,
  ].filter(value => value != null && String(value).trim() !== "").length;
  return {
    active,
    meaningfulName,
    relationshipScore,
    profileScore,
    updatedAt: timestamp(row.updatedAt || row.createdAt),
    id: numeric(row.id),
  };
}

export function selectInfluencerCreatorKeeper(rows: InfluencerCreatorDedupeRow[]) {
  if (!rows.length) throw new Error("creator rows are required");
  return [...rows].sort((left, right) => {
    const a = creatorScore(left);
    const b = creatorScore(right);
    return b.active - a.active
      || b.meaningfulName - a.meaningfulName
      || b.relationshipScore - a.relationshipScore
      || b.profileScore - a.profileScore
      || b.updatedAt - a.updatedAt
      || a.id - b.id;
  })[0];
}

export function buildInfluencerCreatorDedupeGroups(rows: InfluencerCreatorDedupeRow[]) {
  const byAccount = new Map<string, InfluencerCreatorDedupeRow[]>();
  for (const row of rows) {
    const normalizedHandle = normalizedInfluencerCreatorRowAccountId(row);
    const platform = String(row.platform || "").trim();
    if (!normalizedHandle || !platform) continue;
    const key = `${platform}\u0000${normalizedHandle}`;
    const group = byAccount.get(key) || [];
    group.push(row);
    byAccount.set(key, group);
  }

  return [...byAccount.entries()].map(([key, groupRows]) => {
    const keeper = selectInfluencerCreatorKeeper(groupRows);
    return {
      key,
      platform: String(keeper.platform),
      normalizedHandle: normalizedInfluencerCreatorRowAccountId(keeper)!,
      rows: groupRows,
      keeper,
      duplicates: groupRows.filter(row => Number(row.id) !== Number(keeper.id)),
    } satisfies InfluencerCreatorDedupeGroup;
  });
}

function firstText(rows: InfluencerCreatorDedupeRow[], field: keyof InfluencerCreatorDedupeRow) {
  for (const row of rows) {
    const value = row[field];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function mergeText(rows: InfluencerCreatorDedupeRow[], field: "contactInfo" | "notes") {
  const values = rows
    .map(row => String(row[field] || "").trim())
    .filter(Boolean);
  return Array.from(new Set(values)).join("\n") || null;
}

function latestDate(rows: InfluencerCreatorDedupeRow[], field: "lastContactAt" | "lastReplyAt") {
  const values = rows.map(row => row[field]).filter(Boolean);
  if (!values.length) return null;
  return values.sort((left, right) => timestamp(right) - timestamp(left))[0] || null;
}

export function mergeInfluencerCreatorGroup(group: InfluencerCreatorDedupeGroup) {
  const ranked = [group.keeper, ...group.rows.filter(row => Number(row.id) !== Number(group.keeper.id))];
  const meaningfulName = ranked.find(hasMeaningfulCreatorName)?.displayName;
  const followerCount = ranked.reduce<number | null>((highest, row) => {
    if (row.followerCount == null || String(row.followerCount).trim() === "") return highest;
    const value = Number(row.followerCount);
    if (!Number.isFinite(value) || value < 0) return highest;
    return highest == null ? value : Math.max(highest, value);
  }, null);
  const status = ranked
    .map(row => String(row.status || "potential"))
    .sort((left, right) => (STATUS_RANK[right] ?? 0) - (STATUS_RANK[left] ?? 0))[0] || "potential";
  const owner = ranked.find(row => Number(row.ownerStaffId || 0) > 0);

  return {
    displayName: String(meaningfulName || group.keeper.displayName || group.normalizedHandle).trim(),
    handle: group.normalizedHandle,
    normalizedHandle: group.normalizedHandle,
    profileUrl: firstText(ranked, "profileUrl"),
    followerCount,
    category: firstText(ranked, "category"),
    country: firstText(ranked, "country"),
    language: firstText(ranked, "language"),
    contactInfo: mergeText(ranked, "contactInfo"),
    ownerStaffId: owner ? Number(owner.ownerStaffId) : null,
    ownerStaffName: owner ? String(owner.ownerStaffName || "").trim() || null : null,
    status,
    notes: mergeText(ranked, "notes"),
    lastContactAt: latestDate(ranked, "lastContactAt"),
    lastReplyAt: latestDate(ranked, "lastReplyAt"),
  };
}
