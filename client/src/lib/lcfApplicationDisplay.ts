export type SafeApplicationLink = {
  href: string;
  label: string;
};

const HTTPS_URL_PATTERN = /https:\/\/[^\s<>"']+/i;
const TRAILING_PUNCTUATION_PATTERN = /[),.;:!?、。）」』】]+$/;

export function getSafeApplicationLink(value: unknown): SafeApplicationLink | null {
  const label = String(value ?? "").trim();
  if (!label) return null;

  const match = label.match(HTTPS_URL_PATTERN);
  if (!match) return null;

  const candidate = match[0].replace(TRAILING_PUNCTUATION_PATTERN, "");
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    return { href: url.toString(), label };
  } catch {
    return null;
  }
}

export function getApplicationDepartment(type: "company" | "liver" | "general", item: Record<string, unknown>): string {
  if (type === "company") return String(item.contactDepartment ?? "").trim();
  if (type === "general") return String(item.department ?? "").trim();
  return "";
}
