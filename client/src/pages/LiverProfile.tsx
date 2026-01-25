import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Save, 
  User, 
  Palette,
  Instagram,
  Youtube,
  Link as LinkIcon
} from "lucide-react";

// TikTok icon component
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

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

export default function LiverProfile() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  
  const { data: liverInfo, isLoading } = trpc.liver.me.useQuery();
  
  const [name, setName] = useState("");
  const [color, setColor] = useState("#FF69B4");
  const [bio, setBio] = useState("");
  const [tiktokAccount, setTiktokAccount] = useState("");
  const [instagramAccount, setInstagramAccount] = useState("");
  const [youtubeAccount, setYoutubeAccount] = useState("");
  const [otherAccount, setOtherAccount] = useState("");
  
  // Initialize form with current data
  useEffect(() => {
    if (liverInfo) {
      setName(liverInfo.name || "");
      setColor(liverInfo.color || "#FF69B4");
      setBio(liverInfo.bio || "");
      setTiktokAccount(liverInfo.tiktokAccount || "");
      setInstagramAccount(liverInfo.instagramAccount || "");
      setYoutubeAccount(liverInfo.youtubeAccount || "");
      setOtherAccount(liverInfo.otherAccount || "");
    }
  }, [liverInfo]);
  
  const updateProfileMutation = trpc.liver.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("プロフィールを更新しました");
      utils.liver.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "更新に失敗しました");
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate({
      name,
      color,
      bio,
      tiktokAccount: tiktokAccount || undefined,
      instagramAccount: instagramAccount || undefined,
      youtubeAccount: youtubeAccount || undefined,
      otherAccount: otherAccount || undefined,
    });
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!liverInfo) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-white text-center">ログインが必要です</p>
        <Button
          onClick={() => navigate("/liver/login")}
          className="bg-red-600 hover:bg-red-700"
        >
          ログインページへ
        </Button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-black border-b-2 border-red-600 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/liver/mypage")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-yellow-500">プロフィール編集</h1>
          </div>
        </div>
      </header>
      
      {/* Red line separator */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
      
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center">
            <Avatar className="w-24 h-24 border-4 border-red-600">
              <AvatarImage src={liverInfo.avatarUrl || undefined} />
              <AvatarFallback 
                className="text-2xl font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <p className="mt-2 text-sm text-gray-400">プレビュー</p>
          </div>
          
          {/* Basic Info */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <User className="h-5 w-5 text-yellow-500" />
                基本情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-white">名前</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ライバー名"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="bio" className="text-white">自己紹介</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="自己紹介を入力..."
                  className="mt-1 bg-gray-800 border-gray-700 text-white min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Color Selection */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Palette className="h-5 w-5 text-yellow-500" />
                テーマカラー
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3">
                {colorOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setColor(option.value)}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-lg transition-all
                      ${color === option.value 
                        ? "ring-2 ring-yellow-500 bg-gray-800" 
                        : "hover:bg-gray-800"
                      }
                    `}
                  >
                    <div 
                      className="w-10 h-10 rounded-full border-2 border-white/20"
                      style={{ backgroundColor: option.value }}
                    />
                    <span className="text-xs text-gray-400">{option.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* SNS Accounts */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-yellow-500" />
                SNSアカウント
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tiktok" className="text-white flex items-center gap-2">
                  <TikTokIcon className="h-4 w-4" />
                  TikTok
                </Label>
                <Input
                  id="tiktok"
                  value={tiktokAccount}
                  onChange={(e) => setTiktokAccount(e.target.value)}
                  placeholder="@username"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="instagram" className="text-white flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  Instagram
                </Label>
                <Input
                  id="instagram"
                  value={instagramAccount}
                  onChange={(e) => setInstagramAccount(e.target.value)}
                  placeholder="@username"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="youtube" className="text-white flex items-center gap-2">
                  <Youtube className="h-4 w-4" />
                  YouTube
                </Label>
                <Input
                  id="youtube"
                  value={youtubeAccount}
                  onChange={(e) => setYoutubeAccount(e.target.value)}
                  placeholder="チャンネルURL"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="other" className="text-white flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  その他
                </Label>
                <Input
                  id="other"
                  value={otherAccount}
                  onChange={(e) => setOtherAccount(e.target.value)}
                  placeholder="その他のSNS・URL"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Submit Button */}
          <Button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg font-bold"
          >
            {updateProfileMutation.isPending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                保存する
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
