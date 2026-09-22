import { finalizeLineOutgoingAudit, getDb, getLineUserByLineId, reserveLineOutgoingAudit } from "./db";
import { pushMessage } from "./line";
import {
  canDeliverLineAiManagerGroupReply,
  isLineAiManagerRuntimeEnabled,
} from "./lineAiManager";
import { createLineRetryKey } from "./lineRetryKey";
import { LINE_PUBLIC_CONTACT_NAME } from "../shared/linePublicIdentity";

type PublicGroupQuestionIntent = "sample_request" | "commercial_terms" | "automation_identity";

type PublicGroupQuestionParams = {
  lineGroupId: string;
  lineUserId: string;
  sourceMessageId: string;
  text: string;
};

const SAMPLE_REQUEST_PATTERN = /(?:サンプル|試供品|お試し|sample|样品).{0,80}(?:送|発送|提供|申請|希望|可能|できます|欲しい|ほしい|can|send|provide|可以|能否|寄|申请)|(?:送|発送|提供|申請|希望|可能|できます|欲しい|ほしい|can|send|provide|可以|能否|寄|申请).{0,80}(?:サンプル|試供品|お試し|sample|样品)/iu;
const COMMERCIAL_TERMS_PATTERN = /(?:報酬|成果報酬|コミッション|佣金|commission|条件|費用|rate|料率|割引率|在庫|供货|库存)/iu;
const AUTOMATION_IDENTITY_PATTERN = /(?:ai|人工知能|机器人|機械人|bot|自動返信|自動応答|自动回复|自动应答).{0,30}(?:ですか|なの|でしょうか|？|\?|吗|是不是|是吧)|(?:ですか|なの|でしょうか|？|\?|吗|是不是|是吧).{0,30}(?:ai|人工知能|机器人|機械人|bot|自動返信|自動応答|自动回复|自动应答)/iu;
const CHINESE_SIGNAL_PATTERN = /(?:样品|可以|能否|寄送|申请|佣金|条件|费用|机器人|自动回复|请问|谢谢|是否|账号|链接|吗|您)/u;
const ACCOUNT_SHARED_PATTERN = /(?:アカウント|プロフィール|account|账号|帳號)/iu;
const PUBLIC_QUESTION_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const PUBLIC_QUESTION_RATE_LIMIT_MAX = 3;

export function classifyLineGroupPublicQuestion(text: string): PublicGroupQuestionIntent | null {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (AUTOMATION_IDENTITY_PATTERN.test(normalized)) return "automation_identity";
  if (SAMPLE_REQUEST_PATTERN.test(normalized)) return "sample_request";
  if (COMMERCIAL_TERMS_PATTERN.test(normalized)) return "commercial_terms";
  return null;
}

export function composeLineGroupPublicQuestionReply(
  intent: PublicGroupQuestionIntent,
  incomingText: string,
): string {
  const chinese = CHINESE_SIGNAL_PATTERN.test(incomingText);
  if (intent === "automation_identity") {
    return chinese
      ? "是的，这个账号在初次介绍和部分确认中会使用自动支持。商品、样品、库存、寄送和合作条件都不会自动承诺；需要确认的内容会在确认后再说明。"
      : "はい、このアカウントでは初回案内や一部の確認に自動サポートを利用しています。商品・サンプル・在庫・発送・条件は自動で確約せず、確認できた内容だけをご案内します。";
  }
  if (intent === "sample_request") {
    const acknowledgedAccount = ACCOUNT_SHARED_PATTERN.test(incomingText);
    return chinese
      ? `${acknowledgedAccount ? "谢谢您分享账号信息。" : "谢谢您的询问。"}样品能否提供需要先确认。请在群里发送希望申请的商品名称（图片或链接也可以），并再次@LCJ。我们确认库存、提供条件及能否寄送后再回复您。请不要在群里发送地址、电话号码等个人信息。`
      : `${acknowledgedAccount ? "アカウントの共有ありがとうございます。" : "お問い合わせありがとうございます。"}サンプル提供の可否を確認します。ご希望の商品名（画像やURLでも大丈夫です）を、もう一度@LCJを付けてこのグループに送ってください。在庫・提供条件・発送可否を確認したうえでご案内します。住所・電話番号などの個人情報は、このグループには送らないでください。`;
  }
  return chinese
    ? "谢谢您的询问。请告诉我们商品名或活动名，以及希望确认的项目（佣金比例、提供条件、库存等），并再次@LCJ。我们只会根据已确认的信息回复，不会承诺尚未确定的条件。"
    : "ご質問ありがとうございます。商品名またはキャンペーン名と、確認したい項目（報酬率・提供条件・在庫など）を、もう一度@LCJを付けて教えてください。確認できた情報だけをご案内し、未確定の条件は確約しません。";
}

export async function tryHandleLineGroupPublicQuestion(
  params: PublicGroupQuestionParams,
): Promise<boolean> {
  const intent = classifyLineGroupPublicQuestion(params.text);
  if (!intent || !isLineAiManagerRuntimeEnabled()) return false;

  if (!await getDb()) throw new Error("LINE_GROUP_PUBLIC_QUESTION_DB_UNAVAILABLE");

  const participant = await getLineUserByLineId(params.lineUserId);
  if (participant?.isBlocked || participant?.userType === "staff" || participant?.liverId) {
    return false;
  }
  if (!await canDeliverLineAiManagerGroupReply(params.lineGroupId)) return false;

  const replyText = composeLineGroupPublicQuestionReply(intent, params.text);
  const retryKey = createLineRetryKey([
    "line-group-public-question",
    params.lineGroupId,
    params.sourceMessageId,
  ].join(":"));
  const auditMessageId = `group-public-question:${params.sourceMessageId}`;
  let reservation: Awaited<ReturnType<typeof reserveLineOutgoingAudit>>;
  try {
    reservation = await reserveLineOutgoingAudit({
      messageId: auditMessageId,
      sourceType: "group",
      lineUserId: params.lineUserId,
      lineGroupId: params.lineGroupId,
      senderName: LINE_PUBLIC_CONTACT_NAME,
      content: replyText,
      lineTimestamp: Date.now(),
      pendingSummary: `明示メンション付き${intent}定型回答（送信準備中）`,
      rateLimit: {
        messageIdPrefix: "group-public-question:",
        windowMs: PUBLIC_QUESTION_RATE_LIMIT_WINDOW_MS,
        maxCount: PUBLIC_QUESTION_RATE_LIMIT_MAX,
        errorCode: "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED",
      },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED") {
      console.info("[LINE Public Question] Rate-limited repeated explicit question", {
        code: "LINE_GROUP_PUBLIC_QUESTION_RATE_LIMITED",
        lineGroupId: params.lineGroupId,
        lineUserId: params.lineUserId,
      });
      return true;
    }
    throw error;
  }

  if (reservation.status === "responded") return true;
  if (reservation.status !== "pending") {
    console.warn("[LINE Public Question] Terminal audit was not replayed", {
      code: "LINE_GROUP_PUBLIC_QUESTION_AUDIT_TERMINAL",
      sourceMessageId: params.sourceMessageId,
      status: reservation.status,
    });
    return true;
  }

  const sent = await pushMessage(
    params.lineGroupId,
    [{ type: "text", text: replyText }],
    retryKey,
  );
  if (!sent) throw new Error("LINE_GROUP_PUBLIC_QUESTION_DELIVERY_UNCONFIRMED");

  await finalizeLineOutgoingAudit(
    auditMessageId,
    `明示メンション付き${intent}定型回答`,
  );
  return true;
}
