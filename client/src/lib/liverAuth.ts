// Liver authentication utilities

// Liver token storage key
export const LIVER_TOKEN_KEY = "liver_session_token";

// Get liver token from localStorage
export function getLiverToken(): string | null {
  return localStorage.getItem(LIVER_TOKEN_KEY);
}

// Set liver token in localStorage
export function setLiverToken(token: string): void {
  localStorage.setItem(LIVER_TOKEN_KEY, token);
}

// Clear liver token from localStorage
export function clearLiverToken(): void {
  localStorage.removeItem(LIVER_TOKEN_KEY);
}
