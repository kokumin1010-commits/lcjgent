import { UNAUTHED_ERR_MSG } from "@shared/const";

type TrpcErrorLike = {
  message?: unknown;
  data?: { code?: unknown; httpStatus?: unknown } | null;
  shape?: { data?: { code?: unknown; httpStatus?: unknown } | null } | null;
};

/**
 * Production errors can cross module/chunk boundaries, so `instanceof`
 * TRPCClientError is not a reliable authentication check. Prefer the stable
 * tRPC error shape and retain the canonical message only as a fallback.
 */
export function isUnauthorizedTrpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as TrpcErrorLike;
  const data = candidate.data || candidate.shape?.data;
  return (
    data?.code === "UNAUTHORIZED" ||
    data?.httpStatus === 401 ||
    candidate.message === UNAUTHED_ERR_MSG
  );
}
