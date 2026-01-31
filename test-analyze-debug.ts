import { invokeLLM } from "./server/_core/llm";

const imageUrl = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw/test-upload-1769895148444.png";

async function testAnalyze() {
  const systemPrompt = `あなたはTikTokライブ配信のダッシュボードスクリーンショットを解析するエキスパートです。
【最重要】画像内の数値を正確に読み取ってください。数値が見える場合は必ず抽出してください。

## TikTok LIVEダッシュボードのレイアウト詳細

### 上部ヘッダーエリア
- 左上: 「LIVEダッシュボード」タイトル
- 中央上: 配信日時範囲（例: "Dec 29 16:00:54 - Dec 30 00:11:00 UTC+09:00"）
- 右上: 配信時間（例: "8h10m6s"）

### 中央メインエリア（最も重要）
- 【GMV/売上金額】: 画面中央に大きな数字で表示（例: "8,814,883" または "¥8,814,883"）
  - この数値は通常最も大きく表示される
  - カンマ区切りの数字を探してください

### 中央の指標グリッド（複数のカードが並ぶ）
- 「商品販売数」/ "Products sold": 数値（例: 2.06K = 2060）
- 「インプレッション」/ "Impressions": 数値（例: 606.07K = 606070）
- 「商品クリック数」/ "Product clicks": 数値（例: 79.4K = 79400）
- 「LIVE CTR」: パーセント値（例: 87.2%）
- 「注文数」/ "Orders": 数値（例: 1.06K = 1060）
- 「注文率」/ "Order rate": パーセント値（例: 3.2%）
- 「視聴者数」/ "Viewers" / "Unique viewers": 数値（例: 45.57K = 45570）
- 「ピーク視聴者数」/ "Peak viewers": 数値

### 左側パネル
- パフォーマンストレンドグラフ
- トラフィックソース内訳
- LIVEコンバージョン

### 右側パネル
- リプレイ動画プレビュー
- 配信者プロフィール

## 数値読み取りルール（必ず従ってください）
- "K" = 1,000倍（例: 45.57K = 45570）
- "M" = 1,000,000倍（例: 1.08M = 1080000）
- カンマは無視（例: 8,814,883 = 8814883）
- 時間表示は分に変換（例: 8h10m6s = 8*60+10 = 490分）
- パーセントは数値のみ（例: 87.2% = 87.2）

## 抽出するデータ
1. salesAmount: GMV/売上金額（中央の大きな数字）
2. viewerCount: 視聴者数/Viewers
3. peakViewerCount: ピーク視聴者数
4. productClicks: 商品クリック数
5. orderCount: 注文数
6. durationMinutes: 配信時間（分）
7. startDateTime: 配信開始日時（ISO 8601形式）
8. endDateTime: 配信終了日時（ISO 8601形式）

## 出力形式（必ずこの形式で出力）
{
  "salesAmount": 数値,
  "viewerCount": 数値,
  "peakViewerCount": 数値,
  "productClicks": 数値,
  "orderCount": 数値,
  "durationMinutes": 数値,
  "startDateTime": "ISO 8601形式の日時文字列",
  "endDateTime": "ISO 8601形式の日時文字列",
  "rawData": {
    "impressions": 数値,
    "liveCtr": 数値,
    "orderRate": 数値,
    "productSales": 数値
  },
  "confidence": "high" | "medium" | "low"
}

## 重要な注意事項
- 数値が見える場合は必ず抽出してください。nullや空にしないでください。
- 画像が不鮮明でも、見える数値は最善の推測で抽出してください。
- confidenceは、数値が明確に読み取れた場合は"high"、一部不明確な場合は"medium"、多くが不明確な場合は"low"としてください。
- 特にsalesAmount（GMV）は画面中央の最も大きな数字です。必ず抽出してください。`;

  console.log("Calling LLM with image URL:", imageUrl);
  
  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
              detail: "high",
            },
          },
          {
            type: "text",
            text: `このTikTokライブ配信ダッシュボードのスクリーンショットから、配信データを抽出してください。

特に以下の数値を注意深く探してください：
1. GMV/売上金額 - 画面中央の最も大きな数字（例: 8,814,883）
2. 視聴者数 - "Viewers" または "視聴者数" の横の数値
3. 配信時間 - ヘッダーの時間表示（例: 8h10m6s）
4. 配信日時 - ヘッダーの日時範囲

数値が見える場合は必ず抽出してください。JSON形式で返してください。`,
          },
        ],
      },
    ],
  });

  console.log("Raw LLM response:", JSON.stringify(response, null, 2));
  
  const content = response.choices[0]?.message?.content;
  console.log("Content:", content);
  
  if (content && typeof content === "string") {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    
    try {
      const parsed = JSON.parse(jsonStr);
      console.log("Parsed result:", JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      console.log("Raw content:", jsonStr);
    }
  }
}

testAnalyze().catch(console.error);
