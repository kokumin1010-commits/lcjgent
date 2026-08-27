let activeFinanceSessionId = "";

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `finance-${Date.now().toString(36)}-${random}`;
}

export function beginFinanceAccessSession(): string {
  if (!activeFinanceSessionId) activeFinanceSessionId = createSessionId();
  return activeFinanceSessionId;
}

export function getFinanceAccessSession(): string {
  return activeFinanceSessionId;
}

export function clearFinanceAccessSession(): void {
  activeFinanceSessionId = "";
}
