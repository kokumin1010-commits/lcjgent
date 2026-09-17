/**
 * 第2回LCFの確定情報と役割別運用ガイド。
 * 未確定の時刻・ブースルールは推測せず、確定後掲載と明記する。
 */
import { BookOpen, Building2, CalendarDays, ExternalLink, MapPin, Mic2, QrCode, ShoppingBag, UserRoundPlus } from "lucide-react";
import { Link } from "wouter";
import { LCF_EVENT_DEFINITIONS } from "@shared/lcfEventDefinitions";

const event = LCF_EVENT_DEFINITIONS[2];

export function LcfSecondEditionGuide() {
  return (
    <section id="event-guide" className="border border-white/10 bg-white/[0.035] p-5 sm:p-6" aria-labelledby="event-guide-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black tracking-[0.2em] text-amber-400">EDITION 02 / EVENT GUIDE</p>
          <h2 id="event-guide-heading" className="mt-2 flex items-center gap-2 text-xl font-black"><BookOpen className="h-5 w-5 text-amber-400" />第2回 参加ガイド</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-gray-400">当日の入場から、ブランド・ライブコマーサーの事前準備、マッチング、売上報告までをここから確認できます。</p>
        </div>
        <Link href="/2nd" className="inline-flex min-h-11 items-center justify-center border border-amber-400/40 px-4 py-2 text-xs font-black text-amber-200 hover:bg-amber-400/10">
          第2回開催ページ<ExternalLink className="ml-2 h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="border border-white/10 bg-black/25 p-4">
          <p className="flex items-start gap-2 text-sm font-black"><CalendarDays className="mt-0.5 h-4 w-4 text-amber-400" />{event.dateText}</p>
          <p className="mt-2 text-xs leading-6 text-gray-400">開場時刻、搬入時刻、ステージ・ブース別の詳細時間は、確定後にこのガイドへ掲載します。</p>
        </div>
        <div className="border border-white/10 bg-black/25 p-4">
          <p className="flex items-start gap-2 text-sm font-black"><MapPin className="mt-0.5 h-4 w-4 text-amber-400" />{event.venueName}</p>
          <p className="mt-2 text-xs leading-6 text-gray-400">東京都港区海岸1-7-1。受付フロア、搬入、会場MAPは確定後に追加します。</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <details className="group border border-white/10 bg-black/20 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-black"><QrCode className="h-4 w-4 text-amber-400" />入場QR・本人・同行者</summary>
          <p className="mt-3 text-xs leading-6 text-gray-400">申込者本人は本人用QR、同行者はマイページで1名ずつ登録して発行される専用QRを提示します。同じQRを複数人で共用しません。</p>
        </details>
        <details className="group border border-white/10 bg-black/20 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-black"><Building2 className="h-4 w-4 text-amber-400" />ブランド・出展企業の準備</summary>
          <div className="mt-3 space-y-2 text-xs leading-6 text-gray-400">
            <p>LCMでブランドページを作成し、配信してほしい商品を登録・公開してください。商品ページが事前マッチングと当日の商談資料になります。</p>
            <Link href="/lcm/manage?workspace=brand" className="inline-flex items-center font-black text-amber-300 hover:text-amber-200">LCMブランド・商品管理へ<ExternalLink className="ml-1 h-3 w-3" /></Link>
          </div>
        </details>
        <details className="group border border-white/10 bg-black/20 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-black"><Mic2 className="h-4 w-4 text-amber-400" />ライブコマーサーの準備</summary>
          <div className="mt-3 space-y-2 text-xs leading-6 text-gray-400">
            <p>LCMの公式プロフィールを整え、配信したい商品を探してください。出展ブランドとの事前マッチングが承認された後に、連絡先とGMV報告機能を利用できます。</p>
            <Link href="/lcm/manage?workspace=creator" className="inline-flex items-center font-black text-amber-300 hover:text-amber-200">LCM配信者プロフィールへ<ExternalLink className="ml-1 h-3 w-3" /></Link>
          </div>
        </details>
        <details className="group border border-white/10 bg-black/20 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-black"><ShoppingBag className="h-4 w-4 text-amber-400" />事前マッチング・当日配信・GMV報告</summary>
          <p className="mt-3 text-xs leading-6 text-gray-400">第2回の承認済み出展ブランド・公開商品を選び、マッチングを申請します。配信後は12月8日・9日を選択し、自己申告GMVと証拠スクリーンショットを提出してください。運営確認済みの報告だけが集計対象です。</p>
          <a href="#matching-gmv" className="mt-2 inline-flex items-center text-xs font-black text-amber-300 hover:text-amber-200">マッチング・GMV操作へ移動</a>
        </details>
        <details className="group border border-white/10 bg-black/20 p-4">
          <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-black"><UserRoundPlus className="h-4 w-4 text-amber-400" />変更・キャンセル・問い合わせ</summary>
          <p className="mt-3 text-xs leading-6 text-gray-400">第2回の参加日程、同行者、申込取消は上の「第2回の参加内容・QR」から操作できます。受付後の変更、出展契約や費用に関する変更は運営へお問い合わせください。</p>
          <a href="mailto:lcj.inquiry@livecommercejapan.jp" className="mt-2 inline-flex items-center text-xs font-black text-amber-300 hover:text-amber-200">lcj.inquiry@livecommercejapan.jp</a>
        </details>
      </div>
    </section>
  );
}
