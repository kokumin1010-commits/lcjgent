import { eq, and, desc, asc, sql, or, like, inArray, notInArray, not, isNotNull, isNull, gte, lte, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, staff, InsertStaff, tasks, InsertTask, reminders, InsertReminder, taskStaff, InsertTaskStaff, emailTracking, InsertEmailTracking, reportStaff, InsertReportStaff, reports, InsertReport, brands, InsertBrand, brandProducts, InsertBrandProduct, brandActivities, InsertBrandActivity, brandLivestreams, InsertBrandLivestream, reportFollowups, InsertReportFollowup, businessCards, InsertBusinessCard, brandLcjStaff, InsertBrandLcjStaff, activityLogs, InsertActivityLog, brandContracts, InsertBrandContract, reportAiAdvice, InsertReportAiAdvice, aiAdviceFeedback, InsertAiAdviceFeedback, aiLearningExamples, InsertAiLearningExample, chatReportSessions, InsertChatReportSession, chatReportMessages, InsertChatReportMessage, staffAiProfiles, InsertStaffAiProfile, aiQuestionTemplates, InsertAiQuestionTemplate, lineUsers, InsertLineUser, lineGroups, InsertLineGroup, lineMessages, InsertLineMessage, lineFollowUps, InsertLineFollowUp, schedules, InsertSchedule, livers, InsertLiver, livestreamProducts, InsertLivestreamProduct, brandMemos, InsertBrandMemo, contractLivestreamLinks, InsertContractLivestreamLink, brandEditLogs, InsertBrandEditLog, brandProductImages, InsertBrandProductImage, brandFiles, InsertBrandFile, productLinks, InsertProductLink, csvImportHistory, InsertCsvImportHistory, livestreamCsvImportHistory, InsertLivestreamCsvImportHistory, adProposalHistory, InsertAdProposalHistory, pointBalances, InsertPointBalance, pointTransactions, InsertPointTransaction, receipts, InsertReceipt, fraudDetectionLogs, InsertFraudDetectionLog, linePointBalances, InsertLinePointBalance, linePointTransactions, InsertLinePointTransaction, lineReceipts, InsertLineReceipt, lineFraudDetectionLogs, InsertLineFraudDetectionLog, mallProducts, InsertMallProduct, mallBrands, InsertMallBrand, mallCategories, InsertMallCategory, mallOrders, InsertMallOrder, mallOrderItems, InsertMallOrderItem, mallCarts, InsertMallCart, userAddresses, InsertUserAddress, linePasswordResetTokens, InsertLinePasswordResetToken, lineLinkCodes, InsertLineLinkCode, screenshotAnalysisHistory, InsertScreenshotAnalysisHistory, pointRequests, InsertPointRequest, passwordResetTokens, InsertPasswordResetToken, scheduleGroups, InsertScheduleGroup, scheduleGroupMembers, InsertScheduleGroupMember, liverPasswordResetTokens, InsertLiverPasswordResetToken, productLivers, InsertProductLiver, lineReminders, InsertLineReminder, liverGoals, InsertLiverGoal, productMaster, InsertProductMaster, productNameAliases, InsertProductNameAlias, productAliasSuggestions, InsertProductAliasSuggestion, adCampaigns, InsertAdCampaign, adMetrics, InsertAdMetric, adCountryBreakdown, InsertAdCountryBreakdown, adReportFiles, InsertAdReportFile, tiktokCommissionOrders, InsertTiktokCommissionOrder, tiktokCsvImportHistory, InsertTiktokCsvImportHistory, livestreamSets, InsertLivestreamSet, livestreamSetItems, InsertLivestreamSetItem, productCategoryMappings, InsertProductCategoryMapping, simulations, InsertSimulation, simulationFeedback, InsertSimulationFeedback, mallProductReviews, InsertMallProductReview, mallProductDescImages, InsertMallProductDescImage, referralCodes, InsertReferralCode, referralHistory, InsertReferralHistory, mallFavorites, InsertMallFavorite, mallViewHistory, InsertMallViewHistory, receiptReviewLogs, InsertReceiptReviewLog, aitherhubSyncLogs, InsertAitherhubSyncLog, productRestockRequests, InsertProductRestockRequest, receiptProducts, InsertReceiptProduct, referralCampaigns, campaignStages, userReferralProgress, friendReferrals, spinRewardTables, spinRewardItems, userSpinHistory, referralActivityFeed, blogCategories, InsertBlogCategory, blogTags, InsertBlogTag, blogArticles, InsertBlogArticle, blogArticleTags, InsertBlogArticleTag, autoPostSchedules, InsertAutoPostSchedule, presetKeywords, InsertPresetKeyword, autoPostLogs, InsertAutoPostLog, receiptKakuhenResults, InsertReceiptKakuhenResult, receiptReviews, InsertReceiptReview, reviewReactions, InsertReviewReaction, reviewQuestions, InsertReviewQuestion, bwLinkedAccounts, InsertBwLinkedAccount, pointExchanges, InsertPointExchange, aiReviewFeedback, InsertAiReviewFeedback, aiAutoReviewLogs, InsertAiAutoReviewLog, aiAutoApproveSettings, aiReceiptLearningExamples, popupVariants, popupImpressions, popupClicks, blogArticleSeoMetrics, InsertBlogArticleSeoMetric, blogArticleStats, InsertBlogArticleStat, blogArticleThemeLog, InsertBlogArticleThemeLogEntry, livestreamBrands, InsertLivestreamBrand, brandAdditionLogs, InsertBrandAdditionLog, tiktokPayments, InsertTiktokPayment, tiktokTapReports, InsertTiktokTapReport, tiktokTapLiveReports, InsertTiktokTapLiveReport, tiktokTapVideoReports, InsertTiktokTapVideoReport, stepEmailTemplates, InsertStepEmailTemplate, stepEmailLogs, InsertStepEmailLog, stepEmailClicks, InsertStepEmailClick, brandSampleApplications, InsertBrandSampleApplication, abTestEvents, InsertAbTestEvent, streamingLocations, InsertStreamingLocation, tspContracts, InsertTspContract, tspInvoices, InsertTspInvoice, tiktokCapCreatorReports, InsertTiktokCapCreatorReport, tiktokCapProductReports, InsertTiktokCapProductReport } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// JST (UTC+9) based month date range helper
// Returns UTC dates that correspond to JST month boundaries
// e.g., "2026-02" -> startDate = 2026-01-31T15:00:00Z (= JST 2/1 00:00), endDate = 2026-02-28T14:59:59Z (= JST 2/28 23:59:59)
function getJSTMonthRange(month: string): { startDate: Date; endDate: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  // JST month start: 1st day of month at 00:00 JST = previous day at 15:00 UTC
  const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
  // JST month end: last day of month at 23:59:59 JST = last day at 14:59:59 UTC
  const lastDay = new Date(year, monthNum, 0).getDate(); // last day of month
  const endDate = new Date(Date.UTC(year, monthNum - 1, lastDay, 23, 59, 59) - 9 * 60 * 60 * 1000);
  return { startDate, endDate };
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// User management functions
export async function createUser(userData: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(users).values(userData);
  return result;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// Staff management functions
export async function createStaff(staffData: InsertStaff) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(staff).values(staffData);
  return result;
}

export async function getAllStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(staff).orderBy(desc(staff.createdAt));
}

export async function getActiveStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(staff).where(eq(staff.isActive, "active")).orderBy(staff.name);
}

export async function getStaffById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStaff(id: number, staffData: Partial<InsertStaff>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(staff).set(staffData).where(eq(staff.id, id));
}

export async function deleteStaff(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(staff).where(eq(staff.id, id));
}

// Task management functions
export async function createTask(taskData: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert and return the inserted row
  const [insertedTask] = await db.insert(tasks).values(taskData).$returningId();
  
  // Fetch the complete task record
  if (insertedTask && insertedTask.id) {
    const result = await db.select().from(tasks).where(eq(tasks.id, insertedTask.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  
  return null;
}

export async function getAllTasks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .orderBy(desc(tasks.createdAt));
}

export async function getAllTasksWithUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .orderBy(desc(tasks.createdAt));
}

export async function getTasksByStatus(status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.status, status as any))
    .orderBy(desc(tasks.createdAt));
}

export async function getTasksByStaffId(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.staffId, staffId))
    .orderBy(desc(tasks.createdAt));
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getTaskByTaskId(taskId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.taskId, taskId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getTaskByCompletionToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.completionToken, token))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateTask(id: number, taskData: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(tasks).set(taskData).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(tasks).where(eq(tasks.id, id));
}

export async function searchTasks(searchTerm: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(
      or(
        like(tasks.taskDetail, `%${searchTerm}%`),
        like(tasks.extractedContext, `%${searchTerm}%`),
        like(staff.name, `%${searchTerm}%`)
      )
    )
    .orderBy(desc(tasks.createdAt));
}

export async function getInProgressTasks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.status, "in_progress"))
    .orderBy(desc(tasks.createdAt));
}

// Reminder management functions
export async function createReminder(reminderData: InsertReminder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(reminders).values(reminderData);
  return result;
}

export async function getRemindersByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(reminders)
    .where(eq(reminders.taskId, taskId))
    .orderBy(desc(reminders.sentAt));
}

// Dashboard statistics functions
export async function getTaskStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks);
  const pendingTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "pending"));
  const inProgressTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "in_progress"));
  const completedTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "completed"));

  return {
    total: totalTasks[0]?.count || 0,
    pending: pendingTasks[0]?.count || 0,
    inProgress: inProgressTasks[0]?.count || 0,
    completed: completedTasks[0]?.count || 0,
  };
}

export async function getAverageCompletionTime() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const completedTasksWithTime = await db
    .select({
      startDate: tasks.startDate,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(and(eq(tasks.status, "completed"), sql`${tasks.completedAt} IS NOT NULL`));

  if (completedTasksWithTime.length === 0) return 0;

  const totalTime = completedTasksWithTime.reduce((sum, task) => {
    if (task.startDate && task.completedAt) {
      return sum + (task.completedAt - task.startDate);
    }
    return sum;
  }, 0);

  return totalTime / completedTasksWithTime.length;
}

export async function getRecentCompletedTasks(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.status, "completed"))
    .orderBy(desc(tasks.completedAt))
    .limit(limit);
}

export async function getStaffWithTaskCounts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get only active staff
  const allStaff = await db.select().from(staff).where(eq(staff.isActive, "active"));
  const now = Date.now();
  
  const staffWithCounts = await Promise.all(
    allStaff.map(async (s) => {
      // Count in_progress tasks (not completed)
      const inProgressResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(eq(tasks.staffId, s.id), eq(tasks.status, "in_progress")));
      
      // Count overdue tasks (deadline passed and not completed)
      const overdueResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            eq(tasks.staffId, s.id),
            or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")),
            sql`UNIX_TIMESTAMP(${tasks.deadline}) * 1000 < ${now}`
          )
        );
      
      const inProgressCount = Number(inProgressResult[0]?.count || 0);
      const overdueCount = Number(overdueResult[0]?.count || 0);
      
      return {
        ...s,
        inProgressCount,
        overdueCount,
      };
    })
  );

  return staffWithCounts;
}

export async function getOverdueTasks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = Date.now();
  
  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(
      and(
        or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")),
        sql`${tasks.deadline} < ${now}`
      )
    )
    .orderBy(asc(tasks.deadline));
}

// Task-Staff junction table functions
export async function assignStaffToTask(taskId: number, staffIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert multiple staff assignments
  const assignments = staffIds.map(staffId => ({
    taskId,
    staffId,
  }));

  return await db.insert(taskStaff).values(assignments);
}

export async function getStaffByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      staff: staff,
      assignedAt: taskStaff.assignedAt,
    })
    .from(taskStaff)
    .leftJoin(staff, eq(taskStaff.staffId, staff.id))
    .where(eq(taskStaff.taskId, taskId))
    .orderBy(taskStaff.assignedAt);
}

export async function removeStaffFromTask(taskId: number, staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .delete(taskStaff)
    .where(and(eq(taskStaff.taskId, taskId), eq(taskStaff.staffId, staffId)));
}

export async function removeAllStaffFromTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(taskStaff).where(eq(taskStaff.taskId, taskId));
}

// Email tracking functions
export async function createEmailTracking(trackingData: InsertEmailTracking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(emailTracking).values(trackingData);
  return result;
}

export async function getEmailTrackingByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(emailTracking)
    .where(eq(emailTracking.trackingToken, token))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getEmailTrackingByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(emailTracking)
    .where(eq(emailTracking.taskId, taskId))
    .orderBy(desc(emailTracking.createdAt));
}


// Report Staff management functions
export async function createReportStaff(data: InsertReportStaff) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inserted] = await db.insert(reportStaff).values(data).$returningId();
  if (inserted && inserted.id) {
    const result = await db.select().from(reportStaff).where(eq(reportStaff.id, inserted.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  return null;
}

export async function getAllReportStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reportStaff).orderBy(asc(reportStaff.name));
}

export async function getActiveReportStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reportStaff).where(eq(reportStaff.isActive, "active")).orderBy(asc(reportStaff.name));
}

export async function getReportStaffById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(reportStaff).where(eq(reportStaff.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateReportStaff(id: number, data: Partial<InsertReportStaff>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(reportStaff).set(data).where(eq(reportStaff.id, id));
}

export async function deleteReportStaff(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(reportStaff).where(eq(reportStaff.id, id));
}

export async function getReportStaffByCountry(country: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reportStaff)
    .where(and(eq(reportStaff.country, country), eq(reportStaff.isActive, "active")))
    .orderBy(asc(reportStaff.name));
}

// Report management functions
export async function createReport(reportData: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [insertedReport] = await db.insert(reports).values(reportData).$returningId();
  
  if (insertedReport && insertedReport.id) {
    const result = await db.select().from(reports).where(eq(reports.id, insertedReport.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  
  return null;
}

export async function getAllReports() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .orderBy(desc(reports.reportDate));
}

export async function getReportsByReportStaffId(reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .where(eq(reports.reportStaffId, reportStaffId))
    .orderBy(desc(reports.reportDate));
}

export async function getReportsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .where(
      and(
        sql`${reports.reportDate} >= ${startDate}`,
        sql`${reports.reportDate} <= ${endDate}`
      )
    )
    .orderBy(desc(reports.reportDate));
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .where(eq(reports.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateReport(id: number, reportData: Partial<InsertReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(reports).set(reportData).where(eq(reports.id, id));
}

export async function deleteReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(reports).where(eq(reports.id, id));
}

export async function getStaffReportStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all active report staff
  const allReportStaff = await db.select().from(reportStaff).where(eq(reportStaff.isActive, "active"));
  
  // Get current month date range
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const staffWithCounts = await Promise.all(
    allReportStaff.map(async (s) => {
      // Count reports for current month
      const monthlyResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(
          and(
            eq(reports.reportStaffId, s.id),
            sql`${reports.reportDate} >= ${firstDayOfMonth}`,
            sql`${reports.reportDate} <= ${lastDayOfMonth}`
          )
        );
      
      // Count total reports
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(eq(reports.reportStaffId, s.id));
      
      const monthlyCount = Number(monthlyResult[0]?.count || 0);
      const totalCount = Number(totalResult[0]?.count || 0);
      
      // Calculate days in month and expected reports
      const daysInMonth = lastDayOfMonth.getDate();
      const dayOfMonth = now.getDate();
      
      return {
        ...s,
        linkedStaffId: s.linkedStaffId,
        monthlyCount,
        totalCount,
        daysInMonth,
        dayOfMonth,
      };
    })
  );

  return staffWithCounts;
}

export async function searchReports(filters: {
  reportStaffId?: number;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  
  if (filters.reportStaffId) {
    conditions.push(eq(reports.reportStaffId, filters.reportStaffId));
  }
  
  if (filters.startDate) {
    conditions.push(sql`${reports.reportDate} >= ${filters.startDate}`);
  }
  
  if (filters.endDate) {
    conditions.push(sql`${reports.reportDate} <= ${filters.endDate}`);
  }
  
  if (filters.searchTerm) {
    conditions.push(
      or(
        like(reports.workContent, `%${filters.searchTerm}%`),
        like(reports.issues, `%${filters.searchTerm}%`),
        like(reports.remarks, `%${filters.searchTerm}%`)
      )
    );
  }

  const query = db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id));

  if (conditions.length > 0) {
    return await query.where(and(...conditions)).orderBy(desc(reports.reportDate));
  }

  return await query.orderBy(desc(reports.reportDate));
}

// Get reports for AI analysis (by date range and optionally by staff)
export async function getReportsForAnalysis(options: {
  startDate?: Date;
  endDate?: Date;
  reportStaffId?: number;
  country?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  
  if (options.startDate) {
    conditions.push(sql`${reports.reportDate} >= ${options.startDate}`);
  }
  if (options.endDate) {
    conditions.push(sql`${reports.reportDate} <= ${options.endDate}`);
  }
  if (options.reportStaffId) {
    conditions.push(eq(reports.reportStaffId, options.reportStaffId));
  }
  if (options.country) {
    conditions.push(eq(reportStaff.country, options.country));
  }

  const query = db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id));

  if (conditions.length > 0) {
    return await query.where(and(...conditions)).orderBy(desc(reports.reportDate));
  }

  return await query.orderBy(desc(reports.reportDate));
}


// ========== Brand Management Functions ==========

// Create a new brand
export async function createBrand(brandData: InsertBrand) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brands).values(brandData);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId || 0);
  
  // Return the created brand with id and name
  return {
    id: insertId,
    brandName: brandData.name,
  };
}

// Get all brands with optional filters and GMV totals
export async function getAllBrands(filters?: { status?: string; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(brands);
  
  const conditions: any[] = [isNull(brands.deletedAt)]; // ソフトデリート済みを除外
  if (filters?.status) {
    conditions.push(eq(brands.status, filters.status as any));
  }
  if (filters?.search) {
    // Case-insensitive fuzzy search across name, nameJa, and companyName
    const searchLower = filters.search.toLowerCase();
    conditions.push(
      or(
        sql`LOWER(${brands.name}) LIKE ${`%${searchLower}%`}`,
        sql`LOWER(${brands.nameJa}) LIKE ${`%${searchLower}%`}`,
        sql`LOWER(${brands.companyName}) LIKE ${`%${searchLower}%`}`,
      )!
    );
  }
  
  query = query.where(and(...conditions)) as any;
  
  const brandsResult = await query.orderBy(desc(brands.updatedAt));
  
  // Get GMV totals and contract totals for each brand
  const brandsWithStats = await Promise.all(
    brandsResult.map(async (brand) => {
      // Get GMV from livestreams
      const livestreams = await db
        .select({ gmv: brandLivestreams.gmv })
        .from(brandLivestreams)
        .where(and(eq(brandLivestreams.brandId, brand.id), isNull(brandLivestreams.deletedAt)));
      
      const totalGmv = livestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
      
      // Get total contract amount (fixedFee) from contracts (exclude soft-deleted)
      const contracts = await db
        .select({ fixedFee: brandContracts.fixedFee })
        .from(brandContracts)
        .where(and(eq(brandContracts.brandId, brand.id), isNull(brandContracts.deletedAt)));
      
      const totalAdBudget = contracts.reduce((sum, c) => sum + (c.fixedFee || 0), 0);
      
      return {
        ...brand,
        totalGmv,
        totalAdBudget,
      };
    })
  );
  
  return brandsWithStats;
}

// Get brand by ID
export async function getBrandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(brands).where(and(eq(brands.id, id), isNull(brands.deletedAt))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Update brand
export async function updateBrand(id: number, brandData: Partial<InsertBrand>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brands).set(brandData).where(eq(brands.id, id));
  return await getBrandById(id);
}

// Delete brand
export async function deleteBrand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const now = new Date();
  // ソフトデリート: 関連データも全て論理削除
  await db.update(brandProducts).set({ deletedAt: now }).where(and(eq(brandProducts.brandId, id), isNull(brandProducts.deletedAt)));
  await db.update(brandActivities).set({ deletedAt: now }).where(and(eq(brandActivities.brandId, id), isNull(brandActivities.deletedAt)));
  await db.update(brandContracts).set({ deletedAt: now }).where(and(eq(brandContracts.brandId, id), isNull(brandContracts.deletedAt)));
  await db.update(brandMemos).set({ deletedAt: now }).where(and(eq(brandMemos.brandId, id), isNull(brandMemos.deletedAt)));
  await db.update(brandFiles).set({ deletedAt: now }).where(and(eq(brandFiles.brandId, id), isNull(brandFiles.deletedAt)));
  await db.update(brandLivestreams).set({ deletedAt: now }).where(and(eq(brandLivestreams.brandId, id), isNull(brandLivestreams.deletedAt)));
  await db.update(brands).set({ deletedAt: now }).where(eq(brands.id, id));
}

// ========== Brand Products Functions ==========

// Create a new product
export async function createBrandProduct(productData: InsertBrandProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandProducts).values(productData);
  return { id: Number(result[0].insertId), ...productData };
}

// Get all products (for statistics)
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandProducts).where(isNull(brandProducts.deletedAt)).orderBy(desc(brandProducts.createdAt));
}

// Get products by brand ID
export async function getProductsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandProducts).where(and(eq(brandProducts.brandId, brandId), isNull(brandProducts.deletedAt))).orderBy(desc(brandProducts.createdAt));
}

// Get products by brand ID with GMV from linked livestreams
export async function getProductsByBrandIdWithGmv(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all products for the brand (exclude soft-deleted)
  const products = await db.select().from(brandProducts).where(and(eq(brandProducts.brandId, brandId), isNull(brandProducts.deletedAt))).orderBy(desc(brandProducts.createdAt));
  
  // Get all livestreams for the brand that have a productId
  const livestreams = await db.select().from(brandLivestreams).where(
    and(
      eq(brandLivestreams.brandId, brandId),
      isNotNull(brandLivestreams.productId),
      isNull(brandLivestreams.deletedAt)
    )
  );
  
  // Calculate GMV for each product
  const productGmvMap = new Map<number, number>();
  for (const ls of livestreams) {
    if (ls.productId && ls.gmv) {
      const currentGmv = productGmvMap.get(ls.productId) || 0;
      productGmvMap.set(ls.productId, currentGmv + Number(ls.gmv));
    }
  }
  
  // Add GMV to each product
  return products.map(product => ({
    ...product,
    totalGmv: productGmvMap.get(product.id) || 0,
  }));
}

// Get product by ID
export async function getBrandProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(brandProducts).where(and(eq(brandProducts.id, id), isNull(brandProducts.deletedAt))).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Update product
export async function updateBrandProduct(id: number, productData: Partial<InsertBrandProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandProducts).set(productData).where(eq(brandProducts.id, id));
}

// Delete product
export async function deleteBrandProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // ソフトデリート: deletedAtを設定して論理削除
  await db.update(brandProducts).set({ deletedAt: new Date() }).where(eq(brandProducts.id, id));
}

// ========== Brand Activities Functions ==========

// Create a new activity
export async function createBrandActivity(activityData: InsertBrandActivity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandActivities).values(activityData);
  return result;
}

// Get activities by brand ID
export async function getActivitiesByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandActivities).where(and(eq(brandActivities.brandId, brandId), isNull(brandActivities.deletedAt))).orderBy(desc(brandActivities.activityDate));
}

// Update activity
export async function updateBrandActivity(id: number, activityData: Partial<InsertBrandActivity>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandActivities).set(activityData).where(eq(brandActivities.id, id));
}

// Delete activity
export async function deleteBrandActivity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // ソフトデリート: deletedAtを設定して論理削除
  await db.update(brandActivities).set({ deletedAt: new Date() }).where(eq(brandActivities.id, id));
}

// Get brand statistics
export async function getBrandStatistics() {
  const db = await getDb();
  if (!db) return { total: 0, byStatus: {} };
  
  const allBrands = await db.select().from(brands).where(isNull(brands.deletedAt));
  
  const byStatus: Record<string, number> = {};
  allBrands.forEach(brand => {
    byStatus[brand.status] = (byStatus[brand.status] || 0) + 1;
  });
  
  return {
    total: allBrands.length,
    byStatus,
  };
}


// ========== Brand Livestream Functions ==========

// Create a new livestream record
export async function createBrandLivestream(livestreamData: InsertBrandLivestream) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandLivestreams).values(livestreamData);
  // 作成したIDを取得
  const insertId = (result as any)[0]?.insertId;
  return { id: insertId, ...livestreamData };
}

// Get livestreams by brand ID with product GMV totals
export async function getLivestreamsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const livestreams = await db.select().from(brandLivestreams).where(and(eq(brandLivestreams.brandId, brandId), isNull(brandLivestreams.deletedAt))).orderBy(desc(brandLivestreams.livestreamDate));
  
  // 各直播の商品別GMV合計を取得
  const livestreamsWithGmv = await Promise.all(
    livestreams.map(async (ls) => {
      const products = await db
        .select()
        .from(livestreamProducts)
        .where(eq(livestreamProducts.livestreamId, ls.id));
      
      const productGmvTotal = products.reduce((sum, p) => sum + (p.gmv || 0), 0);
      const productCount = products.length;
      
      return {
        ...ls,
        productGmvTotal,
        productCount,
      };
    })
  );
  
  return livestreamsWithGmv;
}

// Update livestream
export async function updateBrandLivestream(id: number, livestreamData: Partial<InsertBrandLivestream>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandLivestreams).set(livestreamData).where(eq(brandLivestreams.id, id));
}

// Delete livestream (soft delete)
export async function deleteBrandLivestream(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // ソフトデリート: deletedAtを設定して論理削除
  await db.update(brandLivestreams).set({ deletedAt: new Date() }).where(eq(brandLivestreams.id, id));
}

// Get all livestreams (for statistics)
export async function getAllLivestreams() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandLivestreams).where(isNull(brandLivestreams.deletedAt)).orderBy(desc(brandLivestreams.livestreamDate));
}

// Get livestream statistics for a brand
export async function getLivestreamStatsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return { totalSales: 0, totalStreams: 0, avgSales: 0 };
  
  const livestreams = await db.select().from(brandLivestreams).where(and(eq(brandLivestreams.brandId, brandId), isNull(brandLivestreams.deletedAt)));
  
  const totalSales = livestreams.reduce((sum, ls) => sum + (ls.salesAmount || 0), 0);
  const totalStreams = livestreams.length;
  const avgSales = totalStreams > 0 ? Math.round(totalSales / totalStreams) : 0;
  
  return { totalSales, totalStreams, avgSales };
}


// ========== Report Followup Functions ==========

// Create a new followup item
export async function createReportFollowup(followupData: InsertReportFollowup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db.insert(reportFollowups).values(followupData).$returningId();
  if (inserted && inserted.id) {
    const result = await db.select().from(reportFollowups).where(eq(reportFollowups.id, inserted.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  return null;
}

// Get all pending followups with optional staff filter
export async function getPendingFollowups(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(reportFollowups.status, "pending")];
  if (staffId) {
    conditions.push(eq(reportFollowups.reportStaffId, staffId));
  }
  
  return await db
    .select({
      followup: reportFollowups,
      staff: reportStaff,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reportStaff, eq(reportFollowups.reportStaffId, reportStaff.id))
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(and(...conditions))
    .orderBy(asc(reportFollowups.dueDate));
}

// Get overdue followups (due date passed and still pending) with optional staff filter
export async function getOverdueFollowups(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const conditions = [
    eq(reportFollowups.status, "pending"),
    sql`${reportFollowups.dueDate} < ${now}`
  ];
  if (staffId) {
    conditions.push(eq(reportFollowups.reportStaffId, staffId));
  }
  
  return await db
    .select({
      followup: reportFollowups,
      staff: reportStaff,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reportStaff, eq(reportFollowups.reportStaffId, reportStaff.id))
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(and(...conditions))
    .orderBy(asc(reportFollowups.dueDate));
}

// Update followup status
export async function updateFollowupStatus(
  id: number, 
  status: "pending" | "completed" | "cancelled", 
  resultCategory?: "成約" | "継続" | "保留" | "失注" | "完了",
  resultNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
    if (resultCategory) {
      updateData.resultCategory = resultCategory;
    }
    if (resultNote) {
      updateData.resultNote = resultNote;
      updateData.completedNote = resultNote; // 後方互換
    }
  }
  
  await db.update(reportFollowups).set(updateData).where(eq(reportFollowups.id, id));
}

// Get completed followups
export async function getCompletedFollowups(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(reportFollowups.status, "completed")];
  if (staffId) {
    conditions.push(eq(reportFollowups.reportStaffId, staffId));
  }
  
  return await db
    .select({
      followup: reportFollowups,
      staff: reportStaff,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reportStaff, eq(reportFollowups.reportStaffId, reportStaff.id))
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(and(...conditions))
    .orderBy(desc(reportFollowups.completedAt))
    .limit(50);
}

// Get followup by ID
export async function getFollowupById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(reportFollowups).where(eq(reportFollowups.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Link next action to current followup
export async function linkNextAction(currentId: number, nextActionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(reportFollowups).set({ nextActionId }).where(eq(reportFollowups.id, currentId));
}

// Get followups by report ID
export async function getFollowupsByReportId(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(reportFollowups).where(eq(reportFollowups.reportId, reportId)).orderBy(desc(reportFollowups.createdAt));
}

// Get followups by staff ID
export async function getFollowupsByStaffId(reportStaffId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      followup: reportFollowups,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(eq(reportFollowups.reportStaffId, reportStaffId))
    .orderBy(desc(reportFollowups.createdAt));
}

// Delete followup
export async function deleteReportFollowup(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(reportFollowups).where(eq(reportFollowups.id, id));
}

// Check if followup already exists for a report and extracted item
export async function checkExistingFollowup(reportId: number, extractedItem: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(reportFollowups)
    .where(
      and(
        eq(reportFollowups.reportId, reportId),
        eq(reportFollowups.extractedItem, extractedItem)
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}


// ============================================
// Business Card Management Functions
// ============================================

// Create a new business card
export async function createBusinessCard(data: InsertBusinessCard) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(businessCards).values(data);
  return result;
}

// Get business card by ID
export async function getBusinessCardById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(businessCards).where(eq(businessCards.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Get all business cards with optional filters
export async function getBusinessCards(options?: {
  registeredBy?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options?.registeredBy) {
    conditions.push(eq(businessCards.registeredBy, options.registeredBy));
  }
  
  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    conditions.push(
      or(
        like(businessCards.name, searchTerm),
        like(businessCards.company, searchTerm),
        like(businessCards.email, searchTerm),
        like(businessCards.phone, searchTerm)
      )
    );
  }
  
  let query = db.select().from(businessCards);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return await query
    .orderBy(desc(businessCards.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

// Check for duplicate business card by company + name hash
export async function checkDuplicateBusinessCard(duplicateHash: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(businessCards)
    .where(eq(businessCards.duplicateHash, duplicateHash))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Update business card
export async function updateBusinessCard(id: number, data: Partial<InsertBusinessCard>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(businessCards).set(data).where(eq(businessCards.id, id));
}

// Delete business card
export async function deleteBusinessCard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(businessCards).where(eq(businessCards.id, id));
}

// Get business card count
export async function getBusinessCardCount(registeredBy?: number) {
  const db = await getDb();
  if (!db) return 0;
  
  let query = db.select({ count: sql<number>`count(*)` }).from(businessCards);
  
  if (registeredBy) {
    query = query.where(eq(businessCards.registeredBy, registeredBy)) as typeof query;
  }
  
  const result = await query;
  return result[0]?.count || 0;
}


// ===== Brand LCJ Staff Management =====

// Get LCJ staff assigned to a brand
export async function getBrandLcjStaff(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select({
      id: brandLcjStaff.id,
      brandId: brandLcjStaff.brandId,
      reportStaffId: brandLcjStaff.reportStaffId,
      assignedAt: brandLcjStaff.assignedAt,
      staffName: reportStaff.name,
      staffCountry: reportStaff.country,
    })
    .from(brandLcjStaff)
    .leftJoin(reportStaff, eq(brandLcjStaff.reportStaffId, reportStaff.id))
    .where(eq(brandLcjStaff.brandId, brandId))
    .orderBy(asc(brandLcjStaff.assignedAt));
}

// Assign LCJ staff to a brand
export async function assignLcjStaffToBrand(brandId: number, reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if already assigned
  const existing = await db
    .select()
    .from(brandLcjStaff)
    .where(and(
      eq(brandLcjStaff.brandId, brandId),
      eq(brandLcjStaff.reportStaffId, reportStaffId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const [inserted] = await db.insert(brandLcjStaff).values({
    brandId,
    reportStaffId,
  }).$returningId();
  
  return inserted;
}

// Remove LCJ staff from a brand
export async function removeLcjStaffFromBrand(brandId: number, reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandLcjStaff).where(and(
    eq(brandLcjStaff.brandId, brandId),
    eq(brandLcjStaff.reportStaffId, reportStaffId)
  ));
}

// Set LCJ staff for a brand (replace all)
export async function setBrandLcjStaff(brandId: number, reportStaffIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Remove all existing assignments
  await db.delete(brandLcjStaff).where(eq(brandLcjStaff.brandId, brandId));
  
  // Add new assignments
  if (reportStaffIds.length > 0) {
    await db.insert(brandLcjStaff).values(
      reportStaffIds.map(reportStaffId => ({
        brandId,
        reportStaffId,
      }))
    );
  }
}

// Get brands by LCJ staff
export async function getBrandsByLcjStaff(reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const brandIds = await db
    .select({ brandId: brandLcjStaff.brandId })
    .from(brandLcjStaff)
    .where(eq(brandLcjStaff.reportStaffId, reportStaffId));
  
  if (brandIds.length === 0) return [];
  
  return await db
    .select()
    .from(brands)
    .where(and(inArray(brands.id, brandIds.map(b => b.brandId)), isNull(brands.deletedAt)))
    .orderBy(desc(brands.updatedAt));
}


// ============================================
// Activity Log Functions
// ============================================

// Create a new activity log
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(activityLogs).values(data);
  return result;
}

// Get recent activity logs
export async function getRecentActivityLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      log: activityLogs,
      user: users,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// Get activity logs by user
export async function getActivityLogsByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      log: activityLogs,
      user: users,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// Get all registered users (excluding test users with @example.com)
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users)
    .where(not(like(users.email, '%@example.com')))
    .orderBy(desc(users.createdAt));
}

// Get user activity statistics (excluding test users with @example.com)
export async function getUserActivityStats() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all users (excluding test users)
  const allUsers = await db.select().from(users)
    .where(not(like(users.email, '%@example.com')))
    .orderBy(desc(users.createdAt));
  
  // Get activity counts per user
  const activityCounts = await db
    .select({
      userId: activityLogs.userId,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(activityLogs)
    .groupBy(activityLogs.userId);
  
  // Combine data
  const countMap = new Map(activityCounts.map(a => [a.userId, a.count]));
  
  return allUsers.map(user => ({
    user,
    activityCount: countMap.get(user.id) || 0,
  }));
}


// ============================================
// Brand Contract Functions
// ============================================

// Create a new brand contract
export async function createBrandContract(data: InsertBrandContract) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandContracts).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get contracts by brand ID
export async function getContractsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandContracts)
    .where(and(eq(brandContracts.brandId, brandId), isNull(brandContracts.deletedAt)))
    .orderBy(desc(brandContracts.createdAt));
}

// Get contract by ID
export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(brandContracts)
    .where(and(eq(brandContracts.id, id), isNull(brandContracts.deletedAt)))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Update a brand contract
export async function updateBrandContract(id: number, data: Partial<InsertBrandContract>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandContracts).set(data).where(eq(brandContracts.id, id));
}

// Delete a brand contract (soft delete)
export async function deleteBrandContract(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // ソフトデリート: deletedAtを設定して論理削除
  // 関連のlivestreamLinksはそのまま残す（契約が論理削除されても配信履歴は保持）
  await db.update(brandContracts).set({ deletedAt: new Date() }).where(eq(brandContracts.id, id));
}

// Get all contracts (for statistics)
export async function getAllContracts() {
  const db = await getDb();
  if (!db) return [];
  
   return await db.select().from(brandContracts).where(isNull(brandContracts.deletedAt)).orderBy(desc(brandContracts.createdAt));
}
// Get active contracts count by brand ID
export async function getActiveContractsCount(brandId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(brandContracts)
    .where(and(
      eq(brandContracts.brandId, brandId),
      eq(brandContracts.status, "契約中"),
      isNull(brandContracts.deletedAt)
    ));
  
  return result[0]?.count || 0;
}


// ==========================================
// AI Advice Functions
// ==========================================

// Create AI advice for a report
export async function createReportAiAdvice(data: InsertReportAiAdvice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(reportAiAdvice).values(data);
  const insertId = result[0].insertId;
  return { id: insertId, ...data };
}

// Get AI advice by report ID
export async function getAiAdviceByReportId(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(reportAiAdvice)
    .where(eq(reportAiAdvice.reportId, reportId))
    .orderBy(desc(reportAiAdvice.createdAt));
}

// Get AI advice by ID
export async function getAiAdviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(reportAiAdvice)
    .where(eq(reportAiAdvice.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// ==========================================
// AI Advice Feedback Functions
// ==========================================

// Create feedback for AI advice
export async function createAiAdviceFeedback(data: InsertAiAdviceFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(aiAdviceFeedback).values(data);
}

// Get feedback by advice ID
export async function getFeedbackByAdviceId(adviceId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiAdviceFeedback)
    .where(eq(aiAdviceFeedback.adviceId, adviceId))
    .orderBy(desc(aiAdviceFeedback.createdAt));
}

// Check if user already gave feedback for an advice
export async function getUserFeedbackForAdvice(adviceId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(aiAdviceFeedback)
    .where(and(
      eq(aiAdviceFeedback.adviceId, adviceId),
      eq(aiAdviceFeedback.userId, userId)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Update existing feedback
export async function updateAiAdviceFeedback(id: number, data: Partial<InsertAiAdviceFeedback>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(aiAdviceFeedback).set(data).where(eq(aiAdviceFeedback.id, id));
}

// ==========================================
// AI Learning Examples Functions
// ==========================================

// Create or update learning example
export async function upsertAiLearningExample(data: {
  reportContent: string;
  adviceText: string;
  isGoodExample: "yes" | "no";
  category?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if similar example exists
  const existing = await db
    .select()
    .from(aiLearningExamples)
    .where(and(
      eq(aiLearningExamples.adviceText, data.adviceText),
      eq(aiLearningExamples.reportContent, data.reportContent)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing
    const example = existing[0];
    const newGoodCount = data.isGoodExample === "yes" ? example.goodCount + 1 : example.goodCount;
    const newBadCount = data.isGoodExample === "no" ? example.badCount + 1 : example.badCount;
    const newIsGoodExample = newGoodCount >= newBadCount ? "yes" : "no";
    
    await db.update(aiLearningExamples)
      .set({
        feedbackCount: example.feedbackCount + 1,
        goodCount: newGoodCount,
        badCount: newBadCount,
        isGoodExample: newIsGoodExample as "yes" | "no",
      })
      .where(eq(aiLearningExamples.id, example.id));
  } else {
    // Create new
    await db.insert(aiLearningExamples).values({
      reportContent: data.reportContent,
      adviceText: data.adviceText,
      isGoodExample: data.isGoodExample,
      feedbackCount: 1,
      goodCount: data.isGoodExample === "yes" ? 1 : 0,
      badCount: data.isGoodExample === "no" ? 1 : 0,
      category: data.category,
    });
  }
}

// Get good learning examples for AI prompt
export async function getGoodLearningExamples(limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiLearningExamples)
    .where(and(
      eq(aiLearningExamples.isGoodExample, "yes"),
      sql`${aiLearningExamples.goodCount} >= 2` // At least 2 good ratings
    ))
    .orderBy(desc(aiLearningExamples.goodCount))
    .limit(limit);
}

// Get bad learning examples to avoid
export async function getBadLearningExamples(limit: number = 3) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiLearningExamples)
    .where(and(
      eq(aiLearningExamples.isGoodExample, "no"),
      sql`${aiLearningExamples.badCount} >= 2` // At least 2 bad ratings
    ))
    .orderBy(desc(aiLearningExamples.badCount))
    .limit(limit);
}

// Get feedback statistics
export async function getAiFeedbackStats() {
  const db = await getDb();
  if (!db) return { totalFeedback: 0, goodCount: 0, badCount: 0 };
  
  const result = await db
    .select({
      totalFeedback: sql<number>`COUNT(*)`.as('totalFeedback'),
      goodCount: sql<number>`SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END)`.as('goodCount'),
      badCount: sql<number>`SUM(CASE WHEN rating = 'bad' THEN 1 ELSE 0 END)`.as('badCount'),
    })
    .from(aiAdviceFeedback);
  
  return result[0] || { totalFeedback: 0, goodCount: 0, badCount: 0 };
}



// ==========================================
// Chat Report Session Functions
// ==========================================

// Create a new chat report session
export async function createChatReportSession(data: InsertChatReportSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatReportSessions).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get chat session by ID
export async function getChatSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(chatReportSessions)
    .where(eq(chatReportSessions.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Get today's chat session for a staff
export async function getTodayChatSession(staffId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const result = await db
    .select()
    .from(chatReportSessions)
    .where(and(
      eq(chatReportSessions.staffId, staffId),
      sql`${chatReportSessions.reportDate} >= ${today}`,
      sql`${chatReportSessions.reportDate} < ${tomorrow}`
    ))
    .orderBy(desc(chatReportSessions.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Get chat sessions by staff ID
export async function getChatSessionsByStaffId(staffId: number, limit: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(chatReportSessions)
    .where(eq(chatReportSessions.staffId, staffId))
    .orderBy(desc(chatReportSessions.reportDate))
    .limit(limit);
}

// Update chat session status
export async function updateChatSessionStatus(
  id: number, 
  status: "in_progress" | "completed" | "converted",
  convertedReportId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { status };
  if (convertedReportId) {
    updateData.convertedReportId = convertedReportId;
  }
  
  await db.update(chatReportSessions).set(updateData).where(eq(chatReportSessions.id, id));
}

// ==========================================
// Chat Report Message Functions
// ==========================================

// Add a message to chat session
export async function addChatMessage(data: InsertChatReportMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatReportMessages).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get messages by session ID
export async function getMessagesBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(chatReportMessages)
    .where(eq(chatReportMessages.sessionId, sessionId))
    .orderBy(asc(chatReportMessages.createdAt));
}

// Get user messages from session (for report conversion)
export async function getUserMessagesFromSession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(chatReportMessages)
    .where(and(
      eq(chatReportMessages.sessionId, sessionId),
      eq(chatReportMessages.role, "user")
    ))
    .orderBy(asc(chatReportMessages.createdAt));
}

// ==========================================
// Staff AI Profile Functions
// ==========================================

// Get or create staff AI profile
export async function getOrCreateStaffAiProfile(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Try to get existing profile
  const existing = await db
    .select()
    .from(staffAiProfiles)
    .where(eq(staffAiProfiles.staffId, staffId))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Create new profile
  const result = await db.insert(staffAiProfiles).values({
    staffId,
    preferredQuestionStyle: "simple",
    strongAreas: [],
    improvementAreas: [],
    commonPatterns: {},
    totalReports: 0,
    totalChatSessions: 0,
    avgResponseLength: 0,
    goodFeedbackCount: 0,
    badFeedbackCount: 0,
  });
  
  const insertId = Number(result[0].insertId);
  const newProfile = await db
    .select()
    .from(staffAiProfiles)
    .where(eq(staffAiProfiles.id, insertId))
    .limit(1);
  
  return newProfile[0];
}

// Update staff AI profile
export async function updateStaffAiProfile(staffId: number, data: Partial<InsertStaffAiProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(staffAiProfiles).set(data).where(eq(staffAiProfiles.staffId, staffId));
}

// Increment staff chat session count
export async function incrementStaffChatCount(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const profile = await getOrCreateStaffAiProfile(staffId);
  await db.update(staffAiProfiles)
    .set({ totalChatSessions: profile.totalChatSessions + 1 })
    .where(eq(staffAiProfiles.staffId, staffId));
}

// Update staff feedback counts
export async function updateStaffFeedbackCounts(staffId: number, isGood: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const profile = await getOrCreateStaffAiProfile(staffId);
  if (isGood) {
    await db.update(staffAiProfiles)
      .set({ goodFeedbackCount: profile.goodFeedbackCount + 1 })
      .where(eq(staffAiProfiles.staffId, staffId));
  } else {
    await db.update(staffAiProfiles)
      .set({ badFeedbackCount: profile.badFeedbackCount + 1 })
      .where(eq(staffAiProfiles.staffId, staffId));
  }
}

// ==========================================
// AI Question Template Functions
// ==========================================

// Get question templates for a specific day
export async function getQuestionTemplatesForDay(dayOfWeek: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiQuestionTemplates)
    .where(and(
      eq(aiQuestionTemplates.isActive, true),
      or(
        eq(aiQuestionTemplates.dayOfWeek, dayOfWeek),
        sql`${aiQuestionTemplates.dayOfWeek} IS NULL`
      )
    ))
    .orderBy(desc(aiQuestionTemplates.priority));
}

// Get all active question templates
export async function getAllActiveQuestionTemplates() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiQuestionTemplates)
    .where(eq(aiQuestionTemplates.isActive, true))
    .orderBy(desc(aiQuestionTemplates.priority));
}

// Create question template
export async function createQuestionTemplate(data: InsertAiQuestionTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(aiQuestionTemplates).values(data);
  return { id: Number(result[0].insertId), ...data };
}

// Update question template usage count
export async function incrementQuestionUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const template = await db
    .select()
    .from(aiQuestionTemplates)
    .where(eq(aiQuestionTemplates.id, id))
    .limit(1);
  
  if (template.length > 0) {
    await db.update(aiQuestionTemplates)
      .set({ usageCount: template[0].usageCount + 1 })
      .where(eq(aiQuestionTemplates.id, id));
  }
}

// Update question template feedback
export async function updateQuestionFeedback(id: number, isGood: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const template = await db
    .select()
    .from(aiQuestionTemplates)
    .where(eq(aiQuestionTemplates.id, id))
    .limit(1);
  
  if (template.length > 0) {
    if (isGood) {
      await db.update(aiQuestionTemplates)
        .set({ goodFeedbackCount: template[0].goodFeedbackCount + 1 })
        .where(eq(aiQuestionTemplates.id, id));
    } else {
      await db.update(aiQuestionTemplates)
        .set({ badFeedbackCount: template[0].badFeedbackCount + 1 })
        .where(eq(aiQuestionTemplates.id, id));
    }
  }
}

// Get past reports for a staff (for context)
export async function getRecentReportsByStaffId(staffId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(reports)
    .where(eq(reports.reportStaffId, staffId))
    .orderBy(desc(reports.reportDate))
    .limit(limit);
}


// ============================================
// HR Integration Functions (staff <-> reportStaff linkage)
// ============================================

// Get reportStaff records linked to a staff ID
export async function getReportStaffByLinkedStaffId(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reportStaff)
    .where(eq(reportStaff.linkedStaffId, staffId));
}

// Get reports for a staff member via linkedStaffId
export async function getReportsByLinkedStaffId(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // First find reportStaff records linked to this staff
  const linkedReportStaff = await db.select().from(reportStaff)
    .where(eq(reportStaff.linkedStaffId, staffId));

  if (linkedReportStaff.length === 0) return [];

  const reportStaffIds = linkedReportStaff.map(rs => rs.id);

  return await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .where(inArray(reports.reportStaffId, reportStaffIds))
    .orderBy(desc(reports.reportDate));
}

// ============================================
// LINE Bot Database Functions
// ============================================

// Create or update LINE user
export async function createOrUpdateLineUser(data: {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  brandId?: number;
  staffId?: number;
  liverId?: number;
  userType?: "customer" | "staff" | "liver" | "unknown";
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if user exists
  const existing = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.lineUserId, data.lineUserId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing user
    await db
      .update(lineUsers)
      .set({
        displayName: data.displayName ?? existing[0].displayName,
        pictureUrl: data.pictureUrl ?? existing[0].pictureUrl,
        statusMessage: data.statusMessage ?? existing[0].statusMessage,
        brandId: data.brandId ?? existing[0].brandId,
        staffId: data.staffId ?? existing[0].staffId,
        liverId: data.liverId ?? existing[0].liverId,
        userType: data.userType ?? existing[0].userType,
      })
      .where(eq(lineUsers.lineUserId, data.lineUserId));
    return existing[0];
  } else {
    // Create new user
    const result = await db.insert(lineUsers).values({
      lineUserId: data.lineUserId,
      displayName: data.displayName,
      pictureUrl: data.pictureUrl,
      statusMessage: data.statusMessage,
      brandId: data.brandId,
      staffId: data.staffId,
      liverId: data.liverId,
      userType: data.userType ?? "unknown",
    });
    return { id: result[0].insertId, ...data };
  }
}

// Update LINE user blocked status
export async function updateLineUserBlocked(lineUserId: string, isBlocked: boolean) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineUsers)
    .set({ isBlocked })
    .where(eq(lineUsers.lineUserId, lineUserId));
}

// Update LINE user last message time
export async function updateLineUserLastMessage(lineUserId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineUsers)
    .set({ lastMessageAt: new Date() })
    .where(eq(lineUsers.lineUserId, lineUserId));
}

// Get LINE user by LINE user ID
export async function getLineUserByLineId(lineUserId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.lineUserId, lineUserId))
    .limit(1);
  
  return result[0] || null;
}

// Get all LINE users
export async function getAllLineUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineUsers)
    .orderBy(desc(lineUsers.lastMessageAt));
}

// Get LINE users linked to livers with liver details
export async function getLineUsersWithLiverDetails() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: lineUsers.id,
      lineUserId: lineUsers.lineUserId,
      displayName: lineUsers.displayName,
      pictureUrl: lineUsers.pictureUrl,
      userType: lineUsers.userType,
      isBlocked: lineUsers.isBlocked,
      brandId: lineUsers.brandId,
      liverId: lineUsers.liverId,
      lastMessageAt: lineUsers.lastMessageAt,
      createdAt: lineUsers.createdAt,
      // Liver details
      liverName: livers.name,
      liverEmail: livers.email,
      liverAvatarUrl: livers.avatarUrl,
      liverTiktokAccount: livers.tiktokAccount,
      liverInstagramAccount: livers.instagramAccount,
      liverIsActive: livers.isActive,
    })
    .from(lineUsers)
    .innerJoin(livers, eq(lineUsers.liverId, livers.id))
    .orderBy(desc(lineUsers.lastMessageAt));
  
  return result;
}

// Get liver interaction summary (messages, livestreams, etc.)
export async function getLiverInteractionSummary(liverId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get liver info
  const liver = await db
    .select()
    .from(livers)
    .where(eq(livers.id, liverId))
    .limit(1);
  
  if (liver.length === 0) return null;
  
  // Get LINE user linked to this liver
  const lineUser = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.liverId, liverId))
    .limit(1);
  
  // Get message count
  let messageCount = 0;
  if (lineUser.length > 0 && lineUser[0].lineUserId) {
    const messages = await db
      .select({ count: sql<number>`count(*)` })
      .from(lineMessages)
      .where(eq(lineMessages.lineUserId, lineUser[0].lineUserId));
    messageCount = messages[0]?.count || 0;
  }
  
  // Get recent messages
  let recentMessages: any[] = [];
  if (lineUser.length > 0 && lineUser[0].lineUserId) {
    recentMessages = await db
      .select()
      .from(lineMessages)
      .where(eq(lineMessages.lineUserId, lineUser[0].lineUserId))
      .orderBy(desc(lineMessages.createdAt))
      .limit(20);
  }
  
  // Get livestream count
  const livestreams = await db
    .select({ count: sql<number>`count(*)` })
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)));
  const livestreamCount = livestreams[0]?.count || 0;
  
  // Get recent livestreams with AI advice
  const recentLivestreams = await db
    .select({
      id: brandLivestreams.id,
      livestreamDate: brandLivestreams.livestreamDate,
      salesAmount: brandLivestreams.salesAmount,
      gmv: brandLivestreams.gmv,
      aiAdvice: brandLivestreams.aiAdvice,
      aiStructuredAdvice: brandLivestreams.aiStructuredAdvice,
      result: brandLivestreams.result,
    })
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)))
    .orderBy(desc(brandLivestreams.livestreamDate))
    .limit(5);
  
  return {
    liver: liver[0],
    lineUser: lineUser[0] || null,
    messageCount,
    recentMessages,
    livestreamCount,
    recentLivestreams,
  };
}

// Create or update LINE group
export async function createOrUpdateLineGroup(data: {
  lineGroupId: string;
  groupName?: string;
  pictureUrl?: string;
  brandId?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if group exists
  const existing = await db
    .select()
    .from(lineGroups)
    .where(eq(lineGroups.lineGroupId, data.lineGroupId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing group
    await db
      .update(lineGroups)
      .set({
        groupName: data.groupName ?? existing[0].groupName,
        pictureUrl: data.pictureUrl ?? existing[0].pictureUrl,
        brandId: data.brandId ?? existing[0].brandId,
      })
      .where(eq(lineGroups.lineGroupId, data.lineGroupId));
    return existing[0];
  } else {
    // Create new group with auto follow-up enabled by default
    const result = await db.insert(lineGroups).values({
      lineGroupId: data.lineGroupId,
      groupName: data.groupName,
      pictureUrl: data.pictureUrl,
      brandId: data.brandId,
      autoFollowUpEnabled: true, // Enable auto follow-up by default
      autoFollowUpDays: 2, // Default to 2 days
      lastMessageAt: new Date(), // Set initial lastMessageAt to now
    });
    return { id: result[0].insertId, ...data, autoFollowUpEnabled: true, autoFollowUpDays: 2 };
  }
}

// Update LINE group active status
export async function updateLineGroupActive(lineGroupId: string, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set({ isActive })
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Get LINE group by LINE group ID
export async function getLineGroupByLineId(lineGroupId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(lineGroups)
    .where(eq(lineGroups.lineGroupId, lineGroupId))
    .limit(1);
  
  return result[0] || null;
}

// Get all LINE groups
export async function getAllLineGroups() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineGroups)
    .where(eq(lineGroups.isActive, true))
    .orderBy(desc(lineGroups.lastMessageAt));
}

// Update LINE group auto follow-up settings
export async function updateLineGroupAutoFollowUp(lineGroupId: string, settings: {
  autoFollowUpEnabled?: boolean;
  autoFollowUpDays?: number;
  autoFollowUpMessage?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set(settings)
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Get groups that need auto follow-up (inactive for X days)
export async function getGroupsNeedingFollowUp() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all active groups with auto follow-up enabled
  const groups = await db
    .select()
    .from(lineGroups)
    .where(
      and(
        eq(lineGroups.isActive, true),
        eq(lineGroups.autoFollowUpEnabled, true)
      )
    );
  
  // Get all active LINE follow-ups (reminders) for groups
  const activeFollowUps = await db
    .select()
    .from(lineFollowUps)
    .where(
      and(
        eq(lineFollowUps.status, "active"),
        isNotNull(lineFollowUps.lineGroupId)
      )
    );
  
  // Create a set of group IDs that have active reminders
  const groupsWithActiveReminders = new Set(
    activeFollowUps.map(f => f.lineGroupId).filter(Boolean)
  );
  
  const now = new Date();
  const groupsNeedingFollowUp = [];
  
  for (const group of groups) {
    // Skip if this group has an active reminder set
    if (groupsWithActiveReminders.has(group.lineGroupId)) {
      console.log(`[Group Follow-Up] Skipping group ${group.groupName || group.lineGroupId}: has active reminder`);
      continue;
    }
    
    const inactiveDays = group.autoFollowUpDays || 2;
    const lastActivity = group.lastMessageAt || group.createdAt;
    const lastFollowUp = group.lastAutoFollowUpAt;
    
    // Calculate days since last message
    const daysSinceLastMessage = Math.floor(
      (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Check if we need to send follow-up
    if (daysSinceLastMessage >= inactiveDays) {
      // Don't send if we already sent a follow-up recently (within the same inactive period)
      if (!lastFollowUp || new Date(lastFollowUp) < new Date(lastActivity)) {
        groupsNeedingFollowUp.push({
          ...group,
          daysSinceLastMessage,
        });
      }
    }
  }
  
  return groupsNeedingFollowUp;
}

// Update last auto follow-up timestamp
export async function updateGroupLastAutoFollowUp(lineGroupId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set({ lastAutoFollowUpAt: new Date() })
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Update group last message timestamp
export async function updateGroupLastMessageAt(lineGroupId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set({ lastMessageAt: new Date() })
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Save LINE message
export async function saveLineMessage(data: {
  messageId: string;
  sourceType: "user" | "group" | "room";
  lineUserId?: string;
  lineGroupId?: string;
  senderName?: string;
  messageType: string;
  content?: string;
  direction: "incoming" | "outgoing";
  lineTimestamp?: number;
  // Response tracking fields
  needsResponse?: boolean;
  responseStatus?: "none" | "pending" | "responded" | "cancelled";
  responseSummary?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(lineMessages).values({
    messageId: data.messageId,
    sourceType: data.sourceType,
    lineUserId: data.lineUserId,
    lineGroupId: data.lineGroupId,
    senderName: data.senderName,
    messageType: data.messageType,
    content: data.content,
    direction: data.direction,
    lineTimestamp: data.lineTimestamp,
    needsResponse: data.needsResponse || false,
    responseStatus: data.responseStatus || "none",
    responseSummary: data.responseSummary,
  });
  
  return { id: result[0].insertId, ...data };
}

// Get LINE messages for a user or group
export async function getLineMessages(options: {
  lineUserId?: string;
  lineGroupId?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(lineMessages);
  
  if (options.lineUserId) {
    query = query.where(eq(lineMessages.lineUserId, options.lineUserId)) as typeof query;
  } else if (options.lineGroupId) {
    query = query.where(eq(lineMessages.lineGroupId, options.lineGroupId)) as typeof query;
  }
  
  return await query
    .orderBy(desc(lineMessages.createdAt))
    .limit(options.limit || 50);
}

// Create LINE follow-up
export async function createLineFollowUp(data: {
  targetType: "user" | "group";
  lineUserId?: string;
  lineGroupId?: string;
  triggerCondition: "no_reply" | "scheduled" | "event";
  delayHours?: number;
  maxAttempts?: number;
  messageTemplate: string;
  brandId?: number;
  createdBy?: number;
  nextScheduledAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(lineFollowUps).values({
    targetType: data.targetType,
    lineUserId: data.lineUserId,
    lineGroupId: data.lineGroupId,
    triggerCondition: data.triggerCondition,
    delayHours: data.delayHours ?? 72,
    maxAttempts: data.maxAttempts ?? 3,
    messageTemplate: data.messageTemplate,
    brandId: data.brandId,
    createdBy: data.createdBy,
    nextScheduledAt: data.nextScheduledAt,
  });
  
  return { id: result[0].insertId, ...data };
}

// Get active LINE follow-ups
export async function getActiveLineFollowUps() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineFollowUps)
    .where(eq(lineFollowUps.status, "active"))
    .orderBy(lineFollowUps.nextScheduledAt);
}

// Update LINE follow-up status
export async function updateLineFollowUpStatus(
  id: number,
  status: "active" | "completed" | "cancelled",
  lastSentAt?: Date,
  nextScheduledAt?: Date,
  incrementAttempts?: boolean
) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Record<string, unknown> = { status };
  if (lastSentAt) updateData.lastSentAt = lastSentAt;
  if (nextScheduledAt) updateData.nextScheduledAt = nextScheduledAt;
  if (incrementAttempts) {
    const current = await db.select().from(lineFollowUps).where(eq(lineFollowUps.id, id)).limit(1);
    if (current.length > 0) {
      updateData.currentAttempts = current[0].currentAttempts + 1;
    }
  }
  
  await db
    .update(lineFollowUps)
    .set(updateData)
    .where(eq(lineFollowUps.id, id));
}


// Get all LINE follow-ups
export async function getAllLineFollowUps() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineFollowUps)
    .orderBy(desc(lineFollowUps.createdAt));
}

// Get LINE follow-ups by user
export async function getLineFollowUpsByUser(lineUserId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineFollowUps)
    .where(eq(lineFollowUps.lineUserId, lineUserId))
    .orderBy(desc(lineFollowUps.createdAt));
}

// Delete LINE follow-up
export async function deleteLineFollowUp(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(lineFollowUps).where(eq(lineFollowUps.id, id));
}


// ============================================
// Response Tracking Functions (要対応メッセージ)
// ============================================

// Update message to mark as needs response
export async function markMessageNeedsResponse(
  messageId: string,
  responseSummary?: string
) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineMessages)
    .set({
      needsResponse: true,
      responseStatus: "pending",
      responseSummary,
    })
    .where(eq(lineMessages.messageId, messageId));
}

// Mark message as responded
export async function markMessageResponded(
  lineGroupId: string,
  respondedBy: string
) {
  const db = await getDb();
  if (!db) return;
  
  // Mark all pending messages in this group as responded
  await db
    .update(lineMessages)
    .set({
      responseStatus: "responded",
      respondedAt: new Date(),
      respondedBy,
    })
    .where(
      and(
        eq(lineMessages.lineGroupId, lineGroupId),
        eq(lineMessages.responseStatus, "pending")
      )
    );
}

// Get pending response messages (for reminder job)
export async function getPendingResponseMessages() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineMessages)
    .where(
      and(
        eq(lineMessages.needsResponse, true),
        eq(lineMessages.responseStatus, "pending")
      )
    )
    .orderBy(lineMessages.createdAt);
}

// Get pending response messages grouped by group
export async function getPendingResponsesByGroup() {
  const db = await getDb();
  if (!db) return [];
  
  const messages = await db
    .select()
    .from(lineMessages)
    .where(
      and(
        eq(lineMessages.needsResponse, true),
        eq(lineMessages.responseStatus, "pending"),
        isNotNull(lineMessages.lineGroupId)
      )
    )
    .orderBy(lineMessages.createdAt);
  
  // Group by lineGroupId
  const grouped = new Map<string, typeof messages>();
  for (const msg of messages) {
    if (!msg.lineGroupId) continue;
    const existing = grouped.get(msg.lineGroupId) || [];
    existing.push(msg);
    grouped.set(msg.lineGroupId, existing);
  }
  
  return Array.from(grouped.entries()).map(([groupId, msgs]) => ({
    lineGroupId: groupId,
    messages: msgs,
    oldestPending: msgs[0],
    count: msgs.length,
  }));
}

// Update reminder sent for a message
export async function updateMessageReminderSent(messageId: string) {
  const db = await getDb();
  if (!db) return;
  
  const current = await db
    .select()
    .from(lineMessages)
    .where(eq(lineMessages.messageId, messageId))
    .limit(1);
  
  if (current.length > 0) {
    await db
      .update(lineMessages)
      .set({
        lastReminderAt: new Date(),
        reminderCount: current[0].reminderCount + 1,
      })
      .where(eq(lineMessages.messageId, messageId));
  }
}

// Cancel pending response (manual)
export async function cancelPendingResponse(messageId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineMessages)
    .set({
      responseStatus: "cancelled",
    })
    .where(eq(lineMessages.messageId, messageId));
}

// Get pending responses for management UI
export async function getPendingResponsesForUI() {
  const db = await getDb();
  if (!db) return [];
  
  const messages = await db
    .select({
      id: lineMessages.id,
      messageId: lineMessages.messageId,
      lineGroupId: lineMessages.lineGroupId,
      senderName: lineMessages.senderName,
      content: lineMessages.content,
      responseSummary: lineMessages.responseSummary,
      reminderCount: lineMessages.reminderCount,
      lastReminderAt: lineMessages.lastReminderAt,
      createdAt: lineMessages.createdAt,
    })
    .from(lineMessages)
    .where(
      and(
        eq(lineMessages.needsResponse, true),
        eq(lineMessages.responseStatus, "pending")
      )
    )
    .orderBy(desc(lineMessages.createdAt));
  
  // Enrich with group names
  const result = [];
  for (const msg of messages) {
    let groupName = "不明";
    if (msg.lineGroupId) {
      const group = await db
        .select({ groupName: lineGroups.groupName })
        .from(lineGroups)
        .where(eq(lineGroups.lineGroupId, msg.lineGroupId))
        .limit(1);
      if (group.length > 0 && group[0].groupName) {
        groupName = group[0].groupName;
      }
    }
    result.push({
      ...msg,
      groupName,
      elapsedHours: Math.floor((Date.now() - new Date(msg.createdAt).getTime()) / (1000 * 60 * 60)),
    });
  }
  
  return result;
}


// ============================================
// Schedule Functions (カレンダー・スケジュール管理)
// ============================================

// Create a new schedule
export async function createSchedule(data: InsertSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(schedules).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get schedule by ID
export async function getScheduleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .limit(1);
  
  return result[0] || null;
}

// Get schedules for a specific date
export async function getSchedulesByDate(date: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        sql`${schedules.startTime} >= ${startOfDay}`,
        sql`${schedules.startTime} <= ${endOfDay}`,
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}

// Get schedules for a date range
export async function getSchedulesByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        sql`${schedules.startTime} >= ${startDate}`,
        sql`${schedules.startTime} <= ${endDate}`,
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}

// Get schedules by agency ID (filter by livers belonging to the agency)
export async function getSchedulesByAgency(agencyId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Get liver names belonging to this agency
  const agencyLivers = await db
    .select({ name: livers.name })
    .from(livers)
    .where(and(
      eq(livers.agencyId, agencyId),
      eq(livers.isActive, true)
    ));
  
  const liverNames = agencyLivers.map(l => l.name).filter(Boolean);
  if (liverNames.length === 0) return [];
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        sql`${schedules.startTime} >= ${startDate}`,
        sql`${schedules.startTime} <= ${endDate}`,
        not(eq(schedules.status, "cancelled")),
        inArray(schedules.liverName, liverNames)
      )
    )
    .orderBy(asc(schedules.startTime));
}

// Get liver names with colors by agency ID
export async function getLiverNamesByAgency(agencyId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({ name: livers.name, color: livers.color })
    .from(livers)
    .where(and(
      eq(livers.agencyId, agencyId),
      eq(livers.isActive, true)
    ));
  
  return result
    .filter(r => r.name)
    .map(r => ({ name: r.name!, color: r.color || '#FF69B4' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

// Get schedules by liver name
export async function getSchedulesByLiverName(liverName: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Normalize the search term by removing spaces for flexible matching
  // This handles cases where "京極琉" should match "京極 琉"
  const normalizedName = liverName.replace(/\s+/g, '');
  
  const conditions = [
    or(
      like(schedules.liverName, `%${liverName}%`),
      // Also search with spaces removed from the database value
      sql`REPLACE(${schedules.liverName}, ' ', '') LIKE ${`%${normalizedName}%`}`
    ),
    not(eq(schedules.status, "cancelled"))
  ];
  
  if (startDate) {
    conditions.push(sql`${schedules.startTime} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${schedules.startTime} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(schedules)
    .where(and(...conditions))
    .orderBy(asc(schedules.startTime));
}

// Get schedules by LINE group
export async function getSchedulesByLineGroup(lineGroupId: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(schedules.lineGroupId, lineGroupId),
    not(eq(schedules.status, "cancelled"))
  ];
  
  if (startDate) {
    conditions.push(sql`${schedules.startTime} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${schedules.startTime} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(schedules)
    .where(and(...conditions))
    .orderBy(asc(schedules.startTime));
}

// Update schedule
export async function updateSchedule(id: number, data: Partial<InsertSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(schedules)
    .set(data)
    .where(eq(schedules.id, id));
}

// Update all recurring schedules with the same parentScheduleId
export async function updateRecurringSchedules(parentScheduleId: number, data: Partial<InsertSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update all schedules with this parentScheduleId (including the parent itself)
  await db
    .update(schedules)
    .set(data)
    .where(
      and(
        or(
          eq(schedules.id, parentScheduleId),
          eq(schedules.parentScheduleId, parentScheduleId)
        ),
        not(eq(schedules.status, "cancelled"))
      )
    );
}

// Delete schedule (soft delete - set status to cancelled)
export async function deleteSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(schedules)
    .set({ status: "cancelled" })
    .where(eq(schedules.id, id));
}

// Delete all recurring schedules with the same parentScheduleId
export async function deleteRecurringSchedules(parentScheduleId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete all schedules with this parentScheduleId (including the parent itself)
  await db
    .update(schedules)
    .set({ status: "cancelled" })
    .where(
      or(
        eq(schedules.id, parentScheduleId),
        eq(schedules.parentScheduleId, parentScheduleId)
      )
    );
}

// Get all schedules (for management UI)
export async function getAllSchedules(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(schedules)
    .where(not(eq(schedules.status, "cancelled")))
    .orderBy(asc(schedules.startTime))
    .limit(limit);
}

// Get upcoming schedules (from now)
export async function getUpcomingSchedules(days: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        sql`${schedules.startTime} >= ${now}`,
        sql`${schedules.startTime} <= ${endDate}`,
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}

// Search schedules by title or description
export async function searchSchedules(query: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        or(
          like(schedules.title, `%${query}%`),
          like(schedules.description, `%${query}%`),
          like(schedules.liverName, `%${query}%`)
        ),
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}


// =====================================================
// Liver (Streamer) Management Functions
// ライバー（配信者）管理関数
// =====================================================

// Create a new liver
export async function createLiver(data: InsertLiver) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(livers).values(data);
  const insertId = Number(result[0].insertId);
  return insertId;
}

// Get liver by email
export async function getLiverByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(livers)
    .where(eq(livers.email, email))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Get liver by ID
export async function getLiverById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(livers)
    .where(eq(livers.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Get all active livers
export async function getAllActiveLivers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livers)
    .where(eq(livers.isActive, true))
    .orderBy(asc(livers.name));
}

// Get all livers (including inactive)
export async function getAllLivers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livers)
    .orderBy(desc(livers.createdAt));
}

// Update liver
export async function updateLiver(id: number, data: Partial<InsertLiver>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livers)
    .set(data)
    .where(eq(livers.id, id));
}

// Update liver last login
export async function updateLiverLastLogin(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livers)
    .set({ lastLoginAt: new Date() })
    .where(eq(livers.id, id));
}

// Delete liver (soft delete - set isActive to false)
export async function deleteLiver(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livers)
    .set({ isActive: false })
    .where(eq(livers.id, id));
}

// Check if email already exists
export async function checkLiverEmailExists(email: string) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select({ id: livers.id })
    .from(livers)
    .where(eq(livers.email, email))
    .limit(1);
  
  return result.length > 0;
}

// Get schedules by liver ID
export async function getSchedulesByLiverId(liverId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(schedules.liverId, liverId),
    not(eq(schedules.status, "cancelled"))
  ];
  
  if (startDate) {
    conditions.push(sql`${schedules.startTime} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${schedules.startTime} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(schedules)
    .where(and(...conditions))
    .orderBy(asc(schedules.startTime));
}


// ============================================
// Livestream Products Functions (直播商品別GMV)
// ============================================

// Create a new livestream product
export async function createLivestreamProduct(data: InsertLivestreamProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(livestreamProducts).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get products by livestream ID
export async function getLivestreamProductsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId))
    .orderBy(desc(livestreamProducts.gmv));
}

// Update livestream product
export async function updateLivestreamProduct(id: number, data: Partial<InsertLivestreamProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livestreamProducts)
    .set(data)
    .where(eq(livestreamProducts.id, id));
}

// Delete livestream product
export async function deleteLivestreamProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(livestreamProducts)
    .where(eq(livestreamProducts.id, id));
}

// Get total GMV for a livestream from products
export async function getLivestreamProductsTotalGmv(livestreamId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const products = await db
    .select({ gmv: livestreamProducts.gmv })
    .from(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId));
  
  return products.reduce((sum, p) => sum + (p.gmv || 0), 0);
}

// Delete all products for a livestream
export async function deleteLivestreamProductsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId));
}

// Bulk import products from CSV for a livestream
// This will delete existing products and insert new ones
export async function importLivestreamProductsFromCsv(
  livestreamId: number,
  products: Array<{
    productName: string;
    grossRevenue?: number | null;
    directGmv?: number | null;
    itemsSold?: number | null;
    customers?: number | null;
    orders?: number | null;
    ctr?: string | null;
    ctor?: string | null;
    productImpressions?: number | null;
    productClicks?: number | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete existing products for this livestream
  await db
    .delete(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId));
  
  // Insert new products
  if (products.length > 0) {
    // 数字のみの商品名（TikTok商品ID）を実際の商品名に解決
    const productNames = products.map(p => p.productName);
    const resolvedNames = await resolveNumericProductNames(productNames);
    
    const insertData = products.map(p => ({
      livestreamId,
      productName: resolvedNames.get(p.productName) || p.productName,
      grossRevenue: p.grossRevenue ?? null,
      directGmv: p.directGmv ?? null,
      gmv: p.directGmv ?? null, // Use directGmv as gmv for backward compatibility
      itemsSold: p.itemsSold ?? null,
      quantity: p.itemsSold ?? null, // Use itemsSold as quantity for backward compatibility
      customers: p.customers ?? null,
      orders: p.orders ?? null,
      ctr: p.ctr ?? null,
      ctor: p.ctor ?? null,
      productImpressions: p.productImpressions ?? null,
      impressions: p.productImpressions ?? null, // Backward compatibility
      productClicks: p.productClicks ?? null,
    }));
    
    await db.insert(livestreamProducts).values(insertData);
  }
  
  // Update the livestream to mark product CSV as imported
  await db
    .update(brandLivestreams)
    .set({ productCsvImported: "yes" })
    .where(eq(brandLivestreams.id, livestreamId));
  
  return products.length;
}

// Get all livestream products for a brand with livestream date info
export async function getAllLivestreamProductsForBrand(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all livestreams for the brand
  const livestreamList = await db
    .select()
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.brandId, brandId), isNull(brandLivestreams.deletedAt)));
  
  // Get all products for these livestreams
  const livestreamIds = livestreamList.map(ls => ls.id);
  if (livestreamIds.length === 0) return [];
  
  const products = await db
    .select()
    .from(livestreamProducts)
    .where(inArray(livestreamProducts.livestreamId, livestreamIds));
  
  // Combine with livestream date info
  return products.map(product => {
    const livestream = livestreamList.find(ls => ls.id === product.livestreamId);
    return {
      ...product,
      livestreamDate: livestream?.livestreamDate,
    };
  });
}

// Get monthly GMV summary for a brand
export async function getMonthlyGmvSummary(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all livestreams for the brand
  const livestreamList = await db
    .select()
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.brandId, brandId), isNull(brandLivestreams.deletedAt)))
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  if (livestreamList.length === 0) return [];
  
  // Get all products for these livestreams
  const livestreamIds = livestreamList.map(ls => ls.id);
  const products = await db
    .select()
    .from(livestreamProducts)
    .where(inArray(livestreamProducts.livestreamId, livestreamIds));
  
  // Group by month
  const monthlyData: Record<string, { gmv: number; productCount: number; livestreamCount: number }> = {};
  
  livestreamList.forEach(ls => {
    const date = new Date(ls.livestreamDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { gmv: 0, productCount: 0, livestreamCount: 0 };
    }
    monthlyData[monthKey].livestreamCount++;
    
    // Add products GMV for this livestream
    const livestreamProducts = products.filter(p => p.livestreamId === ls.id);
    livestreamProducts.forEach(p => {
      monthlyData[monthKey].gmv += p.gmv || 0;
      monthlyData[monthKey].productCount++;
    });
  });
  
  // Convert to array and sort by month descending
  return Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      year: parseInt(month.split('-')[0]),
      monthNum: parseInt(month.split('-')[1]),
      ...data,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}


// Brand Memos functions
export async function createBrandMemo(memoData: InsertBrandMemo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(brandMemos).values(memoData);
  return { id: Number(result[0].insertId), ...memoData };
}

export async function getMemosByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(brandMemos)
    .where(and(eq(brandMemos.brandId, brandId), isNull(brandMemos.deletedAt)))
    .orderBy(desc(brandMemos.createdAt));
}

export async function deleteBrandMemo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // ソフトデリート: deletedAtを設定して論理削除
  return await db.update(brandMemos).set({ deletedAt: new Date() }).where(eq(brandMemos.id, id));
}

export async function updateBrandMemo(id: number, updateData: Partial<InsertBrandMemo>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(brandMemos).set(updateData).where(eq(brandMemos.id, id));
}


// ============================================
// Contract-Livestream Links Functions (契約と直播の紐付け)
// ============================================

// Create a new contract-livestream link
export async function createContractLivestreamLink(data: InsertContractLivestreamLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contractLivestreamLinks).values(data);
  return { id: Number(result[0].insertId), ...data };
}

// Get all livestream links for a contract
export async function getContractLivestreamLinks(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(contractLivestreamLinks)
    .where(eq(contractLivestreamLinks.contractId, contractId));
}

// Get linked livestreams with details for a contract
export async function getContractLinkedLivestreams(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all links for this contract
  const links = await db
    .select()
    .from(contractLivestreamLinks)
    .where(eq(contractLivestreamLinks.contractId, contractId));
  
  if (links.length === 0) return [];
  
  // Get the livestream details
  const livestreamIds = links.map(l => l.livestreamId);
  const livestreams = await db
    .select()
    .from(brandLivestreams)
    .where(and(inArray(brandLivestreams.id, livestreamIds), isNull(brandLivestreams.deletedAt)))
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  return livestreams;
}

// Delete a contract-livestream link
export async function deleteContractLivestreamLink(contractId: number, livestreamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(contractLivestreamLinks)
    .where(
      and(
        eq(contractLivestreamLinks.contractId, contractId),
        eq(contractLivestreamLinks.livestreamId, livestreamId)
      )
    );
}

// Delete all links for a contract
export async function deleteAllContractLivestreamLinks(contractId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(contractLivestreamLinks)
    .where(eq(contractLivestreamLinks.contractId, contractId));
}

// Check if a link already exists
export async function checkContractLivestreamLinkExists(contractId: number, livestreamId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select({ id: contractLivestreamLinks.id })
    .from(contractLivestreamLinks)
    .where(
      and(
        eq(contractLivestreamLinks.contractId, contractId),
        eq(contractLivestreamLinks.livestreamId, livestreamId)
      )
    )
    .limit(1);
  
  return result.length > 0;
}

// Calculate contract ROAS (GMV + Ad Value) / Fixed Fee
// CPM = ¥15,000 (15円/インプレッション)
// ROAS計算式: (広告換算費用 + GMV) ÷ 固定費
// 広告換算費用は「もし広告を出していたら発生していたコスト」なので、節約できた価値としてGMVに加算
export async function calculateContractRoas(contractId: number, fixedFee: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get linked livestreams
  const livestreams = await getContractLinkedLivestreams(contractId);
  
  if (livestreams.length === 0) {
    return {
      totalGmv: 0,
      totalImpressions: 0,
      adValue: 0,
      totalValue: 0,
      roas: 0,
      livestreamCount: 0,
    };
  }
  
  // Calculate totals
  const totalGmv = livestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
  const totalImpressions = livestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
  
  // Ad value calculation: impressions × ¥15 (CPM ¥15,000)
  const adValue = totalImpressions * 15;
  
  // Total value = GMV + Ad Value
  const totalValue = totalGmv + adValue;
  
  // ROAS = (GMV + 広告換算費用) ÷ 固定費
  // 固定費が0の場合は0を返す
  const roas = fixedFee > 0 ? totalValue / fixedFee : 0;
  
  return {
    totalGmv,
    totalImpressions,
    adValue,
    totalValue,
    roas,
    livestreamCount: livestreams.length,
  };
}


// ============================================
// Liver Livestream Functions (ライバー別配信履歴)
// ============================================

// Get livestreams by liver ID
export async function getLivestreamsByLiverId(liverId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(brandLivestreams.liverId, liverId)];
  
  if (month) {
    // month format: "YYYY-MM"
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate}`);
    conditions.push(sql`${brandLivestreams.livestreamDate} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),...conditions))
    .orderBy(desc(brandLivestreams.livestreamDate));
}

// Get liver statistics (monthly sales, total hours)
export async function getLiverStatistics(liverId: number, month?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [eq(brandLivestreams.liverId, liverId)];
  
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate}`);
    conditions.push(sql`${brandLivestreams.livestreamDate} <= ${endDate}`);
  }
  
  const result = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      livestreamCount: sql<number>`COUNT(*)`,
    })
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),...conditions));
  
  return result[0];
}

// Get liver rankings (sales ranking, duration ranking)
// JOIN livers table to get correct liver name and avatar instead of streamerName
export async function getLiverRankings(month: string, agencyId?: number | null) {
  const db = await getDb();
  if (!db) return { salesRanking: [], durationRanking: [] };
  
  const { startDate, endDate } = getJSTMonthRange(month);
  
  // Build agency filter condition
  const agencyFilter = agencyId === null 
    ? isNull(livers.agencyId) // LCJ own livers only
    : agencyId !== undefined 
      ? eq(livers.agencyId, agencyId) // Specific agency
      : undefined; // No filter (all)
  
  // Sales ranking - JOIN livers to get correct name and avatar
  const salesRanking = await db
    .select({
      liverId: brandLivestreams.liverId,
      streamerName: sql<string>`COALESCE(${livers.name}, MAX(${brandLivestreams.streamerName}))`,
      liverName: livers.name,
      avatarUrl: livers.avatarUrl,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
    })
    .from(brandLivestreams)
    .leftJoin(livers, eq(brandLivestreams.liverId, livers.id))
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        isNotNull(brandLivestreams.liverId),
        agencyFilter
      )
    )
    .groupBy(brandLivestreams.liverId, livers.name, livers.avatarUrl)
    .orderBy(sql`SUM(${brandLivestreams.salesAmount}) DESC`);
  
  // Duration ranking - JOIN livers to get correct name and avatar
  const durationRanking = await db
    .select({
      liverId: brandLivestreams.liverId,
      streamerName: sql<string>`COALESCE(${livers.name}, MAX(${brandLivestreams.streamerName}))`,
      liverName: livers.name,
      avatarUrl: livers.avatarUrl,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
    })
    .from(brandLivestreams)
    .leftJoin(livers, eq(brandLivestreams.liverId, livers.id))
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        isNotNull(brandLivestreams.liverId),
        agencyFilter
      )
    )
    .groupBy(brandLivestreams.liverId, livers.name, livers.avatarUrl)
    .orderBy(sql`SUM(${brandLivestreams.duration}) DESC`);
  
  return { salesRanking, durationRanking };
}

// Get livestream by ID with brand info
export async function getLivestreamById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.id, id), isNull(brandLivestreams.deletedAt)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Update livestream result (配信結果の記録)
export async function updateLivestreamResult(id: number, data: {
  result?: "成功" | "失敗";
  impactFactor?: "構成" | "商品" | "ライバー" | "広告" | "その他";
  resultReason?: string;
  screenshotUrl?: string;
  screenshotKey?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(brandLivestreams)
    .set(data)
    .where(eq(brandLivestreams.id, id));
}

// Get all livers with their statistics for a given month
export async function getLiversWithStats(month: string, agencyId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  const { startDate, endDate } = getJSTMonthRange(month);
  
  // Build agency filter condition
  const agencyFilter = agencyId === null 
    ? isNull(livers.agencyId) // LCJ own livers only
    : agencyId !== undefined 
      ? eq(livers.agencyId, agencyId) // Specific agency
      : undefined; // No filter (all)
  
  // Get all active livers (filtered by agency)
  const allLivers = await db
    .select()
    .from(livers)
    .where(and(eq(livers.isActive, true), agencyFilter))
    .orderBy(asc(livers.name));
  
  // Get stats for each liver
  const liversWithStats = await Promise.all(
    allLivers.map(async (liver) => {
      const stats = await db
        .select({
          totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
          totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
          livestreamCount: sql<number>`COUNT(*)`,
        })
        .from(brandLivestreams)
        .where(
          and(
            isNull(brandLivestreams.deletedAt),
            eq(brandLivestreams.liverId, liver.id),
            sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
            sql`${brandLivestreams.livestreamDate} <= ${endDate}`
          )
        );
      
      // Get set count for this liver
      const setStats = await db
        .select({
          totalSets: sql<number>`COUNT(DISTINCT ${livestreamSets.id})`,
          totalSetRevenue: sql<number>`COALESCE(SUM(${livestreamSets.totalRevenue}), 0)`,
        })
        .from(livestreamSets)
        .innerJoin(brandLivestreams, eq(livestreamSets.livestreamId, brandLivestreams.id))
        .where(
          and(
            isNull(brandLivestreams.deletedAt),
            eq(brandLivestreams.liverId, liver.id),
            sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
            sql`${brandLivestreams.livestreamDate} <= ${endDate}`
          )
        );

      return {
        ...liver,
        totalSales: stats[0]?.totalSales || 0,
        totalDuration: stats[0]?.totalDuration || 0,
        livestreamCount: stats[0]?.livestreamCount || 0,
        totalSets: setStats[0]?.totalSets || 0,
        totalSetRevenue: setStats[0]?.totalSetRevenue || 0,
      };
    })
  );
  
  return liversWithStats;
}



// ============================================
// Brand Edit Log Functions (編集ログ)
// ============================================

// Create a new edit log entry
export async function createBrandEditLog(data: InsertBrandEditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandEditLogs).values(data);
  return { id: Number(result[0].insertId), ...data };
}

// Get edit logs for a brand
export async function getBrandEditLogs(brandId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandEditLogs)
    .where(eq(brandEditLogs.brandId, brandId))
    .orderBy(desc(brandEditLogs.createdAt))
    .limit(limit);
}

// Helper function to create edit log with common fields
export async function logBrandEdit(
  brandId: number,
  actionType: "create" | "update" | "delete",
  entityType: "brand" | "product" | "livestream" | "contract" | "memo",
  entityId: number | null,
  entityName: string | null,
  changeDescription: string,
  userId: number,
  userName: string,
  previousValue?: string,
  newValue?: string
) {
  return await createBrandEditLog({
    brandId,
    actionType,
    entityType,
    entityId,
    entityName,
    changeDescription,
    previousValue,
    newValue,
    userId,
    userName,
  });
}


// ============================================
// Brand Product Images Functions (商品画像)
// ============================================

// Get all images for a product
export async function getProductImages(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandProductImages)
    .where(eq(brandProductImages.productId, productId))
    .orderBy(asc(brandProductImages.sortOrder));
}

// Add a new image to a product
export async function addProductImage(data: InsertBrandProductImage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the max sort order for this product
  const existing = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${brandProductImages.sortOrder}), -1)` })
    .from(brandProductImages)
    .where(eq(brandProductImages.productId, data.productId));
  
  const nextOrder = (existing[0]?.maxOrder ?? -1) + 1;
  
  const result = await db.insert(brandProductImages).values({
    ...data,
    sortOrder: data.sortOrder ?? nextOrder,
  });
  
  return { id: Number(result[0].insertId), ...data, sortOrder: nextOrder };
}

// Delete an image
export async function deleteProductImage(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandProductImages).where(eq(brandProductImages.id, imageId));
  return { success: true };
}

// Update image sort order
export async function updateProductImageOrder(imageId: number, sortOrder: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(brandProductImages)
    .set({ sortOrder })
    .where(eq(brandProductImages.id, imageId));
  
  return { success: true };
}

// Reorder all images for a product
export async function reorderProductImages(productId: number, imageIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update each image's sort order based on its position in the array
  for (let i = 0; i < imageIds.length; i++) {
    await db
      .update(brandProductImages)
      .set({ sortOrder: i })
      .where(and(
        eq(brandProductImages.id, imageIds[i]),
        eq(brandProductImages.productId, productId)
      ));
  }
  
  return { success: true };
}


// ========================================
// Brand Files Functions
// ブランドファイル管理関数
// ========================================

/**
 * Get all files for a brand
 */
export async function getBrandFiles(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(brandFiles)
    .where(and(eq(brandFiles.brandId, brandId), isNull(brandFiles.deletedAt)))
    .orderBy(desc(brandFiles.createdAt));
  
  return result;
}

/**
 * Create a new brand file record
 */
export async function createBrandFile(data: InsertBrandFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandFiles).values(data);
  return { id: result[0].insertId };
}

/**
 * Delete a brand file record
 */
export async function deleteBrandFile(fileId: number, brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First get the file to return the key for S3 deletion
  const file = await db
    .select()
    .from(brandFiles)
    .where(and(eq(brandFiles.id, fileId), eq(brandFiles.brandId, brandId)))
    .limit(1);
  
  if (file.length === 0) {
    throw new Error("File not found");
  }
  
  // ソフトデリート: deletedAtを設定して論理削除
  await db
    .update(brandFiles)
    .set({ deletedAt: new Date() })
    .where(and(eq(brandFiles.id, fileId), eq(brandFiles.brandId, brandId)));
  
  return { fileKey: file[0].fileKey, fileName: file[0].fileName };
}

/**
 * Get a single brand file by ID
 */
export async function getBrandFileById(fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
   const result = await db
    .select()
    .from(brandFiles)
    .where(and(eq(brandFiles.id, fileId), isNull(brandFiles.deletedAt)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}
// ==================== Product Links Functions =====================

/**
 * Get all links for a product
 */
export async function getProductLinks(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(productLinks)
    .where(eq(productLinks.productId, productId))
    .orderBy(asc(productLinks.sortOrder), asc(productLinks.id));
}

/**
 * Add a link to a product
 */
export async function addProductLink(data: {
  productId: number;
  title: string;
  url: string;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the max sortOrder for this product
  const maxOrder = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${productLinks.sortOrder}), -1)` })
    .from(productLinks)
    .where(eq(productLinks.productId, data.productId));
  
  const sortOrder = (maxOrder[0]?.maxOrder ?? -1) + 1;
  
  const result = await db.insert(productLinks).values({
    productId: data.productId,
    title: data.title,
    url: data.url,
    sortOrder,
    createdBy: data.createdBy,
  });
  
  return { id: result[0].insertId, sortOrder };
}

/**
 * Update a product link
 */
export async function updateProductLink(linkId: number, data: {
  title?: string;
  url?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(productLinks)
    .set(data)
    .where(eq(productLinks.id, linkId));
  
  return { success: true };
}

/**
 * Delete a product link
 */
export async function deleteProductLink(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(productLinks)
    .where(eq(productLinks.id, linkId));
  
  return { success: true };
}

/**
 * Get links for multiple products at once
 */
export async function getProductLinksForProducts(productIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (productIds.length === 0) return [];
  
  return await db
    .select()
    .from(productLinks)
    .where(inArray(productLinks.productId, productIds))
    .orderBy(asc(productLinks.sortOrder), asc(productLinks.id));
}


// ============================================
// CSV Import Functions (TikTok配信パフォーマンスCSVインポート)
// ============================================

/**
 * Check if a livestream already exists by date and streamer name
 */
export async function findExistingLivestream(
  brandId: number,
  livestreamDate: Date,
  streamerName: string
) {
  const db = await getDb();
  if (!db) return null;
  
  // Find livestream within 1 hour of the given date with matching streamer name
  const startRange = new Date(livestreamDate.getTime() - 60 * 60 * 1000); // 1 hour before
  const endRange = new Date(livestreamDate.getTime() + 60 * 60 * 1000); // 1 hour after
  
  const result = await db
    .select()
    .from(brandLivestreams)
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        eq(brandLivestreams.brandId, brandId),
        sql`${brandLivestreams.livestreamDate} >= ${startRange}`,
        sql`${brandLivestreams.livestreamDate} <= ${endRange}`,
        eq(brandLivestreams.streamerName, streamerName)
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Update an existing livestream with CSV data
 */
export async function updateLivestreamFromCsv(
  id: number,
  data: Partial<InsertBrandLivestream>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(brandLivestreams)
    .set({
      ...data,
      csvImported: "yes",
    })
    .where(eq(brandLivestreams.id, id));
  
  return { id, updated: true };
}

/**
 * Create a new livestream from CSV data
 */
export async function createLivestreamFromCsv(data: InsertBrandLivestream) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandLivestreams).values({
    ...data,
    csvImported: "yes",
  });
  
  const insertId = (result as any)[0]?.insertId;
  return { id: insertId, created: true };
}

/**
 * Get all livestreams for a brand that were imported from CSV
 */
export async function getCsvImportedLivestreams(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandLivestreams)
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        eq(brandLivestreams.brandId, brandId),
        eq(brandLivestreams.csvImported, "yes")
      )
    )
    .orderBy(desc(brandLivestreams.livestreamDate));
}


// ========================================
// CSV Import History Management
// ========================================

/**
 * Create a CSV import history record
 */
export async function createCsvImportHistory(data: {
  livestreamId: number;
  fileName: string;
  productCount: number;
  totalGmv?: number | null;
  importedBy: number;
  importedByName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(csvImportHistory).values({
    livestreamId: data.livestreamId,
    fileName: data.fileName,
    productCount: data.productCount,
    totalGmv: data.totalGmv ?? null,
    importedBy: data.importedBy,
    importedByName: data.importedByName,
  });
  
  return result;
}

/**
 * Get CSV import history for a livestream
 */
export async function getCsvImportHistoryByLivestream(livestreamId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(csvImportHistory)
    .where(eq(csvImportHistory.livestreamId, livestreamId))
    .orderBy(desc(csvImportHistory.createdAt));
}

/**
 * Delete a CSV import history record and associated products
 */
export async function deleteCsvImportHistory(historyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the history record first to find the livestreamId
  const history = await db
    .select()
    .from(csvImportHistory)
    .where(eq(csvImportHistory.id, historyId))
    .limit(1);
  
  if (history.length === 0) {
    throw new Error("Import history not found");
  }
  
  const livestreamId = history[0].livestreamId;
  
  // Delete all products for this livestream
  await db
    .delete(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId));
  
  // Delete the history record
  await db
    .delete(csvImportHistory)
    .where(eq(csvImportHistory.id, historyId));
  
  // Update the livestream to mark product CSV as not imported
  await db
    .update(brandLivestreams)
    .set({ productCsvImported: "no" })
    .where(eq(brandLivestreams.id, livestreamId));
  
  return { deleted: true, livestreamId };
}

/**
 * Get all CSV import history for a brand
 */
export async function getCsvImportHistoryByBrand(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all livestreams for the brand
  const livestreamList = await db
    .select()
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.brandId, brandId), isNull(brandLivestreams.deletedAt)));
  
  const livestreamIds = livestreamList.map(ls => ls.id);
  if (livestreamIds.length === 0) return [];
  
  // Get all import history for these livestreams
  const history = await db
    .select()
    .from(csvImportHistory)
    .where(inArray(csvImportHistory.livestreamId, livestreamIds))
    .orderBy(desc(csvImportHistory.createdAt));
  
  // Combine with livestream info
  return history.map(h => {
    const livestream = livestreamList.find(ls => ls.id === h.livestreamId);
    return {
      ...h,
      livestreamDate: livestream?.livestreamDate,
    };
  });
}


// ========================================
// Livestream CSV Import History Management
// ========================================

/**
 * Create a livestream CSV import history record
 */
export async function createLivestreamCsvImportHistory(data: {
  liverId: number;
  brandId: number;
  fileName: string;
  livestreamCount: number;
  createdCount: number;
  updatedCount: number;
  totalGmv?: number | null;
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
  importedBy: number;
  importedByName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(livestreamCsvImportHistory).values({
    liverId: data.liverId,
    brandId: data.brandId,
    fileName: data.fileName,
    livestreamCount: data.livestreamCount,
    createdCount: data.createdCount,
    updatedCount: data.updatedCount,
    totalGmv: data.totalGmv ?? null,
    dateRangeStart: data.dateRangeStart ?? null,
    dateRangeEnd: data.dateRangeEnd ?? null,
    importedBy: data.importedBy,
    importedByName: data.importedByName,
  });
  
  return result;
}

/**
 * Get livestream CSV import history for a liver
 */
export async function getLivestreamCsvImportHistoryByLiver(liverId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livestreamCsvImportHistory)
    .where(eq(livestreamCsvImportHistory.liverId, liverId))
    .orderBy(desc(livestreamCsvImportHistory.createdAt));
}

/**
 * Delete a livestream CSV import history record and associated livestreams
 */
export async function deleteLivestreamCsvImportHistory(historyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the history record first
  const history = await db
    .select()
    .from(livestreamCsvImportHistory)
    .where(eq(livestreamCsvImportHistory.id, historyId))
    .limit(1);
  
  if (history.length === 0) {
    throw new Error("Import history not found");
  }
  
  const { liverId, brandId, dateRangeStart, dateRangeEnd } = history[0];
  
  // Soft delete all livestreams within the date range that were imported via CSV
  if (dateRangeStart && dateRangeEnd) {
    await db
      .update(brandLivestreams)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(brandLivestreams.liverId, liverId),
          eq(brandLivestreams.brandId, brandId),
          eq(brandLivestreams.csvImported, "yes"),
          gte(brandLivestreams.livestreamDate, dateRangeStart),
          lte(brandLivestreams.livestreamDate, dateRangeEnd),
          isNull(brandLivestreams.deletedAt)
        )
      );
  }
  
  // Delete the history record
  await db
    .delete(livestreamCsvImportHistory)
    .where(eq(livestreamCsvImportHistory.id, historyId));
  
  return { deleted: true, historyId };
}

/**
 * Get all livestream CSV import history
 */
export async function getAllLivestreamCsvImportHistory() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livestreamCsvImportHistory)
    .orderBy(desc(livestreamCsvImportHistory.createdAt));
}


// ============================================
// Ad Proposal History Functions
// ============================================

/**
 * Create a new ad proposal history record
 */
export async function createAdProposalHistory(data: InsertAdProposalHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(adProposalHistory).values(data);
  return result;
}

/**
 * Get all ad proposals for a brand
 */
export async function getAdProposalsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(adProposalHistory)
    .where(eq(adProposalHistory.brandId, brandId))
    .orderBy(desc(adProposalHistory.createdAt));
}

/**
 * Get a specific ad proposal by ID
 */
export async function getAdProposalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(adProposalHistory)
    .where(eq(adProposalHistory.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get the latest version number for a brand's proposals
 */
export async function getLatestProposalVersion(brandId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ maxVersion: sql<number>`MAX(${adProposalHistory.version})` })
    .from(adProposalHistory)
    .where(eq(adProposalHistory.brandId, brandId));
  
  return result[0]?.maxVersion || 0;
}

/**
 * Update ad proposal status
 */
export async function updateAdProposalStatus(id: number, status: 'draft' | 'submitted' | 'approved' | 'rejected') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(adProposalHistory)
    .set({ status })
    .where(eq(adProposalHistory.id, id));
}

/**
 * Delete an ad proposal
 */
export async function deleteAdProposal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .delete(adProposalHistory)
    .where(eq(adProposalHistory.id, id));
}

/**
 * Get all ad proposals (for admin view)
 */
export async function getAllAdProposals() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(adProposalHistory)
    .orderBy(desc(adProposalHistory.createdAt));
}


// ============================================
// LCJ Point System Functions
// ============================================

// --- Point Balance Functions ---

/**
 * Get or create point balance for a user
 */
export async function getOrCreatePointBalance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db
    .select()
    .from(pointBalances)
    .where(eq(pointBalances.userId, userId))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Create new balance record
  await db.insert(pointBalances).values({ userId, balance: 0, totalEarned: 0, totalUsed: 0 });
  
  const created = await db
    .select()
    .from(pointBalances)
    .where(eq(pointBalances.userId, userId))
    .limit(1);
  
  return created[0];
}

/**
 * Get point balance for a user
 */
export async function getPointBalance(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(pointBalances)
    .where(eq(pointBalances.userId, userId))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Update point balance (internal use only)
 */
export async function updatePointBalance(
  userId: number,
  balanceChange: number,
  type: "earn" | "use"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Ensure balance record exists before atomic update
  await getOrCreatePointBalance(userId);
  
  // === ATOMIC UPDATE: Use SQL-level increment to prevent race conditions ===
  if (type === "earn") {
    await db
      .update(pointBalances)
      .set({
        balance: sql`${pointBalances.balance} + ${balanceChange}`,
        totalEarned: sql`${pointBalances.totalEarned} + ${balanceChange}`,
      })
      .where(eq(pointBalances.userId, userId));
  } else {
    await db
      .update(pointBalances)
      .set({
        balance: sql`${pointBalances.balance} + ${balanceChange}`,
        totalUsed: sql`${pointBalances.totalUsed} + ${Math.abs(balanceChange)}`,
      })
      .where(eq(pointBalances.userId, userId));
  }
  
  const updated = await getOrCreatePointBalance(userId);
  return { balance: updated.balance, totalEarned: updated.totalEarned, totalUsed: updated.totalUsed };
}

// --- Point Transaction Functions ---

/**
 * Create a point transaction and update balance
 */
export async function createPointTransaction(data: {
  userId: number;
  type: "earn" | "use" | "expire" | "refund" | "adjustment";
  amount: number;
  referenceType: "receipt" | "order" | "manual" | "system";
  referenceId?: number;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current balance
  const balance = await getOrCreatePointBalance(data.userId);
  const balanceAfter = balance.balance + data.amount;
  
  // Calculate expiration for earn-type transactions (3 months from now)
  const expiresAt = (data.type === "earn" || data.type === "refund")
    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 3 months (90 days)
    : null;
  const remainingAmount = (data.type === "earn" || data.type === "refund")
    ? data.amount
    : null;
  
  // Create transaction
  await db.insert(pointTransactions).values({
    userId: data.userId,
    type: data.type,
    amount: data.amount,
    balanceAfter,
    referenceType: data.referenceType,
    referenceId: data.referenceId,
    description: data.description,
    expiresAt,
    remainingAmount,
  });
  
  // Update balance
  if (data.type === "earn" || data.type === "refund") {
    await updatePointBalance(data.userId, data.amount, "earn");
  } else if (data.type === "use") {
    await updatePointBalance(data.userId, data.amount, "use");
  } else {
    // For expire and adjustment, use atomic SQL increment
    await db
      .update(pointBalances)
      .set({ balance: sql`${pointBalances.balance} + ${data.amount}` })
      .where(eq(pointBalances.userId, data.userId));
  }
  
  return { balanceAfter };
}

/**
 * Get point transactions for a user
 */
export async function getPointTransactions(
  userId: number,
  options?: { limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.userId, userId))
    .orderBy(desc(pointTransactions.createdAt));
  
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }
  
  return await query;
}

/**
 * Get total points earned from receipts
 */
export async function getTotalPointsFromReceipts(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointTransactions.amount}), 0)` })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, userId),
        eq(pointTransactions.type, "earn"),
        eq(pointTransactions.referenceType, "receipt")
      )
    );
  
  return result[0]?.total || 0;
}

// --- Receipt Functions ---

/**
 * Create a new receipt
 */
export async function createReceipt(data: InsertReceipt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(receipts).values(data);
  return result[0].insertId;
}

/**
 * Get receipt by ID
 */
export async function getReceiptById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(receipts)
    .where(eq(receipts.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get receipts for a user
 */
export async function getReceiptsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(receipts)
    .where(eq(receipts.userId, userId))
    .orderBy(desc(receipts.submittedAt));
}

/**
 * Get all receipts with filters (for admin)
 */
export async function getAllReceipts(options?: {
  status?: "pending" | "approved" | "rejected" | "on_hold";
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db
    .select({
      receipt: receipts,
      userName: users.name,
      userEmail: users.email,
    })
    .from(receipts)
    .leftJoin(users, eq(receipts.userId, users.id))
    .orderBy(desc(receipts.submittedAt));
  
  if (options?.status) {
    query = query.where(eq(receipts.status, options.status)) as typeof query;
  }
  
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }
  
  return await query;
}

/**
 * Get pending receipts count
 */
export async function getPendingReceiptsCount() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(receipts)
    .where(eq(receipts.status, "pending"));
  
  return result[0]?.count || 0;
}

/**
 * Update receipt OCR data
 */
export async function updateReceiptOcr(
  id: number,
  data: {
    storeName?: string;
    purchaseDate?: Date;
    totalAmount?: number;
    currency?: string;
    ocrRawText?: string;
    ocrConfidence?: string;
    pointsCalculated?: number;
    imageHash?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(receipts)
    .set(data)
    .where(eq(receipts.id, id));
}

/**
 * Update receipt status (approve/reject/hold)
 */
export async function updateReceiptStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "on_hold",
  reviewedBy: number,
  reviewNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(receipts)
    .set({
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote,
    })
    .where(eq(receipts.id, id));
}

/**
 * Award points for an approved receipt
 */
export async function awardPointsForReceipt(receiptId: number, points: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const receipt = await getReceiptById(receiptId);
  if (!receipt) throw new Error("Receipt not found");
  
  // Update receipt with awarded points
  await db
    .update(receipts)
    .set({ pointsAwarded: points })
    .where(eq(receipts.id, receiptId));
  
  // Create point transaction
  await createPointTransaction({
    userId: receipt.userId,
    type: "earn",
    amount: points,
    referenceType: "receipt",
    referenceId: receiptId,
    description: `レシート承認によるポイント付与 (${receipt.storeName || "不明店舗"})`,
  });
  
  return { success: true, pointsAwarded: points };
}

/**
 * Check for duplicate receipt by image hash
 */
export async function checkDuplicateReceiptByHash(imageHash: string, excludeId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // rejected（却下）のレシートは重複チェックから除外し、再申請を可能にする
  const activeStatuses = ["pending", "approved", "on_hold"];
  
  if (excludeId) {
    const result = await db
      .select()
      .from(receipts)
      .where(and(
        eq(receipts.imageHash, imageHash),
        not(eq(receipts.id, excludeId)),
        inArray(receipts.status, activeStatuses)
      ))
      .limit(1);
    return result[0] || null;
  }
  
  const result = await db
    .select()
    .from(receipts)
    .where(and(
      eq(receipts.imageHash, imageHash),
      inArray(receipts.status, activeStatuses)
    ))
    .limit(1);
  return result[0] || null;
}

/**
 * Check for duplicate receipt by store/date/amount combination
 */
export async function checkDuplicateReceiptByDetails(
  userId: number,
  storeName: string,
  purchaseDate: Date,
  totalAmount: number,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check within a 1-day window for the same store and amount
  const dayStart = new Date(purchaseDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(purchaseDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  let conditions = and(
    eq(receipts.userId, userId),
    eq(receipts.storeName, storeName),
    eq(receipts.totalAmount, totalAmount),
    gte(receipts.purchaseDate, dayStart),
    lte(receipts.purchaseDate, dayEnd)
  );
  
  if (excludeId) {
    conditions = and(conditions, not(eq(receipts.id, excludeId)));
  }
  
  const result = await db
    .select()
    .from(receipts)
    .where(conditions!)
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get recent receipts count for a user (for frequency check)
 */
export async function getRecentReceiptsCount(userId: number, hoursAgo: number = 24) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(receipts)
    .where(
      and(
        eq(receipts.userId, userId),
        gte(receipts.submittedAt, cutoff)
      )
    );
  
  return result[0]?.count || 0;
}

/**
 * Update receipt fraud flags
 */
export async function updateReceiptFraudFlags(
  id: number,
  fraudFlags: string[],
  fraudScore: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(receipts)
    .set({
      fraudFlags,
      fraudScore: fraudScore.toFixed(2),
    })
    .where(eq(receipts.id, id));
}

// --- Fraud Detection Log Functions ---

/**
 * Create a fraud detection log
 */
export async function createFraudDetectionLog(data: InsertFraudDetectionLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(fraudDetectionLogs).values(data);
}

/**
 * Get fraud detection logs for a receipt
 */
export async function getFraudLogsForReceipt(receiptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(fraudDetectionLogs)
    .where(eq(fraudDetectionLogs.receiptId, receiptId))
    .orderBy(desc(fraudDetectionLogs.createdAt));
}

/**
 * Get fraud detection logs for a user
 */
export async function getFraudLogsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(fraudDetectionLogs)
    .where(eq(fraudDetectionLogs.userId, userId))
    .orderBy(desc(fraudDetectionLogs.createdAt));
}

/**
 * Get receipt statistics
 */
export async function getReceiptStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const stats = await db
    .select({
      status: receipts.status,
      count: sql<number>`COUNT(*)`,
      totalAmount: sql<number>`COALESCE(SUM(${receipts.totalAmount}), 0)`,
      totalPoints: sql<number>`COALESCE(SUM(${receipts.pointsAwarded}), 0)`,
    })
    .from(receipts)
    .groupBy(receipts.status);
  
  return stats;
}


// =====================================================
// LINE User Point System Functions
// LINEユーザーベースのポイントシステム関数
// =====================================================

/**
 * Get or create LINE user point balance
 */
export async function getOrCreateLinePointBalance(lineUserId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db
    .select()
    .from(linePointBalances)
    .where(eq(linePointBalances.lineUserId, lineUserId))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Create new balance record
  await db.insert(linePointBalances).values({
    lineUserId,
    balance: 0,
    totalEarned: 0,
    totalUsed: 0,
  });
  
  const created = await db
    .select()
    .from(linePointBalances)
    .where(eq(linePointBalances.lineUserId, lineUserId))
    .limit(1);
  
  return created[0];
}

/**
 * Get LINE user point balance
 */
export async function getLinePointBalance(lineUserId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(linePointBalances)
    .where(eq(linePointBalances.lineUserId, lineUserId))
    .limit(1);
  
  const primaryBalance = result[0] || null;
  
  // Safety net: If lineUserId is a real LINE userId (starts with "U"),
  // also check for any orphaned email_${id} balance that wasn't merged during LINE linking.
  // This prevents points from "disappearing" if the merge failed or was skipped.
  if (lineUserId.startsWith("U")) {
    try {
      // Find the line_users record for this LINE userId to get the email user id
      const lineUserResult = await db
        .select({ id: lineUsers.id })
        .from(lineUsers)
        .where(eq(lineUsers.lineUserId, lineUserId))
        .limit(1);
      
      if (lineUserResult[0]) {
        const emailKey = `email_${lineUserResult[0].id}`;
        const emailBalanceResult = await db
          .select()
          .from(linePointBalances)
          .where(eq(linePointBalances.lineUserId, emailKey))
          .limit(1);
        
        const emailBalance = emailBalanceResult[0];
        
        if (emailBalance && emailBalance.balance > 0) {
          // Auto-merge: move email_ balance into LINE userId balance
          console.log(`[PointBalance] Auto-merging orphaned balance: ${emailKey} (${emailBalance.balance}pt) -> ${lineUserId}`);
          
          if (primaryBalance) {
            // Add email_ balance to existing LINE balance
            await db.update(linePointBalances)
              .set({
                balance: primaryBalance.balance + emailBalance.balance,
                totalEarned: primaryBalance.totalEarned + emailBalance.totalEarned,
              })
              .where(eq(linePointBalances.lineUserId, lineUserId));
            
            primaryBalance.balance += emailBalance.balance;
            primaryBalance.totalEarned += emailBalance.totalEarned;
          } else {
            // Rename email_ record to LINE userId
            await db.update(linePointBalances)
              .set({ lineUserId: lineUserId })
              .where(eq(linePointBalances.lineUserId, emailKey));
            
            return { ...emailBalance, lineUserId: lineUserId };
          }
          
          // Zero out the email_ balance to prevent double-merge
          await db.update(linePointBalances)
            .set({ balance: 0, totalEarned: 0, totalUsed: 0 })
            .where(eq(linePointBalances.lineUserId, emailKey));
        }
      }
    } catch (err) {
      // Don't let the safety net break normal operation
      console.error(`[PointBalance] Auto-merge check failed for ${lineUserId}:`, err);
    }
  }
  
  return primaryBalance;
}

/**
 * Update LINE user point balance
 */
export async function updateLinePointBalance(
  lineUserId: string,
  balanceChange: number,
  type: "earn" | "use"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Ensure balance record exists before atomic update
  await getOrCreateLinePointBalance(lineUserId);
  
  // === ATOMIC UPDATE: Use SQL-level increment to prevent race conditions ===
  // Previously used read-then-write pattern which caused balance loss during
  // concurrent batch approvals (e.g., 81 receipts for same user in 10 seconds).
  // Now uses `balance = balance + ?` which is atomic at the database level.
  if (type === "earn") {
    await db
      .update(linePointBalances)
      .set({
        balance: sql`${linePointBalances.balance} + ${balanceChange}`,
        totalEarned: sql`${linePointBalances.totalEarned} + ${balanceChange}`,
      })
      .where(eq(linePointBalances.lineUserId, lineUserId));
  } else {
    await db
      .update(linePointBalances)
      .set({
        balance: sql`${linePointBalances.balance} + ${balanceChange}`,
        totalUsed: sql`${linePointBalances.totalUsed} + ${Math.abs(balanceChange)}`,
      })
      .where(eq(linePointBalances.lineUserId, lineUserId));
  }
  
  // Read back the updated balance for return value
  const updated = await getOrCreateLinePointBalance(lineUserId);
  return { balance: updated.balance, totalEarned: updated.totalEarned, totalUsed: updated.totalUsed };
}

/**
 * Create LINE user point transaction
 */
export async function createLinePointTransaction(data: {
  lineUserId: string;
  type: "earn" | "use" | "expire" | "refund" | "adjustment";
  amount: number;
  referenceType: "receipt" | "order" | "manual" | "system";
  referenceId?: number;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current balance
  const balance = await getOrCreateLinePointBalance(data.lineUserId);
  const balanceAfter = balance.balance + data.amount;
  
  // Calculate expiration for earn-type transactions (3 months from now)
  const expiresAt = (data.type === "earn" || data.type === "refund")
    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 3 months (90 days)
    : null;
  const remainingAmount = (data.type === "earn" || data.type === "refund")
    ? data.amount
    : null;
  
  // Create transaction
  await db.insert(linePointTransactions).values({
    lineUserId: data.lineUserId,
    type: data.type,
    amount: data.amount,
    balanceAfter,
    referenceType: data.referenceType,
    referenceId: data.referenceId,
    description: data.description,
    expiresAt,
    remainingAmount,
  });
  
  // Update balance
  if (data.type === "earn" || data.type === "refund") {
    await updateLinePointBalance(data.lineUserId, data.amount, "earn");
  } else if (data.type === "use") {
    await updateLinePointBalance(data.lineUserId, data.amount, "use");
  } else {
    // For expire and adjustment, use atomic SQL increment
    await db
      .update(linePointBalances)
      .set({ balance: sql`${linePointBalances.balance} + ${data.amount}` })
      .where(eq(linePointBalances.lineUserId, data.lineUserId));
  }
  
  return { balanceAfter };
}

/**
 * Get LINE user point transactions
 */
export async function getLinePointTransactions(
  lineUserId: string,
  options?: { limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db
    .select()
    .from(linePointTransactions)
    .where(eq(linePointTransactions.lineUserId, lineUserId))
    .orderBy(desc(linePointTransactions.createdAt));
  
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }
  
  return await query;
}

// --- LINE Receipt Functions ---

/**
 * Create a new LINE receipt
 */
export async function createLineReceipt(data: InsertLineReceipt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(lineReceipts).values(data);
  return result[0].insertId;
}

/**
 * Get LINE receipt by ID
 */
export async function getLineReceiptById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(lineReceipts)
    .where(eq(lineReceipts.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get LINE receipts for a user
 */
export async function getLineReceiptsByUser(lineUserId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(lineReceipts)
    .where(eq(lineReceipts.lineUserId, lineUserId))
    .orderBy(desc(lineReceipts.submittedAt));
}

/**
 * Get all LINE receipts with filters (for admin)
 */
export async function getAllLineReceipts(options?: {
  status?: "pending" | "approved" | "rejected" | "on_hold";
  statuses?: ("pending" | "approved" | "rejected" | "on_hold")[];
  dateFrom?: Date;
  dateTo?: Date;
  searchText?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions = [];
  
  // Status filter: support single status (backward compat) or multiple statuses
  if (options?.statuses && options.statuses.length > 0) {
    conditions.push(inArray(lineReceipts.status, options.statuses));
  } else if (options?.status) {
    conditions.push(eq(lineReceipts.status, options.status));
  }
  
  // Date range filter
  if (options?.dateFrom) {
    conditions.push(gte(lineReceipts.submittedAt, options.dateFrom));
  }
  if (options?.dateTo) {
    conditions.push(lte(lineReceipts.submittedAt, options.dateTo));
  }
  
  // Text search: search across orderNumber (in ocrRawText JSON), storeName, user displayName, ocrRawText content
  if (options?.searchText) {
    const searchPattern = `%${options.searchText}%`;
    conditions.push(
      or(
        like(lineReceipts.storeName, searchPattern),
        sql`LOWER(${lineReceipts.ocrRawText}) LIKE LOWER(${searchPattern})`,
        like(lineUsers.displayName, searchPattern),
      )!
    );
  }
  
  let query = db
    .select({
      receipt: lineReceipts,
      lineUser: lineUsers,
    })
    .from(lineReceipts)
    .leftJoin(lineUsers, eq(lineReceipts.lineUserId, lineUsers.lineUserId))
    .orderBy(desc(lineReceipts.submittedAt));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }
  
  return await query;
}

/**
 * Get pending LINE receipts count
 */
export async function getPendingLineReceiptsCount() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(lineReceipts)
    .where(eq(lineReceipts.status, "pending"));
  
  return result[0]?.count || 0;
}

/**
 * Update LINE receipt OCR data
 */
export async function updateLineReceiptOcr(
  id: number,
  data: {
    storeName?: string;
    purchaseDate?: Date;
    totalAmount?: number;
    currency?: string;
    ocrRawText?: string;
    ocrConfidence?: string;
    pointsCalculated?: number;
    imageHash?: string;
    imageUrls?: string[];
    imageKeys?: string[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(lineReceipts)
    .set(data)
    .where(eq(lineReceipts.id, id));
}

/**
 * Update LINE receipt status
 */
export async function updateLineReceiptStatus(
  id: number,
  status: "pending" | "approved" | "rejected" | "on_hold",
  reviewedBy: number,
  reviewNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(lineReceipts)
    .set({
      status,
      reviewedBy,
      reviewedAt: new Date(),
      reviewNote,
    })
    .where(eq(lineReceipts.id, id));
}

/**
 * Delete a LINE receipt record
 * Used when OCR analysis fails to clean up incomplete records
 */
export async function deleteLineReceipt(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(lineReceipts)
    .where(eq(lineReceipts.id, id));
  
  console.log(`[DB] Deleted LINE receipt ${id}`);
}

/**
 * Award points for an approved LINE receipt
 */
export async function awardPointsForLineReceipt(receiptId: number, points: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const receipt = await getLineReceiptById(receiptId);
  if (!receipt) throw new Error("Receipt not found");
  
  // === IDEMPOTENT CHECK: Prevent double point award ===
  // Check 1: Receipt already has points awarded
  if (receipt.pointsAwarded && receipt.pointsAwarded > 0) {
    console.warn(`[PointGuard] Receipt #${receiptId} already has ${receipt.pointsAwarded} points awarded. Skipping.`);
    return { success: true, pointsAwarded: receipt.pointsAwarded, skipped: true, reason: "already_awarded" };
  }
  
  // Check 2: Transaction already exists for this receipt (belt-and-suspenders)
  const existingTx = await db
    .select({ id: linePointTransactions.id, amount: linePointTransactions.amount })
    .from(linePointTransactions)
    .where(
      and(
        eq(linePointTransactions.referenceType, "receipt"),
        eq(linePointTransactions.referenceId, receiptId),
        eq(linePointTransactions.type, "earn")
      )
    )
    .limit(1);
  
  if (existingTx.length > 0) {
    console.warn(`[PointGuard] Transaction already exists for receipt #${receiptId} (tx #${existingTx[0].id}, ${existingTx[0].amount}pt). Skipping.`);
    // Sync pointsAwarded on receipt if it was somehow missed
    await db
      .update(lineReceipts)
      .set({ pointsAwarded: existingTx[0].amount })
      .where(eq(lineReceipts.id, receiptId));
    return { success: true, pointsAwarded: existingTx[0].amount, skipped: true, reason: "transaction_exists" };
  }
  
  // === Safe to award ===
  // Update receipt with awarded points
  await db
    .update(lineReceipts)
    .set({ pointsAwarded: points })
    .where(eq(lineReceipts.id, receiptId));
  
  // Create point transaction
  await createLinePointTransaction({
    lineUserId: receipt.lineUserId,
    type: "earn",
    amount: points,
    referenceType: "receipt",
    referenceId: receiptId,
    description: `レシート承認によるポイント付与 (${receipt.storeName || "不明店舗"})`,
  });
  
  return { success: true, pointsAwarded: points, skipped: false };
}

/**
 * Check for duplicate LINE receipt by image hash
 */
export async function checkDuplicateLineReceiptByHash(imageHash: string, excludeId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // rejected（却下）のレシートは重複チェックから除外し、再申請を可能にする
  const activeStatuses = ["pending", "approved", "on_hold"];
  
  if (excludeId) {
    const result = await db
      .select()
      .from(lineReceipts)
      .where(and(
        eq(lineReceipts.imageHash, imageHash),
        not(eq(lineReceipts.id, excludeId)),
        inArray(lineReceipts.status, activeStatuses)
      ))
      .limit(1);
    return result[0] || null;
  }
  
  const result = await db
    .select()
    .from(lineReceipts)
    .where(and(
      eq(lineReceipts.imageHash, imageHash),
      inArray(lineReceipts.status, activeStatuses)
    ))
    .limit(1);
  return result[0] || null;
}

/**
 * Check for duplicate LINE receipt by details
 */
export async function checkDuplicateLineReceiptByDetails(
  lineUserId: string,
  storeName: string,
  purchaseDate: Date,
  totalAmount: number,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check within a 1-day window for the same store and amount
  const dayStart = new Date(purchaseDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(purchaseDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  let conditions = and(
    eq(lineReceipts.lineUserId, lineUserId),
    eq(lineReceipts.storeName, storeName),
    eq(lineReceipts.totalAmount, totalAmount),
    gte(lineReceipts.purchaseDate, dayStart),
    lte(lineReceipts.purchaseDate, dayEnd)
  );
  
  if (excludeId) {
    conditions = and(conditions, not(eq(lineReceipts.id, excludeId)));
  }
  
  const result = await db
    .select()
    .from(lineReceipts)
    .where(conditions!)
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get recent LINE receipts count for a user
 */
export async function getRecentLineReceiptsCount(lineUserId: string, hoursAgo: number = 24) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(lineReceipts)
    .where(
      and(
        eq(lineReceipts.lineUserId, lineUserId),
        gte(lineReceipts.submittedAt, cutoff)
      )
    );
  
  return result[0]?.count || 0;
}

/**
 * Update LINE receipt fraud flags
 */
export async function updateLineReceiptFraudFlags(
  id: number,
  fraudFlags: string[],
  fraudScore: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(lineReceipts)
    .set({
      fraudFlags,
      fraudScore: fraudScore.toFixed(2),
    })
    .where(eq(lineReceipts.id, id));
}

/**
 * Create LINE fraud detection log
 */
export async function createLineFraudDetectionLog(data: InsertLineFraudDetectionLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(lineFraudDetectionLogs).values(data);
}

/**
 * Get LINE fraud logs for a receipt
 */
export async function getLineFraudLogsForReceipt(receiptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(lineFraudDetectionLogs)
    .where(eq(lineFraudDetectionLogs.receiptId, receiptId))
    .orderBy(desc(lineFraudDetectionLogs.createdAt));
}

/**
 * Get LINE receipt statistics
 */
export async function getLineReceiptStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [pending, approved, rejected, onHold, totalPoints] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(lineReceipts).where(eq(lineReceipts.status, "pending")),
    db.select({ count: sql<number>`COUNT(*)` }).from(lineReceipts).where(eq(lineReceipts.status, "approved")),
    db.select({ count: sql<number>`COUNT(*)` }).from(lineReceipts).where(eq(lineReceipts.status, "rejected")),
    db.select({ count: sql<number>`COUNT(*)` }).from(lineReceipts).where(eq(lineReceipts.status, "on_hold")),
    db.select({ total: sql<number>`COALESCE(SUM(pointsAwarded), 0)` }).from(lineReceipts).where(eq(lineReceipts.status, "approved")),
  ]);
  
  return {
    pending: pending[0]?.count || 0,
    approved: approved[0]?.count || 0,
    rejected: rejected[0]?.count || 0,
    onHold: onHold[0]?.count || 0,
    totalPointsAwarded: totalPoints[0]?.total || 0,
  };
}


/**
 * Detect duplicate LINE receipts by order number (with detailed info for cross-linking)
 * ocrRawTextから注文番号を抽出し、同じ注文番号を持つレシートをグループ化して返す
 * 各レシートの詳細情報（ステータス・金額・ユーザー名・画像・ソース）も含めて返す
 */
export async function detectDuplicateLineReceipts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get all LINE receipts with ocrRawText
  const allLineReceipts = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      ocrRawText: lineReceipts.ocrRawText,
      status: lineReceipts.status,
      totalAmount: lineReceipts.totalAmount,
      submittedAt: lineReceipts.submittedAt,
      imageUrl: lineReceipts.imageUrl,
    })
    .from(lineReceipts)
    .where(isNotNull(lineReceipts.ocrRawText));
  
  // Get all point requests with order numbers
  const allPointRequests = await db
    .select({
      id: pointRequests.id,
      userId: pointRequests.userId,
      orderNumber: pointRequests.orderNumber,
      orderAmount: pointRequests.orderAmount,
      status: pointRequests.status,
      createdAt: pointRequests.createdAt,
      receiptImageUrl: pointRequests.receiptImageUrl,
    })
    .from(pointRequests);
  
  // Get LINE user display names for lookup
  const lineUserRows = await db
    .select({
      lineUserId: lineUsers.lineUserId,
      displayName: lineUsers.displayName,
    })
    .from(lineUsers);
  const lineUserNameMap = new Map<string, string>();
  for (const u of lineUserRows) {
    if (u.lineUserId && u.displayName) {
      lineUserNameMap.set(u.lineUserId, u.displayName);
    }
  }
  
  // Get user display names for point requests
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users);
  const userNameMap = new Map<number, string>();
  for (const u of userRows) {
    if (u.name) {
      userNameMap.set(u.id, u.name);
    }
  }
  
  type DuplicateReceiptDetail = {
    id: number;
    source: "line_receipt" | "point_request";
    status: string;
    totalAmount: number | null;
    userName: string;
    imageUrl: string | null;
    submittedAt: Date | string | null;
  };
  
  // Build order number -> receipt details map
  const orderNumberMap = new Map<string, DuplicateReceiptDetail[]>();
  
  for (const receipt of allLineReceipts) {
    let orderNumber: string | null = null;
    if (receipt.ocrRawText) {
      try {
        const parsed = JSON.parse(receipt.ocrRawText);
        orderNumber = parsed.orderNumber || null;
      } catch {
        const match = receipt.ocrRawText.match(/\b(\d{16,19})\b/);
        orderNumber = match ? match[1] : null;
      }
    }
    if (orderNumber) {
      const existing = orderNumberMap.get(orderNumber) || [];
      existing.push({
        id: receipt.id,
        source: "line_receipt",
        status: receipt.status,
        totalAmount: receipt.totalAmount,
        userName: lineUserNameMap.get(receipt.lineUserId) || receipt.lineUserId,
        imageUrl: receipt.imageUrl,
        submittedAt: receipt.submittedAt,
      });
      orderNumberMap.set(orderNumber, existing);
    }
  }
  
  // Also add point requests to the map
  for (const pr of allPointRequests) {
    if (pr.orderNumber) {
      const existing = orderNumberMap.get(pr.orderNumber) || [];
      existing.push({
        id: pr.id,
        source: "point_request",
        status: pr.status,
        totalAmount: pr.orderAmount,
        userName: userNameMap.get(pr.userId) || `User#${pr.userId}`,
        imageUrl: pr.receiptImageUrl,
        submittedAt: pr.createdAt,
      });
      orderNumberMap.set(pr.orderNumber, existing);
    }
  }
  
  // Filter to only duplicates (2+ receipts with same order number)
  const duplicates: { orderNumber: string; receiptIds: number[]; receipts: DuplicateReceiptDetail[] }[] = [];
  orderNumberMap.forEach((details, orderNumber) => {
    if (details.length >= 2) {
      duplicates.push({
        orderNumber,
        receiptIds: details.filter(d => d.source === "line_receipt").map(d => d.id),
        receipts: details,
      });
    }
  });
  
  return duplicates;
}

/**
 * 特定のレシートIDが重複しているかチェックする
 * 返り値: 重複している場合はそのレシートIDリスト、していない場合はnull
 */
export async function checkLineReceiptDuplicateByOrderNumber(receiptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const receipt = await db.select().from(lineReceipts).where(eq(lineReceipts.id, receiptId));
  if (!receipt[0]?.ocrRawText) return null;
  
  let orderNumber: string | null = null;
  try {
    const parsed = JSON.parse(receipt[0].ocrRawText);
    orderNumber = parsed.orderNumber || null;
  } catch {
    const match = receipt[0].ocrRawText.match(/\b(\d{16,19})\b/);
    orderNumber = match ? match[1] : null;
  }
  
  if (!orderNumber) return null;
  
  // Find other receipts with same order number
  const allReceipts = await db
    .select({ id: lineReceipts.id, ocrRawText: lineReceipts.ocrRawText })
    .from(lineReceipts)
    .where(and(
      isNotNull(lineReceipts.ocrRawText),
      not(eq(lineReceipts.id, receiptId))
    ));
  
  const duplicateIds: number[] = [];
  for (const r of allReceipts) {
    if (!r.ocrRawText) continue;
    let otherOrderNumber: string | null = null;
    try {
      const parsed = JSON.parse(r.ocrRawText);
      otherOrderNumber = parsed.orderNumber || null;
    } catch {
      const match = r.ocrRawText.match(/\b(\d{16,19})\b/);
      otherOrderNumber = match ? match[1] : null;
    }
    if (otherOrderNumber === orderNumber) {
      duplicateIds.push(r.id);
    }
  }
  
  return duplicateIds.length > 0 ? { orderNumber, duplicateIds } : null;
}

// ============================================
// MALL商品管理
// ============================================

// 商品一覧取得
export async function getMallProducts(options?: {
  status?: "draft" | "active" | "sold_out" | "archived";
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (options?.status) {
    conditions.push(eq(mallProducts.status, options.status));
  }
  if (options?.category) {
    conditions.push(eq(mallProducts.category, options.category));
  }

  let query = db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      description: mallProducts.description,
      category: mallProducts.category,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      stock: mallProducts.stock,
      imageUrl: mallProducts.imageUrl,
      imageKey: mallProducts.imageKey,
      imageUrls: mallProducts.imageUrls,
      imageKeys: mallProducts.imageKeys,
      status: mallProducts.status,
      sortOrder: mallProducts.sortOrder,
      createdAt: mallProducts.createdAt,
      updatedAt: mallProducts.updatedAt,
      brandId: mallProducts.brandId,
      categoryId: mallProducts.categoryId,
      brandName: mallBrands.name,
      categoryName: mallCategories.name,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(asc(mallProducts.sortOrder), desc(mallProducts.createdAt)) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return await query;
}

// ブランドID（brandsテーブル）でMALL商品を取得
export async function getMallProductsByBrandIdDirect(brandId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      description: mallProducts.description,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      stock: mallProducts.stock,
      imageUrl: mallProducts.imageUrl,
      imageUrls: mallProducts.imageUrls,
      status: mallProducts.status,
      sortOrder: mallProducts.sortOrder,
      commissionRate: mallProducts.commissionRate,
      categoryId: mallProducts.categoryId,
      categoryName: mallCategories.name,
      createdAt: mallProducts.createdAt,
    })
    .from(mallProducts)
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id))
    .where(eq(mallProducts.brandId, brandId))
    .orderBy(asc(mallProducts.sortOrder), desc(mallProducts.createdAt));
}

// 商品詳細取得
export async function getMallProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(mallProducts).where(eq(mallProducts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// 商品作成
export async function createMallProduct(data: InsertMallProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(mallProducts).values(data);
  return result;
}

// 商品更新
export async function updateMallProduct(id: number, data: Partial<InsertMallProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(mallProducts).set(data).where(eq(mallProducts.id, id));
}

// 商品削除
export async function deleteMallProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(mallProducts).where(eq(mallProducts.id, id));
}

// 商品在庫更新
export async function updateMallProductStock(id: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(mallProducts)
    .set({ stock: sql`${mallProducts.stock} + ${quantity}` })
    .where(eq(mallProducts.id, id));
}

// カテゴリ一覧取得
export async function getMallCategories() {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .selectDistinct({ category: mallProducts.category })
    .from(mallProducts)
    .where(isNotNull(mallProducts.category));
  
  return result.map(r => r.category).filter(Boolean) as string[];
}

// ============================================
// MALLブランド管理
// ============================================

export async function getAllMallBrands() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallBrands).orderBy(asc(mallBrands.sortOrder), asc(mallBrands.name));
}

export async function getMallBrandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mallBrands).where(eq(mallBrands.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMallBrand(data: InsertMallBrand) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mallBrands).values(data);
  return result;
}

export async function updateMallBrand(id: number, data: Partial<InsertMallBrand>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mallBrands).set(data).where(eq(mallBrands.id, id));
}

export async function deleteMallBrand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallBrands).where(eq(mallBrands.id, id));
}

// ============================================
// MALLカテゴリ管理
// ============================================

export async function getAllMallCategoryRecords() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mallCategories).orderBy(asc(mallCategories.sortOrder), asc(mallCategories.name));
}

export async function getMallCategoryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mallCategories).where(eq(mallCategories.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMallCategory(data: InsertMallCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mallCategories).values(data);
  return result;
}

export async function updateMallCategory(id: number, data: Partial<InsertMallCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mallCategories).set(data).where(eq(mallCategories.id, id));
}

export async function deleteMallCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallCategories).where(eq(mallCategories.id, id));
}

// ============================================
// MALLカート管理
// ============================================

// カート取得
export async function getMallCart(lineUserId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select({
    cart: mallCarts,
    product: mallProducts,
  })
    .from(mallCarts)
    .innerJoin(mallProducts, eq(mallCarts.productId, mallProducts.id))
    .where(eq(mallCarts.lineUserId, lineUserId));
}

// カートに追加
export async function addToMallCart(lineUserId: number, productId: number, quantity: number = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 既存のカートアイテムを確認
  const existing = await db.select()
    .from(mallCarts)
    .where(and(
      eq(mallCarts.lineUserId, lineUserId),
      eq(mallCarts.productId, productId)
    ))
    .limit(1);

  if (existing.length > 0) {
    // 数量を更新
    await db.update(mallCarts)
      .set({ quantity: sql`${mallCarts.quantity} + ${quantity}` })
      .where(eq(mallCarts.id, existing[0].id));
  } else {
    // 新規追加
    await db.insert(mallCarts).values({
      lineUserId,
      productId,
      quantity,
    });
  }
}

// カート数量更新
export async function updateMallCartQuantity(lineUserId: number, productId: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (quantity <= 0) {
    await db.delete(mallCarts)
      .where(and(
        eq(mallCarts.lineUserId, lineUserId),
        eq(mallCarts.productId, productId)
      ));
  } else {
    await db.update(mallCarts)
      .set({ quantity })
      .where(and(
        eq(mallCarts.lineUserId, lineUserId),
        eq(mallCarts.productId, productId)
      ));
  }
}

// カートから削除
export async function removeFromMallCart(lineUserId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(mallCarts)
    .where(and(
      eq(mallCarts.lineUserId, lineUserId),
      eq(mallCarts.productId, productId)
    ));
}

// カートをクリア
export async function clearMallCart(lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(mallCarts).where(eq(mallCarts.lineUserId, lineUserId));
}

// ============================================
// MALL注文管理
// ============================================

// 注文番号生成
function generateOrderNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LCJ${dateStr}${randomStr}`;
}

// 注文作成
export async function createMallOrder(data: {
  lineUserId: number;
  pointLineUserId?: string; // ポイント消費用のキー（email_${id}またはLINE userId）
  items: Array<{
    productId: number;
    quantity: number;
    usePoints: boolean;
  }>;
  pointsToUse: number;
  isFullPointPurchase?: boolean; // ポイント全額購入フラグ
  shippingInfo?: {
    name?: string;
    phone?: string;
    postalCode?: string;
    address?: string;
  };
  shippingFee?: number; // 送料
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 商品情報を取得
  const productIds = data.items.map(item => item.productId);
  const products = await db.select()
    .from(mallProducts)
    .where(inArray(mallProducts.id, productIds));

  const productMap = new Map(products.map(p => [p.id, p]));

  // 合計金額を計算
  let totalAmount = 0;
  const orderItems: Array<{
    productId: number;
    productName: string;
    productPrice: number;
    productPointPrice: number | null;
    quantity: number;
    subtotal: number;
    pointSubtotal: number;
  }> = [];

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    const subtotal = product.price * item.quantity;
    totalAmount += subtotal;

    orderItems.push({
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      productPointPrice: product.pointPrice,
      quantity: item.quantity,
      subtotal,
      pointSubtotal: 0,
    });
  }

  // ポイント使用を計算
  let pointsUsed: number;
  let cashAmount: number;
  let paymentMethod: "stripe" | "points" | "cod";
  let status: "pending" | "paid" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";

  if (data.isFullPointPurchase) {
    // ポイント全額購入: ポイント価格ベースで計算（円価格との差額は不要）
    pointsUsed = data.pointsToUse;
    cashAmount = 0;
    paymentMethod = "points";
    status = "paid"; // ポイント全額購入は即決済完了
  } else {
    // 通常購入（Stripe等）: 円価格ベースで計算
    pointsUsed = Math.min(data.pointsToUse, totalAmount);
    cashAmount = totalAmount - pointsUsed;
    paymentMethod = cashAmount === 0 ? "points" : "stripe";
    status = cashAmount === 0 ? "paid" : "pending";
  }

  // 注文を作成
  const orderNumber = generateOrderNumber();
  const [orderResult] = await db.insert(mallOrders).values({
    orderNumber,
    lineUserId: data.lineUserId,
    totalAmount,
    pointsUsed,
    cashAmount,
    paymentMethod,
    status,
    shippingName: data.shippingInfo?.name,
    shippingPhone: data.shippingInfo?.phone,
    shippingPostalCode: data.shippingInfo?.postalCode,
    shippingAddress: data.shippingInfo?.address,
    notes: data.notes,
  });

  const orderId = orderResult.insertId;

  // 注文明細を作成
  for (const item of orderItems) {
    await db.insert(mallOrderItems).values({
      orderId,
      ...item,
    });
  }

  // 在庫を減らす
  for (const item of data.items) {
    await db.update(mallProducts)
      .set({ stock: sql`${mallProducts.stock} - ${item.quantity}` })
      .where(eq(mallProducts.id, item.productId));
  }

  // ポイントを消費
  if (pointsUsed > 0) {
    // ポイント残高を更新
    await db.update(linePointBalances)
      .set({ 
        balance: sql`${linePointBalances.balance} - ${pointsUsed}`,
        totalUsed: sql`${linePointBalances.totalUsed} + ${pointsUsed}`,
      })
      .where(eq(linePointBalances.lineUserId, data.pointLineUserId || String(data.lineUserId)));

    // ポイント取引履歴を追加
    await db.insert(linePointTransactions).values({
      lineUserId: data.pointLineUserId || String(data.lineUserId),
      type: "use",
      amount: -pointsUsed,
      balanceAfter: 0, // 後で更新
      description: `LCJ MALL注文 ${orderNumber}`,
      referenceType: "order",
      referenceId: orderId,
    });
  }

  // カートをクリア
  await clearMallCart(data.lineUserId);

  // 住所自動保存: 注文時の配送先情報をuser_addressesに自動保存
  try {
    if (data.shippingInfo?.name && data.shippingInfo?.postalCode && data.shippingInfo?.address) {
      await autoSaveShippingAddress(data.lineUserId, data.shippingInfo);
    }
  } catch (addrError) {
    // 住所保存に失敗しても注文自体は成功とする
    console.error("[createMallOrder] 住所自動保存エラー:", addrError);
  }

  return { orderId, orderNumber, totalAmount, pointsUsed, cashAmount };
}

/**
 * 注文キャンセル（ポイント返還・在庫戻し含む）
 */
export async function cancelMallOrder(
  orderId: number,
  cancelReason?: string
): Promise<{ success: boolean; pointsRefunded: number; stripeRefunded: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 注文情報を取得
  const [order] = await db.select().from(mallOrders).where(eq(mallOrders.id, orderId)).limit(1);
  if (!order) throw new Error("注文が見つかりません");

  // キャンセル可能なステータスか確認（未発送のもののみ）
  const cancellableStatuses = ["pending", "paid", "confirmed"];
  if (!cancellableStatuses.includes(order.status)) {
    throw new Error("この注文はキャンセルできません（発送済みまたは完了済み）");
  }

  // 注文明細を取得
  const items = await db.select().from(mallOrderItems).where(eq(mallOrderItems.orderId, orderId));

  // 1. 在庫を戻す
  for (const item of items) {
    await db.update(mallProducts)
      .set({ stock: sql`${mallProducts.stock} + ${item.quantity}` })
      .where(eq(mallProducts.id, item.productId));
  }

  // 2. ポイントを返還（ポイント使用があった場合）
  let pointsRefunded = 0;
  if (order.pointsUsed > 0) {
    // ユーザーのlineUserIdを取得
    const [lineUser] = await db.select().from(lineUsers).where(eq(lineUsers.id, order.lineUserId)).limit(1);
    if (lineUser) {
      const pointLineUserId = lineUser.lineUserId || `email_${lineUser.id}`;
      
      // ポイント残高を戻す
      await db.update(linePointBalances)
        .set({
          balance: sql`${linePointBalances.balance} + ${order.pointsUsed}`,
          totalUsed: sql`${linePointBalances.totalUsed} - ${order.pointsUsed}`,
        })
        .where(eq(linePointBalances.lineUserId, pointLineUserId));

      // ポイント取引履歴に返還記録を追加
      const currentBalance = await db.select().from(linePointBalances).where(eq(linePointBalances.lineUserId, pointLineUserId)).limit(1);
      await db.insert(linePointTransactions).values({
        lineUserId: pointLineUserId,
        type: "refund",
        amount: order.pointsUsed,
        balanceAfter: currentBalance[0]?.balance ?? order.pointsUsed,
        description: `注文キャンセルによるポイント返還 (注文番号: ${order.orderNumber})`,
        referenceType: "order",
        referenceId: orderId,
      });

      pointsRefunded = order.pointsUsed;
    }
  }

  // 3. Stripe自動返金（カード決済済みの場合）
  let stripeRefunded = false;
  if (order.paymentMethod === "stripe" && order.stripePaymentIntentId && 
      (order.status === "paid" || order.status === "confirmed")) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
        apiVersion: "2025-01-27.acacia" as any,
      });
      await stripeClient.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        reason: "requested_by_customer",
      });
      stripeRefunded = true;
      console.log(`[CancelOrder] Stripe返金成功: 注文${order.orderNumber}, PaymentIntent: ${order.stripePaymentIntentId}`);
    } catch (stripeErr) {
      console.error(`[CancelOrder] Stripe返金エラー: 注文${order.orderNumber}:`, stripeErr);
      // Stripe返金失敗でもキャンセル自体は続行する
    }
  }

  // 4. 注文ステータスをキャンセルに更新
  await db.update(mallOrders)
    .set({
      status: stripeRefunded ? "refunded" : "cancelled",
      cancelledAt: new Date(),
      cancelReason: cancelReason || "ユーザーによるキャンセル",
    })
    .where(eq(mallOrders.id, orderId));

  return { success: true, pointsRefunded, stripeRefunded };
}

// 注文一覧取得（管理者用）
export async function getMallOrders(options?: {
  status?: "pending" | "paid" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";
  lineUserId?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select({
    order: mallOrders,
    lineUser: lineUsers,
  })
    .from(mallOrders)
    .leftJoin(lineUsers, eq(mallOrders.lineUserId, lineUsers.id));

  const conditions = [];
  if (options?.status) {
    conditions.push(eq(mallOrders.status, options.status));
  }
  if (options?.lineUserId) {
    conditions.push(eq(mallOrders.lineUserId, options.lineUserId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(desc(mallOrders.createdAt)) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return await query;
}

// 注文詳細取得
export async function getMallOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const orders = await db.select({
    order: mallOrders,
    lineUser: lineUsers,
  })
    .from(mallOrders)
    .leftJoin(lineUsers, eq(mallOrders.lineUserId, lineUsers.id))
    .where(eq(mallOrders.id, id))
    .limit(1);

  if (orders.length === 0) return undefined;

  const items = await db.select()
    .from(mallOrderItems)
    .where(eq(mallOrderItems.orderId, id));

  return {
    ...orders[0],
    items,
  };
}

// 注文ステータス更新
export async function updateMallOrderStatus(
  id: number, 
  status: "pending" | "paid" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded",
  adminNotes?: string,
  shippingInfo?: { shippingCarrier?: string; trackingNumber?: string }
): Promise<{ pointsRefunded: number; stockRestored: boolean; stripeRefunded: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let pointsRefunded = 0;
  let stockRestored = false;

  // キャンセル・返金時のポイント返還・在庫戻し・Stripe返金処理
  let stripeRefunded = false;
  if (status === "cancelled" || status === "refunded") {
    // 注文情報を取得
    const [order] = await db.select().from(mallOrders).where(eq(mallOrders.id, id)).limit(1);
    if (order && order.status !== "cancelled" && order.status !== "refunded") {
      // 1. 在庫を戻す
      const items = await db.select().from(mallOrderItems).where(eq(mallOrderItems.orderId, id));
      for (const item of items) {
        await db.update(mallProducts)
          .set({ stock: sql`${mallProducts.stock} + ${item.quantity}` })
          .where(eq(mallProducts.id, item.productId));
      }
      stockRestored = items.length > 0;

      // 2. ポイントを返還（ポイント使用があった場合）
      if (order.pointsUsed > 0) {
        const [lineUser] = await db.select().from(lineUsers).where(eq(lineUsers.id, order.lineUserId)).limit(1);
        if (lineUser) {
          const pointLineUserId = lineUser.lineUserId || `email_${lineUser.id}`;

          // ポイント残高を戻す
          await db.update(linePointBalances)
            .set({
              balance: sql`${linePointBalances.balance} + ${order.pointsUsed}`,
              totalUsed: sql`${linePointBalances.totalUsed} - ${order.pointsUsed}`,
            })
            .where(eq(linePointBalances.lineUserId, pointLineUserId));

          // ポイント取引履歴に返還記録を追加
          const currentBalance = await db.select().from(linePointBalances).where(eq(linePointBalances.lineUserId, pointLineUserId)).limit(1);
          await db.insert(linePointTransactions).values({
            lineUserId: pointLineUserId,
            type: "refund",
            amount: order.pointsUsed,
            balanceAfter: currentBalance[0]?.balance ?? order.pointsUsed,
            description: `管理者による注文${status === "cancelled" ? "キャンセル" : "返金"}でのポイント返還 (注文番号: ${order.orderNumber})`,
            referenceType: "order",
            referenceId: id,
          });

          pointsRefunded = order.pointsUsed;
        }
      }

      // 3. Stripe自動返金（カード決済済みの場合）
      if (order.paymentMethod === "stripe" && order.stripePaymentIntentId &&
          (order.status === "paid" || order.status === "confirmed")) {
        try {
          const Stripe = (await import("stripe")).default;
          const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
            apiVersion: "2025-01-27.acacia" as any,
          });
          await stripeClient.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            reason: "requested_by_customer",
          });
          stripeRefunded = true;
          console.log(`[AdminOrderStatus] Stripe返金成功: 注文${order.orderNumber}, PaymentIntent: ${order.stripePaymentIntentId}`);
        } catch (stripeErr) {
          console.error(`[AdminOrderStatus] Stripe返金エラー: 注文${order.orderNumber}:`, stripeErr);
          // Stripe返金失敗でもステータス更新は続行する
        }
      }
    }
  }

  const updateData: Record<string, any> = { status };
  
  if (status === "shipped") {
    updateData.shippedAt = new Date();
  } else if (status === "delivered") {
    updateData.deliveredAt = new Date();
  } else if (status === "cancelled" || status === "refunded") {
    updateData.cancelledAt = new Date();
    if (adminNotes) {
      updateData.cancelReason = adminNotes;
    }
  }
  
  if (adminNotes !== undefined) {
    updateData.adminNotes = adminNotes;
  }
  
  if (shippingInfo?.shippingCarrier !== undefined) {
    updateData.shippingCarrier = shippingInfo.shippingCarrier;
  }
  if (shippingInfo?.trackingNumber !== undefined) {
    updateData.trackingNumber = shippingInfo.trackingNumber;
  }

  await db.update(mallOrders).set(updateData).where(eq(mallOrders.id, id));

  return { pointsRefunded, stockRestored, stripeRefunded };
}

// Stripe情報で注文を更新
export async function updateMallOrderStripeInfo(
  orderId: number,
  data: {
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    status?: "pending" | "paid" | "confirmed" | "shipped" | "delivered" | "cancelled" | "refunded";
    paymentMethod?: "stripe" | "points" | "cod";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mallOrders).set(data).where(eq(mallOrders.id, orderId));
}

// 注文番号で注文を取得
export async function getMallOrderByOrderNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select()
    .from(mallOrders)
    .where(eq(mallOrders.orderNumber, orderNumber))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// StripeセッションIDで注文を取得
export async function getMallOrderByStripeSessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select()
    .from(mallOrders)
    .where(eq(mallOrders.stripeSessionId, sessionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ユーザーの注文一覧取得
export async function getMallOrdersByLineUser(lineUserId: number) {
  const db = await getDb();
  if (!db) return [];

  const orders = await db.select()
    .from(mallOrders)
    .where(eq(mallOrders.lineUserId, lineUserId))
    .orderBy(desc(mallOrders.createdAt));

  // 各注文の明細を取得（商品画像URLをJOINで取得）
  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const itemsRaw = await db.select({
        item: mallOrderItems,
        productImageUrl: mallProducts.imageUrl,
        productImageUrls: mallProducts.imageUrls,
      })
        .from(mallOrderItems)
        .leftJoin(mallProducts, eq(mallOrderItems.productId, mallProducts.id))
        .where(eq(mallOrderItems.orderId, order.id));
      
      const items = itemsRaw.map(row => ({
        ...row.item,
        productImageUrl: row.productImageUrl || null,
        productImageUrls: row.productImageUrls || null,
      }));
      return { ...order, items };
    })
  );

  return ordersWithItems;
}


/**
 * Use LINE points for purchase
 */
export async function useLinePoints(
  lineUserId: string,
  amount: number,
  description: string
) {
  return await createLinePointTransaction({
    lineUserId,
    type: "use",
    amount: -amount, // Negative for spending
    referenceType: "order",
    description,
  });
}


// ===== User Address Management Functions =====

/**
 * Get all addresses for a LINE user
 */
export async function getUserAddresses(lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.lineUserId, lineUserId))
    .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));
}

/**
 * Get a single address by ID
 */
export async function getUserAddressById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.id, id))
    .limit(1);
  return result[0] || null;
}

/**
 * Get default address for a LINE user
 */
export async function getDefaultUserAddress(lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(userAddresses)
    .where(and(
      eq(userAddresses.lineUserId, lineUserId),
      eq(userAddresses.isDefault, true)
    ))
    .limit(1);
  return result[0] || null;
}

/**
 * Create a new address
 */
export async function createUserAddress(data: InsertUserAddress) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If this is the first address or marked as default, update other addresses
  if (data.isDefault) {
    await db
      .update(userAddresses)
      .set({ isDefault: false })
      .where(eq(userAddresses.lineUserId, data.lineUserId));
  }

  const result = await db.insert(userAddresses).values(data);
  return { id: result[0].insertId, ...data };
}

/**
 * Update an existing address
 */
export async function updateUserAddress(
  id: number,
  data: Partial<InsertUserAddress>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If setting as default, unset other defaults first
  if (data.isDefault) {
    const address = await getUserAddressById(id);
    if (address) {
      await db
        .update(userAddresses)
        .set({ isDefault: false })
        .where(eq(userAddresses.lineUserId, address.lineUserId));
    }
  }

  await db
    .update(userAddresses)
    .set(data)
    .where(eq(userAddresses.id, id));

  return await getUserAddressById(id);
}

/**
 * Delete an address
 */
export async function deleteUserAddress(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(userAddresses).where(eq(userAddresses.id, id));
}

/**
 * Set an address as default
 */
export async function setDefaultUserAddress(id: number, lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Unset all defaults for this user
  await db
    .update(userAddresses)
    .set({ isDefault: false })
    .where(eq(userAddresses.lineUserId, lineUserId));

  // Set the specified address as default
  await db
    .update(userAddresses)
    .set({ isDefault: true })
    .where(eq(userAddresses.id, id));
}


/**
 * 注文時の配送先情報をuser_addressesに自動保存
 * - 既存住所がない場合: 新規作成（デフォルト住所として登録）
 * - 既存住所がある場合: 名前を更新（注文時の名前で上書き）
 */
export async function autoSaveShippingAddress(
  lineUserId: number,
  shippingInfo: {
    name?: string;
    phone?: string;
    postalCode?: string;
    address?: string;
  }
) {
  const db = await getDb();
  if (!db) return;

  const name = shippingInfo.name?.trim();
  const phone = shippingInfo.phone?.trim() || "";
  const postalCode = shippingInfo.postalCode?.trim() || "";
  const fullAddress = shippingInfo.address?.trim() || "";

  if (!name || !postalCode || !fullAddress) return;

  // 住所を解析: 都道府県・市区町村・番地・建物名に分割
  const parsed = parseJapaneseAddress(fullAddress);

  // 既存住所を確認
  const existingAddresses = await db
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.lineUserId, lineUserId))
    .orderBy(desc(userAddresses.isDefault), desc(userAddresses.createdAt));

  if (existingAddresses.length === 0) {
    // 新規作成: デフォルト住所として登録
    await db.insert(userAddresses).values({
      lineUserId,
      label: "自宅",
      recipientName: name,
      phoneNumber: phone,
      postalCode,
      prefecture: parsed.prefecture,
      city: parsed.city,
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2 || undefined,
      isDefault: true,
    });
    console.log(`[autoSaveShippingAddress] 新規住所保存: lineUserId=${lineUserId}, name=${name}`);
  } else {
    // 重複チェック強化: 郵便番号 + 番地（addressLine1）の組み合わせで判定
    // 同じ郵便番号でも異なる番地の住所は別住所として保存する
    const normalizeAddr = (s: string) => s.replace(/[\s　-－ー]/g, "").toLowerCase();
    const matchingAddr = existingAddresses.find(a => {
      if (a.postalCode !== postalCode) return false;
      // 郵便番号が一致 + 番地も一致する場合のみ「同じ住所」と判定
      if (parsed.addressLine1 && a.addressLine1) {
        return normalizeAddr(a.addressLine1) === normalizeAddr(parsed.addressLine1);
      }
      // 番地が解析できない場合は郵便番号のみで判定（後方互換）
      return true;
    });
    
    if (matchingAddr) {
      // 同じ住所が見つかった場合: 名前・電話番号・建物名を更新
      await db
        .update(userAddresses)
        .set({
          recipientName: name,
          phoneNumber: phone || matchingAddr.phoneNumber,
          prefecture: parsed.prefecture || matchingAddr.prefecture,
          city: parsed.city || matchingAddr.city,
          addressLine1: parsed.addressLine1 || matchingAddr.addressLine1,
          addressLine2: parsed.addressLine2 || matchingAddr.addressLine2,
        })
        .where(eq(userAddresses.id, matchingAddr.id));
      console.log(`[autoSaveShippingAddress] 住所更新: id=${matchingAddr.id}, name=${name}, postalCode=${postalCode}, addressLine1=${parsed.addressLine1}`);
    } else {
      // 新しい住所（郵便番号または番地が異なる）: 追加保存（デフォルトにはしない）
      await db.insert(userAddresses).values({
        lineUserId,
        label: "配送先",
        recipientName: name,
        phoneNumber: phone,
        postalCode,
        prefecture: parsed.prefecture,
        city: parsed.city,
        addressLine1: parsed.addressLine1,
        addressLine2: parsed.addressLine2 || undefined,
        isDefault: false,
      });
      console.log(`[autoSaveShippingAddress] 新規住所追加: lineUserId=${lineUserId}, name=${name}, postalCode=${postalCode}, addressLine1=${parsed.addressLine1}`);
    }
  }
}

/**
 * 日本の住所文字列を都道府県・市区町村・番地・建物名に分割
 * 例: "東京都港区三田3-3-3" -> { prefecture: "東京都", city: "港区三田", addressLine1: "3-3-3", addressLine2: null }
 * 例: "東京都新宿区西新宿6-15-1 3407" -> { prefecture: "東京都", city: "新宿区西新宿", addressLine1: "6-15-1", addressLine2: "3407" }
 */
export function parseJapaneseAddress(address: string): {
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string | null;
} {
  // デフォルト値
  const result = {
    prefecture: "",
    city: "",
    addressLine1: address,
    addressLine2: null as string | null,
  };

  // 都道府県を抽出
  const prefectureMatch = address.match(/^(北海道|東京都|京都府|大阪府|.{2,3}県)/);
  if (!prefectureMatch) {
    // 都道府県が見つからない場合は全体をaddressLine1に
    return result;
  }

  result.prefecture = prefectureMatch[1];
  let remaining = address.slice(result.prefecture.length);

  // 市区町村を抽出
  // 政令指定都市の区（例: 港区、新宿区）、市、町、村、郡を検出
  const cityMatch = remaining.match(/^(.+?[市区町村郡])(.+?)(?=\d|$)/);
  if (cityMatch) {
    result.city = cityMatch[1] + cityMatch[2];
    remaining = remaining.slice(result.city.length);
  } else {
    // 数字が始まる前までを市区町村として扱う
    const numStart = remaining.search(/\d/);
    if (numStart > 0) {
      result.city = remaining.slice(0, numStart);
      remaining = remaining.slice(numStart);
    } else {
      result.city = remaining;
      remaining = "";
    }
  }

  // 残りを番地と建物名に分割
  if (remaining) {
    // スペースで分割（番地と建物名）
    const spaceIndex = remaining.indexOf(" ");
    const fullWidthSpaceIndex = remaining.indexOf("　");
    const splitIndex = spaceIndex >= 0 ? spaceIndex : fullWidthSpaceIndex;
    
    if (splitIndex > 0) {
      result.addressLine1 = remaining.slice(0, splitIndex).trim();
      result.addressLine2 = remaining.slice(splitIndex + 1).trim() || null;
    } else {
      result.addressLine1 = remaining.trim();
      result.addressLine2 = null;
    }
  }

  return result;
}

// ========================================
// Email Authentication Functions
// メール認証関連の関数
// ========================================

/**
 * Get LINE user by email
 */
export async function getLineUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.email, email))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Get LINE user by ID
 */
export async function getLineUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Create email-based LINE user
 */
export async function createEmailLineUser(data: {
  email: string;
  password: string;
  displayName: string;
  phone?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(lineUsers).values({
    email: data.email,
    password: data.password,
    displayName: data.displayName,
    phone: data.phone || null,
    userType: "customer",
  });
  
  return { id: result[0].insertId };
}


// ============================================
// Password Reset Token Functions
// ============================================

/**
 * Create password reset token
 */
export async function createPasswordResetToken(data: {
  lineUserId: number;
  email: string;
  token: string;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete any existing tokens for this user
  await db.delete(linePasswordResetTokens).where(
    eq(linePasswordResetTokens.lineUserId, data.lineUserId)
  );
  
  // Create new token
  const result = await db.insert(linePasswordResetTokens).values({
    lineUserId: data.lineUserId,
    email: data.email,
    token: data.token,
    expiresAt: data.expiresAt,
  });
  
  return { id: result[0].insertId };
}

/**
 * Get password reset token by token string
 */
export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(linePasswordResetTokens)
    .where(eq(linePasswordResetTokens.token, token))
    .limit(1);
  
  return result[0] || null;
}

/**
 * Mark password reset token as used
 */
export async function markPasswordResetTokenAsUsed(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(linePasswordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(linePasswordResetTokens.token, token));
}

/**
 * Update LINE user password
 */
export async function updateLineUserPassword(userId: number, hashedPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(lineUsers)
    .set({ password: hashedPassword })
    .where(eq(lineUsers.id, userId));
}


// ==========================================
// LINE Link Code Functions (LINE連携コード)
// ==========================================

/**
 * Generate a link code for LINE account linking (MALL user)
 * Format: M-XXXXXX
 */
export async function createLineLinkCode(lineUserId: number): Promise<{ code: string; expiresAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate code with M- prefix for MALL users
  const numericCode = Math.floor(100000 + Math.random() * 900000).toString();
  const code = `M-${numericCode}`;
  
  // Set expiration to 10 minutes from now
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  // Delete any existing unused codes for this user
  await db.delete(lineLinkCodes)
    .where(and(
      eq(lineLinkCodes.lineUserId, lineUserId),
      sql`${lineLinkCodes.usedAt} IS NULL`
    ));
  
  // Insert new code
  await db.insert(lineLinkCodes).values({
    lineUserId,
    code,
    expiresAt,
  });
  
  return { code, expiresAt };
}

/**
 * Verify and use a link code
 * Returns the line_users.id if valid, null if invalid/expired
 */
export async function verifyAndUseLinkCode(code: string, linkedLineUserId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Find valid code
  const result = await db.select()
    .from(lineLinkCodes)
    .where(and(
      eq(lineLinkCodes.code, code),
      sql`${lineLinkCodes.usedAt} IS NULL`,
      sql`${lineLinkCodes.expiresAt} > NOW()`
    ))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const linkCode = result[0];
  
  // Mark code as used
  await db.update(lineLinkCodes)
    .set({
      usedAt: new Date(),
      linkedLineUserId,
    })
    .where(eq(lineLinkCodes.id, linkCode.id));
  
  return linkCode.lineUserId;
}

/**
 * Link LINE account to email user (Mall member)
 * Updates the line_users record to include the LINE User ID
 * Note: Same LINE ID can be linked to both Liver and Mall member accounts
 * If there's an existing LINE BOT account (email is NULL), we merge it into the email account
 */
export async function linkLineAccountToEmailUser(emailUserId: number, lineUserId: string, displayName?: string, pictureUrl?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if LINE ID is already linked to another MALL account (line_users table)
  // Note: We allow the same LINE ID to be linked to both Liver (livers table) and Mall member (line_users table)
  const existingLineUser = await db.select()
    .from(lineUsers)
    .where(eq(lineUsers.lineUserId, lineUserId))
    .limit(1);
  
  if (existingLineUser.length > 0 && existingLineUser[0].id !== emailUserId) {
    // Check if the existing account is a LINE BOT account (no email) - if so, we can merge
    if (existingLineUser[0].email === null || existingLineUser[0].email === '') {
      // This is a LINE BOT account without email - we can safely merge
      // First, clear the lineUserId from the old account to avoid conflicts
      await db.update(lineUsers)
        .set({ lineUserId: null })
        .where(eq(lineUsers.id, existingLineUser[0].id));
      
      console.log(`[LINE Link] Merged LINE BOT account (ID: ${existingLineUser[0].id}) into email account (ID: ${emailUserId})`);
    } else {
      // LINE ID is already linked to a different MALL account with email
      throw new Error("LINE_ALREADY_LINKED_TO_MALL");
    }
  }
  
  // Update email user with LINE ID
  await db.update(lineUsers)
    .set({
      lineUserId,
      displayName: displayName || undefined,
      pictureUrl: pictureUrl || undefined,
    })
    .where(eq(lineUsers.id, emailUserId));
  
  // === Merge point balances: email_${id} → LINE userId ===
  const emailPointId = `email_${emailUserId}`;
  const emailBalance = await db.select()
    .from(linePointBalances)
    .where(eq(linePointBalances.lineUserId, emailPointId))
    .limit(1);
  
  if (emailBalance.length > 0 && emailBalance[0].balance > 0) {
    // Get or create LINE userId balance
    let lineBalance = await db.select()
      .from(linePointBalances)
      .where(eq(linePointBalances.lineUserId, lineUserId))
      .limit(1);
    
    if (lineBalance.length === 0) {
      // Create new balance record for LINE userId
      await db.insert(linePointBalances).values({
        lineUserId,
        balance: 0,
        totalEarned: 0,
        totalUsed: 0,
      });
      lineBalance = await db.select()
        .from(linePointBalances)
        .where(eq(linePointBalances.lineUserId, lineUserId))
        .limit(1);
    }
    
    // Transfer balance from email_ to LINE userId
    const transferAmount = emailBalance[0].balance;
    const transferTotalEarned = emailBalance[0].totalEarned;
    const transferTotalUsed = emailBalance[0].totalUsed;
    
    // Add to LINE userId balance
    await db.update(linePointBalances)
      .set({
        balance: sql`${linePointBalances.balance} + ${transferAmount}`,
        totalEarned: sql`${linePointBalances.totalEarned} + ${transferTotalEarned}`,
        totalUsed: sql`${linePointBalances.totalUsed} + ${transferTotalUsed}`,
      })
      .where(eq(linePointBalances.lineUserId, lineUserId));
    
    // Zero out email_ balance
    await db.update(linePointBalances)
      .set({
        balance: 0,
        totalEarned: 0,
        totalUsed: 0,
      })
      .where(eq(linePointBalances.lineUserId, emailPointId));
    
    // Migrate all transactions from email_ to LINE userId
    await db.update(linePointTransactions)
      .set({ lineUserId })
      .where(eq(linePointTransactions.lineUserId, emailPointId));
    
    console.log(`[LINE Link] Merged point balance: email_${emailUserId} (${transferAmount} pt) → ${lineUserId}`);
  } else if (emailBalance.length > 0) {
    // Balance is 0 but record exists - just migrate transactions
    await db.update(linePointTransactions)
      .set({ lineUserId })
      .where(eq(linePointTransactions.lineUserId, emailPointId));
    
    console.log(`[LINE Link] Migrated point transactions: email_${emailUserId} → ${lineUserId}`);
  }
  
  return true;
}

/**
 * Check if user has LINE account linked
 */
export async function checkLineAccountLinked(emailUserId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ lineUserId: lineUsers.lineUserId })
    .from(lineUsers)
    .where(eq(lineUsers.id, emailUserId))
    .limit(1);
  
  return result.length > 0 && result[0].lineUserId !== null;
}

/**
 * Get active link code for user (if any)
 */
export async function getActiveLinkCode(emailUserId: number): Promise<{ code: string; expiresAt: Date } | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(lineLinkCodes)
    .where(and(
      eq(lineLinkCodes.lineUserId, emailUserId),
      sql`${lineLinkCodes.usedAt} IS NULL`,
      sql`${lineLinkCodes.expiresAt} > NOW()`
    ))
    .orderBy(desc(lineLinkCodes.createdAt))
    .limit(1);
  
  if (result.length === 0) return null;
  
  return {
    code: result[0].code,
    expiresAt: result[0].expiresAt,
  };
}


// ============================================
// Screenshot Analysis History Functions
// ============================================

/**
 * Save screenshot analysis result to history
 */
export async function saveScreenshotAnalysis(data: InsertScreenshotAnalysisHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(screenshotAnalysisHistory).values(data);
  return { id: Number(result[0].insertId), ...data };
}

/**
 * Get analysis history by image hash (for cache lookup)
 */
export async function getAnalysisByImageHash(imageHash: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(screenshotAnalysisHistory)
    .where(eq(screenshotAnalysisHistory.imageHash, imageHash))
    .orderBy(desc(screenshotAnalysisHistory.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Get analysis history by liver ID
 */
export async function getAnalysisHistoryByLiverId(liverId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(screenshotAnalysisHistory)
    .where(eq(screenshotAnalysisHistory.liverId, liverId))
    .orderBy(desc(screenshotAnalysisHistory.createdAt))
    .limit(limit);
  
  return result;
}

/**
 * Get analysis history by livestream ID
 */
export async function getAnalysisHistoryByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(screenshotAnalysisHistory)
    .where(eq(screenshotAnalysisHistory.livestreamId, livestreamId))
    .orderBy(desc(screenshotAnalysisHistory.createdAt));
  
  return result;
}

/**
 * Get recent analysis history (for admin view)
 */
export async function getRecentAnalysisHistory(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select()
    .from(screenshotAnalysisHistory)
    .orderBy(desc(screenshotAnalysisHistory.createdAt))
    .limit(limit);
  
  return result;
}


// ==================== Point Request Functions ====================

/**
 * Create a new point request
 */
export async function createPointRequest(data: InsertPointRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(pointRequests).values(data);
  return result[0].insertId;
}

/**
 * Get point request by ID
 */
export async function getPointRequestById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(pointRequests)
    .where(eq(pointRequests.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Get point requests by user ID
 */
export async function getPointRequestsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(pointRequests)
    .where(eq(pointRequests.userId, userId))
    .orderBy(desc(pointRequests.createdAt));
}

/**
 * Get all pending point requests (for admin)
 */
export async function getPendingPointRequests() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(pointRequests)
    .where(eq(pointRequests.status, "pending"))
    .orderBy(asc(pointRequests.createdAt));
}

/**
 * Get all point requests (for admin)
 */
export async function getAllPointRequests(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(pointRequests)
    .orderBy(desc(pointRequests.createdAt))
    .limit(limit);
}

/**
 * Check if order number already exists (for duplicate prevention)
 * Checks both pointRequests and lineReceipts tables for cross-system duplicate detection
 */
export async function checkOrderNumberExists(orderNumber: string): Promise<{ exists: boolean; source?: "pointRequest" | "lineReceipt" }> {
  const db = await getDb();
  if (!db) return { exists: false };
  
  // Check pointRequests table
  const prResult = await db.select({ id: pointRequests.id })
    .from(pointRequests)
    .where(eq(pointRequests.orderNumber, orderNumber))
    .limit(1);
  
  if (prResult.length > 0) {
    return { exists: true, source: "pointRequest" };
  }
  
  // Also check lineReceipts table (cross-system duplicate detection)
  const lrResult = await db
    .select({ id: lineReceipts.id })
    .from(lineReceipts)
    .where(sql`JSON_EXTRACT(${lineReceipts.ocrRawText}, '$.orderNumber') = ${orderNumber}`)
    .limit(1);
  
  if (lrResult.length > 0) {
    return { exists: true, source: "lineReceipt" };
  }
  
  return { exists: false };
}

/**
 * Count today's point requests by user (for daily limit check)
 */
export async function countTodayPointRequestsByUser(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(pointRequests)
    .where(
      and(
        eq(pointRequests.userId, userId),
        sql`${pointRequests.createdAt} >= ${today}`,
        sql`${pointRequests.createdAt} < ${tomorrow}`
      )
    );
  
  return result[0]?.count || 0;
}

/**
 * Approve a point request
 */
export async function approvePointRequest(id: number, adminUserId: number, pointsApproved: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update point request status
  await db.update(pointRequests)
    .set({
      status: "approved",
      pointsApproved,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    })
    .where(eq(pointRequests.id, id));
  
  // Get the request to find the user
  const request = await getPointRequestById(id);
  if (!request) throw new Error("Point request not found");
  
  // Update user's point balance
  await addPointsToUser(request.userId, pointsApproved, id, "TikTok Shop購入ポイント還元");
  
  return true;
}

/**
 * Reject a point request
 */
export async function rejectPointRequest(id: number, adminUserId: number, reason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(pointRequests)
    .set({
      status: "rejected",
      rejectionReason: reason,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    })
    .where(eq(pointRequests.id, id));
  
  return true;
}

/**
 * Add points to user's balance
 */
export async function addPointsToUser(userId: number, points: number, pointRequestId: number | null, description: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get or create point balance
  let balance = await db.select()
    .from(pointBalances)
    .where(eq(pointBalances.userId, userId))
    .limit(1);
  
  let currentBalance = 0;
  
  if (balance.length === 0) {
    // Create new balance record
    await db.insert(pointBalances).values({
      userId,
      balance: points,
      totalEarned: points,
      totalUsed: 0,
    });
    currentBalance = points;
  } else {
    // Update existing balance
    currentBalance = Number(balance[0].balance) + points;
    await db.update(pointBalances)
      .set({
        balance: currentBalance,
        totalEarned: sql`${pointBalances.totalEarned} + ${points}`,
      })
      .where(eq(pointBalances.userId, userId));
  }
  
  // Record transaction with 3-month expiration
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  await db.insert(pointTransactions).values({
    userId,
    type: "earn",
    amount: points,
    balanceAfter: currentBalance,
    referenceType: "receipt",
    referenceId: pointRequestId,
    description,
    expiresAt,
    remainingAmount: points,
  });
  
  return currentBalance;
}

/**
 * Get user's point balance
 */
export async function getUserPointBalance(userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(pointBalances)
    .where(eq(pointBalances.userId, userId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Get user's point transactions
 */
export async function getUserPointTransactions(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(pointTransactions)
    .where(eq(pointTransactions.userId, userId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);
}


// ============================================
// User Password Reset Functions (for admin/user login)
// ============================================

/**
 * Create a password reset token for user (admin/user)
 */
export async function createUserPasswordResetToken(userId: number, email: string, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return null;
  
  // Delete any existing tokens for this user
  await db.delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, userId));
  
  // Create new token
  const result = await db.insert(passwordResetTokens).values({
    userId,
    email,
    token,
    expiresAt,
  });
  
  return result[0].insertId;
}

/**
 * Get user password reset token by token string
 */
export async function getUserPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Mark user password reset token as used
 */
export async function markUserPasswordResetTokenUsed(tokenId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenId));
  
  return true;
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: number, hashedPassword: string) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(users)
    .set({ password: hashedPassword })
    .where(eq(users.id, userId));
  
  return true;
}



// ============================================
// Schedule Group Functions
// ============================================

/**
 * Create a new schedule group
 */
export async function createScheduleGroup(data: InsertScheduleGroup) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(scheduleGroups).values(data);
  return result[0].insertId;
}

/**
 * Get all schedule groups
 */
export async function getAllScheduleGroups() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(scheduleGroups)
    .where(eq(scheduleGroups.isActive, true))
    .orderBy(asc(scheduleGroups.sortOrder), asc(scheduleGroups.id));
}

/**
 * Get schedule group by ID
 */
export async function getScheduleGroupById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(scheduleGroups)
    .where(eq(scheduleGroups.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Update a schedule group
 */
export async function updateScheduleGroup(id: number, data: Partial<InsertScheduleGroup>) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(scheduleGroups)
    .set(data)
    .where(eq(scheduleGroups.id, id));
  
  return true;
}

/**
 * Delete a schedule group (soft delete by setting isActive to false)
 */
export async function deleteScheduleGroup(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(scheduleGroups)
    .set({ isActive: false })
    .where(eq(scheduleGroups.id, id));
  
  return true;
}

/**
 * Add a liver to a schedule group
 */
export async function addLiverToScheduleGroup(groupId: number, liverId: number, sortOrder: number = 0) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if already exists
  const existing = await db.select()
    .from(scheduleGroupMembers)
    .where(and(
      eq(scheduleGroupMembers.groupId, groupId),
      eq(scheduleGroupMembers.liverId, liverId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  const result = await db.insert(scheduleGroupMembers).values({
    groupId,
    liverId,
    sortOrder,
  });
  
  return result[0].insertId;
}

/**
 * Remove a liver from a schedule group
 */
export async function removeLiverFromScheduleGroup(groupId: number, liverId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.delete(scheduleGroupMembers)
    .where(and(
      eq(scheduleGroupMembers.groupId, groupId),
      eq(scheduleGroupMembers.liverId, liverId)
    ));
  
  return true;
}

/**
 * Get all members of a schedule group
 */
export async function getScheduleGroupMembers(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select({
    id: scheduleGroupMembers.id,
    groupId: scheduleGroupMembers.groupId,
    liverId: scheduleGroupMembers.liverId,
    sortOrder: scheduleGroupMembers.sortOrder,
    createdAt: scheduleGroupMembers.createdAt,
    liverName: livers.name,
    liverColor: livers.color,
    liverAvatarUrl: livers.avatarUrl,
  })
    .from(scheduleGroupMembers)
    .leftJoin(livers, eq(scheduleGroupMembers.liverId, livers.id))
    .where(eq(scheduleGroupMembers.groupId, groupId))
    .orderBy(asc(scheduleGroupMembers.sortOrder), asc(scheduleGroupMembers.id));
}

/**
 * Get all schedule groups with their members
 */
export async function getAllScheduleGroupsWithMembers() {
  const db = await getDb();
  if (!db) return [];
  
  const groups = await getAllScheduleGroups();
  
  const groupsWithMembers = await Promise.all(
    groups.map(async (group) => {
      const members = await getScheduleGroupMembers(group.id);
      return {
        ...group,
        members,
      };
    })
  );
  
  return groupsWithMembers;
}

/**
 * Update member sort order within a group
 */
export async function updateScheduleGroupMemberOrder(groupId: number, liverId: number, sortOrder: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(scheduleGroupMembers)
    .set({ sortOrder })
    .where(and(
      eq(scheduleGroupMembers.groupId, groupId),
      eq(scheduleGroupMembers.liverId, liverId)
    ));
  
  return true;
}

/**
 * Set all members for a schedule group (replaces existing members)
 */
export async function setScheduleGroupMembers(groupId: number, liverIds: number[]) {
  const db = await getDb();
  if (!db) return false;
  
  // Delete existing members
  await db.delete(scheduleGroupMembers)
    .where(eq(scheduleGroupMembers.groupId, groupId));
  
  // Add new members
  if (liverIds.length > 0) {
    const values = liverIds.map((liverId, index) => ({
      groupId,
      liverId,
      sortOrder: index,
    }));
    await db.insert(scheduleGroupMembers).values(values);
  }
  
  return true;
}

/**
 * Get livestreams by streamer name with stats
 */
export async function getLivestreamsByStreamerName(streamerName: string, month?: string) {
  const db = await getDb();
  if (!db) return { livestreams: [], totalSales: 0, totalDuration: 0 };
  
  let whereConditions = eq(brandLivestreams.streamerName, streamerName);
  
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    whereConditions = and(
      whereConditions,
      sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
      sql`${brandLivestreams.livestreamDate} <= ${endDate}`
    ) as any;
  }
  
  const livestreams = await db
    .select()
    .from(brandLivestreams)
    .where(and(whereConditions, isNull(brandLivestreams.deletedAt)))
    .orderBy(sql`${brandLivestreams.livestreamDate} DESC`);
  
  const totalSales = livestreams.reduce((sum, l) => sum + (l.salesAmount || 0), 0);
  const totalDuration = livestreams.reduce((sum, l) => sum + (l.duration || 0), 0);
  
  // 各配信のCSVインポート商品数を取得
  const livestreamIds = livestreams.map(l => l.id);
  let productCountMap: Record<number, number> = {};
  if (livestreamIds.length > 0) {
    const productCounts = await db
      .select({
        livestreamId: livestreamProducts.livestreamId,
        count: sql<number>`COUNT(*)`,
      })
      .from(livestreamProducts)
      .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(livestreamIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(livestreamProducts.livestreamId);
    
    for (const pc of productCounts) {
      productCountMap[pc.livestreamId] = Number(pc.count);
    }
  }
  
  const livestreamsWithProductCount = livestreams.map(l => ({
    ...l,
    productCount: productCountMap[l.id] || 0,
  }));
  
  return { livestreams: livestreamsWithProductCount, totalSales, totalDuration };
}


// ============================================
// Liver Password Reset Functions
// ============================================

/**
 * Create a password reset token for liver
 */
export async function createLiverPasswordResetToken(liverId: number, email: string, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) return null;
  
  // Delete any existing tokens for this liver
  await db.delete(liverPasswordResetTokens)
    .where(eq(liverPasswordResetTokens.liverId, liverId));
  
  // Create new token
  const result = await db.insert(liverPasswordResetTokens).values({
    liverId,
    email,
    token,
    expiresAt,
  });
  
  return result[0].insertId;
}

/**
 * Get liver password reset token by token string
 */
export async function getLiverPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select()
    .from(liverPasswordResetTokens)
    .where(eq(liverPasswordResetTokens.token, token))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Mark liver password reset token as used
 */
export async function markLiverPasswordResetTokenUsed(tokenId: number) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(liverPasswordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(liverPasswordResetTokens.id, tokenId));
  
  return true;
}

/**
 * Update liver password
 */
export async function updateLiverPassword(liverId: number, hashedPassword: string) {
  const db = await getDb();
  if (!db) return false;
  
  await db.update(livers)
    .set({ password: hashedPassword })
    .where(eq(livers.id, liverId));
  
  return true;
}


// ============================================
// Product-Liver Management Functions
// ============================================

/**
 * Add a liver to a product
 */
export async function addProductLiver(data: {
  productId: number;
  liverId: number;
  specialSetName?: string;
  specialPrice?: number;
  commissionRate?: number;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(productLivers).values({
    productId: data.productId,
    liverId: data.liverId,
    specialSetName: data.specialSetName,
    specialPrice: data.specialPrice,
    commissionRate: data.commissionRate?.toString(),
    createdBy: data.createdBy,
  });
  return result;
}

/**
 * Remove a liver from a product
 */
export async function removeProductLiver(productId: number, liverId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(productLivers)
    .where(and(
      eq(productLivers.productId, productId),
      eq(productLivers.liverId, liverId)
    ));
}

/**
 * Get all product-liver relationships for a product
 */
export async function getProductLivers(productId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select()
    .from(productLivers)
    .where(eq(productLivers.productId, productId));
  return result;
}

/**
 * Get liver details for a product (with liver info)
 */
export async function getLiversByProductId(productId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    id: livers.id,
    name: livers.name,
    email: livers.email,
    avatarUrl: livers.avatarUrl,
    specialSetName: productLivers.specialSetName,
    specialPrice: productLivers.specialPrice,
    commissionRate: productLivers.commissionRate,
    assignedAt: productLivers.assignedAt,
  })
    .from(productLivers)
    .innerJoin(livers, eq(productLivers.liverId, livers.id))
    .where(eq(productLivers.productId, productId));
  return result;
}

/**
 * Get products by liver ID
 */
export async function getProductsByLiverId(liverId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({
    id: brandProducts.id,
    brandId: brandProducts.brandId,
    name: brandProducts.productName,
    listPrice: brandProducts.listPrice,
    specialPrice: brandProducts.specialPrice,
    specialSetName: productLivers.specialSetName,
    liverSpecialPrice: productLivers.specialPrice,
    commissionRate: productLivers.commissionRate,
    assignedAt: productLivers.assignedAt,
  })
    .from(productLivers)
    .innerJoin(brandProducts, eq(productLivers.productId, brandProducts.id))
    .where(eq(productLivers.liverId, liverId));
  return result;
}

/**
 * Bulk add livers to a product
 */
export async function bulkAddProductLivers(productId: number, liverIds: number[], createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (liverIds.length === 0) return;

  const values = liverIds.map(liverId => ({
    productId,
    liverId,
    createdBy,
  }));

  await db.insert(productLivers).values(values);
}

/**
 * Update product livers (replace all)
 */
export async function updateProductLivers(productId: number, liverIds: number[], createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete existing relationships
  await db.delete(productLivers).where(eq(productLivers.productId, productId));

  // Add new relationships
  if (liverIds.length > 0) {
    await bulkAddProductLivers(productId, liverIds, createdBy);
  }
}

/**
 * Get liver sales stats for a brand
 */
export async function getLiverSalesStatsByBrand(brandId: number) {
  const db = await getDb();
  if (!db) return [];

  // Get all products for this brand
  const products = await db.select({ id: brandProducts.id })
    .from(brandProducts)
    .where(and(eq(brandProducts.brandId, brandId), isNull(brandProducts.deletedAt)));
  if (products.length === 0) return [];

  const productIds = products.map(p => p.id);

  // Get all livestreams for these products
  const livestreams = await db.select({
    liverId: brandLivestreams.liverId,
    gmv: brandLivestreams.gmv,
  })
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      inArray(brandLivestreams.productId, productIds),
      isNotNull(brandLivestreams.liverId)
    ));

  // Aggregate by liver
  const liverStats: Record<number, { totalGmv: number; livestreamCount: number }> = {};
  for (const ls of livestreams) {
    if (ls.liverId) {
      if (!liverStats[ls.liverId]) {
        liverStats[ls.liverId] = { totalGmv: 0, livestreamCount: 0 };
      }
      liverStats[ls.liverId].totalGmv += ls.gmv || 0;
      liverStats[ls.liverId].livestreamCount += 1;
    }
  }

  // Get liver details
  const liverIds = Object.keys(liverStats).map(Number);
  if (liverIds.length === 0) return [];

  const liverDetails = await db.select({
    id: livers.id,
    name: livers.name,
    avatarUrl: livers.avatarUrl,
  })
    .from(livers)
    .where(inArray(livers.id, liverIds));

  // Combine stats with liver details
  return liverDetails.map(liver => ({
    ...liver,
    totalGmv: liverStats[liver.id]?.totalGmv || 0,
    livestreamCount: liverStats[liver.id]?.livestreamCount || 0,
  }));
}


/**
 * Check for duplicate TikTok Shop order number across ALL users
 * 全ユーザー間でTikTok Shop注文番号の重複をチェック
 * Checks both lineReceipts and pointRequests tables for cross-system duplicate detection
 */
export async function checkDuplicateOrderNumberGlobal(
  orderNumber: string,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 1. Search lineReceipts table (ocrRawText JSON field)
  // Check approved/pending/on_hold receipts (approvedはポイント発送済みなので再提出不可)
  // rejectedは除外して再提出を許可
  let conditions = sql`JSON_EXTRACT(${lineReceipts.ocrRawText}, '$.orderNumber') = ${orderNumber} AND ${lineReceipts.status} IN ('approved', 'pending', 'on_hold')`;
  
  if (excludeId) {
    conditions = sql`${conditions} AND ${lineReceipts.id} != ${excludeId}`;
  }
  
  const lrResult = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      storeName: lineReceipts.storeName,
      totalAmount: lineReceipts.totalAmount,
      status: lineReceipts.status,
      submittedAt: lineReceipts.submittedAt,
      ocrRawText: lineReceipts.ocrRawText,
    })
    .from(lineReceipts)
    .where(conditions)
    .limit(1);
  
  if (lrResult[0]) {
    return { ...lrResult[0], source: "lineReceipt" as const };
  }
  
  // 2. Also check pointRequests table (cross-system duplicate detection)
  const prResult = await db
    .select({
      id: pointRequests.id,
      orderNumber: pointRequests.orderNumber,
      orderAmount: pointRequests.orderAmount,
      status: pointRequests.status,
      createdAt: pointRequests.createdAt,
    })
    .from(pointRequests)
    .where(eq(pointRequests.orderNumber, orderNumber))
    .limit(1);
  
  if (prResult[0]) {
    return {
      id: prResult[0].id,
      lineUserId: "pointRequest",
      storeName: "TikTok Shop",
      totalAmount: prResult[0].orderAmount,
      status: prResult[0].status,
      submittedAt: prResult[0].createdAt,
      ocrRawText: null,
      source: "pointRequest" as const,
    };
  }
  
  return null;
}


/**
 * Find similar order numbers (1-2 digits different) for fraud detection
 * 類似注文番号を検出（不正防止）
 * 
 * Algorithm: Fetch all order numbers from DB, then compare using
 * Levenshtein-like digit difference count
 */
export async function findSimilarOrderNumbers(
  orderNumber: string,
  excludeId?: number
): Promise<Array<{
  id: number;
  lineUserId: string | null;
  storeName: string | null;
  totalAmount: number | null;
  status: string;
  orderNumber: string;
  submittedAt: Date | null;
  diffCount: number;
}>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get all receipts that have order numbers
  let conditions = sql`JSON_EXTRACT(${lineReceipts.ocrRawText}, '$.orderNumber') IS NOT NULL`;
  if (excludeId) {
    conditions = sql`${conditions} AND ${lineReceipts.id} != ${excludeId}`;
  }
  
  const allReceipts = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      storeName: lineReceipts.storeName,
      totalAmount: lineReceipts.totalAmount,
      status: lineReceipts.status,
      ocrRawText: lineReceipts.ocrRawText,
      submittedAt: lineReceipts.submittedAt,
    })
    .from(lineReceipts)
    .where(conditions);
  
  const similar: Array<{
    id: number;
    lineUserId: string | null;
    storeName: string | null;
    totalAmount: number | null;
    status: string;
    orderNumber: string;
    submittedAt: Date | null;
    diffCount: number;
  }> = [];
  
  for (const receipt of allReceipts) {
    try {
      const ocrData = typeof receipt.ocrRawText === "string" 
        ? JSON.parse(receipt.ocrRawText) 
        : receipt.ocrRawText;
      const existingOrderNumber = String(ocrData?.orderNumber || "").replace(/[^0-9]/g, "");
      
      if (!existingOrderNumber || existingOrderNumber === orderNumber) continue;
      
      // Compare digit by digit
      const diffCount = countDigitDifferences(orderNumber, existingOrderNumber);
      
      // 1-2桁の差異 = 類似（タイプミスや改ざんの可能性）
      if (diffCount > 0 && diffCount <= 2) {
        similar.push({
          id: receipt.id,
          lineUserId: receipt.lineUserId,
          storeName: receipt.storeName,
          totalAmount: receipt.totalAmount,
          status: receipt.status,
          orderNumber: existingOrderNumber,
          submittedAt: receipt.submittedAt,
          diffCount,
        });
      }
    } catch {
      // Skip receipts with invalid JSON
    }
  }
  
  return similar.sort((a, b) => a.diffCount - b.diffCount);
}

/**
 * Count the number of digit differences between two order numbers
 * 桁数が同じ場合は各桁を比較、異なる場合はレーベンシュタイン距離風に計算
 */
export function countDigitDifferences(a: string, b: string): number {
  // 桁数が3桁以上違う場合は類似とみなさない
  if (Math.abs(a.length - b.length) > 2) return 999;
  
  // 桁数が同じ場合は単純な桁比較
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) diff++;
    }
    return diff;
  }
  
  // 桁数が1-2桁違う場合はレーベンシュタイン距離
  const len1 = a.length;
  const len2 = b.length;
  const dp: number[][] = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  return dp[len1][len2];
}


// ============================================
// LINE Reminder functions
// ============================================

/**
 * Create a new LINE reminder
 */
export async function createLineReminder(data: InsertLineReminder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(lineReminders).values(data);
  return result;
}

/**
 * Get pending reminders that are due to be sent
 * @param beforeTimestamp - Get reminders scheduled before this timestamp (in milliseconds)
 */
export async function getPendingLineReminders(beforeTimestamp: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(lineReminders)
    .where(
      and(
        eq(lineReminders.status, "pending"),
        lte(lineReminders.scheduledAt, beforeTimestamp)
      )
    )
    .orderBy(asc(lineReminders.scheduledAt));
}

/**
 * Update LINE reminder status
 */
export async function updateLineReminderStatus(
  id: number,
  status: "pending" | "sent" | "cancelled" | "failed",
  errorMessage?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { status };
  
  if (status === "sent") {
    updateData.sentAt = Date.now();
  }
  
  if (errorMessage) {
    updateData.errorMessage = errorMessage;
  }
  
  return await db
    .update(lineReminders)
    .set(updateData)
    .where(eq(lineReminders.id, id));
}

/**
 * Get LINE reminders for a specific user
 */
export async function getLineRemindersByUser(lineUserId: string, limit = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(lineReminders)
    .where(eq(lineReminders.lineUserId, lineUserId))
    .orderBy(desc(lineReminders.createdAt))
    .limit(limit);
}

/**
 * Cancel a LINE reminder
 */
export async function cancelLineReminder(id: number, lineUserId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .update(lineReminders)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(lineReminders.id, id),
        eq(lineReminders.lineUserId, lineUserId),
        eq(lineReminders.status, "pending")
      )
    );
}

/**
 * Get pending reminders count for a user
 */
export async function getPendingLineRemindersCount(lineUserId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(lineReminders)
    .where(
      and(
        eq(lineReminders.lineUserId, lineUserId),
        eq(lineReminders.status, "pending")
      )
    );
  
  return result[0]?.count || 0;
}


// ===== Liver Goals Functions =====

export async function getLiverGoal(liverId: number, yearMonth: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Parse yearMonth (YYYY-MM) into year and month
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  
  const result = await db.select()
    .from(liverGoals)
    .where(and(
      eq(liverGoals.liverId, liverId),
      eq(liverGoals.year, year),
      eq(liverGoals.month, month)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function upsertLiverGoal(data: { liverId: number; yearMonth: string; salesGoal: number; streamCountGoal?: number; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Parse yearMonth (YYYY-MM) into year and month
  const [yearStr, monthStr] = data.yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  
  // Check if goal exists
  const existing = await getLiverGoal(data.liverId, data.yearMonth);
  
  if (existing) {
    // Update existing goal
    await db.update(liverGoals)
      .set({
        salesGoal: data.salesGoal,
        streamCountGoal: data.streamCountGoal || 0,
      })
      .where(eq(liverGoals.id, existing.id));
    return { ...existing, salesGoal: data.salesGoal, streamCountGoal: data.streamCountGoal || 0 };
  } else {
    // Create new goal
    const result = await db.insert(liverGoals).values({
      liverId: data.liverId,
      year,
      month,
      salesGoal: data.salesGoal,
      streamCountGoal: data.streamCountGoal || 0,
    });
    return { id: result[0].insertId, liverId: data.liverId, year, month, salesGoal: data.salesGoal, streamCountGoal: data.streamCountGoal || 0 };
  }
}

export async function getLiverDashboardStats(liverId: number, yearMonth: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Get current month's goal
  const goal = await getLiverGoal(liverId, yearMonth);
  
  // Parse yearMonth to get date range (JST-based)
  const [year, month] = yearMonth.split("-").map(Number);
  const { startDate, endDate } = getJSTMonthRange(yearMonth);
  
  // Get current month's livestreams
  const currentMonthStreams = await db.select()
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      eq(brandLivestreams.liverId, liverId),
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    ))
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  // Calculate current month stats
  const currentMonthSales = currentMonthStreams.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
  const currentMonthStreamCount = currentMonthStreams.length;
  const currentMonthDuration = currentMonthStreams.reduce((sum, s) => sum + (s.duration || 0), 0);
  
  // Get previous month's stats for comparison (JST-based)
  const prevMonthKey = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const { startDate: prevStartDate, endDate: prevEndDate } = getJSTMonthRange(prevMonthKey);
  
  const prevMonthStreams = await db.select()
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      eq(brandLivestreams.liverId, liverId),
      gte(brandLivestreams.livestreamDate, prevStartDate),
      lte(brandLivestreams.livestreamDate, prevEndDate)
    ));
  
  const prevMonthSales = prevMonthStreams.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
  const prevMonthStreamCount = prevMonthStreams.length;
  
  // Get past 6 months data for chart
  const past6Months: { yearMonth: string; sales: number; streamCount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(year, month - 1 - i, 1);
    const mYear = m.getFullYear();
    const mMonth = m.getMonth() + 1;
    const mMonthKey = `${mYear}-${String(mMonth).padStart(2, '0')}`;
    const { startDate: mStartDate, endDate: mEndDate } = getJSTMonthRange(mMonthKey);
    
    const monthStreams = await db.select()
      .from(brandLivestreams)
      .where(and(
        isNull(brandLivestreams.deletedAt),
        eq(brandLivestreams.liverId, liverId),
        gte(brandLivestreams.livestreamDate, mStartDate),
        lte(brandLivestreams.livestreamDate, mEndDate)
      ));
    
    const monthSales = monthStreams.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
    past6Months.push({
      yearMonth: `${mYear}-${String(mMonth).padStart(2, "0")}`,
      sales: monthSales,
      streamCount: monthStreams.length,
    });
  }
  
  // Get top products (from livestream products)
  const productSales = await db.select({
    productName: livestreamProducts.productName,
    totalSales: sql<number>`SUM(${livestreamProducts.grossRevenue})`.as("totalSales"),
  })
    .from(livestreamProducts)
    .innerJoin(brandLivestreams, eq(livestreamProducts.livestreamId, brandLivestreams.id))
    .where(and(
      eq(brandLivestreams.liverId, liverId),
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    ))
    .groupBy(livestreamProducts.productName)
    .orderBy(desc(sql`totalSales`))
    .limit(5);
  
  // 数字のみの商品名を解決
  const productSalesNames = productSales.map(p => p.productName);
  const resolvedProductSalesNames = await resolveNumericProductNames(productSalesNames);
  const resolvedProductSales = productSales.map(p => ({
    ...p,
    productName: resolvedProductSalesNames.get(p.productName) || p.productName,
  }));
  
  // Get best streaming time (hour with highest sales)
  const hourlyStats: { hour: number; sales: number; count: number }[] = [];
  for (let h = 0; h < 24; h++) {
    const hourStreams = currentMonthStreams.filter(s => {
      const streamHour = new Date(s.livestreamDate).getHours();
      return streamHour === h;
    });
    const hourSales = hourStreams.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
    hourlyStats.push({ hour: h, sales: hourSales, count: hourStreams.length });
  }
  
  // Find best hour
  const bestHour = hourlyStats.reduce((best, curr) => 
    curr.sales > best.sales ? curr : best, 
    { hour: 0, sales: 0, count: 0 }
  );
  
  // Get today's date for remaining days calculation
  const today = new Date();
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentDay = today.getMonth() + 1 === month && today.getFullYear() === year 
    ? today.getDate() 
    : daysInMonth;
  const remainingDays = daysInMonth - currentDay;
  
  // Calculate daily pace needed to reach goal
  const salesGoal = goal?.salesGoal || 0;
  const remainingSales = Math.max(0, salesGoal - currentMonthSales);
  const dailyPaceNeeded = remainingDays > 0 ? Math.ceil(remainingSales / remainingDays) : 0;
  
  // Get best stream of the month
  const bestStream = currentMonthStreams.length > 0 
    ? currentMonthStreams.reduce((best, curr) => 
        (curr.salesAmount || 0) > (best.salesAmount || 0) ? curr : best
      )
    : null;
  
  // Calculate consecutive streaming days
  let consecutiveDays = 0;
  const sortedDates = currentMonthStreams
    .map(s => new Date(s.livestreamDate).toDateString())
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  if (sortedDates.length > 0) {
    consecutiveDays = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        consecutiveDays++;
      } else {
        break;
      }
    }
  }
  
  return {
    goal: {
      salesGoal,
      streamCountGoal: goal?.streamCountGoal || 0,
    },
    currentMonth: {
      sales: currentMonthSales,
      streamCount: currentMonthStreamCount,
      duration: currentMonthDuration,
    },
    previousMonth: {
      sales: prevMonthSales,
      streamCount: prevMonthStreamCount,
    },
    growth: {
      salesGrowth: prevMonthSales > 0 
        ? Math.round(((currentMonthSales - prevMonthSales) / prevMonthSales) * 100) 
        : 0,
      streamCountGrowth: prevMonthStreamCount > 0 
        ? Math.round(((currentMonthStreamCount - prevMonthStreamCount) / prevMonthStreamCount) * 100) 
        : 0,
    },
    progress: {
      salesProgress: salesGoal > 0 ? Math.round((currentMonthSales / salesGoal) * 100) : 0,
      remainingSales,
      remainingDays,
      dailyPaceNeeded,
    },
    past6Months,
    topProducts: resolvedProductSales,
    bestHour: bestHour.sales > 0 ? bestHour : null,
    hourlyStats: hourlyStats.filter(h => h.count > 0),
    highlights: {
      bestStream: bestStream ? {
        date: bestStream.livestreamDate,
        sales: bestStream.salesAmount,
      } : null,
      consecutiveDays,
    },
  };
}


// --- Liver Total Statistics Functions ---

/**
 * Get total LCJ liver sales summary for a given month
 * Returns total sales, total duration, total livestream count, and growth rates
 */
export async function getTotalLiverSalesSummary(month: string, agencyId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  
  const { startDate, endDate } = getJSTMonthRange(month);
  
  // Previous month for growth calculation
  const [year, monthNum] = month.split('-').map(Number);
  const prevMonthStr = monthNum === 1 ? `${year - 1}-12` : `${year}-${String(monthNum - 1).padStart(2, '0')}`;
  const { startDate: prevStartDate, endDate: prevEndDate } = getJSTMonthRange(prevMonthStr);
  
  // Build agency filter condition (need to join livers table)
  const agencyFilter = agencyId === null 
    ? isNull(livers.agencyId)
    : agencyId !== undefined 
      ? eq(livers.agencyId, agencyId)
      : undefined;
  
  // Current month totals
  const currentMonth = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
      activeLivers: sql<number>`COUNT(DISTINCT ${brandLivestreams.liverId})`,
    })
    .from(brandLivestreams)
    .leftJoin(livers, eq(brandLivestreams.liverId, livers.id))
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        agencyFilter
      )
    );
  
  // Previous month totals
  const prevMonthData = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
      activeLivers: sql<number>`COUNT(DISTINCT ${brandLivestreams.liverId})`,
    })
    .from(brandLivestreams)
    .leftJoin(livers, eq(brandLivestreams.liverId, livers.id))
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        sql`${brandLivestreams.livestreamDate} >= ${prevStartDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${prevEndDate}`,
        agencyFilter
      )
    );
  
  const current = currentMonth[0];
  const prev = prevMonthData[0];
  
  // Calculate growth rates
  const salesGrowth = prev.totalSales > 0 
    ? Math.round(((current.totalSales - prev.totalSales) / prev.totalSales) * 100)
    : current.totalSales > 0 ? 100 : 0;
    
  const durationGrowth = prev.totalDuration > 0
    ? Math.round(((current.totalDuration - prev.totalDuration) / prev.totalDuration) * 100)
    : current.totalDuration > 0 ? 100 : 0;
    
  const livestreamGrowth = prev.totalLivestreams > 0
    ? Math.round(((current.totalLivestreams - prev.totalLivestreams) / prev.totalLivestreams) * 100)
    : current.totalLivestreams > 0 ? 100 : 0;
  
  return {
    totalSales: Number(current.totalSales),
    totalDuration: Number(current.totalDuration),
    totalLivestreams: Number(current.totalLivestreams),
    activeLivers: Number(current.activeLivers),
    prevTotalSales: Number(prev.totalSales),
    prevTotalDuration: Number(prev.totalDuration),
    prevTotalLivestreams: Number(prev.totalLivestreams),
    prevActiveLivers: Number(prev.activeLivers),
    salesGrowth,
    durationGrowth,
    livestreamGrowth,
  };
}

/**
 * Get monthly sales trend for all livers (past 6 months)
 */
export async function getLiverMonthlySalesTrend(agencyId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  
  // Build agency filter condition
  const agencyFilter = agencyId === null 
    ? isNull(livers.agencyId)
    : agencyId !== undefined 
      ? eq(livers.agencyId, agencyId)
      : undefined;
  
  const months = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const loopMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    const { startDate, endDate } = getJSTMonthRange(loopMonthKey);
    
    const query = db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
        totalLivestreams: sql<number>`COUNT(*)`,
      })
      .from(brandLivestreams);
    
    // Join livers table if agency filter is needed
    if (agencyFilter) {
      query.leftJoin(livers, eq(brandLivestreams.liverId, livers.id));
    }
    
    const result = await query.where(
      and(
        isNull(brandLivestreams.deletedAt),
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        agencyFilter
      )
    );
    
    months.push({
      month: `${year}-${String(month).padStart(2, '0')}`,
      label: `${month}月`,
      totalSales: Number(result[0]?.totalSales || 0),
      totalDuration: Number(result[0]?.totalDuration || 0),
      totalLivestreams: Number(result[0]?.totalLivestreams || 0),
    });
  }
  
  return months;
}


/**
 * Get detailed liver information with statistics
 */
export async function getLiverDetailWithStats(liverId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get liver basic info
  const liver = await db
    .select()
    .from(livers)
    .where(eq(livers.id, liverId))
    .limit(1);
  
  if (liver.length === 0) return null;
  
  // Get all-time statistics
  const allTimeStats = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
    })
    .from(brandLivestreams)
    .where(and(eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)));
  
  // Get current month statistics (JST-based)
  const now = new Date();
  // Get current month in JST
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentMonthKey = `${jstNow.getUTCFullYear()}-${String(jstNow.getUTCMonth() + 1).padStart(2, '0')}`;
  const { startDate: currentMonthStart, endDate: currentMonthEnd } = getJSTMonthRange(currentMonthKey);
  
  const currentMonthStats = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
    })
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      eq(brandLivestreams.liverId, liverId),
      sql`${brandLivestreams.livestreamDate} >= ${currentMonthStart}`,
      sql`${brandLivestreams.livestreamDate} <= ${currentMonthEnd}`
    ));
  
  // Get previous month statistics for growth calculation (JST-based)
  const jstPrevMonth = jstNow.getUTCMonth(); // 0-indexed, so this is prev month in 1-indexed
  const jstPrevYear = jstPrevMonth === 0 ? jstNow.getUTCFullYear() - 1 : jstNow.getUTCFullYear();
  const prevMonthKeyStr = `${jstPrevYear}-${String(jstPrevMonth === 0 ? 12 : jstPrevMonth).padStart(2, '0')}`;
  const { startDate: prevMonthStart, endDate: prevMonthEnd } = getJSTMonthRange(prevMonthKeyStr);
  
  const prevMonthStats = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
    })
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      eq(brandLivestreams.liverId, liverId),
      sql`${brandLivestreams.livestreamDate} >= ${prevMonthStart}`,
      sql`${brandLivestreams.livestreamDate} <= ${prevMonthEnd}`
    ));
  
  // Calculate growth rates
  const prevSales = Number(prevMonthStats[0]?.totalSales || 0);
  const currentSales = Number(currentMonthStats[0]?.totalSales || 0);
  const salesGrowth = prevSales > 0 ? ((currentSales - prevSales) / prevSales) * 100 : (currentSales > 0 ? 100 : 0);
  
  const prevLivestreams = Number(prevMonthStats[0]?.totalLivestreams || 0);
  const currentLivestreams = Number(currentMonthStats[0]?.totalLivestreams || 0);
  const livestreamGrowth = prevLivestreams > 0 ? ((currentLivestreams - prevLivestreams) / prevLivestreams) * 100 : (currentLivestreams > 0 ? 100 : 0);
  
  return {
    ...liver[0],
    allTimeStats: {
      totalSales: Number(allTimeStats[0]?.totalSales || 0),
      totalDuration: Number(allTimeStats[0]?.totalDuration || 0),
      totalLivestreams: Number(allTimeStats[0]?.totalLivestreams || 0),
    },
    currentMonthStats: {
      totalSales: currentSales,
      totalDuration: Number(currentMonthStats[0]?.totalDuration || 0),
      totalLivestreams: currentLivestreams,
    },
    prevMonthStats: {
      totalSales: prevSales,
      totalDuration: Number(prevMonthStats[0]?.totalDuration || 0),
      totalLivestreams: prevLivestreams,
    },
    growth: {
      salesGrowth: Math.round(salesGrowth * 10) / 10,
      livestreamGrowth: Math.round(livestreamGrowth * 10) / 10,
    },
  };
}

/**
 * Get liver's monthly sales trend (past 12 months)
 */
export async function getLiverMonthlySalesTrendById(liverId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const months = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const loopMonthKey2 = `${year}-${String(month).padStart(2, '0')}`;
    const { startDate, endDate } = getJSTMonthRange(loopMonthKey2);
    
    const result = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
        totalLivestreams: sql<number>`COUNT(*)`,
      })
      .from(brandLivestreams)
      .where(and(
        isNull(brandLivestreams.deletedAt),
        eq(brandLivestreams.liverId, liverId),
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`
      ));
    
    months.push({
      month: `${year}-${String(month).padStart(2, '0')}`,
      label: `${month}月`,
      year,
      totalSales: Number(result[0]?.totalSales || 0),
      totalDuration: Number(result[0]?.totalDuration || 0),
      totalLivestreams: Number(result[0]?.totalLivestreams || 0),
    });
  }
  
  return months;
}

/**
 * Get liver's recent livestreams with details
 */
export async function getLiverRecentLivestreams(liverId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  const livestreams = await db
    .select({
      id: brandLivestreams.id,
      brandId: brandLivestreams.brandId,
      livestreamDate: brandLivestreams.livestreamDate,
      livestreamEndTime: brandLivestreams.livestreamEndTime,
      duration: brandLivestreams.duration,
      gmv: brandLivestreams.gmv,
      viewerCount: brandLivestreams.viewerCount,
      remarks: brandLivestreams.remarks,
      beforeScreenshotUrl: brandLivestreams.beforeScreenshotUrl,
      screenshotUrl: brandLivestreams.screenshotUrl,
      brandName: brands.name,
    })
    .from(brandLivestreams)
    .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
    .where(and(eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)))
    .orderBy(desc(brandLivestreams.livestreamDate))
    .limit(limit);
  
  return livestreams;
}

/**
 * Get liver's brand performance breakdown
 */
export async function getLiverBrandPerformance(liverId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Build date filter conditions
  const conditions: any[] = [eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)];
  if (month) {
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate.toISOString().slice(0,10)} AND ${brandLivestreams.livestreamDate} < ${endDate.toISOString().slice(0,10)}`);
  }
  
  const performance = await db
    .select({
      brandId: brandLivestreams.brandId,
      brandName: brands.name,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
      avgSalesPerStream: sql<number>`COALESCE(AVG(${brandLivestreams.salesAmount}), 0)`,
    })
    .from(brandLivestreams)
    .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
    .where(and(...conditions))
    .groupBy(brandLivestreams.brandId, brands.name)
    .orderBy(sql`SUM(${brandLivestreams.salesAmount}) DESC`);
  
  return performance.map(p => ({
    ...p,
    totalSales: Number(p.totalSales),
    totalDuration: Number(p.totalDuration),
    totalLivestreams: Number(p.totalLivestreams),
    avgSalesPerStream: Math.round(Number(p.avgSalesPerStream)),
  }));
}


// ========================================
// Product Ranking & Liver-Product Matrix
// ========================================

/**
 * 数字のみの商品名（TikTok商品ID）を実際の商品名に解決するヘルパー関数
 * tiktok_tap_reportsテーブルからproductId→productNameのマッピングを取得
 */
export async function resolveNumericProductNames(productNames: string[]): Promise<Map<string, string>> {
  const db = await getDb();
  if (!db) return new Map();
  
  // 数字のみの商品名をフィルタ
  const numericNames = productNames.filter(name => /^\d+$/.test(name));
  if (numericNames.length === 0) return new Map();
  
  const resolvedMap = new Map<string, string>();
  
  // tiktok_tap_reportsから商品名を解決
  try {
    const results = await db
      .select({
        productId: tiktokTapReports.productId,
        productName: tiktokTapReports.productName,
      })
      .from(tiktokTapReports)
      .where(sql`${tiktokTapReports.productId} IN (${sql.join(numericNames.map(id => sql`${id}`), sql`, `)})`);
    
    // 同じproductIdに複数の名前がある場合は最初のものを使用
    for (const r of results) {
      if (r.productId && r.productName && !resolvedMap.has(r.productId)) {
        resolvedMap.set(r.productId, r.productName);
      }
    }
  } catch (e) {
    console.error('[resolveNumericProductNames] tiktok_tap_reports lookup error:', e);
  }
  
  // product_name_aliasesからも解決を試みる（手動マッピング）
  try {
    const unresolvedIds = numericNames.filter(id => !resolvedMap.has(id));
    if (unresolvedIds.length > 0) {
      const aliasResults = await db
        .select({
          aliasName: productNameAliases.aliasName,
          masterId: productNameAliases.productMasterId,
        })
        .from(productNameAliases)
        .where(sql`${productNameAliases.aliasName} IN (${sql.join(unresolvedIds.map(id => sql`${id}`), sql`, `)})`);
      
      if (aliasResults.length > 0) {
        const masterIds = aliasResults.map(a => a.masterId);
        const masters = await db
          .select({ id: productMaster.id, canonicalName: productMaster.canonicalName })
          .from(productMaster)
          .where(sql`${productMaster.id} IN (${sql.join(masterIds.map(id => sql`${id}`), sql`, `)})`);
        
        const masterMap = new Map(masters.map(m => [m.id, m.canonicalName]));
        for (const alias of aliasResults) {
          const masterName = masterMap.get(alias.masterId);
          if (masterName) {
            resolvedMap.set(alias.aliasName, masterName);
          }
        }
      }
    }
  } catch (e) {
    console.error('[resolveNumericProductNames] product_name_aliases lookup error:', e);
  }
  
  return resolvedMap;
}

/**
 * Get top selling products across all livers for a given month
 * 売れ筋商品ランキング（全ライバー合計）
 */
export async function getTopSellingProducts(month: string, limit: number = 10) {
  // Alias: getProductSalesRanking
  const db = await getDb();
  if (!db) return [];
  
  const { startDate, endDate } = getJSTMonthRange(month);
  
  // Get all livestreams for the month that have a liverId
  const livestreamsInMonth = await db
    .select({ 
      id: brandLivestreams.id,
      liverId: brandLivestreams.liverId,
    })
    .from(brandLivestreams)
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        isNotNull(brandLivestreams.liverId)
      )
    );
  
  if (livestreamsInMonth.length === 0) return [];
  
  const livestreamIds = livestreamsInMonth.map(l => l.id);
  
  // Get unique liver IDs and fetch their names
  const liverIds = Array.from(new Set(livestreamsInMonth.map(l => l.liverId).filter((id): id is number => id !== null)));
  const liversData = liverIds.length > 0 ? await db
    .select({
      id: livers.id,
      name: livers.name,
    })
    .from(livers)
    .where(sql`${livers.id} IN (${sql.join(liverIds.map(id => sql`${id}`), sql`, `)})`) : [];
  const liverNameMap = new Map(liversData.map(l => [l.id, l.name]));
  
  // Create livestream to liver mapping
  const livestreamToLiver = new Map(livestreamsInMonth.map(l => [l.id, l.liverId]));
  
  // Aggregate products by name
  const products = await db
    .select({
      productName: livestreamProducts.productName,
      totalGmv: sql<number>`COALESCE(SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)), 0)`,
      totalItemsSold: sql<number>`COALESCE(SUM(${livestreamProducts.itemsSold}), 0)`,
      totalOrders: sql<number>`COALESCE(SUM(${livestreamProducts.orders}), 0)`,
      livestreamCount: sql<number>`COUNT(DISTINCT ${livestreamProducts.livestreamId})`,
    })
    .from(livestreamProducts)
    .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(livestreamIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(livestreamProducts.productName)
    .orderBy(sql`SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)) DESC`)
    .limit(limit);
  
  // Get product-liver sales breakdown for each product
  const productNames = products.map(p => p.productName);
  const productLiverSales = productNames.length > 0 ? await db
    .select({
      productName: livestreamProducts.productName,
      livestreamId: livestreamProducts.livestreamId,
      gmv: sql<number>`COALESCE(SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)), 0)`,
    })
    .from(livestreamProducts)
    .where(
      and(
        sql`${livestreamProducts.livestreamId} IN (${sql.join(livestreamIds.map(id => sql`${id}`), sql`, `)})`,
        sql`${livestreamProducts.productName} IN (${sql.join(productNames.map(name => sql`${name}`), sql`, `)})`
      )
    )
    .groupBy(livestreamProducts.productName, livestreamProducts.livestreamId) : [];
  
  // Build product to livers mapping with sales
  const productLiversMap = new Map<string, Map<number, number>>();
  productLiverSales.forEach(sale => {
    const liverId = livestreamToLiver.get(sale.livestreamId);
    if (liverId) {
      if (!productLiversMap.has(sale.productName)) {
        productLiversMap.set(sale.productName, new Map());
      }
      const liverSales = productLiversMap.get(sale.productName)!;
      liverSales.set(liverId, (liverSales.get(liverId) || 0) + Number(sale.gmv));
    }
  });
  
  // 数字のみの商品名を実際の商品名に解決
  const allProductNames = products.map(p => p.productName);
  const resolvedNames = await resolveNumericProductNames(allProductNames);
  
  return products.map((p, index) => {
    // Get livers who sold this product, sorted by sales
    const liverSalesForProduct = productLiversMap.get(p.productName);
    const sellingLivers = liverSalesForProduct 
      ? Array.from(liverSalesForProduct.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([liverId, sales]) => ({
            liverId,
            liverName: liverNameMap.get(liverId) || `Liver ${liverId}`,
            sales,
          }))
      : [];
    
    // 数字IDの場合は解決した商品名を使用
    const displayName = resolvedNames.get(p.productName) || p.productName;
    
    return {
      rank: index + 1,
      productName: displayName,
      originalProductId: /^\d+$/.test(p.productName) ? p.productName : undefined,
      totalGmv: Number(p.totalGmv),
      totalItemsSold: Number(p.totalItemsSold),
      totalOrders: Number(p.totalOrders),
      avgPrice: p.totalItemsSold > 0 ? Math.round(Number(p.totalGmv) / Number(p.totalItemsSold)) : 0,
      livestreamCount: Number(p.livestreamCount),
      soldCount: Number(p.totalItemsSold),
      sellingLivers, // New: list of livers who sold this product
    };
  });
}

// Alias for getTopSellingProducts
export const getProductSalesRanking = getTopSellingProducts;

/**
 * Get liver-product matrix showing which livers sell which products best
 * ライバー×商品マトリックス
 */
export async function getLiverProductMatrix(month: string, topProductsLimit: number = 10) {
  const db = await getDb();
  if (!db) return { products: [], livers: [], matrix: [] };
  
  const { startDate, endDate } = getJSTMonthRange(month);
  
  // Get all livestreams for the month with liverId
  const livestreamsInMonth = await db
    .select({
      id: brandLivestreams.id,
      liverId: brandLivestreams.liverId,
      streamerName: brandLivestreams.streamerName,
    })
    .from(brandLivestreams)
    .where(
      and(
        isNull(brandLivestreams.deletedAt),
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        isNotNull(brandLivestreams.liverId)
      )
    );
  
  if (livestreamsInMonth.length === 0) {
    return { products: [], livers: [], matrix: [] };
  }
  
  const livestreamIds = livestreamsInMonth.map(l => l.id);
  
  // Get top products first
  const topProducts = await db
    .select({
      productName: livestreamProducts.productName,
      totalGmv: sql<number>`COALESCE(SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)), 0)`,
    })
    .from(livestreamProducts)
    .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(livestreamIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(livestreamProducts.productName)
    .orderBy(sql`SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)) DESC`)
    .limit(topProductsLimit);
  
  const productNames = topProducts.map(p => p.productName);
  
  if (productNames.length === 0) {
    return { products: [], livers: [], matrix: [] };
  }
  
  // Get unique liver IDs
  const liverIds = Array.from(new Set(livestreamsInMonth.map(l => l.liverId).filter((id): id is number => id !== null)));
  
  if (liverIds.length === 0) {
    return { products: [], livers: [], matrix: [] };
  }
  
  // Get liver names from livers table
  const liversData = await db
    .select({
      id: livers.id,
      name: livers.name,
    })
    .from(livers)
    .where(sql`${livers.id} IN (${sql.join(liverIds.map(id => sql`${id}`), sql`, `)})`);
  
  const liverNameMap = new Map(liversData.map(l => [l.id, l.name]));
  const liversList = liverIds.map(id => ({ id, name: liverNameMap.get(id) || `Liver ${id}` }));
  
  // Build matrix: for each liver, get their sales per product
  const matrix: Array<{
    liverId: number;
    liverName: string;
    products: Array<{ productName: string; gmv: number; itemsSold: number }>;
    totalGmv: number;
  }> = [];
  
  for (const liver of liversList) {
    // Get livestreams for this liver
    const liverLivestreamIds = livestreamsInMonth
      .filter(l => l.liverId === liver.id)
      .map(l => l.id);
    
    if (liverLivestreamIds.length === 0) continue;
    
    // Get product sales for this liver
    const liverProducts = await db
      .select({
        productName: livestreamProducts.productName,
        gmv: sql<number>`COALESCE(SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)), 0)`,
        itemsSold: sql<number>`COALESCE(SUM(${livestreamProducts.itemsSold}), 0)`,
      })
      .from(livestreamProducts)
      .where(
        and(
          sql`${livestreamProducts.livestreamId} IN (${sql.join(liverLivestreamIds.map(id => sql`${id}`), sql`, `)})`,
          sql`${livestreamProducts.productName} IN (${sql.join(productNames.map(name => sql`${name}`), sql`, `)})`
        )
      )
      .groupBy(livestreamProducts.productName);
    
    const productMap = new Map(liverProducts.map(p => [p.productName, { gmv: Number(p.gmv), itemsSold: Number(p.itemsSold) }]));
    
    const productsData = productNames.map(name => ({
      productName: name,
      gmv: productMap.get(name)?.gmv || 0,
      itemsSold: productMap.get(name)?.itemsSold || 0,
    }));
    
    const totalGmv = productsData.reduce((sum, p) => sum + p.gmv, 0);
    
    matrix.push({
      liverId: liver.id,
      liverName: liver.name,
      products: productsData,
      totalGmv,
    });
  }
  
  // Sort matrix by total GMV
  matrix.sort((a, b) => b.totalGmv - a.totalGmv);
  
  return {
    products: productNames,
    livers: liversList.map(l => l.name),
    matrix,
  };
}



// ============================================
// AI Product Matching Functions (AI商品マッチング)
// ============================================

// Get liver performance data for AI matching analysis
export async function getLiverPerformanceForMatching(month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Build date filter
  let dateFilter;
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    dateFilter = and(
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    );
  }
  
  // Get all livers with their livestream performance
  const liversData = await db
    .select({
      liverId: livers.id,
      liverName: livers.name,
      livestreamCount: sql<number>`COUNT(DISTINCT ${brandLivestreams.id})`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      avgViewers: sql<number>`COALESCE(AVG(${brandLivestreams.viewerCount}), 0)`,
    })
    .from(livers)
    .leftJoin(brandLivestreams, and(
      eq(brandLivestreams.liverId, livers.id),
      dateFilter ? dateFilter : sql`1=1`
    ))
    .where(eq(livers.isActive, true))
    .groupBy(livers.id, livers.name);
  
  return liversData;
}

// Get product performance data for AI matching analysis
export async function getProductPerformanceForMatching(month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Build date filter
  let dateFilter;
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    dateFilter = and(
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    );
  }
  
  // Get all products with their performance metrics
  const productsData = await db
    .select({
      productName: livestreamProducts.productName,
      totalGmv: sql<number>`COALESCE(SUM(${livestreamProducts.gmv}), 0) + COALESCE(SUM(${livestreamProducts.grossRevenue}), 0)`,
      totalItemsSold: sql<number>`COALESCE(SUM(${livestreamProducts.itemsSold}), 0)`,
      avgUnitPrice: sql<number>`COALESCE(AVG(${livestreamProducts.unitPrice}), 0)`,
      livestreamCount: sql<number>`COUNT(DISTINCT ${livestreamProducts.livestreamId})`,
    })
    .from(livestreamProducts)
    .innerJoin(brandLivestreams, eq(brandLivestreams.id, livestreamProducts.livestreamId))
    .where(dateFilter ? dateFilter : sql`1=1`)
    .groupBy(livestreamProducts.productName)
    .orderBy(desc(sql`COALESCE(SUM(${livestreamProducts.gmv}), 0) + COALESCE(SUM(${livestreamProducts.grossRevenue}), 0)`))
    .limit(50);
  
  return productsData;
}

// Get liver-product performance matrix for AI analysis
export async function getLiverProductPerformanceMatrix(month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Build date filter
  let dateFilter;
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    dateFilter = and(
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    );
  }
  
  // Get liver-product combinations with performance
  const matrixData = await db
    .select({
      liverId: brandLivestreams.liverId,
      liverName: livers.name,
      productName: livestreamProducts.productName,
      totalGmv: sql<number>`COALESCE(SUM(${livestreamProducts.gmv}), 0) + COALESCE(SUM(${livestreamProducts.grossRevenue}), 0)`,
      totalItemsSold: sql<number>`COALESCE(SUM(${livestreamProducts.itemsSold}), 0)`,
      livestreamCount: sql<number>`COUNT(DISTINCT ${brandLivestreams.id})`,
    })
    .from(livestreamProducts)
    .innerJoin(brandLivestreams, eq(brandLivestreams.id, livestreamProducts.livestreamId))
    .innerJoin(livers, eq(livers.id, brandLivestreams.liverId))
    .where(and(
      isNotNull(brandLivestreams.liverId),
      dateFilter ? dateFilter : sql`1=1`
    ))
    .groupBy(brandLivestreams.liverId, livers.name, livestreamProducts.productName);
  
  return matrixData;
}


// ========== Product Master Management Functions ==========

// Get all product masters
export async function getProductMasters() {
  const db = await getDb();
  if (!db) return [];
  
  const masters = await db
    .select()
    .from(productMaster)
    .orderBy(asc(productMaster.canonicalName));
  
  // Get alias counts for each master
  const aliases = await db
    .select()
    .from(productNameAliases);
  
  const aliasCountByMaster: Record<number, number> = {};
  aliases.forEach((alias: { productMasterId: number }) => {
    aliasCountByMaster[alias.productMasterId] = (aliasCountByMaster[alias.productMasterId] || 0) + 1;
  });
  
  return masters.map((master: { id: number; canonicalName: string }) => ({
    ...master,
    aliasCount: aliasCountByMaster[master.id] || 0,
  }));
}

// Get product master by ID
export async function getProductMasterById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(productMaster)
    .where(eq(productMaster.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Create a new product master
export async function createProductMaster(data: InsertProductMaster) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check for existing record with same canonicalName to prevent duplicates
  if (data.canonicalName) {
    const existing = await db.select({ id: productMaster.id })
      .from(productMaster)
      .where(eq(productMaster.canonicalName, data.canonicalName))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing record instead of creating duplicate
      const updateData: Partial<InsertProductMaster> = {};
      if (data.imageUrl) updateData.imageUrl = data.imageUrl;
      if (data.imageStatus) updateData.imageStatus = data.imageStatus;
      if (data.sourceUrl) updateData.sourceUrl = data.sourceUrl;
      
      if (Object.keys(updateData).length > 0) {
        await db.update(productMaster)
          .set(updateData)
          .where(eq(productMaster.id, existing[0].id));
      }
      return { id: existing[0].id, updated: true };
    }
  }
  
  const result = await db.insert(productMaster).values(data);
  // Extract insertId from MySQL result
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  return { id: insertId, updated: false };
}

// Update a product master
export async function updateProductMaster(id: number, data: Partial<InsertProductMaster>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .update(productMaster)
    .set(data)
    .where(eq(productMaster.id, id));
  
  return result;
}

// Delete a product master
export async function deleteProductMaster(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First delete all aliases
  await db.delete(productNameAliases).where(eq(productNameAliases.productMasterId, id));
  
  // Then delete the master
  const result = await db.delete(productMaster).where(eq(productMaster.id, id));
  return result;
}

// Add an alias to a product master
export async function addProductAlias(data: InsertProductNameAlias) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(productNameAliases).values(data);
  return result;
}

// Remove an alias
export async function removeProductAlias(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.delete(productNameAliases).where(eq(productNameAliases.id, id));
  return result;
}

// Get aliases for a product master
export async function getProductAliases(productMasterId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(productNameAliases)
    .where(eq(productNameAliases.productMasterId, productMasterId))
    .orderBy(asc(productNameAliases.aliasName));
  
  return result;
}

// Get unlinked product names (products in livestream data not linked to any master)
export async function getUnlinkedProductNames(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all linked alias names
  const linkedAliases = await db
    .select({ aliasName: productNameAliases.aliasName })
    .from(productNameAliases);
  
  const linkedNames = new Set(linkedAliases.map((a: { aliasName: string }) => a.aliasName));
  
  // Get all product names from livestream data with their sales
  const allProducts = await db
    .select({
      productName: livestreamProducts.productName,
      totalGmv: sql<number>`COALESCE(SUM(${livestreamProducts.gmv}), 0) + COALESCE(SUM(${livestreamProducts.grossRevenue}), 0)`,
      totalItemsSold: sql<number>`COALESCE(SUM(${livestreamProducts.itemsSold}), 0)`,
    })
    .from(livestreamProducts)
    .groupBy(livestreamProducts.productName)
    .orderBy(desc(sql`COALESCE(SUM(${livestreamProducts.gmv}), 0) + COALESCE(SUM(${livestreamProducts.grossRevenue}), 0)`));
  
  // Filter out linked products
  const unlinkedProducts = allProducts.filter((p: { productName: string }) => !linkedNames.has(p.productName));
  
  // Map to expected format
  return unlinkedProducts.slice(0, limit).map((p: { productName: string; totalGmv: number; totalItemsSold: number }) => ({
    productName: p.productName,
    totalSales: p.totalGmv,
    totalQuantity: p.totalItemsSold,
  }));
}

// Get product masters for matching (with their aliases)
export async function getProductMastersForMatching() {
  const db = await getDb();
  if (!db) return [];
  
  const masters = await db
    .select()
    .from(productMaster)
    .orderBy(asc(productMaster.canonicalName));
  
  const aliases = await db
    .select()
    .from(productNameAliases);
  
  // Group aliases by master ID
  const aliasesByMaster: Record<number, string[]> = {};
  aliases.forEach((alias: { productMasterId: number; aliasName: string }) => {
    if (!aliasesByMaster[alias.productMasterId]) {
      aliasesByMaster[alias.productMasterId] = [];
    }
    aliasesByMaster[alias.productMasterId].push(alias.aliasName);
  });
  
  return masters.map((master: { id: number; canonicalName: string }) => ({
    ...master,
    aliases: aliasesByMaster[master.id] || [],
  }));
}

// Create alias suggestion
export async function createAliasSuggestion(data: InsertProductAliasSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(productAliasSuggestions).values(data);
  return result;
}

// Get pending alias suggestions
export async function getPendingAliasSuggestions() {
  const db = await getDb();
  if (!db) return [];
  
  const suggestions = await db
    .select()
    .from(productAliasSuggestions)
    .where(eq(productAliasSuggestions.status, "pending"))
    .orderBy(desc(productAliasSuggestions.confidence));
  
  return suggestions;
}

// Approve alias suggestion
export async function approveAliasSuggestion(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the suggestion
  const suggestion = await db
    .select()
    .from(productAliasSuggestions)
    .where(eq(productAliasSuggestions.id, id))
    .limit(1);
  
  if (suggestion.length === 0) {
    throw new Error("Suggestion not found");
  }
  
  const sug = suggestion[0];
  
  // If suggesting a new master, create it first
  let masterId = sug.suggestedProductMasterId;
  if (!masterId && sug.suggestedCanonicalName) {
    const newMaster = await db.insert(productMaster).values({
      canonicalName: sug.suggestedCanonicalName,
    });
    masterId = Number(newMaster[0].insertId);
  }
  
  if (!masterId) {
    throw new Error("No master ID available");
  }
  
  // Create the alias
  await db.insert(productNameAliases).values({
    productMasterId: masterId,
    aliasName: sug.aliasName,
    matchMethod: "ai_suggested",
    confidence: sug.confidence,
    isConfirmed: true,
    confirmedBy: userId,
    confirmedAt: new Date(),
  });
  
  // Update suggestion status
  await db
    .update(productAliasSuggestions)
    .set({
      status: "approved",
      reviewedBy: userId,
      reviewedAt: new Date(),
    })
    .where(eq(productAliasSuggestions.id, id));
  
  return { success: true };
}

// Reject alias suggestion
export async function rejectAliasSuggestion(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(productAliasSuggestions)
    .set({
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: new Date(),
    })
    .where(eq(productAliasSuggestions.id, id));
  
  return { success: true };
}


// ========== Analytics Functions for Liver Dashboard ==========

/**
 * Get hourly sales analysis
 * 時間帯別売上分析
 */
export async function getHourlySalesAnalysis(month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let dateFilter = sql`1=1`;
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    dateFilter = and(
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    ) as any;
  }
  
  // Get all livestreams with their start times and sales
  const livestreams = await db
    .select({
      id: brandLivestreams.id,
      livestreamDate: brandLivestreams.livestreamDate,
      salesAmount: brandLivestreams.salesAmount,
      gmv: brandLivestreams.gmv,
      viewerCount: brandLivestreams.viewerCount,
      duration: brandLivestreams.duration,
    })
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      isNotNull(brandLivestreams.liverId),
      dateFilter
    ));
  
  // Aggregate by hour (JST)
  const hourlyData: Record<number, { 
    hour: number; 
    totalSales: number; 
    livestreamCount: number;
    totalViewers: number;
    totalDuration: number;
  }> = {};
  
  for (let i = 0; i < 24; i++) {
    hourlyData[i] = { hour: i, totalSales: 0, livestreamCount: 0, totalViewers: 0, totalDuration: 0 };
  }
  
  for (const ls of livestreams) {
    if (!ls.livestreamDate) continue;
    // Convert to JST (UTC+9)
    const jstDate = new Date(ls.livestreamDate.getTime() + 9 * 60 * 60 * 1000);
    const hour = jstDate.getUTCHours();
    
    hourlyData[hour].totalSales += Number(ls.gmv || ls.salesAmount || 0);
    hourlyData[hour].livestreamCount += 1;
    hourlyData[hour].totalViewers += Number(ls.viewerCount || 0);
    hourlyData[hour].totalDuration += Number(ls.duration || 0);
  }
  
  return Object.values(hourlyData).map(h => ({
    hour: h.hour,
    totalSales: h.totalSales,
    livestreamCount: h.livestreamCount,
    avgSales: h.livestreamCount > 0 ? Math.round(h.totalSales / h.livestreamCount) : 0,
    avgViewers: h.livestreamCount > 0 ? Math.round(h.totalViewers / h.livestreamCount) : 0,
    avgDuration: h.livestreamCount > 0 ? Math.round(h.totalDuration / h.livestreamCount) : 0,
  }));
}

/**
 * Get day of week performance analysis
 * 曜日別パフォーマンス分析
 */
export async function getDayOfWeekPerformance(month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  let dateFilter = sql`1=1`;
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    dateFilter = and(
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    ) as any;
  }
  
  // Get all livestreams
  const livestreams = await db
    .select({
      id: brandLivestreams.id,
      livestreamDate: brandLivestreams.livestreamDate,
      salesAmount: brandLivestreams.salesAmount,
      gmv: brandLivestreams.gmv,
      viewerCount: brandLivestreams.viewerCount,
      duration: brandLivestreams.duration,
      orderCount: brandLivestreams.orderCount,
    })
    .from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      isNotNull(brandLivestreams.liverId),
      dateFilter
    ));
  
  // Day names in Japanese
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  
  // Aggregate by day of week (JST)
  const dayData: Record<number, { 
    dayOfWeek: number;
    dayName: string;
    totalSales: number; 
    livestreamCount: number;
    totalViewers: number;
    totalDuration: number;
    totalOrders: number;
  }> = {};
  
  for (let i = 0; i < 7; i++) {
    dayData[i] = { 
      dayOfWeek: i, 
      dayName: dayNames[i],
      totalSales: 0, 
      livestreamCount: 0, 
      totalViewers: 0, 
      totalDuration: 0,
      totalOrders: 0,
    };
  }
  
  for (const ls of livestreams) {
    if (!ls.livestreamDate) continue;
    // Convert to JST (UTC+9)
    const jstDate = new Date(ls.livestreamDate.getTime() + 9 * 60 * 60 * 1000);
    const dayOfWeek = jstDate.getUTCDay();
    
    dayData[dayOfWeek].totalSales += Number(ls.gmv || ls.salesAmount || 0);
    dayData[dayOfWeek].livestreamCount += 1;
    dayData[dayOfWeek].totalViewers += Number(ls.viewerCount || 0);
    dayData[dayOfWeek].totalDuration += Number(ls.duration || 0);
    dayData[dayOfWeek].totalOrders += Number(ls.orderCount || 0);
  }
  
  return Object.values(dayData).map(d => ({
    dayOfWeek: d.dayOfWeek,
    dayName: d.dayName,
    totalSales: d.totalSales,
    livestreamCount: d.livestreamCount,
    avgSales: d.livestreamCount > 0 ? Math.round(d.totalSales / d.livestreamCount) : 0,
    avgViewers: d.livestreamCount > 0 ? Math.round(d.totalViewers / d.livestreamCount) : 0,
    avgDuration: d.livestreamCount > 0 ? Math.round(d.totalDuration / d.livestreamCount) : 0,
    avgOrders: d.livestreamCount > 0 ? Math.round(d.totalOrders / d.livestreamCount) : 0,
    conversionRate: d.totalViewers > 0 ? ((d.totalOrders / d.totalViewers) * 100).toFixed(2) : '0.00',
  }));
}


// ============================================
// 広告キャンペーン管理関数
// ============================================

/**
 * 広告キャンペーンを作成
 */
export async function createAdCampaign(data: InsertAdCampaign) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db.insert(adCampaigns).values(data).$returningId();
  return { id: inserted.id, ...data };
}

/**
 * ブランドIDで広告キャンペーン一覧を取得（メトリクス付き）
 */
export async function getAdCampaignsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const campaigns = await db
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.brandId, brandId))
    .orderBy(desc(adCampaigns.createdAt));
  
  if (campaigns.length === 0) return [];
  
  // 各キャンペーンのメトリクスを一括取得
  const campaignIds = campaigns.map(c => c.id);
  const allMetrics = await db
    .select()
    .from(adMetrics)
    .where(inArray(adMetrics.campaignId, campaignIds));
  
  // キャンペーンIDごとにメトリクスをグループ化
  const metricsMap = new Map<number, typeof allMetrics>();
  for (const m of allMetrics) {
    if (!metricsMap.has(m.campaignId)) {
      metricsMap.set(m.campaignId, []);
    }
    metricsMap.get(m.campaignId)!.push(m);
  }
  
  return campaigns.map(campaign => {
    const metrics = metricsMap.get(campaign.id) || [];
    const firstMetric = metrics[0];
    return {
      ...campaign,
      // メトリクスデータをフラットに展開
      impressions: metrics.reduce((sum, m) => sum + (m.impressions || 0), 0),
      clicks: metrics.reduce((sum, m) => sum + (m.clicks || 0), 0),
      gmv: metrics.reduce((sum, m) => sum + (m.gmv || 0), 0),
      adSpendActual: metrics.reduce((sum, m) => sum + (m.adSpend || 0), 0),
      roas: firstMetric?.roas || null,
    };
  });
}

/**
 * 広告キャンペーンをIDで取得
 */
export async function getAdCampaignById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 広告キャンペーンを更新
 */
export async function updateAdCampaign(id: number, data: Partial<InsertAdCampaign>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(adCampaigns).set(data).where(eq(adCampaigns.id, id));
}

/**
 * 広告キャンペーンを削除
 */
export async function deleteAdCampaign(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 関連するメトリクスと国別データも削除
  await db.delete(adMetrics).where(eq(adMetrics.campaignId, id));
  await db.delete(adCountryBreakdown).where(eq(adCountryBreakdown.campaignId, id));
  await db.delete(adCampaigns).where(eq(adCampaigns.id, id));
}

/**
 * 広告指標を作成
 */
export async function createAdMetrics(data: InsertAdMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(adMetrics).values(data);
}

/**
 * キャンペーンIDで広告指標を取得
 */
export async function getAdMetricsByCampaignId(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(adMetrics)
    .where(eq(adMetrics.campaignId, campaignId))
    .orderBy(desc(adMetrics.createdAt));
}

/**
 * 広告指標を更新
 */
export async function updateAdMetrics(id: number, data: Partial<InsertAdMetric>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(adMetrics).set(data).where(eq(adMetrics.id, id));
}

/**
 * 国別広告パフォーマンスを作成
 */
export async function createAdCountryBreakdown(data: InsertAdCountryBreakdown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(adCountryBreakdown).values(data);
}

/**
 * キャンペーンIDで国別パフォーマンスを取得
 */
export async function getAdCountryBreakdownByCampaignId(campaignId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(adCountryBreakdown)
    .where(eq(adCountryBreakdown.campaignId, campaignId))
    .orderBy(desc(adCountryBreakdown.percentage));
}

/**
 * ブランドの広告キャンペーン統計を取得
 */
export async function getAdCampaignStatsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return { campaignCount: 0, totalBudget: 0, totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalGmv: 0 };
  
  const campaigns = await db
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.brandId, brandId));
  
  if (campaigns.length === 0) {
    return { campaignCount: 0, totalBudget: 0, totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalGmv: 0 };
  }
  
  const campaignIds = campaigns.map(c => c.id);
  const metrics = await db
    .select()
    .from(adMetrics)
    .where(inArray(adMetrics.campaignId, campaignIds));
  
  return {
    campaignCount: campaigns.length,
    totalBudget: campaigns.reduce((sum, c) => sum + (c.budget || 0), 0),
    totalSpend: metrics.reduce((sum, m) => sum + (m.adSpend || 0), 0),
    totalImpressions: metrics.reduce((sum, m) => sum + (m.impressions || 0), 0),
    totalClicks: metrics.reduce((sum, m) => sum + (m.clicks || 0), 0),
    totalGmv: metrics.reduce((sum, m) => sum + (m.gmv || 0), 0),
  };
}


// ==========================================
// Ad Report Files (広告レポートファイル履歴)
// ==========================================

/**
 * 広告レポートファイルを作成
 */
export async function createAdReportFile(data: InsertAdReportFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(adReportFiles).values(data);
  return result;
}

/**
 * ブランドIDで広告レポートファイル一覧を取得
 */
export async function getAdReportFilesByBrandId(brandId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(adReportFiles)
    .where(eq(adReportFiles.brandId, brandId))
    .orderBy(desc(adReportFiles.createdAt))
    .limit(limit);
}

/**
 * 広告レポートファイルをIDで取得
 */
export async function getAdReportFileById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(adReportFiles)
    .where(eq(adReportFiles.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * 広告レポートファイルの分析結果を更新
 */
export async function updateAdReportFileAnalysis(
  id: number,
  analysisStatus: "pending" | "processing" | "completed" | "failed",
  analysisResult?: Record<string, unknown>,
  detectedLanguage?: string,
  campaignId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { analysisStatus };
  if (analysisResult !== undefined) updateData.analysisResult = analysisResult;
  if (detectedLanguage !== undefined) updateData.detectedLanguage = detectedLanguage;
  if (campaignId !== undefined) updateData.campaignId = campaignId;
  
  return await db
    .update(adReportFiles)
    .set(updateData)
    .where(eq(adReportFiles.id, id));
}

/**
 * 広告レポートファイルを削除
 */
export async function deleteAdReportFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(adReportFiles).where(eq(adReportFiles.id, id));
}


// ===== TikTok Commission Finance Functions =====

export async function createTiktokCsvImportHistory(data: InsertTiktokCsvImportHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tiktokCsvImportHistory).values(data).$returningId();
  return result[0].id;
}

export async function updateTiktokCsvImportHistory(id: number, data: Partial<InsertTiktokCsvImportHistory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tiktokCsvImportHistory).set(data).where(eq(tiktokCsvImportHistory.id, id));
}

export async function getTiktokCsvImportHistoryByBrand(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const query = brandId > 0
    ? db.select().from(tiktokCsvImportHistory).where(eq(tiktokCsvImportHistory.brandId, brandId)).orderBy(desc(tiktokCsvImportHistory.createdAt))
    : db.select().from(tiktokCsvImportHistory).orderBy(desc(tiktokCsvImportHistory.createdAt));
  return query;
}

export async function bulkInsertTiktokOrders(orders: InsertTiktokCommissionOrder[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Insert in batches of 50 (smaller batches for better error isolation)
  const batchSize = 50;
  let inserted = 0;
  let batchErrors: string[] = [];
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    try {
      await db.insert(tiktokCommissionOrders).values(batch);
      inserted += batch.length;
    } catch (batchError: any) {
      // If batch fails, try inserting records one by one
      console.error(`[bulkInsert] Batch ${i}-${i + batch.length} failed, trying individual inserts...`);
      for (let j = 0; j < batch.length; j++) {
        try {
          await db.insert(tiktokCommissionOrders).values([batch[j]]);
          inserted++;
        } catch (singleError: any) {
          // Log but continue - don't let one bad record kill the whole import
          const subOrderId = batch[j]?.subOrderId || 'unknown';
          console.error(`[bulkInsert] Failed to insert record subOrderId=${subOrderId}: ${(singleError.message || '').substring(0, 100)}`);
          batchErrors.push(`Row ${i + j}: subOrderId=${subOrderId}`);
        }
      }
    }
  }
  if (batchErrors.length > 0) {
    console.warn(`[bulkInsert] Completed with ${batchErrors.length} failed records out of ${orders.length} total`);
  }
  return inserted;
}

export async function getTiktokOrdersByBrand(brandId: number, options?: {
  limit?: number;
  offset?: number;
  search?: string;
  creatorUsername?: string;
  shopName?: string;
  contentType?: string;
  orderStatus?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  
  if (options?.creatorUsername) {
    conditions.push(eq(tiktokCommissionOrders.creatorUsername, options.creatorUsername));
  }
  if (options?.shopName) {
    conditions.push(eq(tiktokCommissionOrders.shopName, options.shopName));
  }
  if (options?.contentType) {
    conditions.push(eq(tiktokCommissionOrders.contentType, options.contentType));
  }
  if (options?.orderStatus) {
    conditions.push(eq(tiktokCommissionOrders.orderStatus, options.orderStatus));
  }
  if (options?.search) {
    conditions.push(
      or(
        like(tiktokCommissionOrders.productName, `%${options.search}%`),
        like(tiktokCommissionOrders.shopName, `%${options.search}%`),
        like(tiktokCommissionOrders.creatorUsername, `%${options.search}%`),
        like(tiktokCommissionOrders.orderId, `%${options.search}%`)
      )!
    );
  }
  if (options?.dateFrom) {
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, options.dateFrom));
  }
  if (options?.dateTo) {
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, options.dateTo));
  }
  
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions.length === 1 ? conditions[0] : undefined;
  
  const [rows, countResult] = await Promise.all([
    db.select()
      .from(tiktokCommissionOrders)
      .where(whereClause)
      .orderBy(desc(tiktokCommissionOrders.orderCreatedAt))
      .limit(options?.limit || 50)
      .offset(options?.offset || 0),
    db.select({ count: sql<number>`count(*)` })
      .from(tiktokCommissionOrders)
      .where(whereClause)
  ]);
  
  return { rows, total: countResult[0].count };
}

export async function getTiktokFinanceSummary(brandId: number, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, startDate));
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, endDate));
  }
  
  const result = await db.select({
    totalOrders: sql<number>`count(*)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
    avgPrice: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}) / NULLIF(sum(${tiktokCommissionOrders.quantity}), 0), 0)`,
    totalEstPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.estimatedPartnerCommission}), 0)`,
    totalEstCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.estimatedCreatorCommission}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
    totalEstPartnerReward: sql<number>`COALESCE(sum(${tiktokCommissionOrders.estimatedPartnerReward}), 0)`,
    totalEstCreatorReward: sql<number>`COALESCE(sum(${tiktokCommissionOrders.estimatedCreatorReward}), 0)`,
    totalActPartnerReward: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerReward}), 0)`,
    totalActCreatorReward: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorReward}), 0)`,
    totalActPartnerShopAd: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerShopAdPay}), 0)`,
    totalActCreatorShopAd: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorShopAdPay}), 0)`,
    totalActCommissionBase: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCommissionBase}), 0)`,
    avgPartnerCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.partnerCommissionRate}), 0)`,
    avgCreatorCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.creatorCommissionRate}), 0)`,
    totalReturnQty: sql<number>`COALESCE(sum(${tiktokCommissionOrders.returnQuantity}), 0)`,
    totalRefundQty: sql<number>`COALESCE(sum(${tiktokCommissionOrders.refundQuantity}), 0)`,
    completedOrders: sql<number>`sum(case when ${tiktokCommissionOrders.orderStatus} = '完了' then 1 else 0 end)`,
    processingOrders: sql<number>`sum(case when ${tiktokCommissionOrders.orderStatus} = '処理中' then 1 else 0 end)`,
    minDate: sql<string>`min(${tiktokCommissionOrders.orderCreatedAt})`,
    maxDate: sql<string>`max(${tiktokCommissionOrders.orderCreatedAt})`,
    uniqueCreators: sql<number>`count(distinct ${tiktokCommissionOrders.creatorUsername})`,
    uniqueShops: sql<number>`count(distinct ${tiktokCommissionOrders.shopName})`,
  })
  .from(tiktokCommissionOrders)
  .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return result[0];
}

export async function getTiktokCreatorSummary(brandId: number, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, startDate));
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, endDate));
  }
  
  return db.select({
    creatorUsername: tiktokCommissionOrders.creatorUsername,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
    totalActCommissionBase: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCommissionBase}), 0)`,
    avgPartnerCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.partnerCommissionRate}), 0)`,
    avgCreatorCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.creatorCommissionRate}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .groupBy(tiktokCommissionOrders.creatorUsername)
  .orderBy(desc(sql`sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity})`));
}

export async function getTiktokShopSummary(brandId: number, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, startDate));
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, endDate));
  }
  
  return db.select({
    shopName: tiktokCommissionOrders.shopName,
    shopCode: tiktokCommissionOrders.shopCode,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
    totalActCommissionBase: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCommissionBase}), 0)`,
    avgPartnerCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.partnerCommissionRate}), 0)`,
    avgCreatorCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.creatorCommissionRate}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .groupBy(tiktokCommissionOrders.shopName, tiktokCommissionOrders.shopCode)
  .orderBy(desc(sql`sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity})`));
}

export async function getTiktokProductSummary(brandId: number, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, startDate));
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, endDate));
  }
  
  return db.select({
    productName: tiktokCommissionOrders.productName,
    productId: tiktokCommissionOrders.productId,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
    totalActCommissionBase: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCommissionBase}), 0)`,
    avgPartnerCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.partnerCommissionRate}), 0)`,
    avgCreatorCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.creatorCommissionRate}), 0)`,
    avgPrice: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}) / NULLIF(sum(${tiktokCommissionOrders.quantity}), 0), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .groupBy(tiktokCommissionOrders.productName, tiktokCommissionOrders.productId)
  .orderBy(desc(sql`sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity})`));
}

export async function getTiktokDailySummary(brandId: number, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, startDate));
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, endDate));
  }
  
  return db.select({
    date: sql<string>`DATE(${tiktokCommissionOrders.orderCreatedAt})`.as('date'),
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
    totalActCommissionBase: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCommissionBase}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .groupBy(sql`date`)
  .orderBy(asc(sql`date`));
}

export async function getTiktokContentTypeSummary(brandId: number, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, startDate));
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, endDate));
  }
  
  return db.select({
    contentType: tiktokCommissionOrders.contentType,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .groupBy(tiktokCommissionOrders.contentType)
  .orderBy(desc(sql`count(*)`));
}

// 月別推移サマリー（全ブランド横断）
export async function getTiktokMonthlySummary(brandId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (brandId && brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  
  return db.select({
    month: sql<string>`DATE_FORMAT(${tiktokCommissionOrders.orderCreatedAt}, '%Y-%m')`.as('month'),
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
    totalActCommissionBase: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCommissionBase}), 0)`,
    avgPartnerCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.partnerCommissionRate}), 0)`,
    avgCreatorCommissionRate: sql<number>`COALESCE(avg(${tiktokCommissionOrders.creatorCommissionRate}), 0)`,
    uniqueCreators: sql<number>`count(distinct ${tiktokCommissionOrders.creatorUsername})`,
    uniqueShops: sql<number>`count(distinct ${tiktokCommissionOrders.shopName})`,
  })
  .from(tiktokCommissionOrders)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .groupBy(sql`month`)
  .orderBy(asc(sql`month`));
}

// 商品別クリエイター内訳
export async function getTiktokProductCreatorBreakdown(productName: string, brandId: number, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [eq(tiktokCommissionOrders.productName, productName)];
  if (brandId > 0) conditions.push(eq(tiktokCommissionOrders.brandId, brandId));
  if (month) {
    const { startDate, endDate } = getJSTMonthRange(month);
    conditions.push(gte(tiktokCommissionOrders.orderCreatedAt, startDate));
    conditions.push(lte(tiktokCommissionOrders.orderCreatedAt, endDate));
  }
  
  return db.select({
    creatorUsername: tiktokCommissionOrders.creatorUsername,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(and(...conditions))
  .groupBy(tiktokCommissionOrders.creatorUsername)
  .orderBy(desc(sql`sum(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity})`));
}

export async function deleteTiktokOrdersByImportId(importHistoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tiktokCommissionOrders).where(eq(tiktokCommissionOrders.importHistoryId, importHistoryId));
}

export async function deleteTiktokImportHistory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tiktokCsvImportHistory).where(eq(tiktokCsvImportHistory.id, id));
}

// ============================================
// TikTok入金データ関連
// ============================================

export async function insertTiktokPayments(payments: InsertTiktokPayment[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (payments.length === 0) return 0;
  await db.insert(tiktokPayments).values(payments);
  return payments.length;
}

export async function getTiktokPaymentsSummary(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = brandId > 0 ? [eq(tiktokPayments.brandId, brandId)] : [];
  const result = await db.select({
    totalPaymentAmount: sql<number>`COALESCE(SUM(${tiktokPayments.paymentAmount}), 0)`,
    paymentCount: sql<number>`COUNT(*)`,
  }).from(tiktokPayments).where(conditions.length > 0 ? and(...conditions) : undefined);
  return result[0] || { totalPaymentAmount: 0, paymentCount: 0 };
}

export async function getTiktokPaymentsByMonth(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions: any[] = [isNotNull(tiktokPayments.importMonth)];
  if (brandId > 0) conditions.push(eq(tiktokPayments.brandId, brandId));
  return db.select({
    month: tiktokPayments.importMonth,
    totalPaymentAmount: sql<number>`COALESCE(SUM(${tiktokPayments.paymentAmount}), 0)`,
    paymentCount: sql<number>`COUNT(*)`,
  }).from(tiktokPayments)
    .where(and(...conditions))
    .groupBy(tiktokPayments.importMonth)
    .orderBy(tiktokPayments.importMonth);
}

export async function getTiktokPaymentsList(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = brandId > 0 ? [eq(tiktokPayments.brandId, brandId)] : [];
  return db.select().from(tiktokPayments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tiktokPayments.paymentTime));
}

export async function getExistingPaymentReferenceIds(referenceIds: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (referenceIds.length === 0) return [];
  const result = await db.select({ referenceId: tiktokPayments.referenceId })
    .from(tiktokPayments)
    .where(inArray(tiktokPayments.referenceId, referenceIds));
  return result.map(r => r.referenceId);
}

export async function deleteTiktokPayment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tiktokPayments).where(eq(tiktokPayments.id, id));
}

export async function getExistingSubOrderIds(brandId: number, subOrderIds: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (subOrderIds.length === 0) return [];
  
  // Check in batches of 500
  const batchSize = 500;
  const existing: string[] = [];
  for (let i = 0; i < subOrderIds.length; i += batchSize) {
    const batch = subOrderIds.slice(i, i + batchSize);
    const result = await db.select({ subOrderId: tiktokCommissionOrders.subOrderId })
      .from(tiktokCommissionOrders)
      .where(and(
        eq(tiktokCommissionOrders.brandId, brandId),
        inArray(tiktokCommissionOrders.subOrderId, batch)
      ));
    existing.push(...result.map(r => r.subOrderId));
  }
  return existing;
}


// ============================================
// TikTok TAP Reports functions
// ============================================

export async function bulkInsertTiktokTapReports(reports: InsertTiktokTapReport[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (reports.length === 0) return 0;
  
  const batchSize = 100;
  let insertedCount = 0;
  for (let i = 0; i < reports.length; i += batchSize) {
    const batch = reports.slice(i, i + batchSize);
    await db.insert(tiktokTapReports).values(batch).onDuplicateKeyUpdate({
      set: {
        affiliateGmv: sql`VALUES(affiliateGmv)`,
        videoGmv: sql`VALUES(videoGmv)`,
        liveGmv: sql`VALUES(liveGmv)`,
        gmvRefund: sql`VALUES(gmvRefund)`,
        settledGmv: sql`VALUES(settledGmv)`,
        showcaseRevenue: sql`VALUES(showcaseRevenue)`,
        linkGmv: sql`VALUES(linkGmv)`,
        orders: sql`VALUES(orders)`,
        salesCount: sql`VALUES(salesCount)`,
        videoViews: sql`VALUES(videoViews)`,
        liveViews: sql`VALUES(liveViews)`,
        liveCount: sql`VALUES(liveCount)`,
        videoCount: sql`VALUES(videoCount)`,
        estimatedPartnerCommission: sql`VALUES(estimatedPartnerCommission)`,
        actualPartnerCommission: sql`VALUES(actualPartnerCommission)`,
        estimatedCreatorCommission: sql`VALUES(estimatedCreatorCommission)`,
        actualCreatorCommission: sql`VALUES(actualCreatorCommission)`,
        showcaseProducts: sql`VALUES(showcaseProducts)`,
        linkSalesCount: sql`VALUES(linkSalesCount)`,
        linkOrders: sql`VALUES(linkOrders)`,
        linkEstimatedPartnerCommission: sql`VALUES(linkEstimatedPartnerCommission)`,
        linkEstimatedCreatorCommission: sql`VALUES(linkEstimatedCreatorCommission)`,
      },
    });
    insertedCount += batch.length;
  }
  return insertedCount;
}

export async function getTiktokTapSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  const result = await db.select({
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLiveCount: sql<number>`COALESCE(SUM(liveCount), 0)`,
    totalVideoCount: sql<number>`COALESCE(SUM(videoCount), 0)`,
    totalShowcaseProducts: sql<number>`COALESCE(SUM(showcaseProducts), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalActualCreatorCommission: sql<number>`COALESCE(SUM(actualCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalSettledGmv: sql<number>`COALESCE(SUM(settledGmv), 0)`,
    totalShowcaseRevenue: sql<number>`COALESCE(SUM(showcaseRevenue), 0)`,
    totalLinkGmv: sql<number>`COALESCE(SUM(linkGmv), 0)`,
    totalLinkSalesCount: sql<number>`COALESCE(SUM(linkSalesCount), 0)`,
    totalLinkOrders: sql<number>`COALESCE(SUM(linkOrders), 0)`,
    totalLinkEstimatedPartnerCommission: sql<number>`COALESCE(SUM(linkEstimatedPartnerCommission), 0)`,
    totalLinkEstimatedCreatorCommission: sql<number>`COALESCE(SUM(linkEstimatedCreatorCommission), 0)`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
    shopCount: sql<number>`COUNT(DISTINCT shopName)`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return result[0];
}

export async function getTiktokTapCreatorSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  return db.select({
    creatorUsername: tiktokTapReports.creatorUsername,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLiveCount: sql<number>`COALESCE(SUM(liveCount), 0)`,
    totalVideoCount: sql<number>`COALESCE(SUM(videoCount), 0)`,
    totalShowcaseProducts: sql<number>`COALESCE(SUM(showcaseProducts), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalActualCreatorCommission: sql<number>`COALESCE(SUM(actualCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalSettledGmv: sql<number>`COALESCE(SUM(settledGmv), 0)`,
    totalShowcaseRevenue: sql<number>`COALESCE(SUM(showcaseRevenue), 0)`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
    shopCount: sql<number>`COUNT(DISTINCT shopName)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapReports.creatorUsername)
    .orderBy(sql`SUM(affiliateGmv) DESC`);
}

export async function getTiktokTapShopSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  return db.select({
    shopName: tiktokTapReports.shopName,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalActualCreatorCommission: sql<number>`COALESCE(SUM(actualCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalSettledGmv: sql<number>`COALESCE(SUM(settledGmv), 0)`,
    totalShowcaseRevenue: sql<number>`COALESCE(SUM(showcaseRevenue), 0)`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapReports.shopName)
    .orderBy(sql`SUM(affiliateGmv) DESC`);
}

export async function getTiktokTapMonthlySummary(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  
  return db.select({
    reportMonth: tiktokTapReports.reportMonth,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalActualCreatorCommission: sql<number>`COALESCE(SUM(actualCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalSettledGmv: sql<number>`COALESCE(SUM(settledGmv), 0)`,
    totalShowcaseRevenue: sql<number>`COALESCE(SUM(showcaseRevenue), 0)`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
    shopCount: sql<number>`COUNT(DISTINCT shopName)`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapReports.reportMonth)
    .orderBy(sql`reportMonth DESC`);
}

export async function getTiktokTapProductSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  return db.select({
    productId: tiktokTapReports.productId,
    productName: tiktokTapReports.productName,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalActualCreatorCommission: sql<number>`COALESCE(SUM(actualCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalSettledGmv: sql<number>`COALESCE(SUM(settledGmv), 0)`,
    totalShowcaseRevenue: sql<number>`COALESCE(SUM(showcaseRevenue), 0)`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
    shopCount: sql<number>`COUNT(DISTINCT shopName)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapReports.productId, tiktokTapReports.productName)
    .orderBy(sql`SUM(affiliateGmv) DESC`);
}

export async function deleteTiktokTapReportsByMonth(brandId: number, reportMonth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tiktokTapReports).where(
    and(
      eq(tiktokTapReports.brandId, brandId),
      eq(tiktokTapReports.reportMonth, reportMonth)
    )
  );
}

export async function getTiktokTapAvailableMonths(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  
  return db.select({
    reportMonth: tiktokTapReports.reportMonth,
    recordCount: sql<number>`COUNT(*)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapReports.reportMonth)
    .orderBy(sql`reportMonth DESC`);
}

// ============================================
// TikTok TAP Live Report 集計関数
// ============================================

export async function getTiktokTapLiveSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapLiveReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapLiveReports.reportMonth, month));
  
  const result = await db.select({
    totalGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(liveOrders), 0)`,
    totalViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLikes: sql<number>`COALESCE(SUM(liveLikes), 0)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalSessions: sql<number>`COUNT(DISTINCT liveRoomId)`,
    avgRpm: sql<number>`CASE WHEN COALESCE(SUM(liveViews), 0) > 0 THEN ROUND(COALESCE(SUM(liveGmv), 0) / COALESCE(SUM(liveViews), 0) * 1000, 2) ELSE 0 END`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
    shopCount: sql<number>`COUNT(DISTINCT shopName)`,
  }).from(tiktokTapLiveReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return result[0];
}

export async function getTiktokTapLiveCreatorSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapLiveReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapLiveReports.reportMonth, month));
  
  return db.select({
    creatorUsername: tiktokTapLiveReports.creatorUsername,
    totalGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(liveOrders), 0)`,
    totalViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLikes: sql<number>`COALESCE(SUM(liveLikes), 0)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalSessions: sql<number>`COUNT(DISTINCT liveRoomId)`,
    avgRpm: sql<number>`CASE WHEN COALESCE(SUM(liveViews), 0) > 0 THEN ROUND(COALESCE(SUM(liveGmv), 0) / COALESCE(SUM(liveViews), 0) * 1000, 2) ELSE 0 END`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
  }).from(tiktokTapLiveReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapLiveReports.creatorUsername)
    .orderBy(sql`SUM(liveGmv) DESC`);
}

export async function getTiktokTapLiveMonthlySummary(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapLiveReports.brandId, brandId));
  
  return db.select({
    reportMonth: tiktokTapLiveReports.reportMonth,
    totalGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(liveOrders), 0)`,
    totalViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLikes: sql<number>`COALESCE(SUM(liveLikes), 0)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalSessions: sql<number>`COUNT(DISTINCT liveRoomId)`,
    avgRpm: sql<number>`CASE WHEN COALESCE(SUM(liveViews), 0) > 0 THEN ROUND(COALESCE(SUM(liveGmv), 0) / COALESCE(SUM(liveViews), 0) * 1000, 2) ELSE 0 END`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
  }).from(tiktokTapLiveReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapLiveReports.reportMonth)
    .orderBy(sql`reportMonth DESC`);
}

export async function getTiktokTapLiveTopSessions(brandId: number = 0, month?: string, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapLiveReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapLiveReports.reportMonth, month));
  
  return db.select({
    liveRoomId: tiktokTapLiveReports.liveRoomId,
    liveName: sql<string>`MAX(liveName)`,
    liveTimeInfo: sql<string>`MAX(liveTimeInfo)`,
    reportMonth: sql<string>`MAX(reportMonth)`,
    creatorUsername: tiktokTapLiveReports.creatorUsername,
    totalGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(liveOrders), 0)`,
    totalViews: sql<number>`MAX(liveViews)`,
    totalLikes: sql<number>`MAX(liveLikes)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    avgRpm: sql<number>`CASE WHEN MAX(liveViews) > 0 THEN ROUND(COALESCE(SUM(liveGmv), 0) / MAX(liveViews) * 1000, 2) ELSE 0 END`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
  }).from(tiktokTapLiveReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapLiveReports.liveRoomId, tiktokTapLiveReports.creatorUsername)
    .orderBy(sql`SUM(liveGmv) DESC`)
    .limit(limit);
}

// ============================================
// TikTok TAP Video Report 集計関数
// ============================================

export async function getTiktokTapVideoSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapVideoReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapVideoReports.reportMonth, month));
  
  const result = await db.select({
    totalGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(videoOrders), 0)`,
    totalViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLikes: sql<number>`COALESCE(SUM(videoLikes), 0)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideos: sql<number>`COUNT(DISTINCT videoId)`,
    avgRpm: sql<number>`CASE WHEN COALESCE(SUM(videoViews), 0) > 0 THEN ROUND(COALESCE(SUM(videoGmv), 0) / COALESCE(SUM(videoViews), 0) * 1000, 2) ELSE 0 END`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
    shopCount: sql<number>`COUNT(DISTINCT shopName)`,
  }).from(tiktokTapVideoReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return result[0];
}

export async function getTiktokTapVideoCreatorSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapVideoReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapVideoReports.reportMonth, month));
  
  return db.select({
    creatorUsername: tiktokTapVideoReports.creatorUsername,
    totalGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(videoOrders), 0)`,
    totalViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLikes: sql<number>`COALESCE(SUM(videoLikes), 0)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideos: sql<number>`COUNT(DISTINCT videoId)`,
    avgRpm: sql<number>`CASE WHEN COALESCE(SUM(videoViews), 0) > 0 THEN ROUND(COALESCE(SUM(videoGmv), 0) / COALESCE(SUM(videoViews), 0) * 1000, 2) ELSE 0 END`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
  }).from(tiktokTapVideoReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapVideoReports.creatorUsername)
    .orderBy(sql`SUM(videoGmv) DESC`);
}

export async function getTiktokTapVideoMonthlySummary(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapVideoReports.brandId, brandId));
  
  return db.select({
    reportMonth: tiktokTapVideoReports.reportMonth,
    totalGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(videoOrders), 0)`,
    totalViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLikes: sql<number>`COALESCE(SUM(videoLikes), 0)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalVideos: sql<number>`COUNT(DISTINCT videoId)`,
    avgRpm: sql<number>`CASE WHEN COALESCE(SUM(videoViews), 0) > 0 THEN ROUND(COALESCE(SUM(videoGmv), 0) / COALESCE(SUM(videoViews), 0) * 1000, 2) ELSE 0 END`,
    creatorCount: sql<number>`COUNT(DISTINCT creatorUsername)`,
  }).from(tiktokTapVideoReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapVideoReports.reportMonth)
    .orderBy(sql`reportMonth DESC`);
}

export async function getTiktokTapVideoTopVideos(brandId: number = 0, month?: string, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapVideoReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapVideoReports.reportMonth, month));
  
  return db.select({
    videoId: tiktokTapVideoReports.videoId,
    videoName: sql<string>`MAX(videoName)`,
    postTime: sql<string>`MAX(postTime)`,
    reportMonth: sql<string>`MAX(reportMonth)`,
    creatorUsername: tiktokTapVideoReports.creatorUsername,
    totalGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(videoOrders), 0)`,
    totalViews: sql<number>`MAX(videoViews)`,
    totalLikes: sql<number>`MAX(videoLikes)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    avgRpm: sql<number>`CASE WHEN MAX(videoViews) > 0 THEN ROUND(COALESCE(SUM(videoGmv), 0) / MAX(videoViews) * 1000, 2) ELSE 0 END`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
  }).from(tiktokTapVideoReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapVideoReports.videoId, tiktokTapVideoReports.creatorUsername)
    .orderBy(sql`SUM(videoGmv) DESC`)
    .limit(limit);
}

// ============================================
// ファイナンス司令塔: クリエイター×商品ベストマッチ分析
// ============================================

export async function getTiktokTapCreatorProductMatrix(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  return db.select({
    creatorUsername: tiktokTapReports.creatorUsername,
    productId: tiktokTapReports.productId,
    productName: tiktokTapReports.productName,
    shopName: sql<string>`MAX(shopName)`,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalActualCreatorCommission: sql<number>`COALESCE(SUM(actualCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalSettledGmv: sql<number>`COALESCE(SUM(settledGmv), 0)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapReports.creatorUsername, tiktokTapReports.productId, tiktokTapReports.productName)
    .orderBy(sql`SUM(affiliateGmv) DESC`);
}

// ============================================
// ファイナンス司令塔: LIVE配信効率分析（配信時間含む）
// ============================================

export async function getTiktokTapLiveEfficiency(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapLiveReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapLiveReports.reportMonth, month));
  
  return db.select({
    creatorUsername: tiktokTapLiveReports.creatorUsername,
    totalGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(liveOrders), 0)`,
    totalViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalLikes: sql<number>`COALESCE(SUM(liveLikes), 0)`,
    totalBroadcastTime: sql<number>`COALESCE(SUM(broadcastTime), 0)`,
    totalPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalSessions: sql<number>`COUNT(DISTINCT liveRoomId)`,
    avgRpm: sql<number>`CASE WHEN COALESCE(SUM(liveViews), 0) > 0 THEN ROUND(COALESCE(SUM(liveGmv), 0) / COALESCE(SUM(liveViews), 0) * 1000, 2) ELSE 0 END`,
    gmvPerHour: sql<number>`CASE WHEN COALESCE(SUM(broadcastTime), 0) > 0 THEN ROUND(COALESCE(SUM(liveGmv), 0) / (COALESCE(SUM(broadcastTime), 0) / 3600), 0) ELSE 0 END`,
    ordersPerHour: sql<number>`CASE WHEN COALESCE(SUM(broadcastTime), 0) > 0 THEN ROUND(COALESCE(SUM(liveOrders), 0) / (COALESCE(SUM(broadcastTime), 0) / 3600), 1) ELSE 0 END`,
    cvr: sql<number>`CASE WHEN COALESCE(SUM(liveViews), 0) > 0 THEN ROUND(COALESCE(SUM(liveOrders), 0) / COALESCE(SUM(liveViews), 0) * 100, 4) ELSE 0 END`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
  }).from(tiktokTapLiveReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapLiveReports.creatorUsername)
    .orderBy(sql`SUM(liveGmv) DESC`);
}

// ============================================
// Livestream Sets (セット組み) functions
// ============================================

export async function createLivestreamSet(data: InsertLivestreamSet) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(livestreamSets).values(data);
  return result;
}

export async function createLivestreamSetItem(data: InsertLivestreamSetItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(livestreamSetItems).values(data);
  return result;
}

export async function getLivestreamSetsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sets = await db.select().from(livestreamSets)
    .where(eq(livestreamSets.livestreamId, livestreamId))
    .orderBy(asc(livestreamSets.sortOrder));
  
  // For each set, get its items
  const setsWithItems = await Promise.all(sets.map(async (set) => {
    const items = await db.select().from(livestreamSetItems)
      .where(eq(livestreamSetItems.setId, set.id))
      .orderBy(asc(livestreamSetItems.sortOrder));
    return { ...set, items };
  }));
  
  return setsWithItems;
}

export async function deleteLivestreamSetsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First get all set IDs for this livestream
  const sets = await db.select({ id: livestreamSets.id }).from(livestreamSets)
    .where(eq(livestreamSets.livestreamId, livestreamId));
  
  // Delete items for each set
  if (sets.length > 0) {
    const setIds = sets.map(s => s.id);
    await db.delete(livestreamSetItems).where(inArray(livestreamSetItems.setId, setIds));
  }
  
  // Delete the sets themselves
  await db.delete(livestreamSets).where(eq(livestreamSets.livestreamId, livestreamId));
}


// ========================================
// Liver Detail Enhancement Functions
// ライバー詳細ページ改善用関数
// ========================================

/**
 * Get top selling products for a specific liver
 * ライバー別の売れ筋商品ランキング
 */
export async function getTopProductsByLiver(liverId: number, limit: number = 20, month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Build date filter conditions
  const conditions: any[] = [eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)];
  if (month) {
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate.toISOString().slice(0,10)} AND ${brandLivestreams.livestreamDate} < ${endDate.toISOString().slice(0,10)}`);
  }
  
  // Get all livestream IDs for this liver
  const liverLivestreams = await db
    .select({ id: brandLivestreams.id })
    .from(brandLivestreams)
    .where(and(...conditions));
  
  if (liverLivestreams.length === 0) return [];
  
  const livestreamIds = liverLivestreams.map(l => l.id);
  
  // Aggregate products by name for this liver
  const products = await db
    .select({
      productName: livestreamProducts.productName,
      totalGmv: sql<number>`COALESCE(SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)), 0)`,
      totalItemsSold: sql<number>`COALESCE(SUM(${livestreamProducts.itemsSold}), 0)`,
      totalOrders: sql<number>`COALESCE(SUM(${livestreamProducts.orders}), 0)`,
      livestreamCount: sql<number>`COUNT(DISTINCT ${livestreamProducts.livestreamId})`,
    })
    .from(livestreamProducts)
    .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(livestreamIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(livestreamProducts.productName)
    .orderBy(sql`SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)) DESC`)
    .limit(limit);
  
  // 数字のみの商品名を実際の商品名に解決
  const allProductNames = products.map(p => p.productName);
  const resolvedNames = await resolveNumericProductNames(allProductNames);
  
  return products.map((p, index) => {
    const displayName = resolvedNames.get(p.productName) || p.productName;
    return {
      rank: index + 1,
      productName: displayName,
      originalProductId: /^\d+$/.test(p.productName) ? p.productName : undefined,
      totalGmv: Number(p.totalGmv),
      totalItemsSold: Number(p.totalItemsSold),
      totalOrders: Number(p.totalOrders),
      livestreamCount: Number(p.livestreamCount),
      avgGmvPerStream: Number(p.livestreamCount) > 0 ? Math.round(Number(p.totalGmv) / Number(p.livestreamCount)) : 0,
    };
  });
}

/**
 * Get product category analysis for a specific liver
 * ライバー別の得意カテゴリ分析（商品名からカテゴリを推定）
 */
export async function getLiverCategoryAnalysis(liverId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Build date filter conditions
  const conditions: any[] = [eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)];
  if (month) {
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate.toISOString().slice(0,10)} AND ${brandLivestreams.livestreamDate} < ${endDate.toISOString().slice(0,10)}`);
  }
  
  // Get all livestream IDs for this liver
  const liverLivestreams = await db
    .select({ id: brandLivestreams.id })
    .from(brandLivestreams)
    .where(and(...conditions));
  
  if (liverLivestreams.length === 0) return [];
  
  const livestreamIds = liverLivestreams.map(l => l.id);
  
  // Get all products for this liver
  const products = await db
    .select({
      productName: livestreamProducts.productName,
      totalGmv: sql<number>`COALESCE(SUM(COALESCE(${livestreamProducts.directGmv}, ${livestreamProducts.gmv}, 0)), 0)`,
      totalItemsSold: sql<number>`COALESCE(SUM(${livestreamProducts.itemsSold}), 0)`,
    })
    .from(livestreamProducts)
    .where(sql`${livestreamProducts.livestreamId} IN (${sql.join(livestreamIds.map(id => sql`${id}`), sql`, `)})`)
    .groupBy(livestreamProducts.productName);
  
  // 数字のみの商品名を実際の商品名に解決
  const allProductNames = products.map(p => p.productName);
  const resolvedNames = await resolveNumericProductNames(allProductNames);
  
  // 解決済み商品名で置き換え
  const resolvedProducts = products.map(p => ({
    ...p,
    productName: resolvedNames.get(p.productName) || p.productName,
  }));
  
  // Load manual category mappings from DB (priority over pattern matching)
  const manualMappings = await db.select().from(productCategoryMappings);
  const manualMappingMap = new Map<string, string>();
  for (const m of manualMappings) {
    manualMappingMap.set(m.productName, m.category);
  }
  
  // Category classification based on product name patterns (fallback)
  const categoryPatterns: Record<string, string[]> = {
    "美容液・セラム": ["美容液", "セラム", "serum", "エッセンス", "essence", "アンプル"],
    "ヘアケア": ["シャンプー", "トリートメント", "ヘアオイル", "ヘア", "hair", "コンディショナー", "ヘアミスト", "ヘアミルク"],
    "スキンケア": ["化粧水", "乳液", "クリーム", "ローション", "モイスチャー", "保湿", "skin", "フェイス", "洗顔", "クレンジング", "パック", "マスク"],
    "UV・日焼け止め": ["UV", "日焼け止め", "サンスクリーン", "SPF", "sunscreen", "sun"],
    "美顔器・デバイス": ["美顔器", "デバイス", "EMS", "LED", "マッサージ", "ローラー", "device"],
    "メイクアップ": ["ファンデ", "リップ", "アイシャドウ", "マスカラ", "チーク", "コンシーラー", "パウダー", "メイク", "makeup", "BBクリーム", "CCクリーム"],
    "ボディケア": ["ボディ", "body", "ハンドクリーム", "ボディクリーム", "ボディローション", "入浴"],
    "サプリメント": ["サプリ", "supplement", "ビタミン", "コラーゲン", "プロテイン", "酵素"],
    "健康食品・ドリンク": ["ドリンク", "drink", "tea", "茶", "ジュース", "スムージー", "食品"],
    "フレグランス": ["香水", "フレグランス", "fragrance", "perfume", "コロン"],
  };
  
  const categoryMap = new Map<string, { gmv: number; itemsSold: number; productCount: number; products: { name: string; gmv: number }[] }>();
  
  for (const product of resolvedProducts) {
    let assignedCategory: string | null = null;
    
    // 1. Check manual mapping first (highest priority)
    const manualCategory = manualMappingMap.get(product.productName);
    if (manualCategory) {
      assignedCategory = manualCategory;
    }
    
    // 2. Fallback to pattern matching
    if (!assignedCategory) {
      const name = product.productName.toLowerCase();
      for (const [category, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(pattern => name.includes(pattern.toLowerCase()))) {
          assignedCategory = category;
          break;
        }
      }
    }
    
    // 3. If still no match, assign to "その他"
    if (!assignedCategory) {
      assignedCategory = "その他";
    }
    
    const existing = categoryMap.get(assignedCategory) || { gmv: 0, itemsSold: 0, productCount: 0, products: [] };
    existing.gmv += Number(product.totalGmv);
    existing.itemsSold += Number(product.totalItemsSold);
    existing.productCount += 1;
    existing.products.push({ name: product.productName, gmv: Number(product.totalGmv) });
    categoryMap.set(assignedCategory, existing);
  }
  
  // Convert to array and sort by GMV
  const totalGmv = Array.from(categoryMap.values()).reduce((sum, c) => sum + c.gmv, 0);
  
  const categories = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      gmv: data.gmv,
      itemsSold: data.itemsSold,
      productCount: data.productCount,
      percentage: totalGmv > 0 ? Math.round((data.gmv / totalGmv) * 100) : 0,
      products: data.products.sort((a, b) => b.gmv - a.gmv),
    }))
    .sort((a, b) => b.gmv - a.gmv);
  
  return categories;
}

// ===== Product Category Mapping Functions =====

/**
 * Get all product category mappings
 */
export async function getAllProductCategoryMappings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(productCategoryMappings).orderBy(asc(productCategoryMappings.category), asc(productCategoryMappings.productName));
}

/**
 * Get product category mapping by product name
 */
export async function getProductCategoryMappingByName(productName: string) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(productCategoryMappings).where(eq(productCategoryMappings.productName, productName)).limit(1);
  return results[0] || null;
}

/**
 * Create or update a product category mapping (upsert)
 */
export async function upsertProductCategoryMapping(productName: string, category: string) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if mapping exists
  const existing = await db.select().from(productCategoryMappings).where(eq(productCategoryMappings.productName, productName)).limit(1);
  
  if (existing.length > 0) {
    // Update existing
    await db.update(productCategoryMappings)
      .set({ category })
      .where(eq(productCategoryMappings.productName, productName));
    return { id: existing[0].id, productName, category, updated: true };
  } else {
    // Insert new
    const result = await db.insert(productCategoryMappings).values({ productName, category }).$returningId();
    return { id: result[0].id, productName, category, updated: false };
  }
}

/**
 * Bulk upsert product category mappings
 */
export async function bulkUpsertProductCategoryMappings(mappings: { productName: string; category: string }[]) {
  const db = await getDb();
  if (!db) return [];
  
  const results = [];
  for (const mapping of mappings) {
    const result = await upsertProductCategoryMapping(mapping.productName, mapping.category);
    if (result) results.push(result);
  }
  return results;
}

/**
 * Delete a product category mapping
 */
export async function deleteProductCategoryMapping(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(productCategoryMappings).where(eq(productCategoryMappings.id, id));
  return true;
}

/**
 * Get all distinct custom categories (user-created categories from mappings)
 */
export async function getDistinctMappingCategories() {
  const db = await getDb();
  if (!db) return [];
  const results = await db.selectDistinct({ category: productCategoryMappings.category }).from(productCategoryMappings).orderBy(asc(productCategoryMappings.category));
  return results.map(r => r.category);
}


// ============================================================
// Simulation functions
// ============================================================

/**
 * Get liver's historical performance stats for simulation
 * ライバーの過去実績統計を取得（シミュレーション計算用）
 */
export async function getLiverPerformanceStats(liverId: number, options?: { category?: string; priceRange?: { min: number; max: number } }) {
  const db = await getDb();
  if (!db) return null;

  // Get all livestreams for this liver
  const liver = await db.select().from(livers).where(eq(livers.id, liverId)).limit(1);
  if (!liver.length) return null;

  const liverName = liver[0].name;

  // Get all livestreams by this liver (use liverId first, fallback to streamerName)
  let allStreams = await db.select().from(brandLivestreams)
    .where(and(eq(brandLivestreams.liverId, liverId), isNull(brandLivestreams.deletedAt)))
    .orderBy(desc(brandLivestreams.livestreamDate));

  // Fallback: if no streams found by liverId, try matching by streamerName
  if (!allStreams.length) {
    allStreams = await db.select().from(brandLivestreams)
      .where(and(eq(brandLivestreams.streamerName, liverName), isNull(brandLivestreams.deletedAt)))
      .orderBy(desc(brandLivestreams.livestreamDate));
  }

  if (!allStreams.length) return null;

  // Calculate stats - use top performing streams for optimistic but realistic estimates
  const validStreams = allStreams.filter(s => s.gmv && Number(s.gmv) > 0);
  
  // Sort by GMV descending to prioritize high-performing streams
  const sortedByGmv = [...validStreams].sort((a, b) => (Number(b.gmv) || 0) - (Number(a.gmv) || 0));
  
  // Use top 70% of streams (exclude bottom 30% outliers/bad days) for optimistic average
  const topPercentile = Math.max(Math.ceil(sortedByGmv.length * 0.7), 1);
  const topStreams = sortedByGmv.slice(0, topPercentile);
  
  const totalGmv = validStreams.reduce((sum, s) => sum + (Number(s.gmv) || 0), 0);
  const totalDuration = validStreams.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalSalesCount = validStreams.reduce((sum, s) => sum + (s.itemsSold || s.salesCount || 0), 0);
  const totalViewers = validStreams.reduce((sum, s) => sum + (s.viewerCount || 0), 0);
  const totalOrders = validStreams.reduce((sum, s) => sum + (s.orderCount || 0), 0);

  // Use top streams for GMV averages (optimistic but achievable)
  const topTotalGmv = topStreams.reduce((sum, s) => sum + (Number(s.gmv) || 0), 0);
  const topTotalDuration = topStreams.reduce((sum, s) => sum + (s.duration || 0), 0);
  const topTotalViewers = topStreams.reduce((sum, s) => sum + (s.viewerCount || 0), 0);
  const topTotalSalesCount = topStreams.reduce((sum, s) => sum + (s.itemsSold || s.salesCount || 0), 0);
  const topTotalOrders = topStreams.reduce((sum, s) => sum + (s.orderCount || 0), 0);

  const streamCount = validStreams.length;
  // Use top-performing averages for simulation (more attractive to brands)
  const avgGmvPerStream = topStreams.length > 0 ? topTotalGmv / topStreams.length : 0;
  const avgGmvPerHour = topTotalDuration > 0 ? topTotalGmv / (topTotalDuration / 60) : 0;
  const avgViewers = topStreams.length > 0 ? topTotalViewers / topStreams.length : 0;
  const avgSalesPerStream = topStreams.length > 0 ? topTotalSalesCount / topStreams.length : 0;
  const avgOrdersPerStream = topStreams.length > 0 ? topTotalOrders / topStreams.length : 0;

  // CVR calculation
  const streamsWithCvr = validStreams.filter(s => s.cvr);
  const avgCvr = streamsWithCvr.length > 0
    ? streamsWithCvr.reduce((sum, s) => sum + parseFloat(String(s.cvr || '0').replace('%', '')), 0) / streamsWithCvr.length
    : 0;

  // Get product-level data for price range filtering
  let filteredGmv = totalGmv;
  let filteredCount = streamCount;
  if (options?.priceRange) {
    const streamIds = validStreams.map(s => s.id);
    if (streamIds.length > 0) {
      const products = await db.select().from(livestreamProducts)
        .where(inArray(livestreamProducts.livestreamId, streamIds));
      
      const matchingProducts = products.filter(p => {
        const price = Number(p.unitPrice) || 0;
        return price >= (options.priceRange?.min || 0) && price <= (options.priceRange?.max || Infinity);
      });
      
      if (matchingProducts.length > 0) {
        filteredGmv = matchingProducts.reduce((sum, p) => sum + (Number(p.gmv) || Number(p.grossRevenue) || Number(p.directGmv) || 0), 0);
        filteredCount = matchingProducts.length;
      }
    }
  }

  // Time slot analysis
  const timeSlotStats: Record<string, { count: number; totalGmv: number }> = {};
  validStreams.forEach(s => {
    const slot = s.livestreamStartTime || 'unknown';
    if (!timeSlotStats[slot]) timeSlotStats[slot] = { count: 0, totalGmv: 0 };
    timeSlotStats[slot].count++;
    timeSlotStats[slot].totalGmv += Number(s.gmv) || 0;
  });

  // Best time slot
  const bestTimeSlot = Object.entries(timeSlotStats)
    .sort((a, b) => (b[1].totalGmv / b[1].count) - (a[1].totalGmv / a[1].count))[0];

  return {
    liverName,
    liverId,
    streamCount,
    totalGmv,
    avgGmvPerStream: Math.round(avgGmvPerStream),
    avgGmvPerHour: Math.round(avgGmvPerHour),
    avgViewers: Math.round(avgViewers),
    avgSalesPerStream: Math.round(avgSalesPerStream),
    avgOrdersPerStream: Math.round(avgOrdersPerStream),
    avgCvr,
    filteredGmv,
    filteredCount,
    bestTimeSlot: bestTimeSlot ? { slot: bestTimeSlot[0], avgGmv: Math.round(bestTimeSlot[1].totalGmv / bestTimeSlot[1].count) } : null,
    recentStreams: validStreams.slice(0, 10).map(s => ({
      id: s.id,
      date: s.livestreamDate,
      gmv: Number(s.gmv) || 0,
      duration: s.duration || 0,
      viewers: s.viewerCount || 0,
      salesCount: s.itemsSold || s.salesCount || 0,
    })),
  };
}

/**
 * Find similar past cases for simulation comparison
 * 類似案件を検索（同価格帯×同ライバー or 同カテゴリ）
 */
export async function findSimilarCases(params: {
  liverId: number;
  unitPrice: number;
  streamDuration: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const liver = await db.select().from(livers).where(eq(livers.id, params.liverId)).limit(1);
  if (!liver.length) return [];

  const liverName = liver[0].name;
  const priceMin = params.unitPrice * 0.5;
  const priceMax = params.unitPrice * 2;

  // Get livestreams by this liver (use liverId first, fallback to streamerName)
  // Only include streams with GMV > 0 (exclude zero/null GMV)
  let streams = await db.select().from(brandLivestreams)
    .where(and(
      isNull(brandLivestreams.deletedAt),
      eq(brandLivestreams.liverId, params.liverId),
      isNotNull(brandLivestreams.gmv),
    ))
    .orderBy(desc(brandLivestreams.gmv)) // Sort by GMV descending (highest first)
    .limit(50);

  // Fallback: if no streams found by liverId, try matching by streamerName
  if (!streams.length) {
    streams = await db.select().from(brandLivestreams)
      .where(and(
        isNull(brandLivestreams.deletedAt),
        eq(brandLivestreams.streamerName, liverName),
        isNotNull(brandLivestreams.gmv),
      ))
      .orderBy(desc(brandLivestreams.gmv)) // Sort by GMV descending
      .limit(50);
  }

  // Filter out GMV=0 streams and sort by GMV descending (highest performing first)
  const validStreams = streams.filter(s => (Number(s.gmv) || 0) > 0);
  
  // Prefer similar duration (±50%) but always prioritize high GMV
  const durationMin = params.streamDuration * 0.5;
  const durationMax = params.streamDuration * 1.5;
  
  const similarDuration = validStreams.filter(s => {
    const dur = s.duration || 0;
    return dur >= durationMin && dur <= durationMax;
  });

  // Use similar duration matches if enough, otherwise use top GMV streams
  // Always sorted by GMV descending (highest first)
  const candidates = similarDuration.length >= 3 ? similarDuration : validStreams;
  const finalStreams = candidates.slice(0, params.limit || 5);

  // Enrich with brand name and product name
  const brandIdSet = new Set<number>();
  const productIdSet = new Set<number>();
  for (const s of finalStreams) {
    brandIdSet.add(s.brandId);
    if (s.productId) productIdSet.add(s.productId);
  }
  const brandIds: number[] = [];
  brandIdSet.forEach(id => brandIds.push(id));
  const productIds: number[] = [];
  productIdSet.forEach(id => productIds.push(id));

  const brandMap = new Map<number, string>();
  const productMap = new Map<number, string>();

  if (brandIds.length > 0) {
    const brandRows = await db.select({ id: brands.id, name: brands.name, nameJa: brands.nameJa }).from(brands).where(and(inArray(brands.id, brandIds), isNull(brands.deletedAt)));
    for (const b of brandRows) {
      brandMap.set(b.id, b.nameJa || b.name);
    }
  }

  if (productIds.length > 0) {
    const productRows = await db.select({ id: brandProducts.id, productName: brandProducts.productName }).from(brandProducts).where(inArray(brandProducts.id, productIds));
    for (const p of productRows) {
      productMap.set(p.id, p.productName);
    }
  }

  return finalStreams.map(s => ({
    id: s.id,
    date: s.livestreamDate,
    gmv: Number(s.gmv) || 0,
    salesAmount: Number(s.salesAmount) || 0,
    duration: s.duration || 0,
    viewers: s.viewerCount || 0,
    salesCount: s.itemsSold || s.salesCount || 0,
    cvr: s.cvr,
    avgPrice: Number(s.avgPrice) || 0,
    // 詳細情報
    brandName: brandMap.get(s.brandId) || null,
    productName: s.productId ? (productMap.get(s.productId) || null) : null,
    platform: s.platform || null,
    peakViewers: s.peakViewers || null,
    likes: s.likes || null,
    comments: s.comments || null,
    shares: s.shares || null,
    ctr: s.ctr || null,
    impressions: s.impressions || null,
    orderCount: s.orderCount || null,
    adCost: s.adCost ? Number(s.adCost) : null,
    result: s.result || null,
    livestreamStartTime: s.livestreamStartTime || null,
  }));
}

/**
 * Create a new simulation
 */
export async function createSimulation(data: InsertSimulation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(simulations).values(data);
  return result;
}

/**
 * Get simulation by ID
 */
export async function getSimulationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(simulations).where(eq(simulations.id, id)).limit(1);
  return result[0] || null;
}

/**
 * Get simulation by share token (public access)
 */
export async function getSimulationByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(simulations).where(eq(simulations.shareToken, token)).limit(1);
  return result[0] || null;
}

/**
 * List simulations for a user
 */
export async function listSimulations(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simulations)
    .where(eq(simulations.createdBy, userId))
    .orderBy(desc(simulations.createdAt))
    .limit(limit);
}

/**
 * Update simulation with results
 */
export async function updateSimulation(id: number, data: Partial<InsertSimulation>) {
  const db = await getDb();
  if (!db) return false;
  await db.update(simulations).set(data).where(eq(simulations.id, id));
  return true;
}

/**
 * Delete simulation
 */
export async function deleteSimulation(id: number) {
  const db = await getDb();
  if (!db) return false;
  await db.delete(simulations).where(eq(simulations.id, id));
  return true;
}

/**
 * Create simulation feedback (actual results)
 */
export async function createSimulationFeedback(data: InsertSimulationFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(simulationFeedback).values(data);
}

/**
 * Get all feedback for learning (prediction vs actual)
 */
export async function getSimulationFeedbackHistory(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    feedback: simulationFeedback,
    simulation: simulations,
  })
    .from(simulationFeedback)
    .innerJoin(simulations, eq(simulationFeedback.simulationId, simulations.id))
    .orderBy(desc(simulationFeedback.createdAt))
    .limit(limit);
}


// ============================================
// HR Integration: reportStaff + staff unified view
// ============================================

/**
 * Get all report staff with their linked staff data for HR unified view
 */
export async function getAllReportStaffWithLinkedStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      reportStaff: reportStaff,
      linkedStaff: staff,
    })
    .from(reportStaff)
    .leftJoin(staff, eq(reportStaff.linkedStaffId, staff.id))
    .orderBy(reportStaff.name);
}

/**
 * Auto-link reportStaff to staff by matching names
 * Returns the number of newly linked records
 */
export async function autoLinkReportStaffToStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all unlinked reportStaff
  const unlinkedReportStaff = await db.select().from(reportStaff)
    .where(sql`${reportStaff.linkedStaffId} IS NULL`);

  // Get all staff
  const allStaff = await db.select().from(staff);

  let linkedCount = 0;

  for (const rs of unlinkedReportStaff) {
    // Try to find matching staff by name (case-insensitive, trimmed)
    const rsNameLower = rs.name.trim().toLowerCase();
    const matchingStaff = allStaff.find(s => 
      s.name.trim().toLowerCase() === rsNameLower ||
      (s.nameEn && s.nameEn.trim().toLowerCase() === rsNameLower)
    );

    if (matchingStaff) {
      await db.update(reportStaff)
        .set({ linkedStaffId: matchingStaff.id })
        .where(eq(reportStaff.id, rs.id));
      linkedCount++;
    }
  }

  return linkedCount;
}

/**
 * Create a staff record from reportStaff data and link them
 */
export async function createStaffFromReportStaff(reportStaffId: number, additionalData?: Partial<InsertStaff>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the reportStaff record
  const rs = await db.select().from(reportStaff).where(eq(reportStaff.id, reportStaffId)).limit(1);
  if (rs.length === 0) throw new Error("Report staff not found");

  const reportStaffRecord = rs[0];

  // Create staff record
  const staffData: InsertStaff = {
    name: reportStaffRecord.name,
    email: additionalData?.email || `${reportStaffRecord.name.toLowerCase().replace(/\s+/g, '.')}@lcj.placeholder`,
    country: reportStaffRecord.country,
    ...additionalData,
  };

  const result = await db.insert(staff).values(staffData);
  const insertedId = result[0].insertId;

  // Link reportStaff to the new staff record
  await db.update(reportStaff)
    .set({ linkedStaffId: insertedId })
    .where(eq(reportStaff.id, reportStaffId));

  return insertedId;
}

/**
 * Get report count for a reportStaff member
 */
export async function getReportCountByReportStaffId(reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select({ count: sql<number>`count(*)` })
    .from(reports)
    .where(eq(reports.reportStaffId, reportStaffId));

  return result[0]?.count || 0;
}


// ========================================
// セット分析関連関数
// Set Analysis Functions
// ========================================

/**
 * Get set analysis summary for all livers (for ライバー司令塔一覧)
 */
export async function getAllLiversSetAnalysis() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      liverId: brandLivestreams.liverId,
      streamerName: brandLivestreams.streamerName,
      totalSets: sql<number>`COUNT(DISTINCT ${livestreamSets.id})`,
      totalSetRevenue: sql<number>`COALESCE(SUM(${livestreamSets.totalRevenue}), 0)`,
      totalQuantitySold: sql<number>`COALESCE(SUM(${livestreamSets.quantitySold}), 0)`,
      avgDiscountRate: sql<number>`COALESCE(AVG(${livestreamSets.discountRate}), 0)`,
      livestreamsWithSets: sql<number>`COUNT(DISTINCT ${brandLivestreams.id})`,
    })
    .from(livestreamSets)
    .innerJoin(brandLivestreams, eq(livestreamSets.livestreamId, brandLivestreams.id))
    .groupBy(brandLivestreams.liverId, brandLivestreams.streamerName)
    .orderBy(desc(sql`COALESCE(SUM(${livestreamSets.totalRevenue}), 0)`));
  
  return result;
}

/**
 * Get detailed set analysis for a specific liver (for ライバー個別ページ)
 */
export async function getLiverSetAnalysis(liverId: number) {
  const db = await getDb();
  if (!db) return { summary: null, sets: [], topProducts: [] };
  
  const sets = await db
    .select({
      id: livestreamSets.id,
      livestreamId: livestreamSets.livestreamId,
      setName: livestreamSets.setName,
      setPrice: livestreamSets.setPrice,
      quantitySold: livestreamSets.quantitySold,
      totalOriginalPrice: livestreamSets.totalOriginalPrice,
      discountRate: livestreamSets.discountRate,
      totalRevenue: livestreamSets.totalRevenue,
      livestreamDate: brandLivestreams.livestreamDate,
      streamerName: brandLivestreams.streamerName,
    })
    .from(livestreamSets)
    .innerJoin(brandLivestreams, eq(livestreamSets.livestreamId, brandLivestreams.id))
    .where(eq(brandLivestreams.liverId, liverId))
    .orderBy(desc(livestreamSets.totalRevenue));
  
  const setsWithItems = await Promise.all(sets.map(async (set) => {
    const items = await db!.select().from(livestreamSetItems)
      .where(eq(livestreamSetItems.setId, set.id))
      .orderBy(asc(livestreamSetItems.sortOrder));
    return { ...set, items };
  }));
  
  const totalSets = sets.length;
  const totalSetRevenue = sets.reduce((sum, s) => sum + (s.totalRevenue || 0), 0);
  const totalQuantitySold = sets.reduce((sum, s) => sum + (s.quantitySold || 0), 0);
  const avgDiscountRate = totalSets > 0
    ? Math.round(sets.reduce((sum, s) => sum + (s.discountRate || 0), 0) / totalSets)
    : 0;
  const avgQuantityPerSet = totalSets > 0
    ? Math.round((totalQuantitySold / totalSets) * 10) / 10
    : 0;
  
  const bestSet = sets.length > 0 ? sets[0] : null;
  const mostPopular = sets.length > 0
    ? sets.reduce((best, s) => (s.quantitySold || 0) > (best.quantitySold || 0) ? s : best, sets[0])
    : null;
  
  const productFrequency: Record<string, { count: number; totalRevenue: number }> = {};
  for (const set of setsWithItems) {
    for (const item of set.items) {
      if (!productFrequency[item.productName]) {
        productFrequency[item.productName] = { count: 0, totalRevenue: 0 };
      }
      productFrequency[item.productName].count += 1;
      productFrequency[item.productName].totalRevenue += (set.totalRevenue || 0);
    }
  }
  const topProducts = Object.entries(productFrequency)
    .map(([name, data]) => ({ productName: name, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    summary: {
      totalSets,
      totalSetRevenue,
      totalQuantitySold,
      avgDiscountRate,
      avgQuantityPerSet,
      bestSetId: bestSet?.id || null,
      mostPopularSetId: mostPopular?.id || null,
    },
    sets: setsWithItems,
    topProducts,
  };
}


/**
 * Search sets by keyword (set name, product name, or streamer name)
 */
export async function searchSets(keyword: string) {
  const db = await getDb();
  if (!db) return [];
  
  const searchPattern = `%${keyword}%`;
  
  // Search sets by setName, streamerName, or item productName
  const sets = await db
    .select({
      id: livestreamSets.id,
      livestreamId: livestreamSets.livestreamId,
      setName: livestreamSets.setName,
      setPrice: livestreamSets.setPrice,
      quantitySold: livestreamSets.quantitySold,
      totalOriginalPrice: livestreamSets.totalOriginalPrice,
      discountRate: livestreamSets.discountRate,
      totalRevenue: livestreamSets.totalRevenue,
      livestreamDate: brandLivestreams.livestreamDate,
      streamerName: brandLivestreams.streamerName,
      liverId: brandLivestreams.liverId,
    })
    .from(livestreamSets)
    .innerJoin(brandLivestreams, eq(livestreamSets.livestreamId, brandLivestreams.id))
    .where(
      or(
        like(livestreamSets.setName, searchPattern),
        like(brandLivestreams.streamerName, searchPattern),
      )
    )
    .orderBy(desc(livestreamSets.totalRevenue))
    .limit(50);
  
  // Also search by item product name
  const setsByItem = await db
    .select({
      id: livestreamSets.id,
      livestreamId: livestreamSets.livestreamId,
      setName: livestreamSets.setName,
      setPrice: livestreamSets.setPrice,
      quantitySold: livestreamSets.quantitySold,
      totalOriginalPrice: livestreamSets.totalOriginalPrice,
      discountRate: livestreamSets.discountRate,
      totalRevenue: livestreamSets.totalRevenue,
      livestreamDate: brandLivestreams.livestreamDate,
      streamerName: brandLivestreams.streamerName,
      liverId: brandLivestreams.liverId,
    })
    .from(livestreamSetItems)
    .innerJoin(livestreamSets, eq(livestreamSetItems.setId, livestreamSets.id))
    .innerJoin(brandLivestreams, eq(livestreamSets.livestreamId, brandLivestreams.id))
    .where(like(livestreamSetItems.productName, searchPattern))
    .groupBy(
      livestreamSets.id, livestreamSets.livestreamId, livestreamSets.setName,
      livestreamSets.setPrice, livestreamSets.quantitySold, livestreamSets.totalOriginalPrice,
      livestreamSets.discountRate, livestreamSets.totalRevenue,
      brandLivestreams.livestreamDate, brandLivestreams.streamerName, brandLivestreams.liverId
    )
    .orderBy(desc(livestreamSets.totalRevenue))
    .limit(50);
  
  // Merge and deduplicate
  const allSets = [...sets];
  const existingIds = new Set(sets.map(s => s.id));
  for (const s of setsByItem) {
    if (!existingIds.has(s.id)) {
      allSets.push(s);
    }
  }
  
  // Fetch items for each set
  const setsWithItems = await Promise.all(allSets.map(async (set) => {
    const items = await db!.select().from(livestreamSetItems)
      .where(eq(livestreamSetItems.setId, set.id))
      .orderBy(asc(livestreamSetItems.sortOrder));
    return { ...set, items };
  }));
  
  // Sort by totalRevenue desc
  setsWithItems.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
  
  return setsWithItems.slice(0, 50);
}

// ============================================
// MALL Product Reviews
// ============================================

export async function getProductReviews(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const reviews = await db
    .select({
      review: mallProductReviews,
      user: {
        id: lineUsers.id,
        displayName: lineUsers.displayName,
        pictureUrl: lineUsers.pictureUrl,
      },
    })
    .from(mallProductReviews)
    .leftJoin(lineUsers, eq(mallProductReviews.lineUserId, lineUsers.id))
    .where(eq(mallProductReviews.productId, productId))
    .orderBy(desc(mallProductReviews.createdAt));

  return reviews;
}

export async function getProductReviewStats(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const stats = await db
    .select({
      avgRating: sql<number>`AVG(rating)`,
      totalReviews: sql<number>`COUNT(*)`,
      rating1: sql<number>`SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)`,
      rating2: sql<number>`SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)`,
      rating3: sql<number>`SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)`,
      rating4: sql<number>`SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)`,
      rating5: sql<number>`SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)`,
    })
    .from(mallProductReviews)
    .where(eq(mallProductReviews.productId, productId));

  return stats[0] || { avgRating: 0, totalReviews: 0, rating1: 0, rating2: 0, rating3: 0, rating4: 0, rating5: 0 };
}

export async function createProductReview(data: InsertMallProductReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inserted] = await db.insert(mallProductReviews).values(data).$returningId();
  return inserted;
}

export async function deleteProductReview(reviewId: number, lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(mallProductReviews).where(
    and(eq(mallProductReviews.id, reviewId), eq(mallProductReviews.lineUserId, lineUserId))
  );
}

export async function hasUserReviewedProduct(productId: number, lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(mallProductReviews)
    .where(and(eq(mallProductReviews.productId, productId), eq(mallProductReviews.lineUserId, lineUserId)));

  return (result[0]?.count || 0) > 0;
}

// ============================================
// MALL Related Products
// ============================================

export async function getRelatedProducts(productId: number, limit: number = 8) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get current product's category and brand
  const currentProduct = await db
    .select()
    .from(mallProducts)
    .where(eq(mallProducts.id, productId))
    .limit(1);

  if (!currentProduct[0]) return [];

  const product = currentProduct[0];
  const conditions: any[] = [
    not(eq(mallProducts.id, productId)),
    eq(mallProducts.status, "active"),
  ];

  // Same category or same brand
  if (product.categoryId && product.brandId) {
    conditions.push(or(
      eq(mallProducts.categoryId, product.categoryId),
      eq(mallProducts.brandId, product.brandId)
    ));
  } else if (product.categoryId) {
    conditions.push(eq(mallProducts.categoryId, product.categoryId));
  } else if (product.brandId) {
    conditions.push(eq(mallProducts.brandId, product.brandId));
  }

  const related = await db
    .select()
    .from(mallProducts)
    .where(and(...conditions))
    .orderBy(desc(mallProducts.createdAt))
    .limit(limit);

  // If not enough, fill with other active products
  if (related.length < limit) {
    const existingIds = [productId, ...related.map(p => p.id)];
    const more = await db
      .select()
      .from(mallProducts)
      .where(and(
        not(inArray(mallProducts.id, existingIds)),
        eq(mallProducts.status, "active")
      ))
      .orderBy(desc(mallProducts.createdAt))
      .limit(limit - related.length);
    related.push(...more);
  }

  return related;
}

// ============================================
// MALL Product Description Images
// ============================================

export async function getProductDescImages(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(mallProductDescImages)
    .where(eq(mallProductDescImages.productId, productId))
    .orderBy(asc(mallProductDescImages.sortOrder));
}

export async function addProductDescImage(data: InsertMallProductDescImage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inserted] = await db.insert(mallProductDescImages).values(data).$returningId();
  return inserted;
}

export async function deleteProductDescImage(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(mallProductDescImages).where(eq(mallProductDescImages.id, imageId));
}


// =====================================================
// Referral Code System (紹介コードシステム)
// =====================================================

/**
 * Generate a unique 4-digit referral code
 */
async function generateUniqueReferralCode(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let attempts = 0;
  while (attempts < 100) {
    // Generate random 4-digit number (1000-9999)
    const code = String(Math.floor(1000 + Math.random() * 9000));
    
    // Check if code already exists
    const existing = await db
      .select()
      .from(referralCodes)
      .where(eq(referralCodes.code, code))
      .limit(1);
    
    if (existing.length === 0) {
      return code;
    }
    attempts++;
  }
  throw new Error("Failed to generate unique referral code after 100 attempts");
}

/**
 * Get or create referral code for a liver
 */
export async function getOrCreateReferralCode(liverId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if liver already has a referral code
  const existing = await db
    .select()
    .from(referralCodes)
    .where(and(eq(referralCodes.liverId, liverId), eq(referralCodes.isActive, true)))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Generate new code
  const code = await generateUniqueReferralCode();
  const result = await db.insert(referralCodes).values({
    liverId,
    code,
  });
  
  const newCode = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.id, Number(result[0].insertId)))
    .limit(1);
  
  return newCode[0];
}

/**
 * Get referral code by code string
 */
export async function getReferralCodeByCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({
      referralCode: referralCodes,
      liverName: livers.name,
      liverAvatarUrl: livers.avatarUrl,
    })
    .from(referralCodes)
    .leftJoin(livers, eq(referralCodes.liverId, livers.id))
    .where(and(eq(referralCodes.code, code), eq(referralCodes.isActive, true)))
    .limit(1);
  
  if (result.length === 0) return null;
  return result[0];
}

/**
 * Apply referral code - award points to both new user and referrer
 */
export async function applyReferralCode(
  referralCodeId: number,
  referrerLiverId: number,
  referredLineUserId: number,
  newUserLineUserId: string, // LINE User ID string for point system
  referrerLineUserId: string | null, // Liver's LINE User ID (may be null)
  newUserPoints: number = 500,
  referrerPoints: number = 200
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if this user has already used a referral code
  const existingReferral = await db
    .select()
    .from(referralHistory)
    .where(eq(referralHistory.referredLineUserId, referredLineUserId))
    .limit(1);
  
  if (existingReferral.length > 0) {
    throw new Error("このユーザーは既に紹介コードを使用済みです");
  }
  
  // Create referral history record
  await db.insert(referralHistory).values({
    referralCodeId,
    referrerLiverId,
    referredLineUserId,
    newUserPoints,
    referrerPoints,
    newUserPointAwarded: true,
    referrerPointAwarded: !!referrerLineUserId,
  });
  
  // Award points to new user
  await createLinePointTransaction({
    lineUserId: newUserLineUserId,
    type: "earn",
    amount: newUserPoints,
    referenceType: "system",
    description: `紹介コード特典: ${newUserPoints}ポイント獲得`,
  });
  
  // Award points to referrer liver (if they have a LINE User ID)
  if (referrerLineUserId) {
    await createLinePointTransaction({
      lineUserId: referrerLineUserId,
      type: "earn",
      amount: referrerPoints,
      referenceType: "system",
      description: `紹介報酬: 新規ユーザー紹介で${referrerPoints}ポイント獲得`,
    });
  }
  
  // Update referral code stats
  await db
    .update(referralCodes)
    .set({
      totalReferrals: sql`${referralCodes.totalReferrals} + 1`,
      totalPointsEarned: sql`${referralCodes.totalPointsEarned} + ${referrerPoints}`,
    })
    .where(eq(referralCodes.id, referralCodeId));
  
  return { newUserPoints, referrerPoints };
}

/**
 * Get referral stats for a liver
 */
export async function getReferralStats(liverId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const code = await db
    .select()
    .from(referralCodes)
    .where(and(eq(referralCodes.liverId, liverId), eq(referralCodes.isActive, true)))
    .limit(1);
  
  if (code.length === 0) return null;
  
  // Get recent referral history
  const history = await db
    .select({
      id: referralHistory.id,
      referredLineUserId: referralHistory.referredLineUserId,
      referrerPoints: referralHistory.referrerPoints,
      createdAt: referralHistory.createdAt,
      userName: lineUsers.displayName,
      userPicture: lineUsers.pictureUrl,
    })
    .from(referralHistory)
    .leftJoin(lineUsers, eq(referralHistory.referredLineUserId, lineUsers.id))
    .where(eq(referralHistory.referrerLiverId, liverId))
    .orderBy(desc(referralHistory.createdAt))
    .limit(50);
  
  return {
    code: code[0],
    history,
  };
}

/**
 * Check if a line user has already used a referral code
 */
export async function hasUsedReferralCode(lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(referralHistory)
    .where(eq(referralHistory.referredLineUserId, lineUserId))
    .limit(1);
  
  return result.length > 0;
}

/**
 * Get all referral codes with liver info (admin view)
 */
export async function getAllReferralCodes() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db
    .select({
      id: referralCodes.id,
      code: referralCodes.code,
      liverId: referralCodes.liverId,
      liverName: livers.name,
      liverAvatarUrl: livers.avatarUrl,
      isActive: referralCodes.isActive,
      totalReferrals: referralCodes.totalReferrals,
      totalPointsEarned: referralCodes.totalPointsEarned,
      createdAt: referralCodes.createdAt,
    })
    .from(referralCodes)
    .leftJoin(livers, eq(referralCodes.liverId, livers.id))
    .orderBy(desc(referralCodes.totalReferrals));
}


/**
 * Register a pending referral at signup time (no points awarded yet)
 * Points will be awarded when the user makes their first purchase
 */
export async function registerPendingReferral(
  referralCodeId: number,
  referrerLiverId: number,
  referredLineUserId: number,
  newUserPoints: number = 500,
  referrerPoints: number = 200
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if this user has already used a referral code
  const existingReferral = await db
    .select()
    .from(referralHistory)
    .where(eq(referralHistory.referredLineUserId, referredLineUserId))
    .limit(1);
  
  if (existingReferral.length > 0) {
    throw new Error("このユーザーは既に紹介コードを使用済みです");
  }
  
  // Create referral history record - new user points awarded immediately, referrer points pending
  await db.insert(referralHistory).values({
    referralCodeId,
    referrerLiverId,
    referredLineUserId,
    status: "pending", // pending = waiting for first purchase to award referrer points
    newUserPoints,
    referrerPoints,
    newUserPointAwarded: true, // 500pt awarded immediately at registration
    referrerPointAwarded: false, // 200pt awarded on first purchase
  });
  
  return { success: true, status: "pending", newUserPoints };
}

/**
 * Confirm a pending referral and award points (called on first purchase)
 * Returns null if no pending referral exists for this user
 */
export async function confirmPendingReferral(
  lineUserId: string, // LINE User ID string (for point system)
  referredLineUserDbId: number // line_users.id
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Find pending referral for this user
  const pendingReferral = await db
    .select()
    .from(referralHistory)
    .where(
      and(
        eq(referralHistory.referredLineUserId, referredLineUserDbId),
        eq(referralHistory.status, "pending")
      )
    )
    .limit(1);
  
  if (pendingReferral.length === 0) {
    return null; // No pending referral, nothing to do
  }
  
  const referral = pendingReferral[0];
  
  // Get the referrer liver's LINE User ID for point system
  const referrerLiver = await db
    .select({ lineUserId: livers.lineUserId })
    .from(livers)
    .where(eq(livers.id, referral.referrerLiverId))
    .limit(1);
  
  const referrerLineUserId = referrerLiver[0]?.lineUserId || null;
  
  // Update referral status to confirmed
  await db
    .update(referralHistory)
    .set({
      status: "confirmed",
      confirmedAt: new Date(),
      newUserPointAwarded: true, // Already awarded at registration
      referrerPointAwarded: !!referrerLineUserId,
    })
    .where(eq(referralHistory.id, referral.id));
  
  // Note: 500pt for new user was already awarded at registration time
  // Only award 200pt to referrer liver on first purchase
  if (referrerLineUserId) {
    await createLinePointTransaction({
      lineUserId: referrerLineUserId,
      type: "earn",
      amount: referral.referrerPoints,
      referenceType: "system",
      description: `紹介報酬: 紹介ユーザーの初回購入で${referral.referrerPoints}ポイント獲得`,
    });
  }
  
  // Update referral code stats
  await db
    .update(referralCodes)
    .set({
      totalReferrals: sql`${referralCodes.totalReferrals} + 1`,
      totalPointsEarned: sql`${referralCodes.totalPointsEarned} + ${referral.referrerPoints}`,
    })
    .where(eq(referralCodes.id, referral.referralCodeId));
  
  // Send LINE notification to referrer liver (points confirmed)
  try {
    if (referrerLineUserId) {
      const { pushMessage } = await import("./line");
      const appUrl = process.env.APP_URL || "https://lcjmall.com";
      await pushMessage(referrerLineUserId, [{
        type: "text",
        text: `🌟 紹介ポイントが確定しました！\n\nあなたが紹介したユーザーが初回購入を完了しました。\n\n⭐ 獲得ポイント: ${referral.referrerPoints}ポイント\n\n引き続き紹介コードをシェアしてポイントを獲得しましょう！\n\n📊 紹介実績を確認\n${appUrl}/liver-mypage`
      }]);
    }
  } catch (notifyErr: any) {
    console.error(`[Referral] Failed to send confirmation LINE notification to liver:`, notifyErr.message);
  }
  
  return {
    newUserPoints: referral.newUserPoints,
    referrerPoints: referral.referrerPoints,
    referrerLineUserId,
  };
}

/**
 * Get pending referral for a user (to show status in UI)
 */
export async function getPendingReferral(referredLineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select({
      id: referralHistory.id,
      status: referralHistory.status,
      newUserPoints: referralHistory.newUserPoints,
      referrerPoints: referralHistory.referrerPoints,
      liverName: livers.name,
      createdAt: referralHistory.createdAt,
      confirmedAt: referralHistory.confirmedAt,
    })
    .from(referralHistory)
    .leftJoin(livers, eq(referralHistory.referrerLiverId, livers.id))
    .where(eq(referralHistory.referredLineUserId, referredLineUserId))
    .limit(1);
  
  return result[0] || null;
}


// ===== MALL お気に入り =====

export async function addMallFavorite(lineUserId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(mallFavorites).values({ lineUserId, productId }).onDuplicateKeyUpdate({ set: { lineUserId: sql`lineUserId` } });
  return { success: true };
}

export async function removeMallFavorite(lineUserId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mallFavorites).where(
    and(eq(mallFavorites.lineUserId, lineUserId), eq(mallFavorites.productId, productId))
  );
  return { success: true };
}

export async function getMallFavoritesByUser(lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const favorites = await db
    .select({
      id: mallFavorites.id,
      productId: mallFavorites.productId,
      createdAt: mallFavorites.createdAt,
      product: {
        id: mallProducts.id,
        name: mallProducts.name,
        price: mallProducts.price,
        pointPrice: mallProducts.pointPrice,
        imageUrl: mallProducts.imageUrl,
        imageUrls: mallProducts.imageUrls,
        status: mallProducts.status,
        stock: mallProducts.stock,
      },
    })
    .from(mallFavorites)
    .innerJoin(mallProducts, eq(mallFavorites.productId, mallProducts.id))
    .where(eq(mallFavorites.lineUserId, lineUserId))
    .orderBy(desc(mallFavorites.createdAt));
  return favorites;
}

export async function getMallFavoriteProductIds(lineUserId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ productId: mallFavorites.productId })
    .from(mallFavorites)
    .where(eq(mallFavorites.lineUserId, lineUserId));
  return rows.map((r) => r.productId);
}

export async function isMallFavorite(lineUserId: number, productId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ id: mallFavorites.id })
    .from(mallFavorites)
    .where(and(eq(mallFavorites.lineUserId, lineUserId), eq(mallFavorites.productId, productId)))
    .limit(1);
  return rows.length > 0;
}

export async function getMallFavoriteCounts(): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      productId: mallFavorites.productId,
      count: sql<number>`COUNT(*)`.as("count"),
    })
    .from(mallFavorites)
    .groupBy(mallFavorites.productId);
  const map: Record<number, number> = {};
  for (const r of rows) {
    map[r.productId] = Number(r.count);
  }
  return map;
}

// ============================================
// LCJ MALL - 閲覧履歴
// ============================================

export async function recordMallViewHistory(lineUserId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 同じ商品の古い閲覧履歴を削除して最新のみ保持
  await db.delete(mallViewHistory).where(
    and(eq(mallViewHistory.lineUserId, lineUserId), eq(mallViewHistory.productId, productId))
  );
  await db.insert(mallViewHistory).values({ lineUserId, productId });
  return { success: true };
}

export async function getMallViewHistoryByUser(lineUserId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const history = await db
    .select({
      id: mallViewHistory.id,
      productId: mallViewHistory.productId,
      viewedAt: mallViewHistory.viewedAt,
      product: {
        id: mallProducts.id,
        name: mallProducts.name,
        price: mallProducts.price,
        pointPrice: mallProducts.pointPrice,
        imageUrl: mallProducts.imageUrl,
        status: mallProducts.status,
        stock: mallProducts.stock,
        category: mallProducts.category,
      },
    })
    .from(mallViewHistory)
    .innerJoin(mallProducts, eq(mallViewHistory.productId, mallProducts.id))
    .where(eq(mallViewHistory.lineUserId, lineUserId))
    .orderBy(desc(mallViewHistory.viewedAt))
    .limit(limit);
  return history;
}

// ============================================
// MALL Product Reviews - 全商品レビュー統計（一覧表示用）
// ============================================
export async function getAllProductReviewStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const stats = await db
    .select({
      productId: mallProductReviews.productId,
      avgRating: sql<number>`AVG(rating)`,
      totalReviews: sql<number>`COUNT(*)`,
    })
    .from(mallProductReviews)
    .groupBy(mallProductReviews.productId);

  const result: Record<number, { avgRating: number; totalReviews: number }> = {};
  for (const s of stats) {
    result[s.productId] = {
      avgRating: Number(s.avgRating) || 0,
      totalReviews: Number(s.totalReviews) || 0,
    };
  }
  return result;
}


// ===== LCJ MALL ダッシュボード統計 =====

export async function getMallDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // 総売上（キャンセル・返金以外）
  const [totalSalesResult] = await db.select({
    total: sql<number>`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(mallOrders).where(
    and(
      notInArray(mallOrders.status, ["cancelled", "refunded", "pending"])
    )
  );

  // 今月の売上
  const [thisMonthSales] = await db.select({
    total: sql<number>`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(mallOrders).where(
    and(
      notInArray(mallOrders.status, ["cancelled", "refunded", "pending"]),
      gte(mallOrders.createdAt, thisMonthStart)
    )
  );

  // 先月の売上
  const [lastMonthSales] = await db.select({
    total: sql<number>`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(mallOrders).where(
    and(
      notInArray(mallOrders.status, ["cancelled", "refunded", "pending"]),
      gte(mallOrders.createdAt, lastMonthStart),
      lte(mallOrders.createdAt, lastMonthEnd)
    )
  );

  // 今日の売上
  const [todaySales] = await db.select({
    total: sql<number>`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(mallOrders).where(
    and(
      notInArray(mallOrders.status, ["cancelled", "refunded", "pending"]),
      gte(mallOrders.createdAt, todayStart)
    )
  );

  // 総会員数
  const [totalMembers] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(lineUsers);

  // 今月の新規会員
  const [thisMonthMembers] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(lineUsers).where(
    gte(lineUsers.createdAt, thisMonthStart)
  );

  // 先月の新規会員
  const [lastMonthMembers] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(lineUsers).where(
    and(
      gte(lineUsers.createdAt, lastMonthStart),
      lte(lineUsers.createdAt, lastMonthEnd)
    )
  );

  // 注文ステータス別の件数
  const orderStatusCounts = await db.select({
    status: mallOrders.status,
    count: sql<number>`COUNT(*)`,
  }).from(mallOrders).groupBy(mallOrders.status);

  // 決済方法別の売上
  const paymentMethodSales = await db.select({
    paymentMethod: mallOrders.paymentMethod,
    total: sql<number>`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(mallOrders).where(
    notInArray(mallOrders.status, ["cancelled", "refunded", "pending"])
  ).groupBy(mallOrders.paymentMethod);

  // 商品数
  const [productCount] = await db.select({
    total: sql<number>`COUNT(*)`,
    active: sql<number>`SUM(CASE WHEN ${mallProducts.status} = 'active' THEN 1 ELSE 0 END)`,
  }).from(mallProducts);

  return {
    sales: {
      total: Number(totalSalesResult.total),
      totalOrders: Number(totalSalesResult.count),
      thisMonth: Number(thisMonthSales.total),
      thisMonthOrders: Number(thisMonthSales.count),
      lastMonth: Number(lastMonthSales.total),
      lastMonthOrders: Number(lastMonthSales.count),
      today: Number(todaySales.total),
      todayOrders: Number(todaySales.count),
    },
    members: {
      total: Number(totalMembers.count),
      thisMonth: Number(thisMonthMembers.count),
      lastMonth: Number(lastMonthMembers.count),
    },
    orderStatus: orderStatusCounts.map(s => ({
      status: s.status,
      count: Number(s.count),
    })),
    paymentMethods: paymentMethodSales.map(p => ({
      method: p.paymentMethod,
      total: Number(p.total),
      count: Number(p.count),
    })),
    products: {
      total: Number(productCount.total),
      active: Number(productCount.active),
    },
  };
}

export async function getMallSalesChart(period: "daily" | "monthly", months: number = 6) {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

  if (period === "daily") {
    // 直近30日の日別売上
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const result = await db.select({
      date: sql<string>`DATE(${mallOrders.createdAt})`,
      total: sql<number>`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(mallOrders).where(
      and(
        notInArray(mallOrders.status, ["cancelled", "refunded", "pending"]),
        gte(mallOrders.createdAt, thirtyDaysAgo)
      )
    ).groupBy(sql`DATE(${mallOrders.createdAt})`).orderBy(sql`DATE(${mallOrders.createdAt})`);

    return result.map(r => ({
      date: r.date,
      total: Number(r.total),
      count: Number(r.count),
    }));
  } else {
    // 月別売上
    const result = await db.select({
      date: sql<string>`DATE_FORMAT(${mallOrders.createdAt}, '%Y-%m')`,
      total: sql<number>`COALESCE(SUM(${mallOrders.totalAmount}), 0)`,
      count: sql<number>`COUNT(*)`,
    }).from(mallOrders).where(
      and(
        notInArray(mallOrders.status, ["cancelled", "refunded", "pending"]),
        gte(mallOrders.createdAt, startDate)
      )
    ).groupBy(sql`DATE_FORMAT(${mallOrders.createdAt}, '%Y-%m')`).orderBy(sql`DATE_FORMAT(${mallOrders.createdAt}, '%Y-%m')`);

    return result.map(r => ({
      date: r.date,
      total: Number(r.total),
      count: Number(r.count),
    }));
  }
}

export async function getMallMemberGrowthChart(months: number = 6) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date(new Date().getFullYear(), new Date().getMonth() - months, 1);

  const result = await db.select({
    date: sql<string>`DATE_FORMAT(${lineUsers.createdAt}, '%Y-%m')`,
    count: sql<number>`COUNT(*)`,
  }).from(lineUsers).where(
    gte(lineUsers.createdAt, startDate)
  ).groupBy(sql`DATE_FORMAT(${lineUsers.createdAt}, '%Y-%m')`).orderBy(sql`DATE_FORMAT(${lineUsers.createdAt}, '%Y-%m')`);

  return result.map(r => ({
    date: r.date,
    count: Number(r.count),
  }));
}


// =====================================================
// Receipt Review Logs - 学習データ蓄積・集計
// =====================================================

/**
 * Create a receipt review log entry (called automatically on approve/reject/hold)
 */
export async function createReceiptReviewLog(data: InsertReceiptReviewLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(receiptReviewLogs).values(data);
}

/**
 * Get review logs with pagination
 */
export async function getReceiptReviewLogs(limit: number = 50, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(receiptReviewLogs)
    .orderBy(desc(receiptReviewLogs.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * AI Learning Dashboard: Approval/Rejection rate over time (weekly)
 */
export async function getReviewDecisionTrend(months: number = 3) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  const result = await db.select({
    week: sql<string>`DATE_FORMAT(${receiptReviewLogs.createdAt}, '%Y-%u')`,
    weekStart: sql<string>`DATE(DATE_SUB(${receiptReviewLogs.createdAt}, INTERVAL WEEKDAY(${receiptReviewLogs.createdAt}) DAY))`,
    total: sql<number>`COUNT(*)`,
    approved: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'approved' THEN 1 ELSE 0 END)`,
    rejected: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'rejected' THEN 1 ELSE 0 END)`,
    onHold: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'on_hold' THEN 1 ELSE 0 END)`,
  })
    .from(receiptReviewLogs)
    .where(gte(receiptReviewLogs.createdAt, startDate))
    .groupBy(
      sql`DATE_FORMAT(${receiptReviewLogs.createdAt}, '%Y-%u')`,
      sql`DATE(DATE_SUB(${receiptReviewLogs.createdAt}, INTERVAL WEEKDAY(${receiptReviewLogs.createdAt}) DAY))`
    )
    .orderBy(sql`DATE_FORMAT(${receiptReviewLogs.createdAt}, '%Y-%u')`);
  
  return result.map(r => ({
    week: r.week,
    weekStart: r.weekStart,
    total: Number(r.total),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    onHold: Number(r.onHold),
    approvalRate: Number(r.total) > 0 ? Math.round((Number(r.approved) / Number(r.total)) * 100) : 0,
  }));
}

/**
 * AI Learning Dashboard: Rejection reason distribution
 */
export async function getRejectionCategoryDistribution() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db.select({
    category: receiptReviewLogs.rejectionCategory,
    count: sql<number>`COUNT(*)`,
  })
    .from(receiptReviewLogs)
    .where(eq(receiptReviewLogs.decision, "rejected"))
    .groupBy(receiptReviewLogs.rejectionCategory)
    .orderBy(desc(sql`COUNT(*)`));
  
  return result.map(r => ({
    category: r.category || "unknown",
    count: Number(r.count),
  }));
}

/**
 * AI Learning Dashboard: OCR confidence vs approval rate correlation
 */
export async function getOcrConfidenceCorrelation() {
  const db = await getDb();
  if (!db) return [];
  
  // Group by OCR confidence ranges (0-10, 10-20, ..., 90-100)
  const result = await db.select({
    confidenceRange: sql<string>`CONCAT(FLOOR(CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) / 10) * 10, '-', FLOOR(CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) / 10) * 10 + 10)`,
    confidenceMin: sql<number>`FLOOR(CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) / 10) * 10`,
    total: sql<number>`COUNT(*)`,
    approved: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'approved' THEN 1 ELSE 0 END)`,
    rejected: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'rejected' THEN 1 ELSE 0 END)`,
  })
    .from(receiptReviewLogs)
    .where(isNotNull(receiptReviewLogs.ocrConfidence))
    .groupBy(
      sql`FLOOR(CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) / 10) * 10`
    )
    .orderBy(sql`FLOOR(CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) / 10) * 10`);
  
  return result.map(r => ({
    range: r.confidenceRange,
    confidenceMin: Number(r.confidenceMin),
    total: Number(r.total),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    approvalRate: Number(r.total) > 0 ? Math.round((Number(r.approved) / Number(r.total)) * 100) : 0,
  }));
}

/**
 * AI Learning Dashboard: Auto-approval eligibility estimation
 * Calculates what percentage of receipts could be auto-approved
 * based on configurable thresholds
 */
export async function getAutoApprovalEstimation(
  minConfidence: number = 80,
  maxFraudScore: number = 0,
  maxAmount: number = 10000
) {
  const db = await getDb();
  if (!db) return { eligible: 0, total: 0, percentage: 0, correctRate: 0 };
  
  // Total reviewed receipts
  const [totalResult] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(receiptReviewLogs);
  
  const total = Number(totalResult.count);
  if (total === 0) return { eligible: 0, total: 0, percentage: 0, correctRate: 0 };
  
  // Receipts that would qualify for auto-approval
  const [eligibleResult] = await db.select({
    count: sql<number>`COUNT(*)`,
  })
    .from(receiptReviewLogs)
    .where(
      and(
        gte(receiptReviewLogs.ocrConfidence, String(minConfidence)),
        lte(receiptReviewLogs.fraudScore, String(maxFraudScore)),
        eq(receiptReviewLogs.hasOrderNumber, "yes"),
        lte(receiptReviewLogs.totalAmount, maxAmount)
      )
    );
  
  const eligible = Number(eligibleResult.count);
  
  // Of those eligible, how many were actually approved by admin?
  const [correctResult] = await db.select({
    count: sql<number>`COUNT(*)`,
  })
    .from(receiptReviewLogs)
    .where(
      and(
        gte(receiptReviewLogs.ocrConfidence, String(minConfidence)),
        lte(receiptReviewLogs.fraudScore, String(maxFraudScore)),
        eq(receiptReviewLogs.hasOrderNumber, "yes"),
        lte(receiptReviewLogs.totalAmount, maxAmount),
        eq(receiptReviewLogs.decision, "approved")
      )
    );
  
  const correct = Number(correctResult.count);
  
  return {
    eligible,
    total,
    percentage: total > 0 ? Math.round((eligible / total) * 100) : 0,
    correctRate: eligible > 0 ? Math.round((correct / eligible) * 100) : 0,
  };
}

/**
 * AI Learning Dashboard: Summary statistics
 */
export async function getReviewLogsSummary() {
  const db = await getDb();
  if (!db) return null;
  
  const [stats] = await db.select({
    total: sql<number>`COUNT(*)`,
    approved: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'approved' THEN 1 ELSE 0 END)`,
    rejected: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'rejected' THEN 1 ELSE 0 END)`,
    onHold: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'on_hold' THEN 1 ELSE 0 END)`,
    avgOcrConfidence: sql<number>`AVG(CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)))`,
    avgFraudScore: sql<number>`AVG(CAST(${receiptReviewLogs.fraudScore} AS DECIMAL(5,2)))`,
    avgAmount: sql<number>`AVG(${receiptReviewLogs.totalAmount})`,
    lineReceiptCount: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.receiptType} = 'line_receipt' THEN 1 ELSE 0 END)`,
    webReceiptCount: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.receiptType} = 'web_receipt' THEN 1 ELSE 0 END)`,
    pointRequestCount: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.receiptType} = 'point_request' THEN 1 ELSE 0 END)`,
  }).from(receiptReviewLogs);
  
  return {
    total: Number(stats.total),
    approved: Number(stats.approved),
    rejected: Number(stats.rejected),
    onHold: Number(stats.onHold),
    approvalRate: Number(stats.total) > 0 ? Math.round((Number(stats.approved) / Number(stats.total)) * 100) : 0,
    avgOcrConfidence: Math.round(Number(stats.avgOcrConfidence) || 0),
    avgFraudScore: Math.round((Number(stats.avgFraudScore) || 0) * 100) / 100,
    avgAmount: Math.round(Number(stats.avgAmount) || 0),
    byType: {
      lineReceipt: Number(stats.lineReceiptCount),
      webReceipt: Number(stats.webReceiptCount),
      pointRequest: Number(stats.pointRequestCount),
    },
  };
}

// === AI Learning Dashboard: Daily trend ===
export async function getReviewLogsDailyTrend(days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const rows = await db.select({
    date: sql<string>`DATE(${receiptReviewLogs.createdAt})`,
    total: sql<number>`COUNT(*)`,
    approved: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'approved' THEN 1 ELSE 0 END)`,
    rejected: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'rejected' THEN 1 ELSE 0 END)`,
    onHold: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'on_hold' THEN 1 ELSE 0 END)`,
  })
  .from(receiptReviewLogs)
  .where(sql`${receiptReviewLogs.createdAt} >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`)
  .groupBy(sql`DATE(${receiptReviewLogs.createdAt})`)
  .orderBy(sql`DATE(${receiptReviewLogs.createdAt})`);
  
  return rows.map(r => ({
    date: String(r.date),
    total: Number(r.total),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    onHold: Number(r.onHold),
    approvalRate: Number(r.total) > 0 ? Math.round((Number(r.approved) / Number(r.total)) * 100) : 0,
  }));
}

// === AI Learning Dashboard: Rejection category distribution ===
export async function getReviewLogsRejectionDistribution() {
  const db = await getDb();
  if (!db) return [];
  
  const rows = await db.select({
    category: receiptReviewLogs.rejectionCategory,
    count: sql<number>`COUNT(*)`,
  })
  .from(receiptReviewLogs)
  .where(eq(receiptReviewLogs.decision, "rejected"))
  .groupBy(receiptReviewLogs.rejectionCategory)
  .orderBy(sql`COUNT(*) DESC`);
  
  return rows.map(r => ({
    category: r.category || "other",
    count: Number(r.count),
  }));
}

// === AI Learning Dashboard: OCR confidence vs approval rate ===
export async function getReviewLogsOcrCorrelation() {
  const db = await getDb();
  if (!db) return [];
  
  // Group by OCR confidence ranges: 0-20, 20-40, 40-60, 60-80, 80-100
  const rows = await db.select({
    confidenceRange: sql<string>`CASE 
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 20 THEN '0-20'
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 40 THEN '20-40'
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 60 THEN '40-60'
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 80 THEN '60-80'
      ELSE '80-100'
    END`,
    total: sql<number>`COUNT(*)`,
    approved: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'approved' THEN 1 ELSE 0 END)`,
    rejected: sql<number>`SUM(CASE WHEN ${receiptReviewLogs.decision} = 'rejected' THEN 1 ELSE 0 END)`,
  })
  .from(receiptReviewLogs)
  .where(sql`${receiptReviewLogs.ocrConfidence} IS NOT NULL`)
  .groupBy(sql`CASE 
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 20 THEN '0-20'
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 40 THEN '20-40'
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 60 THEN '40-60'
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 80 THEN '60-80'
      ELSE '80-100'
    END`)
  .orderBy(sql`CASE 
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 20 THEN 1
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 40 THEN 2
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 60 THEN 3
      WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) < 80 THEN 4
      ELSE 5
    END`);
  
  return rows.map(r => ({
    confidenceRange: String(r.confidenceRange),
    total: Number(r.total),
    approved: Number(r.approved),
    rejected: Number(r.rejected),
    approvalRate: Number(r.total) > 0 ? Math.round((Number(r.approved) / Number(r.total)) * 100) : 0,
  }));
}

// === AI Learning Dashboard: Auto-approval simulation ===
export async function getAutoApprovalSimulation() {
  const db = await getDb();
  if (!db) return null;
  
  // Simulate: what if we auto-approved receipts with high confidence + no fraud flags?
  const thresholds = [60, 70, 80, 90];
  const results = [];
  
  for (const threshold of thresholds) {
    const [row] = await db.select({
      totalEligible: sql<number>`SUM(CASE 
        WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) >= ${threshold}
        AND (${receiptReviewLogs.fraudFlagCount} = 0 OR ${receiptReviewLogs.fraudFlagCount} IS NULL)
        AND ${receiptReviewLogs.hasOrderNumber} = 'yes'
        THEN 1 ELSE 0 END)`,
      wouldBeCorrect: sql<number>`SUM(CASE 
        WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) >= ${threshold}
        AND (${receiptReviewLogs.fraudFlagCount} = 0 OR ${receiptReviewLogs.fraudFlagCount} IS NULL)
        AND ${receiptReviewLogs.hasOrderNumber} = 'yes'
        AND ${receiptReviewLogs.decision} = 'approved'
        THEN 1 ELSE 0 END)`,
      wouldBeWrong: sql<number>`SUM(CASE 
        WHEN CAST(${receiptReviewLogs.ocrConfidence} AS DECIMAL(5,2)) >= ${threshold}
        AND (${receiptReviewLogs.fraudFlagCount} = 0 OR ${receiptReviewLogs.fraudFlagCount} IS NULL)
        AND ${receiptReviewLogs.hasOrderNumber} = 'yes'
        AND ${receiptReviewLogs.decision} != 'approved'
        THEN 1 ELSE 0 END)`,
      total: sql<number>`COUNT(*)`,
    }).from(receiptReviewLogs);
    
    const eligible = Number(row.totalEligible) || 0;
    const correct = Number(row.wouldBeCorrect) || 0;
    const wrong = Number(row.wouldBeWrong) || 0;
    const total = Number(row.total) || 0;
    
    results.push({
      confidenceThreshold: threshold,
      eligibleCount: eligible,
      correctCount: correct,
      wrongCount: wrong,
      totalCount: total,
      coverageRate: total > 0 ? Math.round((eligible / total) * 100) : 0,
      accuracy: eligible > 0 ? Math.round((correct / eligible) * 100) : 0,
    });
  }
  
  return results;
}


// ===== Aitherhub Sync Logs =====

/**
 * Aitherhub同期ログを記録する
 */
export async function createAitherhubSyncLog(data: InsertAitherhubSyncLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aitherhubSyncLogs).values(data);
  return { id: Number(result[0].insertId) };
}

/**
 * Aitherhub同期ログを取得する（最新順、ページネーション対応）
 */
export async function getAitherhubSyncLogs(options: {
  limit?: number;
  offset?: number;
  status?: "success" | "error" | "partial";
  liverId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions = [];
  if (options.status) {
    conditions.push(eq(aitherhubSyncLogs.status, options.status));
  }
  if (options.liverId) {
    conditions.push(eq(aitherhubSyncLogs.liverId, options.liverId));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [logs, countResult] = await Promise.all([
    db.select()
      .from(aitherhubSyncLogs)
      .where(whereClause)
      .orderBy(desc(aitherhubSyncLogs.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db.select({ count: sql<number>`COUNT(*)` })
      .from(aitherhubSyncLogs)
      .where(whereClause),
  ]);
  
  return {
    logs,
    total: Number(countResult[0]?.count || 0),
  };
}

/**
 * Aitherhub同期ログの統計を取得する
 */
export async function getAitherhubSyncStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({
    totalLogs: sql<number>`COUNT(*)`,
    successCount: sql<number>`SUM(CASE WHEN syncStatus = 'success' THEN 1 ELSE 0 END)`,
    errorCount: sql<number>`SUM(CASE WHEN syncStatus = 'error' THEN 1 ELSE 0 END)`,
    partialCount: sql<number>`SUM(CASE WHEN syncStatus = 'partial' THEN 1 ELSE 0 END)`,
    lastSyncAt: sql<Date>`MAX(createdAt)`,
  }).from(aitherhubSyncLogs);
  
  return {
    totalLogs: Number(result[0]?.totalLogs || 0),
    successCount: Number(result[0]?.successCount || 0),
    errorCount: Number(result[0]?.errorCount || 0),
    partialCount: Number(result[0]?.partialCount || 0),
    lastSyncAt: result[0]?.lastSyncAt || null,
  };
}


/**
 * ライバーがAitherhubと連携済みかどうかを判定する
 * aitherhub_sync_logsに成功ログが1件以上あれば連携済みとみなす
 */
export async function isLiverAitherhubLinked(liverId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(aitherhubSyncLogs)
    .where(and(
      eq(aitherhubSyncLogs.liverId, liverId),
      eq(aitherhubSyncLogs.status, "success"),
    ))
    .limit(1);
  
  return Number(result[0]?.count || 0) > 0;
}


// ============================================================
// Receipt Analytics Functions
// ============================================================

/**
 * Get receipt analytics overview combining line_receipts and tiktok_commission_orders
 */
export async function getReceiptAnalyticsOverview() {
  const db = await getDb();
  if (!db) return null;

  // LINE receipts summary
  const lineStats = await db.select({
    totalCount: sql<number>`COUNT(*)`,
    approvedCount: sql<number>`SUM(CASE WHEN ${lineReceipts.status} = 'approved' THEN 1 ELSE 0 END)`,
    pendingCount: sql<number>`SUM(CASE WHEN ${lineReceipts.status} = 'pending' THEN 1 ELSE 0 END)`,
    rejectedCount: sql<number>`SUM(CASE WHEN ${lineReceipts.status} = 'rejected' THEN 1 ELSE 0 END)`,
    totalAmount: sql<number>`COALESCE(SUM(CASE WHEN ${lineReceipts.status} = 'approved' THEN ${lineReceipts.totalAmount} ELSE 0 END), 0)`,
    uniqueUsers: sql<number>`COUNT(DISTINCT ${lineReceipts.lineUserId})`,
    withStoreName: sql<number>`SUM(CASE WHEN ${lineReceipts.storeName} IS NOT NULL AND ${lineReceipts.storeName} != '' THEN 1 ELSE 0 END)`,
  }).from(lineReceipts);

  // TikTok orders summary
  const tiktokStats = await db.select({
    totalCount: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${tiktokCommissionOrders.price}), 0)`,
    uniqueCreators: sql<number>`COUNT(DISTINCT ${tiktokCommissionOrders.creatorUsername})`,
    uniqueShops: sql<number>`COUNT(DISTINCT ${tiktokCommissionOrders.shopName})`,
    uniqueProducts: sql<number>`COUNT(DISTINCT ${tiktokCommissionOrders.productName})`,
  }).from(tiktokCommissionOrders);

  return {
    lineReceipts: {
      totalCount: Number(lineStats[0]?.totalCount || 0),
      approvedCount: Number(lineStats[0]?.approvedCount || 0),
      pendingCount: Number(lineStats[0]?.pendingCount || 0),
      rejectedCount: Number(lineStats[0]?.rejectedCount || 0),
      totalApprovedAmount: Number(lineStats[0]?.totalAmount || 0),
      uniqueUsers: Number(lineStats[0]?.uniqueUsers || 0),
      withStoreName: Number(lineStats[0]?.withStoreName || 0),
    },
    tiktokOrders: {
      totalCount: Number(tiktokStats[0]?.totalCount || 0),
      totalAmount: Number(tiktokStats[0]?.totalAmount || 0),
      uniqueCreators: Number(tiktokStats[0]?.uniqueCreators || 0),
      uniqueShops: Number(tiktokStats[0]?.uniqueShops || 0),
      uniqueProducts: Number(tiktokStats[0]?.uniqueProducts || 0),
    },
  };
}

/**
 * Get shop ranking from both line_receipts and tiktok_commission_orders
 */
export async function getShopRanking(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  // LINE receipts by store
  const lineShops = await db.select({
    shopName: lineReceipts.storeName,
    orderCount: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${lineReceipts.totalAmount}), 0)`,
    source: sql<string>`'line'`,
  })
    .from(lineReceipts)
    .where(and(
      sql`${lineReceipts.storeName} IS NOT NULL`,
      sql`${lineReceipts.storeName} != ''`,
    ))
    .groupBy(lineReceipts.storeName)
    .orderBy(sql`COALESCE(SUM(${lineReceipts.totalAmount}), 0) DESC`);

  // TikTok orders by shop
  const tiktokShops = await db.select({
    shopName: tiktokCommissionOrders.shopName,
    orderCount: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${tiktokCommissionOrders.price}), 0)`,
    source: sql<string>`'tiktok'`,
  })
    .from(tiktokCommissionOrders)
    .where(sql`${tiktokCommissionOrders.shopName} IS NOT NULL`)
    .groupBy(tiktokCommissionOrders.shopName)
    .orderBy(sql`COALESCE(SUM(${tiktokCommissionOrders.price}), 0) DESC`);

  // Merge shops from both sources
  const shopMap = new Map<string, { shopName: string; orderCount: number; totalAmount: number; lineCount: number; tiktokCount: number }>();
  
  for (const shop of lineShops) {
    const name = shop.shopName || "不明";
    const existing = shopMap.get(name) || { shopName: name, orderCount: 0, totalAmount: 0, lineCount: 0, tiktokCount: 0 };
    existing.orderCount += Number(shop.orderCount);
    existing.totalAmount += Number(shop.totalAmount);
    existing.lineCount += Number(shop.orderCount);
    shopMap.set(name, existing);
  }
  
  for (const shop of tiktokShops) {
    const name = shop.shopName || "不明";
    const existing = shopMap.get(name) || { shopName: name, orderCount: 0, totalAmount: 0, lineCount: 0, tiktokCount: 0 };
    existing.orderCount += Number(shop.orderCount);
    existing.totalAmount += Number(shop.totalAmount);
    existing.tiktokCount += Number(shop.orderCount);
    shopMap.set(name, existing);
  }

  return Array.from(shopMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, limit);
}

/**
 * Get product ranking from tiktok_commission_orders and line_receipts OCR data
 */
export async function getProductRanking(limit: number = 30) {
  const db = await getDb();
  if (!db) return [];

  // テストショップを除外
  const TEST_SHOP_NAMES = ['テストショップ', 'Test Shop', 'test shop'];
  const products = await db.select({
    productName: tiktokCommissionOrders.productName,
    orderCount: sql<number>`COUNT(*)`,
    totalQuantity: sql<number>`COALESCE(SUM(${tiktokCommissionOrders.quantity}), 0)`,
    totalAmount: sql<number>`COALESCE(SUM(${tiktokCommissionOrders.price}), 0)`,
    avgPrice: sql<number>`ROUND(AVG(${tiktokCommissionOrders.price}))`,
    shopName: sql<string>`MAX(${tiktokCommissionOrders.shopName})`,
  })
    .from(tiktokCommissionOrders)
    .where(notInArray(tiktokCommissionOrders.shopName, TEST_SHOP_NAMES))
    .groupBy(tiktokCommissionOrders.productName)
    .orderBy(sql`COALESCE(SUM(${tiktokCommissionOrders.price}), 0) DESC`)
    .limit(limit);

  return products.map(p => ({
    productName: p.productName,
    orderCount: Number(p.orderCount),
    totalQuantity: Number(p.totalQuantity),
    totalAmount: Number(p.totalAmount),
    avgPrice: Number(p.avgPrice),
    shopName: p.shopName,
  }));
}

/**
 * Get monthly trend data combining both sources
 */
export async function getReceiptMonthlyTrend() {
  const db = await getDb();
  if (!db) return [];

  // LINE receipts monthly
  const lineMonthly = await db.select({
    month: sql<string>`DATE_FORMAT(${lineReceipts.submittedAt}, '%Y-%m')`,
    count: sql<number>`COUNT(*)`,
    approvedCount: sql<number>`SUM(CASE WHEN ${lineReceipts.status} = 'approved' THEN 1 ELSE 0 END)`,
    totalAmount: sql<number>`COALESCE(SUM(CASE WHEN ${lineReceipts.status} = 'approved' THEN ${lineReceipts.totalAmount} ELSE 0 END), 0)`,
  })
    .from(lineReceipts)
    .where(sql`${lineReceipts.submittedAt} IS NOT NULL`)
    .groupBy(sql`DATE_FORMAT(${lineReceipts.submittedAt}, '%Y-%m')`)
    .orderBy(sql`DATE_FORMAT(${lineReceipts.submittedAt}, '%Y-%m') ASC`);

  // TikTok orders monthly
  const tiktokMonthly = await db.select({
    month: sql<string>`DATE_FORMAT(${tiktokCommissionOrders.orderCreatedAt}, '%Y-%m')`.as('month'),
    count: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${tiktokCommissionOrders.price}), 0)`,
  })
    .from(tiktokCommissionOrders)
    .where(sql`${tiktokCommissionOrders.orderCreatedAt} IS NOT NULL`)
    .groupBy(sql`month`)
    .orderBy(sql`month ASC`);

  // Merge into unified monthly data
  const monthMap = new Map<string, { month: string; lineCount: number; lineAmount: number; lineApproved: number; tiktokCount: number; tiktokAmount: number }>();
  
  for (const row of lineMonthly) {
    if (!row.month) continue;
    monthMap.set(row.month, {
      month: row.month,
      lineCount: Number(row.count),
      lineAmount: Number(row.totalAmount),
      lineApproved: Number(row.approvedCount),
      tiktokCount: 0,
      tiktokAmount: 0,
    });
  }
  
  for (const row of tiktokMonthly) {
    if (!row.month) continue;
    const existing = monthMap.get(row.month) || { month: row.month, lineCount: 0, lineAmount: 0, lineApproved: 0, tiktokCount: 0, tiktokAmount: 0 };
    existing.tiktokCount = Number(row.count);
    existing.tiktokAmount = Number(row.totalAmount);
    monthMap.set(row.month, existing);
  }

  return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Get repeater analysis from line_receipts
 */
export async function getRepeaterAnalysis() {
  const db = await getDb();
  if (!db) return { distribution: [], topRepeaters: [] };

  // Count receipts per user
  const userCounts = await db.select({
    lineUserId: lineReceipts.lineUserId,
    receiptCount: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${lineReceipts.totalAmount}), 0)`,
    approvedCount: sql<number>`SUM(CASE WHEN ${lineReceipts.status} = 'approved' THEN 1 ELSE 0 END)`,
    firstSubmission: sql<string>`MIN(${lineReceipts.submittedAt})`,
    lastSubmission: sql<string>`MAX(${lineReceipts.submittedAt})`,
  })
    .from(lineReceipts)
    .where(sql`${lineReceipts.storeName} IS NOT NULL AND ${lineReceipts.storeName} != ''`)
    .groupBy(lineReceipts.lineUserId);

  // Distribution: 1回, 2回, 3回, 4回, 5回以上
  const distribution = [
    { label: "1回", count: 0 },
    { label: "2回", count: 0 },
    { label: "3回", count: 0 },
    { label: "4回", count: 0 },
    { label: "5回以上", count: 0 },
  ];

  const topRepeaters: Array<{
    lineUserId: string;
    receiptCount: number;
    totalAmount: number;
    approvedCount: number;
    firstSubmission: string | null;
    lastSubmission: string | null;
    avgInterval: number | null;
  }> = [];

  for (const user of userCounts) {
    const count = Number(user.receiptCount);
    if (count === 1) distribution[0].count++;
    else if (count === 2) distribution[1].count++;
    else if (count === 3) distribution[2].count++;
    else if (count === 4) distribution[3].count++;
    else distribution[4].count++;

    // Calculate average interval for repeaters
    let avgInterval: number | null = null;
    if (count >= 2 && user.firstSubmission && user.lastSubmission) {
      const first = new Date(user.firstSubmission).getTime();
      const last = new Date(user.lastSubmission).getTime();
      const diffDays = (last - first) / (1000 * 60 * 60 * 24);
      avgInterval = Math.round(diffDays / (count - 1));
    }

    topRepeaters.push({
      lineUserId: user.lineUserId,
      receiptCount: count,
      totalAmount: Number(user.totalAmount),
      approvedCount: Number(user.approvedCount),
      firstSubmission: user.firstSubmission,
      lastSubmission: user.lastSubmission,
      avgInterval,
    });
  }

  // Sort by receipt count desc, take top 20
  topRepeaters.sort((a, b) => b.receiptCount - a.receiptCount);

  return {
    distribution,
    topRepeaters: topRepeaters.slice(0, 20),
    totalUsers: userCounts.length,
    repeatRate: userCounts.length > 0
      ? Math.round((userCounts.filter(u => Number(u.receiptCount) >= 2).length / userCounts.length) * 100)
      : 0,
    avgPurchaseCount: userCounts.length > 0
      ? Math.round(userCounts.reduce((sum, u) => sum + Number(u.receiptCount), 0) / userCounts.length * 10) / 10
      : 0,
  };
}

/**
 * Get region analysis from line_receipts OCR data
 */
export async function getRegionAnalysis() {
  const db = await getDb();
  if (!db) return [];

  // Get all line_receipts with ocrRawText that contains address info
  const receiptsWithOcr = await db.select({
    id: lineReceipts.id,
    ocrRawText: lineReceipts.ocrRawText,
    totalAmount: lineReceipts.totalAmount,
    status: lineReceipts.status,
  })
    .from(lineReceipts)
    .where(sql`${lineReceipts.ocrRawText} IS NOT NULL AND ${lineReceipts.ocrRawText} != ''`);

  // Parse OCR data and extract prefecture
  const prefectureMap = new Map<string, { count: number; totalAmount: number }>();
  
  const prefectures = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
  ];

  for (const receipt of receiptsWithOcr) {
    try {
      const ocrData = JSON.parse(receipt.ocrRawText || "{}");
      const address = ocrData?.deliveryInfo?.address || ocrData?.address || "";
      if (!address) continue;

      for (const pref of prefectures) {
        if (address.includes(pref) || address.includes(pref.replace(/[都府県]$/, ""))) {
          const existing = prefectureMap.get(pref) || { count: 0, totalAmount: 0 };
          existing.count++;
          existing.totalAmount += Number(receipt.totalAmount || 0);
          prefectureMap.set(pref, existing);
          break;
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return Array.from(prefectureMap.entries())
    .map(([prefecture, data]) => ({ prefecture, ...data }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get AI confidence analysis from receipt_review_logs
 */
export async function getAiConfidenceAnalysis() {
  const db = await getDb();
  if (!db) return { byConfidenceBand: [], approvalRateByConfidence: [] };

  const logs = await db.select({
    ocrConfidence: receiptReviewLogs.ocrConfidence,
    decision: receiptReviewLogs.decision,
    totalAmount: receiptReviewLogs.totalAmount,
    fraudScore: receiptReviewLogs.fraudScore,
  }).from(receiptReviewLogs);

  // Group by confidence bands: 0-50%, 50-70%, 70-85%, 85-95%, 95-100%
  const bands = [
    { label: "0-50%", min: 0, max: 50, total: 0, approved: 0, rejected: 0 },
    { label: "50-70%", min: 50, max: 70, total: 0, approved: 0, rejected: 0 },
    { label: "70-85%", min: 70, max: 85, total: 0, approved: 0, rejected: 0 },
    { label: "85-95%", min: 85, max: 95, total: 0, approved: 0, rejected: 0 },
    { label: "95-100%", min: 95, max: 101, total: 0, approved: 0, rejected: 0 },
  ];

  for (const log of logs) {
    const confidence = Number(log.ocrConfidence || 0);
    for (const band of bands) {
      if (confidence >= band.min && confidence < band.max) {
        band.total++;
        if (log.decision === "approved") band.approved++;
        if (log.decision === "rejected") band.rejected++;
        break;
      }
    }
  }

  return {
    byConfidenceBand: bands.map(b => ({
      label: b.label,
      total: b.total,
      approved: b.approved,
      rejected: b.rejected,
      approvalRate: b.total > 0 ? Math.round((b.approved / b.total) * 100) : 0,
    })),
    totalReviewed: logs.length,
  };
}

/**
 * Get day-of-week and hour analysis from line_receipts
 */
export async function getTimeAnalysis() {
  const db = await getDb();
  if (!db) return { byDayOfWeek: [], byHour: [] };

  // By day of week (JST = UTC+9)
  const byDow = await db.select({
    dow: sql<number>`DAYOFWEEK(DATE_ADD(${lineReceipts.submittedAt}, INTERVAL 9 HOUR))`,
    count: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${lineReceipts.totalAmount}), 0)`,
  })
    .from(lineReceipts)
    .where(sql`${lineReceipts.submittedAt} IS NOT NULL`)
    .groupBy(sql`DAYOFWEEK(DATE_ADD(${lineReceipts.submittedAt}, INTERVAL 9 HOUR))`)
    .orderBy(sql`dow`);

  // By hour (JST)
  const byHour = await db.select({
    hour: sql<number>`HOUR(DATE_ADD(${lineReceipts.submittedAt}, INTERVAL 9 HOUR))`,
    count: sql<number>`COUNT(*)`,
    totalAmount: sql<number>`COALESCE(SUM(${lineReceipts.totalAmount}), 0)`,
  })
    .from(lineReceipts)
    .where(sql`${lineReceipts.submittedAt} IS NOT NULL`)
    .groupBy(sql`HOUR(DATE_ADD(${lineReceipts.submittedAt}, INTERVAL 9 HOUR))`)
    .orderBy(sql`hour`);

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  return {
    byDayOfWeek: byDow.map(d => ({
      day: dayNames[Number(d.dow) - 1] || "不明",
      count: Number(d.count),
      totalAmount: Number(d.totalAmount),
    })),
    byHour: byHour.map(h => ({
      hour: Number(h.hour),
      count: Number(h.count),
      totalAmount: Number(h.totalAmount),
    })),
  };
}

// ========== 入荷リクエスト ==========

/** ブランド（ショップ）別ランキング */
export async function getBrandRanking(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  // テストショップを除外
  const TEST_SHOP_NAMES = ['テストショップ', 'Test Shop', 'test shop'];
  const results = await db
    .select({
      shopName: tiktokCommissionOrders.shopName,
      totalSales: sql<number>`SUM(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity})`,
      totalQuantity: sql<number>`SUM(${tiktokCommissionOrders.quantity})`,
      orderCount: sql<number>`COUNT(DISTINCT ${tiktokCommissionOrders.orderId})`,
      productCount: sql<number>`COUNT(DISTINCT ${tiktokCommissionOrders.productName})`,
    })
    .from(tiktokCommissionOrders)
    .where(and(isNotNull(tiktokCommissionOrders.shopName), notInArray(tiktokCommissionOrders.shopName, TEST_SHOP_NAMES)))
    .groupBy(tiktokCommissionOrders.shopName)
    .orderBy(sql`SUM(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}) DESC`)
    .limit(limit);

  return results.map(r => ({
    shopName: r.shopName,
    totalSales: Number(r.totalSales),
    totalQuantity: Number(r.totalQuantity),
    orderCount: Number(r.orderCount),
    productCount: Number(r.productCount),
  }));
}

/** ブランド別商品ランキング */
export async function getBrandProductRanking(shopName: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({
      productName: tiktokCommissionOrders.productName,
      productId: tiktokCommissionOrders.productId,
      totalSales: sql<number>`SUM(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity})`,
      totalQuantity: sql<number>`SUM(${tiktokCommissionOrders.quantity})`,
      orderCount: sql<number>`COUNT(DISTINCT ${tiktokCommissionOrders.orderId})`,
    })
    .from(tiktokCommissionOrders)
    .where(eq(tiktokCommissionOrders.shopName, shopName))
    .groupBy(tiktokCommissionOrders.productName, tiktokCommissionOrders.productId)
    .orderBy(sql`SUM(${tiktokCommissionOrders.price} * ${tiktokCommissionOrders.quantity}) DESC`)
    .limit(limit);

  return results.map(r => ({
    productName: r.productName,
    productId: r.productId,
    totalSales: Number(r.totalSales),
    totalQuantity: Number(r.totalQuantity),
    orderCount: Number(r.orderCount),
  }));
}

/** 入荷リクエストを作成 */
export async function createRestockRequest(data: { userId: number; productName: string; shopName?: string | null; productId?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  // 重複チェック（同一ユーザー・同一商品名）
  const existing = await db
    .select({ id: productRestockRequests.id })
    .from(productRestockRequests)
    .where(and(
      eq(productRestockRequests.userId, data.userId),
      sql`${productRestockRequests.productName} = ${data.productName}`,
      eq(productRestockRequests.status, "active")
    ))
    .limit(1);

  if (existing.length > 0) {
    return { alreadyRequested: true, id: existing[0].id };
  }

  const result = await db.insert(productRestockRequests).values({
    userId: data.userId,
    productName: data.productName,
    shopName: data.shopName || null,
    productId: data.productId || null,
  });

  return { alreadyRequested: false, id: Number(result[0].insertId) };
}

/** 入荷リクエストを取り消し */
export async function cancelRestockRequest(userId: number, productName: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db
    .update(productRestockRequests)
    .set({ status: "cancelled" })
    .where(and(
      eq(productRestockRequests.userId, userId),
      sql`${productRestockRequests.productName} = ${productName}`,
      eq(productRestockRequests.status, "active")
    ));
}

/** ユーザーのリクエスト済み商品名リスト */
export async function getUserRestockRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({ productName: productRestockRequests.productName })
    .from(productRestockRequests)
    .where(and(
      eq(productRestockRequests.userId, userId),
      eq(productRestockRequests.status, "active")
    ));
  return results.map(r => r.productName);
}

/** 商品別リクエスト数（上位） */
export async function getRestockRequestCounts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({
      productName: productRestockRequests.productName,
      shopName: productRestockRequests.shopName,
      requestCount: sql<number>`COUNT(*)`,
    })
    .from(productRestockRequests)
    .where(eq(productRestockRequests.status, "active"))
    .groupBy(productRestockRequests.productName, productRestockRequests.shopName)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  return results.map(r => ({
    productName: r.productName,
    shopName: r.shopName,
    requestCount: Number(r.requestCount),
  }));
}

/** ブランド別リクエスト集計（管理者向け交渉資料） */
export async function getRestockRequestsByBrand() {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({
      shopName: productRestockRequests.shopName,
      totalRequests: sql<number>`COUNT(*)`,
      uniqueProducts: sql<number>`COUNT(DISTINCT ${productRestockRequests.productName})`,
      uniqueUsers: sql<number>`COUNT(DISTINCT ${productRestockRequests.userId})`,
    })
    .from(productRestockRequests)
    .where(and(
      eq(productRestockRequests.status, "active"),
      isNotNull(productRestockRequests.shopName)
    ))
    .groupBy(productRestockRequests.shopName)
    .orderBy(sql`COUNT(*) DESC`);

  return results.map(r => ({
    shopName: r.shopName,
    totalRequests: Number(r.totalRequests),
    uniqueProducts: Number(r.uniqueProducts),
    uniqueUsers: Number(r.uniqueUsers),
  }));
}

/** ブランド別リクエスト詳細（管理者向け） */
export async function getRestockRequestDetailByBrand(shopName: string) {
  const db = await getDb();
  if (!db) return [];
  const results = await db
    .select({
      productName: productRestockRequests.productName,
      productId: productRestockRequests.productId,
      requestCount: sql<number>`COUNT(*)`,
      latestRequest: sql<string>`MAX(${productRestockRequests.createdAt})`,
    })
    .from(productRestockRequests)
    .where(and(
      eq(productRestockRequests.status, "active"),
      eq(productRestockRequests.shopName, shopName)
    ))
    .groupBy(productRestockRequests.productName, productRestockRequests.productId)
    .orderBy(sql`COUNT(*) DESC`);

  return results.map(r => ({
    productName: r.productName,
    productId: r.productId,
    requestCount: Number(r.requestCount),
    latestRequest: r.latestRequest,
  }));
}


// ============================================
// おすすめ商品機能（閲覧履歴ベース）
// ============================================

/**
 * ユーザーの閲覧履歴・お気に入り・購入履歴から、おすすめ商品を取得する
 * ロジック:
 * 1. ユーザーが閲覧/お気に入りした商品のブランド・カテゴリを特定
 * 2. 同じブランド・カテゴリの商品を優先的に表示
 * 3. まだ閲覧していない商品を優先
 * 4. 人気商品（注文数が多い）をスコアに加算
 */
export async function getRecommendedProducts(lineUserId: number, limit: number = 12): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. ユーザーが閲覧した商品のブランドID・カテゴリIDを取得
  const viewedProducts = await db
    .select({
      productId: mallViewHistory.productId,
      brandId: mallProducts.brandId,
      categoryId: mallProducts.categoryId,
    })
    .from(mallViewHistory)
    .innerJoin(mallProducts, eq(mallViewHistory.productId, mallProducts.id))
    .where(eq(mallViewHistory.lineUserId, lineUserId))
    .orderBy(desc(mallViewHistory.viewedAt))
    .limit(50);

  // 2. お気に入り商品のブランドID・カテゴリIDも取得
  const favProducts = await db
    .select({
      productId: mallFavorites.productId,
      brandId: mallProducts.brandId,
      categoryId: mallProducts.categoryId,
    })
    .from(mallFavorites)
    .innerJoin(mallProducts, eq(mallFavorites.productId, mallProducts.id))
    .where(eq(mallFavorites.lineUserId, lineUserId));

  // 3. 購入済み商品のブランドID・カテゴリIDも取得
  const purchasedProducts = await db
    .select({
      productId: mallOrderItems.productId,
      brandId: mallProducts.brandId,
      categoryId: mallProducts.categoryId,
    })
    .from(mallOrderItems)
    .innerJoin(mallOrders, eq(mallOrderItems.orderId, mallOrders.id))
    .innerJoin(mallProducts, eq(mallOrderItems.productId, mallProducts.id))
    .where(eq(mallOrders.lineUserId, lineUserId));

  // ブランドIDとカテゴリIDの重み付けスコアを計算
  const brandScores: Record<number, number> = {};
  const categoryScores: Record<number, number> = {};
  const excludeProductIds = new Set<number>();

  // 閲覧: スコア1
  for (const p of viewedProducts) {
    excludeProductIds.add(p.productId);
    if (p.brandId) brandScores[p.brandId] = (brandScores[p.brandId] || 0) + 1;
    if (p.categoryId) categoryScores[p.categoryId] = (categoryScores[p.categoryId] || 0) + 1;
  }

  // お気に入り: スコア3（より強い興味）
  for (const p of favProducts) {
    excludeProductIds.add(p.productId);
    if (p.brandId) brandScores[p.brandId] = (brandScores[p.brandId] || 0) + 3;
    if (p.categoryId) categoryScores[p.categoryId] = (categoryScores[p.categoryId] || 0) + 3;
  }

  // 購入: スコア5（最も強い興味）
  for (const p of purchasedProducts) {
    excludeProductIds.add(p.productId);
    if (p.brandId) brandScores[p.brandId] = (brandScores[p.brandId] || 0) + 5;
    if (p.categoryId) categoryScores[p.categoryId] = (categoryScores[p.categoryId] || 0) + 5;
  }

  // 興味のあるブランド・カテゴリのトップを取得
  const topBrandIds = Object.entries(brandScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => Number(id));

  const topCategoryIds = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => Number(id));

  // ユーザーの興味データがない場合は人気商品を返す
  if (topBrandIds.length === 0 && topCategoryIds.length === 0) {
    return getPopularProducts(limit);
  }

  // 4. おすすめ候補を取得（同ブランド or 同カテゴリの商品）
  const conditions = [];
  if (topBrandIds.length > 0) {
    conditions.push(inArray(mallProducts.brandId, topBrandIds));
  }
  if (topCategoryIds.length > 0) {
    conditions.push(inArray(mallProducts.categoryId, topCategoryIds));
  }

  const candidates = await db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      imageUrl: mallProducts.imageUrl,
      imageUrls: mallProducts.imageUrls,
      stock: mallProducts.stock,
      status: mallProducts.status,
      brandId: mallProducts.brandId,
      categoryId: mallProducts.categoryId,
      brandName: mallBrands.name,
      categoryName: mallCategories.name,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id))
    .where(
      and(
        eq(mallProducts.status, "active"),
        or(...conditions)
      )
    )
    .limit(limit * 3); // 多めに取得してフィルタリング

  // 閲覧済み商品を除外し、スコアで並べ替え
  const scoredCandidates = candidates
    .filter(p => !excludeProductIds.has(p.id))
    .map(p => {
      let score = 0;
      if (p.brandId && brandScores[p.brandId]) score += brandScores[p.brandId];
      if (p.categoryId && categoryScores[p.categoryId]) score += categoryScores[p.categoryId];
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // 候補が足りない場合は人気商品で補完
  if (scoredCandidates.length < limit) {
    const popularProducts = await getPopularProducts(limit - scoredCandidates.length, [...Array.from(excludeProductIds), ...scoredCandidates.map(p => p.id)]);
    return [...scoredCandidates, ...popularProducts];
  }

  return scoredCandidates;
}

/**
 * 人気商品を取得（注文数ベース）
 * 未ログインユーザーや履歴がないユーザー向けのフォールバック
 */
export async function getPopularProducts(limit: number = 12, excludeIds: number[] = []): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 注文数が多い商品を取得
  const orderCountSubquery = db
    .select({
      productId: mallOrderItems.productId,
      orderCount: sql<number>`COUNT(DISTINCT ${mallOrderItems.orderId})`.as("orderCount"),
    })
    .from(mallOrderItems)
    .groupBy(mallOrderItems.productId)
    .as("orderCounts");

  const results = await db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      imageUrl: mallProducts.imageUrl,
      imageUrls: mallProducts.imageUrls,
      stock: mallProducts.stock,
      status: mallProducts.status,
      brandId: mallProducts.brandId,
      categoryId: mallProducts.categoryId,
      brandName: mallBrands.name,
      categoryName: mallCategories.name,
      orderCount: sql<number>`COALESCE(${orderCountSubquery.orderCount}, 0)`,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id))
    .leftJoin(orderCountSubquery, eq(mallProducts.id, orderCountSubquery.productId))
    .where(
      excludeIds.length > 0
        ? and(eq(mallProducts.status, "active"), sql`${mallProducts.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`)
        : eq(mallProducts.status, "active")
    )
    .orderBy(sql`COALESCE(${orderCountSubquery.orderCount}, 0) DESC`)
    .limit(limit);

  return results;
}



// ============================================================
// Receipt Product Extraction & Purchase Ranking
// ============================================================

/**
 * Extract products from approved line_receipts OCR data and save to receipt_products table.
 * Handles both single and multi-product receipts.
 * Skips receipts that have already been extracted.
 */
export async function extractReceiptProducts() {
  const db = await getDb();
  if (!db) return { extracted: 0, skipped: 0, errors: 0 };

  // Get all approved receipts that haven't been extracted yet
  const alreadyExtracted = db.select({ receiptId: receiptProducts.receiptId }).from(receiptProducts);
  const pendingReceipts = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      storeName: lineReceipts.storeName,
      totalAmount: lineReceipts.totalAmount,
      ocrRawText: lineReceipts.ocrRawText,
    })
    .from(lineReceipts)
    .where(
      and(
        eq(lineReceipts.status, "approved"),
        isNotNull(lineReceipts.ocrRawText),
        sql`${lineReceipts.id} NOT IN (${alreadyExtracted})`
      )
    );

  let extracted = 0, skipped = 0, errors = 0;

  for (const receipt of pendingReceipts) {
    try {
      if (!receipt.ocrRawText) { skipped++; continue; }
      
      let ocrData: any;
      try {
        ocrData = JSON.parse(receipt.ocrRawText);
      } catch {
        skipped++;
        continue;
      }

      const productName = ocrData.productName;
      if (!productName || productName === "undefined") { skipped++; continue; }

      // Handle multi-product receipts (separated by 、 or ,)
      const productNames = productName.includes("、")
        ? productName.split("、").map((n: string) => n.trim()).filter(Boolean)
        : [productName.trim()];

      const perProductAmount = productNames.length > 1
        ? Math.floor((receipt.totalAmount || 0) / productNames.length)
        : receipt.totalAmount || 0;

      for (const pName of productNames) {
        await db.insert(receiptProducts).values({
          receiptId: receipt.id,
          userId: null, // lineReceipts uses lineUserId (LINE ID string), not a numeric user ID
          productName: pName,
          shopName: ocrData.shopName || receipt.storeName || null,
          amount: perProductAmount,
          orderNumber: ocrData.orderNumber || null,
        });
        extracted++;
      }
    } catch (e) {
      console.error(`[extractReceiptProducts] Error processing receipt #${receipt.id}:`, e);
      errors++;
    }
  }

  return { extracted, skipped, errors };
}

/**
 * Extract products from a single receipt (called when a receipt is approved)
 */
export async function extractSingleReceiptProducts(receiptId: number) {
  const db = await getDb();
  if (!db) return;

  const [receipt] = await db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      storeName: lineReceipts.storeName,
      totalAmount: lineReceipts.totalAmount,
      ocrRawText: lineReceipts.ocrRawText,
    })
    .from(lineReceipts)
    .where(eq(lineReceipts.id, receiptId))
    .limit(1);

  if (!receipt?.ocrRawText) return;

  // Check if already extracted
  const existing = await db
    .select({ id: receiptProducts.id })
    .from(receiptProducts)
    .where(eq(receiptProducts.receiptId, receiptId))
    .limit(1);
  if (existing.length > 0) return;

  let ocrData: any;
  try {
    ocrData = JSON.parse(receipt.ocrRawText);
  } catch {
    return;
  }

  const productName = ocrData.productName;
  if (!productName || productName === "undefined") return;

  const productNames = productName.includes("、")
    ? productName.split("、").map((n: string) => n.trim()).filter(Boolean)
    : [productName.trim()];

  const perProductAmount = productNames.length > 1
    ? Math.floor((receipt.totalAmount || 0) / productNames.length)
    : receipt.totalAmount || 0;

  for (const pName of productNames) {
    await db.insert(receiptProducts).values({
      receiptId: receipt.id,
      userId: null, // lineReceipts uses lineUserId (LINE ID string), not a numeric user ID
      productName: pName,
      shopName: ocrData.shopName || receipt.storeName || null,
      amount: perProductAmount,
      orderNumber: ocrData.orderNumber || null,
    });
  }
}

/**
 * Get purchase ranking from receipt_products (みんなの購入ランキング)
 * Groups by product name and ranks by purchase count and total amount
 */
export async function getReceiptPurchaseRanking(limit = 50) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      productName: receiptProducts.productName,
      shopName: receiptProducts.shopName,
      purchaseCount: sql<number>`COUNT(*)`.as("purchaseCount"),
      totalAmount: sql<number>`SUM(${receiptProducts.amount})`.as("totalAmount"),
      uniqueBuyers: sql<number>`COUNT(DISTINCT ${receiptProducts.receiptId})`.as("uniqueBuyers"),
    })
    .from(receiptProducts)
    .groupBy(receiptProducts.productName, receiptProducts.shopName)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  return results;
}

/**
 * Get shop ranking from receipt_products (ショップ別購入ランキング)
 */
export async function getReceiptShopRanking(limit = 30) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      shopName: receiptProducts.shopName,
      purchaseCount: sql<number>`COUNT(*)`.as("purchaseCount"),
      totalAmount: sql<number>`SUM(${receiptProducts.amount})`.as("totalAmount"),
      uniqueBuyers: sql<number>`COUNT(DISTINCT ${receiptProducts.receiptId})`.as("uniqueBuyers"),
      productCount: sql<number>`COUNT(DISTINCT ${receiptProducts.productName})`.as("productCount"),
    })
    .from(receiptProducts)
    .where(isNotNull(receiptProducts.shopName))
    .groupBy(receiptProducts.shopName)
    .orderBy(sql`SUM(${receiptProducts.amount}) DESC`)
    .limit(limit);

  return results;
}

/**
 * Get products by shop from receipt_products
 */
export async function getReceiptProductsByShop(shopName: string, limit = 30) {
  const db = await getDb();
  if (!db) return [];

  const results = await db
    .select({
      productName: receiptProducts.productName,
      purchaseCount: sql<number>`COUNT(*)`.as("purchaseCount"),
      totalAmount: sql<number>`SUM(${receiptProducts.amount})`.as("totalAmount"),
      uniqueBuyers: sql<number>`COUNT(DISTINCT ${receiptProducts.receiptId})`.as("uniqueBuyers"),
    })
    .from(receiptProducts)
    .where(eq(receiptProducts.shopName, shopName))
    .groupBy(receiptProducts.productName)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(limit);

  return results;
}


// ========================================
// 友達招待チャレンジ DB ヘルパー関数
// ========================================

/** アクティブなキャンペーンを取得（なければシードデータ作成） */
export async function getActiveReferralCampaign() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(referralCampaigns).where(eq(referralCampaigns.isActive, true)).limit(1);
  if (existing.length > 0) return existing[0];
  
  // シードデータ作成
  await seedDefaultReferralCampaign();
  const seeded = await db.select().from(referralCampaigns).where(eq(referralCampaigns.isActive, true)).limit(1);
  return seeded[0] || null;
}

/** デフォルトキャンペーンのシードデータ作成 */
export async function seedDefaultReferralCampaign() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // キャンペーン作成
  const result = await db.insert(referralCampaigns).values({
    name: "友達招待チャレンジ",
    description: "友達を招待してポイントをGET！ステージを進めてルーレットを回そう！",
    isActive: true,
    maxDailyReferrals: 5,
    monthlyPointCap: 5000,
    inviteeBonus: 50,
  });
  const campaignId = Number(result[0].insertId);
  
  // ステージ定義
  const stages = [
    { stageNumber: 1, requiredReferrals: 1, fixedReward: 50, spinCount: 1, isSpecialSpin: false, stageEmoji: "🌱", stageName: "はじめの一歩" },
    { stageNumber: 2, requiredReferrals: 3, fixedReward: 100, spinCount: 1, isSpecialSpin: false, stageEmoji: "🌸", stageName: "お花見フレンド" },
    { stageNumber: 3, requiredReferrals: 5, fixedReward: 200, spinCount: 2, isSpecialSpin: false, stageEmoji: "🌟", stageName: "キラキラスター" },
    { stageNumber: 4, requiredReferrals: 10, fixedReward: 500, spinCount: 3, isSpecialSpin: false, stageEmoji: "👑", stageName: "プリンセス" },
    { stageNumber: 5, requiredReferrals: 20, fixedReward: 1000, spinCount: 1, isSpecialSpin: true, stageEmoji: "💎", stageName: "ダイヤモンドクイーン" },
  ];
  
  for (const s of stages) {
    await db.insert(campaignStages).values({ campaignId, ...s });
  }
  
  // 通常スピン報酬テーブル
  const normalResult = await db.insert(spinRewardTables).values({ name: "通常ルーレット", isSpecial: false });
  const normalTableId = Number(normalResult[0].insertId);
  
  const normalItems = [
    { label: "ハズレ…でも3pt!", emoji: "🌙", points: 3, probability: 3000, color: "#E8B4CB", sortOrder: 1 },
    { label: "5ptゲット！", emoji: "🌸", points: 5, probability: 2500, color: "#FFB7C5", sortOrder: 2 },
    { label: "10ptゲット！", emoji: "💖", points: 10, probability: 2000, color: "#FF69B4", sortOrder: 3 },
    { label: "20ptゲット！", emoji: "🎁", points: 20, probability: 1000, color: "#FF1493", sortOrder: 4 },
    { label: "30ptゲット！", emoji: "⭐", points: 30, probability: 700, color: "#DB7093", sortOrder: 5 },
    { label: "50ptゲット！", emoji: "🌟", points: 50, probability: 300, color: "#C71585", sortOrder: 6 },
    { label: "100ptゲット！", emoji: "💎", points: 100, probability: 200, color: "#8B008B", sortOrder: 7 },
    { label: "200ptゲット！", emoji: "👑", points: 200, probability: 50, color: "#4B0082", sortOrder: 8 },
  ];
  
  for (const item of normalItems) {
    await db.insert(spinRewardItems).values({ tableId: normalTableId, ...item });
  }
  
  // 特別スピン報酬テーブル
  const specialResult = await db.insert(spinRewardTables).values({ name: "プレミアムルーレット", isSpecial: true });
  const specialTableId = Number(specialResult[0].insertId);
  
  const specialItems = [
    { label: "10ptゲット！", emoji: "🌸", points: 10, probability: 2000, color: "#FFB7C5", sortOrder: 1 },
    { label: "30ptゲット！", emoji: "⭐", points: 30, probability: 2500, color: "#FF69B4", sortOrder: 2 },
    { label: "50ptゲット！", emoji: "🎁", points: 50, probability: 2000, color: "#FF1493", sortOrder: 3 },
    { label: "100ptゲット！", emoji: "💖", points: 100, probability: 1500, color: "#DB7093", sortOrder: 4 },
    { label: "200ptゲット！", emoji: "🌟", points: 200, probability: 1000, color: "#C71585", sortOrder: 5 },
    { label: "300ptゲット！", emoji: "💎", points: 300, probability: 500, color: "#8B008B", sortOrder: 6 },
    { label: "500ptゲット！", emoji: "👑", points: 500, probability: 300, color: "#4B0082", sortOrder: 7 },
    { label: "1000ptゲット！", emoji: "🏆", points: 1000, probability: 200, color: "#2E0854", sortOrder: 8 },
  ];
  
  for (const item of specialItems) {
    await db.insert(spinRewardItems).values({ tableId: specialTableId, ...item });
  }
  
  return campaignId;
}

/** ユーザーの招待進捗を取得（なければ作成） */
export async function getOrCreateUserReferralProgress(lineUserId: number, campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(userReferralProgress)
    .where(and(eq(userReferralProgress.lineUserId, lineUserId), eq(userReferralProgress.campaignId, campaignId)))
    .limit(1);
  
  if (existing.length > 0) {
    // 月次リセットチェック
    const now = new Date();
    const resetAt = new Date(existing[0].monthlyPointsResetAt);
    if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      await db.update(userReferralProgress)
        .set({ monthlyPointsEarned: 0, monthlyPointsResetAt: now })
        .where(eq(userReferralProgress.id, existing[0].id));
      return { ...existing[0], monthlyPointsEarned: 0 };
    }
    return existing[0];
  }
  
  // 新規作成（招待コード生成）
  const code = await generateFriendReferralCode();
  await db.insert(userReferralProgress).values({
    lineUserId,
    campaignId,
    referralCode: code,
    totalReferrals: 0,
    currentStage: 0,
    totalPointsEarned: 0,
    pendingSpins: 0,
    pendingSpecialSpins: 0,
    titleLevel: "none",
    monthlyPointsEarned: 0,
  });
  
  const created = await db.select().from(userReferralProgress)
    .where(and(eq(userReferralProgress.lineUserId, lineUserId), eq(userReferralProgress.campaignId, campaignId)))
    .limit(1);
  return created[0];
}

/** 友達招待コード生成（6文字英数字） */
async function generateFriendReferralCode(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let attempts = 0;
  while (attempts < 100) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const existing = await db.select().from(userReferralProgress)
      .where(eq(userReferralProgress.referralCode, code)).limit(1);
    if (existing.length === 0) return code;
    attempts++;
  }
  throw new Error("Failed to generate unique referral code");
}

/** 招待コードからユーザー進捗を検索 */
export async function getUserProgressByReferralCode(code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(userReferralProgress)
    .where(eq(userReferralProgress.referralCode, code.toUpperCase())).limit(1);
  return result[0] || null;
}

/** キャンペーンのステージ一覧を取得 */
export async function getCampaignStages(campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(campaignStages)
    .where(eq(campaignStages.campaignId, campaignId))
    .orderBy(asc(campaignStages.stageNumber));
}

/** 友達招待を記録 */
export async function recordFriendReferral(data: {
  referrerLineUserId: number;
  inviteeLineUserId: number;
  campaignId: number;
  referrerPointsAwarded: number;
  inviteePointsAwarded: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(friendReferrals).values({
    referrerLineUserId: data.referrerLineUserId,
    inviteeLineUserId: data.inviteeLineUserId,
    campaignId: data.campaignId,
    referrerPointsAwarded: data.referrerPointsAwarded,
    inviteePointsAwarded: data.inviteePointsAwarded,
  });
}

/** 既に招待済みかチェック */
export async function hasAlreadyBeenReferred(inviteeLineUserId: number, campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(friendReferrals)
    .where(and(
      eq(friendReferrals.inviteeLineUserId, inviteeLineUserId),
      eq(friendReferrals.campaignId, campaignId)
    )).limit(1);
  return existing.length > 0;
}

/** 今日の招待数を取得 */
export async function getTodayReferralCount(lineUserId: number, campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(friendReferrals)
    .where(and(
      eq(friendReferrals.referrerLineUserId, lineUserId),
      eq(friendReferrals.campaignId, campaignId),
      gte(friendReferrals.createdAt, today)
    ));
  return result[0]?.count || 0;
}

/** ユーザー進捗を更新 */
export async function updateUserReferralProgress(id: number, data: Partial<{
  totalReferrals: number;
  currentStage: number;
  totalPointsEarned: number;
  pendingSpins: number;
  pendingSpecialSpins: number;
  titleLevel: string;
  monthlyPointsEarned: number;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(userReferralProgress).set(data).where(eq(userReferralProgress.id, id));
}

/** スピン報酬テーブルのアイテムを取得 */
export async function getSpinRewardItems(isSpecial: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const table = await db.select().from(spinRewardTables)
    .where(eq(spinRewardTables.isSpecial, isSpecial)).limit(1);
  if (table.length === 0) return [];
  
  return await db.select().from(spinRewardItems)
    .where(eq(spinRewardItems.tableId, table[0].id));
}

/** スピン結果を記録 */
export async function recordSpinResult(data: {
  lineUserId: number;
  campaignId: number;
  rewardItemId: number;
  pointsWon: number;
  isSpecialSpin: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(userSpinHistory).values(data);
}

/** ランキング取得 */
export async function getReferralLeaderboard(campaignId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results = await db
    .select({
      lineUserId: userReferralProgress.lineUserId,
      totalReferrals: userReferralProgress.totalReferrals,
      totalPointsEarned: userReferralProgress.totalPointsEarned,
      currentStage: userReferralProgress.currentStage,
      titleLevel: userReferralProgress.titleLevel,
    })
    .from(userReferralProgress)
    .where(and(
      eq(userReferralProgress.campaignId, campaignId),
      gt(userReferralProgress.totalReferrals, 0)
    ))
    .orderBy(desc(userReferralProgress.totalReferrals))
    .limit(limit);
  
  // ユーザー名を取得
  const enriched = [];
  for (const r of results) {
    const user = await db.select({ displayName: lineUsers.displayName, pictureUrl: lineUsers.pictureUrl })
      .from(lineUsers).where(eq(lineUsers.id, r.lineUserId)).limit(1);
    enriched.push({
      ...r,
      displayName: user[0]?.displayName || "匿名ユーザー",
      pictureUrl: user[0]?.pictureUrl || null,
    });
  }
  return enriched;
}

/** アクティビティフィードに記録 */
export async function addReferralActivity(data: {
  lineUserId?: number;
  activityType: string;
  message: string;
  pointsAmount?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(referralActivityFeed).values({
    lineUserId: data.lineUserId ?? null,
    activityType: data.activityType,
    message: data.message,
    pointsAmount: data.pointsAmount ?? 0,
  });
}

/** アクティビティフィード取得 */
export async function getReferralActivityFeed(limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(referralActivityFeed)
    .orderBy(desc(referralActivityFeed.createdAt))
    .limit(limit);
}

/** ユーザーの招待履歴を取得 */
export async function getUserReferralHistory(lineUserId: number, campaignId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const referrals = await db.select().from(friendReferrals)
    .where(and(
      eq(friendReferrals.referrerLineUserId, lineUserId),
      eq(friendReferrals.campaignId, campaignId)
    ))
    .orderBy(desc(friendReferrals.createdAt));
  
  const enriched = [];
  for (const r of referrals) {
    const user = await db.select({ displayName: lineUsers.displayName, pictureUrl: lineUsers.pictureUrl })
      .from(lineUsers).where(eq(lineUsers.id, r.inviteeLineUserId)).limit(1);
    enriched.push({
      ...r,
      inviteeDisplayName: user[0]?.displayName || "匿名ユーザー",
      inviteePictureUrl: user[0]?.pictureUrl || null,
    });
  }
  return enriched;
}

/** ユーザーのスピン履歴を取得 */
export async function getUserSpinHistoryList(lineUserId: number, limit = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(userSpinHistory)
    .where(eq(userSpinHistory.lineUserId, lineUserId))
    .orderBy(desc(userSpinHistory.createdAt))
    .limit(limit);
}

/** 称号レベルを計算 */
export function calculateTitleLevel(totalReferrals: number): string {
  if (totalReferrals >= 50) return "diamond";
  if (totalReferrals >= 20) return "platinum";
  if (totalReferrals >= 10) return "gold";
  if (totalReferrals >= 5) return "silver";
  if (totalReferrals >= 1) return "bronze";
  return "none";
}

// ============================================================
// Blog Functions
// ============================================================

// --- Blog Categories ---
export async function createBlogCategory(data: InsertBlogCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(blogCategories).values(data);
  return { id: result[0].insertId, ...data };
}

export async function getAllBlogCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blogCategories).orderBy(asc(blogCategories.sortOrder));
}

export async function updateBlogCategory(id: number, data: Partial<InsertBlogCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(blogCategories).set(data).where(eq(blogCategories.id, id));
}

export async function deleteBlogCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blogCategories).where(eq(blogCategories.id, id));
}

// --- Blog Tags ---
export async function createBlogTag(data: InsertBlogTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(blogTags).values(data);
  return { id: result[0].insertId, ...data };
}

export async function getAllBlogTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(blogTags).orderBy(asc(blogTags.name));
}

export async function deleteBlogTag(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blogArticleTags).where(eq(blogArticleTags.tagId, id));
  await db.delete(blogTags).where(eq(blogTags.id, id));
}

// --- Blog Articles ---
export async function createBlogArticle(data: InsertBlogArticle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(blogArticles).values(data);
  return { id: result[0].insertId, ...data };
}

export async function getBlogArticleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(blogArticles).where(eq(blogArticles.id, id)).limit(1);
  return rows[0] || null;
}

export async function getBlogArticleBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(blogArticles).where(eq(blogArticles.slug, slug)).limit(1);
  return rows[0] || null;
}

export async function listBlogArticles(opts: { status?: "draft" | "published" | "scheduled"; categoryId?: number; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) return { articles: [], total: 0 };
  
  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(blogArticles.status, opts.status));
  if (opts.categoryId) conditions.push(eq(blogArticles.categoryId, opts.categoryId));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [articles, countResult] = await Promise.all([
    db.select().from(blogArticles)
      .where(where)
      .orderBy(desc(blogArticles.createdAt))
      .limit(opts.limit || 20)
      .offset(opts.offset || 0),
    db.select({ count: sql<number>`count(*)` }).from(blogArticles).where(where),
  ]);
  
  return { articles, total: Number(countResult[0]?.count || 0) };
}

export async function updateBlogArticle(id: number, data: Partial<InsertBlogArticle>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(blogArticles).set(data).where(eq(blogArticles.id, id));
}

export async function deleteBlogArticle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blogArticleTags).where(eq(blogArticleTags.articleId, id));
  await db.delete(blogArticles).where(eq(blogArticles.id, id));
}

// --- Blog Article Tags ---
export async function setBlogArticleTags(articleId: number, tagIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(blogArticleTags).where(eq(blogArticleTags.articleId, articleId));
  if (tagIds.length > 0) {
    await db.insert(blogArticleTags).values(tagIds.map(tagId => ({ articleId, tagId })));
  }
}

export async function getBlogArticleTagIds(articleId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(blogArticleTags).where(eq(blogArticleTags.articleId, articleId));
  return rows.map(r => r.tagId);
}

// --- Blog search for products (for embedding) ---
export async function searchMallProductsForBlog(query: string, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: mallProducts.id,
    name: mallProducts.name,
    price: mallProducts.price,
    pointPrice: mallProducts.pointPrice,
    imageUrl: mallProducts.imageUrl,
    brandName: mallBrands.name,
  })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .where(
      and(
        eq(mallProducts.status, "active"),
        or(
          like(mallProducts.name, `%${query}%`),
          like(mallProducts.description, `%${query}%`)
        )
      )
    )
    .limit(limit);
}


// =============================================
// Auto Post Scheduler DB Functions
// =============================================

// --- Schedule CRUD ---
export async function listAutoPostSchedules() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(autoPostSchedules).orderBy(desc(autoPostSchedules.createdAt));
}

export async function getAutoPostScheduleById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(autoPostSchedules).where(eq(autoPostSchedules.id, id)).limit(1);
  return result[0] || null;
}

export async function createAutoPostSchedule(data: InsertAutoPostSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(autoPostSchedules).values(data).$returningId();
  return await getAutoPostScheduleById(inserted.id);
}

export async function updateAutoPostSchedule(id: number, data: Partial<InsertAutoPostSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(autoPostSchedules).set(data).where(eq(autoPostSchedules.id, id));
  return await getAutoPostScheduleById(id);
}

export async function deleteAutoPostSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(autoPostSchedules).where(eq(autoPostSchedules.id, id));
  return { success: true };
}

export async function incrementScheduleGenerated(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(autoPostSchedules).set({
    totalGenerated: sql`${autoPostSchedules.totalGenerated} + 1`,
    lastRunAt: new Date(),
  }).where(eq(autoPostSchedules.id, id));
}

// --- Preset Keywords ---
export async function listPresetKeywordsDb(opts: { category?: string; enabled?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (opts.category) conditions.push(eq(presetKeywords.category, opts.category));
  if (opts.enabled !== undefined) conditions.push(eq(presetKeywords.enabled, opts.enabled));
  const query = conditions.length > 0
    ? db.select().from(presetKeywords).where(and(...conditions)).orderBy(desc(presetKeywords.priority), asc(presetKeywords.usedCount))
    : db.select().from(presetKeywords).orderBy(desc(presetKeywords.priority), asc(presetKeywords.usedCount));
  return await query;
}

export async function getNextUnusedKeyword() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Get keyword with lowest usedCount and highest priority
  const result = await db.select().from(presetKeywords)
    .where(eq(presetKeywords.enabled, true))
    .orderBy(asc(presetKeywords.usedCount), desc(presetKeywords.priority))
    .limit(1);
  return result[0] || null;
}

export async function markKeywordUsed(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(presetKeywords).set({
    usedCount: sql`${presetKeywords.usedCount} + 1`,
    lastUsedAt: new Date(),
  }).where(eq(presetKeywords.id, id));
}

export async function createPresetKeywordDb(data: InsertPresetKeyword) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(presetKeywords).values(data).$returningId();
  const result = await db.select().from(presetKeywords).where(eq(presetKeywords.id, inserted.id)).limit(1);
  return result[0];
}

export async function deletePresetKeywordDb(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(presetKeywords).where(eq(presetKeywords.id, id));
  return { success: true };
}

export async function resetAllKeywordsUsage() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(presetKeywords).set({ usedCount: 0, lastUsedAt: null });
  return { success: true };
}

// --- Auto Post Logs ---
export async function listAutoPostLogs(opts: { scheduleId?: number; status?: string; limit?: number; offset?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (opts.scheduleId) conditions.push(eq(autoPostLogs.scheduleId, opts.scheduleId));
  if (opts.status) conditions.push(eq(autoPostLogs.status, opts.status as any));
  const query = conditions.length > 0
    ? db.select().from(autoPostLogs).where(and(...conditions)).orderBy(desc(autoPostLogs.createdAt)).limit(opts.limit || 50).offset(opts.offset || 0)
    : db.select().from(autoPostLogs).orderBy(desc(autoPostLogs.createdAt)).limit(opts.limit || 50).offset(opts.offset || 0);
  return await query;
}

export async function createAutoPostLog(data: InsertAutoPostLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(autoPostLogs).values(data).$returningId();
  const result = await db.select().from(autoPostLogs).where(eq(autoPostLogs.id, inserted.id)).limit(1);
  return result[0]!;
}

export async function updateAutoPostLog(id: number, data: Partial<InsertAutoPostLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(autoPostLogs).set(data).where(eq(autoPostLogs.id, id));
}

export async function getStuckAutoPostLogs() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Logs stuck in generating/image_generating for more than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  return await db.select().from(autoPostLogs)
    .where(
      and(
        or(
          eq(autoPostLogs.status, 'generating'),
          eq(autoPostLogs.status, 'image_generating')
        ),
        lte(autoPostLogs.startedAt, tenMinutesAgo)
      )
    );
}


// =============================================
// EC統合型SEOブログ ヘルパー関数
// =============================================

/**
 * MALL商品の売上ランキング（注文数ベース）
 * ブログ記事内の「人気商品ランキング」セクション用
 */
export async function getMallProductSalesRanking(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  const orderCountSubquery = db
    .select({
      productId: mallOrderItems.productId,
      orderCount: sql<number>`COUNT(DISTINCT ${mallOrderItems.orderId})`.as("orderCount"),
      totalQuantity: sql<number>`SUM(${mallOrderItems.quantity})`.as("totalQuantity"),
      totalRevenue: sql<number>`SUM(${mallOrderItems.subtotal})`.as("totalRevenue"),
    })
    .from(mallOrderItems)
    .groupBy(mallOrderItems.productId)
    .as("orderCounts");

  const results = await db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      imageUrl: mallProducts.imageUrl,
      description: mallProducts.description,
      brandId: mallProducts.brandId,
      categoryId: mallProducts.categoryId,
      brandName: mallBrands.name,
      categoryName: mallCategories.name,
      orderCount: sql<number>`COALESCE(${orderCountSubquery.orderCount}, 0)`,
      totalQuantity: sql<number>`COALESCE(${orderCountSubquery.totalQuantity}, 0)`,
      totalRevenue: sql<number>`COALESCE(${orderCountSubquery.totalRevenue}, 0)`,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id))
    .leftJoin(orderCountSubquery, eq(mallProducts.id, orderCountSubquery.productId))
    .where(eq(mallProducts.status, "active"))
    .orderBy(sql`COALESCE(${orderCountSubquery.orderCount}, 0) DESC`)
    .limit(limit);

  return results.map(r => ({
    ...r,
    orderCount: Number(r.orderCount),
    totalQuantity: Number(r.totalQuantity),
    totalRevenue: Number(r.totalRevenue),
  }));
}

/**
 * カテゴリ別の商品ランキング
 */
export async function getMallProductRankingByCategory(categoryId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  const orderCountSubquery = db
    .select({
      productId: mallOrderItems.productId,
      orderCount: sql<number>`COUNT(DISTINCT ${mallOrderItems.orderId})`.as("orderCount"),
    })
    .from(mallOrderItems)
    .groupBy(mallOrderItems.productId)
    .as("orderCounts");

  const results = await db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      imageUrl: mallProducts.imageUrl,
      description: mallProducts.description,
      brandName: mallBrands.name,
      orderCount: sql<number>`COALESCE(${orderCountSubquery.orderCount}, 0)`,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(orderCountSubquery, eq(mallProducts.id, orderCountSubquery.productId))
    .where(and(eq(mallProducts.status, "active"), eq(mallProducts.categoryId, categoryId)))
    .orderBy(sql`COALESCE(${orderCountSubquery.orderCount}, 0) DESC`)
    .limit(limit);

  return results.map(r => ({
    ...r,
    orderCount: Number(r.orderCount),
  }));
}

/**
 * ブランド別の商品一覧（ブランドページ用）
 */
export async function getMallProductsByBrand(brandId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  const orderCountSubquery = db
    .select({
      productId: mallOrderItems.productId,
      orderCount: sql<number>`COUNT(DISTINCT ${mallOrderItems.orderId})`.as("orderCount"),
    })
    .from(mallOrderItems)
    .groupBy(mallOrderItems.productId)
    .as("orderCounts");

  return db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      imageUrl: mallProducts.imageUrl,
      description: mallProducts.description,
      brandName: mallBrands.name,
      categoryName: mallCategories.name,
      orderCount: sql<number>`COALESCE(${orderCountSubquery.orderCount}, 0)`,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id))
    .leftJoin(orderCountSubquery, eq(mallProducts.id, orderCountSubquery.productId))
    .where(and(eq(mallProducts.status, "active"), eq(mallProducts.brandId, brandId)))
    .orderBy(sql`COALESCE(${orderCountSubquery.orderCount}, 0) DESC`)
    .limit(limit);
}

/**
 * 商品の購入者数を取得
 */
export async function getMallProductBuyerCount(productId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({
      buyerCount: sql<number>`COUNT(DISTINCT ${mallOrders.lineUserId})`,
    })
    .from(mallOrderItems)
    .innerJoin(mallOrders, eq(mallOrderItems.orderId, mallOrders.id))
    .where(
      and(
        eq(mallOrderItems.productId, productId),
        inArray(mallOrders.status, ["paid", "confirmed", "shipped", "delivered"])
      )
    );

  return Number(result[0]?.buyerCount || 0);
}

/**
 * 全商品の購入者数を一括取得（ランキング表示用）
 */
export async function getAllMallProductBuyerCounts(): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) return {};

  const results = await db
    .select({
      productId: mallOrderItems.productId,
      buyerCount: sql<number>`COUNT(DISTINCT ${mallOrders.lineUserId})`,
    })
    .from(mallOrderItems)
    .innerJoin(mallOrders, eq(mallOrderItems.orderId, mallOrders.id))
    .where(inArray(mallOrders.status, ["paid", "confirmed", "shipped", "delivered"]))
    .groupBy(mallOrderItems.productId);

  const counts: Record<number, number> = {};
  for (const r of results) {
    counts[r.productId] = Number(r.buyerCount);
  }
  return counts;
}

/**
 * 記事に関連する商品をキーワードマッチで検索（記事内自動リンク用）
 */
export async function findRelatedProductsForArticle(articleTitle: string, articleContent: string, limit: number = 6): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  // タイトルとコンテンツからキーワードを抽出
  const text = `${articleTitle} ${articleContent}`.replace(/<[^>]*>/g, '');
  
  // 全アクティブ商品を取得してテキストマッチ
  const products = await db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      imageUrl: mallProducts.imageUrl,
      description: mallProducts.description,
      brandName: mallBrands.name,
      categoryName: mallCategories.name,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id))
    .where(eq(mallProducts.status, "active"));

  // 商品名が記事テキストに含まれるかスコアリング
  const scored = products.map(p => {
    let score = 0;
    const productName = p.name.toLowerCase();
    const textLower = text.toLowerCase();
    
    // 商品名が記事に含まれる
    if (textLower.includes(productName)) score += 10;
    
    // 商品名の各単語が記事に含まれる
    const words = productName.split(/[\s　・]+/).filter(w => w.length >= 2);
    for (const word of words) {
      if (textLower.includes(word.toLowerCase())) score += 2;
    }
    
    // ブランド名が記事に含まれる
    if (p.brandName && textLower.includes(p.brandName.toLowerCase())) score += 5;
    
    // カテゴリ名が記事に含まれる
    if (p.categoryName && textLower.includes(p.categoryName.toLowerCase())) score += 3;
    
    return { ...p, relevanceScore: score };
  }).filter(p => p.relevanceScore > 0);

  // スコア順にソートしてlimit件返す
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored.slice(0, limit);
}

/**
 * 関連記事を取得（同カテゴリ・同タグの記事）
 */
export async function getRelatedBlogArticles(articleId: number, categoryId: number | null, tagIds: number[], limit: number = 5): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  // 同カテゴリの記事
  const sameCategoryArticles = categoryId ? await db
    .select({
      id: blogArticles.id,
      title: blogArticles.title,
      slug: blogArticles.slug,
      excerpt: blogArticles.excerpt,
      coverImageUrl: blogArticles.coverImageUrl,
      publishedAt: blogArticles.publishedAt,
      viewCount: blogArticles.viewCount,
      categoryId: blogArticles.categoryId,
    })
    .from(blogArticles)
    .where(
      and(
        eq(blogArticles.status, "published"),
        eq(blogArticles.categoryId, categoryId),
        not(eq(blogArticles.id, articleId))
      )
    )
    .orderBy(desc(blogArticles.publishedAt))
    .limit(limit) : [];

  // 同タグの記事
  let sameTagArticles: any[] = [];
  if (tagIds.length > 0) {
    sameTagArticles = await db
      .select({
        id: blogArticles.id,
        title: blogArticles.title,
        slug: blogArticles.slug,
        excerpt: blogArticles.excerpt,
        coverImageUrl: blogArticles.coverImageUrl,
        publishedAt: blogArticles.publishedAt,
        viewCount: blogArticles.viewCount,
        categoryId: blogArticles.categoryId,
      })
      .from(blogArticles)
      .innerJoin(blogArticleTags, eq(blogArticles.id, blogArticleTags.articleId))
      .where(
        and(
          eq(blogArticles.status, "published"),
          inArray(blogArticleTags.tagId, tagIds),
          not(eq(blogArticles.id, articleId))
        )
      )
      .orderBy(desc(blogArticles.publishedAt))
      .limit(limit);
  }

  // 重複排除してマージ
  const seen = new Set<number>();
  const merged: any[] = [];
  for (const a of [...sameCategoryArticles, ...sameTagArticles]) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      merged.push(a);
    }
  }

  return merged.slice(0, limit);
}

/**
 * カテゴリハブ用：カテゴリごとの記事数を取得
 */
export async function getBlogCategoryArticleCounts(): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) return {};

  const results = await db
    .select({
      categoryId: blogArticles.categoryId,
      count: sql<number>`COUNT(*)`,
    })
    .from(blogArticles)
    .where(
      and(
        eq(blogArticles.status, "published"),
        sql`${blogArticles.categoryId} IS NOT NULL`
      )
    )
    .groupBy(blogArticles.categoryId);

  const counts: Record<number, number> = {};
  for (const r of results) {
    if (r.categoryId) counts[r.categoryId] = Number(r.count);
  }
  return counts;
}

/**
 * タグハブ用：タグごとの記事数を取得
 */
export async function getBlogTagArticleCounts(): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) return {};

  const results = await db
    .select({
      tagId: blogArticleTags.tagId,
      count: sql<number>`COUNT(DISTINCT ${blogArticleTags.articleId})`,
    })
    .from(blogArticleTags)
    .innerJoin(blogArticles, eq(blogArticleTags.articleId, blogArticles.id))
    .where(eq(blogArticles.status, "published"))
    .groupBy(blogArticleTags.tagId);

  const counts: Record<number, number> = {};
  for (const r of results) {
    counts[r.tagId] = Number(r.count);
  }
  return counts;
}

/**
 * 商品の平均評価・レビュー数を一括取得（記事内商品カード用）
 */
export async function getProductReviewStatsForIds(productIds: number[]): Promise<Record<number, { avgRating: number; totalReviews: number }>> {
  const db = await getDb();
  if (!db) return {};
  if (productIds.length === 0) return {};

  const stats = await db
    .select({
      productId: mallProductReviews.productId,
      avgRating: sql<number>`AVG(${mallProductReviews.rating})`,
      totalReviews: sql<number>`COUNT(*)`,
    })
    .from(mallProductReviews)
    .where(inArray(mallProductReviews.productId, productIds))
    .groupBy(mallProductReviews.productId);

  const result: Record<number, { avgRating: number; totalReviews: number }> = {};
  for (const s of stats) {
    result[s.productId] = {
      avgRating: Number(s.avgRating) || 0,
      totalReviews: Number(s.totalReviews) || 0,
    };
  }
  return result;
}

/**
 * ブログ記事用：商品データ + レビュー統計 + 購入者数を一括取得
 */
export async function getProductDataForBlogArticle(productIds: number[]): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  if (productIds.length === 0) return [];

  const reviewStats = await getProductReviewStatsForIds(productIds);
  const buyerCounts = await getAllMallProductBuyerCounts();

  const products = await db
    .select({
      id: mallProducts.id,
      name: mallProducts.name,
      price: mallProducts.price,
      pointPrice: mallProducts.pointPrice,
      imageUrl: mallProducts.imageUrl,
      description: mallProducts.description,
      brandName: mallBrands.name,
      categoryName: mallCategories.name,
    })
    .from(mallProducts)
    .leftJoin(mallBrands, eq(mallProducts.brandId, mallBrands.id))
    .leftJoin(mallCategories, eq(mallProducts.categoryId, mallCategories.id))
    .where(inArray(mallProducts.id, productIds));

  return products.map(p => ({
    ...p,
    avgRating: reviewStats[p.id]?.avgRating || 0,
    totalReviews: reviewStats[p.id]?.totalReviews || 0,
    buyerCount: buyerCounts[p.id] || 0,
  }));
}


// ============================================
// ブランドページ用ヘルパー関数
// ============================================

/**
 * アクティブなMALLブランド一覧（商品数・注文数付き）
 */
export async function getActiveMallBrandsWithStats() {
  const db = await getDb();
  if (!db) return [];

  const allBrands = await db
    .select()
    .from(mallBrands)
    .where(eq(mallBrands.isActive, "yes"))
    .orderBy(asc(mallBrands.sortOrder), asc(mallBrands.name));

  const brandsWithStats = await Promise.all(
    allBrands.map(async (brand) => {
      // 商品数
      const productCountResult = await db!
        .select({ count: sql<number>`COUNT(*)` })
        .from(mallProducts)
        .where(and(eq(mallProducts.brandId, brand.id), eq(mallProducts.status, "active")));
      const productCount = productCountResult[0]?.count || 0;

      // 注文数（購入者数の代わり）
      const orderCountResult = await db!
        .select({ count: sql<number>`COUNT(DISTINCT ${mallOrders.id})` })
        .from(mallOrderItems)
        .innerJoin(mallOrders, eq(mallOrderItems.orderId, mallOrders.id))
        .innerJoin(mallProducts, eq(mallOrderItems.productId, mallProducts.id))
        .where(eq(mallProducts.brandId, brand.id));
      const orderCount = orderCountResult[0]?.count || 0;

      // レビュー平均
      const reviewResult = await db!
        .select({
          avgRating: sql<number>`COALESCE(AVG(${mallProductReviews.rating}), 0)`,
          reviewCount: sql<number>`COUNT(*)`,
        })
        .from(mallProductReviews)
        .innerJoin(mallProducts, eq(mallProductReviews.productId, mallProducts.id))
        .where(eq(mallProducts.brandId, brand.id));
      const avgRating = Number(reviewResult[0]?.avgRating || 0);
      const reviewCount = reviewResult[0]?.reviewCount || 0;

      return {
        ...brand,
        productCount,
        orderCount,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount,
      };
    })
  );

  return brandsWithStats;
}

/**
 * ブランドに関連するブログ記事を取得（ブランド名・商品名で記事を検索）
 */
export async function getBlogArticlesByBrand(brandId: number, limit: number = 10) {
  const db = await getDb();
  if (!db) return [];

  // ブランド情報を取得
  const brand = await db
    .select()
    .from(mallBrands)
    .where(eq(mallBrands.id, brandId))
    .limit(1);
  if (brand.length === 0) return [];

  const brandName = brand[0].name;

  // ブランドの商品名を取得
  const products = await db
    .select({ name: mallProducts.name })
    .from(mallProducts)
    .where(and(eq(mallProducts.brandId, brandId), eq(mallProducts.status, "active")))
    .limit(20);

  // ブランド名または商品名がcontentHtmlに含まれる記事を検索
  const searchTerms = [brandName, ...products.map((p) => p.name)];
  const conditions = searchTerms.map((term) =>
    like(blogArticles.contentHtml, `%${term}%`)
  );

  const articles = await db
    .select({
      id: blogArticles.id,
      title: blogArticles.title,
      slug: blogArticles.slug,
      excerpt: blogArticles.excerpt,
      coverImageUrl: blogArticles.coverImageUrl,
      publishedAt: blogArticles.publishedAt,
      viewCount: blogArticles.viewCount,
      categoryId: blogArticles.categoryId,
    })
    .from(blogArticles)
    .where(
      and(
        eq(blogArticles.status, "published"),
        or(...conditions)
      )
    )
    .orderBy(desc(blogArticles.publishedAt))
    .limit(limit);

  return articles;
}

/**
 * ブランドの全体レビュー一覧（最新順）
 */
export async function getMallBrandReviews(brandId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: mallProductReviews.id,
      productId: mallProductReviews.productId,
      productName: mallProducts.name,
      productImageUrl: mallProducts.imageUrl,
      rating: mallProductReviews.rating,
      comment: mallProductReviews.content,
      imageUrl: mallProductReviews.imageUrls,
      createdAt: mallProductReviews.createdAt,
    })
    .from(mallProductReviews)
    .innerJoin(mallProducts, eq(mallProductReviews.productId, mallProducts.id))
    .where(eq(mallProducts.brandId, brandId))
    .orderBy(desc(mallProductReviews.createdAt))
    .limit(limit);
}


// ============================================================
// Point Expiration System (3-month individual expiry)
// ============================================================

const POINT_EXPIRY_MONTHS = 3;
const POINT_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // ~3 months in ms

/**
 * Get the valid (non-expired) point balance for a web user.
 * Sums remainingAmount from earn/refund transactions that haven't expired yet.
 */
export async function getValidPointBalance(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${pointTransactions.remainingAmount}), 0)` })
    .from(pointTransactions)
    .where(and(
      eq(pointTransactions.userId, userId),
      or(eq(pointTransactions.type, "earn"), eq(pointTransactions.type, "refund")),
      eq(pointTransactions.expired, 0),
      gt(pointTransactions.expiresAt, new Date()),
      gt(pointTransactions.remainingAmount, 0)
    ));
  
  return Number(result[0]?.total ?? 0);
}

/**
 * Get the valid (non-expired) point balance for a LINE user.
 */
export async function getValidLinePointBalance(lineUserId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${linePointTransactions.remainingAmount}), 0)` })
    .from(linePointTransactions)
    .where(and(
      eq(linePointTransactions.lineUserId, lineUserId),
      or(eq(linePointTransactions.type, "earn"), eq(linePointTransactions.type, "refund")),
      eq(linePointTransactions.expired, 0),
      gt(linePointTransactions.expiresAt, new Date()),
      gt(linePointTransactions.remainingAmount, 0)
    ));
  
  return Number(result[0]?.total ?? 0);
}

/**
 * Get points expiring soon for a web user.
 * Returns breakdown by expiry date.
 */
export async function getExpiringPoints(userId: number): Promise<{
  expiringIn7Days: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  breakdown: Array<{ expiresAt: Date; amount: number }>;
}> {
  const db = await getDb();
  if (!db) return { expiringIn7Days: 0, expiringIn30Days: 0, expiringIn60Days: 0, breakdown: [] };
  
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  
  const activeEarns = await db
    .select({
      expiresAt: pointTransactions.expiresAt,
      remainingAmount: pointTransactions.remainingAmount,
    })
    .from(pointTransactions)
    .where(and(
      eq(pointTransactions.userId, userId),
      or(eq(pointTransactions.type, "earn"), eq(pointTransactions.type, "refund")),
      eq(pointTransactions.expired, 0),
      gt(pointTransactions.expiresAt, now),
      gt(pointTransactions.remainingAmount, 0)
    ))
    .orderBy(asc(pointTransactions.expiresAt));
  
  let expiringIn7Days = 0;
  let expiringIn30Days = 0;
  let expiringIn60Days = 0;
  const breakdown: Array<{ expiresAt: Date; amount: number }> = [];
  
  for (const row of activeEarns) {
    if (!row.expiresAt || !row.remainingAmount) continue;
    const amt = Number(row.remainingAmount);
    if (row.expiresAt <= in7Days) expiringIn7Days += amt;
    if (row.expiresAt <= in30Days) expiringIn30Days += amt;
    if (row.expiresAt <= in60Days) expiringIn60Days += amt;
    breakdown.push({ expiresAt: row.expiresAt, amount: amt });
  }
  
  return { expiringIn7Days, expiringIn30Days, expiringIn60Days, breakdown };
}

/**
 * Get points expiring soon for a LINE user.
 */
export async function getExpiringLinePoints(lineUserId: string): Promise<{
  expiringIn7Days: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  breakdown: Array<{ expiresAt: Date; amount: number }>;
}> {
  const db = await getDb();
  if (!db) return { expiringIn7Days: 0, expiringIn30Days: 0, expiringIn60Days: 0, breakdown: [] };
  
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  
  const activeEarns = await db
    .select({
      expiresAt: linePointTransactions.expiresAt,
      remainingAmount: linePointTransactions.remainingAmount,
    })
    .from(linePointTransactions)
    .where(and(
      eq(linePointTransactions.lineUserId, lineUserId),
      or(eq(linePointTransactions.type, "earn"), eq(linePointTransactions.type, "refund")),
      eq(linePointTransactions.expired, 0),
      gt(linePointTransactions.expiresAt, now),
      gt(linePointTransactions.remainingAmount, 0)
    ))
    .orderBy(asc(linePointTransactions.expiresAt));
  
  let expiringIn7Days = 0;
  let expiringIn30Days = 0;
  let expiringIn60Days = 0;
  const breakdown: Array<{ expiresAt: Date; amount: number }> = [];
  
  for (const row of activeEarns) {
    if (!row.expiresAt || !row.remainingAmount) continue;
    const amt = Number(row.remainingAmount);
    if (row.expiresAt <= in7Days) expiringIn7Days += amt;
    if (row.expiresAt <= in30Days) expiringIn30Days += amt;
    if (row.expiresAt <= in60Days) expiringIn60Days += amt;
    breakdown.push({ expiresAt: row.expiresAt, amount: amt });
  }
  
  return { expiringIn7Days, expiringIn30Days, expiringIn60Days, breakdown };
}

/**
 * Process expired points for all web users.
 * Marks expired earn transactions and deducts from balances.
 * Returns number of users affected.
 */
export async function processExpiredPoints(): Promise<{ usersAffected: number; totalExpired: number }> {
  const db = await getDb();
  if (!db) return { usersAffected: 0, totalExpired: 0 };
  
  const now = new Date();
  
  // Find all expired but unprocessed earn transactions
  const expiredTxns = await db
    .select({
      id: pointTransactions.id,
      userId: pointTransactions.userId,
      remainingAmount: pointTransactions.remainingAmount,
    })
    .from(pointTransactions)
    .where(and(
      or(eq(pointTransactions.type, "earn"), eq(pointTransactions.type, "refund")),
      eq(pointTransactions.expired, 0),
      lte(pointTransactions.expiresAt, now),
      gt(pointTransactions.remainingAmount, 0)
    ));
  
  if (expiredTxns.length === 0) return { usersAffected: 0, totalExpired: 0 };
  
  // Group by user
  const userExpiry = new Map<number, number>();
  for (const txn of expiredTxns) {
    const amt = Number(txn.remainingAmount ?? 0);
    userExpiry.set(txn.userId, (userExpiry.get(txn.userId) ?? 0) + amt);
    
    // Mark as expired
    await db.update(pointTransactions)
      .set({ expired: 1, remainingAmount: 0 })
      .where(eq(pointTransactions.id, txn.id));
  }
  
  let totalExpired = 0;
  
  // Deduct from each user's balance and create expire transaction
  for (const [userId, expiredAmount] of userExpiry) {
    totalExpired += expiredAmount;
    
    const balance = await getOrCreatePointBalance(userId);
    const newBalance = Math.max(0, balance.balance - expiredAmount);
    
    // Create expire transaction
    await db.insert(pointTransactions).values({
      userId,
      type: "expire",
      amount: -expiredAmount,
      balanceAfter: newBalance,
      referenceType: "system",
      description: `ポイント失効（有効期限${POINT_EXPIRY_MONTHS}ヶ月）`,
    });
    
    // Update balance (atomic SQL decrement to prevent race conditions)
    await db.update(pointBalances)
      .set({ balance: sql`GREATEST(${pointBalances.balance} - ${expiredAmount}, 0)` })
      .where(eq(pointBalances.userId, userId));
  }
  
  return { usersAffected: userExpiry.size, totalExpired };
}

/**
 * Process expired points for all LINE users.
 */
export async function processExpiredLinePoints(): Promise<{ usersAffected: number; totalExpired: number }> {
  const db = await getDb();
  if (!db) return { usersAffected: 0, totalExpired: 0 };
  
  const now = new Date();
  
  const expiredTxns = await db
    .select({
      id: linePointTransactions.id,
      lineUserId: linePointTransactions.lineUserId,
      remainingAmount: linePointTransactions.remainingAmount,
    })
    .from(linePointTransactions)
    .where(and(
      or(eq(linePointTransactions.type, "earn"), eq(linePointTransactions.type, "refund")),
      eq(linePointTransactions.expired, 0),
      lte(linePointTransactions.expiresAt, now),
      gt(linePointTransactions.remainingAmount, 0)
    ));
  
  if (expiredTxns.length === 0) return { usersAffected: 0, totalExpired: 0 };
  
  const userExpiry = new Map<string, number>();
  for (const txn of expiredTxns) {
    const amt = Number(txn.remainingAmount ?? 0);
    userExpiry.set(txn.lineUserId, (userExpiry.get(txn.lineUserId) ?? 0) + amt);
    
    await db.update(linePointTransactions)
      .set({ expired: 1, remainingAmount: 0 })
      .where(eq(linePointTransactions.id, txn.id));
  }
  
  let totalExpired = 0;
  
  for (const [lineUserId, expiredAmount] of userExpiry) {
    totalExpired += expiredAmount;
    
    const balance = await getOrCreateLinePointBalance(lineUserId);
    const newBalance = Math.max(0, balance.balance - expiredAmount);
    
    await db.insert(linePointTransactions).values({
      lineUserId,
      type: "expire",
      amount: -expiredAmount,
      balanceAfter: newBalance,
      referenceType: "system",
      description: `ポイント失効（有効期限${POINT_EXPIRY_MONTHS}ヶ月）`,
    });
    
    // Atomic SQL decrement to prevent race conditions
    await db.update(linePointBalances)
      .set({ balance: sql`GREATEST(${linePointBalances.balance} - ${expiredAmount}, 0)` })
      .where(eq(linePointBalances.lineUserId, lineUserId));
  }
  
  return { usersAffected: userExpiry.size, totalExpired };
}

/**
 * Use points with FIFO (oldest expiring first) for web user.
 * Deducts from earn transactions with earliest expiresAt first.
 */
export async function usePointsFIFO(userId: number, amount: number, description: string, referenceId?: number): Promise<{ success: boolean; balanceAfter: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check valid balance
  const validBalance = await getValidPointBalance(userId);
  if (validBalance < amount) {
    return { success: false, balanceAfter: validBalance };
  }
  
  // Get active earn transactions ordered by expiresAt (FIFO - oldest first)
  const activeEarns = await db
    .select()
    .from(pointTransactions)
    .where(and(
      eq(pointTransactions.userId, userId),
      or(eq(pointTransactions.type, "earn"), eq(pointTransactions.type, "refund")),
      eq(pointTransactions.expired, 0),
      gt(pointTransactions.expiresAt, new Date()),
      gt(pointTransactions.remainingAmount, 0)
    ))
    .orderBy(asc(pointTransactions.expiresAt));
  
  let remaining = amount;
  for (const earn of activeEarns) {
    if (remaining <= 0) break;
    const available = Number(earn.remainingAmount ?? 0);
    const deduct = Math.min(available, remaining);
    
    await db.update(pointTransactions)
      .set({ remainingAmount: available - deduct })
      .where(eq(pointTransactions.id, earn.id));
    
    remaining -= deduct;
  }
  
  // Update balance (atomic SQL increment to prevent race conditions)
  await db.update(pointBalances)
    .set({ 
      balance: sql`${pointBalances.balance} - ${amount}`,
      totalUsed: sql`${pointBalances.totalUsed} + ${amount}`,
    })
    .where(eq(pointBalances.userId, userId));
  
  // Create use transaction
  await db.insert(pointTransactions).values({
    userId,
    type: "use",
    amount: -amount,
    balanceAfter: newBalance,
    referenceType: "order",
    referenceId,
    description,
  });
  
  return { success: true, balanceAfter: newBalance };
}

/**
 * Use points with FIFO for LINE user.
 */
export async function useLinePointsFIFO(lineUserId: string, amount: number, description: string, referenceId?: number): Promise<{ success: boolean; balanceAfter: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const validBalance = await getValidLinePointBalance(lineUserId);
  if (validBalance < amount) {
    return { success: false, balanceAfter: validBalance };
  }
  
  const activeEarns = await db
    .select()
    .from(linePointTransactions)
    .where(and(
      eq(linePointTransactions.lineUserId, lineUserId),
      or(eq(linePointTransactions.type, "earn"), eq(linePointTransactions.type, "refund")),
      eq(linePointTransactions.expired, 0),
      gt(linePointTransactions.expiresAt, new Date()),
      gt(linePointTransactions.remainingAmount, 0)
    ))
    .orderBy(asc(linePointTransactions.expiresAt));
  
  let remaining = amount;
  for (const earn of activeEarns) {
    if (remaining <= 0) break;
    const available = Number(earn.remainingAmount ?? 0);
    const deduct = Math.min(available, remaining);
    
    await db.update(linePointTransactions)
      .set({ remainingAmount: available - deduct })
      .where(eq(linePointTransactions.id, earn.id));
    
    remaining -= deduct;
  }
  
  // Update balance (atomic SQL increment to prevent race conditions)
  await db.update(linePointBalances)
    .set({ 
      balance: sql`${linePointBalances.balance} - ${amount}`,
      totalUsed: sql`${linePointBalances.totalUsed} + ${amount}`,
    })
    .where(eq(linePointBalances.lineUserId, lineUserId));
  
  await db.insert(linePointTransactions).values({
    lineUserId,
    type: "use",
    amount: -amount,
    balanceAfter: newBalance,
    referenceType: "order",
    referenceId,
    description,
  });
  
  return { success: true, balanceAfter: newBalance };
}

/**
 * Get users with points expiring within a given number of days (for LINE notification).
 * Returns LINE users who have points expiring soon.
 */
export async function getLineUsersWithExpiringPoints(withinDays: number): Promise<Array<{
  lineUserId: string;
  expiringAmount: number;
  earliestExpiry: Date;
}>> {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const deadline = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  
  const results = await db
    .select({
      lineUserId: linePointTransactions.lineUserId,
      expiringAmount: sql<number>`COALESCE(SUM(${linePointTransactions.remainingAmount}), 0)`,
      earliestExpiry: sql<Date>`MIN(${linePointTransactions.expiresAt})`,
    })
    .from(linePointTransactions)
    .where(and(
      or(eq(linePointTransactions.type, "earn"), eq(linePointTransactions.type, "refund")),
      eq(linePointTransactions.expired, 0),
      gt(linePointTransactions.expiresAt, now),
      lte(linePointTransactions.expiresAt, deadline),
      gt(linePointTransactions.remainingAmount, 0)
    ))
    .groupBy(linePointTransactions.lineUserId);
  
  return results.map(r => ({
    lineUserId: r.lineUserId,
    expiringAmount: Number(r.expiringAmount),
    earliestExpiry: r.earliestExpiry,
  }));
}


// ============================================
// レシート確変チャンス＋購入証明付きレビュー DB関数
// ============================================

/**
 * 確変チャンス結果を保存
 */
export async function createKakuhenResult(data: InsertReceiptKakuhenResult): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(receiptKakuhenResults).values(data);
  return result[0].insertId;
}

/**
 * 確変チャンス結果を取得（ID）
 */
export async function getKakuhenResultById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(receiptKakuhenResults).where(eq(receiptKakuhenResults.id, id));
  return rows[0] || null;
}

/**
 * ユーザーの確変チャンス履歴を取得
 */
export async function getKakuhenResultsByUserId(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(receiptKakuhenResults)
    .where(eq(receiptKakuhenResults.userId, userId))
    .orderBy(desc(receiptKakuhenResults.createdAt))
    .limit(limit);
}

/**
 * LINEユーザーの確変チャンス履歴を取得
 */
export async function getKakuhenResultsByLineUserId(lineUserId: string, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(receiptKakuhenResults)
    .where(eq(receiptKakuhenResults.lineUserId, lineUserId))
    .orderBy(desc(receiptKakuhenResults.createdAt))
    .limit(limit);
}

/**
 * 全額還元（ジャックポット）当選者一覧を取得
 */
export async function getJackpotWinners(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(receiptKakuhenResults)
    .where(eq(receiptKakuhenResults.isJackpot, true))
    .orderBy(desc(receiptKakuhenResults.createdAt))
    .limit(limit);
}

/**
 * 確変チャンスの統計を取得
 */
export async function getKakuhenStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const stats = await db.select({
    totalPlays: sql<number>`COUNT(*)`,
    kakuhenCount: sql<number>`SUM(CASE WHEN isKakuhen = true THEN 1 ELSE 0 END)`,
    jackpotCount: sql<number>`SUM(CASE WHEN isJackpot = true THEN 1 ELSE 0 END)`,
    totalBasePoints: sql<number>`SUM(basePoints)`,
    totalActualPoints: sql<number>`SUM(actualPoints)`,
    totalBonusPoints: sql<number>`SUM(bonusPoints)`,
  }).from(receiptKakuhenResults);
  return stats[0];
}

// ===== 購入証明付きレビュー =====

/**
 * レビューを作成
 */
export async function createReceiptReview(data: InsertReceiptReview): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(receiptReviews).values(data);
  return result[0].insertId;
}

/**
 * レビューを取得（ID）
 */
export async function getReceiptReviewById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(receiptReviews).where(eq(receiptReviews.id, id));
  return rows[0] || null;
}

/**
 * 商品名でレビューを検索（部分一致）
 */
export async function searchReceiptReviewsByProduct(productName: string, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({
    id: receiptReviews.id,
    receiptId: receiptReviews.receiptId,
    userId: receiptReviews.userId,
    lineUserId: receiptReviews.lineUserId,
    productName: receiptReviews.productName,
    brandName: receiptReviews.brandName,
    shopName: receiptReviews.shopName,
    category: receiptReviews.category,
    purchaseAmount: receiptReviews.purchaseAmount,
    purchasePlatform: receiptReviews.purchasePlatform,
    rating: receiptReviews.rating,
    reviewText: receiptReviews.reviewText,
    isVisible: receiptReviews.isVisible,
    helpfulCount: receiptReviews.helpfulCount,
    tags: receiptReviews.tags,
    // receiptImageUrl is excluded for privacy protection
    productImageUrl: receiptReviews.productImageUrl,
    videoUrl: receiptReviews.videoUrl,
    tiktokUrl: receiptReviews.tiktokUrl,
    liveCommerceUrl: receiptReviews.liveCommerceUrl,
    createdAt: receiptReviews.createdAt,
    updatedAt: receiptReviews.updatedAt,
  }).from(receiptReviews)
    .where(and(
      like(receiptReviews.productName, `%${productName}%`),
      eq(receiptReviews.isVisible, true)
    ))
    .orderBy(desc(receiptReviews.createdAt))
    .limit(limit);
}

/**
 * 最新のレビュー一覧を取得
 */
export async function getLatestReceiptReviews(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({
    id: receiptReviews.id,
    receiptId: receiptReviews.receiptId,
    userId: receiptReviews.userId,
    lineUserId: receiptReviews.lineUserId,
    productName: receiptReviews.productName,
    brandName: receiptReviews.brandName,
    shopName: receiptReviews.shopName,
    category: receiptReviews.category,
    purchaseAmount: receiptReviews.purchaseAmount,
    purchasePlatform: receiptReviews.purchasePlatform,
    rating: receiptReviews.rating,
    reviewText: receiptReviews.reviewText,
    isVisible: receiptReviews.isVisible,
    helpfulCount: receiptReviews.helpfulCount,
    tags: receiptReviews.tags,
    // receiptImageUrl is excluded for privacy protection
    productImageUrl: receiptReviews.productImageUrl,
    videoUrl: receiptReviews.videoUrl,
    tiktokUrl: receiptReviews.tiktokUrl,
    liveCommerceUrl: receiptReviews.liveCommerceUrl,
    createdAt: receiptReviews.createdAt,
    updatedAt: receiptReviews.updatedAt,
  }).from(receiptReviews)
    .where(eq(receiptReviews.isVisible, true))
    .orderBy(desc(receiptReviews.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * ユーザーのレビュー一覧を取得
 */
export async function getReceiptReviewsByUserId(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(receiptReviews)
    .where(eq(receiptReviews.userId, userId))
    .orderBy(desc(receiptReviews.createdAt))
    .limit(limit);
}

/**
 * LINEユーザーのレビュー一覧を取得
 */
export async function getReceiptReviewsByLineUserId(lineUserId: string, limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(receiptReviews)
    .where(eq(receiptReviews.lineUserId, lineUserId))
    .orderBy(desc(receiptReviews.createdAt))
    .limit(limit);
}

/**
 * レビューの「参考になった」をインクリメント
 */
export async function incrementReviewHelpful(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(receiptReviews)
    .set({ helpfulCount: sql`helpfulCount + 1` })
    .where(eq(receiptReviews.id, reviewId));
}

/**
 * レビューを通報
 */
export async function reportReceiptReview(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(receiptReviews)
    .set({ reportCount: sql`reportCount + 1` })
    .where(eq(receiptReviews.id, reviewId));
  
  // 通報が3件以上で自動非表示
  const review = await getReceiptReviewById(reviewId);
  if (review && review.reportCount >= 3) {
    await db.update(receiptReviews)
      .set({ isVisible: false })
      .where(eq(receiptReviews.id, reviewId));
  }
}

/**
 * レビュー統計を取得
 */
export async function getReceiptReviewStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const stats = await db.select({
    totalReviews: sql<number>`COUNT(*)`,
    avgRating: sql<number>`AVG(rating)`,
    fiveStarCount: sql<number>`SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)`,
    fourStarCount: sql<number>`SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)`,
    threeStarCount: sql<number>`SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)`,
    twoStarCount: sql<number>`SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)`,
    oneStarCount: sql<number>`SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)`,
  }).from(receiptReviews).where(eq(receiptReviews.isVisible, true));
  return stats[0];
}

/**
 * 商品別のレビュー統計を取得（人気商品ランキング用）
 */
export async function getProductReviewRanking(limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({
    productName: receiptReviews.productName,
    brandName: receiptReviews.brandName,
    category: receiptReviews.category,
    reviewCount: sql<number>`COUNT(*)`,
    avgRating: sql<number>`ROUND(AVG(rating), 1)`,
    totalHelpful: sql<number>`SUM(helpfulCount)`,
  }).from(receiptReviews)
    .where(eq(receiptReviews.isVisible, true))
    .groupBy(receiptReviews.productName, receiptReviews.brandName, receiptReviews.category)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
}

/**
 * レビュー総数を取得
 */
export async function getReceiptReviewCount() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(receiptReviews).where(eq(receiptReviews.isVisible, true));
  return result[0]?.count || 0;
}


// ===== 管理用レビュー一覧取得（ページネーション・ソート・検索対応） =====

export async function getAdminReceiptReviews(options: {
  query?: string;
  page: number;
  limit: number;
  sortBy: "newest" | "oldest" | "highest" | "lowest";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [];
  if (options.query && options.query.trim().length > 0) {
    conditions.push(like(receiptReviews.productName, `%${options.query}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const orderByClause = options.sortBy === "oldest"
    ? asc(receiptReviews.createdAt)
    : options.sortBy === "highest"
    ? desc(receiptReviews.rating)
    : options.sortBy === "lowest"
    ? asc(receiptReviews.rating)
    : desc(receiptReviews.createdAt);

  const offset = (options.page - 1) * options.limit;

  const reviews = await db.select().from(receiptReviews)
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(options.limit)
    .offset(offset);

  const countResult = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(receiptReviews).where(whereClause);

  return {
    reviews,
    totalCount: countResult[0]?.count || 0,
  };
}

// ===== 管理用Kakuhen統計（avgBoostRate, totalBoostedPoints追加） =====

export async function getKakuhenAdminStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const stats = await db.select({
    totalPlays: sql<number>`COUNT(*)`,
    kakuhenCount: sql<number>`SUM(CASE WHEN isKakuhen = true THEN 1 ELSE 0 END)`,
    jackpotCount: sql<number>`SUM(CASE WHEN isJackpot = true THEN 1 ELSE 0 END)`,
    avgBoostRate: sql<number>`ROUND(AVG(CAST(boostedRate AS DECIMAL(5,2))), 2)`,
    totalBoostedPoints: sql<number>`SUM(bonusPoints)`,
    totalBasePoints: sql<number>`SUM(basePoints)`,
    totalActualPoints: sql<number>`SUM(actualPoints)`,
    totalBonusPoints: sql<number>`SUM(bonusPoints)`,
    totalOrderAmount: sql<number>`SUM(orderAmount)`,
  }).from(receiptKakuhenResults);
  return stats[0];
}


// ===== 動画フィード取得（動画URL付きレビュー） =====
export async function getVideoReviews(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({
    id: receiptReviews.id,
    productName: receiptReviews.productName,
    brandName: receiptReviews.brandName,
    rating: receiptReviews.rating,
    reviewText: receiptReviews.reviewText,
    productImageUrl: receiptReviews.productImageUrl,
    videoUrl: receiptReviews.videoUrl,
    tiktokUrl: receiptReviews.tiktokUrl,
    liveCommerceUrl: receiptReviews.liveCommerceUrl,
    purchasePlatform: receiptReviews.purchasePlatform,
    createdAt: receiptReviews.createdAt,
  }).from(receiptReviews)
    .where(and(
      eq(receiptReviews.isVisible, true),
      or(
        isNotNull(receiptReviews.tiktokUrl),
        isNotNull(receiptReviews.videoUrl),
        isNotNull(receiptReviews.liveCommerceUrl)
      )
    ))
    .orderBy(desc(receiptReviews.createdAt))
    .limit(limit);
}

// ===== リアクション関連 =====
export async function addReviewReaction(data: InsertReviewReaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reviewReactions).values(data);
}

export async function removeReviewReaction(reviewId: number, userId: number | null, lineUserId: string | null, reactionType: "bought" | "want") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [
    eq(reviewReactions.reviewId, reviewId),
    eq(reviewReactions.reactionType, reactionType),
  ];
  if (userId) conditions.push(eq(reviewReactions.userId, userId));
  if (lineUserId) conditions.push(eq(reviewReactions.lineUserId, lineUserId));
  await db.delete(reviewReactions).where(and(...conditions));
}

export async function getReviewReactionCounts(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const counts = await db.select({
    reactionType: reviewReactions.reactionType,
    count: sql<number>`COUNT(*)`,
  }).from(reviewReactions)
    .where(eq(reviewReactions.reviewId, reviewId))
    .groupBy(reviewReactions.reactionType);
  
  const result = { bought: 0, want: 0 };
  for (const row of counts) {
    if (row.reactionType === "bought") result.bought = row.count;
    if (row.reactionType === "want") result.want = row.count;
  }
  return result;
}

export async function getReviewReactionCountsBatch(reviewIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (reviewIds.length === 0) return {};
  const counts = await db.select({
    reviewId: reviewReactions.reviewId,
    reactionType: reviewReactions.reactionType,
    count: sql<number>`COUNT(*)`,
  }).from(reviewReactions)
    .where(inArray(reviewReactions.reviewId, reviewIds))
    .groupBy(reviewReactions.reviewId, reviewReactions.reactionType);
  
  const result: Record<number, { bought: number; want: number }> = {};
  for (const row of counts) {
    if (!result[row.reviewId]) result[row.reviewId] = { bought: 0, want: 0 };
    if (row.reactionType === "bought") result[row.reviewId].bought = row.count;
    if (row.reactionType === "want") result[row.reviewId].want = row.count;
  }
  return result;
}

export async function getUserReactions(reviewIds: number[], userId: number | null, lineUserId: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (reviewIds.length === 0 || (!userId && !lineUserId)) return {};
  const conditions = [inArray(reviewReactions.reviewId, reviewIds)];
  if (userId) conditions.push(eq(reviewReactions.userId, userId));
  if (lineUserId) conditions.push(eq(reviewReactions.lineUserId, lineUserId));
  
  const rows = await db.select({
    reviewId: reviewReactions.reviewId,
    reactionType: reviewReactions.reactionType,
  }).from(reviewReactions).where(and(...conditions));
  
  const result: Record<number, { bought: boolean; want: boolean }> = {};
  for (const row of rows) {
    if (!result[row.reviewId]) result[row.reviewId] = { bought: false, want: false };
    if (row.reactionType === "bought") result[row.reviewId].bought = true;
    if (row.reactionType === "want") result[row.reviewId].want = true;
  }
  return result;
}

// ===== Q&A関連 =====
export async function createReviewQuestion(data: InsertReviewQuestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviewQuestions).values(data);
  return result[0].insertId;
}

export async function answerReviewQuestion(questionId: number, answerUserId: number | null, answerLineUserId: string | null, answerText: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reviewQuestions).set({
    answerUserId,
    answerLineUserId,
    answerText,
    answeredAt: new Date(),
  }).where(eq(reviewQuestions.id, questionId));
}

export async function getReviewQuestions(reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(reviewQuestions)
    .where(and(eq(reviewQuestions.reviewId, reviewId), eq(reviewQuestions.isVisible, true)))
    .orderBy(desc(reviewQuestions.createdAt));
}

export async function getProductQuestions(productName: string, limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(reviewQuestions)
    .where(and(eq(reviewQuestions.productName, productName), eq(reviewQuestions.isVisible, true)))
    .orderBy(desc(reviewQuestions.createdAt))
    .limit(limit);
}

export async function getLatestQuestions(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select().from(reviewQuestions)
    .where(eq(reviewQuestions.isVisible, true))
    .orderBy(desc(reviewQuestions.createdAt))
    .limit(limit);
}

// ===== レビュアー認証枚数取得 =====
export async function getReviewerCertifiedCounts(userIds: number[], lineUserIds: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result: Record<string, number> = {};
  
  if (userIds.length > 0) {
    const webCounts = await db.select({
      userId: receiptReviews.userId,
      count: sql<number>`COUNT(*)`,
    }).from(receiptReviews)
      .where(and(isNotNull(receiptReviews.userId), inArray(receiptReviews.userId, userIds)))
      .groupBy(receiptReviews.userId);
    for (const row of webCounts) {
      if (row.userId) result[`web_${row.userId}`] = row.count;
    }
  }
  
  if (lineUserIds.length > 0) {
    const lineCounts = await db.select({
      lineUserId: receiptReviews.lineUserId,
      count: sql<number>`COUNT(*)`,
    }).from(receiptReviews)
      .where(and(isNotNull(receiptReviews.lineUserId), inArray(receiptReviews.lineUserId, lineUserIds)))
      .groupBy(receiptReviews.lineUserId);
    for (const row of lineCounts) {
      if (row.lineUserId) result[`line_${row.lineUserId}`] = row.count;
    }
  }
  
  return result;
}

// ===== プラットフォーム分布取得 =====
export async function getPlatformDistribution() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({
    platform: receiptReviews.purchasePlatform,
    count: sql<number>`COUNT(*)`,
  }).from(receiptReviews)
    .where(and(eq(receiptReviews.isVisible, true), isNotNull(receiptReviews.purchasePlatform)))
    .groupBy(receiptReviews.purchasePlatform)
    .orderBy(desc(sql`COUNT(*)`));
}

// ===== 「欲しい！」ランキング =====
export async function getWantRanking(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ranking = await db.select({
    reviewId: reviewReactions.reviewId,
    wantCount: sql<number>`COUNT(*)`,
  }).from(reviewReactions)
    .where(eq(reviewReactions.reactionType, "want"))
    .groupBy(reviewReactions.reviewId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
  
  if (ranking.length === 0) return [];
  
  const reviewIds = ranking.map(r => r.reviewId);
  const reviews = await db.select().from(receiptReviews)
    .where(inArray(receiptReviews.id, reviewIds));
  
  return ranking.map(r => {
    const review = reviews.find(rev => rev.id === r.reviewId);
    return { ...review, wantCount: r.wantCount };
  }).filter(r => r.productName);
}

// ===== 商品別の累積写真を取得 =====
export async function getProductReviewImages(productName: string, limit: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({
    id: receiptReviews.id,
    productImageUrl: receiptReviews.productImageUrl,
    // receiptImageUrl is excluded from public API for privacy protection
    reviewerName: sql<string>`NULL`, // privacy
    rating: receiptReviews.rating,
    createdAt: receiptReviews.createdAt,
  }).from(receiptReviews)
    .where(and(
      eq(receiptReviews.isVisible, true),
      eq(receiptReviews.productName, productName),
      isNotNull(receiptReviews.productImageUrl)
    ))
    .orderBy(desc(receiptReviews.createdAt))
    .limit(limit);
}

// ===== 商品ランキング拡張（商品画像・金額レンジ付き） =====
export async function getProductReviewRankingEnhanced(limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.select({
    productName: receiptReviews.productName,
    brandName: receiptReviews.brandName,
    shopName: receiptReviews.shopName,
    category: receiptReviews.category,
    reviewCount: sql<number>`COUNT(*)`,
    avgRating: sql<number>`ROUND(AVG(rating), 1)`,
    totalHelpful: sql<number>`SUM(helpfulCount)`,
    minPrice: sql<number>`MIN(purchaseAmount)`,
    maxPrice: sql<number>`MAX(purchaseAmount)`,
    // 最新の商品画像を取得
    latestImageUrl: sql<string>`(SELECT productImageUrl FROM receipt_reviews r2 WHERE r2.productName = receipt_reviews.productName AND r2.productImageUrl IS NOT NULL ORDER BY r2.createdAt DESC LIMIT 1)`,
    // 累積写真枚数
    imageCount: sql<number>`SUM(CASE WHEN productImageUrl IS NOT NULL THEN 1 ELSE 0 END)`,
    // 最新3枚の画像URL
    images: sql<string>`(SELECT JSON_ARRAYAGG(img) FROM (SELECT productImageUrl as img FROM receipt_reviews r3 WHERE r3.productName = receipt_reviews.productName AND r3.productImageUrl IS NOT NULL AND r3.isVisible = 1 ORDER BY r3.createdAt DESC LIMIT 3) sub)`,
    // 購入プラットフォーム一覧
    platforms: sql<string>`GROUP_CONCAT(DISTINCT purchasePlatform)`,
  }).from(receiptReviews)
    .where(eq(receiptReviews.isVisible, true))
    .groupBy(receiptReviews.productName, receiptReviews.brandName, receiptReviews.shopName, receiptReviews.category)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
}


// ===== レビュー商品一覧（ユニーク商品名 + レビュー数 + 平均評価） =====
export async function getReviewProductList(options: {
  query?: string;
  page: number;
  limit: number;
  sortBy?: "reviewCount" | "avgRating" | "productName";
  imageFilter?: "all" | "with_image" | "without_image";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const offset = (options.page - 1) * options.limit;
  
  // Build WHERE conditions
  const conditions: any[] = [eq(receiptReviews.isVisible, true)];
  
  if (options.query && options.query.trim()) {
    conditions.push(sql`${receiptReviews.productName} LIKE ${`%${options.query.trim()}%`}`);
  }
  
  // Apply image filter at SQL level
  if (options.imageFilter === "with_image") {
    conditions.push(sql`${receiptReviews.productImageUrl} IS NOT NULL AND ${receiptReviews.productImageUrl} != ''`);
  }
  
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
  
  // Get total unique product count
  const countResult = await db.select({
    count: sql<number>`COUNT(DISTINCT ${receiptReviews.productName})`,
  }).from(receiptReviews).where(whereClause);
  
  const totalCount = Number(countResult[0]?.count || 0);
  
  // Sort order - use full SQL expressions, not aliases
  let orderClause;
  switch (options.sortBy) {
    case "avgRating":
      orderClause = desc(sql`ROUND(AVG(${receiptReviews.rating}), 1)`);
      break;
    case "productName":
      orderClause = asc(sql`MIN(${receiptReviews.productName})`);
      break;
    default:
      orderClause = desc(sql`COUNT(*)`);
  }
  
  // Main query: unique products with stats
  const products = await db.select({
    productName: receiptReviews.productName,
    brandName: sql<string>`MAX(${receiptReviews.brandName})`,
    category: sql<string>`MAX(${receiptReviews.category})`,
    reviewCount: sql<number>`COUNT(*)`,
    avgRating: sql<number>`ROUND(AVG(${receiptReviews.rating}), 1)`,
    latestReviewDate: sql<string>`MAX(${receiptReviews.createdAt})`,
    imageCount: sql<number>`SUM(CASE WHEN ${receiptReviews.productImageUrl} IS NOT NULL AND ${receiptReviews.productImageUrl} != '' THEN 1 ELSE 0 END)`,
    latestImageUrl: sql<string>`MAX(${receiptReviews.productImageUrl})`,
  }).from(receiptReviews)
    .where(whereClause)
    .groupBy(sql`productName`)
    .orderBy(orderClause)
    .limit(options.limit)
    .offset(offset);
  
  // Enrich with product_master data
  const productNames = products.map(p => p.productName).filter(Boolean);
  let masterMap = new Map<string, { id: number; canonicalName: string; imageUrl: string | null; imageStatus: string | null; sourceUrl: string | null }>();
  
  if (productNames.length > 0) {
    try {
      const masters = await db.select({
        id: productMaster.id,
        canonicalName: productMaster.canonicalName,
        imageUrl: productMaster.imageUrl,
        imageStatus: productMaster.imageStatus,
        sourceUrl: productMaster.sourceUrl,
      }).from(productMaster)
        .where(sql`${productMaster.canonicalName} IN (${sql.join(productNames.map(n => sql`${n}`), sql`, `)})`);
      
      for (const m of masters) {
        masterMap.set(m.canonicalName, m);
      }
    } catch (e) {
      console.error('[getReviewProductList] product_master lookup failed:', e);
    }
  }
  
  const cleanProducts = products.map(p => {
    const master = masterMap.get(p.productName);
    return {
      productName: p.productName,
      brandName: p.brandName,
      category: p.category,
      reviewCount: Number(p.reviewCount || 0),
      avgRating: Number(p.avgRating || 0),
      latestReviewDate: p.latestReviewDate,
      imageCount: Number(p.imageCount || 0),
      latestImageUrl: p.latestImageUrl || null,
      productMasterId: master?.id || null,
      masterCanonicalName: master?.canonicalName || null,
      masterImageUrl: master?.imageUrl || null,
      masterImageStatus: master?.imageStatus || null,
      masterSourceUrl: master?.sourceUrl || null,
    };
  });
  
  // For "without_image" filter, we need products where NO review has an image
  // This is handled at SQL level for with_image, but without_image needs HAVING
  if (options.imageFilter === "without_image") {
    // Re-query with HAVING clause for without_image
    const noImageConditions: any[] = [eq(receiptReviews.isVisible, true)];
    if (options.query && options.query.trim()) {
      noImageConditions.push(sql`${receiptReviews.productName} LIKE ${`%${options.query.trim()}%`}`);
    }
    const noImageWhere = noImageConditions.length > 1 ? and(...noImageConditions) : noImageConditions[0];
    
    const noImageProducts = await db.select({
      productName: receiptReviews.productName,
      brandName: sql<string>`MAX(${receiptReviews.brandName})`,
      category: sql<string>`MAX(${receiptReviews.category})`,
      reviewCount: sql<number>`COUNT(*)`,
      avgRating: sql<number>`ROUND(AVG(${receiptReviews.rating}), 1)`,
      latestReviewDate: sql<string>`MAX(${receiptReviews.createdAt})`,
      imageCount: sql<number>`SUM(CASE WHEN ${receiptReviews.productImageUrl} IS NOT NULL AND ${receiptReviews.productImageUrl} != '' THEN 1 ELSE 0 END)`,
      latestImageUrl: sql<string>`MAX(${receiptReviews.productImageUrl})`,
    }).from(receiptReviews)
      .where(noImageWhere)
      .groupBy(sql`productName`)
      .having(sql`SUM(CASE WHEN ${receiptReviews.productImageUrl} IS NOT NULL AND ${receiptReviews.productImageUrl} != '' THEN 1 ELSE 0 END) = 0`)
      .orderBy(orderClause)
      .limit(options.limit)
      .offset(offset);
    
    const noImageCount = await db.select({
      count: sql<number>`COUNT(*)`,
    }).from(
      db.select({
        productName: receiptReviews.productName,
      }).from(receiptReviews)
        .where(noImageWhere)
        .groupBy(sql`productName`)
        .having(sql`SUM(CASE WHEN ${receiptReviews.productImageUrl} IS NOT NULL AND ${receiptReviews.productImageUrl} != '' THEN 1 ELSE 0 END) = 0`)
        .as('sub')
    );
    
    // Enrich noImageProducts with product_master data
    const noImageNames = noImageProducts.map(p => p.productName).filter(Boolean);
    let noImageMasterMap = new Map<string, { id: number; canonicalName: string; imageUrl: string | null; imageStatus: string | null; sourceUrl: string | null }>();
    if (noImageNames.length > 0) {
      try {
        const masters = await db.select({
          id: productMaster.id,
          canonicalName: productMaster.canonicalName,
          imageUrl: productMaster.imageUrl,
          imageStatus: productMaster.imageStatus,
          sourceUrl: productMaster.sourceUrl,
        }).from(productMaster)
          .where(sql`${productMaster.canonicalName} IN (${sql.join(noImageNames.map(n => sql`${n}`), sql`, `)})`);
        for (const m of masters) {
          noImageMasterMap.set(m.canonicalName, m);
        }
      } catch (e) {
        console.error('[getReviewProductList] noImage product_master lookup failed:', e);
      }
    }
    
    return {
      products: noImageProducts.map(p => {
        const master = noImageMasterMap.get(p.productName);
        return {
          productName: p.productName,
          brandName: p.brandName,
          category: p.category,
          reviewCount: Number(p.reviewCount || 0),
          avgRating: Number(p.avgRating || 0),
          latestReviewDate: p.latestReviewDate,
          imageCount: 0,
          latestImageUrl: null,
          productMasterId: master?.id || null,
          masterCanonicalName: master?.canonicalName || null,
          masterImageUrl: master?.imageUrl || null,
          masterImageStatus: master?.imageStatus || null,
          masterSourceUrl: master?.sourceUrl || null,
        };
      }),
      totalCount: Number(noImageCount[0]?.count || 0),
      page: options.page,
      totalPages: Math.ceil(Number(noImageCount[0]?.count || 0) / options.limit),
    };
  }
  
  return {
    products: cleanProducts,
    totalCount,
    page: options.page,
    totalPages: Math.ceil(totalCount / options.limit),
  };
}

// ===== 一括URL登録（商品名とURLのペアを受け取ってproduct_masterを更新） =====
export async function bulkUpdateProductSourceUrls(pairs: Array<{ productName: string; sourceUrl: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results: Array<{ productName: string; success: boolean; productMasterId?: number; error?: string }> = [];
  
  for (const pair of pairs) {
    try {
      // Find existing product master by canonical name
      const existing = await db.select().from(productMaster)
        .where(eq(productMaster.canonicalName, pair.productName))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing
        await db.update(productMaster)
          .set({ sourceUrl: pair.sourceUrl })
          .where(eq(productMaster.id, existing[0].id));
        results.push({ productName: pair.productName, success: true, productMasterId: existing[0].id });
      } else {
        // Check aliases
        const alias = await db.select().from(productNameAliases)
          .where(eq(productNameAliases.aliasName, pair.productName))
          .limit(1);
        
        if (alias.length > 0) {
          // Update the master via alias
          await db.update(productMaster)
            .set({ sourceUrl: pair.sourceUrl })
            .where(eq(productMaster.id, alias[0].productMasterId));
          results.push({ productName: pair.productName, success: true, productMasterId: alias[0].productMasterId });
        } else {
          // Create new product master
          const insertResult = await db.insert(productMaster).values({
            canonicalName: pair.productName,
            sourceUrl: pair.sourceUrl,
          });
          const newId = (insertResult as any)[0]?.insertId;
          results.push({ productName: pair.productName, success: true, productMasterId: newId });
        }
      }
    } catch (error: any) {
      results.push({ productName: pair.productName, success: false, error: error.message });
    }
  }
  
  return results;
}

/**
 * 商品名でproduct_masterの画像情報を取得
 * canonicalNameが完全一致する場合に画像情報を返す
 */
export async function getProductMasterImageByName(productName: string) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const result = await db.select({
      imageUrl: productMaster.imageUrl,
      imageStatus: productMaster.imageStatus,
      sourceUrl: productMaster.sourceUrl,
      canonicalName: productMaster.canonicalName,
    }).from(productMaster)
      .where(eq(productMaster.canonicalName, productName))
      .limit(1);
    
    if (result.length > 0 && result[0].imageUrl) {
      return result[0];
    }
    
    // 部分一致でも検索（LIKE）
    const partialResult = await db.select({
      imageUrl: productMaster.imageUrl,
      imageStatus: productMaster.imageStatus,
      sourceUrl: productMaster.sourceUrl,
      canonicalName: productMaster.canonicalName,
    }).from(productMaster)
      .where(and(
        like(productMaster.canonicalName, `%${productName}%`),
        isNotNull(productMaster.imageUrl)
      ))
      .limit(1);
    
    return partialResult.length > 0 ? partialResult[0] : null;
  } catch (error) {
    console.error("[getProductMasterImageByName] Error:", error);
    return null;
  }
}


// ===== レシート承認時の自動レビュー作成＋プライバシー保護画像処理 =====

/**
 * LLM Vision APIでレシート画像から商品部分の座標を取得し、
 * sharpでクロップしてS3にアップロードする。
 * プライバシー情報（住所、名前、電話番号等）を除去した商品画像を返す。
 */
export async function extractProductImageFromReceipt(
  imageUrl: string,
  productName?: string
): Promise<{ productImageUrl: string | null; error?: string }> {
  try {
    const { invokeLLM } = await import("./_core/llm");
    const { storagePut } = await import("./storage");
    const sharp = (await import("sharp")).default;

    // Step 1: LLM Vision APIで商品部分の座標を取得
    const prompt = `この画像はTikTok Shopの注文詳細スクリーンショットです。
画像内の「商品写真」の部分だけを切り抜きたいです。
${productName ? `商品名: ${productName}` : ""}

以下のルールに従ってください：
1. 商品のサムネイル画像（商品写真）の位置を特定してください
2. 住所、名前、電話番号、注文番号などの個人情報は絶対に含めないでください
3. 商品画像が見つからない場合は found: false を返してください
4. 座標は画像全体に対する割合（0.0〜1.0）で返してください

JSON形式で返してください。`;

    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "product_image_crop",
          strict: true,
          schema: {
            type: "object",
            properties: {
              found: {
                type: "boolean",
                description: "商品画像が見つかったかどうか",
              },
              crop: {
                type: "object",
                description: "切り抜き座標（画像全体に対する割合 0.0〜1.0）",
                properties: {
                  x: { type: "number", description: "左上X座標の割合" },
                  y: { type: "number", description: "左上Y座標の割合" },
                  width: { type: "number", description: "幅の割合" },
                  height: { type: "number", description: "高さの割合" },
                },
                required: ["x", "y", "width", "height"],
                additionalProperties: false,
              },
            },
            required: ["found", "crop"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === 'string' ? rawContent : Array.isArray(rawContent) ? rawContent.find(c => c.type === 'text')?.text || '' : '';
    if (!content) {
      return { productImageUrl: null, error: "LLM returned empty response" };
    }

    let parsed: { found: boolean; crop: { x: number; y: number; width: number; height: number } };
    try {
      parsed = JSON.parse(content);
    } catch {
      return { productImageUrl: null, error: "Failed to parse LLM response" };
    }

    if (!parsed.found) {
      return { productImageUrl: null, error: "Product image not found in receipt" };
    }

    // Step 2: 元画像をfetchしてsharpでクロップ
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { productImageUrl: null, error: `Failed to fetch image: ${imageResponse.status}` };
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const metadata = await sharp(imageBuffer).metadata();
    const imgWidth = metadata.width || 1;
    const imgHeight = metadata.height || 1;

    // 座標を実ピクセルに変換（割合→ピクセル）
    const cropX = Math.max(0, Math.round(parsed.crop.x * imgWidth));
    const cropY = Math.max(0, Math.round(parsed.crop.y * imgHeight));
    const cropW = Math.min(Math.round(parsed.crop.width * imgWidth), imgWidth - cropX);
    const cropH = Math.min(Math.round(parsed.crop.height * imgHeight), imgHeight - cropY);

    if (cropW < 10 || cropH < 10) {
      return { productImageUrl: null, error: "Crop area too small" };
    }

    const croppedBuffer = await sharp(imageBuffer)
      .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
      .resize({ width: 400, height: 400, fit: "inside" })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Step 3: S3にアップロード
    const suffix = Math.random().toString(36).substring(2, 8);
    const key = `product-images/auto-crop-${Date.now()}-${suffix}.jpg`;
    const { url } = await storagePut(key, croppedBuffer, "image/jpeg");

    console.log(`[ProductImage] Cropped product image from receipt: ${url}`);
    return { productImageUrl: url };
  } catch (err: any) {
    console.error("[ProductImage] Failed to extract product image:", err.message);
    return { productImageUrl: null, error: err.message };
  }
}

/**
 * LLMでレビュー文を自動生成する
 */
export async function generateAutoReviewText(
  productName: string,
  shopName?: string,
  amount?: number
): Promise<string> {
  try {
    const { invokeLLM } = await import("./_core/llm");

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `あなたはTikTok Shopで商品を購入したユーザーです。
購入した商品について、簡潔で自然な日本語のレビューを1〜2文で書いてください。
以下のルールに従ってください：
- 実際に購入した人のような自然な口調で
- 過度に褒めすぎない、リアルな感想
- 絵文字は1〜2個まで
- 50〜100文字程度`,
        },
        {
          role: "user",
          content: `商品名: ${productName}${shopName ? `\nショップ: ${shopName}` : ""}${amount ? `\n購入金額: ¥${amount.toLocaleString()}` : ""}`,
        },
      ],
    });

    const rawContent2 = response.choices?.[0]?.message?.content;
    const text = (typeof rawContent2 === 'string' ? rawContent2 : Array.isArray(rawContent2) ? rawContent2.find(c => c.type === 'text')?.text || '' : '')?.trim();
    return text || `${productName}を購入しました。`;
  } catch (err: any) {
    console.error("[AutoReview] Failed to generate review text:", err.message);
    return `${productName}を購入しました。`;
  }
}

/**
 * レシート承認時に自動的にreceipt_reviewsにレビューを作成する。
 * - OCRデータから商品名・金額・ショップ名を取得
 * - LLMでレビュー文を自動生成
 * - レシート画像から商品部分を切り抜いてproductImageUrlに設定
 * - 重複チェック（同じreceiptId + receiptTypeの組み合わせ）
 */
export async function createAutoReviewOnApproval(params: {
  receiptType: "point_request" | "line_receipt";
  receiptId: number;
  lineUserId?: string;
  userId?: number;
  imageUrl: string;
  ocrRawText?: string | null;
  storeName?: string | null;
  totalAmount?: number | null;
}): Promise<{ reviewId: number | null; error?: string }> {
  try {
    const db = await getDb();
    if (!db) return { reviewId: null, error: "Database not available" };

    // 重複チェック: 同じレシートで既にレビューが作成されていないか
    const existing = await db
      .select({ id: receiptReviews.id })
      .from(receiptReviews)
      .where(
        and(
          eq(receiptReviews.receiptType, params.receiptType),
          eq(receiptReviews.receiptId, params.receiptId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`[AutoReview] Review already exists for ${params.receiptType} #${params.receiptId}`);
      return { reviewId: existing[0].id, error: "Review already exists" };
    }

    // OCRデータから商品情報を抽出
    let productName = "商品";
    let shopName = params.storeName || undefined;
    let purchaseAmount = params.totalAmount || undefined;

    if (params.ocrRawText) {
      try {
        const ocrData = JSON.parse(params.ocrRawText);
        if (ocrData.productName && ocrData.productName !== "undefined") {
          productName = ocrData.productName;
        }
        if (ocrData.shopName) shopName = ocrData.shopName;
        if (ocrData.totalAmount) purchaseAmount = ocrData.totalAmount;
      } catch {
        // OCRデータのパースに失敗した場合はデフォルト値を使用
      }
    }

    // 複数商品の場合、最初の商品名を使用
    if (productName.includes("、")) {
      productName = productName.split("、")[0].trim();
    }

    // 並行処理: 商品画像切り抜き + レビュー文生成
    const [imageResult, reviewText] = await Promise.all([
      extractProductImageFromReceipt(params.imageUrl, productName),
      generateAutoReviewText(productName, shopName, purchaseAmount),
    ]);

    // レビューを作成
    const reviewData: any = {
      receiptType: params.receiptType,
      receiptId: params.receiptId,
      productName,
      brandName: null,
      shopName: shopName || null,
      purchaseAmount: purchaseAmount || null,
      category: null,
      rating: 4, // デフォルト星4
      reviewText,
      tags: [],
      receiptImageUrl: null, // プライバシー保護: レシート画像は公開しない
      productImageUrl: imageResult.productImageUrl || null,
      purchasePlatform: "TikTok Shop",
      isVisible: true,
    };

    // ユーザーIDの設定
    if (params.userId) {
      reviewData.userId = params.userId;
    }
    if (params.lineUserId) {
      reviewData.lineUserId = params.lineUserId;
    }

    const result = await db.insert(receiptReviews).values(reviewData);
    const reviewId = result[0].insertId;

    console.log(`[AutoReview] Created review #${reviewId} for ${params.receiptType} #${params.receiptId} (product: ${productName}, image: ${imageResult.productImageUrl ? "yes" : "no"})`);

    return { reviewId };
  } catch (err: any) {
    console.error(`[AutoReview] Failed to create auto review:`, err.message);
    return { reviewId: null, error: err.message };
  }
}


// ============================================
// Beauty Wallet連携
// ============================================

// 交換レート定数
const BW_EXCHANGE_RATE = 0.4; // 100 LCJポイント = 40 Beauty Token

/**
 * BWアカウント連携を取得
 */
export async function getBwLinkedAccount(lineUserId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(bwLinkedAccounts)
    .where(and(
      eq(bwLinkedAccounts.lineUserId, lineUserId),
      eq(bwLinkedAccounts.status, "active")
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * 連携用トークンを生成してBWアカウント連携レコードを作成（仮登録）
 */
export async function createBwLinkToken(lineUserId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分有効
  
  // 既存の未完了レコードがあれば更新、なければ新規作成
  const existing = await db.select().from(bwLinkedAccounts)
    .where(eq(bwLinkedAccounts.lineUserId, lineUserId))
    .limit(1);
  
  if (existing.length > 0) {
    await db.update(bwLinkedAccounts)
      .set({ linkToken: token, linkTokenExpiresAt: expiresAt, status: "active" })
      .where(eq(bwLinkedAccounts.lineUserId, lineUserId));
  } else {
    await db.insert(bwLinkedAccounts).values({
      lineUserId,
      bwUserId: "", // 仮 - コールバック時に更新
      linkToken: token,
      linkTokenExpiresAt: expiresAt,
    });
  }
  
  return token;
}

/**
 * BWコールバック処理：トークン検証してBWアカウント情報を紐付け
 */
export async function completeBwLink(linkTokenOrParams: string | {
  lineUserId: number;
  bwUserId: string;
  bwDisplayName?: string;
  bwEmail?: string;
  bwCustomerId?: number;
}, bwUserId?: string, bwDisplayName?: string, bwEmail?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // オブジェクト引数パターン（メールベース自動連携用）
  if (typeof linkTokenOrParams === 'object') {
    const params = linkTokenOrParams;
    // lineUserIdで既存のレコードを検索、なければ新規作成
    const existing = await db.select().from(bwLinkedAccounts)
      .where(eq(bwLinkedAccounts.lineUserId, params.lineUserId))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(bwLinkedAccounts)
        .set({
          bwUserId: params.bwUserId,
          bwCustomerId: params.bwCustomerId ?? null,
          bwDisplayName: params.bwDisplayName ?? null,
          bwEmail: params.bwEmail ?? null,
          status: "active",
          linkedAt: new Date(),
          linkToken: null,
          linkTokenExpiresAt: null,
        })
        .where(eq(bwLinkedAccounts.id, existing[0].id));
      return existing[0].id;
    } else {
      const result = await db.insert(bwLinkedAccounts).values({
        lineUserId: params.lineUserId,
        bwUserId: params.bwUserId,
        bwCustomerId: params.bwCustomerId ?? null,
        bwDisplayName: params.bwDisplayName ?? null,
        bwEmail: params.bwEmail ?? null,
        status: "active",
      });
      return Number(result[0].insertId);
    }
  }
  
  // 既存のリンクトークンパターン（OAuthコールバック用）
  const linkToken = linkTokenOrParams;
  const record = await db.select().from(bwLinkedAccounts)
    .where(and(
      eq(bwLinkedAccounts.linkToken, linkToken),
      gt(bwLinkedAccounts.linkTokenExpiresAt, new Date())
    ))
    .limit(1);
  
  if (record.length === 0) {
    throw new Error("Invalid or expired link token");
  }
  
  // bwUserIdからbwCustomerIdを数値として解析（BW側のcustomer ID）
  const parsedBwCustomerId = bwUserId ? parseInt(bwUserId, 10) : null;
  
  await db.update(bwLinkedAccounts)
    .set({
      bwUserId: bwUserId!,
      bwCustomerId: !isNaN(parsedBwCustomerId as number) ? parsedBwCustomerId : null,
      bwDisplayName: bwDisplayName ?? null,
      bwEmail: bwEmail ?? null,
      status: "active",
      linkedAt: new Date(),
      linkToken: null,
      linkTokenExpiresAt: null,
    })
    .where(eq(bwLinkedAccounts.id, record[0].id));
  
  return record[0].lineUserId;
}

/**
 * BWアカウント連携を解除
 */
export async function unlinkBwAccount(lineUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(bwLinkedAccounts)
    .set({ status: "unlinked", unlinkedAt: new Date() })
    .where(eq(bwLinkedAccounts.lineUserId, lineUserId));
}

/**
 * LCJポイント → BWトークン交換を実行
 * 1. LCJポイント残高チェック
 * 2. LCJポイント差し引き（FIFO）
 * 3. 交換レコード作成（BW側への反映はpending）
 */
export async function exchangePointsToBw(
  lineUserId: number,
  lineUserIdStr: string, // linePointBalancesはvarchar lineUserId
  lcjPoints: number,
  bwLinkedAccountId: number,
): Promise<{ exchangeId: number; bwTokens: number; balanceAfter: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 交換レート計算
  const bwTokens = Math.floor(lcjPoints * BW_EXCHANGE_RATE);
  if (bwTokens <= 0) {
    throw new Error("交換ポイントが少なすぎます（最低100ポイント）");
  }
  
  // LCJポイント差し引き（FIFO方式）
  const result = await useLinePointsFIFO(
    lineUserIdStr,
    lcjPoints,
    `Beauty Wallet交換: ${lcjPoints}pt → ${bwTokens}BT`,
  );
  
  if (!result.success) {
    throw new Error("ポイント残高が不足しています");
  }
  
  // 交換レコード作成
  const insertResult = await db.insert(pointExchanges).values({
    lineUserId,
    bwLinkedAccountId,
    lcjPointsUsed: lcjPoints,
    bwTokensReceived: bwTokens,
    exchangeRate: BW_EXCHANGE_RATE.toFixed(4),
    bwTransferStatus: "pending",
  });
  
  const exchangeId = Number(insertResult[0].insertId);
  
  return { exchangeId, bwTokens, balanceAfter: result.balanceAfter };
}

/**
 * BW側への反映ステータスを更新
 */
export async function updateBwTransferStatus(
  exchangeId: number,
  status: "processing" | "completed" | "failed",
  bwTransactionId?: string,
  error?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(pointExchanges)
    .set({
      bwTransferStatus: status,
      bwTransactionId: bwTransactionId ?? null,
      bwTransferError: error ?? null,
      bwTransferredAt: status === "completed" ? new Date() : undefined,
      retryCount: status === "failed" ? sql`${pointExchanges.retryCount} + 1` : undefined,
    })
    .where(eq(pointExchanges.id, exchangeId));
}

/**
 * ユーザーの交換履歴を取得
 */
export async function getPointExchangeHistory(
  lineUserId: number,
  options?: { limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return [];
  
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  
  return db.select({
    id: pointExchanges.id,
    lcjPointsUsed: pointExchanges.lcjPointsUsed,
    bwTokensReceived: pointExchanges.bwTokensReceived,
    exchangeRate: pointExchanges.exchangeRate,
    bwTransferStatus: pointExchanges.bwTransferStatus,
    createdAt: pointExchanges.createdAt,
  })
    .from(pointExchanges)
    .where(eq(pointExchanges.lineUserId, lineUserId))
    .orderBy(desc(pointExchanges.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * 管理者用：月次交換集計
 */
export async function getMonthlyExchangeSummary(month: string) {
  const db = await getDb();
  if (!db) return null;
  
  const { startDate, endDate } = getJSTMonthRange(month);
  
  const result = await db.select({
    totalExchanges: sql<number>`COUNT(*)`,
    totalLcjPoints: sql<number>`COALESCE(SUM(${pointExchanges.lcjPointsUsed}), 0)`,
    totalBwTokens: sql<number>`COALESCE(SUM(${pointExchanges.bwTokensReceived}), 0)`,
    completedCount: sql<number>`SUM(CASE WHEN ${pointExchanges.bwTransferStatus} = 'completed' THEN 1 ELSE 0 END)`,
    pendingCount: sql<number>`SUM(CASE WHEN ${pointExchanges.bwTransferStatus} = 'pending' THEN 1 ELSE 0 END)`,
    failedCount: sql<number>`SUM(CASE WHEN ${pointExchanges.bwTransferStatus} = 'failed' THEN 1 ELSE 0 END)`,
    uniqueUsers: sql<number>`COUNT(DISTINCT ${pointExchanges.lineUserId})`,
  })
    .from(pointExchanges)
    .where(and(
      gte(pointExchanges.createdAt, startDate),
      lte(pointExchanges.createdAt, endDate),
    ));
  
  return result[0] ?? null;
}

/**
 * 管理者用：全交換履歴（ページネーション付き）
 */
export async function getAllPointExchanges(options?: { month?: string; limit?: number; offset?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  
  const conditions = [];
  if (options?.status) {
    conditions.push(eq(pointExchanges.bwTransferStatus, options.status as any));
  }
  if (options?.month) {
    const [year, month] = options.month.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    conditions.push(gte(pointExchanges.createdAt, startDate));
    conditions.push(lt(pointExchanges.createdAt, endDate));
  }
  
  return db.select({
    id: pointExchanges.id,
    lineUserId: pointExchanges.lineUserId,
    lcjPointsUsed: pointExchanges.lcjPointsUsed,
    bwTokensReceived: pointExchanges.bwTokensReceived,
    exchangeRate: pointExchanges.exchangeRate,
    bwTransferStatus: pointExchanges.bwTransferStatus,
    bwTransactionId: pointExchanges.bwTransactionId,
    bwTransferError: pointExchanges.bwTransferError,
    createdAt: pointExchanges.createdAt,
    userName: lineUsers.displayName,
    userEmail: lineUsers.email,
  })
    .from(pointExchanges)
    .leftJoin(lineUsers, eq(pointExchanges.lineUserId, lineUsers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(pointExchanges.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * pending状態の交換を取得（BW API送信バッチ用）
 */
export async function getPendingExchanges() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    id: pointExchanges.id,
    lineUserId: pointExchanges.lineUserId,
    bwLinkedAccountId: pointExchanges.bwLinkedAccountId,
    bwTokensReceived: pointExchanges.bwTokensReceived,
    retryCount: pointExchanges.retryCount,
    bwUserId: bwLinkedAccounts.bwUserId,
  })
    .from(pointExchanges)
    .innerJoin(bwLinkedAccounts, eq(pointExchanges.bwLinkedAccountId, bwLinkedAccounts.id))
    .where(and(
      eq(pointExchanges.bwTransferStatus, "pending"),
      lte(pointExchanges.retryCount, 3), // 最大3回リトライ
    ))
    .orderBy(asc(pointExchanges.createdAt));
}


// ===== AI Review Feedback (学習データ蓄積) =====

/**
 * AI弾きレシートの審査結果をフィードバックとして記録
 */
export async function createAiReviewFeedback(data: InsertAiReviewFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(aiReviewFeedback).values(data);
}

/**
 * AI弾きレシートのフィードバック統計を取得
 * AIの判断精度を可視化するためのデータ
 */
export async function getAiReviewFeedbackStats() {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    total: sql<number>`COUNT(*)`,
    aiCorrect: sql<number>`SUM(CASE WHEN ${aiReviewFeedback.aiWasCorrect} = true THEN 1 ELSE 0 END)`,
    aiIncorrect: sql<number>`SUM(CASE WHEN ${aiReviewFeedback.aiWasCorrect} = false THEN 1 ELSE 0 END)`,
    byCategory: sql<string>`JSON_OBJECTAGG(
      COALESCE(${aiReviewFeedback.aiDecision}, 'unknown'),
      1
    )`,
  }).from(aiReviewFeedback);
  
  // Get breakdown by AI decision category
  const categoryBreakdown = await db.select({
    aiDecision: aiReviewFeedback.aiDecision,
    total: sql<number>`COUNT(*)`,
    humanApproved: sql<number>`SUM(CASE WHEN ${aiReviewFeedback.humanDecision} = 'approved' THEN 1 ELSE 0 END)`,
    humanRejected: sql<number>`SUM(CASE WHEN ${aiReviewFeedback.humanDecision} = 'rejected' THEN 1 ELSE 0 END)`,
    aiAccuracy: sql<number>`ROUND(SUM(CASE WHEN ${aiReviewFeedback.aiWasCorrect} = true THEN 1 ELSE 0 END) / COUNT(*) * 100, 1)`,
  })
    .from(aiReviewFeedback)
    .groupBy(aiReviewFeedback.aiDecision);
  
  return {
    summary: result[0] || { total: 0, aiCorrect: 0, aiIncorrect: 0 },
    categoryBreakdown,
  };
}

/**
 * line_receiptsのAI弾き情報を更新
 */
export async function updateLineReceiptAiRejection(
  receiptId: number,
  data: {
    aiRejectionReason: string;
    aiRejectionCategory: "not_tiktok" | "not_delivered" | "incomplete" | "other";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(lineReceipts)
    .set({
      aiRejectionReason: data.aiRejectionReason,
      aiRejectionCategory: data.aiRejectionCategory,
    })
    .where(eq(lineReceipts.id, receiptId));
}

/**
 * line_receiptsの強制申請フラグを更新
 */
export async function markLineReceiptAsForceSubmitted(receiptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(lineReceipts)
    .set({
      isForceSubmitted: true,
      forceSubmittedAt: new Date(),
    })
    .where(eq(lineReceipts.id, receiptId));
}

/**
 * AI弾きフィードバック一覧を取得（学習データエクスポート用）
 */
export async function getAiReviewFeedbackList(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(aiReviewFeedback)
    .orderBy(desc(aiReviewFeedback.createdAt))
    .limit(limit)
    .offset(offset);
}


// ===== AI Auto-Approval Functions =====

/**
 * Get pending receipts that are candidates for AI auto-approval
 * Returns receipts with OCR data, ordered by submission date
 */
export async function getAutoApprovalCandidates(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      id: lineReceipts.id,
      lineUserId: lineReceipts.lineUserId,
      imageUrl: lineReceipts.imageUrl,
      imageUrls: lineReceipts.imageUrls,
      storeName: lineReceipts.storeName,
      totalAmount: lineReceipts.totalAmount,
      ocrRawText: lineReceipts.ocrRawText,
      ocrConfidence: lineReceipts.ocrConfidence,
      pointsCalculated: lineReceipts.pointsCalculated,
      fraudFlags: lineReceipts.fraudFlags,
      fraudScore: lineReceipts.fraudScore,
      isForceSubmitted: lineReceipts.isForceSubmitted,
      aiRejectionCategory: lineReceipts.aiRejectionCategory,
      submittedAt: lineReceipts.submittedAt,
      status: lineReceipts.status,
    })
    .from(lineReceipts)
    .where(eq(lineReceipts.status, "pending"))
    .orderBy(asc(lineReceipts.submittedAt))
    .limit(limit);
}

/**
 * Batch check for duplicate order numbers among all non-rejected receipts
 * Returns a map of orderNumber -> array of receipt IDs that share that order number
 */
export async function batchCheckDuplicateOrderNumbers(orderNumbers: string[]): Promise<Map<string, { id: number; status: string; lineUserId: string }[]>> {
  const db = await getDb();
  if (!db) return new Map();
  if (orderNumbers.length === 0) return new Map();
  
  // Check lineReceipts table using JSON_EXTRACT
  const results = await db
    .select({
      id: lineReceipts.id,
      status: lineReceipts.status,
      lineUserId: lineReceipts.lineUserId,
      ocrRawText: lineReceipts.ocrRawText,
    })
    .from(lineReceipts)
    .where(
      and(
        isNotNull(lineReceipts.ocrRawText),
        sql`JSON_EXTRACT(${lineReceipts.ocrRawText}, '$.orderNumber') IS NOT NULL`,
      )
    );
  
  // Build map: orderNumber -> receipts
  const dupeMap = new Map<string, { id: number; status: string; lineUserId: string }[]>();
  
  for (const r of results) {
    try {
      const ocr = typeof r.ocrRawText === "string" ? JSON.parse(r.ocrRawText) : r.ocrRawText;
      const orderNum = String(ocr?.orderNumber || "").trim();
      if (!orderNum || orderNum === "null") continue;
      
      if (orderNumbers.includes(orderNum)) {
        if (!dupeMap.has(orderNum)) {
          dupeMap.set(orderNum, []);
        }
        dupeMap.get(orderNum)!.push({
          id: r.id,
          status: r.status,
          lineUserId: r.lineUserId,
        });
      }
    } catch {
      // Skip unparseable OCR data
    }
  }
  
  // Also check pointRequests table
  const prResults = await db
    .select({
      id: pointRequests.id,
      orderNumber: pointRequests.orderNumber,
      status: pointRequests.status,
    })
    .from(pointRequests)
    .where(inArray(pointRequests.orderNumber, orderNumbers));
  
  for (const pr of prResults) {
    if (!pr.orderNumber) continue;
    if (!dupeMap.has(pr.orderNumber)) {
      dupeMap.set(pr.orderNumber, []);
    }
    dupeMap.get(pr.orderNumber)!.push({
      id: pr.id,
      status: pr.status || "unknown",
      lineUserId: "pointRequest",
    });
  }
  
  return dupeMap;
}

/**
 * Get recent review examples for LLM prompt context
 * Returns a mix of approved and rejected receipts with their OCR data
 */
export async function getRecentReviewExamples(approvedCount: number = 5, rejectedCount: number = 10) {
  const db = await getDb();
  if (!db) return { approved: [], rejected: [], rejectionStats: [] };
  
  const approved = await db
    .select({
      id: receiptReviewLogs.id,
      receiptId: receiptReviewLogs.receiptId,
      decision: receiptReviewLogs.decision,
      totalAmount: receiptReviewLogs.totalAmount,
      hasOrderNumber: receiptReviewLogs.hasOrderNumber,
      fraudFlagCount: receiptReviewLogs.fraudFlagCount,
      ocrConfidence: receiptReviewLogs.ocrConfidence,
    })
    .from(receiptReviewLogs)
    .where(eq(receiptReviewLogs.decision, "approved"))
    .orderBy(desc(receiptReviewLogs.createdAt))
    .limit(approvedCount);
  
  const rejected = await db
    .select({
      id: receiptReviewLogs.id,
      receiptId: receiptReviewLogs.receiptId,
      decision: receiptReviewLogs.decision,
      rejectionCategory: receiptReviewLogs.rejectionCategory,
      rejectionNote: receiptReviewLogs.rejectionNote,
      totalAmount: receiptReviewLogs.totalAmount,
      hasOrderNumber: receiptReviewLogs.hasOrderNumber,
      fraudFlagCount: receiptReviewLogs.fraudFlagCount,
      ocrConfidence: receiptReviewLogs.ocrConfidence,
    })
    .from(receiptReviewLogs)
    .where(eq(receiptReviewLogs.decision, "rejected"))
    .orderBy(desc(receiptReviewLogs.createdAt))
    .limit(rejectedCount);
  
  // 却下理由カテゴリ別の統計情報を取得（AIの判断精度向上に活用）
  const rejectionStats = await db
    .select({
      category: receiptReviewLogs.rejectionCategory,
      count: sql<number>`COUNT(*)`,
    })
    .from(receiptReviewLogs)
    .where(eq(receiptReviewLogs.decision, "rejected"))
    .groupBy(receiptReviewLogs.rejectionCategory)
    .orderBy(sql`COUNT(*) DESC`);
  
  return { approved, rejected, rejectionStats };
}

/**
 * Get comprehensive approval statistics for LLM learning
 * Aggregates patterns from all approved and rejected receipts
 */
export async function getApprovalStatistics() {
  const db = await getDb();
  if (!db) return null;
  
  // Amount range distribution
  const amountDistribution = await db.execute(sql`
    SELECT 
      CASE 
        WHEN totalAmount IS NULL THEN 'NULL'
        WHEN totalAmount < 1000 THEN '0-999'
        WHEN totalAmount < 3000 THEN '1000-2999'
        WHEN totalAmount < 5000 THEN '3000-4999'
        WHEN totalAmount < 10000 THEN '5000-9999'
        WHEN totalAmount < 20000 THEN '10000-19999'
        WHEN totalAmount < 50000 THEN '20000-49999'
        ELSE '50000+'
      END as amount_range,
      SUM(CASE WHEN decision = 'approved' THEN 1 ELSE 0 END) as approved_cnt,
      SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END) as rejected_cnt
    FROM receipt_review_logs
    WHERE decision IN ('approved', 'rejected')
    GROUP BY amount_range
    ORDER BY MIN(COALESCE(totalAmount, 0))
  `);
  
  // Rejection category distribution
  const rejectionCategories = await db.execute(sql`
    SELECT rejectionCategory, COUNT(*) as cnt,
      ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM receipt_review_logs WHERE decision = 'rejected'), 1) as pct
    FROM receipt_review_logs
    WHERE decision = 'rejected'
    GROUP BY rejectionCategory
    ORDER BY cnt DESC
  `);
  
  // Overall totals
  const totals = await db.execute(sql`
    SELECT decision, COUNT(*) as cnt
    FROM receipt_review_logs
    GROUP BY decision
  `);
  
  // Order number distribution
  const orderNumberDist = await db.execute(sql`
    SELECT decision, hasOrderNumber, COUNT(*) as cnt
    FROM receipt_review_logs
    WHERE decision IN ('approved', 'rejected')
    GROUP BY decision, hasOrderNumber
  `);
  
  // AI auto review human override stats (learning from corrections)
  const humanOverrides = await db.execute(sql`
    SELECT 
      aiDecision,
      humanOverride,
      COUNT(*) as cnt
    FROM ai_auto_review_logs
    WHERE humanOverride IS NOT NULL AND isDryRun = 0
    GROUP BY aiDecision, humanOverride
  `);
  
  return {
    amountDistribution: (amountDistribution as any)[0] || [],
    rejectionCategories: (rejectionCategories as any)[0] || [],
    totals: (totals as any)[0] || [],
    orderNumberDist: (orderNumberDist as any)[0] || [],
    humanOverrides: (humanOverrides as any)[0] || [],
  };
}

/**
 * Build a comprehensive statistics prompt for LLM learning
 * Converts approval statistics into a text prompt for the LLM
 */
export async function buildStatisticsLearningPrompt(): Promise<string> {
  const stats = await getApprovalStatistics();
  if (!stats) return "";
  
  const lines: string[] = [
    "",
    "=== 過去の審査実績統計（11,000件以上のデータに基づく） ===",
    "",
  ];
  
  // Overall approval rate
  const approvedTotal = (stats.totals as any[]).find((t: any) => t.decision === 'approved');
  const rejectedTotal = (stats.totals as any[]).find((t: any) => t.decision === 'rejected');
  const totalApproved = Number(approvedTotal?.cnt || 0);
  const totalRejected = Number(rejectedTotal?.cnt || 0);
  const totalAll = totalApproved + totalRejected;
  if (totalAll > 0) {
    const approvalRate = Math.round(totalApproved * 100 / totalAll);
    lines.push(`全体承認率: ${approvalRate}% (承認: ${totalApproved}件, 却下: ${totalRejected}件)`);
    lines.push("");
  }
  
  // Amount distribution
  lines.push("【金額帯別の承認率】");
  for (const row of (stats.amountDistribution as any[])) {
    const approved = Number(row.approved_cnt || 0);
    const rejected = Number(row.rejected_cnt || 0);
    const total = approved + rejected;
    if (total > 0) {
      const rate = Math.round(approved * 100 / total);
      lines.push(`  ${row.amount_range}円: 承認率${rate}% (承認${approved}件/却下${rejected}件)`);
    }
  }
  lines.push("");
  
  // Rejection categories
  lines.push("【却下理由の分布】");
  const catLabels: Record<string, string> = {
    other: "その他",
    duplicate: "重複申請",
    not_order_detail: "注文詳細画面ではない",
    not_tiktok_shop: "TikTok Shop以外",
    not_delivered: "配達未完了",
    blurry_image: "画像不鮮明",
    missing_order_number: "注文番号なし",
    missing_amount: "金額なし",
    partial_screenshot: "スクショ不完全",
    wrong_store: "対象外店舗",
    suspicious: "不正の疑い",
    incomplete_info: "情報不足",
  };
  for (const row of (stats.rejectionCategories as any[])) {
    const label = catLabels[row.rejectionCategory || 'other'] || row.rejectionCategory;
    lines.push(`  ${label}: ${row.cnt}件 (${row.pct}%)`);
  }
  lines.push("");
  
  // Order number distribution insight
  lines.push("【注文番号の有無と承認率】");
  const orderStats = stats.orderNumberDist as any[];
  const approvedWithOrder = Number(orderStats.find((r: any) => r.decision === 'approved' && r.hasOrderNumber === 'yes')?.cnt || 0);
  const rejectedWithOrder = Number(orderStats.find((r: any) => r.decision === 'rejected' && r.hasOrderNumber === 'yes')?.cnt || 0);
  const approvedNoOrder = Number(orderStats.find((r: any) => r.decision === 'approved' && r.hasOrderNumber === 'no')?.cnt || 0);
  const rejectedNoOrder = Number(orderStats.find((r: any) => r.decision === 'rejected' && r.hasOrderNumber === 'no')?.cnt || 0);
  if (approvedWithOrder + rejectedWithOrder > 0) {
    const rateWithOrder = Math.round(approvedWithOrder * 100 / (approvedWithOrder + rejectedWithOrder));
    lines.push(`  注文番号あり: 承認率${rateWithOrder}% (承認${approvedWithOrder}件/却下${rejectedWithOrder}件)`);
  }
  if (approvedNoOrder + rejectedNoOrder > 0) {
    const rateNoOrder = Math.round(approvedNoOrder * 100 / (approvedNoOrder + rejectedNoOrder));
    lines.push(`  注文番号なし: 承認率${rateNoOrder}% (承認${approvedNoOrder}件/却下${rejectedNoOrder}件)`);
  }
  lines.push("");
  
  // Human override insights
  if ((stats.humanOverrides as any[]).length > 0) {
    lines.push("【AI判定の人間修正実績】");
    for (const row of (stats.humanOverrides as any[])) {
      lines.push(`  AI判定「${row.aiDecision}」→ 人間修正「${row.humanOverride}」: ${row.cnt}件`);
    }
    lines.push("");
  }
  
  lines.push("上記の統計を参考に、承認率が高い金額帯・条件のレシートは積極的に承認してください。");
  lines.push("注文番号がOCRで取れなくても、画像から読み取れる場合は承認可能です。");
  
  return lines.join("\n");
}


// ===== AI自動審査ログ関数 =====

// AI審査ログを1件記録
export async function createAiAutoReviewLog(data: InsertAiAutoReviewLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(aiAutoReviewLogs).values(data).$returningId();
  return inserted;
}

// AI審査ログをバッチで記録
export async function createAiAutoReviewLogsBatch(logs: InsertAiAutoReviewLog[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (logs.length === 0) return [];
  await db.insert(aiAutoReviewLogs).values(logs);
  return logs;
}

// AI審査ログ一覧取得（フィルター付き）
export async function getAiAutoReviewLogs(params?: {
  batchId?: string;
  aiDecision?: string;
  humanOverride?: string | null; // null = 未介入のみ
  excludeAiApproved?: boolean;
  isDryRun?: boolean;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const conditions: any[] = [];
  if (params?.batchId) conditions.push(eq(aiAutoReviewLogs.batchId, params.batchId));
  if (params?.aiDecision) conditions.push(eq(aiAutoReviewLogs.aiDecision, params.aiDecision));
  if (params?.humanOverride === null) conditions.push(isNull(aiAutoReviewLogs.humanOverride));
  else if (params?.humanOverride) conditions.push(eq(aiAutoReviewLogs.humanOverride, params.humanOverride));
  if (params?.excludeAiApproved) conditions.push(not(eq(aiAutoReviewLogs.aiDecision, "approved")));
  if (params?.isDryRun !== undefined) conditions.push(eq(aiAutoReviewLogs.isDryRun, params.isDryRun));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  const results = await db.select({
    id: aiAutoReviewLogs.id,
    batchId: aiAutoReviewLogs.batchId,
    receiptId: aiAutoReviewLogs.receiptId,
    lineUserId: aiAutoReviewLogs.lineUserId,
    aiDecision: aiAutoReviewLogs.aiDecision,
    aiConfidence: aiAutoReviewLogs.aiConfidence,
    aiComment: aiAutoReviewLogs.aiComment,
    aiReason: aiAutoReviewLogs.aiReason,
    orderNumber: aiAutoReviewLogs.orderNumber,
    totalAmount: aiAutoReviewLogs.totalAmount,
    storeName: aiAutoReviewLogs.storeName,
    imageUrl: aiAutoReviewLogs.imageUrl,
    humanOverride: aiAutoReviewLogs.humanOverride,
    humanComment: aiAutoReviewLogs.humanComment,
    humanReviewedBy: aiAutoReviewLogs.humanReviewedBy,
    humanReviewedAt: aiAutoReviewLogs.humanReviewedAt,
    isDryRun: aiAutoReviewLogs.isDryRun,
    createdAt: aiAutoReviewLogs.createdAt,
    updatedAt: aiAutoReviewLogs.updatedAt,
    userName: lineUsers.displayName,
    userPictureUrl: lineUsers.pictureUrl,
    // Additional fields from lineReceipts for richer display
    receiptPointsAwarded: lineReceipts.pointsAwarded,
    receiptPointsCalculated: lineReceipts.pointsCalculated,
    receiptOcrRawText: lineReceipts.ocrRawText,
    receiptPurchaseDate: lineReceipts.purchaseDate,
    receiptImageUrls: lineReceipts.imageUrls,
    receiptStatus: lineReceipts.status,
  })
    .from(aiAutoReviewLogs)
    .leftJoin(lineUsers, eq(aiAutoReviewLogs.lineUserId, lineUsers.lineUserId))
    .leftJoin(lineReceipts, eq(aiAutoReviewLogs.receiptId, lineReceipts.id))
    .where(where ?? undefined)
    .orderBy(desc(aiAutoReviewLogs.createdAt))
    .limit(params?.limit ?? 100)
    .offset(params?.offset ?? 0);
  
  return results;
}

// AI審査ログの統計取得
export async function getAiAutoReviewLogStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results = await db.select({
    aiDecision: aiAutoReviewLogs.aiDecision,
    count: sql<number>`COUNT(*)`,
    humanOverrideCount: sql<number>`SUM(CASE WHEN ${aiAutoReviewLogs.humanOverride} IS NOT NULL THEN 1 ELSE 0 END)`,
  })
    .from(aiAutoReviewLogs)
    .where(eq(aiAutoReviewLogs.isDryRun, false))
    .groupBy(aiAutoReviewLogs.aiDecision);
  
  // 人間オーバーライド別の統計も取得
  const humanStats = await db.select({
    humanOverride: aiAutoReviewLogs.humanOverride,
    count: sql<number>`COUNT(*)`,
  })
    .from(aiAutoReviewLogs)
    .where(and(
      eq(aiAutoReviewLogs.isDryRun, false),
      isNotNull(aiAutoReviewLogs.humanOverride)
    ))
    .groupBy(aiAutoReviewLogs.humanOverride);
  
  // 手動審査待ち: 実際にレシートがpendingステータスで、かつAIがスキップ/保留したもののみカウント
  // rejected_aiやrejected_duplicateは既に自動却下済みなので手動審査不要
  const pendingManualReview = await db.select({
    count: sql<number>`COUNT(*)`,
  })
    .from(aiAutoReviewLogs)
    .innerJoin(lineReceipts, eq(aiAutoReviewLogs.receiptId, lineReceipts.id))
    .where(and(
      eq(aiAutoReviewLogs.isDryRun, false),
      isNull(aiAutoReviewLogs.humanOverride),
      sql`${aiAutoReviewLogs.aiDecision} IN ('skipped', 'held')`,
      eq(lineReceipts.status, "pending")
    ));
  
  return {
    byAiDecision: results,
    byHumanOverride: humanStats,
    pendingManualReviewCount: pendingManualReview[0]?.count ?? 0,
  };
}

// バッチ一覧取得（ユニークなbatchIdごとの集計）
export async function getAiAutoReviewBatches(limit: number = 20) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results = await db.select({
    batchId: aiAutoReviewLogs.batchId,
    isDryRun: aiAutoReviewLogs.isDryRun,
    totalCount: sql<number>`COUNT(*)`,
    approvedCount: sql<number>`SUM(CASE WHEN ${aiAutoReviewLogs.aiDecision} = 'approved' THEN 1 ELSE 0 END)`,
    rejectedCount: sql<number>`SUM(CASE WHEN ${aiAutoReviewLogs.aiDecision} = 'rejected_duplicate' THEN 1 ELSE 0 END)`,
    heldCount: sql<number>`SUM(CASE WHEN ${aiAutoReviewLogs.aiDecision} = 'held' THEN 1 ELSE 0 END)`,
    skippedCount: sql<number>`SUM(CASE WHEN ${aiAutoReviewLogs.aiDecision} = 'skipped' THEN 1 ELSE 0 END)`,
    humanOverrideCount: sql<number>`SUM(CASE WHEN ${aiAutoReviewLogs.humanOverride} IS NOT NULL THEN 1 ELSE 0 END)`,
    createdAt: sql<Date>`MIN(${aiAutoReviewLogs.createdAt})`,
  })
    .from(aiAutoReviewLogs)
    .groupBy(aiAutoReviewLogs.batchId, aiAutoReviewLogs.isDryRun)
    .orderBy(sql`MIN(${aiAutoReviewLogs.createdAt}) DESC`)
    .limit(limit);
  
  return results;
}

// 人間がAI判定を修正（オーバーライド）
export async function overrideAiAutoReviewLog(logId: number, data: {
  humanOverride: string;
  humanComment?: string;
  humanReviewedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(aiAutoReviewLogs).set({
    humanOverride: data.humanOverride,
    humanComment: data.humanComment || null,
    humanReviewedBy: data.humanReviewedBy,
    humanReviewedAt: new Date(),
  }).where(eq(aiAutoReviewLogs.id, logId));
  
  // 修正後のログを返す
  const result = await db.select().from(aiAutoReviewLogs).where(eq(aiAutoReviewLogs.id, logId)).limit(1);
  return result[0] || null;
}

// AI審査ログをIDで取得
export async function getAiAutoReviewLogById(logId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(aiAutoReviewLogs).where(eq(aiAutoReviewLogs.id, logId)).limit(1);
  return result[0] || null;
}

// ===== AI自動承認設定関数 =====

// 設定取得（なければデフォルト作成）
export async function getAiAutoApproveSetting() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(aiAutoApproveSettings).limit(1);
  if (result.length > 0) return result[0];
  
  // デフォルト設定を作成
  await db.insert(aiAutoApproveSettings).values({
    isEnabled: false,
    confidenceThreshold: 85,
    batchSize: 20,
  });
  const newResult = await db.select().from(aiAutoApproveSettings).limit(1);
  return newResult[0];
}

// 設定更新
export async function updateAiAutoApproveSetting(data: {
  isEnabled?: boolean;
  isRunning?: boolean;
  confidenceThreshold?: number;
  batchSize?: number;
  lastRunAt?: Date;
  lastRunBatchId?: string;
  totalProcessed?: number;
  totalApproved?: number;
  totalRejected?: number;
  totalHeld?: number;
  totalSkipped?: number;
  currentBatchNumber?: number;
  startedAt?: Date;
  stoppedAt?: Date;
  updatedBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 設定が存在するか確認
  const existing = await db.select().from(aiAutoApproveSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(aiAutoApproveSettings).values({
      isEnabled: data.isEnabled ?? false,
      isRunning: data.isRunning ?? false,
      confidenceThreshold: data.confidenceThreshold ?? 85,
      batchSize: data.batchSize ?? 20,
      lastRunAt: data.lastRunAt,
      lastRunBatchId: data.lastRunBatchId,
      totalProcessed: data.totalProcessed ?? 0,
      totalApproved: data.totalApproved ?? 0,
      totalRejected: data.totalRejected ?? 0,
      totalHeld: data.totalHeld ?? 0,
      totalSkipped: data.totalSkipped ?? 0,
      currentBatchNumber: data.currentBatchNumber ?? 0,
      startedAt: data.startedAt,
      stoppedAt: data.stoppedAt,
      updatedBy: data.updatedBy,
    });
  } else {
    await db.update(aiAutoApproveSettings).set(data).where(eq(aiAutoApproveSettings.id, existing[0].id));
  }
  
  return await getAiAutoApproveSetting();
}

// AI審査ログのフィールドを更新（再認識結果の反映等）
export async function updateAiAutoReviewLogFields(logId: number, data: {
  orderNumber?: string | null;
  totalAmount?: number | null;
  storeName?: string | null;
  aiDecision?: string;
  aiConfidence?: number;
  aiComment?: string;
  aiReason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateFields: any = {};
  if (data.orderNumber !== undefined) updateFields.orderNumber = data.orderNumber;
  if (data.totalAmount !== undefined) updateFields.totalAmount = data.totalAmount;
  if (data.storeName !== undefined) updateFields.storeName = data.storeName;
  if (data.aiDecision !== undefined) updateFields.aiDecision = data.aiDecision;
  if (data.aiConfidence !== undefined) updateFields.aiConfidence = data.aiConfidence;
  if (data.aiComment !== undefined) updateFields.aiComment = data.aiComment;
  if (data.aiReason !== undefined) updateFields.aiReason = data.aiReason;
  
  if (Object.keys(updateFields).length === 0) return null;
  
  await db.update(aiAutoReviewLogs).set(updateFields).where(eq(aiAutoReviewLogs.id, logId));
  const result = await db.select().from(aiAutoReviewLogs).where(eq(aiAutoReviewLogs.id, logId)).limit(1);
  return result[0] || null;
}

// ===== AIレシート審査 学習フィードバック関数 =====

// 学習例を保存（人間がAI判定をオーバーライドした時に呼ばれる）
export async function saveAiReceiptLearningExample(data: {
  reviewLogId: number;
  receiptId: number;
  imageUrl?: string | null;
  aiOriginalDecision: string;
  aiOriginalConfidence?: number | null;
  aiOriginalComment?: string | null;
  aiOriginalOrderNumber?: string | null;
  aiOriginalAmount?: number | null;
  aiOriginalStoreName?: string | null;
  humanDecision: string;
  humanComment?: string | null;
  correctOrderNumber?: string | null;
  correctAmount?: number | null;
  correctStoreName?: string | null;
  errorType?: string | null;
  learningNote?: string | null;
  createdBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(aiReceiptLearningExamples).values({
    reviewLogId: data.reviewLogId,
    receiptId: data.receiptId,
    imageUrl: data.imageUrl || null,
    aiOriginalDecision: data.aiOriginalDecision,
    aiOriginalConfidence: data.aiOriginalConfidence ?? null,
    aiOriginalComment: data.aiOriginalComment || null,
    aiOriginalOrderNumber: data.aiOriginalOrderNumber || null,
    aiOriginalAmount: data.aiOriginalAmount ?? null,
    aiOriginalStoreName: data.aiOriginalStoreName || null,
    humanDecision: data.humanDecision,
    humanComment: data.humanComment || null,
    correctOrderNumber: data.correctOrderNumber || null,
    correctAmount: data.correctAmount ?? null,
    correctStoreName: data.correctStoreName || null,
    errorType: data.errorType || null,
    learningNote: data.learningNote || null,
    isActive: true,
    createdBy: data.createdBy ?? null,
  });
}

// 直近のAI学習例を取得（few-shot用）
export async function getRecentAiReceiptLearningExamples(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // パターン別に学習例を取得してバランス良く選択
  // false_reject: AIが却下したが人間が承認したケース（最も重要）
  const falseRejects = await db.select()
    .from(aiReceiptLearningExamples)
    .where(and(
      eq(aiReceiptLearningExamples.isActive, true),
      eq(aiReceiptLearningExamples.errorType, "false_reject"),
    ))
    .orderBy(desc(aiReceiptLearningExamples.createdAt))
    .limit(Math.ceil(limit * 0.4));
  
  // held_but_approved: 保留にしたが人間が承認したケース
  const heldApproved = await db.select()
    .from(aiReceiptLearningExamples)
    .where(and(
      eq(aiReceiptLearningExamples.isActive, true),
      eq(aiReceiptLearningExamples.errorType, "held_but_approved"),
    ))
    .orderBy(desc(aiReceiptLearningExamples.createdAt))
    .limit(Math.ceil(limit * 0.3));
  
  // その他のエラータイプ
  const existingIds = [...falseRejects, ...heldApproved].map(e => e.id);
  let others: typeof falseRejects = [];
  if (existingIds.length < limit) {
    const remaining = limit - existingIds.length;
    if (existingIds.length > 0) {
      others = await db.select()
        .from(aiReceiptLearningExamples)
        .where(and(
          eq(aiReceiptLearningExamples.isActive, true),
          sql`${aiReceiptLearningExamples.id} NOT IN (${sql.join(existingIds.map(id => sql`${id}`), sql`, `)})`
        ))
        .orderBy(desc(aiReceiptLearningExamples.createdAt))
        .limit(remaining);
    } else {
      others = await db.select()
        .from(aiReceiptLearningExamples)
        .where(eq(aiReceiptLearningExamples.isActive, true))
        .orderBy(desc(aiReceiptLearningExamples.createdAt))
        .limit(remaining);
    }
  }
  
  const results = [...falseRejects, ...heldApproved, ...others];
  return results;
}

// エラータイプ別の学習例統計を取得
export async function getAiReceiptLearningStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const totalCount = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(aiReceiptLearningExamples).where(eq(aiReceiptLearningExamples.isActive, true));
  
  const byErrorType = await db.select({
    errorType: aiReceiptLearningExamples.errorType,
    count: sql<number>`COUNT(*)`,
  })
    .from(aiReceiptLearningExamples)
    .where(eq(aiReceiptLearningExamples.isActive, true))
    .groupBy(aiReceiptLearningExamples.errorType)
    .orderBy(sql`COUNT(*) DESC`);
  
  const byDecision = await db.select({
    aiOriginalDecision: aiReceiptLearningExamples.aiOriginalDecision,
    humanDecision: aiReceiptLearningExamples.humanDecision,
    count: sql<number>`COUNT(*)`,
  })
    .from(aiReceiptLearningExamples)
    .where(eq(aiReceiptLearningExamples.isActive, true))
    .groupBy(aiReceiptLearningExamples.aiOriginalDecision, aiReceiptLearningExamples.humanDecision)
    .orderBy(sql`COUNT(*) DESC`);
  
  return {
    totalExamples: totalCount[0]?.count ?? 0,
    byErrorType,
    byDecision,
  };
}

// few-shot例をプロンプト用テキストに変換
export async function buildLearningExamplesPrompt(limit: number = 8): Promise<string> {
  const examples = await getRecentAiReceiptLearningExamples(limit);
  
  if (examples.length === 0) return "";
  
  const lines: string[] = [
    "",
    "=== 過去の人間修正フィードバック（AIの判定ミスから学習） ===",
    `※ 以下は人間がAIの判定を修正した${examples.length}件の実例です。同様のケースでは人間の判定に従ってください。`,
    "",
  ];
  
  for (const ex of examples) {
    const errorLabel = ex.errorType ? `[エラー種別: ${ex.errorType}]` : "";
    lines.push(`--- 修正例 ${errorLabel} ---`);
    lines.push(`AI元判定: ${ex.aiOriginalDecision} (信頼度: ${ex.aiOriginalConfidence ?? "不明"}%)`);
    if (ex.aiOriginalComment) lines.push(`AIコメント: ${ex.aiOriginalComment}`);
    lines.push(`→ 人間修正: ${ex.humanDecision}`);
    if (ex.humanComment) lines.push(`人間コメント: ${ex.humanComment}`);
    
    const corrections: string[] = [];
    if (ex.aiOriginalOrderNumber !== ex.correctOrderNumber) {
      corrections.push(`注文番号: AI="${ex.aiOriginalOrderNumber || "なし"}" → 正解="${ex.correctOrderNumber || "なし"}"`);
    }
    if (ex.aiOriginalAmount !== ex.correctAmount) {
      corrections.push(`金額: AI="${ex.aiOriginalAmount ?? "なし"}" → 正解="${ex.correctAmount ?? "なし"}"`);
    }
    if (ex.aiOriginalStoreName !== ex.correctStoreName) {
      corrections.push(`店舗: AI="${ex.aiOriginalStoreName || "なし"}" → 正解="${ex.correctStoreName || "なし"}"`);
    }
    if (corrections.length > 0) {
      lines.push(`修正内容: ${corrections.join(", ")}`);
    }
    
    if (ex.learningNote) lines.push(`学習メモ: ${ex.learningNote}`);
    lines.push("");
  }
  
  lines.push("★ 重要: 上記の修正例の大半は「AIが却下したが人間が承認した」ケースです。AIは却下に偏りすぎる傾向があります。");
  lines.push("★ 同様のパターンでは人間の判定（承認）に合わせた判断をしてください。");
  lines.push("★ 「注文番号なし」とAIが判定したが実際には画像に注文番号が存在するケースが非常に多いです。画像をよく見てください。");
  
  return lines.join("\n");
}

// 特定のreviewLogIdの学習例が既に存在するか確認
export async function hasLearningExampleForLog(reviewLogId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({ id: aiReceiptLearningExamples.id })
    .from(aiReceiptLearningExamples)
    .where(eq(aiReceiptLearningExamples.reviewLogId, reviewLogId))
    .limit(1);
  
  return result.length > 0;
}


// ===== Beauty Wallet ポップアップ ABテスト DB関数 =====

// --- Variant CRUD ---
export async function createPopupVariant(data: {
  variantKey: string;
  theme: string;
  menuItems: { name: string; imageUrl: string; ptLabel: string }[];
  headline: string;
  subtext: string;
  ctaText: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(popupVariants).values(data);
  return result[0].insertId;
}

export async function getAllPopupVariants() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(popupVariants).orderBy(desc(popupVariants.id));
}

export async function getActivePopupVariants() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(popupVariants).where(eq(popupVariants.isActive, true));
}

export async function getPopupVariantById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(popupVariants).where(eq(popupVariants.id, id)).limit(1);
  return rows[0] || null;
}

export async function updatePopupVariant(id: number, data: Partial<{
  theme: string;
  menuItems: { name: string; imageUrl: string; ptLabel: string }[];
  headline: string;
  subtext: string;
  ctaText: string;
  isActive: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(popupVariants).set(data).where(eq(popupVariants.id, id));
}

export async function incrementPopupImpressions(variantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(popupVariants)
    .set({ impressions: sql`${popupVariants.impressions} + 1` })
    .where(eq(popupVariants.id, variantId));
}

export async function incrementPopupClicks(variantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(popupVariants)
    .set({ clicks: sql`${popupVariants.clicks} + 1` })
    .where(eq(popupVariants.id, variantId));
}

// --- Impression / Click logging ---
export async function recordPopupImpression(data: {
  variantId: number;
  lineUserId?: number | null;
  sessionId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(popupImpressions).values(data);
  await incrementPopupImpressions(data.variantId);
}

export async function recordPopupClick(data: {
  variantId: number;
  lineUserId?: number | null;
  sessionId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(popupClicks).values(data);
  await incrementPopupClicks(data.variantId);
}

// --- Bandit: Epsilon-Greedy variant selection ---
export async function selectPopupVariantBandit(epsilon: number = 0.2) {
  const variants = await getActivePopupVariants();
  if (variants.length === 0) return null;

  // Epsilon-Greedy: with probability epsilon, explore (random); otherwise exploit (best CTR)
  const shouldExplore = Math.random() < epsilon;

  if (shouldExplore) {
    // Random selection
    return variants[Math.floor(Math.random() * variants.length)];
  }

  // Exploit: pick the variant with the highest CTR
  // Use Thompson Sampling approximation: add 1 to both to avoid division by zero
  let bestVariant = variants[0];
  let bestCtr = -1;

  for (const v of variants) {
    const ctr = (v.clicks + 1) / (v.impressions + 2); // Laplace smoothing
    if (ctr > bestCtr) {
      bestCtr = ctr;
      bestVariant = v;
    }
  }

  return bestVariant;
}

// --- Stats for admin dashboard ---
export async function getPopupStats() {
  const variants = await getAllPopupVariants();
  const totalImpressions = variants.reduce((sum, v) => sum + v.impressions, 0);
  const totalClicks = variants.reduce((sum, v) => sum + v.clicks, 0);
  const overallCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;

  const variantStats = variants.map(v => ({
    id: v.id,
    variantKey: v.variantKey,
    theme: v.theme,
    headline: v.headline,
    impressions: v.impressions,
    clicks: v.clicks,
    ctr: v.impressions > 0 ? (v.clicks / v.impressions * 100) : 0,
    isActive: v.isActive,
    menuItems: v.menuItems,
  }));

  return {
    totalImpressions,
    totalClicks,
    overallCtr,
    variantCount: variants.length,
    variants: variantStats,
  };
}

// --- Seed initial variants ---
export async function seedPopupVariants() {
  const existing = await getAllPopupVariants();
  if (existing.length > 0) return { seeded: false, count: existing.length };

  const CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663045992616/GgA9WvTBCZMf6mjyMMwACw";

  const menuPool = [
    { name: "マツエク", images: [`${CDN}/matsek_e0ae7a9f.jpg`, `${CDN}/matsek2_2977432e.jpg`, `${CDN}/matsek3_030ec230.jpg`], ptLabel: "3,500pt〜" },
    { name: "ネイル", images: [`${CDN}/nail_bf344f98.jpg`, `${CDN}/nail2_c5c7b085.jpg`, `${CDN}/nail3_7cd27ee9.jpg`], ptLabel: "3,000pt〜" },
    { name: "ヘッドスパ", images: [`${CDN}/headspa_ac980ea0.jpg`, `${CDN}/headspa2_838d8aac.jpg`, `${CDN}/headspa3_170c7d4b.jpg`, `${CDN}/headspa4_812993c7.jpg`], ptLabel: "4,000pt〜" },
    { name: "髪質改善", images: [`${CDN}/treatment_655cdb5f.jpg`], ptLabel: "5,000pt〜" },
    { name: "カット+カラー", images: [`${CDN}/color_d144d829.jpg`, `${CDN}/color2_16e83672.jpg`], ptLabel: "6,000pt〜" },
    { name: "フェイシャル", images: [`${CDN}/facial_d76e1c3a.jpg`], ptLabel: "4,500pt〜" },
  ];

  const themes = ["gold", "pink"];
  const headlines = [
    "あなたのポイントで\nサロン体験が待ってる！",
    "ポイントが美に変わる",
    "今すぐ使える\nビューティーポイント！",
    "キレイへの一歩、\nここから始まる",
  ];
  const subtexts = [
    "たくさんの美容体験に使える！",
    "サロン体験をお得にGET ♪",
    "ポイントで自分磨き ✨",
    "あなたのキレイを応援！",
  ];
  const ctaTexts = [
    "Beauty Walletにチャージする ✨",
    "今すぐチャージ →",
    "ポイントを使ってみる ✨",
  ];

  // Generate diverse variants
  const variantsToCreate: Array<{
    variantKey: string;
    theme: string;
    menuItems: { name: string; imageUrl: string; ptLabel: string }[];
    headline: string;
    subtext: string;
    ctaText: string;
  }> = [];

  let variantIndex = 0;
  for (const theme of themes) {
    for (let h = 0; h < headlines.length; h++) {
      // Pick 4 random menus for each variant
      const shuffled = [...menuPool].sort(() => Math.random() - 0.5);
      const selectedMenus = shuffled.slice(0, 4).map(m => ({
        name: m.name,
        imageUrl: m.images[Math.floor(Math.random() * m.images.length)],
        ptLabel: m.ptLabel,
      }));

      variantsToCreate.push({
        variantKey: `${theme}_v${variantIndex}`,
        theme,
        menuItems: selectedMenus,
        headline: headlines[h],
        subtext: subtexts[h % subtexts.length],
        ctaText: ctaTexts[variantIndex % ctaTexts.length],
      });
      variantIndex++;
    }
  }

  for (const v of variantsToCreate) {
    await createPopupVariant(v);
  }

  return { seeded: true, count: variantsToCreate.length };
}


// ===== 確変チャンス追加関数 =====

/**
 * レシートIDと種別から確変チャンス結果を取得
 * 承認時に確変ポイント（1.5%）を適用するために使用
 */
export async function getKakuhenResultByReceiptId(receiptType: "point_request" | "line_receipt", receiptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(receiptKakuhenResults)
    .where(and(
      eq(receiptKakuhenResults.receiptType, receiptType),
      eq(receiptKakuhenResults.receiptId, receiptId),
    ))
    .orderBy(desc(receiptKakuhenResults.createdAt))
    .limit(1);
  return rows[0] || null;
}

/**
 * 確変チャンス全履歴を取得（管理者用）
 * ユーザー名、レシート情報、TikTok URL、結果を含む
 */
export async function getAllKakuhenResultsWithDetails(options?: {
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const results = await db.select({
    kakuhen: receiptKakuhenResults,
    userName: users.name,
    userEmail: users.email,
    lineUserName: lineUsers.displayName,
  })
    .from(receiptKakuhenResults)
    .leftJoin(users, eq(receiptKakuhenResults.userId, users.id))
    .leftJoin(lineUsers, eq(receiptKakuhenResults.lineUserId, lineUsers.lineUserId))
    .orderBy(desc(receiptKakuhenResults.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
  
  return results;
}

/**
 * 複数レシートIDに対する確変チャンス結果をバッチ取得
 * 管理画面のレシート一覧で確変バッジを表示するために使用
 */
export async function getKakuhenResultsByReceiptIds(receiptType: "point_request" | "line_receipt", receiptIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (receiptIds.length === 0) return [];
  
  return await db.select().from(receiptKakuhenResults)
    .where(and(
      eq(receiptKakuhenResults.receiptType, receiptType),
      inArray(receiptKakuhenResults.receiptId, receiptIds),
    ));
}

// =============================================
// 配信スケジューラー用ヘルパー関数
// =============================================

/**
 * 今日（JST）に作成された記事の本数を取得（published + scheduled）
 */
export async function getTodayBlogArticleCount(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const jstOffset = 9 * 60 * 60 * 1000;
  const now = new Date();
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstToday = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
  const jstTomorrow = new Date(jstToday.getTime() + 24 * 60 * 60 * 1000);
  const utcStart = new Date(jstToday.getTime() - jstOffset);
  const utcEnd = new Date(jstTomorrow.getTime() - jstOffset);
  const rows = await db.select({ id: blogArticles.id })
    .from(blogArticles)
    .where(and(
      gte(blogArticles.createdAt, utcStart),
      lte(blogArticles.createdAt, utcEnd),
    ));
  return rows.length;
}

/**
 * 今日（JST）のカテゴリ別投稿数を取得
 */
export async function getTodayCategoryPostCounts(): Promise<Record<number, number>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const jstOffset = 9 * 60 * 60 * 1000;
  const now = new Date();
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstToday = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
  const jstTomorrow = new Date(jstToday.getTime() + 24 * 60 * 60 * 1000);
  const utcStart = new Date(jstToday.getTime() - jstOffset);
  const utcEnd = new Date(jstTomorrow.getTime() - jstOffset);
  const rows = await db.select({ categoryId: blogArticles.categoryId })
    .from(blogArticles)
    .where(and(
      gte(blogArticles.createdAt, utcStart),
      lte(blogArticles.createdAt, utcEnd),
    ));
  const counts: Record<number, number> = {};
  for (const row of rows) {
    if (row.categoryId !== null && row.categoryId !== undefined) {
      counts[row.categoryId] = (counts[row.categoryId] || 0) + 1;
    }
  }
  return counts;
}

/**
 * 直近N日間の記事タイトル一覧を取得（重複チェック用）
 */
export async function getRecentArticleTitles(days: number = 14): Promise<string[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select({ title: blogArticles.title })
    .from(blogArticles)
    .where(gte(blogArticles.createdAt, since));
  return rows.map(r => r.title);
}

/**
 * publishedAt が現在時刻以前の scheduled 記事を published に変更する
 */
export async function publishDueScheduledArticles(): Promise<number[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  const rows = await db.select({ id: blogArticles.id, slug: blogArticles.slug })
    .from(blogArticles)
    .where(and(
      eq(blogArticles.status, 'scheduled'),
      lte(blogArticles.publishedAt, now),
    ));
  const publishedIds: number[] = [];
  for (const row of rows) {
    await db.update(blogArticles)
      .set({ status: 'published', updatedAt: now })
      .where(eq(blogArticles.id, row.id));
    publishedIds.push(row.id);
    console.log(`[DB] Published scheduled article ID: ${row.id} slug: ${row.slug}`);
  }
  return publishedIds;
}

/**
 * 今日の scheduled 記事数を取得
 */
export async function getTodayScheduledCount(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const jstOffset = 9 * 60 * 60 * 1000;
  const now = new Date();
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstToday = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
  const jstTomorrow = new Date(jstToday.getTime() + 24 * 60 * 60 * 1000);
  const utcStart = new Date(jstToday.getTime() - jstOffset);
  const utcEnd = new Date(jstTomorrow.getTime() - jstOffset);
  const rows = await db.select({ id: blogArticles.id })
    .from(blogArticles)
    .where(and(
      eq(blogArticles.status, 'scheduled'),
      gte(blogArticles.publishedAt, utcStart),
      lte(blogArticles.publishedAt, utcEnd),
    ));
  return rows.length;
}

// =============================================
// Blog SEO Monitoring & CV Tracking helpers
// =============================================

/**
 * テーマ重複チェック（カテゴリ×悩み×記事タイプの組み合わせで直近30日）
 */
export async function checkThemeDuplicate(
  categorySlug: string,
  articleType: string,
  keyword: string,
  days: number = 30
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(blogArticleThemeLog)
    .where(
      and(
        eq(blogArticleThemeLog.categorySlug, categorySlug),
        eq(blogArticleThemeLog.articleType, articleType),
        like(blogArticleThemeLog.keyword, `%${keyword.substring(0, 10)}%`),
        gte(blogArticleThemeLog.createdAt, since)
      )
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * テーマログを記録（重複防止用）
 */
export async function recordBlogThemeLog(data: InsertBlogArticleThemeLogEntry) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(blogArticleThemeLog).values(data);
  } catch (e) {
    console.warn('[DB] recordBlogThemeLog failed:', e);
  }
}

/**
 * 記事CV計測レコードを作成または更新
 */
export async function upsertBlogArticleStat(data: InsertBlogArticleStat) {
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await db
      .select()
      .from(blogArticleStats)
      .where(eq(blogArticleStats.articleId, data.articleId!))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(blogArticleStats)
        .set(data)
        .where(eq(blogArticleStats.articleId, data.articleId!));
    } else {
      await db.insert(blogArticleStats).values(data);
    }
  } catch (e) {
    console.warn('[DB] upsertBlogArticleStat failed:', e);
  }
}

/**
 * SEO指標レコードを作成または更新
 */
export async function upsertBlogArticleSeoMetric(data: InsertBlogArticleSeoMetric) {
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await db
      .select()
      .from(blogArticleSeoMetrics)
      .where(eq(blogArticleSeoMetrics.articleId, data.articleId!))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(blogArticleSeoMetrics)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(blogArticleSeoMetrics.articleId, data.articleId!));
    } else {
      await db.insert(blogArticleSeoMetrics).values(data);
    }
  } catch (e) {
    console.warn('[DB] upsertBlogArticleSeoMetric failed:', e);
  }
}

/**
 * 低品質記事を抽出（impressions低・CTR低・未インデックス、公開後30日以上）
 */
export async function getWeakBlogArticles(limit: number = 20): Promise<Array<{
  articleId: number;
  slug: string;
  title: string;
  impressions: number;
  clicks: number;
  ctr: string;
  avgPosition: string;
  isIndexed: boolean;
  rewriteCount: number;
}>> {
  const db = await getDb();
  if (!db) return [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const rows = await db
      .select({
        articleId: blogArticleSeoMetrics.articleId,
        slug: blogArticleSeoMetrics.slug,
        title: blogArticles.title,
        impressions: blogArticleSeoMetrics.impressions,
        clicks: blogArticleSeoMetrics.clicks,
        ctr: blogArticleSeoMetrics.ctr,
        avgPosition: blogArticleSeoMetrics.avgPosition,
        isIndexed: blogArticleSeoMetrics.isIndexed,
        rewriteCount: blogArticleStats.rewriteCount,
      })
      .from(blogArticleSeoMetrics)
      .leftJoin(blogArticles, eq(blogArticleSeoMetrics.articleId, blogArticles.id))
      .leftJoin(blogArticleStats, eq(blogArticleSeoMetrics.articleId, blogArticleStats.articleId))
      .where(
        and(
          eq(blogArticles.status, 'published'),
          lte(blogArticles.publishedAt, thirtyDaysAgo),
          or(
            eq(blogArticleSeoMetrics.isIndexed, false),
            lte(blogArticleSeoMetrics.impressions, 10),
            lte(blogArticleSeoMetrics.clicks, 1)
          )
        )
      )
      .orderBy(asc(blogArticleSeoMetrics.impressions))
      .limit(limit);
    return rows.map(r => ({
      articleId: r.articleId,
      slug: r.slug,
      title: r.title || '',
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr || '0.0000',
      avgPosition: r.avgPosition || '0.00',
      isIndexed: r.isIndexed,
      rewriteCount: r.rewriteCount || 0,
    }));
  } catch (e) {
    console.warn('[DB] getWeakBlogArticles failed:', e);
    return [];
  }
}

/**
 * 記事CV計測: バナークリックを記録
 */
export async function incrementBlogBannerClick(articleId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .update(blogArticleStats)
      .set({ bannerClicks: sql`bannerClicks + 1` })
      .where(eq(blogArticleStats.articleId, articleId));
  } catch (e) {}
}

/**
 * 記事CV計測: 商品クリックを記録
 */
export async function incrementBlogProductClick(articleId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .update(blogArticleStats)
      .set({ productClicks: sql`productClicks + 1` })
      .where(eq(blogArticleStats.articleId, articleId));
  } catch (e) {}
}

/**
 * 記事CV計測: モールクリックを記録
 */
export async function incrementBlogMallClick(articleId: number) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .update(blogArticleStats)
      .set({ mallClicks: sql`mallClicks + 1` })
      .where(eq(blogArticleStats.articleId, articleId));
  } catch (e) {}
}


// ========== Livestream Brands (多対多) ==========

export async function createLivestreamBrand(data: InsertLivestreamBrand) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(livestreamBrands).values(data);
}

export async function getLivestreamBrandsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(livestreamBrands)
    .where(eq(livestreamBrands.livestreamId, livestreamId));
}

export async function deleteLivestreamBrandsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(livestreamBrands).where(eq(livestreamBrands.livestreamId, livestreamId));
}

// ========== Brand Addition Logs ==========

export async function createBrandAdditionLog(data: InsertBrandAdditionLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(brandAdditionLogs).values(data);
}

export async function getAllBrandAdditionLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(brandAdditionLogs)
    .orderBy(desc(brandAdditionLogs.createdAt))
    .limit(limit);
}

// ========== Brand creation by liver ==========

export async function createBrandByLiver(name: string, createdBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(brands).values({
    name,
    nameJa: name, // Use same name for nameJa
    createdBy,
  });
  const insertId = (result as any)[0]?.insertId;
  return { id: insertId, name };
}


// ============================================
// Liver Monthly Growth Data (成長グラフ用)
// ============================================

/**
 * Get monthly growth data for a specific liver (past 6 months)
 * ライバー個人の月次推移データを取得（売上・配信時間・視聴者数・配信回数）
 */
export async function getLiverMonthlyGrowth(streamerName: string) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const months: { yearMonth: string; label: string; sales: number; duration: number; viewers: number; streamCount: number }[] = [];
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mYear = date.getFullYear();
    const mMonth = date.getMonth() + 1;
    const mMonthKey = `${mYear}-${String(mMonth).padStart(2, "0")}`;
    const label = `${mMonth}月`;
    
    const { startDate, endDate } = getJSTMonthRange(mMonthKey);
    
    const result = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.gmv}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
        totalViewers: sql<number>`COALESCE(SUM(${brandLivestreams.viewerCount}), 0)`,
        streamCount: sql<number>`COUNT(*)`,
      })
      .from(brandLivestreams)
      .where(
        and(
          isNull(brandLivestreams.deletedAt),
          eq(brandLivestreams.streamerName, streamerName),
          sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
          sql`${brandLivestreams.livestreamDate} <= ${endDate}`
        )
      );
    
    months.push({
      yearMonth: mMonthKey,
      label,
      sales: result[0]?.totalSales || 0,
      duration: result[0]?.totalDuration || 0,
      viewers: result[0]?.totalViewers || 0,
      streamCount: result[0]?.streamCount || 0,
    });
  }
  
  return months;
}


/**
 * Count duplicate image rejections for a specific LINE user
 * 同一画像重複で却下された回数をカウント（不正ユーザー判定用）
 */
export async function countDuplicateImageRejections(lineUserId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(lineReceipts)
    .where(
      and(
        eq(lineReceipts.lineUserId, lineUserId),
        eq(lineReceipts.status, "rejected"),
        or(
          sql`${lineReceipts.reviewNote} LIKE '%Level3%'`,
          sql`${lineReceipts.reviewNote} LIKE '%同一画像%'`,
          sql`${lineReceipts.reviewNote} LIKE '%画像ハッシュ重複%'`
        )
      )
    );
  
  return result[0]?.count ?? 0;
}


// ============================================================
// Step Email Template & Log & Analytics helpers
// ============================================================

/** Get all step email templates ordered by delayDays */
export async function getAllStepEmailTemplates() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(stepEmailTemplates).orderBy(asc(stepEmailTemplates.delayDays));
}

/** Get enabled step email templates */
export async function getEnabledStepEmailTemplates() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(stepEmailTemplates)
    .where(eq(stepEmailTemplates.isEnabled, true))
    .orderBy(asc(stepEmailTemplates.delayDays));
}

/** Get step email template by ID */
export async function getStepEmailTemplateById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(stepEmailTemplates).where(eq(stepEmailTemplates.id, id)).limit(1);
  return result[0] ?? null;
}

/** Create step email template */
export async function createStepEmailTemplate(data: InsertStepEmailTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(stepEmailTemplates).values(data);
}

/** Update step email template */
export async function updateStepEmailTemplate(id: number, data: Partial<InsertStepEmailTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(stepEmailTemplates).set(data).where(eq(stepEmailTemplates.id, id));
}

/** Delete step email template */
export async function deleteStepEmailTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(stepEmailTemplates).where(eq(stepEmailTemplates.id, id));
}

/** Create step email log */
export async function createStepEmailLog(data: InsertStepEmailLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(stepEmailLogs).values(data);
}

/** Check if a step email has already been sent to a user for a template */
export async function hasStepEmailBeenSent(templateId: number, lineUserId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ id: stepEmailLogs.id })
    .from(stepEmailLogs)
    .where(and(
      eq(stepEmailLogs.templateId, templateId),
      eq(stepEmailLogs.lineUserId, lineUserId),
      eq(stepEmailLogs.status, "sent")
    ))
    .limit(1);
  return result.length > 0;
}

/** Get step email logs with pagination and filtering */
export async function getStepEmailLogs(opts: {
  page?: number;
  limit?: number;
  status?: string;
  templateId?: number;
  search?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(stepEmailLogs.status, opts.status as any));
  if (opts.templateId) conditions.push(eq(stepEmailLogs.templateId, opts.templateId));
  if (opts.search) conditions.push(like(stepEmailLogs.email, `%${opts.search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, countResult] = await Promise.all([
    db.select({
      log: stepEmailLogs,
      templateName: stepEmailTemplates.name,
    })
      .from(stepEmailLogs)
      .leftJoin(stepEmailTemplates, eq(stepEmailLogs.templateId, stepEmailTemplates.id))
      .where(whereClause)
      .orderBy(desc(stepEmailLogs.sentAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(stepEmailLogs)
      .where(whereClause),
  ]);

  return {
    logs: rows,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  };
}

/** Record email open (tracking pixel hit) */
export async function recordStepEmailOpen(trackingId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stepEmailLogs)
    .set({
      openedAt: sql`COALESCE(opened_at, NOW())`,
      openCount: sql`open_count + 1`,
    })
    .where(eq(stepEmailLogs.trackingId, trackingId));
}

/** Record email link click */
export async function recordStepEmailClick(trackingId: string, url: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find the log entry
  const logResult = await db.select({ id: stepEmailLogs.id })
    .from(stepEmailLogs)
    .where(eq(stepEmailLogs.trackingId, trackingId))
    .limit(1);

  if (logResult.length === 0) return;

  const logId = logResult[0].id;

  // Insert click record
  await db.insert(stepEmailClicks).values({
    logId,
    trackingId,
    url,
  });

  // Update log click stats
  await db.update(stepEmailLogs)
    .set({
      clickedAt: sql`COALESCE(clicked_at, NOW())`,
      clickCount: sql`click_count + 1`,
    })
    .where(eq(stepEmailLogs.trackingId, trackingId));
}

/** Get step email analytics summary */
export async function getStepEmailAnalytics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Overall stats
  const overallStats = await db.select({
    totalSent: sql<number>`COUNT(CASE WHEN status = 'sent' THEN 1 END)`,
    totalFailed: sql<number>`COUNT(CASE WHEN status = 'failed' THEN 1 END)`,
    totalSkipped: sql<number>`COUNT(CASE WHEN status = 'skipped' THEN 1 END)`,
    totalOpened: sql<number>`COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)`,
    totalClicked: sql<number>`COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)`,
    totalOpenCount: sql<number>`COALESCE(SUM(open_count), 0)`,
    totalClickCount: sql<number>`COALESCE(SUM(click_count), 0)`,
  }).from(stepEmailLogs);

  // Per-template stats
  const perTemplateStats = await db.select({
    templateId: stepEmailLogs.templateId,
    templateName: stepEmailTemplates.name,
    delayDays: stepEmailTemplates.delayDays,
    sent: sql<number>`COUNT(CASE WHEN ${stepEmailLogs.status} = 'sent' THEN 1 END)`,
    failed: sql<number>`COUNT(CASE WHEN ${stepEmailLogs.status} = 'failed' THEN 1 END)`,
    opened: sql<number>`COUNT(CASE WHEN ${stepEmailLogs.openedAt} IS NOT NULL THEN 1 END)`,
    clicked: sql<number>`COUNT(CASE WHEN ${stepEmailLogs.clickedAt} IS NOT NULL THEN 1 END)`,
  })
    .from(stepEmailLogs)
    .leftJoin(stepEmailTemplates, eq(stepEmailLogs.templateId, stepEmailTemplates.id))
    .groupBy(stepEmailLogs.templateId, stepEmailTemplates.name, stepEmailTemplates.delayDays)
    .orderBy(asc(stepEmailTemplates.delayDays));

  // Daily send trend (last 30 days)
  const dailyTrend = await db.select({
    date: sql<string>`DATE(sentAt)`.as("date"),
    sent: sql<number>`COUNT(CASE WHEN status = 'sent' THEN 1 END)`,
    opened: sql<number>`COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)`,
    clicked: sql<number>`COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)`,
  })
    .from(stepEmailLogs)
    .where(gte(stepEmailLogs.sentAt, sql`DATE_SUB(NOW(), INTERVAL 30 DAY)`))
    .groupBy(sql`DATE(sentAt)`)
    .orderBy(asc(sql`DATE(sentAt)`));

  return {
    overall: overallStats[0],
    perTemplate: perTemplateStats,
    dailyTrend,
  };
}

/** Get users eligible for step emails (registered users with email, not yet sent for a given template) */
export async function getEligibleUsersForStepEmail(templateId: number, delayDays: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find line_users who registered at least delayDays ago AND haven't received this template yet
  const cutoffDate = new Date(Date.now() - delayDays * 24 * 60 * 60 * 1000);

  const result = await db.select({
    id: lineUsers.id,
    email: lineUsers.email,
    displayName: lineUsers.displayName,
    lineUserId: lineUsers.lineUserId,
  })
    .from(lineUsers)
    .where(and(
      isNotNull(lineUsers.email),
      lte(lineUsers.createdAt, cutoffDate),
      // Exclude users who already received this template
      sql`${lineUsers.id} NOT IN (
        SELECT lineUserId FROM step_email_logs 
        WHERE templateId = ${templateId} AND status = 'sent'
      )`
    ));

  return result;
}


// ============================================================
// Brand Sample Application helpers
// ============================================================

export async function createBrandSampleApplication(data: InsertBrandSampleApplication) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(brandSampleApplications).values(data);
  return { success: true };
}

export async function listBrandSampleApplications(filters?: { status?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [];
  if (filters?.status) {
    conditions.push(eq(brandSampleApplications.status, filters.status as any));
  }

  const query = db.select().from(brandSampleApplications);
  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(brandSampleApplications.createdAt)).limit(filters?.limit ?? 50).offset(filters?.offset ?? 0)
    : await query.orderBy(desc(brandSampleApplications.createdAt)).limit(filters?.limit ?? 50).offset(filters?.offset ?? 0);

  return rows;
}

export async function getBrandSampleApplicationById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(brandSampleApplications).where(eq(brandSampleApplications.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateBrandSampleApplicationStatus(id: number, status: string, reviewNote?: string, reviewedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(brandSampleApplications).set({
    status: status as any,
    reviewNote: reviewNote ?? null,
    reviewedBy: reviewedBy ?? null,
    reviewedAt: new Date(),
  }).where(eq(brandSampleApplications.id, id));
  return { success: true };
}

export async function countBrandSampleApplications() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select({ count: sql<number>`count(*)` }).from(brandSampleApplications);
  return result[0]?.count ?? 0;
}


// =============================================
// ライバー売上×配信時間チェック＆訂正機能
// =============================================

/**
 * 全ライバーの配信記録を月別に取得（チェック用）
 * ライバー名、ブランド名を含む
 */
export async function getLivestreamsForSalesCheck(month: string, liverId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { startDate, endDate } = getJSTMonthRange(month);
  
  const conditions = [
    isNull(brandLivestreams.deletedAt),
    sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
    sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
  ];
  
  if (liverId) {
    conditions.push(eq(brandLivestreams.liverId, liverId));
  }
  
  const results = await db
    .select({
      id: brandLivestreams.id,
      liverId: brandLivestreams.liverId,
      liverName: livers.name,
      liverColor: livers.color,
      liverAvatar: livers.avatarUrl,
      brandId: brandLivestreams.brandId,
      brandName: brands.name,
      livestreamDate: brandLivestreams.livestreamDate,
      livestreamEndTime: brandLivestreams.livestreamEndTime,
      salesAmount: brandLivestreams.salesAmount,
      manualSalesAmount: brandLivestreams.manualSalesAmount,
      duration: brandLivestreams.duration,
      viewerCount: brandLivestreams.viewerCount,
      orderCount: brandLivestreams.orderCount,
      screenshotUrl: brandLivestreams.screenshotUrl,
      beforeScreenshotUrl: brandLivestreams.beforeScreenshotUrl,
      result: brandLivestreams.result,
      remarks: brandLivestreams.remarks,
      streamerName: brandLivestreams.streamerName,
      livestreamStartTime: brandLivestreams.livestreamStartTime,
    })
    .from(brandLivestreams)
    .leftJoin(livers, eq(brandLivestreams.liverId, livers.id))
    .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
    .where(and(...conditions))
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  return results;
}

/**
 * 配信記録の売上・配信時間を訂正（管理者用）
 */
export async function correctLivestreamData(
  id: number,
  data: {
    salesAmount?: number | null;
    duration?: number | null;
    viewerCount?: number | null;
    orderCount?: number | null;
    remarks?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = {};
  if (data.salesAmount !== undefined) updateData.salesAmount = data.salesAmount;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.viewerCount !== undefined) updateData.viewerCount = data.viewerCount;
  if (data.orderCount !== undefined) updateData.orderCount = data.orderCount;
  if (data.remarks !== undefined) updateData.remarks = data.remarks;
  
  await db.update(brandLivestreams).set(updateData).where(eq(brandLivestreams.id, id));
  return { success: true };
}


// ========== AB Test Events ==========

export async function recordAbTestEvent(data: {
  sessionId: string;
  variantId: string;
  eventType: "view" | "cta_click" | "scroll_past_hero";
  dwellTimeMs?: number;
  pageUrl?: string;
  userAgent?: string;
  referrer?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(abTestEvents).values({
    sessionId: data.sessionId,
    variantId: data.variantId,
    eventType: data.eventType,
    dwellTimeMs: data.dwellTimeMs ?? null,
    pageUrl: data.pageUrl ?? null,
    userAgent: data.userAgent ?? null,
    referrer: data.referrer ?? null,
  });
  return { success: true };
}

export async function getAbTestStats() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get all events grouped by variant
  const allEvents = await db.select().from(abTestEvents).orderBy(desc(abTestEvents.createdAt));
  
  // Group by variant
  const variantMap: Record<string, {
    views: number;
    ctaClicks: number;
    scrollPastHero: number;
    totalDwellTimeMs: number;
    dwellTimeCount: number;
    sessions: Set<string>;
  }> = {};
  
  for (const event of allEvents) {
    if (!variantMap[event.variantId]) {
      variantMap[event.variantId] = {
        views: 0,
        ctaClicks: 0,
        scrollPastHero: 0,
        totalDwellTimeMs: 0,
        dwellTimeCount: 0,
        sessions: new Set(),
      };
    }
    const v = variantMap[event.variantId];
    v.sessions.add(event.sessionId);
    if (event.eventType === "view") v.views++;
    if (event.eventType === "cta_click") v.ctaClicks++;
    if (event.eventType === "scroll_past_hero") v.scrollPastHero++;
    if (event.dwellTimeMs) {
      v.totalDwellTimeMs += Number(event.dwellTimeMs);
      v.dwellTimeCount++;
    }
  }
  
  return Object.entries(variantMap).map(([variantId, data]) => ({
    variantId,
    uniqueSessions: data.sessions.size,
    views: data.views,
    ctaClicks: data.ctaClicks,
    scrollPastHero: data.scrollPastHero,
    ctaRate: data.views > 0 ? Math.round((data.ctaClicks / data.views) * 10000) / 100 : 0,
    avgDwellTimeSec: data.dwellTimeCount > 0 ? Math.round(data.totalDwellTimeMs / data.dwellTimeCount / 1000 * 10) / 10 : 0,
  }));
}

export async function getAbTestRecentEvents(limit: number = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(abTestEvents).orderBy(desc(abTestEvents.createdAt)).limit(limit);
}


// ============================================
// Streaming Locations (配信場所マスタ) functions
// ============================================

export async function getAllStreamingLocations() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(streamingLocations).orderBy(asc(streamingLocations.sortOrder), asc(streamingLocations.name));
}

export async function getActiveStreamingLocations() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(streamingLocations)
    .where(eq(streamingLocations.isActive, true))
    .orderBy(asc(streamingLocations.sortOrder), asc(streamingLocations.name));
}

export async function getStreamingLocationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(streamingLocations).where(eq(streamingLocations.id, id)).limit(1);
  return result[0] || null;
}

export async function createStreamingLocation(data: Partial<InsertStreamingLocation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(streamingLocations).values(data as InsertStreamingLocation);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

export async function updateStreamingLocation(id: number, data: Partial<InsertStreamingLocation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(streamingLocations).set(data).where(eq(streamingLocations.id, id));
  return { id, ...data };
}

export async function deleteStreamingLocation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // ソフトデリート
  await db.update(streamingLocations).set({ isActive: false }).where(eq(streamingLocations.id, id));
  return { id, deleted: true };
}


// ============================================
// ライバー収益分析（TAP: クリエイター別 純利益ランキング）
// ============================================

export async function getTiktokTapCreatorProfitability(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  return db.select({
    creatorUsername: tiktokTapReports.creatorUsername,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalActualPartnerCommission: sql<number>`COALESCE(SUM(actualPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalActualCreatorCommission: sql<number>`COALESCE(SUM(actualCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalSettledGmv: sql<number>`COALESCE(SUM(settledGmv), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    totalLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    totalVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
    totalLiveCount: sql<number>`COALESCE(SUM(liveCount), 0)`,
    totalVideoCount: sql<number>`COALESCE(SUM(videoCount), 0)`,
    productCount: sql<number>`COUNT(DISTINCT productId)`,
    shopCount: sql<number>`COUNT(DISTINCT shopName)`,
    // 純利益 = LCJ手数料(見込) - C手数料(見込)
    netProfit: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0) - COALESCE(SUM(estimatedCreatorCommission), 0)`,
  }).from(tiktokTapReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokTapReports.creatorUsername)
    .orderBy(sql`COALESCE(SUM(estimatedPartnerCommission), 0) DESC`);
}

// ライバー別 商品内訳ドリルダウン
export async function getTiktokTapCreatorProductBreakdown(creatorUsername: string, brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(tiktokTapReports.creatorUsername, creatorUsername)];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  return db.select({
    productId: tiktokTapReports.productId,
    productName: tiktokTapReports.productName,
    shopName: sql<string>`MAX(shopName)`,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    netProfit: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0) - COALESCE(SUM(estimatedCreatorCommission), 0)`,
  }).from(tiktokTapReports)
    .where(and(...conditions))
    .groupBy(tiktokTapReports.productId, tiktokTapReports.productName)
    .orderBy(sql`COALESCE(SUM(estimatedPartnerCommission), 0) DESC`);
}

// 商品別 ライバー内訳ドリルダウン（商品利益率ランキングの行クリック用）
export async function getTiktokTapProductCreatorBreakdown(productName: string, brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(tiktokTapReports.productName, productName)];
  if (brandId > 0) conditions.push(eq(tiktokTapReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokTapReports.reportMonth, month));
  
  return db.select({
    creatorUsername: tiktokTapReports.creatorUsername,
    totalAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    totalOrders: sql<number>`COALESCE(SUM(orders), 0)`,
    totalSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    totalEstimatedPartnerCommission: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0)`,
    totalEstimatedCreatorCommission: sql<number>`COALESCE(SUM(estimatedCreatorCommission), 0)`,
    totalGmvRefund: sql<number>`COALESCE(SUM(gmvRefund), 0)`,
    totalLiveGmv: sql<number>`COALESCE(SUM(liveGmv), 0)`,
    totalVideoGmv: sql<number>`COALESCE(SUM(videoGmv), 0)`,
    netProfit: sql<number>`COALESCE(SUM(estimatedPartnerCommission), 0) - COALESCE(SUM(estimatedCreatorCommission), 0)`,
  }).from(tiktokTapReports)
    .where(and(...conditions))
    .groupBy(tiktokTapReports.creatorUsername)
    .orderBy(sql`COALESCE(SUM(estimatedPartnerCommission), 0) DESC`);
}


// =============================================
// TikTok CAP Report Functions
// =============================================

// CAP Creator Reports - 一括挿入
export async function bulkInsertCapCreatorReports(rows: InsertTiktokCapCreatorReport[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return;
  // batch insert in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await db.insert(tiktokCapCreatorReports).values(chunk);
  }
}

// CAP Product Reports - 一括挿入
export async function bulkInsertCapProductReports(rows: InsertTiktokCapProductReport[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    await db.insert(tiktokCapProductReports).values(chunk);
  }
}

// CAP Creator Reports - 月+ブランドで既存データ削除（再インポート用）
export async function deleteCapCreatorReportsByMonth(brandId: number, reportMonth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tiktokCapCreatorReports).where(
    and(eq(tiktokCapCreatorReports.brandId, brandId), eq(tiktokCapCreatorReports.reportMonth, reportMonth))
  );
}

// CAP Product Reports - 月+ブランドで既存データ削除（再インポート用）
export async function deleteCapProductReportsByMonth(brandId: number, reportMonth: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(tiktokCapProductReports).where(
    and(eq(tiktokCapProductReports.brandId, brandId), eq(tiktokCapProductReports.reportMonth, reportMonth))
  );
}

// CAP Creator Summary - ライバー別集計（TAPと突合用）
export async function getCapCreatorSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokCapCreatorReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokCapCreatorReports.reportMonth, month));

  return db.select({
    creatorUsername: tiktokCapCreatorReports.creatorUsername,
    capAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    capEstimatedCommission: sql<number>`COALESCE(SUM(estimatedCommission), 0)`,
    capCommissionBase: sql<number>`COALESCE(SUM(commissionBase), 0)`,
    capOrders: sql<number>`COALESCE(SUM(affiliateOrders), 0)`,
    capSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
    capLiveGmv: sql<number>`COALESCE(SUM(affiliateLiveGmv), 0)`,
    capVideoGmv: sql<number>`COALESCE(SUM(affiliateVideoGmv), 0)`,
    capLiveViews: sql<number>`COALESCE(SUM(liveViews), 0)`,
    capVideoViews: sql<number>`COALESCE(SUM(videoViews), 0)`,
  }).from(tiktokCapCreatorReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokCapCreatorReports.creatorUsername);
}

// CAP Product Summary - 商品別集計（商品利益率ランキング用）
export async function getCapProductSummary(brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokCapProductReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokCapProductReports.reportMonth, month));

  return db.select({
    productId: tiktokCapProductReports.productId,
    productName: sql<string>`MAX(productName)`,
    shopName: sql<string>`MAX(shopName)`,
    capAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    capOrders: sql<number>`COALESCE(SUM(affiliateOrders), 0)`,
    capDirectRefundGmv: sql<number>`COALESCE(SUM(directRefundGmv), 0)`,
    capRefundedItems: sql<number>`COALESCE(SUM(refundedItems), 0)`,
    capSalesCount: sql<number>`COALESCE(SUM(salesCount), 0)`,
  }).from(tiktokCapProductReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tiktokCapProductReports.productId);
}

// CAP Creator-Product Breakdown - ライバー別の商品内訳（ドリルダウン用）
export async function getCapCreatorProductBreakdown(creatorUsername: string, brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [eq(tiktokCapProductReports.creatorUsername, creatorUsername)];
  if (brandId > 0) conditions.push(eq(tiktokCapProductReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokCapProductReports.reportMonth, month));

  return db.select({
    productId: tiktokCapProductReports.productId,
    productName: sql<string>`MAX(productName)`,
    shopName: sql<string>`MAX(shopName)`,
    capAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    capOrders: sql<number>`COALESCE(SUM(affiliateOrders), 0)`,
    capDirectRefundGmv: sql<number>`COALESCE(SUM(directRefundGmv), 0)`,
    capRefundedItems: sql<number>`COALESCE(SUM(refundedItems), 0)`,
  }).from(tiktokCapProductReports)
    .where(and(...conditions))
    .groupBy(tiktokCapProductReports.productId);
}

// CAP Product-Creator Breakdown - 商品別のライバー内訳（ドリルダウン用）
export async function getCapProductCreatorBreakdown(productName: string, brandId: number = 0, month?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [sql`productName = ${productName}`];
  if (brandId > 0) conditions.push(eq(tiktokCapProductReports.brandId, brandId));
  if (month) conditions.push(eq(tiktokCapProductReports.reportMonth, month));

  return db.select({
    creatorUsername: tiktokCapProductReports.creatorUsername,
    capAffiliateGmv: sql<number>`COALESCE(SUM(affiliateGmv), 0)`,
    capOrders: sql<number>`COALESCE(SUM(affiliateOrders), 0)`,
    capDirectRefundGmv: sql<number>`COALESCE(SUM(directRefundGmv), 0)`,
    capRefundedItems: sql<number>`COALESCE(SUM(refundedItems), 0)`,
  }).from(tiktokCapProductReports)
    .where(and(...conditions))
    .groupBy(tiktokCapProductReports.creatorUsername);
}

// CAP Available Months - 利用可能な月一覧
export async function getCapAvailableMonths(brandId: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (brandId > 0) conditions.push(eq(tiktokCapCreatorReports.brandId, brandId));

  return db.selectDistinct({
    month: tiktokCapCreatorReports.reportMonth,
  }).from(tiktokCapCreatorReports)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tiktokCapCreatorReports.reportMonth));
}
