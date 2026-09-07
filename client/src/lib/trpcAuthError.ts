import { UNAUTHED_ERR_MSG } from "@shared/const";

type UnknownRecord = Record<string, unknown>;

function stringSignalsUnauthorized(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return (
    value.includes(UNAUTHED_ERR_MSG) ||
    normalized === "UNAUTHORIZED" ||
    normalized.includes('"CODE":"UNAUTHORIZED"') ||
    normalized.includes('"HTTPSTATUS":401')
  );
}

/**
 * Production errors can cross dynamic chunks, React Query, tRPC batch envelopes,
 * and plain JSON boundaries. `instanceof TRPCClientError` is therefore not a
 * reliable authentication check. Inspect the stable code/status/message shape,
 * including bounded nested wrappers, without trusting a specific class.
 */
export function isUnauthorizedTrpcError(error: unknown): boolean {
  const seen = new Set<object>();

  const inspect = (value: unknown, depth: number): boolean => {
    if (typeof value === "string") return stringSignalsUnauthorized(value);
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return false;
    seen.add(value);

    const candidate = value as UnknownRecord;
    const code = candidate.code;
    const httpStatus = candidate.httpStatus ?? candidate.status ?? candidate.statusCode;
    const message = candidate.message;
    if (code === "UNAUTHORIZED" || httpStatus === 401) return true;
    if (typeof message === "string" && stringSignalsUnauthorized(message)) return true;

    for (const key of ["data", "shape", "error", "json", "cause", "response"]) {
      if (inspect(candidate[key], depth + 1)) return true;
    }
    if (Array.isArray(value)) return value.some(item => inspect(item, depth + 1));
    return false;
  };

  return inspect(error, 0);
}
