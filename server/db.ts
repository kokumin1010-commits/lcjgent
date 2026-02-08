import { eq, and, desc, asc, sql, or, like, inArray, not, isNotNull, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, staff, InsertStaff, tasks, InsertTask, reminders, InsertReminder, taskStaff, InsertTaskStaff, emailTracking, InsertEmailTracking, reportStaff, InsertReportStaff, reports, InsertReport, brands, InsertBrand, brandProducts, InsertBrandProduct, brandActivities, InsertBrandActivity, brandLivestreams, InsertBrandLivestream, reportFollowups, InsertReportFollowup, businessCards, InsertBusinessCard, brandLcjStaff, InsertBrandLcjStaff, activityLogs, InsertActivityLog, brandContracts, InsertBrandContract, reportAiAdvice, InsertReportAiAdvice, aiAdviceFeedback, InsertAiAdviceFeedback, aiLearningExamples, InsertAiLearningExample, chatReportSessions, InsertChatReportSession, chatReportMessages, InsertChatReportMessage, staffAiProfiles, InsertStaffAiProfile, aiQuestionTemplates, InsertAiQuestionTemplate, lineUsers, InsertLineUser, lineGroups, InsertLineGroup, lineMessages, InsertLineMessage, lineFollowUps, InsertLineFollowUp, schedules, InsertSchedule, livers, InsertLiver, livestreamProducts, InsertLivestreamProduct, brandMemos, InsertBrandMemo, contractLivestreamLinks, InsertContractLivestreamLink, brandEditLogs, InsertBrandEditLog, brandProductImages, InsertBrandProductImage, brandFiles, InsertBrandFile, productLinks, InsertProductLink, csvImportHistory, InsertCsvImportHistory, livestreamCsvImportHistory, InsertLivestreamCsvImportHistory, adProposalHistory, InsertAdProposalHistory, pointBalances, InsertPointBalance, pointTransactions, InsertPointTransaction, receipts, InsertReceipt, fraudDetectionLogs, InsertFraudDetectionLog, linePointBalances, InsertLinePointBalance, linePointTransactions, InsertLinePointTransaction, lineReceipts, InsertLineReceipt, lineFraudDetectionLogs, InsertLineFraudDetectionLog, mallProducts, InsertMallProduct, mallOrders, InsertMallOrder, mallOrderItems, InsertMallOrderItem, mallCarts, InsertMallCart, userAddresses, InsertUserAddress, linePasswordResetTokens, InsertLinePasswordResetToken, lineLinkCodes, InsertLineLinkCode, screenshotAnalysisHistory, InsertScreenshotAnalysisHistory, pointRequests, InsertPointRequest, passwordResetTokens, InsertPasswordResetToken, scheduleGroups, InsertScheduleGroup, scheduleGroupMembers, InsertScheduleGroupMember, liverPasswordResetTokens, InsertLiverPasswordResetToken, productLivers, InsertProductLiver, lineReminders, InsertLineReminder, liverGoals, InsertLiverGoal, productMaster, InsertProductMaster, productNameAliases, InsertProductNameAlias, productAliasSuggestions, InsertProductAliasSuggestion, adCampaigns, InsertAdCampaign, adMetrics, InsertAdMetric, adCountryBreakdown, InsertAdCountryBreakdown, adReportFiles, InsertAdReportFile, tiktokCommissionOrders, InsertTiktokCommissionOrder, tiktokCsvImportHistory, InsertTiktokCsvImportHistory, livestreamSets, InsertLivestreamSet, livestreamSetItems, InsertLivestreamSetItem } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

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
  
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(brands.status, filters.status as any));
  }
  if (filters?.search) {
    conditions.push(like(brands.name, `%${filters.search}%`));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const brandsResult = await query.orderBy(desc(brands.updatedAt));
  
  // Get GMV totals and contract totals for each brand
  const brandsWithStats = await Promise.all(
    brandsResult.map(async (brand) => {
      // Get GMV from livestreams
      const livestreams = await db
        .select({ gmv: brandLivestreams.gmv })
        .from(brandLivestreams)
        .where(eq(brandLivestreams.brandId, brand.id));
      
      const totalGmv = livestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
      
      // Get total contract amount (fixedFee) from contracts
      const contracts = await db
        .select({ fixedFee: brandContracts.fixedFee })
        .from(brandContracts)
        .where(eq(brandContracts.brandId, brand.id));
      
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
  
  const result = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
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
  
  // Delete related products and activities first
  await db.delete(brandProducts).where(eq(brandProducts.brandId, id));
  await db.delete(brandActivities).where(eq(brandActivities.brandId, id));
  await db.delete(brands).where(eq(brands.id, id));
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
  
  return await db.select().from(brandProducts).orderBy(desc(brandProducts.createdAt));
}

// Get products by brand ID
export async function getProductsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandProducts).where(eq(brandProducts.brandId, brandId)).orderBy(desc(brandProducts.createdAt));
}

// Get products by brand ID with GMV from linked livestreams
export async function getProductsByBrandIdWithGmv(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all products for the brand
  const products = await db.select().from(brandProducts).where(eq(brandProducts.brandId, brandId)).orderBy(desc(brandProducts.createdAt));
  
  // Get all livestreams for the brand that have a productId
  const livestreams = await db.select().from(brandLivestreams).where(
    and(
      eq(brandLivestreams.brandId, brandId),
      isNotNull(brandLivestreams.productId)
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
  
  const result = await db.select().from(brandProducts).where(eq(brandProducts.id, id)).limit(1);
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
  
  await db.delete(brandProducts).where(eq(brandProducts.id, id));
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
  
  return await db.select().from(brandActivities).where(eq(brandActivities.brandId, brandId)).orderBy(desc(brandActivities.activityDate));
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
  
  await db.delete(brandActivities).where(eq(brandActivities.id, id));
}

// Get brand statistics
export async function getBrandStatistics() {
  const db = await getDb();
  if (!db) return { total: 0, byStatus: {} };
  
  const allBrands = await db.select().from(brands);
  
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
  
  const livestreams = await db.select().from(brandLivestreams).where(eq(brandLivestreams.brandId, brandId)).orderBy(desc(brandLivestreams.livestreamDate));
  
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

// Delete livestream
export async function deleteBrandLivestream(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandLivestreams).where(eq(brandLivestreams.id, id));
}

// Get all livestreams (for statistics)
export async function getAllLivestreams() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandLivestreams).orderBy(desc(brandLivestreams.livestreamDate));
}

// Get livestream statistics for a brand
export async function getLivestreamStatsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return { totalSales: 0, totalStreams: 0, avgSales: 0 };
  
  const livestreams = await db.select().from(brandLivestreams).where(eq(brandLivestreams.brandId, brandId));
  
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
    .where(inArray(brands.id, brandIds.map(b => b.brandId)))
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
    .where(eq(brandContracts.brandId, brandId))
    .orderBy(desc(brandContracts.createdAt));
}

// Get contract by ID
export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(brandContracts)
    .where(eq(brandContracts.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Update a brand contract
export async function updateBrandContract(id: number, data: Partial<InsertBrandContract>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandContracts).set(data).where(eq(brandContracts.id, id));
}

// Delete a brand contract (and all related livestream links)
export async function deleteBrandContract(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First, delete all related livestream links
  await deleteAllContractLivestreamLinks(id);
  
  // Then delete the contract itself
  await db.delete(brandContracts).where(eq(brandContracts.id, id));
}

// Get all contracts (for statistics)
export async function getAllContracts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandContracts).orderBy(desc(brandContracts.createdAt));
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
      eq(brandContracts.status, "契約中")
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
    .where(eq(brandLivestreams.liverId, liverId));
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
    .where(eq(brandLivestreams.liverId, liverId))
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
    const insertData = products.map(p => ({
      livestreamId,
      productName: p.productName,
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
    .where(eq(brandLivestreams.brandId, brandId));
  
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
    .where(eq(brandLivestreams.brandId, brandId))
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
    .where(eq(brandMemos.brandId, brandId))
    .orderBy(desc(brandMemos.createdAt));
}

export async function deleteBrandMemo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(brandMemos).where(eq(brandMemos.id, id));
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
    .where(inArray(brandLivestreams.id, livestreamIds))
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
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate}`);
    conditions.push(sql`${brandLivestreams.livestreamDate} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(brandLivestreams)
    .where(and(...conditions))
    .orderBy(desc(brandLivestreams.livestreamDate));
}

// Get liver statistics (monthly sales, total hours)
export async function getLiverStatistics(liverId: number, month?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [eq(brandLivestreams.liverId, liverId)];
  
  if (month) {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
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
    .where(and(...conditions));
  
  return result[0];
}

// Get liver rankings (sales ranking, duration ranking)
// Group by liverId only to avoid duplicate entries for same liver with different streamerName
export async function getLiverRankings(month: string) {
  const db = await getDb();
  if (!db) return { salesRanking: [], durationRanking: [] };
  
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Sales ranking - group by liverId only, use MAX for streamerName
  const salesRanking = await db
    .select({
      liverId: brandLivestreams.liverId,
      streamerName: sql<string>`MAX(${brandLivestreams.streamerName})`,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
    })
    .from(brandLivestreams)
    .where(
      and(
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        isNotNull(brandLivestreams.liverId)
      )
    )
    .groupBy(brandLivestreams.liverId)
    .orderBy(sql`SUM(${brandLivestreams.salesAmount}) DESC`)
    .limit(10);
  
  // Duration ranking - group by liverId only, use MAX for streamerName
  const durationRanking = await db
    .select({
      liverId: brandLivestreams.liverId,
      streamerName: sql<string>`MAX(${brandLivestreams.streamerName})`,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
    })
    .from(brandLivestreams)
    .where(
      and(
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`,
        isNotNull(brandLivestreams.liverId)
      )
    )
    .groupBy(brandLivestreams.liverId)
    .orderBy(sql`SUM(${brandLivestreams.duration}) DESC`)
    .limit(10);
  
  return { salesRanking, durationRanking };
}

// Get livestream by ID with brand info
export async function getLivestreamById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(brandLivestreams)
    .where(eq(brandLivestreams.id, id))
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
export async function getLiversWithStats(month: string) {
  const db = await getDb();
  if (!db) return [];
  
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Get all active livers
  const allLivers = await db
    .select()
    .from(livers)
    .where(eq(livers.isActive, true))
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
    .where(eq(brandFiles.brandId, brandId))
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
  
  await db
    .delete(brandFiles)
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
    .where(eq(brandFiles.id, fileId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}


// ==================== Product Links Functions ====================

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
    .where(eq(brandLivestreams.brandId, brandId));
  
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
  
  // Delete all livestreams within the date range that were imported via CSV
  if (dateRangeStart && dateRangeEnd) {
    await db
      .delete(brandLivestreams)
      .where(
        and(
          eq(brandLivestreams.liverId, liverId),
          eq(brandLivestreams.brandId, brandId),
          eq(brandLivestreams.csvImported, "yes"),
          gte(brandLivestreams.livestreamDate, dateRangeStart),
          lte(brandLivestreams.livestreamDate, dateRangeEnd)
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
  
  const balance = await getOrCreatePointBalance(userId);
  
  const newBalance = balance.balance + balanceChange;
  const newTotalEarned = type === "earn" ? balance.totalEarned + balanceChange : balance.totalEarned;
  const newTotalUsed = type === "use" ? balance.totalUsed + Math.abs(balanceChange) : balance.totalUsed;
  
  await db
    .update(pointBalances)
    .set({
      balance: newBalance,
      totalEarned: newTotalEarned,
      totalUsed: newTotalUsed,
    })
    .where(eq(pointBalances.userId, userId));
  
  return { balance: newBalance, totalEarned: newTotalEarned, totalUsed: newTotalUsed };
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
  
  // Create transaction
  await db.insert(pointTransactions).values({
    userId: data.userId,
    type: data.type,
    amount: data.amount,
    balanceAfter,
    referenceType: data.referenceType,
    referenceId: data.referenceId,
    description: data.description,
  });
  
  // Update balance
  if (data.type === "earn" || data.type === "refund") {
    await updatePointBalance(data.userId, data.amount, "earn");
  } else if (data.type === "use") {
    await updatePointBalance(data.userId, data.amount, "use");
  } else {
    // For expire and adjustment, just update the balance directly
    await db
      .update(pointBalances)
      .set({ balance: balanceAfter })
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
  
  let conditions = eq(receipts.imageHash, imageHash);
  
  if (excludeId) {
    const result = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.imageHash, imageHash), not(eq(receipts.id, excludeId))))
      .limit(1);
    return result[0] || null;
  }
  
  const result = await db
    .select()
    .from(receipts)
    .where(conditions)
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
  
  return result[0] || null;
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
  
  const balance = await getOrCreateLinePointBalance(lineUserId);
  
  const newBalance = balance.balance + balanceChange;
  const newTotalEarned = type === "earn" ? balance.totalEarned + balanceChange : balance.totalEarned;
  const newTotalUsed = type === "use" ? balance.totalUsed + Math.abs(balanceChange) : balance.totalUsed;
  
  await db
    .update(linePointBalances)
    .set({
      balance: newBalance,
      totalEarned: newTotalEarned,
      totalUsed: newTotalUsed,
    })
    .where(eq(linePointBalances.lineUserId, lineUserId));
  
  return { balance: newBalance, totalEarned: newTotalEarned, totalUsed: newTotalUsed };
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
  
  // Create transaction
  await db.insert(linePointTransactions).values({
    lineUserId: data.lineUserId,
    type: data.type,
    amount: data.amount,
    balanceAfter,
    referenceType: data.referenceType,
    referenceId: data.referenceId,
    description: data.description,
  });
  
  // Update balance
  if (data.type === "earn" || data.type === "refund") {
    await updateLinePointBalance(data.lineUserId, data.amount, "earn");
  } else if (data.type === "use") {
    await updateLinePointBalance(data.lineUserId, data.amount, "use");
  } else {
    // For expire and adjustment, just update the balance directly
    await db
      .update(linePointBalances)
      .set({ balance: balanceAfter })
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
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let query = db
    .select({
      receipt: lineReceipts,
      lineUser: lineUsers,
    })
    .from(lineReceipts)
    .leftJoin(lineUsers, eq(lineReceipts.lineUserId, lineUsers.lineUserId))
    .orderBy(desc(lineReceipts.submittedAt));
  
  if (options?.status) {
    query = query.where(eq(lineReceipts.status, options.status)) as typeof query;
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
  
  return { success: true, pointsAwarded: points };
}

/**
 * Check for duplicate LINE receipt by image hash
 */
export async function checkDuplicateLineReceiptByHash(imageHash: string, excludeId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (excludeId) {
    const result = await db
      .select()
      .from(lineReceipts)
      .where(and(eq(lineReceipts.imageHash, imageHash), not(eq(lineReceipts.id, excludeId))))
      .limit(1);
    return result[0] || null;
  }
  
  const result = await db
    .select()
    .from(lineReceipts)
    .where(eq(lineReceipts.imageHash, imageHash))
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

  let query = db.select().from(mallProducts);
  
  const conditions = [];
  if (options?.status) {
    conditions.push(eq(mallProducts.status, options.status));
  }
  if (options?.category) {
    conditions.push(eq(mallProducts.category, options.category));
  }
  
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
  items: Array<{
    productId: number;
    quantity: number;
    usePoints: boolean;
  }>;
  pointsToUse: number;
  shippingInfo?: {
    name?: string;
    phone?: string;
    postalCode?: string;
    address?: string;
  };
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
  const pointsUsed = Math.min(data.pointsToUse, totalAmount);
  const cashAmount = totalAmount - pointsUsed;

  // 注文を作成
  const orderNumber = generateOrderNumber();
  const [orderResult] = await db.insert(mallOrders).values({
    orderNumber,
    lineUserId: data.lineUserId,
    totalAmount,
    pointsUsed,
    cashAmount,
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
      .where(eq(linePointBalances.lineUserId, String(data.lineUserId)));

    // ポイント取引履歴を追加
    await db.insert(linePointTransactions).values({
      lineUserId: String(data.lineUserId),
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

  return { orderId, orderNumber, totalAmount, pointsUsed, cashAmount };
}

// 注文一覧取得（管理者用）
export async function getMallOrders(options?: {
  status?: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
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
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled",
  adminNotes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Partial<InsertMallOrder> = { status };
  
  if (status === "shipped") {
    updateData.shippedAt = new Date();
  } else if (status === "delivered") {
    updateData.deliveredAt = new Date();
  }
  
  if (adminNotes !== undefined) {
    updateData.adminNotes = adminNotes;
  }

  await db.update(mallOrders).set(updateData).where(eq(mallOrders.id, id));
}

// ユーザーの注文一覧取得
export async function getMallOrdersByLineUser(lineUserId: number) {
  const db = await getDb();
  if (!db) return [];

  const orders = await db.select()
    .from(mallOrders)
    .where(eq(mallOrders.lineUserId, lineUserId))
    .orderBy(desc(mallOrders.createdAt));

  // 各注文の明細を取得
  const ordersWithItems = await Promise.all(
    orders.map(async (order) => {
      const items = await db.select()
        .from(mallOrderItems)
        .where(eq(mallOrderItems.orderId, order.id));
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
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(lineUsers).values({
    email: data.email,
    password: data.password,
    displayName: data.displayName,
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
 */
export async function checkOrderNumberExists(orderNumber: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select({ id: pointRequests.id })
    .from(pointRequests)
    .where(eq(pointRequests.orderNumber, orderNumber))
    .limit(1);
  
  return result.length > 0;
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
  
  // Record transaction
  await db.insert(pointTransactions).values({
    userId,
    type: "earn",
    amount: points,
    balanceAfter: currentBalance,
    referenceType: "receipt",
    referenceId: pointRequestId,
    description,
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
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
    whereConditions = and(
      whereConditions,
      sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
      sql`${brandLivestreams.livestreamDate} <= ${endDate}`
    ) as any;
  }
  
  const livestreams = await db
    .select()
    .from(brandLivestreams)
    .where(whereConditions)
    .orderBy(sql`${brandLivestreams.livestreamDate} DESC`);
  
  const totalSales = livestreams.reduce((sum, l) => sum + (l.gmv || 0), 0);
  const totalDuration = livestreams.reduce((sum, l) => sum + (l.duration || 0), 0);
  
  return { livestreams, totalSales, totalDuration };
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
    .where(eq(brandProducts.brandId, brandId));

  if (products.length === 0) return [];

  const productIds = products.map(p => p.id);

  // Get all livestreams for these products
  const livestreams = await db.select({
    liverId: brandLivestreams.liverId,
    gmv: brandLivestreams.gmv,
  })
    .from(brandLivestreams)
    .where(and(
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
 */
export async function checkDuplicateOrderNumberGlobal(
  orderNumber: string,
  excludeId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Search for the order number in ocrRawText JSON field
  // ocrRawText contains: {"orderNumber": "...", "shopName": "...", ...}
  let conditions = sql`JSON_EXTRACT(${lineReceipts.ocrRawText}, '$.orderNumber') = ${orderNumber}`;
  
  if (excludeId) {
    conditions = sql`${conditions} AND ${lineReceipts.id} != ${excludeId}`;
  }
  
  const result = await db
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
  
  return result[0] || null;
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
  
  // Parse yearMonth to get date range
  const [year, month] = yearMonth.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  // Get current month's livestreams
  const currentMonthStreams = await db.select()
    .from(brandLivestreams)
    .where(and(
      eq(brandLivestreams.liverId, liverId),
      gte(brandLivestreams.livestreamDate, startDate),
      lte(brandLivestreams.livestreamDate, endDate)
    ))
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  // Calculate current month stats
  const currentMonthSales = currentMonthStreams.reduce((sum, s) => sum + (s.salesAmount || 0), 0);
  const currentMonthStreamCount = currentMonthStreams.length;
  const currentMonthDuration = currentMonthStreams.reduce((sum, s) => sum + (s.duration || 0), 0);
  
  // Get previous month's stats for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStartDate = new Date(prevYear, prevMonth - 1, 1);
  const prevEndDate = new Date(prevYear, prevMonth, 0, 23, 59, 59);
  
  const prevMonthStreams = await db.select()
    .from(brandLivestreams)
    .where(and(
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
    const mStartDate = new Date(mYear, mMonth - 1, 1);
    const mEndDate = new Date(mYear, mMonth, 0, 23, 59, 59);
    
    const monthStreams = await db.select()
      .from(brandLivestreams)
      .where(and(
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
    topProducts: productSales,
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
export async function getTotalLiverSalesSummary(month: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Previous month for growth calculation
  const prevStartDate = new Date(year, monthNum - 2, 1);
  const prevEndDate = new Date(year, monthNum - 1, 0, 23, 59, 59);
  
  // Current month totals
  const currentMonth = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
      activeLivers: sql<number>`COUNT(DISTINCT ${brandLivestreams.liverId})`,
    })
    .from(brandLivestreams)
    .where(
      and(
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`
      )
    );
  
  // Previous month totals
  const prevMonth = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
      activeLivers: sql<number>`COUNT(DISTINCT ${brandLivestreams.liverId})`,
    })
    .from(brandLivestreams)
    .where(
      and(
        sql`${brandLivestreams.livestreamDate} >= ${prevStartDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${prevEndDate}`
      )
    );
  
  const current = currentMonth[0];
  const prev = prevMonth[0];
  
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
export async function getLiverMonthlySalesTrend() {
  const db = await getDb();
  if (!db) return [];
  
  const months = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const result = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
        totalLivestreams: sql<number>`COUNT(*)`,
      })
      .from(brandLivestreams)
      .where(
        and(
          sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
          sql`${brandLivestreams.livestreamDate} <= ${endDate}`
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
    .where(eq(brandLivestreams.liverId, liverId));
  
  // Get current month statistics
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const currentMonthStats = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
    })
    .from(brandLivestreams)
    .where(and(
      eq(brandLivestreams.liverId, liverId),
      sql`${brandLivestreams.livestreamDate} >= ${currentMonthStart}`,
      sql`${brandLivestreams.livestreamDate} <= ${currentMonthEnd}`
    ));
  
  // Get previous month statistics for growth calculation
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  
  const prevMonthStats = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      totalLivestreams: sql<number>`COUNT(*)`,
    })
    .from(brandLivestreams)
    .where(and(
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
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const result = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.salesAmount}), 0)`,
        totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
        totalLivestreams: sql<number>`COUNT(*)`,
      })
      .from(brandLivestreams)
      .where(and(
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
    .where(eq(brandLivestreams.liverId, liverId))
    .orderBy(desc(brandLivestreams.livestreamDate))
    .limit(limit);
  
  return livestreams;
}

/**
 * Get liver's brand performance breakdown
 */
export async function getLiverBrandPerformance(liverId: number) {
  const db = await getDb();
  if (!db) return [];
  
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
    .where(eq(brandLivestreams.liverId, liverId))
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
 * Get top selling products across all livers for a given month
 * 売れ筋商品ランキング（全ライバー合計）
 */
export async function getTopSellingProducts(month: string, limit: number = 10) {
  // Alias: getProductSalesRanking
  const db = await getDb();
  if (!db) return [];
  
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Get all livestreams for the month that have a liverId
  const livestreamsInMonth = await db
    .select({ 
      id: brandLivestreams.id,
      liverId: brandLivestreams.liverId,
    })
    .from(brandLivestreams)
    .where(
      and(
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
    
    return {
      rank: index + 1,
      productName: p.productName,
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
  
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
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
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
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
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
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
    const [year, monthNum] = month.split("-").map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
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
  
  const result = await db.insert(productMaster).values(data);
  return result;
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
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
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
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
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
 * ブランドIDで広告キャンペーン一覧を取得
 */
export async function getAdCampaignsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.brandId, brandId))
    .orderBy(desc(adCampaigns.createdAt));
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
  return db.select().from(tiktokCsvImportHistory).where(eq(tiktokCsvImportHistory.brandId, brandId)).orderBy(desc(tiktokCsvImportHistory.createdAt));
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
  
  const conditions = [eq(tiktokCommissionOrders.brandId, brandId)];
  
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
  
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
  
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

export async function getTiktokFinanceSummary(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select({
    totalOrders: sql<number>`count(*)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price}), 0)`,
    avgPrice: sql<number>`COALESCE(avg(${tiktokCommissionOrders.price}), 0)`,
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
    totalReturnQty: sql<number>`COALESCE(sum(${tiktokCommissionOrders.returnQuantity}), 0)`,
    totalRefundQty: sql<number>`COALESCE(sum(${tiktokCommissionOrders.refundQuantity}), 0)`,
    completedOrders: sql<number>`sum(case when ${tiktokCommissionOrders.orderStatus} = '完了' then 1 else 0 end)`,
    processingOrders: sql<number>`sum(case when ${tiktokCommissionOrders.orderStatus} = '処理中' then 1 else 0 end)`,
    minDate: sql<string>`min(${tiktokCommissionOrders.orderCreatedAt})`,
    maxDate: sql<string>`max(${tiktokCommissionOrders.orderCreatedAt})`,
  })
  .from(tiktokCommissionOrders)
  .where(eq(tiktokCommissionOrders.brandId, brandId));
  
  return result[0];
}

export async function getTiktokCreatorSummary(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select({
    creatorUsername: tiktokCommissionOrders.creatorUsername,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(eq(tiktokCommissionOrders.brandId, brandId))
  .groupBy(tiktokCommissionOrders.creatorUsername)
  .orderBy(desc(sql`sum(${tiktokCommissionOrders.price})`));
}

export async function getTiktokShopSummary(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select({
    shopName: tiktokCommissionOrders.shopName,
    shopCode: tiktokCommissionOrders.shopCode,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(eq(tiktokCommissionOrders.brandId, brandId))
  .groupBy(tiktokCommissionOrders.shopName, tiktokCommissionOrders.shopCode)
  .orderBy(desc(sql`sum(${tiktokCommissionOrders.price})`));
}

export async function getTiktokProductSummary(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select({
    productName: tiktokCommissionOrders.productName,
    productId: tiktokCommissionOrders.productId,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
    avgPrice: sql<number>`COALESCE(avg(${tiktokCommissionOrders.price}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(eq(tiktokCommissionOrders.brandId, brandId))
  .groupBy(tiktokCommissionOrders.productName, tiktokCommissionOrders.productId)
  .orderBy(desc(sql`sum(${tiktokCommissionOrders.price})`));
}

export async function getTiktokDailySummary(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select({
    date: sql<string>`DATE(${tiktokCommissionOrders.orderCreatedAt})`.as('date'),
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price}), 0)`,
    totalQuantity: sql<number>`COALESCE(sum(${tiktokCommissionOrders.quantity}), 0)`,
    totalActPartnerCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualPartnerCommission}), 0)`,
    totalActCreatorCommission: sql<number>`COALESCE(sum(${tiktokCommissionOrders.actualCreatorCommission}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(eq(tiktokCommissionOrders.brandId, brandId))
  .groupBy(sql`DATE(${tiktokCommissionOrders.orderCreatedAt})`)
  .orderBy(asc(sql`DATE(${tiktokCommissionOrders.orderCreatedAt})`));
}

export async function getTiktokContentTypeSummary(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select({
    contentType: tiktokCommissionOrders.contentType,
    orderCount: sql<number>`count(*)`,
    totalSales: sql<number>`COALESCE(sum(${tiktokCommissionOrders.price}), 0)`,
  })
  .from(tiktokCommissionOrders)
  .where(eq(tiktokCommissionOrders.brandId, brandId))
  .groupBy(tiktokCommissionOrders.contentType)
  .orderBy(desc(sql`count(*)`));
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
export async function getTopProductsByLiver(liverId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all livestream IDs for this liver
  const liverLivestreams = await db
    .select({ id: brandLivestreams.id })
    .from(brandLivestreams)
    .where(eq(brandLivestreams.liverId, liverId));
  
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
  
  return products.map((p, index) => ({
    rank: index + 1,
    productName: p.productName,
    totalGmv: Number(p.totalGmv),
    totalItemsSold: Number(p.totalItemsSold),
    totalOrders: Number(p.totalOrders),
    livestreamCount: Number(p.livestreamCount),
    avgGmvPerStream: Number(p.livestreamCount) > 0 ? Math.round(Number(p.totalGmv) / Number(p.livestreamCount)) : 0,
  }));
}

/**
 * Get product category analysis for a specific liver
 * ライバー別の得意カテゴリ分析（商品名からカテゴリを推定）
 */
export async function getLiverCategoryAnalysis(liverId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all livestream IDs for this liver
  const liverLivestreams = await db
    .select({ id: brandLivestreams.id })
    .from(brandLivestreams)
    .where(eq(brandLivestreams.liverId, liverId));
  
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
  
  // Category classification based on product name patterns
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
  
  const categoryMap = new Map<string, { gmv: number; itemsSold: number; productCount: number; products: string[] }>();
  
  for (const product of products) {
    const name = product.productName.toLowerCase();
    let matched = false;
    
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      if (patterns.some(pattern => name.includes(pattern.toLowerCase()))) {
        const existing = categoryMap.get(category) || { gmv: 0, itemsSold: 0, productCount: 0, products: [] };
        existing.gmv += Number(product.totalGmv);
        existing.itemsSold += Number(product.totalItemsSold);
        existing.productCount += 1;
        if (existing.products.length < 3) {
          existing.products.push(product.productName);
        }
        categoryMap.set(category, existing);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      const existing = categoryMap.get("その他") || { gmv: 0, itemsSold: 0, productCount: 0, products: [] };
      existing.gmv += Number(product.totalGmv);
      existing.itemsSold += Number(product.totalItemsSold);
      existing.productCount += 1;
      if (existing.products.length < 3) {
        existing.products.push(product.productName);
      }
      categoryMap.set("その他", existing);
    }
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
      topProducts: data.products,
    }))
    .sort((a, b) => b.gmv - a.gmv);
  
  return categories;
}
