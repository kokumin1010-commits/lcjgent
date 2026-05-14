import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Bot, User, ArrowLeft, Clock, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

export default function AiCoachMaster() {
  const [selectedLiverId, setSelectedLiverId] = useState<number | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);

  const { data: usageStats, isLoading } = trpc.liverManagement.aiCoach.getAllLiverUsageStats.useQuery();
  const { data: conversations } = trpc.liverManagement.aiCoach.getLiverConversations.useQuery(
    { liverId: selectedLiverId!, limit: 100 },
    { enabled: !!selectedLiverId }
  );

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatDateFull = (date: string | Date | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Bot className="h-6 w-6 text-amber-500" />
          神コーチ トーク履歴
        </h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // 個別ライバーのトーク詳細表示
  if (selectedLiverId && conversations) {
    const liverName = usageStats?.find(s => s.liverId === selectedLiverId)?.liverName || `Liver #${selectedLiverId}`;
    
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => { setSelectedLiverId(null); setExpandedRoomId(null); }}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>

        <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-amber-500" />
          {liverName} のトーク履歴
        </h1>

        {/* Room一覧 */}
        {conversations.rooms.length > 0 && (
          <div className="mb-6 space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">トークルーム</h2>
            {conversations.rooms.map(room => (
              <Card
                key={room.id}
                className={`cursor-pointer transition-all ${expandedRoomId === room.id ? 'ring-2 ring-amber-500' : 'hover:bg-muted/50'}`}
                onClick={() => setExpandedRoomId(expandedRoomId === room.id ? null : room.id)}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{room.title || "無題のトーク"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(room.lastMessageAt)}</span>
                    {expandedRoomId === room.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* メッセージ一覧 */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {expandedRoomId ? "選択中のルームのメッセージ" : "全メッセージ（最新100件）"}
          </h2>
          {conversations.messages
            .filter(msg => !expandedRoomId || msg.roomId === expandedRoomId)
            .map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-xl p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted'
                }`}>
                  <div className="flex items-center gap-1 mb-1">
                    {msg.role === 'user' ? (
                      <User className="h-3 w-3" />
                    ) : (
                      <Bot className="h-3 w-3 text-amber-500" />
                    )}
                    <span className="text-[10px] opacity-70">
                      {msg.role === 'user' ? liverName : '神コーチ'}
                    </span>
                    <span className="text-[10px] opacity-50 ml-auto">
                      {formatDate(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
          {conversations.messages.filter(msg => !expandedRoomId || msg.roomId === expandedRoomId).length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">メッセージがありません</p>
          )}
        </div>
      </div>
    );
  }

  // メイン一覧表示
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
        <Bot className="h-6 w-6 text-amber-500" />
        神コーチ トーク履歴
      </h1>
      <p className="text-sm text-muted-foreground mb-6">ライバーごとの神コーチ活用状況を確認できます</p>

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
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>まだ神コーチを利用したライバーがいません</p>
          </div>
        )}
      </div>
    </div>
  );
}
