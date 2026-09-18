const TIKTOK_PROFILE_BASE = "https://www.tiktok.com/@";
const TIKTOK_USERNAME_PATTERN = /^[a-zA-Z0-9._-]{1,255}$/;
const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i;
const TRAILING_SHARE_PUNCTUATION = /[、。，,.!！?？)）\]】}>]+$/u;

function cleanInput(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function canonicalProfileUrl(value: string): string | null {
  const username = value.replace(/^@+/, "").trim();
  return TIKTOK_USERNAME_PATTERN.test(username)
    ? `${TIKTOK_PROFILE_BASE}${username}`
    : null;
}

export function isOfficialTikTokUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TIKTOK_HOST_PATTERN.test(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Accepts the forms people commonly paste from TikTok and returns a safe URL:
 * - @username or username
 * - tiktok.com/@username without a scheme
 * - an HTTPS/HTTP TikTok URL, including vm/vt short links
 * - TikTok share text containing one official TikTok URL
 *
 * Invalid non-TikTok values are returned in cleaned form so the caller's
 * validator can reject them instead of silently changing their destination.
 */
export function normalizeLcmTikTokUrl(value: string): string {
  const cleaned = cleanInput(value);
  if (!cleaned) return "";

  const directProfile = canonicalProfileUrl(cleaned);
  if (directProfile) return directProfile;

  const embeddedUrl = cleaned.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)*tiktok\.com\/[^\s<>"']+/i)?.[0];
  let candidate = (embeddedUrl || cleaned).replace(TRAILING_SHARE_PUNCTUATION, "");
  if (/^(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (!TIKTOK_HOST_PATTERN.test(url.hostname.toLowerCase())) return cleaned;
    url.protocol = "https:";
    url.username = "";
    url.password = "";
    url.hash = "";

    const profileMatch = url.pathname.match(/^\/@([^/]+)/);
    if (profileMatch) {
      try {
        const profileUrl = canonicalProfileUrl(decodeURIComponent(profileMatch[1]));
        if (profileUrl) return profileUrl;
      } catch {
        return cleaned;
      }
    }

    return url.toString();
  } catch {
    return cleaned;
  }
}
