# ポイント残高不整合分析結果

## 概要
- 不整合ユーザー数: 269人 / 1,365人 (19.7%)
- 合計差異: 180,645pt

## 不整合の3カテゴリ

### 1. email_zero_with_tx (80ユーザー, 52,797pt)
- **原因**: LINE連携時のマージ処理で、balance=0にリセットされたが、トランザクション履歴が移行されなかった
- **状態**: email_のbalance=0, しかしemail_のトランザクションが残存
- **対応**: email_のトランザクションを対応するLINE IDに移行する（トランザクションのlineUserIdを更新）
- **注意**: これらのemail_ユーザーのbalance=0は正しい（ポイントはLINE IDに移行済み）。トランザクション履歴だけが移行されていない

### 2. email_nonzero_mismatch (39ユーザー, 21,965pt)
- **原因**: レースコンディションによりemail_ユーザーの残高がトランザクション合計と不一致
- **対応**: トランザクション合計で残高を再計算して修正

### 3. line_user_mismatch (150ユーザー, 105,883pt)
- **原因**: レースコンディション（一括承認時のread-then-write問題）
- **対応**: トランザクション合計で残高を再計算して修正

## 修正方針

### Step 1: email_のトランザクション移行（80ユーザー）
email_のbalance=0でトランザクションが残っているケースは、トランザクションのlineUserIdを対応するLINE IDに移行する

### Step 2: 全ユーザーの残高再計算（269ユーザー）
line_point_transactionsのSUM(amount)で正しい残高を計算し、line_point_balancesを更新する

### Step 3: totalEarned/totalUsedも再計算
earnタイプのSUMでtotalEarned、useタイプのABS(SUM)でtotalUsedを再計算
