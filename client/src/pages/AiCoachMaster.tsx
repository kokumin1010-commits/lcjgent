import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Bot, User, ArrowLeft, Clock, TrendingUp, ChevronDown, ChevronUp, BarChart3, Activity, Package, DollarSign, Timer, Store, Filter } from "lucide-react";

export default function AiCoachMaster() {
  const [selectedLiverId, setSelectedLiverId] = useState<number | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("records");
  const [expandedStreamId, setExpandedStreamId] = useState<number | null>(null);
  const [messageTypeFilter, setMessageTypeFilter] = useState<string>("all");

  const { data: usageStats, isLoading } = trpc.liverManagement.aiCoach.getAllLiverUsageStats.useQuery();
  const { data: conversations } = trpc.liverManagement.aiCoach.getLiverConversations.useQuery(
    { liverId: selectedLiverId!, limit: 200 },
    { enabled: !!selectedLiverId }
  );
  const { data: growthData } = trpc.liverManagement.aiCoach.getLiverGrowthData.useQuery(
    { liverId: selectedLiverId!, limit: 50 },
    { enabled: !!selectedLiverId }
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatDateShort = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;
  };

  const formatYen = (amount: number | null) => {
    if (!amount) return "¥0";
    if (amount >= 10000) return `¥${(amount / 10000).toFixed(1)}万`;
    return `¥${amount.toLocaleString()}`;
  };

  // メッセージをタイプ別にフィルタリング
  const filteredMessages = useMemo(() => {
    if (!conversations?.messages) return [];
    if (messageTypeFilter === "all") return conversations.messages;
    if (messageTypeFilter === "user_replies") {
      return conversations.messages.filter(msg => msg.role === 'user');
    }
    if (messageTypeFilter === "auto_sent") {
      return conversations.messages.filter(msg => 
        msg.role === 'assistant' && ['pre_briefing', 'pre_reminder', 'weekly_report', 'skill_analysis', 'monthly_report', 'schedule_reminder', 'stream_record', 'stream_suggestion', 'auto_question'].includes(msg.messageType || '')
      );
    }
    return conversations.messages.filter(msg => msg.messageType === messageTypeFilter);
  }, [conversations, messageTypeFilter]);

  // 配信記録のKPIサマリー
  const kpiSummary = useMemo(() => {
    if (!growthData || growthData.length === 0) return null;
    const totalSales = growthData.reduce((sum, r) => sum + (r.effectiveSales || 0), 0);
    const totalDuration = growthData.reduce((sum, r) => sum + (r.duration || 0), 0);
    const avgHourlyRate = growthData.filter(r => r.hourlyRate > 0).length > 0
      ? Math.round(growthData.filter(r => r.hourlyRate > 0).reduce((sum, r) => sum + r.hourlyRate, 0) / growthData.filter(r => r.hourlyRate > 0).length)
      : 0;
    const totalSets = growthData.reduce((sum, r) => sum + (r.sets?.length || 0), 0);
    return { totalSales, totalDuration, avgHourlyRate, totalSets, streamCount: growthData.length };
  }, [growthData]);

  // メッセージタイプに応じたバッジ
  const getMessageTypeBadge = (messageType: string | null) => {
    switch (messageType) {
      case 'stream_record':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px]">📊 配信記録</Badge>;
      case 'stream_suggestion':
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">📢 配信提案</Badge>;
      case 'auto_question':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">🤖 AIコーチ</Badge>;
      case 'advice':
        return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30 text-[10px]">💡 アドバイス</Badge>;
      case 'pre_briefing':
        return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[10px]">🌅 配信前ブリーフィング</Badge>;
      case 'pre_reminder':
        return <Badge className="bg-rose-500/20 text-rose-600 border-rose-500/30 text-[10px]">⏰ 配信前リマインダー</Badge>;
      case 'weekly_report':
        return <Badge className="bg-indigo-500/20 text-indigo-600 border-indigo-500/30 text-[10px]">📊 週次レポート</Badge>;
      case 'skill_analysis':
        return <Badge className="bg-teal-500/20 text-teal-600 border-teal-500/30 text-[10px]">🎯 スキル分析</Badge>;
      case 'monthly_report':
        return <Badge className="bg-cyan-500/20 text-cyan-600 border-cyan-500/30 text-[10px]">📅 月次レポート</Badge>;
      case 'schedule_reminder':
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px]">📋 スケジュールリマインダー</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30 text-[10px]">💬 チャット</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Activity className="h-6 w-6 text-amber-500" />
          ライバー成長ダッシュボード
        </h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // 個別ライバーの詳細表示
  if (selectedLiverId) {
    const liverName = usageStats?.find(s => s.liverId === selectedLiverId)?.liverName || `Liver #${selectedLiverId}`;
    
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => { setSelectedLiverId(null); setExpandedRoomId(null); setActiveTab("records"); setExpandedStreamId(null); }}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>

        <h1 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Activity className="h-5 w-5 text-amber-500" />
          {liverName} の成長記録
        </h1>

        {/* KPIサマリー */}
        {kpiSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-green-600">{formatYen(kpiSummary.totalSales)}</p>
              <p className="text-[10px] text-muted-foreground">累計売上</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-blue-600">{formatYen(kpiSummary.avgHourlyRate)}/h</p>
              <p className="text-[10px] text-muted-foreground">平均時間単価</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-amber-600">{kpiSummary.streamCount}回</p>
              <p className="text-[10px] text-muted-foreground">配信回数</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-purple-600">{formatDuration(kpiSummary.totalDuration)}</p>
              <p className="text-[10px] text-muted-foreground">累計配信時間</p>
            </CardContent></Card>
            <Card><CardContent className="p-2 text-center">
              <p className="text-base font-bold text-rose-600">{kpiSummary.totalSets}セット</p>
              <p className="text-[10px] text-muted-foreground">セット数</p>
            </CardContent></Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="records">📊 配信記録</TabsTrigger>
            <TabsTrigger value="graph">📈 グラフ</TabsTrigger>
            <TabsTrigger value="timeline">💬 AI履歴</TabsTrigger>
            <TabsTrigger value="rooms">🗂 ルーム</TabsTrigger>
          </TabsList>

          {/* 配信記録タブ（LINEメッセージと同じフォーマット） */}
          <TabsContent value="records">
            <div className="space-y-3">
              {growthData && growthData.length > 0 ? (
                growthData.map((stream) => (
                  <Card key={stream.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* ヘッダー（日付・ブランド） */}
                      <div 
                        className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedStreamId(expandedStreamId === stream.id ? null : stream.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
                              📺
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">
                                  {formatDateShort(stream.livestreamDate)} {stream.livestreamStartTime || ''}
                                </span>
                                {stream.brandName && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Store className="h-2.5 w-2.5 mr-0.5" />
                                    {stream.brandName}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-0.5">
                                  <DollarSign className="h-3 w-3 text-green-500" />
                                  {formatYen(stream.effectiveSales)}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Timer className="h-3 w-3 text-blue-500" />
                                  {formatDuration(stream.duration)}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <TrendingUp className="h-3 w-3 text-amber-500" />
                                  {formatYen(stream.hourlyRate)}/h
                                </span>
                                {stream.sets && stream.sets.length > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Package className="h-3 w-3 text-purple-500" />
                                    {stream.sets.length}セット
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {expandedStreamId === stream.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </div>

                      {/* 展開時の詳細（LINEメッセージ風） */}
                      {expandedStreamId === stream.id && (
                        <div className="border-t bg-slate-50 dark:bg-slate-900/50 p-4">
                          {/* 配信記録登録（LINEメッセージ風） */}
                          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border max-w-md">
                            <p className="font-bold text-sm mb-2 border-b pb-2">📊 配信記録登録</p>
                            <div className="space-y-1 text-sm">
                              <p>👤 {stream.streamerName || liverName}</p>
                              <p>📅 {formatDateShort(stream.livestreamDate)} {stream.livestreamStartTime || ''}〜</p>
                              <p>⏱ 配信時間: {formatDuration(stream.duration)}</p>
                              <p>💰 売上: {formatYen(stream.effectiveSales)}</p>
                              <p>📈 時間単価: {formatYen(stream.hourlyRate)}/h</p>
                              {stream.viewerCount && <p>👁 視聴者数: {stream.viewerCount.toLocaleString()}</p>}
                              {stream.orderCount && <p>🛒 注文数: {stream.orderCount}</p>}
                            </div>

                            {/* ブランド別実績 */}
                            {stream.brandName && (
                              <div className="mt-3 pt-2 border-t">
                                <p className="text-sm font-medium mb-1">🏷 ブランド別実績:</p>
                                <p className="text-sm ml-2">🚀 {stream.brandName}: {formatDuration(stream.duration)}</p>
                              </div>
                            )}

                            {/* セット内訳 */}
                            {stream.sets && stream.sets.length > 0 && (
                              <div className="mt-3 pt-2 border-t">
                                <p className="text-sm font-medium mb-2">📦 セット内訳:</p>
                                {stream.sets.map((set, idx) => (
                                  <div key={set.id || idx} className="ml-2 mb-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                                    <p className="font-medium text-sm">【{set.setName}】</p>
                                    {set.totalOriginalPrice && set.setPrice && (
                                      <p className="text-xs text-muted-foreground">
                                        定価¥{Number(set.totalOriginalPrice).toLocaleString()} → ¥{Number(set.setPrice).toLocaleString()}
                                        {set.discountRate ? ` (${set.discountRate}%OFF)` : ''}
                                      </p>
                                    )}
                                    {set.items && set.items.length > 0 && (
                                      <div className="mt-1 space-y-0.5">
                                        {set.items.map((item, iIdx) => (
                                          <p key={item.id || iIdx} className="text-xs text-muted-foreground">
                                            ■ {item.productName} {item.quantity > 1 ? `×${item.quantity}` : ''}
                                          </p>
                                        ))}
                                        <p className="text-xs font-medium mt-1">
                                          合計 {set.items.reduce((sum, i) => sum + (i.quantity || 1), 0)}点
                                        </p>
                                      </div>
                                    )}
                                    {set.quantitySold > 0 && (
                                      <p className="text-xs font-medium text-green-600 mt-1">
                                        販売数 {set.quantitySold}セット / 売上 {formatYen(Number(set.totalRevenue))}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* AIアドバイス */}
                            {stream.aiAdvice && (
                              <div className="mt-3 pt-2 border-t">
                                <p className="text-sm font-medium mb-1">🤖 AIアドバイス:</p>
                                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{stream.aiAdvice}</p>
                              </div>
                            )}

                            {/* 備考 */}
                            {stream.remarks && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs text-muted-foreground">📝 {stream.remarks}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>まだ配信記録がありません</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* グラフ表示 */}
          <TabsContent value="graph">
            {growthData && growthData.length > 0 ? (
              <div className="space-y-6">
                {/* 売上推移 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-green-500" />
                      売上推移（直近{Math.min(growthData.length, 30)}回）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end gap-1 overflow-x-auto pb-6 relative">
                      {[...growthData].reverse().slice(-30).map((record, i) => {
                        const records = [...growthData].reverse().slice(-30);
                        const maxSales = Math.max(...records.map(r => r.effectiveSales || 0));
                        const height = maxSales > 0 ? ((record.effectiveSales || 0) / maxSales) * 100 : 0;
                        return (
                          <div key={i} className="flex flex-col items-center min-w-[28px] flex-1">
                            <span className="text-[8px] text-muted-foreground mb-1 whitespace-nowrap">
                              {formatYen(record.effectiveSales)}
                            </span>
                            <div
                              className="w-full bg-gradient-to-t from-green-600 to-green-300 rounded-t-sm transition-all"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                            <span className="text-[8px] text-muted-foreground mt-1 whitespace-nowrap">
                              {formatDateShort(record.livestreamDate)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* 時間単価推移 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      時間単価推移
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end gap-1 overflow-x-auto pb-6 relative">
                      {[...growthData].reverse().slice(-30).map((record, i) => {
                        const records = [...growthData].reverse().slice(-30);
                        const maxRate = Math.max(...records.map(r => r.hourlyRate || 0));
                        const height = maxRate > 0 ? ((record.hourlyRate || 0) / maxRate) * 100 : 0;
                        return (
                          <div key={i} className="flex flex-col items-center min-w-[28px] flex-1">
                            <span className="text-[8px] text-muted-foreground mb-1 whitespace-nowrap">
                              {formatYen(record.hourlyRate)}
                            </span>
                            <div
                              className="w-full bg-gradient-to-t from-blue-600 to-blue-300 rounded-t-sm transition-all"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                            <span className="text-[8px] text-muted-foreground mt-1 whitespace-nowrap">
                              {formatDateShort(record.livestreamDate)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* ブランド別売上 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Store className="h-4 w-4 text-purple-500" />
                      ブランド別売上
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const brandMap = new Map<string, number>();
                      growthData.forEach(r => {
                        const name = r.brandName || '不明';
                        brandMap.set(name, (brandMap.get(name) || 0) + (r.effectiveSales || 0));
                      });
                      const sorted = [...brandMap.entries()].sort((a, b) => b[1] - a[1]);
                      const maxBrand = sorted[0]?.[1] || 1;
                      return (
                        <div className="space-y-2">
                          {sorted.map(([name, sales]) => (
                            <div key={name} className="flex items-center gap-2">
                              <span className="text-xs w-24 truncate">{name}</span>
                              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-pink-400 rounded-full transition-all"
                                  style={{ width: `${(sales / maxBrand) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-16 text-right">{formatYen(sales)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>まだ配信記録がありません</p>
              </div>
            )}
          </TabsContent>

          {/* AI履歴タイムライン */}
          <TabsContent value="timeline">
            {/* カテゴリフィルタ */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={messageTypeFilter} onValueChange={setMessageTypeFilter}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="カテゴリで絞り込み" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📋 すべて表示</SelectItem>
                  <SelectItem value="user_replies">👤 ライバー返信のみ</SelectItem>
                  <SelectItem value="auto_sent">🤖 自動送信のみ</SelectItem>
                  <SelectItem value="stream_record">📊 配信記録</SelectItem>
                  <SelectItem value="stream_suggestion">📢 配信提案</SelectItem>
                  <SelectItem value="auto_question">🤖 AIコーチ質問</SelectItem>
                  <SelectItem value="advice">💡 アドバイス</SelectItem>
                  <SelectItem value="pre_briefing">🌅 配信前ブリーフィング</SelectItem>
                  <SelectItem value="pre_reminder">⏰ 配信前リマインダー</SelectItem>
                  <SelectItem value="weekly_report">📊 週次レポート</SelectItem>
                  <SelectItem value="skill_analysis">🎯 スキル分析</SelectItem>
                  <SelectItem value="monthly_report">📅 月次レポート</SelectItem>
                  <SelectItem value="schedule_reminder">📋 スケジュールリマインダー</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {filteredMessages.length}件表示
              </span>
            </div>

            <div className="space-y-3">
              {filteredMessages.length > 0 ? (
                filteredMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[90%] rounded-xl p-3 shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : msg.messageType === 'stream_record'
                          ? 'bg-green-50 border border-green-200'
                          : msg.messageType === 'stream_suggestion'
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-muted'
                    }`}>
                      <div className="flex items-center gap-1 mb-1 flex-wrap">
                        {msg.role === 'user' ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Bot className="h-3 w-3 text-amber-500" />
                        )}
                        <span className="text-[10px] opacity-70">
                          {msg.role === 'user' ? liverName : 'LCJ AGENT'}
                        </span>
                        {getMessageTypeBadge(msg.messageType)}
                        <span className="text-[10px] opacity-50 ml-auto">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground text-sm py-8">まだAI履歴がありません</p>
              )}
            </div>
          </TabsContent>

          {/* トークルーム */}
          <TabsContent value="rooms">
            {conversations && conversations.rooms.length > 0 ? (
              <div className="space-y-2">
                {conversations.rooms.map(room => (
                  <Card
                    key={room.id}
                    className={`cursor-pointer transition-all ${expandedRoomId === room.id ? 'ring-2 ring-amber-500' : 'hover:bg-muted/50'}`}
                    onClick={() => setExpandedRoomId(expandedRoomId === room.id ? null : room.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{room.title || "無題のトーク"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatDate(room.lastMessageAt)}</span>
                          {expandedRoomId === room.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                      {expandedRoomId === room.id && (
                        <div className="mt-3 space-y-2 border-t pt-3">
                          {filteredMessages
                            .filter(msg => msg.roomId === room.id)
                            .slice(0, 20)
                            .map(msg => (
                              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-2 text-xs ${
                                  msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'
                                }`}>
                                  <p className="whitespace-pre-wrap">{msg.content}</p>
                                  <span className="text-[9px] opacity-50 block mt-1">{formatDate(msg.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-8">トークルームがありません</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // メイン一覧表示
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Activity className="h-6 w-6 text-amber-500" />
        ライバー成長ダッシュボード
      </h1>
      <p className="text-sm text-muted-foreground mb-6">各ライバーの配信記録・セット情報・AI提案・成長推移を一元管理</p>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{usageStats?.length || 0}</p>
            <p className="text-xs text-muted-foreground">利用ライバー数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">
              {usageStats?.reduce((sum, s) => sum + s.totalMessages, 0) || 0}
            </p>
            <p className="text-xs text-muted-foreground">総メッセージ数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">
              {usageStats?.reduce((sum, s) => sum + s.userMessages, 0) || 0}
            </p>
            <p className="text-xs text-muted-foreground">ライバー発言数</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-purple-500">
              {usageStats?.reduce((sum, s) => sum + s.roomCount, 0) || 0}
            </p>
            <p className="text-xs text-muted-foreground">総ルーム数</p>
          </CardContent>
        </Card>
      </div>

      {/* ライバー一覧 */}
      <div className="space-y-2">
        {usageStats && usageStats.length > 0 ? (
          usageStats.map(stat => (
            <Card
              key={stat.liverId}
              className="cursor-pointer hover:bg-muted/50 transition-all"
              onClick={() => setSelectedLiverId(stat.liverId)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                      {stat.liverName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{stat.liverName}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {stat.totalMessages}件
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {stat.userMessages}発言
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(stat.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stat.userMessages > 5 ? (
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        活発
                      </Badge>
                    ) : stat.userMessages > 0 ? (
                      <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-xs">
                        利用中
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30 text-xs">
                        AI応答のみ
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>まだデータがありません</p>
          </div>
        )}
      </div>
    </div>
  );
}
