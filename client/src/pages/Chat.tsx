import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  MessageCircle, Send, Plus, Users, Image as ImageIcon,
  Search, X, Edit2, UserPlus, ArrowLeft, Loader2, Check
} from "lucide-react";

export default function Chat() {
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [editRoomName, setEditRoomName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Array<{ userId: number; userType: "staff" | "liver"; userName?: string; userAvatar?: string }>>([]);
  const [chatType, setChatType] = useState<"direct" | "group">("group");
  const [uploading, setUploading] = useState(false);
  const [mobileShowMessages, setMobileShowMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data fetching
  const { data: rooms, refetch: refetchRooms } = trpc.chat.getRooms.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const { data: messages, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { roomId: selectedRoomId! },
    { enabled: !!selectedRoomId, refetchInterval: 5000 }
  );
  const { data: roomDetail } = trpc.chat.getRoomDetail.useQuery(
    { roomId: selectedRoomId! },
    { enabled: !!selectedRoomId }
  );
  const { data: searchResults } = trpc.chat.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: showNewChat || showAddMembers }
  );

  // Mutations
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      refetchMessages();
      refetchRooms();
    },
    onError: (err) => toast.error("送信失敗: " + err.message),
  });
  const createRoom = trpc.chat.createRoom.useMutation({
    onSuccess: (data) => {
      setSelectedRoomId(data.roomId);
      setShowNewChat(false);
      setSelectedMembers([]);
      setNewGroupName("");
      setSearchQuery("");
      refetchRooms();
      if (data.existing) {
        toast.info("既存のチャットを開きました");
      } else {
        toast.success("チャットを作成しました");
      }
    },
    onError: (err) => toast.error("作成失敗: " + err.message),
  });
  const addMembers = trpc.chat.addMembers.useMutation({
    onSuccess: () => {
      setShowAddMembers(false);
      setSelectedMembers([]);
      setSearchQuery("");
      toast.success("メンバーを追加しました");
    },
    onError: (err) => toast.error("追加失敗: " + err.message),
  });
  const updateRoom = trpc.chat.updateRoom.useMutation({
    onSuccess: () => {
      setShowEditName(false);
      refetchRooms();
      toast.success("ルーム名を変更しました");
    },
    onError: (err) => toast.error("変更失敗: " + err.message),
  });

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message handler
  const handleSend = useCallback(() => {
    if (!messageText.trim() || !selectedRoomId) return;
    sendMessage.mutate({ roomId: selectedRoomId, content: messageText.trim(), messageType: "text" });
  }, [messageText, selectedRoomId, sendMessage]);

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoomId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルのみアップロードできます");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chat-file-upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      sendMessage.mutate({
        roomId: selectedRoomId,
        content: "[画像]",
        messageType: "image",
        fileUrl: data.url,
        fileName: data.fileName,
      });
    } catch (err: any) {
      toast.error("画像アップロード失敗: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Create room handler
  const handleCreateRoom = () => {
    if (selectedMembers.length === 0) {
      toast.error("メンバーを選択してください");
      return;
    }
    if (chatType === "group" && !newGroupName.trim()) {
      toast.error("グループ名を入力してください");
      return;
    }
    createRoom.mutate({
      type: chatType,
      name: chatType === "group" ? newGroupName.trim() : undefined,
      memberIds: selectedMembers,
    });
  };

  // Toggle member selection
  const toggleMember = (user: { id: number; name: string; email?: string; avatarUrl?: string; userType: string }) => {
    const exists = selectedMembers.find((m) => m.userId === user.id && m.userType === user.userType);
    if (exists) {
      setSelectedMembers(selectedMembers.filter((m) => !(m.userId === user.id && m.userType === user.userType)));
    } else {
      setSelectedMembers([...selectedMembers, {
        userId: user.id,
        userType: user.userType as "staff" | "liver",
        userName: user.name || user.email || "",
        userAvatar: user.avatarUrl || undefined,
      }]);
    }
  };

  // Format time
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "今";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    if (diff < 86400000) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (diff < 604800000) return `${["日", "月", "火", "水", "木", "金", "土"][d.getDay()]}曜`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const selectedRoom = rooms?.find((r: any) => r.id === selectedRoomId);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Left Panel - Room List */}
      <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${mobileShowMessages ? "hidden md:flex" : "flex"}`}>
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            チャット
          </h1>
          <Button size="sm" onClick={() => setShowNewChat(true)} className="gap-1">
            <Plus className="h-4 w-4" /> 新規
          </Button>
        </div>

        {/* Room List */}
        <ScrollArea className="flex-1">
          {(!rooms || rooms.length === 0) ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">チャットがありません</p>
              <p className="text-xs mt-1">「新規」ボタンからチャットを始めましょう</p>
            </div>
          ) : (
            <div className="divide-y">
              {(rooms as any[]).map((room: any) => (
                <button
                  key={room.id}
                  onClick={() => { setSelectedRoomId(room.id); setMobileShowMessages(true); }}
                  className={`w-full p-3 flex items-start gap-3 hover:bg-accent/50 transition-colors text-left ${selectedRoomId === room.id ? "bg-accent" : ""}`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {room.avatarUrl ? <AvatarImage src={room.avatarUrl} /> : null}
                    <AvatarFallback className={room.type === "group" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                      {room.type === "group" ? <Users className="h-4 w-4" /> : (room.name || "?").charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">
                        {room.name || "ダイレクトメッセージ"}
                      </span>
                      {room.lastMessageAt && (
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatTime(room.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {room.lastMessage ? (
                          <>{room.lastSenderName && <span className="font-medium">{room.lastSenderName}: </span>}{room.lastMessage}</>
                        ) : (
                          "メッセージなし"
                        )}
                      </p>
                      {Number(room.unreadCount) > 0 && (
                        <Badge variant="default" className="ml-2 h-5 min-w-5 flex items-center justify-center rounded-full bg-green-500 text-white text-[10px] px-1.5">
                          {room.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Messages */}
      <div className={`flex-1 flex flex-col ${!mobileShowMessages ? "hidden md:flex" : "flex"}`}>
        {!selectedRoomId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">チャットを選択してください</p>
              <p className="text-sm mt-1">左のリストからチャットを選択するか、新規チャットを作成してください</p>
            </div>
          </div>
        ) : (
          <>
            {/* Message Header */}
            <div className="p-3 border-b flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileShowMessages(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className={selectedRoom?.type === "group" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                  {selectedRoom?.type === "group" ? <Users className="h-3 w-3" /> : (selectedRoom?.name || "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-medium text-sm truncate">{selectedRoom?.name || "ダイレクトメッセージ"}</h2>
                <p className="text-xs text-muted-foreground">
                  {roomDetail?.members?.length || 0}人のメンバー
                </p>
              </div>
              <div className="flex items-center gap-1">
                {selectedRoom?.type === "group" && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => { setEditRoomName(selectedRoom?.name || ""); setShowEditName(true); }} title="グループ名変更">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedMembers([]); setSearchQuery(""); setShowAddMembers(true); }} title="メンバー追加">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {(!messages || messages.length === 0) ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">メッセージがありません</p>
                    <p className="text-xs mt-1">最初のメッセージを送信しましょう</p>
                  </div>
                ) : (
                  (messages as any[]).map((msg: any) => (
                    <div key={msg.id} className="flex gap-2">
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {(msg.senderName || "?").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-medium">{msg.senderName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {msg.createdAt ? formatTime(msg.createdAt) : ""}
                          </span>
                        </div>
                        {msg.messageType === "image" && msg.fileUrl ? (
                          <div className="mt-1">
                            <img
                              src={msg.fileUrl}
                              alt={msg.fileName || "画像"}
                              className="max-w-xs max-h-60 rounded-lg border cursor-pointer hover:opacity-90"
                              onClick={() => window.open(msg.fileUrl, "_blank")}
                            />
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words mt-0.5">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 border-t">
              <div className="flex items-end gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="画像を送信"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                </Button>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="メッセージを入力..."
                  className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm min-h-[38px] max-h-32 focus:outline-none focus:ring-2 focus:ring-ring"
                  rows={1}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMessage.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新しいチャット</DialogTitle>
          </DialogHeader>
          <Tabs value={chatType} onValueChange={(v) => setChatType(v as "direct" | "group")}>
            <TabsList className="w-full">
              <TabsTrigger value="direct" className="flex-1">1対1</TabsTrigger>
              <TabsTrigger value="group" className="flex-1">グループ</TabsTrigger>
            </TabsList>
            <TabsContent value="direct" className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">相手を1人選択してください</p>
            </TabsContent>
            <TabsContent value="group" className="mt-3">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="グループ名を入力"
                className="mb-2"
              />
              <p className="text-xs text-muted-foreground mb-2">メンバーを選択してください（複数可）</p>
            </TabsContent>
          </Tabs>

          {/* Selected members */}
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedMembers.map((m) => (
                <Badge key={`${m.userType}-${m.userId}`} variant="secondary" className="gap-1 pr-1">
                  {m.userName}
                  <button onClick={() => setSelectedMembers(selectedMembers.filter((x) => !(x.userId === m.userId && x.userType === m.userType)))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前で検索..."
              className="pl-9"
            />
          </div>

          {/* User List */}
          <ScrollArea className="h-60 mt-2">
            {searchResults && (
              <div className="space-y-1">
                {(searchResults.staff as any[]).length > 0 && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">スタッフ</p>
                    {(searchResults.staff as any[]).map((user: any) => {
                      const isSelected = selectedMembers.some((m) => m.userId === user.id && m.userType === "staff");
                      return (
                        <button
                          key={`staff-${user.id}`}
                          onClick={() => toggleMember({ ...user, userType: "staff" })}
                          className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                          disabled={chatType === "direct" && selectedMembers.length >= 1 && !isSelected}
                        >
                          <Avatar className="h-7 w-7">
                            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                            <AvatarFallback className="text-[10px]">{(user.name || "?").charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm truncate">{user.name || user.email}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-green-500" />}
                        </button>
                      );
                    })}
                  </>
                )}
                {(searchResults.livers as any[]).length > 0 && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1 mt-2">ライバー</p>
                    {(searchResults.livers as any[]).map((user: any) => {
                      const isSelected = selectedMembers.some((m) => m.userId === user.id && m.userType === "liver");
                      return (
                        <button
                          key={`liver-${user.id}`}
                          onClick={() => toggleMember({ ...user, userType: "liver" })}
                          className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                          disabled={chatType === "direct" && selectedMembers.length >= 1 && !isSelected}
                        >
                          <Avatar className="h-7 w-7">
                            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                            <AvatarFallback className="text-[10px]">{(user.name || "?").charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm truncate">{user.name || user.email}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-green-500" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewChat(false)}>キャンセル</Button>
            <Button onClick={handleCreateRoom} disabled={createRoom.isPending || selectedMembers.length === 0}>
              {createRoom.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={showAddMembers} onOpenChange={setShowAddMembers}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>メンバー追加</DialogTitle>
          </DialogHeader>
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {selectedMembers.map((m) => (
                <Badge key={`${m.userType}-${m.userId}`} variant="secondary" className="gap-1 pr-1">
                  {m.userName}
                  <button onClick={() => setSelectedMembers(selectedMembers.filter((x) => !(x.userId === m.userId && x.userType === m.userType)))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="名前で検索..." className="pl-9" />
          </div>
          <ScrollArea className="h-60 mt-2">
            {searchResults && (
              <div className="space-y-1">
                {(searchResults.staff as any[]).map((user: any) => {
                  const isSelected = selectedMembers.some((m) => m.userId === user.id && m.userType === "staff");
                  return (
                    <button
                      key={`staff-${user.id}`}
                      onClick={() => toggleMember({ ...user, userType: "staff" })}
                      className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                    >
                      <Avatar className="h-7 w-7">
                        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                        <AvatarFallback className="text-[10px]">{(user.name || "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{user.name || user.email}</span>
                      {isSelected && <Check className="h-4 w-4 text-green-500 ml-auto" />}
                    </button>
                  );
                })}
                {(searchResults.livers as any[]).map((user: any) => {
                  const isSelected = selectedMembers.some((m) => m.userId === user.id && m.userType === "liver");
                  return (
                    <button
                      key={`liver-${user.id}`}
                      onClick={() => toggleMember({ ...user, userType: "liver" })}
                      className={`w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 ${isSelected ? "bg-accent" : ""}`}
                    >
                      <Avatar className="h-7 w-7">
                        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                        <AvatarFallback className="text-[10px]">{(user.name || "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{user.name || user.email}</span>
                      {isSelected && <Check className="h-4 w-4 text-green-500 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMembers(false)}>キャンセル</Button>
            <Button
              onClick={() => {
                if (selectedRoomId && selectedMembers.length > 0) {
                  addMembers.mutate({ roomId: selectedRoomId, members: selectedMembers });
                }
              }}
              disabled={addMembers.isPending || selectedMembers.length === 0}
            >
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Name Dialog */}
      <Dialog open={showEditName} onOpenChange={setShowEditName}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>グループ名変更</DialogTitle>
          </DialogHeader>
          <Input
            value={editRoomName}
            onChange={(e) => setEditRoomName(e.target.value)}
            placeholder="新しいグループ名"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditName(false)}>キャンセル</Button>
            <Button
              onClick={() => {
                if (selectedRoomId && editRoomName.trim()) {
                  updateRoom.mutate({ roomId: selectedRoomId, name: editRoomName.trim() });
                }
              }}
              disabled={updateRoom.isPending || !editRoomName.trim()}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
