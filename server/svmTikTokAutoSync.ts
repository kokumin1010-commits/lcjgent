import { TRPCError } from "@trpc/server";
import {
  normalizeTikTokUsername,
  TIKTOK_PUBLIC_PROFILE_BASE,
} from "../shared/tiktokPublicMonitor";

export type MatrixAccountSyncInput = {
  accountName?: string | null;
  platform?: string | null;
  profileUrl?: string | null;
  status?: "active" | "paused" | "archived" | null;
};

export type ResolvedMatrixAccountIdentity = {
  accountName: string;
  platform: string;
  profileUrl: string | null;
  status: "active" | "paused" | "archived";
  monitoringEligible: boolean;
};

function trimmed(value: unknown): string {
  return String(value ?? "").trim();
}

function isTikTokProfileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      /(^|\.)tiktok\.com$/i.test(url.hostname) &&
      /^\/@[^/]+\/?$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function resolveMatrixAccountIdentity(
  input: MatrixAccountSyncInput,
  fallback?: MatrixAccountSyncInput
): ResolvedMatrixAccountIdentity {
  const platform = trimmed(input.platform ?? fallback?.platform ?? "tiktok") || "tiktok";
  const status = (input.status ?? fallback?.status ?? "active") as
    | "active"
    | "paused"
    | "archived";
  const rawName = trimmed(input.accountName ?? fallback?.accountName);
  const rawProfileUrl = trimmed(input.profileUrl ?? fallback?.profileUrl);

  if (platform !== "tiktok") {
    if (!rawName) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "账号名不能为空 / アカウント名は必須です",
      });
    }
    return {
      accountName: rawName.replace(/^@+/, "").slice(0, 255),
      platform,
      profileUrl: rawProfileUrl || null,
      status,
      monitoringEligible: false,
    };
  }

  if (rawProfileUrl && !isTikTokProfileUrl(rawProfileUrl)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "请输入TikTok账号主页URL（不是视频URL） / TikTokプロフィールURLを入力してください",
    });
  }

  const usernameFromUrl = rawProfileUrl
    ? normalizeTikTokUsername(rawProfileUrl)
    : "";
  const usernameFromName = normalizeTikTokUsername(rawName);
  const accountName = usernameFromUrl || usernameFromName;
  if (!accountName) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "请输入TikTok账号主页URL或账号名 / TikTokプロフィールURLまたはアカウント名を入力してください",
    });
  }

  const profileUrl = rawProfileUrl
    ? `${TIKTOK_PUBLIC_PROFILE_BASE}${accountName}`
    : null;
  return {
    accountName,
    platform,
    profileUrl,
    status,
    monitoringEligible: Boolean(profileUrl) && status === "active",
  };
}

export function shouldQueueMatrixTikTokSync(
  before: MatrixAccountSyncInput | null,
  after: ResolvedMatrixAccountIdentity
): boolean {
  if (!after.monitoringEligible) return false;
  if (!before) return true;
  const previous = resolveMatrixAccountIdentity(before);
  return (
    !previous.monitoringEligible ||
    previous.accountName.toLowerCase() !== after.accountName.toLowerCase() ||
    previous.profileUrl !== after.profileUrl ||
    previous.status !== after.status ||
    previous.platform !== after.platform
  );
}

export function safeMatrixMonitorWarning(error: unknown): string {
  const value = String(error instanceof Error ? error.message : error);
  if (value.includes("schema not ready")) {
    return "自动监控初始化中，请稍后在账号卡片重试 / 自動監視を準備中です";
  }
  return "账号已保存，但自动监控排队失败，请稍后重试 / 保存済みですが自動監視の開始に失敗しました";
}
