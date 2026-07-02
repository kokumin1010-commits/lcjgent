import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ThumbsUp, Users, TrendingDown, Tag } from "lucide-react";
import { toast } from "sonner";

// Simple fingerprint based on browser info
function getFingerprint(): string {
  const nav = window.navigator;
  const raw = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join("|");
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export default function ProductVote() {
  const params = useParams<{ id: string }>();
  const pollId = Number(params.id);
  
  const { data: poll, isLoading, refetch } = trpc.poll.getPublic.useQuery(
    { id: pollId },
    { enabled: !!pollId }
  );

  const voteMutation = trpc.poll.vote.useMutation({
    onSuccess: (data) => {
      setHasVoted(true);
      setVoteCount(data.voteCount);
      setAvgPrice(data.avgPrice);
      toast.success("投票ありがとうございます！");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const [desiredPrice, setDesiredPrice] = useState("");
  const [nickname, setNickname] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [voteCount, setVoteCount] = useState(0);
  const [avgPrice, setAvgPrice] = useState<number | null>(null);

  useEffect(() => {
    if (poll) {
      setVoteCount(poll.voteCount);
      setAvgPrice(poll.avgPrice);
    }
  }, [poll]);

  // Check if already voted (localStorage)
  useEffect(() => {
    const voted = localStorage.getItem(`poll_voted_${pollId}`);
    if (voted) setHasVoted(true);
  }, [pollId]);

  const handleVote = () => {
    const price = Number(desiredPrice);
    if (!price || price <= 0) {
      toast.error("希望価格を入力してください");
      return;
    }
    voteMutation.mutate({
      pollId,
      desiredPrice: price,
      nickname: nickname || undefined,
      fingerprint: getFingerprint(),
    });
    localStorage.setItem(`poll_voted_${pollId}`, "true");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-orange-500" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">この投票は見つかりませんでした</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (poll.status !== "active") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 text-lg">この投票は終了しました</p>
            {avgPrice && (
              <div className="mt-4 p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">みんなの希望価格（平均）</p>
                <p className="text-2xl font-bold text-orange-600">¥{Math.round(avgPrice).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">{voteCount}人が投票</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const originalPrice = poll.originalPrice ? Number(poll.originalPrice) : null;
  const discount = originalPrice && avgPrice ? Math.round((1 - avgPrice / originalPrice) * 100) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white py-3 px-4 text-center">
        <p className="text-sm font-medium">🔥 あなたの希望価格で交渉します！</p>
      </div>

      <div className="max-w-lg mx-auto p-4 pb-8">
        {/* Product Image */}
        {poll.imageUrl && (
          <div className="rounded-2xl overflow-hidden shadow-lg mb-4 bg-white">
            <img
              src={poll.imageUrl}
              alt={poll.productName}
              className="w-full h-64 object-contain bg-gray-50"
            />
          </div>
        )}

        {/* Product Info */}
        <Card className="mb-4 border-0 shadow-md">
          <CardContent className="p-5">
            {poll.brandName && (
              <span className="inline-block bg-orange-100 text-orange-700 text-xs font-medium px-2 py-1 rounded-full mb-2">
                {poll.brandName}
              </span>
            )}
            <h1 className="text-xl font-bold text-gray-900 mb-2">{poll.productName}</h1>
            
            {poll.description && (
              <p className="text-gray-600 text-sm leading-relaxed mb-3 whitespace-pre-line">{poll.description}</p>
            )}

            {originalPrice && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-gray-50 rounded-lg">
                <Tag className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">定価</span>
                <span className="text-lg font-bold text-gray-800">¥{originalPrice.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vote Stats */}
        {voteCount > 0 && (
          <Card className="mb-4 border-0 shadow-md bg-gradient-to-r from-orange-50 to-pink-50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-xs">投票数</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{voteCount}<span className="text-sm font-normal text-gray-500">人</span></p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-pink-600 mb-1">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-xs">平均希望価格</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    ¥{avgPrice ? Math.round(avgPrice).toLocaleString() : "---"}
                  </p>
                  {discount && discount > 0 && (
                    <span className="text-xs text-green-600 font-medium">{discount}%OFF</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vote Form */}
        {!hasVoted ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">
                🔥 いくらなら買う？
              </h2>
              <p className="text-xs text-gray-500 text-center mb-4">
                あなたの希望価格を教えてください。ブランドと交渉します！
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">希望価格 *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">¥</span>
                    <Input
                      type="number"
                      placeholder="例: 3000"
                      value={desiredPrice}
                      onChange={(e) => setDesiredPrice(e.target.value)}
                      className="pl-8 text-lg h-12"
                      min={1}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">ニックネーム（任意）</label>
                  <Input
                    type="text"
                    placeholder="匿名でもOK"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="h-10"
                  />
                </div>

                <Button
                  onClick={handleVote}
                  disabled={voteMutation.isPending || !desiredPrice}
                  className="w-full h-12 text-base font-bold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-lg"
                >
                  {voteMutation.isPending ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <>
                      <ThumbsUp className="h-5 w-5 mr-2" />
                      この価格で投票する
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">投票ありがとうございます！</h2>
              <p className="text-sm text-gray-600 mb-4">
                ブランドと交渉して、できるだけ安くお届けします。<br/>
                ライブ配信をお楽しみに！
              </p>
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <p className="text-xs text-gray-500">現在の平均希望価格</p>
                <p className="text-3xl font-bold text-orange-600">
                  ¥{avgPrice ? Math.round(avgPrice).toLocaleString() : "---"}
                </p>
                <p className="text-xs text-gray-400 mt-1">{voteCount}人が投票中</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by LCJ MALL
        </p>
      </div>
    </div>
  );
}
