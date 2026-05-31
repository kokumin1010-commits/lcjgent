import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Phone,
  Mail,
  Globe,
  Building2,
  User,
  MapPin,
  Clock,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  Calendar,
  MessageSquare,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";

const statusLabels: Record<string, string> = {
  new: "新規",
  contacted: "架電済",
  negotiating: "進行中",
  meeting: "打ち合わせ",
  contracted: "契約済",
  rejected: "見送り",
};

const statusColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-700",
  negotiating: "bg-yellow-100 text-yellow-700",
  meeting: "bg-purple-100 text-purple-700",
  contracted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const resultLabels: Record<string, string> = {
  answered: "応答",
  no_answer: "不在",
  busy: "話し中",
  callback: "折返し",
  meeting_set: "アポ確定",
  rejected: "見送り",
};

const resultColors: Record<string, string> = {
  answered: "bg-green-100 text-green-700",
  no_answer: "bg-gray-100 text-gray-700",
  busy: "bg-yellow-100 text-yellow-700",
  callback: "bg-blue-100 text-blue-700",
  meeting_set: "bg-purple-100 text-purple-700",
  rejected: "bg-red-100 text-red-700",
};

const activityTypeLabels: Record<string, string> = {
  call: "架電",
  email: "メール",
  status_change: "ステータス変更",
  note: "メモ",
  meeting: "打ち合わせ",
  brand_linked: "ブランド連携",
};

const activityTypeIcons: Record<string, React.ReactNode> = {
  call: <PhoneCall className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  status_change: <ArrowRightLeft className="h-4 w-4" />,
  note: <MessageSquare className="h-4 w-4" />,
  meeting: <Calendar className="h-4 w-4" />,
  brand_linked: <Building2 className="h-4 w-4" />,
};

export default function BusinessCardProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const cardId = parseInt(id || "0");
  const utils = trpc.useUtils();

  const { data: profile, isLoading } = trpc.businessCard.getProfile.useQuery(
    { id: cardId },
    { enabled: cardId > 0 }
  );

  // Call log dialog
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [callResult, setCallResult] = useState<string>("answered");
  const [callMemo, setCallMemo] = useState("");

  const createCallLogMutation = trpc.businessCard.createCallLog.useMutation({
    onSuccess: () => {
      toast.success("架電記録を追加しました");
      setShowCallDialog(false);
      setCallMemo("");
      setCallResult("answered");
      utils.businessCard.getProfile.invalidate({ id: cardId });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.businessCard.updateSalesStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      utils.businessCard.getProfile.invalidate({ id: cardId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">相手先が見つかりません</p>
        <Button variant="outline" onClick={() => setLocation("/master/business-cards")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>
      </div>
    );
  }

  const { card, callLogs, activities } = profile;

  // Build unified timeline from callLogs and activities
  const timeline = [
    ...callLogs.map((log: any) => ({
      type: "call" as const,
      date: new Date(log.calledAt),
      data: log,
    })),
    ...activities.map((act: any) => ({
      type: "activity" as const,
      date: new Date(act.createdAt),
      data: act,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const handleAddCallLog = () => {
    createCallLogMutation.mutate({
      businessCardId: cardId,
      result: callResult as any,
      memo: callMemo || undefined,
      contactName: card.name,
      contactCompany: card.company || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/master/business-cards")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{card.name}</h1>
            {card.company && (
              <p className="text-sm text-gray-500">{card.company}</p>
            )}
          </div>
          <Badge className={statusColors[card.salesStatus || "new"]}>
            {statusLabels[card.salesStatus || "new"]}
          </Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Basic Info + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Info Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">基本情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {card.company && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">会社名</p>
                      <p className="text-sm font-medium">{card.company}</p>
                    </div>
                  </div>
                )}
                {card.department && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">部署・役職</p>
                      <p className="text-sm font-medium">
                        {card.department}
                        {card.position && ` / ${card.position}`}
                      </p>
                    </div>
                  </div>
                )}
                {card.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">電話</p>
                      <a href={`tel:${card.phone}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {card.phone}
                      </a>
                    </div>
                  </div>
                )}
                {card.mobile && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">携帯</p>
                      <a href={`tel:${card.mobile}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {card.mobile}
                      </a>
                    </div>
                  </div>
                )}
                {card.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">メール</p>
                      <a href={`mailto:${card.email}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {card.email}
                      </a>
                    </div>
                  </div>
                )}
                {card.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">ウェブサイト</p>
                      <a href={card.website.startsWith("http") ? card.website : `https://${card.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                        {card.website}
                      </a>
                    </div>
                  </div>
                )}
                {card.address && (
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">住所</p>
                      <p className="text-sm font-medium">{card.address}</p>
                    </div>
                  </div>
                )}
                {card.notes && (
                  <div className="flex items-start gap-2 sm:col-span-2">
                    <MessageSquare className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">メモ</p>
                      <p className="text-sm whitespace-pre-wrap">{card.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">アクション</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                onClick={() => setShowCallDialog(true)}
              >
                <PhoneCall className="h-4 w-4 mr-2" />
                架電記録を追加
              </Button>
              <div>
                <p className="text-xs text-gray-500 mb-1">ステータス変更</p>
                <Select
                  value={card.salesStatus || "new"}
                  onValueChange={(value) => {
                    updateStatusMutation.mutate({
                      id: cardId,
                      salesStatus: value as any,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">新規</SelectItem>
                    <SelectItem value="contacted">架電済</SelectItem>
                    <SelectItem value="negotiating">進行中</SelectItem>
                    <SelectItem value="meeting">打ち合わせ</SelectItem>
                    <SelectItem value="contracted">契約済</SelectItem>
                    <SelectItem value="rejected">見送り</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {card.phone && (
                <a href={`tel:${card.phone}`} className="block">
                  <Button variant="outline" className="w-full">
                    <Phone className="h-4 w-4 mr-2" />
                    電話をかける
                  </Button>
                </a>
              )}
              {card.email && (
                <a href={`mailto:${card.email}`} className="block">
                  <Button variant="outline" className="w-full">
                    <Mail className="h-4 w-4 mr-2" />
                    メールを送る
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{callLogs.length}</p>
              <p className="text-xs text-gray-500">総架電数</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {callLogs.filter((l: any) => l.result === "answered").length}
              </p>
              <p className="text-xs text-gray-500">応答</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {callLogs.filter((l: any) => l.result === "meeting_set").length}
              </p>
              <p className="text-xs text-gray-500">アポ確定</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{activities.length}</p>
              <p className="text-xs text-gray-500">総アクティビティ</p>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              対応履歴タイムライン
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                まだ対応履歴がありません
              </p>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-4">
                  {timeline.map((item, idx) => (
                    <div key={idx} className="relative pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                        item.type === "call" ? "bg-blue-500" : "bg-gray-400"
                      }`} />
                      
                      <div className="bg-white border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {item.type === "call" ? (
                              <>
                                <PhoneCall className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-sm font-medium">架電</span>
                                <Badge className={`text-xs ${resultColors[item.data.result]}`}>
                                  {resultLabels[item.data.result]}
                                </Badge>
                              </>
                            ) : (
                              <>
                                {activityTypeIcons[item.data.activityType] || <MessageSquare className="h-3.5 w-3.5 text-gray-500" />}
                                <span className="text-sm font-medium">
                                  {activityTypeLabels[item.data.activityType] || item.data.activityType}
                                </span>
                              </>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {item.date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                            {" "}
                            {item.date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User className="h-3 w-3" />
                          <span>
                            {item.type === "call" ? item.data.callerName : item.data.performerName}
                          </span>
                        </div>
                        {item.type === "call" && item.data.memo && (
                          <p className="text-sm text-gray-600 mt-1 pl-5">{item.data.memo}</p>
                        )}
                        {item.type === "activity" && item.data.description && (
                          <p className="text-sm text-gray-600 mt-1 pl-5">{item.data.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Call Log Dialog */}
      <Dialog open={showCallDialog} onOpenChange={setShowCallDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>架電記録を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">結果</p>
              <Select value={callResult} onValueChange={setCallResult}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">応答</SelectItem>
                  <SelectItem value="no_answer">不在</SelectItem>
                  <SelectItem value="busy">話し中</SelectItem>
                  <SelectItem value="callback">折返し</SelectItem>
                  <SelectItem value="meeting_set">アポ確定</SelectItem>
                  <SelectItem value="rejected">見送り</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">メモ</p>
              <Textarea
                value={callMemo}
                onChange={(e) => setCallMemo(e.target.value)}
                placeholder="通話内容のメモ..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCallDialog(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handleAddCallLog}
              disabled={createCallLogMutation.isPending}
            >
              {createCallLogMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <PhoneCall className="h-4 w-4 mr-2" />
              )}
              記録する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
