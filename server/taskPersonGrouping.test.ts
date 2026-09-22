import { describe, expect, it } from "vitest";
import {
  groupTasksByPerson,
  isTaskUnfinishedForPerson,
  type GroupableTask,
} from "../shared/taskPersonGrouping";

const task = (
  key: string,
  status: GroupableTask["status"],
  assignees: GroupableTask["assignees"],
): GroupableTask => ({ key, status, assignees });

describe("task person grouping", () => {
  it("groups a multi-assignee task under every person and uses each person's own status", () => {
    const sharedTask = task("manual:1", "in_progress", [
        {
          id: 3,
          personKey: "staff:3",
          name: "担当者A",
          department: "営業",
          status: "completed",
        },
        {
          id: 8,
          personKey: "staff:8",
          name: "共同担当C",
          department: "運営",
          status: "blocked",
        },
      ]);
    const groups = groupTasksByPerson([
      sharedTask,
      task("manual:2", "pending", [
        {
          id: 3,
          personKey: "staff:3",
          name: "担当者A",
          department: "営業",
          status: "pending",
        },
      ]),
    ]);

    const staff3 = groups.find(group => group.key === "staff:3");
    const staff8 = groups.find(group => group.key === "staff:8");
    expect(staff3).toMatchObject({
      name: "担当者A",
      unfinishedCount: 1,
      counts: { pending: 1, completed: 1, blocked: 0 },
    });
    expect(staff3?.items).toHaveLength(2);
    expect(staff8).toMatchObject({
      name: "共同担当C",
      unfinishedCount: 1,
      counts: { pending: 0, completed: 0, blocked: 1 },
    });
    expect(staff8?.items).toHaveLength(1);
    expect(isTaskUnfinishedForPerson(sharedTask, "staff:3")).toBe(false);
    expect(isTaskUnfinishedForPerson(sharedTask, "staff:8")).toBe(true);
  });

  it("keeps report staff and formal staff with the same numeric id separate", () => {
    const groups = groupTasksByPerson([
      task("manual:3", "completed", [
        {
          id: 5,
          personKey: "staff:5",
          name: "正式员工",
          department: "运营",
          status: "completed",
        },
      ]),
      task("daily-report:3", "in_progress", [
        {
          id: 5,
          personKey: "report-staff:5",
          name: "日报人员",
          department: null,
          status: "in_progress",
        },
      ]),
    ]);

    expect(groups.map(group => group.key).sort()).toEqual([
      "report-staff:5",
      "staff:5",
    ]);
  });

  it("puts truly unassigned tasks in their own group without marking completed work red", () => {
    const [group] = groupTasksByPerson([
      task("manual:4", "completed", []),
    ]);
    expect(group).toMatchObject({
      key: "unassigned",
      name: "未分配负责人",
      unfinishedCount: 0,
      counts: { completed: 1 },
    });
  });
});
