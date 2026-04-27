
## 矩阵進捗バー機能（ブランド詳細ページ）
- [x] 既存DB構造・ブランド契約テーブル・BrandDetail.tsxの確認
- [x] バックエンド：契約条件と実績時間を集計するAPIエンドポイント追加
- [x] フロントエンド：ブランド詳細ページに矩阵進捗バーUI実装
- [x] 自己検証（ブラウザ確認）
- [x] チェックポイント保存＋GitHub push＋Railwayデプロイ＋本番検証

## 矩阵進捗バー機能（ブランド一覧ページ /master/brands/）
- [x] 既存DB構造・ブランド契約テーブル・BrandList.tsxの確認
- [x] バックエンド：getAllBrands()がhasQuota/quotaSummary/kolProgressを返すことを確認（db.ts 885-938行）
- [x] フロントエンド：BrandList.tsxにノルマバッジ＋KOL別進捗バーUI実装済み（604-648行）
- [x] 自己検証（本番lcjmall.com/master/brands/でノルマバッジ表示確認: CICI BELLA「達人20h」, RENOVATIO「KG 1h」, BIZKI「KG 1h」）
- [x] 本番デプロイ済み（既にデプロイ済みコードに含まれている）

## ノルマありブランドの視覚的強調（/master/brands/）
- [x] BrandList.tsxのカードUIを確認し、ノルマありブランドの強調デザインを実装
- [x] ノルマありブランドのカードに目立つ枠線・グロー効果を追加
- [x] ノルマバッジを大きく目立つデザインに変更
- [x] KOL別進捗バーの表示を拡大・改善
- [x] 開発サーバーでブラウザ確認
- [x] チェックポイント保存＋GitHub push＋Railwayデプロイ＋本番検証
- [x] BrandDetail.tsx: ノルマ進捗セクションをページ最上部（GMV/投入の上）に移動
- [x] BrandDetail.tsx: 浮動小数点バグ修正（「残り5.300000000000001h」→「残り5.3h」）

## レシートAI審査ポイント0ptバグ修正
- [x] レシートポイント計算ロジックの調査（AI審査承認時のポイント付与フロー）
- [x] 根本原因特定: LLM金額検出→DB更新後、candidateメモリ未更新でpointsCalculated=NULLのまま
- [x] aiPass2ManualQueueReview.ts: candidateメモリ更新追加
- [x] aiAutoApproveScheduler.ts: 同じバグ修正＋pointsCalculatedもDB保存
- [x] 遡及ポイント付与APIエンドポイント作成（retroactivePointAward mutation）
- [x] GitHub push＋Railwayデプロイ（commit b39bdf3d）
- [x] 本番環境で遡及付与実行＋DB検証完了（43件成功・2,410pt付与、残り0件）

## マイページ：ブランド別配信時間集計表示
- [x] DB構造・スケジュールテーブル・マイページコードの調査
- [x] バックエンド：ブランド別配信時間集計APIエンドポイント作成
- [x] フロントエンド：マイページにブランド別配信時間UIを実装
- [x] テスト・検証（8件パス）
- [x] GitHub push＋Railwayデプロイ完了（SUCCESS）

## ブランド詳細⇔ファイナンス管理 ノルマ連動（LLM自動抽出）
- [x] コード調査：契約編集・保存・ファイナンス表示のコード構造
- [x] バックエンド：LLMベースのノルマ数値＋契約期間自動抽出ロジック（contractQuotaExtractor.ts）
- [x] バックエンド：契約保存時にLLM抽出→数値フィールド自動更新（create+update mutation）
- [x] 既存契約の一括LLM解析（バッチ処理）API実装済み（batchExtractQuotas mutation）
- [x] フロントエンド：ファイナンス管理のバッジ表示は既に実装済み（数値が入れば自動表示）
- [x] テスト（11件パス）・GitHub push・Railwayデプロイ完了（SUCCESS）

## 重複ブランドDB統合
- [x] 重複ブランドの洗い出し（同名ブランドをDBで検索）
- [x] DB統合実行（brandId差し替え、データ移行）
- [x] 統合結果の検証

## batchExtractQuotasでノルマ数値一括埋め
- [x] 本番環境でbatchExtractQuotas実行（5件全成功、エラー0件）
- [x] 結果検証（バッジ表示確認）

## ブランド詳細ページ：ライバー別配信スケジュール表示＋フィルター（Aliceさん要望）
- [x] バックエンド：ブランド別ライバー配信スケジュール取得API
- [x] フロントエンド：ブランド詳細ページにライバー別スケジュール表示
- [x] フロントエンド：ライバーフィルターボタン追加
- [x] テスト・GitHub push・Railwayデプロイ

## ライブコマースセクション：フィルター＋GMV汇总モジュール追加
- [x] 既存コード調査（BrandDetail.tsxのライブコマースセクション構造）
- [ ] フロントエンド：クイック期間ボタン（今月/先月/過去3ヶ月/全期間）
- [ ] フロントエンド：アカウント選択をチップ/タグ式（複数選択対応）
- [ ] フロントエンド：GMV汇总を大きなカード形式で目立たせる
- [ ] フロントエンド：前期間比較（成長率表示）
- [ ] フロントエンド：アカウント別GMV内訳バー表示
- [ ] テスト・GitHub push・Railwayデプロイ
