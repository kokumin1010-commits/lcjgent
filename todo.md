
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
- [ ] BrandList.tsxのカードUIを確認し、ノルマありブランドの強調デザインを実装
- [ ] ノルマありブランドのカードに目立つ枠線・グロー効果を追加
- [ ] ノルマバッジを大きく目立つデザインに変更
- [ ] KOL別進捗バーの表示を拡大・改善
- [ ] 開発サーバーでブラウザ確認
- [ ] チェックポイント保存＋GitHub push＋Railwayデプロイ＋本番検証
- [ ] BrandDetail.tsx: ノルマ進捗セクションをページ最上部（GMV/投入の上）に移動
- [ ] BrandDetail.tsx: 浮動小数点バグ修正（「残り5.300000000000001h」→「残り5.3h」）
