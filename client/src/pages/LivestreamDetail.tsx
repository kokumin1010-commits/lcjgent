import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, Sparkles, Package, User, Megaphone, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function LivestreamDetail() {
  const params = useParams<{ id: string }>();
  const livestreamId = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const { language } = useLanguage();

  
  const [isEditing, setIsEditing] = useState(false);
  const [result, setResult] = useState<"成功" | "失敗" | undefined>();
  const [impactFactor, setImpactFactor] = useState<"構成" | "商品" | "ライバー" | "広告" | "その他" | undefined>();
  const [resultReason, setResultReason] = useState("");
  
  const { data: livestream, isLoading, refetch } = trpc.liverManagement.getLivestreamDetail.useQuery({
    id: livestreamId,
  });
  
  const updateMutation = trpc.liverManagement.updateLivestreamResult.useMutation({
    onSuccess: () => {
      toast.success("配信結果を保存しました");
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const translations = {
    ja: {
      deliveryPeriod: "配信期間",
      start: "開始",
      end: "終了",
      salesTotal: "売上合計",
      deliveredBrand: "配信したブランド",
      deliveryResult: "配信結果",
      success: "成功",
      failure: "失敗",
      impactFactor: "影響した要因",
      composition: "構成",
      product: "商品",
      liver: "ライバー",
      ad: "広告",
      other: "その他",
      reason: "理由",
      memo: "メモ",
      screenshot: "配信後スクリーンショット",
      back: "戻る",
      edit: "編集",
      save: "保存",
      cancel: "キャンセル",
      notSet: "未設定",
    },
    zh: {
      deliveryPeriod: "直播时间",
      start: "开始",
      end: "结束",
      salesTotal: "销售总额",
      deliveredBrand: "直播品牌",
      deliveryResult: "直播结果",
      success: "成功",
      failure: "失败",
      impactFactor: "影响因素",
      composition: "构成",
      product: "商品",
      liver: "主播",
      ad: "广告",
      other: "其他",
      reason: "原因",
      memo: "备注",
      screenshot: "直播后截图",
      back: "返回",
      edit: "编辑",
      save: "保存",
      cancel: "取消",
      notSet: "未设置",
    },
  };
  
  const tr = translations[language as keyof typeof translations] || translations.ja;
  
  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day}(${weekday}) ${hours}:${mins}`;
  };
  
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString();
  };
  
  const getImpactFactorIcon = (factor: string | null) => {
    switch (factor) {
      case "構成": return <Sparkles className="w-4 h-4" />;
      case "商品": return <Package className="w-4 h-4" />;
      case "ライバー": return <User className="w-4 h-4" />;
      case "広告": return <Megaphone className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };
  
  const handleStartEdit = () => {
    setResult(livestream?.result as "成功" | "失敗" | undefined);
    setImpactFactor(livestream?.impactFactor as "構成" | "商品" | "ライバー" | "広告" | "その他" | undefined);
    setResultReason(livestream?.resultReason || "");
    setIsEditing(true);
  };
  
  const handleSave = () => {
    updateMutation.mutate({
      id: livestreamId,
      result,
      impactFactor,
      resultReason,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48 bg-gray-800" />
          <Skeleton className="h-64 w-full bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!livestream) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-gray-500">配信履歴が見つかりません</p>
          <Button 
            onClick={() => window.history.back()} 
            className="mt-4 bg-red-600 hover:bg-red-700"
          >
            {tr.back}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Red top border */}
      <div className="h-1 bg-red-600" />
      
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Back Button */}
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {tr.back}
        </button>
        
        {/* Content Card */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-6 space-y-6">
            {/* Delivery Period */}
            <div className="flex justify-between items-start">
              <span className="text-red-500 font-medium">{tr.deliveryPeriod}</span>
              <div className="text-right">
                <p>{tr.start}　{formatDateTime(livestream.livestreamDate)}</p>
                <p>{tr.end}　{formatDateTime(livestream.livestreamEndTime)}</p>
              </div>
            </div>
            
            {/* Sales Total */}
            <div className="flex justify-between items-center">
              <span className="text-red-500 font-medium">{tr.salesTotal}</span>
              <span className="text-xl font-bold">
                {formatCurrency(livestream.gmv || livestream.salesAmount || 0)}
              </span>
            </div>
            
            {/* Delivered Brand */}
            <div className="flex justify-between items-center">
              <span className="text-red-500 font-medium">{tr.deliveredBrand}</span>
              <span>{livestream.brand?.name || "-"}</span>
            </div>
            
            {/* Delivery Result */}
            <div className="flex justify-between items-center">
              <span className="text-red-500 font-medium">{tr.deliveryResult}</span>
              {isEditing ? (
                <Select 
                  value={result || "none"} 
                  onValueChange={(v) => setResult(v === "none" ? undefined : v as "成功" | "失敗")}
                >
                  <SelectTrigger className="w-32 bg-transparent border-gray-700">
                    <SelectValue placeholder={tr.notSet} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="text-gray-400">{tr.notSet}</SelectItem>
                    <SelectItem value="成功" className="text-green-500">{tr.success}</SelectItem>
                    <SelectItem value="失敗" className="text-red-500">{tr.failure}</SelectItem>
                  </SelectContent>
                </Select>
              ) : livestream.result ? (
                <Badge 
                  variant={livestream.result === "成功" ? "default" : "destructive"}
                  className={livestream.result === "成功" 
                    ? "bg-green-600 hover:bg-green-700" 
                    : "bg-red-600 hover:bg-red-700"
                  }
                >
                  {livestream.result === "成功" ? (
                    <><CheckCircle className="w-3 h-3 mr-1" /> {tr.success}</>
                  ) : (
                    <><XCircle className="w-3 h-3 mr-1" /> {tr.failure}</>
                  )}
                </Badge>
              ) : (
                <span className="text-gray-500">{tr.notSet}</span>
              )}
            </div>
            
            {/* Impact Factor */}
            <div className="flex justify-between items-center">
              <span className="text-red-500 font-medium">{tr.impactFactor}</span>
              {isEditing ? (
                <Select 
                  value={impactFactor || "none"} 
                  onValueChange={(v) => setImpactFactor(v === "none" ? undefined : v as "構成" | "商品" | "ライバー" | "広告" | "その他")}
                >
                  <SelectTrigger className="w-32 bg-transparent border-gray-700">
                    <SelectValue placeholder={tr.notSet} />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="text-gray-400">{tr.notSet}</SelectItem>
                    <SelectItem value="構成">{tr.composition}</SelectItem>
                    <SelectItem value="商品">{tr.product}</SelectItem>
                    <SelectItem value="ライバー">{tr.liver}</SelectItem>
                    <SelectItem value="広告">{tr.ad}</SelectItem>
                    <SelectItem value="その他">{tr.other}</SelectItem>
                  </SelectContent>
                </Select>
              ) : livestream.impactFactor ? (
                <Badge variant="outline" className="border-gray-600">
                  {getImpactFactorIcon(livestream.impactFactor)}
                  <span className="ml-1">{livestream.impactFactor}</span>
                </Badge>
              ) : (
                <span className="text-gray-500">{tr.notSet}</span>
              )}
            </div>
            
            {/* Reason */}
            <div className="space-y-2">
              <span className="text-red-500 font-medium">{tr.reason}</span>
              {isEditing ? (
                <Textarea
                  value={resultReason}
                  onChange={(e) => setResultReason(e.target.value)}
                  placeholder="理由を入力..."
                  className="bg-gray-800 border-gray-700 text-white"
                  rows={3}
                />
              ) : (
                <p className="text-gray-300">
                  {livestream.resultReason || "-"}
                </p>
              )}
            </div>
            
            {/* Memo */}
            <div className="space-y-2">
              <span className="text-red-500 font-medium">{tr.memo}</span>
              <p className="text-gray-300">{livestream.remarks || "-"}</p>
            </div>
            
            {/* Screenshot */}
            <div className="space-y-2">
              <span className="text-red-500 font-medium">{tr.screenshot}</span>
              {livestream.screenshotUrl ? (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <img 
                    src={livestream.screenshotUrl} 
                    alt="配信後スクリーンショット"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <p className="text-gray-500">-</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                {tr.cancel}
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {updateMutation.isPending ? "保存中..." : tr.save}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={handleStartEdit}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8"
            >
              {tr.edit}
            </Button>
          )}
        </div>
        
        {/* Back Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={() => window.history.back()}
            className="bg-transparent border border-gray-600 text-gray-300 hover:bg-gray-800 px-8 rounded-full"
          >
            {tr.back}
          </Button>
        </div>
      </div>
    </div>
  );
}
