# バグ調査：新規登録500ptがレシートアップロード後に消える

## ユーザー情報
- email: zhuzhenyan0103@gmail.com
- id: 900026
- lineUserId: U02ea91375a184a5922b077ffb61bd55e

## ポイント残高テーブル（line_point_balances）
2つのレコードが存在：
1. lineUserId = "email_900026" → balance: 500（新規登録ボーナス）
2. lineUserId = "U02ea91375a184a5922b077ffb61bd55e" → balance: 231（レシート付与）

## 根本原因
**同一ユーザーに対して2つの異なるlineUserIdで残高レコードが作成されている。**
- メール登録時: `email_900026` として500pt付与
- LINE連携後のレシートアップロード: `U02ea91375a184a5922b077ffb61bd55e` として231pt付与
- マイページでは LINE userId の残高（231pt）しか表示されないため、500ptが「消えた」ように見える

## 修正方針
LINE連携時に `email_${id}` の残高を LINE userId の残高にマージする
