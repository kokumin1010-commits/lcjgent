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
  passed: boolean;
  message: string;
};

const results: Result[] = [];

async function expectCode(name: string, expectedCode: string, operation: () => Promise<unknown>) {
  try {
    await operation();
    results.push({ name, expectedCode, actualCode: "NO_ERROR", passed: false, message: "Expected an error but the call succeeded" });
  } catch (error: any) {
    const actualCode = String(error?.code || error?.data?.code || "UNKNOWN");
    results.push({
      name,
      expectedCode,
      actualCode,
      passed: actualCode === expectedCode,
      message: String(error?.message || error),
    });
  }
}

const validShape = {
  audioBase64: "AAAA",
  mimeType: "audio/webm",
  durationSeconds: 3,
  language: "ja" as const,
};

await expectCode("anonymous_personal_save", "UNAUTHORIZED", () =>
  anonymous.morningMeeting.savePersonalRecitation(validShape)
);
await expectCode("anonymous_personal_today", "UNAUTHORIZED", () =>
  anonymous.morningMeeting.getTodayPersonalRecitations({})
);
await expectCode("anonymous_personal_audio", "UNAUTHORIZED", () =>
  anonymous.morningMeeting.getPersonalRecitationAudioUrl({ id: 1 })
);
await expectCode("personal_duration_min", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalRecitation({ ...validShape, durationSeconds: 2 })
);
await expectCode("personal_invalid_mime", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalRecitation({ ...validShape, mimeType: "audio/mpeg" })
);
await expectCode("personal_signature_mismatch", "BAD_REQUEST", () =>
  admin.morningMeeting.savePersonalRecitation(validShape)
);
await expectCode("member_cannot_backdate_personal_record", "FORBIDDEN", () =>
  member.morningMeeting.savePersonalRecitation({ ...validShape, date: "2020-01-01" })
);
await expectCode("team_audio_signature_mismatch", "BAD_REQUEST", () =>
  admin.morningMeeting.uploadAndProcess({
    meetingId: 1,
    audioBase64: "AAAA",
    mimeType: "audio/webm",
    durationSeconds: 3,
    language: "ja",
  })
);
await expectCode("team_transcript_requires_audio_pair", "BAD_REQUEST", () =>
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
  results,
};

const outputPath = resolve(process.cwd(), "morning_meeting_personal_runtime_no_db.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
if (failed.length > 0) process.exit(1);
