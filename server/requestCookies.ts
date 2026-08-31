import { parse } from "cookie";

type CookieRequest = {
  headers?: { cookie?: string };
  cookies?: Record<string, unknown>;
};

/**
 * Read a request cookie without requiring cookie-parser middleware.
 * Express only populates req.cookies when such middleware is installed; LCJ MALL
 * intentionally does not install it, so authentication code must also parse the
 * raw Cookie header.
 */
export function getRequestCookie(req: CookieRequest, name: string): string | undefined {
  const preParsed = req.cookies?.[name];
  if (typeof preParsed === "string" && preParsed.length > 0) return preParsed;

  const header = req.headers?.cookie;
  if (!header) return undefined;

  try {
    const value = parse(header)[name];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
