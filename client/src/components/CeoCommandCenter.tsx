import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Crown,
  Database,
  FileCheck2,
  ListChecks,
  Loader2,
  LockKeyhole,
  Mic2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

type ChatSource = {
  id: string;
  label: string;
  href: string;
  period: string;
  updatedAt: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  generatedAt?: string;
};

const statusClass: Record<string, string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-800",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  healthy: "border-emerald-300 bg-emerald-50 text-emerald-800",
  info: "border-blue-300 bg-blue-50 text-blue-800",
  restricted: "border-slate-300 bg-slate-50 text-slate-700",
};

const alertClass: Record<string, string> = {
  high: "border-rose-300 bg-rose-50/80",
  medium: "border-amber-300 bg-amber-50/80",
  info: "border-blue-200 bg-blue-50/70",
};

function money(value: number | null, language: string) {
  if (value == null) return language.startsWith("zh") ? "未登记" : "未登録";
  return `¥${Math.round(value).toLocaleString()}`;
}

function dateTime(value: string | null, language: string) {
  if (!value) return language.startsWith("zh") ? "无记录" : "記録なし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language.startsWith("zh") ? "zh-CN" : "ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(value: string) {
  const [, month = "", day = ""] = value.split("-");
  return `${month}/${day}`;
}

function statusLabel(status: string, zh: boolean) {
  const labels: Record<string, [string, string]> = {
    critical: ["重大", "重大"],
    warning: ["注意", "注意"],
    healthy: ["正常", "正常"],
    info: ["確認", "待确认"],
    restricted: ["保護中", "受保护"],
  };
  return labels[status]?.[zh ? 1 : 0] || status;
}

export default function CeoCommandCenter() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const zh = language.startsWith("zh");
  const overviewQuery = trpc.ceoCommandCenter.overview.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const ask = trpc.ceoCommandCenter.ask.useMutation({
    onSuccess: (data) => {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          generatedAt: data.generatedAt,
        },
      ]);
    },
    onError: () => {
      toast.error(zh ? "CEO AI暂时无法回答，请稍后重试" : "CEO AIが回答できませんでした。時間をおいて再試行してください");
    },
  });

  const sendQuestion = (preset?: string) => {
    const value = (preset ?? question).trim();
    if (value.length < 2 || ask.isPending) return;
    const nextUserMessage: ChatMessage = { role: "user", content: value };
    const history = messages
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, nextUserMessage]);
    setQuestion("");
    ask.mutate({ question: value, language: zh ? "zh" : "ja", history });
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-9 w-9 text-rose-600" />
          <div>
            <p className="font-semibold text-rose-900">{zh ? "CEO司令塔读取失败" : "CEO司令塔を読み込めませんでした"}</p>
            <p className="mt-1 text-sm text-rose-700">{zh ? "没有写入任何数据。请重试或打开各部门原始页面确认。" : "データへの書き込みは行っていません。再試行するか、各部門の元画面をご確認ください。"}</p>
          </div>
          <Button variant="outline" onClick={() => overviewQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />{zh ? "重试" : "再試行"}</Button>
        </CardContent>
      </Card>
    );
  }

  const data = overviewQuery.data;
  const hasTrendData = data.trend.some((point) => point.hasData);
  const gmvChange = data.kpis.gmvChangePercent;
  const chartData = data.trend.map((point) => ({ ...point, label: shortDate(point.date) }));
  const quickQuestions = zh
    ? ["今天最需要我处理的三件事是什么？", "哪些部门的数据没有更新？", "最近30天登记GMV为什么变化？"]
    : ["今日、私が最優先で見るべき3件は？", "更新が止まっている部門データは？", "直近30日の登録GMVはなぜ変化した？"];

  const kpiCards = [
    {
      id: "staff",
      icon: Users,
      label: zh ? "在职员工" : "在職スタッフ",
      value: `${data.kpis.activeStaff}${zh ? "人" : "名"}`,
      detail: zh ? "HR主档・排除离职及合并记录" : "HR主簿・退職/統合済みを除外",
      tone: "text-cyan-300",
      href: "/master/hr",
    },
    {
      id: "reports",
      icon: FileCheck2,
      label: zh ? "今日日报" : "本日の日報",
      value: `${data.kpis.reportSubmitted}/${data.kpis.reportExpected}`,
      detail: data.kpis.reportRate == null ? (zh ? "对象未登记" : "対象未登録") : `${zh ? "提交率" : "提出率"} ${data.kpis.reportRate}%`,
      tone: data.kpis.reportMissing > 0 ? "text-amber-300" : "text-emerald-300",
      href: "/master/reports",
    },
    {
      id: "tasks",
      icon: ListChecks,
      label: zh ? "执行中的任务" : "実行中タスク",
      value: String(data.kpis.activeTasks),
      detail: `${zh ? "逾期" : "期限超過"} ${data.kpis.overdueTasks}`,
      tone: data.kpis.overdueTasks > 0 ? "text-rose-300" : "text-blue-300",
      href: "/master/tasks",
    },
    {
      id: "issues",
      icon: Activity,
      label: zh ? "未解决问题" : "未解決問題",
      value: String(data.kpis.activeIssues),
      detail: `${zh ? "紧急/高优先级" : "緊急/高優先度"} ${data.kpis.urgentHighIssues}`,
      tone: data.kpis.urgentHighIssues > 0 ? "text-rose-300" : "text-emerald-300",
      href: "/master/issues",
    },
    {
      id: "gmv",
      icon: BarChart3,
      label: zh ? "近30天登记GMV" : "直近30日登録GMV",
      value: money(data.kpis.registeredGmv30d, language),
      detail: gmvChange == null
        ? (zh ? "前期比较数据不足" : "前期間との比較データ不足")
        : `${zh ? "前30天比" : "前30日比"} ${gmvChange > 0 ? "+" : ""}${gmvChange}%`,
      tone: gmvChange != null && gmvChange < 0 ? "text-rose-300" : "text-emerald-300",
      href: "/master/livers-dashboard",
    },
    {
      id: "morning",
      icon: Mic2,
      label: zh ? "今日晨会" : "本日の早会",
      value: data.kpis.morningStatus === "completed"
        ? (zh ? "已完成" : "完了")
        : data.kpis.morningStatus === "failed"
          ? (zh ? "处理失败" : "処理失敗")
          : data.kpis.morningStatus === "processing"
            ? (zh ? "处理中" : "処理中")
            : (zh ? "未登记" : "未登録"),
      detail: zh ? "未登记不等于未召开" : "未登録と未実施は区別",
      tone: data.kpis.morningStatus === "failed" ? "text-rose-300" : data.kpis.morningStatus === "completed" ? "text-emerald-300" : "text-amber-300",
      href: "/master/morning-meeting",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10"><Crown className="mr-1 h-3.5 w-3.5" />CEO {zh ? "司令塔" : "司令塔"}</Badge>
              <Badge className="border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10"><ShieldCheck className="mr-1 h-3.5 w-3.5" />{zh ? "只读汇总" : "読み取り専用"}</Badge>
              <Badge className={data.lark.healthy ? "border-blue-300/30 bg-blue-400/10 text-blue-200 hover:bg-blue-400/10" : "border-amber-300/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/10"}>
                {data.lark.healthy ? <Wifi className="mr-1 h-3.5 w-3.5" /> : <WifiOff className="mr-1 h-3.5 w-3.5" />}
                Lark {data.lark.healthy ? (zh ? "同步正常" : "同期正常") : (zh ? "需要确认" : "要確認")}
              </Badge>
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{zh ? "今天先看什么，直接问全公司的数据" : "今日見るべきことを、全社データに直接聞く"}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {zh
                ? "汇总员工日报、任务、问题、晨会、直播实绩、品牌与Lark同步。显示原始页面和更新时间，不把未登记误判为0。"
                : "スタッフ日報、タスク、問題、早会、ライブ実績、ブランドとLark同期を横断集約。元画面と更新時刻を示し、未登録を0と誤判定しません。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => document.getElementById("ceo-ai-chat")?.scrollIntoView({ behavior: "smooth" })}><BrainCircuit className="mr-2 h-4 w-4" />{zh ? "询问CEO AI" : "CEO AIに質問"}</Button>
            <Button className="border border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => overviewQuery.refetch()} disabled={overviewQuery.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />{zh ? "更新" : "更新"}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>{zh ? "数据日期" : "データ日"} {data.today}</span>
          <span>{zh ? "生成" : "生成"} {dateTime(data.generatedAt, language)}</span>
          <span>{zh ? "财务金额继续由二次密码保护" : "財務金額は引き続き二次認証で保護"}</span>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-amber-600" />{zh ? "现在最需要看的事情" : "今すぐ見るべきこと"}</h2>
          <Badge variant={data.alerts.some((item) => item.severity === "high") ? "destructive" : "outline"}>{data.alerts.length}{zh ? "项" : "件"}</Badge>
        </div>
        {data.alerts.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-5 w-5" />{zh ? "当前没有系统检测到的重点异常" : "現在、システムが検出した重点異常はありません"}</div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.alerts.slice(0, 6).map((alert) => (
              <button key={alert.id} type="button" onClick={() => setLocation(alert.href)} className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${alertClass[alert.severity]}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant={alert.severity === "high" ? "destructive" : "outline"}>{alert.severity === "high" ? (zh ? "高" : "高") : alert.severity === "medium" ? (zh ? "中" : "中") : "INFO"}</Badge><p className="font-semibold">{alert.title}</p></div>
                  <p className="mt-2 text-sm leading-5 text-slate-700">{alert.detail}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-500" />
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setLocation(item.href)} className="rounded-xl bg-slate-950 p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-900">
              <div className="flex items-center justify-between"><Icon className={`h-5 w-5 ${item.tone}`} /><ArrowRight className="h-4 w-4 text-slate-500" /></div>
              <p className="mt-4 text-xs text-slate-400">{item.label}</p>
              <p className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</p>
              <p className="mt-2 text-[11px] leading-4 text-slate-400">{item.detail}</p>
            </button>
          );
        })}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-indigo-600" />{zh ? "近14天登记直播GMV" : "直近14日の登録ライブGMV"}</CardTitle>
              <div className="flex items-center gap-2">
                {gmvChange != null && <Badge variant="outline" className={gmvChange < 0 ? "text-rose-700" : "text-emerald-700"}>{gmvChange < 0 ? <TrendingDown className="mr-1 h-3.5 w-3.5" /> : <TrendingUp className="mr-1 h-3.5 w-3.5" />}{gmvChange > 0 ? "+" : ""}{gmvChange}%</Badge>}
                <Badge variant="outline">{zh ? "未登记≠0" : "未登録≠0"}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {hasTrendData ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="ceoGmv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} /><stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={18} />
                    <YAxis yAxisId="gmv" tick={{ fontSize: 11 }} width={62} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                    <YAxis yAxisId="orders" orientation="right" tick={{ fontSize: 11 }} width={34} />
                    <Tooltip formatter={(value: number, name: string) => name === "gmv" ? [money(value, language), "GMV"] : [value, zh ? "订单" : "注文"]} labelFormatter={(label) => `${zh ? "日期" : "日付"} ${label}`} />
                    <Area yAxisId="gmv" type="monotone" dataKey="gmv" stroke="#4f46e5" strokeWidth={2} fill="url(#ceoGmv)" connectNulls={false} />
                    <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="#0f766e" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50 text-center">
                <Database className="h-8 w-8 text-slate-400" />
                <p className="mt-3 font-medium text-slate-700">{zh ? "近14天没有登记直播实绩" : "直近14日の登録ライブ実績がありません"}</p>
                <p className="mt-1 text-sm text-slate-500">{zh ? "这是未登记，不代表实际GMV为0" : "未登録であり、実際のGMVが0とは限りません"}</p>
                <Button className="mt-4" variant="outline" size="sm" onClick={() => setLocation("/master/livers-dashboard")}>{zh ? "打开原始页面" : "元画面を開く"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4 text-blue-600" />Lark / Feishu</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className={`rounded-xl border p-4 ${data.lark.healthy ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{data.lark.configured ? (zh ? "已连接" : "接続済み") : (zh ? "未设置" : "未設定")}</p>
                <Badge variant="outline">{data.lark.status || (zh ? "无履历" : "履歴なし")}</Badge>
              </div>
              <p className="mt-3 text-2xl font-semibold">{data.lark.totalRecords.toLocaleString()}<span className="ml-1 text-sm font-normal">{zh ? "条最新记录" : "件・最新取得"}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">{zh ? "本次更新" : "今回更新"} {data.lark.updatedRecords.toLocaleString()} · {zh ? "最终同步" : "最終同期"} {dateTime(data.lark.syncedAt, language)}</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">{zh ? "已关联LCJ品牌" : "LCJブランド連携済み"}</p>
              <p className="mt-1 text-2xl font-semibold">{data.lark.linkedBrands.toLocaleString()}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{zh ? "使用现有6小时自动同步。CEO页面不会手动写入Lark。" : "既存の6時間自動同期を利用。CEO画面からLarkへ書き込みません。"}</p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/master/brands")}>{zh ? "打开品牌/Lark原始页面" : "ブランド/Lark元画面を開く"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><Activity className="h-5 w-5 text-indigo-600" />{zh ? "部门健康状态" : "部門の健康状態"}</h2><span className="text-xs text-muted-foreground">{zh ? "点击打开原始页面" : "クリックして元画面へ"}</span></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.departments.map((department) => (
            <button key={department.id} type="button" onClick={() => setLocation(department.href)} className="rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
              <div className="flex items-center justify-between gap-3"><p className="font-semibold">{department.label}</p><Badge variant="outline" className={statusClass[department.status]}>{statusLabel(department.status, zh)}</Badge></div>
              <p className="mt-3 text-lg font-semibold text-slate-900">{department.headline}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{department.detail}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-indigo-600"><span>{zh ? "查看依据" : "根拠を確認"}</span><ArrowRight className="h-4 w-4" /></div>
            </button>
          ))}
        </div>
      </section>

      <Card id="ceo-ai-chat" className="overflow-hidden border-indigo-200 shadow-md">
        <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-blue-50 pb-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-indigo-600" />CEO AI</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{zh ? "基于LCJ MALL实际数据回答，并显示使用的数据来源。" : "LCJ MALLの実データに基づいて回答し、使用したデータソースを表示します。"}</p>
            </div>
            <div className="flex flex-wrap gap-2"><Badge variant="outline"><ShieldCheck className="mr-1 h-3.5 w-3.5" />{zh ? "只读" : "読み取り専用"}</Badge><Badge variant="outline"><Sparkles className="mr-1 h-3.5 w-3.5" />gpt-5-mini</Badge></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-slate-50 p-5 text-center">
              <Crown className="mx-auto h-8 w-8 text-indigo-500" />
              <p className="mt-3 font-semibold">{zh ? "直接问公司的整体情况" : "会社全体の状況をそのまま質問"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{zh ? "AI不会自动发送通知、修改数据或执行人事判断。" : "AIは通知送信、データ変更、人事判断を自動実行しません。"}</p>
            </div>
          ) : (
            <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-3 text-sm text-white sm:max-w-[75%]" : "max-w-[96%] rounded-2xl rounded-bl-md border bg-white px-4 py-4 text-sm text-slate-800 sm:max-w-[88%]"}>
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <p className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-500"><Database className="h-3.5 w-3.5" />{zh ? "回答依据" : "回答の根拠"}</p>
                      <div className="flex flex-wrap gap-2">
                        {message.sources.map((source) => (
                          <button key={`${index}-${source.id}`} type="button" onClick={() => setLocation(source.href)} className="rounded-full border bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-indigo-300 hover:text-indigo-700">{source.label} · {source.period}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {ask.isPending && <div className="flex max-w-[88%] items-center gap-2 rounded-2xl rounded-bl-md border bg-white px-4 py-3 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />{zh ? "正在读取各部门实际数据…" : "各部門の実データを確認中…"}</div>}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((item) => <Button key={item} type="button" variant="outline" size="sm" className="h-auto whitespace-normal text-left text-xs" onClick={() => sendQuestion(item)} disabled={ask.isPending}>{item}</Button>)}
          </div>
          <div className="rounded-xl border bg-white p-3">
            <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendQuestion(); } }} placeholder={zh ? "例如：昨天哪些员工日报提到了需要CEO协调的问题？" : "例：昨日の日報で、CEOの調整が必要と書かれた内容は？"} className="min-h-[92px] resize-none border-0 p-1 shadow-none focus-visible:ring-0" maxLength={1200} />
            <div className="mt-2 flex flex-col justify-between gap-2 border-t pt-3 sm:flex-row sm:items-center">
              <p className="text-xs text-muted-foreground">{zh ? "仅在提问时使用AI额度。不会自动操作系统。" : "質問時のみAI利用分が発生します。システム操作は自動実行しません。"}</p>
              <Button onClick={() => sendQuestion()} disabled={question.trim().length < 2 || ask.isPending}>{ask.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{zh ? "发送" : "送信"}</Button>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:flex-row sm:items-center">
            <span className="flex items-center gap-1"><LockKeyhole className="h-3.5 w-3.5" />{zh ? "财务金额需在财务页面完成二次验证" : "財務金額は財務画面の二次認証が必要"}</span>
            <button type="button" onClick={() => setLocation("/master/lcj-brain")} className="font-medium text-indigo-600 hover:underline">{zh ? "打开完整LCJ Brain" : "完全版LCJ Brainを開く"} →</button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="flex items-center gap-2 font-medium"><Database className="h-4 w-4" />{zh ? "数据口径" : "データ口径"}</p>
        <p className="mt-1 leading-6">{zh
          ? "GMV只统计已登记的品牌直播记录；没有记录的日期显示为未登记，不表示实际为0。日报提交率以在职HR关联的有效日报账号为分母。财务金额继续由既有二次密码保护。"
          : "GMVは登録済みブランドライブ記録のみを集計し、記録のない日は未登録として扱います。日報提出率は在職HRに紐づく有効な日報profileを分母にします。財務金額は既存の二次パスワードで保護します。"}</p>
      </div>
    </div>
  );
}
