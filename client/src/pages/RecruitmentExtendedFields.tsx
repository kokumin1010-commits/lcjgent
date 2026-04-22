/**
 * 招商管理 拡張フィールドコンポーネント
 * create/editダイアログで共通利用する新フィールド群
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, Tag, TrendingUp, CalendarDays, Target, Star, Zap } from "lucide-react";

const BRAND_STAGE_OPTIONS = [
  { value: "startup", label: "初创期" },
  { value: "growth", label: "成长期" },
  { value: "mature", label: "成熟期" },
  { value: "famous", label: "知名品牌" },
];
const INTENT_LEVEL_OPTIONS = [
  { value: "high", label: "高意向" },
  { value: "normal", label: "普通" },
  { value: "dormant", label: "休眠" },
];
const CLIENT_VALUE_OPTIONS = [
  { value: "high", label: "高价值" },
  { value: "medium", label: "中价值" },
  { value: "low", label: "低价值" },
];
const FOLLOW_DIFFICULTY_OPTIONS = [
  { value: "easy", label: "容易" },
  { value: "medium", label: "普通" },
  { value: "hard", label: "困难" },
];

interface ExtendedFieldsProps {
  formData: {
    brandStage: string | null;
    annualRevenue: string | null;
    cooperationHistory: string | null;
    sourceChannel: string | null;
    wechat: string | null;
    websiteUrl: string | null;
    intentLevel: string | null;
    clientValue: string | null;
    followDifficulty: string | null;
    customTags: string | null;
    nextFollowDate: string | null;
    nextFollowAction: string | null;
  };
  onChange: (updates: Partial<ExtendedFieldsProps["formData"]>) => void;
}

export function ExtendedFormFields({ formData, onChange }: ExtendedFieldsProps) {
  return (
    <div className="space-y-4 border-t border-gray-700/50 pt-4 mt-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
        <Star className="w-3.5 h-3.5 text-yellow-500" /> 扩展信息
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 品牌阶段 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 品牌阶段
          </label>
          <Select value={formData.brandStage || ""} onValueChange={v => onChange({ brandStage: v || null })}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-xs">
              <SelectValue placeholder="选择阶段" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {BRAND_STAGE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-white text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 年收入 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">年收入规模</label>
          <Input value={formData.annualRevenue || ""} onChange={e => onChange({ annualRevenue: e.target.value || null })}
            className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="如: 1000万~5000万" />
        </div>

        {/* 合作历史 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">合作历史</label>
          <Input value={formData.cooperationHistory || ""} onChange={e => onChange({ cooperationHistory: e.target.value || null })}
            className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="如: 首次/二次合作" />
        </div>

        {/* 来源渠道 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">来源渠道</label>
          <Input value={formData.sourceChannel || ""} onChange={e => onChange({ sourceChannel: e.target.value || null })}
            className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="如: 展会/推荐/官网" />
        </div>

        {/* WeChat */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">微信</label>
          <Input value={formData.wechat || ""} onChange={e => onChange({ wechat: e.target.value || null })}
            className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="微信号" />
        </div>

        {/* Website */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
            <Globe className="w-3 h-3" /> 官网
          </label>
          <Input value={formData.websiteUrl || ""} onChange={e => onChange({ websiteUrl: e.target.value || null })}
            className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="https://..." />
        </div>
      </div>

      <div className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mt-3 mb-2">
        <Target className="w-3.5 h-3.5 text-blue-400" /> 智能标签
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* 意向度 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">意向度</label>
          <Select value={formData.intentLevel || ""} onValueChange={v => onChange({ intentLevel: v || null })}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-xs">
              <SelectValue placeholder="选择" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {INTENT_LEVEL_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-white text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 客户价值 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">客户价值</label>
          <Select value={formData.clientValue || ""} onValueChange={v => onChange({ clientValue: v || null })}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-xs">
              <SelectValue placeholder="选择" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {CLIENT_VALUE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-white text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 跟进难度 */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">跟进难度</label>
          <Select value={formData.followDifficulty || ""} onValueChange={v => onChange({ followDifficulty: v || null })}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-8 text-xs">
              <SelectValue placeholder="选择" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700">
              {FOLLOW_DIFFICULTY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-white text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* カスタムタグ */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
          <Tag className="w-3 h-3" /> 自定义标签
        </label>
        <Input value={formData.customTags || ""} onChange={e => onChange({ customTags: e.target.value || null })}
          className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="逗号分隔，如: VIP,重点客户,日本市场" />
      </div>

      <div className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mt-3 mb-2">
        <CalendarDays className="w-3.5 h-3.5 text-green-400" /> 下次跟进
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">下次跟进日期</label>
          <Input type="date" value={formData.nextFollowDate || ""} onChange={e => onChange({ nextFollowDate: e.target.value || null })}
            className="bg-gray-800 border-gray-700 text-white h-8 text-xs" />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">下次跟进内容</label>
          <Input value={formData.nextFollowAction || ""} onChange={e => onChange({ nextFollowAction: e.target.value || null })}
            className="bg-gray-800 border-gray-700 text-white h-8 text-xs" placeholder="如: 发送报价单" />
        </div>
      </div>
    </div>
  );
}

export { BRAND_STAGE_OPTIONS, INTENT_LEVEL_OPTIONS, CLIENT_VALUE_OPTIONS, FOLLOW_DIFFICULTY_OPTIONS };
