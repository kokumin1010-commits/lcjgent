// Liver authentication utilities
// Supports LINE in-app browser (WebView) which may restrict localStorage/cookies

export const LIVER_TOKEN_KEY = "liver_session_token";
const COOKIE_NAME = "liver_token_fallback";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

// ============================================================
// Storage availability checks
// ============================================================

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = "__ls_test__";
    localStorage.setItem(testKey, "1");
    const val = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    return val === "1";
  } catch {
    return false;
  }
}

function isSessionStorageAvailable(): boolean {
  try {
    const testKey = "__ss_test__";
    sessionStorage.setItem(testKey, "1");
    const val = sessionStorage.getItem(testKey);
    sessionStorage.removeItem(testKey);
    return val === "1";
  } catch {
    return false;
  }
}

// ============================================================
// Cookie helpers (fallback for LINE browser)
// ============================================================

function setCookie(name: string, value: string, maxAge: number): void {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
  } catch (e) {
    console.warn('[liverAuth] Failed to set cookie:', e);
  }
}

function getCookie(name: string): string | null {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key === name) {
        return decodeURIComponent(valueParts.join('='));
      }
    }
  } catch (e) {
    console.warn('[liverAuth] Failed to get cookie:', e);
  }
  return null;
}

function deleteCookie(name: string): void {
  try {
    document.cookie = `${name}=;path=/;max-age=0;SameSite=Lax`;
  } catch (e) {
    console.warn('[liverAuth] Failed to delete cookie:', e);
  }
}

// ============================================================
// In-memory fallback (last resort for extremely restricted environments)
// ============================================================

let inMemoryToken: string | null = null;

// ============================================================
// Public API
// ============================================================

/**
 * Get liver token from any available storage
 * Priority: localStorage > sessionStorage > cookie > in-memory
 */
export function getLiverToken(): string | null {
  // 1. Try localStorage
  if (isLocalStorageAvailable()) {
    const token = localStorage.getItem(LIVER_TOKEN_KEY);
    if (token) {
      syncTokenToOtherStorages(token);
      return token;
    }
  }

  // 2. Try sessionStorage
  if (isSessionStorageAvailable()) {
    const token = sessionStorage.getItem(LIVER_TOKEN_KEY);
    if (token) {
      trySetLocalStorage(token);
      return token;
    }
  }

  // 3. Try cookie
  const cookieToken = getCookie(COOKIE_NAME);
  if (cookieToken) {
    trySetLocalStorage(cookieToken);
    trySetSessionStorage(cookieToken);
    return cookieToken;
  }

  // 4. In-memory fallback
  if (inMemoryToken) {
    return inMemoryToken;
  }

  return null;
}

/**
 * Set liver token to ALL available storages for maximum persistence
 */
export function setLiverToken(token: string): void {
  console.log('[liverAuth] setLiverToken called, saving to all available storages');
  
  let savedCount = 0;

  // 1. localStorage
  if (trySetLocalStorage(token)) savedCount++;

  // 2. sessionStorage
  if (trySetSessionStorage(token)) savedCount++;

  // 3. Cookie (always try - most reliable in LINE browser)
  setCookie(COOKIE_NAME, token, COOKIE_MAX_AGE);
  savedCount++;

  // 4. In-memory (always works)
  inMemoryToken = token;
  savedCount++;

  console.log(`[liverAuth] Token saved to ${savedCount} storage(s). localStorage=${isLocalStorageAvailable()}, sessionStorage=${isSessionStorageAvailable()}`);
  
  if (savedCount < 2) {
    console.error('[liverAuth] WARNING: Token could only be saved to limited storages');
  }
}

/**
 * Clear liver token from ALL storages
 */
export function clearLiverToken(): void {
  try { localStorage.removeItem(LIVER_TOKEN_KEY); } catch {}
  try { sessionStorage.removeItem(LIVER_TOKEN_KEY); } catch {}
  deleteCookie(COOKIE_NAME);
  inMemoryToken = null;
  console.log('[liverAuth] Token cleared from all storages');
}

/**
 * Check if we're in a restricted browser environment (LINE, etc.)
 */
export function isRestrictedBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('line/') || ua.includes('liff') || ua.includes('instagram') || ua.includes('fbav');
}

/**
 * Get debug info about storage availability
 */
export function getStorageDebugInfo(): string {
  return JSON.stringify({
    localStorage: isLocalStorageAvailable(),
    sessionStorage: isSessionStorageAvailable(),
    cookie: !!getCookie(COOKIE_NAME),
    inMemory: !!inMemoryToken,
    isRestricted: isRestrictedBrowser(),
    userAgent: navigator.userAgent.substring(0, 100),
  });
}

// ============================================================
// Internal helpers
// ============================================================

function trySetLocalStorage(token: string): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    localStorage.setItem(LIVER_TOKEN_KEY, token);
    return localStorage.getItem(LIVER_TOKEN_KEY) === token;
  } catch {
    return false;
  }
}

function trySetSessionStorage(token: string): boolean {
  if (!isSessionStorageAvailable()) return false;
  try {
    sessionStorage.setItem(LIVER_TOKEN_KEY, token);
    return sessionStorage.getItem(LIVER_TOKEN_KEY) === token;
  } catch {
    return false;
  }
}

function syncTokenToOtherStorages(token: string): void {
  if (isSessionStorageAvailable()) {
    try { sessionStorage.setItem(LIVER_TOKEN_KEY, token); } catch {}
  }
  if (!getCookie(COOKIE_NAME)) {
    setCookie(COOKIE_NAME, token, COOKIE_MAX_AGE);
  }
  inMemoryToken = token;
}
