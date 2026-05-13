import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ArrowLeft, Save, User, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function LiverEditAdmin() {
  const params = useParams<{ id: string }>();
  const liverId = parseInt(params.id || "0", 10);
  const [, navigate] = useLocation();

  const { data: liver, isLoading } = trpc.liverManagement.getById.useQuery({
    id: liverId,
  });

  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [color, setColor] = useState("#FF69B4");
  const [bio, setBio] = useState("");
  const [uid, setUid] = useState("");
  const [tiktokAccount, setTiktokAccount] = useState("");
  const [instagramAccount, setInstagramAccount] = useState("");
  const [youtubeAccount, setYoutubeAccount] = useState("");
  const [otherAccount, setOtherAccount] = useState("");
  const [lineNotificationEnabled, setLineNotificationEnabled] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (liver) {
      setName(liver.name || "");
      setColor(liver.color || "#FF69B4");
      setBio(liver.bio || "");
      setUid((liver as any).uid || "");
      setTiktokAccount(liver.tiktokAccount || "");
      setInstagramAccount(liver.instagramAccount || "");
      setYoutubeAccount(liver.youtubeAccount || "");
      setOtherAccount(liver.otherAccount || "");
      setLineNotificationEnabled(liver.lineNotificationEnabled !== false);
      setIsActive(liver.isActive !== false);
    }
  }, [liver]);

  const updateMutation = trpc.liverManagement.update.useMutation({
    onSuccess: () => {
      toast.success("保存しました");
      utils.liverManagement.getById.invalidate({ id: liverId });
      navigate(`/livers/${liverId}`);
    },
    onError: (error) => {
      toast.error(error.message || "保存に失敗しました");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      id: liverId,
      name,
      color,
      bio,
      uid: uid || undefined,
      tiktokAccount: tiktokAccount || undefined,
      instagramAccount: instagramAccount || undefined,
      youtubeAccount: youtubeAccount || undefined,
      otherAccount: otherAccount || undefined,
      lineNotificationEnabled,
      isActive,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!liver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        ライバーが見つかりません
      </div>
    );
  }

  const colorOptions = [
    { value: "#FF69B4", label: "ピンク" },
    { value: "#4169E1", label: "ブルー" },
    { value: "#32CD32", label: "グリーン" },
    { value: "#FFD700", label: "ゴールド" },
    { value: "#FF6347", label: "レッド" },
    { value: "#9370DB", label: "パープル" },
    { value: "#00CED1", label: "シアン" },
    { value: "#FF8C00", label: "オレンジ" },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/livers/${liverId}`)}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">ライバー編集（管理者）</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={liver.avatarUrl || undefined} />
                  <AvatarFallback style={{ backgroundColor: color }}>
                    {name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-medium">{liver.name}</p>
                  <p className="text-sm text-gray-400">ID: {liverId}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                基本情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>名前</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div className="space-y-2">
                <Label>UID</Label>
                <Input
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="ライバーのUID"
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              <div className="space-y-2">
                <Label>自己紹介</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>テーマカラー</Label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setColor(opt.value)}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        color === opt.value
                          ? "border-white scale-105"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div
                        className="w-full h-6 rounded"
                        style={{ backgroundColor: opt.value }}
                      />
                      <p className="text-xs mt-1 text-center">{opt.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>アクティブ</Label>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </CardContent>
          </Card>

          {/* SNS Accounts */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">SNSアカウント</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>TikTok</Label>
                <Input
                  value={tiktokAccount}
                  onChange={(e) => setTiktokAccount(e.target.value)}
                  placeholder="@username or URL"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input
                  value={instagramAccount}
                  onChange={(e) => setInstagramAccount(e.target.value)}
                  placeholder="@username or URL"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>YouTube</Label>
                <Input
                  value={youtubeAccount}
                  onChange={(e) => setYoutubeAccount(e.target.value)}
                  placeholder="Channel URL"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label>その他</Label>
                <Input
                  value={otherAccount}
                  onChange={(e) => setOtherAccount(e.target.value)}
                  placeholder="Other URL"
                  className="bg-gray-800 border-gray-700"
                />
              </div>
            </CardContent>
          </Card>

          {/* LINE Notification */}
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg">通知設定</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label>LINE通知</Label>
                <Switch
                  checked={lineNotificationEnabled}
                  onCheckedChange={setLineNotificationEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            disabled={updateMutation.isPending || !name}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-bold py-3"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                保存
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
