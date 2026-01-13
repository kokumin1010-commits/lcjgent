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
      console.error("[Auth] Token verification failed:", error);
      return null;
    }
  }

  async authenticateRequest(req: Request) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

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
