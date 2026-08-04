/**
 * Issue Tracker - 問題処理系統
 * 
 * Views:
 * - Kanban (看板): Drag-and-drop status columns
 * - List (列表): Table with filters
 * - Knowledge (知識庫): Archived solutions
 * - Stats (統計): Analytics dashboard
 */
import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Search, AlertCircle, Clock, CheckCircle2, XCircle, 
  MessageSquare, BookOpen, BarChart3, Kanban, List, Filter,
  ArrowUp, ArrowDown, Minus, Sparkles, Archive, Trash2, Edit,
  User, Calendar, Tag, ChevronDown, ChevronRight, Send, Paperclip, X, FileIcon, ImageIcon, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// ============ Constants ============
const CATEGORY_LABELS: Record<string, string> = {
  operation: '运营', technical: '技术', logistics: '物流',
  customer_service: '客服', finance: '财务', hr: '人事', other: '其他'
};
const CATEGORY_COLORS: Record<string, string> = {
  operation: 'bg-blue-100 text-blue-700', technical: 'bg-purple-100 text-purple-700',
  logistics: 'bg-green-100 text-green-700', customer_service: 'bg-orange-100 text-orange-700',
  finance: 'bg-yellow-100 text-yellow-700', hr: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-700'
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急', high: '高', medium: '中', low: '低'
};
const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500 text-white', high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white', low: 'bg-gray-400 text-white'
};
const PRIORITY_ICONS: Record<string, any> = {
  urgent: ArrowUp, high: ArrowUp, medium: Minus, low: ArrowDown
};
const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', in_progress: '处理中', waiting_confirm: '待确认',
  completed: '已完成', closed: '已关闭'
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'border-l-gray-400', in_progress: 'border-l-blue-500',
  waiting_confirm: 'border-l-yellow-500', completed: 'border-l-green-500',
  closed: 'border-l-gray-300'
};

type ViewMode = 'kanban' | 'list' | 'knowledge' | 'stats';

export default function IssueTracker() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [filters, setFilters] = useState({
    status: 'all' as string,
    category: 'all' as string,
    priority: 'all' as string,
    search: '',
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-red-500" />
            問題処理系統
          </h1>
          <p className="text-sm text-muted-foreground mt-1">内部チーム問題追跡・知識管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1"><Kanban className="h-4 w-4" />看板</TabsTrigger>
              <TabsTrigger value="list" className="gap-1"><List className="h-4 w-4" />列表</TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1"><BookOpen className="h-4 w-4" />知識庫</TabsTrigger>
              <TabsTrigger value="stats" className="gap-1"><BarChart3 className="h-4 w-4" />統計</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-1">
            <Plus className="h-4 w-4" /> 新建問題
          </Button>
        </div>
      </div>

      {/* Filters (for kanban and list) */}
      {(viewMode === 'kanban' || viewMode === 'list') && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索问题..."
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-9"
            />
          </div>
          <Select value={filters.category} onValueChange={(v) => setFilters(f => ({ ...f, category: v }))}>
            <SelectTrigger className="w-[120px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全分类</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.priority} onValueChange={(v) => setFilters(f => ({ ...f, priority: v }))}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全优先级</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Main Content */}
      {viewMode === 'kanban' && <KanbanView filters={filters} onSelectIssue={setSelectedIssueId} />}
      {viewMode === 'list' && <ListView filters={filters} onSelectIssue={setSelectedIssueId} />}
      {viewMode === 'knowledge' && <KnowledgeView />}
      {viewMode === 'stats' && <StatsView />}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateIssueDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} />
      )}

      {/* Detail Dialog */}
      {selectedIssueId && (
        <IssueDetailDialog issueId={selectedIssueId} onClose={() => setSelectedIssueId(null)} />
      )}
    </div>
  );
}

// ============ Kanban View ============
function KanbanView({ filters, onSelectIssue }: { filters: any; onSelectIssue: (id: number) => void }) {
  const columns: { status: string; label: string; icon: any; color: string }[] = [
    { status: 'pending', label: '待处理', icon: Clock, color: 'text-gray-500' },
    { status: 'in_progress', label: '处理中', icon: AlertCircle, color: 'text-blue-500' },
    { status: 'waiting_confirm', label: '待确认', icon: Clock, color: 'text-yellow-500' },
    { status: 'completed', label: '已完成', icon: CheckCircle2, color: 'text-green-500' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => (
        <KanbanColumn key={col.status} {...col} filters={filters} onSelectIssue={onSelectIssue} />
      ))}
    </div>
  );
}

const NEXT_STATUS_MAP: Record<string, { next: string; label: string }> = {
  pending: { next: 'in_progress', label: '处理中へ' },
  in_progress: { next: 'waiting_confirm', label: '待确认へ' },
  waiting_confirm: { next: 'completed', label: '已完成へ' },
};

function KanbanColumn({ status, label, icon: Icon, color, filters, onSelectIssue }: any) {
  const { data } = trpc.issueTracker.list.useQuery({
    status,
    category: filters.category,
    priority: filters.priority,
    search: filters.search || undefined,
    pageSize: 50,
  });
  const updateStatus = trpc.issueTracker.updateStatus.useMutation();
  const utils = trpc.useUtils();

  const issues = data?.issues || [];

  const handleAdvanceStatus = async (e: React.MouseEvent, issueId: number) => {
    e.stopPropagation();
    const nextInfo = NEXT_STATUS_MAP[status];
    if (!nextInfo) return;
    try {
      await updateStatus.mutateAsync({ id: issueId, status: nextInfo.next as any });
      utils.issueTracker.list.invalidate();
      toast.success(`ステータスを「${nextInfo.label.replace('へ', '')}」に変更しました`);
    } catch {
      toast.error('ステータス変更に失敗しました');
    }
  };

  return (
    <div className="bg-muted/30 rounded-lg p-3 min-h-[400px]">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="font-semibold text-sm">{label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">{issues.length}</Badge>
      </div>
      <div className="space-y-2">
        {issues.map((issue: any) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onClick={() => onSelectIssue(issue.id)}
            nextStatus={NEXT_STATUS_MAP[status]}
            onAdvance={(e: React.MouseEvent) => handleAdvanceStatus(e, issue.id)}
            isAdvancing={updateStatus.isPending}
          />
        ))}
        {issues.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">暂无问题</p>
        )}
      </div>
    </div>
  );
}

function IssueCard({ issue, onClick, nextStatus, onAdvance, isAdvancing }: { issue: any; onClick: () => void; nextStatus?: { next: string; label: string }; onAdvance?: (e: React.MouseEvent) => void; isAdvancing?: boolean }) {
  const PriorityIcon = PRIORITY_ICONS[issue.priority] || Minus;
  const isOverdue = issue.deadline && new Date(issue.deadline) < new Date() && !['completed', 'closed'].includes(issue.status);

  return (
    <div
      onClick={onClick}
      className={`bg-background rounded-md p-3 border-l-4 ${STATUS_COLORS[issue.status]} shadow-sm hover:shadow-md transition-shadow cursor-pointer ${isOverdue ? 'ring-1 ring-red-300' : ''}`}
    >
      <div className="flex items-start justify-between gap-1">
        <h4 className="text-sm font-medium line-clamp-2 flex-1">{issue.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          {issue.isPrivate ? <span className="text-[10px]">🔒</span> : null}
          <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[issue.priority]}`}>
            {PRIORITY_LABELS[issue.priority]}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[issue.category]}`}>
          {CATEGORY_LABELS[issue.category]}
        </Badge>
        {issue.assigneeName && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <User className="h-3 w-3" />{issue.assigneeName}
          </span>
        )}
        {isOverdue && (
          <span className="text-[10px] text-red-500 font-medium">超时!</span>
        )}
      </div>
      {nextStatus && onAdvance && (
        <button
          onClick={onAdvance}
          disabled={isAdvancing}
          className="mt-2 w-full py-1.5 text-[11px] font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <ChevronRight className="h-3 w-3" />
          {nextStatus.label}
        </button>
      )}
    </div>
  );
}

// ============ List View ============
function ListView({ filters, onSelectIssue }: { filters: any; onSelectIssue: (id: number) => void }) {
  const deleteMutation = trpc.issueTracker.delete.useMutation();
  const utils = trpc.useUtils();
  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('この問題を削除しますか？')) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success('削除しました');
      utils.issueTracker.list.invalidate();
    } catch {
      toast.error('削除に失敗しました');
    }
  };
  const { data, isLoading } = trpc.issueTracker.list.useQuery({
    status: filters.status !== 'all' ? filters.status : undefined,
    category: filters.category,
    priority: filters.priority,
    search: filters.search || undefined,
    pageSize: 100,
  });

  const issues = data?.issues || [];

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-medium">标题</th>
            <th className="text-left p-3 font-medium w-[80px]">分类</th>
            <th className="text-left p-3 font-medium w-[60px]">优先级</th>
            <th className="text-left p-3 font-medium w-[80px]">状态</th>
            <th className="text-left p-3 font-medium w-[100px]">负责人</th>
            <th className="text-left p-3 font-medium w-[100px]">创建时间</th>
            <th className="text-left p-3 font-medium w-[100px]">截止日期</th>
            <th className="text-left p-3 font-medium w-[60px]">操作</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue: any) => {
            const isOverdue = issue.deadline && new Date(issue.deadline) < new Date() && !['completed', 'closed'].includes(issue.status);
            return (
              <tr
                key={issue.id}
                onClick={() => onSelectIssue(issue.id)}
                className={`border-t hover:bg-muted/30 cursor-pointer transition-colors ${isOverdue ? 'bg-red-50' : ''}`}
              >
                <td className="p-3">
                  <span className="font-medium">{issue.isPrivate ? '🔒 ' : ''}{issue.title}</span>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[issue.category]}`}>
                    {CATEGORY_LABELS[issue.category]}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge className={`text-[10px] ${PRIORITY_COLORS[issue.priority]}`}>
                    {PRIORITY_LABELS[issue.priority]}
                  </Badge>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className="text-[10px]">
                    {STATUS_LABELS[issue.status]}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground">{issue.assigneeName || '-'}</td>
                <td className="p-3 text-muted-foreground text-xs">
                  {new Date(issue.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className={`p-3 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                  {issue.deadline ? new Date(issue.deadline).toLocaleDateString('ja-JP') : '-'}
                </td>
                <td className="p-3">
                  <button
                    onClick={(e) => handleDelete(e, issue.id)}
                    className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-500 transition-colors"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
          {issues.length === 0 && (
            <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">暂无问题</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ============ Knowledge View ============
function KnowledgeView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const { data } = trpc.issueTracker.listKnowledge.useQuery({ category: category as any, search: search || undefined });
  const deleteKnowledge = trpc.issueTracker.deleteKnowledge.useMutation();
  const utils = trpc.useUtils();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索知识库..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全分类</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data?.items || []).map((item: any) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${CATEGORY_COLORS[item.category]}`}>
                  {CATEGORY_LABELS[item.category]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {item.problem && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">问题:</p>
                  <p className="text-sm line-clamp-2">{item.problem}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-green-600">解决方案:</p>
                <p className="text-sm line-clamp-3 bg-green-50 p-2 rounded">{item.solution}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-muted-foreground">
                  使用 {item.useCount} 次 · {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                </span>
                <Button
                  variant="ghost" size="sm"
                  className="h-6 text-xs text-red-500 hover:text-red-700"
                  onClick={() => {
                    if (confirm('确定删除此知识条目？')) {
                      deleteKnowledge.mutateAsync({ id: item.id }).then(() => {
                        utils.issueTracker.listKnowledge.invalidate();
                        toast.success('已删除');
                      });
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(data?.items || []).length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>知识库为空</p>
            <p className="text-xs mt-1">完成问题后可将解决方案归档到知识库</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Stats View ============
function StatsView() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const { data } = trpc.issueTracker.getStats.useQuery({ period });

  if (!data) return <div className="text-center py-8 text-muted-foreground">加载中...</div>;

  const totalIssues = (data.statusDistribution || []).reduce((sum: number, s: any) => sum + Number(s.count), 0);
  const completedCount = (data.statusDistribution || []).find((s: any) => s.status === 'completed')?.count || 0;
  const activeCount = totalIssues - Number(completedCount) - Number((data.statusDistribution || []).find((s: any) => s.status === 'closed')?.count || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">统计分析</h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">本周</SelectItem>
            <SelectItem value="month">本月</SelectItem>
            <SelectItem value="quarter">季度</SelectItem>
            <SelectItem value="year">年度</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{totalIssues}</p>
            <p className="text-xs text-muted-foreground">总问题数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{activeCount}</p>
            <p className="text-xs text-muted-foreground">进行中</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-muted-foreground">已完成</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-500">{data.overdueCount}</p>
            <p className="text-xs text-muted-foreground">已超时</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{Math.round(Number(data.avgResolutionHours) || 0)}h</p>
            <p className="text-xs text-muted-foreground">平均解决时间</p>
          </CardContent>
        </Card>
      </div>

      {/* Category & Assignee Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">问题分类分布</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.categoryDistribution || []).map((item: any) => (
                <div key={item.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[item.category]}`}>
                      {CATEGORY_LABELS[item.category]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${totalIssues > 0 ? (Number(item.count) / totalIssues * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">成员工作量</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.assigneeStats || []).map((item: any) => (
                <div key={item.assigneeName} className="flex items-center justify-between">
                  <span className="text-sm">{item.assigneeName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-green-600">{item.completed}完成</span>
                    <span className="text-xs text-orange-500">{item.active}进行</span>
                    <span className="text-sm font-medium">{item.total}总</span>
                  </div>
                </div>
              ))}
              {(data.assigneeStats || []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">暂无数据</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ Create Issue Dialog ============
function CreateIssueDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'other', priority: 'medium',
    assigneeName: '', helperName: '', deadline: '', tags: '' as string,
    isPrivate: false,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{url: string; fileName: string; mimeType: string; fileSize: number}>>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const res = await fetch('/api/issue-file-upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setAttachments(prev => [...prev, ...data.files]);
      toast.success(`${data.files.length}个文件上传成功`);
    } catch (err) {
      toast.error('文件上传失败');
    }
    setUploading(false);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const createMutation = trpc.issueTracker.create.useMutation();
  const aiSuggest = trpc.issueTracker.aiSuggest.useMutation();
  const similarQuery = trpc.issueTracker.searchSimilar.useQuery(
    { title: form.title, description: form.description },
    { enabled: form.title.length > 3 }
  );
  const utils = trpc.useUtils();

  // Get staff list for assignee (active only, deduplicated)
  const staffQuery = trpc.staff.listActive.useQuery();
  const staffList = (() => {
    const raw = (staffQuery.data || []) as any[];
    const seen = new Set<string>();
    return raw.filter((s: any) => {
      if (!s.name || seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  })();

  const handleAiSuggest = async () => {
    if (!form.title) return;
    setAiLoading(true);
    try {
      const result = await aiSuggest.mutateAsync({ title: form.title, description: form.description });
      setForm(f => ({ ...f, category: result.category, priority: result.priority }));
      toast.success(`AI建议: ${CATEGORY_LABELS[result.category]} / ${PRIORITY_LABELS[result.priority]} - ${result.reason}`);
    } catch (e) {
      toast.error('AI分析失败');
    }
    setAiLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) { toast.error('请输入标题'); return; }
    try {
      // Find assigneeId and helperId from staffList by name
      const assignee = staffList.find((s: any) => s.name === form.assigneeName);
      const helper = staffList.find((s: any) => s.name === form.helperName);
      await createMutation.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        category: form.category as any,
        priority: form.priority as any,
        assigneeId: assignee?.id || undefined,
        assigneeName: form.assigneeName || undefined,
        helperId: helper?.id || undefined,
        helperName: (form.helperName && form.helperName !== '__none__') ? form.helperName : undefined,
        deadline: form.deadline || undefined,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        attachments: attachments.length > 0 ? attachments.map(a => a.url) : undefined,
        isPrivate: form.isPrivate,
      });
      toast.success('问题已创建');
      utils.issueTracker.list.invalidate();
      onClose();
    } catch (e) {
      toast.error('创建失败');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> 新建问题
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium">标题 *</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="简要描述问题..."
              />
              <Button variant="outline" size="sm" onClick={handleAiSuggest} disabled={aiLoading || !form.title}>
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">详细描述</label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="详细描述问题的背景、影响范围..."
              className="mt-1"
              rows={4}
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">分类</label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">优先级</label>
              <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignee & Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">负责人</label>
              <Select value={form.assigneeName} onValueChange={(v) => setForm(f => ({ ...f, assigneeName: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="选择负责人" /></SelectTrigger>
                <SelectContent>
                  {staffList.map((s: any) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">截止日期</label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Helper (CC) */}
          <div>
            <label className="text-sm font-medium">复制人 (CC) - 邮件同步</label>
            <Select value={form.helperName} onValueChange={(v) => setForm(f => ({ ...f, helperName: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="选择复制人（可选）" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">无</SelectItem>
                {staffList.map((s: any) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Tags */}
          <div>
            <label className="text-sm font-medium">标签 (逗号分隔)</label>
            <Input
              value={form.tags}
              onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="例: 直播, TikTok, 紧急修复"
              className="mt-1"
            />
          </div>

          {/* File Attachments */}
          <div>
            <label className="text-sm font-medium">附件 (图片/文档)</label>
            <div className="mt-1 flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-2 border rounded-md text-sm hover:bg-muted transition-colors">
                <Paperclip className="h-4 w-4" />
                {uploading ? '上传中...' : '选择文件'}
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span className="text-xs text-muted-foreground">支持图片、PDF、文档等</span>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                    {file.mimeType.startsWith('image/') ? (
                      <img src={file.url} alt={file.fileName} className="h-8 w-8 object-cover rounded" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{file.fileName}</span>
                    <span className="text-xs text-muted-foreground">{(file.fileSize / 1024).toFixed(0)}KB</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeAttachment(idx)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Privacy Option */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
            <input
              type="checkbox"
              id="isPrivate"
              checked={form.isPrivate}
              onChange={(e) => setForm(f => ({ ...f, isPrivate: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <label htmlFor="isPrivate" className="text-sm font-medium text-amber-800 cursor-pointer">
              🔒 仅创建人和负责人可见
            </label>
            <span className="text-xs text-amber-600 ml-auto">勾选后其他人无法查看此问题</span>
          </div>

          {/* Similar Issues Recommendation */}
          {(similarQuery.data?.issues?.length || 0) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs font-medium text-blue-700 mb-2">💡 类似已解决问题:</p>
              {similarQuery.data!.issues.slice(0, 3).map((issue: any) => (
                <div key={issue.id} className="text-xs text-blue-600 mb-1">
                  • {issue.title} → <span className="text-green-600">{issue.solution?.slice(0, 50)}...</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Issue Detail Dialog ============
function IssueDetailDialog({ issueId, onClose }: { issueId: number; onClose: () => void }) {
  const { data: issue, isLoading } = trpc.issueTracker.getById.useQuery({ id: issueId });
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [solution, setSolution] = useState('');

  const updateMutation = trpc.issueTracker.update.useMutation();
  const addCommentMutation = trpc.issueTracker.addComment.useMutation();
  const archiveMutation = trpc.issueTracker.archiveToKnowledge.useMutation();
  const utils = trpc.useUtils();

  const staffQuery = trpc.staff.listActive.useQuery();
  const staffList = (() => {
    const raw = (staffQuery.data || []) as any[];
    const seen = new Set<string>();
    return raw.filter((s: any) => {
      if (!s.name || seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
  })();

  if (isLoading || !issue) return null;

  const handleStatusChange = async (status: string) => {
    await updateMutation.mutateAsync({ id: issueId, status: status as any });
    utils.issueTracker.getById.invalidate({ id: issueId });
    utils.issueTracker.list.invalidate();
    toast.success('状态已更新');
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    await addCommentMutation.mutateAsync({ issueId, content: comment });
    setComment('');
    utils.issueTracker.getById.invalidate({ id: issueId });
    toast.success('评论已添加');
  };

  const handleSaveSolution = async () => {
    await updateMutation.mutateAsync({ id: issueId, solution });
    utils.issueTracker.getById.invalidate({ id: issueId });
    toast.success('解决方案已保存');
  };

  const handleArchive = async () => {
    if (!issue.solution) { toast.error('请先填写解决方案'); return; }
    await archiveMutation.mutateAsync({ issueId });
    toast.success('已归档到知识库');
    utils.issueTracker.listKnowledge.invalidate();
  };

  const handleUpdate = async () => {
    try {
      const payload = { ...editForm };
      // Convert empty deadline to null for DB compatibility
      if (payload.deadline === '') payload.deadline = null;
      // Convert __none__ helper to null
      if (payload.helperName === '__none__' || payload.helperName === '') payload.helperName = null;
      await updateMutation.mutateAsync({ id: issueId, ...payload });
      setEditing(false);
      utils.issueTracker.getById.invalidate({ id: issueId });
      utils.issueTracker.list.invalidate();
      toast.success('已更新');
    } catch (e: any) {
      toast.error('保存失败: ' + (e?.message || '未知错误'));
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg pr-4">{issue.title}</DialogTitle>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={`${PRIORITY_COLORS[issue.priority]}`}>{PRIORITY_LABELS[issue.priority]}</Badge>
              <Badge variant="outline" className={`${CATEGORY_COLORS[issue.category]}`}>{CATEGORY_LABELS[issue.category]}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">状态:</span>
            {['pending', 'in_progress', 'waiting_confirm', 'completed', 'closed'].map(s => (
              <Button
                key={s}
                variant={issue.status === s ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => handleStatusChange(s)}
              >
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-3 rounded-md">
            <div><span className="text-muted-foreground">创建人:</span> {issue.creatorName || '-'}</div>
            <div><span className="text-muted-foreground">负责人:</span> {issue.assigneeName || '-'}</div>
            <div><span className="text-muted-foreground">创建时间:</span> {new Date(issue.createdAt).toLocaleString('ja-JP')}</div>
            <div><span className="text-muted-foreground">截止日期:</span> {issue.deadline ? new Date(issue.deadline).toLocaleDateString('ja-JP') : '-'}</div>
            {issue.helperName && <div><span className="text-muted-foreground">协助人:</span> {issue.helperName}</div>}
            {issue.completedAt && <div><span className="text-muted-foreground">完成时间:</span> {new Date(issue.completedAt).toLocaleString('ja-JP')}</div>}
          </div>

          {/* Edit Button */}
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => { setEditing(true); setEditForm({ assigneeName: issue.assigneeName || '', helperName: issue.helperName || '', priority: issue.priority, category: issue.category, deadline: issue.deadline ? String(issue.deadline).split('T')[0] : '' }); }}>
              <Edit className="h-3 w-3 mr-1" /> 编辑
            </Button>
          )}

          {/* Edit Form */}
          {editing && (
            <div className="border rounded-md p-3 space-y-3 bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium">负责人</label>
                  <Select value={editForm.assigneeName || ''} onValueChange={(v) => setEditForm((f: any) => ({ ...f, assigneeName: v }))}>
                    <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="选择" /></SelectTrigger>
                    <SelectContent>
                      {staffList.map((s: any) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">优先级</label>
                  <Select value={editForm.priority || 'medium'} onValueChange={(v) => setEditForm((f: any) => ({ ...f, priority: v }))}>
                    <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">分类</label>
                  <Select value={editForm.category || 'other'} onValueChange={(v) => setEditForm((f: any) => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium">截止日期</label>
                  <Input type="date" value={editForm.deadline || ''} onChange={(e) => setEditForm((f: any) => ({ ...f, deadline: e.target.value }))} className="mt-1 h-8" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium">复制人 (CC)</label>
                  <Select value={editForm.helperName || ''} onValueChange={(v) => setEditForm((f: any) => ({ ...f, helperName: v }))}>
                    <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="选择复制人" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">无</SelectItem>
                      {staffList.map((s: any) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpdate}>保存</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>取消</Button>
              </div>
            </div>
          )}

                    {/* Description */}
          {issue.description && (
            <div>
              <h4 className="text-sm font-medium mb-1">问题描述</h4>
              <p className="text-sm bg-muted/30 p-3 rounded-md whitespace-pre-wrap">{issue.description}</p>
            </div>
          )}
          {/* Attachments */}
          {issue.attachments && (issue.attachments as string[]).length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-1">附件</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(issue.attachments as string[]).map((url: string, idx: number) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
                  return isImage ? (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={url} alt={`附件${idx + 1}`} className="w-full h-24 object-cover rounded border hover:opacity-80 transition-opacity" />
                    </a>
                  ) : (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 border rounded hover:bg-muted transition-colors">
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs truncate">附件{idx + 1}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {/* Solution */}
          <div>
            <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
              解决方案
              {issue.solution && (
                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleArchive}>
                  <Archive className="h-3 w-3 mr-1" /> 归档到知识库
                </Button>
              )}
            </h4>
            {issue.solution ? (
              <p className="text-sm bg-green-50 border border-green-200 p-3 rounded-md whitespace-pre-wrap">{issue.solution}</p>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  placeholder="填写解决方案..."
                  rows={3}
                />
                <Button size="sm" onClick={handleSaveSolution} disabled={!solution.trim()}>保存方案</Button>
              </div>
            )}
          </div>

          {/* Comments / Timeline */}
          <div>
            <h4 className="text-sm font-medium mb-2">动态 ({issue.comments?.length || 0})</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {(issue.comments || []).map((c: any) => (
                <div key={c.id} className={`text-sm p-2 rounded-md ${c.type === 'comment' ? 'bg-muted/30' : 'bg-blue-50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs">{c.authorName}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString('ja-JP')}</span>
                  </div>
                  <p className="mt-0.5 text-xs">{c.content}</p>
                </div>
              ))}
            </div>
            {/* Add comment */}
            <div className="flex gap-2 mt-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="添加评论..."
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
              />
              <Button size="sm" onClick={handleAddComment} disabled={!comment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
