import { useState, useEffect, useRef } from "react";
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
  Link as LinkIcon,
  MessageCircle,
  Bell,
  BellOff,
  Camera,
  Loader2,
  Globe
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { createLiverT, LiverLanguage } from "@/lib/liverI18n";

// TikTok icon component
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

// LINE連携セクションコンポーネント
function LineLinkSection({ lineUserId, lt }: { lineUserId?: string | null; lt: (key: string, params?: Record<string, string | number>) => string }) {
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const utils = trpc.useUtils();

  const generateCodeMutation = trpc.liver.generateLineLinkCode.useMutation({
    onSuccess: (data) => {
      setLinkCode(data.linkCode);
      setExpiresAt(new Date(Date.now() + data.expiresIn * 1000));
      setTimeLeft(data.expiresIn);
    },
    onError: (error) => {
      toast.error(error.message || lt("common.error"));
    },
  });

  const unlinkMutation = trpc.liver.unlinkLine.useMutation({
    onSuccess: () => {
      toast.success(lt("line.unlink"));
      utils.liver.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || lt("common.error"));
    },
  });

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setLinkCode(null);
        setExpiresAt(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (lineUserId) {
    return (
      <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-green-400">
              <MessageCircle className="h-4 w-4" />
              <span className="font-medium">{lt("line.linked")}</span>
            </div>
            <p className="mt-1 text-sm text-gray-200">
              {lt("line.linkedDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => unlinkMutation.mutate()}
            disabled={unlinkMutation.isPending}
            className="text-red-400 border-red-400 hover:bg-red-900/30"
          >
            {lt("line.unlink")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
      <div className="flex items-center gap-2 text-yellow-500">
        <MessageCircle className="h-4 w-4" />
        <span className="font-medium">{lt("line.notLinked")}</span>
      </div>
      
      <div className="text-sm text-gray-200 space-y-2">
        <ol className="list-decimal list-inside space-y-1">
          <li>{lt("line.step1")}</li>
          <li>{lt("line.step2")}</li>
          <li>{lt("line.step3")}</li>
        </ol>
      </div>

      {linkCode ? (
        <div className="p-4 bg-yellow-900/30 border border-yellow-600 rounded-lg text-center">
          <p className="text-sm text-yellow-400 mb-2">({Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')})</p>
          <p className="text-4xl font-bold text-white tracking-widest">{linkCode}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <a
            href="https://lin.ee/dlaoCfw"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {lt("line.addFriend")}
          </a>
          <Button
            onClick={() => generateCodeMutation.mutate()}
            disabled={generateCodeMutation.isPending}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            {generateCodeMutation.isPending ? lt("common.loading") : lt("line.generateCode")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function LiverProfile() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { language, setLanguage } = useLanguage();
  const lt = createLiverT(language as LiverLanguage);
  
  const { data: liverInfo, isLoading, isError: isLiverError, isFetching } = trpc.liver.me.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: 1,
  });
  
  const [hasLoadedLiver, setHasLoadedLiver] = useState(false);
  
  useEffect(() => {
    if (liverInfo && !hasLoadedLiver) {
      setHasLoadedLiver(true);
    }
  }, [liverInfo, hasLoadedLiver]);
  
  const [name, setName] = useState("");
  const [color, setColor] = useState("#FF69B4");
  const [bio, setBio] = useState("");
  const [tiktokAccount, setTiktokAccount] = useState("");
  const [instagramAccount, setInstagramAccount] = useState("");
  const [youtubeAccount, setYoutubeAccount] = useState("");
  const [otherAccount, setOtherAccount] = useState("");
  const [lineNotificationEnabled, setLineNotificationEnabled] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);
  
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
      setLineNotificationEnabled(liverInfo.lineNotificationEnabled !== false);
      setAvatarUrl(liverInfo.avatarUrl || null);
      if ((liverInfo as any).language) {
        setSelectedLanguage((liverInfo as any).language);
        setLanguage((liverInfo as any).language);
      }
    }
  }, [liverInfo]);

  // Color options with translation
  const colorOptions = [
    { value: "#FF69B4", label: lt("color.pink") },
    { value: "#4169E1", label: lt("color.blue") },
    { value: "#32CD32", label: lt("color.green") },
    { value: "#FFD700", label: lt("color.gold") },
    { value: "#FF6347", label: lt("color.red") },
    { value: "#9370DB", label: lt("color.purple") },
    { value: "#00CED1", label: lt("color.cyan") },
    { value: "#FF8C00", label: lt("color.orange") },
  ];

  // Handle avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !liverInfo) return;

    if (!file.type.startsWith("image/")) {
      toast.error(lt("common.error"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(lt("common.error"));
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("liverId", String(liverInfo.id));

      const response = await fetch("/api/liver-avatar-upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || lt("profile.saveError"));
      }

      const result = await response.json();
      setAvatarUrl(result.url);
      toast.success(lt("profile.saved"));
      utils.liver.me.invalidate();
    } catch (error: any) {
      toast.error(error.message || lt("profile.saveError"));
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };
  
  const updateProfileMutation = trpc.liver.updateProfile.useMutation({
    onSuccess: () => {
      toast.success(lt("profile.saved"));
      utils.liver.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || lt("profile.saveError"));
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Update language in context
    setLanguage(selectedLanguage);
    updateProfileMutation.mutate({
      name,
      color,
      bio,
      tiktokAccount: tiktokAccount || undefined,
      instagramAccount: instagramAccount || undefined,
      youtubeAccount: youtubeAccount || undefined,
      otherAccount: otherAccount || undefined,
      lineNotificationEnabled,
      language: selectedLanguage,
    });
  };
  
  if (isLoading && !hasLoadedLiver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!liverInfo && !hasLoadedLiver && !isLoading && !isFetching) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-white text-center">{lt("mypage.loginRequired")}</p>
        <Button
          onClick={() => navigate("/liver/login")}
          className="bg-red-600 hover:bg-red-700"
        >
          {lt("mypage.goToLogin")}
        </Button>
      </div>
    );
  }
  
  if (!liverInfo) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
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
              className="text-gray-200 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-yellow-500">{lt("profile.title")}</h1>
          </div>
        </div>
      </header>
      
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
      
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Preview with Upload */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-red-600">
                <AvatarImage src={avatarUrl || liverInfo.avatarUrl || undefined} />
                <AvatarFallback 
                  className="text-2xl font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="mt-2 text-sm text-yellow-500 hover:text-yellow-400 transition-colors cursor-pointer"
            >
              {isUploadingAvatar ? lt("common.loading") : lt("common.edit")}
            </button>
            <p className="mt-1 text-xs text-gray-300">ID: {liverInfo.id}</p>
          </div>

          {/* Language Selection */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-yellow-500" />
                {lt("profile.language")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "ja", label: lt("profile.languageJa"), flag: "🇯🇵" },
                  { value: "zh-TW", label: lt("profile.languageZhTW"), flag: "🇹🇼" },
                  { value: "en", label: lt("profile.languageEn"), flag: "🇺🇸" },
                ].map((lang) => (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => {
                      setSelectedLanguage(lang.value);
                      setLanguage(lang.value);
                    }}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-lg transition-all
                      ${selectedLanguage === lang.value
                        ? "ring-2 ring-yellow-500 bg-gray-800"
                        : "hover:bg-gray-800"
                      }
                    `}
                  >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="text-xs text-gray-200">{lang.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Basic Info */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <User className="h-5 w-5 text-yellow-500" />
                {lt("profile.name")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-white">{lt("profile.name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="bio" className="text-white">{lt("profile.bio")}</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
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
                {lt("profile.color")}
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
                    <span className="text-xs text-gray-200">{option.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* LINE Notification Settings */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-500" />
                {lt("line.notification")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {lineNotificationEnabled ? (
                    <Bell className="h-5 w-5 text-green-500" />
                  ) : (
                    <BellOff className="h-5 w-5 text-gray-300" />
                  )}
                  <div>
                    <p className="text-white font-medium">AI Coaching</p>
                    <p className="text-sm text-gray-200">
                      {lt("line.linkedDescription")}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={lineNotificationEnabled}
                  onCheckedChange={setLineNotificationEnabled}
                  className="data-[state=checked]:bg-green-500"
                />
              </div>
              
              <LineLinkSection lineUserId={liverInfo.lineUserId} lt={lt} />
            </CardContent>
          </Card>
          
          {/* SNS Accounts */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-yellow-500" />
                SNS
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
                  placeholder="URL"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="other" className="text-white flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  {lt("profile.other")}
                </Label>
                <Input
                  id="other"
                  value={otherAccount}
                  onChange={(e) => setOtherAccount(e.target.value)}
                  placeholder="URL"
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
                {lt("common.save")}
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
