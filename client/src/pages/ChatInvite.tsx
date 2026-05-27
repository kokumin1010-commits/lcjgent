import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import { Loader2, MessageCircle, Users, UserPlus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// /chat/invite/group/:roomId/:inviteCode - グループ招待リンク
// /chat/invite/:userType/:userId - 個人招待リンク（友達追加）
export default function ChatInvite() {
  const [, navigate] = useLocation();
  const [matchGroup, paramsGroup] = useRoute("/chat/invite/group/:roomId/:inviteCode");
  const [matchPersonal, paramsPersonal] = useRoute("/chat/invite/:userType/:userId");
  const [status, setStatus] = useState<"loading" | "joining" | "success" | "error" | "login_required">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [roomId, setRoomId] = useState<number | null>(null);

  const joinGroup = trpc.chat.joinGroupByInvite.useMutation({
    onSuccess: (data) => {
      setRoomId(data.roomId);
      setStatus("success");
      if (data.alreadyMember) {
        toast.info("既にこのグループのメンバーです");
      } else {
        toast.success("グループに参加しました！");
      }
    },
    onError: (err) => {
      if (err.message?.includes("login") || err.message?.includes("10001")) {
        setStatus("login_required");
      } else {
        setStatus("error");
        setErrorMsg(err.message || "参加に失敗しました");
      }
    },
  });

  const joinPersonal = trpc.chat.joinByPersonalInvite.useMutation({
    onSuccess: (data) => {
      setRoomId(data.roomId);
      setStatus("success");
      if (data.existing) {
        toast.info("既にDMが存在します");
      } else {
        toast.success("友達追加しました！");
      }
    },
    onError: (err) => {
      if (err.message?.includes("login") || err.message?.includes("10001")) {
        setStatus("login_required");
      } else {
        setStatus("error");
        setErrorMsg(err.message || "友達追加に失敗しました");
      }
    },
  });

  useEffect(() => {
    if (matchGroup && paramsGroup) {
      const rid = Number(paramsGroup.roomId);
      const code = paramsGroup.inviteCode;
      if (rid && code) {
        setStatus("joining");
        joinGroup.mutate({ roomId: rid, inviteCode: code });
      } else {
        setStatus("error");
        setErrorMsg("無効な招待リンクです");
      }
    } else if (matchPersonal && paramsPersonal) {
      const userType = paramsPersonal.userType as "staff" | "liver";
      const userId = Number(paramsPersonal.userId);
      if (userId && (userType === "staff" || userType === "liver")) {
        setStatus("joining");
        joinPersonal.mutate({ targetUserId: userId, targetUserType: userType });
      } else {
        setStatus("error");
        setErrorMsg("無効な招待リンクです");
      }
    } else {
      setStatus("error");
      setErrorMsg("無効な招待リンクです");
    }
  }, []);

  const isGroup = matchGroup;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            {isGroup ? <Users className="h-7 w-7 text-white" /> : <UserPlus className="h-7 w-7 text-white" />}
          </div>
          <CardTitle className="text-lg">
            {isGroup ? "グループ招待" : "友達追加"}
          </CardTitle>
          <CardDescription>
            {isGroup ? "グループチャットへの招待リンク" : "ダイレクトメッセージを開始"}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {(status === "loading" || status === "joining") && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">参加処理中...</p>
            </div>
          )}
          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-medium">
                {isGroup ? "グループに参加しました！" : "友達追加が完了しました！"}
              </p>
              <Button onClick={() => navigate(window.location.pathname.includes("/liver") ? "/liver/chat" : "/master/chat")} className="w-full mt-2">
                <MessageCircle className="h-4 w-4 mr-2" />
                チャットを開く
              </Button>
            </div>
          )}
          {status === "login_required" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-muted-foreground">この招待リンクを使用するにはログインが必要です</p>
              <Button onClick={() => navigate(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)} className="w-full">
                ログインして参加
              </Button>
              <Button variant="outline" onClick={() => navigate("/liver/register")} className="w-full">
                新規登録（ライバー）
              </Button>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm text-red-500">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full">
                トップページに戻る
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
