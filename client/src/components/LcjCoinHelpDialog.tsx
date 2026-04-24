/**
 * LCJ Coin Help Dialog - ルール説明ヘルプマーク
 * 
 * スタッフ全員が見れるヘルプアイコン（？）をクリックすると
 * ベスティング・換金・ピアボーナス・Tier等のルールを表示
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle, Lock, Unlock, Gift, ArrowRight, AlertTriangle,
  Rocket, RefreshCw, LogOut, Shield, Ban, Users, Clock, Coins,
  ChevronDown, ChevronUp, Star
} from "lucide-react";

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-orange-400" />
        </div>
        <span className="font-semibold text-white flex-1">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 text-sm text-white/70">{children}</div>}
    </div>
  );
}

function RuleRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-white/40 min-w-[120px] flex-shrink-0">{label}</span>
      <span className={highlight ? "text-orange-400 font-semibold" : "text-white/80"}>{value}</span>
    </div>
  );
}

export default function LcjCoinHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-orange-500/30 transition-all group"
        title="LCJコインのルールを見る"
      >
        <HelpCircle className="w-4 h-4 text-white/40 group-hover:text-orange-400 transition-colors" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0a0a0f] border-white/10 text-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              LCJコイン ルールブック
            </DialogTitle>
            <p className="text-sm text-white/40 mt-1">全スタッフ向け — LCJコインの仕組みと換金ルール</p>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {/* ============================================================ */}
            {/* LCJコインとは */}
            {/* ============================================================ */}
            <Section title="LCJコインとは？" icon={Coins} defaultOpen={true}>
              <p>
                LCJコインは、Live Commerce Japan（LCJ）が発行する<strong className="text-orange-400">ファントムストック（仮想株式）</strong>です。
                会社の時価総額が上がるほど、1コインの価値も上がります。
              </p>
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <div className="text-xs text-white/40 mb-1">計算式</div>
                <div className="font-mono text-sm text-orange-400">
                  1コインの価値 = 擬似時価総額 ÷ 総発行コイン数
                </div>
                <div className="text-xs text-white/30 mt-2">
                  擬似時価総額 = 年間売上 × PSR倍率（15倍）
                </div>
              </div>
              <p className="text-white/50 text-xs">
                ※ IPO時には実際の株式に転換される可能性があります。
              </p>
            </Section>

            {/* ============================================================ */}
            {/* ベスティング（権利確定） */}
            {/* ============================================================ */}
            <Section title="ベスティング（権利確定）スケジュール" icon={Lock}>
              <p>
                付与されたコインは、すぐには全額あなたのものになりません。
                <strong className="text-orange-400">3年間かけて毎月少しずつ「確定」</strong>していきます。
              </p>

              <div className="space-y-1">
                <RuleRow label="ベスティング期間" value="3年間（36ヶ月）" />
                <RuleRow label="クリフ期間" value="1年間（12ヶ月）" highlight />
                <RuleRow label="確定スケジュール" value="クリフ後、残り24ヶ月で毎月 1/24 ずつ確定" />
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  クリフとは？
                </div>
                <p className="text-white/60 text-xs">
                  入社から1年未満で退職した場合、付与されたコインは<strong className="text-red-400">全て没収（ゼロ）</strong>になります。
                  1年を超えると、毎月約4.17%ずつ確定していきます。
                </p>
              </div>

              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <div className="text-xs text-white/40 mb-2">具体例: 10,000コイン付与の場合</div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-white/40">1〜12ヶ月目</span><span className="text-red-400">0コイン確定（クリフ期間）</span></div>
                  <div className="flex justify-between"><span className="text-white/40">13ヶ月目</span><span className="text-green-400">+417コイン確定</span></div>
                  <div className="flex justify-between"><span className="text-white/40">14ヶ月目</span><span className="text-green-400">+417コイン確定（累計834）</span></div>
                  <div className="flex justify-between"><span className="text-white/40">...</span><span className="text-white/30">毎月+417コイン</span></div>
                  <div className="flex justify-between"><span className="text-white/40">36ヶ月目</span><span className="text-orange-400">10,000コイン全額確定 🎉</span></div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* 付与の種類 */}
            {/* ============================================================ */}
            <Section title="コイン付与の種類" icon={Gift}>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex-shrink-0">サインオン</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">入社時付与</div>
                    <div className="text-xs text-white/50">入社時にTierに基づいて付与。3年ベスティング・1年クリフ。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex-shrink-0">リフレッシュ</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">追加付与（年次）</div>
                    <div className="text-xs text-white/50">年次評価で優秀な成績を収めた場合に追加付与。新たに3年ベスティング開始。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 flex-shrink-0">スポット</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">特別報酬</div>
                    <div className="text-xs text-white/50">大型案件獲得、プロジェクト成功等の特別貢献に対して。即時確定の場合あり。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 flex-shrink-0">ピアボーナス</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">仲間からの称賛</div>
                    <div className="text-xs text-white/50">同僚から贈られるコイン。即時確定。毎月プールがリセット。</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* Tier別テンプレート */}
            {/* ============================================================ */}
            <Section title="Tier別付与テンプレート" icon={Star}>
              <p>入社時の付与コイン数は、役職Tierと年収に基づいて自動計算されます。</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-white/40 font-medium">Tier</th>
                      <th className="text-left py-2 text-white/40 font-medium">対象</th>
                      <th className="text-right py-2 text-white/40 font-medium">係数</th>
                      <th className="text-right py-2 text-white/40 font-medium">例: 年収500万</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-red-500/20 text-red-400 border-red-500/30">S</Badge></td>
                      <td className="py-2 text-white/60">CTO候補・VP</td>
                      <td className="py-2 text-right text-orange-400 font-mono">80%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥4,000,000相当</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">A</Badge></td>
                      <td className="py-2 text-white/60">コアエンジニア・事業責任者</td>
                      <td className="py-2 text-right text-orange-400 font-mono">30%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥1,500,000相当</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">B</Badge></td>
                      <td className="py-2 text-white/60">中堅エンジニア・セールス</td>
                      <td className="py-2 text-right text-orange-400 font-mono">12%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥600,000相当</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-green-500/20 text-green-400 border-green-500/30">C</Badge></td>
                      <td className="py-2 text-white/60">CS・運用担当</td>
                      <td className="py-2 text-right text-orange-400 font-mono">5%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥250,000相当</td>
                    </tr>
                    <tr>
                      <td className="py-2"><Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">D</Badge></td>
                      <td className="py-2 text-white/60">事務・アシスタント</td>
                      <td className="py-2 text-right text-orange-400 font-mono">2%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥100,000相当</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-white/40 text-xs mt-2">
                ※ 計算式: (年収 × Tier係数) ÷ 現在の1コイン価格 = 付与コイン数
              </p>
            </Section>

            {/* ============================================================ */}
            {/* ピアボーナス */}
            {/* ============================================================ */}
            <Section title="ピアボーナス（相互称賛）" icon={Users}>
              <p>
                毎月、全社員に<strong className="text-orange-400">100コイン</strong>の「贈呈専用プール」が配布されます。
                仲間の貢献に感謝を込めてコインを贈りましょう。
              </p>
              <div className="space-y-1">
                <RuleRow label="月間配布量" value="1人あたり100コイン/月" />
                <RuleRow label="1回の上限" value="50コイン" />
                <RuleRow label="自分への送信" value="不可" highlight />
                <RuleRow label="未使用分" value="月末に失効（貯められません）" highlight />
                <RuleRow label="受け取ったコイン" value="即時確定・保有コインに加算" />
                <RuleRow label="メッセージ" value="必須（何に対しての感謝か記載）" />
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-2">
                <p className="text-green-400 text-xs font-medium">
                  💡 ピアボーナスは「使わないと損」です。月末に失効するので、積極的に仲間を称えましょう！
                </p>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* 換金ルール */}
            {/* ============================================================ */}
            <Section title="換金（Exit）ルール" icon={Unlock}>
              <p>確定済みのコインは、以下の3つの方法で現金化できます。</p>

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-4 h-4 text-orange-400" />
                    <span className="font-semibold text-white text-sm">1. IPO / M&A時</span>
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <p>会社がIPOまたはM&Aを実現した時点で、全コインを現金化できます。</p>
                    <p>支払い: イグジット後90日以内 / 上限: なし</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-white text-sm">2. 年次バイバック（自社買い上げ）</span>
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <p>毎年12月に実施。希望者のみ申請できます。</p>
                    <p>上限: <strong className="text-blue-400">確定済みコインの20%まで</strong></p>
                    <p>支払い: 翌年1月末 / レート: 直近の時価総額記録時点の1コイン価格</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <LogOut className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-white text-sm">3. 退職時精算</span>
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <p>退職日から90日以内に申請。確定済みコインの100%を精算できます。</p>
                    <p>支払い: 申請後60日以内</p>
                    <p className="text-red-400">※ 未確定（ベスティング中）のコインは全て没収されます。</p>
                  </div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* 退職・解雇時の扱い */}
            {/* ============================================================ */}
            <Section title="退職・解雇時の扱い" icon={AlertTriangle}>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Clock className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">クリフ前退職（1年未満）</div>
                    <div className="text-xs text-red-400 font-semibold">→ 全コイン没収（ゼロ）</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <LogOut className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">クリフ後の自己都合退職</div>
                    <div className="text-xs text-white/60">→ 確定済み分のみ保持。未確定分は没収。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">会社都合解雇</div>
                    <div className="text-xs text-green-400">→ 全額即時確定</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Ban className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">懲戒解雇</div>
                    <div className="text-xs text-red-400 font-semibold">→ 全コイン没収</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* FAQ */}
            {/* ============================================================ */}
            <Section title="よくある質問" icon={HelpCircle}>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: コインは本当にお金になるの？</div>
                  <div className="text-xs text-white/60">A: はい。年次バイバック（毎年12月）で確定済みコインの20%まで現金化できます。また、IPO/M&A時には全額現金化されます。</div>
                </div>
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: 1コインの価値はどうやって決まるの？</div>
                  <div className="text-xs text-white/60">A: 会社の年間売上にPSR倍率（15倍）を掛けた擬似時価総額を、総発行コイン数で割って算出します。売上が伸びるほど1コインの価値も上がります。</div>
                </div>
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: ピアボーナスを使わなかったらどうなる？</div>
                  <div className="text-xs text-white/60">A: 月末に失効します。貯めることはできないので、毎月積極的に仲間を称えましょう。</div>
                </div>
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: 転職したら確定済みのコインはどうなる？</div>
                  <div className="text-xs text-white/60">A: 1年以上在籍していれば、確定済みのコインは保持されます。退職後90日以内に精算申請できます。</div>
                </div>
              </div>
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
