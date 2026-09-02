import type { Pool } from "mysql2/promise";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FOLLOW_TAG_PATTERN = /\[跟播\]/;
const LEGACY_LIVER_PATTERN = /\[主播:([^\]]+)\]/;
const MAX_FOLLOW_MINUTES = 16 * 60;

export type FollowBroadcastInput = {
  isFollowBroadcast?: boolean;
  followLiverId?: number | null;
  followLiverName?: string | null;
  followStartTime?: string | null;
  followEndTime?: string | null;
};

export type NormalizedFollowBroadcastInput = {
  isFollowBroadcast: boolean;
  followLiverId: number | null;
  followLiverName: string | null;
  followStartTime: string | null;
  followEndTime: string | null;
  followDurationMinutes: number | null;
};

export type PublicFollowStaff = {
  staffName: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  isLegacyTime: boolean;
};

type PublicScheduleLike = {
  id: number;
  liverId?: number | null;
  liverName?: string | null;
  startTime: Date | string;
  endTime?: Date | string | null;
};

type FollowAssignmentRow = {
  id: number;
  staffId: number;
  staffName: string;
  dateKey: string;
  notes: string | null;
  isFollowBroadcast: number | boolean | null;
  followLiverId: number | null;
  followLiverName: string | null;
  followStartTime: string | null;
  followEndTime: string | null;
};

type PreparedFollowAssignment = {
  id: number;
  staffId: number;
  staffName: string;
  dateKey: string;
  liverId: number | null;
  liverName: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  startAbsoluteMinute: number | null;
  endAbsoluteMinute: number | null;
  isLegacyTime: boolean;
};

let ensureColumnsPromise: Promise<void> | null = null;

export function normalizeLiverName(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ja-JP");
}

export function calculateFollowDurationMinutes(
  startTime: string,
  endTime: string
): number {
  const startMatch = TIME_PATTERN.exec(startTime);
  const endMatch = TIME_PATTERN.exec(endTime);
  if (!startMatch || !endMatch) {
    throw new Error("跟播时间必须使用HH:MM格式");
  }

  const startMinutes = Number(startMatch[1]) * 60 + Number(startMatch[2]);
  let endMinutes = Number(endMatch[1]) * 60 + Number(endMatch[2]);
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return endMinutes - startMinutes;
}

export function normalizeFollowBroadcastInput(
  input: FollowBroadcastInput
): NormalizedFollowBroadcastInput {
  if (!input.isFollowBroadcast) {
    return {
      isFollowBroadcast: false,
      followLiverId: null,
      followLiverName: null,
      followStartTime: null,
      followEndTime: null,
      followDurationMinutes: null,
    };
  }

  const followLiverName = input.followLiverName?.trim() || null;
  const followStartTime = input.followStartTime?.trim() || null;
  const followEndTime = input.followEndTime?.trim() || null;
  if (!input.followLiverId || !followLiverName) {
    throw new Error("跟播时必须选择主播");
  }
  if (!followStartTime || !followEndTime) {
    throw new Error("请填写跟播开始时间和结束时间");
  }

  const followDurationMinutes = calculateFollowDurationMinutes(
    followStartTime,
    followEndTime
  );
  if (followDurationMinutes < 15) {
    throw new Error("跟播时长不能少于15分钟");
  }
  if (followDurationMinutes > MAX_FOLLOW_MINUTES) {
    throw new Error("单次跟播时长不能超过16小时");
  }

  return {
    isFollowBroadcast: true,
    followLiverId: input.followLiverId,
    followLiverName,
    followStartTime,
    followEndTime,
    followDurationMinutes,
  };
}

export function parseLegacyFollowLiverName(
  notes: string | null | undefined
): string | null {
  if (!notes || !FOLLOW_TAG_PATTERN.test(notes)) return null;
  return LEGACY_LIVER_PATTERN.exec(notes)?.[1]?.trim() || null;
}

function getJstParts(value: Date | string): {
  dateKey: string;
  minuteOfDay: number;
} {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function dateKeyToAbsoluteMinute(dateKey: string, minuteOfDay = 0): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 60_000) + minuteOfDay;
}

function scheduleInterval(schedule: PublicScheduleLike): {
  start: number;
  end: number;
  startDateKey: string;
} {
  const startParts = getJstParts(schedule.startTime);
  const endParts = schedule.endTime
    ? getJstParts(schedule.endTime)
    : startParts;
  const start = dateKeyToAbsoluteMinute(
    startParts.dateKey,
    startParts.minuteOfDay
  );
  let end = dateKeyToAbsoluteMinute(endParts.dateKey, endParts.minuteOfDay);
  if (end <= start) end = start + 1;
  return { start, end, startDateKey: startParts.dateKey };
}

function prepareFollowAssignment(
  row: FollowAssignmentRow
): PreparedFollowAssignment | null {
  const legacyLiverName = parseLegacyFollowLiverName(row.notes);
  const liverName = row.followLiverName?.trim() || legacyLiverName;
  if (!liverName) return null;

  const startTime =
    row.followStartTime && TIME_PATTERN.test(row.followStartTime)
      ? row.followStartTime
      : null;
  const endTime =
    row.followEndTime && TIME_PATTERN.test(row.followEndTime)
      ? row.followEndTime
      : null;

  let durationMinutes: number | null = null;
  let startAbsoluteMinute: number | null = null;
  let endAbsoluteMinute: number | null = null;
  if (startTime && endTime) {
    durationMinutes = calculateFollowDurationMinutes(startTime, endTime);
    const [hours, minutes] = startTime.split(":").map(Number);
    startAbsoluteMinute = dateKeyToAbsoluteMinute(
      row.dateKey,
      hours * 60 + minutes
    );
    endAbsoluteMinute = startAbsoluteMinute + durationMinutes;
  }

  return {
    id: row.id,
    staffId: row.staffId,
    staffName: row.staffName,
    dateKey: row.dateKey,
    liverId: row.followLiverId ? Number(row.followLiverId) : null,
    liverName,
    startTime,
    endTime,
    durationMinutes,
    startAbsoluteMinute,
    endAbsoluteMinute,
    isLegacyTime: !startTime || !endTime,
  };
}

function hasSameLiver(
  assignment: PreparedFollowAssignment,
  schedule: PublicScheduleLike
): boolean {
  const idMatches =
    assignment.liverId && schedule.liverId
      ? Number(schedule.liverId) === assignment.liverId
      : false;
  const nameMatches =
    normalizeLiverName(schedule.liverName) ===
    normalizeLiverName(assignment.liverName);
  return Boolean(idMatches || nameMatches);
}

function selectScheduleForAssignment<T extends PublicScheduleLike>(
  assignment: PreparedFollowAssignment,
  scheduleRows: T[]
): T | null {
  const sameLiverOnDate = scheduleRows.filter(schedule => {
    const interval = scheduleInterval(schedule);
    return (
      interval.startDateKey === assignment.dateKey &&
      hasSameLiver(assignment, schedule)
    );
  });
  if (sameLiverOnDate.length === 0) return null;
  if (sameLiverOnDate.length === 1) return sameLiverOnDate[0];

  if (
    assignment.startAbsoluteMinute !== null &&
    assignment.endAbsoluteMinute !== null
  ) {
    const overlapping = sameLiverOnDate.filter(schedule => {
      const interval = scheduleInterval(schedule);
      return (
        assignment.startAbsoluteMinute! < interval.end &&
        assignment.endAbsoluteMinute! > interval.start
      );
    });
    if (overlapping.length === 1) return overlapping[0];
    if (overlapping.length > 1) {
      return overlapping.sort((a, b) => {
        const aInterval = scheduleInterval(a);
        const bInterval = scheduleInterval(b);
        const aOverlap =
          Math.min(assignment.endAbsoluteMinute!, aInterval.end) -
          Math.max(assignment.startAbsoluteMinute!, aInterval.start);
        const bOverlap =
          Math.min(assignment.endAbsoluteMinute!, bInterval.end) -
          Math.max(assignment.startAbsoluteMinute!, bInterval.start);
        return bOverlap - aOverlap || aInterval.start - bInterval.start;
      })[0];
    }

    return sameLiverOnDate.sort((a, b) => {
      const aDistance = Math.abs(
        scheduleInterval(a).start - assignment.startAbsoluteMinute!
      );
      const bDistance = Math.abs(
        scheduleInterval(b).start - assignment.startAbsoluteMinute!
      );
      return aDistance - bDistance;
    })[0];
  }

  return sameLiverOnDate.sort(
    (a, b) => scheduleInterval(a).start - scheduleInterval(b).start
  )[0];
}

export function attachFollowStaffToScheduleRows<T extends PublicScheduleLike>(
  scheduleRows: T[],
  assignmentRows: FollowAssignmentRow[]
): Array<T & { followStaff: PublicFollowStaff[] }> {
  const assignments = assignmentRows
    .filter(
      row =>
        Boolean(row.isFollowBroadcast) ||
        FOLLOW_TAG_PATTERN.test(row.notes || "")
    )
    .map(prepareFollowAssignment)
    .filter((row): row is PreparedFollowAssignment => Boolean(row));
  const assignmentsByScheduleId = new Map<number, PreparedFollowAssignment[]>();
  for (const assignment of assignments) {
    const schedule = selectScheduleForAssignment(assignment, scheduleRows);
    if (!schedule) continue;
    const current = assignmentsByScheduleId.get(schedule.id) || [];
    current.push(assignment);
    assignmentsByScheduleId.set(schedule.id, current);
  }

  return scheduleRows.map(schedule => {
    const seen = new Set<string>();
    const followStaff = (assignmentsByScheduleId.get(schedule.id) || [])
      .sort((a, b) => {
        if (a.startAbsoluteMinute !== null && b.startAbsoluteMinute !== null) {
          return (
            a.startAbsoluteMinute - b.startAbsoluteMinute ||
            a.staffName.localeCompare(b.staffName, "zh-CN")
          );
        }
        if (a.startAbsoluteMinute !== null) return -1;
        if (b.startAbsoluteMinute !== null) return 1;
        return a.staffName.localeCompare(b.staffName, "zh-CN");
      })
      .filter(assignment => {
        const key = `${assignment.staffId}:${assignment.startTime || "legacy"}:${assignment.endTime || "legacy"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(assignment => ({
        staffName: assignment.staffName,
        startTime: assignment.startTime,
        endTime: assignment.endTime,
        durationMinutes: assignment.durationMinutes,
        isLegacyTime: assignment.isLegacyTime,
      }));
    return { ...schedule, followStaff };
  });
}

export async function ensureStaffScheduleFollowColumns(
  pool: Pool
): Promise<void> {
  if (!ensureColumnsPromise) {
    ensureColumnsPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS staff_schedules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          staffId INT NOT NULL,
          date TIMESTAMP NOT NULL,
          startTime VARCHAR(10) NOT NULL,
          endTime VARCHAR(10) NOT NULL,
          notes TEXT,
          color VARCHAR(20),
          isLateEntry TINYINT(1) DEFAULT 0,
          isFollowBroadcast TINYINT(1) NOT NULL DEFAULT 0,
          followLiverId INT NULL,
          followLiverName VARCHAR(255) NULL,
          followStartTime VARCHAR(10) NULL,
          followEndTime VARCHAR(10) NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      const [columnRows] = (await pool.query(
        "SHOW COLUMNS FROM staff_schedules"
      )) as any;
      const columns = new Set(
        (columnRows as any[]).map(row => String(row.Field))
      );
      const missingColumns: Array<[string, string]> = [
        ["isLateEntry", "TINYINT(1) DEFAULT 0"],
        ["isFollowBroadcast", "TINYINT(1) NOT NULL DEFAULT 0"],
        ["followLiverId", "INT NULL"],
        ["followLiverName", "VARCHAR(255) NULL"],
        ["followStartTime", "VARCHAR(10) NULL"],
        ["followEndTime", "VARCHAR(10) NULL"],
      ];
      for (const [column, definition] of missingColumns) {
        if (!columns.has(column)) {
          await pool.query(
            `ALTER TABLE staff_schedules ADD COLUMN \`${column}\` ${definition}`
          );
        }
      }
    })().catch(error => {
      ensureColumnsPromise = null;
      throw error;
    });
  }
  await ensureColumnsPromise;
}

export async function attachFollowStaffForDateRange<
  T extends PublicScheduleLike,
>(
  pool: Pool,
  scheduleRows: T[],
  startDate: Date,
  endDate: Date
): Promise<Array<T & { followStaff: PublicFollowStaff[] }>> {
  if (scheduleRows.length === 0) return [];
  await ensureStaffScheduleFollowColumns(pool);
  const startKey = getJstParts(startDate).dateKey;
  const endKey = getJstParts(endDate).dateKey;
  const [rows] = await pool.query(
    `SELECT ss.id, ss.staffId, s.name AS staffName,
            DATE_FORMAT(ss.date, '%Y-%m-%d') AS dateKey,
            ss.notes, ss.isFollowBroadcast, ss.followLiverId, ss.followLiverName,
            ss.followStartTime, ss.followEndTime
       FROM staff_schedules ss
       JOIN staff s ON s.id = ss.staffId
      WHERE DATE(ss.date) BETWEEN ? AND ?
        AND (ss.isFollowBroadcast = 1 OR ss.notes LIKE '%[跟播]%')
        AND s.isActive = 'active'
        AND s.archivedAt IS NULL
        AND s.mergedIntoStaffId IS NULL
      ORDER BY ss.date, ss.followStartTime, s.name`,
    [startKey, endKey]
  );
  return attachFollowStaffToScheduleRows(
    scheduleRows,
    rows as FollowAssignmentRow[]
  );
}
