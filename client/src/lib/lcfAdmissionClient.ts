const DEVICE_STORAGE_KEY = "lcf_admission_device_id";

function randomToken(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function createLcfAdmissionRequestId(
  operation: "entry" | "undo",
  token = randomToken(),
): string {
  return `${operation}:${token}`.slice(0, 80);
}

export function getOrCreateLcfAdmissionDeviceId(
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof window === "undefined" ? null : window.localStorage,
  token = randomToken(),
): string {
  if (!storage) return `device:${token}`.slice(0, 80);
  const existing = storage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;
  const created = `device:${token}`.slice(0, 80);
  try {
    storage.setItem(DEVICE_STORAGE_KEY, created);
  } catch {
    return created;
  }
  return created;
}
