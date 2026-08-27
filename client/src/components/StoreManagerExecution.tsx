import { useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, FileText, History, Loader2, Plus, Save, Star } from 'lucide-react';
import { toast } from 'sonner';

const statusLabels:Record<string,string>={draft:'草稿',active:'进行中',completed:'完成',archived:'归档',todo:'待办',in_progress:'执行中',blocked:'受阻',done:'完成',cancelled:'取消',submitted:'已提交',confirmed:'已确认'};
const workstreamLabels:Record<string,string>={product_links:'商品链接',product_page:'商品页面',live_sales:'直播销售',short_video:'短视频',inventory_growth:'库存・增长',ads_customer_refund:'广告・顾客・退款',other:'其他'};
const metricTemplates=[
  {key:'gmv',name:'GMV',unit:'JPY',direction:'increase'},{key:'orders',name:'订单数',unit:'件',direction:'increase'},
  {key:'customers',name:'顾客数',unit:'人',direction:'increase'},{key:'refundRate',name:'退款率',unit:'%',direction:'decrease'},
  {key:'adRoi',name:'广告ROI',unit:'倍',direction:'increase'},{key:'liveSessions',name:'直播场次',unit:'场',direction:'increase'},
  {key:'liveMinutes',name:'直播时间',unit:'分钟',direction:'increase'},{key:'shortVideos',name:'短视频产出',unit:'条',direction:'increase'},
  {key:'productLinks',name:'新增商品链接',unit:'件',direction:'increase'},{key:'productPageImprovements',name:'商品页面改善',unit:'件',direction:'increase'},
  {key:'inventoryIncidents',name:'库存事故',unit:'件',direction:'decrease'},
] as const;
const workTemplates=[
  ['product_links','整理常用・专用链接并清除失效链接'],['product_page','完善日语商品详情、品牌参数和场景图片'],
  ['live_sales','制定直播排期、预热和库存联动'],['short_video','稳定发布直播切片、开箱和测评视频'],
  ['inventory_growth','同步库存并防止缺货・超卖'],['ads_customer_refund','复盘广告ROI、客户反馈与退款原因'],
] as const;
function monthRange(year:number,month:number){return{start:`${year}-${String(month).padStart(2,'0')}-01`,end:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)}}
function formatMetric(key:string,value:any){if(value===null||value===undefined)return '无数据';const n=Number(value);if(key==='gmv'||key==='refundAmount'||key==='adSpend')return `¥${Math.round(n).toLocaleString()}`;if(key==='refundRate')return `${n.toFixed(2)}%`;if(key==='adRoi')return `${n.toFixed(2)}倍`;return n.toLocaleString();}
function statusClass(status:string){if(['active','done','confirmed','completed'].includes(status))return 'bg-emerald-100 text-emerald-700';if(['blocked','archived','cancelled'].includes(status))return 'bg-red-100 text-red-700';if(['submitted','in_progress'].includes(status))return 'bg-blue-100 text-blue-700';return 'bg-amber-100 text-amber-700';}

export function StoreManagerExecution({store,year,month,staffList}:{store:any;year:number;month:number;staffList:any[]}){
  const {user}=useAuth();
  const isAdmin=user?.role==='admin';
  const [showDailyForm,setShowDailyForm]=useState(false);
  const [editingReport,setEditingReport]=useState<any|null>(null);
  const [fillDate,setFillDate]=useState('');
  const [selectedReportSeries,setSelectedReportSeries]=useState('');
  const [selectedCycleId,setSelectedCycleId]=useState<number|null>(null);
  const [showCycleForm,setShowCycleForm]=useState(false);
  const [showGoalForm,setShowGoalForm]=useState(false);
  const [showWorkForm,setShowWorkForm]=useState(false);
  const [editingWork,setEditingWork]=useState<any|null>(null);
  const utils=trpc.useUtils();
  const compliance=trpc.storeExecution.dailyCompliance.useQuery({storeId:Number(store.id),year,month});
  const cycles=trpc.storeExecution.listCycles.useQuery({storeId:Number(store.id),year});
  const work=trpc.storeExecution.listWorkItems.useQuery({storeId:Number(store.id)});
  const reviews=trpc.storeExecution.listReviews.useQuery({storeId:Number(store.id),limit:20});
  const goals=trpc.storeExecution.listGoals.useQuery({cycleId:selectedCycleId||1},{enabled:Boolean(selectedCycleId)});
  const history=trpc.storeExecution.reportHistory.useQuery({seriesKey:selectedReportSeries||'00000000-0000-0000-0000-000000000000'},{enabled:Boolean(selectedReportSeries)});
  const refresh=()=>utils.storeExecution.invalidate();
  const reports=compliance.data?.reports||[];
  const workRows=work.data||[];
  const primaryDate=compliance.data?.nextDateToFill||compliance.data?.today||new Date().toISOString().slice(0,10);
  const primaryReport=reports.find((report:any)=>String(report.periodStart).slice(0,10)===primaryDate)||null;
  const openDaily=(date:string,report?:any)=>{setFillDate(date);setEditingReport(report||reports.find((item:any)=>String(item.periodStart).slice(0,10)===date)||null);setShowDailyForm(true);};
  const todayStatus=compliance.data?.todayStatus;
  const primaryLabel=primaryDate===compliance.data?.today
    ? todayStatus==='submitted'?'查看／更新今天的日报':todayStatus==='draft'?'继续填写今天的日报':'填写今天的店长日报'
    : `补填 ${primaryDate.slice(5).replace('-','月')}日 日报`;
  const busy=compliance.isLoading||cycles.isLoading||work.isLoading;
  const cycleRows=cycles.data||[];
  const reportStatus=(status:string)=>status==='confirmed'?'管理已确认':status==='submitted'?'已提交':status==='draft'?'草稿':'未填写';
  const calendarStatusClass=(status:string)=>status==='submitted'?'border-emerald-200 bg-emerald-50 text-emerald-700':status==='draft'?'border-amber-200 bg-amber-50 text-amber-700':status==='missing'?'border-red-200 bg-red-50 text-red-700':'border-orange-200 bg-orange-50 text-orange-700';

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
      <div className="grid gap-5 bg-gradient-to-r from-slate-950 via-indigo-950 to-orange-900 p-5 text-white lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-orange-200">店长每天只需要完成这一件事</p>
          <h2 className="mt-2 text-2xl font-bold">{store.name} 每日经营记录</h2>
          <p className="mt-2 text-sm text-white/70">负责人：{store.operatorName||'未指定'}{store.operator2Name?` / ${store.operator2Name}`:''}。一次填写工作、成绩、问题、明日计划和证据。</p>
        </div>
        <Button size="lg" className="min-h-14 bg-orange-500 px-7 text-base font-bold text-white shadow-lg hover:bg-orange-400" onClick={()=>openDaily(primaryDate,primaryReport)}>
          <FileText className="mr-2 h-5 w-5"/>{primaryLabel}
        </Button>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y border-t md:grid-cols-4 md:divide-y-0">
        <SimpleStatus title="今天" value={todayStatus==='submitted'?'已填写':todayStatus==='draft'?'草稿未提交':'未填写'} tone={todayStatus==='submitted'?'good':'warn'} />
        <SimpleStatus title="本月填写率" value={`${compliance.data?.submissionRate??0}%`} sub={`${compliance.data?.submittedDays||0} / ${compliance.data?.expectedDays||0} 天`} tone={(compliance.data?.submissionRate||0)>=90?'good':'warn'} />
        <SimpleStatus title="本月未填写" value={`${compliance.data?.missingDays||0} 天`} tone={(compliance.data?.missingDays||0)>0?'bad':'good'} />
        <SimpleStatus title="连续未填写" value={`${compliance.data?.consecutiveMissingDays||0} 天`} tone={(compliance.data?.consecutiveMissingDays||0)>0?'bad':'good'} />
      </div>
    </section>

    {(compliance.data?.missingDays||0)>0&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
      <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="font-bold">有 {compliance.data?.missingDays} 天日报未提交</p><p className="mt-1 text-sm">缺失日期：{(compliance.data?.missingDates||[]).slice(-8).join('、')}{(compliance.data?.missingDates?.length||0)>8?' 等':''}。点击下面红色日期即可补填。</p></div></div>
    </div>}

    {busy?<div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-orange-500"/></div>:<div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div><h3 className="font-bold">{year}年{month}月 每日填写记录</h3><p className="mt-1 text-xs text-slate-500">绿色已提交，红色未填写，橙色为今天待填写</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">每日必须填写</span></div>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {(compliance.data?.calendar||[]).map((day:any)=><button key={day.date} onClick={()=>openDaily(day.date,day.report)} className={`rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow ${calendarStatusClass(day.status)}`}>
            <p className="text-xs font-bold">{Number(day.date.slice(-2))}日</p><p className="mt-1 text-[10px]">{day.status==='submitted'?'已提交':day.status==='draft'?'草稿':day.status==='missing'?'未填写':'今天待填写'}</p>
          </button>)}
        </div>
        {!(compliance.data?.calendar||[]).length&&<Empty text="这个月份尚未开始要求填写日报"/>}
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><div><h3 className="font-bold">填写记录</h3><p className="mt-1 text-xs text-slate-500">点击记录可查看并更新，旧版本永久保留</p></div><History className="h-5 w-5 text-slate-400"/></div>
        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {reports.map((report:any)=><div key={report.id} role="button" tabIndex={0} onClick={()=>openDaily(String(report.periodStart).slice(0,10),report)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openDaily(String(report.periodStart).slice(0,10),report);}}} className="w-full cursor-pointer rounded-xl border p-3 text-left transition hover:border-orange-300 hover:bg-orange-50/50">
            <div className="flex items-center justify-between gap-2"><span className="font-semibold">{String(report.periodStart).slice(5,10).replace('-','月')}日</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${statusClass(report.status)}`}>{reportStatus(report.status)}</span></div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{report.highlights||report.workSummary||'未填写摘要'}</p>
            <div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{report.createdByName||'-'}</span><button type="button" onClick={event=>{event.stopPropagation();setSelectedReportSeries(report.seriesKey);}} className="text-indigo-600 hover:underline">查看 v{report.versionNumber} 历史</button></div>
          </div>)}
          {!reports.length&&<Empty text="还没有填写记录，请从上方橙色按钮开始"/>}
        </div>
      </section>
    </div>}

    {selectedReportSeries&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-bold">这份日报的修改履历</h3><button className="text-sm text-slate-500" onClick={()=>setSelectedReportSeries('')}>关闭</button></div>{history.isLoading?<Loader2 className="mt-4 h-5 w-5 animate-spin"/>:<div className="mt-4 grid gap-2 md:grid-cols-3">{(history.data||[]).map((item:any)=><div key={item.id} className="rounded-lg border p-3 text-xs"><p className="font-semibold">v{item.versionNumber} · {reportStatus(item.status)}</p><p className="mt-1 text-slate-500">{item.createdByName||'-'} · {item.createdAt?new Date(item.createdAt).toLocaleString():'-'}</p></div>)}</div>}</section>}

    <details className="rounded-2xl border bg-white shadow-sm">
      <summary className="cursor-pointer list-none p-5"><div className="flex items-center justify-between"><div><h3 className="font-bold">目标・重点工作・管理评价</h3><p className="mt-1 text-xs text-slate-500">日常填写不需要操作这里；目标设定和管理复盘时再展开</p></div><span className="text-sm text-indigo-600">展开管理设置</span></div></summary>
      <div className="space-y-6 border-t p-5">
        <div><div className="mb-3 flex items-center justify-between"><h4 className="font-bold">目标周期</h4>{isAdmin&&<Button size="sm" variant="outline" onClick={()=>setShowCycleForm(true)}><Plus className="mr-1 h-3 w-3"/>新建目标</Button>}</div><div className="grid gap-2 md:grid-cols-3">{cycleRows.map((cycle:any)=><button key={cycle.id} onClick={()=>setSelectedCycleId(Number(cycle.id))} className={`rounded-xl border p-3 text-left ${selectedCycleId===Number(cycle.id)?'border-indigo-400 bg-indigo-50':''}`}><p className="font-semibold">{cycle.title}</p><p className="mt-1 text-xs text-slate-500">{cycle.managerName} · {String(cycle.periodStart).slice(0,10)}〜{String(cycle.periodEnd).slice(0,10)}</p></button>)}{!cycleRows.length&&<Empty text="尚未设置目标"/>}</div>{selectedCycleId&&<div className="mt-3 rounded-xl bg-slate-50 p-3"><div className="mb-2 flex justify-between"><p className="text-sm font-bold">目标指标</p>{isAdmin&&<Button size="sm" onClick={()=>setShowGoalForm(true)}>添加指标</Button>}</div><div className="flex flex-wrap gap-2">{(goals.data||[]).map((goal:any)=><span key={goal.id} className="rounded-full border bg-white px-3 py-1 text-xs">{goal.metricName}：{Number(goal.targetValue).toLocaleString()} {goal.unit}</span>)}</div></div>}</div>
        <div><div className="mb-3 flex items-center justify-between"><h4 className="font-bold">重点工作</h4>{isAdmin&&<Button size="sm" variant="outline" onClick={()=>{setEditingWork(null);setShowWorkForm(true);}}><Plus className="mr-1 h-3 w-3"/>添加工作</Button>}</div><div className="grid gap-2 md:grid-cols-2">{workRows.map((item:any)=><button key={item.id} disabled={!isAdmin} onClick={()=>{setEditingWork(item);setShowWorkForm(true);}} className={`rounded-xl border p-3 text-left ${item.status==='blocked'?'border-red-200 bg-red-50':'bg-slate-50'}`}><div className="flex justify-between"><span className="font-semibold">{item.title}</span><span className="text-xs">{statusLabels[item.status]}</span></div><p className="mt-1 text-xs text-slate-500">{workstreamLabels[item.workstream]} · {item.progress}%</p></button>)}{!workRows.length&&<Empty text="尚未设置重点工作"/>}</div></div>
        <div><div className="mb-3 flex items-center justify-between"><h4 className="font-bold">管理评价</h4>{isAdmin&&<ReviewForm storeId={Number(store.id)} cycles={cycleRows} onSaved={refresh}/>}</div><div className="grid gap-2 md:grid-cols-2">{(reviews.data||[]).map((review:any)=><div key={review.id} className="rounded-xl border p-3"><p className="text-sm">{review.comment}</p><p className="mt-2 text-xs text-slate-500">结果 {review.resultRating}/5 · 执行 {review.executionRating}/5 · 质量 {review.qualityRating}/5 · 改善 {review.improvementRating}/5</p></div>)}{!(reviews.data||[]).length&&<Empty text="尚无管理评价"/>}</div></div>
      </div>
    </details>

    {showDailyForm&&<DailyCheckInForm store={store} reportDate={fillDate} value={editingReport} cycles={cycleRows} workItems={workRows} onClose={()=>setShowDailyForm(false)} onSaved={()=>{setShowDailyForm(false);setEditingReport(null);refresh();}}/>}
    {showCycleForm&&<CycleForm store={store} staffList={staffList} year={year} month={month} onClose={()=>setShowCycleForm(false)} onSaved={()=>{setShowCycleForm(false);refresh();}}/>}
    {showGoalForm&&selectedCycleId&&<GoalForm storeId={Number(store.id)} cycleId={selectedCycleId} onClose={()=>setShowGoalForm(false)} onSaved={()=>{setShowGoalForm(false);refresh();goals.refetch();}}/>}
    {showWorkForm&&<WorkForm store={store} cycles={cycleRows} value={editingWork} onClose={()=>setShowWorkForm(false)} onSaved={()=>{setShowWorkForm(false);setEditingWork(null);refresh();}}/>}
  </div>;
}

function SimpleStatus({title,value,sub,tone}:{title:string;value:string;sub?:string;tone:'good'|'warn'|'bad'}){
  const color=tone==='good'?'text-emerald-700':tone==='bad'?'text-red-700':'text-orange-700';
  return <div className="p-4"><p className="text-xs text-slate-500">{title}</p><p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>{sub&&<p className="mt-1 text-[10px] text-slate-400">{sub}</p>}</div>;
}

function Empty({text}:{text:string}){return <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-400">{text}</div>}

function DailyCheckInForm({store,reportDate,value,cycles,workItems,onClose,onSaved}:{store:any;reportDate:string;value:any;cycles:any[];workItems:any[];onClose:()=>void;onSaved:()=>void}){
  const [form,setForm]=useState({
    workSummary:value?.workSummary||'',highlights:value?.highlights||'',issuesRisks:value?.issuesRisks||'',actionsTaken:value?.actionsTaken||'',nextPlan:value?.nextPlan||'',supportNeeded:value?.supportNeeded||'',linkedCycleId:value?.linkedCycleId?String(value.linkedCycleId):'none',
    liveSessions:Number(value?.activity?.liveSessions||0),liveMinutes:Number(value?.activity?.liveMinutes||0),shortVideos:Number(value?.activity?.shortVideos||0),productLinks:Number(value?.activity?.productLinks||0),productPageImprovements:Number(value?.activity?.productPageImprovements||0),inventoryIncidents:Number(value?.activity?.inventoryIncidents||0),evidenceLabel:value?.evidence?.[0]?.label||'',evidenceUrl:value?.evidence?.[0]?.url||'',
  });
  const [taskUpdates,setTaskUpdates]=useState<Record<number,{status:string;progress:number;resultSummary:string}>>(()=>Object.fromEntries(workItems.filter(item=>item.status!=='cancelled').map(item=>[Number(item.id),{status:String(item.status),progress:Number(item.progress||0),resultSummary:String(item.resultSummary||'')}])));
  const preview=trpc.storeExecution.kpiPreview.useQuery({storeId:Number(store.id),periodStart:reportDate,periodEnd:reportDate},{enabled:Boolean(reportDate)});
  const mutation=trpc.storeExecution.dailyCheckIn.useMutation({onSuccess:data=>{toast.success(`${data.reportDate} 日报已提交`);onSaved();},onError:error=>toast.error(error.message)});
  const submit=()=>mutation.mutate({
    storeId:Number(store.id),reportDate,workSummary:form.workSummary,highlights:form.highlights,issuesRisks:form.issuesRisks,actionsTaken:form.actionsTaken,nextPlan:form.nextPlan,supportNeeded:form.supportNeeded,
    activity:{liveSessions:Number(form.liveSessions),liveMinutes:Number(form.liveMinutes),shortVideos:Number(form.shortVideos),productLinks:Number(form.productLinks),productPageImprovements:Number(form.productPageImprovements),inventoryIncidents:Number(form.inventoryIncidents)},
    evidence:form.evidenceUrl?[{label:form.evidenceLabel||'成果证据',url:form.evidenceUrl}]:value?.evidence||[],linkedCycleId:form.linkedCycleId==='none'?null:Number(form.linkedCycleId),
    workUpdates:Object.entries(taskUpdates).map(([id,item])=>({id:Number(id),status:item.status as any,progress:Number(item.progress),resultSummary:item.resultSummary})),
  });
  return <Modal title={`${reportDate} 店长日报`} onClose={onClose}>
    <div className="mb-5 rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="font-bold text-orange-900">一次填写，下面全部一起提交</p><p className="mt-1 text-xs text-orange-700">必填：今天完成的工作、结果／成绩、明日计划。其他项目没有发生时可以留空。</p></div>
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2"><Field label="日报日期"><Input value={reportDate} readOnly className="bg-slate-50"/></Field><Field label="关联目标"><Select value={form.linkedCycleId} onValueChange={value=>setForm({...form,linkedCycleId:value})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">不关联</SelectItem>{cycles.map(cycle=><SelectItem key={cycle.id} value={String(cycle.id)}>{cycle.title}</SelectItem>)}</SelectContent></Select></Field></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">{[['liveSessions','直播场次'],['liveMinutes','直播分钟'],['shortVideos','短视频'],['productLinks','新增链接'],['productPageImprovements','页面改善'],['inventoryIncidents','库存事故']].map(([key,label])=><Field key={key} label={label}><Input type="number" min="0" value={(form as any)[key]} onChange={event=>setForm({...form,[key]:Number(event.target.value)})}/></Field>)}</div>
      <Field label="今天完成了什么 *"><Textarea rows={4} placeholder="例：整理商品链接、完成直播排期、更新商品日语说明……" value={form.workSummary} onChange={event=>setForm({...form,workSummary:event.target.value})}/></Field>
      <Field label="今天的结果・成绩 *"><Textarea rows={3} placeholder="写具体数字或成果，不要只写‘完成’" value={form.highlights} onChange={event=>setForm({...form,highlights:event.target.value})}/></Field>
      <div className="grid gap-4 md:grid-cols-2"><Field label="问题・风险"><Textarea rows={3} placeholder="没有可留空" value={form.issuesRisks} onChange={event=>setForm({...form,issuesRisks:event.target.value})}/></Field><Field label="已采取的措施"><Textarea rows={3} placeholder="针对问题做了什么" value={form.actionsTaken} onChange={event=>setForm({...form,actionsTaken:event.target.value})}/></Field></div>
      <Field label="明天要做什么 *"><Textarea rows={3} placeholder="写明天最重要的1～3件事" value={form.nextPlan} onChange={event=>setForm({...form,nextPlan:event.target.value})}/></Field>
      <Field label="需要公司／管理层支援"><Textarea rows={2} placeholder="需要审批、资源、库存、人员或决策时填写" value={form.supportNeeded} onChange={event=>setForm({...form,supportNeeded:event.target.value})}/></Field>
      {workItems.filter(item=>item.status!=='cancelled').length>0&&<div className="rounded-xl border bg-slate-50 p-4"><p className="font-bold">今天顺便更新重点工作进度</p><p className="mt-1 text-xs text-slate-500">不需要去其他页面，和日报一起保存。</p><div className="mt-3 space-y-3">{workItems.filter(item=>item.status!=='cancelled').map(item=>{const update=taskUpdates[Number(item.id)]||{status:item.status,progress:Number(item.progress||0),resultSummary:String(item.resultSummary||'')};return <div key={item.id} className="rounded-lg border bg-white p-3"><p className="mb-2 text-sm font-semibold">{item.title}</p><div className="grid gap-2 md:grid-cols-[150px_100px_1fr]"><Select value={update.status} onValueChange={status=>setTaskUpdates({...taskUpdates,[Number(item.id)]:{...update,status}})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['todo','in_progress','blocked','done'].map(status=><SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>)}</SelectContent></Select><Input type="number" min="0" max="100" value={update.progress} onChange={event=>setTaskUpdates({...taskUpdates,[Number(item.id)]:{...update,progress:Number(event.target.value)}})}/><Input placeholder="今日进展／受阻原因" value={update.resultSummary} onChange={event=>setTaskUpdates({...taskUpdates,[Number(item.id)]:{...update,resultSummary:event.target.value}})}/></div></div>})}</div></div>}
      <div className="grid gap-4 md:grid-cols-2"><Field label="成果证据名称"><Input placeholder="例：直播回放、商品页面、数据表" value={form.evidenceLabel} onChange={event=>setForm({...form,evidenceLabel:event.target.value})}/></Field><Field label="成果证据URL"><Input placeholder="https://..." value={form.evidenceUrl} onChange={event=>setForm({...form,evidenceUrl:event.target.value})}/></Field></div>
      <div className="rounded-xl border bg-slate-50 p-3 text-xs"><p className="font-semibold">当天实绩数据</p>{preview.isLoading?<Loader2 className="mt-2 h-4 w-4 animate-spin"/>:<p className="mt-2 text-slate-600">GMV {formatMetric('gmv',preview.data?.metrics.gmv)} · 订单 {formatMetric('orders',preview.data?.metrics.orders)} · 退款率 {formatMetric('refundRate',preview.data?.metrics.refundRate)} · {preview.data?.hasSourceData?'已关联上传数据':'当天无日别数据，不按0评价'}。完整数据请看上方「业绩概览」。</p>}</div>
    </div>
    <div className="mt-6"><Button className="h-12 w-full bg-orange-500 text-base font-bold hover:bg-orange-600" disabled={!form.workSummary.trim()||!form.highlights.trim()||!form.nextPlan.trim()||mutation.isPending} onClick={submit}>{mutation.isPending?<Loader2 className="mr-2 h-5 w-5 animate-spin"/>:<CheckCircle2 className="mr-2 h-5 w-5"/>}{value?'更新并重新提交这一天的日报':'提交这一天的店长日报'}</Button></div>
  </Modal>;
}

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:any}){return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex justify-between"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-700">×</button></div>{children}</div></div>}
function Field({label,children}:{label:string;children:any}){return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>}
function CycleForm({store,staffList,year,month,onClose,onSaved}:{store:any;staffList:any[];year:number;month:number;onClose:()=>void;onSaved:()=>void}){const start=monthRange(year,month).start;const end=new Date(Date.UTC(year,month+2,0)).toISOString().slice(0,10);const [form,setForm]=useState({cycleType:'three_month' as const,title:`${year}年${month}月开始 3个月目标`,periodStart:start,periodEnd:end,managerStaffId:Number(store.operatorId||0),managerName:store.operatorName||'',notes:''});const m=trpc.storeExecution.saveCycle.useMutation({onSuccess:()=>{toast.success('目标周期已保存');onSaved();},onError:e=>toast.error(e.message)});return <Modal title="新建目标周期" onClose={onClose}><div className="grid gap-4 md:grid-cols-2"><Field label="周期类型"><Select value={form.cycleType} onValueChange={(v:any)=>setForm({...form,cycleType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="three_month">3个月目标</SelectItem><SelectItem value="monthly">月度目标</SelectItem><SelectItem value="custom">自定义期间</SelectItem></SelectContent></Select></Field><Field label="店长"><Select value={String(form.managerStaffId||'custom')} onValueChange={v=>{const s=staffList.find(x=>String(x.id)===v);setForm({...form,managerStaffId:s?Number(s.id):0,managerName:s?.name||form.managerName});}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{staffList.map(s=><SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}<SelectItem value="custom">手动输入</SelectItem></SelectContent></Select></Field><Field label="目标标题"><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Field><Field label="店长姓名"><Input value={form.managerName} onChange={e=>setForm({...form,managerName:e.target.value})}/></Field><Field label="开始日"><Input type="date" value={form.periodStart} onChange={e=>setForm({...form,periodStart:e.target.value})}/></Field><Field label="结束日"><Input type="date" value={form.periodEnd} onChange={e=>setForm({...form,periodEnd:e.target.value})}/></Field><div className="md:col-span-2"><Field label="目标说明"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={!form.title||!form.managerName||m.isPending} onClick={()=>m.mutate({...form,storeId:Number(store.id),managerStaffId:form.managerStaffId||null})}>{m.isPending?<Loader2 className="mr-1 h-4 w-4 animate-spin"/>:<Save className="mr-1 h-4 w-4"/>}保存</Button></div></Modal>}
function GoalForm({storeId,cycleId,onClose,onSaved}:{storeId:number;cycleId:number;onClose:()=>void;onSaved:()=>void}){const [template,setTemplate]=useState(metricTemplates[0]);const [form,setForm]=useState({baselineValue:'',targetValue:'',weight:'1',notes:''});const m=trpc.storeExecution.saveGoal.useMutation({onSuccess:()=>{toast.success('目标指标已保存');onSaved();},onError:e=>toast.error(e.message)});return <Modal title="添加数值目标" onClose={onClose}><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{metricTemplates.map(t=><button key={t.key} onClick={()=>setTemplate(t)} className={`rounded-lg border p-2 text-xs ${template.key===t.key?'border-indigo-500 bg-indigo-50 text-indigo-700':''}`}>{t.name}</button>)}</div><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="基准值"><Input type="number" value={form.baselineValue} onChange={e=>setForm({...form,baselineValue:e.target.value})}/></Field><Field label={`目标值（${template.unit}）`}><Input type="number" value={form.targetValue} onChange={e=>setForm({...form,targetValue:e.target.value})}/></Field><Field label="权重"><Input type="number" min="0.01" value={form.weight} onChange={e=>setForm({...form,weight:e.target.value})}/></Field><div className="md:col-span-3"><Field label="说明"><Textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field></div></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={!form.targetValue||m.isPending} onClick={()=>m.mutate({cycleId,storeId,metricKey:template.key,metricName:template.name,unit:template.unit,direction:template.direction,baselineValue:form.baselineValue?Number(form.baselineValue):null,targetValue:Number(form.targetValue),actualValue:null,actualSource:'not_available',weight:Number(form.weight),notes:form.notes,sortOrder:metricTemplates.findIndex(x=>x.key===template.key)})}>保存</Button></div></Modal>}
function WorkForm({store,cycles,value,onClose,onSaved}:{store:any;cycles:any[];value:any;onClose:()=>void;onSaved:()=>void}){const [form,setForm]=useState({workstream:value?.workstream||'product_links',title:value?.title||'',expectedResult:value?.expectedResult||'',ownerName:value?.ownerName||store.operatorName||'',priority:value?.priority||'medium',status:value?.status||'todo',progress:String(value?.progress||0),dueDate:value?.dueDate?String(value.dueDate).slice(0,10):'',resultSummary:value?.resultSummary||'',evidenceLabel:'',evidenceUrl:'',cycleId:value?.cycleId?String(value.cycleId):'none'});const m=trpc.storeExecution.saveWorkItem.useMutation({onSuccess:()=>{toast.success('重点工作已保存');onSaved();},onError:e=>toast.error(e.message)});return <Modal title={value?'更新重点工作':'添加重点工作'} onClose={onClose}><div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">{workTemplates.map(([key,title])=><button key={key} onClick={()=>setForm({...form,workstream:key,title})} className="rounded-lg border p-2 text-left text-xs hover:border-indigo-400"><b>{workstreamLabels[key]}</b><br/><span className="text-slate-500">{title}</span></button>)}</div><div className="grid gap-4 md:grid-cols-2"><Field label="工作分类"><Select value={form.workstream} onValueChange={v=>setForm({...form,workstream:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(workstreamLabels).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field><Field label="关联目标周期"><Select value={form.cycleId} onValueChange={v=>setForm({...form,cycleId:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">不关联</SelectItem>{cycles.map(c=><SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}</SelectContent></Select></Field><div className="md:col-span-2"><Field label="重点工作"><Input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Field></div><div className="md:col-span-2"><Field label="预期结果"><Textarea value={form.expectedResult} onChange={e=>setForm({...form,expectedResult:e.target.value})}/></Field></div><Field label="负责人"><Input value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})}/></Field><Field label="期限"><Input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field><Field label="状态"><Select value={form.status} onValueChange={v=>setForm({...form,status:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['todo','in_progress','blocked','done','cancelled'].map(s=><SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}</SelectContent></Select></Field><Field label="进度 %"><Input type="number" min="0" max="100" value={form.progress} onChange={e=>setForm({...form,progress:e.target.value})}/></Field><div className="md:col-span-2"><Field label="实际结果・过程"><Textarea value={form.resultSummary} onChange={e=>setForm({...form,resultSummary:e.target.value})}/></Field></div><Field label="证据名称"><Input value={form.evidenceLabel} onChange={e=>setForm({...form,evidenceLabel:e.target.value})}/></Field><Field label="证据URL"><Input value={form.evidenceUrl} onChange={e=>setForm({...form,evidenceUrl:e.target.value})}/></Field></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={!form.title||m.isPending} onClick={()=>m.mutate({id:value?.id?Number(value.id):undefined,storeId:Number(store.id),cycleId:form.cycleId==='none'?null:Number(form.cycleId),workstream:form.workstream as any,title:form.title,expectedResult:form.expectedResult,ownerStaffId:null,ownerName:form.ownerName,priority:form.priority as any,status:form.status as any,progress:Number(form.progress),dueDate:form.dueDate||null,resultSummary:form.resultSummary,evidence:form.evidenceUrl?[{label:form.evidenceLabel||'成果证据',url:form.evidenceUrl}]:[]})}>保存</Button></div></Modal>}
function ReviewForm({storeId,cycles,onSaved}:{storeId:number;cycles:any[];onSaved:()=>void}){const [open,setOpen]=useState(false);const [form,setForm]=useState({cycleId:'none',resultRating:'3',executionRating:'3',qualityRating:'3',improvementRating:'3',comment:'',nextFocus:'',supportDecision:''});const m=trpc.storeExecution.createReview.useMutation({onSuccess:()=>{toast.success('管理评价已保存');setOpen(false);onSaved();},onError:e=>toast.error(e.message)});if(!open)return <Button onClick={()=>setOpen(true)}><Star className="mr-1 h-4 w-4"/>写管理评价</Button>;return <Modal title="管理评价" onClose={()=>setOpen(false)}><div className="grid gap-4 md:grid-cols-2"><Field label="目标周期"><Select value={form.cycleId} onValueChange={v=>setForm({...form,cycleId:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">不指定</SelectItem>{cycles.map(c=><SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}</SelectContent></Select></Field><div/><>{[['resultRating','结果'],['executionRating','执行'],['qualityRating','质量'],['improvementRating','改善']].map(([k,l])=><Field key={k} label={`${l}（1-5）`}><Select value={(form as any)[k]} onValueChange={v=>setForm({...form,[k]:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{[1,2,3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select></Field>)}</><div className="md:col-span-2"><Field label="评价内容"><Textarea value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})}/></Field></div><Field label="下一重点"><Textarea value={form.nextFocus} onChange={e=>setForm({...form,nextFocus:e.target.value})}/></Field><Field label="支援决定"><Textarea value={form.supportDecision} onChange={e=>setForm({...form,supportDecision:e.target.value})}/></Field></div><div className="mt-5 flex justify-end"><Button disabled={form.comment.length<3||m.isPending} onClick={()=>m.mutate({storeId,cycleId:form.cycleId==='none'?null:Number(form.cycleId),reportSeriesKey:null,resultRating:Number(form.resultRating),executionRating:Number(form.executionRating),qualityRating:Number(form.qualityRating),improvementRating:Number(form.improvementRating),comment:form.comment,nextFocus:form.nextFocus,supportDecision:form.supportDecision})}>保存评价</Button></div></Modal>}
