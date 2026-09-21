export const PRIMARY_POINT_LEDGER = "beauty_wallet" as const;

export const LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE =
  "Beauty Walletが正式なポイント台帳です。中央台帳への安全な反映が完了するまで、このポイント操作は保留されます";

export class LocalPointLedgerReadOnlyError extends Error {
  readonly code = "BEAUTY_WALLET_PRIMARY_LEDGER";

  constructor(operation: string) {
    super(`${LOCAL_POINT_LEDGER_READ_ONLY_MESSAGE} (${operation})`);
    this.name = "LocalPointLedgerReadOnlyError";
  }
}

export function assertLocalPointLedgerWritable(operation: string): never {
  throw new LocalPointLedgerReadOnlyError(operation);
}

export function isLocalPointLedgerReadOnlyError(
  error: unknown
): error is LocalPointLedgerReadOnlyError {
  return (
    error instanceof LocalPointLedgerReadOnlyError ||
    (error instanceof Error &&
      "code" in error &&
      error.code === "BEAUTY_WALLET_PRIMARY_LEDGER")
  );
}
