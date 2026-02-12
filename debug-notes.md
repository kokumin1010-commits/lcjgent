# Debug: 商品画像アップロード失敗

## 最終調査結果

### 正常動作確認済み
1. S3 storagePut: 正常（小さい画像〜6MBまで成功）
2. tRPC uploadProductImage API: 認証付きで正常動作（curlテストで確認）
3. express.json limit: 50mbに設定済み
4. tRPC maxBodySize: null（制限なし）。express.jsonが先にbodyをパースするので、tRPCはreq.bodyを直接使用

### 問題の可能性
ユーザーの環境（デプロイ後の本番環境）では、Manusのプロキシサーバーにリクエストサイズ制限がある可能性がある。
または、ブラウザのネットワーク問題（タイムアウト等）。

### 対策方針
1. tRPCのbase64方式からmulterベースのREST APIに切り替える（他のアップロード機能と同じパターン）
2. フロントエンドで画像を圧縮してからアップロード（canvas APIでリサイズ）
3. エラーメッセージの詳細表示を改善
