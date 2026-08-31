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

type DatabaseUser = NonNullable<Awaited<ReturnType<typeof db.getUserById>>>;
export type AuthenticatedRequestUser = DatabaseUser & {
  taskUid?: string;
  isCron?: boolean;
};

type VerifiedSession =
  | { kind: "user"; userId: number }
  | { kind: "cron"; openId: string; taskUid: string | null; token: string };

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

  private async verifySession(token: string | undefined): Promise<VerifiedSession | null> {
    if (!token) return null;

    try {
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(token, secret);
      if (typeof payload.userId === "number") {
        return { kind: "user", userId: payload.userId };
      }

      const openId = typeof payload.openId === "string" ? payload.openId : "";
      if (openId.startsWith("cron_")) {
        const taskUid =
          typeof payload.taskUid === "string"
            ? payload.taskUid
            : typeof payload.task_uid === "string"
              ? payload.task_uid
              : null;
        return { kind: "cron", openId, taskUid, token };
      }
      return null;
    } catch {
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

  private async resolveCronTaskUid(session: Extract<VerifiedSession, { kind: "cron" }>): Promise<string> {
    if (session.taskUid) return session.taskUid;
    if (!ENV.oAuthServerUrl || !ENV.appId) {
      throw ForbiddenError("Cron verification service is not configured");
    }

    const base = ENV.oAuthServerUrl.endsWith("/") ? ENV.oAuthServerUrl : `${ENV.oAuthServerUrl}/`;
    const endpoint = new URL("webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt", base);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jwtToken: session.token, projectId: ENV.appId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw ForbiddenError(`Cron verification failed (${response.status})`);
    const data = (await response.json()) as { taskUid?: unknown; openId?: unknown };
    const taskUid = typeof data.taskUid === "string" ? data.taskUid : "";
    if (!taskUid || String(data.openId || session.openId) !== session.openId) {
      throw ForbiddenError("Cron session missing task_uid");
    }
    return taskUid;
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedRequestUser> {
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

    if (session.kind === "cron") {
      const taskUid = await this.resolveCronTaskUid(session);
      const now = new Date();
      return {
        id: -1,
        email: `${session.openId}@scheduled.invalid`,
        password: "",
        name: "Manus Scheduled Task",
        role: "user",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
        taskUid,
        isCron: true,
      };
    }

    const user = await db.getUserById(session.userId);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user as AuthenticatedRequestUser;
  }
}

export const sdk = new SDK();
