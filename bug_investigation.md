# バグ調査: 配信履歴編集画面のManusログインエラー

## 問題
- ライバーが配信履歴編集画面（/master/livers/livestream/:id/edit）にアクセスすると、Manusログインページが表示される
- ユーザーはライバーアカウントでログインしているが、管理画面のログインが必要

## 原因
1. `/master/livers/livestream/:id/edit` ルートは `DashboardLayout` 内にあり、管理者ログインが必要
2. ライバーは `/liver/*` ルートでログインしているが、`/master/*` ルートには別の認証が必要
3. `LivestreamEdit.tsx` は `trpc.brand.list.useQuery()` を使用しており、これは `publicProcedure` なので問題なし
4. しかし、`DashboardLayout` が管理者認証を要求している

## 解決策
ライバー用の配信履歴編集ページを `/liver/livestream/:id/edit` として新規作成する
または、既存の `/liver/record` ページに編集機能を追加する
