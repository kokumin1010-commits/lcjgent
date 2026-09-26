import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileImage,
  MailPlus,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExhibitionBoothMap,
  type BoothMapItem,
} from "@/components/ExhibitionBoothMap";
import { toast } from "sonner";

type AdminTab = "overview" | "users" | "map";

function downloadText(
  fileName: string,
  text: string,
  type = "text/csv;charset=utf-8"
) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "blue";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    rose: "bg-rose-100 text-rose-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return <Badge className={`${tones[tone]} border-0`}>{children}</Badge>;
}

export default function ExhibitionBoothAdmin() {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailAccountId, setDetailAccountId] = useState<number | null>(null);
  const [activeBooth, setActiveBooth] = useState<BoothMapItem | null>(null);
  const [assignProfileId, setAssignProfileId] = useState("");
  const [reason, setReason] = useState("LCJ管理者による確認・更新");
  const [createForm, setCreateForm] = useState({
    email: "",
    displayName: "",
    companyName: "",
    phone: "",
    brandName: "",
  });
  const utils = trpc.useUtils();
  const dashboard = trpc.exhibitionAdmin.dashboard.useQuery();
  const accounts = trpc.exhibitionAdmin.listAccounts.useQuery({
    search: search || undefined,
    limit: 300,
  });
  const booths = trpc.exhibitionAdmin.listBooths.useQuery();
  const detail = trpc.exhibitionAdmin.getAccountDetail.useQuery(
    { accountId: detailAccountId || 1 },
    { enabled: Boolean(detailAccountId) }
  );
  const exportCsv = trpc.exhibitionAdmin.exportAccountsCsv.useQuery(undefined, {
    enabled: false,
  });

  const refresh = async () => {
    await Promise.all([
      utils.exhibitionAdmin.dashboard.invalidate(),
      utils.exhibitionAdmin.listAccounts.invalidate(),
      utils.exhibitionAdmin.listBooths.invalidate(),
      detailAccountId
        ? utils.exhibitionAdmin.getAccountDetail.invalidate({
            accountId: detailAccountId,
          })
        : Promise.resolve(),
    ]);
  };
  const createAccount = trpc.exhibitionAdmin.createAccount.useMutation({
    onSuccess: async data => {
      toast.success(
        data.inviteSent
          ? "账号已创建并发送邀请"
          : `账号已创建；邮件未发送${data.inviteErrorCode ? `（${data.inviteErrorCode}）` : ""}`
      );
      setCreateOpen(false);
      setCreateForm({
        email: "",
        displayName: "",
        companyName: "",
        phone: "",
        brandName: "",
      });
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const resendInvite = trpc.exhibitionAdmin.resendInvite.useMutation({
    onSuccess: data =>
      data.success
        ? toast.success("邀请邮件已发送")
        : toast.error(`邮件发送失败：${data.errorCode || "unknown"}`),
    onError: error => toast.error(error.message),
  });
  const accountStatus = trpc.exhibitionAdmin.updateAccountStatus.useMutation({
    onSuccess: async () => {
      toast.success("账号状态已更新");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const assignBooth = trpc.exhibitionAdmin.assignBooth.useMutation({
    onSuccess: async data => {
      toast.success(`${data.boothCode} 已分配`);
      setActiveBooth(null);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const releaseBooth = trpc.exhibitionAdmin.releaseBooth.useMutation({
    onSuccess: async () => {
      toast.success("展位已释放");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const reviewProfile = trpc.exhibitionAdmin.reviewProfile.useMutation({
    onSuccess: async () => {
      toast.success("品牌资料审核已更新");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const reviewAsset = trpc.exhibitionAdmin.reviewAsset.useMutation({
    onSuccess: async () => {
      toast.success("素材审核已更新");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const assetDownload = trpc.exhibitionAdmin.getAssetDownload.useMutation({
    onSuccess: data => window.open(data.url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error(error.message),
  });

  const mapBooths = useMemo(
    () =>
      ((booths.data?.booths || []) as any[]).map(item => ({
        ...item,
        id: Number(item.id),
        x: Number(item.x),
        y: Number(item.y),
        width: Number(item.width),
        height: Number(item.height),
        occupancy: item.assignmentId
          ? ("occupied" as const)
          : ("available" as const),
      })),
    [booths.data?.booths]
  );

  const countCards = dashboard.data
    ? [
        {
          label: "品牌账号",
          value: dashboard.data.counts.accountCount,
          icon: Users,
          tone: "bg-sky-50 text-sky-700",
        },
        {
          label: "已选展位",
          value: dashboard.data.counts.selectedCount,
          icon: MapPinned,
          tone: "bg-amber-50 text-amber-700",
        },
        {
          label: "待审资料",
          value: dashboard.data.counts.submittedCount,
          icon: ShieldCheck,
          tone: "bg-violet-50 text-violet-700",
        },
        {
          label: "待审素材",
          value: dashboard.data.counts.pendingAssetCount,
          icon: FileImage,
          tone: "bg-rose-50 text-rose-700",
        },
      ]
    : [];

  return (
    <div className="min-h-[calc(100vh-60px)] bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-[.18em] text-amber-700">
              BRAND BOOTH MANAGEMENT
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              品牌展位管理
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              独立品牌账号、展位状态、品牌资料和私有素材的统一后台。
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-slate-900"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              创建品牌账号
            </Button>
          </div>
        </header>

        <nav className="inline-flex rounded-xl border bg-white p-1 shadow-sm">
          {[
            { id: "overview", label: "总览" },
            { id: "users", label: "品牌用户" },
            { id: "map", label: "展位地图" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as AdminTab)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {countCards.map(card => (
                <div
                  key={card.label}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}
                  >
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-sm text-slate-500">
                    {card.label}
                  </div>
                  <div className="mt-1 text-3xl font-bold text-slate-900">
                    {String(card.value ?? 0)}
                  </div>
                </div>
              ))}
            </section>
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-bold">活动设置</h2>
              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-slate-400">活动名称</div>
                  <div className="mt-1 font-semibold">
                    {dashboard.data?.event.name}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">场地</div>
                  <div className="mt-1 font-semibold">
                    {dashboard.data?.event.venue || "未设置"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">开始日期</div>
                  <div className="mt-1 font-semibold">
                    {dashboard.data?.event.startDate || "未设置"}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">结束日期</div>
                  <div className="mt-1 font-semibold">
                    {dashboard.data?.event.endDate || "未设置"}
                  </div>
                </div>
              </div>
            </section>
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">最近品牌用户</h2>
                <Button variant="ghost" onClick={() => setTab("users")}>
                  查看全部
                </Button>
              </div>
              <AccountTable
                rows={(accounts.data?.accounts || []).slice(0, 8) as any[]}
                onOpen={setDetailAccountId}
              />
            </section>
          </>
        )}

        {tab === "users" && (
          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="邮箱、公司、品牌、展位搜索"
                  className="pl-9"
                />
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  const result = await exportCsv.refetch();
                  if (result.data)
                    downloadText(result.data.fileName, result.data.csv);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                导出 CSV
              </Button>
            </div>
            <div className="mt-5">
              <AccountTable
                rows={(accounts.data?.accounts || []) as any[]}
                onOpen={setDetailAccountId}
              />
            </div>
          </section>
        )}

        {tab === "map" && (
          <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold">展位状态地图</h2>
              <p className="mt-1 text-sm text-slate-500">
                点击任意展位查看并进行人工分配。
              </p>
            </div>
            {booths.data && (
              <ExhibitionBoothMap
                imageUrl={booths.data.event.floorMapUrl}
                mapWidth={Number(booths.data.event.floorMapWidth)}
                mapHeight={Number(booths.data.event.floorMapHeight)}
                booths={mapBooths}
                activeBoothId={activeBooth?.id}
                adminMode
                onBoothClick={setActiveBooth}
              />
            )}
            {activeBooth && (
              <div className="mt-5 rounded-2xl border bg-slate-50 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold">
                      {activeBooth.boothCode}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {activeBooth.brandName
                        ? `${activeBooth.brandName} · ${activeBooth.assignmentStatus}`
                        : "空闲"}
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setActiveBooth(null)}>
                    关闭
                  </Button>
                </div>
                {activeBooth.brandName ? (
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDetailAccountId(
                          Number(
                            (
                              accounts.data?.accounts as any[] | undefined
                            )?.find(
                              row =>
                                Number(row.profileId) ===
                                Number((activeBooth as any).profileId)
                            )?.id || 0
                          )
                        )
                      }
                    >
                      查看用户
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() =>
                        releaseBooth.mutate({
                          profileId: Number((activeBooth as any).profileId),
                          reason,
                        })
                      }
                    >
                      释放展位
                    </Button>
                  </div>
                ) : activeBooth.boothType !== "stage" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
                    <select
                      value={assignProfileId}
                      onChange={event => setAssignProfileId(event.target.value)}
                      className="h-10 rounded-md border bg-white px-3 text-sm"
                    >
                      <option value="">选择品牌用户</option>
                      {(accounts.data?.accounts || [])
                        .filter((row: any) => !row.assignmentId)
                        .map((row: any) => (
                          <option key={row.profileId} value={row.profileId}>
                            {row.brandName} · {row.email}
                          </option>
                        ))}
                    </select>
                    <Input
                      value={reason}
                      onChange={event => setReason(event.target.value)}
                      placeholder="操作原因"
                    />
                    <Button
                      disabled={!assignProfileId}
                      onClick={() =>
                        assignBooth.mutate({
                          profileId: Number(assignProfileId),
                          boothId: activeBooth.id,
                          status: "confirmed",
                          reason,
                        })
                      }
                    >
                      确认分配
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    舞台区域不可分配。
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>创建品牌展位账号</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={event => {
              event.preventDefault();
              createAccount.mutate({
                ...createForm,
                phone: createForm.phone || undefined,
                sendInvite: true,
              });
            }}
          >
            {[
              ["email", "邮箱"],
              ["displayName", "联系人"],
              ["companyName", "公司名"],
              ["phone", "电话"],
              ["brandName", "品牌名"],
            ].map(([key, label]) => (
              <div
                key={key}
                className={
                  key === "brandName" ? "space-y-2 sm:col-span-2" : "space-y-2"
                }
              >
                <Label htmlFor={`create-${key}`}>{label}</Label>
                <Input
                  id={`create-${key}`}
                  type={key === "email" ? "email" : "text"}
                  required={key !== "phone"}
                  value={createForm[key as keyof typeof createForm]}
                  onChange={event =>
                    setCreateForm(value => ({
                      ...value,
                      [key]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
            <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
              创建后会发送初次密码设置邮件。不会创建 LCJ Mall
              会员或后台员工账号。
            </p>
            <Button
              type="submit"
              disabled={createAccount.isPending}
              className="sm:col-span-2"
            >
              <MailPlus className="mr-2 h-4 w-4" />
              创建并发送邀请
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(detailAccountId)}
        onOpenChange={open => !open && setDetailAccountId(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>品牌用户详情</DialogTitle>
          </DialogHeader>
          {detail.isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              加载中…
            </div>
          ) : (
            detail.data && (
              <AccountDetail
                data={detail.data as any}
                onDownload={assetId => assetDownload.mutate({ assetId })}
                onResend={() =>
                  resendInvite.mutate({
                    accountId: Number(
                      (detail.data as any).account.accountId || detailAccountId
                    ),
                  })
                }
                onStatus={status =>
                  accountStatus.mutate({
                    accountId: Number(
                      (detail.data as any).account.accountId || detailAccountId
                    ),
                    status,
                    reason,
                  })
                }
                onProfileReview={(reviewStatus, reviewNote, isPublic) =>
                  reviewProfile.mutate({
                    profileId: Number((detail.data as any).account.profileId),
                    reviewStatus,
                    reviewNote,
                    isPublic,
                  })
                }
                onAssetReview={(assetId, reviewStatus, reviewNote) =>
                  reviewAsset.mutate({ assetId, reviewStatus, reviewNote })
                }
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountTable({
  rows,
  onOpen,
}: {
  rows: any[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-slate-400">
            <th className="px-3 py-3">品牌 / 公司</th>
            <th className="px-3 py-3">联系人</th>
            <th className="px-3 py-3">邮箱</th>
            <th className="px-3 py-3">展位</th>
            <th className="px-3 py-3">资料</th>
            <th className="px-3 py-3">账号</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className="border-b last:border-0 hover:bg-slate-50"
            >
              <td className="px-3 py-4">
                <div className="font-semibold">{row.brandName}</div>
                <div className="text-xs text-slate-500">{row.companyName}</div>
              </td>
              <td className="px-3 py-4">{row.displayName}</td>
              <td className="px-3 py-4">{row.email}</td>
              <td className="px-3 py-4">{row.boothCode || "—"}</td>
              <td className="px-3 py-4">
                <Pill
                  tone={
                    row.reviewStatus === "approved"
                      ? "green"
                      : row.reviewStatus === "revision_required"
                        ? "rose"
                        : "amber"
                  }
                >
                  {row.reviewStatus}
                </Pill>
              </td>
              <td className="px-3 py-4">
                <Pill
                  tone={
                    row.status === "active"
                      ? "green"
                      : row.status === "suspended"
                        ? "rose"
                        : "slate"
                  }
                >
                  {row.status}
                </Pill>
              </td>
              <td className="px-3 py-4 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpen(Number(row.id))}
                >
                  详情
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500">
          没有符合条件的品牌用户
        </div>
      )}
    </div>
  );
}

function AccountDetail({
  data,
  onDownload,
  onResend,
  onStatus,
  onProfileReview,
  onAssetReview,
}: {
  data: any;
  onDownload: (id: number) => void;
  onResend: () => void;
  onStatus: (status: "invited" | "active" | "suspended") => void;
  onProfileReview: (
    status: "draft" | "submitted" | "revision_required" | "approved",
    note: string,
    isPublic: boolean
  ) => void;
  onAssetReview: (
    id: number,
    status: "pending" | "approved" | "revision_required",
    note: string
  ) => void;
}) {
  const [note, setNote] = useState(data.account.reviewNote || "");
  const account = data.account;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-slate-400">品牌</div>
          <div className="mt-1 font-semibold">{account.brandName}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">公司</div>
          <div className="mt-1 font-semibold">{account.companyName}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">展位</div>
          <div className="mt-1 font-semibold">
            {data.assignment?.boothCode || "未选择"}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">联系人</div>
          <div className="mt-1">
            {account.displayName} / {account.contactName}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">邮箱</div>
          <div className="mt-1">{account.email}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">电话</div>
          <div className="mt-1">
            {account.phone || account.contactPhone || "—"}
          </div>
        </div>
      </section>
      <section>
        <h3 className="font-bold">品牌介绍</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
          {account.brandIntro || "未填写"}
        </p>
      </section>
      <section className="space-y-3">
        <h3 className="font-bold">资料审核</h3>
        <Textarea
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="审核说明（退回修改时必填）"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onProfileReview("approved", note, true)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            通过并允许展示
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onProfileReview("revision_required", note, false)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            退回修改
          </Button>
        </div>
      </section>
      <section>
        <h3 className="font-bold">素材与版本</h3>
        <div className="mt-3 space-y-2">
          {data.assets.map((asset: any) => (
            <div
              key={asset.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <div className="text-sm font-semibold">
                  {asset.assetType} · v{asset.versionNumber}{" "}
                  {Boolean(asset.isCurrent) && <Pill tone="blue">current</Pill>}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {asset.originalFileName} ·{" "}
                  {(Number(asset.fileSize) / 1024 / 1024).toFixed(2)} MB ·{" "}
                  {asset.reviewStatus}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDownload(Number(asset.id))}
                >
                  查看
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onAssetReview(Number(asset.id), "approved", "")
                  }
                >
                  通过
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    onAssetReview(
                      Number(asset.id),
                      "revision_required",
                      note || "素材の修正をお願いします"
                    )
                  }
                >
                  退回
                </Button>
              </div>
            </div>
          ))}
          {data.assets.length === 0 && (
            <div className="text-sm text-slate-500">暂无素材</div>
          )}
        </div>
      </section>
      <section className="flex flex-wrap gap-2 border-t pt-5">
        <Button variant="outline" onClick={onResend}>
          发送邀请/重置邮件
        </Button>
        {account.status === "suspended" ? (
          <Button onClick={() => onStatus("active")}>恢复账号</Button>
        ) : (
          <Button variant="destructive" onClick={() => onStatus("suspended")}>
            停用账号
          </Button>
        )}
      </section>
    </div>
  );
}
