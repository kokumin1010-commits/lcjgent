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

// LINE Message types
type LineTextMessage = { type: "text"; text: string };
type LineImageMessage = { type: "image"; originalContentUrl: string; previewImageUrl: string };
type LineMessage = LineTextMessage | LineImageMessage;

// Send reply message
export async function replyMessage(
  replyToken: string,
  messages: Array<LineMessage>
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
  messages: Array<LineMessage>
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

// Leave group
export async function leaveGroup(groupId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/leave`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
      }
    );
    if (response.ok) {
      console.log(`[LINE] Successfully left group: ${groupId}`);
      return true;
    }
    console.error(`[LINE] Failed to leave group: ${response.status}`);
    return false;
  } catch (error) {
    console.error("[LINE] Leave group error:", error);
    return false;
  }
}

// Get message content (images, videos, audio, files)
// Uses different domain: api-data.line.me
export interface MessageContentResult {
  data: Buffer;
  contentType: string;
}

export async function getMessageContent(
  messageId: string
): Promise<MessageContentResult | null> {
  try {
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
      }
    );
    
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      return {
        data: Buffer.from(arrayBuffer),
        contentType,
      };
    }
    
    // Status 202 means the content is still being prepared
    if (response.status === 202) {
      console.log(`[LINE] Content ${messageId} is still being prepared`);
      return null;
    }
    
    console.error(`[LINE] Failed to get content: ${response.status}`);
    return null;
  } catch (error) {
    console.error("[LINE] Get message content error:", error);
    return null;
  }
}

// Check transcoding status for video/audio content
export interface TranscodingStatus {
  status: "processing" | "succeeded" | "failed";
}

export async function getTranscodingStatus(
  messageId: string
): Promise<TranscodingStatus | null> {
  try {
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content/transcoding`,
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
    
    console.error(`[LINE] Failed to get transcoding status: ${response.status}`);
    return null;
  } catch (error) {
    console.error("[LINE] Get transcoding status error:", error);
    return null;
  }
}

// Get preview image for image/video content
export async function getContentPreview(
  messageId: string
): Promise<MessageContentResult | null> {
  try {
    const response = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content/preview`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
      }
    );
    
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";
      return {
        data: Buffer.from(arrayBuffer),
        contentType,
      };
    }
    
    console.error(`[LINE] Failed to get content preview: ${response.status}`);
    return null;
  } catch (error) {
    console.error("[LINE] Get content preview error:", error);
    return null;
  }
}

// Forward webhook to Proline Free
export async function forwardToProline(
  rawBody: string,
  signature: string
): Promise<void> {
  const prolineUrl = ENV.prolineWebhookUrl;
  
  if (!prolineUrl) {
    console.log("[Proline Forward] PROLINE_WEBHOOK_URL not configured, skipping");
    return;
  }
  
  try {
    const response = await fetch(prolineUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Line-Signature": signature,
      },
      body: rawBody,
    });
    
    if (response.ok) {
      console.log(`[Proline Forward] Successfully forwarded to ${prolineUrl}`);
    } else {
      console.error(`[Proline Forward] Failed with status ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    // 転送失敗してもLCJの処理は継続
    console.error("[Proline Forward] Error forwarding webhook:", error);
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
