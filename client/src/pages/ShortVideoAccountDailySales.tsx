import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  getDefaultShortVideoReportDate,
  getTokyoToday,
  type ShortVideoDailyCurrency,
} from "../../../shared/shortVideoDaily";

type Sale = {
  id: number;
  reportDate: string;
  accountId: number;
  accountName: string;
  responsibleStaffId: number;
  responsibleName: string;
  orders: number;
  gmv: number;
  currency: ShortVideoDailyCurrency;
  notes: string | null;
  updatedAt: string | null;
};

type Props = { month: string };

const copy = {
  zh: {
    title: "账号每日GMV、订单数",
    subtitle:
      "每个账号每天登记一次后台真实销售，作为积分和绩效的唯一销售数据源",
    sourceBadge: "绩效与积分唯一销售来源",
    videoWarning: "不从单条视频推算订单或GMV，避免多条视频重复计算。",
    add: "填写账号日数据",
    date: "数据日期",
    account: "短视频账号",
    responsible: "绩效负责人",
    orders: "当日订单数",
    gmv: "当日GMV",
    currency: "币种",
    notes: "数据来源或备注",
    allAccount: "全部账号",
    allResponsible: "全部负责人",
    allCurrency: "全部币种",
    search: "搜索账号、负责人或备注",
    accountDays: "账号填报天数",
    totalOrders: "月订单数",
    jpyGmv: "月度GMV · JPY",
    cnyGmv: "月度GMV · CNY",
    daily: "账号每日销售汇总",
    accounts: "账号月度汇总",
    responsibles: "负责人月度汇总",
    records: "账号每日销售明细",
    empty: "这个月还没有账号每日销售数据",
    saved: "账号日数据已保存",
    updated: "账号日数据已更新",
    deleted: "账号日数据已删除",
    edit: "编辑账号日数据",
    delete: "删除账号日数据",
    deleteConfirm: "确定删除这条账号日数据吗？删除后仍保留审计记录。",
    duplicate: "同一账号同一天只能有一条有效记录，请编辑原记录。",
    required: "请选择账号和负责人",
    yesterday:
      "默认选择东京时间的昨天；可补录今天和过去日期，不能填写未来日期。",
    save: "保存账号日数据",
    cancel: "取消",
    actions: "操作",
    previous: "上一页",
    next: "下一页",
    count: "条",
    readonly: "当前账号只有查看权限",
    day: "日期",
  },
  ja: {
    title: "アカウント日次GMV・注文件数",
    subtitle:
      "アカウントごとの管理画面実績を1日1回入力し、評価・ポイントの唯一の売上データにします",
    sourceBadge: "評価・ポイント唯一の売上元",
    videoWarning:
      "動画別に注文・GMVを推定せず、複数動画による重複計上を防ぎます。",
    add: "アカウント日次を入力",
    date: "データ日",
    account: "短動画アカウント",
    responsible: "評価担当者",
    orders: "当日注文件数",
    gmv: "当日GMV",
    currency: "通貨",
    notes: "データ元・メモ",
    allAccount: "全アカウント",
    allResponsible: "全担当者",
    allCurrency: "全通貨",
    search: "アカウント・担当者・メモを検索",
    accountDays: "アカウント入力日数",
    totalOrders: "月間注文件数",
    jpyGmv: "月間GMV・JPY",
    cnyGmv: "月間GMV・CNY",
    daily: "アカウント日次売上集計",
    accounts: "アカウント月次集計",
    responsibles: "担当者月次集計",
    records: "アカウント日次売上明細",
    empty: "この月のアカウント日次売上はまだありません",
    saved: "アカウント日次を保存しました",
    updated: "アカウント日次を更新しました",
    deleted: "アカウント日次を削除しました",
    edit: "アカウント日次を編集",
    delete: "アカウント日次を削除",
    deleteConfirm: "このアカウント日次を削除しますか？監査履歴は保持されます。",
    duplicate:
      "同じアカウント・同じ日付は1件だけです。既存データを編集してください。",
    required: "アカウントと担当者を選択してください",
    yesterday:
      "東京時間の昨日が初期値です。今日以前は補完できますが未来日は登録できません。",
    save: "アカウント日次を保存",
    cancel: "キャンセル",
    actions: "操作",
    previous: "前へ",
    next: "次へ",
    count: "件",
    readonly: "現在のアカウントは閲覧権限のみです",
    day: "日付",
  },
};

function numberInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(
    value || 0
  );
}

function formatMoney(value: number, currency: ShortVideoDailyCurrency): string {
  return new Intl.NumberFormat(currency === "JPY" ? "ja-JP" : "zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value || 0);
}

function currencyMetric(
  currencies:
    | Array<{
        currency: ShortVideoDailyCurrency;
        recordCount: number;
        orders: number;
        gmv: number;
      }>
    | undefined,
  currency: ShortVideoDailyCurrency
) {
  return currencies?.find(item => item.currency === currency);
}

export default function ShortVideoAccountDailySales({ month }: Props) {
  const { language } = useLanguage();
  const t = language === "ja" ? copy.ja : copy.zh;
  const utils = trpc.useUtils();
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [reportDate, setReportDate] = useState(() =>
    getDefaultShortVideoReportDate()
  );
  const [accountId, setAccountId] = useState("");
  const [responsibleStaffId, setResponsibleStaffId] = useState("");
  const [orders, setOrders] = useState("0");
  const [gmv, setGmv] = useState("0");
  const [currency, setCurrency] = useState<ShortVideoDailyCurrency>("JPY");
  const [notes, setNotes] = useState("");
  const pageSize = 50;

  const accessQuery = trpc.shortVideoDaily.access.useQuery();
  const accountsQuery = trpc.shortVideoDaily.listAccounts.useQuery();
  const producersQuery = trpc.shortVideoDaily.listProducers.useQuery();
  const listInput = useMemo(
    () => ({
      month,
      responsibleStaffId:
        responsibleFilter === "all" ? undefined : Number(responsibleFilter),
      accountId: accountFilter === "all" ? undefined : Number(accountFilter),
      currency:
        currencyFilter === "all"
          ? undefined
          : (currencyFilter as ShortVideoDailyCurrency),
      search: search.trim() || undefined,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [month, responsibleFilter, accountFilter, currencyFilter, search, page]
  );
  const listQuery = trpc.shortVideoAccountDaily.list.useQuery(listInput);
  const summaryQuery = trpc.shortVideoAccountDaily.monthlySummary.useQuery({
    month,
  });

  const invalidate = async () => {
    await Promise.all([
      utils.shortVideoAccountDaily.list.invalidate(),
      utils.shortVideoAccountDaily.monthlySummary.invalidate(),
    ]);
  };
  const createMutation = trpc.shortVideoAccountDaily.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      toast.success(t.saved);
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.shortVideoAccountDaily.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      toast.success(t.updated);
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.shortVideoAccountDaily.delete.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success(t.deleted);
    },
    onError: error => toast.error(error.message),
  });

  const canEdit = accessQuery.data?.canEdit === true;
  const items = (listQuery.data?.items || []) as Sale[];
  const totalPages = Math.max(
    1,
    Math.ceil((listQuery.data?.total || 0) / pageSize)
  );
  const jpy = currencyMetric(summaryQuery.data?.currencies, "JPY");
  const cny = currencyMetric(summaryQuery.data?.currencies, "CNY");
  const accountDays = (jpy?.recordCount || 0) + (cny?.recordCount || 0);
  const totalOrders = (jpy?.orders || 0) + (cny?.orders || 0);
  const busy = createMutation.isPending || updateMutation.isPending;

  const openCreate = () => {
    setEditing(null);
    setReportDate(getDefaultShortVideoReportDate());
    setAccountId(
      accountsQuery.data?.[0]?.id ? String(accountsQuery.data[0].id) : ""
    );
    setResponsibleStaffId(
      producersQuery.data?.[0]?.id ? String(producersQuery.data[0].id) : ""
    );
    setOrders("0");
    setGmv("0");
    setCurrency("JPY");
    setNotes("");
    setDialogOpen(true);
  };

  const openEdit = (item: Sale) => {
    setEditing(item);
    setReportDate(item.reportDate);
    setAccountId(String(item.accountId));
    setResponsibleStaffId(String(item.responsibleStaffId));
    setOrders(String(item.orders));
    setGmv(String(item.gmv));
    setCurrency(item.currency);
    setNotes(item.notes || "");
    setDialogOpen(true);
  };

  const payload = () => ({
    reportDate,
    accountId: Number(accountId),
    responsibleStaffId: Number(responsibleStaffId),
    orders: numberInput(orders),
    gmv: numberInput(gmv),
    currency,
    notes: notes.trim() || null,
  });

  const save = () => {
    if (!accountId || !responsibleStaffId) return toast.error(t.required);
    if (editing) updateMutation.mutate({ id: editing.id, entry: payload() });
    else createMutation.mutate(payload());
  };

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
              <Coins className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold">{t.title}</h2>
            <Badge className="bg-emerald-700">{t.sourceBadge}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>
          <p className="mt-1 text-xs font-medium text-amber-700">
            {t.videoWarning}
          </p>
        </div>
        {canEdit ? (
          <Button
            onClick={openCreate}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            {t.add}
          </Button>
        ) : (
          <Badge variant="outline">{t.readonly}</Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SalesMetric
          icon={CalendarDays}
          label={t.accountDays}
          value={formatNumber(accountDays)}
          tone="blue"
        />
        <SalesMetric
          icon={ShoppingCart}
          label={t.totalOrders}
          value={formatNumber(totalOrders)}
          tone="amber"
        />
        <SalesMetric
          icon={WalletCards}
          label={t.jpyGmv}
          value={formatMoney(jpy?.gmv || 0, "JPY")}
          tone="emerald"
        />
        <SalesMetric
          icon={WalletCards}
          label={t.cnyGmv}
          value={formatMoney(cny?.gmv || 0, "CNY")}
          tone="violet"
        />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label={t.responsible}
            value={responsibleFilter}
            onChange={value => {
              setResponsibleFilter(value);
              setPage(0);
            }}
            allLabel={t.allResponsible}
            items={(producersQuery.data || []).map(item => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
          <FilterSelect
            label={t.account}
            value={accountFilter}
            onChange={value => {
              setAccountFilter(value);
              setPage(0);
            }}
            allLabel={t.allAccount}
            items={(accountsQuery.data || []).map(item => ({
              value: String(item.id),
              label: item.displayName || `@${item.accountName}`,
            }))}
          />
          <FilterSelect
            label={t.currency}
            value={currencyFilter}
            onChange={value => {
              setCurrencyFilter(value);
              setPage(0);
            }}
            allLabel={t.allCurrency}
            items={[
              { value: "JPY", label: "JPY" },
              { value: "CNY", label: "CNY" },
            ]}
          />
          <label className="space-y-1 text-xs font-medium">
            <span>{t.search}</span>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
                className="pl-9"
                placeholder={t.search}
              />
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <SummaryCard title={t.daily} icon={CalendarDays}>
          {summaryQuery.data?.daily.length ? (
            summaryQuery.data.daily.map(day => (
              <SummaryRow
                key={day.reportDate}
                title={day.reportDate}
                currencies={day.currencies}
              />
            ))
          ) : (
            <SalesEmpty text={t.empty} />
          )}
        </SummaryCard>
        <SummaryCard title={t.accounts} icon={BarChart3}>
          {summaryQuery.data?.accounts.length ? (
            summaryQuery.data.accounts.map(item => (
              <SummaryRow
                key={item.accountId}
                title={item.accountName}
                currencies={item.currencies}
              />
            ))
          ) : (
            <SalesEmpty text={t.empty} />
          )}
        </SummaryCard>
        <SummaryCard title={t.responsibles} icon={UserRound}>
          {summaryQuery.data?.responsibles.length ? (
            summaryQuery.data.responsibles.map(item => (
              <SummaryRow
                key={item.responsibleStaffId}
                title={item.responsibleName}
                currencies={item.currencies}
              />
            ))
          ) : (
            <SalesEmpty text={t.empty} />
          )}
        </SummaryCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-emerald-700" />
            {t.records}
            <Badge variant="secondary">
              {listQuery.data?.total || 0}
              {t.count}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <div className="py-12">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <SalesEmpty text={t.empty} />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs">
                    <tr>
                      <th className="p-3">{t.day}</th>
                      <th className="p-3">{t.account}</th>
                      <th className="p-3">{t.responsible}</th>
                      <th className="p-3 text-right">{t.orders}</th>
                      <th className="p-3 text-right">{t.gmv}</th>
                      <th className="p-3">{t.notes}</th>
                      <th className="p-3">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{item.reportDate}</td>
                        <td className="p-3">{item.accountName}</td>
                        <td className="p-3">{item.responsibleName}</td>
                        <td className="p-3 text-right font-semibold">
                          {formatNumber(item.orders)}
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-700">
                          {formatMoney(item.gmv, item.currency)}
                        </td>
                        <td className="max-w-[260px] truncate p-3 text-xs text-muted-foreground">
                          {item.notes || "—"}
                        </td>
                        <td className="p-3">
                          {canEdit ? (
                            <ActionButtons
                              editLabel={t.edit}
                              deleteLabel={t.delete}
                              onEdit={() => openEdit(item)}
                              onDelete={() => {
                                if (confirm(t.deleteConfirm))
                                  deleteMutation.mutate({ id: item.id });
                              }}
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {items.map(item => (
                  <div key={item.id} className="rounded-xl border bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          {item.reportDate} · {item.accountName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.responsibleName}
                        </div>
                      </div>
                      <Badge>{item.currency}</Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <span>
                        {t.orders}: <b>{formatNumber(item.orders)}</b>
                      </span>
                      <span className="text-emerald-700">
                        GMV: <b>{formatMoney(item.gmv, item.currency)}</b>
                      </span>
                    </div>
                    {item.notes ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.notes}
                      </p>
                    ) : null}
                    {canEdit ? (
                      <div className="mt-2 flex justify-end">
                        <ActionButtons
                          editLabel={t.edit}
                          deleteLabel={t.delete}
                          onEdit={() => openEdit(item)}
                          onDelete={() => {
                            if (confirm(t.deleteConfirm))
                              deleteMutation.mutate({ id: item.id });
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          )}
          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2 border-t p-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(current => current - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                {t.previous}
              </Button>
              <span className="text-sm">
                {page + 1}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage(current => current + 1)}
              >
                {t.next}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto sm:!max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? t.edit : t.add}</DialogTitle>
            <DialogDescription>{t.yesterday}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">
              <span>{t.date} *</span>
              <Input
                type="date"
                max={getTokyoToday()}
                value={reportDate}
                onChange={event => setReportDate(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>{t.account} *</span>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.account} />
                </SelectTrigger>
                <SelectContent>
                  {accountsQuery.data?.map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.displayName || `@${item.accountName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>{t.responsible} *</span>
              <Select
                value={responsibleStaffId}
                onValueChange={setResponsibleStaffId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.responsible} />
                </SelectTrigger>
                <SelectContent>
                  {producersQuery.data?.map(item => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>{t.currency} *</span>
              <Select
                value={currency}
                onValueChange={value =>
                  setCurrency(value as ShortVideoDailyCurrency)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JPY">JPY</SelectItem>
                  <SelectItem value="CNY">CNY</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>{t.orders} *</span>
              <Input
                type="number"
                min="0"
                step="1"
                value={orders}
                onChange={event => setOrders(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>{t.gmv} *</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={gmv}
                onChange={event => setGmv(event.target.value)}
              />
            </label>
          </div>
          <label className="space-y-1 text-sm font-medium">
            <span>{t.notes}</span>
            <Textarea
              rows={3}
              value={notes}
              onChange={event => setNotes(event.target.value)}
              placeholder={
                language === "ja"
                  ? "例：TikTok Shop管理画面・返金除外前"
                  : "例如：TikTok Shop后台、退款前口径"
              }
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SalesMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  tone: "blue" | "amber" | "emerald" | "violet";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={`rounded-lg p-1.5 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-1 text-xs font-medium">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {items.map(item => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SummaryCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-emerald-700" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-80 space-y-2 overflow-y-auto">
        {children}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  title,
  currencies,
}: {
  title: string;
  currencies: Array<{
    currency: ShortVideoDailyCurrency;
    recordCount: number;
    orders: number;
    gmv: number;
  }>;
}) {
  const { language } = useLanguage();
  const jpy = currencyMetric(currencies, "JPY");
  const cny = currencyMetric(currencies, "CNY");
  const accountDayLabel = language === "ja" ? "アカウント日" : "账号日";
  const orderLabel = language === "ja" ? "注文" : "订单";
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
        <span>
          {formatNumber((jpy?.recordCount || 0) + (cny?.recordCount || 0))}{" "}
          {accountDayLabel} ·{" "}
          {formatNumber((jpy?.orders || 0) + (cny?.orders || 0))} {orderLabel}
        </span>
        <span className="font-semibold text-emerald-700">
          JPY {formatMoney(jpy?.gmv || 0, "JPY")}
          {cny?.recordCount ? ` / CNY ${formatMoney(cny.gmv, "CNY")}` : ""}
        </span>
      </div>
    </div>
  );
}

function ActionButtons({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={editLabel}
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
}

function SalesEmpty({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      <Coins className="mx-auto mb-2 h-7 w-7 opacity-30" />
      {text}
    </div>
  );
}
