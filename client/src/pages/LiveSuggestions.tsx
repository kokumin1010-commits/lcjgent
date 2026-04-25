import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Send, History, Calendar, Clock, User, RefreshCw, CheckCircle, XCircle, Loader2, MessageSquare, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function LiveSuggestions() {
  const [activeTab, setActiveTab] = useState("generate");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedGroupName, setSelectedGroupName] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState<Array<{
    liverName: string;
    suggestion: string;
    expanded: boolean;
  }>>([]);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editableSuggestions, setEditableSuggestions] = useState<string>("");
  const [historyDate, setHistoryDate] = useState<string>("");

  // Fetch today's schedules
  const { data: todayData, isLoading: loadingSchedules, refetch: refetchSchedules } = trpc.liveSuggestion.getTodaySchedules.useQuery();

  // Fetch LINE groups
  const { data: lineGroups, isLoading: loadingGroups } = trpc.liveSuggestion.getLineGroups.useQuery();

  // Fetch suggestion history
  const { data: historyData, isLoading: loadingHistory, refetch: refetchHistory } = trpc.liveSuggestion.getHistory.useQuery({
    limit: 50,
    offset: 0,
    date: historyDate || undefined,
  });

  // Generate and send mutation
  const generateAndSendMutation = trpc.liveSuggestion.generateAndSendAll.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        refetchHistory();
      } else {
        toast.error(data.message);
      }
      setIsSending(false);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
      setIsSending(false);
    },
  });

  // Generate single suggestion mutation
  const generateSingleMutation = trpc.liveSuggestion.generateSuggestion.useMutation({
    onSuccess: (data) => {
      setGeneratedSuggestions(prev => {
        const existing = prev.findIndex(s => s.liverName === data.liverName);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { liverName: data.liverName, suggestion: data.suggestionText, expanded: true };
          return updated;
        }
        return [...prev, { liverName: data.liverName, suggestion: data.suggestionText, expanded: true }];
      });
    },
    onError: (error) => {
      toast.error(`提案生成エラー: ${error.message}`);
    },
  });

  // Set default group to "LCJ所属ライバー連絡網" if available
  useEffect(() => {
    if (lineGroups && lineGroups.length > 0 && !selectedGroupId) {
      const lcjGroup = lineGroups.find(g => g.groupName?.includes("ライバー連絡網") || g.groupName?.includes("LCJ"));
      if (lcjGroup) {
        setSelectedGroupId(lcjGroup.lineGroupId);
        setSelectedGroupName(lcjGroup.groupName || "");
      } else {
        setSelectedGroupId(lineGroups[0].lineGroupId);
        setSelectedGroupName(lineGroups[0].groupName || "");
      }
    }
  }, [lineGroups, selectedGroupId]);

  const handleGenerateAll = () => {
    if (!todayData?.liverNames?.length) {
      toast.error("今日の配信予定がありません");
      return;
    }

    // Generate suggestions for each liver
    setGeneratedSuggestions([]);
    for (const liverName of todayData.liverNames) {
      const schedule = todayData.schedules.find(s => s.liverName === liverName || s.title === liverName);
      generateSingleMutation.mutate({
        liverName,
        scheduleId: schedule?.id,
        scheduledStartTime: schedule?.startTime ? new Date(schedule.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : undefined,
        scheduledEndTime: schedule?.endTime ? new Date(schedule.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : undefined,
      });
    }
  };

  const handleSendToLine = () => {
    if (!selectedGroupId) {
      toast.error("送信先LINEグループを選択してください");
      return;
    }
    setPreviewDialogOpen(true);
    // Build preview message
    const now = new Date();
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split('T')[0];
    
    let preview = `📢 【${todayStr} 配信提案】\n\n今日配信予定の${generatedSuggestions.length}名のライバーへの提案です：\n`;
    for (const s of generatedSuggestions) {
      preview += `\n━━━━━━━━━━━━━━━\n👤 ${s.liverName}\n━━━━━━━━━━━━━━━\n${s.suggestion}`;
    }
    setEditableSuggestions(preview);
  };

  const handleConfirmSend = () => {
    setIsSending(true);
    setPreviewDialogOpen(false);
    generateAndSendMutation.mutate({
      lineGroupId: selectedGroupId,
      lineGroupName: selectedGroupName,
    });
  };

  const toggleSuggestionExpand = (index: number) => {
    setGeneratedSuggestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], expanded: !updated[index].expanded };
      return updated;
    });
  };

  // Group history by date
  const historyByDate = (historyData || []).reduce((acc, item) => {
    const dateKey = item.targetDate ? format(new Date(item.targetDate), 'yyyy-MM-dd') : 'unknown';
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, typeof historyData>);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-yellow-500" />
              AI配信提案
            </h1>
            <p className="text-muted-foreground mt-1">
              今日のスケジュールに基づいてAIが配信提案を生成し、LINEグループに送信します
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchSchedules()}
            disabled={loadingSchedules}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingSchedules ? 'animate-spin' : ''}`} />
            更新
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="generate" className="flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              提案生成
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1">
              <History className="h-4 w-4" />
              提案履歴
            </TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4 mt-4">
            {/* Today's Schedule Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  今日の配信予定
                </CardTitle>
                <CardDescription>
                  {todayData?.liverCount
                    ? `${todayData.liverCount}名のライバーが配信予定`
                    : '配信予定を読み込み中...'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSchedules ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : todayData?.schedules && todayData.schedules.length > 0 ? (
                  <div className="space-y-2">
                    {todayData.schedules.map((schedule, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                          <User className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {schedule.liverName || schedule.title}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {schedule.startTime
                              ? new Date(schedule.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
                              : '時間未定'}
                            {schedule.endTime && (
                              <> 〜 {new Date(schedule.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}</>
                            )}
                          </div>
                        </div>
                        <Badge variant={schedule.category === 'live' ? 'default' : 'secondary'}>
                          {schedule.category === 'live' ? 'ライブ' : schedule.category || 'その他'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>今日の配信予定はありません</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generate Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  AI提案生成
                </CardTitle>
                <CardDescription>
                  各ライバーの過去データを分析し、今日の配信提案を自動生成します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* LINE Group Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">送信先LINEグループ</label>
                  <Select
                    value={selectedGroupId}
                    onValueChange={(value) => {
                      setSelectedGroupId(value);
                      const group = lineGroups?.find(g => g.lineGroupId === value);
                      setSelectedGroupName(group?.groupName || "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="LINEグループを選択..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lineGroups?.map((group) => (
                        <SelectItem key={group.lineGroupId} value={group.lineGroupId}>
                          {group.groupName || group.lineGroupId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleGenerateAll}
                    disabled={!todayData?.liverNames?.length || generateSingleMutation.isPending}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                  >
                    {generateSingleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    全員の提案を生成
                  </Button>

                  {generatedSuggestions.length > 0 && (
                    <Button
                      onClick={handleSendToLine}
                      disabled={isSending || !selectedGroupId}
                      variant="default"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      LINEに送信
                    </Button>
                  )}
                </div>

                {/* Generated Suggestions */}
                {generatedSuggestions.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <h3 className="font-medium text-sm text-muted-foreground">
                      生成された提案 ({generatedSuggestions.length}件)
                    </h3>
                    {generatedSuggestions.map((s, i) => (
                      <Card key={i} className="border-l-4 border-l-yellow-500">
                        <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSuggestionExpand(i)}>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {s.liverName}
                            </CardTitle>
                            {s.expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CardHeader>
                        {s.expanded && (
                          <CardContent>
                            <div className="whitespace-pre-wrap text-sm bg-muted/50 p-3 rounded-lg">
                              {s.suggestion}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="h-5 w-5 text-blue-500" />
                      提案履歴
                    </CardTitle>
                    <CardDescription>
                      過去に生成・送信した配信提案の履歴
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={historyDate}
                      onChange={(e) => setHistoryDate(e.target.value)}
                      className="px-3 py-1.5 text-sm border rounded-md bg-background"
                    />
                    {historyDate && (
                      <Button variant="ghost" size="sm" onClick={() => setHistoryDate("")}>
                        クリア
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => refetchHistory()}>
                      <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : historyData && historyData.length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(historyByDate).map(([dateKey, items]) => (
                      <div key={dateKey}>
                        <h3 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {dateKey !== 'unknown' ? format(new Date(dateKey), 'yyyy年M月d日(E)', { locale: ja }) : '日付不明'}
                          <Badge variant="secondary" className="ml-1">{items!.length}件</Badge>
                        </h3>
                        <div className="space-y-2">
                          {items!.map((item, i) => (
                            <div key={item.id || i} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
                                <User className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{item.liverName}</span>
                                  {item.scheduledStartTime && (
                                    <Badge variant="outline" className="text-xs">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {new Date(item.scheduledStartTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
                                    </Badge>
                                  )}
                                  {item.lineSendSuccess ? (
                                    <Badge variant="default" className="bg-green-500 text-xs">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      送信済
                                    </Badge>
                                  ) : item.sentToLineGroupId ? (
                                    <Badge variant="destructive" className="text-xs">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      送信失敗
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      生成のみ
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                  {item.suggestionText}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                  {item.sentToLineGroupName && (
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
                                      {item.sentToLineGroupName}
                                    </span>
                                  )}
                                  {item.generatedBy && (
                                    <span>by {item.generatedBy}</span>
                                  )}
                                  {item.createdAt && (
                                    <span>{format(new Date(item.createdAt), 'HH:mm')}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>提案履歴はまだありません</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Preview/Send Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                送信プレビュー
              </DialogTitle>
              <DialogDescription>
                以下の内容を「{selectedGroupName}」に送信します。内容を確認・編集できます。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                value={editableSuggestions}
                onChange={(e) => setEditableSuggestions(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground">
                文字数: {editableSuggestions.length} / 5000
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmSend}
                disabled={isSending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                LINEに送信
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
