import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import { spreadsheetColumnName } from "@shared/spreadsheetCoordinates";
import LcjBrainExecutionPlan from "./LcjBrainExecutionPlan";
import {
  Calendar,
  Check,
  ChevronLeft,
  FileText,
  Images,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const statusLabel: Record<string, string> = {
  draft: "草稿",
  active: "进行中",
  completed: "已完成",
  archived: "已归档",
};
const sourceLabel: Record<string, string> = {
  meeting: "会议",
  daily_report: "日报",
  task: "任务",
  issue: "问题",
  knowledge: "知识",
  file: "资料",
  note: "记录",
  decision: "决策",
};
const inputClass =
  "w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white placeholder:text-white/30";
const actionClass =
  "px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:opacity-50 inline-flex items-center justify-center gap-2";

export default function LcjBrainProjects() {
  const utils = trpc.useUtils();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectInitialTab, setProjectInitialTab] = useState("overview");
  const [creating, setCreating] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState<number | null>(null);
  const [createMemberIds, setCreateMemberIds] = useState<number[]>([]);
  const [memberError, setMemberError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedProjectId = Number(params.get("projectId"));
    if (Number.isInteger(linkedProjectId) && linkedProjectId > 0) {
      setProjectInitialTab("execution");
      setProjectId(linkedProjectId);
      return;
    }
    const linkedTemplateId = Number(params.get("templateId"));
    if (Number.isInteger(linkedTemplateId) && linkedTemplateId > 0) {
      setCreateTemplateId(linkedTemplateId);
      setCreating(true);
    }
  }, []);
  const list = trpc.lcjBrainProject.list.useQuery({ includeArchived: true });
  const deletedList = trpc.lcjBrainProject.deletedList.useQuery();
  const templates = trpc.lcjBrainProject.templates.useQuery();
  const directory = trpc.lcjBrainProject.staffDirectory.useQuery();
  const selectedTemplate = templates.data?.find(
    (template: any) => Number(template.id) === createTemplateId
  );
  const activeProjects = (list.data || []).filter(
    (project: any) => project.status !== "archived"
  );
  const archivedProjects = (list.data || []).filter(
    (project: any) => project.status === "archived"
  );
  const join = trpc.lcjBrainProject.join.useMutation({
    onSuccess: () => utils.lcjBrainProject.list.invalidate(),
  });
  const create = trpc.lcjBrainProject.create.useMutation({
    onSuccess: async r => {
      await utils.lcjBrainProject.list.invalidate();
      setProjectInitialTab(r.templateId ? "execution" : "overview");
      setProjectId(r.projectId);
      setCreating(false);
      setCreateTemplateId(null);
      setCreateMemberIds([]);
      setMemberError("");
    },
  });
  const removeProject = trpc.lcjBrainProject.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.lcjBrainProject.list.invalidate(),
        utils.lcjBrainProject.deletedList.invalidate(),
        utils.lcjBrainProject.templates.invalidate(),
      ]);
      setDeleteTarget(null);
      setConfirmationName("");
    },
  });
  const restoreProject = trpc.lcjBrainProject.restore.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.lcjBrainProject.list.invalidate(),
        utils.lcjBrainProject.deletedList.invalidate(),
        utils.lcjBrainProject.templates.invalidate(),
      ]);
      setRestoreTarget(null);
      setConfirmationName("");
    },
  });
  const openDeleteDialog = (project: any) => {
    removeProject.reset();
    restoreProject.reset();
    setRestoreTarget(null);
    setDeleteTarget(project);
    setConfirmationName("");
  };
  const openRestoreDialog = (project: any) => {
    removeProject.reset();
    restoreProject.reset();
    setDeleteTarget(null);
    setRestoreTarget(project);
    setConfirmationName("");
  };
  if (projectId)
    return (
      <ProjectDetail
        id={projectId}
        initialTab={projectInitialTab}
        onBack={() => {
          setProjectId(null);
          setProjectInitialTab("overview");
        }}
      />
    );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">项目 / 活动 SOP</h2>
          <p className="text-sm text-white/50 mt-1">
            会议、资料、日报、任务和问题归集为可追溯SOP。
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 rounded-xl bg-violet-600 text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建项目
        </button>
      </div>
      {creating && (
        <form
          key={createTemplateId || "blank"}
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (!createMemberIds.length) {
              setMemberError("请至少选择一名项目成员");
              return;
            }
            setMemberError("");
            create.mutate({
              templateId: createTemplateId || undefined,
              name: String(f.get("name")),
              projectType: String(f.get("type")) as any,
              startDate: String(f.get("start")),
              endDate: String(f.get("end")) || null,
              description: null,
              objective: String(f.get("objective")),
              scope: String(f.get("scope")),
              keywords: String(f.get("keywords")).split(/[，,\n]/),
              memberUserIds: [],
              memberStaffIds: createMemberIds,
              currentPhase: "筹备",
              milestones: selectedTemplate?.milestonesTemplate || [],
              autoCollectEnabled: true,
              autoCollectMode: selectedTemplate?.autoCollectMode || "strict",
            });
          }}
          className="rounded-2xl border border-violet-400/20 bg-white/5 p-5 grid md:grid-cols-2 gap-3"
        >
          <label className="md:col-span-2 space-y-2 text-sm text-white/70">
            <span>SOP流程模板（可选）</span>
            <select
              value={createTemplateId || ""}
              onChange={event =>
                setCreateTemplateId(
                  event.target.value ? Number(event.target.value) : null
                )
              }
              className={inputClass}
            >
              <option value="">不使用模板，从空白项目开始</option>
              {(templates.data || []).map((template: any) => (
                <option key={template.id} value={template.id}>
                  {template.title} · v{template.sourceSopVersion} · R
                  {template.revision}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate && (
            <div className="md:col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-white/65">
              <p className="font-medium text-emerald-200">
                将使用：{selectedTemplate.title}
              </p>
              <p className="mt-1">
                来源于已归档项目“{selectedTemplate.sourceProjectName}”的SOP v
                {selectedTemplate.sourceSopVersion}；包含
                {selectedTemplate.phaseCount}个阶段、
                {selectedTemplate.checklistCount}组清单。
              </p>
              <p className="mt-1 text-white/45">
                只复制流程、目标、范围、关键词和里程碑；不会复制原成员、日期、资料、日报、证据编号或历史记录。
              </p>
            </div>
          )}
          <input
            name="name"
            required
            placeholder="项目名称"
            className={inputClass}
          />
          <select
            name="type"
            defaultValue={selectedTemplate?.projectType || "event"}
            className={inputClass}
          >
            <option value="event">活动</option>
            <option value="project">项目</option>
            <option value="campaign">Campaign</option>
            <option value="other">其他</option>
          </select>
          <input
            name="start"
            type="date"
            defaultValue={today()}
            required
            className={inputClass}
          />
          <input name="end" type="date" className={inputClass} />
          <MemberMultiSelect
            staff={directory.data?.staff || []}
            value={createMemberIds}
            onChange={ids => {
              setCreateMemberIds(ids);
              if (ids.length) setMemberError("");
            }}
            placeholder="搜索并选择项目成员（可多选）"
          />
          <input
            name="keywords"
            required
            defaultValue={(selectedTemplate?.keywordDefaults || []).join("、")}
            placeholder="关键词，以逗号分隔"
            className={inputClass}
          />
          <textarea
            name="objective"
            defaultValue={selectedTemplate?.objectiveTemplate || ""}
            placeholder="项目目标"
            className={inputClass}
          />
          <textarea
            name="scope"
            defaultValue={selectedTemplate?.scopeTemplate || ""}
            placeholder="项目范围"
            className={inputClass}
          />
          <div className="md:col-span-2 flex gap-2">
            <button
              disabled={create.isPending}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white"
            >
              {create.isPending ? "创建中…" : "创建"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setCreateTemplateId(null);
                setCreateMemberIds([]);
                setMemberError("");
              }}
              className="px-4 py-2 text-white/60"
            >
              取消
            </button>
          </div>
          {(memberError || create.error) && (
            <p className="md:col-span-2 text-red-300">
              {memberError || create.error?.message}
            </p>
          )}
        </form>
      )}
      {list.isLoading ? (
        <Loader2 className="animate-spin text-violet-300" />
      ) : (
        <div className="space-y-5">
          <ProjectGrid
            projects={activeProjects}
            onOpen={setProjectId}
            onDelete={openDeleteDialog}
            onJoin={joinedProjectId =>
              join.mutate({ projectId: joinedProjectId })
            }
            joinPending={join.isPending}
          />
          {archivedProjects.length > 0 && (
            <details
              open
              className="rounded-2xl border border-white/10 bg-black/10 p-4"
            >
              <summary className="cursor-pointer text-white font-medium">
                已归档项目 · {archivedProjects.length}件
                <span className="ml-2 text-xs font-normal text-white/40">
                  保留概览、每日小结和SOP；共享归档可查看资料明细
                </span>
              </summary>
              <div className="mt-4">
                <ProjectGrid
                  projects={archivedProjects}
                  onOpen={setProjectId}
                  onDelete={openDeleteDialog}
                  onJoin={() => undefined}
                  joinPending={false}
                />
              </div>
            </details>
          )}
          {(deletedList.data || []).length > 0 && (
            <details className="rounded-2xl border border-red-400/15 bg-red-950/10 p-4">
              <summary className="cursor-pointer text-sm font-medium text-white/60">
                已删除项目 · {deletedList.data?.length || 0}件
                <span className="ml-2 text-xs font-normal text-white/35">
                  仅超级管理员可见和恢复
                </span>
              </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(deletedList.data || []).map((project: any) => (
                  <div
                    key={project.id}
                    className="rounded-xl border border-red-400/15 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-red-300/70">
                          {project.projectCode}
                        </p>
                        <h3 className="mt-1 font-semibold text-white/75">
                          {project.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRestoreDialog(project)}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-400/10"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        恢复
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-white/35">
                      来源 {project.sourceCount} 条 · SOP {project.sopVersionCount} 版
                    </p>
                    <p className="mt-1 text-xs text-white/30">
                      删除时间：
                      {project.deletedAt
                        ? new Date(project.deletedAt).toLocaleString("zh-CN")
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {join.error && <p className="text-red-300">{join.error.message}</p>}
      {(deleteTarget || restoreTarget) && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4"
          role="presentation"
          onMouseDown={event => {
            if (
              event.currentTarget === event.target &&
              !removeProject.isPending &&
              !restoreProject.isPending
            ) {
              setDeleteTarget(null);
              setRestoreTarget(null);
              setConfirmationName("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-delete-title"
            className="w-full max-w-lg rounded-2xl border border-red-400/25 bg-[#111129] p-6 shadow-2xl"
          >
            <h3 id="project-delete-title" className="text-xl font-bold text-white">
              {deleteTarget ? "删除项目" : "恢复项目"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/60">
              {deleteTarget
                ? "删除后项目会从项目与归档列表隐藏，并停止自动归集；资料、SOP和审计记录会保留，超级管理员可从回收站恢复。关联的未完成任务会被取消。"
                : "恢复后项目重新出现在列表中，但自动归集和删除时取消的任务不会自动重启。"}
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs text-white/40">请完整输入项目名称以确认</p>
              <p className="mt-1 break-words font-semibold text-white">
                {(deleteTarget || restoreTarget).name}
              </p>
              <input
                autoFocus
                value={confirmationName}
                onChange={event => setConfirmationName(event.target.value)}
                className={`${inputClass} mt-3`}
                placeholder="输入项目名称"
              />
            </div>
            {(removeProject.error || restoreProject.error) && (
              <p role="alert" className="mt-3 text-sm text-red-300">
                {removeProject.error?.message || restoreProject.error?.message}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={removeProject.isPending || restoreProject.isPending}
                onClick={() => {
                  setDeleteTarget(null);
                  setRestoreTarget(null);
                  setConfirmationName("");
                }}
                className={actionClass}
              >
                取消
              </button>
              <button
                type="button"
                disabled={
                  confirmationName.trim() !==
                    String((deleteTarget || restoreTarget).name).trim() ||
                  removeProject.isPending ||
                  restoreProject.isPending
                }
                onClick={() => {
                  const target = deleteTarget || restoreTarget;
                  if (deleteTarget)
                    removeProject.mutate({
                      projectId: target.id,
                      expectedVersion: target.version,
                      confirmationName: confirmationName.trim(),
                    });
                  else
                    restoreProject.mutate({
                      projectId: target.id,
                      expectedVersion: target.version,
                      confirmationName: confirmationName.trim(),
                    });
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${deleteTarget ? "bg-red-600 hover:bg-red-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
              >
                {deleteTarget ? (
                  <Trash2 className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {removeProject.isPending || restoreProject.isPending
                  ? "处理中…"
                  : deleteTarget
                    ? "确认删除"
                    : "确认恢复"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectGrid({
  projects,
  onOpen,
  onJoin,
  onDelete,
  joinPending,
}: {
  projects: any[];
  onOpen: (projectId: number) => void;
  onJoin: (projectId: number) => void;
  onDelete: (project: any) => void;
  joinPending: boolean;
}) {
  if (!projects.length) return <Empty text="当前没有进行中或待启动的项目。" />;
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {projects.map(p => (
        <div
          key={p.id}
          className={`rounded-2xl border p-5 ${p.status === "archived" ? "border-white/10 bg-white/[0.03]" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
        >
          <button onClick={() => onOpen(p.id)} className="w-full text-left">
            <div className="flex justify-between gap-3">
              <span className="text-xs text-violet-300">{p.projectCode}</span>
              <span className="text-xs text-white/50">
                {statusLabel[p.status]}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white mt-2">{p.name}</h3>
            <p className="text-sm text-white/50 mt-2 line-clamp-2">
              {p.objective || "尚未填写目标"}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/40">
              <span>{p.sourceCount} 条来源</span>
              <span>
                {p.latestSopVersion
                  ? `SOP v${p.latestSopVersion}`
                  : "未生成SOP"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5" />
                {Math.max(p.memberUserIds.length, p.memberStaffIds.length)}{" "}
                人参与
              </span>
            </div>
          </button>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span
              className={`text-xs ${p.status === "archived" ? "text-white/45" : p.access.isParticipant ? "text-emerald-300" : "text-white/40"}`}
            >
              {p.status === "archived"
                ? p.projectCode === "LCF-20260908-FIRST-KNOWHOW"
                  ? "只读归档 · 全员可查看全部资料与SOP"
                  : "只读归档 · 可查看SOP"
                : p.access.canManage
                  ? "你是负责人"
                  : p.access.isParticipant
                    ? "你已参与"
                    : "公司项目 · 可加入参与"}
            </span>
            <div className="flex items-center gap-2">
              {p.access.canJoin && (
                <button
                  disabled={joinPending}
                  onClick={() => onJoin(p.id)}
                  className={`${actionClass} bg-violet-600 text-sm`}
                >
                  <UserPlus className="w-4" />
                  参与项目
                </button>
              )}
              {p.access.canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-400/25 px-2.5 py-2 text-xs text-red-200 hover:bg-red-500/10"
                  aria-label={`删除项目 ${p.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberMultiSelect({
  staff,
  value,
  onChange,
  placeholder,
}: {
  staff: any[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = staff.filter(member =>
    value.includes(Number(member.staffId))
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = staff.filter(member =>
    `${member.name} ${member.department || ""} ${member.position || ""}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
  const toggle = (staffId: number) => {
    onChange(
      value.includes(staffId)
        ? value.filter(id => id !== staffId)
        : [...value, staffId]
    );
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={`${inputClass} min-h-[50px] text-left flex items-center justify-between gap-3`}
        aria-expanded={open}
      >
        <span className={value.length ? "text-white" : "text-white/30"}>
          {value.length ? `已选择 ${value.length} 人` : placeholder}
        </span>
        <span className="text-xs text-violet-300 whitespace-nowrap">
          可多选
        </span>
      </button>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selected.map(member => (
            <span
              key={member.staffId}
              className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-400/30 px-2.5 py-1 text-xs text-violet-100"
            >
              {member.name}
              {member.department ? ` · ${member.department}` : ""}
              <button
                type="button"
                onClick={() => toggle(Number(member.staffId))}
                aria-label={`移除${member.name}`}
                className="text-white/50 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-white/40 hover:text-white"
          >
            清空
          </button>
        </div>
      )}
      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-violet-400/25 bg-[#121027] shadow-2xl p-2">
          <div className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 px-3">
            <Search className="w-4 h-4 text-white/40" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              autoFocus
              placeholder="输入姓名、部门或职位"
              className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/30"
            />
          </div>
          <div className="max-h-56 overflow-y-auto mt-2 space-y-1">
            {filtered.map(member => {
              const checked = value.includes(Number(member.staffId));
              return (
                <button
                  key={member.staffId}
                  type="button"
                  onClick={() => toggle(Number(member.staffId))}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left ${checked ? "bg-violet-500/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                >
                  <span
                    className={`w-5 h-5 rounded border flex items-center justify-center ${checked ? "bg-violet-600 border-violet-500" : "border-white/20"}`}
                  >
                    {checked && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm truncate">
                      {member.name}
                    </span>
                    <span className="block text-xs text-white/35 truncate">
                      {[member.department, member.position]
                        .filter(Boolean)
                        .join(" · ") || "未设置部门/职位"}
                    </span>
                  </span>
                </button>
              );
            })}
            {!filtered.length && (
              <p className="py-6 text-center text-sm text-white/40">
                没有匹配的员工
              </p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-white/10 mt-2 pt-2 px-1">
            <span className="text-xs text-white/40">
              已选 {value.length} 人
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
              className="text-sm text-violet-300 px-2 py-1"
            >
              完成
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectDetail({
  id,
  initialTab,
  onBack,
}: {
  id: number;
  initialTab: string;
  onBack: () => void;
}) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState(initialTab);
  const [sourceType, setSourceType] = useState<
    "meeting" | "daily_report" | "task" | "issue" | "knowledge"
  >("meeting");
  const [uploading, setUploading] = useState(false);
  const [settingsMemberIds, setSettingsMemberIds] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const detail = trpc.lcjBrainProject.get.useQuery({ projectId: id });
  const directory = trpc.lcjBrainProject.staffDirectory.useQuery();
  const canParticipate = detail.data?.access.canAddSource ?? false;
  const canViewSourceDetails = Boolean(
    detail.data &&
      (canParticipate ||
        detail.data.access.canManage ||
        (detail.data.project.status === "archived" &&
          detail.data.project.projectCode === "LCF-20260908-FIRST-KNOWHOW"))
  );
  useEffect(() => {
    setSettingsMemberIds(detail.data?.project.memberStaffIds || []);
  }, [id, detail.data?.project.version]);
  const sources = trpc.lcjBrainProject.sources.useQuery(
    { projectId: id, includeExcluded: false },
    { enabled: tab === "timeline" && canViewSourceDetails }
  );
  const candidates = trpc.lcjBrainProject.candidates.useQuery(
    { projectId: id, sourceType },
    { enabled: tab === "sources" && canParticipate }
  );
  useEffect(() => {
    if (!canParticipate && tab === "sources") setTab("timeline");
  }, [canParticipate, tab]);
  const refresh = async () => {
    await Promise.all([
      utils.lcjBrainProject.get.invalidate({ projectId: id }),
      utils.lcjBrainProject.sources.invalidate({
        projectId: id,
        includeExcluded: false,
      }),
      utils.lcjBrainProject.list.invalidate(),
    ]);
  };
  const daily = trpc.lcjBrainProject.runDailyNow.useMutation({
    onSuccess: refresh,
  });
  const gen = trpc.lcjBrainProject.generateSop.useMutation({
    onSuccess: async () => {
      await refresh();
      setTab("sop");
    },
    onError: error => alert(error.message),
  });
  const add = trpc.lcjBrainProject.addExistingSource.useMutation({
    onSuccess: refresh,
  });
  const note = trpc.lcjBrainProject.addManualSource.useMutation({
    onSuccess: refresh,
  });
  const update = trpc.lcjBrainProject.update.useMutation({
    onSuccess: async result => {
      if (result.project.status === "archived") {
        await Promise.all([
          utils.lcjBrainProject.list.invalidate(),
          utils.lcjBrainProject.templates.invalidate(),
        ]);
        onBack();
        return;
      }
      await refresh();
    },
  });
  const exclude = trpc.lcjBrainProject.excludeSource.useMutation({
    onSuccess: refresh,
  });
  const join = trpc.lcjBrainProject.join.useMutation({
    onSuccess: refresh,
    onError: error => alert(error.message),
  });
  const leave = trpc.lcjBrainProject.leave.useMutation({
    onSuccess: async () => {
      setTab("overview");
      await refresh();
    },
    onError: error => alert(error.message),
  });
  if (!detail.data) return <Loader2 className="animate-spin text-violet-300" />;
  const p: any = detail.data.project;
  const isArchived = p.status === "archived";
  const isLcfInternalBrain = p.projectCode === "LCF-20260908-FIRST-KNOWHOW";
  const coverage = detail.data.sopCoverage;
  const sourceTotal = detail.data.sourceCounts.reduce(
    (sum: number, row: any) => sum + Number(row.count || 0),
    0
  );
  const hasSop = detail.data.sopVersions.length > 0;
  const hasSopChanges =
    hasSop &&
    (coverage.pendingSourceCount > 0 || coverage.removedSourceCount > 0);
  const generateCurrentSop = () =>
    gen.mutate({
      projectId: id,
      status: p.status === "completed" ? "final" : "draft",
      mode: hasSop ? "incremental" : "full",
      baseVersionId: hasSop ? coverage.latestVersionId || undefined : undefined,
    });
  const setStatus = (status: any) =>
    update.mutate({ projectId: id, expectedVersion: p.version, status });
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(
        `/api/lcj-brain/project-document-upload?projectId=${id}`,
        { method: "POST", body: form, credentials: "include" }
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "上传失败");
      await refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-white/60 flex gap-2">
        <ChevronLeft className="w-4" />
        返回项目列表
      </button>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <span className="text-xs text-violet-300">
              {p.projectCode} · {statusLabel[p.status]}
            </span>
            <h2 className="text-2xl font-bold text-white mt-1">{p.name}</h2>
            <p className="text-white/50 mt-2">
              {p.objective || "尚未填写目标"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.data.access.canJoin && (
              <button
                disabled={join.isPending}
                onClick={() => join.mutate({ projectId: id })}
                className={`${actionClass} bg-violet-600`}
              >
                <UserPlus className="w-4" />
                {join.isPending ? "加入中" : "参与项目"}
              </button>
            )}
            {detail.data.access.canManage && !isArchived && (
              <>
                <button
                  disabled={daily.isPending}
                  onClick={() => daily.mutate({ projectId: id })}
                  className={actionClass}
                >
                  <RefreshCw className="w-4" />
                  立即整理
                </button>
                <button
                  disabled={gen.isPending || (hasSop && !hasSopChanges)}
                  onClick={generateCurrentSop}
                  className={`${actionClass} ${hasSopChanges ? "bg-amber-500 text-slate-950" : "bg-violet-600"}`}
                >
                  <Sparkles className="w-4" />
                  {gen.isPending
                    ? "更新中"
                    : !hasSop
                      ? "生成SOP"
                      : hasSopChanges
                        ? coverage.pendingSourceCount > 0
                          ? `补充更新SOP（${coverage.pendingSourceCount}）`
                          : `更新SOP（移除${coverage.removedSourceCount}）`
                        : "SOP已是最新"}
                </button>
                {p.status === "draft" && (
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => setStatus("active")}
                    className={actionClass}
                  >
                    启动项目
                  </button>
                )}
                {p.status === "active" && (
                  <button
                    type="button"
                    disabled={update.isPending}
                    onClick={() => setStatus("completed")}
                    className={actionClass}
                  >
                    结束项目
                  </button>
                )}
                {p.status !== "archived" && (
                  <button
                    type="button"
                    disabled={update.isPending || !hasSop || hasSopChanges}
                    onClick={() => setStatus("archived")}
                    className={actionClass}
                    title={
                      !hasSop
                        ? "请先生成SOP"
                        : hasSopChanges
                          ? "请先更新SOP，确保覆盖全部有效资料"
                          : "归档并把最新SOP固化为可复用模板"
                    }
                  >
                    {update.isPending ? "归档中…" : "归档"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/50">
          <Calendar className="w-4" />
          {p.startDate} — {p.endDate || "进行中"}
          <span>阶段：{p.currentPhase || "未设置"}</span>
          <span>项目版本：{p.version}</span>
        </div>
        {update.error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            状态更新失败：{update.error.message}
          </p>
        )}
      </div>
      {isArchived && (
        <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100">
          <p>
            {canViewSourceDetails
              ? isLcfInternalBrain
                ? "LCF第1回的36张工作表、表格布局、图片和完整流程已复制到LCJ Brain内部。所有登录人员都能直接查看和向AI提问，不需要打开QQ原始表。"
                : "此项目已归档并保持只读。所有登录人员都可打开全部资料明细、每日小结和SOP；历史内容不会再修改。"
              : "此项目已归档并保持只读。所有登录人员可查看概览、每日小结和SOP；资料明细仅负责人可查看。"}
          </p>
          {detail.data.archiveTemplate && (
            <p className="mt-2 text-sky-200/80">
              已生成流程模板：{detail.data.archiveTemplate.title} · 来源SOP v
              {detail.data.archiveTemplate.sourceSopVersion} · R
              {detail.data.archiveTemplate.revision}
            </p>
          )}
          {!detail.data.archiveTemplate && (
            <p className="mt-2 text-amber-200">
              此历史归档没有SOP，因此不会生成空白模板。如需继续同类活动，请新建项目并重新沉淀。
            </p>
          )}
        </div>
      )}
      {!isArchived && detail.data.access.canManage && (
        <div
          className={`rounded-xl border p-4 text-sm ${!hasSop || hasSopChanges ? "border-amber-400/25 bg-amber-400/10 text-amber-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"}`}
        >
          {!hasSop
            ? "归档前请先生成SOP。归档会把最新SOP固化为下次新建项目可选的流程模板。"
            : hasSopChanges
              ? "归档前请先更新SOP，确保模板覆盖全部当前有效资料。"
              : `SOP v${coverage.latestVersion}已可归档；归档后会生成独立模板快照，不会复制原成员、日期或证据。`}
        </div>
      )}
      {!detail.data.access.isParticipant && (
        <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-violet-100">
              {isArchived ? "这是公司归档项目" : "这是公司共享项目"}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {isArchived
                ? canViewSourceDetails
                  ? "所有人员可查看全部资料明细、每日小结和SOP；归档内容保持只读。"
                  : "所有人员可查看概览、每日小结和SOP；归档内容保持只读。"
                : "你可以查看项目进度、每日小结和SOP；加入后可上传资料、导入自己有权限的记录并参与沉淀。"}
            </p>
          </div>
          {detail.data.access.canJoin && (
            <button
              disabled={join.isPending}
              onClick={() => join.mutate({ projectId: id })}
              className={`${actionClass} bg-violet-600`}
            >
              <UserPlus className="w-4" />
              参与项目
            </button>
          )}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto">
        {(
          [
            ["overview", "概览", true],
            ["execution", "执行计划", true],
            ["timeline", `全部资料（${sourceTotal}）`, canViewSourceDetails],
            ["sources", "添加资料", canParticipate],
            ["daily", "每日小结", true],
            ["sop", isLcfInternalBrain ? "展会大脑 / SOP" : "SOP", true],
            ["settings", "设置", detail.data.access.canManage && !isArchived],
          ] as const
        )
          .filter(([, , visible]) => visible)
          .map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${tab === tabKey ? "bg-violet-600 text-white" : "bg-white/5 text-white/60"}`}
            >
              {label}
            </button>
          ))}
      </div>
      {tab === "overview" && (
        <div className="grid md:grid-cols-3 gap-4">
          <Metric title="有效来源" value={sourceTotal} />
          <Metric title="每日小结" value={detail.data.dailySummaries.length} />
          <Metric title="SOP版本" value={detail.data.sopVersions.length} />
          {canViewSourceDetails && (
            <button
              type="button"
              onClick={() => setTab("timeline")}
              className="md:col-span-3 flex items-center justify-between gap-4 rounded-xl border border-violet-400/30 bg-violet-500/10 p-5 text-left text-white hover:bg-violet-500/20"
            >
              <span>
                <span className="block font-semibold">打开全部资料明细</span>
                <span className="mt-1 block text-sm text-white/55">
                  {isLcfInternalBrain
                    ? `直接查看LCJ Brain内部的${sourceTotal}张工作表、单元格、图片与链接`
                    : `逐份查看${sourceTotal}份资料的完整内容`}
                </span>
              </span>
              <FileText className="h-6 w-6 shrink-0 text-violet-300" />
            </button>
          )}
          {isLcfInternalBrain && (
            <>
              <a
                href={`/master/lcj-brain?tab=chat&prompt=${encodeURIComponent("12月LCF展会应该从哪里开始？请根据9/8–9/9第1回的全部内部资料，按阶段、负责人、时间、检查项和验收标准告诉我。")}`}
                className="md:col-span-2 flex items-center justify-between gap-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-left text-white hover:bg-emerald-500/20"
              >
                <span>
                  <span className="block font-semibold">
                    向LCJ Brain询问下次展会
                  </span>
                  <span className="mt-1 block text-sm text-white/55">
                    可直接询问12月展会从哪里开始、展位、物料、人员、签到、直播、嘉宾、论坛、撤场和复盘。
                  </span>
                </span>
                <Sparkles className="h-6 w-6 shrink-0 text-emerald-300" />
              </a>
              {detail.data.archiveTemplate?.id && (
                <a
                  href={`/master/lcj-brain?tab=projects&templateId=${detail.data.archiveTemplate.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-sky-400/30 bg-sky-500/10 p-5 text-left text-white hover:bg-sky-500/20"
                >
                  <span>
                    <span className="block font-semibold">
                      创建12月 / 下一季度展会
                    </span>
                    <span className="mt-1 block text-sm text-white/55">
                      从这次流程模板开始，不复制旧日期、旧成员或完成状态。
                    </span>
                  </span>
                  <Plus className="h-6 w-6 shrink-0 text-sky-300" />
                </a>
              )}
            </>
          )}
          <div className="md:col-span-3 rounded-xl bg-white/5 border border-white/10 p-5 text-white/70">
            <p>
              <b>项目范围：</b>
              {p.scope || "未填写"}
            </p>
            <p className="mt-2">
              <b>自动归集：</b>
              {p.autoCollectEnabled
                ? `已启用 · ${p.autoCollectMode === "strict" ? "成员+关键词严格匹配" : "成员匹配"}`
                : "未启用"}
            </p>
            <p className="mt-2">
              <b>关键词：</b>
              {p.keywords.join("、") || "未设置"}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <b>参与成员：</b>
              <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-100">
                负责人 · {p.ownerName}
              </span>
              {(directory.data?.staff || [])
                .filter((member: any) =>
                  p.memberStaffIds.includes(Number(member.staffId))
                )
                .map((member: any) => (
                  <span
                    key={member.staffId}
                    className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/65"
                  >
                    {member.name}
                    {member.department ? ` · ${member.department}` : ""}
                  </span>
                ))}
              {detail.data.access.canLeave && (
                <button
                  disabled={leave.isPending}
                  onClick={() => leave.mutate({ projectId: id })}
                  className="ml-auto text-xs text-white/40 hover:text-red-300"
                >
                  {leave.isPending ? "退出中" : "退出项目"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {tab === "execution" && (
        <LcjBrainExecutionPlan
          project={p}
          canManage={detail.data.access.canManage && !isArchived}
        />
      )}
      {tab === "timeline" &&
        canViewSourceDetails &&
        (sources.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-6 text-white/60">
            <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
            正在读取全部资料明细…
          </div>
        ) : sources.error ? (
          <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-red-200">
            资料读取失败：{sources.error.message}
          </p>
        ) : (
          <SourceTimeline
            projectId={id}
            sources={sources.data || []}
            canManage={detail.data.access.canManage && !isArchived}
            internalArchive={isLcfInternalBrain}
            onExclude={sourceId =>
              exclude.mutate({
                projectId: id,
                sourceId,
                excluded: true,
                reason: "项目负责人从时间线排除",
              })
            }
          />
        ))}
      {tab === "sources" && canParticipate && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={e => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className={`${actionClass} bg-violet-600`}
            >
              <Upload className="w-4" />
              {uploading ? "上传中" : "上传项目资料"}
            </button>
            <ManualSource
              onAdd={(type, title, content) =>
                note.mutate({ projectId: id, sourceType: type, title, content })
              }
            />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {(
                [
                  "meeting",
                  "daily_report",
                  "task",
                  "issue",
                  "knowledge",
                ] as const
              ).map(t => (
                <button
                  key={t}
                  onClick={() => setSourceType(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${sourceType === t ? "bg-violet-600 text-white" : "bg-black/20 text-white/60"}`}
                >
                  {sourceLabel[t]}
                </button>
              ))}
            </div>
            {candidates.isLoading ? (
              <Loader2 className="animate-spin text-violet-300" />
            ) : (
              <div className="space-y-2">
                {candidates.data?.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-3 border-t border-white/10 py-3"
                  >
                    <div>
                      <p className="text-white">{c.title}</p>
                      <p className="text-xs text-white/40 mt-1 line-clamp-2">
                        {c.preview}
                      </p>
                      <p
                        className={`text-xs mt-1 ${c.autoMatch.matched ? "text-emerald-300" : "text-white/30"}`}
                      >
                        {c.autoMatch.reason}
                      </p>
                    </div>
                    <button
                      disabled={c.linked || add.isPending}
                      onClick={() =>
                        add.mutate({
                          projectId: id,
                          sourceType,
                          sourceId: c.id,
                        })
                      }
                      className={actionClass}
                    >
                      {c.linked ? "已关联" : "导入"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "daily" && (
        <div className="space-y-3">
          {detail.data.dailySummaries.map((d: any) => (
            <div
              className="rounded-xl bg-white/5 border border-white/10 p-4"
              key={d.id}
            >
              <b className="text-white">{d.summaryDate}</b>
              <p className="text-white/70 mt-2 whitespace-pre-wrap">
                {d.summary}
              </p>
              {d.completedItems?.length > 0 && (
                <p className="text-emerald-300 text-sm mt-3">
                  完成：{d.completedItems.join("；")}
                </p>
              )}
              {d.gaps?.length > 0 && (
                <p className="text-amber-300 text-sm mt-2">
                  缺失：{d.gaps.join("；")}
                </p>
              )}
              <p className="text-white/30 text-xs mt-2">
                来源：{d.sourceIds.map((x: number) => `S${x}`).join("、")}
              </p>
            </div>
          ))}
          {!detail.data.dailySummaries.length && (
            <Empty text="每日自动扫描后，这里会出现日结与缺失提醒。" />
          )}
        </div>
      )}
      {tab === "sop" && (
        <div className="space-y-3">
          {hasSop && hasSopChanges && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-amber-200">
                    当前SOP v{coverage.latestVersion}之后新增了{" "}
                    {coverage.pendingSourceCount} 份资料
                    {coverage.removedSourceCount > 0 &&
                      `，另有 ${coverage.removedSourceCount} 份来源已排除`}
                  </p>
                  <p className="mt-1 text-sm text-white/55">
                    更新会基于当前SOP整合新资料并生成新版本；旧版本不会覆盖，仍可查看和恢复。
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {coverage.pendingSources.slice(0, 8).map((source: any) => (
                      <span
                        key={source.id}
                        className="rounded-full bg-black/20 px-2.5 py-1 text-xs text-white/65"
                      >
                        S{source.id} · {source.title}
                      </span>
                    ))}
                    {coverage.pendingSourceCount > 8 && (
                      <span className="rounded-full bg-black/20 px-2.5 py-1 text-xs text-white/50">
                        另有 {coverage.pendingSourceCount - 8} 份
                      </span>
                    )}
                  </div>
                </div>
                {detail.data.access.canManage && (
                  <button
                    disabled={gen.isPending}
                    onClick={generateCurrentSop}
                    className={`${actionClass} bg-amber-500 text-slate-950`}
                  >
                    <Sparkles className="w-4" />
                    {gen.isPending ? "正在补充" : "补充并生成新版本"}
                  </button>
                )}
              </div>
            </div>
          )}
          {hasSop && !hasSopChanges && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              当前SOP v{coverage.latestVersion}已覆盖全部有效资料。
            </div>
          )}
          {detail.data.sopVersions.map((v: any) => (
            <SopVersion
              key={v.id}
              projectId={id}
              version={v}
              canEdit={detail.data.access.canManage && !isArchived}
              onSaved={refresh}
            />
          ))}
          {!detail.data.sopVersions.length && (
            <Empty text="生成后会保留不可覆盖的SOP版本和引用来源。" />
          )}
        </div>
      )}
      {tab === "settings" && detail.data.access.canManage && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-white/70">
          <p>负责人：{p.ownerName}</p>
          {detail.data.access.canManage ? (
            <form
              className="mt-4 grid md:grid-cols-2 gap-3"
              onSubmit={e => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                update.mutate({
                  projectId: id,
                  expectedVersion: p.version,
                  description: String(form.get("description") || ""),
                  objective: String(form.get("objective") || ""),
                  scope: String(form.get("scope") || ""),
                  currentPhase: String(form.get("currentPhase") || ""),
                  keywords: String(form.get("keywords") || "").split(/[，,\n]/),
                  memberStaffIds: settingsMemberIds,
                  memberUserIds: [],
                  autoCollectEnabled: form.get("autoCollectEnabled") === "on",
                  autoCollectMode: String(form.get("autoCollectMode")) as
                    | "strict"
                    | "member_only",
                });
              }}
            >
              <input
                name="currentPhase"
                defaultValue={p.currentPhase || ""}
                placeholder="当前阶段"
                className={inputClass}
              />
              <input
                name="keywords"
                defaultValue={p.keywords.join("、")}
                placeholder="关键词"
                className={inputClass}
              />
              <textarea
                name="objective"
                defaultValue={p.objective || ""}
                placeholder="目标"
                className={inputClass}
              />
              <textarea
                name="scope"
                defaultValue={p.scope || ""}
                placeholder="范围"
                className={inputClass}
              />
              <textarea
                name="description"
                defaultValue={p.description || ""}
                placeholder="说明"
                className={inputClass}
              />
              <MemberMultiSelect
                staff={directory.data?.staff || []}
                value={settingsMemberIds}
                onChange={setSettingsMemberIds}
                placeholder="搜索并选择项目成员（可多选）"
              />
              <label className="flex items-center gap-2">
                <input
                  name="autoCollectEnabled"
                  type="checkbox"
                  defaultChecked={p.autoCollectEnabled}
                />
                启用每日自动归集
              </label>
              <select
                name="autoCollectMode"
                defaultValue={p.autoCollectMode}
                className={inputClass}
              >
                <option value="strict">严格：成员 + 关键词</option>
                <option value="member_only">宽松：仅成员</option>
              </select>
              <button
                className={`${actionClass} bg-violet-600 md:col-span-2`}
                disabled={update.isPending}
              >
                保存设置
              </button>
            </form>
          ) : (
            <>
              <p className="mt-2">
                员工ID：{p.memberStaffIds.join("、") || "未设置"}
              </p>
              <p className="mt-2">关键词：{p.keywords.join("、")}</p>
            </>
          )}
          <p className="mt-4">
            最近自动扫描：{p.lastAutoCollectedDate || "尚未运行"}
          </p>
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="text-white font-medium mb-2">最近运行记录</p>
            {detail.data.runs.slice(0, 8).map((run: any) => (
              <div
                key={run.id}
                className="flex flex-wrap justify-between gap-2 py-2 text-xs border-b border-white/5"
              >
                <span>
                  {run.runType} · {run.status}
                </span>
                <span>
                  来源 {run.sourceCount} · {run.model || "未调用AI"} ·{" "}
                  {run.durationMs ?? "-"}ms
                </span>
                {run.errorMessage && (
                  <span className="w-full text-red-300">
                    {run.errorCode}: {run.errorMessage}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {(daily.error ||
        gen.error ||
        add.error ||
        note.error ||
        exclude.error ||
        join.error ||
        leave.error) && (
        <p className="text-red-300">
          {daily.error?.message ||
            gen.error?.message ||
            add.error?.message ||
            note.error?.message ||
            exclude.error?.message ||
            join.error?.message ||
            leave.error?.message}
        </p>
      )}
    </div>
  );
}

type InternalSheetCell = {
  row: number;
  col: number;
  coordinate: string;
  text: string;
  links?: string[];
};
type InternalSheetSnapshot = {
  kind: "lcj-internal-sheet";
  version: number;
  sheetId: string;
  name: string;
  sequence: number;
  importedRevision: number;
  maxRow: number;
  maxCol: number;
  cells: InternalSheetCell[];
  links: string[];
  images: Array<{
    name: string;
    mimeType?: string;
    byteSize?: number;
    row?: number;
    col?: number;
    coordinate?: string;
  }>;
};

function isInternalSheetSnapshot(value: any): value is InternalSheetSnapshot {
  return (
    value?.kind === "lcj-internal-sheet" &&
    Array.isArray(value.cells) &&
    Array.isArray(value.images)
  );
}

function SheetVisualCover({ sheet }: { sheet: InternalSheetSnapshot }) {
  const previewColumns = [...new Set(sheet.cells.map(cell => cell.col))]
    .sort((a, b) => a - b)
    .slice(0, 5);
  const previewRows = [...new Set(sheet.cells.map(cell => cell.row))]
    .sort((a, b) => a - b)
    .slice(0, 6);
  const previewMap = new Map(
    sheet.cells.map(cell => [`${cell.row}:${cell.col}`, cell.text])
  );
  return (
    <div className="overflow-hidden rounded-xl border border-violet-300/20 bg-gradient-to-br from-violet-950 via-[#25204d] to-slate-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">{sheet.name}</p>
          <p className="mt-1 text-[11px] text-white/45">
            此工作表没有原始照片 · 显示LCJ内部表格视觉封面
          </p>
        </div>
        <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[10px] font-medium text-violet-200">
          工作表预览
        </span>
      </div>
      <div className="overflow-hidden p-3">
        <div
          className="grid rounded-lg border border-white/10 bg-black/20 text-[10px] text-white/65"
          style={{
            gridTemplateColumns: `42px repeat(${Math.max(previewColumns.length, 1)}, minmax(84px, 1fr))`,
          }}
        >
          <div className="border-b border-r border-white/10 bg-white/5 p-2 text-center text-violet-200">
            行
          </div>
          {previewColumns.map(column => (
            <div
              key={`cover-column-${column}`}
              className="border-b border-r border-white/10 bg-white/5 p-2 text-center font-medium text-violet-200"
            >
              {spreadsheetColumnName(column)}
            </div>
          ))}
          {previewRows.map(row => (
            <Fragment key={`cover-row-${row}`}>
              <div className="border-b border-r border-white/10 bg-white/5 p-2 text-center text-violet-200">
                {row}
              </div>
              {previewColumns.map(column => (
                <div
                  key={`cover-cell-${row}-${column}`}
                  className="min-h-9 truncate border-b border-r border-white/10 p-2"
                  title={previewMap.get(`${row}:${column}`) || ""}
                >
                  {previewMap.get(`${row}:${column}`) || ""}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function InternalSheetViewer({
  projectId,
  sourceId,
  sheet,
  fallbackText,
}: {
  projectId: number;
  sourceId: number;
  sheet: InternalSheetSnapshot;
  fallbackText: string;
}) {
  const [mode, setMode] = useState<"table" | "text">("table");
  const assets = trpc.lcjBrainProject.sourceAssets.useQuery(
    { projectId, sourceId },
    { enabled: sheet.images.length > 0 }
  );
  const columns = useMemo(
    () => [...new Set(sheet.cells.map(cell => cell.col))].sort((a, b) => a - b),
    [sheet.cells]
  );
  const rows = useMemo(
    () => [...new Set(sheet.cells.map(cell => cell.row))].sort((a, b) => a - b),
    [sheet.cells]
  );
  const cellMap = useMemo(
    () => new Map(sheet.cells.map(cell => [`${cell.row}:${cell.col}`, cell])),
    [sheet.cells]
  );
  const loadedAssets = assets.data?.assets || [];
  const assetMap = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const asset of loadedAssets) {
      if (!Number.isInteger(asset.row) || !Number.isInteger(asset.col))
        continue;
      const key = `${asset.row}:${asset.col}`;
      map.set(key, [...(map.get(key) || []), asset]);
    }
    return map;
  }, [loadedAssets]);
  const imageMetaMap = useMemo(() => {
    const map = new Map<string, InternalSheetSnapshot["images"]>();
    for (const image of sheet.images) {
      if (!Number.isInteger(image.row) || !Number.isInteger(image.col))
        continue;
      const key = `${image.row}:${image.col}`;
      map.set(key, [...(map.get(key) || []), image]);
    }
    return map;
  }, [sheet.images]);
  const positionedImageCount = [...imageMetaMap.values()].reduce(
    (sum, images) => sum + images.length,
    0
  );
  const unpositionedAssets = loadedAssets.filter(
    (asset: any) => !Number.isInteger(asset.row) || !Number.isInteger(asset.col)
  );
  return (
    <div className="space-y-4">
      {sheet.images.length > 0 ? (
        <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 px-4 py-3 text-xs">
          <p className="font-medium text-violet-100">
            原表照片已按单元格位置放回表格
          </p>
          <p className="mt-1 text-white/50">
            共 {sheet.images.length} 张，其中 {positionedImageCount}{" "}
            张已定位；点击表格内照片可查看原图。
          </p>
          {assets.error ? (
            <p className="mt-2 text-red-300">
              照片读取失败：{assets.error.message}
            </p>
          ) : null}
        </div>
      ) : (
        <SheetVisualCover sheet={sheet} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-white/45">
          LCJ内部工作表 · {sheet.cells.length.toLocaleString()}个有值单元格 ·
          最大范围 {spreadsheetColumnName(Math.max(sheet.maxCol, 1))}
          {sheet.maxRow}
        </div>
        <div className="flex rounded-lg border border-white/10 bg-black/20 p-1">
          <button
            type="button"
            onClick={() => setMode("table")}
            className={`rounded-md px-3 py-1.5 text-xs ${mode === "table" ? "bg-violet-600 text-white" : "text-white/50"}`}
          >
            表格视图
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`rounded-md px-3 py-1.5 text-xs ${mode === "text" ? "bg-violet-600 text-white" : "text-white/50"}`}
          >
            逐格文字
          </button>
        </div>
      </div>
      {mode === "table" ? (
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-white/10">
          <table className="min-w-max border-collapse text-xs text-white/75">
            <thead className="sticky top-0 z-[1] bg-[#201d43] text-violet-200">
              <tr>
                <th className="sticky left-0 z-[2] border border-white/10 bg-[#201d43] px-2 py-2">
                  行
                </th>
                {columns.map(column => (
                  <th
                    key={column}
                    className="min-w-24 border border-white/10 px-3 py-2"
                  >
                    {spreadsheetColumnName(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row}>
                  <th className="sticky left-0 border border-white/10 bg-[#201d43] px-2 py-2 text-violet-200">
                    {row}
                  </th>
                  {columns.map(column => {
                    const cell = cellMap.get(`${row}:${column}`);
                    const cellKey = `${row}:${column}`;
                    const cellAssets = assetMap.get(cellKey) || [];
                    const cellImageMeta = imageMetaMap.get(cellKey) || [];
                    return (
                      <td
                        key={column}
                        title={cell?.coordinate}
                        className="max-w-72 whitespace-pre-wrap break-words border border-white/10 bg-black/15 px-3 py-2 align-top leading-5"
                      >
                        {cell?.text || ""}
                        {cellImageMeta.length > 0 ? (
                          <div
                            className={`${cell?.text ? "mt-2" : ""} grid gap-2`}
                          >
                            {assets.isLoading
                              ? cellImageMeta.map((image, index) => (
                                  <div
                                    key={`${image.coordinate || cellKey}-${index}`}
                                    className="flex h-28 min-w-40 animate-pulse items-center justify-center rounded-lg border border-violet-300/20 bg-white/5 text-[11px] text-white/40"
                                  >
                                    原照片读取中…
                                  </div>
                                ))
                              : cellAssets.map((asset: any) => (
                                  <a
                                    key={asset.index}
                                    href={asset.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block min-w-40 overflow-hidden rounded-lg border border-violet-300/25 bg-white/5"
                                  >
                                    <img
                                      src={asset.url}
                                      alt={asset.name}
                                      loading="lazy"
                                      className="h-40 w-full bg-white object-contain"
                                    />
                                    <p className="truncate px-2 py-1.5 text-[10px] text-violet-100/70">
                                      原表位置{" "}
                                      {asset.coordinate ||
                                        cell?.coordinate ||
                                        cellKey}
                                    </p>
                                  </a>
                                ))}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <SourceContent text={fallbackText || "此资料没有正文。"} />
      )}
      {unpositionedAssets.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-violet-200">
            原表未提供单元格坐标的图片（{unpositionedAssets.length}）
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unpositionedAssets.map((asset: any) => (
              <a
                key={asset.index}
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                className="overflow-hidden rounded-lg border border-white/10 bg-white/5"
              >
                <img
                  src={asset.url}
                  alt={asset.name}
                  loading="lazy"
                  className="h-44 w-full object-contain bg-white"
                />
                <p className="truncate px-3 py-2 text-xs text-white/55">
                  {asset.name}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
      {sheet.links.length > 0 && (
        <details className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <summary className="cursor-pointer text-xs font-medium text-white/60">
            相关业务链接（{sheet.links.length}）
          </summary>
          <div className="mt-3 space-y-2">
            {sheet.links.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-xs text-sky-300 underline"
              >
                业务链接 {index + 1}
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ProjectPhotoGallery({ projectId }: { projectId: number }) {
  const photos = trpc.lcjBrainProject.projectAssets.useInfiniteQuery(
    { projectId, limit: 8 },
    {
      staleTime: 5 * 60_000,
      getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    }
  );
  const pages = photos.data?.pages || [];
  const assets = pages.flatMap(page => page.assets);
  const total = pages[0]?.total || 0;
  const failedCount = pages.reduce((sum, page) => sum + page.failedCount, 0);
  return (
    <section className="rounded-xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-950/55 via-[#211b45] to-slate-950 p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-200">
            <Images className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">LCF原始照片总览</h3>
            <p className="mt-1 text-xs text-white/45">
              原工作簿中的照片已经复制到LCJ内部；不需要打开QQ原表
            </p>
          </div>
        </div>
        {photos.hasNextPage ? (
          <button
            type="button"
            onClick={() => void photos.fetchNextPage()}
            disabled={photos.isFetchingNextPage}
            className={actionClass}
          >
            {photos.isFetchingNextPage
              ? "照片加载中…"
              : `加载更多照片（${assets.length}/${total}）`}
          </button>
        ) : total > 0 ? (
          <span className="rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-200">
            已显示全部 {total} 张照片
          </span>
        ) : null}
      </div>
      {photos.isLoading ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse rounded-lg bg-white/10"
            />
          ))}
        </div>
      ) : photos.error ? (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-200">
          照片读取失败：{photos.error.message}
        </p>
      ) : assets.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset: any) => (
            <a
              key={`${asset.sourceId}-${asset.index}`}
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-xl border border-white/10 bg-white/5"
            >
              <img
                src={asset.url}
                alt={asset.name}
                loading="lazy"
                className="aspect-square w-full bg-white object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <div className="p-2.5">
                <p className="truncate text-xs font-medium text-white/75">
                  {asset.sheetName || asset.sourceTitle}
                </p>
                <p className="mt-1 truncate text-[10px] text-white/40">
                  {asset.coordinate
                    ? `${asset.name} · 原表 ${asset.coordinate}`
                    : asset.name}
                </p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/45">
          原工作簿没有可提取的照片；各工作表将显示LCJ表格视觉封面。
        </p>
      )}
      {failedCount > 0 ? (
        <p className="mt-3 text-xs text-amber-200">
          有 {failedCount} 张照片暂时无法生成读取链接，其他照片仍可正常查看。
        </p>
      ) : null}
    </section>
  );
}

function SourceTimeline({
  projectId,
  sources,
  canManage,
  internalArchive,
  onExclude,
}: {
  projectId: number;
  sources: any[];
  canManage: boolean;
  internalArchive: boolean;
  onExclude: (sourceId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const orderedSources = useMemo(
    () =>
      [...sources].sort((a, b) => {
        const left = String(a.fileName || "");
        const right = String(b.fileName || "");
        if (left && right)
          return left.localeCompare(right, undefined, { numeric: true });
        return Number(a.id) - Number(b.id);
      }),
    [sources]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleSources = orderedSources.filter(source =>
    `${source.title || ""}\n${source.summary || ""}\n${source.content || ""}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  );
  const visibleIds = visibleSources.map(source => Number(source.id));
  const allVisibleExpanded =
    visibleIds.length > 0 &&
    visibleIds.every(sourceId => expandedIds.includes(sourceId));
  const toggleSource = (sourceId: number) =>
    setExpandedIds(current =>
      current.includes(sourceId)
        ? current.filter(id => id !== sourceId)
        : [...current, sourceId]
    );
  return (
    <div className="space-y-3">
      {internalArchive ? <ProjectPhotoGallery projectId={projectId} /> : null}
      <div className="sticky top-0 z-10 rounded-xl border border-violet-400/20 bg-[#15132f]/95 p-4 shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-white">全部资料明细</p>
            <p className="mt-1 text-xs text-white/45">
              {internalArchive
                ? `共${sources.length}份，全部保存在LCJ Brain内部；可搜索、查看表格、单元格和图片`
                : `共${sources.length}份，可搜索、逐份打开或一次展开全部完整内容`}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setExpandedIds(current =>
                allVisibleExpanded
                  ? current.filter(id => !visibleIds.includes(id))
                  : [...new Set([...current, ...visibleIds])]
              )
            }
            disabled={!visibleIds.length}
            className={actionClass}
          >
            {allVisibleExpanded ? "收起当前资料" : "展开当前全部资料"}
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索工作表名称、单元格内容或关键词"
            className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/30"
          />
        </label>
        {normalizedQuery && (
          <p className="mt-2 text-xs text-violet-200/70">
            找到 {visibleSources.length} / {sources.length} 份资料
          </p>
        )}
      </div>
      {visibleSources.map((s, index) => {
        const sourceId = Number(s.id);
        const expanded = expandedIds.includes(sourceId);
        const fullContent = String(s.content || s.summary || "");
        const internalSheet = isInternalSheetSnapshot(s.structuredContent)
          ? s.structuredContent
          : null;
        return (
          <div
            key={s.id}
            id={`source-${s.id}`}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-violet-300 text-xs">
                  第{index + 1}份 · {sourceLabel[s.sourceType]} · S{s.id}
                </span>
                <h3 className="mt-1 font-medium text-white">{s.title}</h3>
              </div>
              <span className="text-white/40 text-xs">
                {new Date(s.occurredAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/55">
              {s.summary || "无摘要，请打开完整内容查看。"}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="text-xs text-white/35">
                <p>{s.fileName || s.matchReason || "已归档资料"}</p>
                <p className="mt-1">
                  完整内容：{fullContent.length.toLocaleString()} 字符
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!internalArchive && s.sourceUrl && (
                  <a
                    href={s.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-300 text-xs flex gap-1"
                  >
                    查看关联来源
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => toggleSource(sourceId)}
                  className={`${actionClass} ${expanded ? "bg-white/15" : "bg-violet-600"}`}
                  aria-expanded={expanded}
                >
                  <FileText className="h-4 w-4" />
                  {expanded
                    ? "收起LCJ内部资料"
                    : internalArchive
                      ? "打开LCJ内部资料"
                      : "打开完整内容"}
                </button>
                {canManage && (
                  <button
                    onClick={() => onExclude(Number(s.id))}
                    className="text-red-300/70 text-xs"
                  >
                    排除
                  </button>
                )}
              </div>
            </div>
            {expanded && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
                <p className="mb-3 text-xs font-medium text-violet-200">
                  {internalSheet ? "LCJ Brain内部完整资料" : "完整资料内容"}
                </p>
                {internalSheet ? (
                  <InternalSheetViewer
                    projectId={projectId}
                    sourceId={sourceId}
                    sheet={internalSheet}
                    fallbackText={fullContent}
                  />
                ) : (
                  <SourceContent text={fullContent || "此资料没有正文。"} />
                )}
              </div>
            )}
          </div>
        );
      })}
      {!visibleSources.length && (
        <Empty
          text={
            sources.length
              ? "没有找到包含该关键词的资料。"
              : "尚无来源，可在“添加资料”中导入或记录。"
          }
        />
      )}
    </div>
  );
}

function SourceContent({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>()\]]+)/g);
  return (
    <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-7 text-white/75">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 underline decoration-sky-300/40 underline-offset-2 hover:text-sky-200"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </pre>
  );
}
function ManualSource({
  onAdd,
}: {
  onAdd: (t: "note" | "decision", title: string, content: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return open ? (
    <form
      onSubmit={e => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onAdd(
          f.get("type") as any,
          String(f.get("title")),
          String(f.get("content"))
        );
        setOpen(false);
      }}
      className="w-full grid md:grid-cols-4 gap-2"
    >
      <select name="type" className={inputClass}>
        <option value="note">过程记录</option>
        <option value="decision">决策</option>
      </select>
      <input name="title" required placeholder="标题" className={inputClass} />
      <input
        name="content"
        required
        placeholder="内容"
        className={inputClass}
      />
      <button className={`${actionClass} bg-violet-600`}>保存</button>
    </form>
  ) : (
    <button onClick={() => setOpen(true)} className={actionClass}>
      <Plus className="w-4" />
      记录事项/决策
    </button>
  );
}

function StructuredSopView({ content }: { content: any }) {
  const list = (value: unknown): any[] => (Array.isArray(value) ? value : []);
  const sourceRefs = (value: unknown) => {
    const refs = list(value).map(Number).filter(Number.isFinite);
    return refs.length ? `依据：${refs.map(id => `S${id}`).join("、")}` : "";
  };
  return (
    <div className="max-h-[75vh] space-y-5 overflow-auto pr-1 text-sm text-white/75">
      <div className="grid gap-3 lg:grid-cols-2">
        {[content.objective, content.scope].map((item: any, index) =>
          item?.text ? (
            <div
              key={index}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <p className="text-xs font-medium text-violet-200">
                {index === 0 ? "目的" : "范围"}
              </p>
              <p className="mt-2 leading-6">{item.text}</p>
              <p className="mt-2 text-[11px] text-white/35">
                {sourceRefs(item.sourceRefs)}
              </p>
            </div>
          ) : null
        )}
      </div>
      {list(content.roles).length > 0 && (
        <section>
          <h4 className="mb-2 font-semibold text-white">责任分工</h4>
          <div className="grid gap-2 lg:grid-cols-2">
            {list(content.roles).map((role: any, index) => (
              <div
                key={index}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <p className="font-medium text-violet-200">{role.role}</p>
                <p className="mt-1 leading-6">{role.responsibility}</p>
                <p className="mt-2 text-[11px] text-white/35">
                  {sourceRefs(role.sourceRefs)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      {list(content.prerequisites).length > 0 && (
        <section>
          <h4 className="mb-2 font-semibold text-white">开始前必须完成</h4>
          <div className="space-y-2">
            {list(content.prerequisites).map((item: any, index) => (
              <div
                key={index}
                className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3"
              >
                <p>{item.item}</p>
                <p className="mt-2 text-[11px] text-white/35">
                  {sourceRefs(item.sourceRefs)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      {list(content.phases).length > 0 && (
        <section>
          <h4 className="mb-3 font-semibold text-white">完整执行流程</h4>
          <div className="space-y-4">
            {list(content.phases).map((phase: any, phaseIndex) => (
              <div
                key={phaseIndex}
                className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-4"
              >
                <h5 className="font-semibold text-violet-100">{phase.name}</h5>
                <p className="mt-1 text-white/55">目标：{phase.goal}</p>
                <div className="mt-3 space-y-3">
                  {list(phase.steps).map((step: any, stepIndex) => (
                    <div
                      key={stepIndex}
                      className="rounded-lg border border-white/10 bg-black/20 p-4"
                    >
                      <p className="font-medium text-white">
                        Step {step.order || stepIndex + 1}｜{step.action}
                      </p>
                      <p className="mt-2 text-emerald-200">
                        负责人：{step.owner || "待确认"}
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="text-xs text-white/40">输入</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {list(step.inputs).map((value, index) => (
                              <li key={index}>{value}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs text-white/40">输出</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5">
                            {list(step.outputs).map((value, index) => (
                              <li key={index}>{value}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-white/40">完成 / 验收标准</p>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-emerald-100">
                          {list(step.completionCriteria).map((value, index) => (
                            <li key={index}>{value}</li>
                          ))}
                        </ul>
                      </div>
                      {list(step.cautions).length > 0 && (
                        <div className="mt-3 rounded-md bg-amber-400/10 p-2 text-amber-100">
                          注意：{list(step.cautions).join("；")}
                        </div>
                      )}
                      <p className="mt-2 text-[11px] text-white/35">
                        {sourceRefs(step.sourceRefs)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {list(content.checklists).length > 0 && (
        <section>
          <h4 className="mb-2 font-semibold text-white">检查清单 / Gate</h4>
          <div className="grid gap-3 lg:grid-cols-2">
            {list(content.checklists).map((checklist: any, index) => (
              <div
                key={index}
                className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] p-4"
              >
                <p className="font-medium text-emerald-100">{checklist.name}</p>
                <ul className="mt-2 space-y-2">
                  {list(checklist.items).map((item, itemIndex) => (
                    <li key={itemIndex} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {[
          ["异常处理", content.exceptionHandling, "situation", "response"],
          ["风险与对策", content.risks, "risk", "mitigation"],
        ].map(([title, values, leftKey, rightKey]: any) =>
          list(values).length ? (
            <section
              key={title}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <h4 className="font-semibold text-white">{title}</h4>
              <div className="mt-2 space-y-3">
                {list(values).map((item: any, index) => (
                  <div key={index}>
                    <p className="font-medium text-amber-100">
                      {item[leftKey]}
                    </p>
                    <p className="mt-1 leading-6">{item[rightKey]}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null
        )}
      </div>
      {list(content.lessonsLearned).length > 0 && (
        <section className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-4">
          <h4 className="font-semibold text-sky-100">可复用经验</h4>
          {list(content.lessonsLearned).map((item: any, index) => (
            <p key={index} className="mt-2 leading-6">
              {item.lesson}
            </p>
          ))}
        </section>
      )}
      {(list(content.gaps).length > 0 ||
        list(content.unresolvedQuestions).length > 0) && (
        <section className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4">
          <h4 className="font-semibold text-red-100">
            仍需确认 / 不可当作完成事实
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {[...list(content.gaps), ...list(content.unresolvedQuestions)].map(
              (item, index) => (
                <li key={index}>{item}</li>
              )
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function SopVersion({
  projectId,
  version,
  canEdit,
  onSaved,
}: {
  projectId: number;
  version: any;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [viewMode, setViewMode] = useState<"workflow" | "document">("workflow");
  const q = trpc.lcjBrainProject.getSopVersion.useQuery(
    { projectId, versionId: version.id },
    { enabled: open }
  );
  const save = trpc.lcjBrainProject.saveSopRevision.useMutation({
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });
  const restore = trpc.lcjBrainProject.restoreSopVersion.useMutation({
    onSuccess: onSaved,
  });
  const markdown = useMemo(() => q.data?.markdown || "", [q.data]);
  const structured = q.data?.structuredContent as any;
  const hasStructuredWorkflow = Boolean(
    structured &&
      (Array.isArray(structured.phases) || Array.isArray(structured.checklists))
  );
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <button className="w-full text-left" onClick={() => setOpen(!open)}>
        <FileText className="w-4 inline mr-2 text-violet-300" />
        <span className="text-white font-medium">
          v{version.version} · {version.title}
        </span>
        <span className="float-right text-xs text-white/40">
          {version.status} · {version.model}
        </span>
        {version.reason && (
          <span
            className={`mt-1 block text-xs ${String(version.reason).startsWith("补充") ? "text-amber-200/80" : "text-white/35"}`}
          >
            {version.reason}
          </span>
        )}
      </button>
      {open && (
        <div className="mt-4">
          {editing ? (
            <form
              onSubmit={e => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save.mutate({
                  projectId,
                  baseVersionId: version.id,
                  title: String(f.get("title")),
                  markdown: String(f.get("markdown")),
                  status: version.status,
                  reason: "人工编辑并保存为新版本",
                });
              }}
            >
              <input
                name="title"
                defaultValue={q.data?.title}
                className={inputClass}
              />
              <textarea
                name="markdown"
                defaultValue={markdown}
                rows={22}
                className={`${inputClass} mt-2 font-mono text-sm`}
              />
              <button className={`${actionClass} bg-violet-600 mt-2`}>
                保存为新版本
              </button>
            </form>
          ) : (
            <>
              {q.data && hasStructuredWorkflow && (
                <div className="mb-4 flex rounded-lg border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("workflow")}
                    className={`rounded-md px-3 py-1.5 text-xs ${viewMode === "workflow" ? "bg-violet-600 text-white" : "text-white/50"}`}
                  >
                    流程视图
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("document")}
                    className={`rounded-md px-3 py-1.5 text-xs ${viewMode === "document" ? "bg-violet-600 text-white" : "text-white/50"}`}
                  >
                    完整原文
                  </button>
                </div>
              )}
              {q.isLoading ? (
                <p className="text-sm text-white/50">读取中…</p>
              ) : hasStructuredWorkflow && viewMode === "workflow" ? (
                <StructuredSopView content={structured} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-white/70 font-sans max-h-[70vh] overflow-auto">
                  {q.data?.markdown || "暂无内容"}
                </pre>
              )}
              {canEdit && q.data && (
                <button
                  onClick={() => setEditing(true)}
                  className={`${actionClass} mt-3`}
                >
                  编辑并另存新版本
                </button>
              )}
              {canEdit && q.data && (
                <button
                  disabled={restore.isPending}
                  onClick={() =>
                    restore.mutate({
                      projectId,
                      versionId: version.id,
                      reason: `恢复自 v${version.version}`,
                    })
                  }
                  className={`${actionClass} mt-3 ml-2`}
                >
                  恢复此版本
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-5">
      <p className="text-white/40 text-sm">{title}</p>
      <p className="text-3xl font-bold text-white mt-2">{value}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/40">
      {text}
    </div>
  );
}
