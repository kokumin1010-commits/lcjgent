/**
 * Random spin visibility policy.
 * LCF/LCM is an event and B2B marketplace experience, so promotional mall
 * roulette must never appear on the festival domain or festival routes.
 */
const FESTIVAL_HOST_PATTERN = /(^|\.)livecommercefestival\.com$/i;

const FESTIVAL_PATH_PREFIXES = [
  "/livecommercefestival",
  "/lcf",
  "/lcm",
] as const;

export function shouldSuppressRandomSpin(path: string, hostname: string): boolean {
  if (FESTIVAL_HOST_PATTERN.test(hostname)) return true;

  return (
    path === "/2026" ||
    FESTIVAL_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  );
}
