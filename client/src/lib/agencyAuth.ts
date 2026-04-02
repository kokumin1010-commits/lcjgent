// Agency authentication utilities
export const AGENCY_TOKEN_KEY = "agency_session_token";

export function getAgencyToken(): string | null {
  return localStorage.getItem(AGENCY_TOKEN_KEY);
}

export function setAgencyToken(token: string): void {
  try {
    localStorage.setItem(AGENCY_TOKEN_KEY, token);
  } catch (error) {
    console.error('[agencyAuth] Error saving token:', error);
  }
}

export function clearAgencyToken(): void {
  localStorage.removeItem(AGENCY_TOKEN_KEY);
}
