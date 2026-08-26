import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { appRouter } from "./server/routers";

const makeContext = (user: any = null) => ({
  req: { headers: {} } as any,
  res: {} as any,
  user,
});

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

type Result = {
  name: string;
  expectedCode: string;
  actualCode: string;
  expectedMessage?: string;
  passed: boolean;
  message: string;
};

const results: Result[] = [];

async function expectCode(name: string, expectedCode: string, operation: () => Promise<unknown>, expectedMessage?: string) {
  try {
    await operation();
    results.push({ name, expectedCode, actualCode: "NO_ERROR", expectedMessage, passed: false, message: "Expected an error but the call succeeded" });
  } catch (error: any) {
    const actualCode = String(error?.code || error?.data?.code || "UNKNOWN");
    const message = String(error?.message || error);
    results.push({
      name,
      expectedCode,
      actualCode,
      expectedMessage,
      passed: actualCode === expectedCode && (!expectedMessage || message.includes(expectedMessage)),
      message,
    });
  }
}

const validShape = {
  audioBase64: "AAAA",
  mimeType: "audio/webm",
  durationSeconds: 3,
  language: "ja" as const,
};

await expectCode("anonymous_principles_save", "UNAUTHORIZED", () =>
  anonymous.morningMeeting.savePersonalRecitation(validShape)
);
await expectCode("anonymous_personal_meeting_save", "UNAUTHORIZED", () =>
  anonymous.morningMeeting.savePersonalMorningMeeting(validShape)
);
await expectCode("anonymous_daily_two_recordings", "UNAUTHORIZED", () =>
  anonymous.morningMeeting.getTodayDailyRecordings({})
);
await expectCode("anonymous_daily_audio", "UNAUTHORIZED", () =>
  anonymous.morningMeeting.getDailyRecordingAudioUrl({ id: 1 })
);
await expectCode("principles_duration_friendly_ja", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalRecitation({ ...validShape, durationSeconds: 2 }),
  "3秒以上録音してから登録してください",
);
await expectCode("meeting_duration_friendly_zh", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalMorningMeeting({ ...validShape, durationSeconds: 2, language: "zh" }),
  "请至少录音3秒后再上传",
);
await expectCode("principles_invalid_mime", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalRecitation({ ...validShape, mimeType: "audio/mpeg" })
);
await expectCode("principles_signature_mismatch", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalRecitation(validShape)
);
await expectCode("meeting_invalid_mime", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalMorningMeeting({ ...validShape, mimeType: "audio/mpeg" })
);
await expectCode("meeting_signature_mismatch", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalMorningMeeting(validShape)
);
await expectCode("member_cannot_backdate_principles", "FORBIDDEN", () =>
  member.morningMeeting.savePersonalRecitation({ ...validShape, date: "2020-01-01" })
);
await expectCode("member_cannot_backdate_meeting", "FORBIDDEN", () =>
  member.morningMeeting.savePersonalMorningMeeting({ ...validShape, date: "2020-01-01" })
);
await expectCode("legacy_shared_audio_signature_mismatch", "BAD_REQUEST", () =>
  admin.morningMeeting.uploadAndProcess({
    meetingId: 1,
    audioBase64: "AAAA",
    mimeType: "audio/webm",
    durationSeconds: 3,
    language: "ja",
  })
);
await expectCode("legacy_shared_transcript_requires_audio_pair", "BAD_REQUEST", () =>
  admin.morningMeeting.saveTranscriptAndSummarize({
    meetingId: 1,
    transcript: "朝会の安全な回帰試験です。",
    durationSeconds: 3,
    language: "ja",
    audioBase64: "AAAA",
  })
);

const failed = results.filter((result) => !result.passed);
const report = {
  mode: "createCaller/no-browser/no-database-write",
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.map((result) => result.name),
  rawZodJsonExposed: results.some((result) => result.message.trim().startsWith("[{")),
  productionWrites: 0,
  results,
};

const outputPath = resolve(process.cwd(), "morning_meeting_personal_runtime_no_db.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failed.length > 0 || report.rawZodJsonExposed) process.exit(1);
