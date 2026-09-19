import crypto from "crypto";
import { ENV } from "./_core/env";

const LINE_GROUP_LOOKUP_TIMEOUT_MS = 5_000;
const LINE_GROUP_LEAVE_TIMEOUT_MS = 10_000;

// LINE Messaging API Types
export interface LineWebhookEvent {
  type: string;
  timestamp: number;
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery: boolean;
  };
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

export type LineGroupMembershipState = {
  state: "member" | "not_member" | "unknown";
  status: number | null;
  error?: string;
};

export type LeaveGroupResult = {
  success: boolean;
  alreadyLeft: boolean;
  status: number | null;
  error?: string;
};

// Verify LINE webhook signature
export function verifyLineSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", ENV.lineChannelSecret)
    .update(body)
    .digest("base64");
  return hash === signature;
}

// LINE Message types
type LineMentionee = { index: number; length: number; userId: string };
type LineTextMessage = { type: "text"; text: string; mention?: { mentionees: LineMentionee[] } };
type LineImageMessage = { type: "image"; originalContentUrl: string; previewImageUrl: string };
type LineFlexMessage = { type: "flex"; altText: string; contents: any };
type LineMessage = LineTextMessage | LineImageMessage | LineFlexMessage;

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
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      console.error(`[LINE] Push message failed: ${response.status} ${response.statusText} to=${to.substring(0, 8)}... body=${errorBody}`);
    }
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

// Check whether the bot still belongs to a group without treating temporary
// LINE API failures as proof that it has left.
export async function getLineGroupMembershipState(
  groupId: string
): Promise<LineGroupMembershipState> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/summary`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
        signal: AbortSignal.timeout(LINE_GROUP_LOOKUP_TIMEOUT_MS),
      }
    );

    if (response.ok) {
      return { state: "member", status: response.status };
    }

    const error = await response.text().catch(() => "");
    if (response.status === 400 || response.status === 404) {
      return { state: "not_member", status: response.status, error };
    }

    console.error(
      `[LINE] Group membership check failed: ${response.status} group=${groupId}`
    );
    return { state: "unknown", status: response.status, error };
  } catch (error) {
    console.error("[LINE] Group membership check error:", error);
    return {
      state: "unknown",
      status: null,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

// Leave group
export async function leaveGroup(groupId: string): Promise<LeaveGroupResult> {
  try {
    const response = await fetch(
      `https://api.line.me/v2/bot/group/${groupId}/leave`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
        },
        signal: AbortSignal.timeout(LINE_GROUP_LEAVE_TIMEOUT_MS),
      }
    );
    if (response.ok) {
      console.log(`[LINE] Successfully left group: ${groupId}`);
      return {
        success: true,
        alreadyLeft: false,
        status: response.status,
      };
    }

    const error = await response.text().catch(() => "");

    // Confirm 400/404 responses through the summary endpoint. If that endpoint
    // also says the group is unavailable, the bot has already left and the
    // local record can safely be deactivated.
    if (response.status === 400 || response.status === 404) {
      const membership = await getLineGroupMembershipState(groupId);
      if (membership.state === "not_member") {
        console.log(`[LINE] Group is already left: ${groupId}`);
        return {
          success: true,
          alreadyLeft: true,
          status: response.status,
          error,
        };
      }
    }

    console.error(
      `[LINE] Failed to leave group: ${response.status} group=${groupId}`
    );
    return {
      success: false,
      alreadyLeft: false,
      status: response.status,
      error,
    };
  } catch (error) {
    console.error("[LINE] Leave group error:", error);
    return {
      success: false,
      alreadyLeft: false,
      status: null,
      error: error instanceof Error ? error.message : "unknown_error",
    };
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
