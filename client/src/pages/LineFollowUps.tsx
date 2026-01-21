import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Clock, User, Building2, RefreshCw, XCircle, CheckCircle, Calendar, MessageSquare, Bell } from "lucide-react";
import { format } from "date-fns";

export default function LineFollowUps() {
  const { language } = useLanguage();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [triggerCondition, setTriggerCondition] = useState<"no_reply" | "scheduled">("no_reply");
  const [delayHours, setDelayHours] = useState(72);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");

  // Fetch follow-ups
  const { data: followUps, isLoading, refetch } = trpc.line.listFollowUps.useQuery();
  
  // Fetch LINE users for selection
  const { data: lineUsers } = trpc.line.listUsers.useQuery();
  
  // Fetch brands for selection
  const { data: brands } = trpc.brand.list.useQuery();

  // Create follow-up mutation
  const createFollowUpMutation = trpc.line.createFollowUp.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "フォローアップを作成しました" : "已创建跟进");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: () => {
      toast.error(language === "ja" ? "作成に失敗しました" : "创建失败");
    },
  });

  // Cancel follow-up mutation
  const cancelFollowUpMutation = trpc.line.cancelFollowUp.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "フォローアップをキャンセルしました" : "已取消跟进");
      refetch();
    },
    onError: () => {
      toast.error(language === "ja" ? "キャンセルに失敗しました" : "取消失败");
    },
  });

  const resetForm = () => {
    setSelectedUserId("");
    setTriggerCondition("no_reply");
    setDelayHours(72);
    setMaxAttempts(3);
    setMessageTemplate("");
    setSelectedBrandId("");
  };

  const handleCreateFollowUp = async () => {
    if (!selectedUserId || !messageTemplate.trim()) {
      toast.error(language === "ja" ? "必須項目を入力してください" : "请填写必填项");
      return;
    }

    await createFollowUpMutation.mutateAsync({
      targetType: "user",
      lineUserId: selectedUserId,
      triggerCondition,
      delayHours,
      maxAttempts,
      messageTemplate: messageTemplate.trim(),
      brandId: selectedBrandId ? parseInt(selectedBrandId) : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">{language === "ja" ? "アクティブ" : "活跃"}</Badge>;
      case "completed":
        return <Badge variant="secondary">{language === "ja" ? "完了" : "已完成"}</Badge>;
      case "cancelled":
        return <Badge variant="destructive">{language === "ja" ? "キャンセル" : "已取消"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case "no_reply":
        return language === "ja" ? "返信なし時" : "无回复时";
      case "scheduled":
        return language === "ja" ? "予約送信" : "定时发送";
      case "event":
        return language === "ja" ? "イベント" : "事件";
      default:
        return trigger;
    }
  };

  const getUserName = (lineUserId: string | null) => {
    if (!lineUserId || !lineUsers) return lineUserId || "-";
    const user = lineUsers.find(u => u.lineUserId === lineUserId);
    return user?.displayName || lineUserId.slice(0, 12) + "...";
  };

  const getBrandName = (brandId: number | null) => {
    if (!brandId || !brands) return "-";
    const brand = brands.find(b => b.id === brandId);
    return brand?.name || "-";
  };

  // Stats
  const activeCount = followUps?.filter(f => f.status === "active").length || 0;
  const completedCount = followUps?.filter(f => f.status === "completed").length || 0;
  const cancelledCount = followUps?.filter(f => f.status === "cancelled").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === "ja" ? "フォローアップ管理" : "跟进管理"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ja" 
              ? "LINEユーザーへの自動フォローアップメッセージを管理" 
              : "管理LINE用户的自动跟进消息"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === "ja" ? "更新" : "刷新"}
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {language === "ja" ? "新規作成" : "新建"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {language === "ja" ? "フォローアップを作成" : "创建跟进"}
                </DialogTitle>
                <DialogDescription>
                  {language === "ja" 
                    ? "LINEユーザーへの自動フォローアップを設定します" 
                    : "设置LINE用户的自动跟进"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{language === "ja" ? "対象ユーザー" : "目标用户"} *</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ja" ? "ユーザーを選択" : "选择用户"} />
                    </SelectTrigger>
                    <SelectContent>
                      {lineUsers?.map((user) => (
                        <SelectItem key={user.lineUserId} value={user.lineUserId}>
                          {user.displayName || user.lineUserId.slice(0, 12) + "..."}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ja" ? "トリガー条件" : "触发条件"}</Label>
                  <Select value={triggerCondition} onValueChange={(v) => setTriggerCondition(v as "no_reply" | "scheduled")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_reply">
                        {language === "ja" ? "返信がない場合" : "无回复时"}
                      </SelectItem>
                      <SelectItem value="scheduled">
                        {language === "ja" ? "予約送信" : "定时发送"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ja" ? "待機時間（時間）" : "等待时间（小时）"}</Label>
                    <Input
                      type="number"
                      value={delayHours}
                      onChange={(e) => setDelayHours(parseInt(e.target.value) || 72)}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ja" ? "最大試行回数" : "最大尝试次数"}</Label>
                    <Input
                      type="number"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 3)}
                      min={1}
                      max={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ja" ? "関連ブランド" : "关联品牌"}</Label>
                  <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ja" ? "ブランドを選択（任意）" : "选择品牌（可选）"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{language === "ja" ? "なし" : "无"}</SelectItem>
                      {brands?.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id.toString()}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{language === "ja" ? "メッセージテンプレート" : "消息模板"} *</Label>
                  <Textarea
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    placeholder={language === "ja" 
                      ? "こんにちは！先日はお問い合わせありがとうございました。その後いかがでしょうか？" 
                      : "您好！感谢您之前的咨询。后续情况如何？"}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  {language === "ja" ? "キャンセル" : "取消"}
                </Button>
                <Button 
                  onClick={handleCreateFollowUp}
                  disabled={createFollowUpMutation.isPending || !selectedUserId || !messageTemplate.trim()}
                >
                  {createFollowUpMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      {language === "ja" ? "作成中..." : "创建中..."}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {language === "ja" ? "作成" : "创建"}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "合計" : "总计"}
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{followUps?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "アクティブ" : "活跃"}
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "完了" : "已完成"}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "キャンセル" : "已取消"}
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{cancelledCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Follow-ups List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          {language === "ja" ? "読み込み中..." : "加载中..."}
        </div>
      ) : followUps?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {language === "ja" 
              ? "フォローアップがまだありません。「新規作成」ボタンから作成してください。" 
              : "还没有跟进。请点击「新建」按钮创建。"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {followUps?.map((followUp) => (
            <Card key={followUp.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {getUserName(followUp.lineUserId)}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {getTriggerLabel(followUp.triggerCondition)} • 
                        {followUp.delayHours}{language === "ja" ? "時間" : "小时"}間隔
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(followUp.status)}
                    {followUp.status === "active" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelFollowUpMutation.mutate({ id: followUp.id })}
                        disabled={cancelFollowUpMutation.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{followUp.messageTemplate}</p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {followUp.currentAttempts}/{followUp.maxAttempts} {language === "ja" ? "回送信" : "次发送"}
                    </div>
                    {followUp.brandId && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {getBrandName(followUp.brandId)}
                      </div>
                    )}
                    {followUp.nextScheduledAt && followUp.status === "active" && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {language === "ja" ? "次回: " : "下次: "}
                        {format(new Date(followUp.nextScheduledAt), "yyyy/MM/dd HH:mm")}
                      </div>
                    )}
                    {followUp.lastSentAt && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {language === "ja" ? "最終送信: " : "最后发送: "}
                        {format(new Date(followUp.lastSentAt), "yyyy/MM/dd HH:mm")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
