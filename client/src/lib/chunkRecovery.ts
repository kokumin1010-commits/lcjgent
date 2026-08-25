const CHUNK_RECOVERY_PREFIX = "lcj:chunk-recovery:";
const RETRY_WINDOW_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error
    ? `${error.name} ${error.message}`
    : typeof error === "string"
      ? error
      : String((error as any)?.message || error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk \d+ failed|vite:preloadError/i.test(message);
}

export function recoverFromChunkLoadError(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;

  const key = `${CHUNK_RECOVERY_PREFIX}${window.location.pathname}`;
  const now = Date.now();
  let lastAttempt = 0;
  try {
    lastAttempt = Number(window.sessionStorage.getItem(key) || 0);
  } catch {
    // sessionStorage can be unavailable in strict privacy mode; a reload still provides the best recovery path.
  }

  if (lastAttempt && now - lastAttempt < RETRY_WINDOW_MS) return false;
  try {
    window.sessionStorage.setItem(key, String(now));
  } catch {
    // Ignore storage failures and continue with a single browser reload.
  }
  window.location.reload();
  return true;
}

export function clearChunkRecoveryMarker(): void {
  if (typeof window === "undefined") return;
  const key = `${CHUNK_RECOVERY_PREFIX}${window.location.pathname}`;
  try {
    const lastAttempt = Number(window.sessionStorage.getItem(key) || 0);
    if (lastAttempt && Date.now() - lastAttempt >= RETRY_WINDOW_MS) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // No action needed.
  }
}
