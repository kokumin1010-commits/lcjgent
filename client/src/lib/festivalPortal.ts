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

export type FestivalUnauthorizedNavigation = {
  handled: boolean;
  destination: string | null;
};

/**
 * Keep all LCF / LCM authentication inside the shared Festival account flow.
 * `destination: null` means the current page owns the error UI and must not be
 * redirected to the unrelated LCJ employee login.
 */
export function resolveFestivalUnauthorizedNavigation(
  pathname: string,
  search = "",
): FestivalUnauthorizedNavigation {
  if (pathname === "/lcm/manage" || pathname === "/lcm/admin") {
    return {
      handled: true,
      destination: buildFestivalLoginUrl(`${pathname}${search}`),
    };
  }
  if (pathname.startsWith("/lcm")) {
    return { handled: true, destination: null };
  }

  if (
    pathname === "/lcf/login"
    || pathname === "/lcf/reset-password"
    || pathname.startsWith("/lcf/apply/")
  ) {
    return { handled: true, destination: null };
  }
  if (pathname.startsWith("/lcf/")) {
    return {
      handled: true,
      destination: buildFestivalLoginUrl(`${pathname}${search}`),
    };
  }

  return { handled: false, destination: null };
}

type FestivalSessionStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const FESTIVAL_ADMIN_LCM_RETURN_KEY = "lcf_admin_lcm_return";

export function getSafeLcmAdminReturn(value: string | null | undefined): string | null {
  const safeReturn = getSafeFestivalReturn(value);
  if (!safeReturn) return null;
  const parsed = new URL(safeReturn, "https://festival.local");
  return parsed.pathname === "/lcm/admin" ? safeReturn : null;
}

export function rememberFestivalAdminLcmReturn(storage: FestivalSessionStorage, returnTo: string): boolean {
  const safeReturn = getSafeLcmAdminReturn(returnTo);
  try {
    if (!safeReturn) {
      storage.removeItem(FESTIVAL_ADMIN_LCM_RETURN_KEY);
      return false;
    }
    storage.setItem(FESTIVAL_ADMIN_LCM_RETURN_KEY, safeReturn);
    return true;
  } catch {
    return false;
  }
}

export function consumeFestivalAdminLcmReturn(storage: FestivalSessionStorage): string | null {
  try {
    const safeReturn = getSafeLcmAdminReturn(storage.getItem(FESTIVAL_ADMIN_LCM_RETURN_KEY));
    storage.removeItem(FESTIVAL_ADMIN_LCM_RETURN_KEY);
    return safeReturn;
  } catch {
    return null;
  }
}

export function clearFestivalAdminLcmReturn(storage: FestivalSessionStorage): void {
  try {
    storage.removeItem(FESTIVAL_ADMIN_LCM_RETURN_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browsers. The normal LCF cookie flow still works.
  }
}

export type FestivalWorkspace = "event" | "brand" | "creator";

export function getRequestedFestivalWorkspace(value: string | null | undefined): FestivalWorkspace | null {
  if (value === "event" || value === "brand" || value === "creator") return value;
  return null;
}
