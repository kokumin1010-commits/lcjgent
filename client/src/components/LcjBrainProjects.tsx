import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import {
  Calendar,
  Check,
  ChevronLeft,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
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
  const [creating, setCreating] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState<number | null>(null);
  const [createMemberIds, setCreateMemberIds] = useState<number[]>([]);
  const [memberError, setMemberError] = useState("");
  const list = trpc.lcjBrainProject.list.useQuery({ includeArchived: true });
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
      setProjectId(r.projectId);
      setCreating(false);
      setCreateTemplateId(null);
      setCreateMemberIds([]);
      setMemberError("");
    },
  });
  if (projectId)
    return <ProjectDetail id={projectId} onBack={() => setProjectId(null)} />;
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
                  保留概览、每日小结和SOP，所有人员可查看
                </span>
              </summary>
              <div className="mt-4">
                <ProjectGrid
                  projects={archivedProjects}
                  onOpen={setProjectId}
                  onJoin={() => undefined}
                  joinPending={false}
                />
              </div>
            </details>
          )}
        </div>
      )}
      {join.error && <p className="text-red-300">{join.error.message}</p>}
    </div>
  );
}

function ProjectGrid({
  projects,
  onOpen,
  onJoin,
  joinPending,
}: {
  projects: any[];
  onOpen: (projectId: number) => void;
  onJoin: (projectId: number) => void;
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
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
            <span
              className={`text-xs ${p.status === "archived" ? "text-white/45" : p.access.isParticipant ? "text-emerald-300" : "text-white/40"}`}
            >
              {p.status === "archived"
                ? "只读归档 · 可查看SOP"
                : p.access.canManage
                  ? "你是负责人"
                  : p.access.isParticipant
                    ? "你已参与"
                    : "公司项目 · 可加入参与"}
            </span>
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

function ProjectDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState("overview");
  const [sourceType, setSourceType] = useState<
    "meeting" | "daily_report" | "task" | "issue" | "knowledge"
  >("meeting");
  const [uploading, setUploading] = useState(false);
  const [settingsMemberIds, setSettingsMemberIds] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const detail = trpc.lcjBrainProject.get.useQuery({ projectId: id });
  const directory = trpc.lcjBrainProject.staffDirectory.useQuery();
  const canParticipate = detail.data?.access.canAddSource ?? false;
  useEffect(() => {
    setSettingsMemberIds(detail.data?.project.memberStaffIds || []);
  }, [id, detail.data?.project.version]);
  const sources = trpc.lcjBrainProject.sources.useQuery(
    { projectId: id, includeExcluded: false },
    { enabled: canParticipate }
  );
  const candidates = trpc.lcjBrainProject.candidates.useQuery(
    { projectId: id, sourceType },
    { enabled: tab === "sources" && canParticipate }
  );
  useEffect(() => {
    if (!canParticipate && (tab === "timeline" || tab === "sources"))
      setTab("overview");
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
  const coverage = detail.data.sopCoverage;
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
            {isArchived && detail.data.access.canManage && (
              <button
                type="button"
                disabled={update.isPending}
                onClick={() => setStatus("active")}
                className={actionClass}
              >
                {update.isPending ? "恢复中…" : "重新启用"}
              </button>
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
            此项目已归档并保持只读。所有登录人员可查看概览、每日小结和SOP；负责人重新启用后才能继续归集或修改。
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
              此历史归档没有SOP，因此不会生成空白模板。如需复用，请由负责人重新启用、生成SOP后再次归档。
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
                ? "所有人员可查看概览、每日小结和SOP；归档内容保持只读。"
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
            ["timeline", "时间线", canParticipate],
            ["sources", "资料库", canParticipate],
            ["daily", "每日小结", true],
            ["sop", "SOP", true],
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
          <Metric
            title="有效来源"
            value={detail.data.sourceCounts.reduce(
              (sum: number, row: any) => sum + Number(row.count || 0),
              0
            )}
          />
          <Metric title="每日小结" value={detail.data.dailySummaries.length} />
          <Metric title="SOP版本" value={detail.data.sopVersions.length} />
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
      {tab === "timeline" && canParticipate && (
        <SourceTimeline
          sources={sources.data || []}
          canManage={detail.data.access.canManage}
          onExclude={sourceId =>
            exclude.mutate({
              projectId: id,
              sourceId,
              excluded: true,
              reason: "项目负责人从时间线排除",
            })
          }
        />
      )}
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

function SourceTimeline({
  sources,
  canManage,
  onExclude,
}: {
  sources: any[];
  canManage: boolean;
  onExclude: (sourceId: number) => void;
}) {
  return (
    <div className="space-y-3">
      {sources.map(s => (
        <div
          key={s.id}
          id={`source-${s.id}`}
          className="rounded-xl border border-white/10 bg-white/5 p-4"
        >
          <div className="flex justify-between">
            <span className="text-violet-300 text-xs">
              {sourceLabel[s.sourceType]} · S{s.id}
            </span>
            <span className="text-white/40 text-xs">
              {new Date(s.occurredAt).toLocaleString()}
            </span>
          </div>
          <h3 className="text-white font-medium mt-1">{s.title}</h3>
          <p className="text-white/50 text-sm mt-2 whitespace-pre-wrap line-clamp-4">
            {s.summary || s.content}
          </p>
          <div className="flex justify-between mt-2">
            <p className="text-white/30 text-xs">{s.matchReason}</p>
            <div className="flex items-center gap-3">
              {s.sourceUrl && (
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-300 text-xs flex gap-1"
                >
                  查看原始来源
                  <ExternalLink className="w-3" />
                </a>
              )}
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
        </div>
      ))}
      {!sources.length && <Empty text="尚无来源，可在“资料库”导入或记录。" />}
    </div>
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
              <pre className="whitespace-pre-wrap text-sm text-white/70 font-sans max-h-[70vh] overflow-auto">
                {q.data?.markdown || "读取中…"}
              </pre>
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
