import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Determine if the request is cross-origin (e.g., from LINE LIFF, external LP)
 * Cross-origin requests need SameSite=None to send cookies
 */
function isCrossOriginRequest(req: Request): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  
  const hostname = req.hostname;
  try {
    const originUrl = new URL(origin);
    // If origin host differs from request host, it's cross-origin
    return originUrl.hostname !== hostname;
  } catch {
    return false;
  }
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const isLocalhost = LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
  const isSecure = isSecureRequest(req);
  const isCrossOrigin = isCrossOriginRequest(req);
  
  if (isSecure) {
    if (isCrossOrigin) {
      // Cross-origin requests (LIFF, LINE browser, external LP):
      // Must use SameSite=None + Secure=true for cookies to be sent
      return {
        httpOnly: true,
        path: "/",
        sameSite: "none",
        secure: true,
      };
    }
    
    // Same-site HTTPS requests (normal browser navigation):
    // Use SameSite=Lax for maximum browser compatibility
    // Lax allows cookies on top-level navigations and same-site requests
    return {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    };
  }
  
  // HTTP (localhost only): use lax for development
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false,
  };
}
