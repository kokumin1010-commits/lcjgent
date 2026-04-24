/**
 * LCJ Coin Peer Bonus Tab - ピアボーナス（相互称賛）
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Heart, Send, Gift, Users, Coins, MessageSquare } from "lucide-react";

function NeonCard({ children, color = "orange", className = "" }: { children: React.ReactNode; color?: string; className?: string }) {
  const glowColors: Record<string, string> = {
    orange: "shadow-orange-500/5 border-orange-500/10 hover:border-orange-500/20",
    blue: "shadow-blue-500/5 border-blue-500/10 hover:border-blue-500/20",
    green: "shadow-green-500/5 border-green-500/10 hover:border-green-500/20",
    pink: "shadow-pink-500/5 border-pink-500/10 hover:border-pink-500/20",
  };
  return (
    <div className={`rounded-2xl bg-white/[0.02] border p-6 shadow-lg transition-all ${glowColors[color] || glowColors.orange} ${className}`}>
      {children}
    </div>
  );
}

export default function LcjCoinPeerBonusTab({ staffList, liverList }: {
  staffList: { id: number; name: string; department?: string }[];
  liverList: { id: number; name: string }[];
}) {
  const [senderType, setSenderType] = useState<"staff" | "liver">("staff");
  const [senderId, setSenderId] = useState<number>(0);
  const [receiverType, setReceiverType] = useState<"staff" | "liver">("staff");
  const [receiverId, setReceiverId] = useState<number>(0);
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState("");

  const poolQuery = trpc.lcjCoin.getMyPeerBonusPool.useQuery(
    { holderType: senderType, holderId: senderId },
    { enabled: senderId > 0 }
  );
  const timelineQuery = trpc.lcjCoin.getPeerBonusTimeline.useQuery({ limit: 50 });

  const sendMutation = trpc.lcjCoin.sendPeerBonus.useMutation({
    onSuccess: (data) => {
      toast.success(`ピアボーナスを送信しました！残りプール: ${data.remaining}コイン`);
      setMessage("");
      setAmount(10);
      setReceiverId(0);
      poolQuery.refetch();
      timelineQuery.refetch();
    },
    onError: (e) => toast.error(`エラー: ${e.message}`),
  });

  const pool = poolQuery.data;
  const timeline = timelineQuery.data || [];

  return (
    <div className="space-y-6">
      {/* Send Peer Bonus */}
      <NeonCard color="pink">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-400" />
          ピアボーナスを送る
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            <div>
              <Label className="text-white/60 text-xs">送信者</Label>
              <div className="flex gap-2 mt-1">
                <Select value={senderType} onValueChange={(v: any) => { setSenderType(v); setSenderId(0); }}>
                  <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
                    <SelectItem value="staff" className="text-white hover:text-white focus:text-white">スタッフ</SelectItem>
                    <SelectItem value="liver" className="text-white hover:text-white focus:text-white">ライバー</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(senderId)} onValueChange={(v) => setSenderId(Number(v))}>
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white text-sm">
                    <SelectValue placeholder="自分を選択..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0f] border-white/10 text-white max-h-60">
                    {(senderType === "staff" ? staffList : liverList).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-white hover:text-white focus:text-white">
                        {t.name}{"department" in t && t.department ? ` (${t.department})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-white/60 text-xs">送り先</Label>
              <div className="flex gap-2 mt-1">
                <Select value={receiverType} onValueChange={(v: any) => { setReceiverType(v); setReceiverId(0); }}>
                  <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0f] border-white/10 text-white">
                    <SelectItem value="staff" className="text-white hover:text-white focus:text-white">スタッフ</SelectItem>
                    <SelectItem value="liver" className="text-white hover:text-white focus:text-white">ライバー</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(receiverId)} onValueChange={(v) => setReceiverId(Number(v))}>
                  <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-white text-sm">
                    <SelectValue placeholder="送り先を選択..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0a0a0f] border-white/10 text-white max-h-60">
                    {(receiverType === "staff" ? staffList : liverList).map((t) => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-white hover:text-white focus:text-white">
                        {t.name}{"department" in t && t.department ? ` (${t.department})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-white/60 text-xs">コイン数（上限: 50）</Label>
              <Input
                type="number"
                min={1}
                max={50}
                className="bg-white/5 border-white/10 text-white mt-1"
                value={amount}
                onChange={(e) => setAmount(Math.min(50, Math.max(1, Number(e.target.value))))}
              />
            </div>

            <div>
              <Label className="text-white/60 text-xs">メッセージ（必須）</Label>
              <Textarea
                className="bg-white/5 border-white/10 text-white mt-1"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="何に対しての感謝か書いてください..."
                rows={3}
              />
            </div>

            <Button
              className="w-full bg-gradient-to-r from-pink-500 to-rose-600 text-white"
              onClick={() => sendMutation.mutate({
                senderHolderType: senderType,
                senderHolderId: senderId,
                receiverHolderType: receiverType,
                receiverHolderId: receiverId,
                coinAmount: amount,
                message,
              })}
              disabled={!senderId || !receiverId || !message || sendMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              {sendMutation.isPending ? "送信中..." : `${amount}コインを贈る`}
            </Button>
          </div>

          {/* Right: Pool Info */}
          <div className="space-y-4">
            {pool && senderId > 0 ? (
              <>
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center">
                  <div className="text-xs text-white/40 mb-2">今月の残りプール</div>
                  <div className="text-4xl font-bold font-mono text-pink-400">
                    {pool.remaining}
                  </div>
                  <div className="text-xs text-white/30 mt-1">/ {pool.monthlyPool} コイン</div>
                  <div className="w-full h-2 bg-white/5 rounded-full mt-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all"
                      style={{ width: `${(pool.remaining / pool.monthlyPool) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-white/30 mt-2">使用済み: {pool.used}コイン</div>
                </div>
                <div className="p-3 rounded-lg bg-pink-500/10 border border-pink-500/20">
                  <p className="text-xs text-pink-400">
                    💡 未使用分は月末に失効します。積極的に仲間を称えましょう！
                  </p>
                </div>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 text-center py-12">
                <Gift className="w-12 h-12 mx-auto mb-3 text-white/10" />
                <p className="text-white/30 text-sm">送信者を選択すると残りプールが表示されます</p>
              </div>
            )}
          </div>
        </div>
      </NeonCard>

      {/* Timeline */}
      <NeonCard color="blue">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          ピアボーナスタイムライン
        </h3>

        {timeline.length > 0 ? (
          <div className="space-y-3">
            {timeline.map((b: any) => (
              <div key={b.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                <div className="w-8 h-8 rounded-full bg-pink-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Heart className="w-4 h-4 text-pink-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{b.senderName}</span>
                    <span className="text-white/30">→</span>
                    <span className="font-medium text-white text-sm">{b.receiverName}</span>
                    <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-xs">
                      +{b.coinAmount} <Coins className="w-3 h-3 ml-0.5 inline" />
                    </Badge>
                  </div>
                  <p className="text-sm text-white/60 mt-1">「{b.message}」</p>
                  <div className="text-xs text-white/20 mt-1">
                    {new Date(b.createdAt).toLocaleDateString("ja-JP")} {new Date(b.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-white/30">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>まだピアボーナスの送受信がありません</p>
            <p className="text-xs mt-1">最初のピアボーナスを送ってみましょう！</p>
          </div>
        )}
      </NeonCard>
    </div>
  );
}
