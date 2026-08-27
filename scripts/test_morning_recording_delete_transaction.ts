import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { morningMeetings, morningPrincipleRecitations } from "../drizzle/schema";
import { deleteMorningRecordingWithDb } from "../server/morningRecordingDeletion";
import { inferLegacyTeamCode, isValidCompletedTeamMeeting, type TeamMeetingCode } from "../server/teamMorningMeetingPolicy";

type FakeState = {
  personal: any[];
  meetings: any[];
  events: Array<{ kind: string }>;
  failAudit?: boolean;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeDb(initial: FakeState) {
  const state = initial;
  const tx = {
    select() {
      return {
        from(table: unknown) {
          const rows = table === morningPrincipleRecitations ? state.personal : state.meetings;
          return {
            where() {
              return {
                limit: async () => rows.slice(0, 1),
              };
            },
          };
        },
      };
    },
    async execute() {
      if (state.failAudit) throw new Error("synthetic audit failure");
      state.events.push({ kind: "delete-audit" });
      return [[], []];
    },
    delete(table: unknown) {
      return {
        async where() {
          if (table === morningPrincipleRecitations) state.personal.splice(0, 1);
          else if (table === morningMeetings) state.meetings.splice(0, 1);
          return [{ affectedRows: 1 }];
        },
      };
    },
  };
  return {
    state,
    async transaction<T>(run: (value: typeof tx) => Promise<T>): Promise<T> {
      const before = clone(state);
      try {
        return await run(tx);
      } catch (error) {
        state.personal = before.personal;
        state.meetings = before.meetings;
        state.events = before.events;
        throw error;
      }
    },
  };
}

function personalRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    date: "2026-08-27",
    recordingType: "principles",
    targetKey: "staff:5",
    userId: 10,
    staffId: 5,
    language: "zh",
    durationSeconds: 3,
    status: "completed",
    createdAt: new Date("2026-08-27T01:00:00Z"),
    audioKey: "must-not-enter-audit",
    transcript: "must-not-enter-audit",
    ...overrides,
  };
}

function meetingRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    date: "2026-08-27",
    recordingKind: "daily_team",
    teamCode: "china",
    createdBy: 20,
    language: "zh",
    durationSeconds: 12,
    participantCount: 2,
    status: "completed",
    createdAt: new Date("2026-08-27T02:00:00Z"),
    audioKey: "must-not-enter-audit",
    transcript: "must-not-enter-audit",
    ...overrides,
  };
}

async function expectCode(run: () => Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await run();
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof TRPCError);
  assert.equal(caught.code, code);
}

async function main() {
  assert.equal(isValidCompletedTeamMeeting("completed", 3, 60), true, "3-second completed recording remains valid");
  assert.equal(isValidCompletedTeamMeeting("completed", 52, 60), true, "52-second completed recording remains valid");
  assert.equal(isValidCompletedTeamMeeting("failed", 300, 60), false, "failed processing is not complete");
  const teamMap = new Map<string, TeamMeetingCode | null>([["staff:1", "china"], ["staff:2", "china"], ["staff:3", "japan"]]);
  assert.equal(inferLegacyTeamCode([{ targetKey: "staff:1" }, { targetKey: "staff:2" }], teamMap), "china");
  assert.equal(inferLegacyTeamCode([{ targetKey: "staff:1" }, { targetKey: "staff:3" }], teamMap), null);
  assert.equal(inferLegacyTeamCode([{ targetKey: "staff:404" }], teamMap), null);

  {
    const db = makeDb({ personal: [personalRecord()], meetings: [], events: [] });
    const result = await deleteMorningRecordingWithDb(db, {
      source: "daily", id: 11, actor: { id: 10, role: "user", name: "Own User" }, ownTargetKey: "staff:5",
    });
    assert.deepEqual(result, { success: true, source: "daily", id: 11 });
    assert.equal(db.state.personal.length, 0);
    assert.equal(db.state.events.length, 1);
  }
  {
    const db = makeDb({ personal: [personalRecord({ userId: 99 })], meetings: [], events: [] });
    await deleteMorningRecordingWithDb(db, {
      source: "daily", id: 11, actor: { id: 10, role: "user", name: "Linked User" }, ownTargetKey: "staff:5",
    });
    assert.equal(db.state.personal.length, 0, "linked staff target may delete own recording");
  }
  {
    const db = makeDb({ personal: [personalRecord({ userId: 99, targetKey: "staff:9" })], meetings: [], events: [] });
    await expectCode(() => deleteMorningRecordingWithDb(db, {
      source: "daily", id: 11, actor: { id: 10, role: "user", name: "Other User" }, ownTargetKey: "staff:5",
    }), "FORBIDDEN");
    assert.equal(db.state.personal.length, 1);
    assert.equal(db.state.events.length, 0);
  }
  {
    const db = makeDb({ personal: [], meetings: [meetingRecord()], events: [] });
    await deleteMorningRecordingWithDb(db, {
      source: "meeting", id: 21, actor: { id: 20, role: "user", name: "Host" }, ownTargetKey: null,
    });
    assert.equal(db.state.meetings.length, 0);
    assert.equal(db.state.events.length, 1);
  }
  {
    const db = makeDb({ personal: [], meetings: [meetingRecord()], events: [] });
    await expectCode(() => deleteMorningRecordingWithDb(db, {
      source: "meeting", id: 21, actor: { id: 30, role: "user", name: "Other" }, ownTargetKey: null,
    }), "FORBIDDEN");
    assert.equal(db.state.meetings.length, 1);
  }
  {
    const db = makeDb({ personal: [], meetings: [meetingRecord()], events: [] });
    await deleteMorningRecordingWithDb(db, {
      source: "meeting", id: 21, actor: { id: 1, role: "admin", name: "Admin" }, ownTargetKey: null,
    });
    assert.equal(db.state.meetings.length, 0);
  }
  {
    const db = makeDb({ personal: [personalRecord()], meetings: [], events: [], failAudit: true });
    await assert.rejects(() => deleteMorningRecordingWithDb(db, {
      source: "daily", id: 11, actor: { id: 10, role: "user", name: "Own User" }, ownTargetKey: "staff:5",
    }), /synthetic audit failure/);
    assert.equal(db.state.personal.length, 1, "audit failure must rollback record deletion");
    assert.equal(db.state.events.length, 0);
  }
  {
    const db = makeDb({ personal: [], meetings: [], events: [] });
    await expectCode(() => deleteMorningRecordingWithDb(db, {
      source: "daily", id: 404, actor: { id: 1, role: "admin", name: "Admin" }, ownTargetKey: null,
    }), "NOT_FOUND");
  }
  console.log("PASS morning recording policy/delete: no duration limit, legacy inference, owner, linked owner, host, admin, forbidden, rollback, not-found");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
