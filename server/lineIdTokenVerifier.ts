type VerifiedLineIdTokenPayload = {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  exp?: unknown;
  name?: unknown;
  picture?: unknown;
};

type VerifiedLineAccessTokenPayload = {
  client_id?: unknown;
  expires_in?: unknown;
  scope?: unknown;
};

export type VerifiedLineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

const LINE_ID_TOKEN_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const LINE_ACCESS_TOKEN_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify";
const LINE_ID_TOKEN_ISSUER = "https://access.line.me";
const MAX_ID_TOKEN_LENGTH = 8192;

function normalizeOptionalHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function verifyLineAccessToken(
  accessToken: string,
  channelId: string
): Promise<boolean> {
  const token = accessToken.trim();
  const expectedChannelId = channelId.trim();
  if (!token || token.length > MAX_ID_TOKEN_LENGTH || !expectedChannelId) {
    return false;
  }

  try {
    const url = new URL(LINE_ACCESS_TOKEN_VERIFY_URL);
    url.searchParams.set("access_token", token);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as VerifiedLineAccessTokenPayload;
    return (
      payload.client_id === expectedChannelId &&
      typeof payload.expires_in === "number" &&
      Number.isFinite(payload.expires_in) &&
      payload.expires_in > 0 &&
      typeof payload.scope === "string" &&
      payload.scope.split(/\s+/).includes("profile")
    );
  } catch (error) {
    console.error("[LINE Login] Access token verification unavailable", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

export async function verifyLineIdToken(
  idToken: string,
  channelId: string
): Promise<VerifiedLineProfile | null> {
  const token = idToken.trim();
  const expectedChannelId = channelId.trim();
  if (!token || token.length > MAX_ID_TOKEN_LENGTH || !expectedChannelId) {
    return null;
  }

  try {
    const response = await fetch(LINE_ID_TOKEN_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id_token: token,
        client_id: expectedChannelId,
      }).toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn("[LINE Login] ID token verification rejected", {
        status: response.status,
      });
      return null;
    }

    const payload = (await response.json()) as VerifiedLineIdTokenPayload;
    const expiresAt =
      typeof payload.exp === "number" && Number.isFinite(payload.exp)
        ? payload.exp
        : 0;
    if (
      payload.iss !== LINE_ID_TOKEN_ISSUER ||
      payload.aud !== expectedChannelId ||
      typeof payload.sub !== "string" ||
      !payload.sub.trim() ||
      payload.sub.length > 255 ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      console.warn("[LINE Login] Verified ID token payload failed local checks");
      return null;
    }

    return {
      userId: payload.sub,
      displayName:
        typeof payload.name === "string" && payload.name.trim()
          ? payload.name.trim()
          : "LINE User",
      pictureUrl: normalizeOptionalHttpsUrl(payload.picture),
    };
  } catch (error) {
    console.error("[LINE Login] ID token verification unavailable", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}
