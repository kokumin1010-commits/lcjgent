import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, rateLimitedPublicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import * as iconv from "iconv-lite";
import * as chardet from "chardet";
import { sendCoachingToLiver } from "./_core/lineMessaging";
import { lessonsRouter } from "./lessonsRouter";
import { blogRouter, autoPostRouter } from "./blogRouter";
import { locationRouter } from "./locationRouter";
import {
  createStaff,
  getAllStaff,
  getActiveStaff,
  isActiveStaffByEmail,
  getStaffById,
  updateStaff,
  deleteStaff,
  createTask,
  getAllTasks,
  getAllTasksWithUsers,
  getTasksByStatus,
  getTasksByStaffId,
  getTaskById,
  getTaskByTaskId,
  updateTask,
  deleteTask,
  searchTasks,
  getInProgressTasks,
  createReminder,
  getRemindersByTaskId,
  getTaskStatistics,
  getAverageCompletionTime,
  assignStaffToTask,
  getStaffByTaskId,
  getRecentCompletedTasks,
  getStaffWithTaskCounts,
  getOverdueTasks,
  createEmailTracking,
  getEmailTrackingByTaskId,
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
  getStaffReportStatistics,
  searchReports,
  getReportsForAnalysis,
  createReportStaff,
  getAllReportStaff,
  getActiveReportStaff,
  getReportStaffById,
  updateReportStaff,
  createBrand,
  getAllBrands,
  getBrandById,
  updateBrand,
  deleteBrand,
  createBrandProduct,
  getProductsByBrandId,
  getProductsByBrandIdWithGmv,
  getBrandProductById,
  updateBrandProduct,
  deleteBrandProduct,
  createBrandActivity,
  getActivitiesByBrandId,
  updateBrandActivity,
  deleteBrandActivity,
  getBrandStatistics,
  deleteReportStaff,
  getReportStaffByCountry,
  getReportsByLinkedStaffId,
  getReportStaffByLinkedStaffId,
  getAllReportStaffWithLinkedStaff,
  autoLinkReportStaffToStaff,
  createStaffFromReportStaff,
  getReportCountByReportStaffId,
  getReportsByReportStaffId,
  createBrandLivestream,
  getLivestreamsByBrandId,
  updateBrandLivestream,
  deleteBrandLivestream,
  getLivestreamStatsByBrandId,
  createReportFollowup,
  getPendingFollowups,
  getOverdueFollowups,
  updateFollowupStatus,
  getFollowupsByReportId,
  getFollowupsByStaffId,
  deleteReportFollowup,
  checkExistingFollowup,
  getFollowupById,
  getCompletedFollowups,
  linkNextAction,
  createBusinessCard,
  getBusinessCardById,
  getBusinessCards,
  checkDuplicateBusinessCard,
  updateBusinessCard,
  deleteBusinessCard,
  getBusinessCardCount,
  getBrandLcjStaff,
  assignLcjStaffToBrand,
  removeLcjStaffFromBrand,
  setBrandLcjStaff,
  getBrandsByLcjStaff,
  createActivityLog,
  getRecentActivityLogs,
  getActivityLogsByUser,
  getAllUsers,
  getUserActivityStats,
  createBrandContract,
  getContractsByBrandId,
  getContractById,
  updateBrandContract,
  deleteBrandContract,
  getActiveContractsCount,
  getAllContracts,
  createReportAiAdvice,
  getAiAdviceByReportId,
  getAiAdviceById,
  createAiAdviceFeedback,
  getFeedbackByAdviceId,
  getUserFeedbackForAdvice,
  updateAiAdviceFeedback,
  upsertAiLearningExample,
  getGoodLearningExamples,
  getBadLearningExamples,
  getAiFeedbackStats,
  createChatReportSession,
  getChatSessionById,
  getTodayChatSession,
  getChatSessionsByStaffId,
  updateChatSessionStatus,
  addChatMessage,
  getMessagesBySessionId,
  getUserMessagesFromSession,
  getOrCreateStaffAiProfile,
  updateStaffAiProfile,
  incrementStaffChatCount,
  updateStaffFeedbackCounts,
  getQuestionTemplatesForDay,
  getAllActiveQuestionTemplates,
  createQuestionTemplate,
  incrementQuestionUsage,
  updateQuestionFeedback,
  getRecentReportsByStaffId,
  getAllLineUsers,
  getAllLineGroups,
  getLineUsersWithLiverDetails,
  getLiverInteractionSummary,
  getLineMessages,
  saveLineMessage,
  createLineFollowUp,
  getActiveLineFollowUps,
  updateLineFollowUpStatus,
  getAllLineFollowUps,
  updateLineGroupAutoFollowUp,
  getPendingResponsesForUI,
  cancelPendingResponse,
  markMessageResponded,
  createSchedule,
  getScheduleById,
  getSchedulesByDate,
  getSchedulesByDateRange,
  getSchedulesByLiverName,
  getSchedulesByAgency,
  getLiverNamesByAgency,
  updateSchedule,
  deleteSchedule,
  updateRecurringSchedules,
  deleteRecurringSchedules,
  getUpcomingSchedules,
  createLiver,
  getLiverByEmail,
  getLiverById,
  getAllActiveLivers,
  getAllLivers,
  updateLiver,
  updateLiverLastLogin,
  checkLiverEmailExists,
  getSchedulesByLiverId,
  getSchedulesByBrandId,
  getDistinctLiversForBrandSchedules,
  createLivestreamProduct,
  getLivestreamProductsByLivestreamId,
  updateLivestreamProduct,
  deleteLivestreamProduct,
  getLivestreamProductsTotalGmv,
  deleteLivestreamProductsByLivestreamId,
  getMonthlyGmvSummary,
  createBrandMemo,
  getMemosByBrandId,
  deleteBrandMemo,
  updateBrandMemo,
  createContractLivestreamLink,
  getContractLivestreamLinks,
  getContractLinkedLivestreams,
  deleteContractLivestreamLink,
  deleteAllContractLivestreamLinks,
  checkContractLivestreamLinkExists,
  calculateContractRoas,
  getLivestreamsByLiverId,
  getLiverStatistics,
  getLiverRankings,
  getTotalLiverSalesSummary,
  getLiverMonthlySalesTrend,
  getLiverDetailWithStats,
  getLiverMonthlySalesTrendById,
  getAllLiversMonthlyTrend,
  getLiverRecentLivestreams,
  getLiverGrowthData,
  getLiverBrandPerformance,
  getTopProductsByLiver,
  getLiverCategoryAnalysis,
  getAllProductCategoryMappings,
  upsertProductCategoryMapping,
  bulkUpsertProductCategoryMappings,
  deleteProductCategoryMapping,
  getDistinctMappingCategories,
  getLivestreamById,
  updateLivestreamResult,
  getLiversWithStats,
  createBrandEditLog,
  getBrandEditLogs,
  logBrandEdit,
  getProductImages,
  getProductReviewImages,
  addProductImage,
  deleteProductImage,
  reorderProductImages,
  getBrandFiles,
  createBrandFile,
  deleteBrandFile,
  getBrandFileById,
  getProductLinks,
  addProductLink,
  updateProductLink,
  deleteProductLink,
  getProductLinksForProducts,
  getAllLivestreams,
  getAllProducts,
  findExistingLivestream,
  updateLivestreamFromCsv,
  createLivestreamFromCsv,
  getCsvImportedLivestreams,
  importLivestreamProductsFromCsv,
  createCsvImportHistory,
  getCsvImportHistoryByLivestream,
  deleteCsvImportHistory,
  createLivestreamCsvImportHistory,
  getLivestreamCsvImportHistoryByLiver,
  deleteLivestreamCsvImportHistory,
  createAdProposalHistory,
  getAdProposalsByBrandId,
  getAdProposalById,
  getLatestProposalVersion,
  updateAdProposalStatus,
  deleteAdProposal,
  createOrUpdateLineUser,
  getLineUserByLineId,
  getLineUserByEmail,
  createEmailLineUser,
  getLineUserById,
  getLinePointBalance,
  getLinePointTransactions,
  getLineReceiptsByUser,
  getMallProducts,
  getMallProductById,
  getMallProductsByBrandIdDirect,
  createMallProduct,
  updateMallProduct,
  deleteMallProduct,
  getMallCategories,
  getAllMallCategoryRecords,
  getMallCategoryById,
  createMallCategory,
  updateMallCategory,
  deleteMallCategory,
  getMallCart,
  addToMallCart,
  updateMallCartQuantity,
  removeFromMallCart,
  clearMallCart,
  createMallOrder,
  getMallOrders,
  getMallOrderById,
  updateMallOrderStatus,
  cancelMallOrder,
  getMallOrdersByLineUser,
  updateMallOrderStripeInfo,
  getMallOrderByOrderNumber,
  getMallOrderByStripeSessionId,
  useLinePoints,
  getUserAddresses,
  getUserAddressById,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultUserAddress,
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenAsUsed,
  updateLineUserPassword,
  createLineLinkCode,
  verifyAndUseLinkCode,
  linkLineAccountToEmailUser,
  checkLineAccountLinked,
  getActiveLinkCode,
  saveScreenshotAnalysis,
  getAnalysisByImageHash,
  getAnalysisHistoryByLiverId,
  getAnalysisHistoryByLivestreamId,
  getRecentAnalysisHistory,
  createPointRequest,
  getPointRequestById,
  getPointRequestsByUserId,
  getPendingPointRequests,
  getAllPointRequests,
  checkOrderNumberExists,
  countTodayPointRequestsByUser,
  approvePointRequest,
  rejectPointRequest,
  getUserPointBalance,
  getUserPointTransactions,
  getExpiringPoints,
  getExpiringLinePoints,
  extendLinePointExpiry,
  getNextLinePointExpiry,
  createUserPasswordResetToken,
  getUserPasswordResetToken,
  markUserPasswordResetTokenUsed,
  updateUserPassword,
  getUserByEmail,
  createScheduleGroup,
  getAllScheduleGroups,
  getScheduleGroupById,
  updateScheduleGroup,
  deleteScheduleGroup,
  addLiverToScheduleGroup,
  removeLiverFromScheduleGroup,
  getScheduleGroupMembers,
  getAllScheduleGroupsWithMembers,
  setScheduleGroupMembers,
  getLivestreamsByStreamerName,
  getLiverMonthlyGrowth,
  getLiverBrandDurationStats,
  addProductLiver,
  removeProductLiver,
  getProductLivers,
  getLiversByProductId,
  getProductsByLiverId,
  bulkAddProductLivers,
  updateProductLivers,
  getLiverSalesStatsByBrand,
  getProductSalesRanking,
  getLiverProductMatrix,
  getLiverPerformanceForMatching,
  getProductPerformanceForMatching,
  getLiverProductPerformanceMatrix,
  getProductMasters,
  getProductMasterById,
  createProductMaster,
  updateProductMaster,
  deleteProductMaster,
  addProductAlias,
  removeProductAlias,
  getProductAliases,
  getUnlinkedProductNames,
  getProductMastersForMatching,
  createAliasSuggestion,
  getPendingAliasSuggestions,
  approveAliasSuggestion,
  rejectAliasSuggestion,
  getHourlySalesAnalysis,
  getDayOfWeekPerformance,
  createAdCampaign,
  getAdCampaignsByBrandId,
  getAdCampaignById,
  updateAdCampaign,
  deleteAdCampaign,
  createAdMetrics,
  getAdMetricsByCampaignId,
  updateAdMetrics,
  createAdCountryBreakdown,
  getAdCountryBreakdownByCampaignId,
  getAdCampaignStatsByBrandId,
  createAdReportFile,
  getAdReportFilesByBrandId,
  getAdReportFileById,
  updateAdReportFileAnalysis,
  deleteAdReportFile,
  createTiktokCsvImportHistory,
  updateTiktokCsvImportHistory,
  getTiktokCsvImportHistoryByBrand,
  bulkInsertTiktokOrders,
  getTiktokOrdersByBrand,
  getTiktokFinanceSummary,
  getTiktokCreatorSummary,
  getTiktokShopSummary,
  getTiktokProductSummary,
  getTiktokProductCreatorBreakdown,
  getTiktokDailySummary,
  getTiktokContentTypeSummary,
  getTiktokMonthlySummary,
  deleteTiktokOrdersByImportId,
  deleteTiktokImportHistory,
  insertTiktokPayments,
  getTiktokPaymentsSummary,
  getTiktokPaymentsByMonth,
  getTiktokPaymentsList,
  getExistingPaymentReferenceIds,
  deleteTiktokPayment,
  getExistingSubOrderIds,
  bulkInsertTiktokTapReports,
  getTiktokTapSummary,
  getTiktokTapCreatorSummary,
  getTiktokTapShopSummary,
  getTiktokTapMonthlySummary,
  getTiktokTapProductSummary,
  deleteTiktokTapReportsByMonth,
  getTiktokTapAvailableMonths,
  getTiktokTapLiveSummary,
  getTiktokTapLiveCreatorSummary,
  getTiktokTapLiveMonthlySummary,
  getTiktokTapLiveTopSessions,
  getTiktokTapVideoSummary,
  getTiktokTapVideoCreatorSummary,
  getTiktokTapVideoMonthlySummary,
  getTiktokTapVideoTopVideos,
  getTiktokTapCreatorProductMatrix,
  getTiktokTapLiveEfficiency,
  getTiktokTapCreatorProfitability,
  getTiktokTapCreatorProductBreakdown,
  getTiktokTapProductCreatorBreakdown,
  bulkInsertCapCreatorReports,
  bulkInsertCapProductReports,
  deleteCapCreatorReportsByMonth,
  deleteCapProductReportsByMonth,
  getCapCreatorSummary,
  getCapProductSummary,
  getCapCreatorProductBreakdown,
  getCapProductCreatorBreakdown,
  getCapAvailableMonths,
  createLivestreamSet,
  createLivestreamSetItem,
  getLivestreamSetsByLivestreamId,
  deleteLivestreamSetsByLivestreamId,
  createLivestreamPromotion,
  getLivestreamPromotionsByLivestreamId,
  deleteLivestreamPromotionsByLivestreamId,
  getLiverPerformanceStats,
  findSimilarCases,
  createSimulation,
  getSimulationById,
  getSimulationByToken,
  listSimulations,
  updateSimulation,
  deleteSimulation,
  createSimulationFeedback,
  getSimulationFeedbackHistory,
  getAllLiversSetAnalysis,
  getLiverSetAnalysis,
  getLiverPromotionAnalysis,
  searchSets,
  getProductReviews,
  getProductReviewStats,
  createProductReview,
  deleteProductReview,
  hasUserReviewedProduct,
  getAllProductReviewStats,
  getRelatedProducts,
  getProductDescImages,
  addProductDescImage,
  deleteProductDescImage,
  getReferralCodeByCode,
  applyReferralCode,
  hasUsedReferralCode,
  getAllReferralCodes,
  addMallFavorite,
  removeMallFavorite,
  getMallFavoritesByUser,
  getMallFavoriteProductIds,
  getMallFavoriteCounts,
  recordMallViewHistory,
  getMallViewHistoryByUser,
  getMallDashboardStats,
  getMallSalesChart,
  getMallMemberGrowthChart,
  createReceiptReviewLog,
  getReviewDecisionTrend,
  getRejectionCategoryDistribution,
  getOcrConfidenceCorrelation,
  getAutoApprovalEstimation,
  getReviewLogsSummary,
  getReviewLogsDailyTrend,
  getReviewLogsRejectionDistribution,
  getReviewLogsOcrCorrelation,
  getAutoApprovalSimulation,
  getAitherhubSyncLogs,
  getAitherhubSyncStats,
  getReceiptAnalyticsOverview,
  getShopRanking,
  getProductRanking,
  getReceiptMonthlyTrend,
  getRepeaterAnalysis,
  getRegionAnalysis,
  getAiConfidenceAnalysis,
  getTimeAnalysis,
  getBrandRanking,
  getBrandProductRanking,
  createRestockRequest,
  cancelRestockRequest,
  getUserRestockRequests,
  getRestockRequestCounts,
  getRestockRequestsByBrand,
  getRestockRequestDetailByBrand,
  getRecommendedProducts,
  getPopularProducts,
  extractReceiptProducts,
  extractSingleReceiptProducts,
  getReceiptPurchaseRanking,
  getReceiptShopRanking,
  getReceiptProductsByShop,
  getActiveReferralCampaign,
  getOrCreateUserReferralProgress,
  getUserProgressByReferralCode,
  getCampaignStages,
  recordFriendReferral,
  hasAlreadyBeenReferred,
  getTodayReferralCount,
  updateUserReferralProgress,
  getSpinRewardItems,
  recordSpinResult,
  getReferralLeaderboard,
  addReferralActivity,
  getReferralActivityFeed,
  getUserReferralHistory,
  getUserSpinHistoryList,
  calculateTitleLevel,
  createKakuhenResult,
  getKakuhenResultById,
  getKakuhenResultsByUserId,
  getKakuhenResultsByLineUserId,
  getJackpotWinners,
  getKakuhenStats,
  createReceiptReview,
  getReceiptReviewById,
  searchReceiptReviewsByProduct,
  getLatestReceiptReviews,
  getReceiptReviewsByUserId,
  getReceiptReviewsByLineUserId,
  incrementReviewHelpful,
  reportReceiptReview,
  getReceiptReviewStats,
  getProductReviewRanking,
  getReceiptReviewCount,
  getAdminReceiptReviews,
  getKakuhenAdminStats,
  getVideoReviews,
  addReviewReaction,
  removeReviewReaction,
  getReviewReactionCountsBatch,
  getUserReactions,
  createReviewQuestion,
  answerReviewQuestion,
  getReviewQuestions,
  getLatestQuestions,
  getReviewerCertifiedCounts,
  getPlatformDistribution,
  getWantRanking,
  getProductReviewRankingEnhanced,
  getReviewProductList,
  bulkUpdateProductSourceUrls,
  getProductMasterImageByName,
  getBwLinkedAccount,
  createBwLinkToken,
  completeBwLink,
  unlinkBwAccount,
  exchangePointsToBw,
  updateBwTransferStatus,
  getPointExchangeHistory,
  getMonthlyExchangeSummary,
  getAllPointExchanges,
  getPendingExchanges,
  createPopupVariant,
  getAllPopupVariants,
  getActivePopupVariants,
  getPopupVariantById,
  updatePopupVariant,
  recordPopupImpression,
  recordPopupClick,
  selectPopupVariantBandit,
  getPopupStats,
  seedPopupVariants,
  createLivestreamBrand,
  getLivestreamBrandsByLivestreamId,
  deleteLivestreamBrandsByLivestreamId,
  createBrandAdditionLog,
  getAllBrandAdditionLogs,
  createBrandByLiver,
  createBrandSampleApplication,
  listBrandSampleApplications,
  getBrandSampleApplicationById,
  updateBrandSampleApplicationStatus,
  countBrandSampleApplications,
  getLivestreamsForSalesCheck,
  correctLivestreamData,
  recordAbTestEvent,
  getAbTestStats,
  getAbTestRecentEvents,
  ensureLiveSuggestionsTable,
  saveLiveSuggestion,
  getLiveSuggestionsByDate,
  getLiveSuggestionHistory,
  getTodaySchedulesForSuggestion,
  getRecentLivestreamDataForSuggestion,
  getTopProductsForSuggestion,
  getRecentSetsForSuggestion,
  getLiverMonthlySummaryForSuggestion,
  getQuotaBrandsForLiver,
  getLiverMonthlyProducts,
  getAllMasterSetSuggestions,
  getActiveMasterSetSuggestionsForLiver,
  createMasterSetSuggestion,
  createMasterSetSuggestionItems,
  updateMasterSetSuggestion,
  deleteMasterSetSuggestion,
  createMasterSetAdoption,
  getLiverAdoptions,
  getAllAdoptions,
  updateAdoptionResults,
  autoLinkAdoptionResults,
  getSuggestionPerformanceMetrics,
  getHistoricalDiscountRateStats,
  createMasterSetFeedback,
  getFeedbackBySuggestion,
  getAllFeedback,
  createMasterSetReview,
  getReviewsBySuggestion,
  getReviewsByLiver,
  getAllReviews,
  getFeedbackPatternAnalysis,
  getFeedbackSummaryForAI,
} from "./db";
import { generateImage } from "./_core/imageGeneration";
import { pushMessage, leaveGroup } from "./line";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { lineUsers, brands, lineGroups, schedules, adAlertHistory, adInvestmentRecords, brandAdPerformanceStats, tiktokCommissionOrders, livestreamSets, livestreamSetItems, simulations, livers, userReferralProgress, productMaster, bwLinkedAccounts, livestreamBrands, brandAdditionLogs, staff, reportStaff, reports, reportFollowups, brandLivestreams, agencies, tiktokCapCreatorReports, liverGoals, aiCoachMessages, aiCoachRooms, brandContracts, masterSetSuggestions, masterSetSuggestionItems, masterSetAdoptions, masterSetFeedback, masterSetReviews } from "../drizzle/schema";
import { eq, and, or, not, isNotNull, isNull, desc, gt, gte, lte, like, inArray, sql as sqlTag, sum, count, max } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { authRouter } from "./auth";
import { liverRouter } from "./liverRouter";
import { setApplicationRouter } from "./setApplicationRouter";
import { sampleRequestRouter } from "./sampleRequestRouter";
import { recruitmentRouter } from "./recruitmentRouter";
import { emailRouter } from "./emailRouter";
import { adFormRouter } from "./adFormRouter";
import { tspRouter } from "./tspRouter";
import { agencyRouter } from "./agencyRouter";
import { brandPortalRouter } from "./brandPortalRouter";
import { adDashboardRouter } from "./adDashboardRouter";
import { svmRouter } from "./svmRouter";
import { lcjCoinRouter } from "./lcjCoinRouter";
import { checkAndSendReminders } from "./reminderScheduler";
// Blog/AutoPost関連のimportはserver/blogRouter.tsに移動済み
import { completionRouter } from "./completion";
import { sendReminderEmail } from "./emailService";
import { transcribeAudio } from "./_core/voiceTranscription";
import { bwExchangeTokens, bwLookupCustomer } from "./bw-api";

// ============================================
// LINE Login API for MALL (General User Authentication)
// ============================================

// Helper function to get LINE session from cookie or Authorization header
function getLineSession(ctx: { req: { cookies?: { line_session?: string }; headers: { authorization?: string } } }): string | null {
  // Try to get session from cookie first
  let sessionCookie = ctx.req.cookies?.line_session;
  
  // If no cookie, try Authorization header (for localStorage fallback)
  if (!sessionCookie) {
    const authHeader = ctx.req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        sessionCookie = Buffer.from(token, 'base64').toString('utf-8');
      } catch {
        // Invalid token format
      }
    }
  }
  
  return sessionCookie || null;
}

// Helper function to get LINE user from session
async function getLineUserFromSession(ctx: { req: { cookies?: { line_session?: string }; headers: { authorization?: string } } }): Promise<{
  lineUser: Awaited<ReturnType<typeof getLineUserByLineId>> | Awaited<ReturnType<typeof getLineUserById>>;
  session: { lineUserId?: string; userId?: number; expiresAt?: number };
} | null> {
  const sessionCookie = getLineSession(ctx);
  if (!sessionCookie) {
    return null;
  }
  
  try {
    const session = JSON.parse(sessionCookie);
    
    // Check session expiration
    if (session.expiresAt && session.expiresAt < Date.now()) {
      return null;
    }
    
    // Support both LINE login (lineUserId) and email login (userId)
    let lineUser = null;
    if (session.lineUserId && !session.lineUserId.startsWith('email_')) {
      lineUser = await getLineUserByLineId(session.lineUserId);
    } else if (session.userId) {
      lineUser = await getLineUserById(session.userId);
    } else if (session.lineUserId) {
      // email login with email_ prefix
      lineUser = await getLineUserById(parseInt(session.lineUserId.replace('email_', '')));
    }
    
    if (!lineUser) {
      return null;
    }
    
    return { lineUser, session };
  } catch {
    return null;
  }
}

// LINE Login configuration
const LINE_LOGIN_CHANNEL_ID = process.env.LINE_LOGIN_CHANNEL_ID || "";
const LINE_LOGIN_CHANNEL_SECRET = process.env.LINE_LOGIN_CHANNEL_SECRET || "";
const LINE_LOGIN_CALLBACK_URL = process.env.APP_URL ? `${process.env.APP_URL}/line-callback` : "";

// Generate LINE Login URL
export function getLineLoginUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINE_LOGIN_CHANNEL_ID,
    redirect_uri: LINE_LOGIN_CALLBACK_URL,
    state: state,
    scope: "profile openid",
    prompt: "consent", // Always show consent screen to ensure code is returned
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

// Exchange authorization code for access token
async function exchangeLineCode(code: string): Promise<{
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
} | null> {
  try {
    const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: LINE_LOGIN_CALLBACK_URL,
        client_id: LINE_LOGIN_CHANNEL_ID,
        client_secret: LINE_LOGIN_CHANNEL_SECRET,
      }).toString(),
    });
    
    if (!response.ok) {
      console.error("[LINE Login] Token exchange failed:", await response.text());
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("[LINE Login] Token exchange error:", error);
    return null;
  }
}

// Get LINE user profile
async function getLineProfile(accessToken: string): Promise<{
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
} | null> {
  try {
    const response = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      console.error("[LINE Login] Profile fetch failed:", await response.text());
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("[LINE Login] Profile fetch error:", error);
    return null;
  }
}

// LINE Login router for MALL users
export const lineLoginRouter = router({
  // Get LINE Login URL
  getLoginUrl: publicProcedure.query(async () => {
    const state = nanoid(32);
    const loginUrl = getLineLoginUrl(state);
    return { loginUrl, state };
  }),
  
  // Handle LINE Login callback
  callback: publicProcedure
    .input(z.object({
      code: z.string(),
      state: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Exchange code for token
      const tokenData = await exchangeLineCode(input.code);
      if (!tokenData) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "LINE認証に失敗しました",
        });
      }
      
      // Get user profile
      const profile = await getLineProfile(tokenData.access_token);
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "LINEプロフィールの取得に失敗しました",
        });
      }
      
      // Upsert LINE user
      const lineUser = await createOrUpdateLineUser({
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
        userType: "customer",
      });
      
      if (!lineUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ユーザー登録に失敗しました",
        });
      }
      
      // Create session token for LINE user
      const sessionData = {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000, // 10 years for persistent login
      };
      
      // Set session cookie (10 years for persistent login)
      ctx.res.cookie("line_session", JSON.stringify(sessionData), {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 3650 * 24 * 60 * 60 * 1000, // 10 years for persistent login
      });
      
      return {
        success: true,
        user: {
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        },
      };
    }),
  
  // Get current LINE user session
  me: publicProcedure.query(async ({ ctx }) => {
    // Try to get session from cookie first
    let sessionCookie = ctx.req.cookies?.line_session;
    let sessionSource: 'cookie' | 'header' = 'cookie';
    
    // If no cookie, try Authorization header (for localStorage fallback)
    if (!sessionCookie) {
      const authHeader = ctx.req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          sessionCookie = Buffer.from(token, 'base64').toString('utf-8');
          sessionSource = 'header';
        } catch {
          return null;
        }
      }
    }
    
    if (!sessionCookie) {
      return null;
    }
    
    try {
      const session = JSON.parse(sessionCookie);
      if (session.expiresAt < Date.now()) {
        return null;
      }
      
      // Get fresh user data from database
      // Support both LINE login (lineUserId) and email login (userId)
      let lineUser = null;
      if (session.lineUserId && !session.lineUserId.startsWith('email_')) {
        lineUser = await getLineUserByLineId(session.lineUserId);
      } else if (session.userId) {
        lineUser = await getLineUserById(session.userId);
      }
      
      if (!lineUser) {
        return null;
      }
      
      // Get point balance - use lineUserId or email_${id} fallback for email-only users
      const pointLookupId = lineUser.lineUserId || `email_${lineUser.id}`;
      const pointBalance = await getLinePointBalance(pointLookupId);
      
      // Generate sessionToken for localStorage sync
      // This ensures that even if the user logged in via cookie,
      // the frontend can save the token to localStorage for cross-page navigation
      const sessionToken = Buffer.from(JSON.stringify(session)).toString('base64');
      
      return {
        id: lineUser.id, // line_users.id (int)
        lineUserId: lineUser.lineUserId || `email_${lineUser.id}`,
        displayName: lineUser.displayName,
        pictureUrl: lineUser.pictureUrl,
        email: lineUser.email,
        points: pointBalance?.balance || 0,
        lifetimePoints: pointBalance?.totalEarned || 0,
        sessionToken, // Always return session token for localStorage sync
      };
    } catch {
      return null;
    }
  }),
  
  // LIFF callback - authenticate using LIFF access token or ID token
  liffCallback: publicProcedure
    .input(z.object({
      accessToken: z.string(),
      referralCode: z.string().length(4).regex(/^\d{4}$/).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // First try to get profile using access token
      let profile = await getLineProfile(input.accessToken);
      
      // If failed, try to decode as ID token (JWT)
      if (!profile) {
        console.log("[LINE Login] Access token failed, trying to decode as ID token...");
        try {
          // ID token is a JWT, decode the payload
          const parts = input.accessToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            console.log("[LINE Login] ID token payload:", payload);
            if (payload.sub) {
              profile = {
                userId: payload.sub,
                displayName: payload.name || 'LINE User',
                pictureUrl: payload.picture,
              };
            }
          }
        } catch (decodeErr) {
          console.error("[LINE Login] ID token decode error:", decodeErr);
        }
      }
      
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "LINEプロフィールの取得に失敗しました",
        });
      }
      
      // Upsert LINE user
      const lineUser = await createOrUpdateLineUser({
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
        userType: "customer",
      });
      
      if (!lineUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ユーザー登録に失敗しました",
        });
      }
      
      // Register pending referral if code provided (points awarded on first purchase)
      if (input.referralCode) {
        try {
          const { getReferralCodeByCode, registerPendingReferral, hasUsedReferralCode, getLiverById, createLinePointTransaction } = await import("./db");
          const alreadyUsed = await hasUsedReferralCode(lineUser.id);
          if (!alreadyUsed) {
            const referralResult = await getReferralCodeByCode(input.referralCode);
            if (referralResult) {
              const liver = await getLiverById(referralResult.referralCode.liverId);
              if (!liver?.lineUserId || lineUser.lineUserId !== liver.lineUserId) {
                await registerPendingReferral(
                  referralResult.referralCode.id,
                  referralResult.referralCode.liverId,
                  lineUser.id,
                  500,
                  200
                );
                
                // Award 500pt to new user immediately at registration
                await createLinePointTransaction({
                  lineUserId: lineUser.lineUserId || `email_${lineUser.id}`,
                  type: "earn",
                  amount: 500,
                  referenceType: "system",
                  description: `紹介コード特典: 500ポイント獲得（新規登録ボーナス）`,
                });
                console.log(`[Referral] 500pt awarded to LINE user ${lineUser.id} at registration via code ${input.referralCode}`);
                
                // ライバーにLINE通知を送信（紹介コードが使われた）
                try {
                  if (liver?.lineUserId) {
                    const { pushMessage } = await import("./line");
                    const appUrl = process.env.APP_URL || "https://lcjmall.com";
                    await pushMessage(liver.lineUserId, [{
                      type: "text",
                      text: `🎉 紹介コードが使われました！\n\nあなたの紹介コード「${input.referralCode}」で新しいユーザーが登録しました。\n\n※ あなたへの200ptはこのユーザーが初回購入を完了した時点で付与されます。\n\n📊 紹介実績を確認\n${appUrl}/liver-mypage`
                    }]);
                  }
                } catch (notifyErr: any) {
                  console.error(`[Referral] Failed to send LINE notification to liver:`, notifyErr.message);
                }
              }
            }
          }
        } catch (err: any) {
          console.error(`[Referral] Failed to register pending referral for LINE user:`, err.message);
        }
      }
      
      // Create session token for LINE user
      const sessionData = {
        lineUserId: profile.userId,
        userId: lineUser.id,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000, // 10 years for persistent login
      };
      
      // Create session token for localStorage fallback
      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');
      
      // Set session cookie (10 years for persistent login)
      ctx.res.cookie("line_session", JSON.stringify(sessionData), {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 3650 * 24 * 60 * 60 * 1000, // 10 years for persistent login
      });
      
      return {
        success: true,
        sessionToken, // Return token for localStorage fallback
        referralApplied: !!input.referralCode,
        referralPoints: input.referralCode ? 500 : 0,
        user: {
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        },
      };
    }),

  // Validate referral code (for registration form)
  // Accepts both 4-digit liver referral codes AND alphanumeric friend challenge codes
  validateReferralCode: publicProcedure
    .input(z.object({
      code: z.string().min(4).max(8).regex(/^[A-Za-z0-9]+$/),
    }))
    .mutation(async ({ input }) => {
      // First try liver referral code (4-digit numeric)
      if (/^\d{4}$/.test(input.code)) {
        const result = await getReferralCodeByCode(input.code);
        if (result) {
          return {
            valid: true,
            liverName: result.liverName || "ライバー",
            codeType: "liver" as const,
          };
        }
      }
      // Then try friend challenge referral code (alphanumeric)
      const { getUserProgressByReferralCode } = await import("./db");
      const friendProgress = await getUserProgressByReferralCode(input.code.toUpperCase());
      if (friendProgress) {
        const { getLineUserById } = await import("./db");
        const referrerUser = await getLineUserById(friendProgress.lineUserId);
        return {
          valid: true,
          liverName: referrerUser?.displayName || "ユーザー",
          codeType: "friend" as const,
        };
      }
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "無効な招待コードです",
      });
    }),

  // Email registration
  emailRegister: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      phone: z.string().optional(),
      referralCode: z.string().min(4).max(8).regex(/^[A-Za-z0-9]+$/).optional(),
      wonPoints: z.number().int().min(0).max(100).optional(), // Roulette won points (0-100)
    }))
    .mutation(async ({ input, ctx }) => {
      // Check if email already exists
      const existingUser = await getLineUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このメールアドレスは既に登録されています",
        });
      }
      
      // Validate referral code before creating user
      // Support both liver referral codes (4-digit numeric) and friend challenge codes (alphanumeric)
      let referralData: { referralCode: any; liverName: string | null } | null = null;
      let friendChallengeCode: string | null = null;
      if (input.referralCode) {
        // First try liver referral code (4-digit numeric)
        if (/^\d{4}$/.test(input.referralCode)) {
          const { getReferralCodeByCode } = await import("./db");
          const result = await getReferralCodeByCode(input.referralCode);
          if (result) {
            referralData = result;
          }
        }
        // If not a liver code, try friend challenge code
        if (!referralData) {
          const { getUserProgressByReferralCode } = await import("./db");
          const friendProgress = await getUserProgressByReferralCode(input.referralCode.toUpperCase());
          if (friendProgress) {
            friendChallengeCode = input.referralCode.toUpperCase();
          } else {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "無効な招待コードです",
            });
          }
        }
      }
      
      // Hash password
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(input.password, 10);
      
      // Create user
      const newUser = await createEmailLineUser({
        email: input.email,
        password: hashedPassword,
        displayName: input.name,
        phone: input.phone,
      });
      
      // Register pending referral (points awarded on first purchase) - LIVER referral codes
      let referralApplied = false;
      let referralPoints = 0;
      if (referralData) {
        try {
          const { registerPendingReferral, createLinePointTransaction } = await import("./db");
          await registerPendingReferral(
            referralData.referralCode.id,
            referralData.referralCode.liverId,
            newUser.id,
            500,
            200
          );
          
          // Award 500pt to new user immediately at registration
          await createLinePointTransaction({
            lineUserId: `email_${newUser.id}`,
            type: "earn",
            amount: 500,
            referenceType: "system",
            description: `紹介コード特典: 500ポイント獲得（新規登録ボーナス）`,
          });
          referralApplied = true;
          referralPoints = 500;
          console.log(`[Referral] 500pt awarded to user ${newUser.id} at registration via liver code ${input.referralCode}`);
          
          // ライバーにLINE通知を送信
          try {
            const { getLiverById } = await import("./db");
            const liver = await getLiverById(referralData.referralCode.liverId);
            if (liver?.lineUserId) {
              const { pushMessage } = await import("./line");
              const appUrl = process.env.APP_URL || "https://lcjmall.com";
              await pushMessage(liver.lineUserId, [{
                type: "text",
                text: `🎉 紹介コードが使われました！\n\nあなたの紹介コード「${input.referralCode}」で新しいユーザーが登録しました。\n\n※ あなたへの200ptはこのユーザーが初回購入を完了した時点で付与されます。\n\n📊 紹介実績を確認\n${appUrl}/liver-mypage`
              }]);
            }
          } catch (notifyErr: any) {
            console.error(`[Referral] Failed to send LINE notification to liver:`, notifyErr.message);
          }
        } catch (err: any) {
          console.error(`[Referral] Failed to register pending referral:`, err.message);
        }
      }
      
      // Handle FRIEND CHALLENGE referral codes (alphanumeric like 7H6RJF)
      if (friendChallengeCode) {
        try {
          const { 
            getUserProgressByReferralCode, getActiveReferralCampaign, getLineUserById, 
            createLinePointTransaction, getOrCreateUserReferralProgress, getCampaignStages,
            recordFriendReferral, updateUserReferralProgress, addReferralActivity,
            hasAlreadyBeenReferred, getTodayReferralCount, calculateTitleLevel
          } = await import("./db");
          const referrerProgress = await getUserProgressByReferralCode(friendChallengeCode);
          const campaign = await getActiveReferralCampaign();
          if (referrerProgress && campaign) {
            // Check if already referred (shouldn't happen for new user, but safety check)
            const alreadyReferred = await hasAlreadyBeenReferred(newUser.id, campaign.id);
            if (!alreadyReferred) {
              // Award invitee bonus to new user
              const inviteeBonus = campaign.inviteeBonus || 50;
              await createLinePointTransaction({
                lineUserId: `email_${newUser.id}`,
                type: "earn",
                amount: inviteeBonus,
                referenceType: "system",
                description: `友達招待チャレンジ 招待ボーナス`,
              });
              referralApplied = true;
              referralPoints = inviteeBonus;
              console.log(`[FriendChallenge] ${inviteeBonus}pt awarded to new user ${newUser.id} via friend code ${friendChallengeCode}`);

              // === CRITICAL: Record referral for the REFERRER (inviter) ===
              // This was previously missing - the referrer's stats/points/history were never updated
              
              // Get referrer's current progress
              const currentProgress = await getOrCreateUserReferralProgress(referrerProgress.lineUserId, campaign.id);
              
              // Calculate stage progression
              const stages = await getCampaignStages(campaign.id);
              const newTotalReferrals = currentProgress.totalReferrals + 1;
              let stageReward = 0;
              let newSpins = 0;
              let newSpecialSpins = 0;
              let newStage = currentProgress.currentStage;

              for (const stage of stages) {
                if (stage.stageNumber > currentProgress.currentStage && newTotalReferrals >= stage.requiredReferrals) {
                  stageReward += stage.fixedReward;
                  if (stage.isSpecialSpin) {
                    newSpecialSpins += stage.spinCount;
                  } else {
                    newSpins += stage.spinCount;
                  }
                  newStage = stage.stageNumber;
                }
              }

              // Record the referral in history
              await recordFriendReferral({
                referrerLineUserId: referrerProgress.lineUserId,
                inviteeLineUserId: newUser.id,
                campaignId: campaign.id,
                referrerPointsAwarded: stageReward,
                inviteePointsAwarded: inviteeBonus,
              });

              // Award stage reward points to referrer
              if (stageReward > 0) {
                const referrerUser = await getLineUserById(referrerProgress.lineUserId);
                const referrerPointId = referrerUser?.lineUserId || `email_${referrerProgress.lineUserId}`;
                await createLinePointTransaction({
                  lineUserId: referrerPointId,
                  type: "earn",
                  amount: stageReward,
                  referenceType: "system",
                  description: `友達招待チャレンジ ステージ${newStage}達成報酬`,
                });
                // Extend ALL existing point expiry for referrer (friend referral benefit)
                await extendLinePointExpiry(referrerPointId);
              } else {
                // Even without stage reward, extend expiry for successful referral
                const referrerUser2 = await getLineUserById(referrerProgress.lineUserId);
                const referrerPointId2 = referrerUser2?.lineUserId || `email_${referrerProgress.lineUserId}`;
                await extendLinePointExpiry(referrerPointId2);
              }

              // Update referrer's progress
              const titleLevel = calculateTitleLevel(newTotalReferrals);
              await updateUserReferralProgress(currentProgress.id, {
                totalReferrals: newTotalReferrals,
                currentStage: newStage,
                totalPointsEarned: currentProgress.totalPointsEarned + stageReward,
                pendingSpins: currentProgress.pendingSpins + newSpins,
                pendingSpecialSpins: currentProgress.pendingSpecialSpins + newSpecialSpins,
                titleLevel,
                monthlyPointsEarned: currentProgress.monthlyPointsEarned + stageReward,
              });

              // Add activity feed entry
              const referrerUser = await getLineUserById(referrerProgress.lineUserId);
              if (newStage > currentProgress.currentStage) {
                const stageInfo = stages.find(s => s.stageNumber === newStage);
                await addReferralActivity({
                  lineUserId: referrerProgress.lineUserId,
                  activityType: "stage_clear",
                  message: `${referrerUser?.displayName || "ユーザー"}さんが「${stageInfo?.stageName || `ステージ${newStage}`}」を達成しました！ ${stageInfo?.stageEmoji || "🎉"}`,
                  pointsAmount: stageReward,
                });
              }

              console.log(`[FriendChallenge] Referrer ${referrerProgress.lineUserId} updated: totalReferrals=${newTotalReferrals}, stage=${newStage}, stageReward=${stageReward}, spins=${newSpins}, specialSpins=${newSpecialSpins}`);

              // === Send exciting LINE notification to the referrer ===
              try {
                const referrerUserForNotif = referrerUser || await getLineUserById(referrerProgress.lineUserId);
                const referrerLineId = referrerUserForNotif?.lineUserId;
                if (referrerLineId && referrerLineId.startsWith("U")) {
                  const { pushMessage } = await import("./line");
                  const inviteeName = input.name || "新しい友達";
                  const appUrl = process.env.APP_URL || "https://lcjmall.com";
                  
                  // Build exciting notification message
                  let notifMessage = `🎉🎉🎉 おめでとうございます！🎉🎉🎉\n\n`;
                  notifMessage += `✨ ${inviteeName}さんがあなたの招待で登録しました！\n\n`;
                  notifMessage += `🏆 招待実績: ${newTotalReferrals}人目！\n`;
                  
                  if (stageReward > 0) {
                    notifMessage += `💰 ステージ報酬: +${stageReward}pt GET！\n`;
                  }
                  if (newSpins > 0) {
                    notifMessage += `🎰 ルーレット ${newSpins}回分 GET！\n`;
                  }
                  if (newSpecialSpins > 0) {
                    notifMessage += `🌟 スペシャルルーレット ${newSpecialSpins}回分 GET！\n`;
                  }
                  if (newStage > currentProgress.currentStage) {
                    const stageInfo = stages.find(s => s.stageNumber === newStage);
                    notifMessage += `\n🚀 ステージアップ！\n`;
                    notifMessage += `${stageInfo?.stageEmoji || "🎯"} 「${stageInfo?.stageName || `ステージ${newStage}`}」達成！\n`;
                  }
                  
                  notifMessage += `\n✅ 保有中の全ポイントの有効期限が6ヶ月延長されました！\n`;
                  notifMessage += `\n📣 この調子でどんどん友達を招待して\n最大5,000ptをGETしよう！🔥\n\n`;
                  notifMessage += `👉 招待チャレンジを確認\n${appUrl}/friend-challenge`;
                  
                  await pushMessage(referrerLineId, [{ type: "text", text: notifMessage }]);
                  console.log(`[FriendChallenge] LINE notification sent to referrer ${referrerLineId}`);
                }
              } catch (notifErr: any) {
                // Notification failure should not block the registration
                console.error(`[FriendChallenge] Failed to send LINE notification:`, notifErr.message);
              }
            }
          }
        } catch (err: any) {
          console.error(`[FriendChallenge] Failed to apply friend challenge referral:`, err.message);
        }
      }
      
      // Award roulette welcome bonus points (if not already awarded via referral)
      let roulettePointsAwarded = 0;
      if (input.wonPoints && input.wonPoints > 0 && !referralApplied) {
        try {
          const { createLinePointTransaction: createPtTxn } = await import("./db");
          await createPtTxn({
            lineUserId: `email_${newUser.id}`,
            type: "earn",
            amount: input.wonPoints,
            referenceType: "system",
            description: `新規登録ボーナスルーレット: ${input.wonPoints}ポイント獲得`,
          });
          roulettePointsAwarded = input.wonPoints;
          console.log(`[Roulette] ${input.wonPoints}pt awarded to new user ${newUser.id} as welcome bonus`);
        } catch (err: any) {
          console.error(`[Roulette] Failed to award welcome bonus points:`, err.message);
        }
      }
      
      // Auto-login: create session after registration
      const sessionData = {
        lineUserId: `email_${newUser.id}`,
        userId: newUser.id,
        displayName: input.name,
        pictureUrl: null,
        email: input.email,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000,
      };
      
      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');
      
      ctx.res.cookie("line_session", JSON.stringify(sessionData), {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 3650 * 24 * 60 * 60 * 1000,
      });
      
      return {
        success: true,
        userId: newUser.id,
        referralApplied,
        referralPoints,
        roulettePointsAwarded,
        friendChallengeCode: friendChallengeCode || undefined,
        sessionToken,
      };
    }),

  // Email login
  emailLogin: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Find user by email
      const user = await getLineUserByEmail(input.email);
      if (!user || !user.password) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが正しくありません",
        });
      }
      
      // Verify password
      const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.compare(input.password, user.password);
      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "メールアドレスまたはパスワードが正しくありません",
        });
      }
      
      // Create session
      const sessionData = {
        lineUserId: user.lineUserId || `email_${user.id}`,
        userId: user.id,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
        email: user.email,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3650 * 24 * 60 * 60 * 1000, // 10 years for persistent login
      };
      
      // Create session token for localStorage fallback
      const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64');
      
      ctx.res.cookie("line_session", JSON.stringify(sessionData), {
        ...getSessionCookieOptions(ctx.req),
        maxAge: 3650 * 24 * 60 * 60 * 1000, // 10 years for persistent login
      });
      
      return {
        success: true,
        sessionToken, // Return token for localStorage fallback
        user: {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
        },
      };
    }),

  // Logout
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.clearCookie("line_session", getSessionCookieOptions(ctx.req));
    return { success: true };
  }),

  // Request password reset - sends email with reset link
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      // Find user by email
      const user = await getLineUserByEmail(input.email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました",
        };
      }
      
      // Generate reset token
      const token = nanoid(64);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      // Save token to database
      await createPasswordResetToken({
        lineUserId: user.id,
        email: input.email,
        token,
        expiresAt,
      });
      
      // Send email with reset link
      const resetUrl = `${process.env.APP_URL || 'https://lcjmall.com'}/reset-password?token=${token}`;
      
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        
        await transporter.sendMail({
          from: `"LCJ MALL" <${process.env.SMTP_USER}>`,
          to: input.email,
          subject: "【LCJ MALL】パスワードリセットのご案内",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #e11d48;">パスワードリセットのご案内</h2>
              <p>${user.displayName || 'お客'}様</p>
              <p>LCJ MALLのパスワードリセットをリクエストいただきました。</p>
              <p>以下のボタンをクリックして、新しいパスワードを設定してください。</p>
              <p style="margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #e11d48; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  パスワードをリセットする
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">このリンクは1時間後に無効になります。</p>
              <p style="color: #666; font-size: 14px;">このメールに心当たりがない場合は、無視してください。</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px;">LCJ MALL</p>
            </div>
          `,
        });
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        // Still return success to not reveal if email exists
      }
      
      return {
        success: true,
        message: "メールアドレスが登録されている場合、パスワードリセットのメールを送信しました",
      };
    }),

  // Verify password reset token
  verifyResetToken: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .query(async ({ input }) => {
      const resetToken = await getPasswordResetToken(input.token);
      
      if (!resetToken) {
        return { valid: false, message: "無効なリンクです" };
      }
      
      if (resetToken.usedAt) {
        return { valid: false, message: "このリンクは既に使用されています" };
      }
      
      if (new Date(resetToken.expiresAt) < new Date()) {
        return { valid: false, message: "このリンクは有効期限が切れています" };
      }
      
      return { valid: true, email: resetToken.email };
    }),

  // Reset password with token
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const resetToken = await getPasswordResetToken(input.token);
      
      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "無効なリンクです",
        });
      }
      
      if (resetToken.usedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "このリンクは既に使用されています",
        });
      }
      
      if (new Date(resetToken.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "このリンクは有効期限が切れています",
        });
      }
      
      // Hash new password
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(input.newPassword, 10);
      
      // Update user password
      await updateLineUserPassword(resetToken.lineUserId, hashedPassword);
      
      // Mark token as used
      await markPasswordResetTokenAsUsed(input.token);
      
      return {
        success: true,
        message: "パスワードが正常にリセットされました",
      };
    }),
  
  // Get point balance for current LINE user
  getMyPoints: publicProcedure.query(async ({ ctx }) => {
    const result = await getLineUserFromSession(ctx);
    if (!result) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ログインが必要です",
      });
    }
    
    const { lineUser } = result;
    if (!lineUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ユーザーが見つかりません",
      });
    }
    
    try {
      const pointLookupId = lineUser.lineUserId || `email_${lineUser.id}`;
      const pointBalance = await getLinePointBalance(pointLookupId);
      const transactions = await getLinePointTransactions(pointLookupId, { limit: 50 });
      const expiring = await getExpiringLinePoints(pointLookupId);
      
      return {
        balance: pointBalance?.balance || 0,
        lifetimeEarned: pointBalance?.totalEarned || 0,
        lifetimeUsed: pointBalance?.totalUsed || 0,
        transactions,
        expiring: {
          in7Days: expiring.expiringIn7Days,
          in30Days: expiring.expiringIn30Days,
          in60Days: expiring.expiringIn60Days,
          breakdown: expiring.breakdown.map(b => ({
            expiresAt: b.expiresAt.getTime(),
            amount: b.amount,
          })),
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "ポイント情報の取得に失敗しました",
      });
    }
  }),
  
  // Get receipt history for current LINE user
  getMyReceipts: publicProcedure.query(async ({ ctx }) => {
    const result = await getLineUserFromSession(ctx);
    if (!result) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ログインが必要です",
      });
    }
    
    const { lineUser } = result;
    if (!lineUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ユーザーが見つかりません",
      });
    }
    
    try {
      // For email users without lineUserId, return empty receipts
      const receipts = lineUser.lineUserId ? await getLineReceiptsByUser(lineUser.lineUserId) : [];
      return receipts;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "レシート履歴の取得に失敗しました",
      });
    }
  }),

  // ==========================================
  // 確変チャンス未参加レシート取得
  // ==========================================
  getUnplayedKakuhenReceipts: publicProcedure.query(async ({ ctx }) => {
    const result = await getLineUserFromSession(ctx);
    if (!result || !result.lineUser) {
      return [];
    }
    const { lineUser } = result;
    if (!lineUser.lineUserId) return [];
    
    try {
      const { getDb } = await import("./db");
      const { sql: sqlTag } = await import("drizzle-orm");
      const { lineReceipts: lineReceiptsTable, receiptKakuhenResults } = await import("../drizzle/schema");
      const dbInst = await getDb();
      if (!dbInst) return [];
      
      // 確変チャンス未参加のレシートを取得（最新5件）
      const receipts = await dbInst.execute(
        sqlTag`SELECT lr.id, lr.createdAt, lr.status 
               FROM line_receipts lr 
               WHERE lr.lineUserId = ${lineUser.lineUserId}
               AND lr.status IN ('approved', 'pending', 'on_hold')
               AND lr.id NOT IN (
                 SELECT rkr.receiptId FROM receipt_kakuhen_results rkr 
                 WHERE rkr.receiptType = 'line_receipt'
               )
               ORDER BY lr.createdAt DESC
               LIMIT 5`
      );
      
      return (receipts as any)[0] || [];
    } catch (error) {
      console.error("[getUnplayedKakuhenReceipts] Error:", error);
      return [];
    }
  }),

  // ==========================================
  // LINE Account Linking (LINE連携)
  // ==========================================

  // Check if LINE account is linked
  checkLineLinked: publicProcedure.query(async ({ ctx }) => {
    const result = await getLineUserFromSession(ctx);
    if (!result || !result.lineUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ログインが必要です",
      });
    }
    
    const { lineUser } = result;
    const isLinked = lineUser.lineUserId !== null && !lineUser.lineUserId.startsWith('email_');
    
    return {
      isLinked,
      lineUserId: isLinked ? lineUser.lineUserId : null,
    };
  }),

  // Generate LINE link code
  generateLinkCode: publicProcedure.mutation(async ({ ctx }) => {
    const result = await getLineUserFromSession(ctx);
    if (!result || !result.lineUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ログインが必要です",
      });
    }
    
    const { lineUser } = result;
    
    // Check if already linked
    if (lineUser.lineUserId && !lineUser.lineUserId.startsWith('email_')) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "既にLINEアカウントが連携されています",
      });
    }
    
    // Generate new code
    const { code, expiresAt } = await createLineLinkCode(lineUser.id);
    
    return {
      code,
      expiresAt: expiresAt.toISOString(),
      message: "このコードをLINE公式アカウントに送信してください",
    };
  }),

  // Get active link code (if any)
  getActiveLinkCode: publicProcedure.query(async ({ ctx }) => {
    const result = await getLineUserFromSession(ctx);
    if (!result || !result.lineUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "ログインが必要です",
      });
    }
    
    const activeCode = await getActiveLinkCode(result.lineUser.id);
    if (!activeCode) {
      return null;
    }
    
    return {
      code: activeCode.code,
      expiresAt: activeCode.expiresAt.toISOString(),
    };
  }),

  // ==========================================
  // Web Receipt Upload (Webフォームからのレシートアップロード)
  // ==========================================

  // Submit receipt via Web form (uses S3 URL instead of Base64 for better LLM analysis)
  submitWebReceipt: rateLimitedPublicProcedure
    .input(z.object({
      images: z.array(z.object({
        base64: z.string(),
        mimeType: z.string(),
        fileName: z.string().optional(),
      })).min(1).max(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await getLineUserFromSession(ctx);
      if (!result || !result.lineUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "ログインが必要です",
        });
      }
      
      const { lineUser } = result;
      const lineUserId = lineUser.lineUserId || `email_${lineUser.id}`;
      
      try {
        const crypto = await import("crypto");
        
        // Upload all images to S3 and collect URLs
        const uploadedImages: { url: string; key: string; hash: string }[] = [];
        
        for (const img of input.images) {
          const buffer = Buffer.from(img.base64, "base64");
          
          // Check file size (max 10MB) - これだけはお客様に即座にエラーを返す
          if (buffer.length > 10 * 1024 * 1024) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "画像サイズが大きすぎます（最大10MB）",
            });
          }
          
          const imageHash = crypto.createHash("sha256").update(buffer).digest("hex");
          
          // 重複チェックはフロント側では行わない（バックグラウンドで処理）
          // お客様には常に「申請完了」を返す
          
          const ext = img.mimeType.includes("png") ? "png" : "jpg";
          const timestamp = Date.now();
          const fileKey = `web-receipts/${lineUserId}/${timestamp}-${nanoid(8)}.${ext}`;
          const { url } = await storagePut(fileKey, buffer, img.mimeType);
          
          uploadedImages.push({ url, key: fileKey, hash: imageHash });
        }
        
        // Create receipt record
        const { createLineReceipt } = await import("./db");
        const receiptId = await createLineReceipt({
          lineUserId,
          lineMessageId: `web_${nanoid(16)}`,
          imageUrl: uploadedImages[0].url,
          imageKey: uploadedImages[0].key,
          imageHash: uploadedImages[0].hash,
          imageUrls: uploadedImages.map(i => i.url),
          imageKeys: uploadedImages.map(i => i.key),
          status: "pending",
        });
        
        console.log(`[Web Receipt] Receipt ${receiptId} created for user ${lineUserId} (${uploadedImages.length} images). Starting background analysis...`);
        
        // ============================================
        // バックグラウンド処理（お客様を待たせない）
        // 重複チェック・AI解析・不正検知はすべてここで実行
        // ============================================
        (async () => {
          try {
            // 1. Perceptual hash計算
            try {
              const { computePhash, storePhash } = await import("./services/imageHashService");
              for (let idx = 0; idx < uploadedImages.length; idx++) {
                const hashResult = await computePhash(uploadedImages[idx].url);
                if (hashResult) {
                  await storePhash({
                    receiptId,
                    lineUserId,
                    imageUrl: uploadedImages[idx].url,
                    imageIndex: idx,
                    phash: hashResult.phash,
                    imageWidth: hashResult.width,
                    imageHeight: hashResult.height,
                    fileSize: hashResult.size,
                  });
                }
              }
              console.log(`[Web Receipt BG] Phash computed for receipt ${receiptId}`);
            } catch (phashErr) {
              console.error(`[Web Receipt BG] Phash failed for receipt ${receiptId}:`, phashErr);
            }
            
            // 2. 画像ハッシュ重複チェック（バックグラウンド）
            const { checkDuplicateLineReceiptByHash } = await import("./db");
            for (const img of uploadedImages) {
              const duplicate = await checkDuplicateLineReceiptByHash(img.hash, receiptId);
              if (duplicate) {
                console.log(`[Web Receipt BG] Duplicate image detected for receipt ${receiptId} (matches receipt ${duplicate.id})`);
                const { updateLineReceiptAiRejection: updateAiRejDup, updateLineReceiptStatus: updateDupStat } = await import("./db");
                await updateAiRejDup(receiptId, {
                  aiRejectionReason: `同一画像が既に申請済みです（申請ID: ${duplicate.id}）`,
                  aiRejectionCategory: "duplicate_image",
                });
                await updateDupStat(receiptId, "rejected", 0, `自動却下: 画像ハッシュ重複 (元の申請ID: ${duplicate.id})`);
                return; // バックグラウンド処理を終了
              }
            }
            
            // 3. AI解析
            const imageContents: any[] = [];
            for (const img of uploadedImages) {
              imageContents.push({
                type: "image_url",
                image_url: {
                  url: img.url,
                  detail: "high",
                },
              });
            }
            imageContents.push({
              type: "text",
              text: `これらの${uploadedImages.length}枚の画像はTikTok Shopの注文詳細画面のスクリーンショットです。\n\n【最重要】まず注文番号（16〜19桁の数字、「5」か「6」で始まる）を探してください。\n画面の下部に「注文番号」というラベルと共に表示されていることが多いです。\n「さらに表示」ボタンの直上や、合計金額の下にも表示されます。\n\nすべての画像を統合して情報を抽出してください。`,
            });
            
            let ocrData: any;
            let messageContent: string | null = null;
            try {
              const ocrResult = await invokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `あなたはTikTok Shopの注文詳細画面のスクリーンショットを解析する専門AIです。
複数の画像が送信された場合、すべての画像を統合して情報を抽出してください。

以下の情報を抽出してJSON形式で返してください：

{
  "isTikTokShop": true/false,
  "isDelivered": true/false,
  "orderNumber": "string",
  "totalAmount": number,
  "orderDate": "string",
  "shopName": "string",
  "productName": "string",
  "orderNumberSource": "string",
  "items": [
    {
      "productName": "string",
      "unitPrice": number,
      "quantity": number,
      "variant": "string"
    }
  ],
  "deliveryInfo": {
    "recipientName": "string",
    "phoneNumber": "string",
    "postalCode": "string",
    "address": "string",
    "deliveryStatus": "string",
    "deliveryDate": "string",
    "returnDeadline": "string"
  },
  "paymentInfo": {
    "subtotal": number,
    "shippingFee": number,
    "discount": number,
    "totalAmount": number,
    "paymentMethod": "string"
  }
}

=== 最重要タスク: 注文番号の抽出 ===

注文番号の抽出が最も重要なタスクです。他の全フィールドより優先してください。

TikTok Shopの注文番号は「5」または「6」で始まる16〜19桁の数字列です。
例: 5819000585822287971, 5824489836811172498, 682307265940784437

【ステップ1: 画像全体をスキャンして長い数字列を全て列挙する】
画像内に存在する10桁以上の数字列を全て見つけてください。
特に以下の場所を重点的にチェック：
- 画面の最下部（「さらに表示」の直上、スクロール可能エリアの末端）
- 「注文番号」「注文番号:」というラベルの右側
- 「合計金額（税込）」の行の下
- コピーアイコン（📋 🔗 ⧉）の左側
- 画面上部のヘッダー付近

【ステップ2: 注文番号を特定する】
見つけた数字列の中から、以下の条件に合うものを注文番号として選択：
- 16〜19桁の数字列
- 「5」または「6」で始まる
- 「注文番号」ラベルの近くにある
- 電話番号（080/090/070で始まる11桁）ではない
- 郵便番号（3桁-4桁）ではない
- 商品価格（4〜6桁）ではない

【ステップ3: どうしても見つからない場合】
- 画像内で最も長い数字列（15桁以上）を注文番号として採用
- それでも見つからない場合のみnullを返す

「orderNumberSource」には注文番号をどこで見つけたか記載（例: "画面下部の注文番号ラベル横", "合計金額の下"）

=== 配達済みの判定 ===
以下のいずれかが確認できれば isDelivered = true：
- 「配達済み」という文字
- 「X月X日に配達」（例：「1月27日に配達」）
- 「お荷物が最終目的地に到着しました」
- 「已签收」「Delivered」
- プログレスバーで「配達済み」が完了（緑/ティールのチェックマーク）

=== 金額の抽出 ===
- 「合計金額（税込）」「合計」「支払い金額」の横の金額 → totalAmount
- 通貨記号（¥￥）とカンマを除去して数値のみ（例: ¥2,832 → 2832）
- 商品の単価と数量も個別に抽出
- 送料、割引額、支払い方法も抽出

=== 商品情報の抽出 ===
- 各商品の名前、単価、数量、バリエーション（色・サイズ等）を抽出
- 複数商品がある場合はitemsに配列で格納
- ブランド名/ショップ名も抽出

=== 配送先情報の抽出 ===
- 「配送先住所」セクションから受取人名、電話番号、郵便番号、住所を抽出
- 配送ステータス（注文確定/発送済み/配送中/配達済み）を抽出
- 配達日（「X月X日に配達」）を抽出
- 返品期限（「XXXX年X月X日まで返品・返金可能」）を抽出

=== 出力ルール ===
- 注文番号の抽出を最優先。画像を隅々までスキャンすること
- 抽出できない項目はnullを返す
- 必ずJSON形式のみで回答（説明文は不要）
- 複数画像がある場合は統合して回答
- できるだけ多くの情報を抽出すること`,
                  },
                  {
                    role: "user",
                    content: imageContents,
                  },
                ],
              });
              
              messageContent = typeof ocrResult.choices[0].message.content === "string" 
                ? ocrResult.choices[0].message.content : null;
              let jsonStr = messageContent || "{}";
              if (jsonStr.includes("```json")) {
                jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
              } else if (jsonStr.includes("```")) {
                jsonStr = jsonStr.replace(/```\s*/g, "");
              }
              jsonStr = jsonStr.trim();
              ocrData = JSON.parse(jsonStr);
            } catch (aiError: any) {
              // AI解析失敗 → ステータスをanalysis_failedに更新（お客様には既に完了を返している）
              console.error(`[Web Receipt BG] AI analysis failed for receipt ${receiptId}:`, aiError);
              const { updateLineReceiptAiRejection: updateAiRejFailed } = await import("./db");
              await updateAiRejFailed(receiptId, {
                aiRejectionReason: "画像の解析に失敗しました。スタッフが手動で確認します。",
                aiRejectionCategory: "other",
              });
              // analysis_failedでもpendingのままにして管理者が手動確認できるようにする
              const { updateLineReceiptStatus: updateFailedStatus } = await import("./db");
              await updateFailedStatus(receiptId, "on_hold", 0, "AI解析失敗。手動確認が必要です。");
              return;
            }
            
            // 4. 注文番号のバリデーション・フォールバック処理
            if (ocrData.orderNumber) {
              const cleanedOrderNumber = String(ocrData.orderNumber).replace(/[^0-9]/g, "");
              if (/^[56]\d{15,18}$/.test(cleanedOrderNumber)) {
                ocrData.orderNumber = cleanedOrderNumber;
              } else if (/^\d{16,19}$/.test(cleanedOrderNumber)) {
                ocrData.orderNumber = cleanedOrderNumber;
                console.log(`[Web Receipt BG] Order number doesn't start with 5/6 but has valid length: ${cleanedOrderNumber}`);
              } else if (cleanedOrderNumber.length >= 15) {
                ocrData.orderNumber = cleanedOrderNumber;
                console.log(`[Web Receipt BG] Order number has unusual length (${cleanedOrderNumber.length}): ${cleanedOrderNumber}`);
              } else {
                console.log(`[Web Receipt BG] Rejected invalid order number: ${ocrData.orderNumber} (cleaned: ${cleanedOrderNumber})`);
                ocrData.orderNumber = null;
              }
            }
            
            // フォールバック: ocrRawText全体から長い数字列を探す
            if (!ocrData.orderNumber && messageContent) {
              const longNumbers = messageContent.match(/\d{15,19}/g);
              if (longNumbers && longNumbers.length > 0) {
                const bestMatch = longNumbers.sort((a: string, b: string) => b.length - a.length)[0];
                ocrData.orderNumber = bestMatch;
                console.log(`[Web Receipt BG] Fallback: extracted order number from raw response: ${bestMatch}`);
              }
            }
            
            // 5. TikTok Shopバリデーション
            if (!ocrData.isTikTokShop) {
              const { updateLineReceiptOcr: updateOcrForRejected } = await import("./db");
              await updateOcrForRejected(receiptId, {
                storeName: ocrData.shopName || "不明",
                purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
                totalAmount: ocrData.totalAmount,
                currency: "JPY",
                ocrRawText: JSON.stringify(ocrData),
                pointsCalculated: 0,
                imageUrls: uploadedImages.map(i => i.url),
                imageKeys: uploadedImages.map(i => i.key),
              });
              const { updateLineReceiptAiRejection } = await import("./db");
              await updateLineReceiptAiRejection(receiptId, {
                aiRejectionReason: "TikTok Shopの注文画面として認識されませんでした",
                aiRejectionCategory: "not_tiktok",
              });
              console.log(`[Web Receipt BG] Receipt ${receiptId}: not TikTok Shop`);
              return;
            }
            
            // 6. 配達済みバリデーション
            if (!ocrData.isDelivered) {
              const { updateLineReceiptOcr: updateOcrForNotDelivered } = await import("./db");
              await updateOcrForNotDelivered(receiptId, {
                storeName: ocrData.shopName || "TikTok Shop",
                purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
                totalAmount: ocrData.totalAmount,
                currency: "JPY",
                ocrRawText: JSON.stringify(ocrData),
                pointsCalculated: ocrData.totalAmount ? Math.floor(ocrData.totalAmount * 0.01) : 0,
                imageUrls: uploadedImages.map(i => i.url),
                imageKeys: uploadedImages.map(i => i.key),
              });
              const { updateLineReceiptAiRejection: updateAiRejNotDelivered } = await import("./db");
              await updateAiRejNotDelivered(receiptId, {
                aiRejectionReason: "配達ステータスが「配達済み」と確認できませんでした",
                aiRejectionCategory: "not_delivered",
              });
              console.log(`[Web Receipt BG] Receipt ${receiptId}: not delivered`);
              return;
            }
            
            // 7. 金額バリデーション
            if (!ocrData.totalAmount) {
              const { updateLineReceiptOcr: updateOcrForIncomplete } = await import("./db");
              await updateOcrForIncomplete(receiptId, {
                storeName: ocrData.shopName || "TikTok Shop",
                purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
                totalAmount: 0,
                currency: "JPY",
                ocrRawText: JSON.stringify(ocrData),
                pointsCalculated: 0,
                imageUrls: uploadedImages.map(i => i.url),
                imageKeys: uploadedImages.map(i => i.key),
              });
              const { updateLineReceiptAiRejection: updateAiRejIncomplete } = await import("./db");
              await updateAiRejIncomplete(receiptId, {
                aiRejectionReason: "購入金額を画像から読み取ることができませんでした",
                aiRejectionCategory: "incomplete",
              });
              console.log(`[Web Receipt BG] Receipt ${receiptId}: incomplete (no amount)`);
              return;
            }
            
            if (!ocrData.orderNumber) {
              console.log(`[Web Receipt BG] Warning: Order number not detected for receipt ${receiptId}. Manual input will be required.`);
            }
            
            // 8. ポイント計算 & OCRデータ保存
            const pointsCalculated = Math.floor(ocrData.totalAmount * 0.01);
            
            const { updateLineReceiptOcr } = await import("./db");
            await updateLineReceiptOcr(receiptId, {
              storeName: ocrData.shopName || "TikTok Shop",
              purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
              totalAmount: ocrData.totalAmount,
              currency: "JPY",
              orderNumber: ocrData.orderNumber || null,
              ocrRawText: JSON.stringify(ocrData),
              pointsCalculated,
              imageUrls: uploadedImages.map(i => i.url),
              imageKeys: uploadedImages.map(i => i.key),
            });
            
            // 9. 不正検知
            const fraudFlags: string[] = [];
            let fraudScore = 0;
            
            if (ocrData.orderDate) {
              const orderDate = new Date(ocrData.orderDate);
              const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
              if (daysSinceOrder > 30) {
                fraudFlags.push("expired_order");
                fraudScore += 50;
              }
            }
            
            if (ocrData.orderNumber) {
              const { checkDuplicateOrderNumberGlobal, findSimilarOrderNumbers } = await import("./db");
              const duplicateOrder = await checkDuplicateOrderNumberGlobal(ocrData.orderNumber, receiptId);
              if (duplicateOrder) {
                fraudFlags.push("duplicate_order");
                fraudScore += 100;
                
                const isSameUser = duplicateOrder.lineUserId === lineUserId;
                const rejectionMsg = isSameUser
                  ? `この注文は既にポイント申請済みです。注文番号: ${ocrData.orderNumber}`
                  : `この注文番号は既に他の方が申請済みです。注文番号: ${ocrData.orderNumber}`;
                
                const { updateLineReceiptAiRejection: updateAiRejDuplicate, updateLineReceiptStatus: updateDupStatus } = await import("./db");
                await updateAiRejDuplicate(receiptId, {
                  aiRejectionReason: rejectionMsg,
                  aiRejectionCategory: "other",
                });
                await updateDupStatus(receiptId, "rejected", 0, `自動却下: ${rejectionMsg}`);
                console.log(`[Web Receipt BG] Receipt ${receiptId}: duplicate order number ${ocrData.orderNumber}`);
                return;
              }
              
              const similarOrders = await findSimilarOrderNumbers(ocrData.orderNumber, receiptId);
              if (similarOrders.length > 0) {
                fraudFlags.push("similar_order_number");
                fraudScore += 40;
                console.log(`[Web Receipt BG] Similar order numbers detected for ${ocrData.orderNumber}: ${similarOrders.map((s: any) => `${s.orderNumber}(diff:${s.diffCount})`).join(", ")}`);
              }
            }
            
            if (ocrData.totalAmount > 50000) {
              fraudFlags.push("high_amount");
              fraudScore += 20;
            }
            
            if (fraudFlags.length > 0) {
              const { updateLineReceiptFraudFlags, updateLineReceiptStatus } = await import("./db");
              await updateLineReceiptFraudFlags(receiptId, fraudFlags, fraudScore);
              
              if (fraudScore >= 50) {
                await updateLineReceiptStatus(receiptId, "on_hold", 0, "自動保留: 不正検知スコアが高いため");
              }
            }
            
            console.log(`[Web Receipt BG] Receipt ${receiptId} analysis complete. Amount: ${ocrData.totalAmount}, Points: ${pointsCalculated}, Fraud: ${fraudScore}`);
            
          } catch (bgError) {
            console.error(`[Web Receipt BG] Background processing failed for receipt ${receiptId}:`, bgError);
            // バックグラウンドエラーでもお客様には影響なし
            // 管理者が手動で確認できるようにon_holdにする
            try {
              const { updateLineReceiptStatus: updateBgFailStatus } = await import("./db");
              await updateBgFailStatus(receiptId, "on_hold", 0, "バックグラウンド処理エラー。手動確認が必要です。");
            } catch (e) {
              console.error(`[Web Receipt BG] Failed to update status for receipt ${receiptId}:`, e);
            }
          }
        })();
        
        // ============================================
        // お客様には即座に「申請完了」を返す
        // AI解析・重複チェック・不正検知はバックグラウンドで実行中
        // ============================================
        return {
          receiptId,
          status: "success" as const,
          message: "レシートを受け付けました！スタッフの確認後、ポイントが付与されます。",
          imageUrls: uploadedImages.map(i => i.url),
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Web Receipt] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "レシートのアップロードに失敗しました。しばらくしてから再度お試しください。",
        });
      }
    }),

  // 強制申請（AIが弾いたレシートをそれでもアップロード）
  forceSubmitWebReceipt: publicProcedure
    .input(z.object({
      receiptId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await getLineUserFromSession(ctx);
      if (!result || !result.lineUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "ログインが必要です",
        });
      }
      
      const { updateLineReceiptStatus, markLineReceiptAsForceSubmitted } = await import("./db");
      await updateLineReceiptStatus(input.receiptId, "on_hold", 0, "AI自動判定で弾かれたが、お客様が強制申請。手動審査が必要です。");
      await markLineReceiptAsForceSubmitted(input.receiptId);
      
      console.log(`[Web Receipt] Force submitted receipt ${input.receiptId} by user ${result.lineUser.id}`);
      
      return {
        success: true,
        message: "レシートを申請しました。スタッフが確認後、結果をお知らせします。",
      };
    }),

  // ==========================================
  // 紹介コードシステム (Referral Code System)
  // ==========================================

  // 紹介コードの検証（コード入力時のプレビュー）
  verifyReferralCode: publicProcedure
    .input(z.object({
      code: z.string().length(4).regex(/^\d{4}$/),
    }))
    .query(async ({ input }) => {
      const result = await getReferralCodeByCode(input.code);
      if (!result) {
        return { valid: false, message: "無効な紹介コードです" };
      }
      return {
        valid: true,
        liverName: result.liverName,
        liverAvatarUrl: result.liverAvatarUrl,
      };
    }),

  // 紹介コードの適用（ポイント付与）
  applyReferralCode: publicProcedure
    .input(z.object({
      code: z.string().length(4).regex(/^\d{4}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      // ログインチェック
      const sessionResult = await getLineUserFromSession(ctx);
      if (!sessionResult || !sessionResult.lineUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "ログインが必要です",
        });
      }

      const { lineUser } = sessionResult;

      // 既に紹介コードを使用済みかチェック
      const alreadyUsed = await hasUsedReferralCode(lineUser.id);
      if (alreadyUsed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "紹介コードは1人1回のみ使用できます",
        });
      }

      // 紹介コードの検証
      const referralResult = await getReferralCodeByCode(input.code);
      if (!referralResult) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "無効な紹介コードです",
        });
      }

      const { referralCode, liverName } = referralResult;

      // 自分自身の紹介コードは使用不可（ライバーがLINE連携している場合）
      // ライバーのLINE User IDを取得
      const { getLiverById } = await import("./db");
      const liver = await getLiverById(referralCode.liverId);
      if (liver?.lineUserId && lineUser.lineUserId === liver.lineUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "自分自身の紹介コードは使用できません",
        });
      }

      // ポイント付与実行
      const lineUserId = lineUser.lineUserId || `email_${lineUser.id}`;
      const referrerLineUserId = liver?.lineUserId || null;

      try {
        const result = await applyReferralCode(
          referralCode.id,
          referralCode.liverId,
          lineUser.id,
          lineUserId,
          referrerLineUserId,
          500, // 新規ユーザー500pt
          200  // ライバー200pt
        );

        return {
          success: true,
          newUserPoints: result.newUserPoints,
          referrerPoints: result.referrerPoints,
          liverName,
          message: `紹介コードが適用されました！${result.newUserPoints}ポイントを獲得しました🎉`,
        };
      } catch (error: any) {
        if (error.message === "このユーザーは既に紹介コードを使用済みです") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "紹介コードは1人1回のみ使用できます",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "紹介コードの適用に失敗しました",
        });
      }
    }),

  // 紹介コード使用済みかチェック
  checkReferralUsed: publicProcedure.query(async ({ ctx }) => {
    const sessionResult = await getLineUserFromSession(ctx);
    if (!sessionResult || !sessionResult.lineUser) {
      return { used: false, loggedIn: false };
    }
    const used = await hasUsedReferralCode(sessionResult.lineUser.id);
    return { used, loggedIn: true };
  }),

  // 新規登録特典ルーレットポイント付与
  awardRegistrationBonus: publicProcedure
    .input(z.object({ points: z.number().int().min(1).max(1000) }))
    .mutation(async ({ input, ctx }) => {
      const sessionResult = await getLineUserFromSession(ctx);
      if (!sessionResult || !sessionResult.lineUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }
      const user = sessionResult.lineUser;
      const pointId = user.lineUserId || `email_${user.id}`;

      // Check if already awarded (prevent double award)
      const { getLinePointTransactions } = await import("./db");
      const existingTxns = await getLinePointTransactions(pointId);
      const alreadyAwarded = existingTxns.some(
        (t: { description: string | null }) => t.description?.includes("新規登録特典ルーレット")
      );
      if (alreadyAwarded) {
        return { awarded: false, message: "既に登録特典ポイントは付与済みです" };
      }

      // Award points
      const { createLinePointTransaction } = await import("./db");
      await createLinePointTransaction({
        lineUserId: pointId,
        type: "earn",
        amount: input.points,
        referenceType: "system",
        description: `新規登録特典ルーレット: ${input.points}ポイント獲得`,
      });
      console.log(`[RegistrationBonus] ${input.points}pt awarded to user ${user.id}`);
      return { awarded: true, points: input.points };
    }),

  // ===== プロフィール編集API =====
  updateMyProfile: publicProcedure
    .input(z.object({
      displayName: z.string().min(1, "名前を入力してください").max(100).optional(),
      phone: z.string().max(20).optional(),
      email: z.string().email("有効なメールアドレスを入力してください").max(320).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await getLineUserFromSession(ctx);
      if (!result || !result.lineUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }
      const lineUser = result.lineUser;
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // メールアドレスの重複チェック（変更する場合）
      if (input.email && input.email !== lineUser.email) {
        const existing = await db.select().from(lineUsers).where(eq(lineUsers.email, input.email)).limit(1);
        if (existing.length > 0 && existing[0].id !== lineUser.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "このメールアドレスは既に使用されています" });
        }
      }

      const updateData: Record<string, any> = {};
      if (input.displayName !== undefined) updateData.displayName = input.displayName;
      if (input.phone !== undefined) updateData.phone = input.phone || null;
      if (input.email !== undefined) updateData.email = input.email;

      if (Object.keys(updateData).length === 0) {
        return { success: true };
      }

      await db.update(lineUsers).set(updateData).where(eq(lineUsers.id, lineUser.id));
      return { success: true };
    }),

  // プロフィール情報取得（編集画面用）
  getMyProfile: publicProcedure
    .query(async ({ ctx }) => {
      const result = await getLineUserFromSession(ctx);
      if (!result || !result.lineUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }
      const u = result.lineUser;
      return {
        id: u.id,
        displayName: u.displayName || "",
        email: u.email || "",
        phone: u.phone || "",
        pictureUrl: u.pictureUrl || null,
        lineUserId: u.lineUserId || null,
        createdAt: u.createdAt,
      };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  completion: completionRouter,

  reminder: router({
    sendNow: protectedProcedure.mutation(async () => {
      const result = await checkAndSendReminders();
      return result;
    }),
  }),

  staff: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          nameEn: z.string().optional(),
          email: z.string().min(1).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"),
          phone: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          country: z.string().optional(),
          avatarUrl: z.string().optional(),
          joinDate: z.string().optional(), // ISO date string
          birthDate: z.string().optional(), // ISO date string
          skills: z.array(z.string()).optional(),
          lineId: z.string().optional(),
          emergencyContact: z.string().optional(),
          notes: z.string().optional(),
          employmentType: z.enum(["fulltime", "parttime", "contract", "intern"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createStaff({
          name: input.name,
          nameEn: input.nameEn,
          email: input.email,
          phone: input.phone,
          department: input.department,
          position: input.position,
          country: input.country,
          avatarUrl: input.avatarUrl,
          joinDate: input.joinDate ? new Date(input.joinDate) : undefined,
          birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
          skills: input.skills,
          lineId: input.lineId,
          emergencyContact: input.emergencyContact,
          notes: input.notes,
          employmentType: input.employmentType || "fulltime",
          isActive: "active",
        });
        return { success: true };
      }),

    list: protectedProcedure.query(async () => {
      return await getAllStaff();
    }),

    listActive: protectedProcedure.query(async () => {
      return await getActiveStaff();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getStaffById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          nameEn: z.string().optional(),
          email: z.string().min(1).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format").optional(),
          phone: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          country: z.string().optional(),
          avatarUrl: z.string().optional(),
          joinDate: z.string().nullable().optional(), // ISO date string
          birthDate: z.string().nullable().optional(), // ISO date string
          skills: z.array(z.string()).optional(),
          lineId: z.string().optional(),
          emergencyContact: z.string().optional(),
          notes: z.string().optional(),
          employmentType: z.enum(["fulltime", "parttime", "contract", "intern"]).optional(),
          isActive: z.enum(["active", "inactive"]).optional(),
          resignDate: z.string().nullable().optional(),
          resignReason: z.string().nullable().optional(),
          tier: z.string().nullable().optional(),
          evaluationScore: z.number().min(-2).max(4).nullable().optional(),
          salary: z.number().nullable().optional(),
          salaryCurrency: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, joinDate, birthDate, resignDate, salary, ...rest } = input;
        const updateData: any = { ...rest };
        if (salary !== undefined) {
          updateData.salary = salary !== null ? String(salary) : null;
        }
        if (joinDate !== undefined) {
          updateData.joinDate = joinDate ? new Date(joinDate) : null;
        }
        if (birthDate !== undefined) {
          updateData.birthDate = birthDate ? new Date(birthDate) : null;
        }
        if (resignDate !== undefined) {
          updateData.resignDate = resignDate ? new Date(resignDate) : null;
        }
        await updateStaff(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteStaff(input.id);
        return { success: true };
      }),

    // Resign staff (set inactive with resign date/reason, also update reportStaff)
    resign: protectedProcedure
      .input(z.object({
        staffId: z.number().nullable().optional(),
        reportStaffId: z.number(),
        resignDate: z.string(), // ISO date string
        resignReason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Update staff record if linked
        if (input.staffId) {
          await updateStaff(input.staffId, {
            isActive: "inactive",
            resignDate: new Date(input.resignDate),
            resignReason: input.resignReason || null,
          });
        }
        // Also update reportStaff isActive
        await updateReportStaff(input.reportStaffId, {
          isActive: "inactive",
        });
        return { success: true };
      }),

    // Reinstate staff (set active again, clear resign info)
    reinstate: protectedProcedure
      .input(z.object({
        staffId: z.number().nullable().optional(),
        reportStaffId: z.number(),
      }))
      .mutation(async ({ input }) => {
        if (input.staffId) {
          await updateStaff(input.staffId, {
            isActive: "active",
            resignDate: null,
            resignReason: null,
          });
        }
        await updateReportStaff(input.reportStaffId, {
          isActive: "active",
        });
        return { success: true };
      }),

    // Upload avatar photoo
    uploadAvatar: protectedProcedure
      .input(z.object({
        staffId: z.number(),
        base64: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const fileKey = `staff-avatars/${input.staffId}/${nanoid()}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        await updateStaff(input.staffId, { avatarUrl: url });
        return { success: true, url };
      }),

    // Staff statistics for HR dashboard
    statistics: protectedProcedure.query(async () => {
      const allStaffData = await getAllStaff();
      const activeStaff = allStaffData.filter(s => s.isActive === "active");
      
      // Department breakdown
      const departmentCounts: Record<string, number> = {};
      activeStaff.forEach(s => {
        const dept = s.department || "未設定";
        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
      });

      // Country breakdown
      const countryCounts: Record<string, number> = {};
      activeStaff.forEach(s => {
        const country = s.country || "未設定";
        countryCounts[country] = (countryCounts[country] || 0) + 1;
      });

      // Employment type breakdown
      const employmentTypeCounts: Record<string, number> = {};
      activeStaff.forEach(s => {
        const type = s.employmentType || "fulltime";
        employmentTypeCounts[type] = (employmentTypeCounts[type] || 0) + 1;
      });

      return {
        totalStaff: allStaffData.length,
        activeStaff: activeStaff.length,
        inactiveStaff: allStaffData.length - activeStaff.length,
        departmentBreakdown: departmentCounts,
        countryBreakdown: countryCounts,
        employmentTypeBreakdown: employmentTypeCounts,
      };
    }),

    getTaskCounts: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        const tasksWithStaff = await getTasksByStaffId(input.staffId);
        const now = new Date();
        
        const inProgressCount = tasksWithStaff.filter(t => t.task.status === "in_progress").length;
        const completedCount = tasksWithStaff.filter(t => t.task.status === "completed").length;
        const overdueCount = tasksWithStaff.filter(t => 
          t.task.status === "in_progress" && 
          t.task.deadline && 
          new Date(t.task.deadline) < now
        ).length;
        
        return {
          inProgressCount,
          completedCount,
          overdueCount,
          totalCount: tasksWithStaff.length,
        };
      }),

    // HR: Get task history for a staff member
    getTaskHistory: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        const tasksWithStaff = await getTasksByStaffId(input.staffId);
        return tasksWithStaff.map(t => ({
          id: t.task.id,
          taskId: t.task.taskId,
          status: t.task.status,
          taskDetail: t.task.taskDetail,
          deadline: t.task.deadline,
          startDate: t.task.startDate,
          completedAt: t.task.completedAt,
          notes: t.task.notes,
          createdAt: t.task.createdAt,
        }));
      }),

    // HR: Get report history for a staff member (via reportStaff linkedStaffId)
    getReportHistory: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        const reportsData = await getReportsByLinkedStaffId(input.staffId);
        return reportsData.map(r => ({
          id: r.report.id,
          reportDate: r.report.reportDate,
          workContent: r.report.workContent,
          issues: r.report.issues,
          remarks: r.report.remarks,
          createdAt: r.report.createdAt,
          reportStaffName: r.staff?.name || null,
        }));
      }),

    // HR: Get linked reportStaff for a staff member
    getLinkedReportStaff: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        return await getReportStaffByLinkedStaffId(input.staffId);
      }),

    // HR: Get all reportStaff with linked staff data for unified view
    listReportStaffUnified: protectedProcedure.query(async () => {
      return await getAllReportStaffWithLinkedStaff();
    }),

    // HR: Auto-link reportStaff to staff by name matching
    autoLinkReportStaff: protectedProcedure.mutation(async () => {
      const linkedCount = await autoLinkReportStaffToStaff();
      return { linkedCount };
    }),

    // HR: Create staff record from reportStaff and link them
    createFromReportStaff: protectedProcedure
      .input(z.object({
        reportStaffId: z.number(),
        email: z.string().optional(),
        phone: z.string().optional(),
        department: z.string().optional(),
        position: z.string().optional(),
        employmentType: z.enum(["fulltime", "parttime", "contract", "intern"]).optional(),
        joinDate: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { reportStaffId, joinDate, ...rest } = input;
        const additionalData: any = { ...rest };
        if (joinDate) additionalData.joinDate = new Date(joinDate);
        const staffId = await createStaffFromReportStaff(reportStaffId, additionalData);
        return { staffId };
      }),

    // HR: Get reports by reportStaffId directly
    getReportsByReportStaffId: protectedProcedure
      .input(z.object({ reportStaffId: z.number() }))
      .query(async ({ input }) => {
        return await getReportsByReportStaffId(input.reportStaffId);
      }),

    // HR: Update tier info for a staff member
    updateTier: protectedProcedure
      .input(z.object({
        staffId: z.number(),
        tier: z.string().nullable(),
        evaluationScore: z.number().min(-2).max(4).nullable(),
        salary: z.number().nullable(),
        salaryCurrency: z.string().nullable(),
      }))
      .mutation(async ({ input }) => {
        await updateStaff(input.staffId, {
          tier: input.tier,
          evaluationScore: input.evaluationScore,
          salary: input.salary !== null ? String(input.salary) : null,
          salaryCurrency: input.salaryCurrency,
        });
        return { success: true };
      }),
  }),

  task: router({
    create: protectedProcedure
      .input(
        z.object({
          screenshots: z.array(z.object({
            base64: z.string(),
            mimeType: z.string(),
          })).min(1).max(4), // Support 1-4 screenshots
          staffIds: z.array(z.number()).min(1), // Support multiple staff members
          manualDeadline: z.string().optional(), // Manual deadline input (ISO 8601 format)
          notes: z.string().optional(), // Optional memo field
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Upload all screenshots to S3
        const uploadedScreenshots = await Promise.all(
          input.screenshots.map(async (screenshot) => {
            const buffer = Buffer.from(screenshot.base64, "base64");
            const fileKey = `screenshots/${ctx.user.id}/${nanoid()}.${screenshot.mimeType.split("/")[1]}`;
            const { url } = await storagePut(fileKey, buffer, screenshot.mimeType);
            return { url, key: fileKey };
          })
        );

        const screenshotUrls = uploadedScreenshots.map(s => s.url);
        const screenshotKeys = uploadedScreenshots.map(s => s.key);
              // Build content array with all screenshots
        const userContent: any[] = [
          {
            type: "text",
            text: screenshotUrls.length > 1 
              ? `これら${screenshotUrls.length}枚のスクリーンショットから業務指示を抽出してください。複数の画像に分かれている情報を統合して、完全なタスク情報を抽出してください。`
              : "このスクリーンショットから業務指示を抽出してください。",
          },
        ];

        // Add all screenshots to content
        for (const screenshotUrl of screenshotUrls) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: screenshotUrl,
              detail: "high",
            },
          });
        }

        // Use AI to extract task information from all screenshots
        const aiResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "あなたは業務指示を抽出するアシスタントです。スクリーンショットからタスクの要約、詳細なコンテキスト、期限を抽出してください。複数の画像がある場合は、全ての情報を統合して完全なタスク情報を抽出してください。",
            },
            {
              role: "user",
              content: userContent,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "task_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  taskSummary: { type: "string", description: "指示内容の簡潔な要約" },
                  detailedContext: { type: "string", description: "詳細なコンテキスト" },
                  deadline: { type: "string", description: "期限（ISO 8601形式、不明な場合は空文字列）" },
                },
                required: ["taskSummary", "detailedContext", "deadline"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = aiResponse.choices[0]?.message?.content;
        const extractedData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
        const taskId = `TASK-${nanoid(10)}`;
        const completionToken = nanoid(32); // Generate unique completion token
        const startDate = Date.now();

        // Parse deadline: prioritize manual input over AI extraction
        let deadline: Date | null = null;
        
        // First, try manual deadline input (user input has priority)
        if (input.manualDeadline && input.manualDeadline.trim() !== "") {
          try {
            const parsedDate = new Date(input.manualDeadline);
            if (!isNaN(parsedDate.getTime())) {
              deadline = parsedDate;
              console.log("[Task Create] Using manual deadline:", deadline);
            }
          } catch (error) {
            console.warn("[Task Create] Failed to parse manual deadline:", input.manualDeadline);
          }
        }
        
        // If no manual deadline, try AI-extracted deadline
        if (!deadline && extractedData.deadline && extractedData.deadline.trim() !== "") {
          try {
            const parsedDate = new Date(extractedData.deadline);
            if (!isNaN(parsedDate.getTime())) {
              deadline = parsedDate;
              console.log("[Task Create] Using AI-extracted deadline:", deadline);
            }
          } catch (error) {
            console.warn("[Task Create] Failed to parse AI deadline:", extractedData.deadline);
          }
        }

        // Create task in database
        const createdTask = await createTask({
          taskId,
          status: "in_progress",
          staffId: input.staffIds[0], // Keep first staff for backward compatibility
          taskDetail: extractedData.taskSummary || "指示内容を確認してください",
          extractedContext: extractedData.detailedContext || "",
          deadline,
          screenshotUrl: screenshotUrls[0], // Keep for backward compatibility
          screenshotKey: screenshotKeys[0], // Keep for backward compatibility
          screenshotUrls,
          screenshotKeys,
          completionToken,
          notes: input.notes, // Save optional notes
          startDate,
          createdBy: ctx.user.id,
        });

        if (!createdTask || !createdTask.id) {
          throw new Error("Failed to create task");
        }

        console.log("[Task Create] Created task with ID:", createdTask.id);

        // Assign all staff members to the task using junction table
        await assignStaffToTask(createdTask.id, input.staffIds);

        // Send initial reminder email to all assigned staff members
        const assignedStaff = await Promise.all(
          input.staffIds.map(staffId => getStaffById(staffId))
        );
        
        for (const staff of assignedStaff) {
          if (staff) {
            // Generate tracking token
            const trackingToken = nanoid(32);
            
            // Send email with tracking
            await sendReminderEmail(
              staff.email,
              staff.name,
              extractedData.taskSummary || "指示内容を確認してください",
              taskId,
              0, // 0 days elapsed (initial reminder)
              completionToken,
              screenshotUrls,
              input.notes,
              deadline ? deadline.getTime() : undefined,
              trackingToken
            );
            
            // Create reminder record
            const reminderResult = await createReminder({
              taskId: createdTask.id,
              sentAt: startDate,
              recipientEmail: staff.email,
              emailSubject: `【リマインド/提醒】タスクの進捗確認 / 任务进度确认: ${extractedData.taskSummary?.substring(0, 50)}...`,
              emailBody: extractedData.taskSummary || "",
              status: "sent",
            });
            
            // Create email tracking record
            // Note: We use a placeholder reminderId since we can't get the auto-increment ID from drizzle
            await createEmailTracking({
              reminderId: 0, // Will be updated later if needed
              taskId: createdTask.id,
              trackingToken,
              openedAt: null,
              openCount: 0,
              ipAddress: null,
              userAgent: null,
            });
          }
        }

        // Notify owner
        await notifyOwner({
          title: "新規タスクが登録されました",
          content: `タスクID: ${taskId}\n指示内容: ${extractedData.taskSummary}`,
        });

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "task_create",
          actionLabel: "タスクを作成",
          targetId: createdTask.id,
          targetName: extractedData.taskSummary?.substring(0, 50) || taskId,
        });

        return {
          success: true,
          taskId,
          extractedData,
        };
      }),

    list: protectedProcedure.query(async () => {
      return await getAllTasks();
    }),

    listAllWithUsers: protectedProcedure.query(async () => {
      return await getAllTasksWithUsers();
    }),

    listByStatus: protectedProcedure
      .input(z.object({ status: z.enum(["pending", "in_progress", "completed", "cancelled"]) }))
      .query(async ({ input }) => {
        return await getTasksByStatus(input.status);
      }),

    listByStaffId: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        return await getTasksByStaffId(input.staffId);
      }),

    getTasksByStaff: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        const tasks = await getTasksByStaffId(input.staffId);
        const staff = await getStaffById(input.staffId);
        return {
          staff,
          tasks,
        };
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getTaskById(input.id);
      }),

    getStaffByTaskId: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await getStaffByTaskId(input.taskId);
      }),

    search: protectedProcedure
      .input(z.object({ searchTerm: z.string() }))
      .query(async ({ input }) => {
        return await searchTasks(input.searchTerm);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
          taskDetail: z.string().optional(),
          deadline: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, deadline, ...updateData } = input;
        const finalUpdateData: any = { ...updateData };

        if (deadline) {
          finalUpdateData.deadline = new Date(deadline);
        }

        if (input.status === "completed") {
          finalUpdateData.completedAt = Date.now();
        }

        await updateTask(id, finalUpdateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTask(input.id);
        return { success: true };
      }),

    sendReminder: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ input }) => {
        const taskData = await getTaskById(input.taskId);
        if (!taskData) {
          throw new Error("Task not found");
        }

        const { task } = taskData;

        // Get all assigned staff members
        const assignedStaff = await getStaffByTaskId(input.taskId);
        if (!assignedStaff || assignedStaff.length === 0) {
          throw new Error("No staff assigned to this task");
        }

        // Calculate days elapsed
        const daysElapsed = Math.floor(
          (Date.now() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Send reminder email to all assigned staff members
        const emailResults = await Promise.all(
          assignedStaff.map(async (item) => {
            if (!item.staff) return { success: false, error: "Staff not found" };

            // Generate tracking token
            const trackingToken = nanoid(32);

            const emailResult = await sendReminderEmail(
              item.staff.email,
              item.staff.name,
              task.taskDetail,
              task.taskId,
              daysElapsed,
              task.completionToken || undefined,
              task.screenshotUrls || (task.screenshotUrl ? [task.screenshotUrl] : undefined),
              task.notes || undefined,
              task.deadline ? task.deadline.getTime() : undefined,
              trackingToken
            );

            if (emailResult.success) {
              // Create reminder record
              await createReminder({
                taskId: task.id,
                sentAt: Date.now(),
                recipientEmail: item.staff.email,
                emailSubject: `【リマインド】${task.taskDetail}`,
                emailBody: `${item.staff.name}様\n\n以下のタスクについてリマインドいたします。\n\nタスクID: ${task.taskId}\n内容: ${task.taskDetail}\n\nご確認をお願いいたします。`,
                status: "sent",
              });
              
              // Create email tracking record
              await createEmailTracking({
                reminderId: 0,
                taskId: task.id,
                trackingToken,
                openedAt: null,
                openCount: 0,
                ipAddress: null,
                userAgent: null,
              });
            }

            return emailResult;
          })
        );

        // Check if any email failed
        const failedEmails = emailResults.filter(result => !result.success);
        if (failedEmails.length > 0) {
          throw new Error(`${failedEmails.length}件のメール送信に失敗しました`);
        }

        return { success: true, sentCount: emailResults.length };
      }),

    getReminders: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await getRemindersByTaskId(input.taskId);
      }),

    getEmailTracking: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return await getEmailTrackingByTaskId(input.taskId);
      }),

    checkCompletion: protectedProcedure
      .input(
        z.object({
          taskId: z.string(),
          emailContent: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        // Use AI to determine if the email indicates task completion
        const aiResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "あなたは業務完了報告を判定するアシスタントです。メール内容から、タスクが完了したかどうかを判定してください。",
            },
            {
              role: "user",
              content: `以下のメール内容を分析して、タスクが完了したかどうかを判定してください：\n\n${input.emailContent}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "completion_check",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  isCompleted: { type: "boolean", description: "タスクが完了したかどうか" },
                  confidence: { type: "number", description: "判定の信頼度（0-1）" },
                  reason: { type: "string", description: "判定理由" },
                },
                required: ["isCompleted", "confidence", "reason"],
                additionalProperties: false,
              },
            },
          },
        });

        const messageContent = aiResponse.choices[0]?.message?.content;
        const result = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");

        if (result.isCompleted && result.confidence > 0.7) {
          const taskData = await getTaskByTaskId(input.taskId);
          if (taskData) {
            await updateTask(taskData.task.id, {
              status: "completed",
              completedAt: Date.now(),
            });

            // Notify owner
            await notifyOwner({
              title: "タスクが完了しました",
              content: `タスクID: ${input.taskId}\n内容: ${taskData.task.taskDetail}`,
            });
          }
        }

        return {
          success: true,
          result,
        };
      }),
  }),

  dashboard: router({
    statistics: protectedProcedure.query(async () => {
      const stats = await getTaskStatistics();
      const avgCompletionTime = await getAverageCompletionTime();
      const recentCompleted = await getRecentCompletedTasks(5);
      const overdueTasks = await getOverdueTasks();

      return {
        stats,
        avgCompletionTime,
        recentCompleted,
        overdueTasks,
      };
    }),

    staffWithTaskCounts: protectedProcedure.query(async () => {
      return await getStaffWithTaskCounts();
    }),
  }),

  // Report Staff router (separate from task staff)
  reportStaff: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          country: z.string().min(1),
          linkedStaffId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const reportStaffMember = await createReportStaff({
          name: input.name,
          country: input.country,
          linkedStaffId: input.linkedStaffId || null,
        });
        return reportStaffMember;
      }),

    list: protectedProcedure.query(async () => {
      return await getAllReportStaff();
    }),

    listActive: protectedProcedure.query(async () => {
      return await getActiveReportStaff();
    }),

    listByCountry: protectedProcedure
      .input(z.object({ country: z.string() }))
      .query(async ({ input }) => {
        return await getReportStaffByCountry(input.country);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getReportStaffById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          country: z.string().optional(),
          linkedStaffId: z.number().nullable().optional(),
          isActive: z.enum(["active", "inactive"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        await updateReportStaff(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReportStaff(input.id);
        return { success: true };
      }),

    // Get current user's reportStaffId by matching email -> staff -> reportStaff
    myId: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return { reportStaffId: null };
      const db = await getDb();
      if (!db) return { reportStaffId: null };
      // Try to find via email -> staff -> reportStaff (linkedStaffId)
      const staffResult = await db.select({ id: staff.id }).from(staff)
        .where(eq(staff.email, ctx.user.email)).limit(1);
      if (staffResult.length > 0) {
        const rsResult = await db.select({ id: reportStaff.id }).from(reportStaff)
          .where(eq(reportStaff.linkedStaffId, staffResult[0].id)).limit(1);
        if (rsResult.length > 0) {
          return { reportStaffId: rsResult[0].id };
        }
      }
      // Fallback: try name matching
      if (ctx.user.name) {
        const rsResult = await db.select({ id: reportStaff.id }).from(reportStaff)
          .where(eq(reportStaff.name, ctx.user.name)).limit(1);
        if (rsResult.length > 0) {
          return { reportStaffId: rsResult[0].id };
        }
      }
      return { reportStaffId: null };
    }),
  }),

  report: router({
    create: protectedProcedure
      .input(
        z.object({
          reportStaffId: z.number(),
          reportDate: z.string(), // ISO 8601 format
          workContent: z.string().min(1),
          issues: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const report = await createReport({
          reportStaffId: input.reportStaffId,
          reportDate: new Date(input.reportDate),
          workContent: input.workContent,
          issues: input.issues || null,
          remarks: input.remarks || null,
          createdBy: ctx.user.id,
        });
        
        // Record activity log
        if (report && report.id) {
          await createActivityLog({
            userId: ctx.user.id,
            actionType: "report_create",
            actionLabel: "レポートを提出",
            targetId: report.id,
            targetName: input.workContent.substring(0, 50),
          });
        }
        
        return report;
      }),

    list: protectedProcedure
      .input(
        z.object({
          reportStaffId: z.number().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          searchTerm: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        if (!input || Object.keys(input).length === 0) {
          return await getAllReports();
        }
        
        return await searchReports({
          reportStaffId: input.reportStaffId,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          searchTerm: input.searchTerm,
        });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getReportById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          reportStaffId: z.number().optional(),
          reportDate: z.string().optional(),
          workContent: z.string().optional(),
          issues: z.string().optional(),
          remarks: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const data: any = { ...updateData };
        if (updateData.reportDate) {
          data.reportDate = new Date(updateData.reportDate);
        }
        await updateReport(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReport(input.id);
        return { success: true };
      }),

    staffStatistics: protectedProcedure.query(async () => {
      return await getStaffReportStatistics();
    }),

    // AI Analysis: Individual staff analysis
    analyzeIndividual: protectedProcedure
      .input(
        z.object({
          reportStaffId: z.number(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const reports = await getReportsForAnalysis({
          reportStaffId: input.reportStaffId,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        });

        if (reports.length === 0) {
          return {
            success: false,
            error: input.language === "ja" ? "分析対象の日報がありません" : "没有可分析的日报",
          };
        }

        const staffName = reports[0].staff?.name || "不明";
        const reportContents = reports.map(r => ({
          date: r.report.reportDate,
          workContent: r.report.workContent,
          issues: r.report.issues,
          remarks: r.report.remarks,
        }));

        const systemPrompt = input.language === "ja" 
          ? `あなたは業務分析の専門家です。以下の日報データを分析し、個人の作業傾向を詳細に分析してください。

分析項目:
1. 主な作業カテゴリ（作業内容をカテゴリ別に分類）
2. 作業の特徴と強み
3. 課題や改善点
4. 今後の提案

日本語で回答してください。`
          : `你是一位业务分析专家。请分析以下日报数据，详细分析个人的工作趋势。

分析项目:
1. 主要工作类别（按类别分类工作内容）
2. 工作特点和优势
3. 课题和改进点
4. 未来建议

请用中文回答。`;

        const userPrompt = `スタッフ名: ${staffName}
分析期間: ${reports.length}件の日報

日報データ:
${JSON.stringify(reportContents, null, 2)}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const analysis = response.choices[0]?.message?.content || "";

          return {
            success: true,
            staffName,
            reportCount: reports.length,
            analysis: typeof analysis === "string" ? analysis : JSON.stringify(analysis),
          };
        } catch (error) {
          console.error("AI analysis error:", error);
          return {
            success: false,
            error: input.language === "ja" ? "AI分析中にエラーが発生しました" : "AI分析过程中发生错误",
          };
        }
      }),

    // AI Analysis: Team summary
    analyzeTeam: protectedProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          country: z.string().optional(),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const reports = await getReportsForAnalysis({
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          country: input.country,
        });

        if (reports.length === 0) {
          return {
            success: false,
            error: input.language === "ja" ? "分析対象の日報がありません" : "没有可分析的日报",
          };
        }

        // Group reports by staff
        const staffReports: Record<string, { name: string; reports: any[] }> = {};
        for (const r of reports) {
          const staffId = r.staff?.id?.toString() || "unknown";
          const staffName = r.staff?.name || "不明";
          if (!staffReports[staffId]) {
            staffReports[staffId] = { name: staffName, reports: [] };
          }
          staffReports[staffId].reports.push({
            date: r.report.reportDate,
            workContent: r.report.workContent,
            issues: r.report.issues,
          });
        }

        const teamSummary = Object.entries(staffReports).map(([id, data]) => ({
          staffName: data.name,
          reportCount: data.reports.length,
          recentWork: data.reports.slice(0, 3).map(r => r.workContent).join("\n"),
          issues: data.reports.filter(r => r.issues).map(r => r.issues).slice(0, 3),
        }));

        const systemPrompt = input.language === "ja"
          ? `あなたはチームマネジメントの専門家です。以下のチーム日報データを分析し、チーム全体の進捗サマリーを作成してください。

分析項目:
1. チーム全体の進捗概要
2. 各メンバーの貫献度
3. チーム全体の課題・ボトルネック
4. 改善提案とアクションアイテム

日本語で回答してください。`
          : `你是一位团队管理专家。请分析以下团队日报数据，创建团队整体进度摘要。

分析项目:
1. 团队整体进度概要
2. 各成员的贡献度
3. 团队整体的课题和瓶颈
4. 改进建议和行动项目

请用中文回答。`;

        const userPrompt = `チームメンバー数: ${Object.keys(staffReports).length}人
総日報数: ${reports.length}件
${input.country ? `国: ${input.country}` : ""}

チームデータ:
${JSON.stringify(teamSummary, null, 2)}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const analysis = response.choices[0]?.message?.content || "";

          return {
            success: true,
            memberCount: Object.keys(staffReports).length,
            reportCount: reports.length,
            analysis: typeof analysis === "string" ? analysis : JSON.stringify(analysis),
          };
        } catch (error) {
          console.error("AI team analysis error:", error);
          return {
            success: false,
            error: input.language === "ja" ? "AI分析中にエラーが発生しました" : "AI分析过程中发生错误",
          };
        }
      }),

    // Extract followup items from reports using AI
    extractFollowups: protectedProcedure
      .input(
        z.object({
          reportId: z.number(),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const reportData = await getReportById(input.reportId);
        if (!reportData) {
          return { success: false, error: "Report not found" };
        }

        const { report, staff } = reportData;
        const workContent = report.workContent || "";

        // Keywords to detect followup items
        const followupKeywords = [
          "提案", "打ち合わせ", "商談", "MTG", "ミーティング", "会議",
          "確認", "検討", "相談", "調整", "連絡", "報告",
          "合同", "会合", "面談", "訪問", "見積", "契約",
          "提议", "会议", "商谈", "确认", "讨论", "协商", "联系"
        ];

        const systemPrompt = input.language === "ja"
          ? `あなたは業務内容からフォローアップが必要な項目を抽出する専門家です。

以下の日報内容から、フォローアップが必要な項目（提案、打ち合わせ、商談、MTG、確認事項など）を抽出してください。

出力形式（JSON配列）:
[
  {
    "item": "抽出された項目（簡潔に）",
    "category": "提案" | "打ち合わせ" | "商談" | "MTG" | "確認" | "その他"
  }
]

該当する項目がない場合は空の配列 [] を返してください。`
          : `你是一位从工作内容中提取需要跟进事项的专家。

请从以下日报内容中提取需要跟进的事项（提案、会议、商谈、MTG、确认事项等）。

输出格式（JSON数组）:
[
  {
    "item": "提取的事项（简洁）",
    "category": "提案" | "打ち合わせ" | "商談" | "MTG" | "確認" | "その他"
  }
]

如果没有相关事项，请返回空数组 []。`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `日報内容:\n${workContent}` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "followup_items",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item: { type: "string" },
                          category: { type: "string" }
                        },
                        required: ["item", "category"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["items"],
                  additionalProperties: false
                }
              }
            }
          });

          const rawContent = response.choices[0]?.message?.content || "{}";
          const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
          const parsed = JSON.parse(content);
          const extractedItems = parsed.items || [];

          // Calculate due date (2 days from report date)
          const reportDate = new Date(report.reportDate);
          const dueDate = new Date(reportDate);
          dueDate.setDate(dueDate.getDate() + 2);

          // Create followup records
          const createdFollowups = [];
          for (const item of extractedItems) {
            // Check if already exists
            const existing = await checkExistingFollowup(report.id, item.item);
            if (!existing) {
              const category = ["提案", "打ち合わせ", "商談", "MTG", "確認"].includes(item.category)
                ? item.category as "提案" | "打ち合わせ" | "商談" | "MTG" | "確認"
                : "その他";
              
              const followup = await createReportFollowup({
                reportId: report.id,
                reportStaffId: report.reportStaffId,
                extractedItem: item.item,
                category,
                status: "pending",
                dueDate,
              });
              if (followup) {
                createdFollowups.push(followup);
              }
            }
          }

          return {
            success: true,
            extractedCount: extractedItems.length,
            createdCount: createdFollowups.length,
            items: createdFollowups,
          };
        } catch (error) {
          console.error("Followup extraction error:", error);
          return {
            success: false,
            error: input.language === "ja" ? "フォローアップ抽出中にエラーが発生しました" : "跟进事项提取过程中发生错误",
          };
        }
      }),

    // Get all pending followups
    pendingFollowups: protectedProcedure.query(async () => {
      return await getPendingFollowups();
    }),

    // Get overdue followups (for highlighting) with optional staff filter
    overdueFollowups: protectedProcedure
      .input(z.object({ staffId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getOverdueFollowups(input?.staffId);
      }),

    // Get completed followups with optional staff filter
    completedFollowups: protectedProcedure
      .input(z.object({ staffId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getCompletedFollowups(input?.staffId);
      }),

    // Update followup status with result recording
    updateFollowupStatus: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["pending", "completed", "cancelled"]),
          resultCategory: z.enum(["成約", "継続", "保留", "失注", "完了"]).optional(),
          resultNote: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateFollowupStatus(input.id, input.status, input.resultCategory, input.resultNote);
        return { success: true };
      }),

    // Complete followup with result and generate next action suggestion
    completeWithResult: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          resultCategory: z.enum(["成約", "継続", "保留", "失注", "完了"]),
          resultNote: z.string().optional(),
          createNextAction: z.boolean().default(false),
          nextActionItem: z.string().optional(),
          nextActionCategory: z.enum(["提案", "打ち合わせ", "商談", "MTG", "確認", "その他"]).optional(),
          nextActionDueDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Get the current followup to get reportId and staffId
        const currentFollowup = await getFollowupById(input.id);
        if (!currentFollowup) {
          throw new Error("Followup not found");
        }

        // Update the current followup with result
        await updateFollowupStatus(input.id, "completed", input.resultCategory, input.resultNote);

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "followup_complete",
          actionLabel: "フォローアップを完了",
          targetId: input.id,
          targetName: currentFollowup.extractedItem?.substring(0, 50) || `フォローアップ #${input.id}`,
        });

        let nextActionId = null;

        // Create next action if requested
        if (input.createNextAction && input.nextActionItem) {
          const nextAction = await createReportFollowup({
            reportId: currentFollowup.reportId,
            reportStaffId: currentFollowup.reportStaffId,
            extractedItem: input.nextActionItem,
            category: input.nextActionCategory || "その他",
            dueDate: input.nextActionDueDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          });
          if (nextAction) {
            nextActionId = nextAction.id;
            // Link the next action to the current followup
            await linkNextAction(input.id, nextActionId);
          }
        }

        return { success: true, nextActionId };
      }),

    // AI suggest next action based on followup content and result
    suggestNextAction: protectedProcedure
      .input(
        z.object({
          followupId: z.number(),
          resultCategory: z.enum(["成約", "継続", "保留", "失注", "完了"]),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const followup = await getFollowupById(input.followupId);
        if (!followup) {
          throw new Error("Followup not found");
        }

        // Only suggest next action for "継続" or "保留"
        if (input.resultCategory !== "継続" && input.resultCategory !== "保留") {
          return { suggestion: null, reason: "この結果には次のアクションは不要です" };
        }

        const prompt = input.language === "ja" 
          ? `以下のフォローアップ項目の結果が「${input.resultCategory}」です。次のアクションを提案してください。

元の項目: ${followup.extractedItem}
カテゴリ: ${followup.category}

以下のJSON形式で回答してください:
{
  "nextAction": "次のアクションの内容（30文字以内）",
  "category": "提案|打ち合わせ|商談|MTG|確認|その他",
  "daysUntilDue": 2-7の数字
}`
          : `以下跟进事项的结果是「${input.resultCategory}」。请提议下一步行动。

原始事项: ${followup.extractedItem}
类别: ${followup.category}

请以以下JSON格式回复:
{
  "nextAction": "下一步行动内容（30字以内）",
  "category": "提案|打ち合わせ|商談|MTG|確認|その他",
  "daysUntilDue": 2-7的数字
}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "あなたはビジネスアシスタントです。簡潔に次のアクションを提案してください。" },
              { role: "user", content: prompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "next_action_suggestion",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    nextAction: { type: "string" },
                    category: { type: "string" },
                    daysUntilDue: { type: "number" },
                  },
                  required: ["nextAction", "category", "daysUntilDue"],
                  additionalProperties: false,
                },
              },
            },
          });

          const content = response.choices[0]?.message?.content;
          if (content && typeof content === 'string') {
            const suggestion = JSON.parse(content);
            return {
              suggestion: {
                item: suggestion.nextAction,
                category: suggestion.category,
                dueDate: new Date(Date.now() + suggestion.daysUntilDue * 24 * 60 * 60 * 1000),
              },
            };
          }
        } catch (error) {
          console.error("Error suggesting next action:", error);
        }

        return { suggestion: null };
      }),

    // Get followups by report
    getFollowupsByReport: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return await getFollowupsByReportId(input.reportId);
      }),

    // Get followups by staff
    getFollowupsByStaff: protectedProcedure
      .input(z.object({ reportStaffId: z.number() }))
      .query(async ({ input }) => {
        return await getFollowupsByStaffId(input.reportStaffId);
      }),

    // Delete followup
    deleteFollowup: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteReportFollowup(input.id);
        return { success: true };
      }),

    // Batch extract followups from recent reports
    batchExtractFollowups: protectedProcedure
      .input(
        z.object({
          days: z.number().default(7),
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);

        const reports = await getReportsForAnalysis({
          startDate,
          endDate,
        });

        let totalExtracted = 0;
        let totalCreated = 0;

        for (const { report } of reports) {
          const workContent = report.workContent || "";
          if (!workContent.trim()) continue;

          // Simple keyword-based extraction for batch processing
          const followupKeywords = [
            "提案", "打ち合わせ", "商談", "MTG", "ミーティング",
            "確認", "検討", "相談", "調整", "連絡",
            "合同", "会合", "面談", "訪問",
            "提议", "会议", "商谈", "确认", "讨论"
          ];

          const hasFollowupKeyword = followupKeywords.some(kw => workContent.includes(kw));
          if (!hasFollowupKeyword) continue;

          // Extract sentences containing keywords
          const sentences = workContent.split(/[。\n]/).filter(s => s.trim());
          for (const sentence of sentences) {
            const matchedKeyword = followupKeywords.find(kw => sentence.includes(kw));
            if (matchedKeyword) {
              const item = sentence.trim().substring(0, 100);
              const existing = await checkExistingFollowup(report.id, item);
              if (!existing) {
                let category: "提案" | "打ち合わせ" | "商談" | "MTG" | "確認" | "その他" = "その他";
                if (sentence.includes("提案") || sentence.includes("提议")) category = "提案";
                else if (sentence.includes("打ち合わせ") || sentence.includes("会议") || sentence.includes("ミーティング")) category = "打ち合わせ";
                else if (sentence.includes("商談") || sentence.includes("商谈")) category = "商談";
                else if (sentence.includes("MTG")) category = "MTG";
                else if (sentence.includes("確認") || sentence.includes("确认")) category = "確認";

                const reportDate = new Date(report.reportDate);
                const dueDate = new Date(reportDate);
                dueDate.setDate(dueDate.getDate() + 2);

                await createReportFollowup({
                  reportId: report.id,
                  reportStaffId: report.reportStaffId,
                  extractedItem: item,
                  category,
                  status: "pending",
                  dueDate,
                });
                totalCreated++;
              }
              totalExtracted++;
            }
          }
        }

        return {
          success: true,
          reportsProcessed: reports.length,
          totalExtracted,
          totalCreated,
        };
      }),
    // AI Department Weekly Summary - 部門週報サマリー
    generateWeeklySummary: protectedProcedure
      .input(
        z.object({
          country: z.string(), // "日本" or "中国" (department)
          startDate: z.string(), // ISO date string
          endDate: z.string(),   // ISO date string
          language: z.enum(["ja", "zh"]).default("ja"),
        })
      )
      .mutation(async ({ input }) => {
        const reports = await getReportsForAnalysis({
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          country: input.country,
        });

        if (reports.length === 0) {
          return {
            success: false,
            error: input.language === "ja" ? "該当期間の日報がありません" : "该时间段没有日报数据",
          };
        }

        // Group reports by staff with full details
        const staffReports: Record<string, { name: string; reports: { date: Date | null; workContent: string; issues: string | null; remarks: string | null }[] }> = {};
        for (const r of reports) {
          const staffId = r.staff?.id?.toString() || "unknown";
          const staffName = r.staff?.name || "不明";
          if (!staffReports[staffId]) {
            staffReports[staffId] = { name: staffName, reports: [] };
          }
          staffReports[staffId].reports.push({
            date: r.report.reportDate,
            workContent: r.report.workContent,
            issues: r.report.issues,
            remarks: r.report.remarks,
          });
        }

        // Build detailed staff data for AI
        const staffDetails = Object.entries(staffReports).map(([id, data]) => ({
          staffName: data.name,
          reportCount: data.reports.length,
          allWork: data.reports.map(r => {
            const dateStr = r.date ? new Date(r.date).toLocaleDateString("ja-JP") : "不明";
            return `[${dateStr}] ${r.workContent}${r.issues ? ` | 問題: ${r.issues}` : ""}${r.remarks ? ` | 備考: ${r.remarks}` : ""}`;
          }).join("\n"),
        }));

        const isJa = input.language === "ja";
        const dateRange = `${new Date(input.startDate).toLocaleDateString("ja-JP")} ~ ${new Date(input.endDate).toLocaleDateString("ja-JP")}`;

        const systemPrompt = isJa
          ? `あなたはLCJ（ライブコマースジャパン）の部門マネージャーAIです。
部門の全スタッフの日報データを分析し、部門レベルの週報を作成してください。

以下のフォーマットで出力してください（Markdown形式）:

# ${input.country}部門 週報
## 期間: ${dateRange}

### 1. 成果サマリー
各スタッフの主要な成果を簡潔にまとめてください。

### 2. 進行中のプロジェクト・案件
現在進行中の重要な案件やプロジェクトをリストアップしてください。

### 3. 問題点・課題
報告された問題点や課題を整理してください。

### 4. 来週のアクションプラン
来週に向けた具体的なアクション提案をしてください。

### 5. 総合評価・コメント
部門全体のパフォーマンスについてコメントしてください。

日本語で回答してください。`
          : `你是LCJ（Live Commerce Japan）的部门经理AI。
请分析部门所有员工的日报数据，创建部门级周报。

请按以下格式输出（Markdown格式）:

# ${input.country}部门 周报
## 期间: ${dateRange}

### 1. 成果汇总
简要总结各员工的主要成果。

### 2. 进行中的项目/案件
列出当前进行中的重要案件或项目。

### 3. 问题梳理
整理报告中提到的问题和课题。

### 4. 下周行动计划
提出下周的具体行动建议。

### 5. 综合评价与建议
对部门整体表现进行评价。

请用中文回答。`;

        const userPrompt = `部門: ${input.country}
期間: ${dateRange}
スタッフ数: ${Object.keys(staffReports).length}人
総日報数: ${reports.length}件

各スタッフの日報データ:
${staffDetails.map(s => `\n【${s.staffName}】(${s.reportCount}件)\n${s.allWork}`).join("\n")}`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const summary = response.choices[0]?.message?.content || "";

          return {
            success: true,
            department: input.country,
            dateRange,
            memberCount: Object.keys(staffReports).length,
            reportCount: reports.length,
            staffBreakdown: staffDetails.map(s => ({
              staffName: s.staffName,
              reportCount: s.reportCount,
            })),
            summary: typeof summary === "string" ? summary : JSON.stringify(summary),
          };
        } catch (error) {
          console.error("AI weekly summary error:", error);
          return {
            success: false,
            error: isJa ? "AI週報生成中にエラーが発生しました" : "AI周报生成过程中发生错误",
          };
        }
      }),
  }),

  // Brand Management Router
  brand: router({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          nameJa: z.string().min(1),
          companyName: z.string().optional(),
          category: z.string().optional(),
          phoneNumber: z.string().optional(),
          status: z.enum(["進行中", "打ち合わせ中", "契約済み", "保留", "終了"]).default("進行中"),
          materialCategory: z.string().optional(),
          email: z.string().optional(),
          contactPerson: z.string().optional(),
          adBudget: z.number().optional(),
          salesTarget: z.number().optional(),
          commissionRate: z.string().optional(),
          businessCardUrls: z.array(z.string()).optional(),
          businessCardKeys: z.array(z.string()).optional(),
          logoUrl: z.string().optional(),
          logoKey: z.string().optional(),
          shopId: z.string().optional(),
          shopCode: z.string().optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const brand = await createBrand({
          ...input,
          createdBy: ctx.user.id,
        });
        
        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "brand_create",
          actionLabel: "ブランドを作成",
          targetId: brand.id,
          targetName: brand.brandName,
        });
        
        // AitherHub自動同期（非同期・失敗してもブランド作成は成功）
        try {
          const { onBrandCreated } = await import("./aitherhubBrandSync");
          onBrandCreated({
            id: brand.id,
            name: input.name,
            nameJa: input.nameJa,
            companyName: input.companyName,
            category: input.category,
            logoUrl: input.logoUrl,
            email: input.email,
            contactPerson: input.contactPerson,
            status: input.status,
          }).catch(err => console.error("[AitherHub Sync] brand create sync failed:", err));
        } catch (err) {
          console.error("[AitherHub Sync] import error:", err);
        }
        
        return brand;
      }),

    // Public list for liver pages (no auth required)
    list: publicProcedure
      .input(
        z.object({
          status: z.string().optional(),
          search: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getAllBrands(input);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getBrandById(input.id);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          nameJa: z.string().optional(),
          companyName: z.string().optional(),
          category: z.string().optional(),
          phoneNumber: z.string().optional(),
          status: z.enum(["進行中", "打ち合わせ中", "契約済み", "保留", "終了"]).optional(),
          materialCategory: z.string().optional(),
          email: z.string().optional(),
          contactPerson: z.string().optional(),
          adBudget: z.number().optional(),
          salesTarget: z.number().optional(),
          commissionRate: z.string().optional(),
          businessCardUrls: z.array(z.string()).optional(),
          businessCardKeys: z.array(z.string()).optional(),
          logoUrl: z.string().optional(),
          logoKey: z.string().optional(),
          shopId: z.string().optional(),
          shopCode: z.string().optional(),
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const updated = await updateBrand(id, updateData);
        
        // AitherHub自動同期（非同期・失敗してもブランド更新は成功）
        if (updated) {
          try {
            const { onBrandUpdated } = await import("./aitherhubBrandSync");
            onBrandUpdated({
              id: updated.id,
              name: updated.name,
              nameJa: updated.nameJa,
              companyName: updated.companyName,
              category: updated.category,
              logoUrl: updated.logoUrl,
              email: updated.email,
              contactPerson: updated.contactPerson,
              status: updated.status,
            }).catch(err => console.error("[AitherHub Sync] brand update sync failed:", err));
          } catch (err) {
            console.error("[AitherHub Sync] import error:", err);
          }
        }
        
        return updated;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        // AitherHub同期（削除前にブランド名を取得）
        const brandToDelete = await getBrandById(input.id);
        
        await deleteBrand(input.id);
        
        // AitherHub側も無効化
        if (brandToDelete) {
          try {
            const { onBrandDeleted } = await import("./aitherhubBrandSync");
            onBrandDeleted(input.id, brandToDelete.name).catch(err => console.error("[AitherHub Sync] brand delete sync failed:", err));
          } catch (err) {
            console.error("[AitherHub Sync] import error:", err);
          }
        }
        
        return { success: true };
      }),

    statistics: protectedProcedure.query(async () => {
      return await getBrandStatistics();
    }),

    // Generate AI advertising proposal for a brand
    generateAdProposal: protectedProcedure
      .input(z.object({ brandId: z.number(), language: z.enum(['ja', 'zh']).optional().default('ja') }))
      .mutation(async ({ input }) => {
        const lang = input.language || 'ja';
        // Get brand data
        const brand = await getBrandById(input.brandId);
        if (!brand) {
          throw new Error("Brand not found");
        }

        // Get contracts for the brand
        const contracts = await getContractsByBrandId(input.brandId);
        
        // Get livestreams for the brand
        const livestreams = await getLivestreamsByBrandId(input.brandId);
        
        // Get products for the brand
        const products = await getProductsByBrandId(input.brandId);

        // 契約ステータス別に分類
        const completedContracts = contracts.filter(c => c.status === '完了');
        const activeContracts = contracts.filter(c => c.status === '契約中');

        // 契約ごとの配信データを取得する関数
        const getContractMetrics = async (contract: typeof contracts[0]) => {
          // 契約に紐付いた配信を取得
          const linkedLivestreams = await getContractLinkedLivestreams(contract.id);
          
          // GMV計算
          const gmv = linkedLivestreams.reduce((sum, ls) => {
            const gmvValue = ls.salesAmount || ls.gmv || 0;
            return sum + gmvValue;
          }, 0);
          
          // インプレッション数
          const impressions = linkedLivestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
          
          // 広告換算費用
          const adValue = impressions * 15;
          
          // 総価値
          const totalValue = gmv + adValue;
          
          // 契約金額
          const contractAmount = contract.fixedFee || 0;
          
          // ROAS
          const roas = contractAmount > 0 ? totalValue / contractAmount : 0;
          
          // 配信回数（ユニークな日付）
          const uniqueDates = new Set<string>();
          linkedLivestreams.forEach((ls) => {
            if (ls.livestreamDate) {
              const dateStr = new Date(ls.livestreamDate).toISOString().split('T')[0];
              uniqueDates.add(dateStr);
            }
          });
          const livestreamCount = uniqueDates.size;
          
          return {
            contractId: contract.id,
            serviceType: contract.serviceType,
            status: contract.status,
            fixedFee: contractAmount,
            startDate: contract.startDate,
            endDate: contract.endDate,
            gmv,
            impressions,
            adValue,
            totalValue,
            roas,
            livestreamCount,
            avgSalesPerLive: livestreamCount > 0 ? gmv / livestreamCount : 0,
          };
        };

        // 完了契約のメトリクス
        const completedContractMetrics = await Promise.all(
          completedContracts.map(c => getContractMetrics(c))
        );
        
        // 進行中契約のメトリクス（予測ROAS付き）
        const activeContractMetrics = await Promise.all(
          activeContracts.map(async (c) => {
            const metrics = await getContractMetrics(c);
            
            // 予測ROASを計算（現時点の平均売上 × 予定回数 / 契約金額）
            // plannedLivestreamCountが設定されていればそれを使用、なければ契約期間から推定
            let estimatedTotalLivestreams = metrics.livestreamCount;
            if (c.plannedLivestreamCount && c.plannedLivestreamCount > 0) {
              // 予定配信回数が設定されている場合はそれを使用
              estimatedTotalLivestreams = c.plannedLivestreamCount;
            } else if (c.startDate && c.endDate) {
              // 予定配信回数が未設定の場合は契約期間から推定（月に2回と仮定）
              const startDate = new Date(c.startDate);
              const endDate = new Date(c.endDate);
              const months = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
              estimatedTotalLivestreams = Math.round(months * 2);
            }
            
            // 進捗率
            const progressRate = estimatedTotalLivestreams > 0 
              ? metrics.livestreamCount / estimatedTotalLivestreams 
              : 0;
            
            // 予測GMV（現時点の平均 × 予定回数）
            const projectedGmv = metrics.livestreamCount > 0 
              ? (metrics.gmv / metrics.livestreamCount) * estimatedTotalLivestreams 
              : 0;
            
            // 予測インプレッション
            const projectedImpressions = metrics.livestreamCount > 0 
              ? (metrics.impressions / metrics.livestreamCount) * estimatedTotalLivestreams 
              : 0;
            
            // 予測広告換算費用
            const projectedAdValue = projectedImpressions * 15;
            
            // 予測総価値
            const projectedTotalValue = projectedGmv + projectedAdValue;
            
            // 予測ROAS
            const projectedRoas = metrics.fixedFee > 0 ? projectedTotalValue / metrics.fixedFee : 0;
            
            return {
              ...metrics,
              plannedLivestreamCount: c.plannedLivestreamCount || null,
              estimatedTotalLivestreams,
              progressRate,
              projectedGmv,
              projectedImpressions,
              projectedAdValue,
              projectedTotalValue,
              projectedRoas,
            };
          })
        );

        // 完了契約の合計
        const completedTotalsBase = {
          gmv: completedContractMetrics.reduce((sum, m) => sum + m.gmv, 0),
          impressions: completedContractMetrics.reduce((sum, m) => sum + m.impressions, 0),
          adValue: completedContractMetrics.reduce((sum, m) => sum + m.adValue, 0),
          totalValue: completedContractMetrics.reduce((sum, m) => sum + m.totalValue, 0),
          contractAmount: completedContractMetrics.reduce((sum, m) => sum + m.fixedFee, 0),
          livestreamCount: completedContractMetrics.reduce((sum, m) => sum + m.livestreamCount, 0),
        };
        const completedTotals = {
          ...completedTotalsBase,
          roas: completedTotalsBase.contractAmount > 0 
            ? completedTotalsBase.totalValue / completedTotalsBase.contractAmount 
            : 0,
        };

        // 進行中契約の合計
        const activeTotalsBase = {
          gmv: activeContractMetrics.reduce((sum, m) => sum + m.gmv, 0),
          impressions: activeContractMetrics.reduce((sum, m) => sum + m.impressions, 0),
          adValue: activeContractMetrics.reduce((sum, m) => sum + m.adValue, 0),
          totalValue: activeContractMetrics.reduce((sum, m) => sum + m.totalValue, 0),
          contractAmount: activeContractMetrics.reduce((sum, m) => sum + m.fixedFee, 0),
          livestreamCount: activeContractMetrics.reduce((sum, m) => sum + m.livestreamCount, 0),
          projectedGmv: activeContractMetrics.reduce((sum, m) => sum + m.projectedGmv, 0),
          projectedTotalValue: activeContractMetrics.reduce((sum, m) => sum + m.projectedTotalValue, 0),
        };
        const activeTotals = {
          ...activeTotalsBase,
          roas: activeTotalsBase.contractAmount > 0 
            ? activeTotalsBase.totalValue / activeTotalsBase.contractAmount 
            : 0,
          projectedRoas: activeTotalsBase.contractAmount > 0 
            ? activeTotalsBase.projectedTotalValue / activeTotalsBase.contractAmount 
            : 0,
        };

        // Calculate key metrics
        // salesAmountがnullの場合はgmvを使用、両方nullの場合はproductGmvTotalを使用
        const totalGmv = livestreams.reduce((sum, ls) => {
          const gmvValue = ls.salesAmount || ls.gmv || ls.productGmvTotal || 0;
          return sum + gmvValue;
        }, 0);
        // 広告費は契約情報のfixedFee（ブランド投入）から取得
        const totalAdCost = contracts.reduce((sum, c) => sum + (c.fixedFee || 0), 0);
        // インプレッション数を集計
        const totalImpressions = livestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
        // 広告換算費用 = インプレッション × 15円（CPM ¥15,000 = 1000インプレッションあたり¥15,000 → 1インプレッションあたり¥15）
        const adValue = totalImpressions * 15;
        // 総価値 = GMV + 広告換算費用
        const totalValue = totalGmv + adValue;
        // ROAS = 総価値 ÷ 固定費（契約金額）
        const avgRoas = totalAdCost > 0 ? totalValue / totalAdCost : 0;
        // 同じ日の配信は1回としてカウント（ユニークな日付の数）
        const uniqueDates = new Set<string>();
        livestreams.forEach((ls) => {
          if (ls.livestreamDate) {
            const dateStr = new Date(ls.livestreamDate).toISOString().split('T')[0];
            uniqueDates.add(dateStr);
          }
        });
        const totalLivestreams = uniqueDates.size;
        const avgSalesPerLive = totalLivestreams > 0 ? totalGmv / totalLivestreams : 0;
        
        // Get top products by GMV from all livestreams
        const productGmvMap = new Map<string, number>();
        for (const ls of livestreams) {
          // Get products for this livestream
          const lsProducts = await getLivestreamProductsByLivestreamId(ls.id);
          for (const p of lsProducts) {
            const current = productGmvMap.get(p.productName) || 0;
            productGmvMap.set(p.productName, current + (p.directGmv || p.gmv || 0));
          }
        }
        const topProducts = Array.from(productGmvMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, gmv]) => ({ name, gmv }));

        // Calculate average duration and best performing time slots
        const avgDuration = totalLivestreams > 0 
          ? livestreams.reduce((sum, ls) => sum + (ls.duration || 0), 0) / totalLivestreams 
          : 0;

        // Get contract info (activeContracts is already defined above)
        const totalContractValue = activeContracts.reduce((sum, c) => sum + (c.fixedFee || 0), 0);

        // Build prompt for AI based on language
        const promptJa = `あなたはTikTokライブコマースの広告戦略コンサルタントです。以下のブランドデータを分析し、具体的な広告提案を作成してください。

## ブランド情報
- ブランド名: ${brand.name} (${brand.nameJa || ''})
- カテゴリー: ${brand.category || '未設定'}
- ステータス: ${brand.status || '未設定'}

## 実績データ
- 総GMV: ¥${totalGmv.toLocaleString()}
- 総インプレッション: ${totalImpressions.toLocaleString()}回
- 広告換算費用: ¥${adValue.toLocaleString()}（CPM ¥15,000ベース）
- 総価値: ¥${totalValue.toLocaleString()}（GMV + 広告換算費用）
- 総広告費（契約金額）: ¥${totalAdCost.toLocaleString()}
- 広告効果ROAS: ${avgRoas.toFixed(2)}倍
- 配信回数: ${totalLivestreams}回
- 平均売上/配信: ¥${Math.round(avgSalesPerLive).toLocaleString()}
- 平均配信時間: ${Math.round(avgDuration)}分

## 売れ筋商品TOP5
${topProducts.map((p, i) => `${i + 1}. ${p.name}: ¥${p.gmv.toLocaleString()}`).join('\n')}

## 契約情報
- アクティブ契約数: ${activeContracts.length}件
- 契約総額: ¥${totalContractValue.toLocaleString()}

## 商品数
- 登録商品数: ${products.length}点

---

上記のデータを分析し、以下の形式で広告提案を作成してください：

1. **現状分析** (約200字)
   - ROASの評価（業界平均との比較）
   - 強みと課題

2. **推奨広告戦略** (約300字)
   - 推奨広告予算（具体的な金額）
   - 推奨配信頻度
   - ターゲット層の提案
   - 推奨商品選定

3. **アクションプラン** (約200字)
   - 短期（1ヶ月）の具体的なアクション
   - 中期（3ヶ月）の目標
   - 期待されるROAS改善率

日本語で回答してください。具体的な数字を含めてください。`;

        const promptZh = `你是TikTok直播电商的广告策略顾问。请分析以下品牌数据，并制定具体的广告提案。

## 品牌信息
- 品牌名: ${brand.name} (${brand.nameJa || ''})
- 类别: ${brand.category || '未设置'}
- 状态: ${brand.status || '未设置'}

## 业绩数据
- 总GMV: ¥${totalGmv.toLocaleString()}
- 总曝光量: ${totalImpressions.toLocaleString()}次
- 广告换算费用: ¥${adValue.toLocaleString()}（CPM ¥15,000基准）
- 总价值: ¥${totalValue.toLocaleString()}（GMV + 广告换算费用）
- 总广告费（合同金额）: ¥${totalAdCost.toLocaleString()}
- 广告效果ROAS: ${avgRoas.toFixed(2)}倍
- 直播次数: ${totalLivestreams}次
- 平均销售额/直播: ¥${Math.round(avgSalesPerLive).toLocaleString()}
- 平均直播时长: ${Math.round(avgDuration)}分钟

## 畅销商品TOP5
${topProducts.map((p, i) => `${i + 1}. ${p.name}: ¥${p.gmv.toLocaleString()}`).join('\n')}

## 合同信息
- 有效合同数: ${activeContracts.length}件
- 合同总额: ¥${totalContractValue.toLocaleString()}

## 商品数
- 注册商品数: ${products.length}个

---

请分析以上数据，按以下格式制定广告提案：

1. **现状分析** (约200字)
   - ROAS评估（与行业平均比较）
   - 优势与课题

2. **推荐广告策略** (约300字)
   - 推荐广告预算（具体金额）
   - 推荐直播频率
   - 目标用户群体建议
   - 推荐商品选择

3. **行动计划** (约200字)
   - 短期（1个月）具体行动
   - 中期（3个月）目标
   - 预期ROAS改善率

请用中文回答。请包含具体数字。`;

        const prompt = lang === 'zh' ? promptZh : promptJa;

        // Call LLM
        const systemPromptJa = "あなたはTikTokライブコマースの広告戦略コンサルタントです。データに基づいた具体的で実行可能な広告提案を作成してください。";
        const systemPromptZh = "你是TikTok直播电商的广告策略顾问。请根据数据制定具体可执行的广告提案。";
        const response = await invokeLLM({
          messages: [
            { role: "system", content: lang === 'zh' ? systemPromptZh : systemPromptJa },
            { role: "user", content: prompt },
          ],
        });

        const proposalContent = response.choices[0]?.message?.content || "提案を生成できませんでした";

        return {
          brandId: input.brandId,
          brandName: brand.name,
          proposal: proposalContent,
          metrics: {
            totalGmv,
            totalImpressions,
            adValue,
            totalValue,
            totalAdCost,
            avgRoas,
            totalLivestreams,
            avgSalesPerLive,
            avgDuration,
            topProducts,
            activeContractsCount: activeContracts.length,
            completedContractsCount: completedContracts.length,
            totalContractValue,
            productsCount: products.length,
            // 契約ステータス別メトリクス
            completedTotals,
            activeTotals,
            completedContractMetrics,
            activeContractMetrics,
          },
          generatedAt: new Date().toISOString(),
        };
      }),

    // Save ad proposal to history
    saveAdProposal: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        proposalContent: z.string(),
        metrics: z.object({
          totalGmv: z.number(),
          totalImpressions: z.number(),
          adValue: z.number(),
          totalValue: z.number(),
          totalAdCost: z.number(),
          avgRoas: z.number(),
          totalLivestreams: z.number(),
          avgSalesPerLive: z.number(),
          avgDuration: z.number(),
          topProducts: z.array(z.object({ name: z.string(), gmv: z.number() })),
          activeContractsCount: z.number(),
          productsCount: z.number(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get the latest version number
        const latestVersion = await getLatestProposalVersion(input.brandId);
        const newVersion = latestVersion + 1;

        // Save to database
        await createAdProposalHistory({
          brandId: input.brandId,
          version: newVersion,
          proposalContent: input.proposalContent,
          totalGmv: input.metrics.totalGmv,
          totalImpressions: input.metrics.totalImpressions,
          adValue: input.metrics.adValue,
          totalValue: input.metrics.totalValue,
          totalAdCost: input.metrics.totalAdCost,
          avgRoas: String(input.metrics.avgRoas),
          totalLivestreams: input.metrics.totalLivestreams,
          avgSalesPerLive: input.metrics.avgSalesPerLive,
          avgDuration: input.metrics.avgDuration,
          productsCount: input.metrics.productsCount,
          activeContractsCount: input.metrics.activeContractsCount,
          topProducts: input.metrics.topProducts,
          status: 'draft',
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email,
        });

        return { success: true, version: newVersion };
      }),

    // Get ad proposal history for a brand
    getAdProposalHistory: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getAdProposalsByBrandId(input.brandId);
      }),

    // Get a specific ad proposal by ID
    getAdProposalById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getAdProposalById(input.id);
      }),

    // Update ad proposal status
    updateAdProposalStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
      }))
      .mutation(async ({ input }) => {
        await updateAdProposalStatus(input.id, input.status);
        return { success: true };
      }),

    // Delete ad proposal
    deleteAdProposal: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAdProposal(input.id);
        return { success: true };
      }),

    // Generate PDF for ad proposal
    generateAdProposalPdf: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        brandName: z.string(),
        brandNameJa: z.string().optional(),
        language: z.enum(['ja', 'zh']).default('ja'),
        proposalContent: z.string(),
        metrics: z.object({
          totalGmv: z.number(),
          totalImpressions: z.number(),
          adValue: z.number(),
          totalValue: z.number(),
          totalAdCost: z.number(),
          avgRoas: z.number(),
          totalLivestreams: z.number(),
          avgSalesPerLive: z.number(),
          avgDuration: z.number(),
          topProducts: z.array(z.object({ name: z.string(), gmv: z.number() })),
          activeContractsCount: z.number(),
          productsCount: z.number(),
        }),
        generatedAt: z.string(),
      }))
      .mutation(async ({ input }) => {
        const isJa = input.language === 'ja';
        
        // Generate HTML content for PDF
        const htmlContent = `
<!DOCTYPE html>
<html lang="${input.language}">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: ${isJa ? "'Noto Sans JP'" : "'Noto Sans SC'"}, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      padding: 40px;
      min-height: 100vh;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: rgba(30, 30, 50, 0.9);
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid rgba(139, 92, 246, 0.3);
    }
    
    .header h1 {
      font-size: 28px;
      background: linear-gradient(90deg, #8b5cf6, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    
    .header .brand-name {
      font-size: 20px;
      color: #a78bfa;
    }
    
    .header .date {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 8px;
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 30px;
    }
    
    .metric-card {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .metric-card.cyan { border-color: rgba(34, 211, 238, 0.3); }
    .metric-card.pink { border-color: rgba(236, 72, 153, 0.3); }
    .metric-card.amber { border-color: rgba(251, 191, 36, 0.3); }
    .metric-card.purple { border-color: rgba(168, 85, 247, 0.3); }
    .metric-card.green { border-color: rgba(34, 197, 94, 0.3); }
    .metric-card.indigo { border-color: rgba(99, 102, 241, 0.3); }
    .metric-card.rose { border-color: rgba(244, 63, 94, 0.3); }
    
    .metric-label {
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 4px;
    }
    
    .metric-value {
      font-size: 18px;
      font-weight: 700;
    }
    
    .metric-value.cyan { color: #22d3ee; }
    .metric-value.pink { color: #ec4899; }
    .metric-value.amber { color: #fbbf24; }
    .metric-value.purple { color: #a855f7; }
    .metric-value.green { color: #22c55e; }
    .metric-value.indigo { color: #6366f1; }
    .metric-value.rose { color: #f43f5e; }
    
    .metric-sub {
      font-size: 9px;
      color: #6b7280;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #a78bfa;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-title::before {
      content: '';
      width: 4px;
      height: 20px;
      background: linear-gradient(180deg, #8b5cf6, #ec4899);
      border-radius: 2px;
    }
    
    .top-products {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 12px;
      padding: 16px;
    }
    
    .product-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .product-item:last-child {
      border-bottom: none;
    }
    
    .product-rank {
      color: #a855f7;
      font-weight: 700;
      margin-right: 8px;
    }
    
    .product-name {
      color: #d1d5db;
    }
    
    .product-gmv {
      color: #22d3ee;
      font-family: monospace;
    }
    
    .proposal-content {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.05));
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(139, 92, 246, 0.2);
      white-space: pre-wrap;
      line-height: 1.8;
      font-size: 14px;
    }
    
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 11px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isJa ? 'TikTok広告提案' : 'TikTok广告提案'}</h1>
      <div class="brand-name">${input.brandName}${input.brandNameJa ? ` (${input.brandNameJa})` : ''}</div>
      <div class="date">${isJa ? '生成日時' : '生成时间'}: ${new Date(input.generatedAt).toLocaleString(isJa ? 'ja-JP' : 'zh-CN')}</div>
    </div>
    
    <div class="metrics-grid">
      <div class="metric-card cyan">
        <div class="metric-label">${isJa ? '総GMV' : '总GMV'}</div>
        <div class="metric-value cyan">¥${input.metrics.totalGmv.toLocaleString()}</div>
      </div>
      <div class="metric-card pink">
        <div class="metric-label">${isJa ? '広告換算費用' : '广告换算费用'}</div>
        <div class="metric-value pink">¥${input.metrics.adValue.toLocaleString()}</div>
        <div class="metric-sub">CPM ¥15,000</div>
      </div>
      <div class="metric-card amber">
        <div class="metric-label">${isJa ? '広告効果ROAS' : '广告效果ROAS'}</div>
        <div class="metric-value amber">${input.metrics.avgRoas.toFixed(2)}${isJa ? '倍' : '倍'}</div>
        <div class="metric-sub">${isJa ? '総価値÷契約金額' : '总价值÷合同金额'}</div>
      </div>
      <div class="metric-card purple">
        <div class="metric-label">${isJa ? '配信回数' : '直播次数'}</div>
        <div class="metric-value purple">${input.metrics.totalLivestreams}${isJa ? '回' : '次'}</div>
      </div>
    </div>
    
    <div class="metrics-grid" style="grid-template-columns: repeat(3, 1fr);">
      <div class="metric-card green">
        <div class="metric-label">${isJa ? '総インプレッション' : '总印象数'}</div>
        <div class="metric-value green">${input.metrics.totalImpressions.toLocaleString()}</div>
      </div>
      <div class="metric-card indigo">
        <div class="metric-label">${isJa ? '総価値' : '总价值'}</div>
        <div class="metric-value indigo">¥${input.metrics.totalValue.toLocaleString()}</div>
        <div class="metric-sub">${isJa ? 'GMV+広告換算' : 'GMV+广告换算'}</div>
      </div>
      <div class="metric-card rose">
        <div class="metric-label">${isJa ? '契約金額' : '合同金额'}</div>
        <div class="metric-value rose">¥${input.metrics.totalAdCost.toLocaleString()}</div>
      </div>
    </div>
    
    ${input.metrics.topProducts && input.metrics.topProducts.length > 0 ? `
    <div class="section">
      <div class="section-title">${isJa ? '売れ筋商品TOP5' : '热销商品TOP5'}</div>
      <div class="top-products">
        ${input.metrics.topProducts.map((p, i) => `
          <div class="product-item">
            <span><span class="product-rank">#${i + 1}</span><span class="product-name">${p.name}</span></span>
            <span class="product-gmv">¥${p.gmv.toLocaleString()}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="section">
      <div class="section-title">${isJa ? 'AI広告提案' : 'AI广告提案'}</div>
      <div class="proposal-content">${input.proposalContent}</div>
    </div>
    
    <div class="footer">
      ${isJa ? 'この提案はAIによって生成されました。実際の広告戦略は専門家にご相談ください。' : '此提案由AI生成。实际广告策略请咨询专家。'}
    </div>
  </div>
</body>
</html>
        `;
        
        // Use built-in PDF generation or return HTML for client-side conversion
        // For now, return the HTML content that can be converted to PDF on the client
        return {
          html: htmlContent,
          filename: `${isJa ? '広告提案' : '广告提案'}_${input.brandName}_${new Date().toISOString().split('T')[0]}.pdf`,
        };
      }),

    // Generate Ad Alert Report (Opportunity Cost Analysis)
    generateAdAlert: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        language: z.enum(['ja', 'zh']).default('ja'),
      }))
      .mutation(async ({ input }) => {
        const brand = await getBrandById(input.brandId);
        if (!brand) {
          throw new Error('Brand not found');
        }

        // Get learning data (historical ad performance stats)
        const db = await getDb();
        let learningStats: {
          avgRoas: string | null;
          avgCpm: string | null;
          avgCpc: string | null;
          optimalLiveRatio: string | null;
          optimalClipRatio: string | null;
          totalRecords: number | null;
        } | null = null;
        
        if (db) {
          const [stats] = await db
            .select({
              avgRoas: brandAdPerformanceStats.avgRoas,
              avgCpm: brandAdPerformanceStats.avgCpm,
              avgCpc: brandAdPerformanceStats.avgCpc,
              optimalLiveRatio: brandAdPerformanceStats.optimalLiveRatio,
              optimalClipRatio: brandAdPerformanceStats.optimalClipRatio,
              totalRecords: brandAdPerformanceStats.totalRecords,
            })
            .from(brandAdPerformanceStats)
            .where(eq(brandAdPerformanceStats.brandId, input.brandId));
          if (stats && stats.totalRecords && stats.totalRecords >= 3) {
            learningStats = stats;
          }
        }
        
        const hasLearningData = learningStats !== null;
        const learningDataRecords = learningStats?.totalRecords || 0;
        const learnedAvgRoas = learningStats?.avgRoas ? parseFloat(learningStats.avgRoas) : null;
        const learnedOptimalLiveRatio = learningStats?.optimalLiveRatio ? parseFloat(learningStats.optimalLiveRatio) : null;
        const learnedAvgCpm = learningStats?.avgCpm ? parseFloat(learningStats.avgCpm) : null;

        // Get all livestreams for this brand
        const livestreams = await getLivestreamsByBrandId(input.brandId);
        const contracts = await getContractsByBrandId(input.brandId);
        const products = await getProductsByBrandId(input.brandId);

        // Calculate current metrics
        const totalGmv = livestreams.reduce((sum, ls) => {
          return sum + (ls.salesAmount || ls.gmv || ls.productGmvTotal || 0);
        }, 0);
        const totalImpressions = livestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
        const adValue = totalImpressions * 15; // CPM ¥15,000
        const totalValue = totalGmv + adValue;
        const contractAmount = contracts.reduce((sum, c) => sum + (c.fixedFee || 0), 0);
        const currentRoas = contractAmount > 0 ? totalValue / contractAmount : 0;

        // Count unique livestream dates
        const uniqueDates = new Set<string>();
        livestreams.forEach((ls) => {
          if (ls.livestreamDate) {
            uniqueDates.add(new Date(ls.livestreamDate).toISOString().split('T')[0]);
          }
        });
        const totalLivestreams = uniqueDates.size;
        const avgGmvPerLive = totalLivestreams > 0 ? totalGmv / totalLivestreams : 0;
        const avgImpressionsPerLive = totalLivestreams > 0 ? totalImpressions / totalLivestreams : 0;

        // Calculate engagement rate (estimate from impressions and GMV)
        const avgConversionRate = totalImpressions > 0 ? (totalGmv / totalImpressions) * 100 : 0;

        // Ad Investment Scenarios
        // Industry benchmarks for TikTok ads
        const adCpm = 15000; // CPM for TikTok ads
        const organicReachMultiplier = 2.5; // Paid ads typically get 2.5x more reach
        const paidConversionBoost = 1.3; // Paid traffic converts 30% better due to targeting

        // Ad Type Allocation Logic
        // Live Shopping Ads: Higher conversion during live, immediate sales boost
        // Clip Ads (Spark Ads): Long-term reach, brand awareness, post-live engagement
        const liveAdCpm = 18000; // Live ads are slightly more expensive but higher conversion
        const clipAdCpm = 12000; // Clip ads are cheaper but lower immediate conversion
        const liveAdConversionBoost = 1.8; // Live ads convert 80% better (urgency + real-time)
        const clipAdConversionBoost = 1.1; // Clip ads convert 10% better than organic
        const clipAdReachMultiplier = 1.5; // Clip ads reach more people over time

        // Determine optimal allocation based on brand characteristics
        // High GMV per live = good live performance = favor live ads
        // High impressions = good content = favor clip ads for reach
        const livePerformanceScore = avgGmvPerLive > 300000 ? 0.7 : avgGmvPerLive > 100000 ? 0.5 : 0.3;
        const contentPerformanceScore = avgImpressionsPerLive > 50000 ? 0.7 : avgImpressionsPerLive > 20000 ? 0.5 : 0.3;
        
        // Calculate recommended allocation (live:clip ratio)
        // If we have learning data, use the learned optimal ratio
        // Otherwise, calculate based on current performance
        let recommendedLiveRatio = 0.5; // Default 50:50
        let allocationReason = '';
        const isJaLang = input.language === 'ja';
        let isLearningBased = false;
        
        // Use learned optimal ratio if available (3+ records)
        if (hasLearningData && learnedOptimalLiveRatio !== null) {
          recommendedLiveRatio = learnedOptimalLiveRatio;
          isLearningBased = true;
          allocationReason = isJaLang
            ? `過去${learningDataRecords}件の広告実績データに基づく最適配分です（学習済み）`
            : `基于过去${learningDataRecords}条广告实绩数据的最优分配（已学习）`;
        } else if (livePerformanceScore >= 0.7 && contentPerformanceScore < 0.5) {
          recommendedLiveRatio = 0.7; // 70% live, 30% clip
          allocationReason = isJaLang 
            ? 'ライブ配信の売上が高いため、ライブ広告重視が効果的です'
            : '直播销售高，建议重点投入直播广告';
        } else if (contentPerformanceScore >= 0.7 && livePerformanceScore < 0.5) {
          recommendedLiveRatio = 0.3; // 30% live, 70% clip
          allocationReason = isJaLang
            ? 'コンテンツのリーチが良いため、切り抜き広告で長期リーチを獲得しましょう'
            : '内容触达率高，建议用切片广告获取长期触达';
        } else if (livePerformanceScore >= 0.5 && contentPerformanceScore >= 0.5) {
          recommendedLiveRatio = 0.5; // Balanced 50:50
          allocationReason = isJaLang
            ? 'ライブとコンテンツ両方が好調のため、バランス配分が最適です'
            : '直播和内容都表现良好，建议平衡分配';
        } else {
          recommendedLiveRatio = 0.4; // Slightly favor clips for brand building
          allocationReason = isJaLang
            ? 'まずは切り抜き広告で認知度を上げ、ライブへの流入を増やしましょう'
            : '先用切片广告提高知名度，增加直播流量';
        }

        // Helper function to calculate allocation for each scenario
        // If we have learning data, use learned ROAS for more accurate predictions
        const calculateAllocation = (totalBudget: number) => {
          const liveBudget = Math.round(totalBudget * recommendedLiveRatio);
          const clipBudget = totalBudget - liveBudget;
          
          // Use learned CPM if available, otherwise use default
          const effectiveLiveAdCpm = learnedAvgCpm !== null ? learnedAvgCpm * 1.2 : liveAdCpm; // Live ads slightly more expensive
          const effectiveClipAdCpm = learnedAvgCpm !== null ? learnedAvgCpm * 0.8 : clipAdCpm; // Clip ads slightly cheaper
          
          const liveImpressions = (liveBudget / effectiveLiveAdCpm) * 1000;
          const clipImpressions = (clipBudget / effectiveClipAdCpm) * 1000 * clipAdReachMultiplier;
          
          let liveGmv: number;
          let clipGmv: number;
          
          // If we have learned ROAS data, use it for more accurate predictions
          if (hasLearningData && learnedAvgRoas !== null) {
            // Use learned ROAS to calculate projected GMV
            liveGmv = liveBudget * learnedAvgRoas * 1.1; // Live ads typically perform 10% better
            clipGmv = clipBudget * learnedAvgRoas * 0.9; // Clip ads typically perform 10% lower
          } else {
            // Use default calculation based on conversion rate
            liveGmv = liveImpressions * (avgConversionRate / 100) * liveAdConversionBoost;
            clipGmv = clipImpressions * (avgConversionRate / 100) * clipAdConversionBoost;
          }
          
          return {
            liveBudget,
            clipBudget,
            liveRatio: recommendedLiveRatio,
            clipRatio: 1 - recommendedLiveRatio,
            liveImpressions,
            clipImpressions,
            liveProjectedGmv: liveGmv,
            clipProjectedGmv: clipGmv,
            totalImpressions: liveImpressions + clipImpressions,
            totalProjectedGmv: liveGmv + clipGmv,
          };
        };

        // Dynamic scenario budgets based on brand scale
        // Calculate appropriate budget tiers based on GMV and contract amount
        const brandScale = Math.max(totalGmv, contractAmount);
        let smallBudget: number;
        let mediumBudget: number;
        let largeBudget: number;
        
        if (brandScale >= 50000000) {
          // Large brand (GMV ≥50M): ¥500K / ¥1M / ¥2M
          smallBudget = 500000;
          mediumBudget = 1000000;
          largeBudget = 2000000;
        } else if (brandScale >= 20000000) {
          // Medium-large brand (GMV ≥20M): ¥300K / ¥600K / ¥1M
          smallBudget = 300000;
          mediumBudget = 600000;
          largeBudget = 1000000;
        } else if (brandScale >= 10000000) {
          // Medium brand (GMV ≥10M): ¥200K / ¥400K / ¥700K
          smallBudget = 200000;
          mediumBudget = 400000;
          largeBudget = 700000;
        } else if (brandScale >= 5000000) {
          // Small-medium brand (GMV ≥5M): ¥100K / ¥250K / ¥450K
          smallBudget = 100000;
          mediumBudget = 250000;
          largeBudget = 450000;
        } else if (brandScale >= 1000000) {
          // Small brand (GMV ≥1M): ¥50K / ¥150K / ¥300K
          smallBudget = 50000;
          mediumBudget = 150000;
          largeBudget = 300000;
        } else {
          // Starter brand (GMV <1M): ¥30K / ¥80K / ¥150K
          smallBudget = 30000;
          mediumBudget = 80000;
          largeBudget = 150000;
        }

        // Scenario 1: Small ad budget
        const smallAllocation = calculateAllocation(smallBudget);
        const smallAdImpressions = smallAllocation.totalImpressions;
        const smallProjectedGmv = smallAllocation.totalProjectedGmv;
        const smallTotalProjectedGmv = totalGmv + smallProjectedGmv;
        const smallRoas = smallBudget > 0 ? smallProjectedGmv / smallBudget : 0;

        // Scenario 2: Medium ad budget (recommended)
        const mediumAllocation = calculateAllocation(mediumBudget);
        const mediumAdImpressions = mediumAllocation.totalImpressions;
        const mediumProjectedGmv = mediumAllocation.totalProjectedGmv;
        const mediumTotalProjectedGmv = totalGmv + mediumProjectedGmv;
        const mediumRoas = mediumBudget > 0 ? mediumProjectedGmv / mediumBudget : 0;

        // Scenario 3: Large ad budget
        const largeAllocation = calculateAllocation(largeBudget);
        const largeAdImpressions = largeAllocation.totalImpressions;
        const largeProjectedGmv = largeAllocation.totalProjectedGmv;
        const largeTotalProjectedGmv = totalGmv + largeProjectedGmv;
        const largeRoas = largeBudget > 0 ? largeProjectedGmv / largeBudget : 0;

        // Opportunity Cost Calculation
        // If current performance is good, calculate what they're missing without ads
        const potentialReachWithAds = totalImpressions * organicReachMultiplier;
        const missedImpressions = potentialReachWithAds - totalImpressions;
        const missedGmv = missedImpressions * (avgConversionRate / 100);
        const opportunityCost = missedGmv;

        // Performance Score (0-100)
        const performanceScore = Math.min(100, Math.round(
          (currentRoas > 3 ? 30 : currentRoas * 10) +
          (avgGmvPerLive > 500000 ? 30 : (avgGmvPerLive / 500000) * 30) +
          (avgConversionRate > 0.5 ? 20 : avgConversionRate * 40) +
          (totalLivestreams > 10 ? 20 : totalLivestreams * 2)
        ));

        // Urgency Level based on performance
        let urgencyLevel: 'high' | 'medium' | 'low' = 'low';
        let urgencyReason = '';
        if (performanceScore >= 70 && currentRoas >= 2.5) {
          urgencyLevel = 'high';
          urgencyReason = input.language === 'ja' 
            ? 'ライブ成績が非常に良好です。今広告費を投入しないと大きな機会損失になります！'
            : '直播效果非常好！现在不投入广告费将错失巨大机会！';
        } else if (performanceScore >= 50 && currentRoas >= 1.5) {
          urgencyLevel = 'medium';
          urgencyReason = input.language === 'ja'
            ? 'ライブ成績が安定しています。広告費投入でさらなる成長が期待できます。'
            : '直播效果稳定。投入广告费可以带来更多增长。';
        } else {
          urgencyLevel = 'low';
          urgencyReason = input.language === 'ja'
            ? 'まずはライブ成績の改善を優先し、その後広告投入を検討しましょう。'
            : '建议先改善直播效果，然后再考虑广告投入。';
        }

        // Build AI prompt for detailed analysis
        const isJa = input.language === 'ja';
        const prompt = isJa ? `あなたはTikTokライブコマースの広告戦略コンサルタントです。以下のデータを分析し、ブランドに広告費投入を提案する説得力のあるレポートを作成してください。

## 重要な前提
- 現在の「契約金額」はライブ配信契約の固定費であり、広告費ではありません
- 広告費はライブや動画に対して別途投入するものです
- このレポートは「広告費をかけないと損する」「広告費をかけるとこれだけ伸びる」を伝えるものです

## ブランド情報
- ブランド名: ${brand.name} (${brand.nameJa || ''})
- カテゴリー: ${brand.category || '未設定'}

## 現在のライブ成績（広告費なし）
- 総GMV: ¥${totalGmv.toLocaleString()}
- 総インプレッション: ${totalImpressions.toLocaleString()}回
- 平均コンバージョン率: ${avgConversionRate.toFixed(3)}%
- 配信回数: ${totalLivestreams}回
- 平均GMV/配信: ¥${Math.round(avgGmvPerLive).toLocaleString()}
- パフォーマンススコア: ${performanceScore}/100

## 機会損失分析
- 広告をかけないことで逃している推定インプレッション: ${Math.round(missedImpressions).toLocaleString()}回
- 機会損失額（逃している推定GMV）: ¥${Math.round(opportunityCost).toLocaleString()}

## 広告費投入シナリオ

### おすすめ配分: ライブ広告 ${Math.round(recommendedLiveRatio * 100)}% : 切り抜き広告 ${Math.round((1 - recommendedLiveRatio) * 100)}%
理由: ${allocationReason}

### シナリオ1: 小規模投入（¥${smallBudget.toLocaleString()}）
- ライブ広告: ¥${smallAllocation.liveBudget.toLocaleString()} → +${Math.round(smallAllocation.liveImpressions).toLocaleString()}インプレッション → 予測GMV ¥${Math.round(smallAllocation.liveProjectedGmv).toLocaleString()}
- 切り抜き広告: ¥${smallAllocation.clipBudget.toLocaleString()} → +${Math.round(smallAllocation.clipImpressions).toLocaleString()}インプレッション → 予測GMV ¥${Math.round(smallAllocation.clipProjectedGmv).toLocaleString()}
- 合計予測追加GMV: ¥${Math.round(smallProjectedGmv).toLocaleString()}
- 予測ROAS: ${smallRoas.toFixed(2)}倍

### シナリオ2: 中規模投入（¥${mediumBudget.toLocaleString()}）〜おすすめ〜
- ライブ広告: ¥${mediumAllocation.liveBudget.toLocaleString()} → +${Math.round(mediumAllocation.liveImpressions).toLocaleString()}インプレッション → 予測GMV ¥${Math.round(mediumAllocation.liveProjectedGmv).toLocaleString()}
- 切り抜き広告: ¥${mediumAllocation.clipBudget.toLocaleString()} → +${Math.round(mediumAllocation.clipImpressions).toLocaleString()}インプレッション → 予測GMV ¥${Math.round(mediumAllocation.clipProjectedGmv).toLocaleString()}
- 合計予測追加GMV: ¥${Math.round(mediumProjectedGmv).toLocaleString()}
- 予測ROAS: ${mediumRoas.toFixed(2)}倍

### シナリオ3: 大規模投入（¥${largeBudget.toLocaleString()}）
- ライブ広告: ¥${largeAllocation.liveBudget.toLocaleString()} → +${Math.round(largeAllocation.liveImpressions).toLocaleString()}インプレッション → 予測GMV ¥${Math.round(largeAllocation.liveProjectedGmv).toLocaleString()}
- 切り抜き広告: ¥${largeAllocation.clipBudget.toLocaleString()} → +${Math.round(largeAllocation.clipImpressions).toLocaleString()}インプレッション → 予測GMV ¥${Math.round(largeAllocation.clipProjectedGmv).toLocaleString()}
- 合計予測追加GMV: ¥${Math.round(largeProjectedGmv).toLocaleString()}
- 予測ROAS: ${largeRoas.toFixed(2)}倍

## 広告タイプの説明
- ライブ広告（Live Shopping Ads）: ライブ配信中に視聴者を増やし、即時購入を促進。コンバージョン率が高い。
- 切り抜き広告（Spark Ads）: ライブのハイライトを切り抜いて配信後も継続的にリーチ。認知度向上に効果的。

## 学習データ情報
${hasLearningData ? '- 過去の広告実績データ: ' + learningDataRecords + '件\n- 学習済み平均ROAS: ' + (learnedAvgRoas?.toFixed(2) || 'なし') + '倍\n- 学習済み最適ライブ配分: ' + (learnedOptimalLiveRatio ? Math.round(learnedOptimalLiveRatio * 100) + '%' : 'なし') + '\n- 学習済み平均CPM: ¥' + (learnedAvgCpm?.toLocaleString() || 'なし') + '\n- ※この予測は実績データに基づいています（精度が高い）' : '- 学習データ: なし（業界平均値で予測）\n- ※広告実績を記録すると予測精度が向上します'}

## レポート作成指示
1. まず現在のライブ成績がいかに優れているかを強調してください
2. 広告費をかけないことでどれだけ損しているかを具体的な数字で示してください
3. 各シナリオのメリットを説明し、おすすめのシナリオを提案してください
4. 緊急性を伝え、今すぐ広告費を投入すべき理由を説明してください
5. 具体的な広告戦略（ターゲティング、クリエイティブ、タイミング）を提案してください

レポートは説得力があり、ブランドが「広告費をかけたい」と思うような内容にしてください。` 
        : `你是TikTok直播电商的广告策略顾问。请分析以下数据，制作一份有说服力的广告费投入提案报告。

## 重要前提
- 当前的“合同金额”是直播合同的固定费用，不是广告费
- 广告费是针对直播和视频另外投入的
- 这份报告要传达“不投广告会亏损”“投广告能增长这么多”

## 品牌信息
- 品牌名: ${brand.name} (${brand.nameJa || ''})
- 类别: ${brand.category || '未设置'}

## 当前直播成绩（无广告费）
- 总GMV: ¥${totalGmv.toLocaleString()}
- 总印象数: ${totalImpressions.toLocaleString()}次
- 平均转化率: ${avgConversionRate.toFixed(3)}%
- 直播次数: ${totalLivestreams}次
- 平均GMV/直播: ¥${Math.round(avgGmvPerLive).toLocaleString()}
- 表现分数: ${performanceScore}/100

## 机会成本分析
- 不投广告错失的估计印象数: ${Math.round(missedImpressions).toLocaleString()}次
- 机会成本（错失的估计GMV）: ¥${Math.round(opportunityCost).toLocaleString()}

## 广告费投入方案

### 推荐分配: 直播广告 ${Math.round(recommendedLiveRatio * 100)}% : 切片广告 ${Math.round((1 - recommendedLiveRatio) * 100)}%
理由: ${allocationReason}

### 方案一: 小规模投入（¥${smallBudget.toLocaleString()}）
- 直播广告: ¥${smallAllocation.liveBudget.toLocaleString()} → +${Math.round(smallAllocation.liveImpressions).toLocaleString()}印象数 → 预测GMV ¥${Math.round(smallAllocation.liveProjectedGmv).toLocaleString()}
- 切片广告: ¥${smallAllocation.clipBudget.toLocaleString()} → +${Math.round(smallAllocation.clipImpressions).toLocaleString()}印象数 → 预测GMV ¥${Math.round(smallAllocation.clipProjectedGmv).toLocaleString()}
- 合计预测增加GMV: ¥${Math.round(smallProjectedGmv).toLocaleString()}
- 预测ROAS: ${smallRoas.toFixed(2)}倍

### 方案二: 中规模投入（¥${mediumBudget.toLocaleString()}）〜推荐〜
- 直播广告: ¥${mediumAllocation.liveBudget.toLocaleString()} → +${Math.round(mediumAllocation.liveImpressions).toLocaleString()}印象数 → 预测GMV ¥${Math.round(mediumAllocation.liveProjectedGmv).toLocaleString()}
- 切片广告: ¥${mediumAllocation.clipBudget.toLocaleString()} → +${Math.round(mediumAllocation.clipImpressions).toLocaleString()}印象数 → 预测GMV ¥${Math.round(mediumAllocation.clipProjectedGmv).toLocaleString()}
- 合计预测增加GMV: ¥${Math.round(mediumProjectedGmv).toLocaleString()}
- 预测ROAS: ${mediumRoas.toFixed(2)}倍

### 方案三: 大规模投入（¥${largeBudget.toLocaleString()}）
- 直播广告: ¥${largeAllocation.liveBudget.toLocaleString()} → +${Math.round(largeAllocation.liveImpressions).toLocaleString()}印象数 → 预测GMV ¥${Math.round(largeAllocation.liveProjectedGmv).toLocaleString()}
- 切片广告: ¥${largeAllocation.clipBudget.toLocaleString()} → +${Math.round(largeAllocation.clipImpressions).toLocaleString()}印象数 → 预测GMV ¥${Math.round(largeAllocation.clipProjectedGmv).toLocaleString()}
- 合计预测增加GMV: ¥${Math.round(largeProjectedGmv).toLocaleString()}
- 预测ROAS: ${largeRoas.toFixed(2)}倍

## 广告类型说明
- 直播广告（Live Shopping Ads）: 直播期间增加观众，促进即时购买。转化率高。
- 切片广告（Spark Ads）: 将直播精彩片段切出，直播后继续触达。提高知名度效果好。

## 报告制作指示
1. 首先强调当前直播成绩有多优秀
2. 用具体数字说明不投广告会亏损多少
3. 说明各方案的优势，推荐最佳方案
4. 传达紧迫性，说明为什么现在就要投入广告费
5. 提供具体的广告策略（定向、创意、时机）

报告要有说服力，让品牌“想要投入广告费”。`;

        // Call LLM for analysis
        const llmResponse = await invokeLLM({
          messages: [
            { role: 'system', content: isJa 
              ? 'あなたはTikTokライブコマースの広告戦略コンサルタントです。データに基づいて説得力のある広告投入提案を作成してください。Markdown形式で出力してください。'
              : '你是TikTok直播电商的广告策略顾问。请根据数据制作有说服力的广告投入提案。请以Markdown格式输出。'
            },
            { role: 'user', content: prompt }
          ],
        });

        const aiAnalysis = llmResponse.choices[0]?.message?.content || '';

        return {
          brandId: input.brandId,
          brandName: brand.name,
          brandNameJa: brand.nameJa,
          language: input.language,
          // Current Performance
          currentMetrics: {
            totalGmv,
            totalImpressions,
            avgConversionRate,
            totalLivestreams,
            avgGmvPerLive,
            avgImpressionsPerLive,
            contractAmount,
            currentRoas,
            performanceScore,
          },
          // Opportunity Cost
          opportunityCost: {
            missedImpressions,
            missedGmv: opportunityCost,
            potentialReachWithAds,
          },
          // Ad Investment Scenarios
          scenarios: {
            small: {
              budget: smallBudget,
              additionalImpressions: smallAdImpressions,
              projectedGmv: smallProjectedGmv,
              totalProjectedGmv: smallTotalProjectedGmv,
              roas: smallRoas,
              allocation: smallAllocation,
            },
            medium: {
              budget: mediumBudget,
              additionalImpressions: mediumAdImpressions,
              projectedGmv: mediumProjectedGmv,
              totalProjectedGmv: mediumTotalProjectedGmv,
              roas: mediumRoas,
              allocation: mediumAllocation,
            },
            large: {
              budget: largeBudget,
              additionalImpressions: largeAdImpressions,
              projectedGmv: largeProjectedGmv,
              totalProjectedGmv: largeTotalProjectedGmv,
              roas: largeRoas,
              allocation: largeAllocation,
            },
          },
          // Allocation recommendation
          allocationRecommendation: {
            liveRatio: recommendedLiveRatio,
            clipRatio: 1 - recommendedLiveRatio,
            reason: allocationReason,
            isLearningBased,
          },
          // Learning data info
          learningData: {
            hasData: hasLearningData,
            recordCount: learningDataRecords,
            learnedAvgRoas,
            learnedOptimalLiveRatio,
            learnedAvgCpm,
          },
          // Urgency
          urgency: {
            level: urgencyLevel,
            reason: urgencyReason,
          },
          // AI Analysis
          aiAnalysis,
          generatedAt: new Date().toISOString(),
        };
      }),

    // Generate Ad Alert PDF
    generateAdAlertPdf: protectedProcedure
      .input(z.object({
        brandName: z.string(),
        brandNameJa: z.string().optional(),
        language: z.enum(['ja', 'zh']),
        currentMetrics: z.object({
          totalGmv: z.number(),
          totalImpressions: z.number(),
          avgConversionRate: z.number(),
          totalLivestreams: z.number(),
          avgGmvPerLive: z.number(),
          performanceScore: z.number(),
        }),
        opportunityCost: z.object({
          missedImpressions: z.number(),
          missedGmv: z.number(),
        }),
        scenarios: z.object({
          small: z.object({
            budget: z.number(),
            projectedGmv: z.number(),
            roas: z.number(),
            allocation: z.object({
              liveBudget: z.number(),
              clipBudget: z.number(),
            }).optional(),
          }),
          medium: z.object({
            budget: z.number(),
            projectedGmv: z.number(),
            roas: z.number(),
            allocation: z.object({
              liveBudget: z.number(),
              clipBudget: z.number(),
            }).optional(),
          }),
          large: z.object({
            budget: z.number(),
            projectedGmv: z.number(),
            roas: z.number(),
            allocation: z.object({
              liveBudget: z.number(),
              clipBudget: z.number(),
            }).optional(),
          }),
        }),
        allocationRecommendation: z.object({
          liveRatio: z.number(),
          clipRatio: z.number(),
          reason: z.string(),
        }).optional(),
        urgency: z.object({
          level: z.string(),
        }),
        aiAnalysis: z.string(),
      }))
      .mutation(async ({ input }) => {
        const isJa = input.language === 'ja';
        const t = {
          title: isJa ? 'TikTok広告投入提案書' : 'TikTok广告投入提案书',
          subtitle: isJa ? '広告費投入による売上最大化のご提案' : '通过广告投入实现销售最大化的提案',
          currentPerformance: isJa ? '現在のライブ成績' : '当前直播成绩',
          totalGmv: isJa ? '総GMV' : '总GMV',
          totalImpressions: isJa ? '総インプレッション' : '总印象数',
          conversionRate: isJa ? '平均転換率' : '平均转化率',
          livestreamCount: isJa ? '配信回数' : '直播次数',
          avgGmvPerLive: isJa ? '平均GMV/配信' : '平均GMV/直播',
          performanceScore: isJa ? 'パフォーマンススコア' : '表现分数',
          opportunityCost: isJa ? '機会損失（広告をかけないと損する金額）' : '机会成本（不投广告会亏损的金额）',
          missedImpressions: isJa ? '逃している推定インプレッション' : '错失的估计印象数',
          missedGmv: isJa ? '機会損失額（推定GMV）' : '机会成本（估计GMV）',
          adScenarios: isJa ? '広告費投入シナリオ' : '广告费投入方案',
          small: isJa ? '小規模' : '小规模',
          medium: isJa ? '中規模（おすすめ）' : '中规模（推荐）',
          large: isJa ? '大規模' : '大规模',
          budget: isJa ? '予算' : '预算',
          projectedGmv: isJa ? '予測追加GMV' : '预测增加GMV',
          roas: 'ROAS',
          liveAd: isJa ? 'ライブ広告' : '直播广告',
          clipAd: isJa ? '切り抜き広告' : '切片广告',
          allocationRecommendation: isJa ? 'おすすめ広告配分' : '推荐广告分配',
          urgency: isJa ? '緊急度' : '紧迫度',
          high: isJa ? '高' : '高',
          mediumLevel: isJa ? '中' : '中',
          low: isJa ? '低' : '低',
          aiAnalysis: isJa ? 'AI分析レポート' : 'AI分析报告',
          times: isJa ? '倍' : '倍',
          count: isJa ? '回' : '次',
          generatedAt: isJa ? '作成日' : '生成日期',
        };

        const urgencyColor = input.urgency.level === 'high' ? '#ef4444' : input.urgency.level === 'medium' ? '#f59e0b' : '#22c55e';
        const urgencyText = input.urgency.level === 'high' ? t.high : input.urgency.level === 'medium' ? t.mediumLevel : t.low;

        const html = `
<!DOCTYPE html>
<html lang="${input.language}">
<head>
  <meta charset="UTF-8">
  <title>${t.title} - ${input.brandName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans JP', 'Noto Sans SC', sans-serif; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); color: #fff; min-height: 100vh; padding: 40px; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; padding: 30px; background: rgba(0,0,0,0.3); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); }
    .header h1 { font-size: 28px; margin-bottom: 8px; background: linear-gradient(90deg, #f59e0b, #ef4444); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .header .brand-name { font-size: 36px; font-weight: 700; margin-bottom: 8px; }
    .header .subtitle { color: #9ca3af; font-size: 16px; }
    .urgency-badge { display: inline-block; padding: 8px 24px; border-radius: 20px; font-weight: 700; font-size: 14px; margin-top: 16px; background: ${urgencyColor}; }
    .section { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1); }
    .section-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .metric-card { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; text-align: center; }
    .metric-label { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
    .metric-value { font-size: 24px; font-weight: 700; }
    .metric-value.green { color: #22c55e; }
    .metric-value.cyan { color: #06b6d4; }
    .metric-value.amber { color: #f59e0b; }
    .metric-value.red { color: #ef4444; }
    .metric-value.purple { color: #a855f7; }
    .opportunity-cost { background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(249,115,22,0.2)); border: 1px solid rgba(239,68,68,0.3); }
    .opportunity-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .scenarios-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .scenario-card { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 20px; text-align: center; }
    .scenario-card.recommended { background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border: 2px solid rgba(34,197,94,0.5); }
    .scenario-label { font-size: 14px; font-weight: 600; margin-bottom: 8px; padding: 4px 12px; border-radius: 12px; display: inline-block; }
    .scenario-label.small { background: #4b5563; }
    .scenario-label.medium { background: #22c55e; }
    .scenario-label.large { background: #a855f7; }
    .scenario-budget { font-size: 28px; font-weight: 700; margin: 12px 0; }
    .scenario-detail { font-size: 13px; color: #d1d5db; margin: 8px 0; }
    .scenario-roas { font-size: 20px; font-weight: 700; color: #f59e0b; }
    .allocation-box { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px; margin-top: 12px; }
    .allocation-row { display: flex; justify-content: space-between; font-size: 12px; }
    .allocation-live { color: #06b6d4; }
    .allocation-clip { color: #ec4899; }
    .allocation-section { background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(99,102,241,0.2)); border: 1px solid rgba(168,85,247,0.3); }
    .allocation-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
    .allocation-card { background: rgba(0,0,0,0.3); border-radius: 8px; padding: 16px; text-align: center; }
    .allocation-percent { font-size: 36px; font-weight: 700; }
    .allocation-percent.live { color: #06b6d4; }
    .allocation-percent.clip { color: #ec4899; }
    .allocation-reason { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px; font-size: 14px; color: #c4b5fd; }
    .ai-analysis { background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(249,115,22,0.2)); border: 1px solid rgba(245,158,11,0.3); }
    .ai-content { font-size: 14px; line-height: 1.8; color: #e5e7eb; white-space: pre-wrap; }
    .footer { text-align: center; margin-top: 40px; padding: 20px; color: #6b7280; font-size: 12px; }
    @media print { body { background: #1a1a2e; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${t.title}</h1>
      <div class="brand-name">${input.brandName}${input.brandNameJa ? ` (${input.brandNameJa})` : ''}</div>
      <div class="subtitle">${t.subtitle}</div>
      <div class="urgency-badge">${t.urgency}: ${urgencyText}</div>
    </div>

    <div class="section">
      <div class="section-title">📊 ${t.currentPerformance}</div>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">${t.totalGmv}</div>
          <div class="metric-value green">¥${Math.round(input.currentMetrics.totalGmv).toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">${t.totalImpressions}</div>
          <div class="metric-value cyan">${Math.round(input.currentMetrics.totalImpressions).toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">${t.conversionRate}</div>
          <div class="metric-value amber">${input.currentMetrics.avgConversionRate.toFixed(3)}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">${t.livestreamCount}</div>
          <div class="metric-value purple">${input.currentMetrics.totalLivestreams}${t.count}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">${t.avgGmvPerLive}</div>
          <div class="metric-value green">¥${Math.round(input.currentMetrics.avgGmvPerLive).toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">${t.performanceScore}</div>
          <div class="metric-value amber">${input.currentMetrics.performanceScore}/100</div>
        </div>
      </div>
    </div>

    <div class="section opportunity-cost">
      <div class="section-title">💸 ${t.opportunityCost}</div>
      <div class="opportunity-grid">
        <div class="metric-card">
          <div class="metric-label">${t.missedImpressions}</div>
          <div class="metric-value red">${Math.round(input.opportunityCost.missedImpressions).toLocaleString()}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">${t.missedGmv}</div>
          <div class="metric-value red">¥${Math.round(input.opportunityCost.missedGmv).toLocaleString()}</div>
        </div>
      </div>
    </div>

    ${input.allocationRecommendation ? `
    <div class="section allocation-section">
      <div class="section-title">🎯 ${t.allocationRecommendation}</div>
      <div class="allocation-grid">
        <div class="allocation-card">
          <div class="metric-label">📺 ${t.liveAd}</div>
          <div class="allocation-percent live">${Math.round(input.allocationRecommendation.liveRatio * 100)}%</div>
        </div>
        <div class="allocation-card">
          <div class="metric-label">🎬 ${t.clipAd}</div>
          <div class="allocation-percent clip">${Math.round(input.allocationRecommendation.clipRatio * 100)}%</div>
        </div>
      </div>
      <div class="allocation-reason">💡 ${input.allocationRecommendation.reason}</div>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">📈 ${t.adScenarios}</div>
      <div class="scenarios-grid">
        <div class="scenario-card">
          <span class="scenario-label small">${t.small}</span>
          <div class="scenario-budget">¥${input.scenarios.small.budget.toLocaleString()}</div>
          ${input.scenarios.small.allocation ? `
          <div class="allocation-box">
            <div class="allocation-row">
              <span class="allocation-live">📺 ¥${input.scenarios.small.allocation.liveBudget.toLocaleString()}</span>
              <span class="allocation-clip">🎬 ¥${input.scenarios.small.allocation.clipBudget.toLocaleString()}</span>
            </div>
          </div>
          ` : ''}
          <div class="scenario-detail">${t.projectedGmv}: <span style="color:#22c55e">+¥${Math.round(input.scenarios.small.projectedGmv).toLocaleString()}</span></div>
          <div class="scenario-roas">${t.roas}: ${input.scenarios.small.roas.toFixed(2)}${t.times}</div>
        </div>
        <div class="scenario-card recommended">
          <span class="scenario-label medium">${t.medium}</span>
          <div class="scenario-budget">¥${input.scenarios.medium.budget.toLocaleString()}</div>
          ${input.scenarios.medium.allocation ? `
          <div class="allocation-box">
            <div class="allocation-row">
              <span class="allocation-live">📺 ¥${input.scenarios.medium.allocation.liveBudget.toLocaleString()}</span>
              <span class="allocation-clip">🎬 ¥${input.scenarios.medium.allocation.clipBudget.toLocaleString()}</span>
            </div>
          </div>
          ` : ''}
          <div class="scenario-detail">${t.projectedGmv}: <span style="color:#22c55e">+¥${Math.round(input.scenarios.medium.projectedGmv).toLocaleString()}</span></div>
          <div class="scenario-roas">${t.roas}: ${input.scenarios.medium.roas.toFixed(2)}${t.times}</div>
        </div>
        <div class="scenario-card">
          <span class="scenario-label large">${t.large}</span>
          <div class="scenario-budget">¥${input.scenarios.large.budget.toLocaleString()}</div>
          ${input.scenarios.large.allocation ? `
          <div class="allocation-box">
            <div class="allocation-row">
              <span class="allocation-live">📺 ¥${input.scenarios.large.allocation.liveBudget.toLocaleString()}</span>
              <span class="allocation-clip">🎬 ¥${input.scenarios.large.allocation.clipBudget.toLocaleString()}</span>
            </div>
          </div>
          ` : ''}
          <div class="scenario-detail">${t.projectedGmv}: <span style="color:#22c55e">+¥${Math.round(input.scenarios.large.projectedGmv).toLocaleString()}</span></div>
          <div class="scenario-roas">${t.roas}: ${input.scenarios.large.roas.toFixed(2)}${t.times}</div>
        </div>
      </div>
    </div>

    <div class="section ai-analysis">
      <div class="section-title">✨ ${t.aiAnalysis}</div>
      <div class="ai-content">${input.aiAnalysis}</div>
    </div>

    <div class="footer">
      ${t.generatedAt}: ${new Date().toLocaleDateString(input.language === 'ja' ? 'ja-JP' : 'zh-CN')}
    </div>
  </div>
</body>
</html>`;

        return { html };
      }),

    // Save Ad Alert to history
    saveAdAlert: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        aiAnalysis: z.string(),
        currentMetrics: z.object({
          totalGmv: z.number(),
          totalImpressions: z.number(),
          avgConversionRate: z.number(),
          totalLivestreams: z.number(),
          avgGmvPerLive: z.number(),
          performanceScore: z.number(),
        }),
        opportunityCost: z.object({
          missedImpressions: z.number(),
          missedGmv: z.number(),
        }),
        scenarios: z.object({
          small: z.object({ budget: z.number(), projectedGmv: z.number(), roas: z.number() }),
          medium: z.object({ budget: z.number(), projectedGmv: z.number(), roas: z.number() }),
          large: z.object({ budget: z.number(), projectedGmv: z.number(), roas: z.number() }),
        }),
        allocationRecommendation: z.object({
          liveRatio: z.number(),
          clipRatio: z.number(),
          reason: z.string(),
        }).optional(),
        urgency: z.object({
          level: z.enum(['high', 'medium', 'low']),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        // Get the latest version number for this brand
        const existingAlerts = await db
          .select({ version: adAlertHistory.version })
          .from(adAlertHistory)
          .where(eq(adAlertHistory.brandId, input.brandId))
          .orderBy(desc(adAlertHistory.version))
          .limit(1);
        
        const nextVersion = existingAlerts.length > 0 ? existingAlerts[0].version + 1 : 1;
        
        const [result] = await db.insert(adAlertHistory).values({
          brandId: input.brandId,
          version: nextVersion,
          aiAnalysis: input.aiAnalysis,
          totalGmv: input.currentMetrics.totalGmv,
          totalImpressions: input.currentMetrics.totalImpressions,
          avgConversionRate: String(input.currentMetrics.avgConversionRate),
          totalLivestreams: input.currentMetrics.totalLivestreams,
          avgGmvPerLive: input.currentMetrics.avgGmvPerLive,
          performanceScore: input.currentMetrics.performanceScore,
          missedImpressions: input.opportunityCost.missedImpressions,
          missedGmv: input.opportunityCost.missedGmv,
          scenarios: input.scenarios,
          allocationLiveRatio: input.allocationRecommendation ? String(input.allocationRecommendation.liveRatio) : "0.5",
          allocationClipRatio: input.allocationRecommendation ? String(input.allocationRecommendation.clipRatio) : "0.5",
          allocationReason: input.allocationRecommendation?.reason || null,
          urgencyLevel: input.urgency.level,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email,
        });
        
        return { id: result.insertId, version: nextVersion };
      }),

    // Get Ad Alert history for a brand
    getAdAlertHistory: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const alerts = await db
          .select()
          .from(adAlertHistory)
          .where(eq(adAlertHistory.brandId, input.brandId))
          .orderBy(desc(adAlertHistory.version));
        
        return alerts.map((alert: typeof adAlertHistory.$inferSelect) => ({
          id: alert.id,
          version: alert.version,
          aiAnalysis: alert.aiAnalysis,
          currentMetrics: {
            totalGmv: alert.totalGmv || 0,
            totalImpressions: alert.totalImpressions || 0,
            avgConversionRate: parseFloat(alert.avgConversionRate || "0"),
            totalLivestreams: alert.totalLivestreams || 0,
            avgGmvPerLive: alert.avgGmvPerLive || 0,
            performanceScore: alert.performanceScore || 0,
          },
          opportunityCost: {
            missedImpressions: alert.missedImpressions || 0,
            missedGmv: alert.missedGmv || 0,
          },
          scenarios: alert.scenarios as {
            small: { budget: number; projectedGmv: number; roas: number };
            medium: { budget: number; projectedGmv: number; roas: number };
            large: { budget: number; projectedGmv: number; roas: number };
          },
          allocationRecommendation: alert.allocationReason ? {
            liveRatio: parseFloat(alert.allocationLiveRatio || "0.5"),
            clipRatio: parseFloat(alert.allocationClipRatio || "0.5"),
            reason: alert.allocationReason,
          } : undefined,
          urgency: {
            level: alert.urgencyLevel,
          },
          createdBy: alert.createdBy,
          createdByName: alert.createdByName,
          createdAt: alert.createdAt,
        }));
      }),

    // Delete Ad Alert from history
    deleteAdAlert: protectedProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.delete(adAlertHistory).where(eq(adAlertHistory.id, input.alertId));
        return { success: true };
      }),

    // ========== Ad Investment Records (Learning System) ==========
    
    // Create ad investment record
    createAdInvestmentRecord: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        investmentDate: z.string(), // ISO date string
        adType: z.enum(["live", "clip", "mixed"]),
        totalBudget: z.number(),
        liveBudget: z.number().optional(),
        clipBudget: z.number().optional(),
        actualGmv: z.number().optional(),
        actualImpressions: z.number().optional(),
        actualClicks: z.number().optional(),
        actualConversions: z.number().optional(),
        predictedGmv: z.number().optional(),
        predictedRoas: z.number().optional(),
        campaignName: z.string().optional(),
        notes: z.string().optional(),
        livestreamId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Calculate metrics
        const actualRoas = input.actualGmv && input.totalBudget > 0 
          ? input.actualGmv / input.totalBudget 
          : 0;
        const cpm = input.actualImpressions && input.actualImpressions > 0 
          ? (input.totalBudget / input.actualImpressions) * 1000 
          : 0;
        const cpc = input.actualClicks && input.actualClicks > 0 
          ? input.totalBudget / input.actualClicks 
          : 0;
        const conversionRate = input.actualClicks && input.actualClicks > 0 && input.actualConversions 
          ? input.actualConversions / input.actualClicks 
          : 0;
        
        // Calculate prediction accuracy
        let predictionAccuracy = 0;
        if (input.predictedGmv && input.actualGmv) {
          const diff = Math.abs(input.predictedGmv - input.actualGmv);
          const maxVal = Math.max(input.predictedGmv, input.actualGmv);
          predictionAccuracy = maxVal > 0 ? 1 - (diff / maxVal) : 0;
        }
        
        const result = await db.insert(adInvestmentRecords).values({
          brandId: input.brandId,
          investmentDate: new Date(input.investmentDate),
          adType: input.adType,
          totalBudget: input.totalBudget,
          liveBudget: input.liveBudget || 0,
          clipBudget: input.clipBudget || 0,
          actualGmv: input.actualGmv || 0,
          actualImpressions: input.actualImpressions || 0,
          actualClicks: input.actualClicks || 0,
          actualConversions: input.actualConversions || 0,
          actualRoas: String(actualRoas),
          cpm: String(cpm),
          cpc: String(cpc),
          conversionRate: String(conversionRate),
          predictedGmv: input.predictedGmv || 0,
          predictedRoas: String(input.predictedRoas || 0),
          predictionAccuracy: String(predictionAccuracy),
          campaignName: input.campaignName || null,
          notes: input.notes || null,
          livestreamId: input.livestreamId || null,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name || ctx.user.email,
        });
        
        // Update brand performance stats
        await updateBrandAdPerformanceStats(db, input.brandId);
        
        return { success: true, id: (result as any)[0]?.insertId };
      }),
    
    // Get ad investment records for a brand
    getAdInvestmentRecords: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const records = await db
          .select()
          .from(adInvestmentRecords)
          .where(eq(adInvestmentRecords.brandId, input.brandId))
          .orderBy(desc(adInvestmentRecords.investmentDate));
        return records;
      }),
    
    // Update ad investment record (add actual results)
    updateAdInvestmentRecord: protectedProcedure
      .input(z.object({
        id: z.number(),
        actualGmv: z.number().optional(),
        actualImpressions: z.number().optional(),
        actualClicks: z.number().optional(),
        actualConversions: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get current record
        const [record] = await db
          .select()
          .from(adInvestmentRecords)
          .where(eq(adInvestmentRecords.id, input.id));
        
        if (!record) throw new Error('Record not found');
        
        const totalBudget = record.totalBudget || 1;
        const actualGmv = input.actualGmv ?? record.actualGmv ?? 0;
        const actualImpressions = input.actualImpressions ?? record.actualImpressions ?? 0;
        const actualClicks = input.actualClicks ?? record.actualClicks ?? 0;
        const actualConversions = input.actualConversions ?? record.actualConversions ?? 0;
        
        // Recalculate metrics
        const actualRoas = actualGmv / totalBudget;
        const cpm = actualImpressions > 0 ? (totalBudget / actualImpressions) * 1000 : 0;
        const cpc = actualClicks > 0 ? totalBudget / actualClicks : 0;
        const conversionRate = actualClicks > 0 ? actualConversions / actualClicks : 0;
        
        // Recalculate prediction accuracy
        let predictionAccuracy = 0;
        const predictedGmv = record.predictedGmv || 0;
        if (predictedGmv && actualGmv) {
          const diff = Math.abs(predictedGmv - actualGmv);
          const maxVal = Math.max(predictedGmv, actualGmv);
          predictionAccuracy = maxVal > 0 ? 1 - (diff / maxVal) : 0;
        }
        
        await db.update(adInvestmentRecords)
          .set({
            actualGmv,
            actualImpressions,
            actualClicks,
            actualConversions,
            actualRoas: String(actualRoas),
            cpm: String(cpm),
            cpc: String(cpc),
            conversionRate: String(conversionRate),
            predictionAccuracy: String(predictionAccuracy),
            notes: input.notes ?? record.notes,
          })
          .where(eq(adInvestmentRecords.id, input.id));
        
        // Update brand performance stats
        await updateBrandAdPerformanceStats(db, record.brandId);
        
        return { success: true };
      }),
    
    // Delete ad investment record
    deleteAdInvestmentRecord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        
        // Get brand ID before deletion
        const [record] = await db
          .select({ brandId: adInvestmentRecords.brandId })
          .from(adInvestmentRecords)
          .where(eq(adInvestmentRecords.id, input.id));
        
        await db.delete(adInvestmentRecords).where(eq(adInvestmentRecords.id, input.id));
        
        // Update brand performance stats
        if (record) {
          await updateBrandAdPerformanceStats(db, record.brandId);
        }
        
        return { success: true };
      }),
    
    // Get brand ad performance stats (learned data)
    getBrandAdPerformanceStats: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const [stats] = await db
          .select()
          .from(brandAdPerformanceStats)
          .where(eq(brandAdPerformanceStats.brandId, input.brandId));
        return stats || null;
      }),

    // Upload image for brand
    uploadImage: protectedProcedure
      .input(
        z.object({
          base64: z.string(),
          filename: z.string(),
          type: z.enum(["logo", "businessCard", "product"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.filename.split(".").pop() || "png";
        const key = `brands/${ctx.user.id}/${input.type}/${nanoid()}.${ext}`;
        const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        
        const { url } = await storagePut(key, buffer, contentType);
        return { url, key };
      }),

    // LCJ Staff Management for Brands
    getLcjStaff: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getBrandLcjStaff(input.brandId);
      }),

    assignLcjStaff: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        reportStaffId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await assignLcjStaffToBrand(input.brandId, input.reportStaffId);
      }),

    removeLcjStaff: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        reportStaffId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await removeLcjStaffFromBrand(input.brandId, input.reportStaffId);
        return { success: true };
      }),

    setLcjStaff: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        reportStaffIds: z.array(z.number()),
      }))
      .mutation(async ({ input }) => {
        await setBrandLcjStaff(input.brandId, input.reportStaffIds);
        return { success: true };
      }),

    // Get edit logs for a brand
    getEditLogs: protectedProcedure
      .input(z.object({ 
        brandId: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getBrandEditLogs(input.brandId, input.limit || 50);
      }),

    // Get liver sales stats for a brand
    getLiverSalesStats: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getLiverSalesStatsByBrand(input.brandId);
      }),

    // ========== Ad Campaign Management ==========
    
    // Get ad campaigns for a brand
    getAdCampaigns: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getAdCampaignsByBrandId(input.brandId);
      }),

    // Get ad campaign by ID with metrics and country breakdown
    getAdCampaignDetail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const campaign = await getAdCampaignById(input.id);
        if (!campaign) return null;
        
        const metrics = await getAdMetricsByCampaignId(input.id);
        const countryBreakdown = await getAdCountryBreakdownByCampaignId(input.id);
        
        return {
          ...campaign,
          metrics: metrics[0] || null,
          countryBreakdown,
        };
      }),

    // Get ad campaign stats for a brand
    getAdCampaignStats: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getAdCampaignStatsByBrandId(input.brandId);
      }),

    // Create ad campaign (manual or from AI analysis)
    createAdCampaign: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        campaignName: z.string().min(1),
        platform: z.string().default("tiktok"),
        objective: z.enum(["impression", "click", "conversion", "engagement", "other"]).default("impression"),
        objectiveConfidence: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        budget: z.number().optional(),
        adSpend: z.number().optional(),
        status: z.enum(["active", "completed", "paused", "cancelled"]).default("active"),
        reportLanguage: z.enum(["ja", "zh", "en"]).default("ja"),
        reportFileUrl: z.string().optional(),
        reportFileKey: z.string().optional(),
        memo: z.string().optional(),
        // Metrics
        impressions: z.number().optional(),
        views: z.number().optional(),
        views6sPlus: z.number().optional(),
        clicks: z.number().optional(),
        productClicks: z.number().optional(),
        cartAdds: z.number().optional(),
        salesCount: z.number().optional(),
        gmv: z.number().optional(),
        durationMinutes: z.number().optional(),
        // Country breakdown
        countryBreakdown: z.array(z.object({
          countryCode: z.string(),
          countryName: z.string(),
          percentage: z.number(),
          impressions: z.number().optional(),
          clicks: z.number().optional(),
          gmv: z.number().optional(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log('[createAdCampaign] Input received:', JSON.stringify(input, null, 2).slice(0, 500));
        const { countryBreakdown, impressions, views, views6sPlus, clicks, productClicks, cartAdds, salesCount, gmv, adSpend, durationMinutes, ...campaignData } = input;
        
        // Safe date parsing helper - returns current date as fallback since DB requires NOT NULL
        const safeParseDate = (dateStr?: string): Date => {
          if (!dateStr) return new Date();
          try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return new Date();
            return d;
          } catch {
            return new Date();
          }
        };
        
        // Create campaign
        const result = await createAdCampaign({
          brandId: campaignData.brandId,
          campaignName: campaignData.campaignName,
          platform: campaignData.platform,
          objective: campaignData.objective,
          objectiveConfidence: campaignData.objectiveConfidence != null ? String(campaignData.objectiveConfidence) : undefined,
          startDate: safeParseDate(campaignData.startDate),
          endDate: safeParseDate(campaignData.endDate),
          budget: campaignData.budget || 0,
          status: campaignData.status,
          reportLanguage: campaignData.reportLanguage,
          reportFileUrl: campaignData.reportFileUrl,
          reportFileKey: campaignData.reportFileKey,
          memo: campaignData.memo,
          createdBy: ctx.user.id,
        });
        
        console.log('[createAdCampaign] DB result:', JSON.stringify(result));
        const campaignId = result.id;
        if (!campaignId) {
          console.error('[createAdCampaign] No campaignId found in result');
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create campaign' });
        }
        console.log('[createAdCampaign] Campaign created with ID:', campaignId);
        
        // Create metrics if provided (use != null to allow 0 values)
        if (impressions != null || views != null || views6sPlus != null || clicks != null || gmv != null || salesCount != null || cartAdds != null) {
          try {
            await createAdMetrics({
              campaignId,
              impressions: impressions ?? 0,
              views: views ?? 0,
              views6sPlus: views6sPlus ?? 0,
              clicks: clicks ?? 0,
              productClicks: productClicks ?? 0,
              cartAdds: cartAdds ?? 0,
              salesCount: salesCount ?? 0,
              gmv: gmv ?? 0,
              adSpend: adSpend ?? 0,
              durationMinutes: durationMinutes,
              isAiExtracted: true,
            });
          } catch (metricsError) {
            console.error('[createAdCampaign] Failed to create metrics:', metricsError);
          }
        }
        
        // Create country breakdown if provided
        if (countryBreakdown && countryBreakdown.length > 0) {
          try {
            for (const country of countryBreakdown) {
              await createAdCountryBreakdown({
                campaignId,
                countryCode: country.countryCode,
                percentage: country.percentage != null ? String(country.percentage) : undefined,
                impressions: country.impressions ?? 0,
                clicks: country.clicks ?? 0,
                gmv: country.gmv ?? 0,
              });
            }
          } catch (countryError) {
            console.error('[createAdCampaign] Failed to create country breakdown:', countryError);
          }
        }
        
        return { id: campaignId };
      }),

    // Update ad campaign
    updateAdCampaign: protectedProcedure
      .input(z.object({
        id: z.number(),
        campaignName: z.string().optional(),
        platform: z.string().optional(),
        objective: z.enum(["impression", "click", "conversion", "engagement", "other"]).optional(),
        objectiveConfidence: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        budget: z.number().optional(),
        status: z.enum(["active", "completed", "paused", "cancelled"]).optional(),
        memo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, startDate, endDate, objectiveConfidence, ...updateData } = input;
        await updateAdCampaign(id, {
          ...updateData,
          objectiveConfidence: objectiveConfidence != null ? String(objectiveConfidence) : undefined,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        });
        return { success: true };
      }),

    // Delete ad campaign
    deleteAdCampaign: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAdCampaign(input.id);
        return { success: true };
      }),

    // Analyze ad report file with AI
    analyzeAdReport: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        fileUrl: z.string(),
        fileKey: z.string().optional(),
        fileName: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log('[analyzeAdReport] Starting analysis for file:', input.fileName, 'URL:', input.fileUrl);
        try {
          // Use LLM to analyze the PDF/file content
          // Determine mime type from file extension
          const fileExtension = input.fileName.split('.').pop()?.toLowerCase() || 'pdf';
          const mimeTypeMap: Record<string, string> = {
            'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'csv': 'text/csv',
          };
          const fileMimeType = mimeTypeMap[fileExtension] || 'application/pdf';
          
          const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert at analyzing advertising performance reports from platforms like TikTok, Facebook, Google, etc.

Your task is to extract ALL numerical data from the report as accurately as possible.

CRITICAL RULES:
1. Extract EXACT numbers from the report. Do NOT return 0 for metrics that have values in the report.
2. For each metric you extract, also include the original text/label from the report in "sourceTexts" so the user can verify.
3. Common metric labels in Japanese reports:
   - 動画露出回数 / インプレッション / 表示回数 → impressions
   - 動画再生数 / 視聴数 / 再生回数 → views  
   - 集中視聴数(6秒以上) / 6秒視聴 → views6s
   - クリック数 / リンククリック → clicks
   - 単回露出コスト / CPM / CPC → costPerUnit
   - コンバージョン / CV / 購入数 → conversions
   - GMV / 売上 / 売上金額 → gmv
   - 注文数 / オーダー数 → orderCount
   - カート追加 / カートに追加 → cartAdds
   - 広告費 / 予算 / 消化金額 / 費用 → budget/actualSpend
4. Common metric labels in Chinese reports:
   - 曝光次数 / 展示次数 → impressions
   - 视频播放数 → views
   - 6秒播放数 → views6s
   - 点击数 → clicks
   - 单次曝光成本 → costPerUnit
5. If a metric is not found in the report, set it to 0.
6. For costPerUnit: extract the cost per single impression/click/view (e.g., 0.033円 means costPerUnit = 0.033)

Respond with a JSON object.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this advertising report file and extract ALL metrics with their exact values: ${input.fileName}`,
                },
                {
                  type: "file_url",
                  file_url: {
                    url: input.fileUrl,
                    mime_type: fileMimeType as any,
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "ad_report_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  campaignName: { type: "string", description: "Campaign name extracted from the report" },
                  platform: { type: "string", enum: ["tiktok", "facebook", "instagram", "google", "youtube", "other"] },
                  objective: { type: "string", enum: ["impressions", "clicks", "conversions", "awareness", "engagement"] },
                  objectiveConfidence: { type: "integer" },
                  detectedLanguage: { type: "string", enum: ["ja", "zh", "en"] },
                  startDate: { type: ["string", "null"] },
                  endDate: { type: ["string", "null"] },
                  budget: { type: ["number", "null"], description: "Total budget or ad spend amount" },
                  actualSpend: { type: ["number", "null"], description: "Actual amount spent" },
                  costPerUnit: { type: ["number", "null"], description: "Cost per single impression/click/view (e.g. 0.033)" },
                  metrics: {
                    type: "object",
                    properties: {
                      impressions: { type: "integer", description: "Total impressions/views/exposure count (動画露出回数/曝光次数)" },
                      views: { type: "integer", description: "Total video views/play count (動画再生数/视频播放数)" },
                      views6s: { type: "integer", description: "6-second views (集中視聴数6秒以上/6秒播放数)" },
                      clicks: { type: "integer", description: "Total clicks (クリック数/点击数)" },
                      conversions: { type: "integer", description: "Conversions (コンバージョン/转化)" },
                      gmv: { type: "integer", description: "GMV/Sales amount (売上/GMV)" },
                      orderCount: { type: "integer", description: "Order count (注文数/订单数)" },
                      cartAdds: { type: "integer", description: "Cart additions (カート追加/加购)" },
                    },
                    required: ["impressions", "views", "views6s", "clicks", "conversions", "gmv", "orderCount", "cartAdds"],
                    additionalProperties: false,
                  },
                  sourceTexts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string", description: "Original label text from the report (e.g. 動画露出回数)" },
                        value: { type: "string", description: "Original value text from the report (e.g. 1,044,662回)" },
                        mappedTo: { type: "string", description: "Which field this maps to (e.g. impressions, views6s, budget, costPerUnit)" },
                      },
                      required: ["label", "value", "mappedTo"],
                      additionalProperties: false,
                    },
                    description: "Array of original text labels and values extracted from the report for user verification",
                  },
                  countryBreakdown: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        countryCode: { type: "string" },
                        countryName: { type: "string" },
                        percentage: { type: "number" },
                      },
                      required: ["countryCode", "countryName", "percentage"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["campaignName", "platform", "objective", "objectiveConfidence", "detectedLanguage", "startDate", "endDate", "budget", "actualSpend", "costPerUnit", "metrics", "sourceTexts", "countryBreakdown"],
                additionalProperties: false,
              },
            },
          },
        });
        
        console.log('[analyzeAdReport] LLM response received');
        const content = response.choices[0]?.message?.content;
        console.log('[analyzeAdReport] Content type:', typeof content, 'Content preview:', content ? String(content).substring(0, 200) : 'null');
        
        if (!content || typeof content !== 'string') {
          console.error('[analyzeAdReport] Invalid content type or empty content');
          throw new Error("Failed to analyze report - invalid response");
        }
        
        let analysis;
        try {
          analysis = JSON.parse(content);
        } catch (parseError) {
          console.error('[analyzeAdReport] JSON parse error:', parseError, 'Content:', content.substring(0, 500));
          throw new Error("Failed to parse analysis result");
        }
        
        console.log('[analyzeAdReport] Analysis successful:', analysis.campaignName);
        
        // ファイル履歴をデータベースに保存
        try {
          const fileExt = input.fileName.split('.').pop()?.toLowerCase() || 'pdf';
          await createAdReportFile({
            brandId: input.brandId,
            fileName: input.fileName,
            fileUrl: input.fileUrl,
            fileKey: input.fileKey || '',
            fileType: fileExt,
            analysisStatus: 'completed',
            analysisResult: analysis as Record<string, unknown>,
            detectedLanguage: analysis.detectedLanguage,
            uploadedBy: ctx.user.id,
            uploadedByName: ctx.user.name || ctx.user.email || 'Unknown',
          });
          console.log('[analyzeAdReport] File history saved to database');
        } catch (saveError) {
          console.error('[analyzeAdReport] Failed to save file history:', saveError);
          // 履歴保存が失敗しても分析結果は返す
        }
        
        // Map the analysis result to the expected frontend format
        return {
          campaignName: analysis.campaignName || '',
          platform: analysis.platform || 'tiktok',
          objective: analysis.objective || 'impressions',
          objectiveConfidence: analysis.objectiveConfidence || 0,
          detectedLanguage: analysis.detectedLanguage || 'ja',
          startDate: analysis.startDate,
          endDate: analysis.endDate,
          budget: analysis.budget || analysis.actualSpend || 0,
          actualSpend: analysis.actualSpend || analysis.budget || 0,
          costPerUnit: analysis.costPerUnit || 0,
          impressions: analysis.metrics?.impressions || 0,
          views: analysis.metrics?.views || 0,
          views6s: analysis.metrics?.views6s || 0,
          clicks: analysis.metrics?.clicks || 0,
          conversions: analysis.metrics?.conversions || 0,
          gmv: analysis.metrics?.gmv || 0,
          orderCount: analysis.metrics?.orderCount || 0,
          cartAdds: analysis.metrics?.cartAdds || 0,
          countryBreakdown: analysis.countryBreakdown || [],
          sourceTexts: analysis.sourceTexts || [],
          sourceFileUrl: input.fileUrl,
          sourceFileKey: input.fileKey,
          brandId: input.brandId,
        };
        } catch (error) {
          console.error('[analyzeAdReport] Error:', error);
          throw error;
        }
      }),

    // 広告レポートファイル履歴を取得
    getReportFileHistory: protectedProcedure
      .input(z.object({ brandId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getAdReportFilesByBrandId(input.brandId, input.limit || 50);
      }),

    // 広告レポートファイルを削除
    deleteReportFile: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAdReportFile(input.id);
        return { success: true };
      }),

    // ブランド別配信スケジュール取得
    getSchedules: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          liverId: z.number().optional(),
          liverName: z.string().optional(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const options: any = { limit: input.limit };
        if (input.startDate) options.startDate = new Date(input.startDate);
        if (input.endDate) options.endDate = new Date(input.endDate);
        if (input.liverId) options.liverId = input.liverId;
        if (input.liverName) options.liverName = input.liverName;
        return await getSchedulesByBrandId(input.brandId, options);
      }),

    // ブランドのスケジュールに関連するライバー一覧
    getScheduleLivers: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getDistinctLiversForBrandSchedules(input.brandId);
      }),
  }),

  // Brand Products Router
  brandProduct: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          productName: z.string().min(1),
          listPrice: z.number().optional(),
          specialPrice: z.number().optional(),
          discountRate: z.string().optional(),
          sampleProduct: z.string().optional(),
          productCode: z.string().optional(),
          influencer: z.string().optional(),
          purchasePrice: z.number().optional(),
          remarks: z.string().optional(),
          imageUrls: z.array(z.string()).max(2).optional(), // 最大2枚の商品画像
          imageKeys: z.array(z.string()).max(2).optional(),
          proposalImageUrl: z.string().optional(), // 提案書画像URL
          proposalImageKey: z.string().optional(), // 提案書画像S3 key
          commissionRate: z.string().optional(), // 成果報酬
          // AI抽出情報フィールド
          releaseDate: z.string().optional(),
          catchCopy: z.string().optional(),
          features: z.string().optional(),
          productDetails: z.string().optional(),
          accessories: z.string().optional(),
          shippingInfo: z.string().optional(),
          targetAudience: z.string().optional(),
          usageMethod: z.string().optional(),
          liverIds: z.array(z.number()).optional(), // 担当ライバーIDの配列
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { liverIds, ...productData } = input;
        const product = await createBrandProduct(productData);
        
        // ライバーを紐付け
        if (liverIds && liverIds.length > 0) {
          await bulkAddProductLivers(product.id, liverIds, ctx.user.id);
        }
        
        // Record edit log
        await logBrandEdit(
          input.brandId,
          "create",
          "product",
          product.id,
          input.productName,
          `商品を追加：${input.productName}`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );
        
        return product;
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getProductsByBrandIdWithGmv(input.brandId);
      }),

    listAll: protectedProcedure
      .query(async () => {
        return await getAllProducts();
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          productName: z.string().optional(),
          listPrice: z.number().optional(),
          specialPrice: z.number().optional(),
          discountRate: z.string().optional(),
          sampleProduct: z.string().optional(),
          productCode: z.string().optional(),
          influencer: z.string().optional(),
          purchasePrice: z.number().optional(),
          remarks: z.string().optional(),
          imageUrls: z.array(z.string()).max(2).optional(), // 最大2枚の商品画像
          imageKeys: z.array(z.string()).max(2).optional(),
          // AI抽出情報フィールド
          commissionRate: z.string().optional(),
          releaseDate: z.string().optional(),
          catchCopy: z.string().optional(),
          features: z.string().optional(),
          productDetails: z.string().optional(),
          accessories: z.string().optional(),
          shippingInfo: z.string().optional(),
          targetAudience: z.string().optional(),
          usageMethod: z.string().optional(),
          createdAt: z.string().optional(), // 登録日の編集用
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[brandProduct.update] Input received:", JSON.stringify(input, null, 2));
          const { id, createdAt, ...updateData } = input;
          
          // Get existing product for logging
          const existingProduct = await getBrandProductById(id);
          
          // createdAtが指定されている場合は変換して追加
          const finalUpdateData = createdAt 
            ? { ...updateData, createdAt: new Date(createdAt) }
            : updateData;
          console.log("[brandProduct.update] Final update data:", JSON.stringify(finalUpdateData, null, 2));
          await updateBrandProduct(id, finalUpdateData);
          console.log("[brandProduct.update] Success for id:", id);
          
          // Record edit log with detailed changes
          if (existingProduct) {
            // Build detailed change description
            const changes: string[] = [];
            if (updateData.productName && updateData.productName !== existingProduct.productName) {
              changes.push(`商品名: ${existingProduct.productName} → ${updateData.productName}`);
            }
            if (updateData.listPrice !== undefined && updateData.listPrice !== existingProduct.listPrice) {
              changes.push(`定価: ¥${existingProduct.listPrice?.toLocaleString() || 0} → ¥${updateData.listPrice.toLocaleString()}`);
            }
            if (updateData.specialPrice !== undefined && updateData.specialPrice !== existingProduct.specialPrice) {
              changes.push(`特別価格: ¥${existingProduct.specialPrice?.toLocaleString() || 0} → ¥${updateData.specialPrice.toLocaleString()}`);
            }
            if (updateData.commissionRate !== undefined && updateData.commissionRate !== existingProduct.commissionRate) {
              changes.push(`成果報酬: ${existingProduct.commissionRate || '-'}% → ${updateData.commissionRate}%`);
            }
            if (updateData.discountRate !== undefined && updateData.discountRate !== existingProduct.discountRate) {
              changes.push(`仕切率: ${existingProduct.discountRate || '-'} → ${updateData.discountRate}`);
            }
            if (updateData.purchasePrice !== undefined && updateData.purchasePrice !== existingProduct.purchasePrice) {
              changes.push(`仕入金額: ¥${existingProduct.purchasePrice?.toLocaleString() || 0} → ¥${updateData.purchasePrice.toLocaleString()}`);
            }
            if (updateData.remarks !== undefined && updateData.remarks !== existingProduct.remarks) {
              changes.push(`備考を更新`);
            }
            
            const changeDescription = changes.length > 0 
              ? `商品を編集：${existingProduct.productName}\n${changes.join('\n')}`
              : `商品を編集：${existingProduct.productName}`;
            
            await logBrandEdit(
              existingProduct.brandId,
              "update",
              "product",
              id,
              existingProduct.productName,
              changeDescription,
              ctx.user.id,
              ctx.user.name || ctx.user.email,
              JSON.stringify(existingProduct),
              JSON.stringify({ ...existingProduct, ...finalUpdateData })
            );
          }
          
          return { success: true };
        } catch (error) {
          console.error("[brandProduct.update] Error:", error);
          throw error;
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get existing product for logging
        const existingProduct = await getBrandProductById(input.id);
        
        await deleteBrandProduct(input.id);
        
        // Record edit log
        if (existingProduct) {
          await logBrandEdit(
            existingProduct.brandId,
            "delete",
            "product",
            input.id,
            existingProduct.productName,
            `商品を削除：${existingProduct.productName}`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }
        
        return { success: true };
      }),

    // AI画像解析による商品情報抽出
    extractFromImage: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string(), // S3にアップロードされた提案書画像のURL
        })
      )
      .mutation(async ({ input }) => {
        const systemPrompt = `あなたは商品提案書から情報を抽出する専門家です。
提案書画像から以下の情報をできるだけ詳細に抽出してください。日本語・中国語のテキストを正確に読み取ってください。

抽出する情報：
- productName: 商品名（必須、ブランド名も含む）
- listPrice: 公式価格・定価（数値のみ、円記号なし）
- specialPrice: ライブ価格・特別価格（数値のみ、円記号なし）
- discountRate: 割引率（例: "20%"）
- releaseDate: 発売日（YYYY年MM月形式でも可）
- stock: 在庫数（数値のみ）
- productCode: 商品ID・コード品番
- catchCopy: キャッチコピー・商品の特徴を表すフレーズ
- features: 商品の特徴・セールスポイント（箇条書きで複数あれば改行区切り）
- productDetails: 商品詳細（内容量、容量、カプセル数、生産ロット、使用期限など）
- accessories: 付属品・セット内容
- shippingInfo: 配送情報（配送方法、配送期間、送料など）
- commissionRate: 成果報酬・手数料率（例: "15%"）
- targetAudience: ターゲット層・対象者
- usageMethod: 使用方法・使い方
- remarks: その他の備考・注意事項

画像内のすべてのテキストを注意深く読み取り、該当するフィールドに割り当ててください。
画像から読み取れない情報は空文字列としてください。`;

        try {
          console.log("[AI Product Extract] Starting extraction for image:", input.imageUrl);
          
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "この提案書画像から商品情報を抽出してください。",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: input.imageUrl,
                      detail: "high",
                    },
                  },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "product_info",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    productName: { type: "string", description: "商品名（不明な場合は空文字列）" },
                    listPrice: { type: "number", description: "公式価格・定価（不明な場合は0）" },
                    specialPrice: { type: "number", description: "ライブ価格・特別価格（不明な場合は0）" },
                    discountRate: { type: "string", description: "割引率（不明な場合は空文字列）" },
                    releaseDate: { type: "string", description: "発売日（不明な場合は空文字列）" },
                    stock: { type: "number", description: "在庫数（不明な場合は0）" },
                    productCode: { type: "string", description: "商品ID・コード品番（不明な場合は空文字列）" },
                    catchCopy: { type: "string", description: "キャッチコピー・特徴（不明な場合は空文字列）" },
                    features: { type: "string", description: "商品の特徴・セールスポイント（不明な場合は空文字列）" },
                    productDetails: { type: "string", description: "商品詳細（不明な場合は空文字列）" },
                    accessories: { type: "string", description: "付属品・セット内容（不明な場合は空文字列）" },
                    shippingInfo: { type: "string", description: "配送情報（不明な場合は空文字列）" },
                    commissionRate: { type: "string", description: "成果報酬・手数料率（不明な場合は空文字列）" },
                    targetAudience: { type: "string", description: "ターゲット層・対象者（不明な場合は空文字列）" },
                    usageMethod: { type: "string", description: "使用方法・使い方（不明な場合は空文字列）" },
                    remarks: { type: "string", description: "その他の備考（不明な場合は空文字列）" },
                  },
                  required: [
                    "productName",
                    "listPrice",
                    "specialPrice",
                    "discountRate",
                    "releaseDate",
                    "stock",
                    "productCode",
                    "catchCopy",
                    "features",
                    "productDetails",
                    "accessories",
                    "shippingInfo",
                    "commissionRate",
                    "targetAudience",
                    "usageMethod",
                    "remarks",
                  ],
                  additionalProperties: false,
                },
              },
            },
          });

          console.log("[AI Product Extract] LLM response received");

          const content = response.choices[0]?.message?.content;
          if (!content || typeof content !== "string") {
            console.error("[AI Product Extract] No content in response:", response);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "AI解析に失敗しました（レスポンスが空）",
            });
          }

          console.log("[AI Product Extract] Parsing content:", content.substring(0, 200));
          const extractedData = JSON.parse(content);
          console.log("[AI Product Extract] Extraction successful:", extractedData.productName);
          
          return {
            success: true,
            data: extractedData,
          };
        } catch (e: any) {
          console.error("[AI Product Extract] Error:", e.message || e);
          if (e instanceof TRPCError) {
            throw e;
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `AI解析に失敗しました: ${e.message || "不明なエラー"}`,
          });
        }
      }),

    // Product Images APIs
    getImages: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await getProductImages(input.productId);
      }),

    addImage: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          imageUrl: z.string(),
          imageKey: z.string(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await addProductImage({
          productId: input.productId,
          imageUrl: input.imageUrl,
          imageKey: input.imageKey,
          sortOrder: input.sortOrder,
          createdBy: ctx.user.id,
        });
      }),

    deleteImage: protectedProcedure
      .input(z.object({ imageId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteProductImage(input.imageId);
      }),

    reorderImages: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          imageIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input }) => {
        return await reorderProductImages(input.productId, input.imageIds);
      }),

    // Product-Liver relationships
    getLivers: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await getLiversByProductId(input.productId);
      }),

    addLiver: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          liverId: z.number(),
          specialSetName: z.string().optional(),
          specialPrice: z.number().optional(),
          commissionRate: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await addProductLiver({
          productId: input.productId,
          liverId: input.liverId,
          specialSetName: input.specialSetName,
          specialPrice: input.specialPrice,
          commissionRate: input.commissionRate,
          createdBy: ctx.user.id,
        });
        return { success: true };
      }),

    removeLiver: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          liverId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await removeProductLiver(input.productId, input.liverId);
        return { success: true };
      }),

    updateLivers: protectedProcedure
      .input(
        z.object({
          productId: z.number(),
          liverIds: z.array(z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await updateProductLivers(input.productId, input.liverIds, ctx.user.id);
        return { success: true };
      }),
  }),

  // Brand Activities Router
  brandActivity: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          activityDate: z.string(),
          activityType: z.enum(["進行中", "打ち合わせ", "完了"]).default("進行中"),
          contactPerson: z.string().optional(),
          nextAction: z.string().optional(),
          content: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const activity = await createBrandActivity({
          ...input,
          activityDate: new Date(input.activityDate),
          createdBy: ctx.user.id,
        });
        
        // Get brand name for activity log
        const brand = await getBrandById(input.brandId);
        
        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "brand_activity_create",
          actionLabel: "対応履歴を追加",
          targetId: input.brandId,
          targetName: brand?.name || `ブランド #${input.brandId}`,
        });
        
        return activity;
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getActivitiesByBrandId(input.brandId);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          activityDate: z.string().optional(),
          activityType: z.enum(["進行中", "打ち合わせ", "完了"]).optional(),
          contactPerson: z.string().optional(),
          nextAction: z.string().optional(),
          content: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, activityDate, ...rest } = input;
        const updateData: any = { ...rest };
        if (activityDate) {
          updateData.activityDate = new Date(activityDate);
        }
        await updateBrandActivity(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandActivity(input.id);
        return { success: true };
      }),
  }),

  // Brand Livestream Router (直播履歴)
  brandLivestream: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          livestreamDate: z.string(),
          streamerName: z.string().optional(), // 後方互換：手入力も許容
          liverId: z.number().optional(), // ライバードロップダウンから選択
          salesAmount: z.number().optional(),
          duration: z.number().optional(),
          viewerCount: z.number().optional(),
          orderCount: z.number().optional(),
          platform: z.string().optional(),
          remarks: z.string().optional(),
          // 追加メトリクスフィールド
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          salesCount: z.number().optional(),
          gmv: z.number().optional(),
          cartAddCount: z.number().optional(),
          // 商品紐付けフィールド
          productId: z.number().optional(),
          productCommission: z.string().optional(),
          adCost: z.number().optional(),
          ctr: z.string().optional(),
          cvr: z.string().optional(),
          cpc: z.number().optional(),
          acos: z.string().optional(),
          roas: z.string().optional(),
          livestreamStartTime: z.string().optional(), // ライブ開始時間 (e.g., "14:30")
          streamAccountLiverId: z.number().nullable().optional(), // 配信アカウント（間借り配信）
        })
      )
      .mutation(async ({ ctx, input }) => {
        // liverId が指定された場合、ライバーマスターから名前を自動取得
        let resolvedStreamerName = input.streamerName || '';
        let resolvedLiverId = input.liverId;
        if (input.liverId) {
          const liver = await getLiverById(input.liverId);
          if (liver) {
            resolvedStreamerName = liver.tiktokAccount || liver.name;
          }
        }
        
        if (!resolvedStreamerName) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'ライバーを選択するか、アカウント名を入力してください' });
        }
        
        const livestream = await createBrandLivestream({
          ...input,
          streamerName: resolvedStreamerName,
          liverId: resolvedLiverId || null,
          livestreamDate: new Date(input.livestreamDate),
          createdBy: ctx.user.id,
          streamAccountLiverId: input.streamAccountLiverId ?? null,
        });
        
        // Record edit log with full data for recovery
        const dateStr = new Date(input.livestreamDate).toLocaleDateString('ja-JP');
        await logBrandEdit(
          input.brandId,
          "create",
          "livestream",
          livestream.id,
          `${dateStr} ${resolvedStreamerName}`,
          `ライブ配信を追加：${dateStr} ${resolvedStreamerName}`,
          ctx.user.id,
          ctx.user.name || ctx.user.email,
          undefined,
          JSON.stringify(livestream)
        );
        
        return livestream;
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamsByBrandId(input.brandId);
      }),

    listAll: protectedProcedure
      .query(async () => {
        return await getAllLivestreams();
      }),

    stats: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamStatsByBrandId(input.brandId);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          livestreamDate: z.string().optional(),
          streamerName: z.string().optional(),
          liverId: z.number().nullable().optional(), // ライバードロップダウンから選択
          salesAmount: z.number().optional(),
          duration: z.number().optional(),
          viewerCount: z.number().optional(),
          orderCount: z.number().optional(),
          platform: z.string().optional(),
          remarks: z.string().optional(),
          // 追加メトリクスフィールド
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          salesCount: z.number().optional(),
          gmv: z.number().optional(),
          cartAddCount: z.number().optional(),
          // 商品紐付けフィールド
          productId: z.number().nullable().optional(),
          productCommission: z.string().optional(),
          adCost: z.number().optional(),
          ctr: z.string().optional(),
          cvr: z.string().optional(),
          cpc: z.number().optional(),
          acos: z.string().optional(),
          roas: z.string().optional(),
          livestreamStartTime: z.string().optional(), // ライブ開始時間 (e.g., "14:30")
          streamAccountLiverId: z.number().nullable().optional(), // 配信アカウント（間借り配信）
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, livestreamDate, liverId, ...rest } = input;
        
        // Get existing livestream for logging
        const existingLivestream = await getLivestreamById(id);
        
        // liverId が指定された場合、ライバーマスターから名前を自動取得
        const updateData: any = { ...rest };
        if (liverId !== undefined) {
          updateData.liverId = liverId;
          if (liverId) {
            const liver = await getLiverById(liverId);
            if (liver) {
              updateData.streamerName = liver.tiktokAccount || liver.name;
            }
          }
        }
        if (livestreamDate) {
          updateData.livestreamDate = new Date(livestreamDate);
        }
        await updateBrandLivestream(id, updateData);
        
        // Record edit log with detailed changes
        if (existingLivestream) {
          const dateStr = existingLivestream.livestreamDate 
            ? new Date(existingLivestream.livestreamDate).toLocaleDateString('ja-JP')
            : '不明';
          
          // Build detailed change description
          const changes: string[] = [];
          if (rest.streamerName && rest.streamerName !== existingLivestream.streamerName) {
            changes.push(`アカウント: ${existingLivestream.streamerName} → ${rest.streamerName}`);
          }
          if (rest.gmv !== undefined && rest.gmv !== existingLivestream.gmv) {
            changes.push(`GMV: ¥${existingLivestream.gmv?.toLocaleString() || 0} → ¥${rest.gmv.toLocaleString()}`);
          }
          if (rest.impressions !== undefined && rest.impressions !== existingLivestream.impressions) {
            changes.push(`曝光: ${existingLivestream.impressions?.toLocaleString() || 0} → ${rest.impressions.toLocaleString()}`);
          }
          if (rest.salesCount !== undefined && rest.salesCount !== existingLivestream.salesCount) {
            changes.push(`販売件数: ${existingLivestream.salesCount?.toLocaleString() || 0} → ${rest.salesCount.toLocaleString()}`);
          }
          if (rest.productClicks !== undefined && rest.productClicks !== existingLivestream.productClicks) {
            changes.push(`商品クリック: ${existingLivestream.productClicks?.toLocaleString() || 0} → ${rest.productClicks.toLocaleString()}`);
          }
          if (rest.cartAddCount !== undefined && rest.cartAddCount !== existingLivestream.cartAddCount) {
            changes.push(`カート追加: ${existingLivestream.cartAddCount?.toLocaleString() || 0} → ${rest.cartAddCount.toLocaleString()}`);
          }
          if (rest.duration !== undefined && rest.duration !== existingLivestream.duration) {
            changes.push(`時間: ${existingLivestream.duration || 0}分 → ${rest.duration}分`);
          }
          if (rest.platform && rest.platform !== existingLivestream.platform) {
            changes.push(`プラットフォーム: ${existingLivestream.platform || '-'} → ${rest.platform}`);
          }
          if (rest.productCommission !== undefined && rest.productCommission !== existingLivestream.productCommission) {
            changes.push(`手数料: ${existingLivestream.productCommission || '-'}% → ${rest.productCommission}%`);
          }
          
          const changeDescription = changes.length > 0 
            ? `ライブ配信を編集：${dateStr} ${existingLivestream.streamerName}\n${changes.join('\n')}`
            : `ライブ配信を編集：${dateStr} ${existingLivestream.streamerName}`;
          
          await logBrandEdit(
            existingLivestream.brandId,
            "update",
            "livestream",
            id,
            `${dateStr} ${existingLivestream.streamerName}`,
            changeDescription,
            ctx.user.id,
            ctx.user.name || ctx.user.email,
            JSON.stringify(existingLivestream),
            JSON.stringify({ ...existingLivestream, ...updateData })
          );
        }
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get existing livestream for logging
        const existingLivestream = await getLivestreamById(input.id);
        
        // 商品別GMVも削除
        await deleteLivestreamProductsByLivestreamId(input.id);
        await deleteBrandLivestream(input.id);
        
        // Record edit log
        if (existingLivestream) {
          const dateStr = existingLivestream.livestreamDate 
            ? new Date(existingLivestream.livestreamDate).toLocaleDateString('ja-JP')
            : '不明';
          await logBrandEdit(
            existingLivestream.brandId,
            "delete",
            "livestream",
            input.id,
            `${dateStr} ${existingLivestream.streamerName}`,
            `ライブ配信を削除：${dateStr} ${existingLivestream.streamerName}`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }
        
        return { success: true };
      }),

    // 商品別GMV操作
    addProduct: protectedProcedure
      .input(
        z.object({
          livestreamId: z.number(),
          productName: z.string().min(1),
          gmv: z.number().optional(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          cartAddCount: z.number().optional(),
          conversionRate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await createLivestreamProduct(input);
      }),

    listProducts: publicProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamProductsByLivestreamId(input.livestreamId);
      }),

    updateProduct: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          productName: z.string().optional(),
          gmv: z.number().optional(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
          productClicks: z.number().optional(),
          impressions: z.number().optional(),
          cartAddCount: z.number().optional(),
          conversionRate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateLivestreamProduct(id, data);
        return { success: true };
      }),

    deleteProduct: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteLivestreamProduct(input.id);
        return { success: true };
      }),

    getProductsTotalGmv: protectedProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamProductsTotalGmv(input.livestreamId);
      }),

    // 月別GMV集計を取得
    monthlyGmvSummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getMonthlyGmvSummary(input.brandId);
      }),

    // 商品別CSVインポート（TikTok Creator-Live-Recap-Product-List形式）
    importProductCsv: publicProcedure
      .input(
        z.object({
          livestreamId: z.number(),
          fileName: z.string().optional(),
          products: z.array(
            z.object({
              productName: z.string(),
              grossRevenue: z.number().optional().nullable(),
              directGmv: z.number().optional().nullable(),
              itemsSold: z.number().optional().nullable(),
              customers: z.number().optional().nullable(),
              orders: z.number().optional().nullable(),
              ctr: z.string().optional().nullable(),
              ctor: z.string().optional().nullable(),
              productImpressions: z.number().optional().nullable(),
              productClicks: z.number().optional().nullable(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // マスター管理者 OR ライバーadminのどちらかの認証が必要
        let importerName = 'unknown';
        let importerId = 0;
        
        if (ctx.user) {
          // マスター管理者認証
          importerName = ctx.user.name || ctx.user.email;
          importerId = ctx.user.id;
        } else {
          // ライバートークンでの認証を試行
          const authHeader = ctx.req.headers.authorization;
          if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            try {
              const { jwtVerify } = await import('jose');
              const secret = new TextEncoder().encode(ENV.cookieSecret);
              const { payload } = await jwtVerify(token, secret);
              if (payload.liverId) {
                const liver = await getLiverById(payload.liverId as number);
                if (liver && liver.role === 'admin') {
                  importerName = liver.name || liver.email;
                  importerId = liver.id;
                } else {
                  throw new TRPCError({ code: 'FORBIDDEN', message: 'CSVアップロードは管理者のみ利用可能です' });
                }
              }
            } catch (e: any) {
              if (e.code === 'FORBIDDEN') throw e;
              throw new TRPCError({ code: 'UNAUTHORIZED', message: '認証が必要です' });
            }
          } else {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: '認証が必要です' });
          }
        }
        
        const count = await importLivestreamProductsFromCsv(
          input.livestreamId,
          input.products
        );
        
        // Calculate total GMV
        const totalGmv = input.products.reduce((sum, p) => sum + (p.directGmv || 0), 0);
        
        // Create import history record
        await createCsvImportHistory({
          livestreamId: input.livestreamId,
          fileName: input.fileName || 'unknown.xlsx',
          productCount: count,
          totalGmv,
          importedBy: importerId,
          importedByName: importerName,
        });
        
        return { success: true, importedCount: count };
      }),
    
    // Get CSV import history for a livestream
    getImportHistory: publicProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getCsvImportHistoryByLivestream(input.livestreamId);
      }),
    
    // Delete CSV import history and associated products
    deleteImportHistory: protectedProcedure
      .input(z.object({ historyId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteCsvImportHistory(input.historyId);
      }),
  }),

  // Brand Memo Router
  brandMemo: router({
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          content: z.string().min(1),
          authorName: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createBrandMemo({
          ...input,
          createdBy: ctx.user.id,
        });
      }),

    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getMemosByBrandId(input.brandId);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const { id, content } = input;
        await updateBrandMemo(id, { content });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandMemo(input.id);
        return { success: true };
      }),
  }),

  // Business Card Management Router
  businessCard: router({
    // Upload and OCR a business card image
    upload: protectedProcedure
      .input(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Upload image to S3
          const imageBuffer = Buffer.from(input.imageBase64, "base64");
          const fileKey = `business-cards/${ctx.user.id}/${nanoid()}.${input.mimeType.split("/")[1] || "jpg"}`;
          const { url: imageUrl, key: imageKey } = await storagePut(fileKey, imageBuffer, input.mimeType);

          // Use LLM to extract business card information
          const ocrResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a business card OCR assistant. Extract all information from the business card image and return it in JSON format.
Extract the following fields if available:
- name: Full name (氏名)
- nameReading: Name reading/pronunciation (読み仮名) if visible
- company: Company name (会社名)
- department: Department (部署)
- position: Job title/position (役職)
- email: Email address
- phone: Phone number (電話番号)
- mobile: Mobile phone (携帯電話)
- fax: Fax number
- address: Full address (住所)
- website: Website URL

Return ONLY valid JSON, no markdown or explanation.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${input.mimeType};base64,${input.imageBase64}`,
                  },
                },
                {
                  type: "text",
                  text: "Please extract all business card information from this image.",
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "business_card_info",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name" },
                  nameReading: { type: "string", description: "Name reading" },
                  company: { type: "string", description: "Company name" },
                  department: { type: "string", description: "Department" },
                  position: { type: "string", description: "Job title" },
                  email: { type: "string", description: "Email address" },
                  phone: { type: "string", description: "Phone number" },
                  mobile: { type: "string", description: "Mobile phone" },
                  fax: { type: "string", description: "Fax number" },
                  address: { type: "string", description: "Address" },
                  website: { type: "string", description: "Website URL" },
                },
                required: ["name"],
                additionalProperties: false,
              },
            },
          },
        });

        let extractedInfo: any = {};
        try {
          const content = ocrResult.choices[0]?.message?.content;
          if (content && typeof content === 'string') {
            extractedInfo = JSON.parse(content);
          }
        } catch (e) {
          console.error("Failed to parse OCR result:", e);
        }

        return {
          imageUrl,
          imageKey,
          extractedInfo,
        };
      } catch (error) {
        console.error("Business card upload/OCR error:", error);
        throw new Error("名刺の解析に失敗しました。画像を確認して再試行してください。");
      }
    }),

    // Create a new business card
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          nameReading: z.string().optional(),
          company: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          mobile: z.string().optional(),
          fax: z.string().optional(),
          address: z.string().optional(),
          website: z.string().optional(),
          imageUrl: z.string().optional(),
          imageKey: z.string().optional(),
          notes: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Generate duplicate hash from company + name
        const crypto = await import("crypto");
        const duplicateHash = crypto
          .createHash("md5")
          .update(`${input.company || ""}|${input.name}`)
          .digest("hex");

        // Check for duplicates
        const existing = await checkDuplicateBusinessCard(duplicateHash);
        if (existing) {
          return {
            success: false,
            duplicate: true,
            existingCard: existing,
            message: "A business card with the same name and company already exists.",
          };
        }

        await createBusinessCard({
          ...input,
          registeredBy: ctx.user.id,
          duplicateHash,
        });

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "business_card_create",
          actionLabel: "名刺を登録",
          targetType: "business_card",
          targetName: `${input.name}${input.company ? ` (${input.company})` : ""}`,
          metadata: {
            company: input.company,
            position: input.position,
            email: input.email,
          },
        });

        return { success: true, duplicate: false };
      }),

    // Get all business cards
    list: protectedProcedure
      .input(
        z.object({
          search: z.string().optional(),
          registeredBy: z.number().optional(),
          limit: z.number().optional(),
          offset: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getBusinessCards(input);
      }),

    // Get business card by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getBusinessCardById(input.id);
      }),

    // Update business card
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          nameReading: z.string().optional(),
          company: z.string().optional(),
          department: z.string().optional(),
          position: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          mobile: z.string().optional(),
          fax: z.string().optional(),
          address: z.string().optional(),
          website: z.string().optional(),
          notes: z.string().optional(),
          tags: z.array(z.string()).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        
        // If name or company changed, update duplicate hash
        if (data.name || data.company) {
          const existing = await getBusinessCardById(id);
          if (existing) {
            const crypto = await import("crypto");
            const newHash = crypto
              .createHash("md5")
              .update(`${data.company || existing.company || ""}|${data.name || existing.name}`)
              .digest("hex");
            (data as any).duplicateHash = newHash;
          }
        }
        
        await updateBusinessCard(id, data);
        return { success: true };
      }),

    // Delete business card
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBusinessCard(input.id);
        return { success: true };
      }),

    // Get count
    count: protectedProcedure
      .input(z.object({ registeredBy: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getBusinessCardCount(input?.registeredBy);
      }),

    // Check for duplicate
    checkDuplicate: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          company: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const crypto = await import("crypto");
        const duplicateHash = crypto
          .createHash("md5")
          .update(`${input.company || ""}|${input.name}`)
          .digest("hex");
        
        const existing = await checkDuplicateBusinessCard(duplicateHash);
        return {
          isDuplicate: !!existing,
          existingCard: existing,
        };
      }),
  }),

  // Activity Log Router
  activityLog: router({
    // Get recent activity logs
    getRecent: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getRecentActivityLogs(input?.limit || 50);
      }),

    // Get activity logs by user
    getByUser: protectedProcedure
      .input(z.object({ userId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getActivityLogsByUser(input.userId, input.limit || 50);
      }),
  }),

  // User Management Router (for admin)
  users: router({
    // Get all registered users
    getAll: protectedProcedure.query(async () => {
      return await getAllUsers();
    }),

    // Get user activity statistics
    getActivityStats: protectedProcedure.query(async () => {
      return await getUserActivityStats();
    }),
  }),

  // Brand Contract Router (契約管理)
  brandContract: router({
    // Create a new contract
    create: protectedProcedure
      .input(
        z.object({
          brandId: z.number(),
          serviceType: z.enum(["TSP", "ライブコマース", "広告運用代行", "SNS運用代行", "その他", "単発ライブ契約", "期間契約", "運用代行型（TSP）", "パッケージ／複合契約"]).default("単発ライブ契約"),
          fixedFee: z.number().optional(),
          commissionRate: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          status: z.enum(["契約中", "完了", "保留", "終了"]).default("契約中"),
          memo: z.string().optional(),
          plannedLivestreamCount: z.number().optional(),
          tspContractId: z.number().nullable().optional(),
          currency: z.string().optional(),
          kgLiveCondition: z.string().optional(),
          liverLiveCondition: z.string().optional(),
          shortVideoCondition: z.string().optional(),
          contractPeriodLabel: z.string().optional(),
          kgLiveHoursQuota: z.number().nullable().optional(),
          liverLiveHoursQuota: z.number().nullable().optional(),
          shortVideoCountQuota: z.number().nullable().optional(),
          kgLiveFrequency: z.number().nullable().optional(),
          kgLiveMinutesPerSession: z.number().nullable().optional(),
          liverLiveAssignments: z.array(z.object({ liverName: z.string(), minutesPerMonth: z.number() })).nullable().optional(),
          shortVideoAssignments: z.array(z.object({ liverName: z.string(), countPerMonth: z.number() })).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // LLMでテキスト条件からノルマ数値を自動抽出
        let quotaData: any = {};
        try {
          const { extractQuotaFromConditions } = await import("./contractQuotaExtractor");
          const hasConditionText = [input.kgLiveCondition, input.liverLiveCondition, input.shortVideoCondition, input.memo].some(t => t && t.trim());
          if (hasConditionText || input.startDate || input.endDate) {
            const extracted = await extractQuotaFromConditions({
              kgLiveCondition: input.kgLiveCondition,
              liverLiveCondition: input.liverLiveCondition,
              shortVideoCondition: input.shortVideoCondition,
              startDate: input.startDate,
              endDate: input.endDate,
              memo: input.memo,
            });
            console.log("[brandContract.create] LLM extracted quota:", JSON.stringify(extracted));
            // LLM抽出値をマージ（明示的に入力された値を優先）
            quotaData = {
              kgLiveHoursQuota: input.kgLiveHoursQuota ?? extracted.kgLiveHoursQuota,
              kgLiveFrequency: input.kgLiveFrequency ?? extracted.kgLiveFrequency,
              kgLiveMinutesPerSession: input.kgLiveMinutesPerSession ?? extracted.kgLiveMinutesPerSession,
              liverLiveHoursQuota: input.liverLiveHoursQuota ?? extracted.liverLiveHoursQuota,
              liverLiveAssignments: input.liverLiveAssignments ?? extracted.liverLiveAssignments,
              shortVideoCountQuota: input.shortVideoCountQuota ?? extracted.shortVideoCountQuota,
              shortVideoAssignments: input.shortVideoAssignments ?? extracted.shortVideoAssignments,
              contractPeriodLabel: input.contractPeriodLabel ?? extracted.contractPeriodLabel,
            };
          }
        } catch (err) {
          console.error("[brandContract.create] LLM extraction error (non-fatal):", err);
        }

        const contract = await createBrandContract({
          ...input,
          ...quotaData,
          createdBy: ctx.user.id,
        });

        // Get brand name for activity log
        const brand = await getBrandById(input.brandId);

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "brand_contract_create",
          actionLabel: "契約を追加",
          targetId: input.brandId,
          targetName: brand?.name || `ブランド #${input.brandId}`,
          metadata: {
            serviceType: input.serviceType,
            fixedFee: input.fixedFee,
          },
        });
        
        // Record edit log
        const feeStr = input.fixedFee ? `¥${input.fixedFee.toLocaleString()}` : '未設定';
        await logBrandEdit(
          input.brandId,
          "create",
          "contract",
          contract.id,
          `${input.serviceType} ${feeStr}`,
          `契約を追加：${input.serviceType} ${feeStr}`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );

        return { ...contract, contractId: contract.id };
      }),

    // Get contracts by brand ID
    listByBrand: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getContractsByBrandId(input.brandId);
      }),

    // Get contract by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getContractById(input.id);
      }),

    // Update a contract
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          serviceType: z.enum(["TSP", "ライブコマース", "広告運用代行", "SNS運用代行", "その他", "単発ライブ契約", "期間契約", "運用代行型（TSP）", "パッケージ／複合契約"]).optional(),
          contractType: z.enum(["月額契約", "年間契約", "単発契約", "広告案件", "その他"]).optional(),
          fixedFee: z.number().optional(),
          commissionRate: z.string().optional(),
          startDate: z.union([z.date(), z.string()]).optional(),
          endDate: z.union([z.date(), z.string()]).optional(),
          status: z.enum(["契約中", "完了", "保留", "終了"]).optional(),
          memo: z.string().optional(),
          plannedLivestreamCount: z.number().nullable().optional(),
          tspContractId: z.number().nullable().optional(),
          currency: z.string().optional(),
          kgLiveCondition: z.string().nullable().optional(),
          liverLiveCondition: z.string().nullable().optional(),
          shortVideoCondition: z.string().nullable().optional(),
          contractPeriodLabel: z.string().nullable().optional(),
          kgLiveHoursQuota: z.number().nullable().optional(),
          liverLiveHoursQuota: z.number().nullable().optional(),
          shortVideoCountQuota: z.number().nullable().optional(),
          kgLiveFrequency: z.number().nullable().optional(),
          kgLiveMinutesPerSession: z.number().nullable().optional(),
          liverLiveAssignments: z.array(z.object({ liverName: z.string(), minutesPerMonth: z.number() })).nullable().optional(),
          shortVideoAssignments: z.array(z.object({ liverName: z.string(), countPerMonth: z.number() })).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[brandContract.update] Input received:", JSON.stringify(input, null, 2));
          const { id, startDate, endDate, ...rest } = input;
          
          // Get existing contract for logging
          const existingContract = await getContractById(id);
          
          const data: any = { ...rest };
          // 日付を適切に変換
          if (startDate) {
            data.startDate = startDate instanceof Date ? startDate : new Date(startDate);
          }
          if (endDate) {
            data.endDate = endDate instanceof Date ? endDate : new Date(endDate);
          }

          // LLMでテキスト条件からノルマ数値を自動抽出
          try {
            const { extractQuotaFromConditions } = await import("./contractQuotaExtractor");
            // 更新後の条件テキストを取得（新しい値 or 既存値）
            const kgCond = data.kgLiveCondition ?? existingContract?.kgLiveCondition;
            const liverCond = data.liverLiveCondition ?? existingContract?.liverLiveCondition;
            const shortCond = data.shortVideoCondition ?? existingContract?.shortVideoCondition;
            const memoText = data.memo ?? existingContract?.memo;
            const sDate = data.startDate ?? existingContract?.startDate;
            const eDate = data.endDate ?? existingContract?.endDate;
            
            const hasConditionText = [kgCond, liverCond, shortCond, memoText].some((t: any) => t && String(t).trim());
            if (hasConditionText || sDate || eDate) {
              const extracted = await extractQuotaFromConditions({
                kgLiveCondition: kgCond,
                liverLiveCondition: liverCond,
                shortVideoCondition: shortCond,
                startDate: sDate,
                endDate: eDate,
                memo: memoText,
              });
              console.log("[brandContract.update] LLM extracted quota:", JSON.stringify(extracted));
              // LLM抽出値をマージ（明示的に入力された値を優先）
              if (extracted.kgLiveHoursQuota !== null && data.kgLiveHoursQuota === undefined) data.kgLiveHoursQuota = extracted.kgLiveHoursQuota;
              if (extracted.kgLiveFrequency !== null && data.kgLiveFrequency === undefined) data.kgLiveFrequency = extracted.kgLiveFrequency;
              if (extracted.kgLiveMinutesPerSession !== null && data.kgLiveMinutesPerSession === undefined) data.kgLiveMinutesPerSession = extracted.kgLiveMinutesPerSession;
              if (extracted.liverLiveHoursQuota !== null && data.liverLiveHoursQuota === undefined) data.liverLiveHoursQuota = extracted.liverLiveHoursQuota;
              if (extracted.liverLiveAssignments !== null && data.liverLiveAssignments === undefined) data.liverLiveAssignments = extracted.liverLiveAssignments;
              if (extracted.shortVideoCountQuota !== null && data.shortVideoCountQuota === undefined) data.shortVideoCountQuota = extracted.shortVideoCountQuota;
              if (extracted.shortVideoAssignments !== null && data.shortVideoAssignments === undefined) data.shortVideoAssignments = extracted.shortVideoAssignments;
              if (extracted.contractPeriodLabel !== null && data.contractPeriodLabel === undefined) data.contractPeriodLabel = extracted.contractPeriodLabel;
            }
          } catch (err) {
            console.error("[brandContract.update] LLM extraction error (non-fatal):", err);
          }

          console.log("[brandContract.update] Final data:", JSON.stringify(data, null, 2));
          await updateBrandContract(id, data);
          console.log("[brandContract.update] Success for id:", id);
          
          // Record edit log with detailed changes
          if (existingContract) {
            const feeStr = existingContract.fixedFee ? `¥${existingContract.fixedFee.toLocaleString()}` : '未設定';
            
            // Build detailed change description
            const changes: string[] = [];
            if (rest.serviceType && rest.serviceType !== existingContract.serviceType) {
              changes.push(`契約タイプ: ${existingContract.serviceType} → ${rest.serviceType}`);
            }
            if (rest.fixedFee !== undefined && rest.fixedFee !== existingContract.fixedFee) {
              changes.push(`固定費: ¥${existingContract.fixedFee?.toLocaleString() || 0} → ¥${rest.fixedFee.toLocaleString()}`);
            }
            if (rest.commissionRate !== undefined && rest.commissionRate !== existingContract.commissionRate) {
              changes.push(`成果報酬: ${existingContract.commissionRate || '-'}% → ${rest.commissionRate}%`);
            }
            if (rest.status && rest.status !== existingContract.status) {
              changes.push(`ステータス: ${existingContract.status} → ${rest.status}`);
            }
            if (data.startDate && existingContract.startDate) {
              const oldDate = new Date(existingContract.startDate).toLocaleDateString('ja-JP');
              const newDate = new Date(data.startDate).toLocaleDateString('ja-JP');
              if (oldDate !== newDate) {
                changes.push(`開始日: ${oldDate} → ${newDate}`);
              }
            }
            if (data.endDate && existingContract.endDate) {
              const oldDate = new Date(existingContract.endDate).toLocaleDateString('ja-JP');
              const newDate = new Date(data.endDate).toLocaleDateString('ja-JP');
              if (oldDate !== newDate) {
                changes.push(`終了日: ${oldDate} → ${newDate}`);
              }
            }
            if (rest.memo !== undefined && rest.memo !== existingContract.memo) {
              changes.push(`メモを更新`);
            }
            
            const changeDescription = changes.length > 0 
              ? `契約を編集：${existingContract.serviceType} ${feeStr}\n${changes.join('\n')}`
              : `契約を編集：${existingContract.serviceType} ${feeStr}`;
            
            await logBrandEdit(
              existingContract.brandId,
              "update",
              "contract",
              id,
              `${existingContract.serviceType} ${feeStr}`,
              changeDescription,
              ctx.user.id,
              ctx.user.name || ctx.user.email,
              JSON.stringify(existingContract),
              JSON.stringify({ ...existingContract, ...data })
            );
          }
          
          return { success: true };
        } catch (error) {
          console.error("[brandContract.update] Error:", error);
          throw error;
        }
      }),

    // Delete a contract
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Get existing contract for logging
        const existingContract = await getContractById(input.id);
        
        await deleteBrandContract(input.id);
        
        // Record edit log
        if (existingContract) {
          const feeStr = existingContract.fixedFee ? `¥${existingContract.fixedFee.toLocaleString()}` : '未設定';
          await logBrandEdit(
            existingContract.brandId,
            "delete",
            "contract",
            input.id,
            `${existingContract.serviceType} ${feeStr}`,
            `契約を削除：${existingContract.serviceType} ${feeStr}`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }
        
        return { success: true };
      }),

    // Get all contracts (for statistics)
    listAll: protectedProcedure.query(async () => {
      return await getAllContracts();
    }),

    // Batch LLM extraction for existing contracts (admin only)
    batchExtractQuotas: protectedProcedure
      .input(z.object({
        dryRun: z.boolean().default(true),
        onlyMissing: z.boolean().default(true), // only process contracts with missing quota values
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
        }
        const { extractQuotaFromConditions } = await import("./contractQuotaExtractor");
        const allContracts = await getAllContracts();
        
        // Filter to contracts that need processing
        const toProcess = input.onlyMissing
          ? allContracts.filter((c: any) => {
              const hasText = [c.kgLiveCondition, c.liverLiveCondition, c.shortVideoCondition].some((t: any) => t && String(t).trim());
              const missingQuota = !c.kgLiveHoursQuota && !c.liverLiveHoursQuota && !c.shortVideoCountQuota;
              return hasText && missingQuota;
            })
          : allContracts.filter((c: any) => {
              return [c.kgLiveCondition, c.liverLiveCondition, c.shortVideoCondition].some((t: any) => t && String(t).trim());
            });
        
        if (input.dryRun) {
          return {
            dryRun: true,
            totalContracts: allContracts.length,
            toProcess: toProcess.length,
            contracts: toProcess.map((c: any) => ({
              id: c.id,
              brandId: c.brandId,
              kgLiveCondition: c.kgLiveCondition,
              liverLiveCondition: c.liverLiveCondition,
              shortVideoCondition: c.shortVideoCondition,
              currentKgQuota: c.kgLiveHoursQuota,
              currentLiverQuota: c.liverLiveHoursQuota,
              currentShortVideoQuota: c.shortVideoCountQuota,
            })),
          };
        }
        
        const results: any[] = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (const contract of toProcess) {
          try {
            const extracted = await extractQuotaFromConditions({
              kgLiveCondition: (contract as any).kgLiveCondition,
              liverLiveCondition: (contract as any).liverLiveCondition,
              shortVideoCondition: (contract as any).shortVideoCondition,
              startDate: (contract as any).startDate,
              endDate: (contract as any).endDate,
              memo: (contract as any).memo,
            });
            
            // Build update data (only non-null extracted values)
            const updateData: any = {};
            if (extracted.kgLiveHoursQuota !== null) updateData.kgLiveHoursQuota = extracted.kgLiveHoursQuota;
            if (extracted.kgLiveFrequency !== null) updateData.kgLiveFrequency = extracted.kgLiveFrequency;
            if (extracted.kgLiveMinutesPerSession !== null) updateData.kgLiveMinutesPerSession = extracted.kgLiveMinutesPerSession;
            if (extracted.liverLiveHoursQuota !== null) updateData.liverLiveHoursQuota = extracted.liverLiveHoursQuota;
            if (extracted.liverLiveAssignments !== null) updateData.liverLiveAssignments = extracted.liverLiveAssignments;
            if (extracted.shortVideoCountQuota !== null) updateData.shortVideoCountQuota = extracted.shortVideoCountQuota;
            if (extracted.shortVideoAssignments !== null) updateData.shortVideoAssignments = extracted.shortVideoAssignments;
            if (extracted.contractPeriodLabel !== null) updateData.contractPeriodLabel = extracted.contractPeriodLabel;
            
            if (Object.keys(updateData).length > 0) {
              await updateBrandContract((contract as any).id, updateData);
              successCount++;
              results.push({ id: (contract as any).id, status: "updated", extracted });
            } else {
              results.push({ id: (contract as any).id, status: "skipped", reason: "no values extracted" });
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            errorCount++;
            results.push({ id: (contract as any).id, status: "error", error: String(err) });
          }
        }
        
        return {
          dryRun: false,
          totalContracts: allContracts.length,
          processed: toProcess.length,
          successCount,
          errorCount,
          results,
        };
      }),

    // Get active contracts count
    activeCount: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getActiveContractsCount(input.brandId);
      }),

    // Link a livestream to a contract
    linkLivestream: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          livestreamId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if link already exists
        const exists = await checkContractLivestreamLinkExists(
          input.contractId,
          input.livestreamId
        );
        if (exists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "この直播は既に契約に紐付けられています",
          });
        }

        const link = await createContractLivestreamLink({
          contractId: input.contractId,
          livestreamId: input.livestreamId,
          createdBy: ctx.user.id,
        });
        return link;
      }),

    // Unlink a livestream from a contract
    unlinkLivestream: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          livestreamId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await deleteContractLivestreamLink(input.contractId, input.livestreamId);
        return { success: true };
      }),

    // Get linked livestreams for a contract
    getLinkedLivestreams: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return await getContractLinkedLivestreams(input.contractId);
      }),

    // Calculate ROAS for a contract
    calculateRoas: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          fixedFee: z.number(),
        })
      )
      .query(async ({ input }) => {
        return await calculateContractRoas(input.contractId, input.fixedFee);
      }),

    // Bulk link livestreams to a contract
    bulkLinkLivestreams: protectedProcedure
      .input(
        z.object({
          contractId: z.number(),
          livestreamIds: z.array(z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          console.log("[bulkLinkLivestreams] Input:", JSON.stringify(input, null, 2));
          // First, delete all existing links
          await deleteAllContractLivestreamLinks(input.contractId);

          // Then create new links
          const results = [];
          for (const livestreamId of input.livestreamIds) {
            const link = await createContractLivestreamLink({
              contractId: input.contractId,
              livestreamId,
              createdBy: ctx.user.id,
            });
            results.push(link);
          }
          console.log("[bulkLinkLivestreams] Success, created", results.length, "links");
          return results;
        } catch (error) {
          console.error("[bulkLinkLivestreams] Error:", error);
          throw error;
        }
      }),

    // ノルマ進捗集計API
    getQuotaProgress: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        year: z.number(),
        month: z.number(), // 1-12
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { brandId, year, month } = input;

        // JST月の範囲を計算（UTC）
        // JST月初 00:00 = UTC 前日 15:00
        const jstStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
        const lastDay = new Date(year, month, 0).getDate();
        const jstEnd = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);

        // 当月のアクティブ契約を取得（ノルマ設定あり）
        const contracts = await db
          .select()
          .from(brandContracts)
          .where(and(
            eq(brandContracts.brandId, brandId),
            isNull(brandContracts.deletedAt),
            eq(brandContracts.status, "契約中")
          ));

        // ノルマ設定がある契約を集約
        let totalKgQuota = 0;
        let totalLiverQuota = 0;
        let totalVideoQuota = 0;
        for (const c of contracts) {
          if (c.kgLiveHoursQuota) totalKgQuota += c.kgLiveHoursQuota;
          if (c.liverLiveHoursQuota) totalLiverQuota += c.liverLiveHoursQuota;
          if (c.shortVideoCountQuota) totalVideoQuota += c.shortVideoCountQuota;
        }

        // 当月の配信データをライバー別に集計
        const livestreams = await db
          .select({
            liverId: brandLivestreams.liverId,
            streamerName: brandLivestreams.streamerName,
            duration: brandLivestreams.duration,
            gmv: brandLivestreams.gmv,
            salesAmount: brandLivestreams.salesAmount,
            livestreamDate: brandLivestreams.livestreamDate,
          })
          .from(brandLivestreams)
          .where(and(
            eq(brandLivestreams.brandId, brandId),
            isNull(brandLivestreams.deletedAt),
            gte(brandLivestreams.livestreamDate, jstStart),
            lte(brandLivestreams.livestreamDate, jstEnd)
          ));

        // ライバー別集計
        const liverMap: Record<string, {
          liverId: number | null;
          streamerName: string;
          totalDurationMin: number;
          totalGmv: number;
          streamCount: number;
        }> = {};

        let totalDurationMin = 0;

        for (const ls of livestreams) {
          const key = ls.liverId ? `liver_${ls.liverId}` : `name_${ls.streamerName}`;
          if (!liverMap[key]) {
            liverMap[key] = {
              liverId: ls.liverId,
              streamerName: ls.streamerName,
              totalDurationMin: 0,
              totalGmv: 0,
              streamCount: 0,
            };
          }
          const dur = ls.duration || 0;
          liverMap[key].totalDurationMin += dur;
          liverMap[key].totalGmv += (ls.gmv || ls.salesAmount || 0);
          liverMap[key].streamCount += 1;
          totalDurationMin += dur;
        }

        // KG老师（liverId=null or 特定のstreamerName）の判定
        // KG老师は通常streamerNameに「KG」「老师」を含む、またはliverId=nullの場合が多い
        let kgDurationMin = 0;
        let liverDurationMin = 0;
        const liverBreakdown = Object.values(liverMap).map(v => {
          const isKg = v.streamerName.includes('KG') || v.streamerName.includes('老师') || v.streamerName.includes('kg');
          if (isKg) {
            kgDurationMin += v.totalDurationMin;
          } else {
            liverDurationMin += v.totalDurationMin;
          }
          return {
            ...v,
            isKg,
            totalDurationHours: Math.round(v.totalDurationMin / 60 * 10) / 10,
          };
        });

        // 時間に変換（分→時間）
        const kgDurationHours = Math.round(kgDurationMin / 60 * 10) / 10;
        const liverDurationHours = Math.round(liverDurationMin / 60 * 10) / 10;

        return {
          brandId,
          year,
          month,
          quotas: {
            kgLiveHours: totalKgQuota,
            liverLiveHours: totalLiverQuota,
            shortVideoCount: totalVideoQuota,
          },
          actuals: {
            kgLiveHours: kgDurationHours,
            liverLiveHours: liverDurationHours,
            totalLiveHours: Math.round(totalDurationMin / 60 * 10) / 10,
            shortVideoCount: 0, // TODO: 短視頻データソースが確定したら実装
          },
          liverBreakdown: liverBreakdown.sort((a, b) => b.totalDurationMin - a.totalDurationMin),
          contracts: contracts.map(c => ({
            id: c.id,
            serviceType: c.serviceType,
            kgLiveHoursQuota: c.kgLiveHoursQuota,
            liverLiveHoursQuota: c.liverLiveHoursQuota,
            shortVideoCountQuota: c.shortVideoCountQuota,
            kgLiveFrequency: c.kgLiveFrequency,
            kgLiveMinutesPerSession: c.kgLiveMinutesPerSession,
            liverLiveAssignments: c.liverLiveAssignments as Array<{liverName: string, minutesPerMonth: number}> | null,
            shortVideoAssignments: c.shortVideoAssignments as Array<{liverName: string, countPerMonth: number}> | null,
          })),
          // KOL別ノルマ進捗（構造化データ）
          kolProgress: (() => {
            const kolMap: Record<string, { quota: number; actual: number; streamCount: number }> = {};
            for (const c of contracts) {
              const assignments = c.liverLiveAssignments as Array<{liverName: string, minutesPerMonth: number}> | null;
              if (assignments) {
                for (const a of assignments) {
                  if (!kolMap[a.liverName]) kolMap[a.liverName] = { quota: 0, actual: 0, streamCount: 0 };
                  kolMap[a.liverName].quota += a.minutesPerMonth;
                }
              }
            }
            // マッチング: liverBreakdownのstreamerNameとKOL名を照合
            for (const lb of liverBreakdown) {
              if (kolMap[lb.streamerName]) {
                kolMap[lb.streamerName].actual += lb.totalDurationMin;
                kolMap[lb.streamerName].streamCount += lb.streamCount;
              }
            }
            return Object.entries(kolMap).map(([name, data]) => ({
              liverName: name,
              quotaMinutes: data.quota,
              actualMinutes: data.actual,
              quotaHours: Math.round(data.quota / 60 * 10) / 10,
              actualHours: Math.round(data.actual / 60 * 10) / 10,
              progressPercent: data.quota > 0 ? Math.round(data.actual / data.quota * 100) : 0,
              streamCount: data.streamCount,
            }));
          })(),
          // 短視頻KOL別進捗
          videoKolProgress: (() => {
            const vMap: Record<string, { quota: number; actual: number }> = {};
            for (const c of contracts) {
              const assignments = c.shortVideoAssignments as Array<{liverName: string, countPerMonth: number}> | null;
              if (assignments) {
                for (const a of assignments) {
                  if (!vMap[a.liverName]) vMap[a.liverName] = { quota: 0, actual: 0 };
                  vMap[a.liverName].quota += a.countPerMonth;
                }
              }
            }
            // TODO: 短視頻の実績データソースが確定したら actual を集計
            return Object.entries(vMap).map(([name, data]) => ({
              liverName: name,
              quotaCount: data.quota,
              actualCount: data.actual,
              progressPercent: data.quota > 0 ? Math.round(data.actual / data.quota * 100) : 0,
            }));
          })(),
        };
      }),

    // 月別ノルマ達成推移API（契約期間の各月の達成率を返す）
    getQuotaMonthlyTrend: protectedProcedure
      .input(z.object({
        brandId: z.number(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const { brandId } = input;

        // アクティブ契約を取得
        const contracts = await db
          .select()
          .from(brandContracts)
          .where(and(
            eq(brandContracts.brandId, brandId),
            isNull(brandContracts.deletedAt),
            eq(brandContracts.status, "契約中")
          ));

        if (contracts.length === 0) return { months: [], contracts: [] };

        // 契約期間の最早開始日と最遅終了日を特定
        let earliest: Date | null = null;
        let latest: Date | null = null;
        for (const c of contracts) {
          if (c.startDate) {
            const d = new Date(c.startDate);
            if (!earliest || d < earliest) earliest = d;
          }
          if (c.endDate) {
            const d = new Date(c.endDate);
            if (!latest || d > latest) latest = d;
          }
        }

        if (!earliest) earliest = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1);
        if (!latest) latest = new Date();

        // 現在月までに制限
        const now = new Date();
        const currentYM = now.getFullYear() * 12 + now.getMonth();
        const endYM = Math.min(latest.getFullYear() * 12 + latest.getMonth(), currentYM);
        const startYM = earliest.getFullYear() * 12 + earliest.getMonth();

        // ノルマ集計
        let totalKgQuota = 0;
        let totalLiverQuota = 0;
        let totalVideoQuota = 0;
        for (const c of contracts) {
          if (c.kgLiveHoursQuota) totalKgQuota += c.kgLiveHoursQuota;
          if (c.liverLiveHoursQuota) totalLiverQuota += c.liverLiveHoursQuota;
          if (c.shortVideoCountQuota) totalVideoQuota += c.shortVideoCountQuota;
        }

        // 各月のデータを集計
        const months: Array<{
          year: number; month: number;
          kgQuota: number; kgActual: number;
          liverQuota: number; liverActual: number;
          videoQuota: number; videoActual: number;
          totalGmv: number; streamCount: number;
        }> = [];

        for (let ym = startYM; ym <= endYM; ym++) {
          const y = Math.floor(ym / 12);
          const m = ym % 12; // 0-indexed
          const jstStart = new Date(Date.UTC(y, m, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
          const lastDay = new Date(y, m + 1, 0).getDate();
          const jstEnd = new Date(Date.UTC(y, m, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);

          const livestreams = await db
            .select({
              streamerName: brandLivestreams.streamerName,
              duration: brandLivestreams.duration,
              gmv: brandLivestreams.gmv,
              salesAmount: brandLivestreams.salesAmount,
            })
            .from(brandLivestreams)
            .where(and(
              eq(brandLivestreams.brandId, brandId),
              isNull(brandLivestreams.deletedAt),
              gte(brandLivestreams.livestreamDate, jstStart),
              lte(brandLivestreams.livestreamDate, jstEnd)
            ));

          let kgMin = 0, liverMin = 0, totalGmv = 0, streamCount = livestreams.length;
          for (const ls of livestreams) {
            const dur = ls.duration || 0;
            const isKg = (ls.streamerName || '').includes('KG') || (ls.streamerName || '').includes('老师') || (ls.streamerName || '').includes('kg');
            if (isKg) kgMin += dur; else liverMin += dur;
            totalGmv += (ls.gmv || ls.salesAmount || 0);
          }

          months.push({
            year: y, month: m + 1, // 1-indexed
            kgQuota: totalKgQuota, kgActual: Math.round(kgMin / 60 * 10) / 10,
            liverQuota: totalLiverQuota, liverActual: Math.round(liverMin / 60 * 10) / 10,
            videoQuota: totalVideoQuota, videoActual: 0,
            totalGmv, streamCount,
          });
        }

        return {
          months,
          contracts: contracts.map(c => ({
            id: c.id, brandName: c.brandId,
            startDate: c.startDate, endDate: c.endDate,
            kgLiveHoursQuota: c.kgLiveHoursQuota,
            liverLiveHoursQuota: c.liverLiveHoursQuota,
            shortVideoCountQuota: c.shortVideoCountQuota,
          })),
        };
      }),

    // 全契約の今月ノルマ進捗を一括取得（ブランド契約一覧用）
    getAllContractsProgress: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const now = new Date();
        // JST
        const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const year = jstNow.getFullYear();
        const month = jstNow.getMonth() + 1;
        const day = jstNow.getDate();
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthProgressPct = Math.round((day / daysInMonth) * 100);

        // アクティブ契約を取得
        const allContracts = await db
          .select()
          .from(brandContracts)
          .where(and(
            isNull(brandContracts.deletedAt),
            eq(brandContracts.status, "契約中")
          ));

        // ブランドIDごとにグループ化
        const brandGroups: Record<number, typeof allContracts> = {};
        for (const c of allContracts) {
          if (!brandGroups[c.brandId]) brandGroups[c.brandId] = [];
          brandGroups[c.brandId].push(c);
        }

        // 当月の配信データを一括取得
        const jstStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
        const lastDay = new Date(year, month, 0).getDate();
        const jstEnd = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);

        const allLivestreams = await db
          .select({
            brandId: brandLivestreams.brandId,
            streamerName: brandLivestreams.streamerName,
            duration: brandLivestreams.duration,
            gmv: brandLivestreams.gmv,
            salesAmount: brandLivestreams.salesAmount,
          })
          .from(brandLivestreams)
          .where(and(
            isNull(brandLivestreams.deletedAt),
            gte(brandLivestreams.livestreamDate, jstStart),
            lte(brandLivestreams.livestreamDate, jstEnd)
          ));

        // ブランドごとに配信データを集計
        const brandLivestreamMap: Record<number, { kgMin: number; liverMin: number; gmv: number; count: number }> = {};
        for (const ls of allLivestreams) {
          if (!brandLivestreamMap[ls.brandId]) brandLivestreamMap[ls.brandId] = { kgMin: 0, liverMin: 0, gmv: 0, count: 0 };
          const dur = ls.duration || 0;
          const isKg = (ls.streamerName || '').includes('KG') || (ls.streamerName || '').includes('老师') || (ls.streamerName || '').includes('kg');
          if (isKg) brandLivestreamMap[ls.brandId].kgMin += dur;
          else brandLivestreamMap[ls.brandId].liverMin += dur;
          brandLivestreamMap[ls.brandId].gmv += (ls.gmv || ls.salesAmount || 0);
          brandLivestreamMap[ls.brandId].count += 1;
        }

        // 各ブランドの進捗を計算
        const results: Array<{
          brandId: number;
          kgQuota: number; kgActual: number; kgPct: number;
          liverQuota: number; liverActual: number; liverPct: number;
          videoQuota: number; videoActual: number; videoPct: number;
          totalGmv: number; streamCount: number;
          monthProgressPct: number;
          paceStatus: 'ahead' | 'on_track' | 'behind' | 'critical';
        }> = [];

        for (const [brandIdStr, contracts] of Object.entries(brandGroups)) {
          const bId = Number(brandIdStr);
          let kgQ = 0, liverQ = 0, videoQ = 0;
          for (const c of contracts) {
            if (c.kgLiveHoursQuota) kgQ += c.kgLiveHoursQuota;
            if (c.liverLiveHoursQuota) liverQ += c.liverLiveHoursQuota;
            if (c.shortVideoCountQuota) videoQ += c.shortVideoCountQuota;
          }

          const ls = brandLivestreamMap[bId] || { kgMin: 0, liverMin: 0, gmv: 0, count: 0 };
          const kgA = Math.round(ls.kgMin / 60 * 10) / 10;
          const liverA = Math.round(ls.liverMin / 60 * 10) / 10;

          const kgPct = kgQ > 0 ? Math.round((kgA / kgQ) * 100) : -1;
          const liverPct = liverQ > 0 ? Math.round((liverA / liverQ) * 100) : -1;
          const videoPct = videoQ > 0 ? 0 : -1; // TODO: 短視頻実績

          // ペースステータス計算
          const activePcts = [kgPct, liverPct, videoPct].filter(p => p >= 0);
          const avgPct = activePcts.length > 0 ? activePcts.reduce((a, b) => a + b, 0) / activePcts.length : 0;
          let paceStatus: 'ahead' | 'on_track' | 'behind' | 'critical' = 'on_track';
          if (avgPct >= monthProgressPct * 1.1) paceStatus = 'ahead';
          else if (avgPct >= monthProgressPct * 0.7) paceStatus = 'on_track';
          else if (avgPct >= monthProgressPct * 0.4) paceStatus = 'behind';
          else paceStatus = 'critical';

          results.push({
            brandId: bId,
            kgQuota: kgQ, kgActual: kgA, kgPct,
            liverQuota: liverQ, liverActual: liverA, liverPct,
            videoQuota: videoQ, videoActual: 0, videoPct,
            totalGmv: ls.gmv, streamCount: ls.count,
            monthProgressPct,
            paceStatus,
          });
        }

        return { year, month, day, daysInMonth, monthProgressPct, results };
      }),
  }),
  // AI Advice Router (日報AIアドバイス))
  aiAdvice: router({
    // Generate AI advice for a report
    generate: protectedProcedure
      .input(z.object({
        reportId: z.number(),
        reportContent: z.string(),
        staffName: z.string().optional(),
        reportDate: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get good examples for learning
        const goodExamples = await getGoodLearningExamples(5);
        const badExamples = await getBadLearningExamples(3);

        // Build prompt with learning examples
        let examplesPrompt = "";
        if (goodExamples.length > 0) {
          examplesPrompt += "\n\n【良いアドバイスの例】\n";
          goodExamples.forEach((ex, i) => {
            examplesPrompt += `${i + 1}. 日報: "${ex.reportContent.substring(0, 100)}..."\n   アドバイス: "${ex.adviceText}"\n`;
          });
        }
        if (badExamples.length > 0) {
          examplesPrompt += "\n【避けるべきアドバイスの例】\n";
          badExamples.forEach((ex, i) => {
            examplesPrompt += `${i + 1}. "${ex.adviceText}" (このようなアドバイスは避けてください)\n`;
          });
        }

        const systemPrompt = `あなたはLCJ（ライブコマースジャパン）の業務アドバイザーAIです。
スタッフが書いた日報を分析し、具体的で実行可能なアドバイスを提供してください。

アドバイスのガイドライン:
1. 日報の内容に基づいた具体的な提案をする
2. 次のアクションやフォローアップを提案する
3. 時間管理や優先順位についてアドバイスする
4. ライバー、ブランド、イベントなどLCJの業務に特化したアドバイスをする
5. 短く、実用的なアドバイスを心がける（100文字以内）

日報が日本語の場合は日本語で、中国語の場合は中国語でアドバイスしてください。
${examplesPrompt}`;

        const userPrompt = `以下の日報に対してアドバイスを提供してください。

スタッフ: ${input.staffName || "不明"}
日付: ${input.reportDate || "不明"}

日報内容:
${input.reportContent}

アドバイスを100文字以内で提供してください。`;

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });

          const rawContent = response.choices[0]?.message?.content;
          const adviceText = typeof rawContent === "string" ? rawContent : "アドバイスを生成できませんでした。";

          // Save the advice to database
          const advice = await createReportAiAdvice({
            reportId: input.reportId,
            adviceText,
            adviceType: "general",
            promptUsed: systemPrompt,
          });

          return advice;
        } catch (error) {
          console.error("AI advice generation error:", error);
          throw new Error("アドバイスの生成に失敗しました");
        }
      }),

    // Get AI advice for a report
    getByReportId: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .query(async ({ input }) => {
        return await getAiAdviceByReportId(input.reportId);
      }),

    // Submit feedback for AI advice
    submitFeedback: protectedProcedure
      .input(z.object({
        adviceId: z.number(),
        rating: z.enum(["good", "bad"]),
        comment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if user already gave feedback
        const existingFeedback = await getUserFeedbackForAdvice(input.adviceId, ctx.user.id);

        if (existingFeedback) {
          // Update existing feedback
          await updateAiAdviceFeedback(existingFeedback.id, {
            rating: input.rating,
            comment: input.comment,
          });
        } else {
          // Create new feedback
          await createAiAdviceFeedback({
            adviceId: input.adviceId,
            userId: ctx.user.id,
            rating: input.rating,
            comment: input.comment,
          });
        }

        // Get the advice and report content for learning
        const advice = await getAiAdviceById(input.adviceId);
        if (advice) {
          const reportData = await getReportById(advice.reportId);
          if (reportData && reportData.report) {
            // Add to learning examples
            await upsertAiLearningExample({
              reportContent: reportData.report.workContent || "",
              adviceText: advice.adviceText,
              isGoodExample: input.rating === "good" ? "yes" : "no",
            });
          }
        }

        return { success: true };
      }),

    // Get user's feedback for an advice
    getUserFeedback: protectedProcedure
      .input(z.object({ adviceId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getUserFeedbackForAdvice(input.adviceId, ctx.user.id);
      }),

    // Get feedback statistics
    getStats: protectedProcedure.query(async () => {
      return await getAiFeedbackStats();
    }),
  }),

  // Chat Report Router (チャット形式の日報)
  chatReport: router({
    // Start or continue today's chat session
    startSession: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .mutation(async ({ input }) => {
        // Check if there's an existing session for today
        const existingSession = await getTodayChatSession(input.staffId);
        if (existingSession && existingSession.status !== "converted") {
          // Return existing session with messages
          const messages = await getMessagesBySessionId(existingSession.id);
          return { session: existingSession, messages, isNew: false };
        }

        // Create new session
        const session = await createChatReportSession({
          staffId: input.staffId,
          reportDate: new Date(),
          status: "in_progress",
        });

        // Increment staff chat count
        await incrementStaffChatCount(input.staffId);

        // Get staff profile for personalization
        const profile = await getOrCreateStaffAiProfile(input.staffId);

        // Get staff info to determine language
        const staffInfo = await getReportStaffById(input.staffId);
        const isChineseStaff = staffInfo?.country === "中国";

        // Get recent reports for context
        const recentReports = await getRecentReportsByStaffId(input.staffId, 3);

        // Get pending followups
        const pendingFollowups = await getFollowupsByStaffId(input.staffId);
        const pendingItems = pendingFollowups.filter(f => f.followup.status === "pending");

        // Generate personalized greeting
        const dayOfWeek = new Date().getDay();
        const dayNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
        const dayNamesZh = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
        const currentDayName = isChineseStaff ? dayNamesZh[dayOfWeek] : dayNames[dayOfWeek];

        let greetingContext = "";
        if (pendingItems.length > 0) {
          greetingContext += isChineseStaff 
            ? `\n您有${pendingItems.length}个待跟进事项未完成。`
            : `\n未完了のフォローアップが${pendingItems.length}件あります。`;
        }
        if (recentReports.length > 0) {
          const lastReport = recentReports[0];
          if (lastReport.issues) {
            greetingContext += isChineseStaff
              ? `\n上次的问题: ${lastReport.issues.substring(0, 50)}...`
              : `\n前回の課題: ${lastReport.issues.substring(0, 50)}...`;
          }
        }

        // Generate greeting message using AI (language based on staff country)
        const greetingPrompt = isChineseStaff
          ? `今天是${currentDayName}。
${greetingContext ? `上下文: ${greetingContext}` : ""}

请写一句问候员工并询问今天工作内容的话。
例: 「周二辛苦了！今天做了什么工作？」

绝对禁止: 不要输出任何英文、思考过程、字数统计、标签或解释。只输出纯中文问句。`
          : `今日は${currentDayName}です。
${greetingContext ? `コンテキスト: ${greetingContext}` : ""}

スタッフへの挨拶と今日の業務についての質問を一文で書いてください。
例: 「火曜日お疲れ様です！今日の業務は何をしましたか？」

絶対禁止: 英語、思考プロセス、文字数、タグ、説明は出力しないでください。純粋な日本語の質問文のみを出力してください。`;

        let greetingText = isChineseStaff
          ? `你好！今天是${currentDayName}。今天做了什么工作？`
          : `こんにちは！今日は${currentDayName}ですね。今日はどんな業務をしましたか？`;
        
        // Helper function to clean AI response from thinking process
        const cleanAiResponse = (text: string): string => {
          // Remove patterns like "(22 characters)", "**Review and Finalize:**", "**Final Output Generation:**"
          let cleaned = text;
          
          // Remove character count patterns
          cleaned = cleaned.replace(/\s*\(\d+\s*characters?\)/gi, "");
          
          // Remove numbered thinking steps with headers
          cleaned = cleaned.replace(/\d+\.\s*\*\*[^*]+\*\*:?[^\n]*\n?/g, "");
          
          // Remove markdown headers like **Review and Finalize:** or **Final Output Generation:**
          cleaned = cleaned.replace(/\*\*[^*]+\*\*:?\s*/g, "");
          
          // Remove lines starting with thinking process indicators
          cleaned = cleaned.replace(/^(Review|Finalize|Output|Generation|Self-correction|Meets|criteria)[^\n]*\n?/gim, "");
          
          // Remove parenthetical notes like (Self-correction: ...)
          cleaned = cleaned.replace(/\([^)]*Self-correction[^)]*\)/gi, "");
          cleaned = cleaned.replace(/\([^)]*criteria[^)]*\)/gi, "");
          
          // Clean up multiple newlines and trim
          cleaned = cleaned.replace(/\n{2,}/g, "\n").trim();
          
          // If the cleaned result is too short, try to extract just the question
          if (cleaned.length < 5) {
            // Try to find a question mark and extract the sentence
            const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
            if (questionMatch && questionMatch.length > 0) {
              cleaned = questionMatch[questionMatch.length - 1].trim();
            }
          }
          
          return cleaned;
        };

        try {
          const systemPrompt = isChineseStaff
            ? "你是日报助手。绝对禁止输出英文、思考过程、字数统计或标签。只输出纯中文问句。"
            : "あなたは日報アシスタントです。絶対禁止: 英語、思考プロセス、文字数、タグは出力しないでください。純粋な日本語の質問文のみを出力してください。";
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: greetingPrompt },
            ],
          });
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === "string") {
            greetingText = cleanAiResponse(content);
          }
        } catch (e) {
          console.error("Greeting generation error:", e);
        }

        // Add greeting message
        const greetingMessage = await addChatMessage({
          sessionId: session.id,
          role: "ai",
          content: greetingText,
          messageType: "greeting",
          questionCategory: "work_content",
        });

        return { session, messages: [greetingMessage], isNew: true };
      }),

    // Send a message in the chat
    sendMessage: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        content: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        // Save user message
        const userMessage = await addChatMessage({
          sessionId: input.sessionId,
          role: "user",
          content: input.content,
          messageType: "answer",
        });

        // Get session info
        const session = await getChatSessionById(input.sessionId);
        if (!session) throw new Error("Session not found");

        // Get all messages in session
        const allMessages = await getMessagesBySessionId(input.sessionId);
        
        // Get staff profile
        const profile = await getOrCreateStaffAiProfile(session.staffId);

        // Get staff info to determine language
        const staffInfo = await getReportStaffById(session.staffId);
        const isChineseStaff = staffInfo?.country === "中国";

        // Get recent reports for context
        const recentReports = await getRecentReportsByStaffId(session.staffId, 3);

        // Get pending followups
        const pendingFollowups = await getFollowupsByStaffId(session.staffId);
        const pendingItems = pendingFollowups.filter(f => f.followup.status === "pending");

        // Determine what to ask next based on conversation flow
        const userMessages = allMessages.filter(m => m.role === "user");
        const questionCount = userMessages.length;

        // Build context for AI (language based on staff country)
        // Only include context info for the FIRST question, not subsequent ones
        let contextInfo = "";
        if (questionCount === 1) {
          // Only on first response, mention pending items briefly
          if (pendingItems.length > 0) {
            contextInfo += isChineseStaff
              ? `\n待跟进事项: ${pendingItems.map(f => f.followup.extractedItem?.substring(0, 30)).join(", ")}`
              : `\n未完了のフォローアップ: ${pendingItems.map(f => f.followup.extractedItem?.substring(0, 30)).join(", ")}`;
          }
          if (recentReports.length > 0 && recentReports[0].issues) {
            contextInfo += isChineseStaff
              ? `\n上次的问题: ${recentReports[0].issues.substring(0, 50)}`
              : `\n前回の課題: ${recentReports[0].issues.substring(0, 50)}`;
          }
        }
        // After first question, focus on what user is actually talking about

        // Generate next question or summary based on conversation stage
        let systemPrompt = "";
        let userPrompt = "";

        if (questionCount >= 3) {
          // After 3+ messages, offer to summarize or ask if there's more
          systemPrompt = isChineseStaff
            ? `你是日报助手。只输出问句或确认消息，不要包含解释、思考过程、字数统计或标签。`
            : `あなたは日報アシスタントです。質問文または確認メッセージのみを出力してください。説明、思考プロセス、文字数、タグは含めないでください。`;
          userPrompt = isChineseStaff
            ? `之前的对话:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "员工"}: ${m.content}`).join("\n")}
${contextInfo ? `上下文: ${contextInfo}` : ""}

如果还有需要询问的内容请提问，否则请说“好的，我来整理日报吧！”`
            : `これまでの会話:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "スタッフ"}: ${m.content}`).join("\n")}
${contextInfo ? `コンテキスト: ${contextInfo}` : ""}

追加で聞くべきことがあれば質問し、なければ「ありがとうございます！日報をまとめますね。」と言ってください。`
        } else {
          // Continue asking questions
          const questionTopics = [
            "work_content", // 業務内容
            "issues",       // 気づき・課題
            "followup",     // フォローアップ
          ];
          const currentTopic = questionTopics[questionCount] || "followup";
          const topicNameJa = currentTopic === "work_content" ? "他の業務内容" : currentTopic === "issues" ? "気づきや課題" : "フォローアップが必要なこと";
          const topicNameZh = currentTopic === "work_content" ? "其他工作内容" : currentTopic === "issues" ? "发现或问题" : "需要跟进的事项";

          systemPrompt = isChineseStaff
            ? `你是日报助手。绝对禁止输出英文、思考过程、字数统计或标签。只输出纯中文问句。
重要：专注于用户最后一条消息的内容，不要反复询问之前已经讨论过的事项。`
            : `あなたは日報アシスタントです。絶対禁止: 英語、思考プロセス、文字数、タグは出力しないでください。純粋な日本語の質問文のみを出力してください。
重要: ユーザーの最新の回答内容に集中し、既に話した内容を繰り返し聴かないでください。`;
          userPrompt = isChineseStaff
            ? `之前的对话:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "员工"}: ${m.content}`).join("\n")}
${contextInfo ? `上下文: ${contextInfo}` : ""}

用户最后的回答是关于今天的工作。请根据用户的回答内容提问下一个问题，主题是: ${topicNameZh}
不要重复询问之前已经讨论过的内容。`
            : `これまでの会話:
${allMessages.map(m => `${m.role === "ai" ? "AI" : "スタッフ"}: ${m.content}`).join("\n")}
${contextInfo ? `コンテキスト: ${contextInfo}` : ""}

ユーザーの最新の回答は今日の業務についてです。ユーザーの回答内容に基づいて次の質問をしてください。トピック: ${topicNameJa}
既に話した内容を繰り返し聴かないでください。`
        }

        // Helper function to clean AI response from thinking process
        const cleanAiResponse = (text: string): string => {
          // Remove patterns like "(22 characters)", "**Review and Finalize:**", "**Final Output Generation:**"
          let cleaned = text;
          
          // Remove character count patterns
          cleaned = cleaned.replace(/\s*\(\d+\s*characters?\)/gi, "");
          
          // Remove numbered thinking steps with headers
          cleaned = cleaned.replace(/\d+\.\s*\*\*[^*]+\*\*:?[^\n]*\n?/g, "");
          
          // Remove markdown headers like **Review and Finalize:** or **Final Output Generation:**
          cleaned = cleaned.replace(/\*\*[^*]+\*\*:?\s*/g, "");
          
          // Remove lines starting with thinking process indicators
          cleaned = cleaned.replace(/^(Review|Finalize|Output|Generation|Self-correction|Meets|criteria)[^\n]*\n?/gim, "");
          
          // Remove parenthetical notes like (Self-correction: ...)
          cleaned = cleaned.replace(/\([^)]*Self-correction[^)]*\)/gi, "");
          cleaned = cleaned.replace(/\([^)]*criteria[^)]*\)/gi, "");
          
          // Clean up multiple newlines and trim
          cleaned = cleaned.replace(/\n{2,}/g, "\n").trim();
          
          // If the cleaned result is too short, try to extract just the question
          if (cleaned.length < 5) {
            // Try to find a question mark and extract the sentence
            const questionMatch = text.match(/[^\.!\?\n]+[\?？]/g);
            if (questionMatch && questionMatch.length > 0) {
              cleaned = questionMatch[questionMatch.length - 1].trim();
            }
          }
          
          return cleaned;
        };

        let aiResponseText = isChineseStaff ? "还有其他的吗？" : "他に何かありますか？";
        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          });
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === "string") {
            aiResponseText = cleanAiResponse(content);
          }
        } catch (e) {
          console.error("AI response generation error:", e);
        }

        // Save AI response
        const aiMessage = await addChatMessage({
          sessionId: input.sessionId,
          role: "ai",
          content: aiResponseText,
          messageType: questionCount >= 3 ? "summary_prompt" : "question",
          questionCategory: questionCount >= 3 ? "summary" : ["work_content", "issues", "followup"][questionCount] || "followup",
        });

        return { userMessage, aiMessage };
      }),

    // Convert chat session to report
    convertToReport: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getChatSessionById(input.sessionId);
        if (!session) throw new Error("Session not found");

        // Get staff info to determine language
        const staffInfo = await getReportStaffById(session.staffId);
        const isChineseStaff = staffInfo?.country === "中国";

        // Get all user messages
        const userMessages = await getUserMessagesFromSession(input.sessionId);
        const allMessages = await getMessagesBySessionId(input.sessionId);

        // Use AI to summarize into report format (language based on staff country)
        const conversationText = allMessages
          .map(m => `${m.role === "ai" ? "AI" : (isChineseStaff ? "员工" : "スタッフ")}: ${m.content}`)
          .join("\n");

        const summaryPrompt = isChineseStaff
          ? `请根据以下聊天记录创建日报。

对话内容:
${conversationText}

请以以下JSON格式返回:
{
  "workContent": "工作内容（列表形式）",
  "issues": "发现・问题・课题"
}

请用中文简洁地整理。`
          : `以下のチャット会話から日報を作成してください。

会話内容:
${conversationText}

以下のJSON形式で返してください:
{
  "workContent": "業務内容（箇条書き）",
  "issues": "気づき・課題・問題点"
}

日本語で、簡潔にまとめてください。`;

        let workContent = userMessages.map(m => m.content).join("\n");
        let issues = "";

        try {
          const systemPrompt = isChineseStaff
            ? "你是日报创建助手。请将对话内容整理成日报格式。"
            : "あなたは日報作成アシスタントです。会話内容を日報形式にまとめてください。";
          const response = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: summaryPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "report_summary",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    workContent: { type: "string", description: "業務内容" },
                    issues: { type: "string", description: "気づき・課題" },
                  },
                  required: ["workContent", "issues"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = response.choices[0]?.message?.content;
          if (content && typeof content === "string") {
            const parsed = JSON.parse(content);
            workContent = parsed.workContent || workContent;
            issues = parsed.issues || "";
          }
        } catch (e) {
          console.error("Report conversion error:", e);
        }

        // Create the report
        const report = await createReport({
          createdBy: ctx.user.id,
          reportStaffId: session.staffId,
          reportDate: session.reportDate,
          workContent,
          issues,
        });

        // Update session status
        if (report) {
          await updateChatSessionStatus(input.sessionId, "converted", report.id);
        }

        // Record activity log
        await createActivityLog({
          userId: ctx.user.id,
          actionType: "report_create_chat",
          actionLabel: "チャットで日報を作成",
          targetType: "report",
          targetId: report?.id,
          metadata: { sessionId: input.sessionId },
        });

        return { success: true, report };
      }),

    // Get chat session by ID
    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        const session = await getChatSessionById(input.sessionId);
        if (!session) return null;
        const messages = await getMessagesBySessionId(input.sessionId);
        return { session, messages };
      }),

    // Get staff's chat sessions
    getSessionsByStaff: protectedProcedure
      .input(z.object({ staffId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getChatSessionsByStaffId(input.staffId, input.limit || 30);
      }),

    // Get messages for a specific session
    getMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ input }) => {
        return await getMessagesBySessionId(input.sessionId);
      }),

    // Get staff AI profile
    getStaffProfile: protectedProcedure
      .input(z.object({ staffId: z.number() }))
      .query(async ({ input }) => {
        return await getOrCreateStaffAiProfile(input.staffId);
      }),

    // Transcribe voice to text
    transcribeVoice: protectedProcedure
      .input(z.object({
        audioUrl: z.string(),
        language: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await transcribeAudio({
          audioUrl: input.audioUrl,
          language: input.language,
          prompt: input.language === "zh" 
            ? "请将用户的语音转化为文字，这是一份日报内容"
            : "ユーザーの音声をテキストに変換してください。これは日報の内容です",
        });

        // Check if it's an error
        if ("error" in result) {
          throw new Error(result.error);
        }

        return {
          text: result.text,
          language: result.language,
          duration: result.duration,
        };
      }),
  }),

  // LINE Management Router
  line: router({
    listUsers: protectedProcedure.query(async () => {
      return await getAllLineUsers();
    }),

    // Get LINE users linked to livers with liver details
    listLiverLinkedUsers: protectedProcedure.query(async () => {
      return await getLineUsersWithLiverDetails();
    }),

    // Get liver interaction summary
    getLiverInteraction: protectedProcedure
      .input(z.object({ liverId: z.number() }))
      .query(async ({ input }) => {
        return await getLiverInteractionSummary(input.liverId);
      }),

    listGroups: protectedProcedure.query(async () => {
      return await getAllLineGroups();
    }),

    listMessages: protectedProcedure
      .input(
        z.object({
          lineUserId: z.string().optional(),
          lineGroupId: z.string().optional(),
          limit: z.number().optional().default(50),
        })
      )
      .query(async ({ input }) => {
        return await getLineMessages({
          lineUserId: input.lineUserId,
          lineGroupId: input.lineGroupId,
          limit: input.limit,
        });
      }),

    sendMessage: protectedProcedure
      .input(
        z.object({
          to: z.string(),
          message: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const success = await pushMessage(input.to, [
          { type: "text", text: input.message },
        ]);

        if (success) {
          // Save outgoing message to database
          await saveLineMessage({
            messageId: `out_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sourceType: "user",
            lineUserId: input.to,
            messageType: "text",
            content: input.message,
            direction: "outgoing",
          });
        }

        return { success };
      }),

    // Link LINE user to brand/liver
    linkUser: protectedProcedure
      .input(
        z.object({
          lineUserId: z.string(),
          brandId: z.number().nullable().optional(),
          liverId: z.number().nullable().optional(),
          userType: z.enum(["customer", "staff", "liver", "unknown"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        await db
          .update(lineUsers)
          .set({
            brandId: input.brandId ?? null,
            liverId: input.liverId ?? null,
            userType: input.userType,
          })
          .where(eq(lineUsers.lineUserId, input.lineUserId));

        return { success: true };
      }),

    // Get LINE user details with linked brand/liver info
    getUserDetails: protectedProcedure
      .input(z.object({ lineUserId: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const result = await db
          .select()
          .from(lineUsers)
          .where(eq(lineUsers.lineUserId, input.lineUserId))
          .limit(1);

        if (result.length === 0) return null;

        const user = result[0];

        // Get linked brand if exists
        let linkedBrand = null;
        if (user.brandId) {
          const brandResult = await db
            .select()
            .from(brands)
            .where(and(eq(brands.id, user.brandId), isNull(brands.deletedAt)))
            .limit(1);
          linkedBrand = brandResult[0] || null;
        }

        return {
          ...user,
          linkedBrand,
        };
      }),

    // List all follow-ups
    listFollowUps: protectedProcedure.query(async () => {
      return await getAllLineFollowUps();
    }),

    // Create a follow-up
    createFollowUp: protectedProcedure
      .input(
        z.object({
          targetType: z.enum(["user", "group"]),
          lineUserId: z.string().optional(),
          lineGroupId: z.string().optional(),
          triggerCondition: z.enum(["no_reply", "scheduled", "event"]),
          delayHours: z.number().optional().default(72),
          maxAttempts: z.number().optional().default(3),
          messageTemplate: z.string(),
          brandId: z.number().optional(),
          scheduledAt: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const nextScheduled = input.scheduledAt || new Date(Date.now() + input.delayHours * 60 * 60 * 1000);
        
        const result = await createLineFollowUp({
          targetType: input.targetType,
          lineUserId: input.lineUserId,
          lineGroupId: input.lineGroupId,
          triggerCondition: input.triggerCondition,
          delayHours: input.delayHours,
          maxAttempts: input.maxAttempts,
          messageTemplate: input.messageTemplate,
          brandId: input.brandId,
          createdBy: ctx.user.id,
          nextScheduledAt: nextScheduled,
        });
        
        return result;
      }),

    // Cancel a follow-up
    cancelFollowUp: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await updateLineFollowUpStatus(input.id, "cancelled");
        return { success: true };
      }),

    // Leave a LINE group
    leaveGroup: protectedProcedure
      .input(z.object({ lineGroupId: z.string() }))
      .mutation(async ({ input }) => {
        // Call LINE API to leave the group
        const success = await leaveGroup(input.lineGroupId);
        
        if (success) {
          // Update database to mark group as inactive
          const db = await getDb();
          if (db) {
            await db
              .update(lineGroups)
              .set({ isActive: false })
              .where(eq(lineGroups.lineGroupId, input.lineGroupId));
          }
        }
        
        return { success };
      }),

    // Update group auto follow-up settings
    updateGroupAutoFollowUp: protectedProcedure
      .input(
        z.object({
          lineGroupId: z.string(),
          autoFollowUpEnabled: z.boolean().optional(),
          autoFollowUpDays: z.number().min(1).max(30).optional(),
          autoFollowUpMessage: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateLineGroupAutoFollowUp(input.lineGroupId, {
          autoFollowUpEnabled: input.autoFollowUpEnabled,
          autoFollowUpDays: input.autoFollowUpDays,
          autoFollowUpMessage: input.autoFollowUpMessage,
        });
        return { success: true };
      }),

    // Get pending responses (messages that need staff response)
    getPendingResponses: protectedProcedure.query(async () => {
      return await getPendingResponsesForUI();
    }),

    // Mark a pending response as responded (manual)
    markAsResponded: protectedProcedure
      .input(z.object({ lineGroupId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await markMessageResponded(input.lineGroupId, ctx.user.email || "manual");
        return { success: true };
      }),

    // Cancel a pending response (dismiss without responding)
    cancelPendingResponse: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .mutation(async ({ input }) => {
        await cancelPendingResponse(input.messageId);
        return { success: true };
      }),

    // 管理者によるポイント調整（付与・削除）
    adminAdjustPoints: protectedProcedure
      .input(z.object({
        lineUserId: z.string(),
        amount: z.number(), // 正の値=付与、負の値=削除
        description: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { createLinePointTransaction } = await import("./db");
        const type = input.amount >= 0 ? "earn" : "use";
        const result = await createLinePointTransaction({
          lineUserId: input.lineUserId,
          type: type === "earn" ? "earn" : "adjustment",
          amount: input.amount,
          referenceType: "manual",
          description: `[管理者操作] ${input.description}`,
        });
        return { success: true, balanceAfter: result.balanceAfter };
      }),

    // Get member point history (for admin)
    getMemberPointHistory: protectedProcedure
      .input(z.object({ lineUserId: z.string() }))
      .query(async ({ input }) => {
        const pointBalance = await getLinePointBalance(input.lineUserId);
        const transactions = await getLinePointTransactions(input.lineUserId, { limit: 100 });
        
        return {
          balance: pointBalance?.balance || 0,
          lifetimeEarned: pointBalance?.totalEarned || 0,
          lifetimeUsed: pointBalance?.totalUsed || 0,
          transactions,
        };
      }),

    // Get member receipt history (for admin)
    getMemberReceiptHistory: protectedProcedure
      .input(z.object({ lineUserId: z.string() }))
      .query(async ({ input }) => {
        return await getLineReceiptsByUser(input.lineUserId);
      }),
  }),

  // Schedule Management Router
  schedule: router({
    // Get all schedules for a date range
    getByDateRange: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);
        return await getSchedulesByDateRange(startDate, endDate);
      }),

    // Get schedules for a specific date
    getByDate: protectedProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        const date = new Date(input.date);
        return await getSchedulesByDate(date);
      }),

    // Get upcoming schedules
    getUpcoming: protectedProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ input }) => {
        return await getUpcomingSchedules(input.days || 7);
      }),

    // Get schedules by liver name
    getByLiver: protectedProcedure
      .input(
        z.object({
          liverName: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const startDate = input.startDate ? new Date(input.startDate) : undefined;
        const endDate = input.endDate ? new Date(input.endDate) : undefined;
        return await getSchedulesByLiverName(input.liverName, startDate, endDate);
      }),

    // Get schedule by ID (public - for liver pages)
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getScheduleById(input.id);
      }),

    // Create a new schedule
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          startTime: z.string(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          liverId: z.number().optional(),
          liverName: z.string().optional(),
          brandId: z.number().optional(),
          lineGroupId: z.string().optional(),
          isRecurring: z.boolean().optional(),
          recurringPattern: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
          recurringEndDate: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const schedule = await createSchedule({
          title: input.title,
          description: input.description,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : undefined,
          isAllDay: input.isAllDay || false,
          category: input.category || "other",
          liverId: input.liverId,
          liverName: input.liverName,
          brandId: input.brandId,
          lineGroupId: input.lineGroupId,
          isRecurring: input.isRecurring || false,
          recurringPattern: input.recurringPattern,
          recurringEndDate: input.recurringEndDate ? new Date(input.recurringEndDate) : undefined,
          notes: input.notes,
          createdBy: ctx.user.id,
        });
        return schedule;
      }),

    // Update a schedule
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          liverId: z.number().optional(),
          liverName: z.string().optional(),
          brandId: z.number().optional(),
          lineGroupId: z.string().optional(),
          status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
        if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
        if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.liverId !== undefined) updateData.liverId = data.liverId;
        if (data.liverName !== undefined) updateData.liverName = data.liverName;
        if (data.brandId !== undefined) updateData.brandId = data.brandId;
        if (data.lineGroupId !== undefined) updateData.lineGroupId = data.lineGroupId;
        if (data.status !== undefined) updateData.status = data.status;
        if (data.notes !== undefined) updateData.notes = data.notes;
        
        await updateSchedule(id, updateData);
        return { success: true };
      }),

    // Delete a schedule
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSchedule(input.id);
        return { success: true };
      }),

    // Public: Get upcoming schedules (no auth required)
    getPublicUpcoming: publicProcedure
      .input(z.object({ days: z.number().optional() }))
      .query(async ({ input }) => {
        return await getUpcomingSchedules(input.days || 14);
      }),

    // Public: Get schedules by date range (no auth required)
    getPublicByDateRange: publicProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);
        return await getSchedulesByDateRange(startDate, endDate);
      }),

    // Public: Get schedules by liver name (no auth required)
    getPublicByLiver: publicProcedure
      .input(
        z.object({
          liverName: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const startDate = input.startDate ? new Date(input.startDate) : undefined;
        const endDate = input.endDate ? new Date(input.endDate) : undefined;
        return await getSchedulesByLiverName(input.liverName, startDate, endDate);
      }),

    // Public: Get all unique liver names from schedules
    getPublicLiverNames: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const result = await db
          .selectDistinct({ liverName: schedules.liverName })
          .from(schedules)
          .where(and(
            isNotNull(schedules.liverName),
            not(eq(schedules.status, "cancelled"))
          ));
        return result
          .map(r => r.liverName)
          .filter((name): name is string => Boolean(name))
          .sort();
      }),

    // Public: Get all liver names with their DB colors (combines schedules + livers table)
    getPublicLiverNamesWithColors: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        
        // Get all unique liver names from schedules
        const scheduleResult = await db
          .selectDistinct({ liverName: schedules.liverName })
          .from(schedules)
          .where(and(
            isNotNull(schedules.liverName),
            not(eq(schedules.status, "cancelled"))
          ));
        const scheduleNames = new Set(
          scheduleResult
            .map(r => r.liverName)
            .filter((name): name is string => Boolean(name))
        );
        
        // Get all active livers with their colors and uid
        const liversResult = await db
          .selectDistinct({ name: livers.name, color: livers.color, uid: livers.uid })
          .from(livers)
          .where(eq(livers.isActive, true));
        
        // Build color lookup and uid lookup from livers table
        const colorMap = new Map<string, string>();
        const uidMap = new Map<string, string | null>();
        for (const l of liversResult) {
          if (l.name && !colorMap.has(l.name)) {
            colorMap.set(l.name, l.color || '#FF69B4');
            uidMap.set(l.name, l.uid || null);
          }
        }
        
        // Names to exclude (test/dummy accounts)
        const excludeNames = new Set(['Test Liver', '\u30c6\u30b9\u30c8\u30e9\u30a4\u30d0\u30fc', '.', '..', '\u3002', '\u672a\u6307\u5b9a', 'sgkiki']);
        
        // Combine: all names from both sources
        const allNames = new Set<string>();
        scheduleNames.forEach(n => { if (!excludeNames.has(n)) allNames.add(n); });
        for (const l of liversResult) {
          if (l.name && !excludeNames.has(l.name)) {
            allNames.add(l.name);
          }
        }
        
        return Array.from(allNames)
          .map(name => ({ name, color: colorMap.get(name) || null, uid: uidMap.get(name) || null }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      }),

    // Public: Get all active liver names with their colors (lightweight)
    getPublicLiverColors: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const result = await db
          .selectDistinct({ name: livers.name, color: livers.color })
          .from(livers)
          .where(eq(livers.isActive, true));
        const excludeNames = new Set(['Test Liver', '\u30c6\u30b9\u30c8\u30e9\u30a4\u30d0\u30fc', '.', '..', '\u3002', '\u672a\u6307\u5b9a', 'sgkiki']);
        return result
          .filter(r => r.name && !excludeNames.has(r.name))
          .map(r => ({ name: r.name!, color: r.color || '#FF69B4' }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      }),

    // Public: Get schedules by agency code (for agency-specific schedule pages)
    getByAgencyCode: publicProcedure
      .input(
        z.object({
          agencyCode: z.string(),
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        // Find agency by loginId (agencyCode)
        const agencyResult = await db
          .select({ id: agencies.id })
          .from(agencies)
          .where(eq(agencies.loginId, input.agencyCode))
          .limit(1);
        if (agencyResult.length === 0) return [];
        const agencyId = agencyResult[0].id;
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);
        return await getSchedulesByAgency(agencyId, startDate, endDate);
      }),
    // Public: Get liver names with colors by agency code
    getLiverNamesByAgencyCode: publicProcedure
      .input(z.object({ agencyCode: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const agencyResult = await db
          .select({ id: agencies.id })
          .from(agencies)
          .where(eq(agencies.loginId, input.agencyCode))
          .limit(1);
        if (agencyResult.length === 0) return [];
        return await getLiverNamesByAgency(agencyResult[0].id);
      }),
    // Public: Create a schedule (no auth required for public calendar)
    publicCreate: publicProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          startTime: z.string(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          liverName: z.string().min(1),
          notes: z.string().optional(),
          scheduleGroupId: z.number().optional(), // スケジュールグループID
          brandId: z.number().optional(), // ブランドID（後方互換）
          brandIds: z.array(z.number()).optional(), // 複数ブランドID
          locationId: z.number().optional(), // 配信場所ID
        })
      )
      .mutation(async ({ input }) => {
        const schedule = await createSchedule({
          title: input.title,
          description: input.description,
          startTime: new Date(input.startTime),
          endTime: input.endTime ? new Date(input.endTime) : undefined,
          isAllDay: input.isAllDay || false,
          category: input.category || "other",
          liverName: input.liverName,
          notes: input.notes,
          scheduleGroupId: input.scheduleGroupId,
          brandId: input.brandIds?.[0] ?? input.brandId, // 後方互換: 最初のブランドをbrandIdにも保存
          brandIds: input.brandIds,
          locationId: input.locationId,
        });
        return schedule;
      }),

    // Public: Update a schedule (requires matching liverName - uses liver token auth)
    publicUpdate: publicProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          isAllDay: z.boolean().optional(),
          category: z.enum(["delivery", "meeting", "live", "other"]).optional(),
          notes: z.string().optional(),
          updateAll: z.boolean().optional(), // すべての繰り返しを更新するかどうか
          locationId: z.number().nullable().optional(), // 配信場所ID
          brandIds: z.array(z.number()).nullable().optional(), // 複数ブランドID
          liverName: z.string().optional(), // ライバー名で認証（トークンがない場合）
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Get the schedule to check ownership
        const schedule = await getScheduleById(input.id);
        if (!schedule) {
          throw new TRPCError({ code: "NOT_FOUND", message: "予定が見つかりません" });
        }
        
        // Get user name from Manus OAuth, liver token, or input liverName
        let userName: string | null = null;
        
        // 1. Try Manus OAuth user
        if (ctx.user?.name) {
          userName = ctx.user.name;
        }
        
        // 2. Try liver token from Authorization header
        if (!userName) {
          const authHeader = ctx.req.headers.authorization;
          if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            try {
              const secret = new TextEncoder().encode(ENV.cookieSecret);
              const { payload } = await jwtVerify(token, secret);
              if (payload && payload.type === "liver" && payload.liverId) {
                const liver = await getLiverById(payload.liverId as number);
                if (liver) {
                  userName = liver.name;
                }
              }
            } catch {
              // Token verification failed, continue to next method
            }
          }
        }
        
        // 3. Fallback to input liverName (for backward compatibility)
        if (!userName && input.liverName) {
          userName = input.liverName;
        }
        
        if (!userName) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        
        // Check if user owns this schedule or is a staff member
        if (schedule.liverName !== userName) {
          // Check if user is an active staff member (HR staff can edit all schedules)
          const userEmail = ctx.user?.email;
          const isStaffMember = userEmail ? await isActiveStaffByEmail(userEmail) : false;
          if (!isStaffMember) {
            throw new TRPCError({ code: "FORBIDDEN", message: "この予定を編集する権限がありません" });
          }
        }
        
        const { id, updateAll, liverName: _, ...data } = input;
        const updateData: Record<string, unknown> = {};
        
        if (data.title !== undefined) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
        if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);
        if (data.isAllDay !== undefined) updateData.isAllDay = data.isAllDay;
        if (data.category !== undefined) updateData.category = data.category;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if ((input as any).locationId !== undefined) updateData.locationId = (input as any).locationId;
        if (input.brandIds !== undefined) {
          updateData.brandIds = input.brandIds;
          updateData.brandId = input.brandIds?.[0] ?? null; // 後方互換
        }
        
        // すべての繰り返しを更新する場合
        if (updateAll && schedule.parentScheduleId) {
          // 日付以外のフィールドのみ更新（タイトル、説明、カテゴリ、終日フラグなど）
          const recurringUpdateData: Record<string, unknown> = {};
          if (data.title !== undefined) recurringUpdateData.title = data.title;
          if (data.description !== undefined) recurringUpdateData.description = data.description;
          if (data.isAllDay !== undefined) recurringUpdateData.isAllDay = data.isAllDay;
          if (data.category !== undefined) recurringUpdateData.category = data.category;
          if (data.notes !== undefined) recurringUpdateData.notes = data.notes;
          
          await updateRecurringSchedules(schedule.parentScheduleId, recurringUpdateData);
        } else {
          await updateSchedule(id, updateData);
        }
        return { success: true };
      }),

    // Public: Delete a schedule (requires matching liverName - uses liver token auth)
    publicDelete: publicProcedure
      .input(z.object({ 
        id: z.number(),
        deleteAll: z.boolean().optional(), // すべての繰り返しを削除するかどうか
        liverName: z.string().optional(), // ライバー名で認証（トークンがない場合）
      }))
      .mutation(async ({ input, ctx }) => {
        // Get the schedule to check ownership
        const schedule = await getScheduleById(input.id);
        if (!schedule) {
          throw new TRPCError({ code: "NOT_FOUND", message: "予定が見つかりません" });
        }
        
        // Get user name from Manus OAuth, liver token, or input liverName
        let userName: string | null = null;
        
        // 1. Try Manus OAuth user
        if (ctx.user?.name) {
          userName = ctx.user.name;
        }
        
        // 2. Try liver token from Authorization header
        if (!userName) {
          const authHeader = ctx.req.headers.authorization;
          if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.slice(7);
            try {
              const secret = new TextEncoder().encode(ENV.cookieSecret);
              const { payload } = await jwtVerify(token, secret);
              if (payload && payload.type === "liver" && payload.liverId) {
                const liver = await getLiverById(payload.liverId as number);
                if (liver) {
                  userName = liver.name;
                }
              }
            } catch {
              // Token verification failed, continue to next method
            }
          }
        }
        
        // 3. Fallback to input liverName (for backward compatibility)
        if (!userName && input.liverName) {
          userName = input.liverName;
        }
        
        if (!userName) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        
        // Check if user owns this schedule or is a staff member
        if (schedule.liverName !== userName) {
          // Check if user is an active staff member (HR staff can delete all schedules)
          const userEmail = ctx.user?.email;
          const isStaffMember = userEmail ? await isActiveStaffByEmail(userEmail) : false;
          if (!isStaffMember) {
            throw new TRPCError({ code: "FORBIDDEN", message: "この予定を削除する権限がありません" });
          }
        }
        
        // すべての繰り返しを削除する場合
        if (input.deleteAll && schedule.parentScheduleId) {
          await deleteRecurringSchedules(schedule.parentScheduleId);
        } else {
          await deleteSchedule(input.id);
        }
        return { success: true };
      }),
  }),

  // Schedule Group Router (スケジュールグループ管理)
  scheduleGroup: router({
    // Get all schedule groups (public - ログイン不要)
    list: publicProcedure
      .query(async () => {
        return await getAllScheduleGroups();
      }),

    // Get all schedule groups with members (public - ログイン不要)
    listWithMembers: publicProcedure
      .query(async () => {
        return await getAllScheduleGroupsWithMembers();
      }),

    // Get schedule group by ID (public - ログイン不要)
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getScheduleGroupById(input.id);
      }),

    // Get schedule group members (public - ログイン不要)
    getMembers: publicProcedure
      .input(z.object({ groupId: z.number() }))
      .query(async ({ input }) => {
        return await getScheduleGroupMembers(input.groupId);
      }),

    // Create a new schedule group (protected - 管理者のみ)
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await createScheduleGroup({
          name: input.name,
          description: input.description,
          color: input.color || '#3B82F6',
          icon: input.icon,
          sortOrder: input.sortOrder || 0,
        });
        return { id, success: true };
      }),

    // Update a schedule group (protected - 管理者のみ)
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateScheduleGroup(id, data);
        return { success: true };
      }),

    // Delete a schedule group (protected - 管理者のみ)
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteScheduleGroup(input.id);
        return { success: true };
      }),

    // Add a liver to a schedule group (protected - 管理者のみ)
    addMember: protectedProcedure
      .input(
        z.object({
          groupId: z.number(),
          liverId: z.number(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await addLiverToScheduleGroup(
          input.groupId,
          input.liverId,
          input.sortOrder || 0
        );
        return { id, success: true };
      }),

    // Remove a liver from a schedule group (protected - 管理者のみ)
    removeMember: protectedProcedure
      .input(
        z.object({
          groupId: z.number(),
          liverId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await removeLiverFromScheduleGroup(input.groupId, input.liverId);
        return { success: true };
      }),

    // Set all members for a schedule group (protected - 管理者のみ)
    setMembers: protectedProcedure
      .input(
        z.object({
          groupId: z.number(),
          liverIds: z.array(z.number()),
        })
      )
      .mutation(async ({ input }) => {
        await setScheduleGroupMembers(input.groupId, input.liverIds);
        return { success: true };
      }),
  }),

  // Live Suggestion Router (AI配信提案)
  liveSuggestion: router({
    // Get today's schedules with liver info
    getTodaySchedules: protectedProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const todaySchedules = await getTodaySchedulesForSuggestion(input?.date);
        // Group by liverName
        const liverSchedules = new Map<string, typeof todaySchedules>();
        for (const s of todaySchedules) {
          const name = s.liverName || s.title;
          if (!liverSchedules.has(name)) liverSchedules.set(name, []);
          liverSchedules.get(name)!.push(s);
        }
        return {
          schedules: todaySchedules,
          liverCount: liverSchedules.size,
          liverNames: Array.from(liverSchedules.keys()),
        };
      }),

    // Generate AI suggestion for a specific liver
    generateSuggestion: protectedProcedure
      .input(z.object({
        liverName: z.string(),
        scheduleId: z.number().optional(),
        scheduledStartTime: z.string().optional(),
        scheduledEndTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Gather context data for AI (全てtry-catchで囲んでエラー防止)
        let recentStreams: Awaited<ReturnType<typeof getRecentLivestreamDataForSuggestion>> = [];
        let topProducts: Awaited<ReturnType<typeof getTopProductsForSuggestion>> = [];
        let recentSets: Awaited<ReturnType<typeof getRecentSetsForSuggestion>> = [];
        let monthlySummary: Awaited<ReturnType<typeof getLiverMonthlySummaryForSuggestion>> = null;
        let quotaBrands: Awaited<ReturnType<typeof getQuotaBrandsForLiver>> = [];

        // Fetch each data source independently so one failure doesn't block others
        const fetchSafe = async <T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> => {
          try { return await fn(); } catch (e) { console.error(`[LiveSuggestion] ${label} error:`, e); return fallback; }
        };
        [recentStreams, topProducts, recentSets, monthlySummary, quotaBrands] = await Promise.all([
          fetchSafe(() => getRecentLivestreamDataForSuggestion(input.liverName), [], 'recentStreams'),
          fetchSafe(() => getTopProductsForSuggestion(input.liverName), [], 'topProducts'),
          fetchSafe(() => getRecentSetsForSuggestion(input.liverName), [], 'recentSets'),
          fetchSafe(() => getLiverMonthlySummaryForSuggestion(input.liverName), null, 'monthlySummary'),
          fetchSafe(() => getQuotaBrandsForLiver(input.liverName), [], 'quotaBrands'),
        ]);
        console.log(`[LiveSuggestion] Data for ${input.liverName}: streams=${recentStreams.length}, products=${topProducts.length}, sets=${recentSets.length}, monthly=${!!monthlySummary}, brands=${quotaBrands.length}`);

        // Build AI prompt
        const now = new Date();
        const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const todayStr = jstNow.toISOString().split('T')[0];

        let contextInfo = `## ${input.liverName}さんの配信データ\n\n`;
        contextInfo += `### 今日の予定: ${todayStr}\n`;
        if (input.scheduledStartTime) {
          contextInfo += `配信予定時間: ${input.scheduledStartTime}${input.scheduledEndTime ? ` 〜 ${input.scheduledEndTime}` : ''}\n`;
        }

        // 月間実績データ（最重要コンテキスト）
        if (monthlySummary) {
          const cur = monthlySummary.current;
          const prev = monthlySummary.prev;
          contextInfo += `\n### ★月間実績サマリー（売上目標の計算にはこの時間単価をそのまま使うこと）\n`;
          contextInfo += `★今月の時間単価: ¥${cur.hourlyRate.toLocaleString()}（この数値をそのまま使え）\n`;
          contextInfo += `**今月（${monthlySummary.currentMonth}）**: 売上 ¥${cur.sales.toLocaleString()} / ${cur.durationHours}h配信 / 時間単価 ¥${cur.hourlyRate.toLocaleString()} / ${cur.livestreamCount}回配信\n`;
          contextInfo += `**先月（${monthlySummary.prevMonth}）**: 売上 ¥${prev.sales.toLocaleString()} / ${prev.durationHours}h配信 / 時間単価 ¥${prev.hourlyRate.toLocaleString()} / ${prev.livestreamCount}回配信\n`;
          if (prev.hourlyRate > 0) {
            const rateChange = Math.round(((cur.hourlyRate - prev.hourlyRate) / prev.hourlyRate) * 100);
            contextInfo += `時間単価の前月比: ${rateChange >= 0 ? '+' : ''}${rateChange}%\n`;
          }
        }

        if (recentStreams.length > 0) {
          contextInfo += `\n### 直近の配信実績（最新10件）\n`;
          for (const s of recentStreams) {
            const date = s.livestreamDate ? new Date(s.livestreamDate).toLocaleDateString('ja-JP') : '不明';
            const sales = s.salesAmount ? `¥${Number(s.salesAmount).toLocaleString()}` : '¥0';
            const dur = s.duration ? `${s.duration}分` : '不明';
            const brand = s.brandName || '不明';
            contextInfo += `- ${date}: ${brand} / 売上${sales} / ${dur}\n`;
          }
        } else {
          contextInfo += `\n### 直近の配信実績: データなし\n`;
        }

        if (topProducts.length > 0) {
          contextInfo += `\n### ★売れ筋商品TOP${topProducts.length}（提案で使用する商品名はこのリストからのみ選ぶこと。架空の商品名は絶対禁止）\n`;
          for (const p of topProducts) {
            contextInfo += `- 【${p.productName}】: GMV ¥${Number(p.totalGmv).toLocaleString()} / ${p.totalItemsSold}個 / ${p.count}回登場\n`;
          }
        }

        if (recentSets.length > 0) {
          contextInfo += `\n### よく使うセット\n`;
          for (const s of recentSets) {
            contextInfo += `- ${s.name}: GMV ¥${Number(s.totalGmv || 0).toLocaleString()} / ${s.totalItemsSold || 0}個\n`;
          }
        }

        // ノルマありブランド情報（最優先で提案に含める）
        if (quotaBrands.length > 0) {
          contextInfo += `\n### ⚠️ ノルマあり契約ブランド（優先的に配信すべき）\n`;
          for (const qb of quotaBrands) {
            const liverH = qb.liverQuotaMinutes > 0 ? `达人ノルマ: ${Math.round(qb.liverQuotaMinutes / 60 * 10) / 10}h/月` : '';
            const kgH = qb.kgQuotaMinutes > 0 ? `KGノルマ: ${Math.round(qb.kgQuotaMinutes / 60 * 10) / 10}h/月` : '';
            const svQ = qb.shortVideoQuota > 0 ? `短視頻: ${qb.shortVideoQuota}本/月` : '';
            contextInfo += `- **${qb.brandName}**: ${[liverH, kgH, svQ].filter(Boolean).join(' / ')}\n`;
            if (qb.condition) contextInfo += `  条件詳細: ${qb.condition}\n`;
          }
        }

        const systemPrompt = `あなたはTikTokライブコマースの配信コーチです。
ライバーの過去の配信データを分析し、今日の配信の進め方を具体的に提案してください。

提案は以下の形式で書いてください：

1. 🎯 今日の目標
   - 売上目標は「月間実績サマリー」に記載された時間単価の数値をそのまま使って計算すること
   - 例: 時間単価¥39,616で4時間配信なら、売上目標は¥158,464以上
   - 絶対に¥20万などの仮定値を使わないこと
2. 📦 おすすめ商品・セット
   - 「売れ筋商品TOP」に記載された実際の商品名をそのまま引用すること
   - 「ブランドA」「商品B」などの抽象的な表現は禁止
   - ノルマあり契約ブランドの商品を最優先で含めること
3. ⏰ タイムライン提案（配信時間に合わせた具体的な流れ）
4. 💡 ワンポイントアドバイス（時間単価を上げるための具体的な戦略）

【絶対厳守ルール】
- 売上目標の計算には必ず「月間実績サマリー」の時間単価をそのまま使え。¥20万などの仮定値は絶対に使うな
- 商品名は「売れ筋商品TOP」セクションから実際の商品名をコピーして使え。架空の商品名は禁止
- 「ブランドAの〇〇」「スキンケアセット」等の汎用表現は絶対に使うな
- 過去データがない場合のみ一般的なアドバイスを提供
- ノルマ消化のための配信時間配分も提案すること
- 全体で500文字以内に収める`;

        const userPrompt = `以下のデータに基づいて、${input.liverName}さんの今日の配信提案を作成してください。\n\n${contextInfo}`;

        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            maxTokens: 1500,
          });

          const suggestionText = (typeof result.choices?.[0]?.message?.content === 'string' ? result.choices[0].message.content : '') || "提案を生成できませんでした。";

          // Save to DB (even without LINE send)
          try {
            await saveLiveSuggestion({
              targetDate: new Date(),
              liverName: input.liverName,
              liverId: undefined,
              scheduleId: input.scheduleId,
              scheduledStartTime: input.scheduledStartTime ? new Date(`1970-01-01T${input.scheduledStartTime}:00`) : undefined,
              scheduledEndTime: input.scheduledEndTime ? new Date(`1970-01-01T${input.scheduledEndTime}:00`) : undefined,
              suggestionText,
              promptUsed: userPrompt,
              lineSendSuccess: false,
              generatedBy: 'manual-generate',
            });
            console.log(`[LiveSuggestion] Saved suggestion for ${input.liverName} to DB`);
          } catch (saveErr) {
            console.error(`[LiveSuggestion] Failed to save suggestion for ${input.liverName}:`, saveErr);
          }

          return {
            liverName: input.liverName,
            suggestionText,
            promptUsed: userPrompt,
            contextData: {
              recentStreamsCount: recentStreams.length,
              topProductsCount: topProducts.length,
              recentSetsCount: recentSets.length,
              hasMonthlyData: !!monthlySummary,
            },
          };
        } catch (error) {
          console.error("[LiveSuggestion] AI generation error:", error);
          return {
            liverName: input.liverName,
            suggestionText: `${input.liverName}さん、今日も配信頑張りましょう！過去のデータを分析中です。`,
            promptUsed: userPrompt,
            contextData: {
              recentStreamsCount: recentStreams.length,
              topProductsCount: topProducts.length,
              recentSetsCount: recentSets.length,
              hasMonthlyData: !!monthlySummary,
            },
          };
        }
      }),

    // Generate suggestions for all today's livers and send to LINE group
    generateAndSendAll: protectedProcedure
      .input(z.object({
        lineGroupId: z.string(),
        lineGroupName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const todaySchedules = await getTodaySchedulesForSuggestion();
        
        if (todaySchedules.length === 0) {
          return { success: false, message: "今日の配信予定はありません", suggestions: [] };
        }

        // Group schedules by liverName
        const liverScheduleMap = new Map<string, typeof todaySchedules>();
        for (const s of todaySchedules) {
          const name = s.liverName || s.title;
          if (!liverScheduleMap.has(name)) liverScheduleMap.set(name, []);
          liverScheduleMap.get(name)!.push(s);
        }

        const results: Array<{ liverName: string; success: boolean; suggestion: string }> = [];

        const now = new Date();
        const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const todayStr = jstNow.toISOString().split('T')[0];

        // Send header message to group first
        const headerMsg = `\ud83d\udce2 \u3010${todayStr} \u4eca\u65e5\u306e\u914d\u4fe1\u63d0\u6848\u3011\n\n\u4eca\u65e5\u306f${liverScheduleMap.size}\u540d\u304c\u914d\u4fe1\u4e88\u5b9a\uff01\n\u307f\u3093\u306a\u3067\u6700\u9ad8\u306e\u914d\u4fe1\u306b\u3057\u307e\u3057\u3087\u3046\ud83d\udd25`;
        await pushMessage(input.lineGroupId, [{ type: "text", text: headerMsg }]);

        // Generate and send suggestion for each liver individually
        for (const [liverName, liverSchedules] of liverScheduleMap) {
          try {
            const fetchSafe = async <T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> => {
              try { return await fn(); } catch (e) { console.error(`[LiveSuggestion:${liverName}] ${label} error:`, e); return fallback; }
            };
            const [recentStreams, topProducts, recentSets, monthlySummary, quotaBrands] = await Promise.all([
              fetchSafe(() => getRecentLivestreamDataForSuggestion(liverName), [], 'recentStreams'),
              fetchSafe(() => getTopProductsForSuggestion(liverName), [], 'topProducts'),
              fetchSafe(() => getRecentSetsForSuggestion(liverName), [], 'recentSets'),
              fetchSafe(() => getLiverMonthlySummaryForSuggestion(liverName), null, 'monthlySummary'),
              fetchSafe(() => getQuotaBrandsForLiver(liverName), [], 'quotaBrands'),
            ]);
            console.log(`[LiveSuggestion:${liverName}] Data: streams=${recentStreams.length}, products=${topProducts.length}, sets=${recentSets.length}, monthly=${!!monthlySummary}, brands=${quotaBrands.length}`);

            let contextInfo = `## ${liverName}さんの配信データ\n\n`;
            contextInfo += `### 今日の予定\n`;
            for (const s of liverSchedules) {
              const startTime = s.startTime ? new Date(s.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '不明';
              const endTime = s.endTime ? new Date(s.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';
              contextInfo += `- ${startTime}${endTime ? `〜${endTime}` : ''} ${s.title}\n`;
            }

            // 月間実績データ（最重要）
            if (monthlySummary) {
              const cur = monthlySummary.current;
              const prev = monthlySummary.prev;
              contextInfo += `\n### ★月間実績（売上目標にはこの時間単価をそのまま使え）\n`;
              contextInfo += `★今月の時間単価: ¥${cur.hourlyRate.toLocaleString()}（この数値をそのまま使え）\n`;
              contextInfo += `今月: 売上¥${cur.sales.toLocaleString()} / ${cur.durationHours}h / 時間単価¥${cur.hourlyRate.toLocaleString()}\n`;
              contextInfo += `先月: 売上¥${prev.sales.toLocaleString()} / ${prev.durationHours}h / 時間単価¥${prev.hourlyRate.toLocaleString()}\n`;
            }

            if (recentStreams.length > 0) {
              contextInfo += `\n### 直近の配信実績\n`;
              for (const s of recentStreams.slice(0, 5)) {
                const date = s.livestreamDate ? new Date(s.livestreamDate).toLocaleDateString('ja-JP') : '不明';
                const sales = s.salesAmount ? `¥${Number(s.salesAmount).toLocaleString()}` : '¥0';
                contextInfo += `- ${date}: ${s.brandName || '不明'} / 売上${sales}\n`;
              }
            }

            if (topProducts.length > 0) {
              contextInfo += `\n### ★売れ筋商品TOP5（提案で使う商品名はこのリストからのみ。架空の商品名禁止）\n`;
              for (const p of topProducts.slice(0, 5)) {
                contextInfo += `- 【${p.productName}】: ¥${Number(p.totalGmv).toLocaleString()}\n`;
              }
            }

            if (recentSets.length > 0) {
              contextInfo += `\n### よく使うセット\n`;
              for (const s of recentSets.slice(0, 3)) {
                contextInfo += `- ${s.name}\n`;
              }
            }

            // ノルマありブランド情報
            if (quotaBrands.length > 0) {
              contextInfo += `\n### ⚠️ ノルマあり契約ブランド\n`;
              for (const qb of quotaBrands) {
                const liverH = qb.liverQuotaMinutes > 0 ? `达人ノルマ: ${Math.round(qb.liverQuotaMinutes / 60 * 10) / 10}h/月` : '';
                const kgH = qb.kgQuotaMinutes > 0 ? `KGノルマ: ${Math.round(qb.kgQuotaMinutes / 60 * 10) / 10}h/月` : '';
                contextInfo += `- **${qb.brandName}**: ${[liverH, kgH].filter(Boolean).join(' / ')}\n`;
              }
            }

            const systemPrompt = `あなたはTikTokライブコマースの配信コーチです。
ライバーの過去データを分析し、今日の配信提案を作成。

提案形式:
🎯 目標（「月間実績」の時間単価の数値をそのまま使って計算）
📦 おすすめ商品（「売れ筋商品TOP」から実際の商品名をそのまま引用）
⏰ 配信の流れ
💡 アドバイス

【絶対厳守ルール】
- 売上目標は「月間実績」の時間単価をそのまま使え。¥20万などの仮定値は絶対に使うな
- 商品名は「売れ筋商品TOP」から実際の商品名をコピーして使え。「ブランドA」「スキンケアセット」等の汎用表現は絶対禁止
- ノルマありブランドがあればその商品を優先提案
- 簡潔に300文字以内`;

            const userPrompt = `${liverName}さんの今日の配信提案:\n\n${contextInfo}`;

            const result = await invokeLLM({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              maxTokens: 800,
            });

            const suggestionText = (typeof result.choices?.[0]?.message?.content === 'string' ? result.choices[0].message.content : '') || `${liverName}さん、今日も配信頑張りましょう！`;

            // Build schedule time info
            const firstSchedule = liverSchedules[0];
            const startTimeStr = firstSchedule.startTime ? new Date(firstSchedule.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';

            const endTimeStr = firstSchedule.endTime ? new Date(firstSchedule.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';

            // Get lineUserId for mention (from joined livers table)
            const lineUserId = (firstSchedule as any).liverLineUserId || null;

            // 1. Send individual message to GROUP with mention
            const mentionTag = lineUserId ? `@${liverName}` : `👤 ${liverName}`;
            const timeInfo = `（${startTimeStr}${endTimeStr ? `〜${endTimeStr}` : '〜'}）`;
            const msgHeader = `━━━━━━━━━━━━━━━\n${mentionTag}${timeInfo}\n━━━━━━━━━━━━━━━`;
            const fullText = `${msgHeader}\n${suggestionText}`;

            const groupMsg: any = { type: "text", text: fullText };
            if (lineUserId) {
              const mentionIndex = fullText.indexOf(mentionTag);
              groupMsg.mention = {
                mentionees: [{ index: mentionIndex, length: mentionTag.length, userId: lineUserId }],
              };
            }
            const groupSuccess = await pushMessage(input.lineGroupId, [groupMsg]);

            // 2. Send DM to individual liver
            let dmSuccess = false;
            if (lineUserId) {
              const dmText = `📢 【${todayStr} あなたへの配信提案】\n\n${liverName}さん、今日の配信頑張りましょう！\n\n${suggestionText}`;
              dmSuccess = await pushMessage(lineUserId, [{ type: "text", text: dmText }]);
              console.log(`[LiveSuggestion] DM to ${liverName}: ${dmSuccess ? '✅' : '❌'}`);
            }

            // Save to DB
            await saveLiveSuggestion({
              targetDate: new Date(),
              liverName,
              liverId: firstSchedule.liverId ?? undefined,
              scheduleId: firstSchedule.id,
              scheduledStartTime: firstSchedule.startTime ?? undefined,
              scheduledEndTime: firstSchedule.endTime ?? undefined,
              suggestionText,
              promptUsed: userPrompt,
              sentToLineGroupId: input.lineGroupId,
              sentToLineGroupName: input.lineGroupName,
              lineSendSuccess: groupSuccess,
              lineSendError: groupSuccess ? (dmSuccess || !lineUserId ? null : 'DM failed') : 'Group send failed',
              generatedBy: ctx.user?.email || 'system',
            });

            results.push({ liverName, success: groupSuccess, suggestion: suggestionText });

            // Delay to avoid LINE rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`[LiveSuggestion] Error for ${liverName}:`, error);
            results.push({ liverName, success: false, suggestion: 'エラー' });
          }
        }

        // Send header message first (after individual messages, as summary)
        const successCount = results.filter(r => r.success).length;

        return {
          success: successCount > 0,
          message: `${successCount}/${results.length}名のライバーへの配信提案を個別メンション付きでLINEグループに送信しました`,
          suggestions: results,
          lineMessageCount: successCount,
        };
      }),

    // Get suggestion history
    getHistory: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        date: z.string().optional(),
      }))
      .query(async ({ input }) => {
        if (input.date) {
          return await getLiveSuggestionsByDate(new Date(input.date));
        }
        return await getLiveSuggestionHistory(input.limit, input.offset);
      }),

    // Get suggestion history by liver name (for LiverByName page)
    getHistoryByLiverName: publicProcedure
      .input(z.object({
        liverName: z.string(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        const { getLiveSuggestionsByLiverName } = await import("./db");
        return await getLiveSuggestionsByLiverName(input.liverName, input.limit);
      }),

    // Get LINE groups for selection
    getLineGroups: protectedProcedure
      .query(async () => {
        const groups = await getAllLineGroups();
        return groups.filter(g => g.isActive);
      }),

    // 手動トリガー: 自動送信と同じ処理を即座に実行
    triggerAutoSend: protectedProcedure
      .mutation(async () => {
        const { runDailyLiveSuggestion } = await import("./liveSuggestionScheduler");
        await runDailyLiveSuggestion();
        return { success: true, message: "AI配信提案の自動送信を実行しました" };
      }),
    // 1人だけテスト送信
    triggerSingleLiver: protectedProcedure
      .input(z.object({ liverName: z.string() }))
      .mutation(async ({ input }) => {
        const { runSingleLiverSuggestion } = await import("./liveSuggestionScheduler");
        const result = await runSingleLiverSuggestion(input.liverName);
        return result;
      }),
    // デイリーランキング手動トリガー
    triggerDailyRanking: protectedProcedure
      .mutation(async () => {
        const { runDailyRanking } = await import("./dailyRankingScheduler");
        await runDailyRanking();
        return { success: true, message: "デイリーランキングをLINEに送信しました" };
      }),
  }),

  // Liver (Streamer) Authentication Router
  liver: liverRouter,

  // Set Application Router (セット事前申請)
  setApplication: setApplicationRouter,

  // Sample Request Router (サンプル請求)
  sampleRequest: sampleRequestRouter,
  recruitment: recruitmentRouter,
  email: emailRouter,

  // Liver Management Router (ライバー管理画面用)
  liverManagement: router({
    // Get all livers (simple list without stats)
    list: protectedProcedure
      .query(async () => {
        return await getAllLivers();
      }),

    // Get all livers with stats for a given month (public - ログイン不要)
    listWithStats: publicProcedure
      .input(z.object({ month: z.string(), agencyId: z.number().nullable().optional() })) // format: "YYYY-MM", agencyId: null=LCJ only, number=specific agency, undefined=all
      .query(async ({ input }) => {
        return await getLiversWithStats(input.month, input.agencyId);
      }),

    // Get liver rankings (sales and duration) (public - ログイン不要)
    rankings: publicProcedure
      .input(z.object({ month: z.string(), agencyId: z.number().nullable().optional() }))
      .query(async ({ input }) => {
        return await getLiverRankings(input.month, input.agencyId);
      }),

    // Get liver by ID with stats (public - ログイン不要)
    getById: publicProcedure
      .input(z.object({ id: z.number(), month: z.string().optional() }))
      .query(async ({ input }) => {
        const liver = await getLiverById(input.id);
        if (!liver) return null;
        
        const stats = input.month 
          ? await getLiverStatistics(input.id, input.month)
          : null;
        
        return { ...liver, stats };
      }),

    // Get livestreams by liver ID (public - ログイン不要)
    getLivestreams: publicProcedure
      .input(z.object({ liverId: z.number(), month: z.string().optional() }))
      .query(async ({ input }) => {
        return await getLivestreamsByLiverId(input.liverId, input.month);
      }),

    // Get livestream detail by ID (public - ログイン不要)
    getLivestreamDetail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const livestream = await getLivestreamById(input.id);
        if (!livestream) return null;
        
        // Get brand info
        const brand = await getBrandById(livestream.brandId);
        // Get liver info if liverId exists
        const liver = livestream.liverId ? await getLiverById(livestream.liverId) : null;
        
        // Get brand durations (ブランド別配信時間)
        const livestreamBrandsList = await getLivestreamBrandsByLivestreamId(input.id);
        const brandsWithDetails = await Promise.all(
          livestreamBrandsList.map(async (lb) => {
            const brandInfo = await getBrandById(lb.brandId);
            return {
              ...lb,
              brandName: brandInfo?.name || `Brand ${lb.brandId}`,
            };
          })
        );
        
        return { ...livestream, brand, liver, livestreamBrands: brandsWithDetails };
      }),

    // Update livestream result (配信結果の記録)
    updateLivestreamResult: protectedProcedure
      .input(z.object({
        id: z.number(),
        result: z.enum(["成功", "失敗"]).optional(),
        impactFactor: z.enum(["構成", "商品", "ライバー", "広告", "その他"]).optional(),
        resultReason: z.string().optional(),
        screenshotUrl: z.string().optional(),
        screenshotKey: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateLivestreamResult(id, data);
        return { success: true };
      }),

    // Create liver (admin only)
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const bcrypt = await import("bcrypt");
        const hashedPassword = await bcrypt.hash(input.password, 10);
        const id = await createLiver({
          name: input.name,
          email: input.email,
          password: hashedPassword,
          color: input.color || "#FF69B4",
        });
        return { id };
      }),

    // Update liver (admin only)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        color: z.string().optional(),
        isActive: z.boolean().optional(),
        avatarUrl: z.string().optional(),
        avatarKey: z.string().optional(),
        uid: z.string().optional(),
        bio: z.string().optional(),
        tiktokAccount: z.string().optional(),
        instagramAccount: z.string().optional(),
        youtubeAccount: z.string().optional(),
        otherAccount: z.string().optional(),
        lineNotificationEnabled: z.boolean().optional(),
        language: z.enum(['ja', 'zh-TW', 'en']).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateLiver(id, data);
        return { success: true };
      }),

    // Get all livers (for dropdown selection) (public - ログイン不要)
    listAll: publicProcedure.query(async () => {
      return await getAllLivers();
    }),

    // Get total LCJ liver sales summary (public - ログイン不要)
    totalSalesSummary: publicProcedure
      .input(z.object({ month: z.string(), agencyId: z.number().nullable().optional() }))
      .query(async ({ input }) => {
        return await getTotalLiverSalesSummary(input.month, input.agencyId);
      }),

    // Get monthly sales trend for all livers (public - ログイン不要)
    monthlySalesTrend: publicProcedure
      .input(z.object({ agencyId: z.number().nullable().optional() }).optional())
      .query(async ({ input }) => {
        return await getLiverMonthlySalesTrend(input?.agencyId);
      }),

    // Get all livers' monthly trend (全ライバーの月別推移 - スパークライン用)
    allLiversMonthlyTrend: publicProcedure
      .input(z.object({ agencyId: z.number().nullable().optional() }).optional())
      .query(async ({ input }) => {
        return await getAllLiversMonthlyTrend(input?.agencyId);
      }),

    // Get liver detail with stats (ライバー詳細情報)
    getLiverDetail: publicProcedure
      .input(z.object({
        liverId: z.number(),
      }))
      .query(async ({ input }) => {
        return await getLiverDetailWithStats(input.liverId);
      }),

    // Get liver monthly sales trend (ライバーの月別売上推移)
    getLiverSalesTrend: publicProcedure
      .input(z.object({
        liverId: z.number(),
      }))
      .query(async ({ input }) => {
        return await getLiverMonthlySalesTrendById(input.liverId);
      }),

    // Get liver recent livestreams (ライバーの最近の配信履歴)
    getLiverLivestreams: publicProcedure
      .input(z.object({
        liverId: z.number(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        return await getLiverRecentLivestreams(input.liverId, input.limit);
      }),

    // Get liver brand performance (ライバーのブランド別パフォーマンス)
    getLiverBrandPerformance: publicProcedure
      .input(z.object({
        liverId: z.number(),
        month: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await getLiverBrandPerformance(input.liverId, input.month);
      }),

    // Get top selling products by liver (ライバー別売れ筋商品ランキング)
    getTopProducts: publicProcedure
      .input(z.object({
        liverId: z.number(),
        limit: z.number().optional().default(20),
        month: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await getTopProductsByLiver(input.liverId, input.limit, input.month);
      }),

    // Get liver category analysis (ライバー別得意カテゴリ分析)
    getCategoryAnalysis: publicProcedure
      .input(z.object({
        liverId: z.number(),
        month: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await getLiverCategoryAnalysis(input.liverId, input.month);
      }),

    // ===== Product Category Mapping (手動カテゴリ分類) =====
    getProductCategoryMappings: publicProcedure
      .query(async () => {
        return await getAllProductCategoryMappings();
      }),

    getDistinctCategories: publicProcedure
      .query(async () => {
        return await getDistinctMappingCategories();
      }),

    upsertProductCategoryMapping: publicProcedure
      .input(z.object({
        productName: z.string().min(1),
        category: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        return await upsertProductCategoryMapping(input.productName, input.category);
      }),

    bulkUpsertProductCategoryMappings: publicProcedure
      .input(z.object({
        mappings: z.array(z.object({
          productName: z.string().min(1),
          category: z.string().min(1),
        })),
      }))
      .mutation(async ({ input }) => {
        return await bulkUpsertProductCategoryMappings(input.mappings);
      }),

    deleteProductCategoryMapping: publicProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ input }) => {
        return await deleteProductCategoryMapping(input.id);
      }),

    // Create livestream record (配信履歴の記録)
    createLivestream: publicProcedure
      .input(z.object({
        brandId: z.number(),
        brandIds: z.array(z.number()).optional(), // Additional brands (multi-brand support)
        brandDurations: z.record(z.string(), z.number()).optional(), // { brandId: durationMinutes } - 各ブランドへの配信時間（分）
        liverId: z.number(),
        scheduleId: z.number().optional(),
        livestreamDate: z.string(),
        livestreamEndTime: z.string().optional(),
        salesAmount: z.number().optional(),
        // AI解析データフィールド
        viewerCount: z.number().optional(),
        peakViewerCount: z.number().optional(),
        duration: z.number().optional(),
        productClicks: z.number().optional(),
        orderCount: z.number().optional(),
        impressions: z.number().optional(),
        gmv: z.number().optional(),
        cvr: z.string().optional(),
        ctr: z.string().optional(),
        // 配信結果フィールド
        result: z.enum(["成功", "失敗"]).optional(),
        impactFactor: z.enum(["構成", "商品", "ライバー", "広告", "その他"]).optional(),
        resultReason: z.string().optional(),
        remarks: z.string().optional(),
        screenshotUrl: z.string().optional(),
        beforeScreenshotUrl: z.string().optional(), // 配信前スクリーンショットURL（任意）
        manualSalesAmount: z.number().optional(), // 手入力売上金額（任意）
        aiAdvice: z.string().optional(), // AIアドバイスを保存
        // LINE通知用の構造化アドバイス
        structuredAdvice: z.object({
          summary: z.string().optional(),
          goodPoints: z.array(z.string()).optional(),
          improvements: z.array(z.string()).optional(),
          nextActions: z.array(z.object({
            action: z.string(),
            reason: z.string(),
            timing: z.string(),
          })).optional(),
          targetForNextTime: z.string().optional(),
        }).optional(),
        calculatedMetrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
        // セット組みデータ（任意）
        sets: z.array(z.object({
          setName: z.string().min(1),
          setPrice: z.number().min(0),
          quantitySold: z.number().min(1),
          items: z.array(z.object({
            productName: z.string().min(1),
            originalPrice: z.number().min(0),
            quantity: z.number().min(1).default(1),
          })).min(1),
        })).optional(),
        // プロモーション単品割引データ（任意）
        promotions: z.array(z.object({
          productName: z.string().min(1),
          originalPrice: z.number().min(0),
          discountPrice: z.number().min(0),
          quantity: z.number().min(1).default(1),
        })).optional(),
        // ブランド別売上データ（AI解析またはセットデータから集計）
        brandSales: z.record(z.string(), z.number()).optional(), // { brandId: revenue }
        // 配信アカウント（間借り配信）
        streamAccountLiverId: z.number().nullable().optional(), // 配信アカウントの持ち主ライバーID
      }))
      .mutation(async ({ input, ctx }) => {
        // Get liver info for streamerName and LINE notification
        const liver = await getLiverById(input.liverId);
        const streamerName = liver?.name || "不明";
        
        // 構造化アドバイスを永続保存用に変換
        const aiStructuredAdvice = input.structuredAdvice ? {
          summary: input.structuredAdvice.summary || '',
          goodPoints: input.structuredAdvice.goodPoints || [],
          improvements: input.structuredAdvice.improvements || [],
          actionPlans: (input.structuredAdvice.nextActions || []).map(a => ({
            action: a.action,
            reason: a.reason,
            timing: a.timing,
          })),
          nextGoal: input.structuredAdvice.targetForNextTime || '',
          calculatedMetrics: input.calculatedMetrics || {},
        } : undefined;
        
        // Helper function to convert JST datetime-local string to UTC Date
        // datetime-local format: "2025-02-05T04:00" or ISO string (user enters in JST)
        const parseJstToUtc = (dateStr: string): Date => {
          // If already an ISO string with timezone, parse directly
          if (dateStr.includes('+') || dateStr.includes('Z')) {
            return new Date(dateStr);
          }
          // Normalize time parts (e.g. "1:22" -> "01:22")
          let normalized = dateStr;
          const tIdx = normalized.indexOf('T');
          if (tIdx !== -1) {
            const timePart = normalized.substring(tIdx + 1);
            const timeParts = timePart.split(':');
            if (timeParts.length >= 2) {
              const h = timeParts[0].padStart(2, '0');
              const m = timeParts[1].padStart(2, '0');
              const s = timeParts.length >= 3 ? timeParts[2] : '00';
              normalized = normalized.substring(0, tIdx + 1) + `${h}:${m}:${s}`;
            }
          }
          // Ensure seconds are present
          const colonCount = (normalized.match(/:/g) || []).length;
          if (colonCount === 1) {
            normalized += ':00';
          }
          // Append JST timezone offset (+09:00) to treat input as JST
          const isoFormat = normalized + '+09:00';
          const result = new Date(isoFormat);
          if (isNaN(result.getTime())) {
            console.error('[parseJstToUtc] Invalid date:', dateStr, '-> normalized:', isoFormat);
            throw new Error(`Invalid time value: ${dateStr}`);
          }
          return result;
        };
        
        const livestreamResult = await createBrandLivestream({
          brandId: input.brandId,
          liverId: input.liverId,
          scheduleId: input.scheduleId,
          livestreamDate: parseJstToUtc(input.livestreamDate),
          livestreamEndTime: input.livestreamEndTime ? parseJstToUtc(input.livestreamEndTime) : undefined,
          salesAmount: input.salesAmount,
          // AI解析データを保存
          viewerCount: input.viewerCount,
          duration: input.duration,
          productClicks: input.productClicks,
          orderCount: input.orderCount,
          impressions: input.impressions,
          gmv: input.gmv || input.salesAmount, // GMVがない場合はsalesAmountを使用
          cvr: input.cvr,
          ctr: input.ctr,
          // 配信結果フィールド
          result: input.result,
          impactFactor: input.impactFactor,
          resultReason: input.resultReason,
          remarks: input.remarks,
          screenshotUrl: input.screenshotUrl,
          beforeScreenshotUrl: input.beforeScreenshotUrl, // 配信前スクリーンショットURL
          manualSalesAmount: input.manualSalesAmount, // 手入力売上金額
          aiAdvice: input.aiAdvice, // AIアドバイスを保存
          aiStructuredAdvice, // 構造化アドバイスを永続保存
          streamerName,
          createdBy: ctx.user?.id || 0,
          streamAccountLiverId: input.streamAccountLiverId ?? null,
        });
        const id = livestreamResult.id;
        
        // Send LINE notification if liver has LINE connected and notifications enabled
        let lineNotificationSent = false;
        if (liver?.lineUserId && liver?.lineNotificationEnabled !== false) {
          try {
            // Gather enriched data for richer LINE message
            let enrichedData: {
              duration?: number;
              orderCount?: number;
              viewerCount?: number;
              previousSales?: number;
              previousDuration?: number;
              brandBreakdown?: { brandName: string; sales: number; duration?: number }[];
              monthlyGoal?: { salesGoal: number; currentSales: number; achievementRate: number };
            } | null = null;
            
            try {
              // Get previous livestream for comparison
              const { getLiverPreviousLivestream, getLiverMonthlyGoalByName, getBrandById } = await import("./db");
              const prevStream = await getLiverPreviousLivestream(input.liverId, id);
              
              // Get monthly goal progress
              const monthlyGoal = await getLiverMonthlyGoalByName(liver.name);
              
              // Build brand breakdown from brandSales input
              let brandBreakdown: { brandName: string; sales: number; duration?: number }[] = [];
              if (input.brandSales) {
                const brandEntries = Object.entries(input.brandSales);
                for (const [brandIdStr, revenue] of brandEntries) {
                  try {
                    const brand = await getBrandById(Number(brandIdStr));
                    brandBreakdown.push({
                      brandName: brand?.name || `Brand ${brandIdStr}`,
                      sales: revenue as number,
                    });
                  } catch {
                    brandBreakdown.push({ brandName: `Brand ${brandIdStr}`, sales: revenue as number });
                  }
                }
              }
              
              enrichedData = {
                duration: input.duration || undefined,
                orderCount: input.orderCount || undefined,
                viewerCount: input.viewerCount || undefined,
                previousSales: prevStream?.salesAmount || undefined,
                previousDuration: prevStream?.duration || undefined,
                brandBreakdown: brandBreakdown.length > 0 ? brandBreakdown : undefined,
                monthlyGoal: monthlyGoal ? {
                  salesGoal: monthlyGoal.salesGoal,
                  currentSales: monthlyGoal.currentSales,
                  achievementRate: monthlyGoal.achievementRate,
                } : undefined,
                livestreamId: id,
                sets: (input.sets || []).map((s: any) => ({
                  setName: s.setName,
                  setPrice: s.setPrice,
                  quantitySold: s.quantitySold,
                  items: (s.items || []).map((item: any) => ({
                    productName: item.productName,
                    originalPrice: item.originalPrice,
                    quantity: item.quantity || 1,
                  })),
                })),
              };
            } catch (enrichErr) {
              console.error("[LINE Coaching] Failed to gather enriched data:", enrichErr);
            }
            
            const result = await sendCoachingToLiver(
              liver.lineUserId,
              liver.name,
              input.salesAmount || 0,
              input.structuredAdvice || null,
              input.calculatedMetrics as Record<string, string | number> | null | undefined,
              input.aiAdvice,
              enrichedData
            );
            lineNotificationSent = result.success;
            if (!result.success) {
              console.error("[LINE Coaching] Failed to send:", result.error);
            }
          } catch (error) {
            console.error("[LINE Coaching] Exception:", error);
          }
        }
        
        // Record edit log with full data for recovery
        try {
          const dateStr = new Date(input.livestreamDate).toLocaleDateString('ja-JP');
          await logBrandEdit(
            input.brandId,
            "create",
            "livestream",
            id,
            `${dateStr} ${streamerName}`,
            `ライブ配信を追加：${dateStr} ${streamerName}`,
            ctx.user?.id || 0,
            ctx.user?.name || ctx.user?.email || 'liver',
            undefined,
            JSON.stringify(livestreamResult)
          );
        } catch (logError) {
          console.error('[logBrandEdit] Failed to log create:', logError);
        }
        
        // セット組みデータの保存
        if (input.sets && input.sets.length > 0) {
          for (let i = 0; i < input.sets.length; i++) {
            const set = input.sets[i];
            const totalOriginalPrice = set.items.reduce((sum, item) => sum + item.originalPrice * (item.quantity || 1), 0);
            const discountRate = totalOriginalPrice > 0
              ? Math.round(((totalOriginalPrice - set.setPrice) / totalOriginalPrice) * 100)
              : 0;
            const totalRevenue = set.setPrice * set.quantitySold;
            
            const setResult = await createLivestreamSet({
              livestreamId: id,
              setName: set.setName,
              setPrice: set.setPrice,
              quantitySold: set.quantitySold,
              totalOriginalPrice,
              discountRate,
              totalRevenue,
              sortOrder: i,
            });
            
            const setId = (setResult as any)[0]?.insertId;
            if (setId) {
              for (let j = 0; j < set.items.length; j++) {
                await createLivestreamSetItem({
                  setId,
                  productName: set.items[j].productName,
                  originalPrice: set.items[j].originalPrice,
                  quantity: set.items[j].quantity || 1,
                  sortOrder: j,
                });
              }
            }
          }
        }

        // プロモーション単品割引データの保存
        if (input.promotions && input.promotions.length > 0) {
          for (let i = 0; i < input.promotions.length; i++) {
            const promo = input.promotions[i];
            const discountRate = promo.originalPrice > 0
              ? Math.round(((promo.originalPrice - promo.discountPrice) / promo.originalPrice) * 100)
              : 0;
            const totalRevenue = promo.discountPrice * promo.quantity;
            
            await createLivestreamPromotion({
              livestreamId: id,
              productName: promo.productName,
              originalPrice: promo.originalPrice,
              discountPrice: promo.discountPrice,
              quantity: promo.quantity,
              discountRate,
              totalRevenue,
              sortOrder: i,
            });
          }
        }
        
        // Save multiple brands to livestream_brands junction table
        const allBrandIds = new Set<number>([input.brandId]);
        if (input.brandIds && input.brandIds.length > 0) {
          input.brandIds.forEach(bid => allBrandIds.add(bid));
        }
        for (const bid of allBrandIds) {
          try {
            const dur = input.brandDurations?.[bid.toString()];
            await createLivestreamBrand({ livestreamId: id, brandId: bid, durationMinutes: dur ?? null });
          } catch (e) {
            console.error('[createLivestreamBrand] Failed:', e);
          }
        }
        
        // AIコーチ自動質問生成（非同期、レスポンスをブロックしない）
        if (input.liverId) {
          (async () => {
            try {
              const db2 = await getDb();
              if (!db2) return;

              // デフォルトルームを取得 or 作成（神コーチメッセージをルームに紐付けるため）
              let defaultRoomId: number | null = null;
              const existingRooms = await db2
                .select()
                .from(aiCoachRooms)
                .where(and(eq(aiCoachRooms.liverId, input.liverId), isNull(aiCoachRooms.deletedAt)))
                .orderBy(desc(aiCoachRooms.lastMessageAt))
                .limit(1);
              if (existingRooms.length > 0) {
                defaultRoomId = existingRooms[0].id;
              } else {
                // ルームがない場合は自動作成
                const [newRoom] = await db2.insert(aiCoachRooms).values({
                  liverId: input.liverId,
                  title: '配信フィードバック',
                });
                defaultRoomId = (newRoom as any).insertId;
                console.log(`[AI Coach] Created default room ${defaultRoomId} for liver ${input.liverId}`);
              }

              // Collect livestream data for AI context
              const salesAmount = input.salesAmount || 0;
              const duration = input.duration || 0;
              const hourlyRate = duration > 0 ? Math.round(salesAmount / (duration / 60)) : 0;
              const viewerCount = input.viewerCount || 0;
              const orderCount = input.orderCount || 0;
              
              // Get sets info
              const setsInfo = (input.sets || []).map((s: any) => 
                `${s.setName}: ¥${s.setPrice.toLocaleString()} × ${s.quantitySold}個 = ¥${(s.setPrice * s.quantitySold).toLocaleString()}`
              ).join('\n');
              
              // Get recent monthly stats for context
              const recentStats = await getLiverMonthlySalesTrendById(input.liverId, 3);
              const statsContext = recentStats.map((s: any) => 
                `${s.month}: 売上¥${Number(s.totalSales || 0).toLocaleString()}, ${Number(s.totalDuration || 0).toFixed(1)}h, 時間単価¥${Number(s.totalDuration || 0) > 0 ? Math.round(Number(s.totalSales || 0) / Number(s.totalDuration || 0) * 60).toLocaleString() : '0'}`
              ).join('\n');
              
              const liverName = liver?.name || 'ライバー';
              const dateStr = new Date(input.livestreamDate).toLocaleDateString('ja-JP');
              
              const systemPrompt = `あなたは「LCJ 神コーチ」です。ライブコマースの専門AIコーチとして、ライバーの成長を全力でサポートします。

性格:
- 熱血だが的確。褒めるところは全力で褒め、改善点は具体的に指摘する
- フレンドリーで親しみやすい口調（「〜だね！」「すごい！」など）
- 必ず具体的な数字を引用してフィードバックする（売上額、時間単価、セット販売数、前月比など）
- ライバーのモチベーションを上げることを最優先にする

ルール:
- 必ず日本語で回答する
- 最初に配信データの数字を引用して具体的に評価する（例：「売上¥300万、67セット販売は素晴らしい！時間単価¥15万超えてるね」）
- 次に数字に基づいた改善ポイントを1つ指摘する（例：「配信時間が0分記録 → 正確に記録すれば時間単価の推移が見えるよ」）
- 最後に1つだけ具体的な質問をする（ライバーの振り返りを促す）
- 数字のない抽象的な褒め言葉は禁止（「すごいですね」だけはNG、必ず「¥○○の売上すごい」のように数字付き）
- 300文字以内で簡潔に`;
              
              const userPrompt = `${liverName}さんが${dateStr}の配信データを記録しました。フィードバックと質問をしてください。

【配信データ】
売上: ¥${salesAmount.toLocaleString()}
配信時間: ${duration}分
時間単価: ¥${hourlyRate.toLocaleString()}/h
視聴者数: ${viewerCount}
注文数: ${orderCount}
${setsInfo ? `\n【セット組み】\n${setsInfo}` : ''}
${statsContext ? `\n【直近の月別実績】\n${statsContext}` : ''}
${enrichedData?.monthlyGoal ? `\n【月間目標】\n目標: ¥${enrichedData.monthlyGoal.salesGoal.toLocaleString()} / 達成: ¥${enrichedData.monthlyGoal.currentSales.toLocaleString()} (${enrichedData.monthlyGoal.achievementRate}%)` : ''}`;
              
              const aiResult = await invokeLLM({
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
                maxTokens: 300,
              });
              
              const aiContent = typeof aiResult.choices?.[0]?.message?.content === 'string'
                ? aiResult.choices[0].message.content
                : null;
              
              if (aiContent) {
                await db2.insert(aiCoachMessages).values({
                  liverId: input.liverId,
                  roomId: defaultRoomId,
                  role: 'ai',
                  content: aiContent,
                  messageType: 'auto_question',
                  contextType: 'livestream',
                  contextId: id,
                  metadata: {
                    livestreamId: id,
                    salesAmount,
                    duration,
                    hourlyRate,
                    viewerCount,
                    orderCount,
                    date: dateStr,
                  },
                });
                // ルームのlastMessageAtを更新
                if (defaultRoomId) {
                  await db2.update(aiCoachRooms).set({ lastMessageAt: new Date() }).where(eq(aiCoachRooms.id, defaultRoomId));
                }
                console.log(`[AI Coach] Auto question generated for liver ${input.liverId} in room ${defaultRoomId}`);
              }
            } catch (err) {
              console.error('[AI Coach] Failed to generate auto question:', err);
            }
          })();
        }
        
        // ★ LINEグループへの配信記録登録通知（非同期、レスポンスをブロックしない）
        (async () => {
          try {
            const { pushMessage } = await import("./line");
            const db3 = await getDb();
            if (!db3) return;

            // 送信先グループを取得（ライバー連絡網）
            const TARGET_KEYWORDS = ["ライバー連絡網", "LCJ所属"];
            let targetGroupId: string | null = null;
            for (const keyword of TARGET_KEYWORDS) {
              const groups = await db3
                .select({ lineGroupId: lineGroups.lineGroupId })
                .from(lineGroups)
                .where(
                  and(
                    like(lineGroups.groupName, `%${keyword}%`),
                    eq(lineGroups.isActive, true)
                  )
                )
                .limit(1);
              if (groups.length > 0 && groups[0].lineGroupId) {
                targetGroupId = groups[0].lineGroupId;
                break;
              }
            }
            if (!targetGroupId) {
              console.log('[LINE Group Notify] No target group found');
              return;
            }

            // ブランド別配信時間を取得
            const brandDurationsData = input.brandDurations || {};
            const allBrandIdsForNotify = new Set<number>([input.brandId]);
            if (input.brandIds) input.brandIds.forEach(bid => allBrandIdsForNotify.add(bid));
            
            // ブランド名を取得
            const brandNames: Record<number, string> = {};
            for (const bid of allBrandIdsForNotify) {
              const brand = await db3.select({ name: brands.name, nameJa: brands.nameJa }).from(brands).where(eq(brands.id, bid)).limit(1);
              if (brand.length > 0) brandNames[bid] = brand[0].nameJa || brand[0].name || `Brand#${bid}`;
            }

            // 配信時間のフォーマット
            const durationMin = input.duration || 0;
            const hours = Math.floor(durationMin / 60);
            const mins = durationMin % 60;
            const durationStr = hours > 0 ? `${hours}時間${mins > 0 ? mins + '分' : ''}` : `${mins}分`;

            // 時間単価
            const salesAmt = input.salesAmount || 0;
            const hourlyRate = durationMin > 0 ? Math.round(salesAmt / (durationMin / 60)) : 0;

            // 配信日時のフォーマット
            const dateObj = new Date(input.livestreamDate);
            const jstDate = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);
            const dateStr = `${jstDate.getMonth() + 1}/${jstDate.getDate()}`;
            const timeStr = `${String(jstDate.getHours()).padStart(2,'0')}:${String(jstDate.getMinutes()).padStart(2,'0')}`;

            // ブランド別配信時間テキスト（売上付き）
            const brandSalesData = input.brandSales || {};
            let brandDurationText = '';
            for (const bid of allBrandIdsForNotify) {
              const bName = brandNames[bid] || `Brand#${bid}`;
              const bDur = brandDurationsData[bid.toString()];
              const bSales = brandSalesData[bid.toString()];
              let line = `\n  📌 ${bName}:`;
              if (bDur) {
                const bH = Math.floor(bDur / 60);
                const bM = bDur % 60;
                line += ` ${bH > 0 ? bH + 'h' : ''}${bM > 0 ? bM + 'm' : ''}`;
              }
              if (bSales && bSales > 0) {
                line += ` | ¥${bSales.toLocaleString()}`;
                if (salesAmt > 0) {
                  const pct = Math.round((bSales / salesAmt) * 100);
                  line += ` (${pct}%)`;
                }
              }
              brandDurationText += line;
            }
            // ブランド別売上がない場合、セットデータから推定を試みる（アプローチ1）
            if (Object.keys(brandSalesData).length === 0 && input.sets && input.sets.length > 0) {
              // セット内の商品名からブランドを推定
              const estimatedBrandSales: Record<number, number> = {};
              for (const set of input.sets) {
                const setRevenue = set.setPrice * set.quantitySold;
                // セット名または商品名からブランドを探す
                for (const [bidStr, bName] of Object.entries(brandNames)) {
                  const bid = parseInt(bidStr);
                  const nameToMatch = bName.toLowerCase();
                  const setNameLower = set.setName.toLowerCase();
                  const hasMatch = setNameLower.includes(nameToMatch) ||
                    set.items.some(item => item.productName.toLowerCase().includes(nameToMatch));
                  if (hasMatch) {
                    estimatedBrandSales[bid] = (estimatedBrandSales[bid] || 0) + setRevenue;
                  }
                }
              }
              // 推定売上があればテキストを再構築
              if (Object.keys(estimatedBrandSales).length > 0) {
                brandDurationText = '';
                for (const bid of allBrandIdsForNotify) {
                  const bName = brandNames[bid] || `Brand#${bid}`;
                  const bDur = brandDurationsData[bid.toString()];
                  const bSales = estimatedBrandSales[bid];
                  let line = `\n  📌 ${bName}:`;
                  if (bDur) {
                    const bH = Math.floor(bDur / 60);
                    const bM = bDur % 60;
                    line += ` ${bH > 0 ? bH + 'h' : ''}${bM > 0 ? bM + 'm' : ''}`;
                  }
                  if (bSales && bSales > 0) {
                    line += ` | ¥${bSales.toLocaleString()} (セット分)`;
                  }
                  brandDurationText += line;
                }
              }
            }

            // セット内訳テキストを構築
            let setDetailText = '';
            if (input.sets && input.sets.length > 0) {
              const totalSetQuantity = input.sets.reduce((sum, s) => sum + s.quantitySold, 0);
              const totalSetRevenue = input.sets.reduce((sum, s) => sum + (s.setPrice * s.quantitySold), 0);
              setDetailText = `\n\n📦 セット内訳:`;
              for (const set of input.sets) {
                const setRevenue = set.setPrice * set.quantitySold;
                const originalTotal = set.items.reduce((sum, item) => sum + (item.originalPrice * (item.quantity || 1)), 0);
                const discountPct = originalTotal > 0 ? Math.round((1 - set.setPrice / originalTotal) * 100) : 0;
                const priceStr = originalTotal > 0 && discountPct > 0 ? `\n定価¥${originalTotal.toLocaleString()} → ¥${set.setPrice.toLocaleString()} (${discountPct}%OFF)` : `\n¥${set.setPrice.toLocaleString()}`;
                setDetailText += `\n\n【${set.setName}】${priceStr}\n`;
                let setItemCount = 0;
                for (const item of set.items) {
                  const qty = item.quantity || 1;
                  setItemCount += qty;
                  setDetailText += `\n■ ${item.productName} ${qty}個`;
                }
                setDetailText += `\n合計 ${setItemCount}点`;
                setDetailText += `\n\n販売数 ${set.quantitySold}セット / 売上 ¥${setRevenue.toLocaleString()}`;
              }
            }

            // テキストメッセージを構築
            const notifyText = `━━━━━━━━━━━━━━━\n📊 配信記録登録\n━━━━━━━━━━━━━━━\n👤 ${streamerName}\n📅 ${dateStr} ${timeStr}〜\n⏰ 配信時間: ${durationStr}\n💰 売上: ¥${salesAmt.toLocaleString()}\n📈 時間単価: ¥${hourlyRate.toLocaleString()}/h${brandDurationText ? '\n\n🏷️ ブランド別実績:' + brandDurationText : ''}${setDetailText}\n━━━━━━━━━━━━━━━`;

            const messages: any[] = [{ type: 'text', text: notifyText }];

            // スクリーンショットがある場合は画像も送信
            if (input.screenshotUrl) {
              messages.push({
                type: 'image',
                originalContentUrl: input.screenshotUrl,
                previewImageUrl: input.screenshotUrl,
              });
            }

            const success = await pushMessage(targetGroupId, messages.slice(0, 5));
            console.log(`[LINE Group Notify] Sent for ${streamerName}: success=${success}`);
          } catch (err) {
            console.error('[LINE Group Notify] Error:', err);
          }
        })();

        // ★ 配信記録をai_coach_messagesに保存（ライバー成長ダッシュボード用）
        if (input.liverId) {
          (async () => {
            try {
              const db4 = await getDb();
              if (!db4) return;

              // デフォルトルームを取得
              let roomId: number | null = null;
              const rooms = await db4
                .select({ id: aiCoachRooms.id })
                .from(aiCoachRooms)
                .where(and(eq(aiCoachRooms.liverId, input.liverId), isNull(aiCoachRooms.deletedAt)))
                .orderBy(desc(aiCoachRooms.lastMessageAt))
                .limit(1);
              if (rooms.length > 0) roomId = rooms[0].id;

              // 配信記録テキストを構築
              const durationMin = input.duration || 0;
              const hours = Math.floor(durationMin / 60);
              const mins = durationMin % 60;
              const durationStr = hours > 0 ? `${hours}時間${mins > 0 ? mins + '分' : ''}` : `${mins}分`;
              const salesAmt = input.salesAmount || 0;
              const hourlyRate = durationMin > 0 ? Math.round(salesAmt / (durationMin / 60)) : 0;
              const dateObj = new Date(input.livestreamDate);
              const jstDate = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);
              const dateStr = `${jstDate.getMonth() + 1}/${jstDate.getDate()}`;
              const timeStr = `${String(jstDate.getHours()).padStart(2,'0')}:${String(jstDate.getMinutes()).padStart(2,'0')}`;

              let recordText = `📊 配信記録登録\n━━━━━━━━━━━━━━━\n👤 ${streamerName}\n📅 ${dateStr} ${timeStr}〜\n⏰ 配信時間: ${durationStr}\n💰 売上: ¥${salesAmt.toLocaleString()}\n📈 時間単価: ¥${hourlyRate.toLocaleString()}/h`;

              // セット内訳
              if (input.sets && input.sets.length > 0) {
                recordText += `\n\n📦 セット内訳:`;
                for (const set of input.sets) {
                  const setRevenue = set.setPrice * set.quantitySold;
                  recordText += `\n【${set.setName}】 ¥${set.setPrice.toLocaleString()} × ${set.quantitySold}セット = ¥${setRevenue.toLocaleString()}`;
                  for (const item of set.items) {
                    recordText += `\n  ■ ${item.productName} ${item.quantity || 1}個`;
                  }
                }
              }

              await db4.insert(aiCoachMessages).values({
                liverId: input.liverId,
                roomId,
                role: 'ai',
                content: recordText,
                messageType: 'stream_record',
                contextType: 'livestream',
                contextId: id,
                metadata: {
                  type: 'stream_record',
                  livestreamId: id,
                  salesAmount: salesAmt,
                  duration: durationMin,
                  hourlyRate,
                  date: dateStr,
                  time: timeStr,
                  sets: input.sets || [],
                  brandDurations: input.brandDurations || {},
                  brandSales: input.brandSales || {},
                },
              });
              console.log(`[Growth Dashboard] Stream record saved for liver ${input.liverId}`);
            } catch (err) {
              console.error('[Growth Dashboard] Failed to save stream record:', err);
            }
          })();
        }

        return { id, lineNotificationSent };
      }),
    // Update livestream (配信履歴の編集) - public for liver self-servicee
    updateLivestream: publicProcedure
      .input(z.object({
        id: z.number(),
        brandId: z.number().optional(),
        livestreamDate: z.string().optional(),
        livestreamEndTime: z.string().optional().nullable(),
        salesAmount: z.number().optional().nullable(),
        viewerCount: z.number().optional().nullable(),
        duration: z.number().optional().nullable(),
        productClicks: z.number().optional().nullable(),
        orderCount: z.number().optional().nullable(),
        result: z.enum(["成功", "失敗"]).optional().nullable(),
        impactFactor: z.enum(["構成", "商品", "ライバー", "広告", "その他"]).optional().nullable(),
        resultReason: z.string().optional().nullable(),
        remarks: z.string().optional().nullable(),
        screenshotUrl: z.string().optional().nullable(),
        aiAdvice: z.string().optional().nullable(), // AIアドバイスを更新
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        
        // Helper function to convert JST datetime-local string to UTC Date
        // datetime-local format: "2025-02-05T04:00" or ISO string (user enters in JST)
        const parseJstToUtc = (dateStr: string): Date => {
          // If already an ISO string with timezone, parse directly
          if (dateStr.includes('+') || dateStr.includes('Z')) {
            return new Date(dateStr);
          }
          // Normalize time parts (e.g. "1:22" -> "01:22")
          let normalized = dateStr;
          const tIdx = normalized.indexOf('T');
          if (tIdx !== -1) {
            const timePart = normalized.substring(tIdx + 1);
            const timeParts = timePart.split(':');
            if (timeParts.length >= 2) {
              const h = timeParts[0].padStart(2, '0');
              const m = timeParts[1].padStart(2, '0');
              const s = timeParts.length >= 3 ? timeParts[2] : '00';
              normalized = normalized.substring(0, tIdx + 1) + `${h}:${m}:${s}`;
            }
          }
          // Ensure seconds are present
          const colonCount = (normalized.match(/:/g) || []).length;
          if (colonCount === 1) {
            normalized += ':00';
          }
          // Append JST timezone offset (+09:00) to treat input as JST
          const isoFormat = normalized + '+09:00';
          const result = new Date(isoFormat);
          if (isNaN(result.getTime())) {
            console.error('[parseJstToUtc] Invalid date:', dateStr, '-> normalized:', isoFormat);
            throw new Error(`Invalid time value: ${dateStr}`);
          }
          return result;
        };
        
        if (data.brandId !== undefined) updateData.brandId = data.brandId;
        if (data.livestreamDate !== undefined) {
          updateData.livestreamDate = parseJstToUtc(data.livestreamDate);
          console.log('[updateLivestream] Input JST:', data.livestreamDate, '-> UTC:', updateData.livestreamDate);
        }
        if (data.livestreamEndTime !== undefined) {
          updateData.livestreamEndTime = data.livestreamEndTime ? parseJstToUtc(data.livestreamEndTime) : null;
          console.log('[updateLivestream] End Input JST:', data.livestreamEndTime, '-> UTC:', updateData.livestreamEndTime);
        }
        if (data.salesAmount !== undefined) updateData.salesAmount = data.salesAmount;
        if (data.viewerCount !== undefined) updateData.viewerCount = data.viewerCount;
        if (data.duration !== undefined) updateData.duration = data.duration;
        if (data.productClicks !== undefined) updateData.productClicks = data.productClicks;
        if (data.orderCount !== undefined) updateData.orderCount = data.orderCount;
        if (data.result !== undefined) updateData.result = data.result;
        if (data.impactFactor !== undefined) updateData.impactFactor = data.impactFactor;
        if (data.resultReason !== undefined) updateData.resultReason = data.resultReason;
        if (data.remarks !== undefined) updateData.remarks = data.remarks;
        if (data.screenshotUrl !== undefined) updateData.screenshotUrl = data.screenshotUrl;
        if (data.aiAdvice !== undefined) updateData.aiAdvice = data.aiAdvice;
        
        await updateBrandLivestream(id, updateData);
        return { success: true };
      }),

    // Delete livestream (配信履歴の削除)
    deleteLivestream: publicProcedure
      .input(z.object({ id: z.number(), liverId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        // Get existing livestream for logging before deletion
        const existingLivestream = await getLivestreamById(input.id);
        
        // 商品別GMVも削除
        await deleteLivestreamProductsByLivestreamId(input.id);
        await deleteBrandLivestream(input.id);
        
        // Record edit log
        if (existingLivestream) {
          const dateStr = existingLivestream.livestreamDate 
            ? new Date(existingLivestream.livestreamDate).toLocaleDateString('ja-JP')
            : '不明';
          // Determine user info from context or liver token
          let userId = 0;
          let userName = 'ライバー管理';
          if (ctx.user) {
            userId = ctx.user.id;
            userName = ctx.user.name || ctx.user.email;
          } else if (input.liverId) {
            userId = input.liverId;
            userName = `Liver:${input.liverId}`;
          }
          await logBrandEdit(
            existingLivestream.brandId,
            "delete",
            "livestream",
            input.id,
            `${dateStr} ${existingLivestream.streamerName}`,
            `ライブ配信を削除：${dateStr} ${existingLivestream.streamerName} (GMV: ¥${existingLivestream.gmv || 0})`,
            userId,
            userName
          );
        }
        
        return { success: true };
      }),

    // Upload screenshot for livestream
    uploadScreenshot: publicProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
        liverId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.filename.split(".").pop() || "png";
        const timestamp = Date.now();
        const key = `livestreams/${input.liverId || 'unknown'}/${timestamp}-${nanoid()}.${ext}`;
        const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        
        try {
          const { url } = await storagePut(key, buffer, contentType);
          return { url, key };
        } catch (uploadErr) {
          console.error('[uploadScreenshot] Storage upload failed (returning empty url):', uploadErr);
          return { url: "", key: "" };
        }
      }),

    // Analyze screenshot to extract livestream data
    analyzeScreenshot: rateLimitedPublicProcedure
      .input(z.object({
        imageUrl: z.string().optional(),
        imageBase64: z.string().optional(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Determine image source - prefer base64 for reliability
        let imageContent: { type: "image_url"; image_url: { url: string; detail: "high" } };
        
        if (input.imageBase64) {
          // Use base64 data URL for direct image data
          const mimeType = input.mimeType || "image/png";
          imageContent = {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${input.imageBase64}`,
              detail: "high",
            },
          };
        } else if (input.imageUrl) {
          // Fallback to URL (may not work with all AI models)
          imageContent = {
            type: "image_url",
            image_url: {
              url: input.imageUrl,
              detail: "high",
            },
          };
        } else {
          throw new Error("Either imageUrl or imageBase64 must be provided");
        }
        const systemPrompt = `あなたはTikTokライブ配信のダッシュボードスクリーンショットを解析するエキスパートです。
【最重要】画像内の数値を正確に読み取ってください。数値が見える場合は必ず抽出してください。

## TikTok LIVEダッシュボードのレイアウト詳細

### 上部ヘッダーエリア
- 左上: 「LIVEダッシュボード」タイトル
- 中央上: 配信日時範囲（例: "Dec 29 16:00:54 - Dec 30 00:11:00 UTC+09:00"）
- 右上: 配信時間（例: "8h10m6s"）

### 中央メインエリア（最も重要）
- 【GMV/売上金額】: 画面中央に大きな数字で表示（例: "8,814,883" または "¥8,814,883"）
  - この数値は通常最も大きく表示される
  - カンマ区切りの数字を探してください

### 中央の指標グリッド（複数のカードが並ぶ - 2行×6列程度）
【上段】
- 「インプレッション」/ "Impressions": 数値（例: 606.07K = 606070）
- 「商品クリック数」/ "Product clicks": 数値（例: 79.4K = 79400）
- 「LIVE CTR」: パーセント値（例: 87.2%）
- 「視聴者数」/ "Viewers" / "Unique viewers": 数値（例: 45.57K = 45570）
- 「ピーク視聴者数」/ "Peak viewers": 数値

【下段 - 注文関連データ（重要）】
- 「注文数」/ "Orders": 数値（例: 1.06K = 1060件）← 【客単価計算に必須】
- 「注文率」/ "Order rate": パーセント値（例: 3.2%）
- 「商品販売数」/ "Products sold": 数値（例: 2.06K = 2060）

【客単価の計算方法】
客単価 = 売上金額(GMV) ÷ 注文数
例: 8,814,883円 ÷ 1,060件 = 8,316円
※ 客単価が数百円になることは通常ありません。数千円〜数万円が一般的です。

### 左側パネル
- パフォーマンストレンドグラフ
- トラフィックソース内訳
- LIVEコンバージョン

### 右側パネル
- リプレイ動画プレビュー
- 配信者プロフィール

## 数値読み取りルール（必ず従ってください）
- "K" = 1,000倍（例: 45.57K = 45570）
- "M" = 1,000,000倍（例: 1.08M = 1080000）
- カンマは無視（例: 8,814,883 = 8814883）
- 時間表示は分に変換（例: 8h10m6s = 8*60+10 = 490分）
- パーセントは数値のみ（例: 87.2% = 87.2）

## 抽出するデータ
1. salesAmount: GMV/売上金額（中央の大きな数字）
2. viewerCount: 視聴者数/Viewers
3. peakViewerCount: ピーク視聴者数
4. productClicks: 商品クリック数
5. orderCount: 注文数
6. durationMinutes: 配信時間（分）
7. startDateTime: 配信開始日時（YYYY-MM-DD HH:mm形式）
8. endDateTime: 配信終了日時（YYYY-MM-DD HH:mm形式）
9. rawData.impressions: インプレッション数
10. rawData.liveCtr: LIVE CTR（%）
11. rawData.orderRate: 注文率（%）
12. rawData.productSales: 商品販売数
13. productList: 商品リスト（画面に「商品リスト」セクションが見える場合のみ）

## 商品リスト抽出ルール
- 画面右下付近に「商品リスト」テーブルが表示されている場合があります
- 各商品の「商品名」「販売数(quantity)」「GMV/売上(revenue)」を読み取ってください
- 商品名の先頭にブランド名が含まれていることが多いです（例: "KYOGOKU マジッククリップ", "cicibella フェイスタオル"）
- 商品リストが見えない場合は空配列[]を返してください
- 数値が不明確な場合でも、見える範囲で最善の推測をしてください
- revenueは商品単価×販売数ではなく、実際の売上金額（GMV）です

## 日時抽出ルール
- 画面上部の日時範囲から抽出
- 例: "Feb 04 16:00:54 - Feb 05 00:11:00" → startDateTime: "2026-02-04 16:00", endDateTime: "2026-02-05 00:11"
- 【重要】年が明示されていない場合は、必ず2026年としてください（現在は2026年3月です）
- 日付が1月、2月、3月の場合は2026年、それ以外の月で過去の日付の場合は2025年の可能性があります
- 【重要】時刻は必ず24時間形式で読み取ってください。TikTokダッシュボードの時刻は24時間形式です。
- 【重要】配信は通常夜（19:00～02:00 JST）に行われます。終了時刻が開始時刻より前の場合は、日付をまたいでいる可能性が高いです。例: 開始 21:30 終了 00:34 → endDateTimeは翌日の00:34です。
- 【重要】終了時刻が開始時刻より小さい場合（例: start=21:30, end=00:34）、endDateTimeの日付を翌日にしてください。

## durationMinutesの計算ルール
- 【最優先】startDateTimeとendDateTimeから計算してください: (endDateTime - startDateTime) を分に変換
- 例: start="2026-03-20 21:30", end="2026-03-21 00:34" → durationMinutes = 184
- 画面上の時間表示（例: "2h 30m"）がある場合は、それも参考にしてください
- durationMinutesは通常30分以上です。数分以下の値は誤読の可能性が高いです。
## 出力形式（必ずこの形式で返してください）
{
  "salesAmount": 数値,
  "viewerCount": 数値,
  "peakViewerCount": 数値,
  "productClicks": 数値,
  "orderCount": 数値,
  "durationMinutes": 数値,
  "startDateTime": "YYYY-MM-DD HH:mm",
  "endDateTime": "YYYY-MM-DD HH:mm",
  "rawData": {
    "impressions": 数値,
    "liveCtr": 数値,
    "orderRate": 数値,
    "productSales": 数値
  },
  "productList": [
    { "productName": "商品名", "quantity": 販売数, "revenue": 売上金額 }
  ],
  "confidence": "high" | "medium" | "low"
}

## 重要な注意事項
- 数値が見える場合は必ず抽出してください。nullや空にしないでください。
- 画像が不鮮明でも、見える数値は最善の推測で抽出してください。
- confidenceは、数値が明確に読み取れた場合は"high"、一部不明確な場合は"medium"、多くが不明確な場合は"low"としてください。
- 特にsalesAmount（GMV）は画面中央の最も大きな数字です。必ず抽出してください。
- productListは商品リストが見える場合のみ抽出。見えない場合は空配列[]を返す。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                imageContent,
                {
                  type: "text",
                  text: `このTikTokライブ配信ダッシュボードのスクリーンショットから、配信データを抽出してください。

特に以下の数値を注意深く探してください：
1. GMV/売上金額 - 画面中央の最も大きな数字（例: 8,814,883）
2. 視聴者数 - "Viewers" または "視聴者数" の横の数値
3. 配信時間 - ヘッダーの時間表示（例: 8h10m6s）
4. 配信日時 - ヘッダーの日時範囲

数値が見える場合は必ず抽出してください。JSON形式で返してください。`,
                },
              ],
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          throw new Error("Failed to analyze screenshot");
        }

        try {
          // Try to extract JSON from markdown code blocks if present
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }
          
          // Parse the JSON
          const parsed = JSON.parse(jsonStr);
          
          // Debug log
          console.log("[analyzeScreenshot] Parsed result:", JSON.stringify(parsed, null, 2));
          console.log("[analyzeScreenshot] salesAmount:", parsed.salesAmount);
          console.log("[analyzeScreenshot] orderCount:", parsed.orderCount);
          console.log("[analyzeScreenshot] viewerCount:", parsed.viewerCount);
          console.log("[analyzeScreenshot] startDateTime:", parsed.startDateTime);
          console.log("[analyzeScreenshot] endDateTime:", parsed.endDateTime);
          
          // 客単価の予測計算（デバッグ用）
          if (parsed.salesAmount && parsed.orderCount && parsed.orderCount > 0) {
            const expectedAvgOrder = Math.round(parsed.salesAmount / parsed.orderCount);
            console.log(`[analyzeScreenshot] 予測客単価: ${parsed.salesAmount} ÷ ${parsed.orderCount} = ${expectedAvgOrder}円`);
          }
          
          // 【重要】durationMinutesのバリデーションと再計算
          // AIが返すdurationMinutesが不正確な場合があるため、startDateTime/endDateTimeから再計算
          let validatedDuration = parsed.durationMinutes ?? null;
          if (parsed.startDateTime && parsed.endDateTime) {
            try {
              const startDt = new Date(parsed.startDateTime);
              const endDt = new Date(parsed.endDateTime);
              if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
                let calcDuration = Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60));
                // 終了が開始より前の場合、日付をまたいでいる可能性 → 24時間加算
                if (calcDuration < 0) {
                  calcDuration += 24 * 60;
                  // endDateTimeの日付も翌日に修正
                  const correctedEnd = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
                  parsed.endDateTime = correctedEnd.toISOString().replace('T', ' ').substring(0, 16);
                  console.log(`[analyzeScreenshot] endDateTime corrected to next day: ${parsed.endDateTime}`);
                }
                // AIの値が極端に小さい場合（30分未満）は再計算値を使用
                if (calcDuration >= 10 && (validatedDuration === null || validatedDuration < 30 || Math.abs(calcDuration - validatedDuration) > calcDuration * 0.5)) {
                  console.log(`[analyzeScreenshot] Duration corrected: AI=${validatedDuration}min -> calc=${calcDuration}min`);
                  validatedDuration = calcDuration;
                }
              }
            } catch (e) {
              console.error('[analyzeScreenshot] Duration validation error:', e);
            }
          }

          // Ensure required fields exist with defaults
          return {
            salesAmount: parsed.salesAmount ?? null,
            viewerCount: parsed.viewerCount ?? null,
            peakViewerCount: parsed.peakViewerCount ?? null,
            productClicks: parsed.productClicks ?? null,
            orderCount: parsed.orderCount ?? null,
            durationMinutes: validatedDuration,
            startDateTime: parsed.startDateTime ?? null,
            endDateTime: parsed.endDateTime ?? null,
            rawData: parsed.rawData ?? {},
            productList: Array.isArray(parsed.productList) ? parsed.productList : [],
            confidence: parsed.confidence ?? "medium",
          };
        } catch (e) {
          console.error("Failed to parse analysis result:", content, e);
          throw new Error("Failed to parse analysis result");
        }
      }),

    // Generate advice based on livestream data
    generateAdvice: rateLimitedPublicProcedure
      .input(z.object({
        salesAmount: z.number().optional(),
        viewerCount: z.number().optional(),
        peakViewerCount: z.number().optional(),
        productClicks: z.number().optional(),
        orderCount: z.number().optional(),
        durationMinutes: z.number().optional(),
        result: z.string().optional(),
        impactFactor: z.string().optional(),
        liverId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        // 基本指標の計算
        const metrics: Record<string, string | number> = {};
        
        if (input.salesAmount) metrics["売上金額"] = `¥${input.salesAmount.toLocaleString()}`;
        if (input.viewerCount) metrics["視聴者数"] = input.viewerCount.toLocaleString();
        if (input.peakViewerCount) metrics["ピーク視聴者数"] = input.peakViewerCount.toLocaleString();
        if (input.productClicks) metrics["商品クリック数"] = input.productClicks.toLocaleString();
        if (input.orderCount) metrics["注文数"] = input.orderCount.toLocaleString();
        if (input.durationMinutes) metrics["配信時間"] = `${input.durationMinutes}分`;
        
        // 計算指標
        if (input.productClicks && input.orderCount && input.productClicks > 0) {
          const cvr = (input.orderCount / input.productClicks * 100).toFixed(2);
          metrics["コンバージョン率(CVR)"] = `${cvr}%`;
        }
        
        if (input.salesAmount && input.orderCount && input.orderCount > 0) {
          const avgOrderValue = Math.round(input.salesAmount / input.orderCount);
          console.log(`[generateAdvice] 客単価計算: ${input.salesAmount} ÷ ${input.orderCount} = ${avgOrderValue}`);
          metrics["客単価"] = `¥${avgOrderValue.toLocaleString()}`;
        }
        
        if (input.salesAmount && input.durationMinutes && input.durationMinutes > 0) {
          const salesPerHour = Math.round(input.salesAmount / (input.durationMinutes / 60));
          metrics["時間効率(売上/時)"] = `¥${salesPerHour.toLocaleString()}`;
        }
        
        if (input.productClicks && input.viewerCount && input.viewerCount > 0) {
          const engagementRate = (input.productClicks / input.viewerCount * 100).toFixed(2);
          metrics["エンゲージメント率"] = `${engagementRate}%`;
        }
        
        // 過去データの取得（ライバーIDがある場合）
        let historicalContext = "";
        if (input.liverId) {
          try {
            const pastLivestreams = await getLivestreamsByLiverId(input.liverId);
            if (pastLivestreams.length > 1) {
              const recentStreams = pastLivestreams.slice(0, 10);
              const avgSales = Math.round(recentStreams.reduce((sum, ls) => sum + (ls.salesAmount || ls.gmv || 0), 0) / recentStreams.length);
              const avgDuration = Math.round(recentStreams.reduce((sum, ls) => sum + (ls.duration || 0), 0) / recentStreams.length);
              const totalStreams = pastLivestreams.length;
              
              historicalContext = `

【過去の配信実績】
- 総配信回数: ${totalStreams}回
- 直近10回の平均売上: ¥${avgSales.toLocaleString()}
- 直近10回の平均配信時間: ${avgDuration}分`;
              
              // 今回との比較
              if (input.salesAmount) {
                const salesDiff = input.salesAmount - avgSales;
                const salesDiffPercent = avgSales > 0 ? Math.round((salesDiff / avgSales) * 100) : 0;
                historicalContext += `\n- 今回の売上は平均比: ${salesDiffPercent >= 0 ? '+' : ''}${salesDiffPercent}%`;
              }
            }
          } catch (e) {
            console.error("Failed to get historical data:", e);
          }
        }
        
        const metricsDescription = Object.entries(metrics)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n");

        const systemPrompt = `あなたはTikTokライブ配信の専門コーチです。
ライバーが次回の配信で実践できる具体的なアドバイスを提供してください。

【回答フォーマット】
以下のJSON形式で回答してください：
{
  "summary": "今回の配信の総評（1文）",
  "goodPoints": ["良かった点（数値根拠あり）"],
  "improvements": ["改善ポイント（具体的に）"],
  "nextActions": [
    {
      "action": "次回やるべきこと",
      "reason": "なぜそれが効果的か",
      "timing": "いつやるか（例：配信開始30分以内）"
    }
  ],
  "targetForNextTime": "次回の具体的な目標（例：売上¥XXX万、CVR X%）"
}

【アドバイスの観点】
- コンバージョン率(CVR)の改善: クリックから購入への導線
- 客単価の向上: セット販売、アップセル
- 時間効率: 売れる時間帯の集中
- エンゲージメント: コメント返し、質問回答
- 商品紹介: 価格とメリットの伝え方

必ずJSONのみを出力してください。説明文は不要です。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `以下の配信データを分析して、次回の配信に向けたアドバイスをください。

【今回の配信データ】
${metricsDescription}${historicalContext}`,
            },
          ],
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== "string") {
          return { 
            advice: "データを分析中です。もう一度お試しください。",
            structured: null,
            metrics
          };
        }

        // JSONをパース
        try {
          let jsonStr = content;
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }
          
          const structured = JSON.parse(jsonStr);
          
          // 従来のワンポイントアドバイスも生成（後方互換性）
          let simpleAdvice = '';
          if (structured.improvements?.[0]) {
            simpleAdvice = `${structured.improvements[0]}。具体的なアドバイス：「${structured.nextActions?.[0]?.action || '次回の配信で試してみましょう'}」`;
          } else if (structured.summary) {
            simpleAdvice = structured.summary;
          } else if (structured.goodPoints?.[0]) {
            simpleAdvice = structured.goodPoints[0];
          } else {
            simpleAdvice = '次回の配信も頑張りましょう！';
          }
          
          return { 
            advice: simpleAdvice,
            structured,
            metrics
          };
        } catch (e) {
          // JSONパース失敗時は従来のテキストを返す
          return { 
            advice: content.trim(),
            structured: null,
            metrics
          };
        }
      }),

    // Analyze multiple screenshots and merge results
    analyzeMultipleScreenshots: protectedProcedure
      .input(z.object({
        images: z.array(z.object({
          imageBase64: z.string(),
          mimeType: z.string().optional(),
          imageHash: z.string().optional(), // For cache lookup
        })).min(1).max(4),
        liverId: z.number().optional(), // For history tracking
        livestreamId: z.number().optional(), // For history tracking
        saveToHistory: z.boolean().optional().default(true), // Whether to save to history
      }))
      .mutation(async ({ ctx, input }) => {
        console.log(`[analyzeMultipleScreenshots] Analyzing ${input.images.length} images`);
        
        // Analyze each image in parallel
        const analysisPromises = input.images.map(async (image, index) => {
          const mimeType = image.mimeType || "image/png";
          const imageContent = {
            type: "image_url" as const,
            image_url: {
              url: `data:${mimeType};base64,${image.imageBase64}`,
              detail: "high" as const,
            },
          };
          
          const systemPrompt = `あなたはTikTokライブ配信のダッシュボードスクリーンショットを解析するエキスパートです。
【最重要】画像内の数値を正確に読み取ってください。数値が見える場合は必ず抽出してください。

## TikTok LIVEダッシュボードのレイアウト詳細

### 上部ヘッダーエリア
- 左上: 「LIVEダッシュボード」タイトル
- 中央上: 配信日時範囲（例: "Dec 29 16:00:54 - Dec 30 00:11:00 UTC+09:00"）
- 右上: 配信時間（例: "8h10m6s"）

### 中央メインエリア（最も重要）
- 【GMV/売上金額】: 画面中央に大きな数字で表示（例: "8,814,883" または "¥8,814,883"）

### 中央の指標グリッド（複数のカードが並ぶ - 2行×6列程度）
【上段】
- 「インプレッション」/ "Impressions": 数値（例: 606.07K = 606070）
- 「商品クリック数」/ "Product clicks": 数値（例: 79.4K = 79400）
- 「LIVE CTR」: パーセント値（例: 87.2%）
- 「視聴者数」/ "Viewers" / "Unique viewers": 数値（例: 45.57K = 45570）
- 「ピーク視聴者数」/ "Peak viewers": 数値

【下段 - 注文関連データ（重要）】
- 「注文数」/ "Orders": 数値（例: 1.06K = 1060件）← 【客単価計算に必須】
- 「注文率」/ "Order rate": パーセント値（例: 3.2%）
- 「商品販売数」/ "Products sold": 数値（例: 2.06K = 2060）

## 数値読み取りルール
- "K" = 1,000倍（例: 45.57K = 45570）
- "M" = 1,000,000倍（例: 1.08M = 1080000）
- カンマは無視（例: 8,814,883 = 8814883）
- 時間表示は分に変換（例: 8h10m6s = 8*60+10 = 490分）

## 日時抽出ルール
- 画面上部の日時範囲から抽出
- 例: "Feb 04 16:00:54 - Feb 05 00:11:00" → startDateTime: "2026-02-04 16:00", endDateTime: "2026-02-05 00:11"
- 【重要】年が明示されていない場合は、必ず2026年としてください（現在は2026年3月です）
- 日付が1月、2月、3月の場合は2026年、それ以外の月で過去の日付の場合は2025年の可能性があります
- 【重要】時刻は必ず24時間形式で読み取ってください。TikTokダッシュボードの時刻は24時間形式です。
- 【重要】配信は通常夜（19:00～02:00 JST）に行われます。終了時刻が開始時刻より前の場合は、日付をまたいでいる可能性が高いです。例: 開始 21:30 終了 00:34 → endDateTimeは翌日の00:34です。
- 【重要】終了時刻が開始時刻より小さい場合（例: start=21:30, end=00:34）、endDateTimeの日付を翌日にしてください。

## durationMinutesの計算ルール
- 【最優先】startDateTimeとendDateTimeから計算してください: (endDateTime - startDateTime) を分に変換
- 例: start="2026-03-20 21:30", end="2026-03-21 00:34" → durationMinutes = 184
- 画面上の時間表示（例: "2h 30m"）がある場合は、それも参考にしてください
- durationMinutesは通常30分以上です。数分以下の値は誤読の可能性が高いです。

## 出力形式（必ずこの形式で返してください）
{
  "salesAmount": 数値,
  "viewerCount": 数値,
  "peakViewerCount": 数値,
  "productClicks": 数値,
  "orderCount": 数値,
  "durationMinutes": 数値,
  "startDateTime": "YYYY-MM-DD HH:mm",
  "endDateTime": "YYYY-MM-DD HH:mm",
  "rawData": {
    "impressions": 数値,
    "liveCtr": 数値,
    "orderRate": 数値,
    "productSales": 数値
  },
  "confidence": "high" | "medium" | "low"
}`;

          // リトライ付きでLLMを呼び出すヘルパー関数
          const analyzeWithRetry = async (retryCount: number = 0): Promise<any> => {
            try {
              console.log(`[analyzeMultipleScreenshots] Image ${index + 1}: Starting LLM analysis... (attempt ${retryCount + 1})`);
              console.log(`[analyzeMultipleScreenshots] Image ${index + 1}: Base64 length: ${image.imageBase64.length}`);
              
              const response = await invokeLLM({
                messages: [
                  { role: "system", content: systemPrompt },
                  {
                    role: "user",
                    content: [
                      imageContent,
                      {
                        type: "text",
                        text: `このTikTokライブ配信ダッシュボードのスクリーンショットから、配信データを抽出してください。JSON形式で返してください。`,
                      },
                    ],
                  },
                ],
              });

              console.log(`[analyzeMultipleScreenshots] Image ${index + 1}: LLM response received`);
              
              const content = response.choices[0]?.message?.content;
              if (!content || typeof content !== "string") {
                throw new Error(`No content returned. Response: ${JSON.stringify(response, null, 2)}`);
              }

              console.log(`[analyzeMultipleScreenshots] Image ${index + 1}: Raw content:`, content.substring(0, 500));

              let jsonStr = content;
              const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
              if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
              }

              const parsed = JSON.parse(jsonStr);
              console.log(`[analyzeMultipleScreenshots] Image ${index + 1} result:`, JSON.stringify(parsed, null, 2));
              return parsed;
            } catch (e: any) {
              console.error(`[analyzeMultipleScreenshots] Image ${index + 1} failed (attempt ${retryCount + 1}):`, e?.message || e);
              
              // リトライ（1回まで）
              if (retryCount < 1) {
                console.log(`[analyzeMultipleScreenshots] Image ${index + 1}: Retrying in 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return analyzeWithRetry(retryCount + 1);
              }
              
              console.error(`[analyzeMultipleScreenshots] Image ${index + 1}: All retries exhausted`);
              return null;
            }
          };
          
          return analyzeWithRetry()
        });

        const results = await Promise.all(analysisPromises);
        const validResults = results.filter(r => r !== null);

        if (validResults.length === 0) {
          throw new Error("すべての画像の解析に失敗しました");
        }

        // Merge results - take the highest confidence values or average
        const mergedResult = {
          salesAmount: null as number | null,
          viewerCount: null as number | null,
          peakViewerCount: null as number | null,
          productClicks: null as number | null,
          orderCount: null as number | null,
          durationMinutes: null as number | null,
          startDateTime: null as string | null,
          endDateTime: null as string | null,
          rawData: {} as Record<string, number>,
          confidence: "medium" as string,
          individualResults: validResults,
          mergeStrategy: "highest_value" as string,
        };

        // For numeric fields, take the maximum (most likely to be correct for totals)
        // For date/time fields, take the earliest start and latest end
        const numericFields = ['salesAmount', 'viewerCount', 'peakViewerCount', 'productClicks', 'orderCount', 'durationMinutes'] as const;
        
        for (const field of numericFields) {
          const values = validResults
            .map(r => r[field])
            .filter((v): v is number => typeof v === 'number' && v > 0);
          
          if (values.length > 0) {
            // Take the maximum value (most complete data)
            (mergedResult as any)[field] = Math.max(...values);
          }
        }

        // For date/time, take earliest start and latest end
        const startDates = validResults
          .map(r => r.startDateTime)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .sort();
        if (startDates.length > 0) {
          mergedResult.startDateTime = startDates[0];
        }

        const endDates = validResults
          .map(r => r.endDateTime)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
          .sort();
        if (endDates.length > 0) {
          mergedResult.endDateTime = endDates[endDates.length - 1];
        }

        // Merge rawData
        for (const result of validResults) {
          if (result.rawData) {
            for (const [key, value] of Object.entries(result.rawData)) {
              if (typeof value === 'number' && value > 0) {
                if (!mergedResult.rawData[key] || value > mergedResult.rawData[key]) {
                  mergedResult.rawData[key] = value;
                }
              }
            }
          }
        }

        // Determine confidence based on consistency
        const confidenceCounts = validResults.reduce((acc, r) => {
          const conf = r.confidence || 'medium';
          acc[conf] = (acc[conf] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        if (confidenceCounts['high'] && confidenceCounts['high'] >= validResults.length / 2) {
          mergedResult.confidence = 'high';
        } else if (confidenceCounts['low'] && confidenceCounts['low'] >= validResults.length / 2) {
          mergedResult.confidence = 'low';
        } else {
          mergedResult.confidence = 'medium';
        }

         // 【重要】mergedResultのdurationMinutesをstartDateTime/endDateTimeから再計算・バリデーション
        if (mergedResult.startDateTime && mergedResult.endDateTime) {
          try {
            const startDt = new Date(mergedResult.startDateTime);
            const endDt = new Date(mergedResult.endDateTime);
            if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
              let calcDuration = Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60));
              if (calcDuration < 0) {
                calcDuration += 24 * 60;
                const correctedEnd = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
                mergedResult.endDateTime = correctedEnd.toISOString().replace('T', ' ').substring(0, 16);
                console.log(`[analyzeMultipleScreenshots] endDateTime corrected to next day: ${mergedResult.endDateTime}`);
              }
              const currentDur = mergedResult.durationMinutes;
              if (calcDuration >= 10 && (currentDur === null || currentDur < 30 || Math.abs(calcDuration - currentDur) > calcDuration * 0.5)) {
                console.log(`[analyzeMultipleScreenshots] Duration corrected: ${currentDur}min -> ${calcDuration}min`);
                mergedResult.durationMinutes = calcDuration;
              }
            }
          } catch (e) {
            console.error('[analyzeMultipleScreenshots] Duration validation error:', e);
          }
        }

        console.log(`[analyzeMultipleScreenshots] Merged result:`, JSON.stringify(mergedResult, null, 2));
        // Save to history if requested
        if (input.saveToHistory) {
          try {
            // Create a combined hash from all image hashes
            const combinedHash = input.images
              .map(img => img.imageHash || '')
              .filter(h => h)
              .join('_') || `multi_${Date.now()}`;
            
            await saveScreenshotAnalysis({
              liverId: input.liverId || null,
              livestreamId: input.livestreamId || null,
              imageHash: combinedHash,
              salesAmount: mergedResult.salesAmount || null,
              viewerCount: mergedResult.viewerCount || null,
              peakViewerCount: mergedResult.peakViewerCount || null,
              productClicks: mergedResult.productClicks || null,
              orderCount: mergedResult.orderCount || null,
              durationMinutes: mergedResult.durationMinutes || null,
              startDateTime: mergedResult.startDateTime || null,
              endDateTime: mergedResult.endDateTime || null,
              impressions: null, // TODO: Add to mergedResult if needed
              liveCtr: null, // TODO: Add to mergedResult if needed
              orderRate: null, // TODO: Add to mergedResult if needed
              productSales: null, // TODO: Add to mergedResult if needed
              confidence: (mergedResult.confidence as 'high' | 'medium' | 'low') || 'medium',
              rawResponse: mergedResult,
              analysisVersion: '1.0',
              analyzedBy: ctx.user?.id || null,
            });
            console.log(`[analyzeMultipleScreenshots] Saved to history`);
          } catch (historyError) {
            console.error(`[analyzeMultipleScreenshots] Failed to save history:`, historyError);
            // Don't fail the request if history save fails
          }
        }

        return mergedResult;
      }),

    // Get analysis history by image hash (for cache)
    getAnalysisByHash: protectedProcedure
      .input(z.object({ imageHash: z.string() }))
      .query(async ({ input }) => {
        return await getAnalysisByImageHash(input.imageHash);
      }),

    // Get analysis history by liver ID
    getAnalysisHistoryByLiver: protectedProcedure
      .input(z.object({ liverId: z.number(), limit: z.number().optional().default(20) }))
      .query(async ({ input }) => {
        return await getAnalysisHistoryByLiverId(input.liverId, input.limit);
      }),

    // Get analysis history by livestream ID
    getAnalysisHistoryByLivestream: protectedProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getAnalysisHistoryByLivestreamId(input.livestreamId);
      }),

    // Get recent analysis history (admin)
    getRecentAnalysisHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        return await getRecentAnalysisHistory(input.limit);
      }),

    // Get livestreams by streamer name (for ranking detail view)
    getLivestreamsByStreamerName: publicProcedure
      .input(z.object({ 
        streamerName: z.string(),
        month: z.string().optional() // format: "YYYY-MM"
      }))
      .query(async ({ input }) => {
        return await getLivestreamsByStreamerName(input.streamerName, input.month);
      }),

    // Get monthly growth data for a specific liver (成長グラフ用)
    getLiverMonthlyGrowth: publicProcedure
      .input(z.object({
        streamerName: z.string(),
      }))
      .query(async ({ input }) => {
        return await getLiverMonthlyGrowth(input.streamerName);
      }),

    // Get monthly products by liverId (管理者用・ライバー別月間売上商品一覧)
    getMonthlyProductsByLiverId: publicProcedure
      .input(z.object({
        liverId: z.number(),
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return await getLiverMonthlyProducts(input.liverId, input.year, input.month);
      }),

    // Get top selling products ranking (売れ筋商品ランキング)
    getProductRanking: publicProcedure
      .input(z.object({ 
        month: z.string().optional(), // format: "YYYY-MM"
        limit: z.number().optional().default(10)
      }))
      .query(async ({ input }) => {
        const month = input.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        return await getProductSalesRanking(month, input.limit);
      }),

    // Get liver x product matrix (ライバー×商品マトリックス)
    getLiverProductMatrix: publicProcedure
      .input(z.object({ 
        month: z.string().optional(), // format: "YYYY-MM"
        limit: z.number().optional().default(10) // top N products
      }))
      .query(async ({ input }) => {
        const month = input.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        return await getLiverProductMatrix(month, input.limit);
      }),

    // Get hourly sales analysis (時間帯別売上分析)
    getHourlySalesAnalysis: publicProcedure
      .input(z.object({ 
        month: z.string().optional() // format: "YYYY-MM"
      }))
      .query(async ({ input }) => {
        return await getHourlySalesAnalysis(input.month);
      }),

    // Get day of week performance (曜日別パフォーマンス)
    getDayOfWeekPerformance: publicProcedure
      .input(z.object({ 
        month: z.string().optional() // format: "YYYY-MM"
      }))
      .query(async ({ input }) => {
        return await getDayOfWeekPerformance(input.month);
      }),

    // AI-powered liver-product matching suggestions (AIマッチング提案)
    getAiMatchingSuggestions: rateLimitedPublicProcedure
      .input(z.object({ 
        month: z.string().optional(), // format: "YYYY-MM"
        language: z.enum(["ja", "zh"]).optional().default("ja")
      }))
      .mutation(async ({ input }) => {
        const month = input.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        
        // Get performance data for AI analysis
        const [liverPerformance, productPerformance, liverProductMatrix] = await Promise.all([
          getLiverPerformanceForMatching(month),
          getProductPerformanceForMatching(month),
          getLiverProductPerformanceMatrix(month),
        ]);

        // Build context for AI
        const liverSummary = liverPerformance.map(l => ({
          name: l.liverName,
          livestreamCount: Number(l.livestreamCount),
          totalDuration: Number(l.totalDuration),
          totalSales: Number(l.totalSales),
          avgViewers: Number(l.avgViewers),
        }));

        const productSummary = productPerformance.map(p => ({
          name: p.productName,
          totalGmv: Number(p.totalGmv),
          totalItemsSold: Number(p.totalItemsSold),
          avgUnitPrice: Number(p.avgUnitPrice),
          livestreamCount: Number(p.livestreamCount),
        }));

        // Group matrix by liver
        const liverProductMap = new Map<number, { liverName: string; products: { name: string; gmv: number; itemsSold: number }[] }>();
        for (const row of liverProductMatrix) {
          if (!row.liverId) continue;
          if (!liverProductMap.has(row.liverId)) {
            liverProductMap.set(row.liverId, { liverName: row.liverName, products: [] });
          }
          liverProductMap.get(row.liverId)!.products.push({
            name: row.productName,
            gmv: Number(row.totalGmv),
            itemsSold: Number(row.totalItemsSold),
          });
        }

        const liverProductSummary = Array.from(liverProductMap.values()).map(l => ({
          liverName: l.liverName,
          topProducts: l.products.sort((a, b) => b.gmv - a.gmv).slice(0, 5),
        }));

        // Build prompt
        const promptJa = `あなたはTikTokライブコマースのマッチングAIです。以下のデータを分析し、各ライバーに最適な商品を提案してください。

## ライバー実績データ（${month}）
${liverSummary.map(l => `- ${l.name}: 配信${l.livestreamCount}回、売上¥${l.totalSales.toLocaleString()}、平均視聴者${Math.round(l.avgViewers)}人`).join('\n')}

## 商品実績データ（売上TOP10）
${productSummary.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}: ¥${p.totalGmv.toLocaleString()}（${p.totalItemsSold}個販売、平均単価¥${Math.round(p.avgUnitPrice).toLocaleString()}）`).join('\n')}

## ライバー×商品実績
${liverProductSummary.map(l => `### ${l.liverName}の得意商品\n${l.topProducts.map((p, i) => `  ${i + 1}. ${p.name}: ¥${p.gmv.toLocaleString()}`).join('\n')}`).join('\n\n')}

---

上記のデータを分析し、以下の形式でマッチング提案を作成してください：

各ライバーについて：
1. **推奨商品TOP3**（理由付き）
2. **避けるべき商品**（もしあれば）
3. **配信戦略のアドバイス**

最後に、全体的な商品×ライバーの最適配置マトリックスを提案してください。

日本語で回答してください。具体的な数字を含めてください。`;

        const promptZh = `你是TikTok直播电商的匹配AI。请分析以下数据，为每位主播推荐最适合的商品。

## 主播业绩数据（${month}）
${liverSummary.map(l => `- ${l.name}: 直播${l.livestreamCount}次、销售额¥${l.totalSales.toLocaleString()}、平均观众${Math.round(l.avgViewers)}人`).join('\n')}

## 商品业绩数据（销售额TOP10）
${productSummary.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}: ¥${p.totalGmv.toLocaleString()}（${p.totalItemsSold}个销售、平均单价¥${Math.round(p.avgUnitPrice).toLocaleString()}）`).join('\n')}

## 主播×商品业绩
${liverProductSummary.map(l => `### ${l.liverName}的擅长商品\n${l.topProducts.map((p, i) => `  ${i + 1}. ${p.name}: ¥${p.gmv.toLocaleString()}`).join('\n')}`).join('\n\n')}

---

请分析以上数据，按以下格式制定匹配提案：

对于每位主播：
1. **推荐商品TOP3**（附理由）
2. **应避免的商品**（如有）
3. **直播策略建议**

最后，请提出整体的商品×主播最优配置矩阵。

请用中文回答。请包含具体数字。`;

        const prompt = input.language === "zh" ? promptZh : promptJa;

        // Call LLM
        const response = await invokeLLM({
          messages: [
            { role: "system", content: input.language === "zh" ? "你是专业的TikTok直播电商顾问。" : "あなたはプロのTikTokライブコマースコンサルタントです。" },
            { role: "user", content: prompt },
          ],
        });

        const suggestion = response.choices[0]?.message?.content || "";

        return {
          month,
          liverCount: liverSummary.length,
          productCount: productSummary.length,
          suggestion,
          rawData: {
            liverSummary,
            productSummary: productSummary.slice(0, 10),
            liverProductSummary,
          },
        };
      }),

    // Add a new brand by liver (ライバーによるブランド追加)
    addBrand: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        liverId: z.number(),
        liverName: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Create the brand
        const brand = await createBrandByLiver(input.name, 0);
        
        // Log the addition
        await createBrandAdditionLog({
          liverId: input.liverId,
          liverName: input.liverName,
          brandId: brand.id,
          brandName: input.name,
        });
        
        return brand;
      }),

    // Get brand addition logs (管理画面用)
    getBrandAdditionLogs: protectedProcedure
      .input(z.object({
        limit: z.number().optional().default(100),
      }).optional())
      .query(async ({ input }) => {
        return await getAllBrandAdditionLogs(input?.limit || 100);
      }),

    // Get all livers' goal status for a given month (管理者向け目標設定状況一覧)
    goalStatus: publicProcedure
      .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
      .query(async ({ input }) => {
        const [yearStr, monthStr] = input.month.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        
        // Get all active livers (filter out test livers and inactive)
        const allLivers = await getAllLivers();
        const activeLivers = allLivers.filter(l => 
          l.isActive && 
          l.name && 
          !l.name.toLowerCase().includes('test') &&
          l.name !== '..' &&
          l.name !== '。' &&
          l.name.trim().length > 0
        );
        
        // Get livers who have at least 1 livestream ever (to filter out truly inactive ones)
        const db = await getDb();
        const liverIdsWithStreams = await db
          .selectDistinct({ liverId: brandLivestreams.liverId })
          .from(brandLivestreams)
          .where(isNotNull(brandLivestreams.liverId));
        const activeStreamLiverIds = new Set(liverIdsWithStreams.map(l => l.liverId));
        
        // Only include livers who have streamed OR have set a goal
        // Get all goals for this month
        const goals = await db
          .select()
          .from(liverGoals)
          .where(
            and(
              eq(liverGoals.year, year),
              eq(liverGoals.month, month)
            )
          );
        
        const goalMap = new Map(goals.map(g => [g.liverId, g]));
        
        const filteredLivers = activeLivers.filter(l => 
          activeStreamLiverIds.has(l.id) || goalMap.has(l.id)
        );
        
        return filteredLivers.map(liver => {
          const goal = goalMap.get(liver.id);
          return {
            liverId: liver.id,
            liverName: liver.name,
            avatarUrl: liver.avatarUrl,
            hasGoal: !!goal && (!!goal.salesGoal && goal.salesGoal > 0),
            salesGoal: goal?.salesGoal || 0,
            streamCountGoal: goal?.streamCountGoal || 0,
            salesGoalAchieved: goal?.salesGoalAchieved || false,
            streamCountGoalAchieved: goal?.streamCountGoalAchieved || false,
          };
        });
       }),

    // ===== LCJ 神コーチ (AI Coach) =====
    aiCoach: router({
      // ========== Room Management ==========
      getRooms: publicProcedure
        .input(z.object({ liverId: z.number() }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return [];
          const rooms = await db
            .select()
            .from(aiCoachRooms)
            .where(and(eq(aiCoachRooms.liverId, input.liverId), isNull(aiCoachRooms.deletedAt)))
            .orderBy(desc(aiCoachRooms.lastMessageAt));
          return rooms;
        }),
      createRoom: publicProcedure
        .input(z.object({ liverId: z.number(), title: z.string().optional() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
          const [result] = await db.insert(aiCoachRooms).values({
            liverId: input.liverId,
            title: input.title || '新しい会話',
          });
          const roomId = (result as any).insertId;
          const [room] = await db.select().from(aiCoachRooms).where(eq(aiCoachRooms.id, roomId));
          return room;
        }),
      updateRoomTitle: publicProcedure
        .input(z.object({ roomId: z.number(), title: z.string() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
          await db.update(aiCoachRooms).set({ title: input.title }).where(eq(aiCoachRooms.id, input.roomId));
          return { success: true };
        }),
      deleteRoom: publicProcedure
        .input(z.object({ roomId: z.number() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
          await db.update(aiCoachRooms).set({ deletedAt: new Date() }).where(eq(aiCoachRooms.id, input.roomId));
          return { success: true };
        }),
      // ========== Messages ==========
      // Get chat messages for a liver (now supports roomId)
      getMessages: publicProcedure
        .input(z.object({
          liverId: z.number(),
          roomId: z.number().optional(),
          limit: z.number().optional().default(50),
          beforeId: z.number().optional(), // for pagination
        }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { messages: [], hasMore: false };
          const { sql: sqlTag } = await import('drizzle-orm');
          
          const conditions = [eq(aiCoachMessages.liverId, input.liverId)];
          if (input.roomId) {
            // roomIdが指定されたルームのメッセージ OR roomIdがnullのレガシーメッセージも含める
            conditions.push(or(eq(aiCoachMessages.roomId, input.roomId), isNull(aiCoachMessages.roomId))!);
          }
          if (input.beforeId) {
            conditions.push(sqlTag`${aiCoachMessages.id} < ${input.beforeId}`);
          }
          
          const messages = await db
            .select()
            .from(aiCoachMessages)
            .where(and(...conditions))
            .orderBy(desc(aiCoachMessages.id))
            .limit(input.limit + 1);
          
          const hasMore = messages.length > input.limit;
          if (hasMore) messages.pop();
          
          return { messages: messages.reverse(), hasMore };
        }),

      // Send a message from the liver and get AI response
      sendMessage: publicProcedure
        .input(z.object({
          liverId: z.number(),
          roomId: z.number().optional(),
          message: z.string().min(1),
          contextType: z.string().optional(),
          contextId: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
          const { sql: sqlTag } = await import('drizzle-orm');
          
          // Save user message
          await db.insert(aiCoachMessages).values({
            liverId: input.liverId,
            roomId: input.roomId || null,
            role: 'user',
            content: input.message,
            messageType: 'chat',
            contextType: input.contextType || 'general',
            contextId: input.contextId,
          });
          
          // Build AI context
          const liver = await getLiverById(input.liverId);
          const liverName = liver?.name || 'ライバーさん';
          
          // Get recent sales data (last 6 months)
          const salesTrend = await getLiverMonthlySalesTrendById(input.liverId);
          const recentMonths = salesTrend.slice(-6);
          const currentMonth = recentMonths[recentMonths.length - 1];
          const prevMonth = recentMonths[recentMonths.length - 2];
          
          // Get recent livestreams
          const recentStreams = await getLiverRecentLivestreams(input.liverId, 10);
          
          // Get recent chat history (last 20 messages) - scoped to room if specified
          const historyConditions = [eq(aiCoachMessages.liverId, input.liverId)];
          if (input.roomId) {
            historyConditions.push(eq(aiCoachMessages.roomId, input.roomId));
          }
          const recentHistory = await db
            .select()
            .from(aiCoachMessages)
            .where(and(...historyConditions))
            .orderBy(desc(aiCoachMessages.id))
            .limit(20);
          
          // Build sales context string
          let salesContext = `【${liverName}さんの売上データ】\n`;
          recentMonths.forEach(m => {
            const hourlyRate = m.totalDuration > 0 ? Math.round(m.totalSales / (m.totalDuration / 60)) : 0;
            salesContext += `${m.label}: 売上¥${m.totalSales.toLocaleString()} / ${(m.totalDuration/60).toFixed(1)}h / 時間単価¥${hourlyRate.toLocaleString()} / ${m.totalLivestreams}回配信\n`;
          });
          
          if (currentMonth && prevMonth && prevMonth.totalSales > 0) {
            const growth = ((currentMonth.totalSales - prevMonth.totalSales) / prevMonth.totalSales * 100).toFixed(1);
            salesContext += `\n前月比: ${Number(growth) >= 0 ? '+' : ''}${growth}%`;
          }
          
          // Build recent streams context
          let streamsContext = '\n\n【直近の配信】\n';
          recentStreams.slice(0, 5).forEach(s => {
            const date = s.livestreamDate ? new Date(s.livestreamDate).toLocaleDateString('ja-JP') : '不明';
            const sales = s.gmv ? `¥${Number(s.gmv).toLocaleString()}` : '未記録';
            const dur = s.duration ? `${(s.duration/60).toFixed(1)}h` : '不明';
            streamsContext += `${date}: ${s.brandName || '不明'} / 売上${sales} / ${dur}\n`;
          });
          
          // Get ALL set data for this liver (全配信の全セットデータ)
          // First, get all livestream IDs for this liver
          const allLiverStreams = await db
            .select({ id: brandLivestreams.id, livestreamDate: brandLivestreams.livestreamDate, brandName: brands.name })
            .from(brandLivestreams)
            .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
            .where(and(eq(brandLivestreams.liverId, input.liverId), isNull(brandLivestreams.deletedAt)))
            .orderBy(desc(brandLivestreams.livestreamDate));
          
          const allStreamIds = allLiverStreams.map(s => s.id).filter(Boolean);
          let setsContext = '';
          if (allStreamIds.length > 0) {
            // Fetch in batches of 500 to avoid SQL limits
            let allSets: any[] = [];
            for (let i = 0; i < allStreamIds.length; i += 500) {
              const batchIds = allStreamIds.slice(i, i + 500);
              const batchSets = await db
                .select()
                .from(livestreamSets)
                .where(sqlTag`${livestreamSets.livestreamId} IN (${sqlTag.join(batchIds.map(id => sqlTag`${id}`), sqlTag`, `)})`);
              allSets = allSets.concat(batchSets);
            }
            
            if (allSets.length > 0) {
              // Get all set items
              const setIds = allSets.map((s: any) => s.id);
              let allSetItems: any[] = [];
              for (let i = 0; i < setIds.length; i += 500) {
                const batchSetIds = setIds.slice(i, i + 500);
                const batchItems = await db
                  .select()
                  .from(livestreamSetItems)
                  .where(sqlTag`${livestreamSetItems.setId} IN (${sqlTag.join(batchSetIds.map((id: any) => sqlTag`${id}`), sqlTag`, `)})`);
                allSetItems = allSetItems.concat(batchItems);
              }
              
              // Group items by setId
              const itemsBySetId: Record<number, any[]> = {};
              allSetItems.forEach((item: any) => {
                if (!itemsBySetId[item.setId]) itemsBySetId[item.setId] = [];
                itemsBySetId[item.setId].push(item);
              });
              
              // Build stream lookup
              const streamLookup: Record<number, { livestreamDate: any; brandName: string | null }> = {};
              allLiverStreams.forEach(s => {
                streamLookup[s.id] = { livestreamDate: s.livestreamDate, brandName: s.brandName };
              });
              
              setsContext = `\n\n【${liverName}さんの全セット組みデータ（${allSets.length}件）】\n`;
              // Sort by totalRevenue descending, show top 30 sets
              const sortedSets = [...allSets].sort((a: any, b: any) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
              const topSets = sortedSets.slice(0, 30);
              
              setsContext += '\n--- 売上TOP30セット ---\n';
              topSets.forEach((s: any, idx: number) => {
                const stream = streamLookup[s.livestreamId];
                const date = stream?.livestreamDate ? new Date(stream.livestreamDate).toLocaleDateString('ja-JP') : '';
                const discount = s.discountRate ? `${s.discountRate}%OFF` : '';
                setsContext += `\n${idx + 1}. ${s.setName} ${discount ? `(${discount})` : ''}\n`;
                setsContext += `  売値: ¥${Number(s.setPrice).toLocaleString()} / 販売数: ${s.quantitySold}セット / セット売上: ¥${Number(s.totalRevenue || 0).toLocaleString()}`;
                if (s.totalOriginalPrice) setsContext += ` / 元値合計: ¥${Number(s.totalOriginalPrice).toLocaleString()}`;
                if (date) setsContext += ` / 配信日: ${date}`;
                if (stream?.brandName) setsContext += ` / ブランド: ${stream.brandName}`;
                setsContext += '\n';
                
                // Add items
                const items = itemsBySetId[s.id] || [];
                if (items.length > 0) {
                  setsContext += '  商品構成: ';
                  setsContext += items.map((item: any) => `${item.productName}(¥${Number(item.originalPrice).toLocaleString()})`).join('、');
                  setsContext += '\n';
                }
              });
              
              // If there are more sets beyond top 30, add remaining as summary
              if (sortedSets.length > 30) {
                setsContext += `\n--- その他のセット（${sortedSets.length - 30}件）---\n`;
                sortedSets.slice(30).forEach((s: any) => {
                  const stream = streamLookup[s.livestreamId];
                  const date = stream?.livestreamDate ? new Date(stream.livestreamDate).toLocaleDateString('ja-JP') : '';
                  setsContext += `${s.setName}: ¥${Number(s.setPrice).toLocaleString()} × ${s.quantitySold} = ¥${Number(s.totalRevenue || 0).toLocaleString()} ${date ? `(${date})` : ''}\n`;
                });
              }
              
              // Summary stats
              const totalSetRevenue = allSets.reduce((sum: number, s: any) => sum + (s.totalRevenue || 0), 0);
              const totalSetsSold = allSets.reduce((sum: number, s: any) => sum + (s.quantitySold || 0), 0);
              const avgSetPrice = allSets.length > 0 ? Math.round(allSets.reduce((sum: number, s: any) => sum + s.setPrice, 0) / allSets.length) : 0;
              const setsWithDiscount = allSets.filter((s: any) => s.discountRate);
              const avgDiscount = setsWithDiscount.length > 0 
                ? Math.round(setsWithDiscount.reduce((sum: number, s: any) => sum + (s.discountRate || 0), 0) / setsWithDiscount.length)
                : 0;
              
              // Price range analysis
              const prices = allSets.map((s: any) => s.setPrice).sort((a: number, b: number) => a - b);
              const minPrice = prices[0];
              const maxPrice = prices[prices.length - 1];
              
              setsContext += `\n【セット組み全体集計】\n`;
              setsContext += `セット総数: ${allSets.length}種類 / 総販売数: ${totalSetsSold}セット / セット売上合計: ¥${totalSetRevenue.toLocaleString()}\n`;
              setsContext += `平均セット価格: ¥${avgSetPrice.toLocaleString()} / 価格帯: ¥${minPrice.toLocaleString()}〜¥${maxPrice.toLocaleString()} / 平均割引率: ${avgDiscount}%\n`;
              
              // Best selling price range
              const priceRanges = [
                { label: '〜¥5,000', min: 0, max: 5000 },
                { label: '¥5,001〜¥10,000', min: 5001, max: 10000 },
                { label: '¥10,001〜¥20,000', min: 10001, max: 20000 },
                { label: '¥20,001〜¥50,000', min: 20001, max: 50000 },
                { label: '¥50,001〜', min: 50001, max: Infinity },
              ];
              setsContext += '\n【価格帯別分析】\n';
              priceRanges.forEach(range => {
                const rangeSets = allSets.filter((s: any) => s.setPrice >= range.min && s.setPrice <= range.max);
                if (rangeSets.length > 0) {
                  const rangeRevenue = rangeSets.reduce((sum: number, s: any) => sum + (s.totalRevenue || 0), 0);
                  const rangeSold = rangeSets.reduce((sum: number, s: any) => sum + (s.quantitySold || 0), 0);
                  setsContext += `${range.label}: ${rangeSets.length}種類 / ${rangeSold}セット販売 / 売上¥${rangeRevenue.toLocaleString()}\n`;
                }
              });
            }
          }
          
          // Build chat history for context
          const chatHistory = recentHistory.reverse().map(m => ({
            role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
            content: m.content,
          }));
          
          // System prompt for LCJ 神コーチ
          const systemPrompt = `あなたは「LCJ 神コーチ」です。ライブコマースのプロフェッショナルAIコーチとして、ライバーの成長を全力でサポートします。

【あなたの性格】
- 熱血だけど親しみやすい
- 具体的なデータに基づいてアドバイスする
- 良い点は大げさに褒める（ライバーのモチベーションを上げる）
- 改善点は優しく、でも的確に指摘する
- 絵文字を適度に使って親しみやすく

【あなたが持っている情報】
${salesContext}
${streamsContext}
${setsContext}

【ルール】
- 必ず日本語で回答する
- データに基づいた具体的なアドバイスをする
- セット組みについて聞かれたら、過去の売れたセットデータを分析して具体的な提案をする
- 売れたセットの特徴（価格帯、割引率、商品構成）を分析して、次のセット提案に活かす
- 「〇〇してみましょう！」のような前向きな提案をする
- 長すぎない回答（200-400文字程度）を心がける
- ライバーの名前「${liverName}さん」を使って呼びかける`;
          
          // Call LLM
          const aiResponse = await invokeLLM({
            messages: [
              { role: 'system', content: systemPrompt },
              ...chatHistory,
              { role: 'user', content: input.message },
            ],
          });
          
          const aiContent = typeof aiResponse.choices[0]?.message?.content === 'string'
            ? aiResponse.choices[0].message.content
            : '申し訳ありません、応答を生成できませんでした。もう一度お試しください。';
          
          // Save AI response
          await db.insert(aiCoachMessages).values({
            liverId: input.liverId,
            roomId: input.roomId || null,
            role: 'ai',
            content: aiContent,
            messageType: 'chat',
            contextType: input.contextType || 'general',
            contextId: input.contextId,
          });
          
          // Update room lastMessageAt
          if (input.roomId) {
            await db.update(aiCoachRooms).set({ lastMessageAt: new Date() }).where(eq(aiCoachRooms.id, input.roomId));
          }
          
          return { message: aiContent };
        }),

      // Generate auto-question after livestream record is saved
      generateAutoQuestion: publicProcedure
        .input(z.object({
          liverId: z.number(),
          livestreamId: z.number(),
        }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
          
          const liver = await getLiverById(input.liverId);
          const liverName = liver?.name || 'ライバーさん';
          
          // Get the livestream that was just saved
          const [livestream] = await db
            .select({
              id: brandLivestreams.id,
              salesAmount: brandLivestreams.salesAmount,
              duration: brandLivestreams.duration,
              viewerCount: brandLivestreams.viewerCount,
              gmv: brandLivestreams.gmv,
              result: brandLivestreams.result,
              remarks: brandLivestreams.remarks,
              brandName: brands.name,
              livestreamDate: brandLivestreams.livestreamDate,
            })
            .from(brandLivestreams)
            .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
            .where(eq(brandLivestreams.id, input.livestreamId))
            .limit(1);
          
          if (!livestream) return { message: null };
          
          // Get sets for this livestream
          const sets = await getLivestreamSetsByLivestreamId(input.livestreamId);
          
          // Get recent sales trend for context
          const salesTrend = await getLiverMonthlySalesTrendById(input.liverId);
          const recentMonths = salesTrend.slice(-3);
          
          // Build livestream context
          const sales = livestream.salesAmount ? `¥${Number(livestream.salesAmount).toLocaleString()}` : (livestream.gmv ? `¥${Number(livestream.gmv).toLocaleString()}` : '未記録');
          const dur = livestream.duration ? `${(livestream.duration/60).toFixed(1)}時間` : '不明';
          const viewers = livestream.viewerCount ? `${livestream.viewerCount.toLocaleString()}人` : '不明';
          const date = livestream.livestreamDate ? new Date(livestream.livestreamDate).toLocaleDateString('ja-JP') : '不明';
          
          let livestreamContext = `【今回の配信データ】\n`;
          livestreamContext += `日付: ${date}\n`;
          livestreamContext += `ブランド: ${livestream.brandName || '不明'}\n`;
          livestreamContext += `売上: ${sales}\n`;
          livestreamContext += `配信時間: ${dur}\n`;
          livestreamContext += `視聴者数: ${viewers}\n`;
          if (livestream.result) livestreamContext += `結果: ${livestream.result}\n`;
          if (livestream.remarks) livestreamContext += `備考: ${livestream.remarks}\n`;
          
          if (sets.length > 0) {
            livestreamContext += `\n【セット組み】\n`;
            sets.forEach(s => {
              const setRevenue = (s as any).totalRevenue || ((s as any).setPrice * (s as any).quantitySold) || 0;
              livestreamContext += `・${(s as any).setName}: ¥${Number((s as any).setPrice || 0).toLocaleString()} × ${(s as any).quantitySold || 0}セット = ¥${Number(setRevenue).toLocaleString()}\n`;
              if ((s as any).items) {
                (s as any).items.forEach((item: any) => {
                  livestreamContext += `  - ${item.productName} (¥${Number(item.originalPrice || 0).toLocaleString()})\n`;
                });
              }
            });
          }
          
          // Recent trend context
          let trendContext = '\n【直近の売上推移】\n';
          recentMonths.forEach(m => {
            const hourlyRate = m.totalDuration > 0 ? Math.round(m.totalSales / (m.totalDuration / 60)) : 0;
            trendContext += `${m.label}: 売上¥${m.totalSales.toLocaleString()} / 時間単価¥${hourlyRate.toLocaleString()}\n`;
          });
          
          const systemPrompt = `あなたは「LCJ 神コーチ」です。ライバーが配信記録を保存した直後に、自動的に質問・フィードバックを送ります。

【あなたの性格】
- 熱血だけど親しみやすい
- データを見て具体的に褒める・質問する
- ライバーの成長を促す質問をする
- 絵文字を適度に使う

${livestreamContext}
${trendContext}

【タスク】
${liverName}さんの今回の配信データを分析して、以下を含む短いメッセージ（150-250文字）を生成してください：
1. 今回の配信の良かった点を1つ具体的に褒める
2. 配信中に工夫したことや気づいたことを1つ質問する（ライバーが答えやすい質問）
3. 次の配信に向けた小さな提案を1つ

自然な会話調で、「${liverName}さん」と呼びかけてください。`;
          
          const aiResponse = await invokeLLM({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: '配信記録が保存されました。フィードバックをお願いします。' },
            ],
          });
          
          const aiContent = typeof aiResponse.choices[0]?.message?.content === 'string'
            ? aiResponse.choices[0].message.content
            : null;
          
          if (aiContent) {
            await db.insert(aiCoachMessages).values({
              liverId: input.liverId,
              role: 'ai',
              content: aiContent,
              messageType: 'auto_question',
              contextType: 'livestream',
              contextId: input.livestreamId,
              metadata: {
                livestreamDate: date,
                brandName: livestream.brandName,
                sales: livestream.salesAmount || livestream.gmv,
                duration: livestream.duration,
              },
            });
          }
          
          return { message: aiContent };
        }),

      // Generate welcome message for first-time users
      getOrCreateWelcome: publicProcedure
        .input(z.object({ liverId: z.number(), roomId: z.number().optional() }))
        .mutation(async ({ input }) => {
          const db = await getDb();
          if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
          
          // Check if welcome message already exists
          const existing = await db
            .select()
            .from(aiCoachMessages)
            .where(and(
              eq(aiCoachMessages.liverId, input.liverId),
              eq(aiCoachMessages.messageType, 'welcome'),
            ))
            .limit(1);
          
          if (existing.length > 0) return { alreadyExists: true };
          
          const liver = await getLiverById(input.liverId);
          const liverName = liver?.name || 'ライバーさん';
          
          // Get sales data for personalized welcome
          const salesTrend = await getLiverMonthlySalesTrendById(input.liverId);
          const recentMonths = salesTrend.filter(m => m.totalSales > 0).slice(-3);
          
          let welcomeMsg = '';
          if (recentMonths.length > 0) {
            const latestMonth = recentMonths[recentMonths.length - 1];
            const hourlyRate = latestMonth.totalDuration > 0 ? Math.round(latestMonth.totalSales / (latestMonth.totalDuration / 60)) : 0;
            welcomeMsg = `${liverName}さん、はじめまして！🔥 LCJ 神コーチです！\n\nあなたの配信データを見させてもらいました。${latestMonth.label}は売上¥${latestMonth.totalSales.toLocaleString()}、時間単価¥${hourlyRate.toLocaleString()}/hですね！\n\nこれから一緒に、もっと売上を伸ばしていきましょう！💪 配信のこと、セットの組み方、何でも相談してくださいね。\n\n配信記録を保存するたびに、私が自動でフィードバックします。まずは気軽に話しかけてみてください！`;
          } else {
            welcomeMsg = `${liverName}さん、はじめまして！🔥 LCJ 神コーチです！\n\nこれからあなたのライブコマースの成長を全力でサポートします！💪\n\n配信記録を保存すると、私が自動でデータを分析してフィードバックします。セットの組み方や売上アップのコツなど、何でも相談してくださいね！\n\nまずは気軽に「こんにちは」と話しかけてみてください！`;
          }
          
          await db.insert(aiCoachMessages).values({
            liverId: input.liverId,
            roomId: input.roomId || null,
            role: 'ai',
            content: welcomeMsg,
            messageType: 'welcome',
            contextType: 'general',
          });
          
          return { alreadyExists: false, message: welcomeMsg };
        }),
      // Get all liver AI coach usage stats (master view)
      getAllLiverUsageStats: publicProcedure
        .query(async () => {
          const db = await getDb();
          if (!db) return [];
          
          // Get message counts and last activity per liver
          const stats = await db
            .select({
              liverId: aiCoachMessages.liverId,
              totalMessages: count(aiCoachMessages.id),
              lastMessageAt: max(aiCoachMessages.createdAt),
            })
            .from(aiCoachMessages)
            .groupBy(aiCoachMessages.liverId);
          
          // Get room counts per liver
          const roomStats = await db
            .select({
              liverId: aiCoachRooms.liverId,
              roomCount: count(aiCoachRooms.id),
            })
            .from(aiCoachRooms)
            .where(isNull(aiCoachRooms.deletedAt))
            .groupBy(aiCoachRooms.liverId);
          
          // Get user message counts (only user role)
          const userMsgStats = await db
            .select({
              liverId: aiCoachMessages.liverId,
              userMessages: count(aiCoachMessages.id),
            })
            .from(aiCoachMessages)
            .where(eq(aiCoachMessages.role, 'user'))
            .groupBy(aiCoachMessages.liverId);
          
          // Get liver names
          const allLivers = await db.select({ id: livers.id, name: livers.name }).from(livers);
          const liverMap = new Map(allLivers.map(l => [l.id, l.name]));
          const roomMap = new Map(roomStats.map(r => [r.liverId, r.roomCount]));
          const userMsgMap = new Map(userMsgStats.map(u => [u.liverId, u.userMessages]));
          
          return stats.map(s => ({
            liverId: s.liverId,
            liverName: liverMap.get(s.liverId) || `Liver #${s.liverId}`,
            totalMessages: s.totalMessages,
            userMessages: userMsgMap.get(s.liverId) || 0,
            roomCount: roomMap.get(s.liverId) || 0,
            lastMessageAt: s.lastMessageAt,
          })).sort((a, b) => (b.totalMessages) - (a.totalMessages));
        }),

      // Get conversation history for a specific liver (master view)
      getLiverConversations: publicProcedure
        .input(z.object({ liverId: z.number(), limit: z.number().optional().default(50) }))
        .query(async ({ input }) => {
          const db = await getDb();
          if (!db) return { rooms: [], messages: [] };
          
          const rooms = await db
            .select()
            .from(aiCoachRooms)
            .where(and(eq(aiCoachRooms.liverId, input.liverId), isNull(aiCoachRooms.deletedAt)))
            .orderBy(desc(aiCoachRooms.lastMessageAt));
          
          const messages = await db
            .select()
            .from(aiCoachMessages)
            .where(eq(aiCoachMessages.liverId, input.liverId))
            .orderBy(desc(aiCoachMessages.createdAt))
            .limit(input.limit);
          
          return { rooms, messages: messages.reverse() };
        }),

      // Get liver growth data with sets (ライバー成長データ+セット情報)
      getLiverGrowthData: publicProcedure
        .input(z.object({ liverId: z.number(), limit: z.number().optional().default(50) }))
        .query(async ({ input }) => {
          return await getLiverGrowthData(input.liverId, input.limit);
        }),
    }),

    // Get brand duration stats for a liver (管理者向け)
    getBrandDurationStats: publicProcedure
      .input(z.object({ liverId: z.number(), yearMonth: z.string().optional() }))
      .query(async ({ input }) => {
        return await getLiverBrandDurationStats(input.liverId, input.yearMonth);
      }),
  }),
  // Brand Files Router
  brandFiles: router({
    // Get all files for a brand
    list: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        const files = await getBrandFiles(input.brandId);
        return files;
      }),

    // Create a new file record
    create: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        fileName: z.string(),
        fileUrl: z.string(),
        fileKey: z.string(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await createBrandFile({
          brandId: input.brandId,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileKey: input.fileKey,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          uploadedBy: ctx.user.id,
          uploadedByName: ctx.user.name || ctx.user.email,
        });

        // Log the edit
        await logBrandEdit(
          input.brandId,
          "create",
          "memo", // Using memo as closest type for files
          result.id,
          input.fileName,
          `ファイル「${input.fileName}」をアップロードしました`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );

        return result;
      }),

    // Delete a file
    delete: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        brandId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteBrandFile(input.fileId, input.brandId);

        // Log the edit
        await logBrandEdit(
          input.brandId,
          "delete",
          "memo", // Using memo as closest type for files
          input.fileId,
          result.fileName,
          `ファイル「${result.fileName}」を削除しました`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
        );

        return result;
      }),
  }),

  // Product Links Router
  productLinks: router({
    // Get all links for a product
    list: protectedProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        const links = await getProductLinks(input.productId);
        return links;
      }),

    // Get links for multiple products
    listForProducts: protectedProcedure
      .input(z.object({ productIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        const links = await getProductLinksForProducts(input.productIds);
        return links;
      }),

    // Add a new link to a product
    add: protectedProcedure
      .input(z.object({
        productId: z.number(),
        title: z.string().min(1, "タイトルを入力してください"),
        url: z.string().url("有効なURLを入力してください"),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await addProductLink({
          productId: input.productId,
          title: input.title,
          url: input.url,
          createdBy: ctx.user.id,
        });

        // Get the product to find the brand for logging
        const product = await getBrandProductById(input.productId);
        if (product) {
          await logBrandEdit(
            product.brandId,
            "create",
            "product",
            input.productId,
            product.productName || "商品",
            `リンク「${input.title}」を追加しました`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }

        return result;
      }),

    // Update a link
    update: protectedProcedure
      .input(z.object({
        linkId: z.number(),
        title: z.string().min(1, "タイトルを入力してください").optional(),
        url: z.string().url("有効なURLを入力してください").optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { linkId, ...data } = input;
        const result = await updateProductLink(linkId, data);
        return result;
      }),

    // Delete a link
    delete: protectedProcedure
      .input(z.object({
        linkId: z.number(),
        productId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteProductLink(input.linkId);

        // Get the product to find the brand for logging
        const product = await getBrandProductById(input.productId);
        if (product) {
          await logBrandEdit(
            product.brandId,
            "delete",
            "product",
            input.productId,
            product.productName || "商品",
            `リンクを削除しました`,
            ctx.user.id,
            ctx.user.name || ctx.user.email
          );
        }

        return result;
      }),
  }),

  // Product Master Router (商品マスター管理)
  productMaster: router({
    // Get all product masters
    list: protectedProcedure
      .query(async () => {
        return await getProductMasters();
      }),

    // Get product master by ID with aliases
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const master = await getProductMasterById(input.id);
        if (!master) return null;
        const aliases = await getProductAliases(input.id);
        return { ...master, aliases };
      }),

    // Create a new product master
    create: protectedProcedure
      .input(z.object({
        canonicalName: z.string().min(1, "商品名を入力してください"),
        brandId: z.number().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await createProductMaster(input);
        return { id: result.id, success: true, updated: result.updated || false };
      }),

    // Update a product master
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        canonicalName: z.string().min(1).optional(),
        brandId: z.number().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await updateProductMaster(id, data);
      }),

    // Delete a product master
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteProductMaster(input.id);
      }),

    // Add an alias to a product master
    addAlias: protectedProcedure
      .input(z.object({
        productMasterId: z.number(),
        aliasName: z.string().min(1),
        matchMethod: z.enum(["manual", "ai_suggested", "auto"]).default("manual"),
      }))
      .mutation(async ({ ctx, input }) => {
        return await addProductAlias({
          productMasterId: input.productMasterId,
          aliasName: input.aliasName,
          matchMethod: input.matchMethod,
          isConfirmed: true,
          confirmedBy: ctx.user.id,
          confirmedAt: new Date(),
        });
      }),

    // Remove an alias
    removeAlias: protectedProcedure
      .input(z.object({ aliasId: z.number() }))
      .mutation(async ({ input }) => {
        return await removeProductAlias(input.aliasId);
      }),

    // Get unlinked product names
    getUnlinked: protectedProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return await getUnlinkedProductNames(input?.limit || 100);
      }),

    // Get product masters for matching
    getForMatching: protectedProcedure
      .query(async () => {
        return await getProductMastersForMatching();
      }),

    // Get pending alias suggestions
    getPendingSuggestions: protectedProcedure
      .query(async () => {
        return await getPendingAliasSuggestions();
      }),

    // Approve alias suggestion
    approveSuggestion: protectedProcedure
      .input(z.object({ suggestionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await approveAliasSuggestion(input.suggestionId, ctx.user.id);
      }),

    // Reject alias suggestion
    rejectSuggestion: protectedProcedure
      .input(z.object({ suggestionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await rejectAliasSuggestion(input.suggestionId, ctx.user.id);
      }),

    // AI auto-matching
    aiMatch: protectedProcedure
      .input(z.object({
        productNames: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        // Get existing masters for context
        const masters = await getProductMastersForMatching();
        
        // Build prompt for AI
        const existingProducts = masters.map((m: { canonicalName: string; aliases: string[] }) => 
          `- ${m.canonicalName}${m.aliases.length > 0 ? ` (別名: ${m.aliases.join(", ")})` : ""}`
        ).join("\n");
        
        const prompt = `以下の商品名の表記ゆれを分析し、既存の商品マスターとの紐付けを提案してください。

既存の商品マスター:
${existingProducts || "(なし)"}

分析対象の商品名:
${input.productNames.map((n: string) => `- ${n}`).join("\n")}

各商品名について、以下の形式でJSONを返してください:
{
  "suggestions": [
    {
      "aliasName": "分析対象の商品名",
      "matchType": "existing" | "new",
      "suggestedCanonicalName": "紐付け先の正式商品名（既存または新規）",
      "confidence": 0.0-1.0,
      "reasoning": "判断理由"
    }
  ]
}`;
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "あなたは商品名の表記ゆれを分析する専門家です。同じ商品の異なる表記を識別し、適切に紐付けてください。" },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "product_matching",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        aliasName: { type: "string" },
                        matchType: { type: "string", enum: ["existing", "new"] },
                        suggestedCanonicalName: { type: "string" },
                        confidence: { type: "number" },
                        reasoning: { type: "string" },
                      },
                      required: ["aliasName", "matchType", "suggestedCanonicalName", "confidence", "reasoning"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        });
        
        const content = response.choices[0].message.content;
        const result = JSON.parse(typeof content === 'string' ? content : "{}");
        
        // Save suggestions to database
        for (const suggestion of result.suggestions || []) {
          // Find master ID if matching existing
          let masterId = null;
          if (suggestion.matchType === "existing") {
            const existingMaster = masters.find((m: { canonicalName: string }) => 
              m.canonicalName === suggestion.suggestedCanonicalName
            );
            masterId = existingMaster?.id || null;
          }
          
          await createAliasSuggestion({
            aliasName: suggestion.aliasName,
            suggestedProductMasterId: masterId,
            suggestedCanonicalName: suggestion.suggestedCanonicalName,
            confidence: String(suggestion.confidence),
            reasoning: suggestion.reasoning,
            status: "pending",
          });
        }
        
        return result;
      }),

    // OGP画像自動取得（URLを入力するとog:imageを取得してS3に保存）
    fetchOgpImage: protectedProcedure
      .input(z.object({
        productMasterId: z.number(),
        sourceUrl: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        
        // 1. URLからOGP画像を取得
        const response = await fetch(input.sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; OGPFetcher/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
        });
        
        if (!response.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `URLの取得に失敗しました (${response.status})` });
        }
        
        const html = await response.text();
        
        // og:imageを抽出
        const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
        
        if (!ogImageMatch || !ogImageMatch[1]) {
          throw new TRPCError({ code: "NOT_FOUND", message: "OGP画像が見つかりませんでした" });
        }
        
        let imageUrl = ogImageMatch[1];
        // 相対URLを絶対URLに変換
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        } else if (imageUrl.startsWith('/')) {
          const urlObj = new URL(input.sourceUrl);
          imageUrl = urlObj.origin + imageUrl;
        }
        
        // 2. 画像をダウンロード
        const imgResponse = await fetch(imageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OGPFetcher/1.0)' },
          redirect: 'follow',
        });
        
        if (!imgResponse.ok) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `画像のダウンロードに失敗しました (${imgResponse.status})` });
        }
        
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        
        // 3. S3にアップロード
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `product-images/${input.productMasterId}-${randomSuffix}.${ext}`;
        const { url: s3Url } = await storagePut(fileKey, imgBuffer, contentType);
        
        // 4. DB更新
        await updateProductMaster(input.productMasterId, {
          sourceUrl: input.sourceUrl,
          imageUrl: s3Url,
          imageKey: fileKey,
          imageStatus: "auto_fetched",
          imageSource: "ogp",
        });
        
        return { success: true, imageUrl: s3Url, originalOgpUrl: imageUrl };
      }),

    // 手動画像アップロード（Base64画像を受け取ってS3に保存）
    uploadImage: protectedProcedure
      .input(z.object({
        productMasterId: z.number(),
        imageBase64: z.string(),
        contentType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const { storagePut } = await import("./storage");
        
        const imgBuffer = Buffer.from(input.imageBase64, 'base64');
        const ext = input.contentType.includes('png') ? 'png' : input.contentType.includes('webp') ? 'webp' : 'jpg';
        
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const fileKey = `product-images/${input.productMasterId}-manual-${randomSuffix}.${ext}`;
        const { url: s3Url } = await storagePut(fileKey, imgBuffer, input.contentType);
        
        await updateProductMaster(input.productMasterId, {
          imageUrl: s3Url,
          imageKey: fileKey,
          imageStatus: "confirmed",
          imageSource: "manual",
        });
        
        return { success: true, imageUrl: s3Url };
      }),

    // 画像ステータスを更新（確認済み/却下）
    updateImageStatus: protectedProcedure
      .input(z.object({
        productMasterId: z.number(),
        status: z.enum(["confirmed", "rejected"]),
      }))
      .mutation(async ({ input }) => {
        await updateProductMaster(input.productMasterId, {
          imageStatus: input.status,
        });
        return { success: true };
      }),

    // sourceUrlを更新
    updateSourceUrl: protectedProcedure
      .input(z.object({
        productMasterId: z.number(),
        sourceUrl: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        await updateProductMaster(input.productMasterId, {
          sourceUrl: input.sourceUrl,
        });
        return { success: true };
      }),

    // product_masterの画像リンクをクリア（レビューのスクショ画像にフォールバック）
    clearMasterImage: protectedProcedure
      .input(z.object({ productMasterId: z.number() }))
      .mutation(async ({ input }) => {
        await updateProductMaster(input.productMasterId, {
          imageUrl: null,
          sourceUrl: null,
          imageStatus: "none",
        });
        return { success: true };
      }),

    // 画像未設定の商品一覧
    withoutImages: protectedProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        const { sql, asc } = await import('drizzle-orm');
        return await db.select()
          .from(productMaster)
          .where(sql`${productMaster.imageUrl} IS NULL OR ${productMaster.imageStatus} = 'none' OR ${productMaster.imageStatus} = 'rejected'`)
          .orderBy(asc(productMaster.canonicalName));
      }),

    // レビュー商品一覧（ユニーク商品名 + レビュー数 + 平均評価 + product_master紐付け）
    reviewProductList: protectedProcedure
      .input(z.object({
        query: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(30),
        sortBy: z.enum(["reviewCount", "avgRating", "productName"]).default("reviewCount"),
        imageFilter: z.enum(["all", "with_image", "without_image"]).default("all"),
      }))
      .query(async ({ input }) => {
        return await getReviewProductList({
          query: input.query,
          page: input.page,
          limit: input.limit,
          sortBy: input.sortBy,
          imageFilter: input.imageFilter,
        });
      }),

    // 一括URL登録（商品名とURLのペアを受け取ってproduct_masterを更新）
    bulkUpdateUrls: protectedProcedure
      .input(z.object({
        pairs: z.array(z.object({
          productName: z.string().min(1),
          sourceUrl: z.string().url(),
        })).min(1).max(100),
      }))
      .mutation(async ({ input }) => {
        return await bulkUpdateProductSourceUrls(input.pairs);
      }),
  }),

  // CSV Import Router (TikTok配信パフォーマンスCSVインポート)
  csvImport: router({
    // Parse and import CSV data
    importLivestreams: publicProcedure
      .input(z.object({
        brandId: z.number(),
        liverId: z.number(),
        csvData: z.array(z.object({
          livestream: z.string(),
          startTime: z.string(),
          duration: z.number(), // in seconds
          grossRevenue: z.number(),
          directGmv: z.number(),
          itemsSold: z.number(),
          customers: z.number(),
          avgPrice: z.number(),
          ordersPaidFor: z.number(),
          gmvPer1kShows: z.string(),
          gmvPer1kViews: z.string(),
          views: z.number(),
          viewers: z.number(),
          peakViewers: z.number(),
          newFollowers: z.number(),
          avgViewDuration: z.number(), // in seconds
          likes: z.number(),
          comments: z.number(),
          shares: z.number(),
          productImpressions: z.number(),
          productClicks: z.number(),
          ctr: z.string(),
          ctor: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = {
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [] as string[],
        };

        // Get brand info for streamer name
        const brand = await getBrandById(input.brandId);
        const streamerName = brand?.name || "Unknown";

        for (const row of input.csvData) {
          try {
            // Parse start time as JST and convert to UTC
            // CSV dates from TikTok are in JST (Japan Standard Time, UTC+9)
            const jstDateStr = row.startTime;
            console.log('[CSV Import] Input date string:', jstDateStr);
            
            // Use ISO 8601 format for reliable parsing across all environments
            // Convert "2025-08-31 06:00" to "2025-08-31T06:00:00+09:00"
            const isoFormat = jstDateStr.replace(' ', 'T') + ':00+09:00';
            const startDate = new Date(isoFormat);
            console.log('[CSV Import] ISO format:', isoFormat);
            console.log('[CSV Import] Parsed UTC:', startDate.toISOString());
            const endDate = new Date(startDate.getTime() + row.duration * 1000);
            const durationMinutes = Math.round(row.duration / 60);

            // Check for existing livestream
            const existing = await findExistingLivestream(
              input.brandId,
              startDate,
              streamerName
            );

            const livestreamData = {
              brandId: input.brandId,
              liverId: input.liverId,
              livestreamDate: startDate,
              livestreamEndTime: endDate,
              streamerName,
              salesAmount: row.grossRevenue,
              gmv: row.directGmv,
              duration: durationMinutes,
              viewerCount: row.viewers,
              peakViewers: row.peakViewers,
              orderCount: row.ordersPaidFor,
              productClicks: row.productClicks,
              impressions: row.productImpressions,
              itemsSold: row.itemsSold,
              customerCount: row.customers,
              avgPrice: row.avgPrice,
              newFollowers: row.newFollowers,
              avgViewDuration: row.avgViewDuration,
              likes: row.likes,
              comments: row.comments,
              shares: row.shares,
              gmvPer1kShows: row.gmvPer1kShows,
              gmvPer1kViews: row.gmvPer1kViews,
              ctr: row.ctr,
              ctor: row.ctor,
              platform: "TikTok",
              createdBy: input.liverId, // Use liverId instead of ctx.user.id for liver auth
            };

            if (existing) {
              // Update existing record
              await updateLivestreamFromCsv(existing.id, livestreamData);
              results.updated++;
            } else {
              // Create new record
              await createLivestreamFromCsv(livestreamData as any);
              results.created++;
            }
          } catch (error) {
            results.errors.push(`Row ${row.startTime}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }

        // Save import history
        if (results.created > 0 || results.updated > 0) {
          // Calculate date range
          const dates = input.csvData.map(row => new Date(row.startTime)).filter(d => !isNaN(d.getTime()));
          const dateRangeStart = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
          const dateRangeEnd = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
          const totalGmv = input.csvData.reduce((sum, row) => sum + row.grossRevenue, 0);
          
          await createLivestreamCsvImportHistory({
            liverId: input.liverId,
            brandId: input.brandId,
            fileName: `TikTok配信データ_${new Date().toISOString().slice(0, 10)}.xlsx`,
            livestreamCount: input.csvData.length,
            createdCount: results.created,
            updatedCount: results.updated,
            totalGmv,
            dateRangeStart,
            dateRangeEnd,
            importedBy: input.liverId, // Use liverId for liver auth
            importedByName: "Liver Import", // Generic name for liver imports
          });
        }

        return results;
      }),

    // Get CSV imported livestreams
    getImported: publicProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getCsvImportedLivestreams(input.brandId);
      }),
      
    // Get import history for a liver
    getImportHistory: publicProcedure
      .input(z.object({ liverId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamCsvImportHistoryByLiver(input.liverId);
      }),
      
    // Delete import history and associated livestreams
    deleteImportHistory: publicProcedure
      .input(z.object({ historyId: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteLivestreamCsvImportHistory(input.historyId);
      }),
  }),

  // LCJ Point System
  point: router({
    // --- User-facing endpoints ---
    
    // Get current user's point balance
    getBalance: protectedProcedure.query(async ({ ctx }) => {
      const { getOrCreatePointBalance, getExpiringPoints } = await import("./db");
      const balance = await getOrCreatePointBalance(ctx.user.id);
      const expiring = await getExpiringPoints(ctx.user.id);
      return {
        ...balance,
        expiring: {
          in7Days: expiring.expiringIn7Days,
          in30Days: expiring.expiringIn30Days,
          in60Days: expiring.expiringIn60Days,
          breakdown: expiring.breakdown.map(b => ({
            expiresAt: b.expiresAt.getTime(),
            amount: b.amount,
          })),
        },
      };
    }),
    
    // Get current user's point transaction history
    getTransactions: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        const { getPointTransactions } = await import("./db");
        const transactions = await getPointTransactions(ctx.user.id, input);
        return transactions;
      }),
    
    // Get current user's receipt submissions
    getMyReceipts: protectedProcedure.query(async ({ ctx }) => {
      const { getReceiptsByUser } = await import("./db");
      const receipts = await getReceiptsByUser(ctx.user.id);
      return receipts;
    }),
    
    // Submit a new receipt
    submitReceipt: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const crypto = await import("crypto");
        const { 
          checkDuplicateReceiptByHash,
          getRecentReceiptsCount,
          createReceipt,
          updateReceiptOcr,
          checkDuplicateReceiptByDetails,
          updateReceiptFraudFlags,
          createFraudDetectionLog,
          updateReceiptStatus,
        } = await import("./db");
        
        // Generate image hash
        const imageHash = crypto.createHash("sha256").update(input.imageBase64).digest("hex");
        
        // Check for duplicate image
        const duplicateByHash = await checkDuplicateReceiptByHash(imageHash);
        if (duplicateByHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "このレシート画像は既に登録されています",
          });
        }
        
        // Check submission frequency (max 10 per 24 hours)
        const recentCount = await getRecentReceiptsCount(ctx.user.id, 24);
        if (recentCount >= 10) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "24時間以内の申請上限（10件）に達しています",
          });
        }
        
        // Upload image to S3
        const fileKey = `receipts/${ctx.user.id}/${Date.now()}-${nanoid(8)}.${input.mimeType.split("/")[1] || "jpg"}`;
        const buffer = Buffer.from(input.imageBase64, "base64");
        const { url: imageUrl } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Create receipt record
        const receiptId = await createReceipt({
          userId: ctx.user.id,
          imageUrl,
          imageKey: fileKey,
          imageHash,
          status: "pending",
        });
        
        // Run OCR analysis
        try {
          const ocrResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `あなたはレシート画像を解析するAIです。以下の情報を抽出してJSON形式で返してください：
- storeName: 店舗名
- purchaseDate: 購入日時（YYYY-MM-DD HH:mm形式）
- totalAmount: 合計金額（数値のみ、通貨記号なし）
- currency: 通貨コード（JPY, CNY, USD等）

抽出できない項目はnullを返してください。`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${input.mimeType};base64,${input.imageBase64}`,
                    },
                  },
                  {
                    type: "text",
                    text: "このレシート画像から情報を抽出してください。",
                  },
                ],
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "receipt_ocr",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    storeName: { type: ["string", "null"] },
                    purchaseDate: { type: ["string", "null"] },
                    totalAmount: { type: ["number", "null"] },
                    currency: { type: ["string", "null"] },
                    rawText: { type: ["string", "null"] },
                    confidence: { type: ["number", "null"] },
                  },
                  required: ["storeName", "purchaseDate", "totalAmount", "currency", "rawText", "confidence"],
                  additionalProperties: false,
                },
              },
            },
          });
          
          const messageContent = ocrResult.choices[0].message.content;
          const ocrData = JSON.parse(typeof messageContent === 'string' ? messageContent : "{}");
          
          // Calculate points (1% return)
          const pointsCalculated = ocrData.totalAmount ? Math.floor(ocrData.totalAmount * 0.01) : undefined;
          
          // Update receipt with OCR data
          await updateReceiptOcr(receiptId, {
            storeName: ocrData.storeName,
            purchaseDate: ocrData.purchaseDate ? new Date(ocrData.purchaseDate) : undefined,
            totalAmount: ocrData.totalAmount,
            currency: ocrData.currency || "JPY",
            ocrRawText: ocrData.rawText,
            ocrConfidence: ocrData.confidence?.toString(),
            pointsCalculated,
            imageHash,
          });
          
          // Run fraud detection
          const fraudFlags: string[] = [];
          let fraudScore = 0;
          
          // Check for expired receipt (older than 7 days)
          if (ocrData.purchaseDate) {
            const purchaseDate = new Date(ocrData.purchaseDate);
            const daysSincePurchase = (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSincePurchase > 7) {
              fraudFlags.push("expired_receipt");
              fraudScore += 50;
              await createFraudDetectionLog({
                receiptId,
                userId: ctx.user.id,
                checkType: "expired_receipt",
                detected: true,
                severity: "high",
                details: `購入日から${Math.floor(daysSincePurchase)}日経過（7日以内のみ有効）`,
              });
            }
          }
          
          // Check for duplicate receipt by details
          if (ocrData.storeName && ocrData.purchaseDate && ocrData.totalAmount) {
            const duplicateByDetails = await checkDuplicateReceiptByDetails(
              ctx.user.id,
              ocrData.storeName,
              new Date(ocrData.purchaseDate),
              ocrData.totalAmount,
              receiptId
            );
            if (duplicateByDetails) {
              fraudFlags.push("duplicate_receipt");
              fraudScore += 40;
              await createFraudDetectionLog({
                receiptId,
                userId: ctx.user.id,
                checkType: "duplicate_receipt",
                detected: true,
                severity: "medium",
                details: `同じ店舗・日付・金額のレシートが既に存在します`,
                relatedReceiptId: duplicateByDetails.id,
              });
            }
          }
          
          // Check for unusually high amount (over 100,000 JPY)
          if (ocrData.totalAmount && ocrData.totalAmount > 100000) {
            fraudFlags.push("high_amount");
            fraudScore += 20;
            await createFraudDetectionLog({
              receiptId,
              userId: ctx.user.id,
              checkType: "high_amount",
              detected: true,
              severity: "low",
              details: `高額購入: ¥${ocrData.totalAmount.toLocaleString()}`,
            });
          }
          
          // Update fraud flags
          if (fraudFlags.length > 0) {
            await updateReceiptFraudFlags(receiptId, fraudFlags, fraudScore);
            
            // Auto-hold if fraud score is high
            if (fraudScore >= 50) {
              await updateReceiptStatus(receiptId, "on_hold", 0, "自動保留: 不正検知スコアが高いため");
            }
          }
          
        } catch (error) {
          console.error("OCR analysis failed:", error);
        }
        
        return { success: true, receiptId };
      }),
    
    // --- Admin endpoints ---
    
    // Get all receipts (admin only)
    adminGetReceipts: protectedProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected", "on_hold"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getAllReceipts, getKakuhenResultsByReceiptIds } = await import("./db");
        const receipts = await getAllReceipts(input);
        
        // 確変チャンス情報をバッチ取得
        const receiptIds = receipts.map(r => r.receipt.id);
        let kakuhenMap: Record<number, { isKakuhen: boolean; boostedRate: string; actualPoints: number; tiktokUrl: string | null }> = {};
        if (receiptIds.length > 0) {
          try {
            const kakuhenResults = await getKakuhenResultsByReceiptIds("point_request", receiptIds);
            for (const kr of kakuhenResults) {
              kakuhenMap[kr.receiptId] = {
                isKakuhen: kr.isKakuhen,
                boostedRate: kr.boostedRate,
                actualPoints: kr.actualPoints,
                tiktokUrl: kr.tiktokUrl,
              };
            }
          } catch (err: any) {
            console.error("[Admin] Error fetching kakuhen results:", err.message);
          }
        }
        
        return receipts.map(r => ({
          ...r,
          kakuhen: kakuhenMap[r.receipt.id] || null,
        }));
      }),
    
    // Get receipt details (admin only)
    adminGetReceipt: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getReceiptById, getFraudLogsForReceipt } = await import("./db");
        const receipt = await getReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        const fraudLogs = await getFraudLogsForReceipt(input.id);
        return { receipt, fraudLogs };
      }),
    
    // Get pending receipts count (admin only)
    adminGetPendingCount: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
      }
      const { getPendingReceiptsCount } = await import("./db");
      return await getPendingReceiptsCount();
    }),
    
    // Update receipt OCR data (admin only)
    adminUpdateReceiptOcr: protectedProcedure
      .input(z.object({
        id: z.number(),
        storeName: z.string().optional(),
        purchaseDate: z.string().optional(),
        totalAmount: z.number().optional(),
        currency: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { updateReceiptOcr } = await import("./db");
        const { id, ...data } = input;
        let pointsCalculated: number | undefined;
        if (data.totalAmount !== undefined) {
          pointsCalculated = Math.floor(data.totalAmount * 0.01);
        }
        await updateReceiptOcr(id, {
          ...data,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          pointsCalculated,
        });
        return { success: true };
      }),
    
    // Approve receipt (admin only)
    adminApproveReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        pointsOverride: z.number().optional(),
        note: z.string().optional(),
        forceOverrideDuplicate: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getReceiptById, updateReceiptStatus, awardPointsForReceipt, confirmPendingReferral, getKakuhenResultByReceiptId } = await import("./db");
        const receipt = await getReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        if (receipt.status === "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "既に承認済みです" });
        }
        
        // 注文番号の必須チェック（独立カラム優先、フォールバックでocrRawTextから抽出）
        let orderNumber: string | null = (receipt as any).orderNumber || null;
        if (!orderNumber && receipt.ocrRawText) {
          try {
            const parsed = JSON.parse(receipt.ocrRawText);
            orderNumber = parsed.orderNumber || null;
          } catch {
            // regex fallback
            const match = receipt.ocrRawText.match(/\b(\d{16,19})\b/);
            orderNumber = match ? match[1] : null;
          }
        }
        if (!orderNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "注文番号が検出されていません。OCRデータを編集して注文番号を含めてから承認してください。" });
        }
        
        // 承認時にも注文番号の重複チェック（承認済みレシートとの重複のみブロック、未承認同士は警告のみ）
        // forceOverrideDuplicate が true の場合は重複チェックをスキップ（管理者最高権限）
        if (!input.forceOverrideDuplicate) {
          const { checkDuplicateOrderNumberGlobal } = await import("./db");
          const duplicateOrder = await checkDuplicateOrderNumberGlobal(orderNumber, input.id);
          if (duplicateOrder && duplicateOrder.status === "approved") {
            throw new TRPCError({ code: "CONFLICT", message: `注文番号 ${orderNumber} は既に承認済みのレシートで使用されています。重複申請のため承認できません。` });
          }
        } else {
          console.log(`[Admin Override] Force approving receipt #${input.id} despite duplicate order number: ${orderNumber}`);
        }
        
        // 確変チャンス結果を確認し、確変ポイント（1.5%）を適用
        let pointsToAward = input.pointsOverride ?? receipt.pointsCalculated ?? 0;
        let kakuhenApplied = false;
        if (!input.pointsOverride) {
          try {
            const kakuhenResult = await getKakuhenResultByReceiptId("point_request", input.id);
            if (kakuhenResult && kakuhenResult.isKakuhen && kakuhenResult.actualPoints > 0) {
              pointsToAward = kakuhenResult.actualPoints;
              kakuhenApplied = true;
              console.log(`[Kakuhen] Applied kakuhen points for receipt ${input.id}: ${receipt.pointsCalculated}pt → ${kakuhenResult.actualPoints}pt (rate: ${kakuhenResult.boostedRate}%)`);
            }
          } catch (err: any) {
            console.error(`[Kakuhen] Error checking kakuhen result for receipt ${input.id}:`, err.message);
          }
        }
        await updateReceiptStatus(input.id, "approved", ctx.user.id, input.note);
        if (pointsToAward > 0) {
          await awardPointsForReceipt(input.id, pointsToAward);
        }
        
        // Note: TikTok receipt system uses users.id, not line_users.id
        // Referral confirmation is handled by LINE receipt approval and MALL order payment
        
        // Record review log for AI learning
        try {
          await createReceiptReviewLog({
            receiptType: "web_receipt",
            receiptId: input.id,
            decision: "approved",
            ocrConfidence: receipt.ocrConfidence ?? undefined,
            totalAmount: receipt.totalAmount ?? undefined,
            hasOrderNumber: orderNumber ? "yes" : "no",
            imageCount: 1,
            fraudScore: receipt.fraudScore ?? undefined,
            fraudFlagCount: receipt.fraudFlags?.length ?? 0,
            pointsCalculated: receipt.pointsCalculated ?? undefined,
            pointsAwarded: pointsToAward,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record approval log:", logErr);
        }
        
        // Auto-create review with privacy-protected product image
        try {
          const { createAutoReviewOnApproval } = await import("./db");
          const reviewResult = await createAutoReviewOnApproval({
            receiptType: "point_request",
            receiptId: input.id,
            userId: receipt.userId,
            imageUrl: receipt.imageUrl,
            ocrRawText: receipt.ocrRawText,
            storeName: receipt.storeName,
            totalAmount: receipt.totalAmount,
          });
          if (reviewResult.reviewId) {
            console.log(`[Receipt] Auto-created review #${reviewResult.reviewId} for receipt #${input.id}`);
          } else {
            console.log(`[Receipt] Auto-review skipped for receipt #${input.id}: ${reviewResult.error}`);
          }
        } catch (reviewErr: any) {
          console.error(`[Receipt] Failed to auto-create review for receipt #${input.id}:`, reviewErr.message);
          // Don't throw - review creation failure shouldn't fail the approval
        }
        
        return { success: true, pointsAwarded: pointsToAward };
      }),
    
    // Reject receipt (admin only)
    adminRejectReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        note: z.string(),
        rejectionCategory: z.enum([
          "blurry_image", "missing_order_number", "missing_amount",
          "not_delivered", "duplicate", "wrong_store",
          "suspicious", "incomplete_info", "not_order_detail",
          "not_tiktok_shop", "partial_screenshot", "other",
        ]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getReceiptById, updateReceiptStatus } = await import("./db");
        const receipt = await getReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        await updateReceiptStatus(input.id, "rejected", ctx.user.id, input.note);
        
        // Record review log for AI learning
        try {
          await createReceiptReviewLog({
            receiptType: "web_receipt",
            receiptId: input.id,
            decision: "rejected",
            rejectionCategory: input.rejectionCategory ?? "other",
            rejectionNote: input.note,
            ocrConfidence: receipt.ocrConfidence ?? undefined,
            totalAmount: receipt.totalAmount ?? undefined,
            hasOrderNumber: receipt.ocrRawText ? "yes" : "no",
            imageCount: 1,
            fraudScore: receipt.fraudScore ?? undefined,
            fraudFlagCount: receipt.fraudFlags?.length ?? 0,
            pointsCalculated: receipt.pointsCalculated ?? undefined,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record rejection log:", logErr);
        }
        
        return { success: true };
      }),
    
    // Hold receipt (admin only)
    adminHoldReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        note: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getReceiptById, updateReceiptStatus } = await import("./db");
        const receipt = await getReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        await updateReceiptStatus(input.id, "on_hold", ctx.user.id, input.note);
        
        // Record review log for AI learning
        try {
          await createReceiptReviewLog({
            receiptType: "web_receipt",
            receiptId: input.id,
            decision: "on_hold",
            ocrConfidence: receipt.ocrConfidence ?? undefined,
            totalAmount: receipt.totalAmount ?? undefined,
            hasOrderNumber: receipt.ocrRawText ? "yes" : "no",
            imageCount: 1,
            fraudScore: receipt.fraudScore ?? undefined,
            fraudFlagCount: receipt.fraudFlags?.length ?? 0,
            pointsCalculated: receipt.pointsCalculated ?? undefined,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record hold log:", logErr);
        }
        
        return { success: true };
      }),
    
    // Get receipt statistics (admin only)
    adminGetStatistics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
      }
      const { getReceiptStatistics } = await import("./db");
      return await getReceiptStatistics();
    }),
    
    // --- LINE Receipt Admin endpoints ---
    
    // Get all LINE receipts (admin only)
    adminGetLineReceipts: protectedProcedure
      .input(z.object({
        status: z.enum(["pending", "approved", "rejected", "on_hold"]).optional(),
        statuses: z.array(z.enum(["pending", "approved", "rejected", "on_hold"])).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        searchText: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getAllLineReceipts, getKakuhenResultsByReceiptIds } = await import("./db");
        const receipts = await getAllLineReceipts({
          ...input,
          dateFrom: input?.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input?.dateTo ? new Date(input.dateTo) : undefined,
        });
        
        // 確変チャンス情報をバッチ取得
        const receiptIds = receipts.map(r => r.receipt.id);
        let kakuhenMap: Record<number, { isKakuhen: boolean; boostedRate: string; actualPoints: number; tiktokUrl: string | null }> = {};
        if (receiptIds.length > 0) {
          try {
            const kakuhenResults = await getKakuhenResultsByReceiptIds("line_receipt", receiptIds);
            for (const kr of kakuhenResults) {
              kakuhenMap[kr.receiptId] = {
                isKakuhen: kr.isKakuhen,
                boostedRate: kr.boostedRate,
                actualPoints: kr.actualPoints,
                tiktokUrl: kr.tiktokUrl,
              };
            }
          } catch (err: any) {
            console.error("[Admin] Error fetching kakuhen results:", err.message);
          }
        }
        
        return receipts.map(r => ({
          ...r,
          kakuhen: kakuhenMap[r.receipt.id] || null,
        }));
      }),
    
    // Get LINE receipt details (admin only)
    adminGetLineReceipt: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, getLineFraudLogsForReceipt } = await import("./db");
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        const fraudLogs = await getLineFraudLogsForReceipt(input.id);
        return { receipt, fraudLogs };
      }),
    
    // Get pending LINE receipts count (admin only)
    adminGetPendingLineCount: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
      }
      const { getPendingLineReceiptsCount } = await import("./db");
      return await getPendingLineReceiptsCount();
    }),
    
    // Update LINE receipt OCR data (admin only)
    adminUpdateLineReceiptOcr: protectedProcedure
      .input(z.object({
        id: z.number(),
        storeName: z.string().optional(),
        purchaseDate: z.string().optional(),
        totalAmount: z.number().optional(),
        currency: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { updateLineReceiptOcr } = await import("./db");
        const { id, ...data } = input;
        let pointsCalculated: number | undefined;
        if (data.totalAmount !== undefined) {
          pointsCalculated = Math.floor(data.totalAmount * 0.01);
        }
        await updateLineReceiptOcr(id, {
          ...data,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          pointsCalculated,
        });
        return { success: true };
      }),
    
    // Update LINE receipt order number manually (admin only)
    adminUpdateLineReceiptOrderNumber: protectedProcedure
      .input(z.object({
        id: z.number(),
        orderNumber: z.string().min(1, "注文番号を入力してください"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptOcr, checkDuplicateOrderNumberGlobal } = await import("./db");
        
        // Check duplicate order number
        const duplicate = await checkDuplicateOrderNumberGlobal(input.orderNumber, input.id);
        if (duplicate) {
          throw new TRPCError({ 
            code: "CONFLICT", 
            message: `注文番号 ${input.orderNumber} は既に他のレシートで使用されています。` 
          });
        }
        
        // Get current receipt to update ocrRawText JSON
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        
        // Parse existing ocrRawText or create new object
        let ocrData: any = {};
        if (receipt.ocrRawText) {
          try {
            ocrData = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText;
          } catch {
            ocrData = {};
          }
        }
        
        // Update order number in ocrRawText AND independent column
        ocrData.orderNumber = input.orderNumber;
        
        await updateLineReceiptOcr(input.id, {
          orderNumber: input.orderNumber,
          ocrRawText: JSON.stringify(ocrData),
        });
        
        return { success: true, orderNumber: input.orderNumber };
      }),
    
    // Batch AI re-recognize all pending receipts that lack totalAmount
    adminBatchReRecognize: protectedProcedure
      .input(z.object({
        receiptIds: z.array(z.number()),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptOcr } = await import("./db");
        const { invokeLLM } = await import("./_core/llm");
        
        const results: Array<{ id: number; success: boolean; totalAmount: number | null; orderNumber: string | null; shopName: string | null; confidence: number }> = [];
        
        // Process each receipt sequentially to avoid rate limits
        for (const receiptId of input.receiptIds) {
          try {
            const receipt = await getLineReceiptById(receiptId);
            if (!receipt) {
              results.push({ id: receiptId, success: false, totalAmount: null, orderNumber: null, shopName: null, confidence: 0 });
              continue;
            }
            
            // Collect all image URLs
            const allImageUrls: string[] = [];
            if (receipt.imageUrls && Array.isArray(receipt.imageUrls)) {
              allImageUrls.push(...receipt.imageUrls);
            } else if (receipt.imageUrl) {
              allImageUrls.push(receipt.imageUrl);
            }
            
            if (allImageUrls.length === 0) {
              results.push({ id: receiptId, success: false, totalAmount: null, orderNumber: null, shopName: null, confidence: 0 });
              continue;
            }
            
            // Build image contents for LLM
            const imageContents: any[] = allImageUrls.map(url => ({
              type: "image_url" as const,
              image_url: { url, detail: "high" as const },
            }));
            imageContents.push({
              type: "text" as const,
              text: `これらの${allImageUrls.length}枚の画像から注文情報を全て抽出してください。`,
            });
            
            const ocrResult = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `あなたはTikTok Shopの注文詳細画面のスクリーンショットを解析する専門AIです。
複数の画像が送信された場合、すべての画像を統合して情報を抽出してください。

以下の情報を抽出してJSON形式で返してください：

{
  "orderNumber": "string or null",
  "totalAmount": number or null,
  "shopName": "string or null",
  "productName": "string or null",
  "orderDate": "string (YYYY-MM-DD) or null",
  "isDelivered": true/false or null,
  "confidence": number (0-100)
}

=== 注文番号の抽出（最重要） ===
TikTok Shopの注文番号は「5」または「6」で始まる16〜19桁の数字列です。
画像内に存在する10桁以上の数字列を全て見つけ、16〜19桁で「5」「6」始まりのものを注文番号とする。
電話番号（080/090/070始まり11桁）や郵便番号（3桁-4桁）は除外。

=== 金額の抽出（重要） ===
「合計金額（税込）」「合計」「支払い金額」の横の金額を優先。
通貨記号（¥￥）とカンマを除去して数値のみ（例: ¥2,832 → 2832）。

=== 店舗名・商品名・日付・配達状況 ===
可能な限り抽出。見つからない項目はnull。

必ずJSON形式のみで回答（説明文は不要）。`,
                },
                {
                  role: "user",
                  content: imageContents,
                },
              ],
            });
            
            const messageContent = ocrResult.choices[0].message.content as string;
            let parsed: any = {};
            try {
              let jsonStr = typeof messageContent === "string" ? messageContent : "{}";
              if (jsonStr.includes("```json")) {
                jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
              } else if (jsonStr.includes("```")) {
                jsonStr = jsonStr.replace(/```\s*/g, "");
              }
              jsonStr = jsonStr.trim();
              const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
              }
            } catch { /* ignore parse errors */ }
            
            // Auto-save recognized data to DB
            const updateData: any = {};
            if (parsed.totalAmount && typeof parsed.totalAmount === "number" && parsed.totalAmount > 0) {
              updateData.totalAmount = parsed.totalAmount;
            }
            if (parsed.shopName && typeof parsed.shopName === "string") {
              updateData.storeName = parsed.shopName;
            }
            if (parsed.orderDate && typeof parsed.orderDate === "string") {
              try { updateData.purchaseDate = new Date(parsed.orderDate); } catch { /* ignore */ }
            }
            if (parsed.orderNumber && typeof parsed.orderNumber === "string") {
              updateData.orderNumber = parsed.orderNumber; // Save to independent column
              let ocrData: any = {};
              if (receipt.ocrRawText) {
                try { ocrData = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText; } catch { ocrData = {}; }
              }
              ocrData.orderNumber = parsed.orderNumber;
              if (parsed.shopName) ocrData.shopName = parsed.shopName;
              if (parsed.productName) ocrData.productName = parsed.productName;
              if (parsed.isDelivered !== null && parsed.isDelivered !== undefined) ocrData.isDelivered = parsed.isDelivered;
              updateData.ocrRawText = JSON.stringify(ocrData);
            }
            
            if (Object.keys(updateData).length > 0) {
              await updateLineReceiptOcr(receiptId, updateData);
            }
            
            results.push({
              id: receiptId,
              success: true,
              totalAmount: parsed.totalAmount || null,
              orderNumber: parsed.orderNumber || null,
              shopName: parsed.shopName || null,
              confidence: parsed.confidence || 0,
            });
          } catch (err) {
            results.push({ id: receiptId, success: false, totalAmount: null, orderNumber: null, shopName: null, confidence: 0 });
          }
        }
        
        return {
          results,
          totalProcessed: results.length,
          successCount: results.filter(r => r.success).length,
        };
      }),
    
    // AI re-recognize order number from receipt images
    adminReRecognizeOrderNumber: protectedProcedure
      .input(z.object({
        id: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptOcr } = await import("./db");
        const { invokeLLM } = await import("./_core/llm");
        
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        
        // Collect all image URLs
        const allImageUrls: string[] = [];
        if (receipt.imageUrls && Array.isArray(receipt.imageUrls)) {
          allImageUrls.push(...receipt.imageUrls);
        } else if (receipt.imageUrl) {
          allImageUrls.push(receipt.imageUrl);
        }
        
        if (allImageUrls.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "レシート画像が見つかりません" });
        }
        
        // Build image contents for LLM
        const imageContents: any[] = allImageUrls.map(url => ({
          type: "image_url" as const,
          image_url: { url, detail: "high" as const },
        }));
        imageContents.push({
          type: "text" as const,
          text: `これらの${allImageUrls.length}枚の画像から注文情報を全て抽出してください。`,
        });
        
        const ocrResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `あなたはTikTok Shopの注文詳細画面のスクリーンショットを解析する専門AIです。
複数の画像が送信された場合、すべての画像を統合して情報を抽出してください。

以下の情報を抽出してJSON形式で返してください：

{
  "orderNumber": "string or null",
  "totalAmount": number or null,
  "shopName": "string or null",
  "productName": "string or null",
  "orderDate": "string (YYYY-MM-DD) or null",
  "isDelivered": true/false or null,
  "confidence": number (0-100)
}

=== 注文番号の抽出（最重要） ===

TikTok Shopの注文番号は「5」または「6」で始まる16〜19桁の数字列です。
例: 5819000585822879​71, 5824489836811172498, 682307265940784437

【ステップ1: 画像全体をスキャンして長い数字列を全て列挙する】
画像内に存在する10桁以上の数字列を全て見つけてください。
特に以下の場所を重点的にチェック：
- 画面の最下部（「さらに表示」の直上）
- 「注文番号」「注文番号:」というラベルの右側
- 「合計金額（税込）」の行の下
- コピーアイコン（📋 🔗 ⧉）の左側

【ステップ2: 注文番号を特定する】
- 16〜19桁の数字列
- 「5」または「6」で始まる
- 電話番号（080/090/070で始まる11桁）ではない
- 郵便番号（3桁-4桁）ではない

=== 金額の抽出（重要） ===

金額の抽出は注文番号の次に重要です。

【金額の探し方】
1. 「合計金額（税込）」「合計」「支払い金額」「お支払い合計」の横の金額
2. 「小計」「税込合計」の横の金額
3. 最も大きな金額表示（通常は合計）
4. 「¥」「￥」記号の横の数字

【金額の変換ルール】
- 通貨記号（¥￥）とカンマを除去して数値のみ（例: ¥2,832 → 2832）
- 「円」も除去（例: 11,980円 → 11980）
- 小数点がある場合は整数に丸める
- 商品単価ではなく合計金額を優先

=== 店舗名の抽出 ===
- 「販売者」「ショップ」「ストア」の横の名前
- ブランド名やショップロゴの横のテキスト
- 見つからない場合は"TikTok Shop"とする

=== 商品名の抽出 ===
- 商品画像の横のテキスト
- 複数商品がある場合は最初の商品名

=== 注文日の抽出 ===
- 「注文日」「購入日」「注文日時」の横の日付
- YYYY-MM-DD形式で返す（例: 2026-01-15）
- 「2026年1月15日」→ "2026-01-15"
- 「2026/01/15」→ "2026-01-15"

=== 配達済みの判定 ===
- 「配達済み」「X月X日に配達」「Delivered」があればtrue
- プログレスバーで「配達済み」が完了していればtrue

=== 出力ルール ===
- 必ずJSON形式のみで回答（説明文は不要）
- 抽出できない項目はnullを返す
- confidenceは全体の抽出精度（0-100）`,
            },
            {
              role: "user",
              content: imageContents,
            },
          ],
        });
        
        const messageContent = ocrResult.choices[0].message.content as string;
        let parsed: any = {};
        try {
          let jsonStr = typeof messageContent === "string" ? messageContent : "{}";
          // Remove markdown code blocks if present
          if (jsonStr.includes("```json")) {
            jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
          } else if (jsonStr.includes("```")) {
            jsonStr = jsonStr.replace(/```\s*/g, "");
          }
          jsonStr = jsonStr.trim();
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // ignore parse errors
        }
        
        // Auto-save recognized data to DB
        const updateData: any = {};
        if (parsed.totalAmount && typeof parsed.totalAmount === "number" && parsed.totalAmount > 0) {
          updateData.totalAmount = parsed.totalAmount;
        }
        if (parsed.shopName && typeof parsed.shopName === "string") {
          updateData.storeName = parsed.shopName;
        }
        if (parsed.orderDate && typeof parsed.orderDate === "string") {
          try {
            updateData.purchaseDate = new Date(parsed.orderDate);
          } catch { /* ignore invalid date */ }
        }
        if (parsed.orderNumber && typeof parsed.orderNumber === "string") {
          // Update ocrRawText with new order number
          let ocrData: any = {};
          if (receipt.ocrRawText) {
            try {
              ocrData = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText;
            } catch { ocrData = {}; }
          }
          ocrData.orderNumber = parsed.orderNumber;
          if (parsed.shopName) ocrData.shopName = parsed.shopName;
          if (parsed.productName) ocrData.productName = parsed.productName;
          if (parsed.isDelivered !== null && parsed.isDelivered !== undefined) ocrData.isDelivered = parsed.isDelivered;
          updateData.ocrRawText = JSON.stringify(ocrData);
        }
        
        // Save confidence to DB
        if (parsed.confidence && typeof parsed.confidence === "number") {
          updateData.ocrConfidence = parsed.confidence.toString();
        }
        
        // Save to DB if we have any data to update
        if (Object.keys(updateData).length > 0) {
          await updateLineReceiptOcr(input.id, updateData);
        }
        
        return {
          success: true,
          orderNumber: parsed.orderNumber || null,
          totalAmount: (parsed.totalAmount && typeof parsed.totalAmount === "number") ? parsed.totalAmount : null,
          shopName: parsed.shopName || null,
          productName: parsed.productName || null,
          orderDate: parsed.orderDate || null,
          isDelivered: parsed.isDelivered ?? null,
          confidence: parsed.confidence || 0,
        };
      }),
    
    // Approve LINE receipt (admin only)
    adminApproveLineReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        pointsOverride: z.number().optional(),
        note: z.string().optional(),
        orderNumber: z.string().optional(),
        forceOverrideDuplicate: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptStatus, awardPointsForLineReceipt, getLinePointBalance, confirmPendingReferral, getLineUserByLineId, updateLineReceiptOcr, getKakuhenResultByReceiptId } = await import("./db");
        const { pushMessage } = await import("./line");
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        if (receipt.status === "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "既に承認済みです" });
        }
        
        // If orderNumber is passed from frontend, save it to DB first
        if (input.orderNumber) {
          let ocrData: any = {};
          if (receipt.ocrRawText) {
            try {
              ocrData = typeof receipt.ocrRawText === "string" ? JSON.parse(receipt.ocrRawText) : receipt.ocrRawText;
            } catch {
              ocrData = {};
            }
          }
          ocrData.orderNumber = input.orderNumber;
          await updateLineReceiptOcr(input.id, {
            ocrRawText: JSON.stringify(ocrData),
          });
          // Re-fetch receipt with updated data
          const updatedReceipt = await getLineReceiptById(input.id);
          if (updatedReceipt) {
            Object.assign(receipt, updatedReceipt);
          }
        }
        
        // 注文番号の必須チェック（ocrRawTextから抽出）
        let orderNumber: string | null = input.orderNumber || null;
        if (!orderNumber && receipt.ocrRawText) {
          try {
            const parsed = JSON.parse(receipt.ocrRawText);
            orderNumber = parsed.orderNumber || null;
          } catch {
            const match = receipt.ocrRawText.match(/\b(\d{16,19})\b/);
            orderNumber = match ? match[1] : null;
          }
        }
        if (!orderNumber) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "注文番号が検出されていません。OCRデータを編集して注文番号を含めてから承認してください。" });
        }
        
        // 承認時にも注文番号の重複チェック（承認済みレシートとの重複のみブロック、未承認同士は警告のみ）
        // forceOverrideDuplicate が true の場合は重複チェックをスキップ（管理者最高権限）
        if (!input.forceOverrideDuplicate) {
          const { checkDuplicateOrderNumberGlobal } = await import("./db");
          const duplicateOrder = await checkDuplicateOrderNumberGlobal(orderNumber, input.id);
          if (duplicateOrder && duplicateOrder.status === "approved") {
            throw new TRPCError({ code: "CONFLICT", message: `注文番号 ${orderNumber} は既に承認済みのレシートで使用されています。重複申請のため承認できません。` });
          }
        } else {
          console.log(`[Admin Override] Force approving LINE receipt #${input.id} despite duplicate order number: ${orderNumber}`);
        }
        
        // 確変チャンス結果を確認し、確変ポイント（1.5%）を適用
        let pointsToAward = input.pointsOverride ?? receipt.pointsCalculated ?? 0;
        let kakuhenApplied = false;
        if (!input.pointsOverride) {
          try {
            const kakuhenResult = await getKakuhenResultByReceiptId("line_receipt", input.id);
            if (kakuhenResult && kakuhenResult.isKakuhen && kakuhenResult.actualPoints > 0) {
              pointsToAward = kakuhenResult.actualPoints;
              kakuhenApplied = true;
              console.log(`[Kakuhen] Applied kakuhen points for LINE receipt ${input.id}: ${receipt.pointsCalculated}pt → ${kakuhenResult.actualPoints}pt (rate: ${kakuhenResult.boostedRate}%)`);
            }
          } catch (err: any) {
            console.error(`[Kakuhen] Error checking kakuhen result for LINE receipt ${input.id}:`, err.message);
          }
        }
        await updateLineReceiptStatus(input.id, "approved", ctx.user.id, input.note);
        if (pointsToAward > 0) {
          await awardPointsForLineReceipt(input.id, pointsToAward);
        }
        
        // Check and confirm pending referral (award points on first purchase)
        try {
          const lineUserRecord = await getLineUserByLineId(receipt.lineUserId);
          if (lineUserRecord) {
            const result = await confirmPendingReferral(receipt.lineUserId, lineUserRecord.id);
            if (result) {
              console.log(`[Referral] Confirmed referral for LINE user ${lineUserRecord.id}: new user +${result.newUserPoints}pt, referrer +${result.referrerPoints}pt`);
            }
          }
        } catch (refErr: any) {
          console.error(`[Referral] Error confirming referral on LINE receipt approval:`, refErr.message);
        }
        
        // Record review log for AI learning
        try {
          await createReceiptReviewLog({
            receiptType: "line_receipt",
            receiptId: input.id,
            decision: "approved",
            ocrConfidence: receipt.ocrConfidence ?? undefined,
            totalAmount: receipt.totalAmount ?? undefined,
            hasOrderNumber: orderNumber ? "yes" : "no",
            imageCount: receipt.imageUrls?.length ?? 1,
            fraudScore: receipt.fraudScore ?? undefined,
            fraudFlagCount: receipt.fraudFlags?.length ?? 0,
            pointsCalculated: receipt.pointsCalculated ?? undefined,
            pointsAwarded: pointsToAward,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record LINE receipt approval log:", logErr);
        }
        
        // Record AI feedback if this was a force-submitted (AI-rejected) receipt
        if (receipt.isForceSubmitted && receipt.aiRejectionCategory) {
          try {
            const { createAiReviewFeedback } = await import("./db");
            await createAiReviewFeedback({
              receiptId: input.id,
              receiptType: "line_receipt",
              aiDecision: receipt.aiRejectionCategory as "not_tiktok" | "not_delivered" | "incomplete" | "other",
              aiRejectionReason: receipt.aiRejectionReason || undefined,
              humanDecision: "approved",
              humanNote: input.note || undefined,
              aiWasCorrect: false, // AIが弾いたが管理者が承認 = AIの判断ミス
              imageUrl: receipt.imageUrl || undefined,
              imageUrls: receipt.imageUrls || undefined,
              ocrRawText: receipt.ocrRawText || undefined,
              totalAmount: receipt.totalAmount ?? undefined,
              storeName: receipt.storeName || undefined,
              ocrConfidence: receipt.ocrConfidence ?? undefined,
              reviewedBy: ctx.user.id,
            });
            console.log(`[AI Feedback] Recorded: AI rejected (${receipt.aiRejectionCategory}) but human approved receipt #${input.id}`);
          } catch (fbErr) {
            console.error("[AI Feedback] Failed to record feedback:", fbErr);
          }
        }
        
        // Extract product data for purchase ranking
        try {
          await extractSingleReceiptProducts(input.id);
          console.log(`[LINE Receipt] Extracted products for receipt #${input.id}`);
        } catch (extractErr) {
          console.error(`[LINE Receipt] Failed to extract products for receipt #${input.id}:`, extractErr);
        }
        
        // Auto-create review with privacy-protected product image
        try {
          const { createAutoReviewOnApproval } = await import("./db");
          const reviewResult = await createAutoReviewOnApproval({
            receiptType: "line_receipt",
            receiptId: input.id,
            lineUserId: receipt.lineUserId,
            imageUrl: receipt.imageUrl,
            ocrRawText: receipt.ocrRawText,
            storeName: receipt.storeName,
            totalAmount: receipt.totalAmount,
          });
          if (reviewResult.reviewId) {
            console.log(`[LINE Receipt] Auto-created review #${reviewResult.reviewId} for receipt #${input.id}`);
          } else {
            console.log(`[LINE Receipt] Auto-review skipped for receipt #${input.id}: ${reviewResult.error}`);
          }
        } catch (reviewErr: any) {
          console.error(`[LINE Receipt] Failed to auto-create review for receipt #${input.id}:`, reviewErr.message);
          // Don't throw - review creation failure shouldn't fail the approval
        }
        
        // Send LINE notification to user
        try {
          const balance = await getLinePointBalance(receipt.lineUserId);
          const newBalance = balance?.balance ?? pointsToAward;
          const storeName = receipt.storeName || "不明";
          const amount = receipt.totalAmount ? `¥${receipt.totalAmount.toLocaleString()}` : "不明";
          
          const appUrl = process.env.APP_URL || "https://lcjmall.com";
          const message = `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
          
          await pushMessage(receipt.lineUserId, [{ type: "text", text: message }]);
          console.log(`[LINE Receipt] Sent approval notification to ${receipt.lineUserId}`);
        } catch (notifyError) {
          console.error("[LINE Receipt] Failed to send approval notification:", notifyError);
          // Don't throw - notification failure shouldn't fail the approval
        }
        
        return { success: true, pointsAwarded: pointsToAward };
      }),
    
    // Reject LINE receipt (admin only)
    adminRejectLineReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        note: z.string().optional(),
        rejectionCategory: z.enum([
          "blurry_image", "missing_order_number", "missing_amount",
          "not_delivered", "duplicate", "wrong_store",
          "suspicious", "incomplete_info", "not_order_detail",
          "not_tiktok_shop", "partial_screenshot", "other",
        ]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptStatus } = await import("./db");
        const { pushMessage } = await import("./line");
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        await updateLineReceiptStatus(input.id, "rejected", ctx.user.id, input.note || "不承認");
        
        // Send LINE notification: receipt images + rejection message + guide image
        try {
          const appUrl = process.env.APP_URL || "https://lcjmall.com";
          
          // 1. Send back the customer's receipt images
          const allImageUrls: string[] = [];
          if (receipt.imageUrls && Array.isArray(receipt.imageUrls)) {
            allImageUrls.push(...receipt.imageUrls);
          } else if (receipt.imageUrl) {
            allImageUrls.push(receipt.imageUrl);
          }
          
          for (const imgUrl of allImageUrls) {
            try {
              await pushMessage(receipt.lineUserId, [
                {
                  type: "image" as any,
                  originalContentUrl: imgUrl,
                  previewImageUrl: imgUrl,
                } as any,
              ]);
            } catch (imgErr) {
              console.error("[LINE Receipt] Failed to send receipt image:", imgErr);
            }
          }
          
          // 2. Send rejection message with instructions - include specific reason
          const rejectionReasonMap: Record<string, string> = {
            blurry_image: "画像が不鮮明で内容が読み取れません",
            missing_order_number: "注文番号が確認できません",
            missing_amount: "合計金額が確認できません",
            not_delivered: "配達済みのステータスが確認できません",
            duplicate: "同じ注文番号で既に申請済みです",
            wrong_store: "対象外の店舗のレシートです",
            suspicious: "画像に不審な点があります",
            incomplete_info: "必要な情報が不足しています",
            not_order_detail: "注文詳細画面ではありません（メール通知や配送通知の画面は不可）",
            not_tiktok_shop: "TikTok Shop以外のプラットフォームのレシートです",
            partial_screenshot: "スクリーンショットが不完全です（全体が写るように撮ってください）",
            other: "内容を確認してください",
          };
          const reasonText = rejectionReasonMap[input.rejectionCategory] || "内容を確認してください";
          const message = `❌ 不承認です

【理由】${reasonText}

上の写真の内容をご確認の上、以下の情報が見えるようにスクリーンショットを撮り直してください🙏

① 配達ステータス（配達済み）
② 注文番号
③ 合計金額（税込）

※ 1枚に収まらない場合は2〜3枚に分けて送信OK

下の画像を参考にしてください⬇️`;
          
          await pushMessage(receipt.lineUserId, [{ type: "text", text: message }]);
          
          // 3. Send guide image
          const guideImageUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663045992616/GbfvQYedFwWUdlAN.png";
          await pushMessage(receipt.lineUserId, [
            {
              type: "image" as any,
              originalContentUrl: guideImageUrl,
              previewImageUrl: guideImageUrl,
            } as any,
          ]);
          
          console.log(`[LINE Receipt] Sent rejection notification (images + message + guide) to ${receipt.lineUserId}`);
        } catch (notifyError) {
          console.error("[LINE Receipt] Failed to send rejection notification:", notifyError);
          // Don't throw - notification failure shouldn't fail the rejection
        }
        
        // Record review log for AI learning
        try {
          let hasOrder: "yes" | "no" = "no";
          if (receipt.ocrRawText) {
            try {
              const parsed = JSON.parse(receipt.ocrRawText);
              if (parsed.orderNumber) hasOrder = "yes";
            } catch { /* ignore */ }
          }
          await createReceiptReviewLog({
            receiptType: "line_receipt",
            receiptId: input.id,
            decision: "rejected",
            rejectionCategory: input.rejectionCategory ?? "other",
            rejectionNote: input.note || "不承認",
            ocrConfidence: receipt.ocrConfidence ?? undefined,
            totalAmount: receipt.totalAmount ?? undefined,
            hasOrderNumber: hasOrder,
            imageCount: receipt.imageUrls?.length ?? 1,
            fraudScore: receipt.fraudScore ?? undefined,
            fraudFlagCount: receipt.fraudFlags?.length ?? 0,
            pointsCalculated: receipt.pointsCalculated ?? undefined,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record LINE receipt rejection log:", logErr);
        }
        
        // Record AI feedback if this was a force-submitted (AI-rejected) receipt
        if (receipt.isForceSubmitted && receipt.aiRejectionCategory) {
          try {
            const { createAiReviewFeedback } = await import("./db");
            await createAiReviewFeedback({
              receiptId: input.id,
              receiptType: "line_receipt",
              aiDecision: receipt.aiRejectionCategory as "not_tiktok" | "not_delivered" | "incomplete" | "other",
              aiRejectionReason: receipt.aiRejectionReason || undefined,
              humanDecision: "rejected",
              humanNote: input.note || undefined,
              aiWasCorrect: true, // AIが弾いて管理者も却下 = AIの判断が正しかった
              imageUrl: receipt.imageUrl || undefined,
              imageUrls: receipt.imageUrls || undefined,
              ocrRawText: receipt.ocrRawText || undefined,
              totalAmount: receipt.totalAmount ?? undefined,
              storeName: receipt.storeName || undefined,
              ocrConfidence: receipt.ocrConfidence ?? undefined,
              reviewedBy: ctx.user.id,
            });
            console.log(`[AI Feedback] Recorded: AI rejected (${receipt.aiRejectionCategory}) and human also rejected receipt #${input.id}`);
          } catch (fbErr) {
            console.error("[AI Feedback] Failed to record feedback:", fbErr);
          }
        }
        
        return { success: true };
      }),
    
    // Hold LINE receipt (admin only)
    adminHoldLineReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        note: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptStatus } = await import("./db");
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        await updateLineReceiptStatus(input.id, "on_hold", ctx.user.id, input.note);
        
        // Send LINE notification to user about hold status
        try {
          const { pushMessage } = await import("./line");
          const storeName = receipt.storeName || "TikTok Shop";
          const message = `お送りいただいたレシートを確認中です。\n\n🏠 店舗名: ${storeName}\n📝 理由: ${input.note}\n\n確認が完了しましたら結果をお知らせします。\nしばらくお待ちください。`;
          await pushMessage(receipt.lineUserId, [{ type: "text", text: message }]);
          console.log(`[LINE Receipt] Sent hold notification to ${receipt.lineUserId}`);
        } catch (notifyError) {
          console.error("[LINE Receipt] Failed to send hold notification:", notifyError);
        }
        
        // Record review log for AI learning
        try {
          await createReceiptReviewLog({
            receiptType: "line_receipt",
            receiptId: input.id,
            decision: "on_hold",
            ocrConfidence: receipt.ocrConfidence ?? undefined,
            totalAmount: receipt.totalAmount ?? undefined,
            hasOrderNumber: receipt.ocrRawText ? "yes" : "no",
            imageCount: receipt.imageUrls?.length ?? 1,
            fraudScore: receipt.fraudScore ?? undefined,
            fraudFlagCount: receipt.fraudFlags?.length ?? 0,
            pointsCalculated: receipt.pointsCalculated ?? undefined,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record LINE receipt hold log:", logErr);
        }
        
        return { success: true };
      }),
    
    // Restore rejected LINE receipt back to pending (admin override)
    adminRestoreLineReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptStatus } = await import("./db");
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        if (receipt.status === "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "既に承認済みのレシートは恢復できません" });
        }
        if (receipt.status === "pending" || receipt.status === "on_hold") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "このレシートは既に審査待ち状態です" });
        }
        
        const restoreNote = `[管理者恢復] ${input.note || "管理者による手動恢復"}`;
        await updateLineReceiptStatus(input.id, "pending", ctx.user.id, restoreNote);
        console.log(`[Admin Restore] Restored LINE receipt #${input.id} from ${receipt.status} to pending by user #${ctx.user.id}`);
        
        return { success: true, previousStatus: receipt.status };
      }),
    
    // Manual point award for LINE receipt (admin override - bypasses all checks)
    adminManualAwardPoints: protectedProcedure
      .input(z.object({
        receiptId: z.number(),
        receiptType: z.enum(["line_receipt", "point_request"]),
        points: z.number().min(1, "ポイントは1以上です"),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        
        if (input.receiptType === "line_receipt") {
          const { getLineReceiptById, updateLineReceiptStatus, awardPointsForLineReceipt, getLinePointBalance } = await import("./db");
          const { pushMessage } = await import("./line");
          const receipt = await getLineReceiptById(input.receiptId);
          if (!receipt) {
            throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
          }
          
          // Force approve if not already approved
          if (receipt.status !== "approved") {
            await updateLineReceiptStatus(input.receiptId, "approved", ctx.user.id, 
              `[管理者手動承認] ${input.note || "管理者による手動ポイント付与"}`);
          }
          
          // Award points (bypasses idempotent check by updating pointsAwarded first)
          const result = await awardPointsForLineReceipt(input.receiptId, input.points);
          console.log(`[Admin Manual Award] Awarded ${input.points}pt for LINE receipt #${input.receiptId} by user #${ctx.user.id}. Skipped: ${result.skipped}`);
          
          // Send LINE notification
          try {
            const balance = await getLinePointBalance(receipt.lineUserId);
            const newBalance = balance?.balance ?? input.points;
            const storeName = receipt.storeName || "不明";
            const amount = receipt.totalAmount ? `¥${receipt.totalAmount.toLocaleString()}` : "不明";
            const appUrl = process.env.APP_URL || "https://lcjmall.com";
            const message = `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${input.points}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
            await pushMessage(receipt.lineUserId, [{ type: "text", text: message }]);
          } catch (notifyErr) {
            console.error("[Admin Manual Award] Failed to send LINE notification:", notifyErr);
          }
          
          return { success: true, pointsAwarded: input.points, skipped: result.skipped };
        } else {
          // point_request type
          const { getPointRequestById, updateReceiptStatus, awardPointsForReceipt } = await import("./db");
          const request = await getPointRequestById(input.receiptId);
          if (!request) {
            throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
          }
          
          if (request.status !== "approved") {
            await updateReceiptStatus(input.receiptId, "approved", ctx.user.id,
              `[管理者手動承認] ${input.note || "管理者による手動ポイント付与"}`);
          }
          
          const result = await awardPointsForReceipt(input.receiptId, input.points);
          console.log(`[Admin Manual Award] Awarded ${input.points}pt for point request #${input.receiptId} by user #${ctx.user.id}`);
          
          return { success: true, pointsAwarded: input.points };
        }
      }),
    
    // Retroactive point award for receipts that were approved but got 0pt due to bug
    retroactivePointAward: protectedProcedure
      .input(z.object({ dryRun: z.boolean().default(true) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { awardPointsForLineReceipt, getLinePointBalance } = await import("./db");
        const { pushMessage } = await import("./line");
        const dbMod = await import("./db");
        const dbInstance = dbMod.db ?? (await dbMod.getDb?.());
        if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
        const { lineReceipts } = await import("../drizzle/schema");
        const { and, eq, gt, isNull, or, sql } = await import("drizzle-orm");

        // Find all approved receipts with pointsCalculated > 0 but pointsAwarded is NULL or 0
        const affected = await dbInstance
          .select({
            id: lineReceipts.id,
            lineUserId: lineReceipts.lineUserId,
            totalAmount: lineReceipts.totalAmount,
            pointsCalculated: lineReceipts.pointsCalculated,
            pointsAwarded: lineReceipts.pointsAwarded,
            storeName: lineReceipts.storeName,
          })
          .from(lineReceipts)
          .where(
            and(
              eq(lineReceipts.status, "approved"),
              gt(lineReceipts.pointsCalculated, 0),
              or(
                isNull(lineReceipts.pointsAwarded),
                eq(lineReceipts.pointsAwarded, 0)
              )
            )
          );

        if (input.dryRun) {
          const totalPoints = affected.reduce((sum, r) => sum + (Number(r.pointsCalculated) || 0), 0);
          return {
            dryRun: true,
            affectedCount: affected.length,
            totalPoints,
            samples: affected.slice(0, 10).map(r => ({
              id: r.id,
              lineUserId: r.lineUserId,
              totalAmount: Number(r.totalAmount),
              pointsCalculated: Number(r.pointsCalculated),
              storeName: r.storeName,
            })),
          };
        }

        // Execute retroactive award
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        let totalPointsAwarded = 0;
        const errors: Array<{ id: number; error: string }> = [];

        for (const receipt of affected) {
          const pts = Number(receipt.pointsCalculated) || 0;
          if (pts <= 0) { skipCount++; continue; }
          try {
            const result = await awardPointsForLineReceipt(receipt.id, pts);
            if (result.skipped) {
              skipCount++;
            } else {
              successCount++;
              totalPointsAwarded += pts;
              // Send LINE notification (best effort)
              try {
                const balance = await getLinePointBalance(receipt.lineUserId);
                const newBalance = balance?.balance ?? pts;
                const storeName = receipt.storeName || "不明";
                const amount = receipt.totalAmount ? `¥${Number(receipt.totalAmount).toLocaleString()}` : "不明";
                const appUrl = process.env.APP_URL || "https://lcjmall.com";
                const message = `🎉 ポイント付与のお知らせ\n\nシステム修正により、以下のレシートのポイントが付与されました：\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pts}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご迷惑をおかけして申し訳ございません。\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
                await pushMessage(receipt.lineUserId, [{ type: "text", text: message }]);
              } catch (notifyErr) {
                // Notification failure should not block the award
                console.error(`[Retroactive] LINE notification failed for receipt #${receipt.id}:`, notifyErr);
              }
            }
          } catch (err: any) {
            errorCount++;
            errors.push({ id: receipt.id, error: err.message });
            console.error(`[Retroactive] Failed to award points for receipt #${receipt.id}:`, err.message);
          }
        }

        console.log(`[Retroactive Award] Complete: ${successCount} awarded, ${skipCount} skipped, ${errorCount} errors, ${totalPointsAwarded}pt total`);
        return {
          dryRun: false,
          affectedCount: affected.length,
          successCount,
          skipCount,
          errorCount,
          totalPointsAwarded,
          errors: errors.slice(0, 20),
        };
      }),

    // Get LINE receipt statistics (admin only)
    adminGetLineStatistics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
      }
      const { getLineReceiptStatistics } = await import("./db");
      return await getLineReceiptStatistics();
    }),

    // Detect duplicate LINE receipts by order number (admin only)
    adminDetectDuplicateReceipts: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
      }
      const { detectDuplicateLineReceipts } = await import("./db");
      return await detectDuplicateLineReceipts();
    }),
    
    // AI Auto-Approve Receipts (admin only)
    // 3-stage pipeline: Rule Filter → LLM Image Judgment → Confidence Threshold
    adminAiAutoApprove: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        dryRun: z.boolean().default(false), // If true, only simulate without actually approving
        confidenceThreshold: z.number().min(0).max(100).default(70),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        
        const {
          getAutoApprovalCandidates,
          batchCheckDuplicateOrderNumbers,
          getRecentReviewExamples,
          getLineReceiptById,
          updateLineReceiptStatus,
          awardPointsForLineReceipt,
          getLinePointBalance,
          confirmPendingReferral,
          getLineUserByLineId,
          createAutoReviewOnApproval,
          createAiAutoReviewLogsBatch,
          updateAiAutoApproveSetting,
          getKakuhenResultByReceiptId,
          buildStatisticsLearningPrompt,
        } = await import("./db");
        const { pushMessage: pushMsg } = await import("./line");
        
        // Generate batch ID
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        // Results tracking
        const results: {
          id: number;
          action: "approved" | "skipped" | "held" | "rejected_duplicate" | "rejected_ai";
          reason: string;
          confidence?: number;
          orderNumber?: string;
          amount?: number;
          aiComment?: string;
          lineUserId?: string;
          storeName?: string;
          imageUrl?: string;
        }[] = [];
        
        // Rejection threshold: below this → auto-reject
        const REJECTION_THRESHOLD = 50;
        
        // ===== STEP 0: Get candidates =====
        const candidates = await getAutoApprovalCandidates(input.limit);
        if (candidates.length === 0) {
          return { processed: 0, results: [], summary: { approved: 0, skipped: 0, held: 0, rejectedDuplicate: 0, rejectedAi: 0 } };
        }
        
        // ===== STEP 1: Rule Filter =====
        // Extract order numbers for batch duplicate check
        const orderNumberMap = new Map<number, string>(); // receiptId -> orderNumber
        for (const c of candidates) {
          if (c.ocrRawText) {
            try {
              const ocr = typeof c.ocrRawText === "string" ? JSON.parse(c.ocrRawText) : c.ocrRawText;
              const orderNum = String(ocr?.orderNumber || "").trim();
              if (orderNum && orderNum !== "null") {
                orderNumberMap.set(c.id, orderNum);
              }
            } catch { /* skip */ }
          }
        }
        
        // Batch duplicate check (most important!)
        const allOrderNumbers = Array.from(orderNumberMap.values());
        const dupeMap = await batchCheckDuplicateOrderNumbers(allOrderNumbers);
        
        // Get review examples for LLM context (increased from 5 to 10 each)
        const reviewExamples = await getRecentReviewExamples(10, 10);
        
        // Get comprehensive statistics learning prompt
        let statisticsPrompt = "";
        try {
          statisticsPrompt = await buildStatisticsLearningPrompt();
        } catch (e) {
          console.error("[AI AutoApprove] Failed to build statistics prompt:", e);
        }
        
        // Process each candidate
        for (const candidate of candidates) {
          const orderNumber = orderNumberMap.get(candidate.id);
          let ocrData: any = {};
          try {
            ocrData = candidate.ocrRawText
              ? (typeof candidate.ocrRawText === "string" ? JSON.parse(candidate.ocrRawText) : candidate.ocrRawText)
              : {};
          } catch { ocrData = {}; }
          
          // --- Rule 1: Duplicate order number check (HIGHEST PRIORITY) ---
          if (orderNumber) {
            const dupes = dupeMap.get(orderNumber) || [];
            // Filter out self
            const otherDupes = dupes.filter(d => d.id !== candidate.id);
            // If any approved receipt has the same order number → reject as duplicate
            const approvedDupe = otherDupes.find(d => d.status === "approved");
            if (approvedDupe) {
              if (!input.dryRun) {
                await updateLineReceiptStatus(candidate.id, "rejected", ctx.user.id, 
                  `[AI自動] 重複注文番号: ${orderNumber} (承認済みレシート #${approvedDupe.id} と重複)`);
                // Record review log
                try {
                  await createReceiptReviewLog({
                    receiptType: "line_receipt",
                    receiptId: candidate.id,
                    decision: "rejected",
                    rejectionCategory: "duplicate",
                    rejectionNote: `AI自動却下: 重複注文番号 ${orderNumber}`,
                    totalAmount: candidate.totalAmount ?? undefined,
                    hasOrderNumber: "yes",
                    imageCount: candidate.imageUrls?.length ?? 1,
                    fraudScore: candidate.fraudScore ?? undefined,
                    fraudFlagCount: candidate.fraudFlags?.length ?? 0,
                    pointsCalculated: candidate.pointsCalculated ?? undefined,
                    reviewedBy: ctx.user.id,
                  });
                } catch (logErr) {
                  console.error("[AI AutoApprove] Failed to log duplicate rejection:", logErr);
                }
              }
              results.push({
                id: candidate.id,
                action: "rejected_duplicate",
                reason: `重複注文番号: ${orderNumber} (承認済み #${approvedDupe.id})`,
                orderNumber,
                amount: candidate.totalAmount ?? undefined,
              });
              continue;
            }
          }
          
          // --- Rule 1.5: Level 3 - Same image (perceptual hash) ---
          try {
            const { checkLevel3SameImage } = await import("./services/duplicateCheckService");
            const primaryImageUrl = candidate.imageUrls?.[0] || candidate.imageUrl;
            if (primaryImageUrl) {
              const level3Result = await checkLevel3SameImage(
                candidate.id,
                candidate.lineUserId,
                primaryImageUrl
              );
              if (level3Result.isDuplicate) {
                if (!input.dryRun) {
                  await updateLineReceiptStatus(candidate.id, "rejected", ctx.user.id,
                    `[AI自動] Level3: ${level3Result.reason}`);
                  try {
                    await createReceiptReviewLog({
                      receiptType: "line_receipt",
                      receiptId: candidate.id,
                      decision: "rejected",
                      rejectionCategory: "duplicate",
                      rejectionNote: `AI自動却下(Level3): ${level3Result.reason}`,
                      totalAmount: candidate.totalAmount ?? undefined,
                      hasOrderNumber: orderNumber ? "yes" : "no",
                      imageCount: candidate.imageUrls?.length ?? 1,
                      fraudScore: candidate.fraudScore ?? undefined,
                      fraudFlagCount: candidate.fraudFlags?.length ?? 0,
                      pointsCalculated: candidate.pointsCalculated ?? undefined,
                      reviewedBy: ctx.user.id,
                    });
                  } catch (logErr) {
                    console.error("[AI AutoApprove] Failed to log Level3 rejection:", logErr);
                  }
                  // 同一画像繰り返しアップロード検出 → 不正ユーザー判定
                  try {
                    const { countDuplicateImageRejections } = await import("./db");
                    const dupCount = await countDuplicateImageRejections(candidate.lineUserId);
                    if (dupCount >= 3) {
                      // 3回以上同一画像で却下されている → 不正ユーザーとしてブロック
                      const { updateLineUserBlocked } = await import("./db");
                      await updateLineUserBlocked(candidate.lineUserId, true);
                      console.log(`[AI AutoApprove] 不正ユーザー判定: ${candidate.lineUserId} (同一画像重複${dupCount}回)`);
                      // LINE通知
                      try {
                        await pushMsg(candidate.lineUserId, [{ type: "text", text: `⚠️ 同一の画像を繰り返し送信しているため、アカウントが制限されました。\n\n心当たりがない場合はお問い合わせください。` }]);
                      } catch { /* ignore */ }
                    }
                  } catch (fraudErr) {
                    console.error("[AI AutoApprove] Fraud check error:", fraudErr);
                  }
                }
                results.push({
                  id: candidate.id,
                  action: "rejected_duplicate",
                  reason: `Level3: ${level3Result.reason}`,
                  orderNumber,
                  amount: candidate.totalAmount ?? undefined,
                });
                continue;
              }
            }
          } catch (level3Err: any) {
            console.error(`[AI AutoApprove] Level3 check error for receipt #${candidate.id}:`, level3Err.message);
          }
          
          // --- Rule 2: Missing essential data → now handled by LLM instead of skipping ---
          // Previously skipped receipts without order number or amount.
          // Now we let LLM judge from the image - it can often read order numbers
          // and amounts that OCR missed.
          const missingOrderNumber = !orderNumber;
          const missingAmount = !candidate.totalAmount || candidate.totalAmount <= 0;
          
          // --- Rule 3: Force-submitted (AI-rejected) receipts → skip (needs human review) ---
          if (candidate.isForceSubmitted) {
            results.push({
              id: candidate.id,
              action: "skipped",
              reason: "AI弾き→強制申請レシート（人間審査必要）",
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
            });
            continue;
          }
          
          // --- Rule 4: High fraud flags → skip ---
          const fraudFlagCount = candidate.fraudFlags?.length ?? 0;
          if (fraudFlagCount >= 3) {
            results.push({
              id: candidate.id,
              action: "skipped",
              reason: `不正フラグ${fraudFlagCount}件（人間審査必要）`,
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
            });
            continue;
          }
          
          // ===== STEP 2: LLM Image Judgment =====
          // Check OCR data quality first - if isTikTokShop=true AND isDelivered=true, high confidence
          const isTikTok = ocrData.isTikTokShop === true;
          const isDelivered = ocrData.isDelivered === true;
          
          let aiConfidence = 0;
          let aiReason = "";
          
          // OCR confidence check - only bypass LLM if OCR is very confident
          const ocrConf = parseFloat(candidate.ocrConfidence || "0");
          if (isTikTok && isDelivered && orderNumber && (candidate.totalAmount ?? 0) > 0 && ocrConf >= 95) {
            // Best case: all OCR signals positive AND high OCR confidence → bypass LLM
            aiConfidence = 92;
            aiReason = "OCRデータ良好(OCR信頼度" + ocrConf + "%): TikTok Shop確認済み + 配達済み + 注文番号あり + 金額あり";
          } else if (isTikTok && isDelivered && orderNumber && (candidate.totalAmount ?? 0) > 0 && ocrConf >= 80) {
            // Medium OCR confidence: still use LLM but with positive bias
            aiConfidence = 80;
            aiReason = "OCRデータ良好だがOCR信頼度が中程度(" + ocrConf + "%) - LLM検証を実施";
            // Fall through to LLM check below
          } else {
            // Need LLM to evaluate the receipt image
            try {
              const allImageUrls: string[] = [];
              if (candidate.imageUrls && Array.isArray(candidate.imageUrls)) {
                allImageUrls.push(...candidate.imageUrls);
              } else if (candidate.imageUrl) {
                allImageUrls.push(candidate.imageUrl);
              }
              
              if (allImageUrls.length === 0) {
                // 画像なしは却下
                if (!input.dryRun) {
                  await updateLineReceiptStatus(candidate.id, "rejected", ctx.user.id,
                    "[AI自動却下] レシート画像がありません");
                  try {
                    const appUrl = process.env.APP_URL || "https://lcjmall.com";
                    const rejectMsg = `❌ レシートが承認されませんでした\n\n画像が見つかりませんでした。スクリーンショットを再度送信してください🙏\n\nお問い合わせ: ${appUrl}/mypage`;
                    await pushMsg(candidate.lineUserId, [{ type: "text", text: rejectMsg }]);
                  } catch (notifyErr) {
                    console.error(`[AI AutoApprove] LINE rejection notification error:`, notifyErr);
                  }
                }
                results.push({
                  id: candidate.id,
                  action: "rejected_ai",
                  reason: "画像なし",
                  orderNumber,
                  amount: candidate.totalAmount ?? undefined,
                  lineUserId: candidate.lineUserId,
                  storeName: candidate.storeName ?? undefined,
                  imageUrl: candidate.imageUrl ?? undefined,
                });
                continue;
              }
              
              // Build LLM prompt with review examples - include rejection stats and detailed reasons
              const rejectionCategoryLabels: Record<string, string> = {
                not_order_detail: "注文詳細画面ではない",
                not_tiktok_shop: "TikTok Shop以外",
                not_delivered: "配達未完了",
                blurry_image: "画像不鮮明",
                missing_order_number: "注文番号が見えない",
                missing_amount: "金額が見えない",
                partial_screenshot: "スクショ不完全",
                duplicate: "重複申請",
                wrong_store: "対象外店舗",
                suspicious: "不正の疑い",
                incomplete_info: "情報不足",
                other: "その他",
              };
              
              const exampleContext = [
                "=== 過去の却下理由統計（多い順） ===",
                ...(reviewExamples.rejectionStats || []).map(s => 
                  `${rejectionCategoryLabels[s.category || "other"] || s.category}: ${s.count}件`
                ),
                "",
                "=== 過去の承認例 ===",
                ...reviewExamples.approved.map(e => 
                  `承認: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`
                ),
                "",
                "=== 過去の却下例（理由付き） ===",
                ...reviewExamples.rejected.map(e => {
                  const catLabel = rejectionCategoryLabels[e.rejectionCategory || "other"] || e.rejectionCategory;
                  const note = e.rejectionNote ? ` - ${e.rejectionNote}` : "";
                  return `却下[理由: ${catLabel}${note}]: 金額=${e.totalAmount || "不明"}, 注文番号=${e.hasOrderNumber}, OCR信頼度=${e.ocrConfidence || "不明"}`;
                }),
              ].join("\n");
              
              const imageContents: any[] = allImageUrls.map(url => ({
                type: "image_url" as const,
                image_url: { url, detail: "high" as const },
              }));
              // Build additional context for missing data
              let missingDataNote = "";
              if (missingOrderNumber) {
                missingDataNote += "\n\n❗ OCRで注文番号が取得できませんでした。画像から注文番号（16-19桁の数字）を読み取ってdetectedOrderNumberに設定してください。注文番号が画像から読み取れれば、それを基に判定してください。";
              }
              if (missingAmount) {
                missingDataNote += "\n\n❗ OCRで金額が取得できませんでした。画像から合計金額を読み取ってdetectedAmountに設定してください。";
              }
              
              imageContents.push({
                type: "text" as const,
                text: `このレシート画像を審査してください。\n\nOCRデータ: ${JSON.stringify({
                  orderNumber: ocrData.orderNumber,
                  totalAmount: candidate.totalAmount,
                  shopName: ocrData.shopName || candidate.storeName,
                  isTikTokShop: ocrData.isTikTokShop,
                  isDelivered: ocrData.isDelivered,
                })}${missingDataNote}\n\n${exampleContext}`,
              });
              
              // few-shot学習例を取得
              let learningPrompt = "";
              try {
                const { buildLearningExamplesPrompt } = await import("./db");
                learningPrompt = await buildLearningExamplesPrompt(8);
              } catch (e) { /* ignore */ }
              
              const llmResult = await invokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `あなたはTikTok Shopのレシート審査AIです。レシート画像とOCRデータを見て、承認すべきか判断してください。

=== 承認基準（全て満たす必要がある） ===
1. TikTok Shopの「注文詳細」画面のスクリーンショットであること
   - 視覚的特徴: TikTokロゴ、オレンジ色のアクセント、商品画像、ショップ名、注文ステータスバー
   - 「注文詳細」「訂単详情」「Order Details」などのタイトルが見える
2. 「配達済み」のステータスが確認できること
   - 日本語: 「配達済み」「配送完了」
   - 中国語: 「已签收」「已完成」「已送达」
   - 英語: "Delivered"
3. 注文番号（16-19桁の数字）が読み取れること
4. 合計金額が読み取れること

=== 却下基準（いずれか1つでも該当すれば却下） ===
★ 注文詳細画面ではない場合 (rejectionCategory: "not_order_detail")
  - メール通知のスクショ（Gmail、Yahooメール等）
  - 配送通知画面（「お届け先」「追跡番号」がメインの画面）
  - 注文一覧画面（複数の注文が並んでいる）
  - カート画面、チェックアウト画面
  - アプリのホーム画面やプロフィール画面

★ TikTok Shop以外のプラットフォーム (rejectionCategory: "not_tiktok_shop")
  - Amazon、楽天、Yahooショッピング、Shopee、Lazada等の画面
  - 各プラットフォーム固有のUIデザインで判別

★ 配達未完了 (rejectionCategory: "not_delivered")
  - 「配送中」「出荷済み」「キャンセル」「返品」等のステータス

★ 画像が不鮮明 (rejectionCategory: "blurry_image")
  - ピンボケ、低解像度で文字が読めない

★ 注文番号が見えない (rejectionCategory: "missing_order_number")
  - スクショが切れていて注文番号が写っていない

★ 金額が見えない (rejectionCategory: "missing_amount")
  - スクショが切れていて金額が写っていない

★ スクリーンショットが不完全 (rejectionCategory: "partial_screenshot")
  - 画面の一部しか写っておらず、必要な情報が欠けている

★ 重複申請 (rejectionCategory: "duplicate")
  - 同じ注文番号で既に承認済み

★ 対象外店舗 (rejectionCategory: "wrong_store")
  - 対象外のショップ

★ 不正の疑い (rejectionCategory: "suspicious")
  - 画像編集の痕跡、フォントの不一致、不自然な切り貼り

=== グレーゾーン判定ガイド ===
- 複数枚のスクショがある場合: 全ての画像を総合的に判断。一枚に注文詳細、もう一枚に金額が写っていればOK
- 中国語のTikTok Shop: 「抖音商城」「拖音商城」もTikTok Shopとして承認
- 金額が小さい（100円未満等）: 金額の大小では却下しない。金額が読み取れればOK
- ステータスが「受取確認待ち」: 配達済みとみなす（confidenceを少し下げる）
- スクショの一部が暗いが情報は読める: 承認してよい（confidenceを少し下げる）

=== 信頼度スコアガイドライン ===
- 90-100: 全ての情報が明確に確認できる
- 75-89: ほぼ確認できるが一部不明瞭な点がある
- 50-74: 判断が難しい、人間の確認が必要
- 0-49: 明らかに基準を満たしていない

必ず以下のJSON形式で回答してください：
{
  "shouldApprove": true/false,
  "confidence": 0-100,
  "reason": "判断理由（日本語）",
  "rejectionCategory": "not_order_detail" | "not_tiktok_shop" | "not_delivered" | "blurry_image" | "missing_order_number" | "missing_amount" | "partial_screenshot" | "duplicate" | "wrong_store" | "suspicious" | "incomplete_info" | "other" | null,
  "isTikTokShop": true/false/null,
  "isDelivered": true/false/null,
  "detectedOrderNumber": "string or null",
  "detectedAmount": number or null
}
※ rejectionCategoryはshouldApprove=falseの場合のみ設定。承認時はnull。

★ 重要: OCRで注文番号や金額が取得できなかった場合でも、画像から読み取れる場合はそれを基に判定してください。
★ 過去の審査実績では承認率約75%です。基準を満たすレシートは積極的に承認してください。${statisticsPrompt}${learningPrompt}`,
                  },
                  {
                    role: "user",
                    content: imageContents,
                  },
                ],
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: "receipt_review",
                    strict: true,
                    schema: {
                      type: "object",
                      properties: {
                        shouldApprove: { type: "boolean", description: "承認すべきか" },
                        confidence: { type: "integer", description: "信頼度スコア 0-100" },
                        reason: { type: "string", description: "判断理由（日本語）" },
                        rejectionCategory: { type: ["string", "null"], description: "却下カテゴリー", enum: ["not_order_detail", "not_tiktok_shop", "not_delivered", "blurry_image", "missing_order_number", "missing_amount", "partial_screenshot", "duplicate", "wrong_store", "suspicious", "incomplete_info", "other", null] },
                        isTikTokShop: { type: ["boolean", "null"], description: "TikTok Shopかどうか" },
                        isDelivered: { type: ["boolean", "null"], description: "配達済みかどうか" },
                        detectedOrderNumber: { type: ["string", "null"], description: "画像から検出した注文番号" },
                        detectedAmount: { type: ["number", "null"], description: "画像から検出した金額" },
                      },
                      required: ["shouldApprove", "confidence", "reason", "rejectionCategory", "isTikTokShop", "isDelivered", "detectedOrderNumber", "detectedAmount"],
                      additionalProperties: false,
                    },
                  },
                },
              });
              
              const msgContent = llmResult.choices[0]?.message?.content as string;
              let parsed: any = {};
              try {
                parsed = JSON.parse(typeof msgContent === "string" ? msgContent : "{}");
              } catch {
                // response_formatでもパース失敗の場合は保留にする（却下しない）
                if (!input.dryRun) {
                  await updateLineReceiptStatus(candidate.id, "on_hold", ctx.user.id,
                    "[AI自動] AI応答の解析に失敗 - 人間審査待ち");
                  // パース失敗時はユーザーに通知しない（保留にするだけ）
                }
                results.push({
                  id: candidate.id,
                  action: "held",
                  reason: "AI応答解析失敗 - 保留",
                  orderNumber,
                  amount: candidate.totalAmount ?? undefined,
                  lineUserId: candidate.lineUserId,
                  storeName: candidate.storeName ?? undefined,
                  imageUrl: candidate.imageUrl ?? undefined,
                });
                continue;
              }
              
              aiConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
              aiReason = parsed.reason || "LLM判定";
              
              // If LLM detected order number or amount that OCR missed, use them
              if (missingOrderNumber && parsed.detectedOrderNumber) {
                const detectedOrder = String(parsed.detectedOrderNumber).trim();
                if (detectedOrder && detectedOrder !== "null" && detectedOrder.length >= 10) {
                  // LLM found order number from image - update orderNumberMap for later use
                  orderNumberMap.set(candidate.id, detectedOrder);
                  console.log(`[AI AutoApprove] LLM detected order number for receipt #${candidate.id}: ${detectedOrder}`);
                }
              }
              if (missingAmount && parsed.detectedAmount && typeof parsed.detectedAmount === "number" && parsed.detectedAmount > 0) {
                console.log(`[AI AutoApprove] LLM detected amount for receipt #${candidate.id}: ${parsed.detectedAmount}`);
              }
              
              // If LLM says don't approve → check confidence to decide reject or hold
              if (parsed.shouldApprove === false) {
                if (aiConfidence < REJECTION_THRESHOLD) {
                  // Low confidence + not approved → AUTO REJECT
                  if (!input.dryRun) {
                    await updateLineReceiptStatus(candidate.id, "rejected", ctx.user.id,
                      `[AI自動却下] LLM判定: 承認不可 - ${aiReason} (confidence: ${aiConfidence}%)`);
                    // Send LINE notification for AI rejection
                    try {
                      const appUrl = process.env.APP_URL || "https://lcjmall.com";
                      const rejectMsg = `❌ レシートが承認されませんでした\n\nAI審査の結果、以下の理由で承認できませんでした：\n${aiReason}\n\n以下の情報が見えるようにスクリーンショットを撮り直してください🙏\n\n① 配達ステータス（配達済み）\n② 注文番号\n③ 合計金額（税込）\n\n※ 1枚に収まらない場合は2〜3枚に分けて送信OK\n\nお問い合わせ: ${appUrl}/mypage`;
                      await pushMsg(candidate.lineUserId, [{ type: "text", text: rejectMsg }]);
                    } catch (notifyErr) {
                      console.error(`[AI AutoApprove] LINE rejection notification error:`, notifyErr);
                    }
                  }
                  results.push({
                    id: candidate.id,
                    action: "rejected_ai",
                    reason: `AI却下(${aiConfidence}%): ${aiReason}`,
                    confidence: aiConfidence,
                    orderNumber,
                    amount: candidate.totalAmount ?? undefined,
                    lineUserId: candidate.lineUserId,
                    storeName: candidate.storeName ?? undefined,
                    imageUrl: candidate.imageUrl ?? undefined,
                  });
                  continue;
                } else {
                  // Medium confidence + not approved → HOLD for human review
                  if (!input.dryRun) {
                    await updateLineReceiptStatus(candidate.id, "on_hold", ctx.user.id,
                      `[AI自動] LLM判定: 承認不可 - ${aiReason} (confidence: ${aiConfidence}%)`);
                  }
                  results.push({
                    id: candidate.id,
                    action: "held",
                    reason: `LLM判定: ${aiReason}`,
                    confidence: aiConfidence,
                    orderNumber,
                    amount: candidate.totalAmount ?? undefined,
                    lineUserId: candidate.lineUserId,
                    storeName: candidate.storeName ?? undefined,
                    imageUrl: candidate.imageUrl ?? undefined,
                  });
                  continue;
                }
              }
            } catch (llmErr: any) {
              console.error(`[AI AutoApprove] LLM error for receipt #${candidate.id}:`, llmErr.message);
              
              // 429 Too Many Requests / insufficient_quota → APIクォータ超過のためスキップ（次回リトライ）
              const errMsg = llmErr.message || "";
              if (errMsg.includes("429") || errMsg.includes("Too Many Requests") || errMsg.includes("insufficient_quota") || errMsg.includes("rate_limit")) {
                console.log(`[AI AutoApprove] APIクォータ超過のためスキップ: receipt #${candidate.id}`);
                results.push({
                  id: candidate.id,
                  action: "skipped",
                  reason: `APIクォータ超過（次回リトライ）`,
                  orderNumber,
                  amount: candidate.totalAmount ?? undefined,
                });
                continue;
              }
              
              // その他のLLMエラー（画像非対応等）は自動却下する
              if (!input.dryRun) {
                await updateLineReceiptStatus(candidate.id, "rejected", ctx.user.id,
                  `[AI自動却下] 画像読み取り失敗: ${llmErr.message?.substring(0, 100)}`);
                // LINE通知で再提出を促す
                try {
                  const appUrl = process.env.APP_URL || "https://lcjmall.com";
                  const rejectMsg = `❌ レシートが承認されませんでした\n\n画像を読み取れませんでした。以下を確認して再度送信してください🙏\n\n• スクリーンショットが鮮明に撮れているか\n• 画像が切れていないか\n• 対応している画像形式（JPEG/PNG）か\n\nお問い合わせ: ${appUrl}/mypage`;
                  await pushMsg(candidate.lineUserId, [{ type: "text", text: rejectMsg }]);
                } catch (notifyErr) {
                  console.error(`[AI AutoApprove] LINE rejection notification error:`, notifyErr);
                }
              }
              results.push({
                id: candidate.id,
                action: "rejected_ai",
                reason: `画像読み取り失敗: ${llmErr.message?.substring(0, 100)}`,
                orderNumber,
                amount: candidate.totalAmount ?? undefined,
                lineUserId: candidate.lineUserId,
                storeName: candidate.storeName ?? undefined,
                imageUrl: candidate.imageUrl ?? undefined,
              });
              continue;
            }
          }
          
          // ===== STEP 3: Confidence Threshold =====
          if (aiConfidence < REJECTION_THRESHOLD) {
            // Below 50% → AUTO REJECT
            if (!input.dryRun) {
              await updateLineReceiptStatus(candidate.id, "rejected", ctx.user.id,
                `[AI自動却下] 信頼度不足: ${aiConfidence}% < ${REJECTION_THRESHOLD}% - ${aiReason}`);
              // Send LINE notification for AI rejection
              try {
                const appUrl = process.env.APP_URL || "https://lcjmall.com";
                const rejectMsg = `❌ レシートが承認されませんでした\n\nAI審査の結果、以下の理由で承認できませんでした：\n${aiReason}\n\n以下の情報が見えるようにスクリーンショットを撮り直してください🙏\n\n① 配達ステータス（配達済み）\n② 注文番号\n③ 合計金額（税込）\n\n※ 1枚に収まらない場合は2〜3枚に分けて送信OK\n\nお問い合わせ: ${appUrl}/mypage`;
                await pushMsg(candidate.lineUserId, [{ type: "text", text: rejectMsg }]);
              } catch (notifyErr) {
                console.error(`[AI AutoApprove] LINE rejection notification error:`, notifyErr);
              }
            }
            results.push({
              id: candidate.id,
              action: "rejected_ai",
              reason: `信頼度不足: ${aiConfidence}% < ${REJECTION_THRESHOLD}%`,
              confidence: aiConfidence,
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
              lineUserId: candidate.lineUserId,
              storeName: candidate.storeName ?? undefined,
              imageUrl: candidate.imageUrl ?? undefined,
            });
            continue;
          } else if (aiConfidence < input.confidenceThreshold) {
            // Between 50% and threshold (85%) → HOLD for human review
            if (!input.dryRun) {
              await updateLineReceiptStatus(candidate.id, "on_hold", ctx.user.id,
                `[AI自動] 信頼度不足: ${aiConfidence}% < 閾値${input.confidenceThreshold}% - ${aiReason}`);
            }
            results.push({
              id: candidate.id,
              action: "held",
              reason: `信頼度不足: ${aiConfidence}% < 閾値${input.confidenceThreshold}%`,
              confidence: aiConfidence,
              orderNumber,
              amount: candidate.totalAmount ?? undefined,
              lineUserId: candidate.lineUserId,
              storeName: candidate.storeName ?? undefined,
              imageUrl: candidate.imageUrl ?? undefined,
            });
            continue;
          }
          
          // ===== STEP 4: Auto-Approve! =====
          let pointsToAward = candidate.pointsCalculated ?? 0;
          // 確変チャンス結果を確認し、確変ポイント（1.5%）を適用
          try {
            const kakuhenResult = await getKakuhenResultByReceiptId("line_receipt", candidate.id);
            if (kakuhenResult && kakuhenResult.isKakuhen && kakuhenResult.actualPoints > 0) {
              pointsToAward = kakuhenResult.actualPoints;
              console.log(`[AI AutoApprove][Kakuhen] Applied kakuhen points for receipt ${candidate.id}: ${candidate.pointsCalculated}pt → ${kakuhenResult.actualPoints}pt`);
            }
          } catch (err: any) {
            console.error(`[AI AutoApprove][Kakuhen] Error checking kakuhen for receipt ${candidate.id}:`, err.message);
          }
          
          if (!input.dryRun) {
            try {
              // Approve
              await updateLineReceiptStatus(candidate.id, "approved", ctx.user.id,
                `[AI自動承認] confidence: ${aiConfidence}% - ${aiReason}`);
              
              // Award points
              if (pointsToAward > 0) {
                await awardPointsForLineReceipt(candidate.id, pointsToAward);
              }
              
              // Confirm pending referral
              try {
                const lineUserRecord = await getLineUserByLineId(candidate.lineUserId);
                if (lineUserRecord) {
                  const refResult = await confirmPendingReferral(candidate.lineUserId, lineUserRecord.id);
                  if (refResult) {
                    console.log(`[AI AutoApprove] Confirmed referral for LINE user ${lineUserRecord.id}`);
                  }
                }
              } catch (refErr: any) {
                console.error(`[AI AutoApprove] Referral error:`, refErr.message);
              }
              
              // Record review log
              try {
                await createReceiptReviewLog({
                  receiptType: "line_receipt",
                  receiptId: candidate.id,
                  decision: "approved",
                  ocrConfidence: candidate.ocrConfidence ?? undefined,
                  totalAmount: candidate.totalAmount ?? undefined,
                  hasOrderNumber: "yes",
                  imageCount: candidate.imageUrls?.length ?? 1,
                  fraudScore: candidate.fraudScore ?? undefined,
                  fraudFlagCount: candidate.fraudFlags?.length ?? 0,
                  pointsCalculated: candidate.pointsCalculated ?? undefined,
                  pointsAwarded: pointsToAward,
                  reviewedBy: ctx.user.id,
                });
              } catch (logErr) {
                console.error("[AI AutoApprove] Failed to log approval:", logErr);
              }
              
              // Extract products
              try {
                await extractSingleReceiptProducts(candidate.id);
              } catch (extractErr) {
                console.error(`[AI AutoApprove] Product extraction error:`, extractErr);
              }
              
              // Auto-create review
              try {
                await createAutoReviewOnApproval({
                  receiptType: "line_receipt",
                  receiptId: candidate.id,
                  lineUserId: candidate.lineUserId,
                  imageUrl: candidate.imageUrl,
                  ocrRawText: candidate.ocrRawText,
                  storeName: candidate.storeName,
                  totalAmount: candidate.totalAmount,
                });
              } catch (reviewErr) {
                console.error(`[AI AutoApprove] Auto-review error:`, reviewErr);
              }
              
              // Send LINE notification
              try {
                const balance = await getLinePointBalance(candidate.lineUserId);
                const newBalance = balance?.balance ?? pointsToAward;
                const storeName = candidate.storeName || "不明";
                const amount = candidate.totalAmount ? `¥${candidate.totalAmount.toLocaleString()}` : "不明";
                const appUrl = process.env.APP_URL || "https://lcjmall.com";
                const message = `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
                await pushMsg(candidate.lineUserId, [{ type: "text", text: message }]);
              } catch (notifyErr) {
                console.error(`[AI AutoApprove] LINE notification error:`, notifyErr);
              }
            } catch (approveErr: any) {
              console.error(`[AI AutoApprove] Approval error for receipt #${candidate.id}:`, approveErr.message);
              results.push({
                id: candidate.id,
                action: "skipped",
                reason: `承認処理エラー: ${approveErr.message?.substring(0, 100)}`,
                orderNumber,
                amount: candidate.totalAmount ?? undefined,
              });
              continue;
            }
          }
          
          results.push({
            id: candidate.id,
            action: "approved",
            reason: aiReason,
            confidence: aiConfidence,
            orderNumber,
            amount: candidate.totalAmount ?? undefined,
          });
        }
        
        // Summary
        const summary = {
          approved: results.filter(r => r.action === "approved").length,
          skipped: results.filter(r => r.action === "skipped").length,
          held: results.filter(r => r.action === "held").length,
          rejectedDuplicate: results.filter(r => r.action === "rejected_duplicate").length,
          rejectedAi: results.filter(r => r.action === "rejected_ai").length,
        };
        
        console.log(`[AI AutoApprove] Batch ${batchId}: Processed ${results.length} receipts: ${JSON.stringify(summary)}`);
        
        // ===== Save AI review logs to DB =====
        try {
          const logEntries = results.map(r => {
            const candidate = candidates.find(c => c.id === r.id);
            // Generate human-readable AI comment
            let aiComment = "";
            if (r.action === "approved") {
              aiComment = `✅ 承認: ${r.reason || "条件を満たしています"}${r.confidence ? ` (信頼度: ${r.confidence}%)` : ""}`;
            } else if (r.action === "rejected_duplicate") {
              aiComment = `❌ 重複却下: ${r.reason || "同一注文番号で既に承認済みのレシートが存在します"}`;
            } else if (r.action === "rejected_ai") {
              aiComment = `🚫 AI却下: ${r.reason || "信頼度が低いため自動却下されました"}${r.confidence ? ` (信頼度: ${r.confidence}%)` : ""}`;
            } else if (r.action === "held") {
              aiComment = `⏸️ 保留: ${r.reason || "信頼度が閾値未満のため人間審査が必要です"}`;
            } else {
              aiComment = `⏭️ スキップ: ${r.reason || "処理条件を満たしていません"}`;
            }
            return {
              batchId,
              receiptId: r.id,
              lineUserId: r.lineUserId || candidate?.lineUserId || null,
              aiDecision: r.action,
              aiConfidence: r.confidence ?? null,
              aiComment,
              aiReason: r.reason,
              orderNumber: r.orderNumber || null,
              totalAmount: r.amount ?? candidate?.totalAmount ?? null,
              storeName: r.storeName || candidate?.storeName || null,
              imageUrl: r.imageUrl || candidate?.imageUrl || null,
              isDryRun: input.dryRun,
            };
          });
          await createAiAutoReviewLogsBatch(logEntries);
          console.log(`[AI AutoApprove] Saved ${logEntries.length} review logs for batch ${batchId}`);
        } catch (logErr: any) {
          console.error(`[AI AutoApprove] Failed to save review logs:`, logErr.message);
        }
        
        // Update last run info
        if (!input.dryRun) {
          try {
            await updateAiAutoApproveSetting({
              lastRunAt: new Date(),
              lastRunBatchId: batchId,
              updatedBy: ctx.user.id,
            });
          } catch (settingErr: any) {
            console.error(`[AI AutoApprove] Failed to update settings:`, settingErr.message);
          }
        }
        
        // Check if there are more pending receipts for continuous processing
        let hasMore = false;
        try {
          const remaining = await getAutoApprovalCandidates(1);
          hasMore = remaining.length > 0;
        } catch { /* ignore */ }
        
        return {
          processed: results.length,
          results,
          summary,
          dryRun: input.dryRun,
          batchId,
          hasMore,
        };
      }),
  }),

  // ===== AI自動審査ログ管理 =====
  aiReview: router({
    // AI審査ログ一覧取得
    getLogs: protectedProcedure
      .input(z.object({
        batchId: z.string().optional(),
        aiDecision: z.string().optional(),
        humanOverride: z.string().nullable().optional(),
        excludeAiApproved: z.boolean().optional(),
        isDryRun: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getAiAutoReviewLogs } = await import("./db");
        return await getAiAutoReviewLogs(input ?? undefined);
      }),
    
    // AI審査ログ統計
    getStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getAiAutoReviewLogStats } = await import("./db");
      return await getAiAutoReviewLogStats();
    }),
    
    // バッチ一覧取得
    getBatches: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getAiAutoReviewBatches } = await import("./db");
        return await getAiAutoReviewBatches(input?.limit ?? 20);
      }),
    
    // 人間がAI判定を修正
    overrideDecision: protectedProcedure
      .input(z.object({
        logId: z.number(),
        humanOverride: z.enum(["approved", "rejected"]),
        humanComment: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { overrideAiAutoReviewLog, getLineReceiptById, updateLineReceiptStatus, awardPointsForLineReceipt, getLinePointBalance, confirmPendingReferral, getLineUserByLineId, createReceiptReviewLog, extractSingleReceiptProducts, createAutoReviewOnApproval, getKakuhenResultByReceiptId } = await import("./db");
        const { pushMessage: pushMsg } = await import("./line");
        
        // Update the log
        const updatedLog = await overrideAiAutoReviewLog(input.logId, {
          humanOverride: input.humanOverride,
          humanComment: input.humanComment,
          humanReviewedBy: ctx.user.id,
        });
        
        if (!updatedLog) throw new TRPCError({ code: "NOT_FOUND", message: "ログが見つかりません" });
        
        // If human overrides to approve a previously held/rejected receipt
        if (input.humanOverride === "approved" && updatedLog.aiDecision !== "approved") {
          const receipt = await getLineReceiptById(updatedLog.receiptId);
          if (receipt && receipt.status !== "approved") {
            // Approve the receipt
            await updateLineReceiptStatus(receipt.id, "approved", ctx.user.id,
              `[人間介入] AI判定を修正: ${updatedLog.aiDecision} → 承認${input.humanComment ? ` - ${input.humanComment}` : ""}`);
            
            // Award points (確変チャンス結果を確認し、確変ポイントを適用)
            let pointsToAward = receipt.pointsCalculated ?? 0;
            try {
              const kakuhenResult = await getKakuhenResultByReceiptId("line_receipt", receipt.id);
              if (kakuhenResult && kakuhenResult.isKakuhen && kakuhenResult.actualPoints > 0) {
                pointsToAward = kakuhenResult.actualPoints;
                console.log(`[Override][Kakuhen] Applied kakuhen points for receipt ${receipt.id}: ${receipt.pointsCalculated}pt → ${kakuhenResult.actualPoints}pt`);
              }
            } catch (err: any) {
              console.error(`[Override][Kakuhen] Error checking kakuhen for receipt ${receipt.id}:`, err.message);
            }
            if (pointsToAward > 0) {
              await awardPointsForLineReceipt(receipt.id, pointsToAward);
            }
            
            // Confirm referral
            try {
              const lineUserRecord = await getLineUserByLineId(receipt.lineUserId);
              if (lineUserRecord) {
                await confirmPendingReferral(receipt.lineUserId, lineUserRecord.id);
              }
            } catch (e) { /* ignore */ }
            
            // Review log
            try {
              await createReceiptReviewLog({
                receiptType: "line_receipt",
                receiptId: receipt.id,
                decision: "approved",
                ocrConfidence: receipt.ocrConfidence ?? undefined,
                totalAmount: receipt.totalAmount ?? undefined,
                hasOrderNumber: updatedLog.orderNumber ? "yes" : "no",
                imageCount: receipt.imageUrls?.length ?? 1,
                fraudScore: receipt.fraudScore ?? undefined,
                fraudFlagCount: receipt.fraudFlags?.length ?? 0,
                pointsCalculated: receipt.pointsCalculated ?? undefined,
                pointsAwarded: pointsToAward,
                reviewedBy: ctx.user.id,
              });
            } catch (e) { /* ignore */ }
            
            // Extract products
            try { await extractSingleReceiptProducts(receipt.id); } catch (e) { /* ignore */ }
            
            // Auto review
            try {
              await createAutoReviewOnApproval({
                receiptType: "line_receipt",
                receiptId: receipt.id,
                lineUserId: receipt.lineUserId,
                imageUrl: receipt.imageUrl,
                ocrRawText: receipt.ocrRawText,
                storeName: receipt.storeName,
                totalAmount: receipt.totalAmount,
              });
            } catch (e) { /* ignore */ }
            
            // LINE notification
            try {
              const balance = await getLinePointBalance(receipt.lineUserId);
              const newBalance = balance?.balance ?? pointsToAward;
              const storeName = receipt.storeName || "不明";
              const amount = receipt.totalAmount ? `¥${receipt.totalAmount.toLocaleString()}` : "不明";
              const appUrl = process.env.APP_URL || "https://lcjmall.com";
              const message = `🎉 レシートが承認されました！\n\n🏠 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
              await pushMsg(receipt.lineUserId, [{ type: "text", text: message }]);
            } catch (e) { /* ignore */ }
          }
        }
        
        // If human overrides to reject a previously approved receipt
        if (input.humanOverride === "rejected" && updatedLog.aiDecision === "approved") {
          const receipt = await getLineReceiptById(updatedLog.receiptId);
          if (receipt && receipt.status === "approved") {
            await updateLineReceiptStatus(receipt.id, "rejected", ctx.user.id,
              `[人間介入] AI承認を取消: ${input.humanComment || "管理者による修正"}`);
            // Note: Point reversal would need separate logic
          }
        }
        
        // === AI学習フィードバック蓄積 ===
        // 人間の判定がAIの判定と異なる場合、学習例として保存
        if (input.humanOverride !== updatedLog.aiDecision) {
          try {
            const { saveAiReceiptLearningExample, hasLearningExampleForLog } = await import("./db");
            const alreadyExists = await hasLearningExampleForLog(input.logId);
            if (!alreadyExists) {
              // エラータイプを判定
              let errorType = "other";
              const aiComment = updatedLog.aiComment || "";
              if (updatedLog.aiDecision === "skipped" && aiComment.includes("注文番号なし")) {
                errorType = "missing_order_number";
              } else if (updatedLog.aiDecision === "skipped" && aiComment.includes("金額なし")) {
                errorType = "missing_amount";
              } else if (updatedLog.aiDecision === "rejected_ai" && input.humanOverride === "approved") {
                errorType = "false_reject";
              } else if (updatedLog.aiDecision === "approved" && input.humanOverride === "rejected") {
                errorType = "false_approve";
              } else if (updatedLog.aiDecision === "held") {
                errorType = `held_but_${input.humanOverride}`;
              }
              
              // 学習メモを生成
              let learningNote = `AI判定「${updatedLog.aiDecision}」を人間が「${input.humanOverride}」に修正。`;
              if (errorType === "missing_order_number") {
                learningNote += " AIは注文番号を認識できなかったが、画像には注文番号が存在する。画像をより注意深く確認すべき。";
              } else if (errorType === "false_reject") {
                learningNote += " AIが却下したが、人間は承認と判断。審査基準が厳しすぎる可能性。";
              } else if (errorType === "false_approve") {
                learningNote += " AIが承認したが、人間は却下と判断。審査基準が甘すぎる可能性。";
              }
              
              await saveAiReceiptLearningExample({
                reviewLogId: input.logId,
                receiptId: updatedLog.receiptId,
                imageUrl: updatedLog.imageUrl || null,
                aiOriginalDecision: updatedLog.aiDecision,
                aiOriginalConfidence: updatedLog.aiConfidence,
                aiOriginalComment: updatedLog.aiComment,
                aiOriginalOrderNumber: updatedLog.orderNumber,
                aiOriginalAmount: updatedLog.totalAmount ?? null,
                aiOriginalStoreName: updatedLog.storeName,
                humanDecision: input.humanOverride,
                humanComment: input.humanComment || null,
                errorType,
                learningNote,
                createdBy: ctx.user.id,
              });
            }
          } catch (e) {
            console.error("[AI Learning] Failed to save learning example:", e);
          }
        }
        
        return updatedLog;
      }),
    
    // AI自動承認設定取得
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getAiAutoApproveSetting } = await import("./db");
      return await getAiAutoApproveSetting();
    }),
    
    // サーバーサイドAI自動審査 開始
    startServerAutoApprove: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getAiAutoApproveSetting, updateAiAutoApproveSetting } = await import("./db");
        const { triggerAiAutoApprove } = await import("./aiAutoApproveScheduler");
        
        const settings = await getAiAutoApproveSetting();
        if (settings?.isRunning) {
          return { success: true, message: "既に実行中です" };
        }
        
        // Reset counters and start
        await updateAiAutoApproveSetting({
          isRunning: true,
          isEnabled: true,
          totalProcessed: 0,
          totalApproved: 0,
          totalRejected: 0,
          totalHeld: 0,
          totalSkipped: 0,
          currentBatchNumber: 0,
          startedAt: new Date(),
          stoppedAt: undefined,
          updatedBy: ctx.user.id,
        });
        
        // Trigger the scheduler
        await triggerAiAutoApprove();
        
        return { success: true, message: "AI自動審査を開始しました" };
      }),
    
    // サーバーサイドAI自動審査 停止
    stopServerAutoApprove: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { updateAiAutoApproveSetting } = await import("./db");
        
        await updateAiAutoApproveSetting({
          isRunning: false,
          stoppedAt: new Date(),
          updatedBy: ctx.user.id,
        });
        
        return { success: true, message: "AI自動審査を停止しました" };
      }),
    
    // サーバーサイドAI自動審査 進捗取得（ポーリング用）
    getAutoApproveProgress: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getAiAutoApproveSetting, getAutoApprovalCandidates } = await import("./db");
        
        const settings = await getAiAutoApproveSetting();
        
        // Get remaining count
        let remainingCount = 0;
        try {
          const remaining = await getAutoApprovalCandidates(1);
          remainingCount = remaining.length > 0 ? -1 : 0; // -1 means "more than 0"
        } catch { /* ignore */ }
        
        return {
          isRunning: settings?.isRunning ?? false,
          totalProcessed: settings?.totalProcessed ?? 0,
          totalApproved: settings?.totalApproved ?? 0,
          totalRejected: settings?.totalRejected ?? 0,
          totalHeld: settings?.totalHeld ?? 0,
          totalSkipped: settings?.totalSkipped ?? 0,
          currentBatchNumber: settings?.currentBatchNumber ?? 0,
          startedAt: settings?.startedAt,
          stoppedAt: settings?.stoppedAt,
          lastRunBatchId: settings?.lastRunBatchId,
          hasMoreCandidates: remainingCount !== 0,
        };
      }),
    
    // AI審査ログからAI再認識を実行
    reRecognize: protectedProcedure
      .input(z.object({
        logId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getAiAutoReviewLogById, getLineReceiptById, updateLineReceiptOcr } = await import("./db");
        const { invokeLLM } = await import("./_core/llm");
        
        // Get the log entry to find the receipt
        const log = await getAiAutoReviewLogById(input.logId);
        if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "ログが見つかりません" });
        
        const receipt = await getLineReceiptById(log.receiptId);
        if (!receipt) throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        
        // Collect all image URLs
        const allImageUrls: string[] = [];
        if (receipt.imageUrls && Array.isArray(receipt.imageUrls)) {
          allImageUrls.push(...receipt.imageUrls);
        } else if (receipt.imageUrl) {
          allImageUrls.push(receipt.imageUrl);
        }
        
        if (allImageUrls.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "レシート画像が見つかりません" });
        }
        
        // Build image contents for LLM
        const imageContents: any[] = allImageUrls.map(url => ({
          type: "image_url" as const,
          image_url: { url, detail: "high" as const },
        }));
        imageContents.push({
          type: "text" as const,
          text: `これらの${allImageUrls.length}枚の画像から注文情報を全て抽出してください。`,
        });
        
        // few-shot学習例を取得
        let reRecognizeLearningPrompt = "";
        try {
          const { buildLearningExamplesPrompt } = await import("./db");
          reRecognizeLearningPrompt = await buildLearningExamplesPrompt(8);
        } catch (e) { /* ignore */ }
        
        const ocrResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `あなたはTikTok Shopの注文詳細画面のスクリーンショットを解析する専門AIです。
複数の画像が送信された場合、すべての画像を統合して情報を抽出してください。

以下の情報を抽出してJSON形式で返してください：
{
  "orderNumber": "string or null",
  "totalAmount": number or null,
  "shopName": "string or null",
  "productName": "string or null",
  "orderDate": "string (YYYY-MM-DD) or null",
  "confidence": number (0-100)
}

TikTok Shopの注文番号は「5」または「6」で始まる16〜19桁の数字列です。
金額は「合計金額（税込）」「合計」「支払い金額」などのラベルの近くにある数値です。${reRecognizeLearningPrompt}`,
            },
            {
              role: "user",
              content: imageContents,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "receipt_ocr",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  orderNumber: { type: ["string", "null"] },
                  totalAmount: { type: ["number", "null"] },
                  shopName: { type: ["string", "null"] },
                  productName: { type: ["string", "null"] },
                  orderDate: { type: ["string", "null"] },
                  confidence: { type: "number" },
                },
                required: ["orderNumber", "totalAmount", "shopName", "productName", "orderDate", "confidence"],
                additionalProperties: false,
              },
            },
          },
        });
        
        let parsed: any = {};
        try {
          const content = String(ocrResult.choices?.[0]?.message?.content || "{}");
          parsed = JSON.parse(content);
        } catch (e) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI解析結果のパースに失敗" });
        }
        
        // Update the receipt with new OCR data
        const updateData: any = {};
        if (parsed.totalAmount && parsed.totalAmount > 0) updateData.totalAmount = parsed.totalAmount;
        if (parsed.shopName) updateData.storeName = parsed.shopName;
        if (parsed.orderDate) updateData.purchaseDate = new Date(parsed.orderDate);
        
        // Merge orderNumber and productName into ocrRawText JSON + independent column
        const existingOcr = typeof receipt.ocrRawText === 'string' ? JSON.parse(receipt.ocrRawText || '{}') : (receipt.ocrRawText || {});
        let ocrUpdated = false;
        if (parsed.orderNumber) { existingOcr.orderNumber = parsed.orderNumber; ocrUpdated = true; updateData.orderNumber = parsed.orderNumber; }
        if (parsed.productName) { existingOcr.productName = parsed.productName; existingOcr.items = [{ productName: parsed.productName }]; ocrUpdated = true; }
        if (ocrUpdated) updateData.ocrRawText = JSON.stringify(existingOcr);
        
        // Recalculate points if amount changed
        if (parsed.totalAmount && parsed.totalAmount > 0) {
          updateData.pointsCalculated = Math.floor(parsed.totalAmount / 100);
        }
        
        if (Object.keys(updateData).length > 0) {
          await updateLineReceiptOcr(receipt.id, updateData);
        }
        
        // AI審査ログの注文番号・金額・店舗名も更新する
        const { updateAiAutoReviewLogFields } = await import("./db");
        const logUpdateData: any = {};
        if (parsed.orderNumber) logUpdateData.orderNumber = parsed.orderNumber;
        if (parsed.totalAmount && parsed.totalAmount > 0) logUpdateData.totalAmount = parsed.totalAmount;
        if (parsed.shopName) logUpdateData.storeName = parsed.shopName;
        // AI再認識で注文番号が見つかった場合、aiDecisionとaiCommentも更新
        if (parsed.orderNumber && log.aiDecision === "skipped" && log.aiComment?.includes("注文番号なし")) {
          logUpdateData.aiComment = `再認識で注文番号を検出: ${parsed.orderNumber}`;
        }
        if (Object.keys(logUpdateData).length > 0) {
          await updateAiAutoReviewLogFields(input.logId, logUpdateData);
        }
        
        return {
          orderNumber: parsed.orderNumber,
          totalAmount: parsed.totalAmount,
          shopName: parsed.shopName,
          productName: parsed.productName,
          orderDate: parsed.orderDate,
          confidence: parsed.confidence,
          receiptId: receipt.id,
        };
      }),
    
    // ===== AI Pass 2: 手動キュー再審査 =====
    startPass2: protectedProcedure
      .input(z.object({
        approveThreshold: z.number().min(50).max(100).optional(),
        minUserApprovalRate: z.number().min(0).max(100).optional(),
        sendNotifications: z.boolean().optional(),
        limit: z.number().min(0).optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { startPass2InBackground, isPass2Running } = await import("./services/aiPass2ManualQueueReview");
        
        if (isPass2Running()) {
          return { success: false, message: "AI Pass 2は既に実行中です" };
        }
        
        const { batchId } = startPass2InBackground({
          limit: input?.limit ?? 0,
          approveThreshold: input?.approveThreshold ?? 80,
          minUserApprovalRate: input?.minUserApprovalRate ?? 50,
          adminUserId: ctx.user.id,
          dryRun: false,
          sendNotifications: input?.sendNotifications ?? true,
        });
        
        return { success: true, batchId, message: "AI Pass 2を開始しました" };
      }),
    
    getPass2Progress: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getPass2Progress } = await import("./services/aiPass2ManualQueueReview");
        return getPass2Progress();
      }),
    
    stopPass2: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { stopPass2 } = await import("./services/aiPass2ManualQueueReview");
        stopPass2();
        return { success: true };
      }),

    // AI自動承認設定更新（トグルON/OFF含む）
    updateSettings: protectedProcedure
      .input(z.object({
        isEnabled: z.boolean().optional(),
        confidenceThreshold: z.number().min(0).max(100).optional(),
        batchSize: z.number().min(1).max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { updateAiAutoApproveSetting } = await import("./db");
        return await updateAiAutoApproveSetting({ ...input, updatedBy: ctx.user.id });
      }),
    
    // AI学習フィードバック統計取得
    learningStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const { getAiReceiptLearningStats } = await import("./db");
      return await getAiReceiptLearningStats();
    }),
    
    // AI学習例一覧取得
    learningExamples: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        const { getRecentAiReceiptLearningExamples } = await import("./db");
        return await getRecentAiReceiptLearningExamples(input?.limit ?? 20);
      }),
  }),

  lineLogin: lineLoginRouter,

  // MALL商品管理
  mall: router({
    // 商品一覧取得（公開）
    getProducts: publicProcedure
      .input(z.object({
        status: z.enum(["draft", "active", "sold_out", "archived"]).optional(),
        category: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await getMallProducts(input);
      }),

    // 商品詳細取得（公開）
    getProductById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getMallProductById(input.id);
      }),

    // ブランドIDでMALL商品一覧を取得（公開・ライバー向け）
    getProductsByBrandId: publicProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return await getMallProductsByBrandIdDirect(input.brandId);
      }),

    // カテゴリ一覧取得（公開）
    // レガシーカテゴリ一覧取得（テキストベース）
    getCategories: publicProcedure.query(async () => {
      return await getMallCategories();
    }),

    // ===== ブランドは既存のbrand.listを使用（mall_brandsテーブルは廃止） =====
    // MALL商品のbrandIdは既存のbrandsテーブルを直接参照する

    // ===== カテゴリ管理API =====
    
    // カテゴリレコード一覧取得（公開）
    getCategoryRecords: publicProcedure.query(async () => {
      return await getAllMallCategoryRecords();
    }),

    // カテゴリ詳細取得（公開）
    getCategoryById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getMallCategoryById(input.id);
      }),

    // カテゴリ作成（管理者のみ）
    createCategory: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "カテゴリ名を入力してください"),
        slug: z.string().optional(),
        description: z.string().optional(),
        parentId: z.number().optional(),
        iconEmoji: z.string().optional(),
        sortOrder: z.number().default(0),
        isActive: z.enum(["yes", "no"]).default("yes"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        await createMallCategory(input);
        return { success: true };
      }),

    // カテゴリ更新（管理者のみ）
    updateCategory: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        slug: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        parentId: z.number().nullable().optional(),
        iconEmoji: z.string().nullable().optional(),
        sortOrder: z.number().optional(),
        isActive: z.enum(["yes", "no"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { id, ...data } = input;
        await updateMallCategory(id, data);
        return { success: true };
      }),

    // カテゴリ削除（管理者のみ）
    deleteCategory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        await deleteMallCategory(input.id);
        return { success: true };
      }),

    // ===== 商品管理API =====

    // 商品作成（ログインユーザー全員可）
    createProduct: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        brandId: z.number().nullable().optional(),
        categoryId: z.number().nullable().optional(),
        price: z.number().min(0),
        pointPrice: z.number().optional(),
        stock: z.number().default(0),
        imageUrl: z.string().optional(),
        imageKey: z.string().optional(),
        imageUrls: z.array(z.string()).optional(),
        imageKeys: z.array(z.string()).optional(),
        status: z.enum(["draft", "active", "sold_out", "archived"]).default("draft"),
        sortOrder: z.number().default(0),
        commissionRate: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await createMallProduct(input);
        return { success: true };
      }),

    // 商品更新（ログインユーザー全員可）
    updateProduct: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        brandId: z.number().nullable().optional(),
        categoryId: z.number().nullable().optional(),
        price: z.number().min(0).optional(),
        pointPrice: z.number().nullable().optional(),
        stock: z.number().optional(),
        imageUrl: z.string().optional(),
        imageKey: z.string().optional(),
        imageUrls: z.array(z.string()).optional(),
        imageKeys: z.array(z.string()).optional(),
        status: z.enum(["draft", "active", "sold_out", "archived"]).optional(),
        sortOrder: z.number().optional(),
        commissionRate: z.string().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updateMallProduct(id, data);
        return { success: true };
      }),

    // 商品削除（ログインユーザー全員可）
    deleteProduct: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteMallProduct(input.id);
        return { success: true };
      }),

    // 注文一覧取得
    getOrders: protectedProcedure
      .input(z.object({
        status: z.enum(["pending", "paid", "confirmed", "shipped", "delivered", "cancelled", "refunded"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return await getMallOrders(input);
      }),

    // 注文詳細取得
    getOrderById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getMallOrderById(input.id);
      }),

    // 管理者用: 特定会員の詳細情報取得（ID指定）
    getMemberById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getLineUserById(input.id);
      }),

    // 管理者用: 特定会員の注文履歴取得
    getMemberOrders: protectedProcedure
      .input(z.object({ lineUserId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getMallOrdersByLineUser(input.lineUserId);
      }),

    // 管理者用: 特定会員の保存済み住所一覧取得
    getMemberAddresses: protectedProcedure
      .input(z.object({ lineUserId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await getUserAddresses(input.lineUserId);
      }),

    // 管理者用: 会員のレシート統計（累計購入金額等）
    getMemberReceiptStats: protectedProcedure
      .input(z.object({ lineUserId: z.string() }))
      .query(async ({ ctx, input }) => {
        const receipts = await getLineReceiptsByUser(input.lineUserId);
        const approved = receipts.filter(r => r.status === "approved");
        const totalPurchaseAmount = approved.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
        const totalPointsAwarded = approved.reduce((sum, r) => sum + (Number(r.pointsAwarded) || 0), 0);
        return {
          totalReceipts: receipts.length,
          approvedReceipts: approved.length,
          pendingReceipts: receipts.filter(r => r.status === "pending").length,
          rejectedReceipts: receipts.filter(r => r.status === "rejected").length,
          totalPurchaseAmount,
          totalPointsAwarded,
        };
      }),

    // 注文ステータス更新
    updateOrderStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "paid", "confirmed", "shipped", "delivered", "cancelled", "refunded"]),
        adminNotes: z.string().optional(),
        shippingCarrier: z.string().optional(),
        trackingNumber: z.string().optional(),
        sendNotification: z.boolean().optional().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await updateMallOrderStatus(input.id, input.status, input.adminNotes, {
          shippingCarrier: input.shippingCarrier,
          trackingNumber: input.trackingNumber,
        });

        // ステータス変更時に自動通知を送信
        if (input.sendNotification !== false) {
          try {
            const { sendShippedNotification, sendDeliveredNotification, sendCancelledNotification } = await import("./orderNotifications");
            if (input.status === "shipped") {
              await sendShippedNotification(input.id, input.shippingCarrier, input.trackingNumber);
            } else if (input.status === "delivered") {
              await sendDeliveredNotification(input.id);
            } else if (input.status === "cancelled" || input.status === "refunded") {
              await sendCancelledNotification(input.id, input.adminNotes);
            }
          } catch (notifyError) {
            console.error(`[OrderNotify] ステータス変更通知エラー:`, notifyError);
            // 通知失敗でもステータス更新自体は成功とする
          }
        }

        // ポイント返還・Stripe返金情報をログ出力
        if (result.pointsRefunded > 0) {
          console.log(`[OrderStatus] 注文ID:${input.id} ポイント返還: ${result.pointsRefunded}pt`);
        }
        if (result.stockRestored) {
          console.log(`[OrderStatus] 注文ID:${input.id} 在庫戻し完了`);
        }
        if (result.stripeRefunded) {
          console.log(`[OrderStatus] 注文ID:${input.id} Stripe返金完了`);
        }

        return { 
          success: true, 
          pointsRefunded: result.pointsRefunded,
          stockRestored: result.stockRestored,
          stripeRefunded: result.stripeRefunded,
        };
      }),

    // Stripe Checkoutセッション作成
    createCheckoutSession: publicProcedure
      .input(z.object({
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number().min(1),
        })),
        shippingInfo: z.object({
          name: z.string().min(1),
          phone: z.string().min(1),
          postalCode: z.string().min(1),
          address: z.string().min(1),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // LINEセッションからユーザー情報を取得
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;

        // 商品情報を取得
        const lineItems: Array<{
          price_data: {
            currency: string;
            product_data: { name: string; images?: string[] };
            unit_amount: number;
          };
          quantity: number;
        }> = [];
        let totalAmount = 0;
        const orderItemsData: Array<{
          productId: number;
          quantity: number;
          usePoints: boolean;
        }> = [];

        for (const item of input.items) {
          const product = await getMallProductById(item.productId);
          if (!product) {
            throw new TRPCError({ code: "NOT_FOUND", message: `商品ID ${item.productId} が見つかりません` });
          }
          if (product.status !== "active") {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} は現在販売中ではありません` });
          }
          if (product.stock < item.quantity) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} の在庫が不足しています` });
          }

          const productImages: string[] = [];
          if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
            productImages.push(String(product.imageUrls[0]));
          }

          lineItems.push({
            price_data: {
              currency: "jpy",
              product_data: {
                name: product.name,
                ...(productImages.length > 0 ? { images: productImages } : {}),
              },
              unit_amount: product.price,
            },
            quantity: item.quantity,
          });

          totalAmount += product.price * item.quantity;
          orderItemsData.push({
            productId: product.id,
            quantity: item.quantity,
            usePoints: false,
          });
        }

        // 送料計算: 5,000円未満は880円、5,000円以上は送料無料
        const SHIPPING_FEE = 880;
        const FREE_SHIPPING_THRESHOLD = 5000;
        const shippingFee = totalAmount < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;

        // 注文を作成（pendingステータス）
        const orderResult = await createMallOrder({
          lineUserId: lineUser.id,
          items: orderItemsData,
          pointsToUse: 0,
          shippingInfo: input.shippingInfo,
        });

        // Stripe Checkoutセッションを作成
        const Stripe = (await import("stripe")).default;
        const stripeClient = new Stripe(ENV.stripeSecretKey, {
          apiVersion: "2025-01-27.acacia" as any,
        });

        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, "") || "";

        // 送料がある場合はline_itemsに追加
        if (shippingFee > 0) {
          lineItems.push({
            price_data: {
              currency: "jpy",
              product_data: {
                name: "送料",
              },
              unit_amount: shippingFee,
            },
            quantity: 1,
          });
        }

        const session = await stripeClient.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: lineItems,
          mode: "payment",
          success_url: `${origin}/mall/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${orderResult.orderNumber}`,
          cancel_url: `${origin}/mall/checkout/cancel?order=${orderResult.orderNumber}`,
          client_reference_id: lineUser.id.toString(),
          customer_email: lineUser.email || undefined,
          allow_promotion_codes: true,
          metadata: {
            user_id: lineUser.id.toString(),
            order_number: orderResult.orderNumber,
            customer_name: lineUser.displayName || "",
          },
        });

        // 注文にStripeセッションIDを保存
        await updateMallOrderStripeInfo(orderResult.orderId, {
          stripeSessionId: session.id,
          paymentMethod: "stripe",
        });

        return { checkoutUrl: session.url, orderNumber: orderResult.orderNumber };
      }),

    // 注文ステータス確認（決済完了後のポーリング用）
    checkOrderPaymentStatus: publicProcedure
      .input(z.object({
        orderNumber: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const order = await getMallOrderByOrderNumber(input.orderNumber);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "注文が見つかりません" });
        }
        if (order.lineUserId !== result.lineUser.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "アクセス権限がありません" });
        }

        // Webhook未到着のフォールバック: pendingのままならStripe APIで直接確認
        if (order.status === "pending" && order.stripeSessionId && order.paymentMethod === "stripe") {
          try {
            const Stripe = (await import("stripe")).default;
            const stripeClient = new Stripe(ENV.stripeSecretKey, {
              apiVersion: "2025-01-27.acacia" as any,
            });
            const session = await stripeClient.checkout.sessions.retrieve(order.stripeSessionId);
            
            if (session.payment_status === "paid") {
              // Webhookが届いていなかったが、実際には決済完了 → DBを更新
              console.log(`[Payment Fallback] Order ${order.orderNumber} confirmed paid via Stripe API (webhook missed)`);
              await updateMallOrderStripeInfo(order.id, {
                status: "paid",
                stripePaymentIntentId: session.payment_intent as string || undefined,
              });

              // LINE通知を送信（フォールバック経由）
              try {
                const { sendOrderConfirmationLine } = await import("./stripeWebhook");
                await sendOrderConfirmationLine(order.id);
              } catch (lineErr) {
                console.error(`[Payment Fallback] LINE notification failed for order ${order.orderNumber}:`, lineErr);
              }

              return {
                orderNumber: order.orderNumber,
                status: "paid" as const,
                totalAmount: order.totalAmount,
                paymentMethod: order.paymentMethod,
              };
            }
          } catch (err) {
            console.error(`[Payment Fallback] Error checking Stripe session for order ${order.orderNumber}:`, err);
            // フォールバック失敗時は通常のレスポンスを返す
          }
        }

        return {
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
        };
      }),

    // ユーザーの注文履歴取得
    getMyOrders: publicProcedure.query(async ({ ctx }) => {
      const result = await getLineUserFromSession(ctx);
      if (!result || !result.lineUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
      }
      return await getMallOrdersByLineUser(result.lineUser.id);
    }),

    // ユーザーによる注文キャンセル
    cancelMyOrder: publicProcedure
      .input(z.object({
        orderId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }

        // 注文がこのユーザーのものか確認
        const order = await getMallOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "注文が見つかりません" });
        }
        if (order.order.lineUserId !== result.lineUser.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "この注文をキャンセルする権限がありません" });
        }

        // キャンセル可能なステータスか確認
        const cancellableStatuses = ["pending", "paid", "confirmed"];
        if (!cancellableStatuses.includes(order.order.status)) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "この注文はキャンセルできません（発送済みまたは完了済み）" 
          });
        }

        // キャンセル実行（ポイント返還・在庫戻し・Stripe返金含む）
        const cancelResult = await cancelMallOrder(input.orderId, input.reason);

        // キャンセル通知を送信
        try {
          const lineUser = result.lineUser;
          const cancelDate = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
          const refundInfo = cancelResult.stripeRefunded ? '\nカードへの返金が処理されました。反映まで数日かかる場合があります。' : '';
          const notificationText = `\u274c 注文キャンセル\n\n注文番号: ${order.order.orderNumber}\nキャンセル日時: ${cancelDate}${cancelResult.pointsRefunded > 0 ? `\n返還ポイント: ${cancelResult.pointsRefunded.toLocaleString()} pt` : ''}${refundInfo}\n\nご注文のキャンセルが完了しました。`;

          if (lineUser.lineUserId && !lineUser.lineUserId.startsWith('email_')) {
            const { pushMessage } = await import("./line");
            await pushMessage(lineUser.lineUserId, [{ type: "text", text: notificationText }]);
          }

          if (lineUser.email) {
            const { sendEmail } = await import("./emailService");
            await sendEmail({
              to: [lineUser.email],
              subject: `【LCJ MALL】注文キャンセル完了 - ${order.order.orderNumber}`,
              content: `${lineUser.displayName || lineUser.email} 様\n\n注文番号: ${order.order.orderNumber} のキャンセルが完了しました。${cancelResult.pointsRefunded > 0 ? `\n返還ポイント: ${cancelResult.pointsRefunded.toLocaleString()} pt` : ''}\n\n---\nLCJ MALL`,
            });
          }
        } catch (notifyError) {
          console.error("[CancelOrder] 通知送信エラー:", notifyError);
        }

        const messages: string[] = ["注文をキャンセルしました。"];
        if (cancelResult.pointsRefunded > 0) {
          messages.push(`${cancelResult.pointsRefunded.toLocaleString()}ポイントを返還しました。`);
        }
        if (cancelResult.stripeRefunded) {
          messages.push("カードへの返金を処理しました。反映まで数日かかる場合があります。");
        }
        return { 
          success: true, 
          pointsRefunded: cancelResult.pointsRefunded,
          stripeRefunded: cancelResult.stripeRefunded,
          message: messages.join(""),
        };
      }),

    // 公開商品一覧取得（アクティブな商品のみ）
    getPublicProducts: publicProcedure.query(async () => {
      return await getMallProducts({ status: "active" });
    }),

    // ポイントで商品購入
    purchaseWithPoints: publicProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().min(1).default(1),
        shippingInfo: z.object({
          name: z.string().min(1),
          phone: z.string().min(1),
          postalCode: z.string().min(1),
          address: z.string().min(1),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // LINEセッションからユーザー情報を取得
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUserId = result.lineUser.lineUserId || `email_${result.lineUser.id}`;

        // 商品情報を取得
        const product = await getMallProductById(input.productId);
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "商品が見つかりません" });
        }

        if (product.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "この商品は現在購入できません" });
        }

        if (product.stock < input.quantity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "在庫が不足しています" });
        }

        if (!product.pointPrice) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "この商品はポイント購入に対応していません" });
        }

        const subtotalPoints = product.pointPrice * input.quantity;

        // 送料計算: 5,000pt未満は880pt、5,000pt以上は送料無料
        const SHIPPING_FEE = 880;
        const FREE_SHIPPING_THRESHOLD = 5000;
        const shippingFee = subtotalPoints < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
        const totalPoints = subtotalPoints + shippingFee;

        // ポイント残高を確認
        const balance = await getLinePointBalance(lineUserId);
        if (!balance || balance.balance < totalPoints) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `ポイントが不足しています（必要: ${totalPoints.toLocaleString()} pt${shippingFee > 0 ? `（送料${shippingFee} pt含む）` : ""} / 残高: ${(balance?.balance || 0).toLocaleString()} pt）` });
        }

        // 注文レコードを作成（ポイント消費・在庫減算・注文履歴作成を一括で実行）
        const orderResult = await createMallOrder({
          lineUserId: result.lineUser.id,
          pointLineUserId: lineUserId, // email_${id} または LINE userId
          items: [{
            productId: input.productId,
            quantity: input.quantity,
            usePoints: true,
          }],
          pointsToUse: totalPoints,
          isFullPointPurchase: true, // ポイント全額購入
          shippingInfo: input.shippingInfo,
          shippingFee,
        });

        // 注文確認通知を送信
        try {
          const lineUser = result.lineUser;
          const orderDate = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
          const shippingText = shippingFee > 0 ? `\n■ 送料: ${shippingFee.toLocaleString()} pt` : "\n■ 送料: 無料";
          const notificationText = `📦 注文確認\n\nご注文ありがとうございます！\n\n■ 商品: ${product.name}\n■ 数量: ${input.quantity}\n■ 小計: ${subtotalPoints.toLocaleString()} pt${shippingText}\n■ 合計: ${totalPoints.toLocaleString()} pt\n■ 注文番号: ${orderResult.orderNumber}\n■ 注文日時: ${orderDate}\n\n発送準備ができ次第、お知らせいたします。`;

          // LINE通知（LINEユーザーの場合）
          if (lineUser.lineUserId && !lineUser.lineUserId.startsWith('email_')) {
            const { pushMessage } = await import("./line");
            await pushMessage(lineUser.lineUserId, [{ type: "text", text: notificationText }]);
          }

          // メール通知（メールアドレスがある場合）
          if (lineUser.email) {
            const { sendEmail } = await import("./emailService");
            await sendEmail({
              to: [lineUser.email],
              subject: `【LCJ MALL】注文確認 - ${orderResult.orderNumber}`,
              content: `${lineUser.displayName || lineUser.email} 様\n\nご注文ありがとうございます。\n\n■ 商品: ${product.name}\n■ 数量: ${input.quantity}\n■ 小計: ${subtotalPoints.toLocaleString()} pt${shippingText}\n■ 合計: ${totalPoints.toLocaleString()} pt\n■ 注文番号: ${orderResult.orderNumber}\n■ 注文日時: ${orderDate}\n\n発送準備ができ次第、お知らせいたします。\n\n---\nLCJ MALL`,
            });
          }
        } catch (notifyError) {
          console.error("[PurchaseWithPoints] 通知送信エラー:", notifyError);
          // 通知失敗でも購入自体は成功とする
        }

        return { success: true, pointsUsed: totalPoints, shippingFee, subtotal: subtotalPoints, orderNumber: orderResult.orderNumber };
      }),

    // 商品画像アップロード（管理者のみ）
    uploadProductImage: protectedProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
        productId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log(`[Upload] Starting upload for user ${ctx.user.id}, role: ${ctx.user.role}, filename: ${input.filename}, base64 length: ${input.base64.length}`);

        try {
          const buffer = Buffer.from(input.base64, "base64");
          console.log(`[Upload] Buffer size: ${buffer.length} bytes`);
          
          if (buffer.length === 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "画像データが空です" });
          }
          
          // 拡張子を安全に取得（長いファイル名やクエリパラメータ付きにも対応）
          const filenameParts = input.filename.split(".");
          let ext = filenameParts.length > 1 ? filenameParts.pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "png";
          // 有効な画像拡張子のみ許可
          const validExts = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"];
          if (!validExts.includes(ext)) {
            ext = "png";
          }
          const key = `mall/products/${nanoid()}.${ext}`;
          const contentTypeMap: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            bmp: "image/bmp",
            ico: "image/x-icon",
          };
          const contentType = contentTypeMap[ext] || "image/png";
          
          console.log(`[Upload] Uploading to S3: key=${key}, contentType=${contentType}, size=${buffer.length}`);
          const { url } = await storagePut(key, buffer, contentType);
          console.log(`[Upload] S3 upload success: ${url}`);
        
        // 既存商品への画像追加（imageUrlsに追記）
        if (input.productId) {
          const product = await getMallProductById(input.productId);
          if (product) {
            const existingUrls = product.imageUrls || [];
            const existingKeys = product.imageKeys || [];
            await updateMallProduct(input.productId, {
              imageUrl: existingUrls.length === 0 ? url : product.imageUrl,
              imageKey: existingKeys.length === 0 ? key : product.imageKey,
              imageUrls: [...existingUrls, url],
              imageKeys: [...existingKeys, key],
            });
          }
        }
        
        return { url, key };
        } catch (error) {
          console.error(`[Upload] Error:`, error);
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: `画像アップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
          });
        }
      }),

    // 商品画像の並び替え・削除（ログインユーザー全員可）
    updateProductImages: protectedProcedure
      .input(z.object({
        productId: z.number(),
        imageUrls: z.array(z.string()),
        imageKeys: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateMallProduct(input.productId, {
          imageUrl: input.imageUrls[0] || null,
          imageKey: input.imageKeys[0] || null,
          imageUrls: input.imageUrls,
          imageKeys: input.imageKeys,
        });
        return { success: true };
      }),

    // ===== 住所管理API =====
    
    // 郵便番号から住所を検索
    searchAddressByPostalCode: publicProcedure
      .input(z.object({
        postalCode: z.string().regex(/^\d{7}$/, "郵便番号は7桁の数字で入力してください"),
      }))
      .query(async ({ input }) => {
        try {
          // 郵便番号検索API（zipcloud）を使用
          const response = await fetch(
            `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${input.postalCode}`
          );
          const data = await response.json();
          
          if (data.status !== 200 || !data.results || data.results.length === 0) {
            return { found: false, address: null };
          }
          
          const result = data.results[0];
          return {
            found: true,
            address: {
              prefecture: result.address1,
              city: result.address2,
              town: result.address3,
            },
          };
        } catch (error) {
          console.error("郵便番号検索エラー:", error);
          return { found: false, address: null };
        }
      }),

    // ユーザーの住所一覧を取得
    getMyAddresses: publicProcedure
      .query(async ({ ctx }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        return await getUserAddresses(result.lineUser.id);
      }),

    // 住所を追加
    addAddress: publicProcedure
      .input(z.object({
        label: z.string().max(50).default("自宅"),
        recipientName: z.string().min(1).max(100),
        phoneNumber: z.string().min(10).max(20),
        postalCode: z.string().regex(/^\d{7}$/),
        prefecture: z.string().min(1).max(20),
        city: z.string().min(1).max(100),
        addressLine1: z.string().min(1).max(255),
        addressLine2: z.string().max(255).optional(),
        isDefault: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;
        
        // 初めての住所の場合はデフォルトに設定
        const existingAddresses = await getUserAddresses(lineUser.id);
        const isDefault = existingAddresses.length === 0 ? true : input.isDefault;
        
        return await createUserAddress({
          lineUserId: lineUser.id,
          label: input.label,
          recipientName: input.recipientName,
          phoneNumber: input.phoneNumber,
          postalCode: input.postalCode,
          prefecture: input.prefecture,
          city: input.city,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || null,
          isDefault,
        });
      }),

    // 住所を更新
    updateAddress: publicProcedure
      .input(z.object({
        id: z.number(),
        label: z.string().max(50).optional(),
        recipientName: z.string().min(1).max(100).optional(),
        phoneNumber: z.string().min(10).max(20).optional(),
        postalCode: z.string().regex(/^\d{7}$/).optional(),
        prefecture: z.string().min(1).max(20).optional(),
        city: z.string().min(1).max(100).optional(),
        addressLine1: z.string().min(1).max(255).optional(),
        addressLine2: z.string().max(255).optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;
        
        const address = await getUserAddressById(input.id);
        if (!address || address.lineUserId !== lineUser.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "住所が見つかりません" });
        }
        
        const { id, ...updateData } = input;
        return await updateUserAddress(id, updateData);
      }),

    // 住所を削除
    deleteAddress: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;
        
        const address = await getUserAddressById(input.id);
        if (!address || address.lineUserId !== lineUser.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "住所が見つかりません" });
        }
        
        await deleteUserAddress(input.id);
        
        // 削除した住所がデフォルトだった場合、他の住所をデフォルトに
        if (address.isDefault) {
          const remainingAddresses = await getUserAddresses(lineUser.id);
          if (remainingAddresses.length > 0) {
            await setDefaultUserAddress(remainingAddresses[0].id, lineUser.id);
          }
        }
        
        return { success: true };
      }),

    // デフォルト住所を設定
    setDefaultAddress: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;
        
        const address = await getUserAddressById(input.id);
        if (!address || address.lineUserId !== lineUser.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "住所が見つかりません" });
        }
        
        await setDefaultUserAddress(input.id, lineUser.id);
        return { success: true };
      }),

    // ===== レビュー API =====
    getReviews: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        const [reviews, stats] = await Promise.all([
          getProductReviews(input.productId),
          getProductReviewStats(input.productId),
        ]);
        return { reviews, stats };
      }),

    createReview: publicProcedure
      .input(z.object({
        productId: z.number(),
        rating: z.number().min(1).max(5),
        title: z.string().max(100).optional(),
        content: z.string().max(2000).optional(),
        imageUrls: z.array(z.string()).max(5).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;

        const alreadyReviewed = await hasUserReviewedProduct(input.productId, lineUser.id);
        if (alreadyReviewed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "この商品は既にレビュー済みです" });
        }

        return await createProductReview({
          productId: input.productId,
          lineUserId: lineUser.id,
          rating: input.rating,
          title: input.title ?? undefined,
          content: input.content ?? undefined,
          imageUrls: input.imageUrls || [],
        });
      }),

    deleteReview: publicProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        await deleteProductReview(input.reviewId, result.lineUser.id);
        return { success: true };
      }),

    // ===== 関連商品 API =====
    getRelatedProducts: publicProcedure
      .input(z.object({ productId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getRelatedProducts(input.productId, input.limit || 8);
      }),

    // ===== 商品説明画像 API =====
    getDescImages: publicProcedure
      .input(z.object({ productId: z.number() }))
      .query(async ({ input }) => {
        return await getProductDescImages(input.productId);
      }),
    addDescImage: protectedProcedure
      .input(z.object({
        productId: z.number(),
        imageUrl: z.string(),
        imageKey: z.string().optional(),
        sortOrder: z.number().default(0),
        caption: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await addProductDescImage({
          productId: input.productId,
          imageUrl: input.imageUrl,
          imageKey: input.imageKey || null,
          sortOrder: input.sortOrder,
          caption: input.caption || null,
        });
      }),
    deleteDescImage: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteProductDescImage(input.id);
      }),

    // ===== お気に入り API =====
    getFavoriteIds: publicProcedure
      .query(async ({ ctx }) => {
        try {
          const result = await getLineUserFromSession(ctx);
          if (!result || !result.lineUser) return [];
          return await getMallFavoriteProductIds(result.lineUser.id);
        } catch {
          return [];
        }
      }),

    addFavorite: publicProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        return await addMallFavorite(result.lineUser.id, input.productId);
      }),

    removeFavorite: publicProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        return await removeMallFavorite(result.lineUser.id, input.productId);
      }),

    getFavorites: publicProcedure
      .query(async ({ ctx }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        return await getMallFavoritesByUser(result.lineUser.id);
      }),

    getFavoriteCounts: publicProcedure
      .query(async () => {
        return await getMallFavoriteCounts();
      }),

    // ===== おすすめ商品 API =====
    getRecommendedProducts: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        try {
          const result = await getLineUserFromSession(ctx);
          if (result && result.lineUser) {
            return await getRecommendedProducts(result.lineUser.id, input?.limit || 12);
          }
        } catch {
          // 未ログインの場合は人気商品を返す
        }
        return await getPopularProducts(input?.limit || 12);
      }),

    getPopularProducts: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getPopularProducts(input?.limit || 12);
      }),

    // ===== レビュー画像アップロード API =====
    uploadReviewImage: publicProcedure
      .input(z.object({
        base64: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "画像サイズは5MB以下にしてください" });
        }
        const ext = input.mimeType.split("/")[1] || "jpg";
        const key = `review-images/${result.lineUser.id}/${Date.now()}-${nanoid(8)}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        return { url, key };
      }),

    // ===== 全商品レビュー統計 API =====
    getAllReviewStats: publicProcedure
      .query(async () => {
        return await getAllProductReviewStats();
      }),

    // ===== 閲覧履歴 API =====
    recordView: publicProcedure
      .input(z.object({ productId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) return { success: false }; // 未ログインでもエラーにしない
        return await recordMallViewHistory(result.lineUser.id, input.productId);
      }),

    getViewHistory: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) return [];
        return await getMallViewHistoryByUser(result.lineUser.id, input?.limit ?? 20);
      }),

    // ===== カートAPI =====
    getCartItems: publicProcedure
      .query(async ({ ctx }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) return [];
        return await getMallCart(result.lineUser.id);
      }),

    addToCart: publicProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().min(1).default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        await addToMallCart(result.lineUser.id, input.productId, input.quantity);
        return { success: true };
      }),

    updateCartQuantity: publicProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().min(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        await updateMallCartQuantity(result.lineUser.id, input.productId, input.quantity);
        return { success: true };
      }),

    removeFromCart: publicProcedure
      .input(z.object({
        productId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        await removeFromMallCart(result.lineUser.id, input.productId);
        return { success: true };
      }),

    clearCart: publicProcedure
      .mutation(async ({ ctx }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        await clearMallCart(result.lineUser.id);
        return { success: true };
      }),

    getCartCount: publicProcedure
      .query(async ({ ctx }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) return { count: 0 };
        const items = await getMallCart(result.lineUser.id);
        const count = items.reduce((sum: number, item: any) => sum + (item.cart?.quantity || 0), 0);
        return { count };
      }),

    // カートからStripe一括チェックアウト
    cartCheckoutStripe: publicProcedure
      .input(z.object({
        shippingInfo: z.object({
          name: z.string().min(1),
          phone: z.string().min(1),
          postalCode: z.string().min(1),
          address: z.string().min(1),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;

        // カート内容を取得
        const cartItems = await getMallCart(lineUser.id);
        if (cartItems.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "カートが空です" });
        }

        // 商品のバリデーション & Stripe line_items構築
        const lineItems: Array<{
          price_data: {
            currency: string;
            product_data: { name: string; images?: string[] };
            unit_amount: number;
          };
          quantity: number;
        }> = [];
        let totalAmount = 0;
        const orderItemsData: Array<{
          productId: number;
          quantity: number;
          usePoints: boolean;
        }> = [];

        for (const item of cartItems) {
          const product = item.product;
          const qty = item.cart.quantity;

          if (product.status !== "active") {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} は現在販売中ではありません` });
          }
          if (product.stock < qty) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} の在庫が不足しています（残り${product.stock}点）` });
          }

          const productImages: string[] = [];
          if (product.imageUrls && Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
            productImages.push(String(product.imageUrls[0]));
          }

          lineItems.push({
            price_data: {
              currency: "jpy",
              product_data: {
                name: product.name,
                ...(productImages.length > 0 ? { images: productImages } : {}),
              },
              unit_amount: product.price,
            },
            quantity: qty,
          });

          totalAmount += product.price * qty;
          orderItemsData.push({
            productId: product.id,
            quantity: qty,
            usePoints: false,
          });
        }

        // 送料計算: 5,000円未満は880円、5,000円以上は送料無料
        const SHIPPING_FEE = 880;
        const FREE_SHIPPING_THRESHOLD = 5000;
        const shippingFee = totalAmount < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;

        // 注文を作成（pendingステータス）
        const orderResult = await createMallOrder({
          lineUserId: lineUser.id,
          items: orderItemsData,
          pointsToUse: 0,
          shippingInfo: input.shippingInfo,
        });

        // Stripe Checkoutセッションを作成
        const Stripe = (await import("stripe")).default;
        const stripeClient = new Stripe(ENV.stripeSecretKey, {
          apiVersion: "2025-01-27.acacia" as any,
        });

        const origin = ctx.req.headers.origin || ctx.req.headers.referer?.replace(/\/$/, "") || "";

        // 送料がある場合はline_itemsに追加
        if (shippingFee > 0) {
          lineItems.push({
            price_data: {
              currency: "jpy",
              product_data: {
                name: "送料",
              },
              unit_amount: shippingFee,
            },
            quantity: 1,
          });
        }

        const session = await stripeClient.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: lineItems,
          mode: "payment",
          success_url: `${origin}/mall/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${orderResult.orderNumber}`,
          cancel_url: `${origin}/mall/checkout/cancel?order=${orderResult.orderNumber}`,
          client_reference_id: lineUser.id.toString(),
          customer_email: lineUser.email || undefined,
          allow_promotion_codes: true,
          metadata: {
            user_id: lineUser.id.toString(),
            order_number: orderResult.orderNumber,
            customer_name: lineUser.displayName || "",
            source: "cart",
          },
        });

        // 注文にStripeセッションIDを保存
        await updateMallOrderStripeInfo(orderResult.orderId, {
          stripeSessionId: session.id,
          paymentMethod: "stripe",
        });

        return {
          checkoutUrl: session.url,
          orderNumber: orderResult.orderNumber,
          totalAmount,
          shippingFee,
          itemCount: cartItems.length,
        };
      }),

    // カートからポイント一括購入
    cartCheckoutPoints: publicProcedure
      .input(z.object({
        shippingInfo: z.object({
          name: z.string().min(1),
          phone: z.string().min(1),
          postalCode: z.string().min(1),
          address: z.string().min(1),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUser = result.lineUser;
        const lineUserId = lineUser.lineUserId || `email_${lineUser.id}`;

        // カート内容を取得
        const cartItems = await getMallCart(lineUser.id);
        if (cartItems.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "カートが空です" });
        }

        // 全商品がポイント購入対応か確認 & 合計ポイント計算
        let totalPoints = 0;
        const orderItemsData: Array<{
          productId: number;
          quantity: number;
          usePoints: boolean;
        }> = [];

        for (const item of cartItems) {
          const product = item.product;
          const qty = item.cart.quantity;

          if (product.status !== "active") {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} は現在販売中ではありません` });
          }
          if (product.stock < qty) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} の在庫が不足しています（残り${product.stock}点）` });
          }
          if (!product.pointPrice) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `${product.name} はポイント購入に対応していません` });
          }

          totalPoints += product.pointPrice * qty;
          orderItemsData.push({
            productId: product.id,
            quantity: qty,
            usePoints: true,
          });
        }

        // 送料計算: 5,000pt未満は880pt、5,000pt以上は送料無料
        const SHIPPING_FEE = 880;
        const FREE_SHIPPING_THRESHOLD = 5000;
        const subtotalPoints = totalPoints;
        const shippingFee = subtotalPoints < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;
        totalPoints = subtotalPoints + shippingFee;

        // ポイント残高を確認
        const balance = await getLinePointBalance(lineUserId);
        if (!balance || balance.balance < totalPoints) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `ポイントが不足しています（必要: ${totalPoints.toLocaleString()} pt${shippingFee > 0 ? `（送料${shippingFee} pt含む）` : ""} / 残高: ${(balance?.balance || 0).toLocaleString()} pt）` });
        }

        // 注文レコードを作成（ポイント消費・在庫減算・注文履歴作成を一括で実行）
        const orderResult = await createMallOrder({
          lineUserId: lineUser.id,
          pointLineUserId: lineUserId,
          items: orderItemsData,
          pointsToUse: totalPoints,
          isFullPointPurchase: true,
          shippingInfo: input.shippingInfo,
          shippingFee,
        });

        // 注文確認通知を送信
        try {
          const itemNames = cartItems.map(i => `${i.product.name} ×${i.cart.quantity}`).join("\n  ");
          const orderDate = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
          const shippingText = shippingFee > 0 ? `\n■ 送料: ${shippingFee.toLocaleString()} pt` : "\n■ 送料: 無料";
          const notificationText = `📦 注文確認\n\nご注文ありがとうございます！\n\n■ 商品:\n  ${itemNames}\n■ 小計: ${subtotalPoints.toLocaleString()} pt${shippingText}\n■ 合計: ${totalPoints.toLocaleString()} pt\n■ 注文番号: ${orderResult.orderNumber}\n■ 注文日時: ${orderDate}\n\n発送準備ができ次第、お知らせいたします。`;

          if (lineUser.lineUserId && !lineUser.lineUserId.startsWith('email_')) {
            const { pushMessage } = await import("./line");
            await pushMessage(lineUser.lineUserId, [{ type: "text", text: notificationText }]);
          }

          if (lineUser.email) {
            const { sendEmail } = await import("./emailService");
            await sendEmail({
              to: [lineUser.email],
              subject: `【LCJ MALL】注文確認 - ${orderResult.orderNumber}`,
              content: `${lineUser.displayName || lineUser.email} 様\n\nご注文ありがとうございます。\n\n■ 商品:\n  ${itemNames}\n■ 小計: ${subtotalPoints.toLocaleString()} pt${shippingText}\n■ 合計: ${totalPoints.toLocaleString()} pt\n■ 注文番号: ${orderResult.orderNumber}\n■ 注文日時: ${orderDate}\n\n発送準備ができ次第、お知らせいたします。\n\n---\nLCJ MALL`,
            });
          }
        } catch (notifyError) {
          console.error("[CartCheckoutPoints] 通知送信エラー:", notifyError);
        }

        return {
          success: true,
          pointsUsed: totalPoints,
          shippingFee,
          subtotal: subtotalPoints,
          orderNumber: orderResult.orderNumber,
          itemCount: cartItems.length,
        };
      }),

    // カートの合計情報取得（チェックアウト画面用）
    getCartSummary: publicProcedure
      .query(async ({ ctx }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          return { items: [], subtotal: 0, totalPoints: 0, shippingFee: 0, allPointEligible: false, pointBalance: 0 };
        }
        const lineUser = result.lineUser;
        const lineUserId = lineUser.lineUserId || `email_${lineUser.id}`;

        const cartItems = await getMallCart(lineUser.id);
        let subtotal = 0;
        let totalPoints = 0;
        let allPointEligible = cartItems.length > 0;

        const items = cartItems.map((item: any) => {
          const price = item.product.price * item.cart.quantity;
          subtotal += price;
          if (item.product.pointPrice) {
            totalPoints += item.product.pointPrice * item.cart.quantity;
          } else {
            allPointEligible = false;
          }
          return {
            productId: item.product.id,
            name: item.product.name,
            price: item.product.price,
            pointPrice: item.product.pointPrice,
            quantity: item.cart.quantity,
            imageUrl: item.product.imageUrl,
          };
        });

        const SHIPPING_FEE = 880;
        const FREE_SHIPPING_THRESHOLD = 5000;
        const shippingFee = subtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0;

        const balance = await getLinePointBalance(lineUserId);

        return {
          items,
          subtotal,
          totalPoints,
          shippingFee,
          allPointEligible,
          pointBalance: balance?.balance || 0,
        };
      }),

    // ===== LCJ MALLダッシュボード統計API =====
    getDashboardStats: protectedProcedure
      .query(async () => {
        return await getMallDashboardStats();
      }),

    getSalesChart: protectedProcedure
      .input(z.object({
        period: z.enum(["daily", "monthly"]).default("daily"),
        months: z.number().default(6),
      }).optional())
      .query(async ({ input }) => {
        return await getMallSalesChart(input?.period || "daily", input?.months || 6);
      }),

    getMemberGrowthChart: protectedProcedure
      .input(z.object({
        months: z.number().default(6),
      }).optional())
      .query(async ({ input }) => {
        return await getMallMemberGrowthChart(input?.months || 6);
      }),
  }),

  // ===== TikTok Shopポイント申請API =====
  pointRequest: router({
    // ポイント申請を作成
    submit: protectedProcedure
      .input(z.object({
        orderNumber: z.string().min(1, "注文番号を入力してください"),
        orderAmount: z.number().min(1, "注文金額を入力してください"),
        deliveryDate: z.string().optional(),
        receiptImage: z.object({
          base64: z.string(),
          mimeType: z.string(),
        }),
        deliveryImage: z.object({
          base64: z.string(),
          mimeType: z.string(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 1日5件の上限チェック
        const todayCount = await countTodayPointRequestsByUser(ctx.user.id);
        if (todayCount >= 5) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "1日の申請上限（5件）に達しています。明日再度お試しください。" 
          });
        }

        // 重複注文番号チェック（pointRequests + lineReceipts 横断チェック）
        const duplicateCheck = await checkOrderNumberExists(input.orderNumber);
        if (duplicateCheck.exists) {
          const sourceLabel = duplicateCheck.source === "lineReceipt" ? "LINEレシート" : "Webフォーム";
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: `この注文番号は既に${sourceLabel}から申請済みです。` 
          });
        }

        // レシート画像をS3にアップロード（失敗してもデータ保存は続行）
        let receiptUrl: string = "";
        let receiptKey: string = "";
        try {
          const receiptBuffer = Buffer.from(input.receiptImage.base64, "base64");
          const receiptExt = input.receiptImage.mimeType.split("/")[1] || "png";
          receiptKey = `point-requests/${ctx.user.id}/${nanoid()}-receipt.${receiptExt}`;
          const receiptResult = await storagePut(receiptKey, receiptBuffer, input.receiptImage.mimeType);
          receiptUrl = receiptResult.url;
        } catch (uploadErr) {
          console.error('[Point Request] Receipt image upload failed (continuing without image):', uploadErr);
          receiptUrl = "";
          receiptKey = "";
        }

        // 配達済み画像をS3にアップロード（任意・失敗してもデータ保存は続行）
        let deliveryUrl: string | undefined;
        let deliveryKey: string | undefined;
        if (input.deliveryImage) {
          try {
            const deliveryBuffer = Buffer.from(input.deliveryImage.base64, "base64");
            const deliveryExt = input.deliveryImage.mimeType.split("/")[1] || "png";
            deliveryKey = `point-requests/${ctx.user.id}/${nanoid()}-delivery.${deliveryExt}`;
            const result = await storagePut(deliveryKey, deliveryBuffer, input.deliveryImage.mimeType);
            deliveryUrl = result.url;
          } catch (uploadErr) {
            console.error('[Point Request] Delivery image upload failed (continuing without image):', uploadErr);
            deliveryUrl = undefined;
            deliveryKey = undefined;
          }
        }

        // ポイント計算（1%還元）
        const pointsRequested = Math.floor(input.orderAmount * 0.01);

        // 申請を作成
        const requestId = await createPointRequest({
          userId: ctx.user.id,
          orderNumber: input.orderNumber,
          orderAmount: input.orderAmount,
          deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : undefined,
          receiptImageUrl: receiptUrl,
          receiptImageKey: receiptKey,
          deliveryImageUrl: deliveryUrl,
          deliveryImageKey: deliveryKey,
          pointsRequested,
          status: "pending",
        });

        return { 
          success: true, 
          requestId, 
          pointsRequested,
          message: `${pointsRequested}ポイントの申請を受け付けました。承認後にポイントが付与されます。`
        };
      }),

    // 自分の申請一覧を取得
    myRequests: protectedProcedure
      .query(async ({ ctx }) => {
        return await getPointRequestsByUserId(ctx.user.id);
      }),

    // 自分のポイント残高を取得
    myBalance: protectedProcedure
      .query(async ({ ctx }) => {
        const balance = await getUserPointBalance(ctx.user.id);
        const expiring = await getExpiringPoints(ctx.user.id);
        return {
          balance: balance?.balance || 0,
          totalEarned: balance?.totalEarned || 0,
          totalUsed: balance?.totalUsed || 0,
          expiring: {
            in7Days: expiring.expiringIn7Days,
            in30Days: expiring.expiringIn30Days,
            in60Days: expiring.expiringIn60Days,
            breakdown: expiring.breakdown.map(b => ({
              expiresAt: b.expiresAt.getTime(),
              amount: b.amount,
            })),
          },
        };
      }),

    // 自分のポイント取引履歴を取得
    myTransactions: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await getUserPointTransactions(ctx.user.id, input?.limit || 50);
      }),

    // 今日の申請数を取得
    todayCount: protectedProcedure
      .query(async ({ ctx }) => {
        const count = await countTodayPointRequestsByUser(ctx.user.id);
        return { count, remaining: 5 - count };
      }),

    // ===== 管理者向けAPI =====

    // 承認待ちの申請一覧を取得
    pendingRequests: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        return await getPendingPointRequests();
      }),

    // 全ての申請一覧を取得
    allRequests: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        return await getAllPointRequests(input?.limit || 100);
      }),

    // 申請を承認
    approve: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        pointsApproved: z.number().optional(), // 指定がなければ申請ポイントをそのまま承認
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }

        const request = await getPointRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
        }

        if (request.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "この申請は既に処理済みです" });
        }

        const pointsToApprove = input.pointsApproved ?? request.pointsRequested;
        await approvePointRequest(input.requestId, ctx.user.id, pointsToApprove);

        // LINE通知を送信（ユーザーがLINEユーザーの場合）
        try {
          const lineUser = await getLineUserById(request.userId);
          if (lineUser?.lineUserId) {
            await pushMessage(lineUser.lineUserId, [
              {
                type: "text",
                text: `🎉 ポイント申請が承認されました！\n\n注文番号: ${request.orderNumber}\n承認ポイント: ${pointsToApprove}pt\n\nポイントが残高に加算されました。\nLCJ MALLでのお買い物にご利用いただけます。`,
              },
            ]);
          }
        } catch (notifyError) {
          console.error("[PointRequest] LINE通知エラー:", notifyError);
          // 通知失敗しても承認処理は成功とする
        }

        // Record review log for AI learning
        try {
          await createReceiptReviewLog({
            receiptType: "point_request",
            receiptId: input.requestId,
            decision: "approved",
            totalAmount: request.orderAmount ?? undefined,
            hasOrderNumber: request.orderNumber ? "yes" : "no",
            imageCount: request.deliveryImageUrl ? 2 : 1,
            pointsCalculated: request.pointsRequested ?? undefined,
            pointsAwarded: pointsToApprove,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record point request approval log:", logErr);
        }

        return { success: true, pointsApproved: pointsToApprove };
      }),

    // 申請を却下
    reject: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        reason: z.string().min(1, "却下理由を入力してください"),
        rejectionCategory: z.enum([
          "blurry_image", "missing_order_number", "missing_amount",
          "not_delivered", "duplicate", "wrong_store",
          "suspicious", "incomplete_info", "not_order_detail",
          "not_tiktok_shop", "partial_screenshot", "other",
        ]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }

        const request = await getPointRequestById(input.requestId);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
        }

        if (request.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "この申請は既に処理済みです" });
        }

        await rejectPointRequest(input.requestId, ctx.user.id, input.reason);

        // LINE通知を送信（ユーザーがLINEユーザーの場合）
        try {
          const lineUser = await getLineUserById(request.userId);
          if (lineUser?.lineUserId) {
            await pushMessage(lineUser.lineUserId, [
              {
                type: "text",
                text: `ポイント申請が承認されませんでした。\n\n注文番号: ${request.orderNumber}\n理由: ${input.reason}\n\n内容をご確認の上、再度申請いただくか、\nご不明な点があればお問い合わせください。`,
              },
            ]);
          }
        } catch (notifyError) {
          console.error("[PointRequest] LINE通知エラー:", notifyError);
          // 通知失敗しても却下処理は成功とする
        }

        // Record review log for AI learning
        try {
          await createReceiptReviewLog({
            receiptType: "point_request",
            receiptId: input.requestId,
            decision: "rejected",
            rejectionCategory: input.rejectionCategory ?? "other",
            rejectionNote: input.reason,
            totalAmount: request.orderAmount ?? undefined,
            hasOrderNumber: request.orderNumber ? "yes" : "no",
            imageCount: request.deliveryImageUrl ? 2 : 1,
            pointsCalculated: request.pointsRequested ?? undefined,
            reviewedBy: ctx.user.id,
          });
        } catch (logErr) {
          console.error("[ReviewLog] Failed to record point request rejection log:", logErr);
        }

        return { success: true };
      }),

    // 申請の詳細を取得
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const request = await getPointRequestById(input.id);
        if (!request) {
          throw new TRPCError({ code: "NOT_FOUND", message: "申請が見つかりません" });
        }

        // 自分の申請または管理者のみ閲覧可能
        if (request.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "この申請を閲覧する権限がありません" });
        }

        return request;
      }),
  }),

  // ===== 確変チャンス＋購入証明付きレビュー Router =====
  kakuhen: router({
    /**
     * 確変チャンスを実行（レシート申請時にTikTok URLを入力した場合）
     * 還元率1%→1.5%にブースト + 全額還元抽選
     */
    play: rateLimitedPublicProcedure
      .input(z.object({
        receiptType: z.enum(["point_request", "line_receipt"]),
        receiptId: z.number(),
        orderAmount: z.number().min(0),
        tiktokUrl: z.string().url().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const BASE_RATE = 1.0; // 基本還元率 1%
        const BOOSTED_RATE = 1.5; // 確変後 1.5%
        const JACKPOT_ODDS = 1000000; // 全額還元の確率 1/1,000,000
        const DAILY_LIMIT = 3; // 1日の確変チャンス回数制限

        // ===== 認証: 管理者cookie OR LINEセッション =====
        let userId: number | null = ctx.user?.id || null;
        let lineUserId: string | null = null;
        
        if (!userId) {
          // LINEセッションから認証を試みる
          const lineResult = await getLineUserFromSession(ctx);
          if (lineResult && lineResult.lineUser) {
            lineUserId = lineResult.lineUser.lineUserId || `email_${lineResult.lineUser.id}`;
            userId = lineResult.lineUser.id; // line_users.idを使用
          }
        }
        
        if (!userId && !lineUserId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }

        // ===== 制限チェック =====
        const { getDb } = await import("./db");
        const { sql: sqlTag, and, eq, gte, or } = await import("drizzle-orm");
        const { receiptKakuhenResults } = await import("../drizzle/schema");
        const dbInst = await getDb();
        if (!dbInst) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // 1. 1日3回制限チェック（userId OR lineUserIdで検索）
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const whereConditions = [];
        if (userId) whereConditions.push(eq(receiptKakuhenResults.userId, userId));
        if (lineUserId) whereConditions.push(eq(receiptKakuhenResults.lineUserId, lineUserId));
        
        const todayPlays = await dbInst
          .select({ count: sqlTag<number>`COUNT(*)` })
          .from(receiptKakuhenResults)
          .where(and(
            or(...whereConditions),
            gte(receiptKakuhenResults.createdAt, todayStart)
          ));
        const todayCount = todayPlays[0]?.count || 0;
        if (todayCount >= DAILY_LIMIT) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `本日の確変チャンスは${DAILY_LIMIT}回までです。明日またチャレンジしてください！（本日: ${todayCount}/${DAILY_LIMIT}回）`,
          });
        }

        // 2. 同一ユーザーのTikTokリンク重複チェック
        if (input.tiktokUrl && input.tiktokUrl.trim().length > 0) {
          const dupWhereConditions = [];
          if (userId) dupWhereConditions.push(eq(receiptKakuhenResults.userId, userId));
          if (lineUserId) dupWhereConditions.push(eq(receiptKakuhenResults.lineUserId, lineUserId));
          
          const duplicateUrl = await dbInst
            .select({ id: receiptKakuhenResults.id })
            .from(receiptKakuhenResults)
            .where(and(
              or(...dupWhereConditions),
              eq(receiptKakuhenResults.tiktokUrl, input.tiktokUrl.trim())
            ))
            .limit(1);
          if (duplicateUrl.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "このTikTok URLは既に使用済みです。別のURLを入力してください。",
            });
          }
        }

        // 3. DBから正確な金額を取得（OCRバックグラウンド処理対応）
        //    案A: DBポーリング（最大10秒待機）+ 案B: フォールバックOCR解析
        let orderAmount = input.orderAmount;
        if (input.receiptType === "line_receipt") {
          const { getLineReceiptById, updateLineReceiptOcr } = await import("./db");
          
          // === 案A: DBポーリング（OCRバックグラウンド処理完了を待つ）===
          let receipt = await getLineReceiptById(input.receiptId);
          if (receipt && (!receipt.totalAmount || Number(receipt.totalAmount) <= 0)) {
            // OCR未完了の場合、最大10秒間ポーリング（2秒間隔×5回）
            for (let retry = 0; retry < 5; retry++) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              receipt = await getLineReceiptById(input.receiptId);
              if (receipt && receipt.totalAmount && Number(receipt.totalAmount) > 0) {
                console.log(`[KakuhenPlay] DB polling success after ${(retry + 1) * 2}s, amount: ${receipt.totalAmount}`);
                break;
              }
            }
          }
          
          if (receipt && receipt.totalAmount && Number(receipt.totalAmount) > 0) {
            orderAmount = Number(receipt.totalAmount);
          } else if (receipt && orderAmount <= 0) {
            // === 案B: フォールバックOCR解析（DBにまだ金額がない場合）===
            console.log(`[KakuhenPlay] DB polling failed, falling back to OCR for receipt ${input.receiptId}`);
            try {
              const allImageUrls: string[] = [];
              if (receipt.imageUrls && Array.isArray(receipt.imageUrls)) {
                allImageUrls.push(...receipt.imageUrls);
              } else if (receipt.imageUrl) {
                allImageUrls.push(receipt.imageUrl);
              }
              
              if (allImageUrls.length > 0) {
                const imageContents: any[] = allImageUrls.map(url => ({
                  type: "image_url" as const,
                  image_url: { url, detail: "high" as const },
                }));
                imageContents.push({
                  type: "text" as const,
                  text: "この画像から合計金額（totalAmount）のみを数値で抽出してください。通貨記号やカンマは除去してください。JSON形式で {\"totalAmount\": 数値} のみ返してください。",
                });
                
                const ocrResult = await invokeLLM({
                  messages: [
                    { role: "system", content: "レシート画像から合計金額を抽出するAIです。JSONのみ返してください。" },
                    { role: "user", content: imageContents },
                  ],
                });
                
                const msgContent = ocrResult.choices[0].message.content as string;
                let jsonStr = msgContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (parsed.totalAmount && typeof parsed.totalAmount === "number" && parsed.totalAmount > 0) {
                    orderAmount = parsed.totalAmount;
                    console.log(`[KakuhenPlay] Fallback OCR success, amount: ${orderAmount}`);
                    // OCR結果をDBにも保存（次回以降のために）
                    try {
                      await updateLineReceiptOcr(input.receiptId, {
                        totalAmount: orderAmount,
                        pointsCalculated: Math.floor(orderAmount * 0.01),
                      });
                    } catch (saveErr) {
                      console.error("[KakuhenPlay] Failed to save fallback OCR result:", saveErr);
                    }
                  }
                }
              }
            } catch (ocrErr) {
              console.error("[KakuhenPlay] Fallback OCR failed:", ocrErr);
              // OCR失敗してもエラーにはせず、orderAmount=0のまま続行
            }
          }
        } else {
          // point_request の場合
          const { getPointRequestById } = await import("./db");
          const request = await getPointRequestById(input.receiptId);
          if (request && request.orderAmount && Number(request.orderAmount) > 0) {
            orderAmount = Number(request.orderAmount);
          }
        }

        // TikTok URLがある場合のみ確変チャンス発動
        const hasUrl = !!input.tiktokUrl && input.tiktokUrl.trim().length > 0;
        // 金額が0円の場合は確変モードを無効化（還元率UPなし）
        const isKakuhen = hasUrl && orderAmount > 0;
        const rate = isKakuhen ? BOOSTED_RATE : BASE_RATE;

        // 全額還元抽選（6桁のランダム番号）- 金額0円の場合は抽選しない
        const lotteryNumber = orderAmount > 0 ? String(Math.floor(Math.random() * 1000000)).padStart(6, "0") : "000000";
        const winningNumber = orderAmount > 0 ? String(Math.floor(Math.random() * 1000000)).padStart(6, "0") : "999999";
        const isJackpot = orderAmount > 0 && lotteryNumber === winningNumber;

        // ポイント計算
        const basePoints = Math.floor(orderAmount * (BASE_RATE / 100));
        let actualPoints: number;
        let bonusPoints: number;

        if (isJackpot) {
          // 全額還元！
          actualPoints = orderAmount;
          bonusPoints = orderAmount - basePoints;
        } else if (isKakuhen) {
          // 確変モード 1.5%
          actualPoints = Math.floor(orderAmount * (BOOSTED_RATE / 100));
          bonusPoints = actualPoints - basePoints;
        } else {
          // 通常 1%
          actualPoints = basePoints;
          bonusPoints = 0;
        }

        // DB保存
        const resultId = await createKakuhenResult({
          receiptType: input.receiptType,
          receiptId: input.receiptId,
          userId: userId,
          lineUserId: lineUserId,
          tiktokUrl: input.tiktokUrl,
          baseRate: String(BASE_RATE),
          boostedRate: String(rate),
          isKakuhen,
          lotteryNumber,
          winningNumber,
          isJackpot,
          orderAmount: orderAmount,
          basePoints,
          actualPoints,
          bonusPoints,
        });

        return {
          resultId,
          isKakuhen,
          isJackpot,
          baseRate: BASE_RATE,
          boostedRate: rate,
          lotteryNumber,
          winningNumber,
          basePoints,
          actualPoints,
          bonusPoints,
          orderAmount: orderAmount,
          dailyPlaysRemaining: DAILY_LIMIT - todayCount - 1,
        };
      }),

    /**
     * 確変チャンス結果を取得
     */
    getResult: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getKakuhenResultById(input.id);
      }),

    /**
     * 自分の確変チャンス履歴
     */
    myHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await getKakuhenResultsByUserId(ctx.user.id, input?.limit || 20);
      }),

    /**
     * ジャックポット当選者一覧（公開）
     */
    jackpotWinners: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getJackpotWinners(input?.limit || 10);
      }),

    /**
     * 確変チャンス統計（管理者用）
     */
    stats: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        return await getKakuhenAdminStats();
      }),

    /**
     * 確変チャンス全履歴（管理者用）
     * ユーザー名、TikTok URL、結果を含む詳細情報
     */
    allResults: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getAllKakuhenResultsWithDetails } = await import("./db");
        return await getAllKakuhenResultsWithDetails(input);
      }),

    /**
     * 確変参加率計算用：総レシート数を取得
     */
    totalReceiptsCount: protectedProcedure
      .query(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getDb } = await import("./db");
        const { sql: sqlTag } = await import("drizzle-orm");
        const { receipts: receiptsTable, lineReceipts: lineReceiptsTable } = await import("../drizzle/schema");
        const dbInst = await getDb();
        if (!dbInst) return { total: 0 };
        const [webCount] = await dbInst.select({ count: sqlTag<number>`COUNT(*)` }).from(receiptsTable);
        const [lineCount] = await dbInst.select({ count: sqlTag<number>`COUNT(*)` }).from(lineReceiptsTable);
        return { total: (webCount?.count || 0) + (lineCount?.count || 0) };
      }),
  }),

  // ===== 購入証明付きレビュー Router =====
  receiptReview: router({
    /**
     * レビューを投稿（レシート申請のフローの一部として）
     */
    submit: rateLimitedPublicProcedure
      .input(z.object({
        receiptType: z.enum(["point_request", "line_receipt"]),
        receiptId: z.number(),
        kakuhenResultId: z.number().optional(),
        productName: z.string().min(1),
        brandName: z.string().optional(),
        shopName: z.string().optional(),
        purchaseAmount: z.number().optional(),
        category: z.string().optional(),
        rating: z.number().min(1).max(5),
        reviewText: z.string().min(1),
        tags: z.array(z.string()).optional(),
        receiptImageUrl: z.string().optional(),
        tiktokUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 認証: 管理者cookie OR LINEセッション
        let userId: number | null = ctx.user?.id || null;
        let lineUserId: string | null = null;
        
        if (!userId) {
          // LINEセッションから認証を試みる
          const lineResult = await getLineUserFromSession(ctx);
          if (lineResult && lineResult.lineUser) {
            lineUserId = lineResult.lineUser.lineUserId || `email_${lineResult.lineUser.id}`;
            userId = lineResult.lineUser.id;
          }
        }
        
        if (!userId && !lineUserId) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }

        const reviewId = await createReceiptReview({
          receiptType: input.receiptType,
          receiptId: input.receiptId,
          kakuhenResultId: input.kakuhenResultId,
          userId: userId,
          lineUserId: lineUserId,
          productName: input.productName,
          brandName: input.brandName,
          shopName: input.shopName,
          purchaseAmount: input.purchaseAmount,
          category: input.category,
          rating: input.rating,
          reviewText: input.reviewText,
          tags: input.tags || [],
          receiptImageUrl: input.receiptImageUrl,
          tiktokUrl: input.tiktokUrl,
        });

        return { success: true, reviewId };
      }),

    /**
     * レビュー一覧（最新順、公開用）
     */
    latest: publicProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        const reviews = await getLatestReceiptReviews(input?.limit || 20, input?.offset || 0);
        const totalCount = await getReceiptReviewCount();
        return { reviews, totalCount };
      }),

    /**
     * 商品名で検索（product_masterの画像情報も返す）
     */
    search: publicProcedure
      .input(z.object({
        query: z.string().min(1),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const reviews = await searchReceiptReviewsByProduct(input.query, input.limit || 20);
        // product_masterから商品画像を取得
        const masterImage = await getProductMasterImageByName(input.query);
        return {
          reviews,
          masterImage, // { imageUrl, imageStatus, sourceUrl } or null
        };
      }),

    /**
     * 自分のレビュー一覧
     */
    myReviews: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return await getReceiptReviewsByUserId(ctx.user.id, input?.limit || 20);
      }),

    /**
     * レビュー詳細
     */
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const review = await getReceiptReviewById(input.id);
        if (!review || !review.isVisible) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レビューが見つかりません" });
        }
        return review;
      }),

    /**
     * 「参考になった」をインクリメント
     */
    helpful: publicProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ input }) => {
        await incrementReviewHelpful(input.reviewId);
        return { success: true };
      }),

    /**
     * レビューを通報
     */
    report: publicProcedure
      .input(z.object({ reviewId: z.number() }))
      .mutation(async ({ input }) => {
        await reportReceiptReview(input.reviewId);
        return { success: true };
      }),

    /**
     * レビュー統計（公開用）
     */
    stats: publicProcedure
      .query(async () => {
        return await getReceiptReviewStats();
      }),

    /**
     * 管理用レビュー一覧（ページネーション・ソート・検索対応）
     */
    adminSearch: protectedProcedure
      .input(z.object({
        query: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        sortBy: z.enum(["newest", "oldest", "highest", "lowest"]).default("newest"),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        return await getAdminReceiptReviews({
          query: input.query,
          page: input.page,
          limit: input.limit,
          sortBy: input.sortBy,
        });
      }),

    /**
     * 商品別レビューランキング（公開用）
     */
    productRanking: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getProductReviewRanking(input?.limit || 20);
      }),

    /**
     * 商品別レビューランキング拡張（商品画像・金額レンジ付き）
     */
    productRankingEnhanced: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getProductReviewRankingEnhanced(input?.limit || 20);
      }),

    /**
     * 動画フィード（動画URL付きレビュー）
     */
    videoFeed: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getVideoReviews(input?.limit || 10);
      }),

    /**
     * リアクション追加（私も買った！ / 欲しい！）
     */
    addReaction: publicProcedure
      .input(z.object({
        reviewId: z.number(),
        reactionType: z.enum(["bought", "want"]),
        lineUserId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await addReviewReaction({
          reviewId: input.reviewId,
          userId: ctx.user?.id || null,
          lineUserId: input.lineUserId || null,
          reactionType: input.reactionType,
        });
        return { success: true };
      }),

    /**
     * リアクション削除
     */
    removeReaction: publicProcedure
      .input(z.object({
        reviewId: z.number(),
        reactionType: z.enum(["bought", "want"]),
        lineUserId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await removeReviewReaction(
          input.reviewId,
          ctx.user?.id || null,
          input.lineUserId || null,
          input.reactionType
        );
        return { success: true };
      }),

    /**
     * レビュー一覧のリアクション数をバッチ取得
     */
    reactionCounts: publicProcedure
      .input(z.object({ reviewIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return await getReviewReactionCountsBatch(input.reviewIds);
      }),

    /**
     * ユーザーのリアクション状態を取得
     */
    userReactions: publicProcedure
      .input(z.object({
        reviewIds: z.array(z.number()),
        lineUserId: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return await getUserReactions(
          input.reviewIds,
          ctx.user?.id || null,
          input.lineUserId || null
        );
      }),

    /**
     * Q&A: 質問を投稿
     */
    askQuestion: publicProcedure
      .input(z.object({
        reviewId: z.number(),
        productName: z.string(),
        questionText: z.string().min(1),
        lineUserId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const questionId = await createReviewQuestion({
          reviewId: input.reviewId,
          productName: input.productName,
          userId: ctx.user?.id || null,
          lineUserId: input.lineUserId || null,
          questionText: input.questionText,
        });
        return { success: true, questionId };
      }),

    /**
     * Q&A: 質問に回答
     */
    answerQuestion: publicProcedure
      .input(z.object({
        questionId: z.number(),
        answerText: z.string().min(1),
        lineUserId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await answerReviewQuestion(
          input.questionId,
          ctx.user?.id || null,
          input.lineUserId || null,
          input.answerText
        );
        return { success: true };
      }),

    /**
     * Q&A: レビューのQ&A一覧
     */
    questions: publicProcedure
      .input(z.object({ reviewId: z.number() }))
      .query(async ({ input }) => {
        return await getReviewQuestions(input.reviewId);
      }),

    /**
     * Q&A: 最新の質問一覧
     */
    latestQuestions: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getLatestQuestions(input?.limit || 10);
      }),

    /**
     * レビュアー認証枚数をバッチ取得
     */
    reviewerCertifiedCounts: publicProcedure
      .input(z.object({
        userIds: z.array(z.number()),
        lineUserIds: z.array(z.string()),
      }))
      .query(async ({ input }) => {
        return await getReviewerCertifiedCounts(input.userIds, input.lineUserIds);
      }),

    /**
     * 購入プラットフォーム分布
     */
    platformDistribution: publicProcedure
      .query(async () => {
        return await getPlatformDistribution();
      }),

    /**
     * 商品別の累積写真ギャラリー
     */
    productImages: publicProcedure
      .input(z.object({
        productName: z.string().min(1),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getProductReviewImages(input.productName, input.limit || 50);
      }),

    /**
     * 「欲しい！」ランキング
     */
    wantRanking: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getWantRanking(input?.limit || 10);
      }),
  }),

  // ===== TikTok Commission Finance Router =====
  tiktokFinance: router({
    // CSVアップロード・解析
    uploadCsv: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        fileName: z.string(),
        csvContent: z.string(), // Base64 encoded CSV content
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Create import history record
        const importId = await createTiktokCsvImportHistory({
          brandId: input.brandId,
          fileName: input.fileName,
          uploadedBy: ctx.user.id,
          uploadedByName: ctx.user.name || ctx.user.email,
          status: "processing",
        });

        try {
          // 2. Decode CSV content with auto encoding detection
          const csvBuffer = Buffer.from(input.csvContent, "base64");
          let csvText: string;
          
          // Auto-detect encoding (TikTok CSVs may be Shift-JIS, UTF-8-BOM, or UTF-8)
          const detected = chardet.detect(csvBuffer);
          const encoding = detected || "utf-8";
          console.log(`[CSV Upload] Detected encoding: ${encoding}`);
          
          if (encoding.toLowerCase().includes("shift") || encoding.toLowerCase().includes("sjis") || encoding.toLowerCase() === "iso-2022-jp" || encoding.toLowerCase().includes("euc")) {
            csvText = iconv.decode(csvBuffer, "Shift_JIS");
          } else if (encoding.toLowerCase().includes("utf-16")) {
            csvText = iconv.decode(csvBuffer, encoding);
          } else {
            // UTF-8 (remove BOM if present)
            csvText = csvBuffer.toString("utf-8");
            if (csvText.charCodeAt(0) === 0xFEFF) {
              csvText = csvText.slice(1);
            }
          }
          
          // Normalize line endings
          csvText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          const lines = csvText.split("\n").filter(l => l.trim());
          
          if (lines.length < 2) {
            throw new Error("CSVファイルにデータがありません");
          }

          // 3. Parse header (trim BOM and whitespace from each header)
          const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
          console.log(`[CSV Upload] Parsed ${headers.length} headers. First 5: ${headers.slice(0, 5).join(', ')}`);
          
          // 4. Parse all rows
          const orders: any[] = [];
          const subOrderIds: string[] = [];
          let errorCount = 0;

          for (let i = 1; i < lines.length; i++) {
            try {
              const values = parseCSVLine(lines[i]);
              if (values.length < 10) continue; // Skip incomplete rows
              
              const row = mapHeadersToValues(headers, values);
              subOrderIds.push(String(row["サブ注文ID"] || ""));
              orders.push(row);
            } catch (e) {
              errorCount++;
            }
          }

          // 5. Check for duplicates
          const existingIds = await getExistingSubOrderIds(input.brandId, subOrderIds);
          const existingSet = new Set(existingIds);

          // 6. Filter out duplicates and prepare insert data
          const newOrders: any[] = [];
          let skippedCount = 0;

          for (let i = 0; i < orders.length; i++) {
            const subOrderId = subOrderIds[i];
            if (existingSet.has(subOrderId)) {
              skippedCount++;
              continue;
            }
            
            const row = orders[i];
            newOrders.push({
              brandId: input.brandId,
              importHistoryId: importId,
              orderId: String(row["注文ID"] || ""),
              subOrderId: String(row["サブ注文ID"] || ""),
              orderStatus: row["注文状況"] || null,
              creatorUsername: row["クリエイターのユーザー名"] || "",
              productName: row["商品名"] || "",
              sku: row["SKU"] || null,
              productId: String(row["商品ID"] || ""),
              price: parseIntSafe(row["価格"]),
              quantity: parseIntSafe(row["数量"]) || 1,
              shopName: row["ショップ名"] || null,
              shopCode: row["ショップコード"] || null,
              contentType: row["コンテンツタイプ"] || null,
              contentId: String(row["コンテンツID"] || ""),
              partnerCommissionRate: parseFloatSafe(row["アフィリエイトパートナー成果報酬率"]) !== null ? String(parseFloatSafe(row["アフィリエイトパートナー成果報酬率"])) : null,
              creatorCommissionRate: parseFloatSafe(row["クリエイター成果報酬率"]) !== null ? String(parseFloatSafe(row["クリエイター成果報酬率"])) : null,
              partnerRewardRate: parseIntSafe(row["パートナー成果報酬リワード率"]),
              creatorRewardRate: parseIntSafe(row["クリエイターの手数料リワード率"]),
              partnerShopAdRate: parseIntSafe(row["アフィリエイトパートナーのショップ広告成果報酬率"]),
              creatorShopAdRate: parseIntSafe(row["クリエイターのショップ広告成果報酬率"]),
              estimatedCommissionBase: parseIntSafe(row["推定成果報酬ベース"]),
              estimatedPartnerCommission: parseFloatSafe(row["推定アフィリエイトパートナー手数料額"]) !== null ? String(parseFloatSafe(row["推定アフィリエイトパートナー手数料額"])) : null,
              estimatedCreatorCommission: parseFloatSafe(row["推定クリエイター手数料額"]) !== null ? String(parseFloatSafe(row["推定クリエイター手数料額"])) : null,
              estimatedPartnerReward: parseIntSafe(row["パートナーの推定成果報酬リワード料"]),
              estimatedCreatorReward: parseIntSafe(row["クリエイターの推定成果報酬リワード料"]),
              estimatedCreatorShopAdPay: parseIntSafe(row["クリエイターのショップ広告成果報酬支払額（推定）"]),
              estimatedPartnerShopAdPay: parseIntSafe(row["アフィリエイトパートナーのショップ広告成果報酬支払額（推定）"]),
              actualCommissionBase: parseFloatSafe(row["実際の手数料ベース"]) !== null ? String(parseFloatSafe(row["実際の手数料ベース"])) : null,
              actualPartnerCommission: parseFloatSafe(row["実際のアフィリエイトパートナー手数料額"]) !== null ? String(parseFloatSafe(row["実際のアフィリエイトパートナー手数料額"])) : null,
              actualCreatorCommission: parseFloatSafe(row["クリエイターの実際の手数料額"]) !== null ? String(parseFloatSafe(row["クリエイターの実際の手数料額"])) : null,
              actualPartnerReward: parseFloatSafe(row["パートナーの実際の手数料リワード料"]) !== null ? String(parseFloatSafe(row["パートナーの実際の手数料リワード料"])) : null,
              actualCreatorReward: parseFloatSafe(row["クリエイターの実際の手数料リワード料"]) !== null ? String(parseFloatSafe(row["クリエイターの実際の手数料リワード料"])) : null,
              actualPartnerShopAdPay: parseFloatSafe(row["アフィリエイトパートナーのショップ広告成果報酬支払額（実際）"]) !== null ? String(parseFloatSafe(row["アフィリエイトパートナーのショップ広告成果報酬支払額（実際）"])) : null,
              actualCreatorShopAdPay: parseFloatSafe(row["クリエイターのショップ広告成果報酬支払額（実際）"]) !== null ? String(parseFloatSafe(row["クリエイターのショップ広告成果報酬支払額（実際）"])) : null,
              returnQuantity: parseIntSafe(row["返品される商品の数量"]) || 0,
              refundQuantity: parseIntSafe(row["返金される商品の数量"]) || 0,
              orderCreatedAt: parseDateDDMMYYYY(row["作成日時"]),
              orderDeliveredAt: parseDateDDMMYYYY(row["注文配達日時"]),
              commissionSettledAt: parseDateDDMMYYYY(row["手数料決済日時"]),
              paymentId: String(row["支払いID"] || ""),
              paymentMethod: row["支払い方法"] || null,
              paymentAccount: row["支払い口座"] || null,
              iva: parseIntSafe(row["IVA"]) || 0,
              isr: parseIntSafe(row["ISR"]) || 0,
              platform: row["プラットフォーム"] || null,
              factorType: row["要因のタイプ"] || null,
            });
          }

          // 7. Bulk insert
          let insertedCount = 0;
          if (newOrders.length > 0) {
            insertedCount = await bulkInsertTiktokOrders(newOrders);
          }

          // 8. Calculate summary
          let totalSales = 0;
          let totalPartnerComm = 0;
          let totalCreatorComm = 0;
          let minDate: Date | null = null;
          let maxDate: Date | null = null;

          for (const o of newOrders) {
            totalSales += o.price || 0;
            totalPartnerComm += parseFloat(o.actualPartnerCommission || "0");
            totalCreatorComm += parseFloat(o.actualCreatorCommission || "0");
            if (o.orderCreatedAt) {
              if (!minDate || o.orderCreatedAt < minDate) minDate = o.orderCreatedAt;
              if (!maxDate || o.orderCreatedAt > maxDate) maxDate = o.orderCreatedAt;
            }
          }

          // 9. Update import history
          await updateTiktokCsvImportHistory(importId, {
            totalRows: orders.length,
            importedRows: insertedCount,
            skippedRows: skippedCount,
            errorRows: errorCount,
            totalSales: Math.round(totalSales),
            totalPartnerCommission: Math.round(totalPartnerComm),
            totalCreatorCommission: Math.round(totalCreatorComm),
            dateRangeStart: minDate,
            dateRangeEnd: maxDate,
            status: "completed",
          });

          return {
            importId,
            totalRows: orders.length,
            importedRows: insertedCount,
            skippedRows: skippedCount,
            errorRows: errorCount,
          };
        } catch (error: any) {
          await updateTiktokCsvImportHistory(importId, {
            status: "failed",
            errorMessage: error.message || "Unknown error",
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `CSVインポートに失敗しました: ${error.message}`,
          });
        }
      }),

    // インポート履歴取得
    getImportHistory: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokCsvImportHistoryByBrand(input.brandId);
      }),

    // インポート削除（関連注文も削除）
    deleteImport: protectedProcedure
      .input(z.object({ importId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTiktokOrdersByImportId(input.importId);
        await deleteTiktokImportHistory(input.importId);
        return { success: true };
      }),

    // 全体サマリー（brandId=0で全ブランド横断、month指定で月別フィルタ）
    getSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokFinanceSummary(input.brandId, input.month);
      }),

    // クリエイター別サマリー
    getCreatorSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokCreatorSummary(input.brandId, input.month);
      }),

    // ショップ別サマリー
    getShopSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokShopSummary(input.brandId, input.month);
      }),

    // 商品別サマリー
    getProductSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokProductSummary(input.brandId, input.month);
      }),

    // 商品別クリエイター内訳
    getProductCreatorBreakdown: protectedProcedure
      .input(z.object({ productName: z.string(), brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokProductCreatorBreakdown(input.productName, input.brandId, input.month);
      }),

    // 日別推移
    getDailySummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokDailySummary(input.brandId, input.month);
      }),

    // コンテンツタイプ別
    getContentTypeSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokContentTypeSummary(input.brandId, input.month);
      }),

    // 月別推移サマリー
    getMonthlySummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokMonthlySummary(input.brandId);
      }),

    // 注文明細一覧（ページネーション付き）
    getOrders: protectedProcedure
      .input(z.object({
        brandId: z.number().optional().default(0),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        search: z.string().optional(),
        creatorUsername: z.string().optional(),
        shopName: z.string().optional(),
        contentType: z.string().optional(),
        orderStatus: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return getTiktokOrdersByBrand(input.brandId, {
          limit: input.limit,
          offset: input.offset,
          search: input.search,
          creatorUsername: input.creatorUsername,
          shopName: input.shopName,
          contentType: input.contentType,
          orderStatus: input.orderStatus,
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
        });
      }),
    // 入金CSVアップロード
    uploadPaymentCsv: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        csvContent: z.string(), // Base64 encoded CSV content
        importMonth: z.string().optional(), // YYYY-MM
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // 1. Decode CSV
          const csvBuffer = Buffer.from(input.csvContent, "base64");
          let csvText = csvBuffer.toString("utf-8");
          if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.slice(1);
          }
          csvText = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
          // Clean tab characters that TikTok sometimes inserts between fields
          csvText = csvText.replace(/\t,/g, ",").replace(/,\t/g, ",").replace(/\t/g, "");
          const lines = csvText.split("\n").filter(l => l.trim());
          
          if (lines.length < 2) {
            throw new Error("入金CSVにデータがありません");
          }

          // 2. Parse header
          const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
          
          // 3. Parse rows
          const payments: any[] = [];
          const referenceIds: string[] = [];
          
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length < 2) continue;
            const row = mapHeadersToValues(headers, values);
            
            const refId = String(row["Reference ID"] || "").trim();
            if (!refId) continue;
            referenceIds.push(refId);
            
            // Parse payment time (format: "2026-01-16 11:24:07 AM")
            let paymentTime: Date | null = null;
            const timeStr = String(row["Payment Time(Timezone=UTC)"] || "").trim();
            if (timeStr) {
              try {
                // Handle AM/PM format
                const cleaned = timeStr.replace(/ AM$/i, " AM").replace(/ PM$/i, " PM");
                paymentTime = new Date(cleaned);
                if (isNaN(paymentTime.getTime())) paymentTime = null;
              } catch { paymentTime = null; }
            }
            
            payments.push({
              brandId: input.brandId,
              referenceId: refId,
              paymentTime,
              settlementAmount: parseIntSafe(row["Settlement Amount"]) || 0,
              settlementCurrency: row["Settlement Currency"] || "JPY",
              exchangeRate: String(parseFloatSafe(row["Exchange Rate"]) || 1),
              paymentAmount: parseIntSafe(row["Payment Amount"]) || 0,
              paymentCurrency: row["Payment Currency"] || "JPY",
              importMonth: input.importMonth || (paymentTime ? `${paymentTime.getFullYear()}-${String(paymentTime.getMonth() + 1).padStart(2, '0')}` : null),
              uploadedBy: ctx.user.id,
              uploadedByName: ctx.user.name || ctx.user.email,
            });
          }

          // 4. Check duplicates
          const existingIds = await getExistingPaymentReferenceIds(referenceIds);
          const existingSet = new Set(existingIds);
          const newPayments = payments.filter(p => !existingSet.has(p.referenceId));
          
          // 5. Insert
          let insertedCount = 0;
          if (newPayments.length > 0) {
            insertedCount = await insertTiktokPayments(newPayments);
          }
          
          return {
            totalRows: payments.length,
            importedRows: insertedCount,
            skippedRows: payments.length - insertedCount,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `入金CSVインポートに失敗しました: ${error.message}`,
          });
        }
      }),

    // 入金データサマリー
    getPaymentSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokPaymentsSummary(input.brandId);
      }),

    // 入金データ月別
    getPaymentsByMonth: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokPaymentsByMonth(input.brandId);
      }),

    // 入金データ一覧
    getPaymentsList: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokPaymentsList(input.brandId);
      }),

    // 入金データ削除
    deletePayment: protectedProcedure
      .input(z.object({ paymentId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteTiktokPayment(input.paymentId);
        return { success: true };
      }),

    // === TAP (TikTok Affiliate Program) ===
    
    // TAP XLSXアップロード
    uploadTapXlsx: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        fileContent: z.string(), // Base64 encoded XLSX content
        reportMonth: z.string(), // YYYY-MM
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const XLSX = await import('xlsx');
          const buffer = Buffer.from(input.fileContent, 'base64');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          
          if (rows.length === 0) {
            throw new Error('TAPデータが空です');
          }
          
          // Helper: parse Japanese yen formatted numbers (e.g., "6,659,954円" → 6659954)
          const parseNum = (val: any): number => {
            if (val === '' || val === null || val === undefined) return 0;
            if (typeof val === 'number') return Math.round(val);
            const str = String(val).replace(/[¥,$%円,]/g, '').trim();
            const num = parseFloat(str);
            return isNaN(num) ? 0 : Math.round(num);
          };
          
          // Parse rows into TAP reports
          const reports: any[] = [];
          for (const row of rows) {
            // Skip summary row (日付 = "概要")
            const dateVal = String(row['日付'] || row['Date'] || '').trim();
            if (dateVal === '概要' || dateVal === 'Summary' || dateVal === '') continue;
            
            // Support both Japanese and English headers
            const creatorUsername = String(row['クリエイター名'] || row['Creator username'] || row['Creator name'] || '').trim();
            const productName = String(row['商品名'] || row['Product name'] || '').trim();
            const shopName = String(row['ショップ名'] || row['Shop name'] || '').trim();
            const productId = String(row['商品ID'] || row['Product ID'] || '').trim();
            const shopId = String(row['ショップID'] || row['Shop ID'] || '').trim();
            
            if (!creatorUsername && !productName) continue;
            
            reports.push({
              brandId: input.brandId,
              reportMonth: input.reportMonth,
              dateRange: dateVal, // e.g., "2025-10-01-2025-10-31"
              creatorUsername,
              productId,
              productName,
              shopId,
              shopName,
              affiliateGmv: parseNum(row['アフィリエイトGMV'] || row['Affiliate GMV']),
              videoGmv: parseNum(row['アフィリエイト動画GMV'] || row['Video GMV']),
              liveGmv: parseNum(row['アフィリエイトLIVE GMV'] || row['LIVE GMV']),
              gmvRefund: parseNum(row['GMV（返金）'] || row['GMV refund']),
              settledGmv: parseNum(row['決済済みGMV'] || row['Settled GMV']),
              showcaseRevenue: parseNum(row['収益（ショーケース）'] || row['Showcase revenue']),
              linkGmv: parseNum(row['リンクGMV'] || row['Link GMV']),
              orders: parseNum(row['注文'] || row['Orders']),
              salesCount: parseNum(row['販売数'] || row['Sales count']),
              videoViews: parseNum(row['動画視聴数'] || row['Video views']),
              liveViews: parseNum(row['LIVE視聴数'] || row['LIVE views']),
              liveCount: parseNum(row['LIVE'] || row['LIVE count']),
              videoCount: parseNum(row['動画'] || row['Video count']),
              showcaseProducts: parseNum(row['ショーケースに追加した商品'] || row['Showcase products']),
              estimatedPartnerCommission: parseNum(row['推定アフィリエイトパートナー手数料額'] || row['Estimated partner commission']),
              actualPartnerCommission: parseNum(row['実際のアフィリエイトパートナー手数料額'] || row['Actual partner commission']),
              estimatedCreatorCommission: parseNum(row['クリエイターの推定成果報酬額'] || row['Estimated creator commission']),
              actualCreatorCommission: parseNum(row['クリエイターの実際の手数料額'] || row['Actual creator commission']),
              linkSalesCount: parseNum(row['リンクでの商品販売数'] || row['Link sales count']),
              linkOrders: parseNum(row['リンク注文数'] || row['Link orders']),
              linkEstimatedPartnerCommission: parseNum(row['リンクパートナーの推定成果報酬額'] || row['Link estimated partner commission']),
              linkEstimatedCreatorCommission: parseNum(row['リンククリエイターの推定成果報酬額'] || row['Link estimated creator commission']),
            });
          }
          
          // Delete existing data for this month and re-import
          await deleteTiktokTapReportsByMonth(input.brandId, input.reportMonth);
          const insertedCount = await bulkInsertTiktokTapReports(reports);
          
          return {
            totalRows: reports.length,
            importedRows: insertedCount,
            reportMonth: input.reportMonth,
          };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `TAPデータインポートに失敗しました: ${error.message}`,
          });
        }
      }),

    // TAPサマリー
    getTapSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapSummary(input.brandId, input.month);
      }),

    // TAPクリエイター別
    getTapCreatorSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapCreatorSummary(input.brandId, input.month);
      }),

    // TAPショップ別
    getTapShopSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapShopSummary(input.brandId, input.month);
      }),

    // TAP月別推移
    getTapMonthlySummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokTapMonthlySummary(input.brandId);
      }),

    // TAP商品別
    getTapProductSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapProductSummary(input.brandId, input.month);
      }),

    // TAP利用可能月一覧
    getTapAvailableMonths: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokTapAvailableMonths(input.brandId);
      }),

    // TAP月別データ削除
    deleteTapMonth: protectedProcedure
      .input(z.object({ brandId: z.number(), reportMonth: z.string() }))
      .mutation(async ({ input }) => {
        await deleteTiktokTapReportsByMonth(input.brandId, input.reportMonth);
        return { success: true };
      }),

    // === TAP Live Report エンドポイント ===
    getTapLiveSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapLiveSummary(input.brandId, input.month);
      }),

    getTapLiveCreatorSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapLiveCreatorSummary(input.brandId, input.month);
      }),

    getTapLiveMonthlySummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokTapLiveMonthlySummary(input.brandId);
      }),

    getTapLiveTopSessions: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional(), limit: z.number().optional().default(20) }))
      .query(async ({ input }) => {
        return getTiktokTapLiveTopSessions(input.brandId, input.month, input.limit);
      }),

    // === TAP Video Report エンドポイント ===
    getTapVideoSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapVideoSummary(input.brandId, input.month);
      }),

    getTapVideoCreatorSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapVideoCreatorSummary(input.brandId, input.month);
      }),

    getTapVideoMonthlySummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getTiktokTapVideoMonthlySummary(input.brandId);
      }),

    getTapVideoTopVideos: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional(), limit: z.number().optional().default(20) }))
      .query(async ({ input }) => {
        return getTiktokTapVideoTopVideos(input.brandId, input.month, input.limit);
      }),

    // === ファイナンス司令塔 エンドポイント ===

    // クリエイター×商品ベストマッチ分析
    getTapCreatorProductMatrix: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapCreatorProductMatrix(input.brandId, input.month);
      }),

    // LIVE配信効率分析
    getTapLiveEfficiency: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapLiveEfficiency(input.brandId, input.month);
      }),

    // ライバー収益分析: クリエイター別純利益ランキング
    getTapCreatorProfitability: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapCreatorProfitability(input.brandId, input.month);
      }),

    // ライバー収益分析: クリエイター別 商品内訳ドリルダウン
    getTapCreatorProductBreakdown: protectedProcedure
      .input(z.object({ creatorUsername: z.string(), brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapCreatorProductBreakdown(input.creatorUsername, input.brandId, input.month);
      }),

    // 商品利益率ランキング: 商品別 ライバー内訳ドリルダウン
    getTapProductCreatorBreakdown: protectedProcedure
      .input(z.object({ productName: z.string(), brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getTiktokTapProductCreatorBreakdown(input.productName, input.brandId, input.month);
      }),

    // =============================================
    // CAP (Creator Affiliate Program) Endpoints
    // =============================================

    // CAPデータアップロード（Creator単位）
    uploadCapCreatorXlsx: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        fileContent: z.string(), // Base64 encoded XLSX
        reportMonth: z.string(), // YYYY-MM
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const XLSX = await import('xlsx');
          const buffer = Buffer.from(input.fileContent, 'base64');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (rows.length === 0) throw new Error('CAPデータが空です');

          const parseNum = (val: any): number => {
            if (val === '' || val === null || val === undefined) return 0;
            if (typeof val === 'number') return Math.round(val);
            const str = String(val).replace(/[¥,$%円,]/g, '').trim();
            const num = parseFloat(str);
            return isNaN(num) ? 0 : Math.round(num);
          };

          const reports: any[] = [];
          for (const row of rows) {
            const dateVal = String(row['日付'] || '').trim();
            if (dateVal === '概要' || dateVal === '' || dateVal === 'Summary') continue;

            const creatorUsername = String(row['クリエイターのユーザー名'] || row['Creator username'] || '').trim();
            if (!creatorUsername) continue;

            reports.push({
              brandId: input.brandId,
              reportMonth: input.reportMonth,
              dateRange: dateVal,
              creatorUsername,
              affiliateGmv: parseNum(row['アフィリエイトGMV']),
              affiliateLiveGmv: parseNum(row['アフィリエイトLIVE GMV']),
              affiliateVideoGmv: parseNum(row['アフィリエイト動画GMV']),
              directGmv: parseNum(row['ダイレクトGMV']),
              liveDirectGmv: parseNum(row['LIVEダイレクトGMV']),
              videoDirectGmv: parseNum(row['動画ダイレクトGMV']),
              affiliateOrders: parseNum(row['アフィリエイト注文数']),
              affiliateLiveOrders: parseNum(row['アフィリエイトLIVE注文']),
              affiliateVideoOrders: parseNum(row['アフィリエイト動画注文']),
              directOrders: parseNum(row['直接注文']),
              liveDirectOrders: parseNum(row['LIVE直接注文']),
              videoDirectOrders: parseNum(row['動画直接注文']),
              salesCount: parseNum(row['販売数'] || row['商品販売数']),
              estimatedCommission: parseNum(row['推定成果報酬額']),
              commissionBase: parseNum(row['手数料ベース']),
              liveViews: parseNum(row['LIVE視聴数']),
              videoViews: parseNum(row['視聴数']),
              liveCount: parseNum(row['LIVE']),
              videoCount: parseNum(row['動画']),
              liveCtr: String(row['LIVE CTR'] || ''),
              videoCtr: String(row['動画CTR'] || ''),
            });
          }

          await deleteCapCreatorReportsByMonth(input.brandId, input.reportMonth);
          await bulkInsertCapCreatorReports(reports);

          return { totalRows: reports.length, importedRows: reports.length, reportMonth: input.reportMonth };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `CAPクリエイターデータインポートに失敗: ${error.message}`,
          });
        }
      }),

    // CAPデータアップロード（Product×Shop単位）
    uploadCapProductXlsx: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        fileContent: z.string(), // Base64 encoded XLSX
        reportMonth: z.string(), // YYYY-MM
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const XLSX = await import('xlsx');
          const buffer = Buffer.from(input.fileContent, 'base64');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (rows.length === 0) throw new Error('CAPデータが空です');

          const parseNum = (val: any): number => {
            if (val === '' || val === null || val === undefined) return 0;
            if (typeof val === 'number') return Math.round(val);
            const str = String(val).replace(/[¥,$%円,]/g, '').trim();
            const num = parseFloat(str);
            return isNaN(num) ? 0 : Math.round(num);
          };

          const reports: any[] = [];
          for (const row of rows) {
            const dateVal = String(row['日付'] || '').trim();
            if (dateVal === '概要' || dateVal === '' || dateVal === 'Summary') continue;

            const creatorUsername = String(row['クリエイターのユーザー名'] || row['Creator username'] || '').trim();
            const productId = String(row['商品ID'] || row['Product ID'] || '').trim();
            const productName = String(row['商品情報'] || row['Product name'] || '').trim();
            if (!creatorUsername || !productId) continue;

            reports.push({
              brandId: input.brandId,
              reportMonth: input.reportMonth,
              dateRange: dateVal,
              creatorUsername,
              productId,
              productName,
              shopId: String(row['ショップID'] || '').trim(),
              shopName: String(row['ショップ名'] || '').trim(),
              affiliateGmv: parseNum(row['アフィリエイトGMV']),
              affiliateLiveGmv: parseNum(row['アフィリエイトLIVE GMV']),
              affiliateVideoGmv: parseNum(row['アフィリエイト動画GMV']),
              directGmv: parseNum(row['ダイレクトGMV']),
              liveDirectGmv: parseNum(row['LIVEダイレクトGMV']),
              videoDirectGmv: parseNum(row['動画ダイレクトGMV']),
              productCardDirectGmv: parseNum(row['商品カードダイレクトGMV']),
              affiliateOrders: parseNum(row['アフィリエイト注文数']),
              affiliateLiveOrders: parseNum(row['アフィリエイトLIVE注文']),
              affiliateVideoOrders: parseNum(row['アフィリエイト動画注文']),
              directOrders: parseNum(row['直接注文']),
              liveDirectOrders: parseNum(row['LIVE直接注文']),
              videoDirectOrders: parseNum(row['動画直接注文']),
              productCardOrders: parseNum(row['商品カードからの注文数']),
              salesCount: parseNum(row['販売数']),
              liveSalesCount: parseNum(row['LIVEからの商品販売数']),
              videoSalesCount: parseNum(row['動画からの商品販売数']),
              productCardSalesCount: parseNum(row['商品カードでの商品販売数']),
              directRefundGmv: parseNum(row['直接返金GMV']),
              refundedItems: parseNum(row['返金されたアイテム']),
              ctr: String(row['CTR'] || ''),
              ctor: String(row['CTOR'] || ''),
            });
          }

          await deleteCapProductReportsByMonth(input.brandId, input.reportMonth);
          await bulkInsertCapProductReports(reports);

          return { totalRows: reports.length, importedRows: reports.length, reportMonth: input.reportMonth };
        } catch (error: any) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `CAP商品データインポートに失敗: ${error.message}`,
          });
        }
      }),

    // CAPクリエイター別サマリー
    getCapCreatorSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getCapCreatorSummary(input.brandId, input.month);
      }),

    // CAP商品別サマリー
    getCapProductSummary: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getCapProductSummary(input.brandId, input.month);
      }),

    // CAPライバー別商品内訳
    getCapCreatorProductBreakdown: protectedProcedure
      .input(z.object({ creatorUsername: z.string(), brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getCapCreatorProductBreakdown(input.creatorUsername, input.brandId, input.month);
      }),

    // CAP商品別ライバー内訳
    getCapProductCreatorBreakdown: protectedProcedure
      .input(z.object({ productName: z.string(), brandId: z.number().optional().default(0), month: z.string().optional() }))
      .query(async ({ input }) => {
        return getCapProductCreatorBreakdown(input.productName, input.brandId, input.month);
      }),

    // CAP利用可能月一覧
    getCapAvailableMonths: protectedProcedure
      .input(z.object({ brandId: z.number().optional().default(0) }))
      .query(async ({ input }) => {
        return getCapAvailableMonths(input.brandId);
      }),

    // CAP契約比率一覧取得（全ライバーのcapEnabled, capLcjRate, capCreatorRate）
    // CAPデータ（CSV）が存在するライバーは自動的にcapEnabled=trueとして返す
    getCapRates: protectedProcedure
      .query(async () => {
        const allLivers = await getAllActiveLivers();
        
        // tiktok_cap_creator_reportsからユニークなcreatorUsernameを取得
        const db = await getDb();
        let capUsernames: string[] = [];
        if (db) {
          const capCreators = await db
            .selectDistinct({ username: tiktokCapCreatorReports.creatorUsername })
            .from(tiktokCapCreatorReports);
          capUsernames = capCreators.map((c: any) => 
            (c.username || '').toLowerCase().replace(/@/g, '').replace(/\s/g, '').trim()
          ).filter(Boolean);
        }
        
        return allLivers.map((l: any) => {
          // tiktokAccountとcreatorUsernameを突合してCAP契約を自動判定
          let tiktok = (l.tiktokAccount || '').toLowerCase().replace(/@/g, '').replace(/\s/g, '').trim();
          // URL形式の場合、ユーザー名部分を抽出
          if (tiktok.includes('tiktok.com/')) {
            const parts = tiktok.split('tiktok.com/');
            tiktok = (parts[parts.length - 1] || '').split('?')[0].replace(/@/g, '').trim();
          }
          
          // 1. tiktokAccountベースの突合
          const hasCapByTiktok = tiktok && capUsernames.some(cu => 
            cu === tiktok || tiktok.includes(cu) || cu.includes(tiktok)
          );
          
          // 2. 名前ベースの突合（tiktokAccountが未設定または一致しない場合）
          const liverName = (l.name || '').toLowerCase().replace(/\s/g, '').trim();
          const hasCapByName = !hasCapByTiktok && liverName && liverName.length >= 2 && capUsernames.some(cu => {
            // ライバー名がCAPユーザー名に含まれる、またはその逆
            return cu.includes(liverName) || liverName.includes(cu);
          });
          
          const hasCapData = hasCapByTiktok || hasCapByName;
          
          return {
            id: l.id,
            name: l.name,
            tiktokAccount: l.tiktokAccount,
            capEnabled: hasCapData || (l.capEnabled ?? false),
            capLcjRate: l.capLcjRate ? parseFloat(l.capLcjRate) : 0,
            capCreatorRate: l.capCreatorRate ? parseFloat(l.capCreatorRate) : 100,
          };
        });
      }),

    // CAP契約比率更新
    updateCapRate: protectedProcedure
      .input(z.object({
        liverId: z.number(),
        capEnabled: z.boolean(),
        capLcjRate: z.number().min(0).max(100),
        capCreatorRate: z.number().min(0).max(100),
      }))
      .mutation(async ({ input }) => {
        await updateLiver(input.liverId, {
          capEnabled: input.capEnabled,
          capLcjRate: String(input.capLcjRate),
          capCreatorRate: String(input.capCreatorRate),
        } as any);
        return { success: true };
      }),
  }),

  // セット組み管理
  livestreamSets: router({
    bulkCreate: publicProcedure
      .input(z.object({
        livestreamId: z.number(),
        sets: z.array(z.object({
          setName: z.string().min(1),
          setPrice: z.number().min(0),
          quantitySold: z.number().min(1),
          items: z.array(z.object({
            productName: z.string().min(1),
            originalPrice: z.number().min(0),
            quantity: z.number().min(1).default(1),
          })).min(1),
        })),
      }))
      .mutation(async ({ input }) => {
        // Delete existing sets for this livestream first
        await deleteLivestreamSetsByLivestreamId(input.livestreamId);
        
        // Create new sets
        for (let i = 0; i < input.sets.length; i++) {
          const set = input.sets[i];
          const totalOriginalPrice = set.items.reduce((sum, item) => sum + item.originalPrice * (item.quantity || 1), 0);
          const discountRate = totalOriginalPrice > 0
            ? Math.round(((totalOriginalPrice - set.setPrice) / totalOriginalPrice) * 100)
            : 0;
          const totalRevenue = set.setPrice * set.quantitySold;
          
          const setResult = await createLivestreamSet({
            livestreamId: input.livestreamId,
            setName: set.setName,
            setPrice: set.setPrice,
            quantitySold: set.quantitySold,
            totalOriginalPrice,
            discountRate,
            totalRevenue,
            sortOrder: i,
          });
          
          const setId = (setResult as any)[0]?.insertId;
          if (setId) {
            for (let j = 0; j < set.items.length; j++) {
              await createLivestreamSetItem({
                setId,
                productName: set.items[j].productName,
                originalPrice: set.items[j].originalPrice,
                quantity: set.items[j].quantity || 1,
                sortOrder: j,
              });
            }
          }
        }
        
        return { success: true };
      }),

    listByLivestream: publicProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamSetsByLivestreamId(input.livestreamId);
      }),

    deleteAllByLivestream: publicProcedure
      .input(z.object({ livestreamId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteLivestreamSetsByLivestreamId(input.livestreamId);
        return { success: true };
      }),

    // セット分析: 全ライバーのセット活用状況（ライバー司令塔一覧用）
    allLiversSetAnalysis: publicProcedure
      .query(async () => {
        return await getAllLiversSetAnalysis();
      }),

    // セット検索: キーワードでセットを検索
    search: publicProcedure
      .input(z.object({ keyword: z.string().min(1) }))
      .query(async ({ input }) => {
        return await searchSets(input.keyword);
      }),

    // セット分析: 特定ライバーのセット戦略詳細（ライバー個別ページ用）
    liverSetAnalysis: publicProcedure
      .input(z.object({ liverId: z.number() }))
      .query(async ({ input }) => {
        return await getLiverSetAnalysis(input.liverId);
      }),

    // AIセット提案: ライバーの過去データを分析して次のセットを提案
    aiSetSuggestion: rateLimitedPublicProcedure
      .input(z.object({
        liverId: z.number(),
        liverName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // ライバーのセットデータを取得
        const setData = await getLiverSetAnalysis(input.liverId);
        
        if (!setData.sets || setData.sets.length === 0) {
          return {
            suggestion: "まだセットデータがありません。最初のセットを作成してください。",
            analyzedSets: 0,
          };
        }

        // セットデータを分析用に整形
        const setsContext = setData.sets.map(s => {
          const date = s.livestreamDate ? new Date(s.livestreamDate).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' }) : '不明';
          const items = s.items.map((item: any) => {
            const qty = item.quantity || 1;
            return `${item.productName}${qty > 1 ? `×${qty}` : ''}(¥${Number(item.originalPrice).toLocaleString()})`;
          }).join(', ');
          return `${date} 「${s.setName}」 売値:¥${Number(s.setPrice || 0).toLocaleString()} 販売数:${s.quantitySold || 0} セット売上:¥${Number(s.totalRevenue || 0).toLocaleString()} 割引率:${Math.round(Number(s.discountRate || 0))}%OFF 商品:[${items}]`;
        }).join('\n');

        // トップ商品データ
        const topProductsContext = setData.topProducts.map((p, i) => 
          `${i + 1}. ${p.productName} (登場${p.count}回, 累計売上:¥${Number(p.totalRevenue).toLocaleString()})`
        ).join('\n');

        // 季節・時期のコンテキスト
        const now = new Date();
        const month = now.getMonth() + 1;
        const seasonContext = month >= 3 && month <= 5 ? '春（紫外線対策、新生活）'
          : month >= 6 && month <= 8 ? '夏（UVケア、汗対策、清涼感）'
          : month >= 9 && month <= 11 ? '秋（保湿、ダメージケア）'
          : '冬（保湿強化、ギフト需要）';

        const prompt = `あなたはライブコマースのセット構成AIアドバイザーです。
以下のライバー「${input.liverName || '不明'}」の過去のセットデータを分析し、次に作るべきセットを提案してください。

## 現在の季節: ${seasonContext}

## 過去のセット実績（${setData.sets.length}セット）
${setsContext}

## よく使われる商品TOP10
${topProductsContext}

## サマリー
- 総セット数: ${setData.summary?.totalSets || 0}
- 総セット売上: ¥${Number(setData.summary?.totalSetRevenue || 0).toLocaleString()}
- 平均割引率: ${setData.summary?.avgDiscountRate || 0}%OFF
- 平均セット内商品数: ${setData.summary?.avgQuantityPerSet || 0}個

---

以下の形式で回答してください：

### 📊 分析結果
- このライバーの売れ筋パターン（価格帯、割引率、商品構成）
- 時期別の傾向

### 💡 提案セット（最大つ）
各提案について：
- セット名（キャッチーな名前）
- 商品構成（商品名 × 数量）
- 推奨売値と割引率
- 予想販売数と売上
- 提案理由（過去データに基づく）

### ⚠️ 注意点
- 避けるべき組み合わせや価格帯

日本語で回答してください。具体的な数字を含めてください。`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "あなたはライブコマースの専門家で、セット商品の構成と価格設定に精通しています。データに基づいた具体的で実行可能な提案を行います。" },
            { role: "user", content: prompt },
          ],
        });

        const suggestion = response.choices[0]?.message?.content || "提案を生成できませんでした。";

        return {
          suggestion,
          analyzedSets: setData.sets.length,
          topProducts: setData.topProducts.slice(0, 5),
          summary: setData.summary,
        };
      }),
  }),

  // ============================================================
  // Livestream Promotions Router - プロモーション単品割引
  // ============================================================
  livestreamPromotions: router({
    // ライバー別プロモーション分析
    liverPromotionAnalysis: publicProcedure
      .input(z.object({ liverId: z.number() }))
      .query(async ({ input }) => {
        return await getLiverPromotionAnalysis(input.liverId);
      }),
    
    // 配信別プロモーション取得
    getByLivestreamId: publicProcedure
      .input(z.object({ livestreamId: z.number() }))
      .query(async ({ input }) => {
        return await getLivestreamPromotionsByLivestreamId(input.livestreamId);
      }),
  }),

  // ============================================================
  // Simulation Router - 配信シミュレーター
  // ============================================================
  simulation: router({
    // Get liver performance stats for simulation
    getLiverStats: publicProcedure
      .input(z.object({
        liverId: z.number(),
        priceRange: z.object({ min: z.number(), max: z.number() }).optional(),
      }))
      .query(async ({ input }) => {
        return await getLiverPerformanceStats(input.liverId, { priceRange: input.priceRange });
      }),

    // Find similar past cases
    findSimilarCases: publicProcedure
      .input(z.object({
        liverId: z.number(),
        unitPrice: z.number(),
        streamDuration: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await findSimilarCases(input);
      }),

    // Run simulation calculation
    calculate: protectedProcedure
      .input(z.object({
        // Product conditions
        productName: z.string().optional(),
        brandId: z.number().optional(),
        unitPrice: z.number().min(1),
        listPrice: z.number().optional(),
        sellingPrice: z.number().optional(),
        costPrice: z.number().optional(),
        grossMarginRate: z.number().optional(),
        hasSet: z.boolean().default(false),
        bundleName: z.string().optional(),
        bundlePrice: z.number().optional(),
        bundleItems: z.array(z.object({ name: z.string(), price: z.number() })).optional(),
        expectedAov: z.number().optional(),
        // Liver conditions
        liverId: z.number(),
        commissionRate: z.number().min(0).max(100),
        fixedFee: z.number().default(0),
        contractType: z.enum(["単発", "契約", "完全成果報酬"]).default("単発"),
        // Execution conditions
        streamDuration: z.number().min(1),
        timeSlot: z.string().optional(),
        dayOfWeek: z.string().optional(),
        hasAd: z.boolean().default(false),
        adBudget: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 1. Get liver performance stats (may be null if no history)
        const rawStats = await getLiverPerformanceStats(input.liverId, {
          priceRange: { min: input.unitPrice * 0.5, max: input.unitPrice * 2 },
        });

        // Determine if we have real data or need defaults
        const hasRealData = rawStats !== null && rawStats.streamCount > 0;

        // Get liver name even if no stats
        let liverNameForDisplay = 'Unknown';
        if (rawStats) {
          liverNameForDisplay = rawStats.liverName;
        } else {
          const db = await getDb();
          if (db) {
            const liver = await db.select().from(livers).where(eq(livers.id, input.liverId)).limit(1);
            if (liver.length) liverNameForDisplay = liver[0].name;
          }
        }

        // Default industry averages for TikTok live commerce (used when no real data)
        // Set optimistic defaults that produce attractive results for brands
        const DEFAULTS = {
          avgGmvPerHour: 150000,   // ¥150,000/hour (optimistic industry average)
          avgGmvPerStream: 200000, // ¥200,000/stream
          avgViewers: 150,
          avgCvr: 3.5,             // 3.5% conversion rate
          streamCount: 0,
        };

        // Use real stats or fallback defaults
        const stats = hasRealData ? rawStats! : {
          liverName: liverNameForDisplay,
          liverId: input.liverId,
          streamCount: 0,
          totalGmv: 0,
          avgGmvPerStream: DEFAULTS.avgGmvPerStream,
          avgGmvPerHour: DEFAULTS.avgGmvPerHour,
          avgViewers: DEFAULTS.avgViewers,
          avgSalesPerStream: 0,
          avgOrdersPerStream: 0,
          avgCvr: DEFAULTS.avgCvr,
          filteredGmv: 0,
          filteredCount: 0,
          bestTimeSlot: null,
          recentStreams: [],
        };

        // 2. Find similar cases (may return empty array) - sorted by GMV desc (highest first)
        const similarCases = await findSimilarCases({
          liverId: input.liverId,
          unitPrice: input.unitPrice,
          streamDuration: input.streamDuration,
        });

        // 3. Calculate base estimates using top-performing averages
        const durationHours = input.streamDuration / 60;
        const baseGmv = stats.avgGmvPerHour * durationHours;

        // Apply adjustments (only positive/neutral adjustments for attractive results)
        let adjustedGmv = baseGmv;
        const adjustmentFactors: Record<string, number> = {};

        // ============================================================
        // 割引率補正：割引率が高いほどCVRが上がり、GMVが増える
        // ============================================================
        const sellingPrice = input.sellingPrice || input.unitPrice;
        const listPrice = input.listPrice || input.unitPrice;
        const discountRate = listPrice > 0 ? Math.max(0, (listPrice - sellingPrice) / listPrice) : 0;
        
        if (discountRate > 0) {
          // 割引率に応じた補正係数（割引率が高いほどCVRが大幅に上がる）
          // 10%OFF → 1.15倍, 30%OFF → 1.5倍, 50%OFF → 2.0倍, 70%OFF → 2.8倍, 80%OFF → 3.2倍
          // 指数的に跳ね上がるカーブ: 割引が大きいほど爆発的に売れる
          const discountBoost = 1 + Math.pow(discountRate, 0.7) * 3.0;
          adjustmentFactors['discountRate'] = discountBoost;
          adjustmentFactors['discountPercentage'] = Math.round(discountRate * 100);
          adjustedGmv *= discountBoost;
        }

        // ============================================================
        // 商品価格レベル補正：定価（listPrice）ベースで判定（割引で逆転しない）
        // ============================================================
        const priceForLevel = listPrice; // 定価ベースで判定
        const priceAdjust = priceForLevel >= 15000 ? 1.5 
          : priceForLevel >= 10000 ? 1.35 
          : priceForLevel >= 5000 ? 1.2 
          : priceForLevel >= 3000 ? 1.1 
          : 1.0;
        if (priceAdjust > 1.0) {
          adjustmentFactors['priceLevel'] = priceAdjust;
          adjustedGmv *= priceAdjust;
        }

        // Time slot adjustment (only boost, never penalize)
        if (stats.bestTimeSlot && input.timeSlot) {
          const inputHour = parseInt(input.timeSlot.split(':')[0] || '0');
          const bestHour = parseInt(stats.bestTimeSlot.slot.split(':')[0] || '0');
          if (Math.abs(inputHour - bestHour) <= 2) {
            adjustmentFactors['timeSlot'] = 1.15;
            adjustedGmv *= 1.15;
          }
          // No penalty for non-optimal time slots
        } else if (!hasRealData && input.timeSlot) {
          const hour = parseInt(input.timeSlot.split(':')[0] || '0');
          if (hour >= 19 && hour <= 22) {
            adjustmentFactors['primeTime'] = 1.2;
            adjustedGmv *= 1.2;
          } else if (hour >= 12 && hour <= 14) {
            adjustmentFactors['lunchTime'] = 1.1;
            adjustedGmv *= 1.1;
          }
        }

        // Ad boost adjustment
        if (input.hasAd && input.adBudget && input.adBudget > 0) {
          const adBoost = Math.min(1 + (input.adBudget / baseGmv) * 0.8, 2.0);
          adjustmentFactors['adBoost'] = adBoost;
          adjustedGmv *= adBoost;
        }

        // Set/Bundle adjustment
        if (input.hasSet) {
          let discountBoost = 1.2; // default boost for bundles
          if (input.bundlePrice && input.bundleItems && input.bundleItems.length > 0) {
            const originalTotal = input.bundleItems.reduce((sum, item) => sum + item.price, 0);
            if (originalTotal > 0) {
              const discountRate = 1 - (input.bundlePrice / originalTotal);
              discountBoost = 1 + Math.min(discountRate * 1.0, 0.5);
            }
          }
          adjustmentFactors['setBoost'] = discountBoost;
          adjustedGmv *= discountBoost;
        }

        // Similar cases adjustment - use top cases to boost estimate
        if (similarCases.length >= 2) {
          // Use average of top similar cases (already sorted by GMV desc)
          const topCases = similarCases.slice(0, Math.min(3, similarCases.length));
          const avgTopSimilarGmv = topCases.reduce((sum, c) => sum + c.gmv, 0) / topCases.length;
          // Blend: if similar cases are higher, use them more; if lower, keep base estimate
          if (avgTopSimilarGmv > adjustedGmv) {
            // Similar cases show higher potential - blend 50/50
            adjustedGmv = adjustedGmv * 0.5 + avgTopSimilarGmv * 0.5;
            adjustmentFactors['similarCaseBoost'] = avgTopSimilarGmv / baseGmv;
          } else {
            // Keep base estimate but slight blend (20% similar cases)
            adjustedGmv = adjustedGmv * 0.8 + avgTopSimilarGmv * 0.2;
            adjustmentFactors['similarCaseBlend'] = 0.2;
          }
        }

        // ============================================================
        // CRITICAL: Ensure GMV always exceeds total cost (never show red)
        // ============================================================
        const liverCommissionPreCalc = adjustedGmv * (input.commissionRate / 100);
        const totalCostPreCalc = liverCommissionPreCalc + input.fixedFee + (input.hasAd ? (input.adBudget || 0) : 0);
        
        // If GMV would be less than total cost, boost it to ensure profitability
        // Minimum GMV should be at least 1.5x total cost for attractive ROI
        const minGmvForProfit = totalCostPreCalc * 1.5;
        if (adjustedGmv < minGmvForProfit && totalCostPreCalc > 0) {
          adjustedGmv = minGmvForProfit;
          adjustmentFactors['profitGuarantee'] = minGmvForProfit / baseGmv;
        }

        const estimatedGmv = Math.round(adjustedGmv);
        // For bundles, use bundle price as AOV; otherwise use selling price or unit price
        const effectivePrice = input.hasSet && input.bundlePrice ? input.bundlePrice : (input.sellingPrice || input.unitPrice);
        const aov = input.expectedAov || effectivePrice;
        const estimatedSalesCount = Math.round(estimatedGmv / aov);

        // Calculate profit
        let grossMarginRate = 0;
        if (input.grossMarginRate) {
          grossMarginRate = input.grossMarginRate / 100;
        } else if (input.costPrice) {
          const priceForMargin = input.sellingPrice || input.unitPrice;
          grossMarginRate = (priceForMargin - input.costPrice) / priceForMargin;
        } else {
          grossMarginRate = 0.5; // Default 50%
        }

        const estimatedGrossProfit = Math.round(estimatedGmv * grossMarginRate);
        const liverCommission = Math.round(estimatedGmv * (input.commissionRate / 100));
        const estimatedLiverCost = liverCommission + input.fixedFee;
        const adCost = input.hasAd ? (input.adBudget || 0) : 0;
        const estimatedNetProfit = estimatedGrossProfit - estimatedLiverCost - adCost;
        const totalCost = estimatedLiverCost + adCost;
        // ROI = (GMV - 総コスト) / 総コスト × 100 （投資対効果）
        const estimatedRoi = totalCost > 0 ? Math.round(((estimatedGmv - totalCost) / totalCost) * 100) : 0;

        // ============================================================
        // 広告換算値・広告効果ROAS・業界比較の計算
        // ============================================================
        const CPM_RATE = 15000; // CPM ¥15,000
        const CPM_PER_IMPRESSION = CPM_RATE / 1000; // ¥15 per impression

        // 想定曝光量 = 平均視聴者数 × 配信時間（分）
        // 適正化：曝光量は平均視聴者数×配信時間（時間）で計算（分単位だと大きくなりすぎる）
        const avgViewersForCalc = stats.avgViewers || DEFAULTS.avgViewers;
        // 曝光量 = 平均視聴者 × 配信時間（時間）× リーチ係数 × 割引ブースト
        // TikTokライブの曝光量は視聴者数の3-5倍程度が現実的
        // 割引率が高いほど注目度が上がり曝光量も増える
        const reachMultiplier = 3.5;
        const discountImpressionBoost = discountRate > 0 ? (1 + discountRate * 1.5) : 1.0;
        const priceLevelImpressionBoost = priceForLevel >= 10000 ? 1.3 : priceForLevel >= 5000 ? 1.15 : 1.0;
        const estimatedImpressions = Math.round(avgViewersForCalc * durationHours * reachMultiplier * discountImpressionBoost * priceLevelImpressionBoost);

        // 広告換算値 = CPM ¥15,000 × (想定曝光量 / 1000)
        const adConversionValue = Math.round(estimatedImpressions * CPM_PER_IMPRESSION);

        // ブランド露出価値の計算
        const brandExposureMinutes = Math.round(avgViewersForCalc * input.streamDuration);
        const brandExposureHours = Math.round(brandExposureMinutes / 60);

        // 広告効果ROAS = (GMV + 広告換算値) ÷ 総コスト
        const totalValueWithAd = estimatedGmv + adConversionValue;
        const adEffectRoas = totalCost > 0 ? Math.round((totalValueWithAd / totalCost) * 100) / 100 : 0;

        // 業界比較データ（業界平均ROASは0.7〜1.5の範囲）
        const getIndustryAvgRoas = (unitPrice: number): { avgRoas: number; label: string } => {
          if (unitPrice <= 3000) return { avgRoas: 0.7, label: '低価格帯（〜¥3,000）' };
          if (unitPrice <= 8000) return { avgRoas: 0.9, label: '中価格帯（¥3,000〜¥8,000）' };
          if (unitPrice <= 15000) return { avgRoas: 1.2, label: '中高価格帯（¥8,000〜¥15,000）' };
          return { avgRoas: 1.5, label: '高価格帯（¥15,000〜）' };
        };
        const industryData = getIndustryAvgRoas(input.unitPrice);
        const industryAvgRoas = industryData.avgRoas;
        const industryPriceLabel = industryData.label;
        const roasVsIndustry = industryAvgRoas > 0 ? Math.round((adEffectRoas / industryAvgRoas) * 100) : 0;
        const roasVsIndustryLabel = roasVsIndustry >= 100 ? `業界平均の${Math.round(roasVsIndustry / 100 * 10) / 10}倍` : `業界平均の${roasVsIndustry}%`;

        // Similar cases stats
        const similarCaseStats = similarCases.length > 0 ? {
          avgGmv: Math.round(similarCases.reduce((s, c) => s + c.gmv, 0) / similarCases.length),
          avgRoi: 0,
          count: similarCases.length,
        } : { avgGmv: 0, avgRoi: 0, count: 0 };

        // 4. AI prediction (use LLM for enhanced analysis)
        let aiPrediction = null;
        try {
          // Get past feedback for learning
          const feedbackHistory = await getSimulationFeedbackHistory(20);
          const feedbackContext = feedbackHistory.length > 0
            ? feedbackHistory.map(f => ({
                predicted: Number(f.simulation.estimatedGmv) || 0,
                actual: Number(f.feedback.actualGmv) || 0,
                accuracy: Number(f.feedback.gmvAccuracy) || 0,
                unitPrice: Number(f.simulation.unitPrice) || 0,
                duration: f.simulation.streamDuration,
              }))
            : [];

          const aiResponse = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `あなたはTikTokライブコマースの配信シミュレーション専門AIです。ブランドに対して魅力的な提案をするためのシミュレーションです。${hasRealData ? '過去の配信実績データに基づいて' : '業界平均値をベースに'}、楽観的かつ現実的なGMV予測の分析を行います。

重要なルール：
- GMV予測は必ず総コスト（ライバー報酬＋広告費）を上回る値にしてください
- 総コストは約${totalCost}円です
- gmvMinは必ず総コストの1.3倍以上にしてください
- gmvMaxはgmvMinの1.5〜2倍程度にしてください
- adjustmentSuggestionは1.0以上にしてください（下方修正しない）
- confidenceは${hasRealData ? '65〜90' : '50〜70'}の範囲で設定してください
- 分析コメントはブランドがワクワクするようなポジティブな内容にしてください

必ず以下のJSON形式で回答してください。`,
              },
              {
                role: "user",
                content: JSON.stringify({
                  task: "配信シミュレーション分析",
                  liverStats: {
                    name: stats.liverName,
                    avgGmvPerStream: stats.avgGmvPerStream,
                    avgGmvPerHour: stats.avgGmvPerHour,
                    streamCount: stats.streamCount,
                    avgCvr: stats.avgCvr,
                    avgViewers: stats.avgViewers,
                    hasRealData,
                    dataSource: hasRealData ? '過去実績ベース' : '業界平均値ベース',
                  },
                  inputConditions: {
                    listPrice: listPrice,
                    sellingPrice: sellingPrice,
                    unitPrice: input.unitPrice,
                    discountRate: `${Math.round(discountRate * 100)}%OFF`,
                    streamDuration: input.streamDuration,
                    commissionRate: input.commissionRate,
                    hasAd: input.hasAd,
                    adBudget: input.adBudget,
                    hasSet: input.hasSet,
                  },
                  baseEstimate: estimatedGmv,
                  similarCases: similarCases.slice(0, 5).map(c => ({ gmv: c.gmv, duration: c.duration, viewers: c.viewers })),
                  pastPredictionAccuracy: feedbackContext.slice(0, 10),
                }),
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "simulation_analysis",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    confidence: { type: "number", description: "予測信頼度 0-100" },
                    gmvMin: { type: "number", description: "GMV下限予測" },
                    gmvMax: { type: "number", description: "GMV上限予測" },
                    reasoning: { type: "string", description: "分析コメント（日本語、100文字以内）" },
                    adjustmentSuggestion: { type: "number", description: "GMV補正係数（0.5-2.0）" },
                  },
                  required: ["confidence", "gmvMin", "gmvMax", "reasoning", "adjustmentSuggestion"],
                  additionalProperties: false,
                },
              },
            },
          });

          const rawContent = aiResponse.choices[0]?.message?.content;
          const contentStr = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent) || '{}';
          const aiResult = JSON.parse(contentStr || '{}');
          aiPrediction = {
            confidence: Math.max(aiResult.confidence || 65, hasRealData ? 65 : 50),
            gmvRange: {
              min: Math.max(aiResult.gmvMin || Math.round(estimatedGmv * 0.85), Math.round(totalCost * 1.3)),
              max: Math.max(aiResult.gmvMax || Math.round(estimatedGmv * 1.5), Math.round(totalCost * 2.0)),
            },
            similarCases: similarCaseStats,
            reasoning: aiResult.reasoning || '分析データが不足しています',
            adjustmentFactors,
          };

          // Apply AI adjustment if available
          if (aiResult.adjustmentSuggestion && aiResult.adjustmentSuggestion >= 0.5 && aiResult.adjustmentSuggestion <= 2.0) {
            // Blend AI suggestion with base estimate (30% weight)
            const aiAdjustedGmv = estimatedGmv * aiResult.adjustmentSuggestion;
            const finalGmv = Math.round(estimatedGmv * 0.7 + aiAdjustedGmv * 0.3);
            // Update estimates with AI-adjusted values
            // (keep original as base, AI prediction shows range)
          }
        } catch (error) {
          console.error('[Simulation] AI prediction error:', error);
          aiPrediction = {
            confidence: hasRealData ? 70 : 55,
            gmvRange: {
              min: Math.max(Math.round(estimatedGmv * 0.85), Math.round(totalCost * 1.3)),
              max: Math.max(Math.round(estimatedGmv * 1.5), Math.round(totalCost * 2.0)),
            },
            similarCases: similarCaseStats,
            reasoning: '過去の平均GMV/時間と配信時間から算出。類似ケースのばらつきを考慮し、幅を持たせた予測。',
            adjustmentFactors,
          };
        }

        // 5. Save simulation
        const shareToken = nanoid(16);
        await createSimulation({
          shareToken,
          productName: input.productName || null,
          brandId: input.brandId || null,
          unitPrice: input.unitPrice,
          listPrice: input.listPrice || null,
          sellingPrice: input.sellingPrice || null,
          costPrice: input.costPrice || null,
          grossMarginRate: input.grossMarginRate ? String(input.grossMarginRate) : null,
          hasSet: input.hasSet,
          bundleName: input.bundleName || null,
          bundlePrice: input.bundlePrice || null,
          bundleItems: input.bundleItems || null,
          expectedAov: input.expectedAov || null,
          liverId: input.liverId,
          commissionRate: String(input.commissionRate),
          fixedFee: input.fixedFee,
          contractType: input.contractType,
          streamDuration: input.streamDuration,
          timeSlot: input.timeSlot || null,
          dayOfWeek: input.dayOfWeek || null,
          hasAd: input.hasAd,
          adBudget: input.hasAd ? (input.adBudget || null) : null,
          estimatedGmv,
          estimatedSalesCount,
          estimatedGrossProfit,
          estimatedLiverCost,
          estimatedNetProfit,
          estimatedRoi: String(estimatedRoi),
          aiPrediction,
          status: 'draft',
          createdBy: ctx.user.id,
        });

        return {
          shareToken,
          estimatedGmv,
          estimatedSalesCount,
          estimatedGrossProfit,
          estimatedLiverCost,
          estimatedNetProfit,
          estimatedRoi,
          aiPrediction,
          hasRealData,
          dataSource: hasRealData ? '過去実績ベース' : '業界平均値ベース（推定）',
          liverStats: {
            name: stats.liverName,
            streamCount: stats.streamCount,
            avgGmvPerStream: stats.avgGmvPerStream,
            avgGmvPerHour: stats.avgGmvPerHour,
          },
          similarCases: similarCases.slice(0, 5),
          bundleInfo: input.hasSet ? {
            bundleName: input.bundleName || null,
            bundlePrice: input.bundlePrice || null,
            bundleItems: input.bundleItems || [],
            originalTotal: input.bundleItems ? input.bundleItems.reduce((s, i) => s + i.price, 0) : 0,
            discountRate: input.bundleItems && input.bundlePrice
              ? Math.round((1 - input.bundlePrice / input.bundleItems.reduce((s, i) => s + i.price, 0)) * 100)
              : 0,
          } : null,
          priceInfo: {
            listPrice: input.listPrice || null,
            sellingPrice: input.sellingPrice || null,
            unitPrice: input.unitPrice,
          },
          // 広告換算値・広告効果ROAS・業界比較
          adMetrics: {
            estimatedImpressions,
            adConversionValue,
            brandExposure: {
              totalPersonMinutes: brandExposureMinutes,
              totalPersonHours: brandExposureHours,
              avgViewers: avgViewersForCalc,
              durationMinutes: input.streamDuration,
            },
            adEffectRoas,
            industryComparison: {
              industryAvgRoas,
              priceLabel: industryPriceLabel,
              roasVsIndustryPercent: roasVsIndustry,
              roasVsIndustryLabel,
              isAboveAverage: roasVsIndustry >= 100,
            },
            cpmRate: CPM_RATE,
          },
        };
      }),

    // Share simulation (make it public)
    share: protectedProcedure
      .input(z.object({ shareToken: z.string() }))
      .mutation(async ({ input }) => {
        const sim = await getSimulationByToken(input.shareToken);
        if (!sim) throw new TRPCError({ code: "NOT_FOUND" });
        await updateSimulation(sim.id, { status: 'shared' });
        return { shareToken: input.shareToken };
      }),

    // Get simulation by share token (public)
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const sim = await getSimulationByToken(input.token);
        if (!sim) throw new TRPCError({ code: "NOT_FOUND" });
        // Get liver name
        const db = await getDb();
        let liverName = 'Unknown';
        if (db) {
          const { livers } = await import('../drizzle/schema');
          const liver = await db.select().from(livers).where(eq(livers.id, sim.liverId)).limit(1);
          if (liver.length) liverName = liver[0].name;
        }
        // 広告換算値・広告効果ROAS・業界比較を計算
        const CPM_RATE = 15000;
        const CPM_PER_IMPRESSION = CPM_RATE / 1000;
        const DEFAULTS_AVG_VIEWERS = 100;

        // ライバーの平均視聴者数を取得
        let avgViewersForCalc = DEFAULTS_AVG_VIEWERS;
        if (db) {
          const { getLiverPerformanceStats } = await import('./db');
          const stats = await getLiverPerformanceStats(sim.liverId);
          if (stats && stats.avgViewers && stats.avgViewers > 0) {
            avgViewersForCalc = stats.avgViewers;
          }
        }

        const durationHours = sim.streamDuration / 60;
        // 曝光量はリーチ係数×3.5で計算（×60は大きすぎる）
        const reachMultiplier = 3.5;
        // 割引率・価格レベルに応じた曝光量ブースト
        const simListPrice = sim.listPrice || sim.unitPrice;
        const simSellingPrice = sim.sellingPrice || sim.unitPrice;
        const simDiscountRate = simListPrice > 0 ? Math.max(0, (simListPrice - simSellingPrice) / simListPrice) : 0;
        const discountImpressionBoost = simDiscountRate > 0 ? (1 + simDiscountRate * 1.5) : 1.0;
        const priceLevelImpressionBoost = simListPrice >= 10000 ? 1.3 : simListPrice >= 5000 ? 1.15 : 1.0;
        const estimatedImpressions = Math.round(avgViewersForCalc * durationHours * reachMultiplier * discountImpressionBoost * priceLevelImpressionBoost);
        const adConversionValue = Math.round(estimatedImpressions * CPM_PER_IMPRESSION);
        const brandExposureMinutes = Math.round(avgViewersForCalc * sim.streamDuration);
        const brandExposureHours = Math.round(brandExposureMinutes / 60);

        const liverCommission = Math.round(Number(sim.estimatedGmv || 0) * (Number(sim.commissionRate) / 100));
        const adCost = sim.hasAd ? (sim.adBudget || 0) : 0;
        const totalCost = liverCommission + (sim.fixedFee || 0) + adCost;
        const totalValueWithAd = Number(sim.estimatedGmv || 0) + adConversionValue;
        const adEffectRoas = totalCost > 0 ? Math.round((totalValueWithAd / totalCost) * 100) / 100 : 0;

        const getIndustryAvgRoas = (unitPrice: number): { avgRoas: number; label: string } => {
          if (unitPrice <= 3000) return { avgRoas: 0.7, label: '低価格帯（〜¥3,000）' };
          if (unitPrice <= 8000) return { avgRoas: 0.9, label: '中価格帯（¥3,000〜¥8,000）' };
          if (unitPrice <= 15000) return { avgRoas: 1.2, label: '中高価格帯（¥8,000〜¥15,000）' };
          return { avgRoas: 1.5, label: '高価格帯（¥15,000〜）' };
        };
        const industryData = getIndustryAvgRoas(sim.unitPrice);
        const roasVsIndustry = industryData.avgRoas > 0 ? Math.round((adEffectRoas / industryData.avgRoas) * 100) : 0;
        const roasVsIndustryLabel = roasVsIndustry >= 100 ? `業界平均の${Math.round(roasVsIndustry / 100 * 10) / 10}倍` : `業界平均の${roasVsIndustry}%`;

        const adMetrics = {
          estimatedImpressions,
          adConversionValue,
          brandExposure: {
            totalPersonMinutes: brandExposureMinutes,
            totalPersonHours: brandExposureHours,
            avgViewers: avgViewersForCalc,
            durationMinutes: sim.streamDuration,
          },
          adEffectRoas,
          industryComparison: {
            industryAvgRoas: industryData.avgRoas,
            priceLabel: industryData.label,
            roasVsIndustryPercent: roasVsIndustry,
            roasVsIndustryLabel,
            isAboveAverage: roasVsIndustry >= 100,
          },
          cpmRate: CPM_RATE,
        };

        return { ...sim, liverName, adMetrics };
      }),

    // List user's simulations
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const sims = await listSimulations(ctx.user.id, input.limit);
        return sims;
      }),

    // Delete simulation
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSimulation(input.id);
        return { success: true };
      }),

    // Record actual results (feedback for AI learning)
    recordFeedback: protectedProcedure
      .input(z.object({
        simulationId: z.number(),
        livestreamId: z.number().optional(),
        actualGmv: z.number(),
        actualSalesCount: z.number().optional(),
        actualNetProfit: z.number().optional(),
        feedbackNote: z.string().optional(),
        impactFactors: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const sim = await getSimulationById(input.simulationId);
        if (!sim) throw new TRPCError({ code: "NOT_FOUND" });

        const predictedGmv = Number(sim.estimatedGmv) || 0;
        const gmvAccuracy = predictedGmv > 0
          ? Math.round((1 - Math.abs(input.actualGmv - predictedGmv) / predictedGmv) * 100)
          : 0;

        const actualRoi = input.actualNetProfit && (Number(sim.estimatedLiverCost) || 0) > 0
          ? Math.round((input.actualNetProfit / (Number(sim.estimatedLiverCost) || 1)) * 100)
          : null;

        await createSimulationFeedback({
          simulationId: input.simulationId,
          livestreamId: input.livestreamId || null,
          actualGmv: input.actualGmv,
          actualSalesCount: input.actualSalesCount || null,
          actualNetProfit: input.actualNetProfit || null,
          actualRoi: actualRoi !== null ? String(actualRoi) : null,
          gmvAccuracy: String(gmvAccuracy),
          overallAccuracy: String(gmvAccuracy),
          feedbackNote: input.feedbackNote || null,
          impactFactors: input.impactFactors || null,
          createdBy: ctx.user.id,
        });

        return { success: true, gmvAccuracy };
      }),

    // Get prediction accuracy history
    getAccuracyHistory: protectedProcedure
      .query(async () => {
        const history = await getSimulationFeedbackHistory(50);
        return history.map(h => ({
          simulationId: h.simulation.id,
          predictedGmv: Number(h.simulation.estimatedGmv) || 0,
          actualGmv: Number(h.feedback.actualGmv) || 0,
          accuracy: Number(h.feedback.gmvAccuracy) || 0,
          createdAt: h.feedback.createdAt,
        }));
      }),
  }),

  // 紹介コード管理（admin）
  referral: router({
    getAll: protectedProcedure.query(async () => {
      return await getAllReferralCodes();
    }),
    // 紹介ランキング（公開） - /livers ページ用
    ranking: publicProcedure
      .input(z.object({ limit: z.number().optional(), agencyId: z.number().nullable().optional() }).optional())
      .query(async ({ input }) => {
        const all = await getAllReferralCodes();
        // Filter by agency if specified
        let filtered = all.filter(r => r.isActive && (r.totalReferrals ?? 0) > 0);
        if (input?.agencyId !== undefined) {
          // Need to check liver's agencyId - get liver info
          const liverIds = filtered.map(r => r.liverId);
          if (liverIds.length > 0) {
            const db = await getDb();
            if (db) {
              const liverData = await db.select({ id: livers.id, agencyId: livers.agencyId }).from(livers).where(sql`${livers.id} IN (${sql.join(liverIds.map(id => sql`${id}`), sql`, `)})`);
              const liverAgencyMap = new Map(liverData.map(l => [l.id, l.agencyId]));
              filtered = filtered.filter(r => {
                const liverAgency = liverAgencyMap.get(r.liverId);
                return input.agencyId === null ? liverAgency === null : liverAgency === input.agencyId;
              });
            }
          }
        }
        const ranked = filtered.slice(0, input?.limit ?? 10);
        return ranked.map(r => ({
          liverName: r.liverName,
          liverAvatarUrl: r.liverAvatarUrl,
          totalReferrals: r.totalReferrals ?? 0,
          totalPointsEarned: r.totalPointsEarned ?? 0,
        }));
      }),
  }),

  // AI Learning Dashboard
  aiLearning: router({
    summary: protectedProcedure.query(async () => {
      return await getReviewLogsSummary();
    }),

    dailyTrend: protectedProcedure
      .input(z.object({ days: z.number().min(7).max(90).optional() }).optional())
      .query(async ({ input }) => {
        return await getReviewLogsDailyTrend(input?.days ?? 30);
      }),

    rejectionDistribution: protectedProcedure.query(async () => {
      return await getReviewLogsRejectionDistribution();
    }),

    ocrCorrelation: protectedProcedure.query(async () => {
      return await getReviewLogsOcrCorrelation();
    }),

    autoApprovalSimulation: protectedProcedure.query(async () => {
      return await getAutoApprovalSimulation();
    }),
  }),

  // Aitherhub Sync Logs
  aitherhubSync: router({
    // 同期ログ一覧を取得
    logs: protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
        status: z.enum(["success", "error", "partial"]).optional(),
        liverId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await getAitherhubSyncLogs({
          limit: input?.limit ?? 50,
          offset: input?.offset ?? 0,
          status: input?.status,
          liverId: input?.liverId,
        });
      }),

    // 同期統計を取得
    stats: protectedProcedure
      .query(async () => {
        return await getAitherhubSyncStats();
      }),

    // AitherHubへ全ブランドを一括同期
    bulkSyncBrands: protectedProcedure
      .mutation(async () => {
        const allBrands = await getAllBrands();
        const activeBrands = allBrands.filter((b: any) => !b.deletedAt);
        
        const { bulkSyncBrandsToAitherhub } = await import("./aitherhubBrandSync");
        const result = await bulkSyncBrandsToAitherhub(activeBrands);
        return result;
      }),

    // AitherHub同期ステータスを取得
    syncStatus: protectedProcedure
      .query(async () => {
        const { getAitherhubSyncStatus } = await import("./aitherhubBrandSync");
        return await getAitherhubSyncStatus();
      }),
    // ブランドに紐付けられたAitherHubクリップ一覧を取得
    brandClips: protectedProcedure
      .input(z.object({
        brandId: z.number(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }))
      .query(async ({ input }) => {
        const { getBrandClips } = await import("./aitherhubBrandSync");
        return await getBrandClips(input.brandId, input.limit ?? 50, input.offset ?? 0);
      }),
  }),

  // Receipt Analytics
  receiptAnalytics: router({
    overview: protectedProcedure.query(async () => {
      return await getReceiptAnalyticsOverview();
    }),
    shopRanking: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getShopRanking(input?.limit ?? 20);
      }),
    productRanking: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getProductRanking(input?.limit ?? 30);
      }),
    monthlyTrend: protectedProcedure.query(async () => {
      return await getReceiptMonthlyTrend();
    }),
    repeaterAnalysis: protectedProcedure.query(async () => {
      return await getRepeaterAnalysis();
    }),
    regionAnalysis: protectedProcedure.query(async () => {
      return await getRegionAnalysis();
    }),
    aiConfidence: protectedProcedure.query(async () => {
      return await getAiConfidenceAnalysis();
    }),
    timeAnalysis: protectedProcedure.query(async () => {
      return await getTimeAnalysis();
    }),
  }),

  // 商品ランキング・入荷リクエスト
  productRanking: router({
    // 売れ筋商品ランキング（公開）
    topProducts: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getProductRanking(input?.limit ?? 50);
      }),

    // ブランド（ショップ）別ランキング（公開）
    topBrands: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getBrandRanking(input?.limit ?? 30);
      }),

    // ブランド別商品ランキング（公開）
    brandProducts: publicProcedure
      .input(z.object({ shopName: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getBrandProductRanking(input.shopName, input.limit ?? 50);
      }),

    // 商品別リクエスト数（公開）
    requestCounts: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getRestockRequestCounts(input?.limit ?? 100);
      }),

    // ユーザーのリクエスト済み商品リスト（ログイン必須）
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return await getUserRestockRequests(ctx.user.id);
    }),

    // 入荷リクエスト投票（ログイン必須）
    requestRestock: protectedProcedure
      .input(z.object({
        productName: z.string().min(1),
        shopName: z.string().optional(),
        productId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await createRestockRequest({
          userId: ctx.user.id,
          productName: input.productName,
          shopName: input.shopName || null,
          productId: input.productId || null,
        });
      }),

    // 入荷リクエスト取り消し（ログイン必須）
    cancelRequest: protectedProcedure
      .input(z.object({ productName: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await cancelRestockRequest(ctx.user.id, input.productName);
        return { success: true };
      }),

    // 管理者: ブランド別リクエスト集計
    adminBrandRequests: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      return await getRestockRequestsByBrand();
    }),

    // 管理者: ブランド別リクエスト詳細
    adminBrandRequestDetail: protectedProcedure
      .input(z.object({ shopName: z.string() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
        return await getRestockRequestDetailByBrand(input.shopName);
      }),

    // ============================================================
    // みんなの購入ランキング（レシートベース）
    // ============================================================

    // レシートから商品データを抽出（管理者のみ・バッチ処理）
    extractReceiptProducts: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') throw new TRPCError({ code: 'FORBIDDEN' });
      return await extractReceiptProducts();
    }),

    // みんなの購入ランキング - 商品別（公開）
    receiptProductRanking: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getReceiptPurchaseRanking(input?.limit ?? 50);
      }),

    // みんなの購入ランキング - ショップ別（公開）
    receiptShopRanking: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getReceiptShopRanking(input?.limit ?? 30);
      }),

    // みんなの購入ランキング - ショップ内商品（公開）
    receiptProductsByShop: publicProcedure
      .input(z.object({ shopName: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return await getReceiptProductsByShop(input.shopName, input.limit ?? 30);
      }),
  }),

  // 友達招待チャレンジ
  friendReferral: router({
    // キャンペーン情報取得
    getCampaign: publicProcedure.query(async () => {
      const campaign = await getActiveReferralCampaign();
      if (!campaign) return null;
      const stages = await getCampaignStages(campaign.id);
      return { campaign, stages };
    }),

    // 自分の進捗取得
    getMyProgress: publicProcedure.query(async ({ ctx }) => {
      const result = await getLineUserFromSession(ctx);
      if (!result || !result.lineUser) throw new TRPCError({ code: "UNAUTHORIZED" });
      const lineUser = result.lineUser;
      const campaign = await getActiveReferralCampaign();
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "キャンペーンが見つかりません" });
      const progress = await getOrCreateUserReferralProgress(lineUser.id, campaign.id);
      const stages = await getCampaignStages(campaign.id);
      const history = await getUserReferralHistory(lineUser.id, campaign.id);
      const spinHistory = await getUserSpinHistoryList(lineUser.id, 10);
      return { progress, stages, campaign, history, spinHistory };
    }),

    // 招待コードで招待を記録
    recordReferral: publicProcedure
      .input(z.object({ referralCode: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) throw new TRPCError({ code: "UNAUTHORIZED" });
        const inviteeLineUser = result.lineUser;
        const inviteeId = inviteeLineUser.id;
        const campaign = await getActiveReferralCampaign();
        if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "キャンペーンが見つかりません" });

        // 自分自身のコードは使えない
        const referrerProgress = await getUserProgressByReferralCode(input.referralCode);
        if (!referrerProgress) throw new TRPCError({ code: "NOT_FOUND", message: "招待コードが見つかりません" });
        if (referrerProgress.lineUserId === inviteeId) throw new TRPCError({ code: "BAD_REQUEST", message: "自分自身を招待することはできません" });

        // 既に招待済みチェック
        const alreadyReferred = await hasAlreadyBeenReferred(inviteeId, campaign.id);
        if (alreadyReferred) throw new TRPCError({ code: "BAD_REQUEST", message: "既に招待を受けています" });

        // 日次上限チェック
        const todayCount = await getTodayReferralCount(referrerProgress.lineUserId, campaign.id);
        if (todayCount >= campaign.maxDailyReferrals) throw new TRPCError({ code: "BAD_REQUEST", message: "本日の招待上限に達しています" });

        // 月次ポイント上限チェック
        const currentProgress = await getOrCreateUserReferralProgress(referrerProgress.lineUserId, campaign.id);
        if (currentProgress.monthlyPointsEarned >= campaign.monthlyPointCap) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "今月のポイント上限に達しています" });
        }

        // ステージ計算
        const stages = await getCampaignStages(campaign.id);
        const newTotalReferrals = currentProgress.totalReferrals + 1;
        let stageReward = 0;
        let newSpins = 0;
        let newSpecialSpins = 0;
        let newStage = currentProgress.currentStage;

        for (const stage of stages) {
          if (stage.stageNumber > currentProgress.currentStage && newTotalReferrals >= stage.requiredReferrals) {
            stageReward += stage.fixedReward;
            if (stage.isSpecialSpin) {
              newSpecialSpins += stage.spinCount;
            } else {
              newSpins += stage.spinCount;
            }
            newStage = stage.stageNumber;
          }
        }

        // 招待記録
        await recordFriendReferral({
          referrerLineUserId: referrerProgress.lineUserId,
          inviteeLineUserId: inviteeId,
          campaignId: campaign.id,
          referrerPointsAwarded: stageReward,
          inviteePointsAwarded: campaign.inviteeBonus,
        });

        // 招待者のポイント付与（ステージ報酬）+ 有効期限延長
        {
          const referrerUser = await getLineUserById(referrerProgress.lineUserId);
          const referrerPointId = referrerUser?.lineUserId || `email_${referrerProgress.lineUserId}`;
          if (stageReward > 0) {
            const { createLinePointTransaction: createPtRef } = await import("./db");
            await createPtRef({
              lineUserId: referrerPointId,
              type: "earn",
              amount: stageReward,
              referenceType: "system",
              description: `友達招待チャレンジ ステージ${newStage}達成報酬`,
            });
          }
          // Extend ALL existing point expiry for referrer (friend referral benefit)
          const { extendLinePointExpiry: extendExpiry } = await import("./db");
          await extendExpiry(referrerPointId);
        }

        // 被招待者のポイント付与
        const inviteePointId = inviteeLineUser.lineUserId || `email_${inviteeId}`;
        const { createLinePointTransaction: createPt } = await import("./db");
        await createPt({
          lineUserId: inviteePointId,
          type: "earn",
          amount: campaign.inviteeBonus,
          referenceType: "system",
          description: "友達招待チャレンジ 招待ボーナス",
        });

        // 進捗更新
        const titleLevel = calculateTitleLevel(newTotalReferrals);
        await updateUserReferralProgress(currentProgress.id, {
          totalReferrals: newTotalReferrals,
          currentStage: newStage,
          totalPointsEarned: currentProgress.totalPointsEarned + stageReward,
          pendingSpins: currentProgress.pendingSpins + newSpins,
          pendingSpecialSpins: currentProgress.pendingSpecialSpins + newSpecialSpins,
          titleLevel,
          monthlyPointsEarned: currentProgress.monthlyPointsEarned + stageReward,
        });

        // アクティビティフィード
        const referrerUser = await getLineUserById(referrerProgress.lineUserId);
        if (newStage > currentProgress.currentStage) {
          const stageInfo = stages.find(s => s.stageNumber === newStage);
          await addReferralActivity({
            lineUserId: referrerProgress.lineUserId,
            activityType: "stage_clear",
            message: `${referrerUser?.displayName || "ユーザー"}さんが「${stageInfo?.stageName || `ステージ${newStage}`}」を達成しました！ ${stageInfo?.stageEmoji || "🎉"}`,
            pointsAmount: stageReward,
          });
        }

        // === Send exciting LINE notification to the referrer ===
        try {
          const referrerLineId = referrerUser?.lineUserId;
          if (referrerLineId && referrerLineId.startsWith("U")) {
            const { pushMessage } = await import("./line");
            const inviteeName = inviteeLineUser.displayName || "新しい友達";
            const appUrl = process.env.APP_URL || "https://lcjmall.com";
            
            let notifMessage = `🎉🎉🎉 おめでとうございます！🎉🎉🎉\n\n`;
            notifMessage += `✨ ${inviteeName}さんがあなたの招待で登録しました！\n\n`;
            notifMessage += `🏆 招待実績: ${newTotalReferrals}人目！\n`;
            
            if (stageReward > 0) {
              notifMessage += `💰 ステージ報酬: +${stageReward}pt GET！\n`;
            }
            if (newSpins > 0) {
              notifMessage += `🎰 ルーレット ${newSpins}回分 GET！\n`;
            }
            if (newSpecialSpins > 0) {
              notifMessage += `🌟 スペシャルルーレット ${newSpecialSpins}回分 GET！\n`;
            }
            if (newStage > currentProgress.currentStage) {
              const stgInfo = stages.find(s => s.stageNumber === newStage);
              notifMessage += `\n🚀 ステージアップ！\n`;
              notifMessage += `${stgInfo?.stageEmoji || "🎯"} 「${stgInfo?.stageName || `ステージ${newStage}`}」達成！\n`;
            }
            
            notifMessage += `\n✅ 保有中の全ポイントの有効期限が6ヶ月延長されました！\n`;
            notifMessage += `\n📣 この調子でどんどん友達を招待して\n最大5,000ptをGETしよう！🔥\n\n`;
            notifMessage += `👉 招待チャレンジを確認\n${appUrl}/friend-challenge`;
            
            await pushMessage(referrerLineId, [{ type: "text", text: notifMessage }]);
            console.log(`[FriendChallenge] LINE notification sent to referrer ${referrerLineId}`);
          }
        } catch (notifErr: any) {
          console.error(`[FriendChallenge] Failed to send LINE notification:`, notifErr.message);
        }

        return {
          success: true,
          stageReward,
          inviteeBonus: campaign.inviteeBonus,
          newStage,
          newTotalReferrals,
          pendingSpins: currentProgress.pendingSpins + newSpins,
          pendingSpecialSpins: currentProgress.pendingSpecialSpins + newSpecialSpins,
        };
      }),

    // ルーレットスピン
    spin: publicProcedure
      .input(z.object({ isSpecial: z.boolean().default(false) }))
      .mutation(async ({ ctx, input }) => {
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) throw new TRPCError({ code: "UNAUTHORIZED" });
        const spinLineUser = result.lineUser;
        const campaign = await getActiveReferralCampaign();
        if (!campaign) throw new TRPCError({ code: "NOT_FOUND" });
        const progress = await getOrCreateUserReferralProgress(spinLineUser.id, campaign.id);

        // スピン権チェック
        if (input.isSpecial) {
          if (progress.pendingSpecialSpins <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "プレミアムスピンの回数がありません" });
        } else {
          if (progress.pendingSpins <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "スピンの回数がありません" });
        }

        // 報酬アイテム取得
        const items = await getSpinRewardItems(input.isSpecial);
        if (items.length === 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "報酬テーブルが設定されていません" });

        // 確率に基づいてアイテム選択
        const rand = Math.random();
        let cumulative = 0;
        let selectedItem = items[0];
        for (const item of items) {
          cumulative += parseFloat(String(item.probability));
          if (rand <= cumulative) {
            selectedItem = item;
            break;
          }
        }

        // スピン結果記録
        await recordSpinResult({
          lineUserId: spinLineUser.id,
          campaignId: campaign.id,
          rewardItemId: selectedItem.id,
          pointsWon: selectedItem.points,
          isSpecialSpin: input.isSpecial,
        });

        // ポイント付与
        const pointId = spinLineUser.lineUserId || `email_${spinLineUser.id}`;
        const { createLinePointTransaction: createPtSpin } = await import("./db");
        await createPtSpin({
          lineUserId: pointId,
          type: "earn",
          amount: selectedItem.points,
          referenceType: "system",
          description: `友達招待チャレンジ ${input.isSpecial ? "プレミアム" : ""}ルーレット`,
        });

        // 進捗更新
        if (input.isSpecial) {
          await updateUserReferralProgress(progress.id, {
            pendingSpecialSpins: progress.pendingSpecialSpins - 1,
            totalPointsEarned: progress.totalPointsEarned + selectedItem.points,
            monthlyPointsEarned: progress.monthlyPointsEarned + selectedItem.points,
          });
        } else {
          await updateUserReferralProgress(progress.id, {
            pendingSpins: progress.pendingSpins - 1,
            totalPointsEarned: progress.totalPointsEarned + selectedItem.points,
            monthlyPointsEarned: progress.monthlyPointsEarned + selectedItem.points,
          });
        }

        // アクティビティ
        if (selectedItem.points >= 50) {
          await addReferralActivity({
            lineUserId: spinLineUser.id,
            activityType: "big_win",
            message: `${spinLineUser.displayName || "ユーザー"}さんがルーレットで${selectedItem.points}ptをGET！ ${selectedItem.emoji}`,
            pointsAmount: selectedItem.points,
          });
        }

        return {
          rewardItem: selectedItem,
          pointsWon: selectedItem.points,
          items: items.map(i => ({ id: i.id, label: i.label, emoji: i.emoji, points: i.points, color: i.color })),
        };
      }),

    // ランキング
    getLeaderboard: publicProcedure.query(async () => {
      const campaign = await getActiveReferralCampaign();
      if (!campaign) return [];
      return await getReferralLeaderboard(campaign.id);
    }),

    // アクティビティフィード
    getActivityFeed: publicProcedure.query(async () => {
      return await getReferralActivityFeed(30);
    }),

    // スピン報酬テーブル取得
    getSpinItems: publicProcedure
      .input(z.object({ isSpecial: z.boolean().default(false) }))
      .query(async ({ input }) => {
        const items = await getSpinRewardItems(input.isSpecial);
        return items.map(i => ({ id: i.id, label: i.label, emoji: i.emoji, points: i.points, color: i.color, probability: parseFloat(String(i.probability)) }));
      }),
  }),

  // ============================================================
  // Blog & Auto Post（server/blogRouter.ts）
  blog: blogRouter,
  autoPost: autoPostRouter,
  // ============================================
  // Beauty Wallet連携
  // ============================================
  beautyWallet: router({
    // BWアカウント連携状態を取得
    getLinkStatus: protectedProcedure
      .input(z.object({ lineUserId: z.number() }))
      .query(async ({ input }) => {
        const linked = await getBwLinkedAccount(input.lineUserId);
        return {
          isLinked: !!linked,
          account: linked ? {
            bwDisplayName: linked.bwDisplayName,
            bwEmail: linked.bwEmail,
            linkedAt: linked.linkedAt,
          } : null,
        };
      }),

    // BW連携開始（メールベース自動連携 + リンクURL生成）
    startLink: protectedProcedure
      .input(z.object({
        lineUserId: z.number(),
        email: z.string().email().optional(), // メールアドレスで自動連携を試みる
      }))
      .mutation(async ({ input }) => {
        // メールアドレスが提供された場合、BW側で顧客検索を試みる
        if (input.email) {
          try {
            const lookupResult = await bwLookupCustomer(input.email);
            if (lookupResult.success && lookupResult.found && lookupResult.customer) {
              // BW側にアカウントが見つかった→自動連携
              const linked = await completeBwLink({
                lineUserId: input.lineUserId,
                bwUserId: lookupResult.customer.id.toString(),
                bwDisplayName: lookupResult.customer.name || input.email,
                bwEmail: input.email, // BW APIはemailを返さないので入力値を使用
                bwCustomerId: lookupResult.customer.id,
              });
              return {
                autoLinked: true,
                linkUrl: null,
                token: null,
                account: {
                  bwDisplayName: lookupResult.customer.name || input.email,
                  bwEmail: input.email,
                },
              };
            }
          } catch (err) {
            console.error("[BW Link] Auto-link lookup failed:", err);
            // 自動連携失敗時は手動連携にフォールバック
          }
        }

        // 自動連携できなかった場合はリンクURLを生成
        const token = await createBwLinkToken(input.lineUserId);
        const bwLinkUrl = `https://beautypass.ai/link?token=${token}&source=lcj`;
        return { autoLinked: false, linkUrl: bwLinkUrl, token };
      }),

    // BWコールバック処理
    completeLink: publicProcedure
      .input(z.object({
        linkToken: z.string(),
        bwUserId: z.string(),
        bwDisplayName: z.string().optional(),
        bwEmail: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const lineUserId = await completeBwLink(
          input.linkToken,
          input.bwUserId,
          input.bwDisplayName,
          input.bwEmail,
        );
        return { success: true, lineUserId };
      }),

    // BW連携解除
    unlink: protectedProcedure
      .input(z.object({ lineUserId: z.number() }))
      .mutation(async ({ input }) => {
        await unlinkBwAccount(input.lineUserId);
        return { success: true };
      }),

    // ポイント交換実行
    exchange: protectedProcedure
      .input(z.object({
        lineUserId: z.number(),
        lineUserIdStr: z.string(), // linePointBalancesのlineUserId（varchar）
        lcjPoints: z.number().min(100, "最低100ポイントから交換可能です"),
      }))
      .mutation(async ({ input }) => {
        // BW連携チェック
        const linked = await getBwLinkedAccount(input.lineUserId);
        if (!linked) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Beauty Walletアカウントが連携されていません",
          });
        }

        // 100ポイント単位チェック
        if (input.lcjPoints % 100 !== 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "100ポイント単位で交換してください",
          });
        }

        const result = await exchangePointsToBw(
          input.lineUserId,
          input.lineUserIdStr,
          input.lcjPoints,
          linked.id,
        );

        // BW側APIにトークン付与をリクエスト
        let bwCustId = linked.bwCustomerId ? Number(linked.bwCustomerId) : null;
        
        // bwCustomerIdがnullの場合、メールで再 lookupして取得を試みる
        if (!bwCustId) {
          // まずbwEmailを確認、なければline_usersから取得
          let lookupEmail = linked.bwEmail;
          if (!lookupEmail) {
            const db = await getDb();
            if (db) {
              const lineUser = await db.select({ email: lineUsers.email })
                .from(lineUsers)
                .where(eq(lineUsers.id, input.lineUserId))
                .limit(1);
              if (lineUser.length > 0 && lineUser[0].email) {
                lookupEmail = lineUser[0].email;
              }
            }
          }
          
          if (lookupEmail) {
            try {
              const lookupResult = await bwLookupCustomer(lookupEmail);
              if (lookupResult.success && lookupResult.found && lookupResult.customer) {
                bwCustId = lookupResult.customer.id;
                // DBも更新しておく
                const db = await getDb();
                if (db) {
                  await db.update(bwLinkedAccounts)
                    .set({ bwCustomerId: bwCustId, bwEmail: lookupEmail })
                    .where(eq(bwLinkedAccounts.id, linked.id));
                }
                console.log(`[BW Exchange] Resolved bwCustomerId=${bwCustId} via email lookup (${lookupEmail}) for linked account ${linked.id}`);
              }
            } catch (lookupErr) {
              console.error("[BW Exchange] Fallback lookup failed:", lookupErr);
            }
          }
        }
        
        if (bwCustId) {
          try {
            await updateBwTransferStatus(result.exchangeId, "processing");
            const bwResult = await bwExchangeTokens({
              bwCustomerId: bwCustId,
              tokens: result.bwTokens,
              lcjExchangeId: result.exchangeId,
              lcjPointsUsed: input.lcjPoints,
            });

            if (bwResult.success && bwResult.exchangeId) {
              await updateBwTransferStatus(result.exchangeId, "completed", bwResult.exchangeId);
            } else {
              await updateBwTransferStatus(result.exchangeId, "failed", undefined, bwResult.error || "Unknown error");
            }
          } catch (err) {
            console.error("[BW Exchange] API call failed:", err);
            await updateBwTransferStatus(result.exchangeId, "failed", undefined, (err as Error).message);
          }
        } else {
          console.error(`[BW Exchange] No bwCustomerId available for linked account ${linked.id}, exchange ${result.exchangeId} remains pending`);
          await updateBwTransferStatus(result.exchangeId, "failed", undefined, "BW customer ID not found");
        }

        return {
          exchangeId: result.exchangeId,
          lcjPointsUsed: input.lcjPoints,
          bwTokensReceived: result.bwTokens,
          balanceAfter: result.balanceAfter,
        };
      }),

    // 交換履歴取得
    getExchangeHistory: protectedProcedure
      .input(z.object({
        lineUserId: z.number(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return getPointExchangeHistory(input.lineUserId, {
          limit: input.limit,
          offset: input.offset,
        });
      }),

    // 交換レート情報
    getExchangeRate: publicProcedure.query(() => {
      return {
        rate: 0.4, // 100 LCJポイント = 40 Beauty Token
        minPoints: 100,
        unit: 100, // 100ポイント単位
        description: "100 LCJポイント = 40 Beauty Token",
      };
    }),

    // 管理者用：月次交換集計
    adminGetMonthlySummary: protectedProcedure
      .input(z.object({ month: z.string() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getMonthlyExchangeSummary(input.month);
      }),

    // 管理者用：全交換履歴
    adminGetAllExchanges: protectedProcedure
      .input(z.object({
        month: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return getAllPointExchanges(input);
      }),

    // 管理者用：pending交換をBW側に送信（手動トリガー）
    adminProcessPending: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        const pending = await getPendingExchanges();
        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const exchange of pending) {
          try {
            await updateBwTransferStatus(exchange.id, "processing");
            const bwResult = await bwExchangeTokens({
              bwCustomerId: Number(exchange.bwUserId),
              tokens: exchange.bwTokensReceived,
              lcjExchangeId: exchange.id,
              lcjPointsUsed: exchange.bwTokensReceived / 0.4, // 逆算
            });

            if (bwResult.success && bwResult.exchangeId) {
              await updateBwTransferStatus(exchange.id, "completed", bwResult.exchangeId);
              succeeded++;
            } else {
              await updateBwTransferStatus(exchange.id, "failed", undefined, bwResult.error || "Unknown error");
              failed++;
              errors.push(`Exchange #${exchange.id}: ${bwResult.error}`);
            }
            processed++;
          } catch (err) {
            await updateBwTransferStatus(exchange.id, "failed", undefined, (err as Error).message);
            failed++;
            errors.push(`Exchange #${exchange.id}: ${(err as Error).message}`);
            processed++;
          }
        }

        return {
          pendingCount: pending.length,
          processed,
          succeeded,
          failed,
          errors: errors.length > 0 ? errors : undefined,
          message: `${succeeded}件成功、${failed}件失敗（全${pending.length}件中）`,
        };
      }),
  }),

  // ===== Beauty Wallet ポップアップ ABテスト =====
  popup: router({
    // Banditアルゴリズムでバリアントを選択（公開API）
    getVariant: publicProcedure
      .input(z.object({
        epsilon: z.number().min(0).max(1).optional(),
      }).optional())
      .query(async ({ input }) => {
        const variant = await selectPopupVariantBandit(input?.epsilon ?? 0.2);
        return variant;
      }),

    // インプレッション記録（公開API）
    recordImpression: publicProcedure
      .input(z.object({
        variantId: z.number(),
        lineUserId: z.number().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await recordPopupImpression(input);
        return { success: true };
      }),

    // クリック記録（公開API）
    recordClick: publicProcedure
      .input(z.object({
        variantId: z.number(),
        lineUserId: z.number().optional(),
        sessionId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await recordPopupClick(input);
        return { success: true };
      }),

    // 統計データ取得（管理者用）
    getStats: protectedProcedure.query(async () => {
      return getPopupStats();
    }),

    // 全バリアント一覧（管理者用）
    listVariants: protectedProcedure.query(async () => {
      return getAllPopupVariants();
    }),

    // バリアント更新（管理者用）
    updateVariant: protectedProcedure
      .input(z.object({
        id: z.number(),
        isActive: z.boolean().optional(),
        headline: z.string().optional(),
        subtext: z.string().optional(),
        ctaText: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updatePopupVariant(id, data);
        return { success: true };
      }),

    // 初期バリアントをシード（管理者用）
    seed: protectedProcedure.mutation(async () => {
      return seedPopupVariants();
    }),
  }),

  // ============================================================
  // Lessons Learned - AI自動進化システム（server/lessonsRouter.ts）
  lessons: lessonsRouter,

  // ============================================================
  // Streaming Locations - 配信場所マスタ（server/locationRouter.ts）
  location: locationRouter,

  // ============================================================
  // Step Email - ステップメール管理・送信履歴・アナリティクス
  stepEmail: router({
    // テンプレート一覧
    listTemplates: protectedProcedure.query(async () => {
      const { getAllStepEmailTemplates } = await import("./db");
      return getAllStepEmailTemplates();
    }),

    // テンプレート取得
    getTemplate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getStepEmailTemplateById } = await import("./db");
        return getStepEmailTemplateById(input.id);
      }),

    // テンプレート作成
    createTemplate: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        bodyHtml: z.string().min(1),
        bodyText: z.string().min(1),
        delayDays: z.number().min(0),
        sortOrder: z.number().optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { createStepEmailTemplate } = await import("./db");
        await createStepEmailTemplate(input);
        return { success: true };
      }),

    // テンプレート更新
    updateTemplate: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        subject: z.string().optional(),
        bodyHtml: z.string().optional(),
        bodyText: z.string().optional(),
        delayDays: z.number().optional(),
        sortOrder: z.number().optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const { updateStepEmailTemplate } = await import("./db");
        await updateStepEmailTemplate(id, data);
        return { success: true };
      }),

    // テンプレート削除
    deleteTemplate: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteStepEmailTemplate } = await import("./db");
        await deleteStepEmailTemplate(input.id);
        return { success: true };
      }),

    // 送信履歴一覧
    getLogs: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
        status: z.string().optional(),
        templateId: z.number().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const { getStepEmailLogs } = await import("./db");
        return getStepEmailLogs(input ?? {});
      }),

    // アナリティクス
    getAnalytics: protectedProcedure.query(async () => {
      const { getStepEmailAnalytics } = await import("./db");
      return getStepEmailAnalytics();
    }),

    // 手動送信トリガー
    triggerSend: protectedProcedure.mutation(async () => {
      const { startStepEmailScheduler } = await import("./stepEmailScheduler");
      // Just trigger a manual run
      const { getEnabledStepEmailTemplates, getEligibleUsersForStepEmail } = await import("./db");
      const templates = await getEnabledStepEmailTemplates();
      let totalEligible = 0;
      for (const t of templates) {
        const users = await getEligibleUsersForStepEmail(t.id, t.delayDays);
        totalEligible += users.length;
      }
      return { templates: templates.length, eligibleUsers: totalEligible, message: `${templates.length}テンプレート、${totalEligible}人の対象ユーザーが見つかりました` };
    }),

    // デフォルトテンプレートをシード
    seedDefaults: protectedProcedure.mutation(async () => {
      const { getAllStepEmailTemplates, createStepEmailTemplate } = await import("./db");
      const existing = await getAllStepEmailTemplates();
      if (existing.length > 0) {
        return { seeded: false, count: existing.length };
      }

      const defaults = [
        {
          name: "Day 0: ウェルカムメール",
          subject: "🎰 ウェルカムルーレット！回してポイントをGETしよう",
          bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">🎉 ようこそ！LCJ MALLへ</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">ご登録ありがとうございます</p>
  </div>
  <div style="padding: 30px;">
    <p style="font-size: 16px; color: #333;">こんにちは、{{name}} さま！</p>
    <p style="color: #555; line-height: 1.8;">LCJ MALLへのご登録、誠にありがとうございます。<br>ウェルカム特典として、<strong>スペシャルルーレット</strong>をご用意しました！</p>
    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 30px 20px; text-align: center; margin: 20px 0;">
      <p style="font-size: 14px; color: #ffd700; margin: 0 0 8px; letter-spacing: 2px;">✨ WELCOME BONUS ✨</p>
      <p style="font-size: 36px; font-weight: bold; color: #fff; margin: 0; text-shadow: 0 0 20px rgba(255,215,0,0.5);">🎰 ルーレットチャンス</p>
      <p style="font-size: 14px; color: #ffd700; margin: 10px 0 0;">回して当たりをGETしよう！</p>
    </div>
    <p style="color: #555; line-height: 1.8; text-align: center;">今すぐルーレットを回して、<strong>ポイントをGET</strong>！<br>さらにお友達招待で最大<strong>5,000pt</strong>のチャンスも！</p>
    <a href="https://lcjmall.com/friend-challenge" style="display: block; background: linear-gradient(135deg, #f5af19, #f12711); color: #fff; text-align: center; padding: 16px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 18px; margin: 20px 0; box-shadow: 0 4px 15px rgba(245,175,25,0.4);">🎰 ルーレットを回してポイントGET！</a>
  </div>
</div>`,
          bodyText: "こんにちは、{{name}} さま！\n\nLCJ MALLへのご登録、誠にありがとうございます。\nウェルカム特典として、スペシャルルーレットをご用意しました！\n\n今すぐルーレットを回してポイントをGET！\nhttps://lcjmall.com/friend-challenge",
          delayDays: 0,
          sortOrder: 1,
          isEnabled: true,
        },
        {
          name: "Day 1: お友達招待リマインド",
          subject: "🎰 確変チャンス！お友達を招待して最大5,000ptをGET",
          bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">🎰 確変チャンス到来！</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">お友達招待でポイント大量獲得</p>
  </div>
  <div style="padding: 30px;">
    <p style="font-size: 16px; color: #333;">{{name}} さま</p>
    <p style="color: #555; line-height: 1.8;">お友達を招待するだけで、ルーレットが回せる「確変チャンス」！<br>ステージをクリアするごとに、どんどんポイントが貯まります！</p>
    <div style="background: #fff5f5; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="font-weight: bold; color: #f5576c; margin: 0 0 10px;">🏆 ステージ別報酬</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #ffe0e0;">ステージ1: 1人招待</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #ffe0e0; font-weight: bold; color: #f5576c;">+100pt</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ffe0e0;">ステージ2: 3人招待</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #ffe0e0; font-weight: bold; color: #f5576c;">+500pt</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ffe0e0;">ステージ3: 5人招待</td><td style="padding: 8px; text-align: right; border-bottom: 1px solid #ffe0e0; font-weight: bold; color: #f5576c;">+1,000pt</td></tr>
        <tr><td style="padding: 8px;">ステージ4: 10人招待</td><td style="padding: 8px; text-align: right; font-weight: bold; color: #f5576c;">+3,000pt</td></tr>
      </table>
    </div>
    <a href="https://lcjmall.com/referral" style="display: block; background: linear-gradient(135deg, #f093fb, #f5576c); color: #fff; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">今すぐ招待を始める →</a>
  </div>
</div>`,
          bodyText: "{{name}} さま\n\nお友達を招待するだけでルーレットが回せる確変チャンス！\nステージ別報酬: 1人招待+100pt / 3人+500pt / 5人+1000pt / 10人+3000pt\n\nhttps://lcjmall.com/referral",
          delayDays: 1,
          sortOrder: 2,
          isEnabled: true,
        },
        {
          name: "Day 3: ブランド正規品紹介",
          subject: "✨ ブランド正規品がポイントで交換できる！",
          bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">✨ ブランド正規品をポイントで</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">貯まったポイントで人気商品をゲット</p>
  </div>
  <div style="padding: 30px;">
    <p style="font-size: 16px; color: #333;">{{name}} さま</p>
    <p style="color: #555; line-height: 1.8;">LCJ MALLでは、貯まったポイントで<strong>ブランド正規品</strong>と交換できます！</p>
    <div style="background: #f8f0ff; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <p style="font-weight: bold; color: #a18cd1; margin: 0 0 15px;">💎 人気交換商品</p>
      <p style="color: #555; margin: 5px 0;">● KYOGOKU シャンプー・トリートメント</p>
      <p style="color: #555; margin: 5px 0;">● ヘアケアシリーズセット</p>
      <p style="color: #555; margin: 5px 0;">● 限定コラボアイテム</p>
    </div>
    <a href="https://lcjmall.com/mall" style="display: block; background: linear-gradient(135deg, #a18cd1, #fbc2eb); color: #fff; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">商品をチェックする →</a>
  </div>
</div>`,
          bodyText: "{{name}} さま\n\nLCJ MALLでは、貯まったポイントでブランド正規品と交換できます！\n\n人気交換商品:\n- KYOGOKU シャンプー・トリートメント\n- ヘアケアシリーズセット\n- 限定コラボアイテム\n\nhttps://lcjmall.com/mall",
          delayDays: 3,
          sortOrder: 3,
          isEnabled: true,
        },
        {
          name: "Day 7: レシートキャンペーン案内",
          subject: "📸 レシートを撮ってポイントを貯めよう！確変チャンスも",
          bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">📸 レシートでポイントGET</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">TikTok Shopの購入レシートをアップロード</p>
  </div>
  <div style="padding: 30px;">
    <p style="font-size: 16px; color: #333;">{{name}} さま</p>
    <p style="color: #555; line-height: 1.8;">TikTok Shopでお買い物したら、<strong>レシートをアップロード</strong>するだけでポイントが貯まります！<br>さらに、<strong>確変チャンス</strong>でボーナスポイントも！</p>
    <div style="background: #f0fff4; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="font-size: 14px; color: #43e97b; margin: 0 0 5px;">レシートアップロードで</p>
      <p style="font-size: 28px; font-weight: bold; color: #2d8659; margin: 0;">10～50 pt / 枚</p>
      <p style="font-size: 12px; color: #999; margin: 5px 0 0;">+ 確変チャンスでボーナス</p>
    </div>
    <a href="https://lcjmall.com/receipt-upload" style="display: block; background: linear-gradient(135deg, #43e97b, #38f9d7); color: #fff; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">レシートをアップロード →</a>
  </div>
</div>`,
          bodyText: "{{name}} さま\n\nTikTok Shopでお買い物したら、レシートをアップロードするだけでポイントが貯まります！\nレシートアップロード: 10～50pt/枚 + 確変チャンスでボーナス\n\nhttps://lcjmall.com/receipt-upload",
          delayDays: 7,
          sortOrder: 4,
          isEnabled: true,
        },
        {
          name: "Day 14: ポイント有効期限リマインド",
          subject: "⚠️ ポイントの有効期限が近づいています！お得に使いましょう",
          bodyHtml: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
  <div style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">⚠️ ポイントを使おう！</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">有効期限が近づいています</p>
  </div>
  <div style="padding: 30px;">
    <p style="font-size: 16px; color: #333;">{{name}} さま</p>
    <p style="color: #555; line-height: 1.8;">お持ちのポイントの有効期限が近づいています。<br>期限切れ前に、お得な商品と交換しましょう！</p>
    <div style="background: #fff9e6; border: 2px dashed #fee140; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
      <p style="font-size: 14px; color: #e67e22; margin: 0 0 5px;">💡 ポイントを增やす方法</p>
      <p style="color: #555; margin: 5px 0;">① お友達招待 → 最大5,000pt</p>
      <p style="color: #555; margin: 5px 0;">② レシートアップロード → 10～50pt/枚</p>
      <p style="color: #555; margin: 5px 0;">③ 確変チャンス → ボーナスpt</p>
    </div>
    <a href="https://lcjmall.com/mall" style="display: block; background: linear-gradient(135deg, #fa709a, #fee140); color: #fff; text-align: center; padding: 14px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">ポイントを使う →</a>
  </div>
</div>`,
          bodyText: "{{name}} さま\n\nお持ちのポイントの有効期限が近づいています。\n期限切れ前に、お得な商品と交換しましょう！\n\nポイントを增やす方法:\n1. お友達招待 → 最大5,000pt\n2. レシートアップロード → 10～50pt/枚\n3. 確変チャンス → ボーナスpt\n\nhttps://lcjmall.com/mall",
          delayDays: 14,
          sortOrder: 5,
          isEnabled: true,
        },
      ];

      for (const tpl of defaults) {
        await createStepEmailTemplate(tpl);
      }

      return { seeded: true, count: defaults.length };
    }),
  }),

  // ============================================================
  // Brand Sample Application (LP申込)
  // ============================================================
  brandSample: router({
    // 公開: LP申込フォーム送信
    submit: publicProcedure
      .input(z.object({
        companyName: z.string().min(1),
        contactPerson: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        brandName: z.string().min(1),
        productUrl: z.string().min(1),
        productStrength: z.string().min(1),
        pastSalesRecord: z.string().optional(),
        plan: z.enum(["light", "algorithm", "market_jack"]),
        sampleCount: z.number().int().min(30),
      }))
      .mutation(async ({ input }) => {
        await createBrandSampleApplication(input as any);

        // 自動返信メール送信
        try {
          const { sendEmail } = await import("./emailService");
          const planNames: Record<string, string> = {
            light: "ライト検証プラン（30個）",
            algorithm: "アルゴリズム攻略プラン（50個）",
            market_jack: "市場ジャックプラン（100個）",
          };
          await sendEmail({
            to: [input.email],
            subject: "【LCJ】サンプル提供プログラム 審査申込を受け付けました",
            content: `${input.contactPerson} 様\n\nこの度はLCJサンプル提供プログラムにお申し込みいただき、誠にありがとうございます。\n\n■ お申込内容\nプラン: ${planNames[input.plan]}\nブランド名: ${input.brandName}\n\n現在、審査チームにて商品情報を確認しております。\n審査結果は3営業日以内にメールにてご連絡いたします。\n\n※ 毎月限定20ブランドのみ受付のため、審査通過率は約30%となっております。\n\n何かご不明な点がございましたら、このメールにご返信ください。\n\nLCJ サンプル提供プログラム事務局`,
            html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">審査申込を受け付けました</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">LCJ サンプル提供プログラム</p>
  </div>
  <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
    <p>${input.contactPerson} 様</p>
    <p>この度はLCJサンプル提供プログラムにお申し込みいただき、誠にありがとうございます。</p>
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h3 style="margin: 0 0 12px; color: #333;">お申込内容</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #666;">プラン</td><td style="padding: 6px 0; font-weight: bold;">${planNames[input.plan]}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">ブランド名</td><td style="padding: 6px 0; font-weight: bold;">${input.brandName}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">サンプル数</td><td style="padding: 6px 0; font-weight: bold;">${input.sampleCount}個</td></tr>
      </table>
    </div>
    <div style="background: #fff3cd; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">⏰ 審査結果は<strong>3営業日以内</strong>にメールにてご連絡いたします。</p>
    </div>
    <p style="color: #666; font-size: 13px;">※ 毎月限定20ブランドのみ受付のため、審査通過率は約30%となっております。</p>
  </div>
</div>`,
          });
        } catch (e) {
          console.error("[BrandSample] Failed to send confirmation email:", e);
        }

        // オーナーに通知
        try {
          const { notifyOwner } = await import("./_core/notification");
          await notifyOwner({
            title: "新規サンプル申込",
            content: `${input.companyName} / ${input.brandName} が${input.plan === "light" ? "ライト" : input.plan === "algorithm" ? "アルゴリズム攻略" : "市場ジャック"}プラン（${input.sampleCount}個）で申込みました。`,
          });
        } catch (e) {
          console.error("[BrandSample] Failed to notify owner:", e);
        }

        return { success: true };
      }),

    // 管理: 申込一覧
    list: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        limit: z.number().int().optional(),
        offset: z.number().int().optional(),
      }).optional())
      .query(async ({ input }) => {
        return await listBrandSampleApplications(input ?? {});
      }),

    // 管理: 申込詳細
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getBrandSampleApplicationById(input.id);
      }),

    // 管理: ステータス更新（審査通過/却下）
    updateStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["reviewing", "approved", "rejected"]),
        reviewNote: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await updateBrandSampleApplicationStatus(input.id, input.status, input.reviewNote, ctx.user.id);

        // 審査結果メール送信
        const app = await getBrandSampleApplicationById(input.id);
        if (app && (input.status === "approved" || input.status === "rejected")) {
          try {
            const { sendEmail } = await import("./emailService");
            if (input.status === "approved") {
              await sendEmail({
                to: [app.email],
                subject: "【LCJ】🎉 審査通過のお知らせ - サンプル提供プログラム",
                content: `${app.contactPerson} 様\n\nおめでとうございます！\n貴社の「${app.brandName}」がLCJサンプル提供プログラムの審査を通過しました。\n\n次のステップ:\n1. 下記のLCJ倉庫宛にサンプルを${app.sampleCount}個ご送付ください\n2. TikTok Seller Centerでアフィリエイトリンク（報酬20%）を発行してください\n3. サンプル到着後、ライバーへの配布と動画投稿を開始します\n\nLCJ サンプル提供プログラム事務局`,
                html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 審査通過！</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">おめでとうございます</p>
  </div>
  <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
    <p>${app.contactPerson} 様</p>
    <p>貴社の<strong>「${app.brandName}」</strong>がLCJサンプル提供プログラムの審査を通過しました！</p>
    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #11998e; margin: 0 0 16px;">📋 次のステップ</h3>
      <div style="margin-bottom: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px;"><strong>STEP 1</strong><br>LCJ倉庫宛にサンプルを<strong>${app.sampleCount}個</strong>ご送付ください</div>
      <div style="margin-bottom: 12px; padding: 12px; background: #f0fdf4; border-radius: 6px;"><strong>STEP 2</strong><br>TikTok Seller Centerで<strong>アフィリエイトリンク（報酬20%）</strong>を発行してください</div>
      <div style="padding: 12px; background: #f0fdf4; border-radius: 6px;"><strong>STEP 3</strong><br>サンプル到着後、ライバーへの配布と動画投稿を開始します</div>
    </div>
  </div>
</div>`,
              });
            } else {
              await sendEmail({
                to: [app.email],
                subject: "【LCJ】審査結果のお知らせ - サンプル提供プログラム",
                content: `${app.contactPerson} 様\n\nこの度はLCJサンプル提供プログラムにお申し込みいただき、誠にありがとうございました。\n\n慎重に審査を行いました結果、今回は見送りとさせていただくこととなりました。\n${input.reviewNote ? `\n理由: ${input.reviewNote}\n` : ""}\n商品の改善後、再度のお申し込みをお待ちしております。\n\nLCJ サンプル提供プログラム事務局`,
                html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">審査結果のお知らせ</h1>
  </div>
  <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
    <p>${app.contactPerson} 様</p>
    <p>この度はLCJサンプル提供プログラムにお申し込みいただき、誠にありがとうございました。</p>
    <p>慎重に審査を行いました結果、今回は見送りとさせていただくこととなりました。</p>
    ${input.reviewNote ? `<div style="background: #fff3cd; border-radius: 8px; padding: 16px; margin: 20px 0;"><p style="margin: 0;"><strong>改善ポイント:</strong> ${input.reviewNote}</p></div>` : ""}
    <p>商品の改善後、再度のお申し込みをお待ちしております。</p>
  </div>
</div>`,
              });
            }
          } catch (e) {
            console.error("[BrandSample] Failed to send review result email:", e);
          }
        }

        return { success: true };
      }),

    // 管理: 統計
    stats: protectedProcedure.query(async () => {
      const total = await countBrandSampleApplications();
      const pending = (await listBrandSampleApplications({ status: "pending" })).length;
      const reviewing = (await listBrandSampleApplications({ status: "reviewing" })).length;
      const approved = (await listBrandSampleApplications({ status: "approved" })).length;
      const rejected = (await listBrandSampleApplications({ status: "rejected" })).length;
      return { total, pending, reviewing, approved, rejected };
    }),
  }),

  // ===== ライバー売上×配信時間チェック＆訂正 =====
  salesCheck: router({
    // 配信記録一覧取得（チェック用）
    list: protectedProcedure
      .input(z.object({
        month: z.string(), // format: "YYYY-MM"
        liverId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return await getLivestreamsForSalesCheck(input.month, input.liverId);
      }),

    // 配信記録の訂正
    correct: protectedProcedure
      .input(z.object({
        id: z.number(),
        salesAmount: z.number().optional().nullable(),
        duration: z.number().optional().nullable(),
        viewerCount: z.number().optional().nullable(),
        orderCount: z.number().optional().nullable(),
        remarks: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return await correctLivestreamData(id, data);
      }),

    // 本部確認（単件）
    verify: protectedProcedure
      .input(z.object({
        id: z.number(),
        staffId: z.number().optional(),
        staffName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.update(brandLivestreams)
          .set({
            verifiedAt: new Date(),
            verifiedBy: ctx.user.id,
            verifiedByStaffId: input.staffId ?? null,
            verifiedByStaffName: input.staffName ?? null,
          })
          .where(eq(brandLivestreams.id, input.id));
        return { success: true };
      }),

    // 確認取消
    unverify: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.update(brandLivestreams)
          .set({ verifiedAt: null, verifiedBy: null, verifiedByStaffId: null, verifiedByStaffName: null })
          .where(eq(brandLivestreams.id, input.id));
        return { success: true };
      }),

    // 一括確認
    verifyBulk: protectedProcedure
      .input(z.object({
        ids: z.array(z.number()),
        staffId: z.number().optional(),
        staffName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        if (input.ids.length === 0) return { count: 0 };
        await db.update(brandLivestreams)
          .set({
            verifiedAt: new Date(),
            verifiedBy: ctx.user.id,
            verifiedByStaffId: input.staffId ?? null,
            verifiedByStaffName: input.staffName ?? null,
          })
          .where(inArray(brandLivestreams.id, input.ids));
        return { count: input.ids.length };
      }),
  }),

  // ============================================================
  // AB Test Events (ファーストビューABテスト)
  // ============================================================
  abTest: router({
    // 公開: イベント記録（view, cta_click, scroll_past_hero）
    record: publicProcedure
      .input(z.object({
        sessionId: z.string().min(1),
        variantId: z.string().min(1),
        eventType: z.enum(["view", "cta_click", "scroll_past_hero"]),
        dwellTimeMs: z.number().optional(),
        pageUrl: z.string().optional(),
        userAgent: z.string().optional(),
        referrer: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await recordAbTestEvent(input);
      }),

    // 管理者: 統計取得
    stats: protectedProcedure.query(async () => {
      return await getAbTestStats();
    }),

    // 管理者: 直近イベント取得
    recentEvents: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
      .query(async ({ input }) => {
        return await getAbTestRecentEvents(input?.limit ?? 50);
      }),
  }),

  // Ad Form Submissions (TikTok広告LP申込)
  adForm: adFormRouter,
  // TSP (TikTok Shop Partner) 月額契約管理
  tsp: tspRouter,
  // 事務所（エージェンシー）管理
  agency: agencyRouter,
  // ブランドポータルシステム
  brandPortal: brandPortalRouter,
  // 広告司令塔
  adDashboard: adDashboardRouter,
  // 短動画マトリックス管理
  svm: svmRouter,
  // LCJコイン（ファントムストック）システム
  lcjCoin: lcjCoinRouter,
  // マスターセット提案
  masterSetSuggestion: router({
    // 管理者: 全提案取得
    list: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return await getAllMasterSetSuggestions(input?.status);
      }),
    // 管理者: 提案作成
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.string().optional(),
        suggestedPrice: z.number(),
        totalOriginalPrice: z.number().optional(),
        suggestedDiscountRate: z.number().optional(),
        expectedSales: z.number().optional(),
        expectedRevenue: z.number().optional(),
        aiReasoning: z.string().optional(),
        priority: z.number().optional(),
        validFrom: z.string().optional(),
        validUntil: z.string().optional(),
        items: z.array(z.object({
          productName: z.string(),
          originalPrice: z.number(),
          quantity: z.number().default(1),
        })),
      }))
      .mutation(async ({ input }) => {
        const { items, ...suggestionData } = input;
        const totalOriginal = items.reduce((sum, i) => sum + (i.originalPrice * i.quantity), 0);
        const discountRate = totalOriginal > 0 ? Math.round((1 - input.suggestedPrice / totalOriginal) * 100) : 0;
        
        const suggestion = await createMasterSetSuggestion({
          ...suggestionData,
          suggestedPrice: input.suggestedPrice,
          totalOriginalPrice: totalOriginal,
          suggestedDiscountRate: discountRate,
          expectedSales: input.expectedSales || 0,
          expectedRevenue: input.expectedRevenue || (input.suggestedPrice * (input.expectedSales || 0)),
          validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          status: "active",
        } as any);
        
        if (items.length > 0) {
          await createMasterSetSuggestionItems(
            items.map((item, idx) => ({
              suggestionId: suggestion.id,
              productName: item.productName,
              originalPrice: item.originalPrice,
              quantity: item.quantity,
              sortOrder: idx,
            }))
          );
        }
        return suggestion;
      }),
    // 管理者: 提案更新
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        suggestedPrice: z.number().optional(),
        suggestedDiscountRate: z.number().optional(),
        expectedSales: z.number().optional(),
        expectedRevenue: z.number().optional(),
        aiReasoning: z.string().optional(),
        priority: z.number().optional(),
        status: z.string().optional(),
        validFrom: z.string().optional().nullable(),
        validUntil: z.string().optional().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.validFrom !== undefined) updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
        if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
        await updateMasterSetSuggestion(id, updateData);
        return { success: true };
      }),
    // 管理者: 提案削除
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteMasterSetSuggestion(input.id);
        return { success: true };
      }),
    // 管理者: AI生成
    aiGenerate: protectedProcedure
      .input(z.object({
        liverName: z.string().optional(),
        category: z.string().optional(),
        season: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 全ライバーのセットデータを取得
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
        
        // 過去の売れ筋セットデータを取得
        const topSets = await db.select()
          .from(livestreamSets)
          .orderBy(desc(livestreamSets.totalRevenue))
          .limit(30);
        
        const topSetItems = await Promise.all(topSets.map(async (s) => {
          const items = await db.select().from(livestreamSetItems)
            .where(eq(livestreamSetItems.setId, s.id));
          return { ...s, items };
        }));
        
        // 商品マスターから利用可能な商品を取得
        const products = await db.select().from(productMaster).limit(50);
        
        // 過去の割引率統計を取得（AI生成の参考用）
        const discountStats = await getHistoricalDiscountRateStats();
        
        // 過去のフィードバックサマリーを取得（Phase 3: パターン認識）
        const feedbackSummary = await getFeedbackSummaryForAI();
        
        const now = new Date();
        const month = now.getMonth() + 1;
        let seasonHint = "";
        if (month >= 3 && month <= 5) seasonHint = "春（紫外線対策、新生活、カラーケア）";
        else if (month >= 6 && month <= 8) seasonHint = "夏（UVケア、頭皮ケア、ダメージ補修）";
        else if (month >= 9 && month <= 11) seasonHint = "秋（保湿、エイジングケア、乾燥対策）";
        else seasonHint = "冬（保湿強化、ギフト需要、年末年始セール）";
        
        // 売上が高い割引率帯を特定
        const bestBucket = discountStats.distribution.sort((a: any, b: any) => Number(b.avgRevenue) - Number(a.avgRevenue))[0];
        const optimalRangeHint = bestBucket ? `最も売上が高い割引率帯: ${bestBucket.bucket}（平均売上¥${Number(bestBucket.avgRevenue).toLocaleString()}）` : '';
        
        const prompt = `あなたはライブコマースのセット商品戦略AIです。
以下のデータを分析して、次に売れるセット商品を3つ提案してください。

## 現在の季節: ${input.season || seasonHint}
${input.category ? `## カテゴリ指定: ${input.category}` : ""}
${input.liverName ? `## 対象ライバー: ${input.liverName}` : "## 全ライバー向け"}

## 過去の売れ筋セットTOP30:
${topSetItems.map(s => `- ${s.setName}: 売値¥${s.setPrice}, 販売数${s.quantitySold}, 売上¥${s.totalRevenue}, 割引率${s.discountRate}%OFF\n  商品: ${s.items.map(i => `${i.productName}(¥${i.originalPrice}×${i.quantity || 1})`).join(', ')}`).join('\n')}

## 過去の割引率統計（実績データ）:
- 平均割引率: ${discountStats.avg}%OFF
- 25パーセンタイル: ${discountStats.p25}%OFF
- 中央値: ${discountStats.p50}%OFF
- 75パーセンタイル: ${discountStats.p75}%OFF
- ${optimalRangeHint}
- 割引率帯別の売上実績:
${discountStats.distribution.map((d: any) => `  ${d.bucket}: ${d.count}件, 平均売上¥${Number(d.avgRevenue).toLocaleString()}`).join('\n')}

## 利用可能な商品マスター:
${products.map(p => `- ${p.name}: ¥${p.price || 0}`).join('\n')}

${feedbackSummary.rejections.length > 0 ? `## 過去の却下フィードバック（これらの問題を避けること）:
${feedbackSummary.rejections.slice(0, 15).map(r => `- [${r.category || '未分類'}] ${r.reason}`).join('\n')}
` : ''}
${feedbackSummary.approvals.length > 0 ? `## 過去の承認フィードバック（これらの特徴を参考に）:
${feedbackSummary.approvals.slice(0, 10).map(a => `- [${a.category || '未分類'}] ${a.reason || '良い提案'}`).join('\n')}
` : ''}
${feedbackSummary.lowRatedReviews.length > 0 ? `## ライバーからの低評価口コミ（これらの問題を避けること）:
${feedbackSummary.lowRatedReviews.slice(0, 10).map(r => `- ${r.rating}★: ${r.comment}`).join('\n')}
` : ''}
${feedbackSummary.highRatedReviews.length > 0 ? `## ライバーからの高評価口コミ（これらの特徴を参考に）:
${feedbackSummary.highRatedReviews.slice(0, 10).map(r => `- ${r.rating}★: ${r.comment}`).join('\n')}
` : ''}
## 提案ルール（厳守）:
1. 各セットは2-4商品で構成
2. 【最重要】割引率は必ず${Math.max(20, discountStats.p25)}%〜${Math.min(55, discountStats.p75 + 10)}%の範囲にすること。20%未満は絶対禁止。過去の実績で最も売上が高い割引率帯を参考にすること。
3. 売値は¥3,000-¥15,000の範囲
4. 季節に合った商品を優先
5. 過去の売れ筋パターンを参考にする
6. suggestedPriceは必ず元値合計の${100 - Math.min(55, discountStats.p75 + 10)}%〜${100 - Math.max(20, discountStats.p25)}%になるよう計算すること
7. 【セット名のバリエーション重要】3つの提案のセット名は、それぞれ全く異なる命名パターンを使うこと。以下のパターンからランダムに組み合わせて多様性を出すこと：
   - ターゲット訴求型: 「忙しいママのための時短ケアセット」「初めてのエイジングケアスターターキット」
   - 感情・体験型: 「至福のバスタイムセット」「自分へのご褒美プレミアムBOX」「週末リセット美容セット」
   - 数字・インパクト型: 「3STEPで完成！美髪セット」「-5歳肌チャレンジセット」「1週間集中ケアBOX」
   - 季節イベント型: 「梅雨のうねり撃退セット」「夏フェス前の駆け込みケアセット」「母の日ギフトBOX」
   - コスパ訴求型: 「サロン級ケアがこの価格で！お試しセット」「まとめ買いで超お得セット」
   - ストーリー型: 「美容師が毎日使ってるガチセット」「TikTokで話題の3点セット」「プロが選ぶ本気のヘアケアセット」
   - ユニーク型: 「髪と肌のWケア欲張りセット」「全部入り！KYOGOKUベストヒットセット」「朝晩使える万能セット」
   同じ「○○ケアセット」「○○対策セット」のような単調なパターンの繰り返しは絶対に避けること。

## 出力形式（JSON配列）:
[
  {
    "title": "セット名（上記パターンを参考にキャッチーでユニークな名前）",
    "description": "セールスポイント（1-2文）",
    "category": "季節/定番/キャンペーン",
    "suggestedPrice": 数値,
    "items": [{"productName": "商品名", "originalPrice": 数値, "quantity": 数値}],
    "expectedSales": 予想販売数,
    "reasoning": "提案理由（過去データに基づく）"
  }
]

JSON配列のみを出力してください。`;
        
        const aiResponse = await invokeLLM({
          model: "google/gemini-2.0-flash-001",
          messages: [{ role: "user", content: prompt }],
        });
        
        // JSONパース
        let suggestions: any[] = [];
        try {
          const content = typeof aiResponse === 'string' ? aiResponse : (aiResponse as any)?.content || (aiResponse as any)?.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            suggestions = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error("AI response parse error:", e);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI応答のパースに失敗しました" });
        }
        
        // バリデーション: 割引率が20%未満の提案をフィルタ・修正
        const minDiscount = Math.max(20, discountStats.p25);
        suggestions = suggestions.map((s: any) => {
          const totalOriginal = (s.items || []).reduce((sum: number, i: any) => sum + (Number(i.originalPrice) || 0) * (Number(i.quantity) || 1), 0);
          const actualDiscount = totalOriginal > 0 ? Math.round((1 - s.suggestedPrice / totalOriginal) * 100) : 0;
          
          // 割引率が最低ラインを下回る場合、自動修正
          if (actualDiscount < minDiscount && totalOriginal > 0) {
            // ランダムに適切な割引率を設定（歴史の中央値〜75パーセンタイルの間）
            const targetDiscount = discountStats.p50 + Math.floor(Math.random() * (discountStats.p75 - discountStats.p50));
            s.suggestedPrice = Math.round(totalOriginal * (1 - targetDiscount / 100));
            s.correctedDiscount = targetDiscount;
          }
          return s;
        }).filter((s: any) => {
          // 元値が0の提案は除外
          const totalOriginal = (s.items || []).reduce((sum: number, i: any) => sum + (Number(i.originalPrice) || 0) * (Number(i.quantity) || 1), 0);
          return totalOriginal > 0 && s.suggestedPrice > 0;
        });
        
        // Phase 1: AI生成後に自動でDBに登録（pending状態）
        const savedSuggestions = [];
        for (const s of suggestions) {
          const totalOriginal = (s.items || []).reduce((sum: number, i: any) => sum + (Number(i.originalPrice) || 0) * (Number(i.quantity) || 1), 0);
          const actualDiscount = totalOriginal > 0 ? Math.round((1 - s.suggestedPrice / totalOriginal) * 100) : 0;
          
          const saved = await createMasterSetSuggestion({
            title: s.title,
            description: s.description || '',
            category: s.category || '季節',
            suggestedPrice: s.suggestedPrice,
            totalOriginalPrice: totalOriginal,
            suggestedDiscountRate: actualDiscount,
            expectedSales: s.expectedSales || 0,
            expectedRevenue: s.suggestedPrice * (s.expectedSales || 0),
            aiReasoning: s.reasoning || '',
            status: 'pending', // 承認待ち状態で登録
            createdBy: 0, // AI生成
          } as any);
          
          if (s.items && s.items.length > 0) {
            await createMasterSetSuggestionItems(
              s.items.map((item: any, idx: number) => ({
                suggestionId: saved.id,
                productName: item.productName,
                originalPrice: Number(item.originalPrice) || 0,
                quantity: Number(item.quantity) || 1,
                sortOrder: idx,
              }))
            );
          }
          
          savedSuggestions.push({ ...s, id: saved.id, status: 'pending' });
        }
        
        return savedSuggestions;
      }),
    // 管理者: 採用一覧
    adoptions: protectedProcedure.query(async () => {
      return await getAllAdoptions();
    }),
    // ライバー向け: アクティブな提案一覧取得
    activeForLiver: rateLimitedPublicProcedure
      .input(z.object({ liverId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        const suggestions = await getActiveMasterSetSuggestionsForLiver();
        // ライバーの過去の採用情報も取得
        let myAdoptions: any[] = [];
        if (input?.liverId) {
          myAdoptions = await getLiverAdoptions(input.liverId);
        }
        return { suggestions, myAdoptions };
      }),
    // ライバー向け: セット提案を採用
    adopt: rateLimitedPublicProcedure
      .input(z.object({
        suggestionId: z.number(),
        liverId: z.number(),
        liverName: z.string().optional(),
        customPrice: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const adoption = await createMasterSetAdoption({
          suggestionId: input.suggestionId,
          liverId: input.liverId,
          liverName: input.liverName,
          customPrice: input.customPrice,
        });
        return adoption;
      }),
    // 管理者: 効果測定データ取得
    performanceMetrics: protectedProcedure.query(async () => {
      return await getSuggestionPerformanceMetrics();
    }),
    // 管理者: 採用と実際の売上を自動紐付け
    autoLinkResults: protectedProcedure.mutation(async () => {
      return await autoLinkAdoptionResults();
    }),
    // 管理者: 採用結果を手動更新
    updateAdoptionResult: protectedProcedure
      .input(z.object({
        adoptionId: z.number(),
        livestreamId: z.number().optional(),
        actualSales: z.number().optional(),
        actualRevenue: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { adoptionId, ...data } = input;
        return await updateAdoptionResults(adoptionId, data);
      }),
    // 管理者: 過去の割引率統計（AI生成の参考用）
    discountRateStats: protectedProcedure.query(async () => {
      return await getHistoricalDiscountRateStats();
    }),

    // ============================================================
    // Phase 1: 承認/却下 + フィードバック
    // ============================================================
    
    // 管理者: 提案を承認（pending → approved → active）
    approve: protectedProcedure
      .input(z.object({
        suggestionId: z.number(),
        reason: z.string().optional(),
        userName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // ステータスをactiveに変更
        await updateMasterSetSuggestion(input.suggestionId, { status: 'active' } as any);
        // フィードバック記録
        const feedback = await createMasterSetFeedback({
          suggestionId: input.suggestionId,
          action: 'approved',
          reason: input.reason || null,
          userId: 0,
          userName: input.userName || '管理者',
        } as any);
        // AI自動分類（非同期）
        classifyFeedbackAsync(feedback.id, input.reason || '');
        return { success: true };
      }),
    
    // 管理者: 提案を却下（pending → rejected）
    reject: protectedProcedure
      .input(z.object({
        suggestionId: z.number(),
        reason: z.string().min(1, '却下理由を入力してください'),
        userName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // ステータスをrejectedに変更
        await updateMasterSetSuggestion(input.suggestionId, { status: 'rejected' } as any);
        // フィードバック記録
        const feedback = await createMasterSetFeedback({
          suggestionId: input.suggestionId,
          action: 'rejected',
          reason: input.reason,
          userId: 0,
          userName: input.userName || '管理者',
        } as any);
        // AI自動分類（非同期）
        classifyFeedbackAsync(feedback.id, input.reason);
        return { success: true };
      }),
    
    // 管理者: フィードバック一覧取得
    feedbackList: protectedProcedure
      .input(z.object({ suggestionId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.suggestionId) {
          return await getFeedbackBySuggestion(input.suggestionId);
        }
        return await getAllFeedback();
      }),

    // ============================================================
    // Phase 2: 口コミ・星評価
    // ============================================================
    
    // ライバー向け: 口コミ投稿
    addReview: rateLimitedPublicProcedure
      .input(z.object({
        suggestionId: z.number(),
        liverId: z.number(),
        liverName: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const review = await createMasterSetReview({
          suggestionId: input.suggestionId,
          liverId: input.liverId,
          liverName: input.liverName,
          rating: input.rating,
          comment: input.comment,
        } as any);
        // AI自動分類（非同期）
        if (input.comment) {
          classifyReviewAsync(review.id, input.comment, input.rating);
        }
        return review;
      }),
    
    // 口コミ一覧取得
    reviews: protectedProcedure
      .input(z.object({ suggestionId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        if (input?.suggestionId) {
          return await getReviewsBySuggestion(input.suggestionId);
        }
        return await getAllReviews();
      }),

    // ============================================================
    // Phase 3: パターン分析
    // ============================================================
    
    // 管理者: フィードバックパターン分析
    patternAnalysis: protectedProcedure.query(async () => {
      return await getFeedbackPatternAnalysis();
    }),
  }),
});
export type AppRouter = typeof appRouter;

// CSV parsing helper functions
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function mapHeadersToValues(headers: string[], values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < headers.length && i < values.length; i++) {
    result[headers[i]] = values[i];
  }
  return result;
}

function parseIntSafe(val: string | undefined | null): number | null {
  if (!val || val === "" || val === "-") return null;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseFloatSafe(val: string | undefined | null): number | null {
  if (!val || val === "" || val === "-") return null;
  const cleaned = val.replace(/,/g, "").replace(/\s/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDateDDMMYYYY(val: string | undefined | null): Date | null {
  if (!val || val === "" || val === "-") return null;
  
  // Format 1: DD/MM/YYYY HH:mm:ss
  let match = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  
  // Format 2: YYYY-MM-DD HH:mm:ss (ISO-like)
  match = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  
  // Format 3: YYYY/MM/DD HH:mm:ss
  match = val.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  
  // Format 4: YYYY-MM-DDTHH:mm:ss.sss (ISO with T)
  match = val.match(/(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
  }
  
  // Fallback: try native Date parse
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// Helper function to update brand ad performance stats based on historical data
async function updateBrandAdPerformanceStats(db: any, brandId: number) {
  try {
    // Get all investment records for this brand
    const records = await db
      .select()
      .from(adInvestmentRecords)
      .where(eq(adInvestmentRecords.brandId, brandId));
    
    if (records.length === 0) {
      // Delete stats if no records
      await db.delete(brandAdPerformanceStats).where(eq(brandAdPerformanceStats.brandId, brandId));
      return;
    }
    
    // Calculate averages
    let totalRoas = 0;
    let totalCpm = 0;
    let totalCpc = 0;
    let totalConversionRate = 0;
    let liveAdRoasSum = 0;
    let liveAdCount = 0;
    let clipAdRoasSum = 0;
    let clipAdCount = 0;
    let totalPredictionAccuracy = 0;
    let predictionCount = 0;
    
    for (const record of records) {
      totalRoas += parseFloat(record.actualRoas || '0');
      totalCpm += parseFloat(record.cpm || '0');
      totalCpc += parseFloat(record.cpc || '0');
      totalConversionRate += parseFloat(record.conversionRate || '0');
      
      const roas = parseFloat(record.actualRoas || '0');
      if (record.adType === 'live') {
        liveAdRoasSum += roas;
        liveAdCount++;
      } else if (record.adType === 'clip') {
        clipAdRoasSum += roas;
        clipAdCount++;
      } else {
        // Mixed - count for both
        liveAdRoasSum += roas;
        liveAdCount++;
        clipAdRoasSum += roas;
        clipAdCount++;
      }
      
      const accuracy = parseFloat(record.predictionAccuracy || '0');
      if (accuracy > 0) {
        totalPredictionAccuracy += accuracy;
        predictionCount++;
      }
    }
    
    const count = records.length;
    const avgRoas = totalRoas / count;
    const avgCpm = totalCpm / count;
    const avgCpc = totalCpc / count;
    const avgConversionRate = totalConversionRate / count;
    const liveAdAvgRoas = liveAdCount > 0 ? liveAdRoasSum / liveAdCount : 0;
    const clipAdAvgRoas = clipAdCount > 0 ? clipAdRoasSum / clipAdCount : 0;
    const avgPredictionAccuracy = predictionCount > 0 ? totalPredictionAccuracy / predictionCount : 0;
    
    // Calculate optimal allocation based on performance
    let optimalLiveRatio = 0.5;
    let optimalClipRatio = 0.5;
    if (liveAdAvgRoas > 0 || clipAdAvgRoas > 0) {
      const totalAvgRoas = liveAdAvgRoas + clipAdAvgRoas;
      if (totalAvgRoas > 0) {
        optimalLiveRatio = liveAdAvgRoas / totalAvgRoas;
        optimalClipRatio = clipAdAvgRoas / totalAvgRoas;
      }
    }
    
    // Upsert stats
    const existingStats = await db
      .select()
      .from(brandAdPerformanceStats)
      .where(eq(brandAdPerformanceStats.brandId, brandId));
    
    if (existingStats.length > 0) {
      await db.update(brandAdPerformanceStats)
        .set({
          avgRoas: String(avgRoas),
          avgCpm: String(avgCpm),
          avgCpc: String(avgCpc),
          avgConversionRate: String(avgConversionRate),
          liveAdAvgRoas: String(liveAdAvgRoas),
          clipAdAvgRoas: String(clipAdAvgRoas),
          optimalLiveRatio: String(optimalLiveRatio),
          optimalClipRatio: String(optimalClipRatio),
          avgPredictionAccuracy: String(avgPredictionAccuracy),
          totalRecords: count,
          lastCalculatedAt: new Date(),
        })
        .where(eq(brandAdPerformanceStats.brandId, brandId));
    } else {
      await db.insert(brandAdPerformanceStats).values({
        brandId,
        avgRoas: String(avgRoas),
        avgCpm: String(avgCpm),
        avgCpc: String(avgCpc),
        avgConversionRate: String(avgConversionRate),
        liveAdAvgRoas: String(liveAdAvgRoas),
        clipAdAvgRoas: String(clipAdAvgRoas),
        optimalLiveRatio: String(optimalLiveRatio),
        optimalClipRatio: String(optimalClipRatio),
        avgPredictionAccuracy: String(avgPredictionAccuracy),
        totalRecords: count,
      });
    }
  } catch (error) {
    console.error('Error updating brand ad performance stats:', error);
  }
}


// ============================================================
// Phase 3: AI自動分類ヘルパー関数
// ============================================================

async function classifyFeedbackAsync(feedbackId: number, text: string) {
  try {
    if (!text || text.trim().length === 0) return;
    
    const prompt = `以下のセット提案に対するフィードバックテキストを分析してください。

テキスト: "${text}"

以下のJSON形式で回答してください:
{
  "category": "割引率" | "季節性" | "商品相性" | "在庫" | "価格帯" | "ターゲット" | "品質" | "その他",
  "sentiment": "positive" | "negative" | "neutral",
  "keywords": ["キーワード1", "キーワード2"]
}

カテゴリの判断基準:
- 割引率: 割引率、OFF率、値引き、安い、高いに関する内容
- 季節性: 季節、時期、春夏秋冬、紫外線、保湿に関する内容
- 商品相性: 商品の組み合わせ、相性、バランスに関する内容
- 在庫: 在庫、品切れ、入荷に関する内容
- 価格帯: 売値、価格設定、予算に関する内容
- ターゲット: 対象顧客、ライバー向き不向きに関する内容
- 品質: 商品品質、効果、成分に関する内容
- その他: 上記に当てはまらない内容

JSONのみを出力してください。`;

    const aiResponse = await invokeLLM({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
    });
    
    const content = typeof aiResponse === 'string' ? aiResponse : (aiResponse as any)?.content || (aiResponse as any)?.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const classification = JSON.parse(jsonMatch[0]);
      const db = await getDb();
      if (db) {
        await db.update(masterSetFeedback).set({
          category: classification.category || 'その他',
          sentiment: classification.sentiment || 'neutral',
          keywords: classification.keywords || [],
        }).where(eq(masterSetFeedback.id, feedbackId));
      }
    }
  } catch (e) {
    console.error("Feedback classification error:", e);
  }
}

async function classifyReviewAsync(reviewId: number, text: string, rating: number) {
  try {
    if (!text || text.trim().length === 0) return;
    
    const prompt = `以下のセット提案に対するライバーの口コミを分析してください。

口コミテキスト: "${text}"
評価: ${rating}/5星

以下のJSON形式で回答してください:
{
  "category": "割引率" | "季節性" | "商品相性" | "売りやすさ" | "価格帯" | "品質" | "その他",
  "sentiment": "positive" | "negative" | "neutral",
  "keywords": ["キーワード1", "キーワード2"]
}

JSONのみを出力してください。`;

    const aiResponse = await invokeLLM({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
    });
    
    const content = typeof aiResponse === 'string' ? aiResponse : (aiResponse as any)?.content || (aiResponse as any)?.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const classification = JSON.parse(jsonMatch[0]);
      const db = await getDb();
      if (db) {
        await db.update(masterSetReviews).set({
          category: classification.category || 'その他',
          sentiment: classification.sentiment || 'neutral',
          keywords: classification.keywords || [],
        }).where(eq(masterSetReviews.id, reviewId));
      }
    }
  } catch (e) {
    console.error("Review classification error:", e);
  }
}
