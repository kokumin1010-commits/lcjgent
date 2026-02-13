import { ArrowLeft, ShoppingCart, Building2, MapPin, Phone, Mail, Globe, Scale } from "lucide-react";
import { Link } from "wouter";

const LEGAL_ITEMS = [
  {
    label: "販売業者",
    value: "株式会社LIVE COMMERCE JAPAN",
  },
  {
    label: "運営統括責任者",
    value: "黄 国民（代表取締役）",
  },
  {
    label: "所在地",
    value: "〒160-0023\n東京都新宿区西新宿三丁目3番13号 西新宿水間ビル6階",
  },
  {
    label: "電話番号",
    value: "お問い合わせはメールにて承っております。\n※電話でのお問い合わせ窓口は設けておりません。",
  },
  {
    label: "メールアドレス",
    value: "support@livecommercejapan.jp",
  },
  {
    label: "URL",
    value: "https://livecommercejapan.jp",
    isLink: true,
  },
  {
    label: "販売価格",
    value: "各商品ページに表示された価格（税込）に準じます。",
  },
  {
    label: "商品代金以外の必要料金",
    value: "送料：各商品ページに記載のとおり（送料無料の場合もあります）\n振込手数料：お客様負担\n決済手数料：無料",
  },
  {
    label: "お支払い方法",
    value: "クレジットカード決済（Stripe）\nポイント決済（LCJ MALLポイント）",
  },
  {
    label: "お支払い時期",
    value: "クレジットカード決済：ご注文時に決済\nポイント決済：ご注文時にポイントを即時引き落とし",
  },
  {
    label: "商品の引渡し時期",
    value: "ご注文確認後、通常3〜7営業日以内に発送いたします。\n※在庫状況や配送地域により、お届けまでにお時間をいただく場合がございます。",
  },
  {
    label: "返品・交換について",
    value: "商品到着後7日以内に限り、未使用・未開封の商品に限り返品・交換を承ります。\n※お客様都合による返品の場合、送料はお客様のご負担となります。\n※不良品・誤配送の場合は、送料当社負担にて交換いたします。",
  },
  {
    label: "返品送料",
    value: "不良品・誤配送の場合：当社負担\nお客様都合の場合：お客様負担",
  },
  {
    label: "キャンセルについて",
    value: "発送前のご注文に限り、キャンセルを承ります。\n発送後のキャンセルはお受けできませんので、あらかじめご了承ください。",
  },
  {
    label: "動作環境",
    value: "当サービスはWebブラウザ上で動作します。\n推奨環境：Google Chrome、Safari、Microsoft Edge の最新版",
  },
  {
    label: "特別条件",
    value: "ポイント決済をご利用の場合、LCJ MALLへの会員登録（LINE連携）が必要です。\nポイントの有効期限や利用条件は、マイページにてご確認ください。",
  },
];

export default function Tokushoho() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* ヘッダー */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="container py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/mall/products" className="flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors">
                <ArrowLeft className="h-5 w-5" />
                <span className="hidden sm:inline">戻る</span>
              </Link>
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                  LCJ MALL
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/mall/products">
                <ShoppingCart className="h-5 w-5 text-gray-600 hover:text-pink-500 transition-colors" />
              </Link>
              <Link href="/mypage" className="text-sm font-medium text-pink-500">
                マイページ
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container py-8 md:py-12 max-w-3xl mx-auto">
        {/* タイトル */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-pink-100 p-2 rounded-lg">
              <Scale className="h-5 w-5 text-pink-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              特定商取引法に基づく表記
            </h1>
          </div>
          <p className="text-sm text-gray-500 ml-12">
            特定商取引に関する法律第11条に基づく表示
          </p>
        </div>

        {/* 法的情報テーブル */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {LEGAL_ITEMS.map((item, index) => (
            <div
              key={item.label}
              className={`flex flex-col sm:flex-row ${
                index !== LEGAL_ITEMS.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              {/* ラベル */}
              <div className="sm:w-56 flex-shrink-0 bg-gray-50/80 px-5 py-4 sm:py-5">
                <span className="text-sm font-semibold text-gray-700">
                  {item.label}
                </span>
              </div>
              {/* 値 */}
              <div className="flex-1 px-5 py-3 sm:py-5">
                {item.isLink ? (
                  <a
                    href={item.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-pink-600 hover:text-pink-700 underline underline-offset-2 transition-colors"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                    {item.value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 補足情報 */}
        <div className="mt-8 bg-pink-50/50 rounded-xl p-5 border border-pink-100">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">お問い合わせについて</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            商品やサービスに関するお問い合わせは、メール（support@livecommercejapan.jp）にて承っております。
            通常2〜3営業日以内にご返信いたします。
          </p>
        </div>

        {/* 更新日 */}
        <p className="text-center text-xs text-gray-400 mt-8">
          最終更新日：2026年2月14日
        </p>
      </main>

      {/* フッター */}
      <footer className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-10 mt-16">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-pink-400" />
              <span className="text-xl font-bold">LCJ MALL</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link href="/mall/products" className="hover:text-white transition-colors">商品一覧</Link>
              <Link href="/mypage" className="hover:text-white transition-colors">マイページ</Link>
              <Link href="/legal/tokushoho" className="hover:text-white transition-colors text-white">特定商取引法</Link>
              <Link href="/legal/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link>
              <Link href="/" className="hover:text-white transition-colors">トップ</Link>
            </div>
            <p className="text-gray-500 text-sm">© 2024 LCJ MALL. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
