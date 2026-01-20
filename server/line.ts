import crypto from "crypto";
import { ENV } from "./_core/env";

// LINE Messaging API Types
export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    type: string;
    id: string;
    text?: string;
  };
  joined?: {
    members: Array<{ type: string; userId: string }>;
  };
  left?: {
    members: Array<{ type: string; userId: string }>;
  };
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}

export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

export interface LineGroupSummary {
  groupId: string;
  groupName: string;
  pictureUrl?: string;
}

// Verify LINE webhook signature
export function verifyLineSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", ENV.lineChannelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

// Send reply message
export async function replyMessage(
  replyToken: string,
  messages: Array<{ type: string; text: string }>
): Promise<boolean> {
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("[LINE] Reply message error:", error);
    return false;
  }
}

// Send push message (to user or group)
export async function pushMessage(
  to: string,
  messages: Array<{ type: string; text: string }>
): Promise<boolean> {
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
      },
      body: JSON.stringify({
        to,
        messages,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("[LINE] Push message error:", error);
    return false;
  }
}

// Get user profile
export async function getUserProfile(userId: string): Promise<LineProfile | null> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/profile/${userId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
      }
    );
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("[LINE] Get user profile error:", error);
    return null;
  }
}

// Get group member profile
export async function getGroupMemberProfile(
  groupId: string,
  userId: string
): Promise<LineProfile | null> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/member/${userId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
      }
    );
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("[LINE] Get group member profile error:", error);
    return null;
  }
}

// Get group summary
export async function getGroupSummary(
  groupId: string
): Promise<LineGroupSummary | null> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/summary`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
      }
    );
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("[LINE] Get group summary error:", error);
    return null;
  }
}

// Get bot info
export async function getBotInfo(): Promise<{
  userId: string;
  basicId: string;
  displayName: string;
  pictureUrl?: string;
} | null> {
  try {
    const response = await fetch("https://api.line.me/v2/bot/info", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
      },
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error("[LINE] Get bot info error:", error);
    return null;
  }
}
