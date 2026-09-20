export const LCJ_BRAIN_CORE_SUPER_ADMINS = [
  {
    email: "ryuhairartist@gmail.com",
    displayName: "京極琉（KG）",
    requiredSessionVersion: 1,
  },
  {
    email: "cindy121481@gmail.com",
    displayName: "Cindy",
    requiredSessionVersion: 2,
  },
] as const;

export function isLcjBrainCoreSuperAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return LCJ_BRAIN_CORE_SUPER_ADMINS.some(
    account => account.email === normalized
  );
}

export function isMainAccountSessionVersionValid(input: {
  email: string;
  storedSessionVersion: number;
  tokenSessionVersion: unknown;
}): boolean {
  if (typeof input.tokenSessionVersion !== "number") {
    return !isLcjBrainCoreSuperAdminEmail(input.email);
  }
  return input.tokenSessionVersion === input.storedSessionVersion;
}
