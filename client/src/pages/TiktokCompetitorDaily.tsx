import * as XLSX from 'xlsx';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Eye, FileSpreadsheet, Files, GitCompareArrows, ImagePlus, Link2, Loader2, LockKeyhole, RefreshCw, RotateCcw, Save, Send, ShieldCheck, Store, Upload, Users, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { TIKTOK_COMPETITOR_TEMPLATE_HEADERS } from '@shared/tiktokCompetitorTemplate';
import { competitorSheetToRows } from '@shared/tiktokCompetitorWorkbookRows';

function jstToday() { return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tokyo'}); }
function shiftDate(date:string,days:number){const value=new Date(`${date}T12:00:00+09:00`);value.setDate(value.getDate()+days);return value.toLocaleDateString('en-CA',{timeZone:'Asia/Tokyo'});}
function numberOrNull(value:string){if(value.trim()==='')return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;}
function pct(value:any){return value===null||value===undefined?'无数据':`${(Number(value)*100).toFixed(2)}%`;}
function money(value:any){return value===null||value===undefined?'无数据':`¥${Math.round(Number(value)).toLocaleString()}`;}
function metric(value:any){return value===null||value===undefined?'无数据':Number(value).toLocaleString();}
function statusLabel(status:string){return({draft:'草稿',submitted:'已提交',returned:'已退回',approved:'已确认'} as Record<string,string>)[status]||status;}
function statusClass(status:string){if(status==='approved')return'bg-emerald-100 text-emerald-700';if(status==='submitted')return'bg-blue-100 text-blue-700';if(status==='returned')return'bg-red-100 text-red-700';return'bg-amber-100 text-amber-700';}
async function toBase64(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});}

type PendingRankingImport = {
  id:string;
  draftId?:number;
  file?:File;
  fileName:string;
  fileSize:number;
  rows:Record<string,unknown>[];
  preview:any|null;
  status:'parsing'|'saving'|'ready'|'committing'|'error';
  error?:string;
  createdByName?:string;
  updatedAt?:unknown;
};

function pendingFromDraft(draft:any):PendingRankingImport{
  return {
    id:`draft-${Number(draft.id)}`,
    draftId:Number(draft.id),
    fileName:String(draft.fileName),
    fileSize:Number(draft.fileSize||0),
    rows:Array.isArray(draft.rows)?draft.rows:[],
    preview:draft.preview||null,
    status:'ready',
    error:draft.errorMessage||undefined,
    createdByName:draft.createdByName||undefined,
    updatedAt:draft.updatedAt,
  };
}

async function parseWorkbook(file:File){
  const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});
  const rows:Record<string,unknown>[]=[];
  for(const sheetName of workbook.SheetNames){
    const sheet=workbook.Sheets[sheetName];
    const sheetRows=competitorSheetToRows(sheet,sheetName);
    for(const row of sheetRows) rows.push(row);
  }
  return rows;
}

export default function TiktokCompetitorDaily(){
  const {user,loading:authLoading}=useAuth();
  const [,setLocation]=useLocation();
  const initialDate=new URLSearchParams(window.location.search).get('date')||jstToday();
  const [selectedDate,setSelectedDate]=useState(initialDate);
  const [selectedReportId,setSelectedReportId]=useState<number|null>(null);
  const [pendingImports,setPendingImports]=useState<PendingRankingImport[]>([]);
  const [selectedBatchIds,setSelectedBatchIds]=useState<number[]>([]);
  const [viewBatchId,setViewBatchId]=useState<number|null>(null);
  const [historyStart,setHistoryStart]=useState(shiftDate(initialDate,-30));
  const [reporterFilter,setReporterFilter]=useState('');
  const [shopFilter,setShopFilter]=useState('');
  const utils=trpc.useUtils();
  const connection=trpc.tiktokCompetitorDaily.connectionStatus.useQuery();
  const task=trpc.tiktokCompetitorDaily.taskStatus.useQuery({date:selectedDate});
  const reports=trpc.tiktokCompetitorDaily.listReports.useQuery({startDate:selectedDate,endDate:selectedDate});
  const rankingBatches=trpc.tiktokCompetitorDaily.listRankingBatches.useQuery({date:selectedDate});
  const viewedBatch=trpc.tiktokCompetitorDaily.getRankingBatch.useQuery({snapshotId:viewBatchId||1},{enabled:Boolean(viewBatchId)});
  const batchComparison=trpc.tiktokCompetitorDaily.compareRankingBatches.useQuery(
    {date:selectedDate,snapshotIds:selectedBatchIds.length>=2?selectedBatchIds:[1,2]},
    {enabled:selectedBatchIds.length>=2},
  );
  const historyReports=trpc.tiktokCompetitorDaily.listReports.useQuery({startDate:historyStart,endDate:selectedDate});
  const overview=trpc.tiktokCompetitorDaily.managementOverview.useQuery({startDate:shiftDate(selectedDate,-6),endDate:selectedDate},{enabled:Boolean(task.data?.isAdmin)});
  const previewMutation=trpc.tiktokCompetitorDaily.previewImport.useMutation();
  const uploadRanking=trpc.tiktokCompetitorDaily.uploadRankingFile.useMutation();
  const commitDraft=trpc.tiktokCompetitorDaily.commitImportDraft.useMutation();
  const discardDraft=trpc.tiktokCompetitorDaily.discardImportDraft.useMutation();
  const canImport=Boolean(task.data?.isAdmin||task.data?.isMorningOperator);
  const importDrafts=trpc.tiktokCompetitorDaily.listImportDrafts.useQuery({date:selectedDate},{enabled:canImport});

  useEffect(()=>{
    if(!importDrafts.data)return;
    setPendingImports(current=>{
      const local=current.filter(item=>!item.draftId&&['parsing','saving','error'].includes(item.status));
      return [...local,...importDrafts.data.map(pendingFromDraft)];
    });
  },[importDrafts.data]);

  const changeDate=(date:string)=>{setSelectedDate(date);setSelectedReportId(null);setPendingImports([]);setSelectedBatchIds([]);setViewBatchId(null);};
  const updatePending=(id:string,patch:Partial<PendingRankingImport>)=>setPendingImports(current=>current.map(item=>item.id===id?{...item,...patch}:item));
  const handleFiles=async(nextFiles:File[])=>{
    for(const nextFile of nextFiles){
      const id=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const pending:PendingRankingImport={id,file:nextFile,fileName:nextFile.name,fileSize:nextFile.size,rows:[],preview:null,status:'parsing'};
      setPendingImports(current=>[...current,pending]);
      try{
        if(!/\.(csv|xlsx|xls)$/i.test(nextFile.name))throw new Error('只支持Kalodata导出的CSV、XLSX或XLS文件');
        if(nextFile.size<=0||nextFile.size>20*1024*1024)throw new Error('每份排名文件必须小于20MB');
        const rows=await parseWorkbook(nextFile);
        if(!rows.length)throw new Error('文件中没有可读取的数据行');
        const preview=await previewMutation.mutateAsync({rows});
        updatePending(id,{rows,preview,status:'saving',error:undefined});
        const dataBase64=await toBase64(nextFile);
        const uploadResult=await uploadRanking.mutateAsync({date:selectedDate,fileName:nextFile.name,mimeType:nextFile.type||'application/octet-stream',dataBase64});
        if(uploadResult.duplicate){
          toast.info(`相同文件已保留为正式批次 #${uploadResult.snapshotId}，没有重复上传或覆盖`);
          setPendingImports(current=>current.filter(entry=>entry.id!==id));
          await utils.tiktokCompetitorDaily.invalidate();
          return;
        }
        const draft=uploadResult.draft;
        updatePending(id,{draftId:Number(draft.id),fileName:draft.fileName,fileSize:Number(draft.fileSize),rows:draft.rows,preview:draft.preview,status:'ready',error:draft.errorMessage||undefined,createdByName:draft.createdByName,updatedAt:draft.updatedAt});
        toast.success(uploadResult.recovered?'已恢复此前保存的待确认草稿':'识别结果已自动保存，返回或刷新后仍可继续');
        await utils.tiktokCompetitorDaily.listImportDrafts.invalidate({date:selectedDate});
      }catch(error){
        const message=error instanceof Error?error.message:String(error);
        updatePending(id,{status:'error',error:message});
        toast.error(`${nextFile.name}：${message}`);
      }
    }
  };
  const confirmImport=async(id:string)=>{
    const item=pendingImports.find(current=>current.id===id);
    if(!item?.draftId||!item.rows.length||!item.preview)return;
    updatePending(id,{status:'committing',error:undefined});
    try{
      const result=await commitDraft.mutateAsync({draftId:item.draftId});
      if(result.duplicate)toast.info(`相同文件已存在于批次 #${result.snapshotId}，没有覆盖任何日报`);
      else toast.success(`新增批次 #${result.snapshotId}；新建${result.createdReportIds.length}份日报，保留${result.preservedReportIds.length}份原日报`);
      setPendingImports(current=>current.filter(entry=>entry.id!==id));
      await utils.tiktokCompetitorDaily.invalidate();
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      updatePending(id,{status:'error',error:message});
      toast.error(`${item.fileName}：${message}`);
    }
  };
  const removePending=async(id:string)=>{
    const item=pendingImports.find(current=>current.id===id);
    if(!item)return;
    if(item.draftId){
      try{
        await discardDraft.mutateAsync({draftId:item.draftId});
        await utils.tiktokCompetitorDaily.listImportDrafts.invalidate({date:selectedDate});
        toast.success('待确认草稿已放弃');
      }catch(error){
        toast.error(error instanceof Error?error.message:String(error));
        return;
      }
    }
    setPendingImports(current=>current.filter(entry=>entry.id!==id));
  };
  const toggleBatch=(id:number)=>setSelectedBatchIds(current=>{
    if(current.includes(id))return current.filter(value=>value!==id);
    if(current.length>=4){toast.error('一次最多对比4个批次');return current;}
    return [...current,id].sort((a,b)=>a-b);
  });
  const downloadTemplate=()=>{
    const sheet=XLSX.utils.json_to_sheet([],{header:[...TIKTOK_COMPETITOR_TEMPLATE_HEADERS]});
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,'Kalodata排名');
    XLSX.writeFile(workbook,`Kalodata_日本区竞品日报_${selectedDate}.xlsx`);
  };
  useEffect(()=>{
    const ids=(rankingBatches.data||[]).map((batch:any)=>Number(batch.id));
    setSelectedBatchIds(current=>{
      const valid=current.filter(id=>ids.includes(id));
      if(valid.length||ids.length<2)return valid;
      return ids.slice(-2);
    });
    if(viewBatchId&&!ids.includes(viewBatchId))setViewBatchId(null);
  },[rankingBatches.data]);
  const busy=task.isLoading||reports.isLoading||rankingBatches.isLoading;
  const filteredHistory=(historyReports.data||[]).filter((report:any)=>report.assignedStaffName.toLowerCase().includes(reporterFilter.trim().toLowerCase())&&(!shopFilter.trim()||report.shopNames.some((name:string)=>name.toLowerCase().includes(shopFilter.trim().toLowerCase()))));
  if(authLoading)return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-600"/></div>;
  if(!user){window.location.href=`/login?redirect=${encodeURIComponent(window.location.pathname+window.location.search)}`;return null;}
  return <div className="min-h-screen bg-slate-50">
    <div className="sticky top-0 z-20 border-b bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={()=>setLocation('/staff-schedule')}><ArrowLeft className="h-5 w-5"/></Button><div className="rounded-xl bg-gradient-to-br from-slate-950 to-blue-800 p-2 text-white"><BarChart3 className="h-5 w-5"/></div><div><h1 className="font-bold text-slate-900">日本区TikTok竞品商品日报</h1><p className="text-xs text-slate-500">Kalodata店铺前5 × 每店热卖前三商品</p></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={()=>changeDate(shiftDate(selectedDate,-1))}><ChevronLeft className="h-4 w-4"/></Button><Input type="date" className="w-[150px]" value={selectedDate} onChange={event=>changeDate(event.target.value)}/><Button variant="outline" size="icon" onClick={()=>changeDate(shiftDate(selectedDate,1))}><ChevronRight className="h-4 w-4"/></Button><Button variant="outline" onClick={()=>{task.refetch();reports.refetch();}}><RefreshCw className="mr-1 h-4 w-4"/>更新</Button></div>
      </div>
    </div>
    <main className="mx-auto max-w-[1500px] space-y-5 p-4">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950 to-cyan-800 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold tracking-[0.2em] text-cyan-200">COMPETITOR INTELLIGENCE DAILY</p><h2 className="mt-1 text-xl font-bold">{selectedDate} 早班竞品巡查</h2><p className="mt-1 text-sm text-white/70">先导入店铺销量排名，再由系统生成前5店与15个商品槽位。</p></div><div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm"><p className="flex items-center gap-2 font-semibold">{connection.data?.apiConfigured?<><ShieldCheck className="h-4 w-4 text-emerald-300"/>Open API已连接</>:<><LockKeyhole className="h-4 w-4 text-amber-300"/>Open API待连接</>}</p><p className="mt-1 text-xs text-white/60">官方导出导入：可用</p></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><HeroKpi label="当天早班运营" value={`${task.data?.morningOperators.length||0}人`} detail={(task.data?.morningOperators||[]).map((item:any)=>item.name).join('、')||'未排早班'}/><HeroKpi label="排名快照" value={task.data?.rankingSnapshot?'已导入':'未导入'} detail={task.data?.rankingSnapshot?`${task.data.rankingSnapshot.shopCount}店 / ${task.data.rankingSnapshot.productCount}品`:'等待Kalodata数据'}/><HeroKpi label="运营日报" value={`${reports.data?.length||0}份`} detail={`已完成 ${(reports.data||[]).filter((item:any)=>item.status==='approved').length}份`}/><HeroKpi label="必填商品" value="15品" detail="前5店 × 各3品"/></div>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4"/><b>数据口径：</b>{connection.data?.precisionNotice||'Kalodata数据属于市场情报估算。'} 点击率等文件中没有的指标显示“无数据”，不会按0评价。</div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs text-slate-600"><span className="font-bold text-slate-800">常用竞争账号候选：</span>{['ABITOKYO','MOBMART','KANA','ZOUNEKO','NAGIBEAUTY'].map(name=><span key={name} className="rounded-full bg-slate-100 px-2 py-1 font-semibold">{name}</span>)}<span className="text-slate-400">未进入销量前5时，可在日报中作为补充观察账号加入。</span></div>

      {busy?<div className="flex justify-center p-14"><Loader2 className="h-7 w-7 animate-spin text-blue-600"/></div>:<>
        {task.data?.isAdmin&&overview.data&&<section className="rounded-2xl border bg-white p-5 shadow-sm"><div><h3 className="font-bold">管理者近7日竞品巡查总览</h3><p className="text-xs text-slate-500">{shiftDate(selectedDate,-6)}〜{selectedDate}，不把缺失数据按0评价。</p></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Mini label="日报总数" value={String(overview.data.summary.totalReports)}/><Mini label="早班负责人" value={`${overview.data.summary.operatorCount}人`}/><Mini label="待确认" value={`${overview.data.summary.submittedCount}份`}/><Mini label="已确认" value={`${overview.data.summary.approvedCount}份`}/></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border p-4"><h4 className="text-sm font-bold">进入前5的店铺</h4><div className="mt-2 space-y-2">{overview.data.topShops.slice(0,5).map((shop:any)=><div key={shop.shopName} className="flex items-center justify-between text-xs"><span><b className="mr-2 text-blue-700">#{shop.bestRank}</b>{shop.shopName}</span><span className="text-slate-500">{shop.observedDays}日 · {money(shop.maxGmv)}</span></div>)}{!overview.data.topShops.length&&<p className="text-xs text-slate-400">尚无排名数据</p>}</div></div><div className="rounded-xl border p-4"><h4 className="text-sm font-bold">期间热卖商品</h4><div className="mt-2 space-y-2">{overview.data.topProducts.slice(0,5).map((product:any,index:number)=><div key={`${product.shopName}-${product.productName}`} className="flex items-center justify-between gap-3 text-xs"><span className="truncate"><b className="mr-2 text-cyan-700">{index+1}</b>{product.productName}<span className="ml-1 text-slate-400">· {product.shopName}</span></span><span className="shrink-0 text-slate-500">销量 {metric(product.maxUnitsSold)}</span></div>)}{!overview.data.topProducts.length&&<p className="text-xs text-slate-400">尚无商品数据</p>}</div></div></div></section>}
        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="flex items-center gap-2 font-bold"><Upload className="h-4 w-4 text-blue-600"/>Kalodata日本区排名导入</h3><p className="mt-1 text-xs text-slate-500">识别成功后自动保存为待确认草稿；返回或刷新仍可继续，确认后才生成正式批次。</p></div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}><FileSpreadsheet className="mr-1 h-4 w-4"/>下载空白模板</Button>
            </div>
            {canImport?<label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-8 text-center hover:border-blue-400"><Files className="h-8 w-8 text-blue-500"/><span className="mt-2 text-sm font-semibold">选择一份或多份Kalodata导出文件</span><span className="mt-1 text-xs text-slate-500">自动保存待确认草稿，不生成日报、不覆盖正式批次</span><input type="file" multiple className="hidden" accept=".csv,.xlsx,.xls" onChange={event=>{const files=Array.from(event.target.files||[]);if(files.length)handleFiles(files);event.currentTarget.value='';}}/></label>:<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">只有当天运营部早班人员或管理员可以导入排名。</div>}
            <PendingImportQueue items={pendingImports} onConfirm={confirmImport} onRemove={removePending}/>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-cyan-600"/>当天责任人</h3><div className="mt-3 space-y-2">{(task.data?.morningOperators||[]).map((operator:any)=><div key={operator.id} className="flex items-center justify-between rounded-lg border p-3"><div><p className="text-sm font-semibold">{operator.name}</p><p className="text-xs text-slate-500">早班 {operator.startTime}–{operator.endTime}</p></div><CheckCircle2 className="h-4 w-4 text-blue-500"/></div>)}{!task.data?.morningOperators.length&&<div className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-400">当天没有符合条件的运营部早班排班，系统不会随意指定负责人。</div>}</div></div>
        </section>

        <RankingBatchSection
          batches={rankingBatches.data||[]}
          selectedIds={selectedBatchIds}
          onToggle={toggleBatch}
          onView={id=>setViewBatchId(id)}
          viewedBatch={viewedBatch.data}
          viewLoading={viewedBatch.isLoading}
          comparison={batchComparison.data}
          comparisonLoading={batchComparison.isLoading}
          comparisonError={batchComparison.error?.message}
        />

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h3 className="font-bold">日报任务与管理进度</h3><p className="text-xs text-slate-500">运营只看到本人日报；管理员查看当天全部早班负责人。</p></div><Badge text={`${reports.data?.length||0}份`} tone="blue"/></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(reports.data||[]).map((report:any)=><button key={report.id} onClick={()=>setSelectedReportId(Number(report.id))} className={`rounded-xl border p-4 text-left transition hover:border-blue-300 hover:shadow ${selectedReportId===Number(report.id)?'border-blue-500 bg-blue-50/40':''}`}><div className="flex items-center justify-between"><span className="font-semibold">{report.assignedStaffName}</span><span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(report.status)}`}>{statusLabel(report.status)}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><Mini label="店铺" value={`${report.shopCount}/5`}/><Mini label="商品槽位" value={`${report.productCount}/15`}/><Mini label="已填名称" value={`${report.completedProductCount}/15`}/></div><p className="mt-3 text-xs text-blue-700">打开日报 →</p></button>)}{!reports.data?.length&&<div className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-slate-400">导入当天排名后，系统会为早班运营生成日报任务。</div>}</div></section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">日报历史与追溯</h3><p className="text-xs text-slate-500">默认查看近31日，可按汇报人和前5店铺名称筛选。</p></div><Badge text={`${filteredHistory.length}份`} tone="slate"/></div><div className="mt-4 grid gap-2 md:grid-cols-3"><Field label="开始日期"><Input type="date" value={historyStart} max={selectedDate} onChange={event=>setHistoryStart(event.target.value)}/></Field><Field label="汇报人"><Input value={reporterFilter} onChange={event=>setReporterFilter(event.target.value)} placeholder="输入运营姓名"/></Field><Field label="店铺"><Input value={shopFilter} onChange={event=>setShopFilter(event.target.value)} placeholder="输入竞争店铺名"/></Field></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b bg-slate-50 text-left text-slate-500"><th className="p-3">日期</th><th className="p-3">汇报人</th><th className="p-3">前5店</th><th className="p-3">完成</th><th className="p-3">状态</th><th className="p-3"></th></tr></thead><tbody>{filteredHistory.map((report:any)=><tr key={report.id} className="border-b"><td className="p-3 font-semibold">{report.reportDate}</td><td className="p-3">{report.assignedStaffName}</td><td className="max-w-[320px] truncate p-3" title={report.shopNames.join('、')}>{report.shopNames.join('、')||'未生成'}</td><td className="p-3">{report.completedProductCount}/15</td><td className="p-3"><span className={`rounded-full px-2 py-0.5 ${statusClass(report.status)}`}>{statusLabel(report.status)}</span></td><td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={()=>{setSelectedDate(report.reportDate);setSelectedReportId(Number(report.id));window.scrollTo({top:0,behavior:'smooth'});}}>查看</Button></td></tr>)}{!filteredHistory.length&&<tr><td colSpan={6} className="p-8 text-center text-slate-400">此范围没有符合条件的日报</td></tr>}</tbody></table></div></section>

        {selectedReportId&&<ReportEditor reportId={selectedReportId} isAdmin={Boolean(task.data?.isAdmin)} onClose={()=>setSelectedReportId(null)} onChanged={()=>{reports.refetch();task.refetch();}}/>}
      </>}
    </main>
  </div>;
}

function formatBytes(value:number){if(value<1024)return`${value} B`;if(value<1024*1024)return`${(value/1024).toFixed(1)} KB`;return`${(value/1024/1024).toFixed(1)} MB`;}
function formatImportedAt(value:unknown){try{return new Date(String(value)).toLocaleString('zh-CN',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});}catch{return String(value||'');}}
function signedMetric(value:unknown,suffix=''){if(value===null||value===undefined)return'无数据';const numeric=Number(value);return`${numeric>0?'+':''}${numeric.toLocaleString()}${suffix}`;}
function changeTone(value:unknown,inverse=false){if(value===null||value===undefined||Number(value)===0)return'text-slate-500';const positive=Number(value)>0;return positive!==inverse?'text-emerald-700':'text-red-600';}
function previewText(value:unknown){return value===null||value===undefined||String(value).trim()===''?'无数据':String(value);}
function PreviewLink({value,label}:{value:unknown;label:string}){const url=previewText(value);if(url==='无数据')return <span className="text-slate-400">无数据</span>;return <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-[180px] items-center gap-1 truncate text-blue-700 hover:underline" title={url}><Link2 className="h-3 w-3 shrink-0"/>{label}</a>;}

function PendingImportQueue({items,onConfirm,onRemove}:{items:PendingRankingImport[];onConfirm:(id:string)=>void;onRemove:(id:string)=>void}){
  if(!items.length)return null;
  return <div className="mt-4 space-y-3"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-800">待确认草稿</p><p className="text-[11px] text-slate-500">持续保留到确认或主动放弃；确认前不会生成日报或正式批次</p></div><Badge text={`${items.length}份可恢复`} tone="blue"/></div>{items.map(item=><div key={item.id} className={`rounded-xl border p-4 ${item.status==='error'?'border-red-200 bg-red-50/40':'border-blue-100 bg-white'}`} data-testid={`pending-import-${item.fileName}`}><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold" title={item.fileName}>{item.fileName}</p><p className="text-[11px] text-slate-500">{formatBytes(item.fileSize)} · {item.status==='parsing'?'正在识别':item.status==='saving'?'正在保存待确认草稿':item.status==='committing'?'正在生成正式批次':item.status==='ready'?'草稿已保存，返回或刷新后仍保留':'需要处理错误'}{item.createdByName?` · 上传人 ${item.createdByName}`:''}</p></div><Button size="icon" variant="ghost" aria-label={`放弃${item.fileName}`} disabled={item.status==='saving'||item.status==='committing'} onClick={()=>onRemove(item.id)}><XCircle className="h-4 w-4"/></Button></div>{item.status==='parsing'&&<div className="mt-3 flex items-center text-xs text-blue-600"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>正在解析，不会影响其他文件</div>}{item.status==='saving'&&<div className="mt-3 flex items-center text-xs text-blue-600"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>正在保存草稿，完成后可安全返回</div>}{item.error&&<div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{item.error}</div>}{item.preview&&<><div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge text={`识别 ${item.preview.recognizedRows}行`} tone="blue"/><Badge text={`排除 ${item.preview.excludedRows}行`} tone={item.preview.excludedRows?'amber':'slate'}/><Badge text={`前5店 ${item.preview.shops.length}家`} tone={item.preview.shops.length===5?'green':'amber'}/></div>{item.preview.warnings?.length>0&&<div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{item.preview.warnings.map((warning:string)=><p key={warning}>· {warning}</p>)}</div>}<div className="mt-3"><p className="mb-2 text-xs font-bold text-slate-700">前5店汇总</p><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b bg-slate-50 text-left"><th className="p-2">排名</th><th className="p-2">店铺</th><th className="p-2 text-right">销量</th><th className="p-2 text-right">销售额</th><th className="p-2 text-right">商品</th></tr></thead><tbody>{item.preview.shops.map((shop:any)=><tr key={`${shop.rankingPosition}-${shop.shopName}`} className="border-b"><td className="p-2 font-bold text-blue-700">#{shop.rankingPosition}</td><td className="p-2 font-medium">{shop.shopName}</td><td className="p-2 text-right">{metric(shop.unitsSold)}</td><td className="p-2 text-right">{money(shop.gmv)}</td><td className="p-2 text-right">{shop.products.length}/3</td></tr>)}</tbody></table></div></div><div className="mt-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-slate-700">上传字段识别明细（13列）</p><span className="text-[11px] text-slate-500">共 {item.preview.rows?.length||0} 条；缺失值显示“无数据”</span></div><div className="overflow-x-auto rounded-lg border"><table className="min-w-[1900px] text-xs"><thead><tr className="border-b bg-slate-50 text-left"><th className="p-2">店铺排名</th><th className="p-2">店铺ID</th><th className="p-2">店铺名称</th><th className="p-2">店铺链接</th><th className="p-2">商品排名</th><th className="p-2">商品ID</th><th className="p-2">商品名称</th><th className="p-2">商品链接</th><th className="p-2 text-right">原价</th><th className="p-2 text-right">直播成交价</th><th className="p-2 text-right">销量</th><th className="p-2 text-right">销售额</th><th className="p-2">热度表现</th></tr></thead><tbody>{(item.preview.rows||[]).map((row:any,index:number)=><tr key={`${row.sheetName||'sheet'}-${index}-${row.externalProductId||row.productName||'row'}`} className="border-b align-top"><td className="max-w-[180px] p-2">{previewText(row.sourceShopRank??row.shopRank)}</td><td className="p-2 font-mono">{previewText(row.externalShopId)}</td><td className="p-2 font-medium">{previewText(row.shopName)}</td><td className="p-2"><PreviewLink value={row.shopUrl} label="打开店铺"/></td><td className="p-2">{metric(row.productRank)}</td><td className="p-2 font-mono">{previewText(row.externalProductId)}</td><td className="max-w-[260px] p-2">{previewText(row.productName)}</td><td className="p-2"><PreviewLink value={row.productUrl} label="打开商品"/></td><td className="p-2 text-right">{money(row.originalPrice)}</td><td className="p-2 text-right">{money(row.livePrice)}</td><td className="p-2 text-right">{metric(row.unitsSold)}</td><td className="p-2 text-right">{money(row.gmv)}</td><td className="max-w-[220px] p-2">{previewText(row.heatEvidence)}</td></tr>)}</tbody></table></div></div><div className="mt-3 flex justify-end"><Button disabled={!item.draftId||!item.preview.shops.length||item.status==='saving'||item.status==='committing'} onClick={()=>onConfirm(item.id)}>{item.status==='committing'?<Loader2 className="mr-1 h-4 w-4 animate-spin"/>:<CheckCircle2 className="mr-1 h-4 w-4"/>}确认并保存为正式批次</Button></div></>}</div>)}</div>;
}

function RankingBatchSection({batches,selectedIds,onToggle,onView,viewedBatch,viewLoading,comparison,comparisonLoading,comparisonError}:{batches:any[];selectedIds:number[];onToggle:(id:number)=>void;onView:(id:number)=>void;viewedBatch:any;viewLoading:boolean;comparison:any;comparisonLoading:boolean;comparisonError?:string}){
  return <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm" data-testid="ranking-batch-section"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold"><GitCompareArrows className="h-4 w-4 text-indigo-600"/>同日导入批次（不会覆盖）</h3><p className="mt-1 text-xs text-slate-500">每份文件独立保存。勾选2至4份，比较店铺与商品的排名、销量、GMV和价格变化。</p></div><Badge text={`${batches.length}个批次`} tone={batches.length?'green':'slate'}/></div>{!batches.length?<div className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">当天还没有已保存的导入批次</div>:<><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{batches.map((batch:any)=><div key={batch.id} className={`rounded-xl border p-4 ${selectedIds.includes(Number(batch.id))?'border-indigo-400 bg-indigo-50/40':'border-slate-200'}`} data-testid={`ranking-batch-${batch.id}`}><div className="flex items-start justify-between gap-2"><label className="flex min-w-0 cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-600" checked={selectedIds.includes(Number(batch.id))} onChange={()=>onToggle(Number(batch.id))}/><span className="min-w-0"><span className="block truncate text-sm font-semibold" title={batch.sourceFileName||`批次 #${batch.id}`}>{batch.sourceFileName||`批次 #${batch.id}`}</span><span className="text-[11px] text-slate-500">#{batch.id} · {formatImportedAt(batch.importedAt)}</span></span></label>{batch.isCurrent&&<Badge text="最新" tone="green"/>}</div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><Mini label="识别行" value={metric(batch.rowCount)}/><Mini label="店铺" value={metric(batch.shopCount)}/><Mini label="商品" value={metric(batch.productCount)}/></div><p className="mt-2 text-[11px] text-slate-500">导入：{batch.importedByName||'未知'} · 日报引用 {batch.linkedReportCount||0}份{batch.sourceFileSize?` · ${formatBytes(Number(batch.sourceFileSize))}`:''}</p><div className="mt-3 flex justify-end gap-2">{batch.sourceFileUrl&&<Button size="sm" variant="ghost" asChild><a href={batch.sourceFileUrl} target="_blank" rel="noreferrer"><FileSpreadsheet className="mr-1 h-3 w-3"/>原文件</a></Button>}<Button size="sm" variant="outline" onClick={()=>onView(Number(batch.id))}><Eye className="mr-1 h-3 w-3"/>查看</Button></div></div>)}</div>{viewLoading&&<div className="mt-4 flex items-center justify-center p-8 text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>读取批次</div>}{viewedBatch&&<BatchDetail batch={viewedBatch}/>}<div className="mt-5 border-t pt-5"><div className="flex items-center justify-between"><h4 className="font-bold text-slate-800">批次对比</h4><span className="text-xs text-slate-500">已选择 {selectedIds.length}/4</span></div>{selectedIds.length<2?<p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">至少勾选2个批次后显示对比。</p>:comparisonLoading?<div className="mt-3 flex items-center p-6 text-sm text-indigo-600"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>正在计算对比</div>:comparisonError?<p className="mt-3 rounded-lg bg-red-50 p-4 text-sm text-red-700">{comparisonError}</p>:comparison?<BatchComparison comparison={comparison}/>:null}</div></>}</section>;
}

function BatchDetail({batch}:{batch:any}){
  return <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/30 p-4" data-testid={`batch-detail-${batch.id}`}><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">批次 #{batch.id} · {batch.sourceFileName||'未命名文件'}</h4><span className="text-xs text-slate-500">{batch.shops.length}家店铺</span></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[760px] text-xs"><thead><tr className="border-b bg-white text-left"><th className="p-2">排名</th><th className="p-2">店铺</th><th className="p-2 text-right">销量</th><th className="p-2 text-right">GMV</th><th className="p-2">前三商品</th></tr></thead><tbody>{batch.shops.map((shop:any)=><tr key={shop.id||`${batch.id}-${shop.externalShopId||shop.shopName}-${shop.rankingPosition}`} className="border-b align-top"><td className="p-2 font-bold text-blue-700">#{shop.rankingPosition}</td><td className="p-2 font-semibold">{shop.shopName}</td><td className="p-2 text-right">{metric(shop.unitsSold)}</td><td className="p-2 text-right">{money(shop.gmv)}</td><td className="p-2">{shop.products.length?shop.products.map((product:any)=><p key={product.id||`${batch.id}-${shop.id}-${product.productRank}-${product.externalProductId||product.productName||'unknown'}`} className="mb-1"><b>#{product.productRank}</b> {product.productName||'未命名'} · {money(product.livePrice)} · 销量{metric(product.unitsSold)}</p>):<span className="text-slate-400">旧批次无独立商品明细</span>}</td></tr>)}</tbody></table></div></div>;
}

function BatchComparison({comparison}:{comparison:any}){
  return <div className="mt-3 space-y-5" data-testid="batch-comparison"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead><tr className="border-b bg-indigo-50 text-left"><th className="p-2">店铺</th>{comparison.batches.map((batch:any)=><th key={batch.id} className="p-2">#{batch.id}<span className="block max-w-[150px] truncate font-normal" title={batch.sourceFileName||''}>{batch.sourceFileName||'未命名'}</span></th>)}<th className="p-2">首份→末份变化</th></tr></thead><tbody>{comparison.shops.map((shop:any)=><tr key={shop.key} className="border-b"><td className="p-2 font-semibold">{shop.shopName}</td>{comparison.batches.map((batch:any)=>{const value=shop.values[String(batch.id)];return <td key={batch.id} className="p-2">{value?<><p>排名 #{value.rankingPosition}</p><p>销量 {metric(value.unitsSold)}</p><p>GMV {money(value.gmv)}</p></>:<span className="text-slate-400">无数据</span>}</td>;})}<td className="p-2"><p className={changeTone(shop.changes.rankingPosition,true)}>排名 {signedMetric(shop.changes.rankingPosition)}</p><p className={changeTone(shop.changes.unitsSold)}>销量 {signedMetric(shop.changes.unitsSold)}</p><p className={changeTone(shop.changes.gmv)}>GMV {signedMetric(shop.changes.gmv,' JPY')}</p></td></tr>)}</tbody></table></div><div><h5 className="mb-2 text-sm font-bold text-slate-800">商品对比</h5><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-xs"><thead><tr className="border-b bg-cyan-50 text-left"><th className="p-2">店铺 / 商品</th>{comparison.batches.map((batch:any)=><th key={batch.id} className="p-2">批次 #{batch.id}</th>)}<th className="p-2">首份→末份变化</th></tr></thead><tbody>{comparison.products.map((product:any)=><tr key={product.key} className="border-b align-top"><td className="p-2"><p className="font-semibold">{product.productName||'未命名商品'}</p><p className="text-slate-400">{product.shopName}</p></td>{comparison.batches.map((batch:any)=>{const value=product.values[String(batch.id)];return <td key={batch.id} className="p-2">{value?<><p>排名 #{value.productRank}</p><p>成交 {money(value.livePrice)}</p><p>销量 {metric(value.unitsSold)}</p><p>GMV {money(value.gmv)}</p></>:<span className="text-slate-400">无数据</span>}</td>;})}<td className="p-2"><p className={changeTone(product.changes.livePrice)}>成交价 {signedMetric(product.changes.livePrice,' JPY')}</p><p className={changeTone(product.changes.unitsSold)}>销量 {signedMetric(product.changes.unitsSold)}</p><p className={changeTone(product.changes.gmv)}>GMV {signedMetric(product.changes.gmv,' JPY')}</p></td></tr>)}</tbody></table></div></div></div>;
}

function HeroKpi({label,value,detail}:{label:string;value:string;detail:string}){return <div className="rounded-xl border border-white/10 bg-white/10 p-3"><p className="text-[11px] text-white/60">{label}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-1 truncate text-[10px] text-white/55" title={detail}>{detail}</p></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-lg bg-slate-50 p-2"><p className="text-[10px] text-slate-400">{label}</p><p className="font-bold text-slate-700">{value}</p></div>}
function Badge({text,tone}:{text:string;tone:'blue'|'green'|'amber'|'slate'}){const styles={blue:'bg-blue-100 text-blue-700',green:'bg-emerald-100 text-emerald-700',amber:'bg-amber-100 text-amber-700',slate:'bg-slate-100 text-slate-600'};return <span className={`rounded-full px-2 py-1 font-semibold ${styles[tone]}`}>{text}</span>}

function ReportEditor({reportId,isAdmin,onClose,onChanged}:{reportId:number;isAdmin:boolean;onClose:()=>void;onChanged:()=>void}){
  const utils=trpc.useUtils();
  const report=trpc.tiktokCompetitorDaily.getReport.useQuery({reportId});
  const [notes,setNotes]=useState('');
  const reportData:any=report.data;
  useEffect(()=>{if(reportData)setNotes(reportData.operatorNotes||'');},[reportData?.id,reportData?.operatorNotes]);
  const saveNotes=trpc.tiktokCompetitorDaily.saveReportNotes.useMutation({onSuccess:()=>{toast.success('巡查备注已保存');report.refetch();},onError:e=>toast.error(e.message)});
  const addObservedShop=trpc.tiktokCompetitorDaily.addObservedShop.useMutation({onSuccess:()=>{toast.success('补充竞争店铺已加入');report.refetch();onChanged();},onError:e=>toast.error(e.message)});
  const submit=trpc.tiktokCompetitorDaily.submitReport.useMutation({onSuccess:()=>{toast.success('日报已提交管理确认');report.refetch();onChanged();},onError:e=>toast.error(e.message)});
  const review=trpc.tiktokCompetitorDaily.reviewReport.useMutation({onSuccess:()=>{toast.success('审核状态已更新');report.refetch();onChanged();},onError:e=>toast.error(e.message)});
  if(report.isLoading)return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin"/></div>;
  const data:any=report.data;if(!data)return null;const editable=['draft','returned'].includes(data.status);
  return <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><button className="text-xs text-blue-600" onClick={onClose}>← 返回日报列表</button><h3 className="mt-1 text-lg font-bold">{data.assignedStaffName} · {String(data.reportDate).slice(0,10)}</h3><p className="text-xs text-slate-500">排名快照 #{data.rankingSnapshotId} · 日本区 · Kalodata市场情报</p></div><div className="flex gap-2"><span className={`rounded-full px-3 py-1 text-xs ${statusClass(data.status)}`}>{statusLabel(data.status)}</span>{data.returnReason&&<span className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-700">退回原因：{data.returnReason}</span>}</div></div>
    <div className="mt-5 space-y-5">{data.shops.map((shop:any)=><div key={shop.id} className={`overflow-hidden rounded-xl border ${shop.isPrimary?'':'border-violet-200'}`}><div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${shop.isPrimary?'bg-slate-50':'bg-violet-50'}`}><div className="flex items-center gap-2"><span className={`rounded-lg px-2 py-1 text-xs font-bold text-white ${shop.isPrimary?'bg-blue-700':'bg-violet-600'}`}>{shop.isPrimary?`#${shop.rankingPosition}`:'补充观察'}</span><Store className="h-4 w-4 text-slate-500"/><span className="font-bold">{shop.shopName}</span>{shop.shopUrl&&<a href={shop.shopUrl} target="_blank" rel="noreferrer" className="text-blue-600"><Link2 className="h-4 w-4"/></a>}</div><div className="flex gap-4 text-xs text-slate-500"><span>店铺销量 {metric(shop.unitsSold)}</span><span>销售额 {money(shop.gmv)}</span></div></div><div className="grid gap-3 p-3 xl:grid-cols-3">{shop.products.map((product:any)=><ProductEditor key={product.id} product={product} editable={editable} onSaved={()=>{report.refetch();utils.tiktokCompetitorDaily.listReports.invalidate();}}/>)}</div></div>)}</div>
    {editable&&<div className="mt-4 flex justify-end"><Button variant="outline" className="border-violet-200 text-violet-700" onClick={()=>{const shopName=prompt('请输入补充竞争账号／店铺名称');if(!shopName)return;const shopUrl=prompt('请输入店铺链接（没有可留空）','')||null;addObservedShop.mutate({reportId,shopName,shopUrl});}}><Store className="mr-1 h-4 w-4"/>补充其他热卖竞争账号</Button></div>}
    <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]"><div><label className="text-xs font-semibold text-slate-600">运营巡查备注</label><Textarea className="mt-1" rows={5} disabled={!editable} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="直播间反复主推、购买提示频繁、价格变化原因、值得跟进的商品…"/>{editable&&<Button className="mt-2" variant="outline" onClick={()=>saveNotes.mutate({reportId,operatorNotes:notes})}><Save className="mr-1 h-4 w-4"/>保存备注</Button>}</div><div className="rounded-xl border bg-slate-50 p-4"><h4 className="font-bold">自动分析状态</h4>{data.summary?<SummaryPanel summary={data.summary}/>:<p className="mt-2 text-sm text-slate-500">提交后生成完整率、平均折扣、销量/销售额/点击率冠军和缺失指标提示。</p>}</div></div>
    <div className="mt-5 flex flex-wrap justify-end gap-2">{editable&&<Button disabled={submit.isPending} onClick={()=>submit.mutate({reportId})}>{submit.isPending?<Loader2 className="mr-1 h-4 w-4 animate-spin"/>:<Send className="mr-1 h-4 w-4"/>}提交日报</Button>}{isAdmin&&data.status==='submitted'&&<><Button variant="outline" className="border-red-200 text-red-700" onClick={()=>{const reason=prompt('请输入退回原因');if(reason)review.mutate({reportId,action:'return',reason});}}>退回修改</Button><Button className="bg-emerald-600 hover:bg-emerald-700" onClick={()=>review.mutate({reportId,action:'approve',reason:'内容已确认'})}><ShieldCheck className="mr-1 h-4 w-4"/>确认日报</Button></>}</div>
  </section>;
}

function ProductEditor({product,editable,onSaved}:{product:any;editable:boolean;onSaved:()=>void}){
  const [draft,setDraft]=useState(()=>({productName:product.productName||'',externalProductId:product.externalProductId||'',productUrl:product.productUrl||'',originalPrice:product.originalPrice===null?'':String(product.originalPrice),livePrice:product.livePrice===null?'':String(product.livePrice),unitsSold:product.unitsSold===null?'':String(product.unitsSold),gmv:product.gmv===null?'':String(product.gmv),clickRate:product.clickRate===null?'':String(Number(product.clickRate)*100),conversionRate:product.conversionRate===null?'':String(Number(product.conversionRate)*100),heatEvidence:product.heatEvidence||'',screenshotUrls:product.screenshotUrls||[],screenshotKeys:product.screenshotKeys||[]}));
  useEffect(()=>{setDraft({productName:product.productName||'',externalProductId:product.externalProductId||'',productUrl:product.productUrl||'',originalPrice:product.originalPrice===null?'':String(product.originalPrice),livePrice:product.livePrice===null?'':String(product.livePrice),unitsSold:product.unitsSold===null?'':String(product.unitsSold),gmv:product.gmv===null?'':String(product.gmv),clickRate:product.clickRate===null?'':String(Number(product.clickRate)*100),conversionRate:product.conversionRate===null?'':String(Number(product.conversionRate)*100),heatEvidence:product.heatEvidence||'',screenshotUrls:product.screenshotUrls||[],screenshotKeys:product.screenshotKeys||[]});},[product.id,product.updatedAt]);
  const save=trpc.tiktokCompetitorDaily.saveProduct.useMutation({onSuccess:()=>{toast.success(`${product.shopName} 商品${product.productRank}已保存`);onSaved();},onError:e=>toast.error(e.message)});
  const upload=trpc.tiktokCompetitorDaily.uploadScreenshot.useMutation({onError:e=>toast.error(e.message)});
  const payload=(next=draft)=>({id:Number(product.id),reportId:Number(product.reportId),productName:next.productName.trim()||null,externalProductId:next.externalProductId.trim()||null,productUrl:next.productUrl.trim()||null,originalPrice:numberOrNull(next.originalPrice),livePrice:numberOrNull(next.livePrice),unitsSold:numberOrNull(next.unitsSold),gmv:numberOrNull(next.gmv),clickRate:next.clickRate.trim()===''?null:Number(next.clickRate)/100,conversionRate:next.conversionRate.trim()===''?null:Number(next.conversionRate)/100,heatEvidence:next.heatEvidence.trim()||null,screenshotUrls:next.screenshotUrls,screenshotKeys:next.screenshotKeys});
  const handleScreenshot=async(file:File)=>{try{const saved=await upload.mutateAsync({reportId:Number(product.reportId),fileName:file.name,mimeType:file.type as any,dataBase64:await toBase64(file)});const next={...draft,screenshotUrls:[...draft.screenshotUrls,saved.url],screenshotKeys:[...draft.screenshotKeys,saved.key]};setDraft(next);save.mutate(payload(next));}catch(error){toast.error(error instanceof Error?error.message:String(error));}};
  const previous=product.previous;
  return <div className="rounded-xl border bg-white p-3 shadow-sm"><div className="flex items-center justify-between"><span className="rounded bg-cyan-100 px-2 py-0.5 text-xs font-bold text-cyan-800">商品{product.productRank}</span>{product.discountRate!==null&&<span className="text-xs font-semibold text-red-600">折扣 {(Number(product.discountRate)*100).toFixed(1)}%</span>}</div><div className="mt-3 space-y-2"><Field label="商品名称"><Input disabled={!editable} value={draft.productName} onChange={event=>setDraft({...draft,productName:event.target.value})}/></Field><Field label="商品链接"><Input disabled={!editable} value={draft.productUrl} onChange={event=>setDraft({...draft,productUrl:event.target.value})}/></Field><div className="grid grid-cols-2 gap-2"><Field label="原价 JPY"><Input type="number" min="0" disabled={!editable} value={draft.originalPrice} onChange={event=>setDraft({...draft,originalPrice:event.target.value})}/></Field><Field label="直播成交价 JPY"><Input type="number" min="0" disabled={!editable} value={draft.livePrice} onChange={event=>setDraft({...draft,livePrice:event.target.value})}/></Field><Field label="销量"><Input type="number" min="0" disabled={!editable} value={draft.unitsSold} onChange={event=>setDraft({...draft,unitsSold:event.target.value})}/></Field><Field label="销售额 JPY"><Input type="number" min="0" disabled={!editable} value={draft.gmv} onChange={event=>setDraft({...draft,gmv:event.target.value})}/></Field><Field label="点击率 %"><Input type="number" min="0" max="100" disabled={!editable} value={draft.clickRate} onChange={event=>setDraft({...draft,clickRate:event.target.value})}/></Field><Field label="转化率 %"><Input type="number" min="0" max="100" disabled={!editable} value={draft.conversionRate} onChange={event=>setDraft({...draft,conversionRate:event.target.value})}/></Field></div><Field label="销量/热度证据"><Textarea rows={2} disabled={!editable} value={draft.heatEvidence} onChange={event=>setDraft({...draft,heatEvidence:event.target.value})} placeholder="已售数量、反复主推、购买提示频繁…"/></Field></div>
    {previous&&<div className="mt-3 rounded-lg bg-indigo-50 p-2 text-[11px] text-indigo-800"><p className="font-semibold">上次 {String(previous.reportDate).slice(0,10)}</p><p>成交价 {money(previous.livePrice)} → {draft.livePrice?money(Number(draft.livePrice)):'无数据'}</p><p>销量 {metric(previous.unitsSold)} → {draft.unitsSold||'无数据'} / 点击率 {pct(previous.clickRate)} → {draft.clickRate?`${draft.clickRate}%`:'无数据'}</p></div>}
    <div className="mt-3 flex flex-wrap gap-2">{draft.screenshotUrls.map((url:string,index:number)=><a key={url} href={url} target="_blank" rel="noreferrer" className="relative h-16 w-16 overflow-hidden rounded-lg border bg-slate-100"><img src={url} alt={`${product.productName||'商品'}价格截图${index+1}`} className="h-full w-full object-cover"/><span className="absolute bottom-0 right-0 bg-black/60 px-1 text-[9px] text-white">{index+1}</span></a>)}</div>
    {editable&&<div className="mt-3 flex gap-2"><label className="flex cursor-pointer items-center rounded-md border px-3 py-2 text-xs font-semibold hover:bg-slate-50"><ImagePlus className="mr-1 h-4 w-4"/>价格截图<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event=>{const file=event.target.files?.[0];if(file)handleScreenshot(file);event.currentTarget.value='';}}/></label><Button size="sm" className="ml-auto" disabled={save.isPending} onClick={()=>save.mutate(payload())}><Save className="mr-1 h-3 w-3"/>保存</Button></div>}
  </div>;
}
function Field({label,children}:{label:string;children:any}){return <label className="block"><span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>{children}</label>}
function SummaryPanel({summary}:{summary:any}){return <div className="mt-3 space-y-2 text-xs"><p className="rounded-lg bg-blue-950 p-3 font-semibold text-white">{summary.headline||`已完成${summary.productCount||0}/15品`}</p><p className="flex justify-between"><span>商品完整率</span><b>{Math.round(Number(summary.completionRate||0)*100)}%</b></p><p className="flex justify-between"><span>平均直播价</span><b>{money(summary.averageLivePrice)}</b></p><p className="flex justify-between"><span>平均折扣率</span><b>{pct(summary.averageDiscountRate)}</b></p><p className="flex justify-between"><span>平均点击率 / 转化率</span><b>{pct(summary.averageClickRate)} / {pct(summary.averageConversionRate)}</b></p><p className="flex justify-between"><span>价格变化</span><b>降{summary.priceChanges?.decreases||0} / 涨{summary.priceChanges?.increases||0} / 不变{summary.priceChanges?.unchanged||0}</b></p>{summary.topByUnits?.productName&&<p className="rounded bg-white p-2"><b>销量冠军：</b>{summary.topByUnits.productName}</p>}{summary.topByGmv?.productName&&<p className="rounded bg-white p-2"><b>销售额冠军：</b>{summary.topByGmv.productName}</p>}<SummaryList title="机会" items={summary.opportunities} tone="green"/><SummaryList title="风险" items={summary.risks} tone="amber"/><SummaryList title="下一步" items={summary.actions} tone="blue"/></div>}
function SummaryList({title,items,tone}:{title:string;items?:string[];tone:'green'|'amber'|'blue'}){if(!items?.length)return null;const style={green:'border-emerald-200 bg-emerald-50 text-emerald-800',amber:'border-amber-200 bg-amber-50 text-amber-800',blue:'border-blue-200 bg-blue-50 text-blue-800'}[tone];return <div className={`rounded-lg border p-2 ${style}`}><b>{title}</b>{items.map((item,index)=><p key={`${title}-${index}`} className="mt-1">· {item}</p>)}</div>}
