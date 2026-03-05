import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import KakuhenChance from "@/components/KakuhenChance";

/**
 * テスト用: 確変チャンスページを直接表示するページ
 * /kakuhen-test でアクセス可能
 * 実際のレシートIDを使ってテストする
 */
export default function KakuhenTest() {
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<any>(null);

  // テスト用のダミーデータ（最新のapprovedレシートID: 451579）
  const testReceiptId = 451579;
  const testOrderAmount = 849;
  const testOcrData = {
    shopName: "KYOGOKU JAPAN",
    productName: "KYOGOKU ケラチン ブースト＋原液",
    totalAmount: 849,
    orderDate: "2026-03-05",
    items: [
      {
        productName: "KYOGOKU ケラチン ブースト＋原液",
        unitPrice: 849,
        quantity: 1,
      },
    ],
  };

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
            <h1 className="font-bold text-lg">確変チャンス テスト完了</h1>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-6">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-black text-gray-900">テスト完了！</h2>
          {result && (
            <pre className="text-left text-xs bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <Button onClick={() => { setCompleted(false); setResult(null); }}>
              もう一度テスト
            </Button>
            <Link href="/mypage">
              <Button variant="outline" className="w-full">マイページに戻る</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/mypage">
            <Button variant="ghost" size="sm" className="text-white">
              <ArrowLeft className="h-4 w-4 mr-1" />
              戻る
            </Button>
          </Link>
          <h1 className="font-bold text-lg text-white">🎰 確変チャンス テスト</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <KakuhenChance
          receiptId={testReceiptId}
          receiptType="line_receipt"
          orderAmount={testOrderAmount}
          ocrData={testOcrData}
          onComplete={(res) => {
            setResult(res);
            setCompleted(true);
          }}
          onSkip={() => {
            setCompleted(true);
          }}
        />
      </div>
    </div>
  );
}
