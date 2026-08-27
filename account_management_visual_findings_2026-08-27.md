# Account Management Excel取込 UI 視覚確認

## 中文・Excel preview

`account_import_preview_zh.png`を確認した。取込dialogは既存アカウント画面上へ適切に表示され、原本ファイル名と11.4KBのサイズ、資格情報22件、住所・連絡先4件、参照リンク4件の分類件数が見える。資格情報一覧のIDはすべてmasked表示で、password本文は表示されない。背景の既存アカウントtableでは暗号化badge、検索、filter、追加・編集・削除導線が維持されている。

画面高1100pxではpreview一覧がdialog内scrollとなるが、件数・分類・確認導線は初期表示内に収まり、横方向の崩れはない。

## 中文・参照リンクtab

`account_references_zh.png`を確認した。資格情報を持たない4件は独立tabへ表示され、LCJ MALL、オンラインMTG調整リンク、LCJシステムユーザー管理、Geminiの各URLがclick可能。資格情報・CRM tableには混在しない。検索欄、分類badge、URL、備考列の可読性に問題はない。

## 結論

Chromium回帰はconsole error 0、page error 0、failed request 0。実Excelはpreviewだけ実行し、import mutationは0件、本番DB/S3への書込みはない。
