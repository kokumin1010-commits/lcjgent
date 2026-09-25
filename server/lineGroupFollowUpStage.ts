export type LineGroupFollowUpStage = "post_decision_support" | "planning" | "discovery";

const UNRESOLVED_PATTERN = /(?:未定|未確定|未確認|未決定|仮決定|暫定|暂定|保留|検討中|調整中|確認中|相談中|要確認|返事待ち|回答待ち|決まって(?:いない|ません)|決めて(?:いない|ません)|確定して(?:いない|ません)|まだ(?:未定|決まって|決まり|確定|確認)|わからない|分からない|不明|待确认|待確認|确认中|確認中|还没|還沒|未确定|未確定|再考虑|再考慮|不确定|不確定|(?:決定|確定|決まり).{0,12}(?:では|じゃ)ない|(?:決定|確定|決まり).{0,12}(?:ですか|ますか|でしょうか|かどうか)|(?:确定|決定|决定)(?:吗|嗎|了吗|了嗎))/i;
const CANCELLED_OR_DEFERRED_PATTERN = /(?:中止|キャンセル|見送|延期|実施しない|配信しない|ライブしない|今回はやらない|取消|不直播|暂停|暫停|暂缓|暫緩)/i;
const QUESTION_OR_PROPOSAL_PATTERN = /(?:[?？]|ですか|ますか|でしょうか|ませんか|どうですか|いかがですか|(?:吗|嗎|呢)(?:[?？]|$)|もし|場合|なら|たら|れば|如果|假如|是否)/i;
const DECIDED_PATTERN = /(?:(?:配信|ライブ|投稿|動画|日程|商品|セット|条件|開始).{0,40}(?:決まり|決定|確定|決めました|進めます|実施します|やります|開始します|配信します|投稿します)|(?:決まり|決定|確定).{0,24}(?:配信|ライブ|投稿|動画|日程|商品|セット|条件)|(?:直播|视频|日程|商品|套装|条件).{0,24}(?:确定|决定|安排好了|确认了))/i;
const PLANNING_PATTERN = /(?:配信|ライブ|投稿|動画|日程|スケジュール|直播|视频|安排)/i;

/**
 * Classifies only the most recent conversation slice so an old decision cannot
 * override a newer “still checking” message. The result selects a safe support
 * posture; it never authorizes delivery by itself.
 */
export function classifyLineGroupFollowUpStage(transcript: string): LineGroupFollowUpStage {
  const recentLines = transcript
    .split("\n")
    .slice(-8)
    .map(line => line.toLowerCase());
  for (const line of [...recentLines].reverse()) {
    if (
      CANCELLED_OR_DEFERRED_PATTERN.test(line) ||
      UNRESOLVED_PATTERN.test(line) ||
      QUESTION_OR_PROPOSAL_PATTERN.test(line)
    ) {
      return "planning";
    }
    if (DECIDED_PATTERN.test(line)) return "post_decision_support";
  }
  const recentConversation = recentLines.join(" ");
  if (PLANNING_PATTERN.test(recentConversation)) return "planning";
  return "discovery";
}
