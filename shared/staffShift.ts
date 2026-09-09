export type StaffShiftKey = "regular" | "afternoon" | "night" | "midday" | "leave";

export type StaffShiftPreset = {
  key: StaffShiftKey;
  label: string;
  start: string;
  end: string;
  tag: string;
  legacyTags: readonly string[];
  endsNextDay: boolean;
};

export const STAFF_SHIFT_PRESETS: Record<StaffShiftKey, StaffShiftPreset> = {
  regular: {
    key: "regular",
    label: "普通班次",
    start: "09:00",
    end: "18:00",
    tag: "普通班次",
    legacyTags: ["早班"],
    endsNextDay: false,
  },
  afternoon: {
    key: "afternoon",
    label: "下午班次",
    start: "15:00",
    end: "23:00",
    tag: "下午班次",
    legacyTags: ["晚班"],
    endsNextDay: false,
  },
  night: {
    key: "night",
    label: "夜班班次",
    start: "18:00",
    end: "02:00",
    tag: "夜班班次",
    legacyTags: [],
    endsNextDay: true,
  },
  midday: {
    key: "midday",
    label: "凌晨班次",
    start: "13:00",
    end: "18:00",
    tag: "凌晨班次",
    legacyTags: [],
    endsNextDay: false,
  },
  leave: {
    key: "leave",
    label: "请假",
    start: "00:00",
    end: "23:59",
    tag: "请假",
    legacyTags: [],
    endsNextDay: false,
  },
};

export const WORK_SHIFT_KEYS: readonly Exclude<StaffShiftKey, "leave">[] = [
  "regular",
  "afternoon",
  "night",
  "midday",
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type StaffShiftTimeRange = {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  endsNextDay: boolean;
};

export function normalizeStaffShiftTimeRange(startValue: string, endValue: string): StaffShiftTimeRange {
  const startTime = startValue.trim();
  const endTime = endValue.trim();
  const start = TIME_PATTERN.exec(startTime);
  const end = TIME_PATTERN.exec(endTime);
  if (!start || !end) {
    throw new Error("勤務時間はHH:MM形式で入力してください");
  }

  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  let endMinutes = Number(end[1]) * 60 + Number(end[2]);
  const endsNextDay = endMinutes <= startMinutes;
  if (endsNextDay) endMinutes += 24 * 60;
  const durationMinutes = endMinutes - startMinutes;
  if (durationMinutes <= 0 || durationMinutes > 24 * 60) {
    throw new Error("勤務時間は24時間以内で入力してください");
  }

  return { startTime, endTime, durationMinutes, endsNextDay };
}

export function tryGetStaffShiftTimeRange(startTime: string, endTime: string): StaffShiftTimeRange | null {
  try {
    return normalizeStaffShiftTimeRange(startTime, endTime);
  } catch {
    return null;
  }
}

export function getStaffShiftTags(key: StaffShiftKey): readonly string[] {
  const preset = STAFF_SHIFT_PRESETS[key];
  return [preset.tag, ...preset.legacyTags];
}

export function notesHaveStaffShift(notes: string | null | undefined, key: StaffShiftKey): boolean {
  const text = notes || "";
  return getStaffShiftTags(key).some(tag => text.includes(`[${tag}]`));
}

export function detectStaffShiftKey(notes: string | null | undefined): StaffShiftKey | null {
  for (const key of [...WORK_SHIFT_KEYS, "leave"] as StaffShiftKey[]) {
    if (notesHaveStaffShift(notes, key)) return key;
  }
  return null;
}

export function stripStaffShiftTags(notes: string | null | undefined): string {
  let result = notes || "";
  for (const key of [...WORK_SHIFT_KEYS, "leave"] as StaffShiftKey[]) {
    for (const tag of getStaffShiftTags(key)) {
      result = result.replaceAll(`[${tag}]`, "");
    }
  }
  return result.replace(/\s+/g, " ").trim();
}
