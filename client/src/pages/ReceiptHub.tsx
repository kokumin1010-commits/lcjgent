import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  MessageCircle,
  Globe,
  Brain,
  ClipboardCheck,
  Receipt,
} from "lucide-react";
import LineReceiptManagement from "./LineReceiptManagement";
import ReceiptManagement from "./ReceiptManagement";
import AiLearningDashboard from "./AiLearningDashboard";
import PointRequestAdmin from "./PointRequestAdmin";

type TabType = "line" | "web" | "point-requests" | "ai-learning";

export default function ReceiptHub() {
  const [activeTab, setActiveTab] = useState<TabType>("line");

  // Fetch pending counts for badges
  const { data: lineStats } = trpc.point.adminGetLineStatistics.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: webReceipts } = trpc.point.adminGetReceipts.useQuery(
    { status: "pending", limit: 1, offset: 0 },
    { refetchInterval: 30000 }
  );
  const { data: pointRequests } = trpc.pointRequest.pendingRequests.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const linePending = lineStats?.pending ?? 0;
  const webPending = (webReceipts as any)?.total ?? 0;
  const pointPending = pointRequests?.length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          レシート管理
        </h1>
        <p className="text-muted-foreground mt-1">
          全チャネルのレシート審査・ポイント付与・AI学習分析を一元管理
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="grid w-full grid-cols-4 mb-6 h-auto">
          <TabsTrigger value="line" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">LINE</span>レシート
            {linePending > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {linePending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="web" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
            <Globe className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Web</span>レシート
            {webPending > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {webPending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="point-requests" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
            <ClipboardCheck className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">ポイント</span>申請
            {pointPending > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-[10px]">
                {pointPending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ai-learning" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
            <Brain className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">AI</span>学習分析
          </TabsTrigger>
        </TabsList>

        <TabsContent value="line" className="mt-0">
          <LineReceiptManagement embedded />
        </TabsContent>

        <TabsContent value="web" className="mt-0">
          <ReceiptManagement embedded />
        </TabsContent>

        <TabsContent value="point-requests" className="mt-0">
          <PointRequestAdmin embedded />
        </TabsContent>

        <TabsContent value="ai-learning" className="mt-0">
          <AiLearningDashboard embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
