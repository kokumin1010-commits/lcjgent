export const LCF_REQUIRED_ROLE_QUESTIONS = [
  {
    id: "project_lead",
    role: "项目总负责人",
    question:
      "我是12月LCF项目总负责人。请根据9/8–9/9第一回全部资料，按时间顺序告诉我现在先做什么、负责人、截止时间、交付物、验收标准、风险和仍需确认事项。",
    requiredTerms: ["LCF", "负责人", "截止", "交付", "验收"],
  },
  {
    id: "booth_flow",
    role: "展位・动线负责人",
    question:
      "我是12月LCF展位与动线负责人。请根据LCJ Brain内部展位图和动线资料，列出我的完整执行流程、前置依赖、检查清单和升级对象。",
    requiredTerms: ["LCF", "展位", "动线", "负责人"],
  },
  {
    id: "materials",
    role: "物料负责人",
    question:
      "我是12月LCF物料负责人。请根据内部物料总表、物料清单和Check List，列出准备顺序、数量确认、负责人、交付时间和验收标准。",
    requiredTerms: ["LCF", "物料", "负责人", "验收"],
  },
  {
    id: "staff_checkin",
    role: "人员・签到负责人",
    question:
      "我是12月LCF人员与签到负责人。请根据人员配置、兼职分工和签到流程，列出每天的岗位、时间点、交接、异常处理和检查项。",
    requiredTerms: ["LCF", "人员", "签到", "负责人"],
  },
  {
    id: "live_guest",
    role: "直播・嘉宾负责人",
    question:
      "我是12月LCF直播与嘉宾负责人。请根据主播排班、嘉宾对应、论坛流程和摄影资料，列出完整流程、依赖、交付物和风险。",
    requiredTerms: ["LCF", "直播", "嘉宾", "负责人"],
  },
  {
    id: "brand_recruitment",
    role: "品牌招商负责人",
    question:
      "我是12月LCF品牌招商负责人。请根据意向品牌、品牌跟进和达播品牌资料，列出从邀约到现场履约的推进步骤、判断标准和未确认事项。",
    requiredTerms: ["LCF", "品牌", "招商", "负责人"],
  },
] as const;

export type LcfRequiredRoleQuestionId =
  (typeof LCF_REQUIRED_ROLE_QUESTIONS)[number]["id"];

export function getLcfRequiredRoleQuestion(id: unknown) {
  return LCF_REQUIRED_ROLE_QUESTIONS.find(item => item.id === id) || null;
}

export function isValidLcfRequiredQuestion(
  id: unknown,
  message: unknown
): id is LcfRequiredRoleQuestionId {
  const definition = getLcfRequiredRoleQuestion(id);
  const normalized = String(message ?? "")
    .normalize("NFKC")
    .trim();
  if (!definition || normalized.length < 30) return false;
  return definition.requiredTerms.every(term =>
    normalized.toLocaleLowerCase().includes(term.toLocaleLowerCase())
  );
}
