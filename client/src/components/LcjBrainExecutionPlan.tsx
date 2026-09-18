import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import {
  executionPlanValidationErrors,
  executionTaskDateRange,
  type LcjBrainExecutionMaterial,
  type LcjBrainExecutionPlanDraft,
  type LcjBrainExecutionTask,
  type LcjBrainRoleAssignments,
} from "@shared/lcjBrainExecutionPlan";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-white placeholder:text-white/30";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";

const blankMaterial = (ownerRoleKey = ""): LcjBrainExecutionMaterial => ({
  name: "",
  purpose: "",
  ownerRoleKey,
  format: "",
  preparationInstructions: "",
  requiredFields: [],
  acceptanceCriteria: [],
});

const lines = (value: string) =>
  value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);

function safeEvidenceHref(value: string): string | null {
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

const statusLabels: Record<string, string> = {
  todo: "待执行",
  pending_review: "待验收",
  completed: "已完成",
  rejected: "已退回",
  cancelled: "已取消",
};

function PlanSummary({ plan, completed }: { plan: any; completed: number }) {
  const total = plan?.plan.tasks.length || 0;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-white">执行计划 R{plan.revision}</p>
          <p className="mt-1 text-sm text-white/55">
            来源SOP v{plan.sourceSopVersion} · {plan.plan.roles.length}个角色 ·{" "}
            {total}项任务
          </p>
        </div>
        <span className="rounded-full bg-black/20 px-3 py-1 text-sm text-violet-100">
          {plan.status === "published"
            ? `已发布 · ${percent}%`
            : "AI草案 · 待管理员确认"}
        </span>
      </div>
      {plan.plan.summary && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">
          {plan.plan.summary}
        </p>
      )}
    </div>
  );
}

function MaterialEditor({
  value,
  roles,
  onChange,
  onRemove,
}: {
  value: LcjBrainExecutionMaterial;
  roles: LcjBrainExecutionPlanDraft["roles"];
  onChange: (value: LcjBrainExecutionMaterial) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/15 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/80">资料要求</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-white/35 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={value.name}
          onChange={event => onChange({ ...value, name: event.target.value })}
          placeholder="资料名称"
          className={inputClass}
        />
        <select
          value={value.ownerRoleKey}
          onChange={event =>
            onChange({ ...value, ownerRoleKey: event.target.value })
          }
          className={inputClass}
        >
          <option value="">选择资料负责人角色</option>
          {roles.map(role => (
            <option key={role.key} value={role.key}>
              {role.title}
            </option>
          ))}
        </select>
        <input
          value={value.format}
          onChange={event => onChange({ ...value, format: event.target.value })}
          placeholder="格式，例如PDF、表格、系统链接"
          className={inputClass}
        />
        <input
          value={value.purpose}
          onChange={event =>
            onChange({ ...value, purpose: event.target.value })
          }
          placeholder="资料用途"
          className={inputClass}
        />
      </div>
      <textarea
        value={value.preparationInstructions}
        onChange={event =>
          onChange({ ...value, preparationInstructions: event.target.value })
        }
        placeholder="应该如何准备"
        className={`${inputClass} min-h-20`}
      />
      <div className="grid gap-2 md:grid-cols-2">
        <textarea
          value={value.requiredFields.join("\n")}
          onChange={event =>
            onChange({ ...value, requiredFields: lines(event.target.value) })
          }
          placeholder="必填字段，每行一项"
          className={`${inputClass} min-h-20`}
        />
        <textarea
          value={value.acceptanceCriteria.join("\n")}
          onChange={event =>
            onChange({
              ...value,
              acceptanceCriteria: lines(event.target.value),
            })
          }
          placeholder="资料验收标准，每行一项"
          className={`${inputClass} min-h-20`}
        />
      </div>
    </div>
  );
}

function TaskEditor({
  task,
  roles,
  index,
  onChange,
  onRemove,
}: {
  task: LcjBrainExecutionTask;
  roles: LcjBrainExecutionPlanDraft["roles"];
  index: number;
  onChange: (value: LcjBrainExecutionTask) => void;
  onRemove: () => void;
}) {
  const updateMaterial = (
    materialIndex: number,
    value: LcjBrainExecutionMaterial
  ) =>
    onChange({
      ...task,
      materials: task.materials.map((material, position) =>
        position === materialIndex ? value : material
      ),
    });
  return (
    <details
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
      open={index === 0}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs text-violet-300">
              {task.phase || "未分阶段"}
            </span>
            <p className="font-semibold text-white">
              {index + 1}. {task.title || "未命名任务"}
            </p>
          </div>
          <button
            type="button"
            onClick={event => {
              event.preventDefault();
              onRemove();
            }}
            className="text-white/35 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </summary>
      <div className="mt-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={task.phase}
            onChange={event => onChange({ ...task, phase: event.target.value })}
            placeholder="阶段"
            className={inputClass}
          />
          <input
            value={task.title}
            onChange={event => onChange({ ...task, title: event.target.value })}
            placeholder="任务名称"
            className={`${inputClass} md:col-span-2`}
          />
        </div>
        <textarea
          value={task.instructions}
          onChange={event =>
            onChange({ ...task, instructions: event.target.value })
          }
          placeholder="具体操作方法"
          className={`${inputClass} min-h-24`}
        />
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={task.ownerRoleKey}
            onChange={event =>
              onChange({ ...task, ownerRoleKey: event.target.value })
            }
            className={inputClass}
          >
            <option value="">执行负责人角色</option>
            {roles.map(role => (
              <option key={role.key} value={role.key}>
                {role.title}
              </option>
            ))}
          </select>
          <select
            value={task.reviewerRoleKey || ""}
            onChange={event =>
              onChange({ ...task, reviewerRoleKey: event.target.value || null })
            }
            className={inputClass}
          >
            <option value="">由项目管理员验收</option>
            {roles.map(role => (
              <option key={role.key} value={role.key}>
                {role.title}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white/70">
            <input
              type="checkbox"
              checked={task.required}
              onChange={event =>
                onChange({ ...task, required: event.target.checked })
              }
            />
            必做任务
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-xs text-white/45">
            开始：项目开始后第几天
            <input
              type="number"
              min={0}
              max={730}
              value={task.startOffsetDays}
              onChange={event =>
                onChange({
                  ...task,
                  startOffsetDays: Number(event.target.value),
                })
              }
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-xs text-white/45">
            截止：项目开始后第几天
            <input
              type="number"
              min={0}
              max={730}
              value={task.dueOffsetDays}
              onChange={event =>
                onChange({ ...task, dueOffsetDays: Number(event.target.value) })
              }
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <textarea
            value={task.evidenceRequirements.join("\n")}
            onChange={event =>
              onChange({
                ...task,
                evidenceRequirements: lines(event.target.value),
              })
            }
            placeholder="完成证据，每行一项"
            className={`${inputClass} min-h-24`}
          />
          <textarea
            value={task.acceptanceCriteria.join("\n")}
            onChange={event =>
              onChange({
                ...task,
                acceptanceCriteria: lines(event.target.value),
              })
            }
            placeholder="验收标准，每行一项"
            className={`${inputClass} min-h-24`}
          />
        </div>
        <textarea
          value={task.dependencyTaskKeys.join("\n")}
          onChange={event =>
            onChange({ ...task, dependencyTaskKeys: lines(event.target.value) })
          }
          placeholder="前置任务代码，每行一项"
          className={`${inputClass} min-h-16`}
        />
        <div className="grid gap-2 md:grid-cols-2">
          <textarea
            value={task.collaboratorRoleKeys.join("\n")}
            onChange={event =>
              onChange({
                ...task,
                collaboratorRoleKeys: lines(event.target.value),
              })
            }
            placeholder="协作角色代码，每行一项"
            className={`${inputClass} min-h-20`}
          />
          <textarea
            value={task.risks.join("\n")}
            onChange={event =>
              onChange({ ...task, risks: lines(event.target.value) })
            }
            placeholder="风险与替代方案，每行一项"
            className={`${inputClass} min-h-20`}
          />
        </div>
        <div className="space-y-2">
          {task.materials.map((material, materialIndex) => (
            <MaterialEditor
              key={`${task.key}-material-${materialIndex}`}
              value={material}
              roles={roles}
              onChange={value => updateMaterial(materialIndex, value)}
              onRemove={() =>
                onChange({
                  ...task,
                  materials: task.materials.filter(
                    (_, position) => position !== materialIndex
                  ),
                })
              }
            />
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...task,
                materials: [
                  ...task.materials,
                  blankMaterial(task.ownerRoleKey),
                ],
              })
            }
            className={`${buttonClass} bg-white/10 text-white/70`}
          >
            <Plus className="h-4 w-4" /> 添加资料要求
          </button>
        </div>
      </div>
    </details>
  );
}

function DraftEditor({
  project,
  data,
  onRefresh,
}: {
  project: any;
  data: any;
  onRefresh: () => Promise<void>;
}) {
  const plan = data.plan;
  const [draft, setDraft] = useState<LcjBrainExecutionPlanDraft>(plan.plan);
  const [assignments, setAssignments] = useState<LcjBrainRoleAssignments>(
    plan.roleAssignments || {}
  );
  useEffect(() => {
    setDraft(plan.plan);
    setAssignments(plan.roleAssignments || {});
  }, [plan.id, plan.version]);
  const projectStaff = data.staff.filter((staff: any) =>
    project.memberStaffIds.includes(Number(staff.staffId))
  );
  const localErrors = useMemo(
    () =>
      executionPlanValidationErrors(draft, assignments, {
        requireAssignments: true,
      }),
    [draft, assignments]
  );
  const allErrors = [
    ...new Set([...localErrors, ...(plan.validationErrors || [])]),
  ];
  const save = trpc.lcjBrainProject.saveExecutionPlan.useMutation();
  const publish = trpc.lcjBrainProject.publishExecutionPlan.useMutation();
  const regenerate = trpc.lcjBrainProject.generateExecutionPlan.useMutation({
    onSuccess: onRefresh,
  });
  const saveDraft = async () => {
    await save.mutateAsync({
      projectId: project.id,
      planId: plan.id,
      expectedVersion: plan.version,
      plan: draft,
      roleAssignments: assignments,
    });
    await onRefresh();
  };
  const publishDraft = async () => {
    const saved = await save.mutateAsync({
      projectId: project.id,
      planId: plan.id,
      expectedVersion: plan.version,
      plan: draft,
      roleAssignments: assignments,
    });
    if (saved.validationErrors.length)
      throw new Error(saved.validationErrors.slice(0, 8).join("；"));
    if (draft.unresolvedQuestions.length)
      throw new Error("仍有未解决问题，请先处理并清空后再发布");
    if (
      !window.confirm(
        `确认发布${draft.tasks.length}项执行任务？发布后会进入相关员工任务列表，但不会发送外部提醒。`
      )
    )
      return;
    await publish.mutateAsync({
      projectId: project.id,
      planId: plan.id,
      expectedVersion: saved.version,
    });
    await onRefresh();
  };
  const updateTask = (index: number, value: LcjBrainExecutionTask) =>
    setDraft(current => ({
      ...current,
      tasks: current.tasks.map((task, position) =>
        position === index ? value : task
      ),
    }));
  return (
    <div className="space-y-4">
      <PlanSummary plan={plan} completed={0} />
      <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
        AI只生成草案，不会指定人员、发布任务或发送通知。管理员必须确认每个角色、任务、资料、日期和验收标准。
        <button
          type="button"
          disabled={regenerate.isPending}
          onClick={() => {
            if (window.confirm("重新生成会替换当前未发布草案。确认继续吗？"))
              regenerate.mutate({ projectId: project.id });
          }}
          className={`${buttonClass} ml-3 bg-amber-100/10 text-amber-50`}
        >
          {regenerate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          AI重新生成
        </button>
      </div>
      <label className="block text-sm text-white/65">
        执行方案摘要
        <textarea
          value={draft.summary}
          onChange={event =>
            setDraft({ ...draft, summary: event.target.value })
          }
          className={`${inputClass} mt-1 min-h-24`}
        />
      </label>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">角色与实际负责人</h3>
            <p className="mt-1 text-sm text-white/45">
              AI只定义角色；管理员从当前项目成员中确认实际员工。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const key = `role_${Date.now().toString(36)}`;
              setDraft(current => ({
                ...current,
                roles: [
                  ...current.roles,
                  {
                    key,
                    title: "新角色",
                    departmentHint: "",
                    responsibility: "",
                    required: true,
                  },
                ],
              }));
            }}
            className={`${buttonClass} bg-white/10 text-white`}
          >
            <Plus className="h-4 w-4" /> 添加角色
          </button>
        </div>
        {draft.roles.map((role, index) => (
          <div
            key={role.key}
            className="grid gap-2 rounded-lg border border-white/10 p-3 md:grid-cols-4"
          >
            <input
              value={role.title}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  roles: current.roles.map((item, position) =>
                    position === index
                      ? { ...item, title: event.target.value }
                      : item
                  ),
                }))
              }
              className={inputClass}
              placeholder="角色名称"
            />
            <input
              value={role.departmentHint}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  roles: current.roles.map((item, position) =>
                    position === index
                      ? { ...item, departmentHint: event.target.value }
                      : item
                  ),
                }))
              }
              className={inputClass}
              placeholder="建议部门"
            />
            <select
              value={assignments[role.key] || ""}
              onChange={event =>
                setAssignments(current => ({
                  ...current,
                  [role.key]: Number(event.target.value) || 0,
                }))
              }
              className={inputClass}
            >
              <option value="">选择实际员工</option>
              {projectStaff.map((staff: any) => (
                <option key={staff.staffId} value={staff.staffId}>
                  {staff.name}
                  {staff.department ? ` · ${staff.department}` : ""}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white/70">
              <input
                type="checkbox"
                checked={role.required}
                onChange={event =>
                  setDraft(current => ({
                    ...current,
                    roles: current.roles.map((item, position) =>
                      position === index
                        ? { ...item, required: event.target.checked }
                        : item
                    ),
                  }))
                }
              />
              必需角色
            </label>
            <textarea
              value={role.responsibility}
              onChange={event =>
                setDraft(current => ({
                  ...current,
                  roles: current.roles.map((item, position) =>
                    position === index
                      ? { ...item, responsibility: event.target.value }
                      : item
                  ),
                }))
              }
              className={`${inputClass} min-h-20 md:col-span-4`}
              placeholder="职责说明"
            />
            <div className="md:col-span-4 flex items-center justify-between text-xs text-white/35">
              <span>角色代码：{role.key}</span>
              <button
                type="button"
                onClick={() =>
                  setDraft(current => ({
                    ...current,
                    roles: current.roles.filter(
                      (_, position) => position !== index
                    ),
                  }))
                }
                className="inline-flex items-center gap-1 text-red-300/70 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> 删除角色
              </button>
            </div>
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">任务、资料与验收</h3>
            <p className="mt-1 text-sm text-white/45">
              日期按项目开始日计算；发布前可修改全部草案内容。
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const key = `task_${Date.now().toString(36)}`;
              const roleKey = draft.roles[0]?.key || "";
              setDraft(current => ({
                ...current,
                tasks: [
                  ...current.tasks,
                  {
                    key,
                    phase: "筹备",
                    title: "新任务",
                    instructions: "",
                    ownerRoleKey: roleKey,
                    reviewerRoleKey: null,
                    collaboratorRoleKeys: [],
                    startOffsetDays: 0,
                    dueOffsetDays: 0,
                    dependencyTaskKeys: [],
                    materials: [],
                    evidenceRequirements: [],
                    acceptanceCriteria: [],
                    risks: [],
                    required: true,
                  },
                ],
              }));
            }}
            className={`${buttonClass} bg-white/10 text-white`}
          >
            <Plus className="h-4 w-4" /> 添加任务
          </button>
        </div>
        {draft.tasks.map((task, index) => (
          <TaskEditor
            key={task.key}
            task={task}
            roles={draft.roles}
            index={index}
            onChange={value => updateTask(index, value)}
            onRemove={() =>
              setDraft(current => ({
                ...current,
                tasks: current.tasks.filter(
                  (_, position) => position !== index
                ),
              }))
            }
          />
        ))}
      </section>
      <label className="block text-sm text-white/65">
        未解决问题（每行一项；发布前必须清空）
        <textarea
          value={draft.unresolvedQuestions.join("\n")}
          onChange={event =>
            setDraft({
              ...draft,
              unresolvedQuestions: lines(event.target.value),
            })
          }
          className={`${inputClass} mt-1 min-h-24`}
        />
      </label>
      {allErrors.length > 0 && (
        <div className="rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-100">
          <p className="font-medium">发布前需要处理</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {allErrors.slice(0, 12).map(error => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {(save.error || publish.error || regenerate.error) && (
        <p className="text-sm text-red-300">
          {save.error?.message ||
            publish.error?.message ||
            regenerate.error?.message}
        </p>
      )}
      <div className="sticky bottom-3 flex flex-wrap justify-end gap-2 rounded-xl border border-white/10 bg-slate-950/95 p-3 shadow-xl">
        <button
          type="button"
          disabled={save.isPending || publish.isPending || regenerate.isPending}
          onClick={() => void saveDraft().catch(() => undefined)}
          className={`${buttonClass} bg-white/10 text-white`}
        >
          <Save className="h-4 w-4" /> 保存草案
        </button>
        <button
          type="button"
          disabled={
            save.isPending ||
            publish.isPending ||
            regenerate.isPending ||
            allErrors.length > 0 ||
            draft.unresolvedQuestions.length > 0
          }
          onClick={() => void publishDraft().catch(() => undefined)}
          className={`${buttonClass} bg-emerald-500 text-slate-950`}
        >
          {publish.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          管理员确认并发布
        </button>
      </div>
    </div>
  );
}

function PublishedTask({
  task,
  state,
  plan,
  data,
  projectStartDate,
  defaultOpen,
  onRefresh,
}: {
  task: LcjBrainExecutionTask;
  state: any;
  plan: any;
  data: any;
  projectStartDate: string;
  defaultOpen: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const assignments = plan.roleAssignments || {};
  const ownerStaffId = Number(assignments[task.ownerRoleKey]);
  const reviewerStaffId = task.reviewerRoleKey
    ? Number(assignments[task.reviewerRoleKey])
    : null;
  const owner = data.staff.find(
    (staff: any) => Number(staff.staffId) === ownerStaffId
  );
  const reviewer = data.staff.find(
    (staff: any) => Number(staff.staffId) === reviewerStaffId
  );
  const canSubmit =
    data.actorStaffId === ownerStaffId &&
    (state?.status === "todo" || state?.status === "rejected");
  const canReview =
    state?.status === "pending_review" &&
    ((reviewerStaffId && data.actorStaffId === reviewerStaffId) ||
      (!reviewerStaffId && data.access.canManage)) &&
    data.actorStaffId !== ownerStaffId;
  const submit = trpc.lcjBrainProject.submitExecutionTask.useMutation({
    onSuccess: onRefresh,
  });
  const review = trpc.lcjBrainProject.reviewExecutionTask.useMutation({
    onSuccess: onRefresh,
  });
  const dates = executionTaskDateRange(projectStartDate, task);
  return (
    <details
      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs text-violet-300">
              {task.phase} · {dates.startDate}—{dates.dueDate}
            </span>
            <p className="font-semibold text-white">{task.title}</p>
            <p className="mt-1 text-xs text-white/45">
              负责人：{owner?.name || "未分配"} · 验收：
              {reviewer?.name || "项目管理员"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs ${state?.status === "completed" ? "bg-emerald-400/15 text-emerald-200" : state?.status === "pending_review" ? "bg-amber-400/15 text-amber-100" : "bg-white/10 text-white/60"}`}
          >
            {statusLabels[state?.status || "todo"]}
          </span>
        </div>
      </summary>
      <div className="mt-4 space-y-4 text-sm text-white/70">
        <p className="whitespace-pre-wrap leading-6">{task.instructions}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg bg-black/20 p-3">
            <p className="font-medium text-white">完成证据</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {task.evidenceRequirements.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-black/20 p-3">
            <p className="font-medium text-white">验收标准</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {task.acceptanceCriteria.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        {task.materials.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-white">资料准备</p>
            {task.materials.map((material, index) => {
              const materialOwnerId = Number(
                assignments[material.ownerRoleKey]
              );
              const materialOwner = data.staff.find(
                (staff: any) => Number(staff.staffId) === materialOwnerId
              );
              return (
                <div
                  key={`${task.key}-material-view-${index}`}
                  className="rounded-lg border border-white/10 p-3"
                >
                  <p className="font-medium text-white/90">
                    {material.name} · {materialOwner?.name || "未分配"}
                  </p>
                  <p className="mt-1">格式：{material.format || "未限定"}</p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {material.preparationInstructions}
                  </p>
                  {!!material.acceptanceCriteria.length && (
                    <p className="mt-2 text-white/45">
                      资料验收：{material.acceptanceCriteria.join("；")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {state?.evidenceLinks?.length > 0 && (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
            <p className="font-medium text-emerald-100">已提交证据</p>
            <div className="mt-2 space-y-1">
              {state.evidenceLinks.map((link: string) => {
                const href = safeEvidenceHref(link);
                return href ? (
                  <a
                    key={link}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 break-all text-emerald-200 underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {link}
                  </a>
                ) : (
                  <span key={link} className="break-all text-red-200">
                    不支持的证据链接
                  </span>
                );
              })}
            </div>
            {state.submissionNote && (
              <p className="mt-2 whitespace-pre-wrap">{state.submissionNote}</p>
            )}
            {state.reviewNote && (
              <p className="mt-2 text-white/55">验收意见：{state.reviewNote}</p>
            )}
          </div>
        )}
        {canSubmit && (
          <div className="rounded-lg border border-violet-400/20 bg-violet-400/10 p-3 space-y-2">
            <p className="font-medium text-violet-100">提交验收</p>
            <textarea
              value={evidence}
              onChange={event => setEvidence(event.target.value)}
              placeholder="证据链接，每行一个"
              className={`${inputClass} min-h-20`}
            />
            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="完成说明（没有链接时必须填写）"
              className={`${inputClass} min-h-20`}
            />
            <button
              type="button"
              disabled={submit.isPending}
              onClick={() =>
                submit.mutate({
                  projectId: data.plan.projectId,
                  taskKey: task.key,
                  evidenceLinks: lines(evidence),
                  note,
                })
              }
              className={`${buttonClass} bg-violet-600 text-white`}
            >
              <FileCheck2 className="h-4 w-4" /> 提交给验收人
            </button>
            {submit.error && (
              <p className="text-red-300">{submit.error.message}</p>
            )}
          </div>
        )}
        {canReview && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 space-y-2">
            <p className="font-medium text-amber-100">验收处理</p>
            <textarea
              value={reviewNote}
              onChange={event => setReviewNote(event.target.value)}
              placeholder="验收意见；退回时必须填写原因"
              className={`${inputClass} min-h-20`}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({
                    projectId: data.plan.projectId,
                    taskKey: task.key,
                    decision: "approve",
                    note: reviewNote,
                  })
                }
                className={`${buttonClass} bg-emerald-500 text-slate-950`}
              >
                <CheckCircle2 className="h-4 w-4" /> 验收通过
              </button>
              <button
                type="button"
                disabled={review.isPending || !reviewNote.trim()}
                onClick={() =>
                  review.mutate({
                    projectId: data.plan.projectId,
                    taskKey: task.key,
                    decision: "reject",
                    note: reviewNote,
                  })
                }
                className={`${buttonClass} bg-red-500/80 text-white`}
              >
                <XCircle className="h-4 w-4" /> 退回修改
              </button>
            </div>
            {review.error && (
              <p className="text-red-300">{review.error.message}</p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

export default function LcjBrainExecutionPlan({
  project,
  canManage,
}: {
  project: any;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const query = trpc.lcjBrainProject.executionPlan.useQuery({
    projectId: project.id,
  });
  const generate = trpc.lcjBrainProject.generateExecutionPlan.useMutation({
    onSuccess: async () => {
      await utils.lcjBrainProject.executionPlan.invalidate({
        projectId: project.id,
      });
    },
  });
  const refresh = async () => {
    await Promise.all([
      utils.lcjBrainProject.executionPlan.invalidate({ projectId: project.id }),
      utils.lcjBrainProject.get.invalidate({ projectId: project.id }),
    ]);
  };
  if (query.isLoading)
    return <Loader2 className="h-5 w-5 animate-spin text-violet-300" />;
  if (query.error) return <p className="text-red-300">{query.error.message}</p>;
  const data = query.data;
  if (!data?.plan) {
    return (
      <div className="rounded-2xl border border-dashed border-violet-400/25 bg-violet-500/5 p-8 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-violet-300" />
        <h3 className="mt-3 text-lg font-semibold text-white">
          尚未生成执行方案
        </h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-white/55">
          AI将使用当前SOP生成角色、任务、资料准备方法、证据和验收标准草案。AI不会分配实际员工，也不会发布任务或发送通知。
        </p>
        {canManage ? (
          <button
            type="button"
            disabled={generate.isPending || project.status === "archived"}
            onClick={() => generate.mutate({ projectId: project.id })}
            className={`${buttonClass} mt-4 bg-violet-600 text-white`}
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            AI生成执行草案（gpt-5-mini）
          </button>
        ) : (
          <p className="mt-4 text-sm text-white/40">
            等待项目负责人生成并发布执行计划。
          </p>
        )}
        {generate.error && (
          <p className="mt-3 text-sm text-red-300">{generate.error.message}</p>
        )}
      </div>
    );
  }
  const plan = data.plan;
  if (plan.status === "draft") {
    if (!canManage)
      return (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
          AI执行草案正在由项目负责人确认，尚未向员工发布。
        </div>
      );
    return <DraftEditor project={project} data={data} onRefresh={refresh} />;
  }
  const states = new Map(
    data.taskStates.map((state: any) => [state.taskKey, state])
  );
  const targetTaskKey = new URLSearchParams(window.location.search).get(
    "executionTask"
  );
  const completed = data.taskStates.filter(
    (state: any) => state.status === "completed"
  ).length;
  return (
    <div className="space-y-4">
      <PlanSummary plan={plan} completed={completed} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <ClipboardCheck className="h-5 w-5 text-violet-300" />
          <p className="mt-2 text-2xl font-bold text-white">
            {plan.plan.tasks.length}
          </p>
          <p className="text-xs text-white/45">全部执行事项</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <UserRoundCheck className="h-5 w-5 text-amber-300" />
          <p className="mt-2 text-2xl font-bold text-white">
            {
              data.taskStates.filter(
                (state: any) => state.status === "pending_review"
              ).length
            }
          </p>
          <p className="text-xs text-white/45">待验收</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          <p className="mt-2 text-2xl font-bold text-white">{completed}</p>
          <p className="text-xs text-white/45">已完成</p>
        </div>
      </div>
      {plan.plan.tasks.map((task: LcjBrainExecutionTask) => (
        <PublishedTask
          key={task.key}
          task={task}
          state={states.get(task.key)}
          plan={plan}
          data={data}
          projectStartDate={data.projectStartDate}
          defaultOpen={targetTaskKey === task.key}
          onRefresh={refresh}
        />
      ))}
      {!!plan.plan.unresolvedQuestions.length && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> 未解决问题
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {plan.plan.unresolvedQuestions.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
