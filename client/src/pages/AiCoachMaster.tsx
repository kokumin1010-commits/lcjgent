import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Bot, User, ArrowLeft, Clock, TrendingUp, ChevronDown, ChevronUp, BarChart3, Activity, Zap, Target } from "lucide-react";

export default function AiCoachMaster() {
  const [selectedLiverId, setSelectedLiverId] = useState<number | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("timeline");

  const { data: usageStats, isLoading } = trpc.liverManagement.aiCoach.getAllLiverUsageStats.useQuery();
  const { data: conversations } = trpc.liverManagement.aiCoach.getLiverConversations.useQuery(
    { liverId: selectedLiverId!, limit: 200 },
    { enabled: !!selectedLiverId }
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // メッセージをタイプ別にフィルタリング
  const filteredMessages = useMemo(() => {
    if (!conversations?.messages) return [];
    return conversations.messages;
  }, [conversations]);

  // 配信記録メッセージのみ抽出（グラフ用）
  const streamRecords = useMemo(() => {
    return filteredMessages
      .filter(msg => msg.messageType === 'stream_record' || msg.messageType === 'auto_question')
      .filter(msg => msg.metadata && (msg.metadata as any).salesAmount)
      .map(msg => {
        const meta = msg.metadata as any;
        return {
          date: msg.createdAt,
          salesAmount: meta.salesAmount || 0,
          duration: meta.duration || 0,
          hourlyRate: meta.hourlyRate || 0,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredMessages]);

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
      case 'chat':
        return <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30 text-[10px]">💬 チャット</Badge>;
      default:
        return null;
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
  if (selectedLiverId && conversations) {
    const liverName = usageStats?.find(s => s.liverId === selectedLiverId)?.liverName || `Liver #${selectedLiverId}`;
    
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => { setSelectedLiverId(null); setExpandedRoomId(null); setActiveTab("timeline"); }}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>

        <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-amber-500" />
          {liverName} の成長記録
        </h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="timeline">📋 タイムライン</TabsTrigger>
            <TabsTrigger value="graph">📈 グラフ</TabsTrigger>
            <TabsTrigger value="rooms">💬 トークルーム</TabsTrigger>
          </TabsList>

          {/* タイムライン表示 */}
          <TabsContent value="timeline">
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
                <p className="text-center text-muted-foreground text-sm py-8">まだ記録がありません</p>
              )}
            </div>
          </TabsContent>

          {/* グラフ表示 */}
          <TabsContent value="graph">
            {streamRecords.length > 0 ? (
              <div className="space-y-6">
                {/* 売上推移 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-green-500" />
                      売上推移
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48 flex items-end gap-1 overflow-x-auto pb-6 relative">
                      {streamRecords.slice(-20).map((record, i) => {
                        const maxSales = Math.max(...streamRecords.slice(-20).map(r => r.salesAmount));
                        const height = maxSales > 0 ? (record.salesAmount / maxSales) * 100 : 0;
                        const d = new Date(record.date);
                        return (
                          <div key={i} className="flex flex-col items-center min-w-[32px] flex-1">
                            <span className="text-[9px] text-muted-foreground mb-1">
                              ¥{(record.salesAmount / 1000).toFixed(0)}k
                            </span>
                            <div
                              className="w-full bg-gradient-to-t from-green-500 to-green-300 rounded-t-sm transition-all"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                            <span className="text-[8px] text-muted-foreground mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">
                              {d.getMonth() + 1}/{d.getDate()}
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
                      {streamRecords.slice(-20).map((record, i) => {
                        const maxRate = Math.max(...streamRecords.slice(-20).map(r => r.hourlyRate));
                        const height = maxRate > 0 ? (record.hourlyRate / maxRate) * 100 : 0;
                        const d = new Date(record.date);
                        return (
                          <div key={i} className="flex flex-col items-center min-w-[32px] flex-1">
                            <span className="text-[9px] text-muted-foreground mb-1">
                              ¥{(record.hourlyRate / 1000).toFixed(0)}k
                            </span>
                            <div
                              className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-sm transition-all"
                              style={{ height: `${Math.max(height, 4)}%` }}
                            />
                            <span className="text-[8px] text-muted-foreground mt-1 rotate-[-45deg] origin-top-left whitespace-nowrap">
                              {d.getMonth() + 1}/{d.getDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* KPIサマリー */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-green-500">
                        ¥{(streamRecords.reduce((sum, r) => sum + r.salesAmount, 0) / 1000).toFixed(0)}k
                      </p>
                      <p className="text-[10px] text-muted-foreground">累計売上</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-blue-500">
                        ¥{streamRecords.length > 0 ? (streamRecords.reduce((sum, r) => sum + r.hourlyRate, 0) / streamRecords.length / 1000).toFixed(0) : 0}k/h
                      </p>
                      <p className="text-[10px] text-muted-foreground">平均時間単価</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-purple-500">
                        {streamRecords.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground">配信回数</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-bold text-amber-500">
                        {(streamRecords.reduce((sum, r) => sum + r.duration, 0) / 60).toFixed(1)}h
                      </p>
                      <p className="text-[10px] text-muted-foreground">累計配信時間</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>まだ配信記録がありません</p>
                <p className="text-xs mt-1">配信記録が登録されるとグラフが表示されます</p>
              </div>
            )}
          </TabsContent>

          {/* トークルーム */}
          <TabsContent value="rooms">
            {conversations.rooms.length > 0 ? (
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
      <p className="text-sm text-muted-foreground mb-6">各ライバーの配信記録・AI提案・成長推移を一元管理</p>

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
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        活発
                      </Badge>
                    ) : stat.userMessages > 0 ? (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                        利用中
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">
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
