const CHUNK_RECOVERY_PREFIX = "lcj:chunk-recovery:";
const RETRY_WINDOW_MS = 30_000;
const CACHE_BUST_QUERY = "__lcj_chunk_reload";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? `${error.name} ${error.message}`
    : typeof error === "string"
      ? error
      : String((error as any)?.message || error || "");
}

function hashIdentity(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getFailureIdentity(error: unknown): string {
  const message = getErrorMessage(error);
  const asset = message.match(/(?:https?:\/\/[^\s)]+)?\/assets\/[A-Za-z0-9_./-]+\.(?:js|css)/i)?.[0];
  return hashIdentity(asset || message.slice(0, 500) || "unknown-chunk");
}

function getPathPrefix(): string {
  return `${CHUNK_RECOVERY_PREFIX}${encodeURIComponent(window.location.pathname)}:`;
}

export function isChunkLoadError(error: unknown): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed|vite:preloadError/i.test(getErrorMessage(error));
}

export function recoverFromChunkLoadError(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;

  const key = `${getPathPrefix()}${getFailureIdentity(error)}`;
  const now = Date.now();
  let lastAttempt = 0;
  try {
    lastAttempt = Number(window.sessionStorage.getItem(key) || 0);
  } catch {
    // sessionStorage can be unavailable in strict privacy mode; cache-busting navigation is still the best recovery path.
  }

  if (lastAttempt && now - lastAttempt < RETRY_WINDOW_MS) return false;
  try {
    window.sessionStorage.setItem(key, String(now));
  } catch {
    // Ignore storage failures and continue with one cache-busting navigation.
  }

  const freshUrl = new URL(window.location.href);
  freshUrl.searchParams.set(CACHE_BUST_QUERY, String(now));
  window.location.replace(freshUrl.toString());
  return true;
}

export function clearChunkRecoveryMarker(): void {
  if (typeof window === "undefined") return;
  const prefix = getPathPrefix();
  const now = Date.now();
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const attemptedAt = Number(window.sessionStorage.getItem(key) || 0);
      if (!attemptedAt || now - attemptedAt >= RETRY_WINDOW_MS) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // No action needed when storage is unavailable.
  }

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.has(CACHE_BUST_QUERY)) {
    currentUrl.searchParams.delete(CACHE_BUST_QUERY);
    window.history.replaceState(window.history.state, "", currentUrl.toString());
  }
}
