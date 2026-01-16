import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Brain, Users, User, TrendingUp, AlertCircle } from "lucide-react";
import { Streamdown } from "streamdown";

export default function ReportAnalysis() {
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState("individual");
  
  // Individual analysis state
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [individualStartDate, setIndividualStartDate] = useState("");
  const [individualEndDate, setIndividualEndDate] = useState("");
  const [individualResult, setIndividualResult] = useState<{
    success: boolean;
    staffName?: string;
    reportCount?: number;
    analysis?: string;
    error?: string;
  } | null>(null);
  
  // Team analysis state
  const [teamStartDate, setTeamStartDate] = useState("");
  const [teamEndDate, setTeamEndDate] = useState("");
  const [teamCountry, setTeamCountry] = useState<string>("");
  const [teamResult, setTeamResult] = useState<{
    success: boolean;
    memberCount?: number;
    reportCount?: number;
    analysis?: string;
    error?: string;
  } | null>(null);

  // Fetch report staff list
  const { data: reportStaffList } = trpc.reportStaff.list.useQuery();

  // Individual analysis mutation
  const analyzeIndividual = trpc.report.analyzeIndividual.useMutation({
    onSuccess: (data) => {
      setIndividualResult(data);
    },
    onError: (error) => {
      setIndividualResult({
        success: false,
        error: error.message,
      });
    },
  });

  // Team analysis mutation
  const analyzeTeam = trpc.report.analyzeTeam.useMutation({
    onSuccess: (data) => {
      setTeamResult(data);
    },
    onError: (error) => {
      setTeamResult({
        success: false,
        error: error.message,
      });
    },
  });

  const handleIndividualAnalysis = () => {
    if (!selectedStaffId) return;
    
    setIndividualResult(null);
    analyzeIndividual.mutate({
      reportStaffId: parseInt(selectedStaffId),
      startDate: individualStartDate || undefined,
      endDate: individualEndDate || undefined,
      language: language as "ja" | "zh",
    });
  };

  const handleTeamAnalysis = () => {
    setTeamResult(null);
    analyzeTeam.mutate({
      startDate: teamStartDate || undefined,
      endDate: teamEndDate || undefined,
      country: teamCountry || undefined,
      language: language as "ja" | "zh",
    });
  };

  const translations = {
    ja: {
      title: "AI分析",
      description: "日報データをAIで分析し、作業傾向やチーム進捗を自動生成します",
      individualTab: "個人分析",
      teamTab: "チーム分析",
      selectStaff: "スタッフを選択",
      selectStaffPlaceholder: "スタッフを選択してください",
      startDate: "開始日",
      endDate: "終了日",
      analyze: "分析する",
      analyzing: "分析中...",
      country: "国",
      allCountries: "すべて",
      japan: "日本",
      china: "中国",
      analysisResult: "分析結果",
      staffName: "スタッフ名",
      reportCount: "分析した日報数",
      memberCount: "チームメンバー数",
      noStaffSelected: "スタッフを選択してください",
      individualDescription: "特定のスタッフの日報を分析し、作業傾向、強み、改善点を抽出します",
      teamDescription: "チーム全体の日報を分析し、進捗サマリー、貢献度、課題を抽出します",
    },
    zh: {
      title: "AI分析",
      description: "使用AI分析日报数据，自动生成工作趋势和团队进度",
      individualTab: "个人分析",
      teamTab: "团队分析",
      selectStaff: "选择员工",
      selectStaffPlaceholder: "请选择员工",
      startDate: "开始日期",
      endDate: "结束日期",
      analyze: "分析",
      analyzing: "分析中...",
      country: "国家",
      allCountries: "全部",
      japan: "日本",
      china: "中国",
      analysisResult: "分析结果",
      staffName: "员工姓名",
      reportCount: "分析的日报数",
      memberCount: "团队成员数",
      noStaffSelected: "请选择员工",
      individualDescription: "分析特定员工的日报，提取工作趋势、优势和改进点",
      teamDescription: "分析整个团队的日报，提取进度摘要、贡献度和课题",
    },
  };

  const text = translations[language as keyof typeof translations] || translations.ja;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{text.title}</h1>
          <p className="text-muted-foreground">{text.description}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="individual" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {text.individualTab}
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {text.teamTab}
          </TabsTrigger>
        </TabsList>

        {/* Individual Analysis Tab */}
        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {text.individualTab}
              </CardTitle>
              <CardDescription>{text.individualDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{text.selectStaff}</Label>
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger>
                      <SelectValue placeholder={text.selectStaffPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {reportStaffList?.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id.toString()}>
                          {staff.name} {staff.country === "japan" ? "🇯🇵" : staff.country === "china" ? "🇨🇳" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{text.startDate}</Label>
                  <Input
                    type="date"
                    value={individualStartDate}
                    onChange={(e) => setIndividualStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{text.endDate}</Label>
                  <Input
                    type="date"
                    value={individualEndDate}
                    onChange={(e) => setIndividualEndDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleIndividualAnalysis}
                disabled={!selectedStaffId || analyzeIndividual.isPending}
                className="w-full md:w-auto"
              >
                {analyzeIndividual.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {text.analyzing}
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {text.analyze}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Individual Analysis Result */}
          {individualResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  {text.analysisResult}
                </CardTitle>
                {individualResult.success && (
                  <CardDescription>
                    {text.staffName}: {individualResult.staffName} | {text.reportCount}: {individualResult.reportCount}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {individualResult.success ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <Streamdown>{individualResult.analysis || ""}</Streamdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    {individualResult.error}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team Analysis Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {text.teamTab}
              </CardTitle>
              <CardDescription>{text.teamDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{text.country}</Label>
                  <Select value={teamCountry} onValueChange={setTeamCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder={text.allCountries} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{text.allCountries}</SelectItem>
                      <SelectItem value="japan">{text.japan} 🇯🇵</SelectItem>
                      <SelectItem value="china">{text.china} 🇨🇳</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{text.startDate}</Label>
                  <Input
                    type="date"
                    value={teamStartDate}
                    onChange={(e) => setTeamStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{text.endDate}</Label>
                  <Input
                    type="date"
                    value={teamEndDate}
                    onChange={(e) => setTeamEndDate(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={handleTeamAnalysis}
                disabled={analyzeTeam.isPending}
                className="w-full md:w-auto"
              >
                {analyzeTeam.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {text.analyzing}
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {text.analyze}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Team Analysis Result */}
          {teamResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  {text.analysisResult}
                </CardTitle>
                {teamResult.success && (
                  <CardDescription>
                    {text.memberCount}: {teamResult.memberCount} | {text.reportCount}: {teamResult.reportCount}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {teamResult.success ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <Streamdown>{teamResult.analysis || ""}</Streamdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    {teamResult.error}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
