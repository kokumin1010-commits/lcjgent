import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyzeInfluencerBdEvidence, INFLUENCER_BD_AI_MODEL, INFLUENCER_BD_PROMPT_VERSION } from "../server/influencerBdAi";

const snapshot = {
  testOnly: true,
  notice: "Synthetic contract fixture. It is not LCJ production data and must not be persisted to any database.",
  scope: { type: "personal", staffId: 999001, campaignId: 999101, periodStart: "2026-08-26", periodEnd: "2026-08-27" },
  deterministicMetrics: {
    contactedCreators: 2,
    contactAttempts: 2,
    repliedCreators: 1,
    positiveCreators: 1,
    sampleCreators: 0,
    cooperatingCreators: 0,
    replyRate: 50,
    positiveReplyRate: 50,
    contactEfficiency: 50,
  },
  recordCount: 2,
  recordLimit: 500,
  truncated: false,
  campaigns: [{
    id: 999101,
    name: "Synthetic Q咕咕 contract test",
    productNameSnapshot: "Synthetic product",
    coreSellingPoints: "Only a contract-test selling point; not a real product claim.",
    creatorBenefits: "A clearly stated synthetic creator benefit.",
    commissionPolicy: null,
    samplePolicy: null,
    targetCreatorProfile: "Synthetic beauty creator segment",
    referenceOpeningScript: "Synthetic opening script",
    referenceFollowUpScript: "Synthetic follow-up",
    objectionHandling: null,
    status: "active",
  }],
  outreach: [
    {
      evidenceId: 999201,
      creatorRef: "creator-999301",
      campaignId: 999101,
      staffRoleRef: "staff-999001",
      activityDate: "2026-08-27",
      channel: "tiktok_dm",
      stage: "replied",
      contactCount: 1,
      responseType: "positive",
      replyReceived: true,
      positiveReply: true,
      sampleAdvanced: false,
      cooperationConfirmed: false,
      pitchText: "Synthetic concise message that states creator benefit first.",
      chatText: "Synthetic creator replied that they would like details.",
      issues: null,
      nextAction: "Send confirmed terms.",
      nextFollowUpDate: "2026-08-29",
      outcomeNotes: null,
      creatorProfile: { platform: "TikTok", followerCount: 10000, category: "beauty", country: "JP", language: "ja" },
    },
    {
      evidenceId: 999202,
      creatorRef: "creator-999302",
      campaignId: 999101,
      staffRoleRef: "staff-999001",
      activityDate: "2026-08-26",
      channel: "tiktok_dm",
      stage: "initial_contact",
      contactCount: 1,
      responseType: "none",
      replyReceived: false,
      positiveReply: false,
      sampleAdvanced: false,
      cooperationConfirmed: false,
      pitchText: "Synthetic long product-first message without a clear creator benefit.",
      chatText: null,
      issues: "No reply in synthetic fixture.",
      nextAction: "Test a shorter benefit-first variation.",
      nextFollowUpDate: "2026-08-29",
      outcomeNotes: null,
      creatorProfile: { platform: "TikTok", followerCount: 12000, category: "beauty", country: "JP", language: "ja" },
    },
  ],
  attachmentEvidence: [],
  priorFeedback: [],
};

const result = await analyzeInfluencerBdEvidence({ snapshot, imageUrls: [] });
const requiredTopLevel = [
  "executiveSummary", "dataQuality", "funnelDiagnosis", "rootCauses",
  "sellingPointGaps", "recommendedActions", "messageScripts",
  "creatorSegmentAdvice", "experiments", "warnings", "confidence",
];
for (const key of requiredTopLevel) {
  if (!(key in result)) throw new Error(`Missing required AI result field: ${key}`);
}
if (result.funnelDiagnosis.contactedCreators !== 2 || result.funnelDiagnosis.repliedCreators !== 1) {
  throw new Error("AI contract test did not preserve deterministic funnel counts");
}
if (!result.messageScripts.opening.zh || !result.messageScripts.opening.ja) {
  throw new Error("AI contract test did not return bilingual opening scripts");
}
const report = {
  checkedAt: new Date().toISOString(),
  model: INFLUENCER_BD_AI_MODEL,
  promptVersion: INFLUENCER_BD_PROMPT_VERSION,
  syntheticFixtureOnly: true,
  productionReads: 0,
  productionWrites: 0,
  requiredTopLevelFields: requiredTopLevel,
  deterministicMetricsPreserved: true,
  bilingualScriptsReturned: true,
  confidence: result.confidence,
  dataSufficient: result.dataQuality.sufficient,
  passed: true,
};
writeFileSync(resolve(process.cwd(), "influencer_bd_ai_contract_test.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");
console.log(JSON.stringify(report, null, 2));
