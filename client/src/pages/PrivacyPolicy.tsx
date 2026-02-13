import { ArrowLeft, ShoppingCart, Shield, Lock, Eye, Server, UserCheck, Bell, Trash2, FileText } from "lucide-react";
import { Link } from "wouter";

const SECTIONS = [
  {
    icon: FileText,
    title: "1. 基本方針",
    content:
      "株式会社LIVE COMMERCE JAPAN（以下「当社」）は、LCJ MALL（以下「当サービス」）の運営において、お客様の個人情報の保護を最重要課題と認識し、個人情報の保護に関する法律（個人情報保護法）およびその他の関連法令・ガイドラインを遵守いたします。\n\n当社は、以下のプライバシーポリシーに従い、お客様の個人情報を適切に取り扱い、安全管理に努めてまいります。",
  },
  {
    icon: Eye,
    title: "2. 収集する個人情報",
    content:
      "当サービスでは、以下の個人情報を収集する場合があります。\n\n【会員登録・LINE連携時】\n・LINEアカウント情報（ユーザーID、表示名、プロフィール画像）\n・メールアドレス\n\n【商品購入時】\n・氏名（配送先名義）\n・郵便番号・住所（配送先）\n・電話番号（配送連絡用）\n・決済情報（クレジットカード情報はStripe社が管理し、当社では保持しません）\n\n【サービス利用時】\n・アクセスログ（IPアドレス、ブラウザ情報、閲覧ページ等）\n・Cookie情報\n・お問い合わせ内容",
  },
  {
    icon: UserCheck,
    title: "3. 個人情報の利用目的",
    content:
      "収集した個人情報は、以下の目的で利用いたします。\n\n・商品の販売、発送、配送状況の通知\n・ご注文内容の確認、お問い合わせへの対応\n・ポイントサービスの提供・管理\n・会員認証およびアカウント管理\n・サービスの改善、新機能の開発\n・重要なお知らせ（サービス変更、メンテナンス等）の通知\n・利用規約違反行為への対応\n・法令に基づく対応\n\n上記の目的以外で個人情報を利用する場合は、あらかじめお客様の同意を得た上で行います。",
  },
  {
    icon: Lock,
    title: "4. 個人情報の第三者提供",
    content:
      "当社は、以下の場合を除き、お客様の個人情報を第三者に提供いたしません。\n\n・お客様の同意がある場合\n・法令に基づく場合（裁判所、警察等の公的機関からの要請）\n・人の生命、身体または財産の保護のために必要な場合\n・商品の配送業務を委託する場合（配送に必要な情報のみ）\n・決済処理を委託する場合（Stripe社への決済情報の提供）\n\n業務委託先に対しては、個人情報の適切な管理を義務付け、監督を行います。",
  },
  {
    icon: Server,
    title: "5. 個人情報の安全管理",
    content:
      "当社は、個人情報の漏洩、滅失、毀損を防止するため、以下の安全管理措置を講じています。\n\n【技術的対策】\n・SSL/TLS暗号化通信の使用\n・クレジットカード情報の非保持（PCI DSS準拠のStripe社に委託）\n・アクセス制御とログ管理\n・定期的なセキュリティアップデート\n\n【組織的対策】\n・個人情報取扱責任者の設置\n・従業員への個人情報保護教育\n・アクセス権限の最小化",
  },
  {
    icon: Bell,
    title: "6. Cookieの使用について",
    content:
      "当サービスでは、以下の目的でCookieを使用しています。\n\n・ログイン状態の維持（セッション管理）\n・サービスの利便性向上\n・アクセス解析（利用状況の把握）\n\nお客様はブラウザの設定によりCookieの受け入れを拒否することができますが、一部のサービス機能がご利用いただけなくなる場合があります。",
  },
  {
    icon: Trash2,
    title: "7. 個人情報の開示・訂正・削除",
    content:
      "お客様は、当社が保有するご自身の個人情報について、以下の権利を行使することができます。\n\n・個人情報の開示請求\n・個人情報の訂正・追加・削除の請求\n・個人情報の利用停止・消去の請求\n・個人情報の第三者提供停止の請求\n\nご請求の際は、本人確認をさせていただいた上で、合理的な期間内に対応いたします。\nお問い合わせ先：support@livecommercejapan.jp",
  },
  {
    icon: Shield,
    title: "8. 未成年者の個人情報",
    content:
      "18歳未満のお客様が当サービスをご利用になる場合は、保護者の同意を得た上でご利用ください。当社は、未成年者から意図的に個人情報を収集することはありません。",
  },
];

export default function PrivacyPolicy() {
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
              <Shield className="h-5 w-5 text-pink-600" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              プライバシーポリシー
            </h1>
          </div>
          <p className="text-sm text-gray-500 ml-12">
            個人情報の取り扱いに関する方針
          </p>
        </div>

        {/* セクション一覧 */}
        <div className="space-y-6">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.title}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="px-5 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center gap-3">
                  <Icon className="h-4 w-4 text-pink-500 flex-shrink-0" />
                  <h2 className="text-base font-semibold text-gray-800">
                    {section.title}
                  </h2>
                </div>
                <div className="px-5 py-5">
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                    {section.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 事業者情報 */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50/80 border-b border-gray-100 flex items-center gap-3">
            <FileText className="h-4 w-4 text-pink-500 flex-shrink-0" />
            <h2 className="text-base font-semibold text-gray-800">
              9. 個人情報取扱事業者
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { label: "事業者名", value: "株式会社LIVE COMMERCE JAPAN" },
              { label: "代表者", value: "黄 国民（代表取締役）" },
              { label: "所在地", value: "〒160-0023\n東京都新宿区西新宿三丁目3番13号 西新宿水間ビル6階" },
              { label: "お問い合わせ", value: "support@livecommercejapan.jp" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col sm:flex-row">
                <div className="sm:w-40 flex-shrink-0 bg-gray-50/50 px-5 py-3 sm:py-4">
                  <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                </div>
                <div className="flex-1 px-5 py-3 sm:py-4">
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ポリシー変更について */}
        <div className="mt-8 bg-pink-50/50 rounded-xl p-5 border border-pink-100">
          <h2 className="text-sm font-semibold text-gray-800 mb-2">10. プライバシーポリシーの変更</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            当社は、法令の改正やサービス内容の変更等に伴い、本プライバシーポリシーを変更する場合があります。
            変更後のプライバシーポリシーは、当サービス上に掲載した時点から効力を生じるものとします。
            重要な変更がある場合は、当サービス上でお知らせいたします。
          </p>
        </div>

        {/* 関連リンク */}
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <Link href="/legal/tokushoho" className="text-pink-500 hover:text-pink-600 underline underline-offset-2 transition-colors">
            特定商取引法に基づく表記
          </Link>
        </div>

        {/* 更新日 */}
        <p className="text-center text-xs text-gray-400 mt-6">
          制定日：2026年2月14日　最終更新日：2026年2月14日
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
              <Link href="/legal/tokushoho" className="hover:text-white transition-colors">特定商取引法</Link>
              <Link href="/legal/privacy" className="hover:text-white transition-colors text-white">プライバシーポリシー</Link>
              <Link href="/" className="hover:text-white transition-colors">トップ</Link>
            </div>
            <p className="text-gray-500 text-sm">© 2024 LCJ MALL. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
