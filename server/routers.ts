import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import * as iconv from "iconv-lite";
import * as chardet from "chardet";
import { sendCoachingToLiver } from "./_core/lineMessaging";
import {
  createStaff,
  getAllStaff,
  getActiveStaff,
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
  getLiverRecentLivestreams,
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
  getTiktokDailySummary,
  getTiktokContentTypeSummary,
  deleteTiktokOrdersByImportId,
  deleteTiktokImportHistory,
  getExistingSubOrderIds,
  createLivestreamSet,
  createLivestreamSetItem,
  getLivestreamSetsByLivestreamId,
  deleteLivestreamSetsByLivestreamId,
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
} from "./db";
import { pushMessage, leaveGroup } from "./line";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { lineUsers, brands, lineGroups, schedules, adAlertHistory, adInvestmentRecords, brandAdPerformanceStats, tiktokCommissionOrders, livestreamSets, livestreamSetItems, simulations, livers } from "../drizzle/schema";
import { eq, and, not, isNotNull, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { authRouter } from "./auth";
import { liverRouter } from "./liverRouter";
import { checkAndSendReminders } from "./reminderScheduler";
import { completionRouter } from "./completion";
import { sendReminderEmail } from "./emailService";
import { transcribeAudio } from "./_core/voiceTranscription";

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
      
      // Get point balance
      const pointBalance = lineUser.lineUserId ? await getLinePointBalance(lineUser.lineUserId) : null;
      
      // Generate sessionToken for localStorage sync
      // This ensures that even if the user logged in via cookie,
      // the frontend can save the token to localStorage for cross-page navigation
      const sessionToken = Buffer.from(JSON.stringify(session)).toString('base64');
      
      return {
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
        user: {
          lineUserId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        },
      };
    }),

  // Email registration
  emailRegister: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      // Check if email already exists
      const existingUser = await getLineUserByEmail(input.email);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "このメールアドレスは既に登録されています",
        });
      }
      
      // Hash password
      const bcrypt = await import("bcryptjs");
      const hashedPassword = await bcrypt.hash(input.password, 10);
      
      // Create user
      const newUser = await createEmailLineUser({
        email: input.email,
        password: hashedPassword,
        displayName: input.name,
      });
      
      return {
        success: true,
        userId: newUser.id,
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
      const pointBalance = lineUser.lineUserId ? await getLinePointBalance(lineUser.lineUserId) : null;
      const transactions = lineUser.lineUserId ? await getLinePointTransactions(lineUser.lineUserId, { limit: 50 }) : [];
      
      return {
        balance: pointBalance?.balance || 0,
        lifetimeEarned: pointBalance?.totalEarned || 0,
        lifetimeUsed: pointBalance?.totalUsed || 0,
        transactions,
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
  submitWebReceipt: publicProcedure
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
          
          // Check file size (max 10MB)
          if (buffer.length > 10 * 1024 * 1024) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "画像サイズが大きすぎます（最大10MB）",
            });
          }
          
          const imageHash = crypto.createHash("sha256").update(buffer).digest("hex");
          
          // Check duplicate by hash
          const { checkDuplicateLineReceiptByHash } = await import("./db");
          const duplicate = await checkDuplicateLineReceiptByHash(imageHash);
          if (duplicate) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "この画像は既に登録されています。別のレシートをアップロードしてください。",
            });
          }
          
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
        
        // Run AI analysis using S3 URLs (not Base64 - much better success rate)
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
          text: `これらの${uploadedImages.length}枚の画像はTikTok Shopの注文詳細画面のスクリーンショットです。\nすべての画像を統合して、以下の情報を抽出してください。\n情報が複数の画像に分散している場合は、すべての画像から情報を収集してください。`,
        });
        
        const ocrResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `あなたはTikTok Shopの注文詳細画面のスクリーンショットを解析するAIです。
複数の画像が送信された場合、すべての画像を統合して情報を抽出してください。

以下の情報を抽出してJSON形式で返してください：

{
  "isTikTokShop": true/false,
  "isDelivered": true/false,
  "orderNumber": "string",
  "totalAmount": number,
  "orderDate": "string",
  "shopName": "string",
  "productName": "string"
}

【配達済みの判定基準】
以下のいずれかが確認できれば isDelivered = true としてください：
- 「配達済み」という文字
- 「X月X日に配達」（例：「1月28日に配達」）
- 「お荷物が最終目的地に到着しました」
- 「已签收」「Delivered」
- 配達ステータスのプログレスバーで最後のステップが完了している

【重要】
- 抽出できない項目はnullを返してください
- 必ずJSON形式のみで回答してください（説明文は不要）
- 複数画像から情報を統合してください`,
            },
            {
              role: "user",
              content: imageContents,
            },
          ],
        });
        
        const messageContent = ocrResult.choices[0].message.content;
        let ocrData: any;
        try {
          let jsonStr = typeof messageContent === "string" ? messageContent : "{}";
          if (jsonStr.includes("```json")) {
            jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");
          } else if (jsonStr.includes("```")) {
            jsonStr = jsonStr.replace(/```\s*/g, "");
          }
          jsonStr = jsonStr.trim();
          ocrData = JSON.parse(jsonStr);
        } catch (parseError: any) {
          // AI analysis failed - return partial result
          return {
            receiptId,
            status: "analysis_failed" as const,
            message: "画像の解析に失敗しました。画像が鮮明であることを確認して、再度お試しください。",
            imageUrls: uploadedImages.map(i => i.url),
          };
        }
        
        // Validate TikTok Shop
        if (!ocrData.isTikTokShop) {
          const { deleteLineReceipt } = await import("./db");
          await deleteLineReceipt(receiptId);
          return {
            receiptId: null,
            status: "not_tiktok" as const,
            message: "TikTok Shopの注文詳細画面ではないようです。TikTok Shopの注文詳細画面のスクリーンショットをアップロードしてください。",
            imageUrls: uploadedImages.map(i => i.url),
          };
        }
        
        // Validate delivery status
        if (!ocrData.isDelivered) {
          const { deleteLineReceipt } = await import("./db");
          await deleteLineReceipt(receiptId);
          return {
            receiptId: null,
            status: "not_delivered" as const,
            message: "この注文はまだ配達済みになっていません。商品が配達された後に再度申請してください。",
            ocrData,
            imageUrls: uploadedImages.map(i => i.url),
          };
        }
        
        // Validate required fields
        if (!ocrData.orderNumber || !ocrData.totalAmount) {
          const { deleteLineReceipt } = await import("./db");
          await deleteLineReceipt(receiptId);
          return {
            receiptId: null,
            status: "incomplete" as const,
            message: "注文番号または金額を読み取れませんでした。注文番号と金額が見える画像をアップロードしてください。",
            ocrData,
            imageUrls: uploadedImages.map(i => i.url),
          };
        }
        
        // Calculate points (1% return)
        const pointsCalculated = Math.floor(ocrData.totalAmount * 0.01);
        
        // Update receipt with OCR data
        const { updateLineReceiptOcr } = await import("./db");
        await updateLineReceiptOcr(receiptId, {
          storeName: ocrData.shopName || "TikTok Shop",
          purchaseDate: ocrData.orderDate ? new Date(ocrData.orderDate) : undefined,
          totalAmount: ocrData.totalAmount,
          currency: "JPY",
          ocrRawText: JSON.stringify(ocrData),
          pointsCalculated,
          imageUrls: uploadedImages.map(i => i.url),
          imageKeys: uploadedImages.map(i => i.key),
        });
        
        // Fraud detection
        const fraudFlags: string[] = [];
        let fraudScore = 0;
        
        // Check order date expiry (30 days)
        if (ocrData.orderDate) {
          const orderDate = new Date(ocrData.orderDate);
          const daysSinceOrder = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceOrder > 30) {
            fraudFlags.push("expired_order");
            fraudScore += 50;
          }
        }
        
        // Check duplicate order number globally
        const { checkDuplicateOrderNumberGlobal } = await import("./db");
        const duplicateOrder = await checkDuplicateOrderNumberGlobal(ocrData.orderNumber, receiptId);
        if (duplicateOrder) {
          fraudFlags.push("duplicate_order");
          fraudScore += 100;
          
          const { deleteLineReceipt } = await import("./db");
          await deleteLineReceipt(receiptId);
          
          const isSameUser = duplicateOrder.lineUserId === lineUserId;
          return {
            receiptId: null,
            status: "duplicate" as const,
            message: isSameUser
              ? `この注文は既にポイント申請済みです。注文番号: ${ocrData.orderNumber}`
              : `この注文番号は既に他の方が申請済みです。注文番号: ${ocrData.orderNumber}`,
            ocrData,
            imageUrls: uploadedImages.map(i => i.url),
          };
        }
        
        // Check high amount
        if (ocrData.totalAmount > 50000) {
          fraudFlags.push("high_amount");
          fraudScore += 20;
        }
        
        // Update fraud flags
        if (fraudFlags.length > 0) {
          const { updateLineReceiptFraudFlags, updateLineReceiptStatus } = await import("./db");
          await updateLineReceiptFraudFlags(receiptId, fraudFlags, fraudScore);
          
          if (fraudScore >= 50) {
            await updateLineReceiptStatus(receiptId, "on_hold", 0, "自動保留: 不正検知スコアが高いため");
          }
        }
        
        return {
          receiptId,
          status: fraudScore >= 50 ? "on_hold" as const : "success" as const,
          message: fraudScore >= 50
            ? "注文を確認中です。スタッフが確認後、結果をお知らせします。"
            : "レシートの解析が完了しました！スタッフの確認後、ポイントが付与されます。",
          ocrData: {
            orderNumber: ocrData.orderNumber,
            shopName: ocrData.shopName || "TikTok Shop",
            productName: ocrData.productName,
            totalAmount: ocrData.totalAmount,
            orderDate: ocrData.orderDate,
          },
          pointsCalculated,
          imageUrls: uploadedImages.map(i => i.url),
          fraudFlags: fraudFlags.length > 0 ? fraudFlags : undefined,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error("[Web Receipt] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "レシートの処理中にエラーが発生しました。しばらくしてからもう一度お試しください。",
        });
      }
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
        })
      )
      .mutation(async ({ input }) => {
        const { id, joinDate, birthDate, resignDate, ...rest } = input;
        const updateData: any = { ...rest };
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
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        return await updateBrand(id, updateData);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrand(input.id);
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
        });
        
        // Record edit log
        const dateStr = new Date(input.livestreamDate).toLocaleDateString('ja-JP');
        await logBrandEdit(
          input.brandId,
          "create",
          "livestream",
          livestream.id,
          `${dateStr} ${resolvedStreamerName}`,
          `ライブ配信を追加：${dateStr} ${resolvedStreamerName}`,
          ctx.user.id,
          ctx.user.name || ctx.user.email
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
    importProductCsv: protectedProcedure
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
          importedBy: ctx.user.id,
          importedByName: ctx.user.name || ctx.user.email,
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
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          status: z.enum(["契約中", "完了", "保留", "終了"]).default("契約中"),
          memo: z.string().optional(),
          plannedLivestreamCount: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const contract = await createBrandContract({
          ...input,
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
  }),

  // AI Advice Router (日報AIアドバイス)
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
            .where(eq(brands.id, user.brandId))
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
          brandId: z.number().optional(), // ブランドID
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
          brandId: input.brandId,
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
        
        // Check if user owns this schedule (by matching liverName with user name)
        if (schedule.liverName !== userName) {
          throw new TRPCError({ code: "FORBIDDEN", message: "この予定を編集する権限がありません" });
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
        
        // Check if user owns this schedule (by matching liverName with user name)
        if (schedule.liverName !== userName) {
          throw new TRPCError({ code: "FORBIDDEN", message: "この予定を削除する権限がありません" });
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

  // Liver (Streamer) Authentication Router
  liver: liverRouter,

  // Liver Management Router (ライバー管理画面用)
  liverManagement: router({
    // Get all livers (simple list without stats)
    list: protectedProcedure
      .query(async () => {
        return await getAllLivers();
      }),

    // Get all livers with stats for a given month (public - ログイン不要)
    listWithStats: publicProcedure
      .input(z.object({ month: z.string() })) // format: "YYYY-MM"
      .query(async ({ input }) => {
        return await getLiversWithStats(input.month);
      }),

    // Get liver rankings (sales and duration) (public - ログイン不要)
    rankings: publicProcedure
      .input(z.object({ month: z.string() }))
      .query(async ({ input }) => {
        return await getLiverRankings(input.month);
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
        
        return { ...livestream, brand, liver };
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
      .input(z.object({ month: z.string() }))
      .query(async ({ input }) => {
        return await getTotalLiverSalesSummary(input.month);
      }),

    // Get monthly sales trend for all livers (public - ログイン不要)
    monthlySalesTrend: publicProcedure
      .query(async () => {
        return await getLiverMonthlySalesTrend();
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
      }))
      .query(async ({ input }) => {
        return await getLiverBrandPerformance(input.liverId);
      }),

    // Get top selling products by liver (ライバー別売れ筋商品ランキング)
    getTopProducts: publicProcedure
      .input(z.object({
        liverId: z.number(),
        limit: z.number().optional().default(20),
      }))
      .query(async ({ input }) => {
        return await getTopProductsByLiver(input.liverId, input.limit);
      }),

    // Get liver category analysis (ライバー別得意カテゴリ分析)
    getCategoryAnalysis: publicProcedure
      .input(z.object({
        liverId: z.number(),
      }))
      .query(async ({ input }) => {
        return await getLiverCategoryAnalysis(input.liverId);
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
          })).min(1),
        })).optional(),
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
        });
        const id = livestreamResult.id;
        
        // Send LINE notification if liver has LINE connected and notifications enabled
        let lineNotificationSent = false;
        if (liver?.lineUserId && liver?.lineNotificationEnabled !== false) {
          try {
            const result = await sendCoachingToLiver(
              liver.lineUserId,
              liver.name,
              input.salesAmount || 0,
              input.structuredAdvice || null,
              input.calculatedMetrics as Record<string, string | number> | null | undefined,
              input.aiAdvice
            );
            lineNotificationSent = result.success;
            if (!result.success) {
              console.error("[LINE Coaching] Failed to send:", result.error);
            }
          } catch (error) {
            console.error("[LINE Coaching] Exception:", error);
          }
        }
        
        // セット組みデータの保存
        if (input.sets && input.sets.length > 0) {
          for (let i = 0; i < input.sets.length; i++) {
            const set = input.sets[i];
            const totalOriginalPrice = set.items.reduce((sum, item) => sum + item.originalPrice, 0);
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
                  sortOrder: j,
                });
              }
            }
          }
        }
        
        return { id, lineNotificationSent };
      }),

    // Update livestream (配信履歴の編集) - public for liver self-service
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBrandLivestream(input.id);
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
        
        const { url } = await storagePut(key, buffer, contentType);
        return { url, key };
      }),

    // Analyze screenshot to extract livestream data
    analyzeScreenshot: publicProcedure
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

## 日時抽出ルール
- 画面上部の日時範囲から抽出
- 例: "Feb 04 16:00:54 - Feb 05 00:11:00" → startDateTime: "2026-02-04 16:00", endDateTime: "2026-02-05 00:11"
- 【重要】年が明示されていない場合は、必ず2026年としてください（現在は2026年2月です）
- 日付が1月、2月の場合は2026年、それ以外の月で過去の日付の場合は2025年の可能性があります

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
}

## 重要な注意事項
- 数値が見える場合は必ず抽出してください。nullや空にしないでください。
- 画像が不鮮明でも、見える数値は最善の推測で抽出してください。
- confidenceは、数値が明確に読み取れた場合は"high"、一部不明確な場合は"medium"、多くが不明確な場合は"low"としてください。
- 特にsalesAmount（GMV）は画面中央の最も大きな数字です。必ず抽出してください。`;

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
          
          // Ensure required fields exist with defaults
          return {
            salesAmount: parsed.salesAmount ?? null,
            viewerCount: parsed.viewerCount ?? null,
            peakViewerCount: parsed.peakViewerCount ?? null,
            productClicks: parsed.productClicks ?? null,
            orderCount: parsed.orderCount ?? null,
            durationMinutes: parsed.durationMinutes ?? null,
            startDateTime: parsed.startDateTime ?? null,
            endDateTime: parsed.endDateTime ?? null,
            rawData: parsed.rawData ?? {},
            confidence: parsed.confidence ?? "medium",
          };
        } catch (e) {
          console.error("Failed to parse analysis result:", content, e);
          throw new Error("Failed to parse analysis result");
        }
      }),

    // Generate advice based on livestream data
    generateAdvice: publicProcedure
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
              const avgSales = Math.round(recentStreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0) / recentStreams.length);
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
          const simpleAdvice = structured.improvements?.[0] 
            ? `${structured.improvements[0]}。具体的なアドバイス：「${structured.nextActions?.[0]?.action || '次回の配信で試してみましょう'}」`
            : content.trim();
          
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
- 【重要】年が明示されていない場合は、必ず2026年としてください（現在は2026年2月です）
- 日付が1月、2月の場合は2026年、それ以外の月で過去の日付の場合は2025年の可能性があります

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
    getAiMatchingSuggestions: publicProcedure
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
        return await createProductMaster(input);
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
      const { getOrCreatePointBalance } = await import("./db");
      const balance = await getOrCreatePointBalance(ctx.user.id);
      return balance;
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
        const { getAllReceipts } = await import("./db");
        const receipts = await getAllReceipts(input);
        return receipts;
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getReceiptById, updateReceiptStatus, awardPointsForReceipt } = await import("./db");
        const receipt = await getReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        if (receipt.status === "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "既に承認済みです" });
        }
        const pointsToAward = input.pointsOverride ?? receipt.pointsCalculated ?? 0;
        await updateReceiptStatus(input.id, "approved", ctx.user.id, input.note);
        if (pointsToAward > 0) {
          await awardPointsForReceipt(input.id, pointsToAward);
        }
        return { success: true, pointsAwarded: pointsToAward };
      }),
    
    // Reject receipt (admin only)
    adminRejectReceipt: protectedProcedure
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
        await updateReceiptStatus(input.id, "rejected", ctx.user.id, input.note);
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
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getAllLineReceipts } = await import("./db");
        const receipts = await getAllLineReceipts(input);
        return receipts;
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
    
    // Approve LINE receipt (admin only)
    adminApproveLineReceipt: protectedProcedure
      .input(z.object({
        id: z.number(),
        pointsOverride: z.number().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { getLineReceiptById, updateLineReceiptStatus, awardPointsForLineReceipt, getLinePointBalance } = await import("./db");
        const { pushMessage } = await import("./line");
        const receipt = await getLineReceiptById(input.id);
        if (!receipt) {
          throw new TRPCError({ code: "NOT_FOUND", message: "レシートが見つかりません" });
        }
        if (receipt.status === "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "既に承認済みです" });
        }
        const pointsToAward = input.pointsOverride ?? receipt.pointsCalculated ?? 0;
        await updateLineReceiptStatus(input.id, "approved", ctx.user.id, input.note);
        if (pointsToAward > 0) {
          await awardPointsForLineReceipt(input.id, pointsToAward);
        }
        
        // Send LINE notification to user
        try {
          const balance = await getLinePointBalance(receipt.lineUserId);
          const newBalance = balance?.balance ?? pointsToAward;
          const storeName = receipt.storeName || "不明";
          const amount = receipt.totalAmount ? `¥${receipt.totalAmount.toLocaleString()}` : "不明";
          
          const appUrl = process.env.APP_URL || "https://lcjmall.com";
          const message = `🎉 レシートが承認されました！\n\n🏪 店舗名: ${storeName}\n💰 購入金額: ${amount}\n⭐ 獲得ポイント: ${pointsToAward}ポイント\n\n📊 現在の残高: ${newBalance}ポイント\n\nご利用ありがとうございます！\n\n📋 ポイント履歴を確認する\n${appUrl}/mypage`;
          
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
        note: z.string(),
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
        await updateLineReceiptStatus(input.id, "rejected", ctx.user.id, input.note);
        
        // Send LINE notification to user
        try {
          const storeName = receipt.storeName || "不明";
          const reason = input.note || "理由は記載されていません";
          
          const appUrl = process.env.APP_URL || "https://lcjmall.com";
          const message = `❌ レシートが却下されました\n\n🏪 店舗名: ${storeName}\n\n📝 却下理由:\n${reason}\n\n正しいレシート画像を再度送信してください。\n\n📋 マイページで確認する\n${appUrl}/mypage`;
          
          await pushMessage(receipt.lineUserId, [{ type: "text", text: message }]);
          console.log(`[LINE Receipt] Sent rejection notification to ${receipt.lineUserId}`);
        } catch (notifyError) {
          console.error("[LINE Receipt] Failed to send rejection notification:", notifyError);
          // Don't throw - notification failure shouldn't fail the rejection
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
        return { success: true };
      }),
    
    // Get LINE receipt statistics (admin only)
    adminGetLineStatistics: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
      }
      const { getLineReceiptStatistics } = await import("./db");
      return await getLineReceiptStatistics();
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

    // 商品作成（管理者のみ）
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        await createMallProduct(input);
        return { success: true };
      }),

    // 商品更新（管理者のみ）
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
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        const { id, ...data } = input;
        await updateMallProduct(id, data);
        return { success: true };
      }),

    // 商品削除（管理者のみ）
    deleteProduct: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        await deleteMallProduct(input.id);
        return { success: true };
      }),

    // 注文一覧取得（管理者のみ）
    getOrders: protectedProcedure
      .input(z.object({
        status: z.enum(["pending", "paid", "confirmed", "shipped", "delivered", "cancelled", "refunded"]).optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        return await getMallOrders(input);
      }),

    // 注文詳細取得（管理者のみ）
    getOrderById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        return await getMallOrderById(input.id);
      }),

    // 注文ステータス更新（管理者のみ）
    updateOrderStatus: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["pending", "paid", "confirmed", "shipped", "delivered", "cancelled", "refunded"]),
        adminNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
        await updateMallOrderStatus(input.id, input.status, input.adminNotes);
        return { success: true };
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

    // 公開商品一覧取得（アクティブな商品のみ）
    getPublicProducts: publicProcedure.query(async () => {
      return await getMallProducts({ status: "active" });
    }),

    // ポイントで商品購入
    purchaseWithPoints: publicProcedure
      .input(z.object({
        productId: z.number(),
        quantity: z.number().min(1).default(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // LINEセッションからユーザー情報を取得
        const result = await getLineUserFromSession(ctx);
        if (!result || !result.lineUser) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ログインが必要です" });
        }
        const lineUserId = result.lineUser.lineUserId;
        if (!lineUserId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ポイント購入にはLINEアカウントの連携が必要です" });
        }

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

        const totalPoints = product.pointPrice * input.quantity;

        // ポイント残高を確認
        const balance = await getLinePointBalance(lineUserId);
        if (!balance || balance.balance < totalPoints) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "ポイントが不足しています" });
        }

        // ポイントを消費
        await useLinePoints(lineUserId, totalPoints, `商品購入: ${product.name}`);

        // 在庫を減らす
        await updateMallProduct(product.id, { stock: product.stock - input.quantity });

        return { success: true, pointsUsed: totalPoints };
      }),

    // 商品画像アップロード（管理者のみ）
    uploadProductImage: protectedProcedure
      .input(z.object({
        base64: z.string(),
        filename: z.string(),
        productId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }

        const buffer = Buffer.from(input.base64, "base64");
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
        
        const { url } = await storagePut(key, buffer, contentType);
        
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
      }),

    // 商品画像の並び替え・削除（管理者のみ）
    updateProductImages: protectedProcedure
      .input(z.object({
        productId: z.number(),
        imageUrls: z.array(z.string()),
        imageKeys: z.array(z.string()),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "管理者権限が必要です" });
        }
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

        // 重複注文番号チェック
        const exists = await checkOrderNumberExists(input.orderNumber);
        if (exists) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "この注文番号は既に申請済みです。" 
          });
        }

        // レシート画像をS3にアップロード
        const receiptBuffer = Buffer.from(input.receiptImage.base64, "base64");
        const receiptExt = input.receiptImage.mimeType.split("/")[1] || "png";
        const receiptKey = `point-requests/${ctx.user.id}/${nanoid()}-receipt.${receiptExt}`;
        const { url: receiptUrl } = await storagePut(receiptKey, receiptBuffer, input.receiptImage.mimeType);

        // 配達済み画像をS3にアップロード（任意）
        let deliveryUrl: string | undefined;
        let deliveryKey: string | undefined;
        if (input.deliveryImage) {
          const deliveryBuffer = Buffer.from(input.deliveryImage.base64, "base64");
          const deliveryExt = input.deliveryImage.mimeType.split("/")[1] || "png";
          deliveryKey = `point-requests/${ctx.user.id}/${nanoid()}-delivery.${deliveryExt}`;
          const result = await storagePut(deliveryKey, deliveryBuffer, input.deliveryImage.mimeType);
          deliveryUrl = result.url;
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
        return balance || { balance: 0, totalEarned: 0, totalUsed: 0 };
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

        return { success: true, pointsApproved: pointsToApprove };
      }),

    // 申請を却下
    reject: protectedProcedure
      .input(z.object({
        requestId: z.number(),
        reason: z.string().min(1, "却下理由を入力してください"),
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
      .input(z.object({ brandId: z.number() }))
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

    // 全体サマリー
    getSummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return getTiktokFinanceSummary(input.brandId);
      }),

    // クリエイター別サマリー
    getCreatorSummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return getTiktokCreatorSummary(input.brandId);
      }),

    // ショップ別サマリー
    getShopSummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return getTiktokShopSummary(input.brandId);
      }),

    // 商品別サマリー
    getProductSummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return getTiktokProductSummary(input.brandId);
      }),

    // 日別推移
    getDailySummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return getTiktokDailySummary(input.brandId);
      }),

    // コンテンツタイプ別
    getContentTypeSummary: protectedProcedure
      .input(z.object({ brandId: z.number() }))
      .query(async ({ input }) => {
        return getTiktokContentTypeSummary(input.brandId);
      }),

    // 注文明細一覧（ページネーション付き）
    getOrders: protectedProcedure
      .input(z.object({
        brandId: z.number(),
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
          })).min(1),
        })),
      }))
      .mutation(async ({ input }) => {
        // Delete existing sets for this livestream first
        await deleteLivestreamSetsByLivestreamId(input.livestreamId);
        
        // Create new sets
        for (let i = 0; i < input.sets.length; i++) {
          const set = input.sets[i];
          const totalOriginalPrice = set.items.reduce((sum, item) => sum + item.originalPrice, 0);
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

    // セット分析: 特定ライバーのセット戦略詳細（ライバー個別ページ用）
    liverSetAnalysis: publicProcedure
      .input(z.object({ liverId: z.number() }))
      .query(async ({ input }) => {
        return await getLiverSetAnalysis(input.liverId);
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

