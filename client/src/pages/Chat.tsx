import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MessageCircle, Send, Plus, Users, Image as ImageIcon, Paperclip, FileText,
  Search, X, Edit2, UserPlus, ArrowLeft, Loader2, Check, User,
  Bold, Italic, Strikethrough, UnderlineIcon, List, ListOrdered,
  Quote, Code, Link as LinkIcon, Maximize2, Minimize2, Languages
} from "lucide-react";

// ===== JST Time Formatter =====
const formatTimeJST = (dateStr: string) => {
  if (!dateStr) return "";
  // Server stores times in JST but without timezone info
  // Append +09:00 to ensure correct parsing
  let d: Date;
  if (dateStr.includes("T") || dateStr.includes("Z") || dateStr.includes("+")) {
    d = new Date(dateStr);
  } else {
    // Format: "2026-05-27 05:31:47" - treat as JST
    d = new Date(dateStr.replace(" ", "T") + "+09:00");
  }
  if (isNaN(d.getTime())) return dateStr;
  
  const now = new Date();
  const jstFormatter = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  const jstDateFormatter = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" });
  const jstDayFormatter = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short" });
  
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "今";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return jstFormatter.format(d);
  if (diff < 604800000) return jstDayFormatter.format(d);
  return jstDateFormatter.format(d);
};

// ===== Rich Text Toolbar Component =====
function RichTextToolbar({ textareaRef, onFormat }: { textareaRef: React.RefObject<HTMLDivElement | null>; onFormat: (tag: string) => void }) {
  const btnClass = "p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground";
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      <button type="button" className={btnClass} onClick={() => onFormat("bold")} title="太字"><Bold className="h-3.5 w-3.5" /></button>
      <button type="button" className={btnClass} onClick={() => onFormat("italic")} title="斜体"><Italic className="h-3.5 w-3.5" /></button>
      <button type="button" className={btnClass} onClick={() => onFormat("underline")} title="下線"><UnderlineIcon className="h-3.5 w-3.5" /></button>
      <button type="button" className={btnClass} onClick={() => onFormat("strikethrough")} title="取消線"><Strikethrough className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" className={btnClass} onClick={() => onFormat("ul")} title="箇条書き"><List className="h-3.5 w-3.5" /></button>
      <button type="button" className={btnClass} onClick={() => onFormat("ol")} title="番号付きリスト"><ListOrdered className="h-3.5 w-3.5" /></button>
      <button type="button" className={btnClass} onClick={() => onFormat("blockquote")} title="引用"><Quote className="h-3.5 w-3.5" /></button>
      <button type="button" className={btnClass} onClick={() => onFormat("code")} title="コード"><Code className="h-3.5 w-3.5" /></button>
      <div className="w-px h-4 bg-border mx-1" />
      <button type="button" className={btnClass} onClick={() => onFormat("link")} title="リンク"><LinkIcon className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// ===== Translation Popup Component =====
function TranslationPopup({ text, onClose, onUse }: { text: string; onClose: () => void; onUse: (translated: string) => void }) {
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(true);
  const [targetLang, setTargetLang] = useState("ja");
  
  const translateMutation = trpc.chat.translateText.useMutation({
    onSuccess: (data: any) => {
      setTranslated(data.translated || "");
      setLoading(false);
    },
    onError: () => {
      setTranslated("翻訳に失敗しました");
      setLoading(false);
    }
  });
  
  useEffect(() => {
    if (text) {
      setLoading(true);
      translateMutation.mutate({ text, targetLang });
    }
  }, [text, targetLang]);
  
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg p-3 z-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-blue-500" />
          <span className="text-xs font-medium">翻訳</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="text-xs border rounded px-1.5 py-0.5 bg-background"
          >
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> 翻訳中...
        </div>
      ) : (
        <div>
          <p className="text-sm bg-accent/50 rounded p-2 mb-2">{translated}</p>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onUse(translated)}>
            使用
          </Button>
        </div>
      )}
    </div>
  );
}

// ===== Message Translation Button =====
function MessageTranslateButton({ content }: { content: string }) {
  const [show, setShow] = useState(false);
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetLang, setTargetLang] = useState("ja");
  
  const translateMutation = trpc.chat.translateText.useMutation({
    onSuccess: (data: any) => {
      setTranslated(data.translated || "");
      setLoading(false);
    },
    onError: () => {
      setTranslated("翻訳に失敗しました");
      setLoading(false);
    }
  });
  
  const handleTranslate = (lang: string) => {
    setTargetLang(lang);
    setLoading(true);
    setShow(true);
    translateMutation.mutate({ text: content, targetLang: lang });
  };
  
  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1 mt-0.5">
        {!show ? (
          <div className="flex gap-0.5">
            <button onClick={() => handleTranslate("ja")} className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline px-1">ja</button>
            <button onClick={() => handleTranslate("zh")} className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline px-1">中</button>
            <button onClick={() => handleTranslate("en")} className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline px-1">en</button>
          </div>
        ) : loading ? (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" />翻訳中...</span>
        ) : (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1 text-xs max-w-xs">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="text-[10px] text-blue-500 font-medium">{targetLang === "ja" ? "日本語" : targetLang === "zh" ? "中文" : "English"}</span>
              <button onClick={() => setShow(false)} className="text-muted-foreground hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
            </div>
            <p className="text-foreground">{translated}</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [showMemberList, setShowMemberList] = useState(false);
  // New states for rich text & translation
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [liveTranslate, setLiveTranslate] = useState(false);
  const [liveTranslatedText, setLiveTranslatedText] = useState("");
  const [liveTranslateTimer, setLiveTranslateTimer] = useState<any>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: myInfo } = trpc.chat.getMyInfo.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: rooms, refetch: refetchRooms } = trpc.chat.getRooms.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: messages, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { roomId: selectedRoomId! },
    { enabled: !!selectedRoomId, refetchInterval: 3000 }
  );
  const { data: roomDetail } = trpc.chat.getRoomDetail.useQuery(
    { roomId: selectedRoomId! },
    { enabled: !!selectedRoomId }
  );
  const { data: searchResults } = trpc.chat.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: showNewChat || showAddMembers }
  );
  
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      setLiveTranslatedText("");
      refetchMessages();
      refetchRooms();
    },
    onError: (err: any) => toast.error(err.message || "送信に失敗しました"),
  });
  const createRoom = trpc.chat.createRoom.useMutation({
    onSuccess: (data: any) => {
      setShowNewChat(false);
      setSelectedMembers([]);
      setNewGroupName("");
      setSearchQuery("");
      refetchRooms();
      if (data?.roomId) {
        setSelectedRoomId(data.roomId);
        setMobileShowMessages(true);
      }
      toast.success("チャットを作成しました");
    },
    onError: (err: any) => toast.error(err.message || "作成に失敗しました"),
  });
  const addMembers = trpc.chat.addMembers.useMutation({
    onSuccess: () => {
      setShowAddMembers(false);
      setSelectedMembers([]);
      setSearchQuery("");
      toast.success("メンバーを追加しました");
    },
    onError: (err: any) => toast.error(err.message || "追加に失敗しました"),
  });
  const updateRoom = trpc.chat.updateRoom.useMutation({
    onSuccess: () => {
      setShowEditName(false);
      refetchRooms();
      toast.success("グループ名を変更しました");
    },
    onError: (err: any) => toast.error(err.message || "変更に失敗しました"),
  });
  
  // Live translate mutation
  const liveTranslateMutation = trpc.chat.translateText.useMutation({
    onSuccess: (data: any) => {
      setLiveTranslatedText(data.translated || "");
    },
    onError: () => {
      setLiveTranslatedText("");
    }
  });
  
  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Send message handler - supports both plain text and rich text
  const handleSend = useCallback(() => {
    let content = "";
    if (editorRef.current) {
      // Get HTML content from contentEditable
      const html = editorRef.current.innerHTML;
      // If it's just plain text (no HTML tags), send as plain text
      const stripped = html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
      if (html.includes("<b>") || html.includes("<i>") || html.includes("<u>") || html.includes("<s>") || 
          html.includes("<ul>") || html.includes("<ol>") || html.includes("<blockquote>") || 
          html.includes("<code>") || html.includes("<a ")) {
        content = html;
      } else {
        content = stripped;
      }
    } else {
      content = messageText.trim();
    }
    if (!content || !selectedRoomId) return;
    sendMessage.mutate({ roomId: selectedRoomId, content, messageType: "text" });
  }, [messageText, selectedRoomId, sendMessage]);
  
  // Rich text formatting
  const handleFormat = useCallback((tag: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    switch (tag) {
      case "bold": document.execCommand("bold"); break;
      case "italic": document.execCommand("italic"); break;
      case "underline": document.execCommand("underline"); break;
      case "strikethrough": document.execCommand("strikeThrough"); break;
      case "ul": document.execCommand("insertUnorderedList"); break;
      case "ol": document.execCommand("insertOrderedList"); break;
      case "blockquote": document.execCommand("formatBlock", false, "blockquote"); break;
      case "code": {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const code = document.createElement("code");
          code.className = "bg-muted px-1 py-0.5 rounded text-sm font-mono";
          range.surroundContents(code);
        }
        break;
      }
      case "link": {
        const url = prompt("URLを入力してください:", "https://");
        if (url) document.execCommand("createLink", false, url);
        break;
      }
    }
  }, []);
  
  // Live translate - debounced
  const handleEditorInput = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText.trim();
    setMessageText(text);
    
    if (liveTranslate && text.length > 0) {
      if (liveTranslateTimer) clearTimeout(liveTranslateTimer);
      const timer = setTimeout(() => {
        liveTranslateMutation.mutate({ text, targetLang: "ja" });
      }, 800);
      setLiveTranslateTimer(timer);
    } else {
      setLiveTranslatedText("");
    }
  }, [liveTranslate, liveTranslateTimer]);
  
  // File upload handler (images, PDF, text files)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoomId) return;
    const allowedTypes = ["image/", "application/pdf", "text/", "application/json"];
    const isAllowed = allowedTypes.some(t => file.type.startsWith(t));
    if (!isAllowed) {
      toast.error("画像、PDF、テキストファイルのみアップロードできます");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("ファイルサイズは10MB以下にしてください");
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
      if (data.type === "image") {
        sendMessage.mutate({
          roomId: selectedRoomId,
          content: "[画像]",
          messageType: "image",
          fileUrl: data.url,
          fileName: data.fileName,
        });
      } else {
        sendMessage.mutate({
          roomId: selectedRoomId,
          content: `[ファイル] ${data.fileName}`,
          messageType: "file",
          fileUrl: data.url || "",
          fileName: data.fileName,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "アップロードに失敗しました");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  
  // Room display name
  const getRoomDisplayName = (room: any) => {
    if (!room) return "チャット";
    if (room.name) return room.name;
    if (room.type === "direct" && roomDetail?.members && selectedRoomId === room.id) {
      const otherMember = (roomDetail.members as any[]).find((m: any) => !(m.userId === myInfo?.id && m.userType === myInfo?.userType));
      if (otherMember) return otherMember.userName || "ダイレクトメッセージ";
    }
    return "ダイレクトメッセージ";
  };
  
  const selectedRoom = rooms?.find((r: any) => r.id === selectedRoomId);
  
  // Render user list for member selection
  const renderUserList = (users: any[], type: "staff" | "liver", label: string) => {
    if (!users || users.length === 0) return null;
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground px-2 py-1">{label}</p>
        {users.map((u: any) => {
          const isSelected = selectedMembers.some(m => m.userId === u.id && m.userType === type);
          return (
            <button
              key={`${type}-${u.id}`}
              onClick={() => {
                if (isSelected) {
                  setSelectedMembers(prev => prev.filter(m => !(m.userId === u.id && m.userType === type)));
                } else {
                  setSelectedMembers(prev => [...prev, { userId: u.id, userType: type, userName: u.name, userAvatar: u.avatarUrl }]);
                }
              }}
              className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors ${isSelected ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-accent/50"}`}
            >
              <Avatar className="h-8 w-8">
                {u.avatarUrl ? <AvatarImage src={u.avatarUrl} /> : null}
                <AvatarFallback className={`text-xs ${type === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {(u.name || "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm truncate flex-1">{u.name || "不明"}</span>
              {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          );
        })}
      </>
    );
  };
  
  // Render message content - supports HTML rich text
  const renderMessageContent = (msg: any, isMe: boolean) => {
    const content = msg.content || "";
    const hasHtml = /<[a-z][\s\S]*>/i.test(content) && (
      content.includes("<b>") || content.includes("<i>") || content.includes("<u>") || 
      content.includes("<s>") || content.includes("<ul>") || content.includes("<ol>") || 
      content.includes("<blockquote>") || content.includes("<code>") || content.includes("<a ")
    );
    
    return (
      <div className={`mt-0.5 inline-block rounded-lg px-3 py-1.5 text-sm ${isMe ? "bg-green-500 text-white" : "bg-muted"}`}>
        {hasHtml ? (
          <div 
            className="prose prose-sm max-w-none break-words text-left [&_a]:text-blue-400 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:opacity-80 [&_code]:bg-black/10 [&_code]:px-1 [&_code]:rounded [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <p className="whitespace-pre-wrap break-words text-left">{content}</p>
        )}
      </div>
    );
  };
  
  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Left Panel - Room List */}
      <div className={`w-80 border-r flex flex-col shrink-0 ${mobileShowMessages ? "hidden md:flex" : "flex"} ${!selectedRoomId ? "flex-1 md:flex-none" : ""}`}>
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            チャット
          </h2>
          <Button size="sm" onClick={() => { setShowNewChat(true); setSelectedMembers([]); setSearchQuery(""); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> 新規
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
                          {formatTimeJST(room.lastMessageAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        {room.lastMessage ? (
                          <><span className="font-medium">{room.lastSenderName}: </span>{room.lastMessage.replace(/<[^>]+>/g, "")}</>
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
      <div className={`flex-1 flex flex-col ${!mobileShowMessages && selectedRoomId ? "hidden md:flex" : !selectedRoomId ? "hidden md:flex" : "flex"}`}>
        {!selectedRoomId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">チャットを選択してください</p>
              <p className="text-sm mt-1">左のリストからチャットを選択するか、新規チャットを作成してください</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => { setMobileShowMessages(false); }}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className={selectedRoom?.type === "group" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                    {selectedRoom?.type === "group" ? <Users className="h-3.5 w-3.5" /> : (getRoomDisplayName(selectedRoom) || "?").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{getRoomDisplayName(selectedRoom)}</p>
                  {selectedRoom?.type === "group" && roomDetail?.members && (
                    <p className="text-[10px] text-muted-foreground">{(roomDetail.members as any[]).length}人のメンバー</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {selectedRoom?.type === "group" && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => setShowMemberList(true)} title="メンバー一覧">
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setShowAddMembers(true); setSelectedMembers([]); setSearchQuery(""); }} title="メンバー追加">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setShowEditName(true); setEditRoomName(selectedRoom?.name || ""); }} title="グループ名変更">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {!messages || (messages as any[]).length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">メッセージがありません</p>
                    <p className="text-xs mt-1">最初のメッセージを送信しましょう</p>
                  </div>
                ) : (
                  (messages as any[]).map((msg: any) => {
                    const isMe = myInfo && msg.senderId === myInfo.id && msg.senderType === myInfo.userType;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} group`}>
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarFallback className="text-[10px] bg-muted">
                            {(msg.senderName || "?").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex-1 min-w-0 ${isMe ? "text-right" : ""}`}>
                          <div className={`flex items-baseline gap-2 ${isMe ? "justify-end" : ""}`}>
                            <span className="text-xs font-medium">{msg.senderName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {msg.createdAt ? formatTimeJST(msg.createdAt) : ""}
                            </span>
                          </div>
                          {msg.messageType === "image" && msg.fileUrl ? (
                            <div className={`mt-1 ${isMe ? "flex justify-end" : ""}`}>
                              <img
                                src={msg.fileUrl}
                                alt={msg.fileName || "画像"}
                                className="max-w-xs max-h-60 rounded-lg border cursor-pointer hover:opacity-90"
                                onClick={() => window.open(msg.fileUrl, "_blank")}
                              />
                            </div>
                          ) : msg.messageType === "file" && msg.fileUrl ? (
                            <div className={`mt-0.5 inline-block rounded-lg px-3 py-2 text-sm ${isMe ? "bg-green-500 text-white" : "bg-muted"} cursor-pointer hover:opacity-80`}
                              onClick={() => window.open(msg.fileUrl, "_blank")}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="break-all">{msg.fileName || "ファイル"}</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              {renderMessageContent(msg, !!isMe)}
                              {/* Translation buttons - visible on hover */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <MessageTranslateButton content={msg.content || ""} />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            {/* Input Area - Rich Text */}
            <div className={`border-t ${isExpanded ? "p-4" : "p-3"}`}>
              {/* Live Translation Preview */}
              {liveTranslate && liveTranslatedText && (
                <div className="mb-2 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2">
                  <span className="text-xs text-blue-500 font-medium shrink-0">ja</span>
                  <p className="text-sm flex-1">{liveTranslatedText}</p>
                  <Button size="sm" variant="ghost" className="text-xs h-6 text-blue-500" onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.innerText = liveTranslatedText;
                      setMessageText(liveTranslatedText);
                    }
                  }}>
                    使用
                  </Button>
                </div>
              )}
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-2">
                <RichTextToolbar textareaRef={editorRef} onFormat={handleFormat} />
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setLiveTranslate(!liveTranslate)}
                          className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${liveTranslate ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                        >
                          <Languages className="h-3.5 w-3.5" />
                          <span className="text-[10px]">边写边译</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>中国語→日本語のリアルタイム翻訳</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    title={isExpanded ? "縮小" : "拡大"}
                  >
                    {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.txt,.json,.csv,.md"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="ファイルを送信（画像・PDF・テキスト）"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={handleEditorInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  data-placeholder="メッセージを入力..."
                  className={`flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring overflow-y-auto
                    empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none
                    [&_b]:font-bold [&_i]:italic [&_u]:underline [&_s]:line-through
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                    [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:opacity-80
                    [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
                    [&_a]:text-blue-500 [&_a]:underline
                    ${isExpanded ? "min-h-[200px] max-h-[400px]" : "min-h-[38px] max-h-32"}`}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={sendMessage.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-right">Shift + Enter 换行</p>
            </div>
          </>
        )}
      </div>
      {/* New Chat Dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>新規チャット</DialogTitle>
          </DialogHeader>
          <Tabs value={chatType} onValueChange={(v) => { setChatType(v as "direct" | "group"); setSelectedMembers([]); }} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 shrink-0">
              <TabsTrigger value="group">グループ</TabsTrigger>
              <TabsTrigger value="direct">ダイレクト</TabsTrigger>
            </TabsList>
            <TabsContent value="group" className="flex-1 flex flex-col min-h-0 mt-3">
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="グループ名"
                className="shrink-0 mb-3"
              />
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="名前で絞り込み..." className="pl-9" />
              </div>
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 shrink-0">
                  {selectedMembers.map(m => (
                    <Badge key={`${m.userType}-${m.userId}`} variant="secondary" className="gap-1 pr-1">
                      {m.userName || "不明"}
                      <button onClick={() => setSelectedMembers(prev => prev.filter(p => !(p.userId === m.userId && p.userType === m.userType)))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex-1 min-h-0 border rounded-md bg-background overflow-hidden mt-2">
                <ScrollArea className="h-full" style={{ maxHeight: "35vh" }}>
                  {searchResults ? (
                    <div className="space-y-1 p-2">
                      {renderUserList(searchResults.staff as any[], "staff", "スタッフ")}
                      {renderUserList(searchResults.livers as any[], "liver", "ライバー")}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value="direct" className="flex-1 flex flex-col min-h-0 mt-3">
              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="名前で絞り込み..." className="pl-9" />
              </div>
              <div className="flex-1 min-h-0 border rounded-md bg-background overflow-hidden mt-2">
                <ScrollArea className="h-full" style={{ maxHeight: "40vh" }}>
                  {searchResults ? (
                    <div className="space-y-1 p-2">
                      {renderUserList(searchResults.staff as any[], "staff", "スタッフ")}
                      {renderUserList(searchResults.livers as any[], "liver", "ライバー")}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter className="shrink-0 mt-3 pt-3 border-t">
            <Button variant="outline" onClick={() => setShowNewChat(false)}>キャンセル</Button>
            <Button
              onClick={() => {
                if (chatType === "group") {
                  if (!newGroupName.trim()) { toast.error("グループ名を入力してください"); return; }
                  if (selectedMembers.length === 0) { toast.error("メンバーを選択してください"); return; }
                  createRoom.mutate({ name: newGroupName.trim(), type: "group", members: selectedMembers });
                } else {
                  if (selectedMembers.length !== 1) { toast.error("1人のメンバーを選択してください"); return; }
                  createRoom.mutate({ type: "direct", members: selectedMembers });
                }
              }}
              disabled={createRoom.isPending}
            >
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Members Dialog */}
      <Dialog open={showAddMembers} onOpenChange={setShowAddMembers}>
        <DialogContent className="sm:max-w-md max-h-[70vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>メンバー追加</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {selectedMembers.map(m => (
                  <Badge key={`${m.userType}-${m.userId}`} variant="secondary" className="gap-1 pr-1">
                    {m.userName || "不明"}
                    <button onClick={() => setSelectedMembers(prev => prev.filter(p => !(p.userId === m.userId && p.userType === m.userType)))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="名前で絞り込み..." className="pl-9" />
            </div>
            <div className="flex-1 min-h-0 border rounded-md bg-background overflow-hidden">
              <ScrollArea className="h-full" style={{ maxHeight: "35vh" }}>
                {searchResults ? (
                  <div className="space-y-1 p-2">
                    {renderUserList(searchResults.staff as any[], "staff", "スタッフ")}
                    {renderUserList(searchResults.livers as any[], "liver", "ライバー")}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="shrink-0 mt-3 pt-3 border-t">
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
      {/* Member List Dialog */}
      <Dialog open={showMemberList} onOpenChange={setShowMemberList}>
        <DialogContent className="sm:max-w-sm max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              メンバー一覧
              <Badge variant="secondary" className="ml-1">{roomDetail?.members?.length || 0}人</Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "50vh" }}>
            <div className="space-y-1">
              {roomDetail?.members?.map((member: any) => {
                const isSelf = myInfo && member.userId === myInfo.id && member.userType === myInfo.userType;
                return (
                  <div
                    key={`${member.userType}-${member.userId}`}
                    className="flex items-center gap-3 p-2.5 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <Avatar className="h-9 w-9">
                      {member.userAvatar ? <AvatarImage src={member.userAvatar} /> : null}
                      <AvatarFallback className={`text-xs ${member.userType === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {(member.userName || "?").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.userName || "不明"}
                        {isSelf && <span className="text-xs text-muted-foreground ml-1">(自分)</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {member.userType === 'staff' ? 'スタッフ' : 'ライバー'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMemberList(false)} className="w-full">閉じる</Button>
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
