# リアルタイムスクショAI解析 設計メモ

## 既存テーブル参考: screenshot_analysis_history
- salesAmount, viewerCount, peakViewerCount, productClicks, orderCount
- durationMinutes, startDateTime, endDateTime
- impressions, liveCtr, orderRate, productSales
- confidence, rawResponse, analysisVersion
- imageHash, imageUrl, imageKey

## 新テーブル: livestream_realtime_snapshots
配信中に定期的にアップされるスクショの解析結果を保存

### 必要フィールド:
- id, livestreamId, liverId
- imageUrl, imageKey (S3)
- timeSlot (アップした時間帯)
- snapshotAt (スクショ撮影時刻)
- gmv (派生GMV累計)
- gpm (表示GPM - 1000インプあたりの売上)
- impressions (インプレッション数)
- impressionsPerHour (1時間あたりインプレ)
- viewerCount (視聴者数)
- orderCount (販売数)
- tapThroughRate (タップスルー率)
- commentRate (コメント率)
- followRate (フォロー率)
- avgViewDuration (視聴1回あたり平均時間)
- notes (運営メモ - フリーテキスト)
- rawResponse (AI生レスポンス)
- confidence
- createdAt

## TikTokダッシュボードから読み取る指標:
1. 派生GMV (¥2,033,024)
2. LIVEに起因する商品販売数 (490)
3. 視聴者数 (30.53K)
4. インプレッション数 (408.78K)
5. 視聴数 (44.43K)
6. 1時間あたりのインプレッション (64.9K)
7. 表示GPM (¥4.97K)
8. 視聴1回あたり平均時間 (2m6s)
9. コメント率 (5.17%)
10. フォロー率 (0.15%)
11. タップスルー率 (1.93%)

## 既存のLLM呼び出し方法:
- server/_core/llm.ts の invokeLLM を使用
- Vision対応: content配列に image_url type を含める

## フロントエンド:
- LivestreamRealtimeRecord.tsx に「📸 スクショ記録」セクション追加
- 画像アップロード → S3保存 → AI解析 → 結果表示
- 時間帯別GPM推移グラフ表示

## 既存のリアルタイム記録ルーター:
- server/routers.ts 内の realtimeRecord ルーター
- trpc.realtimeRecord.add/update/delete/getByLivestream/getByLiver/getTimeSlotAnalysis
