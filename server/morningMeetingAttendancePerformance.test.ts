import { describe, expect, it, vi } from "vitest";
import { collectMorningFacts } from "./performanceReconciliationService";

const template = {
  id: 404,
  templateCode: "ALL-D04",
  ruleVersionId: 1,
  primaryDimension: "completion",
  sourceAdapter: "morning_meeting",
  status: "shadow",
  departmentName: null,
  scheduleType: null,
  deadlineTime: null,
  effectiveFrom: "2026-09-17",
};

const verifiedMedia = {
  mediaValidatedAt: new Date("2026-09-21T01:11:00.000Z"),
  mediaDurationSeconds: "120.000",
  mediaSha256: "b".repeat(64),
  mediaAudioStreamCount: 1,
  speechValidatedAt: null,
  speechValidationProvider: null,
  supersededAt: null,
};

function createDb(meeting: Record<string, unknown> | Array<Record<string, unknown>>) {
  return {
    execute: vi.fn()
      .mockResolvedValueOnce([[{ id: 44, country: "中国" }]])
      .mockResolvedValueOnce([[
        {
          date: "2026-09-21",
          targetKey: "staff:44",
          createdAt: new Date("2026-09-21T01:00:00.000Z"),
        },
      ]])
      .mockResolvedValueOnce([[...(Array.isArray(meeting) ? meeting : [meeting])]]),
  };
}

describe("morning meeting attendance performance facts", () => {
  it("counts attendance when original audio and participant snapshot survived a transcription failure", async () => {
    const db = createDb({
      id: 901,
      date: "2026-09-21",
      teamCode: "china",
      participantSnapshot: JSON.stringify([{ targetKey: "staff:44", staffId: 44, name: "Test Staff" }]),
      audioKey: "morning-team-meetings/2026-09-21/china/meeting-901.webm",
      ...verifiedMedia,
      status: "failed",
      createdAt: new Date("2026-09-21T01:10:00.000Z"),
    });

    const facts = await collectMorningFacts(db as any, template as any, "2026-09-21", "2026-09-21", new Map());

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      staffId: 44,
      status: "completed",
      completionNumerator: 2,
      completionDenominator: 2,
      dataQuality: "verified",
      summary: {
        principlesCompleted: true,
        attendedTeamMeeting: true,
        attendanceEvidence: "server_validated_audio_and_participant_snapshot",
        meetingId: 901,
        transcriptionStatus: "failed",
      },
    });
  });

  it("does not invent attendance for a failed row without persisted audio", async () => {
    const db = createDb({
      id: 902,
      date: "2026-09-21",
      teamCode: "china",
      participantSnapshot: [{ targetKey: "staff:44", staffId: 44, name: "Test Staff" }],
      audioKey: null,
      mediaValidatedAt: null,
      mediaDurationSeconds: null,
      mediaSha256: null,
      mediaAudioStreamCount: null,
      supersededAt: null,
      status: "failed",
      createdAt: new Date("2026-09-21T01:10:00.000Z"),
    });

    const facts = await collectMorningFacts(db as any, template as any, "2026-09-21", "2026-09-21", new Map());

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      status: "pending",
      completionNumerator: 1,
      completionDenominator: 2,
      summary: {
        principlesCompleted: true,
        attendedTeamMeeting: false,
        attendanceEvidence: null,
        meetingId: null,
        transcriptionStatus: null,
      },
    });
  });

  it("uses only the newest valid recording instead of unioning a stale participant snapshot", async () => {
    const db = createDb([
      {
        id: 903,
        date: "2026-09-21",
        teamCode: "china",
        participantSnapshot: [{ targetKey: "staff:45" }],
        audioKey: "newer.webm",
        ...verifiedMedia,
        status: "completed",
        createdAt: new Date("2026-09-21T01:20:00.000Z"),
      },
      {
        id: 901,
        date: "2026-09-21",
        teamCode: "china",
        participantSnapshot: [{ targetKey: "staff:44" }],
        audioKey: "older-failed.webm",
        ...verifiedMedia,
        status: "failed",
        createdAt: new Date("2026-09-21T01:10:00.000Z"),
      },
    ]);

    const facts = await collectMorningFacts(db as any, template as any, "2026-09-21", "2026-09-21", new Map());

    expect(facts[0]).toMatchObject({
      status: "pending",
      completionNumerator: 1,
      summary: {
        attendedTeamMeeting: false,
        meetingId: null,
        transcriptionStatus: null,
      },
    });
  });

  it("ignores the old participant snapshot after an explicit re-recording replacement", async () => {
    const db = createDb({
      id: 901,
      date: "2026-09-21",
      teamCode: "china",
      participantSnapshot: [{ targetKey: "staff:44" }],
      audioKey: "older.webm",
      ...verifiedMedia,
      supersededAt: new Date("2026-09-21T02:00:00.000Z"),
      status: "failed",
      createdAt: new Date("2026-09-21T01:10:00.000Z"),
    });

    const facts = await collectMorningFacts(db as any, template as any, "2026-09-21", "2026-09-21", new Map());
    expect(facts[0]).toMatchObject({
      status: "pending",
      completionNumerator: 1,
      completionDenominator: 2,
    });
  });

  it("safely infers a legacy daily-team code from an all-same-team participant snapshot", async () => {
    const db = createDb({
      id: 904,
      date: "2026-09-21",
      teamCode: "legacy",
      participantSnapshot: JSON.stringify([{ targetKey: "staff:44" }]),
      audioKey: "legacy-team.webm",
      ...verifiedMedia,
      status: "failed",
      createdAt: new Date("2026-09-21T01:10:00.000Z"),
    });

    const facts = await collectMorningFacts(db as any, template as any, "2026-09-21", "2026-09-21", new Map());
    expect(facts[0]).toMatchObject({
      status: "completed",
      completionNumerator: 2,
      summary: { attendedTeamMeeting: true, meetingId: 904, teamCode: "china" },
    });
  });
});
