import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./server/routers";

const makeContext = (user: any = null) => ({ req: { headers: {} } as any, res: {} as any, user });
const anonymous = appRouter.createCaller(makeContext());
const admin = appRouter.createCaller(makeContext({
  id: 990001,
  name: "Morning Regression Admin",
  email: "morning-regression@example.invalid",
  role: "admin",
}));
const member = appRouter.createCaller(makeContext({
  id: 990002,
  name: "Morning Regression Member",
  email: "morning-member@example.invalid",
  role: "user",
}));

type Result = { name: string; expectedCode: string; actualCode: string; expectedMessage?: string; passed: boolean; message: string };
const results: Result[] = [];

async function expectCode(name: string, expectedCode: string, operation: () => Promise<unknown>, expectedMessage?: string) {
  try {
    await operation();
    results.push({ name, expectedCode, actualCode: "NO_ERROR", expectedMessage, passed: false, message: "Expected an error but the call succeeded" });
  } catch (error: any) {
    const actualCode = String(error?.code || error?.data?.code || "UNKNOWN");
    const message = String(error?.message || error);
    results.push({ name, expectedCode, actualCode, expectedMessage, passed: actualCode === expectedCode && (!expectedMessage || message.includes(expectedMessage)), message });
  }
}

const validAudioShape = {
  audioBase64: "AAAA",
  mimeType: "audio/webm",
  durationSeconds: 3,
  language: "ja" as const,
};
const validTeamShape = { ...validAudioShape, participantStaffIds: [1] };

await expectCode("anonymous_principles_save", "UNAUTHORIZED", () => anonymous.morningMeeting.savePersonalRecitation(validAudioShape));
await expectCode("anonymous_daily_team_save", "UNAUTHORIZED", () => anonymous.morningMeeting.saveDailyTeamMeeting(validTeamShape));
await expectCode("anonymous_today_status", "UNAUTHORIZED", () => anonymous.morningMeeting.getTodayDailyRecordings({}));
await expectCode("anonymous_daily_audio", "UNAUTHORIZED", () => anonymous.morningMeeting.getDailyRecordingAudioUrl({ id: 1 }));
await expectCode("anonymous_principles_history", "UNAUTHORIZED", () => anonymous.morningMeeting.getSeparatedHistory({ type: "principles", limit: 10, offset: 0 }));
await expectCode("anonymous_team_history", "UNAUTHORIZED", () => anonymous.morningMeeting.getSeparatedHistory({ type: "team", limit: 10, offset: 0 }));
await expectCode("anonymous_legacy_history", "UNAUTHORIZED", () => anonymous.morningMeeting.getSeparatedHistory({ type: "legacy", limit: 10, offset: 0 }));
await expectCode("principles_duration_friendly_ja", "BAD_REQUEST", () => admin.morningMeeting.savePersonalRecitation({ ...validAudioShape, durationSeconds: 2 }), "3秒以上録音してから登録してください");
await expectCode("team_duration_friendly_zh", "BAD_REQUEST", () => admin.morningMeeting.saveDailyTeamMeeting({ ...validTeamShape, durationSeconds: 2, language: "zh" }), "请至少录音3秒后再上传");
await expectCode("principles_invalid_mime", "BAD_REQUEST", () => admin.morningMeeting.savePersonalRecitation({ ...validAudioShape, mimeType: "audio/mpeg" }));
await expectCode("principles_signature_mismatch", "BAD_REQUEST", () => admin.morningMeeting.savePersonalRecitation(validAudioShape));
await expectCode("team_invalid_mime", "BAD_REQUEST", () => admin.morningMeeting.saveDailyTeamMeeting({ ...validTeamShape, mimeType: "audio/mpeg" }));
await expectCode("team_signature_mismatch", "BAD_REQUEST", () => admin.morningMeeting.saveDailyTeamMeeting(validTeamShape));
await expectCode("member_cannot_backdate_principles", "FORBIDDEN", () => member.morningMeeting.savePersonalRecitation({ ...validAudioShape, date: "2020-01-01" }));
await expectCode("member_cannot_backdate_team", "FORBIDDEN", () => member.morningMeeting.saveDailyTeamMeeting({ ...validTeamShape, date: "2020-01-01" }));
await expectCode("legacy_shared_audio_signature_mismatch", "BAD_REQUEST", () => admin.morningMeeting.uploadAndProcess({ meetingId: 1, audioBase64: "AAAA", mimeType: "audio/webm", durationSeconds: 3, language: "ja" }));
await expectCode("legacy_shared_transcript_requires_audio_pair", "BAD_REQUEST", () => admin.morningMeeting.saveTranscriptAndSummarize({ meetingId: 1, transcript: "朝会の安全な回帰試験です。", durationSeconds: 3, language: "ja", audioBase64: "AAAA" }));

const failed = results.filter((result) => !result.passed);
const report = {
  mode: "createCaller/no-browser/no-database-write",
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.map((result) => result.name),
  productionWrites: 0,
  results,
};
const outputPath = resolve(process.cwd(), "morning_meeting_personal_runtime_no_db.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failed.length > 0) process.exit(1);
