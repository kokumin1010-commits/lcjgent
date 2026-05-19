import type { Request } from "express";
import { jwtVerify } from "jose";
import * as db from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "./env";

function ForbiddenError(message: string) {
  const error = new Error(message);
  error.name = "ForbiddenError";
  return error;
}

class SDK {
  private parseCookies(cookieHeader: string | undefined): Map<string, string> {
    const cookies = new Map<string, string>();
    if (!cookieHeader) return cookies;

    cookieHeader.split(";").forEach((cookie) => {
      const [name, ...rest] = cookie.split("=");
      if (name && rest.length > 0) {
        cookies.set(name.trim(), rest.join("=").trim());
      }
    });

    return cookies;
  }

  private async verifySession(token: string | undefined): Promise<{ userId: number } | null> {
    if (!token) return null;

    try {
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(token, secret);
      
      if (typeof payload.userId === "number") {
        return { userId: payload.userId };
      }
      
      return null;
    } catch (error) {
      // Don't log expected token expiry/invalid errors
      return null;
    }
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractBearerToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader) return undefined;
    
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      return parts[1];
    }
    return undefined;
  }

  async authenticateRequest(req: Request) {
    // Strategy 1: Try session cookie first (primary auth for admin dashboard)
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    let session = await this.verifySession(sessionCookie);
    
    // Strategy 2: Fall back to Authorization header (for browsers with cookie issues)
    if (!session) {
      const bearerToken = this.extractBearerToken(req);
      session = await this.verifySession(bearerToken);
    }

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const user = await db.getUserById(session.userId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new SDK();
