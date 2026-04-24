/**
 * LCJ Coin Help Dialog - ルール説明ヘルプマーク（日中バイリンガル）
 * 
 * スタッフ全員が見れるヘルプアイコン（？）をクリックすると
 * ベスティング・換金・ピアボーナス・Tier等のルールを表示
 * 日本語と中国語の両方で表示（中国人スタッフ対応）
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle, Lock, Unlock, Gift, ArrowRight, AlertTriangle,
  Rocket, RefreshCw, LogOut, Shield, Ban, Users, Clock, Coins,
  ChevronDown, ChevronUp, Star
} from "lucide-react";

function Section({ titleJa, titleZh, icon: Icon, children, defaultOpen = false }: {
  titleJa: string; titleZh: string; icon: any; children: React.ReactNode; defaultOpen?: boolean;
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
        <div className="flex-1">
          <span className="font-semibold text-white">{titleJa}</span>
          <span className="text-white/30 text-xs ml-2">{titleZh}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 text-sm text-white/70">{children}</div>}
    </div>
  );
}

function BiText({ ja, zh }: { ja: React.ReactNode; zh: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div>{ja}</div>
      <div className="text-white/40 text-xs">{zh}</div>
    </div>
  );
}

function RuleRow({ labelJa, labelZh, valueJa, valueZh, highlight }: {
  labelJa: string; labelZh: string; valueJa: string; valueZh: string; highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="min-w-[120px] flex-shrink-0">
        <span className="text-white/40">{labelJa}</span>
        <span className="text-white/20 text-[10px] ml-1">{labelZh}</span>
      </div>
      <div>
        <span className={highlight ? "text-orange-400 font-semibold" : "text-white/80"}>{valueJa}</span>
        <span className="text-white/30 text-[10px] ml-2">{valueZh}</span>
      </div>
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
              <div>
                LCJコイン ルールブック
                <div className="text-xs text-white/30 font-normal">LCJ代币规则手册</div>
              </div>
            </DialogTitle>
            <p className="text-sm text-white/40 mt-1">
              全スタッフ向け — LCJコインの仕組みと換金ルール
              <br />
              <span className="text-white/25 text-xs">面向全体员工 — LCJ代币的机制与兑换规则</span>
            </p>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {/* ============================================================ */}
            {/* LCJコインとは */}
            {/* ============================================================ */}
            <Section titleJa="LCJコインとは？" titleZh="什么是LCJ代币？" icon={Coins} defaultOpen={true}>
              <BiText
                ja={<p>LCJコインは、Live Commerce Japan（LCJ）が発行する<strong className="text-orange-400">ファントムストック（仮想株式）</strong>です。会社の時価総額が上がるほど、1コインの価値も上がります。</p>}
                zh={<p>LCJ代币是Live Commerce Japan（LCJ）发行的<strong className="text-orange-400">虚拟股权（Phantom Stock）</strong>。公司市值越高，每枚代币的价值也越高。</p>}
              />
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <div className="text-xs text-white/40 mb-1">計算式 / 计算公式</div>
                <div className="font-mono text-sm text-orange-400">
                  1コインの価値 = 擬似時価総額 ÷ 総発行コイン数
                </div>
                <div className="text-xs text-white/30 mt-1">
                  每枚代币价值 = 模拟市值 ÷ 总发行代币数
                </div>
                <div className="text-xs text-white/30 mt-2">
                  擬似時価総額 = 年間売上 × PSR倍率（15倍）
                </div>
                <div className="text-xs text-white/20">
                  模拟市值 = 年销售额 × PSR倍率（15倍）
                </div>
              </div>
              <BiText
                ja={<p className="text-white/50 text-xs">※ IPO時には実際の株式に転換される可能性があります。</p>}
                zh={<p className="text-white/30 text-xs">※ IPO时有可能转换为实际股份。</p>}
              />
            </Section>

            {/* ============================================================ */}
            {/* ベスティング（権利確定） */}
            {/* ============================================================ */}
            <Section titleJa="ベスティング（権利確定）スケジュール" titleZh="归属时间表" icon={Lock}>
              <BiText
                ja={<p>付与されたコインは、すぐには全額あなたのものになりません。<strong className="text-orange-400">3年間かけて毎月少しずつ「確定」</strong>していきます。</p>}
                zh={<p>授予的代币不会立即全部归属于您。将在<strong className="text-orange-400">3年内每月逐步"确权"</strong>。</p>}
              />

              <div className="space-y-1">
                <RuleRow labelJa="ベスティング期間" labelZh="归属期" valueJa="3年間（36ヶ月）" valueZh="3年（36个月）" />
                <RuleRow labelJa="クリフ期間" labelZh="锁定期" valueJa="1年間（12ヶ月）" valueZh="1年（12个月）" highlight />
                <RuleRow labelJa="確定スケジュール" labelZh="确权方式" valueJa="クリフ後、残り24ヶ月で毎月 1/24 ずつ確定" valueZh="锁定期后，剩余24个月每月确权1/24" />
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-2">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  クリフとは？ / 什么是锁定期？
                </div>
                <BiText
                  ja={<p className="text-white/60 text-xs">入社から1年未満で退職した場合、付与されたコインは<strong className="text-red-400">全て没収（ゼロ）</strong>になります。1年を超えると、毎月約4.17%ずつ確定していきます。</p>}
                  zh={<p className="text-white/30 text-xs">入职不满1年离职的情况下，授予的代币将<strong className="text-red-400">全部没收（归零）</strong>。超过1年后，每月约确权4.17%。</p>}
                />
              </div>

              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <div className="text-xs text-white/40 mb-2">具体例 / 具体示例: 10,000コイン付与の場合</div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-white/40">1〜12ヶ月目 / 第1-12个月</span><span className="text-red-400">0コイン確定（クリフ期間）</span></div>
                  <div className="flex justify-between"><span className="text-white/40">13ヶ月目 / 第13个月</span><span className="text-green-400">+417コイン確定</span></div>
                  <div className="flex justify-between"><span className="text-white/40">14ヶ月目 / 第14个月</span><span className="text-green-400">+417コイン確定（累計834）</span></div>
                  <div className="flex justify-between"><span className="text-white/40">...</span><span className="text-white/30">毎月+417コイン / 每月+417</span></div>
                  <div className="flex justify-between"><span className="text-white/40">36ヶ月目 / 第36个月</span><span className="text-orange-400">10,000コイン全額確定 🎉</span></div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* 付与の種類 */}
            {/* ============================================================ */}
            <Section titleJa="コイン付与の種類" titleZh="代币授予类型" icon={Gift}>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex-shrink-0">サインオン</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">入社時付与 <span className="text-white/30 text-xs">入职授予</span></div>
                    <div className="text-xs text-white/50">入社時にTierに基づいて付与。3年ベスティング・1年クリフ。</div>
                    <div className="text-xs text-white/25">入职时根据Tier等级授予。3年归属期、1年锁定期。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 flex-shrink-0">リフレッシュ</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">追加付与（年次） <span className="text-white/30 text-xs">年度追加授予</span></div>
                    <div className="text-xs text-white/50">年次評価で優秀な成績を収めた場合に追加付与。新たに3年ベスティング開始。</div>
                    <div className="text-xs text-white/25">年度考核优秀时追加授予。重新开始3年归属期。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 flex-shrink-0">スポット</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">特別報酬 <span className="text-white/30 text-xs">特别奖励</span></div>
                    <div className="text-xs text-white/50">大型案件獲得、プロジェクト成功等の特別貢献に対して。即時確定の場合あり。</div>
                    <div className="text-xs text-white/25">获得大型项目、项目成功等特殊贡献时。可能立即确权。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 flex-shrink-0">ピアボーナス</Badge>
                  <div>
                    <div className="font-medium text-white text-sm">仲間からの称賛 <span className="text-white/30 text-xs">同事互赞</span></div>
                    <div className="text-xs text-white/50">同僚から贈られるコイン。即時確定。毎月プールがリセット。</div>
                    <div className="text-xs text-white/25">同事赠送的代币。立即确权。每月额度重置。</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* Tier別テンプレート */}
            {/* ============================================================ */}
            <Section titleJa="Tier別付与テンプレート" titleZh="等级授予模板" icon={Star}>
              <BiText
                ja={<p>入社時の付与コイン数は、役職Tierと年収に基づいて自動計算されます。</p>}
                zh={<p className="text-white/30">入职时的代币授予数量根据职位等级和年薪自动计算。</p>}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 text-white/40 font-medium">Tier / 等级</th>
                      <th className="text-left py-2 text-white/40 font-medium">対象 / 对象</th>
                      <th className="text-right py-2 text-white/40 font-medium">係数 / 系数</th>
                      <th className="text-right py-2 text-white/40 font-medium">例: 年収500万</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-red-500/20 text-red-400 border-red-500/30">S</Badge></td>
                      <td className="py-2 text-white/60">CTO候補・VP</td>
                      <td className="py-2 text-right text-orange-400 font-mono">80%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥4,000,000</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">A</Badge></td>
                      <td className="py-2 text-white/60">コアエンジニア・事業責任者</td>
                      <td className="py-2 text-right text-orange-400 font-mono">30%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥1,500,000</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">B</Badge></td>
                      <td className="py-2 text-white/60">中堅エンジニア・セールス</td>
                      <td className="py-2 text-right text-orange-400 font-mono">12%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥600,000</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-2"><Badge className="bg-green-500/20 text-green-400 border-green-500/30">C</Badge></td>
                      <td className="py-2 text-white/60">CS・運用担当</td>
                      <td className="py-2 text-right text-orange-400 font-mono">5%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥250,000</td>
                    </tr>
                    <tr>
                      <td className="py-2"><Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">D</Badge></td>
                      <td className="py-2 text-white/60">事務・アシスタント</td>
                      <td className="py-2 text-right text-orange-400 font-mono">2%</td>
                      <td className="py-2 text-right text-white/60 font-mono">¥100,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-white/40 text-xs mt-2">
                ※ 計算式: (年収 × Tier係数) ÷ 現在の1コイン価格 = 付与コイン数
              </p>
              <p className="text-white/25 text-xs">
                ※ 计算公式: (年薪 × 等级系数) ÷ 当前每枚代币价格 = 授予代币数
              </p>
            </Section>

            {/* ============================================================ */}
            {/* ピアボーナス */}
            {/* ============================================================ */}
            <Section titleJa="ピアボーナス（相互称賛）" titleZh="同事互赞" icon={Users}>
              <BiText
                ja={<p>毎月、全社員に<strong className="text-orange-400">100コイン</strong>の「贈呈専用プール」が配布されます。仲間の貢献に感謝を込めてコインを贈りましょう。</p>}
                zh={<p className="text-white/30">每月向全体员工发放<strong className="text-orange-400">100枚代币</strong>的"赠送专用额度"。请向同事的贡献表示感谢并赠送代币。</p>}
              />
              <div className="space-y-1">
                <RuleRow labelJa="月間配布量" labelZh="月额度" valueJa="1人あたり100コイン/月" valueZh="每人100枚/月" />
                <RuleRow labelJa="1回の上限" labelZh="单次上限" valueJa="50コイン" valueZh="50枚" />
                <RuleRow labelJa="自分への送信" labelZh="自赠" valueJa="不可" valueZh="不可" highlight />
                <RuleRow labelJa="未使用分" labelZh="未使用部分" valueJa="月末に失効（貯められません）" valueZh="月末过期（不可累积）" highlight />
                <RuleRow labelJa="受け取ったコイン" labelZh="收到的代币" valueJa="即時確定・保有コインに加算" valueZh="立即确权、计入持有代币" />
                <RuleRow labelJa="メッセージ" labelZh="留言" valueJa="必須（何に対しての感謝か記載）" valueZh="必填（写明感谢原因）" />
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mt-2">
                <p className="text-green-400 text-xs font-medium">
                  💡 ピアボーナスは「使わないと損」です。月末に失効するので、積極的に仲間を称えましょう！
                </p>
                <p className="text-green-400/50 text-xs mt-1">
                  💡 同事互赞"不用就亏了"。月末会过期，请积极赞扬同事！
                </p>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* 換金ルール */}
            {/* ============================================================ */}
            <Section titleJa="換金（Exit）ルール" titleZh="兑换（退出）规则" icon={Unlock}>
              <BiText
                ja={<p>確定済みのコインは、以下の3つの方法で現金化できます。</p>}
                zh={<p className="text-white/30">已确权的代币可以通过以下3种方式兑现。</p>}
              />

              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Rocket className="w-4 h-4 text-orange-400" />
                    <span className="font-semibold text-white text-sm">1. IPO / M&A時 <span className="text-white/30 text-xs">IPO/并购时</span></span>
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <p>会社がIPOまたはM&Aを実現した時点で、全コインを現金化できます。</p>
                    <p className="text-white/30">公司IPO或被并购时，可将全部代币兑现。</p>
                    <p>支払い: イグジット後90日以内 / 上限: なし</p>
                    <p className="text-white/30">支付：退出后90天内 / 无上限</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-white text-sm">2. 年次バイバック <span className="text-white/30 text-xs">年度回购</span></span>
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <p>毎年12月に実施。希望者のみ申請できます。</p>
                    <p className="text-white/30">每年12月实施。仅限希望者申请。</p>
                    <p>上限: <strong className="text-blue-400">確定済みコインの20%まで</strong></p>
                    <p className="text-white/30">上限：<strong className="text-blue-400">已确权代币的20%</strong></p>
                    <p>支払い: 翌年1月末 / レート: 直近の時価総額記録時点の1コイン価格</p>
                    <p className="text-white/30">支付：次年1月底 / 汇率：最近市值记录时的每枚代币价格</p>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <LogOut className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-white text-sm">3. 退職時精算 <span className="text-white/30 text-xs">离职结算</span></span>
                  </div>
                  <div className="text-xs text-white/60 space-y-1">
                    <p>退職日から90日以内に申請。確定済みコインの100%を精算できます。</p>
                    <p className="text-white/30">离职日起90天内申请。可结算已确权代币的100%。</p>
                    <p>支払い: 申請後60日以内</p>
                    <p className="text-white/30">支付：申请后60天内</p>
                    <p className="text-red-400">※ 未確定（ベスティング中）のコインは全て没収されます。</p>
                    <p className="text-red-400/50">※ 未确权（归属中）的代币将全部没收。</p>
                  </div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* 退職・解雇時の扱い */}
            {/* ============================================================ */}
            <Section titleJa="退職・解雇時の扱い" titleZh="离职/解雇时的处理" icon={AlertTriangle}>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Clock className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">クリフ前退職（1年未満） <span className="text-white/30 text-xs">锁定期内离职（不满1年）</span></div>
                    <div className="text-xs text-red-400 font-semibold">→ 全コイン没収（ゼロ）/ 全部没收（归零）</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <LogOut className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">クリフ後の自己都合退職 <span className="text-white/30 text-xs">锁定期后主动离职</span></div>
                    <div className="text-xs text-white/60">→ 確定済み分のみ保持。未確定分は没収。</div>
                    <div className="text-xs text-white/30">→ 仅保留已确权部分。未确权部分没收。</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">会社都合解雇 <span className="text-white/30 text-xs">公司原因解雇</span></div>
                    <div className="text-xs text-green-400">→ 全額即時確定 / 全额立即确权</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <Ban className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-white text-sm">懲戒解雇 <span className="text-white/30 text-xs">惩戒解雇</span></div>
                    <div className="text-xs text-red-400 font-semibold">→ 全コイン没収 / 全部没收</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ============================================================ */}
            {/* FAQ */}
            {/* ============================================================ */}
            <Section titleJa="よくある質問" titleZh="常见问题" icon={HelpCircle}>
              <div className="space-y-4">
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: コインは本当にお金になるの？ <span className="text-white/30 text-xs">代币真的能变成钱吗？</span></div>
                  <div className="text-xs text-white/60">A: はい。年次バイバック（毎年12月）で確定済みコインの20%まで現金化できます。また、IPO/M&A時には全額現金化されます。</div>
                  <div className="text-xs text-white/30">A: 是的。通过年度回购（每年12月）可将已确权代币的20%兑现。IPO/并购时可全额兑现。</div>
                </div>
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: 1コインの価値はどうやって決まるの？ <span className="text-white/30 text-xs">每枚代币的价值如何确定？</span></div>
                  <div className="text-xs text-white/60">A: 会社の年間売上にPSR倍率（15倍）を掛けた擬似時価総額を、総発行コイン数で割って算出します。売上が伸びるほど1コインの価値も上がります。</div>
                  <div className="text-xs text-white/30">A: 用公司年销售额乘以PSR倍率（15倍）得出模拟市值，再除以总发行代币数。销售额越高，每枚代币价值越高。</div>
                </div>
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: ピアボーナスを使わなかったらどうなる？ <span className="text-white/30 text-xs">同事互赞不用会怎样？</span></div>
                  <div className="text-xs text-white/60">A: 月末に失効します。貯めることはできないので、毎月積極的に仲間を称えましょう。</div>
                  <div className="text-xs text-white/30">A: 月末过期。无法累积，请每月积极赞扬同事。</div>
                </div>
                <div>
                  <div className="font-medium text-white text-sm mb-1">Q: 転職したら確定済みのコインはどうなる？ <span className="text-white/30 text-xs">跳槽后已确权的代币怎么办？</span></div>
                  <div className="text-xs text-white/60">A: 1年以上在籍していれば、確定済みのコインは保持されます。退職後90日以内に精算申請できます。</div>
                  <div className="text-xs text-white/30">A: 在职满1年以上的话，已确权代币可以保留。离职后90天内可申请结算。</div>
                </div>
              </div>
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
