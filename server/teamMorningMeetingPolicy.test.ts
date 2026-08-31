import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEAM_MEETING_MINIMUM_SECONDS,
  canHostTeamMeetingForTeam,
  isValidCompletedTeamMeeting,
  jstDateForInstant,
  normalizeMinimumTeamMeetingSeconds,
  personalMorningRecordingDailyKey,
  resolveTeamMeetingStartedAt,
  staffCountryToTeamCode,
  teamMeetingDailyKey,
} from "./teamMorningMeetingPolicy";

describe("team morning meeting policy", () => {
  it("maps China and Japan staff to separate team codes", () => {
    expect(staffCountryToTeamCode("中国")).toBe("china");
    expect(staffCountryToTeamCode("China")).toBe("china");
    expect(staffCountryToTeamCode("日本")).toBe("japan");
    expect(staffCountryToTeamCode("Japan")).toBe("japan");
    expect(staffCountryToTeamCode("")).toBeNull();
  });

  it("uses one unique daily key per team", () => {
    expect(teamMeetingDailyKey("2026-08-27", "china")).toBe("2026-08-27:china");
    expect(teamMeetingDailyKey("2026-08-27", "japan")).toBe("2026-08-27:japan");
  });

  it("uses a stable current-record key for personal recitations while separating recording types", () => {
    expect(personalMorningRecordingDailyKey("2026-08-27", "staff:18", "principles")).toBe("2026-08-27:staff:18:principles");
    expect(personalMorningRecordingDailyKey("2026-08-27", "staff:18", "morning_meeting")).toBe("2026-08-27:staff:18:morning_meeting");
  });

  it("allows normal employees to host only their own team while administrators can host both", () => {
    expect(canHostTeamMeetingForTeam("user", "中国", "china")).toBe(true);
    expect(canHostTeamMeetingForTeam("user", "中国", "japan")).toBe(false);
    expect(canHostTeamMeetingForTeam("user", "日本", "japan")).toBe(true);
    expect(canHostTeamMeetingForTeam("admin", null, "china")).toBe(true);
    expect(canHostTeamMeetingForTeam("admin", null, "japan")).toBe(true);
  });

  it("defaults to 60 seconds and bounds administrator settings", () => {
    expect(normalizeMinimumTeamMeetingSeconds(undefined)).toBe(DEFAULT_TEAM_MEETING_MINIMUM_SECONDS);
    expect(normalizeMinimumTeamMeetingSeconds(1)).toBe(30);
    expect(normalizeMinimumTeamMeetingSeconds(1801)).toBe(1800);
    expect(normalizeMinimumTeamMeetingSeconds(120)).toBe(120);
  });

  it("uses processing status only after the user removed the minimum recording duration", () => {
    expect(isValidCompletedTeamMeeting("completed", 3, 60)).toBe(true);
    expect(isValidCompletedTeamMeeting("completed", 11, 60)).toBe(true);
    expect(isValidCompletedTeamMeeting("completed", 59, 60)).toBe(true);
    expect(isValidCompletedTeamMeeting("completed", 60, 60)).toBe(true);
    expect(isValidCompletedTeamMeeting("failed", 600, 60)).toBe(false);
  });

  it("keeps a plausible client start time and replaces a tampered time with the server inference", () => {
    const receivedAt = new Date("2026-08-27T00:10:00.000Z");
    expect(resolveTeamMeetingStartedAt("2026-08-27T00:09:00.000Z", 60, receivedAt).toISOString()).toBe("2026-08-27T00:09:00.000Z");
    expect(resolveTeamMeetingStartedAt("2020-01-01T00:00:00.000Z", 60, receivedAt).toISOString()).toBe("2026-08-27T00:09:00.000Z");
    expect(jstDateForInstant(new Date("2026-08-26T15:01:00.000Z"))).toBe("2026-08-27");
  });
});
