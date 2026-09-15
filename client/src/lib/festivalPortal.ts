/**
 * LCF / LCM shared portal: one Festival account, strict same-origin return paths,
 * and role-specific workspaces after authentication.
 */
export function getSafeFestivalReturn(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return null;

  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\")) return null;
    if (/[\u0000-\u001f\u007f]/.test(decoded)) return null;
    const parsed = new URL(value, "https://festival.local");
    if (parsed.origin !== "https://festival.local") return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function buildFestivalLoginUrl(returnTo: string): string {
  const safeReturn = getSafeFestivalReturn(returnTo);
  return safeReturn ? `/lcf/login?return=${encodeURIComponent(safeReturn)}` : "/lcf/login";
}

export type FestivalWorkspace = "event" | "brand" | "creator";

export function getRequestedFestivalWorkspace(value: string | null | undefined): FestivalWorkspace | null {
  if (value === "event" || value === "brand" || value === "creator") return value;
  return null;
}
