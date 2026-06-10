import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, RefreshCw, User, Clock, Zap, BookOpen, Target, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrainStatusPanelProps {
  liverId: number | null;
}

export default function BrainStatusPanel({ liverId }: BrainStatusPanelProps) {
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUpdatingMemory, setIsUpdatingMemory] = useState(false);

  const { data: brainStatus, isLoading: statusLoading, refetch: refetchStatus } = trpc.liverManagement.aiCoach.getBrainStatus.useQuery();
  const { data: liverMemory, isLoading: memoryLoading, refetch: refetchMemory } = trpc.liverManagement.aiCoach.getLiverMemory.useQuery(
    { liverId: liverId! },
    { enabled: !!liverId }
  );

  const regenerateMutation = trpc.liverManagement.aiCoach.regenerateMasterKnowledge.useMutation({
    onSuccess: () => {
      toast({ title: "✅ マスターブレイン再生成を開始しました" });
      setIsRegenerating(false);
      refetchStatus();
    },
    onError: (err) => {
      toast({ title: "❌ エラー", description: err.message, variant: "destructive" });
      setIsRegenerating(false);
    },
  });

  const triggerMemoryMutation = trpc.liverManagement.aiCoach.triggerMemoryUpdate.useMutation({
    onSuccess: () => {
      toast({ title: "✅ ライバーメモリを更新しました" });
      setIsUpdatingMemory(false);
      refetchMemory();
    },
    onError: (err) => {
      toast({ title: "❌ エラー", description: err.message, variant: "destructive" });
      setIsUpdatingMemory(false);
    },
  });

  const handleRegenerate = () => {
    setIsRegenerating(true);
    regenerateMutation.mutate();
  };

  const handleMemoryUpdate = () => {
    if (!liverId) return;
    setIsUpdatingMemory(true);
    triggerMemoryMutation.mutate({ liverId });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "未生成";
    return new Date(dateStr).toLocaleString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Brain className="h-8 w-8 animate-pulse text-purple-500" />
        <span className="ml-2 text-muted-foreground">ブレイン情報を読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master Brain Status */}
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-950/20 to-indigo-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-400" />
              マスターブレイン（全体知識）
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="border-purple-500/50 hover:bg-purple-500/20"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? '生成中...' : '再生成'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {brainStatus?.masterBrain ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="border-green-500/50 text-green-400">
                  <Zap className="h-3 w-3 mr-1" /> アクティブ
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  最終更新: {formatDate(brainStatus.masterBrain.lastGeneratedAt)}
                </span>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 max-h-60 overflow-y-auto">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {brainStatus.masterBrain.categories?.map((c: any) => `【${c.category}】\n${c.content?.slice(0, 200)}`).join("\n\n")?.slice(0, 1000)}
                  {(brainStatus.masterBrain.categories?.length || 0) > 2 ? '...' : ''}
                </p>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>バージョン: {brainStatus.masterBrain.version || 0}</span>
                <span>•</span>
                <span>カテゴリ: {brainStatus.masterBrain.categories?.length + ' カテゴリ'}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-400 mb-2" />
              <p className="text-sm text-muted-foreground">マスターブレインはまだ生成されていません</p>
              <p className="text-xs text-muted-foreground mt-1">「再生成」ボタンで初回生成できます</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liver Memory Status */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-orange-950/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-amber-400" />
              ライバーカルテ（個別メモリ）
              {liverId && <Badge variant="outline" className="text-xs">ID: {liverId}</Badge>}
            </CardTitle>
            {liverId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMemoryUpdate}
                disabled={isUpdatingMemory || !liverId}
                className="border-amber-500/50 hover:bg-amber-500/20"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isUpdatingMemory ? 'animate-spin' : ''}`} />
                {isUpdatingMemory ? '更新中...' : '手動更新'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!liverId ? (
            <div className="text-center py-6">
              <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">ライバーを選択するとカルテが表示されます</p>
            </div>
          ) : memoryLoading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="h-5 w-5 animate-spin text-amber-400" />
            </div>
          ) : liverMemory ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="border-green-500/50 text-green-400">
                  <Target className="h-3 w-3 mr-1" /> カルテあり
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  最終更新: {formatDate(liverMemory.updatedAt)}
                </span>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 max-h-60 overflow-y-auto">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {liverMemory.summary || 'メモリ内容なし'}
                </p>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>セッション数: {liverMemory.coachingCount || 0}</span>
                <span>•</span>
                <span>成長フェーズ: {liverMemory.growthPhase || "初期"}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-400 mb-2" />
              <p className="text-sm text-muted-foreground">このライバーのカルテはまだ作成されていません</p>
              <p className="text-xs text-muted-foreground mt-1">コーチングセッション後に自動生成されます</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brain Stats Overview */}
      {brainStatus && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ブレイン統計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-400">{brainStatus.liverMemories?.count || 0}</p>
                <p className="text-xs text-muted-foreground">カルテ数</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-400">{brainStatus.logs?.totalCount || 0}</p>
                <p className="text-xs text-muted-foreground">総セッション</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{brainStatus.masterBrain?.version ? '✓' : '✗'}</p>
                <p className="text-xs text-muted-foreground">マスター状態</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
