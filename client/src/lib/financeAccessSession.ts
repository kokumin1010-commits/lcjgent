const FINANCE_SESSION_STORAGE_KEY = "lcj_finance_access_session_v2";
const FINANCE_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

type StoredFinanceSession = {
  id: string;
  expiresAt: number;
};

let memorySession: StoredFinanceSession | null = null;

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `finance-${Date.now().toString(36)}-${random}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isUsableSession(value: unknown, now = Date.now()): value is StoredFinanceSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredFinanceSession>;
  return typeof candidate.id === "string"
    && SESSION_ID_PATTERN.test(candidate.id)
    && typeof candidate.expiresAt === "number"
    && Number.isFinite(candidate.expiresAt)
    && candidate.expiresAt > now
    && candidate.expiresAt <= now + FINANCE_SESSION_TTL_MS + 60_000;
}

function saveSession(session: StoredFinanceSession): void {
  memorySession = session;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(FINANCE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The HttpOnly finance cookie remains authoritative; memory fallback keeps this tab usable.
  }
}

function loadSession(): StoredFinanceSession | null {
  const now = Date.now();
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(FINANCE_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (isUsableSession(parsed, now)) {
          memorySession = parsed;
          return parsed;
        }
        storage.removeItem(FINANCE_SESSION_STORAGE_KEY);
      }
    } catch {
      try { storage.removeItem(FINANCE_SESSION_STORAGE_KEY); } catch { /* ignore unavailable storage */ }
    }
  }

  if (isUsableSession(memorySession, now)) return memorySession;
  memorySession = null;
  return null;
}

export function beginFinanceAccessSession(): string {
  const existing = loadSession();
  if (existing) return existing.id;

  const session = {
    id: createSessionId(),
    expiresAt: Date.now() + FINANCE_SESSION_TTL_MS,
  };
  saveSession(session);
  return session.id;
}

export function persistFinanceAccessSession(expiresAt: number): string {
  const id = beginFinanceAccessSession();
  const now = Date.now();
  const normalizedExpiresAt = Math.min(
    Math.max(Number(expiresAt) || 0, now + 1_000),
    now + FINANCE_SESSION_TTL_MS,
  );
  saveSession({ id, expiresAt: normalizedExpiresAt });
  return id;
}

export function getFinanceAccessSession(): string {
  return loadSession()?.id || "";
}

export function clearFinanceAccessSession(): void {
  memorySession = null;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(FINANCE_SESSION_STORAGE_KEY);
  } catch {
    // Nothing else to clear when browser storage is unavailable.
  }
}

export function resetFinanceAccessSessionForTests(): void {
  memorySession = null;
}
