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
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  MessageCircle, Send, Plus, Users, Image as ImageIcon, Paperclip, FileText,
  Search, X, Edit2, UserPlus, ArrowLeft, Loader2, Check, User,
  Bold, Italic, Strikethrough, UnderlineIcon, List, ListOrdered,
  Quote, Code, Link as LinkIcon, Maximize2, Minimize2, Languages, Copy, Share2, Link2,
  Camera, FolderOpen, ImagePlus, Trash2, UserMinus, Video, AtSign, Play
} from "lucide-react";
import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";

// ===== Rich Text Editor Toolbar =====
function EditorToolbar({ editor, isExpanded, onToggleExpand }: { editor: any; isExpanded: boolean; onToggleExpand: () => void }) {
  if (!editor) return null;
  const btnClass = (active: boolean) =>
    `p-1 rounded hover:bg-accent transition-colors ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`;

  const addLink = () => {
    const url = window.prompt("URLを入力してください", "https://");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30 flex-wrap">
      <TooltipProvider delayDuration={300}>
        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>太字</p></TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>斜体</p></TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>下線</p></TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>取消線</p></TooltipContent></Tooltip>

        <div className="w-px h-4 bg-border mx-1" />

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>箇条書き</p></TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>番号付きリスト</p></TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>引用</p></TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>コードブロック</p></TooltipContent></Tooltip>

        <Tooltip><TooltipTrigger asChild>
          <button className={btnClass(editor.isActive("link"))} onClick={addLink}>
            <LinkIcon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>リンク</p></TooltipContent></Tooltip>

        <div className="flex-1" />

        <Tooltip><TooltipTrigger asChild>
          <button className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground" onClick={onToggleExpand}>
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger><TooltipContent side="top"><p>{isExpanded ? "縮小" : "拡大"}</p></TooltipContent></Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ===== Language Detection =====
function detectLanguage(text: string): "zh" | "ja" | "other" {
  const clean = text.replace(/[\s\p{P}\p{N}\p{S}]/gu, "");
  if (!clean) return "other";
  const jaChars = (clean.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const cjkChars = (clean.match(/[\u4e00-\u9fff]/g) || []).length;
  if (jaChars > 0) return "ja";
  if (cjkChars > clean.length * 0.3) return "zh";
  return "other";
}

function getAutoTargetLang(text: string): string {
  const lang = detectLanguage(text);
  if (lang === "zh") return "ja";
  if (lang === "ja") return "zh-CN";
  return "ja";
}

// ===== Translation Helper (uses Google Translate free endpoint) =====
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data[0]?.map((s: any) => s[0]).join("");
    if (!result) throw new Error("Empty result");
    return result;
  } catch (e) {
    console.error("Translation error:", e);
    toast.error("翻訳に失敗しました");
    return text;
  }
}

// ===== Format time with JST timezone =====
function formatTimeJST(dateStr: string): string {
  if (!dateStr) return "";
  let d: Date;
  if (dateStr.includes("T") || dateStr.includes("Z") || dateStr.includes("+")) {
    d = new Date(dateStr);
  } else {
    // Format: "2026-05-27 05:31:47" - MySQL TIMESTAMP stored as UTC
    d = new Date(dateStr.replace(" ", "T") + "Z");
  }
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  // Always show JST time
  const timeFormatter = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  const timeStr = timeFormatter.format(d);
  // Today: show only time (e.g. "15:17")
  const todayJST = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const msgDateJST = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  if (todayJST === msgDateJST) {
    if (diff < 60000) return "今";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    return timeStr;
  }
  // Other days: show "M/D HH:mm" (e.g. "6/2 15:17")
  const monthDay = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(d);
  return `${monthDay} ${timeStr}`;
}

// ===== Render rich text content safely =====
function MessageContent({ content, isMe }: { content: string; isMe: boolean }) {
  // Check if content contains HTML tags
  const isHtml = /<[a-z][\s\S]*>/i.test(content);
  if (isHtml) {
    return (
      <div
        className={`prose prose-sm max-w-none break-words text-left ${isMe ? "prose-invert" : ""} [&_p]:my-0.5 [&_ul]:my-0.5 [&_ol]:my-0.5 [&_blockquote]:my-0.5 [&_pre]:my-0.5 [&_a]:text-blue-400 [&_a]:underline [&_.mention]:text-blue-500 [&_.mention]:font-medium [&_.mention]:bg-blue-100 [&_.mention]:dark:bg-blue-900/30 [&_.mention]:rounded [&_.mention]:px-0.5`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  return <p className="whitespace-pre-wrap break-words text-left">{content}</p>;
}

export default function Chat() {
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [editRoomName, setEditRoomName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<Array<{ userId: number; userType: "staff" | "liver"; userName?: string; userAvatar?: string }>>([]);
  const [chatType, setChatType] = useState<"direct" | "group">("group");
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [mobileShowMessages, setMobileShowMessages] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [liveTranslateEnabled, setLiveTranslateEnabled] = useState(false);
  const [liveTranslation, setLiveTranslation] = useState("");
  const [translatingMsgId, setTranslatingMsgId] = useState<number | null>(null);
  const [translatedTexts, setTranslatedTexts] = useState<Record<number, string>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: number; content: string; isMe: boolean } | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; name: string; content: string; type?: 'text' | 'image' | 'file' | 'video'; fileUrl?: string } | null>(null);
  const [mentionIds, setMentionIds] = useState<number[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const liveTranslateTimer = useRef<any>(null);

  // Refs for mention suggestion (avoid stale closure in useEditor)
  const roomMembersRef = useRef<any[]>([]);
  const myInfoRef = useRef<any>(null);

  // Tiptap editor
  // Mention suggestion component ref for cleanup
  const mentionSuggestionRef = useRef<{ onKeyDown?: (props: any) => boolean; popup?: TippyInstance[] }>({});

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "メッセージを入力... @でメンション (Shift+Enterで改行)" }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion: {
          items: ({ query }: { query: string }) => {
            const members = roomMembersRef.current || [];
            const currentMyInfo = myInfoRef.current;
            return members
              .filter((m: any) => !(currentMyInfo && m.userId === currentMyInfo.id && m.userType === currentMyInfo.userType))
              .filter((m: any) => (m.userName || '').toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
              .map((m: any) => ({ id: String(m.userId), label: m.userName || '不明', userType: m.userType }));
          },
          render: () => {
            let component: any;
            let popup: TippyInstance[];
            return {
              onStart: (props: any) => {
                const el = document.createElement('div');
                el.className = 'mention-suggestion-list bg-popover border rounded-lg shadow-lg py-1 min-w-[160px] max-h-[200px] overflow-y-auto z-[9999]';
                component = { el, props, selectedIndex: 0, items: props.items };
                const updateList = () => {
                  el.innerHTML = component.items.map((item: any, index: number) =>
                    `<button class="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 ${index === component.selectedIndex ? 'bg-accent' : ''}" data-index="${index}">
                      <span class="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] ${item.userType === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${(item.label || '?').charAt(0)}</span>
                      <span>${item.label}</span>
                      <span class="text-[10px] text-muted-foreground ml-auto">${item.userType === 'staff' ? '本部' : 'ライバー'}</span>
                    </button>`
                  ).join('');
                  el.querySelectorAll('button').forEach((btn) => {
                    btn.addEventListener('mousedown', (e) => {
                      e.preventDefault();
                      const idx = parseInt(btn.getAttribute('data-index') || '0');
                      props.command(component.items[idx]);
                    });
                  });
                };
                updateList();
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: el,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'top-start',
                });
                mentionSuggestionRef.current = {
                  onKeyDown: ({ event }: any) => {
                    if (event.key === 'ArrowUp') {
                      component.selectedIndex = (component.selectedIndex + component.items.length - 1) % component.items.length;
                      updateList();
                      return true;
                    }
                    if (event.key === 'ArrowDown') {
                      component.selectedIndex = (component.selectedIndex + 1) % component.items.length;
                      updateList();
                      return true;
                    }
                    if (event.key === 'Enter') {
                      props.command(component.items[component.selectedIndex]);
                      return true;
                    }
                    if (event.key === 'Escape') {
                      popup[0]?.hide();
                      return true;
                    }
                    return false;
                  },
                  popup,
                };
              },
              onUpdate: (props: any) => {
                component.items = props.items;
                component.selectedIndex = 0;
                component.props = props;
                const el = component.el;
                el.innerHTML = component.items.map((item: any, index: number) =>
                  `<button class="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 ${index === component.selectedIndex ? 'bg-accent' : ''}" data-index="${index}">
                    <span class="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] ${item.userType === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}">${(item.label || '?').charAt(0)}</span>
                    <span>${item.label}</span>
                    <span class="text-[10px] text-muted-foreground ml-auto">${item.userType === 'staff' ? '本部' : 'ライバー'}</span>
                  </button>`
                ).join('');
                el.querySelectorAll('button').forEach((btn) => {
                  btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const idx = parseInt(btn.getAttribute('data-index') || '0');
                    props.command(component.items[idx]);
                  });
                });
                popup[0]?.setProps({ getReferenceClientRect: props.clientRect });
              },
              onKeyDown: (props: any) => {
                return mentionSuggestionRef.current.onKeyDown?.(props) || false;
              },
              onExit: () => {
                popup?.[0]?.destroy();
                mentionSuggestionRef.current = {};
              },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none px-3 py-2 text-sm ${isEditorExpanded ? "min-h-[200px] max-h-[400px]" : "min-h-[38px] max-h-32"} overflow-y-auto`,
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSend();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Live translation with auto language detection
      if (liveTranslateEnabled) {
        const text = ed.getText();
        if (liveTranslateTimer.current) clearTimeout(liveTranslateTimer.current);
        if (text.trim()) {
          liveTranslateTimer.current = setTimeout(async () => {
            const targetLang = getAutoTargetLang(text);
            const translated = await translateText(text, targetLang);
            setLiveTranslation(translated);
          }, 500);
        } else {
          setLiveTranslation("");
        }
      }
    },
  });

  // 自分の情報取得
  const { data: myInfo } = trpc.chat.getMyInfo.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

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
    { query: searchQuery || "" },
    { enabled: showNewChat || showAddMembers }
  );

  // Keep refs in sync for mention suggestion (avoids stale closure in useEditor)
  useEffect(() => { roomMembersRef.current = roomDetail?.members || []; }, [roomDetail]);
  useEffect(() => { myInfoRef.current = myInfo || null; }, [myInfo]);

  // Mutations
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      editor?.commands.clearContent();
      setLiveTranslation("");
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
      setMobileShowMessages(true);
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
  const editMessage = trpc.chat.editMessage.useMutation({
    onSuccess: () => {
      setEditingMsgId(null);
      setEditingContent("");
      refetchMessages();
      toast.success("メッセージを編集しました");
    },
    onError: (err) => toast.error("編集失敗: " + err.message),
  });
  const revokeMessage = trpc.chat.revokeMessage.useMutation({
    onSuccess: () => {
      refetchMessages();
      refetchRooms();
      toast.success("メッセージを撤回しました");
    },
    onError: (err) => toast.error("撤回失敗: " + err.message),
  });
  const dissolveRoom = trpc.chat.dissolveRoom.useMutation({
    onSuccess: () => {
      setSelectedRoomId(null);
      setMobileShowMessages(false);
      refetchRooms();
      toast.success("グループを解散しました");
    },
    onError: (err) => toast.error("解散失敗: " + err.message),
  });
  const removeMember = trpc.chat.removeMember.useMutation({
    onSuccess: () => {
      refetchRooms();
      toast.success("メンバーを除外しました");
    },
    onError: (err) => toast.error("除外失敗: " + err.message),
  });

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close context menu on click elsewhere
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-context-menu]")) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Send message handler
  const handleSend = useCallback(() => {
    if (!editor || !selectedRoomId) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    if (!text) return;
    // Extract mention IDs from editor content
    const mentionNodes: number[] = [];
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === 'mention' && node.attrs.id) {
        mentionNodes.push(parseInt(node.attrs.id));
      }
    });
    // If content is plain text (no formatting), send as plain text for backward compatibility
    const isPlain = html === `<p>${text}</p>` || html === `<p>${text.replace(/\n/g, "<br>")}</p>`;
    sendMessage.mutate({
      roomId: selectedRoomId,
      content: isPlain ? text : html,
      messageType: "text",
      ...(replyTo ? {
        replyToId: replyTo.id,
        replyToName: replyTo.name,
        replyToContent: replyTo.content,
        replyToType: replyTo.type || 'text',
        replyToFileUrl: replyTo.fileUrl || undefined,
      } : {}),
      ...(mentionNodes.length > 0 ? { mentions: mentionNodes } : {}),
    });
    setReplyTo(null);
    setMentionIds([]);
  }, [editor, selectedRoomId, sendMessage, replyTo]);

  // Paste image handler
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!selectedRoomId) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) return;
        setUploading(true);
        try {
          const formData = new FormData();
          formData.append("file", blob, `pasted_image_${Date.now()}.png`);
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
        }
        return;
      }
    }
  }, [selectedRoomId, sendMessage]);

  // Register paste listener
  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoomId) return;
    const allowedTypes = ["image/", "video/", "application/pdf", "text/", "application/json", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/csv", "application/zip", "application/x-zip-compressed", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"];
    const allowedExtensions = [".csv", ".xlsx", ".xls", ".pdf", ".txt", ".json", ".md", ".doc", ".docx", ".ppt", ".pptx", ".zip", ".mp4", ".webm", ".mov", ".avi", ".m4v"];
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const isAllowed = allowedTypes.some(t => file.type.startsWith(t)) || allowedExtensions.includes(ext);
    if (!isAllowed) {
      toast.error("対応ファイル: 画像, 動画, PDF, CSV, Excel, Word, PowerPoint, テキスト, ZIP");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("ファイルサイズは50MB以下にしてください");
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
      } else if (data.type === "video") {
        sendMessage.mutate({
          roomId: selectedRoomId,
          content: "[動画]",
          messageType: "video",
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
      toast.error("ファイルアップロード失敗: " + err.message);
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
      if (chatType === "direct") {
        setSelectedMembers([{
          userId: user.id,
          userType: user.userType as "staff" | "liver",
          userName: user.name || user.email || "",
          userAvatar: user.avatarUrl || undefined,
        }]);
      } else {
        setSelectedMembers([...selectedMembers, {
          userId: user.id,
          userType: user.userType as "staff" | "liver",
          userName: user.name || user.email || "",
          userAvatar: user.avatarUrl || undefined,
        }]);
      }
    }
  };

  // Translate a message
  const handleTranslateMessage = async (msgId: number, content: string, targetLang: string) => {
    setTranslatingMsgId(msgId);
    try {
      // Strip HTML tags for translation
      const plainText = content.replace(/<[^>]+>/g, "");
      const translated = await translateText(plainText, targetLang);
      setTranslatedTexts(prev => ({ ...prev, [msgId]: translated }));
    } catch {
      toast.error("翻訳に失敗しました");
    } finally {
      setTranslatingMsgId(null);
    }
  };

  // Right-click context menu handler
  const handleMessageContextMenu = (e: React.MouseEvent, msgId: number, content: string, isMe: boolean) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msgId, content, isMe });
  };

  // ルーム表示名を取得
  const getRoomDisplayName = (room: any) => {
    if (!room) return "チャット";
    if (room.name) return room.name;
    if (room.type === "direct" && roomDetail?.members && selectedRoomId === room.id) {
      const otherMember = roomDetail.members.find((m: any) => !(m.userId === myInfo?.id && m.userType === myInfo?.userType));
      if (otherMember) return otherMember.userName || "ダイレクトメッセージ";
    }
    return "ダイレクトメッセージ";
  };

  const selectedRoom = rooms?.find((r: any) => r.id === selectedRoomId);

  // ユーザーリストのレンダリング（共通）
  const renderUserList = (users: any[], userType: "staff" | "liver", label: string) => {
    if (!users || users.length === 0) return null;
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground px-2 py-1.5 bg-muted/50 rounded sticky top-0">{label}（{users.length}人）</p>
        {users.map((user: any) => {
          const isSelected = selectedMembers.some((m) => m.userId === user.id && m.userType === userType);
          const isSelf = myInfo && user.id === myInfo.id && userType === myInfo.userType;
          return (
            <button
              key={`${userType}-${user.id}`}
              onClick={() => !isSelf && toggleMember({ ...user, userType })}
              className={`w-full flex items-center gap-3 p-2.5 rounded-md transition-colors ${isSelf ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/50"} ${isSelected ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" : ""}`}
              disabled={isSelf}
            >
              <Avatar className="h-8 w-8">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                <AvatarFallback className="text-xs bg-muted">{(user.name || "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{user.name || user.email}{isSelf ? " (自分)" : ""}</p>
                {user.email && <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>}
              </div>
              {isSelected && <Check className="h-4 w-4 text-green-500 shrink-0" />}
            </button>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 overflow-hidden bg-background -m-4">
      {/* Left Panel - Room List (fixed, no scroll on whole panel) */}
      <div className={`w-full md:w-[320px] lg:w-[360px] xl:w-96 border-r flex flex-col min-h-0 shrink-0 ${mobileShowMessages ? "hidden md:flex" : "flex"}`}>
        {/* Header with my info */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              チャット
            </h1>
            <Button size="sm" onClick={() => { setShowNewChat(true); setSearchQuery(""); setSelectedMembers([]); }} className="gap-1">
              <Plus className="h-4 w-4" /> 新規
            </Button>
          </div>
          {myInfo && (
            <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded-md">
              <Avatar className="h-6 w-6">
                {myInfo.avatarUrl ? <AvatarImage src={myInfo.avatarUrl} /> : null}
                <AvatarFallback className="text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">ログイン中:</span>
              <span className="text-xs font-medium">{myInfo.name}</span>
              <Badge variant="outline" className={`text-[9px] px-1 py-0 ml-auto ${myInfo.userType === "staff" ? "border-blue-300 text-blue-700" : "border-green-300 text-green-700"}`}>
                {myInfo.userType === "staff" ? "本部" : "ライバー"}
              </Badge>
            </div>
          )}
          {/* 招待リンク（友達追加） */}
          {myInfo && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <Share2 className="h-3 w-3" /> 友達追加リンク
              </p>
              <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-950/30 rounded px-2 py-1.5">
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-700 shrink-0">
                  {myInfo.userType === "staff" ? "本部" : "ライバー"}
                </Badge>
                <span className="text-[10px] text-muted-foreground truncate flex-1">
                  lcjmall.com/chat/invite/{myInfo.userType}/{myInfo.id}
                </span>
                <button
                  className="shrink-0 p-0.5 hover:bg-purple-100 dark:hover:bg-purple-900 rounded transition-colors"
                  onClick={() => {
                    const link = `https://lcjmall.com/chat/invite/${myInfo.userType}/${myInfo.id}`;
                    navigator.clipboard.writeText(link);
                    toast.success("友達追加リンクをコピーしました");
                  }}
                >
                  <Copy className="h-3 w-3 text-purple-600" />
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground">このリンクを共有すると、相手があなたとDMを開始できます</p>
            </div>
          )}
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
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
        </div>
      </div>

      {/* Right Panel - Messages (scrollable) */}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${!mobileShowMessages ? "hidden md:flex" : "flex"}`}>
        {!selectedRoomId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>チャットを選択してください</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileShowMessages(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback className={selectedRoom?.type === "group" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>
                  {selectedRoom?.type === "group" ? <Users className="h-3 w-3" /> : (getRoomDisplayName(selectedRoom) || "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowMemberList(true)}>
                <h2 className="font-medium text-sm truncate">{getRoomDisplayName(selectedRoom)}</h2>
                <p className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {roomDetail?.members?.length || 0}人のメンバー ›
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
                    <Button variant="ghost" size="icon" onClick={async () => {
                      try {
                        const result = await fetch(`/api/trpc/chat.getGroupInviteCode?input=${encodeURIComponent(JSON.stringify({ json: { roomId: selectedRoomId } }))}`, { credentials: 'include' }).then(r => r.json());
                        const inviteCode = result?.result?.data?.json?.inviteCode || result?.result?.data?.inviteCode;
                        if (inviteCode) {
                          const link = `https://lcjmall.com/chat/invite/group/${selectedRoomId}/${inviteCode}`;
                          navigator.clipboard.writeText(link);
                          toast.success("グループ招待リンクをコピーしました");
                        } else {
                          console.error("Invite code response:", JSON.stringify(result));
                          toast.error("招待リンクの生成に失敗しました");
                        }
                      } catch (e: any) {
                        console.error("Invite link error:", e);
                        toast.error("招待リンクの生成に失敗しました: " + (e.message || ""));
                      }
                    }} title="招待リンク">
                      <Link2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-3">
                {(!messages || messages.length === 0) ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">メッセージがありません</p>
                    <p className="text-xs mt-1">最初のメッセージを送信しましょう</p>
                  </div>
                ) : (
                  (messages as any[]).map((msg: any) => {
                    const isMe = myInfo && msg.senderId === myInfo.id && msg.senderType === myInfo.userType;
                    // 撤回済みメッセージ
                    if (msg.isRevoked) {
                      return (
                        <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {(msg.senderName || "?").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`flex-1 min-w-0 ${isMe ? "text-right" : ""}`}>
                            <div className={`mt-0.5 inline-block rounded-lg px-3 py-1.5 text-sm bg-muted/50 text-muted-foreground italic border border-dashed`}>
                              {isMe ? "あなたがメッセージを撤回しました" : `${msg.senderName}がメッセージを撤回しました`}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    // Check if current user is mentioned in this message
                    const isMentioned = (() => {
                      if (!myInfo || isMe) return false;
                      const mentions = msg.mentions;
                      if (!mentions) return false;
                      try {
                        const mentionArr = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
                        return Array.isArray(mentionArr) && mentionArr.includes(myInfo.id);
                      } catch { return false; }
                    })();
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""} ${isMentioned ? "relative bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300/50 dark:border-yellow-600/30 rounded-lg px-2 py-1 -mx-2" : ""}`}>
                        {isMentioned && (
                          <div className="absolute top-1 right-2 text-[9px] text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-0.5">
                            <AtSign className="h-2.5 w-2.5" />
                          </div>
                        )}
                        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                          <AvatarFallback className="text-[10px] bg-muted">
                            {(msg.senderName || "?").charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex-1 min-w-0 ${isMe ? "text-right" : ""}`}>
                          {/* 引用返信ブロック */}
                          {msg.replyToName && (
                            <div className={`mb-1 ${isMe ? "flex justify-end" : ""}`}>
                              <div className="inline-flex items-center gap-2 rounded px-2 py-1 text-[11px] bg-muted/70 border-l-2 border-blue-400 max-w-[80%]">
                                {msg.replyToType === 'image' && msg.replyToFileUrl && (
                                  <img src={msg.replyToFileUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                                )}
                                {msg.replyToType === 'video' && msg.replyToFileUrl && (
                                  <div className="h-8 w-8 rounded bg-black flex items-center justify-center shrink-0">
                                    <Play className="h-3 w-3 text-white" />
                                  </div>
                                )}
                                {msg.replyToType === 'file' && (
                                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <div className="truncate">
                                  <span className="font-medium text-blue-600">{msg.replyToName}</span>
                                  <span className="text-muted-foreground ml-1">
                                    {msg.replyToType === 'image' ? '[画像]' : msg.replyToType === 'video' ? '[動画]' : (msg.replyToContent || "").replace(/<[^>]+>/g, "").slice(0, 50)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className={`flex items-baseline gap-2 ${isMe ? "justify-end" : ""}`}>
                            <span className="text-xs font-medium">{msg.senderName}</span>
                            {msg.senderType && (
                              <Badge variant="outline" className={`text-[8px] px-1 py-0 ${msg.senderType === "staff" ? "border-blue-300 text-blue-600" : "border-green-300 text-green-600"}`}>
                                {msg.senderType === "staff" ? "本部" : "ライバー"}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {msg.createdAt ? formatTimeJST(msg.createdAt) : ""}
                            </span>
                            {msg.editedAt && (
                              <span className="text-[9px] text-muted-foreground italic">(編集済)</span>
                            )}
                          </div>
                          {/* 編集中のUI */}
                          {editingMsgId === msg.id ? (
                            <div className={`mt-1 ${isMe ? "flex justify-end" : ""}`}>
                              <div className="inline-block w-full max-w-sm">
                                <Input
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      if (editingContent.trim()) editMessage.mutate({ messageId: msg.id, content: editingContent.trim() });
                                    }
                                    if (e.key === "Escape") { setEditingMsgId(null); setEditingContent(""); }
                                  }}
                                  className="text-sm"
                                  autoFocus
                                />
                                <div className="flex gap-1 mt-1 justify-end">
                                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setEditingMsgId(null); setEditingContent(""); }}>キャンセル</Button>
                                  <Button size="sm" className="h-6 text-xs" onClick={() => { if (editingContent.trim()) editMessage.mutate({ messageId: msg.id, content: editingContent.trim() }); }} disabled={editMessage.isPending || !editingContent.trim()}>保存</Button>
                                </div>
                              </div>
                            </div>
                          ) : msg.messageType === "image" && msg.fileUrl ? (
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
                          ) : msg.messageType === "video" && msg.fileUrl ? (
                            <div className={`mt-1 ${isMe ? "flex justify-end" : ""}`}>
                              <div className="max-w-xs rounded-lg border overflow-hidden bg-black">
                                <video
                                  src={msg.fileUrl}
                                  controls
                                  preload="metadata"
                                  className="max-w-full max-h-60 rounded-lg"
                                  playsInline
                                />
                                {msg.fileName && (
                                  <div className="px-2 py-1 text-[10px] text-gray-300 truncate bg-gray-900">
                                    <Video className="h-3 w-3 inline mr-1" />{msg.fileName}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`mt-0.5 inline-block rounded-lg px-3 py-1.5 text-sm ${isMe ? "bg-green-500 text-white" : "bg-muted"} group relative`}
                              onContextMenu={(e) => handleMessageContextMenu(e, msg.id, msg.content, !!isMe)}
                            >
                              <MessageContent content={msg.content} isMe={isMe} />
                              {/* Translate button on hover */}
                              <button
                                className="absolute -bottom-5 left-0 text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                                onClick={() => {
                                  const plain = msg.content.replace(/<[^>]+>/g, "");
                                  const target = getAutoTargetLang(plain);
                                  handleTranslateMessage(msg.id, msg.content, target);
                                }}
                              >
                                <Languages className="h-3 w-3" />
                                翻訳
                              </button>
                            </div>
                          )}
                          {/* Translation result */}
                          {translatingMsgId === msg.id && (
                            <div className={`mt-1 text-xs text-muted-foreground ${isMe ? "text-right" : ""}`}>
                              <Loader2 className="h-3 w-3 animate-spin inline mr-1" />翻訳中...
                            </div>
                          )}
                          {translatedTexts[msg.id] && translatingMsgId !== msg.id && (
                            <div className={`mt-1 inline-block rounded-lg px-2 py-1 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 ${isMe ? "text-right" : ""}`}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Languages className="h-3 w-3" />
                                <span className="font-medium">翻訳</span>
                                <button className="ml-1 hover:text-red-500" onClick={() => setTranslatedTexts(prev => { const n = {...prev}; delete n[msg.id]; return n; })}>
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                              <p className="text-left">{translatedTexts[msg.id]}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Reply Preview */}
            {replyTo && (
              <div className="px-3 py-2 border-t bg-muted/30 flex items-center gap-2">
                {replyTo.type === 'image' && replyTo.fileUrl && (
                  <img src={replyTo.fileUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                )}
                {replyTo.type === 'video' && replyTo.fileUrl && (
                  <div className="h-10 w-10 rounded bg-black flex items-center justify-center shrink-0">
                    <Play className="h-4 w-4 text-white" />
                  </div>
                )}
                {replyTo.type === 'file' && (
                  <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0 border-l-2 border-blue-400 pl-2">
                  <p className="text-xs font-medium text-blue-600">{replyTo.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {replyTo.type === 'image' ? '[画像]' : replyTo.type === 'video' ? '[動画]' : replyTo.type === 'file' ? '[ファイル]' : replyTo.content.replace(/<[^>]+>/g, "").slice(0, 60)}
                  </p>
                </div>
                <button onClick={() => setReplyTo(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Input Area with Rich Text Editor */}
            <div className={`border-t ${isEditorExpanded ? "flex-1 min-h-[300px]" : ""}`}>
              {/* Live translation preview */}
              {liveTranslateEnabled && liveTranslation && (
                <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <Languages className="h-3 w-3 shrink-0" />
                  <span className="font-medium">{detectLanguage(editor?.getText() || "") === "ja" ? "中文:" : "日本語:"}</span>
                  <span className="truncate">{liveTranslation}</span>
                  <button className="ml-auto text-blue-500 hover:text-blue-700 text-[10px] shrink-0" onClick={() => {
                    if (editor && liveTranslation) {
                      editor.commands.setContent(`<p>${liveTranslation}</p>`);
                      setLiveTranslation("");
                    }
                  }}>
                    使用
                  </button>
                </div>
              )}
              {/* Toolbar */}
              <EditorToolbar editor={editor} isExpanded={isEditorExpanded} onToggleExpand={() => setIsEditorExpanded(!isEditorExpanded)} />
              {/* Editor + Actions */}
              <div className="flex items-end gap-2 p-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,.pdf,.txt,.json,.csv,.md,.xlsx,.xls,.doc,.docx,.ppt,.pptx,.zip"
                  onChange={handleFileUpload}
                />
                <input
                  type="file"
                  ref={imageInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  className="hidden"
                  accept="video/*"
                  onChange={handleFileUpload}
                />
                <div className="relative shrink-0" ref={attachMenuRef} onBlur={(e) => { if (!attachMenuRef.current?.contains(e.relatedTarget as Node)) setShowAttachMenu(false); }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    disabled={uploading}
                    title="ファイルを送信"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </Button>
                  {showAttachMenu && (
                    <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 bg-background border rounded-lg shadow-lg p-2 min-w-[180px] z-50">
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted transition-colors"
                        onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false); }}
                      >
                        <ImagePlus className="h-4 w-4 text-green-600" />
                        <span>写真ライブラリ</span>
                      </button>
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted transition-colors"
                        onClick={() => { cameraInputRef.current?.click(); setShowAttachMenu(false); }}
                      >
                        <Camera className="h-4 w-4 text-blue-600" />
                        <span>写真を撮る</span>
                      </button>
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted transition-colors"
                        onClick={() => { videoInputRef.current?.click(); setShowAttachMenu(false); }}
                      >
                        <Video className="h-4 w-4 text-purple-600" />
                        <span>動画を送信</span>
                      </button>
                      <button
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted transition-colors"
                        onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                      >
                        <FolderOpen className="h-4 w-4 text-orange-600" />
                        <span>ファイルを選択</span>
                      </button>
                    </div>
                    </>
                  )}
                </div>
                <div className="flex-1 border rounded-md bg-background overflow-hidden">
                  <EditorContent editor={editor} />
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant={liveTranslateEnabled ? "default" : "ghost"}
                    onClick={() => { setLiveTranslateEnabled(!liveTranslateEnabled); setLiveTranslation(""); }}
                    title={liveTranslateEnabled ? "自動翻訳 ON (言語自動検出)" : "自動翻訳 OFF"}
                    className="h-8 w-8"
                  >
                    <Languages className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!editor?.getText().trim() || sendMessage.isPending}
                    className="h-8 w-8"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right-click Context Menu for Translation */}
      {contextMenu && (
        <div
          data-context-menu
          className="fixed z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { handleTranslateMessage(contextMenu.msgId, contextMenu.content, "ja"); setContextMenu(null); }}
          >
            <Languages className="h-4 w-4" /> 日本語に翻訳
          </button>
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { handleTranslateMessage(contextMenu.msgId, contextMenu.content, "zh-CN"); setContextMenu(null); }}
          >
            <Languages className="h-4 w-4" /> 中文翻译
          </button>
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
            onClick={() => { handleTranslateMessage(contextMenu.msgId, contextMenu.content, "en"); setContextMenu(null); }}
          >
            <Languages className="h-4 w-4" /> Translate to English
          </button>
          <div className="border-t my-1" />
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
            onClick={() => {
              const text = contextMenu.content.replace(/<[^>]+>/g, "");
              navigator.clipboard.writeText(text);
              toast.success("コピーしました");
              setContextMenu(null);
            }}
          >
            📋 コピー
          </button>
          <button
            className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
            onClick={() => {
              const msg = (messages as any[])?.find((m: any) => m.id === contextMenu.msgId);
              if (msg) {
                setReplyTo({
                  id: msg.id,
                  name: msg.senderName || "",
                  content: msg.content || "",
                  type: msg.messageType || 'text',
                  fileUrl: msg.fileUrl || undefined,
                });
              }
              setContextMenu(null);
              editor?.commands.focus();
            }}
          >
            💬 引用返信
          </button>
          {contextMenu.isMe && (
            <>
              <div className="border-t my-1" />
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  const plain = contextMenu.content.replace(/<[^>]+>/g, "");
                  setEditingMsgId(contextMenu.msgId);
                  setEditingContent(plain);
                  setContextMenu(null);
                }}
              >
                ✏️ 編集
              </button>
              <button
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2 text-red-600"
                onClick={() => {
                  if (confirm("このメッセージを撤回しますか？撤回すると元に戻せません。")) {
                    revokeMessage.mutate({ messageId: contextMenu.msgId });
                  }
                  setContextMenu(null);
                }}
              >
                🚫 撤回
              </button>
            </>
          )}
        </div>
      )}

      {/* New Chat Dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>新しいチャット</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            <Tabs value={chatType} onValueChange={(v) => { setChatType(v as "direct" | "group"); setSelectedMembers([]); }} className="shrink-0">
              <TabsList className="w-full">
                <TabsTrigger value="direct" className="flex-1">1対1</TabsTrigger>
                <TabsTrigger value="group" className="flex-1">グループ</TabsTrigger>
              </TabsList>
              <TabsContent value="group" className="mt-3">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="グループ名を入力"
                  className="mb-2"
                />
              </TabsContent>
            </Tabs>
            {selectedMembers.length > 0 && (
              <div className="shrink-0 max-h-20 overflow-y-auto border rounded-md bg-muted/30 p-2">
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1 self-center">選択中:</span>
                  {selectedMembers.map((m) => (
                    <Badge key={`${m.userType}-${m.userId}`} variant="secondary" className="gap-1 pr-1">
                      {m.userName}
                      <button onClick={() => setSelectedMembers(selectedMembers.filter((x) => !(x.userId === m.userId && x.userType === m.userType)))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="名前で絞り込み..."
                className="pl-9"
              />
            </div>
            <div className="flex-1 min-h-0 border rounded-md bg-background overflow-hidden">
              <ScrollArea className="h-full" style={{ maxHeight: "35vh" }}>
                {searchResults ? (
                  <div className="space-y-1 p-2">
                    {renderUserList(searchResults.staff as any[], "staff", "本部")}
                    {renderUserList(searchResults.livers as any[], "liver", "ライバー")}
                    {(searchResults.staff as any[]).length === 0 && (searchResults.livers as any[]).length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-4">該当するユーザーが見つかりません</p>
                    )}
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
            <Button variant="outline" onClick={() => setShowNewChat(false)}>キャンセル</Button>
            <Button onClick={handleCreateRoom} disabled={createRoom.isPending || selectedMembers.length === 0}>
              {createRoom.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {chatType === "direct" ? "チャット開始" : "グループ作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={showAddMembers} onOpenChange={setShowAddMembers}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>メンバー追加</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col flex-1 min-h-0 gap-2">
            {selectedMembers.length > 0 && (
              <div className="shrink-0 max-h-20 overflow-y-auto border rounded-md bg-muted/30 p-2">
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1 self-center">選択中:</span>
                  {selectedMembers.map((m) => (
                    <Badge key={`${m.userType}-${m.userId}`} variant="secondary" className="gap-1 pr-1">
                      {m.userName}
                      <button onClick={() => setSelectedMembers(selectedMembers.filter((x) => !(x.userId === m.userId && x.userType === m.userType)))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
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
                    {renderUserList(searchResults.staff as any[], "staff", "本部")}
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
                        {member.userType === 'staff' ? '本部' : 'ライバー'}
                      </p>
                    </div>
                    {!isSelf && selectedRoom?.type === "group" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm(`${member.userName || "このメンバー"}をグループから除外しますか？`)) {
                            removeMember.mutate({ roomId: selectedRoomId!, userId: member.userId, userType: member.userType });
                          }
                        }}
                        title="メンバーを除外"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col gap-2">
            <Button variant="outline" onClick={() => setShowMemberList(false)} className="w-full">閉じる</Button>
            {selectedRoom?.type === "group" && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => {
                  if (confirm("このグループを解散しますか？全メンバーがアクセスできなくなります。")) {
                    dissolveRoom.mutate({ roomId: selectedRoomId! });
                    setShowMemberList(false);
                  }
                }}
                disabled={dissolveRoom.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                グループを解散
              </Button>
            )}
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
