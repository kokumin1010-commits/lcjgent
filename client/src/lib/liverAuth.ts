// Liver authentication utilities

// Liver token storage key
export const LIVER_TOKEN_KEY = "liver_session_token";

// Get liver token from localStorage
export function getLiverToken(): string | null {
  return localStorage.getItem(LIVER_TOKEN_KEY);
}

// Set liver token in localStorage
export function setLiverToken(token: string): void {
  console.log('[liverAuth] setLiverToken called with token:', token ? token.substring(0, 20) + '...' : 'null');
  try {
    localStorage.setItem(LIVER_TOKEN_KEY, token);
    const savedToken = localStorage.getItem(LIVER_TOKEN_KEY);
    console.log('[liverAuth] Token saved to localStorage:', savedToken ? 'Yes' : 'No');
    if (!savedToken) {
      console.error('[liverAuth] CRITICAL: Token was not saved to localStorage!');
    }
  } catch (error) {
    console.error('[liverAuth] Error saving token to localStorage:', error);
  }
}

// Clear liver token from localStorage
export function clearLiverToken(): void {
  localStorage.removeItem(LIVER_TOKEN_KEY);
}
