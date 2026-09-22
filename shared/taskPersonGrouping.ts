export type TaskPersonStatus =
  | "pending"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled";

export type GroupableTaskAssignee = {
  id: number;
  personKey: string;
  name: string;
  department: string | null;
  status: TaskPersonStatus;
};

export type GroupableTask = {
  key: string;
  status: Exclude<TaskPersonStatus, "blocked">;
  assignees: GroupableTaskAssignee[];
};

export type TaskPersonGroup<T extends GroupableTask> = {
  key: string;
  staffId: number | null;
  name: string;
  department: string | null;
  items: T[];
  counts: Record<TaskPersonStatus, number>;
  unfinishedCount: number;
};

export function getTaskStatusForPerson(
  task: GroupableTask,
  personKey: string,
): TaskPersonStatus {
  return task.assignees.find(assignee => assignee.personKey === personKey)?.status
    || task.status;
}

export function isTaskUnfinishedForPerson(
  task: GroupableTask,
  personKey: string,
): boolean {
  const status = getTaskStatusForPerson(task, personKey);
  return status !== "completed" && status !== "cancelled";
}

export function groupTasksByPerson<T extends GroupableTask>(
  items: T[],
): TaskPersonGroup<T>[] {
  const groups = new Map<
    string,
    Omit<TaskPersonGroup<T>, "counts" | "unfinishedCount"> & {
      itemKeys: Set<string>;
      itemStatuses: Map<string, TaskPersonStatus>;
    }
  >();

  for (const item of items) {
    const people = item.assignees.length > 0
      ? item.assignees
      : [{
          id: null,
          personKey: "unassigned",
          name: "未分配负责人",
          department: null,
          status: item.status,
        }];
    const uniquePeople = new Map(
      people.map(person => [person.personKey, person]),
    );

    for (const person of uniquePeople.values()) {
      const existing = groups.get(person.personKey) || {
        key: person.personKey,
        staffId: person.id,
        name: person.name,
        department: person.department,
        items: [],
        itemKeys: new Set<string>(),
        itemStatuses: new Map<string, TaskPersonStatus>(),
      };
      if (!existing.itemKeys.has(item.key)) {
        existing.items.push(item);
        existing.itemKeys.add(item.key);
        existing.itemStatuses.set(item.key, person.status);
      }
      if (!existing.department && person.department) {
        existing.department = person.department;
      }
      groups.set(person.personKey, existing);
    }
  }

  return [...groups.values()]
    .map(group => {
      const counts: Record<TaskPersonStatus, number> = {
        pending: 0,
        in_progress: 0,
        blocked: 0,
        completed: 0,
        cancelled: 0,
      };
      for (const status of group.itemStatuses.values()) counts[status] += 1;
      return {
        key: group.key,
        staffId: group.staffId,
        name: group.name,
        department: group.department,
        items: group.items,
        counts,
        unfinishedCount: counts.pending + counts.in_progress + counts.blocked,
      };
    })
    .sort((left, right) =>
      right.unfinishedCount - left.unfinishedCount
      || Number(left.staffId == null) - Number(right.staffId == null)
      || left.name.localeCompare(right.name, "ja"),
    );
}
