import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Users, Send, History, RefreshCw, Search, User, Building2, Calendar, Clock, Link2, LogOut, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type LineUser = {
  id: number;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  userType: "customer" | "staff" | "liver" | "unknown";
  isBlocked: boolean;
  brandId: number | null;
  liverId: number | null;
  lastMessageAt: Date | null;
  createdAt: Date;
};

export default function LineManagement() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkingUser, setLinkingUser] = useState<LineUser | null>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [selectedUserType, setSelectedUserType] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showLeaveGroupDialog, setShowLeaveGroupDialog] = useState(false);
  const [leavingGroupId, setLeavingGroupId] = useState<string | null>(null);
  const [leavingGroupName, setLeavingGroupName] = useState<string>("");

  // Fetch LINE users
  const { data: lineUsers, isLoading: loadingUsers, refetch: refetchUsers } = trpc.line.listUsers.useQuery();
  
  // Fetch LINE groups
  const { data: lineGroups, isLoading: loadingGroups, refetch: refetchGroups } = trpc.line.listGroups.useQuery();
  
  // Fetch LINE messages
  const { data: lineMessages, isLoading: loadingMessages, refetch: refetchMessages } = trpc.line.listMessages.useQuery({
    lineUserId: selectedUser || undefined,
    limit: 50,
  });

  // Fetch brands for linking
  const { data: brands } = trpc.brand.list.useQuery();

  // Send message mutation
  const sendMessageMutation = trpc.line.sendMessage.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "メッセージを送信しました" : "消息已发送");
      setShowMessageDialog(false);
      setMessageText("");
      refetchMessages();
    },
    onError: () => {
      toast.error(language === "ja" ? "送信に失敗しました" : "发送失败");
    },
  });

  // Leave group mutation
  const leaveGroupMutation = trpc.line.leaveGroup.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "グループを退会しました" : "已退出群组");
      setShowLeaveGroupDialog(false);
      setLeavingGroupId(null);
      refetchGroups();
    },
    onError: () => {
      toast.error(language === "ja" ? "退会に失敗しました" : "退出失败");
    },
  });

  // Link user mutation
  const linkUserMutation = trpc.line.linkUser.useMutation({
    onSuccess: () => {
      toast.success(language === "ja" ? "紐付けを更新しました" : "关联已更新");
      setShowLinkDialog(false);
      setLinkingUser(null);
      setSelectedBrandId("");
      setSelectedUserType("");
      refetchUsers();
    },
    onError: () => {
      toast.error(language === "ja" ? "紐付けに失敗しました" : "关联失败");
    },
  });

  const handleSendMessage = async () => {
    if (!selectedUser || !messageText.trim()) return;
    
    setSendingMessage(true);
    try {
      await sendMessageMutation.mutateAsync({
        to: selectedUser,
        message: messageText.trim(),
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleLinkUser = async () => {
    if (!linkingUser) return;
    
    await linkUserMutation.mutateAsync({
      lineUserId: linkingUser.lineUserId,
      brandId: selectedBrandId ? parseInt(selectedBrandId) : null,
      userType: selectedUserType as "customer" | "staff" | "liver" | "unknown" || undefined,
    });
  };

  const openLinkDialog = (user: LineUser) => {
    setLinkingUser(user);
    setSelectedBrandId(user.brandId?.toString() || "");
    setSelectedUserType(user.userType || "");
    setShowLinkDialog(true);
  };

  // Filter users based on search
  const filteredUsers = lineUsers?.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(query) ||
      user.lineUserId.toLowerCase().includes(query)
    );
  });

  // Filter groups based on search
  const filteredGroups = lineGroups?.filter((group) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      group.groupName?.toLowerCase().includes(query) ||
      group.lineGroupId.toLowerCase().includes(query)
    );
  });

  // Get brand name by ID
  const getBrandName = (brandId: number | null) => {
    if (!brandId || !brands) return null;
    const brand = brands.find(b => b.id === brandId);
    return brand?.name || null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === "ja" ? "LINE管理" : "LINE管理"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ja" 
              ? "LINEユーザー・グループの管理とメッセージ履歴" 
              : "LINE用户、群组管理和消息记录"}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            refetchUsers();
            refetchGroups();
            refetchMessages();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === "ja" ? "更新" : "刷新"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "連携ユーザー" : "关联用户"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineUsers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "グループ" : "群组"}
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineGroups?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "ブランド紐付け済" : "已关联品牌"}
            </CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lineUsers?.filter(u => u.brandId).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ja" ? "メッセージ数" : "消息数"}
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lineMessages?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={language === "ja" ? "検索..." : "搜索..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {language === "ja" ? "ユーザー" : "用户"}
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {language === "ja" ? "グループ" : "群组"}
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {language === "ja" ? "メッセージ履歴" : "消息记录"}
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {loadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ja" ? "読み込み中..." : "加载中..."}
            </div>
          ) : filteredUsers?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "ja" 
                  ? "LINEユーザーがまだいません。ユーザーがBotを友だち追加すると表示されます。" 
                  : "还没有LINE用户。用户添加Bot为好友后会显示在这里。"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers?.map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {user.pictureUrl ? (
                          <img 
                            src={user.pictureUrl} 
                            alt={user.displayName || "User"} 
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base">
                            {user.displayName || user.lineUserId.slice(0, 8) + "..."}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {user.userType === "liver" 
                              ? (language === "ja" ? "ライバー" : "主播")
                              : user.userType === "customer"
                              ? (language === "ja" ? "顧客" : "客户")
                              : user.userType === "staff"
                              ? (language === "ja" ? "スタッフ" : "员工")
                              : (language === "ja" ? "未設定" : "未设置")}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={user.isBlocked ? "destructive" : "default"}>
                        {user.isBlocked 
                          ? (language === "ja" ? "ブロック" : "已屏蔽")
                          : (language === "ja" ? "アクティブ" : "活跃")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {language === "ja" ? "登録: " : "注册: "}
                        {format(new Date(user.createdAt), "yyyy/MM/dd")}
                      </div>
                      {user.lastMessageAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {language === "ja" ? "最終メッセージ: " : "最后消息: "}
                          {format(new Date(user.lastMessageAt), "yyyy/MM/dd HH:mm")}
                        </div>
                      )}
                      {user.brandId && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          {language === "ja" ? "ブランド: " : "品牌: "}
                          <span className="font-medium">{getBrandName(user.brandId)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openLinkDialog(user as LineUser)}
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        {language === "ja" ? "紐付け" : "关联"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(user.lineUserId);
                          setActiveTab("messages");
                        }}
                      >
                        <History className="h-3 w-3 mr-1" />
                        {language === "ja" ? "履歴" : "记录"}
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user.lineUserId);
                          setShowMessageDialog(true);
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {language === "ja" ? "送信" : "发送"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          {loadingGroups ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ja" ? "読み込み中..." : "加载中..."}
            </div>
          ) : filteredGroups?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "ja" 
                  ? "グループがまだありません。BotをLINEグループに招待すると表示されます。" 
                  : "还没有群组。将Bot邀请到LINE群组后会显示在这里。"}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGroups?.map((group) => (
                <Card key={group.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {group.pictureUrl ? (
                          <img 
                            src={group.pictureUrl} 
                            alt={group.groupName || "Group"} 
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base">
                            {group.groupName || group.lineGroupId.slice(0, 8) + "..."}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {language === "ja" ? "グループ" : "群组"}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={group.isActive ? "default" : "secondary"}>
                        {group.isActive 
                          ? (language === "ja" ? "アクティブ" : "活跃")
                          : (language === "ja" ? "非アクティブ" : "不活跃")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {language === "ja" ? "登録: " : "注册: "}
                        {format(new Date(group.createdAt), "yyyy/MM/dd")}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button 
                        size="sm"
                        onClick={() => {
                          setSelectedUser(group.lineGroupId);
                          setShowMessageDialog(true);
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        {language === "ja" ? "グループに送信" : "发送到群组"}
                      </Button>
                      <Button 
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setLeavingGroupId(group.lineGroupId);
                          setLeavingGroupName(group.groupName || group.lineGroupId.slice(0, 8) + "...");
                          setShowLeaveGroupDialog(true);
                        }}
                      >
                        <LogOut className="h-3 w-3 mr-1" />
                        {language === "ja" ? "退会" : "退出"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <Select 
              value={selectedUser || "all"} 
              onValueChange={(v) => setSelectedUser(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={language === "ja" ? "ユーザーを選択" : "选择用户"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === "ja" ? "すべてのメッセージ" : "所有消息"}
                </SelectItem>
                {lineUsers?.map((user) => (
                  <SelectItem key={user.lineUserId} value={user.lineUserId}>
                    {user.displayName || user.lineUserId.slice(0, 12) + "..."}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loadingMessages ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ja" ? "読み込み中..." : "加载中..."}
            </div>
          ) : lineMessages?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {language === "ja" 
                  ? "メッセージ履歴がありません" 
                  : "没有消息记录"}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {lineMessages?.map((msg) => (
                    <div 
                      key={msg.id}
                      className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                    >
                      <div 
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.direction === "outgoing" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.direction === "outgoing" 
                            ? "text-primary-foreground/70" 
                            : "text-muted-foreground"
                        }`}>
                          {format(new Date(msg.createdAt), "yyyy/MM/dd HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Send Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ja" ? "メッセージを送信" : "发送消息"}
            </DialogTitle>
            <DialogDescription>
              {language === "ja" 
                ? "LINEでメッセージを送信します" 
                : "通过LINE发送消息"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              className="w-full min-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={language === "ja" ? "メッセージを入力..." : "输入消息..."}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
              {language === "ja" ? "キャンセル" : "取消"}
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
            >
              {sendingMessage ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ja" ? "送信中..." : "发送中..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {language === "ja" ? "送信" : "发送"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link User Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ja" ? "ユーザー紐付け" : "用户关联"}
            </DialogTitle>
            <DialogDescription>
              {language === "ja" 
                ? "LINEユーザーをブランドやユーザータイプに紐付けます" 
                : "将LINE用户关联到品牌或用户类型"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              {linkingUser?.pictureUrl ? (
                <img 
                  src={linkingUser.pictureUrl} 
                  alt={linkingUser.displayName || "User"} 
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="font-medium">{linkingUser?.displayName || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{linkingUser?.lineUserId}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{language === "ja" ? "ユーザータイプ" : "用户类型"}</Label>
              <Select value={selectedUserType} onValueChange={setSelectedUserType}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ja" ? "タイプを選択" : "选择类型"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">{language === "ja" ? "未設定" : "未设置"}</SelectItem>
                  <SelectItem value="customer">{language === "ja" ? "顧客" : "客户"}</SelectItem>
                  <SelectItem value="liver">{language === "ja" ? "ライバー" : "主播"}</SelectItem>
                  <SelectItem value="staff">{language === "ja" ? "スタッフ" : "员工"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{language === "ja" ? "ブランド" : "品牌"}</Label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ja" ? "ブランドを選択" : "选择品牌"} />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              {language === "ja" ? "キャンセル" : "取消"}
            </Button>
            <Button 
              onClick={handleLinkUser}
              disabled={linkUserMutation.isPending}
            >
              {linkUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ja" ? "保存中..." : "保存中..."}
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  {language === "ja" ? "保存" : "保存"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Group Confirmation Dialog */}
      <Dialog open={showLeaveGroupDialog} onOpenChange={setShowLeaveGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {language === "ja" ? "グループ退会の確認" : "确认退出群组"}
            </DialogTitle>
            <DialogDescription>
              {language === "ja" 
                ? `「${leavingGroupName}」から退会しますか？この操作は取り消せません。再度参加するには、グループのメンバーから招待してもらう必要があります。`
                : `确定要退出「${leavingGroupName}」吗？此操作无法撤销。如需重新加入，需要群组成员重新邀请。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLeaveGroupDialog(false)}>
              {language === "ja" ? "キャンセル" : "取消"}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (leavingGroupId) {
                  leaveGroupMutation.mutate({ lineGroupId: leavingGroupId });
                }
              }}
              disabled={leaveGroupMutation.isPending}
            >
              {leaveGroupMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {language === "ja" ? "退会中..." : "退出中..."}
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  {language === "ja" ? "退会する" : "退出"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
